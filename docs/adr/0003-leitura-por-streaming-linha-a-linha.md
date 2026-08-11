# ADR-0003 — Leitura por streaming linha a linha com descarte tolerante

- **Status:** Aceita
- **Data (quando):** 2026-08-11
- **Etapa:** Leitura do arquivo (`processFile` em `index.js`)

## Contexto

A entrada é um arquivo JSONL: um objeto JSON completo por linha, cada clube
carregando o array aninhado de seus jogadores. O sample tem 6 linhas, mas o
requisito de produção é da ordem de milhões de registros — um arquivo que pode
ultrapassar largamente a memória disponível do processo.

A base real também não é confiável: linhas truncadas por falha de escrita na
origem, conteúdo não-JSON e registros parciais são esperados. Um lote noturno
que aborta na primeira linha corrompida obriga intervenção manual e perde a
janela de processamento.

## Decisão (por quê)

Ler o arquivo por streaming, uma linha por vez, e tratar cada linha como uma
unidade de falha isolada: linha inválida é registrada e descartada, o lote
continua.

Motivos:

1. **Memória constante** — o consumo passa a ser função do maior *registro*, não
   do tamanho do *arquivo*. `readFileSync` num arquivo de dezenas de GB estoura
   o heap do V8 antes de processar a primeira linha.
2. **Isolamento de falha** — o formato JSONL torna cada linha independente. Uma
   linha corrompida não contamina as demais, então abortar o lote inteiro por
   causa dela descarta trabalho válido sem necessidade.
3. **Observabilidade do descarte** — descartar em silêncio é pior que abortar:
   produz saída incompleta que ninguém percebe. Cada descarte é registrado com o
   número da linha e o motivo, e o total aparece no resumo final do lote.

## Como

Implementado em `processFile()`, em `index.js`:

- `fs.createReadStream(inputPath, { encoding: 'utf8' })` alimenta uma interface
  `readline.createInterface({ input: stream, crlfDelay: Infinity })`.
  `crlfDelay: Infinity` evita que o `\r\n` do Windows seja interpretado como
  duas quebras, o que geraria linhas vazias fantasma.
- Iteração com `for await (const line of rl)`, e **não** com `rl.on('line', …)`.
  O event emitter dispara os callbacks sem esperar a conclusão de cada um;
  quando a escrita dos CSVs entrar no fluxo, o `await` do async iterator aplica
  *backpressure* naturalmente, sem `pause()`/`resume()` manual.
- `JSON.parse` isolado em `try/catch`. No `catch`: incrementa o contador de
  descarte, emite `console.warn` com o número da linha e a mensagem do erro, e
  segue para a próxima linha via `continue`.
- Guarda adicional após o parse: `JSON.parse('42')` e `JSON.parse('null')` não
  lançam exceção. Linhas cujo resultado não seja um objeto (`null`, escalar ou
  array) são descartadas pelo mesmo caminho, pois quebrariam adiante no acesso a
  `.players`.
- Linhas em branco são puladas **sem** aviso: praticamente todo arquivo termina
  em `\n`, e contar essa quebra final como registro corrompido distorceria a
  estatística do lote.
- `main()` é encadeada com `.catch()`. O `try/catch` cobre o parse, não o I/O:
  um `EACCES` ou a perda do dispositivo durante a leitura vira rejeição da
  promise, que sem esse tratamento resultaria em `UnhandledPromiseRejection` e
  código de saída ambíguo.

## Consequências

- Positivas: memória constante independente do volume; um único registro
  corrompido não custa o lote inteiro; o log permite rastrear a linha exata na
  origem.
- Negativas: o processamento é sequencial — sem paralelismo entre linhas. É o
  trade-off correto aqui, já que o gargalo é I/O de disco, não CPU.
- Registros descartados **não** vão para um arquivo de rejeitados; existem apenas
  no log do processo. Se a auditoria do pipeline vier a exigir reprocessamento
  dos rejeitados, isso demanda um novo ADR.
- O contrato depende de "um JSON por linha". Um JSON válido quebrado em várias
  linhas (*pretty printed*) seria descartado — comportamento correto para JSONL,
  mas que precisa estar claro para quem gera o arquivo de origem.

## Alternativas consideradas

- **`fs.readFileSync` + `split('\n')`** — descartada: simples, mas carrega o
  arquivo inteiro em memória e depois duplica esse conteúdo no array de linhas.
  Inviável no volume alvo.
- **Bibliotecas de stream JSON (`JSONStream`, `stream-json`)** — descartadas:
  resolvem JSON aninhado em stream contínuo, problema que o JSONL já elimina por
  construção. Dependência sem ganho.
- **Abortar o lote na primeira linha inválida** — descartada: contraria o
  requisito de resiliência e desperdiça registros válidos por causa de um
  defeito pontual da origem.
- **Descartar linhas inválidas em silêncio** — descartada: gera saída incompleta
  sem sinal de que algo se perdeu, o pior modo de falha para um pipeline de
  dados.
