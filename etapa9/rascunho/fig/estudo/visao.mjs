// Estudo: quantos figurantes aparecem na câmera de trás (celular), por tipo de falta
import { CONFIG } from '/home/user/fkl-fig/js/config.js';
import { ELENCO } from '/home/user/fkl-fig/js/elenco.js';
import { montarBarreira, PADRAO_BARREIRA } from '/home/user/fkl-fig/js/barreira.js';
import { criarGoleiro, PADRAO_GOLEIRO, PADRAO_PENALTI } from '/home/user/fkl-fig/js/goleiro.js';
import { montarFigurantes, PADRAO_FIGURANTES } from '/home/user/fkl-fig/js/figurantes.js';
import { inicioDoCobrador } from './camera.mjs';
const GRAUS = Math.PI / 180;
const cfg = { ...CONFIG, goleiro: { ...PADRAO_GOLEIRO }, penalti: { ...PADRAO_PENALTI }, barreira: { ...PADRAO_BARREIRA }, figurantes: { ...PADRAO_FIGURANTES } };
function sorteio(semente) {
  let a = Math.floor(semente * 4294967296) | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const sj = (s, n) => sorteio((s + n * 0.6180339887) % 1);
const r = sorteio(0.4321);
const grupos = {};
const porPapel = {};
for (let i = 0; i < 1500; i++) {
  const d = 18 + Math.round(r() * 15);
  const ang = Math.round((r() * 2 - 1) * 32);
  const jog = ELENCO[Math.floor(r() * ELENCO.length)];
  const sem = r();
  const B = { x: d * Math.sin(ang * GRAUS), z: d * Math.cos(ang * GRAUS) };
  const barreira = montarBarreira(B, cfg, sj(sem, 0));
  const goleiro = criarGoleiro(B, barreira, cfg);
  const inicio = inicioDoCobrador(B, jog);
  const f = montarFigurantes(B, barreira, cfg, sj(sem, 3), { cobrador: inicio, pe: jog.pe, goleiro: { x: goleiro.base.x, z: goleiro.z } });
  const vistos = f.jogadores.filter((j) => j.visto > 0.5).length;
  const ladoCam = jog.pe === 'D' ? -1 : 1;
  const tipo = Math.abs(ang) < 10 ? 'frontal' : (B.x > 0 ? -1 : 1) === ladoCam ? 'lateral, câmera no lado de longe' : 'lateral, câmera no lado de perto';
  const g = grupos[tipo] || (grupos[tipo] = { n: 0, soma: 0, min: 99, hist: {} });
  g.n++; g.soma += vistos; g.min = Math.min(g.min, vistos); g.hist[vistos] = (g.hist[vistos] || 0) + 1;
  f.jogadores.forEach((j, k) => { const p = porPapel[k + j.papel] || (porPapel[k + j.papel] = { n: 0, v: 0 }); p.n++; if (j.visto > 0.5) p.v++; });
}
for (const [t, g] of Object.entries(grupos)) console.log(t, 'n', g.n, 'média', (g.soma / g.n).toFixed(2), 'mín', g.min, JSON.stringify(g.hist));
console.log(Object.entries(porPapel).map(([k, p]) => `${k}:${(100 * p.v / p.n).toFixed(0)}%(${p.n})`).join(' '));
