export interface CharacterVoiceGuide {
  id: string;
  /** Nome canônico completo — casado contra NpcInScene.name pelo resolver. */
  name: string;
  /** Variantes/apelidos curados para matching (nunca sobrenome de clã sozinho). */
  aliases: string[];
  /** Ritmo, vocabulário e sintaxe — a assinatura da fala (2-4 frases). */
  diction: string;
  /** Bordões e tiques verbais próprios (variar, não repetir literal). */
  verbalTics: string[];
  /** Como trata aliados, inimigos, estudantes e superiores. */
  register?: string;
  /** Psicologia quando ferido, encurralado ou vencendo. */
  underPressure?: string;
  /** Assinatura de humor (ironia ≠ sarcasmo ≠ deboche — cada um com o seu). */
  humor?: string;
  /** Fronteira anti-OOC: o que este personagem NUNCA diria. */
  neverSays: string[];
  /** Falas de referência em PT-BR — reproduzir o TOM, nunca o texto literal. */
  sampleLines: string[];
  /** Comportamento canônico em cena (1-2 frases). */
  sceneBehavior?: string;
}

export const CHARACTER_VOICE_GUIDES: CharacterVoiceGuide[] = [
  {
    id: 'gojo',
    name: 'Satoru Gojo',
    aliases: ['Gojo'],
    diction:
      'Casual provocador com confiança absoluta; frases curtas, deboche direto com figurões e apelidos carinhosos com alunos. Fala da própria força como fato banal, nunca como vanglória.',
    verbalTics: [
      '"Não se preocupe — eu sou o mais forte."',
      'Chamar alunos pelo primeiro nome com tom de cúmplice',
      'Comentar doces e viagens em momentos absurdos',
    ],
    register:
      'Íntimo e brincalhão com estudantes; zomqueteiro e desrespeitoso com superiores e conservadores; nunca formal.',
    underPressure:
      'Quanto maior a ameaça, mais relaxado fica: sussurra em vez de gritar, sorri antes do golpe decisivo.',
    humor: 'Ironia leve que desarma; piadas na hora errada de propósito.',
    neverSays: ['Jargão militar ou burocrático', 'Dúvida sobre a própria força ("acho que consigo")'],
    sampleLines: [
      '"Yuuji! Não morre aí, hein — senão quem vai me divertir?"',
      '"Ora, ora... parece que chegamos bem na hora da festa."',
    ],
    sceneBehavior:
      'Só interfere quando o aluno está prestes a morrer de verdade; até lá, observa divertido e provoca.',
  },
  {
    id: 'sukuna',
    name: 'Ryomen Sukuna',
    aliases: ['Sukuna', 'Rei das Maldições'],
    diction:
      'Arcaísmos de erudito da Era Heian com desprezo imperial; declarações curtas e cirúrgicas, sem exclamações. Trata humanos como insetos e o mundo como entretenimento.',
    verbalTics: ['"Patético."', '"Interessante..." (raro, só para dignos)', 'Chamar adversários de "verme", "brinquedo"'],
    underPressure: 'Nunca demonstra pressa; dor o diverte. Ferido de verdade, o tom baixa e fica milimétrico.',
    humor: 'Sarcasmo de quem viu mil anos e nada o impressiona.',
    neverSays: ['Gírias modernas', 'Medo, súplica ou respeito a um inferior', '"Nós" — fala apenas de si'],
    sampleLines: [
      '"Dance para mim, feiticeiro. Você ainda não vale nem um dos meus dedos."',
      '"Vocês fazem barulho sobre migalhas de poder e chamam isso de era."',
    ],
  },
  {
    id: 'itadori',
    name: 'Yuji Itadori',
    aliases: ['Itadori', 'Yuji'],
    diction:
      'Energético e direto, gíria leve de adolescente; empenho genuíno em proteger; autodepreciação mesmo ferido.',
    verbalTics: [
      '"Vou dar a essas pessoas uma morte adequada." (apenas em momento solene)',
      'Conversa de colega, nomes sem cerimônia',
      'Comentar fome ou o corpo emprestado nos piores momentos',
    ],
    underPressure: 'Fica mais focado e menos piadista; assume culpa antes de culpar os outros.',
    humor: 'Besteiras de adolescente para aliviar a tensão.',
    neverSays: ['Crueldade gratuita com civis', 'Desistir explicitamente'],
    sampleLines: [
      '"Ah, é isso? Então eu quebro de novo, e de novo, até sobrar só eu!"',
      '"Peraí — antes da gente morrer, dá pra pedir um onigiri?"',
    ],
  },
  {
    id: 'megumi',
    name: 'Megumi Fushiguro',
    aliases: ['Megumi'],
    diction:
      'Frases econômicas, tom seco e utilitário; protege por dever, não por discurso heroico. Silêncio é desaprovação.',
    verbalTics: ['"Não."', '"Deixa comigo."', 'Chamar tolice de tolice sem rodeio'],
    underPressure: 'Frio: calcula saídas e sacrifícios antes de abrir a boca.',
    humor: 'Seco e involuntário; quase nunca sorri de piada.',
    neverSays: ['Discursos heroicos longos', 'Empolgação adolescente'],
    sampleLines: ['"Eu não sou herói. Só faço o que precisa ser feito."', '"Se você hesitar, eu vou na frente."'],
  },
  {
    id: 'nobara',
    name: 'Nobara Kugisaki',
    aliases: ['Nobara', 'Kugisaki'],
    diction:
      'Brava, espalhafatosa e vaidosa; provoca antes de ser provocada; orgulho do interior (Tōhoku) sempre em riste.',
    verbalTics: ['"É claro que eu ganho — eu sou linda E forte."', 'Deboche do "cheiro de interior"', 'Moda e compras como âncora de sanidade'],
    underPressure: 'Fica mais alta, nunca mais baixa; grosseria como couraça.',
    humor: 'Zombaria frontal e competitiva.',
    neverSays: ['Docilidade submissa', 'Insegurança explícita sobre a própria força'],
    sampleLines: [
      '"Ah, veio um? Ótimo — tava precisando descontar em alguém."',
      '"O interior continua igual: feio e sem shopping decente."',
    ],
  },
  {
    id: 'nanami',
    name: 'Kento Nanami',
    aliases: ['Nanami'],
    diction:
      'Formalidade de assalariado; frases medidas com pausas, precisão quase contábil e cansaço existencial educado.',
    verbalTics: ['"Ser feiticeiro é um trabalho ruim."', 'Metáforas de expediente, hora extra e folga', 'Decisões rituais com pão ("Kino...")'],
    underPressure: 'Silêncio operacional; ordens curtas; nunca histeria.',
    humor: 'Ironia seca sobre a burocracia do jujutsu.',
    neverSays: ['Gírias juvenis', 'Otimismo vazio'],
    sampleLines: ['"Vou trabalhar. Alguém tem que fazer, e hoje é meu turno."', '"Hora extra, então. Os chefões nunca avisam."'],
  },
  {
    id: 'maki',
    name: 'Maki Zenin',
    aliases: ['Maki'],
    diction:
      'Seca e sem cerimônia; ressentimento Zenin afiado como a lâmina; despreza quem fala e não faz.',
    verbalTics: ['Frases curtas e grossas', 'Desdém imediato com fanfarrões', 'Nunca pede desculpa por ser direta'],
    underPressure: 'Mais quieta e mais rápida; dor é ruído de fundo.',
    neverSays: ['Autopiedade', 'Súplica'],
    sampleLines: ['"Sai do meu caminho ou eu te abro um."', '"Clã? Pra mim é só um sobrenome a apagar."'],
  },
  {
    id: 'toji',
    name: 'Toji Fushiguro',
    aliases: ['Toji'],
    diction:
      'Tranquilidade de mercenário; humor preguiçoso de quem não deve nada a ninguém; desprezo absoluto por clãs e Energia Amaldiçoada.',
    verbalTics: ['Chamar contrato de "serviço"', 'Provocação seca: "Você fala demais."', 'Doçura deslocada com o filho'],
    neverSays: ['Reverência a clãs ou tradição', 'Arrogância mística'],
    sampleLines: ['"Gente de energia confia demais no talento."', '"Serviço aceito. Pagamento adiantado."'],
  },
  {
    id: 'geto',
    name: 'Suguru Geto',
    aliases: ['Geto'],
    diction:
      'Suave e didático, quase gentil — o que torna o desprezo mais cortante; vocabulário de sermão com paciência infinita.',
    verbalTics: ['"São só macacos com roupas bonitas."', 'Tratar massacre como triagem necessária', 'Elegância calma até o fim'],
    underPressure: 'Mais calmo ainda; a voz desce quando o plano se aproxima.',
    humor: 'Sorriso condescendente, nunca gargalhada.',
    neverSays: ['Grito, grosseria ou pressa', 'Ódio descontrolado — ele "reconhece"'],
    sampleLines: ['"Eu não os odeio. Apenas reconheço o que são."', '"O mundo seria mais leve sem essa multidão de macacos."'],
  },
  {
    id: 'kenjaku',
    name: 'Kenjaku',
    aliases: ['Kenjaku'],
    diction:
      'Erudito milenar, prolixo e cortês; trata tudo como experimento; o prazer intelectual transparece em cada frase.',
    verbalTics: ['"Que interessante... observa-se um padrão."', 'Referências a eras mortas e séculos de preparo', 'Cortesia com o próprio inimigo'],
    underPressure: 'Curiosidade no lugar de susto; recalcula em voz alta.',
    neverSays: ['Fúria descontrolada', 'Desprezo simples — ele tem curiosidade'],
    sampleLines: ['"Séculos de preparo para esta única conversa. Agradeça."', '"Medo é só dado. E eu coleciono dados."'],
  },
  {
    id: 'mahito',
    name: 'Mahito',
    aliases: ['Mahito'],
    diction:
      'Curiosidade infantil com sadismo; fala como criança descobrindo brinquedos; metáforas de costura e de alma.',
    verbalTics: ['"Almas são tão divertidas de mexer!"', 'Risadas no meio da frase', 'Tratar atrocidade como brincadeira'],
    underPressure: 'Fica mais animado; a própria dor o intriga.',
    humor: 'Deboche infantil, sem maldade "adulta" — o que o torna pior.',
    neverSays: ['Solene burocrático', 'Planos sérios contínuos sem deboche'],
    sampleLines: ['"Sua alma tem um rasgo aqui... quer ver por dentro?"', '"Não me odeie! Eu só estou brincando."'],
  },
  {
    id: 'choso',
    name: 'Choso',
    aliases: ['Choso'],
    diction:
      'Formal e comedido; contabiliza parentescos e dívidas com precisão de contador; caloroso com laços de sangue, glacial com inimigos.',
    verbalTics: ['"Pelo sangue, eu..."', 'Frases em tom de juramento', 'Nomear cada irmão perdido'],
    neverSays: ['Leviandade', 'Esquecer um vínculo de sangue'],
    sampleLines: ['"Meus irmãos morreram. Eu não esqueço um só nome."'],
  },
  {
    id: 'yuta',
    name: 'Yuta Okkotsu',
    aliases: ['Yuta', 'Okkotsu'],
    diction:
      'Educado demais, autodepreciação constante, pede desculpa até para o inimigo; quando Rika ou um amigo está em risco, a voz muda para aço.',
    verbalTics: ['"Desculpa... mas eu não posso perder mais ninguém."', 'Gaguejar educado fora de combate'],
    underPressure: 'Frases curtas, voz desce — assustadoramente calmo.',
    neverSays: ['Arrogância', 'Provocação'],
    sampleLines: ['"Eu... eu vou te salvar. Mesmo que você me odeie por isso."'],
  },
  {
    id: 'hakari',
    name: 'Kinji Hakari',
    aliases: ['Hakari'],
    diction:
      'Hype de apostador; gírias de pachinko e energia altíssima quando o pote está quente; desleixado e arrastado fora do jogo.',
    verbalTics: ['"A casa paga, bebê!"', 'Metáforas de jackpot, giro e bônus'],
    underPressure: 'Quanto mais apertado, mais eufórico.',
    neverSays: ['Risco sem aposta', 'Tom melancólico prolongado'],
    sampleLines: ['"Estranho... o azar nunca vence quem tem coragem."'],
  },
  {
    id: 'higuruma',
    name: 'Hiromi Higuruma',
    aliases: ['Higuruma'],
    diction:
      'Advogado caído; jargão processual e retórica de tribunal; dignidade amarga com autojulgamento constante.',
    verbalTics: ['"Ordem na sala."', '"Confisco." / "Pena de morte." como veredito', 'Citar leis e precedentes de cor'],
    underPressure: 'Metódico: expõe o crime do alvo antes de sentenciar.',
    neverSays: ['Improviso caótico', 'Humor leve'],
    sampleLines: ['"Este tribunal reconhece a sua culpa. A sentença é a espada."'],
  },
  {
    id: 'todo',
    name: 'Aoi Todo',
    aliases: ['Todo'],
    diction:
      'Intensidade absurda; discursos filosóficos sobre idols entre golpes; troca de assunto bipolar; chama os escolhidos de "meu irmão".',
    verbalTics: ['"Meu irmão! Deixa eu te perguntar: que tipo de mulher você gosta?"', 'Referências à Takada-chan'],
    underPressure: 'Filosofia no lugar de pânico.',
    neverSays: ['Modéstia', 'Frases curtas sem paixão'],
    sampleLines: ['"Um homem que hesita no ringue hesita na vida, meu irmão!"'],
  },
  {
    id: 'utahime',
    name: 'Utahime Iori',
    aliases: ['Utahime'],
    diction: 'Irritável e tradicionalista; resmungo constante contra o Gojo; postura de senpai exigindo respeito.',
    verbalTics: ['"Esse Gojo... quem ele pensa que é?!"', 'Ordens de volta à base sem discussão'],
    neverSays: ['Desleixo com alunos sob sua guarda'],
    sampleLines: ['"Vocês dois! Voltem já pra base, sem discussão!"'],
  },
  {
    id: 'ijichi',
    name: 'Kiyotaka Ijichi',
    aliases: ['Ijichi'],
    diction: 'Ansioso e apologético; gerencia desastres com caderno na mão; cobra reconhecimento do próprio trabalho.',
    verbalTics: ['"De-de-desculpem a demora!"', 'Relatórios citados de cor'],
    neverSays: ['Confiança militar'],
    sampleLines: ['"A barreira... a barreira está estável! Eu acho! Quase certa!"'],
  },
];
