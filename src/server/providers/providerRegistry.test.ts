import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveProvider,
  listProviders,
  classifyProviderError,
  normalizeBaseUrl,
} from './providerRegistry.ts';

test('resolveProvider cria adaptador NIM; chave da UI vence a do ambiente', () => {
  const p = resolveProvider(
    { id: 'nvidia-nim', model: 'meta/llama-3.3-70b-instruct', apiKey: 'ui-key' },
    { nvidiaNimApiKey: 'env-key' }
  );
  assert.ok(p);
  assert.equal(p.id, 'nvidia-nim');
  assert.equal(p.model, 'meta/llama-3.3-70b-instruct');
  assert.equal(p.label, 'NVIDIA NIM');
});

test('resolveProvider retorna null sem chave, sem baseUrl no custom e para spec ausente/gemini', () => {
  assert.equal(resolveProvider({ id: 'nvidia-nim', model: 'x' }, {}), null);
  assert.equal(resolveProvider({ id: 'custom-openai', model: 'm', apiKey: 'k' }, {}), null);
  assert.equal(resolveProvider(undefined, {}), null);
  assert.equal(resolveProvider({ id: 'gemini', model: 'g' }, {}), null);
});

test('resolveProvider custom-openai usa baseUrl da UI ou do ambiente', () => {
  const p1 = resolveProvider(
    { id: 'custom-openai', model: 'llama3', apiKey: 'k', baseUrl: 'http://localhost:11434/v1' },
    {}
  );
  assert.ok(p1);
  const p2 = resolveProvider(
    { id: 'custom-openai', model: 'llama3' },
    { customBaseUrl: 'http://localhost:1234/v1', customApiKey: 'k' }
  );
  assert.ok(p2);
});

test('listProviders informa configuracao a partir do ambiente', () => {
  const list = listProviders({}, false);
  assert.equal(list.length, 4);
  assert.equal(list[0].id, 'gemini');
  assert.equal(list[0].configured, false);
  const list2 = listProviders({ openRouterApiKey: 'k' }, true);
  assert.equal(list2[0].configured, true);
  assert.equal(list2.find((p) => p.id === 'openrouter')?.configured, true);
});

test('classifyProviderError mapeia 429, 401 e erro generico', () => {
  assert.equal(classifyProviderError('HTTP 429: rate limit').state, 'QUOTA_EXCEEDED');
  assert.equal(classifyProviderError('401 unauthorized').state, 'INVALID');
  assert.equal(classifyProviderError('boom').state, 'INVALID');
});

test('normalizeBaseUrl aceita apenas http/https sem credenciais', () => {
  assert.equal(normalizeBaseUrl('https://api.exemplo.com/v1'), 'https://api.exemplo.com/v1');
  assert.equal(normalizeBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  assert.equal(normalizeBaseUrl('file:///etc/passwd'), null);
  assert.equal(normalizeBaseUrl('http://user:pass@api.exemplo.com/v1'), null);
  assert.equal(normalizeBaseUrl('nao-e-url'), null);
  assert.equal(normalizeBaseUrl(''), null);
});

test('resolveProvider rejeita baseUrl insegura do provedor custom', () => {
  assert.equal(
    resolveProvider(
      { id: 'custom-openai', model: 'm', apiKey: 'k', baseUrl: 'file:///etc/passwd' },
      {}
    ),
    null
  );
});
