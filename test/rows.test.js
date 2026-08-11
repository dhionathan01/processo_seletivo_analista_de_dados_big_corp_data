'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  CLUB_COLUMNS,
  PLAYER_COLUMNS,
  buildClubRow,
  buildPlayerRows,
  isTargetChampionship,
  toCanonicalChampionship,
} = require('../src/transform/rows');

describe('isTargetChampionship', () => {
  it('aceita as duas séries alvo', () => {
    assert.equal(isTargetChampionship('SERIE A'), true);
    assert.equal(isTargetChampionship('SERIE B'), true);
  });

  it('tolera variação de caixa, acento e espaços', () => {
    assert.equal(isTargetChampionship('serie a'), true);
    assert.equal(isTargetChampionship('Série A'), true);
    assert.equal(isTargetChampionship('  SÉRIE  B  '), true);
  });

  it('descarta campeonatos fora do alvo', () => {
    assert.equal(isTargetChampionship('SERIE C'), false);
    assert.equal(isTargetChampionship('SEM CAMPEONATO'), false);
  });

  it('descarta ausência e nulo', () => {
    assert.equal(isTargetChampionship(undefined), false);
    assert.equal(isTargetChampionship(null), false);
  });
});

describe('toCanonicalChampionship', () => {
  it('normaliza a grafia dos campeonatos reconhecidos', () => {
    // Sem isso, a coluna teria quatro grafias do mesmo valor e fragmentaria
    // qualquer agregação a jusante.
    assert.equal(toCanonicalChampionship('Série  a'), 'SERIE A');
    assert.equal(toCanonicalChampionship('serie b'), 'SERIE B');
  });

  it('mantém como veio o que não é reconhecido', () => {
    assert.equal(toCanonicalChampionship('Série C'), 'Série C');
  });
});

describe('colunas de saída', () => {
  it('declara as colunas de clubs.csv na ordem especificada', () => {
    assert.deepEqual(CLUB_COLUMNS, [
      'Id do Clube',
      'Nome',
      'Campeonato',
      'Data de Fundação',
      'Cidade',
      'Estado',
      'País',
      'Estádio',
      'Presidente',
      'Apelido',
      'Cores',
    ]);
  });

  it('declara as colunas de players.csv na ordem especificada', () => {
    assert.deepEqual(PLAYER_COLUMNS, [
      'Id do Clube',
      'Id do Jogador',
      'Nome',
      'Idade',
      'Gols',
      'Data de Estreia',
      'Posição',
      'Número da Camisa',
    ]);
  });
});

describe('buildClubRow', () => {
  it('monta a linha aplicando as regras de formatação', () => {
    const row = buildClubRow({
      club_id: 'SCCP',
      name: 'Sport Club Corinthians Paulista',
      championship: 'Série A',
      founding_date: '1910-09-01',
      city: 'São Paulo',
      state: 'SP',
      country: 'Brasil',
      stadium: 'Neo Química Arena',
      president: 'Augusto Melo',
      nickname: 'Timão',
      colors: ['preto', 'branco'],
    });

    assert.deepEqual(row, {
      'Id do Clube': 'SCCP',
      Nome: 'Sport Club Corinthians Paulista',
      Campeonato: 'SERIE A',
      'Data de Fundação': '1910-09-01',
      Cidade: 'São Paulo',
      Estado: 'SP',
      'País': 'Brasil',
      'Estádio': 'Neo Química Arena',
      Presidente: 'Augusto Melo',
      Apelido: 'Timão',
      Cores: 'preto|branco',
    });
  });

  it('preenche com string vazia os campos ausentes, sem perder colunas', () => {
    const row = buildClubRow({ club_id: 'X' });

    assert.equal(Object.keys(row).length, CLUB_COLUMNS.length);
    assert.equal(row.Apelido, '');
    assert.equal(row.Cores, '');
    assert.equal(row['Data de Fundação'], '');
  });

  it('mantém a linha quando a data é inválida', () => {
    const row = buildClubRow({ club_id: 'X', founding_date: '2023-02-30' });

    assert.equal(row['Id do Clube'], 'X');
    assert.equal(row['Data de Fundação'], '');
  });
});

describe('buildPlayerRows', () => {
  it('propaga o id do clube como chave estrangeira', () => {
    const rows = buildPlayerRows({ players: [{ player_id: 'P-1' }] }, 'CLB');

    assert.equal(rows.length, 1);
    assert.equal(rows[0]['Id do Clube'], 'CLB');
  });

  it('preserva zero em idade, gols e número da camisa', () => {
    const rows = buildPlayerRows(
      { players: [{ player_id: 'P-0', age: 0, goals: 0, shirt_number: 0 }] },
      'CLB'
    );

    assert.equal(rows[0].Idade, '0');
    assert.equal(rows[0].Gols, '0');
    assert.equal(rows[0]['Número da Camisa'], '0');
  });

  it('devolve lista vazia quando players está ausente, nulo ou não é array', () => {
    assert.deepEqual(buildPlayerRows({}, 'CLB'), []);
    assert.deepEqual(buildPlayerRows({ players: null }, 'CLB'), []);
    assert.deepEqual(buildPlayerRows({ players: {} }, 'CLB'), []);
  });

  it('descarta elementos que não sejam objetos', () => {
    const rows = buildPlayerRows(
      { players: [null, 42, ['x'], { player_id: 'P-1' }] },
      'CLB'
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]['Id do Jogador'], 'P-1');
  });
});
