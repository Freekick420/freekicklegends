# Frente MODELO — o boneco dos jogadores (`js/jogadores.js`)

Diretório de trabalho (git worktree, ramo `etapa9-modelo`): **/home/user/fkl-modelo**. Rascunho:
`PASTA_DE_RASCUNHO/modelo/`. Porta do harness: **8821**
(a crítica usa 8822 e a correção 8823). Leia antes o contexto comum: `.../scratchpad/briefs/comum.md`.

## Arquivos seus
- `js/jogadores.js` e a página de inspeção `testes/jogadores.html` (ela tem modos por parâmetro de URL: grade do
  elenco de frente e de costas, poses, `?contas` com triângulos e malhas de cada boneco, checagens numéricas no
  topo; leia e use, e atualize o que precisar). Pode ajustar em `js/animacaoDefesa.js` **só** as constantes de
  medidas copiadas do boneco (`SOLA`, `SONDAS`, linhas ~109–135) se você mudar a forma do pé ou do corpo a ponto
  de elas ficarem erradas. **Não edite** `js/main.js`, `js/cobranca.js`, `js/elenco.js`, `js/estadio.js` nem o resto.

## Como é hoje (e por que o dono pediu "muito mais realista")
Cada boneco é um esqueleto de `Object3D` (quadril → tronco → cabeça, ombros → cotovelos → punhos; quadril →
pernas → joelhos → tornozelos) com **uma malha rígida por pedaço** pendurada em cada junta (camisa, calção,
manga, braço, antebraço, mão, coxa, canela, meião, chuteira, cabeça, cabelo...). São uns **23 desenhos por
boneco** (o jogo inteiro: 179 chamadas com cobrador + barreira + goleiro). De perto
(`.../scratchpad/base/fumaca/10-lado-000.png` e as capturas de `.../scratchpad/harness/antes/`): braços e pernas
finos como tubos, joelho em forma de bola, tronco chapado, mãos de luva, pouca forma de músculo, tecido sem
dobra, sombreado chapado. Parece manequim, não atleta.

## Duas metas, as duas obrigatórias

### Meta 1 — o mesmo boneco com poucas chamadas de desenho (é o que permite pôr mais jogadores em campo)
O dono pediu mais jogadores em campo além da barreira (uns 10 figurantes, outra pessoa está fazendo): com 23
desenhos por boneco isso não cabe no celular. Reconstrua a montagem para **no máximo 6 chamadas de desenho por
boneco (o ideal é 4 ou 5)**, sem perder nada do que as outras partes do jogo usam:
- Caminho recomendado: **malha com pele (`THREE.SkinnedMesh`)**, uma por material, todas presas ao MESMO esqueleto;
  as juntas de hoje viram os ossos (`THREE.Bone` é um `Object3D`: quem mexe nas juntas continua funcionando igual).
  Junte as peças por material (ex.: uniforme inteiro numa textura só — camisa, mangas, calção e meião —, pele,
  cabeça/rosto/cabelo, chuteiras) e dê a cada vértice o osso dele. Nas dobras (cotovelo, joelho, ombro, quadril,
  cintura, pescoço) misture dois ossos nos vértices perto da junta: some o "joelho de bola" e a emenda.
- Cuidados conhecidos: hoje há escalas por peça (largura do porte, coxas grossas, lado direito espelhado com
  escala negativa), `punho.scale.x = -1` na mão direita, `ombro.scale.y` esticando o braço na cinemática inversa
  e `corpo.scale` não uniforme pela altura. Escala negativa em osso inverte a face dos triângulos: resolva na
  geometria (espelhe os vértices e a ordem dos triângulos), não no osso. Confira normais e iluminação dos dois
  lados do corpo. Desligue o corte por câmera das malhas com pele (`frustumCulled = false`) ou dê uma esfera folgada.
- Geometrias e texturas continuam em cache e compartilhadas. **Bonecos do mesmo time dividem a textura do
  uniforme** (o número não pode exigir uma textura grande nova para cada boneco: use um atlas de algarismos, um
  remendo pequeno, ou o que achar melhor; o nome nas costas só existe no cobrador). Criar os bonecos de uma
  cobrança (1 cobrador + até 5 da barreira + 10 figurantes, dois uniformes nunca vistos) não pode travar: meça com
  `performance.now()` na página de inspeção e relate (alvo: bem abaixo de 100 ms no total num computador comum;
  quase nada quando o uniforme já está em cache). `dispose()` continua sem deixar sobras (`estatisticasCache()`).
- **Silhueta para sombra** (contrato com quem faz as sombras dos refletores, em `js/sombras.js`): acrescente ao
  objeto devolvido por `criarPersonagem` o método
  ```js
  // Malha extra com o corpo inteiro numa chamada de desenho só, para a sombra projetada no gramado.
  // material: o THREE.Material de quem chama (o shader dele achata os vértices no chão). copias: quantas vezes a
  // geometria aparece repetida na mesma malha; cada vértice ganha o atributo float `copia` (0, 1, ... copias − 1),
  // para o shader projetar cada cópia numa direção de luz. A malha acompanha o esqueleto do boneco (mesmos ossos),
  // já entra no grupo dele com frustumCulled = false e some no dispose(). Pode ter menos triângulos que o corpo.
  personagem.criarSilhueta(material, copias = 1) // → THREE.Mesh (SkinnedMesh)
  ```
- Opcional, se sair barato: `criarPersonagem({ ..., detalhe: 'baixo' })` para figurantes vistos de longe (menos
  triângulos, mesmas juntas).

### Meta 2 — parecer um jogador de futebol de verdade (referência: PES do PS2, mas pode e deve ficar melhor)
- **Corpo de atleta**: coxas e panturrilhas com volume e forma (a panturrilha tem barriga, o joelho é uma
  transição, não uma bola), glúteos, quadril, cintura mais estreita que o peito, ombros e deltoides, peitoral e
  costas com volume (o tronco não é uma tábua), pescoço e trapézio, antebraço mais grosso perto do cotovelo, mãos
  com forma (dedos juntos, polegar), pés/chuteiras com volume (bico, calcanhar, sola com travas sugeridas).
  Mantenha a altura de cada lenda (`visual.altura`), `porte` ('magro' | 'normal' | 'forte') e `coxas`.
- **Uniforme com cara de tecido**: camisa um pouco solta (não colada), barra por cima do calção, manga até o
  meio do braço com bainha, golas, costuras e sombras de dobra pintadas na textura (axila, cintura, entre as
  pernas), calção solto até acima do joelho com número e listra lateral quando combinar, meião até abaixo do
  joelho com a canaleira marcando e a dobra de cima, chuteira com desenho. Número grande nas costas, pequeno na
  frente; nome em arco nas costas do cobrador. Nada de escudo ou marca de verdade.
- **Cabeça**: crânio, mandíbula, orelhas e nariz com um mínimo de relevo, pescoço que entra na gola; cabelos com
  volume e mechas pintadas (não um capacete), barbas. O jogador é visto principalmente **de costas e de longe**
  (a câmera fica atrás do cobrador): costas da camisa, nuca, cabelo de trás, panturrilhas, meião e chuteira são o
  que mais aparece. Capriche aí primeiro.
- **Luz**: os bonecos são iluminados pelas luzes da cena (hemisférica + direcionais dos refletores, definidas em
  `js/estadio.js`, que outra pessoa está ajustando). Use materiais que respondam bem a isso (um pouco de brilho na
  pele e no tecido, sombra própria pintada nos vértices onde ajuda) e que continuem bons se as intensidades mudarem.
- **Elenco novo** (já está em `js/elenco.js` da base): saíram Beckenbauer, Koeman, Zico, Chilavert, Nelinho,
  Branco, Didi e Maradona; entraram Harry Kaine (9), Zinedine Zidanne (5), Álvaro Recova (20), Andriy Shevchenco
  (76), Adrianno (10), Zlatan Ibrahimovich (18), Hulck (19) e Kevin De Bruine (17). Dois campos novos que você
  precisa implementar: `visual.cabelo.preso: true` (cabelo comprido preso atrás, rabo/coque: o Ibra) e
  `uniforme.padrao: 'faixaVertical'` (faixa de cima a baixo no meio do peito, `cores[0]`, com filetes `cores[1]`:
  o PSG). O goleiro-artilheiro tem `uniforme.linha` (uniforme dos companheiros; você não precisa tratar).
  Confira os 22 um por um (de frente e de costas) e os genéricos (`visualAdversario`, goleiro adversário):
  aumente a variedade dos genéricos (hoje são 7 aparências; com barreira + figurantes aparecem uns 15 por lance).

## O que NÃO pode mudar (outros arquivos dependem)
- O que `criarPersonagem` devolve: `{ grupo, aplicarPose(pose), altura, alturaQuadril, juntas, pontoNoGrupo(junta, x, y, z),
  alcancar(lado, alvoMundo, peso), visual, uniforme, dispose() }`; os nomes, a hierarquia, as posições de repouso
  e a ordem de rotação das juntas (`quadril, tronco, cabeca, ombroE/D, cotoveloE/D, punhoE/D, pernaE/D, joelhoE/D,
  tornozeloE/D`); o formato e o sentido de cada campo da pose (cabeçalho do arquivo, com os campos novos `giro`,
  `pe`, `cabeca.lado`); pés em y = 0; `SOLA` e `PEITO_DO_PE` coerentes com a chuteira desenhada.
- Exportações: `criarPersonagem, UNIFORMES, misturarPoses, espelhar, porChaves, posePadrao, poseBarreira,
  poseGoleiroPronto, poseGoleiroMergulho, criarSombraBlob, visualAdversario, VISUAL_GOLEIRO_ADVERSARIO,
  posicionarBarreira, posicionarGoleiro, estatisticasCache, SOLA, PEITO_DO_PE`.
- `js/animacaoDefesa.js` (goleiro e barreira) e `js/cobranca.js` (cobrador) mexem nas juntas direto (quaternions,
  `J.quadril.parent.scale`, `-J.joelhoE.position.y`...). Depois da sua mudança o goleiro tem que continuar
  mergulhando e a barreira pulando igual: confira no jogo (modo normal e pênalti), com capturas.
- O módulo roda no Node sem tela (`temDocumento`): continue assim (os testes de animação usam).

## Como conferir
- Página de inspeção pelo harness (perfil computador): elenco inteiro de frente e de costas, close do corpo e da
  cabeça, poses (parado, corrida, chute, barreira, goleiro, mergulho), `?contas`. Compare lado a lado com as
  capturas de antes.
- No jogo (`index.html?teste`): `jogoTeste.desenho()` antes e depois (chamadas e triângulos), câmera livre em
  volta do cobrador (`jogoTeste.camera({ seguir: true, ... })`), a visão normal de trás no celular (390×844), um
  chute inteiro, um pênalti (goleiro), um replay. Sem erro de console.
- `node testes/fisica.mjs`, `node testes/defesa.mjs`, `node testes/ranking.mjs`.

## Entregue
Commit no ramo e o relatório (formato no contexto comum) com: chamadas de desenho e triângulos por boneco e do
jogo (antes → depois), tempo de criação medido, como ficou a divisão em malhas/materiais/texturas, a assinatura
final de `criarSilhueta`, capturas de antes e depois (caminhos), e o que ainda não está bom.
