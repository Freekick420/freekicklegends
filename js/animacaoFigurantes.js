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
  // Abraço: os dois braços por cima dos ombros do companheiro
  abraco: par({
    tronco: { frente: 0.14 }, cabeca: { frente: -0.1, giro: 0.25 },
    bracoE: { frente: 1.3, lado: 0.5, cotovelo: 0.55 }, bracoD: { frente: 1.05, lado: 0.35, cotovelo: 0.9 },
    pernaE: { frente: 0.12, lado: 0.1 }, pernaD: { frente: -0.1, lado: 0.1, joelho: 0.12 },
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
// (os que se leem de longe, com o boneco a uns 40 pixels de altura, aparecem mais: apontar, pedir a bola,
// abaixar para o meião, olhar para o lado com o corpo, pulinhos)
const GESTOS_POR_JEITO = {
  pronto: ['pedir', 'apontar', 'pulinhos', 'olhar', 'meiao', 'apontar', 'sacudir'],
  cintura: ['apontar', 'olhar', 'meiao', 'apontar', 'pescoco', 'sacudir'],
  solto: ['apontar', 'olhar', 'meiao', 'pulinhos', 'pedir', 'palmas', 'sacudir'],
  joelhos: ['levantar', 'olhar', 'levantar'],
  marcando: ['olhar', 'empurrar', 'apontar', 'empurrar', 'apontar'],
  cruzados: ['olhar', 'apontar', 'pescoco', 'apontar'],
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
//       (BONECOS_POR_QUADRO por quadro), escondidos, para a cobrança nova não travar o jogo, e entram em
//       campo todos juntos; até lá os do uniforme anterior continuam em campo.
//       Depois do chute o desenho só depende da montagem, do tempo desde o chute e do resultado (não de
//       quanto tempo se esperou): o replay mostra os mesmos movimentos e as mesmas reações.
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
  let velhos = [];     // bonecos do uniforme anterior: ficam em campo até os novos estarem todos prontos
  let ocultos = false; // os bonecos novos desta montagem ainda estão escondidos (aparecem todos juntos)
  let montagem = null; // o objeto de figurantes que está montado
  let semente = 0;
  let quadro = 0;
  const conta = { criados: 0, reciclados: 0, montagens: 0 };
  const estado = {
    tEspera: 0, tCorrida: 0, tVoo: 0, tFim: 0, fase: 'pronto', resultado: null, batidasVistas: 0,
    tensao: 0, bolaX: 0, bolaY: 0, bolaZ: 0,
    tGesto: 0,        // relógio dos gestos (anda sempre)
    tChute: null,     // s desde o chute (negativo na corrida; null antes)
    kChute: 0,        // 0 = ondas no relógio do jogo; 1 = no relógio do chute
    planejado: false, // as reações deste lance já foram escolhidas
    cobX: 0, cobZ: 0, // onde o cobrador comemora (para onde os companheiros correm)
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
    for (const item of velhos) soltar(item);
    velhos = [];
    ocultos = false;
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
        detalhe: 'baixo', // vistos de longe: menos triângulos e textura menor
      });
      item = { per, sombra: null, altura: j.altura, numero: j.numero, aparencia: j.aparencia };
      g.lista[ator.k] = item;
      scene.add(per.grupo);
      conta.criados++;
    } else {
      conta.reciclados++;
    }
    ator.item = item;
    ator.per = item.per;
    if (ocultos && ator.novo) item.per.grupo.visible = false; // aparece com os outros, em revelar()
    else mostrar(item);
  }
  function mostrar(item) {
    item.per.grupo.visible = true;
    if (!item.sombra && criarSombra) item.sombra = criarSombra(item.per, { raio: 0.4 });
  }
  // Os bonecos novos ficaram todos prontos: entram juntos e os do uniforme anterior saem
  function revelar() {
    ocultos = false;
    for (const ator of atores) if (ator.per) mostrar(ator.item);
    for (const item of velhos) soltar(item);
    velhos = [];
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
        // (os que estão em campo ficam, parados, até os novos estarem prontos: a troca não deixa o campo vazio)
        for (const item of g.lista) {
          if (!item) continue;
          if (item.per && item.per.grupo.visible) velhos.push(item);
          else soltar(item);
        }
        g.lista = [];
        g.chave = chave;
      }
    }
    // (trocas seguidas: no máximo um elenco antigo de cada time em campo)
    while (velhos.length > 2 * 12) soltar(velhos.shift());
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
    // Bonecos novos nascem aos poucos, escondidos, e aparecem todos de uma vez (ninguém "pipoca" em campo)
    fila = [];
    ocultos = true;
    for (const ator of atores) {
      const item = guardados[ator.j.time].lista[ator.k];
      if (item && item.per && item.altura === ator.j.altura && item.numero === ator.j.numero && item.aparencia === ator.j.aparencia) {
        ator.novo = !item.per.grupo.visible; // (guardado mas fora de campo: entra junto com os novos)
        vestir(ator);
      } else {
        ator.novo = true;
        fila.push(ator);
      }
    }
    fila.sort((a, b) => (b.j.visto || 0) - (a.j.visto || 0) || a.i - b.i);
    ocultos = atores.some((a) => a.novo);
    if (!ocultos && velhos.length) revelar();
    Object.assign(estado, { tEspera: 0, tCorrida: 0, tVoo: 0, tFim: 0, fase: 'pronto', resultado: null, batidasVistas: 0, tensao: 0, tGesto: 0, tChute: null, kChute: 0, planejado: false });
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
      proximoGesto: forcar && forcar.gesto ? 0.25 : 0.3 + 1.7 * r(),
      passada: r(),                          // fase dos passos (0 a 1 = dois passos)
      escalaZ: Math.sqrt((j.altura || 1.8) / ALTURA_REF), // o boneco mais alto tem a passada um pouco maior
      pes: [{ x: 0, y: 0, x0: 0, y0: 0, k: 0, noChao: true }, { x: 0, y: 0, x0: 0, y0: 0, k: 0, noChao: true }], // direito, esquerdo
      pousoX: 0, pousoY: 0,
      andar: 0,                              // 0 = parado, 1 = andando/correndo (suavizado)
      xAnt: j.x, zAnt: j.z,
      des: { x: 0, z: 0, v: 0, yaw: 0, ativo: false }, // corrida da comemoração (só no desenho)
      reacao: { tipo: null, t0: 0, atraso: 0.15 + 0.45 * r(), corre: false, pulos: 0, raio: 2.4, vira: 0, ax: 0, az: 0, com: -1, chegou: 0 },
      batida: { t0: -9, forca: 0, lado: 1 },
      sorteio: criarSorteio(Math.floor(r() * 1e9)),          // gestos da espera (depende de quanto se esperou)
      sorteioReacao: criarSorteio(Math.floor(r() * 1e9) + 7), // só a reação ao resultado (o replay repete)
      bx: j.x, bz: j.z, lx: j.x, lz: j.z,                    // onde o boneco está sem a corrida da comemoração
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
    g.t0 = estado.tGesto;
    g.dur = DURACAO_GESTO[tipo] * (0.85 + 0.3 * r());
    g.lado = r() < 0.5 ? 1 : -1;
    // Para onde aponta ou olha: o parceiro, um companheiro qualquer ou o gol
    const outros = ator.figurantes.jogadores;
    let alguem = parceiro && r() < 0.6 ? parceiro : outros[Math.floor(r() * outros.length)];
    if (tipo === 'apontar' || tipo === 'olhar') {
      // De preferência alguém que esteja bem para o lado: o braço esticado de lado (ou o corpo virando) se vê
      // de longe; apontando para a frente, de onde a câmera olha, não se vê nada
      const sorteado = r();
      let maior = -1;
      for (let i = 0; i < outros.length; i++) {
        const o = outros[i];
        if (o === j) continue;
        const d = Math.hypot(o.x - j.x, o.z - j.z);
        const deLado = Math.abs(Math.sin(Math.atan2(o.x - j.x, o.z - j.z) - ator.yaw)) * (d > 2 ? 1 : 0.4) + 0.25 * ((sorteado * 7 + i * 0.37) % 1);
        if (deLado > maior) {
          maior = deLado;
          alguem = o;
        }
      }
    }
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
    ator.proximoGesto = estado.tGesto + g.dur + (forcado ? 0.7 : 1.5 + 2.5 * r());
    // O empurrão do marcador é sentido pelo atacante
    if (tipo === 'empurrar' && parceiro) {
      const outro = atores[j.par];
      if (outro && !outro.gesto.tipo) {
        outro.gesto.tipo = 'empurrado';
        outro.gesto.t0 = estado.tGesto + 0.18;
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
    const u = (estado.tGesto - g.t0) / g.dur;
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
      // Olha para o lado com o corpo junto (só a cabeça não se vê de longe)
      const ko = envelope(u, 0.25, 0.7);
      const a = angulo(Math.atan2(g.x - ator.j.x, g.z - ator.j.z) - ator.yaw);
      p.tronco.giro += 0.55 * limitar(a, -0.9, 0.9) * ko;
      p.quadril.giro += 0.15 * limitar(a, -0.9, 0.9) * ko;
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
    // Parte do ciclo com o pé no chão: andando, os dois se revezam com folga; correndo, menos da metade (entre
    // um pé e o outro o corpo voa um instante, e a passada não vira um espacate)
    const apoio = misturar(0.6, 0.4, corrida);
    const meio = ator.passada % 0.5;
    ator.voo = apoio < 0.5 && meio > apoio ? Math.sin((Math.PI * (meio - apoio)) / (0.5 - apoio)) : 0;
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
        // O ponto de onde saiu continua ficando para trás com o chão: assim o pé decola parado (em relação
        // ao gramado) e ganha velocidade aos poucos, em vez de sair arrastando o bico na grama
        pe.x0 -= frente / ator.escalaZ;
        pe.y0 -= lado / ator.escalaZ;
        pe.k = (u - apoio) / (1 - apoio);
        const k = suave(Math.min(1, pe.k * 1.08));
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
  // kCima: quanto da parte de cima do corpo está ocupada com a reação (1 = braços e tronco ficam com ela: quem
  // comemora correndo corre de braços abertos, não com os braços de corredor)
  function aplicarPassada(ator, p, corrida, wPernas, paraFrente, kCima = 0) {
    if (wPernas <= 0.001) return;
    const a = 2 * Math.PI * ator.passada;
    poseDaPerna(p.pernaD, ator.pes[0], -1, corrida, wPernas);
    poseDaPerna(p.pernaE, ator.pes[1], 1, corrida, wPernas);
    p.quadril.giro = misturar(p.quadril.giro, misturar(0.04, 0.08, corrida) * Math.cos(a) * paraFrente, wPernas);
    p.quadril.lado = misturar(p.quadril.lado, 0, wPernas);
    p.quadril.frente = misturar(p.quadril.frente, 0, wPernas);
    p.agachar = misturar(p.agachar, 0, wPernas);
    p.pulo = misturar(p.pulo, 0.07 * corrida * (ator.voo || 0), wPernas); // correndo: os dois pés no ar entre as passadas
    p.apoio = misturar(p.apoio, 1, wPernas);
    const w = wPernas * (1 - kCima);
    const wTronco = wPernas * (1 - 0.7 * kCima);
    // Braços ao contrário das pernas (o esquerdo vai à frente com a perna direita), mais dobrados na corrida
    const balanco = misturar(0.28, 0.6, corrida) * Math.cos(a) * paraFrente;
    const dobra = misturar(0.45, 1.4, corrida);
    const ombro = misturar(0.05, -0.18, corrida); // correndo, os cotovelos ficam para trás do corpo
    p.bracoE.frente = misturar(p.bracoE.frente, ombro + balanco, w);
    p.bracoD.frente = misturar(p.bracoD.frente, ombro - balanco, w);
    p.bracoE.lado = misturar(p.bracoE.lado, 0.17, w);
    p.bracoD.lado = misturar(p.bracoD.lado, 0.17, w);
    p.bracoE.cotovelo = misturar(p.bracoE.cotovelo, dobra + 0.25 * Math.cos(a) * corrida, w);
    p.bracoD.cotovelo = misturar(p.bracoD.cotovelo, dobra - 0.25 * Math.cos(a) * corrida, w);
    p.bracoE.giro = misturar(p.bracoE.giro, 0, w);
    p.bracoD.giro = misturar(p.bracoD.giro, 0, w);
    p.maoE.peso *= 1 - w;
    p.maoD.peso *= 1 - w;
    // Tronco inclinado para a frente, ombros e bacia torcendo um contra o outro
    p.tronco.frente = misturar(p.tronco.frente, misturar(0.07, 0.2, corrida) * paraFrente + 0.04, wTronco);
    p.tronco.lado = misturar(p.tronco.lado, 0, wTronco);
    p.tronco.giro = misturar(p.tronco.giro, -misturar(0.06, 0.13, corrida) * Math.cos(a) * paraFrente, wTronco);
  }

  // ----- Reação ao resultado -----

  function escolherReacao(ator, resultado) {
    const r = ator.sorteioReacao;
    const gol = resultado === 'gol';
    const ataque = ator.j.time === 'ataque';
    const lista = gol ? (ataque ? COMEMORA : SOFRE) : ataque ? LAMENTA : ALIVIA;
    const re = ator.reacao;
    re.tipo = lista[Math.floor(r() * lista.length)];
    re.t0 = estado.tFim + re.atraso * (gol && ataque ? 0.3 : 1);
    re.pulos = gol && ataque && (re.tipo === 'bracosAoAlto' || re.tipo === 'soco') ? 1 : 0;
    re.corre = false; // quem corre é decidido em planejarReacoes
    re.com = -1;
    re.chegou = 0;
    re.vira = !gol || ataque ? 0 : (r() < 0.5 ? 1 : -1) * (0.4 + 0.9 * r());
    const forcar = ator.j.forcar;
    if (forcar && REACOES[forcar.reacao]) {
      re.tipo = forcar.reacao;
      re.pulos = forcar.pulos ? 1 : 0;
      re.vira = forcar.vira || 0;
      if (forcar.corre) correrPara(ator, estado.cobX, estado.cobZ, 2.4, -1);
    }
  }
  function correrPara(ator, x, z, raio, com) {
    const re = ator.reacao;
    re.corre = true;
    re.ax = x;
    re.az = z;
    re.raio = raio;
    re.com = com;
    if (re.tipo === 'palmas' || re.tipo === 'soco') re.tipo = com >= 0 ? 'bracosAoAlto' : 'bracosAbertos';
  }

  // As reações de todo mundo, escolhidas de uma vez quando o lance acaba (só dependem da montagem e do
  // resultado: o replay repete). No gol, os 2 ou 3 companheiros mais perto do cobrador correm para ele; os
  // outros comemoram entre si (o mais próximo vai ao encontro do outro) ou no lugar, pulando.
  function planejarReacoes(resultado) {
    const B = montagem.bola || { x: 0, z: 20 };
    // O cobrador termina o chute um passo à frente de onde a bola estava
    const dB = Math.hypot(B.x, B.z) || 1;
    estado.cobX = B.x - (B.x / dB) * 0.9;
    estado.cobZ = B.z - (B.z / dB) * 0.9;
    for (let i = 0; i < atores.length; i++) escolherReacao(atores[i], resultado);
    if (resultado !== 'gol') return;
    const dist = (a) => Math.hypot(a.j.x - estado.cobX, a.j.z - estado.cobZ);
    const companheiros = atores.filter((a) => a.j.time === 'ataque' && !a.j.forcar).sort((a, b) => dist(a) - dist(b) || a.i - b.i);
    const n = companheiros.length >= 5 ? 3 : Math.min(2, companheiros.length);
    // (cada um corre de um jeito: braços abertos, punho no ar, os dois braços para cima)
    const JEITOS_DE_CORRER = ['bracosAbertos', 'soco', 'bracosAoAlto'];
    for (let k = 0; k < n; k++) {
      correrPara(companheiros[k], estado.cobX, estado.cobZ, 1.5 + 0.75 * k, -1);
      companheiros[k].reacao.tipo = JEITOS_DE_CORRER[(k + companheiros[0].i) % 3];
    }
    // Os outros: em duplas, do mais perto para o mais longe (até 8 m um do outro)
    const resto = companheiros.slice(n);
    for (let i = 0; i < resto.length; i++) {
      const a = resto[i];
      if (a.reacao.corre) continue;
      let melhor = null;
      let dMelhor = 8;
      for (let k = i + 1; k < resto.length; k++) {
        const b = resto[k];
        if (b.reacao.corre) continue;
        const d = Math.hypot(a.j.x - b.j.x, a.j.z - b.j.z);
        if (d < dMelhor) {
          dMelhor = d;
          melhor = b;
        }
      }
      if (!melhor) continue;
      // O encontro é no meio do caminho, mas longe de quem não participa (não se abraçam em cima de um zagueiro)
      let mx = (a.j.x + melhor.j.x) / 2;
      let mz = (a.j.z + melhor.j.z) / 2;
      const obst = montagem.obstaculos || [];
      for (let volta = 0; volta < 3; volta++) {
        for (let q = 0; q < atores.length + obst.length; q++) {
          const o = q < atores.length ? atores[q].j : obst[q - atores.length];
          if (o === a.j || o === melhor.j) continue;
          const d = Math.hypot(mx - o.x, mz - o.z);
          if (d < 1.5) {
            const ux = d > 1e-3 ? (mx - o.x) / d : 1;
            const uz = d > 1e-3 ? (mz - o.z) / d : 0;
            mx += ux * (1.5 - d);
            mz += uz * (1.5 - d);
          }
        }
      }
      correrPara(a, mx, mz, 0.42, melhor.i);
      correrPara(melhor, mx, mz, 0.42, a.i);
    }
  }

  // Rumo de quem corre de (x, z) na direção (dx, dz), desviando dos obstáculos por perto: quem está à frente
  // empurra para o lado (para o lado em que já está mais livre) e, bem de perto, para longe. Resultado em `rumo`.
  const rumo = { x: 0, z: 0 };
  function afastar(x, z, dx, dz, ox, oz, raio) {
    const rx = ox - x;
    const rz = oz - z;
    const d = Math.hypot(rx, rz);
    if (d > raio || d < 1e-4) return;
    const aFrente = (rx * dx + rz * dz) / d;
    if (aFrente < -0.2) return;
    const k = 1 - d / raio;
    const lado = rx * dz - rz * dx >= 0 ? -1 : 1; // o obstáculo está de um lado: passa pelo outro
    rumo.x += (dz * lado * 3 * (0.3 + aFrente) - (rx / d) * 1.2 * k) * k;
    rumo.z += (-dx * lado * 3 * (0.3 + aFrente) - (rz / d) * 1.2 * k) * k;
  }
  function desviar(ator, x, z, dx, dz, tx, tz) {
    rumo.x = dx;
    rumo.z = dz;
    const obst = ator.figurantes.obstaculos;
    // A barreira (todos os obstáculos menos o último, que é o goleiro) no meio do caminho: dá a volta pela
    // ponta que deixa o caminho mais curto
    const nMuro = obst ? obst.length - 1 : 0;
    if (nMuro >= 2) {
      const a = obst[0];
      const b = obst[nMuro - 1];
      const mx = b.x - a.x;
      const mz = b.z - a.z;
      const ml = Math.hypot(mx, mz) || 1;
      const folga = 1.5 / ml;
      // cruzamento do caminho (daqui até o cobrador) com a linha da barreira esticada 1,5 m para cada lado
      const den = (tx - x) * mz - (tz - z) * mx;
      if (Math.abs(den) > 1e-6) {
        const u = ((a.x - x) * mz - (a.z - z) * mx) / den;          // onde no caminho (0 = aqui, 1 = lá)
        const w = ((a.x - x) * (tz - z) - (a.z - z) * (tx - x)) / den; // onde na barreira (0 = uma ponta, 1 = a outra)
        if (u > 0 && u < 1 && w > -folga && w < 1 + folga) {
          const k = w < 0.5 ? -folga : 1 + folga;
          const px = a.x + mx * k - x;
          const pz = a.z + mz * k - z;
          const pn = Math.hypot(px, pz) || 1;
          rumo.x = px / pn;
          rumo.z = pz / pn;
          dx = rumo.x;
          dz = rumo.z;
        }
      }
    }
    if (obst) for (let i = 0; i < obst.length; i++) afastar(x, z, dx, dz, obst[i].x, obst[i].z, 3.2);
    for (let i = 0; i < atores.length; i++) {
      const o = atores[i];
      if (o !== ator && o.i !== ator.reacao.com) afastar(x, z, dx, dz, o.px ?? o.j.x, o.pz ?? o.j.z, 1.8);
    }
    const n = Math.hypot(rumo.x, rumo.z) || 1;
    rumo.x /= n;
    rumo.z /= n;
  }

  // ----- Um quadro de um ator -----

  const olhar = { x: 0, y: 0, z: 0, peso: 1 };
  let ondaA = 0;
  let ondaB = 0;
  // Onda de −1 a 1 com a frequência f (rad/s) e a fase do ator, no relógio da vez (veja animar)
  function onda(f, fase) {
    const k = estado.kChute;
    if (k <= 0) return Math.sin(ondaA * f + fase);
    if (k >= 1) return Math.sin(ondaB * f + fase);
    return misturar(Math.sin(ondaA * f + fase), Math.sin(ondaB * f + fase), k);
  }

  function animar(ator, t, dt, antes) {
    const j = ator.j;
    const p = ator.pose;
    const ph = ator.fase0;
    // Dois relógios: o do jogo (enquanto espera) e o do chute (s desde o chute). Um pouco antes do chute as
    // ondas passam para o do chute: daí em diante o desenho não depende de quanto tempo se esperou, e o replay
    // repete os mesmos movimentos
    ondaA = t * ator.ritmo;
    ondaB = (estado.tChute || 0) * ator.ritmo;
    const respira = onda(1.8, ph);
    const peso = onda(0.5, ph * 1.7);
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
    if (esperando && !g.tipo && estado.tGesto > ator.proximoGesto && !(j.forcar && j.forcar.gesto === 'nenhum')) escolherGesto(ator);
    if (!esperando && g.tipo) {
      // (pula para a saída do gesto e encurta o que falta: quando o pé bate na bola, já acabou)
      const u = (estado.tGesto - g.t0) / g.dur;
      if (u < 0.75) {
        g.dur = Math.min(g.dur, 1.6);
        g.t0 = estado.tGesto - g.dur * 0.75;
      }
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
    p.tronco.giro += 0.03 * onda(0.37, ph);
    p.tronco.lado += 0.012 * onda(0.9, ph * 2.3);
    if (ator.jeito === 'pronto' || ator.jeito === 'marcando') {
      // na ponta dos pés, quicando de leve
      const quica = onda(5.2, ph);
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
      const kMao = kJeito * (0.75 + 0.25 * onda(0.6, ph)) * (1 - 0.5 * estado.tensao);
      puxarMao(m, (lx / d) * alcance, 0.3 + 0.03 * respira, (lz / d) * alcance + 0.02, limitar(kMao, 0, 1));
      p.tronco.giro += 0.12 * Math.sign(lx) * kJeito;
    }

    // Corrida do cobrador: todo mundo se arma
    if (estado.tensao > 0.001) puxar(p, ARMADO, estado.tensao * kJeito * (ator.jeito === 'joelhos' ? 1 : 0.8));

    // ----- Corpo: onde está, para onde vira, passos -----
    const re = ator.reacao;
    const des = ator.des;
    // Onde está: segue a lógica (os passos para o rebote). Quando o lance acaba com a bola fora de jogo (gol,
    // para fora, por cima) não há rebote para buscar: o boneco freia em vez de terminar o passeio.
    const semRebote = fase === 'fim' && (estado.resultado === 'gol' || estado.resultado === 'fora' || estado.resultado === 'cima');
    const solta = semRebote ? 1 - suave(estado.tFim / 0.35) : 1;
    const dxL = j.x - ator.lx;
    const dzL = j.z - ator.lz;
    ator.lx = j.x;
    ator.lz = j.z;
    if (Math.hypot(dxL, dzL) > 1) {
      ator.bx = j.x;
      ator.bz = j.z;
    } else {
      ator.bx += dxL * solta;
      ator.bz += dzL * solta;
    }
    let px = ator.bx;
    let pz = ator.bz;
    let vx = (j.vx || 0) * solta;
    let vz = (j.vz || 0) * solta;
    let kCima = 0;

    // Fim do lance: a reação entra aos poucos
    let kReacao = 0;
    if (fase === 'fim' && estado.resultado) {
      if (!re.tipo) escolherReacao(ator, estado.resultado);
      const tr = estado.tFim - re.t0;
      kReacao = suave(tr / 0.3);
      if (kReacao > 0) {
        const alvoR = REACOES[re.tipo][e];
        const gol = estado.resultado === 'gol';
        const ataque = j.time === 'ataque';
        // No gol a reação é inteira; no erro, mais contida (e vai embora depois de um tempo)
        const forca = gol ? 1 : 0.85 * (1 - 0.5 * suave((tr - 1.6) / 1.2));
        kCima = kReacao * forca;
        puxar(p, alvoR, kReacao * forca);
        // Chegou no companheiro: abraço (e pulam juntos)
        if (re.com >= 0 && re.chegou > 0.001) puxar(p, REACOES.abraco[e], re.chegou * kReacao);
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
        if ((re.pulos || re.corre) && gol && ataque) {
          const no = Math.abs(Math.sin(tr * 4.4));
          const kp = kReacao * (1 - suave((tr - 1.8) / 0.8)) * (re.corre ? re.chegou : 1);
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
          // Corre para o cobrador (re.com < 0) ou para o companheiro com quem comemora
          const fx = re.ax - (px + des.x);
          const fz = re.az - (pz + des.z);
          const falta = Math.hypot(fx, fz);
          // Arranca forte (até 9 m/s²), chega a uns 6,5 m/s e freia para parar na distância certa
          const alvoV = falta > re.raio ? Math.min(6.5, 1.2 + (falta - re.raio) * 2.6) : 0;
          des.v += limitar(alvoV - des.v, -14 * dt, 9 * dt);
          re.chegou = aproximar(re.chegou, falta < re.raio + 0.45 ? 1 : 0, 7, dt);
          if (falta > 0.01) {
            // Vai desviando de quem está no caminho (barreira, goleiro, outros figurantes)
            desviar(ator, px + des.x, pz + des.z, fx / falta, fz / falta, re.ax, re.az);
            // (a direção muda aos poucos: ninguém corre em zigue-zague)
            const kd = des.dx || des.dz ? 1 - Math.exp(-6 * dt) : 1;
            des.dx = (des.dx || 0) + (rumo.x - (des.dx || 0)) * kd;
            des.dz = (des.dz || 0) + (rumo.z - (des.dz || 0)) * kd;
            const dn = Math.hypot(des.dx, des.dz) || 1;
            des.x += (des.dx / dn) * des.v * dt;
            des.z += (des.dz / dn) * des.v * dt;
            vx = (des.dx / dn) * des.v;
            vz = (des.dz / dn) * des.v;
          }
          des.ativo = true;
        }
        // Acabou o duelo: quem marcava e quem era marcado se soltam (um passo para longe um do outro), para
        // os braços da comemoração ou do lamento não atravessarem o vizinho
        if (parceiro && !re.corre && dt > 0) {
          const outro = atores[j.par];
          const ux = px - (outro ? outro.bx : parceiro.x);
          const uz = pz - (outro ? outro.bz : parceiro.z);
          const un = Math.hypot(ux, uz) || 1;
          const kd = 0.42 * suave(tr / 1.1);
          const nx = (ux / un) * kd;
          const nz = (uz / un) * kd;
          vx += (nx - des.x) / dt;
          vz += (nz - des.z) / dt;
          des.x = nx;
          des.z = nz;
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
    const passo = rapidez < 1.1 ? 0.26 + 0.34 * rapidez : Math.min(1.1, 0.5 + 0.12 * rapidez);
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
    aplicarPassada(ator, p, corrida, ator.andar, ator.paraFrente, kCima);

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
      } else if (kReacao > 0 && re.corre) {
        yawAlvo = Math.atan2(re.ax - px, re.az - pz);
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
    p.cabeca.giro = misturar(p.cabeca.giro, cab.g, olhar.peso) + 0.05 * onda(0.43, ph);

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
    if (ocultos && !fila.length) revelar();

    const fase = info.fase || 'pronto';
    const antes = fase === 'pronto' || fase === 'carregando' || fase === 'corrida';
    if (fase === 'pronto' || fase === 'carregando') estado.tEspera += dt;
    else if (fase === 'corrida') estado.tCorrida += dt;
    else estado.tVoo += dt;
    if (fase === 'fim') estado.tFim += dt;
    estado.tGesto += dt;
    estado.fase = fase;
    estado.resultado = fase === 'fim' ? info.resultado || null : null;
    const tChute = Number.isFinite(info.tempoDesdeChute) ? info.tempoDesdeChute : antes ? null : estado.tVoo;
    estado.tChute = tChute;
    estado.kChute = tChute === null ? 0 : suave((tChute + 0.6) / 0.4);
    // A tensão sobe na corrida do cobrador (no replay, só quando ele sai do lugar) e solta depois do chute
    const alvoTensao = fase === 'corrida' ? (tChute === null || tChute > -0.9 ? 1 : 0) : antes ? 0 : fase === 'voo' ? 0.5 : 0;
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

    if (fase === 'fim' && estado.resultado && !estado.planejado) {
      estado.planejado = true;
      planejarReacoes(estado.resultado);
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
      visiveis: atores.filter((a) => a.per && a.per.grupo.visible).length,
      velhos: velhos.length,
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
