# Frente FIGURANTES — outros jogadores em campo, como num jogo de verdade

Diretório de trabalho (git worktree, ramo `etapa9-fig`): **/home/user/fkl-fig**. Rascunho:
`PASTA_DE_RASCUNHO/fig/`. Porta do harness: **8841**
(a crítica usa 8842 e a correção 8843). Leia antes o contexto comum: `.../scratchpad/briefs/comum.md`.

## O pedido
O dono do projeto: "Coloca outros jogadores em campo também, não só os da barreira, parecendo um jogo real mesmo."
Hoje o campo tem só o cobrador, a barreira (2 a 5) e o goleiro. Quero a cobrança com cara de lance de jogo:
companheiros do cobrador e adversários espalhados como numa falta de verdade (na área esperando o rebote, marcando
um ao outro, na sobra, atrás da bola), vivos (não estátuas) e reagindo ao chute e ao resultado.

## Arquivos seus
- `js/figurantes.js` (lógica, **sem Three.js**, roda no Node: onde cada um fica e a colisão com a bola) e
  `js/animacaoFigurantes.js` (os bonecos e a animação). Hoje os dois são cascas vazias com o contrato pronto.
  Testes: `testes/figurantes.mjs` (Node). Página de inspeção se quiser (`testes/figurantes.html`).
- **Não edite** `js/main.js` (já chama os seus módulos; se precisar de algo a mais, descreva no relatório),
  `js/jogadores.js` (o boneco está sendo refeito por outra pessoa; a API não muda), `js/sombras.js`, `js/estadio.js`,
  `js/cobranca.js`, `js/elenco.js`, `js/painel.js` (os sliders `figurantes.quantidade` e `figurantes.colisao` já existem).

## Contrato com o `js/main.js` (já ligado na base; mantenha nomes e formas)
```js
// js/figurantes.js
export const PADRAO_FIGURANTES = { quantidade: 10, colisao: true, ... };   // vira CONFIG.figurantes (pode acrescentar chaves)
figurantes = montarFigurantes(posBola, barreira, CONFIG, sorteio, { penalti, cobrador: {x, z}, pe, goleiro: {x, z} });
//   posBola {x, z}; barreira: o que js/barreira.js devolveu (barreira.jogadores[] com x, z; vazio no pênalti);
//   sorteio: função 0..1 COM SEMENTE (a da jogada: o replay e o Desafio do Dia repetem tudo igual);
//   cobrador: onde o cobrador espera para correr; pe: 'D' | 'E'; goleiro: onde o goleiro fica.
//   Devolve { jogadores: [{ x, z, rotacaoY, time: 'ataque' | 'defesa', altura, raio, ... }], ... } (acrescente o que precisar)
atualizarFigurantes(figurantes, tDesdeChute);       // a cada passo da física (1/240 s) depois do chute; antes do chute, −1
colidirBolaFigurantes(bola, figurantes, CONFIG);    // depois de cada passo da bola, se CONFIG.figurantes.colisao
//   bateu: desvia a bola e registra bola.eventos.push({ tipo: 'jogador', time: 'ataque' | 'defesa', impacto, x, y, z })
//   (o main.js toca o som e mostra "NA ZAGA!" / "NO COMPANHEIRO!"; gol depois de desvio vale: "Desviou no caminho")

// js/animacaoFigurantes.js
const anim = criarAnimadorFigurantes(scene, { criarSombra });   // uma vez
//   criarSombra(personagem, { raio }) → { atualizar({ x, z, altura }), remover() }  (sombra no gramado, de js/sombras.js)
anim.montar(figurantes, { uniformeAtaque, uniformeDefesa, semente });   // a cada cobrança nova (e quando o cobrador muda)
//   uniformes no formato de js/jogadores.js (o do time do cobrador e o do rival); semente: número 0..1 da jogada
anim.atualizar(figurantes, t, dt, { fase, tempoDesdeChute, bola, resultado });   // a cada quadro
//   fase: 'pronto' | 'carregando' | 'corrida' | 'voo' | 'fim'; tempoDesdeChute: s (negativo na corrida, null antes);
//   bola: a bola da física (bola.pos, bola.vel); resultado: null até acabar; depois 'gol' | 'defesa' | 'trave' |
//   'fora' | 'cima' | 'barreira' | 'jogador' | 'curta'
anim.limpar();
```
Os bonecos são os de `js/jogadores.js`: `criarPersonagem({ visual, uniforme, numero, nome: '' })` →
`{ grupo, aplicarPose(pose), juntas, altura, dispose(), ... }`, com aparências genéricas de `visualAdversario(indice, altura)`
(formato da pose: cabeçalho de `js/jogadores.js`; exemplos de animação por cima das juntas: `js/animacaoDefesa.js`,
que faz o goleiro e a barreira). Leia `js/barreira.js` (a lógica e a colisão da barreira são o modelo para a sua
lógica: cápsula em pé + cabeça, amostragem do caminho da bola entre dois passos, mesma semente = mesma montagem).

## Regras de posicionamento (a lógica precisa garantir; teste no Node com centenas de faltas sorteadas)
- **Não atrapalhar o chute que vai no gol**: ninguém dentro do "corredor do chute" = a região entre a bola e o gol
  (da bola até qualquer ponto entre as traves, com 1 m de folga para fora de cada trave), alargada para os lados
  pela curva que a bola pode fazer (até uns 2,5 m no meio do caminho). Os figurantes ficam FORA desse corredor:
  em falta frontal, abertos para os dois lados da área; em falta lateral, concentrados no meio da área e na
  segunda trave, como numa falta de verdade. A bola só bate neles em chute torto, bola desviada ou rebote.
- **Regra do jogo**: adversários a pelo menos 9,15 m da bola; companheiros a pelo menos 1 m da barreira; no
  **pênalti** (bola em z = 11, x = 0), todo mundo fora da grande área (z ≥ 16,5 ou |x| ≥ 20,16), a pelo menos
  9,15 m da bola e atrás da linha da bola: a clássica fila na risca da área e na meia-lua, pronta para o rebote.
- **Não atrapalhar a câmera nem o cobrador**: a câmera do jogo fica atrás da bola (uns 6 a 12 m atrás, a 2,2 m de
  altura, olhando o gol). Ninguém perto da reta que vai da bola para trás (deixe pelo menos 5 m livres para cada
  lado dessa reta, até 16 m atrás da bola), ninguém a menos de 2 m do caminho da corrida do cobrador
  (de `opcoes.cobrador` até a bola) nem a menos de 3 m da bola. O replay usa uma câmera lateral alta (do lado
  +x, a 24 m, 12 m de altura): jogadores atrás da bola aparecem nela, vale ter um ou dois companheiros lá.
- Dentro do campo (|x| ≤ 33; 0,5 ≤ z ≤ 52), longe do goleiro (≥ 2,5 m) e das traves, sem ninguém em cima de
  ninguém (duplas de marcação lado a lado a uns 0,6 a 0,9 m; os demais a mais de 1,5 m).
- Papéis plausíveis, em duplas atacante + marcador na área, sobra da defesa, companheiros na entrada da área para
  o rebote, um ou dois atrás da bola. `quantidade` é o total (padrão 10; 0 = campo vazio; a montagem com menos
  gente tira primeiro os menos importantes). Mesma semente = mesma montagem; nada de `Math.random`.
- A quantidade e as posições valem igual para todo mundo (afetam a colisão): nada de reduzir por desempenho.

## Colisão
Como a da barreira (reaproveite o que der de `js/barreira.js`): corpo em cápsula + cabeça, rebote com pouca força,
evento `{ tipo: 'jogador', time, ... }`. Se os figurantes se mexerem depois do chute (ex.: atacante dando dois
passos para o rebote), o movimento que vale para a colisão é função só do tempo desde o chute e da montagem
(determinista), calculado em `atualizarFigurantes`; a animação acompanha.

## Vida (a animação)
- Antes do chute: cada um com um jeito (pronto para correr, mãos na cintura, apontando, marcando com o braço no
  adversário, olhando a bola, ajeitando o meião...), respirando e trocando o peso, com variação por jogador
  (use a semente). Nada de todo mundo igual e sincronizado.
- No chute: acompanham a bola com a cabeça e o corpo; quem está na área se prepara para o rebote (um passo, um
  giro); nada de teleporte nem de pé deslizando de forma visível.
- No resultado: gol = companheiros comemoram (braços para cima, pulo, alguns correm um pouco em direção ao
  cobrador) e adversários lamentam (mãos na cintura, na cabeça, olham para baixo); defesa/fora = o contrário, mais contido.
- Custo: poucos bonecos, mas todo quadro: mantenha `atualizar` leve (reaproveite objetos; os mais distantes da
  câmera podem atualizar a pose a cada 2 quadros). Recicle os bonecos entre cobranças quando o uniforme não mudou.
  Hoje cada boneco custa uns 23 desenhos; o boneco novo (em paralelo) vai custar no máximo 6: conte com isso.

## Como conferir
- `node testes/figurantes.mjs` (novo, fica no repositório): para centenas de faltas (distância 18 a 33 m, ângulo
  −32° a 32°, as duas pernas, com e sem pênalti, várias quantidades), ninguém no corredor, nas zonas proibidas ou em
  cima de outro; mesma semente = mesma montagem; a colisão desvia a bola e registra o evento; um chute bom no
  ângulo nunca bate em figurante (simule com `js/physics.js`: vários chutes de curva e de força nos dois cantos).
- No jogo, pelo harness (celular 390×844 e câmera livre): falta frontal, falta lateral dos dois lados, falta longa,
  pênalti, replay (câmera lateral), gol e erro (reações). `jogoTeste.figurantes()` lista as posições.
  Compare com `.../harness/antes/` (o campo vazio de hoje). Sem erro de console; testes de Node passando.

## Entregue
Commit no ramo e o relatório (formato no contexto comum) com: a lógica de posicionamento em poucas linhas, os
números dos testes, quantas chamadas de desenho os figurantes somam hoje (com o boneco atual), capturas, e o que
você precisaria que o `main.js` fizesse diferente (se houver).
