'use strict';

/**
 * Camada de feedback: concentra métricas e mensagens do lote.
 *
 * Isolar a saída de console aqui mantém as demais camadas silenciosas e
 * testáveis — e permite trocar o destino do log (arquivo, JSON estruturado,
 * coletor de métricas) sem tocar em leitura, transformação ou escrita.
 */

/**
 * Cria um coletor de métricas para uma execução do lote.
 *
 * @returns {object} Coletor com os contadores encapsulados.
 */
function createBatchReport() {
  let lineCount = 0;
  let processedCount = 0;
  let filteredCount = 0;
  let skippedCount = 0;
  let playerCount = 0;

  return {
    /** Anuncia o início do processamento. */
    start(inputPath, outputDir) {
      console.log(`Entrada: ${inputPath}`);
      console.log(`Saída:   ${outputDir}\n`);
    },

    /** Contabiliza uma linha lida, inclusive linhas em branco. */
    lineRead() {
      lineCount += 1;
    },

    /** Registra uma linha descartada por defeito de formato. */
    lineSkipped(lineNumber, reason) {
      skippedCount += 1;
      console.warn(`[AVISO] Linha ${lineNumber} ignorada — ${reason}`);
    },

    /** Registra um clube descartado pelo filtro de campeonato. */
    clubFiltered() {
      filteredCount += 1;
    },

    /** Registra um clube aproveitado e seus jogadores. */
    clubProcessed(playerRowCount) {
      processedCount += 1;
      playerCount += playerRowCount;
    },

    /** Imprime o resumo final do lote. */
    printSummary() {
      console.log('Processamento concluído.');
      console.log(`  Linhas lidas:        ${lineCount}`);
      console.log(`  Clubes gravados:     ${processedCount}`);
      console.log(`  Jogadores gravados:  ${playerCount}`);
      console.log(`  Fora do filtro:      ${filteredCount}`);
      console.log(`  Ignoradas por erro:  ${skippedCount}`);
    },
  };
}

module.exports = { createBatchReport };
