// Estudo: monta os figurantes de algumas faltas e grava um JSON para o mapa (mapa.py desenha)
import { writeFileSync } from 'node:fs';
import { CONFIG } from '/home/user/fkl-fig/js/config.js';
import { ELENCO } from '/home/user/fkl-fig/js/elenco.js';
import { montarBarreira, semBarreira, PADRAO_BARREIRA } from '/home/user/fkl-fig/js/barreira.js';
import { criarGoleiro, PADRAO_GOLEIRO, PADRAO_PENALTI } from '/home/user/fkl-fig/js/goleiro.js';
import { montarFigurantes, atualizarFigurantes, corredorDoChute, cameraDeTras, PADRAO_FIGURANTES } from '/home/user/fkl-fig/js/figurantes.js';
import { inicioDoCobrador } from './camera.mjs';

const GRAUS = Math.PI / 180;
const cfg = { ...CONFIG, goleiro: { ...PADRAO_GOLEIRO }, penalti: { ...PADRAO_PENALTI, ...CONFIG.penalti }, barreira: { ...PADRAO_BARREIRA }, figurantes: { ...PADRAO_FIGURANTES } };
function sorteio(semente) {
  let a = Math.floor(semente * 4294967296) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sorteioDaJogada = (s, n) => sorteio((s + n * 0.6180339887) % 1);

const casos = JSON.parse(process.argv[2] || '[[22,0,8,0.11],[22,12,8,0.21],[20,-28,8,0.31],[20,28,8,0.41],[30,0,10,0.51],[18,0,7,0.61],[26,-15,10,0.71],[33,20,5,0.81],["p",0,2,0.91]]');
const quantidade = Number(process.argv[3] || 10);
const saida = [];
for (const [d, ang, num, sem] of casos) {
  const penalti = d === 'p';
  const B = penalti ? { x: 0, z: 11 } : { x: d * Math.sin(ang * GRAUS), z: d * Math.cos(ang * GRAUS) };
  const jog = ELENCO.find((j) => j.numero === num);
  const barreira = penalti ? semBarreira(B) : montarBarreira(B, cfg, sorteioDaJogada(sem, 0));
  const goleiro = penalti
    ? criarGoleiro(B, null, cfg, { penalti: { historico: [], aleatorio: sorteioDaJogada(sem, 2) } })
    : criarGoleiro(B, barreira, cfg);
  const inicio = inicioDoCobrador(B, jog);
  const c2 = { ...cfg, figurantes: { ...cfg.figurantes, quantidade } };
  const t0 = performance.now();
  const f = montarFigurantes(B, barreira, c2, sorteioDaJogada(sem, 3), { penalti, cobrador: inicio, pe: jog.pe, goleiro: { x: goleiro.base.x, z: goleiro.z } });
  const ms = performance.now() - t0;
  const cam = cameraDeTras(B, inicio, cfg.golLargura, cfg.golAltura);
  const corr = corredorDoChute(B, cfg);
  // borda do corredor (amostrada)
  const borda = [];
  for (let z = 0.2; z < B.z; z += 0.4) {
    const ox = (B.x * z) / B.z;
    borda.push([ox - corr.borda(ox, z, -1, 0, 0), z], [ox + corr.borda(ox, z, 1, 0, 0), z]);
  }
  // tela do celular: retângulos
  const tela = [];
  tela.push({ tipo: 'cobrador', ...cam.silhueta(inicio.x, inicio.z, 1.85, 0.4) });
  for (const j of barreira.jogadores) tela.push({ tipo: 'barreira', ...cam.silhueta(j.x, j.z, j.altura, 0.28) });
  tela.push({ tipo: 'goleiro', ...cam.silhueta(goleiro.base.x, goleiro.z, 1.9, 0.35) });
  f.jogadores.forEach((j, i) => { const r = cam.silhueta(j.x, j.z, j.altura, 0.28); if (r) tela.push({ tipo: j.time, i, ...r }); });
  const gol = [cam.projetar(-3.66, 0, 0), cam.projetar(3.66, 0, 0), cam.projetar(3.66, 2.44, 0), cam.projetar(-3.66, 2.44, 0)];
  const bolaTela = cam.projetar(B.x, 0.11, B.z);
  saida.push({
    titulo: penalti ? `pênalti · ${jog.nomeCamisa} (${jog.pe})` : `${d} m ${ang}° · ${jog.nomeCamisa} (${jog.pe})`,
    B, inicio, barreira: barreira.jogadores.map((j) => ({ x: j.x, z: j.z })), goleiro: { x: goleiro.base.x, z: goleiro.z },
    jogadores: f.jogadores.map((j) => ({ x: j.x, z: j.z, time: j.time, papel: j.papel, par: j.par, rot: j.rotacaoY, plano: j.plano, visto: j.visto, numero: j.numero, altura: j.altura })),
    borda, camera: cam.pos, tela, gol, bolaTela, ms,
  });
  console.log(`${saida[saida.length - 1].titulo}: ${f.jogadores.length} figurantes em ${ms.toFixed(2)} ms · vistos ${f.jogadores.filter((j) => j.visto > 0.5).length} · ` + f.jogadores.map((j, i) => `${i}${j.time[0]}:${j.papel}(${j.x.toFixed(1)},${j.z.toFixed(1)})${j.visto > 0.5 ? '*' : ''}${j.plano ? '→' : ''}`).join(' '));
}
writeFileSync(process.argv[4] || '/tmp/claude-0/-home-user/92f63482-318d-57a2-ba81-43ab7e6086d3/scratchpad/fig/estudo/mapa.json', JSON.stringify(saida));
