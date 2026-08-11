# ADR-0008 — Escrita dos CSVs com `csv-stringify` em modo stream

- **Status:** Aceita
- **Data (quando):** 2026-08-11
- **Etapa:** Escrita dos CSVs (`src/csv-writer.js`)

## Contexto

A etapa final grava `clubs.csv` (1:1 com o clube) e `players.csv` (1:N,
com o id do clube como chave estrangeira). A especificação exige UTF-8,
cabeçalho, separação por vírgula e conformidade com a RFC 4180.

O conteúdo real exercita o escape: o presidente do Cruzeiro é
`Pedro Lourenço, Filho` — vírgula dentro do campo. Nomes com aspas ou quebra de
linha são plausíveis numa base não higienizada.

Escrever tudo em memória e salvar ao final é inviável no volume alvo, pela mesma
razão que motivou a leitura por streaming (ADR-0003).

## Decisão (por quê)

Delegar a serialização ao `csv-stringify`, consumido em modo stream, com escrita
incremental linha a linha.

Motivos:

1. **Serialização de formato é código sem valor de domínio.** As regras da RFC
   4180 são simples de escrever e fáceis de errar nas bordas; uma biblioteca
   madura já as cobre e é exercitada por muito mais casos do que este projeto
   teria.
2. **Modo stream preserva a memória constante** conquistada na leitura. Escrever
   por acumulação anularia o ganho do streaming da extração.
3. **Uma dependência única, sem árvore transitiva.** `csv-stringify` não arrasta
   outros pacotes, o que mantém o custo de auditoria baixo.

## Como

- `createCsvWriter(filePath, columns)` devolve `{ writeRow, close }`, encapsulando
  o `stringifier` e o `WriteStream`.
- `record_delimiter: '\r\n'` — a RFC 4180 define CRLF como terminador.
- `bom: false` — a especificação pede UTF-8; o BOM apareceria como lixo no
  primeiro campo para qualquer leitor conforme.
- `columns` recebe a ordem declarada; a projeção do objeto em campos é feita
  pela biblioteca, garantindo que a ordem do cabeçalho e a das linhas não
  divirjam.
- `writeRow` respeita backpressure: quando `write()` devolve `false`, aguarda o
  evento `drain` antes de prosseguir.
- `close()` encerra o stringifier e aguarda o `finish` **do arquivo** — encerrar
  apenas o stringifier deixaria escrita pendente no buffer.
- O `index.js` fecha ambos os escritores em bloco `finally`, para que uma falha
  no meio do lote não deixe arquivo com buffer retido.

### `quoted_match` — correção de um defeito encontrado em teste

Com `record_delimiter` em CRLF, o `csv-stringify` **não** delimita com aspas um
campo que contenha apenas LF (`\n`) solto: seu critério automático compara o
campo com o delimitador configurado, e `\n` isolado não corresponde a `\r\n`.

O efeito é um arquivo corrompido em silêncio. Um clube cujo nome continha
`Quebra\nde linha` foi gravado sem aspas, e a releitura por um parser devolveu
**6 registros no lugar de 5** — o registro partido ao meio, sem qualquer erro
sinalizado na gravação.

A RFC 4180 exige delimitação para campos contendo CR **ou** LF. A condição foi
declarada explicitamente com `quoted_match: /[\r\n]/`.

O defeito só apareceu porque o fixture de teste incluía um campo com quebra de
linha **isolada**, sem vírgula nem aspas. Um campo com quebra de linha *e*
vírgula é delimitado corretamente, por disparar o escape pelo outro critério —
o que mascara o problema em testes superficiais.

### Verificação

- Sample real: 5 clubes e 8 jogadores gravados; `Pedro Lourenço, Filho`
  delimitado por aspas; acentuação preservada.
- Bytes: arquivo inicia em `49 64 20` (sem BOM); todas as quebras são CRLF.
- Fixture de escapes: vírgula, aspas internas (duplicadas), quebra de linha
  isolada e as três combinadas. Releitura por parser externo devolveu
  exatamente 5 registros, com todos os campos íntegros.
- Resiliência: arquivo com linhas malformadas gerou CSV válido apenas com os
  registros aproveitáveis, mantendo os avisos por linha.

## Consequências

- Positivas: escape conforme a RFC sem código de formato próprio; memória
  constante; cabeçalho e linhas necessariamente alinhados.
- Negativas: uma dependência externa onde antes havia zero. O projeto passa a
  ter `node_modules` e a exigir `yarn install` antes da execução.
- CRLF como terminador é o exigido pela RFC, mas diverge de saídas geradas com
  LF. Uma comparação byte a byte contra gabarito gerado em Unix acusaria
  diferença — sem que nenhum dos dois esteja incorreto.

## Alternativas consideradas

- **Writer artesanal** (implementado e verificado antes desta decisão) —
  funcionava, incluindo o caso de LF isolado que a biblioteca errava por
  padrão, e não tinha dependência. Preterido porque manter código de
  serialização de formato é responsabilidade que não agrega ao pipeline. A
  lição preservada: o critério de escape correto é `/[",\r\n]/`, e foi ele que
  motivou o `quoted_match`.
- **Acumular tudo e gravar de uma vez (`stringify/sync`)** — descartada:
  anularia a memória constante da leitura em streaming.
- **`fast-csv` ou `papaparse`** — descartadas: árvore de dependências maior,
  sem ganho para o caso de uso.
