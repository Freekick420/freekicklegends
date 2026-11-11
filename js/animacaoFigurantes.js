// Desenho dos figurantes (os outros jogadores em campo): cria os bonecos, põe cada um no lugar que a lógica
// de js/figurantes.js decidiu e anima (esperar, acompanhar a bola, reagir ao resultado).

// scene: a cena do jogo. opcoes.criarSombra(personagem, opcoes): cria a sombra de um boneco
// (devolve { atualizar({ x, z, altura }), remover() }, como em js/sombras.js). Devolve:
//   montar(figurantes, { uniformeAtaque, uniformeDefesa, semente })  cria os bonecos de uma cobrança
//       (figurantes: o que montarFigurantes devolveu; os uniformes no formato de js/jogadores.js)
//   atualizar(figurantes, t, dt, info)  a cada quadro. t: relógio (s); info: { fase, tempoDesdeChute, bola,
//       resultado } (fase do jogo; s desde o chute, negativo na corrida, null antes; a bola da física;
//       resultado do lance quando acabou: 'gol', 'defesa', 'trave', 'fora', 'cima', 'barreira', 'curta', 'jogador')
//   limpar()  tira todos da cena
export function criarAnimadorFigurantes(scene, opcoes = {}) {
  void scene; void opcoes;
  return {
    montar() {},
    atualizar() {},
    limpar() {},
  };
}
