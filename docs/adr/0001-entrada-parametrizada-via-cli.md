# ADR-0001 — Entrada parametrizada via CLI com validação fail-fast

- **Status:** Aceita
- **Data (quando):** 2026-08-11
- **Etapa:** Setup inicial (`index.js`)

## Contexto

O pipeline lê um arquivo JSONL de clubes e jogadores e gera `clubs.csv` e
`players.csv`. O arquivo de origem muda a cada execução (amostra em
desenvolvimento, extração completa em produção), então o caminho não pode estar
fixo no código.

Em execução batch, o processo é disparado por um orquestrador (cron, Airflow,
Control-M). Nesse cenário, um caminho inválido que só falha no meio da leitura
produz saída parcial — arquivos CSV truncados que parecem válidos para o passo
seguinte do pipeline.

## Decisão (por quê)

O caminho do arquivo de entrada é recebido **obrigatoriamente** como primeiro
argumento posicional da linha de comando, e sua validade é verificada **antes**
de qualquer escrita ou leitura de dados.

Motivos:

1. **Reprodutibilidade** — a mesma imagem/código roda contra qualquer origem,
   sem rebuild nem edição de arquivo.
2. **Fail-fast** — validar antes de abrir streams garante que uma falha de
   configuração nunca gere CSVs parciais no destino.
3. **Contrato com o orquestrador** — encerrar com código de saída diferente de
   zero é o sinal que agendadores usam para marcar a tarefa como falha e
   disparar retry/alerta. Um `exit(0)` silencioso mascararia o erro.

## Como

Implementado em `index.js`, na função `resolveInputPath()`:

- Lê `process.argv[2]`; ausente ou em branco → mensagem de uso e `process.exit(1)`.
- Normaliza com `path.resolve(process.cwd(), arg)`, para tratar caminhos
  relativos e separadores do Windows de forma consistente, e para que o erro
  exiba o caminho absoluto efetivamente procurado.
- `fs.existsSync()` para checar existência.
- `fs.statSync().isFile()` para rejeitar diretórios — `existsSync` retorna
  `true` para eles, e a falha só apareceria depois, no `createReadStream`.
- Toda mensagem de erro vai para `stderr` (`console.error`), mantendo `stdout`
  limpo para logs de progresso e eventual redirecionamento.

## Consequências

- Positivas: erro de configuração é detectado em milissegundos, com mensagem
  acionável; o binário fica portátil entre ambientes.
- Negativas: nenhum valor padrão de conveniência em desenvolvimento — o caminho
  precisa ser digitado sempre.
- As validações são síncronas (`existsSync`/`statSync`). É aceitável por ocorrer
  uma única vez no bootstrap, antes do loop de processamento; nenhuma chamada
  síncrona de I/O deve entrar no caminho quente da leitura linha a linha.

## Alternativas consideradas

- **Variável de ambiente (`INPUT_FILE`)** — descartada: menos explícita no
  histórico de execução e mais difícil de auditar em log de orquestrador.
- **Parser de flags (`--input`, via `yargs`/`commander`)** — descartada por ora:
  acrescenta dependência para um único parâmetro. Deve ser reavaliada se o CLI
  passar a receber mais opções (diretório de saída, nível de log).
- **Validação preguiçosa (deixar o `createReadStream` falhar)** — descartada:
  produz stack trace em vez de mensagem de uso e desperdiça a chance de falhar
  antes de tocar no destino.
