import test from 'node:test';
import assert from 'node:assert/strict';
import { streamNarrativeTurn, type TurnRequestPayload } from '@/features/narrative/lib/geminiService';

const payload: TurnRequestPayload = {
  model: 'gemini-3.8-flash',
  character: {} as TurnRequestPayload['character'],
  world: {
    location: 'Tóquio',
    arc: 'Teste',
    activeBarrierOrDomain: 'Nenhum',
    npcsInScene: [],
  },
  actionMode: 'DO',
  actionText: 'Avanço.',
  revealedHandVow: false,
  ragContext: '',
  activeCards: [],
  memoryContext: '',
  recentHistory: '',
  isOpening: false,
};

function sseResponse(event: string, data: unknown, keepOpen = true): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: 'Olá' })}\n\n`)
      );
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      );
      // Não fecha de propósito: reproduce o caso em que o servidor terminou
      // de enviar o evento terminal, mas o reader não recebe EOF.
      if (!keepOpen) controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

test('streamNarrativeTurn resolve no evento done mesmo sem EOF', { timeout: 3000 }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    sseResponse('done', {
      ok: true,
      apiKeyState: 'VALID',
      usedModel: 'gemini-test',
      data: {
        narrative: 'Olá',
        engineLog: '',
        activeStoryCards: [],
        visualEffectTrigger: 'NONE',
        imagePrompt: '',
        playerStateUpdate: { physicalCondition: 'Intacto' },
        worldStateUpdate: {
          location: 'Tóquio',
          arc: 'Teste',
          activeBarrierOrDomain: 'Nenhum',
          npcsInScene: [],
        },
        suggestedActions: [],
      },
    })) as typeof fetch;

  try {
    const started = Date.now();
    const result = await streamNarrativeTurn(payload, () => {});
    const elapsed = Date.now() - started;
    assert.equal(result.ok, true);
    assert.equal(result.data?.narrative, 'Olá');
    assert.ok(elapsed < 1000, `stream deveria resolver imediatamente, levou ${elapsed}ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('streamNarrativeTurn resolve no evento error mesmo sem EOF', { timeout: 3000 }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    sseResponse('error', { reason: 'MODEL_FAILED', message: 'Falhou' })) as typeof fetch;

  try {
    const result = await streamNarrativeTurn(payload, () => {});
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'MODEL_FAILED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
