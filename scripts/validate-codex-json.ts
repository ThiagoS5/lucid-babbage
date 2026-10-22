import fs from 'node:fs';
import path from 'node:path';
import { CODEX_CATEGORIES, CODEX_CATEGORY_FILES } from '../src/utils/codexCategories.ts';

const ROOT = process.cwd();
const CODEX_DIR = path.join(ROOT, 'json', 'codex');

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function main(): void {
  let total = 0;
  for (const categoria of CODEX_CATEGORIES) {
    const file = path.join(CODEX_DIR, CODEX_CATEGORY_FILES[categoria]);
    if (!fs.existsSync(file)) fail(`[codex:lint] Ausente: ${file}`);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      categoria: string;
      total: number;
      entries: Array<{ id: string; title: string; tag: string; keys: string[]; value: string; categoria: string; era: string }>;
    };
    if (parsed.categoria !== categoria) fail(`[codex:lint] ${file}: categoria esperada ${categoria}, obtida ${parsed.categoria}`);
    if (parsed.entries.length !== parsed.total) fail(`[codex:lint] ${file}: total ${parsed.total} != entries ${parsed.entries.length}`);
    if (parsed.entries.length === 0) fail(`[codex:lint] ${file}: vazio (parse falhou?)`);
    for (const e of parsed.entries) {
      if (!e.id || !e.title || !e.value || !e.categoria || !e.keys?.length) {
        fail(`[codex:lint] ${file}: verbete sem campo obrigatório: ${e.id || e.title}`);
      }
      if (!(CODEX_CATEGORIES as readonly string[]).includes(e.categoria)) fail(`[codex:lint] categoria inválida: ${e.categoria}`);
      if (!['canon','sequel','both'].includes(e.era)) fail(`[codex:lint] era inválida: ${e.era} (${e.title})`);
    }
    total += parsed.entries.length;
    console.log(`[codex:lint] ${CODEX_CATEGORY_FILES[categoria]} — ${parsed.entries.length} verbetes OK`);
  }
  const inicialPath = path.join(ROOT, 'json', 'inicial.json');
  if (!fs.existsSync(inicialPath)) fail('[codex:lint] json/inicial.json ausente');
  const inicial = JSON.parse(fs.readFileSync(inicialPath, 'utf8')) as { total: number; entries: unknown[] };
  if ((inicial.entries as unknown[]).length !== inicial.total) fail(`[codex:lint] inicial.json: total ${inicial.total} != ${(inicial.entries as unknown[]).length}`);
  console.log(`[codex:lint] ${total} verbetes em PT-BR OK (4 categorias) + ${inicial.total} seed`);
}

main();
