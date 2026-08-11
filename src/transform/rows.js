'use strict';

const { flattenColors, normalizeLabel, toIsoDate, toText } = require('./fields');

/**
 * Regras de negócio: filtro de campeonato e montagem das linhas de saída.
 * As chaves dos objetos são os nomes finais das colunas dos CSVs — o cabeçalho
 * é derivado delas, evitando uma segunda lista de nomes que possa divergir.
 */

/** Campeonatos aceitos pela regra de negócio. Demais clubes são descartados. */
const ALLOWED_CHAMPIONSHIPS = new Set(['SERIE A', 'SERIE B']);

/**
 * Aplica o filtro de campeonato da regra de negócio.
 * A comparação ignora caixa, acentuação e variação de espaços.
 *
 * @param {unknown} championship Valor bruto do campo `championship`.
 * @returns {boolean} `true` se o clube deve ser processado.
 */
function isTargetChampionship(championship) {
  return ALLOWED_CHAMPIONSHIPS.has(normalizeLabel(championship));
}

/**
 * Devolve a forma canônica do campeonato para a saída, evitando que a mesma
 * série apareça com grafias diferentes ("Série A", "serie a") e fragmente
 * agregações a jusante. Valor não reconhecido é mantido como veio.
 *
 * @param {unknown} championship Valor bruto do campo `championship`.
 * @returns {string} Campeonato canônico, ou o texto original.
 */
function toCanonicalChampionship(championship) {
  const normalized = normalizeLabel(championship);

  return ALLOWED_CHAMPIONSHIPS.has(normalized) ? normalized : toText(championship);
}

/**
 * Monta a linha de `clubs.csv` já com os nomes finais das colunas.
 *
 * @param {Record<string, unknown>} rawClub Objeto de clube vindo do JSONL.
 * @returns {Record<string, string>} Linha pronta para escrita.
 */
function buildClubRow(rawClub) {
  return {
    'Id do Clube': toText(rawClub.club_id),
    Nome: toText(rawClub.name),
    Campeonato: toCanonicalChampionship(rawClub.championship),
    'Data de Fundação': toIsoDate(rawClub.founding_date),
    Cidade: toText(rawClub.city),
    Estado: toText(rawClub.state),
    'País': toText(rawClub.country),
    'Estádio': toText(rawClub.stadium),
    Presidente: toText(rawClub.president),
    Apelido: toText(rawClub.nickname),
    Cores: flattenColors(rawClub.colors),
  };
}

/**
 * Monta uma linha de `players.csv`, propagando o id do clube como chave
 * estrangeira.
 *
 * @param {Record<string, unknown>} rawPlayer Objeto de jogador vindo do JSONL.
 * @param {string} clubId Id do clube já normalizado.
 * @returns {Record<string, string>} Linha pronta para escrita.
 */
function buildPlayerRow(rawPlayer, clubId) {
  return {
    'Id do Clube': clubId,
    'Id do Jogador': toText(rawPlayer.player_id),
    Nome: toText(rawPlayer.name),
    Idade: toText(rawPlayer.age),
    Gols: toText(rawPlayer.goals),
    'Data de Estreia': toIsoDate(rawPlayer.debut_date),
    'Posição': toText(rawPlayer.position),
    'Número da Camisa': toText(rawPlayer.shirt_number),
  };
}

/**
 * Achata o array aninhado de jogadores nas linhas de `players.csv`.
 * Elementos que não sejam objetos são descartados.
 *
 * @param {Record<string, unknown>} rawClub Objeto de clube vindo do JSONL.
 * @param {string} clubId Id do clube já normalizado.
 * @returns {Array<Record<string, string>>} Linhas prontas para escrita.
 */
function buildPlayerRows(rawClub, clubId) {
  if (!Array.isArray(rawClub.players)) {
    return [];
  }

  return rawClub.players
    .filter((player) => player !== null && typeof player === 'object' && !Array.isArray(player))
    .map((player) => buildPlayerRow(player, clubId));
}

// As colunas são derivadas dos próprios construtores, aplicados a um registro
// vazio. Assim o cabeçalho não pode divergir das linhas nem ficar defasado, e
// continua disponível mesmo quando o lote não produz nenhum registro.
const CLUB_COLUMNS = Object.freeze(Object.keys(buildClubRow({})));
const PLAYER_COLUMNS = Object.freeze(Object.keys(buildPlayerRow({}, '')));

module.exports = {
  ALLOWED_CHAMPIONSHIPS,
  CLUB_COLUMNS,
  PLAYER_COLUMNS,
  buildClubRow,
  buildPlayerRow,
  buildPlayerRows,
  isTargetChampionship,
  toCanonicalChampionship,
};
