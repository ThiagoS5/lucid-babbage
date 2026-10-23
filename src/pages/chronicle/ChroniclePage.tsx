import React, { useState } from 'react';
import type {
  ActionMode,
  CampaignState,
  FontSizeOption,
  GeminiModelOption,
  NpcInScene,
  StoryCard,
  VisualEffectTrigger,
} from '@/shared/types/jjk';
import type { ApiKeyHealthState } from '@/features/narrative/lib/geminiService';
import { ChatNarrativeStage } from '@/widgets/chat/ChatNarrativeStage';
import { SheetSidebar } from '@/widgets/sidebar/SheetSidebar';
import { WorldSidebar } from '@/widgets/sidebar/WorldSidebar';
import { BookOpen, PanelLeft, PanelRight, User } from 'lucide-react';

interface ChroniclePageProps {
  campaign: CampaignState;
  codexCards: StoryCard[];
  model: GeminiModelOption;
  fontSize: FontSizeOption;
  autoGenerateImages: boolean;
  onToggleAutoGenerateImages: () => void;
  onGenerateTurnImage: (turnId: string, prompt: string, vfx?: VisualEffectTrigger) => void;
  isGeneratingImageForTurn: string | null;
  onOpenLightbox: (url: string, caption: string) => void;
  onSubmitAction: (params: { mode: ActionMode; text: string; revealedHandVow: boolean }) => void;
  isSubmittingTurn: boolean;
  streamingNarrative: string;
  onEditTurnNarrative: (turnId: string, text: string) => void;
  onRetryLastTurn: () => void;
  onRewindToTurn: (turnIdx: number) => void;
  activeVfx: VisualEffectTrigger;
  rateLimitNotice: string | null;
  onDismissRateLimitNotice: () => void;
  onSwitchToLiteAndRetry: () => void;
  recentLootNotification: string | null;
  onDismissLootNotification: () => void;
  externalActionDraft: { mode: ActionMode; text: string; id: number } | null;
  apiKeyState: ApiKeyHealthState;
  onOpenSettings: () => void;
  onChangeModel: (model: GeminiModelOption) => void;
  onChangeFontSize: (size: FontSizeOption) => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  onResetCampaign: () => void;
  onUpdateCharacter: (character: CampaignState['character']) => void;
  onRegeneratePortrait: () => void;
  isRegeneratingPortrait: boolean;
  onGenerateNpcAvatar: (npc: NpcInScene) => void;
  generatingNpcName: string | null;
  onSummarizeMemory: () => void;
  isSummarizingMemory: boolean;
  onQuickTargetNpc: (name: string, mode: ActionMode) => void;
  onOpenCharacter: () => void;
  onOpenCodex: () => void;
  onSetActiveBarrierOrDomain: (label: string) => void;
}

export const ChroniclePage: React.FC<ChroniclePageProps> = ({
  campaign,
  codexCards,
  model,
  fontSize,
  autoGenerateImages,
  onToggleAutoGenerateImages,
  onGenerateTurnImage,
  isGeneratingImageForTurn,
  onOpenLightbox,
  onSubmitAction,
  isSubmittingTurn,
  streamingNarrative,
  onEditTurnNarrative,
  onRetryLastTurn,
  onRewindToTurn,
  activeVfx,
  rateLimitNotice,
  onDismissRateLimitNotice,
  onSwitchToLiteAndRetry,
  recentLootNotification,
  onDismissLootNotification,
  externalActionDraft,
  apiKeyState,
  onOpenSettings,
  onChangeModel,
  onChangeFontSize,
  sfxEnabled,
  onToggleSfx,
  onResetCampaign,
  onUpdateCharacter,
  onRegeneratePortrait,
  isRegeneratingPortrait,
  onGenerateNpcAvatar,
  generatingNpcName,
  onSummarizeMemory,
  isSummarizingMemory,
  onQuickTargetNpc,
  onOpenCharacter,
  onOpenCodex,
  onSetActiveBarrierOrDomain,
}) => {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const focusMode = !leftOpen && !rightOpen;

  const chat = (
    <ChatNarrativeStage
      character={campaign.character}
      world={campaign.world}
      turns={campaign.turns}
      npcAvatars={campaign.npcAvatars}
      fontSize={fontSize}
      autoGenerateImages={autoGenerateImages}
      onToggleAutoGenerateImages={onToggleAutoGenerateImages}
      onGenerateTurnImage={onGenerateTurnImage}
      isGeneratingImageForTurn={isGeneratingImageForTurn}
      onOpenLightbox={onOpenLightbox}
      onSubmitAction={onSubmitAction}
      isSubmittingTurn={isSubmittingTurn}
      streamingNarrative={streamingNarrative}
      onEditTurnNarrative={onEditTurnNarrative}
      onRetryLastTurn={onRetryLastTurn}
      onRewindToTurn={onRewindToTurn}
      activeVfx={activeVfx}
      rateLimitNotice={rateLimitNotice}
      onDismissRateLimitNotice={onDismissRateLimitNotice}
      onSwitchToLiteAndRetry={onSwitchToLiteAndRetry}
      recentLootNotification={recentLootNotification}
      onDismissLootNotification={onDismissLootNotification}
      externalActionDraft={externalActionDraft}
      apiKeyState={apiKeyState}
      onOpenSystemModal={onOpenSettings}
      model={model}
      onChangeModel={onChangeModel}
      onChangeFontSize={onChangeFontSize}
      sfxEnabled={sfxEnabled}
      onToggleSfx={onToggleSfx}
      onResetCampaign={onResetCampaign}
    />
  );

  return (
    <div className="chronicle-shell flex h-full min-h-0 flex-col">
      <div className="hidden shrink-0 items-center justify-between gap-4 border-b border-[rgba(201,169,106,0.14)] px-5 py-2 lg:flex">
        <div className="flex min-w-0 items-center gap-3">
          <span className="editorial-eyebrow">Crônica</span>
          <span className="h-3 w-px bg-[rgba(201,169,106,0.25)]" />
          <span className="editorial-serif truncate text-sm text-[#cfc4b0]">{campaign.world.arc}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLeftOpen((value) => !value)}
            className="editorial-link flex items-center gap-1.5 px-2 py-1"
            title={leftOpen ? 'Recolher ficha' : 'Abrir ficha'}
          >
            <PanelLeft className="h-3.5 w-3.5" />
            Ficha
          </button>
          <button
            type="button"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
            className={
              'editorial-link px-2 py-1 ' + (focusMode ? 'text-[#e6cfa2]' : '')
            }
            title="Modo foco narrativo"
          >
            Foco
          </button>
          <button
            type="button"
            onClick={() => setRightOpen((value) => !value)}
            className="editorial-link flex items-center gap-1.5 px-2 py-1"
            title={rightOpen ? 'Recolher mundo' : 'Abrir mundo'}
          >
            Mundo
            <PanelRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onOpenCharacter} className="editorial-link flex items-center gap-1.5 px-2 py-1">
            <User className="h-3.5 w-3.5" />
            Perfil
          </button>
          <button type="button" onClick={onOpenCodex} className="editorial-link flex items-center gap-1.5 px-2 py-1">
            <BookOpen className="h-3.5 w-3.5" />
            Códice
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {leftOpen && (
          <div className="hidden w-[320px] shrink-0 border-r border-[rgba(201,169,106,0.14)] lg:block">
            <SheetSidebar
              character={campaign.character}
              world={campaign.world}
              onOpenCharacter={onOpenCharacter}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">{chat}</div>

        {rightOpen && (
          <div className="hidden w-[340px] shrink-0 border-l border-[rgba(201,169,106,0.14)] lg:block">
            <WorldSidebar
              campaign={campaign}
              codexCards={codexCards}
              npcAvatars={campaign.npcAvatars}
              onGenerateNpcAvatar={onGenerateNpcAvatar}
              generatingNpcName={generatingNpcName}
              onQuickTargetNpc={onQuickTargetNpc}
              onSummarizeMemory={onSummarizeMemory}
              isSummarizingMemory={isSummarizingMemory}
              onOpenCodex={onOpenCodex}
            />
          </div>
        )}
      </div>
    </div>
  );
};
