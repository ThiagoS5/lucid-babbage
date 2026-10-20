import type { NpcInScene } from '../types/jjk';

export type ArcEra = 'sequel' | 'canon';

/**
 * Ponto de partida de uma campanha.
 *
 * Cada arco entrega ao Mestre de IA um **contrato de abertura** completo:
 * premissa, papel do jogador, cronologia, objetivo, cena canônica, batidas
 * obrigatórias, tom, fatos imutáveis do mundo e limites duros. O jogador edita
 * apenas a cena — o resto é a bússola que impede a IA de derivar ou reiniciar.
 */
export interface OpeningArc {
  id: string;
  era: ArcEra;
  /** Rótulo curto no seletor. */
  title: string;
  /** Rótulo exibido no HUD do mundo (campo `world.arc`). */
  arcLabel: string;
  /** Premissa dramática: o que mudou no mundo e qual pergunta a campanha faz. */
  premise: string;
  /** Quem o jogador é neste arco (posição, autonomia e o que se espera dele). */
  playerRole: string;
  /** Diretrizes de tom que o Mestre deve sustentar. */
  tone: string[];
  /** Âncora cronológica exibida no HUD e enviada ao Mestre. */
  timeline: string;
  /** Local exato do primeiro frame. */
  location: string;
  /** Objetivo imediato do arco (Plot Essentials). */
  objective: string;
  /** Prosa da cena de abertura — pré-preenche o campo editável do jogador. */
  scene: string;
  /** O que o Turno #1 obrigatoriamente precisa colocar em cena. */
  mustEstablish: string[];
  /** Fatos imutáveis do mundo naquele momento (contrato de lore). */
  worldFacts: string[];
  /** Limites duros impostos ao Mestre. */
  forbidden: string[];
  initialNpcs: NpcInScene[];
}

/* -------------------------------------------------------------------------- */
/*   ERA DE SEGUIMENTO — depois do desfecho do mangá                          */
/* -------------------------------------------------------------------------- */

export const SEQUEL_WORLD_FACTS: string[] = [
  'A campanha acontece DEPOIS do desfecho do mangá de Jujutsu Kaisen: o Confronto de Shinjuku já terminou e é passado imutável.',
  'Ryomen Sukuna foi destruído. Kenjaku foi derrotado. Satoru Gojo morreu em combate. Nenhum deles pode voltar — não existem Dedos remanescentes capazes de reencarnar Sukuna.',
  'O alto conselho conservador da Associação de Feitiçaria Jujutsu caiu após a revelação de sua cumplicidade com Kenjaku. A política jujutsu vive um vácuo de autoridade e os clãs menores disputam o poder.',
  'As Três Grandes Famílias saíram destroçadas: os Zenin perderam suas lideranças, os Kamo estão sob suspeita e os Gojo ficaram sem herdeiro dos Seis Olhos.',
  'Sobreviveram e atuam publicamente: Yuji Itadori, Megumi Fushiguro, Nobara Kugisaki, Maki Zenin, Yuta Okkotsu, Kinji Hakari, Atsuya Kusakabe e Shoko Ieiri.',
  'Morreram no cânone: Kento Nanami, Choso, Hiromi Higuruma, Hajime Kashimo e Satoru Gojo. O paradeiro de Tengen e de Uraume é desconhecido do mundo dos feiticeiros.',
  'A ameaça não desapareceu com Sukuna: os resíduos de energia amaldiçoada de Shinjuku e das colônias do Jogo do Abate geraram novas anomalias — inclusive maldições que imitam técnicas de feiticeiros mortos.',
  'A Escola Técnica de Tóquio foi reconstruída e reabre com uma turma nova, sob tutela dos sobreviventes. O jogador é um feiticeiro desta nova geração.',
];

export const SEQUEL_FORBIDDEN: string[] = [
  'NÃO ressuscite Gojo, Sukuna, Kenjaku, Nanami, Choso, Higuruma ou Kashimo. O final do mangá é passado imutável.',
  'NÃO recrie o Jogo do Abate, a Fusão (Merger) de Tengen ou os Dedos de Sukuna como ameaça ativa.',
  'NÃO trate Yuji, Megumi, Maki ou Yuta como soluções automáticas: eles são veteranos ocupados, com obrigações próprias, e nunca resolvem a cena no lugar do jogador.',
  'NÃO revele o paradeiro de Tengen ou Uraume sem que a campanha construa essa descoberta em jogo.',
  'NÃO faça o jogador perder a agência: o Mestre narra o mundo, nunca as falas ou decisões do personagem do jogador.',
];

const SEQUEL_TONE: string[] = [
  'Pós-guerra: concreto novo sobre escombros, burocracia e luto contido.',
  'Horror discreto: a ameaça começa como anomalia estatística, não como espetáculo.',
  'Veteranos cansados, nunca mentores onipotentes.',
  'Combate letal e tático, com custo real e sem plot armor.',
];

/* -------------------------------------------------------------------------- */
/*   ERA CANÔNICA — linha do mangá (para quem quiser rejogar o cânone)        */
/* -------------------------------------------------------------------------- */

const CANON_FORBIDDEN: string[] = [
  'NÃO avance além do ponto cronológico do arco escolhido nem conclua eventos futuros do mangá.',
  'NÃO mate nem remova personagens canônicos antes do momento canônico de suas mortes.',
  'NÃO revele ao jogador informações que o próprio cânone ainda não revelou neste ponto da história.',
  'NÃO transforme o jogador em espectador: ele altera os detalhes da cena, não a espinha dorsal do cânone.',
];

const SEQUEL_FACTS_SHORT = SEQUEL_WORLD_FACTS.slice(1, 6);

export const STARTING_ARCS: OpeningArc[] = [
  /* ------------------------------- SEGUIMENTO ------------------------------ */
  {
    id: 'sequel-era-vazia',
    era: 'sequel',
    title: 'Seguimento 1 — A Era Vazia (Recomendado)',
    arcLabel: 'Seguimento — A Era Vazia (pós-desfecho)',
    premise:
      'Três meses depois do Confronto de Shinjuku, Tóquio reconstruiu os prédios e enterrou as perguntas. A Escola Técnica de Tóquio reabre com uma turma nova enquanto resíduos do desfecho continuam matando civis em silêncio — e ninguém sabe se a nova geração vai herdar a feitiçaria ou apenas o trauma dela.',
    playerRole:
      'Primeiro ano da Escola Técnica de Tóquio, ainda sem histórico de campo. Você foi escalado para o primeiro exorcismo porque não há mais ninguém disponível — e porque Megumi Fushiguro pediu especificamente por você.',
    tone: SEQUEL_TONE,
    timeline: '15 de março de 2019, 21h40 — três meses após o Confronto de Shinjuku',
    location: 'Escola Técnica de Jujutsu de Tóquio — Terraço Leste recém-reconstruído',
    objective:
      'Sobreviver ao primeiro exorcismo da nova turma: uma maldição que imita o Desmantelar de Sukuna está matando civis em Shinjuku, e a escola precisa de um feiticeiro no terreno antes de o caso virar crise pública.',
    scene:
      'O terraço leste da Escola Técnica de Tóquio ainda cheira a concreto novo e a tinta fresca. Onde antes havia escombros, agora existe um prédio reconstruído com pressa e dinheiro de emergência — e uma cidade que finge não ter visto um céu se abrir sobre Shinjuku três meses atrás. Você está de pé na beira do terraço, uniforme novo demarcado, sentindo o vento frio de março carregar um resíduo de energia amaldiçoada que não deveria existir: um fio azul-escuro, fino como cabelo, que serpenteia vindo do centro de Shinjuku. Atrás de você, a porta de aço range. Megumi Fushiguro entra com uma pasta fina demais para o peso do que ela contém, o rosto mais velho do que a idade e os olhos fixos no mesmo fio que você sentiu. Ele abre a pasta sobre o parapeito: seis fotos de vítimas, todas com cortes paralelos limpos, todas em um raio de duzentos metros da cratera onde Sukuna caiu. Nenhuma maldição catalogada corta assim. Ele não te pergunta se você está pronto — pergunta quantos segundos você precisa para descer até o saguão.',
    mustEstablish: [
      'A escola reconstruída e o contraste com a cidade que finge não ter visto Shinjuku.',
      'O fio azul-escuro vindo da cratera e o dosímetro amaldiçoado marcando um valor impossível.',
      'Megumi Fushiguro com as seis fotos de cortes paralelos e a pergunta sobre quantos segundos você precisa.',
      'Que a ameaça imita o Desmantelar de Sukuna sem ser Sukuna.',
      'A decisão imediata: descer ao saguão agora ou exigir mais contexto antes de sair.',
    ],
    worldFacts: SEQUEL_WORLD_FACTS,
    forbidden: SEQUEL_FORBIDDEN,
    initialNpcs: [
      {
        name: 'Megumi Fushiguro',
        grade: 'Grau 1',
        hpPercentage: 100,
        status: 'Casaco escuro, pasta de casos na mão, sombras inquietas sob os pés',
        attitude: 'Aliado',
        visualDescription:
          'Detailed anime character portrait in Jujutsu Kaisen MAPPA style of an older Megumi Fushiguro, spiky black hair, dark high-collar uniform, holding a case folder, shadows coiling at his feet',
      },
      {
        name: 'Maldição dos Cortes Gêmeos',
        grade: 'Grau Especial (não catalogada)',
        hpPercentage: 100,
        status: 'Espreita entre os andaimes de Shinjuku, emitindo estalos secos de ar cortado',
        attitude: 'Hostil',
        visualDescription:
          'Grotesque shadow curse made of two parallel vertical blades of crimson cursed energy, floating above rubble in Jujutsu Kaisen MAPPA anime style',
      },
    ],
  },
  {
    id: 'sequel-colonia-residual',
    era: 'sequel',
    title: 'Seguimento 2 — A Colônia que Não Fechou',
    arcLabel: 'Seguimento — Resíduo do Jogo do Abate (Sendai)',
    premise:
      'A barreira de Sendai não caiu quando Kenjaku morreu. Sete meses depois, um quarteirão inteiro continua preso sob uma Kogane rachada que anuncia regras para civis famintos — e a escola manda você entrar porque ninguém mais quer tocar na membrana.',
    playerRole:
      'Segundo escalão da nova turma, designado para uma equipe de resgate comandada por Maki Zenin. Você é o único da equipe que ainda não deve nada a ninguém.',
    tone: [
      'Claustrofobia urbana: um quarteirão comercial que virou aquário.',
      'Horror burocrático: regras antigas ainda matam com educação.',
      'Maki como autoridade impaciente, não como salvadora.',
      'Resgate com relógio correndo e recursos contados.',
    ],
    timeline: '2 de junho de 2019, 18h20 — sete meses após o desfecho',
    location: 'Colônia de Sendai — quarteirão comercial sob uma barreira que nunca caiu',
    objective:
      'Entrar na colônia residual de Sendai, descobrir por que a barreira continua de pé sem Kenjaku e resgatar os civis que viveram sete meses presos sob um Kogane que ainda anuncia regras.',
    scene:
      'A barreira de Sendai deveria ter caído com Kenjaku. Ela não caiu. De fora, é um quarteirão comercial comum de província japonesa — luzes acesas, letreiros piscando, e nenhum som atravessando a membrana de energia amaldiçoada. Encostar a palma na superfície é como tocar a pele de um animal adormecido: a barreira respira. Do outro lado, uma Kogane de casca dourada, menor e mais rachada que as do Jogo do Abate, flutua à altura dos seus olhos e repete em loop o mesmo anúncio seco, com a voz de sempre: "A colônia permanece ativa. Feiticeiros participantes: um. Regra adicional em vigor: ninguém sai até que reste um." Atrás do vidro de uma loja de eletrodomésticos, uma mulher segura a mão de uma criança e não pisca há tempo demais. Atrás de você, Maki Zenin crava a Katana da Alma Dividida no asfalto com um estalo de metal e pergunta, sem se virar, se você entrou ali para resgatar gente ou para fazer pontos.',
    mustEstablish: [
      'A barreira que respira e o quarteirão que parece normal demais.',
      'A Kogane rachada repetindo a regra de que ninguém sai até restar um.',
      'Os civis atrás do vidro — a mulher e a criança que não piscam.',
      'Maki cravando a katana e cobrando a escolha entre resgate e pontuação.',
      'A decisão: abrir a barreira pela porta principal ou pelos telhados.',
    ],
    worldFacts: SEQUEL_WORLD_FACTS,
    forbidden: [
      ...SEQUEL_FORBIDDEN,
      'NÃO reduza a lei da barreira a um detalhe técnico esquecido: ela é uma sentença viva que pode ser quebrada em jogo, com custo.',
    ],
    initialNpcs: [
      {
        name: 'Maki Zenin',
        grade: 'Grau Especial (Restrição Celestial)',
        hpPercentage: 100,
        status: 'Katana da Alma Dividida cravada no asfalto, óculos escuros, impaciente',
        attitude: 'Aliado',
        visualDescription:
          'Detailed anime portrait in Jujutsu Kaisen MAPPA style of Maki Zenin, short green hair, scars, black uniform, holding the Split Soul Katana planted in the ground at night',
      },
      {
        name: 'Kogane Residual',
        grade: 'Objeto Amaldiçoado',
        hpPercentage: 100,
        status: 'Flutuando, rachada, repetindo a regra da colônia em loop',
        attitude: 'Neutro',
        visualDescription:
          'Small cracked golden floating paper shikigami Kogane with glowing eyes in Jujutsu Kaisen MAPPA anime style, inside a dark barrier alley',
      },
    ],
  },
  {
    id: 'sequel-cratera-shinjuku',
    era: 'sequel',
    title: 'Seguimento 3 — O Aniversário da Cratera',
    arcLabel: 'Seguimento — Um Ano de Shinjuku',
    premise:
      'Um ano depois, Shinjuku decorou as ruas com abóboras de plástico e escondeu a cratera atrás de uma cortina cinzenta. Na noite do aniversário, o resíduo de energia amaldiçoada no epicentro acorda — e a cidade que aprendeu a não perguntar está prestes a pagar por isso.',
    playerRole:
      'Feiticeiro de perímetro sob o comando de Yuta Okkotsu. Sua função é medir, conter e sair vivo — não vencer o que está no centro.',
    tone: [
      'Festival e luto no mesmo plano, sem ironia fácil.',
      'Contagem regressiva: quinze minutos até a cortina fechar.',
      'Ecos que imitam o passado, mas não são o passado.',
      'Terror silencioso antes do primeiro corte.',
    ],
    timeline: '31 de outubro de 2019, 19h15 — um ano após o Incidente de Shibuya',
    location: 'Shinjuku — cratera do Confronto Final, isolada por uma Cortina de contenção',
    objective:
      'Conter a onda de maldições que desperta na cratera na noite do aniversário de Shinjuku, enquanto a cidade celebra como se nada tivesse acontecido.',
    scene:
      'Um ano depois, Shinjuku decorou as ruas com abóboras de plástico e promessas de desconto. Ninguém comenta a cratera. Ela está coberta por uma Cortina de contenção cinzenta que a Associação improvisou sem explicar a ninguém, e os prédios ao redor foram esvaziados com a desculpa de reforma estrutural. Você está no perímetro, no ponto onde o resíduo de energia amaldiçoada se acumula como neblina rasa no chão, e o dosímetro amaldiçoado pendurado no seu pescoço marca um valor que não deveria ser possível um ano depois. No centro da cratera, onde Sukuna caiu, a neblina se enrola em formas: primeiro uma mão, depois um corte vertical no ar, depois algo que começa a falar com a voz de ninguém. Atrás de você, Yuta Okkotsu fecha a Cortina com um gesto cansado e diz que vai dar quinze minutos antes de fechar tudo com você dentro, se for preciso.',
    mustEstablish: [
      'Halloween falso sobre a cratera coberta e os prédios vazios.',
      'A neblina residual e o dosímetro marcando além do possível.',
      'As formas que se condensam na cratera — mão, corte vertical, voz sem dono.',
      'Yuta fechando a cortina e os quinze minutos.',
      'A decisão: descer à cratera agora ou segurar o perímetro e evacuar o quarteirão.',
    ],
    worldFacts: SEQUEL_WORLD_FACTS,
    forbidden: [
      ...SEQUEL_FORBIDDEN,
      'NÃO trate os ecos de Sukuna como Sukuna: são resíduos, não reencarnações, e não podem reproduzir o Santuário Malevolente completo.',
    ],
    initialNpcs: [
      {
        name: 'Yuta Okkotsu',
        grade: 'Grau Especial',
        hpPercentage: 100,
        status: 'Apoiado no carro, selando a Cortina, olheiras profundas, Rika adormecida',
        attitude: 'Aliado',
        visualDescription:
          'Detailed anime portrait in Jujutsu Kaisen MAPPA style of Yuta Okkotsu in a dark coat with tired eyes, cursed energy ring glowing faintly behind him at night',
      },
      {
        name: 'Eco do Santuário',
        grade: 'Grau Especial (fenômeno residual)',
        hpPercentage: 100,
        status: 'Formas de corte se condensando na neblina da cratera',
        attitude: 'Hostil',
        visualDescription:
          'Ghostly crimson slash marks forming a faceless silhouette above a ruined crater, residual cursed energy fog, Jujutsu Kaisen MAPPA anime style',
      },
    ],
  },
  {
    id: 'sequel-vacuo-politico',
    era: 'sequel',
    title: 'Seguimento 4 — O Conselho Vazio',
    arcLabel: 'Seguimento — O Vácuo Político Jujutsu',
    premise:
      'O Conselho Superior caiu, e o vácuo de poder virou uma assembleia provisória em Kyoto. Em uma sala com teto rachado, um enviado sem clã propõe devolver à feitiçaria um líder vitalício com poder de veto — e a nova geração tem voz, mas ainda não tem voto.',
    playerRole:
      'Representante convocado da nova turma de Tóquio. Você não tem assento formal, tem uma advertência manuscrita para não falar demais — e a única testemunha disposta a apoiar você é Kusakabe.',
    tone: [
      'Política de sala fechada, com sorrisos e canetas.',
      'Violência latente sob protocolo e chá frio.',
      'Kusakabe como consciência cínica, não como herói.',
      'A vitória possível é um argumento, não um soco.',
    ],
    timeline: '12 de janeiro de 2020, 09h00 — treze meses após o desfecho',
    location: 'Kyoto — salão do antigo Conselho Superior, ocupado por uma assembleia provisória',
    objective:
      'Representar a nova geração na assembleia que vai decidir quem governa a feitiçaria japonesa — e impedir que um clã oportunista transforme o vácuo de poder em uma nova tirania.',
    scene:
      'O salão do antigo Conselho Superior em Kyoto tem o teto rachado e ninguém mandou consertar. Onde antes se sentavam anciãos que assinaram o extermínio de civis, agora há uma mesa provisória de madeira barata e dezenas de feiticeiros que nunca tiveram voz — independentes, clãs menores, sobreviventes das colônias. Você foi convocado como representante da nova turma de Tóquio, e a convocação veio com uma pequena advertência manuscrita: não fale mais do que o necessário. Na ponta da mesa, um homem de terno cinza sem brasão de clã propõe formalmente que a Associação volte a ter um único líder vitalício com poder de veto sobre exorcismos — e recebe aplausos de metade da sala. Atsuya Kusakabe, sentado ao seu lado com uma xícara de chá frio, murmura que a última pessoa que teve esse poder mandou matar Yuji Itadori e que talvez você queira dizer alguma coisa antes que a votação comece.',
    mustEstablish: [
      'A mesa provisória, o teto rachado e os feiticeiros sem voz.',
      'O enviado de terno cinza sem brasão e a proposta de líder vitalício.',
      'Os aplausos imediatos de metade da sala.',
      'Kusakabe, o chá frio e a lembrança do que esse poder já custou.',
      'A votação iminente e a escolha: falar, negociar nos bastidores ou deixar correr.',
    ],
    worldFacts: SEQUEL_WORLD_FACTS,
    forbidden: [
      ...SEQUEL_FORBIDDEN,
      'NÃO resolva a assembleia sem o jogador: a política avança pelas escolhas dele, não por decreto do Mestre.',
    ],
    initialNpcs: [
      {
        name: 'Atsuya Kusakabe',
        grade: 'Grau 1',
        hpPercentage: 100,
        status: 'Encostado na cadeira, chá frio na mão, olhos atentos',
        attitude: 'Aliado',
        visualDescription:
          'Detailed anime portrait in Jujutsu Kaisen MAPPA style of Atsuya Kusakabe in a dark suit with tie and glasses, holding a teacup in a cracked council hall',
      },
      {
        name: 'Enviado Sem Brasão',
        grade: 'Grau 1',
        hpPercentage: 100,
        status: 'De pé na ponta da mesa, terno cinza, discurso ensaiado',
        attitude: 'Neutro',
        visualDescription:
          'Detailed anime portrait in Jujutsu Kaisen MAPPA style of an unmarked grey-suited sorcerer politician mid-speech in a ruined council chamber',
      },
    ],
  },
  {
    id: 'custom-arc',
    era: 'sequel',
    title: 'Início Livre — Plantão Noturno (editável)',
    arcLabel: 'Crônica Personalizada — Plantão Noturno',
    premise:
      'Um edifício comum em Adachi, três desaparecimentos no mesmo elevador e uma escola com gente de menos. É o primeiro caso em que você é o único feiticeiro em campo — e o relatório oficial já classificou o incidente como menor.',
    playerRole:
      'Feiticeiro de plantão da nova turma de Tóquio, sozinho, sem veterano por perto e com uma Cortina de contenção que precisa segurar até o amanhecer.',
    tone: [
      'Horror doméstico e vertical: corredores, elevador, vizinhos que não abrem a porta.',
      'Silêncio de prédio residencial às duas da manhã.',
      'Uma ameaça que aprende com cada desaparecimento.',
      'Sem cavalaria chegando: você é a resposta da escola.',
    ],
    timeline: 'Novembro de 2019, 02h10 — vinte meses após o desfecho',
    location: 'Tóquio, Adachi — Edifício residencial Hoshimi, elevador travado no 7º andar',
    objective:
      'Investigar os três desaparecimentos no elevador do Edifício Hoshimi, resgatar a última moradora com vida e descobrir o que alimenta a maldição antes que o prédio seja lacrado pela Associação.',
    scene:
      'O saguão do Edifício Hoshimi cheira a mofo e a ferro. São duas e dez da manhã de um domingo, e o interfone do 302 está tocando sem que ninguém atenda há vinte minutos. O elevador parou no sétimo andar com as portas abertas para um corredor que não aparece no projeto do prédio: em vez do corredor real, há uma parede de concreto úmido e uma lâmpada piscando no ritmo errado. O síndico, um homem de sessenta anos com um casaco por cima do pijama, conta que três moradores entraram nesse elevador nas últimas duas semanas e nenhum voltou — e que a última, Sayaka Mori, do 704, ainda manda mensagens de voz pelo celular, sempre às 2h10, sempre com a mesma frase: "Ainda tem alguém aí?" A Cortina de contenção que você ergueu no saguão já está perdendo tensão. Do lado de fora, um vizinho bate na porta de vidro perguntando o que está acontecendo. E o elevador, aberto no 7º andar, espera.',
    mustEstablish: [
      'O saguão, o interfone e o cheiro de ferro às 2h10.',
      'O elevador aberto para um corredor que não existe no projeto.',
      'O síndico e os três desaparecidos, incluindo Sayaka Mori, do 704.',
      'A mensagem de voz repetida: "Ainda tem alguém aí?".',
      'A Cortina perdendo tensão e a decisão: entrar no elevador ou forçar a porta do apartamento de Sayaka.',
    ],
    worldFacts: [
      'A campanha é ambientada no universo de Jujutsu Kaisen como SEGUIMENTO, após o desfecho do mangá.',
      ...SEQUEL_FACTS_SHORT,
    ],
    forbidden: SEQUEL_FORBIDDEN,
    initialNpcs: [
      {
        name: 'Sayaka Mori',
        grade: 'Civil',
        hpPercentage: 100,
        status: 'Desaparecida no 704; envia mensagens de voz às 2h10',
        attitude: 'Neutro',
        visualDescription:
          'Tired Japanese woman in her late twenties in a worn apartment hallway at night, holding a phone, Jujutsu Kaisen MAPPA anime style',
      },
      {
        name: 'Maldição do Elevador',
        grade: 'Grau 2',
        hpPercentage: 100,
        status: 'Ocupa o 7º andar; imita a voz de quem desapareceu',
        attitude: 'Hostil',
        visualDescription:
          'Twisted humanoid curse fused with a rusted elevator door, mouths on the metal, dim emergency light, Jujutsu Kaisen MAPPA anime style',
      },
    ],
  },
  /* --------------------------- ERA CANÔNICA (2018) ------------------------- */
  {
    id: 'sendai-2018',
    era: 'canon',
    title: 'Canônico 1 — Sendai, O Primeiro Dedo',
    arcLabel: 'Arco de Introdução — Julho de 2018',
    premise:
      'Julho de 2018. Um dos vinte Dedos de Sukuna pulsa em uma escola vazia em Sendai, e a primeira pessoa a chegar não é um herói: é um feiticeiro de plantão e um garoto de dezesseis anos que ainda não sabe o que carrega.',
    playerRole:
      'Feiticeiro de plantão enviado para conter o Dedo antes que o caso vire público — o tipo de missão que costuma matar gente de Grau 4.',
    tone: [
      'Canônico 2018, antes da turma de Tóquio.',
      'Terror noturno escolar, concreto molhado e poste piscando.',
      'Megumi em formação: competente e sozinho.',
      'A maldição sente o Dedo antes de você.',
    ],
    timeline: 'Julho de 2018, 23h30 — Escola Sugisawa, Sendai',
    location: 'Escola Secundária Municipal Sugisawa, Sendai (23h30)',
    objective:
      'Recuperar e selar o Dedo de Sukuna antes que a maldição o devore, proteger os civis e coordenar com Megumi Fushiguro.',
    scene:
      'A Escola Secundária Municipal Sugisawa deveria estar vazia às 23h30. O portão está aberto, o pátio molhado reflete um poste piscando e o ar tem aquela densidade errada que antecede maldições. No segundo andar do prédio, um dos vinte dedos de Ryomen Sukuna pulsa dentro de um selo de papel rasgado, e a pressão espiritual que escapa dele já atraiu algo: um Espírito Amaldiçoado de Grau 2, quatro metros de membros assimétricos, que arranca a esquadria de uma janela e cai no pátio. Você está a dez passos dele. Na sua frente, um garoto de uniforme escuro, Megumi Fushiguro, une as mãos num selo e sombras líquidas sobem do chão para formar duas cabeças de cão.',
    mustEstablish: [
      'Sugisawa vazia às 23h30 e o poste piscando sobre o pátio molhado.',
      'O selo de papel rasgado e o Dedo pulsando no segundo andar.',
      'O Grau 2 de quatro metros arrancando a janela e caindo no pátio.',
      'Megumi formando os Cães Divinos e assumindo o flanco.',
      'A decisão: avançar com Megumi ou conter os civis que ainda estão no prédio.',
    ],
    worldFacts: [
      'A campanha começa na linha do mangá, em julho de 2018, antes da formação oficial da turma de Tóquio.',
      'Satoru Gojo, Megumi Fushiguro, Nobara Kugisaki, Yuji Itadori e Ryomen Sukuna estão vivos e no início de suas trajetórias.',
      'Sukuna ainda está selado em vinte dedos; Yuji Itadori ainda não ingeriu nenhum.',
      'O mundo dos feiticeiros ainda é governado pelo Conselho Superior conservador, que mantém o controle sobre exorcismos e castigos.',
    ],
    forbidden: CANON_FORBIDDEN,
    initialNpcs: [
      {
        name: 'Megumi Fushiguro',
        grade: 'Grau 2',
        hpPercentage: 100,
        status: 'Em guarda, sombras tremulando sob os pés',
        attitude: 'Aliado',
        visualDescription:
          'Detailed anime character portrait in Jujutsu Kaisen MAPPA style of Megumi Fushiguro with spiky black hair and dark blue uniform forming shadow hand signs',
      },
      {
        name: 'Espírito Amaldiçoado do Pátio',
        grade: 'Grau 2',
        hpPercentage: 100,
        status: 'Faminto pela energia do Dedo de Sukuna',
        attitude: 'Hostil',
        visualDescription:
          'Grotesque multi-eyed cursed spirit in Jujutsu Kaisen MAPPA anime style, glowing purple and crimson cursed aura',
      },
    ],
  },
  {
    id: 'tokyo-high',
    era: 'canon',
    title: 'Canônico 2 — Ingresso na Escola de Tóquio',
    arcLabel: 'Escola Técnica de Feitiçaria de Tóquio — Agosto de 2018',
    premise:
      'Agosto de 2018. A Escola Técnica de Tóquio aceita alunos que já viram coisas demais; a avaliação de entrada não mede força, mede se você sobrevive à própria técnica.',
    playerRole:
      'Candidato a aluno do primeiro ano. Yaga avalia a sua contenção; Gojo decide o seu futuro antes de você começar.',
    tone: [
      'Sol de agosto rachando a terra batida.',
      'Avaliação como prova de caráter, não de poder.',
      'Gojo entediado e perigoso, Yaga seco.',
      'Humor discreto no meio da tensão.',
    ],
    timeline: 'Agosto de 2018 — Primeiro dia na Escola Técnica de Tóquio',
    location: 'Pátio de Treinamento da Escola Técnica de Tóquio',
    objective:
      'Passar na avaliação de Gojo e do diretor Yaga; provar controle básico de Energia Amaldiçoada e sobreviver ao treinamento.',
    scene:
      'O pátio de treinamento da Escola Técnica de Tóquio é de terra batida, com postes de madeira marcados por golpes antigos e um boneco de palha que já viu dias melhores. É agosto, o sol racha o chão e o diretor Masamichi Yaga te observa de braços cruzados, sem pressa de falar. Ao lado dele, Satoru Gojo está sentado no chão com as pernas cruzadas, venda preta, um sorriso de quem já decidiu o resultado da avaliação antes de começar. Yaga finalmente estende uma folha: exorcizar o alvo em menos de três minutos, sem danificar o portão da escola — uma restrição que Gojo claramente achou engraçada.',
    mustEstablish: [
      'O pátio de terra batida, os postes marcados e o boneco de palha.',
      'Yaga com a folha de regras e os braços cruzados.',
      'Gojo sentado no chão, vendado, com o resultado já decidido.',
      'A restrição dos três minutos e do portão intacto.',
      'A decisão: começar pela técnica, pelo terreno ou pelo próprio alvo.',
    ],
    worldFacts: [
      'A campanha começa na linha do mangá, em agosto de 2018, no período de formação da turma do primeiro ano em Tóquio.',
      'Satoru Gojo é professor; Yaga, Nanami, Mei Mei e Utahime estão vivos.',
      'Yuji Itadori ainda é um estudante comum em Sendai e não tem ligação com a feitiçaria.',
    ],
    forbidden: CANON_FORBIDDEN,
    initialNpcs: [
      {
        name: 'Satoru Gojo',
        grade: 'Grau Especial',
        hpPercentage: 100,
        status: 'Relaxado, mãos nos bolsos, observando através dos Seis Olhos',
        attitude: 'Aliado',
        visualDescription:
          'Detailed anime character portrait in Jujutsu Kaisen MAPPA style of Satoru Gojo with white spiky hair and black blindfold',
      },
    ],
  },
  {
    id: 'goodwill-event',
    era: 'canon',
    title: 'Canônico 3 — Festival de Intercâmbio',
    arcLabel: 'Arco do Festival de Intercâmbio — Setembro de 2018',
    premise:
      'Setembro de 2018. O Festival de Intercâmbio deveria ser uma competição entre escolas; quando uma Cortina começa a fechar sobre a floresta, vira uma aula prática sobre o que a política jujutsu esconde.',
    playerRole:
      'Aluno da equipe de Tóquio, no meio de uma prova que ninguém vai cancelar — nem quando a barreira aparecer.',
    tone: [
      'Competição adolescente com regras ruins.',
      'Floresta úmida, armadilhas e sinos fora de lugar.',
      'A Cortina como ameaça política, não acidente.',
      'Todo como primeiro e barulhento.',
    ],
    timeline: 'Setembro de 2018 — Festival de Intercâmbio Tóquio vs. Kyoto',
    location: 'Floresta do Santuário da Escola de Tóquio',
    objective:
      'Vencer as provas do festival sem baixas e investigar a Cortina misteriosa que ameaça cair sobre o campo.',
    scene:
      'A floresta do santuário está úmida de chuva recente e cheia de armadilhas preparadas às pressas. O Festival de Intercâmbio começou há quarenta minutos e você já ouve, ao longe, a voz de Aoi Todo perguntando a alguém qual é o tipo de mulher que ele gosta. O regulamento é simples: eliminar a equipe adversária ou o líder dela. O problema é que, entre as árvores, uma Cortina de energia amaldiçoada começa a se fechar — lenta, silenciosa, com sinos que não deveriam existir num santuário abandonado.',
    mustEstablish: [
      'Quarenta minutos de prova e o regulamento do festival.',
      'A voz de Todo ao longe e a equipe adversária escondida.',
      'A Cortina se fechando entre as árvores e os sinos impossíveis.',
      'A pergunta que ninguém quer responder: cancelar a prova ou continuar.',
      'A decisão: caçar o líder adversário ou investigar a barreira.',
    ],
    worldFacts: [
      'A campanha começa na linha do mangá, em setembro de 2018, durante o Festival de Intercâmbio entre Tóquio e Kyoto.',
      'Todas as escolas, alunos e professores canônicos deste ponto do mangá estão vivos.',
      'A Cortina que cai sobre o festival é um evento canônico; o jogador pode mudar como ela é enfrentada, mas não impedir que ela aconteça.',
    ],
    forbidden: CANON_FORBIDDEN,
    initialNpcs: [
      {
        name: 'Aoi Todo',
        grade: 'Grau 1',
        hpPercentage: 100,
        status: 'Postura de combate empolgada, pronto para perguntar seu tipo',
        attitude: 'Neutro',
        visualDescription:
          'Detailed anime character portrait in Jujutsu Kaisen MAPPA style of Aoi Todo, muscular sorcerer with topknot and facial scar',
      },
    ],
  },
  {
    id: 'shibuya-incident',
    era: 'canon',
    title: 'Canônico 4 — O Incidente de Shibuya',
    arcLabel: 'Arco do Incidente de Shibuya — 31/10/2018, 19h15',
    premise:
      '31 de outubro de 2018, 19h15. Shibuya fecha como uma garrafa, e o que desce pelas escadas não é resgate: é o começo do fim de uma era.',
    playerRole:
      'Feiticeiro de apoio na entrada B2, enviado para abrir caminho até Gojo. Você não é o plano; você é o que mantém o plano de pé.',
    tone: [
      'Pânico contido sob luz vermelha de emergência.',
      'Nanami pragmático e letal, sem tempo para conforto.',
      'Humanos transfigurados como multidão, não como monstros genéricos.',
      'O relógio do cânone correndo contra você.',
    ],
    timeline: '31/10/2018, 19h15 — Incidente de Shibuya',
    location: 'Entrada da Estação de Shibuya — Subsolo B2',
    objective:
      'Descer do subsolo B2 até o B5F para alcançar Satoru Gojo e desfazer as Cortinas, sobrevivendo às maldições e humanos transfigurados.',
    scene:
      'Shibuya é uma cidade dentro de uma garrafa. As Cortinas já fecharam as saídas e o que se ouve no subsolo B2 não é mais o som da estação: é gente correndo, gritando nomes, batendo em portas que não abrem. A luz de emergência pinta tudo de vermelho intermitente, e no fim do corredor um homem de terno impecável e óculos verdes avança na sua direção com um cutelo envolto em pano pontilhado. Kento Nanami não parece surpreso de te ver ali. Ele apenas aponta o polegar para trás, na direção das escadas que descem, e diz que o plano mudou: Gojo está preso no B5F e eles precisam chegar lá antes que os humanos transfigurados bloqueiem de vez a passagem.',
    mustEstablish: [
      'As Cortinas fechadas e os gritos no subsolo B2.',
      'Os humanos transfigurados avançando pelos corredores.',
      'Nanami com o cutelo e a informação de que Gojo está no B5F.',
      'A passagem sendo bloqueada em tempo real.',
      'A decisão: seguir Nanami pelas escadas ou abrir outra rota.',
    ],
    worldFacts: [
      'A campanha começa na linha do mangá, em 31 de outubro de 2018, no início do Incidente de Shibuya.',
      'Satoru Gojo está vivo e preso dentro da Prisão no Reino (Prison Realm) no subsolo; Kenjaku está disfarçado como Suguru Geto.',
      'Kento Nanami, Megumi, Yuji, Nobara, Maki, Ino e Mei Mei estão vivos neste ponto do cânone.',
      'Os humanos transfigurados e as maldições do subsolo são o perigo imediato; o desfecho de Shibuya é canônico.',
    ],
    forbidden: CANON_FORBIDDEN,
    initialNpcs: [
      {
        name: 'Kento Nanami',
        grade: 'Grau 1',
        hpPercentage: 100,
        status: 'Em Hora Extra (Overtime 120%), cutelo cego envolto em pano pontilhado em punho',
        attitude: 'Aliado',
        visualDescription:
          'Detailed anime character portrait in Jujutsu Kaisen MAPPA style of Kento Nanami in a tan suit and green goggles holding his wrapped blunt sword',
      },
      {
        name: 'Enxame de Humanos Transfigurados',
        grade: 'Grau 3 (Múltiplos)',
        hpPercentage: 100,
        status: 'Avançando descontroladamente pelos corredores do metrô',
        attitude: 'Hostil',
        visualDescription:
          'Distorted transfigured humans in Jujutsu Kaisen MAPPA anime style inside dark Shibuya subway station',
      },
    ],
  },
  {
    id: 'culling-game',
    era: 'canon',
    title: 'Canônico 5 — Jogo do Abate',
    arcLabel: 'Arco do Jogo do Abate — Novembro de 2018',
    premise:
      'Novembro de 2018. O Jogo do Abate não pede que você vença: pede que você pontue. Em dezoito dias, a colônia decide quem sai vivo e quem vira regra.',
    playerRole:
      'Jogador recém-inscrito na Colônia Tóquio Nº 1, com uma Kogane e nenhuma aliança.',
    tone: [
      'Sobrevivência com regras absurdas e precisas.',
      'Céu falso, ruas vazias e espera armada.',
      'Reencarnados da Era Heian como predadores pacientes.',
      'Cada ponto vale uma vida e a Kogane não mente.',
    ],
    timeline: 'Novembro de 2018 — Jogo do Abate, Colônia Tóquio Nº 1',
    location: 'Colônia Tóquio Nº 1 — Céu Aberto sob a Barreira',
    objective:
      'Acumular 100 pontos para adicionar uma regra, eliminar feiticeiros reencarnados hostis e sobreviver à Kogane na barreira.',
    scene:
      'Você desperta dentro da barreira com o gosto de ferro na boca e uma Kogane girando a dois palmos do seu rosto. Ela anuncia seu nome, seus pontos e as regras com a educação de um funcionário cansado: mate feiticeiros, receba pontos, sobreviva dezoito dias. O céu acima da colônia é um teto de energia amaldiçoada do qual não se vê o sol, e as ruas estão vazias de um jeito que não é paz, é espera. Do outro lado da avenida, em cima de um prédio de cinco andares, uma silhueta para de te observar e pula.',
    mustEstablish: [
      'Acordar dentro da barreira e a Kogane anunciando nome, pontos e regras.',
      'As regras canônicas: 5 pontos por feiticeiro, 1 por civil, 100 para uma nova regra.',
      'O céu falso e as ruas vazias demais.',
      'A silhueta no prédio que para de observar e pula.',
      'A decisão: correr, esconder-se ou enfrentar o primeiro reencarnado.',
    ],
    worldFacts: [
      'A campanha começa na linha do mangá, em novembro de 2018, no Jogo do Abate convocado por Kenjaku.',
      'As regras do Jogo do Abate são canônicas: 5 pontos por feiticeiro, 1 por não-feiticeiro e 100 pontos para adicionar uma regra.',
      'Kenjaku controla a barreira e os feiticeiros reencarnados estão ativos; o jogador pode alterar como a colônia evolui.',
    ],
    forbidden: CANON_FORBIDDEN,
    initialNpcs: [
      {
        name: 'Feiticeiro Reencarnado da Era Heian',
        grade: 'Grau 1',
        hpPercentage: 100,
        status: 'Avaliando sua reserva de Energia Amaldiçoada do topo de um prédio',
        attitude: 'Hostil',
        visualDescription:
          'Ancient reincarnated Heian era jujutsu sorcerer in Jujutsu Kaisen MAPPA style with glowing cursed energy',
      },
    ],
  },
];

export const DEFAULT_STARTING_ARC = STARTING_ARCS[0];

export const STARTING_ARC_ERAS: Array<{ id: ArcEra; label: string; hint: string }> = [
  {
    id: 'sequel',
    label: 'Seguimento (pós-mangá)',
    hint: 'A história começa depois do desfecho canônico — nova geração, novo vácuo de poder e ameaças nascidas do que o mangá deixou para trás.',
  },
  {
    id: 'canon',
    label: 'Linha canônica (2018)',
    hint: 'Rejogar os arcos do mangá sem alterar a espinha dorsal do cânone.',
  },
];
