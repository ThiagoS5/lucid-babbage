import {
  ActionMode,
  CharacterSheet,
  GmTurnResponse,
  WorldStateUpdate,
} from '../types/jjk';
import { getAccessHeaders } from './accessGuard';

/**
 * Fetch autenticado para a API local. O código de acesso (quando o servidor
 * define APP_ACCESS_CODE) vai no cabeçalho x-access-code.
 */
async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(getAccessHeaders())) {
    headers.set(key, value);
  }
  return fetch(input, { ...init, headers });
}

export type ApiKeyHealthState =
  | 'CHECKING'
  | 'VALID'
  | 'MISSING'
  | 'INVALID'
  | 'QUOTA_EXCEEDED';

export interface GeminiConnectionReport {
  state: ApiKeyHealthState;
  modelTested: string;
  latencyMs?: number;
  message: string;
  fallbackActive: boolean;
  checkedAt: string;
}

export async function validateGeminiConnection(
  preferredModel = 'gemini-3.8-flash',
  customApiKey?: string
): Promise<GeminiConnectionReport> {
  const startMs = Date.now();
  const storedKey =
    (customApiKey && customApiKey.trim()) ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('JJK_CUSTOM_GEMINI_KEY') || ''
      : '');

  try {
    const res = await apiFetch('/api/gemini/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(storedKey ? { 'x-custom-api-key': storedKey } : {}),
      },
      body: JSON.stringify({ model: preferredModel, customApiKey: storedKey }),
    });
    const data = await res.json();
    return {
      state: (data.state as ApiKeyHealthState) || 'INVALID',
      modelTested: data.modelTested || preferredModel,
      latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : Date.now() - startMs,
      fallbackActive: Boolean(data.fallbackActive ?? data.state !== 'VALID'),
      message:
        data.message ||
        'Não foi possível validar a chave GEMINI_API_KEY.',
      checkedAt: data.checkedAt || new Date().toISOString(),
    };
  } catch {
    return {
      state: 'INVALID',
      modelTested: preferredModel,
      latencyMs: Date.now() - startMs,
      fallbackActive: true,
      message: 'Não foi possível verificar o servidor de validação.',
      checkedAt: new Date().toISOString(),
    };
  }
}

export interface TurnRequestPayload {
  model: string;
  character: CharacterSheet;
  world: WorldStateUpdate;
  actionMode: ActionMode;
  actionText: string;
  diceRoll: number;
  revealedHandVow: boolean;
  ragContext: string;
  activeCards: string[];
  memoryContext: string;
  recentHistory: string;
  isOpening: boolean;
  startingArcTitle?: string;
  customOpeningPrompt?: string;
  arcObjective?: string;
  customApiKey?: string;
}

/**
 * Executa o turno SEMPRE via servidor. O servidor concentra a chave da API,
 * o RAG profundo (283 Story Cards + Códice de 1,1 MB) e a cadeia de modelos.
 */
export async function executeNarrativeTurn(
  payload: TurnRequestPayload
): Promise<{
  ok: boolean;
  usedFallback?: boolean;
  apiKeyState?: ApiKeyHealthState;
  statusNotice?: string;
  usedModel?: string;
  switchedFromPrimary?: boolean;
  errorMessage?: string;
  message?: string;
  reason?: string;
  data: GmTurnResponse;
}> {
  const storedKey =
    payload.customApiKey ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('JJK_CUSTOM_GEMINI_KEY') || ''
      : '');

  const res = await apiFetch('/api/gemini/turn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(storedKey ? { 'x-custom-api-key': storedKey } : {}),
    },
    body: JSON.stringify({ ...payload, customApiKey: storedKey }),
  });
  return await res.json();
}

export interface StreamTurnResult {
  ok: boolean;
  data?: GmTurnResponse;
  usedModel?: string;
  switchedFromPrimary?: boolean;
  apiKeyState?: ApiKeyHealthState;
  statusNotice?: string;
  errorMessage?: string;
  reason?: string;
}

/**
 * Executa o turno com narração em streaming (SSE). `onDelta` recebe os trechos
 * progressivos da narração conforme são gerados. Retorna o estado estruturado
 * completo ao final (ou um erro para cair no fallback não-streaming).
 */
export async function streamNarrativeTurn(
  payload: TurnRequestPayload,
  onDelta: (text: string) => void
): Promise<StreamTurnResult> {
  const storedKey =
    payload.customApiKey ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('JJK_CUSTOM_GEMINI_KEY') || ''
      : '');

  const res = await apiFetch('/api/gemini/turn/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(storedKey ? { 'x-custom-api-key': storedKey } : {}),
    },
    body: JSON.stringify({ ...payload, customApiKey: storedKey }),
  });

  if (!res.body) {
    return { ok: false, reason: 'NO_STREAM', errorMessage: 'Sem corpo de resposta do servidor.' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  let finalResult: StreamTurnResult = { ok: false, reason: 'STREAM_CLOSED' };

  const handleEvent = (eventName: string, dataStr: string) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }
    if (eventName === 'delta' && typeof data.text === 'string') {
      onDelta(data.text);
    } else if (eventName === 'done') {
      finalResult = {
        ok: true,
        data: data.data as GmTurnResponse,
        usedModel: typeof data.usedModel === 'string' ? data.usedModel : undefined,
        switchedFromPrimary: Boolean(data.switchedFromPrimary),
        apiKeyState: (data.apiKeyState as ApiKeyHealthState) || 'VALID',
      };
    } else if (eventName === 'error') {
      finalResult = {
        ok: false,
        reason: typeof data.reason === 'string' ? data.reason : 'ERROR',
        errorMessage: typeof data.message === 'string' ? data.message : undefined,
      };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sepIdx: number;
    while ((sepIdx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, sepIdx);
      buf = buf.slice(sepIdx + 2);
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length > 0) {
        handleEvent(eventName, dataLines.join('\n'));
      }
    }
  }

  return finalResult;
}

export interface ImageGenerationPayload {
  prompt: string;
  nanoBananaAnimePrompt?: string;
  narrativeContext?: string;
  characterSummary?: string;
  location?: string;
  aspectRatio?: '16:9' | '1:1';
  customApiKey?: string;
  /** URLs locais (/portraits/...) ou data URIs (base64) para referência de consistência. */
  referenceImages?: string[];
  /** Texto descritivo dos personagens que devem aparecer na cena. */
  charactersInScene?: string[];
}

export async function generateAnimeImage(
  payload: ImageGenerationPayload
): Promise<{
  ok: boolean;
  imageUrl?: string;
  modelUsed?: string;
  nanoBananaPromptLog?: string;
  reason?: string;
  message?: string;
}> {
  const res = await apiFetch('/api/gemini/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function forgeBalancedTechnique(payload: {
  concept: string;
  characterName: string;
  backstory?: string;
  combatStyle?: string;
  faction: string;
  grade: string;
  customApiKey?: string;
}) {
  const res = await apiFetch('/api/gemini/technique', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function evaluateSessionZero(payload: {
  characterDraft: Record<string, unknown>;
  conversationHistory: Array<{ sender: string; text: string }>;
  playerReply: string;
  customApiKey?: string;
}) {
  const res = await apiFetch('/api/gemini/session-zero', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function summarizeCampaignMemory(payload: {
  turnsText: string;
  turnRange: string;
  customApiKey?: string;
}): Promise<{ ok: boolean; summary?: string }> {
  const res = await apiFetch('/api/gemini/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}
