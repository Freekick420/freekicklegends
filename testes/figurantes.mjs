// Testes dos figurantes (os outros jogadores em campo). Rodar com: node testes/figurantes.mjs
// (com --completo, mais faltas e mais chutes: demora mais)
// Tudo é determinista: cada montagem usa um sorteio com semente fixa (mesma semente, mesma montagem).
// As regras são conferidas com contas escritas aqui (não com as funções do módulo): corredor do chute,
// distâncias da regra, faixa da câmera, corrida do cobrador, goleiro, traves, barreira e duplas.
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { criarBola, chutar, passo } from '../js/physics.js';
import { ELENCO } from '../js/elenco.js';
import { montarBarreira, semBarreira, PADRAO_BARREIRA } from '../js/barreira.js';
import { criarGoleiro, PADRAO_GOLEIRO, PADRAO_PENALTI } from '../js/goleiro.js';
import {
  montarFigurantes, atualizarFigurantes, colidirBolaFigurantes, corredorDoChute, PADRAO_FIGURANTES, MAXIMO_FIGURANTES,
} from '../js/figurantes.js';

const COMPLETO = process.argv.includes('--completo');
const H = 1 / 240; // passo da física, como no jogo
const MEIA = CONFIG.golLargura / 2;
const GRAUS = Math.PI / 180;
const CFG = {
  ...CONFIG,
  goleiro: { ...PADRAO_GOLEIRO, ...(CONFIG.goleiro || {}) },
  penalti: { ...PADRAO_PENALTI, ...(CONFIG.penalti || {}) },
  barreira: { ...PADRAO_BARREIRA, ...(CONFIG.barreira || {}) },
  figurantes: { ...PADRAO_FIGURANTES, ...(CONFIG.figurantes || {}) },
};
const comQuantidade = (n, extra = {}) => ({ ...CFG, figurantes: { ...CFG.figurantes, quantidade: n, ...extra } });

// Sorteio com semente (mulberry32, o mesmo do jogo): a mesma semente dá sempre a mesma sequência
function criarSorteio(semente) {
  let a = Math.floor(semente * 4294967296) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Um sorteio independente para cada uso, como sorteioDaJogada(n) no js/main.js
const sorteioDaJogada = (semente, n) => criarSorteio((semente + n * 0.6180339887) % 1);

const teste = (nome, fn) => {
  const inicio = Date.now();
  fn();
  console.log('ok -', nome, `(${Date.now() - inicio} ms)`);
};

// Onde o cobrador espera para correr (aproximação de criarCobranca, de js/cobranca.js, que precisa do
// boneco: a corrida termina com o pé de apoio ao lado da bola, uns 0,45 m antes dela)
function inicioDoCobrador(bola, jogador) {
  const c = jogador.cobranca || {};
  const lado = jogador.pe === 'D' ? 1 : -1;
  const yawCorrida = Math.atan2(-bola.x, -bola.z) - lado * (c.angulo ?? 30) * GRAUS;
  const d = (c.distancia ?? 2) + 0.45;
  return { x: bola.x - Math.sin(yawCorrida) * d, z: bola.z - Math.cos(yawCorrida) * d };
}

// Monta uma cobrança inteira como o jogo faz: barreira, goleiro e figurantes com a semente da jogada
function montar({ distancia = 22, angulo = 0, semente = 0.123, jogador = ELENCO[0], quantidade = 10, penalti = false, cfg = null } = {}) {
  const c = cfg || comQuantidade(quantidade);
  const bola = penalti ? { x: 0, z: 11 } : { x: distancia * Math.sin(angulo * GRAUS), z: distancia * Math.cos(angulo * GRAUS) };
  const barreira = penalti ? semBarreira(bola) : montarBarreira(bola, c, sorteioDaJogada(semente, 0));
  const goleiro = penalti
    ? criarGoleiro(bola, null, c, { penalti: { historico: [], aleatorio: sorteioDaJogada(semente, 2) } })
    : criarGoleiro(bola, barreira, c);
  const cobrador = inicioDoCobrador(bola, jogador);
  const opcoes = { penalti, cobrador, pe: jogador.pe, goleiro: { x: goleiro.base.x, z: goleiro.z } };
  const f = montarFigurantes(bola, barreira, c, sorteioDaJogada(semente, 3), opcoes);
  return { f, bola, barreira, goleiro, cobrador, opcoes, cfg: c, jogador };
}

// Faltas sorteadas (distância 18 a 33 m, ângulo −32° a 32°, cobradores destros e canhotos)
function* faltasSorteadas(n, semente = 0.777) {
  const r = criarSorteio(semente);
  for (let i = 0; i < n; i++) {
    yield {
      distancia: 18 + Math.round(r() * 15),
      angulo: Math.round((r() * 2 - 1) * 32),
      jogador: ELENCO[Math.floor(r() * ELENCO.length)],
      semente: r(),
    };
  }
}
const descrever = (m) => `falta ${m.distancia ?? 'pênalti'} m ${m.angulo ?? ''}° ${m.jogador.nomeCamisa} (${m.jogador.pe}) semente ${m.semente}`;

// ---------- As regras, escritas à mão ----------

// Distância com sinal de p à reta a → b (positiva = à esquerda de quem anda de a para b, olhando de cima
// com x para a direita e z para baixo) e a fração do caminho
function naReta(p, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const L = Math.hypot(dx, dz);
  return { lado: ((p.x - a.x) * dz - (p.z - a.z) * dx) / L, u: ((p.x - a.x) * dx + (p.z - a.z) * dz) / (L * L) };
}
// Dentro do triângulo bola → traves com `folga` m para fora de cada trave?
function noTriangulo(p, bola, folga = 1) {
  if (p.z < 0 || p.z > bola.z) return false;
  const e = naReta(p, bola, { x: -MEIA - folga, z: 0 });
  const d = naReta(p, bola, { x: MEIA + folga, z: 0 });
  const meio = { x: 0, z: 0 };
  return Math.sign(e.lado) === Math.sign(naReta(meio, bola, { x: -MEIA - folga, z: 0 }).lado)
    && Math.sign(d.lado) === Math.sign(naReta(meio, bola, { x: MEIA + folga, z: 0 }).lado);
}
function distanciaAoSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const u = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - dx * u, p.z - a.z - dz * u);
}

// Confere todas as regras de posição de uma montagem; devolve a lista de problemas (vazia = tudo certo)
function conferir(m) {
  const { f, bola, barreira, goleiro, cobrador } = m;
  const erros = [];
  const dist = Math.hypot(bola.x, bola.z);
  const ax = bola.x / dist;
  const az = bola.z / dist;
  f.jogadores.forEach((j, i) => {
    const quem = `#${i} ${j.time}/${j.papel} (${j.x.toFixed(2)}, ${j.z.toFixed(2)})`;
    const dBola = Math.hypot(j.x - bola.x, j.z - bola.z);
    if (!(Math.abs(j.x) <= 33 && j.z >= 0.5 && j.z <= 52)) erros.push(`${quem}: fora do campo`);
    if (j.time !== 'ataque' && j.time !== 'defesa') erros.push(`${quem}: time ${j.time}`);
    if (j.time === 'defesa' && dBola < 9.15) erros.push(`${quem}: adversário a ${dBola.toFixed(2)} m da bola`);
    if (dBola < 3) erros.push(`${quem}: a ${dBola.toFixed(2)} m da bola`);
    if (noTriangulo(j, bola, 1)) erros.push(`${quem}: dentro do triângulo bola → traves (+1 m)`);
    // Faixa da câmera: 5 m para cada lado da reta que vai da bola para trás, até 16 m
    const atras = (j.x - bola.x) * ax + (j.z - bola.z) * az;
    const lado = (j.x - bola.x) * az - (j.z - bola.z) * ax;
    if (atras >= 0 && atras <= 16 && Math.abs(lado) < 5) erros.push(`${quem}: na frente da câmera (${atras.toFixed(1)} m atrás, ${lado.toFixed(1)} m ao lado)`);
    if (distanciaAoSegmento(j, cobrador, bola) < 2) erros.push(`${quem}: no caminho da corrida do cobrador`);
    if (Math.hypot(j.x - goleiro.base.x, j.z - goleiro.z) < 2.5) erros.push(`${quem}: em cima do goleiro`);
    for (const s of [-1, 1]) if (Math.hypot(j.x - s * MEIA, j.z) < 1.8) erros.push(`${quem}: em cima da trave`);
    for (const b of barreira.jogadores) {
      const d = Math.hypot(j.x - b.x, j.z - b.z);
      if (d < (j.time === 'ataque' ? 1.0 : 0.9) + 0.4) erros.push(`${quem}: a ${d.toFixed(2)} m da barreira`);
    }
    if (m.penalti) {
      if (!(j.z >= 16.5 || Math.abs(j.x) >= 20.16)) erros.push(`${quem}: dentro da área no pênalti`);
      if (dBola < 9.15) erros.push(`${quem}: dentro da meia-lua no pênalti`);
      if (j.z < bola.z) erros.push(`${quem}: à frente da linha da bola no pênalti`);
    }
    if (!(j.altura > 1.6 && j.altura < 2.0 && j.raio > 0.15 && j.raio < 0.35)) erros.push(`${quem}: altura/raio ${j.altura}/${j.raio}`);
    if (!Number.isFinite(j.rotacaoY)) erros.push(`${quem}: rotacaoY ${j.rotacaoY}`);
    // Ninguém em cima de ninguém: dupla de marcação lado a lado (0,6 a 0,9 m); os outros a mais de 1,5 m
    for (let k = i + 1; k < f.jogadores.length; k++) {
      const o = f.jogadores[k];
      const d = Math.hypot(j.x - o.x, j.z - o.z);
      const dupla = j.par === k && o.par === i;
      if (dupla && !(d >= 0.6 && d <= 0.9)) erros.push(`${quem}: dupla com #${k} a ${d.toFixed(2)} m`);
      if (dupla && j.time === o.time) erros.push(`${quem}: dupla do mesmo time com #${k}`);
      if (!dupla && d <= 1.5) erros.push(`${quem}: a ${d.toFixed(2)} m de #${k}`);
    }
    if (j.par >= 0 && (!f.jogadores[j.par] || f.jogadores[j.par].par !== i)) erros.push(`${quem}: par ${j.par} não corresponde`);
  });
  return erros;
}

// ---------- Posicionamento ----------

teste('quantidade: 0 = campo vazio; o padrão é 10; o máximo é 14; times equilibrados', () => {
  assert.equal(PADRAO_FIGURANTES.quantidade, 10);
  assert.equal(PADRAO_FIGURANTES.colisao, true);
  assert.equal(montar({ quantidade: 0 }).f.jogadores.length, 0);
  assert.equal(montar({ quantidade: 99 }).f.jogadores.length, MAXIMO_FIGURANTES);
  assert.equal(MAXIMO_FIGURANTES, 14);
  for (const q of [1, 2, 5, 10, 14]) {
    const { f, barreira } = montar({ quantidade: q });
    assert.equal(f.jogadores.length, q);
    const ataque = f.jogadores.filter((j) => j.time === 'ataque').length;
    const defesa = q - ataque;
    assert.ok(ataque <= 9, `${ataque} companheiros (o cobrador é o décimo de linha)`);
    assert.ok(defesa <= 10 - barreira.jogadores.length, `${defesa} adversários + ${barreira.jogadores.length} na barreira`);
    if (q === 10) assert.ok(ataque >= 4 && defesa >= 4, `10 em campo: ${ataque} + ${defesa}`);
  }
  // Sem configuração nenhuma (só os padrões do módulo) também monta
  const solto = montarFigurantes({ x: 0, z: 22 }, montarBarreira({ x: 0, z: 22 }, {}, criarSorteio(0.5)), {}, criarSorteio(0.5), {});
  assert.equal(solto.jogadores.length, 10);
});

teste(`falta: ${COMPLETO ? 1500 : 400} faltas sorteadas (18 a 33 m, −32° a 32°, destros e canhotos, 1 a 14 jogadores): ninguém no corredor, nas zonas proibidas ou em cima de outro`, () => {
  let total = 0;
  let jogadores = 0;
  const quantidades = [10, 10, 14, 7, 12, 4, 1, 10];
  for (const caso of faltasSorteadas(COMPLETO ? 1500 : 400)) {
    const quantidade = quantidades[total % quantidades.length];
    const m = { ...caso, ...montar({ ...caso, quantidade }) };
    assert.equal(m.f.jogadores.length, quantidade, `${descrever(m)}: ${m.f.jogadores.length} de ${quantidade}`);
    const erros = conferir(m);
    assert.deepEqual(erros, [], `${descrever(m)} com ${quantidade}:\n  ${erros.join('\n  ')}`);
    total++;
    jogadores += quantidade;
  }
  console.log(`    ${total} faltas, ${jogadores} jogadores conferidos`);
});

teste('falta: cantos da faixa de sorteio e faltas fixas esquisitas (dentro da área, bem de lado) também montam certo', () => {
  const casos = [];
  for (const distancia of [16, 18, 20, 22, 25, 28, 33, 35]) for (const angulo of [-40, -32, -20, -8, 0, 8, 20, 32, 40]) casos.push({ distancia, angulo });
  let n = 0;
  for (const caso of casos) {
    for (const jogador of [ELENCO.find((j) => j.pe === 'D'), ELENCO.find((j) => j.pe === 'E'), ELENCO.find((j) => j.numero === 3)]) {
      const m = { ...caso, jogador, semente: 0.31 + n * 0.0137, ...montar({ ...caso, jogador, semente: 0.31 + n * 0.0137, quantidade: 14 }) };
      const erros = conferir(m);
      assert.deepEqual(erros, [], `${descrever(m)}:\n  ${erros.join('\n  ')}`);
      // Nas faltas que o jogo sorteia (18 a 33 m, até 32°) a montagem é sempre completa
      const sorteavel = caso.distancia >= 18 && caso.distancia <= 33 && Math.abs(caso.angulo) <= 32;
      if (sorteavel) assert.equal(m.f.jogadores.length, 14, descrever(m));
      else assert.ok(m.f.jogadores.length >= 10, `${descrever(m)}: só ${m.f.jogadores.length}`);
      n++;
    }
  }
});

teste('pênalti: todo mundo fora da área e da meia-lua, atrás da linha da bola, em fila para o rebote', () => {
  for (let i = 0; i < 60; i++) {
    const jogador = ELENCO[i % ELENCO.length];
    const quantidade = [10, 14, 6, 10][i % 4];
    const m = { penalti: true, jogador, semente: 0.05 + i * 0.0151, ...montar({ penalti: true, jogador, semente: 0.05 + i * 0.0151, quantidade }) };
    assert.equal(m.f.jogadores.length, quantidade);
    const erros = conferir(m);
    assert.deepEqual(erros, [], `${descrever(m)}:\n  ${erros.join('\n  ')}`);
    for (const j of m.f.jogadores) {
      assert.equal(j.papel, 'fila');
      // Na risca da área ou em cima da meia-lua (não espalhados pelo campo)
      assert.ok(j.z < 19.5 && Math.abs(j.x) < 20, `fila: (${j.x.toFixed(1)}, ${j.z.toFixed(1)})`);
    }
    const ataque = m.f.jogadores.filter((j) => j.time === 'ataque').length;
    assert.ok(Math.abs(ataque - (quantidade - ataque)) <= 2, `times misturados na fila: ${ataque} de ${quantidade}`);
    // Dos dois lados da meia-lua
    assert.ok(m.f.jogadores.some((j) => j.x < 0) && m.f.jogadores.some((j) => j.x > 0));
  }
});

teste('mesma semente = mesma montagem; outra semente = outra; com menos gente saem os menos importantes', () => {
  for (const caso of faltasSorteadas(40, 0.4242)) {
    const a = montar({ ...caso, quantidade: 14 });
    const b = montar({ ...caso, quantidade: 14 });
    assert.deepEqual(a.f, b.f, 'mesma semente, mesma montagem');
    const outra = montar({ ...caso, semente: (caso.semente + 0.37) % 1, quantidade: 14 });
    assert.notDeepEqual(a.f.jogadores.map((j) => [j.x, j.z]), outra.f.jogadores.map((j) => [j.x, j.z]));
    // Os k primeiros da montagem grande são a montagem de k jogadores (posição, time, papel, número)
    for (const k of [10, 6, 3]) {
      const menor = montar({ ...caso, quantidade: k }).f.jogadores;
      assert.equal(menor.length, k);
      menor.forEach((j, i) => {
        const g = a.f.jogadores[i];
        assert.deepEqual([j.x, j.z, j.time, j.papel, j.numero, j.altura], [g.x, g.z, g.time, g.papel, g.numero, g.altura], `jogador ${i} com ${k}`);
      });
    }
  }
  // Não usa Math.random: com ele quebrado, tudo continua igual
  const original = Math.random;
  const antes = montar({ distancia: 24, angulo: 10, semente: 0.9 });
  Math.random = () => { throw new Error('Math.random foi usado'); };
  try {
    const depois = montar({ distancia: 24, angulo: 10, semente: 0.9 });
    assert.deepEqual(antes.f, depois.f);
    atualizarFigurantes(depois.f, 0.7);
  } finally {
    Math.random = original;
  }
});

teste('papéis: duplas atacante + marcador na área, sobra, gente dos dois lados, um companheiro atrás da bola; números sem repetir', () => {
  let visiveis = 0;
  let n = 0;
  for (const caso of faltasSorteadas(120, 0.1357)) {
    const m = montar({ ...caso, quantidade: 10 });
    const js = m.f.jogadores;
    const duplas = js.filter((j) => j.par >= 0 && j.time === 'ataque').length;
    assert.ok(duplas >= 2, `${descrever({ ...caso })}: só ${duplas} duplas`);
    assert.ok(js.some((j) => j.papel === 'sobra'), 'tem o zagueiro da sobra');
    const dist = Math.hypot(m.bola.x, m.bola.z);
    const atras = js.filter((j) => (j.x - m.bola.x) * m.bola.x / dist + (j.z - m.bola.z) * m.bola.z / dist > 0);
    assert.ok(atras.length >= 1 && atras.length <= 2, `${atras.length} atrás da bola`);
    assert.ok(atras.every((j) => j.time === 'ataque'), 'atrás da bola só companheiro');
    assert.ok(js.some((j) => j.lado < 0) && js.some((j) => j.lado > 0), 'gente dos dois lados do corredor');
    // Na área ou na entrada dela: a maioria fica entre a bola e a linha do gol
    assert.ok(js.filter((j) => j.z < m.bola.z).length >= 7);
    for (const time of ['ataque', 'defesa']) {
      const numeros = js.filter((j) => j.time === time).map((j) => j.numero);
      assert.equal(new Set(numeros).size, numeros.length, `números repetidos no ${time}: ${numeros}`);
      if (time === 'ataque') assert.ok(numeros.every((x) => !ELENCO.some((l) => l.numero === x)), `número de lenda num companheiro: ${numeros}`);
      else assert.ok(numeros.every((x) => ![1, 3, 4, 5, 6, 8].includes(x)), `número da barreira ou do goleiro: ${numeros}`);
    }
    visiveis += js.filter((j) => j.visto > 0.5).length;
    n++;
  }
  // A montagem prefere os lugares que aparecem na câmera de trás de um celular em pé
  console.log(`    em média ${(visiveis / n).toFixed(1)} dos 10 aparecem na câmera de trás (celular em pé) antes do chute`);
  assert.ok(visiveis / n >= 3.5, `poucos aparecem na tela: ${(visiveis / n).toFixed(1)}`);
});

// ---------- Movimento depois do chute ----------

teste('depois do chute: uns passos para o rebote, sem teleporte, sem entrar no corredor nem atropelar ninguém; o replay repete', () => {
  let andaram = 0;
  let total = 0;
  const casos = [...faltasSorteadas(COMPLETO ? 300 : 120, 0.2468)].map((c) => ({ ...c, quantidade: 14 }));
  for (let i = 0; i < 20; i++) casos.push({ penalti: true, jogador: ELENCO[i], semente: 0.11 + i * 0.041, quantidade: 14 });
  for (const caso of casos) {
    const m = { ...caso, ...montar(caso) };
    const js = m.f.jogadores;
    const inicio = js.map((j) => ({ x: j.x, z: j.z }));
    // Antes do chute (t negativo) ninguém sai do lugar
    atualizarFigurantes(m.f, -1);
    js.forEach((j, i) => assert.deepEqual({ x: j.x, z: j.z }, inicio[i]));
    let anterior = inicio.map((p) => ({ ...p }));
    const trilha = [];
    for (let t = H; t <= 3.2; t += H) {
      atualizarFigurantes(m.f, t);
      js.forEach((j, i) => {
        const salto = Math.hypot(j.x - anterior[i].x, j.z - anterior[i].z);
        assert.ok(salto < 9 * H, `${descrever(m)} #${i}: pulo de ${salto.toFixed(3)} m num passo (t=${t.toFixed(2)})`);
        assert.ok(Math.hypot(j.vx, j.vz) < 9, 'velocidade de gente');
        anterior[i].x = j.x;
        anterior[i].z = j.z;
      });
      if (Math.round(t / H) % 12 === 0) {
        // Fora do triângulo do chute o tempo todo, dentro do campo, sem atropelar ninguém
        js.forEach((j, i) => {
          assert.ok(!noTriangulo(j, m.bola, 1), `${descrever(m)} #${i} entrou no corredor em t=${t.toFixed(2)}`);
          assert.ok(Math.abs(j.x) <= 33 && j.z >= 0.5 && j.z <= 52);
          if (!m.penalti) assert.ok(Math.hypot(j.x - m.goleiro.base.x, j.z - m.goleiro.z) >= 2.5, `#${i} em cima do goleiro`);
          for (const b of m.barreira.jogadores) assert.ok(Math.hypot(j.x - b.x, j.z - b.z) >= 1.0, `#${i} atropelou a barreira`);
          for (let k = i + 1; k < js.length; k++) {
            const d = Math.hypot(j.x - js[k].x, j.z - js[k].z);
            if (j.par === k) assert.ok(d >= 0.6 && d <= 0.9, `dupla #${i}/#${k} a ${d.toFixed(2)} m em t=${t.toFixed(2)}`);
            else assert.ok(d >= 1.0, `${descrever(m)}: #${i} e #${k} a ${d.toFixed(2)} m em t=${t.toFixed(2)}`);
          }
        });
        trilha.push(js.map((j) => [j.x, j.z]));
      }
    }
    // No fim estão parados; quem andou, andou pouco (uns passos; no pênalti, a invasão da área)
    js.forEach((j, i) => {
      const d = Math.hypot(j.x - inicio[i].x, j.z - inicio[i].z);
      assert.ok(d <= (m.penalti ? 8 : 4.5), `#${i} andou ${d.toFixed(1)} m`);
      assert.equal(j.vx, 0);
      assert.equal(j.vz, 0);
      if (d > 0.3) andaram++;
      total++;
    });
    // O replay refaz a montagem com a mesma semente e anda igual
    const de = montar(caso);
    const trilha2 = [];
    for (let t = H; t <= 3.2; t += H) {
      atualizarFigurantes(de.f, t);
      if (Math.round(t / H) % 12 === 0) trilha2.push(de.f.jogadores.map((j) => [j.x, j.z]));
    }
    assert.deepEqual(trilha, trilha2);
  }
  console.log(`    ${andaram} de ${total} jogadores dão passos para o rebote (${Math.round((100 * andaram) / total)}%)`);
  assert.ok(andaram / total > 0.5, 'a maioria se mexe depois do chute');
  // Com o movimento desligado, são estátuas
  const parado = montar({ cfg: comQuantidade(10, { movimento: false }) });
  assert.ok(parado.f.jogadores.every((j) => j.plano === null));
});

// ---------- Colisão ----------

// Lança a bola de `de` com a velocidade `vel` e simula até `ate` segundos (só bola e figurantes)
function lancar(m, de, vel, { ate = 1.5, colisao = true } = {}) {
  const bola = criarBola({ x: de.x, y: de.y, z: de.z });
  bola.vel = { ...vel };
  const eventos = [];
  for (let t = H; t <= ate; t += H) {
    atualizarFigurantes(m.f, -1);
    passo(bola, H, m.cfg);
    if (colisao) colidirBolaFigurantes(bola, m.f, m.cfg);
    for (const e of bola.eventos) if (e.tipo === 'jogador') eventos.push({ ...e, t });
    bola.eventos.length = 0;
  }
  return { bola, eventos };
}

teste('colisão: a bola que vai num jogador bate, desvia, perde força e registra o evento com o time', () => {
  let conferidos = 0;
  let emCheio = 0;
  for (const caso of faltasSorteadas(25, 0.8642)) {
    const m = montar({ ...caso, quantidade: 14 });
    m.f.jogadores.forEach((j, i) => {
      // De 4 m de distância, na altura do peito, a 22 m/s, vindo do lado da bola
      const dx = j.x - m.bola.x;
      const dz = j.z - m.bola.z;
      const d = Math.hypot(dx, dz);
      const de = { x: j.x - (dx / d) * 4, y: 1.15, z: j.z - (dz / d) * 4 };
      const vel = { x: (dx / d) * 22, y: 0.9, z: (dz / d) * 22 };
      const novo = montar({ ...caso, quantidade: 14 });
      const r = lancar(novo, de, vel, { ate: 0.6 });
      const ev = r.eventos[0];
      assert.ok(ev, `a bola atravessou o jogador #${i} (${j.papel})`);
      assert.equal(ev.tipo, 'jogador');
      assert.equal(ev.time, novo.f.jogadores[ev.jogador].time);
      assert.ok(['corpo', 'cabeca'].includes(ev.parte));
      assert.ok(Number.isFinite(ev.x + ev.y + ev.z));
      assert.ok(novo.f.batidas >= 1);
      assert.equal(novo.f.ultimaBatida.jogador, r.eventos[r.eventos.length - 1].jogador);
      assert.equal(novo.f.ultimaBatida.time, novo.f.jogadores[novo.f.ultimaBatida.jogador].time);
      conferidos++;
      // (às vezes a bola raspa antes no parceiro da dupla, que está a 0,75 m: aí a conta é outra)
      if (ev.jogador !== i) return;
      emCheio++;
      assert.ok(ev.impacto > 10 && ev.impacto < 25, `impacto ${ev.impacto}`);
      assert.ok(novo.f.jogadores[i].batida > 10);
      // Rebote com pouca força: logo depois da batida a bola está bem mais lenta e não seguiu em frente
      const semColisao = lancar(montar({ ...caso, quantidade: 14 }), de, vel, { ate: 0.6, colisao: false });
      const v = Math.hypot(r.bola.vel.x, r.bola.vel.y, r.bola.vel.z);
      assert.ok(v < 12, `depois da batida a bola ainda a ${v.toFixed(1)} m/s`);
      assert.ok(Math.hypot(r.bola.pos.x - semColisao.bola.pos.x, r.bola.pos.z - semColisao.bola.pos.z) > 2, 'a bola desviou');
    });
  }
  console.log(`    ${conferidos} boladas conferidas (${emCheio} em cheio no jogador mirado)`);
  assert.ok(emCheio > conferidos * 0.8);
});

teste('colisão: cabeça, por cima, de raspão, bola rápida que não atravessa e bola parada encostada', () => {
  // Só os 5 primeiros: o último é o zagueiro da sobra, sozinho e o mais perto da linha de fundo (uma bola
  // que vem de trás dele não encontra mais ninguém no caminho)
  const m = () => montar({ distancia: 24, angulo: 5, semente: 0.52, quantidade: 5 });
  const base = m();
  const N = 4;
  const j = base.f.jogadores[N];
  assert.equal(j.papel, 'sobra');
  assert.equal(j.par, -1);
  // Na cabeça: a bola que cai de cima pega na cabeça (de frente, na altura do rosto, quem recebe é o
  // "corpo": os ombros da cápsula são mais largos que a cabeça, como na barreira)
  let r = lancar(m(), { x: j.x, y: j.altura + 1, z: j.z + 0.02 }, { x: 0, y: -5, z: 0 }, { ate: 0.4 });
  assert.equal(r.eventos[0]?.parte, 'cabeca');
  assert.equal(r.eventos[0]?.jogador, N);
  // (as bolas abaixo vêm do lado da linha de fundo, de 2 m de distância, andando para +z)
  const de = (dx, y) => ({ x: j.x + dx, y, z: j.z - 2 });
  r = lancar(m(), de(0, j.altura - 0.1), { x: 0, y: 0.5, z: 20 }, { ate: 0.3 });
  assert.equal(r.eventos[0]?.jogador, N, 'bola na altura do rosto bate');
  // Por cima da cabeça: passa
  r = lancar(m(), de(0, j.altura + 0.35), { x: 0, y: 1.2, z: 20 }, { ate: 0.2 });
  assert.equal(r.eventos.length, 0, 'bola por cima não bate');
  // Ao lado (mais que raio do corpo + raio da bola): passa
  r = lancar(m(), de(j.raio + CONFIG.raioBola + 0.08, 1.0), { x: 0, y: 0.6, z: 20 }, { ate: 0.2 });
  assert.equal(r.eventos.length, 0, 'bola ao lado não bate');
  // De raspão: bate e desvia para fora
  r = lancar(m(), de(j.raio + 0.02, 1.0), { x: 0, y: 0.6, z: 20 }, { ate: 0.2 });
  assert.equal(r.eventos.length, 1, 'de raspão bate');
  assert.ok(r.bola.vel.x > 0.5 && r.bola.vel.z > 0, 'de raspão a bola segue em frente, desviada para fora');
  // Bola muito rápida (40 m/s = 17 cm por passo) não atravessa
  r = lancar(m(), de(0, 1.0), { x: 0, y: 0.6, z: 40 }, { ate: 0.15 });
  assert.equal(r.eventos.length >= 1, true, 'bola a 40 m/s não atravessa');
  assert.ok(r.bola.pos.z < j.z + 0.5);
  // Bola quase parada encostada no jogador: fica do lado de fora, sem evento de bolada
  r = lancar(m(), { x: j.x + 0.2, y: CONFIG.raioBola, z: j.z + 0.2 }, { x: -0.2, y: 0, z: -0.2 }, { ate: 0.5 });
  assert.equal(r.eventos.length, 0);
  // (a ponta de baixo da cápsula é redonda: a bola no chão entra uns 4 cm embaixo dela, como na barreira)
  assert.ok(Math.hypot(r.bola.pos.x - j.x, r.bola.pos.z - j.z) >= j.raio + CONFIG.raioBola - 0.05, 'bola empurrada para fora do corpo');
  assert.ok(Number.isFinite(r.bola.pos.x + r.bola.pos.y + r.bola.pos.z));
  // Mesma bola, mesma montagem: mesmo resultado (o replay repete)
  const a = lancar(m(), de(0.1, 1.3), { x: 0.3, y: 1, z: 25 });
  const b = lancar(m(), de(0.1, 1.3), { x: 0.3, y: 1, z: 25 });
  assert.ok(a.eventos.length >= 1);
  assert.deepEqual(a.bola.pos, b.bola.pos);
  assert.deepEqual(a.eventos, b.eventos);
  // Sem figurantes, nada acontece
  const vazio = montar({ quantidade: 0 });
  assert.equal(colidirBolaFigurantes(criarBola({ x: 0, y: 1, z: 5 }), vazio.f, vazio.cfg), false);
});

// ---------- O chute que vai no gol nunca bate em figurante ----------

// Chuta de verdade (chutar + passo) e voa só contra os figurantes (que andam). Devolve onde cruzou a linha
// do gol e se bateu em alguém antes
function cobrar(m, { alvo, forca, contato, jogador }, comFigurantes = true) {
  const bola = criarBola({ x: m.bola.x, y: m.cfg.raioBola, z: m.bola.z });
  chutar(bola, { alvo: { x: alvo, z: 0 }, forca, contato, cobrador: jogador }, m.cfg, () => 0.5); // 0,5 = sem erro de mira
  for (let t = H; t < 4; t += H) {
    const antes = { ...bola.pos };
    if (comFigurantes) atualizarFigurantes(m.f, t);
    passo(bola, H, m.cfg);
    if (comFigurantes && colidirBolaFigurantes(bola, m.f, m.cfg)) return { bateu: m.f.ultimaBatida, t, pos: { ...bola.pos } };
    bola.eventos.length = 0;
    if (bola.pos.z <= 0) {
      const k = antes.z / (antes.z - bola.pos.z);
      return { x: antes.x + (bola.pos.x - antes.x) * k, y: antes.y + (bola.pos.y - antes.y) * k, t };
    }
    if (bola.vel.z > 0 || Math.hypot(bola.vel.x, bola.vel.z) < 0.5) return null;
  }
  return null;
}
// Acha a mira que faz a bola cruzar a linha em xFinal (método da secante, voando sem figurantes)
function mirarEm(m, xFinal, chute) {
  let a0 = xFinal;
  let r0 = cobrar(m, { ...chute, alvo: a0 }, false);
  if (!r0) return null;
  let a1 = a0 + (xFinal - r0.x);
  for (let i = 0; i < 14; i++) {
    const r1 = cobrar(m, { ...chute, alvo: a1 }, false);
    if (!r1) return null;
    const e1 = r1.x - xFinal;
    if (Math.abs(e1) < 0.03) return { alvo: a1, ...r1 };
    const e0 = r0.x - xFinal;
    const prox = Math.abs(e1 - e0) < 1e-6 ? a1 - e1 : a1 - (e1 * (a1 - a0)) / (e1 - e0);
    a0 = a1;
    r0 = r1;
    a1 = prox;
  }
  return null;
}

teste('chute bom no ângulo nunca bate em figurante: curva para os dois lados, de dentro e de fora do pé, fraco e forte, nos dois cantos', () => {
  // Os que mais curvam (CUR alta, destro e canhoto), um especialista em trivela e um de pancada
  const porNota = [...ELENCO].sort((a, b) => b.atributos.CUR - a.atributos.CUR);
  const cobradores = [porNota.find((j) => j.pe === 'D'), porNota.find((j) => j.pe === 'E'), ELENCO.find((j) => (j.especiais || []).includes('trivela')), ELENCO.find((j) => j.numero === 7)];
  const contatos = [[-0.95, 0], [0.95, 0], [-0.8, -0.5], [0.8, -0.5], [-0.6, 0.35], [0.6, 0.35], [0, 0], [0, -0.6], [-0.4, 0.1], [0.4, 0.1]];
  const forcas = [0.3, 0.45, 0.6, 0.8, 1];
  let chutes = 0;
  let noGol = 0;
  let menorFolga = Infinity;
  for (const caso of faltasSorteadas(COMPLETO ? 160 : 36, 0.5151)) {
    for (const quem of cobradores) {
      // A montagem é a do cobrador da vez (a corrida dele muda os lugares)
      const semente = caso.semente;
      const base = montar({ ...caso, jogador: quem, quantidade: 14 });
      const corredor = corredorDoChute(base.bola, base.cfg);
      for (const j of base.f.jogadores) menorFolga = Math.min(menorFolga, corredor.fora(j.x, j.z));
      for (const [cx, cy] of contatos) {
        for (const forca of forcas) {
          for (const lado of [-1, 1]) {
            const chute = { forca, contato: { x: cx, y: cy }, jogador: quem };
            // No ângulo (20 cm para dentro da trave) e, de quebra, no meio de cada metade do gol
            for (const xFinal of [lado * (MEIA - 0.2), lado * MEIA * 0.5]) {
              const mira = mirarEm(base, xFinal, chute);
              chutes++;
              if (!mira || mira.y > CONFIG.golAltura) continue; // não chega ou vai por cima: não é chute bom
              noGol++;
              const m = montar({ ...caso, jogador: quem, semente, quantidade: 14 });
              const r = cobrar(m, { ...chute, alvo: mira.alvo });
              assert.ok(r && !r.bateu, `${descrever({ ...caso, jogador: quem })}: chute bom (contato ${cx}/${cy}, força ${forca}, canto ${xFinal.toFixed(2)}) bateu no figurante `
                + `${r && r.bateu ? `#${r.bateu.jogador} ${m.f.jogadores[r.bateu.jogador].papel} em (${m.f.jogadores[r.bateu.jogador].x.toFixed(2)}, ${m.f.jogadores[r.bateu.jogador].z.toFixed(2)}) t=${r.t.toFixed(2)}` : ''}`);
              assert.ok(Math.abs(r.x - xFinal) < 0.1, 'os figurantes não mudaram o chute');
            }
          }
        }
      }
    }
  }
  console.log(`    ${chutes} chutes mirados, ${noGol} no gol, nenhum bateu em figurante (o mais perto do corredor fica ${menorFolga.toFixed(2)} m para fora da borda)`);
  assert.ok(noGol > chutes * 0.5);
});

teste('chute torto bate: mirando num figurante que está fora do corredor, a bola pega nele', () => {
  let bateram = 0;
  let tentados = 0;
  for (const caso of faltasSorteadas(30, 0.6161)) {
    const jogador = ELENCO.find((j) => j.numero === 8);
    const base = montar({ ...caso, jogador, quantidade: 10 });
    // O da sobra e os da área estão entre a bola e a linha de fundo: uma bola reta e rasteira neles chega
    base.f.jogadores.forEach((alvoJ, i) => {
      if (alvoJ.z > base.bola.z - 6) return;
      const m = montar({ ...caso, jogador, quantidade: 10, cfg: comQuantidade(10, { movimento: false }) });
      const j = m.f.jogadores[i];
      const bola = criarBola({ x: m.bola.x, y: 0.5, z: m.bola.z });
      const d = Math.hypot(j.x - m.bola.x, j.z - m.bola.z);
      bola.vel = { x: ((j.x - m.bola.x) / d) * 26, y: 3.2, z: ((j.z - m.bola.z) / d) * 26 };
      let bateu = false;
      for (let t = H; t < 2 && !bateu; t += H) {
        passo(bola, H, m.cfg);
        // (a barreira não entra aqui: é só a bola e os figurantes)
        if (colidirBolaFigurantes(bola, m.f, m.cfg) && bola.eventos.some((e) => e.tipo === 'jogador')) bateu = true;
      }
      tentados++;
      if (bateu) bateram++;
    });
  }
  console.log(`    ${bateram} de ${tentados} bolas miradas num figurante parado bateram em alguém`);
  assert.ok(tentados > 20 && bateram / tentados > 0.9);
});

// ---------- Custo ----------

teste('custo: montar é rápido e a colisão quase não pesa no passo da física', () => {
  const casos = [...faltasSorteadas(200, 0.3333)];
  for (const caso of casos.slice(0, 30)) montar({ ...caso, quantidade: 14 }); // aquece
  let t0 = performance.now();
  for (const caso of casos) montar({ ...caso, quantidade: 14 });
  const porMontagem = (performance.now() - t0) / casos.length;
  // Um voo inteiro (2 s = 480 passos) com 14 figurantes: quanto a mais custa por passo
  const m = montar({ distancia: 24, angulo: 8, semente: 0.2, quantidade: 14 });
  const voar = (comFigurantes) => {
    const inicio = performance.now();
    for (let k = 0; k < 200; k++) {
      const bola = criarBola({ x: m.bola.x, y: m.cfg.raioBola, z: m.bola.z });
      chutar(bola, { alvo: { x: 6, z: 0 }, forca: 0.7, contato: { x: 0.3, y: 0 } }, m.cfg, () => 0.5);
      for (let t = H; t < 2; t += H) {
        if (comFigurantes) atualizarFigurantes(m.f, t);
        passo(bola, H, m.cfg);
        if (comFigurantes) colidirBolaFigurantes(bola, m.f, m.cfg);
        bola.eventos.length = 0;
      }
    }
    return (performance.now() - inicio) / (200 * 480);
  };
  voar(true);
  const sem = voar(false);
  const com = voar(true);
  console.log(`    montar 14 figurantes: ${porMontagem.toFixed(2)} ms · passo da física: ${(sem * 1000).toFixed(2)} µs sem figurantes, ${(com * 1000).toFixed(2)} µs com (4 passos por quadro)`);
  assert.ok(porMontagem < 8, `montagem lenta: ${porMontagem.toFixed(2)} ms`);
  assert.ok(com - sem < 0.02, `colisão cara: ${((com - sem) * 1000).toFixed(2)} µs por passo`);
});

console.log('Todos os testes dos figurantes passaram.');
