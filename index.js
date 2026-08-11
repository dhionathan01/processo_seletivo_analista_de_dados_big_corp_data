'use strict';

const { createBatchReport } = require('./src/batch-report');
const { resolveInputPath } = require('./src/cli');
const { readClubRecords } = require('./src/jsonl-reader');
const { buildClubRow, buildPlayerRows, isTargetChampionship } = require('./src/transform/rows');

/**
 * Composition root: monta as camadas do pipeline e conduz o fluxo.
 * Nenhuma regra de negócio, formatação ou I/O mora aqui.
 */
async function main() {
  const inputPath = resolveInputPath();
  const report = createBatchReport();

  report.start(inputPath);

  for await (const rawClub of readClubRecords(inputPath, report)) {
    if (!isTargetChampionship(rawClub.championship)) {
      report.clubFiltered();
      continue;
    }

    const clubRow = buildClubRow(rawClub);
    const playerRows = buildPlayerRows(rawClub, clubRow['Id do Clube']);

    // Próxima etapa: escrever clubRow em clubs.csv e playerRows em players.csv.
    report.clubProcessed(clubRow, playerRows);
  }

  report.printSummary();
}

main().catch((error) => {
  // Falha irrecuperável de I/O: encerra sinalizando erro ao orquestrador.
  console.error(`Erro fatal durante a leitura do arquivo: ${error.message}`);
  process.exit(1);
});
