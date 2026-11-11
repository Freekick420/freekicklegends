// Estudo 3: C por faixa de força, com folga constante de 0,15 m: dev(u) <= C*4u(1-u) + 0,15
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
const FORCAS = [0.3, 0.35, 0.45, 0.6, 0.8, 1];
for (const dist of [18, 22, 26, 30, 33]) {
  for (const ang of [0, 32]) {
    const B = { x: dist * Math.sin(ang * GRAUS), z: dist * Math.cos(ang * GRAUS) };
    const pior = Object.fromEntries(FORCAS.map((f) => [f, { C: 0, dev: 0, u: 0, t: 0 }]));
    for (const jog of ELENCO) {
      for (const cx of [-0.95, -0.7, -0.4, 0.4, 0.7, 0.95]) {
        for (const cy of [-0.8, -0.4, 0, 0.3, 0.5]) {
          for (const forca of FORCAS) {
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
              const P = { x: r1.cruz.x, z: 0 };
              const dx = P.x - B.x;
              const dz = P.z - B.z;
              const L = Math.hypot(dx, dz);
              const ladoDentro = Math.sign((0 - B.x) * dz - (0 - B.z) * dx) || 1;
              const reg = pior[forca];
              for (const p of r1.caminho) {
                if (p.y > 2.2) continue;
                const u = ((p.x - B.x) * dx + (p.z - B.z) * dz) / (L * L);
                if (u <= 0.005 || u >= 0.995) continue;
                const d = ((p.x - B.x) * dz - (p.z - B.z) * dx) / L;
                const fora = Math.sign(d) !== ladoDentro ? Math.abs(d) : 0;
                const C = Math.max(0, fora - 0.15) / (4 * u * (1 - u));
                if (C > reg.C) { reg.C = C; reg.u = u; reg.t = r1.t; reg.quem = `${jog.nomeCamisa} cx${cx} cy${cy}`; }
                if (fora > reg.dev) reg.dev = fora;
              }
            }
          }
        }
      }
    }
    const Lfar = Math.hypot(Math.abs(B.x) + MEIA, B.z);
    console.log(`dist ${dist} ang ${ang} Lfar ${Lfar.toFixed(1)}: ` + FORCAS.map((f) => `f${f}: C=${pior[f].C.toFixed(2)}(u${pior[f].u.toFixed(2)},t${pior[f].t.toFixed(1)}) dev=${pior[f].dev.toFixed(2)}`).join(' | '));
  }
}
