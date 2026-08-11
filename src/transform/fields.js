'use strict';

/**
 * Formatação de campos escalares: conversão para texto, datas e listas.
 * Funções puras, sem qualquer dependência de I/O.
 */

/** Separador usado ao achatar o array de cores em uma única coluna. */
const COLOR_SEPARATOR = '|';

/** Captura a porção de data de um valor ISO, tolerando sufixo de hora. */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Converte um valor escalar do JSON em texto pronto para o CSV.
 * Ausente, nulo ou não-escalar vira string vazia; zero e false são preservados.
 *
 * @param {unknown} value Valor bruto vindo do JSON.
 * @returns {string} Representação textual, ou string vazia.
 */
function toText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Objetos e arrays não são campos escalares: não há representação plana correta.
  if (typeof value === 'object') {
    return '';
  }

  // NaN e Infinity virariam "NaN"/"Infinity" no CSV, o que não é dado utilizável.
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return '';
  }

  return String(value).trim();
}

/**
 * Normaliza um rótulo apenas para fins de comparação: remove acentos, unifica
 * a caixa e colapsa espaços internos. O valor original é preservado na saída.
 *
 * @param {unknown} value Valor bruto vindo do JSON.
 * @returns {string} Rótulo comparável (ex.: "Série  A" vira "SERIE A").
 */
function normalizeLabel(value) {
  return toText(value)
    .normalize('NFD') // separa a letra base do sinal diacrítico
    .replace(/\p{Mn}/gu, '') // descarta as marcas combinantes já separadas
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Achata o array de cores em uma única string separada por pipe.
 * Ausente, nulo, não-array ou vazio resulta em string vazia.
 *
 * @param {unknown} colors Valor bruto do campo `colors`.
 * @returns {string} Cores unidas por pipe (ex.: "preto|branco").
 */
function flattenColors(colors) {
  if (!Array.isArray(colors)) {
    return '';
  }

  return colors
    .map(toText)
    .filter((color) => color !== '')
    .join(COLOR_SEPARATOR);
}

/**
 * Valida uma data e normaliza a saída para `yyyy-MM-dd`.
 * Valor ausente, fora do padrão ou inexistente no calendário vira string vazia.
 *
 * @param {unknown} value Valor bruto do campo de data.
 * @returns {string} Data em `yyyy-MM-dd`, ou string vazia.
 */
function toIsoDate(value) {
  const text = toText(value);

  if (text === '') {
    return '';
  }

  const match = ISO_DATE_PATTERN.exec(text);

  if (match === null) {
    return '';
  }

  const [, year, month, day] = match;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  // Date.UTC acomoda datas impossíveis em vez de rejeitá-las (2023-02-30 vira
  // 2023-03-02). Comparar os componentes de volta é o que descarta o valor.
  // Os getters são UTC de propósito: os locais deslocariam o dia em fusos
  // negativos, transformando 1910-09-01 em 1910-08-31.
  const parsed = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));

  const isRealDate =
    parsed.getUTCFullYear() === numericYear &&
    parsed.getUTCMonth() === numericMonth - 1 &&
    parsed.getUTCDate() === numericDay;

  return isRealDate ? `${year}-${month}-${day}` : '';
}

module.exports = {
  COLOR_SEPARATOR,
  flattenColors,
  normalizeLabel,
  toIsoDate,
  toText,
};
