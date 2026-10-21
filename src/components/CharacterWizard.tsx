import React, { useState } from 'react';
import {
  CharacterSheet,
  CursedTechniqueDetails,
  CursedToolItem,
  DomainBarrierType,
  DomainPortalConfig,
  DomainPortalStyle,
  SessionZeroChatEntry,
  UNDEVELOPED_MARKER,
  WorldStateUpdate,
} from '../types/jjk';
import { CANONICAL_TECHNIQUES } from '../data/initialCodex';
import {
  DEFAULT_STARTING_ARC,
  STARTING_ARC_ERAS,
  STARTING_ARCS,
} from '../data/startingArcs';
import {
  buildExclusiveCharacterSheetMarkdown,
  isSectionUndeveloped,
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
  ArrowRight,
} from 'lucide-react';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}

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
  {
    id: 'Feiticeiro Despertado pelo Jogo do Abate (Estilo Higuruma/Takaba)',
    clan: 'Desperto Moderno',
    isHr: false,
  },
  {
    id: 'Feiticeiro Reencarnado do Período Heian/Edo (Estilo Kashimo/Ryu/Uro)',
    clan: 'Reencarnado',
    isHr: false,
  },
  {
    id: 'Cadáver Amaldiçoado Mutante (Estilo Panda)',
    clan: 'Cadáver Amaldiçoado',
    isHr: false,
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
    name: 'Lâmina Herdada (Selada — Evolutiva)',
    grade: 'Grau 3 (Evolutiva até Grau Especial)',
    effect: 'Ferramenta amaldiçoada de linhagem com poder selado. Libera novas habilidades a cada promoção de Grau do portador.',
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
  // Identity and narrative header fields
  const [name, setName] = useState('Ren Fushiguro');
  const [age, setAge] = useState('16');
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

  // Binding Vow (Voto principal) + votos livres
  const [customVowName, setCustomVowName] = useState('Revelar a Própria Mão');
  const [customVowCondition, setCustomVowCondition] = useState(
    'Explicar abertamente o funcionamento da Técnica Inata ao inimigo em combate.'
  );
  const [customVowBonus, setCustomVowBonus] = useState(
    'A técnica se torna mais eficaz na ficção porque o oponente agora conhece (e pode explorar) o seu funcionamento.'
  );
  const [extraVows, setExtraVows] = useState<{ name: string; condition: string; bonus: string }[]>([]);
  const [newVowName, setNewVowName] = useState('');
  const [newVowCondition, setNewVowCondition] = useState('');
  const [newVowBonus, setNewVowBonus] = useState('');

  // Restrição Celestial (Tenshin Jubaku) modular
  const [heavenlyRestriction, setHeavenlyRestriction] = useState<{
    type: 'nenhuma' | 'fisica' | 'espiritual' | 'parcial';
    price: string;
    benefit: string;
  }>({ type: 'nenhuma', price: '', benefit: '' });

  // Criação de Clã / Linhagem
  const [clanTrait, setClanTrait] = useState('');
  const [clanTradition, setClanTradition] = useState('');
  const [clanStatus, setClanStatus] = useState('Clã Independente');

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
      'Exige tocar a superfície ou o ar com a palma da mão antes de gravar um vetor; explicar a regra do atraso cinético torna a técnica mais previsível — e mais perigosa quando o oponente acredita tê-la entendido.',
  });
  const [isGeneratingTech, setIsGeneratingTech] = useState(false);

  // Arsenal & Starting Arc
  const [selectedToolId, setSelectedToolId] = useState('tool-katana');
  const [toolMode, setToolMode] = useState<'none' | 'canon' | 'custom'>('canon');
  const [customToolName, setCustomToolName] = useState('');
  const [customToolGrade, setCustomToolGrade] = useState('Grau 3');
  const [customToolEffect, setCustomToolEffect] = useState('');
  const [startWithVow, setStartWithVow] = useState(true);
 const [selectedArcIdx, setSelectedArcIdx] = useState(0);
  const [customArcDescription, setCustomArcDescription] = useState(
    () => DEFAULT_STARTING_ARC.scene
  );
  const [customArcLocation, setCustomArcLocation] = useState(
    () => DEFAULT_STARTING_ARC.location
  );

  // Interactive Session Zero
  const [sessionZeroChat, setSessionZeroChat] = useState<SessionZeroChatEntry[]>([]);
  const [sessionZeroReplyInput, setSessionZeroReplyInput] = useState('');
  const [isEvaluatingSessionZero, setIsEvaluatingSessionZero] = useState(false);
  const [sessionZeroStatus, setSessionZeroStatus] = useState<'IDLE' | 'NEEDS_BALANCING' | 'BALANCED_READY'>('IDLE');
  const [latestProposedPatch, setLatestProposedPatch] = useState<SessionZeroChatEntry['proposedCharacterPatch'] | null>(null);

  const canonicalTools = INITIAL_TOOLS.filter((tool) => tool.id !== 'tool-undeveloped');
  const selectedCanonicalTool =
    canonicalTools.find((tool) => tool.id === selectedToolId) ?? canonicalTools[0];

  const currentFaction = FACTIONS[selectedFactionIdx];

  const handleFactionChange = (idx: number) => {
    setSelectedFactionIdx(idx);
    setCustomClan(FACTIONS[idx].clan);
    if (FACTIONS[idx].isHr) {
      setHeavenlyRestriction({
        type: 'fisica',
        price: 'Zero Energia Amaldiçoada',
        benefit: 'Corpo sobre-humano, sentidos aguçados e invisibilidade para barreiras.',
      });
    }
  };

  const handleArcChange = (idx: number) => {
    setSelectedArcIdx(idx);
    const arc = STARTING_ARCS[idx];
    if (arc) {
      setCustomArcDescription(arc.scene);
      setCustomArcLocation(arc.location);
   }
  };

  const handleResetArcScene = () => {
    const arc = STARTING_ARCS[selectedArcIdx];
    if (arc) {
      setCustomArcDescription(arc.scene);
      setCustomArcLocation(arc.location);
    }
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
        customConcept,
        technique: customTechnique,
        vow: startWithVow
          ? {
              name: customVowName,
              condition: customVowCondition,
              bonus: customVowBonus,
            }
          : null,
        tool:
          toolMode === 'none'
            ? null
            : toolMode === 'custom'
            ? customToolName.trim()
              ? {
                  name: customToolName.trim(),
                  grade: customToolGrade.trim() || 'Grau 3',
                  effect: customToolEffect.trim() || 'Ferramenta criada pelo jogador.',
                }
              : null
            : selectedCanonicalTool,
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
    if (patch.vowName) {
      setStartWithVow(true);
      setCustomVowName(patch.vowName);
    }
    if (patch.vowCondition) setCustomVowCondition(patch.vowCondition);
    if (patch.vowBonus) setCustomVowBonus(patch.vowBonus);
    if (patch.toolName) {
      setToolMode('custom');
      setCustomToolName(patch.toolName);
      setCustomToolGrade(patch.toolGrade || 'Grau 3');
      setCustomToolEffect(
        patch.toolEffect || 'Ferramenta Amaldiçoada proposta pelo Mestre na Sessão Zero.'
      );
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
      const prompt = `Official Jujutsu Kaisen anime character portrait by MAPPA studio, ${appearance}, ${combatStyle}, 1:1 square portrait, high contrast cursed energy aura, no text`;
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

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

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

    const customToolRaw =
      toolMode === 'custom' && customToolName.trim()
        ? {
            name: customToolName.trim(),
            grade: customToolGrade.trim() || 'Grau 3',
            effect:
              customToolEffect.trim() ||
              'Ferramenta amaldiçoada criada pelo jogador para esta crônica.',
          }
        : null;
    const chosenToolRaw =
      toolMode === 'none'
        ? null
        : toolMode === 'custom'
        ? customToolRaw
        : selectedCanonicalTool ?? null;
    const chosenTool: CursedToolItem | null = chosenToolRaw
      ? {
          id: 'tool-chosen',
          name: chosenToolRaw.name,
          grade: chosenToolRaw.grade,
          effect: chosenToolRaw.effect,
          equipped: true,
        }
      : null;
    const chosenArc = STARTING_ARCS[selectedArcIdx];

    const initialInventory: CursedToolItem[] = chosenTool ? [chosenTool] : [];

    const baseCharacter: CharacterSheet = {
      name: name.trim(),
      age: age.trim() || undefined,
      appearance: appearance.trim() || UNDEVELOPED_MARKER,
      backstory: backstory.trim() || UNDEVELOPED_MARKER,
      combatStyle: combatStyle.trim() || UNDEVELOPED_MARKER,
      avatarUrl,
      faction: currentFaction.id,
      clan: customClan.trim() || currentFaction.clan,
      clanTrait: clanTrait.trim() || undefined,
      clanTradition: clanTradition.trim() || undefined,
      clanStatus: clanStatus.trim() || undefined,
      grade: selectedGrade,
      alignmentPhilosophy,
      personalityTraits: personalityTraits.trim() || UNDEVELOPED_MARKER,
      ideals: ideals.trim() || UNDEVELOPED_MARKER,
      bonds: bonds.trim() || UNDEVELOPED_MARKER,
      flaws: flaws.trim() || UNDEVELOPED_MARKER,
      isHeavenlyRestriction: currentFaction.isHr || heavenlyRestriction.type !== 'nenhuma',
      heavenlyRestriction:
        heavenlyRestriction.type !== 'nenhuma'
          ? {
              type: heavenlyRestriction.type,
              price: heavenlyRestriction.price.trim() || 'A definir',
              benefit: heavenlyRestriction.benefit.trim() || 'A definir',
            }
          : undefined,
      physicalCondition: 'Intacto — Pronto para o primeiro exorcismo',
      technique: chosenTechnique,
      inventory: initialInventory,
      bindingVows: startWithVow
        ? [
            {
              id: 'vow-reveal-hand',
              name: customVowName.trim() || UNDEVELOPED_MARKER,
              condition:
                customVowCondition.trim() ||
                'Explicar abertamente o funcionamento da Técnica Inata ao inimigo em combate.',
              bonus:
                customVowBonus.trim() ||
                'A técnica se torna mais eficaz na ficção porque o oponente agora conhece (e pode explorar) o seu funcionamento.',
              active: false,
            },
            ...extraVows.map((v, i) => ({
              id: `vow-extra-${i}-${Date.now()}`,
              name: v.name.trim() || 'Voto Vinculativo',
              condition: v.condition.trim() || 'Condição a definir.',
              bonus: v.bonus.trim() || 'Bônus a definir.',
              active: false,
            })),
          ]
        : [],
      evolutionHistory: [
        {
          id: `evo-init-${Date.now()}`,
          turnNumber: 1,
          timestamp: new Date().toISOString(),
          title: `Criação da Ficha Oficial (${selectedGrade})`,
          details:
            sessionZeroChat.length > 0
              ? `Personagem conversado com o Mestre na Sessão Zero. Início em ${selectedGrade}, com espaço para despertar o que ainda é semente.`
              : `Ficha Exclusiva inicializada em ${selectedGrade} como ponto de partida narrativo.`,
          gradeAtTime: selectedGrade,
        },
      ],
    };

    baseCharacter.exclusiveSheetMarkdown = buildExclusiveCharacterSheetMarkdown(baseCharacter);

    const openingScene = customArcDescription.trim() || chosenArc.scene;

    const initialWorld: WorldStateUpdate = {
      location: customArcLocation.trim() || chosenArc.location,
      arc: chosenArc.arcLabel,
      activeBarrierOrDomain:
        chosenArc.id === 'shibuya-incident' || chosenArc.id === 'culling-game'
          ? 'Cortina Ativa'
          : 'Nenhum',
      // O objetivo é a missão do arco — nunca a prosa da cena (bug antigo).
      missionObjective: chosenArc.objective,
      timelineAnchor: chosenArc.timeline,
      era: chosenArc.era,
      campaignPremise: chosenArc.premise,
      playerRole: chosenArc.playerRole,
      tone: chosenArc.tone,
      mustEstablish: chosenArc.mustEstablish,
      worldFacts: chosenArc.worldFacts,
      forbiddenEvents: chosenArc.forbidden,
      openingScene,
      startingArcTitle: chosenArc.title,
      npcsInScene: chosenArc.initialNpcs.map((n) => ({
        ...n,
        avatarUrl: generateCanonicalPortraitSvg(n.name),
      })),
    };

    onStartCampaign(baseCharacter, initialWorld, chosenArc.title, openingScene);
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
            : 'bg-[#080605] border-slate-700 text-slate-400 hover:border-amber-500/50 hover:text-amber-300'
        }`}
        title="Marcar ou desmarcar esta seção como 'Não desenvolvido ainda' para despertar durante a história"
      >
        <Lock className="w-2.5 h-2.5 shrink-0" />
        <span>{undeveloped ? `✓ ${label}` : `Marcar "${label}"`}</span>
      </button>
    );
  };

  const selectedArc = STARTING_ARCS[selectedArcIdx] ?? STARTING_ARCS[0];
  const arcsByEra = STARTING_ARC_ERAS.map((era) => ({
    ...era,
    arcs: STARTING_ARCS.map((arc, idx) => ({ arc, idx })).filter(({ arc }) => arc.era === era.id),
  }));

  return (
    <div className="editorial-page max-w-[960px]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="editorial-eyebrow">Ficha de personagem</div>
          <h1 className="editorial-page-title mt-4">Quem entra na história?</h1>
          <p className="editorial-body mt-5 max-w-[620px]">
            Preencha como uma ficha de papel. Escreva livremente: o Mestre lê
            cada linha e a usa na história. Só o nome é obrigatório.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap lg:justify-end">
          {hasExistingCampaign && (
            <button type="button" onClick={onResumeExisting} className="editorial-button editorial-button--ghost">
              <Play className="h-3.5 w-3.5" />
              Retomar crônica
            </button>
          )}
          <label className="editorial-link flex cursor-pointer items-center gap-1.5 whitespace-nowrap border border-[rgba(201,169,106,0.25)] px-3 py-2">
            <FolderOpen className="h-3.5 w-3.5" />
            Importar save
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImportJsonFile(file);
                event.target.value = '';
              }}
            />
          </label>
          <button type="button" onClick={onOpenCloudModal} className="editorial-link flex items-center gap-1.5 whitespace-nowrap border border-[rgba(201,169,106,0.25)] px-3 py-2">
            <Cloud className="h-3.5 w-3.5" />
            Sistema
            <span
              className={
                'ml-1 inline-block h-1.5 w-1.5 rounded-full ' +
                (geminiReport?.state === 'VALID' ? 'bg-[#8fbf8a]' : 'bg-[#b99b63]')
              }
            />
          </button>
        </div>
      </div>

      <form onSubmit={handleStart} className="mt-12 space-y-7">
        <section className="editorial-section">
          <div className="editorial-section-head">
            <span className="editorial-numeral">I</span>
            <h2 className="editorial-section-title">Identidade</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.18)]" />
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <img
                src={avatarUrl}
                alt={name || 'Retrato do feiticeiro'}
                referrerPolicy="no-referrer"
                className="h-28 w-28 border border-[rgba(201,169,106,0.25)] object-cover"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="editorial-link cursor-pointer">
                  <Upload className="mr-1 inline h-3 w-3" />
                  Foto
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadOwnPhoto} />
                </label>
                <button type="button" onClick={handleGenerateAvatar} disabled={isGeneratingAvatar} className="editorial-link">
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  {isGeneratingAvatar ? 'Gerando...' : 'Retrato IA'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPortraitGallery((value) => !value)}
                  className="editorial-link"
                >
                  <ImageIcon className="mr-1 inline h-3 w-3" />
                  Galeria
                </button>
              </div>
              {uploadedPhotoName && (
                <p className="editorial-muted mt-1 max-w-[120px] truncate font-sans text-[9px]">
                  {uploadedPhotoName}
                </p>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label>
                  <span className="editorial-label">Nome</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex.: Kaito Mori"
                    className="editorial-input"
                    required
                  />
                </label>
                <label>
                  <span className="editorial-label">Idade</span>
                  <input
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    placeholder="Ex.: 17"
                    className="editorial-input"
                  />
                </label>
                <label>
                  <span className="editorial-label">Grau de feiticeiro</span>
                  <select
                    value={selectedGrade}
                    onChange={(event) => setSelectedGrade(event.target.value)}
                    className="editorial-select"
                  >
                    {GRADES.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="editorial-label">Clã / Antecedente</span>
                  <input
                    value={customClan}
                    onChange={(event) => setCustomClan(event.target.value)}
                    placeholder="Ex.: Clã Zenin, independente..."
                    className="editorial-input"
                  />
                </label>
              </div>

              <label>
                <span className="editorial-label">Facção</span>
                <select
                  value={selectedFactionIdx}
                  onChange={(event) => handleFactionChange(Number(event.target.value))}
                  className="editorial-select"
                >
                  {FACTIONS.map((faction, index) => (
                    <option key={faction.id} value={index}>
                      {faction.id}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="editorial-label">Aparência</span>
                <textarea
                  value={appearance}
                  onChange={(event) => setAppearance(event.target.value)}
                  placeholder="Rosto, postura, cicatrizes, o que se nota primeiro."
                  className="editorial-textarea"
                  rows={3}
                />
              </label>

              <label>
                <span className="editorial-label">História</span>
                <textarea
                  value={backstory}
                  onChange={(event) => setBackstory(event.target.value)}
                  placeholder="De onde você vem? Como conheceu as maldições? O que perdeu no caminho?"
                  className="editorial-textarea"
                  rows={5}
                />
              </label>

              <label>
                <span className="editorial-label">Motivação</span>
                <textarea
                  value={ideals}
                  onChange={(event) => setIdeals(event.target.value)}
                  placeholder="O que o mantém de pé quando tudo pesa?"
                  className="editorial-textarea"
                  rows={3}
                />
              </label>
            </div>
          </div>

          {showPortraitGallery && (
            <div className="mt-6 border-t border-[rgba(201,169,106,0.18)] pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="editorial-label">Galeria de retratos</span>
                <input
                  value={portraitSearch}
                  onChange={(event) => setPortraitSearch(event.target.value)}
                  placeholder="Buscar retrato..."
                  className="editorial-input sm:max-w-[260px]"
                />
              </div>
              <div className="mt-3 grid max-h-52 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-8">
                {(portraitSearch.trim()
                  ? [
                      ...FEATURED_PORTRAIT_GALLERY.filter((item) =>
                        item.label.toLowerCase().includes(portraitSearch.toLowerCase())
                      ),
                      ...WIKI_PORTRAIT_FILES.filter((file) =>
                        file.toLowerCase().includes(portraitSearch.toLowerCase())
                      )
                        .slice(0, 32)
                        .map((file) => ({
                          id: `wiki-${file}`,
                          label: file.replace(/P(__.*)?\.png$/i, '').replace(/_/g, ' '),
                          url: `/portraits/wiki/${file}`,
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
                    className={
                      'border p-1 text-left transition-colors ' +
                      (avatarUrl === item.url
                        ? 'border-[#c9a96a]'
                        : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(201,169,106,0.4)]')
                    }
                  >
                    <img src={item.url} alt={item.label} loading="lazy" className="aspect-square w-full object-cover" />
                    <span className="editorial-muted mt-1 block truncate font-sans text-[8px]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <details className="mt-6 border-t border-[rgba(201,169,106,0.18)] pt-4">
            <summary className="editorial-link cursor-pointer">
              Traços, filosofia e linhagem
            </summary>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="editorial-label">Personalidade</span>
                <textarea
                  value={personalityTraits}
                  onChange={(event) => setPersonalityTraits(event.target.value)}
                  className="editorial-textarea"
                  rows={3}
                />
              </label>
              <label>
                <span className="editorial-label">Vínculos</span>
                <textarea
                  value={bonds}
                  onChange={(event) => setBonds(event.target.value)}
                  className="editorial-textarea"
                  rows={3}
                />
              </label>
              <label>
                <span className="editorial-label">Defeitos</span>
                <textarea
                  value={flaws}
                  onChange={(event) => setFlaws(event.target.value)}
                  className="editorial-textarea"
                  rows={3}
                />
              </label>
              <label>
                <span className="editorial-label">Filosofia</span>
                <select
                  value={alignmentPhilosophy}
                  onChange={(event) => setAlignmentPhilosophy(event.target.value)}
                  className="editorial-select"
                >
                  {PHILOSOPHIES.map((philosophy) => (
                    <option key={philosophy} value={philosophy}>
                      {philosophy}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="editorial-label">Estilo de combate</span>
                <textarea
                  value={combatStyle}
                  onChange={(event) => setCombatStyle(event.target.value)}
                  className="editorial-textarea"
                  rows={3}
                />
              </label>
              <label>
                <span className="editorial-label">Traço do clã</span>
                <input
                  value={clanTrait}
                  onChange={(event) => setClanTrait(event.target.value)}
                  placeholder="Ex.: sombras líquidas, olhos que leem o fluxo..."
                  className="editorial-input"
                />
              </label>
              <label>
                <span className="editorial-label">Tradição do clã</span>
                <input
                  value={clanTradition}
                  onChange={(event) => setClanTradition(event.target.value)}
                  placeholder="História, reputação, dívidas..."
                  className="editorial-input"
                />
              </label>
              <label>
                <span className="editorial-label">Status do clã</span>
                <input
                  value={clanStatus}
                  onChange={(event) => setClanStatus(event.target.value)}
                  className="editorial-input"
                />
              </label>
              <div>
                <span className="editorial-label">Restrição celestial</span>
                <select
                  value={heavenlyRestriction.type}
                  onChange={(event) =>
                    setHeavenlyRestriction((prev) => ({
                      ...prev,
                      type: event.target.value as typeof prev.type,
                    }))
                  }
                  className="editorial-select"
                >
                  <option value="nenhuma">Nenhuma</option>
                  <option value="fisica">Física (corpo sobre-humano)</option>
                  <option value="espiritual">Espiritual (percepção ampliada)</option>
                  <option value="parcial">Parcial</option>
                </select>
              </div>
              {heavenlyRestriction.type !== 'nenhuma' && (
                <>
                  <label>
                    <span className="editorial-label">Preço</span>
                    <input
                      value={heavenlyRestriction.price}
                      onChange={(event) =>
                        setHeavenlyRestriction((prev) => ({ ...prev, price: event.target.value }))
                      }
                      className="editorial-input"
                    />
                  </label>
                  <label>
                    <span className="editorial-label">Benefício</span>
                    <input
                      value={heavenlyRestriction.benefit}
                      onChange={(event) =>
                        setHeavenlyRestriction((prev) => ({ ...prev, benefit: event.target.value }))
                      }
                      className="editorial-input"
                    />
                  </label>
                </>
              )}
            </div>
          </details>
        </section>

        <section className="editorial-section">
          <div className="editorial-section-head">
            <span className="editorial-numeral">II</span>
            <h2 className="editorial-section-title">Técnica inata</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.18)]" />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-4">
            {(
              [
                ['custom', 'Original'],
                ['canon', 'Canônica'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTechniqueMode(id)}
                className={
                  'border-b pb-1 font-sans text-[10px] uppercase tracking-[0.16em] transition-colors ' +
                  (techniqueMode === id
                    ? 'border-[#c9a96a] text-[#e6cfa2]'
                    : 'border-transparent text-[#837968] hover:text-[#d8bd86]')
                }
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleGenerateBalancedTechnique}
              disabled={isGeneratingTech}
              className="editorial-link ml-auto flex items-center gap-1.5"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {isGeneratingTech ? 'Forjando...' : 'Forjar com IA'}
            </button>
          </div>

          {techniqueMode === 'canon' ? (
            <div className="space-y-4">
              <label>
                <span className="editorial-label">Técnica canônica</span>
                <select
                  value={selectedCanonIdx}
                  onChange={(event) => setSelectedCanonIdx(Number(event.target.value))}
                  className="editorial-select"
                >
                  {CANONICAL_TECHNIQUES.map((technique, index) => (
                    <option key={technique.name} value={index}>
                      {technique.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="editorial-body text-[1.02rem]">
                {CANONICAL_TECHNIQUES[selectedCanonIdx].description}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label>
                  <span className="editorial-label">Nome da técnica</span>
                  <input
                    value={customTechnique.name}
                    onChange={(event) =>
                      setCustomTechnique({ ...customTechnique, name: event.target.value })
                    }
                    placeholder="Ex.: Fio de Retorno"
                    className="editorial-input"
                  />
                </label>
                <label>
                  <span className="editorial-label">Conceito central</span>
                  <input
                    value={customConcept}
                    onChange={(event) => setCustomConcept(event.target.value)}
                    placeholder="Vetores, sombras, palavras, memória..."
                    className="editorial-input"
                  />
                </label>
              </div>
              <label>
                <span className="editorial-label">Como funciona</span>
                <textarea
                  value={customTechnique.description}
                  onChange={(event) =>
                    setCustomTechnique({ ...customTechnique, description: event.target.value })
                  }
                  placeholder="Descreva o efeito, o alcance e como ela se manifesta."
                  className="editorial-textarea"
                  rows={4}
                />
              </label>
              <label>
                <span className="editorial-label">Custo e limites</span>
                <textarea
                  value={customTechnique.activationConditions}
                  onChange={(event) =>
                    setCustomTechnique({ ...customTechnique, activationConditions: event.target.value })
                  }
                  placeholder="Memória, cansaço, condições para usar..."
                  className="editorial-textarea"
                  rows={3}
                />
              </label>
              <p className="editorial-muted font-sans text-[10px] italic">
                Toda técnica cobra um preço. O Mestre o fará valer.
              </p>
            </div>
          )}

          <details className="mt-6 border-t border-[rgba(201,169,106,0.18)] pt-4">
            <summary className="editorial-link cursor-pointer">Extensões da técnica</summary>
            <div className="mt-5 space-y-5">
              {(
                [
                  ['lapse', 'Lapso (aplicação básica)'],
                  ['reversal', 'Reversão (energia positiva)'],
                  ['maximum', 'Técnica máxima'],
                  ['antiDomain', 'Defesa anti-domínio'],
                  ['domainExpansion', 'Expansão de domínio'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="editorial-label flex items-center justify-between gap-3">
                    {label}
                    <span className="normal-case tracking-normal">
                      {renderUndevelopedToggle(
                        customTechnique[key],
                        () => setCustomTechnique({ ...customTechnique, [key]: UNDEVELOPED_MARKER }),
                        () => setCustomTechnique({ ...customTechnique, [key]: 'Despertar a definir na história' })
                      )}
                    </span>
                  </span>
                  <textarea
                    value={customTechnique[key]}
                    onChange={(event) =>
                      setCustomTechnique({ ...customTechnique, [key]: event.target.value })
                    }
                    className="editorial-textarea mt-1"
                    rows={2}
                  />
                </label>
              ))}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label>
                  <span className="editorial-label">RCT</span>
                  <select
                    value={customTechnique.hasRct ? 'sim' : 'nao'}
                    onChange={(event) => {
                      const hasRct = event.target.value === 'sim';
                      setCustomTechnique({
                        ...customTechnique,
                        hasRct,
                        rctStatus: hasRct ? 'Desenvolvido' : UNDEVELOPED_MARKER,
                      });
                    }}
                    className="editorial-select"
                  >
                    <option value="nao">Não desenvolvida</option>
                    <option value="sim">Desenvolvida</option>
                  </select>
                </label>
                <label>
                  <span className="editorial-label">Nome do domínio</span>
                  <input
                    value={domainPortal.domainName}
                    onChange={(event) =>
                      setDomainPortal((prev) => ({ ...prev, domainName: event.target.value }))
                    }
                    className="editorial-input"
                  />
                </label>
              </div>

              <label className="block">
                <span className="editorial-label flex items-center justify-between gap-3">
                  Efeito do domínio
                  <button
                    type="button"
                    onClick={() => setIsDomainUndeveloped((value) => !value)}
                    className="editorial-link normal-case tracking-normal"
                  >
                    {isDomainUndeveloped ? 'Não desenvolvido ainda' : 'Definir efeito'}
                  </button>
                </span>
                <textarea
                  value={isDomainUndeveloped ? UNDEVELOPED_MARKER : domainPortal.sureHitEffect}
                  onChange={(event) =>
                    setDomainPortal((prev) => ({ ...prev, sureHitEffect: event.target.value }))
                  }
                  className="editorial-textarea mt-1"
                  rows={3}
                />
              </label>
            </div>
          </details>
        </section>

        <section className="editorial-section">
          <div className="editorial-section-head">
            <span className="editorial-numeral">III</span>
            <h2 className="editorial-section-title">Votos e vínculos</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.18)]" />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-4">
            {(
              [
                [true, 'Começar com voto'],
                [false, 'Sem voto inicial'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setStartWithVow(value)}
                className={
                  'border-b pb-1 font-sans text-[10px] uppercase tracking-[0.16em] transition-colors ' +
                  (startWithVow === value
                    ? 'border-[#c9a96a] text-[#e6cfa2]'
                    : 'border-transparent text-[#837968] hover:text-[#d8bd86]')
                }
              >
                {label}
              </button>
            ))}
          </div>

          {startWithVow ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="editorial-label">Voto vinculativo</span>
                <input
                  value={customVowName}
                  onChange={(event) => setCustomVowName(event.target.value)}
                  placeholder="Promessas que concedem poder em troca de uma restrição."
                  className="editorial-input"
                />
              </label>
              <label>
                <span className="editorial-label">Condição</span>
                <textarea
                  value={customVowCondition}
                  onChange={(event) => setCustomVowCondition(event.target.value)}
                  className="editorial-textarea"
                  rows={3}
                />
              </label>
              <label>
                <span className="editorial-label">O que o voto muda</span>
                <textarea
                  value={customVowBonus}
                  onChange={(event) => setCustomVowBonus(event.target.value)}
                  className="editorial-textarea"
                  rows={3}
                />
              </label>
            </div>
          ) : (
            <p className="editorial-body text-[1rem]">
              Seu personagem começa livre de votos. Se a história cobrar uma promessa —
              ou se você quiser selar uma durante a campanha — o Mestre registra o voto
              na Ficha Exclusiva.
            </p>
          )}
        </section>

        <section className="editorial-section">
          <div className="editorial-section-head">
            <span className="editorial-numeral">IV</span>
            <h2 className="editorial-section-title">Equipamento</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.18)]" />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-4">
            {(
              [
                ['none', 'Sem equipamento'],
                ['canon', 'Canônico'],
                ['custom', 'Original'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setToolMode(value)}
                className={
                  'border-b pb-1 font-sans text-[10px] uppercase tracking-[0.16em] transition-colors ' +
                  (toolMode === value
                    ? 'border-[#c9a96a] text-[#e6cfa2]'
                    : 'border-transparent text-[#837968] hover:text-[#d8bd86]')
                }
              >
                {label}
              </button>
            ))}
          </div>

          {toolMode === 'none' ? (
            <p className="editorial-body text-[1rem]">
              Você começa sem ferramenta amaldiçoada. Nada de arsenal herdado ou
              talismã de cortina: o que você tiver será conquistado, forjado ou
              perdido na história.
            </p>
          ) : toolMode === 'canon' ? (
            <div className="space-y-4">
              <label>
                <span className="editorial-label">Ferramenta canônica</span>
                <select
                  value={selectedCanonicalTool.id}
                  onChange={(event) => setSelectedToolId(event.target.value)}
                  className="editorial-select"
                >
                  {canonicalTools.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name} — {tool.grade}
                    </option>
                  ))}
                </select>
              </label>
              <div className="border border-[rgba(201,169,106,0.2)] p-4">
                <div className="editorial-label">Ferramenta selecionada</div>
                <h3 className="editorial-serif mt-1 text-[19px] leading-tight text-[#e7ddcb]">
                  {selectedCanonicalTool.name}
                </h3>
                <p className="editorial-muted mt-1 font-sans text-[10px] uppercase tracking-[0.12em]">
                  {selectedCanonicalTool.grade}
                </p>
                <p className="editorial-body mt-3 text-[0.98rem]">
                  {selectedCanonicalTool.effect}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
                <label>
                  <span className="editorial-label">Nome do equipamento</span>
                  <input
                    value={customToolName}
                    onChange={(event) => setCustomToolName(event.target.value)}
                    placeholder="Ex.: Fio de Retorno"
                    className="editorial-input"
                  />
                </label>
                <label>
                  <span className="editorial-label">Grau / categoria</span>
                  <input
                    value={customToolGrade}
                    onChange={(event) => setCustomToolGrade(event.target.value)}
                    placeholder="Ex.: Grau 2, utilitário..."
                    className="editorial-input"
                  />
                </label>
              </div>
              <label>
                <span className="editorial-label">Efeito e limites</span>
                <textarea
                  value={customToolEffect}
                  onChange={(event) => setCustomToolEffect(event.target.value)}
                  placeholder="O que ele faz? Qual é o custo de usá-lo?"
                  className="editorial-textarea"
                  rows={4}
                />
              </label>
              <p className="editorial-muted font-sans text-[10px] italic">
                Ferramentas também cobram um preço. O Mestre o fará valer.
              </p>
            </div>
          )}
        </section>

        <section className="editorial-section">
          <div className="editorial-section-head">
            <span className="editorial-numeral">V</span>
            <h2 className="editorial-section-title">Onde a história começa</h2>
            <span className="h-px flex-1 bg-[rgba(201,169,106,0.18)]" />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label>
              <span className="editorial-label">Arco inicial</span>
              <select
                value={selectedArcIdx}
                onChange={(event) => handleArcChange(Number(event.target.value))}
                className="editorial-select"
              >
                {arcsByEra.map((group) => (
                  <optgroup key={group.id} label={group.label}>
                    {group.arcs.map(({ arc, idx }) => (
                      <option key={arc.id} value={idx}>
                        {arc.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              <span className="editorial-label">Local</span>
              <input
                value={customArcLocation}
                onChange={(event) => setCustomArcLocation(event.target.value)}
                className="editorial-input"
              />
            </label>
            <label className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="editorial-label">Cena de abertura</span>
                <button type="button" onClick={handleResetArcScene} className="editorial-link normal-case tracking-normal">
                  Restaurar cena do arco
                </button>
              </div>
              <textarea
                value={customArcDescription}
                onChange={(event) => setCustomArcDescription(event.target.value)}
                className="editorial-textarea mt-1"
                rows={5}
              />
            </label>
          </div>
        </section>

        <details className="editorial-section">
          <summary className="editorial-link cursor-pointer">
            VI · Sessão Zero com o Mestre
            {sessionZeroStatus === 'BALANCED_READY' ? ' · conversada' : ''}
          </summary>
          <p className="editorial-muted mt-3 font-sans text-[11px] leading-relaxed">
            Converse sobre o personagem, os limites e os custos da técnica. O Mestre
            pode propor ajustes narrativos — nunca números.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleRunSessionZero()}
              disabled={isEvaluatingSessionZero}
              className="editorial-button editorial-button--ghost"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {isEvaluatingSessionZero ? 'Mestre avaliando...' : 'Conversar com o Mestre'}
            </button>
            {latestProposedPatch && (
              <button
                type="button"
                onClick={() => handleApplyProposedPatch(latestProposedPatch)}
                className="editorial-link flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aplicar proposta
              </button>
            )}
          </div>

          {sessionZeroChat.length > 0 && (
            <div className="mt-5 max-h-80 space-y-3 overflow-y-auto border-t border-[rgba(201,169,106,0.16)] pt-4">
              {sessionZeroChat.map((entry) => (
                <div key={entry.id} className={entry.sender === 'gm' ? '' : 'pl-6'}>
                  <div className="editorial-label">
                    {entry.sender === 'gm' ? 'Mestre' : 'Você'}
                  </div>
                  <p className="editorial-body mt-1 whitespace-pre-line text-[0.98rem]">
                    {entry.text}
                  </p>
                  {entry.questionsForPlayer?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-[11px] text-[#a89b86]">
                      {entry.questionsForPlayer.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <input
              value={sessionZeroReplyInput}
              onChange={(event) => setSessionZeroReplyInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleRunSessionZero();
                }
              }}
              placeholder="Responder ao Mestre..."
              className="editorial-input flex-1"
            />
            <button
              type="button"
              onClick={() => handleRunSessionZero()}
              disabled={isEvaluatingSessionZero || !sessionZeroReplyInput.trim()}
              className="editorial-button px-4"
              aria-label="Enviar resposta"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </details>

        <div className="flex flex-col gap-4 border-t border-[rgba(201,169,106,0.2)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="editorial-muted font-sans text-[11px] italic">
            {name.trim() ? 'Tudo pronto. A primeira cena é do Mestre.' : 'Dê um nome ao personagem para começar.'}
          </p>
          <button type="submit" disabled={!name.trim()} className="editorial-button">
            Começar a história
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
