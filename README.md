# Processamento de Clubes e Jogadores — JSONL para CSV

Pipeline batch em Node.js que lê um arquivo JSONL com dados aninhados de clubes
de futebol e seus jogadores, aplica as regras de negócio e gera dois arquivos
CSV: `clubs.csv` (relação 1:1) e `players.csv` (relação 1:N, ligada ao clube por
chave estrangeira).

O programa foi escrito para rodar em produção com **milhões de registros**, em
lote agendado por orquestrador. Isso guiou três características centrais:
consumo de memória constante, tolerância a registros defeituosos e código de
saída adequado para automação.

---

## Requisitos

| Item | Versão usada |
| --- | --- |
| Node.js | 22.20.0 (qualquer LTS ≥ 18) |
| Yarn | 1.22.22 (ou npm) |

## Instalação

```bash
yarn install
```

Uma única dependência de produção: [`csv-stringify`](https://csv.js.org/stringify/),
para serialização conforme a RFC 4180.

## Uso

```bash
yarn start <caminho-do-arquivo.jsonl> [diretorio-de-saida]
```

Exemplo com o arquivo de amostra incluído:

```bash
yarn start ./data/sample_clubes.jsonl
```

O caminho de entrada é **obrigatório**. O diretório de saída é opcional e
assume a raiz do projeto por padrão — os arquivos `clubs.csv` e `players.csv`
são criados (ou sobrescritos) nele.

Os arquivos [`clubs.csv`](clubs.csv) e [`players.csv`](players.csv) versionados
na raiz do repositório são a saída gerada a partir de
[`data/sample_clubes.jsonl`](data/sample_clubes.jsonl), conforme pedido no
enunciado.

### Saída no terminal

```
Entrada: /caminho/para/data/sample_clubes.jsonl
Saída:   /caminho/para/o/projeto

Processamento concluído.
  Linhas lidas:        6
  Clubes gravados:     5
  Jogadores gravados:  8
  Fora do filtro:      1
  Ignoradas por erro:  0
```

### Códigos de saída

| Código | Significado |
| --- | --- |
| `0` | Lote concluído — inclusive com linhas descartadas, que são falhas esperadas |
| `1` | Falha de configuração ou de I/O — argumento ausente, arquivo inexistente, erro de escrita |

A distinção importa para o orquestrador: só o código `1` deve disparar retry ou
alerta.

---

## Regras de negócio

**Filtro de campeonato.** Apenas clubes de `SERIE A` ou `SERIE B` são
processados; os demais são descartados junto com seus jogadores. A comparação
ignora caixa, acentuação e variação de espaços — `Série A`, `serie a` e
`SÉRIE  A` são aceitos — e o valor gravado é sempre a forma canônica, para que
a coluna não fragmente agregações a jusante.

**Cores.** O array é achatado em uma string separada por pipe
(`["preto","branco"]` → `preto|branco`). Ausente, nulo, vazio ou não-array
resulta em string vazia.

**Datas.** Saída estritamente em `yyyy-MM-dd`. Valores fora do padrão ISO ou
inexistentes no calendário (`2023-02-30`, `2023-02-29`) viram string vazia,
**mantendo a linha**. Sufixo de hora é aceito e truncado
(`1998-07-12T15:30:00Z` → `1998-07-12`).

**Nulos.** Campo ausente ou nulo vira string vazia. **Zero e `false` são
preservados** — um jogador com `goals: 0` grava `0`, não vazio.

**Chave estrangeira.** Cada linha de `players.csv` carrega o `Id do Clube` do
clube a que pertence.

## Formato de saída

UTF-8 sem BOM, com cabeçalho, separado por vírgula e conforme a RFC 4180:
campos contendo vírgula, aspas ou quebra de linha são delimitados por aspas, e
a aspa literal é duplicada. Registros terminados em CRLF.

**`clubs.csv`** — Id do Clube, Nome, Campeonato, Data de Fundação, Cidade,
Estado, País, Estádio, Presidente, Apelido, Cores

**`players.csv`** — Id do Clube, Id do Jogador, Nome, Idade, Gols, Data de
Estreia, Posição, Número da Camisa

Os nomes das colunas são derivados em tempo de execução dos próprios
construtores de linha, de modo que cabeçalho e conteúdo não possam divergir.

---

## Arquitetura

```
index.js                  composition root: monta as camadas e conduz o fluxo
src/
  cli.js                  argumentos e validação dos caminhos
  jsonl-reader.js         extração: streaming linha a linha, parse tolerante
  csv-writer.js           carga: escrita incremental RFC 4180
  batch-report.js         métricas e mensagens do lote
  transform/
    fields.js             formatação de campos escalares (funções puras)
    rows.js               regras de negócio e montagem das linhas
```

A divisão segue as etapas do próprio pipeline — extract, transform, load — mais
as bordas de entrada e de feedback. Os módulos de `transform/` não importam
`fs`: são funções puras, exercitáveis sem arquivo em disco.

### Memória constante

A leitura usa `fs.createReadStream` com `readline`, consumido por
`for await...of` sobre um *async generator*. O `await` propaga backpressure
naturalmente: a leitura só avança quando a escrita da linha anterior conclui.
Nem a entrada nem a saída acumulam em memória, então o consumo é função do
maior registro, não do tamanho do arquivo.

### Resiliência

Cada linha é uma unidade de falha isolada. Linha com JSON inválido ou que não
seja um objeto é registrada com o número da linha e o motivo, descartada, e o
lote continua:

```
[AVISO] Linha 2 ignorada — JSON inválido: Expected ',' or '}' after property value...
[AVISO] Linha 5 ignorada — não é um objeto de clube.
```

O total de descartes aparece no resumo final. Descartar em silêncio seria pior
que abortar: produziria saída incompleta que ninguém percebe.

---

## Decisões de arquitetura

As decisões estruturais estão registradas em [`docs/adr/`](docs/adr/README.md),
cada uma com o contexto, o motivo, a implementação e as alternativas
descartadas.

| ADR | Decisão |
| --- | --- |
| [0001](docs/adr/0001-entrada-parametrizada-via-cli.md) | Entrada parametrizada via CLI com validação fail-fast |
| [0002](docs/adr/0002-commonjs-como-sistema-de-modulos.md) | CommonJS como sistema de módulos |
| [0003](docs/adr/0003-leitura-por-streaming-linha-a-linha.md) | Leitura por streaming linha a linha com descarte tolerante |
| [0004](docs/adr/0004-pipeline-nao-normaliza-arquivo-de-entrada.md) | O pipeline não normaliza nem copia o arquivo de entrada |
| [0005](docs/adr/0005-filtro-de-campeonato-tolerante-com-saida-canonica.md) | Filtro tolerante na entrada, canônico na saída |
| [0006](docs/adr/0006-regras-de-formatacao-de-campos.md) | Regras de formatação: nulos, datas e cores |
| [0007](docs/adr/0007-separacao-em-camadas-de-responsabilidade.md) | Separação do pipeline em camadas de responsabilidade |
| [0008](docs/adr/0008-escrita-csv-com-csv-stringify.md) | Escrita dos CSVs com `csv-stringify` em modo stream |

### Três armadilhas que os ADRs registram

Nenhuma delas gera exceção — todas produzem dado plausível e errado, o que as
torna caras de descobrir em produção:

1. **Teste de falsidade em campo numérico.** `if (!value) return ''`
   transformaria `goals: 0` em célula vazia, apagando a diferença entre "zero
   gols" e "gols desconhecidos".
2. **`Date` acomoda datas impossíveis.** `new Date('2023-02-30')` devolve
   `2023-03-02` sem erro. A validação reconstrói a data e compara os
   componentes de volta. Os getters são `getUTC*` de propósito: os locais
   deslocariam `1910-09-01` para `1910-08-31` em fuso negativo.
3. **`csv-stringify` não delimita LF isolado quando o terminador é CRLF.** Um
   campo contendo apenas `\n` era gravado sem aspas e partia o registro em
   dois — a releitura de 5 registros devolvia 6. Corrigido declarando
   `quoted_match: /[\r\n]/`.

---

## Testes

```bash
yarn test
```

47 casos com o runner nativo do Node (`node:test`), sem dependência de
desenvolvimento. A suíte cobre:

| Arquivo | Cobertura |
| --- | --- |
| `test/fields.test.js` | nulos, zero preservado, valores não escalares, datas ISO, calendário, bissexto, fuso horário, cores |
| `test/rows.test.js` | filtro de campeonato, canonicalização, ordem e nomes das colunas, montagem das linhas, chave estrangeira |
| `test/jsonl-reader.test.js` | continuidade após linha malformada, escalares, linhas em branco, CRLF, numeração de linha |
| `test/csv-writer.test.js` | CRLF, ausência de BOM, escape de vírgula/aspas/quebra de linha, ordem das colunas, acentuação |

Os casos foram escritos a partir dos defeitos reais encontrados durante o
desenvolvimento, não como cobertura decorativa. O teste
`delimita campo com quebra de linha isolada` é regressão do bug de escape do
`csv-stringify`: removendo o `quoted_match`, ele falha.

Além da suíte, os CSVs gerados foram relidos por um parser externo
(round-trip), confirmando que registros com vírgula, aspas e quebra de linha
internas permanecem íntegros. A refatoração em camadas foi validada por
comparação da saída de quatro cenários antes e depois — idênticas, incluindo os
códigos de saída.

## Uso de assistente de IA

O desenvolvimento foi conduzido com apoio de um assistente de código, de forma
iterativa e etapa por etapa. Os prompts utilizados estão registrados em
[`docs/prompts.md`](docs/prompts.md), com as decisões de projeto que foram
tomadas em cada ponto de bifurcação.

## Fluxo de trabalho

Desenvolvido com Git Flow: `main` estável, `develop` como integração e uma
branch por etapa (`feature/setup-cli`, `feature/leitura-streaming`,
`feature/regras-negocio`, `refactor/modularizacao`, `feature/escrita-csv`),
fechadas com merge `--no-ff` para preservar o histórico de cada etapa.

## Limitação conhecida

O pipe é separador e valor possível ao mesmo tempo na coluna `Cores`: um clube
com `colors: ["azul|escuro", "branco"]` grava `azul|escuro|branco`,
indistinguível de três cores. A especificação não define escape para esse caso,
e nenhum foi inventado. Improvável em dados reais de cores, mas registrado por
ser um defeito silencioso caso ocorra.
