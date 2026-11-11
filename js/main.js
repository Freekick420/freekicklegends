import * as THREE from 'three';
import { CONFIG, VERSAO } from './config.js?v=9';
import { criarBola, chutar, passo, noChao, coneDeErro, preverTecnica } from './physics.js?v=9';
import { ELENCO, RIVAIS, sugerirCobradores } from './elenco.js?v=9';
import { criarCenario, PADRAO_CENARIO } from './estadio.js?v=9';
import { montarBarreira, semBarreira, atualizarBarreira, colidirBolaBarreira, PADRAO_BARREIRA } from './barreira.js?v=9';
import { criarGoleiro, atualizarGoleiro, colidirBolaGoleiro, PADRAO_GOLEIRO, PADRAO_PENALTI } from './goleiro.js?v=9';
import { criarPersonagem, visualAdversario, VISUAL_GOLEIRO_ADVERSARIO, UNIFORMES, misturarPoses } from './jogadores.js?v=9';
import { criarCobranca, PADRAO_COBRANCA, poseChute, poseComemoracao, poseLamento } from './cobranca.js?v=9';
import { criarAnimadorGoleiro, criarAnimadorBarreira } from './animacaoDefesa.js?v=9';
import { montarFigurantes, atualizarFigurantes, colidirBolaFigurantes, PADRAO_FIGURANTES } from './figurantes.js?v=9';
import { criarAnimadorFigurantes } from './animacaoFigurantes.js?v=9';
import { criarBolaVisual } from './bola.js?v=9';
import { criarSombras } from './sombras.js?v=9';
import { criarAudio, PADRAO_AUDIO } from './audio.js?v=9';
import { criarGravador, salvarVideo } from './replay.js?v=9';
import { criarInterface } from './interface.js?v=9';
import { criarPainel } from './painel.js?v=9';
import { criarRanking } from './ranking.js?v=9';

// Os padrões de goleiro, barreira, cobrador, som e cenário moram nos próprios módulos;
// entram no CONFIG aqui (o que estiver escrito no config.js tem prioridade)
CONFIG.goleiro = { ...PADRAO_GOLEIRO, ...(CONFIG.goleiro || {}) };
CONFIG.penalti = { ...PADRAO_PENALTI, ...(CONFIG.penalti || {}) };
CONFIG.barreira = { ...PADRAO_BARREIRA, ...(CONFIG.barreira || {}) };
CONFIG.figurantes = { ...PADRAO_FIGURANTES, ...(CONFIG.figurantes || {}) };
CONFIG.cobrador = { ...PADRAO_COBRANCA, ...(CONFIG.cobrador || {}) };
CONFIG.audio = { ...PADRAO_AUDIO, ...(CONFIG.audio || {}) };
CONFIG.cenario = { ...PADRAO_CENARIO, ...(CONFIG.cenario || {}) };

const GRAUS = Math.PI / 180;
const PASSO_FISICA = 1 / 240; // a física roda em passos pequenos e fixos, independente do celular
const CONTATO_MAXIMO = 0.95;  // até onde o ponto de contato pode ir na borda da bola

// Com ?teste no endereço, cada quadro vale exatamente 1/60 s e o sorteio é sempre o mesmo:
// os testes automáticos ficam previsíveis
const MODO_TESTE = new URLSearchParams(location.search).has('teste');
window.tempoDeJogo = 0;
const aleatorio = MODO_TESTE
  ? (() => {
    let s = 12345;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })()
  : Math.random;

// Sorteio com semente (mulberry32): a mesma semente dá sempre a mesma sequência. Cada cobrança sorteia
// uma semente para a montagem (barreira, goleiro, bonecos) e outra no chute (erro da mira, reação do
// goleiro). O replay reaproveita as duas, e a bola, o goleiro e a barreira fazem exatamente o mesmo.
function criarSorteio(semente) {
  let a = Math.floor(semente * 4294967296) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let sementeJogada = 0;
// Um sorteio independente para cada uso (n = 0, 1, 2...), para a ordem das chamadas não importar
const sorteioDaJogada = (n) => criarSorteio((sementeJogada + n * 0.6180339887) % 1);
let sorteioChute = aleatorio; // erro da mira e goleiro durante o voo (semente sorteada no chute)

// Semente a partir de um texto (hash FNV-1a): no Desafio do Dia, a data vira a semente, e todo mundo
// recebe as mesmas faltas na mesma ordem
function sementeDoTexto(texto) {
  let h = 2166136261;
  for (const ch of texto) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// Guardado no aparelho (recordes, desafio do dia, nome, modo): sem armazenamento, vale só até fechar a página
function lerSalvo(chave, padrao) {
  try {
    const v = JSON.parse(localStorage.getItem(chave));
    return v ?? padrao;
  } catch {
    return padrao;
  }
}
function salvar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento (aba anônima, por exemplo)
  }
}

// ---------- Renderizador, cena e cenário ----------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('jogo').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
const cenario = criarCenario(scene, renderer, CONFIG);

function texturaDeCanvas(canvas) {
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// ---------- Bola, sombras e rastro ----------

// A bola desenhada (js/bola.js) e as sombras no gramado (js/sombras.js). O cenário pode dizer de onde vem
// a luz dos refletores (cenario.refletores), para as sombras caírem para o lado certo.
const bolaVisual = criarBolaVisual(scene, CONFIG);
const bolaMesh = bolaVisual.malha;
const sombras = criarSombras(scene, { refletores: cenario.refletores });
const sombraDaBola = sombras.bola(0.3);

// Rastro: pontinhos que ficam para trás da bola durante o voo, para enxergar a curva
const RASTRO_MAX = 70;
const rastro = (() => {
  const posicoes = new Float32Array(RASTRO_MAX * 3);
  const cores = new Float32Array(RASTRO_MAX * 3);
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  geometria.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geometria.setDrawRange(0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const pontos = new THREE.Points(geometria, new THREE.PointsMaterial({
    size: 0.26, map: texturaDeCanvas(canvas), vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  pontos.frustumCulled = false;
  scene.add(pontos);
  let total = 0;
  let acumulado = 0;
  return {
    limpar() {
      total = 0;
      geometria.setDrawRange(0, 0);
    },
    adicionar(pos, dt) {
      acumulado += dt;
      if (acumulado < 1 / 50) return;
      acumulado = 0;
      if (total === RASTRO_MAX) {
        posicoes.copyWithin(0, 3);
        total--;
      }
      posicoes.set([pos.x, pos.y, pos.z], total * 3);
      total++;
      // Os pontos mais antigos ficam mais apagados
      for (let i = 0; i < total; i++) {
        const k = (i + 1) / total;
        cores.set([k * 0.9, k * 0.85, k * 0.55], i * 3);
      }
      geometria.attributes.position.needsUpdate = true;
      geometria.attributes.color.needsUpdate = true;
      geometria.setDrawRange(0, total);
    },
    set visivel(sim) {
      pontos.visible = sim;
    },
  };
})();

// ---------- Mira: alvo no gol, faixa do erro e linha no chão ----------

const mira = { x: 0 };
const ALTURA_MIRA = 1.25;
const alvoMira = (() => {
  const grupo = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xf7d84a, transparent: true, opacity: 0.95, depthTest: false });
  grupo.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 40), material));
  for (const [w, h] of [[0.9, 0.05], [0.05, 0.9]]) grupo.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), material));
  grupo.children.forEach((c) => { c.renderOrder = 11; });
  scene.add(grupo);
  return grupo;
})();

// Faixa do erro: a bola costuma sair dentro dela (cresce quando a força passa do ponto ideal)
const faixaErro = (() => {
  const malha = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xf7d84a, transparent: true, opacity: 0.32, depthTest: false })
  );
  malha.renderOrder = 10;
  scene.add(malha);
  return malha;
})();

const guiaMira = (() => {
  const geometria = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  const linha = new THREE.Line(geometria, new THREE.LineDashedMaterial({
    color: 0xf7d84a, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.55,
  }));
  scene.add(linha);
  return linha;
})();

function mostrarMira(visivel) {
  alvoMira.visible = visivel;
  guiaMira.visible = visivel;
  faixaErro.visible = visivel;
}

function atualizarMira() {
  alvoMira.position.set(mira.x, ALTURA_MIRA, 0.05);
  alvoMira.lookAt(camera.position.x, ALTURA_MIRA, camera.position.z);

  // Largura da faixa: ±1,5 desvio padrão do erro na distância do gol
  const forca = estado.fase === 'carregando' ? Math.max(estado.carga, 0.3) : CONFIG.forcaIdeal;
  const sigma = coneDeErro({ forca, contato, cobrador, pressao: pressaoAtual() }, CONFIG);
  const distancia = Math.hypot(mira.x - bola.pos.x, bola.pos.z);
  const largura = Math.max(0.2, 2 * distancia * Math.tan(1.5 * sigma * GRAUS));
  faixaErro.scale.x = largura;
  faixaErro.position.set(mira.x, ALTURA_MIRA, 0.04);
  faixaErro.lookAt(camera.position.x, ALTURA_MIRA, camera.position.z);
  faixaErro.material.color.set(forca > CONFIG.forcaIdeal + 0.02 ? 0xff6b3d : 0xf7d84a);

  const pontos = guiaMira.geometry.attributes.position;
  pontos.setXYZ(0, bola.pos.x, 0.03, bola.pos.z);
  pontos.setXYZ(1, mira.x, 0.03, 0);
  pontos.needsUpdate = true;
  guiaMira.computeLineDistances();
}

// ---------- Uniformes ----------

// Camisa da lenda (js/elenco.js) no formato dos bonecos
function uniformeDaLenda(jogador) {
  const u = jogador.uniforme;
  if (!u) return jogador.visual.goleiro ? UNIFORMES.goleiroLendas : UNIFORMES.lendas;
  return {
    ...u,
    listras: u.padrao === 'listras' ? u.cores[0] : null,
    luvas: jogador.visual.goleiro ? (u.cores[0] || '#ff7a1a') : undefined,
  };
}

// Barreira e goleiro com as cores de um rival do clube do cobrador (RIVAIS, em js/elenco.js)
function nomeDoRival(jogador) {
  const rival = jogador.uniforme && RIVAIS[jogador.uniforme.clube];
  return rival ? rival.nome : '';
}

function uniformeAdversario(jogador) {
  const rival = jogador.uniforme && RIVAIS[jogador.uniforme.clube];
  if (!rival) return { ...UNIFORMES.adversario };
  return { ...UNIFORMES.adversario, ...rival, listras: rival.padrao === 'listras' ? rival.cores[0] : null, faixaMeiao: rival.calcao };
}

// ---------- Jogadores ----------

let cobradorBoneco = null;
let animacao = null;   // corrida e chute do cobrador (js/cobranca.js)
let sombraCobrador = null; // sombra do cobrador no gramado (js/sombras.js)
let bonecosBarreira = [];
let goleiroBoneco = null;
let animGoleiro = null;   // animação do goleiro por cima da lógica (js/animacaoDefesa.js)
let animBarreira = null;  // idem para a barreira
let sombraGoleiro = null;
// Os outros jogadores em campo: lógica em js/figurantes.js, bonecos em js/animacaoFigurantes.js
let figurantes = null;
let modoDaCobranca = 'treino'; // o modo da cobrança que está montada (no replay, o da cobrança gravada)
const animFigurantes = criarAnimadorFigurantes(scene, { criarSombra: (personagem, opcoes) => sombras.boneco(personagem, opcoes) });

function vestirCobrador(jogador) {
  if (cobradorBoneco) {
    sombraCobrador.remover();
    scene.remove(cobradorBoneco.grupo);
    cobradorBoneco.dispose();
  }
  cobradorBoneco = criarPersonagem({
    visual: jogador.visual,
    uniforme: uniformeDaLenda(jogador),
    numero: jogador.numero,
    nome: jogador.nomeCamisa || jogador.apelido,
  });
  scene.add(cobradorBoneco.grupo);
  sombraCobrador = sombras.boneco(cobradorBoneco, { raio: 0.4, destaque: true });
  // estilo: o jeito de bater da lenda (js/elenco.js, campo cobranca), para a animação
  animacao = criarCobranca(cobradorBoneco, {
    bola: { x: bola.pos.x, z: bola.pos.z }, alvo: { x: 0, z: 0 }, pe: jogador.pe, cfg: configDaCobranca(jogador),
    estilo: jogador.cobranca || {},
  });
}

// Na hora de correr para a bola a animação fica sabendo o chute escolhido (força, onde o pé pega, para onde
// vai e a técnica prevista), para o corpo bater do jeito certo. Depois disso animacao.tempoContato vale.
function prepararCobranca() {
  if (!animacao.preparar) return;
  animacao.preparar({
    forca: estado.forca,
    contato: { ...contato },
    alvo: { x: mira.x, z: 0 },
    tecnica: preverTecnica({ forca: estado.forca, contato, cobrador }, CONFIG),
  });
}

// Cada lenda corre e se posiciona do seu jeito (js/elenco.js, campo cobranca): distância da corrida,
// ângulo de aproximação, número de passos e ritmo viram os números que a animação entende
function configDaCobranca(jogador) {
  const c = jogador.cobranca;
  if (!c) return CONFIG;
  const cadencia = CONFIG.cobrador.cadencia * (c.ritmo || 1);
  const passos = c.passos || 3;
  return {
    ...CONFIG,
    cobrador: {
      ...CONFIG.cobrador,
      distancia: c.distancia ?? CONFIG.cobrador.distancia,
      angulo: c.angulo ?? CONFIG.cobrador.angulo,
      cadencia,
      corrida: Math.max(0.2, passos / (2 * cadencia) - 0.3),
      postura: c.postura || 'normal',
      braco: c.braco || 'normal',
    },
  };
}

// Companheiros do cobrador: o uniforme de linha do time dele (o goleiro-artilheiro veste outra camisa:
// uniforme.linha, em js/elenco.js, diz o que muda)
function uniformeDosCompanheiros(jogador) {
  const u = jogador.uniforme;
  if (!u) return { ...UNIFORMES.lendas };
  const linha = u.linha ? { ...u, ...u.linha } : u;
  return { ...linha, listras: linha.padrao === 'listras' ? linha.cores[0] : null };
}

// Os outros jogadores em campo: companheiros com o uniforme do time do cobrador, adversários com o do rival.
// Refeitos a cada cobrança e quando o cobrador muda (a corrida dele começa em outro lugar). O sorteio tem a
// semente da jogada: o replay repete os mesmos jogadores nos mesmos lugares.
function montarFigurantesDaCobranca() {
  figurantes = montarFigurantes(bola.pos, barreira, CONFIG, sorteioDaJogada(3), {
    penalti: modoDaCobranca === 'penalti',
    cobrador: { x: animacao.inicio.x, z: animacao.inicio.z },
    pe: cobrador.pe,
    goleiro: { x: goleiro.base.x, z: goleiro.z },
  });
  animFigurantes.montar(figurantes, {
    uniformeAtaque: uniformeDosCompanheiros(cobrador),
    uniformeDefesa: uniformeAdversario(cobrador),
    semente: sorteioDaJogada(4)(),
  });
}

// Barreira e goleiro do time adversário (genéricos), refeitos a cada falta com a camisa que contrasta
function montarAdversarios() {
  for (const b of bonecosBarreira) {
    b.sombra.remover();
    scene.remove(b.personagem.grupo);
    b.personagem.dispose();
  }
  const uniforme = uniformeAdversario(cobrador);
  const sorteio = sorteioDaJogada(1);
  bonecosBarreira = barreira.jogadores.map((j, i) => {
    const personagem = criarPersonagem({
      visual: visualAdversario(i + Math.floor(sorteio() * 8), j.altura),
      uniforme, numero: [4, 5, 6, 8, 3][i % 5], nome: '',
    });
    scene.add(personagem.grupo);
    const sombra = sombras.boneco(personagem, { raio: 0.4 });
    return { personagem, sombra };
  });
  animBarreira = criarAnimadorBarreira(bonecosBarreira.map((b) => b.personagem), { semente: sorteio(), diagnostico: false });
  if (!goleiroBoneco) {
    goleiroBoneco = criarPersonagem({ visual: VISUAL_GOLEIRO_ADVERSARIO, uniforme: UNIFORMES.goleiroAdversario, numero: 1, nome: '' });
    scene.add(goleiroBoneco.grupo);
    sombraGoleiro = sombras.boneco(goleiroBoneco, { raio: 0.45 });
  }
  // O goleiro é o mesmo boneco, mas a animação começa do zero a cada cobrança (com a semente da jogada)
  animGoleiro = criarAnimadorGoleiro(goleiroBoneco, { semente: sorteio(), diagnostico: false });
}

// ---------- Câmera ----------

let cameraBase = new THREE.Vector3();
let olharBase = new THREE.Vector3();
const olharAtual = new THREE.Vector3(); // para onde a câmera está olhando agora
let misturaAerea = 0;                   // 0 = câmera atrás do cobrador, 1 = câmera aérea

// Atrás do cobrador, estilo PES de PS2. A câmera fica no eixo bola → gol, atrás da bola, um pouco
// deslocada para o lado do cobrador, e recua até o gol inteiro, a bola e o cobrador (lá atrás, no
// começo da corrida) caberem na tela de uma vez. Gira de leve para o lado do cobrador quando precisa.
function posicionarCamera() {
  const c = CONFIG.camera;
  const dist = Math.hypot(bola.pos.x, bola.pos.z);
  const ax = bola.pos.x / dist;  // do gol para a bola (unitário)
  const az = bola.pos.z / dist;
  const lx = az;                 // para a direita de quem cobra
  const lz = -ax;
  const kx = animacao.inicio.x - bola.pos.x;
  const kz = animacao.inicio.z - bola.pos.z;
  const lateral = kx * lx + kz * lz; // m que o cobrador começa para o lado do eixo
  const fundo = kx * ax + kz * az;   // m que ele começa atrás da bola
  const hfov = 2 * Math.atan(Math.tan((camera.fov * GRAUS) / 2) * camera.aspect);
  const vfov = camera.fov * GRAUS;
  const meia = CONFIG.golLargura / 2 + 1.0; // com folga: a rede e a estrutura passam da trave
  let atras = Math.max(c.atras, fundo + c.atrasCobrador);
  let cx = 0;
  let cz = 0;
  let yaw = 0;
  let inclinacao = -c.inclinacao * GRAUS;
  for (let i = 0; i < 16; i++) {
    cx = bola.pos.x + ax * atras + lx * lateral * c.pesoCobrador;
    cz = bola.pos.z + az * atras + lz * lateral * c.pesoCobrador;
    // Ângulo horizontal (em relação à direção câmera → gol; + = direita) e vertical de cada ponto
    const ang = (px, pz) => {
      const dx = px - cx;
      const dz = pz - cz;
      return Math.atan2(dx * lx + dz * lz, -(dx * ax + dz * az));
    };
    const dCobrador = Math.hypot(animacao.inicio.x - cx, animacao.inicio.z - cz);
    const aCobrador = ang(animacao.inicio.x, animacao.inicio.z);
    const folga = Math.atan2(0.7, dCobrador);
    const h = [ang(-meia, 0), ang(meia, 0), ang(bola.pos.x, bola.pos.z), aCobrador - folga, aCobrador + folga];
    const v = [Math.atan2(-c.altura, dCobrador), Math.atan2(CONFIG.golAltura + 0.4 - c.altura, Math.hypot(cx, cz))];
    const hMin = Math.min(...h);
    const hMax = Math.max(...h);
    yaw = (hMin + hMax) / 2;
    inclinacao = (v[0] + v[1]) / 2;
    if (hMax - hMin <= hfov * 0.86 && v[1] - v[0] <= vfov * 0.9) break;
    atras += 0.75;
  }
  cameraBase = new THREE.Vector3(cx, c.altura, cz);
  const distanciaGol = Math.hypot(cx, cz);
  const dirx = -ax * Math.cos(yaw) + lx * Math.sin(yaw);
  const dirz = -az * Math.cos(yaw) + lz * Math.sin(yaw);
  olharBase = new THREE.Vector3(cx + dirx * distanciaGol, c.altura + distanciaGol * Math.tan(inclinacao), cz + dirz * distanciaGol);
  camera.position.copy(cameraBase);
  olharAtual.copy(olharBase);
  camera.lookAt(olharAtual);
  misturaAerea = 0;
}

// Câmera do replay lateral: do lado direito de quem cobra, sempre o mesmo lado, com o gol à direita da
// tela (como no treino do PES de PS2). No celular em pé cobrador e gol não cabem juntos, então ela anda
// junto com a bola, um pouco adiantada, e olha para um ponto entre a bola e o gol, como a câmera lateral
// da TV. O zoom compensa a distância: falta pela esquerda fica mais longe da câmera e ganha mais zoom.
function poseReplayLateral(inicio) {
  const c = CONFIG.camera;
  const x = Math.max(0, inicio.x) + c.replayLateralDist;
  // Ao lado da bola (nunca atrás da linha do gol), adiantada na direção do gol
  const zBola = Math.max(0, Math.min(inicio.z, bola.pos.z));
  const z = Math.max(-1, inicio.z + (zBola - inicio.z) * c.replayLateralSegue - c.replayLateralFrente);
  const pos = new THREE.Vector3(x, c.replayLateralAltura, z);
  // Olha para a bola (no começo, o cobrador e a bola); conforme a bola se aproxima do gol, puxa o olhar
  // para o meio do gol. A bola que passa por cima ou sai pelo lado não leva a câmera para a arquibancada.
  const centroGol = new THREE.Vector3(0, 1.2, 0);
  const chegada = 1 - Math.max(0, Math.min(1, zBola / Math.max(1, inicio.z)));
  const olhar = new THREE.Vector3(
    Math.max(-6, Math.min(6, bola.pos.x)),
    Math.min(3.2, bola.pos.y + 0.2),
    Math.max(-1.5, bola.pos.z)
  ).lerp(centroGol, c.replayLateralAlvo * chegada);
  // Zoom: a bola fica do mesmo tamanho na tela, esteja a falta perto ou longe da câmera. Mais aberta no
  // começo (a corrida do cobrador cabe) e um pouco mais fechada quando a bola chega no gol.
  const d = Math.max(3, pos.distanceTo(olhar));
  const larguraVisivel = c.replayLateralLargura * (1.15 - 0.25 * chegada) * Math.min(1.5, Math.max(0.35, c.replayLateralDist / d));
  return { pos, olhar, larguraVisivel };
}

// Câmera do replay atrás do gol: baixa, do lado contrário ao canto em que a bola vai (como na TV).
// Começa olhando para o cobrador e vai acompanhando a bola.
function poseReplay() {
  const c = CONFIG.camera;
  const lado = (registro && registro.mira < 0 ? 1 : -1) * c.replayLado;
  const pos = new THREE.Vector3(lado, c.replayAltura, -c.replayAtras);
  // Olha para a bola (um pouco puxado para o meio do gol, para o gol ficar na tela o tempo todo)
  const olhar = new THREE.Vector3(bola.pos.x, bola.pos.y + 0.3, bola.pos.z).lerp(new THREE.Vector3(0, 1.2, 0), 0.3);
  // Zoom como o cinegrafista: fechado com a bola longe, abre conforme ela chega
  const d = pos.distanceTo(bola.pos);
  const k = Math.min(1, Math.max(0, (d - 9) / 18));
  const larguraVisivel = 34 - 20 * k; // graus de campo de visão horizontal: 34 perto, 14 longe
  return { pos, olhar, larguraVisivel };
}

// Campo de visão a partir da largura visível (graus na horizontal), respeitando o mínimo vertical
// (o replay lateral pode fechar mais o zoom, para a falta do outro lado do campo não ficar minúscula)
function fovParaLargura(larguraVisivel, minimo = CONFIG.camera.fovMin) {
  const fov = 2 * Math.atan(Math.tan((larguraVisivel * GRAUS) / 2) / camera.aspect) / GRAUS;
  return Math.max(minimo, fov);
}

// Câmera aérea: alta e de lado (diagonal), olhando para um ponto entre a bola e o gol.
// No começo mostra a bola saindo; no fim, o gol inteiro.
function poseAerea(inicio) {
  const c = CONFIG.camera;
  const distancia = Math.hypot(inicio.x, inicio.z);
  const fx = -inicio.x / distancia; // direção da bola para o gol
  const fz = -inicio.z / distancia;
  const dx = -fz;                   // direita de quem cobra
  const dz = fx;
  // Fica do lado de fora: falta pela direita, câmera mais à direita (e vice-versa)
  const lado = (inicio.x < -0.5 ? -1 : 1) * c.aereaLado;
  const pos = new THREE.Vector3(
    inicio.x - fx * c.aereaAtras + dx * lado + (bola.pos.x - inicio.x) * c.aereaAproxima,
    c.aereaAltura,
    inicio.z - fz * c.aereaAtras + dz * lado + (bola.pos.z - inicio.z) * c.aereaAproxima
  );
  const centroGol = new THREE.Vector3(0, 1, 0);
  const olhar = new THREE.Vector3(bola.pos.x, bola.pos.y, bola.pos.z).lerp(centroGol, c.aereaAlvo);
  return { pos, olhar };
}

// Câmera dos testes automáticos (jogoTeste.camera): parada num ponto, ou presa ao cobrador
let cameraTeste = null;
function aplicarCameraTeste() {
  const t = cameraTeste;
  const base = t.seguir && cobradorBoneco ? cobradorBoneco.grupo.position : { x: 0, y: 0, z: 0 };
  camera.position.set(base.x + t.pos[0], t.pos[1], base.z + t.pos[2]);
  olharAtual.set(base.x + t.olhar[0], t.olhar[1], base.z + t.olhar[2]);
  camera.lookAt(olharAtual);
  if (t.fov && camera.fov !== t.fov) {
    camera.fov = t.fov;
    camera.updateProjectionMatrix();
  }
}

function atualizarCamera(dt) {
  if (cameraTeste) {
    aplicarCameraTeste();
    return;
  }
  const c = CONFIG.camera;
  const inicio = posicaoDaFalta(falta);
  const emJogo = estado.fase === 'voo' || estado.fase === 'fim';

  // Câmera atrás do cobrador; depois do chute acompanha a bola de leve
  const posAlvo = cameraBase.clone();
  const olharAlvo = olharBase.clone();
  if (emJogo) {
    posAlvo.x += (bola.pos.x - inicio.x) * c.seguir;
    posAlvo.y += (bola.pos.y - inicio.y) * c.seguir * 0.5;
    posAlvo.z += Math.max(-8, (bola.pos.z - inicio.z) * c.seguir);
    olharAlvo.x += (bola.pos.x - inicio.x) * c.seguir;
  }

  // No replay a câmera é outra: lateral (acompanha a bola) ou atrás do gol (parada, só olhando a bola)
  if (replay) {
    const rp = c.replayLateral ? poseReplayLateral(inicio) : poseReplay();
    // Primeiro quadro do replay: corte seco para a câmera nova; depois ela desliza atrás da bola
    const corte = !replay.cameraPronta;
    replay.cameraPronta = true;
    camera.position.lerp(rp.pos, corte || !c.replayLateral ? 1 : 1 - Math.exp(-dt * 6));
    if (corte) olharAtual.copy(rp.olhar);
    else olharAtual.lerp(rp.olhar, 1 - Math.exp(-dt * 7));
    camera.lookAt(olharAtual);
    if (estado.fase !== 'fim') {
      const fovAlvo = fovParaLargura(rp.larguraVisivel, c.replayLateral ? 20 : c.fovMin);
      camera.fov += (fovAlvo - camera.fov) * (corte ? 1 : 1 - Math.exp(-dt * 4));
      camera.updateProjectionMatrix();
    }
    misturaAerea = 0;
    return;
  }

  // Troca para a aérea com uma transição suave (ou corte seco, se o tempo for 0)
  const querAerea = emJogo && c.aerea ? 1 : 0;
  if (c.aereaTransicao <= 0) misturaAerea = querAerea;
  else if (misturaAerea < querAerea) misturaAerea = Math.min(querAerea, misturaAerea + dt / c.aereaTransicao);
  else misturaAerea = Math.max(querAerea, misturaAerea - dt / c.aereaTransicao);
  const t = misturaAerea * misturaAerea * (3 - 2 * misturaAerea);
  if (t > 0) {
    const aerea = poseAerea(inicio);
    posAlvo.lerp(aerea.pos, t);
    olharAlvo.lerp(aerea.olhar, t);
  }

  const suavidade = t > 0 ? 1 : 1 - Math.exp(-dt * 5);
  camera.position.lerp(posAlvo, suavidade);
  olharAtual.lerp(olharAlvo, suavidade);
  camera.lookAt(olharAtual);
}

function ajustarTela() {
  const largura = window.innerWidth;
  const altura = window.innerHeight;
  renderer.setSize(largura, altura);
  camera.aspect = largura / altura;
  // No celular em pé a tela é estreita: abre o campo de visão para o gol caber inteiro
  camera.fov = fovParaLargura(CONFIG.camera.larguraVisivel);
  camera.updateProjectionMatrix();
  // Girou o celular ou mudou o zoom: enquadra de novo
  if (animacao && (estado.fase === 'pronto' || estado.fase === 'carregando')) posicionarCamera();
}
window.addEventListener('resize', ajustarTela);
ajustarTela();

// ---------- Estado do jogo ----------

// fase: 'pronto' -> 'carregando' (segurando CHUTAR) -> 'corrida' (cobrador corre e chuta) -> 'voo' -> 'fim'
const estado = {
  fase: 'pronto', carga: 0, forca: 0, tempo: 0, espera: 0, tCobranca: 0, tFim: 0,
  gols: 0, cobrancas: 0, sequencia: 0, fixa: false,
  modo: 'treino', // 'treino' (falta sorteada) | 'desafio' (Desafio do Dia) | 'penalti'
};
const MODOS = ['treino', 'desafio', 'penalti'];
const FALTA_PENALTI = { distancia: 11, angulo: 0, penalti: true };
// Desafio do Dia: a falta de número `indice` (0 = a primeira) do dia `dia`. Vale a maior sequência de gols;
// errou, volta para a primeira falta do dia. A melhor sequência de hoje fica salva no aparelho.
const desafio = { dia: '', indice: 0, melhorHoje: 0, tentativas: 0, enviado: 0, falta: null, cobrador: null, sementeJogada: 0, sementeChute: 0 };
// Ranking do dia na internet (Supabase); sem endereço e chave em config.js, fica só o recorde do aparelho
const ranking = criarRanking(CONFIG.ranking);
// Recorde de sequência de gols em cada modo, salvo no aparelho
const recordes = { treino: 0, desafio: 0, penalti: 0 };
for (const [modo, v] of Object.entries(lerSalvo('fkl-recordes', {}))) if (modo in recordes && Number.isFinite(v)) recordes[modo] = v;
// Pênaltis: lado em que a bola cruzou a linha nas últimas cobranças (o goleiro tem memória e vai mais
// para o lado em que você insiste)
let historicoPenaltis = [];

// Data de hoje no formato 2026-10-10 (no modo teste, sempre o mesmo dia, para as capturas serem previsíveis)
function diaDeHoje() {
  if (MODO_TESTE) return '2026-10-10';
  const d = new Date();
  const dois = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

// Monta a falta de hoje de número desafio.indice: falta, cobrador sugerido e as sementes do lance saem de
// sorteios com a data como semente, então todo mundo recebe o mesmo desafio no mesmo dia
function prepararDesafio() {
  const dia = diaDeHoje();
  if (desafio.dia !== dia) {
    const salvo = lerSalvo('fkl-desafio', null);
    const mesmoDia = salvo && salvo.dia === dia;
    desafio.dia = dia;
    desafio.indice = 0;
    desafio.melhorHoje = mesmoDia && Number.isFinite(salvo.melhor) ? salvo.melhor : 0;
    desafio.tentativas = mesmoDia && Number.isFinite(salvo.tentativas) ? salvo.tentativas : 0;
    desafio.enviado = mesmoDia && Number.isFinite(salvo.enviado) ? salvo.enviado : 0;
    // Virou o dia no meio do jogo: o desafio novo começa do zero
    estado.sequencia = 0;
    estado.gols = 0;
    estado.cobrancas = 0;
  }
  const semente = (uso) => sementeDoTexto(`${dia}#${desafio.indice}#${uso}`);
  desafio.falta = sortearFalta(criarSorteio(semente('falta')));
  desafio.cobrador = ELENCO[Math.floor(criarSorteio(semente('cobrador'))() * ELENCO.length)];
  desafio.sementeJogada = semente('jogada');
  desafio.sementeChute = semente('chute');
}
function salvarDesafio() {
  salvar('fkl-desafio', { dia: desafio.dia, melhor: desafio.melhorHoje, tentativas: desafio.tentativas, enviado: desafio.enviado });
}

// Config do goleiro no desafio: o padrão com os ajustes fixos de config.js (nunca os do painel, que fica
// trancado): todo mundo enfrenta o mesmo goleiro
function configDaDefesa(modo) {
  if (modo !== 'desafio') return CONFIG;
  return { ...CONFIG, goleiro: { ...PADRAO_GOLEIRO, ...(CONFIG.desafio.goleiro || {}) } };
}
let cfgDefesa = CONFIG; // a config usada pelo goleiro na cobrança atual

// Pressão do lance (aumenta o erro; a frieza do cobrador corta parte): zero no treino, cresce com a
// sequência no Desafio do Dia e é fixa no pênalti
function pressaoAtual() {
  if (estado.modo === 'penalti') return CONFIG.penalti.pressao || 0;
  if (estado.modo === 'desafio') return Math.min(CONFIG.desafio.pressaoMax, estado.sequencia * CONFIG.desafio.pressaoPorGol);
  return 0;
}
let falta = { distancia: CONFIG.falta.distancia, angulo: CONFIG.falta.angulo };
let bola;
let barreira;
let goleiro;
let cobrador = null;
let tiro = null; // o que chutar() devolveu
// O que aconteceu na cobrança atual
const jogada = {};
function zerarJogada() {
  Object.assign(jogada, {
    batida: null, redeFora: false, barreira: false, jogador: null, defesa: null, barreiraPulou: false, porBaixo: false,
    resultado: null, somRede: false, quiques: 0, lentaUsada: false, lentaAte: 0,
  });
}

const audio = criarAudio(CONFIG);

// Replay: a última cobrança guardada (falta, cobrador, chute e sementes) roda de novo com a câmera
// atrás do gol. O vídeo é gravado durante o replay (tela e som), e depois dá para salvar ou compartilhar.
const gravador = criarGravador({ canvas: renderer.domElement, audio });
let registro = null;   // a última cobrança feita
let replay = null;     // { gravar } enquanto o replay roda
let videoGol = null;   // { blob, nome } do replay gravado
const PAUSA_REPLAY = 0.8; // s parado antes da corrida, no replay
const botoes = {
  replay: document.getElementById('botao-replay'),
  video: document.getElementById('botao-video'),
  salvar: document.getElementById('botao-salvar'),
  entrarRanking: document.getElementById('botao-entrar-ranking'),
};
botoes.replay.addEventListener('click', (e) => {
  e.currentTarget.blur();
  iniciarReplay({ gravar: false });
});
botoes.video.addEventListener('click', (e) => {
  e.currentTarget.blur();
  iniciarReplay({ gravar: true });
});
botoes.salvar.addEventListener('click', async (e) => {
  e.currentTarget.blur();
  if (!videoGol) return;
  botoes.salvar.disabled = true;
  try {
    await salvarVideo(videoGol.blob, videoGol.nome);
  } finally {
    botoes.salvar.disabled = false;
  }
});

// Os botões aparecem depois da cobrança e ficam até o próximo chute
function mostrarAcoes() {
  const pode = Boolean(registro) && !replay && (estado.fase === 'fim' || estado.fase === 'pronto');
  botoes.replay.hidden = !pode;
  botoes.video.hidden = !(pode && CONFIG.video && gravador.disponivel && !videoGol);
  botoes.salvar.hidden = !(pode && videoGol);
  const parado = estado.fase === 'fim' || estado.fase === 'pronto';
  botoes.entrarRanking.hidden = !(estado.modo === 'desafio' && !replay && parado && podeEntrarNoRanking());
}

// ---------- Desafio do Dia: ranking ----------

// Nome guardado no aparelho (quem joga digita na folha do ranking)
const nomeSalvo = () => {
  const nome = lerSalvo('fkl-nome', '');
  return typeof nome === 'string' ? nome : '';
};
// Pode entrar no ranking: sequência de hoje chegou ao mínimo e é maior que a já enviada
const podeEntrarNoRanking = () => desafio.melhorHoje >= CONFIG.desafio.minimoRanking && desafio.melhorHoje > desafio.enviado;

function dadosDoRanking(extra) {
  return {
    dia: desafio.dia, meuNome: nomeSalvo(), melhorHoje: desafio.melhorHoje,
    podeEnviar: podeEntrarNoRanking(), enviado: desafio.enviado > 0, linhas: [], mensagem: '', ...extra,
  };
}

// Abre a folha do ranking de hoje (e busca a lista na internet)
async function abrirRanking() {
  if (estado.modo !== 'desafio' || estado.fase === 'carregando' || estado.fase === 'corrida') return;
  if (!desafio.dia) prepararDesafio();
  if (!ranking.disponivel) {
    ui.mostrarRanking(dadosDoRanking({ mensagem: 'Ranking ainda não ligado: a melhor sequência fica só neste aparelho' }));
    return;
  }
  ui.mostrarRanking(dadosDoRanking({ mensagem: 'Carregando...' }));
  try {
    const linhas = await ranking.listar(desafio.dia);
    if (ui.rankingAberto()) ui.mostrarRanking(dadosDoRanking({ linhas }));
  } catch {
    if (ui.rankingAberto()) ui.mostrarRanking(dadosDoRanking({ mensagem: 'Não consegui carregar o ranking. Tente de novo.' }));
  }
}

// Manda a melhor sequência de hoje com o nome digitado
async function enviarRanking(nome) {
  nome = String(nome || '').trim().slice(0, 24);
  if (!nome || !podeEntrarNoRanking()) {
    ui.mostrarRanking(dadosDoRanking()); // tira o "Enviando..." do botão
    return;
  }
  salvar('fkl-nome', nome);
  if (!ranking.disponivel) {
    ui.mostrarRanking(dadosDoRanking({ mensagem: 'Ranking ainda não ligado: a melhor sequência fica só neste aparelho' }));
    return;
  }
  try {
    await ranking.enviar({ dia: desafio.dia, nome, gols: desafio.melhorHoje });
    desafio.enviado = desafio.melhorHoje;
    salvarDesafio();
    mostrarAcoes();
    const linhas = await ranking.listar(desafio.dia).catch(() => []);
    if (ui.rankingAberto()) ui.mostrarRanking(dadosDoRanking({ linhas, mensagem: `Você entrou com ${desafio.melhorHoje} gols!` }));
  } catch (e) {
    if (ui.rankingAberto()) ui.mostrarRanking(dadosDoRanking({ mensagem: (e && e.message) || 'Não consegui enviar. Tente de novo.' }));
  }
}

const ui = criarInterface({
  aoEscolherCobrador: (jogador) => escolherCobrador(jogador),
  aoAlternarMudo: () => {
    audio.iniciar();
    audio.mudo = !audio.mudo;
    ui.definirMudo(audio.mudo);
  },
  aoAlternarFixar: () => {
    estado.fixa = !estado.fixa;
    ui.definirFixar(estado.fixa);
  },
  aoTrocarModo: (modo) => trocarModo(modo),
  aoAbrirRanking: () => abrirRanking(),
  aoEnviarRanking: (nome) => enviarRanking(nome),
});
ui.definirMudo(audio.mudo);
ui.definirFixar(estado.fixa);
document.getElementById('versao').textContent = VERSAO;

const elementos = {
  barra: document.getElementById('barra-preenchida'),
  barraIdeal: document.getElementById('barra-ideal'),
  botao: document.getElementById('botao-chute'),
  dica: document.getElementById('dica'),
  contatoBola: document.getElementById('contato-bola'),
  contatoPonto: document.getElementById('contato-ponto'),
  contatoRotulo: document.getElementById('contato-rotulo'),
};
elementos.dica.textContent = 'Arraste na tela para mirar · toque na bola para escolher onde o pé pega · segure CHUTAR e solte';

// A barra mostra só a parte já carregada; as cores ficam fixas ao longo da barra inteira
function mostrarCarga(carga) {
  elementos.barra.style.clipPath = `inset(0 ${(1 - carga) * 100}% 0 0)`;
}

function posicaoDaFalta({ distancia, angulo }) {
  return {
    x: distancia * Math.sin(angulo * GRAUS),
    y: CONFIG.raioBola,
    z: distancia * Math.cos(angulo * GRAUS),
  };
}

// Falta sorteada: de várias distâncias e ângulos, sempre fora da grande área.
// sorteio: função de 0 a 1 (no Desafio do Dia, com a data como semente)
function sortearFalta(sorteio = aleatorio) {
  const s = CONFIG.sorteio;
  for (let i = 0; i < 50; i++) {
    const distancia = Math.round(s.distanciaMin + sorteio() * (s.distanciaMax - s.distanciaMin));
    const angulo = Math.round((sorteio() * 2 - 1) * s.anguloMax);
    const p = posicaoDaFalta({ distancia, angulo });
    const foraDaArea = p.z > 17 || Math.abs(p.x) > 20.5;
    if (foraDaArea && Math.abs(p.x) < 17) return { distancia, angulo };
  }
  return { distancia: 24, angulo: 0 };
}

function placar() {
  const recorde = recordes[estado.modo] ? ` · recorde ${recordes[estado.modo]}` : '';
  if (estado.modo === 'desafio') return `Sequência ${estado.sequencia} · melhor hoje ${desafio.melhorHoje}${recorde}`;
  const seq = estado.sequencia >= 2 ? ` · sequência ${estado.sequencia}` : '';
  return estado.cobrancas ? `Gols: ${estado.gols} de ${estado.cobrancas}${seq}${recorde}` : '';
}

// Troca o modo de jogo: zera o placar da sessão (o recorde fica) e monta a próxima cobrança
function trocarModo(modo) {
  if (!MODOS.includes(modo) || modo === estado.modo) return;
  if (estado.fase === 'carregando' || estado.fase === 'corrida') return;
  if (replay) pularReplay(false);
  estado.modo = modo;
  estado.gols = 0;
  estado.cobrancas = 0;
  estado.sequencia = 0;
  estado.fixa = false;
  desafio.indice = 0; // o Desafio do Dia recomeça da primeira falta (a melhor sequência de hoje fica)
  ui.definirFixar(false);
  ui.definirModo(modo);
  salvar('fkl-modo', modo);
  // No desafio o painel fica trancado e os números do jogo voltam ao padrão (todo mundo joga igual)
  painel.bloquear(modo === 'desafio');
  elementos.barraIdeal.style.left = `${CONFIG.forcaIdeal * 100}%`;
  ui.mostrarPlacar(placar());
  novaCobranca();
}

// Falta, pênalti ou "falta N do dia", com o rival
function mostrarInfoFalta() {
  const modo = replay ? registro.modo : estado.modo;
  ui.mostrarFalta(falta, nomeDoRival(cobrador), modo === 'desafio' ? desafio.indice + 1 : 0);
}

// ---------- Cobrador ----------

function escolherCobrador(jogador) {
  if (estado.fase !== 'pronto') return;
  const lista = sugerirCobradores(ELENCO, falta, pressaoAtual());
  const item = lista.find((x) => x.jogador === jogador) || lista[0];
  cobrador = item.jogador;
  ui.mostrarCobrador(cobrador, item.nota, lista);
  mostrarInfoFalta();
  vestirCobrador(cobrador);
  montarAdversarios();
  montarFigurantesDaCobranca();
  posicionarCamera();
  mostrarContato();
}

// ---------- Ponto de contato (onde o pé pega na bola) ----------

let contato = { x: 0, y: 0 };
try {
  const salvo = JSON.parse(localStorage.getItem('fkl-contato'));
  if (salvo && Number.isFinite(salvo.x) && Number.isFinite(salvo.y)) contato = salvo;
} catch {
  // Sem armazenamento: começa no centro
}

const NOMES_TECNICA = {
  rasteiro: 'Rasteiro',
  folhaSeca: 'Folha seca',
  semRotacao: 'Sem rotação',
  trivela: 'Trivela',
  curva: 'Curva',
  cavadinha: 'Cavadinha',
  pancada: 'Pancada',
  colocado: 'Colocada',
};

function descreverContato() {
  const partes = [];
  if (contato.x > 0.15) partes.push('←');
  else if (contato.x < -0.15) partes.push('→');
  const forca = estado.fase === 'carregando' ? estado.carga : CONFIG.forcaIdeal;
  const tecnica = cobrador ? preverTecnica({ forca, contato, cobrador }, CONFIG) : null;
  let nome = NOMES_TECNICA[tecnica] || 'Centro';
  if (contato.y > CONFIG.rasteiroInicio - 0.02 && contato.y < CONFIG.rasteiroFim) nome = 'Meia altura';
  partes.push(nome);
  return partes.join(' ');
}

function mostrarContato() {
  elementos.contatoPonto.style.left = `${50 + contato.x * 50}%`;
  elementos.contatoPonto.style.top = `${50 - contato.y * 50}%`;
  elementos.contatoRotulo.textContent = descreverContato();
}

function escolherContato(e) {
  const r = elementos.contatoBola.getBoundingClientRect();
  let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let y = -(e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const d = Math.hypot(x, y);
  if (d < 0.12) x = y = 0;          // perto do centro, gruda no centro
  else if (d > CONTATO_MAXIMO) {    // não deixa sair da bola
    x *= CONTATO_MAXIMO / d;
    y *= CONTATO_MAXIMO / d;
  }
  contato = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  mostrarContato();
}

elementos.contatoBola.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  elementos.contatoBola.setPointerCapture(e.pointerId);
  escolherContato(e);
});
elementos.contatoBola.addEventListener('pointermove', (e) => {
  if (elementos.contatoBola.hasPointerCapture(e.pointerId)) escolherContato(e);
});
elementos.contatoBola.addEventListener('pointerup', () => {
  try {
    localStorage.setItem('fkl-contato', JSON.stringify(contato));
  } catch {
    // Sem armazenamento: vale só até fechar a página
  }
});

// ---------- Nova cobrança ----------

function novaCobranca() {
  if (gravador.gravando) gravador.descartar(); // só o replay grava; se sobrou algo ligado, joga fora
  const emReplay = Boolean(replay);
  const modo = emReplay ? registro.modo : estado.modo;
  modoDaCobranca = modo;
  if (emReplay) {
    falta = { ...registro.falta };
    cobrador = registro.cobrador;
  } else if (modo === 'penalti') {
    falta = { ...FALTA_PENALTI };
  } else if (modo === 'desafio') {
    prepararDesafio();
    falta = { ...desafio.falta };
  } else if (!estado.fixa) {
    falta = sortearFalta();
  }
  sementeJogada = emReplay ? registro.sementeJogada : modo === 'desafio' ? desafio.sementeJogada : aleatorio();
  bola = criarBola(posicaoDaFalta(falta));
  bolaVisual.reiniciar();
  cfgDefesa = configDaDefesa(modo);
  if (modo === 'penalti') {
    // Sem barreira; o goleiro decide o canto já aqui (sorteio com semente, para o replay repetir), olhando
    // para onde você bateu os últimos pênaltis
    barreira = semBarreira(bola.pos);
    const historico = emReplay ? registro.historico || [] : historicoPenaltis;
    goleiro = criarGoleiro(bola.pos, null, cfgDefesa, { penalti: { historico: [...historico], aleatorio: sorteioDaJogada(2) } });
  } else {
    barreira = montarBarreira(bola.pos, CONFIG, sorteioDaJogada(0));
    goleiro = criarGoleiro(bola.pos, barreira, cfgDefesa);
  }
  estado.fase = 'pronto';
  estado.carga = 0;
  estado.tempo = 0;
  estado.tCobranca = 0;
  tiro = null;
  zerarJogada();
  mostrarCarga(0);
  rastro.limpar();
  cenario.rede.reiniciar();
  cenario.torcida.festa(0);
  ui.esconderResultado();
  ui.emJogo(false);
  ui.mostrarMensagem('');
  elementos.dica.style.visibility = 'visible';

  // Mira começa no lado do gol que a barreira não cobre
  mira.x = -barreira.lado * 1.9;

  // Cobrador sorteado a cada falta (com a falta fixa, mantém a escolha; no Desafio do Dia é o do dia);
  // a lista mostra o sugerido
  const lista = sugerirCobradores(ELENCO, falta, pressaoAtual());
  if (!emReplay && (!cobrador || modo === 'desafio' || !estado.fixa)) {
    cobrador = modo === 'desafio' ? desafio.cobrador : ELENCO[Math.floor(aleatorio() * ELENCO.length)];
  }
  const nota = lista.find((x) => x.jogador === cobrador).nota;
  ui.mostrarCobrador(cobrador, nota, lista);
  mostrarInfoFalta();
  vestirCobrador(cobrador);
  montarAdversarios();
  montarFigurantesDaCobranca();
  posicionarCamera();

  if (emReplay) {
    // Replay: a mesma falta, o mesmo cobrador e o mesmo chute; só a câmera muda
    contato = { ...registro.contato };
    mira.x = registro.mira;
    mostrarContato();
    mostrarMira(false);
    estado.forca = registro.forca;
    estado.fase = 'corrida';
    estado.tCobranca = -PAUSA_REPLAY;
    sorteioChute = criarSorteio(registro.sementeChute);
    elementos.dica.style.visibility = 'hidden';
    prepararCobranca();
    audio.torcidaTensao(animacao.tempoContato + PAUSA_REPLAY);
    if (replay.gravar) gravador.comecar();
  } else {
    mostrarMira(true);
    atualizarMira();
    mostrarContato();
    audio.apito();
  }
  audio.torcidaAmbiente(0.45);
  ui.mostrarPlacar(placar());
  mostrarAcoes();
}

function iniciarReplay({ gravar }) {
  if (!registro || replay) return;
  if (estado.fase !== 'fim' && estado.fase !== 'pronto') return;
  // Guarda a falta e o cobrador de agora: o replay pode ser de outro modo, e com a falta fixa a cobrança
  // seguinte precisa voltar para eles
  replay = { gravar: Boolean(gravar && CONFIG.video && gravador.disponivel), antes: { falta: { ...falta }, cobrador } };
  ui.modoReplay(true);
  mostrarAcoes();
  novaCobranca();
}

// Fim do replay: guarda o vídeo (se gravou) e volta para o jogo
function encerrarReplay() {
  const r = replay;
  replay = null;
  ui.modoReplay(false);
  ajustarTela();
  falta = { ...r.antes.falta };
  cobrador = r.antes.cobrador;
  if (r.gravar) {
    const apelido = (cobrador.apelido || cobrador.nome).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const nome = `${jogada.resultado === 'gol' ? 'gol' : 'falta'}-${apelido}`;
    gravador.parar().then((blob) => {
      if (!blob) return;
      videoGol = { blob, nome };
      mostrarAcoes();
    });
  }
  novaCobranca();
}

// Tocou na tela no meio do replay: pula para a próxima cobrança
function pularReplay(recomecar = true) {
  if (!replay) return;
  if (replay.gravar) gravador.descartar();
  const r = replay;
  replay = null;
  ui.modoReplay(false);
  ajustarTela();
  falta = { ...r.antes.falta };
  cobrador = r.antes.cobrador;
  if (recomecar) novaCobranca();
}

// Fora do treino, a bola no ar precisa terminar o lance (senão dava para cancelar um erro no Desafio do Dia)
const podePularVoo = () => estado.fase === 'fim' || (estado.fase === 'voo' && estado.modo === 'treino');

function comecarCarga() {
  // Apertar CHUTAR com a bola ainda no ar (ou no replay) já prepara a próxima cobrança
  if (replay) pularReplay();
  else if (podePularVoo()) novaCobranca();
  if (estado.fase !== 'pronto' || ui.listaAberta()) return;
  estado.fase = 'carregando';
  estado.carga = 0;
  ui.mostrarMensagem('');
  elementos.dica.style.visibility = 'hidden';
  elementos.botao.classList.add('pressionado');
}

function soltarChute() {
  elementos.botao.classList.remove('pressionado');
  if (estado.fase !== 'carregando') return;
  estado.forca = estado.carga;
  estado.fase = 'corrida';
  estado.tCobranca = 0;
  prepararCobranca();
  audio.torcidaTensao(animacao.tempoContato);
  // Guarda a cobrança para o replay (a nova substitui a anterior e o vídeo dela)
  const sementeChute = estado.modo === 'desafio' ? desafio.sementeChute : aleatorio();
  sorteioChute = criarSorteio(sementeChute);
  registro = {
    modo: estado.modo, falta: { ...falta }, cobrador, contato: { ...contato }, mira: mira.x, forca: estado.forca,
    sementeJogada, sementeChute, pressao: pressaoAtual(), historico: [...historicoPenaltis],
  };
  videoGol = null;
  mostrarAcoes();
}

// O pé encontra a bola: a física assume daqui
function executarChute() {
  tiro = chutar(bola, { alvo: { x: mira.x, z: 0 }, forca: estado.forca, contato, cobrador, pressao: registro.pressao || 0 }, CONFIG, sorteioChute);
  estado.fase = 'voo';
  estado.tempo = 0;
  // O contato cai entre dois quadros: a bola já sai com o tempo que passou desde o toque do pé (no máximo
  // um quadro), para o pé não atravessar a bola parada. Os passos da física são os mesmos; só começam antes.
  restoFisica = Math.min(1 / 30, Math.max(0, estado.tCobranca - animacao.tempoContato));
  mostrarMira(false);
  ui.emJogo(true);
  ui.mostrarMensagem(`Força ${Math.round(estado.forca * 100)}% · ${Math.round(tiro.velocidade * 3.6)} km/h`);
  audio.chute(estado.forca);
  jogada.barreiraPulou = barreira.pula;
}

function encerrarJogada(espera) {
  estado.fase = 'fim';
  estado.espera = espera;
  estado.tFim = 0;
}

// ---------- Controles ----------

const botao = elementos.botao;
botao.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  botao.setPointerCapture(e.pointerId); // continua valendo mesmo se o dedo escorregar para fora
  audio.iniciar();
  comecarCarga();
});
botao.addEventListener('pointerup', soltarChute);
botao.addEventListener('pointercancel', soltarChute);
botao.addEventListener('contextmenu', (e) => e.preventDefault());

// No computador, a barra de espaço também chuta e as setas mexem a mira
const digitando = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
window.addEventListener('keydown', (e) => {
  if (digitando(e)) return;
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    audio.iniciar();
    comecarCarga();
  } else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && estado.fase === 'pronto') {
    mira.x = limitarMira(mira.x + (e.code === 'ArrowLeft' ? -0.25 : 0.25));
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && !digitando(e)) soltarChute();
});

const limitarMira = (x) => Math.max(-CONFIG.mira.limite, Math.min(CONFIG.mira.limite, x));

// Arrastar o dedo na tela mexe a mira na horizontal; tocar durante o voo pula para a próxima cobrança
const telaJogo = document.getElementById('jogo');
let arrasto = null;
telaJogo.addEventListener('pointerdown', (e) => {
  audio.iniciar();
  if (replay) {
    pularReplay();
    return;
  }
  if (podePularVoo()) {
    novaCobranca();
    return;
  }
  if (estado.fase === 'voo') return;
  if (estado.fase !== 'pronto') return;
  telaJogo.setPointerCapture(e.pointerId);
  arrasto = { x: e.clientX, mira: mira.x };
});
telaJogo.addEventListener('pointermove', (e) => {
  if (!arrasto || estado.fase !== 'pronto') return;
  // Metros por pixel na distância do gol: o alvo acompanha o dedo
  const distancia = camera.position.distanceTo(new THREE.Vector3(mira.x, ALTURA_MIRA, 0));
  const larguraVisivel = 2 * distancia * Math.tan((camera.fov * GRAUS) / 2) * camera.aspect;
  const metrosPorPixel = (larguraVisivel / window.innerWidth) * CONFIG.mira.sensibilidade;
  mira.x = limitarMira(arrasto.mira + (e.clientX - arrasto.x) * metrosPorPixel);
});
const soltarArrasto = () => {
  arrasto = null;
};
telaJogo.addEventListener('pointerup', soltarArrasto);
telaJogo.addEventListener('pointercancel', soltarArrasto);

// Painel de ajuste: mexer na posição da falta fixa a falta ali; barreira e cobrador valem na próxima falta
const painel = criarPainel({
  config: CONFIG,
  versao: VERSAO,
  aoMudar: (chave) => {
    if (chave.startsWith('falta.')) {
      // A posição da falta só faz sentido no treino (se a troca não puder acontecer agora, ignora)
      if (estado.modo !== 'treino') {
        trocarModo('treino');
        if (estado.modo !== 'treino') return;
      }
      estado.fixa = true;
      ui.definirFixar(true);
      falta = { distancia: CONFIG.falta.distancia, angulo: CONFIG.falta.angulo };
      if (estado.fase === 'pronto') novaCobranca();
    } else if ((chave.startsWith('barreira.') || chave.startsWith('cobrador.') || chave.startsWith('camera.') || chave.startsWith('penalti.') || chave.startsWith('figurantes.')) && estado.fase === 'pronto') {
      const fixa = estado.fixa;
      estado.fixa = true;
      novaCobranca();
      estado.fixa = fixa;
    }
    if (chave === 'forcaIdeal') elementos.barraIdeal.style.left = `${CONFIG.forcaIdeal * 100}%`;
    if (chave.startsWith('camera.larguraVisivel') || chave.startsWith('camera.fovMin')) ajustarTela();
  },
});
elementos.barraIdeal.style.left = `${CONFIG.forcaIdeal * 100}%`;

// ---------- Eventos da física e resultado ----------

function processarEventos() {
  for (const ev of bola.eventos) {
    if (ev.tipo === 'fundo') {
      cenario.rede.estufar(ev.x, ev.y, ev.afundou);
      if (!jogada.somRede) {
        jogada.somRede = true;
        audio.rede(Math.min(1, 0.5 + Math.hypot(bola.vel.x, bola.vel.y, bola.vel.z) / 30));
      }
    } else if (ev.tipo === 'trave' || ev.tipo === 'travessao') {
      jogada.batida = ev.tipo;
      const forca = Math.min(1, (ev.impacto || 20) / 25);
      audio.trave(forca);
      cenario.trave(forca);
    } else if (ev.tipo === 'rede' && !bola.entrouNoGol) {
      if (!jogada.redeFora) audio.rede(0.4);
      jogada.redeFora = true;
    } else if (ev.tipo === 'barreira') {
      if (!jogada.barreira) audio.barreira(Math.min(1, (ev.impacto || 15) / 25));
      jogada.barreira = true;
    } else if (ev.tipo === 'jogador') {
      // Bateu num dos outros jogadores em campo (ev.time: 'ataque' = companheiro, 'defesa' = adversário)
      if (!jogada.jogador) audio.barreira(Math.min(1, (ev.impacto || 15) / 25));
      jogada.jogador = ev.time || 'defesa';
    } else if (ev.tipo === 'defesa') {
      if (!jogada.defesa || ev.modo === 'segurou') audio.defesa(Math.min(1, (ev.impacto || 15) / 30));
      if (jogada.defesa !== 'segurou') jogada.defesa = ev.modo || 'espalmou';
    } else if (ev.tipo === 'quique' && ev.impacto > 3 && jogada.quiques < 3) {
      jogada.quiques++;
      audio.quique(Math.min(1, ev.impacto / 12));
    }
  }
  bola.eventos.length = 0;
}

// A bola passou rasteira por baixo da barreira que pulou?
function verificarPorBaixo(anteriorZ) {
  if (!jogada.barreiraPulou || jogada.porBaixo || !barreira.jogadores.length) return;
  const zBarreira = barreira.jogadores[0].z;
  if (anteriorZ > zBarreira && bola.pos.z <= zBarreira && bola.pos.y < 0.45) {
    const noAr = barreira.jogadores.some((j) => j.yPes > bola.pos.y - CONFIG.raioBola && Math.abs(j.x - bola.pos.x) < 0.7);
    if (noAr) jogada.porBaixo = true;
  }
}

// Devolve o resultado assim que dá para saber; null enquanto a jogada está em aberto
function decidirResultado(acabou) {
  if (bola.gol) return 'gol';
  if (jogada.defesa === 'segurou') return 'defesa';
  if (bola.cruzamento && !bola.entrouNoGol) {
    if (jogada.defesa) return 'defesa';
    if (jogada.batida) return 'trave';
    return bola.cruzamento.y >= CONFIG.golAltura ? 'cima' : 'fora';
  }
  const voltando = bola.vel.z > 0.5;
  if (voltando && jogada.defesa) return 'defesa';
  if (voltando && jogada.batida) return 'trave';
  if (voltando && jogada.barreira) return 'barreira';
  if (voltando && jogada.jogador) return 'jogador';
  if (acabou) {
    if (jogada.defesa) return 'defesa';
    if (jogada.batida) return 'trave';
    if (jogada.barreira) return 'barreira';
    if (jogada.jogador) return 'jogador';
    return 'curta';
  }
  return null;
}

function quaseGol() {
  const c = bola.cruzamento;
  if (jogada.batida) return true;
  if (!c) return false;
  return Math.abs(c.x) - CONFIG.golLargura / 2 < 1.2 && c.y - CONFIG.golAltura < 0.8;
}

function mostrarResultado(resultado) {
  if (!replay) estado.cobrancas++;
  jogada.resultado = resultado;
  let titulo;
  let tipo = 'erro';
  const sub = [];
  if (resultado === 'gol') {
    if (!replay) {
      estado.gols++;
      estado.sequencia++;
    }
    tipo = 'gol';
    titulo = 'GOL!';
    const { x, y } = bola.cruzamento;
    const noAngulo = Math.abs(x) > CONFIG.golLargura / 2 - 0.9 && y > CONFIG.golAltura - 0.8;
    sub.push(`Golaço do ${cobrador.nome}!`);
    if (jogada.porBaixo) sub.push('Por baixo da barreira');
    else if (tiro && NOMES_TECNICA[tiro.tecnica]) sub.push(NOMES_TECNICA[tiro.tecnica]);
    if (noAngulo) sub.push('No ângulo');
    else if (jogada.batida) sub.push('Na trave e pra dentro');
    else if (jogada.defesa) sub.push('O goleiro ainda tocou');
    else if (jogada.jogador) sub.push('Desviou no caminho');
    if (estado.sequencia >= 2) sub.push(`${estado.sequencia} seguidos`);
    audio.torcidaGol();
    cenario.torcida.festa(1);
  } else {
    // Desafio do Dia: a sequência acabou (e volta para a primeira falta do dia)
    if (!replay && estado.modo === 'desafio' && estado.sequencia > 0) {
      const melhor = estado.sequencia >= desafio.melhorHoje ? ': a melhor de hoje' : '';
      sub.push(`Sequência de ${estado.sequencia}${melhor}`);
    }
    if (!replay) estado.sequencia = 0;
    if (resultado === 'defesa') {
      tipo = 'defesa';
      titulo = jogada.defesa === 'segurou' ? 'DEFENDEU!' : 'QUE DEFESA!';
      if (jogada.defesa !== 'segurou') sub.push('O goleiro espalmou');
    } else if (resultado === 'barreira') {
      tipo = 'defesa';
      titulo = 'NA BARREIRA!';
    } else if (resultado === 'jogador') {
      tipo = 'defesa';
      titulo = jogada.jogador === 'ataque' ? 'NO COMPANHEIRO!' : 'NA ZAGA!';
    } else if (resultado === 'trave') {
      titulo = jogada.batida === 'travessao' ? 'NO TRAVESSÃO!' : 'NA TRAVE!';
    } else if (resultado === 'cima') {
      titulo = 'POR CIMA';
    } else if (resultado === 'fora') {
      titulo = 'PRA FORA';
      if (jogada.redeFora) sub.push('Na rede, pelo lado de fora');
      else if (jogada.jogador) sub.push('Desviou num jogador');
    } else {
      titulo = 'NÃO CHEGOU';
    }
    if (quaseGol() || resultado === 'defesa') {
      audio.torcidaUhh();
      cenario.torcida.festa(0.35);
    }
  }
  if (goleiro.penalti) sub.push(descreverGoleiroPenalti(resultado));
  if (!replay) registrarSequencia(resultado);
  ui.mostrarResultado({ tipo, titulo, sub: sub.join(' · ') });
  ui.mostrarPlacar(placar());
  mostrarAcoes();
}

// O que o goleiro de pênalti fez (para o resultado na tela)
function descreverGoleiroPenalti(resultado) {
  const p = goleiro.penalti;
  const gol = resultado === 'gol';
  if (p.vai === 'fica') return gol ? 'O goleiro ficou no meio' : 'O goleiro ficou no meio e pegou';
  if (p.acertou) return gol ? 'O goleiro foi no canto certo e não alcançou' : 'O goleiro adivinhou o canto';
  return gol ? 'O goleiro foi no canto errado' : 'O goleiro foi no canto errado e ainda pegou';
}

// Depois de cada cobrança (fora do replay): recorde de sequência, Desafio do Dia (gol: próxima falta do
// dia; errou: volta para a primeira) e a memória do goleiro de pênalti
function registrarSequencia(resultado) {
  const modo = estado.modo;
  if (resultado === 'gol') {
    if (estado.sequencia > (recordes[modo] || 0)) {
      recordes[modo] = estado.sequencia;
      salvar('fkl-recordes', recordes);
    }
    if (modo === 'desafio') {
      desafio.indice++;
      if (estado.sequencia > desafio.melhorHoje) desafio.melhorHoje = estado.sequencia;
      salvarDesafio();
    }
  } else if (modo === 'desafio') {
    desafio.indice = 0;
    desafio.tentativas++;
    salvarDesafio();
  }
  if (modo === 'penalti' && bola.cruzamento && Math.abs(bola.cruzamento.x) > 0.5) {
    historicoPenaltis = [...historicoPenaltis, Math.sign(bola.cruzamento.x)].slice(-4);
  }
}

// ---------- Animação dos bonecos ----------

function animarCobrador(t) {
  if (!cobradorBoneco) return;
  if (estado.fase === 'pronto' || estado.fase === 'carregando') {
    animacao.parado(t);
  } else {
    // A animação recebe a bola (para o cobrador acompanhar com a cabeça) e, no fim, o resultado do lance
    const fim = estado.fase === 'fim';
    const r = animacao.atualizar(estado.tCobranca, {
      bola: bola.pos, resultado: fim ? jogada.resultado : null, tFim: fim ? estado.tFim : 0,
    });
    if (r.contato && estado.fase === 'corrida') {
      executarChute();
      simular(0); // anda já a sobra de tempo desde o contato: a bola aparece saindo do pé neste quadro
    }
    // Depois do chute: comemora o gol ou lamenta o erro (se a animação não cuidar disso sozinha: animacao.reage)
    if (!animacao.reage && fim && estado.tFim > 0.3 && r.etapa === 'fim') {
      const k = Math.min(1, (estado.tFim - 0.3) * 4);
      const reacao = jogada.resultado === 'gol' ? poseComemoracao(estado.tFim) : poseLamento(estado.tFim);
      cobradorBoneco.aplicarPose(misturarPoses(poseChute(1, cobrador.pe), reacao, k));
    }
  }
  const g = cobradorBoneco.grupo.position;
  sombraCobrador.atualizar({ x: g.x, z: g.z });
}

const infoDefesa = { fase: 'pronto', tempoDesdeChute: null, bola: null, resultado: null };
function animarAdversarios(t, dt) {
  infoDefesa.fase = estado.fase;
  infoDefesa.tempoDesdeChute = estado.fase === 'corrida' ? estado.tCobranca - animacao.tempoContato
    : (estado.fase === 'voo' || estado.fase === 'fim') ? estado.tempo : null;
  infoDefesa.bola = bola;
  infoDefesa.resultado = estado.fase === 'fim' ? jogada.resultado : null;
  animBarreira.atualizar(barreira, t, dt, infoDefesa);
  animGoleiro.atualizar(goleiro, t, dt, infoDefesa);
  animFigurantes.atualizar(figurantes, t, dt, infoDefesa);
  bonecosBarreira.forEach((b, i) => {
    const j = barreira.jogadores[i];
    b.sombra.atualizar({ x: j.x, z: j.z, altura: j.yPes || 0 });
  });
  const p = goleiro.pose;
  const centro = p.centro || p;
  sombraGoleiro.atualizar({ x: centro.x, z: p.z });
}

// ---------- Loop principal ----------

function atualizarBolaNaTela(dt) {
  bolaVisual.atualizar(bola, camera, dt);
  sombraDaBola.atualizar(bola.pos, CONFIG.raioBola);
}

const relogio = new THREE.Clock();
let tempoTotal = 0;
let escalaTempo = 1; // 1 = normal; menos = câmera lenta

// Câmera lenta: quando a bola está chegando no gol, o tempo desacelera por um instante
function querCameraLenta() {
  if (!CONFIG.camera.cameraLenta || estado.fase !== 'voo' || jogada.lentaUsada) return false;
  const { pos, vel } = bola;
  const chegando = vel.z < -8 && pos.z > 0 && pos.z < CONFIG.camera.cameraLentaDistancia;
  const naDirecao = Math.abs(pos.x) < CONFIG.golLargura / 2 + 0.6 && pos.y < CONFIG.golAltura + 0.6;
  return chegando && naDirecao;
}

// Qualidade automática: se o celular não aguenta 60 quadros por segundo, desenha com menos pixels
const qualidade = { amostras: 0, soma: 0, pixel: Math.min(window.devicePixelRatio, 2) };
function ajustarQualidade(dtReal) {
  if (MODO_TESTE) return;
  qualidade.soma += dtReal;
  qualidade.amostras++;
  if (qualidade.amostras < 90) return;
  const media = qualidade.soma / qualidade.amostras;
  qualidade.amostras = 0;
  qualidade.soma = 0;
  if (media > 1 / 45 && qualidade.pixel > 1) {
    qualidade.pixel = Math.max(1, qualidade.pixel - 0.25);
    renderer.setPixelRatio(qualidade.pixel);
    ajustarTela();
  } else if (media > 1 / 40 && qualidade.pixel <= 1 && !qualidade.sombrasSimples) {
    // Já está no mínimo de pixels e ainda não dá conta: as sombras passam para a versão mais barata
    qualidade.sombrasSimples = true;
    sombras.qualidade(0);
  }
}

// Física, barreira e goleiro em passos pequenos (a ordem importa)
// A física anda sempre em passos iguais (PASSO_FISICA), guardando a sobra para o próximo quadro:
// assim a cobrança dá o mesmo resultado em qualquer celular, e o replay repete exatamente o chute
let restoFisica = 0;
function simular(dt) {
  restoFisica += dt;
  const passos = Math.floor(restoFisica / PASSO_FISICA);
  restoFisica -= passos * PASSO_FISICA;
  const h = PASSO_FISICA;
  for (let i = 0; i < passos; i++) {
    estado.tempo += h;
    const anteriorZ = bola.pos.z;
    atualizarBarreira(barreira, estado.tempo);
    atualizarFigurantes(figurantes, estado.tempo);
    atualizarGoleiro(goleiro, bola, h, cfgDefesa, { chutou: true, tempoDesdeChute: estado.tempo, cfgFisica: CONFIG, aleatorio: sorteioChute });
    passo(bola, h, CONFIG);
    colidirBolaBarreira(bola, barreira, CONFIG);
    if (CONFIG.figurantes.colisao) colidirBolaFigurantes(bola, figurantes, CONFIG);
    colidirBolaGoleiro(bola, goleiro, cfgDefesa);
    verificarPorBaixo(anteriorZ);
  }
  processarEventos();
}

// Um quadro do jogo: dtReal segundos de relógio. desenhar = false só anda o tempo (os testes automáticos
// avançam vários quadros de uma vez sem esperar o desenho de cada um).
let testePausado = false;
function passoDoJogo(dtReal, desenhar = true) {
  window.tempoDeJogo += dtReal;
  ajustarQualidade(dtReal);

  // Câmera lenta: entra rápido, segura um instante e volta suave
  if (querCameraLenta()) {
    jogada.lentaUsada = true;
    jogada.lentaAte = tempoTotal + CONFIG.camera.cameraLentaDuracao;
  }
  const alvoEscala = jogada.lentaAte && tempoTotal < jogada.lentaAte ? CONFIG.camera.cameraLentaFator : 1;
  escalaTempo += (alvoEscala - escalaTempo) * Math.min(1, dtReal * (alvoEscala < escalaTempo ? 14 : 4));
  const dt = dtReal * escalaTempo;
  tempoTotal += dt;

  if (estado.fase === 'carregando') {
    estado.carga = Math.min(1, estado.carga + dt / CONFIG.tempoCarga);
    mostrarCarga(estado.carga);
    mostrarContato();
  }

  if (estado.fase === 'corrida' || estado.fase === 'voo' || estado.fase === 'fim') estado.tCobranca += dt;
  if (estado.fase === 'voo' || estado.fase === 'fim') {
    simular(dt);
    rastro.adicionar(bola.pos, dt);
  } else {
    atualizarBarreira(barreira, -1);
    atualizarFigurantes(figurantes, -1);
    // No pênalti o goleiro vê a corrida do cobrador: se firma e, se for o caso, parte antes do contato
    const tempoAteChute = goleiro.penalti && estado.fase === 'corrida' ? Math.max(0, animacao.tempoContato - estado.tCobranca) : undefined;
    atualizarGoleiro(goleiro, bola, dt, cfgDefesa, { chutou: false, tempoDesdeChute: -1, tempoAteChute, cfgFisica: CONFIG, aleatorio });
  }

  if (estado.fase === 'voo') {
    const parada = Math.hypot(bola.vel.x, bola.vel.y, bola.vel.z) < 0.3;
    const resultado = decidirResultado(parada || estado.tempo > CONFIG.tempoMaxVoo);
    if (resultado) {
      mostrarResultado(resultado);
      encerrarJogada(resultado === 'gol' ? CONFIG.esperaGol : CONFIG.esperaRecomeco);
    }
  } else if (estado.fase === 'fim') {
    estado.tFim += dt;
    estado.espera -= dt;
    if (estado.espera <= 0) (replay ? encerrarReplay() : novaCobranca());
  }

  if (estado.fase === 'pronto' || estado.fase === 'carregando') atualizarMira();
  animarCobrador(tempoTotal);
  animarAdversarios(tempoTotal, dt);
  atualizarBolaNaTela(dt);
  atualizarCamera(dt);
  sombras.atualizar(dt);
  cenario.rede.bola(bola.pos, CONFIG.raioBola * bolaMesh.scale.x); // a rede de pano envolve a bola desenhada
  cenario.atualizar(dt);
  audio.atualizar(dt);
  rastro.visivel = CONFIG.rastro;
  if (desenhar) renderer.render(scene, camera);
}

function quadro() {
  const dtReal = MODO_TESTE ? (testePausado ? 0 : 1 / 60) : Math.min(relogio.getDelta(), 0.05);
  passoDoJogo(dtReal);
  requestAnimationFrame(quadro);
}

// No modo teste, atalhos para os testes automáticos controlarem a cobrança com precisão
if (MODO_TESTE) {
  window.jogoTeste = {
    contato(x, y) {
      contato = { x, y };
      mostrarContato();
    },
    mirar(x) {
      mira.x = limitarMira(x);
    },
    falta(distancia, angulo) {
      estado.fixa = true;
      falta = { distancia, angulo };
      novaCobranca();
    },
    cobrador(numero) {
      escolherCobrador(ELENCO.find((j) => j.numero === numero));
    },
    chutar(forca) {
      if (estado.fase !== 'pronto') return;
      estado.fase = 'carregando';
      estado.carga = forca;
      soltarChute();
    },
    estado: () => ({ fase: estado.fase, falta, mira: mira.x, resultado: jogada.resultado, tecnica: tiro && tiro.tecnica, gols: estado.gols, cobrancas: estado.cobrancas }),
    video: () => videoGol && { tamanho: videoGol.blob.size, tipo: videoGol.blob.type, nome: videoGol.nome },
    videoBlob: () => videoGol && videoGol.blob,
    gravador: () => ({ disponivel: gravador.disponivel, formato: gravador.formato, gravando: gravador.gravando }),
    replay: (gravar) => iniciarReplay({ gravar }),
    emReplay: () => Boolean(replay),
    registro: () => registro && { ...registro, cobrador: registro.cobrador.numero },
    cruzamento: () => bola.cruzamento && { x: bola.cruzamento.x, y: bola.cruzamento.y },
    modo: (nome) => trocarModo(nome),
    // Tempo: pausar(true) congela o jogo (os quadros continuam desenhando); avancar(s) anda s segundos de
    // jogo de uma vez, em quadros de 1/60 s, sem desenhar (funciona pausado ou não)
    pausar: (sim = true) => {
      testePausado = Boolean(sim);
    },
    avancar: (segundos) => {
      const n = Math.max(0, Math.round(segundos * 60));
      for (let i = 0; i < n; i++) passoDoJogo(1 / 60, false);
      return window.tempoDeJogo;
    },
    // Avança quadro a quadro até a condição (função sem argumentos) valer, no máximo limite segundos
    avancarAte: (condicao, limite = 10) => {
      const n = Math.round(limite * 60);
      for (let i = 0; i < n && !condicao(); i++) passoDoJogo(1 / 60, false);
      return condicao();
    },
    // Câmera: camera({ pos: [x, y, z], olhar: [x, y, z], fov, seguir }) põe a câmera num ponto do campo;
    // com seguir: true, pos e olhar são relativos ao cobrador (x e z); camera(null) devolve a do jogo
    camera: (c) => {
      cameraTeste = c ? { pos: c.pos, olhar: c.olhar, fov: c.fov || 0, seguir: Boolean(c.seguir) } : null;
      if (!c) ajustarTela();
    },
    hud: (visivel) => {
      document.getElementById('hud').style.display = visivel ? '' : 'none';
    },
    tempos: () => ({
      fase: estado.fase, tCobranca: estado.tCobranca, tempoContato: animacao.tempoContato, duracao: animacao.duracao,
      tempoVoo: estado.tempo, tempoDeJogo: window.tempoDeJogo,
    }),
    desenho: () => ({ ...renderer.info.render, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures }),
    cobradorPos: () => cobradorBoneco && { x: cobradorBoneco.grupo.position.x, z: cobradorBoneco.grupo.position.z, giro: cobradorBoneco.grupo.rotation.y },
    bolaPos: () => ({ ...bola.pos }),
    figurantes: () => figurantes.jogadores.map((j) => ({ x: j.x, z: j.z, time: j.time })),
    desafio: () => ({ ...desafio, cobrador: desafio.cobrador && desafio.cobrador.numero }),
    goleiro: () => (goleiro.penalti ? { ...goleiro.penalti } : null),
    placar: () => placar(),
    recordes: () => ({ ...recordes }),
    historico: () => [...historicoPenaltis],
    nome: (n) => salvar('fkl-nome', n),
    ranking: () => ({ disponivel: ranking.disponivel, enviado: desafio.enviado, pode: podeEntrarNoRanking(), botao: !botoes.entrarRanking.hidden, aberto: ui.rankingAberto() }),
    abrirRanking: () => abrirRanking(),
    enviarRanking: (n) => enviarRanking(n),
    painelTrancado: () => document.getElementById('botao-ajustes').hidden,
    goleiroCfg: () => ({ ...cfgDefesa.goleiro }),
  };
}

// Abre no último modo usado (no modo teste, sempre no treino)
{
  const salvo = MODO_TESTE ? 'treino' : lerSalvo('fkl-modo', 'treino');
  estado.modo = MODOS.includes(salvo) ? salvo : 'treino';
  ui.definirModo(estado.modo);
  painel.bloquear(estado.modo === 'desafio');
}
novaCobranca();
requestAnimationFrame(quadro);
