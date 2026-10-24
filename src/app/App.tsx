import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@/shared/types/jjk';
import type { ProviderSpec } from '@/shared/types/provider';
import { INITIAL_STORY_CARDS, CANONICAL_TECHNIQUES, STARTING_ARCS } from '@/shared/data/initialCodex';
import {
  applyNewInventoryItemOrVow,
  applySheetEvolution,
  buildExclusiveCharacterSheetMarkdown,
  buildExclusiveCharacterStoryCard,
  selectActiveStoryCardsForTurn,
} from '@/shared/lib/jjkEngine';
import {
  generateCanonicalPortraitSvg,
  generateSceneIllustrationSvg,
} from '@/features/character/lib/svgArtGenerator';
import {
  CAMPAIGN_STORAGE_KEY,
  loadCustomCodexSafe,
  migrateCampaignToNarrative,
  saveCampaignStateSafe,
  saveCustomCodexSafe,
} from '@/shared/lib/storageManager';
import {
  formatMemoryContext,
  appendMemory,
} from '@/features/narrative/lib/campaignMemory';
import { HomePage } from '@/pages/home/HomePage';
import { CodexPage } from '@/pages/codex/CodexPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { CharacterProfilePage } from '@/pages/character/CharacterProfilePage';
import { ChroniclePage } from '@/pages/chronicle/ChroniclePage';
import { EditorialDialog } from '@/widgets/editorial/EditorialDialog';

// Code-splitting: a ficha (com a galeria de retratos) só baixa
// quando o jogador realmente abre.
const CharacterWizard = lazy(() =>
  import('@/pages/character/CharacterWizard').then((m) => ({ default: m.CharacterWizard }))
);
import { jjkAudio } from '@/features/character/lib/soundEffects';
import {
  executeNarrativeTurn,
  generateAnimeImage,
  GeminiConnectionReport,
  streamNarrativeTurn,
  summarizeCampaignMemory,
  validateGeminiConnection,
} from '@/features/narrative/lib/geminiService';
import {
  BookOpen,
  Settings,
  Home,
  Feather,
  Archive,
} from 'lucide-react';

type AppView = 'home' | 'chronicle' | 'character' | 'codex' | 'settings';

function createInitialAutostartCampaign(): CampaignState {
  // A demo de autostart (URL ?autostart=1) narra a abertura canônica de
  // Sendai/2018; a campanha criada pelo Wizard usa por padrão o SEGUIMENTO.
  const defaultArc = STARTING_ARCS.find((a) => a.id === 'sendai-2018') ?? STARTING_ARCS[0];
  const character: CharacterSheet = {
    name: 'Ren Fushiguro',
    age: '16',
    appearance:
      'Jovem feiticeiro da Escola Técnica de Tóquio em uniforme escuro de gola alta, energia amaldiçoada azul-elétrica crepitando nos punhos.',
    backstory:
      'Cresceu em Adachi ouvindo que o céu de Shinjuku tinha sido um acidente. Entrou na escola depois de ver uma maldição devorar o vizinho — e desde então trata cada exorcismo como uma dívida pessoal.',
    combatStyle:
      'Controle de distância média, leitura de terreno e vetores; prefere encurralar a maldição a trocar golpes no aberto.',
    alignmentPhilosophy: 'Proteger quem não pode lutar, mesmo quando a escola manda recuar.',
    personalityTraits: 'Teimoso, atento, fala pouco quando está com medo.',
    ideals: 'Ninguém deveria morrer porque a burocracia demorou.',
    bonds: 'A mãe, que ainda acha que ele estuda em um colégio interno.',
    flaws: 'Confunde teimosia com coragem.',
    clanTrait: 'Sombras líquidas que respondem ao medo antes da técnica.',
    clanTradition: 'Uma linhagem menor que sobreviveu escondendo o próprio nome.',
    clanStatus: 'Independente',
    avatarUrl: generateCanonicalPortraitSvg('Ren Fushiguro'),
    faction: 'Feiticeiro Jujutsu (Escola Técnica de Tóquio)',
    clan: 'Clã Zenin / Independente',
    grade: 'Grau 4',
    isHeavenlyRestriction: false,
    physicalCondition: 'Intacto — Pronto para o primeiro exorcismo',
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
        bonus: 'A técnica se torna mais eficaz na ficção porque o oponente agora conhece (e pode explorar) o seu funcionamento.',
        active: false,
      },
    ],
    evolutionHistory: [
      {
        id: 'evo-autostart',
        turnNumber: 1,
        timestamp: new Date().toISOString(),
        title: 'Ficha Exclusiva Inicializada',
        details: 'Ficha Exclusiva inicializada no Grau 4 como ponto de partida narrativo.',
        gradeAtTime: 'Grau 4',
      },
    ],
  };
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
      avatarUrl: generateCanonicalPortraitSvg(n.name),
    })),
  };

  const initialTurn: CampaignTurn = {
    id: 'turn-1',
    turnNumber: 1,
    timestamp: new Date().toISOString(),
    gmResponse: {
      engineLog: [
        '1. A cena estabelece o pátio da Escola Sugisawa sob a Cortina, com o Dedo de Sukuna como isca e uma maldição de Grau 2 atraída pela pressão espiritual.',
        '2. Megumi quer conter a criatura e proteger o perímetro; a maldição age por fome e instinto, sem perceber que está sendo encurralada.',
        '3. Fica em suspenso se o jogador vai atacar de imediato, coordenar com Megumi ou tentar entender por que o dedo está ali.',
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
        physicalCondition: 'Intacto — Pronto para o primeiro exorcismo',
      },
      worldStateUpdate: world,
      suggestedActions: [
        'Invocar as Dez Sombras (Nue) em sincronia com Fushiguro para eletrocutar a maldição',
        'Concentrar Energia Amaldiçoada na Katana e avançar visando o núcleo da maldição',
        'Revelar a Própria Mão explicando minha técnica para mudar o equilíbrio da cena',
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
      if (saved) return migrateCampaignToNarrative(JSON.parse(saved));
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

  const [appView, setAppView] = useState<AppView>(() =>
    typeof window !== 'undefined' && window.location.search.includes('autostart=1')
      ? 'chronicle'
      : 'home'
  );
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [lightboxData, setLightboxData] = useState<{ url: string; caption: string } | null>(null);

  // Settings & Tactical State
  const [model, setModel] = useState<GeminiModelOption>('gemini-3.8-flash');
  const [provider, setProvider] = useState<ProviderSpec>(() => {
    try {
      const raw = localStorage.getItem('JJK_PROVIDER_SPEC');
      if (raw) {
        const parsed = JSON.parse(raw) as ProviderSpec;
        if (parsed && typeof parsed.id === 'string') return parsed;
      }
    } catch {
      // storage indisponivel ou JSON invalido: usa o padrao
    }
    return { id: 'gemini', model: 'gemini-3.8-flash', apiKey: '', baseUrl: '' };
  });
  const [fontSize, setFontSize] = useState<FontSizeOption>('medium');
  const [autoGenerateImages, setAutoGenerateImages] = useState(false);
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

  // Persiste a escolha de provedor (chave fica apenas no navegador).
  useEffect(() => {
    try {
      localStorage.setItem('JJK_PROVIDER_SPEC', JSON.stringify(provider));
    } catch {
      // storage indisponivel: a escolha vale apenas para a sessao
    }
  }, [provider]);

  /** Spec do provedor enviado ao servidor; ausente quando o Gemini narracao. */
  const providerSpecForRequest = useMemo<ProviderSpec | undefined>(() => {
    if (!provider || provider.id === 'gemini') return undefined;
    return {
      id: provider.id,
      model: provider.model || '',
      apiKey: provider.apiKey || '',
      baseUrl: provider.baseUrl || '',
    };
  }, [provider]);

  const handleRefreshGeminiStatus = useCallback(async () => {
    const report = await validateGeminiConnection(model, customApiKey, providerSpecForRequest);
    setGeminiReport(report);
    if (report.state !== 'VALID') {
      setRateLimitNotice(report.message);
    } else {
      setRateLimitNotice(null);
    }
  }, [model, customApiKey, providerSpecForRequest]);

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

    validateGeminiConnection(model, customApiKey, providerSpecForRequest)
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
    setAppView('chronicle');
  }, []);

  // Sync document.body.dataset.state for verification
  useEffect(() => {
    document.body.dataset.state = appView === 'chronicle' ? 'playing' : 'title';
  }, [appView]);

  // Auto-save local da crônica (sem codex, que é guardado à parte).
  useEffect(() => {
    if (!campaign) return;
    saveCampaignStateSafe(campaign);
  }, [campaign]);

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
    ...INITIAL_STORY_CARDS.map((card) => ({ ...card, source: card.source ?? 'initial' })),
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
          `1. A cena abre em ${initialWorld.location}, com ${firstNpc ? `${firstNpc.name} (${firstNpc.grade})` : 'uma presença amaldiçoada'} já em cena.`,
          `2. ${character.name} carrega ${character.technique.name}; a técnica tem limites claros e um custo dramático que a cena pode cobrar.`,
          `3. ${firstNpc ? `${firstNpc.name} age conforme sua personalidade e seus próprios objetivos` : 'Algo espreita nas sombras, aguardando a primeira brecha'}; o que ficará em suspenso é a reação do jogador.`,
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
          physicalCondition: character.physicalCondition,
        },
        worldStateUpdate: initialWorld,
        suggestedActions: [
          `Usar ${character.technique.name} para sondar e pressionar a ameaça na área`,
          `Dialogar com ${firstNpc?.name || 'os presentes'} para coordenar uma formação tática`,
          `Mudar o ritmo da cena e forçar uma abertura`,
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
    setAppView('chronicle');
    setIsCreatingCharacter(false);
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
        revealedHandVow: false,
        isOpening: true,
        startingArcTitle,
        customOpeningPrompt,
        ragContext,
        activeCards: matchedCards.map((c) => c.title),
        memoryContext: '',
        recentHistory: '',
        customApiKey,
        provider: providerSpecForRequest,
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

    const memoryContext = formatMemoryContext(campaign.memories);

    // Item #1: Send the last 12 full turns for deeper narrative and combat continuity
    const recentHistory = campaign.turns
      .slice(-12)
      .map(
        (t) =>
          `Turno #${t.turnNumber}:\nAção do Jogador (${t.playerAction?.mode || 'ABERTURA'}): ${
            t.playerAction?.text || 'Início da Cena'
          }\nMestre: ${t.gmResponse.narrative}`
      )
      .join('\n---\n');

    try {
      const turnPayload = {
        model,
        character: campaign.character,
        world: campaign.world,
        actionMode: mode,
        actionText: text,
        revealedHandVow,
        ragContext,
        activeCards: matchedCards.map((c) => c.title),
        memoryContext,
        recentHistory,
        isOpening: false,
        customApiKey,
        provider: providerSpecForRequest,
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
        throw new Error(failed.errorMessage || failed.message || 'Falha no servidor');
      }

      const gmData = result.data;
      const psu = gmData.playerStateUpdate || {};
      const wsu = gmData.worldStateUpdate || campaign.world;

      let updatedCharacter: CharacterSheet = {
        ...campaign.character,
        physicalCondition: psu.physicalCondition || campaign.character.physicalCondition,
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

      // Item #5: apply narrative changes to the Living Sheet (no XP, no levels)
      const evolutionResult = applySheetEvolution(
        updatedCharacter,
        campaign.turns.length + 1,
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
        npcsInScene: (wsu.npcsInScene || []).map((n: NpcInScene) => ({
          ...n,
          avatarUrl:
            campaign.npcAvatars[n.name] ||
            n.avatarUrl ||
            generateCanonicalPortraitSvg(n.name),
        })),
      };

      const newTurnId = `turn-${Date.now()}`;
      const newTurn: CampaignTurn = {
        id: newTurnId,
        turnNumber: campaign.turns.length + 1,
        timestamp: new Date().toISOString(),
        playerAction: {
          mode,
          text,
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
    } catch (error) {
      setRateLimitNotice(
        error instanceof Error
          ? `Não foi possível concluir o turno: ${error.message}`
          : 'Não foi possível concluir o turno. Tente novamente.'
      );
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
            memories: appendMemory(prev.memories, {
              turnRange,
              summary: consolidatedSummary,
            }),
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
        const migrated = migrateCampaignToNarrative({ ...parsed, customCodex: [] });
        if (migrated) setCampaign(migrated);
        setAppView('chronicle');
      }
    } catch {
      // Invalid file
    }
  };

  const handleNavigate = (view: AppView) => {
    if (view === 'character' && campaign) setIsCreatingCharacter(false);
    if (view === 'chronicle' && !campaign) {
      setIsCreatingCharacter(true);
      setAppView('character');
      return;
    }
    setAppView(view);
  };

  const handleNewCharacter = () => {
    setIsCreatingCharacter(true);
    setAppView('character');
  };

  const handleDeleteCampaign = () => {
    if (!campaign) return;
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm('Apagar esta crônica? O personagem, os turnos e a memória serão removidos.');
    if (!confirmed) return;
    try {
      localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
    } catch {
      // Ignore storage failure
    }
    setCampaign(null);
    setAppView('home');
    setIsCreatingCharacter(false);
  };

  const navItems: { id: AppView; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'chronicle', label: 'Mesa', icon: BookOpen },
    { id: 'character', label: 'Ficha', icon: Feather },
    { id: 'codex', label: 'Códice', icon: Archive },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  const contextLabel =
    appView === 'home'
      ? 'Crônica narrativa'
      : appView === 'chronicle'
      ? campaign
        ? `Em andamento · ${campaign.character.name}`
        : 'Crônica narrativa'
      : appView === 'character'
      ? campaign && !isCreatingCharacter
        ? 'Ficha do feiticeiro'
        : 'Nova ficha'
      : appView === 'codex'
      ? `${allCodexCards.length} verbetes`
      : 'Preferências';

  const renderContent = () => {
    if (appView === 'home') {
      return (
        <HomePage
          hasCampaign={Boolean(campaign)}
          characterName={campaign?.character.name}
          onStartCharacter={handleNewCharacter}
          onContinue={() => setAppView('chronicle')}
          onOpenCodex={() => setAppView('codex')}
        />
      );
    }

    if (appView === 'character') {
      if (!campaign || isCreatingCharacter) {
        return (
          <Suspense fallback={<FullScreenLoader label="Abrindo a ficha de feiticeiro..." />}>
            <CharacterWizard
              onStartCampaign={handleStartNewCampaignFromWizard}
              onImportJsonFile={handleImportJsonFile}
              hasExistingCampaign={Boolean(campaign)}
              onResumeExisting={() => setAppView('chronicle')}
              onOpenCloudModal={() => setAppView('settings')}
              customApiKey={customApiKey}
              geminiReport={geminiReport || undefined}
            />
          </Suspense>
        );
      }
      return (
        <CharacterProfilePage
          campaign={campaign}
          onContinue={() => setAppView('chronicle')}
          onNewCharacter={handleNewCharacter}
          onOpenCodex={() => setAppView('codex')}
        />
      );
    }

    if (appView === 'codex') {
      return <CodexPage cards={allCodexCards} onImportCodexCards={handleImportCodexCards} />;
    }

    if (appView === 'settings') {
      return (
        <SettingsPage
          campaign={campaign}
          model={model}
          onChangeModel={setModel}
          provider={provider}
          onChangeProvider={setProvider}
          fontSize={fontSize}
          onChangeFontSize={setFontSize}
          autoGenerateImages={autoGenerateImages}
          onToggleAutoImages={() => setAutoGenerateImages(!autoGenerateImages)}
          sfxEnabled={sfxEnabled}
          onToggleSfx={handleToggleSfx}
          customApiKey={customApiKey}
          onChangeCustomApiKey={handleChangeCustomApiKey}
          geminiReport={geminiReport}
          onRefreshGeminiStatus={handleRefreshGeminiStatus}
          onExportJson={handleExportJson}
          onImportJsonFile={handleImportJsonFile}
          onNewCharacter={handleNewCharacter}
          onDeleteCampaign={handleDeleteCampaign}
          onOpenChronicle={() => setAppView('chronicle') }
          memoriesCount={campaign?.memories.length || 0}
          isSummarizingMemory={isSummarizingMemory}
          onSummarizeMemory={handleSummarizeMemory}
        />
      );
    }

    if (!campaign) {
      return (
        <HomePage
          hasCampaign={false}
          onStartCharacter={handleNewCharacter}
          onContinue={() => setAppView('home')}
          onOpenCodex={() => setAppView('codex')}
        />
      );
    }

    return (
      <ChroniclePage
        campaign={campaign}
        codexCards={allCodexCards}
        model={model}
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
          setCampaign((prev) =>
            prev
              ? {
                  ...prev,
                  turns: prev.turns.map((turn) =>
                    turn.id === turnId
                      ? { ...turn, gmResponse: { ...turn.gmResponse, narrative: newText } }
                      : turn
                  ),
                }
              : prev
          );
        }}
        onRetryLastTurn={handleRetryLastTurn}
        onRewindToTurn={(turnIdx) => {
          if (!campaign) return;
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
        onOpenSettings={() => setAppView('settings')}
        onChangeModel={setModel}
        onChangeFontSize={setFontSize}
        sfxEnabled={sfxEnabled}
        onToggleSfx={handleToggleSfx}
        onResetCampaign={handleNewCharacter}
        onUpdateCharacter={(updated) =>
          setCampaign((prev) => (prev ? { ...prev, character: updated } : prev))
        }
        onRegeneratePortrait={handleRegeneratePlayerPortrait}
        isRegeneratingPortrait={isRegeneratingPortrait}
        onGenerateNpcAvatar={handleGenerateNpcAvatar}
        generatingNpcName={generatingNpcName}
        onSummarizeMemory={handleSummarizeMemory}
        isSummarizingMemory={isSummarizingMemory}
        onQuickTargetNpc={handleQuickTargetNpc}
        onOpenCharacter={() => handleNavigate('character')}
        onOpenCodex={() => setAppView('codex')}
        onSetActiveBarrierOrDomain={(label) =>
          setCampaign((prev) =>
            prev ? { ...prev, world: { ...prev.world, activeBarrierOrDomain: label } } : prev
          )
        }
      />
    );
  };

  const shell = (
    <div className="editorial-shell flex h-[100dvh] flex-col overflow-hidden">
      <header className="editorial-topbar flex shrink-0 items-center justify-between gap-4 px-4 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setAppView('home')}
            className="editorial-logo-mark"
            aria-label="Ir para o início"
          >
            呪
          </button>
          <div className="min-w-0">
            <div className="editorial-eyebrow text-[8px]">Jujutsu Kaisen</div>
            <button
              type="button"
              onClick={() => setAppView('home')}
              className="editorial-serif block truncate text-[15px] leading-tight text-[#e7ddcb]"
            >
              Crônicas do Seguimento
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="editorial-eyebrow text-[8px] sm:hidden">
            {appView === 'character'
              ? campaign && !isCreatingCharacter
                ? 'Ficha'
                : 'Nova ficha'
              : navItems.find((item) => item.id === appView)?.label}
          </span>
          <span className="editorial-eyebrow hidden text-[8px] sm:block">{contextLabel}</span>
          {campaign && appView !== 'character' && (
            <button type="button" onClick={handleNewCharacter} className="editorial-link hidden md:block">
              Nova ficha
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="editorial-rail hidden shrink-0 flex-col md:flex" aria-label="Navegação principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = appView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                data-active={active ? 'true' : 'false'}
                className="editorial-rail-button"
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.4} />
              </button>
            );
          })}
        </aside>

        <main
          className={
            'min-w-0 flex-1 ' +
            (appView === 'chronicle' || appView === 'codex' ? 'overflow-hidden' : 'overflow-y-auto')
          }
        >
          {renderContent()}
        </main>
      </div>

      <nav className="editorial-mobile-nav grid shrink-0 grid-cols-5 md:hidden" aria-label="Navegação principal">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = appView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              data-active={active ? 'true' : 'false'}
              className="editorial-mobile-nav-item"
            >
              <Icon className="h-[17px] w-[17px]" strokeWidth={1.4} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <EditorialDialog
        open={Boolean(lightboxData)}
        title={lightboxData?.caption || 'Imagem da cena'}
        eyebrow="Frame da crônica"
        onClose={() => setLightboxData(null)}
      >
        {lightboxData && (
          <img
            src={lightboxData.url}
            alt={lightboxData.caption}
            referrerPolicy="no-referrer"
            className="w-full border border-[rgba(201,169,106,0.22)]"
          />
        )}
      </EditorialDialog>
    </div>
  );

  return shell;
}
