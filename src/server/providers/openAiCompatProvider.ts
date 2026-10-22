import type { GmCompletionRequest, GmProvider } from './types.ts';
import { extractJsonObject } from './jsonRepair.ts';

export interface OpenAiCompatConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

/** Instrução de modo JSON embutida no system message (provedores sem schema nativo). */
export function buildJsonModeAddendum(jsonSchema: Record<string, unknown>): string {
  const required = Array.isArray(jsonSchema.required)
    ? (jsonSchema.required as string[]).join(', ')
    : '';
  return [
    '',
    '=== FORMATO DE RESPOSTA (OBRIGATÓRIO) ===',
    'Responda EXCLUSIVAMENTE com um único objeto JSON válido. Nada de markdown, nada de texto fora do JSON.',
    `Campos obrigatórios: ${required || 'narrative'}.`,
    'Dentro de "narrative", cada bloco segue o formato *Nome do Personagem*: "Fala", separado por linha em branco.',
    '',
  ].join('\n');
}

async function postChatCompletions(
  cfg: OpenAiCompatConfig,
  req: GmCompletionRequest,
  stream: boolean,
  useResponseFormat: boolean
): Promise<Response> {
  const systemContent = req.systemInstruction + buildJsonModeAddendum(req.jsonSchema);
  return fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      ...(cfg.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: req.prompt },
      ],
      temperature: req.temperature,
      stream,
      ...(useResponseFormat ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
}

export function createOpenAiCompatProvider(cfg: OpenAiCompatConfig): GmProvider {
  async function request(req: GmCompletionRequest, stream: boolean): Promise<Response> {
    let res = await postChatCompletions(cfg, req, stream, true);
    if (res.status === 400) {
      // Alguns provedores rejeitam response_format — tenta de novo sem o campo.
      res = await postChatCompletions(cfg, req, stream, false);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} (${cfg.label}): ${body.slice(0, 180)}`);
    }
    return res;
  }

  return {
    id: cfg.id,
    label: cfg.label,
    model: cfg.model,

    async completeTurn(req) {
      const res = await request(req, false);
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content || '';
      if (!text.trim()) throw new Error(`Resposta vazia de ${cfg.label}.`);
      extractJsonObject(text); // valida aqui para o erro subir antes do cliente
      return text;
    },

    async streamTurn(req, onChunk) {
      const res = await request(req, true);
      if (!res.body) throw new Error(`Sem corpo de streaming de ${cfg.label}.`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = '';
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = sseBuf.indexOf('\n')) !== -1) {
          const line = sseBuf.slice(0, idx).trim();
          sseBuf = sseBuf.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const delta = (
              JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
            ).choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              onChunk(delta);
            }
          } catch {
            // chunk SSE parcial/não-JSON: ignora
          }
        }
      }
      if (!full.trim()) throw new Error(`Stream vazio de ${cfg.label}.`);
      return full;
    },

    async validate() {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
          ...(cfg.extraHeaders || {}),
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'user', content: 'Responda apenas: OK' }],
          max_tokens: 8,
        }),
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status} em ${cfg.label} (${cfg.model}).` };
      return { ok: true, message: `Conexão ativa com ${cfg.label} (${cfg.model}).` };
    },
  };
}
