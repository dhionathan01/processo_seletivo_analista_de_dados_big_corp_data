# ADR-0004 — O pipeline não normaliza nem copia o arquivo de entrada

- **Status:** Aceita
- **Data (quando):** 2026-08-11
- **Etapa:** Revisão de escopo, após a organização de `data/`

## Contexto

O arquivo de amostra chegou ao repositório com o nome
`sample_clubes (3) (1) (2) (3).jsonl` — sufixos gerados pelo navegador ao baixar
o mesmo arquivo repetidas vezes. Espaços e parênteses obrigam o uso de aspas na
linha de comando, o que levantou a proposta de o próprio programa detectar
nomes irregulares, normalizá-los e copiar o arquivo para `data/` antes de
processar.

O arquivo foi movido manualmente para `data/sample_clubes.jsonl` via `git mv`,
resolvendo o incômodo pontual. Restou a pergunta de escopo: isso deveria ser
automatizado dentro do pipeline?

## Decisão (por quê)

O pipeline **não** renomeia, move nem copia seu arquivo de origem. Ele recebe um
caminho, lê e transforma. Nada mais.

Motivos:

1. **O sintoma é local, não de produção.** Os sufixos `(1) (2) (3)` são artefato
   de download manual em estação de trabalho. Em produção o arquivo chega por
   SFTP, bucket ou extração agendada, com nomenclatura definida por contrato de
   ingestão. Tratar isso no código seria carregar peso morto permanente para
   resolver um incômodo de ambiente de desenvolvimento.
2. **Separação de responsabilidades.** Padronizar nome e posicionar arquivo na
   *landing zone* é responsabilidade da camada de ingestão ou do orquestrador —
   não do job de transformação. Um job que faz as duas coisas passa a ter dois
   motivos para mudar.
3. **Custo e ambiguidade da cópia.** No volume alvo (dezenas de GB), copiar o
   input consome disco equivalente e uma passada inteira de I/O antes do
   trabalho útil. Pior: passam a existir duas cópias do mesmo dado sem que
   nenhuma seja declaradamente a fonte da verdade.
4. **Efeito colateral silencioso.** Um job batch que move arquivos do usuário
   sem que isso tenha sido pedido explicitamente é fonte clássica de incidente —
   especialmente quando o mesmo arquivo é insumo de outro processo.
5. **Não existe defeito a corrigir.** `path.resolve()` já normaliza o caminho, e
   qualquer shell entrega nomes com espaço corretamente quando citados. O
   programa sempre funcionou com o nome irregular; o único custo era digitar
   aspas.

Se a origem passar a entregar nomes imprevisíveis em produção, isso constitui
defeito do contrato de ingestão, a ser corrigido na origem — não absorvido aqui.

## Como

Por omissão deliberada: `resolveInputPath()` permanece apenas validando o
caminho recebido, sem qualquer escrita no sistema de arquivos. A organização de
`data/sample_clubes.jsonl` foi feita uma única vez, manualmente, via `git mv`
(preservando o histórico do arquivo).

## Consequências

- Positivas: o job continua com responsabilidade única e sem efeitos colaterais
  sobre o sistema de arquivos; nenhuma escrita ocorre fora dos CSVs de saída.
- Negativas: arquivos de origem com nome irregular exigem aspas na linha de
  comando ou renomeação manual prévia. Custo aceito conscientemente.

## Alternativas consideradas

- **Normalização automática dentro do `index.js`** — descartada pelos motivos
  acima; é a proposta que originou este ADR.
- **Script utilitário separado (`scripts/stage-input.js`, `yarn stage <arquivo>`)**
  — não descartada, apenas não implementada. Mantém a normalização como ação
  explícita do operador, fora do caminho de produção. Reavaliar se o
  posicionamento manual de arquivos em `data/` se tornar frequente.
- **Aceitar um diretório como entrada, processando todos os `.jsonl` contidos**
  — não descartada, adiada. Diferente da normalização, é comportamento
  legítimo de produção (lotes particionados por data) e não escreve nada.
  Deve gerar ADR próprio se for implementada.
