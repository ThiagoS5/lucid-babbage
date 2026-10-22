import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileCodexMarkdown, groupByCategory, normalizeTitle } from './codexCompiler.ts';
import {
  CODEX_CATEGORIES,
  CODEX_CATEGORY_FILES,
  categoryForType,
  categoryOfCard,
  RAW_STORY_TYPE_MAP,
} from './codexCategories.ts';

const CODEX_MD = path.resolve(process.cwd(), 'Codex.md');

test('compileCodexMarkdown não deixa tag nem cabeçalho H1 sem classificação', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { unknownTags, unknownH1Headers } = compileCodexMarkdown(markdown);
  assert.deepEqual(unknownTags, [], `tags sem mapeamento: ${unknownTags.join(', ')}`);
  assert.deepEqual(unknownH1Headers, [], `H1 sem classificação: ${unknownH1Headers.join(', ')}`);
});

test('compileCodexMarkdown preserva o corpo integral de cada verbete', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);

  const longest = entries.reduce((a, b) => (b.value.length > a.value.length ? b : a));
  assert.ok(longest.value.length > 3000, 'o maior verbete deve passar de 3000 chars');

  // Nenhum verbete pode ter sido cortado no limite antigo de 2600 chars.
  const truncated = entries.filter((e) => e.value.length === 2600);
  assert.equal(truncated.length, 0, 'nenhum verbete deve ter corpo de exatamente 2600 chars');
});

test('todo verbete tem categoria explícita coerente com o tipo', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  for (const entry of entries) {
    assert.ok(CODEX_CATEGORIES.includes(entry.categoria));
    assert.equal(entry.categoria, categoryForType(entry.type), `${entry.title} incoerente`);
    assert.ok(entry.keys.length > 0, `${entry.title} sem gatilhos`);
    assert.ok(entry.value.trim().length > 0, `${entry.title} sem corpo`);
  }
});

test('as quatro categorias do Códice recebem verbetes', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  const grouped = groupByCategory(entries, CODEX_CATEGORIES);
  for (const categoria of CODEX_CATEGORIES) {
    assert.ok(grouped[categoria].length > 0, `categoria ${categoria} vazia`);
  }
});

test('eventos canônicos carregam era=canon e nunca caem em "both"', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  const canon = entries.filter((e) => e.era === 'canon');
  assert.ok(canon.length > 0, 'deve haver verbetes de evento canônico');
  for (const entry of canon) {
    assert.match(entry.title + ' ' + entry.tag, /evento|incidente|desfile|shibuya|kyoto/i);
  }
});

test('o preâmbulo do Codex.md não vira verbete', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  assert.equal(
    entries.find((e) => e.title.includes('CÓDICE DEFINITIVO E ENCICLOPÉDICO')),
    undefined
  );
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
  const raw = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), 'json', 'adventure-UhtU4tSbk-kc-story-cards-284.json'),
      'utf-8'
    )
  ) as Array<Record<string, unknown>>;
  const rawTypes = new Set(raw.map((c) => String(c.type || '').trim().toLowerCase()));
  for (const rawType of rawTypes) {
    assert.ok(RAW_STORY_TYPE_MAP[rawType], `tipo cru sem mapeamento: ${rawType}`);
  }
});

test('os arquivos de categoria do Códice existem no disco após o build', () => {
  const outDir = path.resolve(process.cwd(), 'json', 'codex');
  for (const categoria of CODEX_CATEGORIES) {
    const filePath = path.join(outDir, CODEX_CATEGORY_FILES[categoria]);
    assert.ok(fs.existsSync(filePath), `faltou ${CODEX_CATEGORY_FILES[categoria]}`);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(parsed.categoria, categoria);
    assert.equal(parsed.entries.length, parsed.total);
  }
});
