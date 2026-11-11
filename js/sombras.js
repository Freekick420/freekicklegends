// Sombras no gramado: a dos bonecos (cobrador, barreira, goleiro, figurantes) e a da bola.
// Aqui fica a versão simples: um borrão redondo e macio embaixo de cada um (uma malha só, barata).
// Eixos: x = direita de quem cobra, y = para cima, z = do gol para quem cobra.

import { criarSombraBlob } from './jogadores.js?v=9';

// Cria o sistema de sombras da cena. opcoes.refletores: de onde vem a luz ([{ direcao: {x, y, z}, forca }]),
// se o cenário informar (cenario.refletores). Devolve:
//   boneco(personagem, { raio, destaque })  sombra de um boneco de js/jogadores.js. raio: m do borrão;
//       destaque: true para o cobrador (merece a sombra mais caprichada). Devolve
//       { atualizar({ x, z, altura }), remover() }: chamar atualizar a cada quadro com a posição dos pés no
//       gramado e a altura (m) em que os pés estão do chão (pulo; padrão 0).
//   bola(raio)   sombra da bola. Devolve { atualizar(pos) } (pos: {x, y, z} do centro da bola, na física).
//   qualidade(nivel)  0 = o mais barato possível; 1 = completo (o jogo baixa quando o celular não aguenta).
//   atualizar(dt)     uma vez por quadro, depois de mover os bonecos e a bola.
export function criarSombras(scene, opcoes = {}) {
  void opcoes;

  function boneco(personagem, { raio = 0.42 } = {}) {
    void personagem;
    const malha = criarSombraBlob(raio);
    scene.add(malha);
    return {
      atualizar({ x, z, altura = 0 }) {
        malha.position.set(x, 0.012, z);
        const escala = Math.max(0.45, 1 - altura * 1.2);
        malha.scale.set(2 * raio * escala, 1, 2 * raio * escala);
      },
      remover() {
        scene.remove(malha);
      },
    };
  }

  function bola(raio = 0.3) {
    const malha = criarSombraBlob(raio);
    malha.material = malha.material.clone(); // a opacidade muda com a altura da bola: material só dela
    scene.add(malha);
    return {
      atualizar(pos, raioBola = 0.11) {
        const altura = Math.max(0, pos.y - raioBola);
        const tamanho = 2 * raio * (1 + altura * 0.15);
        malha.position.set(pos.x, 0.012, pos.z);
        malha.scale.set(tamanho, 1, tamanho);
        malha.material.opacity = Math.max(0.15, 0.9 - altura * 0.12);
      },
    };
  }

  return {
    boneco,
    bola,
    qualidade() {},
    atualizar() {},
  };
}
