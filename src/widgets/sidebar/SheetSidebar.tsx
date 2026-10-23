import React from 'react';
import type { CharacterSheet, WorldStateUpdate } from '@/shared/types/jjk';
import { ArrowRight, HeartHandshake, ScrollText } from 'lucide-react';

interface SheetSidebarProps {
  character: CharacterSheet;
  world: WorldStateUpdate;
  onOpenCharacter: () => void;
}

export const SheetSidebar: React.FC<SheetSidebarProps> = ({
  character,
  world,
  onOpenCharacter,
}) => {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 py-6">
      <div className="editorial-eyebrow">Ficha</div>

      <div className="mt-5 flex items-start gap-4">
        <img
          src={character.avatarUrl}
          alt={character.name}
          referrerPolicy="no-referrer"
          className="h-20 w-20 shrink-0 border border-[rgba(201,169,106,0.25)] object-cover"
        />
        <div className="min-w-0">
          <h2 className="editorial-serif text-[22px] leading-tight text-[#ece2d0]">
            {character.name}
          </h2>
          <p className="editorial-muted mt-1 font-sans text-[9px] uppercase tracking-[0.14em]">
            {character.grade}
          </p>
          <p className="editorial-muted mt-0.5 truncate font-sans text-[10px]">{character.clan}</p>
        </div>
      </div>

      <div className="mt-6 border border-[rgba(201,169,106,0.2)] px-4 py-3">
        <div className="editorial-label">Condição</div>
        <p className="editorial-serif mt-1 text-[15px] leading-snug text-[#ded4c1]">
          {character.physicalCondition || 'Intacto'}
        </p>
      </div>

      <div className="mt-7">
        <div className="editorial-label flex items-center gap-2">
          <ScrollText className="h-3 w-3" />
          Técnica inata
        </div>
        <h3 className="editorial-serif mt-2 text-[17px] leading-tight text-[#e7ddcb]">
          {character.technique.name}
        </h3>
        <p className="editorial-muted mt-2 line-clamp-4 font-sans text-[11px] leading-relaxed">
          {character.technique.description}
        </p>
        {character.technique.lapse && (
          <p className="editorial-muted mt-3 border-t border-[rgba(255,255,255,0.07)] pt-2 font-sans text-[10px] leading-relaxed">
            <span className="editorial-eyebrow text-[8px]">Lapso · </span>
            {character.technique.lapse}
          </p>
        )}
      </div>

      <div className="mt-7">
        <div className="editorial-label flex items-center gap-2">
          <HeartHandshake className="h-3 w-3" />
          Votos
        </div>
        {character.bindingVows.length === 0 ? (
          <p className="editorial-muted mt-2 font-sans text-[11px]">Nenhum voto selado.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {character.bindingVows.slice(0, 3).map((vow) => (
              <li key={vow.id} className="font-sans text-[11px] leading-relaxed text-[#bdb2a0]">
                <span className="text-[#d8bd86]">{vow.name}</span>
                <span className="editorial-muted"> — {vow.condition}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-7 border-t border-[rgba(201,169,106,0.16)] pt-4">
        <div className="editorial-label">Crônica</div>
        <p className="editorial-muted mt-2 font-sans text-[10px] leading-relaxed">
          {world.location}
        </p>
        <p className="editorial-muted mt-1 font-sans text-[10px] leading-relaxed">
          {world.timelineAnchor || world.arc}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenCharacter}
        className="editorial-link mt-auto flex items-center gap-2 pt-6"
      >
        Abrir ficha completa
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
