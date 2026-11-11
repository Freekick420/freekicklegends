#!/usr/bin/env node
// Gera uma sequência de capturas do chute (quadro a quadro) e monta uma folha de contato.
// uso: node seq.mjs nome=juninho-dir lenda=8 vista=dir [dist=22 ang=0 mira=1.5 cx=0.4 cy=0.1 forca=0.8]
//        [de=-0.35 ate=0.35 passo=0.05] [modo=chute|corrida|fim] [largura=640 altura=480] [colunas=5] [fov=30] [seguir=0]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const RASC = '/tmp/claude-0/-home-user/92f63482-318d-57a2-ba81-43ab7e6086d3/scratchpad';
const HARNESS = `${RASC}/harness`;
const a = Object.fromEntries(process.argv.slice(2).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
const num = (k, d) => (k in a ? Number(a[k]) : d);
const nome = a.nome || 'seq';
const lenda = num('lenda', 8);
const vista = a.vista || 'dir';
const dist = num('dist', 22), ang = num('ang', 0), mira = num('mira', 1.5), cx = num('cx', 0.4), cy = num('cy', 0.1), forca = num('forca', 0.8);
const de = num('de', -0.35), ate = num('ate', 0.35), passo = num('passo', 0.05);
const modo = a.modo || 'chute';
const largura = num('largura', 640), altura = num('altura', 480), colunas = num('colunas', 5), fov = num('fov', 30);
const resultado = a.resultado || '';
const saida = `${RASC}/anim/cap/${nome}`;
mkdirSync(saida, { recursive: true });

const G = Math.PI / 180;
const B = { x: dist * Math.sin(ang * G), z: dist * Math.cos(ang * G) };
const dm = Math.hypot(mira - B.x, -B.z);
const f = { x: (mira - B.x) / dm, z: -B.z / dm };
const r = { x: -f.z, z: f.x };
const P = (af, ar, y) => [B.x + f.x * af + r.x * ar, y, B.z + f.z * af + r.z * ar];
const D = num('camdist', 4.6);
const VISTAS = {
  dir: { pos: P(-0.5, D, 1.0), olhar: P(-0.5, 0, 0.85) },
  esq: { pos: P(-0.5, -D, 1.0), olhar: P(-0.5, 0, 0.85) },
  frente: { pos: P(D + 0.4, 0.3, 1.1), olhar: P(-0.4, 0, 0.85) },
  tras: { pos: P(-D - 0.6, 0.6, 1.5), olhar: P(1, 0, 0.7) },
  cima: { pos: P(-0.41, 0, 6.5), olhar: P(-0.4, 0, 0) },
  diag: { pos: P(2.6, 3.4, 1.3), olhar: P(-0.5, 0, 0.85) },
};
const segue = modo === 'corrida' || modo === 'espera' || a.seguir === '1';
const cam = segue ? null : { ...VISTAS[vista], fov };
// câmera presa ao cobrador, em relação à direção em que ele está virado na espera (lado direito dele = 'dir')
const camSegue = `(() => { const c = window.jogoTeste.cobradorPos(); const y = c.giro; const fx = Math.sin(y), fz = Math.cos(y); const rx = -Math.cos(y), rz = Math.sin(y); const D = ${D};
  const v = { dir: [rx * D, 1.0, rz * D], esq: [-rx * D, 1.0, -rz * D], frente: [fx * D, 1.1, fz * D], tras: [-fx * D, 1.4, -fz * D], cima: [0.01, 6.5, 0], diag: [fx * D * 0.6 + rx * D * 0.75, 1.3, fz * D * 0.6 + rz * D * 0.75] }['${vista}'];
  return { pos: v, olhar: '${vista}' === 'cima' ? [0, 0, 0] : [0, 0.85, 0], seguir: true, fov: ${fov} }; })()`;
const passos = [
  { esperarJogo: true },
  { tamanho: { largura, altura } },
  { js: `const t = window.jogoTeste; t.hud(false); t.falta(${dist}, ${ang}); t.cobrador(${lenda}); t.mirar(${mira}); t.contato(${cx}, ${cy}); t.pausar(true);` },
  { js: segue ? `window.jogoTeste.camera(${camSegue})` : `window.jogoTeste.camera(${JSON.stringify(cam)})` },
];
const rot = [];
if (modo === 'espera') {
  // a espera: sem chutar, o relógio anda
  const n = Math.round((ate - de) / passo) + 1;
  passos.push({ js: 'window.jogoTeste.pausar(false)' });
  for (let i = 0; i < n; i++) {
    passos.push({ esperarSegundos: i === 0 ? 0.2 : passo }, { foto: `q${String(i).padStart(2, '0')}` });
    rot.push((i * passo).toFixed(1));
  }
} else {
  passos.push({ js: `window.jogoTeste.chutar(${forca}); window.__tc = window.jogoTeste.tempos().tempoContato; window.__dur = window.jogoTeste.tempos().duracao;` });
  passos.push({ avaliar: 'JSON.stringify(window.jogoTeste.tempos())', guardar: 'tempos' });
  let lista = [];
  if (modo === 'corrida') {
    // do começo da corrida até o contato, em n quadros iguais
    const n = num('n', 10);
    for (let i = 0; i < n; i++) lista.push({ abs: i / (n - 1), rot: `${Math.round((i / (n - 1)) * 100)}%` });
    passos.push({ js: 'window.__t = 0' });
    for (const [i, q] of lista.entries()) {
      passos.push({ js: `{ const alvo = ${q.abs} * window.__tc; window.jogoTeste.avancar(alvo - window.__t); window.__t = Math.round(alvo * 60) / 60; }` });
      passos.push({ esperarQuadros: 2 }, { foto: `q${String(i).padStart(2, '0')}` });
      rot.push(q.rot);
    }
  } else {
    const n = Math.round((ate - de) / passo) + 1;
    passos.push({ js: `window.jogoTeste.avancar(Math.max(0, window.__tc + (${de})))` });
    for (let i = 0; i < n; i++) {
      if (i > 0) passos.push({ js: `window.jogoTeste.avancar(${passo})` });
      passos.push({ esperarQuadros: 2 }, { foto: `q${String(i).padStart(2, '0')}` });
      const dt = de + i * passo;
      rot.push(`${dt >= 0 ? '+' : ''}${dt.toFixed(2)}`);
    }
  }
  passos.push({ avaliar: 'JSON.stringify({ e: window.jogoTeste.estado(), t: window.jogoTeste.tempos() })', guardar: 'fim' });
}
const roteiro = { perfil: 'computador', escala: 1, url: 'index.html?teste', saida, passos };
const arq = `${saida}/roteiro.json`;
writeFileSync(arq, JSON.stringify(roteiro, null, 1));
const raiz = a.raiz || '/home/user/fkl-anim';
const porta = a.porta || '8811';
const res = spawnSync('node', ['captura.mjs', arq, '--raiz', raiz, '--porta', porta, '--saida', saida], { cwd: HARNESS, encoding: 'utf8' });
if (res.status !== 0) {
  console.log(res.stdout.slice(-3000));
  console.log(res.stderr.slice(-3000));
  process.exit(1);
}
const rj = JSON.parse(readFileSync(`${saida}/resultado.json`, 'utf8'));
console.log('tempos', rj.guardados.tempos || '', 'fim', rj.guardados.fim || '', 'erros', (rj.consoleErros || []).length, rj.erro || '');
// folha de contato
const fotos = rot.map((_, i) => `${saida}/q${String(i).padStart(2, '0')}.png`).filter((p) => existsSync(p));
const recorte = a.recorte || '';
const args = [];
fotos.forEach((p, i) => { args.push('-label', rot[i], p); });
const tile = `${colunas}x`;
const geo = a.geo || `${Math.round(largura * num('zoom', 0.6))}x${Math.round(altura * num('zoom', 0.6))}+2+2`;
const pre = recorte ? ['-crop', recorte, '+repage'] : [];
const folha = `${RASC}/anim/cap/${nome}.png`;
const m = spawnSync('montage', [...args, ...pre, '-tile', tile, '-geometry', geo, '-background', '#111', '-fill', '#fff', '-pointsize', '15', folha], { encoding: 'utf8' });
if (m.status !== 0) console.log(m.stderr);
console.log('folha', folha);
