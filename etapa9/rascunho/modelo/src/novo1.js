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

