import React, { useEffect, useRef, useState } from "react";
import {
  ActionMode,
  CampaignTurn,
  CharacterSheet,
  FontSizeOption,
  GeminiModelOption,
  VisualEffectTrigger,
  WorldStateUpdate,
} from "../types/jjk";
import { ApiKeyHealthState } from "../services/geminiService";
import {
  generateCanonicalPortraitSvg,
  generateSceneIllustrationSvg,
} from "../utils/svgArtGenerator";
import {
  AlertTriangle,
  ChevronDown,
  Clapperboard,
  Dices,
  Flame,
  HeartPulse,
  Image as ImageIcon,
  Info,
  Loader2,
  MapPin,
  Maximize2,
  MessageSquare,
  MoreVertical,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Swords,
  Undo2,
  Volume2,
  VolumeX,
  Wand2,
  X,
  Zap,
} from "lucide-react";

interface ChatNarrativeStageProps {
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

interface ParsedBlock {
  speaker: string;
  isNarrator: boolean;
  text: string;
}

interface PendingAction {
  mode: ActionMode;
  text: string;
  revealedHandVow: boolean;
}

const MODE_META: Record<
  ActionMode,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DO: { label: "Agir", icon: Swords },
  SAY: { label: "Dialogar", icon: MessageSquare },
  TECHNIQUE: { label: "Técnica", icon: Flame },
  STORY: { label: "Cena", icon: Clapperboard },
};

const MODE_HINT: Record<ActionMode, string> = {
  DO: "Descreva uma ação física ou de combate...",
  SAY: "Diga algo a alguém em cena...",
  TECHNIQUE: "Ative uma técnica, domínio ou RCT...",
  STORY: "Direcione a cena sem agir diretamente...",
};

function formatTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Converte a prosa do Mestre em blocos de chat.
 * Aceita parágrafos separados por linha em branco, falas em `*Nome*:` e
 * linhas de continuação sem marcador.
 */
function parseTheatricalNarrative(rawText: string, fallbackNpcName?: string): ParsedBlock[] {
  if (!rawText) return [];
  const normalized = rawText.replace(/\r/g, "").trim();
  const blocks: string[] = [];

  for (const paragraph of normalized.split(/\n\s*\n/)) {
    const merged: string[] = [];
    for (const rawLine of paragraph.split(/\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (merged.length === 0 || /^\*[^*\n]+\*:\s*/.test(line)) {
        merged.push(line);
      } else {
        merged[merged.length - 1] = merged[merged.length - 1] + " " + line;
      }
    }
    for (const part of merged) {
      const pieces = part
        .split(/(?=\*[^*\n]+\*:\s)/)
        .map((p) => p.trim())
        .filter(Boolean);
      blocks.push(...pieces);
    }
  }

  return blocks
    .filter((block) => {
      if (!block) return false;
      return !/^([123]\.\s*)?(\u2699\uFE0F|\uD83D\uDCD6|\uD83D\uDCCA)?\s*\x60?\[(LOG DO MOTOR JUJUTSU|NARRATIVA|HUD & REGISTRO DE CARDS)\]\x60?/i.test(
        block
      );
    })
    .map((block) => {
      const match = block.match(/^\*([^*]+)\*:\s*([\s\S]*)$/);
      if (!match) {
        return { speaker: "Narrador", isNarrator: true, text: block };
      }
      let speaker = match[1].trim();
      const text = match[2].trim();
      const isNarrator = speaker.toLowerCase() === "narrador";
      if (!isNarrator && /^personagem$/i.test(speaker)) {
        speaker = fallbackNpcName || "Feiticeiro Desconhecido";
      }
      return { speaker, isNarrator, text };
    });
}

function renderFormattedText(text: string) {
  const parts = text.split(/(".*?"|\*\*.*?\*\*|\[.*?\])/g);
  return parts.map((part, index) => {
    if (part.startsWith('"') && part.endsWith('"')) {
      return (
        <span key={index} className="font-medium italic text-amber-200">
          {part}
        </span>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("[") && part.endsWith("]")) {
      return (
        <span key={index} className="italic text-slate-400">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="O Mestre está narrando">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/80" />
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/60"
        style={{ animationDelay: "120ms" }}
      />
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/40"
        style={{ animationDelay: "240ms" }}
      />
    </div>
  );
}

function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-amber-500/20 bg-[#100c09] shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#100c09]/95 px-4 py-3 backdrop-blur">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-amber-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Fechar painel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400/80">
      {children}
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#17130f] px-2.5 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={"mt-0.5 text-sm font-semibold " + tone}>{value}</div>
    </div>
  );
}

export const ChatNarrativeStage: React.FC<ChatNarrativeStageProps> = ({
  character,
  world,
  turns,
  npcAvatars,
  fontSize,
  autoGenerateImages = false,
  onToggleAutoGenerateImages,
  onGenerateTurnImage,
  isGeneratingImageForTurn,
  onOpenLightbox,
  onSubmitAction,
  isSubmittingTurn,
  isSubmitting,
  streamingNarrative = "",
  onRetryLastTurn,
  onRewindToTurn,
  activeVfx,
  rateLimitNotice,
  onDismissRateLimitNotice,
  recentLootNotification,
  onDismissLootNotification,
  externalActionDraft,
  apiKeyState = "CHECKING",
  onOpenSystemModal,
  model = "gemini-3.8-flash",
  autoRollDice = true,
  currentDiceRoll = 15,
  sfxEnabled = true,
  onToggleSfx,
  onChangeModel,
  onChangeFontSize,
  onToggleAutoRoll,
  onManualRollDice,
  onUndoLastTurn,
  onResetCampaign,
  onSwitchToLiteAndRetry,
}) => {
  const submitting = Boolean(isSubmittingTurn ?? isSubmitting);
  const [actionMode, setActionMode] = useState<ActionMode>("DO");
  const [actionText, setActionText] = useState("");
  const [revealedHandVow, setRevealedHandVow] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [detailsTurnId, setDetailsTurnId] = useState<string | null>(null);
  const [showSceneImage, setShowSceneImage] = useState(() => {
    if (typeof window === "undefined") return true;
    // No celular/tablet o texto vem primeiro; o frame fica a um toque no menu.
    return window.innerWidth >= 1024;
  });
  const [showAllTurns, setShowAllTurns] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const turnsAtSubmit = useRef(turns.length);

  const latestTurn = turns[turns.length - 1];
  const detailsTurn = detailsTurnId
    ? turns.find((turn) => turn.id === detailsTurnId) || null
    : null;

  const latestSceneImage =
    latestTurn?.sceneImageUrl ||
    generateSceneIllustrationSvg(
      world.location + " " + world.arc + " " + (latestTurn?.gmResponse.imagePrompt || ""),
      latestTurn?.gmResponse.visualEffectTrigger
    );

  const visibleTurns = showAllTurns ? turns : turns.slice(-10);
  const hiddenTurns = Math.max(0, turns.length - visibleTurns.length);

  const ModeIcon = MODE_META[actionMode].icon;

  const bodySizeClass =
    fontSize === "small"
      ? "text-[14px] leading-[1.65]"
      : fontSize === "large"
      ? "text-[17px] leading-[1.75]"
      : "text-[15px] leading-[1.75]";

  const adjustTextarea = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
  };

  useEffect(() => {
    adjustTextarea();
  }, [actionText]);

  useEffect(() => {
    if (externalActionDraft) {
      setActionMode(externalActionDraft.mode);
      setActionText(externalActionDraft.text);
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [externalActionDraft]);

  const didInitialScroll = useRef(false);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      // Ao abrir uma crônica curta, comece pelo começo da cena; em campanhas
      // longas, abra na última mensagem como um app de conversa.
      if (turns.length <= 1) {
        el.scrollTo({ top: 0 });
        stickToBottom.current = false;
        return;
      }
    }
    if (!stickToBottom.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length, submitting, streamingNarrative]);

  useEffect(() => {
    if (submitting) return;
    if (!pendingAction) return;
    if (turns.length > turnsAtSubmit.current) {
      setPendingAction(null);
      return;
    }
    const timer = window.setTimeout(() => setPendingAction(null), 1500);
    return () => window.clearTimeout(timer);
  }, [submitting, turns.length, pendingAction]);

  const getSpeakerAvatar = (speakerName: string): string => {
    if (
      speakerName.toLowerCase() === character.name.toLowerCase() &&
      character.avatarUrl
    ) {
      return character.avatarUrl;
    }
    if (npcAvatars[speakerName]) return npcAvatars[speakerName];
    const matchingNpc = world.npcsInScene.find(
      (npc) =>
        npc.name.toLowerCase().includes(speakerName.toLowerCase()) ||
        speakerName.toLowerCase().includes(npc.name.toLowerCase())
    );
    if (matchingNpc && npcAvatars[matchingNpc.name]) {
      return npcAvatars[matchingNpc.name];
    }
    return generateCanonicalPortraitSvg(speakerName);
  };

  const submitAction = () => {
    const text = actionText.trim();
    if (!text || submitting) return;
    stickToBottom.current = true;
    turnsAtSubmit.current = turns.length;
    setPendingAction({ mode: actionMode, text, revealedHandVow });
    onSubmitAction({ mode: actionMode, text, revealedHandVow });
    setActionText("");
    setShowTools(false);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      adjustTextarea();
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitAction();
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitAction();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setActionText(suggestion);
    window.setTimeout(() => {
      inputRef.current?.focus();
      adjustTextarea();
    }, 30);
  };

  const handleQuickAbility = (
    type: "LAPSE" | "REVERSAL" | "DOMAIN" | "RCT" | "BLACK_FLASH"
  ) => {
    if (type === "LAPSE") {
      setActionMode("TECHNIQUE");
      setActionText(
        "Ativo o Lapso da minha técnica (" +
          character.technique.name +
          "): " +
          character.technique.lapse
      );
    } else if (type === "REVERSAL" && character.technique.reversal) {
      setActionMode("TECHNIQUE");
      setActionText(
        "Canalizo Energia Positiva para ativar a Reversão da Técnica: " +
          character.technique.reversal
      );
    } else if (type === "DOMAIN" && character.technique.domainExpansion) {
      setActionMode("TECHNIQUE");
      setActionText(
        'Uno as mãos no selo ancestral e declaro: "Expansão de Domínio: ' +
          character.technique.domainExpansion +
          '!"'
      );
    } else if (type === "RCT") {
      setActionMode("TECHNIQUE");
      setActionText(
        "Multiplico energia negativa contra energia negativa para ativar a Técnica Amaldiçoada Reversa (RCT) e regenerar meus ferimentos!"
      );
    } else {
      setActionMode("DO");
      setActionText(
        "Concentro todo o fluxo de Energia Amaldiçoada em 0,000001 segundo no punho para desferir um Kokusen (Black Flash) devastador!"
      );
    }
    setShowTools(false);
  };

  const handleUndo = () => {
    if (onUndoLastTurn) onUndoLastTurn();
    else if (onRewindToTurn && turns.length > 1) onRewindToTurn(turns.length - 2);
    setShowMenu(false);
  };

  const customDomainPortal = character.domainPortal;
  const isDomainVfxActive =
    activeVfx === "DOMAIN_GOJO" ||
    activeVfx === "DOMAIN_SUKUNA" ||
    activeVfx === "DOMAIN_HIGURUMA" ||
    activeVfx === "DOMAIN_GENERIC";

  const renderDomainOverlay = () => {
    if (!isDomainVfxActive) return null;

    if (customDomainPortal && !character.technique.isCanon) {
      const styleClass =
        customDomainPortal.visualStyle === "infinite_void"
          ? "vfx-domain-gojo"
          : customDomainPortal.visualStyle === "malevolent_shrine"
          ? "vfx-domain-sukuna"
          : customDomainPortal.visualStyle === "chimera_shadow"
          ? "vfx-domain-chimera"
          : customDomainPortal.visualStyle === "judgeman_court"
          ? "vfx-domain-judgeman"
          : "vfx-domain-nebula";

      return (
        <div
          className={
            "pointer-events-none fixed inset-0 z-50 flex items-center justify-center " +
            styleClass
          }
          style={{
            background:
              "radial-gradient(circle at center, " +
              customDomainPortal.primaryColor +
              "33 0%, " +
              customDomainPortal.secondaryColor +
              "44 45%, " +
              customDomainPortal.coreColor +
              "ee 90%)",
          }}
        >
          <div className="animate-pulse rounded-2xl border border-white/20 bg-black/80 px-6 py-4 text-center shadow-2xl backdrop-blur-md">
            <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.3em] text-amber-300">
              Expansão de Domínio · {customDomainPortal.handSeal}
            </div>
            <div className="font-display text-2xl font-black uppercase tracking-widest text-white md:text-4xl">
              {customDomainPortal.domainName}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={
          "pointer-events-none fixed inset-0 z-50 " +
          (activeVfx === "DOMAIN_SUKUNA" ? "vfx-domain-sukuna" : "vfx-domain-gojo")
        }
      />
    );
  };

  const handleGenerateLatestImage = () => {
    if (!latestTurn) return;
    onGenerateTurnImage(
      latestTurn.id,
      latestTurn.gmResponse.imagePrompt,
      latestTurn.gmResponse.visualEffectTrigger,
      true
    );
  };

  const suggestions = latestTurn?.gmResponse.suggestedActions || [];

  return (
    <main
      className={
        "relative flex h-full flex-col overflow-hidden bg-[#0a0806] " +
        (activeVfx === "BLACK_FLASH" ? "vfx-black-flash" : "") +
        (activeVfx === "RCT_HEAL" ? "vfx-rct-heal" : "")
      }
    >
      {renderDomainOverlay()}

      {/* Header enxuto: identidade, local e status em uma linha */}
      <header className="safe-top sticky top-0 z-20 shrink-0 border-b border-white/5 bg-[#0d0a08]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2.5 px-3 py-2">
          <img
            src={character.avatarUrl}
            alt={character.name}
            className="h-9 w-9 shrink-0 rounded-full border border-amber-500/30 object-cover"
            referrerPolicy="no-referrer"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-amber-50">
                {character.name}
              </span>
              <span className="shrink-0 rounded border border-amber-500/25 bg-amber-950/40 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-300">
                {character.grade}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <MapPin className="h-2.5 w-2.5 shrink-0 text-slate-500" />
              <span className="truncate">{world.location}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="w-10">
              <div className="flex items-center justify-between text-[8px] font-medium text-emerald-400/80">
                <span>HP</span>
                <span>{Math.round(character.hpPercentage)}%</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-emerald-400"
                  style={{
                    width:
                      Math.max(0, Math.min(100, character.hpPercentage)) + "%",
                  }}
                />
              </div>
            </div>
            <div className="w-10">
              <div className="flex items-center justify-between text-[8px] font-medium text-sky-400/80">
                <span>EA</span>
                <span>{Math.round(character.cursedEnergyPercentage)}%</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-sky-400"
                  style={{
                    width:
                      Math.max(0, Math.min(100, character.cursedEnergyPercentage)) +
                      "%",
                  }}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMenu(true)}
            className="ml-0.5 rounded-xl border border-white/5 bg-[#17130f] p-2 text-slate-300 transition-colors hover:text-amber-200"
            aria-label="Menu da crônica"
            title="Menu da crônica"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      {rateLimitNotice && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-950/40 px-3 py-2">
          <div className="mx-auto flex w-full max-w-2xl items-start gap-2 text-[11px] leading-snug text-amber-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="min-w-0 flex-1">{rateLimitNotice}</p>
            {onDismissRateLimitNotice && (
              <button
                type="button"
                onClick={onDismissRateLimitNotice}
                className="shrink-0 rounded-lg p-1 text-amber-300 hover:bg-amber-900/40"
                aria-label="Dispensar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feed de conversa */}
      <div
        ref={feedRef}
        onScroll={() => {
          const el = feedRef.current;
          if (!el) return;
          stickToBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-6"
      >
        <div className="mx-auto w-full max-w-2xl space-y-3">
          {hiddenTurns > 0 && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllTurns(true)}
                className="rounded-full border border-white/10 bg-[#14110e] px-3 py-1.5 text-[10px] font-medium text-slate-300 hover:text-amber-200"
              >
                Ver turnos anteriores ({hiddenTurns})
              </button>
            </div>
          )}

          {visibleTurns.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-400">
              A crônica começa aqui. Envie sua primeira ação para o Mestre.
            </div>
          )}

          {visibleTurns.map((turn) => {
            const isLatest = latestTurn?.id === turn.id;
            const paragraphs = parseTheatricalNarrative(
              turn.gmResponse.narrative,
              turn.gmResponse.worldStateUpdate?.npcsInScene?.[0]?.name ||
                world.npcsInScene[0]?.name
            );

            return (
              <section key={turn.id} className="space-y-2.5">
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-white/5" />
                  <button
                    type="button"
                    onClick={() => setDetailsTurnId(turn.id)}
                    className="flex items-center gap-1.5 rounded-full border border-amber-500/15 bg-[#12100d] px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:text-amber-200"
                    title="Detalhes do turno"
                  >
                    <span>Turno {turn.turnNumber}</span>
                    <span className="text-slate-600">·</span>
                    <span>{formatTime(turn.timestamp)}</span>
                    <Info className="h-3 w-3" />
                  </button>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                {isLatest && showSceneImage && (
                  <div className="px-1 sm:px-8">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenLightbox(
                          latestSceneImage,
                          world.location + " — " + world.arc
                        )
                      }
                      className="group relative block w-full overflow-hidden rounded-2xl border border-amber-500/15 bg-black"
                    >
                      <img
                        src={latestSceneImage}
                        alt={world.location}
                        className="max-h-36 w-full object-cover opacity-95 sm:max-h-48"
                      />
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-slate-200 opacity-0 transition-opacity group-hover:opacity-100">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </span>
                    </button>
                    <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-slate-500">
                      <span className="italic">Frame do turno</span>
                      <button
                        type="button"
                        onClick={handleGenerateLatestImage}
                        disabled={isGeneratingImageForTurn === turn.id}
                        className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-[#17130f] px-2 py-0.5 text-amber-300 disabled:opacity-50"
                      >
                        {isGeneratingImageForTurn === turn.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3" />
                        )}
                        <span>
                          {isGeneratingImageForTurn === turn.id
                            ? "Gerando..."
                            : "Gerar cena"}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {turn.playerAction && (
                  <div className="flex justify-end pl-8 sm:pl-24">
                    <div className="max-w-[88%] rounded-2xl rounded-br-md border border-amber-600/25 bg-[#3a2a12] px-3.5 py-2.5 shadow-[0_4px_18px_rgba(0,0,0,0.35)]">
                      <div className="mb-1 flex items-center justify-end gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300/70">
                        <span>{MODE_META[turn.playerAction.mode]?.label || "Ação"}</span>
                        <span>·</span>
                        <span>d20 {turn.playerAction.diceRoll}</span>
                        <span>·</span>
                        <span>{formatTime(turn.timestamp)}</span>
                      </div>
                      <p className={"whitespace-pre-line text-amber-50 " + bodySizeClass}>
                        {turn.playerAction.text}
                      </p>
                      {turn.playerAction.revealedHandVow && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                          <Zap className="h-2.5 w-2.5" />
                          Voto: Revelar a Mão (+20%)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {paragraphs.map((block, index) =>
                  block.isNarrator ? (
                    <div key={index} className="flex justify-start pr-4 sm:pr-16">
                      <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-[#14110e] px-3.5 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
                        <p className={"whitespace-pre-line text-[#ece3d5] " + bodySizeClass}>
                          {renderFormattedText(block.text)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div key={index} className="flex items-start gap-2 pr-4 sm:pr-16">
                      <img
                        src={getSpeakerAvatar(block.speaker)}
                        alt={block.speaker}
                        className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-amber-500/20 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 max-w-[86%]">
                        <div className="mb-0.5 pl-0.5 text-[11px] font-semibold text-amber-300">
                          {block.speaker}
                        </div>
                        <div className="rounded-2xl rounded-tl-md border border-amber-500/10 bg-[#17130f] px-3.5 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
                          <p
                            className={
                              "whitespace-pre-line text-[#ece3d5] " + bodySizeClass
                            }
                          >
                            {renderFormattedText(block.text)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </section>
            );
          })}

          {pendingAction && (
            <div className="flex justify-end pl-8 sm:pl-24">
              <div className="max-w-[88%] rounded-2xl rounded-br-md border border-amber-600/25 bg-[#3a2a12] px-3.5 py-2.5 opacity-90">
                <div className="mb-1 flex items-center justify-end gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300/70">
                  <span>{MODE_META[pendingAction.mode].label}</span>
                  <span>·</span>
                  <span>d20 {currentDiceRoll}</span>
                </div>
                <p className={"whitespace-pre-line text-amber-50 " + bodySizeClass}>
                  {pendingAction.text}
                </p>
              </div>
            </div>
          )}

          {(submitting || streamingNarrative) && (
            <div className="flex justify-start pr-4 sm:pr-16">
              <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-[#14110e] px-3.5 py-2.5">
                {streamingNarrative ? (
                  <p
                    className={
                      "whitespace-pre-line text-[#ece3d5] " + bodySizeClass
                    }
                  >
                    {renderFormattedText(streamingNarrative)}
                    <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-amber-400/70 align-middle" />
                  </p>
                ) : (
                  <TypingDots />
                )}
              </div>
            </div>
          )}

          <div ref={feedEndRef} />
        </div>
      </div>

      {/* Compositor estilo chat */}
      <div className="shrink-0 border-t border-white/5 bg-[#0d0a08]/95 px-2.5 pb-2 pt-2 sm:px-4">
        <div className="mx-auto w-full max-w-2xl">
          {recentLootNotification && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/60 px-3 py-2 text-[11px] text-emerald-100">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <p className="min-w-0 flex-1">{recentLootNotification}</p>
              {onDismissLootNotification && (
                <button
                  type="button"
                  onClick={onDismissLootNotification}
                  className="shrink-0 rounded p-1 text-emerald-300"
                  aria-label="Fechar notificação"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {!submitting && suggestions.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="max-w-[78%] shrink-0 truncate rounded-full border border-amber-500/20 bg-[#17130f] px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-200"
                  title={suggestion}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowTools(true)}
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#17130f] text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-200"
              aria-label="Ferramentas de ação"
              title="Ação, dado e voto"
            >
              <Plus className="h-5 w-5" />
            </button>

            <div className="relative min-w-0 flex-1">
              <textarea
                ref={inputRef}
                rows={1}
                value={actionText}
                onChange={(event) => setActionText(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Mensagem para o Mestre..."
                className="max-h-32 w-full resize-none rounded-2xl border border-white/10 bg-[#17130f] px-3.5 py-2.5 text-[15px] leading-relaxed text-amber-50 placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none"
                aria-label="Mensagem para o Mestre"
              />
            </div>

            <button
              type="submit"
              disabled={!actionText.trim() || submitting}
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-[#2a231c] disabled:text-slate-500"
              aria-label="Enviar ação"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>

          <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-slate-500">
            <span className="flex items-center gap-1 text-amber-300/80">
              <ModeIcon className="h-2.5 w-2.5" />
              {MODE_META[actionMode].label}
            </span>
            <span>· d20 {currentDiceRoll}</span>
            {revealedHandVow && (
              <span className="flex items-center gap-1 text-amber-300">
                <Zap className="h-2.5 w-2.5" /> Voto ativo
              </span>
            )}
            <span className="ml-auto hidden sm:inline">Enter envia · Shift+Enter quebra linha</span>
          </div>
        </div>
      </div>

      {/* Menu da crônica */}
      <Sheet open={showMenu} title="Crônica" onClose={() => setShowMenu(false)}>
        <div>
          <SectionLabel>Personagem</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <StatBox
              label="Vitalidade"
              value={Math.round(character.hpPercentage) + "%"}
              tone="text-emerald-300"
            />
            <StatBox
              label="Energia Amaldiçoada"
              value={Math.round(character.cursedEnergyPercentage) + "%"}
              tone="text-sky-300"
            />
            <StatBox
              label="Output"
              value={Math.round(character.outputPercentage) + "%"}
              tone="text-amber-300"
            />
            <StatBox
              label="Condição"
              value={character.physicalCondition}
              tone="text-slate-200 text-xs"
            />
          </div>
        </div>

        <div>
          <SectionLabel>Mundo</SectionLabel>
          <div className="space-y-2 rounded-xl border border-white/5 bg-[#17130f] p-3 text-[11px] leading-relaxed">
            <div>
              <span className="text-slate-500">Arco: </span>
              <span className="text-amber-200">{world.arc}</span>
            </div>
            <div>
              <span className="text-slate-500">Momento: </span>
              <span className="text-slate-200">{world.timelineAnchor || "Indefinido"}</span>
            </div>
            {world.missionObjective && (
              <div>
                <span className="text-slate-500">Objetivo: </span>
                <span className="text-slate-200">{world.missionObjective}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500">Barreira: </span>
              <span className="text-slate-200">
                {world.activeBarrierOrDomain || "Nenhuma"}
              </span>
            </div>
            {world.campaignPremise && (
              <p className="border-t border-white/5 pt-2 text-slate-400">
                {world.campaignPremise}
              </p>
            )}
          </div>
        </div>

        <div>
          <SectionLabel>Turno</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onManualRollDice?.();
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-amber-500/40"
            >
              <Dices className="h-4 w-4 text-amber-400" />
              Rolar 1d20 ({currentDiceRoll})
            </button>
            <button
              type="button"
              onClick={() => onToggleAutoRoll?.()}
              className={
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold " +
                (autoRollDice
                  ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                  : "border-white/10 bg-[#17130f] text-slate-400")
              }
            >
              {autoRollDice ? "Auto-rolagem ON" : "Auto-rolagem OFF"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRevealedHandVow((value) => !value);
              }}
              className={
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold " +
                (revealedHandVow
                  ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                  : "border-white/10 bg-[#17130f] text-slate-400")
              }
            >
              <Zap className="h-4 w-4" />
              {revealedHandVow ? "Voto ativo" : "Revelar a Mão"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSceneImage((value) => !value);
                setShowMenu(false);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-amber-500/40"
            >
              <ImageIcon className="h-4 w-4 text-amber-400" />
              {showSceneImage ? "Ocultar imagem" : "Mostrar imagem"}
            </button>
            {latestTurn && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  handleGenerateLatestImage();
                }}
                disabled={isGeneratingImageForTurn === latestTurn.id}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 text-xs font-semibold text-amber-200 disabled:opacity-50"
              >
                {isGeneratingImageForTurn === latestTurn.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Gerar frame do turno
              </button>
            )}
          </div>
        </div>

        <div>
          <SectionLabel>Leitura</SectionLabel>
          <div className="space-y-2">
            {onChangeFontSize && (
              <div className="grid grid-cols-3 gap-2">
                {(["small", "medium", "large"] as FontSizeOption[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onChangeFontSize(size)}
                    className={
                      "rounded-xl border px-2 py-2 text-xs font-semibold " +
                      (fontSize === size
                        ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                        : "border-white/10 bg-[#17130f] text-slate-400")
                    }
                  >
                    {size === "small" ? "P" : size === "medium" ? "M" : "G"}
                  </button>
                ))}
              </div>
            )}
            {onChangeModel && (
              <select
                value={model}
                onChange={(event) =>
                  onChangeModel(event.target.value as GeminiModelOption)
                }
                className="w-full rounded-xl border border-white/10 bg-[#17130f] px-3 py-2 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none"
                aria-label="Modelo do Mestre"
              >
                <option value="gemini-3.8-flash">3.8 Flash (Padrão)</option>
                <option value="gemini-3.5-flash-lite">Flash-Lite (Rápido)</option>
                <option value="gemini-3.1-flash-lite">3.1 Flash-Lite</option>
              </select>
            )}
            <div className="flex gap-2">
              {onToggleSfx && (
                <button
                  type="button"
                  onClick={onToggleSfx}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2 text-xs font-semibold text-slate-300"
                >
                  {sfxEnabled ? (
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-slate-500" />
                  )}
                  {sfxEnabled ? "Som ligado" : "Som mudo"}
                </button>
              )}
              {onToggleAutoGenerateImages && (
                <button
                  type="button"
                  onClick={onToggleAutoGenerateImages}
                  className={
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold " +
                    (autoGenerateImages
                      ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                      : "border-white/10 bg-[#17130f] text-slate-400")
                  }
                >
                  <ImageIcon className="h-4 w-4" />
                  Auto-imagem
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <SectionLabel>Sessão</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                handleUndo();
                setShowMenu(false);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200"
            >
              <Undo2 className="h-4 w-4" />
              Desfazer
            </button>
            <button
              type="button"
              onClick={() => {
                onRetryLastTurn();
                setShowMenu(false);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200"
            >
              <RotateCcw className="h-4 w-4" />
              Regerar
            </button>
            {onOpenSystemModal && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenSystemModal();
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200"
              >
                <Settings className="h-4 w-4" />
                Sistema
              </button>
            )}
            {onResetCampaign && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onResetCampaign();
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200"
              >
                <Plus className="h-4 w-4" />
                Nova ficha
              </button>
            )}
          </div>
          {apiKeyState !== "VALID" && (
            <p className="mt-2 text-[10px] leading-snug text-amber-300/80">
              IA em modo de continuidade. Verifique a chave/cota em Sistema.
              {onSwitchToLiteAndRetry ? " Você também pode trocar para o modelo Lite acima." : ""}
            </p>
          )}
        </div>

        <p className="text-center text-[9px] text-slate-600">
          Turno {turns.length} · {turns.length === 1 ? "1 mensagem" : turns.length + " mensagens"}
        </p>
      </Sheet>

      {/* Ferramentas de ação (compositor +) */}
      <Sheet open={showTools} title="Sua ação" onClose={() => setShowTools(false)}>
        <div>
          <SectionLabel>Modo</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MODE_META) as ActionMode[]).map((mode) => {
              const Icon = MODE_META[mode].icon;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActionMode(mode)}
                  className={
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold " +
                    (actionMode === mode
                      ? "border-amber-500/50 bg-amber-950/50 text-amber-200"
                      : "border-white/10 bg-[#17130f] text-slate-300")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {MODE_META[mode].label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <SectionLabel>Técnica</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickAbility("LAPSE")}
              className="rounded-xl border border-white/10 bg-[#17130f] px-3 py-2 text-left text-xs text-slate-200"
            >
              Lapso
              <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                {character.technique.lapse}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAbility("REVERSAL")}
              disabled={!character.technique.reversal}
              className="rounded-xl border border-white/10 bg-[#17130f] px-3 py-2 text-left text-xs text-slate-200 disabled:opacity-40"
            >
              Reversão
              <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                {character.technique.reversal || "Não desperta"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAbility("DOMAIN")}
              disabled={!character.technique.domainExpansion}
              className="rounded-xl border border-white/10 bg-[#17130f] px-3 py-2 text-left text-xs text-slate-200 disabled:opacity-40"
            >
              Domínio
              <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                {character.technique.domainExpansion || "Não desperta"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAbility("RCT")}
              className="rounded-xl border border-white/10 bg-[#17130f] px-3 py-2 text-left text-xs text-slate-200"
            >
              RCT
              <span className="mt-0.5 block text-[9px] text-slate-500">
                Regeneração
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAbility("BLACK_FLASH")}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-200"
            >
              <Zap className="h-4 w-4" />
              Buscar Kokusen (Black Flash)
            </button>
          </div>
        </div>

        <div>
          <SectionLabel>Dado e Voto</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onManualRollDice?.()}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200"
            >
              <Dices className="h-4 w-4 text-amber-400" />
              Rolar 1d20 ({currentDiceRoll})
            </button>
            <button
              type="button"
              onClick={() => onToggleAutoRoll?.()}
              className={
                "rounded-xl border px-3 py-2.5 text-xs font-semibold " +
                (autoRollDice
                  ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                  : "border-white/10 bg-[#17130f] text-slate-400")
              }
            >
              {autoRollDice ? "Auto-rolagem ON" : "Auto-rolagem OFF"}
            </button>
            <button
              type="button"
              onClick={() => setRevealedHandVow((value) => !value)}
              className={
                "col-span-2 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold " +
                (revealedHandVow
                  ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                  : "border-white/10 bg-[#17130f] text-slate-400")
              }
            >
              <Zap className="h-4 w-4" />
              {revealedHandVow ? "Voto ativo (+20% Output)" : "Revelar a Própria Mão (+20%)"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTools(false)}
          className="w-full rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-bold text-black"
        >
          Voltar para a conversa
        </button>
      </Sheet>

      {/* Detalhes do turno */}
      <Sheet
        open={Boolean(detailsTurn)}
        title={detailsTurn ? "Turno " + detailsTurn.turnNumber : "Turno"}
        onClose={() => setDetailsTurnId(null)}
      >
        {detailsTurn && (
          <>
            {detailsTurn.playerAction && (
              <div>
                <SectionLabel>Sua ação</SectionLabel>
                <p className="rounded-xl border border-white/5 bg-[#17130f] p-3 text-xs leading-relaxed text-slate-300">
                  {detailsTurn.playerAction.text}
                </p>
              </div>
            )}

            <div>
              <SectionLabel>Log do motor</SectionLabel>
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/5 bg-[#0c0907] p-3 text-[10px] leading-relaxed text-slate-400">
                {detailsTurn.gmResponse.engineLog || "Sem log neste turno."}
              </pre>
            </div>

            {detailsTurn.gmResponse.activeStoryCards?.length > 0 && (
              <div>
                <SectionLabel>Cards ativos</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {detailsTurn.gmResponse.activeStoryCards.map((card) => (
                    <span
                      key={card}
                      className="rounded-full border border-white/10 bg-[#17130f] px-2 py-1 text-[10px] text-slate-300"
                    >
                      {card}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detailsTurn.gmResponse.activeCardRuleSummary && (
              <div>
                <SectionLabel>Regra em foco</SectionLabel>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {detailsTurn.gmResponse.activeCardRuleSummary}
                </p>
              </div>
            )}

            <div>
              <SectionLabel>Estado</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <StatBox
                  label="HP"
                  value={Math.round(detailsTurn.gmResponse.playerStateUpdate?.hpPercentage ?? 100) + "%"}
                  tone="text-emerald-300"
                />
                <StatBox
                  label="EA"
                  value={Math.round(detailsTurn.gmResponse.playerStateUpdate?.cursedEnergyPercentage ?? 100) + "%"}
                  tone="text-sky-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {detailsTurn.id === latestTurn?.id && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailsTurnId(null);
                    onRetryLastTurn();
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  Regerar turno
                </button>
              )}
              {onRewindToTurn && detailsTurn.id !== latestTurn?.id && (
                <button
                  type="button"
                  onClick={() => {
                    const index = turns.findIndex((turn) => turn.id === detailsTurn.id);
                    if (index >= 0) onRewindToTurn(index);
                    setDetailsTurnId(null);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17130f] px-3 py-2.5 text-xs font-semibold text-slate-200"
                >
                  <Undo2 className="h-4 w-4" />
                  Voltar aqui
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailsTurnId(null)}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-bold text-black"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </Sheet>
    </main>
  );
};

