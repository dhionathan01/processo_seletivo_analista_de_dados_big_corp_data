# ADR-0002 — CommonJS como sistema de módulos

- **Status:** Aceita
- **Data (quando):** 2026-08-11
- **Etapa:** Setup inicial (`index.js`)

## Contexto

O `package.json` do projeto declara `"main": "index.js"` e **não** define
`"type"`. Nesse cenário, o Node.js interpreta arquivos `.js` como CommonJS. O
código será dividido em módulos (leitura, transformação, escrita de CSV) nas
próximas etapas, então o sistema de módulos precisa ser decidido agora, antes de
existirem imports espalhados.

O editor sinaliza a sugestão "File is a CommonJS module; it may be converted to
an ES module" — é uma dica do TypeScript language service, não um erro de
execução.

## Decisão (por quê)

Manter **CommonJS** (`require`/`module.exports`) por todo o projeto.

Motivos:

1. **Consistência com o manifesto atual** — adotar ESM exigiria adicionar
   `"type": "module"`, mudança que quebra qualquer `require` existente. Não há
   ganho funcional que justifique a troca neste escopo.
2. **Escopo do desafio** — nenhum recurso exclusivo de ESM é necessário:
   não há top-level `await` (a leitura será orquestrada dentro de uma `async
   function main`), nem dependências ESM-only.
3. **Compatibilidade de execução** — CommonJS roda sem ressalvas em qualquer
   versão LTS do Node, incluindo runtimes mais antigos comuns em servidores de
   batch corporativos.

## Como

- `require`/`module.exports` em todos os arquivos de `src/` e no `index.js`.
- Módulos nativos importados com o prefixo `node:` (`require('node:fs')`,
  `require('node:path')`), que torna explícita a origem do módulo e evita
  colisão com pacotes de mesmo nome em `node_modules`.
- `package.json` permanece sem o campo `"type"`.

## Consequências

- Positivas: zero configuração; carga de módulo síncrona e previsível; qualquer
  ferramenta do ecossistema roda sem flags.
- Negativas: sem top-level `await` — o ponto de entrada precisa de uma função
  `main()` assíncrona explícita. A dica do editor sobre conversão para ESM
  continuará aparecendo; é informativa e pode ser ignorada.
- Migrar para ESM depois exige adicionar `"type": "module"` e reescrever todos os
  `require` de uma vez. Se isso ocorrer, deve gerar um ADR que substitua este.

## Alternativas consideradas

- **ESM (`"type": "module"`)** — descartada por ora: padrão moderno e melhor para
  projetos novos, mas obriga extensões explícitas nos imports relativos
  (`./src/reader.js`) e não traz benefício mensurável a este pipeline.
- **TypeScript** — descartada: adiciona etapa de build e dependências de
  desenvolvimento a um desafio cujo requisito é Node.js puro.
