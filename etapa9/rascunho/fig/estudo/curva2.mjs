// Estudo 2: desvio máximo da trajetória de um chute bom em relação à corda bola → ponto de chegada
// (trave por dentro), como C tal que desvio <= C * 4u(1-u). Só conta a bola abaixo de 2,2 m.
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
  for (let t = 0; t < 5; t += H) {
    const antes = { ...bola.pos };
    passo(bola, H, CONFIG);
    caminho.push({ x: bola.pos.x, y: bola.pos.y, z: bola.pos.z });
    if (bola.pos.z <= 0) {
      const f = antes.z / (antes.z - bola.pos.z);
      return { cruz: { x: antes.x + (bola.pos.x - antes.x) * f, y: antes.y + (bola.pos.y - antes.y) * f }, caminho, t };
    }
    if (bola.vel.z > 0 || Math.hypot(bola.vel.x, bola.vel.z) < 0.5) return { cruz: null, caminho };
  }
  return { cruz: null, caminho };
}

for (const dist of [18, 20, 22, 24, 26, 28, 30, 33]) {
  for (const ang of [0, 16, 32]) {
    const B = { x: dist * Math.sin(ang * GRAUS), z: dist * Math.cos(ang * GRAUS) };
    let piorC = 0;
    let piorDev = 0;
    let info = null;
    let n = 0;
    for (const jog of ELENCO) {
      for (const cx of [-0.95, -0.8, -0.6, -0.4, 0.4, 0.6, 0.8, 0.95]) {
        for (const cy of [-0.8, -0.4, 0, 0.3, 0.5]) {
          for (const forca of [0.2, 0.3, 0.45, 0.6, 0.8, 1]) {
            for (const xFinal of [-(MEIA - 0.12), MEIA - 0.12]) {
              let a0 = xFinal;
              let r0 = voar(B, a0, forca, { x: cx, y: cy }, jog);
              if (!r0.cruz) continue;
              let a1 = a0 + (xFinal - r0.cruz.x);
              let r1 = null;
              for (let i = 0; i < 14; i++) {
                r1 = voar(B, a1, forca, { x: cx, y: cy }, jog);
                if (!r1.cruz) break;
                const e1 = r1.cruz.x - xFinal;
                if (Math.abs(e1) < 0.02) break;
                const e0 = r0.cruz.x - xFinal;
                const prox = Math.abs(e1 - e0) < 1e-6 ? a1 - e1 : a1 - e1 * (a1 - a0) / (e1 - e0);
                a0 = a1; r0 = r1; a1 = prox;
              }
              if (!r1 || !r1.cruz || Math.abs(r1.cruz.x - xFinal) > 0.1) continue;
              if (r1.cruz.y > CONFIG.golAltura) continue;
              n++;
              const P = { x: r1.cruz.x, z: 0 };
              const dx = P.x - B.x;
              const dz = P.z - B.z;
              const L = Math.hypot(dx, dz);
              const centro = { x: 0, z: 0 };
              const ladoDentro = Math.sign((centro.x - B.x) * dz - (centro.z - B.z) * dx) || 1;
              for (const p of r1.caminho) {
                if (p.y > 2.2) continue;
                const u = ((p.x - B.x) * dx + (p.z - B.z) * dz) / (L * L);
                if (u < 0.04 || u > 0.96) continue;
                const d = ((p.x - B.x) * dz - (p.z - B.z) * dx) / L;
                const foraDaCorda = Math.sign(d) !== ladoDentro ? Math.abs(d) : 0; // para fora do gol
                const C = foraDaCorda / (4 * u * (1 - u));
                if (foraDaCorda > piorDev) piorDev = foraDaCorda;
                if (C > piorC) {
                  piorC = C;
                  info = { jog: jog.nomeCamisa || jog.apelido, cx, cy, forca, xFinal: +xFinal.toFixed(2), u: +u.toFixed(2), y: +p.y.toFixed(2), L: +L.toFixed(1), t: +r1.t.toFixed(2) };
                }
              }
            }
          }
        }
      }
    }
    const Lfar = Math.hypot(Math.abs(B.x) + MEIA, B.z);
    console.log(`dist ${dist} ang ${ang}: n=${n} Lfar=${Lfar.toFixed(1)} C=${piorC.toFixed(2)} dev=${piorDev.toFixed(2)} C/L3=${(piorC / Lfar ** 3 * 1e5).toFixed(2)}e-5 C/L2=${(piorC / Lfar ** 2 * 1e3).toFixed(2)}e-3 ${JSON.stringify(info)}`);
  }
}
