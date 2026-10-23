export type ProviderId = 'gemini' | 'nvidia-nim' | 'openrouter' | 'custom-openai';

export interface ProviderSpec {
  id: ProviderId;
  /** Modelo específico do provedor (ex.: 'meta/llama-3.3-70b-instruct'). */
  model: string;
  /** Chave opcional informada pela UI — nunca persistida no servidor. */
  apiKey?: string;
  /** Base URL — obrigatória só para 'custom-openai' (ex.: http://localhost:11434/v1). */
  baseUrl?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: string[];
}
