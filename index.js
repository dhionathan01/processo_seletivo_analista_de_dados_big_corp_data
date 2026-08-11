'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

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
 * Percorre o arquivo JSONL linha a linha, sem carregá-lo em memória.
 * Linhas malformadas são registradas e descartadas, sem interromper o lote.
 *
 * @param {string} inputPath Caminho absoluto do arquivo de entrada.
 */
async function processFile(inputPath) {
  const stream = fs.createReadStream(inputPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  let parsedCount = 0;
  let skippedCount = 0;

  for await (const line of rl) {
    lineNumber += 1;

    // Linhas em branco (inclusive a quebra final do arquivo) não são erro.
    if (line.trim() === '') {
      continue;
    }

    let club;

    try {
      club = JSON.parse(line);
    } catch (error) {
      skippedCount += 1;
      console.warn(`[AVISO] Linha ${lineNumber} ignorada — JSON inválido: ${error.message}`);
      continue;
    }

    // JSON.parse aceita escalares ("42", "null"): garante que a linha é um objeto.
    if (club === null || typeof club !== 'object' || Array.isArray(club)) {
      skippedCount += 1;
      console.warn(`[AVISO] Linha ${lineNumber} ignorada — não é um objeto de clube.`);
      continue;
    }

    parsedCount += 1;
    console.log(club.club_id);
  }

  console.log(
    `\nLeitura concluída: ${lineNumber} linha(s) lida(s), ` +
      `${parsedCount} clube(s) processado(s), ${skippedCount} ignorada(s).`
  );
}

async function main() {
  const inputPath = resolveInputPath();

  console.log(`Arquivo de entrada validado: ${inputPath}\n`);

  await processFile(inputPath);
  // Próxima etapa: filtro por campeonato (SERIE A / SERIE B).
}

main().catch((error) => {
  // Falha irrecuperável de I/O: encerra sinalizando erro ao orquestrador.
  console.error(`Erro fatal durante a leitura do arquivo: ${error.message}`);
  process.exit(1);
});
