import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL('/home/user/fkl-anim/testes/carregador-three.mjs'));
const THREE = await import('three');
const J = await import('/home/user/fkl-anim/js/jogadores.js');
const { criarCobranca, PADRAO_COBRANCA } = await import('/home/user/fkl-anim/js/cobranca.js');
const { ELENCO } = await import('/home/user/fkl-anim/js/elenco.js');
const { CONFIG } = await import('/home/user/fkl-anim/js/config.js');
const { preverTecnica } = await import('/home/user/fkl-anim/js/physics.js');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const num = Number(arg('lenda', 8));
const jog = ELENCO.find((j) => j.numero === num);
const c = jog.cobranca;
const cadencia = 1.6 * (c.ritmo || 1);
const cfg = { ...CONFIG, cobrador: { ...PADRAO_COBRANCA, distancia: c.distancia, angulo: c.angulo, cadencia, corrida: Math.max(0.2, c.passos / (2 * cadencia) - 0.3), postura: c.postura, braco: c.braco } };
const p = J.criarPersonagem({ visual: jog.visual, numero: jog.numero, nome: jog.apelido });
const dist = Number(arg('dist', 22)), ang = Number(arg('ang', 0));
const bola = { x: dist * Math.sin(ang * Math.PI / 180), z: dist * Math.cos(ang * Math.PI / 180) };
const an = criarCobranca(p, { bola, alvo: { x: 0, z: 0 }, pe: jog.pe, cfg, estilo: c });
const contato = { x: Number(arg('cx', 0.4)), y: Number(arg('cy', 0.1)) };
const forca = Number(arg('forca', 0.8));
const tecnica = arg('tecnica', preverTecnica({ forca, contato, cobrador: jog }, CONFIG));
an.preparar({ forca, contato, alvo: { x: Number(arg('mira', 1.5)), z: 0 }, tecnica });
console.log(jog.nome, jog.pe, 'tecnica', tecnica, 'batida', an.batida, 'tc', an.tempoContato.toFixed(3), 'fim', an.duracao.toFixed(3));
an.atualizar(0, {});
console.log('tempos', JSON.stringify(an.medir().tempos));
const t0 = Number(arg('t0', 0)), t1 = Number(arg('t1', an.duracao + 0.2));
const nomes = arg('juntas', 'pernaD,joelhoD,tornozeloD').split(',');
const ant = new Map();
const pos = (j, x = 0, y = 0, z = 0) => { p.grupo.updateMatrixWorld(true); return p.juntas[j].localToWorld(new THREE.Vector3(x, y, z)); };
for (let n = Math.round(t0 * 60); n <= Math.round(t1 * 60); n++) {
  const t = n / 60;
  const r = an.atualizar(t, {});
  const m = an.medir();
  let linha = `${t.toFixed(3)} ${r.etapa.padEnd(7)} H ${p.juntas.quadril.position.y.toFixed(3)} desce ${m.desce.toFixed(3)}`;
  for (const nome of nomes) {
    const q = p.juntas[nome].quaternion;
    const a = ant.get(nome);
    const w = a ? (2 * Math.acos(Math.min(1, Math.abs(a.dot(q))))) * 60 : 0;
    ant.set(nome, q.clone());
    const e = p.juntas[nome].rotation;
    linha += ` | ${nome} ${w.toFixed(1).padStart(5)} (${e.x.toFixed(2)} ${e.y.toFixed(2)} ${e.z.toFixed(2)})`;
  }
  const tE = pos('tornozeloE'), tD = pos('tornozeloD');
  const sola = (l) => Math.min(...J.SOLA.map((s) => pos('tornozelo' + l, ...s).y));
  linha += ` | E ${tE.x.toFixed(2)} ${tE.y.toFixed(2)} ${tE.z.toFixed(2)} s${sola('E').toFixed(3)}${m.pes.E ? '#' : ' '} D ${tD.x.toFixed(2)} ${tD.y.toFixed(2)} ${tD.z.toFixed(2)} s${sola('D').toFixed(3)}${m.pes.D ? '#' : ' '}`;
  console.log(linha);
}
