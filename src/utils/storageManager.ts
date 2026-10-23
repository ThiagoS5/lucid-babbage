import type { CampaignState, StoryCard } from '../types/jjk';
import { generateSceneIllustrationSvg } from './svgArtGenerator';

export const CAMPAIGN_STORAGE_KEY = 'jjk_cursed_chronicles_campaign_v1';
export const CODEX_STORAGE_KEY = 'jjk_cursed_chronicles_codex_v1';

/**
 * Saves antigos podem conter campos do sistema de mesa removido (HP, energia,
 * XP, níveis, perícias, pilares, dados). Remove esses campos na leitura para que
 * eles nunca voltem à UI nem ao prompt do Mestre.
 */
export function migrateCampaignToNarrative(raw: unknown): CampaignState | null {
  if (!raw || typeof raw !== 'object') return null;
  const campaign = raw as CampaignState;
  if (!campaign.character || !Array.isArray(campaign.turns)) return null;

  const legacyCharacterKeys = [
    'hpPercentage',
    'cursedEnergyPercentage',
    'outputPercentage',
    'techniqueState',
    'inBlackFlashZone',
    'progression',
    'narrativePillars',
    'narrativeSkills',
  ];

  const cleanCharacter = (character: unknown) => {
    if (!character || typeof character !== 'object') return character;
    const clone = { ...(character as Record<string, unknown>) };
    for (const key of legacyCharacterKeys) delete clone[key];
    return clone;
  };

  const cleanNpc = (npc: unknown) => {
    if (!npc || typeof npc !== 'object') return npc;
    const clone = { ...(npc as Record<string, unknown>) };
    delete clone.hpPercentage;
    return clone;
  };

  const cleanWorld = (world: unknown) => {
    if (!world || typeof world !== 'object') return world;
    const clone = { ...(world as Record<string, unknown>) };
    if (Array.isArray(clone.npcsInScene)) clone.npcsInScene = clone.npcsInScene.map(cleanNpc);
    return clone;
  };

  const cleanPlayerState = (psu: unknown) => {
    if (!psu || typeof psu !== 'object') return psu;
    const clone = { ...(psu as Record<string, unknown>) };
    for (const key of [
      'hpPercentage',
      'cursedEnergyPercentage',
      'outputPercentage',
      'techniqueState',
      'inBlackFlashZone',
      'xpGained',
      'levelUpReason',
    ]) {
      delete clone[key];
    }
    return clone;
  };

  return {
    ...campaign,
    character: cleanCharacter(campaign.character) as CampaignState['character'],
    world: cleanWorld(campaign.world) as CampaignState['world'],
    memories: Array.isArray(campaign.memories) ? campaign.memories : [],
    turns: campaign.turns.map((turn) => ({
      ...turn,
      playerAction: turn.playerAction
        ? (() => {
            const action = { ...(turn.playerAction as unknown as Record<string, unknown>) };
            delete action.diceRoll;
            return action;
          })()
        : turn.playerAction,
      gmResponse: {
        ...turn.gmResponse,
        playerStateUpdate: cleanPlayerState(turn.gmResponse?.playerStateUpdate),
        worldStateUpdate: cleanWorld(turn.gmResponse?.worldStateUpdate),
      },
      snapshot: turn.snapshot
        ? {
            ...turn.snapshot,
            character: cleanCharacter(turn.snapshot.character) as CampaignState['character'],
            world: cleanWorld(turn.snapshot.world) as CampaignState['world'],
          }
        : turn.snapshot,
    })),
  } as CampaignState;
}

const IDB_NAME = 'jjk_cursed_chronicles_db';
const IDB_STORE = 'codex_store';

function openCodexDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomCodexSafe(cards: StoryCard[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CODEX_STORAGE_KEY, JSON.stringify(cards));
  } catch {
    // QuotaExceededError (>5MB when importing large .md/.json codex): store in IndexedDB
    try {
      localStorage.removeItem(CODEX_STORAGE_KEY);
      const db = await openCodexDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(cards, 'custom_codex');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore fallback error
    }
  }
}

export async function loadCustomCodexSafe(): Promise<StoryCard[]> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CODEX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore localStorage parse error
  }

  try {
    const db = await openCodexDb();
    return await new Promise<StoryCard[]>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('custom_codex');
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? req.result : []);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Saves the campaign state to localStorage without `customCodex` (which is stored separately).
 * If `localStorage.setItem` throws `QuotaExceededError`, automatically replaces heavy base64
 * images on older turns with lightweight SVG illustrations so saving never fails silently.
 */
export function saveCampaignStateSafe(campaign: CampaignState): void {
  if (typeof window === 'undefined') return;

  const stateWithoutCodex: CampaignState = {
    ...campaign,
    customCodex: [],
  };

  try {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(stateWithoutCodex));
  } catch {
    // Compact heavy base64 images on older turns and retry
    try {
      const compacted: CampaignState = {
        ...stateWithoutCodex,
        turns: stateWithoutCodex.turns.map((t, idx, arr) => {
          const isLatest = idx === arr.length - 1;
          const isHeavyBase64 = t.sceneImageUrl?.startsWith('data:image/png;base64') ||
            t.sceneImageUrl?.startsWith('data:image/jpeg;base64');
          if (!isLatest && isHeavyBase64) {
            return {
              ...t,
              sceneImageUrl: generateSceneIllustrationSvg(
                t.gmResponse.imagePrompt || stateWithoutCodex.world.location,
                t.gmResponse.visualEffectTrigger
              ),
            };
          }
          return t;
        }),
        npcAvatars: {},
      };
      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(compacted));
    } catch {
      // Ultimate fallback: keep last 20 turns without base64 images
      try {
        const ultraCompact: CampaignState = {
          ...stateWithoutCodex,
          turns: stateWithoutCodex.turns.slice(-20).map((t) => ({
            ...t,
            sceneImageUrl: generateSceneIllustrationSvg(
              stateWithoutCodex.world.location,
              t.gmResponse.visualEffectTrigger
            ),
          })),
          npcAvatars: {},
        };
        localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(ultraCompact));
      } catch {
        // Nothing else possible
      }
    }
  }
}
