import test from 'node:test';
import assert from 'node:assert/strict';
import { findVoiceGuideForNpc } from '@/shared/lib/characterVoiceResolver';

test('findVoiceGuideForNpc casa nome completo, alias curto e sem acento', () => {
  assert.equal(findVoiceGuideForNpc('Satoru Gojo')?.name, 'Satoru Gojo');
  assert.equal(findVoiceGuideForNpc('gojo')?.name, 'Satoru Gojo');
  assert.equal(findVoiceGuideForNpc('Ryomen Sukuna')?.name, 'Ryomen Sukuna');
  assert.equal(findVoiceGuideForNpc('Hiromi Higuruma')?.name, 'Hiromi Higuruma');
});

test('findVoiceGuideForNpc prefere o match mais longo em nome ambiguo', () => {
  // Corpo do Kenjaku usa o nome de Geto: ambos casam; o alias mais longo vence.
  assert.equal(findVoiceGuideForNpc('Suguru Geto (Kenjaku)')?.name, 'Suguru Geto');
});

test('findVoiceGuideForNpc devolve undefined para NPC original ou vazio', () => {
  assert.equal(findVoiceGuideForNpc('Feiticeiro Desconhecido'), undefined);
  assert.equal(findVoiceGuideForNpc(''), undefined);
});
