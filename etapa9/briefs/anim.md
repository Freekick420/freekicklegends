# Frente ANIMAÇÃO — a corrida e o chute do cobrador (`js/cobranca.js`)

Diretório de trabalho (git worktree, ramo `etapa9-anim`): **/home/user/fkl-anim**. Rascunho (roteiros, capturas):
`PASTA_DE_RASCUNHO/anim/`. Porta do harness: **8811**
(a crítica usa 8812 e a correção 8813). Leia antes o contexto comum: `.../scratchpad/briefs/comum.md`.

## Arquivos seus
- `js/cobranca.js` (reescreva à vontade), testes novos em `testes/` (ex.: `testes/cobranca.mjs`, página de
  inspeção `testes/cobranca.html`). **Não edite** `js/jogadores.js`, `js/main.js`, `js/elenco.js` nem os outros:
  o boneco está sendo refeito por outra pessoa ao mesmo tempo (as juntas e o formato da pose não mudam).

## Como é hoje (e por que o dono reclamou)
`criarCobranca` usa um ciclo de corrida senoidal (`poseCorrida`) com o corpo deslizando em linha reta a
velocidade constante (os pés escorregam, o número de passos da lenda não é respeitado de verdade), e um chute
com 6 poses-chave (`CHAVES_CHUTE`) iguais para todo mundo e toda batida. Visto de lado
(`.../scratchpad/base/fumaca/11-lado-050.png`, `12-lado-contato.png`, `13-lado-depois.png`): na corrida os dois
braços vão esticados para a frente, o tronco fica em pé e duro; no contato parece um toquinho (sem perna armada
atrás, sem giro de quadril, sem inclinação); a terminação é a perna subindo reta com o corpo parado.

## O que o jogo espera de você (contrato com `js/main.js`, já ligado na base; não mude os nomes)
```js
const animacao = criarCobranca(personagem, { bola: {x, z}, alvo: {x, z}, pe: 'D' | 'E', cfg, estilo });
//   personagem: o boneco de js/jogadores.js (personagem.grupo, .juntas, .aplicarPose(pose), .pontoNoGrupo(junta, x, y, z))
//   cfg.cobrador: CONFIG.cobrador (PADRAO_COBRANCA + ajustes do painel; main.js troca distancia, angulo, cadencia,
//                 corrida, postura e braco pelos da lenda em configDaCobranca). cfg.raioBola: 0,11.
//   estilo: o campo `cobranca` da lenda em js/elenco.js, cru: { postura, distancia (m), angulo (graus), passos,
//           ritmo, batida: 'chapa' | 'peito' | 'pancada' | 'semGiro' | 'trivela', braco: 'normal' | 'aberto', assinatura }
animacao.inicio        // { x, z, rotacaoY }: onde o cobrador espera. NÃO pode mudar depois de criado (a câmera enquadra por ele)
animacao.tempoContato  // s do começo da corrida até o pé tocar a bola. O main.js lê DEPOIS de preparar()
animacao.duracao       // s até o fim da terminação
animacao.direcao       // vetor para onde o corpo fica virado no chute
animacao.parado(t)     // pose de espera enquanto o jogador mira (t: relógio em s). Chamado a cada quadro antes do chute
animacao.preparar({ forca, contato: {x, y}, alvo: {x, z}, tecnica })
//   chamado UMA vez, no instante em que a corrida começa (e de novo no replay, com os mesmos valores):
//   forca 0..1 (a barra); contato: onde o pé pega na bola, círculo de raio 1 (x > 0 = lado direito da bola,
//   y > 0 = parte de cima); alvo: a mira na linha do gol; tecnica: o que a física prevê para esse chute
//   ('rasteiro' | 'folhaSeca' | 'semRotacao' | 'trivela' | 'curva' | 'cavadinha' | 'pancada' | 'colocado').
//   É aqui que você escolhe a batida do corpo. Pode mudar tempoContato e duracao; não pode mudar inicio.
animacao.atualizar(t, { bola: {x, y, z}, resultado, tFim })
//   t: s desde o começo da corrida (negativo = ainda esperando: acontece no replay). bola: posição da bola da
//   física (para o cobrador acompanhar com a cabeça depois do chute). resultado: null até o lance acabar; depois
//   'gol' | 'defesa' | 'trave' | 'fora' | 'cima' | 'barreira' | 'jogador' | 'curta'. tFim: s desde o resultado.
//   Devolve { etapa: 'parado' | 'corrida' | 'chute' | 'fim', progresso, contato } (contato: true a partir do toque).
animacao.reage         // ponha true: aí é você quem faz a comemoração e o lamento dentro de atualizar()
```
O main.js dispara a física da bola no primeiro quadro em que `atualizar` devolve `contato: true` e já anda a
bola pelo tempo que passou desde `tempoContato` (a bola sai no instante exato do toque, mesmo entre dois quadros).
Continue exportando `PADRAO_COBRANCA`, `poseChute`, `poseComemoracao`, `poseLamento`, `poseCobradorPronto`,
`poseCorrida`, `bolaNoContato`, `TEMPO_CONTATO` (o main.js e `testes/jogadores.html` importam; podem virar
versões simples do que você fizer, mas têm que existir e funcionar).

Formato da pose e eixos: cabeçalho de `js/jogadores.js`. A base da etapa 9 acrescentou campos: `pernaE/D.giro`
(gira a perna em torno do eixo da coxa, para fora: a rotação do quadril de quem bate de chapa), `pernaE/D.pe`
(gira só o pé no tornozelo), `bracoE/D.giro`, `cabeca.lado`. Você também pode mexer direto nas juntas
(`personagem.juntas.pernaD.quaternion` etc.) depois de `aplicarPose`, como `js/animacaoDefesa.js` faz no goleiro
(veja lá a cinemática inversa de dois ossos da perna, com o pé plantado no chão: é o modelo a seguir).
Medidas: leia das juntas (`-juntas.joelhoE.position.y` = coxa, `-juntas.tornozeloE.position.y` = canela) e use
`SOLA` e `PEITO_DO_PE` exportados por `js/jogadores.js` (as proporções do boneco vão mudar um pouco: não fixe números).

## O que fazer (metas, em ordem de importância)
1. **Corrida com passos de verdade**: planeje as pisadas (pé esquerdo, pé direito...) do ponto de espera até o pé
   de apoio ao lado da bola: o número de passos da lenda (`estilo.passos`), passadas que crescem (arranca curto,
   chega comprido), ritmo da lenda (`estilo.ritmo`). Em cada passada o pé fica **plantado** (cinemática inversa
   da perna) e o outro balança por cima; o quadril segue um caminho suave entre as pisadas (sobe e desce um
   pouco). Zero escorregão. Braços alternados com as pernas, cotovelos dobrados, tronco inclinado para a frente.
   A penúltima passada é mais longa e o corpo já vai abrindo para a bola.
2. **O chute como ele é** (peito do pé / chapa, de quem vem na diagonal):
   - pé de apoio pisa de calcanhar ao lado da bola (uns 15 a 25 cm do centro dela, para o lado), bico apontando
     perto da direção do chute; o joelho de apoio dobra e amortece; o corpo inclina um pouco para o lado do apoio;
   - perna do chute armada atrás: quadril estendido (coxa para trás uns 30°), joelho dobrado 90° a 110°, bacia
     girada para trás do lado do chute, tronco contra-girando (o "arco" do corpo), braço do lado do apoio aberto
     para fora e para trás;
   - a descida em chicote: primeiro a bacia gira para a frente, a coxa vem, e só no fim a canela estende rápido
     (no contato o joelho está quase esticado, o tornozelo travado com o bico para baixo; na chapa a perna inteira
     gira para fora, `giro`, e o pé pega com a parte de dentro);
   - no contato o pé encosta **no ponto certo da bola**: atrás dela, deslocado conforme `contato` (x: o lado da
     bola onde o pé pega; y: embaixo ou em cima). Erro menor que 3 cm entre o ponto do pé que bate e esse ponto
     da superfície da bola em `t = tempoContato` (use cinemática inversa na perna do chute perto do contato);
   - a terminação depende da batida: chapa/curva = a perna cruza na frente do corpo e sobe; peito do pé e
     pancada = a perna sobe reta na direção do chute e o corpo dá um saltinho para a frente, caindo no pé que
     chutou; sem rotação (`semGiro`, `semRotacao`) = batida seca, a perna trava logo depois da bola; trivela =
     a perna sai de dentro para fora, pé girado para dentro; cavadinha = pé entra por baixo, terminação curta;
     rasteiro = corpo por cima da bola, terminação baixa.
   - a intensidade acompanha `forca` (armada maior, terminação mais alta e mais longa com a barra cheia).
   A batida do corpo sai de `tecnica` (o chute que o jogador escolheu) combinada com a `batida` de costume da
   lenda. O canhoto é o espelho exato do destro.
3. **Antes e depois**: a espera com o jeito de cada lenda (`postura`: mantenha os nomes que existem em POSTURAS) e
   vida (respira, troca o peso, olha a bola e o gol); depois do chute o cobrador se recompõe, **acompanha a bola
   com a cabeça** e reage ao resultado (comemoração variada no gol; lamento no erro; no "quase" leva as mãos à
   cabeça), com transições suaves e sem atravessar o próprio corpo.
4. **Sem saltos**: nenhuma junta pula de um quadro para o outro (limite a velocidade angular; nada acima de
   ~25 rad/s fora do chicote da canela), o corpo não teleporta, os pés não entram no gramado nem flutuam quando
   apoiados, joelhos e cotovelos nunca dobram ao contrário.
5. **Tempo de jogo**: o tempo do soltar do botão até o contato fica parecido com o de hoje (de ~0,9 s para quem
   corre pouco até ~2,0 s para quem corre muito). O jogo é de repetir rápido.
6. Determinismo (nada de `Math.random`), custo baixo por quadro (sem criar muito lixo: reaproveite vetores).

## Como conferir (faça de verdade; é o que separa "compila" de "ficou bom")
- **Números primeiro** (rápido, sem navegador): `js/jogadores.js` roda no Node sem tela (as texturas ficam de
  fora); o `three` pode ser resolvido de `.../scratchpad/harness/vendor/three-0.160.0/package/build/three.module.js`
  com um pequeno carregador (`node --import ./testes/...` com `module.register`, ou copie a ideia que achar
  melhor; documente como rodar). Escreva `testes/cobranca.mjs` medindo, para várias lendas (destro, canhoto,
  corrida curta e longa) e várias batidas: escorregão de cada pé plantado (< 2 cm), pé abaixo do chão (< 1 cm),
  distância pé–ponto de contato em `tempoContato` (< 3 cm), maior salto de junta entre quadros de 1/60 s, tempo
  até o contato, `inicio` que não muda com `preparar`, canhoto = espelho do destro, replay (mesmos valores,
  mesma animação). Esses testes ficam no repositório.
- **Depois o olho**: capturas quadro a quadro com a câmera livre (receita no contexto comum): de lado (os dois
  lados), de frente (do gol para o cobrador), de trás (a câmera do jogo) e de cima; uma sequência a cada 0,05 s
  de 0,35 s antes até 0,35 s depois do contato para pelo menos: Juninho (8, destro, semGiro), Roberto Larcos
  (3, canhoto, corrida longa), Beckam (23, chapa com braço aberto), Ronaldiño (80, quase sem corrida) e
  Kaine (9). Olhe as imagens e corrija o que parecer boneco: é para parecer um jogador batendo falta.
- Rode também o jogo inteiro (modo normal, replay e pênalti) para garantir que nada quebrou: `estado().fase`
  chega em 'fim', sem erro de console.

## Entregue
`js/cobranca.js` novo, testes, commit no ramo, e o relatório (formato no contexto comum) com: os números dos
testes, os caminhos das sequências de capturas, a lista dos campos de `estilo`/`cfg.cobrador` que você usa (e
quais sliders do painel ainda fazem efeito), e o que você acha que ainda não está bom.
