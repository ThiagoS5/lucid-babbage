import React, { useState } from 'react';
import {
  CharacterSheet,
  DomainBarrierType,
  DomainPortalConfig,
  DomainPortalStyle,
  NarrativeAffinityLevel,
  NarrativeSkillItem,
  UNDEVELOPED_MARKER,
  VisualEffectTrigger,
} from '../types/jjk';
import {
  applyXpAndSheetEvolution,
  buildExclusiveCharacterSheetMarkdown,
  cycleAffinityLevel,
  cyclePillarTier,
  enforceMandatoryLimitationsOnPillars,
  enforceMandatoryLimitationsOnSkills,
  ensureCharacterProgression,
  ensureNarrativePillars,
  ensureNarrativeSkills,
  getAffinityLevelMeta,
  getPillarTierMeta,
  inspectCharacterDevelopmentSections,
  isSectionUndeveloped,
  validateNarrativeLimitations,
} from '../utils/jjkEngine';
import {
  RefreshCw,
  Zap,
  Heart,
  ShieldAlert,
  Sword,
  Flame,
  ScrollText,
  Plus,
  CheckCircle2,
  Orbit,
  Sliders,
  UserCheck,
  Upload,
  TrendingUp,
  Lock,
  Sparkles,
  Download,
  Compass,
  User,
  Skull,
  HeartHandshake,
  Scale,
} from 'lucide-react';

interface LeftSorcererSheetProps {
  character: CharacterSheet;
  onUpdateCharacter: (updated: CharacterSheet) => void;
  onRegeneratePortrait: () => void;
  isRegeneratingPortrait: boolean;
  lastVfx: VisualEffectTrigger;
  activeBarrierOrDomain?: string;
  onToggleDomainInWorld?: (domainLabel: string) => void;
}

const DEFAULT_PORTAL_CONFIG: DomainPortalConfig = {
  domainName: 'Vazio Ilimitado',
  visualStyle: 'infinite_void',
  barrierType: 'Barreira Fechada Padrão (Esfera Isolada)',
  handSeal: 'Cruzamento de Dedos Taishakuten (Indra)',
  sureHitEffect: 'Injeção infinita de informações sensoriais que paralisa o alvo instantaneamente.',
  portalEnvironment: 'Horizonte cósmico infinito repleto de nebulosas, singularidades e estrelas.',
  primaryColor: '#38bdf8',
  secondaryColor: '#f59e0b',
  coreColor: '#080605',
  overlayIntensity: 'medium',
};

export const LeftSorcererSheet: React.FC<LeftSorcererSheetProps> = ({
  character,
  onUpdateCharacter,
  onRegeneratePortrait,
  isRegeneratingPortrait,
  lastVfx,
  activeBarrierOrDomain = '',
  onToggleDomainInWorld,
}) => {
  const [activeTab, setActiveTab] = useState<
    'techniques' | 'sheet' | 'skills' | 'portal' | 'arsenal' | 'vows'
  >('techniques');
  const [newToolName, setNewToolName] = useState('');
  const [newToolGrade, setNewToolGrade] = useState('Grau 1');
  const [newToolEffect, setNewToolEffect] = useState('');

  const [newVowName, setNewVowName] = useState('');
  const [newVowBonus, setNewVowBonus] = useState('');

  const [editingSectionKey, setEditingSectionKey] = useState<string | null>(null);
  const [editingSectionValue, setEditingSectionValue] = useState('');

  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<
    'Combate & Corpo' | 'Jujutsu & Barreiras' | 'Mente & Percepção' | 'Social & Furtividade'
  >('Combate & Corpo');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillAffinity, setNewSkillAffinity] = useState<NarrativeAffinityLevel>('afinidade');
  const [isAddingSkill, setIsAddingSkill] = useState(false);

  const pillars = ensureNarrativePillars(character);
  const skills = ensureNarrativeSkills(character);
  const limitationsCheck = validateNarrativeLimitations(pillars, skills);

  const progression = ensureCharacterProgression(character);
  const devSections = inspectCharacterDevelopmentSections(character);
  const undevelopedCount = devSections.filter((s) => s.isUndeveloped).length;

  const isBurnout = character.techniqueState === 'Em Exaustão Pós-Domínio (Burnout)';
  const isRctHeal = lastVfx === 'RCT_HEAL';
  const isDomainActiveInWorld = /expansão de domínio|ryoiki tenkai|ryōiki tenkai/i.test(
    activeBarrierOrDomain
  );

  const portalConfig: DomainPortalConfig = character.technique.domainPortal || {
    ...DEFAULT_PORTAL_CONFIG,
    domainName: character.technique.domainExpansion.split('—')[0].trim() || 'Vazio Ilimitado',
    sureHitEffect: character.technique.domainExpansion,
  };

  const handleTogglePillar = (pillarId: string) => {
    const rawNext = pillars.map((p) =>
      p.id === pillarId ? { ...p, tier: cyclePillarTier(p.tier) } : p
    );
    const nextPillars = enforceMandatoryLimitationsOnPillars(rawNext);
    const updated: CharacterSheet = {
      ...character,
      narrativePillars: nextPillars,
    };
    updated.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(updated);
    onUpdateCharacter(updated);
  };

  const handleCycleSkillAffinity = (skillId: string) => {
    const rawNext = skills.map((s) =>
      s.id === skillId ? { ...s, level: cycleAffinityLevel(s.level) } : s
    );
    const nextSkills = enforceMandatoryLimitationsOnSkills(rawNext);
    const updated: CharacterSheet = {
      ...character,
      narrativeSkills: nextSkills,
    };
    updated.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(updated);
    onUpdateCharacter(updated);
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    const newSkillItem: NarrativeSkillItem = {
      id: `skill-runtime-${Date.now()}`,
      name: newSkillName.trim(),
      category: newSkillCategory,
      level: newSkillAffinity,
      narrativeImpact: newSkillDesc.trim() || 'Perícia desenvolvida durante a campanha.',
      isCustom: true,
    };
    const nextSkills = enforceMandatoryLimitationsOnSkills([...skills, newSkillItem]);
    const updated: CharacterSheet = {
      ...character,
      narrativeSkills: nextSkills,
    };
    updated.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(updated);
    onUpdateCharacter(updated);
    setNewSkillName('');
    setNewSkillDesc('');
    setIsAddingSkill(false);
  };

  const handleQuickLevelUp = () => {
    const { updatedCharacter } = applyXpAndSheetEvolution(
      character,
      1,
      100,
      'Evolução de Nível em Treinamento / Marco Narrativo'
    );
    onUpdateCharacter(updatedCharacter);
  };

  const handleSaveSectionEvolution = (sectionKey: string, newValue: string) => {
    const cleanVal = newValue.trim() || UNDEVELOPED_MARKER;
    const { updatedCharacter } = applyXpAndSheetEvolution(
      character,
      1,
      0,
      undefined,
      {
        sectionUpdated: sectionKey,
        newValue: cleanVal,
        reason: `Ficha Exclusiva alterada em "${sectionKey}": ${cleanVal}`,
      }
    );
    onUpdateCharacter(updatedCharacter);
    setEditingSectionKey(null);
    setEditingSectionValue('');
  };

  const handleDownloadExclusiveSheet = () => {
    const md =
      character.exclusiveSheetMarkdown || buildExclusiveCharacterSheetMarkdown(character);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ficha_Exclusiva_${character.name.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdatePortalConfig = (patch: Partial<DomainPortalConfig>) => {
    const nextPortal: DomainPortalConfig = {
      ...portalConfig,
      ...patch,
    };
    const nextChar: CharacterSheet = {
      ...character,
      technique: {
        ...character.technique,
        domainPortal: nextPortal,
        domainExpansion: `${nextPortal.domainName} — ${nextPortal.sureHitEffect}`,
      },
    };
    nextChar.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(nextChar);
    onUpdateCharacter(nextChar);
  };

  const handlePresetStyleChange = (style: DomainPortalStyle) => {
    const presets: Record<
      DomainPortalStyle,
      { primaryColor: string; secondaryColor: string; coreColor: string }
    > = {
      infinite_void: { primaryColor: '#38bdf8', secondaryColor: '#f59e0b', coreColor: '#080605' },
      malevolent_shrine: { primaryColor: '#f43f5e', secondaryColor: '#991b1b', coreColor: '#090204' },
      chimera_shadow: { primaryColor: '#6366f1', secondaryColor: '#1e1b4b', coreColor: '#020207' },
      judgeman_court: { primaryColor: '#f59e0b', secondaryColor: '#b45309', coreColor: '#090602' },
      custom_nebula: {
        primaryColor: portalConfig.primaryColor,
        secondaryColor: portalConfig.secondaryColor,
        coreColor: portalConfig.coreColor,
      },
    };
    handleUpdatePortalConfig({
      visualStyle: style,
      ...presets[style],
    });
  };

  const hpBarColor =
    character.hpPercentage > 60
      ? 'bg-emerald-500'
      : character.hpPercentage > 30
      ? 'bg-amber-500'
      : 'bg-amber-600';

  const portraitBorderClass = character.inBlackFlashZone
    ? 'border-amber-500 kokusen-zone-glow'
    : character.hpPercentage <= 30
    ? 'border-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.5)]'
    : 'border-sky-500/60 shadow-[0_0_15px_rgba(56,189,248,0.2)]';

  const handleAddTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToolName.trim()) return;
    const nextChar: CharacterSheet = {
      ...character,
      inventory: [
        ...character.inventory,
        {
          id: `tool-${Date.now()}`,
          name: newToolName.trim(),
          grade: newToolGrade,
          effect: newToolEffect.trim() || 'Item amaldiçoado obtido em campanha.',
          equipped: true,
        },
      ],
    };
    nextChar.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(nextChar);
    onUpdateCharacter(nextChar);
    setNewToolName('');
    setNewToolEffect('');
  };

  const handleAddVow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVowName.trim()) return;
    const nextChar: CharacterSheet = {
      ...character,
      bindingVows: [
        ...character.bindingVows,
        {
          id: `vow-${Date.now()}`,
          name: newVowName.trim(),
          condition: 'Contrato jurado com Energia Amaldiçoada',
          bonus: newVowBonus.trim() || '+15% Output Condicional',
          active: true,
        },
      ],
    };
    nextChar.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(nextChar);
    onUpdateCharacter(nextChar);
    setNewVowName('');
    setNewVowBonus('');
  };

  const toggleVow = (id: string) => {
    const nextChar: CharacterSheet = {
      ...character,
      bindingVows: character.bindingVows.map((v) =>
        v.id === id ? { ...v, active: !v.active } : v
      ),
    };
    nextChar.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(nextChar);
    onUpdateCharacter(nextChar);
  };

  const handleUploadCharacterPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 360;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            onUpdateCharacter({
              ...character,
              avatarUrl: canvas.toDataURL('image/webp', 0.88),
            });
            return;
          }
        } catch {
          // Fallback to raw data URL
        }
        onUpdateCharacter({ ...character, avatarUrl: rawDataUrl });
      };
      img.onerror = () => onUpdateCharacter({ ...character, avatarUrl: rawDataUrl });
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside
      aria-label="Ficha do Feiticeiro"
      className="h-full flex flex-col bg-[#0d0b09]/95 border-r border-slate-800/80 overflow-y-auto select-none"
    >
      {/* 1. Character Header */}
      <div className="p-4 border-b border-slate-800/80 space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="relative group shrink-0">
            <div
              className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all bg-[#080605] ${portraitBorderClass}`}
            >
              <img
                src={character.avatarUrl}
                alt={character.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={onRegeneratePortrait}
                disabled={isRegeneratingPortrait}
                title="Regerar Retrato com Nano Banana"
                className="py-1 px-1 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-[9px] font-medium text-slate-200 flex items-center justify-center gap-0.5 cursor-pointer"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isRegeneratingPortrait ? 'animate-spin text-sky-400' : ''}`} />
                <span>IA</span>
              </button>
              <label
                title="Fazer upload da sua própria foto"
                className="py-1 px-1 rounded bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/50 text-[9px] font-medium text-emerald-300 flex items-center justify-center gap-0.5 cursor-pointer"
              >
                <Upload className="w-2.5 h-2.5" />
                <span>Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadCharacterPhoto}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-1.5">
              <h2 className="font-display text-base font-bold text-white break-words leading-snug">
                {character.name}
              </h2>
              <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-[10px] font-bold text-amber-300 shrink-0">
                Nv. {progression.totalCharacterLevel}
              </span>
            </div>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
              <span className="text-amber-400 font-semibold">{character.grade}</span>
              <span aria-hidden="true">·</span>
              <span className="break-words">{character.clan}</span>
            </div>
            <p className="text-[11px] text-slate-400 break-words leading-snug">{character.faction}</p>

            {character.inBlackFlashZone && (
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-amber-400 bg-black/90 border border-amber-500/70 px-2 py-0.5 rounded">
                  <Flame className="w-3 h-3 text-amber-500" />
                  ZONA DE KOKUSEN (120% POTENCIAL)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Grade & Level Progression Card (Semantic <progress class="jjk-progress">) */}
        <div className="p-2.5 rounded-xl bg-[#080605] border border-amber-500/35 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {character.grade} → {progression.nextGrade || 'Ápice'}
              </span>
            </span>
            <span className="font-mono-tabular font-bold text-white">
              {progression.levelInCurrentGrade}/{progression.levelsRequiredForNextGrade} níveis
            </span>
          </div>
          <progress
            className="jjk-progress jjk-progress-grade"
            value={progression.levelInCurrentGrade}
            max={progression.levelsRequiredForNextGrade}
            aria-label={`Progresso de níveis em ${character.grade}`}
          />

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span>
              XP do Nível: <strong className="text-sky-300">{progression.currentXp}/{progression.xpToNextLevel} XP</strong>
            </span>
            <button
              type="button"
              onClick={handleQuickLevelUp}
              title="Conceder +100 XP (+1 Nível na Categoria atual)"
              className="px-2 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50 text-amber-200 font-semibold transition-colors cursor-pointer"
            >
              +1 Nível (+100 XP)
            </button>
          </div>
          <progress
            className="jjk-progress"
            value={progression.currentXp}
            max={progression.xpToNextLevel}
            aria-label="Experiência para o próximo nível"
          />
        </div>

        {/* 2. Animated Resource Bars & Clinical Status */}
        <div className="space-y-3 pt-1">
          {/* HP Bar */}
          <div className={`space-y-1 rounded-lg p-2 bg-[#080605] border border-slate-800/90 ${isRctHeal ? 'vfx-rct-heal border-emerald-400' : ''}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-emerald-400" />
                Condição Física (HP)
              </span>
              <span className="font-mono-tabular font-bold text-white">
                {Math.round(character.hpPercentage)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${hpBarColor}`}
                style={{ width: `${Math.max(0, Math.min(100, character.hpPercentage))}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap items-start justify-between gap-1 pt-0.5">
              <span className="shrink-0">Status Clínico:</span>
              <span className="text-slate-200 font-medium break-words text-right">
                {character.physicalCondition}
              </span>
            </div>
          </div>

          {/* Cursed Energy Bar */}
          <div className="space-y-1 rounded-lg p-2 bg-[#080605] border border-slate-800/90">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                Energia Amaldiçoada (EA)
              </span>
              <span className="font-mono-tabular font-bold text-sky-400">
                {character.isHeavenlyRestriction
                  ? '0% Fixo (Restrição Celestial)'
                  : `${Math.round(character.cursedEnergyPercentage)}%`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-300"
                style={{
                  width: `${
                    character.isHeavenlyRestriction
                      ? 0
                      : Math.max(0, Math.min(100, character.cursedEnergyPercentage))
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>Output Máximo:</span>
              <span className={`font-mono-tabular font-semibold ${character.outputPercentage > 100 ? 'text-amber-400' : 'text-sky-300'}`}>
                {character.outputPercentage}% {character.inBlackFlashZone ? '[Zona Kokusen]' : ''}
              </span>
            </div>
          </div>

          {/* Technique State */}
          <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#080605] border border-slate-800/90 text-xs">
            <span className="text-slate-400">Estado da Técnica:</span>
            <span
              className={`font-semibold ${
                isBurnout
                  ? 'text-amber-400'
                  : character.techniqueState === 'Sob Voto Vinculativo'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {character.techniqueState}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Internal Sheet Tabs (Responsive Flex Bar with Touch Targets) */}
      <div className="grid grid-cols-3 gap-1 p-1.5 bg-[#080605] border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('techniques')}
          className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer touch-target-min ${
            activeTab === 'techniques'
              ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Técnicas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sheet')}
          className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 touch-target-min ${
            activeTab === 'sheet'
              ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40'
              : 'text-slate-400 hover:text-amber-200'
          }`}
          title="Ficha Exclusiva do Personagem (Consultada e Alterada pela História)"
        >
          <span>📜 Ficha</span>
          {undevelopedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-[9px] text-amber-200">
              {undevelopedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('skills')}
          className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 touch-target-min ${
            activeTab === 'skills'
              ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40'
              : 'text-slate-400 hover:text-amber-200'
          }`}
          title="Perícias & Afinidades Narrativas (100% Narrativo, Sem Math)"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Perícias</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('portal')}
          className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 touch-target-min ${
            activeTab === 'portal'
              ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40 font-semibold'
              : 'text-slate-400 hover:text-amber-200'
          }`}
        >
          <Orbit className="w-3.5 h-3.5" />
          <span>Domínio</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('arsenal')}
          className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer touch-target-min ${
            activeTab === 'arsenal'
              ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Arsenal ({character.inventory.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('vows')}
          className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer touch-target-min ${
            activeTab === 'vows'
              ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Votos ({character.bindingVows.length})
        </button>
      </div>


      {/* Tab Content */}
      <div className="p-4 flex-1 space-y-4 text-xs">
        {activeTab === 'techniques' && (
          <div className="space-y-3">
            {/* Innate Technique Card (shows cracked glass overlay when in Burnout) */}
            <div
              className={`relative p-3.5 rounded-xl border space-y-2.5 transition-all ${
                isBurnout
                  ? 'bg-slate-900/70 border-amber-500/60 burnout-cracked-overlay grayscale-[40%]'
                  : 'bg-[#080605] border-slate-800/90'
              }`}
            >
              {isBurnout && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-950/70 border border-amber-500/50 px-2.5 py-1 rounded">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>EXAUSTÃO PÓS-DOMÍNIO (BURNOUT): Técnica Instável</span>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">
                  Técnica Inata
                </div>
                <h3 className="font-display text-sm font-bold text-white mt-0.5">
                  {character.technique.name}
                </h3>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  {character.technique.description}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-sky-400 font-semibold">Lapso (Azul): </span>
                  <span
                    className={
                      isSectionUndeveloped(character.technique.lapse)
                        ? 'text-amber-300 italic'
                        : 'text-slate-300'
                    }
                  >
                    {character.technique.lapse}
                  </span>
                </div>
                <div>
                  <span className="text-amber-400 font-semibold">Reversão (Vermelho): </span>
                  <span
                    className={
                      isSectionUndeveloped(character.technique.reversal)
                        ? 'text-amber-300 italic'
                        : 'text-slate-300'
                    }
                  >
                    {character.technique.reversal}
                  </span>
                </div>
                <div>
                  <span className="text-amber-400 font-semibold">Técnica Máxima: </span>
                  <span
                    className={
                      isSectionUndeveloped(character.technique.maximum)
                        ? 'text-amber-300 italic'
                        : 'text-slate-300'
                    }
                  >
                    {character.technique.maximum}
                  </span>
                </div>
                {character.technique.activationConditions && (
                  <div>
                    <span className="text-amber-400 font-semibold">Condições de Ativação: </span>
                    <span className="text-slate-300">{character.technique.activationConditions}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Domain Expansion Summary & Quick Portal Shortcut */}
            <div className="p-3.5 rounded-xl bg-[#080605] border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1">
                  <Orbit className="w-3.5 h-3.5" />
                  <span>Expansão de Domínio (Ryōiki Tenkai)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('portal')}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Configurar Portal</span>
                </button>
              </div>
              <p
                className={`font-medium leading-relaxed ${
                  isSectionUndeveloped(character.technique.domainExpansion)
                    ? 'text-amber-300 italic'
                    : 'text-slate-200'
                }`}
              >
                {character.technique.domainExpansion}
              </p>

              {onToggleDomainInWorld &&
                !isSectionUndeveloped(character.technique.domainExpansion) && (
                  <button
                    type="button"
                    onClick={() =>
                      onToggleDomainInWorld(
                        isDomainActiveInWorld
                          ? 'Cortina Ativa'
                          : `Expansão de Domínio: ${portalConfig.domainName}`
                      )
                    }
                    className={`w-full py-1.5 px-2.5 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      isDomainActiveInWorld
                        ? 'bg-amber-950/70 border-amber-500 text-amber-200'
                        : 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-500/50 text-amber-200'
                    }`}
                  >
                    <Orbit
                      className={`w-3.5 h-3.5 ${
                        isDomainActiveInWorld ? 'animate-spin text-amber-400' : 'text-amber-400'
                      }`}
                    />
                    <span>
                      {isDomainActiveInWorld
                        ? 'Encerrar Portal de Domínio na Cena'
                        : `Ativar Portal: ${portalConfig.domainName}`}
                    </span>
                  </button>
                )}

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Defesa Anti-Domínio:</span>
                <span
                  className={`font-medium ${
                    isSectionUndeveloped(character.technique.antiDomain)
                      ? 'text-amber-300 italic'
                      : 'text-slate-200'
                  }`}
                >
                  {character.technique.antiDomain}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Técnica Reversa (RCT):</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextRct = !character.technique.hasRct;
                    const { updatedCharacter } = applyXpAndSheetEvolution(
                      character,
                      1,
                      0,
                      undefined,
                      {
                        unlockRct: nextRct,
                        sectionUpdated: 'rct',
                        newValue: nextRct
                          ? 'Desenvolvido (Energia Positiva Ativa)'
                          : UNDEVELOPED_MARKER,
                        reason: nextRct
                          ? 'Técnica Amaldiçoada Reversa (RCT) despertada na Ficha Exclusiva!'
                          : 'RCT marcada como Não desenvolvido ainda.',
                      }
                    );
                    onUpdateCharacter(updatedCharacter);
                  }}
                  className={`font-semibold cursor-pointer ${
                    character.technique.hasRct ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {character.technique.hasRct
                    ? 'Desenvolvida (Cura Ativa)'
                    : 'Não desenvolvido ainda (Despertar)'}
                </button>
              </div>
            </div>

            {/* Original Character Backstory & Combat Style Card */}
            {(character.backstory || character.combatStyle) && (
              <div className="p-3.5 rounded-xl bg-[#080605] border border-slate-800/90 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Identidade Original & Estilo Marcial</span>
                </div>
                {character.combatStyle && (
                  <div>
                    <span className="text-slate-400 font-semibold">Estilo de Combate: </span>
                    <span className="text-slate-200">{character.combatStyle}</span>
                  </div>
                )}
                {character.backstory && (
                  <div>
                    <span className="text-slate-400 font-semibold">História & Filosofia: </span>
                    <p className="text-slate-300 mt-0.5 leading-relaxed whitespace-pre-line">
                      {character.backstory}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Exclusive Living Character Sheet Tab ("📜 Ficha Viva") */}
        {activeTab === 'sheet' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#080605] border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-amber-300 flex items-center gap-1.5">
                    <ScrollText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ficha Exclusiva Viva (Consultada pela IA)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    A IA consulta esta ficha a cada turno e altera automaticamente seções marcadas como <em>"Não desenvolvido ainda"</em> quando você evolui na história.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExclusiveSheet}
                  title="Baixar Ficha Exclusiva em Markdown (.md)"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-semibold text-sky-300 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>.MD</span>
                </button>
              </div>

              {/* Section-by-Section Development Status */}
              <div className="space-y-2 pt-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-300 flex items-center justify-between">
                  <span>Seções da Ficha ({devSections.length - undevelopedCount}/{devSections.length} Desenvolvidas)</span>
                  {undevelopedCount > 0 && (
                    <span className="text-amber-300">{undevelopedCount} Latentes</span>
                  )}
                </div>

                {devSections.map((sec) => {
                  const isEditing = editingSectionKey === sec.key;
                  return (
                    <div
                      key={sec.key}
                      className={`p-2.5 rounded-lg border space-y-1.5 transition-all ${
                        sec.isUndeveloped
                          ? 'bg-amber-950/15 border-amber-500/40'
                          : 'bg-[#0d0b09] border-slate-800/90'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[11px] text-white flex items-center gap-1">
                          {sec.isUndeveloped ? (
                            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          )}
                          <span>{sec.label}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingSectionKey(null);
                              } else {
                                setEditingSectionKey(sec.key);
                                setEditingSectionValue(
                                  sec.isUndeveloped ? '' : sec.currentValue
                                );
                              }
                            }}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] font-semibold text-sky-300 cursor-pointer"
                          >
                            {isEditing
                              ? 'Cancelar'
                              : sec.isUndeveloped
                              ? '✨ Despertar'
                              : 'Editar'}
                          </button>
                          {!sec.isUndeveloped && (
                            <button
                              type="button"
                              onClick={() =>
                                handleSaveSectionEvolution(sec.key, UNDEVELOPED_MARKER)
                              }
                              title="Marcar novamente como Não desenvolvido ainda"
                              className="px-1.5 py-0.5 rounded bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/40 text-[9px] text-amber-300 cursor-pointer"
                            >
                              🔒
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-1.5 pt-1">
                          <textarea
                            rows={2}
                            value={editingSectionValue}
                            onChange={(e) => setEditingSectionValue(e.target.value)}
                            placeholder={`Descreva o despertar ou evolução de "${sec.label}"...`}
                            className="w-full px-2 py-1.5 rounded bg-[#080605] border border-sky-500/60 text-white text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleSaveSectionEvolution(sec.key, editingSectionValue)
                            }
                            className="w-full py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] cursor-pointer"
                          >
                            Salvar na Ficha Exclusiva & Códice
                          </button>
                        </div>
                      ) : (
                        <p
                          className={`text-[11px] leading-relaxed ${
                            sec.isUndeveloped ? 'text-amber-300/90 italic' : 'text-slate-300'
                          }`}
                        >
                          {sec.currentValue}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Evolution History Log */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Histórico de Modificações na História ({character.evolutionHistory?.length || 0})</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {(character.evolutionHistory || []).length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic">
                      Nenhuma modificação registrada ainda. Jogue turnos para evoluir!
                    </p>
                  ) : (
                    [...(character.evolutionHistory || [])].reverse().map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2 rounded bg-[#0d0b09] border border-slate-800/80 text-[10px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-amber-300 font-semibold">
                          <span>{ev.gradeAtTime}</span>
                          <span>Nível {ev.levelAtTime}</span>
                        </div>
                        <div className="font-semibold text-white">{ev.title}</div>
                        <p className="text-slate-300">{ev.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Narrative Skills & D&D 5e Ability Pillars Tab */}
        {activeTab === 'skills' && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider font-display">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Perícias & Limitações Narrativas</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingSkill(true)}
                  className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nova</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-300 leading-tight">
                <strong className="text-amber-300">100% Narrativo · Sem matemática.</strong> Afinidades ajudam no narrar da história e o sistema garante obrigatoriamente pelo menos{' '}
                <span className="text-amber-300 font-semibold">1 Pilar em Fragilidade (▼)</span> ({limitationsCheck.fragilePillarCount} ativo) e{' '}
                <span className="text-amber-300 font-semibold">1 Perícia em Inaptidão (▼)</span> ({limitationsCheck.fragileSkillCount} ativa).
              </p>
            </div>

            {/* Os 6 Pilares de Aptidão */}
            <div className="p-3 rounded-xl bg-[#080605] border border-slate-800 space-y-2.5">
              <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400 font-display flex flex-wrap items-center justify-between gap-1">
                <span>Os 6 Pilares de Aptidão (Mín. 1 Fragilidade)</span>
                <span className="text-[9px] text-slate-400 font-sans font-normal">Toque para alternar</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {pillars.map((pillar) => {
                  const meta = getPillarTierMeta(pillar.tier);
                  return (
                    <button
                      key={pillar.id}
                      type="button"
                      onClick={() => handleTogglePillar(pillar.id)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer w-full min-w-0 ${
                        pillar.tier === 'Fraco'
                          ? 'bg-amber-950/25 border-amber-500/70'
                          : 'bg-[#0d0b09] hover:bg-[#16110d] border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between text-[11px] font-bold gap-1.5">
                        <span className="text-slate-100 break-words leading-snug">{pillar.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] border shrink-0 whitespace-nowrap ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-relaxed break-words mt-1">
                        {pillar.narrativeNote}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Custom Skill Form */}
            {isAddingSkill && (
              <form onSubmit={handleAddCustomSkill} className="p-3 rounded-xl bg-[#080605] border border-amber-500/50 space-y-2 text-xs">
                <div className="font-bold text-amber-300">Nova Perícia Narrativa</div>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="Nome da Perícia..."
                  className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-700 text-white text-xs"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={newSkillCategory}
                    onChange={(e) =>
                      setNewSkillCategory(e.target.value as typeof newSkillCategory)
                    }
                    className="px-2 py-1.5 rounded bg-[#0d0b09] border border-slate-700 text-slate-200 text-xs"
                  >
                    <option value="Combate & Corpo">Combate & Corpo</option>
                    <option value="Jujutsu & Barreiras">Jujutsu & Barreiras</option>
                    <option value="Mente & Percepção">Mente & Percepção</option>
                    <option value="Social & Furtividade">Social & Furtividade</option>
                  </select>
                  <select
                    value={newSkillAffinity}
                    onChange={(e) =>
                      setNewSkillAffinity(e.target.value as NarrativeAffinityLevel)
                    }
                    className="px-2 py-1.5 rounded bg-[#0d0b09] border border-slate-700 text-slate-200 text-xs font-bold"
                  >
                    <option value="maestria">★ Maestria (Ajuda Muito)</option>
                    <option value="afinidade">● Afinidade (Ajuda)</option>
                    <option value="neutro">○ Neutro</option>
                    <option value="inaptidao">▼ Inaptidão (Prejudica)</option>
                    <option value="nao_desenvolvido">🔒 Não desenvolvido ainda</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  placeholder="Descrição da ação narrativa..."
                  className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-700 text-slate-300 text-xs leading-relaxed"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingSkill(false)}
                    className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            )}

            {/* Narrative Skills List */}
            <div className="p-3 rounded-xl bg-[#080605] border border-slate-800 space-y-2.5">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex flex-wrap items-center justify-between gap-1">
                <span>Perícias Cadastradas ({skills.length})</span>
                <span className="text-[9px] text-slate-400">Clique para alternar afinidade</span>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {skills.map((skill) => {
                  const meta = getAffinityLevelMeta(skill.level);
                  return (
                    <div
                      key={skill.id}
                      onClick={() => handleCycleSkillAffinity(skill.id)}
                      className="p-2.5 rounded-lg bg-[#0d0b09] hover:bg-[#16110d] border border-slate-800/80 space-y-1.5 cursor-pointer transition-colors min-w-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-100 leading-snug break-words min-w-0 flex-1">
                          {skill.name}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap shrink-0 ${meta.badgeClass}`}
                        >
                          {meta.symbol} {meta.shortLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-relaxed break-words">
                        {skill.narrativeImpact}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Roleplay Quad summary */}
            {(character.personalityTraits || character.ideals || character.bonds || character.flaws) && (
              <div className="p-3 rounded-xl bg-[#080605] border border-slate-800 space-y-2 text-[11px]">
                <div className="text-[10px] uppercase tracking-wider font-bold text-amber-300">
                  Interpretação & Filosofia
                </div>
                {character.alignmentPhilosophy && (
                  <div>
                    <span className="text-sky-400 font-semibold">Tendência: </span>
                    <span className="text-slate-200">{character.alignmentPhilosophy}</span>
                  </div>
                )}
                {character.personalityTraits && (
                  <div>
                    <span className="text-slate-400 font-semibold">Traços: </span>
                    <span className="text-slate-200">{character.personalityTraits}</span>
                  </div>
                )}
                {character.ideals && (
                  <div>
                    <span className="text-amber-400 font-semibold">Ideais: </span>
                    <span className="text-slate-200">{character.ideals}</span>
                  </div>
                )}
                {character.bonds && (
                  <div>
                    <span className="text-emerald-400 font-semibold">Vínculos: </span>
                    <span className="text-slate-200">{character.bonds}</span>
                  </div>
                )}
                {character.flaws && (
                  <div>
                    <span className="text-amber-400 font-semibold">Defeitos: </span>
                    <span className="text-slate-200">{character.flaws}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dedicated Domain Portal Configurator Tab */}
        {activeTab === 'portal' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#080605] border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 flex items-center gap-1.5">
                  <Orbit className="w-3.5 h-3.5" />
                  Configuração de Portal de Domínio
                </span>
                <span className="text-[10px] font-mono text-sky-400">
                  domainExpansionPortal
                </span>
              </div>

              {/* Live Mini Radial Preview */}
              <div className="relative h-28 rounded-xl overflow-hidden border border-amber-500/40 bg-[#050508] flex items-center justify-center">
                <div
                  className="domain-expansion-portal-overlay"
                  style={
                    {
                      '--portal-primary': portalConfig.primaryColor,
                      '--portal-secondary': portalConfig.secondaryColor,
                      '--portal-core': portalConfig.coreColor,
                      '--portal-opacity':
                        portalConfig.overlayIntensity === 'intense'
                          ? '0.94'
                          : portalConfig.overlayIntensity === 'subtle'
                          ? '0.68'
                          : '0.84',
                    } as React.CSSProperties
                  }
                />
                <div className="relative z-10 text-center px-3">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-sky-300 font-bold">
                    Ryōiki Tenkai · {portalConfig.barrierType.split(' ')[0]}
                  </div>
                  <div className="font-display font-bold text-sm text-white drop-shadow">
                    {portalConfig.domainName}
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5 break-words">
                    Selo: {portalConfig.handSeal}
                  </div>
                </div>
              </div>

              {onToggleDomainInWorld && (
                <button
                  type="button"
                  onClick={() =>
                    onToggleDomainInWorld(
                      isDomainActiveInWorld
                        ? 'Cortina Ativa'
                        : `Expansão de Domínio: ${portalConfig.domainName}`
                    )
                  }
                  className={`w-full py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                    isDomainActiveInWorld
                      ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                      : 'bg-gradient-to-r from-amber-600 to-sky-600 border-amber-400/50 text-white'
                  }`}
                >
                  <Orbit className={`w-3.5 h-3.5 ${isDomainActiveInWorld ? 'animate-spin' : ''}`} />
                  <span>
                    {isDomainActiveInWorld
                      ? 'Desativar Expansão de Domínio no Palco'
                      : 'Expandir Portal de Domínio no Palco Central'}
                  </span>
                </button>
              )}

              <div className="space-y-2 pt-1">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Nome da Expansão de Domínio
                  </label>
                  <input
                    type="text"
                    value={portalConfig.domainName}
                    onChange={(e) => handleUpdatePortalConfig({ domainName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Selo de Mão (Mudra)
                  </label>
                  <input
                    type="text"
                    value={portalConfig.handSeal}
                    onChange={(e) => handleUpdatePortalConfig({ handSeal: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Arquitetura da Barreira
                  </label>
                  <select
                    value={portalConfig.barrierType}
                    onChange={(e) =>
                      handleUpdatePortalConfig({ barrierType: e.target.value as DomainBarrierType })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-slate-200 text-xs"
                  >
                    <option value="Barreira Fechada Padrão (Esfera Isolada)">
                      Barreira Fechada Padrão (Esfera Isolada)
                    </option>
                    <option value="Barreira Aberta Divina (Alcance de 200m — Estilo Sukuna/Kenjaku)">
                      Barreira Aberta Divina (200m — Sukuna/Kenjaku)
                    </option>
                    <option value="Domínio Incompleto (Moldado pelo Ambiente — Estilo Megumi)">
                      Domínio Incompleto (Moldado pelo Ambiente)
                    </option>
                    <option value="Domínio Não-Letal Baseado em Regras (Estilo Higuruma/Hakari)">
                      Domínio Não-Letal Baseado em Regras
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Estilo Visual do Portal Radial
                  </label>
                  <select
                    value={portalConfig.visualStyle}
                    onChange={(e) =>
                      handlePresetStyleChange(e.target.value as DomainPortalStyle)
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-slate-200 text-xs"
                  >
                    <option value="infinite_void">Vazio Ilimitado (Singularidade Cósmica)</option>
                    <option value="malevolent_shrine">Santuário Malevolente (Abismo Carmesim)</option>
                    <option value="chimera_shadow">Jardim das Sombras (Quimera Líquida)</option>
                    <option value="judgeman_court">Tribunal Dourado (Solene / Julgamento)</option>
                    <option value="custom_nebula">Nebulosa Personalizada (Cores Livres)</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Anel Primário</label>
                    <input
                      type="color"
                      value={portalConfig.primaryColor}
                      onChange={(e) =>
                        handleUpdatePortalConfig({
                          visualStyle: 'custom_nebula',
                          primaryColor: e.target.value,
                        })
                      }
                      className="w-full h-7 rounded bg-[#0d0b09] border border-slate-700 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Nebulosa</label>
                    <input
                      type="color"
                      value={portalConfig.secondaryColor}
                      onChange={(e) =>
                        handleUpdatePortalConfig({
                          visualStyle: 'custom_nebula',
                          secondaryColor: e.target.value,
                        })
                      }
                      className="w-full h-7 rounded bg-[#0d0b09] border border-slate-700 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Núcleo</label>
                    <input
                      type="color"
                      value={portalConfig.coreColor}
                      onChange={(e) =>
                        handleUpdatePortalConfig({
                          visualStyle: 'custom_nebula',
                          coreColor: e.target.value,
                        })
                      }
                      className="w-full h-7 rounded bg-[#0d0b09] border border-slate-700 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Intensidade da Sobreposição Radial
                  </label>
                  <select
                    value={portalConfig.overlayIntensity}
                    onChange={(e) =>
                      handleUpdatePortalConfig({
                        overlayIntensity: e.target.value as 'subtle' | 'medium' | 'intense',
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-slate-200 text-xs"
                  >
                    <option value="subtle">Sutil (68% Opacidade)</option>
                    <option value="medium">Equilibrada (84% Opacidade)</option>
                    <option value="intense">Imersão Máxima (94% Opacidade)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Regra de Acerto Garantido (Sure-Hit)
                  </label>
                  <textarea
                    rows={2}
                    value={portalConfig.sureHitEffect}
                    onChange={(e) => handleUpdatePortalConfig({ sureHitEffect: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white text-xs resize-y"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Paisagem do Mundo Interno (Inner World)
                  </label>
                  <textarea
                    rows={2}
                    value={portalConfig.portalEnvironment}
                    onChange={(e) =>
                      handleUpdatePortalConfig({ portalEnvironment: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white text-xs resize-y"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'arsenal' && (
          <div className="space-y-3">
            <div className="space-y-2">
              {character.inventory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#080605] border border-slate-800/90 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Sword className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      {item.name}
                    </span>
                    <span className="text-[11px] text-amber-400 shrink-0">{item.grade}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{item.effect}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddTool} className="p-3 rounded-xl bg-[#080605] border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300">
                Adicionar Ferramenta / Objeto Amaldiçoado
              </div>
              <input
                type="text"
                value={newToolName}
                onChange={(e) => setNewToolName(e.target.value)}
                placeholder="Nome (ex: Dedo de Sukuna, Inverted Spear...)"
                className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white text-xs"
              />
              <div className="flex gap-2">
                <select
                  value={newToolGrade}
                  onChange={(e) => setNewToolGrade(e.target.value)}
                  className="px-2 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-slate-200 text-xs"
                >
                  <option>Grau Especial</option>
                  <option>Grau 1</option>
                  <option>Grau 2</option>
                  <option>Grau 3</option>
                  <option>Objeto Amaldiçoado</option>
                </select>
                <input
                  type="text"
                  value={newToolEffect}
                  onChange={(e) => setNewToolEffect(e.target.value)}
                  placeholder="Efeito mecânico..."
                  className="flex-1 px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-medium flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Equipar no Arsenal
              </button>
            </form>
          </div>
        )}

        {activeTab === 'vows' && (
          <div className="space-y-3">
            <div className="space-y-2">
              {character.bindingVows.map((vow) => (
                <div
                  key={vow.id}
                  onClick={() => toggleVow(vow.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                    vow.active
                      ? 'bg-amber-950/25 border-amber-500/60'
                      : 'bg-[#080605] border-slate-800/90 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <ScrollText className="w-3.5 h-3.5 shrink-0" />
                      {vow.name}
                    </span>
                    <span className="text-[10px] text-slate-300 flex items-center gap-1">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${vow.active ? 'text-amber-400' : 'text-slate-600'}`} />
                      {vow.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{vow.condition}</p>
                  <p className="text-[11px] text-emerald-400 font-medium">{vow.bonus}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddVow} className="p-3 rounded-xl bg-[#080605] border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-semibold text-amber-300">
                Pactuar Novo Voto Vinculativo
              </div>
              <input
                type="text"
                value={newVowName}
                onChange={(e) => setNewVowName(e.target.value)}
                placeholder="Nome do Voto (ex: Hora Extra / Overtime)"
                className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white text-xs"
              />
              <input
                type="text"
                value={newVowBonus}
                onChange={(e) => setNewVowBonus(e.target.value)}
                placeholder="Restrição e Bônus (ex: 80% antes das 18h -> 120% à noite)"
                className="w-full px-2.5 py-1.5 rounded bg-[#0d0b09] border border-slate-800 text-white text-xs"
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-medium flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Selar Voto Vinculativo
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
};

