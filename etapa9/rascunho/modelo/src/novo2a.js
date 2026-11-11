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
  manga: { x: 2, y: 260, w: 156, h: 124 },
  calcao: { x: 164, y: 260, w: 284, h: 136 },
  calcaoDentro: { x: 454, y: 260, w: 56, h: 136 },
  meiao: { x: 2, y: 390, w: 116, h: 120 },
  luva: { x: 124, y: 402, w: 72, h: 72 },
  // aparência
  cabeca: { x: 0, y: 0, w: 512, h: 256 },
  braco: { x: 2, y: 262, w: 92, h: 248 },
  perna: { x: 100, y: 262, w: 112, h: 248 },
  mao: { x: 218, y: 262, w: 92, h: 120 },
  chuteira: { x: 316, y: 262, w: 194, h: 160 },
  cachos: { x: 218, y: 390, w: 64, h: 64 },
  faixa: { x: 290, y: 392, w: 20, h: 20 },
  cabeloLiso: { x: 290, y: 420, w: 20, h: 20 },
  pele: { x: 218, y: 462, w: 24, h: 24 },
};

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
