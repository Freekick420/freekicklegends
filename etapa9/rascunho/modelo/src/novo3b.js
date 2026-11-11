
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
    ctx.rect(R.x, R.y, R.w, R.h);
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
    ctx.rect(R.x, R.y, R.w, R.h);
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
    ctx.rect(R.x, R.y, R.w, R.h);
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
  ctx.rect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
  ctx.clip();
  ctx.fillStyle = cor;
  ctx.fillRect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
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
    ctx.fillRect(x - 10, R.y, 20, R.h);
  }
  // Sola com as travas
  const [xs0] = P(0.355, 0);
  const [xs1] = P(0.645, 0);
  ctx.fillStyle = corMisturada(cor, detalhe, escura ? 0.45 : 0.7);
  ctx.fillRect(xs0, R.y - 2, xs1 - xs0, R.h + 4);
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
  ctx.fillRect(R.x - 2, yCalc, R.w + 4, R.y + R.h - yCalc + 2);
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
  ctx.rect(C.x - 2, C.y - 2, C.w + 4, C.h + 4);
  ctx.clip();
  ctx.fillStyle = corMisturada(r.cabelo, '#000000', 0.3);
  ctx.fillRect(C.x - 2, C.y - 2, C.w + 4, C.h + 4);
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
  ctx.fillRect(F.x - 3, F.y - 3, F.w + 6, F.h + 6);
  const L = RET.cabeloLiso;
  ctx.fillStyle = r.cabelo;
  ctx.fillRect(L.x - 3, L.y - 3, L.w + 6, L.h + 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = L.x - 3; x < L.x + L.w + 3; x += 3) ctx.fillRect(x, L.y - 3, 1, L.h + 6);
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
