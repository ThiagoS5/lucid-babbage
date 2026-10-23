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
  /** Grau é apenas um descritor de prestígio na ficção, não um atributo de jogo. */
  grade: string;
  /** Estado narrativo livre: ferido, exausto, recuando, derrotado, morto etc. */
  status: string;
  attitude: NpcAttitude;
  visualDescription: string;
  revealedTechnique?: string;
  avatarUrl?: string;
}

export const UNDEVELOPED_MARKER = 'Não desenvolvido ainda';

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
  /** Mudança narrativa de prestígio/grau (ex.: reconhecido como Grau 1 após um feito). */
  grade?: string;
}

export interface EvolutionHistoryEntry {
  id: string;
  turnNumber: number;
  timestamp: string;
  title: string;
  details: string;
  gradeAtTime: string;
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
  /**
   * Condição física/emocional em linguagem narrativa ("Intacto", "Ferido no
   * ombro", "Exausto após sustentar o domínio"). Não há HP nem energia medidos.
   */
  physicalCondition?: string;
  newInventoryItemOrVow?: string;
  sheetEvolution?: SheetEvolutionPatch;
}

export interface WorldStateUpdate {
  location: string;
  arc: string;
  activeBarrierOrDomain: string;
  npcsInScene: NpcInScene[];
  /** Âncora de missão/objetivo imediato do arco (Plot Essentials) — mantém a IA no escopo. */
  missionObjective?: string;
  /** Momento cronológico do arco (ex: "31/10/2018, 19h15 — Incidente de Shibuya"). */
  timelineAnchor?: string;
  /**
   * Era da campanha: `sequel` = continuação pós-desfecho do mangá (padrão do
   * projeto); `canon` = linha do mangá de 2018.
   */
  era?: 'sequel' | 'canon';
  /** Fatos imutáveis do mundo no início da campanha (contrato de lore do Mestre). */
  worldFacts?: string[];
  /** Limites duros do Mestre: o que ele NÃO pode fazer nesta campanha. */
  forbiddenEvents?: string[];
  /** Cena de abertura original (guardada para retomada/regeneração da cena 1). */
  openingScene?: string;
  /** Título legível do arco inicial (exibido no HUD e reenviado ao Mestre). */
  startingArcTitle?: string;
  /** Premissa dramática da campanha: o que mudou no mundo e a pergunta central. */
  campaignPremise?: string;
  /** Papel do jogador no arco (posição, autonomia e expectativa). */
  playerRole?: string;
  /** Diretrizes de tom que o Mestre deve sustentar. */
  tone?: string[];
  /** Batidas obrigatórias do Turno #1. */
  mustEstablish?: string[];
}

export interface GmTurnResponse {
  /** Origem do turno: GM Gemini ou motor local de continuidade. */
  assistantMode?: 'gm' | 'continuity-engine';
  fallbackReason?: string;
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

export type HeavenlyRestrictionType = 'nenhuma' | 'fisica' | 'espiritual' | 'parcial';

export interface HeavenlyRestriction {
  type: HeavenlyRestrictionType;
  /** O preço/custo da restrição (ex: "0% de Energia Amaldiçoada", "corpo paralisado"). */
  price: string;
  /** O benefício em troca (ex: "corpo sobre-humano", "alcance quilométrico de EA"). */
  benefit: string;
}

export interface CharacterSheet {
  name: string;
  age?: string;
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
  /** Traço genético amaldiçoado da linhagem (clã próprio). */
  clanTrait?: string;
  /** Tradição, história e reputação do clã. */
  clanTradition?: string;
  /** Status do clã: Três Grandes Famílias, menor, exilado, sobrevivente, etc. */
  clanStatus?: string;
  grade: string;
  isHeavenlyRestriction: boolean;
  heavenlyRestriction?: HeavenlyRestriction;
  physicalCondition: string;
  technique: CursedTechniqueDetails;
  domainPortal?: DomainPortalConfig;
  inventory: CursedToolItem[];
  bindingVows: BindingVowItem[];
  exclusiveSheetMarkdown?: string;
  evolutionHistory?: EvolutionHistoryEntry[];
}

export type StoryEra = 'canon' | 'sequel' | 'both';

/** Categorias do Códice, na ordem em que aparecem no Códice da UI. */
export type CodexCategory = 'personagens' | 'habilidades' | 'locais' | 'outros';

export interface StoryCard {
  id: string;
  title: string;
  keys: string[];
  type: 'character' | 'technique' | 'domain' | 'lore' | 'location' | 'faction' | 'tool';
  /**
   * Categoria explícita do verbete (vinda do JSON do Códice). Quando ausente,
   * o consumidor deriva de `type` via `categoryForType` (src/utils/codexCategories.ts).
   */
  categoria?: CodexCategory;
  value: string;
  source?: 'codex_md' | 'story_json' | 'initial' | 'custom';
  /**
   * Era do card para o filtro de RAG. `canon` = evento/arco de 2018 que não
   * deve ser injetado em campanhas de seguimento; `sequel` = material novo;
   * `both` = personagem/técnica/local reutilizável (padrão).
   */
  era?: StoryEra;
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

