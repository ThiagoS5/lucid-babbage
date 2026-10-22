import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  inferEraByStructure,
  inferStoryCardEra,
  isStoryCardAllowedForEra,
} from './storyCardEra.ts';

function _unused_loadAllCodexEntries(): Array<{ title: string; era: string }> {
  const all: Array<{ title: string; era: string }> = [];
  for (const file of fs.readdirSync(path.join(process.cwd(), 'json/codex'))) {
    const parsed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'json/codex', file), 'utf-8')) as { entries: Array<{ title: string; era: string }> };
    for (const e of parsed.entries) all.push({ title: e.title, era: e.era });
  }
  return all;
}
void _unused_loadAllCodexEntries;

test('era estrutural: eventos canônicos são bloqueados em campanha de seguimento', () => {
  const canon = inferEraByStructure({ title: 'O Incidente de Shibuya (Shibuya Jihen)', tag: 'Evento' });
  assert.equal(canon, 'canon');
  assert.equal(isStoryCardAllowedForEra({ title: 'O Incidente de Shibuya', era: canon }, 'sequel'), false);
  assert.equal(isStoryCardAllowedForEra({ title: 'O Incidente de Shibuya', era: canon }, 'canon'), true);
});

test('era estrutural: personagens com biografia que cita evento NÃO são canônicos', () => {
  const yorozu = inferEraByStructure({ title: 'Yorozu (Jujutsu Sorcerer)', type: 'character', keys: ['yorozu'] });
  assert.equal(yorozu, 'both');
  assert.equal(
    isStoryCardAllowedForEra({ title: 'Yorozu (Jujutsu Sorcerer)', value: 'Participou do Jogo do Abate e sobreviveu ao Incidente de Shibuya.', era: yorozu }, 'sequel'),
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
  const era = inferStoryCardEra({ title: 'Card do usuário', value: 'O texto cita o Incidente de Shibuya.' });
  assert.equal(era, 'canon');
});

test('nenhum verbete do Códice JSON é bloqueado em campanha de seguimento, exceto eventos', () => {
  const entries: Array<{ title: string; era: string }> = [];
  for (const file of fs.readdirSync(path.join(process.cwd(), 'json/codex'))) {
    const parsed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'json/codex', file), 'utf-8'));
    for (const e of parsed.entries) entries.push({ title: e.title, era: e.era });
  }
  const canon = entries.filter((e) => e.era === 'canon');
  assert.equal(canon.length, 3, `esperados 3 eventos canônicos, obtidos ${canon.length}`);
  for (const entry of canon) {
    assert.match(entry.title, /Evento de Intercâmbio|Desfile Noturno|Incidente de Shibuya/);
  }
  for (const title of ['Megumi Fushiguro', 'Panda', 'Maki Zenin', 'Yorozu']) {
    const entry = entries.find((e) => e.title.startsWith(title));
    assert.ok(entry, `verbete ${title} não encontrado`);
    assert.equal(entry.era, 'both', `${title} não pode ser 'canon'`);
  }
});
