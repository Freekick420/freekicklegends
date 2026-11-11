// Testes da animação da cobrança (js/cobranca.js): a corrida, o chute e a terminação, medidos no boneco.
//
// Rodar com:   node testes/cobranca.mjs            (resumo e checagens)
//              node testes/cobranca.mjs --detalhe  (uma linha por cobrança, com o pior caso de cada medida)
//              node testes/cobranca.mjs --lenda=8  (só uma lenda, pelo número da camisa)
//
// Precisa do Three.js em disco (no jogo ele vem do import map do index.html). O carregador
// testes/carregador-three.mjs procura, nesta ordem: a variável de ambiente FKL_THREE (caminho do
// three.module.js), node_modules/three (npm i --no-save three@0.160.0) e testes/vendor/three.module.js.
//
// O que é medido, cobrança por cobrança (lendas destras e canhotas, corridas curtas e longas, todas as batidas):
//   - escorregão: nenhum ponto da sola anda no gramado enquanto está encostado nele (< 2 cm)
//   - pé abaixo do chão (< 1 cm) e pé que deveria estar pisando mas flutua (< 1 cm)
//   - contato: no instante tempoContato, o ponto do pé que bate fica a < 3 cm do ponto escolhido na bola
//   - saltos: velocidade de cada junta entre dois quadros de 1/60 s (< 25 rad/s; só o joelho do chute passa
//     disso, no chicote), joelhos e cotovelos que nunca dobram ao contrário, corpo que não teleporta
//   - tempo do soltar do botão até o contato (0,85 s a 2,1 s) e `inicio` que não muda com preparar()
//   - canhoto = espelho exato do destro; replay = mesma animação; custo por quadro
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./carregador-three.mjs', import.meta.url);

let THREE;
try {
  THREE = await import('three');
} catch (e) {
  console.error(`Não achei o Three.js: ${e.message}`);
  console.error('Use FKL_THREE=/caminho/para/three.module.js node testes/cobranca.mjs (ou npm i --no-save three@0.160.0).');
  process.exit(1);
}
const { criarPersonagem, SOLA } = await import('../js/jogadores.js');
const { criarCobranca, PADRAO_COBRANCA, poseChute, poseCorrida, poseCobradorPronto, poseComemoracao, poseLamento, bolaNoContato, TEMPO_CONTATO } = await import('../js/cobranca.js');
const { ELENCO } = await import('../js/elenco.js');
const { CONFIG } = await import('../js/config.js');
const { preverTecnica } = await import('../js/physics.js');

const DETALHE = process.argv.includes('--detalhe');
const SO_LENDA = Number((process.argv.find((a) => a.startsWith('--lenda=')) || '').slice(8)) || 0;
const GRAUS = Math.PI / 180;
const DT = 1 / 60;
const RAIO = CONFIG.raioBola;

// Limites
const LIM = {
  escorrega: 0.02,   // m
  arrasta: 0.03,     // m por quadro
  abaixo: 0.01,      // m
  flutua: 0.01,      // m
  contato: 0.03,     // m
  junta: 25,         // rad/s
  joelhoChute: 45,   // rad/s (o chicote da canela)
  corpo: 8.5,        // m/s do grupo
  tempoMin: 0.85,
  tempoMax: 2.1,
};

// O CONFIG que o main.js monta para cada lenda (configDaCobranca)
function cfgDaLenda(jogador) {
  const base = { ...PADRAO_COBRANCA, ...(CONFIG.cobrador || {}) };
  const c = jogador.cobranca;
  const cadencia = base.cadencia * (c.ritmo || 1);
  const passos = c.passos || 3;
  return {
    ...CONFIG,
    cobrador: {
      ...base, distancia: c.distancia ?? base.distancia, angulo: c.angulo ?? base.angulo, cadencia,
      corrida: Math.max(0.2, passos / (2 * cadencia) - 0.3), postura: c.postura || 'normal', braco: c.braco || 'normal',
    },
  };
}
const posicaoDaFalta = ({ distancia, angulo }) => ({ x: distancia * Math.sin(angulo * GRAUS), z: distancia * Math.cos(angulo * GRAUS) });

const JUNTAS = ['quadril', 'tronco', 'cabeca', 'ombroE', 'cotoveloE', 'ombroD', 'cotoveloD', 'pernaE', 'joelhoE', 'tornozeloE', 'pernaD', 'joelhoD', 'tornozeloD'];
// Pontos da sola (no espaço do tornozelo): a linha do meio de SOLA e as bordas
const PONTOS_SOLA = [];
for (const [, y, z] of SOLA) for (const x of [-0.04, 0, 0.04]) PONTOS_SOLA.push(new THREE.Vector3(x, y, z));

function montar(jogador, falta, { pe = jogador.pe, espelho = 1 } = {}) {
  const personagem = criarPersonagem({ visual: jogador.visual, numero: jogador.numero, nome: jogador.apelido });
  const pos = posicaoDaFalta(falta);
  const bola = { x: espelho * pos.x, z: pos.z };
  const animacao = criarCobranca(personagem, { bola, alvo: { x: 0, z: 0 }, pe, cfg: cfgDaLenda(jogador), estilo: jogador.cobranca });
  return { personagem, animacao, bola, jogador, pe };
}

// O ponto da bola onde o pé pega (conta feita aqui, sem olhar a animação): atrás da bola, na direção do
// chute, deslocado conforme o contato (x > 0 = lado direito, y > 0 = em cima)
function pontoNaBola(bola, alvo, contato) {
  let { x, y } = contato;
  const r = Math.hypot(x, y);
  if (r > 1) {
    x /= r;
    y /= r;
  }
  const d = Math.hypot(alvo.x - bola.x, alvo.z - bola.z);
  const f = { x: (alvo.x - bola.x) / d, z: (alvo.z - bola.z) / d };
  const dir = { x: -f.z, z: f.x };
  const prof = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  return new THREE.Vector3(bola.x + RAIO * (x * dir.x - prof * f.x), RAIO * (1 + y), bola.z + RAIO * (x * dir.z - prof * f.z));
}

// A bola de mentira que o cobrador acompanha com a cabeça depois do chute
function bolaEm(c, chute, t, tc) {
  if (t < tc) return { x: c.bola.x, y: RAIO, z: c.bola.z };
  const u = t - tc;
  const d = Math.hypot(chute.alvo.x - c.bola.x, chute.alvo.z - c.bola.z);
  const v = 24;
  return { x: c.bola.x + ((chute.alvo.x - c.bola.x) / d) * v * u, y: RAIO + 7 * u - 4.9 * u * u * 0.6, z: c.bola.z + ((chute.alvo.z - c.bola.z) / d) * v * u };
}

const mundo = (c, junta, v) => c.personagem.juntas[junta].localToWorld(v.clone());

// Roda uma cobrança inteira em quadros de 1/60 s e mede tudo
function rodar(c, chute, { resultado = 'gol', guardar = false, tInicio = 0, relogio = 3.2 } = {}) {
  const { personagem, animacao } = c;
  const J = personagem.juntas;
  const g = personagem.grupo;
  const m = {
    escorrega: 0, escorregaEm: '', arrasta: 0, arrastaEm: '', abaixo: 0, abaixoEm: 0, flutua: 0, flutuaEm: 0, juntaMax: 0, juntaQual: '', juntaEm: 0, joelhoChute: 0,
    corpoMax: 0, desce: 0, joelhoAoContrario: 0, cotoveloAoContrario: 0, quadros: [], contatoErro: null,
  };
  const inicio0 = { ...animacao.inicio };
  // Espera (como no jogo: parado(t) a cada quadro) e o chute
  if (tInicio >= 0) for (let t = relogio - 0.3; t <= relogio; t += DT) animacao.parado(t);
  animacao.preparar({ forca: chute.forca, contato: chute.contato, alvo: chute.alvo, tecnica: chute.tecnica });
  assert.deepEqual({ ...animacao.inicio }, inicio0, 'inicio não pode mudar com preparar()');
  const tc = animacao.tempoContato;
  const fim = animacao.duracao;
  m.tempoContato = tc;
  m.duracao = fim;
  m.batida = animacao.batida;
  const peChute = `tornozelo${c.pe}`;
  const joelhoChute = `joelho${c.pe}`;
  const tResultado = tc + 1.3;
  const anterior = new Map();
  const ancoras = new Map(); // ponto da sola → onde encostou no gramado
  let posAnterior = null;
  let contatoVisto = false;
  let etapaAnterior = '';
  let progressoAnterior = -1;
  const total = Math.round((fim + 2.6 - tInicio) / DT);
  for (let n = 0; n <= total; n++) {
    const t = tInicio + n * DT;
    const fimDoLance = t >= tResultado;
    const r = animacao.atualizar(t, { bola: bolaEm(c, chute, t, tc), resultado: fimDoLance ? resultado : null, tFim: fimDoLance ? t - tResultado : 0 });
    g.updateMatrixWorld(true);
    const med = animacao.medir();
    if (t < 0) continue;
    // contato: liga no primeiro quadro em que t ≥ tempoContato
    if (r.contato !== (t >= tc)) assert.fail(`contato=${r.contato} em t=${t.toFixed(3)} (tempoContato ${tc.toFixed(3)})`);
    if (r.contato) contatoVisto = true;
    // etapas em ordem e progresso que não volta
    const ordem = ['parado', 'corrida', 'chute', 'fim'];
    assert.ok(ordem.indexOf(r.etapa) >= ordem.indexOf(etapaAnterior), `etapa voltou de ${etapaAnterior} para ${r.etapa}`);
    assert.ok(r.progresso >= progressoAnterior - 1e-9, 'progresso voltou');
    etapaAnterior = r.etapa;
    progressoAnterior = r.progresso;
    if (med.desce > m.desce) {
      m.desce = med.desce;
      m.desceEm = t;
    }
    // Pés: abaixo do chão, flutuando, escorregando
    for (const lado of ['E', 'D']) {
      const tz = J[`tornozelo${lado}`];
      let menor = Infinity;
      // Escorregão: ponto da sola encostado no gramado (a menos de 1,2 cm) com o pé pisando não sai do lugar.
      // Arrasto: o mesmo com o pé no ar (saindo ou chegando), fora do instante do chute (o pé do chute passa
      // rente à grama de propósito)
      const pisando = med.pes[lado];
      const noChute = `tornozelo${lado}` === peChute && Math.abs(t - tc) < 0.12;
      PONTOS_SOLA.forEach((p, k) => {
        const w = tz.localToWorld(p.clone());
        menor = Math.min(menor, w.y);
        const chave = lado + k;
        if (w.y < 0.012 && !noChute) {
          const a = ancoras.get(chave);
          if (!a) ancoras.set(chave, w);
          else {
            const d = Math.hypot(w.x - a.x, w.z - a.z);
            if (pisando && d > m.escorrega) {
              m.escorrega = d;
              m.escorregaEm = `${lado} t=${t.toFixed(3)}`;
            }
            if (!pisando && d > m.arrasta) {
              m.arrasta = d;
              m.arrastaEm = `${lado} t=${t.toFixed(3)}`;
            }
            if (!pisando) a.copy(w); // no ar, conta o quanto andou de um quadro para o outro
          }
        } else {
          ancoras.delete(chave);
        }
      });
      if (-menor > m.abaixo) {
        m.abaixo = -menor;
        m.abaixoEm = t;
      }
      if (med.pes[lado] && med.pulo === 0 && menor > m.flutua) {
        m.flutua = menor;
        m.flutuaEm = t;
      }
    }
    // Juntas: velocidade entre dois quadros, e joelhos e cotovelos no sentido certo
    for (const nome of JUNTAS) {
      const q = J[nome].quaternion;
      const a = anterior.get(nome);
      if (a) {
        const w = (2 * Math.acos(Math.min(1, Math.abs(a.dot(q))))) / DT;
        if (nome === joelhoChute) m.joelhoChute = Math.max(m.joelhoChute, w);
        else if (w > m.juntaMax) {
          m.juntaMax = w;
          m.juntaQual = nome;
          m.juntaEm = t;
        }
        a.copy(q);
      } else {
        anterior.set(nome, q.clone());
      }
    }
    for (const lado of ['E', 'D']) {
      m.joelhoAoContrario = Math.max(m.joelhoAoContrario, -J[`joelho${lado}`].rotation.x);
      m.cotoveloAoContrario = Math.max(m.cotoveloAoContrario, J[`cotovelo${lado}`].rotation.x);
    }
    if (posAnterior) m.corpoMax = Math.max(m.corpoMax, g.position.distanceTo(posAnterior) / DT);
    posAnterior = (posAnterior || new THREE.Vector3()).copy(g.position);
    if (guardar) m.quadros.push({ t, pos: JUNTAS.map((nome) => J[nome].getWorldPosition(new THREE.Vector3())), pes: ['E', 'D'].map((l) => mundo(c, `tornozelo${l}`, PONTOS_SOLA[7])) });
  }
  assert.ok(contatoVisto, 'o contato nunca aconteceu');
  assert.equal(etapaAnterior, 'fim');

  // O instante exato do contato: o ponto do pé que bate × o ponto escolhido na bola
  animacao.atualizar(tc, { bola: bolaEm(c, chute, tc, tc), resultado: null, tFim: 0 });
  g.updateMatrixWorld(true);
  const esperado = pontoNaBola(c.bola, chute.alvo, chute.contato);
  const dito = animacao.pontoDaBola;
  assert.ok(Math.hypot(dito.x - esperado.x, dito.y - esperado.y, dito.z - esperado.z) < 1e-6, 'pontoDaBola diferente do ponto escolhido');
  assert.equal(animacao.pontoDoPe.junta, peChute);
  const pe = mundo(c, peChute, new THREE.Vector3(...animacao.pontoDoPe.ponto));
  m.contatoErro = pe.distanceTo(esperado);
  // Nenhuma parte do pé dentro da bola (folga de 1,5 cm) nem dentro do chão
  const centro = new THREE.Vector3(c.bola.x, RAIO, c.bola.z);
  m.dentroDaBola = 0;
  for (const p of PONTOS_SOLA) {
    const w = mundo(c, peChute, p);
    m.dentroDaBola = Math.max(m.dentroDaBola, RAIO - w.distanceTo(centro));
  }
  // Pé de apoio ao lado da bola: distância do tornozelo ao centro da bola, para o lado e para trás
  const apoio = mundo(c, `tornozelo${c.pe === 'D' ? 'E' : 'D'}`, new THREE.Vector3());
  const d = Math.hypot(chute.alvo.x - c.bola.x, chute.alvo.z - c.bola.z);
  const f = { x: (chute.alvo.x - c.bola.x) / d, z: (chute.alvo.z - c.bola.z) / d };
  const rel = { x: apoio.x - c.bola.x, z: apoio.z - c.bola.z };
  m.apoioLado = Math.abs(-rel.x * f.z + rel.z * f.x);
  m.apoioAtras = -(rel.x * f.x + rel.z * f.z);
  m.apoioAltura = apoio.y;
  m.joelhoNoContato = personagem.juntas[joelhoChute].rotation.x;
  return m;
}

// ---------- Cobranças de teste ----------

const CHUTES = [
  { nome: 'curva', forca: 0.8, contato: { x: 0.4, y: 0.1 }, mira: 1.5 },
  { nome: 'centro forte', forca: 0.95, contato: { x: 0, y: 0 }, mira: -1.0 },
  { nome: 'colocado', forca: 0.55, contato: { x: 0.1, y: -0.1 }, mira: 2.5 },
  { nome: 'por baixo', forca: 0.7, contato: { x: 0.2, y: -0.45 }, mira: -3.0 },
  { nome: 'cavadinha', forca: 0.35, contato: { x: 0, y: -0.7 }, mira: 0.5 },
  { nome: 'folha seca', forca: 0.75, contato: { x: 0.05, y: 0.45 }, mira: 0 },
  { nome: 'rasteiro', forca: 0.7, contato: { x: 0, y: 0.85 }, mira: 3.0 },
  { nome: 'trivela', forca: 0.8, contato: { x: -0.5, y: 0 }, mira: -2.0 },
  { nome: 'canto da bola', forca: 1, contato: { x: 0.67, y: -0.67 }, mira: 6.5 },
  { nome: 'toque fraco', forca: 0.1, contato: { x: -0.3, y: 0.3 }, mira: -6.5 },
];
const FALTAS = [{ distancia: 22, angulo: 0 }, { distancia: 18, angulo: 28 }, { distancia: 30, angulo: -22 }, { distancia: 11, angulo: 0 }];
const NUMEROS = SO_LENDA ? [SO_LENDA] : [8, 3, 23, 80, 9, 21, 7, 30, 1, 19, 2, 10];

// O chute como o jogo manda: contato e mira do jogador (para o canhoto o "lado de dentro" é o outro)
function chuteDe(jogador, base, bola) {
  const sinal = jogador.pe === 'E' ? -1 : 1;
  const contato = { x: sinal * base.contato.x, y: base.contato.y };
  return {
    forca: base.forca, contato, alvo: { x: base.mira, z: 0 },
    tecnica: preverTecnica({ forca: base.forca, contato, cobrador: jogador }, CONFIG),
  };
}

let falhas = 0;
const conferir = (ok, texto) => {
  if (!ok) {
    falhas++;
    console.log(`  FALHOU: ${texto}`);
  }
  return ok;
};
const cm = (v) => `${(v * 100).toFixed(1)} cm`;

console.log('Animação da cobrança: corrida, chute e terminação');
const pior = { escorrega: 0, abaixo: 0, flutua: 0, contato: 0, junta: 0, joelhoChute: 0, corpo: 0, desce: 0, dentroDaBola: -1 };
const tempos = [];
const batidas = new Map();
let cobrancas = 0;
let custoQuadro = 0;
let quadrosMedidos = 0;
let custoPreparar = 0;
for (const numero of NUMEROS) {
  const jogador = ELENCO.find((j) => j.numero === numero);
  if (!jogador) continue;
  const c0 = jogador.cobranca;
  let piorDaLenda = { escorrega: 0, abaixo: 0, flutua: 0, contato: 0, junta: 0, joelhoChute: 0 };
  let tempoContato = 0;
  CHUTES.forEach((base, k) => {
    const falta = FALTAS[(k + numero) % FALTAS.length];
    const c = montar(jogador, falta);
    const chute = chuteDe(jogador, base, c.bola);
    const t0 = performance.now();
    c.animacao.preparar(chute);
    custoPreparar = Math.max(custoPreparar, performance.now() - t0);
    const t1 = performance.now();
    const m = rodar(c, chute, { resultado: ['gol', 'fora', 'trave', 'barreira', 'defesa'][k % 5] });
    custoQuadro += performance.now() - t1;
    quadrosMedidos += Math.round((m.duracao + 2.6) / DT);
    cobrancas++;
    tempoContato = m.tempoContato;
    batidas.set(m.batida, (batidas.get(m.batida) || 0) + 1);
    const rotulo = `${jogador.apelido} (${jogador.pe}, ${c0.passos} passos) · ${base.nome} → ${chute.tecnica}/${m.batida}`;
    if (DETALHE) {
      console.log(`  ${rotulo}: contato ${m.tempoContato.toFixed(2)} s, fim ${m.duracao.toFixed(2)} s · escorrega ${cm(m.escorrega)} (${m.escorregaEm}) · arrasta ${cm(m.arrasta)} (${m.arrastaEm}) · abaixo ${cm(m.abaixo)} · flutua ${cm(m.flutua)} · pé–bola ${cm(m.contatoErro)} · junta ${m.juntaMax.toFixed(1)} rad/s (${m.juntaQual} t=${m.juntaEm.toFixed(2)}) · joelho do chute ${m.joelhoChute.toFixed(1)} rad/s, ${(m.joelhoNoContato / GRAUS).toFixed(0)}° no contato · apoio ${cm(m.apoioLado)} ao lado, ${cm(m.apoioAtras)} atrás · corpo ${m.corpoMax.toFixed(1)} m/s`);
    }
    conferir(m.escorrega < LIM.escorrega, `${rotulo}: pé escorrega ${cm(m.escorrega)} (${m.escorregaEm})`);
    conferir(m.arrasta < LIM.arrasta, `${rotulo}: pé no ar arrasta na grama ${cm(m.arrasta)} num quadro (${m.arrastaEm})`);
    conferir(m.abaixo < LIM.abaixo, `${rotulo}: pé ${cm(m.abaixo)} abaixo do chão em t=${m.abaixoEm.toFixed(3)}`);
    conferir(m.flutua < LIM.flutua, `${rotulo}: pé de apoio flutua ${cm(m.flutua)} em t=${m.flutuaEm.toFixed(3)}`);
    conferir(m.contatoErro < LIM.contato, `${rotulo}: pé a ${cm(m.contatoErro)} do ponto de contato`);
    conferir(m.juntaMax < LIM.junta, `${rotulo}: ${m.juntaQual} a ${m.juntaMax.toFixed(1)} rad/s em t=${m.juntaEm.toFixed(3)}`);
    conferir(m.joelhoChute < LIM.joelhoChute, `${rotulo}: joelho do chute a ${m.joelhoChute.toFixed(1)} rad/s`);
    conferir(m.corpoMax < LIM.corpo, `${rotulo}: corpo a ${m.corpoMax.toFixed(1)} m/s`);
    conferir(m.joelhoAoContrario < 1e-6 && m.cotoveloAoContrario < 1e-6, `${rotulo}: joelho ou cotovelo dobrou ao contrário`);
    conferir(m.tempoContato >= LIM.tempoMin && m.tempoContato <= LIM.tempoMax, `${rotulo}: contato em ${m.tempoContato.toFixed(2)} s`);
    conferir(m.apoioLado > 0.15 && m.apoioLado < 0.32, `${rotulo}: pé de apoio a ${cm(m.apoioLado)} do centro da bola, para o lado`);
    conferir(m.apoioAltura < 0.085 * (jogador.visual.altura / 1.8) + 0.01, `${rotulo}: pé de apoio fora do chão no contato`);
    conferir(m.dentroDaBola < 0.05, `${rotulo}: sola do pé do chute ${cm(m.dentroDaBola)} dentro da bola no contato`);
    conferir(m.desce < 0.03, `${rotulo}: o quadril teve de descer ${cm(m.desce)} para a perna alcançar (t=${(m.desceEm || 0).toFixed(3)})`);
    for (const chave of Object.keys(piorDaLenda)) {
      const v = chave === 'contato' ? m.contatoErro : chave === 'junta' ? m.juntaMax : m[chave];
      piorDaLenda[chave] = Math.max(piorDaLenda[chave], v);
    }
    pior.corpo = Math.max(pior.corpo, m.corpoMax);
    pior.desce = Math.max(pior.desce, m.desce);
    pior.dentroDaBola = Math.max(pior.dentroDaBola, m.dentroDaBola);
    personagemFora(c);
  });
  for (const chave of Object.keys(piorDaLenda)) pior[chave] = Math.max(pior[chave], piorDaLenda[chave]);
  tempos.push([jogador.apelido, tempoContato]);
  console.log(`  ${jogador.apelido.padEnd(13)} ${jogador.pe} ${String(c0.passos).padStart(2)} passos ${c0.distancia.toFixed(1)} m: contato em ${tempoContato.toFixed(2)} s · escorrega ${cm(piorDaLenda.escorrega)} · abaixo ${cm(piorDaLenda.abaixo)} · flutua ${cm(piorDaLenda.flutua)} · pé–bola ${cm(piorDaLenda.contato)} · junta ${piorDaLenda.junta.toFixed(1)} rad/s · joelho do chute ${piorDaLenda.joelhoChute.toFixed(1)} rad/s`);
}
function personagemFora(c) {
  c.personagem.dispose();
}

console.log(`\n${cobrancas} cobranças · batidas: ${[...batidas].map(([b, n]) => `${b} ${n}`).join(', ')}`);
console.log(`Pior caso: escorrega ${cm(pior.escorrega)} (< 2) · abaixo do chão ${cm(pior.abaixo)} (< 1) · flutua ${cm(pior.flutua)} (< 1) · pé–bola ${cm(pior.contato)} (< 3) · junta ${pior.junta.toFixed(1)} rad/s (< 25) · joelho do chute ${pior.joelhoChute.toFixed(1)} rad/s (< 45) · corpo ${pior.corpo.toFixed(1)} m/s · quadril desceu ${cm(pior.desce)}`);
console.log(`Tempo até o contato: ${tempos.map(([n, t]) => `${n} ${t.toFixed(2)}`).join(' · ')}`);
console.log(`Custo: ${((custoQuadro / quadrosMedidos) * 1000).toFixed(0)} µs por quadro (com as medições do teste) · preparar() no máximo ${custoPreparar.toFixed(2)} ms`);

// ---------- Todas as lendas: o plano fecha e o tempo fica na faixa ----------
{
  let menor = Infinity;
  let maior = 0;
  for (const jogador of ELENCO) {
    const c = montar(jogador, FALTAS[0]);
    const chute = chuteDe(jogador, CHUTES[0], c.bola);
    const m = rodar(c, chute);
    menor = Math.min(menor, m.tempoContato);
    maior = Math.max(maior, m.tempoContato);
    const rotulo = `${jogador.apelido}`;
    conferir(m.tempoContato >= LIM.tempoMin && m.tempoContato <= LIM.tempoMax, `${rotulo}: contato em ${m.tempoContato.toFixed(2)} s`);
    conferir(m.escorrega < LIM.escorrega && m.abaixo < LIM.abaixo && m.contatoErro < LIM.contato && m.juntaMax < LIM.junta,
      `${rotulo}: escorrega ${cm(m.escorrega)}, abaixo ${cm(m.abaixo)}, pé–bola ${cm(m.contatoErro)}, junta ${m.juntaMax.toFixed(1)} rad/s (${m.juntaQual})`);
    const pisadas = c.animacao.pisadas();
    conferir(pisadas.length === jogador.cobranca.passos + 4, `${rotulo}: ${pisadas.length - 4} pisadas na corrida (a lenda dá ${jogador.cobranca.passos} passos)`);
    c.personagem.dispose();
  }
  console.log(`\nAs ${ELENCO.length} lendas: contato de ${menor.toFixed(2)} s a ${maior.toFixed(2)} s, cada uma com o seu número de passos`);
}

// ---------- Canhoto = espelho exato do destro ----------
{
  let maior = 0;
  for (const numero of [8, 23, 80]) {
    const jogador = ELENCO.find((j) => j.numero === numero);
    for (const k of [0, 3, 7]) {
      const falta = FALTAS[1];
      const d = montar(jogador, falta, { pe: 'D' });
      const e = montar(jogador, falta, { pe: 'E', espelho: -1 });
      const base = CHUTES[k];
      const chuteD = { forca: base.forca, contato: { ...base.contato }, alvo: { x: base.mira, z: 0 }, tecnica: preverTecnica({ forca: base.forca, contato: base.contato, cobrador: { ...jogador, pe: 'D' } }, CONFIG) };
      const chuteE = { ...chuteD, contato: { x: -base.contato.x, y: base.contato.y }, alvo: { x: -base.mira, z: 0 } };
      const md = rodar(d, chuteD, { guardar: true });
      const me = rodar(e, chuteE, { guardar: true });
      assert.equal(md.quadros.length, me.quadros.length);
      const troca = (nome) => (nome.endsWith('E') ? `${nome.slice(0, -1)}D` : nome.endsWith('D') ? `${nome.slice(0, -1)}E` : nome);
      md.quadros.forEach((qd, n) => {
        const qe = me.quadros[n];
        JUNTAS.forEach((nome, i) => {
          const a = qd.pos[i];
          const b = qe.pos[JUNTAS.indexOf(troca(nome))];
          maior = Math.max(maior, Math.hypot(a.x + b.x, a.y - b.y, a.z - b.z));
        });
      });
      conferir(Math.abs(md.tempoContato - me.tempoContato) < 1e-9, `${jogador.apelido}: tempo de contato diferente no espelho`);
      d.personagem.dispose();
      e.personagem.dispose();
    }
  }
  conferir(maior < 1e-6, `canhoto não é o espelho do destro: diferença de ${(maior * 1000).toFixed(3)} mm`);
  console.log(`Canhoto × destro espelhado: maior diferença entre as juntas ${(maior * 1000).toFixed(4)} mm`);
}

// ---------- Replay: os mesmos valores dão a mesma animação ----------
{
  let igual = 0;
  let comeco = 0;
  for (const numero of [8, 3]) {
    const jogador = ELENCO.find((j) => j.numero === numero);
    const falta = FALTAS[2];
    const a = montar(jogador, falta);
    const chute = chuteDe(jogador, CHUTES[1], a.bola);
    const ma = rodar(a, chute, { guardar: true, relogio: 7.3 });
    // O replay cria outro boneco, prepara com os mesmos valores e começa em t negativo (parado)
    const b = montar(jogador, falta);
    const mb = rodar(b, chute, { guardar: true, tInicio: -0.8 });
    // E a mesma sequência de chamadas, repetida, dá exatamente o mesmo
    const c = montar(jogador, falta);
    const mc = rodar(c, chute, { guardar: true, relogio: 7.3 });
    conferir(Math.abs(ma.tempoContato - mb.tempoContato) < 1e-12, `${jogador.apelido}: tempoContato do replay diferente`);
    ma.quadros.forEach((qa, n) => {
      const qb = mb.quadros.find((q) => Math.abs(q.t - qa.t) < 1e-6);
      const qc = mc.quadros[n];
      qa.pos.forEach((p, i) => {
        if (i === 2) return; // a cabeça acompanha a bola com atraso (depende de por onde ela vinha)
        const d = qb ? p.distanceTo(qb.pos[i]) : 0;
        if (qa.t < 0.3) comeco = Math.max(comeco, d);
        else igual = Math.max(igual, d);
        assert.ok(p.distanceTo(qc.pos[i]) < 1e-12, 'a mesma sequência de chamadas deu outra animação');
      });
    });
    for (const x of [a, b, c]) x.personagem.dispose();
  }
  conferir(igual < 1e-6, `replay diferente depois de 0,3 s: ${(igual * 1000).toFixed(3)} mm`);
  conferir(comeco < 0.06, `replay muito diferente no começo: ${cm(comeco)}`);
  console.log(`Replay: juntas iguais a partir de 0,3 s (diferença ${(igual * 1000).toFixed(4)} mm); nos primeiros 0,3 s a espera ainda sai aos poucos (até ${cm(comeco)})`);
}

// ---------- Sem preparar() e as poses avulsas (página de inspeção) ----------
{
  const jogador = ELENCO.find((j) => j.numero === 23);
  const personagem = criarPersonagem({ visual: jogador.visual, numero: 23, nome: 'teste' });
  const animacao = criarCobranca(personagem, { bola: { x: 3, z: 22 }, alvo: { x: -2.5, z: 0 }, pe: jogador.pe });
  assert.ok(animacao.reage === true);
  assert.ok(animacao.tempoContato > 0.5 && animacao.duracao > animacao.tempoContato);
  assert.ok(Number.isFinite(animacao.inicio.x) && Number.isFinite(animacao.inicio.z) && Number.isFinite(animacao.inicio.rotacaoY));
  assert.ok(Math.abs(animacao.direcao.length() - 1) < 1e-9);
  for (const t of [-0.5, 0, 0.3, animacao.tempoContato, animacao.duracao, animacao.duracao + 1]) {
    const r = animacao.atualizar(t);
    assert.ok(['parado', 'corrida', 'chute', 'fim'].includes(r.etapa));
    personagem.grupo.updateMatrixWorld(true);
    for (const nome of JUNTAS) assert.ok(Number.isFinite(personagem.juntas[nome].getWorldPosition(new THREE.Vector3()).lengthSq()), `junta ${nome} sem número em t=${t}`);
  }
  for (const pose of [poseChute(0), poseChute(TEMPO_CONTATO, 'E', 'aberto'), poseChute(1), poseCorrida(0.3), poseCobradorPronto(1, 'E', 'lateral'), poseComemoracao(0.5), poseLamento(1)]) {
    personagem.aplicarPose(pose);
    assert.ok(Number.isFinite(personagem.juntas.quadril.position.y));
  }
  const b = bolaNoContato(personagem, 'D');
  assert.ok(Number.isFinite(b.x) && Math.abs(b.y - 0.11) < 1e-9);
  personagem.dispose();
  console.log('Sem preparar() e poses avulsas: ok');
}

if (falhas) {
  console.log(`\n${falhas} checagens falharam`);
  process.exit(1);
}
console.log('\nTudo certo.');
