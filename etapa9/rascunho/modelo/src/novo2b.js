
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
  const alturas = ALTURAS_CAMISA[det.nome];
  const jAxila = alturas.indexOf(ALTURA_AXILA);
  const topoDeltoide = DELTOIDE.y + DELTOIDE.r * m.kb;
  const marca = c.marca();
  const dobrasAxila = (() => {
    const k = contornoCamisa(ALTURA_AXILA, m, det);
    return [k.pf, k.pb];
  })();

  // Zona de cada coluna: 0 = corpo, 1 = ombro esquerdo, −1 = ombro direito; nas dobras o braço vale menos
  const zona = (i) => {
    if (i < iDF || i > iDT) return [-1, 1];
    if (i === iDF || i === iDT) return [-1, 0.45];
    if (i > iEF && i < iET) return [1, 1];
    if (i === iEF || i === iET) return [1, 0.45];
    return [0, 0];
  };
  const ossosDoTronco = (y, lado, braco) => {
    const wq = 0.8 * (1 - suave((y + 0.105) / 0.26)); // a barra acompanha a bacia
    if (!lado || braco <= 0 || y < ALTURA_AXILA - 1e-6) return ossosDe(O.tronco, 1 - wq, O.quadril, wq);
    const h = limitar((y - ALTURA_AXILA) / (topoDeltoide - ALTURA_AXILA), 0, 1);
    const w = braco * (1 - 0.72 * suave(h)) * (1 - suave((y - topoDeltoide) / 0.02));
    const parte = 0.8 * (1 - suave(h));
    const E = lado > 0;
    return ossosDe(O.tronco, 1 - w, E ? O.ombroE : O.ombroD, w * parte, E ? O.meioOmbroE : O.meioOmbroD, w * (1 - parte));
  };

  // Uma fileira de vértices: R(ponto) escolhe o raio; encolhe: fator para as beiradas viradas para dentro
  const fileira = (y, k, { raio = (p) => p.R, encolhe = 1, v = vCamisa(y), sombra = null, somenteTronco = false, dy = 0 }) => {
    const fila = [];
    for (let i = 0; i <= N; i++) {
      const p = k.pontos[i];
      const R = raio(p) * encolhe;
      const [lado, braco] = zona(i);
      const naEsfera = !somenteTronco && p.rc > p.re;
      const yy = y + subidaDaGola(y, p.sn) + dy;
      const [tu, tv] = noRetangulo(RET.camisa, uCol[i], v);
      const s = sombra ? sombra(i, p, lado, braco) : 1;
      fila.push(c.ponto(R * p.cs, TRONCO_Y + yy, R * p.sn + k.sec.dz, tu, tv,
        ossosDoTronco(y, somenteTronco ? 0 : lado, naEsfera || braco < 1 ? braco : braco * 0.6), s, BRILHO.tecido));
    }
    return fila;
  };

  const sombraTronco = (y) => (i, p, lado, braco) => {
    let s = 1 - 0.05 * sino(y - 0.03, 0.08) * Math.abs(p.cs);
    if (lado && y < ALTURA_AXILA) s -= 0.2 * suave((y - 0.15) / 0.15);         // embaixo do braço
    if (lado && braco < 1 && y >= ALTURA_AXILA) s -= 0.1 * (1 - suave((y - 0.39) / 0.06)); // dobra do peito com o braço
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
      const dentro = fileira(y, k, { raio: (p) => p.re, sombra: (i, p, lado, braco) => (lado && braco === 1 ? 0.62 : sombraTronco(y)(i, p, lado, braco)), somenteTronco: true });
      const fora = fileira(y, k, { sombra: sombraTronco(y) });
      // Nas colunas fora dos ombros (e nas dobras) as duas fileiras são o mesmo vértice
      for (let i = 0; i <= N; i++) {
        const [lado, braco] = zona(i);
        if (!lado || braco < 1) fora[i] = dentro[i];
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
  const anel = (a, mix, folga, encolhe, sombra) => {
    const s = PERFIL_BRACO(Math.max(0.115, a));
    const g = grossuraBraco(a, m.kb);
    // O centro sai do meio do deltoide e vai para o eixo do braço
    const t = suave((a - a0) / 0.12);
    const bx = m.ombroX + DELTOIDE.dx * (1 - t);
    const bz = DELTOIDE.dz * (1 - t);
    const fila = [];
    for (let k = 0; k <= n; k++) {
      const th = angulo(k);
      const sn = Math.sin(th);
      let x = bx + (s.l * g + folga) * encolhe * Math.cos(th);
      let z = bz + ((sn >= 0 ? s.f : s.t) * g + folga) * encolhe * sn;
      if (mix < 1) {
        x = misturar(topoXZ[k][0], x, mix);
        z = misturar(topoXZ[k][1], z, mix);
      }
      const [tu, tv] = noRetangulo(RET.manga, k / n, vDe(a));
      const ossos = goleiro
        ? (a > 0.5 ? ossosDe(O.cotoveloE, 1) : ossosDaDobra(a - BRACO, 0.04, O.ombroE, O.meioCotoveloE, O.cotoveloE))
        : [O.ombroE, 1];
      fila.push(c.ponto(x, OMBRO_ALT - a, z, tu, tv, ossos, sombra * (dentro(k) ? 0.84 : 1), BRILHO.tecido));
    }
    return fila;
  };
  for (const [a, mix, folga] of lista) {
    const fila = anel(a, mix, folga, 1, 1);
    c.faixa(anterior, fila);
    anterior = fila;
  }
  // Beirada de dentro: fecha no braço (ou no punho da luva)
  const borda = anel(fim - 0.007, 1, -0.004, 1, 0.5);
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
