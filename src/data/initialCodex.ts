import type { StoryCard, CursedTechniqueDetails } from '../types/jjk';

export const INITIAL_STORY_CARDS: StoryCard[] = [
  {
    id: 'card-gojo',
    title: 'Satoru Gojo — O Feiticeiro Mais Forte',
    keys: ['satoru gojo', 'gojo', 'seis olhos', 'ilimitado', 'mugen', 'vazio roxo', 'vazio ilimitado', 'lapso azul', 'reversão vermelha'],
    type: 'character',
    value:
      'Feiticeiro de Grau Especial e professor da Escola Técnica de Tóquio. Herdeiro simultâneo dos Seis Olhos (percepção atômica de Energia Amaldiçoada e consumo próximo de zero) e da Técnica do Ilimitado (Mugen). Suas técnicas incluem Infinito (desaceleração assintótica que impede ataques de tocá-lo), Lapso: Azul (atração gravitacional), Reversão: Vermelho (repulsão explosiva com Energia Positiva), Vazio Roxo (colisão de Azul e Vermelho que apaga matéria) e Expansão de Domínio: Vazio Ilimitado (inunda o cérebro do alvo com informação infinita, paralisando-o instantaneamente). Personalidade: irreverente, confiante, provocador com os superiores conservadores, mas profundamente protetor com seus alunos.'
  },
  {
    id: 'card-sukuna',
    title: 'Ryomen Sukuna — O Rei das Maldições',
    keys: ['ryomen sukuna', 'sukuna', 'rei das maldições', 'santuário malevolente', 'clivar', 'desmantelar', 'fuga', 'dedo de sukuna'],
    type: 'character',
    value:
      'O feiticeiro mais letal da Era Heian, encarnado em 20 dedos indestrutíveis de Grau Especial. Sua técnica inata Santuário permite cortes invisíveis: Desmantelar (corte padrão para objetos inanimados e ataques rápidos) e Clivar (ajusta-se automaticamente à resistência e Energia Amaldiçoada do alvo ao toque), além da chama divina Fuga (Kamino). Sua Expansão de Domínio, Santuário Malevolente, não fecha uma barreira externa — manifesta o santuário diretamente no espaço real com alcance de até 200 metros em troca de oferecer uma rota de fuga. Personalidade: hedonista, cruel, arrogante, mas respeita a força genuína.'
  },
  {
    id: 'card-yuji',
    title: 'Yuji Itadori — O Tigre de Sugisawa',
    keys: ['yuji itadori', 'itadori', 'yuji', 'punho divergente', 'receptáculo'],
    type: 'character',
    value:
      'Estudante com força física sobre-humana natural e receptáculo capaz de suprimir Ryomen Sukuna. Especialista em combate corpo a corpo visceral, Punho Divergente (duplo impacto de Energia Amaldiçoada) e recordista no uso do Kokusen (Black Flash). Mais tarde desperta Manipulação de Sangue e o Santuário adaptado a cortes na fronteira da alma. Personalidade: altruísta, determinado a dar uma "morte adequada" às pessoas cercadas por quem as ama.'
  },
  {
    id: 'card-megumi',
    title: 'Megumi Fushiguro — Usuário das Dez Sombras',
    keys: ['megumi fushiguro', 'megumi', 'fushiguro', 'dez sombras', 'mahoraga', 'jardim das sombras quiméricas', 'nue', 'cães divinos'],
    type: 'character',
    value:
      'Feiticeiro de Grau 2 da Escola de Tóquio e descendente do Clã Zenin. Portador da Técnica das Dez Sombras, que usa as próprias sombras como intermediário para invocar até dez Shikigamis (Cães Divinos Totalidade, Nue, Sapo, Grande Serpente, Max Elefante, Fuga do Coelho, Cervo Circular, Touro Perfurante, Tigre Fúnebre e o General Divino de Oito Cabos Mahoraga). Sua Expansão de Domínio incompleta é o Jardim das Sombras Quiméricas. Personalidade: estoico, analítico, tático e disposto a se sacrificar.'
  },
  {
    id: 'card-nobara',
    title: 'Nobara Kugisaki — Técnica do Boneco de Palha',
    keys: ['nobara kugisaki', 'nobara', 'kugisaki', 'boneco de palha', 'ressonância', 'grampo'],
    type: 'character',
    value:
      'Feiticeira da Escola de Tóquio que utiliza um martelo de ferro, pregos imbuídos de Energia Amaldiçoada e um boneco de palha. Suas extensões incluem Grampo (detonação explosiva dos pregos cravados) e Ressonância (atinge diretamente a alma e o corpo principal do inimigo através de qualquer parte decepada ou sangue conectado). Personalidade: feroz, autêntica, orgulhosa e inabalável sob pressão.'
  },
  {
    id: 'card-nanami',
    title: 'Kento Nanami — O Feiticeiro 7:3',
    keys: ['kento nanami', 'nanami', 'proporção', '7:3', 'hora extra', 'overtime', 'colapso'],
    type: 'character',
    value:
      'Feiticeiro de Grau 1 exemplar e mentor pragmático. Sua Técnica da Proporção divide qualquer alvo em segmentos na razão 7:3, criando forçadamente um ponto fraco crítico na marca de 7/10 até mesmo em inimigos mais fortes. Utiliza o Voto Vinculativo "Hora Extra" (Overtime): restringe sua energia a 80% durante o expediente comercial para saltar a 120% após as 18h00.'
  },
  {
    id: 'card-mahito',
    title: 'Mahito — Transfiguração Inerte',
    keys: ['mahito', 'transfiguração inerte', 'alma', 'auto-encarnação da perfeição', 'humanos transfigurados'],
    type: 'character',
    value:
      'Espírito Amaldiçoado de Grau Especial nascido do ódio e medo entre os humanos. Sua técnica Transfiguração Inerte remodela a forma da alma de quem ele toca, deformando o corpo físico instantaneamente e tornando-o imune a danos convencionais que não atinjam o contorno da alma (exceto se ficar sem Energia Amaldiçoada ou durante Burnout pós-domínio). Domínio: Auto-Encarnação da Perfeição.'
  },
  {
    id: 'card-choso',
    title: 'Choso — Pintura da Morte (Manipulação de Sangue)',
    keys: ['choso', 'manipulação de sangue', 'sangue perfurante', 'supernova', 'escamas vermelhas', 'pintura da morte'],
    type: 'character',
    value:
      'Feto Amaldiçoado das Pinturas da Morte (Grau Especial), meio-humano e meio-espírito amaldiçoado capaz de converter Energia Amaldiçoada diretamente em sangue. Mestre da Manipulação de Sangue: Sangue Perfurante (feixe em velocidade supersônica após Convergência), Supernova (esferas comprimidas que explodem como escopeta em todas as direções) e Escamas Vermelhas Fluentes (doping sanguíneo para velocidade e força).'
  },
  {
    id: 'card-kenjaku',
    title: 'Kenjaku — O Feiticeiro Milenar',
    keys: ['kenjaku', 'suguru geto', 'geto', 'manipulação de espíritos amaldiçoados', 'uzumaki', 'jogo do abate', 'shibuya'],
    type: 'character',
    value:
      'Feiticeiro ancestral de mais de mil anos que transplanta seu cérebro para diferentes corpos (atualmente ocupando o corpo de Suguru Geto). Domina Manipulação de Espíritos Amaldiçoados (incluindo Técnica Máxima: Uzumaki, que extrai técnicas de maldições de Semi-Grau 1 ou superior), Antigravidade, Técnica Reversa avançada e Expansão de Domínio sem barreira (Ventre Profuso de Sonhos). Mente por trás do Incidente de Shibuya e do Jogo do Abate.'
  },
  {
    id: 'card-toji-maki',
    title: 'Restrição Celestial Física (Toji Fushiguro / Maki Zenin)',
    keys: ['toji fushiguro', 'toji', 'maki zenin', 'maki', 'restrição celestial', 'zero energia amaldiçoada', 'split soul katana', 'inverted spear of heaven'],
    type: 'lore',
    value:
      'Portadores de Restrição Celestial completa possuem literalmente ZERO Energia Amaldiçoada. Em troca, seu corpo físico atinge o ápice absoluto: velocidade supersônica, percepção das correntes de ar e temperatura para enxergar maldições, imunidade ao acerto garantido de Expansões de Domínio com barreira fechada (pois barreiras os tratam como objetos inanimados) e capacidade de atravessar barreiras livremente.'
  },
  {
    id: 'card-yuta',
    title: 'Yuta Okkotsu & Rika — Cópia e Reserva Imensa',
    keys: ['yuta okkotsu', 'yuta', 'rika', 'cópia', 'amor verdadeiro e mútuo'],
    type: 'character',
    value:
      'Feiticeiro de Grau Especial com uma reserva de Energia Amaldiçoada ainda maior que a de Satoru Gojo. Acompanhado pela manifestação de Rika, que armazena ferramentas amaldiçoadas e permite o uso de sua técnica inata Cópia por 5 minutos em manifestação total. Domina Técnica Amaldiçoada Reversa (inclusive capaz de curar terceiros) e a Expansão de Domínio Amor Verdadeiro e Mútuo.'
  },
  {
    id: 'card-kokusen',
    title: 'Kokusen (Black Flash / Faísca Negra)',
    keys: ['kokusen', 'black flash', 'faísca negra', 'raio negro', '120%', 'zona'],
    type: 'technique',
    value:
      'Fenômeno espacial em que a Energia Amaldiçoada é aplicada dentro de 0,000001 segundo (um milionésimo de segundo) de um golpe físico. O espaço se distorce, a energia brilha em preto e carmesim, e o poder destrutivo é elevado à potência de 2,5. Quem executa um Kokusen entra na "Zona", operando a 120% de seu potencial máximo e compreensão de fluxo de Energia Amaldiçoada.'
  },
  {
    id: 'card-domain',
    title: 'Expansão de Domínio & Técnicas Anti-Domínio',
    keys: ['expansão de domínio', 'ryoiki tenkai', 'domínio simples', 'burnout', 'exaustão', 'acerto garantido', 'cesto oco de vime', 'cortina'],
    type: 'domain',
    value:
      'O ápice da feitiçaria Jujutsu: expande o domínio inato com Energia Amaldiçoada dentro de uma barreira imbuída com a técnica. Concede aumento de status ao usuário e efeito de Acerto Garantido (Sure-Hit). Quando dois domínios colidem, o mais refinado vence. Após o colapso de um Domínio, o usuário sofre Exaustão de Técnica Pós-Domínio (Burnout), tornando a Técnica Inata temporariamente instável ou inutilizável. Contra-medidas incluem Domínio Simples (Novo Estilo da Sombra), Cesto Oco de Vime e Emoção da Pétala Caída.'
  },
  {
    id: 'card-vows',
    title: 'Votos Vinculativos (Binding Vows) & Energia Amaldiçoada Reversa (RCT)',
    keys: ['voto vinculativo', 'binding vow', 'revelar a própria mão', 'técnica amaldiçoada reversa', 'rct', 'energia positiva', 'cura'],
    type: 'lore',
    value:
      'Votos Vinculativos são contratos regidos pela Energia Amaldiçoada. "Revelar a Própria Mão" (explicar honestamente o funcionamento da própria técnica ao oponente) aumenta imediatamente o Output e a eficácia da técnica. Já a Técnica Amaldiçoada Reversa (RCT) multiplica energia negativa por energia negativa para gerar Energia Positiva, capaz de regenerar carne e membros humanos ou desintegrar Espíritos Amaldiçoados instantaneamente, mas consome o dobro de Energia Amaldiçoada.'
  }
];

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

