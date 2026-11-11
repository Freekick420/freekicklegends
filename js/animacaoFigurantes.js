// Desenho dos figurantes (os outros jogadores em campo): cria os bonecos, põe cada um no lugar que a lógica
// de js/figurantes.js decidiu e dá vida a eles. Antes do chute cada um espera do seu jeito (pronto para
// correr, mãos na cintura, mãos nos joelhos, marcando com o braço no adversário...) e faz os seus gestos
// (aponta, pede a bola, ajeita o meião, dá uns pulinhos); na corrida do cobrador todos se armam; no chute
// acompanham a bola com a cabeça e o corpo e dão os passos para o rebote (os da lógica); no fim comemoram
// ou lamentam, conforme o time. Nada aqui muda a lógica: é só desenho.
//
// Eixos: x = direita de quem cobra, y = para cima, z = do gol para quem cobra. Os bonecos olham para +z
// local e a esquerda do boneco fica em +x local. Metros, segundos, radianos.

import { criarPersonagem, visualAdversario } from './jogadores.js?v=9';

// ---------- Utilidades ----------

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const suave = (u) => {
  const x = limitar(u, 0, 1);
  return x * x * (3 - 2 * x);
};
const misturar = (a, b, k) => a + (b - a) * k;
// Aproxima do alvo como uma mola amortecida simples (rapidez em 1/s; independe do passo do quadro)
const aproximar = (atual, alvo, rapidez, dt) => atual + (alvo - atual) * (1 - Math.exp(-rapidez * dt));
// Sobe e desce: 0 → 1 → 0 com u de 0 a 1
const sino = (u) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
// Entra, segura e sai: 0 → 1 (em 'entra') … 1 (até 'segura') → 0 (em 1)
const envelope = (u, entra, segura) => {
  if (u <= 0 || u >= 1) return 0;
  if (u < entra) return suave(u / entra);
  if (u < segura) return 1;
  return 1 - suave((u - segura) / (1 - segura));
};
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a)); // de −π a π

// Sorteio com semente (mulberry32): a mesma semente dá sempre a mesma sequência
function criarSorteio(semente) {
  let a = (semente * 2654435761) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Poses (o formato de js/jogadores.js) ----------

const GRUPOS = {
  tronco: ['frente', 'lado', 'giro'],
  cabeca: ['frente', 'giro', 'lado'],
  bracoE: ['frente', 'lado', 'cotovelo', 'giro'],
  bracoD: ['frente', 'lado', 'cotovelo', 'giro'],
  pernaE: ['frente', 'lado', 'joelho', 'tornozelo', 'giro'],
  pernaD: ['frente', 'lado', 'joelho', 'tornozelo', 'giro'],
  quadril: ['frente', 'lado', 'giro'],
};
const NOMES_GRUPOS = Object.keys(GRUPOS);
const SOLTOS = ['agachar', 'apoio', 'pulo'];

// Pose completa (todos os campos), reaproveitada quadro a quadro
function novaPose() {
  const p = { agachar: 0, apoio: 1, pulo: 0, maoE: { x: 0, y: 0, z: 0, peso: 0 }, maoD: { x: 0, y: 0, z: 0, peso: 0 } };
  for (const g of NOMES_GRUPOS) {
    p[g] = {};
    for (const c of GRUPOS[g]) p[g][c] = 0;
  }
  return p;
}

// De pé, parado: a base de tudo. respira e peso: ondas de −1 a 1 (cada jogador com o seu ritmo)
function poseDePe(p, respira, peso) {
  p.tronco.frente = 0.04 + 0.012 * respira;
  p.tronco.lado = 0.02 * peso;
  p.tronco.giro = 0;
  p.cabeca.frente = 0;
  p.cabeca.giro = 0;
  p.cabeca.lado = 0;
  p.quadril.frente = 0;
  p.quadril.lado = -0.03 * peso;
  p.quadril.giro = 0;
  for (const lado of ['E', 'D']) {
    const s = lado === 'E' ? 1 : -1;
    const b = p[`braco${lado}`];
    b.frente = 0.05;
    b.lado = 0.13 + 0.012 * respira;
    b.cotovelo = 0.24;
    b.giro = 0;
    const pe = p[`perna${lado}`];
    pe.frente = 0.02 * s;
    pe.lado = 0.07 + 0.02 * peso * s;
    pe.joelho = 0.05;
    pe.tornozelo = 0;
    pe.giro = 0.06;
  }
  p.agachar = 0.03 + 0.006 * respira;
  p.apoio = 1;
  p.pulo = 0;
  p.maoE.peso = 0;
  p.maoD.peso = 0;
}

// Uma pose parcial (só os campos que mudam) vira uma lista de campos, para aplicar sem criar objetos
function compilar(alvo) {
  const campos = [];
  const soltos = [];
  for (const g of NOMES_GRUPOS) {
    if (!alvo[g]) continue;
    for (const c of GRUPOS[g]) if (typeof alvo[g][c] === 'number') campos.push([g, c, alvo[g][c]]);
  }
  for (const c of SOLTOS) if (typeof alvo[c] === 'number') soltos.push([c, alvo[c]]);
  return { campos, soltos, maoE: alvo.maoE || null, maoD: alvo.maoD || null };
}
// Espelha uma pose parcial (troca esquerda e direita)
function espelhar(alvo) {
  const r = { ...alvo };
  r.bracoE = alvo.bracoD;
  r.bracoD = alvo.bracoE;
  r.pernaE = alvo.pernaD;
  r.pernaD = alvo.pernaE;
  r.maoE = alvo.maoD ? { ...alvo.maoD, x: -alvo.maoD.x } : undefined;
  r.maoD = alvo.maoE ? { ...alvo.maoE, x: -alvo.maoE.x } : undefined;
  for (const g of ['tronco', 'cabeca', 'quadril']) {
    if (alvo[g]) r[g] = { ...alvo[g], lado: alvo[g].lado === undefined ? undefined : -alvo[g].lado, giro: alvo[g].giro === undefined ? undefined : -alvo[g].giro };
  }
  return r;
}
// Leva a mão para um ponto (no espaço do tronco) com peso k; se ela estava solta, o ponto vale direto
function puxarMao(m, x, y, z, k) {
  if (k <= 0) return;
  if (m.peso < 0.01) {
    m.x = x;
    m.y = y;
    m.z = z;
    m.peso = k;
    return;
  }
  const w = k / Math.max(k, m.peso + k * (1 - m.peso));
  m.x = misturar(m.x, x, w);
  m.y = misturar(m.y, y, w);
  m.z = misturar(m.z, z, w);
  m.peso = m.peso + (1 - m.peso) * k;
}
// Puxa a pose p para a pose parcial compilada, com peso k (0 = nada, 1 = igual a ela)
function puxar(p, alvo, k) {
  if (k <= 0) return;
  const cs = alvo.campos;
  for (let i = 0; i < cs.length; i++) {
    const g = p[cs[i][0]];
    const c = cs[i][1];
    g[c] += (cs[i][2] - g[c]) * k;
  }
  const ss = alvo.soltos;
  for (let i = 0; i < ss.length; i++) p[ss[i][0]] += (ss[i][1] - p[ss[i][0]]) * k;
  if (alvo.maoE) puxarMao(p.maoE, alvo.maoE.x, alvo.maoE.y, alvo.maoE.z, k * (alvo.maoE.peso ?? 1));
  if (alvo.maoD) puxarMao(p.maoD, alvo.maoD.x, alvo.maoD.y, alvo.maoD.z, k * (alvo.maoD.peso ?? 1));
}
// As duas versões (normal e espelhada) de uma pose parcial
const par = (alvo) => [compilar(alvo), compilar(espelhar(alvo))];

// Mãos (no espaço do tronco: origem na cintura, y para cima, z para a frente, +x = esquerda do boneco)
const MAOS_CINTURA = { maoE: { x: 0.2, y: -0.02, z: 0.005 }, maoD: { x: -0.2, y: -0.02, z: 0.005 } };
const MAOS_CABECA = { maoE: { x: 0.085, y: 0.77, z: 0.035 }, maoD: { x: -0.085, y: 0.77, z: 0.035 } };

// Jeitos de esperar (por cima da pose de pé). Cada um tem a versão normal e a espelhada.
const JEITOS = {
  // Pronto para correr: um pé à frente, joelhos dobrados, tronco inclinado, braços soltos à frente
  pronto: par({
    tronco: { frente: 0.2 }, cabeca: { frente: -0.14 },
    bracoE: { frente: 0.24, lado: 0.2, cotovelo: 0.8 }, bracoD: { frente: 0.1, lado: 0.2, cotovelo: 0.7 },
    pernaE: { frente: 0.2, lado: 0.1, joelho: 0.12 }, pernaD: { frente: -0.2, lado: 0.1, joelho: 0.2, tornozelo: 0.14 },
    agachar: 0.13,
  }),
  // Mãos na cintura, o peso numa perna e a outra solta
  cintura: par({
    tronco: { frente: -0.01, lado: 0.035 }, quadril: { lado: 0.07 },
    pernaE: { frente: 0.0, lado: 0.07, joelho: 0.02 }, pernaD: { frente: 0.12, lado: 0.11, joelho: 0.26, tornozelo: 0.12 },
    ...MAOS_CINTURA, agachar: 0.015,
  }),
  // Solto: braços caídos, pés na largura dos ombros
  solto: par({
    tronco: { frente: 0.03 },
    bracoE: { frente: 0.04, lado: 0.13, cotovelo: 0.2 }, bracoD: { frente: 0.0, lado: 0.13, cotovelo: 0.16 },
    pernaE: { lado: 0.1 }, pernaD: { lado: 0.09, frente: -0.03 },
  }),
  // Mãos nos joelhos, descansando, com a cabeça levantada para ver a bola
  joelhos: par({
    tronco: { frente: 0.86 }, cabeca: { frente: -0.6 },
    pernaE: { lado: 0.17, frente: 0.04 }, pernaD: { lado: 0.17, frente: 0.04 },
    maoE: { x: 0.14, y: -0.11, z: 0.37 }, maoD: { x: -0.14, y: -0.11, z: 0.37 }, agachar: 0.3,
  }),
  // Marcando: meio de lado, joelhos dobrados, braços prontos (a mão que encosta no adversário é calculada)
  marcando: par({
    tronco: { frente: 0.16 }, cabeca: { frente: -0.1 },
    bracoE: { frente: 0.2, lado: 0.3, cotovelo: 0.75 }, bracoD: { frente: 0.15, lado: 0.25, cotovelo: 0.7 },
    pernaE: { frente: 0.12, lado: 0.14, joelho: 0.1 }, pernaD: { frente: -0.14, lado: 0.14, joelho: 0.16, tornozelo: 0.1 },
    agachar: 0.12,
  }),
  // Braços cruzados no peito
  cruzados: par({
    tronco: { frente: -0.02 },
    maoE: { x: -0.11, y: 0.2, z: 0.17 }, maoD: { x: 0.12, y: 0.16, z: 0.19 },
    pernaE: { lado: 0.1 }, pernaD: { lado: 0.1 },
  }),
};
// Na corrida do cobrador todo mundo se arma: mais baixo, braços prontos
const ARMADO = compilar({
  tronco: { frente: 0.22 }, cabeca: { frente: -0.16 },
  bracoE: { frente: 0.22, lado: 0.24, cotovelo: 0.85 }, bracoD: { frente: 0.18, lado: 0.24, cotovelo: 0.8 },
  pernaE: { frente: 0.12, lado: 0.13, joelho: 0.1 }, pernaD: { frente: -0.12, lado: 0.13, joelho: 0.14, tornozelo: 0.1 },
  agachar: 0.16,
});

// Reações ao resultado (por cima do que estiver fazendo)
const REACOES = {
  // Comemorar: braços para o alto (o pulo é à parte)
  bracosAoAlto: par({
    tronco: { frente: -0.14 }, cabeca: { frente: -0.32 },
    bracoE: { frente: 0.45, lado: 2.5, cotovelo: 0.45 }, bracoD: { frente: 0.45, lado: 2.6, cotovelo: 0.35 },
    pernaE: { lado: 0.1 }, pernaD: { lado: 0.1 },
  }),
  // Soco no ar: um braço para cima, o outro fechado
  soco: par({
    tronco: { frente: 0.1, giro: 0.15 }, cabeca: { frente: -0.2 },
    bracoE: { frente: 0.6, lado: 2.3, cotovelo: 0.9 }, bracoD: { frente: 0.5, lado: 0.3, cotovelo: 1.7 },
    pernaE: { frente: 0.15, lado: 0.12, joelho: 0.1 }, pernaD: { frente: -0.15, lado: 0.12, joelho: 0.2 },
    agachar: 0.12,
  }),
  // Braços abertos (correndo para o abraço, ou reclamando)
  bracosAbertos: par({
    tronco: { frente: -0.05 }, cabeca: { frente: -0.15 },
    bracoE: { frente: 0.15, lado: 1.35, cotovelo: 0.35, giro: 0.6 }, bracoD: { frente: 0.15, lado: 1.4, cotovelo: 0.3, giro: 0.6 },
  }),
  // Mãos na cabeça
  maosNaCabeca: par({
    tronco: { frente: 0.06 }, cabeca: { frente: 0.12 },
    bracoE: { frente: 1.2, lado: 1.0, cotovelo: 2.1 }, bracoD: { frente: 1.2, lado: 1.0, cotovelo: 2.1 },
    ...MAOS_CABECA,
  }),
  // Mãos na cintura, olhando para o chão
  cabisbaixo: par({
    tronco: { frente: 0.12 }, cabeca: { frente: 0.5 }, quadril: { lado: 0.05 },
    pernaD: { frente: 0.1, lado: 0.1, joelho: 0.22, tornozelo: 0.1 },
    ...MAOS_CINTURA,
  }),
  // Dobra o corpo, mãos nos joelhos, cabeça baixa
  dobrado: par({
    tronco: { frente: 0.9 }, cabeca: { frente: 0.15 },
    pernaE: { lado: 0.16 }, pernaD: { lado: 0.16 },
    maoE: { x: 0.14, y: -0.11, z: 0.37 }, maoD: { x: -0.14, y: -0.11, z: 0.37 }, agachar: 0.28,
  }),
  // Olha para o céu, braços caídos
  olhaParaCima: par({
    tronco: { frente: -0.12 }, cabeca: { frente: -0.55 },
    bracoE: { frente: -0.05, lado: 0.2, cotovelo: 0.15 }, bracoD: { frente: -0.05, lado: 0.2, cotovelo: 0.15 },
  }),
  // Punho fechado, contido (defesa que deu certo)
  punho: par({
    tronco: { frente: 0.12 }, cabeca: { frente: -0.05 },
    bracoE: { frente: 0.55, lado: 0.25, cotovelo: 1.9 }, bracoD: { frente: 0.1, lado: 0.2, cotovelo: 0.6 },
    agachar: 0.08,
  }),
  // Palmas à frente do peito (as mãos batem por conta do gesto)
  palmas: par({
    tronco: { frente: 0.05 }, cabeca: { frente: -0.08 },
    bracoE: { frente: 0.6, lado: 0.2, cotovelo: 1.5 }, bracoD: { frente: 0.6, lado: 0.2, cotovelo: 1.5 },
  }),
  // Solta o ar: ombros caem, braços soltos
  alivio: par({
    tronco: { frente: 0.1 }, cabeca: { frente: 0.1 },
    bracoE: { frente: 0.02, lado: 0.16, cotovelo: 0.12 }, bracoD: { frente: 0.02, lado: 0.16, cotovelo: 0.12 },
  }),
};

// Quem espera de que jeito (por papel; sorteado com o `jeito` de cada jogador)
const JEITOS_POR_PAPEL = {
  area: ['pronto', 'pronto', 'pronto', 'solto', 'cintura'],
  solto: ['pronto', 'cintura', 'solto', 'pronto'],
  marca: ['marcando', 'marcando', 'marcando', 'pronto'],
  sobra: ['solto', 'cintura', 'pronto', 'joelhos'],
  linha: ['pronto', 'joelhos', 'cintura', 'solto'],
  curto: ['cintura', 'solto', 'cruzados', 'pronto'],
  atras: ['cintura', 'cruzados', 'solto', 'joelhos'],
  ponta: ['pronto', 'cintura', 'solto'],
  fila: ['pronto', 'pronto', 'cintura', 'joelhos', 'pronto', 'solto'],
};
// Gestos que cada jeito faz enquanto espera
const GESTOS_POR_JEITO = {
  pronto: ['pulinhos', 'pedir', 'olhar', 'sacudir', 'apontar', 'ajeitar'],
  cintura: ['olhar', 'apontar', 'pescoco', 'sacudir', 'meiao'],
  solto: ['apontar', 'olhar', 'sacudir', 'meiao', 'pulinhos', 'ajeitar', 'palmas'],
  joelhos: ['olhar', 'levantar', 'levantar'],
  marcando: ['olhar', 'empurrar', 'empurrar', 'apontar'],
  cruzados: ['olhar', 'pescoco', 'apontar'],
};
const DURACAO_GESTO = { pulinhos: 1.1, pedir: 1.5, olhar: 1.3, sacudir: 1.4, apontar: 1.6, ajeitar: 1.0, pescoco: 1.8, meiao: 2.6, palmas: 1.2, empurrar: 0.9, levantar: 3.2 };

// Reação de cada time a cada resultado
const COMEMORA = ['bracosAoAlto', 'soco', 'bracosAbertos', 'bracosAoAlto', 'palmas'];
const SOFRE = ['maosNaCabeca', 'cabisbaixo', 'bracosAbertos', 'dobrado', 'olhaParaCima', 'cabisbaixo'];
const LAMENTA = ['maosNaCabeca', 'olhaParaCima', 'cabisbaixo', 'maosNaCabeca', 'alivio'];
const ALIVIA = ['punho', 'palmas', 'alivio', 'alivio', 'punho'];

// Medidas do boneco de 1,80 m (as de js/jogadores.js): do quadril ao joelho e do joelho ao tornozelo
const COXA = 0.44;
const CANELA = 0.42;
const ALTURA_REF = 1.795;
// O bico da chuteira em relação ao tornozelo: m à frente e m abaixo (o ponto de SOLA de js/jogadores.js)
const BICO_Z = 0.19;
const BICO_Y = 0.062;

const BONECOS_POR_QUADRO = 2; // criar boneco pesa: no máximo estes a cada quadro (os que mais aparecem primeiro)

// scene: a cena do jogo. opcoes.criarSombra(personagem, opcoes): cria a sombra de um boneco
// (devolve { atualizar({ x, z, altura }), remover() }, como em js/sombras.js). Devolve:
//   montar(figurantes, { uniformeAtaque, uniformeDefesa, semente })  prepara os bonecos de uma cobrança
//       (figurantes: o que montarFigurantes devolveu; os uniformes no formato de js/jogadores.js).
//       Os bonecos são reciclados enquanto o uniforme do time não muda; os novos nascem aos poucos
//       (BONECOS_POR_QUADRO por quadro), para a cobrança nova não travar o jogo.
//   atualizar(figurantes, t, dt, info)  a cada quadro. t: relógio (s); info: { fase, tempoDesdeChute, bola,
//       resultado } (fase do jogo; s desde o chute, negativo na corrida, null antes; a bola da física;
//       resultado do lance quando acabou: 'gol', 'defesa', 'trave', 'fora', 'cima', 'barreira', 'curta', 'jogador')
//   limpar()  tira todos da cena e solta os bonecos
//   diagnostico()  números para os testes (bonecos criados, reciclados, na fila...)
export function criarAnimadorFigurantes(scene, opcoes = {}) {
  const criarSombra = opcoes.criarSombra || null;
  // Bonecos guardados por time: { chave (uniforme), lista: [{ per, sombra, altura, numero, aparencia }] }
  const guardados = { ataque: { chave: '', lista: [] }, defesa: { chave: '', lista: [] } };
  const uniformes = { ataque: null, defesa: null };
  let atores = [];     // um por jogador da lógica, na mesma ordem
  let fila = [];       // atores ainda sem boneco
  let montagem = null; // o objeto de figurantes que está montado
  let semente = 0;
  let quadro = 0;
  const conta = { criados: 0, reciclados: 0, montagens: 0 };
  const estado = {
    tEspera: 0, tCorrida: 0, tVoo: 0, tFim: 0, fase: 'pronto', resultado: null, batidasVistas: 0,
    tensao: 0, bolaX: 0, bolaY: 0, bolaZ: 0,
  };

  function soltar(item) {
    if (item.sombra) item.sombra.remover();
    item.sombra = null;
    if (item.per) {
      scene.remove(item.per.grupo);
      item.per.dispose();
    }
    item.per = null;
  }
  function esconder(item) {
    if (item.sombra) item.sombra.remover();
    item.sombra = null;
    if (item.per) item.per.grupo.visible = false;
  }

  function limpar() {
    for (const time of ['ataque', 'defesa']) {
      for (const item of guardados[time].lista) soltar(item);
      guardados[time].lista = [];
      guardados[time].chave = '';
    }
    atores = [];
    fila = [];
    montagem = null;
  }

  // Cria (ou acorda) o boneco de um ator
  function vestir(ator) {
    const g = guardados[ator.j.time];
    let item = g.lista[ator.k];
    const j = ator.j;
    if (item && item.per && (item.altura !== j.altura || item.numero !== j.numero || item.aparencia !== j.aparencia)) {
      soltar(item);
      item = null;
    }
    if (!item || !item.per) {
      const per = criarPersonagem({
        visual: visualAdversario(j.aparencia + ator.variacao, j.altura),
        uniforme: uniformes[j.time], numero: j.numero, nome: '',
      });
      item = { per, sombra: null, altura: j.altura, numero: j.numero, aparencia: j.aparencia };
      g.lista[ator.k] = item;
      scene.add(per.grupo);
      conta.criados++;
    } else {
      conta.reciclados++;
    }
    item.per.grupo.visible = true;
    if (!item.sombra && criarSombra) item.sombra = criarSombra(item.per, { raio: 0.4 });
    ator.item = item;
    ator.per = item.per;
  }

  function montar(figurantes, { uniformeAtaque, uniformeDefesa, semente: s = 0 } = {}) {
    conta.montagens++;
    montagem = figurantes;
    semente = s;
    uniformes.ataque = uniformeAtaque;
    uniformes.defesa = uniformeDefesa;
    // Mudou o uniforme de um time: os bonecos dele não servem mais
    for (const time of ['ataque', 'defesa']) {
      const chave = JSON.stringify(uniformes[time] || null);
      const g = guardados[time];
      if (g.chave !== chave) {
        for (const item of g.lista) if (item) soltar(item);
        g.lista = [];
        g.chave = chave;
      }
    }
    const jogadores = (figurantes && figurantes.jogadores) || [];
    const sorteio = criarSorteio(Math.floor(s * 1e9) + 17);
    // Cada time tem um elenco de aparências que depende do uniforme (times diferentes, caras diferentes)
    const variacao = { ataque: guardados.ataque.chave.length % 8, defesa: (guardados.defesa.chave.length * 3 + 1) % 8 };
    const k = { ataque: 0, defesa: 0 };
    atores = jogadores.map((j, i) => novoAtor(j, i, k[j.time]++, variacao[j.time], sorteio, figurantes));
    // Quem sobrou no elenco guardado (a quantidade diminuiu) sai de cena, mas fica guardado
    for (const time of ['ataque', 'defesa']) {
      guardados[time].lista.forEach((item, n) => {
        if (item && n >= k[time]) esconder(item);
      });
    }
    // Os que já têm boneco guardado voltam na hora; os novos entram na fila (os que mais aparecem primeiro)
    fila = [];
    for (const ator of atores) {
      const item = guardados[ator.j.time].lista[ator.k];
      if (item && item.per && item.altura === ator.j.altura && item.numero === ator.j.numero && item.aparencia === ator.j.aparencia) vestir(ator);
      else fila.push(ator);
    }
    fila.sort((a, b) => (b.j.visto || 0) - (a.j.visto || 0) || a.i - b.i);
    Object.assign(estado, { tEspera: 0, tCorrida: 0, tVoo: 0, tFim: 0, fase: 'pronto', resultado: null, batidasVistas: 0, tensao: 0 });
    if (figurantes && figurantes.bola) {
      estado.bolaX = figurantes.bola.x;
      estado.bolaY = 0.11;
      estado.bolaZ = figurantes.bola.z;
    }
    for (const ator of atores) if (ator.per) posicionar(ator, 0);
  }

  function novoAtor(j, i, k, variacao, sorteio, figurantes) {
    const lista = JEITOS_POR_PAPEL[j.papel] || JEITOS_POR_PAPEL.solto;
    let jeito = lista[Math.floor((j.jeito ?? sorteio()) * lista.length) % lista.length];
    // Marcador sem ninguém para marcar espera como os outros
    if (jeito === 'marcando' && !(j.par >= 0)) jeito = 'pronto';
    // j.forcar (só a página de inspeção usa): { jeito, espelho, gesto, reacao, corre } escolhidos à mão
    const forcar = j.forcar || null;
    if (forcar && JEITOS[forcar.jeito]) jeito = forcar.jeito;
    const r = () => sorteio();
    const ator = {
      j, i, k, variacao, per: null, item: null,
      pose: novaPose(),
      jeito,
      espelho: (forcar && forcar.espelho !== undefined ? forcar.espelho : r() < 0.5) ? 1 : 0, // versão espelhada do jeito (o pé da frente...)
      fase0: r() * Math.PI * 2,             // cada um respira e troca o peso no seu ritmo
      ritmo: 0.85 + 0.3 * r(),
      rapidezOlhar: 4 + 5 * r(),
      yaw: j.rotacaoY || 0,
      yawBase: j.rotacaoY || 0,
      giroPassos: 0,
      cab: { f: 0, g: 0, ok: false },
      alvo: { x: 0, y: 0, z: 0 },
      gesto: { tipo: null, t0: 0, dur: 1, lado: 1, x: 0, z: 0 },
      proximoGesto: forcar && forcar.gesto ? 0.25 : 0.5 + 4.5 * r(),
      passada: r(),                          // fase dos passos (0 a 1 = dois passos)
      escalaZ: Math.sqrt((j.altura || 1.8) / ALTURA_REF), // o boneco mais alto tem a passada um pouco maior
      pes: [{ x: 0, y: 0, x0: 0, y0: 0, k: 0, noChao: true }, { x: 0, y: 0, x0: 0, y0: 0, k: 0, noChao: true }], // direito, esquerdo
      pousoX: 0, pousoY: 0,
      andar: 0,                              // 0 = parado, 1 = andando/correndo (suavizado)
      xAnt: j.x, zAnt: j.z,
      des: { x: 0, z: 0, v: 0, yaw: 0, ativo: false }, // corrida da comemoração (só no desenho)
      reacao: { tipo: null, t0: 0, atraso: 0.15 + 0.45 * r(), corre: false, pulos: 0, raio: 2.4, vira: 0 },
      batida: { t0: -9, forca: 0, lado: 1 },
      sorteio: criarSorteio(Math.floor(r() * 1e9)),
      figurantes,
    };
    return ator;
  }

  // ----- Gestos de quem espera -----

  function escolherGesto(ator) {
    const lista = GESTOS_POR_JEITO[ator.jeito] || GESTOS_POR_JEITO.solto;
    const r = ator.sorteio;
    let tipo = lista[Math.floor(r() * lista.length)];
    const j = ator.j;
    const parceiro = j.par >= 0 ? ator.figurantes.jogadores[j.par] : null;
    if (tipo === 'empurrar' && !parceiro) tipo = 'olhar';
    const forcado = j.forcar && DURACAO_GESTO[j.forcar.gesto] ? j.forcar.gesto : null;
    if (forcado) tipo = forcado;
    const g = ator.gesto;
    g.tipo = tipo;
    g.t0 = estado.tEspera;
    g.dur = DURACAO_GESTO[tipo] * (0.85 + 0.3 * r());
    g.lado = r() < 0.5 ? 1 : -1;
    // Para onde aponta ou olha: o parceiro, um companheiro qualquer ou o gol
    const outros = ator.figurantes.jogadores;
    const alguem = parceiro && r() < 0.6 ? parceiro : outros[Math.floor(r() * outros.length)];
    if (tipo === 'apontar' && r() < 0.35) {
      g.x = 0;
      g.z = 0;
    } else {
      g.x = alguem ? alguem.x : 0;
      g.z = alguem ? alguem.z : 0;
    }
    if (alguem === j) {
      g.x = 0;
      g.z = 0;
    }
    ator.proximoGesto = estado.tEspera + g.dur + (forcado ? 0.7 : 2.2 + 5.5 * r());
    // O empurrão do marcador é sentido pelo atacante
    if (tipo === 'empurrar' && parceiro) {
      const outro = atores[j.par];
      if (outro && !outro.gesto.tipo) {
        outro.gesto.tipo = 'empurrado';
        outro.gesto.t0 = estado.tEspera + 0.18;
        outro.gesto.dur = 0.7;
        outro.gesto.x = j.x;
        outro.gesto.z = j.z;
      }
    }
  }

  // Lado (+1 = esquerda do boneco, −1 = direita) em que fica o ponto (x, z)
  const ladoDe = (ator, x, z) => ((x - ator.j.x) * Math.cos(ator.yaw) - (z - ator.j.z) * Math.sin(ator.yaw) >= 0 ? 1 : -1);

  function aplicarGesto(ator, p, olhar) {
    const g = ator.gesto;
    if (!g.tipo) return;
    const u = (estado.tEspera - g.t0) / g.dur;
    if (u >= 1) {
      g.tipo = null;
      return;
    }
    if (u <= 0) return;
    const k = envelope(u, 0.2, 0.75);
    const E = g.lado > 0 ? 'E' : 'D';
    const braco = p[`braco${E}`];
    const mao = p[`mao${E}`];
    const s = g.lado;
    if (g.tipo === 'apontar') {
      // Braço esticado para o lugar; a cabeça vai junto e volta para a bola no fim
      const lado = ladoDe(ator, g.x, g.z);
      const b = p[lado > 0 ? 'bracoE' : 'bracoD'];
      const m = lado > 0 ? p.maoE : p.maoD;
      m.peso *= 1 - k;
      const dx = g.x - ator.j.x;
      const dz = g.z - ator.j.z;
      const a = angulo(Math.atan2(dx, dz) - ator.yaw);
      // (para o lado: abre o braço; para a frente: levanta)
      b.frente = misturar(b.frente, 1.25 * Math.cos(limitar(a, -1.5, 1.5)), k);
      b.lado = misturar(b.lado, 0.25 + 1.15 * Math.abs(Math.sin(limitar(a, -1.5, 1.5))), k);
      b.cotovelo = misturar(b.cotovelo, 0.12 + 0.1 * Math.sin(u * 14), k);
      p.tronco.giro += 0.18 * lado * Math.abs(Math.sin(limitar(a, -1.5, 1.5))) * k;
      const ko = envelope(u, 0.2, 0.55);
      olhar.x = misturar(olhar.x, g.x, ko);
      olhar.y = misturar(olhar.y, 1.6, ko);
      olhar.z = misturar(olhar.z, g.z, ko);
    } else if (g.tipo === 'pedir') {
      // Levanta o braço pedindo a bola
      mao.peso *= 1 - k;
      braco.frente = misturar(braco.frente, 0.35, k);
      braco.lado = misturar(braco.lado, 2.55 + 0.12 * Math.sin(u * 16), k);
      braco.cotovelo = misturar(braco.cotovelo, 0.25, k);
      p.tronco.lado += -0.05 * s * k;
    } else if (g.tipo === 'olhar') {
      const ko = envelope(u, 0.25, 0.7);
      olhar.x = misturar(olhar.x, g.x, ko);
      olhar.y = misturar(olhar.y, 1.6, ko);
      olhar.z = misturar(olhar.z, g.z, ko);
    } else if (g.tipo === 'pulinhos') {
      // Dois pulinhos no lugar, soltando os braços
      const f = u * 2;
      const no = Math.abs(Math.sin(f * Math.PI));
      p.pulo += 0.07 * no * k;
      p.apoio = Math.min(p.apoio, 1 - suave(no * 3) * k);
      p.agachar += 0.1 * (1 - no) * k;
      p.pernaE.tornozelo += 0.45 * no * k;
      p.pernaD.tornozelo += 0.45 * no * k;
      p.bracoE.cotovelo += 0.2 * no * k;
      p.bracoD.cotovelo += 0.2 * no * k;
    } else if (g.tipo === 'sacudir') {
      // Sacode uma perna para soltar o músculo
      const perna = p[`perna${E}`];
      const outra = p[`perna${E === 'E' ? 'D' : 'E'}`];
      const vibra = Math.sin(u * 30);
      perna.frente = misturar(perna.frente, 0.55, k);
      perna.lado = misturar(perna.lado, 0.14, k);
      perna.joelho = misturar(perna.joelho, 1.0 + 0.22 * vibra, k);
      perna.tornozelo = misturar(perna.tornozelo, 0.25 + 0.12 * vibra, k);
      outra.joelho = misturar(outra.joelho, 0.03, k);
      p.agachar = misturar(p.agachar, 0.02, k);
      p.quadril.lado += -0.07 * s * k;
      p.tronco.lado += 0.05 * s * k;
    } else if (g.tipo === 'ajeitar') {
      // Puxa o calção para cima com as duas mãos
      puxarMao(p.maoE, 0.17, -0.04, 0.06, k);
      puxarMao(p.maoD, -0.17, -0.04, 0.06, k);
      p.cabeca.frente += 0.25 * k;
      p.tronco.frente += 0.05 * k;
    } else if (g.tipo === 'pescoco') {
      // Estica o pescoço para um lado e para o outro
      p.cabeca.lado += 0.32 * Math.sin(u * Math.PI * 2) * k;
      p.tronco.lado += 0.03 * Math.sin(u * Math.PI * 2) * k;
    } else if (g.tipo === 'meiao') {
      // Abaixa para ajeitar o meião e volta
      const kb = envelope(u, 0.28, 0.72);
      p.tronco.frente = misturar(p.tronco.frente, 1.25, kb);
      p.agachar = misturar(p.agachar, 0.55, kb);
      p.cabeca.frente = misturar(p.cabeca.frente, 0.2, kb);
      const perna = p[`perna${E}`];
      perna.frente = misturar(perna.frente, 0.3, kb);
      perna.lado = misturar(perna.lado, 0.12, kb);
      mao.peso *= 1 - kb;
      p.maoE.peso *= 1 - kb;
      p.maoD.peso *= 1 - kb;
      braco.frente = misturar(braco.frente, 1.0, kb);
      braco.lado = misturar(braco.lado, 0.05, kb);
      braco.cotovelo = misturar(braco.cotovelo, 0.25 + 0.15 * Math.sin(u * 22), kb);
      const outro = p[`braco${E === 'E' ? 'D' : 'E'}`];
      outro.frente = misturar(outro.frente, 0.7, kb);
      outro.cotovelo = misturar(outro.cotovelo, 0.5, kb);
      olhar.peso *= 1 - kb;
    } else if (g.tipo === 'palmas') {
      // Bate palmas chamando o time
      const bate = 0.5 + 0.5 * Math.sin(u * Math.PI * 8);
      puxarMao(p.maoE, 0.02 + 0.07 * bate, 0.28, 0.3, k);
      puxarMao(p.maoD, -0.02 - 0.07 * bate, 0.28, 0.3, k);
    } else if (g.tipo === 'empurrar') {
      // O marcador encosta e empurra de leve
      p.tronco.frente += 0.08 * k;
      p.agachar += 0.05 * k;
      ator.empurra = k;
    } else if (g.tipo === 'empurrado') {
      // O atacante sente, balança e devolve com o ombro
      const lado = ladoDe(ator, g.x, g.z);
      const ke = envelope(u, 0.2, 0.5);
      p.tronco.lado += 0.1 * lado * ke; // inclina para longe do empurrão (lado > 0 = empurrão veio da esquerda)
      p.quadril.lado += -0.04 * lado * ke;
      const perna = lado > 0 ? p.pernaD : p.pernaE;
      perna.lado += 0.08 * sino(u / 0.6);
      perna.joelho += 0.25 * sino(u / 0.6);
      const b = lado > 0 ? p.bracoE : p.bracoD;
      b.lado += 0.35 * ke;
      b.cotovelo += 0.4 * ke;
      const ko = envelope(u, 0.3, 0.6) * 0.7;
      olhar.x = misturar(olhar.x, g.x, ko);
      olhar.y = misturar(olhar.y, 1.6, ko);
      olhar.z = misturar(olhar.z, g.z, ko);
    } else if (g.tipo === 'levantar') {
      // (mãos nos joelhos) endireita o corpo, respira e volta a apoiar
      ator.levanta = envelope(u, 0.25, 0.7);
    }
  }

  // ----- Passos -----

  // Os pés de quem anda. Cada pé guarda onde está em relação ao quadril (x m à frente, y m para a esquerda,
  // no boneco de 1,80). Enquanto está no chão ele fica para trás exatamente o que o corpo andou: é isso que
  // faz o pé não escorregar, mesmo com o corpo acelerando, freando, andando de lado ou de costas. Quando chega
  // a vez dele (a fase da passada), sai do chão, dobra o joelho e vai pousar à frente, na direção do movimento.
  // fase: 0 a 1 = dois passos (o pé direito pousa em 0, o esquerdo em 0,5).
  function andarPes(ator, frente, lado, passo, corrida) {
    const apoio = misturar(0.6, 0.5, corrida); // parte do ciclo com o pé no chão (andando, os dois se revezam com folga)
    const d = Math.hypot(frente, lado);
    // Onde o pé pousa: metade do que o corpo anda num apoio, na direção em que ele vai
    const alcance = (apoio * passo) / ator.escalaZ;
    const ax = d > 1e-5 ? (frente / d) * alcance : ator.pousoX;
    const ay = d > 1e-5 ? (lado / d) * alcance : ator.pousoY;
    ator.pousoX = ax;
    ator.pousoY = ay;
    for (let n = 0; n < 2; n++) {
      const pe = ator.pes[n];
      const u = (ator.passada + n * 0.5) % 1;
      if (u < apoio) {
        pe.noChao = true;
        pe.x -= frente / ator.escalaZ;
        pe.y -= lado / ator.escalaZ;
        pe.k = u / apoio;
      } else {
        if (pe.noChao) {
          pe.noChao = false;
          pe.x0 = pe.x;
          pe.y0 = pe.y;
        }
        pe.k = (u - apoio) / (1 - apoio);
        const k = suave(pe.k);
        pe.x = misturar(pe.x0, ax, k);
        pe.y = misturar(pe.y0, ay, k);
      }
    }
  }

  // Coxa, joelho e tornozelo de uma perna para o pé ficar onde andarPes mandou (dois ossos: COXA e CANELA)
  function poseDaPerna(perna, pe, sinal, corrida, w) {
    let joelho;
    let tornozelo;
    if (pe.noChao) {
      joelho = 0.07 + misturar(0.08, 0.2, corrida) * Math.sin(Math.PI * pe.k); // amortece no meio do apoio
      tornozelo = 0.38 * suave((pe.k - 0.8) / 0.2);                            // o calcanhar sai do chão no fim
    } else {
      joelho = 0.07 + misturar(0.7, 1.4, corrida) * Math.sin(Math.PI * pe.k);
      tornozelo = misturar(0.38, -0.1, suave(pe.k / 0.65));                    // bico para baixo ao sair, pé armado para pousar
    }
    const le = Math.sqrt(COXA * COXA + CANELA * CANELA + 2 * COXA * CANELA * Math.cos(joelho));
    // Com o calcanhar levantado o pé gira em volta do bico, que fica onde pisou: o tornozelo vai um pouco à frente
    const xTornozelo = pe.x + BICO_Z * (1 - Math.cos(tornozelo)) + BICO_Y * Math.sin(Math.max(0, tornozelo));
    const frente = Math.asin(limitar(xTornozelo / le, -0.92, 0.92)) + Math.asin(limitar((CANELA * Math.sin(joelho)) / le, -1, 1));
    // De lado: abre a perna (para dentro, só até quase encostar na outra)
    const fora = sinal * pe.y;
    const abre = Math.asin(limitar(fora / le, -0.07, 0.6));
    perna.frente = misturar(perna.frente, frente, w);
    perna.joelho = misturar(perna.joelho, joelho, w);
    perna.tornozelo = misturar(perna.tornozelo, tornozelo, w);
    perna.lado = misturar(perna.lado, 0.035 + abre, w);
    perna.giro = misturar(perna.giro, 0, w);
  }

  // Passada de quem anda ou corre, por cima da pose p. corrida: 0 = andando, 1 = correndo; w: peso (0 = parado,
  // na pose em que estava); paraFrente: quanto do movimento é para a frente (1) ou de lado/de costas (0)
  function aplicarPassada(ator, p, corrida, w, paraFrente) {
    if (w <= 0.001) return;
    const a = 2 * Math.PI * ator.passada;
    poseDaPerna(p.pernaD, ator.pes[0], -1, corrida, w);
    poseDaPerna(p.pernaE, ator.pes[1], 1, corrida, w);
    // Braços ao contrário das pernas (o esquerdo vai à frente com a perna direita), mais dobrados na corrida
    const balanco = misturar(0.28, 0.6, corrida) * Math.cos(a) * paraFrente;
    const dobra = misturar(0.45, 1.4, corrida);
    p.bracoE.frente = misturar(p.bracoE.frente, 0.05 + balanco, w);
    p.bracoD.frente = misturar(p.bracoD.frente, 0.05 - balanco, w);
    p.bracoE.lado = misturar(p.bracoE.lado, 0.17, w);
    p.bracoD.lado = misturar(p.bracoD.lado, 0.17, w);
    p.bracoE.cotovelo = misturar(p.bracoE.cotovelo, dobra + 0.25 * Math.cos(a) * corrida, w);
    p.bracoD.cotovelo = misturar(p.bracoD.cotovelo, dobra - 0.25 * Math.cos(a) * corrida, w);
    p.bracoE.giro = misturar(p.bracoE.giro, 0, w);
    p.bracoD.giro = misturar(p.bracoD.giro, 0, w);
    p.maoE.peso *= 1 - w;
    p.maoD.peso *= 1 - w;
    // Tronco inclinado para a frente, ombros e bacia torcendo um contra o outro
    p.tronco.frente = misturar(p.tronco.frente, misturar(0.07, 0.2, corrida) * paraFrente + 0.04, w);
    p.tronco.lado = misturar(p.tronco.lado, 0, w);
    p.tronco.giro = misturar(p.tronco.giro, -misturar(0.06, 0.13, corrida) * Math.cos(a) * paraFrente, w);
    p.quadril.giro = misturar(p.quadril.giro, misturar(0.04, 0.08, corrida) * Math.cos(a) * paraFrente, w);
    p.quadril.lado = misturar(p.quadril.lado, 0, w);
    p.quadril.frente = misturar(p.quadril.frente, 0, w);
    p.agachar = misturar(p.agachar, 0, w);
    p.pulo = misturar(p.pulo, 0, w);
    p.apoio = misturar(p.apoio, 1, w);
  }

  // ----- Reação ao resultado -----

  function escolherReacao(ator, resultado) {
    const r = ator.sorteio;
    const gol = resultado === 'gol';
    const ataque = ator.j.time === 'ataque';
    const lista = gol ? (ataque ? COMEMORA : SOFRE) : ataque ? LAMENTA : ALIVIA;
    const re = ator.reacao;
    re.tipo = lista[Math.floor(r() * lista.length)];
    re.t0 = estado.tFim + re.atraso * (gol && ataque ? 0.4 : 1);
    re.pulos = gol && ataque && (re.tipo === 'bracosAoAlto' || re.tipo === 'soco') ? 1 : 0;
    // Gol: boa parte dos companheiros corre para o cobrador (cada um para a uma distância, sem amontoar)
    re.corre = gol && ataque && r() < 0.65;
    re.vira = !gol || ataque ? 0 : (r() < 0.5 ? 1 : -1) * (0.4 + 0.9 * r());
    if (re.corre && re.tipo === 'palmas') re.tipo = 'bracosAbertos';
    const forcar = ator.j.forcar;
    if (forcar && REACOES[forcar.reacao]) {
      re.tipo = forcar.reacao;
      re.pulos = forcar.pulos ? 1 : 0;
      re.corre = !!forcar.corre;
      re.vira = forcar.vira || 0;
    }
  }

  // ----- Um quadro de um ator -----

  const olhar = { x: 0, y: 0, z: 0, peso: 1 };

  function animar(ator, t, dt, antes) {
    const j = ator.j;
    const p = ator.pose;
    const ph = ator.fase0;
    const tt = t * ator.ritmo;
    const respira = Math.sin(tt * 1.8 + ph);
    const peso = Math.sin(tt * 0.5 + ph * 1.7);
    const e = ator.espelho;
    const fase = estado.fase;

    poseDePe(p, respira, peso);
    ator.empurra = 0;
    ator.levanta = 0;

    // Para onde olha: a bola (no chão, antes do chute)
    olhar.x = estado.bolaX;
    olhar.y = estado.bolaY;
    olhar.z = estado.bolaZ;
    olhar.peso = 1;

    // Gestos: só enquanto espera (se o cobrador correu, larga o gesto e volta)
    const esperando = fase === 'pronto' || fase === 'carregando';
    const g = ator.gesto;
    if (esperando && !g.tipo && estado.tEspera > ator.proximoGesto && !(j.forcar && j.forcar.gesto === 'nenhum')) escolherGesto(ator);
    if (!esperando && g.tipo) {
      const u = (estado.tEspera - g.t0) / g.dur;
      if (u < 0.75) g.t0 = estado.tEspera - g.dur * Math.max(0.75, u);
    }

    // Jeito de esperar (some quando anda e quando reage)
    const kJeito = 1 - ator.andar;
    const jeito = JEITOS[ator.jeito][e];
    if (ator.jeito === 'joelhos') {
      // Quem descansa com as mãos nos joelhos se levanta quando o cobrador corre (e de vez em quando)
      puxar(p, jeito, kJeito * (1 - estado.tensao));
    } else {
      puxar(p, jeito, kJeito);
    }
    if (g.tipo) aplicarGesto(ator, p, olhar);
    if (ator.levanta > 0 && ator.jeito === 'joelhos') {
      poseDePe(p, respira, peso);
      puxar(p, jeito, kJeito * (1 - estado.tensao) * (1 - ator.levanta));
      p.bracoE.lado += 0.1 * ator.levanta;
      p.tronco.frente -= 0.06 * ator.levanta;
    }

    // Pequenos movimentos de quem está vivo: balança, ajeita os pés
    p.tronco.giro += 0.03 * Math.sin(tt * 0.37 + ph);
    p.tronco.lado += 0.012 * Math.sin(tt * 0.9 + ph * 2.3);
    if (ator.jeito === 'pronto' || ator.jeito === 'marcando') {
      // na ponta dos pés, quicando de leve
      const quica = Math.sin(tt * 5.2 + ph);
      p.agachar += 0.02 * quica * kJeito;
      p.pernaE.tornozelo += 0.05 * (1 + quica) * kJeito;
      p.pernaD.tornozelo += 0.05 * (1 + quica) * kJeito;
    }

    // Marcador: a mão do lado do atacante encosta nele (nas costas ou no braço)
    const parceiro = j.par >= 0 ? ator.figurantes.jogadores[j.par] : null;
    if (ator.jeito === 'marcando' && parceiro && kJeito > 0.05) {
      const dx = parceiro.x - j.x;
      const dz = parceiro.z - j.z;
      const c = Math.cos(ator.yaw);
      const sn = Math.sin(ator.yaw);
      const lx = dx * c - dz * sn;  // no espaço do boneco: +x = esquerda dele
      const lz = dx * sn + dz * c;
      const d = Math.hypot(lx, lz) || 1;
      const alcance = Math.max(0.2, d - 0.2 + 0.05 * ator.empurra); // até encostar no corpo do outro
      const m = lx >= 0 ? p.maoE : p.maoD;
      const kMao = kJeito * (0.75 + 0.25 * Math.sin(tt * 0.6 + ph)) * (1 - 0.5 * estado.tensao);
      puxarMao(m, (lx / d) * alcance, 0.3 + 0.03 * respira, (lz / d) * alcance + 0.02, limitar(kMao, 0, 1));
      p.tronco.giro += 0.12 * Math.sign(lx) * kJeito;
    }

    // Corrida do cobrador: todo mundo se arma
    if (estado.tensao > 0.001) puxar(p, ARMADO, estado.tensao * kJeito * (ator.jeito === 'joelhos' ? 1 : 0.8));

    // ----- Corpo: onde está, para onde vira, passos -----
    let px = j.x;
    let pz = j.z;
    const re = ator.reacao;
    const des = ator.des;
    let vx = j.vx || 0;
    let vz = j.vz || 0;

    // Fim do lance: a reação entra aos poucos
    let kReacao = 0;
    if (fase === 'fim' && estado.resultado) {
      if (!re.tipo) escolherReacao(ator, estado.resultado);
      const tr = estado.tFim - re.t0;
      kReacao = suave(tr / 0.35);
      if (kReacao > 0) {
        const alvoR = REACOES[re.tipo][e];
        const gol = estado.resultado === 'gol';
        const ataque = j.time === 'ataque';
        // No gol a reação é inteira; no erro, mais contida (e vai embora depois de um tempo)
        const forca = gol ? 1 : 0.85 * (1 - 0.5 * suave((tr - 1.6) / 1.2));
        puxar(p, alvoR, kReacao * forca);
        if (re.tipo === 'palmas') {
          const bate = 0.5 + 0.5 * Math.sin(tr * 15);
          puxarMao(p.maoE, 0.02 + 0.08 * bate, 0.3, 0.3, kReacao * forca);
          puxarMao(p.maoD, -0.02 - 0.08 * bate, 0.3, 0.3, kReacao * forca);
        }
        if (re.tipo === 'maosNaCabeca' || re.tipo === 'cabisbaixo') p.cabeca.giro += 0.14 * Math.sin(tr * 2.3) * kReacao; // balança a cabeça
        if (re.tipo === 'soco') {
          const bomba = Math.sin(tr * 9);
          p.bracoE.lado += 0.12 * bomba * kReacao * (e ? 0 : 1);
          p.bracoD.lado += 0.12 * bomba * kReacao * (e ? 1 : 0);
        }
        // Pulos da comemoração
        if (re.pulos && gol && ataque) {
          const no = Math.abs(Math.sin(tr * 4.4));
          const kp = kReacao * (1 - suave((tr - 1.8) / 0.8)) * (re.corre ? 0.4 : 1);
          p.pulo += 0.2 * no * kp;
          p.apoio = Math.min(p.apoio, 1 - suave(no * 3) * kp);
          p.agachar += 0.12 * (1 - no) * kp;
          p.pernaE.joelho += 0.35 * no * kp;
          p.pernaD.joelho += 0.2 * no * kp;
          p.pernaE.tornozelo += 0.4 * no * kp;
          p.pernaD.tornozelo += 0.4 * no * kp;
        }
        // Corre para o cobrador (ele termina o chute perto de onde a bola estava)
        if (re.corre) {
          const fx = ator.figurantes.bola.x - (j.x + des.x);
          const fz = ator.figurantes.bola.z - (j.z + des.z);
          const falta = Math.hypot(fx, fz);
          const alvoV = falta > re.raio ? Math.min(5.2, 1.5 + (falta - re.raio) * 1.6) : 0;
          des.v = aproximar(des.v, alvoV * suave(tr / 0.5), 5, dt);
          if (falta > 0.01) {
            des.x += (fx / falta) * des.v * dt;
            des.z += (fz / falta) * des.v * dt;
            vx = (fx / falta) * des.v;
            vz = (fz / falta) * des.v;
          }
          des.ativo = true;
        }
        olhar.peso *= 1 - 0.75 * kReacao * (re.tipo === 'cabisbaixo' || re.tipo === 'dobrado' || re.tipo === 'olhaParaCima' || re.tipo === 'maosNaCabeca' ? 1 : 0.3);
      }
    }
    px += des.x;
    pz += des.z;

    // Passos: a fase anda com a distância percorrida e o pé que está no chão fica onde pisou
    const dxM = px - ator.xAnt;
    const dzM = pz - ator.zAnt;
    const andou = Math.hypot(dxM, dzM);
    ator.xAnt = px;
    ator.zAnt = pz;
    const rapidez = Math.hypot(vx, vz);
    // Tamanho do passo: curtinho saindo do lugar, maior correndo (até onde a perna alcança; daí para cima,
    // mais passos por segundo)
    const passo = rapidez < 1.1 ? 0.26 + 0.37 * rapidez : Math.min(1.12, 0.45 + 0.2 * rapidez);
    const corrida = limitar((rapidez - 1.4) / 2.0, 0, 1);
    let paraFrente = 1;
    if (andou < 1) {
      ator.passada = (ator.passada + andou / (2 * passo)) % 1;
      // o que andou, no espaço do boneco: para a frente dele e para a esquerda dele
      const c = Math.cos(ator.yaw);
      const sn = Math.sin(ator.yaw);
      const frente = dxM * sn + dzM * c;
      andarPes(ator, frente, dxM * c - dzM * sn, passo, corrida);
      if (andou > 1e-5) paraFrente = Math.max(0, frente / andou);
    }
    ator.paraFrente = aproximar(ator.paraFrente ?? 1, paraFrente, 8, dt);
    ator.andar = aproximar(ator.andar, limitar(rapidez / 0.35, 0, 1), rapidez > 0.2 ? 14 : 8, dt);
    // Parado, os pés "voltam para casa" (embaixo do quadril) para o próximo passo sair do lugar certo
    if (ator.andar < 0.02) {
      for (const pe of ator.pes) {
        pe.x = 0;
        pe.y = 0;
        pe.noChao = true;
      }
    }
    aplicarPassada(ator, p, corrida, ator.andar, ator.paraFrente);

    // Para onde o corpo vira: antes do chute fica como a lógica mandou; andando, na direção em que anda
    // (sem dar as costas para a bola); depois do chute acompanha a bola
    let yawAlvo = ator.yawBase;
    const paraBola = Math.atan2(estado.bolaX - px, estado.bolaZ - pz);
    if (!antes) {
      yawAlvo = paraBola;
      if (rapidez > 0.4) {
        const paraFrente = Math.atan2(vx, vz);
        // quanto pode torcer em relação à bola: correndo vira o corpo todo
        const torce = des.ativo ? 3.2 : 1.1;
        yawAlvo = paraBola + limitar(angulo(paraFrente - paraBola), -torce, torce);
      } else if (kReacao > 0 && re.vira) {
        yawAlvo = paraBola + re.vira * suave((estado.tFim - re.t0 - 0.5) / 1.2);
      }
    }
    const erroYaw = angulo(yawAlvo - ator.yaw);
    // zona morta: não fica se virando por qualquer coisa
    const quer = Math.abs(erroYaw) > (antes ? 0.02 : 0.3) || rapidez > 0.4 ? erroYaw : erroYaw * 0.15;
    const giro = limitar(quer * (rapidez > 0.4 ? 7 : 4.2), -5.5, 5.5) * dt;
    ator.yaw += giro;
    // Passinhos no lugar enquanto gira parado
    if (ator.andar < 0.5 && dt > 0) {
      const kPasso = limitar(Math.abs(giro) / dt / 1.4, 0, 1) * (1 - ator.andar);
      ator.giroPassos += Math.abs(giro) * 2.4;
      const sf = Math.sin(ator.giroPassos * Math.PI);
      p.pernaE.joelho += 0.42 * kPasso * Math.max(0, sf);
      p.pernaE.frente += 0.15 * kPasso * Math.max(0, sf);
      p.pernaD.joelho += 0.42 * kPasso * Math.max(0, -sf);
      p.pernaD.frente += 0.15 * kPasso * Math.max(0, -sf);
    }
    // O tronco e a cabeça adiantam o giro que o corpo ainda não fez
    p.tronco.giro += limitar(angulo(paraBola - ator.yaw), -0.6, 0.6) * (antes ? 0.25 : 0.5) * (1 - 0.6 * ator.andar);

    // Bolada: se encolhe e vira o corpo
    const ub = (estado.tVoo - ator.batida.t0) / 0.8;
    if (ub > 0 && ub < 1) {
      const k = envelope(ub, 0.08, 0.5) * ator.batida.forca;
      p.tronco.frente += 0.35 * k;
      p.agachar += 0.14 * k;
      p.tronco.giro += 0.4 * ator.batida.lado * k;
      p.cabeca.frente += 0.3 * k;
      p.bracoE.cotovelo += 0.6 * k;
      p.bracoD.cotovelo += 0.6 * k;
      p.bracoE.frente += 0.3 * k;
      p.bracoD.frente += 0.3 * k;
      olhar.peso *= 1 - 0.8 * envelope(ub, 0.08, 0.5);
    }

    // ----- Cabeça: segue a bola (ou o gesto) -----
    const yawCorpo = ator.yaw + p.quadril.giro + p.tronco.giro;
    const ox = olhar.x - px;
    const oz = olhar.z - pz;
    const dOlhar = Math.hypot(ox, oz) || 1;
    const a = angulo(Math.atan2(ox, oz) - yawCorpo);
    const giroCab = limitar(a, -1.2, 1.2);
    const inclinado = (p.tronco.frente + p.quadril.frente) * Math.cos(giroCab);
    const frenteCab = limitar(-Math.atan2(olhar.y - j.altura * 0.93, dOlhar) - inclinado, -0.7, 0.7);
    const cab = ator.cab;
    if (!cab.ok) {
      cab.f = frenteCab;
      cab.g = giroCab;
      cab.ok = true;
    }
    cab.f = aproximar(cab.f, frenteCab, ator.rapidezOlhar, dt);
    cab.g = aproximar(cab.g, giroCab, ator.rapidezOlhar, dt);
    p.cabeca.frente = misturar(p.cabeca.frente, cab.f + p.cabeca.frente * 0.25, olhar.peso);
    p.cabeca.giro = misturar(p.cabeca.giro, cab.g, olhar.peso) + 0.05 * Math.sin(tt * 0.43 + ph);

    ator.px = px;
    ator.pz = pz;
  }

  // Põe o boneco na cena com a pose do ator
  function posicionar(ator, altura) {
    const per = ator.per;
    per.aplicarPose(ator.pose);
    const x = ator.px ?? ator.j.x;
    const z = ator.pz ?? ator.j.z;
    per.grupo.position.set(x, altura, z);
    per.grupo.rotation.set(0, ator.yaw, 0);
    if (ator.item.sombra) ator.item.sombra.atualizar({ x, z, altura: ator.pose.pulo || 0 });
  }

  function atualizar(figurantes, t, dt, info = {}) {
    if (!figurantes || figurantes !== montagem) return;
    quadro++;
    dt = limitar(dt || 0, 0, 0.1);
    // Bonecos novos: alguns por quadro
    for (let n = 0; n < BONECOS_POR_QUADRO && fila.length; n++) vestir(fila.shift());

    const fase = info.fase || 'pronto';
    const antes = fase === 'pronto' || fase === 'carregando' || fase === 'corrida';
    if (fase === 'pronto' || fase === 'carregando') estado.tEspera += dt;
    else if (fase === 'corrida') estado.tCorrida += dt;
    else estado.tVoo += dt;
    if (fase === 'fim') estado.tFim += dt;
    estado.fase = fase;
    estado.resultado = fase === 'fim' ? info.resultado || null : null;
    // A tensão sobe na corrida do cobrador e solta depois do chute
    const alvoTensao = fase === 'corrida' ? 1 : antes ? 0 : fase === 'voo' ? 0.5 : 0;
    estado.tensao = aproximar(estado.tensao, alvoTensao, alvoTensao > estado.tensao ? 5 : 2.5, dt);
    const bola = info.bola;
    if (bola && bola.pos) {
      estado.bolaX = bola.pos.x;
      estado.bolaY = bola.pos.y;
      estado.bolaZ = bola.pos.z;
    }
    // Bolada nova num figurante
    if ((figurantes.batidas || 0) > estado.batidasVistas) {
      estado.batidasVistas = figurantes.batidas;
      const ub = figurantes.ultimaBatida;
      const ator = ub && atores[ub.jogador];
      if (ator) {
        ator.batida.t0 = estado.tVoo;
        ator.batida.forca = limitar((ub.impacto || 10) / 16, 0.5, 1.2);
        ator.batida.lado = ladoDe(ator, estado.bolaX, estado.bolaZ);
      }
    }

    for (let i = 0; i < atores.length; i++) {
      const ator = atores[i];
      if (!ator.per) continue;
      animar(ator, t, dt, antes);
      posicionar(ator, 0);
    }
  }

  return {
    montar,
    atualizar,
    limpar,
    // Os bonecos em cena, na ordem dos jogadores da lógica (null = ainda na fila): para os testes medirem
    personagens: () => atores.map((a) => a.per),
    diagnostico: () => ({
      atores: atores.length,
      comBoneco: atores.filter((a) => a.per).length,
      naFila: fila.length,
      guardados: guardados.ataque.lista.filter((x) => x && x.per).length + guardados.defesa.lista.filter((x) => x && x.per).length,
      ...conta,
      quadro,
      jeitos: atores.map((a) => a.jeito),
      gestos: atores.map((a) => a.gesto.tipo),
      reacoes: atores.map((a) => a.reacao.tipo),
    }),
  };
}
