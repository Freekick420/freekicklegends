
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
