import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpenAiCompatProvider,
  buildJsonModeAddendum,
} from './openAiCompatProvider.ts';

const cfg = {
  id: 'nvidia-nim',
  label: 'NVIDIA NIM',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  apiKey: 'test-key',
  model: 'meta/llama-3.3-70b-instruct',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('completeTurn monta chat/completions com Bearer, response_format e addendum de JSON', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedInit = init;
    return jsonResponse({ choices: [{ message: { content: '{"narrative":"ok"}' } }] });
  }) as typeof fetch;
  try {
    const provider = createOpenAiCompatProvider(cfg);
    const text = await provider.completeTurn({
      systemInstruction: 'SYS',
      prompt: 'PROMPT',
      jsonSchema: { type: 'object', required: ['narrative'] },
      temperature: 0.75,
    });
    assert.equal(text, '{"narrative":"ok"}');
    assert.equal(capturedUrl, 'https://integrate.api.nvidia.com/v1/chat/completions');
    const headers = new Headers(capturedInit?.headers);
    assert.equal(headers.get('Authorization'), 'Bearer test-key');
    const body = JSON.parse(String(capturedInit?.body));
    assert.equal(body.model, 'meta/llama-3.3-70b-instruct');
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.messages[0].role, 'system');
    assert.ok(body.messages[0].content.includes('FORMATO DE RESPOSTA'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('completeTurn re-tenta sem response_format quando o provedor responde 400', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return jsonResponse({ error: 'response_format unsupported' }, 400);
    return jsonResponse({ choices: [{ message: { content: '{"ok":true}' } }] });
  }) as typeof fetch;
  try {
    const provider = createOpenAiCompatProvider(cfg);
    const text = await provider.completeTurn({
      systemInstruction: 'S', prompt: 'P', jsonSchema: {}, temperature: 0.7,
    });
    assert.equal(calls, 2);
    assert.equal(text, '{"ok":true}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('streamTurn acumula deltas SSE e devolve o JSON completo', async () => {
  const originalFetch = globalThis.fetch;
  const chunks = [
    'data: {"choices":[{"delta":{"content":"{\\"narr"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"ative\\":\\"fim\\"}"}}]}\n\n',
    'data: [DONE]\n\n',
  ];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  globalThis.fetch = (async () =>
    new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })) as typeof fetch;
  try {
    const provider = createOpenAiCompatProvider(cfg);
    const deltas: string[] = [];
    const full = await provider.streamTurn(
      { systemInstruction: 'S', prompt: 'P', jsonSchema: {}, temperature: 0.7 },
      (d) => deltas.push(d)
    );
    assert.equal(full, '{"narrative":"fim"}');
    assert.equal(deltas.join(''), full);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buildJsonModeAddendum lista os campos obrigatórios do schema', () => {
  const text = buildJsonModeAddendum({ type: 'object', required: ['narrative', 'imagePrompt'] });
  assert.ok(text.includes('narrative, imagePrompt'));
});
