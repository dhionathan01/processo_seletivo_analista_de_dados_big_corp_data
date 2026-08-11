# ADRs — Architecture Decision Records

Este diretório registra as decisões de arquitetura do projeto. Cada ADR documenta
**quando** a decisão foi tomada, **por que** ela foi tomada e **como** ela foi
implementada, para que a linha de raciocínio sobreviva ao código.

## Convenções

- Um arquivo por decisão, nomeado `NNNN-titulo-em-kebab-case.md`.
- Numeração sequencial, sem reaproveitamento: uma decisão revista gera um novo
  ADR que marca o anterior como `Substituída por ADR-NNNN`.
- Status possíveis: `Proposta`, `Aceita`, `Substituída por ADR-NNNN`, `Revogada`.
- ADRs são imutáveis depois de aceitos, exceto pela atualização do campo Status.

## Índice

| ADR | Título | Status | Data |
| --- | --- | --- | --- |
| [0001](0001-entrada-parametrizada-via-cli.md) | Entrada parametrizada via CLI com validação fail-fast | Aceita | 2026-08-11 |
| [0002](0002-commonjs-como-sistema-de-modulos.md) | CommonJS como sistema de módulos | Aceita | 2026-08-11 |
| [0003](0003-leitura-por-streaming-linha-a-linha.md) | Leitura por streaming linha a linha com descarte tolerante | Aceita | 2026-08-11 |
| [0004](0004-pipeline-nao-normaliza-arquivo-de-entrada.md) | O pipeline não normaliza nem copia o arquivo de entrada | Aceita | 2026-08-11 |
| [0005](0005-filtro-de-campeonato-tolerante-com-saida-canonica.md) | Filtro de campeonato tolerante na entrada, canônico na saída | Aceita | 2026-08-11 |
| [0006](0006-regras-de-formatacao-de-campos.md) | Regras de formatação de campos: nulos, datas e cores | Aceita | 2026-08-11 |
| [0007](0007-separacao-em-camadas-de-responsabilidade.md) | Separação do pipeline em camadas de responsabilidade | Aceita | 2026-08-11 |
| [0008](0008-escrita-csv-com-csv-stringify.md) | Escrita dos CSVs com `csv-stringify` em modo stream | Aceita | 2026-08-11 |
