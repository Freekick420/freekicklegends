// Faz o Node achar o 'three' na cópia local do harness (uso: node --import ./registrar.mjs script.mjs)
import { register } from 'node:module';
register('./resolver.mjs', import.meta.url);
