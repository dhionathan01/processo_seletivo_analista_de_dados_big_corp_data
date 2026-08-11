# Prompts utilizados no desenvolvimento

Registro dos comandos enviados ao assistente de IA (Claude) durante a
construção deste projeto, na ordem em que foram feitos.

O texto foi revisado apenas quanto a erros de digitação e acentuação; o
conteúdo, a intenção e a sequência das solicitações permanecem como no
original. Nenhuma pergunta foi acrescentada, removida ou reordenada.

**Método adotado:** desenvolvimento iterativo, uma etapa por vez, com Git Flow.
O assistente recebeu previamente um arquivo de contexto (`claude.md`) com as
diretrizes de arquitetura e a instrução explícita de **não** escrever a solução
inteira de uma vez.

---

## 1 — Verificação do contexto

> Você já carregou o arquivo `claude.md`?

## 2 — Etapa 1: setup e validação da entrada

> Estou resolvendo um desafio técnico em Node.js. O programa precisa receber o
> caminho de um arquivo JSONL por parâmetro de linha de comando.
>
> Escreva o código inicial no `index.js` que:
>
> - Leia o argumento passado (ex.: `yarn start ./data/sample.jsonl`).
> - Valide se o caminho foi fornecido. Se não, exiba um erro amigável no console
>   e encerre (`process.exit`).
> - Valide se o arquivo realmente existe usando o módulo nativo `fs`.
>
> Retorne apenas o código do `index.js`.

## 3 — Documentação das decisões

> Acabei de adicionar isto ao `claude.md`:
>
> ```
> ## DOCUMENTAÇÃO
> Registre em um documento as ADRs definidas, com quando, por que e como.
> ```

## 4 — Confirmação do script de execução

> Sim.

## 5 — Etapa 2: leitura por streaming

> Agora vamos adicionar a leitura do arquivo no `index.js`.
>
> Usando os módulos nativos `fs` e `readline`, crie um fluxo de leitura
> (ReadStream) para ler o arquivo JSONL linha a linha.
>
> Para cada linha lida:
>
> - Faça o `JSON.parse` dentro de um bloco `try/catch`.
> - Se a linha for malformada e der erro no parse, apenas faça um
>   `console.warn`, ignorando a linha, e não aborte a execução.
> - Por enquanto, apenas imprima o `club_id` de cada clube processado com
>   sucesso.
>
> Retorne o código atualizado do `index.js`.

## 6 — Cobrança de evidência dos testes

> Como você testou? Qual comando executou? O arquivo está dentro de `docs` e
> totalmente mal digitado, com `(1)(2).pdf`. Como você testou?

## 7 — Organização do arquivo de amostra

> Sim.

## 8 — Questionamento sobre normalizar nomes de arquivo

> Não seria interessante o meu script tratar esses nomes horrendos, normalizar e
> fazer a cópia dele para `data`?

## 9 — Decisão sobre o escopo do pipeline

> Se não é um problema, visto que em produção vai estar correto, ok. Mantenha
> então.

## 10 — Registro da decisão descartada

> Registre.

## 11 — Disciplina de branches

> Essa é a próxima etapa. Ainda estamos na leitura; regras de negócio e filtros
> ficam em outra branch. Podemos fechar aqui então?

## 12 — Fechamento da etapa de leitura

> Faça os dois commits.

## 13 — Etapa 3: regras de negócio e transformação

> Nesta etapa, adicione funções auxiliares no `index.js` para tratar os dados
> lidos do JSON, seguindo estas regras rigorosas:
>
> - **Filtro:** só devemos processar clubes onde `championship` seja `"SERIE A"`
>   ou `"SERIE B"`. Ignore os demais.
> - **Cores:** transforme o array `colors` em uma string unida por pipe `|`. Se
>   for vazio ou nulo, retorne string vazia.
> - **Datas:** crie uma função que valide se uma data de entrada é válida e
>   garanta o formato `yyyy-MM-dd`. Se for inválida ou nula, retorne string
>   vazia.
> - **Nulos:** qualquer campo ausente ou nulo deve virar string vazia.
>
> Integre essas regras no evento de leitura da linha. Por enquanto, guarde o
> objeto do clube e a lista de jogadores em variáveis locais dentro do evento,
> prontos para a próxima etapa.

## 14 — Decisão sobre tolerância a acentos no filtro

> B.

_(Resposta à pergunta sobre o filtro descartar `SÉRIE A` acentuado: opção A
mantinha a comparação estrita; opção B normalizava acentos antes de comparar.)_

## 15 — Canonicalização do valor de saída

> Normalize tudo sem acentos, acho melhor.

## 16 — Alcance da normalização

> Somente o campo `Campeonato`.

_(Resposta à pergunta sobre remover acentos apenas do campeonato ou de todas as
colunas de texto. Nomes próprios como `Avaí` e `São Paulo` mantêm a acentuação
original.)_

## 17 — Questionamento sobre arquitetura

> Eu, como engenheiro de software, acho muito feio um arquivo `index` gigante,
> com tudo da pipeline. Eu gosto de arquitetura e responsabilidade: isolar
> constantes em um arquivo `consts`, funções em `functions`, e subdividir em
> camadas de responsabilidade, separar leitura de tratamento, feedbacks e
> resposta.
>
> Isso está correto como está na área de engenharia de dados? É comum?

## 18 — Refatoração em camadas

> Refatore e depois o writer. Não esqueça das boas práticas de Git Flow.

## 19 — Correção de rota na sequência das etapas

> Não, pera aí. Era para eu ter rodado isto após a modularização:
>
> _(reenvio do prompt da Etapa 3, para validar as transformações no código já
> modularizado)_

## 20 — Etapa 4: escrita dos CSVs

> O plano era este:
>
> ```bash
> git checkout -b feature/escrita-csv
> yarn add csv-stringify
> ```
>
> Chegamos na reta final, a **Etapa 4: escrita dos CSVs**.
>
> - Importe a biblioteca `csv-stringify`. Recomendo usar o stringifier baseado
>   em stream ou a API síncrona `stringify/sync` escrevendo em
>   `fs.createWriteStream`.
> - Crie dois arquivos de saída na raiz do projeto: `clubs.csv` e `players.csv`.
> - Defina as colunas com os nomes exatos e na ordem que passei nas diretrizes de
>   arquitetura (com acentos, ex.: `"Data de Fundação"`, `"Id do Clube"`).
> - Remova o `console.log` da etapa anterior. Agora, na leitura de cada linha
>   aprovada, escreva os dados formatados do clube no stream de `clubs.csv`.
> - Faça um loop na lista de jogadores daquele clube, garanta que o `club_id`
>   seja inserido no registro de cada jogador, aplique as regras de nulos e datas
>   neles, e escreva cada jogador no stream de `players.csv`.
>
> Retorne o arquivo `index.js` final e completo.
>
> Depois:
>
> ```bash
> git add .
> git commit -m "feat: integra geracao dos arquivos clubs.csv e players.csv"
> git checkout develop
> git merge feature/escrita-csv
> git checkout main
> git merge develop
> ```

## 21 — Fechamento e README

> Sim.

## 22 — Testes automatizados e publicação

> Sim.

## 23 — Entrega final

> Preciso que os dois arquivos de resposta sejam enviados, e preciso que você
> crie um arquivo de prompt com os prompts que eu te enviei, arrumando os erros
> de português da minha digitação. O enunciado pede isso — leia o enunciado em
> `docs/enunciado_desafio`.

---

## Observações sobre a condução do trabalho

O desenvolvimento seguiu a divisão em etapas definida no `claude.md`, com uma
branch por etapa e merge `--no-ff` ao final de cada uma. As decisões que
envolviam escolha real de projeto foram tomadas por mim, não pelo assistente:

- **Tolerância a acentos no filtro de campeonato** (prompt 14) — o assistente
  apontou o risco de descartar `Série A` em silêncio e apresentou as duas
  opções; a escolha foi explícita.
- **Alcance da normalização** (prompt 16) — restringida ao campo `Campeonato`,
  preservando a acentuação de nomes próprios.
- **Escopo do pipeline** (prompts 8 e 9) — a proposta de o programa normalizar
  nomes de arquivo de entrada foi levantada por mim, discutida e descartada,
  com o motivo registrado em ADR.
- **Arquitetura em camadas** (prompts 17 e 18) — questionei o arquivo único e
  discordei parcialmente da resposta inicial; a divisão final é por
  responsabilidade, não por tipo de artefato.
- **Disciplina de branches** (prompt 11) — interrompi o assistente para manter
  cada etapa em sua própria branch.
- **Cobrança de evidência** (prompt 6) — exigi o comando exato executado e a
  saída obtida, em vez de aceitar a afirmação de que os testes passaram.

As decisões de arquitetura estão registradas em [`docs/adr/`](adr/README.md),
cada uma com contexto, motivo, implementação e alternativas descartadas.
