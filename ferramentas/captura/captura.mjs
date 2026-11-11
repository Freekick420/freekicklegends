#!/usr/bin/env node
// captura.mjs — harness de captura de tela do Free Kick Legends (Playwright + Chromium sem tela).
//
//   node captura.mjs <roteiro.json> [--raiz <pasta do jogo>] [--porta <n>] [--saida <pasta>] [--estrito]
//
// Sobe um http-server só para esta execução (na porta e na raiz pedidas), abre a página do roteiro,
// serve o Three.js de uma cópia local (o CDN não abre aqui), executa os passos e grava as fotos,
// resultado.json e console.txt na pasta de saída. Formato do roteiro e armadilhas: README.md.
//
// Ideia central: os quadros da página (requestAnimationFrame) ficam RETIDOS entre um passo e outro.
// O jogo só anda dentro dos passos "esperar...", e para exatamente no quadro em que a espera terminou.
// Com ?teste (cada quadro = 1/60 s de jogo) as capturas saem iguais a cada execução, por mais lento
// que o navegador esteja.

import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import http from 'node:http';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analisarPng } from './verificarPng.mjs';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PADRAO = '/home/user/freekicklegends';
const PORTA_PADRAO = 8765;
const PLAYWRIGHT = process.env.CAPTURA_PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs';
const NAVEGADORES = '/opt/pw-browsers';
const THREE_LOCAL = path.join(HARNESS, 'vendor', 'three-0.160.0', 'package');
const THREE_MODULO = /\/three@0\.160\.0\/build\/three\.module\.js$/;
const THREE_ADDONS = /\/three@0\.160\.0\/examples\/jsm\/(.+)$/;

// WebGL por software (SwiftShader, pelo ANGLE) e nada de proxy: tudo o que o navegador pede é local.
// --disable-gpu-rasterization: o HTML por cima do jogo (HUD) é pintado pela CPU. Com a pintura pela "placa de
// vídeo" de mentira, a mesma tela parada saía de vez em quando com as sombras dos botões 1 a 3 níveis de cor
// diferentes (na escala 2), e as fotos deixavam de ser idênticas entre uma execução e outra.
// CAPTURA_RASTER_GPU=1 (variável de ambiente) volta à pintura antiga do HUD, para comparar com fotos tiradas
// antes dessa troca (as bordas das letras e dos botões do HUD mudam de uma pintura para a outra).
// CAPTURA_CHROMIUM_ARGS (variável de ambiente, separada por espaços) acrescenta argumentos para experiências.
const ARGUMENTOS_CHROMIUM = [
  '--no-proxy-server',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
  ...(process.env.CAPTURA_RASTER_GPU === '1' ? [] : ['--disable-gpu-rasterization']),
  ...(process.env.CAPTURA_CHROMIUM_ARGS || '').split(/\s+/).filter(Boolean),
];

const PERFIS = {
  celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  computador: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

// Limite em tempo real das esperas: o navegador sem placa de vídeo roda uns 5 a 20 quadros por segundo
const LIMITE_REAL_MINIMO = 180;        // s
const REAL_POR_SEGUNDO_DE_JOGO = 60;   // s reais para cada segundo de jogo pedido
const LIMITE_ATE_PADRAO = 10;          // s de jogo de um esperarAte sem limiteSegundos

// Cada passo tem exatamente uma destas chaves (e, se quiser, as chaves extras da lista)
const TIPOS = {
  esperarJogo: [],
  esperarSegundos: [],
  esperarQuadros: [],
  esperarAte: ['limiteSegundos'],
  esperarReal: [],
  esperarSeletor: [],
  foto: ['recorte', 'seletor', 'paginaInteira'],
  js: [],
  avaliar: ['guardar'],
  clicar: [],
  tamanho: [],
  abrir: [],
};
const EXTRAS_GERAIS = ['nota', 'limiteReal'];

class Falha extends Error {}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const cronometro = () => {
  const t0 = performance.now();
  return () => Math.round(performance.now() - t0);
};
const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);
// A primeira linha de um erro do Playwright, sem o prefixo "page.evaluate: " nem a pilha
const primeiraLinha = (e) => String(e && e.message ? e.message : e).split('\n')[0].replace(/^\w+\.\w+: /, '');
const curto = (texto, n = 160) => {
  const s = String(texto).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

// ---------- Linha de comando e roteiro ----------

const USO = `uso: node captura.mjs <roteiro.json> [--raiz <pasta do jogo>] [--porta <n>] [--saida <pasta>] [--estrito]
  --raiz    pasta servida pelo http-server (padrão ${RAIZ_PADRAO})
  --porta   porta do http-server desta execução (padrão ${PORTA_PADRAO}); se estiver ocupada, o script para
  --saida   pasta das fotos (padrão: o campo "saida" do roteiro); relativa = dentro da pasta do harness
  --estrito foto suspeita (tela preta, imagem lisa) também faz o script terminar com código 1`;

function lerArgumentos(argv) {
  const op = { roteiro: null, raiz: RAIZ_PADRAO, porta: PORTA_PADRAO, saida: null, estrito: false, ajuda: false };
  for (let i = 0; i < argv.length; i++) {
    let nome = argv[i];
    let colado;
    if (nome.startsWith('--') && nome.includes('=')) {
      colado = nome.slice(nome.indexOf('=') + 1);
      nome = nome.slice(0, nome.indexOf('='));
    }
    const valor = () => {
      if (colado !== undefined) return colado;
      if (i + 1 >= argv.length) throw new Falha(`falta o valor de ${nome}\n${USO}`);
      return argv[++i];
    };
    if (nome === '--raiz') op.raiz = valor();
    else if (nome === '--porta') op.porta = Number(valor());
    else if (nome === '--saida') op.saida = valor();
    else if (nome === '--estrito') op.estrito = true;
    else if (nome === '--ajuda' || nome === '--help' || nome === '-h') op.ajuda = true;
    else if (nome.startsWith('-')) throw new Falha(`opção desconhecida: ${nome}\n${USO}`);
    else if (!op.roteiro) op.roteiro = nome;
    else throw new Falha(`argumento a mais: ${nome}\n${USO}`);
  }
  if (op.ajuda) return op;
  if (!op.roteiro) throw new Falha(`faltou o roteiro\n${USO}`);
  if (!Number.isInteger(op.porta) || op.porta < 1 || op.porta > 65535) throw new Falha(`porta inválida: ${op.porta}`);
  op.roteiro = path.resolve(op.roteiro);
  op.raiz = path.resolve(op.raiz);
  return op;
}

// Troca {{i}} e {{v}} em todos os textos de um pedaço do roteiro
function trocar(valor, variaveis) {
  if (typeof valor === 'string') return valor.replace(/\{\{(\w+)\}\}/g, (tudo, nome) => (nome in variaveis ? variaveis[nome] : tudo));
  if (Array.isArray(valor)) return valor.map((v) => trocar(v, variaveis));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, trocar(v, variaveis)]));
  return valor;
}

// { "repetir": 14, "passos": [...] } ou { "repetir": [1, 3, 7], "passos": [...] } vira a lista de passos
// repetida, com {{i}} = 00, 01, 02... (ou a partir de "inicio") e {{v}} = o valor da vez
function expandir(passos, onde = 'passos') {
  if (!Array.isArray(passos)) throw new Falha(`${onde}: esperava uma lista de passos`);
  const lista = [];
  passos.forEach((p, n) => {
    if (p && typeof p === 'object' && !Array.isArray(p) && 'repetir' in p) {
      const outras = Object.keys(p).filter((k) => !['repetir', 'passos', 'inicio', 'nota'].includes(k));
      if (outras.length) throw new Falha(`${onde}[${n}]: "repetir" só aceita "passos", "inicio" e "nota" (achei ${outras.join(', ')})`);
      const primeiro = p.inicio ?? 0;
      if (!Number.isInteger(primeiro) || primeiro < 0) throw new Falha(`${onde}[${n}]: "inicio" precisa ser um número inteiro (o primeiro {{i}})`);
      const vezes = Array.isArray(p.repetir) ? p.repetir : Number.isInteger(p.repetir) && p.repetir >= 0 ? Array.from({ length: p.repetir }, (_, i) => i) : null;
      if (!vezes) throw new Falha(`${onde}[${n}]: "repetir" precisa de um número inteiro de vezes ou de uma lista de valores`);
      if (!Array.isArray(p.passos)) throw new Falha(`${onde}[${n}]: "repetir" precisa de "passos"`);
      if (p.passos.some((q) => q && typeof q === 'object' && 'repetir' in q)) throw new Falha(`${onde}[${n}]: "repetir" dentro de "repetir" não é suportado`);
      vezes.forEach((v, i) => {
        const variaveis = { i: String(i + primeiro).padStart(2, '0'), v: typeof v === 'string' ? v : JSON.stringify(v) };
        lista.push(...p.passos.map((q) => trocar(q, variaveis)));
      });
    } else {
      lista.push(p);
    }
  });
  return lista;
}

function validarPasso(p, n) {
  const onde = `passo ${n + 1}`;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Falha(`${onde}: esperava um objeto, veio ${JSON.stringify(p)}`);
  const tipos = Object.keys(p).filter((k) => k in TIPOS);
  if (tipos.length !== 1) {
    throw new Falha(`${onde}: cada passo tem exatamente uma destas chaves: ${Object.keys(TIPOS).join(', ')} (veio ${JSON.stringify(p)})`);
  }
  const tipo = tipos[0];
  const permitidas = [tipo, ...TIPOS[tipo], ...EXTRAS_GERAIS];
  const estranhas = Object.keys(p).filter((k) => !permitidas.includes(k));
  if (estranhas.length) throw new Falha(`${onde} (${tipo}): chave desconhecida ${estranhas.map((k) => `"${k}"`).join(', ')}; aceitas: ${permitidas.join(', ')}`);
  const v = p[tipo];
  const texto = (x) => typeof x === 'string' && x.trim() !== '';
  const erro = (m) => new Falha(`${onde} (${tipo}): ${m}`);
  if (tipo === 'esperarJogo' && v !== true) throw erro('use { "esperarJogo": true }');
  if (['esperarSegundos', 'esperarReal'].includes(tipo) && !(ehNumero(v) && v >= 0)) throw erro('precisa de um número maior ou igual a zero');
  if (tipo === 'esperarQuadros' && !(Number.isInteger(v) && v >= 1)) throw erro('precisa de um número inteiro de quadros (1 ou mais)');
  if (['esperarAte', 'esperarSeletor', 'js', 'avaliar', 'clicar', 'abrir'].includes(tipo) && !texto(v)) throw erro('precisa de um texto');
  if (tipo === 'esperarAte' && 'limiteSegundos' in p && !(ehNumero(p.limiteSegundos) && p.limiteSegundos > 0)) throw erro('"limiteSegundos" precisa ser um número maior que zero');
  if (tipo === 'avaliar' && !texto(p.guardar)) throw erro('precisa de "guardar": o nome com que o resultado entra em resultado.json');
  if (tipo === 'tamanho' && !(v && Number.isInteger(v.largura) && Number.isInteger(v.altura) && v.largura > 0 && v.altura > 0)) throw erro('use { "tamanho": { "largura": 1280, "altura": 720 } }');
  if (tipo === 'foto') {
    if (!texto(v) || !/^[\p{L}\p{N}._-]+$/u.test(v)) throw erro(`nome de foto inválido: ${JSON.stringify(v)} (use letras, números, ponto, hífen e sublinhado)`);
    if ('recorte' in p) {
      const r = p.recorte;
      if (!(r && [r.x, r.y, r.largura, r.altura].every(ehNumero) && r.largura > 0 && r.altura > 0)) throw erro('"recorte" precisa de { x, y, largura, altura } em pixels CSS');
    }
    if ('seletor' in p && !texto(p.seletor)) throw erro('"seletor" precisa de um seletor CSS');
    if ('paginaInteira' in p && typeof p.paginaInteira !== 'boolean') throw erro('"paginaInteira" é true ou false');
    if (p.paginaInteira && (p.recorte || p.seletor)) throw erro('"paginaInteira" não combina com "recorte" nem com "seletor"');
  }
  if ('limiteReal' in p && !(ehNumero(p.limiteReal) && p.limiteReal > 0)) throw new Falha(`${onde}: "limiteReal" (segundos reais) precisa ser um número maior que zero`);
  return tipo;
}

function carregarRoteiro(caminho) {
  let texto;
  try {
    texto = readFileSync(caminho, 'utf8');
  } catch (e) {
    throw new Falha(`não consegui ler o roteiro ${caminho}: ${e.message}`);
  }
  let r;
  try {
    r = JSON.parse(texto);
  } catch (e) {
    throw new Falha(`o roteiro ${caminho} não é um JSON válido: ${e.message}`);
  }
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Falha('o roteiro precisa ser um objeto JSON com "passos"');
  const conhecidas = ['perfil', 'escala', 'url', 'saida', 'passos', 'congelar', 'descricao'];
  const estranhas = Object.keys(r).filter((k) => !conhecidas.includes(k));
  if (estranhas.length) throw new Falha(`roteiro: chave desconhecida ${estranhas.map((k) => `"${k}"`).join(', ')}; aceitas: ${conhecidas.join(', ')}`);
  const perfil = r.perfil ?? 'celular';
  if (!(perfil in PERFIS)) throw new Falha(`roteiro: perfil desconhecido "${perfil}" (use ${Object.keys(PERFIS).join(' ou ')})`);
  if ('escala' in r && !(ehNumero(r.escala) && r.escala > 0 && r.escala <= 4)) throw new Falha('roteiro: "escala" precisa ser um número entre 0 e 4');
  if ('url' in r && typeof r.url !== 'string') throw new Falha('roteiro: "url" precisa ser um texto');
  if ('saida' in r && typeof r.saida !== 'string') throw new Falha('roteiro: "saida" precisa ser um texto');
  if ('congelar' in r && typeof r.congelar !== 'boolean') throw new Falha('roteiro: "congelar" é true ou false');
  const passos = expandir(r.passos);
  if (!passos.length) throw new Falha('roteiro: nenhum passo');
  const tipos = passos.map(validarPasso);
  const nomes = new Set();
  passos.forEach((p, n) => {
    if (!('foto' in p)) return;
    const chave = p.foto.toLowerCase();
    if (nomes.has(chave)) throw new Falha(`passo ${n + 1} (foto): já existe outra foto chamada "${p.foto}" neste roteiro`);
    if (['falha'].includes(chave)) throw new Falha(`passo ${n + 1} (foto): o nome "${p.foto}" é reservado`);
    nomes.add(chave);
  });
  return {
    perfil,
    escala: r.escala ?? PERFIS[perfil].deviceScaleFactor,
    url: r.url ?? 'index.html?teste',
    saida: r.saida ?? path.join('capturas', path.basename(caminho).replace(/\.json$/i, '')),
    congelar: r.congelar ?? true,
    passos,
    tipos,
  };
}

// De que versão do jogo são estas fotos: o commit da pasta raiz e se há arquivos mexidos depois dele.
// Só leitura (--no-optional-locks: o git não escreve nada na pasta). null se a raiz não for um repositório.
function versaoDaRaiz(raiz) {
  const git = (...argumentos) => execFileSync('git', ['--no-optional-locks', '-C', raiz, ...argumentos], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }).trim();
  try {
    const mexidos = git('status', '--porcelain').split('\n').filter(Boolean);
    return { commit: git('rev-parse', '--short', 'HEAD'), assunto: git('log', '-1', '--format=%s'), arquivosAlterados: mexidos.length };
  } catch {
    return null;
  }
}

// ---------- Servidor (um http-server só para esta execução) ----------

function portaLivre(porta) {
  return new Promise((resolver) => {
    const s = createServer();
    s.once('error', () => resolver(false));
    s.listen({ port: porta, host: '127.0.0.1', exclusive: true }, () => s.close(() => resolver(true)));
  });
}

// Pede um arquivo direto ao servidor (sem proxy). Devolve { status, corpo } ou null se ninguém atendeu
function pedir(porta, caminho) {
  return new Promise((resolver) => {
    const pedido = http.get({ host: '127.0.0.1', port: porta, path: caminho, agent: false, timeout: 5000 }, (resposta) => {
      const pedacos = [];
      resposta.on('data', (d) => pedacos.push(d));
      resposta.on('end', () => resolver({ status: resposta.statusCode, corpo: Buffer.concat(pedacos) }));
      resposta.on('error', () => resolver(null));
    });
    pedido.on('timeout', () => pedido.destroy());
    pedido.on('error', () => resolver(null));
  });
}

function comandoHttpServer() {
  const candidatos = [
    process.env.CAPTURA_HTTP_SERVER,
    '/opt/node22/lib/node_modules/http-server/bin/http-server',
    '/opt/node-tools/node_modules/http-server/bin/http-server',
  ];
  for (const c of candidatos) if (c && existsSync(c)) return { comando: process.execPath, argumentos: [c] };
  return { comando: 'http-server', argumentos: [] }; // o que estiver no PATH
}

// O arquivo da raiz que uma url do roteiro abre (para conferir que existe e, depois, que o servidor serve este mesmo)
function arquivoDaUrl(raiz, caminhoUrl) {
  let relativo = decodeURIComponent(caminhoUrl.replace(/^\/+/, ''));
  if (relativo === '' || relativo.endsWith('/')) relativo += 'index.html';
  const noDisco = path.join(raiz, relativo);
  if (!noDisco.startsWith(raiz + path.sep)) throw new Falha(`a url sai da pasta raiz: ${caminhoUrl}`);
  return noDisco;
}

// Conferências baratas, feitas antes de apagar ou criar qualquer coisa
async function conferirAntes(raiz, porta, caminhoUrl) {
  let ehPasta = false;
  try {
    ehPasta = statSync(raiz).isDirectory();
  } catch {
    // não existe
  }
  if (!ehPasta) throw new Falha(`a pasta raiz não existe: ${raiz}`);
  const pagina = arquivoDaUrl(raiz, caminhoUrl);
  if (!existsSync(pagina)) throw new Falha(`a página do roteiro não existe na raiz: ${pagina}`);
  if (!existsSync(path.join(THREE_LOCAL, 'build', 'three.module.js'))) {
    throw new Falha(`falta a cópia local do Three.js em ${THREE_LOCAL} (veja o README: npm pack three@0.160.0)`);
  }
  if (!(await portaLivre(porta))) {
    throw new Falha(`a porta ${porta} já está ocupada por outro processo. Escolha outra com --porta (este script nunca reaproveita um servidor que já esteja de pé).`);
  }
}

async function subirServidor(raiz, porta) {
  const { comando, argumentos } = comandoHttpServer();
  const filho = spawn(comando, [...argumentos, raiz, '-a', '127.0.0.1', '-p', String(porta), '-c-1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let fala = '';
  const ouvir = (d) => { fala = (fala + d).slice(-3000); };
  filho.stdout.on('data', ouvir);
  filho.stderr.on('data', ouvir);
  let fim = null;
  filho.once('exit', (codigo, sinal) => { fim = fim || `terminou com ${sinal || `código ${codigo}`}`; });
  filho.once('error', (e) => { fim = fim || `não consegui executar o http-server: ${e.message}`; });
  const parar = () => { if (filho.exitCode === null && !filho.killed) filho.kill('SIGTERM'); };
  const inicio = Date.now();
  for (;;) {
    if (fim) throw new Falha(`o http-server não ficou de pé na porta ${porta} (${fim}).\n${fala.trim()}`);
    if (await pedir(porta, '/')) break;
    if (Date.now() - inicio > 20000) {
      parar();
      throw new Falha(`o http-server não respondeu na porta ${porta} em 20 s.\n${fala.trim()}`);
    }
    await dormir(100);
  }
  return { parar, vivo: () => !fim, fala: () => fala };
}

// Garante que quem responde nesta porta é o NOSSO servidor, servindo a raiz pedida: o arquivo que chega
// pela rede tem de ser igual, byte a byte, ao que está no disco
async function conferirServidor(servidor, raiz, porta, caminhoUrl) {
  const noDisco = arquivoDaUrl(raiz, caminhoUrl);
  let esperado;
  try {
    esperado = readFileSync(noDisco);
  } catch {
    throw new Falha(`a página do roteiro não existe na raiz: ${noDisco}`);
  }
  const r = await pedir(porta, caminhoUrl);
  if (!servidor.vivo()) throw new Falha(`o http-server da porta ${porta} morreu logo depois de subir.\n${servidor.fala().trim()}`);
  if (!r || r.status !== 200 || !r.corpo.equals(esperado)) {
    throw new Falha(`o servidor da porta ${porta} não está servindo ${noDisco} (resposta ${r ? r.status : 'nenhuma'}): a porta pode estar com outro servidor ou outra raiz.`);
  }
}

// ---------- Navegador ----------

// O chromium que existir em /opt/pw-browsers (para quando a versão do Playwright não acha o dela)
function acharChromium(pasta) {
  let itens = [];
  try {
    itens = readdirSync(pasta).sort().reverse();
  } catch {
    return null;
  }
  const candidatos = [];
  for (const item of itens) {
    if (item.startsWith('chromium_headless_shell-')) candidatos.push(path.join(pasta, item, 'chrome-headless-shell-linux64', 'chrome-headless-shell'), path.join(pasta, item, 'chrome-linux', 'headless_shell'));
  }
  for (const item of itens) {
    if (item.startsWith('chromium-')) candidatos.push(path.join(pasta, item, 'chrome-linux64', 'chrome'), path.join(pasta, item, 'chrome-linux', 'chrome'));
  }
  candidatos.push(path.join(pasta, 'chromium'));
  return candidatos.find((c) => existsSync(c)) || null;
}

async function abrirNavegador() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = NAVEGADORES;
  let chromium;
  try {
    ({ chromium } = await import(PLAYWRIGHT));
  } catch (e) {
    throw new Falha(`não consegui carregar o Playwright de ${PLAYWRIGHT}: ${e.message}`);
  }
  const opcoes = { headless: true, args: ARGUMENTOS_CHROMIUM };
  try {
    return await chromium.launch(opcoes);
  } catch (e) {
    if (!/Executable doesn't exist|browserType\.launch: Failed to launch|ENOENT/i.test(String(e.message))) throw e;
    const executavel = acharChromium(process.env.PLAYWRIGHT_BROWSERS_PATH) || acharChromium(NAVEGADORES);
    if (!executavel) throw new Falha(`o Playwright não achou o navegador e não há chromium em ${NAVEGADORES} (NÃO rode "playwright install").\n${e.message}`);
    console.log(`aviso: o Playwright não achou o navegador dele; usando ${executavel}`);
    return await chromium.launch({ ...opcoes, executablePath: executavel });
  }
}

// Roda DENTRO da página, antes de qualquer script dela. Troca o requestAnimationFrame por uma fila que o
// harness segura e solta: com a página "pausada" os quadros pedidos ficam guardados e nada anda.
function instalarNaPagina({ congelar }) {
  if (window.__captura) return;
  const rafReal = window.requestAnimationFrame.bind(window);
  const MEIO_QUADRO = 1 / 120;
  const pendentes = new Map();
  const cancelados = new Set();
  let numero = 0;
  let agendado = false;
  let espera = null;
  const C = { pausado: Boolean(congelar), quadros: 0 };
  const relatar = (e) => {
    if (typeof window.reportError === 'function') window.reportError(e);
    else setTimeout(() => { throw e; });
  };
  const tempo = () => (typeof window.tempoDeJogo === 'number' && Number.isFinite(window.tempoDeJogo) ? window.tempoDeJogo : null);

  function agendar() {
    if (agendado || C.pausado || pendentes.size === 0) return;
    agendado = true;
    rafReal(tique);
  }
  // Um quadro da página: roda o que ela pediu, confere a espera em curso e pede o próximo
  function tique(agora) {
    agendado = false;
    if (C.pausado) return;
    const lote = Array.from(pendentes);
    pendentes.clear();
    cancelados.clear();
    for (const [id, funcao] of lote) {
      if (cancelados.has(id)) continue; // cancelado por outra função deste mesmo quadro
      try {
        funcao(agora);
      } catch (e) {
        relatar(e);
      }
    }
    C.quadros++;
    if (espera) espera.conferir();
    agendar();
  }
  window.requestAnimationFrame = (funcao) => {
    const id = ++numero;
    pendentes.set(id, funcao);
    agendar();
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pendentes.delete(id);
    cancelados.add(id);
  };

  C.pausar = () => { if (congelar) C.pausado = true; };
  C.continuar = () => {
    C.pausado = false;
    agendar();
  };
  C.estado = () => ({ pausado: C.pausado, quadros: C.quadros, pendentes: pendentes.size, tempoDeJogo: tempo() });
  // Dois quadros de verdade do navegador, sem rodar os da página: dá tempo de a tela ser composta
  C.assentar = () => new Promise((resolver) => rafReal(() => rafReal(() => resolver(C.estado()))));
  C.cancelar = () => { if (espera) espera.encerrar({ ok: false, motivo: 'cancelada' }); };
  // Solta os quadros até a condição valer e pausa de novo exatamente nesse quadro.
  //   { tipo: 'quadros', quadros }   n quadros da página
  //   { tipo: 'segundos', segundos } tempo de jogo (window.tempoDeJogo), arredondado para o quadro mais próximo;
  //                                  em página sem tempoDeJogo, tempo real
  //   { tipo: 'jogo' }               window.jogoTeste existe e o primeiro quadro foi desenhado
  //   { tipo: 'ate', expr, limiteJogo } expressão verdadeira; desiste depois de limiteJogo segundos de jogo
  C.esperar = (o) => new Promise((resolver) => {
    if (espera) espera.encerrar({ ok: false, motivo: 'substituída por outra espera' });
    const t0 = tempo();
    const q0 = C.quadros;
    const r0 = performance.now();
    let teste = null;
    if (o.tipo === 'ate') {
      try {
        teste = new Function(`return (${o.expr}\n);`);
      } catch (e) {
        resolver({ ok: false, motivo: `a expressão não é JavaScript válido: ${e.message}` });
        return;
      }
    }
    let batida = 0;
    const esta = {
      conferir() {
        const t = tempo();
        const jogo = t !== null && t0 !== null ? t - t0 : null;
        let pronto = false;
        try {
          if (o.tipo === 'quadros') pronto = C.quadros - q0 >= o.quadros;
          else if (o.tipo === 'segundos') pronto = jogo !== null ? jogo >= o.segundos - MEIO_QUADRO : performance.now() - r0 >= o.segundos * 1000;
          else if (o.tipo === 'jogo') pronto = Boolean(window.jogoTeste) && t !== null && t > 0;
          else if (o.tipo === 'ate') pronto = Boolean(teste());
        } catch (e) {
          esta.encerrar({ ok: false, motivo: `a expressão deu erro: ${e && e.message ? e.message : e}` });
          return;
        }
        if (pronto) esta.encerrar({ ok: true });
        else if (o.limiteJogo != null && jogo !== null && jogo > o.limiteJogo + 1e-9) esta.encerrar({ ok: false, motivo: 'limite' });
      },
      encerrar(resultado) {
        if (espera !== esta) return;
        espera = null;
        clearInterval(batida);
        C.pausar();
        const t = tempo();
        resolver({
          ...resultado, quadros: C.quadros - q0, tempoDeJogo: t,
          segundosDeJogo: t !== null && t0 !== null ? t - t0 : null, ms: Math.round(performance.now() - r0),
        });
      },
    };
    espera = esta;
    esta.conferir(); // pode já estar valendo, sem andar nenhum quadro
    if (espera !== esta) return;
    // Além de conferir depois de cada quadro, confere de tempos em tempos (página sem quadros, coisas assíncronas)
    batida = setInterval(() => esta.conferir(), 50);
    C.continuar();
  });
  window.__captura = C;
}

// ---------- Execução ----------

async function principal() {
  const op = lerArgumentos(process.argv.slice(2));
  if (op.ajuda) {
    console.log(USO);
    return 0;
  }
  const roteiro = carregarRoteiro(op.roteiro);
  const saida = path.resolve(HARNESS, op.saida ?? roteiro.saida);
  const origem = `http://127.0.0.1:${op.porta}`;
  const enderecoDe = (url) => {
    const u = new URL(url, `${origem}/`);
    if (u.origin !== origem) throw new Falha(`a url precisa ser um caminho dentro da raiz do jogo (veio ${url})`);
    return u;
  };
  const primeira = enderecoDe(roteiro.url);
  console.log(`roteiro  ${op.roteiro}`);
  console.log(`saída    ${saida}`);
  console.log(`página   ${primeira.href}  (raiz ${op.raiz}, perfil ${roteiro.perfil}, escala ${roteiro.escala})`);
  await conferirAntes(op.raiz, op.porta, primeira.pathname);

  // Pasta de saída: tira o que a execução anterior deixou lá (só o que ela mesma listou)
  await mkdir(saida, { recursive: true });
  try {
    const anterior = JSON.parse(readFileSync(path.join(saida, 'resultado.json'), 'utf8'));
    for (const f of anterior.fotos || []) if (f && typeof f.arquivo === 'string' && /^[^/\\]+\.png$/.test(f.arquivo)) rmSync(path.join(saida, f.arquivo), { force: true });
  } catch {
    // primeira vez nesta pasta
  }
  for (const nome of ['resultado.json', 'console.txt', 'falha.png']) rmSync(path.join(saida, nome), { force: true });

  const inicio = new Date();
  const relogio = cronometro();
  const resultado = {
    ok: false, erro: null,
    roteiro: op.roteiro, url: primeira.href, raiz: op.raiz, raizGit: versaoDaRaiz(op.raiz), porta: op.porta, saida,
    perfil: roteiro.perfil, escala: roteiro.escala,
    tela: { largura: PERFIS[roteiro.perfil].viewport.width, altura: PERFIS[roteiro.perfil].viewport.height },
    congelar: roteiro.congelar,
    versaoDoJogo: null, navegador: null, navegadorArgumentos: ARGUMENTOS_CHROMIUM, webgl: null,
    inicio: inicio.toISOString(), segundosReais: 0, quadros: 0, quadrosPorSegundo: null,
    passos: [], fotos: [], fotosSuspeitas: [], guardados: {}, consoleErros: [], falhasRede: [],
  };
  const linhasConsole = [];
  const registrarConsole = (linha) => {
    if (linhasConsole.length < 20000) linhasConsole.push(linha);
    else if (linhasConsole.length === 20000) linhasConsole.push('… (console cortado em 20000 linhas)');
  };
  const gravar = () => {
    resultado.segundosReais = Number((relogio() / 1000).toFixed(1));
    writeFileSync(path.join(saida, 'resultado.json'), `${JSON.stringify(resultado, null, 2)}\n`);
    writeFileSync(path.join(saida, 'console.txt'), linhasConsole.length ? `${linhasConsole.join('\n')}\n` : '');
  };

  let servidor = null;
  let navegador = null;
  const limpar = async () => {
    if (navegador) await Promise.race([navegador.close().catch(() => {}), dormir(10000)]);
    navegador = null;
    if (servidor) servidor.parar();
    servidor = null;
  };
  // Interrompido de fora (Ctrl+C, limite de tempo de quem chamou): deixa o resultado parcial e derruba o servidor
  for (const sinal of ['SIGINT', 'SIGTERM']) {
    process.once(sinal, () => {
      resultado.erro = `interrompido (${sinal}) no meio do roteiro`;
      try {
        gravar();
      } catch {
        // sem pasta de saída: nada a gravar
      }
      if (servidor) servidor.parar();
      console.error(`FALHOU: ${resultado.erro}`);
      process.exit(1);
    });
  }
  process.once('exit', () => { if (servidor) servidor.parar(); });

  // Erros que derrubam a execução: exceção de página e import que falhou
  const fatal = { erro: null, rejeitar: null, promessa: null };
  fatal.promessa = new Promise((_, rejeitar) => { fatal.rejeitar = rejeitar; });
  fatal.promessa.catch(() => {});
  const erroFatal = (mensagem) => {
    if (fatal.erro) return;
    fatal.erro = new Falha(mensagem);
    fatal.rejeitar(fatal.erro);
  };

  let pagina = null;
  let passoAtual = -1;
  let msDeEspera = 0; // tempo real gasto dentro das esperas (para a conta de quadros por segundo)
  try {
    servidor = await subirServidor(op.raiz, op.porta);
    await conferirServidor(servidor, op.raiz, op.porta, primeira.pathname);

    navegador = await abrirNavegador();
    resultado.navegador = `chromium ${navegador.version()}`;
    const perfil = PERFIS[roteiro.perfil];
    const contexto = await navegador.newContext({
      viewport: perfil.viewport, deviceScaleFactor: roteiro.escala, isMobile: perfil.isMobile, hasTouch: perfil.hasTouch,
      locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
    });
    contexto.setDefaultTimeout(60000);

    // Rede: o que é do servidor local passa; o Three.js do CDN sai da cópia local; o resto é barrado
    const cacheLocal = new Map();
    const servirLocal = async (rota, arquivo) => {
      try {
        if (!cacheLocal.has(arquivo)) cacheLocal.set(arquivo, await readFile(arquivo));
      } catch {
        await rota.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: `não existe na cópia local do three: ${arquivo}` });
        return;
      }
      await rota.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8', body: cacheLocal.get(arquivo),
        headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      });
    };
    await contexto.route('**/*', async (rota) => {
      try {
        const u = new URL(rota.request().url());
        if (u.origin === origem || u.protocol === 'data:' || u.protocol === 'blob:') {
          await rota.continue();
        } else if (THREE_MODULO.test(u.pathname)) {
          await servirLocal(rota, path.join(THREE_LOCAL, 'build', 'three.module.js'));
        } else if (THREE_ADDONS.test(u.pathname)) {
          const base = path.join(THREE_LOCAL, 'examples', 'jsm');
          const arquivo = path.resolve(base, decodeURIComponent(u.pathname.match(THREE_ADDONS)[1]));
          if (arquivo.startsWith(base + path.sep)) await servirLocal(rota, arquivo);
          else await rota.abort('blockedbyclient');
        } else {
          await rota.abort('blockedbyclient'); // fora daqui nada sai para a internet
        }
      } catch {
        // a página fechou (ou navegou) com este pedido no meio do caminho
        await rota.abort('blockedbyclient').catch(() => {});
      }
    });
    await contexto.addInitScript(instalarNaPagina, { congelar: roteiro.congelar });

    // Placa de vídeo que o WebGL está usando (numa aba à parte, para não mexer na página do jogo)
    try {
      const sonda = await contexto.newPage();
      resultado.webgl = await sonda.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
        if (!gl) return null;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      });
      await sonda.close();
    } catch {
      resultado.webgl = null;
    }
    if (!resultado.webgl) console.log('aviso: o navegador não tem WebGL; páginas com Three.js vão falhar');

    pagina = await contexto.newPage();
    const ehScript = (pedido) => pedido.resourceType() === 'script' || /\.m?js([?#]|$)/i.test(pedido.url());
    const quemPediu = (pedido) => {
      try {
        return ` (pedido por ${pedido.frame().url()})`;
      } catch {
        return '';
      }
    };
    pagina.on('console', (m) => {
      const lugar = m.location();
      const onde = lugar && lugar.url ? ` (${lugar.url.replace(`${origem}/`, '')}:${lugar.lineNumber})` : '';
      registrarConsole(`[${m.type()}] ${m.text()}${onde}`);
      if (m.type() === 'error') {
        resultado.consoleErros.push(`${m.text()}${onde}`);
        if (resultado.consoleErros.length <= 10) console.log(`aviso: console.error da página: ${curto(m.text(), 300)}${onde}`);
      }
    });
    pagina.on('pageerror', (e) => {
      const texto = e && e.stack ? e.stack : String(e);
      registrarConsole(`[pageerror] ${texto}`);
      erroFatal(`exceção na página: ${e && e.message ? e.message : e}${e && e.stack ? `\n${e.stack.split('\n').slice(1, 6).join('\n')}` : ''}`);
    });
    pagina.on('crash', () => erroFatal('a aba do navegador quebrou (crash)'));
    pagina.on('response', (resposta) => {
      if (resposta.status() < 400) return;
      const pedido = resposta.request();
      resultado.falhasRede.push({ url: pedido.url(), status: resposta.status(), tipo: pedido.resourceType() });
      registrarConsole(`[rede] ${resposta.status()} ${pedido.url()}`);
      if (ehScript(pedido)) erroFatal(`import falhou: resposta ${resposta.status()} para ${pedido.url()}${quemPediu(pedido)}`);
    });
    pagina.on('requestfailed', (pedido) => {
      const motivo = (pedido.failure() && pedido.failure().errorText) || 'falhou';
      resultado.falhasRede.push({ url: pedido.url(), erro: motivo, tipo: pedido.resourceType() });
      registrarConsole(`[rede] ${motivo} ${pedido.url()}`);
      if (ehScript(pedido) && motivo !== 'net::ERR_ABORTED') {
        const barrado = /BLOCKED_BY_CLIENT/i.test(motivo) ? ' (endereço de fora barrado pelo harness: só o three@0.160.0 tem cópia local)' : '';
        erroFatal(`import falhou: ${motivo} para ${pedido.url()}${barrado}`);
      }
    });

    // ----- Ajudas dos passos -----
    let sujo = true; // mexeram na página depois do último quadro desenhado: a próxima foto anda um quadro antes
    const estadoDaPagina = () => pagina.evaluate(() => (window.__captura ? window.__captura.estado() : null));
    // Corre contra o limite de tempo real e contra os erros fatais
    const comLimite = (promessa, segundos, aoExpirar) => {
      let alarme;
      const limite = new Promise((_, rejeitar) => {
        alarme = setTimeout(() => {
          Promise.resolve().then(aoExpirar).then((mensagem) => rejeitar(new Falha(mensagem)), rejeitar);
        }, segundos * 1000);
      });
      promessa.catch(() => {}); // se perder a corrida, o erro dela não vira aviso de promessa solta
      return Promise.race([promessa, limite, fatal.promessa]).finally(() => clearTimeout(alarme));
    };
    const diagnostico = async () => {
      try {
        const d = await Promise.race([
          pagina.evaluate(() => ({
            captura: window.__captura ? window.__captura.estado() : null,
            jogo: window.jogoTeste && typeof window.jogoTeste.estado === 'function' ? window.jogoTeste.estado() : null,
          })),
          dormir(5000).then(() => null),
        ]);
        return d ? JSON.stringify(d) : 'a página não respondeu';
      } catch (e) {
        return `sem diagnóstico (${curto(e.message)})`;
      }
    };
    const esperarNaPagina = async (config, limiteReal, descricao) => {
      const r = await comLimite(
        pagina.evaluate((c) => window.__captura.esperar(c), config),
        limiteReal,
        async () => {
          const d = await diagnostico();
          await Promise.race([pagina.evaluate(() => window.__captura && window.__captura.cancelar()).catch(() => {}), dormir(3000)]);
          return `${descricao}: passou do limite de ${limiteReal} s reais sem terminar (${d})`;
        },
      );
      resultado.quadros += r.quadros;
      msDeEspera += r.ms;
      return r;
    };
    const limiteRealDe = (passo, segundosDeJogo) => passo.limiteReal ?? Math.max(LIMITE_REAL_MINIMO, REAL_POR_SEGUNDO_DE_JOGO * segundosDeJogo);
    const avaliarNaPagina = (codigo, comoExpressao) => pagina.evaluate(async ({ codigo, comoExpressao }) => {
      let valor;
      if (comoExpressao) {
        try {
          valor = (0, eval)(`(${codigo}\n)`);
        } catch (e) {
          if (!(e instanceof SyntaxError)) throw e;
          valor = (0, eval)(codigo);
        }
      } else {
        valor = (0, eval)(codigo);
      }
      if (valor && typeof valor.then === 'function') valor = await valor;
      return comoExpressao ? valor : undefined;
    }, { codigo, comoExpressao });
    const lerVersao = async () => {
      try {
        const v = await pagina.evaluate(() => {
          const e = document.querySelector('#versao');
          return e && e.textContent ? e.textContent.trim() : null;
        });
        if (v) resultado.versaoDoJogo = v;
      } catch {
        // página no meio de uma navegação
      }
    };
    const abrir = async (endereco) => {
      const resposta = await comLimite(pagina.goto(endereco.href, { waitUntil: 'load', timeout: 120000 }), 150, () => `abrir ${endereco.href}: não carregou em 150 s`);
      if (resposta && resposta.status() >= 400) throw new Falha(`abrir ${endereco.href}: resposta ${resposta.status()}`);
      sujo = true;
    };

    const executar = {
      async esperarJogo(passo) {
        const r = await esperarNaPagina({ tipo: 'jogo' }, limiteRealDe(passo, 0), 'esperarJogo (window.jogoTeste e o primeiro quadro)');
        if (!r.ok) throw new Falha(`esperarJogo: ${r.motivo}`);
        sujo = false;
        await lerVersao();
        return { quadros: r.quadros, tempoDeJogo: r.tempoDeJogo };
      },
      async esperarSegundos(passo) {
        const s = passo.esperarSegundos;
        const r = await esperarNaPagina({ tipo: 'segundos', segundos: s }, limiteRealDe(passo, s), `esperarSegundos ${s}`);
        if (!r.ok) throw new Falha(`esperarSegundos ${s}: ${r.motivo}`);
        if (r.quadros > 0) sujo = false;
        return { quadros: r.quadros, tempoDeJogo: r.tempoDeJogo, segundosDeJogo: r.segundosDeJogo };
      },
      async esperarQuadros(passo) {
        const n = passo.esperarQuadros;
        const r = await esperarNaPagina({ tipo: 'quadros', quadros: n }, limiteRealDe(passo, n / 60), `esperarQuadros ${n}`);
        if (!r.ok) throw new Falha(`esperarQuadros ${n}: ${r.motivo}`);
        sujo = false;
        return { quadros: r.quadros, tempoDeJogo: r.tempoDeJogo, segundosDeJogo: r.segundosDeJogo };
      },
      async esperarAte(passo) {
        const limite = passo.limiteSegundos ?? LIMITE_ATE_PADRAO;
        const descricao = `esperarAte ${curto(passo.esperarAte, 120)}`;
        const r = await esperarNaPagina({ tipo: 'ate', expr: passo.esperarAte, limiteJogo: limite }, limiteRealDe(passo, limite), descricao);
        if (!r.ok) {
          if (r.motivo === 'limite') throw new Falha(`${descricao}: não ficou verdadeira em ${limite} s de jogo (${await diagnostico()})`);
          throw new Falha(`${descricao}: ${r.motivo}`);
        }
        if (r.quadros > 0) sujo = false;
        return { quadros: r.quadros, tempoDeJogo: r.tempoDeJogo, segundosDeJogo: r.segundosDeJogo };
      },
      async esperarReal(passo) {
        const q0 = (await estadoDaPagina())?.quadros ?? 0;
        await pagina.evaluate(() => window.__captura.continuar());
        await comLimite(dormir(passo.esperarReal), passo.esperarReal / 1000 + 30, () => 'esperarReal: estourou');
        const e = await pagina.evaluate(() => {
          window.__captura.pausar();
          return window.__captura.estado();
        });
        resultado.quadros += e.quadros - q0;
        msDeEspera += passo.esperarReal;
        if (e.quadros > q0) sujo = false;
        return { quadros: e.quadros - q0, tempoDeJogo: e.tempoDeJogo };
      },
      async esperarSeletor(passo) {
        const limite = limiteRealDe(passo, 0);
        const q0 = (await estadoDaPagina())?.quadros ?? 0;
        const tempoDaEspera = cronometro();
        await pagina.evaluate(() => window.__captura.continuar());
        try {
          await comLimite(
            pagina.waitForSelector(passo.esperarSeletor, { state: 'visible', timeout: 0 }),
            limite, () => `esperarSeletor ${passo.esperarSeletor}: não apareceu em ${limite} s reais`,
          );
        } finally {
          await pagina.evaluate(() => window.__captura && window.__captura.pausar()).catch(() => {});
        }
        const e = await estadoDaPagina();
        resultado.quadros += e.quadros - q0;
        msDeEspera += tempoDaEspera();
        if (e.quadros > q0) sujo = false;
        return { quadros: e.quadros - q0, tempoDeJogo: e.tempoDeJogo };
      },
      async foto(passo) {
        // Se mexeram na página desde o último quadro (js, clicar, tamanho, abrir), anda um quadro para a tela mostrar
        let quadros = 0;
        if (roteiro.congelar && sujo) {
          const e = await estadoDaPagina();
          if (e && e.pendentes > 0) {
            const r = await esperarNaPagina({ tipo: 'quadros', quadros: 1 }, LIMITE_REAL_MINIMO, `foto ${passo.foto} (um quadro para atualizar a tela)`);
            if (!r.ok) throw new Falha(`foto ${passo.foto}: ${r.motivo}`);
            quadros = r.quadros;
          }
          sujo = false;
        }
        const e = await comLimite(pagina.evaluate(() => window.__captura.assentar()), 60, () => `foto ${passo.foto}: o navegador não desenhou em 60 s`);
        const opcoes = { type: 'png', animations: 'disabled', caret: 'hide', timeout: 120000 };
        let imagem;
        if (passo.seletor) {
          const alvo = pagina.locator(passo.seletor).first();
          if ((await alvo.count()) === 0) throw new Falha(`foto ${passo.foto}: nenhum elemento com o seletor ${passo.seletor}`);
          if (passo.recorte) {
            // Recorte medido a partir do canto do elemento (coordenadas do documento, para valer fora da tela)
            await alvo.scrollIntoViewIfNeeded({ timeout: 30000 });
            const caixa = await alvo.boundingBox();
            if (!caixa) throw new Falha(`foto ${passo.foto}: o elemento ${passo.seletor} não está visível`);
            const rolagem = await pagina.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
            const r = passo.recorte;
            imagem = await pagina.screenshot({ ...opcoes, fullPage: true, clip: { x: caixa.x + rolagem.x + r.x, y: caixa.y + rolagem.y + r.y, width: r.largura, height: r.altura } });
          } else {
            imagem = await alvo.screenshot(opcoes);
          }
        } else if (passo.recorte) {
          const r = passo.recorte;
          imagem = await pagina.screenshot({ ...opcoes, clip: { x: r.x, y: r.y, width: r.largura, height: r.altura } });
        } else {
          imagem = await pagina.screenshot({ ...opcoes, fullPage: Boolean(passo.paginaInteira) });
        }
        const arquivo = `${passo.foto}.png`;
        await writeFile(path.join(saida, arquivo), imagem);
        let analise;
        try {
          analise = analisarPng(imagem);
        } catch (erro) {
          analise = { suspeita: true, motivo: `não consegui ler o PNG: ${erro.message}` };
        }
        const ficha = { nome: passo.foto, arquivo, bytes: imagem.length, tempoDeJogo: e.tempoDeJogo, ...analise };
        resultado.fotos.push(ficha);
        if (analise.suspeita) {
          resultado.fotosSuspeitas.push(passo.foto);
          console.log(`aviso: a foto ${arquivo} parece vazia: ${analise.motivo}`);
        }
        return { quadros, tempoDeJogo: e.tempoDeJogo, foto: ficha };
      },
      async js(passo) {
        try {
          await avaliarNaPagina(passo.js, false);
        } catch (e) {
          throw new Falha(`js deu erro: ${curto(primeiraLinha(e), 600)}\n  código: ${curto(passo.js, 300)}`);
        }
        sujo = true;
        return {};
      },
      async avaliar(passo) {
        let valor;
        try {
          valor = await avaliarNaPagina(passo.avaliar, true);
        } catch (e) {
          throw new Falha(`avaliar deu erro: ${curto(primeiraLinha(e), 600)}\n  código: ${curto(passo.avaliar, 300)}`);
        }
        resultado.guardados[passo.guardar] = valor === undefined ? null : valor;
        return { guardado: passo.guardar, valor: valor === undefined ? null : valor };
      },
      async clicar(passo) {
        try {
          await pagina.click(passo.clicar, { timeout: 30000 });
        } catch (e) {
          throw new Falha(`clicar ${passo.clicar}: ${curto(primeiraLinha(e), 300)}`);
        }
        sujo = true;
        return {};
      },
      async tamanho(passo) {
        await pagina.setViewportSize({ width: passo.tamanho.largura, height: passo.tamanho.altura });
        await pagina.evaluate(() => window.__captura.assentar());
        resultado.tela = { ...passo.tamanho };
        sujo = true;
        return {};
      },
      async abrir(passo) {
        await abrir(enderecoDe(passo.abrir));
        return {};
      },
    };

    // ----- A página e os passos -----
    await abrir(primeira);
    for (passoAtual = 0; passoAtual < roteiro.passos.length; passoAtual++) {
      const passo = roteiro.passos[passoAtual];
      const tipo = roteiro.tipos[passoAtual];
      if (fatal.erro) throw fatal.erro;
      const tempoDoPasso = cronometro();
      const ficha = { n: passoAtual + 1, tipo, passo, ok: false, ms: 0 };
      resultado.passos.push(ficha);
      const execucao = executar[tipo](passo);
      execucao.catch(() => {}); // se um erro fatal ganhar a corrida, o erro deste passo não fica solto
      const detalhe = await Promise.race([execucao, fatal.promessa]);
      if (fatal.erro) throw fatal.erro;
      Object.assign(ficha, detalhe, { ok: true, ms: tempoDoPasso() });
      const t = ehNumero(ficha.tempoDeJogo) ? ` t=${ficha.tempoDeJogo.toFixed(3)}s` : '';
      const q = ficha.quadros ? ` ${ficha.quadros} quadros` : '';
      const valor = tipo === 'avaliar' ? ` → ${curto(JSON.stringify(ficha.valor), 200)}` : '';
      console.log(`[${String(passoAtual + 1).padStart(2)}/${roteiro.passos.length}] ${tipo} ${curto(typeof passo[tipo] === 'string' ? passo[tipo] : JSON.stringify(passo[tipo]), 70)}${t}${q} (${ficha.ms} ms)${valor}`);
    }
    passoAtual = -1;
    // Uma última ida à página: dá tempo de chegar algum erro do último quadro
    await pagina.evaluate(() => 0);
    await lerVersao();
    if (fatal.erro) throw fatal.erro;
    resultado.ok = true;
    if (op.estrito && resultado.fotosSuspeitas.length) {
      resultado.ok = false;
      resultado.erro = `fotos suspeitas (--estrito): ${resultado.fotosSuspeitas.join(', ')}`;
    }
  } catch (e) {
    const mensagem = e instanceof Falha ? e.message : `${e && e.message ? e.message : e}`;
    const passo = passoAtual >= 0 ? roteiro.passos[passoAtual] : null;
    resultado.ok = false;
    resultado.erro = passo ? `passo ${passoAtual + 1} (${curto(JSON.stringify(passo), 200)}): ${mensagem}` : mensagem;
    const ficha = resultado.passos[resultado.passos.length - 1];
    if (passo && ficha && !ficha.ok) ficha.erro = mensagem;
    // Uma foto de como a tela ficou na hora da falha ajuda a entender
    if (pagina && existsSync(saida)) {
      try {
        await Promise.race([pagina.screenshot({ path: path.join(saida, 'falha.png'), timeout: 15000 }), dormir(20000)]);
      } catch {
        // sem foto da falha
      }
    }
  } finally {
    if (pagina) {
      try {
        await Promise.race([
          pagina.evaluate(() => {
            const e = document.querySelector('#versao');
            return e && e.textContent ? e.textContent.trim() : null;
          }).then((v) => { if (v && !resultado.versaoDoJogo) resultado.versaoDoJogo = v; }),
          dormir(3000),
        ]);
      } catch {
        // página fechada ou quebrada
      }
    }
    encerrando = true;
    await limpar();
  }

  const segundos = relogio() / 1000;
  // Quadros da página por segundo real, contando só o tempo dentro das esperas (as fotos ficam de fora)
  resultado.quadrosPorSegundo = msDeEspera > 0 && resultado.quadros > 0 ? Number(((resultado.quadros * 1000) / msDeEspera).toFixed(1)) : null;
  gravar();
  if (resultado.consoleErros.length > 10) console.log(`aviso: mais ${resultado.consoleErros.length - 10} console.error (todos em console.txt)`);
  if (resultado.ok) {
    console.log(`OK: ${resultado.fotos.length} fotos em ${saida} (${segundos.toFixed(1)} s reais, ${resultado.quadros} quadros de jogo${resultado.fotosSuspeitas.length ? `, ${resultado.fotosSuspeitas.length} foto(s) suspeita(s)` : ''})`);
    return 0;
  }
  console.error(`FALHOU: ${resultado.erro}`);
  console.error(`(detalhes em ${path.join(saida, 'resultado.json')} e console.txt${existsSync(path.join(saida, 'falha.png')) ? '; tela na hora da falha em falha.png' : ''})`);
  return 1;
}

// Promessa rejeitada que ninguém tratou: no meio do roteiro é erro do harness (termina com código 1, com
// mensagem); com o navegador já fechando, é só resto de pedido interrompido e vira aviso
let encerrando = false;
process.on('unhandledRejection', (e) => {
  const texto = e && e.stack ? e.stack : String(e);
  if (encerrando) {
    console.log(`aviso: erro tardio ignorado ao fechar o navegador: ${curto(texto, 300)}`);
    return;
  }
  console.error(`FALHOU: erro interno do harness: ${texto}`);
  process.exit(1);
});

principal().then(
  (codigo) => process.exit(codigo),
  (e) => {
    console.error(`FALHOU: ${e instanceof Falha ? e.message : e && e.stack ? e.stack : e}`);
    process.exit(1);
  },
);
