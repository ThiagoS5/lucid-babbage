# Plano — Narrador multi-provedor de IA + Bíblia de Personagens (JJK RPG)

## Goal

Permitir que a narração do Mestre de RPG rode sobre **vários provedores de IA**
(Gemini, OpenRouter, NVIDIA NIM e qualquer endpoint OpenAI‑compatível/customizado)
e, ao mesmo tempo, **expandir o prompt e o contexto do Mestre** com dossiês de
personalidade por personagem canônico (Gojo, Itadori, Sukuna, …), para que cada
interpretação tenha voz, psicologia e repertório únicos e fiel ao cânone.

---

## Current context / assumptions

**Estado atual (verificado no repo, `main` @ `cebf7d6`):**

- Narração 100 % Gemini. O cliente HTTP para o modelo vive **inteiro em `server.ts`
  (2197 linhas)** — não existe abstração de provedor.
  - `server.ts:656` `getGeminiClient()` — resolve a chave (`GEMINI_API_KEY`/`API_KEY` ou
    chave custom via header `x-custom-api-key`) e instancia `GoogleGenAI`.
  - `server.ts:675` `normalizeModelName()` — normaliza/cai para `gemini-3.8-flash`.
  - `server.ts:700` `callGeminiStructured()` — chamada com `responseMimeType:'application/json'`
    + `responseSchema` (a chave `responseMimeType` no objeto `config`).
  - `server.ts:727` `SYSTEM_INSTRUCTION_GM` — prompt do Mestre (9 seções: formatação,
    condução, `engineLog`, escala de Graus, física de EA, fichas técnicas de precisão,
    regras de cenário, âncora do arco, modo "sequel").
  - `server.ts:394` `buildTurnPrompt()` — monta o prompt de turno (abertura vs. continuidade),
    `renderArcContract()` (contrato imutável da campanha) em `server.ts:344`.
  - `server.ts:1467` `POST /api/gemini/turn`, `server.ts:1883` `POST /api/gemini/turn/stream`
    (SSE com eventos `delta`/`done`/`error`), `server.ts:1011` `POST /api/gemini/validate`.
  - `server.ts:1511` `buildDynamicFallback()` — motor local de continuidade quando não há IA.
- O **RAG de lore já é profundo e roda no servidor**: `server.ts:32` `loadServerSideLore()`
  carrega `Codex.md` (**1.098.018 bytes, 271 verbetes `##`** com seções de
  "Psicologia, Filosofia e Forma de Pensar" por personagem) e
  `json/adventure-UhtU4tSbk-kc-story-cards-284.json` (284 cards).
  `server.ts:175` `buildServerSideDeepRag()` seleciona só **top‑4 verbetes + top‑4 cards,
  truncados em ~900 chars** — ou seja, a psicologia profunda dos personagens canônicos
  **hoje quase nunca chega ao prompt**.
- Frontend: `src/services/geminiService.ts` (wrapper HTTP), `src/components/SettingsPage.tsx`
  (chave Gemini + seletor `MODEL_OPTIONS` com 4 modelos Gemini), `src/App.tsx:239`
  estado `model`/`customApiKey`, `src/types/jjk.ts:19` `GeminiModelOption`.
- Testes: `node:test` + `tsx`. `package.json` script `test` lista arquivos explicitamente:
  `tsx --test src/utils/jjkEngine.test.ts src/services/geminiService.stream.test.ts`
  (6 testes, todos passando). `npm run lint` = `tsc --noEmit` (passa).
- Ambiente: Node **v24.21.0**, npm apenas (sem bun). Docker = `node:22-bookworm-slim`.
- `.env` existe localmente (não versionado; `.gitignore` tem `.env*` exceto `.env.example`).
  **A chave Gemini `AQ.Ab8RN6Le7...` está vazada no histórico git (commits `acd955d`, `72a9fff`)** —
  pendência de segurança pré-existente, não bloqueia este trabalho, mas **não deve ser
  replicada em código novo**.

**Decisões tomadas com o usuário (confirmadas):**

1. Provedores: **OpenRouter + NVIDIA NIM (`integrate.api.nvidia.com/v1`) + qualquer
   endpoint OpenAI‑compatível como "IA customizada" (Ollama, LM Studio, vLLM, Groq,
   OpenAI, etc.) — tudo via HTTP**. Gemini continua como provedor padrão/preset.
2. Voz dos personagens: **bíblia de personagem** — dossiê por NPC canônico injetado no
   prompt **quando o NPC está em cena**.

**Premissas (assumidas, ajustar se o usuário preferir):**

- "IA customizada" = endpoint **OpenAI‑compatível** (`/chat/completions`), configurável por
  `baseUrl + model + chave` (UI) ou por variáveis de ambiente.
- **Geração de imagem continua exclusivamente no Gemini** (Nano Banana) — não há equivalente
  nos outros provedores. `technique`, `session-zero` e `memory` passam a ser *provider‑agnostic*
  porque usam o mesmo caminho de chamada de texto.
- A chave do provedor escolhido é enviada pelo browser no header `x-custom-api-key`
  (mesmo mecanismo já usado hoje para o Gemini). Chaves de ambiente **nunca** saem do servidor.
- Sem provider **OpenCode CLI** (subprocesso): fora do escopo desta fase.

---

## Architecture / proposed approach

Três mudanças independentes que se combinam:

1. **Camada de provedor no servidor** (`src/server/ai/*`): uma interface única
   `AiProviderAdapter { generateJson, streamJson, validate }` com quatro implementações —
   `gemini` (SDK `@google/genai`), `openrouter`, `nvidia`, `custom` (as três últimas
   compartilham **um único adaptador OpenAI‑compatível**, parametrizado por preset).
   `server.ts` passa a falar apenas com a abstração; as rotas existentes ganham um campo
   `provider` no body e aliases `/api/ai/*`.
2. **Bíblia de personagens + prompt do Mestre ampliado**: os dossiês curados (voz, tiques,
   bordões, taboos) ficam em `src/server/prompts/characterBible.ts`; o **conteúdo profundo do
   `Codex.md`** vira dossiê ao vivo por personagem (`loreStore`), e ambos são montados por
   `buildCastContext()` e injetados no *system instruction* de cada turno, junto de 3 seções
   novas no prompt do Mestre (performance de personagem, lore avançado, uso de memória/contexto).
3. **Fronteira de código extraída do monólito**: `server.ts` deixa de conter prompt, schema,
   lore e utilidades de JSON; esses vão para `src/server/prompts/*`, `src/server/ai/*` e
   `src/server/lore/*` — o que torna tudo **testável com `node:test`** (hoje `server.ts`
   não é importável em teste porque `startServer()` é executado no import).

> Ordem de execução: (1) e (2) são independentes; (3) é pré-requisito de (1) e (2) e por isso
> vem primeiro (extração **sem mudança de comportamento**, verificada por teste de caracterização).

---

## Fase 0 — Baseline e preparação

### Task 0.1 — Script de teste com glob + baseline

**Arquivos:** `package.json`

1. Trocar o script `test` para glob (o runner do Node resolve o glob; já validado nesta máquina):

```json
"test": "tsx --test \"src/**/*.test.ts\""
```

2. Verificar que o glob roda (bash do Git Bash **não** expande `**`; o próprio Node expande):

```bash
npm test
```

**Saída esperada:** `ℹ pass 6`, `ℹ fail 0` (os 6 testes atuais). Se aparecer `ℹ tests 0`,
o glob não foi resolvido → voltar ao formato explícito de arquivos.

3. `git add package.json && git commit -m "chore(test): usa glob no script de teste"`

---

## Fase 1 — Extração do monólito `server.ts` (sem mudança de comportamento)

### Task 1.1 — Extrair schema e utilidades de JSON (RED → GREEN)

**Novos arquivos:** `src/server/ai/types.ts`, `src/server/ai/schema.ts`, `src/server/ai/jsonExtract.ts`
**Teste:** `src/server/ai/jsonExtract.test.ts`

**1.1.1 — Escrever o teste que falha** (`src/server/ai/jsonExtract.test.ts`):

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonObject, parseJsonObject } from './jsonExtract.ts';

test('extractJsonObject acha o primeiro objeto JSON dentro de texto com cercas de markdown', () => {
  const raw = 'Aqui está o resultado:\n```json\n{"narrative":"ok","engineLog":"x"}\n```\nFim.';
  assert.equal(extractJsonObject(raw), '{"narrative":"ok","engineLog":"x"}');
});

test('parseJsonObject tolera vírgula final e comentários', () => {
  const raw = '{ "narrative": "ok", // nota do modelo\n "engineLog": "y", }';
  const parsed = parseJsonObject<{ narrative: string; engineLog: string }>(raw);
  assert.ok(parsed);
  assert.equal(parsed.narrative, 'ok');
  assert.equal(parsed.engineLog, 'y');
});

test('parseJsonObject devolve null quando não há JSON', () => {
  assert.equal(parseJsonObject('desculpe, não posso gerar isso'), null);
});
```

**1.1.2 — Rodar e ver falhar:**

```bash
npx tsx --test src/server/ai/jsonExtract.test.ts
```

**Esperado:** `Cannot find module './jsonExtract.ts'` / `ERR_MODULE_NOT_FOUND` → **RED**.

**1.1.3 — Implementar** `src/server/ai/jsonExtract.ts`:

```ts
/** Extrai o valor de um campo "narrative" de um JSON ainda incompleto (para streaming). */
export function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function extractNarrativeFromJson(rawJson: string): string {
  const m = rawJson.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return '';
  return unescapeJsonString(m[1]);
}

/** Remove cercas ```json, prefixos narrativos e devolve o trecho JSON mais externo. */
export function extractJsonObject(raw: string): string | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export function repairJsonCandidate(candidate: string): string {
  return candidate
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1');
}

export function parseJsonObject<T = unknown>(raw: string): T | null {
  const candidate = extractJsonObject(raw);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    try {
      return JSON.parse(repairJsonCandidate(candidate)) as T;
    } catch {
      return null;
    }
  }
}
```

**1.1.4 — Passar para GREEN:**

```bash
npx tsx --test src/server/ai/jsonExtract.test.ts
```

**Esperado:** `ℹ pass 3`, `ℹ fail 0`.

**1.1.5 — Criar `src/server/ai/types.ts`** (contrato da camada de provedor):

```ts
export type ProviderId = 'gemini' | 'openrouter' | 'nvidia' | 'custom';

export interface AiProviderRequest {
  systemInstruction: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature: number;
  model: string;
}

export interface AiProviderHealth {
  ok: boolean;
  state: 'VALID' | 'INVALID' | 'MISSING' | 'QUOTA_EXCEEDED';
  message: string;
  modelTested: string;
  latencyMs: number;
}

export interface AiProviderAdapter {
  id: ProviderId;
  label: string;
  supportsStreaming: boolean;
  generateJson(req: AiProviderRequest, apiKey?: string): Promise<{ text: string; model: string }>;
  streamJson(
    req: AiProviderRequest,
    apiKey?: string
  ): AsyncGenerator<{ delta: string; full: string }>;
  validate(model: string, apiKey?: string): Promise<AiProviderHealth>;
}
```

**1.1.6 — Mover o schema** para `src/server/ai/schema.ts` exportando `JJK_RESPONSE_JSON_SCHEMA`
(cópia literal do objeto hoje em `server.ts:498-654`) e, no `server.ts`, trocar o bloco pelo
`import { JJK_RESPONSE_JSON_SCHEMA } from './src/server/ai/schema';`.

**1.1.7 — Rodar a suíte inteira** (nada pode quebrar):

```bash
npm test && npm run lint
```

**Esperado:** `ℹ pass 6` (+3 novos = `9`), `tsc --noEmit` sem saída.

**1.1.8 — Commit:**

```bash
git add -A && git commit -m "refactor(server): extrai schema JSON e utilitarios de extracao para src/server/ai"
```

---

### Task 1.2 — Extrair o lore store (Codex.md + Story Cards)

**Novos arquivos:** `src/server/lore/loreStore.ts`
**Teste:** `src/server/lore/loreStore.test.ts`

**1.2.1 — Teste (RED)** — o store precisa ser **testável sem subir o servidor** e expor
busca por personagem:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoreStore, type LoreStore } from './loreStore.ts';

const sections = [
  {
    title: '[Personagem] Satoru Gojo (Grau Especial)',
    keys: ['satoru gojo', 'gojo', 'seis olhos'],
    content: '### Psicologia, Filosofia e Forma de Pensar\nGojo é irreverente.',
  },
];

test('findCharacterSection localiza o verbete pelo nome canônico', () => {
  const store: LoreStore = createLoreStore({ storyCards: [], mdSections: sections });
  const found = store.findCharacterSection('Satoru Gojo');
  assert.ok(found);
  assert.ok(found.content.includes('irreverente'));
});

test('findCharacterSection devolve null para personagem desconhecido', () => {
  const store = createLoreStore({ storyCards: [], mdSections: sections });
  assert.equal(store.findCharacterSection('Kurumi Tsubaki'), null);
});

test('matchCharacterNames detecta menções no texto da ação', () => {
  const store = createLoreStore({ storyCards: [], mdSections: sections });
  const names = store.matchCharacterNames('O Gojo observa enquanto Yuji recua');
  assert.ok(names.includes('Satoru Gojo'));
});
```

**1.2.2 — Rodar:** `npx tsx --test src/server/lore/loreStore.test.ts` → **RED** (módulo inexistente).

**1.2.3 — Implementar** `src/server/lore/loreStore.ts`:

```ts
export interface LoreMdSection {
  title: string;
  keys: string[];
  content: string;
}

export interface LoreStoryCard {
  id: string;
  title: string;
  keys: string[];
  type: 'character' | 'technique' | 'domain' | 'tool' | 'location' | 'lore';
  value: string;
  source?: 'codex_md' | 'story_json' | 'initial' | 'custom';
}

export interface LoreStore {
  storyCards: LoreStoryCard[];
  mdSections: LoreMdSection[];
  codexMdCards: LoreStoryCard[];
  findCharacterSection(name: string): LoreMdSection | null;
  matchCharacterNames(text: string): string[];
}

export function normalizeName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai o nome do personagem de um cabeçalho "## [Personagem] Nome (Grau ...)" ou "## [Personagem] Nome". */
function characterNameFromTitle(title: string): string | null {
  const m = title.match(/^\s*#*\s*\[?\s*Personagem\s*\]?\s*[:\-]?\s*(.+)$/i);
  if (!m) return null;
  return m[1].replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Tokens pelos quais um verbete de personagem pode ser citado no texto:
 * nome completo, primeiro+sobrenome e sobrenome isolado.
 * Títulos com "/" ou "-" (ex.: "Toji Fushiguro / Nascido Toji Zenin") ficam
 * sem sobrenome isolado para evitar falso positivo em clãs inteiras.
 */
export function characterNameTokens(title: string): string[] {
  const name = characterNameFromTitle(title) || '';
  const tokens: string[] = [];
  const full = normalizeName(name);
  if (full.length >= 4) tokens.push(full);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const firstTwo = normalizeName(parts.slice(0, 2).join(' '));
    if (firstTwo.length >= 4 && !tokens.includes(firstTwo)) tokens.push(firstTwo);
  }
  if (parts.length <= 3 && !/[\/\u2014\-]/.test(name)) {
    const last = normalizeName(parts[parts.length - 1] || '');
    if (last.length >= 4 && !tokens.includes(last)) tokens.push(last);
  }
  return tokens;
}

export function createLoreStore(input: {
  storyCards: LoreStoryCard[];
  mdSections: LoreMdSection[];
}): LoreStore {
  const characterSections = new Map<string, LoreMdSection>();
  for (const section of input.mdSections) {
    const name = characterNameFromTitle(section.title);
    if (!name) continue;
    const key = normalizeName(name);
    if (!characterSections.has(key)) characterSections.set(key, section);
  }

  return {
    storyCards: input.storyCards,
    mdSections: input.mdSections,
    codexMdCards: [],
    findCharacterSection(name: string) {
      return characterSections.get(normalizeName(name)) ?? null;
    },
    matchCharacterNames(text: string) {
      const haystack = ` ${normalizeName(text)} `;
      const found: string[] = [];
      for (const section of characterSections.values()) {
        const display = characterNameFromTitle(section.title);
        if (!display) continue;
        const tokens = characterNameTokens(section.title);
        if (tokens.some((t) => haystack.includes(` ${t} `))) found.push(display);
      }
      return found;
    },
  };
}
```

> **Nota de implementação:** em `server.ts`, `loadServerSideLore()` passa a popular o store e a
> manter `SERVER_STORY_CARDS` / `SERVER_MD_SECTIONS` **derivados** dele
> (`loreStore.storyCards`, `loreStore.mdSections`), para que `buildServerSideDeepRag()`,
> `/api/codex/default` e `/api/health` continuem idênticos.

**1.2.4 — GREEN + regressão:**

```bash
npx tsx --test src/server/lore/loreStore.test.ts && npm test && npm run lint
```

**Esperado:** `ℹ pass 3` no arquivo novo; suíte completa `ℹ pass 12`; lint limpo.

**1.2.5 — Commit:**

```bash
git add -A && git commit -m "refactor(server): extrai o lore store (Codex.md + Story Cards) para src/server/lore"
```

---

### Task 1.3 — Extrair o prompt do Mestre e o contrato do arco

**Novos arquivos:** `src/server/prompts/turnPrompt.ts`, `src/server/prompts/gmSystemPrompt.ts`
**Teste:** `src/server/prompts/turnPrompt.test.ts`

**1.3.1 — Teste (RED)**:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTurnPrompt, renderArcContract } from './turnPrompt.ts';

const world = {
  location: 'Tóquio',
  arc: 'Arco de Teste',
  activeBarrierOrDomain: 'Nenhum',
  npcsInScene: [],
  era: 'sequel' as const,
  campaignPremise: 'Premissa de teste',
  playerRole: 'Feiticeiro de grau 4',
  missionObjective: 'Investigar a anomalia',
  mustEstablish: ['Criar clima de cerco'],
  forbiddenEvents: ['Ressuscitar Sukuna'],
};

test('o prompt de continuidade inclui o contrato da campanha', () => {
  const prompt = buildTurnPrompt({
    character: { name: 'Teste' },
    world,
    actionMode: 'DO',
    actionText: 'Avanço',
    revealedHandVow: false,
    combinedRagContext: '',
    isOpening: false,
    startingArcTitle: 'Arco de Teste',
    customOpeningPrompt: '',
    memoryContext: '',
    recentHistory: '',
  });
  assert.ok(prompt.includes('CONTRATO DA CAMPANHA'));
  assert.ok(prompt.includes('Ressuscitar Sukuna'));
  assert.ok(prompt.includes('Investigar a anomalia'));
});

test('renderArcContract marca a era sequel como pós-cânone', () => {
  const block = renderArcContract(world, 'Arco de Teste', '', false);
  assert.ok(block.includes('SEGUIMENTO'));
});
```

**1.3.2 — RED:** `npx tsx --test src/server/prompts/turnPrompt.test.ts` → módulo inexistente.

**1.3.3 — Implementar** `src/server/prompts/turnPrompt.ts` movendo **literalmente** (sem
alterar texto) de `server.ts`: `withoutKeys()` (linha 331), `renderArcContract()` (344),
`firstSceneLine()` (386) e `buildTurnPrompt()` (394). O arquivo exporta:

```ts
export interface TurnPromptParams {
  character: unknown;
  world: unknown;
  actionMode: string;
  actionText: string;
  revealedHandVow: boolean;
  combinedRagContext: string;
  isOpening: boolean;
  startingArcTitle: string;
  customOpeningPrompt: string;
  memoryContext: string;
  recentHistory: string;
}
export function renderArcContract(world: unknown, startingArcTitle: string, openingScene: string, isOpening: boolean): string
export function buildTurnPrompt(p: TurnPromptParams): string
export function firstSceneLine(text: string, maxLen?: number): string
```

> ⚠️ **Ao mover, adicionar `export` nas quatro funções.** No `server.ts` original elas são
> funções privadas (`function buildTurnPrompt(...)`, `function renderArcContract(...)`,
> `function firstSceneLine(...)`, `function withoutKeys(...)`). O novo módulo precisa de
> `export` em todas — sem isso o `import` do `server.ts` e o teste falham com
> *"does not provide an export named 'buildTurnPrompt'"*.

```ts
// Em src/server/prompts/turnPrompt.ts — TODAS com `export`:
export function withoutKeys<T extends Record<string, unknown>>(obj: T, keys: string[]): T { ... }
export function renderArcContract(...) { ... }
export function firstSceneLine(...) { ... }
export function buildTurnPrompt(p: TurnPromptParams): string { ... }
```

> A interface `ArcContractWorld` (hoje em `server.ts:315`) também deve ser movida para
> `src/server/prompts/turnPrompt.ts` e exportada, porque `buildDynamicFallback()` no
> `server.ts` continua usando o tipo:
>
> ```ts
> export interface ArcContractWorld {
>   arc?: string;
>   era?: 'sequel' | 'canon';
>   timelineAnchor?: string;
>   missionObjective?: string;
>   campaignPremise?: string;
>   playerRole?: string;
>   tone?: string[];
>   mustEstablish?: string[];
>   worldFacts?: string[];
>   forbiddenEvents?: string[];
>   openingScene?: string;
>   startingArcTitle?: string;
> }
> ```

```ts
```

**1.3.4 — Em `server.ts`**, remover as funções movidas e importar:

```ts
import { buildTurnPrompt, renderArcContract, firstSceneLine } from './src/server/prompts/turnPrompt';
```

> `firstSceneLine` é usado por `buildDynamicFallback` (`server.ts:1713`) — o import precisa
> continuar disponível lá.

**1.3.5 — Mover `SYSTEM_INSTRUCTION_GM`** (`server.ts:727-855`) para
`src/server/prompts/gmSystemPrompt.ts`:

```ts
export const GM_SYSTEM_INSTRUCTION_BASE = `...texto atual, idêntico...`;
```

**1.3.6 — GREEN + regressão:**

```bash
npx tsx --test src/server/prompts/turnPrompt.test.ts && npm test && npm run lint
```

**Esperado:** `ℹ pass 2` no novo; suíte `ℹ pass 14`; lint limpo.

**1.3.7 — Commit:**

```bash
git add -A && git commit -m "refactor(server): extrai prompt do Mestre, contrato do arco e turn prompt"
```

---

## Fase 2 — Camada de provedor multi‑IA

### Task 2.1 — Registro de provedores e resolução de chave

**Novos arquivos:** `src/server/ai/registry.ts`, `src/server/ai/errors.ts`
**Teste:** `src/server/ai/registry.test.ts`

**2.1.1 — Teste (RED)**:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDER_PRESETS,
  getPreset,
  normalizeBaseUrl,
  resolveApiKey,
} from './registry.ts';

test('os quatro provedores estão registrados', () => {
  assert.deepEqual(
    PROVIDER_PRESETS.map((p) => p.id).sort(),
    ['custom', 'gemini', 'nvidia', 'openrouter']
  );
});

test('baseUrl custom inválida (file://) é rejeitada', () => {
  assert.equal(normalizeBaseUrl('file:///etc/passwd'), null);
  assert.equal(normalizeBaseUrl('https://api.exemplo.com/v1'), 'https://api.exemplo.com/v1');
});

test('a chave custom do usuário tem precedência sobre a variável de ambiente', () => {
  const key = resolveApiKey('openrouter', 'sk-user', { OPENROUTER_API_KEY: 'sk-env' });
  assert.equal(key, 'sk-user');
});

test('sem chave custom nem env, resolveApiKey devolve null', () => {
  assert.equal(resolveApiKey('openrouter', '', {}), null);
});
```

**2.1.2 — RED:** `npx tsx --test src/server/ai/registry.test.ts`.

**2.1.3 — Implementar** `src/server/ai/registry.ts`:

```ts
import type { ProviderId } from './types';

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  /** Endpoint base do formato OpenAI-compatível (null para o SDK do Gemini). */
  baseUrl: string | null;
  /** Nomes de variáveis de ambiente com a chave, em ordem de precedência. */
  envKeyNames: string[];
  defaultModel: string;
  suggestedModels: string[];
  /** Se true, a UI exige baseUrl (provedor "customizada"). */
  requiresBaseUrl: boolean;
  docsUrl: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: null,
    envKeyNames: ['GEMINI_API_KEY', 'API_KEY'],
    defaultModel: 'gemini-3.8-flash',
    suggestedModels: [
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-4-argon',
    ],
    requiresBaseUrl: false,
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKeyNames: ['OPENROUTER_API_KEY'],
    defaultModel: 'openai/gpt-4o-mini',
    suggestedModels: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
    ],
    requiresBaseUrl: false,
    docsUrl: 'https://openrouter.ai/docs',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    envKeyNames: ['NVIDIA_API_KEY'],
    defaultModel: 'meta/llama-3.3-70b-instruct',
    suggestedModels: [
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'qwen/qwen3-235b-a22b',
      'deepseek-ai/deepseek-r1',
    ],
    requiresBaseUrl: false,
    docsUrl: 'https://build.nvidia.com/models',
  },
  {
    id: 'custom',
    label: 'IA customizada (OpenAI-compatível)',
    baseUrl: null,
    envKeyNames: ['CUSTOM_AI_API_KEY'],
    defaultModel: '',
    suggestedModels: [],
    requiresBaseUrl: true,
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
  },
];

export function getPreset(id: string | undefined | null): ProviderPreset {
  return (
    PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[0]
  );
}

/** Valida e normaliza a base URL do provedor customizado (anti-SSRF básico). */
export function normalizeBaseUrl(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  return parsed.toString().replace(/\/+$/, '');
}

export function resolveApiKey(
  providerId: ProviderId,
  customKey: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const fromUser = String(customKey || '').trim();
  if (fromUser) return fromUser;
  const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
  for (const name of preset?.envKeyNames ?? []) {
    const value = String(env[name] || '').trim();
    if (value && value !== 'MY_GEMINI_API_KEY') return value;
  }
  return null;
}
```

**2.1.4 — `src/server/ai/errors.ts`** — generaliza `classifyGeminiError` (`server.ts:961`):

```ts
export type ProviderErrorState = 'INVALID' | 'QUOTA_EXCEEDED' | 'MISSING';

export function classifyProviderError(rawMsg: string): {
  state: ProviderErrorState;
  userMessage: string;
} {
  const lower = (rawMsg || '').toLowerCase();
  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return {
      state: 'QUOTA_EXCEEDED',
      userMessage:
        'Limite temporário de requisições do provedor atingido (429). O Motor Narrativo de Continuidade JJK assumiu o turno automaticamente.',
    };
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('invalid_api_key') ||
    lower.includes('api key not valid') ||
    lower.includes('unauthenticated') ||
    lower.includes('permission_denied')
  ) {
    return {
      state: 'INVALID',
      userMessage:
        'A chave do provedor de IA é inválida ou não autorizada. Corrija a chave; enquanto isso, o Motor Narrativo de Continuidade mantém a campanha.',
    };
  }
  return {
    state: 'INVALID',
    userMessage:
      'Não foi possível autenticar no provedor de IA. O Motor Narrativo de Continuidade JJK está ativo.',
  };
}
```

**2.1.5 — GREEN:**

```bash
npx tsx --test src/server/ai/registry.test.ts
```

**Esperado:** `ℹ pass 4`, `ℹ fail 0`.

**2.1.6 — Commit:**

```bash
git add -A && git commit -m "feat(server): registro de provedores de IA (Gemini, OpenRouter, NVIDIA NIM, custom)"
```

---

### Task 2.2 — Adaptador OpenAI‑compatível (cobre OpenRouter, NVIDIA e custom)

**Novo arquivo:** `src/server/ai/openaiCompatible.ts`
**Teste:** `src/server/ai/openaiCompatible.test.ts`

**2.2.1 — Teste (RED)** — `fetch` global é mockado:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiCompatibleAdapter } from './openaiCompatible.ts';

const preset = {
  id: 'openrouter' as const,
  label: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  envKeyNames: ['OPENROUTER_API_KEY'],
  defaultModel: 'openai/gpt-4o-mini',
  suggestedModels: [],
  requiresBaseUrl: false,
  docsUrl: '',
};

function mockFetch(body: unknown, status = 200): { restore: () => void; calls: any[] } {
  const original = globalThis.fetch;
  const calls: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, calls };
}

const req = {
  systemInstruction: 'SYSPROMPT',
  prompt: 'USERPROMPT',
  schema: { type: 'object', properties: { narrative: { type: 'string' } }, required: ['narrative'] },
  temperature: 0.75,
  model: 'openai/gpt-4o-mini',
};

test('generateJson monta a requisição OpenAI-compatível corretamente', async () => {
  const mock = mockFetch({
    choices: [{ message: { content: '{"narrative":"ok"}' } }],
  });
  try {
    const adapter = createOpenAiCompatibleAdapter(preset);
    const out = await adapter.generateJson(req, 'sk-test');
    assert.equal(out.text, '{"narrative":"ok"}');
    assert.equal(mock.calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(mock.calls[0].init.body);
    assert.equal(body.model, 'openai/gpt-4o-mini');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[0].content, 'SYSPROMPT');
    assert.ok(body.messages[1].content.startsWith('USERPROMPT'));
    assert.equal(mock.calls[0].init.headers.Authorization, 'Bearer sk-test');
  } finally {
    mock.restore();
  }
});

test('generateJson propaga erro 401 como erro (não engolido)', async () => {
  const mock = mockFetch({ error: { message: 'Invalid API key' } }, 401);
  try {
    const adapter = createOpenAiCompatibleAdapter(preset);
    await assert.rejects(() => adapter.generateJson(req, 'sk-errado'), /401|Invalid/i);
  } finally {
    mock.restore();
  }
});

test('streamJson emite deltas a partir do SSE OpenAI', async () => {
  const original = globalThis.fetch;
  const sse =
    'data: {"choices":[{"delta":{"content":"{\\"narrative\\":"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"\\"oi\\"}"}}]}\n\n' +
    'data: [DONE]\n\n';
  globalThis.fetch = (async () =>
    new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })) as typeof fetch;
  try {
    const adapter = createOpenAiCompatibleAdapter(preset);
    const deltas: string[] = [];
    for await (const chunk of adapter.streamJson(req, 'sk-test')) deltas.push(chunk.delta);
    assert.equal(deltas.join(''), '{"narrative":"oi"}');
  } finally {
    globalThis.fetch = original;
  }
});
```

**2.2.2 — RED:** `npx tsx --test src/server/ai/openaiCompatible.test.ts` → módulo inexistente.

**2.2.3 — Implementar** `src/server/ai/openaiCompatible.ts`:

```ts
import type { ProviderPreset } from './registry';
import type { AiProviderAdapter, AiProviderRequest } from './types';

const JSON_INSTRUCTION = `\n\nIMPORTANTE: responda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown, sem cercas de código e sem texto antes ou depois.`;

export function createOpenAiCompatibleAdapter(
  preset: ProviderPreset
): AiProviderAdapter {
  const endpoint = () => `${(preset.baseUrl || '').replace(/\/+$/, '')}/chat/completions`;

  const headers = (apiKey?: string) => {
    const base: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };
    if (preset.id === 'openrouter') {
      base['HTTP-Referer'] = 'https://github.com/jjk-cursed-chronicles';
      base['X-Title'] = 'JJK Cursed Chronicles';
    }
    return base;
  };

  const bodyFor = (req: AiProviderRequest, withSchema: boolean) => ({
    model: req.model,
    temperature: req.temperature,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: req.systemInstruction },
      {
        role: 'user',
        content: withSchema
          ? `${req.prompt}\n\nSchema JSON esperado:\n${JSON.stringify(req.schema)}${JSON_INSTRUCTION}`
          : `${req.prompt}${JSON_INSTRUCTION}`,
      },
    ],
    ...(withSchema
      ? {
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'jjk_turn', strict: false, schema: req.schema },
          },
        }
      : { response_format: { type: 'json_object' } }),
  });

  return {
    id: preset.id,
    label: preset.label,
    supportsStreaming: true,

    async generateJson(req, apiKey) {
      const attempt = async (withSchema: boolean): Promise<string> => {
        const res = await fetch(endpoint(), {
          method: 'POST',
          headers: headers(apiKey),
          body: JSON.stringify(bodyFor(req, withSchema)),
        });
        const raw = await res.text();
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${preset.label}: ${raw.slice(0, 300)}`);
        }
        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new Error(`Resposta não-JSON de ${preset.label}: ${raw.slice(0, 200)}`);
        }
        const content = parsed?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error(`Resposta vazia de ${preset.label}`);
        }
        return content;
      };

      try {
        return { text: await attempt(true), model: req.model };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Provedores que não suportam response_format json_schema caem para json_object.
        if (/400|422|response_format|json_schema|unsupported/i.test(message)) {
          return { text: await attempt(false), model: req.model };
        }
        throw err;
      }
    },

    async *streamJson(req, apiKey) {
      const res = await fetch(endpoint(), {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(bodyFor(req, true)),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${preset.label}: ${raw.slice(0, 300)}`);
      }
      if (!res.body) throw new Error(`Sem corpo de streaming em ${preset.label}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep = buffer.indexOf('\n\n');
          while (sep !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const dataLine = block
              .split('\n')
              .find((l) => l.startsWith('data:'));
            if (dataLine) {
              const data = dataLine.slice(5).trim();
              if (data && data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed?.choices?.[0]?.delta?.content;
                  if (typeof delta === 'string' && delta) {
                    full += delta;
                    yield { delta, full };
                  }
                } catch {
                  // chunk SSE malformado: ignora e segue
                }
              }
            }
            sep = buffer.indexOf('\n\n');
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* já liberado */
        }
      }
    },

    async validate(model, apiKey) {
      const started = Date.now();
      if (!apiKey) {
        return {
          ok: false,
          state: 'MISSING',
          message: `Nenhuma chave configurada para ${preset.label}.`,
          modelTested: model,
          latencyMs: Date.now() - started,
        };
      }
      try {
        const res = await fetch(endpoint(), {
          method: 'POST',
          headers: headers(apiKey),
          body: JSON.stringify({
            model,
            max_tokens: 8,
            messages: [{ role: 'user', content: 'Responda apenas: OK' }],
          }),
        });
        const latencyMs = Date.now() - started;
        if (!res.ok) {
          const raw = await res.text().catch(() => '');
          return {
            ok: false,
            state: /429|quota|rate/i.test(raw) ? 'QUOTA_EXCEEDED' : 'INVALID',
            message: `${preset.label} respondeu ${res.status}. ${raw.slice(0, 160)}`,
            modelTested: model,
            latencyMs,
          };
        }
        return {
          ok: true,
          state: 'VALID',
          message: `Conexão ${preset.label} ativa (${model}).`,
          modelTested: model,
          latencyMs,
        };
      } catch (err) {
        return {
          ok: false,
          state: 'INVALID',
          message: `Falha ao falar com ${preset.label}: ${
            err instanceof Error ? err.message.slice(0, 160) : String(err)
          }`,
          modelTested: model,
          latencyMs: Date.now() - started,
        };
      }
    },
  };
}
```

**2.2.4 — GREEN:**

```bash
npx tsx --test src/server/ai/openaiCompatible.test.ts
```

**Esperado:** `ℹ pass 3`, `ℹ fail 0`.

**2.2.5 — Commit:**

```bash
git add -A && git commit -m "feat(server): adaptador OpenAI-compativel (OpenRouter, NVIDIA NIM, IA customizada)"
```

---

### Task 2.3 — Adaptador Gemini (extrair do `server.ts`)

**Novo arquivo:** `src/server/ai/geminiProvider.ts`
**Teste:** `src/server/ai/geminiProvider.test.ts`

**2.3.1 — Teste (RED)** — injeta um cliente falso (sem rede):

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiAdapter } from './geminiProvider.ts';

const fakeClient = {
  models: {
    generateContent: async (args: any) => ({
      text: JSON.stringify({ narrative: args.contents }),
    }),
    generateContentStream: async function* (args: any) {
      yield { text: '{"narrative":"oi"}' };
    },
  },
} as any;

const req = {
  systemInstruction: 'SYS',
  prompt: 'PROMPT',
  schema: { type: 'object', properties: {}, required: [] },
  temperature: 0.75,
  model: 'gemini-3.8-flash',
};

test('generateJson usa o SDK do Gemini e devolve o texto bruto', async () => {
  const adapter = createGeminiAdapter(() => fakeClient);
  const out = await adapter.generateJson(req, 'key');
  assert.equal(out.text, '{"narrative":"PROMPT"}');
  assert.equal(out.model, 'gemini-3.8-flash');
});

test('validate responde VALID quando o modelo devolve texto', async () => {
  const adapter = createGeminiAdapter(() => fakeClient);
  const health = await adapter.validate('gemini-3.8-flash', 'key');
  assert.equal(health.state, 'VALID');
});
```

**2.3.2 — RED** → **2.3.3 — Implementar** `src/server/ai/geminiProvider.ts`:

```ts
import { GoogleGenAI } from '@google/genai';
import type { AiProviderAdapter, AiProviderRequest } from './types';

export function normalizeGeminiModel(candidateModel?: string): string {
  const m = (candidateModel || '').trim();
  if (m === 'gemini-3.8-flash' || m === 'gemini-flash-latest') return 'gemini-3.8-flash';
  if (m === 'gemini-3.5-flash-lite' || m === 'gemini-flash-lite-latest') return 'gemini-3.5-flash-lite';
  if (m === 'gemini-3.1-flash-lite') return 'gemini-3.1-flash-lite';
  if (m === 'gemini-4-argon' || m === 'gemini-pro-latest') return 'gemini-4-argon';
  if (m === 'gemini-3-flash-preview' || m === 'gemini-2.5-flash') return 'gemini-3.8-flash';
  if (m === 'gemini-3.1-flash-lite-preview' || m === 'gemini-2.5-flash-lite') return 'gemini-3.1-flash-lite';
  return 'gemini-3.8-flash';
}

export function createGeminiAdapter(
  clientFactory: (apiKey?: string) => GoogleGenAI | null
): AiProviderAdapter {
  return {
    id: 'gemini',
    label: 'Google Gemini',
    supportsStreaming: true,

    async generateJson(req: AiProviderRequest, apiKey?: string) {
      const ai = clientFactory(apiKey);
      if (!ai) throw new Error('Chave GEMINI_API_KEY ausente.');
      const model = normalizeGeminiModel(req.model);
      const response = await ai.models.generateContent({
        model,
        contents: req.prompt,
        config: {
          systemInstruction: req.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: req.schema,
          temperature: req.temperature,
        },
      });
      if (!response.text) throw new Error('Resposta vazia do modelo Gemini.');
      return { text: response.text, model };
    },

    async *streamJson(req: AiProviderRequest, apiKey?: string) {
      const ai = clientFactory(apiKey);
      if (!ai) throw new Error('Chave GEMINI_API_KEY ausente.');
      const model = normalizeGeminiModel(req.model);
      const stream = await ai.models.generateContentStream({
        model,
        contents: req.prompt,
        config: {
          systemInstruction: req.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: req.schema,
          temperature: req.temperature,
        },
      });
      let full = '';
      for await (const chunk of stream) {
        const delta = chunk.text ?? '';
        if (!delta) continue;
        full += delta;
        yield { delta, full };
      }
    },

    async validate(model: string, apiKey?: string) {
      const started = Date.now();
      const ai = clientFactory(apiKey);
      if (!ai) {
        return {
          ok: false,
          state: 'MISSING',
          message: 'Nenhuma chave GEMINI_API_KEY encontrada.',
          modelTested: normalizeGeminiModel(model),
          latencyMs: Date.now() - started,
        };
      }
      try {
        const response = await ai.models.generateContent({
          model: normalizeGeminiModel(model),
          contents: 'Responda apenas: OK',
        });
        const latencyMs = Date.now() - started;
        if (!response.text) {
          return {
            ok: false,
            state: 'INVALID',
            message: 'Resposta vazia da API Gemini.',
            modelTested: normalizeGeminiModel(model),
            latencyMs,
          };
        }
        return {
          ok: true,
          state: 'VALID',
          message: `Conexão Gemini IA ativa e validada (${normalizeGeminiModel(model)}).`,
          modelTested: normalizeGeminiModel(model),
          latencyMs,
        };
      } catch (err) {
        return {
          ok: false,
          state: 'INVALID',
          message: err instanceof Error ? err.message.slice(0, 160) : String(err),
          modelTested: normalizeGeminiModel(model),
          latencyMs: Date.now() - started,
        };
      }
    },
  };
}
```

**2.3.4 — GREEN + suíte:**

```bash
npx tsx --test src/server/ai/geminiProvider.test.ts && npm test && npm run lint
```

**2.3.5 — Commit:**

```bash
git add -A && git commit -m "feat(server): adaptador Gemini isolado com normalizacao de modelo"
```

---

### Task 2.4 — Fábrica de adaptadores + wiring no `server.ts`

**Novo arquivo:** `src/server/ai/factory.ts`
**Teste:** `src/server/ai/factory.test.ts`

**2.4.1 — Teste (RED)**:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdapter } from './factory.ts';

test('openrouter resolve para o adaptador OpenAI-compatível', () => {
  const adapter = createAdapter({ provider: 'openrouter', model: 'openai/gpt-4o-mini' });
  assert.equal(adapter.id, 'openrouter');
});

test('gemini resolve para o adaptador Gemini', () => {
  const adapter = createAdapter({ provider: 'gemini', model: 'gemini-3.8-flash' });
  assert.equal(adapter.id, 'gemini');
});

test('custom sem baseUrl lança erro claro', () => {
  assert.throws(
    () => createAdapter({ provider: 'custom', model: 'llama3' }),
    /baseUrl/i
  );
});
```

**2.4.2 — RED** → **2.4.3 — Implementar** `src/server/ai/factory.ts`:

```ts
import { GoogleGenAI } from '@google/genai';
import { getPreset, normalizeBaseUrl, type ProviderPreset } from './registry';
import { createGeminiAdapter } from './geminiProvider';
import { createOpenAiCompatibleAdapter } from './openaiCompatible';
import type { AiProviderAdapter, ProviderId } from './types';

export interface AdapterRequest {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export function createGeminiClient(apiKey?: string): GoogleGenAI | null {
  const rawKey = String(apiKey || '').trim();
  if (!rawKey || rawKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: rawKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

export function createAdapter(request: AdapterRequest): AiProviderAdapter {
  const preset: ProviderPreset = getPreset(request.provider);
  if (preset.id === 'gemini') {
    return createGeminiAdapter((apiKey) => createGeminiClient(apiKey));
  }
  const baseUrl =
    preset.id === 'custom'
      ? normalizeBaseUrl(request.baseUrl || '')
      : preset.baseUrl;
  if (!baseUrl) {
    throw new Error(
      `O provedor "${preset.id}" exige baseUrl (endpoint OpenAI-compatível).`
    );
  }
  return createOpenAiCompatibleAdapter({ ...preset, baseUrl });
}

export function defaultModelFor(provider?: string): string {
  return getPreset(provider).defaultModel;
}

export type { ProviderId };
```

**2.4.4 — GREEN:** `npx tsx --test src/server/ai/factory.test.ts` → `ℹ pass 3`.

**2.4.5 — Wire no `server.ts`:**

1. `getGeminiClient()` (linha 656) passa a usar `createGeminiClient()` de
   `src/server/ai/factory.ts` (fonte única de verdade).
2. `POST /api/gemini/turn` (linha 1467) e `POST /api/gemini/turn/stream` (linha 1883):
   - leem do body: `provider = 'gemini'`, `model`, `baseUrl = ''`, e a chave em
     `customApiKey` **ou** no header `x-custom-api-key`;
   - montam o adaptador com `createAdapter({ provider, model, baseUrl })`;
   - montam a **cadeia de fallback**: `[provedor escolhido, modelo escolhido]` →
     `[mesmo provedor, modelo default]` → `['gemini', 'gemini-3.8-flash']` →
     `['gemini','gemini-3.1-flash-lite']` (deduplicado, como já é feito hoje com
     `normalizeModelName`);
   - para Gemini, continuam valendo `responseSchema` + `responseMimeType` (via
     `geminiProvider`); para os demais, o caminho é `json_schema` → `json_object`
     (via `openaiCompatible`), com **parse tolerante** por `parseJsonObject`
     (o `JSON.parse` cru de `server.ts:1852` passa a usar `parseJsonObject`);
   - **streaming**: o loop atual (`server.ts:1964-2003`) passa a iterar
     `adapter.streamJson(...)` e a extrair o delta de narrativa com
     `extractNarrativeFromJson(full)` (mesma regex de hoje, agora em
     `src/server/ai/jsonExtract.ts`) — o contrato SSE (`delta`/`done`/`error`)
     **não muda**, então o frontend não quebra.
3. `POST /api/gemini/validate` (linha 1011) passa a validar o **provedor escolhido**
   via `adapter.validate(model, apiKey)` e devolve o **mesmo formato** de hoje
   (`state`, `modelTested`, `latencyMs`, `fallbackActive`, `message`, `checkedAt`)
   — `src/services/geminiService.ts:37` continua funcionando sem alteração.
4. `technique` (1105), `session-zero` (1276) e `memory` (2014) passam a usar
   `createAdapter(...)` com o provedor do body (default `gemini`), preservando os
   fallbacks locais existentes.

**2.4.6 — Aliases de rota** (para não quebrar nada existente e expor a nomenclatura nova):

```ts
const aiTurnHandler = async (req: express.Request, res: express.Response) => { /* corpo atual do /api/gemini/turn */ };
app.post('/api/gemini/turn', aiTurnHandler);
app.post('/api/ai/turn', aiTurnHandler);
```

Idem para `/turn/stream` e `/validate`. E **atualizar `ROUTE_LIMITS`** (`server.ts:871`)
incluindo as rotas novas:

```ts
'/api/ai/turn': 20,
'/api/ai/turn/stream': 20,
'/api/ai/validate': 10,
```

**2.4.7 — Regressão + smoke:**

```bash
npm test && npm run lint && npm run build
```

**Esperado:** suíte `ℹ pass 20` (contando os novos), lint limpo, build sem erro.

Smoke manual (servidor local, `.env` com `GEMINI_API_KEY`):

```bash
npm run dev
# em outro terminal:
curl -s -X POST http://localhost:3000/api/ai/turn \
  -H 'Content-Type: application/json' \
  -d '{"provider":"gemini","model":"gemini-3.8-flash","character":{"name":"Teste","technique":{"name":"X"}},"world":{"location":"Tóquio","arc":"Teste","activeBarrierOrDomain":"Nenhum","npcsInScene":[]},"actionMode":"DO","actionText":"Olho em volta.","revealedHandVow":false,"ragContext":"","activeCards":[],"memoryContext":"","recentHistory":"","isOpening":false}' \
  | head -c 400
```

**Esperado:** JSON com `"ok":true` e `data.narrative` preenchida (ou `usedFallback:true` se
não houver chave — ambos são aceitáveis; `ok:false` **não** é).

**2.4.8 — Commit:**

```bash
git add -A && git commit -m "feat(server): rotas do Mestre passam a usar a camada de provedor + aliases /api/ai"
```

---

## Fase 3 — Bíblia de personagens e prompt ampliado

### Task 3.1 — Estrutura da bíblia + matcher de elenco

**Novo arquivo:** `src/server/prompts/characterBible.ts`
**Teste:** `src/server/prompts/characterBible.test.ts`

**3.1.1 — Teste (RED)**:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_BIBLE,
  findDossiersForCast,
  normalizeCharacterKey,
} from './characterBible.ts';

test('todo dossiê tem voz, maneirismos, bordões e taboos preenchidos', () => {
  for (const entry of CHARACTER_BIBLE) {
    assert.ok(entry.voice.length > 60, `${entry.displayName}: voz curta`);
    assert.ok(entry.mannerisms.length >= 2, `${entry.displayName}: maneirismos insuficientes`);
    assert.ok(entry.catchphrases.length >= 1, `${entry.displayName}: sem bordão`);
    assert.ok(entry.taboos.length >= 1, `${entry.displayName}: sem taboos`);
    assert.ok(entry.relationships.length > 40, `${entry.displayName}: sem relações`);
  }
});

test('aliases são normalizados e únicos', () => {
  const keys = new Set<string>();
  for (const entry of CHARACTER_BIBLE) {
    for (const alias of [entry.displayName, ...entry.aliases]) {
      const key = normalizeCharacterKey(alias);
      assert.ok(!keys.has(key), `alias duplicado: ${key}`);
      keys.add(key);
    }
  }
});

test('findDossiersForCast acha Gojo pelo nome exato e por apelido', () => {
  const byExact = findDossiersForCast(['Satoru Gojo']);
  assert.equal(byExact.length, 1);
  assert.equal(byExact[0].id, 'gojo');

  const byAlias = findDossiersForCast(['Gojo']);
  assert.equal(byAlias.length, 1);
  assert.equal(byAlias[0].id, 'gojo');
});

test('findDossiersForCast ignora personagens desconhecidos', () => {
  assert.deepEqual(findDossiersForCast(['Kurumi Tsubaki']), []);
});

test('findDossiersForCast deduplica menções repetidas', () => {
  assert.equal(findDossiersForCast(['Gojo', 'Satoru Gojo', 'gojo']).length, 1);
});
```

**3.1.2 — RED:** `npx tsx --test src/server/prompts/characterBible.test.ts`.

**3.1.3 — Implementar** `src/server/prompts/characterBible.ts` — **tipo + matcher + 3 dossiês
modelo** (Gojo, Itadori, Sukuna). O restante do elenco é preenchido nas Tasks 3.2 e 3.3.

```ts
export interface CharacterDossier {
  id: string;
  displayName: string;
  aliases: string[];
  /** Tom, ritmo, vocabulário e o que NUNCA diz. */
  voice: string;
  mannerisms: string[];
  catchphrases: string[];
  /** Psicologia: motivacao, medos, valores. */
  psychology: string;
  relationships: string;
  combatStyle: string;
  /** Coisas que violam a personagem (erros de portrayal). */
  taboos: string[];
  era: 'canon' | 'sequel' | 'both';
}

export function normalizeCharacterKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DOSSIERS: CharacterDossier[] = [
  {
    id: 'gojo',
    displayName: 'Satoru Gojo',
    aliases: ['Gojo', 'Satoru', 'Professor Gojo', 'Sensei Gojo'],
    voice:
      'Fala em PT-BR casual e arrastado, com partículas como "Hmm", "Ah", "Eeeeh", alternando provocação e carinho. Trata qualquer um pelo primeiro nome com sufixo "-kun" ou "-chan" (Itadori-kun, Geto-san). Nunca levanta a voz: a intimidação vem da calma, da pausa antes da frase e do riso de quem já sabe o resultado. Nunca admite risco enquanto ensina.',
    mannerisms: [
      'Abaixa a venda para revelar os Seis Olhos apenas quando quer que o silêncio pese.',
      'Fala de Ōkō como se fosse assunto de vestibular.',
      'Enrola piadas e fofocas no meio de conselhos de vida.',
      'Sai de cena com "não se preocupe, eu cuido disso" e resolve sozinho.',
    ],
    catchphrases: [
      'Ah, isso é chato, né?',
      'Não se preocupe, eu cuido disso.',
      'Eeeeh, mas isso não é comigo. Vai lá, Itadori.',
    ],
    psychology:
      'Solitário por estrutura: é o único que enxerga tudo e não pode dividir esse conhecimento com ninguém. Carrega a culpa de ter matado Toji e de não ter salvado Geto. Usa irreverência como armadura contra a exaustão. Não é frio: é sobrecarregado e, no fundo, escuta.',
    relationships:
      'Com Itadori: pai e professor, com um afeto que ele nunca admite em voz alta. Com Fushiguro: exigência e afeto pelo legado Zenin. Com Geto: a ausência que dói de verdade. Com Kugisaki: elege em silêncio. Com Sukuna: rivalidade profissional, sem afeto.',
    combatStyle:
      'Alcance mínimo necessário: o Infinito neutraliza, o Azul implode, o Vermelho expulsa, o Vazio Roxo apaga. Luta como quem apaga um quadro, nunca com o esforço de um igual.',
    taboos: [
      'Nunca é assustado, nunca é ferido por golpe comum e nunca é surpreendido por fraqueza.',
      'Nunca explica toda a verdade: guarda o Vazio Infinito para si.',
      'Nunca chama Itadori de "criança fraca" sem afeto no tom.',
    ],
    era: 'both',
  },
  {
    id: 'itadori',
    displayName: 'Yuji Itadori',
    aliases: ['Itadori', 'Yuji', 'Suzuno', 'Receptáculo de Sukuna'],
    voice:
      'PT-BR direto, caloroso e sem rodeios: fala em primeira pessoa e admite quando não sabe. Vocabulário cotidiano ("tipo", "né", "bom"), sem floreios, mas com as frases "vou proteger" e "não vou deixar ninguém para trás". Humor seco e aut depreciativo ("sou só um garoto, né?"). Nunca fala de um jeito que faça o interlocutor se sentir fraco.',
    mannerisms: [
      'Sorri mesmo sangrando, e isso assusta mais que a raiva.',
      'Repete o nome de quem está em perigo antes de agir.',
      'Perde a compostura e quebra tudo por perto quando alguém se machuca.',
      'Fica quieto quando percebe que tem algo grande demais acontecendo.',
    ],
    catchphrases: [
      'Eu não vou deixar você sozinho.',
      'Vamos resolver isso juntos.',
      'Não é justo... mas eu vou fazer o que tem que ser feito.',
    ],
    psychology:
      'Carrega a morte de 124 pessoas como dívida viva e busca redenção em proteger outros. Rejeita Sukuna, mas não nega a herança que recebeu dele. É vulnerável ao medo de perder as pessoas próximas.',
    relationships:
      'Com Gojo: mentor e referência de força. Com Fushiguro: amigo e irmão de combate, com um ponto de ciúme de quem não foi escolhido. Com Kugisaki: parceira e irmã de combate. Com Sukuna: coexistência temporária e diálogo forçado.',
    combatStyle:
      'Punho Divergente para golpes duplos; corpo a corpo forçado, usando o que estiver à mão como arma improvisada. O Kokusen é resultado de timing obsessivo, não um poder de classe especial.',
    taboos: [
      'Nunca é cínico sobre a própria vida e nunca ri de ferimentos graves.',
      'Nunca usa discurso de "salvador" vazio.',
      'Nunca deixa de perguntar por quem ele não está lutando.',
    ],
    era: 'both',
  },
  {
    id: 'sukuna',
    displayName: 'Ryomen Sukuna',
    aliases: ['Sukuna', 'Rei das Maldições', 'O Desonrado', 'Dedo de Sukuna'],
    voice:
      'PT-BR arcaico e cruel, quase teatral: vocativo antigo ("homem", "criatura"), ponderação deliberada, deboche como forma deزونho constante. Fala curto e deixa o peso de cada palavra assentar. Não eleva a voz: a ironia é o martelo. Raramente dá conselhos; dá sentenças.',
    mannerisms: [
      'Marca território com a mão e o riso baixo antes de um corte.',
      'Trata a luta como uma refeição ("enfim, algo digno de mastigar").',
      'Cita a própria derrota como troféu.',
      'Estende a palma para cima antes do corte, e isso mata.',
    ],
    catchphrases: [
      'Fraco demais para me interessar.',
      'Enfim... umervo que vale o meu tempo.',
      'Vem. Morre junto comigo.',
    ],
    psychology:
      'Séculos de solidão e de superioridade reconhecida tarde demais. Odeia ser subestimado, ama ser reconhecido, e por isso testa o oponente antes de matar. Hedonista, estratégico, cruel sem sadismo gratuito: a crueldade é ferramenta.',
    relationships:
      'Com Itadori: usa-o como recipiente e como espelho. Com Gojo: rivalidade de muitos anos, o único igual de verdade. Com Fushiguro: desprezo pela cópia de recipiente que habitou. Com Megumi: o único que ele respeitou como mestre.',
    combatStyle:
      'Santuário aberto de 200 m com Clivar e Desmantelar garantidos; corte que se ajusta à resistência e à Energia Amaldiçoada do alvo. Não desvia de golpes: os recebe para provar que não importam.',
    taboos: [
      'Nunca é gentil, nunca pede desculpas e nunca deixa de lado a própria superioridade.',
      'Jamais usa a forma de um recipiente humano como se fosse o próprio corpo sem cálculo.',
    ],
    era: 'both',
  },
];

export const CHARACTER_BIBLE: CharacterDossier[] = DOSSIERS;

export function findDossiersForCast(names: string[]): CharacterDossier[] {
  const wanted = new Set(names.map(normalizeCharacterKey).filter(Boolean));
  const found: CharacterDossier[] = [];
  for (const entry of DOSSIERS) {
    const keys = [entry.displayName, ...entry.aliases].map(normalizeCharacterKey);
    if (keys.some((k) => wanted.has(k))) found.push(entry);
  }
  return found;
}
```

> ⚠️ **Revisão obrigatória antes do commit:** o texto dos dossiês vai **literalmente** para o
> prompt do Mestre. Regras:
> 1. PT-BR gramatical, sem marcadores de revisão e sem caracteres não-latinhos.
> 2. `voice` descreve **como** o personagem fala (tom, ritmo, vocabulário, o que nunca diz) —
>    nunca o que ele faz.
> 3. `psychology` descreve motivation, medos e valores — **sem inventar** eventos, graus ou
>    técnicas que não constem no `Codex.md`.
> 4. `taboos` lista **erros de portrayal** (o que o Mestre jamais deve fazer com o personagem).
> O teste `todo dossiê tem voz…` garante o tamanho mínimo, mas **não** valida a língua nem a
> fidelidade ao cânone: a revisão humana do conteúdo é parte da task.

**3.1.4 — GREEN:**

```bash
npx tsx --test src/server/prompts/characterBible.test.ts
```

**Esperado:** `ℹ pass 5`, `ℹ fail 0`.

**3.1.5 — Commit:**

```bash
git add -A && git commit -m "feat(prompt): biblia de personagens (dossies de voz e psicologia) + matcher de elenco"
```

---

### Task 3.2 — Preliminar o elenco canônico (parte 1)

**Arquivos:** `src/server/prompts/characterBible.ts` (edição)
**Teste:** `src/server/prompts/characterBible.test.ts` (extensão)

**3.2.1 — Adicionar ao teste** (RED antes de implementar):

```ts
test('o elenco canônico mínimo está coberto', () => {
  const required = [
    'gojo', 'itadori', 'sukuna', 'megumi', 'nobara', 'nanami',
    'kenjaku', 'geto', 'mahito', 'todo', 'higuruma', 'hakari',
  ];
  const ids = new Set(CHARACTER_BIBLE.map((e) => e.id));
  for (const id of required) assert.ok(ids.has(id), `dossiê ausente: ${id}`);
});
```

**3.2.2 — Implementar:** acrescentar dossiês completos (mesmo padrão de campos) para:
**Megumi Fushiguro**, **Nobara Kugisaki**, **Kento Nanami**, **Kenjaku**,
**Suguru Geto**, **Mahito**, **Aoi Todo**, **Hiromi Higuruma**, **Kinji Hakari**.
Para cada um: `voice` (≥ 3 linhas descrevendo tom/ritmo/vocabulário),
`mannerisms` (3–5), `catchphrases` (2–3), `psychology`, `relationships`,
`combatStyle`, `taboos` (2–3), `era`.

**Referência de fidelidade:** usar `Codex.md` (verbetes `[Personagem] ...`) como fonte de
fatos canônicos e a seção "Psicologia, Filosofia e Forma de Pensar" como base da
`psychology`. **Não inventar** técnicas, graus ou eventos: os dossiês descrevem **voz e
atitude**, não reescrevem o lore (o lore vem do RAG).

**3.2.3 — GREEN + regressão:**

```bash
npx tsx --test src/server/prompts/characterBible.test.ts && npm test && npm run lint
```

**3.2.4 — Commit:**

```bash
git add -A && git commit -m "feat(prompt): dossies de voz do elenco canonico parte 1"
```

---

### Task 3.3 — Preliminar o elenco canônico (parte 2)

**Arquivos:** `src/server/prompts/characterBible.ts`
**Teste:** extensão de `src/server/prompts/characterBible.test.ts`

**3.3.1 — Teste (RED)** — ampliar a lista exigida:

```ts
test('elenco canônico parte 2 está coberto', () => {
  const required = [
    'kashimo', 'choso', 'yuta', 'maki', 'toji', 'shoko',
    'yaga', 'naobito', 'meimei', 'inumaki', 'panda', 'miwa',
  ];
  const ids = new Set(CHARACTER_BIBLE.map((e) => e.id));
  for (const id of required) assert.ok(ids.has(id), `dossiê ausente: ${id}`);
});
```

**3.3.2 — Implementar:** dossiês para **Hajime Kashimo**, **Choso**, **Yuta Okkotsu**,
**Maki Zenin**, **Toji Fushiguro**, **Shoko Ieiri**, **Masamichi Yaga**, **Naobito Zen'in**,
**Mei Mei**, **Toge Inumaki**, **Panda**, **Kasumi Miwa**.
Regras iguais: PT-BR limpo, `era` correto (`both` para a maioria; `canon` para personagens
cuja presença é exclusiva de arcos do mangá — ex.: casos que dependem de eventos do
Incidente de Shibuya).

**3.3.3 — GREEN + regressão:**

```bash
npx tsx --test src/server/prompts/characterBible.test.ts && npm test && npm run lint
```

**3.3.4 — Commit:**

```bash
git add -A && git commit -m "feat(prompt): dossies de voz do elenco canonico parte 2"
```

---

### Task 3.4 — Montar o contexto de elenco (bíblia + Codex.md)

**Novo arquivo:** `src/server/prompts/castContext.ts`
**Teste:** `src/server/prompts/castContext.test.ts`

**3.4.1 — Teste (RED)**:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCastContext } from './castContext.ts';
import { createLoreStore } from '../lore/loreStore.ts';

const store = createLoreStore({
  storyCards: [],
  mdSections: [
    {
      title: '[Personagem] Satoru Gojo (Grau Especial)',
      keys: ['gojo'],
      content: '### Psicologia\nGojo é irreverente e Solitário.',
    },
  ],
});

test('o contexto de elenco junta dossiê e verbete do Codex para o NPC em cena', () => {
  const block = buildCastContext({
    npcNames: ['Satoru Gojo'],
    actionText: 'O Gojo sorri.',
    lore: store,
    era: 'sequel',
  });
  assert.ok(block.includes('Satoru Gojo'));
  assert.ok(block.includes('irreverente'));
  assert.ok(block.includes('Solitário'));
});

test('sem NPC conhecido, o bloco é vazio', () => {
  const block = buildCastContext({
    npcNames: ['Transeunte'],
    actionText: '',
    lore: store,
    era: 'sequel',
  });
  assert.equal(block, '');
});
```

**3.4.2 — RED** → **3.4.3 — Implementar** `src/server/prompts/castContext.ts`:

```ts
import type { LoreStore } from '../lore/loreStore';
import { findDossiersForCast, type CharacterDossier } from './characterBible';

export interface CastContextInput {
  npcNames: string[];
  actionText: string;
  lore: LoreStore;
  era?: 'canon' | 'sequel';
  /** Limite de personagens com dossiê completo no prompt. */
  maxDossiers?: number;
}

export function buildCastContext(input: CastContextInput): string {
  const max = input.maxDossiers ?? 4;
  const mentioned = input.lore.matchCharacterNames(input.actionText);
  const allNames = Array.from(new Set([...input.npcNames, ...mentioned]));
  const dossiers = findDossiersForCast(allNames).slice(0, max);

  const parts: string[] = [];
  for (const dossier of dossiers) {
    parts.push(renderDossier(dossier, input));
  }
  if (parts.length === 0) return '';

  return [
    '=== ELENCO CANÔNICO EM CENA — DOSSIÊS DE VOZ, PSICOLOGIA E COMPORTAMENTO (OBRIGATÓRIO) ===',
    'Estes personagens estão em cena AGORA. Cada um tem voz, vocabulário, tiques, bordões e limites próprios.',
    'Escreva o fala de cada um como a pessoa que ele é: nunca genérico, nunca todos com a mesma voz.',
    '',
    ...parts,
  ].join('\n');
}

function renderDossier(dossier: CharacterDossier, input: CastContextInput): string {
  const section = input.lore.findCharacterSection(dossier.displayName);
  const codexExcerpt = section
    ? section.content.replace(/\s+/g, ' ').trim().slice(0, 2200)
    : '';

  return [
    `--- ${dossier.displayName} ---`,
    `VOZ: ${dossier.voice}`,
    `MANEIRISMOS: ${dossier.mannerisms.map((m) => `- ${m}`).join(' ')}`,
    `BORDÕES/ASSINATURAS DE FALA: ${dossier.catchphrases.map((c) => `"${c}"`).join(' / ')}`,
    `PSICOLOGIA: ${dossier.psychology}`,
    `RELAÇÕES (incluindo com o jogador): ${dossier.relationships}`,
    `COMBATE: ${dossier.combatStyle}`,
    `NUNCA FAÇA: ${dossier.taboos.map((t) => `- ${t}`).join(' ')}`,
    codexExcerpt ? `VERBETE CANÔNICO (Codex): ${codexExcerpt}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
```

**3.4.4 — GREEN:** `npx tsx --test src/server/prompts/castContext.test.ts` → `ℹ pass 2`.

**3.4.5 — Commit:**

```bash
git add -A && git commit -m "feat(prompt): monta o bloco de elenco (dossie + verbete do Codex) por turno"
```

---

### Task 3.5 — Prompt do Mestre ampliado (3 seções novas) e injeção no system instruction

**Arquivos:** `src/server/prompts/gmSystemPrompt.ts` (edição), `server.ts` (wire)
**Teste:** `src/server/prompts/gmSystemPrompt.test.ts`

**3.5.1 — Teste (RED)**:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemInstruction } from './gmSystemPrompt.ts';

test('o system instruction do Mestre contém as regras de performance de personagem', () => {
  const s = buildSystemInstruction('');
  assert.ok(s.includes('PERFORMANCE DE PERSONAGEM'));
  assert.ok(s.includes('dossiê'));
});

test('o dossiê do elenco entra no system instruction', () => {
  const s = buildSystemInstruction('ELENCO CANÔNICO EM CENA');
  assert.ok(s.includes('ELENCO CANÔNICO EM CENA'));
});

test('as regras de lore avançado e de memória estão presentes', () => {
  const s = buildSystemInstruction('');
  assert.ok(s.includes('LORE AVANÇADO'));
  assert.ok(s.includes('MEMÓRIA E CONTEXTO'));
});
```

**3.5.2 — RED** → **3.5.3 — Implementar** em `src/server/prompts/gmSystemPrompt.ts`:

- Manter `GM_SYSTEM_INSTRUCTION_BASE` com o texto atual **idêntico** (9 seções) — mover
  o template literal `SYSTEM_INSTRUCTION_GM` de `server.ts:727` e renomear a constante.
- Adicionar `GM_SYSTEM_INSTRUCTION_EXTENSIONS` com as 3 seções novas (texto abaixo).
- Adicionar `buildSystemInstruction(castBlock: string): string` que concatena
  base + extensões + (opcional) o `castBlock`.

```ts
export const GM_SYSTEM_INSTRUCTION_BASE = `...texto atual de server.ts:727, idêntico...`;

export const GM_SYSTEM_INSTRUCTION_EXTENSIONS = `
<TEXTO DAS 3 SEÇÕES NOVO — bloco abaixo>
`;

export function buildSystemInstruction(castBlock: string): string {
  const parts = [GM_SYSTEM_INSTRUCTION_BASE, GM_SYSTEM_INSTRUCTION_EXTENSIONS];
  if (castBlock && castBlock.trim()) parts.push(castBlock.trim());
  return parts.join('\n\n');
}
```

**Texto novo (adicionar literalmente dentro de `GM_SYSTEM_INSTRUCTION_EXTENSIONS`):**

```
## 10. PERFORMANCE DE PERSONAGEM — A INTERPRETAÇÃO TEM DE SER INÉDITA E VEROSSÍMIL

1. Todo personagem canônico tem dossiê de voz, psicologia, maneirismos, bordões e limites no bloco "ELENCO CANÔNICO EM CENA". Você DEVE narrá-lo a partir desse dossiê.
2. Duas pessoas nunca falam igual: se dois NPCs poderiam dizer a mesma frase com o mesmo tom, reescreva um dos dois.
3. Fala de NPC = 1 a 3 frases, no vocabulário dele, com o tique dele. Nada de frase genérica que qualquer personagem diria.
4. Vocabulário específico por personagem (ex.: Gojo chama os alunos de "-kun"; Inumaki fala com palavras de arroz; Nanami usa cansaço e precisão seca; Sukuna usa arcaísmo e desprezo; Todo trata todo mundo como "melhor amigo").
5. O NPC só diz o que ele SABE (o que viu, sentiu ou foi informado em cena). Nada de telepathy canônica.
6. Sob pressão, o personagem não perde a identidade: a voz muda de intensidade, não de caráter.
7. Se um NPC canônico for mencionado no texto do jogador mas não estiver em cena, não o faça falar: narre só o que ele faria se presente, ou ignore.

## 11. LORE AVANÇADO (JUJUTSU KAISEN — REGRAS NÃO NEGOCIÁVEIS)

1. **Kokusen (Faísca Negra):** aplicação de EA dentro de 0,000001 s do impacto físico; distorce o espaço; dano elevado à potência 2,5; quem acerta entra na "Zona" e opera a 120% do potencial.
2. **Técnica Reversa:** só com domínios completos (incluindo o Vazio Infinito) ou técnica inata polida + energia positiva; Domínio e RCT são mutuamente exclusivos no mesmo turno.
3. **Domínio Simples:** neutraliza o Sure-Hit, mas a barreira é corroída contra domínios de Grau Especial em segundos se o usuário sair da postura; o Domínio Simples não substitui a Técnica Inata.
4. **Exaustão pós-domínio (Burnout):** o colapso deixa a Técnica Inata inutilizável por minutos; ninguém "recarrega" o domínio no mesmo turno.
5. **Restrição Celestial (Maki, Toji):** zero EA; invisíveis à barreira; imunes ao Sure-Hit; ferimentos precisam de RCT e não curam sozinhos; e eles não têm técnica inata para usar.
6. **Clivar x Desmantelar:** Clivar exige contato com a palma e ajusta-se à resistência e à EA do alvo; Desmantelar é corte padrão à distância para alvos comuns e objetos.
7. **Fuga (Kamino):** a flecha de fogo termobárica só é disparada depois de um corte bem-sucedido no alvo.
8. **Energia Positiva destrói espíritos amaldiçoados**; energia negativa apenas os enfraquece.
9. **Grau Especial é raríssimo:** em campanha "sequel" (pós-mangá), um Grau Especial é um evento, não o status normal de um colega de escola.
10. **O Cânone é 2018 (mangá).** Nada de eventos de anime, live-action, jogos ou fanfics. Se você não tem certeza de um detalhe, não o afirme.

## 12. MEMÓRIA E CONTEXTO — COMO USAR O QUE VOCÊ RECEBEU

1. **Precedência:** dossiê de personagem > Story Card / verbete do Codex (RAG) > memória da campanha > conhecimento geral. Quando houver conflito, vale a fonte mais específica.
2. **RAG (STORY CARDS E ENCICLOPÉDIA):** é referência canônica de técnica, local e evento. Use os verbetes como verdade de mundo; não repita literalmente o texto do verbete na narração.
3. **Memória da campanha** (resumos + turnos recentes) é o registro do que ACONTECEU: ferimentos, alianças, votos selados, inimigos mortos. Nunca contradiga: se o jogador foi ferido no ombro, ele continua com o ombro ferido.
4. **Fatos imutáveis** e **limites duros** do contrato são lei: não quebre nem reinterprete.
5. **Cota de contexto:** não despeje o dossiê inteiro na narração — ele é para você imitar a voz, não para ser copiado.
```

**3.5.4 — Wire no `server.ts`:** em `buildServerSideDeepRag` e nos handlers de turno, calcular
`castBlock = buildCastContext({ npcNames: world?.npcsInScene?.map(n => n.name) ?? [], actionText, lore: loreStore, era: world?.era })`
e passar `buildSystemInstruction(castBlock)` como `systemInstruction` em vez de
`SYSTEM_INSTRUCTION_GM` constante.

**3.5.5 — GREEN + regressão:**

```bash
npx tsx --test src/server/prompts/gmSystemPrompt.test.ts && npm test && npm run lint
```

**Esperado:** `ℹ pass 3` no novo arquivo; suíte completa **sem falhas**.

**3.5.6 — Smoke de prompt (verificação real de que o dossiê entra):**

Adicionar `scripts/test-cast-prompt.ts`:

```ts
import { buildCastContext } from '../src/server/prompts/castContext';
import { createLoreStore } from '../src/server/lore/loreStore';

const store = createLoreStore({
  storyCards: [],
  mdSections: [
    {
      title: '[Personagem] Satoru Gojo (Grau Especial)',
      keys: ['gojo'],
      content: '### Psicologia\nGojo é irreverente, solitário e profundamente protetor dos alunos.',
    },
  ],
});

const block = buildCastContext({
  npcNames: ['Satoru Gojo'],
  actionText: 'O Gojo observa a cena.',
  lore: store,
  era: 'sequel',
});

console.log(block);
if (!block.includes('Satoru Gojo') || !block.includes('NUNCA FAÇA')) {
  process.exit(1);
}
```

```bash
npx tsx scripts/test-cast-prompt.ts
```

**Esperado:** imprime o bloco com "Satoru Gojo", "NUNCA FAÇA" e o verbete; **exit code 0**.

**3.5.7 — Commit:**

```bash
git add -A && git commit -m "feat(prompt): Mestre com performance de personagem, lore avancado e regras de memoria"
```

---

### Task 3.6 — Contexto do Codex no RAG (reforço, sem inflar o prompt)

**Arquivos:** `server.ts` (`buildServerSideDeepRag`), `src/server/ai/schema.ts` (sem mudança)

**3.6.1 — Motivation:** hoje o RAG corta cada verbete em ~900 chars e limita a 4 verbetes.
Para que o Mestre "entenda o universo", o corte deve priorizar **o bloco de psicologia**
quando o verbete é de um personagem.

**3.6.2 — Implementar** em `buildServerSideDeepRag`: ao montar `text` de um candidate `md`,
usar `section.content.slice(0, 1800)` (era 900) **e**, se `section.title` casar com
`[Personagem]`, concatenar primeiro o trecho "Psicologia" do verbete:

```ts
function sliceLoreForPrompt(title: string, content: string): string {
  const isCharacter = /\[Personagem\]/i.test(title);
  if (!isCharacter) return content.slice(0, 900);
  const psychIdx = content.search(/Psicologia|Filosofia|Forma de Pensar/i);
  const psych = psychIdx >= 0 ? content.slice(psychIdx, psychIdx + 1400) : '';
  const rest = content.slice(0, 700);
  return `${psych}\n${rest}`.slice(0, 2000);
}
```

**3.6.3 — Regressão e medição do tamanho do prompt** (verificar que não estourou):

```bash
npm test && npm run lint && npm run build
```

E medir (script temporário ou `node -e`) que o prompt de turno com 4 verbetes + 4 dossiês
fica **abaixo de ~40 000 caracteres**. Se estourar, reduzir `maxDossiers` de 4 para 3 em
`buildCastContext` e o corte de 1800 → 1200.

**3.6.4 — Commit:**

```bash
git add -A && git commit -m "feat(rag): prioriza psicologia do personagem no corte dos verbetes do Codex"
```

---

## Fase 4 — Frontend: seletor de provedor, modelo e chave

### Task 4.1 — Tipos e serviço de API provider-aware

**Arquivos:** `src/types/jjk.ts`, `src/services/aiService.ts` (novo), `src/services/geminiService.ts` (mantido)

**4.1.1 — Em `src/types/jjk.ts`** adicionar:

```ts
export type AiProviderId = 'gemini' | 'openrouter' | 'nvidia' | 'custom';

export interface AiProviderOption {
  id: AiProviderId;
  label: string;
  baseUrl: string | null;
  defaultModel: string;
  suggestedModels: string[];
  requiresBaseUrl: boolean;
}

export interface AiRequestOptions {
  provider?: AiProviderId;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}
```

**4.1.2 — Criar `src/services/aiService.ts`** — wrapper **provider-aware** sobre o backend
(mesma forma de `apiFetch` de `geminiService.ts`, com `getAccessHeaders()`):

```ts
import { getAccessHeaders } from './accessGuard';
import type { AiProviderId, AiRequestOptions } from '../types/jjk';

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(getAccessHeaders())) headers.set(key, value);
  return fetch(input, { ...init, headers });
}

export function providerKeyFor(provider: AiProviderId): string {
  const map: Record<AiProviderId, string> = {
    gemini: 'JJK_CUSTOM_GEMINI_KEY',
    openrouter: 'JJK_CUSTOM_OPENROUTER_KEY',
    nvidia: 'JJK_CUSTOM_NVIDIA_KEY',
    custom: 'JJK_CUSTOM_AI_KEY',
  };
  try {
    return localStorage.getItem(map[provider]) || '';
  } catch {
    return '';
  }
}

export function saveProviderKey(provider: AiProviderId, value: string): void {
  const map: Record<AiProviderId, string> = {
    gemini: 'JJK_CUSTOM_GEMINI_KEY',
    openrouter: 'JJK_CUSTOM_OPENROUTER_KEY',
    nvidia: 'JJK_CUSTOM_NVIDIA_KEY',
    custom: 'JJK_CUSTOM_AI_KEY',
  };
  try {
    localStorage.setItem(map[provider], value);
  } catch {
    /* storage indisponível */
  }
}

export interface ProviderValidationReport {
  ok: boolean;
  state: 'VALID' | 'INVALID' | 'MISSING' | 'QUOTA_EXCEEDED';
  modelTested: string;
  latencyMs: number;
  message: string;
  provider: AiProviderId;
}

export async function validateProviderConnection(
  options: AiRequestOptions
): Promise<ProviderValidationReport> {
  const provider = options.provider || 'gemini';
  const apiKey = options.apiKey ?? providerKeyFor(provider);
  try {
    const res = await apiFetch('/api/ai/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-custom-api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        provider,
        model: options.model,
        baseUrl: options.baseUrl,
      }),
    });
    const data = await res.json();
    return {
      ok: Boolean(data.ok),
      state: data.state || 'INVALID',
      modelTested: data.modelTested || options.model || '',
      latencyMs: Number(data.latencyMs || 0),
      message: data.message || 'Não foi possível validar o provedor.',
      provider,
    };
  } catch {
    return {
      ok: false,
      state: 'INVALID',
      modelTested: options.model || '',
      latencyMs: 0,
      message: 'Não foi possível falar com o servidor de validação.',
      provider,
    };
  }
}
```

**4.1.3 — Manter `src/services/geminiService.ts`** como está (imagens, técnica, sessão zero,
memória). **Não renomear** nada agora: `ChatNarrativeStage.tsx`, `ChroniclePage.tsx`,
`CharacterWizard.tsx` e `SettingsPage.tsx` importam tipos dele
(`ApiKeyHealthState`, `GeminiConnectionReport`) — renomear quebra 4 arquivos sem ganho.

**4.1.4 — Teste** `src/services/aiService.test.ts` (RED → GREEN), espelhando o padrão de
`src/services/geminiService.stream.test.ts` (mock de `globalThis.fetch`):

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProviderConnection } from './aiService.ts';

test('validateProviderConnection envia provider, model e baseUrl', async () => {
  const original = globalThis.fetch;
  let captured: any = null;
  globalThis.fetch = (async (url: any, init: any) => {
    captured = { url: String(url), body: JSON.parse(init.body), headers: init.headers };
    return new Response(
      JSON.stringify({ ok: true, state: 'VALID', modelTested: 'x', latencyMs: 12, message: 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;
  try {
    const report = await validateProviderConnection({
      provider: 'nvidia',
      model: 'meta/llama-3.3-70b-instruct',
      apiKey: 'nvapi-test',
    });
    assert.equal(report.state, 'VALID');
    assert.equal(captured.url, '/api/ai/validate');
    assert.equal(captured.body.provider, 'nvidia');
    assert.equal(captured.headers.get('x-custom-api-key'), 'nvapi-test');
  } finally {
    globalThis.fetch = original;
  }
});
```

**4.1.5 — GREEN + regressão:**

```bash
npx tsx --test src/services/aiService.test.ts && npm test && npm run lint
```

**4.1.6 — Commit:**

```bash
git add -A && git commit -m "feat(front): servico de API provider-aware e chaves por provedor"
```

---

### Task 4.2 — Tela de Configurações: provedor, modelo, chave

**Arquivos:** `src/components/SettingsPage.tsx`, `src/App.tsx`

**4.2.1 — `SettingsPage.tsx`:**

- Novas props:
  `aiProvider: AiProviderId`, `onChangeAiProvider: (p: AiProviderId) => void`,
  `aiModel: string`, `onChangeAiModel: (m: string) => void`,
  `customBaseUrl: string`, `onChangeCustomBaseUrl: (v: string) => void`,
  `providerReport: ProviderValidationReport | null`, `onRefreshProviderStatus: () => void`.
- Novo `<Section label="Mestre de IA — provedor">` **antes** da seção existente, com:
  - `<select>` de provedor (Gemini / OpenRouter / NVIDIA NIM / IA customizada);
  - `<select>` de modelo quando o provedor tiver `suggestedModels` + **`<input>` livre**
    para digitar o id exato (modelos de gateway mudam rápido);
  - `<input>` de `baseUrl` **visível só quando `requiresBaseUrl`**;
  - `<input type="password">` de chave, com botão olho (mesmo padrão de `showKey`);
  - botão "Testar conexão" ligado a `onRefreshProviderStatus`.
- **Acessibilidade (obrigatório):** cada campo com `aria-label` explícito; o `<select>` de
  provedor com `aria-label="Provedor de IA do Mestre"`; o botão de olho com
  `aria-label` alternando "Mostrar chave"/"Ocultar chave" (já existe no arquivo).
- **Manter** a seção "Chave de API do Google Gemini" como está (é o preset Gemini) e
  fazer as duas seções refletirem o mesmo estado: salvar a chave em
  `saveProviderKey(aiProvider, value)`.

**4.2.2 — `App.tsx`:**

- Estado novo:
  ```ts
  const [aiProvider, setAiProvider] = useState<AiProviderId>(() => {
    try { return (localStorage.getItem('JJK_AI_PROVIDER') as AiProviderId) || 'gemini'; }
    catch { return 'gemini'; }
  });
  const [aiModel, setAiModel] = useState<string>(() => {
    try { return localStorage.getItem('JJK_AI_MODEL') || 'gemini-3.8-flash'; }
    catch { return 'gemini-3.8-flash'; }
  });
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => {
    try { return localStorage.getItem('JJK_AI_BASE_URL') || ''; }
    catch { return ''; }
  });
  const [providerReport, setProviderReport] = useState<ProviderValidationReport | null>(null);
  ```
- Persistir em `localStorage` (`JJK_AI_PROVIDER`, `JJK_AI_MODEL`, `JJK_AI_BASE_URL`) em
  `useEffect` dependente dos três estados.
- `handleRefreshProviderStatus` chama `validateProviderConnection({ provider: aiProvider, model: aiModel, baseUrl: customBaseUrl })`.
- Nos payloads de turno (`App.tsx:532` abertura e `App.tsx:665` continuidade) **acrescentar**:
  `provider: aiProvider, baseUrl: customBaseUrl` — e trocar o campo `model` (hoje
  `GeminiModelOption`) por `aiModel` (string). Atualizar `TurnRequestPayload` em
  `src/services/geminiService.ts` para aceitar `provider?: AiProviderId; baseUrl?: string`.
- O `model` atual (`App.tsx:239`, `GeminiModelOption`) **deixa de ser a fonte da verdade**
  para a narração; manter apenas para o resto da UI ou remover após verificar que nada
  mais depende dele (`grep -n "model" src/App.tsx`).

**4.2.3 — Verificação:**

```bash
npm run lint && npm run build
```

**Esperado:** ambos sem erro. Depois, `npm run dev` e abrir `http://localhost:3000` →
Configurações → a seção "Mestre de IA — provedor" aparece com os 4 provedores; trocar
para "NVIDIA NIM" e clicar "Testar conexão" **sem chave** deve mostrar
`MISSING` com mensagem "Nenhuma chave configurada para NVIDIA NIM." (ou `INVALID`
se a variável `NVIDIA_API_KEY` existir no ambiente).

**4.2.4 — Commit:**

```bash
git add -A && git commit -m "feat(front): seletor de provedor, modelo, base URL e chave nas Configuracoes"
```

---

### Task 4.3 — Indicador de provedor ativo na crônica

**Arquivos:** `src/components/ChatNarrativeStage.tsx`, `src/components/ChroniclePage.tsx`

**4.3.1 —** Propagar `usedProvider` (novo campo opcional em `GmTurnResponse`/`StreamTurnResult`)
desde `server.ts` (o handler já devolve `usedModel`; acrescentar `usedProvider: adapter.id`)
até a UI, e **exibir no HUD** algo como `Mestre: NVIDIA NIM · meta/llama-3.3-70b-instruct`.

**4.3.2 — Verificação:** `npm run lint && npm run build`; conferir visualmente em
`npm run dev` que o HUD mostra o provedor ativo após um turno.

**4.3.3 — Commit:**

```bash
git add -A && git commit -m "feat(front): HUD mostra o provedor de IA ativo do Mestre"
```

---

## Fase 5 — Configuração, documentação e verificação final

### Task 5.1 — Variáveis de ambiente e documentação

**Arquivos:** `.env.example`, `README.md`, `security_spec.md`

**5.1.1 — `.env.example`** — acrescentar:

```bash
# Provedores de IA alternativos (qualquer um serve; o Mestre usa o escolhido na UI).
OPENROUTER_API_KEY=""
NVIDIA_API_KEY=""
CUSTOM_AI_API_KEY=""
CUSTOM_AI_BASE_URL=""
CUSTOM_AI_MODEL=""
```

**5.1.2 — `README.md`** — nova seção "Provedores de IA do Mestre": tabela
(Provedor | Base URL | Variável de ambiente | Formato), explicação de que a chave da UI
(armazenada no `localStorage`) tem precedência sobre a variável de ambiente, que
**imagens continuam só no Gemini**, e o exemplo `curl` do endpoint `/api/ai/turn`.
Mencionar explicitamente que **a chave do Gemini vazada no histórico git deve ser
rotacionada** (pendência de segurança pré-existente).

**5.1.3 — `security_spec.md`** — registrar: (a) `baseUrl` customizada é validada
(esquema http/https, sem credenciais embutidas) para reduzir SSRF; (b) as chaves de
ambiente nunca são devolvidas pela API; (c) os novos endpoints `/api/ai/*` herdam o
rate limit e o bloqueio de origem cruzada de `/api/gemini/*`.

**5.1.4 — Commit:**

```bash
git add -A && git commit -m "docs: variaveis de ambiente e documentacao dos provedores de IA"
```

---

### Task 5.2 — Verificação final (gate de entrega)

**5.2.1 — Suíte + lint + build:**

```bash
npm test && npm run lint && npm run build
```

**Esperado:** `ℹ fail 0` (todos os testes novos e antigos verdes), `tsc --noEmit` sem
saída, `vite build` sem erro.

**5.2.2 — Smoke de turnos por provedor** (com chaves reais em `.env`/ambiente):

```bash
npm run dev
```

```bash
# a) OpenRouter
curl -s -X POST http://localhost:3000/api/ai/turn \
  -H 'Content-Type: application/json' -H 'x-custom-api-key: sk-or-...' \
  -d '{"provider":"openrouter","model":"openai/gpt-4o-mini","character":{"name":"Teste","technique":{"name":"X"}},"world":{"location":"Tóquio","arc":"Teste","activeBarrierOrDomain":"Nenhum","npcsInScene":[{"name":"Satoru Gojo","grade":"Especial","status":"calmo","attitude":"Neutro","visualDescription":"x"}]},"actionMode":"DO","actionText":"Cumprimento Gojo.","revealedHandVow":false,"ragContext":"","activeCards":[],"memoryContext":"","recentHistory":"","isOpening":false}' | head -c 500
```

**Esperado:** `"usedModel":"openai/gpt-4o-mini"`, `"usedProvider":"openrouter"` e
`data.narrative` com a fala do Gojo **no estilo do dossiê** (verificar manualmente:
vocabulário informal, "-kun", deboche leve — diferente do tom neutro de Gemini).

**5.2.3 — Repetir com `provider:"nvidia"` e `provider:"custom"`** (com `baseUrl` de um
servidor OpenAI‑compatível local, ex.: `http://localhost:11434/v1`).

**5.2.4 — Regressão do Gemini:** repetir o passo 5.2.2 com `provider:"gemini"` e conferir
que o comportamento e a qualidade **não regrediram** em relação ao baseline (mesma
estrutura JSON, mesmo fallback local quando a chave falta).

**5.2.5 — Verificar o prompt recebido** (opcional, mas recomendado): temporariamente
logar `systemInstruction.length` e `prompt.length` no handler de turno e confirmar que
o bloco `ELENCO CANÔNICO EM CENA` aparece no prompt quando há NPC canônico em cena e
**não** aparece quando não há. Remover o log antes do commit.

**5.2.6 — Commit final:**

```bash
git add -A && git commit -m "chore: verificacao final multi-provedor e biblia de personagens"
```

---

> ### ⚠️ Validação prévia (executada durante o planejamento)
>
> Todo o código novo deste plano foi **extraído para um projeto scratch e executado** antes
> de o plano ser gravado. Resultado: **31 testes, 31 passando, `tsc --noEmit` limpo**.
>
> **5 defeitos foram encontrados nessa validação e JÁ estão corrigidos neste documento.**
> Não repita-os:
>
> 1. `loreStore.matchCharacterNames` casava apenas o nome **completo** normalizado
>    (`satoru gojo`), então o texto `"O Gojo observa..."` não encontrava o verbete.
>    → Corrigido com `characterNameTokens()` (nome completo + primeiro+sobrenome +
>    sobrenome isolado, com guarda para títulos que contêm `/` ou `—`, como
>    "Toji Fushiguro / Nascido Toji Zenin", que dariam falso positivo em "Zenin").
> 2. O teste de `openaiCompatible` exigia `messages[1].content === 'USERPROMPT'`, mas o
>    adaptador **anexa o schema e a instrução de JSON** ao prompt do usuário (comportamento
>    correto e necessário). → O teste passou a usar `.startsWith('USERPROMPT')`.
> 3. `turnPrompt.ts` precisa de `export` em `withoutKeys`, `renderArcContract`,
>    `firstSceneLine` e `buildTurnPrompt` — no `server.ts` original elas são privadas.
>    Sem `export`, o import e o teste falham com
>    *"does not provide an export named 'buildTurnPrompt'"*.
> 4. `ArcContractWorld` precisa ser **movida** (e exportada) para
>    `src/server/prompts/turnPrompt.ts`, porque `buildDynamicFallback()` no `server.ts`
>    continua usando esse tipo.
> 5. `gmSystemPrompt.ts` precisa de `GM_SYSTEM_INSTRUCTION_EXTENSIONS` como constante
>    separada: o teste de `gmSystemPrompt.test.ts` verifica as seções 10, 11 e 12, que
>    **não** existem em `GM_SYSTEM_INSTRUCTION_BASE` (que fica idêntico ao original).
>
> As extrações de `buildTurnPrompt`/`renderArcContract`/`firstSceneLine`/`withoutKeys` e de
> `SYSTEM_INSTRUCTION_GM` foram comparadas **byte a byte** com o `server.ts` original:
> idênticas, exceto pelo prefixo `export` e pelo nome da constante.

## Tests / validation (resumo)

| Camada | Arquivo | Foco |
|---|---|---|
| Utilitários JSON | `src/server/ai/jsonExtract.test.ts` | extração/reparo de JSON de respostas de LLM |
| Lore store | `src/server/lore/loreStore.test.ts` | busca de verbete por personagem, match por menção |
| Prompt do Mestre | `src/server/prompts/turnPrompt.test.ts` | contrato do arco, era, prompts de abertura/continuidade |
| Prompt do Mestre | `src/server/prompts/gmSystemPrompt.test.ts` | seções novas + injeção do dossiê |
| Bíblia | `src/server/prompts/characterBible.test.ts` | integridade dos dossiês, aliases, cobertura do elenco |
| Elenco | `src/server/prompts/castContext.test.ts` | dossiê + verbete do Codex por NPC em cena |
| Registro | `src/server/ai/registry.test.ts` | presets, baseUrl, precedência de chave |
| Adaptador OAI | `src/server/ai/openaiCompatible.test.ts` | corpo da requisição, Bearer, 401, SSE |
| Adaptador Gemini | `src/server/ai/geminiProvider.test.ts` | geração e validação via SDK |
| Fábrica | `src/server/ai/factory.test.ts` | resolução provedor→adaptador |
| Front | `src/services/aiService.test.ts` | payload e headers de `/api/ai/validate` |
| Regressão | `src/utils/jjkEngine.test.ts`, `src/services/geminiService.stream.test.ts` | existentes, intocados |

**Ciclo TDD por task:** escrever o teste → rodar e ver **RED** (falha por módulo/asserção
ausente) → implementar o mínimo → rodar e ver **GREEN** → `npm run lint` → `npm test`
→ `git commit`. Nunca commitar com a suíte vermelha.

**Comandos canônicos:**

```bash
npm test        # tsx --test "src/**/*.test.ts"  → ℹ fail 0
npm run lint    # tsc --noEmit                  → sem saída
npm run build   # vite build                    → sem erro
```

---

## Risks, tradeoffs, and open questions

**Riscos**

1. **Provedores não OpenAI-compatíveis "falsos"**: alguns gateways aceitam `/chat/completions`
   mas ignoram `response_format`. Mitigação: fallback automático `json_schema` → `json_object`
   + schema no prompt + `parseJsonObject` tolerante. **Risco residual:** o modelo pode devolver
   JSON com campos faltando → o turno cai no motor local de continuidade (comportamento já
   existente, sem quebrar a campanha).
2. **Diferença de qualidade narrativa entre provedores**: modelos menores/gratis (NIM,
   Llama 3.3 70B) podem narrar pior que o Gemini. Mitigação: a UI mostra o provedor ativo e o
   `usedModel`; o fallback automático para Gemini no erro continua existindo. **Não prometer
   paridade de qualidade.**
3. **Custo/latência**: providers pagados (OpenRouter com modelos pagos) geram custo real a cada
   turno. O rate limit atual (20 turnos/min) **não protege orçamento**. Decidir se os limites
   por provedor devem ser menores para providers pagos — **questão em aberto para o usuário**.
4. **Prompt maior → custo de tokens**: dossiês + verbetes ampliados aumentam o prompt por turno
   (de ~10 KB para ~30–40 KB). Mitigação: `maxDossiers=4`, corte de 2 000 chars/verbete,
   dossiê só para personagens **em cena**. Medir na Task 3.6.
5. **Vazamento de chave no browser**: a chave do provider fica no `localStorage` (mesmo padrão
   já usado para o Gemini). Aceitável para app local/Cloud Run com `APP_ACCESS_CODE`, mas é
   exposição XSS-se a chave for de um provider pago. **Questão em aberto**: chave por provider
   apenas no servidor (sem override do browser)?
6. **SSRF via `baseUrl` customizada**: o servidor faz fetch na URL informada pelo usuário.
   Mitigação: `normalizeBaseUrl` aceita apenas http/https e rejeita credenciais embutidas.
   Restrição por allowlist seria mais forte, mas limitaria Ollama/LM Studio locais.
7. **Regressão do Gemini**: a extração do monólito pode mudar comportamento sutil (ex.: ordem de
   campos, tratamento de erro). Mitigação: Tasks 1.1–1.3 são **extrações literais** com a suíte
   existente como rede de segurança, e a Task 5.2.4 compara o resultado com o baseline.
8. **Node 22 no Docker vs Node 24 local**: o glob do `--test` precisa funcionar no
   `node:22-bookworm-slim`. Mitigação: a Task 0.1 valida o glob localmente; **verificar também
   dentro do container** (`docker build -t jjk . && docker run --rm -p 8080:8080 jjk npm test`).
9. **Rotacionar a chave Gemini vazada no histórico git** — pendência de segurança pré-existente,
   fora do escopo funcional, mas deve ser feita.

**Tradeoffs**

- **Adaptador único OpenAI-compatível** (OpenRouter + NIM + custom) em vez de um adaptador por
  provedor: menos código, mesma cobertura; custo:OpenRouter exige headers extras
  (`HTTP-Referer`/`X-Title`) e NIM tem nomes de modelo próprios — resolvido no preset.
- **Não usar o OpenCode CLI como bridge**: HTTP é testável, stateless e funciona em Cloud Run;
  subprocesso não.
- **Manter `src/services/geminiService.ts`** em vez de renomear para `aiService.ts`: evita tocar
  4 componentes; custo: dois nomes de serviço convivem (documentado no código).
- **Dossiês curados à mão** em vez de gerar do `Codex.md`: mais trabalho inicial, mas qualidade
  de voz controlável e testável — o Codex continua sendo a fonte de **fatos**, o dossiê a de
  **voz**.
- **Não renomear as rotas existentes**: aliases `/api/gemini/*` + novas `/api/ai/*` mantêm
  `scripts/test-opening.ts` e qualquer integração externa funcionando.

**Perguntas em aberto**

1. **Orçamento/cota**: qual limite de requisições por minuto e por hora aplicar a providers
   pagos (OpenRouter)? Hoje o limite é genérico (20/min).
2. **Chave no browser**: manter o override por provider no `localStorage` ou passar a exigir
   chave apenas no servidor (`.env`/Secrets) para providers pagos?
3. **Imagens em providers externos**: aceitar que a ilustração da cena só sai do Gemini
   (recomendado) ou desabilitar a ilustração quando o provedor ativo não for Gemini?
4. **Escopo do elenco**: 24 dossiês cobrem o elenco principal; falta o elenco de **maldições**
   (Jogo do Abate: Jogo, Hanami, Eso, Choso…), os **Nine Elders**, os **Feiticeiros Antigos**
   (Yorozu, Kenjaku antigo) e **clãs menores**. Ampliar para ~50 é trabalho extra (≈2–3 h de
   escrita + revisão PT-BR).
5. **Modo "offline"**: o motor local de continuidade (`buildDynamicFallback`) hoje é genérico.
   Com a bíblia, vale a pena ele **também** narrar com o dossiê do NPC (roteiros por personagem)?
   Isso é uma fase separada.
6. **`Prompt_Mestre_RPG.md` e `Prompt_Site_RPG_AI_Studio_Build.md`** (raiz) são documentos
   antigos de prompt: devem ser atualizados para refletir o prompt real (que passou a ser
   **composto em runtime**), ou marcados como históricos?

---

## Ordem de execução resumida

```
0.1 baseline/glob
1.1 jsonExtract+types+schema   → 1.2 loreStore  → 1.3 prompt/contracto
2.1 registry+errors             → 2.2 openaiCompatible → 2.3 gemini → 2.4 wiring + aliases
3.1 biblia (tipo+matcher+3)    → 3.2 elenco p1 → 3.3 elenco p2
3.4 castContext                 → 3.5 prompt ampliado → 3.6 reforço do RAG
4.1 tipos+aiService             → 4.2 Settings      → 4.3 HUD do provedor
5.1 env+docs                    → 5.2 gate final
```

Cada task é um commit. Nada avança com a suíte vermelha.
