/**
 * Extração tolerante de JSON de respostas de LLM: provedores OpenAI-compatíveis
 * às vezes cercam o JSON com markdown ou prosa, mesmo em modo JSON.
 */
export function extractJsonObject(raw: string): unknown {
  const text = (raw || '').trim();
  if (!text) throw new Error('Resposta vazia do provedor.');

  try {
    return JSON.parse(text);
  } catch {
    // segue para as estratégias de recuperação
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // segue
    }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // segue
    }
  }

  throw new Error('O provedor não devolveu um JSON válido.');
}
