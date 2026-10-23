import React from 'react';
import type { CampaignState } from '@/shared/types/jjk';
import { ArrowRight, BookOpen, PlusCircle } from 'lucide-react';

interface CharacterProfilePageProps {
  campaign: CampaignState;
  onContinue: () => void;
  onNewCharacter: () => void;
  onOpenCodex: () => void;
}

const ValueRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="border-t border-[rgba(255,255,255,0.07)] py-4 first:border-t-0 first:pt-0">
    <div className="editorial-label">{label}</div>
    <p className="editorial-body mt-1 text-[1.02rem] whitespace-pre-line">{value || '—'}</p>
  </div>
);

export const CharacterProfilePage: React.FC<CharacterProfilePageProps> = ({
  campaign,
  onContinue,
  onNewCharacter,
  onOpenCodex,
}) => {
  const character = campaign.character;
  const world = campaign.world;
  const technique = character.technique;

  return (
    <div className="editorial-page">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="editorial-eyebrow">Ficha do feiticeiro</div>
          <h1 className="editorial-page-title mt-4 break-words">{character.name}</h1>
          <p className="editorial-muted mt-4 font-sans text-[11px] uppercase tracking-[0.16em]">
            {character.grade}
            {character.age ? ` · ${character.age}` : ''} · {character.clan}
          </p>
          <p className="editorial-muted mt-1 font-sans text-[11px]">{character.faction}</p>
        </div>

        <div className="shrink-0">
          <img
            src={character.avatarUrl}
            alt={character.name}
            referrerPolicy="no-referrer"
            className="h-32 w-32 border border-[rgba(201,169,106,0.28)] object-cover sm:h-40 sm:w-40"
          />
        </div>
      </div>

      <div className="mt-8 border border-[rgba(201,169,106,0.22)] px-5 py-4">
        <div className="editorial-label">Condição atual</div>
        <p className="editorial-serif mt-1 text-lg text-[#ded4c1]">
          {character.physicalCondition || 'Intacto'}
        </p>
      </div>

      <div className="mt-12 space-y-12">
        <section>
          <div className="flex items-center gap-4">
            <span className="editorial-numeral">I</span>
            <h2 className="editorial-section-title">Identidade</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.22)]" />
          </div>
          <div className="mt-6">
            <ValueRow label="Aparência" value={character.appearance} />
            <ValueRow label="História" value={character.backstory} />
            <ValueRow label="Personalidade" value={character.personalityTraits} />
            <ValueRow label="Motivação" value={character.ideals} />
            <ValueRow label="Vínculos" value={character.bonds} />
            <ValueRow label="Defeitos" value={character.flaws} />
            <ValueRow label="Clã e linhagem" value={character.clanTradition || character.clanTrait} />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4">
            <span className="editorial-numeral">II</span>
            <h2 className="editorial-section-title">Técnica inata</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.22)]" />
          </div>
          <div className="mt-6">
            <ValueRow label="Nome" value={technique.name} />
            <ValueRow label="Como funciona" value={technique.description} />
            <ValueRow label="Custo e limites" value={technique.activationConditions} />
            <ValueRow label="Lapso" value={technique.lapse} />
            <ValueRow label="Reversão" value={technique.reversal} />
            <ValueRow label="Técnica máxima" value={technique.maximum} />
            <ValueRow
              label="Técnica reversa (RCT)"
              value={
                technique.hasRct
                  ? 'Desenvolvida'
                  : technique.rctStatus || 'Não desenvolvida ainda'
              }
            />
            <ValueRow label="Anti-domínio" value={technique.antiDomain} />
            <ValueRow label="Expansão de domínio" value={technique.domainExpansion} />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4">
            <span className="editorial-numeral">III</span>
            <h2 className="editorial-section-title">Votos e arsenal</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.22)]" />
          </div>
          <div className="mt-6">
            <ValueRow
              label="Votos vinculativos"
              value={
                character.bindingVows.length > 0
                  ? character.bindingVows
                      .map((vow) => `${vow.name} — ${vow.condition} (${vow.active ? 'ativo' : 'inativo'})`)
                      .join('\n')
                  : 'Nenhum voto selado.'
              }
            />
            <ValueRow
              label="Equipamento"
              value={
                character.inventory.length > 0
                  ? character.inventory
                      .map((item) => `${item.name} (${item.grade}) — ${item.effect}`)
                      .join('\n')
                  : 'Nenhuma ferramenta amaldiçoada registrada.'
              }
            />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4">
            <span className="editorial-numeral">IV</span>
            <h2 className="editorial-section-title">Crônica</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.22)]" />
          </div>
          <div className="mt-6">
            <ValueRow label="Arco atual" value={world.arc} />
            <ValueRow label="Local" value={world.location} />
            <ValueRow label="Objetivo" value={world.missionObjective} />
            <ValueRow label="Momento" value={world.timelineAnchor} />
            <ValueRow
              label="Histórico"
              value={
                (character.evolutionHistory || [])
                  .slice(-5)
                  .map((entry) => `Turno #${entry.turnNumber} · ${entry.title}`)
                  .join('\n') || 'A história ainda não registrou mudanças.'
              }
            />
          </div>
        </section>
      </div>

      <div className="mt-14 flex flex-wrap items-center gap-4 border-t border-[rgba(201,169,106,0.2)] pt-7">
        <button type="button" onClick={onContinue} className="editorial-button">
          Continuar crônica
          <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onOpenCodex} className="editorial-button editorial-button--ghost">
          <BookOpen className="h-3.5 w-3.5" />
          Códice
        </button>
        <button type="button" onClick={onNewCharacter} className="editorial-link ml-auto flex items-center gap-2">
          <PlusCircle className="h-3.5 w-3.5" />
          Nova ficha
        </button>
      </div>
    </div>
  );
};
