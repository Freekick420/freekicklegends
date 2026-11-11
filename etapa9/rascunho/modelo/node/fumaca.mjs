import * as THREE from 'three';
const J = await import('/home/user/fkl-modelo/js/jogadores.js');
const { ELENCO } = await import('/home/user/fkl-modelo/js/elenco.js');
const t0 = performance.now();
const p = J.criarPersonagem({ visual: ELENCO[8].visual, uniforme: ELENCO[8].uniforme, numero: 8, nome: 'JUNINHO' });
console.log('criar 1o (ms)', (performance.now() - t0).toFixed(1));
const conta = (o) => { let tri = 0, malhas = 0, vert = 0; o.traverse((m) => { if (m.isMesh) { malhas++; tri += m.geometry.index.count / 3; vert += m.geometry.attributes.position.count; } }); return { malhas, tri, vert }; };
console.log(conta(p.grupo));
for (const m of p.grupo.children) if (m.isMesh) console.log(m.name, m.geometry.index.count / 3, m.geometry.attributes.position.count);
const s = p.criarSilhueta(new THREE.MeshBasicMaterial(), 4);
console.log('silhueta', s.geometry.index.count / 3, s.geometry.attributes.position.count);
// confere: na pose de repouso (ossos sem giro) a malha com pele fica onde foi modelada
p.aplicarPose({ bracoE: { lado: 0 }, bracoD: { lado: 0 }, apoio: 0 });
p.grupo.updateMatrixWorld(true);
p.esqueleto.update();
let maior = 0; const v = new THREE.Vector3(); const o = new THREE.Vector3();
for (const m of p.grupo.children) if (m.isSkinnedMesh) {
  const pos = m.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 7) { m.getVertexPosition(i, v); o.fromBufferAttribute(pos, i); o.multiply(p.juntas.quadril.parent.scale); maior = Math.max(maior, v.distanceTo(o)); }
}
console.log('erro repouso (m)', maior.toExponential(2));
// caixa do boneco de pé
const caixa = new THREE.Box3();
for (const m of p.grupo.children) if (m.isSkinnedMesh && m.name !== 'silhueta') { const pos = m.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { m.getVertexPosition(i, v); caixa.expandByPoint(v); } }
console.log('caixa', caixa.min.toArray().map((x) => +x.toFixed(3)), caixa.max.toArray().map((x) => +x.toFixed(3)));
// outros: goleiro, baixo, todos do elenco
const t1 = performance.now();
for (const j of ELENCO) { const q = J.criarPersonagem({ visual: j.visual, uniforme: j.uniforme, numero: j.numero, nome: j.nomeCamisa }); q.dispose(); }
console.log('elenco inteiro (ms)', (performance.now() - t1).toFixed(1));
const b = J.criarPersonagem({ visual: J.visualAdversario(3), uniforme: J.UNIFORMES.adversario, numero: 5, detalhe: 'baixo' });
console.log('baixo', conta(b.grupo));
const g = J.criarPersonagem({ visual: J.VISUAL_GOLEIRO_ADVERSARIO, uniforme: J.UNIFORMES.goleiroAdversario, numero: 1 });
console.log('goleiro', conta(g.grupo));
console.log(J.estatisticasCache());
