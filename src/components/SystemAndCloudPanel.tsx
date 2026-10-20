import React, { useEffect, useState } from 'react';
import {
  CampaignState,
  FontSizeOption,
  GeminiModelOption,
} from '../types/jjk';
import {
  CloudCampaignSummary,
  deleteCloudCampaign,
  listUserCloudCampaigns,
  saveCampaignToCloud,
  signInWithGoogle,
  signOutUser,
} from '../services/firebaseClient';
import {
  GeminiConnectionReport,
  validateGeminiConnection,
} from '../services/geminiService';
import { getAccessCode, setAccessCode } from '../services/accessGuard';
import {
  Cloud,
  Download,
  Cpu,
  Type as TypeIcon,
  PlusCircle,
  LogIn,
  LogOut,
  Trash2,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  X,
  Volume2,
  ShieldCheck,
  AlertTriangle,
  Wifi,
  WifiOff,
  Clock,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

interface SystemAndCloudPanelProps {
  campaign: CampaignState | null;
  model: GeminiModelOption;
  onChangeModel: (m: GeminiModelOption) => void;
  fontSize: FontSizeOption;
  onChangeFontSize: (f: FontSizeOption) => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onStartNewCampaign: () => void;
  onLoadCloudCampaign: (loaded: CampaignState) => void;
  userEmail: string | null;
  lastCloudSyncIso: string | null;
  onCloseModal?: () => void;
  customApiKey?: string;
  onChangeCustomApiKey?: (key: string) => void;
  sfxEnabled?: boolean;
  onToggleSfx?: () => void;
  geminiReport?: GeminiConnectionReport | null;
  onRefreshGeminiStatus?: () => Promise<void>;
}

export const SystemAndCloudPanel: React.FC<SystemAndCloudPanelProps> = ({
  campaign,
  model,
  onChangeModel,
  fontSize,
  onChangeFontSize,
  onExportJson,
  onImportJsonFile,
  onStartNewCampaign,
  onLoadCloudCampaign,
  userEmail,
  lastCloudSyncIso,
  onCloseModal,
  customApiKey,
  onChangeCustomApiKey,
  sfxEnabled = true,
  onToggleSfx,
  geminiReport,
  onRefreshGeminiStatus,
}) => {
  const [cloudList, setCloudList] = useState<CloudCampaignSummary[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [localReport, setLocalReport] = useState<GeminiConnectionReport | null>(
    geminiReport || null
  );
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(customApiKey || '');
  const [accessCodeInput, setAccessCodeInput] = useState(() => getAccessCode());
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [keyActionFeedback, setKeyActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (customApiKey !== undefined) {
      setApiKeyInput(customApiKey);
    }
  }, [customApiKey]);

  useEffect(() => {
    if (geminiReport) {
      setLocalReport(geminiReport);
    }
  }, [geminiReport]);

  useEffect(() => {
    if (!localReport && !isValidatingKey) {
      handleValidateNow();
    }
  }, []);

  const handleValidateNow = async (keyOverride?: string) => {
    setIsValidatingKey(true);
    try {
      const keyToUse = keyOverride !== undefined ? keyOverride : (customApiKey || '');
      const res = await validateGeminiConnection(model, keyToUse);
      setLocalReport(res);
      if (onRefreshGeminiStatus) {
        await onRefreshGeminiStatus();
      }
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleSaveAndTestKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (onChangeCustomApiKey) {
      onChangeCustomApiKey(trimmed);
    }
    setIsValidatingKey(true);
    try {
      const res = await validateGeminiConnection(model, trimmed);
      setLocalReport(res);
      setKeyActionFeedback(
        res.state === 'VALID'
          ? 'Chave salva e validada com sucesso com a API Gemini!'
          : 'Chave salva. Verifique o diagnóstico de conexão abaixo.'
      );
      if (onRefreshGeminiStatus) {
        await onRefreshGeminiStatus();
      }
    } finally {
      setIsValidatingKey(false);
      setTimeout(() => setKeyActionFeedback(null), 5000);
    }
  };

  const handleClearCustomKey = async () => {
    setApiKeyInput('');
    if (onChangeCustomApiKey) {
      onChangeCustomApiKey('');
    }
    setIsValidatingKey(true);
    try {
      const res = await validateGeminiConnection(model, '');
      setLocalReport(res);
      setKeyActionFeedback('Chave personalizada removida. Usando chave padrão do ambiente Cloud.');
      if (onRefreshGeminiStatus) {
        await onRefreshGeminiStatus();
      }
    } finally {
      setIsValidatingKey(false);
      setTimeout(() => setKeyActionFeedback(null), 5000);
    }
  };

  const handleSaveAccessCode = () => {
    const clean = accessCodeInput.trim();
    setAccessCode(clean);
    setKeyActionFeedback(
      clean
        ? 'Código de acesso do servidor salvo neste navegador.'
        : 'Código de acesso removido.'
    );
    setTimeout(() => setKeyActionFeedback(null), 5000);
  };

  const handleClearAccessCode = () => {
    setAccessCodeInput('');
    setAccessCode('');
    setKeyActionFeedback('Código de acesso removido.');
    setTimeout(() => setKeyActionFeedback(null), 5000);
  };

  const fetchCloudSaves = async () => {
    if (!userEmail) {
      setCloudList([]);
      return;
    }
    setLoadingCloud(true);
    try {
      const list = await listUserCloudCampaigns();
      setCloudList(list);
    } catch {
      setSyncMessage('Não foi possível listar os saves da nuvem no momento.');
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    fetchCloudSaves();
  }, [userEmail, lastCloudSyncIso]);

  const handleManualCloudSync = async () => {
    if (!campaign || !userEmail) return;
    setLoadingCloud(true);
    try {
      await saveCampaignToCloud(campaign);
      setSyncMessage('Progresso sincronizado com sucesso no Firebase Firestore!');
      await fetchCloudSaves();
    } catch {
      setSyncMessage('Erro ao sincronizar com a nuvem.');
    } finally {
      setLoadingCloud(false);
    }
  };

  const handleDeleteCloudSave = async (id: string) => {
    setLoadingCloud(true);
    try {
      await deleteCloudCampaign(id);
      await fetchCloudSaves();
    } finally {
      setLoadingCloud(false);
    }
  };

  const activeReport = geminiReport || localReport;
  const currentState = isValidatingKey ? 'CHECKING' : activeReport?.state || 'CHECKING';

  return (
    <div className="p-4 sm:p-5 space-y-5 text-xs text-slate-200 max-w-3xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-white">
            Sistema, Conexão Gemini IA & Progresso na Nuvem
          </h2>
          <p className="text-slate-400 text-[11px]">
            Diagnóstico de conexão da API Gemini, salvamento automático em nuvem (Firebase) e exportação .json.
          </p>
        </div>
        {onCloseModal && (
          <button
            type="button"
            onClick={onCloseModal}
            aria-label="Fechar painel de sistema"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 1. Gemini API Connection Status & Validation Card */}
      <div
        className={`p-4 rounded-2xl border space-y-3 transition-colors ${
          currentState === 'VALID'
            ? 'bg-emerald-950/20 border-emerald-500/40'
            : currentState === 'CHECKING'
            ? 'bg-slate-900/60 border-slate-700'
            : currentState === 'QUOTA_EXCEEDED'
            ? 'bg-amber-950/25 border-amber-500/40'
            : 'bg-amber-950/25 border-amber-500/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {currentState === 'VALID' ? (
                <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : currentState === 'CHECKING' ? (
                <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="font-display font-bold text-sm text-white">
                Status da Conexão Gemini API
              </span>

              {currentState === 'VALID' && (
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  ● Conectada & Validada
                </span>
              )}
              {currentState === 'MISSING' && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  ▲ Chave Ausente (Modo de Continuidade)
                </span>
              )}
              {currentState === 'INVALID' && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  ⚠ Chave Inválida / Não Autorizada
                </span>
              )}
              {currentState === 'QUOTA_EXCEEDED' && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 font-mono text-[10px] font-bold uppercase tracking-wider">
                  ⏳ Limite de Cota (Fallback Ativo)
                </span>
              )}
              {currentState === 'CHECKING' && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 font-mono text-[10px] font-bold uppercase tracking-wider">
                  Verificando...
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {isValidatingKey
                ? 'Testando autenticação e resposta em tempo real com os servidores Gemini...'
                : activeReport?.message ||
                  'Verificando configuração da variável GEMINI_API_KEY no ambiente.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleValidateNow()}
            disabled={isValidatingKey}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isValidatingKey ? 'animate-spin' : ''}`} />
            <span>{isValidatingKey ? 'Validando...' : 'Testar Conexão Agora'}</span>
          </button>
        </div>

        {/* Custom API Key Input & Settings */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Chave de API do Gemini (Google AI Studio)
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {customApiKey
                ? '🔑 Usando Chave Personalizada'
                : '☁️ Usando Chave Automática do Ambiente Cloud'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKeySecret ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Insira sua chave AIzaSy... ou deixe em branco para usar a chave padrão"
                className="w-full bg-[#16110d] border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono pr-9 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKeySecret(!showKeySecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                title={showKeySecret ? 'Ocultar chave' : 'Mostrar chave'}
              >
                {showKeySecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveAndTestKey}
                disabled={isValidatingKey}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Salvar & Validar</span>
              </button>

              {customApiKey && (
                <button
                  type="button"
                  onClick={handleClearCustomKey}
                  disabled={isValidatingKey}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer transition-colors"
                  title="Remover chave personalizada e voltar para a chave padrão da nuvem"
                >
                  Usar Padrão
                </button>
              )}
            </div>
          </div>

          {keyActionFeedback && (
            <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{keyActionFeedback}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 pt-0.5 gap-1">
            <span>
              Suporta qualquer chave válida do Google AI Studio (gratuita ou paga).
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors underline"
            >
              <span>Obter chave no Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Código de acesso do servidor (opcional) */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Código de acesso do servidor
            </span>
            <span className="text-[10px] font-mono text-slate-400">opcional · APP_ACCESS_CODE</span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="password"
              value={accessCodeInput}
              onChange={(e) => setAccessCodeInput(e.target.value)}
              placeholder="Deixe vazio se o servidor não exigir código"
              className="flex-1 bg-[#16110d] border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveAccessCode}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer transition-colors"
              >
                Salvar
              </button>
              {accessCodeInput && (
                <button
                  type="button"
                  onClick={handleClearAccessCode}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 leading-snug">
            Só é necessário se o administrador definir{' '}
            <code className="text-amber-300">APP_ACCESS_CODE</code> no <code>.env</code> do
            servidor. O código fica salvo apenas neste navegador.
          </p>
        </div>

        {/* Diagnostic Metadata Bar */}
        {activeReport && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
            <span>
              Modelo Testado: <strong className="text-slate-200">{activeReport.modelTested}</strong>
            </span>
            {typeof activeReport.latencyMs === 'number' && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Latência: <strong className="text-cyan-300">{activeReport.latencyMs}ms</strong>
              </span>
            )}
            <span>
              Motor de Continuidade:{' '}
              <strong className={activeReport.fallbackActive ? 'text-amber-300' : 'text-emerald-300'}>
                {activeReport.fallbackActive ? 'EM USO AUTOMÁTICO' : 'EM ESPERA (IA ATIVA)'}
              </strong>
            </span>
          </div>
        )}

        {/* Continuity Assurance Note */}
        <div className="p-2.5 rounded-xl bg-[#0a0807]/90 border border-slate-800 flex items-start gap-2.5">
          {currentState === 'VALID' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-white">Garantia de Fluxo Narrativo Contínuo:</strong>{' '}
            {currentState === 'VALID'
              ? 'Sua chave GEMINI_API_KEY está ativa e respondendo normalmente. Caso ocorra qualquer oscilação de rede ou limite de cota, o Motor Narrativo de Continuidade assume instantaneamente sem travar seu turno.'
              : 'Caso a variável GEMINI_API_KEY esteja faltando ou seja inválida nos Secrets do ambiente, o Motor Narrativo de Continuidade JJK processa seus diálogos, ações físicas, técnicas amaldiçoadas, rolagens de 1d20 e evolução de XP sem interromper a campanha.'}
          </div>
        </div>
      </div>

      {/* 2. Cloud Progress Manager (Firebase Firestore) */}
      <div className="p-4 rounded-2xl bg-[#080605] border border-sky-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="font-display font-bold text-sm text-sky-400 flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              Salvamento Automático na Nuvem (Firebase Firestore)
            </div>
            <p className="text-[11px] text-slate-400">
              {userEmail
                ? `Conectado como ${userEmail}. Seu progresso é salvo automaticamente na nuvem a cada turno.`
                : 'Conecte sua conta Google para sincronizar automaticamente suas campanhas entre PC e Celular na nuvem.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {userEmail ? (
              <>
                {campaign && (
                  <button
                    type="button"
                    onClick={handleManualCloudSync}
                    disabled={loadingCloud}
                    className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCloud ? 'animate-spin' : ''}`} />
                    <span>Sincronizar Agora</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch {
                    setSyncMessage('Pop-up de login fechado ou cancelado.');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Conectar Google para Cloud Save</span>
              </button>
            )}
          </div>
        </div>

        {lastCloudSyncIso && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Último Auto-Save na Nuvem: {new Date(lastCloudSyncIso).toLocaleTimeString('pt-BR')}
            </span>
          </div>
        )}

        {syncMessage && (
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sky-300 text-[11px]">
            {syncMessage}
          </div>
        )}

        {userEmail && (
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="text-[11px] font-semibold text-slate-300">
              Campanhas Salvas na Sua Nuvem ({cloudList.length})
            </div>
            {cloudList.length === 0 ? (
              <div className="text-[11px] text-slate-500 py-2">
                Nenhuma campanha na nuvem ainda. Ao avançar um turno ou clicar em &ldquo;Sincronizar Agora&rdquo;, ela aparecerá aqui.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cloudList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#0d0b09] border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.characterGrade} · {item.turnCount} turnos · {item.location}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(item.campaignPayload);
                            onLoadCloudCampaign(parsed);
                            if (onCloseModal) onCloseModal();
                          } catch {
                            setSyncMessage('Erro ao decodificar save da nuvem.');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                      >
                        Carregar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCloudSave(item.id)}
                        aria-label={`Excluir campanha ${item.title}`}
                        className="p-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 text-amber-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Local Save/Load (.json) & New Campaign */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onExportJson}
          disabled={!campaign}
          className="p-3.5 rounded-xl bg-[#080605] hover:bg-slate-900 border border-slate-800 text-left space-y-1 disabled:opacity-40 cursor-pointer"
        >
          <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Exportar Campanha (.json)
          </div>
          <p className="text-[11px] text-slate-400">
            Baixa um arquivo único com todo o progresso da sessão.
          </p>
        </button>

        <label className="p-3.5 rounded-xl bg-[#080605] hover:bg-slate-900 border border-slate-800 text-left space-y-1 cursor-pointer block">
          <div className="font-semibold text-amber-400 flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4" />
            Importar Campanha (.json)
          </div>
          <p className="text-[11px] text-slate-400">
            Carregue seu arquivo .json no celular ou PC.
          </p>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onImportJsonFile(f);
                if (onCloseModal) onCloseModal();
              }
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => {
            onStartNewCampaign();
            if (onCloseModal) onCloseModal();
          }}
          className="p-3.5 rounded-xl bg-amber-950/25 hover:bg-amber-950/40 border border-amber-500/40 text-left space-y-1 cursor-pointer"
        >
          <div className="font-semibold text-amber-400 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" />
            Nova Campanha (Wizard)
          </div>
          <p className="text-[11px] text-slate-400">
            Abre o Criador de Personagem e Seletor de Arco.
          </p>
        </button>
      </div>

      {/* 4. Tabletop GM & Narrative Typography Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[#0b0908] border border-amber-500/25 space-y-2.5">
          <div className="font-semibold text-amber-200 flex items-center gap-1.5 font-display">
            <Cpu className="w-4 h-4 text-amber-400" />
            Estilo de Narração do Mestre IA
          </div>
          <div className="space-y-1.5">
            {(
              [
                {
                  id: 'gemini-3.8-flash',
                  label: 'Mestre Dramático & Tático (Recomendado)',
                  desc: 'Equilíbrio ideal entre descrição literária densa, diálogos fiéis e agilidade.',
                },
                {
                  id: 'gemini-3.5-flash-lite',
                  label: 'Mestre Ágil (Sessões Dinâmicas)',
                  desc: 'Respostas rápidas para turnos intensos de ação e diálogo.',
                },
                {
                  id: 'gemini-4-argon',
                  label: 'Mestre Crônica Profunda',
                  desc: 'Foco máximo em intriga de clãs, Votos Vinculativos e batalhas complexas.',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeModel(opt.id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  model === opt.id
                    ? 'bg-amber-950/40 border-amber-500 text-amber-100'
                    : 'bg-[#120e0c] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-xs">{opt.label}</div>
                <div className="text-[10px] text-slate-400">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b0908] border border-amber-500/25 space-y-3">
          <div className="font-semibold text-amber-200 flex items-center gap-1.5 font-display">
            <TypeIcon className="w-4 h-4 text-amber-400" />
            Tipografia do Pergaminho & Som
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'small', label: 'Compacta' },
                { id: 'medium', label: 'Padrão' },
                { id: 'large', label: 'Leitura Ampla' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChangeFontSize(f.id)}
                className={`py-2.5 rounded-lg border font-medium cursor-pointer ${
                  fontSize === f.id
                    ? 'bg-amber-600/30 border-amber-500 text-amber-100'
                    : 'bg-[#120e0c] border-slate-800 text-slate-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
            {onToggleSfx && (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-100 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  Efeitos Sonoros de Mesa (D20 / Kokusen)
                </span>
                <button
                  type="button"
                  onClick={onToggleSfx}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                    sfxEnabled
                      ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {sfxEnabled ? 'SOM ATIVO' : 'SILENCIADO'}
                </button>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            O Mestre de Jogo consulta automaticamente o Códice Enciclopédico de Jujutsu Kaisen e a Ficha Viva do seu personagem a cada turno.
          </p>
        </div>
      </div>
    </div>
  );
};
