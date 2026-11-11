// Figurantes: os outros jogadores em campo, além do cobrador, da barreira e do goleiro (companheiros do
// cobrador e adversários marcando), para a cobrança parecer um lance de jogo de verdade.
// Aqui só a lógica (onde cada um fica, o passo que dão depois do chute e a colisão com a bola); o desenho é de
// js/animacaoFigurantes.js. Não depende do Three.js: dá para rodar no Node (veja testes/figurantes.mjs).
// Eixos: x = direita de quem cobra, y = para cima, z = do gol em direção a quem cobra (gol em z = 0).
//
// Como a montagem pensa (em poucas linhas):
//   1. Corredor do chute: o triângulo da bola até as traves (com 1 m de folga para fora de cada uma), alargado
//      pela curva que a bola consegue fazer (cresce com o quadrado da distância: ~1,4 m no meio do caminho numa
//      falta de 22 m, ~3 m numa de 33 m) e por uma folga do tamanho do corpo. Ninguém fica nem anda ali dentro:
//      a bola só bate em figurante em chute torto, desvio ou rebote.
//   2. Zonas proibidas: 9,15 m da bola para os adversários (3 m para os companheiros), 5 m para cada lado da
//      reta que vai da bola para trás (é onde fica a câmera) até 16 m, 2 m do caminho da corrida do cobrador,
//      longe do goleiro, das traves e da barreira; no pênalti, todo mundo fora da área e da meia-lua.
//   3. Papéis, do mais para o menos importante: duplas atacante + marcador coladas na borda do corredor (na
//      quina da pequena área e na linha da barreira), o zagueiro da sobra, um atacante solto, a linha da defesa
//      do outro lado, um companheiro atrás da bola... Em falta lateral o grosso vai para o meio da área e a
//      segunda trave. Com menos gente, saem os últimos da lista.
//   4. Entre os lugares que servem para cada papel, ganha o que aparece melhor na câmera de trás num celular em
//      pé (ela olha mais para o lado de onde o cobrador vem) sem ficar escondido atrás de outro boneco.
//   5. Depois do chute cada um dá uns passos para o rebote (função só do tempo desde o chute: o replay repete).

export const PADRAO_FIGURANTES = {
  quantidade: 10,       // quantos jogadores além do cobrador, da barreira e do goleiro (0 = campo vazio; até 14)
  colisao: true,        // a bola bate neles (false = só enfeite)
  // Os números abaixo não estão no painel (valem para todo mundo; mude aqui ou no config.js)
  folgaTrave: 1.0,      // m para fora de cada trave que ainda contam como corredor do chute
  curvaCorredor: 0.0029, // alargamento do corredor pela curva: m no meio do caminho = isto × (m da bola à trave)²
  folgaCorredor: 0.6,   // m entre a borda do corredor e o centro de um jogador (corpo + bola + sobra)
  raio: 0.24,           // m: "grossura" do corpo na colisão (metade da largura dos ombros)
  raioCabeca: 0.12,     // m
  quique: 0.28,         // quanto a bola volta ao bater num jogador (0 = morre, 1 = volta tudo)
  atrito: 0.6,          // quanto sobra da velocidade "de raspão" depois da batida
  movimento: true,      // depois do chute eles dão uns passos para o rebote (false = estátuas)
};

export const MAXIMO_FIGURANTES = 14;

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const misturar = (a, b, k) => a + (b - a) * k;
const suave = (u) => {
  const x = limitar(u, 0, 1);
  return x * x * (3 - 2 * x);
};
const lerCfg = (cfg) => ({ ...PADRAO_FIGURANTES, ...((cfg && cfg.figurantes) || {}) });

// Campo de 105 x 68 m (como em js/estadio.js): laterais em x = ±34; só interessa a metade do nosso gol
const CAMPO = { meiaLargura: 34, meio: 52.5 };
const AREA = { meiaLargura: 20.16, fundo: 16.5 };
const DISTANCIA_REGRA = 9.15;

// Distâncias mínimas da montagem (com uma sobra em cima da regra, para a conta não ficar no fio)
const MINIMO = {
  bolaDefesa: DISTANCIA_REGRA + 0.2, // adversário até a bola
  bolaAtaque: 3.2,                   // companheiro até a bola
  cameraLado: 5.3,                   // para cada lado da reta que vai da bola para trás...
  cameraAtras: 16.5,                 // ... até esta distância atrás da bola
  corrida: 2.2,                      // do caminho da corrida do cobrador
  goleiro: 2.7,
  trave: 2.0,
  barreira: 1.6,                     // de qualquer jogador da barreira (a regra pede 1 m para os companheiros)
  outro: 1.6,                        // entre dois figurantes que não são dupla
  parMin: 0.64,                      // dupla de marcação: lado a lado...
  parMax: 0.86,
  borda: 1.0,                        // das linhas laterais e do meio de campo
  linhaDeFundo: 0.9,
};

// Altura, número e aparência de cada figurante: fixos por time e por ordem de entrada (os mesmos companheiros
// em toda falta, como num jogo: o desenho recicla os bonecos enquanto o uniforme não muda)
const ALTURAS = [1.84, 1.78, 1.88, 1.81, 1.76, 1.86, 1.8, 1.9, 1.77, 1.83];
// Números que nenhuma lenda usa (ataque) e que a barreira e o goleiro não usam (defesa)
const NUMEROS = {
  ataque: [6, 15, 16, 13, 25, 26, 27, 29, 24, 33],
  defesa: [2, 7, 9, 10, 11, 14, 15, 16, 17, 18],
};

// Ruído inteiro (igual em qualquer navegador): número de 0 a 1 para a semente s e o índice i
function ruido(s, i) {
  let t = (s + Math.imul(i + 1, 0x9e3779b1)) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Distância do ponto (x, z) ao segmento a → b
function distanciaAoSegmento(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const u = l2 > 1e-9 ? limitar(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1) : 0;
  return Math.hypot(x - a.x - dx * u, z - a.z - dz * u);
}

// ---------- Corredor do chute ----------

// O corredor de uma falta. posBola: {x, z}. Devolve:
//   fora(x, z)   m que o ponto está para fora da borda do corredor (negativo = dentro). Quem fica a menos de
//                folga m da borda ainda atrapalha: use dentro(x, z).
//   dentro(x, z) true se um jogador com o centro ali está no caminho de um chute que vai no gol
//   borda(ox, oz, dx, dz, extra)  anda a partir de (ox, oz), que está dentro, na direção (dx, dz) e devolve
//                quantos m até ficar `extra` m para fora da zona proibida (borda + folga)
// Cada lado tem duas linhas: a aresta do triângulo até 1 m para fora da trave, e a corda até a trave
// "estufada" pela curva (uma parábola, máxima no meio do caminho). Vale a que estiver mais para fora.
export function corredorDoChute(posBola, cfg = {}) {
  const c = lerCfg(cfg);
  const meia = (cfg.golLargura ?? 7.32) / 2;
  const bx = posBola.x;
  const bz = Math.max(0.5, posBola.z);
  // Mexeram na força da curva (painel)? O corredor alarga junto
  const fatorCurva = limitar(((cfg.giroLateralMax ?? 70) / 70) * ((cfg.magnus ?? 0.005) / 0.005), 1, 2.5);
  const linha = (px, s) => {
    const dx = px - bx;
    const L = Math.hypot(dx, bz) || 1;
    const cx = dx / L;
    const cz = -bz / L;
    return { L, cx, cz, nx: -s * cz, nz: s * cx }; // (nx, nz): para fora do corredor
  };
  const lados = [-1, 1].map((s) => {
    const corda = linha(s * meia, s);
    return { s, corda, aresta: linha(s * (meia + c.folgaTrave), s), curva: c.curvaCorredor * corda.L * corda.L * fatorCurva };
  });
  const foraDoLado = (lado, x, z) => {
    const rx = x - bx;
    const rz = z - bz;
    const a = lado.aresta;
    const k = lado.corda;
    const u = (rx * k.cx + rz * k.cz) / k.L;
    const barriga = u > 0 && u < 1 ? lado.curva * 4 * u * (1 - u) : 0;
    return Math.min(rx * a.nx + rz * a.nz, rx * k.nx + rz * k.nz - barriga);
  };
  const fora = (x, z) => Math.max(foraDoLado(lados[0], x, z), foraDoLado(lados[1], x, z));
  const dentro = (x, z) => fora(x, z) < c.folgaCorredor;
  function borda(ox, oz, dx, dz, extra = 0) {
    const alvo = c.folgaCorredor + extra;
    let a = 0;
    let b = 4;
    while (b < 80 && fora(ox + dx * b, oz + dz * b) < alvo) b *= 2;
    for (let i = 0; i < 26; i++) {
      const m = (a + b) / 2;
      if (fora(ox + dx * m, oz + dz * m) < alvo) a = m;
      else b = m;
    }
    return b;
  }
  return { fora, dentro, borda, folga: c.folgaCorredor, curva: lados.map((l) => l.curva) };
}

// ---------- A câmera de trás (para preferir os lugares que aparecem na tela) ----------

// Réplica de posicionarCamera (js/main.js) com os números de fábrica e a tela de um celular em pé. É de
// propósito que não lê o CONFIG de quem joga: a montagem tem que ser igual para todo mundo.
// (Exportada para os testes e a página de inspeção desenharem o que o celular enxerga.)
const CAMERA = { atras: 6, atrasCobrador: 3.5, altura: 2.2, pesoCobrador: 0.4, larguraVisivel: 32, fovMin: 40, aspecto: 0.46 };
const GRAUS = Math.PI / 180;

export function cameraDeTras(bola, inicio, golLargura = 7.32, golAltura = 2.44) {
  const k = CAMERA;
  const fov = Math.max(k.fovMin * GRAUS, 2 * Math.atan(Math.tan((k.larguraVisivel * GRAUS) / 2) / k.aspecto));
  const hfov = 2 * Math.atan(Math.tan(fov / 2) * k.aspecto);
  const dist = Math.hypot(bola.x, bola.z) || 1;
  const ax = bola.x / dist;
  const az = bola.z / dist;
  const lx = az;
  const lz = -ax;
  const kx = inicio.x - bola.x;
  const kz = inicio.z - bola.z;
  const lateral = kx * lx + kz * lz;
  const fundo = kx * ax + kz * az;
  const meia = golLargura / 2 + 1.0;
  let atras = Math.max(k.atras, fundo + k.atrasCobrador);
  let cx = 0;
  let cz = 0;
  let yaw = 0;
  let inclinacao = 0;
  for (let i = 0; i < 16; i++) {
    cx = bola.x + ax * atras + lx * lateral * k.pesoCobrador;
    cz = bola.z + az * atras + lz * lateral * k.pesoCobrador;
    const ang = (px, pz) => Math.atan2((px - cx) * lx + (pz - cz) * lz, -((px - cx) * ax + (pz - cz) * az));
    const dCobrador = Math.hypot(inicio.x - cx, inicio.z - cz);
    const aCobrador = ang(inicio.x, inicio.z);
    const folga = Math.atan2(0.7, dCobrador);
    const h = [ang(-meia, 0), ang(meia, 0), ang(bola.x, bola.z), aCobrador - folga, aCobrador + folga];
    const v0 = Math.atan2(-k.altura, dCobrador);
    const v1 = Math.atan2(golAltura + 0.4 - k.altura, Math.hypot(cx, cz));
    const hMin = Math.min(...h);
    const hMax = Math.max(...h);
    yaw = (hMin + hMax) / 2;
    inclinacao = (v0 + v1) / 2;
    if (hMax - hMin <= hfov * 0.86 && v1 - v0 <= fov * 0.9) break;
    atras += 0.75;
  }
  // Base da câmera: frente (para onde olha), direita e cima
  const fx0 = -ax * Math.cos(yaw) + lx * Math.sin(yaw);
  const fz0 = -az * Math.cos(yaw) + lz * Math.sin(yaw);
  const ci = Math.cos(inclinacao);
  const f = { x: fx0 * ci, y: Math.sin(inclinacao), z: fz0 * ci };
  const r = { x: -fz0, z: fx0 };
  const u = { x: -f.y * fx0, y: ci, z: -f.y * fz0 };
  const tv = Math.tan(fov / 2);
  const th = tv * k.aspecto;
  // Ponto do mundo → tela (x e y de −1 a 1; p = profundidade em m, ≤ 0 = atrás da câmera)
  const projetar = (x, y, z) => {
    const dx = x - cx;
    const dy = y - k.altura;
    const dz = z - cz;
    const p = dx * f.x + dy * f.y + dz * f.z;
    if (p < 0.5) return { x: 0, y: 0, p: 0 };
    return { x: (dx * r.x + dz * r.z) / (p * th), y: (dx * u.x + dy * u.y + dz * u.z) / (p * tv), p };
  };
  // O que um boneco de pé em (x, z) ocupa na tela: dois retângulos, o corpo (até os ombros, com meiaLargura m
  // para cada lado) e a cabeça. null = atrás da câmera.
  const silhueta = (x, z, altura = 1.85, meiaLargura = 0.3) => {
    const pe = projetar(x, 0, z);
    if (pe.p <= 0) return null;
    const ombro = projetar(x, altura - 0.33, z);
    const topo = projetar(x, altura + 0.03, z);
    const w = meiaLargura / (pe.p * th);
    const wc = 0.13 / (pe.p * th);
    return {
      p: pe.p, x0: pe.x - w, x1: pe.x + w, y0: pe.y, y1: topo.y,
      partes: [
        { x0: pe.x - w, x1: pe.x + w, y0: pe.y, y1: ombro.y },
        { x0: ombro.x - wc, x1: ombro.x + wc, y0: ombro.y, y1: topo.y },
      ],
    };
  };
  return {
    projetar, silhueta,
    pos: { x: cx, y: k.altura, z: cz },
    olhar: { x: cx + f.x * 30, y: k.altura + f.y * 30, z: cz + f.z * 30 },
    fov: fov / GRAUS, aspecto: k.aspecto,
  };
}

// Quanto de um retângulo fica tapado por outro (0 a 1)
function tapado(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? (w * h) / ((a.x1 - a.x0) * (a.y1 - a.y0)) : 0;
}

// Como o boneco aparece na tela do celular antes do chute. Devolve { visto, cortado }:
//   visto    0 a 1: quanto dele se vê (dentro da tela, fora das faixas da interface em cima e embaixo, sem
//            ninguém na frente); quem ele esconde também desconta um pouco
//   cortado  true se a borda da tela passa por cima dele (meio corpo para fora: feio)
function notaDeVisao(sil, ocupados) {
  if (!sil) return { visto: 0, cortado: false };
  if (sil.x1 < -1 || sil.x0 > 1) return { visto: 0, cortado: false };
  if (sil.x0 < -0.97 || sil.x1 > 0.97) return { visto: 0, cortado: true };
  if (sil.y0 < -0.5 || sil.y1 > 0.56) return { visto: 0, cortado: false };
  let escondido = 0;
  let total = 0;
  let esconde = 0;
  for (const parte of sil.partes) {
    const area = (parte.x1 - parte.x0) * (parte.y1 - parte.y0);
    let pior = 0;
    for (const o of ocupados) {
      for (const q of o.partes) {
        if (o.p < sil.p) pior = Math.max(pior, tapado(parte, q)); // o outro está na frente
        else esconde = Math.max(esconde, tapado(q, parte));          // ele ficaria na frente do outro
      }
    }
    escondido += pior * area;
    total += area;
  }
  return { visto: limitar(1 - (escondido / total) * 1.25 - esconde * 0.5, 0, 1), cortado: false };
}

// ---------- Montagem ----------

// Monta os figurantes de uma cobrança. posBola: {x, z}. barreira: o que montarBarreira devolveu (ou semBarreira).
// aleatorio: função de 0 a 1 com semente (mesma semente, mesmos jogadores: o replay repete).
// opcoes: { penalti: bool, cobrador: { x, z } (onde o cobrador espera para correr), pe: 'D' | 'E',
//           goleiro: { x, z } }.
// Devolve { jogadores: [...], batidas, ultimaBatida, bola, penalti, ... }. Cada jogador:
//   x, z, rotacaoY   onde está agora e para onde o corpo começa virado (0 = olhando para +z)
//   time             'ataque' (companheiro do cobrador) | 'defesa'
//   altura, raio     m (a colisão usa)
//   papel            'area' | 'marca' | 'sobra' | 'solto' | 'linha' | 'curto' | 'atras' | 'ponta' | 'fila'
//   par              índice de quem ele marca (ou de quem o marca); −1 = sozinho
//   lado             −1 | +1: de que lado do corredor do chute ele está (x menor ou maior)
//   numero, aparencia  número da camisa e índice da aparência genérica (fixos por time e ordem)
//   base, plano      onde espera e o passo que dá depois do chute ({ x, z, atraso, duracao } ou null)
//   vx, vz, andando  velocidade agora (m/s) e quanto do passo já deu (0 a 1), para o desenho
//   jeito            número de 0 a 1 sorteado (o desenho escolhe o jeito de esperar com ele)
//   visto            0 a 1: quanto aparece na câmera de trás de um celular (só informação)
//   yPes, batida     altura da sola (sempre 0) e força da última bolada
export function montarFigurantes(posBola, barreira, cfg = {}, aleatorio = Math.random, opcoes = {}) {
  const c = lerCfg(cfg);
  const quantidade = limitar(Math.round(Number(c.quantidade) || 0), 0, MAXIMO_FIGURANTES);
  const B = { x: posBola.x, z: posBola.z };
  const penalti = !!opcoes.penalti;
  const f = {
    jogadores: [],
    bola: B,
    penalti,
    batidas: 0,           // quantas vezes a bola bateu num figurante
    ultimaBatida: null,   // { jogador, time, parte, impacto }
    fimDoMovimento: 0,    // s depois do chute em que o último para de andar
    caixa: null,          // { x0, x1, z0, z1 }: onde eles ficam e andam (descarte rápido na colisão)
    _t: null,
    _anterior: null,      // posição da bola na última checagem (para a bola rápida não atravessar)
    _bola: null,
  };

  // Sorteios sempre na mesma ordem e na mesma quantidade (um bloco por papel): mesma semente, mesma montagem,
  // e com menos gente os que ficam não mudam de lugar
  const blocos = [];
  for (let i = 0; i < 20; i++) {
    const b = [];
    for (let k = 0; k < 8; k++) b.push(aleatorio());
    blocos.push(b);
  }
  if (!quantidade) return f;

  const dist = Math.hypot(B.x, B.z) || 1;
  const ax = B.x / dist;  // do gol para a bola
  const az = B.z / dist;
  const lx = az;          // direita de quem cobra
  const lz = -ax;
  const meia = (cfg.golLargura ?? 7.32) / 2;
  const muro = barreira && barreira.jogadores ? barreira.jogadores : [];
  const pe = opcoes.pe === 'E' ? 'E' : 'D';
  // Onde o cobrador espera: sem a informação, uns 2,4 m atrás e ao lado (o destro vem pela esquerda)
  const ladoPe = pe === 'D' ? -1 : 1;
  const cobrador = opcoes.cobrador && Number.isFinite(opcoes.cobrador.x) && Number.isFinite(opcoes.cobrador.z)
    ? { x: opcoes.cobrador.x, z: opcoes.cobrador.z }
    : { x: B.x + ax * 2.1 + lx * ladoPe * 1.2, z: B.z + az * 2.1 + lz * ladoPe * 1.2 };
  const goleiro = opcoes.goleiro && Number.isFinite(opcoes.goleiro.x) ? { x: opcoes.goleiro.x, z: opcoes.goleiro.z ?? 0.4 } : { x: 0, z: 0.4 };
  const corredor = corredorDoChute(B, cfg);
  const camera = cameraDeTras(B, cobrador, cfg.golLargura ?? 7.32, cfg.golAltura ?? 2.44);
  // Lado para onde a câmera de trás olha mais: o de onde o cobrador vem
  const latCobrador = (cobrador.x - B.x) * lx + (cobrador.z - B.z) * lz;
  const ladoCamera = Math.abs(latCobrador) > 0.15 ? Math.sign(latCobrador) : ladoPe;

  const ctx = { c, B, ax, az, lx, lz, meia, muro, cobrador, goleiro, corredor, penalti };

  // Quem já está na tela da câmera de trás: o cobrador, a barreira e o goleiro
  const ocupados = [];
  const ocupar = (x, z, altura, meiaLargura) => {
    const r = camera.silhueta(x, z, altura, meiaLargura);
    if (r) ocupados.push(r);
  };
  ocupar(cobrador.x, cobrador.z, 1.86, 0.42);
  for (const j of muro) ocupar(j.x, j.z, j.altura || 1.85, 0.3);
  ocupar(goleiro.x, goleiro.z, 1.9, 0.4);

  const postos = penalti ? postosDoPenalti(ctx, blocos) : postosDaFalta(ctx, blocos, ladoCamera);
  const limiteDefesa = 10 - muro.length; // um time tem 10 de linha: a barreira já gastou alguns
  const contagem = { ataque: 0, defesa: 0 };
  const colocados = [];   // { x, z } de quem já tem lugar (o índice é o do jogador)
  const indiceDoPosto = new Map();

  for (let n = 0; n < postos.length && f.jogadores.length < quantidade; n++) {
    const posto = postos[n];
    if (posto.time === 'defesa' && contagem.defesa >= limiteDefesa) continue;
    if (contagem[posto.time] >= ALTURAS.length) continue;
    const parceiro = posto.par != null && indiceDoPosto.has(posto.par) ? indiceDoPosto.get(posto.par) : -1;
    if (posto.par != null && posto.exigePar && parceiro < 0) continue;
    const s = Math.floor(blocos[n][0] * 4294967296) | 0;

    // Entre os lugares que servem, o que aparece melhor na câmera de trás (com um tempero de sorteio)
    let melhor = null;
    const candidatos = posto.candidatos(parceiro >= 0 ? f.jogadores[parceiro] : null);
    for (let i = 0; i < candidatos.length; i++) {
      const p = candidatos[i];
      if (posto.minBola && Math.hypot(p.x - B.x, p.z - B.z) < posto.minBola) continue;
      if (problema(ctx, p.x, p.z, posto.time, colocados, parceiro)) continue;
      const ret = camera.silhueta(p.x, p.z);
      const v = notaDeVisao(ret, ocupados);
      const nota = 3 * v.visto + ruido(s, i) - (p.custo || 0) - (v.cortado ? 1.5 : 0);
      if (!melhor || nota > melhor.nota) melhor = { x: p.x, z: p.z, nota, visto: v.visto, ret, lado: p.lado };
    }
    // Nenhum serviu (falta em lugar estranho): procura em volta do primeiro, cada vez mais longe
    if (!melhor && candidatos.length && parceiro < 0) {
      const o = candidatos[0];
      busca:
      for (let raio = 1; raio <= 24; raio += 1) {
        for (let k = 0; k < 16; k++) {
          const a = (k + ruido(s, 99)) * (Math.PI / 8);
          const x = o.x + Math.sin(a) * raio;
          const z = o.z + Math.cos(a) * raio;
          if (problema(ctx, x, z, posto.time, colocados, -1)) continue;
          const ret = camera.silhueta(x, z);
          melhor = { x, z, nota: 0, visto: notaDeVisao(ret, ocupados).visto, ret, lado: o.lado };
          break busca;
        }
      }
    }
    if (!melhor) continue;

    const time = posto.time;
    const k = contagem[time]++;
    const indice = f.jogadores.length;
    const lado = melhor.lado || (((melhor.x - B.x) * lx + (melhor.z - B.z) * lz) >= 0 ? 1 : -1);
    const jog = {
      x: melhor.x,
      z: melhor.z,
      rotacaoY: 0,
      time,
      altura: ALTURAS[time === 'ataque' ? (k * 3 + 1) % ALTURAS.length : (k * 7 + 2) % ALTURAS.length],
      raio: c.raio,
      papel: posto.papel,
      par: parceiro,
      lado,
      numero: NUMEROS[time][k],
      aparencia: time === 'ataque' ? k * 3 + 2 : k * 5 + 4,
      base: { x: melhor.x, z: melhor.z },
      plano: null,
      vx: 0,
      vz: 0,
      andando: 0,
      jeito: blocos[n][1],
      visto: melhor.visto,
      yPes: 0,
      batida: 0,
      _sorteios: blocos[n],
    };
    if (parceiro >= 0) f.jogadores[parceiro].par = indice;
    jog.rotacaoY = posto.olhar(jog, parceiro >= 0 ? f.jogadores[parceiro] : null);
    f.jogadores.push(jog);
    colocados.push({ x: jog.x, z: jog.z });
    indiceDoPosto.set(n, indice);
    if (melhor.ret) ocupados.push(melhor.ret);
  }

  if (c.movimento) planejarMovimento(ctx, f);
  for (const j of f.jogadores) delete j._sorteios;

  // Caixa em volta de tudo (com o que andam), para a colisão descartar rápido a bola que está longe
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const j of f.jogadores) {
    for (const p of j.plano ? [j.base, j.plano] : [j.base]) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      z0 = Math.min(z0, p.z);
      z1 = Math.max(z1, p.z);
    }
    if (j.plano) f.fimDoMovimento = Math.max(f.fimDoMovimento, j.plano.atraso + j.plano.duracao);
  }
  f.caixa = f.jogadores.length ? { x0: x0 - 0.8, x1: x1 + 0.8, z0: z0 - 0.8, z1: z1 + 0.8 } : null;
  return f;
}

// Por que um jogador do time `time` não pode ficar em (x, z): devolve o nome da regra quebrada, ou null se
// pode. colocados: quem já tem lugar; parceiro: índice (em colocados) de quem forma dupla com ele.
function problema(ctx, x, z, time, colocados, parceiro = -1) {
  const { B, ax, az, lx, lz, meia } = ctx;
  if (Math.abs(x) > CAMPO.meiaLargura - MINIMO.borda || z < MINIMO.linhaDeFundo || z > CAMPO.meio - MINIMO.borda) return 'campo';
  const rx = x - B.x;
  const rz = z - B.z;
  const dBola = Math.hypot(rx, rz);
  if (dBola < (time === 'defesa' ? MINIMO.bolaDefesa : MINIMO.bolaAtaque)) return 'bola';
  if (ctx.penalti) {
    // Pênalti: fora da grande área, fora da meia-lua e atrás da linha da bola (vale para os dois times)
    if (z < AREA.fundo + 0.35 && Math.abs(x) < AREA.meiaLargura + 0.35) return 'area';
    if (dBola < MINIMO.bolaDefesa) return 'bola';
    if (z < B.z + 0.3) return 'linhaDaBola';
  }
  if (ctx.corredor.dentro(x, z)) return 'corredor';
  const atras = rx * ax + rz * az;
  if (atras > -0.5 && atras < MINIMO.cameraAtras && Math.abs(rx * lx + rz * lz) < MINIMO.cameraLado) return 'camera';
  if (distanciaAoSegmento(x, z, ctx.cobrador, B) < MINIMO.corrida) return 'corrida';
  if (Math.hypot(x - ctx.goleiro.x, z - ctx.goleiro.z) < MINIMO.goleiro) return 'goleiro';
  if (Math.hypot(Math.abs(x) - meia, z) < MINIMO.trave) return 'trave';
  for (const b of ctx.muro) if (Math.hypot(x - b.x, z - b.z) < MINIMO.barreira) return 'barreira';
  for (let i = 0; i < colocados.length; i++) {
    const d = Math.hypot(x - colocados[i].x, z - colocados[i].z);
    if (i === parceiro) {
      if (d < MINIMO.parMin || d > MINIMO.parMax) return 'par';
    } else if (d < MINIMO.outro) return 'perto';
  }
  return null;
}

// Para onde o corpo fica virado (0 = olhando para +z): de frente para o ponto (px, pz)
const virar = (j, px, pz) => Math.atan2(px - j.x, pz - j.z);
// Ângulo entre dois ângulos, pelo caminho mais curto (k = 0 → a, 1 → b)
function entreAngulos(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

// Postos de uma falta, do mais para o menos importante. Cada posto: { time, papel, par (índice do posto do
// parceiro), exigePar, candidatos(parceiro) → [{ x, z, lado, custo }], olhar(jogador, parceiro) → rotacaoY }.
function postosDaFalta(ctx, blocos, ladoCamera) {
  const { B, ax, az, lx, lz, muro, corredor } = ctx;
  const dist = Math.hypot(B.x, B.z) || 1;
  const anguloFalta = Math.atan2(B.x, B.z) / GRAUS;
  // Falta lateral: o lado de longe (segunda trave) é onde fica o grosso; de frente, o lado da câmera
  const lateral = Math.abs(anguloFalta) >= 10;
  const ladoLonge = B.x > 0 ? -1 : 1;
  const M = lateral ? ladoLonge : ladoCamera; // lado principal
  const S = -M;
  // A que distância do gol fica a "linha" da defesa: a da barreira (em falta de longe, a risca da área)
  let zMuro = 0;
  for (const j of muro) zMuro += j.z / muro.length;
  if (!muro.length) zMuro = Math.max(4, (dist - DISTANCIA_REGRA) * az);
  const zLinha = limitar(zMuro - 0.2, 7.5, 17.2);
  const entre = (k) => misturar(6.2, zLinha, k); // entre a pequena área (0) e a linha da defesa (1)

  // Lugares colados na borda do corredor: do lado `lado`, a z m do gol (de z0 a z1), de e0 a e1 m para fora
  // (quanto mais longe do corredor, um pouco pior: na dúvida, ficam perto do lance)
  const naBorda = (bloco, lado, z0, z1, e0, e1, nz = 5, ne = 5) => {
    const lista = [];
    const zMax = B.z - 0.5;
    for (let i = 0; i < nz; i++) {
      for (let k = 0; k < ne; k++) {
        const z = Math.min(zMax, misturar(z0, z1, nz > 1 ? (i + 0.15 + 0.7 * bloco[2 + ((i + k) % 3)]) / nz : 0.5));
        const e = misturar(e0, e1, ne > 1 ? (k + 0.1 + 0.8 * bloco[5 + ((i * 2 + k) % 3)]) / ne : 0.5);
        const ox = (B.x * z) / B.z; // ponto da reta bola → meio do gol a z m da linha
        lista.push({ x: ox + lado * corredor.borda(ox, z, lado, 0, e), z, lado, custo: 0.22 * (e - e0) });
      }
    }
    return lista;
  };
  // Marcador: a uns 0,75 m do atacante, do lado do gol ou por fora (nunca dentro do corredor)
  const colado = (bloco) => (atacante) => {
    if (!atacante) return [];
    const lista = [];
    const paraOGol = Math.atan2(-atacante.x * 0.35, -atacante.z); // meio para o gol, meio para a linha de fundo
    for (let i = 0; i < 12; i++) {
      const a = paraOGol - atacante.lado * (-0.5 + i * 0.32) + (bloco[2] - 0.5) * 0.2;
      const r = 0.7 + 0.1 * bloco[3 + (i % 3)];
      lista.push({ x: atacante.x + Math.sin(a) * r, z: atacante.z + Math.cos(a) * r, lado: atacante.lado, custo: 0.12 * i });
    }
    return lista;
  };
  // À frente da bola (m na direção do gol), colado na borda do corredor, do lado `lado`
  const aFrente = (bloco, lado, f0, f1, e0, e1) => {
    const lista = [];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) {
        const fr = misturar(f0, f1, (i + bloco[2 + (k % 3)]) / 4);
        const e = misturar(e0, e1, (k + bloco[5 + (i % 3)]) / 4);
        const ox = B.x - ax * fr;
        const oz = B.z - az * fr;
        const t = corredor.borda(ox, oz, lado * lx, lado * lz, e);
        lista.push({ x: ox + lado * lx * t, z: oz + lado * lz * t, lado });
      }
    }
    return lista;
  };
  // Atrás da bola, fora da faixa da câmera: de l0 a l1 m para o lado, de a0 a a1 m atrás
  const atrasDaBola = (bloco, lado, l0, l1, a0, a1) => {
    const lista = [];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) {
        const lat = lado * misturar(l0, l1, (i + bloco[2 + (k % 3)]) / 4);
        const at = misturar(a0, a1, (k + bloco[5 + (i % 3)]) / 4);
        lista.push({ x: B.x + ax * at + lx * lat, z: B.z + az * at + lz * lat, lado, custo: 0.1 * i });
      }
    }
    return lista;
  };

  // Para onde cada um olha antes do chute
  const paraABola = (bloco, desvio = 0.3) => (j) => virar(j, B.x, B.z) + (bloco[4] - 0.5) * desvio;
  const marcando = (bloco) => (j, atacante) => {
    const bola = virar(j, B.x, B.z);
    return atacante ? entreAngulos(bola, virar(j, atacante.x, atacante.z), 0.3 + 0.2 * bloco[4]) : bola;
  };
  const paraOGol = (bloco) => (j) => entreAngulos(virar(j, 0, 0), virar(j, B.x, B.z), 0.15 + 0.2 * bloco[4]);

  const b = blocos;
  // Atacante que ganha marcador fica um pouco além dos 9,15 m da bola, para o marcador caber do lado dele
  const comMarcador = MINIMO.bolaDefesa + 0.55;
  const postos = [
    // 0-1: a dupla da quina da pequena área, do lado principal
    { time: 'ataque', papel: 'area', minBola: comMarcador, candidatos: () => naBorda(b[0], M, 5.2, 6.9, 0.1, 2.0), olhar: paraABola(b[0]) },
    { time: 'defesa', papel: 'marca', par: 0, exigePar: true, candidatos: colado(b[1]), olhar: marcando(b[1]) },
    // 2-3: a dupla na linha da barreira (em falta lateral, no meio da área)
    { time: 'ataque', papel: 'area', minBola: comMarcador, candidatos: () => naBorda(b[2], M, zLinha - 0.9, zLinha + 0.5, 0.1, 2.2), olhar: paraABola(b[2]) },
    { time: 'defesa', papel: 'marca', par: 2, exigePar: true, candidatos: colado(b[3]), olhar: marcando(b[3]) },
    // 4: o zagueiro da sobra, fundo, perto da trave
    { time: 'defesa', papel: 'sobra', candidatos: () => naBorda(b[4], M, 2.4, 3.9, 0.3, 3.0), olhar: paraABola(b[4], 0.2) },
    // 5-6: a dupla do outro lado (em falta lateral, a opção curta do lado da bola, na altura da barreira)
    {
      time: 'ataque', papel: 'area', minBola: comMarcador,
      candidatos: () => (lateral ? naBorda(b[5], S, zLinha - 1.6, zLinha + 0.4, 0.1, 1.6) : naBorda(b[5], S, 6.4, Math.max(7.4, Math.min(10.5, zLinha - 1.2)), 0.1, 1.6)),
      olhar: paraABola(b[5]),
    },
    { time: 'defesa', papel: 'marca', par: 5, exigePar: true, candidatos: colado(b[6]), olhar: marcando(b[6]) },
    // 7: um atacante solto do lado da câmera, entre a pequena área e a linha
    { time: 'ataque', papel: 'solto', candidatos: () => naBorda(b[7], ladoCamera, entre(0.25), entre(0.75), 0.6, 3.2), olhar: paraABola(b[7]) },
    // 8: um defensor fechando o outro lado (de frente: atrás da barreira, na cobertura; lateral: na primeira trave)
    {
      time: 'defesa', papel: 'linha',
      candidatos: () => (lateral ? naBorda(b[8], S, 2.6, 6.4, 0.3, 2.0) : naBorda(b[8], S, Math.max(7.6, zLinha - 3.4), Math.max(8.6, zLinha - 1.5), 0.3, 1.8)),
      olhar: paraABola(b[8], 0.2),
    },
    // 9: um companheiro atrás da bola, do lado contrário ao da corrida (aparece no replay)
    { time: 'ataque', papel: 'atras', candidatos: () => atrasDaBola(b[9], -ladoCamera, 5.8, 8.5, 0.6, 6.5), olhar: paraOGol(b[9]) },
    // 10: um companheiro adiantado, a uns passos da bola
    { time: 'ataque', papel: 'curto', candidatos: () => aFrente(b[10], -ladoCamera, 3.8, 6.8, 0.4, 2.2), olhar: (j) => entreAngulos(virar(j, B.x, B.z), virar(j, 0, 0), 0.25 + 0.3 * b[10][4]) },
    // 11: um zagueiro na cobertura, por fora
    { time: 'defesa', papel: 'linha', candidatos: () => naBorda(b[11], M, entre(0.35), entre(0.85), 2.6, 4.8), olhar: paraABola(b[11], 0.2) },
    // 12-13: mais uma dupla, por fora, do lado principal
    { time: 'ataque', papel: 'area', minBola: comMarcador, candidatos: () => naBorda(b[12], M, entre(0.1), entre(0.6), 3.4, 6.0), olhar: paraABola(b[12]) },
    { time: 'defesa', papel: 'marca', par: 12, exigePar: true, candidatos: colado(b[13]), olhar: marcando(b[13]) },
    // 14: outro companheiro atrás da bola, do lado da corrida, bem aberto
    { time: 'ataque', papel: 'atras', candidatos: () => atrasDaBola(b[14], ladoCamera, 7.0, 11, 1.5, 8), olhar: paraOGol(b[14]) },
    // 15-18: pontas, mais um na área e mais um lá atrás (entram quando falta gente para completar)
    { time: 'ataque', papel: 'ponta', candidatos: () => naBorda(b[15], S, zLinha - 2.5, zLinha + 1, 3.5, 7.5), olhar: paraABola(b[15]) },
    { time: 'ataque', papel: 'area', candidatos: () => naBorda(b[16], S, 2.6, 4.6, 0.5, 2.2), olhar: paraABola(b[16]) },
    { time: 'ataque', papel: 'ponta', candidatos: () => naBorda(b[17], M, zLinha - 2, zLinha + 1, 6.5, 10), olhar: paraABola(b[17]) },
    { time: 'ataque', papel: 'atras', candidatos: () => atrasDaBola(b[18], -ladoCamera, 9, 14, 3, 10), olhar: paraOGol(b[18]) },
  ];
  return postos;
}

// Pênalti: a fila na risca da grande área e na meia-lua, os dois times misturados, prontos para o rebote
function postosDoPenalti(ctx, blocos) {
  const { B } = ctx;
  const raio = MINIMO.bolaDefesa + 0.15;
  const espelho = blocos[19][0] < 0.5 ? 1 : -1; // de que lado fica cada time muda de um pênalti para o outro
  // Lugar na fila: x m do meio; quem está em frente à meia-lua fica em cima dela
  const naRisca = (bloco, x) => () => {
    const lista = [];
    for (let i = 0; i < 6; i++) {
      const xi = x + Math.sign(x) * (i * 0.22 + 0.3 * (bloco[2 + (i % 3)] - 0.5));
      const arco = Math.abs(xi) < raio ? B.z + Math.sqrt(raio * raio - xi * xi) : 0;
      const z = Math.max(AREA.fundo + 0.42 + 0.35 * bloco[5 + (i % 3)], arco + 0.05 + 0.2 * bloco[5]);
      lista.push({ x: xi, z, lado: Math.sign(x), custo: 0.2 * i });
    }
    return lista;
  };
  const colado = (bloco) => (vizinho) => {
    if (!vizinho) return [];
    const lista = [];
    for (let i = 0; i < 8; i++) {
      const r = 0.7 + 0.1 * bloco[3 + (i % 3)];
      const a = vizinho.lado * (Math.PI / 2) + (i % 2 ? 1 : -1) * 0.18 * Math.ceil(i / 2) * vizinho.lado + (bloco[2] - 0.5) * 0.1;
      lista.push({ x: vizinho.x + Math.sin(a) * r, z: vizinho.z + Math.cos(a) * r, lado: vizinho.lado, custo: 0.1 * i });
    }
    return lista;
  };
  const olhar = (bloco) => (j) => virar(j, B.x * 0.5, B.z - 4) + (bloco[4] - 0.5) * 0.25;
  const A = 'ataque';
  const D = 'defesa';
  const e = espelho;
  const fila = (time, x, n) => ({ time, papel: 'fila', candidatos: naRisca(blocos[n], x), olhar: olhar(blocos[n]) });
  const dupla = (time, par, n) => ({ time, papel: 'fila', par, exigePar: true, candidatos: colado(blocos[n]), olhar: olhar(blocos[n]) });
  return [
    fila(A, e * 5.9, 0), fila(D, -e * 5.9, 1),
    fila(A, e * 8.0, 2), dupla(D, 2, 3),
    fila(D, -e * 8.0, 4), dupla(A, 4, 5),
    fila(D, e * 10.9, 6), fila(A, -e * 10.9, 7),
    fila(A, e * 12.9, 8), fila(D, -e * 12.9, 9),
    fila(D, e * 14.9, 10), fila(A, -e * 14.9, 11),
    fila(A, e * 16.9, 12), fila(D, -e * 16.9, 13),
    fila(A, -e * 18.6, 14), fila(A, e * 18.6, 15),
  ];
}

// ---------- O passo para o rebote ----------

// Depois do chute cada um anda um pouco (os da área descem para perto do gol, colados no corredor; o marcador
// vai junto com o seu atacante; os de trás dão uns passos à frente; no pênalti, todo mundo invade a área).
// Tudo decidido aqui, na montagem: depois é só função do tempo.
function planejarMovimento(ctx, f) {
  const { B, ax, az, corredor } = ctx;
  const lista = f.jogadores;
  const pa = { x: 0, z: 0 };
  const pb = { x: 0, z: 0 };
  // Onde o jogador j está no instante t (s depois do chute) se o plano dele for p
  const emT = (j, p, t, saida) => {
    const k = p ? suave((t - p.atraso) / p.duracao) : 0;
    saida.x = p ? misturar(j.base.x, p.x, k) : j.base.x;
    saida.z = p ? misturar(j.base.z, p.z, k) : j.base.z;
    return saida;
  };
  // O lugar e o caminho até ele servem? Fora do corredor o tempo todo, dentro do campo, longe do goleiro,
  // das traves, da barreira e de onde o cobrador termina o chute
  const lugarServe = (j, x, z) => {
    if (Math.abs(x) > CAMPO.meiaLargura - MINIMO.borda || z < 1.3 || z > CAMPO.meio - MINIMO.borda) return false;
    for (let k = 1; k <= 8; k++) {
      const u = k / 8;
      if (corredor.dentro(misturar(j.base.x, x, u), misturar(j.base.z, z, u))) return false;
    }
    if (Math.hypot(x - ctx.goleiro.x, z - ctx.goleiro.z) < MINIMO.goleiro) return false;
    if (Math.hypot(Math.abs(x) - ctx.meia, z) < MINIMO.trave) return false;
    if (Math.hypot(x - B.x, z - B.z) < 2.6) return false;
    for (const m of ctx.muro) if (distanciaAoSegmento(m.x, m.z, j.base, { x, z }) < 1.3) return false;
    return true;
  };
  // Com o plano p, o jogador de índice n passa longe de todos os outros o tempo todo? (menos do parceiro)
  const passaLonge = (n, p) => {
    const j = lista[n];
    for (let i = 0; i < lista.length; i++) {
      if (i === n || i === j.par) continue;
      const o = lista[i];
      for (let t = 0; t <= 2.61; t += 0.2) {
        emT(j, p, t, pa);
        emT(o, o.plano, t, pb);
        if (Math.hypot(pa.x - pb.x, pa.z - pb.z) < 1.3) return false;
      }
    }
    return true;
  };

  for (let i = 0; i < lista.length; i++) {
    const j = lista[i];
    if (j.par >= 0 && j.par < i) continue; // o parceiro (que entrou antes) já decidiu pelos dois
    const s = j._sorteios;
    const atraso = 0.1 + 0.25 * s[6];
    let velocidade = 2.6 + 1.0 * s[7];
    const tentativas = []; // alvos, do mais longe para o mais perto
    if (j.papel === 'fila') {
      // Pênalti: invade a área correndo, fechando um pouco para o meio
      velocidade = 4.6 + 1.2 * s[7];
      const fundo = B.z + 1.4 + 0.12 * Math.abs(j.base.x) + 0.8 * s[5];
      for (const k of [1, 0.7, 0.45]) tentativas.push({ x: j.base.x * misturar(1, 0.8, k), z: j.base.z - k * (j.base.z - fundo) });
    } else if (j.papel === 'atras') {
      // Uns passos à frente, acompanhando o lance
      velocidade = 1.8 + 0.6 * s[7];
      for (const k of [1, 0.6]) {
        const d = k * (1.2 + 1.3 * s[5]);
        tentativas.push({ x: j.base.x - ax * d, z: j.base.z - az * d });
      }
    } else {
      // Na área (e o adiantado): desce em direção ao gol, na mesma distância do corredor
      const extra = Math.max(0, corredor.fora(j.base.x, j.base.z) - corredor.folga);
      const quanto = j.papel === 'sobra' ? 0.5 + 0.6 * s[5]
        : j.papel === 'curto' ? 2.2 + 1.6 * s[5]
          : j.papel === 'linha' ? 1.0 + 1.0 * s[5]
            : 1.3 + 1.4 * s[5];
      const naBorda = (z) => {
        const ox = (B.x * z) / B.z;
        return { x: ox + j.lado * corredor.borda(ox, z, j.lado, 0, extra), z };
      };
      for (const k of [1, 0.65, 0.4]) {
        let alvo = naBorda(j.base.z - quanto * k);
        // Perto da bola a borda do corredor abre depressa: o passo é medido no chão, não só em direção ao gol
        const d = Math.hypot(alvo.x - j.base.x, alvo.z - j.base.z);
        if (d > quanto * k) alvo = naBorda(j.base.z - (quanto * k * quanto * k) / d);
        if (alvo.z >= 1.3) tentativas.push(alvo);
      }
    }
    const par = j.par > i ? lista[j.par] : null;
    for (const alvo of tentativas) {
      const d = Math.hypot(alvo.x - j.base.x, alvo.z - j.base.z);
      if (d < 0.25) continue;
      const p = { x: alvo.x, z: alvo.z, atraso, duracao: d / velocidade + 0.3 };
      if (!lugarServe(j, p.x, p.z) || !passaLonge(i, p)) continue;
      if (par) {
        // A dupla anda junta (mesmo passo, mesmo instante): a distância entre os dois não muda
        const q = { x: p.x + (par.base.x - j.base.x), z: p.z + (par.base.z - j.base.z), atraso: p.atraso, duracao: p.duracao };
        if (!lugarServe(par, q.x, q.z) || !passaLonge(j.par, q)) continue;
        par.plano = q;
      }
      j.plano = p;
      break;
    }
  }
}

// Movimento que vale para a colisão. tDesdeChute: segundos desde o chute (negativo = antes: todos no lugar).
// Só depende do tempo e da montagem: o replay repete.
export function atualizarFigurantes(f, tDesdeChute) {
  if (!f || !f.jogadores.length) return;
  const t = tDesdeChute > 0 ? tDesdeChute : 0;
  if (f._t === t) return;
  // Todo mundo já chegou: nada mais muda
  if (f._t !== null && f._t >= f.fimDoMovimento && t >= f.fimDoMovimento) {
    f._t = t;
    return;
  }
  f._t = t;
  for (let i = 0; i < f.jogadores.length; i++) {
    const j = f.jogadores[i];
    const p = j.plano;
    if (!p) continue;
    const u = limitar((t - p.atraso) / p.duracao, 0, 1);
    const k = u * u * (3 - 2 * u);
    j.x = j.base.x + (p.x - j.base.x) * k;
    j.z = j.base.z + (p.z - j.base.z) * k;
    const andando = u > 0 && u < 1;
    const dk = andando ? (6 * u * (1 - u)) / p.duracao : 0;
    j.vx = andando ? (p.x - j.base.x) * dk : 0;
    j.vz = andando ? (p.z - j.base.z) * dk : 0;
    j.andando = u;
  }
}

// ---------- Colisão ----------

// Ponto do corpo do jogador mais perto de p, e o raio da parte. O corpo é uma cápsula vertical (da sola até
// os ombros) e a cabeça é uma esfera no topo, como na barreira (js/barreira.js).
function maisPerto(j, p, c) {
  const base = j.yPes + 0.02 + j.raio;
  const ombro = j.yPes + j.altura - 0.25;
  const cy = Math.min(ombro, Math.max(base, p.y));
  const dCorpo = Math.hypot(p.x - j.x, p.y - cy, p.z - j.z) - j.raio;
  const cabecaY = j.yPes + j.altura - c.raioCabeca;
  const dCabeca = Math.hypot(p.x - j.x, p.y - cabecaY, p.z - j.z) - c.raioCabeca;
  return dCabeca < dCorpo
    ? { y: cabecaY, raio: c.raioCabeca, folga: dCabeca, parte: 'cabeca' }
    : { y: cy, raio: j.raio, folga: dCorpo, parte: 'corpo' };
}

// Colisão da bola com os figurantes. Chamar depois de cada passo(bola, ...). A bola é empurrada para fora do
// corpo e rebate com pouca força. Registra bola.eventos.push({ tipo: 'jogador', time, impacto, jogador,
// parte, x, y, z }). Devolve true se bateu.
export function colidirBolaFigurantes(bola, f, cfg = {}) {
  if (!f || !f.jogadores.length) return false;
  const { pos, vel, giro } = bola;
  const a = f._bola === bola && f._anterior ? f._anterior : pos;
  const cx = f.caixa;
  // Longe de todo mundo (o caso de quase todo passo): só guarda onde a bola está
  if (pos.y > 2.6 || (cx && ((pos.x < cx.x0 && a.x < cx.x0) || (pos.x > cx.x1 && a.x > cx.x1) || (pos.z < cx.z0 && a.z < cx.z0) || (pos.z > cx.z1 && a.z > cx.z1)))) {
    if (f._anterior && f._bola === bola) {
      f._anterior.x = pos.x;
      f._anterior.y = pos.y;
      f._anterior.z = pos.z;
    } else {
      f._anterior = { x: pos.x, y: pos.y, z: pos.z };
      f._bola = bola;
    }
    return false;
  }
  const c = lerCfg(cfg);
  const r = cfg.raioBola ?? 0.11;

  // A bola anda até ~0,15 m por passo: confere vários pontos entre a posição anterior e a atual
  const dx = pos.x - a.x;
  const dy = pos.y - a.y;
  const dz = pos.z - a.z;
  const andou = Math.hypot(dx, dy, dz);
  const amostras = andou > 2 ? 1 : Math.min(40, Math.max(1, Math.ceil(andou / 0.04)));
  let bateu = false;
  const p = { x: 0, y: 0, z: 0 };

  for (let k = 1; k <= amostras && !bateu; k++) {
    const fr = andou > 2 ? 1 : k / amostras;
    p.x = a.x + dx * fr;
    p.y = a.y + dy * fr;
    p.z = a.z + dz * fr;
    for (let i = 0; i < f.jogadores.length; i++) {
      const j = f.jogadores[i];
      if (Math.abs(p.x - j.x) > 0.6 || Math.abs(p.z - j.z) > 0.6) continue;
      const m = maisPerto(j, p, c);
      if (m.folga >= r) continue;

      // Normal da batida: do corpo para a bola (bem no eixo, usa a direção de onde ela veio)
      let nx = p.x - j.x;
      let ny = p.y - m.y;
      let nz = p.z - j.z;
      let d = Math.hypot(nx, ny, nz);
      if (d < 1e-6) {
        const v = Math.hypot(vel.x, vel.y, vel.z) || 1;
        nx = -vel.x / v;
        ny = -vel.y / v;
        nz = -vel.z / v;
        d = 1;
      }
      nx /= d;
      ny /= d;
      nz /= d;
      const encosta = m.raio + r + 1e-3;
      pos.x = j.x + nx * encosta;
      pos.y = Math.max(r, m.y + ny * encosta);
      pos.z = j.z + nz * encosta;

      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) {
        const tx = vel.x - vn * nx;
        const ty = vel.y - vn * ny;
        const tz = vel.z - vn * nz;
        vel.x = tx * c.atrito - vn * c.quique * nx;
        vel.y = ty * c.atrito - vn * c.quique * ny;
        vel.z = tz * c.atrito - vn * c.quique * nz;
        const impacto = -vn;
        if (impacto > 0.5) {
          giro.x *= 0.3;
          giro.y *= 0.3;
          giro.z *= 0.3;
          bola.danca = null;
          if ('curvaTardia' in bola) bola.curvaTardia = null;
          j.batida = impacto;
          f.batidas++;
          f.ultimaBatida = { jogador: i, time: j.time, parte: m.parte, impacto };
          bola.eventos.push({ tipo: 'jogador', time: j.time, impacto, jogador: i, parte: m.parte, x: pos.x, y: pos.y, z: pos.z });
        }
      }
      bateu = true;
      break;
    }
  }

  f._anterior = { x: pos.x, y: pos.y, z: pos.z };
  f._bola = bola;
  return bateu;
}
