'use strict';

const fs = require('node:fs');
const { once } = require('node:events');
const { stringify } = require('csv-stringify');

/**
 * Camada de carga: escrita incremental de CSV.
 *
 * A serialização é delegada ao `csv-stringify`, que implementa a RFC 4180 —
 * delimitação por aspas quando o campo contém vírgula, aspas ou quebra de
 * linha, e duplicação da aspa literal dentro do campo. Escrever isso à mão é
 * possível, mas é código de formato que não agrega valor ao pipeline e cujas
 * bordas só aparecem em produção.
 *
 * Cada linha vai para o stream assim que é montada, de modo que o consumo de
 * memória não acompanhe o volume do lote.
 */

/** A RFC 4180 define CRLF como terminador de registro. */
const RECORD_DELIMITER = '\r\n';

/**
 * Abre um arquivo CSV para escrita incremental e grava o cabeçalho.
 *
 * @param {string} filePath Caminho absoluto do arquivo de saída.
 * @param {ReadonlyArray<string>} columns Nomes das colunas, na ordem de saída.
 * @returns {Promise<{ writeRow: Function, close: Function }>} Escritor aberto.
 */
async function createCsvWriter(filePath, columns) {
  const fileStream = fs.createWriteStream(filePath, { encoding: 'utf8' });

  const stringifier = stringify({
    header: true,
    columns: [...columns],
    record_delimiter: RECORD_DELIMITER,
    // O escape automático compara o campo com o `record_delimiter`. Com CRLF
    // configurado, um LF solto dentro do campo não é reconhecido e sai sem
    // aspas, quebrando o registro em duas linhas. A RFC 4180 exige aspas para
    // CR ou LF isolados, então a condição é declarada explicitamente.
    quoted_match: /[\r\n]/,
    // Sem BOM: a especificação pede UTF-8, e o BOM apareceria como lixo no
    // primeiro campo para qualquer leitor conforme.
    bom: false,
  });

  let failure = null;

  const captureFailure = (error) => {
    failure = failure ?? error;
  };

  stringifier.on('error', captureFailure);
  fileStream.on('error', captureFailure);

  stringifier.pipe(fileStream);

  return {
    /**
     * Grava uma linha. O objeto é projetado na ordem declarada das colunas.
     *
     * Respeita o backpressure: quando o buffer interno enche, `write` devolve
     * false e a escrita aguarda o evento `drain`. Sem isso, um lote grande
     * acumularia em memória o que o disco não conseguiu vazar.
     *
     * @param {Record<string, string>} row Linha a escrever.
     */
    async writeRow(row) {
      if (failure !== null) {
        throw failure;
      }

      if (!stringifier.write(row)) {
        await once(stringifier, 'drain');
      }
    },

    /** Encerra a serialização e aguarda o arquivo ser efetivamente gravado. */
    async close() {
      stringifier.end();

      // 'finish' do arquivo é o que garante que o buffer chegou ao disco;
      // encerrar apenas o stringifier deixaria escrita pendente.
      await once(fileStream, 'finish');

      if (failure !== null) {
        throw failure;
      }
    },
  };
}

module.exports = { createCsvWriter };
