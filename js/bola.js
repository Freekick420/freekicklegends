// Bola na tela: a malha, o desenho dos gomos, o tamanho à distância e o giro. A física da bola mora em
// js/physics.js; as sombras no gramado, em js/sombras.js.

import * as THREE from 'three';

const GIRO_VISUAL = 0.35;     // a bola gira mais devagar na tela do que na física, para o olho acompanhar
const GIRO_VISUAL_MAX = 40;   // rad/s: acima disso a bola parece girar para trás na tela

// Cores dos gomos (a luz dos refletores clareia; o preto não é preto puro para o brilho do couro aparecer)
const COR_BRANCO = '#f3f2ee';
const COR_PRETO = '#1b1b1d';
const COR_COSTURA_BRANCO = '#77756f'; // a costura escurece a beira do gomo branco
const COR_COSTURA_PRETO = '#040404';
const SUBDIVISOES = 2;        // pedaços por lado de gomo (a bola fica redonda com 2)
const ANEIS = [0.55, 0.87, 1]; // do meio do gomo (0) até a costura (1)
const SULCO = 0.012;          // quanto a costura afunda (fração do raio)
const ALMOFADA = 0.5;         // quanto o gomo "estufa": inclina a luz perto da costura (rad)

// A bola clássica de 32 gomos: 12 pentágonos pretos e 20 hexágonos brancos (um icosaedro com as pontas
// cortadas), cada gomo com a beira escurecida e a luz inclinada perto da costura, para parecer estufado.
// Sem textura: as cores e as costuras ficam nos vértices, nítidas de perto e de longe.
function geometriaBola(raio) {
  // Icosaedro: 12 vértices e os 20 trios de vizinhos (faces)
  const FI = (1 + Math.sqrt(5)) / 2;
  const pontas = [];
  for (const a of [-1, 1]) {
    for (const b of [-FI, FI]) {
      pontas.push(new THREE.Vector3(0, a, b), new THREE.Vector3(a, b, 0), new THREE.Vector3(b, 0, a));
    }
  }
  const vizinhos = (i, j) => Math.abs(pontas[i].distanceTo(pontas[j]) - 2) < 1e-6;
  // Ponto a um terço do caminho de uma ponta para a vizinha (os cantos dos gomos), na esfera
  const canto = (i, j) => pontas[i].clone().lerp(pontas[j], 1 / 3).normalize();

  const gomos = []; // { cantos: [Vector3...] em volta, preto }
  for (let i = 0; i < 12; i++) {
    // Pentágono em volta da ponta i: os cantos nas 5 arestas dela, em ordem (pelo ângulo em volta da ponta)
    const eixo = pontas[i].clone().normalize();
    const u = new THREE.Vector3(1, 0, 0).cross(eixo);
    if (u.lengthSq() < 0.1) u.set(0, 1, 0).cross(eixo);
    u.normalize();
    const w = eixo.clone().cross(u);
    const cantos = [];
    for (let j = 0; j < 12; j++) if (vizinhos(i, j)) cantos.push(canto(i, j));
    cantos.sort((p, q) => Math.atan2(p.dot(w), p.dot(u)) - Math.atan2(q.dot(w), q.dot(u)));
    gomos.push({ cantos, preto: true });
  }
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      for (let k = j + 1; k < 12; k++) {
        if (!vizinhos(i, j) || !vizinhos(j, k) || !vizinhos(i, k)) continue;
        // Hexágono no lugar da face (i, j, k): dois cantos em cada aresta, dando a volta para fora
        let [a, b, c] = [i, j, k];
        const fora = pontas[a].clone().add(pontas[b]).add(pontas[c]);
        const normal = pontas[b].clone().sub(pontas[a]).cross(pontas[c].clone().sub(pontas[a]));
        if (normal.dot(fora) < 0) [b, c] = [c, b];
        gomos.push({ cantos: [canto(a, b), canto(b, a), canto(b, c), canto(c, b), canto(c, a), canto(a, c)], preto: false });
      }
    }
  }

  const posicoes = [];
  const normais = [];
  const cores = [];
  const indices = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const paraFora = new THREE.Vector3();
  for (const gomo of gomos) {
    const centro = new THREE.Vector3();
    for (const c of gomo.cantos) centro.add(c);
    centro.normalize();
    // Pentágonos e hexágonos podem ter saído em sentidos diferentes: a face tem de olhar para fora
    const lados = gomo.cantos.length;
    const giro = gomo.cantos[0].clone().sub(centro).cross(gomo.cantos[1].clone().sub(centro)).dot(centro) > 0;
    const cantos = giro ? gomo.cantos : [...gomo.cantos].reverse();
    const corGomo = new THREE.Color(gomo.preto ? COR_PRETO : COR_BRANCO);
    const corCostura = new THREE.Color(gomo.preto ? COR_COSTURA_PRETO : COR_COSTURA_BRANCO);
    const porAnel = lados * SUBDIVISOES;
    const inicio = posicoes.length / 3;
    const vertice = (ponto, t) => {
      // t: 0 no meio do gomo, 1 na costura. A beira afunda um pouco e a luz inclina para fora do gomo.
      const beira = Math.max(0, (t - ANEIS[0]) / (1 - ANEIS[0]));
      p.copy(ponto).normalize();
      paraFora.copy(p).sub(centro);
      paraFora.addScaledVector(p, -paraFora.dot(p));
      if (paraFora.lengthSq() > 1e-10) paraFora.normalize();
      n.copy(p).addScaledVector(paraFora, Math.tan(ALMOFADA * beira * beira)).normalize();
      const r = raio * (1 - SULCO * beira * beira * beira);
      posicoes.push(p.x * r, p.y * r, p.z * r);
      normais.push(n.x, n.y, n.z);
      const corVertice = t >= 1 ? corCostura : corGomo; // só o último anel (a costura) é escuro
      cores.push(corVertice.r, corVertice.g, corVertice.b);
    };
    vertice(centro, 0);
    for (const t of ANEIS) {
      for (let l = 0; l < lados; l++) {
        for (let s = 0; s < SUBDIVISOES; s++) {
          const borda = cantos[l].clone().lerp(cantos[(l + 1) % lados], s / SUBDIVISOES).normalize();
          vertice(centro.clone().lerp(borda, t), t);
        }
      }
    }
    for (let i = 0; i < porAnel; i++) {
      const j = (i + 1) % porAnel;
      indices.push(inicio, inicio + 1 + i, inicio + 1 + j);
      for (let a = 0; a < ANEIS.length - 1; a++) {
        const dentro = inicio + 1 + a * porAnel;
        const fora = dentro + porAnel;
        indices.push(dentro + i, fora + i, fora + j, dentro + i, fora + j, dentro + j);
      }
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3));
  geometria.setAttribute('normal', new THREE.Float32BufferAttribute(normais, 3));
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  geometria.setIndex(indices);
  geometria.computeBoundingSphere();
  return geometria;
}

// Cria a bola na cena. CONFIG: raioBola, medidas do gol e CONFIG.camera (bolaVisivelAte, bolaAumentoMax).
// Devolve:
//   malha                      a THREE.Mesh da bola (malha.scale.x = quanto ela está aumentada na tela)
//   reiniciar()                nova cobrança: zera o giro da bola desenhada
//   atualizar(bola, camera, dt) põe a malha onde a bola da física está (bola.pos, bola.giro), com o aumento
//                              à distância e o giro na tela
export function criarBolaVisual(scene, CONFIG) {
  const malha = new THREE.Mesh(
    geometriaBola(CONFIG.raioBola),
    // Couro com um brilho leve: cada refletor deixa um reflexo macio na bola
    new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 34, specular: 0x4c4c4c }),
  );
  malha.name = 'bola';
  scene.add(malha);
  const eixoGiro = new THREE.Vector3();
  const giroVisual = new THREE.Quaternion();
  // A bola parada mostra sempre a mesma face (um gomo preto um pouco para o lado, não bem de frente)
  const POSE_INICIAL = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0.3, 0.1));

  function reiniciar() {
    malha.quaternion.copy(POSE_INICIAL);
  }
  reiniciar();

  function atualizar(bola, camera, dt) {
    const { pos, giro } = bola;
    malha.position.set(pos.x, pos.y, pos.z);
    // Longe da câmera (na aérea) a bola fica um pouco maior na tela, para o olho não perder.
    // Perto do gol ela volta ao tamanho de verdade, para não "furar" traves e rede.
    const longe = camera.position.distanceTo(malha.position) / CONFIG.camera.bolaVisivelAte;
    let escala = Math.min(CONFIG.camera.bolaAumentoMax, Math.max(1, longe));
    const meiaGol = CONFIG.golLargura / 2;
    const foraDoGol = Math.hypot(
      Math.max(0, Math.abs(pos.x) - meiaGol),
      Math.max(0, pos.y - CONFIG.golAltura),
      Math.max(0, pos.z, -CONFIG.golProfundidade - pos.z)
    );
    escala = 1 + (escala - 1) * Math.min(1, Math.max(0, (foraDoGol - 1) / 3));
    malha.scale.setScalar(escala);

    // Gira a bola na tela com o giro da física (mais devagar, para o olho acompanhar)
    eixoGiro.set(giro.x, giro.y, giro.z).multiplyScalar(GIRO_VISUAL);
    if (eixoGiro.length() > GIRO_VISUAL_MAX) eixoGiro.setLength(GIRO_VISUAL_MAX);
    const angulo = eixoGiro.length() * dt;
    if (angulo > 1e-5) {
      giroVisual.setFromAxisAngle(eixoGiro.normalize(), angulo);
      malha.quaternion.premultiply(giroVisual);
    }
  }

  return { malha, reiniciar, atualizar };
}
