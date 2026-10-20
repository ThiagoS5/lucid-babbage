import React, { useState } from 'react';
import {
  ActionMode,
  CharacterSheet,
  MemoryEntry,
  NpcInScene,
  StoryCard,
  WorldStateUpdate,
} from '../types/jjk';
import {
  calculateGradeModifier,
  getDiceOutcomeInfo,
  parseJsonStoryCards,
  parseMarkdownCodex,
  resolveDomainTheme,
  rollD20,
} from '../utils/jjkEngine';
import { generateCanonicalPortraitSvg } from '../utils/svgArtGenerator';
import { resolveCanonicalPortraitUrl } from '../data/characterPortraits';
import { jjkAudio } from '../utils/soundEffects';
import {
  MapPin,
  Users,
  Dices,
  BookMarked,
  Brain,
  Search,
  Upload,
  Sparkles,
  Shield,
  Plus,
  Heart,
  Skull,
  Sword,
  MessageSquare,
} from 'lucide-react';

interface RightWorldRadarProps {
  character?: CharacterSheet;
  world: WorldStateUpdate;
  npcAvatars: Record<string, string>;
  onGenerateNpcAvatar: (npc: NpcInScene) => void;
  generatingNpcName: string | null;
  currentDiceRoll: number;
  autoRollDice: boolean;
  onToggleAutoRollDice: () => void;
  onManualRollDice: (newRoll: number) => void;
  codexCards: StoryCard[];
  onImportCodexCards: (newCards: StoryCard[]) => void;
  memories: MemoryEntry[];
  onSummarizeMemory: () => void;
  isSummarizingMemory: boolean;
  onQuickTargetNpc?: (npcName: string, mode: ActionMode) => void;
  forceTab?: 'radar' | 'codex';
}

export const RightWorldRadar: React.FC<RightWorldRadarProps> = ({
  character,
  world,
  npcAvatars,
  onGenerateNpcAvatar,
  generatingNpcName,
  currentDiceRoll,
  autoRollDice,
  onToggleAutoRollDice,
  onManualRollDice,
  codexCards,
  onImportCodexCards,
  memories,
  onSummarizeMemory,
  isSummarizingMemory,
  onQuickTargetNpc,
  forceTab,
}) => {
  const [subTab, setSubTab] = useState<'radar' | 'dice' | 'codex' | 'memory'>(
    forceTab === 'codex' ? 'codex' : 'radar'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardKeys, setNewCardKeys] = useState('');
  const [newCardValue, setNewCardValue] = useState('');
  const [showAddCard, setShowAddCard] = useState(false);

  const [codexFilter, setCodexFilter] = useState<
    'all' | 'codex_md' | 'character' | 'technique' | 'story_json'
  >('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const domainTheme = resolveDomainTheme(world.activeBarrierOrDomain, character?.technique?.domainPortal);
  const modInfo = calculateGradeModifier(character);
  const diceInfo = getDiceOutcomeInfo(currentDiceRoll, modInfo.totalMod);

  const codexMdCount = codexCards.filter((c) => c.source === 'codex_md').length;
  const storyJsonCount = codexCards.filter((c) => c.source === 'story_json').length;

  const filteredCodex = codexCards.filter((c) => {
    if (codexFilter === 'codex_md' && c.source !== 'codex_md') return false;
    if (codexFilter === 'story_json' && c.source !== 'story_json') return false;
    if (codexFilter === 'character' && c.type !== 'character') return false;
    if (
      codexFilter === 'technique' &&
      c.type !== 'technique' &&
      c.type !== 'domain' &&
      c.type !== 'tool'
    ) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.value.toLowerCase().includes(q) ||
      c.keys.some((k) => k.toLowerCase().includes(q))
    );
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        const cards = parseJsonStoryCards(text);
        onImportCodexCards(cards);
        setImportStatus(`${cards.length} Story Cards (.json) importados!`);
      } else {
        const cards = parseMarkdownCodex(text);
        onImportCodexCards(cards);
        setImportStatus(`${cards.length} seções (.md) importadas ao Códice!`);
      }
    } catch {
      setImportStatus('Formato de arquivo inválido.');
    }
  };

  const handleCreateCustomCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim() || !newCardValue.trim()) return;
    onImportCodexCards([
      {
        id: `custom-${Date.now()}`,
        title: newCardTitle.trim(),
        keys: newCardKeys
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
        type: 'lore',
        value: newCardValue.trim(),
        source: 'custom',
      },
    ]);
    setNewCardTitle('');
    setNewCardKeys('');
    setNewCardValue('');
    setShowAddCard(false);
  };

  const handleRollDiceClick = (forcedVal?: number) => {
    const nextRoll = forcedVal ?? rollD20();
    if (nextRoll === 20) {
      jjkAudio.playBlackFlash();
    } else {
      jjkAudio.playDiceRoll();
    }
    onManualRollDice(nextRoll);
  };

  return (
    <aside
      aria-label="Radar de Mundo e Códice RAG"
      className="h-full flex flex-col bg-[#0d0b09]/95 border-l border-slate-800/80 overflow-y-auto select-none"
    >
      {/* Curtain (Tobari) Dark Isolation Indicator */}
      {domainTheme.isCurtainActive && (
        <div className="px-3.5 py-2 bg-amber-950/80 border-b border-amber-500/40 text-[11px] font-medium text-amber-200 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Cortina (Tobari) Ativa: Área isolada de civis e sinais externos.</span>
        </div>
      )}

      {/* 1. World State & Location Summary Card */}
      <div className="p-4 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-wider text-[10px] font-bold text-sky-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>Radar do Mundo & Arco</span>
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[#080605] border border-slate-800/90 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Arco Cronológico:</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${
                world.era === 'canon'
                  ? 'bg-sky-950/60 border-sky-500/40 text-sky-300'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              }`}
            >
              {world.era === 'canon' ? 'Canônico 2018' : 'Seguimento'}
            </span>
          </div>
          <div className="font-medium text-amber-200/95 break-words leading-snug">{world.arc}</div>
          <div className="pt-1.5 border-t border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Local Atual:</span>
            <div className="font-semibold text-white break-words leading-snug mt-0.5">{world.location}</div>
          </div>
          <div className="pt-1.5 border-t border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Momento:</span>
            <div className="font-medium text-sky-200/90 break-words leading-snug mt-0.5">
              {world.timelineAnchor || 'Indefinido'}
            </div>
          </div>
          {world.missionObjective && (
            <div className="pt-1.5 border-t border-slate-800/80">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                Objetivo do Arco:
              </span>
              <div className="text-slate-200 break-words leading-snug mt-0.5">{world.missionObjective}</div>
            </div>
          )}
          {world.campaignPremise && (
            <details className="pt-1.5 border-t border-slate-800/80 group">
              <summary className="cursor-pointer text-[10px] uppercase tracking-wider font-semibold text-amber-400/90 hover:text-amber-300">
                Premissa &amp; seu papel
              </summary>
              <p className="mt-1 text-[11px] leading-snug text-slate-300">{world.campaignPremise}</p>
              {world.playerRole && (
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                  <span className="text-amber-300/90 font-semibold">Seu papel: </span>
                  {world.playerRole}
                </p>
              )}
            </details>
          )}
          <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1">
            <span className="text-slate-400 text-[11px]">Barreira / Domínio:</span>
            <span className={`font-semibold text-[11px] break-words ${domainTheme.badgeColorClass}`}>
              {world.activeBarrierOrDomain}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Right Column */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-[#080605] border-b border-slate-800/80 text-xs">
        <button
          type="button"
          onClick={() => setSubTab('radar')}
          className={`py-2 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'radar' ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40' : 'text-slate-400 hover:text-amber-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>NPCs ({world.npcsInScene.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('dice')}
          className={`py-2 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'dice' ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40' : 'text-slate-400 hover:text-amber-200'
          }`}
        >
          <Dices className="w-3.5 h-3.5 text-amber-400" />
          <span>1d20</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('codex')}
          className={`py-2 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'codex' ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40' : 'text-slate-400 hover:text-amber-200'
          }`}
        >
          <BookMarked className="w-3.5 h-3.5 text-amber-400" />
          <span>Códice ({codexCards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('memory')}
          className={`py-2 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'memory' ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40' : 'text-slate-400 hover:text-amber-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-emerald-400" />
          <span>Memória</span>
        </button>
      </div>

      {/* SubTab Body */}
      <div className="p-4 flex-1 space-y-4 text-xs">
        {/* 2. Presence Radar (NPCs in Scene with HP Bar & Quick Tactical Actions) */}
        {subTab === 'radar' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold">
                Presenças Detectadas na Cena
              </span>
              <span className="text-[11px] text-slate-400">
                {world.npcsInScene.length} em cena
              </span>
            </div>

            {world.npcsInScene.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#080605] border border-slate-800/80 text-slate-400 text-center">
                Nenhum NPC ou Espírito Amaldiçoado detectado no raio imediato.
              </div>
            ) : (
              <div className="space-y-2.5">
                {world.npcsInScene.map((npc) => {
                  const canonicalPortrait = resolveCanonicalPortraitUrl(npc.name);
                  const avatar =
                    npcAvatars[npc.name] ||
                    canonicalPortrait ||
                    (npc.avatarUrl && !npc.avatarUrl.startsWith('data:image/svg+xml')
                      ? npc.avatarUrl
                      : null) ||
                    generateCanonicalPortraitSvg(
                      npc.name,
                      `${npc.grade} ${npc.attitude} ${npc.status}`
                    );
                  const hp = typeof npc.hpPercentage === 'number' ? Math.max(0, Math.min(100, npc.hpPercentage)) : 100;
                  const isDefeated = hp <= 0 || /exorcizado|derrotado/i.test(npc.status);

                  const attitudeColor = isDefeated
                    ? 'text-slate-500 border-slate-800 opacity-70'
                    : npc.attitude === 'Aliado'
                    ? 'text-sky-400 border-sky-500/30'
                    : npc.attitude === 'Hostil'
                    ? 'text-amber-400 border-amber-500/40'
                    : 'text-amber-400 border-amber-500/30';

                  const hpFillColor = isDefeated
                    ? 'bg-slate-700'
                    : npc.attitude === 'Aliado'
                    ? 'bg-emerald-500'
                    : npc.attitude === 'Hostil'
                    ? 'bg-amber-600'
                    : 'bg-amber-500';

                  return (
                    <div
                      key={npc.name}
                      className={`p-3 rounded-xl bg-[#080605] border space-y-2.5 transition-all ${attitudeColor}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={avatar}
                            alt={npc.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className={`w-14 h-14 rounded-xl object-cover border border-slate-700 bg-[#0d0b09] ${
                              isDefeated ? 'grayscale' : ''
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => onGenerateNpcAvatar(npc)}
                            disabled={generatingNpcName === npc.name}
                            title="Atualizar retrato do NPC"
                            className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-sky-300 cursor-pointer shadow"
                          >
                            <Sparkles className={`w-3 h-3 ${generatingNpcName === npc.name ? 'animate-spin text-amber-400' : ''}`} />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="font-display font-bold text-white break-words leading-snug">
                            {npc.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="text-slate-300">{npc.grade}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold">{npc.attitude}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 break-words leading-relaxed">
                            {isDefeated ? 'Exorcizado / Derrotado (0% HP)' : npc.status}
                          </p>
                        </div>
                      </div>

                      {/* Mini HP Bar for NPC */}
                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            {isDefeated ? (
                              <Skull className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Heart className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{isDefeated ? 'Exorcizado / Derrotado' : 'Vitalidade (HP)'}</span>
                          </span>
                          <span className="font-mono-tabular font-bold text-slate-200">
                            {Math.round(hp)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${hpFillColor}`}
                            style={{ width: `${hp}%` }}
                          />
                        </div>
                      </div>

                      {/* Quick Tactical Interaction Toolbar */}
                      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                        {onQuickTargetNpc && (
                          <>
                            <button
                              type="button"
                              disabled={isDefeated}
                              onClick={() => onQuickTargetNpc(npc.name, 'DO')}
                              className="py-1 px-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-[10px] text-amber-300 flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                            >
                              <Sword className="w-3 h-3 shrink-0" />
                              <span>Atacar</span>
                            </button>
                            <button
                              type="button"
                              disabled={isDefeated}
                              onClick={() => onQuickTargetNpc(npc.name, 'SAY')}
                              className="py-1 px-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-[10px] text-amber-300 flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3 shrink-0" />
                              <span>Falar</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery(npc.name.split('—')[0].trim());
                            setSubTab('codex');
                          }}
                          className="py-1 px-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-[10px] text-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <BookMarked className="w-3 h-3 shrink-0" />
                          <span>Códice</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. Tactical 1d20 Jujutsu Dice System with Grade Modifier */}
        {subTab === 'dice' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#080605] border border-slate-800/90 text-center space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Modo de Rolagem:</span>
                <button
                  type="button"
                  onClick={onToggleAutoRollDice}
                  className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                    autoRollDice
                      ? 'bg-sky-600/25 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {autoRollDice ? 'Automático por Turno' : 'Manual'}
                </button>
              </div>

              <div className="py-2 flex items-center justify-center gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Dado 1d20
                  </div>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0d0b09] border-2 border-amber-500/60 font-mono-tabular text-2xl font-bold text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    {currentDiceRoll}
                  </div>
                </div>

                <div className="text-lg font-bold text-slate-500">+</div>

                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-amber-400">
                    Modificador
                  </div>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0d0b09] border border-amber-500/50 font-mono-tabular text-xl font-bold text-amber-300">
                    +{modInfo.totalMod}
                  </div>
                </div>

                <div className="text-lg font-bold text-slate-500">=</div>

                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-sky-400">
                    Total Final
                  </div>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-950/30 border-2 border-sky-400 font-mono-tabular text-2xl font-bold text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.25)]">
                    {diceInfo.modifiedTotal}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-mono-tabular">
                Bônus Ativos: <span className="text-amber-300">{modInfo.label}</span>
              </div>

              <div className={`p-2.5 rounded-xl border text-left space-y-1 ${diceInfo.colorClass}`}>
                <div className="font-bold text-xs">{diceInfo.title}</div>
                <p className="text-[11px] opacity-90">{diceInfo.description}</p>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleRollDiceClick()}
                  className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Dices className="w-4 h-4" />
                  Rolar Dado (Teste de Sorte)
                </button>
              </div>
            </div>

            {/* Reference Table */}
            <div className="p-3.5 rounded-xl bg-[#080605] border border-slate-800/90 space-y-2">
              <div className="font-semibold text-slate-200">
                Dado Narrativo — Referência de Tensão
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-400">
                <li>
                  <strong className="text-amber-400">Valor baixo:</strong> contratempo, resistência ou um detalhe que complica a cena.
                </li>
                <li>
                  <strong className="text-amber-400">Valor médio:</strong> execução com algum custo ou condição imprevista.
                </li>
                <li>
                  <strong className="text-sky-400">Valor alto:</strong> execução limpa e favorável, proporcional ao Grau do feiticeiro.
                </li>
                <li>
                  <strong className="text-slate-300">Sempre:</strong> o Mestre IA decide o desfecho pela lógica da cena e da ficha — o dado é só um guia, nunca um Black Flash automático.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* 4. Encyclopedic Codex.md & Story Cards Manager (Client-Side + Server-Side RAG) */}
        {subTab === 'codex' && (
          <div className="space-y-3">
            {/* Active Codex.md Integration Banner */}
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-950/60 via-[#080605] to-sky-950/50 border border-amber-500/40 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <BookMarked className="w-3.5 h-3.5 text-amber-400" />
                  <span>Codex.md Integrado no Sistema</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                  RAG Ativo
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                <strong>{codexMdCount > 0 ? codexMdCount : 272} verbetes enciclopédicos PT-BR</strong> (Codex.md) +{' '}
                <strong>{storyJsonCount > 0 ? storyJsonCount : 283} Story Cards</strong> carregados automaticamente no motor narrativo.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-200">
                Acervo Total ({filteredCodex.length} / {codexCards.length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAddCard(!showAddCard)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Novo Card
                </button>
                <label className="px-2.5 py-1 rounded bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/50 text-[11px] text-amber-200 flex items-center gap-1 cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>Importar .md/.json</span>
                  <input
                    type="file"
                    accept=".md,.json,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            {/* Category & Source Filter Pills */}
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'all', label: `Todos (${codexCards.length})` },
                  { id: 'codex_md', label: `Codex.md PT-BR (${codexMdCount})` },
                  { id: 'character', label: 'Personagens' },
                  { id: 'technique', label: 'Técnicas & Domínios' },
                  { id: 'story_json', label: `Story Cards (${storyJsonCount})` },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setCodexFilter(pill.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
                    codexFilter === pill.id
                      ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                      : 'bg-[#080605] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {importStatus && (
              <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-[11px] text-emerald-300">
                {importStatus}
              </div>
            )}

            {showAddCard && (
              <form
                onSubmit={handleCreateCustomCard}
                className="p-3 rounded-xl bg-[#080605] border border-amber-500/40 space-y-2"
              >
                <input
                  type="text"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="Título do Card (ex: Hajime Kashimo)"
                  className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white"
                />
                <input
                  type="text"
                  value={newCardKeys}
                  onChange={(e) => setNewCardKeys(e.target.value)}
                  placeholder="Gatilhos separados por vírgula (ex: kashimo, trovão)"
                  className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white"
                />
                <textarea
                  rows={3}
                  value={newCardValue}
                  onChange={(e) => setNewCardValue(e.target.value)}
                  placeholder="Descrição canônica para injeção RAG..."
                  className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 rounded bg-amber-600 text-white font-semibold cursor-pointer"
                >
                  Salvar no Códice
                </button>
              </form>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no Codex.md e Story Cards (ex: Gojo, Sukuna, Vazio, Kokusen)..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#080605] border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {filteredCodex.slice(0, 100).map((card) => {
                const isExpanded = expandedCardId === card.id;
                const isCodexMd = card.source === 'codex_md';
                return (
                  <div
                    key={card.id}
                    onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                    className={`p-3 rounded-xl bg-[#080605] border transition-all cursor-pointer space-y-1.5 ${
                      isExpanded
                        ? 'border-amber-500/70 bg-amber-950/15'
                        : isCodexMd
                        ? 'border-amber-500/30 hover:border-amber-500/60'
                        : 'border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-amber-300 leading-snug">
                        {card.title}
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          isCodexMd
                            ? 'bg-amber-950/90 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {isCodexMd ? 'Codex.md' : card.type}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Gatilhos: {card.keys.slice(0, 8).join(', ')}
                    </div>
                    <p
                      className={`text-[11px] text-slate-300 leading-relaxed whitespace-pre-line ${
                        isExpanded ? '' : 'line-clamp-4'
                      }`}
                    >
                      {card.value}
                    </p>
                    <div className="text-[10px] text-sky-400 font-medium pt-0.5">
                      {isExpanded ? '▲ Recolher verbete completo' : '▼ Ler verbete completo do Codex'}
                    </div>
                  </div>
                );
              })}
              {filteredCodex.length > 100 && (
                <div className="text-center text-[11px] text-slate-500 py-2">
                  Exibindo 100 de {filteredCodex.length} verbetes correspondentes. Use a busca acima para filtrar.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Long-Term Memory Journal */}
        {subTab === 'memory' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-200">
                Diário de Memória Consolidada
              </span>
              <button
                type="button"
                onClick={onSummarizeMemory}
                disabled={isSummarizingMemory}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 font-medium cursor-pointer"
              >
                {isSummarizingMemory ? 'Resumindo...' : 'Resumir Turnos na Memória'}
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Garante que o Mestre nunca esqueça aliados, ferimentos permanentes, inimigos exorcizados ou promessas feitas ao longo da campanha.
            </p>

            {memories.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#080605] border border-slate-800 text-slate-400 text-center">
                Nenhum resumo consolidado ainda. Jogue alguns turnos ou clique em &ldquo;Resumir Turnos na Memória&rdquo;.
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-[#080605] border border-emerald-500/30 space-y-1"
                  >
                    <div className="text-[10px] font-semibold text-emerald-400">
                      {m.turnRange}
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">{m.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
