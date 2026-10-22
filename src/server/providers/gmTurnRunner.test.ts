import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGmTurnJson,
  runExternalTurn,
} from './gmTurnRunner.ts';
import type { GmCompletionRequest, GmProvider } from './types.ts';

const req: GmCompletionRequest = {
  systemInstruction: 'SYS',
  prompt: 'PROMPT',
  jsonSchema: { type: 'object', required: ['narrative'] },
  temperature: 0.75,
};

function fakeProvider(overrides: Partial<GmProvider> = {}): GmProvider {
  return {
    id: 'fake',
    label: 'Fake',
    model: 'fake-model',
    async completeTurn() {
      return '{"narrative":"ok"}';
    },
    async streamTurn(_r, onChunk) {
      onChunk('{"narrative":"ok"}');
      return '{"narrative":"ok"}';
    },
    async validate() {
      return { ok: true, message: 'ok' };
    },
    ...overrides,
  };
}

test('parseGmTurnJson extrai o objeto do texto do provedor', () => {
  const parsed = parseGmTurnJson('```json\n{"narrative":"ok"}\n```') as { narrative: string };
  assert.equal(parsed.narrative, 'ok');
});

test('parseGmTurnJson lanca quando a resposta nao tem narrative', () => {
  assert.throws(() => parseGmTurnJson('{"sem":"narrative"}'));
  assert.throws(() => parseGmTurnJson('texto sem json'));
});

test('runExternalTurn entrega o turno parseado do provedor externo', async () => {
  const provider = fakeProvider();
  const result = await runExternalTurn(provider, req);
  assert.equal(result.ok, true);
  assert.equal((result.data as { narrative: string }).narrative, 'ok');
  assert.equal(result.usedModel, 'fake-model');
  assert.equal(result.providerId, 'fake');
});

test('runExternalTurn propaga o erro do provedor sem mascarar', async () => {
  const provider = fakeProvider({
    async completeTurn() {
      throw new Error('HTTP 401 (NVIDIA NIM): invalid api key');
    },
  });
  await assert.rejects(() => runExternalTurn(provider, req), /401/);
});

test('runExternalTurn em streaming envia os deltas e devolve o turno completo', async () => {
  const provider = fakeProvider();
  const deltas: string[] = [];
  const result = await runExternalTurn(
    provider,
    req,
    (delta) => deltas.push(delta)
  );
  assert.equal(result.ok, true);
  assert.equal(deltas.join(''), '{"narrative":"ok"}');
  assert.equal((result.data as { narrative: string }).narrative, 'ok');
});
