import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTurnPrompt, SYSTEM_INSTRUCTION_GM } from './promptBuilder.ts';

const baseParams = {
  character: { name: 'Feiticeiro' },
  world: {
    location: 'Tóquio',
    arc: 'Arco de Teste',
    npcsInScene: [{ name: 'Satoru Gojo' }, { name: 'Feiticeiro Desconhecido' }],
  },
  actionMode: 'DO',
  actionText: 'Avanço',
  revealedHandVow: false,
  combinedRagContext: '',
  isOpening: false,
  startingArcTitle: 'Arco de Teste',
  customOpeningPrompt: '',
  memoryContext: '',
  recentHistory: '',
};

test('buildTurnPrompt injeta o bloco VOZES CANÔNICAS no turno de continuidade', () => {
  const prompt = buildTurnPrompt(baseParams);
  assert.ok(prompt.includes('VOZES CANÔNICAS'));
  assert.ok(prompt.includes('Satoru Gojo'));
  assert.ok(prompt.includes('Dicção'));
});

test('buildTurnPrompt injeta o bloco VOZES CANÔNICAS também na abertura', () => {
  const prompt = buildTurnPrompt({ ...baseParams, isOpening: true });
  assert.ok(prompt.includes('VOZES CANÔNICAS'));
});

test('buildTurnPrompt nao injeta vozes quando nenhum NPC em cena e canonico', () => {
  const prompt = buildTurnPrompt({
    ...baseParams,
    world: { ...baseParams.world, npcsInScene: [{ name: 'Feiticeiro Desconhecido' }] },
  });
  assert.ok(!prompt.includes('VOZES CANÔNICAS'));
});

test('a instrucao do Mestre contem as secoes de fidelidade de voz e anti-amnesia', () => {
  assert.ok(SYSTEM_INSTRUCTION_GM.includes('FIDELIDADE DE VOZ DOS PERSONAGENS'));
  assert.ok(SYSTEM_INSTRUCTION_GM.includes('MEMÓRIA DE CENA (ANTI-AMNÉSIA)'));
});
