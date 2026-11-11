// Estudo: quanto a trajetória de um chute BOM (que cruza a linha entre as traves) sai para fora do
// triângulo bola → traves (com 1 m de folga para fora de cada trave), em função da distância e do ponto do caminho.
import { CONFIG } from '/home/user/fkl-fig/js/config.js';
import { criarBola, chutar, passo } from '/home/user/fkl-fig/js/physics.js';
import { ELENCO } from '/home/user/fkl-fig/js/elenco.js';

const GRAUS = Math.PI / 180;
const H = 1 / 240;
const MEIA = CONFIG.golLargura / 2;

function voar(bolaIni, alvoX, forca, contato, cobrador) {
  const bola = criarBola({ x: bolaIni.x, y: CONFIG.raioBola, z: bolaIni.z });
  chutar(bola, { alvo: { x: alvoX, z: 0 }, forca, contato, cobrador }, CONFIG, () => 0.5);
  const caminho = [];
  for (let t = 0; t < 4; t += H) {
    const antes = { ...bola.pos };
    passo(bola, H, CONFIG);
    caminho.push({ x: bola.pos.x, y: bola.pos.y, z: bola.pos.z });
    if (bola.pos.z <= 0) {
      const f = antes.z / (antes.z - bola.pos.z);
      return { cruz: { x: antes.x + (bola.pos.x - antes.x) * f, y: antes.y + (bola.pos.y - antes.y) * f }, caminho };
    }
    if (bola.vel.z > 0 || Math.hypot(bola.vel.x, bola.vel.z) < 0.5) return { cruz: null, caminho };
  }
  return { cruz: null, caminho };
}

// distância com sinal de p à reta a → b (positiva = à esquerda de quem vai de a para b)
function fora(p, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const L = Math.hypot(dx, dz);
  const u = ((p.x - a.x) * dx + (p.z - a.z) * dz) / (L * L);
  const d = ((p.x - a.x) * dz - (p.z - a.z) * dx) / L; // > 0: à direita de a→b olhando de cima com z para baixo...
  return { u, d };
}

const resumo = [];
for (const dist of [18, 20, 22, 24, 26, 28, 30, 33]) {
  for (const ang of [0, 15, 30]) {
    const B = { x: dist * Math.sin(ang * GRAUS), z: dist * Math.cos(ang * GRAUS) };
    const PL = { x: -MEIA - 1, z: 0 };
    const PR = { x: MEIA + 1, z: 0 };
    let pior = 0;
    let piorInfo = null;
    const porU = new Array(11).fill(0);
    for (const jog of ELENCO) {
      for (const cx of [-0.95, -0.7, -0.4, 0, 0.4, 0.7, 0.95]) {
        for (const cy of [-0.5, 0, 0.3]) {
          for (const forca of [0.45, 0.6, 0.8, 1]) {
            for (const xFinal of [-(MEIA - 0.15), MEIA - 0.15]) {
              // acha a mira que leva a bola a xFinal (secante)
              let a0 = xFinal;
              let r0 = voar(B, a0, forca, { x: cx, y: cy }, jog);
              if (!r0.cruz) continue;
              let a1 = a0 + (xFinal - r0.cruz.x);
              let r1 = null;
              for (let i = 0; i < 12; i++) {
                r1 = voar(B, a1, forca, { x: cx, y: cy }, jog);
                if (!r1.cruz) break;
                const e1 = r1.cruz.x - xFinal;
                if (Math.abs(e1) < 0.02) break;
                const e0 = r0.cruz.x - xFinal;
                const prox = Math.abs(e1 - e0) < 1e-6 ? a1 - e1 : a1 - e1 * (a1 - a0) / (e1 - e0);
                a0 = a1; r0 = r1; a1 = prox;
              }
              if (!r1 || !r1.cruz || Math.abs(r1.cruz.x - xFinal) > 0.1) continue;
              if (r1.cruz.y > CONFIG.golAltura) continue; // por cima: não é chute bom
              // só a parte do caminho em que a bola está à altura de um jogador (y < 2,2 m)
              for (const p of r1.caminho) {
                if (p.y > 2.2) continue;
                // fora pela esquerda (aresta B → PL) ou pela direita (B → PR)
                const e = fora(p, B, PL);
                const d = fora(p, B, PR);
                // triângulo: entre as duas arestas. À esquerda de B→PL: e.d com um sinal; teste com ponto interno
                const dentroE = fora({ x: 0, z: 0 }, B, PL).d;
                const dentroD = fora({ x: 0, z: 0 }, B, PR).d;
                const foraE = Math.sign(dentroE) !== Math.sign(e.d) ? Math.abs(e.d) : 0;
                const foraD = Math.sign(dentroD) !== Math.sign(d.d) ? Math.abs(d.d) : 0;
                const f = Math.max(foraE, foraD);
                const u = foraE > foraD ? e.u : d.u;
                const k = Math.max(0, Math.min(10, Math.round(u * 10)));
                if (f > porU[k]) porU[k] = f;
                if (f > pior) {
                  pior = f;
                  piorInfo = { jog: jog.nomeCamisa || jog.apelido, cx, cy, forca, xFinal, u: +u.toFixed(2), y: +p.y.toFixed(2), mira: +a1.toFixed(1) };
                }
              }
            }
          }
        }
      }
    }
    resumo.push({ dist, ang, pior: +pior.toFixed(2), porU: porU.map((v) => +v.toFixed(2)), piorInfo });
    console.log(`dist ${dist} ang ${ang}: pior ${pior.toFixed(2)} m  porU ${porU.map((v) => v.toFixed(1)).join(' ')}  ${JSON.stringify(piorInfo)}`);
  }
}
