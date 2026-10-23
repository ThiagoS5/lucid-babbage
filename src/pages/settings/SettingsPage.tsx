import React, { useState } from 'react';
import type {
  CampaignState,
  FontSizeOption,
  GeminiModelOption,
} from '@/shared/types/jjk';
import type { ProviderId, ProviderSpec } from '@/shared/types/provider';
import type { GeminiConnectionReport } from '@/features/narrative/lib/geminiService';
import {
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Key,
  PlusCircle,
  RefreshCw,
  Trash2,
  Volume2,
} from 'lucide-react';

interface SettingsPageProps {
  campaign: CampaignState | null;
  model: GeminiModelOption;
  onChangeModel: (model: GeminiModelOption) => void;
  provider: ProviderSpec;
  onChangeProvider: (provider: ProviderSpec) => void;
  fontSize: FontSizeOption;
  onChangeFontSize: (size: FontSizeOption) => void;
  autoGenerateImages: boolean;
  onToggleAutoImages: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  customApiKey: string;
  onChangeCustomApiKey: (value: string) => void;
  geminiReport: GeminiConnectionReport | null;
  onRefreshGeminiStatus: () => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onNewCharacter: () => void;
  onDeleteCampaign: () => void;
  onOpenChronicle: () => void;
  memoriesCount: number;
  isSummarizingMemory: boolean;
  onSummarizeMemory: () => void;
}

const MODEL_OPTIONS: { id: GeminiModelOption; label: string }[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
];

const PROVIDER_OPTIONS: { id: ProviderId; label: string; hint: string }[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    hint: 'Padrão da casa. Usa a chave do Google AI Studio.',
  },
  {
    id: 'nvidia-nim',
    label: 'NVIDIA NIM',
    hint: 'Cloud da NVIDIA (build.nvidia.com). Chave em build.nvidia.com.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Agregador openrouter.ai — modelos :free e pagos.',
  },
  {
    id: 'custom-openai',
    label: 'IA personalizada (OpenAI-compatível)',
    hint: 'Qualquer endpoint com /chat/completions (Ollama, LM Studio, vLLM…).',
  },
];

const PROVIDER_MODEL_SUGGESTIONS: Record<ProviderId, string[]> = {
  gemini: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  'nvidia-nim': [
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'deepseek-ai/deepseek-r1',
  ],
  openrouter: [
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-chat-v3.1:free',
    'google/gemini-2.0-flash-exp:free',
  ],
  'custom-openai': [],
};

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <section className="mt-14">
    <div className="editorial-eyebrow">{label}</div>
    <div className="mt-4 divide-y divide-[rgba(255,255,255,0.07)] border-t border-[rgba(201,169,106,0.2)]">
      {children}
    </div>
  </section>
);

const Row: React.FC<{
  title: string;
  description: string;
  children?: React.ReactNode;
}> = ({ title, description, children }) => (
  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <h3 className="editorial-serif text-[18px] leading-tight text-[#e7ddcb]">{title}</h3>
      <p className="editorial-muted mt-1 max-w-[520px] font-sans text-[11px] leading-relaxed">
        {description}
      </p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Toggle: React.FC<{ on: boolean; onToggle: () => void; label: string }> = ({
  on,
  onToggle,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    data-on={on ? 'true' : 'false'}
    onClick={onToggle}
    className="editorial-toggle"
  />
);

export const SettingsPage: React.FC<SettingsPageProps> = ({
  campaign,
  model,
  onChangeModel,
  provider,
  onChangeProvider,
  fontSize,
  onChangeFontSize,
  autoGenerateImages,
  onToggleAutoImages,
  sfxEnabled,
  onToggleSfx,
  customApiKey,
  onChangeCustomApiKey,
  geminiReport,
  onRefreshGeminiStatus,
  onExportJson,
  onImportJsonFile,
  onNewCharacter,
  onDeleteCampaign,
  onOpenChronicle,
  memoriesCount,
  isSummarizingMemory,
  onSummarizeMemory,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [showProviderKey, setShowProviderKey] = useState(false);

  const isGemini = provider.id === 'gemini';
  const providerSuggestions = PROVIDER_MODEL_SUGGESTIONS[provider.id] ?? [];

  const handleProviderChange = (id: ProviderId) => {
    const suggestions = PROVIDER_MODEL_SUGGESTIONS[id] ?? [];
    onChangeProvider({
      id,
      model: suggestions[0] ?? '',
      apiKey: provider.apiKey ?? '',
      baseUrl: provider.baseUrl ?? '',
    });
  };

  return (
    <div className="editorial-page max-w-[980px]">
      <div className="editorial-eyebrow">Preferências</div>
      <h1 className="editorial-page-title mt-4">Configurações</h1>

      <Section label="Mestre de IA">
        <Row
          title="Provedor do Mestre"
          description={
            PROVIDER_OPTIONS.find((option) => option.id === provider.id)?.hint ||
            'Escolha quem narra a crônica.'
          }
        >
          <select
            value={provider.id}
            onChange={(event) => handleProviderChange(event.target.value as ProviderId)}
            className="editorial-select w-[260px] max-w-[70vw]"
            aria-label="Provedor de IA do Mestre"
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Row>

        {!isGemini && (
          <>
            <Row
              title="Chave do provedor"
              description="Guardada apenas neste navegador e enviada apenas no momento do turno. O servidor nunca a persiste."
            >
              <div className="flex items-center gap-3">
                <div className="relative w-[260px] max-w-[70vw]">
                  <Key className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6f6659]" />
                  <input
                    type={showProviderKey ? 'text' : 'password'}
                    value={provider.apiKey ?? ''}
                    onChange={(event) =>
                      onChangeProvider({ ...provider, apiKey: event.target.value })
                    }
                    placeholder="sk-..."
                    className="editorial-input pl-6"
                    aria-label="Chave de API do provedor escolhido"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowProviderKey((value) => !value)}
                  className="text-[#8f8470] transition-colors hover:text-[#d8bd86]"
                  aria-label={showProviderKey ? 'Ocultar chave' : 'Mostrar chave'}
                >
                  {showProviderKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Row>

            {provider.id === 'custom-openai' && (
              <Row
                title="Endpoint (base URL)"
                description="Endereço base do seu servidor OpenAI-compatível. Ex.: http://localhost:11434/v1"
              >
                <input
                  type="url"
                  value={provider.baseUrl ?? ''}
                  onChange={(event) =>
                    onChangeProvider({ ...provider, baseUrl: event.target.value })
                  }
                  placeholder="http://localhost:11434/v1"
                  className="editorial-input w-[260px] max-w-[70vw]"
                  aria-label="Base URL do provedor personalizado"
                />
              </Row>
            )}

            <Row
              title="Modelo do provedor"
              description="Identificador exato do modelo no serviço escolhido."
            >
              <div className="flex w-[260px] max-w-[70vw] flex-col gap-2">
                <input
                  type="text"
                  value={provider.model}
                  onChange={(event) =>
                    onChangeProvider({ ...provider, model: event.target.value })
                  }
                  placeholder="meta/llama-3.3-70b-instruct"
                  className="editorial-input"
                  aria-label="Modelo do provedor escolhido"
                  list="provider-model-suggestions"
                />
                <datalist id="provider-model-suggestions">
                  {providerSuggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </div>
            </Row>

            <Row
              title="Geração de imagens"
              description="A ilustração da cena continua sendo gerada pelo Gemini (Nano Banana). NIM, OpenRouter e provedores personalizados narram — mas não desenham."
            >
              <span className="editorial-muted font-sans text-[10px] uppercase tracking-[0.12em]">
                Somente Gemini
              </span>
            </Row>
          </>
        )}

        {isGemini && (
          <Row
            title="Chave de API do Google Gemini"
            description="Guardada apenas neste navegador. Gere uma chave gratuita no Google AI Studio."
          >
            <div className="flex items-center gap-3">
              <div className="relative w-[260px] max-w-[70vw]">
                <Key className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6f6659]" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={customApiKey}
                  onChange={(event) => onChangeCustomApiKey(event.target.value)}
                  placeholder="AIza..."
                  className="editorial-input pl-6"
                  aria-label="Chave de API do Google Gemini"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="text-[#8f8470] transition-colors hover:text-[#d8bd86]"
                aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Row>
        )}

        {isGemini && (
          <Row
            title="Modelo"
            description="Modelos maiores narram com mais nuance; os menores respondem mais rápido."
          >
            <select
              value={model}
              onChange={(event) => onChangeModel(event.target.value as GeminiModelOption)}
              className="editorial-select w-[260px] max-w-[70vw]"
              aria-label="Modelo do Mestre"
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Row>
        )}

        <Row
          title="Tamanho da leitura"
          description="Ajusta o corpo do texto na crônica."
        >
          <div className="flex border border-[rgba(201,169,106,0.22)]">
            {(
              [
                ['small', 'Compacto'],
                ['medium', 'Padrão'],
                ['large', 'Amplo'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onChangeFontSize(id)}
                className={
                  'px-4 py-2 font-sans text-[10px] uppercase tracking-[0.1em] transition-colors ' +
                  (fontSize === id
                    ? 'bg-[rgba(201,169,106,0.14)] text-[#e6cfa2]'
                    : 'text-[#8f8470] hover:text-[#d8bd86]')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </Row>

        <Row
          title="Conexão com o Mestre"
          description={
            geminiReport?.message ||
            'Verifique a chave e a cota do modelo escolhido antes de iniciar uma crônica.'
          }
        >
          <button
            type="button"
            onClick={onRefreshGeminiStatus}
            className="editorial-button editorial-button--ghost"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Testar conexão
          </button>
        </Row>
      </Section>

      <Section label="Mesa">
        <Row
          title="Memória e continuidade"
          description={
            campaign
              ? `${memoriesCount} resumo(s) consolidado(s). O Mestre lembra da crônica inteira.`
              : 'Disponível quando uma crônica estiver em andamento.'
          }
        >
          <div className="flex items-center gap-3">
            {campaign ? (
              <button type="button" onClick={onOpenChronicle} className="editorial-button editorial-button--ghost">
                Abrir crônica
              </button>
            ) : (
              <button type="button" onClick={onNewCharacter} className="editorial-button editorial-button--ghost">
                Criar crônica
              </button>
            )}
          </div>
        </Row>

        {campaign && (
          <Row
            title="Resumo da memória"
            description="Consolida os turnos recentes em um resumo que o Mestre relê nos próximos turnos."
          >
            <button
              type="button"
              onClick={onSummarizeMemory}
              disabled={isSummarizingMemory}
              className="editorial-button editorial-button--ghost"
            >
              {isSummarizingMemory ? 'Resumindo...' : 'Resumir turnos'}
            </button>
          </Row>
        )}

        <Row
          title="Imagens automáticas"
          description="Gerar uma ilustração a cada turno consome cota da API. Fora isso, você ainda pode pedir a cena pelo menu da crônica."
        >
          <Toggle on={autoGenerateImages} onToggle={onToggleAutoImages} label="Imagens automáticas" />
        </Row>

        <Row
          title="Efeitos sonoros"
          description="Sons discretos para domínio, Kokusen e cura reversa."
        >
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-[#8f8470]" />
            <Toggle on={sfxEnabled} onToggle={onToggleSfx} label="Efeitos sonoros" />
          </div>
        </Row>
      </Section>

      <Section label="Crônica">
        <Row
          title="Exportar crônica"
          description="Baixe um arquivo .json com personagem, mundo, turnos e memória."
        >
          <button
            type="button"
            onClick={onExportJson}
            disabled={!campaign}
            className="editorial-button editorial-button--ghost"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar
          </button>
        </Row>

        <Row
          title="Importar save"
          description="Continue uma crônica exportada anteriormente."
        >
          <label className="editorial-button editorial-button--ghost cursor-pointer">
            <FolderOpen className="h-3.5 w-3.5" />
            Importar
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImportJsonFile(file);
                event.target.value = '';
              }}
            />
          </label>
        </Row>

        <Row
          title="Nova ficha"
          description="Crie outro feiticeiro sem apagar a crônica atual."
        >
          <button type="button" onClick={onNewCharacter} className="editorial-button">
            <PlusCircle className="h-3.5 w-3.5" />
            Criar personagem
          </button>
        </Row>
      </Section>

      <Section label="Dados">
        <Row
          title="Recomeçar"
          description="Apaga o personagem e toda a conversa desta mesa. Não pode ser desfeito."
        >
          <button
            type="button"
            onClick={onDeleteCampaign}
            disabled={!campaign}
            className="inline-flex items-center gap-2 border border-[rgba(160,70,60,0.55)] px-4 py-2 font-sans text-[10px] uppercase tracking-[0.12em] text-[#c78f83] transition-colors hover:border-[#a0463c] hover:text-[#e0a79b] disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Apagar história
          </button>
        </Row>
      </Section>
    </div>
  );
};
