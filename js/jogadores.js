// Bonecos 3D dos jogadores: feitos por código (sem arquivos de modelo), leves para o celular.
// Cada lenda é reconhecida pelo cabelo, barba, tom de pele, altura, porte, cor da chuteira e número.
// O corpo tem juntas (tronco, cabeça, ombros, cotovelos, quadris, joelhos e tornozelos) movidas por poses.
// Cada parte é uma peça lisa (normais suaves) com sombreado leve pintado nos vértices (dobras, axilas,
// virilha), e o rosto é uma textura pintada (olhos, sobrancelhas, boca, barba rala, raiz do cabelo).
//
// Eixos do boneco: pés em y = 0, de frente para +z local. A direita do jogador fica em −x local.
// Medidas em metros; ângulos em radianos.
//
// Formato da pose (todo campo é opcional; o que faltar vale 0, menos apoio, que vale 1):
//   tronco: { frente, lado, giro }  frente > 0 inclina para a frente; lado > 0 inclina para a direita
//                                   do jogador; giro > 0 vira o peito para a esquerda do jogador
//   cabeca: { frente, giro, lado }  frente > 0 olha para baixo; giro > 0 vira para a esquerda do jogador;
//                                   lado > 0 deita a cabeça para a direita do jogador
//   bracoE / bracoD: { frente, lado, cotovelo, giro }
//                                   frente > 0 levanta o braço para a frente; lado > 0 abre para fora
//                                   (π = braço esticado para cima); cotovelo > 0 dobra (a mão vem para a frente);
//                                   giro > 0 gira o braço em torno do próprio eixo, para fora (com o cotovelo
//                                   dobrado, a mão vai para fora)
//   pernaE / pernaD: { frente, lado, joelho, tornozelo, giro, pe }
//                                   frente > 0 leva a perna para a frente; lado > 0 abre para fora;
//                                   joelho > 0 dobra (o pé vai para trás); tornozelo > 0 aponta o bico
//                                   para baixo (com 0, a sola fica paralela ao chão);
//                                   giro > 0 gira a perna inteira em torno do eixo da coxa, para fora (joelho e
//                                   bico apontam para fora: é a rotação do quadril de quem bate de chapa);
//                                   pe > 0 gira só o pé no tornozelo, bico para fora
//   agachar: 0 a 1                  dobra as duas pernas e abaixa o corpo (1 = agachado fundo)
//   Extras:
//   quadril: { frente, lado, giro } gira a bacia inteira (o corpo todo acompanha)
//   apoio: 0 a 1 (padrão 1)         1 = o pé mais baixo encosta no chão (y = 0 do grupo);
//                                   0 = quadril na altura de quem está de pé (para pulos e mergulhos)
//   pulo: m (padrão 0)              sobe o corpo inteiro (os pés saem do chão)
//   maoE / maoD: { x, y, z, peso }  leva a mão até o ponto (no espaço do tronco: origem na cintura,
//                                   y para cima, z para a frente; boneco de 1,80 m); peso 0 a 1

import * as THREE from 'three';

const GRAUS = Math.PI / 180;
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const suave = (t) => {
  const u = limitar(t, 0, 1);
  return u * u * (3 - 2 * u);
};
const misturar = (a, b, k) => a + (b - a) * k;
// Potência que mantém o sinal (para os anéis "quadrados" e a sola reta)
const pot = (c, e) => Math.sign(c) * Math.abs(c) ** e;
// Número pseudoaleatório fixo para cada entrada (0 a 1): variação de tom sem mudar a cada boneco
const sorteioFixo = (a, b = 0) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---------- Uniformes ----------
// Formato do js/elenco.js: camisa, calcao, meiao, numero (cor do número e do nome), gola (gola, punhos e
// detalhes), padrao e cores (cores do padrão sobre a camisa):
//   'liso' | 'listras' (verticais, cores[0]) | 'aros' (horizontais) | 'faixa' (faixa no peito, até 3 cores) |
//   'diagonal' (faixa do ombro direito ao quadril esquerdo) | 'v' (V no peito e nas costas) |
//   'faixaVertical' (faixa de cima a baixo no meio do peito, cores[0], com filetes cores[1])
// Formato antigo (UNIFORMES, ainda aceito): listras (cor das listras verticais ou null) no lugar de padrao.
// Extras: faixaMeiao (listra do meião), luvas (goleiros).

export const UNIFORMES = {
  // Rubro-negro listrado: camisa vermelha com listras pretas, calção e meião pretos
  lendas: {
    camisa: '#c4142b', listras: '#151515', calcao: '#151515', meiao: '#151515',
    numero: '#ffffff', gola: '#151515', faixaMeiao: '#c4142b',
  },
  // Todo branco com calção azul-marinho
  adversario: {
    camisa: '#f3f3ef', listras: null, calcao: '#1d2a4d', meiao: '#f3f3ef',
    numero: '#1d2a4d', gola: '#1d2a4d', faixaMeiao: '#1d2a4d',
  },
  // Goleiro adversário: verde-limão neon
  goleiroAdversario: {
    camisa: '#c3f02a', listras: null, calcao: '#1b1b1b', meiao: '#c3f02a',
    numero: '#1b1b1b', gola: '#1b1b1b', faixaMeiao: '#1b1b1b', luvas: '#f4f4f4',
  },
  // Goleiro das lendas (Mito e Chila quando batem a falta): grafite com detalhes laranja
  goleiroLendas: {
    camisa: '#5c636d', listras: null, calcao: '#2f343b', meiao: '#5c636d',
    numero: '#ff8a2a', gola: '#ff8a2a', faixaMeiao: '#ff8a2a', luvas: '#ff7a1a',
  },
};

// ---------- Cores ----------

function rgb(cor) {
  const c = new THREE.Color(cor);
  return [c.r, c.g, c.b]; // linear (o THREE converte do hexadecimal sRGB)
}
// Componentes sRGB de 0 a 255 (para pintar no canvas)
function rgb255(cor) {
  const h = new THREE.Color(cor).getHex();
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
}
function corMisturada(a, b, k) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
}
function luminancia(cor) {
  const [r, g, b] = rgb(cor);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Contraste entre duas cores (1 = nenhum; 21 = preto no branco)
function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function claro(cor) {
  return luminancia(cor) > 0.18;
}
function distanciaCor(a, b) {
  const x = rgb255(a);
  const y = rgb255(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Uniforme no formato único usado aqui (aceita o do elenco e o antigo)
function normalizarUniforme(u = {}) {
  const camisa = u.camisa || '#dddddd';
  let cores = Array.isArray(u.cores) ? u.cores.filter(Boolean) : [];
  let padrao = u.padrao || (u.listras ? 'listras' : 'liso');
  if (padrao === 'listras' && u.listras) cores = [u.listras, ...cores.slice(1)];
  if (padrao !== 'liso' && !cores.length) padrao = 'liso';
  if (!['liso', 'listras', 'aros', 'faixa', 'diagonal', 'v', 'faixaVertical'].includes(padrao)) padrao = 'liso';
  const calcao = u.calcao || camisa;
  const meiao = u.meiao || calcao;
  const numero = u.numero || (claro(camisa) ? '#111111' : '#ffffff');
  const gola = u.gola || numero;
  // Listra do meião: a primeira cor do uniforme que aparece sobre o meião
  const faixaMeiao = u.faixaMeiao
    || [gola, camisa, ...cores, numero].find((c) => distanciaCor(c, meiao) > 70)
    || (claro(meiao) ? '#222222' : '#eeeeee');
  return { camisa, calcao, meiao, numero, gola, padrao, cores: cores.slice(0, 3), faixaMeiao, luvas: u.luvas || null };
}

// ---------- Medidas do boneco de referência (1,80 m; o resto é escala) ----------

const ALTURA_REF = 1.795;   // m do chão ao alto da cabeça (sem o cabelo)
const QUADRIL_Y = 0.95;     // m: pivô da bacia, de pé
const QUADRIL_X = 0.095;    // m do meio até a junta de cada quadril
const QUADRIL_JUNTA_Y = -0.02;
const COXA = 0.44;          // m do quadril ao joelho
const CANELA = 0.42;        // m do joelho ao tornozelo
const CINTURA = 0.07;       // m: pivô do tronco acima da bacia
const OMBRO_X = 0.175;
const OMBRO_Y = 0.40;       // m acima da cintura
const BRACO = 0.29;         // m do ombro ao cotovelo
const ANTEBRACO = 0.25;     // m do cotovelo ao punho
const MAO_CENTRO = 0.065;   // m do punho ao meio da palma
const PESCOCO = 0.47;       // m: pivô da cabeça (base do pescoço) acima da cintura
const CRANIO = { y: 0.19, z: 0.008, rx: 0.081, ry: 0.112, rz: 0.097 }; // centro e raios, a partir do pescoço
const QUEDA_AGACHAR = 0.26; // m que o quadril desce com agachar = 1
// Pontos da sola (no espaço do tornozelo): calcanhar, meio e bico. O mais baixo encosta no chão.
export const SOLA = [[0, -0.07, -0.055], [0, -0.07, 0.1], [0, -0.062, 0.19]];
export const PEITO_DO_PE = [0, -0.005, 0.085]; // onde o pé pega na bola (em cima do pé, no espaço do tornozelo)

// ---------- Esqueleto ----------
// As juntas são ossos (THREE.Bone) e o corpo é malha com pele: cada vértice segue até 4 ossos. Além das 15
// juntas que as poses mexem, há 8 ossos ajudantes ("meio"): cada um fica numa junta que dobra muito (ombro,
// cotovelo, quadril e joelho) e gira só metade do que ela gira. Os vértices da dobra seguem o ajudante, e
// assim o joelho e o cotovelo dobrados continuam redondos em vez de afinar.
const OSSOS = [
  'quadril', 'tronco', 'cabeca',
  'ombroE', 'cotoveloE', 'punhoE', 'ombroD', 'cotoveloD', 'punhoD',
  'pernaE', 'joelhoE', 'tornozeloE', 'pernaD', 'joelhoD', 'tornozeloD',
  'meioOmbroE', 'meioCotoveloE', 'meioOmbroD', 'meioCotoveloD',
  'meioPernaE', 'meioJoelhoE', 'meioPernaD', 'meioJoelhoD',
];
const O = Object.fromEntries(OSSOS.map((nome, i) => [nome, i]));
const trocarLado = (nome) => (/[ED]$/.test(nome) ? nome.slice(0, -1) + (nome.endsWith('E') ? 'D' : 'E') : nome);
const OSSO_ESPELHADO = OSSOS.map((nome) => O[trocarLado(nome)]);
// Ajudante → a junta que ele acompanha pela metade
const AJUDANTES = {
  meioOmbroE: 'ombroE', meioCotoveloE: 'cotoveloE', meioOmbroD: 'ombroD', meioCotoveloD: 'cotoveloD',
  meioPernaE: 'pernaE', meioJoelhoE: 'joelhoE', meioPernaD: 'pernaD', meioJoelhoD: 'joelhoD',
};

// Onde cada osso fica com o boneco de pé e os braços para baixo (a pose em que a malha é modelada), no espaço
// do corpo: pés em y = 0, de frente para +z, a esquerda do jogador em +x
function repousoDosOssos(ombroX) {
  const tronco = QUADRIL_Y + CINTURA;
  const r = {
    quadril: [0, QUADRIL_Y, 0], tronco: [0, tronco, 0], cabeca: [0, tronco + PESCOCO, 0],
  };
  for (const [lado, s] of [['E', 1], ['D', -1]]) {
    r[`ombro${lado}`] = [s * ombroX, tronco + OMBRO_Y, 0];
    r[`cotovelo${lado}`] = [s * ombroX, tronco + OMBRO_Y - BRACO, 0];
    r[`punho${lado}`] = [s * ombroX, tronco + OMBRO_Y - BRACO - ANTEBRACO, 0];
    r[`perna${lado}`] = [s * QUADRIL_X, QUADRIL_Y + QUADRIL_JUNTA_Y, 0];
    r[`joelho${lado}`] = [s * QUADRIL_X, QUADRIL_Y + QUADRIL_JUNTA_Y - COXA, 0];
    r[`tornozelo${lado}`] = [s * QUADRIL_X, QUADRIL_Y + QUADRIL_JUNTA_Y - COXA - CANELA, 0];
  }
  for (const [ajudante, junta] of Object.entries(AJUDANTES)) r[ajudante] = r[junta];
  return r;
}

// Esqueleto que, antes de cada quadro, põe os ossos ajudantes no lugar (metade do giro da junta deles)
const _qMeio = new THREE.Quaternion();
const _qZero = new THREE.Quaternion();
const _mMeio = new THREE.Matrix4();
const _escalaUm = new THREE.Vector3(1, 1, 1);
class EsqueletoBoneco extends THREE.Skeleton {
  constructor(ossos, inversas, ajudantes) {
    super(ossos, inversas);
    this.ajudantes = ajudantes; // [{ osso, junta }]
  }

  atualizarAjudantes() {
    for (const a of this.ajudantes) {
      const { junta } = a;
      _qMeio.copy(_qZero).slerp(junta.quaternion, 0.5);
      _mMeio.compose(junta.position, _qMeio, _escalaUm);
      a.osso.matrixWorld.multiplyMatrices(junta.parent.matrixWorld, _mMeio);
    }
  }

  update() {
    this.atualizarAjudantes();
    super.update();
  }
}

// ---------- Nível de detalhe ----------
// Quantos segmentos cada peça tem. 'alto': o boneco de perto (cobrador, barreira, goleiro); 'baixo': figurantes
// vistos de longe; 'sombra': a silhueta que vira sombra no gramado (só o contorno importa).
const DETALHES = {
  alto: { nome: 'alto', lobo: 6, frente: 8, costas: 8, bacia: 24, ponte: 6, braco: 10, perna: 12, pe: 12, mao: 8, fino: true },
  baixo: { nome: 'baixo', lobo: 4, frente: 6, costas: 6, bacia: 16, ponte: 4, braco: 8, perna: 8, pe: 8, mao: 6, fino: false },
  sombra: { nome: 'sombra', lobo: 2, frente: 2, costas: 2, bacia: 8, ponte: 2, braco: 6, perna: 6, pe: 6, mao: 4, fino: false },
};

// ---------- Cache (geometrias, texturas e materiais compartilhados entre todos os bonecos) ----------

const cacheGeo = new Map();
const cacheTex = new Map();
function geo(chave, criar) {
  let g = cacheGeo.get(chave);
  if (!g) {
    g = criar();
    cacheGeo.set(chave, g);
  }
  return g;
}
const temDocumento = typeof document !== 'undefined';
function textura(chave, criar) {
  if (!temDocumento) return null;
  let t = cacheTex.get(chave);
  if (!t) {
    t = criar();
    cacheTex.set(chave, t);
  }
  return t;
}

function novaTextura(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function novoCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

// Peças intermediárias (cabeça, cabelos): geometrias que só servem para montar a malha final, guardadas na
// memória do programa (não vão para a placa de vídeo)
const cachePecas = new Map();
function peca(chave, criar) {
  let g = cachePecas.get(chave);
  if (!g) {
    g = criar();
    cachePecas.set(chave, g);
  }
  return g;
}

// ---------- Geometria: ajudantes ----------

const matriz = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );

// Sombreado nos vértices: f(x, y, z, i) devolve um número (cinza) ou [r, g, b]; sem f, tudo 1
function comCor(g, f) {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = f ? f(p.getX(i), p.getY(i), p.getZ(i), i) : 1;
    if (typeof v === 'number') c.set([v, v, v], i * 3);
    else c.set(v, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// Todos os vértices com a mesma coordenada de textura (peças lisas que usam a textura do rosto)
function uvFixo(g, u, v) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) a.set([u, v], i * 2);
  g.setAttribute('uv', new THREE.BufferAttribute(a, 2));
  return g;
}

// Normais suaves também nas costuras e nos polos: vértices no mesmo lugar ficam com a mesma normal
function suavizarCostura(g) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const grupos = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`;
    let l = grupos.get(k);
    if (!l) grupos.set(k, (l = []));
    l.push(i);
  }
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  for (const l of grupos.values()) {
    if (l.length < 2) continue;
    v.set(0, 0, 0);
    for (const i of l) v.add(w.fromBufferAttribute(n, i));
    if (v.lengthSq() < 1e-12) continue;
    v.normalize();
    for (const i of l) n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

// Garante que as faces apontem para fora (volume com sinal positivo em volta do centro)
function orientar(g, centro = null) {
  const p = g.attributes.position;
  const idx = g.index;
  const o = new THREE.Vector3();
  if (centro) o.copy(centro);
  else {
    for (let i = 0; i < p.count; i++) o.x += p.getX(i), o.y += p.getY(i), o.z += p.getZ(i);
    o.divideScalar(Math.max(1, p.count));
  }
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let vol = 0;
  const n = idx ? idx.count : p.count;
  for (let k = 0; k < n; k += 3) {
    const [i, j, l] = idx ? [idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)] : [k, k + 1, k + 2];
    a.fromBufferAttribute(p, i).sub(o);
    b.fromBufferAttribute(p, j).sub(o);
    c.fromBufferAttribute(p, l).sub(o);
    vol += a.dot(b.cross(c));
  }
  if (vol < 0 && idx) {
    const arr = idx.array;
    for (let k = 0; k < arr.length; k += 3) {
      const t = arr[k + 1];
      arr[k + 1] = arr[k + 2];
      arr[k + 2] = t;
    }
    idx.needsUpdate = true;
  }
  return g;
}

function finalizar(g, centro = null) {
  orientar(g, centro);
  g.computeVertexNormals();
  suavizarCostura(g);
  if (!g.attributes.color) comCor(g);
  if (!g.attributes.uv) uvFixo(g, 0, 0);
  g.computeBoundingSphere();
  return g;
}

// Junta várias geometrias numa só malha (mesmo material = uma malha só: menos trabalho para o celular).
// partes: [geometria] ou [[geometria, matriz]]. Mantém normais, cores e coordenadas de textura.
function fundir(partes) {
  const prontas = partes.filter(Boolean).map((p) => {
    const [g, m] = Array.isArray(p) ? p : [p, null];
    const n = g.clone();
    if (m) n.applyMatrix4(m);
    if (!n.attributes.normal) n.computeVertexNormals();
    if (!n.attributes.color) comCor(n);
    if (!n.attributes.uv) uvFixo(n, 0, 0);
    g.dispose();
    return n;
  });
  let total = 0;
  let totalIdx = 0;
  for (const n of prontas) {
    total += n.attributes.position.count;
    totalIdx += n.index ? n.index.count : n.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const cor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const idx = new (total > 65535 ? Uint32Array : Uint16Array)(totalIdx);
  let o = 0;
  let oi = 0;
  for (const n of prontas) {
    const c = n.attributes.position.count;
    pos.set(n.attributes.position.array, o * 3);
    nor.set(n.attributes.normal.array, o * 3);
    cor.set(n.attributes.color.array, o * 3);
    uv.set(n.attributes.uv.array, o * 2);
    if (n.index) for (let k = 0; k < n.index.count; k++) idx[oi++] = n.index.getX(k) + o;
    else for (let k = 0; k < c; k++) idx[oi++] = o + k;
    o += c;
    n.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// ---------- Peças em anéis (tronco, calção, braços, pernas, meião) ----------
// Anel: [y, meia largura (x), frente (+z), trás (−z), q, dx, dz]. q = 2 é elipse; mais que 2, mais
// "quadrado" (tronco). A lista vai de baixo para cima ao longo da superfície (pode voltar para dentro
// nas beiradas da barra e da gola). A textura dá a volta: u = 0 no lado direito do jogador (−x),
// 0,25 na frente, 0,5 no lado esquerdo, 0,75 nas costas; v cresce com o comprimento da superfície.

function lerAnel(a) {
  return { y: a[0], l: a[1], f: a[2], t: a[3] ?? a[2], q: a[4] ?? 2, dx: a[5] ?? 0, dz: a[6] ?? 0 };
}
function anelMisturado(a, b, k) {
  const r = {};
  for (const c of ['y', 'l', 'f', 't', 'q', 'dx', 'dz']) r[c] = misturar(a[c], b[c], k);
  return r;
}

// seg + 1 pontos [x, z] espalhados por igual no comprimento de cada quarto do anel
function pontosAnel(an, seg) {
  const pts = [];
  if (an.l < 1e-6 && an.f < 1e-6 && an.t < 1e-6) {
    for (let i = 0; i <= seg; i++) pts.push([an.dx, an.dz]);
    return pts;
  }
  const e = 2 / an.q;
  if (seg % 4) {
    // Número de segmentos que não é múltiplo de 4: pontos por ângulo (sem repartir por igual o comprimento)
    for (let i = 0; i < seg; i++) {
      const phi = -Math.PI / 2 + (i / seg) * Math.PI * 2;
      const c = Math.cos(phi);
      pts.push([an.dx + an.l * pot(Math.sin(phi), e), an.dz + (c >= 0 ? an.f : an.t) * pot(c, e)]);
    }
    pts.push(pts[0].slice());
    return pts;
  }
  const quarto = seg / 4;
  const N = 24;
  for (let k = 0; k < 4; k++) {
    const dens = [];
    const acum = [0];
    for (let m = 0; m <= N; m++) {
      const phi = -Math.PI / 2 + (k + m / N) * (Math.PI / 2);
      const s = Math.sin(phi);
      const c = Math.cos(phi);
      dens.push([an.dx + an.l * pot(s, e), an.dz + (c >= 0 ? an.f : an.t) * pot(c, e)]);
      if (m > 0) acum.push(acum[m - 1] + Math.hypot(dens[m][0] - dens[m - 1][0], dens[m][1] - dens[m - 1][1]));
    }
    const total = acum[N] || 1;
    for (let i = 0; i < quarto; i++) {
      const alvo = (i / quarto) * total;
      let m = 1;
      while (m < N && acum[m] < alvo) m++;
      const f = (alvo - acum[m - 1]) / ((acum[m] - acum[m - 1]) || 1);
      pts.push([misturar(dens[m - 1][0], dens[m][0], f), misturar(dens[m - 1][1], dens[m][1], f)]);
    }
  }
  pts.push(pts[0].slice());
  return pts;
}

// Gaussiana suave (para sombreados e relevos)
const sino = (d, s) => Math.exp(-(d * d) / (s * s));

// ---------- Malha com pele: construtor ----------
// Junta os vértices de todas as peças de uma malha (posição, textura, sombreado, brilho e os ossos que cada
// vértice segue). No fim calcula as normais (suaves, emendando vértices que estão no mesmo lugar) e vira uma
// geometria só: uma chamada de desenho.

const CHAVE_POS = 20000; // 0,05 mm: vértices mais perto que isso contam como o mesmo lugar
const chavePos = (x, y, z) => ((Math.round(x * CHAVE_POS) + 65536) * 131072 + (Math.round(y * CHAVE_POS) + 65536)) * 131072
  + (Math.round(z * CHAVE_POS) + 65536);

class Construtor {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.cor = [];   // r, g, b (sombreado pintado) e a (brilho)
    this.oss = [];
    this.pes = [];
    this.fixa = [];  // 1 = a normal foi dada (não recalcular)
    this.idx = [];
    this.n = 0;
  }

  // ossos: [osso, peso, osso, peso, ...] (até 4 pares; os pesos são acertados no fim para somar 1).
  // sombra: cinza de 0 a 1 ou [r, g, b]; brilho: 0 (fosco) a 1; normal: [x, y, z] quando já se sabe
  ponto(x, y, z, u, v, ossos, sombra = 1, brilho = 0.15, normal = null) {
    this.pos.push(x, y, z);
    this.uv.push(u, v);
    if (typeof sombra === 'number') this.cor.push(sombra, sombra, sombra, brilho);
    else this.cor.push(sombra[0], sombra[1], sombra[2], brilho);
    for (let k = 0; k < 8; k += 2) {
      this.oss.push(k < ossos.length ? ossos[k] : 0);
      this.pes.push(k < ossos.length ? ossos[k + 1] : 0);
    }
    if (normal) this.nor.push(normal[0], normal[1], normal[2]);
    else this.nor.push(0, 0, 0);
    this.fixa.push(normal ? 1 : 0);
    return this.n++;
  }

  tri(a, b, c) {
    if (a !== b && b !== c && a !== c) this.idx.push(a, b, c);
  }

  // Liga duas fileiras de vértices (listas de índices do mesmo tamanho) com triângulos
  faixa(f0, f1) {
    for (let k = 0; k < f0.length - 1; k++) {
      this.tri(f0[k], f0[k + 1], f1[k]);
      this.tri(f0[k + 1], f1[k + 1], f1[k]);
    }
  }

  // Fecha uma fileira num ponto (tampa)
  leque(fileira, centro) {
    for (let k = 0; k < fileira.length - 1; k++) this.tri(fileira[k], fileira[k + 1], centro);
  }

  marca() {
    return { v: this.n, i: this.idx.length };
  }

  // Vira as faces da peça (tudo desde a marca) para fora: volume positivo em volta do meio dela
  orientar(marca) {
    const { pos, idx } = this;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    const nv = this.n - marca.v;
    if (nv <= 0) return;
    for (let i = marca.v; i < this.n; i++) {
      cx += pos[i * 3];
      cy += pos[i * 3 + 1];
      cz += pos[i * 3 + 2];
    }
    cx /= nv;
    cy /= nv;
    cz /= nv;
    let vol = 0;
    for (let k = marca.i; k < idx.length; k += 3) {
      const a = idx[k] * 3;
      const b = idx[k + 1] * 3;
      const d = idx[k + 2] * 3;
      const ax = pos[a] - cx;
      const ay = pos[a + 1] - cy;
      const az = pos[a + 2] - cz;
      const bx = pos[b] - cx;
      const by = pos[b + 1] - cy;
      const bz = pos[b + 2] - cz;
      const dx = pos[d] - cx;
      const dy = pos[d + 1] - cy;
      const dz = pos[d + 2] - cz;
      vol += ax * (by * dz - bz * dy) + ay * (bz * dx - bx * dz) + az * (bx * dy - by * dx);
    }
    if (vol < 0) {
      for (let k = marca.i; k < idx.length; k += 3) {
        const t = idx[k + 1];
        idx[k + 1] = idx[k + 2];
        idx[k + 2] = t;
      }
    }
  }

  // Copia a peça (tudo desde a marca) espelhada em x: é o lado direito do corpo. Os ossos trocam de lado e as
  // faces viram. uv(u, v) → [u, v] muda a textura da cópia (sem ele, a mesma do lado esquerdo).
  espelhar(marca, uv = null) {
    const fim = this.n;
    const fimIdx = this.idx.length;
    const desloc = fim - marca.v;
    for (let i = marca.v; i < fim; i++) {
      this.pos.push(-this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      this.nor.push(-this.nor[i * 3], this.nor[i * 3 + 1], this.nor[i * 3 + 2]);
      this.fixa.push(this.fixa[i]);
      const u = this.uv[i * 2];
      const v = this.uv[i * 2 + 1];
      if (uv) this.uv.push(...uv(u, v));
      else this.uv.push(u, v);
      for (let k = 0; k < 4; k++) {
        this.cor.push(this.cor[i * 4 + k]);
        this.oss.push(OSSO_ESPELHADO[this.oss[i * 4 + k]]);
        this.pes.push(this.pes[i * 4 + k]);
      }
      this.n++;
    }
    for (let k = marca.i; k < fimIdx; k += 3) {
      this.idx.push(this.idx[k] + desloc, this.idx[k + 2] + desloc, this.idx[k + 1] + desloc);
    }
  }

  // Normais suaves: cada vértice recebe a média das faces em volta de todos os vértices que estão no mesmo
  // lugar (assim a emenda entre duas peças e a costura da textura não aparecem)
  normais() {
    const { pos, idx, nor, fixa, n } = this;
    const rep = new Int32Array(n);
    const mapa = new Map();
    for (let i = 0; i < n; i++) {
      const k = chavePos(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) * 2 + fixa[i];
      const r = mapa.get(k);
      if (r === undefined) {
        mapa.set(k, i);
        rep[i] = i;
      } else {
        rep[i] = r;
      }
    }
    const ac = new Float64Array(n * 3);
    for (let k = 0; k < idx.length; k += 3) {
      const ia = idx[k];
      const ib = idx[k + 1];
      const ic = idx[k + 2];
      if (fixa[ia] && fixa[ib] && fixa[ic]) continue;
      const a = ia * 3;
      const b = ib * 3;
      const d = ic * 3;
      const ux = pos[b] - pos[a];
      const uy = pos[b + 1] - pos[a + 1];
      const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[d] - pos[a];
      const vy = pos[d + 1] - pos[a + 1];
      const vz = pos[d + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      for (const i of [ia, ib, ic]) {
        const r = rep[i] * 3;
        ac[r] += nx;
        ac[r + 1] += ny;
        ac[r + 2] += nz;
      }
    }
    for (let i = 0; i < n; i++) {
      if (fixa[i]) continue;
      const r = rep[i] * 3;
      const x = ac[r];
      const y = ac[r + 1];
      const z = ac[r + 2];
      const m = Math.hypot(x, y, z) || 1;
      nor[i * 3] = x / m;
      nor[i * 3 + 1] = y / m;
      nor[i * 3 + 2] = z / m;
    }
  }

  // A geometria pronta. soContorno: só posição e ossos (para a silhueta da sombra)
  geometria({ soContorno = false } = {}) {
    const { n } = this;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    const oss = new Uint8Array(n * 4);
    const pes = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      let soma = 0;
      for (let k = 0; k < 4; k++) soma += this.pes[i * 4 + k];
      let total = 0;
      let maior = 0;
      for (let k = 0; k < 4; k++) {
        const p = Math.round((this.pes[i * 4 + k] / (soma || 1)) * 255);
        pes[i * 4 + k] = p;
        oss[i * 4 + k] = p > 0 ? this.oss[i * 4 + k] : 0;
        total += p;
        if (p > pes[i * 4 + maior]) maior = k;
      }
      pes[i * 4 + maior] += 255 - total; // a soma dá exatamente 1
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(oss, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(pes, 4, true));
    if (!soContorno) {
      this.normais();
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      const cor = new Uint8Array(n * 4);
      for (let i = 0; i < n * 4; i++) cor[i] = limitar(Math.round(this.cor[i] * 255), 0, 255);
      g.setAttribute('color', new THREE.BufferAttribute(cor, 4, true));
    }
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    // A malha com pele se mexe com os ossos: a esfera da geometria é só uma folga em volta do boneco de pé
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.3);
    return g;
  }

  // Copia uma geometria comum (posição, normal, cor e uv) para dentro desta malha. matriz: onde ela fica no
  // corpo; ossos(x, y, z): os ossos de cada vértice (posição já no corpo); uv(u, v) → [u, v]; brilho;
  // avesso: copia também o lado de dentro (cabelo comprido, que se vê por baixo), um pouco mais escuro
  receber(g, { matriz = null, ossos, uv = null, brilho = 0.15, sombra = 1, avesso = false }) {
    const p = g.attributes.position;
    const nr = g.attributes.normal;
    const cr = g.attributes.color;
    const tx = g.attributes.uv;
    const v = new THREE.Vector3();
    const w = new THREE.Vector3();
    const mn = matriz ? new THREE.Matrix3().getNormalMatrix(matriz) : null;
    for (const lado of avesso ? [1, -1] : [1]) {
      const base = this.n;
      const escuro = lado > 0 ? sombra : sombra * 0.72;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        if (matriz) v.applyMatrix4(matriz);
        w.fromBufferAttribute(nr, i);
        if (mn) w.applyMatrix3(mn).normalize();
        const t = tx ? [tx.getX(i), tx.getY(i)] : [0, 0];
        const [tu, tv] = uv ? uv(t[0], t[1]) : t;
        const s = cr ? [cr.getX(i) * escuro, cr.getY(i) * escuro, cr.getZ(i) * escuro] : escuro;
        this.ponto(v.x, v.y, v.z, tu, tv, ossos(v.x, v.y, v.z), s, brilho, [w.x * lado, w.y * lado, w.z * lado]);
      }
      const idx = g.index;
      const total = idx ? idx.count : p.count;
      for (let k = 0; k < total; k += 3) {
        const a = base + (idx ? idx.getX(k) : k);
        const b = base + (idx ? idx.getX(k + 1) : k + 1);
        const d = base + (idx ? idx.getX(k + 2) : k + 2);
        if (lado > 0) this.tri(a, b, d);
        else this.tri(a, d, b);
      }
    }
  }
}

// ---------- Perfis e seções ----------
// Seção de uma peça: [y, meia largura (x), frente (+z), trás (−z), q, dx, dz]. q = 2 é elipse; mais que 2,
// mais "quadrada". perfil(chaves) devolve a seção em qualquer altura (curva suave pelas seções-chave, que
// vêm em ordem crescente de y).
function perfil(chaves) {
  const A = chaves.map(lerAnel);
  const campos = ['l', 'f', 't', 'q', 'dx', 'dz'];
  return (y) => {
    const n = A.length;
    if (y <= A[0].y) return { ...A[0], y };
    if (y >= A[n - 1].y) return { ...A[n - 1], y };
    let i = 0;
    while (i < n - 2 && y > A[i + 1].y) i++;
    const a = A[i];
    const b = A[i + 1];
    const p = i > 0 ? A[i - 1] : null;
    const d = i + 2 < n ? A[i + 2] : null;
    const h = b.y - a.y;
    const u = (y - a.y) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    const r = { y };
    for (const c of campos) {
      const reta = (b[c] - a[c]) / h;
      const ma = p ? (b[c] - p[c]) / (b.y - p.y) : reta;
      const mb = d ? (d[c] - a[c]) / (d.y - a.y) : reta;
      r[c] = (2 * u3 - 3 * u2 + 1) * a[c] + (u3 - 2 * u2 + u) * h * ma + (-2 * u3 + 3 * u2) * b[c] + (u3 - u2) * h * mb;
    }
    return r;
  };
}

// Lista de ossos sem os de peso zero: ossosDe(O.tronco, 0.7, O.quadril, 0.3)
function ossosDe(...pares) {
  const r = [];
  for (let k = 0; k < pares.length; k += 2) if (pares[k + 1] > 0.004) r.push(pares[k], pares[k + 1]);
  return r;
}

// Ossos de uma dobra (joelho, cotovelo): acima só o osso de cima, na junta o ajudante (meio giro), abaixo só
// o de baixo. d: distância ao longo do membro a partir da junta (+ = para baixo); meia: m de transição
function ossosDaDobra(d, meia, cima, meio, baixo) {
  if (d <= -meia) return [cima, 1];
  if (d >= meia) return [baixo, 1];
  if (d < 0) {
    const k = suave((d + meia) / meia);
    return ossosDe(cima, 1 - k, meio, k);
  }
  const k = suave(d / meia);
  return ossosDe(meio, 1 - k, baixo, k);
}

// Retângulo de textura (em pixels de um atlas de 512): u, v de 0 a 1 dentro dele → coordenada no atlas.
// v = 1 fica em cima. A beirada do retângulo fica meio pixel para dentro (não mistura com o vizinho).
const ATLAS = 512;
function noRetangulo(ret, u, v) {
  return [(ret.x + 0.5 + u * (ret.w - 1)) / ATLAS, 1 - (ret.y + 0.5 + (1 - v) * (ret.h - 1)) / ATLAS];
}

// Regiões do atlas do uniforme (uma textura por time) e do atlas da aparência (uma por jogador)
const RET = {
  // uniforme
  camisa: { x: 0, y: 0, w: 512, h: 256 },
  manga: { x: 6, y: 278, w: 148, h: 110 },
  calcao: { x: 172, y: 278, w: 272, h: 122 },
  calcaoDentro: { x: 458, y: 278, w: 48, h: 122 },
  meiao: { x: 6, y: 404, w: 108, h: 102 },
  luva: { x: 130, y: 418, w: 70, h: 70 },
  // aparência
  cabeca: { x: 0, y: 0, w: 512, h: 256 },
  braco: { x: 6, y: 270, w: 88, h: 236 },
  perna: { x: 104, y: 270, w: 108, h: 236 },
  mao: { x: 222, y: 270, w: 88, h: 112 },
  chuteira: { x: 326, y: 278, w: 180, h: 150 },
  cachos: { x: 222, y: 396, w: 60, h: 60 },
  faixa: { x: 292, y: 400, w: 16, h: 16 },
  cabeloLiso: { x: 292, y: 430, w: 16, h: 24 },
  pele: { x: 222, y: 468, w: 24, h: 24 },
};
// Folga (pixels) pintada em volta de cada região: longe da câmera a textura é lida em versões pequenas, que
// misturam os vizinhos; com a folga na mesma cor da beirada, uma região não "vaza" na outra
const FOLGA = 7;

// Tubo com pele: uma peça comprida (braço, perna, meião) feita de seções em fila.
//   secoes: [{ y, l, f, t, q, dx, dz }] de cima para baixo, já no espaço do corpo (y = altura); cx, cz: eixo
//   seg: segmentos em volta; ret: retângulo da textura (u dá a volta a partir do lado −x, v = 1 em cima)
//   ossos(j, sec, u) → ossos do vértice; sombra(u, j, sec) → cinza; relevo(u, sec) → m a mais para fora
//   tampaCima / tampaBaixo: fecha a ponta com um ponto
function tuboPele(c, { secoes, seg, cx = 0, cz = 0, ret, ossos, sombra = null, relevo = null, brilho = 0.15, tampaCima = false, tampaBaixo = false, vDe = null }) {
  const n = secoes.length;
  const comp = [0];
  for (let j = 1; j < n; j++) {
    const a = secoes[j - 1];
    const b = secoes[j];
    comp.push(comp[j - 1] + Math.hypot(b.y - a.y, (b.l + b.f + b.t - a.l - a.f - a.t) / 3));
  }
  const total = comp[n - 1] || 1;
  const fileiras = [];
  for (let j = 0; j < n; j++) {
    const sec = secoes[j];
    const pts = pontosAnel(sec, seg);
    const v = vDe ? vDe(j, sec) : 1 - comp[j] / total;
    const fila = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      let x = pts[i][0];
      let z = pts[i][1];
      if (relevo) {
        const r = relevo(u, sec, j);
        if (r) {
          const m = Math.hypot(x - (sec.dx || 0), z - (sec.dz || 0)) || 1;
          x += ((x - (sec.dx || 0)) / m) * r;
          z += ((z - (sec.dz || 0)) / m) * r;
        }
      }
      const [tu, tv] = noRetangulo(ret, u, v);
      fila.push(c.ponto(cx + x, sec.y, cz + z, tu, tv, ossos(j, sec, u), sombra ? sombra(u, j, sec) : 1, brilho));
    }
    fileiras.push(fila);
    if (j > 0) c.faixa(fileiras[j - 1], fila);
  }
  const tampa = (j) => {
    const sec = secoes[j];
    const [tu, tv] = noRetangulo(ret, 0.5, j === 0 ? 1 : 0);
    const meio = c.ponto(cx + (sec.dx || 0), sec.y + (j === 0 ? 0.006 : -0.006), cz + (sec.dz || 0), tu, tv, ossos(j, sec, 0.5), sombra ? sombra(0.5, j, sec) : 1, brilho);
    if (j === 0) c.leque(fileiras[0].slice().reverse(), meio);
    else c.leque(fileiras[j], meio);
  };
  if (tampaCima) tampa(0);
  if (tampaBaixo) tampa(n - 1);
  return fileiras;
}

// Relevo de músculo: soma de calombos { y, u, sy, su, h } (altura e volta do centro, larguras e m para fora)
function calombos(lista) {
  return (u, sec) => {
    let r = 0;
    for (const b of lista) {
      let du = Math.abs(u - b.u);
      if (du > 0.5) du = 1 - du;
      r += b.h * sino(sec.y - b.y, b.sy) * sino(du, b.su);
    }
    return r;
  };
}

// ---------- Medidas de cada porte ----------
const LARGURA_PORTE = { magro: 0.92, normal: 1, forte: 1.1 };
const MANDIBULA_PORTE = { magro: 0.25, normal: 0.5, forte: 0.8 };

// kl, kz: largura e fundura do tronco; kb: grossura dos braços; kc, kp: coxas e panturrilhas; ombroX: junta do ombro
function medidasDoCorpo(porte, coxas) {
  const largura = LARGURA_PORTE[porte] ?? 1;
  const grossas = coxas === 'grossas';
  return {
    largura,
    kl: largura,
    kz: 0.5 + 0.5 * largura,
    kb: 0.55 + 0.45 * largura,
    kq: 0.7 + 0.3 * largura,                         // bacia
    kc: (0.9 + 0.1 * largura) * (grossas ? 1.17 : 1), // coxa
    kp: (0.94 + 0.06 * largura) * (grossas ? 1.09 : 1), // panturrilha
    ombroX: OMBRO_X * (0.5 + 0.5 * largura),
  };
}

const TRONCO_Y = QUADRIL_Y + CINTURA;
const OMBRO_ALT = TRONCO_Y + OMBRO_Y;             // altura da junta do ombro, de pé
const PERNA_ALT = QUADRIL_Y + QUADRIL_JUNTA_Y;    // junta do quadril
const JOELHO_ALT = PERNA_ALT - COXA;
const TORNOZELO_ALT = JOELHO_ALT - CANELA;
const BRILHO = { tecido: 0.14, pele: 0.34, cabelo: 0.5, chuteira: 0.9, luva: 0.3 };

// ---------- Camisa: tronco, ombros e mangas numa peça contínua ----------
// O tronco é feito de anéis de baixo (barra) para cima (gola). Da axila para cima o anel já inclui os ombros:
// o contorno é a união da seção do tronco com o braço (um círculo em volta do eixo do braço, que vira a
// esfera do deltoide em cima). Na altura da axila a peça se separa em três tubos: o corpo da camisa, que desce
// até a barra, e as duas mangas. Assim o ombro, a manga e as costas são uma superfície só, sem emenda.
// Seções (alturas a partir da cintura): tronco em V, peito e costas com volume, cintura mais fina, barra solta.
const PERFIL_TRONCO = perfil([
  [-0.105, 0.181, 0.127, 0.137, 2.3],   // barra (solta, por cima do calção)
  [-0.040, 0.171, 0.121, 0.126, 2.3],
  [0.030, 0.160, 0.115, 0.114, 2.4],    // cintura
  [0.150, 0.166, 0.122, 0.112, 2.5],
  [0.270, 0.181, 0.134, 0.119, 2.6],    // peito e dorsais
  [0.330, 0.184, 0.131, 0.121, 2.6],    // axilas
  [0.386, 0.180, 0.121, 0.117, 2.5],
  [0.420, 0.173, 0.108, 0.109, 2.4],
  [0.447, 0.166, 0.094, 0.098, 2.3],    // ombros
  [0.458, 0.150, 0.086, 0.092, 2.2],
  [0.468, 0.121, 0.080, 0.087, 2.1],    // trapézio
  [0.480, 0.091, 0.071, 0.078, 2.0, 0, -0.004],
  [0.490, 0.078, 0.067, 0.074, 2.0, 0, -0.006],   // gola
]);
const ALTURA_AXILA = 0.33;
const ALTURAS_CAMISA = {
  alto: [-0.105, -0.07, -0.035, 0.0, 0.03, 0.09, 0.15, 0.21, 0.27, 0.30, 0.33, 0.358, 0.386, 0.412, 0.433, 0.447, 0.457, 0.468, 0.480, 0.490],
  baixo: [-0.105, -0.04, 0.03, 0.15, 0.27, 0.33, 0.378, 0.418, 0.447, 0.463, 0.480, 0.490],
  sombra: [-0.105, 0.03, 0.27, 0.33, 0.40, 0.447, 0.47, 0.49],
};
// Esfera do deltoide: altura do centro (acima da cintura), raio e desvio do centro em relação à junta do ombro
const DELTOIDE = { y: 0.388, r: 0.063, dx: 0.007, dz: -0.008 };
const DOBRA_MINIMA = 14 * GRAUS;  // meia abertura mínima da zona do ombro, em volta do corpo

const raioTronco = (sec, cs, sn) => (Math.abs(cs / sec.l) ** sec.q + Math.abs(sn / (sn >= 0 ? sec.f : sec.t)) ** sec.q) ** (-1 / sec.q);
// Onde o raio que sai do meio do corpo na direção (cs, sn) sai do círculo do braço (0 se não passa por ele)
function raioBraco(cs, sn, bx, bz, r) {
  const b = cs * bx + sn * bz;
  const disc = b * b - (bx * bx + bz * bz - r * r);
  return disc > 0 && b > 0 ? b + Math.sqrt(disc) : 0;
}
// Ângulo (a partir do lado do corpo) em que o braço encontra o tronco: a dobra da frente (sinal +1) ou de trás
function dobraDoBraco(sec, bx, bz, r, sinal) {
  const g = (a) => raioBraco(Math.cos(a), sinal * Math.sin(a), bx, bz, r) - raioTronco(sec, Math.cos(a), sinal * Math.sin(a));
  let ultimo = -1;
  for (let a = 0; a <= 80; a += 2) {
    if (g(a * GRAUS) > 0) ultimo = a;
    else if (ultimo >= 0) break;
  }
  if (ultimo < 0) return 0;
  let a0 = ultimo * GRAUS;
  let a1 = (ultimo + 2) * GRAUS;
  for (let k = 0; k < 12; k++) {
    const m = (a0 + a1) / 2;
    if (g(m) > 0) a0 = m;
    else a1 = m;
  }
  return a0;
}

// Ângulo de cada coluna da camisa (0 = lado esquerdo do jogador, π/2 = frente), na ordem da textura: começa no
// meio do ombro direito (u = 0), passa pela frente (0,25), pelo ombro esquerdo (0,5) e pelas costas (0,75)
function angulosCamisa(det, pf, pb) {
  const { lobo: nL, frente: nF, costas: nB } = det;
  const a = [];
  for (let k = 0; k < nL / 2; k++) a.push(Math.PI - (pf * k) / (nL / 2));
  for (let k = 0; k < nF; k++) a.push(Math.PI - pf - ((Math.PI - 2 * pf) * k) / nF);
  for (let k = 0; k < nL; k++) a.push(pf - ((pf + pb) * k) / nL);
  for (let k = 0; k < nB; k++) a.push(-pb - ((Math.PI - 2 * pb) * k) / nB);
  for (let k = 0; k <= nL / 2; k++) a.push(-Math.PI + pb - (pb * k) / (nL / 2));
  return a;
}

// Contorno da camisa numa altura (porte normal): pontos [x, z] de cada coluna. Serve à malha e à pintura.
function contornoCamisa(y, m, det, dobras = null) {
  const s = PERFIL_TRONCO(y);
  const sec = { ...s, l: s.l * m.kl, f: s.f * m.kz, t: s.t * m.kz };
  const bx = m.ombroX + DELTOIDE.dx;
  const bz = DELTOIDE.dz;
  const r0 = DELTOIDE.r * m.kb;
  const acima = y >= ALTURA_AXILA - 1e-6;
  const r = !acima ? 0 : y <= DELTOIDE.y ? r0 : Math.sqrt(Math.max(0, r0 * r0 - (y - DELTOIDE.y) ** 2));
  let pf;
  let pb;
  if (dobras) [pf, pb] = dobras;
  else {
    pf = Math.max(DOBRA_MINIMA, r > 0 ? dobraDoBraco(sec, bx, bz, r, 1) : 0);
    pb = Math.max(DOBRA_MINIMA, r > 0 ? dobraDoBraco(sec, bx, bz, r, -1) : 0);
  }
  const ang = angulosCamisa(det, pf, pb);
  const pontos = ang.map((a) => {
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const re = raioTronco(sec, cs, sn);
    const rc = r > 0 ? raioBraco(Math.abs(cs), sn, bx, bz, r) : 0;
    return { cs, sn, re, rc, R: Math.max(re, rc) };
  });
  return { sec, pontos, pf, pb, r };
}

// Colunas especiais da camisa: dobras dos dois ombros e os meios (frente, lados e costas)
function colunasCamisa(det) {
  const { lobo: nL, frente: nF, costas: nB } = det;
  const iDF = nL / 2;      // dobra da frente do ombro direito
  const iEF = iDF + nF;    // dobra da frente do ombro esquerdo
  const iET = iEF + nL;    // dobra de trás do ombro esquerdo
  const iDT = iET + nB;    // dobra de trás do ombro direito
  return { N: 2 * nL + nF + nB, iDF, iEF, iET, iDT, frente: iDF + nF / 2, esquerda: iEF + nL / 2, costas: iET + nB / 2 };
}

// A textura da camisa: u de cada coluna (medido no contorno dos ombros, para a estampa não esticar) e v de
// cada altura (pelo comprimento da superfície, da barra à gola). Tudo no porte normal: os outros portes usam
// a mesma textura.
const MEDIDAS_NORMAL = medidasDoCorpo('normal', 'normais');
const mapasCamisa = new Map();
function mapaCamisa(det) {
  let mp = mapasCamisa.get(det.nome);
  if (mp) return mp;
  const col = colunasCamisa(det);
  const ref = contornoCamisa(DELTOIDE.y, MEDIDAS_NORMAL, det);
  const acum = [0];
  for (let i = 1; i <= col.N; i++) {
    const a = ref.pontos[i - 1];
    const b = ref.pontos[i];
    acum.push(acum[i - 1] + Math.hypot(b.R * b.cs - a.R * a.cs, b.R * b.sn - a.R * a.sn));
  }
  // Cada quarto da volta ocupa um quarto da textura (frente em 0,25; costas em 0,75)
  const ancoras = [0, col.frente, col.esquerda, col.costas, col.N];
  const u = [];
  for (let i = 0; i <= col.N; i++) {
    let q = 0;
    while (q < 3 && i > ancoras[q + 1]) q++;
    const a = ancoras[q];
    const b = ancoras[q + 1];
    u.push(0.25 * (q + (acum[i] - acum[a]) / (acum[b] - acum[a])));
  }
  mp = { u, col };
  mapasCamisa.set(det.nome, mp);
  return mp;
}
// v da camisa numa altura (e a volta): tabela fina, igual para todos os níveis de detalhe
const TABELA_V_CAMISA = (() => {
  const n = 64;
  const ys = [];
  const comp = [0];
  for (let k = 0; k <= n; k++) {
    const y = -0.105 + (0.595 * k) / n;
    ys.push(y);
    if (k > 0) {
      const a = PERFIL_TRONCO(ys[k - 1]);
      const b = PERFIL_TRONCO(y);
      comp.push(comp[k - 1] + Math.hypot(b.y - a.y, (b.l + b.f + b.t - a.l - a.f - a.t) / 3));
    }
  }
  return { ys, v: comp.map((c) => c / comp[n]) };
})();
function vCamisa(y) {
  const { ys, v } = TABELA_V_CAMISA;
  if (y <= ys[0]) return 0;
  const n = ys.length - 1;
  if (y >= ys[n]) return 1;
  const k = Math.min(n - 1, Math.floor(((y - ys[0]) / (ys[n] - ys[0])) * n));
  return misturar(v[k], v[k + 1], (y - ys[k]) / (ys[k + 1] - ys[k]));
}
function yDaCamisa(v) {
  const t = TABELA_V_CAMISA;
  const n = t.ys.length - 1;
  if (v <= 0) return t.ys[0];
  if (v >= 1) return t.ys[n];
  let k = 0;
  while (k < n - 1 && t.v[k + 1] < v) k++;
  return misturar(t.ys[k], t.ys[k + 1], (v - t.v[k]) / ((t.v[k + 1] - t.v[k]) || 1));
}
// A gola fica mais alta atrás do que na frente (o pescoço é inclinado)
const subidaDaGola = (y, sn) => 0.028 * (0.5 - 0.5 * sn) * suave((y - 0.41) / 0.06);

function parteCamisa(c, m, det, goleiro) {
  const { u: uCol, col } = mapaCamisa(det);
  const { N, iDF, iEF, iET, iDT } = col;
  const nL = det.lobo;
  const alturas = ALTURAS_CAMISA[det.nome];
  const jAxila = alturas.indexOf(ALTURA_AXILA);
  const topoDeltoide = DELTOIDE.y + DELTOIDE.r * m.kb;
  const marca = c.marca();
  const dobrasAxila = (() => {
    const k = contornoCamisa(ALTURA_AXILA, m, det);
    return [k.pf, k.pb];
  })();

  // Zona de cada coluna: lado (0 = corpo, 1 = ombro esquerdo, −1 = ombro direito) e t (0 na dobra do ombro
  // com o peito ou as costas, 1 no meio do ombro)
  const zona = (i) => {
    if (i >= iEF && i <= iET) return [1, Math.min(i - iEF, iET - i) / (nL / 2)];
    if (i <= iDF) return [-1, (iDF - i) / (nL / 2)];
    if (i >= iDT) return [-1, (i - iDT) / (nL / 2)];
    return [0, 0];
  };
  // modo: 'fora' (por fora do ombro), 'corpo' (na zona do ombro, mas na superfície do tronco) ou 'axila'
  // (a fileira de dentro, na altura da axila)
  const ossosDoTronco = (y, lado, t, modo) => {
    const wq = 0.8 * (1 - suave((y + 0.105) / 0.26)); // a barra acompanha a bacia
    if (!lado) return ossosDe(O.tronco, 1 - wq, O.quadril, wq);
    const ombro = lado > 0 ? O.ombroE : O.ombroD;
    const meio = lado > 0 ? O.meioOmbroE : O.meioOmbroD;
    if (y < ALTURA_AXILA - 1e-6 || modo === 'axila') {
      // Embaixo do braço: a camisa é puxada um pouco quando o braço levanta
      const w = 0.5 * suave(t * 1.5) * (1 - suave((ALTURA_AXILA - y) / 0.1));
      return ossosDe(O.tronco, 1 - wq - w, O.quadril, wq, meio, w);
    }
    const h = limitar((y - ALTURA_AXILA) / (topoDeltoide - ALTURA_AXILA), 0, 1);
    const braco = Math.max(0.4 * suave((y - ALTURA_AXILA) / 0.04), suave(t * 1.6)) * (modo === 'fora' ? 1 : 0.6);
    const w = braco * (1 - 0.72 * suave(h)) * (1 - suave((y - topoDeltoide) / 0.02));
    const parte = 0.8 * (1 - suave(h));
    return ossosDe(O.tronco, 1 - w, ombro, w * parte, meio, w * (1 - parte));
  };

  // Uma fileira de vértices. raio(ponto): escolhe o raio; encolhe: fator para as beiradas viradas para dentro
  const fileira = (y, k, { raio = (p) => p.R, encolhe = 1, v = vCamisa(y), sombra = null, axila = false, dy = 0 }) => {
    const fila = [];
    for (let i = 0; i <= N; i++) {
      const p = k.pontos[i];
      const R = raio(p) * encolhe;
      const [lado, t] = zona(i);
      const modo = axila ? 'axila' : p.rc > p.re ? 'fora' : 'corpo';
      const yy = y + subidaDaGola(y, p.sn) + dy;
      const [tu, tv] = noRetangulo(RET.camisa, uCol[i], v);
      const s = sombra ? sombra(i, p, lado, t) : 1;
      fila.push(c.ponto(R * p.cs, TRONCO_Y + yy, R * p.sn + k.sec.dz, tu, tv, ossosDoTronco(y, lado, t, modo), s, BRILHO.tecido));
    }
    return fila;
  };

  const sombraTronco = (y) => (i, p, lado, t) => {
    let s = 1 - 0.05 * sino(y - 0.03, 0.08) * Math.abs(p.cs);
    if (lado && y < ALTURA_AXILA) s -= 0.2 * suave((y - 0.15) / 0.15);                       // embaixo do braço
    if (lado && t < 0.2 && y >= ALTURA_AXILA) s -= 0.1 * (1 - suave((y - 0.39) / 0.06));     // dobra do peito com o braço
    return s;
  };

  const filas = [];
  let axila = null;
  // Beirada de dentro da barra
  {
    const k = contornoCamisa(alturas[0], m, det, dobrasAxila);
    filas.push(fileira(alturas[0], k, { encolhe: 0.9, dy: 0.016, v: 0, sombra: () => 0.5 }));
  }
  for (let j = 0; j < alturas.length; j++) {
    const y = alturas[j];
    const k = contornoCamisa(y, m, det, j < jAxila ? dobrasAxila : null);
    if (j === jAxila) {
      // Na axila há duas fileiras: a de dentro (o corpo da camisa, que desce) e a de fora (com os braços, que sobe)
      const dentro = fileira(y, k, { raio: (p) => p.re, axila: true, sombra: (i, p, lado, t) => (lado && t > 0 ? 0.62 : sombraTronco(y)(i, p, lado, t)) });
      const fora = fileira(y, k, { sombra: sombraTronco(y) });
      // Fora dos ombros (e nas dobras) as duas fileiras são o mesmo vértice
      for (let i = 0; i <= N; i++) {
        const [lado, t] = zona(i);
        if (!lado || t === 0) fora[i] = dentro[i];
      }
      c.faixa(filas[filas.length - 1], dentro);
      filas.push(fora);
      axila = { dentro, fora };
    } else {
      const fila = fileira(y, k, { sombra: sombraTronco(y) });
      c.faixa(filas[filas.length - 1], fila);
      filas.push(fila);
    }
  }
  // Beirada de dentro da gola
  {
    const y = alturas[alturas.length - 1];
    const k = contornoCamisa(y, m, det);
    const fila = fileira(y, k, { encolhe: 0.8, dy: -0.014, v: 1, sombra: () => 0.55 });
    c.faixa(filas[filas.length - 1], fila);
  }
  c.orientar(marca);

  // Topo da manga esquerda: os vértices do ombro esquerdo na altura da axila (por fora e por dentro)
  const topo = { fora: [], dentro: [] };
  for (let i = iEF; i <= iET; i++) topo.fora.push(axila.fora[i]);
  for (let i = iEF + 1; i < iET; i++) topo.dentro.push(axila.dentro[i]);
  const marcaManga = c.marca();
  parteManga(c, m, det, goleiro, topo);
  c.orientar(marcaManga);
  c.espelhar(marcaManga);
}

// Seções do braço (pele) pela distância abaixo do ombro: [a, meia largura, frente, trás]
const PERFIL_BRACO = perfil([
  [0.115, 0.047, 0.050, 0.050],
  [0.170, 0.047, 0.052, 0.049],   // bíceps e tríceps
  [0.225, 0.043, 0.045, 0.045],
  [0.265, 0.038, 0.037, 0.041],
  [0.290, 0.037, 0.035, 0.042],   // cotovelo
  [0.318, 0.041, 0.039, 0.041],
  [0.365, 0.040, 0.039, 0.037],   // antebraço
  [0.425, 0.034, 0.034, 0.032],
  [0.485, 0.026, 0.029, 0.027],
  [0.525, 0.021, 0.027, 0.025],   // punho: mais largo de frente para trás
  [0.548, 0.019, 0.030, 0.027],
]);
// Grossura do braço pelo porte (o punho quase não muda)
const grossuraBraco = (a, kb) => 1 + (kb - 1) * (1 - suave((a - 0.40) / 0.12));
const BARRA_MANGA = 0.172;  // m abaixo do ombro
const PUNHO_MANGA = 0.535;  // manga comprida (goleiro)

// Manga esquerda: continua os vértices do ombro (topo) e vira um tubo em volta do braço. A textura dá a volta
// começando pelo lado de dentro (a axila), passa por trás, por fora e pela frente.
function parteManga(c, m, det, goleiro, topo) {
  const nL = det.lobo;
  const n = 2 * nL;
  const meio = nL / 2;
  const a0 = OMBRO_Y - ALTURA_AXILA;   // a manga começa na altura da axila
  const fim = goleiro ? PUNHO_MANGA : BARRA_MANGA;
  const doTopo = (k) => {
    if (k < meio) return topo.dentro[meio + k - 1];
    if (k === meio) return topo.fora[nL];
    if (k < 3 * meio) return topo.fora[3 * meio - k];
    if (k === 3 * meio) return topo.fora[0];
    return topo.dentro[k - 3 * meio - 1];
  };
  const angulo = (k) => {
    if (k <= meio) return (180 + (80 * k) / meio) * GRAUS;
    if (k <= 3 * meio) return (260 + (200 * (k - meio)) / nL) * GRAUS;
    return (460 + (80 * (k - 3 * meio)) / meio) * GRAUS;
  };
  const vDe = (a) => 1 - (a - a0) / (fim - a0);
  const dentro = (k) => k < meio || k > 3 * meio;

  // Fileira do topo: os mesmos lugares e ossos dos vértices do ombro, com a textura da manga
  let anterior = [];
  for (let k = 0; k <= n; k++) {
    const i = doTopo(k);
    const [tu, tv] = noRetangulo(RET.manga, k / n, 1);
    const ossos = [];
    for (let q = 0; q < 4; q++) if (c.pes[i * 4 + q] > 0) ossos.push(c.oss[i * 4 + q], c.pes[i * 4 + q]);
    anterior.push(c.ponto(c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2], tu, tv, ossos, c.cor[i * 4], BRILHO.tecido));
  }
  const topoXZ = anterior.map((i) => [c.pos[i * 3], c.pos[i * 3 + 2]]);

  // Seções: [a, quanto já é o tubo (0 = contorno do topo, 1 = elipse), folga do tecido]
  const secoes = goleiro
    ? [[0.094, 0.55, 0.012], [0.118, 1, 0.012], [0.165, 1, 0.009], [0.215, 1, 0.007], [0.262, 1, 0.007], [0.29, 1, 0.008], [0.318, 1, 0.007],
      [0.37, 1, 0.006], [0.43, 1, 0.006], [0.49, 1, 0.006], [0.522, 1, 0.008], [PUNHO_MANGA, 1, 0.008]]
    : [[0.094, 0.55, 0.014], [0.118, 1, 0.015], [0.146, 1, 0.017], [BARRA_MANGA, 1, 0.019]];
  const lista = det.fino ? secoes : secoes.filter((s, i) => i === secoes.length - 1 || i % 2 === 0 || (goleiro && Math.abs(s[0] - 0.29) < 0.04));
  const anel = (a, mix, folga, sombra) => {
    const s = PERFIL_BRACO(Math.max(0.115, a));
    const g = grossuraBraco(a, m.kb);
    // O centro sai do meio do deltoide e vai para o eixo do braço
    const t = suave((a - a0) / 0.12);
    const bx = m.ombroX + DELTOIDE.dx * (1 - t);
    const bz = DELTOIDE.dz * (1 - t);
    // Por dentro (na axila) o começo da manga ainda segue um pouco o ajudante do ombro: o tecido estica aos poucos
    const wMeio = a < 0.1 ? 0.4 : a < 0.125 ? 0.15 : 0;
    const fila = [];
    for (let k = 0; k <= n; k++) {
      const th = angulo(k);
      const sn = Math.sin(th);
      let x = bx + (s.l * g + folga) * Math.cos(th);
      let z = bz + ((sn >= 0 ? s.f : s.t) * g + folga) * sn;
      if (mix < 1) {
        x = misturar(topoXZ[k][0], x, mix);
        z = misturar(topoXZ[k][1], z, mix);
      }
      const [tu, tv] = noRetangulo(RET.manga, k / n, vDe(a));
      let ossos;
      if (goleiro && a > 0.5) ossos = [O.cotoveloE, 1];
      else if (goleiro && a > 0.2) ossos = ossosDaDobra(a - BRACO, 0.04, O.ombroE, O.meioCotoveloE, O.cotoveloE);
      else ossos = dentro(k) ? ossosDe(O.ombroE, 1 - wMeio, O.meioOmbroE, wMeio) : [O.ombroE, 1];
      fila.push(c.ponto(x, OMBRO_ALT - a, z, tu, tv, ossos, sombra * (dentro(k) ? 0.84 : 1), BRILHO.tecido));
    }
    return fila;
  };
  for (const [a, mix, folga] of lista) {
    const fila = anel(a, mix, folga, 1);
    c.faixa(anterior, fila);
    anterior = fila;
  }
  // Beirada de dentro: fecha no braço (ou no punho da luva)
  const borda = anel(fim - 0.007, 1, -0.004, 0.5);
  c.faixa(anterior, borda);
}

// ---------- Calção: bacia e as duas pernas numa peça contínua ----------
// Seções da bacia (alturas a partir do pivô do quadril), de baixo (onde as pernas se separam) para cima
const PERFIL_BACIA = perfil([
  [-0.135, 0.192, 0.108, 0.120, 2.5],   // entre as pernas
  [-0.090, 0.186, 0.112, 0.128, 2.6],   // glúteos
  [-0.045, 0.174, 0.111, 0.123, 2.6],
  [0.000, 0.161, 0.107, 0.113, 2.5],    // quadris
  [0.050, 0.153, 0.103, 0.105, 2.4],    // daqui para cima fica por dentro da camisa
  [0.105, 0.147, 0.099, 0.099, 2.3],    // cós
]);
const ALTURAS_BACIA = {
  alto: [0.105, 0.06, 0.02, -0.02, -0.06, -0.10, -0.135],
  baixo: [0.105, 0.02, -0.05, -0.10, -0.135],
  sombra: [0.105, -0.03, -0.135],
};
const BARRA_CALCAO = -0.262;  // m abaixo da junta do quadril (acima do joelho)
const CALCAO_ALTO = QUADRIL_Y + 0.105;
const CALCAO_BAIXO = PERNA_ALT + BARRA_CALCAO;
const vCalcao = (y) => (y - CALCAO_BAIXO) / (CALCAO_ALTO - CALCAO_BAIXO);

function parteCalcao(c, m, det) {
  const seg = det.bacia;
  const nH = seg / 2;
  const nP = det.ponte;
  const alturas = ALTURAS_BACIA[det.nome];
  const kPerna = m.kc;
  const marca = c.marca();
  // Volta da textura: 0 = meio das costas, 0,25 = lado direito, 0,5 = meio da frente, 0,75 = lado esquerdo
  const ordem = [];
  for (let k = 0; k <= seg; k++) ordem.push(((3 * seg) / 4 + k) % seg);

  const secao = (y) => {
    const s = PERFIL_BACIA(y);
    // Embaixo a bacia tem a largura das duas pernas do calção; em cima acompanha o porte
    const t = suave((y + 0.135) / 0.14);
    const kx = misturar(kPerna, m.kq, t);
    return { ...s, l: s.l * kx, f: s.f * misturar(kPerna, m.kz, t), t: s.t * misturar(kPerna, m.kz, t) };
  };
  const ossosDaBacia = (x, y, sec) => {
    const lado = suave((Math.abs(x) / sec.l - 0.25) / 0.5);
    const baixo = suave((-0.02 - y) / 0.11);
    const w = 0.75 * lado * baixo;
    const E = x > 0;
    return ossosDe(O.quadril, 1 - w, E ? O.meioPernaE : O.meioPernaD, w * 0.7, E ? O.pernaE : O.pernaD, w * 0.3);
  };
  // Glúteos: dois volumes atrás, com o rego no meio
  const relevoBacia = (u, y) => 0.006 * sino(y + 0.07, 0.06) * (sino(u - 0.12, 0.07) + sino(u - 0.88, 0.07))
    - 0.004 * sino(y + 0.08, 0.07) * (sino(u, 0.035) + sino(u - 1, 0.035));

  let anterior = null;
  let separa = null;
  for (let j = 0; j < alturas.length; j++) {
    const y = alturas[j];
    const sec = secao(y);
    const pts = pontosAnel(sec, seg);
    const fila = [];
    for (let k = 0; k <= seg; k++) {
      let [x, z] = pts[ordem[k]];
      const us = k / seg;
      const r = relevoBacia(us, y);
      const mod = Math.hypot(x, z) || 1;
      x += (x / mod) * r;
      z += (z / mod) * r;
      const [tu, tv] = noRetangulo(RET.calcao, us, vCalcao(QUADRIL_Y + y));
      const sombra = 1 - 0.14 * suave((y - 0.0) / 0.06) - 0.08 * sino(y + 0.135, 0.03) * (1 - Math.abs(x) / sec.l);
      fila.push(c.ponto(x, QUADRIL_Y + y, z, tu, tv, ossosDaBacia(x, y, sec), sombra, BRILHO.tecido));
    }
    if (j === 0) {
      // Tampa de cima (fica por dentro da camisa)
      const [tu, tv] = noRetangulo(RET.calcao, 0.5, 1);
      const meio = c.ponto(0, QUADRIL_Y + y + 0.012, 0, tu, tv, [O.quadril, 1], 0.7, BRILHO.tecido);
      c.leque(fila.slice().reverse(), meio);
    } else {
      c.faixa(anterior, fila);
    }
    anterior = fila;
    separa = { fila, sec, y };
  }
  c.orientar(marca);

  // --- Perna esquerda do calção: metade de fora do último anel (da frente, pelo lado, até as costas) mais a
  // ponte entre as pernas (das costas de volta à frente, por baixo)
  const marcaPerna = c.marca();
  const ySepara = QUADRIL_Y + separa.y;
  const copia = (i, tu, tv, sombra = null) => {
    const ossos = [];
    for (let q = 0; q < 4; q++) if (c.pes[i * 4 + q] > 0) ossos.push(c.oss[i * 4 + q], c.pes[i * 4 + q]);
    return c.ponto(c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2], tu, tv, ossos, sombra ?? c.cor[i * 4], BRILHO.tecido);
  };
  let fora = [];
  for (let o = 0; o <= nH; o++) {
    const i = separa.fila[seg / 2 + o];
    fora.push(copia(i, c.uv[i * 2], c.uv[i * 2 + 1]));
  }
  const iB = fora[nH];
  const iF = fora[0];
  const zB = c.pos[iB * 3 + 2];
  const zF = c.pos[iF * 3 + 2];
  let dentro = [];
  for (let p = 0; p <= nP; p++) {
    const t = p / nP;
    const [tu, tv] = noRetangulo(RET.calcaoDentro, t, vCalcao(ySepara));
    if (p === 0) dentro.push(copia(iB, tu, tv, 0.6));
    else if (p === nP) dentro.push(copia(iF, tu, tv, 0.6));
    else {
      dentro.push(c.ponto(0, ySepara - 0.02 * Math.sin(Math.PI * t), misturar(zB, zF, t), tu, tv,
        ossosDe(O.quadril, 0.7, O.meioPernaE, 0.15, O.meioPernaD, 0.15), 0.55, BRILHO.tecido));
    }
  }
  const topoFora = fora.map((i) => [c.pos[i * 3], c.pos[i * 3 + 2]]);
  const topoDentro = dentro.map((i) => [c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]]);
  // Ângulos em volta do eixo da perna: 0 = lado de fora, 90° = frente
  const AF = 133;
  const AT = -129;
  const angFora = (o) => (o <= nH / 2 ? AF * (1 - o / (nH / 2)) : AT * ((o - nH / 2) / (nH / 2))) * GRAUS;
  const angDentro = (p) => (360 + AT - ((360 + AT - AF) * p) / nP) * GRAUS;
  const cx = QUADRIL_X + 0.006;
  const cz = 0.002;
  const anel = (yp, mix, encolhe, sombra) => {
    const y = PERNA_ALT + yp;
    const abre = Math.max(0, -0.17 - yp);
    const rx = (0.097 + 0.03 * abre) * kPerna * encolhe;
    const rf = (0.101 + 0.03 * abre) * kPerna * encolhe;
    const rb = (0.099 + 0.02 * abre) * kPerna * encolhe;
    const ponto = (th, de) => {
      const sn = Math.sin(th);
      let x = cx + rx * Math.cos(th);
      let z = cz + (sn >= 0 ? rf : rb) * sn;
      let yy = y;
      if (mix < 1) {
        x = misturar(de[0], x, mix);
        z = misturar(de.length > 2 ? de[2] : de[1], z, mix);
        if (de.length > 2) yy = misturar(de[1] - (ySepara - y), y, mix);
      }
      return [x, yy, z];
    };
    const ossosFora = mix < 1 ? ossosDe(O.pernaE, 0.7, O.meioPernaE, 0.3) : [O.pernaE, 1];
    const ossosDentro = mix < 1 ? ossosDe(O.pernaE, 0.6, O.meioPernaE, 0.2, O.quadril, 0.2) : [O.pernaE, 1];
    const f = [];
    for (let o = 0; o <= nH; o++) {
      const [x, yy, z] = ponto(angFora(o), topoFora[o]);
      const [tu, tv] = noRetangulo(RET.calcao, 0.5 + o / seg, vCalcao(y));
      f.push(c.ponto(x, yy, z, tu, tv, ossosFora, sombra, BRILHO.tecido));
    }
    const d = [];
    for (let p = 0; p <= nP; p++) {
      const [x, yy, z] = ponto(angDentro(p), topoDentro[p]);
      const [tu, tv] = noRetangulo(RET.calcaoDentro, p / nP, vCalcao(y));
      d.push(c.ponto(x, yy, z, tu, tv, ossosDentro, sombra * 0.72, BRILHO.tecido));
    }
    return [f, d];
  };
  const secoes = det.fino ? [[-0.14, 0.5], [-0.17, 1], [-0.215, 1], [BARRA_CALCAO, 1]] : [[-0.15, 0.6], [-0.2, 1], [BARRA_CALCAO, 1]];
  for (const [yp, mix] of secoes) {
    const [f, d] = anel(yp, mix, 1, 1);
    c.faixa(fora, f);
    c.faixa(dentro, d);
    fora = f;
    dentro = d;
  }
  // Beirada de dentro da barra: fecha na coxa
  {
    const [f, d] = anel(BARRA_CALCAO + 0.008, 1, 0.74, 0.5);
    c.faixa(fora, f);
    c.faixa(dentro, d);
  }
  c.orientar(marcaPerna);
  c.espelhar(marcaPerna, (u, v) => (u * ATLAS < RET.calcaoDentro.x ? [2 * (RET.calcao.x + 0.5 + 0.5 * (RET.calcao.w - 1)) / ATLAS - u, v] : [u, v]));
}

// ---------- Meião ----------
// Seções da canela pela altura a partir do joelho: a panturrilha tem barriga (atrás e para dentro), afina
// no tendão e alarga de novo nos ossos do tornozelo
const PERFIL_CANELA = perfil([
  [-0.445, 0.030, 0.040, 0.036],
  [-0.405, 0.033, 0.038, 0.040],    // tornozelo
  [-0.370, 0.031, 0.035, 0.038],
  [-0.320, 0.036, 0.040, 0.045],
  [-0.260, 0.044, 0.046, 0.056],
  [-0.200, 0.052, 0.051, 0.066],
  [-0.140, 0.057, 0.053, 0.072],    // barriga da panturrilha
  [-0.095, 0.055, 0.051, 0.066],
  [-0.060, 0.053, 0.049, 0.059],
  [-0.030, 0.051, 0.051, 0.052],    // logo abaixo do joelho
]);
const TOPO_MEIAO = -0.056;
const ALTURAS_MEIAO = {
  alto: [TOPO_MEIAO, -0.064, -0.088, -0.094, -0.115, -0.14, -0.17, -0.20, -0.235, -0.27, -0.31, -0.35, -0.385, -0.415, -0.445],
  baixo: [TOPO_MEIAO, -0.09, -0.14, -0.20, -0.27, -0.34, -0.40, -0.445],
  sombra: [TOPO_MEIAO, -0.14, -0.27, -0.37, -0.445],
};
const relevoCanela = calombos([
  { y: JOELHO_ALT - 0.165, u: 0.88, sy: 0.07, su: 0.12, h: 0.006 },   // gêmeo de dentro (mais baixo)
  { y: JOELHO_ALT - 0.13, u: 0.62, sy: 0.06, su: 0.11, h: 0.004 },    // gêmeo de fora
  { y: JOELHO_ALT - 0.19, u: 0.25, sy: 0.1, su: 0.08, h: 0.0035 },    // caneleira
  { y: JOELHO_ALT - 0.403, u: 0.02, sy: 0.022, su: 0.07, h: 0.005 },  // ossos do tornozelo
  { y: JOELHO_ALT - 0.412, u: 0.5, sy: 0.022, su: 0.07, h: 0.005 },
]);

function parteMeiao(c, m, det) {
  const marca = c.marca();
  const alturas = ALTURAS_MEIAO[det.nome];
  const secao = (y, extra = 0) => {
    const s = PERFIL_CANELA(y);
    const dobra = y > -0.09 ? 0.0035 : 0; // a dobra de cima é mais grossa
    return { y: JOELHO_ALT + y, l: s.l * m.kp + dobra + extra, f: s.f * m.kp + dobra + extra, t: s.t * m.kp + dobra + extra, q: 2, dx: 0, dz: 0 };
  };
  const secoes = [{ ...secao(TOPO_MEIAO + 0.008, -0.009), borda: true }, ...alturas.map((y) => secao(y))];
  tuboPele(c, {
    secoes,
    seg: det.perna,
    cx: QUADRIL_X,
    ret: RET.meiao,
    relevo: det.nome === 'sombra' ? null : (u, sec) => (sec.borda ? 0 : relevoCanela(u, sec)),
    ossos: (j, sec) => {
      const k = suave((JOELHO_ALT - 0.37 - sec.y) / 0.06);
      return ossosDe(O.joelhoE, 1 - k, O.tornozeloE, k);
    },
    sombra: (u, j, sec) => (sec.borda ? 0.5 : 1 - 0.1 * sino(u, 0.14) - 0.1 * sino(u - 1, 0.14) - 0.12 * suave((JOELHO_ALT - 0.385 - sec.y) / 0.04)),
    brilho: BRILHO.tecido,
    vDe: (j, sec) => (sec.borda ? 1 : 1 - (JOELHO_ALT + TOPO_MEIAO - sec.y) / (0.445 + TOPO_MEIAO)),
  });
  c.orientar(marca);
  c.espelhar(marca);
}

// ---------- Mão (e luva de goleiro) ----------
// Palma virada para o corpo (−x na mão esquerda), dedos juntos e um pouco dobrados, dedão na frente.
// luva: maior, com punho (vai na malha do uniforme, com a textura da luva)
function parteMao(c, m, det, luva) {
  const marca = c.marca();
  const k = luva ? 1.3 : 1;
  const ret = luva ? RET.luva : RET.mao;
  const brilho = luva ? BRILHO.luva : BRILHO.pele;
  const punho = new THREE.Vector3(m.ombroX, OMBRO_ALT - BRACO - ANTEBRACO, 0);
  const dobrar = (x, y, z) => {
    const d = Math.max(0, -0.085 * (luva ? 1.08 : 1) - y); // dedos dobrando para a palma
    return [x - d * 0.5 - d * d * 3.5, y + d * 0.12, z];
  };
  // [y, meia grossura, para a frente, para trás, q]
  const base = [
    [0.014, 0.019, 0.029, 0.026, 2.3],
    [-0.012, 0.016, 0.031, 0.029, 2.6],
    [-0.045, 0.017, 0.041, 0.035, 3],     // palma
    [-0.085, 0.0155, 0.042, 0.036, 3.2],  // nós dos dedos
    [-0.120, 0.012, 0.039, 0.034, 3.2],
    [-0.155, 0.010, 0.033, 0.029, 3],
    [-0.178, 0.008, 0.024, 0.021, 2.6],
  ];
  const usar = det.fino ? base : base.filter((s, i) => i !== 1 && i !== 4);
  const comprimento = 0.192;
  const fileiras = [];
  usar.forEach((s, j) => {
    const sec = { y: s[0] * (luva ? 1.08 : 1), l: s[1] * k, f: s[2] * k, t: s[3] * k, q: s[4], dx: 0, dz: 0 };
    const pts = pontosAnel(sec, det.mao);
    const fila = [];
    for (let i = 0; i <= det.mao; i++) {
      const [x, y, z] = dobrar(pts[i][0], sec.y, pts[i][1]);
      const [tu, tv] = noRetangulo(ret, i / det.mao, 1 - (0.014 - s[0]) / comprimento);
      fila.push(c.ponto(punho.x + x, punho.y + y, punho.z + z, tu, tv, [O.punhoE, 1], pts[i][0] < -0.004 ? 0.86 : 1, brilho));
    }
    fileiras.push(fila);
    if (j > 0) c.faixa(fileiras[j - 1], fila);
  });
  {
    // Ponta dos dedos
    const [x, y, z] = dobrar(0, -0.188 * (luva ? 1.08 : 1), 0.002);
    const [tu, tv] = noRetangulo(ret, 0.5, 0);
    const ponta = c.ponto(punho.x + x, punho.y + y, punho.z + z, tu, tv, [O.punhoE, 1], 0.9, brilho);
    c.leque(fileiras[fileiras.length - 1], ponta);
  }
  c.orientar(marca);
  // Dedão: sai da frente da palma, apontando para baixo e para a frente
  const marcaDedao = c.marca();
  const md = matriz(punho.x - 0.006 * k, punho.y - 0.034, punho.z + 0.031 * k, -0.5, 0, -0.25);
  const v3 = new THREE.Vector3();
  const aneis = [[0.012, 0.0001], [0.002, 0.0115], [-0.028, 0.0125], [-0.052, 0.0105], [-0.064, 0.0001]];
  const segD = Math.max(4, det.mao - 2);
  let anterior = null;
  for (const [y, r] of aneis) {
    const fila = [];
    for (let i = 0; i <= segD; i++) {
      const a = (i / segD) * Math.PI * 2;
      v3.set(Math.cos(a) * r * k, y, Math.sin(a) * r * k * 1.1).applyMatrix4(md);
      const [tu, tv] = noRetangulo(ret, 0.2 + 0.1 * (i / segD), 0.5 + y * 4);
      fila.push(c.ponto(v3.x, v3.y, v3.z, tu, tv, [O.punhoE, 1], 0.95, brilho));
    }
    if (anterior) c.faixa(anterior, fila);
    anterior = fila;
  }
  c.orientar(marcaDedao);
  if (luva) {
    // Punho da luva, por cima da manga
    const marcaPunho = c.marca();
    tuboPele(c, {
      secoes: [[0.04, 0.034, 0.038, 0.036], [0.03, 0.039, 0.043, 0.041], [-0.012, 0.038, 0.043, 0.041], [-0.022, 0.026, 0.034, 0.032]]
        .map((s) => ({ y: punho.y + s[0], l: s[1], f: s[2], t: s[3], q: 2.2, dx: 0, dz: 0 })),
      seg: det.mao,
      cx: punho.x,
      ret,
      ossos: (j) => (j < 2 ? [O.cotoveloE, 1] : [O.punhoE, 1]),
      sombra: (u, j) => (j === 0 || j === 3 ? 0.6 : 0.92),
      brilho,
      vDe: () => 0.98,
    });
    c.orientar(marcaPunho);
  }
  c.espelhar(marca);
}

// A malha do uniforme de um corpo (porte, coxas, goleiro, detalhe): camisa com mangas, calção, meiões e, no
// goleiro, as luvas. Fica em cache: todos os bonecos com o mesmo corpo usam a mesma geometria.
function geoUniforme(porte, coxas, goleiro, det) {
  return geo(`uniforme:${porte}:${coxas}:${goleiro ? 1 : 0}:${det.nome}`, () => {
    const m = medidasDoCorpo(porte, coxas);
    const c = new Construtor();
    parteCamisa(c, m, det, goleiro);
    parteCalcao(c, m, det);
    parteMeiao(c, m, det);
    if (goleiro) parteMao(c, m, det, true);
    return c.geometria();
  });
}

// ---------- Braço (pele) ----------
const ALTURAS_BRACO = {
  alto: [0.125, 0.17, 0.215, 0.25, 0.272, 0.29, 0.308, 0.33, 0.37, 0.42, 0.47, 0.51, 0.538],
  baixo: [0.125, 0.19, 0.255, 0.29, 0.325, 0.39, 0.46, 0.52, 0.538],
  sombra: [0.16, 0.29, 0.38, 0.47, 0.538],
};
const relevoBraco = calombos([
  { y: OMBRO_ALT - 0.292, u: 0.75, sy: 0.018, su: 0.07, h: 0.004 },   // ponta do cotovelo
  { y: OMBRO_ALT - 0.185, u: 0.27, sy: 0.05, su: 0.1, h: 0.0035 },    // bíceps
  { y: OMBRO_ALT - 0.17, u: 0.72, sy: 0.05, su: 0.1, h: 0.003 },      // tríceps
  { y: OMBRO_ALT - 0.335, u: 0.58, sy: 0.04, su: 0.1, h: 0.0035 },    // músculos de fora do antebraço
]);

function parteBraco(c, m, det) {
  const marca = c.marca();
  const secoes = ALTURAS_BRACO[det.nome].map((a) => {
    const s = PERFIL_BRACO(a);
    const g = grossuraBraco(a, m.kb);
    return { y: OMBRO_ALT - a, a, l: s.l * g, f: s.f * g, t: s.t * g, q: 2, dx: 0, dz: 0 };
  });
  tuboPele(c, {
    secoes,
    seg: det.braco,
    cx: m.ombroX,
    ret: RET.braco,
    relevo: det.nome === 'sombra' ? null : relevoBraco,
    ossos: (j, sec) => {
      if (sec.a > 0.5) {
        const k = suave((sec.a - 0.505) / 0.035);
        return ossosDe(O.cotoveloE, 1 - k, O.punhoE, k);
      }
      return ossosDaDobra(sec.a - BRACO, 0.036, O.ombroE, O.meioCotoveloE, O.cotoveloE);
    },
    // Lado de dentro mais escuro; por baixo da manga, sombra da barra
    sombra: (u, j, sec) => 1 - 0.1 * (sino(u, 0.16) + sino(u - 1, 0.16)) - 0.22 * (1 - suave((sec.a - 0.165) / 0.035)),
    brilho: BRILHO.pele,
    vDe: (j, sec) => 1 - (sec.a - 0.125) / (0.538 - 0.125),
  });
  c.orientar(marca);
  c.espelhar(marca);
}

// ---------- Perna (pele): coxa, joelho e o começo da canela ----------
// Seções pela altura a partir do joelho: quadríceps largo em cima, o joelho é uma transição (com a rótula na
// frente e os tendões atrás), e a canela entra no meião
const PERFIL_COXA = perfil([
  [-0.090, 0.050, 0.046, 0.058],
  [-0.055, 0.050, 0.047, 0.055],
  [-0.030, 0.051, 0.051, 0.051],
  [0.000, 0.054, 0.058, 0.052],    // joelho
  [0.035, 0.055, 0.060, 0.054],
  [0.080, 0.061, 0.067, 0.060],
  [0.140, 0.069, 0.076, 0.068],    // quadríceps
  [0.200, 0.076, 0.083, 0.075],
  [0.270, 0.079, 0.085, 0.079],    // daqui para cima fica dentro do calção
]);
const ALTURAS_PERNA = {
  alto: [0.265, 0.205, 0.145, 0.095, 0.055, 0.027, 0.0, -0.027, -0.052, -0.088],
  baixo: [0.265, 0.16, 0.07, 0.02, -0.03, -0.088],
  sombra: [0.265, 0.1, 0.0, -0.088],
};
const relevoJoelho = calombos([
  { y: JOELHO_ALT + 0.004, u: 0.25, sy: 0.03, su: 0.07, h: 0.0065 },   // rótula
  { y: JOELHO_ALT + 0.075, u: 0.13, sy: 0.05, su: 0.09, h: 0.005 },    // vasto de dentro (a "gota" acima do joelho)
  { y: JOELHO_ALT + 0.115, u: 0.4, sy: 0.07, su: 0.1, h: 0.004 },      // vasto de fora
  { y: JOELHO_ALT + 0.025, u: 0.9, sy: 0.045, su: 0.045, h: 0.0045 },  // tendões de trás do joelho
  { y: JOELHO_ALT + 0.025, u: 0.61, sy: 0.045, su: 0.045, h: 0.004 },
  { y: JOELHO_ALT + 0.005, u: 0.75, sy: 0.03, su: 0.06, h: -0.004 },   // a cova atrás do joelho
]);

function partePerna(c, m, det) {
  const marca = c.marca();
  const secoes = ALTURAS_PERNA[det.nome].map((y) => {
    const s = PERFIL_COXA(y);
    const k = y >= 0 ? 1 + (m.kc - 1) * suave(y / 0.12) : 1 + (m.kp - 1) * suave(-y / 0.06);
    return { y: JOELHO_ALT + y, h: y, l: s.l * k, f: s.f * k, t: s.t * k, q: 2, dx: 0, dz: 0 };
  });
  tuboPele(c, {
    secoes,
    seg: det.perna,
    cx: QUADRIL_X,
    ret: RET.perna,
    relevo: det.nome === 'sombra' ? null : relevoJoelho,
    ossos: (j, sec) => ossosDaDobra(-sec.h, 0.046, O.pernaE, O.meioJoelhoE, O.joelhoE),
    // Lado de dentro da coxa mais escuro; sombra do calção em cima e do meião embaixo
    sombra: (u, j, sec) => 1 - 0.12 * (sino(u, 0.17) + sino(u - 1, 0.17)) * suave(sec.h / 0.1)
      - 0.24 * suave((sec.h - 0.14) / 0.07) - 0.12 * suave((-0.04 - sec.h) / 0.03),
    brilho: BRILHO.pele,
    vDe: (j, sec) => (sec.h + 0.088) / (0.265 + 0.088),
  });
  c.orientar(marca);
  c.espelhar(marca);
}

// ---------- Chuteira ----------
// Estações ao longo do pé [z, meia largura, topo, sola], do calcanhar para o bico (no espaço do tornozelo).
// A sola encosta no chão nos pontos de SOLA; com travas (detalhe alto) a sola sobe 5 mm e as travas encostam.
const ESTACOES_CHUTEIRA = [
  [-0.079, 0.0001, -0.018, -0.056],
  [-0.072, 0.024, 0.014, -0.067],
  [-0.052, 0.035, 0.024, -0.070],   // contraforte do calcanhar
  [-0.022, 0.039, 0.020, -0.070],
  [0.010, 0.040, 0.008, -0.070],    // boca (o meião entra aqui)
  [0.045, 0.043, -0.011, -0.070],   // peito do pé (cadarço)
  [0.090, 0.047, -0.029, -0.070],   // parte larga
  [0.135, 0.046, -0.037, -0.0695],
  [0.170, 0.039, -0.043, -0.066],
  [0.192, 0.025, -0.049, -0.0615],  // bico
  [0.203, 0.0001, -0.055, -0.0600],
];
const TRAVAS = [[0.02, -0.045], [-0.019, -0.045], [0.03, 0.062], [-0.027, 0.058], [0.026, 0.128], [-0.02, 0.124]];
const ALTURA_TRAVA = 0.005;

function parteChuteira(c, m, det) {
  const marca = c.marca();
  const seg = det.pe;
  const travas = det.fino;
  const estacoes = det.fino ? ESTACOES_CHUTEIRA : ESTACOES_CHUTEIRA.filter((e, i) => [0, 1, 3, 4, 6, 8, 10].includes(i));
  const z0 = ESTACOES_CHUTEIRA[0][0];
  const z1 = ESTACOES_CHUTEIRA[ESTACOES_CHUTEIRA.length - 1][0];
  const ox = QUADRIL_X;
  const oy = TORNOZELO_ALT;
  let anterior = null;
  for (const [z, w, topo, solaBase] of estacoes) {
    const sola = solaBase + (travas ? ALTURA_TRAVA * suave((0.175 - z) / 0.03) : 0);
    const yc = (topo + sola) / 2;
    const h = (topo - sola) / 2;
    const desvio = -0.007 * suave((z - 0.06) / 0.12); // o bico puxa para o lado do dedão (dentro)
    const fila = [];
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2; // 0 = em cima (cadarço), π = sola
      const s = Math.sin(th);
      const co = Math.cos(th);
      const e = co < 0 ? 2 / 6 : 2 / 2.4; // sola bem reta, peito do pé arredondado
      const x = w * pot(s, 2 / 2.6);
      let y = yc + h * pot(co, e);
      // Arco do pé (lado de dentro, −x): a sola sobe um pouco no meio
      if (x < 0 && co < -0.3) y += 0.004 * sino(z - 0.03, 0.04) * Math.min(1, -x / Math.max(w, 1e-6));
      const [tu, tv] = noRetangulo(RET.chuteira, i / seg, (z - z0) / (z1 - z0));
      fila.push(c.ponto(ox + x + desvio, oy + y, z, tu, tv, [O.tornozeloE, 1], 1, BRILHO.chuteira));
    }
    if (anterior) c.faixa(anterior, fila);
    anterior = fila;
  }
  c.orientar(marca);
  if (travas) {
    // Travas: troncos de pirâmide embaixo da sola
    const [tu, tv] = noRetangulo(RET.chuteira, 0.5, 0.02);
    for (const [tx, tz] of TRAVAS) {
      const mt = c.marca();
      const cima = [];
      const baixo = [];
      for (let i = 0; i <= 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        cima.push(c.ponto(ox + tx + 0.0085 * Math.cos(a), oy - 0.0635, tz + 0.0085 * Math.sin(a), tu, tv, [O.tornozeloE, 1], 0.9, 0.5));
        baixo.push(c.ponto(ox + tx + 0.0055 * Math.cos(a), oy - 0.07, tz + 0.0055 * Math.sin(a), tu, tv, [O.tornozeloE, 1], 0.75, 0.5));
      }
      c.faixa(cima, baixo);
      const meio = c.ponto(ox + tx, oy - 0.07, tz, tu, tv, [O.tornozeloE, 1], 0.7, 0.5);
      c.leque(baixo, meio);
      c.orientar(mt);
    }
  }
  c.espelhar(marca);
}

// ---------- Pescoço ----------
// Seções pela altura a partir da base do pescoço (pivô da cabeça): larga embaixo (trapézio), entra na gola
const SECOES_PESCOCO = [
  [-0.065, 0.088, 0.070, 0.082, 2, 0, -0.008],
  [-0.020, 0.071, 0.064, 0.071, 2, 0, -0.007],
  [0.030, 0.061, 0.059, 0.062, 2, 0, -0.004],
  [0.080, 0.056, 0.054, 0.058, 2, 0, -0.004],
  [0.130, 0.052, 0.050, 0.056, 2, 0, -0.006],
];
const CABECA_Y = TRONCO_Y + PESCOCO;
// O pescoço dobra entre o tronco e a cabeça
const ossosDoPescoco = (y) => {
  const k = suave((y - CABECA_Y + 0.05) / 0.12);
  return ossosDe(O.cabeca, k, O.tronco, 1 - k);
};

function partePescoco(c, det) {
  const marca = c.marca();
  tuboPele(c, {
    secoes: SECOES_PESCOCO.map((s) => ({ ...lerAnel(s), y: CABECA_Y + s[0], h: s[0] })),
    seg: det.fino ? 10 : 6,
    ret: RET.pele,
    ossos: (j, sec) => ossosDoPescoco(sec.y),
    // Mais escuro embaixo do queixo (na frente, em cima) e por dentro da gola
    sombra: (u, j, sec) => 0.9 - 0.14 * sino(u - 0.25, 0.17) * suave((sec.h - 0.03) / 0.06) - 0.2 * suave((-0.015 - sec.h) / 0.04),
    brilho: BRILHO.pele,
    vDe: () => 0.5,
  });
  c.orientar(marca);
}

// Cabeça simples para a silhueta da sombra: crânio com um pouco de cabelo, sem rosto
function parteCabecaSimples(c) {
  const marca = c.marca();
  tuboPele(c, {
    secoes: [[0.305, 0.03, 0.035, 0.035], [0.275, 0.07, 0.078, 0.08], [0.215, 0.088, 0.1, 0.102], [0.15, 0.085, 0.098, 0.096], [0.1, 0.07, 0.086, 0.07], [0.07, 0.05, 0.06, 0.056], [-0.05, 0.075, 0.066, 0.076]]
      .map((s) => ({ y: CABECA_Y + s[0], l: s[1], f: s[2], t: s[3], q: 2, dx: 0, dz: 0 })),
    seg: 6,
    ret: RET.pele,
    ossos: (j, sec) => ossosDoPescoco(sec.y),
    tampaCima: true,
  });
  c.orientar(marca);
}

// As peças de pele do corpo (braços, mãos, pernas e chuteiras), sem a cabeça
function partesDoCorpo(c, m, det, goleiro) {
  if (!goleiro) {
    parteBraco(c, m, det);
    parteMao(c, m, det, false);
  }
  partePerna(c, m, det);
  parteChuteira(c, m, det);
}

// Silhueta para a sombra: o corpo inteiro com poucos triângulos, só posição e ossos, repetido 'copias'
// vezes com o atributo 'copia' (0, 1, ...) em cada vértice
function geoSilhueta(porte, coxas, goleiro, copias) {
  return geo(`silhueta:${porte}:${coxas}:${goleiro ? 1 : 0}:${copias}`, () => {
    const det = DETALHES.sombra;
    const m = medidasDoCorpo(porte, coxas);
    const c = new Construtor();
    parteCamisa(c, m, det, goleiro);
    parteCalcao(c, m, det);
    parteMeiao(c, m, det);
    parteBraco(c, m, det);
    parteMao(c, m, det, goleiro);
    partePerna(c, m, det);
    parteChuteira(c, m, det);
    parteCabecaSimples(c);
    const base = c.geometria({ soContorno: true });
    c.normais();
    base.setAttribute('normal', new THREE.Float32BufferAttribute(c.nor, 3));
    if (copias <= 1) {
      base.setAttribute('copia', new THREE.BufferAttribute(new Float32Array(c.n), 1));
      return base;
    }
    const n = c.n;
    const pos = new Float32Array(n * 3 * copias);
    const nor = new Float32Array(n * 3 * copias);
    const oss = new Uint8Array(n * 4 * copias);
    const pes = new Uint8Array(n * 4 * copias);
    const copia = new Float32Array(n * copias);
    const ni = base.index.count;
    const idx = new (n * copias > 65535 ? Uint32Array : Uint16Array)(ni * copias);
    for (let k = 0; k < copias; k++) {
      pos.set(base.attributes.position.array, k * n * 3);
      nor.set(base.attributes.normal.array, k * n * 3);
      oss.set(base.attributes.skinIndex.array, k * n * 4);
      pes.set(base.attributes.skinWeight.array, k * n * 4);
      copia.fill(k, k * n, (k + 1) * n);
      for (let i = 0; i < ni; i++) idx[k * ni + i] = base.index.array[i] + k * n;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(oss, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(pes, 4, true));
    g.setAttribute('copia', new THREE.BufferAttribute(copia, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = base.boundingSphere;
    return g;
  });
}

// ---------- Cabeça ----------
// mand: largura da mandíbula (0 = rosto fino, 1 = queixo largo)

// Ponto da superfície da cabeça na direção (x, y, z) da esfera unitária, afastado 'folga' m da pele.
function pontoCabeca(x, y, z, folga = 0, escala = 1, mand = 0.5) {
  const baixo = Math.max(0, -y);
  const tras = Math.max(0, -z);
  const g = (a, b, c, s) => Math.exp(-((x - a) ** 2 + (y - b) ** 2 + (z - c) ** 2) / (s * s));
  // Relevos: maçãs do rosto, arco das sobrancelhas, olhos fundos, boca e nuca
  const rel = 0.005 * (g(0.62, -0.2, 0.74, 0.28) + g(-0.62, -0.2, 0.74, 0.28))
    + 0.006 * g(0, 0.2, 0.97, 0.32)
    - 0.0045 * (g(0.38, 0.09, 0.92, 0.15) + g(-0.38, 0.09, 0.92, 0.15))
    + 0.004 * g(0, -0.45, 0.88, 0.3)
    + 0.007 * g(0, 0.15, -0.95, 0.42);
  // Mandíbula mais estreita que o crânio; queixo para a frente; a nuca entra em direção ao pescoço
  const kx = 1 - (0.33 - 0.12 * mand) * baixo * baixo;
  const kz = 1 - 0.1 * baixo * baixo - 0.2 * baixo * tras;
  const queixo = z > 0 ? (0.014 + 0.004 * mand) * baixo * z : 0;
  // Topo do crânio mais cheio (redondo, sem "ponta")
  const cima = Math.max(0, y);
  const domo = 1 + 0.28 * cima * (1 - cima);
  return new THREE.Vector3(
    x * (CRANIO.rx * escala * kx * domo + folga + rel),
    CRANIO.y + y * (CRANIO.ry * escala + folga + rel) - (z > 0 ? 0.018 * baixo * baixo * z : 0),
    CRANIO.z + z * (CRANIO.rz * escala * kz * (1 + 0.12 * cima * (1 - cima)) + folga + rel) + queixo,
  );
}
// Direção na cabeça pelo ângulo em volta (az, graus; + para a esquerda do jogador) e a partir do alto (pol)
const dirAzPol = (az, pol) => new THREE.Vector3(
  Math.sin(az * GRAUS) * Math.sin(pol * GRAUS), Math.cos(pol * GRAUS), Math.cos(az * GRAUS) * Math.sin(pol * GRAUS));

// Pedaço de pele com textura do rosto em um ponto liso (orelhas, nariz, pescoço)
const UV_PELE = [0.5, 0.012];

// Anéis da cabeça (graus a partir do alto): mais juntos no rosto (olhos, boca, queixo)
const ANEIS_CABECA = [0, 24, 46, 66, 80, 91, 101, 109, 116, 123, 133, 150, 180];

// Crânio, rosto, nariz e orelhas numa peça só (o pescoço é feito à parte, porque dobra entre a cabeça e o
// tronco). A barba (cheia, bigode, cavanhaque) é volume da própria cabeça: a pele sobe onde ela cobre, e a
// cor vem da pintura do rosto (sem beirada serrilhada). fino: false = menos triângulos (visto de longe).
function geoCabeca(mand, barba = null, fino = true) {
  const esp = ESPESSURA_BARBA[barba] || 0;
  return peca(`cabeca:${mand}:${esp ? barba : ''}:${fino ? 1 : 0}`, () => {
    const seg = fino ? 16 : 12;
    const pos = [];
    const uv = [];
    const idx = [];
    ANEIS_CABECA.forEach((pol, j) => {
      const th = pol * GRAUS;
      for (let i = 0; i <= seg; i++) {
        const phi = (i / seg) * Math.PI * 2;
        const x = -Math.cos(phi) * Math.sin(th);
        const y = Math.cos(th);
        const z = Math.sin(phi) * Math.sin(th);
        const f = esp ? esp * coberturaBarba(barba, Math.atan2(x, z) / GRAUS, pol) ** 1.3 : 0;
        const q = pontoCabeca(x, y, z, f, 1, mand);
        pos.push(q.x, q.y, q.z);
        uv.push(i / seg, 1 - pol / 180);
      }
    });
    const linha = seg + 1;
    for (let j = 0; j < ANEIS_CABECA.length - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * linha + i + 1;
        const b = j * linha + i;
        const c = (j + 1) * linha + i;
        const d = (j + 1) * linha + i + 1;
        if (j > 0) idx.push(a, b, d);
        if (j < ANEIS_CABECA.length - 2) idx.push(b, c, d);
      }
    }
    const cranio = new THREE.BufferGeometry();
    cranio.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cranio.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    cranio.setIndex(idx);
    // Sombra embaixo do queixo e da mandíbula
    comCor(cranio, (x, y) => 1 - 0.22 * suave((CRANIO.y - 0.1 - y) / 0.02));
    orientar(cranio, new THREE.Vector3(0, CRANIO.y, CRANIO.z));

    // Nariz: cunha com ponta, asas e base
    const sobre = (az, pol, f) => pontoCabeca(...dirAzPol(az, pol).toArray(), f, 1, mand);
    const P = [
      sobre(0, 84, 0.001),       // 0 raiz, entre os olhos
      sobre(-6.5, 91, -0.001),   // 1 lado direito da ponte
      sobre(6.5, 91, -0.001),    // 2 lado esquerdo da ponte
      sobre(0, 101.5, 0.019),    // 3 ponta
      sobre(-10, 104.5, 0.002),  // 4 asa direita
      sobre(10, 104.5, 0.002),   // 5 asa esquerda
      sobre(0, 107, 0.005),      // 6 base (entre as narinas)
      sobre(-5, 106, 0.0095),    // 7 narina direita
      sobre(5, 106, 0.0095),     // 8 narina esquerda
    ];
    const nariz = new THREE.BufferGeometry();
    nariz.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap((v) => v.toArray()), 3));
    nariz.setIndex([0, 1, 3, 0, 3, 2, 1, 4, 3, 2, 3, 5, 4, 7, 3, 5, 3, 8, 7, 6, 3, 8, 3, 6, 4, 6, 7, 5, 8, 6]);
    // Cada triângulo virado para fora da cabeça
    const ix = nariz.index.array;
    const cc = new THREE.Vector3(0, CRANIO.y, CRANIO.z);
    for (let k = 0; k < ix.length; k += 3) {
      const a = P[ix[k]];
      const b = P[ix[k + 1]];
      const c = P[ix[k + 2]];
      const nrm = b.clone().sub(a).cross(c.clone().sub(a));
      if (nrm.dot(a.clone().add(b).add(c).divideScalar(3).sub(cc)) < 0) {
        const t = ix[k + 1];
        ix[k + 1] = ix[k + 2];
        ix[k + 2] = t;
      }
    }
    nariz.computeVertexNormals();
    comCor(nariz, (x, y) => (y < P[6].y + 0.004 ? 0.78 : 1));
    uvFixo(nariz, ...UV_PELE);

    // Orelhas: achatadas, inclinadas para trás, com a concha mais escura
    const orelhas = [];
    for (const s of [-1, 1]) {
      const o = new THREE.SphereGeometry(1, fino ? 6 : 5, fino ? 4 : 3);
      comCor(o, (x, y) => 1 - 0.25 * Math.max(0, s * x) * (1 - Math.abs(y)));
      uvFixo(o, ...UV_PELE);
      orelhas.push([o, matriz(s * (CRANIO.rx + 0.001), CRANIO.y - 0.014, -0.012, 0, s * -0.32, -0.14 * s, 0.009, 0.027, 0.018)]);
    }
    cranio.computeVertexNormals();
    suavizarCostura(cranio);
    return fundir([cranio, nariz, ...orelhas]);
  });
}

// ---------- Cabelos ----------
// A linha do cabelo diz até onde ele vai: 'frente' (testa), 'lado' (acima das orelhas) e 'tras' (nuca),
// em graus a partir do alto da cabeça.

function limiteCabelo(linha, x, z) {
  const c = Math.cos(Math.atan2(x, z)); // 1 = frente, -1 = nuca
  const f = Math.max(0, c);
  const t = Math.max(0, -c);
  return (linha.lado + (linha.frente - linha.lado) * f * f + (linha.tras - linha.lado) * Math.sqrt(t) * t) * GRAUS;
}

// Cachos e ondas: relevo irregular (0 a ~1) conforme a direção na cabeça
function relevo(x, y, z, freq) {
  const a = Math.sin(freq * x + 1.7) * Math.sin(freq * 1.13 * y + 0.3) * Math.sin(freq * 0.91 * z + 2.2);
  const b = Math.sin(freq * 2.1 * (x + y) + 0.9) * Math.sin(freq * 1.9 * (z - y) + 1.1);
  return Math.max(0, 0.6 + a + 0.5 * b) / 2.1;
}

// Faixa de cabelo: passa na testa, logo acima da linha do cabelo, e desce atrás da cabeça
function anguloFaixa(x, z) {
  const c = Math.cos(Math.atan2(x, z));
  return (79 - 26 * c) * GRAUS;
}

// Superfície de um corte de cabelo: ponto(phi, t, extra) com phi em volta (como a esfera do THREE) e
// t = 0 no alto da cabeça até 1 na linha do cabelo (ou na ponta dos fios, se ele cai).
//   base, topo, tras, lados, frenteTopo: volume (m) em cada região; borda: graus em que encosta na pele
//   ondas: { amplitude, frequencia }; ruido(phi, ax, az): graus a mais na linha (franja, pontas)
//   caida: { inicio (graus), comprimento (m), abre }: abaixo de 'inicio' os fios caem retos
//   volumeExtra(x, y, z): m a mais em cada direção (topete, risca); faixa: aperta o cabelo onde passa a faixa
//   pontaSolta: a ponta dos fios que caem fica longe da pele (cabelo comprido); sem ela, a beirada afina
function mapaCabelo({
  linha, base = 0.012, topo = 0, tras = 0, lados = 0, frenteTopo = 0, borda = 12, ondas = null,
  ruido = null, caida = null, volumeExtra = null, faixa = false, pontaSolta = false,
}) {
  const thetaC = caida ? caida.inicio * GRAUS : Infinity;
  const limite = (phi) => limiteCabelo(linha, -Math.cos(phi), Math.sin(phi)) / GRAUS
    + (ruido ? ruido(phi, -Math.cos(phi), Math.sin(phi)) : 0);
  const ponto = function ponto(phi, t, extra = 0) {
    const ax = -Math.cos(phi);
    const az = Math.sin(phi);
    let lim = limiteCabelo(linha, ax, az);
    if (ruido) lim += ruido(phi, ax, az) * GRAUS;
    const theta = t * lim;
    const th = Math.min(theta, thetaC);
    const sx = ax * Math.sin(th);
    const sy = Math.cos(th);
    const sz = az * Math.sin(th);
    let f = base + topo * Math.max(0, sy) ** 2 + tras * Math.max(0, -az) * Math.sin(th)
      + lados * Math.abs(ax) * Math.sin(th) + frenteTopo * Math.max(0, az) * Math.max(0, sy);
    if (volumeExtra) f += volumeExtra(sx, sy, sz);
    let rel = ondas ? ondas.amplitude * relevo(sx, sy, sz, ondas.frequencia) : 0;
    if (faixa) {
      const perto = sino((th - anguloFaixa(sx, sz)) / GRAUS, 9);
      f -= perto * base * 0.45;
      rel *= 1 - perto;
    }
    f += rel;
    if (lim <= thetaC + 1e-6 || !pontaSolta) {
      const b = suave((lim - theta) / (borda * GRAUS));
      f = 0.0015 + (f - 0.0015) * b;
    }
    const q = pontoCabeca(sx, sy, sz, f + extra);
    if (theta > thetaC) {
      // Fios caindo: descem retos a partir de 'inicio', abrindo um pouco
      const d = ((theta - thetaC) / (Math.PI / 2)) * caida.comprimento;
      q.y -= d;
      q.x += ax * d * (caida.abre ?? 0.1);
      q.z += az * d * (caida.abre ?? 0.1) - (caida.paraTras ?? 0) * d;
    }
    return q;
  };
  ponto.limite = limite;
  return ponto;
}

// Coordenada da textura do rosto para uma direção na cabeça (a mesma da esfera do THREE)
function uvDaDirecao(x, y, z) {
  let u = Math.atan2(z, -x) / (Math.PI * 2);
  if (u < 0) u += 1;
  return [u, 1 - Math.acos(limitar(y, -1, 1)) / Math.PI];
}

// Casca do cabelo a partir do mapa. Usa a mesma textura do rosto (o cabelo é pintado nela, na direção da
// raiz de cada ponto), então a beirada da casca some na pele sem "borda de capacete".
// Sombreado: tom de cada mecha varia de leve; pontaSolta escurece as pontas (cabelo comprido).
function cascaCabelo(ponto, seg, aneis, { escurecePonta = 0 } = {}) {
  const pos = [];
  const uv = [];
  const cores = [];
  const idx = [];
  for (let j = 0; j <= aneis; j++) {
    const t = j / aneis;
    for (let i = 0; i <= seg; i++) {
      const phi = (i / seg) * Math.PI * 2;
      const q = ponto(phi, t);
      pos.push(q.x, q.y, q.z);
      const theta = Math.min(179, t * ponto.limite(phi)) * GRAUS;
      uv.push(i / seg, 1 - theta / Math.PI);
      const mecha = 1 + (sorteioFixo(i % seg, j) - 0.5) * 0.22 * (1 - t ** 3);
      const k = (1 - escurecePonta * t * t) * mecha;
      cores.push(k, k, k);
    }
  }
  const linha = seg + 1;
  for (let j = 0; j < aneis; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * linha + i + 1;
      const b = j * linha + i;
      const c = (j + 1) * linha + i;
      const d = (j + 1) * linha + i + 1;
      if (j > 0) idx.push(a, b, d);
      idx.push(b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  g.setIndex(idx);
  return finalizar(g, new THREE.Vector3(0, CRANIO.y - 0.03, CRANIO.z));
}

// Bolinha de cachos: icosaedro com normais de esfera (parece redondo com só 20 triângulos)
function bolinha(raio) {
  const g = new THREE.IcosahedronGeometry(raio, 0);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  comCor(g, (x, y, z) => 0.78 + 0.22 * (y / raio));
  return g; // a textura de cachos (um cantinho do atlas da aparência) cobre a bolinha inteira
}

function finalizarCachos(g) {
  g.computeBoundingSphere();
  return g;
}

// Cachos espalhados pela superfície do cabelo (de t0 a t1), com tamanhos variados
function cachosNoMapa(ponto, n, raio, { t0 = 0.15, t1 = 1, filtro = null, afundar = 0.35 } = {}) {
  const partes = [];
  const ouro = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < n; k++) {
    const t = t0 + (t1 - t0) * Math.sqrt((k + 0.5) / n);
    const phi = (k * ouro) % (Math.PI * 2);
    if (filtro && !filtro(phi, t)) continue;
    const r = raio * (0.8 + 0.4 * sorteioFixo(k, 3));
    const q = ponto(phi, t, r * (1 - afundar) - r);
    partes.push([bolinha(r), matriz(q.x, q.y, q.z, k, k * 2, k * 3)]);
  }
  return partes;
}

// Crista do moicano: faixa no meio da cabeça, da testa até o alto da nuca, mais alta na frente
function crista(folga, largura = 0.3, alturaMax = 0.04) {
  const g = new THREE.SphereGeometry(1, 16, 5, -82 * GRAUS, 130 * GRAUS, Math.PI / 2 - largura, 2 * largura);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getY(i);
    const y = -p.getX(i);
    const z = p.getZ(i);
    const phi = (-82 + uv.getX(i) * 130) * GRAUS;   // 0 = alto da cabeça, + = para a testa
    const meio = 1 - (x / Math.sin(largura)) ** 2;   // 1 no meio da crista, 0 nas beiradas
    const h = (0.01 + alturaMax * Math.exp(-((((phi / GRAUS) - 25) / 50) ** 2))) * Math.max(0, meio) ** 0.55;
    const q = pontoCabeca(x, y, z, folga + h + 0.004 * relevo(x, y, z, 22) * meio);
    p.setXYZ(i, q.x, q.y, q.z);
    uv.setXY(i, ...uvDaDirecao(x, y, z));
  }
  comCor(g, (x, y, z) => 0.85 + 0.15 * sorteioFixo(Math.round(z * 300), Math.round(x * 300)));
  return finalizar(g, new THREE.Vector3(0, CRANIO.y, CRANIO.z));
}

// folga: { frente, tras } (m da pele): encostada na testa e por cima do cabelo atrás
function geoFaixa(folga) {
  const seg = 24;
  const aneis = [[-6.5, 0], [0, 0.004], [6.5, 0]]; // [graus em volta do meio da faixa, folga a mais]
  const pos = [];
  const idx = [];
  for (const [dg, f] of aneis) {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = Math.sin(a);
      const z = Math.cos(a);
      const theta = anguloFaixa(x, z) + dg * GRAUS;
      const k = suave((1 - Math.cos(a)) / 1.2);
      const q = pontoCabeca(x * Math.sin(theta), Math.cos(theta), z * Math.sin(theta), misturar(folga.frente, folga.tras, k) + f);
      pos.push(q.x, q.y, q.z);
    }
  }
  for (let j = 0; j < aneis.length - 1; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      idx.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  comCor(g, (x, y) => (y < CRANIO.y + 0.03 ? 0.85 : 1));
  return finalizar(g, new THREE.Vector3(0, CRANIO.y, CRANIO.z));
}

// Cortes de cabelo. couro: o cabelo raspado pintado na pele (raspado e os lados do moicano e do topete):
// linha do cabelo (graus a partir do alto), densidade (0 a 1) e borda (graus de esfumado). Os outros cortes
// têm casca (parametrosCabelo) e a raiz é pintada pelo mesmo mapa da casca.
// Cortes com variações (cabelo.corte no elenco; sem ele, cada jogador ganha uma fixa):
//   curto: 'frente' (franja para a frente) | 'lado' (risca de lado) | 'arrepiado'
//   medio: 'franja' (anos 80, franja cheia) | 'repartido' (anos 70, risca de lado e volume nos lados)
const CORTES = { curto: ['frente', 'lado', 'arrepiado'], medio: ['franja', 'repartido'] };
const ESTILOS_CABELO = {
  careca: {},
  raspado: { couro: { linha: { frente: 46, lado: 92, tras: 136 }, densidade: 0.66, borda: 3 } },
  topete: { couro: { linha: { frente: 45, lado: 92, tras: 134 }, densidade: 0.72, borda: 3 } },
  moicano: { couro: { linha: { frente: 47, lado: 90, tras: 132 }, densidade: 0.58, borda: 3 } },
  curto: {}, medio: {}, longo: {}, cacheado: {}, cacheadoLongo: {}, volumoso: {},
};

// Escolhe a variação do corte: a do elenco (cabelo.corte) ou uma fixa para cada jogador
function corteDoCabelo(v) {
  const opcoes = CORTES[v.cabelo.estilo];
  if (!opcoes) return '';
  if (opcoes.includes(v.cabelo.corte)) return v.cabelo.corte;
  const chave = `${v.cabelo.cor}${v.pele}${v.altura}${v.porte}`;
  let h = 2254;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  return opcoes[h % opcoes.length];
}

// Folga da faixa (m da pele) na testa e atrás, por cima do cabelo apertado por ela
const FAIXA_FOLGA = {
  cacheadoLongo: { frente: 0.004, tras: 0.019 }, cacheado: { frente: 0.004, tras: 0.014 },
  longo: { frente: 0.003, tras: 0.012 }, medio: { frente: 0.006, tras: 0.016 },
  volumoso: { frente: 0.006, tras: 0.025 }, curto: { frente: 0.003, tras: 0.011 },
};

// Parâmetros de cada corte com casca: opções do mapa (mapaCabelo), resolução, cachos e o tipo de fio pintado
function parametrosCabelo(estilo, corte, comFaixa, preso = false) {
  switch (estilo) {
    case 'curto':
      return {
        fios: corte === 'arrepiado' ? 'curtos' : 'fios', seg: 18, aneis: 8,
        mapa: {
          linha: { frente: corte === 'frente' ? 50 : 45, lado: 94, tras: 136 },
          base: 0.011, topo: corte === 'arrepiado' ? 0.012 : 0.008, borda: 10,
          frenteTopo: corte === 'frente' ? 0.007 : 0.004,
          ondas: corte === 'arrepiado' ? { amplitude: 0.011, frequencia: 17 } : { amplitude: 0.005, frequencia: 15 },
          ruido: corte === 'frente' ? (phi, ax, az) => Math.max(0, az) * 4 * Math.abs(Math.sin(phi * 20)) + 1.5 * Math.sin(phi * 31)
            : (phi) => 1.5 * Math.sin(phi * 29),
          // Risca do lado direito e volume penteado para a esquerda
          volumeExtra: corte === 'lado'
            ? (x, y, z) => 0.006 * Math.max(0, x + 0.2) * Math.max(0, y) - 0.006 * sino(x + 0.42, 0.07) * Math.max(0, y) * Math.max(0, z + 0.3)
            : null,
          faixa: comFaixa,
        },
      };
    case 'topete':
      // Lados bem curtos (pintados) e volume em cima, penteado para cima e para trás na frente
      return {
        fios: 'fios', seg: 18, aneis: 8,
        mapa: {
          linha: { frente: 44, lado: 72, tras: 96 }, base: 0.009, topo: 0.018, borda: 6,
          volumeExtra: (x, y, z) => 0.034 * Math.max(0, z + 0.15) ** 1.4 * sino(y - 0.72, 0.32) * sino(x, 0.6),
          ondas: { amplitude: 0.005, frequencia: 13 },
          ruido: (phi) => 2 * Math.sin(phi * 23),
        },
      };
    case 'medio':
      return {
        fios: 'fios', seg: 20, aneis: 10,
        mapa: corte === 'franja' ? {
          // Anos 80: franja cheia e desfiada na testa, cobre metade das orelhas, nuca até a gola
          linha: { frente: 62, lado: 108, tras: 146 },
          base: 0.016, topo: 0.014, lados: 0.004, borda: 10,
          ondas: { amplitude: 0.008, frequencia: 12 },
          caida: { inicio: 102, comprimento: 0.06, abre: 0.05 },
          ruido: (phi, ax, az) => Math.max(0, az) * 5 * Math.abs(Math.sin(phi * 14)) + Math.max(0, -az) * 5 * Math.sin(phi * 11),
          faixa: comFaixa,
        } : {
          // Anos 70: risca do lado direito, penteado para a esquerda, cobre as orelhas, volume nos lados
          linha: { frente: 51, lado: 112, tras: 158 },
          base: 0.014, topo: 0.009, lados: 0.006, borda: 10,
          ondas: { amplitude: 0.009, frequencia: 7 },
          caida: { inicio: 100, comprimento: 0.085, abre: 0.05, paraTras: 0.04 },
          ruido: (phi, ax, az) => 6 * Math.max(0, ax) * Math.max(0, az) + Math.max(0, -az + 0.2) * 7 * Math.sin(phi * 9),
          volumeExtra: (x, y, z) => 0.009 * Math.max(0, x + 0.15) * Math.max(0, y)
            - 0.008 * sino(x + 0.36, 0.06) * Math.max(0, y) * Math.max(0, z + 0.25),
          faixa: comFaixa,
        },
      };
    case 'longo':
      // Preso: puxado para trás, rente à cabeça, com um rabo curto na nuca
      if (preso) {
        return {
          fios: 'fios', seg: 18, aneis: 8, rabo: true,
          mapa: {
            linha: { frente: 46, lado: 98, tras: 140 }, base: 0.008, topo: 0.004, borda: 8,
            ondas: { amplitude: 0.003, frequencia: 9 },
            ruido: (phi) => 1.2 * Math.sin(phi * 27),
            volumeExtra: (x, y, z) => 0.007 * sino(z + 0.8, 0.35) * sino(y - 0.42, 0.3),
          },
        };
      }
      // Comprido até os ombros, repartido no meio, atrás das orelhas
      return {
        fios: 'fios', seg: 20, aneis: 11, escurecePonta: 0.12,
        mapa: {
          linha: { frente: 47, lado: 104, tras: 168 }, base: 0.013, topo: 0.006, lados: 0.004, borda: 8,
          ondas: { amplitude: 0.004, frequencia: 9 },
          caida: { inicio: 96, comprimento: 0.16, abre: 0.12, paraTras: 0.12 }, pontaSolta: true,
          ruido: (phi, ax, az) => Math.max(0, -az + 0.3) * 6 * Math.sin(phi * 9),
          volumeExtra: (x, y, z) => -0.006 * sino(x, 0.06) * Math.max(0, y) * Math.max(0, z + 0.2),
          faixa: comFaixa,
        },
      };
    case 'cacheado':
      // Cachos curtos: casca com relevo e bolinhas na beirada e em cima
      return {
        fios: 'cachos', seg: 18, aneis: 9,
        mapa: {
          linha: { frente: 44, lado: 96, tras: 128 }, base: 0.016, topo: 0.01, borda: 7,
          ondas: { amplitude: 0.018, frequencia: 13 }, faixa: comFaixa,
          ruido: (phi) => 3 * Math.sin(phi * 17),
        },
        cachos: { n: 8, raio: 0.021, t0: 0.3, afundar: 0.5, filtro: comFaixa ? (phi, t) => Math.abs(t - 0.62) > 0.1 : null },
      };
    case 'cacheadoLongo':
      // Cachos grandes e compridos (descem pela nuca até os ombros), presos pela faixa na testa
      return {
        fios: 'cachos', seg: 20, aneis: 10, escurecePonta: 0.15,
        mapa: {
          linha: { frente: 47, lado: 116, tras: 166 }, base: 0.024, topo: 0.016, lados: 0.012, borda: 7,
          ondas: { amplitude: 0.022, frequencia: 11 },
          caida: { inicio: 96, comprimento: 0.13, abre: 0.38, paraTras: 0.05 }, pontaSolta: true,
          ruido: (phi, ax, az) => Math.max(0, -az + 0.4) * 9 * Math.sin(phi * 11) + 2.5 * Math.sin(phi * 23),
          faixa: comFaixa,
        },
        cachos: { n: 12, raio: 0.028, t0: 0.6, afundar: 0.45, filtro: (phi, t) => Math.sin(phi) < 0.35 && (!comFaixa || t > 0.62) },
      };
    case 'volumoso':
      // Volume grande e redondo (anos 70/80), cachos que descem até a nuca
      return {
        fios: 'cachos', seg: 20, aneis: 10,
        mapa: {
          linha: { frente: 50, lado: 112, tras: 146 }, base: 0.03, topo: 0.03, lados: 0.012, borda: 9,
          ondas: { amplitude: 0.026, frequencia: 9 },
          caida: { inicio: 102, comprimento: 0.05, abre: 0.4 },
          ruido: (phi) => 3 * Math.sin(phi * 15),
          faixa: comFaixa,
        },
        cachos: { n: 6, raio: 0.027, t0: 0.65, afundar: 0.55 },
      };
    default:
      return null;
  }
}

// Rabo de cabelo (cabelo comprido preso): o nó atrás do alto da cabeça e o cabelo caindo até a nuca
function geoRabo(fino) {
  const seg = fino ? 8 : 6;
  const no = pontoCabeca(0, 0.42, -0.9, 0.004);
  // [para baixo, para trás, raio] a partir do nó
  const caminho = [[0.006, 0.004, 0.0001], [0.002, -0.012, 0.02], [-0.02, -0.03, 0.026], [-0.062, -0.04, 0.024], [-0.112, -0.034, 0.017], [-0.15, -0.026, 0.0001]];
  const pos = [];
  const uv = [];
  const cores = [];
  const idx = [];
  caminho.forEach(([dy, dz, r], k) => {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(no.x + r * Math.cos(a), no.y + dy, no.z + dz + 0.85 * r * Math.sin(a));
      uv.push(i / seg, 1 - k / (caminho.length - 1));
      const tom = 0.82 + 0.18 * sorteioFixo(i % seg, 5) - 0.12 * (k / (caminho.length - 1));
      cores.push(tom, tom, tom);
    }
  });
  const linha = seg + 1;
  for (let k = 0; k < caminho.length - 1; k++) {
    for (let i = 0; i < seg; i++) {
      const a = k * linha + i;
      idx.push(a, a + linha, a + 1, a + 1, a + linha, a + linha + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  g.setIndex(idx);
  return finalizar(g);
}

// Partes do cabelo de cada estilo: [{ geometria, tipo, avesso }]. tipo: 'casca' (usa a pintura do rosto e do
// couro cabeludo), 'cachos' (bolinhas com a textura de cachos) ou 'liso' (rabo de cabelo, na cor do cabelo).
// avesso: a casca também é vista por dentro (cabelo que cai solto). preso: o comprido preso atrás.
// fino: false = menos triângulos (visto de longe).
function geoCabelo(estilo, corte, comFaixa, preso = false, fino = true) {
  return peca(`cabelo:${estilo}:${corte}:${comFaixa ? 1 : 0}:${preso ? 1 : 0}:${fino ? 1 : 0}`, () => {
    if (estilo === 'moicano') return [{ geometria: crista(0.003, 0.4, 0.024), tipo: 'casca' }];
    const p = parametrosCabelo(estilo, corte, comFaixa, preso);
    if (!p) return []; // careca e raspado: pintados na pele da cabeça
    const ponto = mapaCabelo(p.mapa);
    const seg = fino ? p.seg : Math.max(10, 2 * Math.round(p.seg * 0.3));
    const aneis = fino ? p.aneis : Math.max(5, Math.round(p.aneis * 0.65));
    const partes = [{ geometria: cascaCabelo(ponto, seg, aneis, { escurecePonta: p.escurecePonta || 0 }), tipo: 'casca', avesso: !!p.mapa.caida }];
    if (p.cachos) {
      const c = p.cachos;
      partes.push({
        geometria: finalizarCachos(fundir(cachosNoMapa(ponto, fino ? c.n : Math.ceil(c.n * 0.6), c.raio, { t0: c.t0, afundar: c.afundar, filtro: c.filtro || null }))),
        tipo: 'cachos',
      });
    }
    if (p.rabo) partes.push({ geometria: geoRabo(fino), tipo: 'liso' });
    return partes;
  });
}

// ---------- Barbas ----------
// Onde cada barba cobre o rosto (0 a 1), por az (graus em volta, 0 = frente) e pol (graus do alto)
function coberturaBarba(estilo, az, pol) {
  const a = Math.abs(az);
  const dentro = (v, a0, a1, s) => suave((v - a0) / s) * suave((a1 - v) / s);
  const labios = suave((1 - (a / 13) ** 2 - ((pol - 121.4) / 3.8) ** 2) / 0.35);
  const bigode = dentro(a, -99, 21, 4) * dentro(pol, 107.5, 117.5, 2.5);
  const cantos = dentro(a, 13, 27, 3) * dentro(pol, 110, 134, 4);
  const queixo = dentro(a, -99, 30, 7) * dentro(pol, 126, 174, 5);
  const linhaBochecha = 111 - 16 * limitar((a - 18) / 72, 0, 1);
  const mandibula = dentro(a, 16, 88, 6) * dentro(pol, linhaBochecha, 174, 7);
  switch (estilo) {
    case 'cheia':
    case 'rala':
      return Math.max(bigode, cantos, queixo, mandibula) * (1 - labios);
    case 'bigode':
      // Bigodão anos 70: grosso, descendo nos cantos da boca
      return Math.max(dentro(a, -99, 24, 4) * dentro(pol, 106, 118, 2.5), dentro(a, 15, 25, 3) * dentro(pol, 110, 126, 3)) * (1 - labios);
    case 'cavanhaque':
      return Math.max(bigode, cantos * 0.9, dentro(a, -99, 21, 5) * dentro(pol, 126, 162, 5)) * (1 - labios);
    default:
      return 0;
  }
}
const ESPESSURA_BARBA = { cheia: 0.008, bigode: 0.0065, cavanhaque: 0.0065 };

// Rosto e couro cabeludo: pele com variação de tom, olhos, sobrancelhas, boca, barba rala e a raiz do
// cabelo (ou o cabelo raspado) pintados. A textura dá a volta na cabeça como a esfera do THREE.
const ROSTO_W = 512;
const ROSTO_H = 256;
const ROSTO_N = ROSTO_W * ROSTO_H;

// Tom dos fios pintados (0 a 1): 'fios' (compridos, seguem do alto para baixo), 'curtos' ou 'cachos'
let mapaCachos = null;
function cachoNoPixel(px, py) {
  if (!mapaCachos) {
    // Cachos espalhados (as bordas dão a volta): cada um é um domo de 3 a 7 px
    mapaCachos = new Float32Array(ROSTO_N).fill(0.18);
    let semente = 11;
    const r = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 2600; k++) {
      const cx = r() * ROSTO_W;
      const cy = r() * ROSTO_H;
      const raio = 3 + r() * 4;
      const tom = 0.7 + 0.3 * r();
      for (let dy = -Math.ceil(raio); dy <= raio; dy++) {
        const y = Math.round(cy + dy);
        if (y < 0 || y >= ROSTO_H) continue;
        for (let dx = -Math.ceil(raio); dx <= raio; dx++) {
          const d2 = (dx * dx + dy * dy) / (raio * raio);
          if (d2 >= 1) continue;
          const x = ((Math.round(cx + dx) % ROSTO_W) + ROSTO_W) % ROSTO_W;
          const i = y * ROSTO_W + x;
          mapaCachos[i] = Math.max(mapaCachos[i], tom * (1 - d2) ** 0.6);
        }
      }
    }
  }
  const x = ((Math.round(px) % ROSTO_W) + ROSTO_W) % ROSTO_W;
  const y = limitar(Math.round(py), 0, ROSTO_H - 1);
  return mapaCachos[y * ROSTO_W + x];
}

function tomDoFio(tipo, px, py) {
  if (tipo === 'cachos') return cachoNoPixel(px, py);
  const x = px * (tipo === 'curtos' ? 1.4 : 0.95) + 2.5 * Math.sin(py * 0.045 + Math.floor(px / 23));
  const i = Math.floor(x);
  const f = x - i;
  const n = misturar(sorteioFixo(i, 7), sorteioFixo(i + 1, 7), f * f * (3 - 2 * f));
  const lento = 0.5 + 0.5 * Math.sin(py * (tipo === 'curtos' ? 0.35 : 0.11) + sorteioFixo(Math.floor(px / 9), 3) * 6);
  return n * (0.7 + 0.3 * lento);
}
const noRosto = (az, pol) => [(0.25 + az / 360) * ROSTO_W, (pol / 180) * ROSTO_H];

// Tabelas compartilhadas da pintura do rosto (calculadas uma vez, de 0 a 255): ruído, rosado das
// bochechas, tom dos fios de cada tipo, cobertura de cada barba e a crista do moicano. Assim cada rosto
// novo só mistura cores (rápido, sem travar o celular quando a barreira é montada).
const tabelasRosto = new Map();
function tabelaRosto(nome, f) {
  let t = tabelasRosto.get(nome);
  if (!t) {
    t = new Uint8Array(ROSTO_N);
    for (let py = 0; py < ROSTO_H; py++) {
      const pol = ((py + 0.5) / ROSTO_H) * 180;
      for (let px = 0; px < ROSTO_W; px++) {
        const u = (px + 0.5) / ROSTO_W;
        let azg = (u - 0.25) * 360;
        if (azg > 180) azg -= 360;
        t[py * ROSTO_W + px] = limitar(Math.round(f(px, py, u, azg, pol) * 255), 0, 255);
      }
    }
    tabelasRosto.set(nome, t);
  }
  return t;
}
const tabRuido = () => tabelaRosto('ruido', (px, py) => sorteioFixo(px, py));
const tabRuido2 = () => tabelaRosto('ruido2', (px, py) => sorteioFixo(px * 3.1, py * 1.7));
const tabRosado = () => tabelaRosto('rosado', (px, py, u, azg, pol) =>
  (0.07 * sino(Math.abs(azg) - 32, 14) * sino(pol - 100, 10) + 0.04 * sino(azg, 9) * sino(pol - 102, 8)) / 0.12);
const tabFios = (tipo) => tabelaRosto(`fios:${tipo}`, (px, py) => tomDoFio(tipo, px, py));
const tabBarbaCachos = () => tabelaRosto('barbaCachos', (px, py) => 0.35 + 0.65 * tomDoFio('cachos', px * 1.7, py * 1.7));
const tabBarba = (estilo) => tabelaRosto(`barba:${estilo}`, (px, py, u, azg, pol) => coberturaBarba(estilo, azg, pol));
const tabCrista = () => tabelaRosto('crista', (px, py, u, azg, pol) => {
  const th = pol * GRAUS;
  const phi = u * Math.PI * 2;
  const sx = -Math.cos(phi) * Math.sin(th);
  const ang = Math.atan2(Math.sin(phi) * Math.sin(th), Math.cos(th)) / GRAUS; // 0 = alto, + = para a testa
  return suave((0.36 - Math.abs(sx)) / 0.05) * suave((49 - ang) / 3) * suave((ang + 80) / 4);
});

// Pinta o rosto e o couro cabeludo na metade de cima do atlas da aparência. e: escala (1 = 512 px de largura;
// 0,5 = textura pequena, dos jogadores vistos de longe: a conta por pixel é feita em um quarto dos pontos).
function pintarRosto(ctx, r, e = 1) {
  const W = ROSTO_W;
  const H = ROSTO_H;
  const w = Math.round(W * e);
  const h = Math.round(H * e);
  const pele = rgb255(r.pele);
  const cabelo = rgb255(r.cabelo);
  const barba = rgb255(r.barba);
  const raspado = rgb255(r.corRaspado || r.cabelo);
  const parametros = parametrosCabelo(r.estilo, r.corte, r.comFaixa, r.preso);
  const casca = parametros ? mapaCabelo(parametros.mapa) : null;
  const tipoFio = parametros ? parametros.fios : 'fios';
  const brilhoFio = (tipoFio === 'cachos' ? 30 : 42) * (1 - luminancia(r.cabelo) * 0.6);
  const ruido = tabRuido();
  const ruido2 = tabRuido2();
  const rosado = tabRosado();
  const fios = tabFios(tipoFio);
  const crista = r.estilo === 'moicano' ? tabCrista() : null;
  const cob = r.estiloBarba ? tabBarba(r.estiloBarba) : null;
  const rala = r.estiloBarba === 'rala';
  const pelos = cob && !rala ? tabBarbaCachos() : null;
  // Por coluna (direção em volta da cabeça): linha do cabelo raspado e da casca, e as costeletas
  const limR = new Float32Array(w);
  const limC = new Float32Array(w);
  const cost = new Float32Array(w);
  for (let px = 0; px < w; px++) {
    const u = (px + 0.5) / w;
    const phi = u * Math.PI * 2;
    let azg = (u - 0.25) * 360;
    if (azg > 180) azg -= 360;
    cost[px] = sino(Math.abs(azg) - 80, 6);
    if (r.raspado) limR[px] = limiteCabelo(r.raspado.linha, -Math.cos(phi), Math.sin(phi)) / GRAUS;
    if (casca) limC[px] = casca.limite(phi);
  }
  const img = ctx.createImageData(w, h);
  const dados = img.data;
  const passo = W / w;
  for (let py = 0; py < h; py++) {
    const pol = ((py + 0.5) / h) * 180;
    const linhaTabela = Math.min(H - 1, Math.floor((py + 0.5) * passo)) * W;
    for (let px = 0; px < w; px++) {
      const i = linhaTabela + Math.min(W - 1, Math.floor((px + 0.5) * passo));
      // Pele: leve variação de tom; bochechas, nariz e orelhas um pouco mais rosados
      const n0 = 1 + 0.025 * (ruido[i] / 255 - 0.5);
      const ros = (rosado[i] / 255) * 0.12;
      let c0 = pele[0] * n0 * (1 + ros * 0.6);
      let c1 = pele[1] * n0 * (1 - ros * 0.25);
      let c2 = pele[2] * n0 * (1 - ros * 0.3);
      // Cabelo raspado (raspado, lados do moicano e do topete): pontinhos na cor do cabelo
      if (r.raspado) {
        const lim = limR[px] + cost[px] * (pol < 104 ? 14 : 0);
        const k = suave((lim - pol + 1.5) / r.raspado.borda) * r.raspado.densidade * (0.55 + 0.45 * (ruido2[i] / 255));
        if (k > 0) {
          c0 = misturar(c0, raspado[0], k);
          c1 = misturar(c1, raspado[1], k);
          c2 = misturar(c2, raspado[2], k);
        }
      }
      // Cabelo embaixo da casca (e nela mesma): fios ou cachos até a linha do cabelo, beirada suave
      let kCabelo = 0;
      if (casca) {
        const lim = limC[px] + cost[px] * Math.max(0, 104 - limC[px]) * (pol < 106 ? 1 : 0);
        kCabelo = suave((lim - pol + 1) / 3);
      }
      if (crista) kCabelo = Math.max(kCabelo, crista[i] / 255);
      if (kCabelo > 0) {
        const n = fios[i] / 255;
        const brilho = Math.max(0, n - 0.78) * 4 * brilhoFio;
        c0 = misturar(c0, cabelo[0] * (0.62 + 0.48 * n) + brilho, kCabelo);
        c1 = misturar(c1, cabelo[1] * (0.62 + 0.48 * n) + brilho, kCabelo);
        c2 = misturar(c2, cabelo[2] * (0.62 + 0.48 * n) + brilho * 0.95, kCabelo);
      }
      // Barba: rala (pontinhos) ou cheia (pelos encaracolados)
      if (cob && cob[i] > 0) {
        const c = cob[i] / 255;
        const k = c * (rala ? 0.42 * (0.45 + 0.55 * (ruido2[i] / 255)) : 0.95);
        const n = pelos ? pelos[i] / 255 : 1;
        c0 = misturar(c0, barba[0] * (0.7 + 0.4 * n), k);
        c1 = misturar(c1, barba[1] * (0.7 + 0.4 * n), k);
        c2 = misturar(c2, barba[2] * (0.7 + 0.4 * n), k);
      }
      const j = (py * w + px) * 4;
      dados[j] = c0;
      dados[j + 1] = c1;
      dados[j + 2] = c2;
      dados[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Os traços do rosto são desenhados nas medidas da textura grande
  ctx.save();
  ctx.scale(e, e);

  // Olhos: sombra da órbita, branco, íris, pupila, brilho e pálpebra de cima
  const escura = pele.map((c) => Math.round(c * 0.45));
  for (const s of [-1, 1]) {
    const [x, y] = noRosto(s * 21.5, 86);
    let g = ctx.createRadialGradient(x, y - 2, 2, x, y - 2, 26);
    g.addColorStop(0, css(escura, 0.32));
    g.addColorStop(1, css(escura, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 28, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Branco do olho (amêndoa)
    ctx.fillStyle = '#ece5da';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 0.5);
    ctx.quadraticCurveTo(x - 2 * s, y - 8, x + 14, y - 0.5 * s);
    ctx.quadraticCurveTo(x + 1 * s, y + 7, x - 14, y + 0.5);
    ctx.fill();
    // Íris e pupila (olhando para a frente)
    const ix = x + s * 0.5;
    ctx.fillStyle = r.olhos;
    ctx.beginPath();
    ctx.arc(ix, y, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d0907';
    ctx.beginPath();
    ctx.arc(ix, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(ix - 1.6, y - 1.8, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Pálpebra de cima (cílios) e a dobra acima dela
    ctx.strokeStyle = '#1e140f';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 1);
    ctx.quadraticCurveTo(x - 2 * s, y - 9, x + 15, y - 1);
    ctx.stroke();
    ctx.strokeStyle = css(escura, 0.35);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 5);
    ctx.quadraticCurveTo(x - 2 * s, y - 13, x + 12, y - 5);
    ctx.stroke();
    ctx.strokeStyle = css(escura, 0.3);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 11, y + 3);
    ctx.quadraticCurveTo(x, y + 7, x + 12, y + 2);
    ctx.stroke();
    // Sobrancelha: grossa por dentro, fina por fora, com um arco
    const [x0, y0] = noRosto(s * 8, 76.5);
    const [x1, y1] = noRosto(s * 26, 73.5);
    const [x2, y2] = noRosto(s * 38, 77.5);
    ctx.fillStyle = r.sobrancelha;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 4.5 * r.grossura);
    ctx.quadraticCurveTo(x1, y1 + 3 * r.grossura, x2, y2 + 1);
    ctx.quadraticCurveTo(x1, y1 - 3.5 * r.grossura, x0, y0 - 3.5 * r.grossura);
    ctx.closePath();
    ctx.fill();
  }
  // Boca: lábio de cima mais escuro, de baixo com brilho, e a linha da boca
  const comBarba = r.estiloBarba && r.estiloBarba !== 'rala';
  const labio = pele.map((c, i) => Math.round((c * 0.78 + [150, 60, 55][i] * 0.22 * (pele[0] > 150 ? 1 : 0.5)) * (comBarba ? 0.82 : 1)));
  const [bx, by] = noRosto(0, 121);
  const lw = comBarba ? 16 : 21; // meia largura da boca (px)
  ctx.fillStyle = css(labio, 0.95);
  ctx.beginPath();
  ctx.moveTo(bx - lw, by);
  ctx.quadraticCurveTo(bx - lw * 0.43, by - 7, bx, by - 4);
  ctx.quadraticCurveTo(bx + lw * 0.43, by - 7, bx + lw, by);
  ctx.quadraticCurveTo(bx, by + 1.5, bx - lw, by);
  ctx.fill();
  ctx.fillStyle = css(labio.map((c) => Math.min(255, c * 1.06)), 0.9);
  ctx.beginPath();
  ctx.moveTo(bx - lw * 0.9, by + 0.5);
  ctx.quadraticCurveTo(bx, by + (comBarba ? 8 : 10), bx + lw * 0.9, by + 0.5);
  ctx.quadraticCurveTo(bx, by + 2, bx - lw * 0.9, by + 0.5);
  ctx.fill();
  ctx.strokeStyle = css(pele.map((c) => c * 0.3), 0.85);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(bx - lw, by);
  ctx.quadraticCurveTo(bx, by + 2.2, bx + lw, by);
  ctx.stroke();
  // Sombra embaixo do lábio de baixo e no sulco acima da boca
  let g = ctx.createRadialGradient(bx, by + 13, 1, bx, by + 13, 16);
  g.addColorStop(0, css(escura, 0.22));
  g.addColorStop(1, css(escura, 0));
  ctx.fillStyle = g;
  ctx.fillRect(bx - 20, by + 2, 40, 24);
  g = ctx.createLinearGradient(bx, by - 18, bx, by - 5);
  g.addColorStop(0, css(escura, 0));
  g.addColorStop(1, css(escura, 0.12));
  ctx.fillStyle = g;
  ctx.fillRect(bx - 4, by - 18, 8, 13);
  // Bem embaixo (dentro do pescoço): pele lisa, usada pelo nariz e pelas orelhas
  ctx.fillStyle = css(pele);
  ctx.fillRect(0, H - 8, W, 8);
  ctx.restore();
}


// ---------- Pintura: ajudantes ----------
// As camadas de detalhe (dobras do tecido, músculos da pele) são pintadas uma vez só, em tons de cinza: cinza
// médio não muda nada, mais escuro escurece, mais claro clareia. Cada textura nova só pinta as cores e põe a
// camada por cima (mistura 'hard-light'): rápido, e todos os times dividem as mesmas dobras.
const CINZA = 128;
function novaCamada() {
  const [canvas, ctx] = novoCanvas(ATLAS, ATLAS);
  ctx.fillStyle = `rgb(${CINZA},${CINZA},${CINZA})`;
  ctx.fillRect(0, 0, ATLAS, ATLAS);
  return [canvas, ctx];
}
// Mancha macia (elipse com degradê): força > 0 clareia, < 0 escurece
function mancha(ctx, x, y, rx, ry, forca, giro = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (giro) ctx.rotate(giro);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  const c = forca > 0 ? '255,255,255' : '0,0,0';
  const a = Math.abs(forca);
  g.addColorStop(0, `rgba(${c},${a})`);
  g.addColorStop(0.55, `rgba(${c},${a * 0.5})`);
  g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}
// Dobra de tecido de (x0, y0) a (x1, y1): um vinco escuro e largo com a crista um pouco mais clara ao lado
function dobra(ctx, x0, y0, x1, y1, largura, forca = 0.2) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const comp = Math.hypot(dx, dy);
  if (comp < 1) return;
  const g = ctx.createLinearGradient(0, -largura, 0, largura);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.28, `rgba(255,255,255,${forca * 0.3})`);
  g.addColorStop(0.5, 'rgba(128,128,128,0)');
  g.addColorStop(0.72, `rgba(0,0,0,${forca})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  // As pontas somem aos poucos
  const pontas = ctx.createLinearGradient(0, 0, comp, 0);
  pontas.addColorStop(0, 'rgba(0,0,0,0)');
  pontas.addColorStop(0.3, 'rgba(0,0,0,1)');
  pontas.addColorStop(0.7, 'rgba(0,0,0,1)');
  pontas.addColorStop(1, 'rgba(0,0,0,0)');
  const [aux, cx] = novoCanvas(Math.ceil(comp), Math.ceil(largura * 2));
  cx.translate(0, largura);
  cx.fillStyle = g;
  cx.fillRect(0, -largura, comp, largura * 2);
  cx.globalCompositeOperation = 'destination-in';
  cx.fillStyle = pontas;
  cx.fillRect(0, -largura, comp, largura * 2);
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.drawImage(aux, 0, -largura);
  ctx.restore();
}

// Pinta dentro de uma região do atlas (com a folga em volta): o que passar da beirada é cortado
function naRegiao(ctx, R, pintar) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
  ctx.clip();
  pintar();
  ctx.restore();
}
// Linha de costura: tracinho escuro fino
function costura(ctx, pontos, forca = 0.22, grossura = 1.2) {
  ctx.save();
  ctx.strokeStyle = `rgba(0,0,0,${forca})`;
  ctx.lineWidth = grossura;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${forca * 0.5})`;
  ctx.lineWidth = grossura * 0.8;
  ctx.beginPath();
  pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x + 1.2, y + 1.2) : ctx.moveTo(x + 1.2, y + 1.2)));
  ctx.stroke();
  ctx.restore();
}
// Sorteio fixo para a pintura (as camadas saem sempre iguais)
function sorteioPintura(semente) {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
// Chuvisco de tecido (tramado): cinza médio com pontinhos
let tramaCanvas = null;
function trama() {
  if (!tramaCanvas) {
    const [canvas, ctx] = novoCanvas(64, 64);
    const img = ctx.createImageData(64, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const k = CINZA + 9 * (sorteioFixo(x, y) - 0.5) - 3 * ((x + y) % 2) + 1.5;
        const i = (y * 64 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = limitar(Math.round(k), 0, 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    tramaCanvas = canvas;
  }
  return tramaCanvas;
}

// Lugar de um ponto da camisa no atlas (pixels): u dá a volta, y é a altura acima da cintura
const xCamisa = (u) => RET.camisa.x + u * RET.camisa.w;
const yCamisaPx = (y) => RET.camisa.y + (1 - vCamisa(y)) * RET.camisa.h;
// Dentro de um retângulo do atlas (pixels): u, v de 0 a 1 (v = 1 em cima)
const pxRet = (ret, u, v) => [ret.x + u * ret.w, ret.y + (1 - v) * ret.h];

// Medidas da camisa para a pintura (porte normal, detalhe alto): onde ficam as dobras dos ombros na textura,
// quantos metros vale a volta nas costas e na frente, e o u de um ponto da frente pelo x
const medidasPintura = (() => {
  let m = null;
  return () => {
    if (!m) {
      const det = DETALHES.alto;
      const { u, col } = mapaCamisa(det);
      const larguraPorU = (y, i0, i1) => {
        const k = contornoCamisa(y, MEDIDAS_NORMAL, det);
        let comp = 0;
        for (let i = i0 + 1; i <= i1; i++) {
          const a = k.pontos[i - 1];
          const b = k.pontos[i];
          comp += Math.hypot(b.R * b.cs - a.R * a.cs, b.R * b.sn - a.R * a.sn);
        }
        return comp / (u[i1] - u[i0]);
      };
      // u do ponto da frente com esse x (m; + = esquerda do jogador)
      const uDaFrente = (x, y) => {
        const k = contornoCamisa(y, MEDIDAS_NORMAL, det);
        for (let i = col.iDF + 1; i <= col.iEF; i++) {
          const xa = k.pontos[i - 1].R * k.pontos[i - 1].cs;
          const xb = k.pontos[i].R * k.pontos[i].cs;
          if (x >= xa && x <= xb) return misturar(u[i - 1], u[i], (x - xa) / ((xb - xa) || 1));
        }
        return 0.25;
      };
      m = {
        u, col,
        metrosCostas: (y) => larguraPorU(y, col.iET, col.iDT),
        metrosFrente: (y) => larguraPorU(y, col.iDF, col.iEF),
        uDaFrente,
        dobras: [u[col.iDF], u[col.iEF], u[col.iET], u[col.iDT]],
      };
    }
    return m;
  };
})();

// ---------- Camada de detalhe do uniforme (dobras, costuras e tramado), igual para todos os times ----------
let camadaTecidoCanvas = null;
function camadaTecido() {
  if (camadaTecidoCanvas) return camadaTecidoCanvas;
  const [canvas, ctx] = novaCamada();
  const M = medidasPintura();
  const r = sorteioPintura(7);
  // Tramado em tudo
  ctx.fillStyle = ctx.createPattern(trama(), 'repeat');
  ctx.fillRect(0, 0, ATLAS, ATLAS);

  // --- Camisa ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(RET.camisa.x, RET.camisa.y, RET.camisa.w, RET.camisa.h);
  ctx.clip();
  const X = xCamisa;
  const Y = yCamisaPx;
  // (cada desenho é repetido uma volta para os dois lados: a textura dá a volta no corpo)
  const voltas = (f) => { for (const d of [-1, 0, 1]) { ctx.save(); ctx.translate(d * RET.camisa.w, 0); f(); ctx.restore(); } };
  voltas(() => {
    // Volume: peitoral, sulco da coluna, omoplatas e a curva da lombar
    mancha(ctx, X(0.25 - 0.055), Y(0.3), 36, 22, 0.05);
    mancha(ctx, X(0.25 + 0.055), Y(0.3), 36, 22, 0.05);
    mancha(ctx, X(0.25), Y(0.2), 90, 26, -0.05);
    mancha(ctx, X(0.75), Y(0.2), 10, 64, -0.08);
    mancha(ctx, X(0.75 - 0.065), Y(0.33), 32, 26, 0.06);
    mancha(ctx, X(0.75 + 0.065), Y(0.33), 32, 26, 0.06);
    mancha(ctx, X(0.75), Y(0.04), 70, 20, -0.06);
    // Lados do corpo, embaixo dos braços
    for (const u of [0, 0.5]) mancha(ctx, X(u), Y(0.2), 26, 70, -0.12);
    // Dobras da axila: saem da axila para o meio do peito e das costas, e para baixo
    for (const [u0, s] of [[M.dobras[0], 1], [M.dobras[1], -1], [M.dobras[2], 1], [M.dobras[3], -1]]) {
      const x0 = X(u0);
      const y0 = Y(0.315);
      dobra(ctx, x0, y0, x0 + s * 46, y0 + 36, 10, 0.16);
      dobra(ctx, x0 + s * 2, y0 + 4, x0 + s * 30, y0 + 62, 11, 0.14);
      dobra(ctx, x0 - s * 2, y0 + 6, x0 + s * 8, y0 + 80, 11, 0.12);
      dobra(ctx, x0 + s * 6, y0 - 6, x0 + s * 54, y0 + 8, 9, 0.1);
    }
    // Dobras da cintura: curtas, quase deitadas, mais fortes nos lados e atrás
    for (let k = 0; k < 18; k++) {
      const u = k / 18 + 0.02 * (r() - 0.5);
      const lado = Math.abs(Math.cos(2 * Math.PI * u));       // 1 nos lados, 0 na frente e atrás
      const y = 0.0 + 0.11 * r() - 0.03;
      const comp = 34 + 34 * r();
      const inclina = (r() - 0.5) * 16 + (u % 0.5 < 0.25 ? -5 : 5);
      dobra(ctx, X(u) - comp / 2, Y(y) - inclina / 2, X(u) + comp / 2, Y(y) + inclina / 2, 8 + 4 * r(), 0.08 + 0.08 * lado + 0.04 * r());
    }
    // Barra: a camisa solta faz ondas
    for (let k = 0; k < 9; k++) {
      const u = (k + 0.5 * r()) / 9;
      dobra(ctx, X(u), Y(-0.02), X(u) + 6 * (r() - 0.5), Y(-0.105), 12, 0.09 + 0.05 * r());
    }
    // Costuras: lados do corpo, ombros (em volta da cava) e barra
    costura(ctx, [[X(0.5), Y(0.3)], [X(0.5), Y(-0.105)]], 0.12);
    costura(ctx, [[X(0), Y(0.3)], [X(0), Y(-0.105)]], 0.12);
    for (const [u0, s] of [[M.dobras[0], -1], [M.dobras[1], 1], [M.dobras[2], -1], [M.dobras[3], 1]]) {
      costura(ctx, [[X(u0), Y(0.325)], [X(u0 + s * 0.004), Y(0.4)], [X(u0 + s * 0.02), Y(0.44)], [X(u0 + s * 0.045), Y(0.452)]], 0.13);
    }
    costura(ctx, [[X(-1), Y(-0.09)], [X(2), Y(-0.09)]], 0.16);
    // Sombra logo abaixo da gola
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(X(-1), Y(0.474), 3 * RET.camisa.w, 5);
  });
  ctx.restore();

  // --- Manga ---
  naRegiao(ctx, RET.manga, () => {
    const R = RET.manga;
    // Lado de dentro (as duas beiradas da textura) mais escuro; dobras caindo do ombro
    mancha(ctx, R.x, R.y + R.h / 2, 26, R.h, -0.14);
    mancha(ctx, R.x + R.w, R.y + R.h / 2, 26, R.h, -0.14);
    dobra(ctx, R.x + R.w * 0.36, R.y + 6, R.x + R.w * 0.28, R.y + R.h - 14, 10, 0.13);
    dobra(ctx, R.x + R.w * 0.62, R.y + 10, R.x + R.w * 0.72, R.y + R.h - 20, 11, 0.12);
    dobra(ctx, R.x + R.w * 0.5, R.y + 30, R.x + R.w * 0.47, R.y + R.h - 8, 9, 0.08);
    dobra(ctx, R.x + R.w * 0.14, R.y + 40, R.x + R.w * 0.2, R.y + R.h - 10, 9, 0.1);
    dobra(ctx, R.x + R.w * 0.86, R.y + 36, R.x + R.w * 0.8, R.y + R.h - 12, 9, 0.1);
    costura(ctx, [[R.x - 20, R.y + R.h - 10], [R.x + R.w + 20, R.y + R.h - 10]], 0.16);
  });

  // --- Calção ---
  naRegiao(ctx, RET.calcao, () => {
    const R = RET.calcao;
    // Dobras em pé, caindo do quadril; leque de dobras no meio da frente; entre as pernas mais escuro
    for (let k = 0; k < 12; k++) {
      const u = (k + 0.3 + 0.4 * r()) / 12;
      const [x0, y0] = pxRet(R, u, 0.78 - 0.1 * r());
      const [x1, y1] = pxRet(R, u + 0.012 * (r() - 0.5), 0.04);
      dobra(ctx, x0, y0, x1, y1, 10 + 4 * r(), 0.09 + 0.07 * r());
    }
    for (const s of [-1, 1]) {
      const [x0, y0] = pxRet(R, 0.5, 0.62);
      dobra(ctx, x0 + s * 2, y0, x0 + s * 30, y0 - 12, 8, 0.13);
      dobra(ctx, x0 + s * 3, y0 + 6, x0 + s * 26, y0 + 12, 8, 0.11);
      const [xb, yb] = pxRet(R, s > 0 ? 0.985 : 0.015, 0.5);
      dobra(ctx, xb, yb - 4, xb - s * 26, yb + 20, 9, 0.11);
    }
    for (const u of [0, 0.5, 1]) {
      const [x, y] = pxRet(R, u, 0.3);
      mancha(ctx, x, y, 18, R.h * 0.42, -0.18);
    }
    // Costuras dos lados e a barra
    for (const u of [0.25, 0.75]) costura(ctx, [pxRet(R, u, 0.95), pxRet(R, u, 0)], 0.1);
    costura(ctx, [[R.x - 20, R.y + R.h * 0.955], [R.x + R.w + 20, R.y + R.h * 0.955]], 0.16);
  });
  // Lado de dentro das pernas
  naRegiao(ctx, RET.calcaoDentro, () => {
    const D = RET.calcaoDentro;
    mancha(ctx, D.x + D.w / 2, D.y + D.h * 0.2, D.w, D.h * 0.6, -0.22);
  });

  // --- Meião: canelado em pé, dobra de cima, caneleira marcando na frente, tornozelo ---
  naRegiao(ctx, RET.meiao, () => {
    const R = RET.meiao;
    for (let x = R.x - FOLGA; x < R.x + R.w + FOLGA; x += 3.4) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x, R.y - FOLGA, 1.2, R.h + 2 * FOLGA);
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fillRect(x + 1.6, R.y - FOLGA, 1, R.h + 2 * FOLGA);
    }
    const vDobra = 1 - 0.034 / 0.389;
    const [, yd] = pxRet(R, 0, vDobra);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(R.x - FOLGA, yd, R.w + 2 * FOLGA, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(R.x - FOLGA, yd - 2.5, R.w + 2 * FOLGA, 2);
    // Caneleira: relevo leve na frente (u = 0,25)
    const [xc, yc] = pxRet(R, 0.25, 1 - 0.14 / 0.389);
    mancha(ctx, xc, yc, 14, 30, 0.08);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(xc, yc, 12, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Panturrilha (atrás, u = 0,75): luz na barriga, sombra dos lados do tendão
    const [xp, yp] = pxRet(R, 0.75, 1 - 0.1 / 0.389);
    mancha(ctx, xp, yp, 17, 24, 0.07);
    const [xt, yt] = pxRet(R, 0.75, 1 - 0.3 / 0.389);
    mancha(ctx, xt - 9, yt, 5, 20, -0.13);
    mancha(ctx, xt + 9, yt, 5, 20, -0.13);
    // Rugas do tornozelo
    for (let k = 0; k < 4; k++) {
      const [, y] = pxRet(R, 0, 0.16 - k * 0.035);
      dobra(ctx, R.x - FOLGA, y, R.x + R.w + FOLGA, y + 2 * (r() - 0.5), 4.5, 0.12);
    }
  });

  // --- Luva: dedos e a tira do punho ---
  naRegiao(ctx, RET.luva, () => {
    const R = RET.luva;
    for (const u of [0.42, 0.5, 0.58, 0.92, 0.0, 0.08, 1.0]) {
      const [x0, y0] = pxRet(R, u, 0.5);
      const [x1, y1] = pxRet(R, u, 0.02);
      costura(ctx, [[x0, y0], [x1, y1]], 0.3, 1.4);
    }
    const [, yp] = pxRet(R, 0, 0.9);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(R.x - FOLGA, yp, R.w + 2 * FOLGA, 3);
  });
  camadaTecidoCanvas = canvas;
  return canvas;
}

// ---------- Padrões da camisa ----------
const ALTURA_FAIXA = [0.205, 0.315];  // faixa do peito (São Paulo)
// Faixa diagonal (Vasco): do ombro direito (a) ao quadril esquerdo (b); ombro: até onde ela vai para o lado
const SASH = { a: [-0.16, 0.47], b: [0.165, -0.085], largura: 0.092, ombro: 0.2 };
const V_PEITO = { ombro: 0.15, topo: 0.475, ponta: 0.2, largura: 0.07 };
const FAIXA_VERTICAL = { meia: 0.046, filete: 0.012 }; // m: meia largura da faixa do meio e largura de cada filete

// Faixa diagonal e V num ponto da camisa: y (altura) e x (posição de lado, vista de frente).
// Devolve 1 dentro da faixa e 0 fora (a borda lisa sai da média de vários pontos por pixel).
function padraoNoPonto(padrao, y, x) {
  if (padrao === 'diagonal') {
    if (Math.abs(x) > SASH.ombro) return 0; // não desce pela manga
    const [ax, ay] = SASH.a;
    const [bx, by] = SASH.b;
    const lx = bx - ax;
    const ly = by - ay;
    const dist = Math.abs(lx * (y - ay) - ly * (x - ax)) / Math.hypot(lx, ly);
    return dist < SASH.largura / 2 ? 1 : 0;
  }
  if (padrao === 'v') {
    const { ombro, topo, ponta, largura } = V_PEITO;
    let melhor = Infinity;
    for (const s of [-1, 1]) {
      // Segmento do ombro até a ponta do V (vale na frente e atrás: só depende de x e y)
      const ax = s * ombro;
      const lx = -ax;
      const ly = ponta - topo;
      const t = limitar(((x - ax) * lx + (y - topo) * ly) / (lx * lx + ly * ly), 0, 1);
      melhor = Math.min(melhor, Math.hypot(x - (ax + lx * t), y - (topo + ly * t)));
    }
    return melhor < largura / 2 ? 1 : 0;
  }
  return 0;
}

// Máscara (canvas com transparência) da faixa diagonal ou do V na textura da camisa: cada pixel sabe onde
// fica no corpo (pela mesma conta da malha). Calculada uma vez por padrão.
const mascaras = new Map();
function mascaraPadrao(padrao) {
  let m = mascaras.get(padrao);
  if (!m) {
    const W = RET.camisa.w;
    const H = RET.camisa.h;
    const S = 3; // pontos por pixel em cada direção (borda lisa)
    const [canvas, ctx] = novoCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const det = DETALHES.alto;
    const { u } = mapaCamisa(det);
    const N = u.length - 1;
    // Em que coluna da malha cai cada ponto da largura
    const coluna = new Float32Array(W * S);
    for (let k = 0, i = 1; k < W * S; k++) {
      const up = (k + 0.5) / (W * S);
      while (i < N && u[i] < up) i++;
      coluna[k] = i - 1 + (up - u[i - 1]) / ((u[i] - u[i - 1]) || 1);
    }
    const soma = new Uint16Array(W);
    for (let py = 0; py < H; py++) {
      soma.fill(0);
      for (let sy = 0; sy < S; sy++) {
        const y = yDaCamisa(1 - (py + (sy + 0.5) / S) / H);
        const k = contornoCamisa(y, MEDIDAS_NORMAL, det);
        const xs = k.pontos.map((p) => p.R * p.cs);
        for (let q = 0; q < W * S; q++) {
          const f = coluna[q];
          const i0 = Math.min(N - 1, Math.floor(f));
          soma[Math.floor(q / S)] += padraoNoPonto(padrao, y, misturar(xs[i0], xs[i0 + 1], f - i0));
        }
      }
      for (let px = 0; px < W; px++) {
        const i = (py * W + px) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round((soma[px] / (S * S)) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    mascaras.set(padrao, (m = canvas));
  }
  return m;
}

// Cores que aparecem atrás do número (para decidir o contorno)
function coresAtras(uni, y0, y1, costas) {
  const lista = [uni.camisa];
  if (uni.padrao === 'listras' || uni.padrao === 'aros') lista.push(uni.cores[0]);
  if (uni.padrao === 'faixa' && y1 > ALTURA_FAIXA[0] && y0 < ALTURA_FAIXA[1]) lista.push(...uni.cores);
  if (uni.padrao === 'diagonal') lista.push(uni.cores[0]);
  if (uni.padrao === 'v' && (costas ? y1 > V_PEITO.ponta : true)) lista.push(uni.cores[0]);
  return lista;
}
// Contorno do texto quando ele não se destaca de alguma cor do fundo
function contornoPara(cor, fundos, minimo = 3.2) {
  const pior = Math.min(...fundos.map((f) => contraste(cor, f)));
  if (pior >= minimo) return null;
  return contraste(cor, '#111111') >= contraste(cor, '#ffffff') ? '#111111' : '#ffffff';
}

function texturaUniforme(uni) {
  const [canvas, ctx] = novoCanvas(ATLAS, ATLAS);
  const M = medidasPintura();
  ctx.fillStyle = uni.camisa;
  ctx.fillRect(0, 0, ATLAS, ATLAS);

  // --- Camisa ---
  {
    const R = RET.camisa;
    const X = xCamisa;
    const Y = yCamisaPx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, R.y, R.w, R.h + FOLGA);
    ctx.clip();
    ctx.fillStyle = uni.cores[0] || uni.camisa;
    switch (uni.padrao) {
      case 'listras': {
        // 16 faixas na volta (8 listras), uma listra bem no meio da frente e das costas
        const n = 16;
        for (let k = 0; k < n; k += 2) {
          const x0 = ((0.25 - 0.5 / n + k / n) % 1) * R.w;
          ctx.fillRect(x0, 0, R.w / n, R.h + FOLGA);
          if (x0 + R.w / n > R.w) ctx.fillRect(x0 - R.w, 0, R.w / n, R.h + FOLGA);
        }
        break;
      }
      case 'aros': {
        const h = 0.058;
        for (let y = -0.1 + h; y < 0.5; y += 2 * h) ctx.fillRect(0, Y(y + h), R.w, Y(y) - Y(y + h));
        break;
      }
      case 'faixa': {
        const [y0, y1] = ALTURA_FAIXA;
        const n = uni.cores.length;
        uni.cores.forEach((cor, i) => {
          const a = y1 - ((y1 - y0) * i) / n;
          const b = y1 - ((y1 - y0) * (i + 1)) / n;
          ctx.fillStyle = cor;
          ctx.fillRect(0, Y(a), R.w, Y(b) - Y(a));
        });
        break;
      }
      case 'faixaVertical': {
        // Faixa do meio do peito, de cima a baixo, com um filete de cada lado (só na frente)
        const porMetro = R.w / M.metrosFrente(0.2);
        const meia = FAIXA_VERTICAL.meia * porMetro;
        const filete = FAIXA_VERTICAL.filete * porMetro;
        ctx.fillStyle = uni.cores[1] || uni.numero;
        ctx.fillRect(X(0.25) - meia - filete, 0, 2 * (meia + filete), R.h + FOLGA);
        ctx.fillStyle = uni.cores[0];
        ctx.fillRect(X(0.25) - meia, 0, 2 * meia, R.h + FOLGA);
        break;
      }
      case 'diagonal':
      case 'v': {
        // Máscara da faixa (só depende do formato do corpo): pinta a cor nela e põe por cima
        const [tinta, ctxTinta] = novoCanvas(R.w, R.h);
        ctxTinta.drawImage(mascaraPadrao(uni.padrao), 0, 0);
        ctxTinta.globalCompositeOperation = 'source-in';
        ctxTinta.fillStyle = uni.cores[0];
        ctxTinta.fillRect(0, 0, R.w, R.h);
        ctx.drawImage(tinta, R.x, R.y);
        break;
      }
      default:
        break;
    }
    // Gola: faixa em cima e um V cheio na frente; uma linha clara/escura embaixo se ela some no padrão
    const yGola = Y(0.47);
    const yV = Y(0.412);
    const meio = X(0.25);
    const aberta = 0.034 * R.w;
    const fundosGola = [uni.camisa, ...(uni.padrao === 'liso' ? [] : uni.cores)];
    const golaSome = Math.min(...fundosGola.map((f) => contraste(uni.gola, f))) < 1.5;
    const caminhoGola = (folga) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(R.w, 0);
      ctx.lineTo(R.w, yGola + folga);
      ctx.lineTo(meio + aberta + folga, yGola + folga);
      ctx.lineTo(meio, yV + folga * 1.6);
      ctx.lineTo(meio - aberta - folga, yGola + folga);
      ctx.lineTo(0, yGola + folga);
      ctx.closePath();
    };
    if (golaSome) {
      ctx.fillStyle = claro(uni.gola) ? 'rgba(20,20,20,0.45)' : 'rgba(255,255,255,0.5)';
      caminhoGola(1.5);
      ctx.fill();
    }
    ctx.fillStyle = uni.gola;
    caminhoGola(0);
    ctx.fill();
    // Barra (faixa fina embaixo, que continua pela beirada de dentro)
    ctx.fillStyle = corMisturada(uni.gola, uni.camisa, 0.15);
    ctx.fillRect(0, Y(-0.095), R.w, R.h + FOLGA - Y(-0.095));
    // Escudo genérico no peito esquerdo
    const yEscudo = Y(0.33);
    const xEscudo = X(M.uDaFrente(0.083, 0.33));
    const corEscudo = distanciaCor(uni.gola, uni.camisa) > 60 ? uni.gola : (claro(uni.camisa) ? '#1b1b1b' : '#f2f2f2');
    ctx.fillStyle = corEscudo;
    ctx.beginPath();
    ctx.moveTo(xEscudo - 8, yEscudo - 10);
    ctx.lineTo(xEscudo + 8, yEscudo - 10);
    ctx.lineTo(xEscudo + 8, yEscudo + 2);
    ctx.lineTo(xEscudo, yEscudo + 11);
    ctx.lineTo(xEscudo - 8, yEscudo + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = claro(corEscudo) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // --- Manga: o padrão continua (listras e aros) e o punho na ponta ---
  naRegiao(ctx, RET.manga, () => {
    const R = RET.manga;
    const y0 = R.y - FOLGA;
    const h = R.h + 2 * FOLGA;
    ctx.fillStyle = uni.camisa;
    ctx.fillRect(R.x - FOLGA, y0, R.w + 2 * FOLGA, h);
    if (uni.padrao === 'listras') {
      ctx.fillStyle = uni.cores[0];
      for (let k = 0; k < 3; k++) ctx.fillRect(R.x + ((k / 3) + 0.5 / 3) * R.w - R.w / 12, y0, R.w / 6, h);
    } else if (uni.padrao === 'aros') {
      ctx.fillStyle = uni.cores[0];
      for (let k = 0; k < 4; k += 2) ctx.fillRect(R.x - FOLGA, R.y + (k / 4) * R.h - (k ? 0 : FOLGA), R.w + 2 * FOLGA, R.h / 4 + (k ? 0 : FOLGA));
    }
    ctx.fillStyle = uni.gola;
    ctx.fillRect(R.x - FOLGA, R.y + R.h - 8, R.w + 2 * FOLGA, 8 + FOLGA);
    if (contraste(uni.gola, uni.camisa) < 1.4) {
      ctx.fillStyle = claro(uni.gola) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)';
      ctx.fillRect(R.x - FOLGA, R.y + R.h - 9.5, R.w + 2 * FOLGA, 1.5);
    }
  });

  // --- Calção: listra dos lados na cor da gola (quando aparece) ---
  {
    const R = RET.calcao;
    const D = RET.calcaoDentro;
    ctx.fillStyle = uni.calcao;
    ctx.fillRect(R.x - FOLGA, R.y - FOLGA, D.x + D.w - R.x + 2 * FOLGA, R.h + 2 * FOLGA);
    const corListra = [uni.gola, uni.camisa, uni.numero].find((cor) => distanciaCor(cor, uni.calcao) > 70);
    if (corListra) {
      naRegiao(ctx, R, () => {
        ctx.fillStyle = corListra;
        for (const u of [0.25, 0.75]) {
          const [x] = pxRet(R, u, 0);
          ctx.fillRect(x - 4.5, R.y - FOLGA, 9, R.h + 2 * FOLGA);
        }
        ctx.fillRect(R.x - FOLGA, R.y + R.h - 4, R.w + 2 * FOLGA, 4 + FOLGA);
      });
      // A barra continua do lado de dentro das pernas
      ctx.fillStyle = corListra;
      ctx.fillRect(D.x - FOLGA, D.y + D.h - 4, D.w + 2 * FOLGA, 4 + FOLGA);
    }
  }

  // --- Meião: listras na dobra de cima; o pé um pouco mais escuro ---
  naRegiao(ctx, RET.meiao, () => {
    const R = RET.meiao;
    ctx.fillStyle = uni.meiao;
    ctx.fillRect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
    ctx.fillStyle = uni.faixaMeiao;
    const faixa = (d0, d1) => {
      const [, a] = pxRet(R, 0, 1 - d0 / 0.389);
      const [, b] = pxRet(R, 0, 1 - d1 / 0.389);
      ctx.fillRect(R.x - FOLGA, a, R.w + 2 * FOLGA, Math.max(1.6, b - a));
    };
    faixa(0.008, 0.016);
    faixa(0.022, 0.03);
    const [, y0] = pxRet(R, 0, 0.14);
    const g = ctx.createLinearGradient(0, y0, 0, R.y + R.h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = g;
    ctx.fillRect(R.x - FOLGA, y0, R.w + 2 * FOLGA, R.y + R.h + FOLGA - y0);
  });

  // --- Luva (goleiro) ---
  naRegiao(ctx, RET.luva, () => {
    const R = RET.luva;
    const cor = uni.luvas || '#f2f2f2';
    ctx.fillStyle = cor;
    ctx.fillRect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
    // Palma em outro tom e a tira do punho
    ctx.fillStyle = claro(cor) ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(R.x - FOLGA, R.y - FOLGA, R.w * 0.22 + FOLGA, R.h + 2 * FOLGA);
    ctx.fillRect(R.x + R.w * 0.8, R.y - FOLGA, R.w * 0.2 + FOLGA, R.h + 2 * FOLGA);
    ctx.fillStyle = claro(cor) ? '#222222' : '#f2f2f2';
    ctx.fillRect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, 5 + FOLGA);
  });

  // Dobras, costuras e tramado por cima de tudo
  ctx.globalCompositeOperation = 'hard-light';
  ctx.drawImage(camadaTecido(), 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return novaTextura(canvas);
}

// ---------- Número e nome: desenhados pelo material, por cima da camisa ----------
// Os dez algarismos ficam numa textura só para o jogo inteiro (vermelho = miolo, verde = miolo + contorno).
// Cada boneco diz ao material quais algarismos são os dele: bonecos do mesmo time dividem a textura do uniforme.
const ALG = { colunas: 8, linhas: 2, w: 64, h: 128, caixa: [0.78, 0.8] }; // célula e a parte dela que o algarismo ocupa
const FONTE = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
function texturaAlgarismos() {
  return textura('algarismos', () => {
    const [canvas, ctx] = novoCanvas(ALG.colunas * ALG.w, ALG.linhas * ALG.h);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const alturaLetra = ALG.h * ALG.caixa[1] - 12;      // sobra o contorno
    const larguraMax = ALG.w * ALG.caixa[0] - 10;
    ctx.font = `900 ${Math.round(alturaLetra / 0.716)}px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (let d = 0; d < 10; d++) {
      const cx = ((d % ALG.colunas) + 0.5) * ALG.w;
      const cy = (Math.floor(d / ALG.colunas) + 0.5) * ALG.h;
      const texto = String(d);
      const medida = ctx.measureText(texto);
      const alto = medida.actualBoundingBoxAscent || alturaLetra;
      const sx = Math.min(1, larguraMax / medida.width);
      const sy = alturaLetra / alto;
      ctx.save();
      ctx.translate(cx, cy + alturaLetra / 2);
      ctx.scale(sx, sy);
      ctx.lineWidth = 9 / Math.min(sx, sy);
      ctx.strokeStyle = '#00ff00';
      ctx.strokeText(texto, 0, 0);
      ctx.fillStyle = '#ffff00';
      ctx.fillText(texto, 0, 0);
      ctx.restore();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.anisotropy = 4;
    return t;
  });
}
// Nome nas costas (só o cobrador tem): textura pequena, com as letras em arco
const NOME = { w: 256, h: 64 };
function texturaNome(nome) {
  const [canvas, ctx] = novoCanvas(NOME.w, NOME.h);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, NOME.w, NOME.h);
  const texto = String(nome).toUpperCase();
  const altura = 30;
  ctx.font = `bold ${Math.round(altura / 0.72)}px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const letras = [...texto];
  const larguras = letras.map((l) => ctx.measureText(l).width + 2.5);
  const total = larguras.reduce((a, b) => a + b, 0);
  const sx = Math.min(1, (NOME.w - 22) / total);
  // Arco: as letras ficam num círculo grande (o meio do nome mais alto que as pontas)
  const raio = 330;
  const base = NOME.h - 9;
  let x = -(total * sx) / 2;
  letras.forEach((letra, i) => {
    const meio = x + (larguras[i] * sx) / 2;
    const ang = meio / raio;
    ctx.save();
    ctx.translate(NOME.w / 2 + raio * Math.sin(ang), base - 14 + raio * (1 - Math.cos(ang)));
    ctx.rotate(ang);
    ctx.scale(sx, 1);
    ctx.lineWidth = 7 / sx;
    ctx.strokeStyle = '#00ff00';
    ctx.strokeText(letra, 0, 0);
    ctx.fillStyle = '#ffff00';
    ctx.fillText(letra, 0, 0);
    ctx.restore();
    x += larguras[i] * sx;
  });
  const t = new THREE.CanvasTexture(canvas);
  t.anisotropy = 4;
  return t;
}

// Onde ficam o número das costas, o da frente, o do calção e o nome, na textura do uniforme: [u0, v0, largura,
// altura] (no atlas). Cada quadro tem o tamanho de dois algarismos lado a lado.
const quadrosDoNumero = (() => {
  let q = null;
  return () => {
    if (!q) {
      const M = medidasPintura();
      const proporcao = (2 * ALG.w * ALG.caixa[0]) / (ALG.h * ALG.caixa[1]); // largura / altura de dois algarismos
      const naCamisa = (u, y, altura, largura) => {
        const du = largura / (u > 0.5 ? M.metrosCostas(y) : M.metrosFrente(y));
        const [u0, v0] = noRetangulo(RET.camisa, u - du / 2, vCamisa(y - altura / 2));
        const [u1, v1] = noRetangulo(RET.camisa, u + du / 2, vCamisa(y + altura / 2));
        return new THREE.Vector4(u0, v0, u1 - u0, v1 - v0);
      };
      // Calção: na frente da perna esquerda (a volta do calção: 0,5 = meio da frente, 0,75 = lado esquerdo)
      const alturaCalcao = 0.075;
      const duCalcao = (alturaCalcao * proporcao) / 0.92;
      const yCalcao = PERNA_ALT - 0.2;
      const [c0, cv0] = noRetangulo(RET.calcao, 0.615 - duCalcao / 2, vCalcao(yCalcao - alturaCalcao / 2));
      const [c1, cv1] = noRetangulo(RET.calcao, 0.615 + duCalcao / 2, vCalcao(yCalcao + alturaCalcao / 2));
      q = {
        costas: naCamisa(0.75, 0.195, 0.22, 0.22 * proporcao),
        frente: naCamisa(M.uDaFrente(-0.083, 0.33), 0.33, 0.07, 0.07 * proporcao),
        calcao: new THREE.Vector4(c0, cv0, c1 - c0, cv1 - cv0),
        nome: naCamisa(0.75, 0.377, 0.076, 0.076 * (NOME.w / NOME.h)),
      };
    }
    return q;
  };
})();

// ---------- Material dos bonecos ----------
// Um material só para tudo (Phong com a textura do atlas). Dois acréscimos no shader do Three.js:
//   • o brilho de cada vértice vem no alfa da cor (pele e chuteira brilham; tecido, quase nada);
//   • o número e o nome são desenhados por cima da camisa (algarismos e quadros informados por boneco).
const VAZIO4 = new THREE.Vector4(0, 0, 0, 0);
const SHADER_PARS = /* glsl */ `
uniform sampler2D mapaAlgarismos;
uniform sampler2D mapaNome;
uniform vec4 quadroCostas;
uniform vec4 quadroFrente;
uniform vec4 quadroCalcao;
uniform vec4 quadroNome;
uniform vec3 algarismos;
uniform vec3 corNumero;
uniform vec3 corNumeroCalcao;
uniform vec4 corContorno;
#ifdef USE_MAP
// Cobertura (miolo, miolo + contorno) do número num quadro; q = posição no quadro, de 0 a 1
vec2 numeroNoQuadro( vec4 quadro ) {
  vec2 q = ( vMapUv - quadro.xy ) / quadro.zw;
  if ( q.y <= 0.0 || q.y >= 1.0 ) return vec2( 0.0 );
  float dois = step( 1.5, algarismos.z );
  float x = q.x * 2.0 - 0.5 * ( 1.0 - dois );       // um algarismo só fica no meio do quadro
  if ( x <= 0.0 || x >= 1.0 + dois ) return vec2( 0.0 );
  float qual = x < 1.0 ? algarismos.x : algarismos.y;
  vec2 celula = vec2( mod( qual, ${ALG.colunas}.0 ), floor( qual / ${ALG.colunas}.0 ) );
  vec2 dentro = vec2( fract( x ), q.y );
  vec2 caixa = vec2( ${ALG.caixa[0]}, ${ALG.caixa[1]} );
  vec2 tamanho = vec2( ${ALG.colunas}.0, ${ALG.linhas}.0 );
  vec2 uvA = ( celula + 0.5 + ( dentro - 0.5 ) * caixa ) / tamanho;
  uvA.y = 1.0 - ( celula.y + 0.5 - ( dentro.y - 0.5 ) * caixa.y ) / tamanho.y;
  vec2 escala = vec2( 2.0, 1.0 ) * caixa / tamanho;
  return textureGrad( mapaAlgarismos, uvA, dFdx( q ) * escala, dFdy( q ) * escala ).rg;
}
#endif
`;
const SHADER_NUMERO = /* glsl */ `
#ifdef USE_MAP
  if ( algarismos.z > 0.5 ) {
    vec2 nA = max( numeroNoQuadro( quadroCostas ), numeroNoQuadro( quadroFrente ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, corContorno.rgb, nA.g * corContorno.a );
    diffuseColor.rgb = mix( diffuseColor.rgb, corNumero, nA.r );
    vec2 nC = numeroNoQuadro( quadroCalcao );
    diffuseColor.rgb = mix( diffuseColor.rgb, corNumeroCalcao, nC.r );
  }
  if ( quadroNome.z > 0.0 ) {
    vec2 qn = ( vMapUv - quadroNome.xy ) / quadroNome.zw;
    if ( qn.x > 0.0 && qn.x < 1.0 && qn.y > 0.0 && qn.y < 1.0 ) {
      vec2 nN = texture2D( mapaNome, qn ).rg;
      diffuseColor.rgb = mix( diffuseColor.rgb, corContorno.rgb, nN.g * corContorno.a );
      diffuseColor.rgb = mix( diffuseColor.rgb, corNumero, nN.r );
    }
  }
#endif
`;
function compilarBoneco(shader) {
  Object.assign(shader.uniforms, this.userData.uniformes);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${SHADER_PARS}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\n${SHADER_NUMERO}`)
    .replace('#include <color_fragment>', 'diffuseColor.rgb *= vColor.rgb;')
    .replace('#include <specularmap_fragment>', 'float specularStrength = vColor.a;');
}
const chaveDoPrograma = () => 'boneco-etapa9';

// mapa: o atlas (uniforme ou aparência); cor: usada quando não há textura (no Node, sem tela)
function materialBoneco(mapa, cor = '#cccccc') {
  const m = new THREE.MeshPhongMaterial({
    map: mapa, color: new THREE.Color(mapa ? '#ffffff' : cor), vertexColors: true,
    shininess: 22, specular: new THREE.Color(0x505050),
  });
  m.userData.uniformes = {
    mapaAlgarismos: { value: null },
    mapaNome: { value: null },
    quadroCostas: { value: VAZIO4 },
    quadroFrente: { value: VAZIO4 },
    quadroCalcao: { value: VAZIO4 },
    quadroNome: { value: VAZIO4 },
    algarismos: { value: new THREE.Vector3(0, 0, 0) },
    corNumero: { value: new THREE.Color('#ffffff') },
    corNumeroCalcao: { value: new THREE.Color('#ffffff') },
    corContorno: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  m.onBeforeCompile = compilarBoneco;
  m.customProgramCacheKey = chaveDoPrograma;
  return m;
}

// Material do uniforme de UM boneco: o atlas do time (compartilhado), o número e o nome dele
function materialDoUniforme(uni, atlas, numero, mapaNome) {
  const m = materialBoneco(atlas, uni.camisa);
  if (!atlas) return m;
  const u = m.userData.uniformes;
  const q = quadrosDoNumero();
  const texto = numero === undefined || numero === null || numero === '' ? '' : String(Math.abs(Math.floor(Number(numero))) % 100);
  if (texto && !Number.isNaN(Number(texto))) {
    u.mapaAlgarismos.value = texturaAlgarismos();
    u.algarismos.value.set(Number(texto[0]), Number(texto[1] ?? 0), texto.length);
    u.quadroCostas.value = q.costas;
    u.quadroFrente.value = q.frente;
    u.quadroCalcao.value = q.calcao;
  }
  if (mapaNome) {
    u.mapaNome.value = mapaNome;
    u.quadroNome.value = q.nome;
  }
  u.corNumero.value.set(uni.numero);
  // Contorno quando o número some em alguma cor do fundo (camisa listrada, por exemplo)
  const contorno = contornoPara(uni.numero, coresAtras(uni, 0.085, 0.42, true));
  if (contorno) {
    const c = new THREE.Color(contorno);
    u.corContorno.value = new THREE.Vector4(c.r, c.g, c.b, 1);
  }
  // No calção o número troca de cor se não aparece
  const noCalcao = contraste(uni.numero, uni.calcao) >= 2.2 ? uni.numero
    : [uni.gola, uni.camisa].find((cor) => contraste(cor, uni.calcao) >= 2.2) || (claro(uni.calcao) ? '#111111' : '#ffffff');
  u.corNumeroCalcao.value.set(noCalcao);
  return m;
}

// ---------- Caches com contagem de uso ----------
// O que fica sem uso espera numa fila (até 'guardar' itens) antes de sair da memória: a barreira e os
// figurantes são refeitos a cada falta, quase sempre com as mesmas texturas.
function criarCacheContado(guardar, descartar) {
  const itens = new Map();
  const fila = [];
  return {
    pegar(chave, criar) {
      let item = itens.get(chave);
      if (!item) {
        item = { chave, valor: criar(), usos: 0 };
        itens.set(chave, item);
      }
      const i = fila.indexOf(item);
      if (i >= 0) fila.splice(i, 1);
      item.usos++;
      return item;
    },
    soltar(item) {
      item.usos--;
      if (item.usos > 0 || itens.get(item.chave) !== item) return;
      fila.push(item);
      while (fila.length > guardar) {
        const velho = fila.shift();
        itens.delete(velho.chave);
        descartar(velho.valor);
      }
    },
    numeros() {
      let emUso = 0;
      for (const item of itens.values()) if (item.usos > 0) emUso++;
      return { total: itens.size, emUso, guardados: fila.length };
    },
  };
}
// Uniformes: um atlas por time
const cacheUniformes = criarCacheContado(6, (v) => { if (v.mapa) v.mapa.dispose(); });
function pegarUniforme(uni) {
  const chave = JSON.stringify(uni);
  return cacheUniformes.pegar(chave, () => ({ mapa: temDocumento ? texturaUniforme(uni) : null }));
}

// ---------- Atlas da aparência: uma textura por jogador (rosto e cabelo, pele do corpo, chuteira) ----------

// Camada de detalhe da pele (igual para todos): cotovelo, joelho com a rótula e os tendões, dedos da mão
let camadaPeleCanvas = null;
function camadaPele() {
  if (camadaPeleCanvas) return camadaPeleCanvas;
  const [canvas, ctx] = novaCamada();
  // --- Braço: v = 1 em 0,125 m abaixo do ombro; v = 0 no punho (0,538 m). u: 0 = dentro, 0,25 = frente, 0,5 = fora, 0,75 = trás
  {
    const R = RET.braco;
    const P = (u, a) => pxRet(R, u, 1 - (a - 0.125) / 0.413);
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
    ctx.clip();
    let [x, y] = P(0.27, 0.19);
    mancha(ctx, x, y, 14, 30, 0.1);                     // bíceps
    [x, y] = P(0.25, 0.287);
    mancha(ctx, x, y, 16, 4, -0.22);                    // dobra de dentro do cotovelo
    [x, y] = P(0.75, 0.292);
    mancha(ctx, x, y, 9, 10, 0.12);                     // ponta do cotovelo
    mancha(ctx, x, y + 11, 12, 4, -0.16);
    mancha(ctx, x, y - 12, 12, 4, -0.1);
    [x, y] = P(0.57, 0.34);
    mancha(ctx, x, y, 12, 34, 0.09);                    // músculos do antebraço
    [x, y] = P(0.4, 0.4);
    mancha(ctx, x, y, 4, 44, -0.08);
    for (const u of [0.1, 0.19]) {                      // tendões do punho
      [x, y] = P(u, 0.49);
      mancha(ctx, x, y, 2.5, 20, 0.1);
    }
    [x, y] = P(0.15, 0.527);
    mancha(ctx, x, y, 20, 2.5, -0.2);                   // dobra do punho
    ctx.restore();
  }
  // --- Perna: v = 1 em 0,265 m acima do joelho; v = 0 em 0,088 m abaixo
  {
    const R = RET.perna;
    const P = (u, h) => pxRet(R, u, (h + 0.088) / 0.353);
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
    ctx.clip();
    let [x, y] = P(0.25, 0.006);
    mancha(ctx, x, y, 11, 19, 0.16);                    // rótula
    mancha(ctx, x - 13, y + 4, 5, 20, -0.2);            // sombras dos lados da rótula
    mancha(ctx, x + 13, y + 4, 5, 20, -0.2);
    mancha(ctx, x, y + 26, 9, 7, -0.18);                // embaixo da rótula
    mancha(ctx, x, y + 40, 6, 12, 0.08);                // tendão e a ponta da canela
    mancha(ctx, x, y - 30, 15, 9, -0.1);                // acima da rótula
    [x, y] = P(0.13, 0.075);
    mancha(ctx, x, y, 11, 32, 0.11);                    // vasto de dentro
    [x, y] = P(0.4, 0.13);
    mancha(ctx, x, y, 12, 50, 0.08);                    // vasto de fora
    [x, y] = P(0.26, 0.17);
    mancha(ctx, x, y, 4, 60, -0.07);                    // sulco entre os músculos da coxa
    [x, y] = P(0.75, 0.0);
    mancha(ctx, x, y, 17, 4, -0.26);                    // dobra de trás do joelho
    mancha(ctx, x, y - 10, 12, 9, -0.1);
    for (const u of [0.61, 0.9]) {                      // tendões de trás
      [x, y] = P(u, 0.03);
      mancha(ctx, x, y, 4, 34, 0.13);
    }
    [x, y] = P(0.75, 0.16);
    mancha(ctx, x, y, 5, 60, -0.07);                    // sulco de trás da coxa
    ctx.restore();
  }
  // --- Mão: u: 0 = meio da palma, 0,25 = frente (dedão), 0,5 = costas da mão, 0,75 = lado do mindinho; v = 1 no punho
  {
    const R = RET.mao;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
    ctx.clip();
    for (const u of [0.42, 0.5, 0.58, 0.08, 0.0, 1.0, 0.92]) {   // vãos entre os dedos (costas e palma)
      const [x0, y0] = pxRet(R, u, 0.5);
      const [x1, y1] = pxRet(R, u, 0.03);
      ctx.strokeStyle = 'rgba(0,0,0,0.42)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    for (const u of [0.38, 0.46, 0.54, 0.62]) {                   // nós dos dedos
      const [x, y] = pxRet(R, u, 0.5);
      mancha(ctx, x, y, 4, 5, 0.14);
      const [x2, y2] = pxRet(R, u, 0.27);
      mancha(ctx, x2, y2, 4, 2, -0.16);
    }
    const [xp, yp] = pxRet(R, 0.0, 0.7);
    mancha(ctx, xp, yp, 12, 16, -0.1);                            // palma
    mancha(ctx, xp + R.w, yp, 12, 16, -0.1);
    ctx.restore();
  }
  camadaPeleCanvas = canvas;
  return canvas;
}

// Chuteira: u dá a volta (0 = cadarço, 0,25 = lado de fora, 0,5 = sola, 0,75 = lado de dentro);
// v vai do calcanhar (0) ao bico (1). Cor da lenda, listras e sola na cor de contraste.
function pintarChuteira(ctx, cor) {
  const R = RET.chuteira;
  const escura = luminancia(cor) <= 0.35;
  const detalhe = escura ? '#f2f2f2' : '#1a1a1a';
  const P = (u, v) => pxRet(R, u, v);
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
  ctx.clip();
  ctx.fillStyle = cor;
  ctx.fillRect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
  // Luz de cima no couro: o peito do pé mais claro, perto da sola mais escuro
  for (const u of [0, 1]) {
    const [x, y] = P(u, 0.6);
    mancha(ctx, x, y, R.w * 0.14, R.h * 0.5, escura ? 0.16 : 0.1);
  }
  for (const u of [0.31, 0.69]) {
    const [x] = P(u, 0);
    const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    g.addColorStop(u < 0.5 ? 0 : 1, 'rgba(0,0,0,0)');
    g.addColorStop(u < 0.5 ? 1 : 0, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 10, R.y - FOLGA, 20, R.h + 2 * FOLGA);
  }
  // Sola com as travas
  const [xs0] = P(0.355, 0);
  const [xs1] = P(0.645, 0);
  ctx.fillStyle = corMisturada(cor, detalhe, escura ? 0.45 : 0.7);
  ctx.fillRect(xs0, R.y - FOLGA, xs1 - xs0, R.h + 2 * FOLGA);
  ctx.fillStyle = corMisturada(cor, detalhe, escura ? 0.75 : 0.95);
  for (const [u, v] of [[0.44, 0.1], [0.56, 0.1], [0.42, 0.5], [0.58, 0.5], [0.44, 0.74], [0.56, 0.73]]) {
    const [x, y] = P(u, v);
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Listras dos lados (três, inclinadas para trás)
  ctx.strokeStyle = detalhe;
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.2;
  for (const s of [1, -1]) {
    const lado = s > 0 ? 0.25 : 0.75;
    for (let k = 0; k < 3; k++) {
      const [x0, y0] = P(lado - s * 0.085, 0.5 + k * 0.085);
      const [x1, y1] = P(lado + s * 0.055, 0.36 + k * 0.085);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
  // Cadarço: lingueta e tracinhos cruzados no peito do pé
  for (const u of [0, 1]) {
    const [x, y0] = P(u, 0.68);
    const [, y1] = P(u, 0.36);
    ctx.fillStyle = corMisturada(cor, '#000000', 0.25);
    ctx.fillRect(x - 13, y0, 26, y1 - y0);
    ctx.strokeStyle = corMisturada(cor, detalhe, 0.8);
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const y = y0 + ((k + 0.5) * (y1 - y0)) / 6;
      ctx.beginPath();
      ctx.moveTo(x - 11, y - 2);
      ctx.lineTo(x + 11, y + 2);
      ctx.stroke();
    }
  }
  // Biqueira e contraforte do calcanhar (costuras), boca da chuteira
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.4;
  for (const v of [0.84, 0.17]) {
    ctx.beginPath();
    const [xa, ya] = P(0, v);
    const [xb, yb] = P(1, v);
    ctx.moveTo(xa, ya);
    ctx.lineTo(xb, yb);
    ctx.stroke();
  }
  const [, yCalc] = P(0, 0.17);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(R.x - FOLGA, yCalc, R.w + 2 * FOLGA, R.y + R.h - yCalc + FOLGA);
  ctx.fillStyle = corMisturada(cor, '#000000', 0.45);
  for (const u of [0, 1]) {
    const [x, y0] = P(u, 0.36);
    const [, y1] = P(u, 0.22);
    ctx.fillRect(x - 18, y0, 36, y1 - y0);
  }
  // Trava (as travas de verdade usam este cantinho)
  const [xt, yt] = P(0.5, 0.02);
  ctx.fillStyle = corMisturada(cor, detalhe, escura ? 0.75 : 0.95);
  ctx.fillRect(xt - 6, yt - 3, 12, 6);
  ctx.restore();
}

// Cachos (bolinhas na cor do cabelo), a faixa de cabelo e um cantinho de cabelo liso (rabo e coque)
function pintarCabelos(ctx, r) {
  const C = RET.cachos;
  ctx.save();
  ctx.beginPath();
  ctx.rect(C.x - FOLGA, C.y - FOLGA, C.w + 2 * FOLGA, C.h + 2 * FOLGA);
  ctx.clip();
  ctx.fillStyle = corMisturada(r.cabelo, '#000000', 0.3);
  ctx.fillRect(C.x - FOLGA, C.y - FOLGA, C.w + 2 * FOLGA, C.h + 2 * FOLGA);
  const sorteio = sorteioPintura(3);
  const clara = corMisturada(r.cabelo, '#ffffff', 0.16);
  for (let k = 0; k < 60; k++) {
    const x = C.x + sorteio() * C.w;
    const y = C.y + sorteio() * C.h;
    const raio = 4 + sorteio() * 5;
    const g = ctx.createRadialGradient(x - raio * 0.3, y - raio * 0.3, 0, x, y, raio);
    g.addColorStop(0, clara);
    g.addColorStop(0.6, r.cabelo);
    g.addColorStop(1, corMisturada(r.cabelo, '#000000', 0.45));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const F = RET.faixa;
  ctx.fillStyle = r.faixa || '#ffffff';
  ctx.fillRect(F.x - 5, F.y - 5, F.w + 10, F.h + 10);
  const L = RET.cabeloLiso;
  ctx.fillStyle = r.cabelo;
  ctx.fillRect(L.x - 5, L.y - 5, L.w + 10, L.h + 10);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = L.x - 5; x < L.x + L.w + 5; x += 3) ctx.fillRect(x, L.y - 5, 1, L.h + 10);
}

// tamanho: 512 (de perto) ou 256 (genéricos e figurantes, vistos de longe)
function texturaAparencia(r, tamanho) {
  const [canvas, ctx] = novoCanvas(tamanho, tamanho);
  const e = tamanho / ATLAS;
  ctx.fillStyle = r.pele;
  ctx.fillRect(0, 0, tamanho, tamanho);
  pintarRosto(ctx, r, e);
  ctx.save();
  ctx.scale(e, e);
  ctx.globalCompositeOperation = 'hard-light';
  ctx.drawImage(camadaPele(), 0, ROSTO_H, ATLAS, ATLAS - ROSTO_H, 0, ROSTO_H, ATLAS, ATLAS - ROSTO_H);
  ctx.globalCompositeOperation = 'source-over';
  pintarChuteira(ctx, r.chuteira);
  pintarCabelos(ctx, r);
  ctx.restore();
  return novaTextura(canvas);
}

// Aparências em uso: textura e material. As de perto (512) e as de longe (256) têm filas separadas.
const descartarAparencia = (v) => {
  if (v.mapa) v.mapa.dispose();
  v.material.dispose();
};
const cacheAparencias = { 512: criarCacheContado(6, descartarAparencia), 256: criarCacheContado(24, descartarAparencia) };
function pegarAparencia(r, tamanho) {
  const chave = JSON.stringify(r);
  return cacheAparencias[tamanho].pegar(chave, () => {
    const mapa = temDocumento ? texturaAparencia(r, tamanho) : null;
    return { mapa, material: materialBoneco(mapa, r.pele) };
  });
}

// Malha da pele de um jogador: braços, mãos, pernas, chuteiras, pescoço, cabeça e cabelo numa geometria só.
// Sai da memória junto com a fila (os cortes de cabelo e portes mais usados ficam).
const cacheCorpos = criarCacheContado(24, (g) => g.dispose());
function pegarCorpo(v, det, estilo, corte, comFaixa) {
  const goleiro = !!v.goleiro;
  const barba = ESPESSURA_BARBA[v.barba] ? v.barba : '';
  const preso = !!v.cabelo.preso && estilo === 'longo';
  const chave = `pele:${v.porte}:${v.coxas}:${goleiro ? 1 : 0}:${det.nome}:${barba}:${estilo}:${corte}:${comFaixa ? 1 : 0}:${preso ? 1 : 0}`;
  return cacheCorpos.pegar(chave, () => {
    const m = medidasDoCorpo(v.porte, v.coxas);
    const c = new Construtor();
    partesDoCorpo(c, m, det, goleiro);
    partePescoco(c, det);
    partesDaCabeca(c, det, MANDIBULA_PORTE[v.porte] ?? 0.5, barba, estilo, corte, comFaixa, preso);
    return c.geometria();
  });
}

// Cabeça, rosto e cabelo (as geometrias antigas, feitas no espaço da cabeça) entram na malha da pele
function partesDaCabeca(c, det, mand, barba, estilo, corte, comFaixa, preso) {
  const M = matriz(0, CABECA_Y, 0);
  const naCabeca = (u, v) => [u, 0.5 + 0.5 * limitar(v, 0.004, 1)];
  c.receber(geoCabeca(mand, barba, det.fino), { matriz: M, ossos: (x, y) => ossosDoPescoco(y), uv: naCabeca, brilho: BRILHO.pele });
  // Cabelo comprido: as pontas que passam da nuca encostam nas costas (seguem um pouco o tronco)
  const ossosDoCabelo = (x, y) => {
    const k = 0.75 * suave((CABECA_Y + 0.045 - y) / 0.09);
    return ossosDe(O.cabeca, 1 - k, O.tronco, k);
  };
  for (const parte of geoCabelo(estilo, corte, comFaixa, preso, det.fino)) {
    if (parte.tipo === 'cachos') {
      c.receber(parte.geometria, { matriz: M, ossos: ossosDoCabelo, uv: (u, v) => noRetangulo(RET.cachos, u, v), brilho: BRILHO.cabelo });
    } else if (parte.tipo === 'liso') {
      c.receber(parte.geometria, { matriz: M, ossos: ossosDoCabelo, uv: (u, v) => noRetangulo(RET.cabeloLiso, u, v), brilho: BRILHO.cabelo });
    } else {
      c.receber(parte.geometria, { matriz: M, ossos: ossosDoCabelo, uv: naCabeca, brilho: BRILHO.cabelo, avesso: !!parte.avesso });
    }
  }
  if (comFaixa) {
    const folga = FAIXA_FOLGA[estilo] ?? { frente: 0.004, tras: 0.012 };
    c.receber(peca(`faixa:${estilo}`, () => geoFaixa(folga)), { matriz: M, ossos: () => [O.cabeca, 1], uv: () => noRetangulo(RET.faixa, 0.5, 0.5), brilho: BRILHO.tecido });
  }
}

// ---------- Personagem ----------

const VISUAL_PADRAO = {
  pele: '#d9a57a', cabelo: { estilo: 'curto', cor: '#2a1d14' }, barba: 'nenhuma', corBarba: null,
  faixa: null, altura: 1.8, porte: 'normal', coxas: 'normais', chuteira: '#111111', goleiro: false,
};

function novoOsso(pai, nome, x, y, z, ordem = 'XZY') {
  const o = new THREE.Bone();
  o.name = nome;
  o.position.set(x, y, z);
  o.rotation.order = ordem;
  if (pai) pai.add(o);
  return o;
}

// Estilo de cabelo efetivo (cacheado com faixa = os cachos compridos do Bruxo)
function estiloEfetivo(v) {
  const e = v.cabelo.estilo || 'curto';
  if (e === 'cacheado' && (v.cabelo.comprimento === 'longo' || (v.faixa && v.cabelo.comprimento !== 'curto'))) return 'cacheadoLongo';
  return ESTILOS_CABELO[e] ? e : 'curto';
}

// O que define a textura da aparência de um jogador (rosto, cabelo, pele e chuteira)
function dadosDaAparencia(v, estilo, corte, comFaixa) {
  const corCabelo = v.cabelo.cor || '#2a1d14';
  const corBarba = v.corBarba || corCabelo;
  const loiro = luminancia(corCabelo) > 0.25;
  const sobrancelha = v.sobrancelha || (estilo === 'careca'
    ? corMisturada(corBarba, '#1a1410', 0.35)
    : corMisturada(corCabelo, '#24180f', loiro ? 0.45 : 0.15));
  const barba = v.barba && v.barba !== 'nenhuma' ? v.barba : null;
  const info = ESTILOS_CABELO[estilo];
  const preso = !!v.cabelo.preso && estilo === 'longo';
  return {
    pele: v.pele, cabelo: corCabelo, corRaspado: corMisturada(corCabelo, '#16100c', 0.25),
    barba: corBarba, estiloBarba: barba, sobrancelha, olhos: v.olhos || '#3a2518',
    grossura: v.porte === 'forte' ? 1.15 : 1, raspado: info && info.couro ? info.couro : null,
    estilo, corte, comFaixa, preso, faixa: comFaixa ? v.faixa : null, chuteira: v.chuteira || '#111111',
  };
}

const IDENTIDADE = new THREE.Matrix4();

// Cria um boneco. visual: a aparência (veja js/elenco.js). uniforme: o do elenco ou um dos UNIFORMES.
// Campos opcionais do visual, além dos do elenco:
//   cabelo.corte: variação do corte ('curto': 'frente' | 'lado' | 'arrepiado'; 'medio': 'franja' | 'repartido');
//                 sem ele, cada jogador ganha uma variação fixa
//   cabelo.comprimento: 'longo' | 'curto' (no 'cacheado'; cacheado com faixa já vira o comprido do Bruxo)
//   cabelo.estilo também aceita 'cacheadoLongo' (cachos até a nuca e os ombros)
//   cabelo.preso: no estilo 'longo', o cabelo fica preso atrás (rabo curto)
//   olhos: cor da íris (padrão castanho-escuro); sobrancelha: cor das sobrancelhas
//   textura: 'baixa' = textura do rosto e da pele com metade do tamanho (os genéricos, vistos de longe)
// detalhe: 'alto' (padrão) ou 'baixo' (menos triângulos e textura menor: figurantes vistos de longe).
// Devolve { grupo, aplicarPose(pose), altura, alturaQuadril, juntas, pontoNoGrupo, alcancar, visual, uniforme,
// criarSilhueta(material, copias), dispose() }.
// O boneco são 2 chamadas de desenho: a malha do uniforme (textura do time) e a da pele (textura do jogador),
// as duas com pele (THREE.SkinnedMesh) no mesmo esqueleto. As juntas são os ossos.
export function criarPersonagem({ visual = {}, uniforme, numero, nome, detalhe = 'alto' } = {}) {
  const v = { ...VISUAL_PADRAO, ...visual, cabelo: { ...VISUAL_PADRAO.cabelo, ...(visual.cabelo || {}) } };
  if (!(v.porte in LARGURA_PORTE)) v.porte = 'normal';
  v.coxas = v.coxas === 'grossas' ? 'grossas' : 'normais';
  const goleiro = !!v.goleiro;
  const uni = normalizarUniforme(uniforme || (goleiro ? UNIFORMES.goleiroLendas : UNIFORMES.lendas));
  const det = DETALHES[detalhe === 'baixo' ? 'baixo' : 'alto'];
  const altura = v.altura || 1.8;
  const escala = altura / ALTURA_REF;
  const largura = LARGURA_PORTE[v.porte];

  const grupo = new THREE.Group();
  grupo.name = nome ? `jogador ${nome}` : 'jogador';
  // Quem é baixo não fica proporcionalmente fino: a largura acompanha só a raiz da altura
  const corpo = new THREE.Group();
  corpo.scale.set(Math.sqrt(escala), escala, Math.sqrt(escala));
  grupo.add(corpo);

  // --- Esqueleto ---
  const quadril = novoOsso(corpo, 'quadril', 0, QUADRIL_Y, 0);
  const tronco = novoOsso(quadril, 'tronco', 0, CINTURA, 0);
  const cabeca = novoOsso(tronco, 'cabeca', 0, PESCOCO, 0, 'YXZ');
  const ombroX = OMBRO_X * (0.5 + 0.5 * largura);
  const juntas = { quadril, tronco, cabeca };
  for (const lado of ['E', 'D']) {
    const s = lado === 'E' ? 1 : -1; // a esquerda do jogador fica em +x
    const ombro = novoOsso(tronco, `ombro${lado}`, s * ombroX, OMBRO_Y, 0);
    const cotovelo = novoOsso(ombro, `cotovelo${lado}`, 0, -BRACO, 0);
    const punho = novoOsso(cotovelo, `punho${lado}`, 0, -ANTEBRACO, 0);
    juntas[`ombro${lado}`] = ombro;
    juntas[`cotovelo${lado}`] = cotovelo;
    juntas[`punho${lado}`] = punho;
    const perna = novoOsso(quadril, `perna${lado}`, s * QUADRIL_X, QUADRIL_JUNTA_Y, 0);
    const joelho = novoOsso(perna, `joelho${lado}`, 0, -COXA, 0);
    const tornozelo = novoOsso(joelho, `tornozelo${lado}`, 0, -CANELA, 0);
    juntas[`perna${lado}`] = perna;
    juntas[`joelho${lado}`] = joelho;
    juntas[`tornozelo${lado}`] = tornozelo;
  }
  const repouso = repousoDosOssos(ombroX);
  const ajudantes = [];
  const ossos = OSSOS.map((n) => {
    if (juntas[n]) return juntas[n];
    const osso = new THREE.Bone(); // ajudante: fica fora da árvore; o esqueleto calcula onde ele está
    osso.name = n;
    ajudantes.push({ osso, junta: juntas[AJUDANTES[n]] });
    return osso;
  });
  const inversas = OSSOS.map((n) => new THREE.Matrix4().makeTranslation(-repouso[n][0], -repouso[n][1], -repouso[n][2]));
  const esqueleto = new EsqueletoBoneco(ossos, inversas, ajudantes);

  // --- Malhas: uniforme (textura do time; o número e o nome são deste boneco) e pele (textura do jogador) ---
  const estilo = estiloEfetivo(v);
  const corte = corteDoCabelo({ ...v, cabelo: { ...v.cabelo, estilo } });
  const comFaixa = !!v.faixa && estilo !== 'careca' && estilo !== 'raspado';
  const uniformeDoTime = pegarUniforme({ ...uni, luvas: goleiro ? uni.luvas : null });
  const mapaNome = nome && temDocumento ? texturaNome(nome) : null;
  const matUniforme = materialDoUniforme(uni, uniformeDoTime.valor.mapa, numero, mapaNome);
  const tamanhoTextura = det.nome === 'baixo' || v.textura === 'baixa' ? 256 : 512;
  const aparencia = pegarAparencia(dadosDaAparencia(v, estilo, corte, comFaixa), tamanhoTextura);
  const pele = pegarCorpo(v, det, estilo, corte, comFaixa);

  // As malhas ficam no grupo (os ossos é que levam os vértices). A esfera é uma folga em volta do boneco,
  // para a câmera poder deixar de desenhar quem está fora da tela.
  const esfera = new THREE.Sphere(new THREE.Vector3(0, altura * 0.55, 0), 2.1 * Math.max(1, escala));
  const novaMalha = (geometria, material, nomeDaMalha) => {
    const m = new THREE.SkinnedMesh(geometria, material);
    m.name = nomeDaMalha;
    m.bind(esqueleto, IDENTIDADE);
    m.boundingSphere = esfera;
    grupo.add(m);
    return m;
  };
  const malhaUniforme = novaMalha(geoUniforme(v.porte, v.coxas, goleiro, det), matUniforme, 'uniforme');
  const malhaPele = novaMalha(pele.valor, aparencia.valor.material, 'pele');
  const silhuetas = [];

  // Altura do quadril de pé, no espaço do grupo
  const alturaQuadril = QUADRIL_Y * escala;

  // --- Pose ---
  const m4 = new THREE.Matrix4();
  const v3 = new THREE.Vector3();
  const pernas = {
    E: [juntas.pernaE, juntas.joelhoE, juntas.tornozeloE],
    D: [juntas.pernaD, juntas.joelhoD, juntas.tornozeloD],
  };

  function aplicarPose(pose = {}) {
    const tr = pose.tronco || {};
    const ca = pose.cabeca || {};
    const qu = pose.quadril || {};
    quadril.rotation.set(qu.frente || 0, qu.giro || 0, qu.lado || 0);
    tronco.rotation.set(tr.frente || 0, tr.giro || 0, tr.lado || 0);
    cabeca.rotation.set(ca.frente || 0, ca.giro || 0, ca.lado || 0);

    for (const lado of ['E', 'D']) {
      const s = lado === 'E' ? 1 : -1;
      const b = pose[`braco${lado}`] || {};
      juntas[`ombro${lado}`].rotation.set(-(b.frente || 0), s * (b.giro || 0), s * (b.lado ?? 0.1));
      juntas[`cotovelo${lado}`].rotation.set(-(b.cotovelo || 0), 0, 0);
      juntas[`ombro${lado}`].scale.set(1, 1, 1);
    }

    // Agachar: dobra quadril e joelho de cada perna para o quadril descer 'queda' (lei dos cossenos)
    const queda = limitar(pose.agachar || 0, 0, 1.2) * QUEDA_AGACHAR;
    const D = COXA + CANELA - queda;
    const cosJ = limitar((D * D - COXA * COXA - CANELA * CANELA) / (2 * COXA * CANELA), -1, 1);
    const cosQ = limitar((COXA * COXA + D * D - CANELA * CANELA) / (2 * COXA * D), -1, 1);
    const extraJoelho = Math.acos(cosJ);
    const extraQuadril = Math.acos(cosQ);
    for (const lado of ['E', 'D']) {
      const s = lado === 'E' ? 1 : -1;
      const p = pose[`perna${lado}`] || {};
      const frente = (p.frente || 0) + extraQuadril;
      const joelho = (p.joelho || 0) + extraJoelho;
      const [perna, jo, to] = pernas[lado];
      perna.rotation.set(-frente, s * (p.giro || 0), s * (p.lado || 0));
      jo.rotation.set(joelho, 0, 0);
      to.rotation.set(frente - joelho - (qu.frente || 0) + (p.tornozelo || 0), s * (p.pe || 0), 0);
    }

    // Apoio: acha o ponto mais baixo das solas e põe no chão
    quadril.position.y = QUADRIL_Y;
    const apoio = limitar(pose.apoio ?? 1, 0, 1);
    let ajuste = 0;
    if (apoio > 0) {
      let menor = Infinity;
      quadril.updateMatrix();
      for (const lado of ['E', 'D']) {
        const [perna, jo, to] = pernas[lado];
        perna.updateMatrix();
        jo.updateMatrix();
        to.updateMatrix();
        m4.multiplyMatrices(quadril.matrix, perna.matrix).multiply(jo.matrix).multiply(to.matrix);
        for (const s of SOLA) menor = Math.min(menor, v3.set(s[0], s[1], s[2]).applyMatrix4(m4).y);
      }
      ajuste = -menor * apoio;
    }
    quadril.position.y = QUADRIL_Y + ajuste + (pose.pulo || 0);

    // Mãos com alvo (maoE / maoD: { x, y, z, peso }, no espaço do tronco)
    for (const lado of ['E', 'D']) {
      const m = pose[`mao${lado}`];
      if (m && m.peso > 0.001) alcancarNoTronco(lado, v3.set(m.x || 0, m.y || 0, m.z || 0), Math.min(1, m.peso));
    }
  }

  // Posição de um ponto preso numa junta (no espaço da junta), no espaço do grupo
  function pontoNoGrupo(junta, x = 0, y = 0, z = 0) {
    corpo.updateMatrix();
    m4.copy(corpo.matrix);
    const cadeia = [];
    for (let o = junta; o && o !== corpo; o = o.parent) cadeia.unshift(o);
    for (const o of cadeia) {
      o.updateMatrix();
      m4.multiply(o.matrix);
    }
    return new THREE.Vector3(x, y, z).applyMatrix4(m4);
  }

  // Leva a mão até um ponto (cinemática inversa de dois ossos: ombro e cotovelo), por cima da pose atual.
  // alvo no espaço do tronco; peso: 0 = pose, 1 = mão no alvo. Estica o braço até 15% se o alvo estiver longe.
  const vetor = new THREE.Vector3();
  const dirCotovelo = new THREE.Vector3();
  const dirAntebraco = new THREE.Vector3();
  const polo = new THREE.Vector3();
  const eixoX = new THREE.Vector3();
  const eixoZ = new THREE.Vector3();
  const base = new THREE.Matrix4();
  const qAlvo = new THREE.Quaternion();
  function alcancarNoTronco(lado, alvo, peso = 1) {
    const s = lado === 'E' ? 1 : -1;
    const ombro = juntas[`ombro${lado}`];
    const cotovelo = juntas[`cotovelo${lado}`];
    const a = BRACO;
    const b = ANTEBRACO + MAO_CENTRO;
    vetor.copy(alvo).sub(ombro.position);
    let dist = vetor.length();
    const estica = limitar(dist / (a + b), 1, 1.15);
    dist = limitar(dist / estica, Math.abs(a - b) + 0.02, (a + b) * 0.999);
    const d = vetor.normalize();
    // Cotovelo para fora e um pouco para baixo (polo), no plano que passa pelo ombro e pelo alvo
    polo.set(s, -0.55, -0.15).normalize();
    polo.addScaledVector(d, -polo.dot(d));
    if (polo.lengthSq() < 1e-6) polo.set(0, 0, -1).addScaledVector(d, -d.z);
    polo.normalize();
    const cosA = limitar((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    dirCotovelo.copy(d).multiplyScalar(cosA).addScaledVector(polo, sinA);
    dirAntebraco.copy(d).multiplyScalar(dist).addScaledVector(dirCotovelo, -a).normalize();
    const dobraCotovelo = Math.acos(limitar(dirCotovelo.dot(dirAntebraco), -1, 1));
    // Base do ombro: −y local vai para o cotovelo; +z local é para onde o antebraço dobra
    eixoZ.copy(dirAntebraco).addScaledVector(dirCotovelo, -dirAntebraco.dot(dirCotovelo));
    if (eixoZ.lengthSq() < 1e-8) eixoZ.set(0, 0, 1).addScaledVector(dirCotovelo, -dirCotovelo.z);
    eixoZ.normalize();
    const eixoY = dirCotovelo.negate();
    eixoX.crossVectors(eixoY, eixoZ);
    base.makeBasis(eixoX, eixoY, eixoZ);
    qAlvo.setFromRotationMatrix(base);
    ombro.quaternion.slerp(qAlvo, peso);
    cotovelo.rotation.x = misturar(cotovelo.rotation.x, -dobraCotovelo, peso);
    ombro.scale.y = misturar(1, estica, peso);
  }
  // O mesmo, com o alvo no mundo (ex.: as mãos do goleiro de js/goleiro.js)
  function alcancar(lado, alvoMundo, peso = 1) {
    grupo.updateWorldMatrix(true, true);
    alcancarNoTronco(lado, tronco.worldToLocal(new THREE.Vector3(alvoMundo.x, alvoMundo.y, alvoMundo.z)), peso);
  }

  // Malha extra com o corpo inteiro numa chamada de desenho só, para a sombra projetada no gramado.
  // material: o THREE.Material de quem chama (o shader dele achata os vértices no chão). copias: quantas vezes a
  // geometria aparece repetida na mesma malha; cada vértice tem o atributo float `copia` (0, 1, ... copias − 1),
  // para o shader projetar cada cópia numa direção de luz. A malha acompanha o esqueleto do boneco (mesmos
  // ossos), já entra no grupo dele com frustumCulled = false e some no dispose(). Atributos: position, normal,
  // skinIndex, skinWeight e copia (uns 600 triângulos por cópia).
  function criarSilhueta(material, copias = 1) {
    const n = Math.max(1, Math.floor(copias));
    const m = new THREE.SkinnedMesh(geoSilhueta(v.porte, v.coxas, goleiro, n), material);
    m.name = 'silhueta';
    m.bind(esqueleto, IDENTIDADE);
    m.frustumCulled = false;
    grupo.add(m);
    silhuetas.push(m);
    return m;
  }

  aplicarPose(posePadrao(0));

  let descartado = false;
  return {
    grupo,
    aplicarPose,
    altura,
    alturaQuadril,
    juntas,
    pontoNoGrupo,
    alcancar,
    visual: v,
    uniforme: uni,
    criarSilhueta,
    esqueleto,
    // Pode ser chamado mais de uma vez: as texturas compartilhadas só são soltas na primeira
    dispose() {
      if (grupo.parent) grupo.parent.remove(grupo);
      if (descartado) return;
      descartado = true;
      for (const s of silhuetas) grupo.remove(s);
      silhuetas.length = 0;
      grupo.remove(malhaUniforme, malhaPele);
      cacheUniformes.soltar(uniformeDoTime);
      cacheAparencias[tamanhoTextura].soltar(aparencia);
      cacheCorpos.soltar(pele);
      if (mapaNome) mapaNome.dispose();
      matUniforme.dispose();
      esqueleto.dispose(); // a textura dos ossos
    },
  };
}

// ---------- Poses ----------

const CHAVES_POSE = {
  tronco: ['frente', 'lado', 'giro'],
  cabeca: ['frente', 'giro', 'lado'],
  bracoE: ['frente', 'lado', 'cotovelo', 'giro'],
  bracoD: ['frente', 'lado', 'cotovelo', 'giro'],
  pernaE: ['frente', 'lado', 'joelho', 'tornozelo', 'giro', 'pe'],
  pernaD: ['frente', 'lado', 'joelho', 'tornozelo', 'giro', 'pe'],
  quadril: ['frente', 'lado', 'giro'],
  maoE: ['x', 'y', 'z', 'peso'],
  maoD: ['x', 'y', 'z', 'peso'],
};
const SOLTOS = ['agachar', 'apoio', 'pulo'];
const PADRAO_SOLTOS = { agachar: 0, apoio: 1, pulo: 0 };
const PADRAO_BRACO_LADO = 0.1;

function valor(pose, grupo, chave) {
  const g = pose && pose[grupo];
  const v = g && g[chave];
  if (typeof v === 'number') return v;
  return (grupo === 'bracoE' || grupo === 'bracoD') && chave === 'lado' ? PADRAO_BRACO_LADO : 0;
}

// Mistura duas poses: k = 0 → a, k = 1 → b
export function misturarPoses(a, b, k) {
  const r = {};
  for (const [grupo, chaves] of Object.entries(CHAVES_POSE)) {
    const ga = a && a[grupo];
    const gb = b && b[grupo];
    if (!ga && !gb) continue;
    r[grupo] = {};
    for (const c of chaves) {
      // Alvo da mão que só existe numa das poses: o lugar fica fixo, só o peso muda
      const soPeso = (grupo === 'maoE' || grupo === 'maoD') && c !== 'peso' && !(ga && gb);
      r[grupo][c] = soPeso ? valor(ga ? a : b, grupo, c) : misturar(valor(a, grupo, c), valor(b, grupo, c), k);
    }
  }
  for (const c of SOLTOS) {
    const va = a && typeof a[c] === 'number' ? a[c] : PADRAO_SOLTOS[c];
    const vb = b && typeof b[c] === 'number' ? b[c] : PADRAO_SOLTOS[c];
    r[c] = misturar(va, vb, k);
  }
  return r;
}

// Espelha a pose (troca esquerda e direita): o chute de canhoto é o de destro no espelho
export function espelhar(p) {
  const r = { ...p };
  r.bracoE = p.bracoD;
  r.bracoD = p.bracoE;
  r.pernaE = p.pernaD;
  r.pernaD = p.pernaE;
  if (p.tronco) r.tronco = { ...p.tronco, lado: -(p.tronco.lado || 0), giro: -(p.tronco.giro || 0) };
  if (p.cabeca) r.cabeca = { ...p.cabeca, giro: -(p.cabeca.giro || 0), lado: -(p.cabeca.lado || 0) };
  if (p.quadril) r.quadril = { ...p.quadril, lado: -(p.quadril.lado || 0), giro: -(p.quadril.giro || 0) };
  return r;
}

// Curva suave passando por todas as poses-chave [[tempo, pose], ...] (Catmull-Rom)
export function porChaves(chaves, t) {
  const n = chaves.length;
  if (t <= chaves[0][0]) return chaves[0][1];
  if (t >= chaves[n - 1][0]) return chaves[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > chaves[i + 1][0]) i++;
  const [t1, p1] = chaves[i];
  const [t2, p2] = chaves[i + 1];
  const p0 = i > 0 ? chaves[i - 1][1] : p1;
  const p3 = i + 2 < n ? chaves[i + 2][1] : p2;
  const u = (t - t1) / (t2 - t1);
  const u2 = u * u;
  const u3 = u2 * u;
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  const r = {};
  for (const [grupo, cs] of Object.entries(CHAVES_POSE)) {
    r[grupo] = {};
    for (const c of cs) r[grupo][c] = cr(valor(p0, grupo, c), valor(p1, grupo, c), valor(p2, grupo, c), valor(p3, grupo, c));
  }
  for (const c of SOLTOS) {
    const ler = (p) => (typeof p[c] === 'number' ? p[c] : PADRAO_SOLTOS[c]);
    r[c] = cr(ler(p0), ler(p1), ler(p2), ler(p3));
  }
  r.agachar = Math.max(0, r.agachar);
  r.apoio = limitar(r.apoio, 0, 1);
  return r;
}

// De pé, parado: respira e troca o peso de perna de leve. t em segundos.
export function posePadrao(t = 0) {
  const respira = Math.sin(t * 1.7);
  const peso = Math.sin(t * 0.55);
  return {
    tronco: { frente: 0.03 + 0.012 * respira, lado: 0.025 * peso, giro: 0.03 * Math.sin(t * 0.37) },
    cabeca: { frente: 0.02, giro: 0.12 * Math.sin(t * 0.31) },
    bracoE: { frente: 0.06, lado: 0.13 + 0.015 * respira, cotovelo: 0.22 },
    bracoD: { frente: 0.06, lado: 0.13 + 0.015 * respira, cotovelo: 0.22 },
    pernaE: { frente: 0.02, lado: 0.06 + 0.02 * peso, joelho: 0.04 },
    pernaD: { frente: -0.02, lado: 0.06 - 0.02 * peso, joelho: 0.04 },
    quadril: { lado: -0.03 * peso },
    agachar: 0.03,
  };
}


// Jogador da barreira: mãos protegendo, de frente para a bola. progressoPulo: 0 = no chão,
// de 0 a 1 = no ar (como em js/barreira.js); t: relógio (para balançar de leve).
export function poseBarreira(progressoPulo = 0, t = 0) {
  const ar = progressoPulo > 0 && progressoPulo < 1 ? Math.sin(Math.PI * progressoPulo) : 0;
  const balanco = Math.sin(t * 2.1);
  return {
    tronco: { frente: 0.05 + 0.08 * ar + 0.01 * balanco, lado: 0.015 * Math.sin(t * 0.8), giro: 0 },
    cabeca: { frente: 0.12 - 0.15 * ar, giro: 0.03 * Math.sin(t * 0.5) },
    bracoE: { frente: 0.42, lado: -0.2, cotovelo: 0.55 + 0.04 * balanco },
    bracoD: { frente: 0.42, lado: -0.2, cotovelo: 0.55 + 0.04 * balanco },
    pernaE: { frente: 0.04 + 0.3 * ar, lado: 0.02, joelho: 0.05 + 0.8 * ar, tornozelo: 0.5 * ar },
    pernaD: { frente: 0.04 + 0.3 * ar, lado: 0.02, joelho: 0.05 + 0.8 * ar, tornozelo: 0.5 * ar },
    agachar: 0.04 + 0.01 * balanco,
    apoio: 1 - suave(ar * 4),
  };
}

// Goleiro na espera: meio agachado, pernas abertas, mãos à frente, quicando na ponta dos pés
export function poseGoleiroPronto(t = 0) {
  const quica = Math.sin(t * 6.5);
  const peso = Math.sin(t * 1.7);
  return {
    tronco: { frente: 0.32, lado: 0.03 * peso, giro: 0 },
    cabeca: { frente: -0.28, giro: 0 },
    bracoE: { frente: 0.75, lado: 0.32, cotovelo: 0.85 },
    bracoD: { frente: 0.75, lado: 0.32, cotovelo: 0.85 },
    maoE: { x: 0.25, y: 0.2, z: 0.33, peso: 1 },
    maoD: { x: -0.25, y: 0.2, z: 0.33, peso: 1 },
    pernaE: { frente: 0.05, lado: 0.2 + 0.02 * peso, joelho: 0, tornozelo: 0.12 },
    pernaD: { frente: 0.05, lado: 0.2 - 0.02 * peso, joelho: 0, tornozelo: 0.12 },
    agachar: 0.42 + 0.04 * quica,
  };
}

// Mergulho do goleiro. progresso: 0 a 1; lado: −1, 0 ou +1 (+1 = para +x local, a esquerda do goleiro,
// que é a direita de quem cobra); alto: 0 = rasteiro, 1 = no alto.
// A pose só mexe braços, pernas e tronco; quem chama tomba (rola) e leva o grupo inteiro.
export function poseGoleiroMergulho(progresso = 0, lado = 0, alto = 0.5) {
  const k = suave(progresso * 1.6);
  const s = Math.sign(lado);
  let alvo;
  if (s !== 0) {
    // Braços esticados acima da cabeça, puxados para o lado do mergulho (o corpo tomba junto)
    const perto = s > 0 ? 'E' : 'D';
    const longe = s > 0 ? 'D' : 'E';
    alvo = {
      tronco: { frente: 0.05, lado: -0.22 * s, giro: 0.1 * s },
      cabeca: { frente: -0.1, giro: 0.25 * s },
      [`braco${perto}`]: { frente: 0.25, lado: 2.75 - 0.25 * (1 - alto), cotovelo: 0.1 },
      [`braco${longe}`]: { frente: 0.35, lado: 3.3 - 0.2 * (1 - alto), cotovelo: 0.25 },
      [`perna${perto}`]: { frente: 0.45, lado: 0.12, joelho: 0.85, tornozelo: 0.3 },
      [`perna${longe}`]: { frente: -0.05, lado: 0.35, joelho: 0.15, tornozelo: 0.5 },
      agachar: 0,
      apoio: 0,
    };
  } else if (alto > 0.5) {
    // Pulo no meio: braços para cima, joelhos dobrados
    alvo = {
      tronco: { frente: 0.05 }, cabeca: { frente: -0.25 },
      bracoE: { frente: 2.6, lado: 0.25, cotovelo: 0.15 },
      bracoD: { frente: 2.6, lado: 0.25, cotovelo: 0.15 },
      pernaE: { frente: 0.35, lado: 0.12, joelho: 0.7, tornozelo: 0.4 },
      pernaD: { frente: 0.1, lado: 0.12, joelho: 0.5, tornozelo: 0.4 },
      apoio: 0,
    };
  } else {
    // Bola baixa no meio: agacha e põe as mãos na frente
    alvo = {
      tronco: { frente: 0.45 }, cabeca: { frente: 0.1 },
      bracoE: { frente: 0.75, lado: 0.12, cotovelo: 0.2 },
      bracoD: { frente: 0.75, lado: 0.12, cotovelo: 0.2 },
      pernaE: { lado: 0.18, tornozelo: 0.1 }, pernaD: { lado: 0.18, tornozelo: 0.1 },
      agachar: 0.75,
    };
  }
  return misturarPoses(poseGoleiroPronto(0), alvo, k);
}



// Quantos recursos estão em cache (para conferir que dispose() não deixa sobras). "camisas" são os atlas de
// uniforme (um por time) e "rostos" os atlas de aparência (um por jogador); "corpos" são as malhas de pele.
export function estatisticasCache() {
  const u = cacheUniformes.numeros();
  const a = cacheAparencias[512].numeros();
  const b = cacheAparencias[256].numeros();
  const c = cacheCorpos.numeros();
  return {
    geometrias: cacheGeo.size + c.total, materiais: a.total + b.total, texturas: cacheTex.size + u.total + a.total + b.total,
    camisas: u.total, camisasEmUso: u.emUso, camisasGuardadas: u.guardados,
    rostos: a.total + b.total, rostosEmUso: a.emUso + b.emUso, rostosGuardados: a.guardados + b.guardados,
    corpos: c.total, corposEmUso: c.emUso, corposGuardados: c.guardados,
  };
}

// ---------- Sombra ----------
let geoSombra = null;
let matSombra = null;
// Sombra redonda e macia no chão (uma malha só, barata). raio em m. Ponha em y ≈ 0,01, embaixo do boneco.
export function criarSombraBlob(raio = 0.42) {
  if (!matSombra) {
    geoSombra = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    let mapa = null;
    if (temDocumento) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.32)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      mapa = new THREE.CanvasTexture(canvas);
    }
    matSombra = new THREE.MeshBasicMaterial({
      map: mapa, color: 0x000000, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    if (mapa) matSombra.color.set(0xffffff);
  }
  const m = new THREE.Mesh(geoSombra, matSombra);
  m.scale.set(2 * raio, 1, 2 * raio);
  m.position.y = 0.012;
  m.renderOrder = 1;
  m.name = 'sombra';
  return m;
}

// ---------- Ajudantes para a cena ----------

// Aparências genéricas para os adversários e figurantes: variadas (com a barreira e os outros jogadores em
// campo aparecem uns 15 por lance), mas sem lembrar ninguém. A textura deles é a pequena: são vistos de longe.
const GENERICOS = [
  { pele: '#e6b892', cabelo: { estilo: 'curto', cor: '#2b1d14', corte: 'lado' }, barba: 'nenhuma', chuteira: '#111111', porte: 'normal' },
  { pele: '#86522f', cabelo: { estilo: 'raspado', cor: '#151010' }, barba: 'rala', corBarba: '#151010', chuteira: '#f5f5f5', porte: 'forte' },
  { pele: '#f1cfb0', cabelo: { estilo: 'curto', cor: '#b8894e', corte: 'frente' }, barba: 'nenhuma', chuteira: '#1e5bd8', porte: 'normal' },
  { pele: '#c68e62', cabelo: { estilo: 'curto', cor: '#1c1410', corte: 'arrepiado' }, barba: 'cavanhaque', corBarba: '#1c1410', chuteira: '#111111', porte: 'normal' },
  { pele: '#6b4026', cabelo: { estilo: 'careca', cor: '#111111' }, barba: 'cheia', corBarba: '#151010', chuteira: '#e8e8e8', porte: 'forte' },
  { pele: '#efc6a2', cabelo: { estilo: 'topete', cor: '#6b4a2b' }, barba: 'rala', corBarba: '#5a3c22', chuteira: '#111111', porte: 'normal' },
  { pele: '#d9a57a', cabelo: { estilo: 'cacheado', cor: '#24170f', comprimento: 'curto' }, barba: 'nenhuma', chuteira: '#ff6a00', porte: 'magro' },
  { pele: '#f3d2b5', cabelo: { estilo: 'raspado', cor: '#a8643a' }, barba: 'rala', corBarba: '#a8643a', chuteira: '#111111', porte: 'normal' },
  { pele: '#b57d52', cabelo: { estilo: 'curto', cor: '#17110d', corte: 'frente' }, barba: 'rala', corBarba: '#17110d', chuteira: '#d7263d', porte: 'normal' },
  { pele: '#f0c3a0', cabelo: { estilo: 'medio', cor: '#4a3020', corte: 'repartido' }, barba: 'nenhuma', chuteira: '#f5f5f5', porte: 'magro' },
  { pele: '#5c3820', cabelo: { estilo: 'curto', cor: '#120e0c', corte: 'arrepiado' }, barba: 'nenhuma', chuteira: '#2ecc71', porte: 'normal' },
  { pele: '#e2b48a', cabelo: { estilo: 'careca', cor: '#2a1d14' }, barba: 'cavanhaque', corBarba: '#3a2a1f', chuteira: '#111111', porte: 'forte' },
  { pele: '#d4a072', cabelo: { estilo: 'topete', cor: '#1a1410' }, barba: 'nenhuma', chuteira: '#f7d84a', porte: 'normal' },
  { pele: '#f2c9a5', cabelo: { estilo: 'curto', cor: '#8a5a32', corte: 'lado' }, barba: 'cheia', corBarba: '#7a4a28', chuteira: '#111111', porte: 'forte' },
  { pele: '#7a4a2c', cabelo: { estilo: 'cacheado', cor: '#151010', comprimento: 'curto' }, barba: 'rala', corBarba: '#151010', chuteira: '#f5f5f5', porte: 'normal' },
  { pele: '#efc6a2', cabelo: { estilo: 'raspado', cor: '#3a2a20' }, barba: 'nenhuma', chuteira: '#1e5bd8', porte: 'normal' },
  { pele: '#c68e62', cabelo: { estilo: 'medio', cor: '#1c1410', corte: 'franja' }, barba: 'nenhuma', chuteira: '#111111', porte: 'magro' },
  { pele: '#f1cfb0', cabelo: { estilo: 'curto', cor: '#d9b45a', corte: 'arrepiado' }, barba: 'rala', corBarba: '#b8894e', chuteira: '#ff6a00', porte: 'normal' },
  { pele: '#86522f', cabelo: { estilo: 'curto', cor: '#151010', corte: 'frente' }, barba: 'cavanhaque', corBarba: '#151010', chuteira: '#111111', porte: 'normal' },
  { pele: '#e6b892', cabelo: { estilo: 'longo', cor: '#3a2a1f', preso: true }, barba: 'rala', corBarba: '#3a2a1f', chuteira: '#e8e8e8', porte: 'normal' },
  { pele: '#d9a57a', cabelo: { estilo: 'raspado', cor: '#1c1410' }, barba: 'cheia', corBarba: '#1c1410', chuteira: '#d7263d', porte: 'forte' },
  { pele: '#f3d2b5', cabelo: { estilo: 'topete', cor: '#c98a4b' }, barba: 'nenhuma', chuteira: '#111111', porte: 'magro' },
  { pele: '#6b4026', cabelo: { estilo: 'raspado', cor: '#111111' }, barba: 'nenhuma', chuteira: '#f7d84a', porte: 'normal' },
  { pele: '#b57d52', cabelo: { estilo: 'curto', cor: '#2b1d14', corte: 'lado' }, barba: 'bigode', corBarba: '#2b1d14', chuteira: '#f5f5f5', porte: 'normal' },
];
export function visualAdversario(indice = 0, altura = 1.84) {
  const n = GENERICOS.length;
  const r = GENERICOS[((Math.floor(indice) % n) + n) % n];
  return { ...r, cabelo: { ...r.cabelo }, faixa: null, altura, coxas: 'normais', textura: 'baixa' };
}
export const VISUAL_GOLEIRO_ADVERSARIO = {
  pele: '#e2b48a', cabelo: { estilo: 'raspado', cor: '#2a1d14' }, barba: 'rala', corBarba: '#2a1d14',
  faixa: null, altura: 1.9, porte: 'forte', coxas: 'normais', chuteira: '#111111', goleiro: true,
};

// Barreira (js/barreira.js): põe o boneco no lugar do jogador j e aplica a pose. indice varia o balanço.
export function posicionarBarreira(personagem, j, t = 0, indice = 0) {
  personagem.grupo.position.set(j.x, j.yPes || 0, j.z);
  personagem.grupo.rotation.set(0, j.rotacaoY || 0, 0);
  personagem.aplicarPose(poseBarreira(j.progressoPulo || 0, t + indice * 1.37));
}

// Goleiro (js/goleiro.js): põe o boneco na pose g.pose (quadril, giro, rolagem, mãos).
// De pé, os pés ficam no chão; no mergulho, o quadril do boneco vai para o quadril do goleiro.
// As mãos vão até g.maos (as mesmas da colisão), se maos = true.
export function posicionarGoleiro(personagem, gp, t = 0, { maos = true } = {}) {
  const progresso = gp.progressoMergulho || 0;
  const mergulhando = gp.estado === 'mergulhando' || gp.estado === 'caido' || progresso > 0;
  const noAr = mergulhando ? suave(Math.max(progresso * 2.5, Math.abs(gp.rolagem || 0) / 0.5)) : 0;

  // Passos para o lado: a fase dos passos anda com o deslocamento (um passo a cada ~0,45 m)
  const estado = personagem._goleiro || (personagem._goleiro = { x: gp.centro ? gp.centro.x : gp.x, t, fase: 0, vel: 0 });
  const xAgora = gp.centro ? gp.centro.x : gp.x;
  const dt = t - estado.t;
  if (dt > 1e-4 && dt < 0.5) {
    const v = (xAgora - estado.x) / dt;
    estado.vel += (v - estado.vel) * Math.min(1, dt * 12);
    estado.fase += Math.abs(xAgora - estado.x) / 0.45;
  } else if (dt < 0 || dt >= 0.5) {
    estado.vel = 0;
  }
  estado.x = xAgora;
  estado.t = t;

  let pose = poseGoleiroPronto(t);
  const andando = mergulhando ? 0 : limitar(Math.abs(estado.vel) / 1.2, 0, 1);
  if (andando > 0.02) {
    // A perna do lado para onde ele vai abre; a outra fecha (sem cruzar)
    const onda = Math.sin(estado.fase * Math.PI * 2);
    const lidera = estado.vel > 0 ? 'E' : 'D';
    const segue = lidera === 'E' ? 'D' : 'E';
    const passo = {
      [`perna${lidera}`]: { lado: 0.2 + 0.14 * onda, joelho: 0.12 * Math.max(0, onda), tornozelo: 0.12 },
      [`perna${segue}`]: { lado: 0.2 - 0.1 * onda, joelho: 0.12 * Math.max(0, -onda), tornozelo: 0.12 },
    };
    pose = misturarPoses(pose, { ...pose, ...passo }, andando);
  }
  if (mergulhando) {
    pose = poseGoleiroMergulho(Math.max(progresso, gp.bracos || 0), gp.lado || 0, gp.alto ?? 0.5);
  }
  pose.apoio = 1 - noAr;
  personagem.aplicarPose(pose);
  const g = personagem.grupo;
  g.rotation.set(0, gp.rotacaoY || 0, -(gp.rolagem || 0));
  // Onde o quadril do boneco fica, já girado; de pé os pés ficam no chão, no ar o quadril vai junto
  const q = personagem.pontoNoGrupo(personagem.juntas.quadril).applyEuler(g.rotation);
  g.position.set(gp.x - q.x, misturar(0, gp.y - q.y, noAr), gp.z - q.z);
  if (maos && gp.maos) {
    personagem.alcancar('D', gp.maos.direita, 1);
    personagem.alcancar('E', gp.maos.esquerda, 1);
  }
}
