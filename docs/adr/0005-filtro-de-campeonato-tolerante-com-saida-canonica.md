# ADR-0005 — Filtro de campeonato tolerante na entrada, canônico na saída

- **Status:** Aceita
- **Data (quando):** 2026-08-11
- **Etapa:** Regras de negócio (`isTargetChampionship`, `toCanonicalChampionship`)

## Contexto

A regra de negócio determina processar apenas clubes cujo campeonato seja
`SERIE A` ou `SERIE B`. Uma comparação literal com essas duas strings resolve o
sample, onde o campo vem exatamente nesse formato.

O risco está na base real. Em origem brasileira, `Série A`, `SÉRIE A` e
`serie a` são grafias plausíveis do mesmo valor. Com comparação literal, esses
clubes seriam descartados **em silêncio** — o único sinal seria o contador de
registros fora do filtro, sem indicar que a perda foi indevida. Falso negativo
silencioso em filtro de pipeline é dos defeitos mais caros de detectar: a saída
parece íntegra, apenas menor.

O lado oposto também é problema. Aceitar as variações e gravá-las como vieram
faz a coluna `Campeonato` do `clubs.csv` carregar quatro grafias do mesmo valor.
Qualquer agregação a jusante (`GROUP BY Campeonato`) fragmenta em quatro grupos.
Em termos dimensionais, é um atributo de dimensão não-conformado — defeito, não
fidelidade.

## Decisão (por quê)

Assimetria deliberada entre entrada e saída:

- **Na comparação**, ser tolerante: ignorar caixa, acentuação e variação de
  espaços.
- **Na gravação**, ser canônico: registros que casam com o filtro saem sempre
  como `SERIE A` ou `SERIE B`.

Motivos:

1. **Tolerância na entrada evita perda silenciosa** de registros válidos por
   variação ortográfica da origem.
2. **Canonicidade na saída protege o consumo analítico**, garantindo que a
   coluna tenha exatamente dois valores possíveis.
3. **A normalização é segura porque é usada apenas para decisão e para valores
   já reconhecidos.** Não se aplica a texto livre, então não há perda de
   informação: um valor não reconhecido é gravado como veio.

A tolerância cobre apenas variações **ortográficas** do mesmo rótulo. `SERIE C`,
`SEM CAMPEONATO`, campo nulo ou ausente continuam descartados — são valores
distintos, não grafias distintas.

## Como

Implementado em `index.js`:

- `ALLOWED_CHAMPIONSHIPS` é um `Set` com `'SERIE A'` e `'SERIE B'`, na forma já
  normalizada.
- `normalizeLabel(value)` aplica, **apenas para comparação**:
  `normalize('NFD')` para separar a letra base do diacrítico, `replace(/\p{Mn}/gu, '')`
  para descartar as marcas combinantes, colapso de espaços internos via
  `/\s+/g` e `toUpperCase()`. O `trim()` vem de `toText()`.
- Optou-se por `\p{Mn}` (marcas combinantes não-espaçantes) em vez do intervalo
  `̀-ͯ`: o efeito é o mesmo para o alfabeto latino, mas o fonte
  permanece ASCII. O intervalo escrito literalmente vira caractere invisível no
  editor e é facilmente corrompido em refatoração.
- `isTargetChampionship()` consulta o `Set` com o rótulo normalizado.
- `toCanonicalChampionship()` devolve o valor normalizado quando ele pertence ao
  `Set`; caso contrário, devolve `toText()` do original.

A normalização **não** se propaga às demais colunas. `Avaí Futebol Clube`,
`São Paulo` e `Leão da Ilha` mantêm a acentuação original: o CSV é UTF-8 por
especificação, e remover acento de nome próprio é perda de informação sem
contrapartida.

## Consequências

- Positivas: nenhum clube válido é perdido por variação ortográfica; a coluna
  `Campeonato` fica conformada com dois valores possíveis.
- Negativas: o valor gravado pode diferir do literal da origem. Numa conferência
  célula a célula contra um gabarito gerado sem normalização, registros com
  acento divergiriam — mas divergiriam de qualquer modo, pois sem a tolerância
  a linha sequer apareceria.
- Registros descartados pelo filtro são apenas contabilizados, sem log do valor
  recusado. Se for necessário diagnosticar perdas em produção, o passo natural é
  registrar os valores **distintos** recusados ao fim do lote — logar cada
  ocorrência seria inviável no volume alvo.

## Alternativas consideradas

- **Comparação literal estrita (`championship === 'SERIE A'`)** — descartada:
  segue a regra ao pé da letra, mas perde registros válidos em silêncio diante
  de qualquer variação da origem.
- **Tolerar na entrada e gravar o valor original** — descartada: preserva a
  fidelidade textual ao custo de fragmentar a dimensão em grafias múltiplas.
- **Remover acentos de todas as colunas de texto** — descartada explicitamente:
  destrói informação real (`Avaí` → `Avai`) sem benefício, num arquivo cuja
  especificação já é UTF-8.
