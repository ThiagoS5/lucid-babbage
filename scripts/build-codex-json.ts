import fs from 'fs';
import path from 'path';
import { compileCodexMarkdown, groupByCategory } from '../src/utils/codexCompiler.ts';
import { CODEX_CATEGORIES, CODEX_CATEGORY_FILES, CODEX_CATEGORY_LABELS } from '../src/utils/codexCategories.ts';

/**
 * Gera os JSONs do Códice a partir de Codex.md.
 *
 *   npm run codex:build
 *
 * Saída: json/codex/{personagens,habilidades,locais,outros}.json
 * O build FALHA se o markdown tiver tag ou cabeçalho H1 não classificado —
 * nunca classifica em silêncio.
 */

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'Codex.md');
const OUT_DIR = path.join(ROOT, 'json', 'codex');

function main(): void {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[codex:build] Fonte não encontrada: ${SOURCE}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(SOURCE, 'utf-8');
  const { entries, unknownTags, unknownH1Headers } = compileCodexMarkdown(markdown);

  if (unknownTags.length > 0 || unknownH1Headers.length > 0) {
    console.error('[codex:build] Classificação incompleta — corrija o markdown ou o mapa:');
    for (const tag of unknownTags) console.error(`  tag sem mapa: ${tag}`);
    for (const header of unknownH1Headers) console.error(`  H1 sem mapa: ${header}`);
    process.exit(1);
  }

  const grouped = groupByCategory(entries, CODEX_CATEGORIES);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalBytes = 0;
  for (const categoria of CODEX_CATEGORIES) {
    const list = grouped[categoria];
    const file = path.join(OUT_DIR, CODEX_CATEGORY_FILES[categoria]);
    const payload = {
      categoria,
      label: CODEX_CATEGORY_LABELS[categoria],
      total: list.length,
      entries: list,
    };
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    fs.writeFileSync(file, json, 'utf-8');
    totalBytes += Buffer.byteLength(json, 'utf-8');
    console.log(
      `[codex:build] ${CODEX_CATEGORY_FILES[categoria]} — ${list.length} verbetes (${CODEX_CATEGORY_LABELS[categoria]})`
    );
  }

  console.log(
    `[codex:build] ${entries.length} verbetes no total, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`
  );
}

main();
