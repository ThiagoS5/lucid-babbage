import { extractJsonObject } from './jsonRepair.ts';
import type { GmCompletionRequest, GmProvider } from './types.ts';

export interface GmTurnResult {
  ok: boolean;
  providerId: string;
  usedModel: string;
  data: unknown;
}

/**
 * Converte o texto cru do provedor no objeto de turno do Mestre. Lança quando
 * o JSON é irrecuperável ou não traz a narrativa — nesse caso o chamador
 * decide a cadeia de fallback (provedor externo -> Gemini -> Motor local).
 */
export function parseGmTurnJson(raw: string): unknown {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('O provedor não devolveu um objeto de turno.');
  }
  const narrative = (parsed as { narrative?: unknown }).narrative;
  if (typeof narrative !== 'string' || !narrative.trim()) {
    throw new Error('A resposta do provedor não contém a narrativa do turno.');
  }
  return parsed;
}

/**
 * Executa um turno no provedor externo. `onDelta` (opcional) recebe os
 * trechos progressivos: no streaming, o texto bruto do JSON; no modo normal,
 * só a resposta completa.
 */
export async function runExternalTurn(
  provider: GmProvider,
  req: GmCompletionRequest,
  onDelta?: (delta: string) => void
): Promise<GmTurnResult> {
  if (onDelta) {
    const raw = await provider.streamTurn(req, onDelta);
    const data = parseGmTurnJson(raw);
    return { ok: true, providerId: provider.id, usedModel: provider.model, data };
  }

  const raw = await provider.completeTurn(req);
  const data = parseGmTurnJson(raw);
  return { ok: true, providerId: provider.id, usedModel: provider.model, data };
}
