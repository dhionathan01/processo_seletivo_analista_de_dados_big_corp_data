'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

/** Campeonatos aceitos pela regra de negócio. Demais clubes são descartados. */
const ALLOWED_CHAMPIONSHIPS = new Set(['SERIE A', 'SERIE B']);

/** Separador usado ao achatar o array de cores em uma única coluna. */
const COLOR_SEPARATOR = '|';

/** Captura a porção de data de um valor ISO, tolerando sufixo de hora. */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Lê o caminho do arquivo JSONL recebido por parâmetro de linha de comando
 * e garante que ele existe antes de qualquer processamento.
 * Encerra o processo com código 1 em qualquer cenário inválido.
 *
 * @returns {string} Caminho absoluto do arquivo de entrada.
 */
function resolveInputPath() {
  const [, , inputArg] = process.argv;

  if (!inputArg || inputArg.trim() === '') {
    console.error('Erro: o caminho do arquivo JSONL de entrada é obrigatório.');
    console.error('Uso:     yarn start <caminho-do-arquivo.jsonl>');
    console.error('Exemplo: yarn start ./data/sample_clubes.jsonl');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg.trim());

  if (!fs.existsSync(inputPath)) {
    console.error(`Erro: arquivo não encontrado em "${inputPath}".`);
    console.error('Verifique o caminho informado e tente novamente.');
    process.exit(1);
  }

  if (!fs.statSync(inputPath).isFile()) {
    console.error(`Erro: o caminho "${inputPath}" não aponta para um arquivo.`);
    process.exit(1);
  }

  return inputPath;
}

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
 * Achata o array aninhado de jogadores nas linhas de `players.csv`,
 * propagando o id do clube como chave estrangeira.
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
    .map((player) => ({
      'Id do Clube': clubId,
      'Id do Jogador': toText(player.player_id),
      Nome: toText(player.name),
      Idade: toText(player.age),
      Gols: toText(player.goals),
      'Data de Estreia': toIsoDate(player.debut_date),
      'Posição': toText(player.position),
      'Número da Camisa': toText(player.shirt_number),
    }));
}

/**
 * Percorre o arquivo JSONL linha a linha, sem carregá-lo em memória.
 * Linhas malformadas são registradas e descartadas, sem interromper o lote.
 *
 * @param {string} inputPath Caminho absoluto do arquivo de entrada.
 */
async function processFile(inputPath) {
  const stream = fs.createReadStream(inputPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  let processedCount = 0;
  let filteredCount = 0;
  let skippedCount = 0;
  let playerCount = 0;

  for await (const line of rl) {
    lineNumber += 1;

    // Linhas em branco (inclusive a quebra final do arquivo) não são erro.
    if (line.trim() === '') {
      continue;
    }

    let rawClub;

    try {
      rawClub = JSON.parse(line);
    } catch (error) {
      skippedCount += 1;
      console.warn(`[AVISO] Linha ${lineNumber} ignorada — JSON inválido: ${error.message}`);
      continue;
    }

    // JSON.parse aceita escalares ("42", "null"): garante que a linha é um objeto.
    if (rawClub === null || typeof rawClub !== 'object' || Array.isArray(rawClub)) {
      skippedCount += 1;
      console.warn(`[AVISO] Linha ${lineNumber} ignorada — não é um objeto de clube.`);
      continue;
    }

    if (!isTargetChampionship(rawClub.championship)) {
      filteredCount += 1;
      continue;
    }

    const clubRow = buildClubRow(rawClub);
    const playerRows = buildPlayerRows(rawClub, clubRow['Id do Clube']);

    processedCount += 1;
    playerCount += playerRows.length;

    // Próxima etapa: escrever clubRow em clubs.csv e playerRows em players.csv.
    console.log(
      `${clubRow['Id do Clube']} | ${clubRow.Nome} | ${clubRow.Campeonato} | ` +
        `fundação: "${clubRow['Data de Fundação']}" | cores: "${clubRow.Cores}" | ` +
        `apelido: "${clubRow.Apelido}" | ${playerRows.length} jogador(es)`
    );
  }

  console.log(
    `\nLeitura concluída: ${lineNumber} linha(s) lida(s), ` +
      `${processedCount} clube(s) processado(s), ${playerCount} jogador(es), ` +
      `${filteredCount} fora do filtro, ${skippedCount} ignorada(s) por erro.`
  );
}

async function main() {
  const inputPath = resolveInputPath();

  console.log(`Arquivo de entrada validado: ${inputPath}\n`);

  await processFile(inputPath);
}

main().catch((error) => {
  // Falha irrecuperável de I/O: encerra sinalizando erro ao orquestrador.
  console.error(`Erro fatal durante a leitura do arquivo: ${error.message}`);
  process.exit(1);
});
