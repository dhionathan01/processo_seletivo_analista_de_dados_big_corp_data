# ADR-0007 — Separação do pipeline em camadas de responsabilidade

- **Status:** Aceita
- **Data (quando):** 2026-08-11
- **Etapa:** Refatoração estrutural, antes da escrita dos CSVs

## Contexto

O `index.js` havia chegado a 252 linhas e 9 funções, concentrando quatro
responsabilidades distintas: leitura de argumentos, extração do JSONL,
transformação dos dados e emissão de mensagens. Faltava ainda a camada de
escrita, a maior das etapas restantes.

O arquivo tinha, portanto, quatro motivos independentes para mudar. Pior: com o
`createReadStream` no mesmo escopo das funções puras, testar `toIsoDate` ou
`flattenColors` exigiria um arquivo real em disco — a lógica de negócio estava
refém do I/O.

## Decisão (por quê)

Dividir o programa em módulos **por responsabilidade**, seguindo as etapas que o
próprio pipeline já tem, e reduzir o `index.js` a um *composition root*.

```
index.js                  composition root: monta as camadas e conduz o fluxo
src/cli.js                argumentos e validação do caminho de entrada
src/jsonl-reader.js       extração: streaming linha a linha, parse tolerante
src/transform/fields.js   formatação de campos escalares (funções puras)
src/transform/rows.js     regras de negócio e montagem das linhas de saída
src/batch-report.js       métricas e mensagens do lote
src/csv-writer.js         carga: escrita RFC 4180            (próxima etapa)
```

Motivos:

1. **Testabilidade.** `fields.js` e `rows.js` não importam `fs`. São funções
   puras, exercitáveis com um array de casos, sem arquivo em disco.
2. **Um motivo para mudar por módulo.** Alterar o formato de data toca
   `fields.js`; alterar o filtro toca `rows.js`; alterar o destino do log toca
   `batch-report.js`. Nenhuma dessas mudanças força releitura das demais.
3. **A divisão não é inventada — é a forma do problema.** Extract
   (`jsonl-reader`), transform (`transform/`) e load (`csv-writer`), com as
   bordas de entrada (`cli`) e de feedback (`batch-report`).

Deliberadamente **não** se agrupou por tipo de artefato (`constants.js`,
`functions.js`). Esse critério organiza pelo que a coisa *é*, não pelo que ela
*faz*: um `functions.js` acumula funções de domínios distintos e deixa de
responder "o que muda se o formato de data mudar?". As constantes ficam junto do
código que as usa — `COLOR_SEPARATOR` ao lado de `flattenColors`,
`ALLOWED_CHAMPIONSHIPS` ao lado do filtro — porque mudam pelo mesmo motivo.

## Como

- Refatoração **pura**: nenhuma mudança de comportamento. As assinaturas e os
  corpos das funções foram movidos sem alteração de lógica.
- `readClubRecords()` virou um *async generator* que entrega objetos já
  desserializados. O consumo por `for await` no `index.js` preserva o
  backpressure: a leitura só avança quando o consumidor conclui o registro
  anterior.
- O reader recebe o `report` por injeção e não conhece regra de negócio — o que
  é um "clube válido" continua sendo decisão da camada de transformação.
- `createBatchReport()` encapsula os contadores em closure e concentra **toda**
  a saída de console. As demais camadas ficaram silenciosas.
- Módulos nativos seguem importados com prefixo `node:`, conforme ADR-0002.

### Verificação

A saída de quatro cenários foi capturada antes da refatoração e comparada
depois: sample real, fixture de casos de borda, execução sem argumento e
execução com arquivo inexistente. As quatro saídas resultaram idênticas, e os
códigos de saída (`0, 0, 1, 1`) se mantiveram. Sendo refatoração pura, a
igualdade da saída é a evidência de que nada regrediu.

## Consequências

- Positivas: lógica de negócio testável sem I/O; cada módulo com um motivo para
  mudar; a camada de escrita nasce no lugar certo em vez de ser movida depois.
- Negativas: sete arquivos em vez de um — navegar exige seguir imports. Para um
  programa deste porte é um custo real, aceito porque o código será mantido e
  ainda vai crescer.
- O `index.js` passa a depender da montagem correta das camadas; um erro de
  fiação só aparece em execução, já que não há verificação estática de tipos.

## Alternativas consideradas

- **Manter tudo em `index.js`** — descartada: aceitável para script descartável
  ou análise exploratória, mas este roda em produção, será mantido e ainda
  receberá a camada de escrita.
- **Agrupar por tipo de artefato (`constants.js`, `functions.js`)** —
  descartada pelos motivos acima; produz módulos sem coesão.
- **Refatorar depois de concluir a escrita dos CSVs** — descartada: o writer
  nasceria no `index.js` e precisaria ser movido, gerando um diff que mistura
  funcionalidade nova com movimentação de código — justamente o que torna uma
  revisão difícil.
