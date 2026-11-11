# Frente AMBIENTE — luz dos refletores, sombras no gramado, bola e acabamento do estádio

Diretório de trabalho (git worktree, ramo `etapa9-amb`): **/home/user/fkl-amb**. Rascunho:
`PASTA_DE_RASCUNHO/amb/`. Porta do harness: **8831**
(a crítica usa 8832 e a correção 8833). Leia antes o contexto comum: `.../scratchpad/briefs/comum.md`.

## Arquivos seus
- `js/sombras.js` (hoje é só um borrão redondo embaixo de cada boneco: reescreva), `js/bola.js` (a bola desenhada:
  melhore), `js/estadio.js` (luzes da cena, céu, gramado, estádio: ajuste com cuidado, já é bem trabalhado e leve),
  `js/painel.js` (só para acrescentar sliders dos números novos que você criar em `PADRAO_CENARIO`), `style.css`
  e `index.html` (só se precisar de uma camada por cima do jogo, tipo vinheta). Página de inspeção nova se quiser
  (`testes/sombras.html`); a `testes/cenario.html` já existe.
- **Não edite** `js/main.js` (já chama os seus módulos pelo contrato abaixo), `js/jogadores.js` (o boneco está
  sendo refeito por outra pessoa), `js/cobranca.js`, `js/figurantes.js`, `js/animacaoFigurantes.js`, `js/elenco.js`.

## Contrato com o `js/main.js` (já ligado na base; mantenha nomes e formas)
```js
const cenario = criarCenario(scene, renderer, CONFIG);       // js/estadio.js (como hoje)
cenario.refletores  // NOVO, opcional: [{ direcao: {x, y, z} (unitário, do chão para a luz), forca: 0..1 }, ...]
const bolaVisual = criarBolaVisual(scene, CONFIG);           // js/bola.js → { malha, reiniciar(), atualizar(bola, camera, dt) }
//   malha: a THREE.Mesh da bola; o main.js lê malha.scale.x (aumento da bola à distância) para a rede de pano
const sombras = criarSombras(scene, { refletores: cenario.refletores });   // js/sombras.js
const s = sombras.boneco(personagem, { raio, destaque });    // um por boneco; destaque: true só no cobrador
s.atualizar({ x, z, altura });   // a cada quadro: onde os pés estão no gramado e quanto estão acima do chão (pulo)
s.remover();                     // quando o boneco sai de cena (ANTES do personagem.dispose())
const sb = sombras.bola(raio);   sb.atualizar(pos, raioBola);    // pos: {x, y, z} do centro da bola
sombras.qualidade(nivel);        // 0 = o mais barato possível; 1 = completo (o jogo chama 0 quando o celular não aguenta)
sombras.atualizar(dt);           // uma vez por quadro, depois de mover bonecos, bola e câmera
```
Bonecos por lance: 1 cobrador (`destaque`), 2 a 5 da barreira, 1 goleiro e uns 10 figurantes (outros jogadores em
campo, que outra pessoa está fazendo; chegam pelo mesmo `sombras.boneco`). O `personagem` é o de
`js/jogadores.js`: `personagem.grupo` (THREE.Group, na cena), `personagem.juntas`, `personagem.altura`.
**Silhueta**: o boneco está ganhando, em paralelo, o método
`personagem.criarSilhueta(material, copias = 1)` → uma malha só (com pele, presa ao esqueleto do boneco) com o
corpo inteiro repetido `copias` vezes; cada vértice tem o atributo float `copia` (0 … copias − 1). O material é
seu: um shader que achata cada cópia no gramado ao longo de uma direção de luz (4 cópias = as 4 sombras em uma
chamada de desenho). A malha já entra no grupo do boneco e some no `dispose()` dele. **Na base que você recebeu
esse método ainda não existe**: escreva `js/sombras.js` para usar `criarSilhueta` quando existir e, quando não
existir, cair num plano B (para o `destaque`, projete as malhas do boneco uma a uma, percorrendo
`personagem.grupo`; para os outros, borrões alongados nas 4 direções). Assim dá para ver e testar tudo já, e o
caminho rápido entra sozinho quando os dois trabalhos forem juntados. (Dica de shader: em `onBeforeCompile` de um
`MeshBasicMaterial`, troque `#include <project_vertex>` por uma versão que calcula a posição no mundo
(`modelMatrix * vec4(transformed, 1.0)`), desliza ao longo da luz até y ≈ 0,012 e projeta; funciona com malha
comum e com malha com pele. Guarde a altura original do vértice para clarear a sombra longe dos pés.)

## O que fazer (em ordem de importância)
1. **As quatro sombras dos refletores** embaixo de cada jogador e da bola: a marca visual dos jogos de futebol
   noturnos (PES/Winning Eleven do PS2). Silhueta de verdade (pernas e braços mexendo na sombra) pelo menos no
   cobrador; nos outros, silhueta se couber no orçamento (com `criarSilhueta` é uma chamada por boneco), senão
   borrões alongados em cruz. Sombras ancoradas nos pés (quem pula descola da sombra), sem escurecer em dobro
   onde se cruzam de um jeito feio (estêncil ou mistura que não acumula dentro do mesmo boneco), sem brigar com o
   gramado (z-fighting), sumindo na neblina ao longe, comprimento plausível (0,8 a 1,4 vez a altura do jogador:
   não use o ângulo real das torres, que daria sombras de 5 m). Na bola: 4 sombrinhas que se juntam quando ela
   desce (ajuda muito a ler a altura da bola) e uma sombra de contato quando está no chão.
   `qualidade(0)` cai para o mais barato (um borrão por boneco). Um liga/desliga no painel.
2. **Luz dos bonecos e da bola** coerente com essas sombras: hoje são uma hemisférica e duas direcionais
   (`criarLuzes`). Quero volume nos corpos (luz principal, preenchimento, um contraluz que recorta a silhueta
   contra a arquibancada), sem estourar o branco das camisas e sem deixar o lado de trás (o que a câmera vê: as
   costas do cobrador) escuro. Poucas luzes (custo por pixel). Se mexer em mapeamento de tom ou espaço de cor do
   renderizador, tem que ficar coerente em TODOS os materiais (o estádio usa shaders próprios com cor pintada).
3. **Bola** com cara de bola: gomos (clássica preta e branca de 32 gomos ou parecida), costura sugerida, um brilho
   leve de couro; continua legível de longe e girando com o efeito.
4. **Acabamento do gramado e do estádio, só o que for barato e claramente melhor**: grama perto da câmera
   (hoje há um ruído por shader), faixas de corte, linhas nítidas ao longe, flashes de câmera na torcida, brilho
   dos refletores, uma vinheta leve (CSS por cima do canvas não custa nada no WebGL; o vídeo do replay grava só o
   canvas, então não dependa dela para o visual principal). Não refaça o que já está bom.
5. **Orçamento**: o cenário inteiro custa hoje umas 15 chamadas de desenho; as sombras de todos os bonecos + bola
   devem custar no máximo ~25 chamadas no caminho rápido; nada de mapa de sombra nem passada de tela cheia.

## Como conferir
- No jogo (`index.html?teste`), com a câmera do jogo no celular (390×844) e câmera livre: cobrador parado, correndo
  e chutando (as sombras acompanham as pernas), barreira pulando, goleiro mergulhando, bola no alto e quicando,
  replay (câmera lateral de cima: é onde as sombras mais aparecem), pênalti. Compare com `.../harness/antes/`.
- `jogoTeste.desenho()` antes e depois; sem erro de console; `node testes/fisica.mjs`, `defesa.mjs`, `ranking.mjs`.
- Teste os dois caminhos da sombra (com e sem `criarSilhueta`: para simular o método, você pode escrever na sua
  página de teste um `criarSilhueta` provisório por cima do boneco atual) e `qualidade(0)`.

## Entregue
Commit no ramo e o relatório (formato no contexto comum) com: o que `cenario.refletores` devolve, como as sombras
são desenhadas (e quantas chamadas custam em cada caminho), o que mudou na luz, capturas de antes e depois, e o que
quem integra precisa conferir quando o boneco novo (com `criarSilhueta`) chegar.
