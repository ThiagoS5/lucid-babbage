import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  inferEraByStructure,
  inferStoryCardEra,
  isStoryCardAllowedForEra,
} from './storyCardEra.ts';
import { compileCodexMarkdown } from './codexCompiler.ts';

const CODEX_MD = path.resolve(process.cwd(), 'Codex.md');

test('era estrutural: eventos canônicos são bloqueados em campanha de seguimento', () => {
  const canon = inferEraByStructure({ title: 'O Incidente de Shibuya (Shibuya Jihen)', tag: 'Evento' });
  assert.equal(canon, 'canon');
  assert.equal(
    isStoryCardAllowedForEra({ title: 'O Incidente de Shibuya', era: canon }, 'sequel'),
    false
  );
  assert.equal(
    isStoryCardAllowedForEra({ title: 'O Incidente de Shibuya', era: canon }, 'canon'),
    true
  );
});

test('era estrutural: personagens com biografia que cita evento NÃO são canônicos', () => {
  // O bug original: a prosa de Yorozu cita o Jogo do Abate, então ela era
  // bloqueada em campanha de seguimento — e some do RAG.
  const yorozu = inferEraByStructure({
    title: 'Yorozu (Jujutsu Sorcerer)',
    type: 'character',
    keys: ['yorozu'],
  });
  assert.equal(yorozu, 'both');
  assert.equal(
    isStoryCardAllowedForEra(
      {
        title: 'Yorozu (Jujutsu Sorcerer)',
        value: 'Participou do Jogo do Abate e sobreviveu ao Incidente de Shibuya.',
        era: yorozu,
      },
      'sequel'
    ),
    true
  );
});

test('era estrutural: local "Shinjuku" não é classificado como sequel', () => {
  const era = inferEraByStructure({ title: 'Shinjuku', type: 'location', keys: ['shinjuku'] });
  assert.equal(era, 'both');
});

test('era estrutural: locals de Shibuya continuam disponíveis no cânone', () => {
  for (const title of ['Shibuya Station', 'Shibuya C Tower', 'Shinjuku']) {
    const era = inferEraByStructure({ title, type: 'location', keys: [title.toLowerCase()] });
    assert.equal(era, 'both', `${title} não deveria ser 'canon' nem 'sequel'`);
  }
});

test('era estrutural: evento do acervo 284 é canônico', () => {
  const era = inferEraByStructure({ title: 'Shibuya Incident', type: 'event', keys: ['shibuya'] });
  assert.equal(era, 'canon');
});

test('inferStoryCardEra preserva o fallback textual para cards importados', () => {
  const era = inferStoryCardEra({
    title: 'Card do usuário',
    value: 'O texto cita o Incidente de Shibuya.',
  });
  assert.equal(era, 'canon');
});

test('nenhum verbete do Codex.md é bloqueado em campanha de seguimento, exceto eventos', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  const canon = entries.filter((e) => e.era === 'canon');
  assert.equal(canon.length, 3, `esperados 3 eventos canônicos, obtidos ${canon.length}`);
  for (const entry of canon) {
    assert.match(entry.title, /Evento de Intercâmbio|Desfile Noturno|Incidente de Shibuya/);
  }
  // Personagens do Códice (ex.: Megumi, Panda, Maki) não podem sumir no sequel.
  for (const title of ['Megumi Fushiguro', 'Panda', 'Maki Zenin', 'Yorozu']) {
    const entry = entries.find((e) => e.title.startsWith(title));
    assert.ok(entry, `verbete ${title} não encontrado`);
    assert.equal(entry.era, 'both', `${title} não pode ser 'canon'`);
  }
});
