import React from 'react';
import type { ActionMode, CampaignState, NpcInScene, StoryCard } from '../types/jjk';
import { ArrowRight, Brain, MapPin, Users } from 'lucide-react';
import { generateCanonicalPortraitSvg } from '../utils/svgArtGenerator';

interface WorldSidebarProps {
  campaign: CampaignState;
  codexCards: StoryCard[];
  npcAvatars: Record<string, string>;
  onGenerateNpcAvatar: (npc: NpcInScene) => void;
  generatingNpcName: string | null;
  onQuickTargetNpc: (name: string, mode: ActionMode) => void;
  onSummarizeMemory: () => void;
  isSummarizingMemory: boolean;
  onOpenCodex: () => void;
}

export const WorldSidebar: React.FC<WorldSidebarProps> = ({
  campaign,
  codexCards,
  npcAvatars,
  onGenerateNpcAvatar,
  generatingNpcName,
  onQuickTargetNpc,
  onSummarizeMemory,
  isSummarizingMemory,
  onOpenCodex,
}) => {
  const world = campaign.world;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 py-6">
      <div className="editorial-eyebrow">Mundo</div>

      <div className="mt-5 space-y-3">
        <div>
          <div className="editorial-label">Arco</div>
          <p className="editorial-serif text-[15px] leading-snug text-[#ded4c1]">{world.arc}</p>
        </div>
        <div>
          <div className="editorial-label">Local</div>
          <p className="editorial-serif text-[15px] leading-snug text-[#ded4c1]">{world.location}</p>
        </div>
        <div>
          <div className="editorial-label">Momento</div>
          <p className="editorial-muted font-sans text-[11px] leading-relaxed">
            {world.timelineAnchor || 'Indefinido'}
          </p>
        </div>
        {world.missionObjective && (
          <div>
            <div className="editorial-label">Objetivo</div>
            <p className="editorial-muted font-sans text-[11px] leading-relaxed">
              {world.missionObjective}
            </p>
          </div>
        )}
        <div>
          <div className="editorial-label">Barreira / domínio</div>
          <p className="editorial-serif text-[14px] text-[#d8bd86]">
            {world.activeBarrierOrDomain || 'Nenhum'}
          </p>
        </div>
      </div>

      <div className="mt-7 border-t border-[rgba(201,169,106,0.16)] pt-5">
        <div className="editorial-label flex items-center gap-2">
          <Users className="h-3 w-3" />
          Presenças · {world.npcsInScene.length}
        </div>

        <div className="mt-3 space-y-3">
          {world.npcsInScene.length === 0 && (
            <p className="editorial-muted font-sans text-[11px]">Ninguém no raio imediato.</p>
          )}
          {world.npcsInScene.map((npc) => {
            const avatar =
              npcAvatars[npc.name] ||
              npc.avatarUrl ||
              generateCanonicalPortraitSvg(npc.name, `${npc.grade} ${npc.status}`);
            const dead = /exorcizado|derrotado|morto|desintegr/i.test(npc.status);
            return (
              <div key={npc.name} className="border border-[rgba(255,255,255,0.07)] p-3">
                <div className="flex items-start gap-3">
                  <img
                    src={avatar}
                    alt={npc.name}
                    referrerPolicy="no-referrer"
                    className={'h-11 w-11 shrink-0 border border-[rgba(201,169,106,0.18)] object-cover ' + (dead ? 'grayscale opacity-60' : '')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="editorial-serif truncate text-[15px] leading-tight text-[#e7ddcb]">
                        {npc.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => onGenerateNpcAvatar(npc)}
                        disabled={generatingNpcName === npc.name}
                        className="editorial-link shrink-0 text-[8px]"
                        title="Gerar retrato"
                      >
                        {generatingNpcName === npc.name ? '...' : 'IA'}
                      </button>
                    </div>
                    <p className="editorial-muted mt-0.5 font-sans text-[9px] uppercase tracking-[0.1em]">
                      {npc.grade} · {npc.attitude}
                    </p>
                    <p className="editorial-muted mt-1 font-sans text-[10px] leading-relaxed">
                      {npc.status}
                    </p>
                    {!dead && (
                      <div className="mt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => onQuickTargetNpc(npc.name, 'DO')}
                          className="editorial-link text-[8px]"
                        >
                          Atacar
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickTargetNpc(npc.name, 'SAY')}
                          className="editorial-link text-[8px]"
                        >
                          Falar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-7 border-t border-[rgba(201,169,106,0.16)] pt-5">
        <div className="editorial-label flex items-center gap-2">
          <Brain className="h-3 w-3" />
          Memória · {campaign.memories.length}
        </div>
        <button
          type="button"
          onClick={onSummarizeMemory}
          disabled={isSummarizingMemory}
          className="editorial-link mt-2"
        >
          {isSummarizingMemory ? 'Resumindo...' : 'Resumir turnos recentes'}
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenCodex}
        className="editorial-link mt-auto flex items-center gap-2 pt-6"
      >
        <MapPin className="h-3.5 w-3.5" />
        Explorar o Códice · {codexCards.length}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
