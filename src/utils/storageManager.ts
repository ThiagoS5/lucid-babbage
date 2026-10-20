import type { CampaignState, StoryCard } from '../types/jjk';
import { generateSceneIllustrationSvg } from './svgArtGenerator';

export const CAMPAIGN_STORAGE_KEY = 'jjk_cursed_chronicles_campaign_v1';
export const CODEX_STORAGE_KEY = 'jjk_cursed_chronicles_codex_v1';

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
