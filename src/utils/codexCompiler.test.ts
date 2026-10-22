import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileCodexMarkdown, normalizeTitle } from './codexCompiler.ts';
import {
  CODEX_CATEGORIES,
  CODEX_CATEGORY_FILES,
  categoryForType,
  categoryOfCard,
  RAW_STORY_TYPE_MAP,
} from './codexCategories.ts';

function loadAllCodexEntries(): Array<{ id: string; title: string; tag: string; keys: string[]; type: string; categoria: string; era: string; value: string }> {
  const all: Array<{ id: string; title: string; tag: string; keys: string[]; type: string; categoria: string; era: string; value: string }> = [];
  for (const cat of CODEX_CATEGORIES) {
    const file = path.join(process.cwd(), 'json', 'codex', CODEX_CATEGORY_FILES[cat]);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { entries: typeof all };
    all.push(...parsed.entries);
  }
  return all;
}

test('todo JSON do Códice tem schema válido e PT-BR (sem tags EN residuais)', () => {
  for (const cat of CODEX_CATEGORIES) {
    const file = path.join(process.cwd(), 'json', 'codex', CODEX_CATEGORY_FILES[cat]);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { categoria: string; total: number; entries: Array<{ id: string; title: string; tag: string; keys: string[]; value: string; categoria: string; era: string }> };
    assert.equal(parsed.categoria, cat);
    assert.equal(parsed.entries.length, parsed.total, `total divergente em ${cat}`);
    for (const e of parsed.entries) {
      assert.ok(e.id && e.title && e.value && e.categoria && e.keys?.length, `verbete sem campo: ${e.id}`);
      assert.ok(!/Techniques|Cursed Tool|Cursed Object|Binding Vow/i.test(e.tag), `tag ainda em EN: ${e.tag} (${e.title})`);
      assert.ok(CODEX_CATEGORIES.includes(e.categoria as never), `categoria inválida: ${e.categoria}`);
    }
  }
});

test('compileCodexMarkdown preserva o corpo integral (teste unitário do parser legado)', () => {
  const md = `## [Técnica] Fireball\nConteúdo longo ${'x'.repeat(3500)}\n## [Personagem] Test Char\nBio curta`;
  const { entries } = compileCodexMarkdown(md);
  const longest = entries.reduce((a, b) => (b.value.length > a.value.length ? b : a));
  assert.ok(longest.value.length > 3000);
  assert.equal(entries.filter((e) => e.value.length === 2600).length, 0);
});

test('todo verbete tem categoria explícita coerente com o tipo', () => {
  const entries = loadAllCodexEntries();
  for (const entry of entries) {
    assert.ok(CODEX_CATEGORIES.includes(entry.categoria as never));
    assert.equal(entry.categoria, categoryForType(entry.type as never), `${entry.title} incoerente`);
    assert.ok(entry.keys.length > 0, `${entry.title} sem gatilhos`);
    assert.ok(entry.value.trim().length > 0, `${entry.title} sem corpo`);
  }
});

test('as quatro categorias do Códice recebem verbetes', () => {
  for (const categoria of CODEX_CATEGORIES) {
    const file = path.join(process.cwd(), 'json', 'codex', CODEX_CATEGORY_FILES[categoria]);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { entries: unknown[] };
    assert.ok(parsed.entries.length > 0, `categoria ${categoria} vazia`);
  }
});

test('eventos canônicos carregam era=canon e nunca caem em both', () => {
  const entries = loadAllCodexEntries();
  const canon = entries.filter((e) => e.era === 'canon');
  assert.ok(canon.length > 0, 'deve haver verbetes de evento canônico');
  for (const entry of canon) {
    assert.match(entry.title + ' ' + entry.tag, /evento|incidente|desfile|shibuya|kyoto/i);
  }
});

test('nenhum JSON contém verbete fantasma do preâmbulo', () => {
  const entries = loadAllCodexEntries();
  assert.equal(entries.find((e) => e.title.includes('CÓDICE DEFINITIVO E ENCICLOPÉDICO')), undefined);
});

test('compileCodexMarkdown normaliza CRLF corretamente', () => {
  const lf = compileCodexMarkdown('## [Técnica] A\ncorpo\n## [Personagem] B\nbio');
  const crlf = compileCodexMarkdown('## [Técnica] A\r\ncorpo\r\n## [Personagem] B\r\nbio');
  assert.equal(crlf.entries.length, lf.entries.length);
  assert.deepEqual(crlf.entries.map((e) => e.title), lf.entries.map((e) => e.title));
});

test('normalizeTitle remove tag e numeração de grupo', () => {
  assert.equal(normalizeTitle('1. [Facção] Unidade Kukuru (Kukurutai)'), 'Unidade Kukuru (Kukurutai)');
  assert.equal(normalizeTitle('[Técnica] Manji Kick'), 'Manji Kick');
});

test('categoryOfCard prefere a categoria explícita e cai no tipo como backup', () => {
  assert.equal(categoryOfCard({ type: 'lore', categoria: 'habilidades' }), 'habilidades');
  assert.equal(categoryOfCard({ type: 'character' }), 'personagens');
  assert.equal(categoryOfCard({ type: 'technique' }), 'habilidades');
  assert.equal(categoryOfCard({ type: 'location' }), 'locais');
  assert.equal(categoryOfCard({ type: 'faction' }), 'outros');
});

test('todo tipo cru dos story cards tem mapeamento explícito', () => {
  const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'json', 'adventure-UhtU4tSbk-kc-story-cards-284.json'), 'utf-8')) as Array<Record<string, unknown>>;
  const rawTypes = new Set(raw.map((c) => String(c.type || '').trim().toLowerCase()));
  for (const rawType of rawTypes) {
    assert.ok(RAW_STORY_TYPE_MAP[rawType], `tipo cru sem mapeamento: ${rawType}`);
  }
});

test('os arquivos de categoria do Códice existem no disco', () => {
  const outDir = path.resolve(process.cwd(), 'json', 'codex');
  for (const categoria of CODEX_CATEGORIES) {
    const filePath = path.join(outDir, CODEX_CATEGORY_FILES[categoria]);
    assert.ok(fs.existsSync(filePath), `faltou ${CODEX_CATEGORY_FILES[categoria]}`);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(parsed.categoria, categoria);
    assert.equal(parsed.entries.length, parsed.total);
  }
});
