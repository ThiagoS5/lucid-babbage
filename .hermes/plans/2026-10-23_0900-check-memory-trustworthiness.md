Goal
=====
Verify that the system correctly persists and retrieves the master narrator’s memories, integrity and context throughout a campaign:

1. Ensure that memories are stored in the campaign data object with the required schema.
2. Check that each prompt includes the full `memoryContext` string exactly as persisted.
3. Test that the `memoryContext` is updated after each turn without loss or duplication.
4. Confirm that the narrative does not contain anomalies caused by stale memory or accidental resets.

Current context / assumptions
----------------------------
- The `campaign` object (state in `src/App.tsx`) holds a `memories` array and a `memoryContext` string.
- The `memoryContext` string is passed from the client (React) to the server via the `/api/gemini/turn` endpoint.
- The server passes `memoryContext` into `renderArcContract()` inside `promptBuilder.ts`.
- `renderArcContract()` uses the value for the “Início da campanha” fallback.
- The onserver response JSON contains `memoryContext` as `narrativeContext` (?) We will confirm.
- There are no test modules that cover memory persistence; we need new tests.

Architecture / proposed approach
--------------------------------
We will orchestrate a small integration test that:
1. Loads an initial campaign (with empty `memoryContext`).
2. Submits a turn (either a mock or minimal request) with a short `memoryContext`.
3. Retrieves the turn response and verifies that the `narrativeContext` or `memoryContext` is echoed back.
4. Adds another turn with an updated `memoryContext` and verifies that it is appended.
5. Checks the persisted campaign JSON in the browser localStorage or in memory to confirm no duplication.

Step‑by‑step tasks
------------------
1. **Add a helper function** in `src/utils/campaignMemory.ts` that reads the current campaign object from localStorage and returns `campaign.memoryContext`.

   ```ts
   // src/utils/campaignMemory.ts
   import type { CampaignState } from '../types/jjk';
   export function getCampaignMemoryContext(): string {
     const key = 'campaign-state'; // CAMPAIGN_STORAGE_KEY in storageManager.ts
     const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
     if (!stored) return '';
     try {
       const parsed: CampaignState = JSON.parse(stored);
       return parsed.memoryContext ?? '';
     } catch { return ''; }
   }
   ```
   **Command to verify**: `node -e "console.log(require('./src/utils/campaignMemory').getCampaignMemoryContext())"` – expected `''` in a fresh environment.

2. **Create a minimal test** in `src/server/promptsMemory.test.ts` that:
   * Mocks `localStorage` with an initial campaign.
   * Calls `executeNarrativeTurn` (from `geminiService.ts`) with a payload containing a test `memoryContext`.
   * Expects the returned JSON to include the same `memoryContext` string in the `narrativeContext` field.
   ```ts
   // src/server/promptsMemory.test.ts
   import { executeNarrativeTurn } from '../services/geminiService';
   import { TurnRequestPayload } from '../services/geminiService';

   describe('memory persistence', () => {
     beforeEach(() => {
       (global as any).localStorage = {
         getItem: jest.fn(() => JSON.stringify({ memories: [], memoryContext: '' })),
         setItem: jest.fn(),
       };
     });

     it('passes memoryContext through the prompt', async () => {
       const payload: TurnRequestPayload = {
         character: {},
         world: {},
         actionMode: 'DO',
         actionText: 'Teste',
         revealedHandVow: false,
         combinedRagContext: 'hola',
         isOpening: true,
         customOpeningPrompt: '',
         memoryContext: 'First memory',
         recentHistory: '',
         provider: 'gemini',
         customApiKey: ''
       };

       const res = await executeNarrativeTurn(payload);
       expect(res.ok).toBe(true);
       expect(res.data.narrativeContext).toContain('First memory');
     });
   });
   ```
   **Command to run**: `npx tsx --test src/server/promptsMemory.test.ts` – expect a passing test.

3. **Add integration test** that simulates two consecutive turns and verifies that `memoryContext` grows.
   * Use the same `executeNarrativeTurn` calls.
   * After the first turn, use the `memoryContext` returned from the response, concatenate a new phrase, and send as the second turn.
   * Verify that the second response contains both phrases in order.
   ```ts
   it('appends memoryContext over turns', async () => {
     const first = await executeNarrativeTurn(payloadWithFirstMemory);
     const secondContext = first.data.narrativeContext + ' + second memory';
     const second = await executeNarrativeTurn({ ...payloadWithFirstMemory, memoryContext: secondContext });
     expect(second.data.narrativeContext).toContain('First memory');
     expect(second.data.narrativeContext).toContain('second memory');
   });
   ```

4. **Validate that the campaign JSON updated in the browser** by mocking `localStorage.setItem` and asserting that the payload includes the updated `memoryContext`.
   ```ts
   it('updates stored campaign memory', async () => {
     const setItemMock = jest.fn();
     (global as any).localStorage = {
       getItem: jest.fn(() => JSON.stringify({ memories: [], memoryContext: '' })),
       setItem: setItemMock,
     };
     await executeNarrativeTurn(payloadWithFirstMemory);
     const stored = JSON.parse(setItemMock.mock.calls[0][1]);
     expect(stored.memoryContext).toContain('First memory');
   });
   ```

5. **Add a runtime check**: If the `memoryContext` string length exceeds 10 000 chars, truncate with `memoryContext.slice(0, 10000)` and throw an error with a clear message. Implement this guard in `renderArcContract()`.
   ```ts
   // Inside renderArcContract
   const safeContext = memoryContext.length > 10000 ? memoryContext.slice(0, 10000) : memoryContext;
   return `Início da campanha: ${safeContext}`; // simplified
   ```
   **Command**: `sed -n '210,250p' src/server/promptBuilder.ts` – confirm the guard insertion.

6. **Cleanup**: Remove temporary helper or storage mocks after tests; ensure tests don't persist localStorage data.

Tests / validation
-----------------
- Run `npm run test` to run all test suites.
- Expect at least two new tests in the `promptBuilder.test` or `promptsMemory.test` suites to pass.
- Check `npm run lint` passes with no warnings.

Risks, trade‑offs, and open questions
--------------------------------------
- **Risk**: The server may ignore the `memoryContext` if the API endpoint is updated without the new field. Adding a test confirms contract stability.
- **Trade‑off**: Keeping memory in-memory may risk losing data if the page reloads. Persisting to localStorage is a chosen compromise; if the OP wants server‑side persistent memory, a different approach is required.
- **Open question**: Should we shard `memoryContext` into chunks for large campaigns? This plan only checks basic concatenation.
---
Plan is written to the file: .hermes/plans/2026-10-23_0900-check-memory-trustworthiness.md

## Execution Report & Architectural Corrections

### Defects & Misalignments in Original Plan:
1. **Data Model**: The plan assumed `CampaignState` stores `memoryContext: string`. In reality, `CampaignState.memories` is an array of `MemoryEntry` (`id`, `turnRange`, `summary`, `timestamp`). `memoryContext` is a derived prompt string computed from `memories`.
2. **Storage Key**: The plan stated `'campaign-state'`. The actual project storage key is `CAMPAIGN_STORAGE_KEY = 'jjk_cursed_chronicles_campaign_v1'`.
3. **Data Flow**: `executeNarrativeTurn` makes an HTTP call to the backend and does not directly mutate browser `localStorage` nor does it echo a raw `narrativeContext` field. Persistence is handled by `saveCampaignStateSafe()`.
4. **Test Framework**: The plan used Jest (`describe`, `it`, `jest.fn()`). The codebase uses Node's native test runner (`node:test` + `node:assert/strict`).
5. **Storage Migration Bug Found & Fixed**: `migrateCampaignToNarrative()` in `src/utils/storageManager.ts` was dropping `memories` on migrated saves. Fixed by initializing `memories: Array.isArray(campaign.memories) ? campaign.memories : []`.

### Implemented Modules:
- `src/utils/campaignMemory.ts`:
  - `formatMemoryContext(memories, options)`: Formats and deduplicates entries by id and `(turnRange + summary)` signature; limits size to `MAX_MEMORY_CONTEXT_LENGTH = 10000`, prioritizing newest memories.
  - `appendMemory(memories, newEntry)`: Safely creates an immutable new memory array with timestamp and unique id, avoiding consecutive duplicates.
  - `getCampaignMemoryContextFromStorage(storage)`: Safe retrieval and formatting from browser storage.
- `src/server/promptBuilder.ts`:
  - `MAX_PROMPT_MEMORY_LENGTH = 10000`.
  - `sanitizeMemoryContext()`: Fallback to `'Início da campanha.'` and safe truncation with note.
  - `buildTurnPrompt()`: Injects `=== MEMÓRIA CONSOLIDADA DA CAMPANHA ===` into continuity turns and non-empty opening turns.
- `src/App.tsx`:
  - Standardized memory string generation using `formatMemoryContext()`.
  - Updated memory summarization using `appendMemory()`.
- Tests:
  - `src/utils/campaignMemory.test.ts`: 10 unit tests.
  - `src/server/promptsMemory.test.ts`: 6 unit tests.
  - Total project tests: increased from 54 to 70 (all passing).
  - `npm run lint` and `npm run build`: 100% clean.
