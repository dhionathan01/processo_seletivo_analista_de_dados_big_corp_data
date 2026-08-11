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
    start(inputPath) {
      console.log(`Arquivo de entrada validado: ${inputPath}\n`);
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
    clubProcessed(clubRow, playerRows) {
      processedCount += 1;
      playerCount += playerRows.length;

      // Rastro temporário de conferência: sai quando a escrita dos CSVs entrar.
      console.log(
        `${clubRow['Id do Clube']} | ${clubRow.Nome} | ${clubRow.Campeonato} | ` +
          `fundação: "${clubRow['Data de Fundação']}" | cores: "${clubRow.Cores}" | ` +
          `apelido: "${clubRow.Apelido}" | ${playerRows.length} jogador(es)`
      );
    },

    /** Imprime o resumo final do lote. */
    printSummary() {
      console.log(
        `\nLeitura concluída: ${lineCount} linha(s) lida(s), ` +
          `${processedCount} clube(s) processado(s), ${playerCount} jogador(es), ` +
          `${filteredCount} fora do filtro, ${skippedCount} ignorada(s) por erro.`
      );
    },
  };
}

module.exports = { createBatchReport };
