# ADR-0006 — Regras de formatação de campos: nulos, datas e cores

- **Status:** Aceita
- **Data (quando):** 2026-08-11
- **Etapa:** Regras de negócio (`toText`, `toIsoDate`, `flattenColors`)

## Contexto

O JSON de origem é fracamente tipado e admite ausência de campo, `null`, tipos
inesperados e valores fora do domínio. O CSV de destino é plano e textual: toda
célula precisa de uma representação definida, e a especificação exige string
vazia para ausência, `yyyy-MM-dd` estrito para datas e cores achatadas por pipe.

Cada uma dessas conversões tem uma armadilha específica, e todas produzem dados
plausíveis quando erradas — o pior modo de falha, porque não gera exceção.

## Decisão (por quê)

Três funções puras, uma por natureza de campo, aplicadas na montagem das linhas.

### 1. `toText` — escalares e nulos

Ausente e `null` viram string vazia. **Zero e `false` são preservados.**

O teste de falsidade (`if (!value) return ''`) seria a implementação óbvia e
está errado: um artilheiro com `goals: 0` viraria célula vazia. A distinção
entre "zero gols" e "gols desconhecidos" desaparece, e o defeito só apareceria
meses depois, numa análise agregada, sem rastro da causa.

Também se descarta o que não é escalar:

- Objetos e arrays viram string vazia — não existe representação plana correta
  para eles numa célula de campo escalar; `String({})` produziria
  `[object Object]`.
- `NaN` e `Infinity` viram string vazia — `String(NaN)` gravaria `"NaN"`, que
  não é dado utilizável a jusante.

### 2. `toIsoDate` — datas

Aceita apenas o padrão ISO `yyyy-MM-dd`, tolerando sufixo de hora
(`1998-07-12T15:30:00Z` → `1998-07-12`). Qualquer outro formato vira string
vazia, mantendo a linha.

Duas armadilhas tratadas:

- **`Date` acomoda datas impossíveis em vez de rejeitá-las.** `2023-02-30`
  vira silenciosamente `2023-03-02`. Sem verificação, o pipeline gravaria uma
  data plausível e inventada. A validação reconstrói a data e compara os
  componentes de volta; divergência significa que a entrada não existe no
  calendário.
- **Fuso horário desloca o dia.** `new Date('1910-09-01')` é interpretado como
  meia-noite UTC; lido com getters locais em UTC-3, devolve `1910-08-31`. Um
  erro de um dia em toda a base, invisível em inspeção superficial. Por isso a
  construção usa `Date.UTC()` e a leitura usa exclusivamente getters `getUTC*`.

Formatos regionais como `31/12/1999` são rejeitados deliberadamente:
`dd/MM/yyyy` e `MM/dd/yyyy` são indistinguíveis para dias ≤ 12, e adivinhar
produziria datas trocadas sem qualquer sinal de erro. Uma origem que envie data
regional deve ter isso corrigido na ingestão ou tratado por decisão explícita.

### 3. `flattenColors` — array de cores

Une os elementos com `|`. Ausente, `null`, array vazio ou valor não-array vira
string vazia. Elementos nulos ou vazios dentro do array são descartados antes
da junção, para não gerar pipes órfãos (`azul||branco`).

## Como

Implementado em `index.js`, com as três funções aplicadas em `buildClubRow()` e
`buildPlayerRows()`. Ambos os construtores devolvem objetos **já chaveados pelos
nomes finais das colunas** (`'Id do Clube'`, `'Data de Fundação'`, …), de modo
que a etapa de escrita derive cabeçalho e valores diretamente das chaves, sem
uma segunda lista de nomes que possa divergir da especificação.

`buildPlayerRows()` descarta elementos do array `players` que não sejam objetos
(`null`, escalares, arrays aninhados) e propaga o `Id do Clube` já normalizado
como chave estrangeira.

## Consequências

- Positivas: toda célula tem representação definida; nenhum dado é inventado;
  registros parciais são preservados em vez de descartados.
- Negativas: a distinção entre "campo ausente", "campo nulo" e "campo com valor
  inválido" se perde — as três situações produzem string vazia. É imposição do
  formato CSV, que não tem representação nativa de nulo.
- Datas inválidas são silenciosamente esvaziadas, sem log. Diferente do parse de
  linha, aqui o registro é aproveitado, e um aviso por campo inválido seria
  ruidoso demais no volume alvo. Se a qualidade da origem precisar de
  monitoramento, o caminho é contabilizar por campo e reportar no resumo do
  lote.

## Alternativas consideradas

- **Descartar a linha inteira quando a data for inválida** — descartada:
  contraria a especificação, que manda manter a linha, e perderia todos os
  demais campos válidos do registro por causa de um só defeito.
- **Usar `Date.parse()` direto sobre o valor** — descartada: aceita formatos
  ambíguos e dependentes de implementação, e devolve resultado plausível para
  entradas que deveriam ser rejeitadas.
- **Adotar uma biblioteca de datas (`date-fns`, `dayjs`)** — descartada:
  dependência externa para validar um único formato ISO, que `Date.UTC()` mais
  comparação de componentes já resolve em poucas linhas.
- **Aceitar `dd/MM/yyyy` além do ISO** — descartada por ambiguidade
  irrecuperável com `MM/dd/yyyy`. Reavaliar apenas se a origem documentar
  formalmente o formato regional.
