import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL('/home/user/fkl-anim/testes/carregador-three.mjs'));
const THREE = await import('three');
const J = await import('/home/user/fkl-anim/js/jogadores.js');
const { criarCobranca, PADRAO_COBRANCA } = await import('/home/user/fkl-anim/js/cobranca.js');
const { ELENCO } = await import('/home/user/fkl-anim/js/elenco.js');
const { CONFIG } = await import('/home/user/fkl-anim/js/config.js');
const num = Number(process.argv[2] || 8);
const jog = ELENCO.find((j) => j.numero === num);
const c = jog.cobranca;
const cadencia = 1.6 * (c.ritmo || 1);
const cfg = { raioBola: 0.11, cobrador: { ...PADRAO_COBRANCA, distancia: c.distancia, angulo: c.angulo, cadencia, corrida: Math.max(0.2, c.passos / (2 * cadencia) - 0.3), postura: c.postura, braco: c.braco } };
const p = J.criarPersonagem({ visual: jog.visual, numero: jog.numero, nome: jog.apelido });
const bola = { x: 0, z: 22 };
const t0 = performance.now();
const an = criarCobranca(p, { bola, alvo: { x: 0, z: 0 }, pe: jog.pe, cfg, estilo: c });
const t1 = performance.now();
an.preparar({ forca: 0.8, contato: { x: 0.4, y: 0.1 }, alvo: { x: 1.5, z: 0 }, tecnica: process.argv[3] || 'curva' });
const t2 = performance.now();
console.log(jog.nome, jog.pe, c, 'criar', (t1 - t0).toFixed(2), 'ms; preparar', (t2 - t1).toFixed(2), 'ms');
console.log('inicio', an.inicio, 'tempoContato', an.tempoContato.toFixed(3), 'duracao', an.duracao.toFixed(3), 'batida', an.batida);
console.log('pisadas'); for (const q of an.pisadas()) console.log('  ', q.pe, q.x.toFixed(2), q.z.toFixed(2), (q.rotacaoY * 180 / Math.PI).toFixed(0), 'pisa', q.pisa.toFixed(3), 'sai', q.sai.toFixed(3));
an.atualizar(0, {});
console.log('tempos', an.medir().tempos);
const pos = (j, x = 0, y = 0, z = 0) => { p.grupo.updateMatrixWorld(true); return p.juntas[j].localToWorld(new THREE.Vector3(x, y, z)); };
for (let t = 0; t <= an.duracao + 0.3; t += 1 / 30) {
  const r = an.atualizar(t, {});
  const m = an.medir();
  const q = p.juntas.quadril.getWorldPosition(new THREE.Vector3());
  const tE = pos('tornozeloE'), tD = pos('tornozeloD');
  console.log(t.toFixed(3), r.etapa.padEnd(7), r.progresso.toFixed(2), 'G', p.grupo.position.x.toFixed(2), p.grupo.position.z.toFixed(2), 'yaw', (p.grupo.rotation.y * 180 / Math.PI).toFixed(0), 'H', q.y.toFixed(3),
    'E', tE.x.toFixed(2), tE.y.toFixed(2), tE.z.toFixed(2), m.pes.E ? '#' : ' ', 'D', tD.x.toFixed(2), tD.y.toFixed(2), tD.z.toFixed(2), m.pes.D ? '#' : ' ',
    'jE', p.juntas.joelhoE.rotation.x.toFixed(2), 'jD', p.juntas.joelhoD.rotation.x.toFixed(2), 'desce', m.desce.toFixed(3), 'falta', m.falta.toFixed(3));
}
