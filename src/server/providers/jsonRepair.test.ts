import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonObject } from './jsonRepair.ts';

test('extractJsonObject faz parse de JSON limpo', () => {
  assert.deepEqual(extractJsonObject('{"narrative":"ok"}'), { narrative: 'ok' });
});

test('extractJsonObject remove cerca de markdown e prosa ao redor', () => {
  assert.equal(
    (extractJsonObject('Aqui vai:\n```json\n{"a":1}\n```\nFim.') as { a: number }).a,
    1
  );
  assert.equal((extractJsonObject('Resposta: {"b":2} obrigado') as { b: number }).b, 2);
});

test('extractJsonObject lança quando não há JSON recuperável', () => {
  assert.throws(() => extractJsonObject('sem json aqui'));
  assert.throws(() => extractJsonObject(''));
});
