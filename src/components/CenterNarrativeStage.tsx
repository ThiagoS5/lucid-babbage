import React, { useState, useRef, useEffect } from 'react';
import {
  ActionMode,
  CampaignTurn,
  CharacterSheet,
  FontSizeOption,
  GeminiModelOption,
  VisualEffectTrigger,
  WorldStateUpdate,
} from '../types/jjk';
import { ApiKeyHealthState } from '../services/geminiService';
import {
  generateCanonicalPortraitSvg,
  generateSceneIllustrationSvg,
} from '../utils/svgArtGenerator';
import {
  Swords,
  MessageSquare,
  Flame,
  Clapperboard,
  Dices,
  Send,
  Sparkles,
  RotateCcw,
  Undo2,
  Eye,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ShieldAlert,
  Loader2,
  Zap,
  HeartPulse,
  Maximize2,
  Volume2,
  VolumeX,
  PlusCircle,
  MapPin,
  AlertTriangle,
  Wifi,
  WifiOff,
  X,
  Settings,
} from 'lucide-react';

interface CenterNarrativeStageProps {
  character: CharacterSheet;
  world: WorldStateUpdate;
  turns: CampaignTurn[];
  npcAvatars: Record<string, string>;
  fontSize: FontSizeOption;
  autoGenerateImages?: boolean;
  onToggleAutoGenerateImages?: () => void;
  onGenerateTurnImage: (
    turnId: string,
    prompt: string,
    vfx?: VisualEffectTrigger,
    craftAnimeDescriptionWithAi?: boolean
  ) => void;
  isGeneratingImageForTurn: string | null;
  onOpenLightbox: (url: string, caption: string) => void;
  onSubmitAction: (params: {
    mode: ActionMode;
    text: string;
    revealedHandVow: boolean;
  }) => void;
  isSubmittingTurn?: boolean;
  isSubmitting?: boolean;
  streamingNarrative?: string;
  onEditTurnNarrative?: (turnId: string, newText: string) => void;
  onRetryLastTurn: () => void;
  onRewindToTurn?: (turnIdx: number) => void;
  activeVfx: VisualEffectTrigger;
  rateLimitNotice?: string | null;
  onDismissRateLimitNotice?: () => void;
  onSwitchToLiteAndRetry?: () => void;
  recentLootNotification?: string | null;
  onDismissLootNotification?: () => void;
  externalActionDraft?: { mode: ActionMode; text: string; id: number } | null;
  apiKeyState?: ApiKeyHealthState;
  onOpenSystemModal?: () => void;
  model?: GeminiModelOption;
  autoRollDice?: boolean;
  currentDiceRoll?: number;
  sfxEnabled?: boolean;
  customApiKey?: string;
  onChangeCustomApiKey?: (key: string) => void;
  onToggleSfx?: () => void;
  onChangeModel?: (m: GeminiModelOption) => void;
  onChangeFontSize?: (f: FontSizeOption) => void;
  onToggleAutoImages?: () => void;
  onToggleAutoRoll?: () => void;
  onManualRollDice?: () => number;
  onUndoLastTurn?: () => void;
  onResetCampaign?: () => void;
  onExportCampaign?: () => void;
  onImportCampaign?: (file: File) => void;
}

interface ParsedParagraph {
  speaker: string;
  isNarrator: boolean;
  text: string;
}

function parseTheatricalNarrative(
  rawText: string,
  fallbackNpcName?: string
): ParsedParagraph[] {
  if (!rawText) return [];
  const blocks = rawText
    .split(/\n+/)
    .map((b) => b.trim())
    .filter((b) => {
      if (!b) return false;
      // Strip accidental markdown section headers if repeated inside narrative
      if (/^([123]\.\s*)?(⚙️|📖|📊)?\s*`?\[(LOG DO MOTOR JUJUTSU|NARRATIVA|HUD & REGISTRO DE CARDS)\]`?/i.test(b)) {
        return false;
      }
      return true;
    });

  return blocks.map((block) => {
    const match = block.match(/^\*([^*]+)\*:\s*(.*)$/);
    if (match) {
      let speaker = match[1].trim();
      const text = match[2].trim();
      const isNarrator = speaker.toLowerCase() === 'narrador';
      if (!isNarrator && /^personagem$/i.test(speaker)) {
        speaker = fallbackNpcName || 'Feiticeiro Desconhecido';
      }
      return { speaker, isNarrator, text };
    }
    return {
      speaker: 'Narrador',
      isNarrator: true,
      text: block,
    };
  });
}

function renderFormattedText(text: string) {
  const parts = text.split(/(".*?"|\*\*.*?\*\*|\[.*?\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('"') && part.endsWith('"')) {
      return (
        <span key={i} className="text-amber-200 font-medium italic">
          {part}
        </span>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span key={i} className="text-slate-300 italic">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export const CenterNarrativeStage: React.FC<CenterNarrativeStageProps> = ({
  character,
  world,
  turns,
  npcAvatars,
  model = 'gemini-3.8-flash',
  fontSize,
  autoRollDice = true,
  currentDiceRoll = 15,
  isSubmittingTurn,
  isSubmitting,
  streamingNarrative = '',
  isGeneratingImageForTurn,
  activeVfx,
  rateLimitNotice,
  onDismissRateLimitNotice,
  recentLootNotification,
  onDismissLootNotification,
  sfxEnabled = true,
  externalActionDraft,
  apiKeyState = 'CHECKING',
  onOpenSystemModal,
  onToggleSfx,
  onChangeModel,
  onChangeFontSize,
  onToggleAutoRoll,
  onManualRollDice,
  onSubmitAction,
  onGenerateTurnImage,
  onUndoLastTurn,
  onRewindToTurn,
  onRetryLastTurn,
  onResetCampaign,
  onOpenLightbox,
}) => {
  const submitting = Boolean(isSubmittingTurn ?? isSubmitting);
  const [actionMode, setActionMode] = useState<ActionMode>('DO');
  const [actionText, setActionText] = useState('');
  const [revealedHandVow, setRevealedHandVow] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [expandedHuds, setExpandedHuds] = useState<Record<string, boolean>>({});
  const [isVisualStageCollapsed, setIsVisualStageCollapsed] = useState(false);

  const feedEndRef = useRef<HTMLDivElement>(null);
  const actionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (externalActionDraft) {
      setActionMode(externalActionDraft.mode);
      setActionText(externalActionDraft.text);
      setTimeout(() => {
        actionInputRef.current?.focus();
      }, 50);
    }
  }, [externalActionDraft]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, submitting]);

  const latestTurn = turns[turns.length - 1];
  const latestSceneImage =
    latestTurn?.sceneImageUrl ||
    generateSceneIllustrationSvg(
      `${world.location} ${world.arc} ${latestTurn?.gmResponse.imagePrompt || ''}`,
      latestTurn?.gmResponse.visualEffectTrigger
    );

  const toggleEngineLog = (turnId: string) => {
    setExpandedLogs((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  };

  const toggleHud = (turnId: string) => {
    setExpandedHuds((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionText.trim() || submitting) return;
    onSubmitAction({
      mode: actionMode,
      text: actionText.trim(),
      revealedHandVow,
    });
    setActionText('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    setActionText(suggestion);
  };

  const handleQuickAbility = (type: 'LAPSE' | 'REVERSAL' | 'DOMAIN' | 'RCT' | 'BLACK_FLASH') => {
    if (type === 'LAPSE') {
      setActionMode('TECHNIQUE');
      setActionText(`Ativo o Lapso da minha técnica (${character.technique.name}): ${character.technique.lapse}`);
    } else if (type === 'REVERSAL' && character.technique.reversal) {
      setActionMode('TECHNIQUE');
      setActionText(`Canalizo Energia Positiva para ativar a Reversão da Técnica: ${character.technique.reversal}`);
    } else if (type === 'DOMAIN' && character.technique.domainExpansion) {
      setActionMode('TECHNIQUE');
      setActionText(`Uno as mãos no selo ancestral e declaro: "Expansão de Domínio: ${character.technique.domainExpansion}!"`);
    } else if (type === 'RCT') {
      setActionMode('TECHNIQUE');
      setActionText(`Multiplico energia negativa contra energia negativa para ativar a Técnica Amaldiçoada Reversa (RCT) e regenerar meus ferimentos!`);
    } else if (type === 'BLACK_FLASH') {
      setActionMode('DO');
      setActionText(`Concentro todo o fluxo de Energia Amaldiçoada em 0,000001 segundo no punho para desferir um Kokusen (Black Flash) devastador!`);
    }
  };

  const fontSizeClass =
    fontSize === 'small'
      ? 'text-xs leading-relaxed'
      : fontSize === 'large'
      ? 'text-base leading-relaxed'
      : 'text-sm leading-relaxed';

  const getSpeakerAvatar = (speakerName: string): string => {
    if (
      speakerName.toLowerCase() === character.name.toLowerCase() &&
      character.avatarUrl
    ) {
      return character.avatarUrl;
    }
    if (npcAvatars[speakerName]) {
      return npcAvatars[speakerName];
    }
    const matchingNpc = world.npcsInScene.find(
      (n) =>
        n.name.toLowerCase().includes(speakerName.toLowerCase()) ||
        speakerName.toLowerCase().includes(n.name.toLowerCase())
    );
    if (matchingNpc && npcAvatars[matchingNpc.name]) {
      return npcAvatars[matchingNpc.name];
    }
    return generateCanonicalPortraitSvg(speakerName);
  };

  // Custom Domain Portal VFX Resolver
  const customDomainPortal = character.domainPortal;
  const isDomainVfxActive =
    activeVfx === 'DOMAIN_GOJO' ||
    activeVfx === 'DOMAIN_SUKUNA' ||
    activeVfx === 'DOMAIN_HIGURUMA' ||
    activeVfx === 'DOMAIN_GENERIC';

  const renderDomainOverlay = () => {
    if (!isDomainVfxActive) return null;

    if (customDomainPortal && !character.technique.isCanon) {
      const styleClass =
        customDomainPortal.visualStyle === 'infinite_void'
          ? 'vfx-domain-gojo'
          : customDomainPortal.visualStyle === 'malevolent_shrine'
          ? 'vfx-domain-sukuna'
          : customDomainPortal.visualStyle === 'chimera_shadow'
          ? 'vfx-domain-chimera'
          : customDomainPortal.visualStyle === 'judgeman_court'
          ? 'vfx-domain-judgeman'
          : 'vfx-domain-nebula';

      return (
        <div
          className={`fixed inset-0 pointer-events-none z-50 flex items-center justify-center ${styleClass}`}
          style={{
            background: `radial-gradient(circle at center, ${customDomainPortal.primaryColor}33 0%, ${customDomainPortal.secondaryColor}44 45%, ${customDomainPortal.coreColor}ee 90%)`,
          }}
        >
          <div className="text-center px-6 py-4 rounded-2xl bg-black/80 border border-white/20 backdrop-blur-md shadow-2xl animate-pulse">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-300 mb-1">
              Expansão de Domínio · {customDomainPortal.handSeal}
            </div>
            <div className="text-2xl md:text-4xl font-display font-black uppercase tracking-widest text-white">
              {customDomainPortal.domainName}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`fixed inset-0 pointer-events-none z-50 ${
          activeVfx === 'DOMAIN_GOJO'
            ? 'vfx-domain-gojo'
            : activeVfx === 'DOMAIN_SUKUNA'
            ? 'vfx-domain-sukuna'
            : 'vfx-domain-gojo'
        }`}
      />
    );
  };

  const handleUndo = () => {
    if (onUndoLastTurn) {
      onUndoLastTurn();
    } else if (onRewindToTurn && turns.length > 1) {
      onRewindToTurn(turns.length - 2);
    }
  };

  return (
    <main
      className={`flex-1 flex flex-col h-full bg-[#080605] relative overflow-hidden ${
        activeVfx === 'BLACK_FLASH' ? 'vfx-black-flash' : ''
      } ${activeVfx === 'RCT_HEAL' ? 'vfx-rct-heal' : ''}`}
    >
      {renderDomainOverlay()}

      {/* Clean Tabletop RPG Top Bar */}
      <header className="px-3 sm:px-4 py-2.5 bg-[#100c09] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 z-10">
        {/* Location & Arc */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-display font-bold text-slate-100 truncate">
              {world.location}
            </div>
            <div className="text-[10px] text-amber-400/90 font-mono truncate">
              {world.arc} · Turno #{turns.length}
            </div>
          </div>
        </div>

        {/* Essential Controls + Connection Pill */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenSystemModal && (
            <button
              type="button"
              onClick={onOpenSystemModal}
              title="Status de Conexão Gemini IA & Painel de Sistema"
              className={`px-2 py-1 rounded-lg border text-[10px] font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                apiKeyState === 'VALID'
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                  : apiKeyState === 'CHECKING'
                  ? 'bg-slate-900 border-slate-700 text-slate-300'
                  : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
              }`}
            >
              {apiKeyState === 'VALID' ? (
                <Wifi className="w-3 h-3 text-emerald-400" />
              ) : (
                <WifiOff className="w-3 h-3 text-amber-400" />
              )}
              <span className="hidden sm:inline">
                {apiKeyState === 'VALID'
                  ? 'IA Conectada'
                  : apiKeyState === 'CHECKING'
                  ? 'Verificando IA...'
                  : 'Modo Continuidade'}
              </span>
            </button>
          )}

          {onChangeModel && (
            <select
              value={model}
              onChange={(e) => onChangeModel(e.target.value as GeminiModelOption)}
              className="bg-[#16110d] border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
              title="Modelo do Mestre IA"
            >
              <option value="gemini-3.8-flash">3.8 Flash (Padrão)</option>
              <option value="gemini-3.5-flash-lite">Flash-Lite (Rápido)</option>
              <option value="gemini-3.1-flash-lite">3.1 Flash-Lite</option>
            </select>
          )}

          {onChangeFontSize && (
            <div className="hidden sm:flex items-center bg-[#16110d] border border-slate-800 rounded-lg p-0.5">
              {(['small', 'medium', 'large'] as FontSizeOption[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onChangeFontSize(sz)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    fontSize === sz
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sz === 'small' ? 'P' : sz === 'medium' ? 'M' : 'G'}
                </button>
              ))}
            </div>
          )}

          {onToggleSfx && (
            <button
              type="button"
              onClick={onToggleSfx}
              title={sfxEnabled ? 'Desativar Som' : 'Ativar Som'}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                sfxEnabled
                  ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
                  : 'bg-[#16110d] border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {sfxEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsVisualStageCollapsed((p) => !p)}
            title={isVisualStageCollapsed ? 'Mostrar Ilustração da Cena' : 'Ocultar Ilustração da Cena'}
            className="px-2 py-1 rounded-lg bg-[#16110d] border border-slate-800 text-[11px] text-slate-300 hover:text-white flex items-center gap-1"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Cena</span>
            {isVisualStageCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={turns.length <= 1 || submitting}
            title="Desfazer último turno"
            className="p-1.5 rounded-lg bg-[#16110d] border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onRetryLastTurn}
            disabled={turns.length === 0 || submitting}
            title="Re-gerar resposta do Mestre"
            className="p-1.5 rounded-lg bg-[#16110d] border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onResetCampaign && (
            <button
              type="button"
              onClick={onResetCampaign}
              title="Criar Novo Personagem / Nova Campanha"
              className="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 text-[11px] font-semibold flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Ficha</span>
            </button>
          )}
        </div>
      </header>

      {/* Non-Blocking API Key / Continuity Notice Banner */}
      {rateLimitNotice && (
        <div className="px-3.5 py-2 bg-amber-950/80 border-b border-amber-500/40 flex flex-col gap-2 text-[11px] text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
            <span className="break-words leading-relaxed">{rateLimitNotice}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            {onOpenSystemModal && (
              <button
                type="button"
                onClick={onOpenSystemModal}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>Status do Sistema</span>
              </button>
            )}
            {onDismissRateLimitNotice && (
              <button
                type="button"
                onClick={onDismissRateLimitNotice}
                className="p-1 rounded hover:bg-amber-900/50 text-amber-300 cursor-pointer"
                aria-label="Dispensar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loot / Sheet Evolution Notification Banner */}
      {recentLootNotification && (
        <div className="px-3.5 py-2 bg-emerald-950/80 border-b border-emerald-500/40 flex items-center justify-between gap-2 text-[11px] text-emerald-100">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium break-words">{recentLootNotification}</span>
          </div>
          {onDismissLootNotification && (
            <button
              type="button"
              onClick={onDismissLootNotification}
              className="p-1 rounded hover:bg-emerald-900/50 text-emerald-300 cursor-pointer shrink-0"
              aria-label="Fechar notificação de evolução"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Single Unified 16:9 Scene Visual Stage (The ONLY place with "Gerar Cena Anime") */}
      {!isVisualStageCollapsed && (
        <div className="relative w-full h-36 sm:h-44 md:h-52 bg-black border-b border-slate-800/80 overflow-hidden shrink-0 group">
          <img
            src={latestSceneImage}
            alt={world.location}
            onClick={() =>
              onOpenLightbox(latestSceneImage, `${world.location} — ${world.arc}`)
            }
            className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-102 cursor-zoom-in"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080605] via-[#080605]/35 to-transparent pointer-events-none" />

          {/* Active Barrier Badge */}
          {world.activeBarrierOrDomain && world.activeBarrierOrDomain !== 'Nenhum' && (
            <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/85 border border-red-500/50 backdrop-blur-md">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-red-200 font-bold">
                {world.activeBarrierOrDomain}
              </span>
            </div>
          )}

          {/* SINGLE Button to Generate Anime Scene */}
          <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
            {latestTurn && (
              <button
                type="button"
                onClick={() =>
                  onGenerateTurnImage(
                    latestTurn.id,
                    latestTurn.gmResponse.imagePrompt,
                    latestTurn.gmResponse.visualEffectTrigger,
                    true
                  )
                }
                disabled={isGeneratingImageForTurn === latestTurn.id}
                className="px-3 py-1.5 rounded-lg bg-amber-950/90 hover:bg-amber-800 border border-amber-400/50 text-[11px] font-semibold text-amber-100 flex items-center gap-1.5 backdrop-blur-md shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingImageForTurn === latestTurn.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                    <span>Gerando Cena...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gerar Cena Anime</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onOpenLightbox(latestSceneImage, `${world.location} — ${world.arc}`)
              }
              className="p-1.5 rounded-lg bg-black/70 hover:bg-black/90 border border-slate-700 text-slate-200 backdrop-blur-md transition-all"
              title="Expandir imagem em tela cheia"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom Scene Caption */}
          <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2 pointer-events-none">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-300 font-serif italic line-clamp-1">
                {world.npcsInScene.length > 0
                  ? `Em cena: ${world.npcsInScene.map((n) => `${n.name} (${n.attitude})`).join(' · ')}`
                  : 'Explorando os arredores sob tensão espiritual'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Theatrical Narrative Feed */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-5">
        {turns.map((turn) => {
          const turnWorld = turn.gmResponse.worldStateUpdate || world;
          const turnPlayer = turn.gmResponse.playerStateUpdate || {
            hpPercentage: character.hpPercentage,
            cursedEnergyPercentage: character.cursedEnergyPercentage,
            outputPercentage: character.outputPercentage,
            physicalCondition: character.physicalCondition,
            techniqueState: character.techniqueState,
            inBlackFlashZone: character.inBlackFlashZone,
          };
          const fallbackSpeakerName =
            turnWorld.npcsInScene?.[0]?.name || world.npcsInScene?.[0]?.name;
          const paragraphs = parseTheatricalNarrative(
            turn.gmResponse.narrative,
            fallbackSpeakerName
          );
          // Both [LOG DO MOTOR JUJUTSU] and [HUD & REGISTRO DE CARDS] are collapsible components
          const isLogOpen = Boolean(expandedLogs[turn.id]);
          const isHudOpen = Boolean(expandedHuds[turn.id]);

          const activeCardSummary =
            turn.gmResponse.activeCardRuleSummary ||
            `${character.technique.name}: ${
              character.technique.lapse || character.technique.description
            }`;

          return (
            <article
              key={turn.id}
              className="rounded-2xl bg-[#13100d] border border-slate-800/90 overflow-hidden shadow-lg transition-all"
            >
              {/* Turn Header Bar */}
              <div className="px-3.5 py-2 bg-[#191410] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
                    TURNO #{turn.turnNumber}
                  </span>

                  {turn.gmResponse.assistantMode === 'continuity-engine' && (
                    <span
                      className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-[10px] font-mono text-amber-300"
                      title={turn.gmResponse.fallbackReason || 'Turno do motor local de continuidade'}
                    >
                      MOTOR LOCAL
                    </span>
                  )}

                  {turn.playerAction && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                      <Dices className="w-3 h-3 text-cyan-400" />
                      1d20:{' '}
                      <strong
                        className={
                          turn.playerAction.diceRoll === 20
                            ? 'text-red-400 font-black'
                            : turn.playerAction.diceRoll === 1
                            ? 'text-amber-400'
                            : 'text-cyan-300'
                        }
                      >
                        {turn.playerAction.diceRoll}
                      </strong>
                      {turn.playerAction.diceRoll === 20 && (
                        <span className="ml-1 text-red-400 font-bold">KOKUSEN!</span>
                      )}
                    </span>
                  )}

                  {turn.playerAction?.revealedHandVow && (
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-[10px] font-mono text-amber-300">
                      Voto: Revelar a Mão (+20%)
                    </span>
                  )}
                </div>

                {/* Quick Collapse Toggles in Header */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleEngineLog(turn.id)}
                    className={`text-[10px] font-mono flex items-center gap-1 px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      isLogOpen
                        ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200'
                        : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-cyan-300'
                    }`}
                    title={isLogOpen ? 'Recolher Log do Motor Jujutsu' : 'Expandir Log do Motor Jujutsu'}
                  >
                    <span>⚙️ Log Motor</span>
                    {isLogOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHud(turn.id)}
                    className={`text-[10px] font-mono flex items-center gap-1 px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      isHudOpen
                        ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                        : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-amber-300'
                    }`}
                    title={isHudOpen ? 'Recolher HUD & Registro de Cards' : 'Expandir HUD & Registro de Cards'}
                  >
                    <span>📊 HUD & Cards</span>
                    {isHudOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Player Action Banner */}
              {turn.playerAction && (
                <div className="px-4 py-2.5 bg-amber-950/20 border-b border-amber-500/20 flex items-start gap-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-600/30 text-amber-200 border border-amber-500/40 shrink-0 mt-0.5">
                    {turn.playerAction.mode === 'DO'
                      ? 'Ação'
                      : turn.playerAction.mode === 'SAY'
                      ? 'Diálogo'
                      : turn.playerAction.mode === 'TECHNIQUE'
                      ? 'Técnica'
                      : 'Cena'}
                  </div>
                  <p className="text-xs sm:text-sm text-amber-100 font-medium break-words">
                    {turn.playerAction.text}
                  </p>
                </div>
              )}

              {/* 1. ⚙️ [LOG DO MOTOR JUJUTSU] (Componente Collapse) */}
              <div className="border-b border-slate-800/80 bg-[#090b10]">
                <button
                  type="button"
                  onClick={() => toggleEngineLog(turn.id)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-cyan-950/25 transition-colors cursor-pointer group"
                  aria-expanded={isLogOpen}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 shrink-0">
                      <span>⚙️ [LOG DO MOTOR JUJUTSU]</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono truncate hidden sm:inline">
                      {isLogOpen
                        ? '· Escala de Poder, Lore Check & Psicologia NPC'
                        : '· Clique para expandir a análise técnica da rodada'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 group-hover:text-cyan-300 shrink-0">
                    <span className="font-semibold">{isLogOpen ? 'Recolher' : 'Expandir'}</span>
                    {isLogOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {isLogOpen && (
                  <div className="px-4 pb-3.5 pt-1 border-t border-cyan-500/20 space-y-1.5 text-[11px] font-mono bg-[#07090e]">
                    <div className="text-cyan-100/95 whitespace-pre-line leading-relaxed break-words bg-black/40 p-3 rounded-lg border border-cyan-500/20 shadow-inner">
                      {turn.gmResponse.engineLog}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. 📖 [NARRATIVA] (Theatrical Paragraphs with *Narrador*: and *Nome do Personagem*:) */}
              <div className={`p-4 sm:p-5 space-y-4 font-serif ${fontSizeClass}`}>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1.5 pb-1 border-b border-slate-800/70">
                  <span>📖 [NARRATIVA]</span>
                </div>

                {paragraphs.map((p, idx) => {
                  if (p.isNarrator) {
                    return (
                      <div
                        key={idx}
                        className="pl-3.5 border-l-2 border-amber-500/60 text-slate-200 leading-relaxed break-words"
                      >
                        <span className="text-[11px] font-mono font-bold text-amber-400 mr-1.5">
                          *Narrador*:
                        </span>
                        {renderFormattedText(p.text)}
                      </div>
                    );
                  }

                  const avatarUrl = getSpeakerAvatar(p.speaker);

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-[#181310] border border-slate-800/90"
                    >
                      <img
                        src={avatarUrl}
                        alt={p.speaker}
                        onClick={() => onOpenLightbox(avatarUrl, p.speaker)}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-amber-500/40 shrink-0 shadow-md cursor-zoom-in hover:scale-105 transition-transform"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-display font-bold text-amber-400 break-words">
                            *{p.speaker}*:
                          </span>
                        </div>
                        <div className="text-slate-200 leading-relaxed break-words">
                          {renderFormattedText(p.text)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3. 📊 [HUD & REGISTRO DE CARDS] (Componente Collapse) */}
              <div className="border-t border-slate-800/90 bg-[#0b0c12]">
                <button
                  type="button"
                  onClick={() => toggleHud(turn.id)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-amber-950/25 transition-colors cursor-pointer group"
                  aria-expanded={isHudOpen}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 shrink-0">
                      <span>📊 [HUD & REGISTRO DE CARDS]</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono truncate hidden sm:inline">
                      {isHudOpen
                        ? `· Local: ${turnWorld.location} | HP: ${turnPlayer.hpPercentage}%`
                        : `· HP ${turnPlayer.hpPercentage}% · EA ${
                            character.isHeavenlyRestriction ? '0%' : `${turnPlayer.cursedEnergyPercentage}%`
                          } · Clique para expandir painel tático & cards`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 group-hover:text-amber-300 shrink-0">
                    <span className="font-semibold">{isHudOpen ? 'Recolher' : 'Expandir'}</span>
                    {isHudOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {isHudOpen && (
                  <div className="px-4 pb-3.5 pt-1 border-t border-amber-500/20 space-y-2 text-[11px] font-mono bg-[#080910]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 leading-snug">
                      <div className="p-2.5 rounded-lg bg-[#130f0c] border border-slate-800/80 break-words">
                        <span className="text-amber-300 font-bold">• Localização & Regras Ativas: </span>
                        <span>
                          {turnWorld.location} — {turnWorld.activeBarrierOrDomain || 'Sem barreira ativa'} (
                          {turnWorld.arc})
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#130f0c] border border-slate-800/80 break-words">
                        <span className="text-emerald-300 font-bold">• Status do Jogador: </span>
                        <span>
                          HP Física: {turnPlayer.hpPercentage}% ({turnPlayer.physicalCondition}) | Reserva de EA:{' '}
                          {character.isHeavenlyRestriction
                            ? '0% (Restrição Celestial)'
                            : `${turnPlayer.cursedEnergyPercentage}% (Output ${turnPlayer.outputPercentage}%)`}{' '}
                          | Estado da Técnica: <strong className="text-white">{turnPlayer.techniqueState}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#130f0c] border border-slate-800/80 break-words text-slate-300 leading-snug">
                      <span className="text-rose-300 font-bold">• Inimigos/NPCs Presentes: </span>
                      {turnWorld.npcsInScene && turnWorld.npcsInScene.length > 0 ? (
                        <span>
                          {turnWorld.npcsInScene
                            .map(
                              (npc) =>
                                `[${npc.name} | ${npc.grade} | ${npc.status} (${
                                  typeof npc.hpPercentage === 'number' ? `${npc.hpPercentage}% HP` : '100% HP'
                                }) | Técnica: ${npc.revealedTechnique || 'Em observação'}]`
                            )
                            .join(' · ')}
                        </span>
                      ) : (
                        <span>Nenhum NPC ou Maldição detectado no perímetro imediato.</span>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#130f0c] border border-slate-800/80 break-words text-slate-300 leading-snug space-y-1.5">
                      <div>
                        <span className="text-amber-300 font-bold">• Card Ativo na Cena: </span>
                        <span>{activeCardSummary}</span>
                      </div>
                      {turn.gmResponse.activeStoryCards && turn.gmResponse.activeStoryCards.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {turn.gmResponse.activeStoryCards.map((cardTitle, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-amber-300 break-words"
                            >
                              {cardTitle}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {submitting && (
          <div className="rounded-2xl bg-[#13100d] border border-amber-500/40 p-4 space-y-2">
            <div className="flex items-center gap-3 text-amber-300">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              <span className="text-xs font-mono uppercase tracking-wider">
                O Mestre está narrando as consequências da sua ação...
              </span>
            </div>
            {streamingNarrative && (
              <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap font-serif">
                {streamingNarrative}
                <span className="inline-block w-1.5 h-4 bg-amber-400 animate-pulse align-text-bottom ml-0.5" />
              </div>
            )}
          </div>
        )}

        <div ref={feedEndRef} />
      </div>

      {/* Bottom Player Action Console */}
      <div className="p-3 sm:p-3.5 bg-[#100c09] border-t border-slate-800/90 space-y-2.5 z-10">
        {/* Suggested Actions Chips */}
        {latestTurn?.gmResponse.suggestedActions &&
          latestTurn.gmResponse.suggestedActions.length > 0 && (
            <div className="relative">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pr-8 no-scrollbar">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Sugestões:
              </span>
              {latestTurn.gmResponse.suggestedActions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionClick(sug)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[#181310] hover:bg-amber-950/60 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-amber-200 transition-all shrink-0 max-w-xs sm:max-w-md truncate"
                >
                  {sug}
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#100c09] to-transparent" />
            </div>
          )}

        {/* Mode Selector + Quick Ability Triggers */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* 4 Action Modes */}
          <div className="flex items-center gap-1 bg-[#16110d] p-1 rounded-xl border border-slate-800">
            {(
              [
                { id: 'DO', label: 'Agir', icon: Swords, activeBg: 'bg-red-600 text-white' },
                { id: 'SAY', label: 'Dialogar', icon: MessageSquare, activeBg: 'bg-amber-600 text-white' },
                { id: 'TECHNIQUE', label: 'Técnica', icon: Flame, activeBg: 'bg-amber-600 text-white' },
                { id: 'STORY', label: 'Cena', icon: Clapperboard, activeBg: 'bg-cyan-600 text-white' },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              const active = actionMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActionMode(m.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    active ? m.activeBg : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Jujutsu Triggers + Dice */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleQuickAbility('LAPSE')}
              className="px-2 py-1 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all"
              title="Usar Lapso da Técnica Inata"
            >
              <Zap className="w-3 h-3" /> Lapso
            </button>

            {character.technique.domainExpansion && (
              <button
                type="button"
                onClick={() => handleQuickAbility('DOMAIN')}
                className="px-2 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/50 text-amber-200 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all"
                title={`Expandir Domínio: ${character.technique.domainExpansion}`}
              >
                <Flame className="w-3 h-3 text-amber-400" /> Domínio
              </button>
            )}

            {character.technique.hasRct && (
              <button
                type="button"
                onClick={() => handleQuickAbility('RCT')}
                className="px-2 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all"
                title="Curar ferimentos com Técnica Amaldiçoada Reversa (RCT)"
              >
                <HeartPulse className="w-3 h-3" /> RCT
              </button>
            )}

            {!character.isHeavenlyRestriction && (
              <button
                type="button"
                onClick={() => setRevealedHandVow((prev) => !prev)}
                className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-all flex items-center gap-1 ${
                  revealedHandVow
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-[#16110d] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Voto Vinculativo: Explicar sua técnica ao inimigo concede +20% Output de EA"
              >
                <Eye className="w-3 h-3" />
                <span className="hidden sm:inline">Revelar a Mão (+20%)</span>
              </button>
            )}

            {onManualRollDice && (
              <div className="flex items-center gap-1 bg-[#16110d] px-2 py-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={onManualRollDice}
                  className="flex items-center gap-1 text-xs font-mono text-cyan-400 hover:text-cyan-300"
                  title="Rolar 1d20 agora"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span className="font-bold">{currentDiceRoll}</span>
                </button>
                {onToggleAutoRoll && (
                  <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer ml-1 pl-1 border-l border-slate-800">
                    <input
                      type="checkbox"
                      checked={autoRollDice}
                      onChange={onToggleAutoRoll}
                      className="accent-amber-600 rounded"
                    />
                    <span>Auto</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="flex gap-2">
          <textarea
            ref={actionInputRef}
            rows={2}
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder={
              actionMode === 'DO'
                ? 'Descreva sua ação física, movimentação ou golpe...'
                : actionMode === 'SAY'
                ? 'Escreva o que seu personagem fala para os presentes em cena...'
                : actionMode === 'TECHNIQUE'
                ? `Descreva como você canaliza ${character.technique.name}...`
                : 'Descreva um rumo ou acontecimento dramático para a cena...'
            }
            className="flex-1 bg-[#16110d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
          />
          <button
            type="submit"
            disabled={!actionText.trim() || submitting}
            className="px-4 sm:px-5 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 disabled:opacity-40 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/50 transition-all cursor-pointer shrink-0"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
};
