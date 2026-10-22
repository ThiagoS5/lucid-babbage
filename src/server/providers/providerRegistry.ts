import type { ProviderInfo, ProviderSpec } from '../../types/provider.ts';
import type { GmProvider } from './types.ts';
import { createOpenAiCompatProvider } from './openAiCompatProvider.ts';

export interface ProviderEnv {
  geminiApiKey?: string;
  nvidiaNimApiKey?: string;
  openRouterApiKey?: string;
  customBaseUrl?: string;
  customApiKey?: string;
}

type NonGeminiId = 'nvidia-nim' | 'openrouter' | 'custom-openai';

export const PROVIDER_PRESETS: Record<
  NonGeminiId,
  {
    label: string;
    baseUrl?: string;
    defaultModel: string;
    models: string[];
    extraHeaders?: Record<string, string>;
  }
> = {
  'nvidia-nim': {
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: [
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'deepseek-ai/deepseek-r1',
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-chat-v3.1:free',
      'google/gemini-2.0-flash-exp:free',
    ],
    extraHeaders: { 'X-Title': 'JJK Cursed Chronicles' },
  },
  'custom-openai': {
    label: 'Personalizado (OpenAI-compatível)',
    defaultModel: '',
    models: [],
  },
};

/** Chave efetiva: a da UI vence; sem ela, a do ambiente. */
function effectiveKey(spec: ProviderSpec, env: ProviderEnv): string {
  const uiKey = (spec.apiKey || '').trim();
  if (uiKey) return uiKey;
  const envKey =
    spec.id === 'nvidia-nim'
      ? env.nvidiaNimApiKey
      : spec.id === 'openrouter'
      ? env.openRouterApiKey
      : env.customApiKey;
  return (envKey || '').trim();
}

/** Resolve o ProviderSpec da UI em um adaptador pronto; null quando não configurado. */
export function resolveProvider(
  spec: ProviderSpec | undefined,
  env: ProviderEnv
): GmProvider | null {
  if (!spec || spec.id === 'gemini') return null;
  const preset = PROVIDER_PRESETS[spec.id as NonGeminiId];
  if (!preset) return null;
  const apiKey = effectiveKey(spec, env);
  if (!apiKey) return null;
  const baseUrl =
    (spec.baseUrl || '').trim() ||
    (preset.baseUrl || (env.customBaseUrl || '').trim());
  if (!baseUrl) return null;
  const model = (spec.model || '').trim() || preset.defaultModel;
  if (!model) return null;
  return createOpenAiCompatProvider({
    id: spec.id,
    label: preset.label,
    baseUrl,
    apiKey,
    model,
    extraHeaders: preset.extraHeaders,
  });
}

export function listProviders(env: ProviderEnv, geminiConfigured: boolean): ProviderInfo[] {
  return [
    {
      id: 'gemini',
      label: 'Google Gemini',
      configured: geminiConfigured,
      defaultModel: 'gemini-3.8-flash',
      models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-4-argon'],
    },
    {
      id: 'nvidia-nim',
      label: PROVIDER_PRESETS['nvidia-nim'].label,
      configured: Boolean((env.nvidiaNimApiKey || '').trim()),
      defaultModel: PROVIDER_PRESETS['nvidia-nim'].defaultModel,
      models: PROVIDER_PRESETS['nvidia-nim'].models,
    },
    {
      id: 'openrouter',
      label: PROVIDER_PRESETS['openrouter'].label,
      configured: Boolean((env.openRouterApiKey || '').trim()),
      defaultModel: PROVIDER_PRESETS['openrouter'].defaultModel,
      models: PROVIDER_PRESETS['openrouter'].models,
    },
    {
      id: 'custom-openai',
      label: PROVIDER_PRESETS['custom-openai'].label,
      configured: Boolean((env.customBaseUrl || '').trim() && (env.customApiKey || '').trim()),
      defaultModel: '',
      models: [],
    },
  ];
}

export function classifyProviderError(rawMsg: string): {
  state: 'INVALID' | 'QUOTA_EXCEEDED' | 'MISSING';
  userMessage: string;
} {
  const lower = (rawMsg || '').toLowerCase();
  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted')
  ) {
    return {
      state: 'QUOTA_EXCEEDED',
      userMessage:
        'Limite de requisições do provedor de IA atingido. O Motor Narrativo de Continuidade JJK assumiu o turno automaticamente.',
    };
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key')
  ) {
    return {
      state: 'INVALID',
      userMessage:
        'A chave do provedor de IA é inválida ou não autorizada. O Motor Narrativo de Continuidade JJK assumiu o turno.',
    };
  }
  return {
    state: 'INVALID',
    userMessage:
      'O provedor de IA não respondeu corretamente. O Motor Narrativo de Continuidade JJK assumiu o turno.',
  };
}
