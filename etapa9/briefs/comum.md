# Free Kick Legends — etapa 9: gráfico e movimento mais realistas (contexto comum a todas as frentes)

## O jogo
Jogo de cobrança de faltas em 3D para celular (navegador, em pé), sem build: HTML + módulos ES + Three.js 0.160.0.
Tudo é feito por código (geometria e texturas de canvas), sem arquivos de modelo nem imagens. Leia `CLAUDE.md` e
`PROJETO.md` na raiz do seu diretório de trabalho: convenções, eixos, regra do replay, o que cada arquivo faz.
Comentários e nomes em português, no estilo dos arquivos (2 espaços, aspas simples, ponto e vírgula).

## O pedido do dono do projeto (ele não programa; joga no celular com os amigos)
"Eu gosto pra caramba da mecânica do jogo, da bola. Mas a gente precisa melhorar a mecânica dos cobradores, a forma
que eles chutam a bola, a movimentação da perna. E o principal: quero que a gente melhore pra caramba o gráfico do
jogo. Quero que fique muito mais realista. Eu quero algo parecido com cobrança de falta no PlayStation 2 [o treino
de faltas do PES / Winning Eleven], eu ficava muito batendo falta nos treinamentos lá. Quero que você capriche."

## Direção de arte (a referência é o PES/Winning Eleven do PS2, jogo noturno, treino de faltas)
- **Jogadores de verdade, não bonecos**: proporção de atleta adulto (7,5 a 8 cabeças de altura, pernas compridas,
  ombros mais largos que o quadril), volumes de músculo (panturrilha, coxa, glúteo, deltoide), mãos e pés com forma,
  uniforme com cara de tecido (dobras e sombras pintadas, barra da manga, gola, calção solto até acima do joelho,
  meião até abaixo do joelho, chuteira com forma e sola), número e nome nas costas.
- **Movimento de gente**: corrida com passos que pisam e não escorregam, pé de apoio ao lado da bola, perna do chute
  que vai atrás dobrada e chicoteia (coxa primeiro, canela depois), quadril e tronco girando, braço de equilíbrio,
  terminação que depende da batida (chapa, peito do pé, pancada, sem rotação, trivela).
- **Estádio à noite sob refletores**: luz forte de cima vinda dos quatro cantos, as quatro sombras em cruz embaixo de
  cada jogador (a marca registrada dos jogos de futebol daquela época), gramado com faixas de corte, bola nítida.
- Tudo isso **leve**: roda em celular. Nada de sombra em tempo real por mapa de sombra, nada de pós-processamento em
  tela cheia, nada de arquivo externo. Truques baratos e bem escolhidos valem mais que técnica cara.

## Regras que valem para todos
- **Não mude a física nem as regras do jogo** (voo da bola, goleiro, barreira, erro da mira): o dono gosta delas.
- **Replay = repetir a cobrança**: nada que afete bola, barreira ou goleiro pode usar `Math.random`. A parte visual
  também deve ser determinista no modo teste (use sorteio com semente ou o tempo de jogo), para as capturas se repetirem.
- Mantenha as APIs públicas descritas na sua frente de trabalho; outras pessoas estão mexendo em outros arquivos ao
  mesmo tempo, cada uma num diretório próprio (git worktree). **Edite só os arquivos da sua frente.**
- Não mexa no `?v=9` dos imports nem em `VERSAO` (isso é feito no fim, por quem integra).
- Os testes de Node têm que continuar passando: `node testes/fisica.mjs`, `node testes/defesa.mjs`, `node testes/ranking.mjs`.
- Orçamento de desempenho (celular médio a 60 quadros por segundo, celular fraco jogável): o jogo inteiro hoje desenha
  com poucas chamadas (meça com `jogoTeste.desenho()` antes e depois e relate); não passe de ~260 chamadas de desenho
  nem de ~160 mil triângulos por quadro no pior caso (cobrador + 5 na barreira + goleiro); criar um boneco novo
  (acontece a cada falta) não pode travar o jogo (meça em ms, com e sem cache).
- Ao terminar: `git add -A && git commit` **no seu diretório** (mensagem em português, uma linha, terminando com as
  duas linhas abaixo) e **não faça push**.
  ```
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  Claude-Session: LINK_DA_SESSAO_ATUAL
  ```

## Como ver o jogo (capturas de tela com Playwright)
O CDN do Three.js não abre neste ambiente; existe um harness pronto que serve o jogo localmente e intercepta o import:
`PASTA_DE_RASCUNHO/harness` (leia o `README.md` de lá).
Uso: `cd <harness> && node captura.mjs <roteiro.json> --raiz <SEU diretório de trabalho> --porta <SUA porta> --saida <pasta>`.
**Use sempre a SUA porta e a SUA raiz** (outras frentes rodam ao mesmo tempo, cada uma na sua). Guarde roteiros e
capturas na SUA pasta de rascunho (indicada na sua frente), nunca dentro do repositório.
O navegador sem placa de vídeo é lento (uns 5 a 20 quadros por segundo): prefira `"escala": 1`, poucas fotos por
roteiro, e use os ganchos de tempo abaixo em vez de esperar o jogo rodar.

O jogo aberto com `index.html?teste` expõe `window.jogoTeste` (veja o fim de `js/main.js`). Além dos de sempre
(`falta(dist, ang)`, `cobrador(numero)`, `mirar(x)`, `contato(x, y)`, `chutar(forca)`, `estado()`, `replay()`,
`modo('treino'|'desafio'|'penalti')`, `goleiro()`), a base da etapa 9 tem ganchos novos:
- `pausar(true|false)`: congela o tempo do jogo (a tela continua sendo desenhada).
- `avancar(segundos)`: anda o jogo esse tempo de uma vez, em quadros de 1/60 s, sem desenhar (funciona pausado).
  `avancarAte(() => condição, limiteSegundos)`: anda quadro a quadro até a condição valer.
- `camera({ pos: [x, y, z], olhar: [x, y, z], fov, seguir })`: câmera livre. Com `seguir: true`, `pos` e `olhar` são
  relativos ao cobrador em x e z (a câmera anda com ele). `camera(null)` devolve a câmera do jogo.
- `hud(false)`: esconde a interface para a foto ficar limpa.
- `tempos()` → `{ fase, tCobranca, tempoContato, duracao, tempoVoo, tempoDeJogo }`; `desenho()` → chamadas de
  desenho, triângulos, geometrias e texturas do último quadro; `cobradorPos()`, `bolaPos()`.
Receita para fotografar o chute quadro a quadro, de lado (adapte):
```json
{ "perfil": "computador", "escala": 1, "url": "index.html?teste", "saida": "…", "passos": [
  { "esperarJogo": true },
  { "js": "const t = window.jogoTeste; t.hud(false); t.falta(22, 0); t.cobrador(8); t.mirar(1.5); t.contato(0.4, 0.1); t.pausar(true); t.chutar(0.8);" },
  { "js": "window.jogoTeste.camera({ pos: [4.5, 1.1, 0.3], olhar: [0, 0.9, 0], seguir: true, fov: 30 })" },
  { "js": "window.jogoTeste.avancar(0.30)" }, { "esperarQuadros": 2 }, { "foto": "lado-030" },
  { "js": "window.jogoTeste.avancar(0.05)" }, { "esperarQuadros": 2 }, { "foto": "lado-035" }
] }
```
(Depois de `avancar`, espere 2 quadros desenhados antes da foto: passo `esperarQuadros`; se o harness não tiver esse
passo, use `{ "avaliar": "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))" }`.)
As capturas de "antes" (o jogo como está publicado hoje, etapa 8.1) estão em `<harness>/antes/`: use para comparar.
**Olhe as imagens** com a ferramenta de leitura de imagem: quem decide se ficou bom é o olho, não o `node --check`.

## Relatório final (o que você devolve)
Curto e exato: o que mudou e onde; o commit (hash) no seu diretório; o que você mediu (números) e viu (com o caminho
das capturas que provam); o que ficou pendente ou você não conseguiu; qualquer coisa que quem integra precisa saber
(API nova, campo novo, ajuste em outro arquivo que não é seu).

## Resumo do harness (caso o README de lá ainda não exista quando você começar)
`node captura.mjs <roteiro.json> --raiz <seu diretório> --porta <sua porta> [--saida <pasta>]`. O roteiro é um JSON
`{ "perfil": "celular" | "computador", "escala": 1, "url": "index.html?teste", "saida": "<pasta absoluta>", "passos": [...] }`.
Cada passo tem uma chave: `esperarJogo: true` | `esperarSegundos: n` (tempo de jogo) | `esperarQuadros: n` |
`esperarAte: "expressão JS"` (+ `limiteSegundos`) | `esperarReal: ms` | `esperarSeletor: "css"` | `foto: "nome"`
(+ `recorte: {x, y, largura, altura}` ou `seletor`) | `js: "código"` | `avaliar: "expressão"` + `guardar: "nome"`
(vai para `resultado.json`) | `clicar: "css"` | `tamanho: {largura, altura}` | `abrir: "outra url"`.
Os quadros da página ficam retidos entre um passo e outro: o jogo só anda dentro dos passos `esperar...`.
Perfil `celular` = 390×844 (o alvo do jogo); `computador` = 1280×720. Uma execução típica leva de 20 a 60 s.
Capturas da base da etapa 9, de lado, para referência do estado atual: `.../scratchpad/base/fumaca/` (o roteiro
que as gerou está em `.../scratchpad/base/fumaca.json`: use como modelo). As capturas de "antes" em
`.../scratchpad/harness/antes/` podem ainda estar sendo geradas quando você começar.
