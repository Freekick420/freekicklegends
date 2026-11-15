// Sombras no gramado: as quatro sombras dos refletores embaixo de cada jogador e da bola (a marca dos jogos de
// futebol à noite), a sombra de contato embaixo de cada pé e a versão barata (um borrão por boneco).
//
// Como é desenhado (sem mapa de sombra e sem passada de tela cheia):
// - Silhueta: uma malha com o corpo inteiro do boneco repetido 4 vezes (personagem.criarSilhueta, de
//   js/jogadores.js; se o boneco não tiver esse método, uma malha provisória montada aqui com as peças dele).
//   O shader achata cada cópia no gramado ao longo da direção de um refletor: pernas e braços mexem na
//   sombra, e quem pula descola dela sozinho. Uma chamada de desenho por boneco. O estêncil (as silhuetas
//   marcam os pixels que já escureceram) impede a sombra de escurecer em dobro onde se cruzam, seja entre as
//   cópias de um boneco, seja entre vizinhos (a barreira): a sombra de todos junta tem um escuro só.
// - Borrões: manchas macias numa malha só para todo mundo: o contato de cada pé com a grama, as quatro
//   sombrinhas da bola (que se juntam quando ela desce) e, para quem não tem silhueta, as quatro sombras
//   alongadas em cruz. Uma chamada de desenho no total.
// Eixos: x = direita de quem cobra, y = para cima, z = do gol para quem cobra.

import * as THREE from 'three';

const Y_SOMBRA = 0.012;   // m acima do gramado: as sombras não brigam com a grama (z-fighting)
const MAX_LUZES = 4;      // cópias do corpo na silhueta (uma por refletor)
const ALTURA_PONTA = 1.9; // m: a sombra do que está a esta altura (a cabeça) é a mais clara
const FORCA_PONTA = 0.66; // quanto da força sobra na ponta da sombra (a luz espalhada clareia longe dos pés)
const ABRE_BOLA = 0.9;     // m: até onde as quatro sombrinhas da bola se afastam do ponto embaixo dela
const FORCA_PECAS = 0.6;  // as sombras das traves e do travessão são mais fracas e macias que as dos jogadores
const CONTATO_PE = 0.4;   // escurecimento da grama embaixo de cada pé apoiado (0 a 1)
const SOLA_PE = [0, -0.07, 0.07]; // meio da sola no espaço do tornozelo (m), como em js/jogadores.js (SOLA)
// Teto de triângulos de silhueta por quadro, somando todos os bonecos (cada silhueta tem o corpo 4 vezes:
// uns 4 mil triângulos por boneco). Se passar, os bonecos mais longe da câmera ficam com os borrões em cruz
// no lugar da silhueta (de longe mal se nota a troca). 28 mil = o cobrador e os 6 mais perto da câmera.
// Quem está fora da tela não gasta nada.
const ORCAMENTO_SILHUETAS = 28000;
const FOLGA_DISTANCIA = 0.88; // quem já tem silhueta conta como se estivesse 12% mais perto (não fica trocando)
const RAIO_NA_TELA = 3.2; // m em volta do boneco (corpo e sombras) que têm de estar fora da tela para ele não contar

// Se o cenário não disser de onde vem a luz: os quatro cantos, como em js/estadio.js
const REFLETORES_PADRAO = [[0.6, 0.8, 1.22, 0.36], [-0.6, 0.8, 1.22, 0.3], [-0.76, -0.65, 0.96, 0.33], [0.76, -0.65, 0.96, 0.27]]
  .map(([x, z, comprimento, forca]) => {
    const h = Math.hypot(x, z) * Math.hypot(1, comprimento);
    return { direcao: { x: (x * comprimento) / h, y: Math.hypot(x, z) / h, z: (z * comprimento) / h }, forca };
  });

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Silhueta achatada no gramado ----------

// Material das silhuetas (um só para todos os bonecos). Cada vértice desliza ao longo da luz da sua cópia
// (atributo `copia`: 0 a 3) até o gramado. uLuz[i] = (x, z do deslocamento por metro de altura, força, 0).
function criarMaterialSilhueta(uniformes) {
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    // Estêncil: desenha só onde nenhuma silhueta desenhou ainda neste quadro (a mesma marca para todos os bonecos)
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
  material.forceSinglePass = true; // os dois lados de uma vez (senão o Three.js desenha duas vezes)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLuz = uniformes.luz;
    shader.uniforms.uSombra = uniformes.sombra;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */ `#include <common>
        attribute float copia;
        uniform vec4 uLuz[${MAX_LUZES}];
        uniform vec4 uSombra; // altura do plano da sombra, altura da ponta, força na ponta
        varying float vForcaSombra;`)
      .replace('#include <project_vertex>', /* glsl */ `
        vec4 pSombra = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          pSombra = instanceMatrix * pSombra;
        #endif
        pSombra = modelMatrix * pSombra;
        vec4 luzSombra = uLuz[int(clamp(copia, 0.0, ${MAX_LUZES - 1}.0) + 0.5)];
        float alturaSombra = max(pSombra.y - uSombra.x, 0.0);
        pSombra.xz += luzSombra.xy * alturaSombra;
        pSombra.y = uSombra.x;
        vForcaSombra = luzSombra.z * mix(1.0, uSombra.z, clamp(alturaSombra / uSombra.y, 0.0, 1.0));
        vec4 mvPosition = viewMatrix * pSombra;
        gl_Position = projectionMatrix * mvPosition;
        // refletor desligado: a cópia dele some (senão marcaria o estêncil sem escurecer nada)
        if (luzSombra.z <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vForcaSombra;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vForcaSombra;');
  };
  material.customProgramCacheKey = () => 'silhueta-fkl';
  return material;
}

// Silhueta provisória de um boneco com pele (THREE.SkinnedMesh, o boneco de hoje): junta as malhas dele (que
// usam o mesmo esqueleto) numa só, repetida `copias` vezes e presa ao mesmo esqueleto. É o corpo inteiro com
// todo o detalhe: pesa umas 4 vezes mais que a silhueta própria do boneco (criarSilhueta).
function silhuetaComPele(malhas, material, copias) {
  let vertices = 0;
  let indices = 0;
  for (const m of malhas) {
    const g = m.geometry;
    vertices += g.attributes.position.count;
    indices += g.index ? g.index.count : g.attributes.position.count;
  }
  const total = vertices * copias;
  const posicao = new Float32Array(total * 3);
  const osso = new Uint16Array(total * 4);
  const peso = new Float32Array(total * 4);
  const copia = new Float32Array(total);
  const indice = new (total > 65535 ? Uint32Array : Uint16Array)(indices * copias);
  let v = 0;
  let k = 0;
  for (let c = 0; c < copias; c++) {
    for (const m of malhas) {
      const g = m.geometry;
      const { position, skinIndex, skinWeight } = g.attributes;
      const base = v;
      for (let i = 0; i < position.count; i++, v++) {
        posicao[3 * v] = position.getX(i);
        posicao[3 * v + 1] = position.getY(i);
        posicao[3 * v + 2] = position.getZ(i);
        for (let j = 0; j < 4; j++) {
          osso[4 * v + j] = skinIndex.getComponent(i, j);
          peso[4 * v + j] = skinWeight.getComponent(i, j);
        }
        copia[v] = c;
      }
      if (g.index) {
        const ix = g.index.array;
        for (let i = 0; i < ix.length; i++) indice[k++] = base + ix[i];
      } else {
        for (let i = 0; i < position.count; i++) indice[k++] = base + i;
      }
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posicao, 3));
  geometria.setAttribute('skinIndex', new THREE.BufferAttribute(osso, 4));
  geometria.setAttribute('skinWeight', new THREE.BufferAttribute(peso, 4));
  geometria.setAttribute('copia', new THREE.BufferAttribute(copia, 1));
  geometria.setIndex(new THREE.BufferAttribute(indice, 1));
  const malha = new THREE.SkinnedMesh(geometria, material);
  malha.bind(malhas[0].skeleton, malhas[0].bindMatrix);
  malha.userData.esqueletoEmprestado = true; // o esqueleto é do boneco: quem solta é ele
  malhas[0].parent.add(malha);
  return malha;
}

// Silhueta provisória para bonecos sem criarSilhueta (ou quando ele falha): uma malha com pele só, com o corpo
// repetido `copias` vezes. Boneco com pele: as malhas dele juntas, no mesmo esqueleto (silhuetaComPele).
// Boneco de peças soltas (malhas penduradas nas juntas): cada peça vira um "osso", e a malha acompanha as
// juntas sem conta nenhuma por quadro aqui. Devolve null se o boneco não tiver nem uma coisa nem outra.
// (Exportada para a página de teste: testes/sombras.html.)
export function silhuetaDasPecas(grupo, material, copias = 1) {
  const comPele = [];
  grupo.traverse((o) => {
    if (o.isSkinnedMesh && o.name !== 'silhueta' && o.skeleton && o.geometry.attributes.skinIndex) comPele.push(o);
  });
  if (comPele.length && comPele.every((o) => o.skeleton === comPele[0].skeleton)) {
    return silhuetaComPele(comPele, material, copias);
  }
  const pecas = [];
  grupo.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.name === 'silhueta' || o.name === 'sombra') return;
    if (!o.geometry || !o.geometry.attributes.position) return;
    pecas.push(o);
  });
  if (!pecas.length) return null;
  let vertices = 0;
  let indices = 0;
  for (const p of pecas) {
    const g = p.geometry;
    vertices += g.attributes.position.count;
    indices += g.index ? g.index.count : g.attributes.position.count;
  }
  const total = vertices * copias;
  const posicao = new Float32Array(total * 3);
  const osso = new Uint16Array(total * 4);
  const peso = new Uint8Array(total * 4);
  const copia = new Float32Array(total);
  const indice = new (total > 65535 ? Uint32Array : Uint16Array)(indices * copias);
  let v = 0;
  let k = 0;
  for (let c = 0; c < copias; c++) {
    for (let n = 0; n < pecas.length; n++) {
      const g = pecas[n].geometry;
      const a = g.attributes.position;
      const base = v;
      for (let i = 0; i < a.count; i++, v++) {
        posicao[3 * v] = a.getX(i);
        posicao[3 * v + 1] = a.getY(i);
        posicao[3 * v + 2] = a.getZ(i);
        osso[4 * v] = n;
        peso[4 * v] = 255;
        copia[v] = c;
      }
      if (g.index) {
        const ix = g.index.array;
        for (let i = 0; i < ix.length; i++) indice[k++] = base + ix[i];
      } else {
        for (let i = 0; i < a.count; i++) indice[k++] = base + i;
      }
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posicao, 3));
  geometria.setAttribute('skinIndex', new THREE.BufferAttribute(osso, 4));
  geometria.setAttribute('skinWeight', new THREE.BufferAttribute(peso, 4, true));
  geometria.setAttribute('copia', new THREE.BufferAttribute(copia, 1));
  geometria.setIndex(new THREE.BufferAttribute(indice, 1));
  const malha = new THREE.SkinnedMesh(geometria, material);
  // Cada vértice está no espaço da sua peça: o "osso" é a própria peça, sem matriz de repouso
  malha.bind(new THREE.Skeleton(pecas, pecas.map(() => new THREE.Matrix4())), new THREE.Matrix4());
  grupo.add(malha);
  return malha;
}

// ---------- Borrões (uma malha só para todos) ----------

// Cada borrão é um retângulo deitado no gramado; o desenho (macio, sem textura) sai da posição dentro dele.
// Formas: 0 = mancha redonda bem macia; 1 = alongada (escura perto dos pés, some na ponta); 2 = disco de
// borda macia (as sombrinhas da bola); 3 = faixa de beiras macias (a sombra de uma trave).
function criarBorroes(scene) {
  let capacidade = 128;
  let posicao;
  let dados;
  let geometria = null;
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 borrao;\nvarying vec4 vBorrao;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBorrao = borrao;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vBorrao;')
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        vec2 qBorrao = vBorrao.xy * 2.0 - 1.0;
        float fBorrao;
        if (vBorrao.w < 0.5) {
          fBorrao = max(0.0, 1.0 - dot(qBorrao, qBorrao));
          fBorrao *= fBorrao;
        } else if (vBorrao.w < 1.5) {
          fBorrao = max(0.0, 1.0 - qBorrao.y * qBorrao.y);
          fBorrao *= fBorrao * smoothstep(-1.0, -0.7, qBorrao.x) * (1.0 - smoothstep(0.15, 1.0, qBorrao.x));
        } else if (vBorrao.w < 2.5) {
          fBorrao = 1.0 - smoothstep(0.3, 1.0, length(qBorrao));
        } else {
          fBorrao = max(0.0, 1.0 - qBorrao.y * qBorrao.y);
          fBorrao *= fBorrao;
        }
        diffuseColor.a *= vBorrao.z * fBorrao;`);
  };
  material.customProgramCacheKey = () => 'borroes-fkl';
  const malha = new THREE.Mesh(new THREE.BufferGeometry(), material);
  malha.name = 'sombra';
  malha.renderOrder = 1;
  malha.frustumCulled = false;
  scene.add(malha);

  function alocar() {
    if (geometria) geometria.dispose();
    posicao = new Float32Array(capacidade * 12);
    dados = new Float32Array(capacidade * 16);
    const indice = new Uint16Array(capacidade * 6);
    // (a face olha para cima)
    for (let i = 0; i < capacidade; i++) indice.set([4 * i, 4 * i + 2, 4 * i + 1, 4 * i, 4 * i + 3, 4 * i + 2], 6 * i);
    geometria = new THREE.BufferGeometry();
    for (const [nome, vetor, tamanho] of [['position', posicao, 3], ['borrao', dados, 4]]) {
      const atributo = new THREE.BufferAttribute(vetor, tamanho);
      atributo.setUsage(THREE.DynamicDrawUsage);
      geometria.setAttribute(nome, atributo);
    }
    geometria.setIndex(new THREE.BufferAttribute(indice, 1));
    malha.geometry = geometria;
  }
  alocar();

  let n = 0;
  return {
    malha,
    limpar() {
      n = 0;
    },
    // Retângulo com o eixo (ex, ez) passando por (x, z): vai de `de` até `ate` metros ao longo do eixo, com
    // meia largura `meia`. forca0 e forca1: escurecimento no começo e no fim do eixo.
    por(x, z, ex, ez, de, ate, meia, forca0, forca1, forma) {
      if (!(forca0 > 0.003 || forca1 > 0.003)) return;
      if (n === capacidade) {
        const [p, d] = [posicao, dados];
        capacidade *= 2;
        alocar();
        posicao.set(p);
        dados.set(d);
      }
      const nx = -ez * meia;
      const nz = ex * meia;
      const cantos = [[de, -1, 0, 0, forca0], [ate, -1, 1, 0, forca1], [ate, 1, 1, 1, forca1], [de, 1, 0, 1, forca0]];
      for (let c = 0; c < 4; c++) {
        const [a, lado, u, v, forca] = cantos[c];
        const i = n * 4 + c;
        posicao[3 * i] = x + ex * a + nx * lado;
        posicao[3 * i + 1] = Y_SOMBRA;
        posicao[3 * i + 2] = z + ez * a + nz * lado;
        dados[4 * i] = u;
        dados[4 * i + 1] = v;
        dados[4 * i + 2] = forca;
        dados[4 * i + 3] = forma;
      }
      n++;
    },
    enviar() {
      geometria.setDrawRange(0, n * 6);
      geometria.attributes.position.needsUpdate = true;
      geometria.attributes.borrao.needsUpdate = true;
      malha.visible = n > 0;
    },
    get total() {
      return n;
    },
  };
}

// ---------- O sistema de sombras ----------

// Cria as sombras da cena. opcoes.refletores: de onde vem a luz, [{ direcao: { x, y, z }, forca }] (unitária,
// do chão para a luz; forca de 0 a 1 = quanto a sombra escurece). É lido a cada quadro: o cenário
// (cenario.refletores) muda os valores quando o painel de ajuste mexe neles. Todas as forças em 0 = sombras dos
// refletores desligadas (fica só um borrão por boneco). Se a lista tiver o campo `segmentos`
// ([{ a: [x, y, z], b: [x, y, z], raio, forca }]: traves, travessão, hastes), cada um ganha a sombra de cada
// refletor também. Devolve:
//   boneco(personagem, { raio, destaque })  sombra de um boneco de js/jogadores.js. raio: m do borrão simples;
//       destaque: true para o cobrador (tem silhueta mesmo quando o boneco não sabe fazer a dele). Devolve
//       { atualizar({ x, z, altura }), remover() }: chamar atualizar a cada quadro com a posição dos pés no
//       gramado e a altura (m) em que os pés estão do chão (pulo; padrão 0); remover() antes do dispose() dele.
//   bola(raio)   sombra da bola. Devolve { atualizar(pos, raioBola) } (pos: {x, y, z} do centro da bola).
//   qualidade(nivel)  1 = completo; 0 = o mais barato possível (um borrão por boneco e um para a bola);
//                     entre os dois (0.5) = quatro borrões alongados em cruz, sem silhueta.
//   atualizar(dt, camera)  uma vez por quadro, depois de mover os bonecos, a bola e a câmera. camera (opcional):
//                     a câmera que vai desenhar o quadro; sem ela, vale a do quadro anterior (num corte de
//                     câmera, a escolha de quem tem silhueta atrasa um quadro).
//   estado()          para conferir: { modo, nivel, bonecos, silhuetas, provisorias, triangulos, borroes, estencil }
// opcoes.silhuetas (ou ?silhuetas= no endereço, para testar): 'destaque' (padrão: sem criarSilhueta, só o
// cobrador ganha a silhueta provisória), 'todos' ou 'nenhuma'. opcoes.orcamento: teto de triângulos de
// silhueta por quadro (padrão ORCAMENTO_SILHUETAS).
export function criarSombras(scene, opcoes = {}) {
  const refletores = opcoes.refletores || REFLETORES_PADRAO;
  const endereco = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  // (o ?silhuetas= do endereço só vale no modo teste e nas páginas de inspeção de testes/)
  const deTeste = endereco && (endereco.has('teste') || location.pathname.includes('/testes/'));
  const quemTemSilhueta = (deTeste && endereco.get('silhuetas')) || opcoes.silhuetas || 'destaque';
  // (com 'todos' o teste é da aparência: as silhuetas provisórias são pesadas e não entram no orçamento)
  const orcamento = quemTemSilhueta === 'todos' ? Infinity : (opcoes.orcamento || ORCAMENTO_SILHUETAS);

  const uniformes = {
    luz: { value: Array.from({ length: MAX_LUZES }, () => new THREE.Vector4()) },
    sombra: { value: new THREE.Vector4(Y_SOMBRA, ALTURA_PONTA, FORCA_PONTA, 0) },
  };
  // O que cada refletor faz com a sombra: deslocamento no chão por metro de altura (ox, oz), o mesmo em
  // comprimento e direção (comprimento, ux, uz) e a força
  const luzes = Array.from({ length: MAX_LUZES }, () => ({ ox: 0, oz: 0, comprimento: 0, ux: 0, uz: 0, forca: 0 }));
  const ordem = luzes.map((_, i) => i);
  let temLuz = false;
  function lerRefletores() {
    temLuz = false;
    for (let i = 0; i < MAX_LUZES; i++) {
      const r = refletores[i];
      const l = luzes[i];
      const d = r && r.direcao;
      l.forca = d && d.y > 0.05 && r.forca > 0 ? Math.min(1, r.forca) : 0;
      if (l.forca > 0) {
        l.ox = -d.x / d.y;
        l.oz = -d.z / d.y;
        l.comprimento = Math.hypot(l.ox, l.oz);
        l.ux = l.comprimento > 1e-6 ? l.ox / l.comprimento : 1;
        l.uz = l.comprimento > 1e-6 ? l.oz / l.comprimento : 0;
        temLuz = true;
      }
    }
    // Na silhueta, a cópia 0 é desenhada primeiro e fica com os pixels onde as cópias se cruzam: vai para o
    // refletor de sombra mais forte (e assim por diante)
    ordem.sort((a, b) => luzes[b].forca - luzes[a].forca);
    for (let i = 0; i < MAX_LUZES; i++) {
      const l = luzes[ordem[i]];
      uniformes.luz.value[i].set(l.ox, l.oz, l.forca, 0);
    }
  }
  lerRefletores();

  const materialSilhueta = criarMaterialSilhueta(uniformes);
  const borroes = criarBorroes(scene);
  const bonecos = new Set();
  const bolas = [];
  let nivel = 1;
  let temEstencil = true;

  // Na hora do desenho: guarda onde a câmera está (para escolher quem fica com silhueta no quadro seguinte)
  // e confere, uma vez, se a tela tem estêncil (sem ele a silhueta escureceria em dobro)
  const olho = { x: 0, y: 0, z: 0 };
  const campoDeVisao = new THREE.Frustum();
  const matrizDaCamera = new THREE.Matrix4();
  const esfera = new THREE.Sphere();
  const inversa = new THREE.Matrix4();
  const frente = { x: 0, y: 0, z: 0 };
  let temCamera = false;
  let cameraDada = false; // a câmera veio em atualizar(dt, camera): não precisa da do quadro anterior
  let corte = false;      // a câmera pulou de lugar: a escolha das silhuetas recomeça, sem folga para quem já tinha
  let conferido = false;
  function lerCamera(camera) {
    const e = camera.matrixWorld.elements;
    if (temCamera && (Math.hypot(e[12] - olho.x, e[13] - olho.y, e[14] - olho.z) > 2.5
      || e[8] * frente.x + e[9] * frente.y + e[10] * frente.z < 0.9)) corte = true;
    olho.x = e[12];
    olho.y = e[13];
    olho.z = e[14];
    frente.x = e[8];
    frente.y = e[9];
    frente.z = e[10];
    campoDeVisao.setFromProjectionMatrix(matrizDaCamera.multiplyMatrices(camera.projectionMatrix, inversa.copy(camera.matrixWorld).invert()));
    temCamera = true;
  }
  borroes.malha.onBeforeRender = (renderer, _cena, camera) => {
    if (!cameraDada) lerCamera(camera);
    if (conferido) return;
    conferido = true;
    const atributos = renderer.getContext().getContextAttributes();
    temEstencil = !atributos || atributos.stencil !== false;
  };

  // 'completo': silhuetas (quem tem) e contato dos pés; 'cruz': quatro borrões alongados; 'simples': um borrão
  function modo() {
    if (nivel <= 0 || !temLuz) return 'simples';
    return nivel < 1 || !temEstencil ? 'cruz' : 'completo';
  }

  function criarSilhueta(b) {
    const p = b.personagem;
    if (!p || quemTemSilhueta === 'nenhuma') return;
    let malha = null;
    if (typeof p.criarSilhueta === 'function') {
      try {
        malha = p.criarSilhueta(materialSilhueta, MAX_LUZES) || null;
      } catch (erro) {
        console.warn('sombras: criarSilhueta falhou, usando o plano B', erro);
      }
    }
    if (!malha && p.grupo && (b.destaque || quemTemSilhueta === 'todos')) {
      malha = silhuetaDasPecas(p.grupo, materialSilhueta, MAX_LUZES);
      b.provisoria = Boolean(malha);
    }
    if (!malha) return;
    const g = malha.geometry;
    b.triangulos = (g.index ? g.index.count : g.attributes.position.count) / 3;
    malha.name = 'silhueta';
    malha.material = materialSilhueta;
    malha.frustumCulled = false; // a sombra cai longe do corpo: não dá para cortar pela esfera do boneco
    malha.renderOrder = 1;
    b.malha = malha;
  }

  function boneco(personagem, { raio = 0.42, destaque = false } = {}) {
    const b = {
      personagem, raio, destaque, x: 0, z: 0, altura: 0, visto: false, malha: null, provisoria: false,
      corpo: (personagem && personagem.altura) || 1.8, triangulos: 0, comSilhueta: false,
      distancia: 0,
    };
    criarSilhueta(b);
    if (b.malha) b.malha.visible = false; // aparece no primeiro atualizar() do sistema
    bonecos.add(b);
    return {
      atualizar({ x, z, altura = 0 }) {
        b.x = x;
        b.z = z;
        b.altura = Math.max(0, altura || 0);
        b.visto = true;
      },
      remover() {
        bonecos.delete(b);
        const malha = b.malha;
        if (!malha) return;
        b.malha = null;
        if (b.provisoria) {
          if (malha.parent) malha.parent.remove(malha);
          malha.geometry.dispose();
          if (!malha.userData.esqueletoEmprestado) malha.skeleton.dispose();
        } else {
          malha.visible = false; // a malha é do boneco: some de vez no dispose() dele
        }
      },
    };
  }

  function bola(raio = 0.3) {
    const s = { raio, x: 0, y: 0, z: 0, raioBola: 0.11, visto: false };
    bolas.push(s);
    return {
      atualizar(pos, raioBola = 0.11) {
        s.x = pos.x;
        s.y = pos.y;
        s.z = pos.z;
        s.raioBola = raioBola;
        s.visto = true;
      },
    };
  }

  // Contato dos pés: uma mancha embaixo de cada chuteira, que some quando o pé sai do chão. A posição vem
  // dos tornozelos do boneco. Devolve false se o boneco não tiver essas juntas.
  function contatoDosPes(b, forca) {
    const juntas = b.personagem && b.personagem.juntas;
    if (!juntas || !juntas.tornozeloE || !juntas.tornozeloD) return false;
    for (const tornozelo of [juntas.tornozeloE, juntas.tornozeloD]) {
      tornozelo.updateWorldMatrix(true, false);
      const e = tornozelo.matrixWorld.elements;
      const [sx, sy, sz] = SOLA_PE;
      const y = e[13] + e[1] * sx + e[5] * sy + e[9] * sz;
      const apoio = 1 - limitar((y - 0.02) / 0.2, 0, 1);
      if (apoio <= 0) continue;
      const comprimento = Math.hypot(e[8], e[10]);
      const ex = comprimento > 1e-4 ? e[8] / comprimento : 0;
      const ez = comprimento > 1e-4 ? e[10] / comprimento : 1;
      const escala = Math.hypot(e[4], e[5], e[6]); // tamanho do boneco
      borroes.por(
        e[12] + e[0] * sx + e[4] * sy + e[8] * sz, e[14] + e[2] * sx + e[6] * sy + e[10] * sz, ex, ez,
        -0.25 * escala, 0.25 * escala, 0.17 * escala, forca * apoio, forca * apoio, 0,
      );
    }
    return true;
  }

  // Quem fica com silhueta neste quadro: todos, se couber no orçamento de triângulos; senão o cobrador e
  // os mais perto da câmera (quem já tinha ganha uma folga, para não ficar trocando)
  const fila = [];
  function escolherSilhuetas(m) {
    fila.length = 0;
    let total = 0;
    for (const b of bonecos) {
      if (!b.malha) continue;
      if (m !== 'completo') {
        b.comSilhueta = false;
        b.malha.visible = false;
        continue;
      }
      // Fora da tela (corpo e sombras): não desenha nem conta no orçamento
      esfera.center.set(b.x, 0.9, b.z);
      esfera.radius = RAIO_NA_TELA;
      const grupo = b.personagem.grupo;
      if (!b.visto || (grupo && (!grupo.visible || !grupo.parent)) || (temCamera && !campoDeVisao.intersectsSphere(esfera))) {
        b.comSilhueta = false;
        b.malha.visible = false;
        continue;
      }
      total += b.triangulos;
      b.distancia = b.destaque ? -1 : Math.hypot(b.x - olho.x, olho.y, b.z - olho.z) * (b.comSilhueta && !corte ? FOLGA_DISTANCIA : 1);
      fila.push(b);
    }
    corte = false;
    if (total > orcamento) fila.sort((a, b) => a.distancia - b.distancia);
    let gasto = 0;
    let acabou = false;
    for (const b of fila) {
      if (gasto > 0 && gasto + b.triangulos > orcamento) acabou = true;
      b.comSilhueta = !acabou;
      b.malha.visible = b.comSilhueta;
      if (b.comSilhueta) gasto += b.triangulos;
    }
  }

  function montarBorroes() {
    const m = modo();
    escolherSilhuetas(m);
    borroes.limpar();
    for (const b of bonecos) {
      const grupo = b.personagem && b.personagem.grupo;
      if (!b.visto || (grupo && (!grupo.visible || !grupo.parent))) continue;
      if (m === 'simples') {
        // O borrão de sempre: encolhe quando o boneco pula
        const r = b.raio * 1.3 * Math.max(0.45, 1 - b.altura * 1.2);
        borroes.por(b.x, b.z, 1, 0, -r, r, r, 0.62, 0.62, 0);
        continue;
      }
      if (!contatoDosPes(b, CONTATO_PE)) {
        const r = b.raio * 0.8;
        const forca = CONTATO_PE * (1 - limitar(b.altura / 0.25, 0, 1));
        borroes.por(b.x, b.z, 1, 0, -r, r, r, forca, forca, 0);
      }
      if (b.comSilhueta) continue;
      // Sem silhueta: quatro sombras alongadas em cruz, cada uma para o lado contrário do seu refletor
      for (const l of luzes) {
        if (l.forca <= 0) continue;
        const x = b.x + l.ox * b.altura;
        const z = b.z + l.oz * b.altura;
        borroes.por(x, z, l.ux, l.uz, -0.22, l.comprimento * b.corpo * 1.02, 0.21, Math.min(1, l.forca * 1.45), l.forca, 1);
      }
    }
    for (const s of bolas) {
      if (!s.visto) continue;
      const altura = Math.max(0, s.y - s.raioBola);
      if (m === 'simples') {
        const r = s.raio * (1 + altura * 0.15);
        const forca = 0.5 * Math.max(0.15, 0.9 - altura * 0.12);
        borroes.por(s.x, s.z, 1, 0, -r, r, r, forca, forca, 0);
        continue;
      }
      // Uma sombrinha por refletor: a bola no alto espalha as quatro; descendo, elas se juntam embaixo dela
      // (não na distância de verdade: bola alta teria as sombrinhas a 4 m dela, parecendo sujeira no gramado.
      // Elas abrem até uns 0,9 m e somem acima de 2 m; quem mostra onde a bola está é a mancha de baixo)
      const r = s.raio * 0.55;
      const abre = ABRE_BOLA * (1 - Math.exp(-s.y / ABRE_BOLA));
      const some = 1 - limitar((altura - 1.1) / 1.1, 0, 1);
      for (const l of luzes) {
        if (l.forca <= 0 || some <= 0) continue;
        const longa = r * Math.sqrt(1 + l.comprimento * l.comprimento); // a sombra de uma esfera é uma elipse
        const forca = l.forca * 0.95 * some;
        borroes.por(s.x + l.ox * abre, s.z + l.oz * abre, l.ux, l.uz, -longa, longa, r, forca, forca, 2);
      }
      // Bem embaixo da bola, em qualquer altura: a mancha que mostra em que ponto do campo ela está (forte;
      // abre e clareia só um pouco com a altura) e, no chão ou quase, o contato com a grama por cima
      const central = 0.46 - 0.1 * limitar(altura / 4, 0, 1);
      const rc = s.raio * (0.8 + 0.3 * limitar(altura / 4, 0, 1));
      borroes.por(s.x, s.z, 1, 0, -rc, rc, rc, central, central, 2);
      const contato = 0.3 * (1 - limitar(altura / 0.35, 0, 1));
      const rk = s.raio * 0.62;
      borroes.por(s.x, s.z, 1, 0, -rk, rk, rk, contato, contato, 0);
    }
    // Traves, travessão e outras peças finas do cenário (refletores.segmentos): uma faixa por refletor
    const segmentos = m !== 'simples' && Array.isArray(refletores.segmentos) ? refletores.segmentos : [];
    for (const g of segmentos) {
      const ya = Math.max(0, g.a[1] - Y_SOMBRA);
      const yb = Math.max(0, g.b[1] - Y_SOMBRA);
      const meia = g.raio * 2.2 + 0.03;
      for (const l of luzes) {
        if (l.forca <= 0) continue;
        const xa = g.a[0] + l.ox * ya;
        const za = g.a[2] + l.oz * ya;
        const dx = g.b[0] + l.ox * yb - xa;
        const dz = g.b[2] + l.oz * yb - za;
        const comprimento = Math.hypot(dx, dz);
        if (comprimento < 1e-4) continue;
        const forca = l.forca * (g.forca ?? 1) * FORCA_PECAS;
        borroes.por(
          xa, za, dx / comprimento, dz / comprimento, 0, comprimento, meia,
          forca * (1 + (FORCA_PONTA - 1) * limitar(ya / ALTURA_PONTA, 0, 1)),
          forca * (1 + (FORCA_PONTA - 1) * limitar(yb / ALTURA_PONTA, 0, 1)), 3,
        );
      }
    }
    borroes.enviar();
  }

  const sistema = {
    boneco,
    bola,
    qualidade(n) {
      nivel = Number.isFinite(n) ? n : 1;
    },
    atualizar(_dt, camera) {
      lerRefletores();
      cameraDada = Boolean(camera && camera.isCamera);
      if (cameraDada) {
        camera.updateMatrixWorld();
        lerCamera(camera);
      }
      montarBorroes();
    },
    estado() {
      let silhuetas = 0;
      let provisorias = 0;
      let triangulos = 0;
      for (const b of bonecos) {
        if (b.comSilhueta) {
          silhuetas++;
          triangulos += b.triangulos;
        }
        if (b.provisoria) provisorias++;
      }
      return { modo: modo(), nivel, bonecos: bonecos.size, silhuetas, provisorias, triangulos, borroes: borroes.total, estencil: temEstencil };
    },
  };
  // Nos testes automáticos (?teste), dá para mexer nas sombras pelo console: window.sombrasTeste
  if (endereco && endereco.has('teste') && typeof window !== 'undefined') window.sombrasTeste = sistema;
  return sistema;
}
