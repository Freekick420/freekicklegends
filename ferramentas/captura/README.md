# Harness de captura de tela — Free Kick Legends

Tira fotos do jogo (e das páginas de `testes/`) num Chromium sem tela, seguindo um roteiro em JSON.
Nada aqui mexe no repositório do jogo: o harness só lê a pasta dele por um servidor local.

## Como rodar

```sh
cd <esta pasta>
node captura.mjs roteiros/treino-celular.json                       # um roteiro (saída: o campo "saida" dele)
node captura.mjs roteiros/treino-celular.json --saida depois/treino-celular --porta 8770
node captura.mjs roteiros/treino-celular.json --raiz /outra/copia/do/jogo --porta 8771
node rodarTodos.mjs depois                                           # todos os roteiros → depois/<nome>/
node rodarTodos.mjs depois --raiz /outra/copia --porta 8780 --paralelo 2
node verificarPng.mjs antes/treino-celular/*.png                    # mede as fotos (tela preta?)
node verificarPng.mjs --comparar antes/x/01.png depois/x/01.png     # conta os pixels diferentes
```

Opções do `captura.mjs`:

| opção | padrão | o que faz |
|---|---|---|
| `--raiz <pasta>` | `/home/user/freekicklegends` | pasta do jogo servida pelo `http-server` |
| `--porta <n>` | `8765` | porta do servidor **desta execução**. Ocupada = o script para com erro (nunca reaproveita servidor alheio). Para rodar vários ao mesmo tempo, uma porta para cada um |
| `--saida <pasta>` | campo `saida` do roteiro | pasta das fotos. Caminho relativo vale **dentro da pasta do harness** |
| `--estrito` | desligado | foto suspeita (tela preta, imagem lisa) também vira falha |

Código de saída: `0` deu certo; `1` em exceção de página (`pageerror`), import que falhou (resposta ≥ 400 ou
erro de rede num `.js`), passo que falhou ou passou do limite, roteiro ou opção inválidos, porta ocupada.
`console.error` da página vira só aviso.

`rodarTodos.mjs <pasta>` roda todos os `roteiros/*.json` (menos os que começam com `_`), cada um em
`<pasta>/<nome>/`, e grava `<pasta>/resumo.json` e `<pasta>/<nome>.log`. Com `--paralelo N` usa as portas
`porta`, `porta+1`... (o ganho é pequeno: o desenho por software já usa todos os núcleos).

## O que sai em cada pasta

- `<nome>.png` de cada passo `foto`;
- `resultado.json`: `ok`, `erro`, `passos` (cada um com `ms`, `quadros`, `tempoDeJogo`), `fotos` (com a medição
  do `verificarPng`), `fotosSuspeitas`, `guardados`, `consoleErros`, `falhasRede`, `versaoDoJogo` (texto de
  `#versao`), `raizGit` (commit da pasta do jogo e quantos arquivos estavam alterados), `navegador`, `webgl`,
  `segundosReais`, `quadros`;
- `console.txt`: tudo o que a página escreveu no console, mais erros de página e de rede;
- `falha.png`: a tela na hora da falha, quando há falha.

Ao começar, o script apaga da pasta de saída só o que a execução anterior listou no `resultado.json` dela.

## Formato do roteiro

```json
{ "perfil": "celular", "escala": 1, "url": "index.html?teste", "saida": "capturas/exemplo", "passos": [
  { "esperarJogo": true },
  { "js": "window.jogoTeste.mirar(2.5); window.jogoTeste.contato(0.4, 0.1);" },
  { "foto": "antes" },
  { "js": "window.jogoTeste.chutar(0.8)" },
  { "esperarSegundos": 1.2 },
  { "foto": "voo" },
  { "esperarAte": "window.jogoTeste.estado().fase === 'fim'", "limiteSegundos": 8 },
  { "foto": "fim" },
  { "avaliar": "JSON.stringify(window.jogoTeste.estado())", "guardar": "estado" }
] }
```

Campos: `perfil` (`celular`: 390×844, toque, escala 2 · `computador`: 1280×720, escala 1), `escala`
(deviceScaleFactor; 1 é umas 4× mais rápido que 2), `url` (caminho dentro da raiz), `saida`, `passos`,
`descricao` (livre) e `congelar` (padrão `true`; ver abaixo).

| passo | o que faz |
|---|---|
| `{ "esperarJogo": true }` | espera `window.jogoTeste` existir e o primeiro quadro ser desenhado |
| `{ "esperarSegundos": 0.5 }` | deixa passar tempo **de jogo** (`window.tempoDeJogo`), arredondado para o quadro mais próximo. Em página sem `tempoDeJogo`, tempo real |
| `{ "esperarQuadros": 7 }` | deixa passar exatamente N quadros da página (com `?teste`, 1 quadro = 1/60 s de jogo) |
| `{ "esperarAte": "expressão", "limiteSegundos": 8 }` | roda até a expressão ser verdadeira, conferindo a cada quadro, e para **nesse quadro**. `limiteSegundos` é em tempo de jogo (padrão 10) |
| `{ "esperarReal": 500 }` | milissegundos reais (para páginas que não são o jogo) |
| `{ "esperarSeletor": "css" }` | espera o elemento aparecer (páginas de inspeção) |
| `{ "foto": "nome" }` | grava `<saida>/<nome>.png`. Extras: `"recorte": { "x", "y", "largura", "altura" }` em pixels CSS; `"seletor": "css"` fotografa só o elemento (com `recorte`, o recorte é medido a partir do canto do elemento); `"paginaInteira": true` |
| `{ "js": "código" }` | executa na página |
| `{ "avaliar": "expressão", "guardar": "nome" }` | o valor vai para `guardados.nome` no `resultado.json` (não deve mudar nada na página) |
| `{ "clicar": "css" }` | clica |
| `{ "tamanho": { "largura": 1440, "altura": 900 } }` | muda o tamanho da tela no meio do roteiro |
| `{ "abrir": "testes/x.html?so=retrato" }` | vai para outra página da mesma raiz |

Qualquer passo aceita `"nota": "texto"` (comentário) e `"limiteReal": segundos` (troca o limite em tempo
real). O limite real padrão de cada espera é o maior entre 180 s e 60 s por segundo de jogo pedido.

Repetição (o roteiro é "desenrolado" antes de rodar):

```json
{ "repetir": 8, "inicio": 1, "passos": [ { "esperarQuadros": 7 }, { "foto": "corrida-{{i}}" } ] }
{ "repetir": [1, 3, 7], "passos": [ { "js": "window.jogoTeste.cobrador({{v}})" }, { "foto": "cobrador-{{v}}" } ] }
```

`{{i}}` = `00`, `01`... (começa em `inicio`); `{{v}}` = o valor da vez. Não dá para pôr `repetir` dentro de `repetir`.

## Como funciona (e por que as fotos saem iguais a cada execução)

- **O jogo fica parado entre um passo e outro.** O harness troca o `requestAnimationFrame` da página por uma
  fila que ele segura: os quadros só andam dentro dos passos `esperar...`, e a espera para exatamente no
  quadro em que terminou. Uma `foto` mostra esse quadro; duas fotos seguidas mostram o mesmo instante.
- Com `?teste` cada quadro vale 1/60 s de jogo e os sorteios são fixos, então o roteiro inteiro é
  determinístico: rodando de novo, as fotos saem **idênticas pixel a pixel**, mesmo com o navegador lento ou
  com outro harness rodando ao lado (conferido com os roteiros desta pasta). Qualquer pixel diferente entre
  `antes/` e uma execução nova vem de mudança no jogo.
- Depois de `js`, `clicar`, `tamanho` ou `abrir`, a próxima `foto` anda **um** quadro antes de fotografar,
  para a tela mostrar o que mudou.
- Nas fotos, as animações de CSS do HUD ficam no estado final (`animations: 'disabled'` do Playwright), e o
  HTML por cima do jogo é pintado pela CPU (`--disable-gpu-rasterization`; sem isso as sombras dos botões
  variavam 1 a 3 níveis de cor de uma foto para outra na escala 2).
- `"congelar": false` no roteiro desliga a parada entre os passos (a página roda solta; as fotos deixam de ser exatas).

## Armadilhas

1. **Three.js.** O CDN do `import map` não abre aqui. O harness intercepta qualquer endereço terminado em
   `/three@0.160.0/build/three.module.js` (e `/three@0.160.0/examples/jsm/...`) e serve a cópia de
   `vendor/three-0.160.0/package/`. Para refazer a cópia: `cd vendor/three-0.160.0 && npm pack three@0.160.0 && tar -xzf three-0.160.0.tgz`.
   Outra versão do Three.js = import barrado = falha (troque a cópia e as duas expressões no começo do `captura.mjs`).
2. **Nada sai para a internet.** Todo pedido que não seja do servidor local é barrado (fica em `falhasRede`).
   O ranking do Desafio do Dia (Supabase), por exemplo, não carrega.
3. **Playwright.** Vem de `/opt/node22/lib/node_modules/playwright` e usa os navegadores de `/opt/pw-browsers`
   (`PLAYWRIGHT_BROWSERS_PATH`). **Não rode `playwright install`.** WebGL é por software (SwiftShader).
4. **É lento, e o tempo varia.** Cada quadro custa de 60 a 90 ms para desenhar no celular com escala 1, umas
   4× mais com escala 2 e umas 3× mais no perfil computador. A página anda mais rápido do que a placa de vídeo
   de mentira desenha, então a `foto` depois de uma espera longa demora 1 a 4 s (está esperando o desenho dos
   quadros atrasados); a foto mostra sempre o último quadro, nunca um quadro velho. Um roteiro leva de 20 a
   50 s e o mesmo roteiro pode levar 20 s numa vez e 30 s na outra; os dez juntos, uns 5 minutos.
5. **A fase `fim` dura pouco** (1,3 s; 2,2 s no gol) e o jogo volta sozinho para `pronto`. Use
   `esperarAte ... fase === 'fim'` e depois um `esperarSegundos` curto.
6. **Depois do contato a câmera aérea assume e o cobrador sai da tela** em 0,1 s. Para ver a terminação do
   chute de trás, desligue a câmera aérea pelo painel do jogo (roteiro `chute-celular-closeup-sem-aerea.json`)
   ou use as páginas de inspeção. No replay o cobrador fica com uns 35 pixels de altura.
7. **No pênalti a mira começa bem em cima do goleiro** e tapa o gesto dele: mire antes de fotografar
   (roteiro `penalti-celular-closeup.json`).
8. **`clicar` no CHUTAR não carrega a barra** (o jogo está parado entre os passos): use `jogoTeste.chutar(forca)`.
9. **`esperarAte` com expressão que dá erro falha na hora** (não espera o limite). Use `?.` se o objeto pode não existir.
10. **Foto suspeita** = desvio de luminância < 6, menos de 64 cores, mais da metade da imagem numa cor escura
    só, ou 98% numa cor só. É só aviso (`fotosSuspeitas`), a não ser com `--estrito`. Recortes de áreas lisas
    podem cair nisso sem ser erro.
11. **Sem `?teste` na url** o tempo do jogo é o tempo real (até 0,05 s por quadro) e os sorteios mudam: as
    esperas continuam funcionando, mas as fotos não se repetem.
12. **`testes/jogadores.html`**: `?corpo` mostra do peito à canela, não o corpo inteiro; a seção `sequencia`
    usa o tempo padrão da cobrança (contato em 0,81 s), não o de cada lenda (o Juninho, no jogo, toca a bola
    em 1,05 s).
13. Os recortes dos roteiros de close-up são fixos (pixels CSS): se a câmera ou a posição do cobrador mudarem,
    ajuste o `recorte`.
14. Variáveis de ambiente para casos especiais: `CAPTURA_CHROMIUM_ARGS` (argumentos a mais para o Chromium),
    `CAPTURA_PLAYWRIGHT` (outro caminho do `index.mjs` do Playwright), `CAPTURA_HTTP_SERVER` (outro `http-server`).

## Arquivos

- `captura.mjs` — o harness. `verificarPng.mjs` — leitor de PNG sem dependências (medição e comparação).
  `rodarTodos.mjs` — roda todos os roteiros.
- `roteiros/` — `treino-celular`, `treino-celular-closeup`, `chute-celular-closeup-sem-aerea`, `replay-celular`,
  `penalti-celular`, `penalti-celular-closeup`, `treino-computador`, `cobradores`, `inspecao-jogadores`,
  `inspecao-cenario` e `_exemplo`.
- `vendor/three-0.160.0/` — a cópia local do Three.js (`npm pack`).
- `antes/` — as capturas de referência do jogo como estava (uma pasta por roteiro).
