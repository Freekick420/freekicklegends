#!/usr/bin/env node
// verificarPng.mjs — lê um PNG sem nenhuma dependência (só o zlib do Node) e mede se a imagem
// "tem alguma coisa": desvio de luminância, número de cores e quanto da imagem é de uma cor só.
// Serve para pegar "tela preta" (WebGL que não desenhou, canvas vazio) nas capturas do harness.
//
// Como módulo:   import { analisarPng, decodificarPng, compararPng } from './verificarPng.mjs'
// Na linha de comando:
//   node verificarPng.mjs foto1.png [foto2.png ...]     mede cada arquivo (sai com código 1 se algum for suspeito)
//   node verificarPng.mjs --comparar a.png b.png        conta os pixels diferentes entre duas capturas

import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CANAIS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }; // por tipo de cor do PNG

// Limites do veredito "suspeita" (calibrados nas capturas do jogo; ver README)
export const LIMITES = {
  desvioMinimo: 6,          // desvio padrão da luminância (0 a 255): abaixo disso a imagem é quase lisa
  coresMinimas: 64,         // cores diferentes: abaixo disso é um borrão de poucas cores
  dominanteEscura: 0.5,     // fração da imagem na cor mais comum, quando essa cor é escura: "tela preta"
  luminanciaEscura: 48,     // até que luminância a cor mais comum conta como escura
  dominanteMaxima: 0.98,    // fração na cor mais comum, seja qual for a cor: praticamente uma cor só
};

// Devolve { largura, altura, rgba } (rgba: Buffer com 4 bytes por pixel, 8 bits por canal)
export function decodificarPng(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(ASSINATURA)) throw new Error('não é um PNG (assinatura errada)');
  let cabecalho = null;
  let paleta = null;
  let transparencia = null;
  const pedacos = [];
  let pos = 8;
  while (pos + 12 <= buffer.length) {
    const tamanho = buffer.readUInt32BE(pos);
    const tipo = buffer.toString('latin1', pos + 4, pos + 8);
    const dados = buffer.subarray(pos + 8, pos + 8 + tamanho);
    if (dados.length < tamanho) throw new Error(`PNG truncado no bloco ${tipo}`);
    pos += 12 + tamanho;
    if (tipo === 'IHDR') {
      cabecalho = {
        largura: dados.readUInt32BE(0), altura: dados.readUInt32BE(4), profundidade: dados[8], tipoCor: dados[9],
        entrelacado: dados[12],
      };
    } else if (tipo === 'PLTE') paleta = dados;
    else if (tipo === 'tRNS') transparencia = dados;
    else if (tipo === 'IDAT') pedacos.push(dados);
    else if (tipo === 'IEND') break;
  }
  if (!cabecalho) throw new Error('PNG sem cabeçalho (IHDR)');
  const { largura, altura, profundidade, tipoCor, entrelacado } = cabecalho;
  const canais = CANAIS[tipoCor];
  if (!canais) throw new Error(`tipo de cor de PNG desconhecido: ${tipoCor}`);
  if (entrelacado) throw new Error('PNG entrelaçado não é suportado');
  if (![1, 2, 4, 8, 16].includes(profundidade)) throw new Error(`profundidade de PNG desconhecida: ${profundidade}`);
  if (tipoCor === 3 && !paleta) throw new Error('PNG de paleta sem a paleta (PLTE)');
  if (!largura || !altura) throw new Error('PNG com tamanho zero');

  const bitsPorPixel = canais * profundidade;
  const passoFiltro = Math.max(1, bitsPorPixel >> 3);     // distância (bytes) até o "pixel da esquerda"
  const bytesLinha = Math.ceil((largura * bitsPorPixel) / 8);
  const bruto = inflateSync(Buffer.concat(pedacos));
  if (bruto.length < (bytesLinha + 1) * altura) throw new Error('PNG truncado (faltam linhas)');

  // Desfaz o filtro de cada linha (0 nenhum, 1 esquerda, 2 cima, 3 média, 4 Paeth)
  const linhas = Buffer.alloc(bytesLinha * altura);
  for (let y = 0; y < altura; y++) {
    const filtro = bruto[y * (bytesLinha + 1)];
    const e = y * (bytesLinha + 1) + 1;   // entrada
    const s = y * bytesLinha;             // saída
    const c = s - bytesLinha;             // linha de cima (só vale com y > 0)
    if (filtro === 0) {
      bruto.copy(linhas, s, e, e + bytesLinha);
    } else if (filtro === 1) {
      for (let x = 0; x < bytesLinha; x++) {
        linhas[s + x] = (bruto[e + x] + (x >= passoFiltro ? linhas[s + x - passoFiltro] : 0)) & 255;
      }
    } else if (filtro === 2) {
      for (let x = 0; x < bytesLinha; x++) linhas[s + x] = (bruto[e + x] + (y ? linhas[c + x] : 0)) & 255;
    } else if (filtro === 3) {
      for (let x = 0; x < bytesLinha; x++) {
        const esquerda = x >= passoFiltro ? linhas[s + x - passoFiltro] : 0;
        const cima = y ? linhas[c + x] : 0;
        linhas[s + x] = (bruto[e + x] + ((esquerda + cima) >> 1)) & 255;
      }
    } else if (filtro === 4) {
      for (let x = 0; x < bytesLinha; x++) {
        const esquerda = x >= passoFiltro ? linhas[s + x - passoFiltro] : 0;
        const cima = y ? linhas[c + x] : 0;
        const diagonal = y && x >= passoFiltro ? linhas[c + x - passoFiltro] : 0;
        const p = esquerda + cima - diagonal;
        const pa = Math.abs(p - esquerda);
        const pb = Math.abs(p - cima);
        const pc = Math.abs(p - diagonal);
        const previsto = pa <= pb && pa <= pc ? esquerda : pb <= pc ? cima : diagonal;
        linhas[s + x] = (bruto[e + x] + previsto) & 255;
      }
    } else {
      throw new Error(`filtro de PNG desconhecido (${filtro}) na linha ${y}`);
    }
  }

  // Converte para RGBA de 8 bits
  const rgba = Buffer.alloc(largura * altura * 4);
  // Amostra número k (0, 1, 2...) da linha y, já em 8 bits (16 bits: fica o byte alto; menos de 8: estica)
  const amostra = (y, k) => {
    const base = y * bytesLinha;
    if (profundidade === 8) return linhas[base + k];
    if (profundidade === 16) return linhas[base + k * 2];
    const bit = k * profundidade;
    const valor = (linhas[base + (bit >> 3)] >> (8 - profundidade - (bit & 7))) & ((1 << profundidade) - 1);
    return tipoCor === 3 ? valor : Math.round((valor * 255) / ((1 << profundidade) - 1));
  };
  if (tipoCor === 6 && profundidade === 8) {
    linhas.copy(rgba);
  } else {
    for (let y = 0; y < altura; y++) {
      for (let x = 0; x < largura; x++) {
        const o = (y * largura + x) * 4;
        if (tipoCor === 2) {
          rgba[o] = amostra(y, x * 3);
          rgba[o + 1] = amostra(y, x * 3 + 1);
          rgba[o + 2] = amostra(y, x * 3 + 2);
          rgba[o + 3] = 255;
        } else if (tipoCor === 6) {
          rgba[o] = amostra(y, x * 4);
          rgba[o + 1] = amostra(y, x * 4 + 1);
          rgba[o + 2] = amostra(y, x * 4 + 2);
          rgba[o + 3] = amostra(y, x * 4 + 3);
        } else if (tipoCor === 0) {
          rgba[o] = rgba[o + 1] = rgba[o + 2] = amostra(y, x);
          rgba[o + 3] = 255;
        } else if (tipoCor === 4) {
          rgba[o] = rgba[o + 1] = rgba[o + 2] = amostra(y, x * 2);
          rgba[o + 3] = amostra(y, x * 2 + 1);
        } else {
          const indice = amostra(y, x);
          if (indice * 3 + 2 >= paleta.length) throw new Error(`PNG com índice de paleta inválido (${indice})`);
          rgba[o] = paleta[indice * 3];
          rgba[o + 1] = paleta[indice * 3 + 1];
          rgba[o + 2] = paleta[indice * 3 + 2];
          rgba[o + 3] = transparencia && indice < transparencia.length ? transparencia[indice] : 255;
        }
      }
    }
  }
  return { largura, altura, rgba };
}

// Mede a imagem. Aceita o Buffer do arquivo PNG ou o que decodificarPng devolveu.
// Devolve { largura, altura, luminanciaMedia, desvioLuminancia, cores, corDominante, fracaoEscura, suspeita, motivo }
//   desvioLuminancia: desvio padrão da luminância (0 = imagem lisa)
//   cores: quantas cores diferentes (RGB exato) aparecem
//   corDominante: fração dos pixels na cor mais comum (cores vizinhas contam juntas: 32 níveis por canal)
//   corDominanteHex: que cor é essa (o meio da faixa), por exemplo "#0c2c14"
//   fracaoEscura: fração dos pixels quase pretos (luminância < 16)
// "suspeita" = parece tela preta ou vazia: imagem quase lisa, pouquíssimas cores, mais da metade numa cor
// escura só (canvas que não desenhou) ou praticamente tudo de uma cor.
export function analisarPng(entrada) {
  const { largura, altura, rgba } = Buffer.isBuffer(entrada) || entrada instanceof Uint8Array ? decodificarPng(entrada) : entrada;
  const total = largura * altura;
  const vistas = new Uint8Array(1 << 21);      // um bit para cada cor de 24 bits
  const histograma = new Uint32Array(1 << 15); // 5 bits por canal
  let cores = 0;
  let soma = 0;
  let somaQuadrados = 0;
  let escuros = 0;
  for (let i = 0, p = 0; i < total; i++, p += 4) {
    let r = rgba[p];
    let g = rgba[p + 1];
    let b = rgba[p + 2];
    const a = rgba[p + 3];
    if (a !== 255) { // transparente conta como se estivesse sobre fundo preto
      r = Math.round((r * a) / 255);
      g = Math.round((g * a) / 255);
      b = Math.round((b * a) / 255);
    }
    const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    soma += luminancia;
    somaQuadrados += luminancia * luminancia;
    if (luminancia < 16) escuros++;
    const cor = (r << 16) | (g << 8) | b;
    const bit = 1 << (cor & 7);
    if (!(vistas[cor >> 3] & bit)) {
      vistas[cor >> 3] |= bit;
      cores++;
    }
    histograma[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)]++;
  }
  let maisComum = 0;
  let faixa = 0;
  for (let i = 0; i < histograma.length; i++) {
    if (histograma[i] > maisComum) {
      maisComum = histograma[i];
      faixa = i;
    }
  }
  // O meio da faixa de cor mais comum, de volta para 8 bits por canal
  const dominante = [(faixa >> 10) & 31, (faixa >> 5) & 31, faixa & 31].map((v) => v * 8 + 4);
  const luminanciaDominante = 0.2126 * dominante[0] + 0.7152 * dominante[1] + 0.0722 * dominante[2];
  const media = soma / total;
  const desvio = Math.sqrt(Math.max(0, somaQuadrados / total - media * media));
  const corDominante = maisComum / total;
  const porcento = `${Math.round(corDominante * 100)}%`;
  const motivos = [];
  if (desvio < LIMITES.desvioMinimo) motivos.push(`imagem quase lisa (desvio de luminância ${desvio.toFixed(1)})`);
  if (cores < LIMITES.coresMinimas) motivos.push(`só ${cores} cores`);
  if (corDominante > LIMITES.dominanteMaxima) motivos.push(`${porcento} da imagem numa cor só`);
  else if (corDominante > LIMITES.dominanteEscura && luminanciaDominante < LIMITES.luminanciaEscura) motivos.push(`${porcento} da imagem numa cor escura só (tela preta?)`);
  const arredondar = (v, casas) => Number(v.toFixed(casas));
  return {
    largura, altura,
    luminanciaMedia: arredondar(media, 1),
    desvioLuminancia: arredondar(desvio, 1),
    cores,
    corDominante: arredondar(corDominante, 3),
    corDominanteHex: `#${dominante.map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    fracaoEscura: arredondar(escuros / total, 3),
    suspeita: motivos.length > 0,
    motivo: motivos.length ? motivos.join('; ') : null,
  };
}

// Compara duas capturas pixel a pixel. tolerancia: diferença (0 a 255, por canal) que ainda conta como igual.
// Devolve { iguais, tamanhoIgual, diferentes, fracao, maiorDiferenca, caixa } (caixa: retângulo que contém as diferenças)
export function compararPng(a, b, tolerancia = 0) {
  const A = Buffer.isBuffer(a) ? decodificarPng(a) : a;
  const B = Buffer.isBuffer(b) ? decodificarPng(b) : b;
  if (A.largura !== B.largura || A.altura !== B.altura) {
    return { iguais: false, tamanhoIgual: false, a: `${A.largura}x${A.altura}`, b: `${B.largura}x${B.altura}` };
  }
  let diferentes = 0;
  let maior = 0;
  let x0 = A.largura;
  let y0 = A.altura;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0, p = 0; y < A.altura; y++) {
    for (let x = 0; x < A.largura; x++, p += 4) {
      const d = Math.max(
        Math.abs(A.rgba[p] - B.rgba[p]), Math.abs(A.rgba[p + 1] - B.rgba[p + 1]),
        Math.abs(A.rgba[p + 2] - B.rgba[p + 2]), Math.abs(A.rgba[p + 3] - B.rgba[p + 3]));
      if (d > maior) maior = d;
      if (d > tolerancia) {
        diferentes++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return {
    iguais: diferentes === 0, tamanhoIgual: true, diferentes,
    fracao: Number((diferentes / (A.largura * A.altura)).toFixed(5)),
    maiorDiferenca: maior,
    caixa: diferentes ? { x: x0, y: y0, largura: x1 - x0 + 1, altura: y1 - y0 + 1 } : null,
  };
}

// ---------- Linha de comando ----------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumentos = process.argv.slice(2);
  if (!argumentos.length || argumentos.includes('--ajuda') || argumentos.includes('-h')) {
    console.log('uso: node verificarPng.mjs foto.png [outra.png ...]\n     node verificarPng.mjs --comparar a.png b.png [tolerancia]');
    process.exit(argumentos.length ? 0 : 1);
  }
  let codigo = 0;
  if (argumentos[0] === '--comparar') {
    if (argumentos.length < 3) {
      console.error('uso: node verificarPng.mjs --comparar a.png b.png [tolerancia]');
      process.exit(1);
    }
    const r = compararPng(readFileSync(argumentos[1]), readFileSync(argumentos[2]), Number(argumentos[3]) || 0);
    console.log(JSON.stringify(r));
    codigo = r.iguais ? 0 : 1;
  } else {
    for (const arquivo of argumentos) {
      try {
        const r = analisarPng(readFileSync(arquivo));
        console.log(`${r.suspeita ? 'SUSPEITA' : 'ok      '} ${arquivo} ${JSON.stringify(r)}`);
        if (r.suspeita) codigo = 1;
      } catch (e) {
        console.log(`ERRO     ${arquivo} ${e.message}`);
        codigo = 1;
      }
    }
  }
  process.exit(codigo);
}
