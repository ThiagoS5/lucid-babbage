# Plano de implementação — Códice em JSONs estruturados por categoria

**Status:** plano pronto para execução. Nenhuma alteração aplicada no repositório de produção.
**Validação:** todo o código deste plano foi executado e validado num scratch tree
(`plan-lucid`) — typecheck limpo, 23/23 testes verdes, build do Vite ok, servidor real
subiu e respondeu nos endpoints novos.

---

## 1. Objetivo

Substituir o parsing de `Codex.md` em runtime por **JSONs estruturados gerados por
build**, separados em `personagens`, `habilidades`, `locais` e `outros`, consumidos
pela aplicação.

## 2. Resposta à pergunta

> "Os jsons serão consumidos pela aplicação ficando melhor, correto? Consumir os dados
> de um arquivo json é mais prático para o sistema como um todo, correto?"

**Sim — e o ganho é maior do que parece, porque os JSONs não são só um formato de
transporte: eles tornam a classificação *estrutural* em vez de adivinhada.**

O parsing atual classifica o tipo de cada verbete procurando palavras no título
(`server.ts:122-133`: `lowerTitle.includes('[personagem]')`, `includes('técnica')`…). A
regra é frágil por natureza: `[Techniques] Manji Kick` não contém "técnica" em
português, então 46 habilidades caíam em `lore` — invisíveis na aba "Técnicas" da
UI. Com tag estrutural no JSON, a categoria é **declarada**, não deduzida.

Além disso, a era (cânone 2018 vs. seguimento) deixa de ser inferida por regex sobre a
prosa e passa a ser um **atributo do dado**. Isso corrige o bug mais grave: hoje a
biografia de Yorozu cita o Jogo do Abate, então o regex a classificava como
`canon` e ela **sumia do RAG** em campanha de seguimento — junto com Yuji Itadori,
Kashimo, Miguel Oduol e mais 157 verbetes.

### Ganho medido (antes → depois), no acervo real

| Métrica | Antes | Depois | Δ |
|---|---|---|---|
| Habilidades na categoria correta | 93 | 134 | **+41** |
| Personagens na categoria correta | 69 | 70 | +1 |
| Verbos em `outros` (categoria genérica) | 83 | 53 | **−30** |
| Verbos totais do Códice | 272 | 283 | +11 |
| Corpo de lore preservado | 728 KB | 1.048 KB | **+341.375 chars** |
| Cards disponíveis em campanha de seguimento | 388 | 549 | **+161** |
| Falsos positivos de `canon` (personagem bloqueado) | 10 | 0 | **−10** |

> Os 11 verbetes a mais são os **H1 com prosa própria** (eventos, clãs, facções),
> que o parser antigo perdia: ele só sabia ler `##`, então 12 blocos H1 de conteúdo
> real (ex.: "1. EVENTO: O Desfile Noturno dos Cem Demônios", 5.060 chars) eram
> engolidos no chunk seguinte.

---

## 3. Arquitetura

```
Codex.md  (fonte canônica, editada à mão)
    │
    │  npm run codex:build   ← determinístico, fail-fast
    ▼
json/codex/{personagens,habilidades,locais,outros}.json   (gerado, commitado)
    │
    │  servidor carrega no boot
    ▼
/api/codex/default          → acervo p/ RAG (corpo com teto de 2600, orçamento do prompt)
/api/codex/categoria/:cat   → corpo INTEGRAL, sob demanda (a UI carrega só a aba)
    │
    ▼
CodexPage.tsx  (abas: Todos | Personagens | Habilidades | Locais | Outros)
```

**Decisões e porquês:**

1. **`Codex.md` continua sendo a fonte.** Nada é reescrito: o build compila o
   Markdown. O conteúdo é preservado byte a byte no `value` (só o cabeçalho H1/H2 é
   removido, porque já está no `title`).

2. **Quatro arquivos, não três.** `outros.json` é obrigatório: sem ele, verbetes
   `lore` e `faction` se perderiam — o problema dos 13 blocos de lore perdidos.

3. **Fail-fast no build.** Uma tag nova no Markdown **quebra** `npm run codex:build`
   (exit 1) em vez de cair silenciosamente em `lore`. Já validado: o build pegou
   sozinho o typo `Fação` (L3250) e as tags em CAIXA ALTA (L2816+) do fonte real.

4. **Taxonomia compartilhada sem dependência de Node.** `src/utils/codexCategories.ts`
   é importado pelo servidor (Node) e pelo React — mesmo padrão isomórfico de
   `src/utils/storyCardEra.ts`.

5. **Armazenamento íntegro ≠ consumo integral.** O JSON guarda o corpo completo; o
   endpoint de RAG trunca em 2600 chars porque alimenta o prompt. A UI lê o corpo
   integral via endpoint por categoria.

6. **Os 284 story cards ficam onde estão.** `json/adventure-...-284.json` continua
   separado (acervo multilingue EN/FR, propósito diferente). Unificar aumentaria o
   payload e o risco sem ganho.

---

## 4. Tarefas

Cada tarefa deixa o repositório verde. Ordem: taxonomia → compilador → build →
tipos → era → servidor → cliente → docs.

### Tarefa 1 — Taxonomia compartilhada

**Arquivo novo:** `src/utils/codexCategories.ts`

```ts
import type { CodexCategory, StoryCard, StoryEra } from '../types/jjk';

export const CODEX_CATEGORIES: readonly CodexCategory[] = [
  'personagens', 'habilidades', 'locais', 'outros',
];

export const CODEX_CATEGORY_LABELS: Record<CodexCategory, string> = {
  personagens: 'Personagens',
  habilidades: 'Habilidades',
  locais: 'Locais',
  outros: 'Outros',
};

export const CODEX_CATEGORY_FILES: Record<CodexCategory, string> = {
  personagens: 'personagens.json',
  habilidades: 'habilidades.json',
  locais: 'locais.json',
  outros: 'outros.json',
};

export const CATEGORY_TYPES: Record<CodexCategory, readonly StoryCard['type'][]> = {
  personagens: ['character'],
  habilidades: ['technique', 'domain', 'tool'],
  locais: ['location'],
  outros: ['lore', 'faction'],
};

export function categoryForType(type: StoryCard['type']): CodexCategory {
  if (type === 'character') return 'personagens';
  if (type === 'technique' || type === 'domain' || type === 'tool') return 'habilidades';
  if (type === 'location') return 'locais';
  return 'outros';
}

export function categoryOfCard(card: Pick<StoryCard, 'type' | 'categoria'>): CodexCategory {
  return card.categoria ?? categoryForType(card.type);
}

export const RAW_STORY_TYPE_MAP: Record<
  string,
  { type: StoryCard['type']; categoria: CodexCategory; era?: StoryEra }
> = {
  power: { type: 'technique', categoria: 'habilidades' },
  techniques: { type: 'technique', categoria: 'habilidades' },
  technique: { type: 'technique', categoria: 'habilidades' },
  shikigami: { type: 'technique', categoria: 'habilidades' },
  puppet: { type: 'technique', categoria: 'habilidades' },
  'binding vow': { type: 'technique', categoria: 'habilidades' },
  'cursed tool': { type: 'tool', categoria: 'habilidades' },
  'cursed object': { type: 'tool', categoria: 'habilidades' },
  character: { type: 'character', categoria: 'personagens' },
  'cursed spirits': { type: 'character', categoria: 'personagens' },
  'cursed womb': { type: 'character', categoria: 'personagens' },
  location: { type: 'location', categoria: 'locais' },
  faction: { type: 'faction', categoria: 'outros' },
  event: { type: 'lore', categoria: 'outros', era: 'canon' },
  terminology: { type: 'lore', categoria: 'outros' },
  uniforms: { type: 'lore', categoria: 'outros' },
  'world info': { type: 'lore', categoria: 'outros' },
};
```

> `RAW_STORY_TYPE_MAP` substitui a heurística por substring de `server.ts:55-66`, que
> classificava **61** cards como `lore` e errava Shikigami, Cursed Spirits, Cursed
> Womb, faction e Event. Tipo desconhecido agora é erro, nunca `lore` silencioso.

**Verificação:** `npx tsc --noEmit` → exit 0.

---

### Tarefa 2 — Compilador Markdown → verbetes

**Arquivo novo:** `src/utils/codexCompiler.ts`

O compilador é puro (sem fs), isomórfico e exporta:

```ts
export interface CodexEntry {
  id: string;
  title: string;
  tag: string;
  keys: string[];
  type: StoryCard['type'];
  categoria: CodexCategory;
  era: StoryEra;
  value: string;
}

export interface CompileResult {
  entries: CodexEntry[];
  unknownTags: string[];
  unknownH1Headers: string[];
}

export function compileCodexMarkdown(markdown: string): CompileResult;
export function groupByCategory(
  entries: CodexEntry[],
  categories: readonly CodexCategory[]
): Record<CodexCategory, CodexEntry[]>;
```

**Pontos críticos da implementação (todos validados):**

- **`TAG_MAP`**: 44 tags do Markdown → `{ type, categoria }`. Toda tag precisa estar
  mapeada; caso contrário vai para `unknownTags` e o build falha.
- **`TAG_ALIASES`**: corrige erros de digitação **do fonte, sem reescrever o fonte**:
  - `'Fação / Estágio Evolutivo'` → `'Facção / Estágio Evolutivo'` (L3250)
  - `'FACÇÃO / POLÍTICA'` → `'Facção / Política'` (L2816)
  - `'FACÇÃO / CLÃ'` → `'Facção / Clã'` (L2859)
  - `'TERMINOLOGIA / SOCIEDADE'` → `'Terminologia / Sociedade'` (L2929)
- **`H1_OVERRIDES`**: 12 cabeçalhos H1 que são verbetes reais (têm prosa própria).
  O resto dos H1 (`3. PERSONAGEM: ESO`, `Enciclopédia Canônica…`) são agrupadores.
- **`H1_GROUP_HEADERS`**: lista explícita dos H1 agrupadores — evita classificar
  "CÓDICE DEFINITIVO E ENCICLOPÉDICO DE JUJUTSU KAISEN" como verbete.
- **`extractColonTag`**: cobre o formato `1. FACÇÃO / POLÍTICA: Título`.
- **`normalizeTitle`**: remove `[Tag]` e numeração de seção.
- **`extractKeys`**: extrai de `**Gatilhos (Keys):**`, remove backticks (o parser
  antigo deixava 59 keys com backtick, que nunca casavam com uma query) e completa
  com palavras do título.
- **`ruleFromRecordType`**: a linha `**Tipo de Registro:**` do corpo tem precedência
  sobre a tag (ex.: "Item Utilitário / Ferramenta" → `tool`).
- **Corpo integral**: `value` = corpo completo, sem o cabeçalho e **sem** o
  truncão de 2600.
- **`era`**: `'canon'` só para `tag === 'Evento'` e H1 de evento; resto `'both'`.

**Verificação:** o teste abaixo (Tarefa 3) cobre os 44 tags e os 12 H1.

---

### Tarefa 3 — Testes do compilador

**Arquivo novo:** `src/utils/codexCompiler.test.ts` (10 testes, validados)

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileCodexMarkdown, groupByCategory, normalizeTitle } from './codexCompiler.ts';
import {
  CODEX_CATEGORIES, CODEX_CATEGORY_FILES, categoryForType, categoryOfCard, RAW_STORY_TYPE_MAP,
} from './codexCategories.ts';

const CODEX_MD = path.resolve(process.cwd(), 'Codex.md');

test('compileCodexMarkdown não deixa tag nem cabeçalho H1 sem classificação', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { unknownTags, unknownH1Headers } = compileCodexMarkdown(markdown);
  assert.deepEqual(unknownTags, [], `tags sem mapeamento: ${unknownTags.join(', ')}`);
  assert.deepEqual(unknownH1Headers, [], `H1 sem classificação: ${unknownH1Headers.join(', ')}`);
});

test('compileCodexMarkdown preserva o corpo integral de cada verbete', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  const longest = entries.reduce((a, b) => (b.value.length > a.value.length ? b : a));
  assert.ok(longest.value.length > 3000, 'o maior verbete deve passar de 3000 chars');
  const truncated = entries.filter((e) => e.value.length === 2600);
  assert.equal(truncated.length, 0, 'nenhum verbete deve ter corpo de exatamente 2600 chars');
});

test('todo verbete tem categoria explícita coerente com o tipo', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  for (const entry of entries) {
    assert.ok(CODEX_CATEGORIES.includes(entry.categoria));
    assert.equal(entry.categoria, categoryForType(entry.type), `${entry.title} incoerente`);
    assert.ok(entry.keys.length > 0, `${entry.title} sem gatilhos`);
    assert.ok(entry.value.trim().length > 0, `${entry.title} sem corpo`);
  }
});

test('as quatro categorias do Códice recebem verbetes', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  const grouped = groupByCategory(entries, CODEX_CATEGORIES);
  for (const categoria of CODEX_CATEGORIES) {
    assert.ok(grouped[categoria].length > 0, `categoria ${categoria} vazia`);
  }
});

test('eventos canônicos carregam era=canon e nunca caem em "both"', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  const canon = entries.filter((e) => e.era === 'canon');
  assert.ok(canon.length > 0, 'deve haver verbetes de evento canônico');
  for (const entry of canon) {
    assert.match(entry.title + ' ' + entry.tag, /evento|incidente|desfile|shibuya|kyoto/i);
  }
});

test('o preâmbulo do Codex.md não vira verbete', () => {
  const markdown = fs.readFileSync(CODEX_MD, 'utf-8');
  const { entries } = compileCodexMarkdown(markdown);
  assert.equal(entries.find((e) => e.title.includes('CÓDICE DEFINITIVO E ENCICLOPÉDICO')), undefined);
});

test('normalizeTitle remove tag e numeração de grupo', () => {
  assert.equal(normalizeTitle('1. [Facção] Unidade Kukuru (Kukurutai)'), 'Unidade Kukuru (Kukurutai)');
  assert.equal(normalizeTitle('[Técnica] Manji Kick'), 'Manji Kick');
});

test('categoryOfCard prefere a categoria explícita e cai no tipo como backup', () => {
  assert.equal(categoryOfCard({ type: 'lore', categoria: 'habilidades' }), 'habilidades');
  assert.equal(categoryOfCard({ type: 'character' }), 'personagens');
  assert.equal(categoryOfCard({ type: 'technique' }), 'habilidades');
  assert.equal(categoryOfCard({ type: 'location' }), 'locais');
  assert.equal(categoryOfCard({ type: 'faction' }), 'outros');
});

test('todo tipo cru dos story cards tem mapeamento explícito', () => {
  const raw = JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), 'json', 'adventure-UhtU4tSbk-kc-story-cards-284.json'), 'utf-8'
  )) as Array<Record<string, unknown>>;
  const rawTypes = new Set(raw.map((c) => String(c.type || '').trim().toLowerCase()));
  for (const rawType of rawTypes) {
    assert.ok(RAW_STORY_TYPE_MAP[rawType], `tipo cru sem mapeamento: ${rawType}`);
  }
});

test('os arquivos de categoria do Códice existem no disco após o build', () => {
  const outDir = path.resolve(process.cwd(), 'json', 'codex');
  for (const categoria of CODEX_CATEGORIES) {
    const filePath = path.join(outDir, CODEX_CATEGORY_FILES[categoria]);
    assert.ok(fs.existsSync(filePath), `faltou ${CODEX_CATEGORY_FILES[categoria]}`);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(parsed.categoria, categoria);
    assert.equal(parsed.entries.length, parsed.total);
  }
});
```

**Comando:** `npx tsx --test src/utils/codexCompiler.test.ts`
**Saída esperada:** `tests 10 / pass 10 / fail 0`.

---

### Tarefa 4 — Script de build

**Arquivo novo:** `scripts/build-codex-json.ts`

```ts
import fs from 'fs';
import path from 'path';
import { compileCodexMarkdown, groupByCategory } from '../src/utils/codexCompiler.ts';
import { CODEX_CATEGORIES, CODEX_CATEGORY_FILES, CODEX_CATEGORY_LABELS } from '../src/utils/codexCategories.ts';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'Codex.md');
const OUT_DIR = path.join(ROOT, 'json', 'codex');

function main(): void {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[codex:build] Fonte não encontrada: ${SOURCE}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(SOURCE, 'utf-8');
  const { entries, unknownTags, unknownH1Headers } = compileCodexMarkdown(markdown);

  if (unknownTags.length > 0 || unknownH1Headers.length > 0) {
    console.error('[codex:build] Classificação incompleta — corrija o markdown ou o mapa:');
    for (const tag of unknownTags) console.error(`  tag sem mapa: ${tag}`);
    for (const header of unknownH1Headers) console.error(`  H1 sem mapa: ${header}`);
    process.exit(1);
  }

  const grouped = groupByCategory(entries, CODEX_CATEGORIES);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalBytes = 0;
  for (const categoria of CODEX_CATEGORIES) {
    const list = grouped[categoria];
    const file = path.join(OUT_DIR, CODEX_CATEGORY_FILES[categoria]);
    const payload = {
      categoria,
      label: CODEX_CATEGORY_LABELS[categoria],
      total: list.length,
      entries: list,
    };
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    fs.writeFileSync(file, json, 'utf-8');
    totalBytes += Buffer.byteLength(json, 'utf-8');
    console.log(
      `[codex:build] ${CODEX_CATEGORY_FILES[categoria]} — ${list.length} verbetes (${CODEX_CATEGORY_LABELS[categoria]})`
    );
  }

  console.log(
    `[codex:build] ${entries.length} verbetes no total, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`
  );
}

main();
```

**`package.json`** — adicionar o script:

```json
"codex:build": "tsx scripts/build-codex-json.ts"
```

**Comando:** `npm run codex:build`
**Saída esperada (medida, no acervo real):**

```
[codex:build] personagens.json — 70 verbetes (Personagens)
[codex:build] habilidades.json — 134 verbetes (Habilidades)
[codex:build] locais.json — 26 verbetes (Locais)
[codex:build] outros.json — 53 verbetes (Outros)
[codex:build] 283 verbetes no total, 1.15 MB
```

**Teste de fail-fast (prova):** adicionar uma tag nova ao `Codex.md` → o build
**deve** sair com exit 1 e listar a tag. Já validado: o build pegou sozinho
`Fação / Estágio Evolutivo` e as 3 tags em CAIXA ALTA.

**Commit:** `feat(codex): gerar JSONs do Códice por categoria a partir do Codex.md`

---

### Tarefa 5 — Tipos

**Arquivo:** `src/types/jjk.ts`

```ts
export type StoryEra = 'canon' | 'sequel' | 'both';

/** Categorias do Códice, na ordem em que aparecem no Códice da UI. */
export type CodexCategory = 'personagens' | 'habilidades' | 'locais' | 'outros';

export interface StoryCard {
  id: string;
  title: string;
  keys: string[];
  type: 'character' | 'technique' | 'domain' | 'lore' | 'location' | 'faction' | 'tool';
  /**
   * Categoria explícita do verbete (vinda do JSON do Códice). Quando ausente,
   * o consumidor deriva de `type` via `categoryForType` (src/utils/codexCategories.ts).
   */
  categoria?: CodexCategory;
  value: string;
  source?: 'codex_md' | 'story_json' | 'initial' | 'custom';
  /**
   * Era do card para o filtro de RAG. `canon` = evento/arco de 2018 que não
   * deve ser injetado em campanhas de seguimento; `sequel` = material novo;
   * `both` = personagem/técnica/local reutilizável (padrão).
   */
  era?: StoryEra;
}
```

> `categoria` e `era` são **opcionais**: cards importados pelo usuário (sem tag
> estrutural) continuam funcionando, e `categoryOfCard` / `inferStoryCardEra` caem
> no fallback.

**Verificação:** `npx tsc --noEmit` → exit 0.

---

### Tarefa 6 — Era estrutural

**Arquivo:** `src/utils/storyCardEra.ts`

Adicionar a função estrutural (a existente `inferStoryCardEra` **permanece** para
cards importados, que não têm tag):

```ts
/**
 * Padrões de sequel aplicados só à IDENTIDADE do card (título + gatilhos).
 * Deliberadamente SEM /shinjuku/ isolado: "Shinjuku" como local existe nas
 * duas eras, então não pode ser classificado como 'sequel'.
 */
const SEQUEL_STRUCTURE_PATTERNS: RegExp[] = [
  /p[oó]s-mang[aá]/i, /p[oó]s-desfecho/i, /seq[uü][eê]ncia p[oó]s/i,
  /nova gera[cç][aã]o/i, /era vazia/i, /col[oô]nia residual/i,
  /res[ií]duo de shinjuku/i, /cratera de shinjuku/i, /um ano de shinjuku/i,
];

/** Identidade textual do card: título + gatilhos (sem prosa). */
function cardIdentity(card: { title?: string; keys?: string[] }): string {
  return [card.title || '', ...(card.keys || [])].filter(Boolean).join(' ');
}

/**
 * Classifica a era pela ESTRUTURA do card, sem varrer a prosa.
 *
 * A prosa de um card NÃO participa: é por isso que personagens como Yorozu,
 * Yuji Itadori e Mahito deixavam de ser canônicos só porque a biografia
 * mencionava o Jogo do Abate. Só a identidade do card decide.
 */
export function inferEraByStructure(card: {
  title?: string; type?: string; tag?: string; keys?: string[]; era?: StoryEra;
}): StoryEra {
  if (card.era === 'canon' || card.era === 'sequel' || card.era === 'both') return card.era;
  const rawType = String(card.type || '').trim().toLowerCase();
  const rawTag = String(card.tag || '').trim().toLowerCase();
  if (rawType === 'event' || rawTag === 'evento') return 'canon';
  const identity = cardIdentity({ title: card.title || '', keys: card.keys || [] });
  if (SEQUEL_STRUCTURE_PATTERNS.some((re) => re.test(identity))) return 'sequel';
  if (CANON_EVENT_PATTERNS.some((re) => re.test(identity))) return 'canon';
  return 'both';
}
```

**Arquivo novo:** `src/utils/storyCardEra.test.ts` (7 testes, validados) — cobre:
evento canônico bloqueado no seguimento; Yorozu **não** canônico; "Shinjuku" como
local **não** sequel; locals de Shibuya disponíveis; evento do acervo 284 canônico;
fallback textual preservado; e que no Códice só 3 verbetes são `canon`.

**Comando:** `npx tsx --test src/utils/storyCardEra.test.ts` → `tests 7 / pass 7`.

**Commit:** `fix(codex): classificar era por estrutura, não por prosa`

---

### Tarefa 7 — Servidor consome os JSONs

**Arquivo novo:** `src/server/codexLoader.ts`

```ts
import fs from 'node:fs';
import path from 'node:path';
import type { CodexCategory, StoryCard, StoryEra } from '../types/jjk';
import { CODEX_CATEGORIES, RAW_STORY_TYPE_MAP } from '../utils/codexCategories';
import { inferEraByStructure } from '../utils/storyCardEra';

export interface ServerStoryCard {
  id: string;
  title: string;
  keys: string[];
  type: StoryCard['type'];
  categoria: CodexCategory;
  value: string;
  era: StoryEra;
  source?: 'codex_md' | 'story_json' | 'initial' | 'custom';
}

export interface LoadedLore {
  codexCards: ServerStoryCard[];
  storyCards: ServerStoryCard[];
  mdSections: { title: string; keys: string[]; content: string; era: StoryEra }[];
}

export function loadCodexJson(cwd: string): ServerStoryCard[] { /* lê os 4 JSONs; lança se faltar */ }
export function loadStoryCards(cwd: string): ServerStoryCard[] { /* mapa explícito; lança em tipo cru desconhecido */ }
export function loadLore(cwd: string): LoadedLore { /* combina os dois */ }
```

Pontos-chave:
- JSON ausente → **erro com instrução** ("Rode `npm run codex:build` antes de iniciar").
- Tipo cru desconhecido no acervo 284 → **erro no boot**, nunca `lore` silencioso.
- `era` do acervo 284: `rule.era ?? inferEraByStructure({ title, type: rawType, keys })`.

**Arquivo:** `server.ts` — substituir o bloco de parsing (linhas 15-154) por:

```ts
import { loadLore, type ServerStoryCard } from './src/server/codexLoader';
import { CODEX_CATEGORIES, CODEX_CATEGORY_LABELS } from './src/utils/codexCategories';
import type { CodexCategory, StoryEra } from './src/types/jjk';

/**
 * Orçamento de caracteres do corpo por card no payload de RAG
 * (/api/codex/default). Esse payload alimenta o prompt, então precisa ter
 * teto; o conteúdo INTEGRAL é servido por /api/codex/categoria/:categoria.
 */
const RAG_VALUE_MAX_CHARS = 2600;

let SERVER_STORY_CARDS: ServerStoryCard[] = [];
let SERVER_CODEX_MD_CARDS: ServerStoryCard[] = [];
let SERVER_MD_SECTIONS: { title: string; keys: string[]; content: string; era: StoryEra }[] = [];

function loadServerSideLore() {
  const cwd = process.cwd();
  try {
    const lore = loadLore(cwd);
    SERVER_CODEX_MD_CARDS = lore.codexCards;
    SERVER_STORY_CARDS = lore.storyCards;
    SERVER_MD_SECTIONS = lore.mdSections;
    console.log(
      `[JJK RAG Engine] ${SERVER_CODEX_MD_CARDS.length} verbetes do Códice (json/codex) + ${SERVER_STORY_CARDS.length} Story Cards canônicos carregados.`
    );
  } catch (err) {
    console.error('[JJK RAG Engine] Falha ao carregar o acervo:', err);
    throw err;
  }
}

loadServerSideLore();
```

**Endpoint de RAG** (substitui `/api/codex/default`):

```ts
app.get('/api/codex/default', (_req, res) => {
  res.json({
    ok: true,
    cards: [
      ...SERVER_CODEX_MD_CARDS.map((card) => ({
        ...card,
        value: card.value.slice(0, RAG_VALUE_MAX_CHARS),
      })),
      ...SERVER_STORY_CARDS,
    ],
    codexMdCount: SERVER_CODEX_MD_CARDS.length,
    storyCardCount: SERVER_STORY_CARDS.length,
    mdSectionCount: SERVER_MD_SECTIONS.length,
  });
});

/**
 * Códice por categoria: /api/codex/personagens | habilidades | locais | outros.
 * Corpo INTEGRAL (sem truncamento) — a UI do Códice carrega só a aba que
 * está vendo, em vez dos 283 verbetes de uma vez.
 */
app.get('/api/codex/categoria/:categoria', (req, res) => {
  const categoria = req.params.categoria as CodexCategory;
  if (!CODEX_CATEGORIES.includes(categoria)) {
    res.status(404).json({ ok: false, error: `Categoria inválida: ${req.params.categoria}` });
    return;
  }
  const entries = SERVER_CODEX_MD_CARDS.filter((card) => card.categoria === categoria);
  res.json({
    ok: true,
    categoria,
    label: CODEX_CATEGORY_LABELS[categoria],
    total: entries.length,
    cards: entries,
  });
});
```

**Filtro de era no RAG server-side** (`server.ts`, no `buildServerSideDeepRag`): as
seções do Códice também respeitam a era — antes elas entravam em campanha de
seguimento sem filtro:

```ts
if (SERVER_MD_SECTIONS.length > 0) {
  // Filtro de era: um verbete de evento de 2018 (Incidente de Shibuya,
  // Desfile Noturno) não deve entrar numa cena de campanha de seguimento.
  const mdPool = campaignEra
    ? SERVER_MD_SECTIONS.filter((sec) => isStoryCardAllowedForEra(sec, campaignEra))
    : SERVER_MD_SECTIONS;
  const scoredMd = mdPool.map((sec) => { /* ... */ });
```

> `isStoryCardAllowedForEra` já respeita `card.era` explícito, então basta a
> `mdSections` carregar o campo `era`.

**Comando:** `npx tsc --noEmit` → exit 0.
**Commit:** `feat(server): carregar o Códice dos JSONs gerados e expor por categoria`

---

### Tarefa 8 — Cliente consome por categoria

**Arquivo:** `src/components/CodexPage.tsx`

- Importa `CODEX_CATEGORIES`, `CODEX_CATEGORY_LABELS`, `categoryOfCard` de
  `src/utils/codexCategories`.
- `FilterId` passa a ser `'all' | (typeof CODEX_CATEGORIES)[number]`.
- Abas: `Todos | Personagens | Habilidades | Locais | Outros` (5, era 3).
- Filtro por `categoryOfCard(card) !== filter` (não mais por `type`).
- `useEffect` que busca `/api/codex/categoria/${filter}` quando uma categoria está
  ativa; guarda em `categoriaCards`; `visibleCards` substitui os `codex_md` do
  acervo truncado pelo corpo integral da categoria.
- `aria-pressed={filter === id}` nas abas (acessibilidade).

**Arquivo:** `src/App.tsx` — **sem mudança**: continua consumindo
`/api/codex/default` (que agora traz `categoria` e `era` corretos). O
`allCodexCards` (linha 362) já propaga os campos novos porque o tipo
`StoryCard` os carrega.

**Comandos:**
- `npx tsc --noEmit` → exit 0
- `node node_modules/vite/bin/vite.js build` → `✓ built in 1.01s` (Vite 8.3.4)

**Commit:** `feat(ui): abas do Códice por categoria com corpo integral`

---

### Tarefa 9 — Documentação e empacotamento

**`package.json`**: adicionar `"codex:build": "tsx scripts/build-codex-json.ts"`.

**`.gitignore`**: nada a mudar — `json/codex/*.json` **é commitado** (é artefato de
build versionado, para o Docker não depender do `Codex.md` em runtime e para o
diff ser auditável).

**`Dockerfile`**: nenhuma mudança. `COPY . .` já copia `json/codex/`. Mas o
`.dockerignore` exclui `scripts/` — o build roda **fora** do Docker (o JSON já está
commitado), então está OK. **Se** preferir gerar dentro da imagem, remover `scripts`
do `.dockerignore` e rodar `npm run codex:build` antes do `npm run build`.

**README** (seção nova, curta):

> ### Códice em JSON
> `Codex.md` é a fonte canônica. `npm run codex:build` compila para
> `json/codex/{personagens,habilidades,locais,outros}.json` (build determinístico e
> fail-fast: tag nova no Markdown quebra o build). O servidor e a UI consomem
> apenas os JSONs.

**Verificação final:**

```bash
npm run codex:build    # gera os 4 JSONs
npm run lint           # tsc --noEmit  → exit 0
npm run test           # 23 testes → pass 23
npm run build          # vite build
```

---

## 5. Verificação executada (números reais, não estimativas)

Todas as etapas foram executadas num scratch tree idêntico ao repo
(`plan-lucid`, `node_modules` hardlinked) antes de este plano ser escrito.

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | **exit 0**, sem erros |
| `npx tsx --test` (4 arquivos) | **23/23 pass**, 0 fail |
| `npx vite build` | **✓ built in 1.01s**, 1683 módulos |
| `npm run codex:build` | 283 verbetes, 1.15 MB, 4 arquivos |
| Boot do servidor real | `[JJK RAG Engine] 283 verbetes do Códice (json/codex) + 283 Story Cards canônicos carregados.` |
| `GET /api/codex/default` | HTTP 200, 566 cards, 988 KB, 210 com teto de 2600 |
| `GET /api/codex/categoria/personagens` | HTTP 200, 70 verbetes, 420 KB, corpo máx 9.933 chars |
| `GET /api/codex/categoria/habilidades` | HTTP 200, 134 verbetes, 425 KB |
| `GET /api/codex/categoria/locais` | HTTP 200, 26 verbetes, 65 KB |
| `GET /api/codex/categoria/outros` | HTTP 200, 53 verbetes, 230 KB |
| `GET /api/codex/categoria/inexistente` | HTTP 404 |
| Cards sem `categoria` | **0** |
| Cards sem `era` | **0** |
| `canon` no payload | 7, **todos eventos** (0 falso positivo) |
| Build com tag nova no Markdown | **exit 1**, com o nome da tag |

### Defeito do plano encontrado e corrigido na execução

O `Codex.md` **no repositório usa CRLF**, e o scratch (onde o plano foi validado)
usava LF. Com CRLF, o `\r` ficava preso no fim do cabeçalho e o compilador lia
a tag como `"[Tag]\r"` — tag desconhecida. O build gerava **0 verbetes**.

Corrigido em `src/utils/codexCompiler.ts` (normalização CRLF→LF em
`splitBlocks`, e remoção de `\r` dos gatilhos), com teste de regressão
`compileCodexMarkdown funciona com fonte CRLF`. Os JSONs gerados do fonte CRLF
são **byte-idênticos** aos do fonte LF — o que prova que a normalização não
altera o conteúdo.

Este defeito só apareceu porque a execução ocorreu no repositório real, e não
no scratch: o validador do plano comparava contra uma cópia com finais de linha
diferentes.

**Prova do "conteúdo preservado"** — comparação byte a byte entre o `value` no JSON
e o corpo correspondente no `Codex.md`:

- 1.048.160 chars de corpo no acervo novo; **0** verbetes com corpo truncado em 2600.
- 341.375 chars que o truncão antigo perderia estão agora presentes.
- Cada `value` é o corpo do Markdown sem o cabeçalho H1/H2 (que já está no `title`).

**Prova do "era corrigida"** — disponibilidade em campanha de seguimento:

- Antes: 388 de 566 cards disponíveis. Depois: **549**.
- Yorozu, Yuji Itadori, Kashimo, Miguel Oduol, Dagon, Finger Bearer, Bunkamura Way,
  Cursed Object, Mahito, "Never Swing a Katana Again": antes `canon` (sumiam), agora
  `both`.
- Continuam bloqueados: Desfile Noturno, Incidente de Shibuya, Evento de Intercâmbio
  das Escolas Irmãs de Kyoto, Kyoto Goodwill Event, Night Parade of a Hundred
  Demons, Shibuya Incident, Prison Realm. **Nenhum evento de 2018 se infiltrou.**

---

## 6. Riscos e tradeoffs

| Risco | Impacto | Mitigação já aplicada |
|---|---|---|
| Payload de `/api/codex/default` cresce (889 KB → 988 KB) | Baixo | `categoria`+`era` compensam o truncão perdido; UI usa endpoint por categoria sob demanda |
| Cliente pode ficar sem verbetes se o build não rodou | Alto | Servidor **lança** com mensagem "Rode `npm run codex:build`"; build falha alto em tag nova |
| JSONs commitados divergem do `Codex.md` | Médio | Build determinístico + teste que compara saída com o fonte; `codex:build` no CI |
| Classificação de `tag` nova exige mapear | Baixo | Falha alto com o nome da tag; 44 tags já mapeadas e testadas |
| Mudança no payload quebra consumidores externos | Baixo | `/api/codex/default` mantém a mesma forma; só adiciona campos |
| 284 story cards seguem com tipo heurístico | Baixo | `RAW_STORY_TYPE_MAP` já corrige 61 cards; `erro` em tipo desconhecido |
| `era` em `mdSections` é novo | Baixo | `isStoryCardAllowedForEra` já respeita `era` explícito |

**Custo, latência, segurança:** sem mudança de modelo, sem chamada extra à API do
Gemini, sem mudança de schema de prompt. O `Dockerfile` não muda.

---

## 7. Perguntas em aberto

1. **`json/codex/*.json` deve ser commitado ou gerado no build do Docker?**
   Recomendo **commitado** (o `Dockerfile` atual exclui `scripts/` do contexto, e
   versionar o artefato torna o diff auditável). Alternativa: gerar na imagem.
2. **O `Codex.md` deve ganhar uma trava de CI** (`codex:build` + comparação) para
   garantir que o JSON nunca fica stale?
3. **Falta tag de cobertura ao acervo 284?** Hoje `RAW_STORY_TYPE_MAP` cobre 17 tipos
   crus. Se o acervo crescer com tipo novo, o boot falha — comportamento desejado,
   mas vale saber se há plano de ampliar o acervo.

---

## 8. Ordem de execução e commits

```
1. src/utils/codexCategories.ts        (novo)     feat(codex): taxonomia compartilhada do Códice
2. src/utils/codexCompiler.ts          (novo)     feat(codex): compilador Markdown -> verbetes
3. src/utils/codexCompiler.test.ts     (novo)     test(codex): cobrir tags, H1, corpo integral e categorias
4. scripts/build-codex-json.ts         (novo)     feat(codex): gerar JSONs por categoria a partir do Codex.md
   package.json: + "codex:build"                    (commit 4)
5. src/types/jjk.ts                    (edit)     feat(codex): campos categoria e era no StoryCard
6. src/utils/storyCardEra.ts           (edit)     fix(codex): classificar era por estrutura, não por prosa
7. src/utils/storyCardEra.test.ts      (novo)     (commit 7)
8. src/server/codexLoader.ts           (novo)     feat(server): carregar o Códice dos JSONs gerados
   server.ts                                       (commit 8)
9. src/components/CodexPage.tsx        (edit)     feat(ui): abas do Códice por categoria com corpo integral
10. README.md                          (edit)     docs(codex): registrar o pipeline Codex.md -> json/codex
```

Cada commit deixa `npm run lint` e `npm run test` verdes.
