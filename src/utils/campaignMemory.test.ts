import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMemoryContext,
  appendMemory,
  getCampaignMemoryContextFromStorage,
  MAX_MEMORY_CONTEXT_LENGTH,
} from './campaignMemory.ts';
import { CAMPAIGN_STORAGE_KEY, migrateCampaignToNarrative, saveCampaignStateSafe } from './storageManager.ts';
import type { CampaignState, CampaignTurn, MemoryEntry } from '../types/jjk.ts';

test('formatMemoryContext returns empty string for empty, null or undefined input', () => {
  assert.equal(formatMemoryContext(undefined), '');
  assert.equal(formatMemoryContext(null), '');
  assert.equal(formatMemoryContext([]), '');
});

test('formatMemoryContext formats memories into bracketed lines', () => {
  const memories: MemoryEntry[] = [
    {
      id: 'mem-1',
      turnRange: 'Turnos #1 a #10',
      summary: 'Derrota da maldição de Grau 2 no centro de Tóquio.',
      timestamp: '2026-10-23T10:00:00Z',
    },
    {
      id: 'mem-2',
      turnRange: 'Turnos #11 a #20',
      summary: 'Megumi Fushiguro convoca Nue para conter invasão.',
      timestamp: '2026-10-23T10:30:00Z',
    },
  ];

  const formatted = formatMemoryContext(memories);
  assert.equal(
    formatted,
    '[Turnos #1 a #10]: Derrota da maldição de Grau 2 no centro de Tóquio.\n[Turnos #11 a #20]: Megumi Fushiguro convoca Nue para conter invasão.'
  );
});

test('formatMemoryContext deduplicates entries with same id or identical turnRange+summary', () => {
  const memories: MemoryEntry[] = [
    {
      id: 'mem-1',
      turnRange: 'Turnos #1 a #10',
      summary: 'Resumo A',
      timestamp: '2026-10-23T10:00:00Z',
    },
    {
      id: 'mem-1',
      turnRange: 'Turnos #1 a #10',
      summary: 'Resumo A duplicado por ID',
      timestamp: '2026-10-23T10:05:00Z',
    },
    {
      id: 'mem-2',
      turnRange: 'Turnos #1 a #10',
      summary: 'Resumo A',
      timestamp: '2026-10-23T10:10:00Z',
    },
    {
      id: 'mem-3',
      turnRange: 'Turnos #11 a #20',
      summary: 'Resumo B',
      timestamp: '2026-10-23T10:15:00Z',
    },
  ];

  const formatted = formatMemoryContext(memories);
  assert.equal(formatted, '[Turnos #1 a #10]: Resumo A\n[Turnos #11 a #20]: Resumo B');
});

test('formatMemoryContext caps memory context at maxCharacters without breaking entries', () => {
  const longSummary = 'A'.repeat(6000);
  const memories: MemoryEntry[] = [
    {
      id: 'mem-old',
      turnRange: 'Turnos #1 a #10',
      summary: longSummary,
      timestamp: '2026-10-23T10:00:00Z',
    },
    {
      id: 'mem-recent',
      turnRange: 'Turnos #11 a #20',
      summary: longSummary,
      timestamp: '2026-10-23T10:30:00Z',
    },
  ];

  const formatted = formatMemoryContext(memories, { maxCharacters: 7000 });
  assert.ok(formatted.length <= 7000);
  // Retains the most recent memory when budget is exceeded
  assert.ok(formatted.includes('Turnos #11 a #20'));
});

test('appendMemory adds new memory with generated id and timestamp immutably', () => {
  const initial: MemoryEntry[] = [
    {
      id: 'mem-1',
      turnRange: 'Turnos #1 a #10',
      summary: 'Resumo 1',
      timestamp: '2026-10-23T10:00:00Z',
    },
  ];

  const updated = appendMemory(initial, {
    turnRange: 'Turnos #11 a #20',
    summary: 'Resumo 2',
  });

  assert.equal(initial.length, 1);
  assert.equal(updated.length, 2);
  assert.equal(updated[1].turnRange, 'Turnos #11 a #20');
  assert.equal(updated[1].summary, 'Resumo 2');
  assert.ok(updated[1].id.startsWith('mem-'));
  assert.ok(updated[1].timestamp.length > 0);
});

test('appendMemory avoids appending identical consecutive duplicate memory', () => {
  const initial: MemoryEntry[] = [
    {
      id: 'mem-1',
      turnRange: 'Turnos #1 a #10',
      summary: 'Resumo idêntico',
      timestamp: '2026-10-23T10:00:00Z',
    },
  ];

  const updated = appendMemory(initial, {
    turnRange: 'Turnos #1 a #10',
    summary: 'Resumo idêntico',
  });

  assert.equal(updated.length, 1);
});

test('getCampaignMemoryContextFromStorage reads CAMPAIGN_STORAGE_KEY and formats memories', () => {
  const mockStorage: Record<string, string> = {
    [CAMPAIGN_STORAGE_KEY]: JSON.stringify({
      id: 'camp-123',
      memories: [
        {
          id: 'mem-1',
          turnRange: 'Turnos #1 a #5',
          summary: 'Invasão em Shibuya repelida.',
          timestamp: '2026-10-23T10:00:00Z',
        },
      ],
    }),
  };

  const fakeStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = val;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {},
    key: () => null,
    length: Object.keys(mockStorage).length,
  } as unknown as Storage;

  const context = getCampaignMemoryContextFromStorage(fakeStorage);
  assert.equal(context, '[Turnos #1 a #5]: Invasão em Shibuya repelida.');
});

test('getCampaignMemoryContextFromStorage handles missing or corrupted storage safely', () => {
  const corruptedStorage = {
    getItem: () => 'invalid-json{{{',
  } as unknown as Storage;
  assert.equal(getCampaignMemoryContextFromStorage(corruptedStorage), '');

  const emptyStorage = {
    getItem: () => null,
  } as unknown as Storage;
  assert.equal(getCampaignMemoryContextFromStorage(emptyStorage), '');
});

test('migrateCampaignToNarrative guarantees memories array is initialized', () => {
  const rawCampaignWithoutMemories = {
    id: 'legacy-1',
    createdAt: '2026-10-20',
    updatedAt: '2026-10-20',
    character: { name: 'Gojo' },
    world: { location: 'Tóquio', npcsInScene: [] },
    turns: [],
  };

  const migrated = migrateCampaignToNarrative(rawCampaignWithoutMemories);
  assert.ok(migrated);
  assert.ok(Array.isArray(migrated.memories));
  assert.equal(migrated.memories.length, 0);
});

test('saveCampaignStateSafe preserves memories even under storage pressure fallback', () => {
  const dummyMemories: MemoryEntry[] = [
    {
      id: 'mem-persisted',
      turnRange: 'Turnos #1 a #10',
      summary: 'Memória crucial nunca deve ser perdida.',
      timestamp: '2026-10-23T12:00:00Z',
    },
  ];

  const campaign: CampaignState = {
    id: 'camp-test',
    createdAt: '2026-10-23',
    updatedAt: '2026-10-23',
    character: { name: 'Megumi' } as unknown as CampaignState['character'],
    world: { location: 'Tóquio', npcsInScene: [] } as unknown as CampaignState['world'],
    turns: (Array.from({ length: 30 }, (_, i) => ({
      id: `turn-${i + 1}`,
      turnNumber: i + 1,
      timestamp: '2026-10-23',
      gmResponse: {
        narrative: `Turno ${i + 1}`,
        engineLog: '',
        activeStoryCards: [],
        visualEffectTrigger: 'NONE',
        imagePrompt: '',
        playerStateUpdate: {},
        worldStateUpdate: {},
        suggestedActions: [],
      },
      sceneImageUrl: 'data:image/png;base64,heavyDataHere...',
      snapshot: {
        character: { name: 'Megumi' },
        world: { location: 'Tóquio', npcsInScene: [] },
      } as unknown as CampaignTurn['snapshot'],
    })) as unknown) as CampaignTurn[],
    memories: dummyMemories,
    customCodex: [],
    npcAvatars: {},
  };

  let savedString = '';
  let attempts = 0;
  const mockLocalStorage = {
    getItem: () => null,
    setItem: (_key: string, value: string) => {
      attempts++;
      if (attempts < 3) {
        throw new Error('QuotaExceededError');
      }
      savedString = value;
    },
  };

  const originalWindow = (globalThis as Record<string, unknown>).window;
  const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;
  (globalThis as Record<string, unknown>).window = { localStorage: mockLocalStorage };
  (globalThis as Record<string, unknown>).localStorage = mockLocalStorage;
  try {
    saveCampaignStateSafe(campaign);
    assert.ok(savedString.length > 0);
    const parsed = JSON.parse(savedString);
    assert.ok(Array.isArray(parsed.memories));
    assert.equal(parsed.memories.length, 1);
    assert.equal(parsed.memories[0].summary, 'Memória crucial nunca deve ser perdida.');
  } finally {
    (globalThis as Record<string, unknown>).window = originalWindow;
    (globalThis as Record<string, unknown>).localStorage = originalLocalStorage;
  }
});
