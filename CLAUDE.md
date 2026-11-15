# Free Kick Legends

A especificação completa (escopo, mecânica, ordem de construção) está em `PROJETO.md`. Leia antes de mudar qualquer coisa: ela é a fonte da verdade.

**Etapa 9 em pausa (11/11/2026).** Este ramo tem trabalho pela metade e não está pronto para publicar. Antes de qualquer coisa, leia `etapa9/RETOMAR.md`: ele diz o que está feito, o que falta e como continuar. (Apague este aviso e a pasta `etapa9/` quando a etapa 9 for publicada.)

## Como trabalhar neste projeto

- Quem conduz o projeto não programa. Responda em português simples; ao usar um termo técnico, explique em uma frase.
- Etapas pequenas. Ao fim de cada etapa: o que mudou e como testar no computador e no celular.
- Um commit por etapa que funciona.
- Nada fora do escopo da v0.1 sem perguntar antes.

## Convenções técnicas

- Sem build: HTML + JavaScript (módulos ES) + Three.js `0.160.0` pelo import map do `index.html`.
- Arquivos:
  - `js/config.js`: todos os números ajustáveis (`CONFIG`) e o rótulo `VERSAO` mostrado na tela.
  - `js/physics.js`: física da bola, sem dependência do Three.js (dá para rodar no Node).
  - `js/main.js`: cena, câmera, controles, loop, replay, os três modos (`estado.modo`: treino, desafio, penalti), o Desafio do Dia (sementes pela data, recordes e compartilhar) e a cola entre os módulos abaixo.
  - `js/elenco.js`: as 22 lendas (atributos, pé, uniforme, jeito de cobrar, visual), os uniformes dos rivais (`RIVAIS`), `overall`, nota por falta (`notaParaFalta`), nota por pênalti (`notaParaPenalti`) e sugestão de cobrador.
  - `js/interface.js`: HUD (cartão do cobrador, lista "Quem bate?", resultado, placar, botões de modo). Só mexe no HTML.
  - `js/estadio.js`: gramado, gol, rede de pano (massa-mola), arquibancadas e torcida. `PADRAO_CENARIO`.
  - `js/barreira.js` e `js/goleiro.js`: lógica (posição, pulo, reação, mergulho, colisão), sem desenho. `PADRAO_BARREIRA`, `PADRAO_GOLEIRO`, `PADRAO_PENALTI` (goleiro de pênalti: adivinha o canto, dica, memória) e `semBarreira` (pênalti).
  - `js/jogadores.js`: bonecos (corpo, rosto, uniformes), o formato da pose (`aplicarPose`, descrito no cabeçalho) e as poses da defesa.
  - `js/cobranca.js`: o cobrador em movimento (espera com a postura de cada lenda, corrida, chute, terminação, comemoração e lamento): `criarCobranca`, `PADRAO_COBRANCA`. O `main.js` avisa o chute escolhido com `animacao.preparar(...)` e passa a bola e o resultado em `animacao.atualizar(t, contexto)`.
  - `js/animacaoDefesa.js`: desenho do goleiro e da barreira por cima da lógica (passos, mergulho, queda, gestos).
  - `js/figurantes.js` (lógica, sem Three.js) e `js/animacaoFigurantes.js` (bonecos): os outros jogadores em campo, além do cobrador, da barreira e do goleiro. `PADRAO_FIGURANTES`. Posições com a semente da jogada (`sorteioDaJogada(3)`); a bola bate neles (evento `jogador`).
  - `js/bola.js`: a bola desenhada (textura, giro na tela, aumento à distância). `js/sombras.js`: sombras no gramado (bonecos e bola).
  - `js/audio.js`: som sintetizado (sem arquivos). `PADRAO_AUDIO`.
  - `js/replay.js`: grava a cobrança em vídeo (MediaRecorder) e baixa/compartilha o gol.
  - `js/painel.js`: painel de ajuste (sliders que mudam o `CONFIG` na hora). Todo número novo que afete a sensação do jogo ganha um slider aqui. `bloquear(sim)`: no Desafio do Dia o painel some e os números do jogo voltam ao padrão (som, câmera e cenário ficam).
  - `js/ranking.js`: ranking do dia na internet (Supabase por HTTP: `enviar`, `listar`), sem Three.js. Endereço e chave em `CONFIG.ranking`; vazios = desligado. Teste: `node testes/ranking.mjs`.
  - Os `PADRAO_*` dos módulos entram no `CONFIG` quando o jogo abre (`js/main.js`); o que está escrito em `config.js` tem prioridade. No desafio, o goleiro usa `PADRAO_GOLEIRO` + `CONFIG.desafio.goleiro` (fixo, fora do painel): todo mundo enfrenta o mesmo goleiro.
  - `testes/fisica.mjs` e `testes/defesa.mjs`: testes no Node. Rodar `node testes/fisica.mjs` e `node testes/defesa.mjs` antes de cada commit que mexa na física, no goleiro ou na barreira. `testes/*.html` são páginas de inspeção visual.
- Eixos: x = direita de quem cobra, y = para cima, z = do gol para quem cobra. Gol em z = 0, chute vai para z negativo.
- **Replay = repetir a cobrança.** A física anda em passos fixos (`PASSO_FISICA`), e todo sorteio que afeta o lance vem de `sorteioDaJogada(n)` (montagem; n = 2 é a decisão do goleiro de pênalti) ou `sorteioChute` (chute e goleiro no voo), com sementes guardadas em `registro` (junto com o modo, a pressão e o histórico de pênaltis). Nunca use `Math.random`/`aleatorio` em algo que mude a bola, a barreira ou o goleiro depois do chute, senão o replay deixa de bater. No Desafio do Dia as sementes vêm de `sementeDoTexto(dia#índice#uso)`: mesma data, mesmas faltas para todo mundo.
  - O que acontece **antes** do chute anda com os quadros (não com passos fixos) e por isso também vai guardado no `registro`: `registro.goleiro` (o goleiro do instante do contato, `guardarGoleiro`; o replay recomeça dele com `retomarGoleiro`), `registro.tContato` e `registro.relogio` (o relógio da espera do cobrador, `animacao.relogio` lido logo depois de `animacao.preparar(...)`; o replay devolve em `preparar({ relogio })`). O resultado do lance é decidido dentro de `simular()`, no passo da física em que dá para saber (`jogada.passoDoResultado`): quem monta o texto do resultado não pode depender de nada que só fique pronto "no fim do quadro" (ex.: `fecharPalpite` do goleiro de pênalti).
  - Câmeras não entram na regra (só mostram): depois do contato a câmera do jogo segura o cobrador por `CONFIG.camera.seguraChute` s (nas faltas), o replay da falta começa com a tomada do chute (`replayChute*`) e o pênalti tem as câmeras dele (`replayPenalti*`, `reacaoPenalti*`).
- **Cache:** a hospedagem guarda arquivos em cache por alguns minutos. A cada etapa publicada, aumente o número `?v=N` em todos os imports e links (`index.html` e `js/*.js`) e atualize `VERSAO`:
  `sed -i 's/?v=[0-9]*/?v=NOVO/g' index.html js/*.js`
- Testar no celular real é obrigatório; o rótulo de versão no canto da tela confirma qual versão está carregada.
- **Modo teste:** abrir com `?teste` no endereço faz cada quadro valer exatamente 1/60 s, fixa o sorteio (e a data do Desafio do Dia em 2026-10-10) e expõe `window.tempoDeJogo` e `window.jogoTeste` (falta, cobrador, contato, mira, chutar, estado, video, modo, desafio, goleiro, placar, recordes, registro; e para capturas: pausar, avancar, avancarAte, camera, hud, tempos, desenho, cobradorPos, bolaPos, figurantes). Serve para capturas automáticas previsíveis (Playwright), mesmo com o navegador lento. Ganchos da etapa 9:
  - `avancar(segundos, quadro = 1/60)`: anda o jogo sem desenhar, em quadros do tamanho dado; `quadro(dt)`: um quadro só, do tamanho que quiser (imita celular lento ou irregular: os quadros mudam, o lance não pode mudar).
  - `diario(true)` começa a anotar uma linha de números por passo da física (bola, goleiro, barreira, figurantes), `diario()` devolve o anotado, `diario(false)` para: é como se confere que o replay repete o lance passo a passo (diferença zero). `saltoGoleiroReplay()`: m que o goleiro do replay estava longe do guardado na hora do chute. `tempos().passoDoResultado`: o passo da física em que o resultado saiu.
  - `cameraPos()` → `{ pos, olhar, fov, reacao, tomada, aerea, segura }` (`tomada`: no replay, `'chute'` | `'voo'` | `'penalti'`; `aerea`: 0 a 1, a mistura da câmera aérea; `segura`: s que a câmera do jogo fica no cobrador neste lance). `naTela(x, y, z)`: onde um ponto do campo cai na tela (pixels). `letreiro()` → `{ topo, tapa }`: onde o letreiro do último resultado foi parar (`topo` null = o lugar de sempre) e se o lugar de sempre taparia o gol ou a bola.
  - `window.interfaceTeste.mostrarResultado({ tipo, titulo, sub })`: mostra um letreiro qualquer (para conferir se cabe na tela).
  - Depois de `avancar`/`quadro`, espere 2 quadros desenhados antes de fotografar. A câmera lenta do fim do voo deixa o tempo do jogo um pouco mais devagar por alguns quadros: para comparar poses quadro a quadro entre o lance e o replay, desligue-a no painel.
- O CDN do Three.js não abre dentro do ambiente de desenvolvimento na nuvem: os testes com Playwright interceptam o import e servem uma cópia local (`npm pack three@0.160.0`).
