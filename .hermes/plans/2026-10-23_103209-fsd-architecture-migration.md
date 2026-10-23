# Migrar o projeto para Feature Sliced Design (FSD)

## Goal
Reorganizar `src/` de uma estrutura flat (utils/, components/, services/, types/, data/) para FSD com 6 layers (app, pages, widgets, features, entities, shared), preservando toda a funcionalidade e testes, sem alterar lógica de negócio.

## Contexto atual / suposições
- **Stack:** Vite 8 + React 19 + TypeScript (estricto) + Express server (server.ts)
- **Estrutura atual:** `src/{utils,components,services,types,data,server}` com imports relativos por profundidade (`../../types/jjk`)
- **Tests:** `tsx --test` roda 11 arquivos `.test.ts` (31 testes passando, 1 falha de tipo em campaignMemory.test.ts que já existia)
- **Build:** `vite build` + `tsc --noEmit` (lint)
- **Alias:** `@/*` → `./` no tsconfig/vite (atualmente não usado nos imports — todos são relativos `../`)
- **Server:** `server.ts` importa de `./src/...` — os imports do servidor não mudam, só os internos do `src/`
- **Nenhum import usa o alias `@/`** — todos são relativos `../`, `../../` etc.

## Arquitetura proposta (FSD)
```
src/
├── app/                    # Inicialização da aplicação
│   ├── main.tsx            # entry point
│   ├── App.tsx             # root + routing
│   └── index.css           # estilos globais
├── pages/                  # Páginas completas (rotas)
│   ├── home/               │
│   │   └── HomePage.tsx    │
│   ├── chronicle/          │
│   │   └── ChroniclePage.tsx
│   ├── character/          │
│   │   ├── CharacterProfilePage.tsx
│   │   └── CharacterWizard.tsx
│   ├── codex/              │
│   │   └── CodexPage.tsx   │
│   └── settings/           │
│       └── SettingsPage.tsx│
├── widgets/                # Composições complexas de UI
│   ├── chat/               │
│   │   └── ChatNarrativeStage.tsx
│   ├── sidebar/            │
│   │   ├── WorldSidebar.tsx
│   │   └── SheetSidebar.tsx
│   └── editorial/          │
│       └── EditorialDialog.tsx
├── features/               # Funcionalidades de negócio
│   ├── narrative/          # Geração de narrativa
│   │   ├── lib/
│   │   │   ├── geminiService.ts
│   │   │   └── campaignMemory.ts
│   │   └── tests/
│   │       └── geminiService.stream.test.ts
│   ├── character/          # Ficha de personagem
│   │   └── lib/
│   │       ├── svgArtGenerator.ts
│   │       └── soundEffects.ts
│   └── access/             # Controle de acesso
│       └── lib/
│           └── accessGuard.ts
├── entities/               # Entidades de domínio
│   ├── character/          # Personagem
│   │   └── data/
│   │       └── characterVoices.ts
│   ├── campaign/           # Campanha
│   │   └── lib/
│   │       └── (future: campaign state/model)
│   ├── story-card/         # Story Cards
│   │   └── lib/
│   │       └── (future: story card model)
│   └── codex/              # Códice
│       └── lib/
│           └── (future: codex model)
├── shared/                 # Código compartilhado
│   ├── types/              # Tipos globais
│   │   ├── jjk.ts
│   │   └── provider.ts
│   ├── lib/                # Utilitários compartilhados
│   │   ├── jjkEngine.ts
│   │   ├── codexCompiler.ts
│   │   ├── storageManager.ts
│   │   ├── characterVoiceResolver.ts
│   │   ├── storyCardEra.ts
│   │   └── codexCategories.ts
│   ├── data/               # Dados estáticos
│   │   ├── initialCodex.ts
│   │   ├── characterPortraits.ts
│   │   └── startingArcs.ts
│   └── tests/              # Tests utilitários
│       ├── jjkEngine.test.ts
│       ├── codexCompiler.test.ts
│       ├── storyCardEra.test.ts
│       └── characterVoiceResolver.test.ts
└── server/                 # Backend (intocado, já está bem organizado)
    ├── providers/
    ├── promptBuilder.ts
    ├── canonicalVoices.ts
    ├── codexLoader.ts
    └── tests/
```

### Regras de dependência FSD (aplicadas rigorosamente)
- Uma camada **só pode importar** de camadas **inferiores** (app → pages → widgets → features → entities → shared)
- `shared/` **não importa** de nenhuma outra camada interna
- `server/` permanece como camada paralela (backend)
- Imports dentro da mesma camada usam `./` relativo
- Imports entre camadas usam caminhos relativos que sobem (`../../shared/types/jjk`)

## Passo a passo

### Task 1: Criar estrutura de diretórios FSD vazia
**Tempo estimado:** 2 min
**Comando:**
```bash
mkdir -p src/{app,pages/{home,chronicle,character,codex,settings},widgets/{chat,sidebar,editorial},features/{narrative/{lib,tests},character/{lib},access/{lib}},entities/{character/{data},campaign/{lib},story-card/{lib},codex/{lib}},shared/{types,lib,data,tests}}
```
**Validação:**
```bash
find src -type d | sort
```
Deve mostrar a árvore acima com todas as pastas criadas.

### Task 2: Mover `shared/types/` (jjk.ts, provider.ts)
**Arquivos:** `src/types/jjk.ts` → `src/shared/types/jjk.ts`  
**Arquivos:** `src/types/provider.ts` → `src/shared/types/provider.ts`  
**Tempo estimado:** 2 min

**Imports a atualizar:**
Todo arquivo que importa de `../types/jjk` ou `../../types/jjk` deve agora importar de `../../shared/types/jjk` ou `../../../shared/types/jjk` dependendo da nova profundidade.

**Validação:**
```bash
npm run lint  # tsc --noEmit
```
Deve falhar (imports antigos quebrados) — confirma que os arquivos foram movidos.

### Task 3: Mover `shared/lib/` (utilitários)
**Arquivos movidos:**
- `src/utils/jjkEngine.ts` → `src/shared/lib/jjkEngine.ts`
- `src/utils/codexCompiler.ts` → `src/shared/lib/codexCompiler.ts`
- `src/utils/storageManager.ts` → `src/shared/lib/storageManager.ts`
- `src/utils/characterVoiceResolver.ts` → `src/shared/lib/characterVoiceResolver.ts`
- `src/utils/storyCardEra.ts` → `src/shared/lib/storyCardEra.ts`
- `src/utils/codexCategories.ts` → `src/shared/lib/codexCategories.ts`

**Testes movidos:**
- `src/utils/jjkEngine.test.ts` → `src/shared/tests/jjkEngine.test.ts`
- `src/utils/codexCompiler.test.ts` → `src/shared/tests/codexCompiler.test.ts`
- `src/utils/storyCardEra.test.ts` → `src/shared/tests/storyCardEra.test.ts`
- `src/utils/characterVoiceResolver.test.ts` → `src/shared/tests/characterVoiceResolver.test.ts`

**Imports internos dos utils:**
- `jjkEngine.ts`: importa de `../types/jjk` → `../shared/types/jjk` (via novo path)
- `storyCardEra.ts`: importa de `../types/jjk` → `../shared/types/jjk`
- `characterVoiceResolver.ts`: importa de `../data/characterVoices.ts` → `../../entities/character/data/characterVoices.ts`
- `storageManager.ts`: importa de `../types/jjk` → `../shared/types/jjk`
- `codexCompiler.ts`: importa de `../utils/codexCategories` → `../shared/lib/codexCategories`
- `codexCategories.ts`: sem imports internos

**Imports externos (App.tsx, services, etc.) a atualizar:**
- `App.tsx`: `./utils/jjkEngine` → `./shared/lib/jjkEngine`
- `App.tsx`: `./utils/storageManager` → `./shared/lib/storageManager`
- `App.tsx`: `./utils/svgArtGenerator` → `./features/character/lib/svgArtGenerator`
- `geminiService.ts`: `../types/jjk` → `../shared/types/jjk`
- `server.ts`: `./src/utils/storyCardEra` → `./src/shared/lib/storyCardEra`
- `server.ts`: `./src/utils/jjkEngine` → `./src/shared/lib/jjkEngine`
- `server.ts`: `./src/utils/storageManager` → `./src/shared/lib/storageManager`
- `scripts/validate-codex-json.ts`: `../src/utils/codexCategories.ts` → `../src/shared/lib/codexCategories.ts`
- `scripts/test-rag-era.ts`: `../src/utils/jjkEngine` → `../src/shared/lib/jjkEngine`

**Validação:**
```bash
npm run lint  # tsc --noEmit
```
Deve mostrar erros de import quebrado para os arquivos que ainda não foram movidos.

### Task 4: Mover `shared/data/` (dados estáticos)
**Arquivos movidos:**
- `src/data/initialCodex.ts` → `src/shared/data/initialCodex.ts`
- `src/data/characterPortraits.ts` → `src/shared/data/characterPortraits.ts`
- `src/data/startingArcs.ts` → `src/shared/data/startingArcs.ts`

**Imports a atualizar:**
- `initialCodex.ts`: `../types/jjk` → `../shared/types/jjk`, `../../json/inicial.json` → `../../json/inicial.json` (mantém, pois json/ está fora de src/)
- `characterPortraits.ts`: `../types/jjk` → `../shared/types/jjk`
- `startingArcs.ts`: `../types/jjk` → `../shared/types/jjk`

**Consumidores a atualizar:**
- `App.tsx`: `./data/initialCodex` → `./shared/data/initialCodex`
- `CharacterWizard.tsx`: `../data/initialCodex` → `../shared/data/initialCodex`
- `CharacterWizard.tsx`: `../data/startingArcs` → `../shared/data/startingArcs`
- `CharacterWizard.tsx`: `../data/characterPortraits` → `../shared/data/characterPortraits`
- `scripts/test-opening.ts`: `../src/data/startingArcs` → `../src/shared/data/startingArcs`
- `scripts/extract-initial-cards.ts`: `../src/data/initialCodex.ts` → `../src/shared/data/initialCodex.ts`
- `server/promptBuilder.ts`: importa de `../data/characterVoices.ts` → `../../entities/character/data/characterVoices.ts`

### Task 5: Mover `entities/character/data/characterVoices.ts`
**Arquivo movido:** `src/data/characterVoices.ts` → `src/entities/character/data/characterVoices.ts`

**Consumidores a atualizar:**
- `server/canonicalVoices.ts`: `../data/characterVoices.ts` → `../../entities/character/data/characterVoices.ts`
- `server/canonicalVoices.test.ts`: mesmo path
- `shared/lib/characterVoiceResolver.ts`: `../data/characterVoices.ts` → `../../entities/character/data/characterVoices.ts`
- `utils/campaignMemory.test.ts`: mesmo path (se importar)

### Task 6: Mover `features/` (serviços e lógica de negócio)
**Arquivos movidos:**
- `src/services/geminiService.ts` → `src/features/narrative/lib/geminiService.ts`
- `src/services/geminiService.stream.test.ts` → `src/features/narrative/tests/geminiService.stream.test.ts`
- `src/utils/svgArtGenerator.ts` → `src/features/character/lib/svgArtGenerator.ts`
- `src/utils/soundEffects.ts` → `src/features/character/lib/soundEffects.ts`
- `src/services/accessGuard.ts` → `src/features/access/lib/accessGuard.ts`
- `src/utils/campaignMemory.ts` → `src/features/narrative/lib/campaignMemory.ts`
- `src/utils/campaignMemory.test.ts` → `src/features/narrative/tests/campaignMemory.test.ts`

**Imports internos a atualizar:**
- `geminiService.ts`: `../types/jjk` → `../../shared/types/jjk`
- `campaignMemory.ts`: imports internos → ajustar paths para `../../shared/types/jjk`
- `campaignMemory.test.ts`: imports para `./campaignMemory.ts` → `../lib/campaignMemory.ts`

**Consumidores a atualizar:**
- `App.tsx`: `./services/geminiService` → `./features/narrative/lib/geminiService`
- `App.tsx`: `./utils/svgArtGenerator` → `./features/character/lib/svgArtGenerator`
- `App.tsx`: `./utils/soundEffects` → `./features/character/lib/soundEffects`
- `ChatNarrativeStage.tsx`: `../services/geminiService` → `../features/narrative/lib/geminiService`
- `CharacterWizard.tsx`: `../services/geminiService` → `../features/narrative/lib/geminiService`
- `SettingsPage.tsx`: `../services/geminiService` → `../features/narrative/lib/geminiService`

### Task 7: Mover `widgets/` (composições complexas)
**Arquivos movidos:**
- `src/components/ChatNarrativeStage.tsx` → `src/widgets/chat/ChatNarrativeStage.tsx`
- `src/components/WorldSidebar.tsx` → `src/widgets/sidebar/WorldSidebar.tsx`
- `src/components/SheetSidebar.tsx` → `src/widgets/sidebar/SheetSidebar.tsx`
- `src/components/EditorialDialog.tsx` → `src/widgets/editorial/EditorialDialog.tsx`

**Imports internos a atualizar:**
Cada widget importa de `../types/jjk`, `../services/geminiService`, etc. → ajustar para os novos paths FSD.

**Consumidores a atualizar:**
- `App.tsx`: imports dos widgets → `./widgets/chat/ChatNarrativeStage` etc.
- `CharacterWizard.tsx`: `../components/SheetSidebar` → `../widgets/sidebar/SheetSidebar`

### Task 8: Mover `pages/` (componentes de página)
**Arquivos movidos:**
- `src/components/HomePage.tsx` → `src/pages/home/HomePage.tsx`
- `src/components/ChroniclePage.tsx` → `src/pages/chronicle/ChroniclePage.tsx`
- `src/components/CharacterProfilePage.tsx` → `src/pages/character/CharacterProfilePage.tsx`
- `src/components/CharacterWizard.tsx` → `src/pages/character/CharacterWizard.tsx`
- `src/components/CodexPage.tsx` → `src/pages/codex/CodexPage.tsx`
- `src/components/SettingsPage.tsx` → `src/pages/settings/SettingsPage.tsx`

**Imports internos a atualizar:**
Cada página importa de `../types/jjk`, `../utils/jjkEngine`, `../services/geminiService`, `../data/initialCodex`, etc. → ajustar para os novos paths FSD.

**Consumidores a atualizar:**
- `App.tsx`: `./components/HomePage` → `./pages/home/HomePage` etc.

### Task 9: Mover `app/` (inicialização)
**Arquivos movidos:**
- `src/App.tsx` → `src/app/App.tsx`
- `src/main.tsx` → `src/app/main.tsx`
- `src/index.css` → `src/app/index.css`

**Imports a atualizar em `main.tsx`:**
```typescript
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// (permanece relativo, não muda)
```

**Imports a atualizar em `App.tsx`:**
```typescript
// Exemplo de como ficam os imports após a migração completa:
import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { ActionMode, CampaignState, CampaignTurn, CharacterSheet, FontSizeOption, GeminiModelOption, NpcInScene, StoryCard, VisualEffectTrigger, WorldStateUpdate } from '../shared/types/jjk';
import type { ProviderSpec } from '../shared/types/provider';
import { INITIAL_STORY_CARDS, CANONICAL_TECHNIQUES, STARTING_ARCS } from '../shared/data/initialCodex';
import { applyNewInventoryItemOrVow, applySheetEvolution, buildExclusiveCharacterSheetMarkdown, buildExclusiveCharacterStoryCard, selectActiveStoryCardsForTurn } from '../shared/lib/jjkEngine';
import { generateCanonicalPortraitSvg, generateSceneIllustrationSvg } from '../features/character/lib/svgArtGenerator';
import { CAMPAIGN_STORAGE_KEY, loadCustomCodexSafe, migrateCampaignToNarrative, saveCampaignStateSafe, saveCustomCodexSafe } from '../shared/lib/storageManager';
import { HomePage } from '../pages/home/HomePage';
import { CodexPage } from '../pages/codex/CodexPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { CharacterProfilePage } from '../pages/character/CharacterProfilePage';
import { ChroniclePage } from '../pages/chronicle/ChroniclePage';
import { EditorialDialog } from '../widgets/editorial/EditorialDialog';
const CharacterWizard = lazy(() => import('../pages/character/CharacterWizard').then((m) => ({ default: m.CharacterWizard })));
import { jjkAudio } from '../features/character/lib/soundEffects';
import { executeNarrativeTurn, generateAnimeImage, GeminiConnectionReport, streamNarrativeTurn, summarizeCampaignMemory, validateGeminiConnection } from '../features/narrative/lib/geminiService';
import { BookOpen, Settings, Home, Feather, Archive } from 'lucide-react';
import '../app/index.css';
```

### Task 10: Atualizar `server.ts` e `server/` imports
**Arquivo:** `server.ts` (raiz do projeto)

Os imports do servidor apontam para `./src/...` e devem ser atualizados para os novos paths:
```typescript
// ANTES:
import { inferStoryCardEra, isStoryCardAllowedForEra, storyCardEraTag } from './src/utils/storyCardEra';
import { SYSTEM_INSTRUCTION_GM, JJK_RESPONSE_JSON_SCHEMA, buildTurnPrompt, extractNarrativeFromJson, firstSceneLine, type ArcContractWorld } from './src/server/promptBuilder';
import { classifyProviderError, listProviders, resolveProvider, type ProviderEnv } from './src/server/providers/providerRegistry';
import { parseGmTurnJson, runExternalTurn } from './src/server/providers/gmTurnRunner';
import type { ProviderId, ProviderSpec } from './src/types/provider';
import { selectActiveStoryCardsForTurn } from './src/utils/jjkEngine';
import { CAMPAIGN_STORAGE_KEY, loadCustomCodexSafe, migrateCampaignToNarrative, saveCampaignStateSafe, saveCustomCodexSafe } from './src/utils/storageManager';

// DEPOIS:
import { inferStoryCardEra, isStoryCardAllowedForEra, storyCardEraTag } from './src/shared/lib/storyCardEra';
import { SYSTEM_INSTRUCTION_GM, JJK_RESPONSE_JSON_SCHEMA, buildTurnPrompt, extractNarrativeFromJson, firstSceneLine, type ArcContractWorld } from './src/server/promptBuilder';
import { classifyProviderError, listProviders, resolveProvider, type ProviderEnv } from './src/server/providers/providerRegistry';
import { parseGmTurnJson, runExternalTurn } from './src/server/providers/gmTurnRunner';
import type { ProviderId, ProviderSpec } from './src/shared/types/provider';
import { selectActiveStoryCardsForTurn } from './src/shared/lib/jjkEngine';
import { CAMPAIGN_STORAGE_KEY, loadCustomCodexSafe, migrateCampaignToNarrative, saveCampaignStateSafe, saveCustomCodexSafe } from './src/shared/lib/storageManager';
```

**Arquivo:** `server/promptBuilder.ts`
```typescript
// ANTES:
import { renderCanonicalVoices } from './canonicalVoices';
import type { CharacterVoiceGuide } from '../data/characterVoices.ts';

// DEPOIS:
import { renderCanonicalVoices } from './canonicalVoices';
import type { CharacterVoiceGuide } from '../entities/character/data/characterVoices.ts';
```

**Arquivo:** `server/canonicalVoices.ts`
```typescript
// ANTES:
import type { CharacterVoiceGuide } from '../data/characterVoices.ts';
import { findVoiceGuideForNpc } from '../utils/characterVoiceResolver.ts';

// DEPOIS:
import type { CharacterVoiceGuide } from '../entities/character/data/characterVoices.ts';
import { findVoiceGuideForNpc } from '../shared/lib/characterVoiceResolver.ts';
```

**Arquivo:** `server/codexLoader.ts`
```typescript
// ANTES:
import type { CodexCategory, StoryCard, StoryEra } from '../types/jjk';
import { CODEX_CATEGORIES, RAW_STORY_TYPE_MAP } from '../utils/codexCategories';
import { inferEraByStructure } from '../utils/storyCardEra';

// DEPOIS:
import type { CodexCategory, StoryCard, StoryEra } from '../shared/types/jjk';
import { CODEX_CATEGORIES, RAW_STORY_TYPE_MAP } from '../shared/lib/codexCategories';
import { inferEraByStructure } from '../shared/lib/storyCardEra';
```

### Task 11: Atualizar `scripts/` imports
**Arquivo:** `scripts/validate-codex-json.ts`
```typescript
// ANTES:
import { CODEX_CATEGORIES, CODEX_CATEGORY_FILES } from '../src/utils/codexCategories.ts';

// DEPOIS:
import { CODEX_CATEGORIES, CODEX_CATEGORY_FILES } from '../src/shared/lib/codexCategories.ts';
```

**Arquivo:** `scripts/test-rag-era.ts`
```typescript
// ANTES:
import { selectActiveStoryCardsForTurn } from '../src/utils/jjkEngine';
import type { StoryCard } from '../src/types/jjk';

// DEPOIS:
import { selectActiveStoryCardsForTurn } from '../src/shared/lib/jjkEngine';
import type { StoryCard } from '../src/shared/types/jjk';
```

**Arquivo:** `scripts/test-opening.ts`
```typescript
// ANTES:
import { STARTING_ARCS } from '../src/data/startingArcs';

// DEPOIS:
import { STARTING_ARCS } from '../src/shared/data/startingArcs';
```

**Arquivo:** `scripts/extract-initial-cards.ts`
```typescript
// ANTES:
import { INITIAL_STORY_CARDS } from '../src/data/initialCodex.ts';
import { categoryForType } from '../src/utils/codexCategories.ts';
import type { StoryCard } from '../src/types/jjk.ts';

// DEPOIS:
import { INITIAL_STORY_CARDS } from '../src/shared/data/initialCodex.ts';
import { categoryForType } from '../src/shared/lib/codexCategories.ts';
import type { StoryCard } from '../src/shared/types/jjk.ts';
```

### Task 12: Atualizar `vite.config.ts` (alias opcional para FSD)
**Arquivo:** `vite.config.ts`
```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        // Opcional: alias FSD para imports mais limpos
        '@/app': path.resolve(import.meta.dirname, 'src/app'),
        '@/pages': path.resolve(import.meta.dirname, 'src/pages'),
        '@/widgets': path.resolve(import.meta.dirname, 'src/widgets'),
        '@/features': path.resolve(import.meta.dirname, 'src/features'),
        '@/entities': path.resolve(import.meta.dirname, 'src/entities'),
        '@/shared': path.resolve(import.meta.dirname, 'src/shared'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```

**Nota:** Os aliases são opcionais — os imports relativos funcionam imediatamente. Os aliases podem ser adotados gradualmente em follow-ups.

### Task 13: Limpar diretórios antigos vazios
**Comando:**
```bash
rmdir src/types src/utils src/services src/data src/components 2>/dev/null || true
```
**Validação:**
```bash
ls -d src/types src/utils src/services src/data src/components 2>&1 | grep -q "No such file" && echo "OK: diretórios removidos"
```

### Task 14: Atualizar `package.json` scripts de teste
**Arquivo:** `package.json` (campo `scripts.test`)
```json
{
  "scripts": {
    "test": "tsx --test src/shared/tests/jjkEngine.test.ts src/features/narrative/tests/geminiService.stream.test.ts src/server/providers/jsonRepair.test.ts src/server/providers/openAiCompatProvider.test.ts src/server/providers/providerRegistry.test.ts src/server/providers/gmTurnRunner.test.ts src/shared/tests/characterVoiceResolver.test.ts src/server/canonicalVoices.test.ts src/server/promptBuilder.test.ts src/shared/tests/codexCompiler.test.ts src/shared/tests/storyCardEra.test.ts"
  }
}
```

## Testes / Validação

### Após cada task:
```bash
npm run lint    # tsc --noEmit — deve falhar com erros de import esperado até Task 9
npm test        # tsx --test — deve falhar até Task 12
npm run build   # vite build — deve falhar até Task 12
```

### Após Task 13 (migração completa):
```bash
npm run lint    # Esperado: 0 errors (ou o mesmo erro de tipo pré-existente em campaignMemory.test.ts)
npm test        # Esperado: 31 passed, 0 failed (baseline pré-migração)
npm run build   # Esperado: build limpo, dist/ gerado
```

**Comando de verificação final:**
```bash
echo "=== Lint ===" && npm run lint && echo "=== Tests ===" && npm test && echo "=== Build ===" && npm run build && echo "=== All checks passed ==="
```

## Riscos, trade-offs e questões abertas

### Riscos
1. **Erros de import em cascata:** Um path errado quebra múltiplos arquivos. Mitigação: validar com `npm run lint` após cada task.
2. **Testes quebrados:** Os `.test.ts` têm imports relativos para os módulos testados. Mitigação: atualizar imports dos testes junto com os módulos.
3. **Server.ts:** O servidor importa de `./src/...` e precisa de updates manuais. Mitigação: Task 10 dedicada.
4. **Scripts:** Os scripts em `scripts/` também importam do `src/`. Mitigação: Task 11 dedicada.

### Trade-offs
1. **Profundidade de imports:** FSD aumenta a profundidade dos paths (`../../shared/types/jjk` vs `../types/jjk`). Isso é mitigável com aliases `@/shared/types/jjk` em follow-up.
2. **Camadas finas vs grossas:** Optamos por colocar múltiplos utilitários em `shared/lib/` ao invés de criar um `shared/lib/jjkEngine/`, `shared/lib/codex/`, etc. para manter a migração manejável. Refinamentos podem vir depois.
3. **Server/ permanece separado:** O backend não foi integrado ao FSD pois é um contexto diferente (Node/Express vs React/Vite). Isso é intencional — server/ pode ser migrado para uma estrutura API layer em follow-up.

### Questões abertas
1. **Aliases `@/` devem ser adotados agora ou em follow-up?** Recomendo follow-up para manter esta migração focada em estrutura.
2. **`src/utils/campaignMemory.ts` e `.test.ts` têm um erro de tipo pré-existente** (TS2322 em worldStateUpdate). Deve ser corrigido antes ou durante a migração? Recomendo corrigir separadamente para não misturar concerns.
3. **`server/promptsMemory.test.ts`** (93 lines) apareceu na contagem mas não está no `package.json test` script. Deve ser incluído?

## Commit strategy
- Um commit por task (14 commits total)
- Mensagens seguem Conventional Commits: `refactor(fsd): move shared/types`, `refactor(fsd): move shared/lib`, etc.
- Commit final: `refactor(fsd): complete FSD architecture migration`

## Métricas de sucesso
- [ ] `npm run lint` → 0 errors (ou baseline pré-existente)
- [ ] `npm test` → 31 passed, 0 failed (baseline)
- [ ] `npm run build` → dist/ gerado sem errors
- [ ] Nenhum import quebrado no código
- [ ] Estrutura de diretórios FSD implementada
- [ ] Server.ts e scripts atualizados
