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

// @depois dobra
// Pinta dentro de uma região do atlas (com a folga em volta): o que passar da beirada é cortado
function naRegiao(ctx, R, pintar) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x - FOLGA, R.y - FOLGA, R.w + 2 * FOLGA, R.h + 2 * FOLGA);
  ctx.clip();
  pintar();
  ctx.restore();
}

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

// Faixa diagonal (Vasco): do ombro direito (a) ao quadril esquerdo (b); ombro: até onde ela vai para o lado
const SASH = { a: [-0.16, 0.47], b: [0.165, -0.085], largura: 0.092, ombro: 0.2 };

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
