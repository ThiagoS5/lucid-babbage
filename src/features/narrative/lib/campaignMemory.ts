import type { CampaignState, MemoryEntry } from '@/shared/types/jjk';
import { CAMPAIGN_STORAGE_KEY } from '@/shared/lib/storageManager';

export const MAX_MEMORY_CONTEXT_LENGTH = 10000;

export interface FormatMemoryOptions {
  maxCharacters?: number;
}

/**
 * Formata a lista de memórias da campanha em um bloco de texto legível para o Mestre.
 * Deduplica entradas com mesmo ID ou com mesmo (turnRange + summary) e respeita o
 * teto de caracteres priorizando as memórias mais recentes para evitar estourar a janela de contexto.
 */
export function formatMemoryContext(
  memories?: MemoryEntry[] | null,
  options?: FormatMemoryOptions
): string {
  if (!memories || !Array.isArray(memories) || memories.length === 0) {
    return '';
  }

  const maxChars = options?.maxCharacters ?? MAX_MEMORY_CONTEXT_LENGTH;
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const deduplicated: MemoryEntry[] = [];

  for (const m of memories) {
    if (!m || typeof m !== 'object') continue;
    const turnRange = String(m.turnRange || '').trim();
    const summary = String(m.summary || '').trim();
    if (!summary) continue;

    if (m.id && seenIds.has(m.id)) continue;
    const signature = `${turnRange}::${summary}`;
    if (seenSignatures.has(signature)) continue;

    if (m.id) seenIds.add(m.id);
    seenSignatures.add(signature);
    deduplicated.push({ ...m, turnRange, summary });
  }

  if (deduplicated.length === 0) return '';

  const formattedLines = deduplicated.map((m) =>
    m.turnRange ? `[${m.turnRange}]: ${m.summary}` : m.summary
  );

  let fullText = formattedLines.join('\n');
  if (fullText.length <= maxChars) {
    return fullText;
  }

  // Se exceder o teto, retém as memórias mais recentes de trás para frente
  const keptLines: string[] = [];
  let currentLength = 0;

  for (let i = formattedLines.length - 1; i >= 0; i--) {
    const line = formattedLines[i];
    const addedLength = (keptLines.length > 0 ? 1 : 0) + line.length;
    if (currentLength + addedLength <= maxChars) {
      keptLines.unshift(line);
      currentLength += addedLength;
    } else {
      break;
    }
  }

  if (keptLines.length > 0) {
    return keptLines.join('\n');
  }

  // Se nem a última memória inteira couber no teto, trunca ela com segurança
  const lastLine = formattedLines[formattedLines.length - 1];
  return `${lastLine.slice(0, Math.max(0, maxChars - 20))}... [truncado]`;
}

/**
 * Adiciona uma nova memória à campanha de forma imutável e defensiva,
 * evitando duplicação idêntica consecutiva.
 */
export function appendMemory(
  memories: MemoryEntry[] | undefined | null,
  newEntry: {
    turnRange: string;
    summary: string;
    id?: string;
    timestamp?: string;
  }
): MemoryEntry[] {
  const current = Array.isArray(memories) ? [...memories] : [];
  const turnRange = String(newEntry.turnRange || '').trim();
  const summary = String(newEntry.summary || '').trim();

  if (!summary) return current;

  // Evita duplicar memória idêntica se a última já tiver o mesmo resumo e intervalo
  const last = current[current.length - 1];
  if (last && last.turnRange === turnRange && last.summary === summary) {
    return current;
  }

  const entry: MemoryEntry = {
    id: newEntry.id || `mem-${Date.now()}-${crypto.randomUUID().slice(0, 7)}`,
    turnRange: turnRange || 'Turnos Recentes',
    summary,
    timestamp: newEntry.timestamp || new Date().toISOString(),
  };

  return [...current, entry];
}

/**
 * Lê com segurança a memória consolidada salva no localStorage da campanha ativa.
 */
export function getCampaignMemoryContextFromStorage(storage?: Storage): string {
  const targetStorage =
    storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return '';

  try {
    const raw = targetStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) return '';
    const parsed: Partial<CampaignState> = JSON.parse(raw);
    return formatMemoryContext(parsed.memories);
  } catch {
    return '';
  }
}
