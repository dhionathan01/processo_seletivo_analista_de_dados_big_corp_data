'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const { readClubRecords } = require('../src/jsonl-reader');

let workDir;

before(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-reader-test-'));
});

after(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

/** Coletor de métricas equivalente ao usado em produção, sem escrever no console. */
function createSpyReport() {
  const skipped = [];
  let lines = 0;

  return {
    skipped,
    lineRead() {
      lines += 1;
    },
    lineSkipped(lineNumber, reason) {
      skipped.push({ lineNumber, reason });
    },
    get lineCount() {
      return lines;
    },
  };
}

/** Escreve o conteúdo em arquivo temporário e devolve os registros lidos. */
async function readAll(fileName, content, report) {
  const filePath = path.join(workDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');

  const records = [];

  for await (const record of readClubRecords(filePath, report)) {
    records.push(record);
  }

  return records;
}

describe('readClubRecords', () => {
  it('lê um objeto por linha', async () => {
    const report = createSpyReport();
    const records = await readAll('ok.jsonl', '{"club_id":"A"}\n{"club_id":"B"}\n', report);

    assert.deepEqual(
      records.map((record) => record.club_id),
      ['A', 'B']
    );
    assert.equal(report.skipped.length, 0);
  });

  it('continua o lote após uma linha malformada', async () => {
    // O registro válido depois do defeito é o que este caso protege: um lote
    // que aborta na primeira linha corrompida perde todo o trabalho restante.
    const report = createSpyReport();
    const records = await readAll(
      'malformado.jsonl',
      '{"club_id":"A"}\n{quebrado\n{"club_id":"B"}\n',
      report
    );

    assert.deepEqual(
      records.map((record) => record.club_id),
      ['A', 'B']
    );
    assert.equal(report.skipped.length, 1);
    assert.equal(report.skipped[0].lineNumber, 2);
    assert.match(report.skipped[0].reason, /JSON inválido/);
  });

  it('descarta escalares, que JSON.parse aceita sem erro', async () => {
    const report = createSpyReport();
    const records = await readAll('escalares.jsonl', '42\nnull\n"texto"\n[1,2]\n', report);

    assert.equal(records.length, 0);
    assert.equal(report.skipped.length, 4);
  });

  it('ignora linhas em branco sem contá-las como erro', async () => {
    const report = createSpyReport();
    const records = await readAll('brancos.jsonl', '{"club_id":"A"}\n\n   \n', report);

    assert.equal(records.length, 1);
    assert.equal(report.skipped.length, 0);
    assert.equal(report.lineCount, 3);
  });

  it('trata CRLF sem gerar linhas fantasma', async () => {
    const report = createSpyReport();
    const records = await readAll('crlf.jsonl', '{"club_id":"A"}\r\n{"club_id":"B"}\r\n', report);

    assert.equal(records.length, 2);
    assert.equal(report.skipped.length, 0);
  });

  it('numera as linhas a partir de 1, para rastreio na origem', async () => {
    const report = createSpyReport();
    await readAll('numeracao.jsonl', '{"club_id":"A"}\n\nlixo\n', report);

    assert.equal(report.skipped[0].lineNumber, 3);
  });
});
