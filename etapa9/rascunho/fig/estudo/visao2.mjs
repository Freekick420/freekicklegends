// Estudo: por que o posto 0 (dupla da pequena área, lado principal) não aparece em parte das faltas frontais
import { CONFIG } from '/home/user/fkl-fig/js/config.js';
import { ELENCO } from '/home/user/fkl-fig/js/elenco.js';
import { montarBarreira, PADRAO_BARREIRA } from '/home/user/fkl-fig/js/barreira.js';
import { criarGoleiro, PADRAO_GOLEIRO, PADRAO_PENALTI } from '/home/user/fkl-fig/js/goleiro.js';
import { montarFigurantes, cameraDeTras, PADRAO_FIGURANTES } from '/home/user/fkl-fig/js/figurantes.js';
import { inicioDoCobrador } from './camera.mjs';
const GRAUS = Math.PI / 180;
const cfg = { ...CONFIG, goleiro: { ...PADRAO_GOLEIRO }, penalti: { ...PADRAO_PENALTI }, barreira: { ...PADRAO_BARREIRA }, figurantes: { ...PADRAO_FIGURANTES } };
function sorteio(semente) {
  let a = Math.floor(semente * 4294967296) | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const sj = (s, n) => sorteio((s + n * 0.6180339887) % 1);
const r = sorteio(0.4321);
let n = 0;
const motivos = {};
for (let i = 0; i < 1500 && n < 400; i++) {
  const d = 18 + Math.round(r() * 15);
  const ang = Math.round((r() * 2 - 1) * 32);
  const jog = ELENCO[Math.floor(r() * ELENCO.length)];
  const sem = r();
  if (Math.abs(ang) >= 10) continue;
  n++;
  const B = { x: d * Math.sin(ang * GRAUS), z: d * Math.cos(ang * GRAUS) };
  const barreira = montarBarreira(B, cfg, sj(sem, 0));
  const goleiro = criarGoleiro(B, barreira, cfg);
  const inicio = inicioDoCobrador(B, jog);
  const f = montarFigurantes(B, barreira, cfg, sj(sem, 3), { cobrador: inicio, pe: jog.pe, goleiro: { x: goleiro.base.x, z: goleiro.z } });
  const cam = cameraDeTras(B, inicio);
  const j = f.jogadores[0];
  if (j.visto > 0.5) { motivos.visto = (motivos.visto || 0) + 1; continue; }
  const ret = cam.retangulo(j.x, j.z);
  let motivo = 'tapado';
  if (!ret) motivo = 'atrás';
  else if (ret.x0 < -0.95) motivo = 'fora pela esquerda';
  else if (ret.x1 > 0.95) motivo = 'fora pela direita';
  else if (ret.y0 < -0.5 || ret.y1 > 0.56) motivo = 'fora na vertical';
  else {
    const k = cam.retangulo(inicio.x, inicio.z, 1.9, 0.5);
    const w = Math.min(ret.x1, k.x1) - Math.max(ret.x0, k.x0);
    const h = Math.min(ret.y1, k.y1) - Math.max(ret.y0, k.y0);
    if (w > 0 && h > 0) motivo = `tapado pelo cobrador ${(100 * w * h / ((ret.x1 - ret.x0) * (ret.y1 - ret.y0))).toFixed(0)}%`.replace(/\d+%/, (m) => (parseInt(m) > 60 ? '>60%' : parseInt(m) > 30 ? '30-60%' : '<30%'));
    else motivo = 'tapado por outro (barreira/goleiro)';
  }
  motivos[motivo] = (motivos[motivo] || 0) + 1;
  if (n < 40 && motivo.startsWith('fora')) console.log(d, ang, jog.nomeCamisa, jog.pe, 'jog0', j.x.toFixed(1), j.z.toFixed(1), 'lado', j.lado, JSON.stringify(ret, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
}
console.log(n, motivos);
