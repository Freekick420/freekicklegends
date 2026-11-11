
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
// Dobra de tecido de (x0, y0) a (x1, y1): um vinco escuro com a crista clara ao lado
function dobra(ctx, x0, y0, x1, y1, largura, forca = 0.2) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const comp = Math.hypot(dx, dy);
  if (comp < 1) return;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(dy, dx));
  const g = ctx.createLinearGradient(0, -largura, 0, largura);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.3, `rgba(255,255,255,${forca * 0.55})`);
  g.addColorStop(0.52, 'rgba(128,128,128,0)');
  g.addColorStop(0.68, `rgba(0,0,0,${forca})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  // As pontas somem aos poucos
  const pontas = ctx.createLinearGradient(0, 0, comp, 0);
  pontas.addColorStop(0, 'rgba(0,0,0,0)');
  pontas.addColorStop(0.25, 'rgba(0,0,0,1)');
  pontas.addColorStop(0.75, 'rgba(0,0,0,1)');
  pontas.addColorStop(1, 'rgba(0,0,0,0)');
  const [aux, cx] = novoCanvas(Math.ceil(comp), Math.ceil(largura * 2));
  cx.translate(0, largura);
  cx.fillStyle = g;
  cx.fillRect(0, -largura, comp, largura * 2);
  cx.globalCompositeOperation = 'destination-in';
  cx.fillStyle = pontas;
  cx.fillRect(0, -largura, comp, largura * 2);
  ctx.drawImage(aux, 0, -largura);
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
    // Volume: peitoral, embaixo do peito, sulco da coluna, omoplatas e dorsais
    mancha(ctx, X(0.25 - 0.055), Y(0.3), 34, 20, 0.06);
    mancha(ctx, X(0.25 + 0.055), Y(0.3), 34, 20, 0.06);
    mancha(ctx, X(0.25), Y(0.215), 70, 14, -0.1);
    mancha(ctx, X(0.25), Y(0.31), 7, 30, -0.06);
    mancha(ctx, X(0.75), Y(0.2), 9, 60, -0.1);
    mancha(ctx, X(0.75 - 0.065), Y(0.33), 30, 24, 0.07);
    mancha(ctx, X(0.75 + 0.065), Y(0.33), 30, 24, 0.07);
    mancha(ctx, X(0.75), Y(0.05), 60, 16, -0.07);
    // Lados do corpo, embaixo dos braços
    for (const u of [0, 0.5]) mancha(ctx, X(u), Y(0.2), 26, 70, -0.14);
    // Dobras da axila: saem da axila para o meio do peito e das costas, e para baixo
    for (const [u0, s] of [[M.dobras[0], 1], [M.dobras[1], -1], [M.dobras[2], 1], [M.dobras[3], -1]]) {
      const x0 = X(u0);
      const y0 = Y(0.315);
      dobra(ctx, x0, y0, x0 + s * 44, y0 + 34, 7, 0.2);
      dobra(ctx, x0 + s * 2, y0 + 4, x0 + s * 30, y0 + 58, 8, 0.17);
      dobra(ctx, x0 - s * 2, y0 + 6, x0 + s * 8, y0 + 76, 8, 0.14);
      dobra(ctx, x0 + s * 6, y0 - 6, x0 + s * 52, y0 + 8, 6, 0.12);
    }
    // Dobras da cintura: curtas, quase deitadas, mais fortes nos lados e atrás
    for (let k = 0; k < 22; k++) {
      const u = k / 22 + 0.02 * (r() - 0.5);
      const lado = Math.abs(Math.cos(2 * Math.PI * u));       // 1 nos lados, 0 na frente e atrás
      const y = 0.0 + 0.11 * r() - 0.03;
      const comp = 26 + 30 * r();
      const inclina = (r() - 0.5) * 16 + (u % 0.5 < 0.25 ? -5 : 5);
      dobra(ctx, X(u) - comp / 2, Y(y) - inclina / 2, X(u) + comp / 2, Y(y) + inclina / 2, 5 + 3 * r(), 0.1 + 0.1 * lado + 0.05 * r());
    }
    // Barra: a camisa solta faz ondas
    for (let k = 0; k < 9; k++) {
      const u = (k + 0.5 * r()) / 9;
      dobra(ctx, X(u), Y(-0.03), X(u) + 6 * (r() - 0.5), Y(-0.105), 9, 0.1 + 0.05 * r());
    }
    // Costuras: lados do corpo, ombros (em volta da cava), barra e gola
    costura(ctx, [[X(0.5), Y(0.3)], [X(0.5), Y(-0.105)]], 0.16);
    costura(ctx, [[X(0), Y(0.3)], [X(0), Y(-0.105)]], 0.16);
    for (const [u0, s] of [[M.dobras[0], -1], [M.dobras[1], 1], [M.dobras[2], -1], [M.dobras[3], 1]]) {
      costura(ctx, [[X(u0), Y(0.325)], [X(u0 + s * 0.004), Y(0.4)], [X(u0 + s * 0.02), Y(0.44)], [X(u0 + s * 0.045), Y(0.452)]], 0.16);
    }
    costura(ctx, [[X(-1), Y(-0.092)], [X(2), Y(-0.092)]], 0.2);
    // Sombra logo abaixo da gola
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(X(-1), Y(0.468), 3 * RET.camisa.w, 5);
  });
  ctx.restore();

  // --- Manga ---
  {
    const R = RET.manga;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip();
    // Lado de dentro (as duas beiradas da textura) mais escuro; dobras caindo do ombro
    mancha(ctx, R.x, R.y + R.h / 2, 26, R.h, -0.16);
    mancha(ctx, R.x + R.w, R.y + R.h / 2, 26, R.h, -0.16);
    dobra(ctx, R.x + R.w * 0.36, R.y + 6, R.x + R.w * 0.28, R.y + R.h - 14, 7, 0.16);
    dobra(ctx, R.x + R.w * 0.62, R.y + 10, R.x + R.w * 0.72, R.y + R.h - 20, 8, 0.15);
    dobra(ctx, R.x + R.w * 0.5, R.y + 30, R.x + R.w * 0.47, R.y + R.h - 8, 6, 0.1);
    dobra(ctx, R.x + R.w * 0.14, R.y + 40, R.x + R.w * 0.2, R.y + R.h - 10, 6, 0.12);
    dobra(ctx, R.x + R.w * 0.86, R.y + 36, R.x + R.w * 0.8, R.y + R.h - 12, 6, 0.12);
    costura(ctx, [[R.x, R.y + R.h - 11], [R.x + R.w, R.y + R.h - 11]], 0.2);
    ctx.restore();
  }

  // --- Calção ---
  {
    const R = RET.calcao;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip();
    // Dobras em pé, caindo do quadril; leque de dobras no meio da frente; entre as pernas mais escuro
    for (let k = 0; k < 14; k++) {
      const u = (k + 0.3 + 0.4 * r()) / 14;
      const [x0, y0] = pxRet(R, u, 0.78 - 0.1 * r());
      const [x1, y1] = pxRet(R, u + 0.012 * (r() - 0.5), 0.04);
      dobra(ctx, x0, y0, x1, y1, 7 + 3 * r(), 0.11 + 0.08 * r());
    }
    for (const s of [-1, 1]) {
      const [x0, y0] = pxRet(R, 0.5, 0.62);
      dobra(ctx, x0 + s * 2, y0, x0 + s * 30, y0 - 12, 6, 0.16);
      dobra(ctx, x0 + s * 3, y0 + 6, x0 + s * 26, y0 + 12, 6, 0.14);
      const [xb, yb] = pxRet(R, s > 0 ? 0.985 : 0.015, 0.5);
      dobra(ctx, xb, yb - 4, xb - s * 26, yb + 20, 7, 0.14);
    }
    for (const u of [0, 0.5, 1]) {
      const [x, y] = pxRet(R, u, 0.3);
      mancha(ctx, x, y, 18, R.h * 0.42, -0.2);
    }
    // Costuras dos lados e a barra
    for (const u of [0.25, 0.75]) costura(ctx, [pxRet(R, u, 0.95), pxRet(R, u, 0)], 0.14);
    costura(ctx, [pxRet(R, 0, 0.045), pxRet(R, 1, 0.045)], 0.2);
    ctx.restore();
    // Lado de dentro das pernas
    const D = RET.calcaoDentro;
    mancha(ctx, D.x + D.w / 2, D.y + D.h * 0.2, D.w, D.h * 0.6, -0.25);
  }

  // --- Meião: canelado em pé, dobra de cima, caneleira marcando na frente, tornozelo ---
  {
    const R = RET.meiao;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip();
    for (let x = R.x + 1; x < R.x + R.w; x += 3.5) {
      ctx.fillStyle = 'rgba(0,0,0,0.085)';
      ctx.fillRect(x, R.y, 1.2, R.h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x + 1.6, R.y, 1, R.h);
    }
    const vDobra = 1 - 0.034 / 0.389;
    const [, yd] = pxRet(R, 0, vDobra);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(R.x, yd, R.w, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(R.x, yd - 2.5, R.w, 2);
    // Caneleira: relevo leve na frente (u = 0,25)
    const [xc, yc] = pxRet(R, 0.25, 1 - 0.14 / 0.389);
    mancha(ctx, xc, yc, 15, 34, 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(xc, yc, 13, 31, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Panturrilha (atrás, u = 0,75): luz na barriga, sombra no tendão
    const [xp, yp] = pxRet(R, 0.75, 1 - 0.1 / 0.389);
    mancha(ctx, xp, yp, 18, 26, 0.08);
    const [xt, yt] = pxRet(R, 0.75, 1 - 0.3 / 0.389);
    mancha(ctx, xt - 9, yt, 5, 22, -0.14);
    mancha(ctx, xt + 9, yt, 5, 22, -0.14);
    // Rugas do tornozelo
    for (let k = 0; k < 4; k++) {
      const [, y] = pxRet(R, 0, 0.16 - k * 0.035);
      dobra(ctx, R.x, y, R.x + R.w, y + 2 * (r() - 0.5), 3.5, 0.14);
    }
    ctx.restore();
  }

  // --- Luva: dedos e a tira do punho ---
  {
    const R = RET.luva;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip();
    for (const u of [0.42, 0.5, 0.58, 0.92, 0.0, 0.08]) {
      const [x0, y0] = pxRet(R, u, 0.5);
      const [x1, y1] = pxRet(R, u, 0.02);
      costura(ctx, [[x0, y0], [x1, y1]], 0.3, 1.4);
    }
    const [, yp] = pxRet(R, 0, 0.9);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(R.x, yp, R.w, 3);
    ctx.restore();
  }
  camadaTecidoCanvas = canvas;
  return canvas;
}

// ---------- Padrões da camisa ----------
const ALTURA_FAIXA = [0.205, 0.315];  // faixa do peito (São Paulo)
const SASH = { a: [-0.175, 0.47], b: [0.17, -0.085], largura: 0.092 }; // faixa diagonal (Vasco)
const V_PEITO = { ombro: 0.15, topo: 0.475, ponta: 0.2, largura: 0.07 };
const FAIXA_VERTICAL = { meia: 0.046, filete: 0.012 }; // m: meia largura da faixa do meio e largura de cada filete

// Faixa diagonal e V num ponto da camisa: y (altura) e x (posição de lado, vista de frente).
// px = tamanho do pixel em metros (para a borda sair lisa). Devolve a cobertura (0 a 1).
function padraoNoPonto(padrao, y, x, px) {
  const borda = (d) => limitar(0.5 + d / px, 0, 1); // d > 0 = dentro da faixa (m)
  if (padrao === 'diagonal') {
    const [ax, ay] = SASH.a;
    const [bx, by] = SASH.b;
    const lx = bx - ax;
    const ly = by - ay;
    const dist = Math.abs(lx * (y - ay) - ly * (x - ax)) / Math.hypot(lx, ly);
    return borda(SASH.largura / 2 - dist);
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
    return borda(largura / 2 - melhor);
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
    const [canvas, ctx] = novoCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const det = DETALHES.alto;
    const { u } = mapaCamisa(det);
    const N = u.length - 1;
    // Em que coluna da malha cai cada pixel
    const colunaDoPixel = new Float32Array(W);
    for (let px = 0, i = 1; px < W; px++) {
      const up = (px + 0.5) / W;
      while (i < N && u[i] < up) i++;
      colunaDoPixel[px] = i - 1 + (up - u[i - 1]) / ((u[i] - u[i - 1]) || 1);
    }
    for (let py = 0; py < H; py++) {
      const y = yDaCamisa(1 - (py + 0.5) / H);
      const k = contornoCamisa(y, MEDIDAS_NORMAL, det);
      const xs = k.pontos.map((p) => p.R * p.cs);
      for (let px = 0; px < W; px++) {
        const f = colunaDoPixel[px];
        const i0 = Math.min(N - 1, Math.floor(f));
        const x = misturar(xs[i0], xs[i0 + 1], f - i0);
        const c = padraoNoPonto(padrao, y, x, 0.0022);
        const i = (py * W + px) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(c * 255);
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

// ---------- Atlas do uniforme: uma textura por time (camisa, mangas, calção, meião e luvas) ----------
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
    ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip();
    ctx.fillStyle = uni.cores[0] || uni.camisa;
    switch (uni.padrao) {
      case 'listras': {
        // 16 faixas na volta (8 listras), uma listra bem no meio da frente e das costas
        const n = 16;
        for (let k = 0; k < n; k += 2) {
          const x0 = ((0.25 - 0.5 / n + k / n) % 1) * R.w;
          ctx.fillRect(x0, 0, R.w / n, R.h);
          if (x0 + R.w / n > R.w) ctx.fillRect(x0 - R.w, 0, R.w / n, R.h);
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
        ctx.fillRect(X(0.25) - meia - filete, 0, 2 * (meia + filete), R.h);
        ctx.fillStyle = uni.cores[0];
        ctx.fillRect(X(0.25) - meia, 0, 2 * meia, R.h);
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
    const yGola = Y(0.462);
    const yV = Y(0.405);
    const meio = X(0.25);
    const aberta = 0.036 * R.w;
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
    // Barra (faixa fina embaixo)
    ctx.fillStyle = uni.gola;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, Y(-0.094), R.w, 3);
    ctx.globalAlpha = 1;
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
  {
    const R = RET.manga;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
    ctx.clip();
    ctx.fillStyle = uni.camisa;
    ctx.fillRect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
    if (uni.padrao === 'listras') {
      ctx.fillStyle = uni.cores[0];
      for (let k = 0; k < 3; k++) ctx.fillRect(R.x + ((k / 3) + 0.5 / 3) * R.w - R.w / 12, R.y - 2, R.w / 6, R.h + 4);
    } else if (uni.padrao === 'aros') {
      ctx.fillStyle = uni.cores[0];
      for (let k = 0; k < 4; k += 2) ctx.fillRect(R.x - 2, R.y + (k / 4) * R.h, R.w + 4, R.h / 4);
    }
    ctx.fillStyle = uni.gola;
    ctx.fillRect(R.x - 2, R.y + R.h - 9, R.w + 4, 11);
    if (contraste(uni.gola, uni.camisa) < 1.4) {
      ctx.fillStyle = claro(uni.gola) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)';
      ctx.fillRect(R.x - 2, R.y + R.h - 10.5, R.w + 4, 1.5);
    }
    ctx.restore();
  }

  // --- Calção: listra dos lados na cor da gola (quando aparece) ---
  {
    const R = RET.calcao;
    const D = RET.calcaoDentro;
    ctx.fillStyle = uni.calcao;
    ctx.fillRect(R.x - 3, R.y - 2, D.x + D.w - R.x + 5, R.h + 4);
    const corListra = [uni.gola, uni.camisa, uni.numero].find((cor) => distanciaCor(cor, uni.calcao) > 70);
    if (corListra) {
      ctx.fillStyle = corListra;
      for (const u of [0.25, 0.75]) {
        const [x] = pxRet(R, u, 0);
        ctx.fillRect(x - 4.5, R.y, 9, R.h);
      }
      ctx.globalAlpha = 0.9;
      ctx.fillRect(R.x, R.y + R.h - 5, R.w, 3);
      ctx.globalAlpha = 1;
    }
  }

  // --- Meião: listras na dobra de cima; o pé um pouco mais escuro ---
  {
    const R = RET.meiao;
    ctx.fillStyle = uni.meiao;
    ctx.fillRect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
    ctx.fillStyle = uni.faixaMeiao;
    const faixa = (d0, d1) => {
      const [, a] = pxRet(R, 0, 1 - d0 / 0.389);
      const [, b] = pxRet(R, 0, 1 - d1 / 0.389);
      ctx.fillRect(R.x - 2, a, R.w + 4, Math.max(1.6, b - a));
    };
    faixa(0.008, 0.016);
    faixa(0.022, 0.03);
    const [, y0] = pxRet(R, 0, 0.14);
    const g = ctx.createLinearGradient(0, y0, 0, R.y + R.h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = g;
    ctx.fillRect(R.x - 2, y0, R.w + 4, R.y + R.h - y0);
  }

  // --- Luva (goleiro) ---
  {
    const R = RET.luva;
    const cor = uni.luvas || '#f2f2f2';
    ctx.fillStyle = cor;
    ctx.fillRect(R.x - 3, R.y - 3, R.w + 6, R.h + 6);
    // Palma mais clara/escura e a tira do punho
    ctx.fillStyle = claro(cor) ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(R.x - 3, R.y - 3, R.w * 0.22 + 3, R.h + 6);
    ctx.fillRect(R.x + R.w * 0.8, R.y - 3, R.w * 0.2 + 3, R.h + 6);
    ctx.fillStyle = claro(cor) ? '#222222' : '#f2f2f2';
    ctx.fillRect(R.x - 3, R.y, R.w + 6, 5);
  }

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
