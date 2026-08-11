'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const { createCsvWriter } = require('../src/csv-writer');

let workDir;

before(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-writer-test-'));
});

after(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

/**
 * Grava as linhas em um arquivo temporário e devolve o conteúdo bruto.
 */
async function writeAndRead(fileName, columns, rows) {
  const filePath = path.join(workDir, fileName);
  const writer = await createCsvWriter(filePath, columns);

  for (const row of rows) {
    await writer.writeRow(row);
  }

  await writer.close();

  return fs.readFileSync(filePath, 'utf8');
}

describe('createCsvWriter', () => {
  it('grava o cabeçalho mesmo sem nenhuma linha', async () => {
    const content = await writeAndRead('vazio.csv', ['A', 'B'], []);

    assert.equal(content, 'A,B\r\n');
  });

  it('usa CRLF como terminador de registro, conforme a RFC 4180', async () => {
    const content = await writeAndRead('crlf.csv', ['A'], [{ A: '1' }, { A: '2' }]);

    assert.equal(content, 'A\r\n1\r\n2\r\n');
  });

  it('não escreve BOM', async () => {
    const filePath = path.join(workDir, 'bom.csv');
    const writer = await createCsvWriter(filePath, ['A']);
    await writer.close();

    const bytes = fs.readFileSync(filePath);

    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  });

  it('delimita campos com vírgula', async () => {
    const content = await writeAndRead('virgula.csv', ['A'], [{ A: 'Lourenço, Filho' }]);

    assert.match(content, /"Lourenço, Filho"/);
  });

  it('duplica a aspa literal dentro do campo', async () => {
    const content = await writeAndRead('aspas.csv', ['A'], [{ A: 'Clube "X"' }]);

    assert.match(content, /"Clube ""X"""/);
  });

  it('delimita campo com quebra de linha isolada', async () => {
    // Regressão: com record_delimiter em CRLF, o csv-stringify não reconhece
    // um LF solto e grava o campo sem aspas, partindo o registro em dois.
    // Corrigido por `quoted_match`. Sem ele, este teste falha.
    const content = await writeAndRead('quebra.csv', ['A', 'B'], [{ A: 'linha1\nlinha2', B: 'ok' }]);

    assert.match(content, /"linha1\nlinha2",ok/);
    assert.equal(content.split('\r\n').length, 3); // cabeçalho, registro, final
  });

  it('projeta o objeto na ordem declarada das colunas', async () => {
    const content = await writeAndRead(
      'ordem.csv',
      ['Segundo', 'Primeiro'],
      [{ Primeiro: '1', Segundo: '2' }]
    );

    assert.equal(content, 'Segundo,Primeiro\r\n2,1\r\n');
  });

  it('preserva acentuação em UTF-8', async () => {
    const content = await writeAndRead('acentos.csv', ['A'], [{ A: 'Avaí — São Paulo' }]);

    assert.match(content, /Avaí — São Paulo/);
  });
});
