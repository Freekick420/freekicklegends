// Bola na tela: a malha, a textura, o tamanho à distância e o giro. A física da bola mora em js/physics.js;
// as sombras no gramado, em js/sombras.js.

import * as THREE from 'three';

const GIRO_VISUAL = 0.35;     // a bola gira mais devagar na tela do que na física, para o olho acompanhar
const GIRO_VISUAL_MAX = 40;   // rad/s: acima disso a bola parece girar para trás na tela

// Desenha uma bola clássica: branca com 12 manchas pretas (nos vértices de um icosaedro)
function texturaBola() {
  const W = 256;
  const H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const imagem = ctx.createImageData(W, H);
  const vertices = new THREE.IcosahedronGeometry(1, 0).attributes.position;
  const manchas = [];
  for (let i = 0; i < vertices.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(vertices, i).normalize();
    if (!manchas.some((m) => m.distanceTo(v) < 0.01)) manchas.push(v);
  }
  const dir = new THREE.Vector3();
  for (let y = 0; y < H; y++) {
    const theta = (y / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const phi = (x / W) * Math.PI * 2;
      dir.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
      const preto = manchas.some((m) => m.dot(dir) > 0.93);
      const i = (y * W + x) * 4;
      const cor = preto ? 30 : 245;
      imagem.data[i] = imagem.data[i + 1] = imagem.data[i + 2] = cor;
      imagem.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imagem, 0, 0);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// Cria a bola na cena. CONFIG: raioBola, medidas do gol e CONFIG.camera (bolaVisivelAte, bolaAumentoMax).
// Devolve:
//   malha                      a THREE.Mesh da bola (malha.scale.x = quanto ela está aumentada na tela)
//   reiniciar()                nova cobrança: zera o giro da bola desenhada
//   atualizar(bola, camera, dt) põe a malha onde a bola da física está (bola.pos, bola.giro), com o aumento
//                              à distância e o giro na tela
export function criarBolaVisual(scene, CONFIG) {
  const malha = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.raioBola, 32, 16),
    new THREE.MeshLambertMaterial({ map: texturaBola() })
  );
  scene.add(malha);
  const eixoGiro = new THREE.Vector3();
  const giroVisual = new THREE.Quaternion();

  function reiniciar() {
    malha.quaternion.identity();
  }

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
