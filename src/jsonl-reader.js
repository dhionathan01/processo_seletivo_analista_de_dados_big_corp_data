'use strict';

const fs = require('node:fs');
const readline = require('node:readline');

/**
 * Camada de extração: percorre o arquivo JSONL linha a linha, sem carregá-lo
 * em memória, e entrega objetos já desserializados.
 *
 * Linhas malformadas são reportadas e descartadas, sem interromper o lote.
 * O módulo não conhece regra de negócio: o que é um "clube válido" é decidido
 * pela camada de transformação.
 */

/**
 * Gera os objetos de clube de um arquivo JSONL, um por vez.
 *
 * O consumo por `for await` aplica backpressure naturalmente: a leitura só
 * avança quando o consumidor termina de processar o registro anterior.
 *
 * @param {string} inputPath Caminho absoluto do arquivo de entrada.
 * @param {{ lineRead: Function, lineSkipped: Function }} report Coletor de
 *   métricas e avisos do lote.
 * @yields {Record<string, unknown>} Objeto de clube desserializado.
 */
async function* readClubRecords(inputPath, report) {
  const stream = fs.createReadStream(inputPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber += 1;
    report.lineRead();

    // Linhas em branco (inclusive a quebra final do arquivo) não são erro.
    if (line.trim() === '') {
      continue;
    }

    let rawClub;

    try {
      rawClub = JSON.parse(line);
    } catch (error) {
      report.lineSkipped(lineNumber, `JSON inválido: ${error.message}`);
      continue;
    }

    // JSON.parse aceita escalares ("42", "null"): garante que a linha é um objeto.
    if (rawClub === null || typeof rawClub !== 'object' || Array.isArray(rawClub)) {
      report.lineSkipped(lineNumber, 'não é um objeto de clube.');
      continue;
    }

    yield rawClub;
  }
}

module.exports = { readClubRecords };
