import {
  UNDEVELOPED_MARKER,
  type StoryCard,
  type NpcInScene,
  type CampaignState,
  type CharacterSheet,
  type CharacterProgression,
  type EvolutionHistoryEntry,
  type SheetEvolutionPatch,
  type NarrativeAffinityLevel,
  type NarrativePillarItem,
  type NarrativePillarTier,
  type NarrativeSkillItem,
} from '../types/jjk';

export interface ParsedNarrativeBlock {
  id: string;
  type: 'narrator' | 'character';
  speaker: string;
  rawText: string;
  actionText?: string;
  spokenQuotes?: string[];
  npcMatch?: NpcInScene;
}

/**
 * Parses the theatrical narrative returned by the GM into structured blocks:
 * 1) `*Narrador*: [Texto descritivo rico, sensorial e visceral]`
 * 2) `*Nome do Personagem*: Ação física em itálico "Fala entre aspas"`
 */
export function parseNarrativeBlocks(narrative: string, npcsInScene: NpcInScene[] = []): ParsedNarrativeBlock[] {
  if (!narrative || !narrative.trim()) return [];

  const paragraphs = narrative
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: ParsedNarrativeBlock[] = [];

  paragraphs.forEach((para, idx) => {
    const lines = para.split(/\n(?=\*[^*\n]+\*\s*:)/).map((l) => l.trim()).filter(Boolean);

    lines.forEach((line, subIdx) => {
      const match = line.match(/^\*([^*]+)\*\s*:\s*([\s\S]+)$/);
      if (match) {
        const speakerRaw = match[1].trim();
        const body = match[2].trim();
        const isNarrator = /^narrador$/i.test(speakerRaw);

        if (isNarrator) {
          blocks.push({
            id: `block-${idx}-${subIdx}`,
            type: 'narrator',
            speaker: 'Narrador',
            rawText: body,
          });
        } else {
          const quotes: string[] = [];
          const quoteRegex = /["“]([^"”]+)["”]/g;
          let qMatch: RegExpExecArray | null;
          while ((qMatch = quoteRegex.exec(body)) !== null) {
            quotes.push(qMatch[1].trim());
          }
          const actionOnly = body.replace(/["“][^"”]+["”]/g, '').replace(/\s{2,}/g, ' ').trim();

          const npcMatch = npcsInScene.find(
            (n) =>
              n.name.toLowerCase() === speakerRaw.toLowerCase() ||
              n.name.toLowerCase().includes(speakerRaw.toLowerCase()) ||
              speakerRaw.toLowerCase().includes(n.name.toLowerCase())
          );

          blocks.push({
            id: `block-${idx}-${subIdx}`,
            type: 'character',
            speaker: speakerRaw,
            rawText: body,
            actionText: actionOnly || undefined,
            spokenQuotes: quotes.length > 0 ? quotes : undefined,
            npcMatch,
          });
        }
      } else {
        blocks.push({
          id: `block-${idx}-${subIdx}`,
          type: 'narrator',
          speaker: 'Narrador',
          rawText: line,
        });
      }
    });
  });

  return blocks;
}

/**
 * 1d20 Jujutsu System Dice Roller, Grade Modifier & Outcome Classifier
 */
export function rollD20(rng: () => number = Math.random): number {
  return Math.floor(rng() * 20) + 1;
}

export function calculateGradeModifier(character?: CharacterSheet): {
  totalMod: number;
  gradeMod: number;
  zoneMod: number;
  vowMod: number;
  label: string;
} {
  if (!character) {
    return { totalMod: 1, gradeMod: 1, zoneMod: 0, vowMod: 0, label: '+1 (Grau 3)' };
  }
  const g = (character.grade || 'Grau 3').toLowerCase();
  let gradeMod = 1;
  if (g.includes('especial')) gradeMod = 6;
  else if (g.includes('semi-grau 1') || g.includes('semi grau 1')) gradeMod = 3;
  else if (g.includes('grau 1')) gradeMod = 4;
  else if (g.includes('grau 2')) gradeMod = 2;
  else if (g.includes('grau 3')) gradeMod = 1;
  else if (g.includes('grau 4')) gradeMod = 0;

  const zoneMod = character.inBlackFlashZone ? 2 : 0;
  const activeVowsCount = character.bindingVows.filter((v) => v.active).length;
  const vowMod = activeVowsCount > 0 ? 2 : 0;
  const totalMod = gradeMod + zoneMod + vowMod;

  const parts = [`+${gradeMod} (${character.grade})`];
  if (zoneMod > 0) parts.push(`+${zoneMod} (Zona Kokusen)`);
  if (vowMod > 0) parts.push(`+${vowMod} (Voto Ativo)`);

  return {
    totalMod,
    gradeMod,
    zoneMod,
    vowMod,
    label: parts.join(' '),
  };
}

export interface DiceOutcomeInfo {
  roll: number;
  modifiedTotal: number;
  tier: 'CRITICAL_FAIL' | 'PARTIAL' | 'SOLID' | 'CRITICAL_HIT' | 'BLACK_FLASH';
  title: string;
  description: string;
  colorClass: string;
}

export function getDiceOutcomeInfo(roll: number, modifier = 0): DiceOutcomeInfo {
  const modifiedTotal = roll + modifier;
  if (roll <= 1) {
    return {
      roll: 1,
      modifiedTotal,
      tier: 'CRITICAL_FAIL',
      title: '1 Natural — Falha Crítica',
      description: 'Abertura grave na guarda ou falha severa no fluxo de Energia Amaldiçoada.',
      colorClass: 'text-rose-500 border-rose-500/50 bg-rose-950/40',
    };
  }
  if (roll === 20) {
    return {
      roll: 20,
      modifiedTotal,
      tier: 'BLACK_FLASH',
      title: `20 Natural (Total ${modifiedTotal}) — FAÍSCA NEGRA (KOKUSEN!)`,
      description: 'Aplicação de EA em 0,000001s! Dano elevado à potência 2.5 e entrada na Zona de 120%!',
      colorClass: 'text-rose-400 border-rose-500 bg-black shadow-[0_0_20px_rgba(225,29,72,0.5)]',
    };
  }
  if (roll === 19 || modifiedTotal >= 22) {
    return {
      roll,
      modifiedTotal,
      tier: 'CRITICAL_HIT',
      title: `${roll} (Total ${modifiedTotal}) — Acerto Crítico`,
      description: 'Golpe devastador explorando uma brecha vital na defesa inimiga.',
      colorClass: 'text-purple-400 border-purple-500/50 bg-purple-950/40',
    };
  }
  if (roll <= 9 && modifiedTotal < 12) {
    return {
      roll,
      modifiedTotal,
      tier: 'PARTIAL',
      title: `${roll} (Total ${modifiedTotal}) — Sucesso Parcial / Custo Alto`,
      description: 'A ação ocorre com resistência severa, desgaste de EA ou contra-ataque inimigo.',
      colorClass: 'text-amber-400 border-amber-500/40 bg-amber-950/30',
    };
  }
  return {
    roll,
    modifiedTotal,
    tier: 'SOLID',
    title: `${roll} (Total ${modifiedTotal}) — Sucesso Sólido`,
    description: 'Execução limpa e eficiente proporcional ao Grau do feiticeiro.',
    colorClass: 'text-sky-400 border-sky-500/40 bg-sky-950/30',
  };
}

/**
 * Client-Side RAG Story Card Selector (Zero-Hallucination Lore Injection)
 * Finds the Top 8 to 12 Story Cards matching the current turn context.
 */
export function selectActiveStoryCardsForTurn(
  cards: StoryCard[],
  contextText: string,
  maxCards = 10
): StoryCard[] {
  if (!cards || cards.length === 0) return [];
  const normalizedContext = contextText.toLowerCase();

  const scored = cards.map((card, index) => {
    let score = 0;
    const titleLower = card.title.toLowerCase();
    if (normalizedContext.includes(titleLower)) {
      score += 10;
    }

    for (const key of card.keys) {
      const k = key.trim().toLowerCase();
      if (k.length >= 2 && normalizedContext.includes(k)) {
        score += 5;
      }
    }

    if (card.type === 'technique' || card.type === 'domain' || card.type === 'lore') {
      score += 1;
    }

    return { card, score, index };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const matched = scored.filter((item) => item.score > 0).slice(0, maxCards);
  if (matched.length > 0) {
    return matched.map((m) => m.card);
  }
  return cards.slice(0, Math.min(8, maxCards));
}

/**
 * Parses an imported AI Dungeon Story Cards `.json` file (`[{ title, keys, type, value }]`)
 */
export function parseJsonStoryCards(jsonContent: string): StoryCard[] {
  const parsed = JSON.parse(jsonContent);
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.cards) ? parsed.cards : [];

  return list
    .filter((item: Record<string, unknown>) => item && (item.title || item.value || item.entry))
    .map((item: Record<string, unknown>, idx: number) => {
      const rawTitle = String(item.title || item.name || `Story Card #${idx + 1}`).trim();
      const rawKeys = item.keys
        ? Array.isArray(item.keys)
          ? item.keys.map((k: unknown) => String(k).trim())
          : String(item.keys)
              .split(',')
              .map((k) => k.trim())
        : [rawTitle.toLowerCase()];

      const rawValue = String(item.value || item.entry || item.description || '').trim();
      return {
        id: `imported-json-${Date.now()}-${idx}`,
        title: rawTitle,
        keys: rawKeys.filter(Boolean),
        type: 'lore' as const,
        value: rawValue,
      };
    })
    .filter((c: StoryCard) => c.value.length > 0);
}

/**
 * Parses an imported Encyclopedic `.md` Codex file by splitting on `## ` or `---`
 */
export function parseMarkdownCodex(mdContent: string): StoryCard[] {
  if (!mdContent || !mdContent.trim()) return [];

  const sections = mdContent
    .split(/(?:^|\n)(?:##\s+|---\s*\n)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  return sections.map((sec, idx) => {
    const lines = sec.split('\n');
    const firstLine = lines[0].replace(/^#+\s*/, '').trim();
    const title = firstLine.length > 0 && firstLine.length <= 120 ? firstLine : `Seção do Códice #${idx + 1}`;
    const body = lines.slice(1).join('\n').trim() || sec;

    const keysMatch = body.match(/(?:gatilhos|keys|palavras-chave)\s*:\s*([^\n]+)/i);
    const extractedKeys = keysMatch
      ? keysMatch[1]
          .split(/[,;]/)
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
      : title
          .toLowerCase()
          .split(/[\s—\-–/()]+/)
          .filter((w) => w.length >= 3);

    return {
      id: `imported-md-${Date.now()}-${idx}`,
      title,
      keys: Array.from(new Set([title.toLowerCase(), ...extractedKeys])),
      type: 'lore' as const,
      value: body,
    };
  });
}

/**
 * Domain Expansion & Barrier Atmosphere Resolver
 */
export interface DomainThemeInfo {
  isDomainActive: boolean;
  isDomainExpansionPortalActive: boolean;
  isCurtainActive: boolean;
  bannerTitle: string;
  borderGlowClass: string;
  badgeColorClass: string;
  bgGradientStyle: string;
  portalCssVars: Record<string, string>;
}

export function resolveDomainTheme(
  activeBarrierOrDomain: string,
  portalConfig?: {
    visualStyle?: string;
    primaryColor?: string;
    secondaryColor?: string;
    coreColor?: string;
    overlayIntensity?: 'subtle' | 'medium' | 'intense';
    handSeal?: string;
    barrierType?: string;
  }
): DomainThemeInfo {
  const norm = (activeBarrierOrDomain || 'Nenhum').trim();
  const lower = norm.toLowerCase();

  const intensityOpacity =
    portalConfig?.overlayIntensity === 'subtle'
      ? '0.24'
      : portalConfig?.overlayIntensity === 'intense'
      ? '0.62'
      : '0.42';

  const defaultVoidVars: Record<string, string> = {
    '--portal-primary': portalConfig?.primaryColor || 'rgba(56, 189, 248, 0.36)',
    '--portal-secondary': portalConfig?.secondaryColor || 'rgba(124, 58, 237, 0.34)',
    '--portal-core': portalConfig?.coreColor || 'rgba(225, 29, 72, 0.22)',
    '--portal-opacity': intensityOpacity,
  };

  if (!norm || lower === 'nenhum' || lower === 'none' || lower === 'inativo') {
    return {
      isDomainActive: false,
      isDomainExpansionPortalActive: false,
      isCurtainActive: false,
      bannerTitle: '',
      borderGlowClass: 'border-slate-800/80',
      badgeColorClass: 'text-slate-400',
      bgGradientStyle: 'radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.08), transparent 70%)',
      portalCssVars: defaultVoidVars,
    };
  }

  if (
    (lower.includes('cortina') || lower.includes('curtain') || lower.includes('tobari')) &&
    !lower.includes('expansão de domínio') &&
    !lower.includes('expansao de dominio')
  ) {
    return {
      isDomainActive: false,
      isDomainExpansionPortalActive: false,
      isCurtainActive: true,
      bannerTitle: `CORTINA (TOBARI) ABAIXADA — Área Isolada de Civis e Sinais Externos`,
      borderGlowClass: 'border-indigo-500/50 shadow-[0_0_25px_rgba(79,70,229,0.2)]',
      badgeColorClass: 'text-indigo-300',
      bgGradientStyle: 'radial-gradient(circle at 50% 0%, rgba(49, 46, 129, 0.28), rgba(7, 7, 10, 0.95) 80%)',
      portalCssVars: defaultVoidVars,
    };
  }

  // If custom_nebula or user configured portal colors are active
  if (portalConfig?.visualStyle === 'custom_nebula' && portalConfig.primaryColor) {
    return {
      isDomainActive: true,
      isDomainExpansionPortalActive: true,
      isCurtainActive: false,
      bannerTitle: `EXPANSÃO DE DOMÍNIO ATIVA: ${norm.toUpperCase()} — ${
        portalConfig.barrierType || 'Acerto Garantido Ativo'
      }`,
      borderGlowClass: 'border-purple-400 shadow-[0_0_38px_rgba(168,85,247,0.5)]',
      badgeColorClass: 'text-purple-300',
      bgGradientStyle: `radial-gradient(circle at 50% 15%, ${portalConfig.primaryColor}44, ${
        portalConfig.secondaryColor || '#7c3aed'
      }33, rgba(7, 7, 10, 0.95) 80%)`,
      portalCssVars: {
        '--portal-primary': `${portalConfig.primaryColor}66`,
        '--portal-secondary': `${portalConfig.secondaryColor || '#7c3aed'}55`,
        '--portal-core': `${portalConfig.coreColor || '#e11d48'}44`,
        '--portal-opacity': intensityOpacity,
      },
    };
  }

  if (
    lower.includes('sukuna') ||
    lower.includes('santuário') ||
    lower.includes('malevolente') ||
    lower.includes('sangue') ||
    portalConfig?.visualStyle === 'malevolent_shrine'
  ) {
    return {
      isDomainActive: true,
      isDomainExpansionPortalActive: true,
      isCurtainActive: false,
      bannerTitle: `EXPANSÃO DE DOMÍNIO ATIVA: ${norm.toUpperCase()} — Acerto Garantido Ativo`,
      borderGlowClass: 'border-rose-500 shadow-[0_0_35px_rgba(225,29,72,0.45)]',
      badgeColorClass: 'text-rose-400',
      bgGradientStyle: 'radial-gradient(circle at 50% 15%, rgba(225, 29, 72, 0.28), rgba(7, 7, 10, 0.95) 75%)',
      portalCssVars: {
        '--portal-primary': 'rgba(225, 29, 72, 0.42)',
        '--portal-secondary': 'rgba(136, 19, 55, 0.45)',
        '--portal-core': 'rgba(244, 63, 94, 0.28)',
        '--portal-opacity': intensityOpacity,
      },
    };
  }

  if (
    lower.includes('gojo') ||
    lower.includes('vazio') ||
    lower.includes('ilimitado') ||
    portalConfig?.visualStyle === 'infinite_void'
  ) {
    return {
      isDomainActive: true,
      isDomainExpansionPortalActive: true,
      isCurtainActive: false,
      bannerTitle: `EXPANSÃO DE DOMÍNIO ATIVA: ${norm.toUpperCase()} — Vazio Ilimitado Ativo`,
      borderGlowClass: 'border-sky-400 shadow-[0_0_35px_rgba(56,189,248,0.45)]',
      badgeColorClass: 'text-sky-300',
      bgGradientStyle: 'radial-gradient(circle at 50% 15%, rgba(56, 189, 248, 0.25), rgba(124, 58, 237, 0.15), rgba(7, 7, 10, 0.95) 80%)',
      portalCssVars: {
        '--portal-primary': 'rgba(56, 189, 248, 0.42)',
        '--portal-secondary': 'rgba(124, 58, 237, 0.38)',
        '--portal-core': 'rgba(192, 132, 252, 0.25)',
        '--portal-opacity': intensityOpacity,
      },
    };
  }

  if (
    lower.includes('higuruma') ||
    lower.includes('sentença') ||
    lower.includes('judicial') ||
    portalConfig?.visualStyle === 'judgeman_court'
  ) {
    return {
      isDomainActive: true,
      isDomainExpansionPortalActive: true,
      isCurtainActive: false,
      bannerTitle: `EXPANSÃO DE DOMÍNIO ATIVA: ${norm.toUpperCase()} — Proibição de Violência Ativa`,
      borderGlowClass: 'border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.4)]',
      badgeColorClass: 'text-amber-300',
      bgGradientStyle: 'radial-gradient(circle at 50% 15%, rgba(245, 158, 11, 0.24), rgba(7, 7, 10, 0.95) 75%)',
      portalCssVars: {
        '--portal-primary': 'rgba(245, 158, 11, 0.36)',
        '--portal-secondary': 'rgba(120, 53, 15, 0.4)',
        '--portal-core': 'rgba(251, 191, 36, 0.24)',
        '--portal-opacity': intensityOpacity,
      },
    };
  }

  return {
    isDomainActive: true,
    isDomainExpansionPortalActive: true,
    isCurtainActive: false,
    bannerTitle: `EXPANSÃO DE DOMÍNIO ATIVA: ${norm.toUpperCase()} — Acerto Garantido Ativo`,
    borderGlowClass: 'border-purple-500 shadow-[0_0_35px_rgba(168,85,247,0.45)]',
    badgeColorClass: 'text-purple-300',
    bgGradientStyle: 'radial-gradient(circle at 50% 15%, rgba(124, 58, 237, 0.28), rgba(7, 7, 10, 0.95) 75%)',
    portalCssVars: defaultVoidVars,
  };
}

/**
 * Automatically consumes `newInventoryItemOrVow` returned by the GM and updates
 * either `bindingVows` (if it starts with "Voto" or contains "Voto Vinculativo")
 * or `inventory` (as a new Cursed Tool/Item), avoiding duplicates.
 */
export function applyNewInventoryItemOrVow(
  character: CharacterSheet,
  rawEntry?: string
): { updatedCharacter: CharacterSheet; notification: string | null } {
  const trimmed = (rawEntry || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'nenhum' || trimmed.toLowerCase() === 'vazio') {
    return { updatedCharacter: character, notification: null };
  }

  const isVow = /^voto/i.test(trimmed) || /voto vinculativo/i.test(trimmed);

  if (isVow) {
    const withoutPrefix = trimmed.replace(/^voto(\s+vinculativo)?\s*[:—\-]?\s*/i, '').trim();
    const parts = withoutPrefix.split(/[:—\-]/).map((s) => s.trim()).filter(Boolean);
    const vowName = parts[0] || withoutPrefix.slice(0, 60);
    const vowBonus = parts.slice(1).join(' — ') || 'Efeito de Voto Vinculativo ativo na campanha';

    const alreadyExists = character.bindingVows.some(
      (v) => v.name.toLowerCase() === vowName.toLowerCase() || trimmed.toLowerCase().includes(v.name.toLowerCase())
    );

    if (alreadyExists) {
      return {
        updatedCharacter: {
          ...character,
          bindingVows: character.bindingVows.map((v) =>
            v.name.toLowerCase() === vowName.toLowerCase() || trimmed.toLowerCase().includes(v.name.toLowerCase())
              ? { ...v, active: true }
              : v
          ),
        },
        notification: `Voto Vinculativo Ativado: ${vowName}`,
      };
    }

    return {
      updatedCharacter: {
        ...character,
        bindingVows: [
          ...character.bindingVows,
          {
            id: `vow-gm-${Date.now()}`,
            name: vowName,
            condition: 'Pactuado durante a crônica',
            bonus: vowBonus,
            active: true,
          },
        ],
      },
      notification: `Novo Voto Vinculativo Selado: ${vowName}`,
    };
  }

  // Otherwise treat as a new Inventory Item / Cursed Tool
  const parts = trimmed.split(/[:—\-]/).map((s) => s.trim()).filter(Boolean);
  const itemName = parts[0] || trimmed.slice(0, 60);
  const itemEffect = parts.slice(1).join(' — ') || 'Obtido durante a crônica Jujutsu.';

  const alreadyHasItem = character.inventory.some(
    (i) => i.name.toLowerCase() === itemName.toLowerCase()
  );
  if (alreadyHasItem) {
    return { updatedCharacter: character, notification: null };
  }

  return {
    updatedCharacter: {
      ...character,
      inventory: [
        ...character.inventory,
        {
          id: `item-gm-${Date.now()}`,
          name: itemName,
          grade: 'Item de Campanha',
          effect: itemEffect,
          equipped: true,
        },
      ],
    },
    notification: `Novo Item Obtido no Arsenal: ${itemName}`,
  };
}

/**
 * Sanitizes and compacts a CampaignState before saving to Firestore to strictly obey
 * the volumetric limits in firebase-blueprint.json and firestore.rules (< 900,000 chars).
 */
export function sanitizeCampaignForCloud(state: CampaignState, ownerId: string) {
  const safeId = state.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120) || 'campaign_default';
  const charName = (state.character.name || 'Feiticeiro').slice(0, 100);
  const charGrade = (state.character.grade || 'Grau 3').slice(0, 60);
  const arc = (state.world.arc || 'Arco Inicial').slice(0, 160);
  const location = (state.world.location || 'Tóquio').slice(0, 160);
  const title = `${charName} — ${arc}`.slice(0, 160);
  const turnCount = Math.min(100000, Math.max(0, state.turns.length));

  const lightweightState: CampaignState = {
    ...state,
    character: {
      ...state.character,
      avatarUrl: state.character.avatarUrl?.startsWith('data:image/png;base64')
        ? ''
        : state.character.avatarUrl,
    },
    turns: state.turns.slice(-40).map((t) => ({
      ...t,
      sceneImageUrl: t.sceneImageUrl?.startsWith('data:image/png;base64') ? undefined : t.sceneImageUrl,
    })),
    npcAvatars: {},
  };

  let payloadStr = JSON.stringify(lightweightState);
  if (payloadStr.length > 850000) {
    lightweightState.turns = lightweightState.turns.slice(-15);
    lightweightState.customCodex = [];
    payloadStr = JSON.stringify(lightweightState);
  }

  return {
    campaignId: safeId,
    docData: {
      ownerId: ownerId.slice(0, 128),
      title,
      characterName: charName,
      characterGrade: charGrade,
      arc,
      location,
      turnCount,
      campaignPayload: payloadStr,
    },
  };
}

/**
 * === SISTEMA DE NÍVEIS E PROGRESSÃO ENTRE GRAUS JUJUTSU ===
 * Grau 4 -> necessário subir 10 níveis para subir ao Grau 3
 * Grau 3 -> necessário subir 15 níveis para subir ao Grau 2
 * Grau 2 -> necessário subir 20 níveis para subir ao Semi-Grau 1
 * Semi-Grau 1 -> necessário subir 25 níveis para subir ao Grau 1
 * Grau 1 -> necessário subir 30 níveis para subir ao Grau Especial
 */
export interface GradeProgressionRule {
  grade: string;
  levelsRequired: number;
  nextGrade: string | null;
  milestoneRewardHint: string;
}

export const GRADE_PROGRESSION_TIERS: GradeProgressionRule[] = [
  {
    grade: 'Grau 4',
    levelsRequired: 10,
    nextGrade: 'Grau 3',
    milestoneRewardHint: 'Refinamento básico de Energia Amaldiçoada e despertar do Lapso / Estilo de Combate.',
  },
  {
    grade: 'Grau 3',
    levelsRequired: 15,
    nextGrade: 'Grau 2',
    milestoneRewardHint: 'Domínio de Extensões da Técnica, Votos Vinculativos táticos e Ferramentas Amaldiçoadas.',
  },
  {
    grade: 'Grau 2',
    levelsRequired: 20,
    nextGrade: 'Semi-Grau 1',
    milestoneRewardHint: 'Defesa Anti-Domínio (Domínio Simples) e maior probabilidade de atingir Kokusen.',
  },
  {
    grade: 'Semi-Grau 1',
    levelsRequired: 25,
    nextGrade: 'Grau 1',
    milestoneRewardHint: 'Despertar de Técnica Amaldiçoada Reversa (RCT), Reversão (Vermelho) ou Domínio Incompleto.',
  },
  {
    grade: 'Grau 1',
    levelsRequired: 30,
    nextGrade: 'Grau Especial',
    milestoneRewardHint: 'Expansão de Domínio Completa (Ryōiki Tenkai) e Técnica Máxima (Uzumaki).',
  },
  {
    grade: 'Grau Especial',
    levelsRequired: 50,
    nextGrade: null,
    milestoneRewardHint: 'Ápice do Jujutsu — Maestria Transcendental e Refinamento de Barreira Divina.',
  },
];

export function getGradeProgressionRule(grade?: string): GradeProgressionRule {
  const g = (grade || 'Grau 4').trim().toLowerCase();
  const found = GRADE_PROGRESSION_TIERS.find((t) => t.grade.toLowerCase() === g);
  if (found) return found;
  if (g.includes('especial')) return GRADE_PROGRESSION_TIERS[5];
  if (g.includes('semi')) return GRADE_PROGRESSION_TIERS[3];
  if (g.includes('grau 1')) return GRADE_PROGRESSION_TIERS[4];
  if (g.includes('grau 2')) return GRADE_PROGRESSION_TIERS[2];
  if (g.includes('grau 3')) return GRADE_PROGRESSION_TIERS[1];
  return GRADE_PROGRESSION_TIERS[0];
}

export function ensureCharacterProgression(character: CharacterSheet): CharacterProgression {
  const rule = getGradeProgressionRule(character.grade);
  if (character.progression && character.progression.currentGrade === rule.grade) {
    return {
      ...character.progression,
      levelsRequiredForNextGrade: rule.levelsRequired,
      nextGrade: rule.nextGrade,
    };
  }
  return {
    currentGrade: rule.grade,
    levelInCurrentGrade: character.progression?.levelInCurrentGrade ?? 0,
    levelsRequiredForNextGrade: rule.levelsRequired,
    nextGrade: rule.nextGrade,
    totalCharacterLevel: character.progression?.totalCharacterLevel ?? 1,
    currentXp: character.progression?.currentXp ?? 0,
    xpToNextLevel: 100,
  };
}

export function isSectionUndeveloped(value?: string | null): boolean {
  if (!value) return true;
  const norm = value.trim().toLowerCase();
  return (
    norm === '' ||
    norm === 'não desenvolvido ainda' ||
    norm === 'nao desenvolvido ainda' ||
    norm.startsWith('não desenvolvido ainda') ||
    norm.startsWith('[não desenvolvido ainda]')
  );
}

export interface CharacterSectionStatus {
  key: string;
  label: string;
  category: 'Identidade' | 'Técnica' | 'Domínio' | 'Arsenal & Votos';
  isUndeveloped: boolean;
  currentValue: string;
}

export function inspectCharacterDevelopmentSections(
  character: CharacterSheet
): CharacterSectionStatus[] {
  const rctUndeveloped =
    character.technique.rctStatus === 'Não desenvolvido ainda' ||
    (!character.technique.hasRct && character.technique.rctStatus !== 'Bloqueado');

  const firstVow = character.bindingVows[0];
  const vowUndeveloped =
    !firstVow ||
    isSectionUndeveloped(firstVow.name) ||
    isSectionUndeveloped(firstVow.condition);

  const firstTool = character.inventory[0];
  const toolUndeveloped =
    !firstTool || isSectionUndeveloped(firstTool.name);

  return [
    {
      key: 'appearance',
      label: 'Aparência Física & Aura',
      category: 'Identidade',
      isUndeveloped: isSectionUndeveloped(character.appearance),
      currentValue: character.appearance || UNDEVELOPED_MARKER,
    },
    {
      key: 'backstory',
      label: 'História, Passado & Motivação',
      category: 'Identidade',
      isUndeveloped: isSectionUndeveloped(character.backstory),
      currentValue: character.backstory || UNDEVELOPED_MARKER,
    },
    {
      key: 'combatStyle',
      label: 'Estilo de Combate & Taijutsu',
      category: 'Identidade',
      isUndeveloped: isSectionUndeveloped(character.combatStyle),
      currentValue: character.combatStyle || UNDEVELOPED_MARKER,
    },
    {
      key: 'techniqueDescription',
      label: `Conceito da Técnica (${character.technique.name || 'Inata'})`,
      category: 'Técnica',
      isUndeveloped:
        isSectionUndeveloped(character.technique.name) ||
        isSectionUndeveloped(character.technique.description),
      currentValue: character.technique.description || UNDEVELOPED_MARKER,
    },
    {
      key: 'lapse',
      label: 'Lapso da Técnica (Aplicação Padrão / Azul)',
      category: 'Técnica',
      isUndeveloped: isSectionUndeveloped(character.technique.lapse),
      currentValue: character.technique.lapse || UNDEVELOPED_MARKER,
    },
    {
      key: 'reversal',
      label: 'Reversão da Técnica (Energia Positiva / Vermelho)',
      category: 'Técnica',
      isUndeveloped: isSectionUndeveloped(character.technique.reversal),
      currentValue: character.technique.reversal || UNDEVELOPED_MARKER,
    },
    {
      key: 'maximum',
      label: 'Técnica Máxima (Output Supremo / Uzumaki)',
      category: 'Técnica',
      isUndeveloped: isSectionUndeveloped(character.technique.maximum),
      currentValue: character.technique.maximum || UNDEVELOPED_MARKER,
    },
    {
      key: 'rct',
      label: 'Técnica Amaldiçoada Reversa (RCT — Cura)',
      category: 'Técnica',
      isUndeveloped: rctUndeveloped,
      currentValue: character.technique.hasRct
        ? 'Desenvolvida (Cura Celular Ativa)'
        : character.technique.rctStatus || UNDEVELOPED_MARKER,
    },
    {
      key: 'antiDomain',
      label: 'Defesa Anti-Domínio (Domínio Simples)',
      category: 'Domínio',
      isUndeveloped: isSectionUndeveloped(character.technique.antiDomain),
      currentValue: character.technique.antiDomain || UNDEVELOPED_MARKER,
    },
    {
      key: 'domainExpansion',
      label: 'Expansão de Domínio (Ryōiki Tenkai)',
      category: 'Domínio',
      isUndeveloped:
        isSectionUndeveloped(character.technique.domainExpansion) ||
        isSectionUndeveloped(character.technique.domainPortal?.domainName),
      currentValue: character.technique.domainExpansion || UNDEVELOPED_MARKER,
    },
    {
      key: 'bindingVow',
      label: 'Voto Vinculativo Pessoal',
      category: 'Arsenal & Votos',
      isUndeveloped: vowUndeveloped,
      currentValue: firstVow
        ? `${firstVow.name}: ${firstVow.condition} -> ${firstVow.bonus}`
        : UNDEVELOPED_MARKER,
    },
    {
      key: 'cursedTool',
      label: 'Ferramenta Amaldiçoada Principal',
      category: 'Arsenal & Votos',
      isUndeveloped: toolUndeveloped,
      currentValue: firstTool
        ? `${firstTool.name} (${firstTool.grade}) — ${firstTool.effect}`
        : UNDEVELOPED_MARKER,
    },
  ];
}

export const DEFAULT_NARRATIVE_PILLARS: NarrativePillarItem[] = [
  {
    id: 'pillar-vigor',
    name: 'Vigor & Corpo',
    abbr: 'FOR / CON',
    tier: 'Forte',
    narrativeNote: 'Potência muscular bruta, resistência a impactos e tolerância à dor em combate.',
  },
  {
    id: 'pillar-agility',
    name: 'Agilidade & Reflexo',
    abbr: 'DES',
    tier: 'Forte',
    narrativeNote: 'Velocidade de esquiva, reação no milionésimo de segundo e mobilidade acrobática.',
  },
  {
    id: 'pillar-ce',
    name: 'Controle Espiritual',
    abbr: 'EA',
    tier: 'Padrao',
    narrativeNote: 'Refinamento do fluxo de Energia Amaldiçoada, estabilidade de aura e eficiência.',
  },
  {
    id: 'pillar-intellect',
    name: 'Intelecto Tático',
    abbr: 'INT',
    tier: 'Padrao',
    narrativeNote: 'Dedução rápida das regras da técnica inimiga e formulação de contra-medidas.',
  },
  {
    id: 'pillar-instinct',
    name: 'Instinto & Percepção',
    abbr: 'SAB',
    tier: 'Padrao',
    narrativeNote: 'Sexto sentido para intenção assassina, leitura de resíduos e emboscadas.',
  },
  {
    id: 'pillar-presence',
    name: 'Presença & Compostura',
    abbr: 'CAR',
    tier: 'Fraco',
    narrativeNote: 'Fragilidade Obrigatória: Dificuldade em conter impulsos emocionais ou lidar com a política do Alto Escalão Jujutsu.',
  },
];

export const DEFAULT_NARRATIVE_SKILLS: NarrativeSkillItem[] = [
  {
    id: 'skill-taijutsu',
    name: 'Artes Marciais & Taijutsu',
    category: 'Combate & Corpo',
    level: 'afinidade',
    narrativeImpact: 'Golpes corpo-a-corpo fluidos, leitura de guarda e contra-ataques marciais.',
  },
  {
    id: 'skill-weapons',
    name: 'Manejo de Armas & Ferramentas Amaldiçoadas',
    category: 'Combate & Corpo',
    level: 'afinidade',
    narrativeImpact: 'Sincronia natural ao canalizar Energia Amaldiçoada em lâminas, foices e armas.',
  },
  {
    id: 'skill-acrobatics',
    name: 'Acrobacia, Esquiva & Parkour Urbano',
    category: 'Combate & Corpo',
    level: 'neutro',
    narrativeImpact: 'Movimentação aérea entre escombros, telhados e ataques de área.',
  },
  {
    id: 'skill-endurance',
    name: 'Tolerância à Dor & Sobrevivência Extrema',
    category: 'Combate & Corpo',
    level: 'afinidade',
    narrativeImpact: 'Capacidade de continuar lutando mesmo com ferimentos severos sem perder o foco.',
  },
  {
    id: 'skill-ce-control',
    name: 'Refinamento & Eficiência de Energia Amaldiçoada',
    category: 'Jujutsu & Barreiras',
    level: 'neutro',
    narrativeImpact: 'Evita desperdício de reserva espiritual e estabiliza técnicas de alto custo.',
  },
  {
    id: 'skill-barriers',
    name: 'Técnicas de Barreira & Cortinas',
    category: 'Jujutsu & Barreiras',
    level: 'nao_desenvolvido',
    narrativeImpact: 'Criação, análise e ruptura de Cortinas, Domínio Simples e barreiras complexas.',
  },
  {
    id: 'skill-tracking',
    name: 'Percepção de Resíduos & Rastreamento Espiritual',
    category: 'Jujutsu & Barreiras',
    level: 'afinidade',
    narrativeImpact: 'Rastreia assinaturas ocultas de maldições, objetos amaldiçoados e feiticeiros.',
  },
  {
    id: 'skill-tactical-deduction',
    name: 'Dedução Tática de Técnicas Inimigas',
    category: 'Mente & Percepção',
    level: 'afinidade',
    narrativeImpact: 'Descobre rapidamente condições de ativação, alcance e brechas da técnica rival.',
  },
  {
    id: 'skill-lore',
    name: 'Erudição Jujutsu, Clãs & Maldições Ancestrais',
    category: 'Mente & Percepção',
    level: 'neutro',
    narrativeImpact: 'Conhecimento histórico sobre as Três Grandes Famílias, Votos e Objetos de Grau Especial.',
  },
  {
    id: 'skill-sixth-sense',
    name: 'Sexto Sentido & Contra-Emboscada',
    category: 'Mente & Percepção',
    level: 'neutro',
    narrativeImpact: 'Reage instintivamente a ataques furtivos e intenções letais antes do impacto.',
  },
  {
    id: 'skill-medicine',
    name: 'Anatomia, Primeiros Socorros & Biologia Amaldiçoada',
    category: 'Mente & Percepção',
    level: 'neutro',
    narrativeImpact: 'Estabiliza hemorragias, identifica venenos e compreende pontos vitais.',
  },
  {
    id: 'skill-stealth',
    name: 'Furtividade & Ocultação de Aura',
    category: 'Social & Furtividade',
    level: 'inaptidao',
    narrativeImpact: 'Fragilidade: Presença espiritual intensa que dificulta infiltrações silenciosas quando sob tensão.',
  },
  {
    id: 'skill-intimidation',
    name: 'Intimidação & Pressão Espiritual',
    category: 'Social & Furtividade',
    level: 'afinidade',
    narrativeImpact: 'Impõe medo ou hesitação em inimigos através da intensidade do olhar e da aura.',
  },
  {
    id: 'skill-deception',
    name: 'Diplomacia & Contenção com o Alto Escalão',
    category: 'Social & Furtividade',
    level: 'inaptidao',
    narrativeImpact: 'Fragilidade: Impaciência com burocracia e provocações, gerando atritos dramáticos na história.',
  },
];

export interface NarrativeLimitationsCheck {
  hasFragilePillar: boolean;
  fragilePillarCount: number;
  strongOrApexPillarCount: number;
  apexPillarCount: number;
  maxStrongOrApexPillars: number;
  maxApexPillars: number;
  hasFragileSkill: boolean;
  fragileSkillCount: number;
  masterySkillCount: number;
  maxMasterySkills: number;
  isValid: boolean;
  warnings: string[];
}

export function validateNarrativeLimitations(
  pillars: NarrativePillarItem[] = [],
  skills: NarrativeSkillItem[] = []
): NarrativeLimitationsCheck {
  const fragilePillarCount = pillars.filter((p) => p.tier === 'Fraco').length;
  const apexPillarCount = pillars.filter((p) => p.tier === 'Apice').length;
  const strongOrApexPillarCount = pillars.filter(
    (p) => p.tier === 'Forte' || p.tier === 'Apice'
  ).length;
  const maxStrongOrApexPillars = 3;
  const maxApexPillars = 1;

  const fragileSkillCount = skills.filter((s) => s.level === 'inaptidao').length;
  const masterySkillCount = skills.filter((s) => s.level === 'maestria').length;
  const maxMasterySkills = 2;

  const hasFragilePillar = fragilePillarCount >= 1;
  const hasFragileSkill = fragileSkillCount >= 1;

  const warnings: string[] = [];
  if (!hasFragilePillar) {
    warnings.push(
      'Regra Obrigatória de Mesa: Pelo menos 1 dos 6 Pilares de Aptidão DEVE ser marcado como "▼ Fragilidade".'
    );
  }
  if (apexPillarCount > maxApexPillars) {
    warnings.push(
      `Limite de Equilíbrio: No máximo ${maxApexPillars} Pilar pode ser "★ Ápice Sobre-Humano" (atualmente ${apexPillarCount}).`
    );
  }
  if (strongOrApexPillarCount > maxStrongOrApexPillars) {
    warnings.push(
      `Limite de Equilíbrio: No máximo ${maxStrongOrApexPillars} Pilares podem ser Ponto Forte / Ápice (atualmente ${strongOrApexPillarCount}).`
    );
  }
  if (!hasFragileSkill) {
    warnings.push(
      'Regra Obrigatória de Mesa: Pelo menos 1 Perícia Narrativa DEVE ser marcada como "▼ Inaptidão / Prejudica".'
    );
  }
  if (masterySkillCount > maxMasterySkills) {
    warnings.push(
      `Limite de Equilíbrio: No máximo ${maxMasterySkills} Perícias podem começar com "★ Maestria" (atualmente ${masterySkillCount}).`
    );
  }

  return {
    hasFragilePillar,
    fragilePillarCount,
    strongOrApexPillarCount,
    apexPillarCount,
    maxStrongOrApexPillars,
    maxApexPillars,
    hasFragileSkill,
    fragileSkillCount,
    masterySkillCount,
    maxMasterySkills,
    isValid:
      hasFragilePillar &&
      hasFragileSkill &&
      apexPillarCount <= maxApexPillars &&
      strongOrApexPillarCount <= maxStrongOrApexPillars &&
      masterySkillCount <= maxMasterySkills,
    warnings,
  };
}

export function enforceMandatoryLimitationsOnPillars(
  pillars: NarrativePillarItem[]
): NarrativePillarItem[] {
  const source =
    pillars && pillars.length > 0
      ? pillars.map((p) => ({ ...p }))
      : DEFAULT_NARRATIVE_PILLARS.map((p) => ({ ...p }));

  // 1. Cap Ápice at 1 and Total Strong/Apex at 3
  let apexSeen = 0;
  let strongSeen = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i].tier === 'Apice') {
      apexSeen++;
      if (apexSeen > 1) {
        source[i].tier = 'Forte';
      }
    }
    if (source[i].tier === 'Forte' || source[i].tier === 'Apice') {
      strongSeen++;
      if (strongSeen > 3) {
        source[i].tier = 'Padrao';
      }
    }
  }

  // 2. Guarantee at least 1 Fragilidade ('Fraco')
  const hasFragile = source.some((p) => p.tier === 'Fraco');
  if (!hasFragile && source.length > 0) {
    const presenceIdx = source.findIndex(
      (p) => p.id.includes('presence') && p.tier !== 'Apice' && p.tier !== 'Forte'
    );
    const padraoIdx = source.findIndex((p) => p.tier === 'Padrao');
    const targetIdx =
      presenceIdx !== -1
        ? presenceIdx
        : padraoIdx !== -1
        ? padraoIdx
        : source.length - 1;
    source[targetIdx] = {
      ...source[targetIdx],
      tier: 'Fraco',
    };
  }

  return source;
}

export function enforceMandatoryLimitationsOnSkills(
  skills: NarrativeSkillItem[]
): NarrativeSkillItem[] {
  const source =
    skills && skills.length > 0
      ? skills.map((s) => ({ ...s }))
      : DEFAULT_NARRATIVE_SKILLS.map((s) => ({ ...s }));

  // 1. Cap Maestria at 2
  let masterySeen = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i].level === 'maestria') {
      masterySeen++;
      if (masterySeen > 2) {
        source[i].level = 'afinidade';
      }
    }
  }

  // 2. Guarantee at least 1 Inaptidão ('inaptidao')
  const hasInaptidao = source.some((s) => s.level === 'inaptidao');
  if (!hasInaptidao && source.length > 0) {
    const neutralIdx = source.findIndex((s) => s.level === 'neutro');
    const targetIdx = neutralIdx !== -1 ? neutralIdx : source.length - 1;
    source[targetIdx] = {
      ...source[targetIdx],
      level: 'inaptidao',
    };
  }

  return source;
}

export function ensureNarrativePillars(character: CharacterSheet): NarrativePillarItem[] {
  return enforceMandatoryLimitationsOnPillars(character.narrativePillars || []);
}

export function ensureNarrativeSkills(character: CharacterSheet): NarrativeSkillItem[] {
  return enforceMandatoryLimitationsOnSkills(character.narrativeSkills || []);
}

export function getAffinityLevelMeta(level: NarrativeAffinityLevel): {
  label: string;
  shortLabel: string;
  symbol: string;
  badgeClass: string;
  narrativeRule: string;
} {
  switch (level) {
    case 'maestria':
      return {
        label: 'Maestria (Ajuda Decisivamente)',
        shortLabel: 'Maestria',
        symbol: '★',
        badgeClass:
          'bg-amber-950/70 border-amber-400/80 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]',
        narrativeRule:
          'AJUDA DECISIVAMENTE NA HISTÓRIA: O personagem executa façanhas extraordinárias e percebe detalhes cruciais automaticamente nesta área.',
      };
    case 'afinidade':
      return {
        label: 'Afinidade (Ajuda na História)',
        shortLabel: 'Afinidade',
        symbol: '●',
        badgeClass: 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300',
        narrativeRule:
          'AJUDA NA HISTÓRIA: O personagem tem treinamento sólido e vantagem narrativa natural quando age com esta perícia.',
      };
    case 'inaptidao':
      return {
        label: 'Inaptidão / Ponto Fraco (Prejudica)',
        shortLabel: 'Prejudica',
        symbol: '▼',
        badgeClass: 'bg-rose-950/70 border-rose-500/70 text-rose-300',
        narrativeRule:
          'PREJUDICA NA HISTÓRIA: O personagem sofre complicações dramáticas, falhas de execução ou desvantagens narrativas quando depende desta perícia.',
      };
    case 'nao_desenvolvido':
      return {
        label: 'Não desenvolvido ainda (Latente)',
        shortLabel: 'Não desenv.',
        symbol: '🔒',
        badgeClass: 'bg-purple-950/50 border-purple-500/50 text-purple-300',
        narrativeRule:
          'NÃO DESENVOLVIDO AINDA: Habilidade inexperiente ou adormecida que pode despertar durante a campanha.',
      };
    case 'neutro':
    default:
      return {
        label: 'Neutro (Desempenho Comum)',
        shortLabel: 'Neutro',
        symbol: '○',
        badgeClass: 'bg-[#07070a] border-slate-700 text-slate-400',
        narrativeRule: 'DESEMPENHO PADRÃO: Sem facilidade especial nem complicação extra.',
      };
  }
}

export function cycleAffinityLevel(current: NarrativeAffinityLevel): NarrativeAffinityLevel {
  const order: NarrativeAffinityLevel[] = [
    'neutro',
    'afinidade',
    'maestria',
    'inaptidao',
    'nao_desenvolvido',
  ];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function cyclePillarTier(current: NarrativePillarTier): NarrativePillarTier {
  const order: NarrativePillarTier[] = [
    'Padrao',
    'Forte',
    'Apice',
    'Fraco',
    'NaoDesenvolvido',
  ];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function getPillarTierMeta(tier: NarrativePillarTier): {
  label: string;
  badgeClass: string;
} {
  switch (tier) {
    case 'Apice':
      return {
        label: '★ Ápice Sobre-Humano',
        badgeClass: 'border-amber-400 bg-amber-950/60 text-amber-200',
      };
    case 'Forte':
      return {
        label: '● Ponto Forte',
        badgeClass: 'border-emerald-500/70 bg-emerald-950/40 text-emerald-300',
      };
    case 'Fraco':
      return {
        label: '▼ Fragilidade',
        badgeClass: 'border-rose-500/70 bg-rose-950/50 text-rose-300',
      };
    case 'NaoDesenvolvido':
      return {
        label: '🔒 Não desenv.',
        badgeClass: 'border-purple-500/60 bg-purple-950/40 text-purple-300',
      };
    case 'Padrao':
    default:
      return {
        label: '○ Padrão',
        badgeClass: 'border-slate-700 bg-[#07070a] text-slate-300',
      };
  }
}

/**
 * Generates the Exclusive Living Character Sheet Markdown (`exclusiveSheetMarkdown`)
 * which is consulted by the AI GM on every turn and automatically updated whenever
 * the character levels up, promotes Grade, or unlocks an undeveloped section.
 */
export function buildExclusiveCharacterSheetMarkdown(character: CharacterSheet): string {
  const prog = ensureCharacterProgression(character);
  const sections = inspectCharacterDevelopmentSections(character);
  const undevelopedList = sections.filter((s) => s.isUndeveloped);
  const developedList = sections.filter((s) => !s.isUndeveloped);
  const pillars = ensureNarrativePillars(character);
  const skills = ensureNarrativeSkills(character);
  const helpfulSkills = skills.filter((s) => s.level === 'maestria' || s.level === 'afinidade');
  const hinderingSkills = skills.filter((s) => s.level === 'inaptidao');
  const latentSkills = skills.filter((s) => s.level === 'nao_desenvolvido');
  const history = character.evolutionHistory || [];

  return `# 📜 FICHA EXCLUSIVA VIVA DO PERSONAGEM (ESTILO RPG DE MESA / D&D 5e): ${character.name.toUpperCase()}
- **Gatilhos (Keys):** ${character.name.toLowerCase()}, ficha exclusiva, perícias, afinidades, ${character.clan.toLowerCase()}, ${character.technique.name.toLowerCase()}, evolução, nível, grau
- **Grau Designado Atual:** ${character.grade} (Modificador de Grau: ${calculateGradeModifier(character).label})
- **Progressão na Categoria (${prog.currentGrade}):** Nível **${prog.levelInCurrentGrade} / ${prog.levelsRequiredForNextGrade}** na categoria para promoção a **${prog.nextGrade || 'Ápice do Grau Especial'}** (Nível Total de Feiticeiro: ${prog.totalCharacterLevel} · XP Atual: ${prog.currentXp}/${prog.xpToNextLevel})
- **Facção / Classe:** ${character.faction} · **Clã / Antecedente:** ${character.clan}
- **Filosofia / Alinhamento Jujutsu:** ${character.alignmentPhilosophy || 'Pragmático / Leal aos Aliados'}
- **Restrição Celestial:** ${character.isHeavenlyRestriction ? 'SIM (0% EA / Corpo Sobre-Humano)' : 'Não'}
- **Estado Vital e Clínico:** HP ${Math.round(character.hpPercentage)}% (${character.physicalCondition}) | Reserva de EA: ${Math.round(character.cursedEnergyPercentage)}% | Output: ${Math.round(character.outputPercentage)}%

## 1. Identidade, Psicologia (Traços D&D 5e) e Estilo Marcial
- **Aparência Física e Aura:** ${character.appearance || UNDEVELOPED_MARKER}
- **Traços de Personalidade:** ${character.personalityTraits || 'Determinado sob pressão, atento aos companheiros.'}
- **Ideais & Motivação:** ${character.ideals || 'Proteger os seus e superar os limites do próprio Jujutsu.'}
- **Vínculos (Bonds):** ${character.bonds || character.clan}
- **Defeitos & Fragilidades Psicológicas (Flaws):** ${character.flaws || 'Assume riscos extremos quando aliados estão em perigo.'}
- **História de Origem Completa:** ${character.backstory || UNDEVELOPED_MARKER}
- **Estilo de Combate & Taijutsu:** ${character.combatStyle || UNDEVELOPED_MARKER}

## 2. Pilares de Aptidão & Sistema de Perícias Narrativas (100% Narrativo — Sem Cálculo Matemático)
> **INSTRUÇÃO AO MESTRE DE JOGO:** Este sistema de perícias é **totalmente narrativo**. NÃO faça somas matemáticas extras para perícias; em vez disso, faça com que as **Maestrias e Afinidades AJUDEM organicamente** o jogador na narração das cenas (dando percepções automáticas, facilidade de execução e vantagem tática descritiva), e faça com que as **Inaptidões / Fragilidades PREJUDIQUEM ou criem complicações dramáticas** quando a cena exigir aquela perícia!

### Pilares Fundamentais do Feiticeiro:
${pillars
  .map((p) => `- **${p.name} (${p.abbr}):** [${getPillarTierMeta(p.tier).label}] — ${p.narrativeNote}`)
  .join('\n')}

### ★ Perícias que AJUDAM o Personagem na História (Maestrias & Afinidades):
${
  helpfulSkills.length === 0
    ? '- Nenhuma afinidade destacada ainda.'
    : helpfulSkills
        .map(
          (s) =>
            `- **[${s.level === 'maestria' ? '★ MAESTRIA ESPECIALISTA' : '● AFINIDADE PROFICIENTE'}] ${s.name}** (*${s.category}*): ${s.narrativeImpact}`
        )
        .join('\n')
}

### ▼ Perícias que PREJUDICAM o Personagem na História (Inaptidões & Pontos Fracos):
${
  hinderingSkills.length === 0
    ? '- Nenhuma inaptidão crítica registrada.'
    : hinderingSkills
        .map(
          (s) =>
            `- **[▼ INAPTIDÃO / PONTO FRACO — DEVE PREJUDICAR NA NARRAÇÃO] ${s.name}** (*${s.category}*): ${s.narrativeImpact}`
        )
        .join('\n')
}

### 🔒 Perícias "Não desenvolvido ainda" (Podem Despertar na Campanha):
${
  latentSkills.length === 0
    ? '- Nenhuma perícia marcada como não desenvolvida.'
    : latentSkills.map((s) => `- **[🔒 NÃO DESENVOLVIDO AINDA] ${s.name}** (*${s.category}*): ${s.narrativeImpact}`).join('\n')
}

## 3. Técnica Amaldiçoada Inata & Extensões
- **Nome da Técnica Inata:** ${character.technique.name || UNDEVELOPED_MARKER}
- **Funcionamento e Regras:** ${character.technique.description || UNDEVELOPED_MARKER}
- **Condições de Ativação / Limitações:** ${character.technique.activationConditions || 'Padrão'}
- **Lapso (Aplicação Padrão / Azul):** ${character.technique.lapse || UNDEVELOPED_MARKER}
- **Reversão da Técnica (Energia Positiva / Vermelho):** ${character.technique.reversal || UNDEVELOPED_MARKER}
- **Técnica Máxima (Output Supremo):** ${character.technique.maximum || UNDEVELOPED_MARKER}
- **Técnica Amaldiçoada Reversa (RCT):** ${
    character.technique.hasRct
      ? 'Desenvolvida (Cura Celular com Energia Positiva)'
      : character.technique.rctStatus || UNDEVELOPED_MARKER
  }
- **Defesa Anti-Domínio:** ${character.technique.antiDomain || UNDEVELOPED_MARKER}
- **Expansão de Domínio (Ryōiki Tenkai):** ${character.technique.domainExpansion || UNDEVELOPED_MARKER}

## 4. Seções "Não desenvolvido ainda" (Ganchos de Despertar na História)
${
  undevelopedList.length === 0
    ? '- Todas as seções principais já foram desenvolvidas! O personagem pode refinar suas técnicas e barreiras.'
    : undevelopedList
        .map(
          (u) =>
            `- **[NÃO DESENVOLVIDO AINDA]** ${u.label}: O Mestre deve observar o treinamento, combates de vida ou morte, Kokusens e subidas de Nível/Grau para despertar e preencher esta habilidade na ficha exclusiva.`
        )
        .join('\n')
}

## 5. Habilidades Já Consolidadas (${developedList.length}/${sections.length})
${developedList.map((d) => `- **[DESENVOLVIDO]** ${d.label}: ${d.currentValue}`).join('\n')}

## 6. Arsenal Amaldiçoado & Votos Vinculativos
- **Arsenal Equipado:** ${
    character.inventory.length > 0
      ? character.inventory.map((i) => `${i.name} (${i.grade}: ${i.effect})`).join(' | ')
      : UNDEVELOPED_MARKER
  }
- **Votos Vinculativos:** ${
    character.bindingVows.length > 0
      ? character.bindingVows
          .map((v) => `${v.name} [${v.active ? 'Ativo' : 'Inativo'}] (${v.condition} => ${v.bonus})`)
          .join(' | ')
      : UNDEVELOPED_MARKER
  }

## 7. Histórico de Modificações e Evoluções na Campanha
${
  history.length === 0
    ? '- [Criação Inicial]: Ficha Exclusiva gerada ao finalizar a criação do personagem.'
    : history
        .slice(-12)
        .map(
          (h) =>
            `- [Turno #${h.turnNumber} · ${h.gradeAtTime} (Nível ${h.levelAtTime})]: **${h.title}** — ${h.details}`
        )
        .join('\n')
}`;
}

export function buildExclusiveCharacterStoryCard(character: CharacterSheet): StoryCard {
  const markdown = character.exclusiveSheetMarkdown || buildExclusiveCharacterSheetMarkdown(character);
  return {
    id: 'player-exclusive-character-sheet',
    title: `📜 Ficha Exclusiva: ${character.name} (${character.grade})`,
    keys: [
      character.name.toLowerCase(),
      'ficha exclusiva',
      'meu personagem',
      'perícias',
      'afinidades',
      character.clan.toLowerCase(),
      character.technique.name.toLowerCase(),
      'não desenvolvido ainda',
      'evolução',
      'nível',
    ].filter(Boolean),
    type: 'character',
    value: markdown,
    source: 'custom',
  };
}

/**
 * Applies XP gained in the turn, processes level-ups within the current Grade category,
 * promotes the character to the next Grade when `levelInCurrentGrade >= levelsRequiredForNextGrade`
 * (e.g. Grau 4: 10 levels -> Grau 3: 15 levels -> Grau 2), and applies any narrative
 * modifications (`sheetEvolution`) to the character's Exclusive Sheet!
 */
export function applyXpAndSheetEvolution(
  character: CharacterSheet,
  turnNumber: number,
  xpGainedRaw?: number,
  levelUpReason?: string,
  sheetEvolution?: SheetEvolutionPatch
): {
  updatedCharacter: CharacterSheet;
  notifications: string[];
} {
  const notifications: string[] = [];
  let nextChar: CharacterSheet = {
    ...character,
    progression: ensureCharacterProgression(character),
    narrativePillars: ensureNarrativePillars(character),
    narrativeSkills: ensureNarrativeSkills(character),
    evolutionHistory: [...(character.evolutionHistory || [])],
  };

  // 1. Process XP & Leveling within Grade Category
  const xpGained = Math.max(0, Math.min(1000, Math.round(Number(xpGainedRaw ?? 0))));
  if (xpGained > 0 && nextChar.progression) {
    let prog = { ...nextChar.progression };
    prog.currentXp += xpGained;

    let levelsEarnedNow = 0;
    while (prog.currentXp >= prog.xpToNextLevel) {
      prog.currentXp -= prog.xpToNextLevel;
      prog.levelInCurrentGrade += 1;
      prog.totalCharacterLevel += 1;
      levelsEarnedNow += 1;

      // Check if reached the required levels in the current Grade category to promote to Next Grade!
      if (
        prog.nextGrade &&
        prog.levelInCurrentGrade >= prog.levelsRequiredForNextGrade
      ) {
        const previousGrade = prog.currentGrade;
        const promotedGrade = prog.nextGrade;
        const newRule = getGradeProgressionRule(promotedGrade);

        prog.currentGrade = newRule.grade;
        prog.levelInCurrentGrade = prog.levelInCurrentGrade - prog.levelsRequiredForNextGrade;
        prog.levelsRequiredForNextGrade = newRule.levelsRequired;
        prog.nextGrade = newRule.nextGrade;
        nextChar.grade = newRule.grade;

        const promoMsg = `PROMOÇÃO DE GRAU OFICIAL! ${nextChar.name} completou os níveis de ${previousGrade} e ascendeu para ${promotedGrade}!`;
        notifications.push(promoMsg);
        nextChar.evolutionHistory = [
          ...(nextChar.evolutionHistory || []),
          {
            id: `evo-grade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            turnNumber,
            timestamp: new Date().toISOString(),
            title: `Promoção de Categoria: ${previousGrade} → ${promotedGrade}`,
            details: `${promoMsg} (${levelUpReason || 'Evolução comprovada em combate'})`,
            gradeAtTime: promotedGrade,
            levelAtTime: prog.totalCharacterLevel,
          },
        ];
      }
    }

    if (levelsEarnedNow > 0 && notifications.length === 0) {
      const lvlMsg = `Nível Subiu! +${levelsEarnedNow} Nível em ${prog.currentGrade} (${prog.levelInCurrentGrade}/${prog.levelsRequiredForNextGrade} para ${prog.nextGrade || 'Maestria'}) — ${
        levelUpReason || `+${xpGained} XP`
      }`;
      notifications.push(lvlMsg);
      nextChar.evolutionHistory = [
        ...(nextChar.evolutionHistory || []),
        {
          id: `evo-lvl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          turnNumber,
          timestamp: new Date().toISOString(),
          title: `Avanço para Nível ${prog.levelInCurrentGrade}/${prog.levelsRequiredForNextGrade} (${prog.currentGrade})`,
          details: levelUpReason || `Experiência de combate acumulada (+${xpGained} XP).`,
          gradeAtTime: prog.currentGrade,
          levelAtTime: prog.totalCharacterLevel,
        },
      ];
    }

    nextChar.progression = prog;
  }

  // 2. Process Story Modifications & Awakening of "Não desenvolvido ainda" sections
  if (sheetEvolution) {
    const cleanStr = (v?: string) =>
      v && v.trim() && v.trim().toLowerCase() !== 'nenhum' && v.trim().toLowerCase() !== 'vazio'
        ? v.trim()
        : undefined;

    const changedFields: string[] = [];
    const nextTech = { ...nextChar.technique };

    if (cleanStr(sheetEvolution.appearance) && sheetEvolution.appearance !== nextChar.appearance) {
      nextChar.appearance = cleanStr(sheetEvolution.appearance)!;
      changedFields.push('Aparência & Aura');
    }
    if (cleanStr(sheetEvolution.backstory) && sheetEvolution.backstory !== nextChar.backstory) {
      nextChar.backstory = cleanStr(sheetEvolution.backstory)!;
      changedFields.push('História & Motivação');
    }
    if (cleanStr(sheetEvolution.combatStyle) && sheetEvolution.combatStyle !== nextChar.combatStyle) {
      nextChar.combatStyle = cleanStr(sheetEvolution.combatStyle)!;
      changedFields.push('Estilo de Combate');
    }
    if (cleanStr(sheetEvolution.techniqueName) && sheetEvolution.techniqueName !== nextTech.name) {
      nextTech.name = cleanStr(sheetEvolution.techniqueName)!;
      changedFields.push(`Técnica Inata (${nextTech.name})`);
    }
    if (
      cleanStr(sheetEvolution.techniqueDescription) &&
      sheetEvolution.techniqueDescription !== nextTech.description
    ) {
      nextTech.description = cleanStr(sheetEvolution.techniqueDescription)!;
      changedFields.push('Descrição da Técnica');
    }
    if (cleanStr(sheetEvolution.lapse) && sheetEvolution.lapse !== nextTech.lapse) {
      nextTech.lapse = cleanStr(sheetEvolution.lapse)!;
      changedFields.push('Lapso da Técnica');
    }
    if (cleanStr(sheetEvolution.reversal) && sheetEvolution.reversal !== nextTech.reversal) {
      nextTech.reversal = cleanStr(sheetEvolution.reversal)!;
      changedFields.push('Reversão da Técnica');
    }
    if (cleanStr(sheetEvolution.maximum) && sheetEvolution.maximum !== nextTech.maximum) {
      nextTech.maximum = cleanStr(sheetEvolution.maximum)!;
      changedFields.push('Técnica Máxima');
    }
    if (cleanStr(sheetEvolution.antiDomain) && sheetEvolution.antiDomain !== nextTech.antiDomain) {
      nextTech.antiDomain = cleanStr(sheetEvolution.antiDomain)!;
      changedFields.push('Defesa Anti-Domínio');
    }
    if (
      cleanStr(sheetEvolution.domainExpansion) &&
      sheetEvolution.domainExpansion !== nextTech.domainExpansion
    ) {
      nextTech.domainExpansion = cleanStr(sheetEvolution.domainExpansion)!;
      if (nextTech.domainPortal) {
        nextTech.domainPortal = {
          ...nextTech.domainPortal,
          domainName: nextTech.domainExpansion.split('—')[0].trim() || nextTech.domainPortal.domainName,
          sureHitEffect: nextTech.domainExpansion,
        };
      }
      changedFields.push('Expansão de Domínio');
    }
    if (sheetEvolution.unlockRct === true && !nextTech.hasRct) {
      nextTech.hasRct = true;
      nextTech.rctStatus = 'Desenvolvido';
      changedFields.push('Técnica Amaldiçoada Reversa (RCT)');
    }
    if (sheetEvolution.skillUpdated && sheetEvolution.skillUpdated.name) {
      const targetName = sheetEvolution.skillUpdated.name.toLowerCase();
      const existingSkills = ensureNarrativeSkills(nextChar);
      const foundIdx = existingSkills.findIndex((s) =>
        s.name.toLowerCase().includes(targetName)
      );
      if (foundIdx >= 0) {
        existingSkills[foundIdx] = {
          ...existingSkills[foundIdx],
          level: sheetEvolution.skillUpdated.newLevel,
        };
      } else {
        existingSkills.push({
          id: `skill-${Date.now()}`,
          name: sheetEvolution.skillUpdated.name,
          category: 'Jujutsu & Barreiras',
          level: sheetEvolution.skillUpdated.newLevel,
          narrativeImpact:
            sheetEvolution.skillUpdated.reason || 'Perícia evoluída durante a campanha.',
        });
      }
      nextChar.narrativeSkills = existingSkills;
      changedFields.push(`Perícia (${sheetEvolution.skillUpdated.name})`);
    }

    // Also support generic sectionUpdated + newValue if the AI populated those
    const secKey = cleanStr(sheetEvolution.sectionUpdated)?.toLowerCase();
    const secVal = cleanStr(sheetEvolution.newValue);
    if (secKey && secVal && changedFields.length === 0) {
      if (secKey.includes('lapso') || secKey.includes('lapse')) {
        nextTech.lapse = secVal;
        changedFields.push('Lapso da Técnica');
      } else if (secKey.includes('revers')) {
        nextTech.reversal = secVal;
        changedFields.push('Reversão da Técnica');
      } else if (secKey.includes('máxima') || secKey.includes('maxima')) {
        nextTech.maximum = secVal;
        changedFields.push('Técnica Máxima');
      } else if (secKey.includes('domínio simples') || secKey.includes('anti')) {
        nextTech.antiDomain = secVal;
        changedFields.push('Defesa Anti-Domínio');
      } else if (secKey.includes('domínio') || secKey.includes('domain')) {
        nextTech.domainExpansion = secVal;
        changedFields.push('Expansão de Domínio');
      } else if (secKey.includes('rct') || secKey.includes('reversa')) {
        nextTech.hasRct = true;
        nextTech.rctStatus = 'Desenvolvido';
        changedFields.push('Técnica Reversa (RCT)');
      } else if (secKey.includes('combate') || secKey.includes('taijutsu')) {
        nextChar.combatStyle = secVal;
        changedFields.push('Estilo de Combate');
      } else if (secKey.includes('história') || secKey.includes('passado')) {
        nextChar.backstory = secVal;
        changedFields.push('História & Passado');
      }
    }

    nextChar.technique = nextTech;

    if (changedFields.length > 0) {
      const evoSummary = `Ficha Exclusiva Atualizada (${changedFields.join(', ')}): ${
        cleanStr(sheetEvolution.reason) || cleanStr(sheetEvolution.newValue) || 'Despertar durante a história!'
      }`;
      notifications.push(evoSummary);
      nextChar.evolutionHistory = [
        ...(nextChar.evolutionHistory || []),
        {
          id: `evo-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          turnNumber,
          timestamp: new Date().toISOString(),
          title: `Despertar / Alteração na Ficha: ${changedFields.join(', ')}`,
          details:
            cleanStr(sheetEvolution.reason) ||
            cleanStr(sheetEvolution.newValue) ||
            'Evolução orgânica registrada pelo Mestre.',
          gradeAtTime: nextChar.grade,
          levelAtTime: nextChar.progression?.totalCharacterLevel || 1,
        },
      ];
    }
  }

  // Regenerate the Exclusive Sheet Markdown so it stays 100% up-to-date
  nextChar.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(nextChar);

  return {
    updatedCharacter: nextChar,
    notifications,
  };
}


