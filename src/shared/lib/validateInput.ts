/**
 * Validação e sanitização de inputs — aplicada tanto no client quanto no server.
 * Previne XSS, injeção de código e abuso por limites de tamanho.
 */

const MAX_TEXT_LENGTHS = {
  API_KEY: 256,
  URL: 2048,
  ACTION_TEXT: 2000,
  SYSTEM_INSTRUCTION: 32768,
  PROMPT: 65536,
  MEMORY_CONTEXT: 32768,
  RAG_CONTEXT: 65536,
};

/**
 * Remove caracteres de controle e sanitiza strings para evitar XSS/Injeção.
 * Permite caracteres alfanuméricos, pontuação e acentos (UTF-8).
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove controles
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<link[^>]*>/gi, '') // Remove links
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '') // Remove styles
    .trim();
}

/**
 * Valida tamanho do input e sanitiza.
 * Retorna objeto com success/invalidReason e value limpo.
 */
export function validateAndSanitize<T extends 'API_KEY' | 'URL' | 'ACTION_TEXT' | 'SYSTEM_INSTRUCTION' | 'PROMPT' | 'MEMORY_CONTEXT' | 'RAG_CONTEXT'>(input: unknown, type: T): { success: boolean; value?: string; invalidReason?: string } {
  if (typeof input !== 'string') {
    return { success: false, invalidReason: `Esperado string, recebido ${typeof input}` };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, invalidReason: 'Campo vazio' };
  }

  const sanitized = sanitizeInput(trimmed);
  const maxLength = MAX_TEXT_LENGTHS[type];

  if (sanitized.length > maxLength) {
    return { success: false, invalidReason: `Máximo de ${maxLength} caracteres (atual: ${sanitized.length})` };
  }

  // Validação específica por tipo
  if (type === 'URL') {
    try {
      new URL(sanitized);
    } catch {
      return { success: false, invalidReason: 'URL inválida' };
    }
  }

  if (type === 'API_KEY') {
    // API keys geralmente têm formato específico; não bloqueamos caracteres,
    // mas verificamos tamanho mínimo razoável
    if (sanitized.length < 8) {
      return { success: false, invalidReason: 'Chave de API parece inválida (muito curta)' };
    }
  }

  return { success: true, value: sanitized };
}

/**
 * Validação de action mode (DO, SAY, TECHNIQUE, STORY).
 */
export function validateActionMode(input: unknown): { success: boolean; value?: string; invalidReason?: string } {
  const modes: string[] = ['DO', 'SAY', 'TECHNIQUE', 'STORY'];
  if (typeof input !== 'string' || !modes.includes(input)) {
    return { success: false, invalidReason: 'Modo de ação inválido' };
  }
  return { success: true, value: input };
}
