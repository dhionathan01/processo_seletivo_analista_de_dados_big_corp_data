'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Borda de entrada do programa: leitura e validação dos argumentos de linha
 * de comando. É a única camada que conhece `process.argv`.
 */

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

module.exports = { resolveInputPath };
