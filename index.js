'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { createBatchReport } = require('./src/batch-report');
const { parseArguments } = require('./src/cli');
const { createCsvWriter } = require('./src/csv-writer');
const { readClubRecords } = require('./src/jsonl-reader');
const {
  CLUB_COLUMNS,
  PLAYER_COLUMNS,
  buildClubRow,
  buildPlayerRows,
  isTargetChampionship,
} = require('./src/transform/rows');

/** Nomes dos arquivos gerados, conforme a especificação do desafio. */
const CLUBS_FILE = 'clubs.csv';
const PLAYERS_FILE = 'players.csv';

/**
 * Composition root: monta as camadas do pipeline e conduz o fluxo.
 * Nenhuma regra de negócio, formatação ou I/O detalhado mora aqui.
 */
async function main() {
  const { inputPath, outputDir } = parseArguments();
  const report = createBatchReport();

  report.start(inputPath, outputDir);

  fs.mkdirSync(outputDir, { recursive: true });

  const clubsWriter = await createCsvWriter(path.join(outputDir, CLUBS_FILE), CLUB_COLUMNS);
  const playersWriter = await createCsvWriter(path.join(outputDir, PLAYERS_FILE), PLAYER_COLUMNS);

  try {
    for await (const rawClub of readClubRecords(inputPath, report)) {
      if (!isTargetChampionship(rawClub.championship)) {
        report.clubFiltered();
        continue;
      }

      const clubRow = buildClubRow(rawClub);
      const playerRows = buildPlayerRows(rawClub, clubRow['Id do Clube']);

      await clubsWriter.writeRow(clubRow);

      for (const playerRow of playerRows) {
        await playersWriter.writeRow(playerRow);
      }

      report.clubProcessed(playerRows.length);
    }
  } finally {
    // Fecha os arquivos mesmo em caso de falha, para não deixar buffer retido.
    await clubsWriter.close();
    await playersWriter.close();
  }

  report.printSummary();
}

main().catch((error) => {
  // Falha irrecuperável de I/O: encerra sinalizando erro ao orquestrador.
  console.error(`Erro fatal durante o processamento: ${error.message}`);
  process.exit(1);
});
