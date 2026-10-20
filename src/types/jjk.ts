export type VisualEffectTrigger =
  | 'NONE'
  | 'BLACK_FLASH'
  | 'DOMAIN_EXPANSION'
  | 'DOMAIN_GOJO'
  | 'DOMAIN_SUKUNA'
  | 'DOMAIN_HIGURUMA'
  | 'DOMAIN_GENERIC'
  | 'RCT_HEAL'
  | 'TECHNIQUE_BURNOUT'
  | 'CRITICAL_DAMAGE';

export type TechniqueState =
  | 'Ativa'
  | 'Em Uso'
  | 'Sob Voto Vinculativo'
  | 'Em Exaustão Pós-Domínio (Burnout)';

export type NpcAttitude = 'Aliado' | 'Neutro' | 'Hostil';

export type ActionMode = 'DO' | 'SAY' | 'TECHNIQUE' | 'STORY';

export type FontSizeOption = 'small' | 'medium' | 'large';

export type GeminiModelOption =
  | 'gemini-3.8-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-argon';

export interface NpcInScene {
  name: string;
  grade: string;
  hpPercentage: number;
  status: string;
  attitude: NpcAttitude;
  visualDescription: string;
  revealedTechnique?: string;
  avatarUrl?: string;
}

export const UNDEVELOPED_MARKER = 'Não desenvolvido ainda';

export type NarrativeAffinityLevel =
  | 'maestria'
  | 'afinidade'
  | 'neutro'
  | 'inaptidao'
  | 'nao_desenvolvido';

export interface NarrativeSkillItem {
  id: string;
  name: string;
  category:
    | 'Combate & Corpo'
    | 'Jujutsu & Barreiras'
    | 'Mente & Percepção'
    | 'Social & Furtividade';
  level: NarrativeAffinityLevel;
  narrativeImpact: string;
  isCustom?: boolean;
}

export type NarrativePillarTier =
  | 'Apice'
  | 'Forte'
  | 'Padrao'
  | 'Fraco'
  | 'NaoDesenvolvido';

export interface NarrativePillarItem {
  id: string;
  name: string;
  abbr: string;
  tier: NarrativePillarTier;
  narrativeNote: string;
}

export interface SheetEvolutionPatch {
  sectionUpdated?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  appearance?: string;
  backstory?: string;
  combatStyle?: string;
  techniqueName?: string;
  techniqueDescription?: string;
  lapse?: string;
  reversal?: string;
  maximum?: string;
  domainExpansion?: string;
  antiDomain?: string;
  unlockRct?: boolean;
  skillUpdated?: {
    name: string;
    newLevel: NarrativeAffinityLevel;
    reason?: string;
  };
}

export interface EvolutionHistoryEntry {
  id: string;
  turnNumber: number;
  timestamp: string;
  title: string;
  details: string;
  gradeAtTime: string;
  levelAtTime: number;
}

export interface CharacterProgression {
  currentGrade: string;
  levelInCurrentGrade: number;
  levelsRequiredForNextGrade: number;
  nextGrade: string | null;
  totalCharacterLevel: number;
  currentXp: number;
  xpToNextLevel: number;
}

export interface SessionZeroChatEntry {
  id: string;
  sender: 'gm' | 'player';
  text: string;
  timestamp: string;
  balanceStatus?: 'NEEDS_BALANCING' | 'BALANCED_READY';
  designatedInitialGrade?: string;
  powerScaleWarning?: string;
  questionsForPlayer?: string[];
  proposedAdjustmentsSummary?: string[];
  proposedCharacterPatch?: Partial<{
    name: string;
    clan: string;
    grade: string;
    appearance: string;
    backstory: string;
    combatStyle: string;
    isHeavenlyRestriction: boolean;
    vowName: string;
    vowCondition: string;
    vowBonus: string;
    toolName: string;
    toolGrade: string;
    toolEffect: string;
    technique: Partial<CursedTechniqueDetails>;
  }>;
}

export interface PlayerStateUpdate {
  hpPercentage: number;
  cursedEnergyPercentage: number;
  outputPercentage: number;
  physicalCondition: string;
  techniqueState: TechniqueState;
  inBlackFlashZone: boolean;
  newInventoryItemOrVow?: string;
  xpGained?: number;
  levelUpReason?: string;
  sheetEvolution?: SheetEvolutionPatch;
}

export interface WorldStateUpdate {
  location: string;
  arc: string;
  activeBarrierOrDomain: string;
  npcsInScene: NpcInScene[];
}

export interface GmTurnResponse {
  engineLog: string;
  activeStoryCards: string[];
  activeCardRuleSummary?: string;
  visualEffectTrigger: VisualEffectTrigger;
  narrative: string;
  imagePrompt: string;
  isCombatScene?: boolean;
  combatSceneImageQuestion?: string;
  nanoBananaAnimePrompt?: string;
  playerStateUpdate: PlayerStateUpdate;
  worldStateUpdate: WorldStateUpdate;
  suggestedActions: string[];
}

export type DomainPortalStyle =
  | 'infinite_void'
  | 'malevolent_shrine'
  | 'chimera_shadow'
  | 'judgeman_court'
  | 'custom_nebula';

export type DomainBarrierType =
  | 'Barreira Fechada Padrão (Esfera Isolada)'
  | 'Barreira Aberta Divina (Alcance de 200m — Estilo Sukuna/Kenjaku)'
  | 'Domínio Incompleto (Moldado pelo Ambiente — Estilo Megumi)'
  | 'Domínio Não-Letal Baseado em Regras (Estilo Higuruma/Hakari)';

export interface DomainPortalConfig {
  domainName: string;
  visualStyle: DomainPortalStyle;
  barrierType: DomainBarrierType;
  handSeal: string;
  sureHitEffect: string;
  portalEnvironment: string;
  primaryColor: string;
  secondaryColor: string;
  coreColor: string;
  overlayIntensity: 'subtle' | 'medium' | 'intense';
}

export interface CursedTechniqueDetails {
  name: string;
  isCanon: boolean;
  description: string;
  lapse: string;
  reversal: string;
  maximum: string;
  domainExpansion: string;
  antiDomain: string;
  hasRct: boolean;
  rctStatus?: 'Desenvolvido' | 'Não desenvolvido ainda' | 'Bloqueado';
  activationConditions?: string;
  domainPortal?: DomainPortalConfig;
}

export interface CursedToolItem {
  id: string;
  name: string;
  grade: string;
  effect: string;
  equipped: boolean;
}

export interface BindingVowItem {
  id: string;
  name: string;
  condition: string;
  bonus: string;
  active: boolean;
}

export interface CharacterSheet {
  name: string;
  appearance: string;
  backstory?: string;
  combatStyle?: string;
  alignmentPhilosophy?: string;
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  avatarUrl: string;
  faction: string;
  clan: string;
  grade: string;
  isHeavenlyRestriction: boolean;
  hpPercentage: number;
  cursedEnergyPercentage: number;
  outputPercentage: number;
  physicalCondition: string;
  techniqueState: TechniqueState;
  inBlackFlashZone: boolean;
  technique: CursedTechniqueDetails;
  domainPortal?: DomainPortalConfig;
  inventory: CursedToolItem[];
  bindingVows: BindingVowItem[];
  narrativePillars?: NarrativePillarItem[];
  narrativeSkills?: NarrativeSkillItem[];
  progression?: CharacterProgression;
  exclusiveSheetMarkdown?: string;
  evolutionHistory?: EvolutionHistoryEntry[];
}

export interface StoryCard {
  id: string;
  title: string;
  keys: string[];
  type: 'character' | 'technique' | 'domain' | 'lore' | 'location' | 'faction' | 'tool';
  value: string;
  source?: 'codex_md' | 'story_json' | 'initial' | 'custom';
}

export interface TurnSnapshot {
  character: CharacterSheet;
  world: WorldStateUpdate;
}

export interface CampaignTurn {
  id: string;
  turnNumber: number;
  timestamp: string;
  playerAction?: {
    mode: ActionMode;
    text: string;
    diceRoll?: number;
    revealedHandVow?: boolean;
    selectedMove?: string;
  };
  gmResponse: GmTurnResponse;
  sceneImageUrl?: string;
  nanoBananaOfferDismissed?: boolean;
  nanoBananaGeneratedPromptLog?: string;
  snapshot: TurnSnapshot;
}

export interface MemoryEntry {
  id: string;
  turnRange: string;
  summary: string;
  timestamp: string;
}

export interface CampaignState {
  id: string;
  createdAt: string;
  updatedAt: string;
  character: CharacterSheet;
  world: WorldStateUpdate;
  turns: CampaignTurn[];
  memories: MemoryEntry[];
  customCodex: StoryCard[];
  npcAvatars: Record<string, string>;
}

