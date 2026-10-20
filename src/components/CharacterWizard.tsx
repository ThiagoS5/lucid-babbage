import React, { useState } from 'react';
import {
  CharacterSheet,
  CursedTechniqueDetails,
  CursedToolItem,
  DomainBarrierType,
  DomainPortalConfig,
  DomainPortalStyle,
  NarrativeAffinityLevel,
  NarrativePillarItem,
  NarrativeSkillItem,
  SessionZeroChatEntry,
  UNDEVELOPED_MARKER,
  WorldStateUpdate,
} from '../types/jjk';
import { CANONICAL_TECHNIQUES, STARTING_ARCS } from '../data/initialCodex';
import {
  DEFAULT_NARRATIVE_PILLARS,
  DEFAULT_NARRATIVE_SKILLS,
  GRADE_PROGRESSION_TIERS,
  buildExclusiveCharacterSheetMarkdown,
  cycleAffinityLevel,
  cyclePillarTier,
  enforceMandatoryLimitationsOnPillars,
  enforceMandatoryLimitationsOnSkills,
  ensureCharacterProgression,
  ensureNarrativePillars,
  ensureNarrativeSkills,
  getAffinityLevelMeta,
  getGradeProgressionRule,
  getPillarTierMeta,
  isSectionUndeveloped,
  validateNarrativeLimitations,
} from '../utils/jjkEngine';
import { generateCanonicalPortraitSvg } from '../utils/svgArtGenerator';
import { FEATURED_PORTRAIT_GALLERY, WIKI_PORTRAIT_FILES } from '../data/characterPortraits';
import {
  evaluateSessionZero,
  forgeBalancedTechnique,
  GeminiConnectionReport,
  generateAnimeImage,
} from '../services/geminiService';
import {
  Sparkles,
  Shield,
  Sword,
  BookOpen,
  Play,
  FolderOpen,
  Cloud,
  Wand2,
  Eye,
  ScrollText,
  Flame,
  Upload,
  Image as ImageIcon,
  Scale,
  MessageSquare,
  CheckCircle2,
  Lock,
  TrendingUp,
  Send,
  Plus,
  Compass,
  AlertTriangle,
  Zap,
  HeartHandshake,
  Skull,
  User,
  Info,
} from 'lucide-react';

interface CharacterWizardProps {
  onStartCampaign: (
    character: CharacterSheet,
    initialWorld: WorldStateUpdate,
    startingArcTitle: string,
    customOpeningPrompt?: string
  ) => void;
  onImportJsonFile: (file: File) => void;
  hasExistingCampaign: boolean;
  onResumeExisting: () => void;
  onOpenCloudModal: () => void;
  cloudUserEmail?: string | null;
  customApiKey?: string;
  geminiReport?: GeminiConnectionReport;
}

const FACTIONS = [
  {
    id: 'Feiticeiro Jujutsu (Escola Técnica de Tóquio)',
    clan: 'Independente / Tóquio',
    isHr: false,
  },
  {
    id: 'Feiticeiro Jujutsu (Escola Técnica de Kyoto)',
    clan: 'Independente / Kyoto',
    isHr: false,
  },
  {
    id: 'Herdeiro dos Três Grandes Clãs (Gojo, Zenin ou Kamo)',
    clan: 'Três Grandes Clãs',
    isHr: false,
  },
  {
    id: 'Usuário de Maldição Independente / Mercenário',
    clan: 'Mercenário do Submundo',
    isHr: false,
  },
  {
    id: 'Receptáculo / Portador de Objeto Amaldiçoado (Estilo Yuji Itadori)',
    clan: 'Receptáculo Especial',
    isHr: false,
  },
  {
    id: 'Feto Amaldiçoado Encarnado (Estilo Choso)',
    clan: 'Pintura da Morte',
    isHr: false,
  },
  {
    id: 'Espírito Amaldiçoado Racional de Grau Especial (Estilo Mahito/Jogo)',
    clan: 'Maldição Desperta',
    isHr: false,
  },
  {
    id: 'Portador de Restrição Celestial Física (Zero EA — Estilo Toji/Maki)',
    clan: 'Restrição Celestial',
    isHr: true,
  },
];

const GRADES = [
  'Grau 4',
  'Grau 3',
  'Grau 2',
  'Semi-Grau 1',
  'Grau 1',
  'Grau Especial',
];

const PHILOSOPHIES = [
  'Pragmático / Protetor da Humanidade (Estilo Yuji / Nanami)',
  'Arrogante Iluminado / Supremacia da Força (Estilo Gojo / Sukuna)',
  'Rebelde / Desafiador do Alto Escalão Conservador (Estilo Hakari / Yuta)',
  'Honra Tradicional & Devoção ao Clã (Estilo Naobito / Kamo)',
  'Frio & Calculista / Mercenário Pragmático (Estilo Toji Fushiguro)',
  'Niilista & Evolucionista Espiritual (Estilo Kenjaku / Geto)',
];

const BARRIER_TYPES: DomainBarrierType[] = [
  'Barreira Fechada Padrão (Esfera Isolada)',
  'Barreira Aberta Divina (Alcance de 200m — Estilo Sukuna/Kenjaku)',
  'Domínio Incompleto (Moldado pelo Ambiente — Estilo Megumi)',
  'Domínio Não-Letal Baseado em Regras (Estilo Higuruma/Hakari)',
];

const PORTAL_STYLES: { id: DomainPortalStyle; label: string; desc: string }[] = [
  {
    id: 'infinite_void',
    label: 'Vazio Ilimitado (Horizonte Cósmico)',
    desc: 'Anéis radiais azul-celeste, violeta abissal e singularidade estelar.',
  },
  {
    id: 'malevolent_shrine',
    label: 'Santuário Carmesim (Abismo de Sangue)',
    desc: 'Aura escarlate, sombras densas e relâmpagos negros opressores.',
  },
  {
    id: 'chimera_shadow',
    label: 'Abismo das Sombras (Índigo Líquido)',
    desc: 'Ondulações radiais de sombra profunda e névoa espiritual noturna.',
  },
  {
    id: 'judgeman_court',
    label: 'Tribunal Solene (Ouro & Julgamento)',
    desc: 'Brilho dourado austero com anéis concêntricos de lei absoluta.',
  },
  {
    id: 'custom_nebula',
    label: 'Portal Personalizado (Cores Livres)',
    desc: 'Escolha exatamente as cores primária, secundária e de núcleo do seu Portal.',
  },
];

const INITIAL_TOOLS: CursedToolItem[] = [
  {
    id: 'tool-undeveloped',
    name: UNDEVELOPED_MARKER,
    grade: 'Em Desenvolvimento',
    effect: 'Nenhuma Ferramenta Amaldiçoada definida inicialmente — será conquistada ou forjada durante a campanha.',
    equipped: false,
  },
  {
    id: 'tool-scythe-mother',
    name: 'Foice da Morte (Ecos da Mãe — Selada)',
    grade: 'Grau 3 (Evolutiva até Grau Especial)',
    effect: 'Foice forjada a partir do espírito amaldiçoado materno. Possui consciência protetora latente e libera novos poderes a cada promoção de Grau.',
    equipped: true,
  },
  {
    id: 'tool-katana',
    name: 'Katana Imbuída de Energia Amaldiçoada',
    grade: 'Grau 2',
    effect: 'Lâmina temperada para canalizar cortes precisos de Energia Amaldiçoada sem quebrar.',
    equipped: true,
  },
  {
    id: 'tool-slaughter',
    name: 'Slaughter Demon (Adaga Exorcista)',
    grade: 'Grau 3',
    effect: 'Adaga imbuída com Energia Amaldiçoada permanente, letal em combate de curta distância.',
    equipped: true,
  },
  {
    id: 'tool-playful-cloud',
    name: 'Playful Cloud (Nuvem Alegre — Sansetsukon)',
    grade: 'Grau Especial',
    effect: 'Bastão de três seções que não possui técnica própria, mas amplifica a força física bruta do usuário ao extremo.',
    equipped: true,
  },
  {
    id: 'tool-split-soul',
    name: 'Split Soul Katana (Katana Divisora de Almas)',
    grade: 'Grau Especial',
    effect: 'Ignora toda resistência física para cortar diretamente a alma de objetos e seres vivos (exige olhos capazes de ver a alma).',
    equipped: true,
  },
  {
    id: 'tool-inverted-spear',
    name: 'Inverted Spear of Heaven (Alabarda Invertida do Céu)',
    grade: 'Grau Especial',
    effect: 'Anula forçadamente qualquer Técnica Amaldiçoada ativa no instante do contato físico.',
    equipped: true,
  },
  {
    id: 'tool-martial',
    name: 'Artes Marciais & Punhos Imbuídos (Sem Arma)',
    grade: 'Combate Puro',
    effect: 'Foco absoluto no fluxo de Energia Amaldiçoada nos punhos e pés, facilitando a ocorrência de Kokusen.',
    equipped: true,
  },
];

export const CharacterWizard: React.FC<CharacterWizardProps> = ({
  onStartCampaign,
  onImportJsonFile,
  hasExistingCampaign,
  onResumeExisting,
  onOpenCloudModal,
  cloudUserEmail,
  customApiKey,
  geminiReport,
}) => {
  // Identity and D&D 5e Header Fields
  const [name, setName] = useState('Ren Fushiguro');
  const [customClan, setCustomClan] = useState('Clã Zenin / Independente');
  const [selectedFactionIdx, setSelectedFactionIdx] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState('Grau 4');
  const [alignmentPhilosophy, setAlignmentPhilosophy] = useState(PHILOSOPHIES[0]);

  // Avatar / Visuals
  const [avatarUrl, setAvatarUrl] = useState<string>(() =>
    generateCanonicalPortraitSvg('Jovem feiticeiro Jujutsu Tóquio')
  );
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [showPortraitGallery, setShowPortraitGallery] = useState(false);
  const [portraitSearch, setPortraitSearch] = useState('');
  const [uploadedPhotoName, setUploadedPhotoName] = useState<string | null>(null);

  // Appearance, Story & Style
  const [appearance, setAppearance] = useState(
    'Jovem feiticeiro de olhar afiado, cabelos escuros desalinhados, cicatriz sutil na sobrancelha e uniforme escuro de gola alta da Escola Técnica de Tóquio com aura azul elétrica.'
  );
  const [backstory, setBackstory] = useState(
    'Sobrevivente de um incidente com um Espírito Amaldiçoado de Grau Especial na infância. Frio e analítico sob pressão, busca dominar a essência da Energia Amaldiçoada para proteger seus aliados e desvendar os segredos das barreiras ancestrais.'
  );
  const [combatStyle, setCombatStyle] = useState(
    'Combate tático de média e curta distância combinando Taijutsu veloz, fintas com sombras/vetores e leitura cirúrgica do fluxo de Energia Amaldiçoada do inimigo visando brechas para Kokusen.'
  );

  // D&D 5e Roleplay Quad (Personality, Ideals, Bonds, Flaws)
  const [personalityTraits, setPersonalityTraits] = useState(
    'Calmo sob pressão extrema; observa os mínimos tiques musculares do oponente antes de atacar.'
  );
  const [ideals, setIdeals] = useState(
    'Nenhum inocente deve morrer em vão enquanto eu tiver uma gota de Energia Amaldiçoada.'
  );
  const [bonds, setBonds] = useState(
    'Promessa solene feita a companheiros caídos em combate; lealdade inegociável aos aliados da Escola Técnica.'
  );
  const [flaws, setFlaws] = useState(
    'Dificuldade extrema em recuar mesmo quando superado numericamente; desprezo visceral por politicagem e pelo Alto Escalão Jujutsu.'
  );

  // Binding Vow
  const [customVowName, setCustomVowName] = useState('Revelar a Própria Mão');
  const [customVowCondition, setCustomVowCondition] = useState(
    'Explicar abertamente o funcionamento da Técnica Inata ao inimigo em combate.'
  );
  const [customVowBonus, setCustomVowBonus] = useState(
    '+20% de Output imediato de Energia Amaldiçoada e eficácia da técnica.'
  );

  // 6 Narrative Pillars (D&D 5e Ability Shields)
  const [pillars, setPillars] = useState<NarrativePillarItem[]>(() =>
    DEFAULT_NARRATIVE_PILLARS.map((p) => ({ ...p }))
  );

  // 14+ Narrative Skills & Affinities (100% Narrative, No Math)
  const [skills, setSkills] = useState<NarrativeSkillItem[]>(() =>
    DEFAULT_NARRATIVE_SKILLS.map((s) => ({ ...s }))
  );
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<
    'all' | 'Combate & Corpo' | 'Jujutsu & Barreiras' | 'Mente & Percepção' | 'Social & Furtividade'
  >('all');
  const [isAddingCustomSkill, setIsAddingCustomSkill] = useState(false);
  const [customSkillName, setCustomSkillName] = useState('');
  const [customSkillCategory, setCustomSkillCategory] = useState<
    'Combate & Corpo' | 'Jujutsu & Barreiras' | 'Mente & Percepção' | 'Social & Furtividade'
  >('Combate & Corpo');
  const [customSkillDesc, setCustomSkillDesc] = useState('');
  const [customSkillAffinity, setCustomSkillAffinity] = useState<NarrativeAffinityLevel>('afinidade');

  // Responsive Layout Mode for Mobile & Tablet (< lg)
  const [mobileSheetTab, setMobileSheetTab] = useState<'all' | 'pillars' | 'technique' | 'roleplay'>('all');

  // Technique & Domain Portal
  const [techniqueMode, setTechniqueMode] = useState<'canon' | 'custom'>('custom');
  const [selectedCanonIdx, setSelectedCanonIdx] = useState(0);
  const [customConcept, setCustomConcept] = useState(
    'Manipulação de Vetores Cinéticos e Horizonte Espacial: quero uma técnica versátil que possa absorver ou atrasar o impacto cinético de golpes físicos e devolvê-los com força multiplicada, além de criar distorções gravitacionais de curto alcance.'
  );
  const [isDomainUndeveloped, setIsDomainUndeveloped] = useState<boolean>(false);

  const [domainPortal, setDomainPortal] = useState<DomainPortalConfig>({
    domainName: 'Pátio do Vazio e dos Relógios Partidos',
    visualStyle: 'infinite_void',
    barrierType: 'Barreira Fechada Padrão (Esfera Isolada)',
    handSeal: 'Selo de Taishakuten (Dedos Entrelaçados em Eixo Vertical)',
    sureHitEffect:
      'Todo movimento e fluxo de Energia Amaldiçoada do inimigo dentro do domínio sofre atraso temporal de 0,8s e recebe impactos cinéticos inevitáveis em todos os ângulos.',
    portalEnvironment:
      'Um horizonte cósmico infinito tipo Vazio Ilimitado onde engrenagens estrelares e relógios despedaçados flutuam sobre um espelho d’água abissal.',
    primaryColor: '#38bdf8',
    secondaryColor: '#7c3aed',
    coreColor: '#e11d48',
    overlayIntensity: 'medium',
  });

  const [customTechnique, setCustomTechnique] = useState<CursedTechniqueDetails>({
    name: 'Ressonância do Horizonte Abissal',
    isCanon: false,
    description:
      'Permite gravar vetores de atraso cinético em qualquer superfície ou espaço tocado, armazenando a energia de impactos e liberando-os em um único estalo espacial devastador.',
    lapse:
      'Lapso Vetorial (Estalo Azul) — retém o impulso de até 3 golpes físicos ou projéteis e os dispara simultaneamente na direção apontada.',
    reversal: UNDEVELOPED_MARKER,
    maximum: UNDEVELOPED_MARKER,
    domainExpansion:
      'Pátio do Vazio e dos Relógios Partidos — todo movimento inimigo sofre atraso de 0,8s sob acerto garantido de vetores espaciais.',
    antiDomain: 'Domínio Simples (Novo Estilo da Sombra)',
    hasRct: false,
    rctStatus: UNDEVELOPED_MARKER,
    activationConditions:
      'Exige tocar a superfície ou o ar com a palma da mão antes de gravar um vetor; explicar a regra do atraso cinético amplia o Output em +20%.',
  });
  const [isGeneratingTech, setIsGeneratingTech] = useState(false);

  // Arsenal & Starting Arc
  const [selectedToolIdx, setSelectedToolIdx] = useState(2);
  const [selectedArcIdx, setSelectedArcIdx] = useState(0);
  const [customArcDescription, setCustomArcDescription] = useState(
    () =>
      STARTING_ARCS[0]?.description ||
      'Chuva torrencial no distrito de Shinjuku às 23h00 enquanto uma Cortina misteriosa desce sobre um arranha-céu abandonado.'
  );
  const [customArcLocation, setCustomArcLocation] = useState(
    () => STARTING_ARCS[0]?.location || 'Escola Secundária Municipal Sugisawa — Pátio Noturno'
  );

  // Interactive Session Zero
  const [sessionZeroChat, setSessionZeroChat] = useState<SessionZeroChatEntry[]>([]);
  const [sessionZeroReplyInput, setSessionZeroReplyInput] = useState('');
  const [isEvaluatingSessionZero, setIsEvaluatingSessionZero] = useState(false);
  const [sessionZeroStatus, setSessionZeroStatus] = useState<'IDLE' | 'NEEDS_BALANCING' | 'BALANCED_READY'>('IDLE');
  const [latestProposedPatch, setLatestProposedPatch] = useState<SessionZeroChatEntry['proposedCharacterPatch'] | null>(null);

  const currentFaction = FACTIONS[selectedFactionIdx];
  const currentGradeRule = getGradeProgressionRule(selectedGrade);

  const handleFactionChange = (idx: number) => {
    setSelectedFactionIdx(idx);
    setCustomClan(FACTIONS[idx].clan);
  };

  const handleArcChange = (idx: number) => {
    setSelectedArcIdx(idx);
    const arc = STARTING_ARCS[idx];
    if (arc) {
      setCustomArcDescription(arc.description);
      setCustomArcLocation(arc.location);
    }
  };

  /**
   * Loads the exact character concept from the user's Session Zero transcript:
   * Thiago Soares (15 anos, filho adotivo de Satoru Gojo e uma maldição, Clã Marqueti + Ilimitado + Dupla Restrição Celestial + Foice da Morte)
   */
  const handleLoadThiagoMarquetiExample = () => {
    setName('Thiago Soares');
    setSelectedFactionIdx(2);
    setCustomClan('Clã Marqueti (Sobrevivente) · Filho Adotivo de Satoru Gojo');
    setSelectedGrade('Grau 4');
    setAlignmentPhilosophy('Pragmático / Protetor da Humanidade (Estilo Yuji / Nanami)');
    setAppearance(
      '15 anos (1º ano da Escola Técnica de Tóquio). Usa o uniforme escuro tradicional da Escola Jujutsu, olhar confiante com um olho herdado de Satoru Gojo sob bandagem/óculos escuros e carrega a Foice da Morte envolta em energia amaldiçoada.'
    );
    setBackstory(
      'Filho de Satoru Gojo (adotivo) e de um Espírito Amaldiçoado, único sobrevivente biológico do extinto Clã Marqueti — um clã capaz de manipular a realidade usando Energia Amaldiçoada. Age como Gojo (brincalhão para esconder suas dores, mas mortalmente sério quando mexem com seus amigos). Luta para proteger seus amigos e vingar seu clã.'
    );
    setCombatStyle(
      'Combate híbrido corpo-a-corpo e esgrima com a Foice da Morte (forjada a partir da maldição de sua mãe, contendo a alma dela), buscando combinar a manipulação de realidade do Clã Marqueti com o Ilimitado e atributos físicos sobre-humanos.'
    );
    setPersonalityTraits(
      'Espirituoso e sarcástico como Gojo para disfarçar feridas emocionais; implacável e silencioso quando amigos são feridos.'
    );
    setIdeals('A força existe para proteger os vulneráveis e erradicar o sofrimento gerado por maldições.');
    setBonds('Memória da mãe espiritual (selada na Foice da Morte) e vínculo fraternal com Satoru Gojo.');
    setFlaws('Dificuldade em confiar no Alto Escalão Jujutsu; dreno rápido de EA pelo olho herdado de Gojo.');
    setTechniqueMode('custom');
    setCustomConcept(
      'Herdou a técnica do Clã Marqueti (manipular a realidade utilizando Energia Amaldiçoada) e também o Ilimitado de Gojo, além de desejar ambas as Restrições Celestiais anulando os pontos fracos (físico sobre-humano + energia amaldiçoada alta).'
    );
    setCustomTechnique({
      name: 'Manipulação da Realidade (Clã Marqueti) & Ilimitado',
      isCanon: false,
      description:
        'Técnica ancestral do Clã Marqueti que altera a realidade usando Energia Amaldiçoada, combinada ao Ilimitado herdado de Satoru Gojo e à anomalia de dupla Restrição Celestial.',
      lapse: 'Lapso: Reescrita Corporal & Infinito de Curto Alcance',
      reversal: UNDEVELOPED_MARKER,
      maximum: UNDEVELOPED_MARKER,
      domainExpansion: UNDEVELOPED_MARKER,
      antiDomain: UNDEVELOPED_MARKER,
      hasRct: false,
      rctStatus: UNDEVELOPED_MARKER,
      activationConditions:
        'Voto Vinculativo do Clã Marqueti: manipula inicialmente o próprio corpo; usar o olho de Gojo consome muita Energia Amaldiçoada por não ter o sangue biológico do Clã Gojo.',
    });
    setIsDomainUndeveloped(true);
    setSelectedToolIdx(1); // Foice da Morte (Ecos da Mãe)
    setCustomVowName('Voto Vinculativo do Clã Marqueti');
    setCustomVowCondition(
      'A manipulação da realidade começa restrita ao próprio corpo e micro-regras; o olho de Gojo drena muita EA por não ter sangue Gojo.'
    );
    setCustomVowBonus(
      'Anula a fraqueza da Restrição Celestial mantendo físico sobre-humano + Energia Amaldiçoada e evolui a cada Grau.'
    );

    // Ensure at least 1 pillar is Fragilidade
    setPillars(
      DEFAULT_NARRATIVE_PILLARS.map((p) => {
        if (p.id === 'pillar-ce') {
          return {
            ...p,
            tier: 'Fraco',
            narrativeNote: 'Fragilidade Obrigatória: O Olho herdado de Gojo sem sangue biológico drena Energia Amaldiçoada rapidamente se forçado.',
          };
        }
        return { ...p };
      })
    );

    // Set affinities fitting Thiago Soares
    setSkills((prev) =>
      prev.map((s) => {
        if (s.id === 'skill-taijutsu') return { ...s, level: 'maestria' };
        if (s.id === 'skill-weapons') return { ...s, level: 'maestria' };
        if (s.id === 'skill-barriers') return { ...s, level: 'nao_desenvolvido' };
        if (s.id === 'skill-ce-control') return { ...s, level: 'inaptidao' };
        if (s.id === 'skill-deception') return { ...s, level: 'inaptidao' };
        return s;
      })
    );
  };

  /**
   * Marks advanced sections as "Não desenvolvido ainda"
   */
  const handleMarkAdvancedAsUndeveloped = () => {
    setTechniqueMode('custom');
    setSelectedGrade('Grau 4');
    setIsDomainUndeveloped(true);
    setCustomTechnique((prev) => ({
      ...prev,
      reversal: UNDEVELOPED_MARKER,
      maximum: UNDEVELOPED_MARKER,
      domainExpansion: UNDEVELOPED_MARKER,
      antiDomain: UNDEVELOPED_MARKER,
      hasRct: false,
      rctStatus: UNDEVELOPED_MARKER,
    }));
  };

  const handleRunSessionZero = async (playerArgument?: string) => {
    setIsEvaluatingSessionZero(true);
    const replyToSend = (playerArgument ?? sessionZeroReplyInput).trim();

    let updatedHistory = [...sessionZeroChat];
    if (replyToSend) {
      const playerMsg: SessionZeroChatEntry = {
        id: `sz-player-${Date.now()}`,
        sender: 'player',
        text: replyToSend,
        timestamp: new Date().toISOString(),
      };
      updatedHistory = [...updatedHistory, playerMsg];
      setSessionZeroChat(updatedHistory);
      setSessionZeroReplyInput('');
    }

    try {
      const draftPayload = {
        name,
        clan: customClan,
        faction: currentFaction.id,
        grade: selectedGrade,
        appearance,
        backstory,
        combatStyle,
        personalityTraits,
        ideals,
        bonds,
        flaws,
        alignmentPhilosophy,
        narrativePillars: pillars,
        narrativeSkills: skills,
        customConcept,
        technique: customTechnique,
        vow: {
          name: customVowName,
          condition: customVowCondition,
          bonus: customVowBonus,
        },
        tool: INITIAL_TOOLS[selectedToolIdx],
      };

      const data = await evaluateSessionZero({
        characterDraft: draftPayload,
        conversationHistory: updatedHistory.map((m) => ({
          sender: m.sender,
          text: m.text,
        })),
        playerReply: replyToSend,
        customApiKey,
      });
      if (data.ok && data.evaluation) {
        const ev = data.evaluation;
        const gmEntry: SessionZeroChatEntry = {
          id: `sz-gm-${Date.now()}`,
          sender: 'gm',
          text: ev.gmMessage,
          timestamp: new Date().toISOString(),
          balanceStatus: ev.balanceStatus,
          designatedInitialGrade: ev.designatedInitialGrade,
          powerScaleWarning: ev.powerScaleWarning,
          questionsForPlayer: ev.questionsForPlayer,
          proposedAdjustmentsSummary: ev.proposedAdjustmentsSummary,
          proposedCharacterPatch: ev.proposedCharacterPatch,
        };
        setSessionZeroChat([...updatedHistory, gmEntry]);
        setSessionZeroStatus(ev.balanceStatus || 'NEEDS_BALANCING');
        if (ev.proposedCharacterPatch) {
          setLatestProposedPatch(ev.proposedCharacterPatch);
        }
      }
    } catch {
      // Ignore network error
    } finally {
      setIsEvaluatingSessionZero(false);
    }
  };

  const handleApplyProposedPatch = (patch: SessionZeroChatEntry['proposedCharacterPatch']) => {
    if (!patch) return;
    if (patch.name) setName(patch.name);
    if (patch.clan) setCustomClan(patch.clan);
    if (patch.grade) setSelectedGrade(patch.grade);
    if (patch.appearance) setAppearance(patch.appearance);
    if (patch.backstory) setBackstory(patch.backstory);
    if (patch.combatStyle) setCombatStyle(patch.combatStyle);
    if (patch.vowName) setCustomVowName(patch.vowName);
    if (patch.vowCondition) setCustomVowCondition(patch.vowCondition);
    if (patch.vowBonus) setCustomVowBonus(patch.vowBonus);
    if (patch.toolName && patch.toolName.toLowerCase().includes('foice')) {
      setSelectedToolIdx(1);
    }
    if (patch.technique) {
      setTechniqueMode('custom');
      setCustomTechnique((prev) => ({
        ...prev,
        ...patch.technique,
        name: patch.technique?.name || prev.name,
        description: patch.technique?.description || prev.description,
        lapse: patch.technique?.lapse || prev.lapse,
        reversal: patch.technique?.reversal || prev.reversal,
        maximum: patch.technique?.maximum || prev.maximum,
        domainExpansion: patch.technique?.domainExpansion || prev.domainExpansion,
        antiDomain: patch.technique?.antiDomain || prev.antiDomain,
        hasRct: Boolean(patch.technique?.hasRct),
        rctStatus:
          (patch.technique?.rctStatus as 'Desenvolvido' | 'Não desenvolvido ainda' | 'Bloqueado') ||
          (patch.technique?.hasRct ? 'Desenvolvido' : UNDEVELOPED_MARKER),
        activationConditions: patch.technique?.activationConditions || prev.activationConditions,
      }));
      if (isSectionUndeveloped(patch.technique.domainExpansion)) {
        setIsDomainUndeveloped(true);
      }
    }
    setSessionZeroStatus('BALANCED_READY');
  };

  const handleUploadOwnPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedPhotoName(file.name);
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
            const optimized = canvas.toDataURL('image/webp', 0.88);
            setAvatarUrl(optimized);
            return;
          }
        } catch {
          // Fallback to raw data URL
        }
        setAvatarUrl(rawDataUrl);
      };
      img.onerror = () => setAvatarUrl(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAvatar = async () => {
    setIsGeneratingAvatar(true);
    try {
      const prompt = `Official Jujutsu Kaisen Season 2 anime character portrait by MAPPA studio, ${appearance}, ${combatStyle}, 1:1 square portrait, high contrast cursed energy aura, no text`;
      const data = await generateAnimeImage({
        prompt,
        aspectRatio: '1:1',
        characterSummary: `${name} (${selectedGrade} - ${currentFaction.id}): ${appearance}`,
        customApiKey,
      });
      if (data.ok && data.imageUrl) {
        setAvatarUrl(data.imageUrl);
      } else {
        setAvatarUrl(generateCanonicalPortraitSvg(`${name} ${appearance}`, currentFaction.id));
      }
    } catch {
      setAvatarUrl(generateCanonicalPortraitSvg(`${name} ${appearance}`, currentFaction.id));
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleGenerateBalancedTechnique = async () => {
    setIsGeneratingTech(true);
    try {
      const data = await forgeBalancedTechnique({
        concept: customConcept,
        characterName: name,
        backstory,
        combatStyle,
        faction: currentFaction.id,
        grade: selectedGrade,
        customApiKey,
      });
      if (data.ok && data.technique) {
        setCustomTechnique(data.technique);
        setIsDomainUndeveloped(false);
        if (data.domainPortal) {
          setDomainPortal((prev) => ({
            ...prev,
            ...data.domainPortal,
          }));
        } else if (data.technique.domainExpansion) {
          setDomainPortal((prev) => ({
            ...prev,
            domainName: data.technique.domainExpansion.split('—')[0].trim(),
            sureHitEffect: data.technique.domainExpansion,
          }));
        }
      }
    } catch {
      // Keeps current custom technique
    } finally {
      setIsGeneratingTech(false);
    }
  };

  const handleTogglePillar = (pillarId: string) => {
    setPillars((prev) =>
      prev.map((p) => (p.id === pillarId ? { ...p, tier: cyclePillarTier(p.tier) } : p))
    );
  };

  const handleCycleSkillAffinity = (skillId: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, level: cycleAffinityLevel(s.level) } : s))
    );
  };

  const handleAutoFixLimitations = () => {
    setPillars((prev) => enforceMandatoryLimitationsOnPillars(prev));
    setSkills((prev) => enforceMandatoryLimitationsOnSkills(prev));
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSkillName.trim()) return;
    const newSkill: NarrativeSkillItem = {
      id: `custom-skill-${Date.now()}`,
      name: customSkillName.trim(),
      category: customSkillCategory,
      level: customSkillAffinity,
      narrativeImpact: customSkillDesc.trim() || 'Perícia narrativa personalizada criada na ficha.',
      isCustom: true,
    };
    setSkills((prev) => [...prev, newSkill]);
    setCustomSkillName('');
    setCustomSkillDesc('');
    setIsAddingCustomSkill(false);
  };

  const limitationsCheck = validateNarrativeLimitations(pillars, skills);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const enforcedPillars = enforceMandatoryLimitationsOnPillars(pillars);
    const enforcedSkills = enforceMandatoryLimitationsOnSkills(skills);

    const baseTechnique: CursedTechniqueDetails = currentFaction.isHr
      ? CANONICAL_TECHNIQUES[5]
      : techniqueMode === 'canon'
      ? CANONICAL_TECHNIQUES[selectedCanonIdx]
      : customTechnique;

    const resolvedDomainExpansion = currentFaction.isHr
      ? baseTechnique.domainExpansion
      : isDomainUndeveloped || isSectionUndeveloped(baseTechnique.domainExpansion)
      ? UNDEVELOPED_MARKER
      : `${domainPortal.domainName} — ${domainPortal.sureHitEffect}`;

    const chosenTechnique: CursedTechniqueDetails = {
      ...baseTechnique,
      domainExpansion: resolvedDomainExpansion,
      rctStatus: baseTechnique.hasRct
        ? 'Desenvolvido'
        : baseTechnique.rctStatus || UNDEVELOPED_MARKER,
      domainPortal:
        currentFaction.isHr || isDomainUndeveloped
          ? {
              ...domainPortal,
              domainName: isDomainUndeveloped ? UNDEVELOPED_MARKER : domainPortal.domainName,
            }
          : domainPortal,
    };

    const chosenTool = INITIAL_TOOLS[selectedToolIdx];
    const chosenArc = STARTING_ARCS[selectedArcIdx];

    const initialInventory: CursedToolItem[] = isSectionUndeveloped(chosenTool?.name)
      ? [
          {
            id: 'item-undeveloped-tool',
            name: UNDEVELOPED_MARKER,
            grade: 'Em Desenvolvimento',
            effect: 'Ferramenta Amaldiçoada principal ainda não definida — será despertada ou conquistada na campanha.',
            equipped: false,
          },
          {
            id: 'item-talisman',
            name: 'Talismã de Cortina Básica',
            grade: 'Utilitário Jujutsu',
            effect: 'Permite erguer uma Cortina (Tobari) para ocultar o combate de civis.',
            equipped: true,
          },
        ]
      : [
          chosenTool,
          {
            id: 'item-talisman',
            name: 'Talismã de Cortina Básica',
            grade: 'Utilitário Jujutsu',
            effect: 'Permite erguer uma Cortina (Tobari) para ocultar o combate de civis.',
            equipped: true,
          },
        ];

    const baseCharacter: CharacterSheet = {
      name: name.trim(),
      appearance: appearance.trim() || UNDEVELOPED_MARKER,
      backstory: backstory.trim() || UNDEVELOPED_MARKER,
      combatStyle: combatStyle.trim() || UNDEVELOPED_MARKER,
      avatarUrl,
      faction: currentFaction.id,
      clan: customClan.trim() || currentFaction.clan,
      grade: selectedGrade,
      alignmentPhilosophy,
      personalityTraits: personalityTraits.trim() || UNDEVELOPED_MARKER,
      ideals: ideals.trim() || UNDEVELOPED_MARKER,
      bonds: bonds.trim() || UNDEVELOPED_MARKER,
      flaws: flaws.trim() || UNDEVELOPED_MARKER,
      narrativePillars: enforcedPillars,
      narrativeSkills: enforcedSkills,
      isHeavenlyRestriction: currentFaction.isHr,
      hpPercentage: 100,
      cursedEnergyPercentage: currentFaction.isHr ? 0 : 100,
      outputPercentage: 100,
      physicalCondition: 'Intacto — Pronto para Exorcismo',
      techniqueState: 'Ativa',
      inBlackFlashZone: false,
      technique: chosenTechnique,
      inventory: initialInventory,
      bindingVows: [
        {
          id: 'vow-reveal-hand',
          name: customVowName.trim() || UNDEVELOPED_MARKER,
          condition:
            customVowCondition.trim() ||
            'Explicar abertamente o funcionamento da Técnica Inata ao inimigo em combate.',
          bonus:
            customVowBonus.trim() ||
            '+20% de Output imediato de Energia Amaldiçoada e eficácia da técnica.',
          active: false,
        },
      ],
      evolutionHistory: [
        {
          id: `evo-init-${Date.now()}`,
          turnNumber: 1,
          timestamp: new Date().toISOString(),
          title: `Criação da Ficha Oficial de Mesa (${selectedGrade})`,
          details:
            sessionZeroChat.length > 0
              ? `Personagem avaliado e nivelado na Sessão Zero com o Mestre IA. Início em ${selectedGrade} (${currentGradeRule.levelsRequired} níveis para ${currentGradeRule.nextGrade || 'Maestria'}).`
              : `Ficha Exclusiva inicializada em ${selectedGrade} (${currentGradeRule.levelsRequired} níveis para ${currentGradeRule.nextGrade || 'Maestria'}).`,
          gradeAtTime: selectedGrade,
          levelAtTime: 1,
        },
      ],
    };

    baseCharacter.progression = ensureCharacterProgression(baseCharacter);
    baseCharacter.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(baseCharacter);

    const initialWorld: WorldStateUpdate = {
      location: customArcLocation.trim() || chosenArc.location,
      arc: chosenArc.arcLabel,
      activeBarrierOrDomain:
        chosenArc.id === 'shibuya-incident' || chosenArc.id === 'culling-game'
          ? 'Cortina Ativa'
          : 'Nenhum',
      npcsInScene: chosenArc.initialNpcs.map((n) => ({
        ...n,
        hpPercentage: 100,
        avatarUrl: generateCanonicalPortraitSvg(n.name),
      })),
    };

    onStartCampaign(
      baseCharacter,
      initialWorld,
      chosenArc.title,
      customArcDescription.trim() || chosenArc.description
    );
  };

  const renderUndevelopedToggle = (
    currentVal: string | undefined,
    onSetUndeveloped: () => void,
    onClearUndeveloped: () => void,
    label = 'Não desenvolvido ainda'
  ) => {
    const undeveloped = isSectionUndeveloped(currentVal);
    return (
      <button
        type="button"
        onClick={() => {
          if (undeveloped) {
            onClearUndeveloped();
          } else {
            onSetUndeveloped();
          }
        }}
        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
          undeveloped
            ? 'bg-amber-950/60 border-amber-500/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            : 'bg-[#07070a] border-slate-700 text-slate-400 hover:border-amber-500/50 hover:text-amber-300'
        }`}
        title="Marcar ou desmarcar esta seção como 'Não desenvolvido ainda' para despertar durante a história"
      >
        <Lock className="w-2.5 h-2.5 shrink-0" />
        <span>{undeveloped ? `✓ ${label}` : `Marcar "${label}"`}</span>
      </button>
    );
  };

  // Skill stats for quick display
  const helpingSkillsCount = skills.filter((s) => s.level === 'maestria' || s.level === 'afinidade').length;
  const hinderingSkillsCount = skills.filter((s) => s.level === 'inaptidao').length;
  const undevelopedSkillsCount = skills.filter((s) => s.level === 'nao_desenvolvido').length;

  const filteredSkills = skills.filter((s) => {
    if (skillCategoryFilter === 'all') return true;
    return s.category === skillCategoryFilter;
  });

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto rpg-tabletop-desk text-slate-100 px-3 py-6 md:px-8 md:py-10 font-sans safe-bottom">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Control Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-950/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-950/70 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.2)]">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-rose-400 font-display font-bold">
                <span>Jujutsu Kaisen · Ficha Oficial de RPG de Mesa</span>
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-wider text-rose-100 drop-shadow">
                CURSED CHRONICLES VTT
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasExistingCampaign && (
              <button
                type="button"
                onClick={onResumeExisting}
                className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-[0_0_15px_rgba(2,132,199,0.3)]"
              >
                <Play className="w-3.5 h-3.5" />
                Retomar Campanha
              </button>
            )}

            <button
              type="button"
              onClick={onOpenCloudModal}
              className="px-3.5 py-2 rounded-lg bg-[#0f0f14] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
              title="Abrir Diagnóstico da Chave Gemini IA, Configurações de Sistema e Saves na Nuvem"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  geminiReport?.state === 'VALID'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-amber-400'
                }`}
              />
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {cloudUserEmail ? `Sistema & Nuvem (${cloudUserEmail.split('@')[0]})` : 'Sistema, IA & Nuvem'}
              </span>
            </button>

            <label className="px-3.5 py-2 rounded-lg bg-[#0f0f14] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Importar Save (.json)</span>
              <input
                type="file"
                accept=".json"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportJsonFile(file);
                }}
              />
            </label>
          </div>
        </header>

        {/* Intelligent Session Zero & Presets Bar */}
        <section aria-labelledby="sz-heading" className="bg-gradient-to-r from-[#0d0d14] via-[#12111d] to-[#0d0d14] border border-purple-500/40 rounded-2xl p-4 md:p-5 space-y-3 shadow-[0_0_25px_rgba(124,58,237,0.1)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div id="sz-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                <Scale className="w-4 h-4 text-purple-400" />
                <span>Sessão Zero & Equilíbrio de Força · Nivelamento Inteligente com Mestre IA</span>
              </div>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                Você pode deixar seções em aberto com <span className="text-amber-300 font-semibold">"Não desenvolvido ainda"</span> para despertar em combate. O Mestre IA nivela ideias apelonas com Votos Vinculativos e perguntas táticas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLoadThiagoMarquetiExample}
                className="px-3 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/50 text-amber-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Carregar Exemplo: Thiago Soares (Clã Marqueti)</span>
              </button>

              <button
                type="button"
                onClick={handleMarkAdvancedAsUndeveloped}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Marcar Avançadas "Não desenvolvido ainda"</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunSessionZero()}
                disabled={isEvaluatingSessionZero}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(124,58,237,0.35)] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>
                  {isEvaluatingSessionZero ? 'Mestre Avaliando...' : '⚖️ Nivelar com Mestre IA'}
                </span>
              </button>
            </div>
          </div>

          {/* Session Zero Chat Entries */}
          {sessionZeroChat.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    Diálogo da Sessão Zero
                  </span>
                  {sessionZeroStatus && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        sessionZeroStatus === 'BALANCED_READY'
                          ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                          : 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                      }`}
                    >
                      {sessionZeroStatus === 'BALANCED_READY'
                        ? '✓ Ficha Nivelada & Pronta'
                        : '⚖️ Em Nivelamento'}
                    </span>
                  )}
                </div>

                {latestProposedPatch && (
                  <button
                    type="button"
                    onClick={() => handleApplyProposedPatch(latestProposedPatch)}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aplicar Proposta do Mestre na Ficha</span>
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                {sessionZeroChat.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      entry.sender === 'gm'
                        ? 'bg-[#07070a] border-purple-500/40 text-slate-200'
                        : 'bg-sky-950/30 border-sky-500/40 text-sky-100 ml-4'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-purple-300">
                        {entry.sender === 'gm' ? '🎭 Mestre de Jogo' : `🗣️ ${name}`}
                      </span>
                      {entry.designatedInitialGrade && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-purple-200">
                          Grau Sugerido: {entry.designatedInitialGrade}
                        </span>
                      )}
                    </div>
                    {entry.powerScaleWarning && (
                      <div className="mb-1.5 p-1.5 rounded bg-rose-950/40 border border-rose-500/40 text-rose-200 text-[11px]">
                        <strong>⚠️ Alerta:</strong> {entry.powerScaleWarning}
                      </div>
                    )}
                    <div className="whitespace-pre-line">{entry.text}</div>
                  </div>
                ))}
              </div>

              {/* Player Reply Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={sessionZeroReplyInput}
                  onChange={(e) => setSessionZeroReplyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (sessionZeroReplyInput.trim() && !isEvaluatingSessionZero) {
                        handleRunSessionZero();
                      }
                    }
                  }}
                  placeholder="Responda ou proponha um Voto Vinculativo ao Mestre..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#07070a] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => handleRunSessionZero()}
                  disabled={isEvaluatingSessionZero || !sessionZeroReplyInput.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            THE OFFICIAL D&D 5E TABLETOP CHARACTER SHEET FORM
           ========================================================================= */}
        <form onSubmit={handleStart} className="dnd5e-sheet-surface space-y-6">
          {/* 1. D&D 5E OFFICIAL HEADER BLOCK */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-4 border-b border-rose-500/30">
            {/* Left Block: Character Name & Crest */}
            <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border-2 border-rose-500/60 shadow-[0_0_20px_rgba(225,29,72,0.25)] bg-[#07070a]">
                  <img
                    src={avatarUrl}
                    alt={name}
                    fetchPriority="high"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPortraitGallery(!showPortraitGallery)}
                  className="absolute bottom-1 right-1 p-1 rounded bg-[#07070a]/90 border border-slate-700 text-slate-200 hover:text-white"
                  title="Galeria de Portraits"
                  aria-expanded={showPortraitGallery}
                  aria-controls="portrait-gallery-panel"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="visually-hidden">Alternar Galeria de Portraits</span>
                </button>
              </div>

              <div className="w-full space-y-1">
                <label className="block text-[10px] tracking-widest uppercase font-bold text-rose-400" htmlFor="char-name-dnd5e">
                  NOME DO PERSONAGEM / CHARACTER NAME
                </label>
                <input
                  id="char-name-dnd5e"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Thiago Soares, Ren Fushiguro..."
                  className="w-full px-3 py-2 rounded-lg bg-[#07070a] border border-rose-500/50 font-display text-lg font-bold text-white tracking-wide focus:outline-none focus:border-rose-400"
                />

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <label className="py-1 px-2.5 rounded bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/50 text-[10px] font-semibold text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[120px]">
                      {uploadedPhotoName ? uploadedPhotoName : 'Sua Foto'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadOwnPhoto}
                      className="visually-hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleGenerateAvatar}
                    disabled={isGeneratingAvatar}
                    className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-medium text-sky-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>{isGeneratingAvatar ? 'Gerando...' : 'Retrato IA'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Block: 2x3 D&D 5e Framed Identity Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {/* Box 1: Facção / Classe */}
              <div className="dnd5e-framed-box">
                <div className="dnd5e-section-caption !mt-0 !pt-0 !border-t-0 mb-1.5 pb-1 border-b border-amber-700/20">
                  CLASSE / FACÇÃO
                </div>
                <select
                  value={selectedFactionIdx}
                  onChange={(e) => handleFactionChange(Number(e.target.value))}
                  className="w-full bg-transparent text-xs font-bold text-white border-none focus:outline-none"
                  title="Facção e Classe Jujutsu"
                >
                  {FACTIONS.map((f, idx) => (
                    <option key={f.id} value={idx} className="bg-[#0f0f14] text-white">
                      {f.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Box 2: Clã / Antecedente */}
              <div className="dnd5e-framed-box">
                <div className="dnd5e-section-caption !mt-0 !pt-0 !border-t-0 mb-1.5 pb-1 border-b border-amber-700/20">
                  CLÃ / ANTECEDENTE
                </div>
                <input
                  type="text"
                  value={customClan}
                  onChange={(e) => setCustomClan(e.target.value)}
                  placeholder="Clã ou Origem..."
                  className="w-full bg-transparent text-xs font-bold text-sky-300 border-none focus:outline-none"
                />
              </div>

              {/* Box 3: Grau & Níveis */}
              <div className="dnd5e-framed-box">
                <div className="dnd5e-section-caption !mt-0 !pt-0 !border-t-0 mb-1.5 pb-1 border-b border-amber-700/20">
                  GRAU & ESCADA DE NÍVEIS
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="bg-transparent text-xs font-bold text-purple-300 border-none focus:outline-none"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g} className="bg-[#0f0f14] text-white">
                        {g}
                      </option>
                    ))}
                  </select>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-purple-200 font-semibold whitespace-nowrap">
                    +{currentGradeRule.levelsRequired} nv
                  </span>
                </div>
              </div>

              {/* Box 4: Técnica Inata */}
              <div className="dnd5e-framed-box">
                <div className="dnd5e-section-caption !mt-0 !pt-0 !border-t-0 mb-1.5 pb-1 border-b border-amber-700/20">
                  TÉCNICA INATA
                </div>
                <div className="text-xs font-bold text-amber-300 break-words leading-snug">
                  {techniqueMode === 'canon'
                    ? CANONICAL_TECHNIQUES[selectedCanonIdx].name
                    : customTechnique.name || 'Técnica Original'}
                </div>
              </div>

              {/* Box 6: Experiência & Sessão Zero */}
              <div className="dnd5e-framed-box">
                <div className="dnd5e-section-caption !mt-0 !pt-0 !border-t-0 mb-1.5 pb-1 border-b border-amber-700/20">
                  EXPERIÊNCIA / SESSÃO ZERO
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold">
                  <span className="text-emerald-300">Nível 1 (0 / 100 XP)</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {sessionZeroStatus === 'BALANCED_READY' ? '⚖️ Nivelada' : 'Sessão 0'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Portrait Gallery Drawer (if toggled) */}
          {showPortraitGallery && (
            <div id="portrait-gallery-panel" className="p-3.5 rounded-xl bg-[#07070a] border border-purple-500/40 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-purple-300">
                  Galeria de Portraits Oficiais (ArtStation & 318 Personagens Canônicos)
                </span>
                <input
                  type="text"
                  value={portraitSearch}
                  onChange={(e) => setPortraitSearch(e.target.value)}
                  placeholder="Buscar portrait (ex: Aoi, Gojo, Nanami, Sukuna, Choso, Geto)..."
                  className="px-2.5 py-1 rounded bg-[#0f0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 w-full sm:w-64"
                />
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-44 overflow-y-auto pr-1">
                {(portraitSearch.trim()
                  ? [
                      ...FEATURED_PORTRAIT_GALLERY.filter((item) =>
                        item.label.toLowerCase().includes(portraitSearch.toLowerCase())
                      ),
                      ...WIKI_PORTRAIT_FILES.filter((f) =>
                        f.toLowerCase().includes(portraitSearch.toLowerCase())
                      )
                        .slice(0, 32)
                        .map((f) => ({
                          id: `wiki-file-${f}`,
                          label: f.replace(/P(__.*)?\.png$/i, '').replace(/_/g, ' '),
                          category: 'wiki_sorcerer' as const,
                          url: `/portraits/wiki/${f}`,
                        })),
                    ]
                  : FEATURED_PORTRAIT_GALLERY
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(item.url);
                      setUploadedPhotoName(null);
                    }}
                    className={`p-1 rounded-lg border text-center transition-all cursor-pointer ${
                      avatarUrl === item.url
                        ? 'border-rose-400 bg-rose-950/40'
                        : 'border-slate-800 bg-[#0f0f14] hover:border-slate-600'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.label}
                      loading="lazy"
                      className="w-full aspect-square object-cover rounded"
                    />
                    <div className="text-[9px] text-slate-300 break-words leading-tight mt-1">{item.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              2. THE TABLETOP BODY (RESPONSIVE: MOBILE, TABLET & WEB)
             ========================================================================= */}
          {/* Responsive Mobile / Tablet Tab Switcher (< lg) */}
          <div className="lg:hidden flex items-center gap-1.5 p-1 rounded-xl bg-[#0a0a0f] border border-slate-800 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setMobileSheetTab('all')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                mobileSheetTab === 'all'
                  ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              👁️ Ficha Completa
            </button>
            <button
              type="button"
              onClick={() => setMobileSheetTab('pillars')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                mobileSheetTab === 'pillars'
                  ? 'bg-sky-600 text-white shadow-[0_0_12px_rgba(2,132,199,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🛡️ 1. Pilares & Perícias
            </button>
            <button
              type="button"
              onClick={() => setMobileSheetTab('technique')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                mobileSheetTab === 'technique'
                  ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚔️ 2. Grimório & Início
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* -----------------------------------------------------------------
                COLUMN 1 (LEFT, col-span-5):
                - Os 6 Pilares de Aptidão (D&D 5e Ability Shields)
                - Quadro de Perícias & Afinidades Narrativas (100% Narrativo, Sem Math)
               ----------------------------------------------------------------- */}
            <div
              className={`${
                mobileSheetTab === 'pillars' || mobileSheetTab === 'all' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 space-y-5 min-w-0`}
            >
              {/* Os 6 Pilares de Aptidão */}
              <div className="dnd5e-framed-box space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider font-display">
                    <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Pilares de Aptidão Jujutsu</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Clique para alternar</span>
                </div>

                {/* Mandatory Tabletop Limitation Banner */}
                <div
                  className={`p-2.5 rounded-lg border text-[11px] leading-snug space-y-1.5 ${
                    limitationsCheck.isValid
                      ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 shrink-0" />
                      {limitationsCheck.isValid
                        ? '✓ Limitações de Mesa Respeitadas'
                        : '⚠️ Regra de Limitação Narrativa'}
                    </span>
                    {!limitationsCheck.isValid && (
                      <button
                        type="button"
                        onClick={handleAutoFixLimitations}
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        Equilibrar Agora
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    Obrigatoriamente pelo menos <strong>1 Pilar</strong> deve ser{' '}
                    <span className="text-rose-300 font-semibold">▼ Fragilidade</span> (atual:{' '}
                    <strong>{limitationsCheck.fragilePillarCount}</strong>) e no máximo{' '}
                    <strong>3 Pilares</strong> como Ponto Forte/Ápice (atual:{' '}
                    <strong>{limitationsCheck.strongOrApexPillarCount}/3</strong>).
                  </p>
                  {!limitationsCheck.isValid && limitationsCheck.warnings.length > 0 && (
                    <ul className="list-disc list-inside text-[10px] text-rose-300 space-y-0.5">
                      {limitationsCheck.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {pillars.map((pillar) => {
                    const meta = getPillarTierMeta(pillar.tier);
                    return (
                      <button
                        key={pillar.id}
                        type="button"
                        onClick={() => handleTogglePillar(pillar.id)}
                        className={`rpg-ability-box text-left transition-all cursor-pointer group w-full ${
                          pillar.tier === 'Fraco'
                            ? 'border-rose-500/70 bg-rose-950/20'
                            : 'hover:border-amber-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 w-full">
                          <span className="rpg-ability-title">{pillar.name}</span>
                          <span className="rpg-ability-subpill px-2 py-0.5 shrink-0">
                            {pillar.abbr || 'JJK'}
                          </span>
                        </div>
                        <div className={`rpg-ability-tier w-full ${meta.badgeClass}`}>
                          {meta.label}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-snug break-words">
                          {pillar.narrativeNote}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quadro de Perícias & Afinidades Narrativas */}
              <div className="dnd5e-framed-box space-y-3">
                <div className="flex flex-col gap-1 border-b border-amber-500/20 pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider font-display">
                      <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Perícias & Afinidades Narrativas</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomSkill(true)}
                      className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-[10px] font-semibold text-amber-200 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Nova Perícia</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <span className="text-amber-300 font-semibold">100% Narrativo · Sem soma matemática.</span> Afinidades ajudam diretamente na história e pelo menos <strong>1 Inaptidão (▼)</strong> gera complicações dramáticas.
                  </p>
                </div>

                {/* Legend & Stats */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] bg-[#07070a] p-2.5 rounded-lg border border-slate-800">
                  <span className="text-emerald-400 font-bold">🟢 Ajuda: {helpingSkillsCount}</span>
                  <span className="text-rose-400 font-bold">🔴 Fragilidades: {hinderingSkillsCount} (mín. 1)</span>
                  <span className="text-amber-400 font-bold">🔒 Não desenv.: {undevelopedSkillsCount}</span>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {[
                    { id: 'all', label: 'Todas' },
                    { id: 'Combate & Corpo', label: 'Combate' },
                    { id: 'Jujutsu & Barreiras', label: 'Jujutsu' },
                    { id: 'Mente & Percepção', label: 'Mente' },
                    { id: 'Social & Furtividade', label: 'Social' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSkillCategoryFilter(tab.id as typeof skillCategoryFilter)}
                      className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                        skillCategoryFilter === tab.id
                          ? 'bg-amber-600/30 border-amber-500 text-amber-200 font-bold'
                          : 'bg-[#07070a] border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Interactive Skills List - Fits mobile, tablet, and desktop cleanly */}
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {filteredSkills.map((skill) => {
                    const meta = getAffinityLevelMeta(skill.level);
                    return (
                      <div
                        key={skill.id}
                        className="rpg-skill-row group cursor-pointer"
                        onClick={() => handleCycleSkillAffinity(skill.id)}
                      >
                        <div className="flex items-start justify-between gap-2 w-full">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {/* D&D 5e Bubble Icon */}
                            <div
                              className={`rpg-bubble mt-0.5 ${
                                skill.level === 'maestria'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                                  : skill.level === 'afinidade'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                                  : skill.level === 'inaptidao'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                                  : skill.level === 'nao_desenvolvido'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                                  : 'bg-transparent text-slate-500 border-slate-700'
                              }`}
                            >
                              {meta.symbol}
                            </div>

                            {/* Full Skill Name without truncation */}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-100 group-hover:text-amber-200 leading-snug break-words">
                                {skill.name}
                              </div>
                              <div className="text-[10px] text-amber-500/80 font-medium">
                                {skill.category}
                              </div>
                            </div>
                          </div>

                          {/* Affinity Badge */}
                          <div
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 whitespace-nowrap ${meta.badgeClass}`}
                          >
                            {meta.shortLabel}
                          </div>
                        </div>

                        {/* Full Narrative Impact text */}
                        <p className="text-[11px] text-slate-400 leading-relaxed break-words pl-7">
                          {skill.narrativeImpact}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Add Custom Narrative Skill Modal / Form */}
                {isAddingCustomSkill && (
                  <div className="p-3 rounded-lg bg-[#07070a] border border-amber-500/50 space-y-2 text-xs">
                    <div className="font-bold text-amber-300">Criar Perícia Narrativa Personalizada</div>
                    <input
                      type="text"
                      value={customSkillName}
                      onChange={(e) => setCustomSkillName(e.target.value)}
                      placeholder="Nome da Perícia (ex: Esgrima com Foice, Pilotagem, Investigação)..."
                      className="w-full px-2.5 py-1.5 rounded bg-[#0f0f14] border border-slate-700 text-white text-xs"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={customSkillCategory}
                        onChange={(e) =>
                          setCustomSkillCategory(e.target.value as typeof customSkillCategory)
                        }
                        className="px-2 py-1.5 rounded bg-[#0f0f14] border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="Combate & Corpo">Combate & Corpo</option>
                        <option value="Jujutsu & Barreiras">Jujutsu & Barreiras</option>
                        <option value="Mente & Percepção">Mente & Percepção</option>
                        <option value="Social & Furtividade">Social & Furtividade</option>
                      </select>

                      <select
                        value={customSkillAffinity}
                        onChange={(e) =>
                          setCustomSkillAffinity(e.target.value as NarrativeAffinityLevel)
                        }
                        className="px-2 py-1.5 rounded bg-[#0f0f14] border border-slate-700 text-slate-200 text-xs font-bold"
                      >
                        <option value="maestria">★ Maestria (Ajuda Muito)</option>
                        <option value="afinidade">● Afinidade (Ajuda)</option>
                        <option value="neutro">○ Neutro (Padrão)</option>
                        <option value="inaptidao">▼ Inaptidão (Prejudica)</option>
                        <option value="nao_desenvolvido">🔒 Não desenvolvido ainda</option>
                      </select>
                    </div>

                    <textarea
                      rows={2}
                      value={customSkillDesc}
                      onChange={(e) => setCustomSkillDesc(e.target.value)}
                      placeholder="Como essa perícia atua narrativamente na história..."
                      className="w-full px-2.5 py-1.5 rounded bg-[#0f0f14] border border-slate-700 text-slate-300 text-xs leading-relaxed"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomSkill(false)}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomSkill}
                        className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Salvar Perícia
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* -----------------------------------------------------------------
                COLUMN 2 (RIGHT, col-span-7):
                - Vitais de Combate Trio (Guarda, Reação, Output)
                - Grimório da Técnica Inata (Lapso, Reversão, Máxima, RCT, Anti-Domínio)
                - Arsenal & Ferramentas Amaldiçoadas
                - Portal de Expansão de Domínio
                - Arco Cronológico & Cena de Início da Campanha (Campo Grande)
               ----------------------------------------------------------------- */}
            <div
              className={`${
                mobileSheetTab === 'technique' || mobileSheetTab === 'all' ? 'block' : 'hidden'
              } lg:block lg:col-span-7 space-y-5 min-w-0`}
            >
              {/* Combat Stats Trio (D&D 5e Armor Class, Initiative, Speed equivalent) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="dnd5e-framed-box text-center">
                  <div className="text-sm sm:text-base font-display font-bold text-sky-400 break-words">
                    {currentFaction.isHr ? 'SOBRE-HUMANA' : 'REFORÇO EA'}
                  </div>
                  <div className="dnd5e-section-caption">GUARDA & DEFESA (CA)</div>
                </div>

                <div className="dnd5e-framed-box text-center">
                  <div className="text-sm sm:text-base font-display font-bold text-amber-400 break-words">
                    {selectedGrade.includes('Especial') || selectedGrade.includes('1') ? 'INSTANTÂNEA' : 'AGILIDADE'}
                  </div>
                  <div className="dnd5e-section-caption">INICIATIVA / REAÇÃO</div>
                </div>

                <div className="dnd5e-framed-box text-center">
                  <div className="text-sm sm:text-base font-display font-bold text-rose-400 break-words">
                    100% EA
                  </div>
                  <div className="dnd5e-section-caption">OUTPUT BASE</div>
                </div>
              </div>

              {/* Grimório da Técnica Inata */}
              <div className="dnd5e-framed-box space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/20 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 uppercase tracking-wider">
                    <Sword className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Grimório da Técnica Inata</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTechniqueMode('custom')}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        techniqueMode === 'custom'
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#07070a] text-slate-400'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setTechniqueMode('canon')}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        techniqueMode === 'canon'
                          ? 'bg-sky-600 text-white'
                          : 'bg-[#07070a] text-slate-400'
                      }`}
                    >
                      Canônica
                    </button>
                  </div>
                </div>

                {techniqueMode === 'canon' ? (
                  <div className="space-y-2">
                    <select
                      value={selectedCanonIdx}
                      onChange={(e) => setSelectedCanonIdx(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#07070a] border border-slate-700 text-xs text-white"
                    >
                      {CANONICAL_TECHNIQUES.map((t, idx) => (
                        <option key={t.name} value={idx}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-300 leading-relaxed break-words">
                      {CANONICAL_TECHNIQUES[selectedCanonIdx].description}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Concept & Forge */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[11px] font-semibold text-purple-300" htmlFor="custom-concept-dnd5e">
                          Conceito Central da Técnica Inata
                        </label>
                        <button
                          type="button"
                          onClick={handleGenerateBalancedTechnique}
                          disabled={isGeneratingTech}
                          className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>{isGeneratingTech ? 'Forjando...' : 'Forjar Técnica com IA'}</span>
                        </button>
                      </div>
                      <textarea
                        id="custom-concept-dnd5e"
                        rows={3}
                        value={customConcept}
                        onChange={(e) => setCustomConcept(e.target.value)}
                        placeholder="Descreva o funcionamento e limites da sua técnica..."
                        className="w-full px-2.5 py-2 rounded bg-[#07070a] border border-slate-700 text-xs text-slate-200 leading-relaxed"
                      />
                    </div>

                    {/* Technique Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400" htmlFor="custom-technique-name">
                        Nome da Técnica
                      </label>
                      <input
                        id="custom-technique-name"
                        type="text"
                        value={customTechnique.name}
                        onChange={(e) =>
                          setCustomTechnique({ ...customTechnique, name: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#07070a] border border-slate-700 text-xs text-white font-bold"
                      />
                    </div>

                    {/* Lapso (Lapse) */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase text-sky-400">
                          Lapso da Técnica (Azul / Aplicação Básica)
                        </span>
                        {renderUndevelopedToggle(
                          customTechnique.lapse,
                          () => setCustomTechnique({ ...customTechnique, lapse: UNDEVELOPED_MARKER }),
                          () => setCustomTechnique({ ...customTechnique, lapse: 'Lapso Primário de Energia Amaldiçoada' })
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={customTechnique.lapse}
                        onChange={(e) =>
                          setCustomTechnique({ ...customTechnique, lapse: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#07070a] border border-slate-700 text-xs text-slate-200 leading-relaxed"
                      />
                    </div>

                    {/* Reversão (Reversal) */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase text-rose-400">
                          Reversão da Técnica (Vermelho / Energia Positiva)
                        </span>
                        {renderUndevelopedToggle(
                          customTechnique.reversal,
                          () => setCustomTechnique({ ...customTechnique, reversal: UNDEVELOPED_MARKER }),
                          () => setCustomTechnique({ ...customTechnique, reversal: 'Reversão com Energia Positiva' })
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={customTechnique.reversal}
                        onChange={(e) =>
                          setCustomTechnique({ ...customTechnique, reversal: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#07070a] border border-slate-700 text-xs text-slate-200 leading-relaxed"
                      />
                    </div>

                    {/* Técnica Máxima (Maximum) */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase text-amber-400">
                          Técnica Máxima (Gokunotan)
                        </span>
                        {renderUndevelopedToggle(
                          customTechnique.maximum,
                          () => setCustomTechnique({ ...customTechnique, maximum: UNDEVELOPED_MARKER }),
                          () => setCustomTechnique({ ...customTechnique, maximum: 'Liberação Máxima de Output' })
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={customTechnique.maximum}
                        onChange={(e) =>
                          setCustomTechnique({ ...customTechnique, maximum: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#07070a] border border-slate-700 text-xs text-slate-200 leading-relaxed"
                      />
                    </div>

                    {/* RCT & Anti-Domain */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="p-2.5 rounded bg-[#07070a] border border-slate-800 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-emerald-400">
                            Técnica Reversa (RCT)
                          </span>
                          {renderUndevelopedToggle(
                            customTechnique.hasRct ? 'Desenvolvido' : UNDEVELOPED_MARKER,
                            () => setCustomTechnique({ ...customTechnique, hasRct: false, rctStatus: UNDEVELOPED_MARKER }),
                            () => setCustomTechnique({ ...customTechnique, hasRct: true, rctStatus: 'Desenvolvido' })
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug">
                          {customTechnique.hasRct ? 'Cura de tecidos e membros ativa' : 'Bloqueado (despertará na história)'}
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-[#07070a] border border-slate-800 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-sky-400">
                            Anti-Domínio
                          </span>
                          {renderUndevelopedToggle(
                            customTechnique.antiDomain,
                            () => setCustomTechnique({ ...customTechnique, antiDomain: UNDEVELOPED_MARKER }),
                            () => setCustomTechnique({ ...customTechnique, antiDomain: 'Domínio Simples (Novo Estilo da Sombra)' })
                          )}
                        </div>
                        <input
                          type="text"
                          value={customTechnique.antiDomain || ''}
                          onChange={(e) => setCustomTechnique({ ...customTechnique, antiDomain: e.target.value })}
                          className="w-full px-2 py-1 rounded bg-[#0f0f14] border border-slate-700 text-[11px] text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Arsenal & Ferramentas Amaldiçoadas */}
              <div className="dnd5e-framed-box space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/20 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider">
                    <Sword className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Arsenal & Ferramenta Amaldiçoada</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Item Inicial</span>
                </div>

                <select
                  value={selectedToolIdx}
                  onChange={(e) => setSelectedToolIdx(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded bg-[#07070a] border border-slate-700 text-xs text-white"
                >
                  {INITIAL_TOOLS.map((tool, idx) => (
                    <option key={tool.id} value={idx}>
                      {tool.name} ({tool.grade})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-300 leading-relaxed break-words">
                  {INITIAL_TOOLS[selectedToolIdx].effect}
                </div>
              </div>

              {/* Configuração do Portal de Expansão de Domínio */}
              <div className="dnd5e-framed-box space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/20 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 uppercase tracking-wider">
                    <Zap className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Portal de Expansão de Domínio</span>
                  </div>
                  {renderUndevelopedToggle(
                    isDomainUndeveloped ? UNDEVELOPED_MARKER : domainPortal.domainName,
                    () => setIsDomainUndeveloped(true),
                    () => setIsDomainUndeveloped(false),
                    'Domínio Não desenvolvido ainda'
                  )}
                </div>

                {isDomainUndeveloped ? (
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/40 text-xs text-amber-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>Expansão de Domínio Bloqueada no Início</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Seu Domínio Inato ainda não atingiu o ápice de refinamento. Quando você subir de Nível/Grau ou atingir um Kokusen iluminado, a história despertará seu Domínio automaticamente na sua Ficha Exclusiva!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Nome do Domínio</label>
                        <input
                          type="text"
                          value={domainPortal.domainName}
                          onChange={(e) => setDomainPortal({ ...domainPortal, domainName: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded bg-[#07070a] border border-slate-700 text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Tipo de Barreira</label>
                        <select
                          value={domainPortal.barrierType}
                          onChange={(e) =>
                            setDomainPortal({
                              ...domainPortal,
                              barrierType: e.target.value as DomainBarrierType,
                            })
                          }
                          className="w-full px-2 py-1.5 rounded bg-[#07070a] border border-slate-700 text-white"
                        >
                          {BARRIER_TYPES.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-purple-300">
                        Acerto Garantido (Sure-Hit)
                      </label>
                      <textarea
                        rows={2}
                        value={domainPortal.sureHitEffect}
                        onChange={(e) =>
                          setDomainPortal({ ...domainPortal, sureHitEffect: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#07070a] border border-slate-700 text-slate-200 leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-sky-300">
                        Estilo Visual do Portal
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 pt-1">
                        {PORTAL_STYLES.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() =>
                              setDomainPortal({ ...domainPortal, visualStyle: st.id })
                            }
                            className={`px-2.5 py-1.5 rounded border text-[10px] text-left break-words cursor-pointer ${
                              domainPortal.visualStyle === st.id
                                ? 'bg-purple-600/30 border-purple-500 text-white font-bold'
                                : 'bg-[#07070a] border-slate-800 text-slate-400'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Arco Cronológico & Cena de Início da Campanha (Campo de Texto Maior) */}
              <div className="dnd5e-framed-box space-y-3 border-amber-500/45 bg-[#120e0b]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider font-display">
                    <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Arco Cronológico · Onde a Campanha Irá Iniciar</span>
                  </div>
                  <span className="text-[10px] text-amber-200/80">Ponto de Partida Narrativo</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400" htmlFor="arc-select">
                      Selecionar Arco Base
                    </label>
                    <select
                      id="arc-select"
                      value={selectedArcIdx}
                      onChange={(e) => handleArcChange(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#07070a] border border-amber-500/40 text-xs text-white font-semibold"
                    >
                      {STARTING_ARCS.map((arc, idx) => (
                        <option key={arc.id} value={idx}>
                          {arc.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400" htmlFor="arc-location">
                      Local Exato de Início
                    </label>
                    <input
                      id="arc-location"
                      type="text"
                      value={customArcLocation}
                      onChange={(e) => setCustomArcLocation(e.target.value)}
                      placeholder="Ex: Escola Técnica de Tóquio, Estação de Shibuya..."
                      className="w-full px-2.5 py-2 rounded-lg bg-[#07070a] border border-slate-700 text-xs text-amber-100"
                    />
                  </div>
                </div>

                {STARTING_ARCS[selectedArcIdx]?.initialNpcs?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                    <span className="text-amber-400 font-semibold">Personagens Presentes na Abertura:</span>
                    {STARTING_ARCS[selectedArcIdx].initialNpcs.map((npc, i) => (
                      <span key={npc.name}>
                        {i > 0 && <span className="mx-1 text-slate-600">·</span>}
                        <strong className="text-white">{npc.name}</strong> ({npc.attitude})
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-amber-200" htmlFor="arc-opening-textarea">
                    Cena e Contexto de Abertura da Campanha (Edite ou expanda como desejar)
                  </label>
                  <textarea
                    id="arc-opening-textarea"
                    rows={6}
                    value={customArcDescription}
                    onChange={(e) => setCustomArcDescription(e.target.value)}
                    placeholder="Descreva em detalhes por onde e como sua campanha irá começar (clima, local, missão inicial, personagens ao redor, tensão do momento)..."
                    className="w-full px-3.5 py-3 rounded-xl bg-[#07070a] border border-amber-500/40 text-sm font-narrative text-amber-50 leading-relaxed focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[11px] text-slate-400 leading-snug">
                    O Mestre IA usará este texto como ponto de partida imediato para narrar o Turno #1 da sua campanha.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    data-start="true"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold tracking-wider text-xs sm:text-sm shadow-[0_0_25px_rgba(225,29,72,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Flame className="w-4 h-4 fill-current text-white shrink-0" />
                    <span>Iniciar Campanha neste Arco</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Mobile Floating Quick-Start Bar (< lg) */}
          <div className="lg:hidden sticky bottom-3 z-40 p-2.5 rounded-2xl bg-[#09090e]/95 backdrop-blur-md border border-rose-500/50 shadow-[0_10px_35px_rgba(0,0,0,0.9)] flex items-center justify-between gap-3 safe-bottom">
            <div className="flex items-center gap-2.5 pl-1 min-w-0">
              <div className="w-9 h-9 rounded-lg overflow-hidden border border-rose-500/60 shrink-0 bg-[#07070a]">
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white break-words leading-tight">{name || 'Feiticeiro'}</div>
                <div className="text-[10px] text-purple-300 font-semibold flex flex-wrap items-center gap-1">
                  <span>{selectedGrade}</span>
                  <span>·</span>
                  <span className="text-slate-400">Nv. 1 (100 XP)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(225,29,72,0.5)] flex items-center gap-1.5 shrink-0 cursor-pointer touch-target-min"
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>INICIAR</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
