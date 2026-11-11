// Carregador para os testes de Node que usam os bonecos (js/jogadores.js e js/cobranca.js importam 'three',
// que no jogo vem do import map do index.html). Aqui o 'three' vira um arquivo local e o "?v=N" dos imports
// some (senão o Node carregaria o mesmo módulo duas vezes, um para cada endereço).
//
// Onde o three.module.js é procurado, nesta ordem:
//   1. a variável de ambiente FKL_THREE (caminho do three.module.js);
//   2. node_modules/three/build/three.module.js, na raiz do projeto ou acima (npm i --no-save three@0.160.0);
//   3. testes/vendor/three.module.js (fora do git; copie para lá se preferir).
// O teste registra este carregador sozinho (module.register): basta `node testes/cobranca.mjs`.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export function acharThree() {
  const candidatos = [];
  if (process.env.FKL_THREE) candidatos.push(process.env.FKL_THREE);
  for (let pasta = path.resolve(AQUI, '..'), i = 0; i < 6; i++, pasta = path.dirname(pasta)) {
    candidatos.push(path.join(pasta, 'node_modules', 'three', 'build', 'three.module.js'));
  }
  candidatos.push(path.join(AQUI, 'vendor', 'three.module.js'));
  return candidatos.find((c) => existsSync(c)) || null;
}

const three = acharThree();

export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'three') {
    if (!three) throw new Error('three.module.js não encontrado (veja testes/carregador-three.mjs)');
    return { url: pathToFileURL(three).href, shortCircuit: true };
  }
  if (/^\.{1,2}\//.test(especificador)) especificador = especificador.replace(/\?v=\d+$/, '');
  return proximo(especificador, contexto);
}
