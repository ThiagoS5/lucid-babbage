import { STARTING_ARCS } from '../src/data/startingArcs';

const mode = process.argv[2] || 'opening';
const arc = STARTING_ARCS[0];

const world = {
  location: arc.location,
  arc: arc.arcLabel,
  activeBarrierOrDomain: 'Nenhum',
  missionObjective: arc.objective,
  timelineAnchor: arc.timeline,
  era: arc.era,
  campaignPremise: arc.premise,
  playerRole: arc.playerRole,
  tone: arc.tone,
  mustEstablish: arc.mustEstablish,
  worldFacts: arc.worldFacts,
  forbiddenEvents: arc.forbidden,
  openingScene: arc.scene,
  startingArcTitle: arc.title,
  npcsInScene: arc.initialNpcs,
};

const character = {
  name: 'Ren Fushiguro',
  appearance:
    'Jovem feiticeiro de 16 anos, cabelo escuro curto, uniforme de gola alta da Escola de Tóquio, olhos cinza e uma cicatriz fina na sobrancelha.',
  backstory:
    'Cresceu em Adachi ouvindo que o céu de Shinjuku tinha sido um acidente. Entrou na escola depois de ver uma maldição devorar o vizinho.',
  combatStyle: 'Controle de distância média, leitura de terreno e vetores.',
  faction: 'Feiticeiro Jujutsu (Escola Técnica de Tóquio)',
  clan: 'Independente / Tóquio',
  grade: 'Grau 4',
  alignmentPhilosophy: 'Proteger quem não pode lutar, mesmo quando a escola manda recuar.',
  personalityTraits: 'Teimoso, atento, fala pouco quando está com medo.',
  ideals: 'Ninguém deveria morrer porque a burocracia demorou.',
  bonds: 'A mãe, que ainda acha que ele estuda em um colégio interno.',
  flaws: 'Confunde teimosia com coragem.',
  hpPercentage: 100,
  cursedEnergyPercentage: 100,
  outputPercentage: 100,
  physicalCondition: 'Intacto',
  techniqueState: 'Ativa',
  inBlackFlashZone: false,
  isHeavenlyRestriction: false,
  technique: {
    name: 'Ressonância do Horizonte Abissal',
    description: 'Manipula vetores cinéticos em um raio curto, absorvendo e devolvendo impacto.',
    lapse: 'Lapso Vetorial: retém o impulso de até três golpes e o devolve na direção apontada.',
    reversal: 'Não desenvolvido ainda',
    maximum: 'Não desenvolvido ainda',
    domainExpansion: 'Pátio do Vazio e dos Relógios Partidos (incompleto)',
    antiDomain: 'Domínio Simples',
  },
  inventory: [],
  bindingVows: [],
  exclusiveSheetMarkdown: '# Ren Fushiguro\nGrau 4. Perícias: Controle de EA (Afinidade), Leitura de Terreno (Maestria), Combate Corporal (Inaptidão).',
};

const payload = {
  model: 'gemini-3.8-flash',
  character,
  world,
  actionMode: 'STORY',
  actionText:
    mode === 'opening'
      ? 'Abrir a campanha: narrar o Turno #1 a partir da cena de abertura.'
      : 'Desço ao saguão, mantenho a mão perto da katana e pergunto a Megumi onde exatamente os seis corpos foram encontrados.',
  diceRoll: 15,
  revealedHandVow: false,
  ragContext: '',
  activeCards: [],
  memoryContext: '',
  isOpening: mode === 'opening',
  startingArcTitle: arc.title,
  customOpeningPrompt: mode === 'opening' ? arc.scene : '',
  recentHistory:
    mode === 'opening'
      ? ''
      : 'Turno 1: Megumi Fushiguro mostrou seis fotos de vítimas com cortes paralelos perto da cratera de Shinjuku e perguntou quantos segundos o jogador precisava para descer. O jogador desceu ao saguão e está diante da porta de aço.',
};

const started = Date.now();
const res = await fetch('http://localhost:3000/api/gemini/turn', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const json = await res.json();
console.log('STATUS', res.status, 'MODEL', json.usedModel, 'FALLBACK', json.usedFallback, 'MS', Date.now() - started);
if (!json.ok || !json.data) {
  console.log(JSON.stringify(json, null, 2).slice(0, 2000));
  process.exit(1);
}
const d = json.data;
const paras = String(d.narrative || '').split(/\n\s*\n/).filter(Boolean);
console.log('PARAGRAPHS', paras.length, 'CHARS', String(d.narrative || '').length);
console.log('NARRATIVE HEAD:\n' + String(d.narrative || '').slice(0, 1600));
console.log('\nENGINE HEAD: ' + String(d.engineLog || '').slice(0, 220));
console.log('SUGGESTIONS: ' + (d.suggestedActions || []).slice(0, 2).join(' | ').slice(0, 220));
