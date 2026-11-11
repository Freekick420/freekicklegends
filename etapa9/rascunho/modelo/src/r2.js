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
