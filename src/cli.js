'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Borda de entrada do programa: leitura e validação dos argumentos de linha
 * de comando. É a única camada que conhece `process.argv`.
 */

/** Diretório de saída usado quando o segundo argumento é omitido: raiz do projeto. */
const DEFAULT_OUTPUT_DIR = '.';

/**
 * Lê e valida os argumentos de linha de comando.
 * Encerra o processo com código 1 em qualquer cenário inválido, antes de
 * qualquer leitura ou escrita de dados.
 *
 * @returns {{ inputPath: string, outputDir: string }} Caminhos absolutos.
 */
function parseArguments() {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg || inputArg.trim() === '') {
    console.error('Erro: o caminho do arquivo JSONL de entrada é obrigatório.');
    console.error('Uso:     yarn start <caminho-do-arquivo.jsonl> [diretorio-de-saida]');
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

  const outputArgument = outputArg && outputArg.trim() !== '' ? outputArg.trim() : DEFAULT_OUTPUT_DIR;
  const outputDir = path.resolve(process.cwd(), outputArgument);

  if (fs.existsSync(outputDir) && !fs.statSync(outputDir).isDirectory()) {
    console.error(`Erro: o caminho de saída "${outputDir}" existe e não é um diretório.`);
    process.exit(1);
  }

  return { inputPath, outputDir };
}

module.exports = { DEFAULT_OUTPUT_DIR, parseArguments };
