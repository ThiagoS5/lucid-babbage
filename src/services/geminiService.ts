import {
  ActionMode,
  CharacterSheet,
  GmTurnResponse,
  WorldStateUpdate,
} from '../types/jjk';
import type { ProviderInfo, ProviderSpec } from '../types/provider';
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
  /** Provedor efetivamente testado (quando não for o Gemini). */
  usedProvider?: string;
}

export async function validateGeminiConnection(
  preferredModel = 'gemini-3.8-flash',
  customApiKey?: string,
  provider?: ProviderSpec
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
      body: JSON.stringify({ model: preferredModel, customApiKey: storedKey, provider }),
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
      usedProvider: typeof data.usedProvider === 'string' ? data.usedProvider : undefined,
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

/** Provedores suportados pelo servidor (configurados no ambiente). */
export async function fetchProviderCatalog(): Promise<ProviderInfo[]> {
  try {
    const res = await apiFetch('/api/providers');
    const data = await res.json();
    return Array.isArray(data.providers) ? (data.providers as ProviderInfo[]) : [];
  } catch {
    return [];
  }
}

export interface TurnRequestPayload {
  model: string;
  character: CharacterSheet;
  world: WorldStateUpdate;
  actionMode: ActionMode;
  actionText: string;
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
  /**
   * Provedor escolhido na UI (NIM/OpenRouter/custom). A chave viaja no corpo
   * da requisição e nunca é persistida no servidor. Ausente = usar Gemini.
   */
  provider?: ProviderSpec;
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
  let terminal = false;

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
      terminal = true;
      finalResult = {
        ok: true,
        data: data.data as GmTurnResponse,
        usedModel: typeof data.usedModel === 'string' ? data.usedModel : undefined,
        switchedFromPrimary: Boolean(data.switchedFromPrimary),
        apiKeyState: (data.apiKeyState as ApiKeyHealthState) || 'VALID',
      };
    } else if (eventName === 'error') {
      terminal = true;
      finalResult = {
        ok: false,
        reason: typeof data.reason === 'string' ? data.reason : 'ERROR',
        errorMessage: typeof data.message === 'string' ? data.message : undefined,
      };
    }
  };

  const processBuffer = () => {
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
  };

  // Se o servidor terminar de gerar mas a conexão não fechar, não podemos
  // deixar a UI presa em "gerando". O evento terminal encerra na hora; um
  // watchdog cobre queda silenciosa da conexão.
  const STALL_MS = 45_000;

  try {
    while (!terminal) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), STALL_MS);
      });
      const readPromise = reader.read();
      // Evita rejeição não tratada se o cancelamento acontecer após o timeout.
      readPromise.catch(() => {});
      const read = await Promise.race([readPromise, timeout]);
      if (timer) clearTimeout(timer);

      if (read === 'timeout') {
        try {
          await reader.cancel();
        } catch {
          // Reader already closed.
        }
        return finalResult.ok
          ? finalResult
          : {
              ok: false,
              reason: 'STREAM_STALL',
              errorMessage: 'A conexão de streaming ficou inativa. Tentando o modo não-streaming.',
            };
      }

      if (read.done) break;

      buf += decoder.decode(read.value, { stream: true });
      processBuffer();

      if (terminal) {
        try {
          await reader.cancel();
        } catch {
          // Reader already closed.
        }
        return finalResult;
      }
    }

    // Último bloco sem delimitador final.
    if (!terminal && buf.trim()) {
      buf += '\n\n';
      processBuffer();
    }

    return finalResult;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Lock already released or stream cancelled.
    }
  }
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
