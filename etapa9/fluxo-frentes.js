export const meta = {
  name: 'etapa9-frentes',
  description: 'Etapa 9 do Free Kick Legends: cada frente é implementada, criticada por um revisor independente e corrigida',
  phases: [{ title: 'Implementar' }, { title: 'Criticar' }, { title: 'Corrigir' }],
}

// args (veja etapa9/fluxo-args.json e etapa9/RETOMAR.md):
//   trilhas:  as frentes ({ key, nome, dir, ramo, porta, notas, checagens })
//   briefs:   pasta dos briefs (etapa9/briefs dentro do repositório)
//   rascunho: pasta de rascunho da sessão (fora do repositório), onde está o harness e para onde vão as capturas
const { trilhas, briefs, rascunho } = args

const RELATORIO = {
  type: 'object',
  properties: {
    resumo: { type: 'string', description: 'o que foi feito, em poucas linhas' },
    commit: { type: 'string', description: 'hash do commit final no ramo da frente' },
    arquivos: { type: 'array', items: { type: 'string' } },
    medidas: { type: 'string', description: 'números medidos (testes, chamadas de desenho, tempos...)' },
    capturas: { type: 'array', items: { type: 'string' }, description: 'caminhos das capturas que provam o resultado' },
    pendencias: { type: 'array', items: { type: 'string' }, description: 'o que ainda não está bom ou não foi feito' },
    notasParaIntegracao: { type: 'string', description: 'o que quem junta as frentes precisa saber (API, campos novos, pedidos para outros arquivos)' },
  },
  required: ['resumo', 'commit', 'arquivos', 'medidas', 'capturas', 'pendencias', 'notasParaIntegracao'],
}

const ACHADOS = {
  type: 'object',
  properties: {
    veredito: { type: 'string', description: 'julgamento geral, como o dono do projeto julgaria' },
    nota: { type: 'integer', description: '0 a 10: quanto o resultado atende ao pedido' },
    oQueEstaBom: { type: 'array', items: { type: 'string' } },
    achados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gravidade: { type: 'string', enum: ['critico', 'alto', 'medio', 'baixo'] },
          titulo: { type: 'string' },
          evidencia: { type: 'string', description: 'captura (caminho), número medido ou trecho de código que prova' },
          sugestao: { type: 'string', description: 'correção concreta' },
        },
        required: ['gravidade', 'titulo', 'evidencia', 'sugestao'],
      },
    },
  },
  required: ['veredito', 'nota', 'oQueEstaBom', 'achados'],
}

const CORRECAO = {
  type: 'object',
  properties: {
    resumo: { type: 'string' },
    commit: { type: 'string' },
    achadosTratados: {
      type: 'array',
      items: {
        type: 'object',
        properties: { titulo: { type: 'string' }, oQueFoiFeito: { type: 'string' } },
        required: ['titulo', 'oQueFoiFeito'],
      },
    },
    medidas: { type: 'string' },
    capturas: { type: 'array', items: { type: 'string' } },
    pendencias: { type: 'array', items: { type: 'string' } },
    notasParaIntegracao: { type: 'string' },
  },
  required: ['resumo', 'commit', 'achadosTratados', 'medidas', 'capturas', 'pendencias', 'notasParaIntegracao'],
}

const regras = (t) => `Trabalhe SOMENTE no diretório ${t.dir} (git worktree no ramo ${t.ramo}, já criado a partir da base da etapa 9). Em todo comando de terminal comece com \`cd ${t.dir} && ...\` e, nas ferramentas de arquivo, use caminhos absolutos dentro de ${t.dir}. Não mexa em /home/user/freekicklegends, /home/user/fkl-base nem nos diretórios das outras frentes (/home/user/fkl-*): outras pessoas estão trabalhando neles agora. Não faça push.`

const implementar = (t) => `Você é o responsável pela frente "${t.nome}" da etapa 9 do jogo Free Kick Legends (jogo de cobrança de faltas em 3D para celular, feito com Three.js sem build).

Leia com atenção, nesta ordem:
1. ${briefs}/comum.md (contexto, direção de arte, regras, como capturar telas)
2. ${briefs}/${t.key}.md (a sua frente: arquivos, contrato, metas, como conferir)

${regras(t)}

ATENÇÃO, ISTO É UMA RETOMADA: a primeira passada desta frente foi interrompida no meio em 11/11/2026 (o dono pausou para poupar o limite de uso). O trabalho parcial JÁ ESTÁ no seu diretório. Antes de escrever qualquer linha:
a) leia ${briefs}/../RETOMAR.md (o estado geral e a seção da sua frente);
b) leia os arquivos da sua frente como estão hoje e veja o histórico com \`git log --oneline -8\` (a base de antes das frentes é o commit 9e8392d);
c) veja o material de quem começou (roteiros de captura, scripts e medidas, sem as imagens) em ${briefs}/../rascunho/${t.notas}/;
d) rode os testes de Node e capture o estado atual para saber de onde está partindo.
Continue de onde parou. Só recomece uma parte do zero se concluir, com evidência, que ela foi pelo caminho errado.

Faça o trabalho completo descrito na sua frente, com capricho: o dono do projeto pediu explicitamente que ficasse "muito mais realista" e vai julgar pelo que vê no celular. Itere: implemente, meça, capture, OLHE as imagens com a ferramenta de leitura de imagem, corrija o que parecer artificial, repita. Não pare na primeira versão que funciona. Use a porta ${t.porta} no harness e a pasta de rascunho indicada na frente.

Quando o resultado estiver no nível pedido (ou quando você tiver esgotado o que consegue melhorar), rode os testes de Node, faça o commit no ramo ${t.ramo} (mensagem como no contexto comum) e devolva o relatório.`

const criticar = (t, rel) => `Você é um revisor independente, com olhos novos, da frente "${t.nome}" da etapa 9 do jogo Free Kick Legends. Outra pessoa fez o trabalho; a sua função é achar o que NÃO está bom, com evidência, antes de isso chegar ao dono do projeto.

Leia: ${briefs}/comum.md e ${briefs}/${t.key}.md (o que foi pedido). O trabalho está em ${t.dir} (ramo ${t.ramo}); veja o que mudou com \`cd ${t.dir} && git log --oneline -8 && git diff 9e8392d --stat\` (9e8392d é a base de antes das frentes; o diff mostra as quatro frentes juntas, e os arquivos desta frente estão listados no brief dela).

Relatório de quem fez (não confie: confira):
${JSON.stringify(rel, null, 1)}

Regras: NÃO edite nenhum arquivo do repositório (só leia, rode testes e capture telas). Suas capturas e roteiros vão para ${rascunho}/${t.key}/critica/ e o harness roda com \`--raiz ${t.dir} --porta ${t.porta + 1}\`.

O que conferir (tire as SUAS capturas e olhe as imagens; para comparar com o jogo de antes, capture também a versão publicada, que fica em ${rascunho}/antes-src se essa pasta existir):
${t.checagens.map((c, i) => `${i + 1}. ${c}`).join('\n')}
E sempre: \`node testes/fisica.mjs\`, \`node testes/defesa.mjs\`, \`node testes/ranking.mjs\` e os testes novos da frente passam; o jogo roda um lance inteiro no modo normal, no replay, no pênalti e no Desafio do Dia sem erro de console (\`estado().fase\` chega em 'fim'); só os arquivos da frente foram alterados; o contrato com o js/main.js foi respeitado; nada de Math.random no que afeta o lance.

Julgue como o dono do projeto julgaria ("ficou muito mais realista? parece cobrança de falta do PES do PlayStation 2, ou melhor?"). Seja exigente, específico e justo: cada achado com gravidade (critico = quebra o jogo, um teste ou o contrato; alto = defeito que o dono veria de primeira; medio; baixo), a evidência (caminho da captura, número medido ou trecho de código) e uma correção concreta. Diga também o que ficou bom (para não ser desfeito).`

const corrigir = (t, rel, ach) => `Você vai fazer a segunda rodada da frente "${t.nome}" da etapa 9 do jogo Free Kick Legends. A primeira rodada foi feita por outra pessoa e revisada por um revisor independente; agora você corrige e leva o resultado ao nível pedido.

Leia: ${briefs}/comum.md e ${briefs}/${t.key}.md (o que foi pedido). O trabalho está em ${t.dir} (ramo ${t.ramo}): leia o código que foi feito antes de mexer.

${regras(t)} Use a porta ${t.porta + 2} no harness e a pasta ${rascunho}/${t.key}/correcao/ para roteiros e capturas.

Relatório de quem fez a primeira rodada:
${JSON.stringify(rel, null, 1)}

Achados do revisor independente (nota ${ach.nota}/10):
${JSON.stringify(ach, null, 1)}

O que fazer:
1. Corrija todos os achados críticos e altos, e os médios e baixos que couberem. Se discordar de um achado, prove com evidência (captura ou número) em vez de ignorar.
2. Não desfaça o que o revisor disse que está bom.
3. Depois dos achados, olhe o resultado com os seus próprios olhos (capturas novas) e continue melhorando o que ainda não estiver no nível "muito mais realista" pedido pelo dono.
4. Testes de Node passando, o jogo rodando um lance inteiro (normal, replay, pênalti, desafio) sem erro de console, commit no ramo ${t.ramo} e o relatório final (para cada achado, o que foi feito).`

const resultados = await pipeline(
  trilhas,
  (t) => agent(implementar(t), { label: `implementar:${t.key}`, phase: 'Implementar', schema: RELATORIO }),
  (rel, t) => {
    if (!rel) return null
    return agent(criticar(t, rel), { label: `criticar:${t.key}`, phase: 'Criticar', schema: ACHADOS })
      .then((ach) => ({ rel, ach }))
  },
  (r, t) => {
    if (!r) return null
    if (!r.ach) return { key: t.key, implementacao: r.rel, critica: null, correcao: null }
    return agent(corrigir(t, r.rel, r.ach), { label: `corrigir:${t.key}`, phase: 'Corrigir', schema: CORRECAO })
      .then((fix) => ({ key: t.key, implementacao: r.rel, critica: r.ach, correcao: fix }))
  }
)

return resultados