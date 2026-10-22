# Plano: Mestre de RPG multiprovedor (NVIDIA NIM + OpenRouter + custom) + Bíblia de Vozes JJK

Data: 2026-10-21 · Repo: `C:\Users\Thiago\Documents\antigravity\lucid-babbage` · Branch: `main`

## Goal

Permitir que a narração do Mestre rode em qualquer provedor OpenAI-compatível (NVIDIA NIM cloud, OpenRouter e endpoint customizado), além do Gemini atual, e tornar a interpretação de cada personagem canônico única e fiel via uma Bíblia de Vozes injetada no prompt com memória de cena ampliada.

## Current context / assumptions

**Decisões confirmadas pelo usuário (clarify):**
- "openCode" = **OpenRouter** (openrouter.ai, modelos `:free` e pagos)
- "Nvidia Vim" = **NVIDIA NIM cloud** (`integrate.api.nvidia.com` — build.nvidia.com)
- "IA's customizadas" = qualquer endpoint **OpenAI-compatível** com baseUrl próprio

**Estado atual (evidência file:line):**
- Toda a IA passa pelo Express: `server.ts` tem `/api/gemini/turn` (L1470), `/turn/stream` (L1886), `/validate` (L1014), `/technique` (L1108), `/session-zero` (L1279), `/memory` (L2014), `/image` (L2068). Só usa `@google/genai` (`getGeminiClient` L659).
- O prompt do turno é montado em `buildTurnPrompt` (`server.ts:397-482`) + contrato do arco `renderArcContract` (L347-386); instrução de sistema = `SYSTEM_INSTRUCTION_GM` (L730-858); schema de resposta = `JJK_RESPONSE_JSON_SCHEMA` (L501-657). Streaming extrai narrativa incremental com `extractNarrativeFromJson` (L495-499).
- Cliente: `src/services/geminiService.ts` — `TurnRequestPayload` (L80-96), `executeNarrativeTurn` (L102), `streamNarrativeTurn` (L149), `validateGeminiConnection` (L37). UI de modelo: `src/components/SettingsPage.tsx` L150-166 (`MODEL_OPTIONS` L44-49). Estado no `src/App.tsx` L239 (`model`).
- Histórico recente enviado: últimos 8 turnos (`App.tsx:654` `campaign.turns.slice(-8)`).
- RAG: `buildServerSideDeepRag` (L178-302) usa embeddings Gemini para re-ranking; cai em keyword puro se falhar. **Continua Gemini-only para embeddings** (keyword-only quando não houver chave Gemini) — narrar via NIM/OpenRouter não muda o RAG.
- Baseline de validação: `npm run test` → **6 pass / 0 fail**; `npm run lint` (tsc) → **0 erros**; `npm run build` → ✓. Regenerado em out/2026; máquina só tem npm (bun não instalado).
- Chaves alternativas do usuário entram pela UI e são enviadas como `x-custom-api-key` (padrão existente, L1016/L1488) — nunca persistidas no servidor.

**Assunções:**
- Provedores OpenAI-compatíveis não têm `responseSchema` nativo confiável → modo JSON via `response_format: {type:'json_object'}` + schema resumido embutido no system message + reparo de JSON tolerante; retry sem `response_format` em HTTP 400.
- Geração de **imagens permanece Gemini-only** (NIM/OpenRouter não geram imagem Nano Banana) — UI informa isso.
- Os endpoints `/technique`, `/session-zero`, `/memory` e `/image` continuam Gemini (fora do escopo; já têm fallback próprio).

## Architecture

Uma camada de provedores no servidor (`src/server/providers/`): um adaptador único OpenAI-compatível (global `fetch`, zero deps novas) cobre NIM, OpenRouter e custom; um registry resolve `ProviderSpec` (id+model+apiKey+baseUrl) em instância configurada (chave da UI vence, env como fallback). Os endpoints `/turn`, `/turn/stream` e `/validate` tentam primeiro o provedor externo escolhido e, se ele falhar, caem na cadeia Gemini existente e, por fim, no Motor de Continuidade local — comportamento atual preservado como fallback. Em paralelo, uma Bíblia de Vozes (`src/data/characterVoices.ts`, ~18 personagens canônicos com dicção, tiques, humor, "nunca diria" e falas de referência) é resolvida por NPC em cena (`characterVoiceResolver`) e injetada pelo `promptBuilder` (extraído de `server.ts` como módulo testável) num bloco `VOZES CANÔNICAS`, com duas novas seções obrigatórias na instrução do Mestre (fidelidade de voz + anti-amnésia de cena) e histórico ampliado de 8→12 turnos.

---

## Task 0 — Baseline: commit do estado pendente + verificação

```bash
cd /c/Users/Thiago/Documents/antigravity/lucid-babbage
git add -A && git commit -m "chore: baseline antes do multiprovedor (limpeza 2026-10-21 incluída)"
npm run test
```

Esperado: `ℹ tests 6 … ℹ pass 6 / fail 0`. (Se houver worktree sujo do usuário, este commit isola o histórico; sem ele os commits por task ficam misturados.)

---

## Task 1 — `jsonRepair`: extração tolerante de JSON (TDD)

**Arquivo novo** `src/server/providers/jsonRepair.ts`:

```ts
/**
 * Extração tolerante de JSON de respostas de LLM: provedores OpenAI-compatíveis
 * às vezes cercam o JSON com markdown ou prosa, mesmo em modo JSON.
 */
export function extractJsonObject(raw: string): unknown {
  const text = (raw || '').trim();
  if (!text) throw new Error('Resposta vazia do provedor.');

  try {
    return JSON.parse(text);
  } catch {
    // segue para as estratégias de recuperação
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // segue
    }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // segue
    }
  }

  throw new Error('O provedor não devolveu um JSON válido.');
}
```

**Teste novo** `src/server/providers/jsonRepair.test.ts`:

```ts
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
```

**Atualizar** `package.json` script test (acrescentar o arquivo):

```json
    "test": "tsx --test src/utils/jjkEngine.test.ts src/services/geminiService.stream.test.ts src/server/providers/jsonRepair.test.ts"
```

Ciclo: (1) crie o teste, rode `npm run test` → falha com `ERR_MODULE_NOT_FOUND` em `./jsonRepair.ts`; (2) crie a implementação; (3) rode `npm run test` → **esperado: tests 9, pass 9, fail 0**; (4) `npm run lint` → 0 erros; (5) commit:

```bash
git add -A && git commit -m "feat(providers): extracao tolerante de JSON de respostas LLM"
```

---

## Task 2 — Adaptador OpenAI-compatível (NIM/OpenRouter/custom) (TDD)

**Arquivo novo** `src/types/provider.ts` (compartilhado cliente+servidor):

```ts
export type ProviderId = 'gemini' | 'nvidia-nim' | 'openrouter' | 'custom-openai';

export interface ProviderSpec {
  id: ProviderId;
  /** Modelo específico do provedor (ex.: 'meta/llama-3.3-70b-instruct'). */
  model: string;
  /** Chave opcional informada pela UI — nunca persistida no servidor. */
  apiKey?: string;
  /** Base URL — obrigatória só para 'custom-openai' (ex.: http://localhost:11434/v1). */
  baseUrl?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: string[];
}
```

**Arquivo novo** `src/server/providers/types.ts`:

```ts
export interface GmCompletionRequest {
  systemInstruction: string;
  prompt: string;
  /** Schema estruturado do turno (o adaptador decide como aplicá-lo). */
  jsonSchema: Record<string, unknown>;
  temperature: number;
}

export interface GmProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  /** Turno completo (não-streaming). Retorna o JSON bruto como texto. */
  completeTurn(req: GmCompletionRequest): Promise<string>;
  /** Turno em streaming. onChunk recebe trechos do JSON bruto; resolve com o texto completo. */
  streamTurn(req: GmCompletionRequest, onChunk: (delta: string) => void): Promise<string>;
  /** Ping de validação de chave/conexão. */
  validate(): Promise<{ ok: boolean; message: string }>;
}
```

**Arquivo novo** `src/server/providers/openAiCompatProvider.ts`:

```ts
import type { GmCompletionRequest, GmProvider } from './types.ts';
import { extractJsonObject } from './jsonRepair.ts';

export interface OpenAiCompatConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

/** Instrução de modo JSON embutida no system message (provedores sem schema nativo). */
export function buildJsonModeAddendum(jsonSchema: Record<string, unknown>): string {
  const required = Array.isArray(jsonSchema.required)
    ? (jsonSchema.required as string[]).join(', ')
    : '';
  return [
    '',
    '=== FORMATO DE RESPOSTA (OBRIGATÓRIO) ===',
    'Responda EXCLUSIVAMENTE com um único objeto JSON válido. Nada de markdown, nada de texto fora do JSON.',
    `Campos obrigatórios: ${required || 'narrative'}.`,
    'Dentro de "narrative", cada bloco segue o formato *Nome do Personagem*: "Fala", separado por linha em branco.',
    '',
  ].join('\n');
}

async function postChatCompletions(
  cfg: OpenAiCompatConfig,
  req: GmCompletionRequest,
  stream: boolean,
  useResponseFormat: boolean
): Promise<Response> {
  const systemContent = req.systemInstruction + buildJsonModeAddendum(req.jsonSchema);
  return fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      ...(cfg.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: req.prompt },
      ],
      temperature: req.temperature,
      stream,
      ...(useResponseFormat ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
}

export function createOpenAiCompatProvider(cfg: OpenAiCompatConfig): GmProvider {
  async function request(req: GmCompletionRequest, stream: boolean): Promise<Response> {
    let res = await postChatCompletions(cfg, req, stream, true);
    if (res.status === 400) {
      // Alguns provedores rejeitam response_format — tenta de novo sem o campo.
      res = await postChatCompletions(cfg, req, stream, false);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} (${cfg.label}): ${body.slice(0, 180)}`);
    }
    return res;
  }

  return {
    id: cfg.id,
    label: cfg.label,
    model: cfg.model,

    async completeTurn(req) {
      const res = await request(req, false);
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content || '';
      if (!text.trim()) throw new Error(`Resposta vazia de ${cfg.label}.`);
      extractJsonObject(text); // valida aqui para o erro subir antes do cliente
      return text;
    },

    async streamTurn(req, onChunk) {
      const res = await request(req, true);
      if (!res.body) throw new Error(`Sem corpo de streaming de ${cfg.label}.`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = '';
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = sseBuf.indexOf('\n')) !== -1) {
          const line = sseBuf.slice(0, idx).trim();
          sseBuf = sseBuf.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const delta = (
              JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
            ).choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              onChunk(delta);
            }
          } catch {
            // chunk SSE parcial/não-JSON: ignora
          }
        }
      }
      if (!full.trim()) throw new Error(`Stream vazio de ${cfg.label}.`);
      return full;
    },

    async validate() {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
          ...(cfg.extraHeaders || {}),
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'user', content: 'Responda apenas: OK' }],
          max_tokens: 8,
        }),
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status} em ${cfg.label} (${cfg.model}).` };
      return { ok: true, message: `Conexão ativa com ${cfg.label} (${cfg.model}).` };
    },
  };
}
```

**Teste novo** `src/server/providers/openAiCompatProvider.test.ts` (mocka `globalThis.fetch` — fronteira de rede, não o módulo):

```ts
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
```

**Atualizar** `package.json` test script (acrescentar):

```json
    "test": "tsx --test src/utils/jjkEngine.test.ts src/services/geminiService.stream.test.ts src/server/providers/jsonRepair.test.ts src/server/providers/openAiCompatProvider.test.ts"
```

Ciclo: teste primeiro → `npm run test` falha (`ERR_MODULE_NOT_FOUND`) → implementar → **esperado: tests 13, pass 13** (3 jsonRepair + 4 openAiCompat + 6 baseline) → `npm run lint` 0 erros → commit `feat(providers): adaptador OpenAI-compativel com streaming SSE e retry de response_format`.

---

## Task 3 — Registry de provedores + tipos de request (TDD)

**Arquivo novo** `src/server/providers/providerRegistry.ts`:

```ts
import type { ProviderInfo, ProviderSpec } from '../../types/provider.ts';
import type { GmProvider } from './types.ts';
import { createOpenAiCompatProvider } from './openAiCompatProvider.ts';

export interface ProviderEnv {
  geminiApiKey?: string;
  nvidiaNimApiKey?: string;
  openRouterApiKey?: string;
  customBaseUrl?: string;
  customApiKey?: string;
}

type NonGeminiId = 'nvidia-nim' | 'openrouter' | 'custom-openai';

export const PROVIDER_PRESETS: Record<
  NonGeminiId,
  {
    label: string;
    baseUrl?: string;
    defaultModel: string;
    models: string[];
    extraHeaders?: Record<string, string>;
  }
> = {
  'nvidia-nim': {
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: [
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'deepseek-ai/deepseek-r1',
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-chat-v3.1:free',
      'google/gemini-2.0-flash-exp:free',
    ],
    extraHeaders: { 'X-Title': 'JJK Cursed Chronicles' },
  },
  'custom-openai': {
    label: 'Personalizado (OpenAI-compatível)',
    defaultModel: '',
    models: [],
  },
};

/** Chave efetiva: a da UI vence; sem ela, a do ambiente. */
function effectiveKey(spec: ProviderSpec, env: ProviderEnv): string {
  const uiKey = (spec.apiKey || '').trim();
  if (uiKey) return uiKey;
  const envKey =
    spec.id === 'nvidia-nim'
      ? env.nvidiaNimApiKey
      : spec.id === 'openrouter'
      ? env.openRouterApiKey
      : env.customApiKey;
  return (envKey || '').trim();
}

/** Resolve o ProviderSpec da UI em um adaptador pronto; null quando não configurado. */
export function resolveProvider(
  spec: ProviderSpec | undefined,
  env: ProviderEnv
): GmProvider | null {
  if (!spec || spec.id === 'gemini') return null;
  const preset = PROVIDER_PRESETS[spec.id as NonGeminiId];
  if (!preset) return null;
  const apiKey = effectiveKey(spec, env);
  if (!apiKey) return null;
  const baseUrl =
    (spec.baseUrl || '').trim() ||
    (preset.baseUrl || (env.customBaseUrl || '').trim());
  if (!baseUrl) return null;
  const model = (spec.model || '').trim() || preset.defaultModel;
  if (!model) return null;
  return createOpenAiCompatProvider({
    id: spec.id,
    label: preset.label,
    baseUrl,
    apiKey,
    model,
    extraHeaders: preset.extraHeaders,
  });
}

export function listProviders(env: ProviderEnv, geminiConfigured: boolean): ProviderInfo[] {
  return [
    {
      id: 'gemini',
      label: 'Google Gemini',
      configured: geminiConfigured,
      defaultModel: 'gemini-3.8-flash',
      models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-4-argon'],
    },
    {
      id: 'nvidia-nim',
      label: PROVIDER_PRESETS['nvidia-nim'].label,
      configured: Boolean((env.nvidiaNimApiKey || '').trim()),
      defaultModel: PROVIDER_PRESETS['nvidia-nim'].defaultModel,
      models: PROVIDER_PRESETS['nvidia-nim'].models,
    },
    {
      id: 'openrouter',
      label: PROVIDER_PRESETS['openrouter'].label,
      configured: Boolean((env.openRouterApiKey || '').trim()),
      defaultModel: PROVIDER_PRESETS['openrouter'].defaultModel,
      models: PROVIDER_PRESETS['openrouter'].models,
    },
    {
      id: 'custom-openai',
      label: PROVIDER_PRESETS['custom-openai'].label,
      configured: Boolean((env.customBaseUrl || '').trim() && (env.customApiKey || '').trim()),
      defaultModel: '',
      models: [],
    },
  ];
}

export function classifyProviderError(rawMsg: string): {
  state: 'INVALID' | 'QUOTA_EXCEEDED' | 'MISSING';
  userMessage: string;
} {
  const lower = (rawMsg || '').toLowerCase();
  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted')
  ) {
    return {
      state: 'QUOTA_EXCEEDED',
      userMessage:
        'Limite de requisições do provedor de IA atingido. O Motor Narrativo de Continuidade JJK assumiu o turno automaticamente.',
    };
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key')
  ) {
    return {
      state: 'INVALID',
      userMessage:
        'A chave do provedor de IA é inválida ou não autorizada. O Motor Narrativo de Continuidade JJK assumiu o turno.',
    };
  }
  return {
    state: 'INVALID',
    userMessage:
      'O provedor de IA não respondeu corretamente. O Motor Narrativo de Continuidade JJK assumiu o turno.',
  };
}
```

**Teste novo** `src/server/providers/providerRegistry.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveProvider,
  listProviders,
  classifyProviderError,
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
  assert.equal(list2.find((p) => p.id === 'openrouter').configured, true);
});

test('classifyProviderError mapeia 429, 401 e erro generico', () => {
  assert.equal(classifyProviderError('HTTP 429: rate limit').state, 'QUOTA_EXCEEDED');
  assert.equal(classifyProviderError('401 unauthorized').state, 'INVALID');
  assert.equal(classifyProviderError('boom').state, 'INVALID');
});
```

**Atualizar** `package.json` test script (acrescentar):

```json
    "test": "tsx --test src/utils/jjkEngine.test.ts src/services/geminiService.stream.test.ts src/server/providers/jsonRepair.test.ts src/server/providers/openAiCompatProvider.test.ts src/server/providers/providerRegistry.test.ts"
```

Ciclo: teste falha → implementar → **esperado: tests 18, pass 18** → lint 0 erros → commit `feat(providers): registry com presets NIM/OpenRouter/custom e classificacao de erros`.

## Task 4 — Extrair `src/server/promptBuilder.ts` de `server.ts` (movimento literal, verificado)

Por que: as Tasks 6–7 editam o prompt e precisam de testes; `buildTurnPrompt`/`SYSTEM_INSTRUCTION_GM` hoje são locais de `server.ts` (não importáveis). Extração programática com asserções — nunca copy-paste manual.

**Script** `scripts/extract-prompt-builder.py` (rodar uma única vez com `python`):

```py
import io
import pathlib

ROOT = pathlib.Path(r'C:\Users\Thiago\Documents\antigravity\lucid-babbage')
SERVER = ROOT / 'server.ts'
DEST = ROOT / 'src' / 'server' / 'promptBuilder.ts'

src = io.open(SERVER, encoding='utf-8').read()

def cut(text, start_marker, end_marker):
    assert text.count(start_marker) == 1, f'marcador ausente/duplicado: {start_marker!r}'
    s = text.index(start_marker)
    e = text.index(end_marker, s)
    return text[:s] + text[e:], text[s:e]

# Ordem importa: cortar de trás pra frente nao e necessario porque usamos index() por marcador.
src, block_c = cut(src, 'const SYSTEM_INSTRUCTION_GM = `', 'async function startServer(')
src, block_b = cut(src, 'const JJK_RESPONSE_JSON_SCHEMA = {', 'function getGeminiClient(')
src, block_a = cut(src, 'interface TurnPromptParams {', 'const JJK_RESPONSE_JSON_SCHEMA = {')

def exportify(block, markers):
    for m in markers:
        assert block.count(m) == 1, f'marcador ausente/duplicado no bloco: {m!r}'
        block = block.replace(m, 'export ' + m, 1)
    return block

block_a = exportify(block_a, [
    'interface TurnPromptParams {',
    'interface ArcContractWorld {',
    'function withoutKeys',
    'function renderArcContract',
    'function firstSceneLine',
    'function buildTurnPrompt',
    'function unescapeJsonString',
    'function extractNarrativeFromJson',
])
block_b = exportify(block_b, ['const JJK_RESPONSE_JSON_SCHEMA'])
block_c = exportify(block_c, ['const SYSTEM_INSTRUCTION_GM'])

header = (
    '/**\n'
    ' * Construcao de prompts e parse da resposta do Mestre — extraido de server.ts\n'
    ' * para ser testavel isoladamente.\n'
    ' */\n\n'
)

DEST.parent.mkdir(parents=True, exist_ok=True)
io.open(DEST, 'w', encoding='utf-8', newline='\n').write(
    header + block_a.rstrip() + '\n\n' + block_b.rstrip() + '\n\n' + block_c.rstrip() + '\n'
)

IMPORT = (
    "import {\n"
    "  SYSTEM_INSTRUCTION_GM,\n"
    "  JJK_RESPONSE_JSON_SCHEMA,\n"
    "  buildTurnPrompt,\n"
    "  extractNarrativeFromJson,\n"
    "  firstSceneLine,\n"
    "  type ArcContractWorld,\n"
    "} from './src/server/promptBuilder';\n"
)
ANCHOR = "} from './src/utils/storyCardEra';\n"
assert src.count(ANCHOR) == 1
src = src.replace(ANCHOR, ANCHOR + IMPORT, 1)
io.open(SERVER, 'w', encoding='utf-8', newline='\n').write(src)
print('OK: promptBuilder.ts criado; server.ts agora importa de src/server/promptBuilder.')
```

**Notas sobre o que fica onde** (verificado contra server.ts):
- Move junto (uso interno do que moveu): `withoutKeys`, `renderArcContract`, `TurnPromptParams`.
- **Fica em `server.ts` usando o import**: `firstSceneLine` (usado por `buildDynamicFallback`, server.ts:1716) e `ArcContractWorld` (cast em server.ts:1520).
- Nada mais em server.ts referencia os símbolos movidos — provado pelo `npm run lint` abaixo.

**Verificação (comando exato + saída esperada):**

```bash
python scripts/extract-prompt-builder.py
# Esperado: OK: promptBuilder.ts criado; server.ts agora importa de src/server/promptBuilder.
npm run lint
# Esperado: sai limpo (nenhum erro tsc) — prova que nenhum caller ficou órfão
npm run test
# Esperado: tests 18, pass 18, fail 0 — comportamento inalterado
python - <<'PY'
import pathlib, subprocess
old = subprocess.run(['git','show','HEAD:server.ts'], capture_output=True, text=True, encoding='utf-8').stdout
new = pathlib.Path('src/server/promptBuilder.ts').read_text(encoding='utf-8')
for marker in ['function withoutKeys', 'function renderArcContract', 'function firstSceneLine',
               'function buildTurnPrompt', 'function unescapeJsonString', 'function extractNarrativeFromJson']:
    a = old.index(marker); b = new.index(marker)
    body_old = old[a:old.index('\n}', a)]
    body_new = new[b:new.index('\n}', b)]
    print(f'{marker}: literal={body_old == body_new}')
PY
# Esperado: literal=True nas 6 linhas (prova do movimento byte-a-byte)
git add -A && git commit -m "refactor(server): extrai promptBuilder testavel de server.ts (movimento literal)"
```

---

## Task 5 — Bíblia de Vozes JJK + resolver de NPC (TDD)

O coração do pedido #2: cada personagem canônico com retrato de dicção intransferível. Todos os campos em PT-BR — o Mestre consome exatamente este texto.

**Arquivo novo** `src/data/characterVoices.ts`:

```ts
export interface CharacterVoiceGuide {
  id: string;
  /** Nome canônico completo — casado contra NpcInScene.name pelo resolver. */
  name: string;
  /** Variantes/apelidos curados para matching (nunca sobrenome de clã sozinho). */
  aliases: string[];
  /** Ritmo, vocabulário e sintaxe — a assinatura da fala (2-4 frases). */
  diction: string;
  /** Bordões e tiques verbais próprios (variar, não repetir literal). */
  verbalTics: string[];
  /** Como trata aliados, inimigos, estudantes e superiores. */
  register?: string;
  /** Psicologia quando ferido, encurralado ou vencendo. */
  underPressure?: string;
  /** Assinatura de humor (ironia ≠ sarcasmo ≠ deboche — cada um com o seu). */
  humor?: string;
  /** Fronteira anti-OOC: o que este personagem NUNCA diria. */
  neverSays: string[];
  /** Falas de referência em PT-BR — reproduzir o TOM, nunca o texto literal. */
  sampleLines: string[];
  /** Comportamento canônico em cena (1-2 frases). */
  sceneBehavior?: string;
}

export const CHARACTER_VOICE_GUIDES: CharacterVoiceGuide[] = [
  {
    id: 'gojo',
    name: 'Satoru Gojo',
    aliases: ['Gojo'],
    diction:
      'Casual provocador com confiança absoluta; frases curtas, deboche direto com figurões e apelidos carinhosos com alunos. Fala da própria força como fato banal, nunca como vanglória.',
    verbalTics: [
      '"Não se preocupe — eu sou o mais forte."',
      'Chamar alunos pelo primeiro nome com tom de cúmplice',
      'Comentar doces e viagens em momentos absurdos',
    ],
    register:
      'Íntimo e brincalhão com estudantes; zomqueteiro e desrespeitoso com superiores e conservadores; nunca formal.',
    underPressure:
      'Quanto maior a ameaça, mais relaxado fica: sussurra em vez de gritar, sorri antes do golpe decisivo.',
    humor: 'Ironia leve que desarma; piadas na hora errada de propósito.',
    neverSays: ['Jargão militar ou burocrático', 'Dúvida sobre a própria força ("acho que consigo")'],
    sampleLines: [
      '"Yuuji! Não morre aí, hein — senão quem vai me divertir?"',
      '"Ora, ora... parece que chegamos bem na hora da festa."',
    ],
    sceneBehavior:
      'Só interfere quando o aluno está prestes a morrer de verdade; até lá, observa divertido e provoca.',
  },
  {
    id: 'sukuna',
    name: 'Ryomen Sukuna',
    aliases: ['Sukuna', 'Rei das Maldições'],
    diction:
      'Arcaísmos de erudito da Era Heian com desprezo imperial; declarações curtas e cirúrgicas, sem exclamações. Trata humanos como insetos e o mundo como entretenimento.',
    verbalTics: ['"Patético."', '"Interessante..." (raro, só para dignos)', 'Chamar adversários de "verme", "brinquedo"'],
    underPressure: 'Nunca demonstra pressa; dor o diverte. Ferido de verdade, o tom baixa e fica milimétrico.',
    humor: 'Sarcasmo de quem viu mil anos e nada o impressiona.',
    neverSays: ['Gírias modernas', 'Medo, súplica ou respeito a um inferior', '"Nós" — fala apenas de si'],
    sampleLines: [
      '"Dance para mim, feiticeiro. Você ainda não vale nem um dos meus dedos."',
      '"Vocês fazem barulho sobre migalhas de poder e chamam isso de era."',
    ],
  },
  {
    id: 'itadori',
    name: 'Yuji Itadori',
    aliases: ['Itadori', 'Yuji'],
    diction:
      'Energético e direto, gíria leve de adolescente; empenho genuíno em proteger; autodepreciação mesmo ferido.',
    verbalTics: [
      '"Vou dar a essas pessoas uma morte adequada." (apenas em momento solene)',
      'Conversa de colega, nomes sem cerimônia',
      'Comentar fome ou o corpo emprestado nos piores momentos',
    ],
    underPressure: 'Fica mais focado e menos piadista; assume culpa antes de culpar os outros.',
    humor: 'Besteiras de adolescente para aliviar a tensão.',
    neverSays: ['Crueldade gratuita com civis', 'Desistir explicitamente'],
    sampleLines: [
      '"Ah, é isso? Então eu quebro de novo, e de novo, até sobrar só eu!"',
      '"Peraí — antes da gente morrer, dá pra pedir um onigiri?"',
    ],
  },
  {
    id: 'megumi',
    name: 'Megumi Fushiguro',
    aliases: ['Megumi'],
    diction:
      'Frases econômicas, tom seco e utilitário; protege por dever, não por discurso heroico. Silêncio é desaprovação.',
    verbalTics: ['"Não."', '"Deixa comigo."', 'Chamar tolice de tolice sem rodeio'],
    underPressure: 'Frio: calcula saídas e sacrifícios antes de abrir a boca.',
    humor: 'Seco e involuntário; quase nunca sorri de piada.',
    neverSays: ['Discursos heroicos longos', 'Empolgação adolescente'],
    sampleLines: ['"Eu não sou herói. Só faço o que precisa ser feito."', '"Se você hesitar, eu vou na frente."'],
  },
  {
    id: 'nobara',
    name: 'Nobara Kugisaki',
    aliases: ['Nobara', 'Kugisaki'],
    diction:
      'Brava, espalhafatosa e vaidosa; provoca antes de ser provocada; orgulho do interior (Tōhoku) sempre em riste.',
    verbalTics: ['"É claro que eu ganho — eu sou linda E forte."', 'Deboche do "cheiro de interior"', 'Moda e compras como âncora de sanidade'],
    underPressure: 'Fica mais alta, nunca mais baixa; grosseria como couraça.',
    humor: 'Zombaria frontal e competitiva.',
    neverSays: ['Docilidade submissa', 'Insegurança explícita sobre a própria força'],
    sampleLines: [
      '"Ah, veio um? Ótimo — tava precisando descontar em alguém."',
      '"O interior continua igual: feio e sem shopping decente."',
    ],
  },
  {
    id: 'nanami',
    name: 'Kento Nanami',
    aliases: ['Nanami'],
    diction:
      'Formalidade de assalariado; frases medidas com pausas, precisão quase contábil e cansaço existencial educado.',
    verbalTics: ['"Ser feiticeiro é um trabalho ruim."', 'Metáforas de expediente, hora extra e folga', 'Decisões rituais com pão ("Kino...")'],
    underPressure: 'Silêncio operacional; ordens curtas; nunca histeria.',
    humor: 'Ironia seca sobre a burocracia do jujutsu.',
    neverSays: ['Gírias juvenis', 'Otimismo vazio'],
    sampleLines: ['"Vou trabalhar. Alguém tem que fazer, e hoje é meu turno."', '"Hora extra, então. Os chefões nunca avisam."'],
  },
  {
    id: 'maki',
    name: 'Maki Zenin',
    aliases: ['Maki'],
    diction:
      'Seca e sem cerimônia; ressentimento Zenin afiado como a lâmina; despreza quem fala e não faz.',
    verbalTics: ['Frases curtas e grossas', 'Desdém imediato com fanfarrões', 'Nunca pede desculpa por ser direta'],
    underPressure: 'Mais quieta e mais rápida; dor é ruído de fundo.',
    neverSays: ['Autopiedade', 'Súplica'],
    sampleLines: ['"Sai do meu caminho ou eu te abro um."', '"Clã? Pra mim é só um sobrenome a apagar."'],
  },
  {
    id: 'toji',
    name: 'Toji Fushiguro',
    aliases: ['Toji'],
    diction:
      'Tranquilidade de mercenário; humor preguiçoso de quem não deve nada a ninguém; desprezo absoluto por clãs e Energia Amaldiçoada.',
    verbalTics: ['Chamar contrato de "serviço"', 'Provocação seca: "Você fala demais."', 'Doçura deslocada com o filho'],
    neverSays: ['Reverência a clãs ou tradição', 'Arrogância mística'],
    sampleLines: ['"Gente de energia confia demais no talento."', '"Serviço aceito. Pagamento adiantado."'],
  },
  {
    id: 'geto',
    name: 'Suguru Geto',
    aliases: ['Geto'],
    diction:
      'Suave e didático, quase gentil — o que torna o desprezo mais cortante; vocabulário de sermão com paciência infinita.',
    verbalTics: ['"São só macacos com roupas bonitas."', 'Tratar massacre como triagem necessária', 'Elegância calma até o fim'],
    underPressure: 'Mais calmo ainda; a voz desce quando o plano se aproxima.',
    humor: 'Sorriso condescendente, nunca gargalhada.',
    neverSays: ['Grito, grosseria ou pressa', 'Ódio descontrolado — ele "reconhece"'],
    sampleLines: ['"Eu não os odeio. Apenas reconheço o que são."', '"O mundo seria mais leve sem essa multidão de macacos."'],
  },
  {
    id: 'kenjaku',
    name: 'Kenjaku',
    aliases: ['Kenjaku'],
    diction:
      'Erudito milenar, prolixo e cortês; trata tudo como experimento; o prazer intelectual transparece em cada frase.',
    verbalTics: ['"Que interessante... observa-se um padrão."', 'Referências a eras mortas e séculos de preparo', 'Cortesia com o próprio inimigo'],
    underPressure: 'Curiosidade no lugar de susto; recalcula em voz alta.',
    neverSays: ['Fúria descontrolada', 'Desprezo simples — ele tem curiosidade'],
    sampleLines: ['"Séculos de preparo para esta única conversa. Agradeça."', '"Medo é só dado. E eu coleciono dados."'],
  },
  {
    id: 'mahito',
    name: 'Mahito',
    aliases: ['Mahito'],
    diction:
      'Curiosidade infantil com sadismo; fala como criança descobrindo brinquedos; metáforas de costura e de alma.',
    verbalTics: ['"Almas são tão divertidas de mexer!"', 'Risadas no meio da frase', 'Tratar atrocidade como brincadeira'],
    underPressure: 'Fica mais animado; a própria dor o intriga.',
    humor: 'Deboche infantil, sem maldade "adulta" — o que o torna pior.',
    neverSays: ['Solene burocrático', 'Planos sérios contínuos sem deboche'],
    sampleLines: ['"Sua alma tem um rasgo aqui... quer ver por dentro?"', '"Não me odeie! Eu só estou brincando."'],
  },
  {
    id: 'choso',
    name: 'Choso',
    aliases: ['Choso'],
    diction:
      'Formal e comedido; contabiliza parentescos e dívidas com precisão de contador; caloroso com laços de sangue, glacial com inimigos.',
    verbalTics: ['"Pelo sangue, eu..."', 'Frases em tom de juramento', 'Nomear cada irmão perdido'],
    neverSays: ['Leviandade', 'Esquecer um vínculo de sangue'],
    sampleLines: ['"Meus irmãos morreram. Eu não esqueço um só nome."'],
  },
  {
    id: 'yuta',
    name: 'Yuta Okkotsu',
    aliases: ['Yuta', 'Okkotsu'],
    diction:
      'Educado demais, autodepreciação constante, pede desculpa até para o inimigo; quando Rika ou um amigo está em risco, a voz muda para aço.',
    verbalTics: ['"Desculpa... mas eu não posso perder mais ninguém."', 'Gaguejar educado fora de combate'],
    underPressure: 'Frases curtam, voz desce — assustadoramente calmo.',
    neverSays: ['Arrogância', 'Provocação'],
    sampleLines: ['"Eu... eu vou te salvar. Mesmo que você me odeie por isso."'],
  },
  {
    id: 'hakari',
    name: 'Kinji Hakari',
    aliases: ['Hakari'],
    diction:
      'Hype de apostador; gírias de pachinko e energia altíssima quando o pote está quente; desleixado e arrastado fora do jogo.',
    verbalTics: ['"A casa paga, bebê!"', 'Metáforas de jackpot, giro e bônus'],
    underPressure: 'Quanto mais apertado, mais eufórico.',
    neverSays: ['Risco sem aposta', 'Tom melancólico prolongado'],
    sampleLines: ['"Estranho... o azar nunca vence quem tem coragem."'],
  },
  {
    id: 'higuruma',
    name: 'Hiromi Higuruma',
    aliases: ['Higuruma'],
    diction:
      'Advogado caído; jargão processual e retórica de tribunal; dignidade amarga com autojulgamento constante.',
    verbalTics: ['"Ordem na sala."', '"Confisco." / "Pena de morte." como veredito', 'Citar leis e precedentes de cor'],
    underPressure: 'Metódico: expõe o crime do alvo antes de sentenciar.',
    neverSays: ['Improviso caótico', 'Humor leve'],
    sampleLines: ['"Este tribunal reconhece a sua culpa. A sentença é a espada."'],
  },
  {
    id: 'todo',
    name: 'Aoi Todo',
    aliases: ['Todo'],
    diction:
      'Intensidade absurda; discursos filosóficos sobre idols entre golpes; troca de assunto bipolar; chama os escolhidos de "meu irmão".',
    verbalTics: ['"Meu irmão! Deixa eu te perguntar: que tipo de mulher você gosta?"', 'Referências à Takada-chan'],
    underPressure: 'Filosofia no lugar de pânico.',
    neverSays: ['Modéstia', 'Frases curtas sem paixão'],
    sampleLines: ['"Um homem que hesita no ringue hesita na vida, meu irmão!"'],
  },
  {
    id: 'utahime',
    name: 'Utahime Iori',
    aliases: ['Utahime'],
    diction: 'Irritável e tradicionalista; resmungo constante contra o Gojo; postura de senpai exigindo respeito.',
    verbalTics: ['"Esse Gojo... quem ele pensa que é?!"', 'Ordens de volta à base sem discussão'],
    neverSays: ['Desleixo com alunos sob sua guarda'],
    sampleLines: ['"Vocês dois! Voltem já pra base, sem discussão!"'],
  },
  {
    id: 'ijichi',
    name: 'Kiyotaka Ijichi',
    aliases: ['Ijichi'],
    diction: 'Ansioso e apologético; gerencia desastres com caderno na mão; cobra reconhecimento do próprio trabalho.',
    verbalTics: ['"De-de-desculpem a demora!"', 'Relatórios citados de cor'],
    neverSays: ['Confiança militar'],
    sampleLines: ['"A barreira... a barreira está estável! Eu acho! Quase certa!"'],
  },
];
```

**Arquivo novo** `src/utils/characterVoiceResolver.ts`:

```ts
import { CHARACTER_VOICE_GUIDES, type CharacterVoiceGuide } from '../data/characterVoices.ts';

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Encontra o guia de voz de um NPC canônico. Compara nome completo e aliases
 * (sem acento, caixa baixa); o match mais longo vence. NPC original devolve
 * undefined — a voz é construída pelo Mestre e mantida.
 */
export function findVoiceGuideForNpc(npcName: string): CharacterVoiceGuide | undefined {
  const target = normalizeName(npcName || '');
  if (!target) return undefined;
  let best: { guide: CharacterVoiceGuide; score: number } | undefined;
  for (const guide of CHARACTER_VOICE_GUIDES) {
    const candidates = [guide.name, ...guide.aliases].map(normalizeName).filter(Boolean);
    for (const candidate of candidates) {
      const matches =
        candidate === target || target.includes(candidate) || candidate.includes(target);
      if (matches && (!best || candidate.length > best.score)) {
        best = { guide, score: candidate.length };
      }
    }
  }
  return best?.guide;
}
```

**Teste novo** `src/utils/characterVoiceResolver.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { findVoiceGuideForNpc } from './characterVoiceResolver.ts';

test('findVoiceGuideForNpc casa nome completo, alias curto e sem acento', () => {
  assert.equal(findVoiceGuideForNpc('Satoru Gojo')?.name, 'Satoru Gojo');
  assert.equal(findVoiceGuideForNpc('gojo')?.name, 'Satoru Gojo');
  assert.equal(findVoiceGuideForNpc('Ryomen Sukuna')?.name, 'Ryomen Sukuna');
  assert.equal(findVoiceGuideForNpc('Hiromi Higuruma')?.name, 'Hiromi Higuruma');
});

test('findVoiceGuideForNpc prefere o match mais longo em nome ambíguo', () => {
  // Corpo do Kenjaku usa o nome de Geto: ambos casam; o alias mais longo vence.
  assert.equal(findVoiceGuideForNpc('Suguru Geto (Kenjaku)')?.name, 'Suguru Geto');
});

test('findVoiceGuideForNpc devolve undefined para NPC original ou vazio', () => {
  assert.equal(findVoiceGuideForNpc('Feiticeiro Desconhecido'), undefined);
  assert.equal(findVoiceGuideForNpc(''), undefined);
});
```

**Atualizar** `package.json` test script (acrescentar):

```json
    "test": "tsx --test src/utils/jjkEngine.test.ts src/services/geminiService.stream.test.ts src/server/providers/jsonRepair.test.ts src/server/providers/openAiCompatProvider.test.ts src/server/providers/providerRegistry.test.ts src/utils/characterVoiceResolver.test.ts"
```

Ciclo: teste falha (`ERR_MODULE_NOT_FOUND`) → criar dados + resolver → **esperado: tests 21, pass 21** → lint 0 erros → commit `feat(voice): biblia de vozes canonicas JJK + resolver de NPC`.

<!-- PART3 -->

---

# Registro de execução (2026-10-21)

> Bloco adicionado após a execução. Registra o que foi de fato implementado,
> os defeitos encontrados **neste plano** e onde eles foram corrigidos.
> Um plano que embarca código quebrado é defeito do plano, não do executor.

## Escopo executado

- **Tasks 0–5**: executadas literalmente como especificadas (ciclo RED → GREEN → lint → commit).
- **Part 3 (Tasks 6+)**: **não existia no arquivo**. Reconstruída a partir das seções
  *Architecture* e *Current context* deste mesmo plano, que descrevem a cadeia
  (provedor externo → Gemini → Motor de Continuidade), o bloco `VOZES CANÔNICAS`,
  as duas seções novas na instrução do Mestre e o histórico 8→12 turnos.
  Entregue como: `src/server/canonicalVoices.ts`, integração em `server.ts`
  (`/turn`, `/turn/stream`, `/validate`), UI de provedor em `SettingsPage.tsx`,
  `provider` no `TurnRequestPayload`, e `slice(-12)` em `src/App.tsx`.

## Defeitos deste plano (corrigidos no repo)

1. **Task 4 — ordem de corte do script de extração quebrava a execução.**
   O script cortava C → B → A. Cada bloco termina exatamente onde o próximo começa,
   então cortar o bloco B **apaga o marcador final do bloco A** e o `index()` estoura
   com `ValueError: substring not found`. Correção: extrair em ordem de documento
   (A → B → C) em `scripts/extract-prompt-builder.py`. O movimento continua
   byte-a-byte literal (verificado: 6/6 funções com `literal=True`).

2. **Task 3 — o teste embutido não passa no `tsc --noEmit`.**
   `list2.find((p) => p.id === 'openrouter').configured` gera `TS2532`
   (`Object is possibly 'undefined'`). Correção: `?.configured` no teste.

3. **Superfície de SSRF não prevista no plano (Task 3).**
   A `baseUrl` do provedor customizado vem do cliente e vira destino de `fetch`
   **no servidor**. O plano aceitava qualquer string. Correção: `normalizeBaseUrl()`
   em `providerRegistry.ts` — só `http:`/`https:`, sem credenciais embutidas,
   com testes próprios e caso de rejeição no `resolveProvider`.

4. **Texto de prompt em português não-nativo (Task 7).**
   As seções novas na instrução do Mestre saíram com caracteres estranhos e palavras
   misturadas ("como，落实", "nem para，情迫", "deequipment", "established").
   Relido e corrigido antes de qualquer commit — vai direto para o system prompt.

## Verificação executada

- `npm run lint` → 0 erros · `npm run test` → **36/36** · `npm run build` → ✓
- **Servidor real** contra mock OpenAI-compatível (`scripts/mock-openai-provider.mjs`):
  - `/turn` → `usedProvider=custom-openai`, `usedModel=llama3-teste`
  - `/turn/stream` → eventos `delta` + `done` com narrativa extraída do JSON bruto
  - `/validate` → `state=VALID` contra o endpoint externo
  - o mock **ecoa flags do prompt recebido**: `vozesCanonicas=true`, guia do Gojo
    presente, `secaoFidelidade=true`, `secaoAntiAmnesia=true`, `formatoJson=true`
- **Branches de fallback exercitados de propósito:**
  - upstream morto → cai no Gemini (`usedProvider=None`), campanha não para
  - `baseUrl=file:///etc/passwd` → rejeitado pelo registry, cai no Gemini
  - sem chave → `resolveProvider` devolve `null`, segue para o Gemini

## Fora de escopo (mantido conforme premissa do plano)

- **Geração de imagens permanece Gemini-only** (Nano Banana). A UI informa isso.
- **Embeddings do RAG permanecem Gemini**, com fallback por keyword.

