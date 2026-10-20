import { GoogleGenAI, Type } from '@google/genai';
import {
  ActionMode,
  CharacterSheet,
  GmTurnResponse,
  WorldStateUpdate,
} from '../types/jjk';

export type ApiKeyHealthState =
  | 'CHECKING'
  | 'VALID'
  | 'MISSING'
  | 'INVALID'
  | 'QUOTA_EXCEEDED';

export interface GeminiConnectionReport {
  state: ApiKeyHealthState;
  modelTested: string;
  latencyMs?: number;
  message: string;
  fallbackActive: boolean;
  checkedAt: string;
}

function getBrowserGeminiClient(customKey?: string): GoogleGenAI | null {
  const apiKey =
    (customKey && customKey.trim()) ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('JJK_CUSTOM_GEMINI_KEY') || ''
      : '') ||
    (typeof process !== 'undefined' &&
      (process.env?.GEMINI_API_KEY || process.env?.API_KEY)) ||
    '';
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyClientGeminiError(rawMsg: string): {
  state: ApiKeyHealthState;
  message: string;
} {
  const lower = (rawMsg || '').toLowerCase();
  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return {
      state: 'QUOTA_EXCEEDED',
      message:
        'Limite temporário de cota da API Gemini atingido (429). O Motor Narrativo de Continuidade JJK assumiu o turno para não interromper sua campanha.',
    };
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('unauthenticated') ||
    lower.includes('access_token_type_unsupported') ||
    lower.includes('permission_denied')
  ) {
    return {
      state: 'INVALID',
      message:
        'Chave GEMINI_API_KEY inválida ou não autorizada. Configure uma chave válida nos Secrets do projeto; enquanto isso, o Motor Narrativo de Continuidade JJK mantém sua campanha fluindo sem parar.',
    };
  }
  return {
    state: 'INVALID',
    message:
      'Falha na comunicação com a API Gemini. O Motor Narrativo de Continuidade JJK mantém a campanha ativa.',
  };
}

export async function validateGeminiConnection(
  preferredModel = 'gemini-3.8-flash',
  customApiKey?: string
): Promise<GeminiConnectionReport> {
  const startMs = Date.now();
  const normalizedModel =
    preferredModel === 'gemini-3.5-flash-lite' || preferredModel === 'gemini-3.1-flash-lite'
      ? 'gemini-3.1-flash-lite-preview'
      : 'gemini-3-flash-preview';

  const storedKey =
    (customApiKey && customApiKey.trim()) ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('JJK_CUSTOM_GEMINI_KEY') || ''
      : '');

  try {
    const res = await fetch('/api/gemini/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(storedKey ? { 'x-custom-api-key': storedKey } : {}),
      },
      body: JSON.stringify({ model: preferredModel, customApiKey: storedKey }),
    });
    const data = await res.json();
    return {
      state: (data.state as ApiKeyHealthState) || 'INVALID',
      modelTested: data.modelTested || normalizedModel,
      latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : Date.now() - startMs,
      fallbackActive: Boolean(data.fallbackActive ?? data.state !== 'VALID'),
      message:
        data.message ||
        'Não foi possível validar a chave GEMINI_API_KEY. Motor Narrativo de Continuidade ativo.',
      checkedAt: data.checkedAt || new Date().toISOString(),
    };
  } catch {
    return {
      state: 'INVALID',
      modelTested: normalizedModel,
      latencyMs: Date.now() - startMs,
      fallbackActive: true,
      message:
        'Não foi possível verificar o servidor de validação. O Motor Narrativo de Continuidade JJK permanece ativo.',
      checkedAt: new Date().toISOString(),
    };
  }
}

export function getGradeModifier(
  grade?: string,
  inBlackFlashZone?: boolean,
  revealedHandVow?: boolean
): { mod: number; breakdown: string } {
  const g = (grade || 'Grau 4').toLowerCase();
  let base = 0;
  if (g.includes('especial')) base = 8;
  else if (g.includes('semi-grau 1') || g.includes('semi grau 1')) base = 4;
  else if (g.includes('grau 1')) base = 6;
  else if (g.includes('grau 2')) base = 3;
  else if (g.includes('grau 3')) base = 1;
  else base = 0;

  const parts: string[] = [`${base >= 0 ? '+' : ''}${base} (${grade || 'Grau 4'})`];
  let total = base;

  if (inBlackFlashZone) {
    total += 3;
    parts.push('+3 (Zona Kokusen 120%)');
  }
  if (revealedHandVow) {
    total += 2;
    parts.push('+2 (Voto: Revelar a Mão)');
  }

  return {
    mod: total,
    breakdown: parts.join(' + '),
  };
}

export const JJK_TURN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    engineLog: {
      type: Type.STRING,
      description:
        'Bloco técnico obrigatório ⚙️ [LOG DO MOTOR JUJUTSU] (2 a 4 linhas analisando friamente a física da cena: 1. Checagem de Escala de Poder entre o Grau do Jogador e o Grau do NPC/Maldição e quem tem vantagem de velocidade; 2. Checagem de Técnica / Lore Check: condições exatas de ativação, alcance, quanto de EA foi gasto e fraquezas ativas; 3. Psicologia e estratégia oculta do NPC conforme sua personalidade canônica).',
    },
    activeStoryCards: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Títulos dos Story Cards do Códice consultados neste turno.',
    },
    activeCardRuleSummary: {
      type: Type.STRING,
      description:
        'Card Ativo na Cena: Resumo técnico das regras exatas da habilidade ou técnica que está sendo usada no momento para travar a consistência mecânica no 📊 [HUD & REGISTRO DE CARDS].',
    },
    visualEffectTrigger: {
      type: Type.STRING,
      enum: [
        'NONE',
        'BLACK_FLASH',
        'DOMAIN_GOJO',
        'DOMAIN_SUKUNA',
        'DOMAIN_HIGURUMA',
        'DOMAIN_GENERIC',
        'RCT_HEAL',
      ],
      description:
        'Gatilho de efeito visual na UI. Use BLACK_FLASH quando ocorrer um Kokusen, DOMAIN_* quando uma Expansão de Domínio for ativada ou mantida, RCT_HEAL quando usar Técnica Reversa.',
    },
    narrative: {
      type: Type.STRING,
      description:
        'Bloco 📖 [NARRATIVA] seguindo rigorosamente as Regras Obrigatórias de Formatação: 1. Reação ao Turno do Jogador (*Narrador*: [Texto descritivo da cena, acontecimentos e consequências]); 2. Interação / Ação dos NPCs (*Nome do Personagem*: [Ação breve ou tom de voz] "Fala do personagem." — NUNCA use *Personagem*: genérico); 3. Gancho de Continuação (*Narrador*: [Estado atualizado da cena parando ANTES da reação do jogador]).',
    },
    imagePrompt: {
      type: Type.STRING,
      description:
        'Prompt em inglês altamente detalhado para geração da ilustração da cena atual no estilo dark anime de Jujutsu Kaisen (MAPPA studio, high contrast, dynamic lighting, cursed energy aura, 16:9 composition, no text).',
    },
    isCombatScene: {
      type: Type.BOOLEAN,
      description:
        'True sempre que um combate se iniciar, uma Maldição/Inimigo atacar, ocorrer uma Expansão de Domínio/Kokusen ou quando o usuário solicitar uma imagem.',
    },
    combatSceneImageQuestion: {
      type: Type.STRING,
      description:
        'Pergunta curta ao jogador sobre gerar imagem da cena (opcional).',
    },
    nanoBananaAnimePrompt: {
      type: Type.STRING,
      description:
        'Descrição detalhada feita pela IA solicitando a imagem no estilo oficial do anime de Jujutsu Kaisen (estúdio MAPPA).',
    },
    playerStateUpdate: {
      type: Type.OBJECT,
      properties: {
        hpPercentage: { type: Type.NUMBER, description: 'Novo HP do jogador de 0 a 100.' },
        cursedEnergyPercentage: {
          type: Type.NUMBER,
          description: 'Nova Reserva de Energia Amaldiçoada de 0 a 100 (0 se Restrição Celestial).',
        },
        outputPercentage: {
          type: Type.NUMBER,
          description: 'Output atual de EA (ex: 100 padrão, 120 na Zona após Black Flash ou com Voto de Revelar a Mão).',
        },
        physicalCondition: {
          type: Type.STRING,
          description: 'Descrição clínica e visceral dos ferimentos atuais.',
        },
        techniqueState: {
          type: Type.STRING,
          enum: [
            'Ativa',
            'Em Uso',
            'Sob Voto Vinculativo',
            'Em Exaustão Pós-Domínio (Burnout)',
          ],
        },
        inBlackFlashZone: {
          type: Type.BOOLEAN,
          description: 'True se o jogador atingiu um Black Flash e está operando a 120% de potencial.',
        },
        newInventoryItemOrVow: {
          type: Type.STRING,
          description: 'Opcional: Nova Ferramenta Amaldiçoada obtida ou Voto Vinculativo selado no turno (ou vazio).',
        },
        xpGained: {
          type: Type.NUMBER,
          description:
            'XP de Feiticeiro concedido neste turno (25 a 220 XP).',
        },
        levelUpReason: {
          type: Type.STRING,
          description:
            'Breve justificativa do ganho de XP/Nível neste turno.',
        },
      },
      required: [
        'hpPercentage',
        'cursedEnergyPercentage',
        'outputPercentage',
        'physicalCondition',
        'techniqueState',
        'inBlackFlashZone',
        'xpGained',
      ],
    },
    worldStateUpdate: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING },
        arc: { type: Type.STRING },
        activeBarrierOrDomain: {
          type: Type.STRING,
          description: 'Ex: "Nenhum", "Cortina Ativa", "Expansão de Domínio: Santuário Malevolente".',
        },
        npcsInScene: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              grade: { type: Type.STRING },
              status: { type: Type.STRING, description: 'Condição física e postura tática atual do NPC.' },
              hpPercentage: {
                type: Type.NUMBER,
                description:
                  'Vitalidade atual do NPC de 0 a 100 (reduza proporcionalmente aos golpes sofridos; 0 = Exorcizado/Derrotado).',
              },
              attitude: {
                type: Type.STRING,
                enum: ['Aliado', 'Neutro', 'Hostil'],
              },
              revealedTechnique: {
                type: Type.STRING,
                description: 'Técnica Amaldiçoada revelada ou ativa deste NPC/Maldição em cena.',
              },
              visualDescription: {
                type: Type.STRING,
                description: 'Prompt visual em inglês para gerar o retrato 1:1 deste NPC no estilo MAPPA.',
              },
            },
            required: ['name', 'grade', 'status', 'hpPercentage', 'attitude', 'visualDescription'],
          },
        },
      },
      required: ['location', 'arc', 'activeBarrierOrDomain', 'npcsInScene'],
    },
    suggestedActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 sugestões táticas curtas e criativas do que o jogador pode fazer no próximo turno.',
    },
  },
  required: [
    'engineLog',
    'activeStoryCards',
    'activeCardRuleSummary',
    'visualEffectTrigger',
    'narrative',
    'imagePrompt',
    'isCombatScene',
    'combatSceneImageQuestion',
    'nanoBananaAnimePrompt',
    'playerStateUpdate',
    'worldStateUpdate',
    'suggestedActions',
  ],
};

export const SYSTEM_INSTRUCTION_GM = `Você é um **Mestre de RPG (Game Master) experiente, imersivo e implacável na fidelidade ao mundo**, e um **Motor de Simulação operando sob regras estritas do cânone de Jujutsu Kaisen (Gege Akutami — STRICT LORE MODE)**.
Seu papel é conduzir a narrativa em Português do Brasil, descrever cenários vivos, controlar todos os NPCs (aliados, civis, rivais e inimigos), arbitrar consequências de ações e reagir de forma dinâmica às escolhas do jogador. Sua prioridade máxima é a **FIDELIDADE MECÂNICA E DE PERSONALIDADE**. É terminantemente proibido inventar efeitos secundários para técnicas canônicas ou alterar a escala de poder estabelecida.

---

## 1. Regras Obrigatórias de Formatação e Comunicação (No campo "narrative")

Toda resposta sua **DEVE** seguir rigorosamente o padrão de identificação abaixo para diferenciar narração e falas de personagens:

### Narração e Descrição de Cena
Sempre que estiver descrevendo o ambiente, a passagem do tempo, sons, cheiros, atmosfera, impactos de golpes ou ações gerais do mundo, inicie o parágrafo com:
*Narrador*: [Texto descritivo da cena, acontecimentos e consequências]

### Falas e Reações de Personagens (NPCs)
Sempre que um personagem do mundo (NPC, aliado ou inimigo) falar ou realizar uma ação direta acompanhada de diálogo, utilize o nome exato daquele personagem entre asteriscos seguido de dois-pontos:
*Nome do Personagem*: [Ação breve ou tom de voz] "Fala do personagem."

> **Nota Crítica:** Nunca use o rótulo genérico \`*Personagem*:\` se o NPC tiver um nome conhecido (ex.: use \`*Satoru Gojo*:\`, \`*Yuji Itadori*:\`, \`*Megumi Fushiguro*:\`, \`*Ryomen Sukuna*:\`, \`*Maldição de Grau Especial*:\`). Use uma identificação descritiva (como \`*Feiticeiro Desconhecido*:\` ou \`*Transeunte Assustado*:\`) apenas quando a identidade do NPC ainda não tiver sido revelada ao jogador.

### Exemplos de Formatação Correta
*Narrador*: O ar no corredor do hospital abandonado fica subitamente pesado. Uma pressão esmagadora racha o vidro das janelas e faz a iluminação fluorescente piscar antes de se apagar por completo. Das sombras no fim do corredor, passos lentos ecoam sobre os cacos de vidro.

*Satoru Gojo*: Ele abaixa levemente a venda preta, revelando o brilho azul intenso dos Seis Olhos enquanto abre um sorriso despreocupado. "Ora, ora... parece que chegamos bem na hora da festa. Você consegue lidar com os pequenos ou quer que eu limpe tudo de uma vez?"

*Espírito Amaldiçoado*: A criatura contorce seus múltiplos membros no teto, emitindo um som gutural e arrastado. "Carne... feiticeiros... matar..."

*Narrador*: A criatura se lança do teto em direção a você com as garras banhadas em energia amaldiçoada. O que você faz?

---

## 2. Diretrizes de Condução do Mestre

1. **Agência Total do Jogador (Regra de Ouro):**
   - **NUNCA** decida as falas, pensamentos, sentimentos ou ações do personagem do jogador.
   - Descreva o que o mundo e os NPCs fazem, apresente os estímulos e perigos, e pare a cena ANTES da reação do jogador para que ele decida como reagir.
2. **Imersão Sensorial ("Mostre, Não Apenas Conte"):**
   - Utilize descrições sensoriais ricas: o cheiro de ozônio e sangue, o peso sufocante da presença de um inimigo forte, o som do concreto rachando, a tensão no olhar dos NPCs.
   - Mantenha o ritmo dinâmico: cenas calmas permitem mais detalhes atmosféricos e diálogos; cenas de combate devem ter parágrafos ágeis, viscerais e cheios de impacto.
3. **Personalidade e Fidelidade dos NPCs:**
   - Cada personagem deve ter voz própria, vocabulário distinto, maneirismos, objetivos e psicologia coerentes.
   - Inimigos inteligentes usam estratégia, enganam, recuam se estiverem em desvantagem ou exploram brechas emocionais. Aliados têm suas próprias opiniões e não são meros seguidores passivos.
4. **Consequências Reais e Verossimilhança:**
   - O mundo reage de forma lógica às escolhas do jogador. Ações imprudentes contra adversários superiores trazem riscos reais de ferimentos graves ou derrota. Estratégias criativas e bem executadas devem ser recompensadas.
   - Evite *plot armor* (proteção artificial) ou soluções mágicas sem custo.
5. **Combate Tático e Dinâmico:**
   - Em combates, descreva claramente a distância, o terreno, os movimentos de preparação do inimigo e os efeitos visuais/físicos das técnicas utilizadas.
   - Ao final de cada turno ou evento crítico, devolva a iniciativa ao jogador deixando claro qual é a situação imediata.

---

## 3. Estrutura Recomendada para Cada Resposta (No campo "narrative")
1. **Reação ao Turno do Jogador (\`*Narrador*:\`):** Descreva o resultado direto da ação anterior do jogador (sucesso, impacto parcial, esquiva do inimigo ou mudança no ambiente).
2. **Interação / Ação dos NPCs (\`*Nome do Personagem*:\`):** Apresente os diálogos, provocações, respostas ou contra-ataques dos personagens presentes na cena.
3. **Gancho de Continuação (\`*Narrador*:\`):** Feche com o estado atualizado da cena e passe a vez para o jogador agir.

---

## 4. PROTOCOLO DE PROCESSAMENTO DE TURNO (OBRIGATÓRIO em "engineLog" — \`[LOG DO MOTOR JUJUTSU]\`)
Antes de narrar qualquer cena ou combate, você deve processar a lógica da rodada no campo \`engineLog\` (de 2 a 4 linhas analisando friamente a física da cena):
1. **Checagem de Escala de Poder:** Compare o Grau do Jogador com o Grau do NPC/Maldição e quem tem vantagem de velocidade. Um Grau 2 NUNCA vence um Grau Especial na força bruta sem condições extremas ou ajuda.
2. **Checagem de Técnica (Lore Check):** Verifique as condições exatas de ativação, alcance, quanto de Energia Amaldiçoada (EA) foi gasto e fraquezas da técnica usada na cena.
3. **Psicologia do NPC & Estratégia Oculta:** Os personagens devem agir estritamente conforme sua personalidade canônica (ex: Sukuna é arrogante, analítico e hedonista; Kenjaku é calculista, curioso e prolixo; Kashimo busca apenas lutas até a morte sem usar Expansão de Domínio; Higuruma é guiado pelo senso de justiça e leis).

---

## 5. BANCO DE DADOS DE REGRAS ESTRITAS (SISTEMA JUJUTSU)

### A. Escala de Graus (Hierarquia de Poder)
- **Grau 4 a Grau 2:** Nível urbano baixo/médio. Vulneráveis a armas de fogo de grosso calibre ou ataques surpresa.
- **Grau 1 (Ex: Nanami, Mei Mei, Naobito, Kusakabe, Choso):** A elite padrão. Dominam reforço avançado de EA, técnicas de barreira (Domínio Simples / Emoção da Pétala Decadente) e alta velocidade tática.
- **Grau Especial / Nível Desastre (Ex: Gojo, Sukuna, Yuta, Kenjaku, Yuki, Kashimo, Hakari, Maki/Toji, Mahito, Jogo):** Anomalias capazes de dizimar exércitos ou colônias inteiras. Possuem Expansão de Domínio letal (exceto restrições celestiais/casos específicos) e Energia Amaldiçoada Reversa (RCT).

### B. Física da Energia Amaldiçoada e Barreiras
1. **Output (Liberação) vs. Reserva:** Ter muita EA não significa bater forte; o dano e a defesa dependem do *Output* máximo de EA que o feiticeiro consegue liberar por segundo (ex: Ryu Ishigori possui o maior Output da história).
2. **Energia Amaldiçoada Reversa (RCT):** Multiplica energia negativa por energia negativa para gerar energia positiva. Consome o **DOBRO** de EA comum.
   - *Regra de Letalidade:* RCT vem do cérebro. Destruir a cabeça ou cortar o pescoço impede a cura instantaneamente. Espíritos Amaldiçoados são desintegrados se receberem Energia Positiva diretamente no núcleo/corpo.
3. **Expansão de Domínio (Ryoiki Tenkai):**
   - Cria um espaço de barreira com a técnica inata infundida, garantindo **Acerto Garantido (Sure-Hit)**.
   - *Conflito de Domínios:* O domínio mais refinado vence. Se tiverem refinamento igual, os acertos garantidos se anulam até que um dos usuários sofra dano físico suficiente para não conseguir manter a barreira.
   - *Exaustão Pós-Domínio (Burnout):* Após o colapso de um Domínio, a Técnica Inata do usuário fica instável e **INUTILIZÁVEL** por alguns minutos (exceto se destruir e regenerar a parte do cérebro onde a técnica reside com RCT, causando dano cerebral progressivo).
4. **Anti-Domínios:**
   - *Domínio Simples (Simple Domain) / Cesta Oca de Vime:* Neutraliza o *Sure-Hit* da barreira inimiga, mas não neutraliza a técnica física se o inimigo atacar manualmente. Contra domínios de Grau Especial, a barreira do Domínio Simples é corroída em poucos segundos se o usuário sair da postura.
   - *Amplificação de Domínio:* Envolve o próprio corpo em um domínio vazio para neutralizar técnicas de contato (como o *Mugen* do Gojo), mas **impede o uso da própria Técnica Inata simultaneamente**.

---

## 6. FICHAS TÉCNICAS DE PRECISÃO (REFERÊNCIA RÁPIDA DE ARQUÉTIPOS)
*(Sempre siga estas mecânicas exatas quando esses personagens aparecerem)*:
- **Satoru Gojo:** *Seis Olhos* (consumo de EA próximo de zero, processamento atômico) + *Ilimitado (Mugen)*. Neutro: desaceleração infinita (nada o toca, exceto Amplificação de Domínio, Expansão de Domínio ou a *Lança Invertida do Céu*). Azul: atração magnética implosiva. Vermelho: repulsão explosiva (2x o output do Azul). Vazio Roxo: massa imaginária que apaga matéria. Domínio (*Vazio Infinito*): sobrecarrega o cérebro do alvo com informação infinita (0.2s = meses de dados).
- **Ryomen Sukuna:** *Santuário (Mizushi)*. *Desmantelar (Dismantle)*: corte padrão à distância para objetos inanimados/alvos comuns. *Clivar (Cleave)*: exige contato físico com a palma da mão, ajustando-se à resistência e EA do alvo para cortá-lo de uma vez. *Fuga (Kamino - Fornalha)*: flecha de fogo termobárica lenta, só pode ser usada após atingir o alvo com *Clivar* e *Desmantelar*. Domínio (*Santuário Malevolente*): Barreira ABERTA (raio de até 200m), ataca tudo com *Clivar* (seres com EA) e *Desmantelar* (objetos sem EA).
- **Kinji Hakari:** Técnica *Restless Gambler*. Domínio (*Idle Death Gamble*): O acerto garantido é inofensivo e transfere todas as regras do Pachinko para o cérebro do inimigo. Se tirar o *Jackpot* (probabilidade de 1/239, com giros falsos e indicadores de cor), ganha **EA Infinita por 4 minutos e 11 segundos**, ativando RCT reflexiva e automática mais rápida que a de Gojo e Sukuna.
- **Hiromi Higuruma:** Domínio (*Deadly Sentencing*): Proíbe toda violência dentro da barreira. O shikigami *Judgeman* acusa o alvo de um crime baseado em provas. Se culpado, aplica *Confisco* (remove a Ferramenta Amaldiçoada do alvo; se não tiver ferramenta, remove a Técnica Amaldiçoada; se não tiver técnica, remove a EA) e, em casos graves, *Pena de Morte* (concede a *Espada do Carrasco*, que mata com um único arranhão em qualquer parte do corpo).
- **Hajime Kashimo:** Propriedade de EA elétrica (todo golpe físico dá choque que ignora guarda convencional; acumula cargas positivas no alvo para disparar um raio teleguiado na cabeça que funciona como *Sure-Hit* sem precisar de Domínio). Técnica Inata (*Besta Mítica Âmbar*): Uso único (reconstrói o corpo em eletricidade pura e o mata ao final).
- **Maki Zenin / Toji Fushiguro:** *Restrição Celestial Completa (Zero EA)*. Invisíveis para barreiras (podem entrar e sair de Expansões de Domínio livremente e são imunes ao *Sure-Hit* que foca em EA). Sentidos sobre-humanos (veem correntes de ar e maldições). Usam a *Katana da Alma Dividida* (ignora durabilidade física e corta diretamente a alma; o dano só pode ser curado com RCT se o alvo tiver percepção do formato da própria alma).
- **Kenjaku:** Técnica de Transplante Cerebral + *Manipulação de Espíritos Amaldiçoados* (de Suguru Geto, podendo extrair técnicas de maldições Grau Semi-1 ou superior com *Uzumaki*) + *Sistema Antigravitacional* (de Kaori Itadori). Domínio (*Womb Profusion*): Barreira ABERTA.

---

## 7. REGRAS DO CENÁRIO (ENTRE SHIBUYA E SHINJUKU / CULLING GAME) E PILARES DE MESA
- Nas colônias do **Jogo do Abate (Culling Game)**, cada jogador possui uma **Kogane** (interface amaldiçoada que anuncia regras, pontuação e localização). Feiticeiros valem **5 pontos** ao morrerem; Não-feiticeiros valem **1 ponto**; com **100 pontos**, um jogador pode adicionar uma nova regra geral.
- **Pilares de Aptidão e Perícias Narrativas (100% Narrativo, Sem Cálculos Matemáticos):** Respeite os Pilares de Aptidão do jogador (incluindo sua **▼ Fragilidade Obrigatória**) e suas Perícias Narrativas (★ Maestria, ● Afinidade, ▼ Inaptidão), sem nunca exibir somas matemáticas de perícias no texto.
- **Saída Estruturada em Três Partes:** Preencha sempre \`engineLog\` (para o bloco ⚙️ \`[LOG DO MOTOR JUJUTSU]\`), \`narrative\` (para o bloco 📖 \`[NARRATIVA]\`) e \`worldStateUpdate\` / \`playerStateUpdate\` / \`activeStoryCards\` / \`activeCardRuleSummary\` (para o bloco 📊 \`[HUD & REGISTRO DE CARDS]\`).`;

export interface TurnRequestPayload {
  model: string;
  character: CharacterSheet;
  world: WorldStateUpdate;
  actionMode: ActionMode;
  actionText: string;
  diceRoll: number;
  revealedHandVow: boolean;
  ragContext: string;
  activeCards: string[];
  memoryContext: string;
  recentHistory: string;
  isOpening: boolean;
  startingArcTitle?: string;
  customOpeningPrompt?: string;
  customApiKey?: string;
}

export async function executeNarrativeTurn(
  payload: TurnRequestPayload
): Promise<{
  ok: boolean;
  usedFallback?: boolean;
  apiKeyState?: ApiKeyHealthState;
  statusNotice?: string;
  usedModel?: string;
  switchedFromPrimary?: boolean;
  errorMessage?: string;
  data: GmTurnResponse;
}> {
  const ai = getBrowserGeminiClient();
  let lastClientError = '';

  if (ai) {
    const { mod: totalDiceMod, breakdown: modBreakdown } = getGradeModifier(
      payload.character?.grade,
      payload.character?.inBlackFlashZone,
      payload.revealedHandVow
    );
    const modifiedRoll = Number(payload.diceRoll) + totalDiceMod;

    const turnPrompt = payload.isOpening
      ? `
=== ABERTURA DE NOVA CAMPANHA (TURNO #1) ===
Personagem do Jogador: ${JSON.stringify(payload.character, null, 2)}
=== FICHA EXCLUSIVA VIVA DO PERSONAGEM ===
${payload.character?.exclusiveSheetMarkdown || 'Ficha Exclusiva ativa.'}
Estado Inicial do Mundo e NPCs: ${JSON.stringify(payload.world, null, 2)}
Arco Escolhido: ${payload.startingArcTitle || payload.world.arc}
Cena de Abertura / Onde a Campanha Inicia: ${payload.customOpeningPrompt || ''}

=== STORY CARDS E ENCICLOPÉDIA CANÔNICA ATIVADOS (RAG) ===
${payload.ragContext || 'Conhecimento canônico geral de Jujutsu Kaisen.'}

Gere o Turno #1 de abertura desta campanha exatamente no contexto de "${payload.customOpeningPrompt || payload.startingArcTitle}", apresentando a atmosfera visceral do local, a presença dos NPCs em cena com suas personalidades e falas canônicas (*Nome*: Ação "Fala") e passando a ação ao jogador!
`
      : `
=== ESTADO ATUAL DO PERSONAGEM DO JOGADOR ===
${JSON.stringify(payload.character, null, 2)}

=== FICHA EXCLUSIVA VIVA DO PERSONAGEM ===
${payload.character?.exclusiveSheetMarkdown || 'Ficha Exclusiva do personagem.'}

=== ESTADO ATUAL DO MUNDO E NPCS EM CENA ===
${JSON.stringify(payload.world, null, 2)}

=== MEMÓRIA CONSOLIDADA DA CAMPANHA ===
${payload.memoryContext || 'Início da campanha.'}

=== HISTÓRICO RECENTE DE TURNOS ===
${payload.recentHistory || 'Primeiro turno da sessão.'}

=== STORY CARDS E ENCICLOPÉDIA CANÔNICA ATIVADOS NESTE TURNO (RAG) ===
${payload.ragContext || 'Use o cânone oficial de Jujutsu Kaisen.'}

=== AÇÃO DO JOGADOR NESTE TURNO ===
- Modo de Ação: ${payload.actionMode} (${
          payload.actionMode === 'DO'
            ? 'Ação Física / Combate'
            : payload.actionMode === 'SAY'
            ? 'Diálogo Direto'
            : payload.actionMode === 'TECHNIQUE'
            ? 'Execução de Técnica Amaldiçoada / Domínio / RCT'
            : 'Direcionamento Narrativo de Cena'
        })
- Rolagem 1d20 Natural: ${payload.diceRoll} ${
          Number(payload.diceRoll) === 20
            ? '(CRÍTICO NATURAL 20 — ATIVE BLACK FLASH / KOKUSEN OBRIGATORIAMENTE!)'
            : Number(payload.diceRoll) === 1
            ? '(FALHA CRÍTICA 1 — APLIQUE CONSEQUÊNCIA SEVERA!)'
            : ''
        }
- Modificador Tático Aplicado: ${modBreakdown} => Total Modificado = ${modifiedRoll}
- Voto Vinculativo "Revelar a Própria Mão": ${payload.revealedHandVow ? 'SIM (+20% Output)' : 'NÃO'}
- Texto do Jogador: "${payload.actionText}"

Gere a resposta estruturada em JSON seguindo rigorosamente o schema e o formato teatral (*Narrador*: e *Nome do Personagem*:). Reaja diretamente à fala ou ação "${payload.actionText}".`;

    const normalizedPrimary =
      payload.model === 'gemini-3.5-flash-lite' || payload.model === 'gemini-3.1-flash-lite-preview' || payload.model === 'gemini-3.1-flash-lite'
        ? 'gemini-3.1-flash-lite-preview'
        : 'gemini-3-flash-preview';

    const modelChain = Array.from(
      new Set([
        normalizedPrimary,
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite-preview',
        'gemini-3.8-flash',
      ])
    );

    for (const candidateModel of modelChain) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents: turnPrompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_GM,
            responseMimeType: 'application/json',
            responseSchema: JJK_TURN_SCHEMA,
            temperature: 0.75,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text) as GmTurnResponse;
          return {
            ok: true,
            usedFallback: false,
            apiKeyState: 'VALID',
            usedModel: candidateModel,
            switchedFromPrimary: candidateModel !== normalizedPrimary,
            data: parsed,
          };
        }
      } catch (err) {
        lastClientError = err instanceof Error ? err.message : String(err);
        console.warn(`[Client Gemini] Model ${candidateModel} error:`, lastClientError);
      }
    }
  }

  // Fallback to backend endpoint (which runs server-side validation and the Contextual Narrative Continuity Engine)
  const storedKey =
    payload.customApiKey ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('JJK_CUSTOM_GEMINI_KEY') || ''
      : '');

  const res = await fetch('/api/gemini/turn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(storedKey ? { 'x-custom-api-key': storedKey } : {}),
    },
    body: JSON.stringify({ ...payload, customApiKey: storedKey }),
  });
  const serverResult = await res.json();

  if (serverResult.usedFallback && !serverResult.apiKeyState && lastClientError) {
    const classified = classifyClientGeminiError(lastClientError);
    serverResult.apiKeyState = classified.state;
    serverResult.statusNotice = classified.message;
  }

  return serverResult;
}

export async function generateAnimeImage(payload: {
  prompt: string;
  nanoBananaAnimePrompt?: string;
  narrativeContext?: string;
  characterSummary?: string;
  location?: string;
  aspectRatio?: '16:9' | '1:1';
  customApiKey?: string;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  modelUsed?: string;
  nanoBananaPromptLog?: string;
}> {
  const ai = getBrowserGeminiClient(payload.customApiKey);
  const englishPrompt = `${payload.prompt}. Official Jujutsu Kaisen Season 2 (Shibuya Incident) anime screenshot by MAPPA studio, authentic anime cel-shading, dynamic action linework, glowing blue and crimson cursed energy lighting, kinematic camera composition, sharp character facial features, 8k anime keyframe, no text, no watermark.`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: englishPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: payload.aspectRatio === '1:1' ? '1:1' : '16:9',
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          return {
            ok: true,
            modelUsed: 'gemini-3.1-flash-lite-image',
            nanoBananaPromptLog: payload.nanoBananaAnimePrompt || payload.prompt,
            imageUrl: `data:${mime};base64,${part.inlineData.data}`,
          };
        }
      }
    } catch (err) {
      console.warn('[Client Gemini Image] Falling back to server endpoint:', err);
    }
  }

  const res = await fetch('/api/gemini/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function forgeBalancedTechnique(payload: {
  concept: string;
  characterName: string;
  backstory?: string;
  combatStyle?: string;
  faction: string;
  grade: string;
  customApiKey?: string;
}) {
  const res = await fetch('/api/gemini/technique', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function evaluateSessionZero(payload: {
  characterDraft: Record<string, unknown>;
  conversationHistory: Array<{ sender: string; text: string }>;
  playerReply: string;
  customApiKey?: string;
}) {
  const res = await fetch('/api/gemini/session-zero', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function summarizeCampaignMemory(payload: {
  turnsText: string;
  turnRange: string;
  customApiKey?: string;
}): Promise<{ ok: boolean; summary?: string }> {
  const ai = getBrowserGeminiClient(payload.customApiKey);
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Resuma em 3 a 4 frases densas (em Português do Brasil) os eventos cruciais, ferimentos permanentes, inimigos exorcizados, itens obtidos e promessas feitas nestes turnos de RPG de Jujutsu Kaisen (${payload.turnRange}):\n\n${payload.turnsText}`,
      });
      if (response.text) {
        return {
          ok: true,
          summary: response.text.trim(),
        };
      }
    } catch {
      // Fallback to server endpoint
    }
  }

  const res = await fetch('/api/gemini/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}
