
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
