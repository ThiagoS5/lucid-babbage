/**
 * Verifica se os JSONs do Códice commitados estão em dia com o Codex.md.
 *
 *   npm run codex:check
 *
 * Recompila o Markdown em memória e compara com json/codex/*.json no disco.
 * NÃO escreve nada: serve como trava de CI e de pre-commit, onde o objetivo
 * é FALHAR quando alguém editou o Codex.md e esqueceu de rodar o build.
 *
 * Saída: exit 0 (em dia) ou exit 1 (desatualizado), com o que divergiu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { compileCodexMarkdown, groupByCategory } from '../src/utils/codexCompiler.ts';
import { CODEX_CATEGORIES, CODEX_CATEGORY_FILES, CODEX_CATEGORY_LABELS } from '../src/utils/codexCategories.ts';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'Codex.md');
const OUT_DIR = path.join(ROOT, 'json', 'codex');

/** Serializa uma categoria exatamente como o build faz. */
function serialize(categoria: (typeof CODEX_CATEGORIES)[number], entries: unknown[]): string {
  return `${JSON.stringify(
    {
      categoria,
      label: CODEX_CATEGORY_LABELS[categoria],
      total: entries.length,
      entries,
    },
    null,
    2
  )}\n`;
}

function main(): void {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[codex:check] Fonte não encontrada: ${SOURCE}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(SOURCE, 'utf-8');
  const { entries, unknownTags, unknownH1Headers } = compileCodexMarkdown(markdown);

  if (unknownTags.length > 0 || unknownH1Headers.length > 0) {
    console.error('[codex:check] Classificação incompleta no Codex.md:');
    for (const tag of unknownTags) console.error(`  tag sem mapa: ${tag}`);
    for (const header of unknownH1Headers) console.error(`  H1 sem mapa: ${header}`);
    process.exit(1);
  }

  const grouped = groupByCategory(entries, CODEX_CATEGORIES);
  const stale: string[] = [];
  const missing: string[] = [];

  for (const categoria of CODEX_CATEGORIES) {
    const file = path.join(OUT_DIR, CODEX_CATEGORY_FILES[categoria]);
    if (!fs.existsSync(file)) {
      missing.push(CODEX_CATEGORY_FILES[categoria]);
      continue;
    }
    const onDisk = fs.readFileSync(file, 'utf-8');
    const expected = serialize(categoria, grouped[categoria]);
    if (onDisk !== expected) {
      // Diagnóstico: o que mudou de fato (conteúdo ou só a contagem?).
      let diskTotal = -1;
      let diskIds: string[] = [];
      try {
        const parsed = JSON.parse(onDisk) as { total?: number; entries?: Array<{ id?: string }> };
        diskTotal = parsed.total ?? -1;
        diskIds = (parsed.entries ?? []).map((e) => String(e.id ?? ''));
      } catch {
        /* JSON inválido: reportado como "ilegível" abaixo */
      }
      const expectedIds = grouped[categoria].map((e) => e.id);
      const added = expectedIds.filter((id) => !diskIds.includes(id));
      const removed = diskIds.filter((id) => !expectedIds.includes(id));
      const changed =
        added.length === 0 && removed.length === 0
          ? ' (conteúdo editado sem alterar a contagem)'
          : '';
      const detail =
        added.length > 0 || removed.length > 0
          ? `${added.length} adicionados, ${removed.length} removidos`
          : `${diskTotal} no disco, ${expectedIds.length} esperados`;
      stale.push(`  ${CODEX_CATEGORY_FILES[categoria]}: ${detail}${changed}`);
    }
  }

  if (missing.length > 0) {
    console.error('[codex:check] JSONs ausentes:');
    for (const file of missing) console.error(`  ${file}`);
    console.error('[codex:check] Rode "npm run codex:build" e commite o resultado.');
    process.exit(1);
  }

  if (stale.length > 0) {
    console.error('[codex:check] Os JSONs do Códice estão DESATUALIZADOS em relação ao Codex.md:');
    for (const line of stale) console.error(line);
    console.error('[codex:check] Rode "npm run codex:build" e commite o resultado.');
    process.exit(1);
  }

  // O acervo seed (json/inicial.json) é consumido pelo bundle do React via
  // import JSON: precisa existir e ter o total coerente com as entradas.
  const initialPath = path.join(ROOT, 'json', 'inicial.json');
  if (!fs.existsSync(initialPath)) {
    console.error('[codex:check] json/inicial.json ausente (cards seed do RPG).');
    process.exit(1);
  }
  let initialTotal = 0;
  try {
    const initial = JSON.parse(fs.readFileSync(initialPath, 'utf-8')) as {
      total?: number;
      entries?: Array<{ id?: string; keys?: string[]; value?: string; categoria?: string }>;
    };
    const initialEntries = initial.entries ?? [];
    initialTotal = initial.entries?.length ?? 0;
    if (initialEntries.length !== initial.total) {
      console.error(
        `[codex:check] json/inicial.json inconsistente: total ${initial.total} mas ${initialEntries.length} entradas.`
      );
      process.exit(1);
    }
    const invalidos = initialEntries.filter(
      (e) => !e.id || !e.value || !e.categoria || !e.keys?.length
    );
    if (invalidos.length > 0) {
      console.error(
        `[codex:check] json/inicial.json tem ${invalidos.length} entradas sem id/value/categoria/gatilhos.`
      );
      process.exit(1);
    }
  } catch (err) {
    console.error('[codex:check] json/inicial.json ilegível:', err);
    process.exit(1);
  }

  console.log(
    `[codex:check] ${entries.length} verbetes em dia com o Codex.md (${CODEX_CATEGORIES.length} categorias) + ${initialTotal} cards seed.`
  );
}

main();
