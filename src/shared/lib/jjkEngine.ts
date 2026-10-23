import {
  UNDEVELOPED_MARKER,
  type StoryCard,
  type CharacterSheet,
  type EvolutionHistoryEntry,
  type SheetEvolutionPatch,
} from '@/shared/types/jjk';
import { inferStoryCardEra, isStoryCardAllowedForEra } from '@/shared/lib/storyCardEra';

/**
 * Client-Side RAG Story Card Selector (Zero-Hallucination Lore Injection)
 * Finds the Top 8 to 12 Story Cards matching the current turn context.
 */
export function selectActiveStoryCardsForTurn(
  cards: StoryCard[],
  contextText: string,
  maxCards = 10,
  era?: 'canon' | 'sequel'
): StoryCard[] {
  if (!cards || cards.length === 0) return [];

  // Em campanha de seguimento, cards de evento de 2018 (Jogo do Abate,
  // Incidente de Shibuya, etc.) não entram: eles fariam o Mestre narrar o
  // passado como se fosse o presente. Personagens, técnicas e locais seguem.
  const pool = era ? cards.filter((card) => isStoryCardAllowedForEra(card, era)) : cards;
  const normalizedContext = contextText.toLowerCase();

  const scored = pool.map((card, index) => {
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
    if (era === 'sequel' && inferStoryCardEra(card) === 'sequel') {
      score += 2;
    }

    return { card, score, index };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const matched = scored.filter((item) => item.score > 0).slice(0, maxCards);
  if (matched.length > 0) {
    return matched.map((m) => m.card);
  }

  // Sem match textual: prefere lore/técnica reutilizável, nunca um evento
  // canônico que a campanha de seguimento não está vivendo.
  const fallbackPool = pool.filter((card) =>
    ['lore', 'technique', 'domain', 'faction'].includes(card.type)
  );
  return (fallbackPool.length > 0 ? fallbackPool : pool).slice(0, Math.min(8, maxCards));
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

/**
 * Generates the Exclusive Living Character Sheet Markdown (`exclusiveSheetMarkdown`)
 * which is consulted by the AI GM on every turn and automatically updated whenever
 * the character levels up, promotes Grade, or unlocks an undeveloped section.
 */
/**
 * Monta a Ficha Exclusiva Viva em Markdown. É um documento de ficção para o
 * Mestre: personalidade, técnica, limites e histórico. Não existem atributos,
 * perícias, HP, energia, níveis ou XP — o Mestre decide o peso dramático.
 */
export function buildExclusiveCharacterSheetMarkdown(character: CharacterSheet): string {
  const sections = inspectCharacterDevelopmentSections(character);
  const undevelopedList = sections.filter((s) => s.isUndeveloped);
  const developedList = sections.filter((s) => !s.isUndeveloped);
  const history = character.evolutionHistory || [];

  const hr = character.heavenlyRestriction;
  const hrLine = hr && hr.type !== 'nenhuma'
    ? `SIM — ${
        hr.type === 'fisica'
          ? 'Física Absoluta (corpo sobre-humano, sem energia amaldiçoada)'
          : hr.type === 'espiritual'
          ? 'Espiritual Extrema (corpo frágil / percepção espiritual ampliada)'
          : 'Parcial (troca intermediária)'
      }`
    : 'Não';

  return `# 📜 FICHA EXCLUSIVA VIVA DO PERSONAGEM (RPG NARRATIVO JUJUTSU): ${character.name.toUpperCase()}
> **Orientação ao Mestre:** esta ficha é referência de ficção, não uma ficha de mesa. Não há atributos, perícias, HP, energia amaldiçoada medida, dados, níveis ou XP. Decida o que acontece pela lógica da cena, pelos limites da técnica e pelas escolhas do jogador. O personagem enfraquece, se fere ou morre quando a história exigir — e o mesmo vale para os inimigos.
- **Grau Atual (prestígio na ficção):** ${character.grade}
- **Condição Física/Emocional:** ${character.physicalCondition || 'Intacto'}
- **Facção / Origem:** ${character.faction} · **Clã / Antecedente:** ${character.clan}
- **Clã (Linhagem):** ${character.clanStatus || 'Independente'} — ${character.clanTrait || 'Sem traço genético definido'} | ${character.clanTradition || 'Tradição a definir na campanha.'}
- **Filosofia / Alinhamento Jujutsu:** ${character.alignmentPhilosophy || 'Pragmático / Leal aos Aliados'}
- **Restrição Celestial (Tenshin Jubaku):** ${hrLine}${hr && hr.type !== 'nenhuma' ? ` — Preço: ${hr.price || 'a definir'} | Benefício: ${hr.benefit || 'a definir'}` : ''}

## 1. Identidade, Psicologia e Estilo Marcial
- **Aparência Física e Aura:** ${character.appearance || UNDEVELOPED_MARKER}
- **Traços de Personalidade:** ${character.personalityTraits || 'Determinado sob pressão, atento aos companheiros.'}
- **Ideais & Motivação:** ${character.ideals || 'Proteger os seus e superar os limites do próprio Jujutsu.'}
- **Vínculos (Bonds):** ${character.bonds || character.clan}
- **Defeitos & Fragilidades Psicológicas (Flaws):** ${character.flaws || 'Assume riscos extremos quando aliados estão em perigo.'}
- **História de Origem Completa:** ${character.backstory || UNDEVELOPED_MARKER}
- **Estilo de Combate & Taijutsu:** ${character.combatStyle || UNDEVELOPED_MARKER}

## 2. Técnica Amaldiçoada Inata & Extensões
- **Nome da Técnica Inata:** ${character.technique.name || UNDEVELOPED_MARKER}
- **Funcionamento e Regras:** ${character.technique.description || UNDEVELOPED_MARKER}
- **Condições de Ativação / Limitações:** ${character.technique.activationConditions || 'Padrão'}
- **Lapso (Aplicação Padrão / Azul):** ${character.technique.lapse || UNDEVELOPED_MARKER}
- **Reversão da Técnica (Energia Positiva / Vermelho):** ${character.technique.reversal || UNDEVELOPED_MARKER}
- **Técnica Máxima (Aplicação Suprema):** ${character.technique.maximum || UNDEVELOPED_MARKER}
- **Técnica Amaldiçoada Reversa (RCT):** ${
    character.technique.hasRct
      ? 'Desenvolvida (cura com energia positiva)'
      : character.technique.rctStatus || UNDEVELOPED_MARKER
  }
- **Defesa Anti-Domínio:** ${character.technique.antiDomain || UNDEVELOPED_MARKER}
- **Expansão de Domínio (Ryōiki Tenkai):** ${character.technique.domainExpansion || UNDEVELOPED_MARKER}

## 3. Seções "Não desenvolvido ainda" (ganchos de despertar na história)
${
  undevelopedList.length === 0
    ? '- Todas as seções principais já foram desenvolvidas.'
    : undevelopedList
        .map(
          (u) =>
            `- **[NÃO DESENVOLVIDO AINDA]** ${u.label}: pode despertar em treino, trauma, combate de vida ou morte ou escolha dramática — nunca por acumular pontos.`
        )
        .join('\n')
}

## 4. Habilidades Já Consolidadas (${developedList.length}/${sections.length})
${developedList.map((d) => `- **[DESENVOLVIDO]** ${d.label}: ${d.currentValue}`).join('\n')}

## 5. Arsenal Amaldiçoado & Votos Vinculativos
- **Arsenal Equipado:** ${
    character.inventory.length > 0
      ? character.inventory.map((i) => `${i.name} (${i.grade}: ${i.effect})`).join(' | ')
      : 'Nenhum equipamento inicial.'
  }
- **Votos Vinculativos:** ${
    character.bindingVows.length > 0
      ? character.bindingVows
          .map((v) => `${v.name} [${v.active ? 'Ativo' : 'Inativo'}] (${v.condition} => ${v.bonus})`)
          .join(' | ')
      : 'Nenhum voto inicial.'
  }

## 6. Histórico de Modificações e Evoluções na Campanha
${
  history.length === 0
    ? '- [Criação Inicial]: Ficha Exclusiva gerada ao finalizar a criação do personagem.'
    : history
        .slice(-12)
        .map((h) => `- [Turno #${h.turnNumber} · ${h.gradeAtTime}]: **${h.title}** — ${h.details}`)
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
      character.clan.toLowerCase(),
      character.technique.name.toLowerCase(),
      'não desenvolvido ainda',
      'evolução',
    ].filter(Boolean),
    type: 'character',
    value: markdown,
    source: 'custom',
  };
}

/**
 * Aplica mudanças narrativas à Ficha Exclusiva (despertar de técnica, novo
 * estilo, mudança de prestígio/grau, cicatriz etc.). Não concede XP nem sobe
 * níveis: a evolução é decidida pela ficção.
 */
export function applySheetEvolution(
  character: CharacterSheet,
  turnNumber: number,
  sheetEvolution?: SheetEvolutionPatch
): {
  updatedCharacter: CharacterSheet;
  notifications: string[];
} {
  const notifications: string[] = [];
  const nextChar: CharacterSheet = {
    ...character,
    evolutionHistory: [...(character.evolutionHistory || [])],
  };

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
    if (cleanStr(sheetEvolution.grade) && sheetEvolution.grade !== nextChar.grade) {
      nextChar.grade = cleanStr(sheetEvolution.grade)!;
      changedFields.push(`Grau (${nextChar.grade})`);
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

    // Compatibilidade: o Mestre pode devolver sectionUpdated + newValue.
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
      const evoSummary = `Ficha Exclusiva atualizada (${changedFields.join(', ')}): ${
        cleanStr(sheetEvolution.reason) || cleanStr(sheetEvolution.newValue) || 'Mudança consolidada na história.'
      }`;
      notifications.push(evoSummary);
      nextChar.evolutionHistory = [
        ...(nextChar.evolutionHistory || []),
        {
          id: `evo-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          turnNumber,
          timestamp: new Date().toISOString(),
          title: `Mudança na Ficha: ${changedFields.join(', ')}`,
          details:
            cleanStr(sheetEvolution.reason) ||
            cleanStr(sheetEvolution.newValue) ||
            'Evolução orgânica registrada pelo Mestre.',
          gradeAtTime: nextChar.grade,
        },
      ];
    }
  }

  nextChar.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(nextChar);

  return {
    updatedCharacter: nextChar,
    notifications,
  };
}
