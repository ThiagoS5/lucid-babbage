import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTurnPrompt,
  sanitizeMemoryContext,
  MAX_PROMPT_MEMORY_LENGTH,
} from './promptBuilder.ts';

const baseParams = {
  character: { name: 'Feiticeiro Teste' },
  world: {
    location: 'Tóquio - Shibuya',
    arc: 'Incidente de Shibuya',
    npcsInScene: [{ name: 'Kento Nanami' }],
  },
  actionMode: 'DO',
  actionText: 'Ataco a maldição com golpe crítico.',
  revealedHandVow: false,
  combinedRagContext: '',
  isOpening: false,
  startingArcTitle: 'Incidente de Shibuya',
  customOpeningPrompt: '',
  memoryContext: '',
  recentHistory: '',
};

test('buildTurnPrompt injects default "Início da campanha." when memoryContext is empty', () => {
  const prompt = buildTurnPrompt(baseParams);
  assert.ok(prompt.includes('=== MEMÓRIA CONSOLIDADA DA CAMPANHA ==='));
  assert.ok(prompt.includes('Início da campanha.'));
});

test('buildTurnPrompt injects memoryContext in continuity turn', () => {
  const memoryContext =
    '[Turnos #1 a #10]: Sukuna assumiu o controle momentaneamente e destruiu parte da estação.\n' +
    '[Turnos #11 a #20]: Nanami e Megumi estabeleceram um perímetro tático.';

  const prompt = buildTurnPrompt({
    ...baseParams,
    memoryContext,
  });

  assert.ok(prompt.includes('=== MEMÓRIA CONSOLIDADA DA CAMPANHA ==='));
  assert.ok(prompt.includes('[Turnos #1 a #10]: Sukuna assumiu o controle momentaneamente'));
  assert.ok(prompt.includes('[Turnos #11 a #20]: Nanami e Megumi estabeleceram um perímetro tático.'));
});

test('buildTurnPrompt injects memoryContext in opening turn if non-empty', () => {
  const memoryContext = '[Campanha Anterior]: Vitória sobre a maldição de Grau Especial.';
  const prompt = buildTurnPrompt({
    ...baseParams,
    isOpening: true,
    memoryContext,
  });

  assert.ok(prompt.includes('=== MEMÓRIA CONSOLIDADA DA CAMPANHA ==='));
  assert.ok(prompt.includes('[Campanha Anterior]: Vitória sobre a maldição de Grau Especial.'));
});

test('buildTurnPrompt omits memory block in opening turn when memoryContext is empty', () => {
  const prompt = buildTurnPrompt({
    ...baseParams,
    isOpening: true,
    memoryContext: '',
  });

  assert.ok(!prompt.includes('=== MEMÓRIA CONSOLIDADA DA CAMPANHA ==='));
});

test('sanitizeMemoryContext caps string exceeding MAX_PROMPT_MEMORY_LENGTH with notice', () => {
  const giantMemory = 'M'.repeat(12000);
  const sanitized = sanitizeMemoryContext(giantMemory);

  assert.ok(sanitized.length <= MAX_PROMPT_MEMORY_LENGTH + 50);
  assert.ok(sanitized.endsWith('... [truncado por limite de contexto]'));
  assert.equal(sanitized.slice(0, 100), 'M'.repeat(100));
});

test('memoryContext survives and accumulates cleanly across turn sequence', () => {
  const turn1Memory = '[Turnos #1 a #5]: O grupo infiltrou-se no subsolo de Shibuya.';
  const turn2Memory = `${turn1Memory}\n[Turnos #6 a #10]: Confronto direto com Dagon.`;

  const promptTurn1 = buildTurnPrompt({ ...baseParams, memoryContext: turn1Memory });
  const promptTurn2 = buildTurnPrompt({ ...baseParams, memoryContext: turn2Memory });

  assert.ok(promptTurn1.includes('O grupo infiltrou-se no subsolo de Shibuya.'));
  assert.ok(!promptTurn1.includes('Confronto direto com Dagon.'));

  assert.ok(promptTurn2.includes('O grupo infiltrou-se no subsolo de Shibuya.'));
  assert.ok(promptTurn2.includes('Confronto direto com Dagon.'));
});
