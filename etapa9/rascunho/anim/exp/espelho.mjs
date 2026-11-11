import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL('/home/user/fkl-anim/testes/carregador-three.mjs'));
const THREE = await import('three');
const J = await import('/home/user/fkl-anim/js/jogadores.js');
const { criarCobranca, PADRAO_COBRANCA } = await import('/home/user/fkl-anim/js/cobranca.js');
const { ELENCO } = await import('/home/user/fkl-anim/js/elenco.js');
const { CONFIG } = await import('/home/user/fkl-anim/js/config.js');
const jog = ELENCO.find((j) => j.numero === 8);
const c = jog.cobranca;
const cadencia = 1.6 * (c.ritmo || 1);
const cfg = { ...CONFIG, cobrador: { ...PADRAO_COBRANCA, distancia: c.distancia, angulo: c.angulo, cadencia, postura: c.postura, braco: c.braco } };
const mk = (pe, s) => {
  const p = J.criarPersonagem({ visual: jog.visual, numero: jog.numero, nome: jog.apelido });
  const an = criarCobranca(p, { bola: { x: s * 8.45, z: 15.9 }, alvo: { x: 0, z: 0 }, pe, cfg, estilo: c });
  an.preparar({ forca: 0.8, contato: { x: s * 0.4, y: 0.1 }, alvo: { x: s * 1.5, z: 0 }, tecnica: 'curva' });
  return { p, an };
};
const d = mk('D', 1), e = mk('E', -1);
console.log('inicio', d.an.inicio, e.an.inicio, 'tc', d.an.tempoContato, e.an.tempoContato);
const nomes = ['quadril', 'tronco', 'cabeca', 'ombroE', 'cotoveloE', 'punhoE', 'ombroD', 'cotoveloD', 'punhoD', 'pernaE', 'joelhoE', 'tornozeloE', 'pernaD', 'joelhoD', 'tornozeloD'];
const troca = (n) => (n.endsWith('E') ? n.slice(0, -1) + 'D' : n.endsWith('D') ? n.slice(0, -1) + 'E' : n);
for (const t of [-0.3, 0, 0.2, 0.5, 0.9, 1.09, 1.3, 2.0]) {
  d.an.atualizar(t, {}); e.an.atualizar(t, {});
  d.p.grupo.updateMatrixWorld(true); e.p.grupo.updateMatrixWorld(true);
  let pior = 0, qual = '';
  for (const n of nomes) {
    const a = d.p.juntas[n].getWorldPosition(new THREE.Vector3());
    const b = e.p.juntas[troca(n)].getWorldPosition(new THREE.Vector3());
    const dif = Math.hypot(a.x + b.x, a.y - b.y, a.z - b.z);
    if (dif > pior) { pior = dif; qual = `${n} D(${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}) E(${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)})`; }
  }
  console.log(t, 'pior', (pior * 1000).toFixed(3), 'mm', qual);
}
