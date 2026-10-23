import type { StoryCard, CursedTechniqueDetails } from '@/shared/types/jjk';
import initialCardsJson from '../../../json/inicial.json';

/**
 * Cards seed do RPG (Gojo, Sukuna, Yuji, Megumi, Nobara, Nanami, Mahito,
 * Choso, Kenjaku, Yuta, Kokusen, Domínio, Votos).
 *
 * Vivem em `json/inicial.json` — gerados por `npm run codex:extract` — e não
 * mais como array hardcoded neste arquivo. Assim o acervo do Códice tem uma
 * única fonte de verdade por formato: JSON, não TypeScript.
 */
export const INITIAL_STORY_CARDS: StoryCard[] = (initialCardsJson as {
  entries: StoryCard[];
}).entries.map((card) => ({ ...card, source: 'initial' }));

export const CANONICAL_TECHNIQUES: CursedTechniqueDetails[] = [
  {
    name: 'Técnica das Dez Sombras (Ten Shadows)',
    isCanon: true,
    description: 'Usa sombras líquidas como intermediário para invocar até dez Shikigamis exorcizados e armazenar armas ou o próprio corpo nas sombras.',
    lapse: 'Invocação de Cães Divinos, Nue (eletricidade aérea), Sapo (imobilização) e infiltração pelas sombras.',
    reversal: 'Fusão de Sombras (Poço Sem Fundo) — combina dois Shikigamis sem risco de destruição permanente.',
    maximum: 'Invocação combinada de Max Elefante (torrente de pressão) e Cão Divino: Totalidade (garras letais de Grau Especial).',
    domainExpansion: 'Jardim das Sombras Quiméricas (Chimera Shadow Garden) — inunda a área em sombra líquida permitindo múltiplos clones e Shikigamis simultâneos.',
    antiDomain: 'Domínio Simples (Novo Estilo da Sombra)',
    hasRct: false,
  },
  {
    name: 'Manipulação de Sangue (Blood Manipulation)',
    isCanon: true,
    description: 'Controle absoluto sobre o próprio sangue (forma, temperatura, coagulação e velocidade), letal a curto, médio e longo alcance.',
    lapse: 'Convergência + Sangue Perfurante (feixe supersônico) e Escamas Vermelhas Fluentes (aumento drástico de velocidade e reação).',
    reversal: 'Meteorito de Sangue endurecido e Exorcismo Carmesim em área.',
    maximum: 'Supernova — múltiplas esferas de sangue ultra-comprimidas que detonam em todas as direções simultaneamente.',
    domainExpansion: 'Crisol Sanguíneo Carmesim — prisão arterial onde cada batimento cardíaco dispara lanças de sangue com acerto garantido.',
    antiDomain: 'Domínio Simples & Emoção da Pétala Caída',
    hasRct: true,
  },
  {
    name: 'Técnica da Proporção 7:3 (Ratio Technique)',
    isCanon: true,
    description: 'Traça linhas imaginárias dividindo qualquer alvo (vivo ou inanimado) em dez partes e cria forçadamente um ponto crítico na proporção 7:3.',
    lapse: 'Golpe Crítico 7:3 — causa dano contundente/cortante massivo que ignora parte da defesa adversária.',
    reversal: 'Colapso (Collapse) — aplica a proporção 7:3 ao cenário, destruindo pisos, pilares ou túneis inteiros com um único impacto.',
    maximum: 'Divisão de Precisão Absoluta combinada com Faísca Negra (Kokusen).',
    domainExpansion: 'Catedral da Proporção Áurea — marca automaticamente todas as juntas e fluxos de energia do inimigo na razão 7:3.',
    antiDomain: 'Domínio Simples (Novo Estilo da Sombra)',
    hasRct: false,
  },
  {
    name: 'Fala Amaldiçoada (Cursed Speech)',
    isCanon: true,
    description: 'Selo "Olhos e Presas de Serpente" na língua e bochechas que imbui palavras com Energia Amaldiçoada, forçando quem ouve a obedecer.',
    lapse: 'Comandos táticos: "Não se mova!", "Durma!", "Torça!", "Seja esmagado!". Custo proporcional à diferença de Grau.',
    reversal: 'Ressonância Vocal Focada — direciona a onda sonora a um único alvo sem atingir aliados.',
    maximum: 'Comando Absoluto: "Exploda!" / "Desapareça!" — consome imensa Energia Amaldiçoada e exige proteção na garganta.',
    domainExpansion: 'Câmara do Eco Silencioso — as palavras ecoam diretamente na alma do alvo, impossibilitando bloquear os ouvidos com EA.',
    antiDomain: 'Domínio Simples',
    hasRct: true,
  },
  {
    name: 'Feitiçaria de Projeção (Projection Sorcery)',
    isCanon: true,
    description: 'Divide 1 segundo em 24 quadros de animação pré-determinados. Enquanto segue a regra dos 24fps, o usuário atinge velocidade sub-sônica/supersônica.',
    lapse: 'Trajetória de 24 Quadros — quem é tocado pela palma deve obedecer à regra dos 24fps ou fica congelado em um quadro de vidro por 1 segundo.',
    reversal: 'Quebra de Quadro — estilhaça o painel em que o inimigo foi congelado, causando dano explosivo.',
    maximum: 'Aceleração Mach 3 — empilha sequências consecutivas de 24 quadros para velocidade devastadora.',
    domainExpansion: 'Palácio Celular do Tempo — força até mesmo as células individualmente do alvo a obedecerem à regra dos 24 quadros.',
    antiDomain: 'Emoção da Pétala Caída',
    hasRct: false,
  },
  {
    name: 'Restrição Celestial Física Absoluta (Zero Energia Amaldiçoada)',
    isCanon: true,
    description: 'Ausência total de Energia Amaldiçoada em troca de um corpo físico transcendente, cinco sentidos hiper-aguçados e invisibilidade para barreiras.',
    lapse: 'Passo Supersônico, Percepção das Superfícies do Ar e Reflexos Precognitivos.',
    reversal: 'Imunidade a Barreiras & Acerto Garantido — domínios fechados tratam seu corpo como um objeto inanimado.',
    maximum: 'Assassino de Feiticeiros — combinação letal de velocidade invisível com Ferramentas Amaldiçoadas de Grau Especial.',
    domainExpansion: 'Inaplicável (Imune ao Acerto Garantido de Domínios Tradicionais)',
    antiDomain: 'Imunidade Natural por Zero Energia Amaldiçoada',
    hasRct: true,
  },
];


// A definição dos arcos de abertura vive em `src/data/startingArcs.ts`
export {
  STARTING_ARCS,
  DEFAULT_STARTING_ARC,
  STARTING_ARC_ERAS,
} from './startingArcs';
export type { OpeningArc, ArcEra } from './startingArcs';

