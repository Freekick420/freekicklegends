// Figurantes: os outros jogadores em campo, além do cobrador, da barreira e do goleiro (companheiros do
// cobrador e adversários marcando), para a cobrança parecer um lance de jogo de verdade.
// Aqui só a lógica (onde cada um fica e a colisão com a bola); o desenho é de js/animacaoFigurantes.js.
// Não depende do Three.js: dá para rodar no Node. Eixos: x = direita de quem cobra, y = para cima,
// z = do gol em direção a quem cobra (gol em z = 0).

export const PADRAO_FIGURANTES = {
  quantidade: 10,   // quantos jogadores além do cobrador, da barreira e do goleiro (0 = campo vazio)
  colisao: true,    // a bola bate neles (false = só enfeite)
};

// Monta os figurantes de uma cobrança. posBola: {x, z}. barreira: o que montarBarreira devolveu (ou semBarreira).
// aleatorio: função de 0 a 1 com semente (mesma semente, mesmos jogadores: o replay repete).
// opcoes: { penalti: bool, cobrador: { x, z } (onde o cobrador espera para correr), pe: 'D' | 'E' }.
// Devolve { jogadores: [{ x, z, rotacaoY, time: 'ataque' | 'defesa', altura, raio, ... }], batidas, ... }.
export function montarFigurantes(posBola, barreira, cfg = {}, aleatorio = Math.random, opcoes = {}) {
  void posBola; void barreira; void cfg; void aleatorio; void opcoes;
  return { jogadores: [], batidas: 0, ultimaBatida: null, _anterior: null, _bola: null };
}

// Movimento que vale para a colisão (se houver). tDesdeChute: segundos desde o chute (negativo = antes).
export function atualizarFigurantes(f, tDesdeChute) {
  void f; void tDesdeChute;
}

// Colisão da bola com os figurantes. Chamar depois de cada passo(bola, ...). Registra
// bola.eventos.push({ tipo: 'jogador', time, impacto, jogador, x, y, z }). Devolve true se bateu.
export function colidirBolaFigurantes(bola, f, cfg = {}) {
  void bola; void f; void cfg;
  return false;
}
