# Etapa 9 em pausa: como continuar de onde parou

Pausada em **11/11/2026**, a pedido do dono, para poupar o limite de uso. Nada foi perdido.

## Para o dono do projeto (1 minuto de leitura)

- **O site não mudou.** Quem abre o link joga a `v0.1 · etapa 8.1`, igual a antes. A etapa 9 só vai ao ar quando estiver pronta e revisada.
- **O que é a etapa 9:** chute e corrida do cobrador mais realistas, bonecos mais bonitos e mais leves, quatro sombras dos refletores (como no PES do PlayStation 2), bola melhor, outros jogadores em campo e o elenco novo (saíram os oito mais antigos, entraram Kane, Zidane, Recoba, Shevchenko, Adriano, Ibrahimović, Hulk e De Bruyne).
- **Onde está salvo:** no GitHub, no ramo de trabalho `claude/peaceful-planck-mfrfig` (ramo = uma cópia do projeto separada da que está no ar).
- **Quanto está feito:** o elenco novo e a preparação estão prontos. As quatro partes grandes (animação, boneco, sombras/bola, outros jogadores) estão **pela metade**: o jogo já abre e roda um chute inteiro com todas elas juntas, mas nenhuma foi revisada nem dada como pronta, e há defeitos conhecidos (lista mais abaixo).
- **O que se perdeu com a pausa:** só a "memória de trabalho" dos quatro ajudantes que estavam programando. Quando retomar, eles releem o que está escrito aqui e no código. Custa um pouco de tempo de leitura, não custa trabalho refeito.
- **Para retomar**, mande esta frase (na mesma conversa, ou numa conversa nova com o repositório `freekicklegends` selecionado):

  > Retome a etapa 9 do Free Kick Legends. O trabalho está no ramo `claude/peaceful-planck-mfrfig`. Leia `etapa9/RETOMAR.md` e `PROJETO.md` e continue de onde parou.

- **Custo:** a parte cara é rodar quatro ajudantes ao mesmo tempo, cada um com um revisor depois. Dá a melhor qualidade e é o que foi combinado. Se o limite estiver curto no dia, peça "uma frente de cada vez, sem revisor": sai mais barato, demora mais e a qualidade cai um pouco.

---

## Para quem for retomar (Claude)

Leia também `PROJETO.md` e `CLAUDE.md` deste ramo (já descrevem os módulos novos e os ganchos de teste).

### 1. Onde está cada coisa no git

| Ramo | Commit | O que é |
|---|---|---|
| `claude/amazing-keller-d339q4` | `318271a` | **Publicado** (etapa 8.1, `?v=9`). É o ramo padrão do GitHub e o que o GitHub Pages serve. Não foi tocado na etapa 9. |
| `claude/peaceful-planck-mfrfig` | ponta do ramo | **Trabalho**: base da etapa 9 + as quatro frentes pela metade, já juntadas + esta pasta. |

Histórico do ramo de trabalho, do mais antigo para o mais novo:

- `56f5ed1` … `9e8392d`, `1bbdeba`, `bdc265d`: **base da etapa 9** (pronta e conferida): `js/cobranca.js` separado do `js/jogadores.js`, formato de pose estendido, elenco novo e `RIVAIS` em `js/elenco.js`, módulos `bola.js`, `sombras.js`, `figurantes.js` e `animacaoFigurantes.js` ligados no `js/main.js`, ganchos de teste novos, documentação. `9e8392d` é o commit de onde as frentes saíram.
- `48fa0e3` (animação), `584b59c` (boneco), `f9c92ce` (ambiente), `2bf807c` (figurantes): o trabalho **parcial** de cada frente, do jeito que estava quando foi interrompido.
- `1607f2e` … `2b35cb9`: junção das quatro (sem conflito: as frentes mexem em arquivos diferentes).
- Depois: o commit que guardou esta pasta `etapa9/` e `ferramentas/captura/`.

Os ramos locais `etapa9-anim`, `etapa9-modelo`, `etapa9-amb`, `etapa9-fig` não foram enviados ao GitHub; não fazem falta, porque os commits deles estão dentro do ramo de trabalho.

### 2. O desenho da etapa (para não redescobrir)

Quatro frentes que **não compartilham arquivos**. Nenhuma edita o `js/main.js`: os contratos já estão ligados nele.

| Frente | Arquivos | Brief |
|---|---|---|
| Animação do cobrador | `js/cobranca.js`, `testes/cobranca.mjs`, `testes/carregador-three.mjs` | `briefs/anim.md` |
| Boneco | `js/jogadores.js`, `testes/jogadores.html` | `briefs/modelo.md` |
| Ambiente | `js/bola.js`, `js/sombras.js`, `js/estadio.js`, `js/painel.js`, `style.css`, `testes/sombras.html` | `briefs/ambiente.md` |
| Figurantes | `js/figurantes.js`, `js/animacaoFigurantes.js`, `testes/figurantes.mjs`, `testes/figurantes.html` | `briefs/figurantes.md` |

`briefs/comum.md` tem o contexto, a direção de arte, as regras e os ganchos de `window.jogoTeste`. Cada brief tem o contrato da frente com o `main.js`, as metas e como conferir. Ideias centrais:

- **Boneco:** `THREE.SkinnedMesh` (malha única que dobra nas juntas) com as mesmas juntas de antes como ossos, no máximo 6 chamadas de desenho por boneco (eram cerca de 23), e `personagem.criarSilhueta(material, copias)` para as sombras.
- **Sombras:** a silhueta do boneco achatada no gramado quatro vezes, uma por refletor (caminho rápido no shader), com manchas simples como plano B em celular fraco (`sombras.qualidade(0)`).
- **Animação:** passos planejados com o pé preso no chão, perna de chute com recuo e chicote, técnica escolhida pelo que o jogador marcou (`preverTecnica`), pé acertando o ponto de contato escolhido, terminação por técnica, reação ao resultado.
- **Figurantes:** companheiros (uniforme do clube do cobrador) e adversários, fora do corredor do chute, posições pela semente da jogada (`sorteioDaJogada(3)`), a bola bate neles (evento `jogador`).

### 3. Estado de cada frente na pausa

Medido no estado juntado (`2b35cb9`). Só duas fotos foram olhadas por quem orquestrava (tela de jogo e o contato de lado): o jogo aparece inteiro, com o boneco novo, as quatro sombras em forma de silhueta e os figurantes. **Nenhuma revisão visual completa foi feita.**

| Frente | Tamanho | Testes | O que se sabe |
|---|---|---|---|
| Animação | `cobranca.js` 1.991 linhas | `testes/cobranca.mjs`: **25 checagens falham**, todas do tipo "pé no ar arrasta na grama" nas técnicas rasteiro e cavadinha (várias lendas). O resto passa. | O teste também avisa: no replay as juntas batem a partir de 0,3 s, mas nos primeiros 0,3 s diferem até 2,9 cm. Conferir se isso aparece e se `tempoContato` é idêntico no replay. |
| Boneco | `jogadores.js` 4.595 linhas | Sem teste de Node próprio (página `testes/jogadores.html`). | Estava no meio da troca do pintor de rosto para o atlas de aparência. Triângulos acima do orçamento (ver abaixo). Conferir `cabelo.preso` (Ibrahimovich) e `uniforme.padrao: 'faixaVertical'` (PSG). |
| Ambiente | `sombras.js` 575, `bola.js` 174, `estadio.js` 2.798 | Sem teste de Node próprio (página `testes/sombras.html`). | As quatro sombras aparecem nas duas fotos. Os dois caminhos (silhueta e manchas) e a luz não foram conferidos. |
| Figurantes | `figurantes.js` 898, `animacaoFigurantes.js` 1.095 | `node testes/figurantes.mjs` **passa**. | Aparecem em campo com os uniformes certos. Animação e reação não foram conferidas. |

Testes antigos no estado juntado: `fisica`, `defesa` e `ranking` **passam**.

Teste de fumaça (um chute inteiro no modo teste): chega ao fim sem erro. **74 chamadas de desenho** (eram 179) e **181.964 triângulos** (eram 46.550; o orçamento dos briefs é ~160 mil). Contato em 1,077 s, cobrança de 2,21 s.

### 4. Pendências conhecidas

1. Terminar a primeira passada das quatro frentes e passar cada uma por um revisor independente (o fluxo faz isso).
2. Baixar os triângulos para dentro do orçamento (ou justificar com medida no celular).
3. Corrigir o pé arrastando no rasteiro e na cavadinha; deixar `testes/cobranca.mjs` passando inteiro.
4. Replay idêntico desde o primeiro quadro.
5. Depois de juntar: rever o jogo inteiro com capturas em tamanho de celular (treino, Desafio do Dia, pênaltis, replay), porque as frentes nunca foram revistas juntas.
6. Na publicação: `?v=10` em todos os imports, `VERSAO` para etapa 9, atualizar `PROJETO.md` e `CLAUDE.md`, **apagar a pasta `etapa9/`** (é material de obra) e decidir se `ferramentas/captura/` fica.

### 5. Remontar o ambiente

O contêiner é descartável: as pastas `/home/user/fkl-*` e a pasta de rascunho antiga provavelmente não existem mais. Passo a passo (troque `R` pela pasta de rascunho da sessão atual):

```bash
cd /home/user/freekicklegends
git fetch origin claude/peaceful-planck-mfrfig claude/amazing-keller-d339q4
git checkout -B claude/peaceful-planck-mfrfig origin/claude/peaceful-planck-mfrfig

R=/caminho/da/pasta/de/rascunho/da/sessao

# harness de capturas (Playwright) com a cópia local do Three.js, que o CDN não abre no contêiner
mkdir -p $R/harness && cp -r ferramentas/captura/. $R/harness/
mkdir -p $R/harness/vendor/three-0.160.0 && (cd $R/harness/vendor/three-0.160.0 && npm pack three@0.160.0 && tar -xzf three-0.160.0.tgz)

# briefs e parâmetros com os caminhos desta sessão (a cópia do repositório fica com os marcadores)
cp -r etapa9 $R/etapa9
sed -i "s#PASTA_DE_RASCUNHO#$R#g" $R/etapa9/briefs/*.md $R/etapa9/fluxo-args.json
sed -i "s#LINK_DA_SESSAO_ATUAL#<link da sessão atual>#" $R/etapa9/briefs/comum.md

# um diretório por frente, todos a partir do estado juntado
for f in anim modelo amb fig; do git worktree add /home/user/fkl-$f -b etapa9-$f claude/peaceful-planck-mfrfig; done
# a versão publicada, para capturas de "antes"
git worktree add --detach $R/antes-src 318271a
```

Conferir o ponto de partida:

```bash
node testes/fisica.mjs && node testes/defesa.mjs && node testes/ranking.mjs && node testes/figurantes.mjs
FKL_THREE=$R/harness/vendor/three-0.160.0/package/build/three.module.js node testes/cobranca.mjs   # hoje: 25 falhas (item 3 acima)
cd $R/harness && node captura.mjs roteiros/fumaca-etapa9.json --raiz /home/user/freekicklegends --porta 8801 --saida $R/retomada
```

O `README.md` do harness explica os passos de um roteiro (`esperarJogo`, `foto`, `js`, `avaliar`, `esperarAte`…). O navegador sem placa de vídeo é lento: use os ganchos de tempo (`jogoTeste.pausar`, `avancar`, `avancarAte`) em vez de esperar.

### 6. Relançar as frentes

- `fluxo-frentes.js` é o roteiro da ferramenta Workflow: para cada frente, **implementar → revisor independente → corrigir**. O texto do "implementar" já avisa que é uma retomada e manda ler o que existe antes de escrever.
- `fluxo-args.json` tem os parâmetros: as quatro frentes (diretório, ramo, porta, pasta de notas) e a lista de checagens que o revisor de cada uma segue. Use a cópia de `$R/etapa9/`, já com os caminhos trocados.
- `rascunho/<anim|modelo|amb|fig>/` guarda os roteiros de captura, scripts e medidas de quem começou (sem as imagens). Em `rascunho/anim/bak/` há cópias anteriores do `cobranca.js`, úteis se a versão do commit estiver no meio de uma mudança.
- O fluxo roda `min(16, CPUs − 2)` ajudantes por vez. Numa máquina de 4 CPUs isso dá 2; para ter as quatro frentes ao mesmo tempo foram lançados dois fluxos (animação + boneco; ambiente + figurantes).
- **Só lance com o aval do dono** (ele pede "ultracode" ou "use um fluxo"): é a parte que mais gasta. A alternativa barata é fazer uma frente por vez na conversa principal, sem revisor.
- Ordem sugerida se for uma por vez: boneco (as outras dependem da aparência e de `criarSilhueta`), animação, ambiente, figurantes.

### 7. Depois das frentes

1. Juntar os quatro ramos no ramo de trabalho (devem juntar sem conflito) e rodar todos os testes de Node.
2. Revisão do conjunto com capturas, e correções.
3. Itens 5 e 6 da lista de pendências.
4. Publicar: `git push origin claude/peaceful-planck-mfrfig:claude/amazing-keller-d339q4` e dizer ao dono como testar no computador e no celular (o rótulo no canto da tela tem que mostrar a etapa 9).

### 8. Regras que continuam valendo

- Responder ao dono em português simples, com passos claros (onde clicar, o que digitar).
- Desenvolver só em `claude/peaceful-planck-mfrfig`; publicar só quando a etapa funciona; nenhum pull request sem ele pedir.
- "Replay = repetir a cobrança": nada de `Math.random` no que afeta bola, barreira, goleiro ou figurantes.
- O ranking usa a chave pública do Supabase que está em `js/config.js`. A senha do banco não é necessária para nada e não deve ser pedida.
- Modo Temporada continua fora do escopo.
