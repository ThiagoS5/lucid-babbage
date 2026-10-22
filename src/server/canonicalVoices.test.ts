import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderCanonicalVoices,
  renderVoiceGuideContent,
} from './canonicalVoices.ts';

test('renderCanonicalVoices devolve bloco vazio quando nenhum NPC e canonico', () => {
  assert.equal(renderCanonicalVoices([]), '');
  assert.equal(renderCanonicalVoices(['Feiticeiro Desconhecido', '']), '');
});

test('renderCanonicalVoices monta o bloco VOZES CANÔNICAS com os NPCs casados', () => {
  const block = renderCanonicalVoices(['Satoru Gojo', 'Feiticeiro Desconhecido']);
  assert.ok(block.includes('VOZES CANÔNICAS'));
  assert.ok(block.includes('Satoru Gojo'));
  assert.ok(block.includes('Dicção'));
  assert.ok(block.includes('NUNCA'));
});

test('renderCanonicalVoices deduplica o mesmo canonico listado duas vezes', () => {
  const block = renderCanonicalVoices(['Gojo', 'Satoru Gojo']);
  const occurrences = block.split('Satoru Gojo').length - 1;
  assert.equal(occurrences, 1);
});

test('renderVoiceGuideContent inclui tiques, bordas anti-OOC e falas de referencia', () => {
  const content = renderVoiceGuideContent({
    id: 'test',
    name: 'Personagem Teste',
    aliases: [],
    diction: 'Fala seca e curta.',
    verbalTics: ['Tique um.'],
    register: 'Registro formal.',
    underPressure: 'Fica calmo.',
    humor: 'Ironia seca.',
    neverSays: ['Nunca x'],
    sampleLines: ['"Fala de referencia."'],
    sceneBehavior: 'Observa antes de agir.',
  });
  assert.ok(content.includes('Personagem Teste'));
  assert.ok(content.includes('Fala seca e curta.'));
  assert.ok(content.includes('Tique um.'));
  assert.ok(content.includes('Nunca x'));
  assert.ok(content.includes('"Fala de referencia."'));
  assert.ok(content.includes('Observa antes de agir.'));
});
