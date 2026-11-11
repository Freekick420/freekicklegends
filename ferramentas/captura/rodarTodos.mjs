#!/usr/bin/env node
// rodarTodos.mjs — roda vários roteiros, um depois do outro, cada um na sua pasta: <pasta>/<nome do roteiro>.
//
//   node rodarTodos.mjs <pasta de saída> [--raiz <pasta do jogo>] [--porta <n>] [--paralelo <n>] [--estrito] [roteiro.json ...]
//
// Sem lista de roteiros, roda todos os de roteiros/*.json (menos os que começam com "_").
// Exemplo:  node rodarTodos.mjs depois --raiz /caminho/do/jogo --porta 8770
// Grava <pasta>/resumo.json e o que cada roteiro escreveu na tela em <pasta>/<nome>.log.
// Termina com código 1 se algum roteiro falhar.

import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const USO = 'uso: node rodarTodos.mjs <pasta de saída> [--raiz <pasta do jogo>] [--porta <n>] [--paralelo <n>] [--estrito] [roteiro.json ...]';

function falhar(mensagem) {
  console.error(`FALHOU: ${mensagem}\n${USO}`);
  process.exit(1);
}

const op = { base: null, raiz: null, porta: 8765, paralelo: 1, estrito: false, roteiros: [] };
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => (i + 1 < argv.length ? argv[++i] : falhar(`falta o valor de ${a}`));
    if (a === '--raiz') op.raiz = valor();
    else if (a === '--porta') op.porta = Number(valor());
    else if (a === '--paralelo') op.paralelo = Number(valor());
    else if (a === '--estrito') op.estrito = true;
    else if (a === '--ajuda' || a === '--help' || a === '-h') {
      console.log(USO);
      process.exit(0);
    } else if (a.startsWith('-')) falhar(`opção desconhecida: ${a}`);
    else if (!op.base) op.base = a;
    else op.roteiros.push(a);
  }
}
if (!op.base) falhar('faltou a pasta de saída');
if (op.base.toLowerCase().endsWith('.json')) falhar(`o primeiro argumento é a pasta de saída, não um roteiro (veio ${op.base})`);
if (!Number.isInteger(op.porta) || op.porta < 1 || op.porta > 65535) falhar(`porta inválida: ${op.porta}`);
if (!Number.isInteger(op.paralelo) || op.paralelo < 1 || op.paralelo > 8) falhar(`--paralelo precisa ser um número de 1 a 8 (veio ${op.paralelo})`);

const base = path.resolve(HARNESS, op.base);
const roteiros = op.roteiros.length
  ? op.roteiros.map((r) => path.resolve(r))
  : readdirSync(path.join(HARNESS, 'roteiros')).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort().map((f) => path.join(HARNESS, 'roteiros', f));
if (!roteiros.length) falhar('nenhum roteiro para rodar');
const nomeDe = (roteiro) => path.basename(roteiro).replace(/\.json$/i, '');
{
  const nomes = roteiros.map(nomeDe);
  const repetido = nomes.find((n, i) => nomes.indexOf(n) !== i);
  if (repetido) falhar(`dois roteiros com o mesmo nome (${repetido}) iriam para a mesma pasta`);
}
mkdirSync(base, { recursive: true });

// Roda um roteiro numa porta e devolve o resumo dele
function rodar(roteiro, porta) {
  return new Promise((resolver) => {
    const nome = nomeDe(roteiro);
    const saida = path.join(base, nome);
    const argumentos = [path.join(HARNESS, 'captura.mjs'), roteiro, '--saida', saida, '--porta', String(porta)];
    if (op.raiz) argumentos.push('--raiz', op.raiz);
    if (op.estrito) argumentos.push('--estrito');
    const inicio = Date.now();
    const filho = spawn(process.execPath, argumentos, { stdio: ['ignore', 'pipe', 'pipe'] });
    let fala = '';
    filho.stdout.on('data', (d) => { fala += d; });
    filho.stderr.on('data', (d) => { fala += d; });
    filho.on('close', (codigo) => {
      const segundos = Number(((Date.now() - inicio) / 1000).toFixed(1));
      writeFileSync(path.join(base, `${nome}.log`), fala);
      let r = null;
      try {
        r = JSON.parse(readFileSync(path.join(saida, 'resultado.json'), 'utf8'));
      } catch {
        // falhou antes de gravar o resultado
      }
      const linhas = fala.trim().split('\n');
      const erro = codigo === 0 ? null : (r && r.erro) || linhas.filter((l) => l.startsWith('FALHOU')).pop() || linhas.pop() || `código ${codigo}`;
      resolver({
        roteiro: nome, ok: codigo === 0, segundos, porta, saida,
        fotos: r ? r.fotos.length : 0,
        fotosSuspeitas: r ? r.fotosSuspeitas : [],
        consoleErros: r ? r.consoleErros.length : 0,
        falhasRede: r ? r.falhasRede.length : 0,
        versaoDoJogo: r ? r.versaoDoJogo : null,
        erro,
      });
    });
  });
}

const inicioGeral = Date.now();
const resumos = new Array(roteiros.length);
let proximo = 0;
async function trabalhador(indice) {
  const porta = op.porta + indice; // cada fila usa a sua porta
  while (proximo < roteiros.length) {
    const n = proximo++;
    const r = await rodar(roteiros[n], porta);
    resumos[n] = r;
    const avisos = [
      r.fotosSuspeitas.length ? `${r.fotosSuspeitas.length} foto(s) suspeita(s)` : '',
      r.consoleErros ? `${r.consoleErros} console.error` : '',
    ].filter(Boolean).join(', ');
    console.log(`${r.ok ? 'ok    ' : 'FALHOU'} ${r.roteiro.padEnd(36)} ${String(r.segundos).padStart(6)} s  ${String(r.fotos).padStart(3)} fotos${avisos ? `  (${avisos})` : ''}${r.ok ? '' : `\n       ${String(r.erro).split('\n')[0]}`}`);
  }
}
console.log(`${roteiros.length} roteiro(s) → ${base}${op.raiz ? `  (raiz ${path.resolve(op.raiz)})` : ''}`);
await Promise.all(Array.from({ length: Math.min(op.paralelo, roteiros.length) }, (_, i) => trabalhador(i)));

const total = Number(((Date.now() - inicioGeral) / 1000).toFixed(1));
const falharam = resumos.filter((r) => !r.ok);
writeFileSync(path.join(base, 'resumo.json'), `${JSON.stringify({ ok: falharam.length === 0, segundos: total, raiz: op.raiz ? path.resolve(op.raiz) : null, roteiros: resumos }, null, 2)}\n`);
console.log(`${falharam.length ? `FALHOU: ${falharam.length} de ${resumos.length} roteiro(s)` : `OK: ${resumos.length} roteiro(s)`}, ${resumos.reduce((s, r) => s + r.fotos, 0)} fotos, ${total} s reais. Resumo em ${path.join(base, 'resumo.json')}`);
process.exit(falharam.length ? 1 : 0);
