'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  flattenColors,
  normalizeLabel,
  toIsoDate,
  toText,
} = require('../src/transform/fields');

describe('toText', () => {
  it('converte ausência e nulo em string vazia', () => {
    assert.equal(toText(undefined), '');
    assert.equal(toText(null), '');
  });

  it('preserva zero e false', () => {
    // Um teste de falsidade (`if (!value)`) apagaria a diferença entre
    // "zero gols" e "gols desconhecidos". É o defeito que este caso protege.
    assert.equal(toText(0), '0');
    assert.equal(toText(false), 'false');
  });

  it('converte números e booleanos em texto', () => {
    assert.equal(toText(42), '42');
    assert.equal(toText(true), 'true');
  });

  it('remove espaços das bordas', () => {
    assert.equal(toText('  Timão  '), 'Timão');
  });

  it('descarta valores não escalares', () => {
    assert.equal(toText({}), '');
    assert.equal(toText([1, 2]), '');
  });

  it('descarta números não finitos', () => {
    assert.equal(toText(NaN), '');
    assert.equal(toText(Infinity), '');
  });
});

describe('normalizeLabel', () => {
  it('remove acentos, unifica caixa e colapsa espaços', () => {
    assert.equal(normalizeLabel('Série  a'), 'SERIE A');
    assert.equal(normalizeLabel('  SÉRIE B '), 'SERIE B');
  });

  it('devolve string vazia para ausência', () => {
    assert.equal(normalizeLabel(null), '');
  });
});

describe('flattenColors', () => {
  it('une as cores por pipe', () => {
    assert.equal(flattenColors(['preto', 'branco']), 'preto|branco');
  });

  it('devolve string vazia para ausente, nulo, vazio ou não-array', () => {
    assert.equal(flattenColors(undefined), '');
    assert.equal(flattenColors(null), '');
    assert.equal(flattenColors([]), '');
    assert.equal(flattenColors('azul'), '');
  });

  it('descarta elementos vazios em vez de gerar pipes órfãos', () => {
    assert.equal(flattenColors(['azul', null, '', 'branco']), 'azul|branco');
  });
});

describe('toIsoDate', () => {
  it('mantém datas ISO válidas', () => {
    assert.equal(toIsoDate('1910-09-01'), '1910-09-01');
  });

  it('trunca o sufixo de hora', () => {
    assert.equal(toIsoDate('1998-07-12T15:30:00Z'), '1998-07-12');
  });

  it('não desloca o dia por fuso horário', () => {
    // Com getters locais em fuso negativo, esta data viraria 1909-12-31.
    assert.equal(toIsoDate('1910-01-01'), '1910-01-01');
  });

  it('rejeita datas inexistentes no calendário', () => {
    // `new Date('2023-02-30')` devolve 2023-03-02 sem erro: sem verificação,
    // o pipeline gravaria uma data plausível e inventada.
    assert.equal(toIsoDate('2023-02-30'), '');
    assert.equal(toIsoDate('2023-13-01'), '');
    assert.equal(toIsoDate('2023-00-10'), '');
  });

  it('valida o ano bissexto', () => {
    assert.equal(toIsoDate('2024-02-29'), '2024-02-29');
    assert.equal(toIsoDate('2023-02-29'), '');
  });

  it('rejeita formatos regionais e lixo', () => {
    assert.equal(toIsoDate('31/12/1999'), '');
    assert.equal(toIsoDate('ontem'), '');
    assert.equal(toIsoDate('1999-1-1'), '');
  });

  it('devolve string vazia para ausência e nulo', () => {
    assert.equal(toIsoDate(undefined), '');
    assert.equal(toIsoDate(null), '');
  });
});
