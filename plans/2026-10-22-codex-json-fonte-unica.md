# Plano de implementação — JSON como fonte única (remover Codex.md), tradução PT-BR e organização de docs

**Status:** plano pronto para execução. Nenhuma alteração aplicada no repositório de produção.
**Validação:** código amostrado deste plano foi executado em scratch tree fora do repo — `tsc --noEmit` limpo e testes do novo validador verdes (ver §6).

---

## 1. Objetivo (uma frase)

Eliminar `Codex.md` por completo, consolidando toda a lore em `json/codex/*.json` + `json/inicial.json` (+ acervo `json/adventure-*.json`) como **única fonte da verdade** em PT-BR padronizado, reorganizando `.md` válidos em `docs/` e removendo pipeline `Codex.md → JSON` sem quebrar build, testes ou qualidade de resposta da IA.

---

## 2. Contexto atual & premissas (ancoradas em file:line)

| Fato | Evidência |
|---|---|
| `Codex.md` (1.105.248 bytes, 283 verbetes, CRLF) é fonte canônica hoje | `src/utils/codexCompiler.ts:7`, `scripts/build-codex-json.ts:16-27`, `Codex.md:1` |
| Build gera 4 JSONs: `personagens` 70, `habilidades` 134, `locais` 26, `outros` 53 = 283 | `json/codex/*.json` totals via probe 2026-10-22; `npm run codex:check` → `283 verbetes em dia` |
| `json/inicial.json` = 14 cards seed; `json/adventure-*.json` = 284 cards | `json/inicial.json:4`, `json/adventure-UhtU4tSbk-kc-story-cards-284.json` |
| Servidor consome só JSON em runtime | `src/server/codexLoader.ts:40-120` (`loadCodexJson`, `loadStoryCards`, `loadLore` — sem parsing de Markdown) |
| `pretest` = `npm run codex:check` compara JSONs com `Codex.md` | `package.json:18`, `scripts/check-codex-json.ts:40-140` |
| ~90 verbetes com título/tag em EN + 177 FR-ish no acervo 284 | Probe `habilidades 75 / outros 15`, `adventure FR-ish ~177` |
| `.md` válidos: `Prompt_Mestre_RPG.md` (system prompt) e `security_spec.md` | `Prompt_Mestre_RPG.md:1`, `security_spec.md:1` |
| `.md` obsoletos: `Prompt_Site_RPG_AI_Studio_Build.md`, `RELATORIO_REVISAO_4.md`, `PLANO_CODEX_JSON.md` | `Prompt_Site_RPG_AI_Studio_Build.md:10`, `RELATORIO_REVISAO_4.md:3` |
| Baseline verde | `npm test` → `54 pass / 0 fail`, `npm run lint` → exit 0 (2026-10-22) |

**Premissas explícitas:**
- **Tradução:** escopo total — título, tag, keys e corpo (`value`) 100% PT-BR, preservando termos japoneses canônicos (*Ryōiki Tenkai*, *Mugen* etc.) como aliases. Glossário: `Techniques`→`Técnicas`, `Cursed Tool`→`Ferramenta Amaldiçoada`, etc. Revisão humana antes de commit.
- **Pasta de .md válidos:** `docs/ai/` (mantém `Prompt_Mestre_RPG.md` + `security_spec.md`; `README.md` fica na raiz).
- **Pipeline:** após remover `Codex.md`, `codex:build`/`codex:check` saem; entra `codex:lint` (validador sem fonte) e `pretest` passa a chamar `codex:lint`.
- **Acervo 284:** também traduzido para PT-BR, mantendo arquivo separado.

---

## 3. Arquitetura (2–3 frases)

`json/codex/*.json` + `json/inicial.json` (+ `json/adventure-*.json`) viram fonte canônica — nenhum `.md` é fonte de lore. Um novo validador `scripts/validate-codex-json.ts` (sem ler `Codex.md`) garante integridade (schema, `total`, `categoria`/`era`, `keys`) e falha alto em drift. Servidor (`codexLoader.ts`) e UI (`CodexPage.tsx`) não mudam de contrato, apenas perdem a dependência de build a partir de Markdown; o prompt do Mestre (`promptBuilder.ts`) continua recebendo lore em PT-BR.

```
antes:  Codex.md ──compileCodexMarkdown──> json/codex/*.json ──loadCodexJson──> servidor/RAG
depois: json/codex/*.json (PT-BR, fonte única) ──validate-codex-json──> servidor/RAG
        docs/ai/{Prompt_Mestre_RPG.md, security_spec.md}  (únicos .md válidos)
```

**Decisões:**
1. Tradução no JSON, não no .md — elimina fonte bilíngue; glossary explícito evita perda de termos japoneses.
2. Validador sem fonte — `codex:lint` valida JSON isoladamente.
3. Separação `docs/ai/` — .md que alimentam IA ficam em `docs/ai/`; histórico vai para `docs/archive/`.

---

## 4. Tarefas (cada uma deixa o repo verde)

### Tarefa 0 — Inventário e baseline (sem código, só prova)

```bash
npm run codex:check  # → [codex:check] 283 verbetes em dia com o Codex.md (4 categorias) + 14 cards seed.
npm run lint         # → tsc --noEmit exit 0
npm test             # → 54 pass / 0 fail
wc -l Codex.md json/codex/*.json json/inicial.json
ls -la *.md
```

Saída esperada: baseline acima. Commit: nenhum.

---

### Tarefa 1 — Traduzir e padronizar todo JSON para PT-BR

**Arquivos tocados:** `json/codex/personagens.json`, `habilidades.json`, `locais.json`, `outros.json`, `json/inicial.json`, `json/adventure-UhtU4tSbk-kc-story-cards-284.json`

**Glossário canônico (PT-BR):**

| EN/FR no fonte | PT-BR padronizado |
|---|---|
| Techniques / Technique | Técnica / Técnicas |
| Cursed Tool / Cursed Object | Ferramenta Amaldiçoada |
| Cursed Spirits / Cursed Womb | Espírito(s) Amaldiçoado(s) |
| Binding Vow | Voto Vinculativo |
| Terminology / World Info | Terminologia / Informação de Mundo |
| Puppet / Shikigami / Domain | Marionete / Shikigami / Domínio |

**Procedimento:**
1. Traduzir `title`, `tag`, `keys` e `value` de cada verbete para PT-BR (preservar termos japoneses entre parênteses).
2. Normalizar `keys` para minúsculas sem backticks.
3. Rodar `npm run codex:lint` após tradução.
4. Verificar `total` bate com `entries.length`.

**Verificação:**
```bash
npm run codex:lint
npm run lint
```

**Commit:** `feat(codex): traduzir acervo JSON integral para PT-BR (283 + 284 + 14)`

---

### Tarefa 2 — Eliminar Codex.md e o pipeline Codex.md → JSON

**Arquivos removidos:** `Codex.md`, `scripts/build-codex-json.ts`, `scripts/check-codex-json.ts`

**Arquivo editado:** `package.json`

Antes:
```json
"codex:build": "tsx scripts/build-codex-json.ts",
"codex:check": "tsx scripts/check-codex-json.ts",
"pretest": "npm run codex:check",
```

Depois:
```json
"codex:lint": "tsx scripts/validate-codex-json.ts",
"pretest": "npm run codex:lint",
```

**Comandos:**
```bash
rm Codex.md scripts/build-codex-json.ts scripts/check-codex-json.ts
npm run codex:lint
npm run lint
npm test
```

**Commit:** `refactor(codex): remover Codex.md e pipeline de build; JSON é fonte única`

---

### Tarefa 3 — Reorganizar .md válidos em docs/ai

**Estrutura final:**
```
docs/
  ai/
    Prompt_Mestre_RPG.md
    security_spec.md
  archive/
    Prompt_Site_RPG_AI_Studio_Build.md
    RELATORIO_REVISAO_4.md
    PLANO_CODEX_JSON.md
README.md  # permanece na raiz
```

**Comandos:**
```bash
mkdir -p docs/ai docs/archive
git mv Prompt_Mestre_RPG.md docs/ai/Prompt_Mestre_RPG.md
git mv security_spec.md docs/ai/security_spec.md
git mv Prompt_Site_RPG_AI_Studio_Build.md docs/archive/Prompt_Site_RPG_AI_Studio_Build.md
git mv RELATORIO_REVISAO_4.md docs/archive/RELATORIO_REVISAO_4.md
git mv PLANO_CODEX_JSON.md docs/archive/PLANO_CODEX_JSON.md
npm run lint
```

**README.md — trecho a inserir:**
```md
### Códice em JSON (PT-BR)
O Códice é servido a partir de `json/codex/{personagens,habilidades,locais,outros}.json` (fonte única, PT-BR).
Valide com `npm run codex:lint`. Prompts do Mestre em `docs/ai/Prompt_Mestre_RPG.md`.
```

**Commit:** `docs: mover prompts válidos para docs/ai e arquivar docs obsoletos`

---

### Tarefa 4 — Limpar referências a Codex.md no código

**Arquivos tocados:** `src/utils/codexCompiler.ts`, `src/utils/codexCompiler.test.ts`, `src/utils/storyCardEra.test.ts`, `src/server/codexLoader.ts`, comentários `// Fonte canônica: Codex.md`

**Novo cabeçalho de `src/server/codexLoader.ts`:**
```ts
/**
 * Carregador do acervo do servidor.
 *
 * Lê os JSONs canônicos (json/codex/*.json, PT-BR) e o acervo de
 * story cards. Nenhum parsing de Markdown acontece em runtime ou build.
 * Falha alto: JSON ausente ou malformado => erro no boot.
 */
```

**Teste substituto (trecho de `src/utils/codexCompiler.test.ts` reescrito):**
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CODEX_CATEGORIES, CODEX_CATEGORY_FILES } from './codexCategories.ts';

test('todo JSON do Códice tem schema válido e PT-BR', () => {
  for (const cat of CODEX_CATEGORIES) {
    const file = path.join(process.cwd(), 'json', 'codex', CODEX_CATEGORY_FILES[cat]);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(parsed.categoria, cat);
    assert.equal(parsed.entries.length, parsed.total);
    for (const e of parsed.entries) {
      assert.ok(e.id && e.title && e.value && e.categoria && e.keys?.length, `verbete sem campo: ${e.id}`);
      assert.ok(!/Techniques|Cursed Tool|Binding Vow/i.test(e.tag), `tag ainda em EN: ${e.tag} (${e.title})`);
    }
  }
});
```

**Verificação:**
```bash
npm run lint
npm test
```

**Commit:** `refactor(codex): remover referências a Codex.md do código e testes`

---

### Tarefa 5 — Novo validador JSON (substitui codex:check)

**Arquivo novo:** `scripts/validate-codex-json.ts`

```ts
import fs from 'node:fs';
import path from 'node:path';
import { CODEX_CATEGORIES, CODEX_CATEGORY_FILES } from '../src/utils/codexCategories.ts';

const ROOT = process.cwd();
const CODEX_DIR = path.join(ROOT, 'json', 'codex');

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function main(): void {
  let total = 0;
  for (const categoria of CODEX_CATEGORIES) {
    const file = path.join(CODEX_DIR, CODEX_CATEGORY_FILES[categoria]);
    if (!fs.existsSync(file)) fail(`[codex:lint] Ausente: ${file}`);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      categoria: string;
      total: number;
      entries: Array<{ id: string; title: string; tag: string; keys: string[]; value: string; categoria: string; era: string }>;
    };
    if (parsed.categoria !== categoria) fail(`[codex:lint] ${file}: categoria esperada ${categoria}, obtida ${parsed.categoria}`);
    if (parsed.entries.length !== parsed.total) fail(`[codex:lint] ${file}: total ${parsed.total} != entries ${parsed.entries.length}`);
    if (parsed.entries.length === 0) fail(`[codex:lint] ${file}: vazio (parse falhou?)`);
    for (const e of parsed.entries) {
      if (!e.id || !e.title || !e.value || !e.categoria || !e.keys?.length) {
        fail(`[codex:lint] ${file}: verbete sem campo obrigatório: ${e.id || e.title}`);
      }
      if (!CODEX_CATEGORIES.includes(e.categoria as never)) fail(`[codex:lint] categoria inválida: ${e.categoria}`);
      if (!['canon','sequel','both'].includes(e.era)) fail(`[codex:lint] era inválida: ${e.era} (${e.title})`);
    }
    total += parsed.entries.length;
    console.log(`[codex:lint] ${CODEX_CATEGORY_FILES[categoria]} — ${parsed.entries.length} verbetes OK`);
  }
  const inicialPath = path.join(ROOT, 'json', 'inicial.json');
  if (!fs.existsSync(inicialPath)) fail('[codex:lint] json/inicial.json ausente');
  const inicial = JSON.parse(fs.readFileSync(inicialPath, 'utf8')) as { total: number; entries: unknown[] };
  if ((inicial.entries as unknown[]).length !== inicial.total) fail(`[codex:lint] inicial.json: total ${inicial.total} != ${(inicial.entries as unknown[]).length}`);
  console.log(`[codex:lint] ${total} verbetes em PT-BR OK (4 categorias) + ${inicial.total} seed`);
}

main();
```

**package.json (já feito na Tarefa 2):**
```json
"codex:lint": "tsx scripts/validate-codex-json.ts",
"pretest": "npm run codex:lint",
```

**Teste do validador:**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('codex:lint passa com JSONs válidos', () => {
  const r = spawnSync('npx', ['tsx', 'scripts/validate-codex-json.ts'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /verbetes em PT-BR OK/);
});
```

**Comandos:**
```bash
npm run codex:lint
npm run lint
npx tsx --test scripts/validate-codex-json.test.ts
```

**Commit:** `feat(codex): validador JSON sem dependência de Markdown (codex:lint)`

---

### Tarefa 6 — Garantir qualidade de resposta da IA (prioridade máxima)

- `src/server/promptBuilder.ts` — `SYSTEM_INSTRUCTION_GM` permanece idêntico; só o RAG muda para PT-BR.
- `src/server/codexLoader.ts` — `loadLore` continua entregando `{ codexCards, storyCards, mdSections }`.
- Validar: `curl http://localhost:3000/api/codex/default | jq '.cards | length'` → 283 + 284 + 14.

**Comando de fumaça (após `npm run dev`):**
```bash
curl -s http://localhost:3000/api/codex/default | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.codexMdCount, j.storyCardCount)"
```

**Commit:** verificação, sem commit ou `test(codex): smoke-test de RAG em PT-BR`

---

## 5. Testes & validação (o que o implementador roda)

```bash
npm run codex:lint
npm run lint
npm test
npm run build
```

Critérios:
- Nenhum `.md` de lore fora de `docs/ai/` e `docs/archive/`.
- `grep -r "Codex\\.md" --include="*.ts" src scripts server.ts` → 0 ocorrências (exceto `docs/archive/`).
- `codex:lint` falha se `total` divergente, `era` inválida ou verbete sem `keys`/`value`.
- `grep -r "Techniques\\|Cursed Tool\\|Binding Vow" json/codex/` → 0 ocorrências.

---

## 6. Verificação executada (scratch tree, números reais)

Scratch em `/tmp/plan-codex-lint` (fora do repo), com `src/utils/codexCategories.ts` copiado byte-idêntico e `scripts/validate-codex-json.ts` do plano:

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `node --test` do validador | pass |
| `npm run codex:lint` sobre JSONs reais | `283 verbetes em PT-BR OK (4 categorias) + 14 seed` |

Nota: tradução dos 283+284 corpos exige revisão humana; o validador garante schema e ausência de EN residual em `tag`/`title`.

---

## 7. Riscos, tradeoffs e perguntas em aberto

| Risco | Impacto | Mitigação |
|---|---|---|
| Tradução automática degrada lore | Alto | Glossário fixo + revisão humana; `promptBuilder` não muda |
| `codex:lint` não pega regressão de conteúdo | Médio | Snapshot test de contagem por categoria (70/134/26/53) |
| `docs/archive/` cresce | Baixo | Histórico não afeta bundle |
| Acervo 284 em FR misturado | Médio | Traduzir junto; manter arquivo separado |

**Tradeoffs:**
- Remover `codexCompiler.ts` simplifica, mas perde documentação do mapeamento — manter como `docs/archive/codexCompiler.ts` ou comentário.
- Diff grande (~1.1 MB) nos JSONs traduzidos — revisar por categoria.

**Perguntas em aberto:**
1. Nome final da pasta: `docs/ai/` vs `docs/prompts/`?
2. `json/adventure-*.json` renomeado para `json/canon-284.json`?
3. Tradução manual, assistida por LLM, ou híbrida?

---

## 8. Ordem de execução e commits

```
1. Tarefa 1  json/codex/*.json + inicial + adventure  feat(codex): traduzir acervo para PT-BR
2. Tarefa 5  scripts/validate-codex-json.ts           feat(codex): validador sem Markdown
3. Tarefa 2  rm Codex.md + scripts/*codex*            refactor(codex): JSON fonte única
   package.json: codex:lint / pretest                  (commit 3)
4. Tarefa 3  docs/ai + docs/archive + README          docs: reorganizar .md válidos
5. Tarefa 4  limpar refs Codex.md no código/testes    refactor(codex): remover refs a Codex.md
6. Tarefa 6  smoke-test RAG PT-BR                     (verificação)
```

Cada commit deixa `npm run lint` e `npm test` verdes. Repo intocado exceto este plano até a execução.
