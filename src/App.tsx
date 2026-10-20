import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import {
  ActionMode,
  CampaignState,
  CampaignTurn,
  CharacterSheet,
  FontSizeOption,
  GeminiModelOption,
  NpcInScene,
  StoryCard,
  VisualEffectTrigger,
  WorldStateUpdate,
} from './types/jjk';
import { INITIAL_STORY_CARDS, CANONICAL_TECHNIQUES, STARTING_ARCS } from './data/initialCodex';
import {
  applyNewInventoryItemOrVow,
  applyXpAndSheetEvolution,
  buildExclusiveCharacterSheetMarkdown,
  buildExclusiveCharacterStoryCard,
  ensureCharacterProgression,
  rollD20,
  selectActiveStoryCardsForTurn,
} from './utils/jjkEngine';
import {
  generateCanonicalPortraitSvg,
  generateSceneIllustrationSvg,
} from './utils/svgArtGenerator';
import {
  CAMPAIGN_STORAGE_KEY,
  loadCustomCodexSafe,
  saveCampaignStateSafe,
  saveCustomCodexSafe,
} from './utils/storageManager';
import { LeftSorcererSheet } from './components/LeftSorcererSheet';
import { CenterNarrativeStage } from './components/CenterNarrativeStage';
import { RightWorldRadar } from './components/RightWorldRadar';

// Code-splitting: a ficha (com a galeria de retratos) e o painel de sistema
// só baixam quando o jogador realmente abre cada um.
const CharacterWizard = lazy(() =>
  import('./components/CharacterWizard').then((m) => ({ default: m.CharacterWizard }))
);
const SystemAndCloudPanel = lazy(() =>
  import('./components/SystemAndCloudPanel').then((m) => ({ default: m.SystemAndCloudPanel }))
);
import { jjkAudio } from './utils/soundEffects';
import {
  executeNarrativeTurn,
  generateAnimeImage,
  GeminiConnectionReport,
  streamNarrativeTurn,
  summarizeCampaignMemory,
  validateGeminiConnection,
} from './services/geminiService';
import {
  BookOpen,
  User,
  Eye,
  BookMarked,
  Settings,
  Dices,
  Cloud,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

function createInitialAutostartCampaign(): CampaignState {
  // A demo de autostart (URL ?autostart=1) narra a abertura canônica de
  // Sendai/2018; a campanha criada pelo Wizard usa por padrão o SEGUIMENTO.
  const defaultArc = STARTING_ARCS.find((a) => a.id === 'sendai-2018') ?? STARTING_ARCS[0];
  const character: CharacterSheet = {
    name: 'Ren Fushiguro',
    appearance:
      'Jovem feiticeiro da Escola Técnica de Tóquio em uniforme escuro de gola alta, energia amaldiçoada azul-elétrica crepitando nos punhos.',
    avatarUrl: generateCanonicalPortraitSvg('Ren Fushiguro'),
    faction: 'Feiticeiro Jujutsu (Escola Técnica de Tóquio)',
    clan: 'Clã Zenin / Independente',
    grade: 'Grau 4',
    isHeavenlyRestriction: false,
    hpPercentage: 100,
    cursedEnergyPercentage: 100,
    outputPercentage: 100,
    physicalCondition: 'Intacto — Pronto para Exorcismo',
    techniqueState: 'Ativa',
    inBlackFlashZone: false,
    technique: CANONICAL_TECHNIQUES[0],
    inventory: [
      {
        id: 'tool-katana',
        name: 'Katana Imbuída de Energia Amaldiçoada',
        grade: 'Grau 2',
        effect: 'Lâmina temperada para canalizar cortes precisos de Energia Amaldiçoada.',
        equipped: true,
      },
    ],
    bindingVows: [
      {
        id: 'vow-reveal',
        name: 'Revelar a Própria Mão',
        condition: 'Explicar o funcionamento da Técnica Inata ao oponente.',
        bonus: '+20% de Output de Energia Amaldiçoada na rodada.',
        active: false,
      },
    ],
    evolutionHistory: [
      {
        id: 'evo-autostart',
        turnNumber: 1,
        timestamp: new Date().toISOString(),
        title: 'Ficha Exclusiva Inicializada',
        details: 'Ficha Exclusiva inicializada no Grau 4 (0/10 níveis para Grau 3).',
        gradeAtTime: 'Grau 4',
        levelAtTime: 1,
      },
    ],
  };
  character.progression = ensureCharacterProgression(character);
  character.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(character);

  const world: WorldStateUpdate = {
    location: defaultArc.location,
    arc: defaultArc.arcLabel,
    activeBarrierOrDomain: 'Cortina Ativa',
    missionObjective: defaultArc.objective,
    timelineAnchor: defaultArc.timeline,
    era: defaultArc.era,
    campaignPremise: defaultArc.premise,
    playerRole: defaultArc.playerRole,
    tone: defaultArc.tone,
    mustEstablish: defaultArc.mustEstablish,
    worldFacts: defaultArc.worldFacts,
    forbiddenEvents: defaultArc.forbidden,
    openingScene: defaultArc.scene,
    startingArcTitle: defaultArc.title,
    npcsInScene: defaultArc.initialNpcs.map((n) => ({
      ...n,
      hpPercentage: 100,
      avatarUrl: generateCanonicalPortraitSvg(n.name),
    })),
  };

  const initialTurn: CampaignTurn = {
    id: 'turn-1',
    turnNumber: 1,
    timestamp: new Date().toISOString(),
    gmResponse: {
      engineLog: [
        '1. Checagem de Escala de Poder: Ren Fushiguro (Grau 4) & Megumi Fushiguro (Grau 2) vs. Espírito Amaldiçoado do Pátio (Grau 2) — Cobertura tática aliada equilibra a diferença de Grau.',
        '2. Checagem de Técnica (Lore Check): Técnica das Dez Sombras ativa (Cães Divinos invocados via sombras líquidas | Reserva de EA: 100% | Output: 100%).',
        '3. Psicologia & Estratégia Oculta do NPC: Megumi Fushiguro atua de forma analítica e pragmática para conter a ameaça e proteger o perímetro; a Maldição age por instinto voraz atraída pelo Dedo de Sukuna.',
      ].join('\n'),
      activeStoryCards: [
        'Megumi Fushiguro — Usuário das Dez Sombras',
        'Ryomen Sukuna — O Rei das Maldições',
        'Expansão de Domínio & Técnicas Anti-Domínio',
      ],
      activeCardRuleSummary:
        'Técnica das Dez Sombras (Clã Zenin): Invoca até dez Shikigamis usando sombras como intermediário; se um Shikigami for totalmente destruído, não pode ser invocado novamente, mas seu poder é herdado pelos demais (Totalidade).',
      visualEffectTrigger: 'NONE',
      narrative: `*Narrador*: O relógio da Escola Secundária Municipal Sugisawa marca 23h30 sob uma lua carmesim opressora. Uma Cortina escura desce silenciosamente sobre o pátio úmido, isolando o prédio do mundo exterior. No corredor do segundo andar, a pressão espiritual de um Objeto Amaldiçoado de Grau Especial — um dos vinte dedos de Ryomen Sukuna — atrai um Espírito Amaldiçoado grotesco que estilhaça as janelas de vidro.\n\n*Megumi Fushiguro*: Unindo as mãos no selo dos Cães Divinos enquanto sombras líquidas se erguem ao redor de seus pés, ele olha para você com expressão séria. "A assinatura de energia amaldiçoada do dedo está agitando todas as maldições do distrito. Eu imobilizo a criatura pelas sombras — prepare sua técnica para exorcizá-la antes que ela devore o objeto!"\n\n*Espírito Amaldiçoado do Pátio*: Múltiplos olhos amarelos giram no torso deformado da criatura enquanto ela avança babando energia densa. "Ca... carne... dedo... poder...!"\n\n*Narrador*: O concreto racha sob o avanço da maldição de Grau 2 a poucos metros de você e de Fushiguro. O que você faz?`,
      imagePrompt:
        'Official Jujutsu Kaisen anime keyframe by MAPPA studio, high contrast, Japanese school courtyard at midnight under a crimson moon with Megumi Fushiguro and a sorcerer facing a cursed spirit, no text',
      isCombatScene: true,
      combatSceneImageQuestion:
        'O combate contra o Espírito Amaldiçoado do Pátio na Escola Sugisawa vai começar! Deseja que o Mestre solicite ao Nano Banana uma imagem do início desta cena de combate com os mesmos gráficos do anime?',
      nanoBananaAnimePrompt:
        '🍌 [Solicitação da IA para o Nano Banana — Gráficos Oficiais do Anime Jujutsu Kaisen (Estúdio MAPPA)]: Quadro 16:9 em cel-shading retratando Megumi Fushiguro preparando o selo dos Cães Divinos ao lado de Ren Fushiguro sob a lua carmesim no pátio da Escola Sugisawa, enfrentando o Espírito Amaldiçoado de múltiplos olhos cercado por miasma roxo e faíscas azuis.',
      playerStateUpdate: {
        hpPercentage: 100,
        cursedEnergyPercentage: 100,
        outputPercentage: 100,
        physicalCondition: 'Intacto — Pronto para Exorcismo',
        techniqueState: 'Ativa',
        inBlackFlashZone: false,
      },
      worldStateUpdate: world,
      suggestedActions: [
        'Invocar as Dez Sombras (Nue) em sincronia com Fushiguro para eletrocutar a maldição',
        'Concentrar Energia Amaldiçoada na Katana e avançar visando um Kokusen no núcleo da maldição',
        'Revelar a Própria Mão explicando minha técnica para ganhar +20% de Output imediato',
      ],
    },
    sceneImageUrl: generateSceneIllustrationSvg(defaultArc.location),
    snapshot: {
      character,
      world,
    },
  };

  return {
    id: `campaign_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    character,
    world,
    turns: [initialTurn],
    memories: [],
    customCodex: [],
    npcAvatars: {
      'Megumi Fushiguro': generateCanonicalPortraitSvg('Megumi Fushiguro'),
      'Satoru Gojo': generateCanonicalPortraitSvg('Satoru Gojo'),
      'Ryomen Sukuna': generateCanonicalPortraitSvg('Ryomen Sukuna'),
    },
  };
}

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-[#0b0908] text-amber-100">
      <div className="h-10 w-10 rounded-full border-2 border-amber-500/25 border-t-amber-400 animate-spin" />
      <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/70">{label}</p>
    </div>
  );
}

export default function App() {
  const [campaign, setCampaign] = useState<CampaignState | null>(() => {
    try {
      const saved = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore storage error
    }
    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      return createInitialAutostartCampaign();
    }
    return null;
  });

  const [customCodex, setCustomCodex] = useState<StoryCard[]>([]);
  const [serverCodexCards, setServerCodexCards] = useState<StoryCard[]>([]);

  const [viewMode, setViewMode] = useState<'wizard' | 'vtt'>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      return 'vtt';
    }
    try {
      const saved = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      if (saved) return 'vtt';
    } catch {
      // Ignore
    }
    return 'wizard';
  });

  // Mobile 5-Tab Navigation State
  const [mobileTab, setMobileTab] = useState<'cronica' | 'ficha' | 'radar' | 'codice' | 'sistema'>('cronica');

  // Desktop Collapsible Sidebars & Modals
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [showSystemModal, setShowSystemModal] = useState(false);
  const [lightboxData, setLightboxData] = useState<{ url: string; caption: string } | null>(null);

  // Settings & Tactical State
  const [model, setModel] = useState<GeminiModelOption>('gemini-3.8-flash');
  const [fontSize, setFontSize] = useState<FontSizeOption>('medium');
  const [autoGenerateImages, setAutoGenerateImages] = useState(false);
  const [autoRollDice, setAutoRollDice] = useState(false);
  const [currentDiceRoll, setCurrentDiceRoll] = useState<number>(15);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(true);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('JJK_CUSTOM_GEMINI_KEY') || '';
    } catch {
      return '';
    }
  });
  const [externalActionDraft, setExternalActionDraft] = useState<{
    mode: ActionMode;
    text: string;
    id: number;
  } | null>(null);

  // Async Loading & VFX States
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [streamingNarrative, setStreamingNarrative] = useState('');
  const [isRegeneratingPortrait, setIsRegeneratingPortrait] = useState(false);
  const [generatingNpcName, setGeneratingNpcName] = useState(null as string | null);
  const [isGeneratingImageForTurn, setIsGeneratingImageForTurn] = useState(null as string | null);
  const [isSummarizingMemory, setIsSummarizingMemory] = useState(false);
  const [activeVfx, setActiveVfx] = useState<VisualEffectTrigger>('NONE');
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [recentLootNotification, setRecentLootNotification] = useState<string | null>(null);
  const [geminiReport, setGeminiReport] = useState<GeminiConnectionReport | null>(null);

  // Cloud Auth & Auto-Save State
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [lastCloudSyncIso, setLastCloudSyncIso] = useState<string | null>(null);

  const handleRefreshGeminiStatus = useCallback(async () => {
    const report = await validateGeminiConnection(model);
    setGeminiReport(report);
    if (report.state !== 'VALID') {
      setRateLimitNotice(report.message);
    } else {
      setRateLimitNotice(null);
    }
  }, [model]);

  // Load separated customCodex + 283 Canonical Server Story Cards on mount
  useEffect(() => {
    loadCustomCodexSafe().then((loadedCards) => {
      if (loadedCards.length > 0) {
        setCustomCodex(loadedCards);
      } else if (campaign?.customCodex && campaign.customCodex.length > 0) {
        setCustomCodex(campaign.customCodex);
      }
    });

    fetch('/api/codex/default')
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.cards) && data.cards.length > 0) {
          setServerCodexCards(data.cards);
        }
      })
      .catch(() => {});

    validateGeminiConnection(model)
      .then((report) => {
        setGeminiReport(report);
        if (report.state !== 'VALID') {
          setRateLimitNotice(report.message);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleSfx = useCallback(() => {
    setSfxEnabled((prev) => {
      const next = !prev;
      jjkAudio.enabled = next;
      return next;
    });
  }, []);

  const handleChangeCustomApiKey = useCallback((val: string) => {
    setCustomApiKey(val);
    try {
      localStorage.setItem('JJK_CUSTOM_GEMINI_KEY', val);
    } catch {
      // Ignore
    }
  }, []);

  const handleQuickTargetNpc = useCallback((npcName: string, mode: ActionMode) => {
    const cleanName = npcName.split('—')[0].trim();
    const draftText =
      mode === 'DO'
        ? `Avanço contra ${cleanName} concentrando Energia Amaldiçoada para atacar sua guarda!`
        : `Olho diretamente para ${cleanName} e digo: "`;
    setExternalActionDraft({ mode, text: draftText, id: Date.now() });
    setMobileTab('cronica');
  }, []);

  // Sync document.body.dataset.state for Ultra Mode verification
  useEffect(() => {
    document.body.dataset.state = viewMode === 'vtt' ? 'playing' : 'title';
  }, [viewMode]);

  // Firebase é carregado sob demanda: o SDK (~centenas de KB) não entra no
  // bundle inicial da crônica. O chunk é buscado depois do primeiro paint.
  useEffect(() => {
    // Só baixa o SDK do Firebase quando o jogador abre o painel de nuvem.
    if (!showSystemModal && mobileTab !== 'sistema') return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    import('./services/firebaseClient')
      .then(({ subscribeToAuth }) => {
        if (cancelled) return;
        unsubscribe = subscribeToAuth((user) => {
          setUserEmail(user?.email || null);
        });
      })
      .catch(() => {
        // Sem Firebase disponível: campanha local continua funcionando.
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [showSystemModal, mobileTab]);

  // 5MB-Safe Auto-save to localStorage (campaign without codex) and Cloud (Firebase Firestore)
  useEffect(() => {
    if (!campaign) return;
    saveCampaignStateSafe(campaign);

    if (userEmail) {
      import('./services/firebaseClient')
        .then(({ saveCampaignToCloud }) => saveCampaignToCloud(campaign))
        .then(() => setLastCloudSyncIso(new Date().toISOString()))
        .catch(() => {});
    }
  }, [campaign, userEmail]);

  const handleImportCodexCards = useCallback((newCards: StoryCard[]) => {
    setCustomCodex((prev) => {
      const merged = [...prev, ...newCards];
      saveCustomCodexSafe(merged);
      return merged;
    });
  }, []);

  const triggerVfxEffect = useCallback((vfx: VisualEffectTrigger) => {
    setActiveVfx(vfx);
    if (vfx !== 'NONE') {
      jjkAudio.playForVfx(vfx);
      const timer = setTimeout(() => setActiveVfx('NONE'), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const allCodexCards: StoryCard[] = [
    ...(campaign?.character ? [buildExclusiveCharacterStoryCard(campaign.character)] : []),
    ...INITIAL_STORY_CARDS,
    ...serverCodexCards,
    ...customCodex,
  ];

  const handleGenerateTurnImage = async (
    turnId: string,
    prompt: string,
    vfx?: VisualEffectTrigger
  ) => {
    setIsGeneratingImageForTurn(turnId);
    const targetTurn = campaign?.turns.find((t) => t.id === turnId);
    const referenceImages = campaign
      ? [
          campaign.character.avatarUrl,
          ...campaign.world.npcsInScene
            .map((n) => n.avatarUrl || campaign.npcAvatars[n.name])
            .filter(Boolean),
        ].filter(
          (u) =>
            typeof u === 'string' &&
            (u.startsWith('/portraits/') || u.startsWith('data:image/png') || u.startsWith('data:image/jpeg') || u.startsWith('data:image/webp'))
        )
      : [];
    const charactersInScene = campaign
      ? [
          `${campaign.character.name} (${campaign.character.appearance})`,
          ...campaign.world.npcsInScene.map((n) => n.name),
        ]
      : [];

    try {
      const data = await generateAnimeImage({
        prompt,
        nanoBananaAnimePrompt: targetTurn?.gmResponse.nanoBananaAnimePrompt || '',
        narrativeContext: targetTurn?.gmResponse.narrative || prompt,
        characterSummary: campaign
          ? `${campaign.character.name} (${campaign.character.grade} — ${campaign.character.appearance})`
          : '',
        location: campaign?.world.location || '',
        aspectRatio: '16:9',
        customApiKey,
        referenceImages,
        charactersInScene,
      });

      if (data.ok && data.imageUrl) {
        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            updatedAt: new Date().toISOString(),
            turns: prev.turns.map((t) =>
              t.id === turnId
                ? {
                    ...t,
                    sceneImageUrl: data.imageUrl,
                    nanoBananaGeneratedPromptLog:
                      data.nanoBananaPromptLog ||
                      t.gmResponse.nanoBananaAnimePrompt ||
                      `Cena renderizada no estilo oficial do anime Jujutsu Kaisen (MAPPA) em ${prev.world.location}.`,
                  }
                : t
            ),
          };
        });
      } else {
        setRateLimitNotice(
          data.message ||
            'Não foi possível gerar a imagem da cena agora. Verifique a chave da API Gemini e a cota de imagem.'
        );
      }
    } catch {
      setRateLimitNotice(
        'Falha ao gerar a imagem da cena. Verifique a conexão e a chave da API Gemini.'
      );
    } finally {
      setIsGeneratingImageForTurn(null);
    }
  };

  /**
   * Item #3: Generates Turn #1 (Campaign Opening) dynamically via AI `/api/gemini/turn` with `isOpening: true`
   */
  const handleStartNewCampaignFromWizard = async (
    character: CharacterSheet,
    initialWorld: WorldStateUpdate,
    startingArcTitle: string,
    customOpeningPrompt?: string
  ) => {
    const firstNpc = initialWorld.npcsInScene[0];
    const matchedCards = selectActiveStoryCardsForTurn(
      allCodexCards,
      `${startingArcTitle} ${initialWorld.location} ${character.technique.name} ${customOpeningPrompt || ''}`,
      10,
      initialWorld.era
    );

    const placeholderTurnId = `turn-${Date.now()}`;
    const placeholderTurn: CampaignTurn = {
      id: placeholderTurnId,
      turnNumber: 1,
      timestamp: new Date().toISOString(),
      gmResponse: {
        engineLog: [
          `1. Checagem de Escala de Poder: ${character.name} (${character.grade}) vs. ${firstNpc ? `${firstNpc.name} (${firstNpc.grade})` : 'Presença Amaldiçoada no Perímetro'} — Avaliação de iniciativa e distância tática.`,
          `2. Checagem de Técnica (Lore Check): ${character.technique.name} pronta (Reserva de EA: ${character.isHeavenlyRestriction ? '0% — Restrição Celestial' : `${character.cursedEnergyPercentage}%`} | Output: ${character.outputPercentage}%).`,
          `3. Psicologia & Estratégia Oculta do NPC: ${firstNpc ? `${firstNpc.name} (${firstNpc.attitude}) mantém postura fiel à sua personalidade canônica em ${initialWorld.location}` : 'Anomalia amaldiçoada espreita nas sombras aguardando brecha na guarda'}.`,
        ].join('\n'),
        activeStoryCards: matchedCards.map((c) => c.title),
        activeCardRuleSummary: `${character.technique.name}: ${character.technique.lapse || character.technique.description}`,
        visualEffectTrigger: 'NONE',
        narrative: `*Narrador*: ${
          customOpeningPrompt || 'A atmosfera pesa com resíduos densos de Energia Amaldiçoada enquanto sua jornada começa.'
        } Você está em **${initialWorld.location}** durante o **${initialWorld.arc}**. Seu fluxo espiritual de ${
          character.grade
        } pulsa em prontidão com **${character.technique.name}**.\n\n${
          firstNpc
            ? `*${firstNpc.name}*: Observando sua chegada em ${initialWorld.location} com postura alerta (${firstNpc.status}), analisa sua presença. "${
                firstNpc.attitude === 'Aliado'
                  ? `Você chegou na hora certa, ${character.name}. A pressão da Energia Amaldiçoada aqui está subindo rápido — fique atento à sua retaguarda.`
                  : `Então enviaram mais um feiticeiro... Vamos ver se sua técnica suporta o peso de um verdadeiro confronto!`
              }"`
            : `*Narrador*: As sombras ao redor parecem vivas, denunciando que uma presença amaldiçoada espreita nas proximidades.`
        }\n\n*Narrador*: O cenário está posto diante de você. O que você faz?`,
        imagePrompt: `Official Jujutsu Kaisen anime keyframe by MAPPA studio, high contrast, depicting ${character.name} (${character.appearance}) at ${initialWorld.location}, cursed energy aura, no text`,
        isCombatScene: true,
        combatSceneImageQuestion: `A cena inicial em ${initialWorld.location} começou! Deseja que o Mestre faça uma descrição detalhada solicitando ao Nano Banana uma imagem do início desta cena com os mesmos gráficos do anime?`,
        nanoBananaAnimePrompt: `🍌 [Solicitação da IA para o Nano Banana — Gráficos Oficiais do Anime Jujutsu Kaisen (MAPPA)]: Quadro 16:9 em cel-shading retratando ${character.name} (${character.appearance}) canalizando ${character.technique.name} em ${initialWorld.location} diante de ${firstNpc?.name || 'uma ameaça amaldiçoada'}.`,
        playerStateUpdate: {
          hpPercentage: character.hpPercentage,
          cursedEnergyPercentage: character.cursedEnergyPercentage,
          outputPercentage: character.outputPercentage,
          physicalCondition: character.physicalCondition,
          techniqueState: character.techniqueState,
          inBlackFlashZone: false,
        },
        worldStateUpdate: initialWorld,
        suggestedActions: [
          `Usar ${character.technique.name} para sondar e pressionar a ameaça na área`,
          `Dialogar com ${firstNpc?.name || 'os presentes'} para coordenar uma formação tática`,
          `Concentrar Energia Amaldiçoada nos punhos e avançar buscando um Kokusen`,
        ],
      },
      sceneImageUrl: generateSceneIllustrationSvg(`${initialWorld.location} ${startingArcTitle}`),
      snapshot: {
        character,
        world: initialWorld,
      },
    };

    const newCampaign: CampaignState = {
      id: `campaign_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      character,
      world: initialWorld,
      turns: [placeholderTurn],
      memories: [],
      customCodex: [],
      npcAvatars: {},
    };

    setCampaign(newCampaign);
    setViewMode('vtt');
    setMobileTab('cronica');
    setIsSubmittingTurn(true);

    try {
      const ragContext = matchedCards
        .map((c) => `### ${c.title}\n${c.value}`)
        .join('\n\n');

      const result = await executeNarrativeTurn({
        model,
        character,
        world: initialWorld,
        actionMode: 'STORY',
        // O Turno #1 não é uma ação do jogador: a cena vai no contrato, não no campo de ação.
        actionText: 'Abrir a campanha: narrar o Turno #1 a partir da cena de abertura.',
        diceRoll: 15,
        revealedHandVow: false,
        isOpening: true,
        startingArcTitle,
        customOpeningPrompt,
        ragContext,
        activeCards: matchedCards.map((c) => c.title),
        memoryContext: '',
        recentHistory: '',
        customApiKey,
      });
      if (result.apiKeyState) {
        setGeminiReport({
          state: result.apiKeyState,
          modelTested: result.usedModel || model,
          fallbackActive: Boolean(result.usedFallback),
          message:
            result.statusNotice ||
            (result.apiKeyState === 'VALID'
              ? `Conexão Gemini IA ativa (${result.usedModel || model}).`
              : 'Motor Narrativo de Continuidade ativo.'),
          checkedAt: new Date().toISOString(),
        });
        if (result.apiKeyState !== 'VALID' && result.statusNotice) {
          setRateLimitNotice(result.statusNotice);
        }
      }
      if (result.ok && result.data) {
        const gmData = result.data;
        const wsu = gmData.worldStateUpdate || initialWorld;
        const updatedWorld: WorldStateUpdate = {
          ...initialWorld,
          location: wsu.location || initialWorld.location,
          arc: wsu.arc || initialWorld.arc,
          activeBarrierOrDomain: wsu.activeBarrierOrDomain || initialWorld.activeBarrierOrDomain,
          npcsInScene: (wsu.npcsInScene || initialWorld.npcsInScene).map((n: NpcInScene) => ({
            ...n,
            hpPercentage: typeof n.hpPercentage === 'number' ? n.hpPercentage : 100,
            avatarUrl: n.avatarUrl || generateCanonicalPortraitSvg(n.name),
          })),
        };

        const aiOpeningTurn: CampaignTurn = {
          id: placeholderTurnId,
          turnNumber: 1,
          timestamp: new Date().toISOString(),
          gmResponse: gmData,
          sceneImageUrl: generateSceneIllustrationSvg(
            `${updatedWorld.location} ${gmData.imagePrompt}`,
            gmData.visualEffectTrigger
          ),
          snapshot: {
            character,
            world: updatedWorld,
          },
        };

        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            updatedAt: new Date().toISOString(),
            world: updatedWorld,
            turns: [aiOpeningTurn],
          };
        });
      } else {
        setRateLimitNotice(
          result.errorMessage ||
            result.statusNotice ||
            'O Mestre não devolveu a abertura. A cena modelo permanece e você pode tentar novamente.'
        );
      }
    } catch {
      // Keeps initial opening turn seamlessly if network error occurs
    } finally {
      setIsSubmittingTurn(false);
    }
  };

  const handleSubmitAction = async ({
    mode,
    text,
    revealedHandVow,
  }: {
    mode: ActionMode;
    text: string;
    revealedHandVow: boolean;
  }) => {
    if (!campaign || isSubmittingTurn) return;
    setIsSubmittingTurn(true);
    setRateLimitNotice(null);

    const rollUsed = autoRollDice ? rollD20() : currentDiceRoll;
    if (autoRollDice) {
      if (rollUsed === 20) jjkAudio.playBlackFlash();
      else jjkAudio.playDiceRoll();
    }
    setCurrentDiceRoll(rollUsed);

    // RAG Client-Side Search: Top 8 to 12 Story Cards matching current scene context
    const searchContext = [
      text,
      campaign.world.location,
      campaign.world.arc,
      ...campaign.world.npcsInScene.map((n) => n.name),
      campaign.turns[campaign.turns.length - 1]?.gmResponse.narrative || '',
    ].join(' ');

    const matchedCards = selectActiveStoryCardsForTurn(
      allCodexCards,
      searchContext,
      10,
      campaign.world.era
    );
    const ragContext = matchedCards
      .map((c) => `### ${c.title}\n${c.value}`)
      .join('\n\n');

    const memoryContext = campaign.memories
      .map((m) => `[${m.turnRange}]: ${m.summary}`)
      .join('\n');

    // Item #1: Send the last 8 full turns for deeper narrative and combat continuity
    const recentHistory = campaign.turns
      .slice(-8)
      .map(
        (t) =>
          `Turno #${t.turnNumber}:\nAção do Jogador (${t.playerAction?.mode || 'ABERTURA'}, d20=${
            t.playerAction?.diceRoll ?? '-'
          }): ${t.playerAction?.text || 'Início da Cena'}\nMestre: ${t.gmResponse.narrative}`
      )
      .join('\n---\n');

    try {
      const turnPayload = {
        model,
        character: campaign.character,
        world: campaign.world,
        actionMode: mode,
        actionText: text,
        diceRoll: rollUsed,
        revealedHandVow,
        ragContext,
        activeCards: matchedCards.map((c) => c.title),
        memoryContext,
        recentHistory,
        isOpening: false,
        customApiKey,
      };

      let result;
      setStreamingNarrative('');
      const streamRes = await streamNarrativeTurn(turnPayload, (delta) => {
        setStreamingNarrative((prev) => prev + delta);
      });
      if (streamRes.ok && streamRes.data) {
        result = {
          ok: true,
          usedFallback: false,
          apiKeyState: streamRes.apiKeyState,
          usedModel: streamRes.usedModel,
          switchedFromPrimary: streamRes.switchedFromPrimary,
          data: streamRes.data,
        };
      } else {
        result = await executeNarrativeTurn(turnPayload);
      }
      setStreamingNarrative('');

      if (result.apiKeyState) {
        setGeminiReport({
          state: result.apiKeyState,
          modelTested: result.usedModel || model,
          fallbackActive: Boolean(result.usedFallback),
          message:
            result.statusNotice ||
            (result.apiKeyState === 'VALID'
              ? `Conexão Gemini IA ativa (${result.usedModel || model}).`
              : 'Motor Narrativo de Continuidade ativo.'),
          checkedAt: new Date().toISOString(),
        });
        if (result.apiKeyState !== 'VALID' && result.statusNotice) {
          setRateLimitNotice(result.statusNotice);
        } else if (result.switchedFromPrimary && result.usedModel) {
          setRateLimitNotice(
            `Cota do modelo principal atingida — turno mestrado automaticamente por ${result.usedModel} sem interromper sua campanha.`
          );
        }
      }

      if (!result.ok || !result.data) {
        const failed = result as {
          errorMessage?: string;
          statusNotice?: string;
          message?: string;
        };
        setRateLimitNotice(
          failed.errorMessage ||
            failed.statusNotice ||
            failed.message ||
            'O servidor não devolveu um turno. Verifique o status da IA e tente novamente.'
        );
        return;
      }

      const gmData = result.data;
      const psu = gmData.playerStateUpdate || {};
      const wsu = gmData.worldStateUpdate || campaign.world;

      let updatedCharacter: CharacterSheet = {
        ...campaign.character,
        hpPercentage: Math.max(0, Math.min(100, Number(psu.hpPercentage ?? campaign.character.hpPercentage))),
        cursedEnergyPercentage: campaign.character.isHeavenlyRestriction
          ? 0
          : Math.max(0, Math.min(100, Number(psu.cursedEnergyPercentage ?? campaign.character.cursedEnergyPercentage))),
        outputPercentage: Number(psu.outputPercentage ?? campaign.character.outputPercentage),
        physicalCondition: psu.physicalCondition || campaign.character.physicalCondition,
        techniqueState: psu.techniqueState || campaign.character.techniqueState,
        inBlackFlashZone: Boolean(psu.inBlackFlashZone),
        bindingVows: revealedHandVow
          ? campaign.character.bindingVows.map((v) =>
              v.name.toLowerCase().includes('revelar') ? { ...v, active: true } : v
            )
          : campaign.character.bindingVows,
      };

      // Item #4: Automatically consume `psu.newInventoryItemOrVow` into bindingVows or inventory
      if (psu.newInventoryItemOrVow) {
        const consumed = applyNewInventoryItemOrVow(updatedCharacter, psu.newInventoryItemOrVow);
        updatedCharacter = consumed.updatedCharacter;
        if (consumed.notification) {
          setRecentLootNotification(consumed.notification);
        }
      }

      // Item #5: Apply XP, Level Progression within Current Grade, and Exclusive Character Sheet Evolution
      const xpToGrant =
        typeof psu.xpGained === 'number'
          ? psu.xpGained
          : rollUsed === 20 || gmData.visualEffectTrigger === 'BLACK_FLASH'
          ? 70
          : 35;
      const evolutionResult = applyXpAndSheetEvolution(
        updatedCharacter,
        campaign.turns.length + 1,
        xpToGrant,
        psu.levelUpReason,
        psu.sheetEvolution
      );
      updatedCharacter = evolutionResult.updatedCharacter;
      if (evolutionResult.notifications.length > 0) {
        setRecentLootNotification(evolutionResult.notifications.join(' · '));
      }

      const updatedWorld: WorldStateUpdate = {
        // Mantém era, fatos do mundo, limites, objetivo e cronologia entre turnos.
        ...campaign.world,
        location: wsu.location || campaign.world.location,
        arc: wsu.arc || campaign.world.arc,
        activeBarrierOrDomain: wsu.activeBarrierOrDomain || 'Nenhum',
        npcsInScene: (wsu.npcsInScene || []).map((n: NpcInScene) => {
          const hp = typeof n.hpPercentage === 'number' ? Math.max(0, Math.min(100, n.hpPercentage)) : 100;
          return {
            ...n,
            hpPercentage: hp,
            status: hp === 0 ? 'Exorcizado / Derrotado (0% HP)' : n.status,
            avatarUrl:
              campaign.npcAvatars[n.name] ||
              n.avatarUrl ||
              generateCanonicalPortraitSvg(n.name),
          };
        }),
      };

      const newTurnId = `turn-${Date.now()}`;
      const newTurn: CampaignTurn = {
        id: newTurnId,
        turnNumber: campaign.turns.length + 1,
        timestamp: new Date().toISOString(),
        playerAction: {
          mode,
          text,
          diceRoll: rollUsed,
          revealedHandVow,
        },
        gmResponse: gmData,
        sceneImageUrl: generateSceneIllustrationSvg(
          `${updatedWorld.location} ${gmData.imagePrompt}`,
          gmData.visualEffectTrigger
        ),
        snapshot: {
          character: updatedCharacter,
          world: updatedWorld,
        },
      };

      triggerVfxEffect(gmData.visualEffectTrigger || 'NONE');

      setCampaign((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          character: updatedCharacter,
          world: updatedWorld,
          turns: [...prev.turns, newTurn],
        };
      });

      const userRequestedImageInText =
        /\b(sim|quero.*imagem|gerar.*imagem|gere.*imagem|nano banana|mostrar.*cena|ilustrar)\b/i.test(
          text.trim()
        );

      if (autoGenerateImages || userRequestedImageInText) {
        handleGenerateTurnImage(newTurnId, gmData.imagePrompt, gmData.visualEffectTrigger);
      }
    } finally {
      setIsSubmittingTurn(false);
      setStreamingNarrative('');
    }
  };

  /**
   * Item #5: Unified Retry Last Turn handler shared between Desktop and Mobile views
   */
  const handleRetryLastTurn = () => {
    if (!campaign || isSubmittingTurn) return;
    if (campaign.turns.length === 1) {
      // Re-generate Turn #1 Opening via AI
      handleStartNewCampaignFromWizard(
        campaign.character,
        campaign.world,
        campaign.world.arc
      );
      return;
    }
    const lastTurn = campaign.turns[campaign.turns.length - 1];
    const prevTurn = campaign.turns[campaign.turns.length - 2];
    setCampaign({
      ...campaign,
      character: prevTurn.snapshot.character,
      world: prevTurn.snapshot.world,
      turns: campaign.turns.slice(0, -1),
    });
    if (lastTurn.playerAction) {
      setTimeout(() => {
        handleSubmitAction({
          mode: lastTurn.playerAction!.mode,
          text: lastTurn.playerAction!.text,
          revealedHandVow: Boolean(lastTurn.playerAction!.revealedHandVow),
        });
      }, 50);
    }
  };

  const handleRegeneratePlayerPortrait = async () => {
    if (!campaign) return;
    setIsRegeneratingPortrait(true);
    try {
      const prompt = `Detailed anime character portrait in Jujutsu Kaisen MAPPA studio style of ${campaign.character.name}, ${campaign.character.appearance}, condition: ${campaign.character.physicalCondition}, 1:1 square portrait`;
      const data = await generateAnimeImage({
        prompt,
        aspectRatio: '1:1',
        customApiKey,
        referenceImages: [campaign.character.avatarUrl].filter((u) => typeof u === 'string'),
      });
      if (data.ok && data.imageUrl) {
        setCampaign({
          ...campaign,
          character: { ...campaign.character, avatarUrl: data.imageUrl },
        });
      } else {
        setRateLimitNotice(
          data.message || 'Não foi possível gerar o retrato agora. Verifique a chave/cota da API Gemini.'
        );
      }
    } finally {
      setIsRegeneratingPortrait(false);
    }
  };

  const handleGenerateNpcAvatar = async (npc: NpcInScene) => {
    if (!campaign) return;
    setGeneratingNpcName(npc.name);
    try {
      const data = await generateAnimeImage({
        prompt: npc.visualDescription,
        aspectRatio: '1:1',
        customApiKey,
        charactersInScene: [npc.name],
      });
      if (data.ok && data.imageUrl) {
        const url = data.imageUrl;
        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            npcAvatars: { ...prev.npcAvatars, [npc.name]: url },
          };
        });
      } else {
        setRateLimitNotice(
          data.message || `Não foi possível gerar o retrato de ${npc.name} agora.`
        );
      }
    } finally {
      setGeneratingNpcName(null);
    }
  };

  const handleSummarizeMemory = async () => {
    if (!campaign || campaign.turns.length === 0) return;
    setIsSummarizingMemory(true);
    try {
      const recentTurns = campaign.turns.slice(-10);
      const turnRange = `Turnos #${recentTurns[0].turnNumber} a #${
        recentTurns[recentTurns.length - 1].turnNumber
      }`;
      const turnsText = recentTurns
        .map((t) => `Turno ${t.turnNumber}: ${t.gmResponse.narrative}`)
        .join('\n\n');

      const data = await summarizeCampaignMemory({ turnsText, turnRange, customApiKey });
      if (data.summary) {
        const consolidatedSummary: string = data.summary;
        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            memories: [
              ...prev.memories,
              {
                id: `mem-${Date.now()}`,
                turnRange,
                summary: consolidatedSummary,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        });
      }
    } finally {
      setIsSummarizingMemory(false);
    }
  };

  const handleExportJson = () => {
    if (!campaign) return;
    const fullExport: CampaignState = {
      ...campaign,
      customCodex,
    };
    const blob = new Blob([JSON.stringify(fullExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JJK_Campaign_${campaign.character.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed && parsed.character && parsed.turns) {
        if (Array.isArray(parsed.customCodex) && parsed.customCodex.length > 0) {
          setCustomCodex(parsed.customCodex);
          saveCustomCodexSafe(parsed.customCodex);
        }
        setCampaign({ ...parsed, customCodex: [] });
        setViewMode('vtt');
      }
    } catch {
      // Invalid file
    }
  };

  if (viewMode === 'wizard' || !campaign) {
    return (
      <Suspense fallback={<FullScreenLoader label="Abrindo a ficha de feiticeiro..." />}>
      <>
        <CharacterWizard
          onStartCampaign={handleStartNewCampaignFromWizard}
          onImportJsonFile={handleImportJsonFile}
          hasExistingCampaign={Boolean(campaign)}
          onResumeExisting={() => setViewMode('vtt')}
          onOpenCloudModal={() => setShowSystemModal(true)}
          cloudUserEmail={userEmail}
          customApiKey={customApiKey}
          geminiReport={geminiReport || undefined}
        />

        {showSystemModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-3xl rounded-2xl bg-[#120e0b] border border-amber-500/25 shadow-2xl overflow-hidden">
              <SystemAndCloudPanel
                campaign={campaign}
                model={model}
                onChangeModel={setModel}
                fontSize={fontSize}
                onChangeFontSize={setFontSize}
                onExportJson={handleExportJson}
                onImportJsonFile={handleImportJsonFile}
                onStartNewCampaign={() => setShowSystemModal(false)}
                onLoadCloudCampaign={(loaded) => {
                  setCampaign(loaded);
                  setViewMode('vtt');
                }}
                userEmail={userEmail}
                lastCloudSyncIso={lastCloudSyncIso}
                onCloseModal={() => setShowSystemModal(false)}
                customApiKey={customApiKey}
                onChangeCustomApiKey={handleChangeCustomApiKey}
                sfxEnabled={sfxEnabled}
                onToggleSfx={handleToggleSfx}
                geminiReport={geminiReport}
                onRefreshGeminiStatus={handleRefreshGeminiStatus}
              />
            </div>
          </div>
        )}
      </>
      </Suspense>
    );
  }

  const isNarrativeFocusMode = !leftSidebarOpen && !rightSidebarOpen;

  const handleToggleNarrativeFocusMode = () => {
    if (isNarrativeFocusMode) {
      setLeftSidebarOpen(true);
      setRightSidebarOpen(true);
    } else {
      setLeftSidebarOpen(false);
      setRightSidebarOpen(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col tabletop-surface text-[#efe6d5] overflow-hidden">
      {/* Desktop Top Header (>= 1024px) */}
      <header className="hidden lg:flex items-center justify-between gap-6 px-5 py-2.5 bg-[#110d0b]/95 border-b border-amber-500/25 shrink-0 shadow-lg">
        {/* Zone 1: Left Sheet Toggle + Tabletop Title */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            aria-label={leftSidebarOpen ? 'Recolher Grimório do Feiticeiro' : 'Abrir Grimório do Feiticeiro'}
            title={leftSidebarOpen ? 'Recolher Ficha' : 'Abrir Ficha'}
            className="px-2.5 py-1.5 rounded-lg bg-[#1a1410] border border-amber-500/30 text-amber-200/80 hover:text-amber-100 hover:border-amber-400 flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all"
          >
            {leftSidebarOpen ? <PanelLeftClose className="w-4 h-4 text-amber-400" /> : <PanelLeftOpen className="w-4 h-4 text-amber-400" />}
            <span>Ficha</span>
          </button>
          <span className="font-display text-base font-bold tracking-wider text-amber-100 whitespace-nowrap">
            JUJUTSU KAISEN · SEGUIMENTO
          </span>
        </div>

        {/* Zone 2: Tabletop Narrative Controls */}
        <nav className="flex items-center gap-4 text-xs font-medium text-amber-200/75">
          <button
            type="button"
            onClick={handleToggleNarrativeFocusMode}
            className={`px-3 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              isNarrativeFocusMode
                ? 'bg-amber-600/30 border-amber-400 text-amber-100 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-[#17120e] border-amber-500/25 text-amber-200/80 hover:text-white'
            }`}
            title="Ocultar ou exibir painéis laterais para leitura fluida de tela cheia"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>{isNarrativeFocusMode ? 'Sair do Foco Narrativo' : 'Modo Foco Narrativo'}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('wizard')}
            className="hover:text-amber-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Editar Ficha / Sessão Zero
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="hover:text-amber-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Exportar Crônica (.json)
          </button>
        </nav>

        {/* Zone 3: SFX Toggle + Cloud + Right Sidebar Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleSfx}
            aria-label={sfxEnabled ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros'}
            title={sfxEnabled ? 'Efeitos Sonoros Ativos (Kokusen / Domínio / Dados)' : 'Efeitos Sonoros Silenciados'}
            className={`p-1.5 rounded-lg border cursor-pointer ${
              sfxEnabled
                ? 'bg-[#17120e] border-emerald-500/40 text-emerald-400 hover:text-emerald-300'
                : 'bg-[#17120e] border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {sfxEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowSystemModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer border border-amber-400/40"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>{userEmail ? 'Mesa Sincronizada' : 'Mesa & Nuvem'}</span>
          </button>
          <button
            type="button"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            aria-label={rightSidebarOpen ? 'Recolher Escudo do Mestre' : 'Abrir Escudo do Mestre'}
            title={rightSidebarOpen ? 'Recolher Escudo do Mestre' : 'Abrir Escudo do Mestre (Dados & Códice)'}
            className="px-2.5 py-1.5 rounded-lg bg-[#1a1410] border border-amber-500/30 text-amber-200/80 hover:text-amber-100 hover:border-amber-400 flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all"
          >
            <span>Escudo & Dados</span>
            {rightSidebarOpen ? <PanelRightClose className="w-4 h-4 text-amber-400" /> : <PanelRightOpen className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* Mobile Sticky Mini-Header (< 1024px) */}
      <header className="lg:hidden safe-top flex items-center justify-between gap-2 px-3 py-2 bg-[#110d0b]/95 border-b border-amber-500/25 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-xs font-bold text-white break-words leading-tight">
              {campaign.character.name}
            </span>
            <span className="text-[10px] text-purple-400 font-semibold shrink-0">
              {campaign.character.grade}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 break-words leading-tight">
            {campaign.world.location}
          </div>
        </div>

        {/* Mini HP & CE Bars + Quick 1d20 button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-16 space-y-1">
            <div className="flex justify-between text-[9px] font-mono-tabular">
              <span className="text-emerald-400">HP</span>
              <span>{Math.round(campaign.character.hpPercentage)}%</span>
            </div>
            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${campaign.character.hpPercentage}%` }}
              />
            </div>
          </div>

          <div className="w-16 space-y-1">
            <div className="flex justify-between text-[9px] font-mono-tabular">
              <span className="text-sky-400">EA</span>
              <span>{Math.round(campaign.character.cursedEnergyPercentage)}%</span>
            </div>
            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400"
                style={{ width: `${campaign.character.cursedEnergyPercentage}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const r = rollD20();
              if (r === 20) jjkAudio.playBlackFlash();
              else jjkAudio.playDiceRoll();
              setCurrentDiceRoll(r);
            }}
            aria-label="Rolar 1d20 rápido"
            className="px-2 py-1 rounded-lg bg-[#080605] border border-amber-500/50 text-amber-400 font-mono-tabular text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>{currentDiceRoll}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: 3 Columns on Desktop (>=1024px) | Active Tab on Mobile (<1024px) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Left Column */}
        {leftSidebarOpen && (
          <div className="hidden lg:block w-[320px] shrink-0 h-full">
            <LeftSorcererSheet
              character={campaign.character}
              onUpdateCharacter={(updated) =>
                setCampaign({ ...campaign, character: updated })
              }
              onRegeneratePortrait={handleRegeneratePlayerPortrait}
              isRegeneratingPortrait={isRegeneratingPortrait}
              lastVfx={activeVfx}
              activeBarrierOrDomain={campaign.world.activeBarrierOrDomain}
              onToggleDomainInWorld={(domainLabel) => {
                setCampaign({
                  ...campaign,
                  world: {
                    ...campaign.world,
                    activeBarrierOrDomain: domainLabel,
                  },
                });
                if (/expansão de domínio/i.test(domainLabel)) {
                  triggerVfxEffect('DOMAIN_GOJO');
                }
              }}
            />
          </div>
        )}

        {/* Desktop Center Column */}
        <div className="hidden lg:block flex-1 min-w-0 h-full">
          <CenterNarrativeStage
            character={campaign.character}
            world={campaign.world}
            turns={campaign.turns}
            npcAvatars={campaign.npcAvatars}
            fontSize={fontSize}
            autoGenerateImages={autoGenerateImages}
            onToggleAutoGenerateImages={() => setAutoGenerateImages(!autoGenerateImages)}
            onGenerateTurnImage={handleGenerateTurnImage}
            isGeneratingImageForTurn={isGeneratingImageForTurn}
            onOpenLightbox={(url, caption) => setLightboxData({ url, caption })}
            onSubmitAction={handleSubmitAction}
            isSubmittingTurn={isSubmittingTurn}
            streamingNarrative={streamingNarrative}
            onEditTurnNarrative={(turnId, newText) => {
              setCampaign({
                ...campaign,
                turns: campaign.turns.map((t) =>
                  t.id === turnId
                    ? { ...t, gmResponse: { ...t.gmResponse, narrative: newText } }
                    : t
                ),
              });
            }}
            onRetryLastTurn={handleRetryLastTurn}
            onRewindToTurn={(turnIdx) => {
              const target = campaign.turns[turnIdx];
              if (!target) return;
              setCampaign({
                ...campaign,
                character: target.snapshot.character,
                world: target.snapshot.world,
                turns: campaign.turns.slice(0, turnIdx + 1),
              });
            }}
            activeVfx={activeVfx}
            rateLimitNotice={rateLimitNotice}
            onDismissRateLimitNotice={() => setRateLimitNotice(null)}
            onSwitchToLiteAndRetry={() => {
              setModel('gemini-3.5-flash-lite');
              setRateLimitNotice(null);
            }}
            recentLootNotification={recentLootNotification}
            onDismissLootNotification={() => setRecentLootNotification(null)}
            externalActionDraft={externalActionDraft}
            apiKeyState={geminiReport?.state || 'CHECKING'}
            onOpenSystemModal={() => setShowSystemModal(true)}
            model={model}
            onChangeModel={setModel}
            onChangeFontSize={setFontSize}
            sfxEnabled={sfxEnabled}
            onToggleSfx={handleToggleSfx}
            currentDiceRoll={currentDiceRoll}
            autoRollDice={autoRollDice}
            onToggleAutoRoll={() => setAutoRollDice(!autoRollDice)}
            onManualRollDice={() => {
              const r = rollD20();
              if (r === 20) jjkAudio.playBlackFlash();
              else jjkAudio.playDiceRoll();
              setCurrentDiceRoll(r);
              return r;
            }}
            onResetCampaign={() => setViewMode('wizard')}
          />
        </div>

        {/* Desktop Right Column */}
        {rightSidebarOpen && (
          <div className="hidden lg:block w-[340px] shrink-0 h-full">
            <RightWorldRadar
              character={campaign.character}
              world={campaign.world}
              npcAvatars={campaign.npcAvatars}
              onGenerateNpcAvatar={handleGenerateNpcAvatar}
              generatingNpcName={generatingNpcName}
              currentDiceRoll={currentDiceRoll}
              autoRollDice={autoRollDice}
              onToggleAutoRollDice={() => setAutoRollDice(!autoRollDice)}
              onManualRollDice={setCurrentDiceRoll}
              codexCards={allCodexCards}
              onImportCodexCards={handleImportCodexCards}
              memories={campaign.memories}
              onSummarizeMemory={handleSummarizeMemory}
              isSummarizingMemory={isSummarizingMemory}
              onQuickTargetNpc={handleQuickTargetNpc}
            />
          </div>
        )}

        {/* Mobile Full-Screen Active Tab (< 1024px) */}
        <div className="lg:hidden tablet-drawer relative flex-1 w-full h-full overflow-y-auto md:overflow-hidden">
          <div className={mobileTab === 'cronica' ? 'tablet-center h-full' : 'tablet-center hidden md:block h-full'}>
            <CenterNarrativeStage
              character={campaign.character}
              world={campaign.world}
              turns={campaign.turns}
              npcAvatars={campaign.npcAvatars}
              fontSize={fontSize}
              autoGenerateImages={autoGenerateImages}
              onToggleAutoGenerateImages={() => setAutoGenerateImages(!autoGenerateImages)}
              onGenerateTurnImage={handleGenerateTurnImage}
              isGeneratingImageForTurn={isGeneratingImageForTurn}
              onOpenLightbox={(url, caption) => setLightboxData({ url, caption })}
              onSubmitAction={handleSubmitAction}
              isSubmittingTurn={isSubmittingTurn}
              streamingNarrative={streamingNarrative}
              onEditTurnNarrative={(turnId, newText) => {
                setCampaign({
                  ...campaign,
                  turns: campaign.turns.map((t) =>
                    t.id === turnId
                      ? { ...t, gmResponse: { ...t.gmResponse, narrative: newText } }
                      : t
                  ),
                });
              }}
              onRetryLastTurn={handleRetryLastTurn}
              onRewindToTurn={(turnIdx) => {
                const target = campaign.turns[turnIdx];
                if (!target) return;
                setCampaign({
                  ...campaign,
                  character: target.snapshot.character,
                  world: target.snapshot.world,
                  turns: campaign.turns.slice(0, turnIdx + 1),
                });
              }}
              activeVfx={activeVfx}
              rateLimitNotice={rateLimitNotice}
              onDismissRateLimitNotice={() => setRateLimitNotice(null)}
              onSwitchToLiteAndRetry={() => {
                setModel('gemini-3.5-flash-lite');
                setRateLimitNotice(null);
              }}
              recentLootNotification={recentLootNotification}
              onDismissLootNotification={() => setRecentLootNotification(null)}
              externalActionDraft={externalActionDraft}
              apiKeyState={geminiReport?.state || 'CHECKING'}
              onOpenSystemModal={() => setMobileTab('sistema')}
              model={model}
              onChangeModel={setModel}
              onChangeFontSize={setFontSize}
              sfxEnabled={sfxEnabled}
              onToggleSfx={handleToggleSfx}
              currentDiceRoll={currentDiceRoll}
              autoRollDice={autoRollDice}
              onToggleAutoRoll={() => setAutoRollDice(!autoRollDice)}
              onManualRollDice={() => {
                const r = rollD20();
                if (r === 20) jjkAudio.playBlackFlash();
                else jjkAudio.playDiceRoll();
                setCurrentDiceRoll(r);
                return r;
              }}
              onResetCampaign={() => setViewMode('wizard')}
            />
          </div>

          {mobileTab === 'ficha' && (
            <LeftSorcererSheet
              character={campaign.character}
              onUpdateCharacter={(updated) =>
                setCampaign({ ...campaign, character: updated })
              }
              onRegeneratePortrait={handleRegeneratePlayerPortrait}
              isRegeneratingPortrait={isRegeneratingPortrait}
              lastVfx={activeVfx}
              activeBarrierOrDomain={campaign.world.activeBarrierOrDomain}
              onToggleDomainInWorld={(domainLabel) => {
                setCampaign({
                  ...campaign,
                  world: {
                    ...campaign.world,
                    activeBarrierOrDomain: domainLabel,
                  },
                });
                if (/expansão de domínio/i.test(domainLabel)) {
                  triggerVfxEffect('DOMAIN_GOJO');
                }
                setMobileTab('cronica');
              }}
            />
          )}

          {mobileTab === 'radar' && (
            <RightWorldRadar
              character={campaign.character}
              world={campaign.world}
              npcAvatars={campaign.npcAvatars}
              onGenerateNpcAvatar={handleGenerateNpcAvatar}
              generatingNpcName={generatingNpcName}
              currentDiceRoll={currentDiceRoll}
              autoRollDice={autoRollDice}
              onToggleAutoRollDice={() => setAutoRollDice(!autoRollDice)}
              onManualRollDice={setCurrentDiceRoll}
              codexCards={allCodexCards}
              onImportCodexCards={handleImportCodexCards}
              memories={campaign.memories}
              onSummarizeMemory={handleSummarizeMemory}
              isSummarizingMemory={isSummarizingMemory}
              onQuickTargetNpc={handleQuickTargetNpc}
              forceTab="radar"
            />
          )}

          {mobileTab === 'codice' && (
            <RightWorldRadar
              character={campaign.character}
              world={campaign.world}
              npcAvatars={campaign.npcAvatars}
              onGenerateNpcAvatar={handleGenerateNpcAvatar}
              generatingNpcName={generatingNpcName}
              currentDiceRoll={currentDiceRoll}
              autoRollDice={autoRollDice}
              onToggleAutoRollDice={() => setAutoRollDice(!autoRollDice)}
              onManualRollDice={setCurrentDiceRoll}
              codexCards={allCodexCards}
              onImportCodexCards={handleImportCodexCards}
              memories={campaign.memories}
              onSummarizeMemory={handleSummarizeMemory}
              isSummarizingMemory={isSummarizingMemory}
              onQuickTargetNpc={handleQuickTargetNpc}
              forceTab="codex"
            />
          )}

          {mobileTab === 'sistema' && (
            <Suspense fallback={<div className="p-6 text-xs text-slate-300">Carregando painel de sistema...</div>}>
            <SystemAndCloudPanel
              campaign={campaign}
              model={model}
              onChangeModel={setModel}
              fontSize={fontSize}
              onChangeFontSize={setFontSize}
              onExportJson={handleExportJson}
              onImportJsonFile={handleImportJsonFile}
              onStartNewCampaign={() => setViewMode('wizard')}
              onLoadCloudCampaign={(loaded) => {
                setCampaign(loaded);
                setMobileTab('cronica');
              }}
              userEmail={userEmail}
              lastCloudSyncIso={lastCloudSyncIso}
              customApiKey={customApiKey}
              onChangeCustomApiKey={handleChangeCustomApiKey}
              sfxEnabled={sfxEnabled}
              onToggleSfx={handleToggleSfx}
              geminiReport={geminiReport}
              onRefreshGeminiStatus={handleRefreshGeminiStatus}
            />
            </Suspense>
          )}
        </div>
      </div>

      {/* Mobile Native-App Bottom Navigation Bar (5 Tabs, min-height 48px) */}
      <nav
        aria-label="Navegação Principal Mobile"
        className="lg:hidden safe-bottom grid grid-cols-5 items-center bg-[#110d0b]/95 border-t border-amber-500/25 shrink-0"
      >
        {(
          [
            { id: 'cronica', label: 'Crônica', icon: BookOpen },
            { id: 'ficha', label: 'Ficha', icon: User },
            { id: 'radar', label: 'Radar', icon: Eye },
            { id: 'codice', label: 'Códice', icon: BookMarked },
            { id: 'sistema', label: 'Sistema', icon: Settings },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                isActive ? 'text-amber-300 bg-amber-500/10' : 'text-amber-200/55 hover:text-amber-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Desktop System & Cloud Modal */}
      {showSystemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-[#120e0b] border border-amber-500/25 shadow-2xl overflow-hidden">
            <Suspense fallback={<div className="p-6 text-xs text-slate-300">Carregando painel de sistema...</div>}>
            <SystemAndCloudPanel
              campaign={campaign}
              model={model}
              onChangeModel={setModel}
              fontSize={fontSize}
              onChangeFontSize={setFontSize}
              onExportJson={handleExportJson}
              onImportJsonFile={handleImportJsonFile}
              onStartNewCampaign={() => setViewMode('wizard')}
              onLoadCloudCampaign={(loaded) => setCampaign(loaded)}
              userEmail={userEmail}
              lastCloudSyncIso={lastCloudSyncIso}
              onCloseModal={() => setShowSystemModal(false)}
              customApiKey={customApiKey}
              onChangeCustomApiKey={handleChangeCustomApiKey}
              sfxEnabled={sfxEnabled}
              onToggleSfx={handleToggleSfx}
              geminiReport={geminiReport}
              onRefreshGeminiStatus={handleRefreshGeminiStatus}
            />
            </Suspense>
          </div>
        </div>
      )}

      {/* Scene Lightbox Modal */}
      {lightboxData && (
        <div
          onClick={() => setLightboxData(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full space-y-3"
          >
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-display font-bold">{lightboxData.caption}</span>
              <button
                type="button"
                onClick={() => setLightboxData(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxData.url}
              alt={lightboxData.caption}
              referrerPolicy="no-referrer"
              className="w-full rounded-2xl border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
