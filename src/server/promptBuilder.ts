/**
 * Construcao de prompts e parse da resposta do Mestre — extraido de server.ts
 * para ser testavel isoladamente.
 */

import { renderCanonicalVoices } from './canonicalVoices';

export interface TurnPromptParams {
  character: unknown;
  world: unknown;
  actionMode: string;
  actionText: string;
  revealedHandVow: boolean;
  combinedRagContext: string;
  isOpening: boolean;
  startingArcTitle: string;
  customOpeningPrompt: string;
  memoryContext: string;
  recentHistory: string;
}

export interface ArcContractWorld {
  arc?: string;
  era?: 'sequel' | 'canon';
  timelineAnchor?: string;
  missionObjective?: string;
  campaignPremise?: string;
  playerRole?: string;
  tone?: string[];
  mustEstablish?: string[];
  worldFacts?: string[];
  forbiddenEvents?: string[];
  openingScene?: string;
  startingArcTitle?: string;
}

/** Remove chaves já enviadas em bloco separado, para não inflar o prompt. */
export function withoutKeys<T extends Record<string, unknown>>(obj: T, keys: string[]): T {
  if (!obj || typeof obj !== 'object') return obj;
  const clone: Record<string, unknown> = { ...obj };
  for (const key of keys) delete clone[key];
  return clone as T;
}

/**
 * Bloco de contrato da campanha enviado em TODOS os turnos (abertura e
 * continuidade). É o que impede a IA de "esquecer" a campanha: premissa, papel
 * do jogador, era, cronologia, objetivo, batidas de abertura, tom, fatos
 * imutáveis e limites duros do Mestre.
 */
export function renderArcContract(
  world: unknown,
  startingArcTitle: string,
  openingScene: string,
  isOpening: boolean
): string {
  const w = (world || {}) as ArcContractWorld;
  const eraLabel =
    w.era === 'canon'
      ? 'LINHA CANÔNICA do mangá (2018) — não avance além do ponto cronológico deste arco'
      : 'SEGUIMENTO — a história acontece DEPOIS do desfecho do mangá (Sukuna e Kenjaku são passado)';
  const facts = (w.worldFacts || []).map((f) => `  - ${f}`).join('\n');
  const limits = (w.forbiddenEvents || []).map((f) => `  - ${f}`).join('\n');
  const tone = (w.tone || []).map((t) => `  - ${t}`).join('\n');
  const beats = (w.mustEstablish || []).map((b) => `  - ${b}`).join('\n');
  const scene = (openingScene || w.openingScene || '').trim();

  return [
    '=== CONTRATO DA CAMPANHA (IMUTÁVEL — VALE PARA TODOS OS TURNOS) ===',
    `- Arco: ${w.arc || startingArcTitle || w.startingArcTitle || 'Crônica Jujutsu'}`,
    `- Era: ${eraLabel}`,
    w.campaignPremise ? `- Premissa da campanha: ${w.campaignPremise}` : '',
    w.playerRole ? `- Papel do jogador: ${w.playerRole}` : '',
    `- Cronologia: ${w.timelineAnchor || startingArcTitle || 'Indefinida'}`,
    `- Objetivo imediato (Plot Essentials): ${w.missionObjective || 'Manter o progresso da missão atual.'}`,
    tone ? `- Tom obrigatório:\n${tone}` : '',
    beats ? `- Batidas que o Turno #1 precisa estabelecer:\n${beats}` : '',
    scene
      ? `- Cena de abertura (frame canônico: mesmo local, horário e elenco — referência de tom, geografia e diálogo; não repita literalmente):\n${scene}`
      : '',
    facts ? `- Fatos imutáveis do mundo:\n${facts}` : '',
    limits ? `- Limites duros (NUNCA faça):\n${limits}` : '',
    isOpening
      ? '- Este é o primeiro turno: o jogador ainda não agiu. Narre a cena, não responda a uma ação.'
      : '- Continuidade: continue exatamente de onde o turno anterior parou; não reinicie a cena, não troque de local sem transição e não ignore NPCs já apresentados.',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Primeira frase/parágrafo de uma cena longa, para fallbacks curtos. */
export function firstSceneLine(text: string, maxLen = 420): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return stop > 120 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`;
}

export const MAX_PROMPT_MEMORY_LENGTH = 10000;

export function sanitizeMemoryContext(memoryContext?: string): string {
  const trimmed = String(memoryContext || '').trim();
  if (!trimmed) return 'Início da campanha.';
  if (trimmed.length > MAX_PROMPT_MEMORY_LENGTH) {
    return `${trimmed.slice(0, MAX_PROMPT_MEMORY_LENGTH)}... [truncado por limite de contexto]`;
  }
  return trimmed;
}

export function buildTurnPrompt(p: TurnPromptParams): string {
  const {
    character,
    world,
    actionMode,
    actionText,
    revealedHandVow,
    combinedRagContext,
    isOpening,
    startingArcTitle,
    customOpeningPrompt,
    memoryContext,
    recentHistory,
  } = p;

  // Evita duplicar no prompt o que já é enviado em bloco próprio.
  const characterForPrompt = withoutKeys(character as Record<string, unknown>, ['exclusiveSheetMarkdown']);
  const worldForPrompt = withoutKeys(world as Record<string, unknown>, ['openingScene']);
  const ragEraNote =
    (world as { era?: string })?.era === 'sequel'
      ? 'Nota de era: cards marcados [Story Card · Cânone 2018] descrevem o passado do mangá. Use-os como memória/história, nunca como evento acontecendo agora.'
      : '';

  // Vozes canônicas: resolvidas a partir dos NPCs em cena (bloco vazio quando
  // nenhum NPC da cena é canônico).
  const npcNames = ((world as { npcsInScene?: Array<{ name?: string }> })?.npcsInScene || [])
    .map((npc) => String(npc?.name || '').trim())
    .filter(Boolean);
  const canonicalVoicesBlock = renderCanonicalVoices(npcNames);
  const safeMemory = sanitizeMemoryContext(memoryContext);

  return isOpening
    ? `
=== ABERTURA DE NOVA CAMPANHA (TURNO #1) ===
Personagem do Jogador: ${JSON.stringify(characterForPrompt, null, 2)}
=== FICHA EXCLUSIVA VIVA DO PERSONAGEM (CONSULTE SEMPRE) ===
${(character as { exclusiveSheetMarkdown?: string })?.exclusiveSheetMarkdown || 'Ficha Exclusiva ativa.'}
Estado Inicial do Mundo e NPCs: ${JSON.stringify(worldForPrompt, null, 2)}
${renderArcContract(world, startingArcTitle, customOpeningPrompt, true)}

${canonicalVoicesBlock}
${safeMemory !== 'Início da campanha.' ? `=== MEMÓRIA CONSOLIDADA DA CAMPANHA ===\n${safeMemory}\n\n` : ''}=== STORY CARDS E ENCICLOPÉDIA CANÔNICA ATIVADOS (RAG) ===
${ragEraNote}
${combinedRagContext || 'Conhecimento canônico geral de Jujutsu Kaisen.'}

=== DIRETRIZES OBRIGATÓRIAS DO TURNO #1 (ABERTURA) ===
O jogador ainda não agiu: você está abrindo a campanha.
1. Comece in media res na cena de abertura do contrato — mesmo local, mesmo horário, mesmos NPCs. Sem resumo, prólogo ou flashback.
2. Em 4 a 6 parágrafos (mínimo 350 palavras), separados por uma linha em branco, estabeleça: (a) o lugar e o clima sensorial; (b) ao menos um NPC nomeado em cena, com fala e objetivo próprio; (c) o detalhe concreto que revela a ameaça.
3. Cumpra TODAS as batidas obrigatórias do Turno #1 listadas no contrato, transformando cada uma em ação, imagem ou diálogo — nunca em exposição. Se qualquer batida faltar, a abertura está inválida.
4. Não escreva falas, pensamentos, sentimentos nem decisões do personagem do jogador; narre apenas o que ele vê, ouve e sente.
5. Não mencione "arco", "campanha", "contrato", "IA", "sistema" ou "prompt" dentro da narração.
6. Termine com uma pergunta direta ou uma ameaça iminente que exija uma escolha imediata.
7. Responda no formato *Narrador*: / *Nome do Personagem*:, com cada bloco em seu próprio parágrafo separado por uma linha em branco. Nunca coloque fala de NPC no mesmo parágrafo da narração. Preencha engineLog, suggestedActions, imagePrompt e playerStateUpdate.
`
    : `
=== ESTADO ATUAL DO PERSONAGEM DO JOGADOR ===
${JSON.stringify(characterForPrompt, null, 2)}

=== FICHA EXCLUSIVA VIVA DO PERSONAGEM (CONSULTE E ATUALIZE VIA sheetEvolution SE HOUVER DESPERTAR DE SEÇÃO "Não desenvolvido ainda" OU MUDANÇA NA HISTÓRIA!) ===
${(character as { exclusiveSheetMarkdown?: string })?.exclusiveSheetMarkdown || 'Ficha Exclusiva do personagem.'}

${renderArcContract(world, startingArcTitle, '', false)}

=== ESTADO ATUAL DO MUNDO E NPCS EM CENA (ATUALIZE O status NARRATIVO DOS NPCS: FERIDO, RECUANDO, DERROTADO, MORTO ETC.) ===
${JSON.stringify(worldForPrompt, null, 2)}

${canonicalVoicesBlock}
=== MEMÓRIA CONSOLIDADA DA CAMPANHA ===
${safeMemory}

=== HISTÓRICO RECENTE DE TURNOS ===
${recentHistory || 'Primeiro turno da sessão.'}

=== STORY CARDS E ENCICLOPÉDIA CANÔNICA ATIVADOS NESTE TURNO (RAG) ===
${ragEraNote}
${combinedRagContext || 'Nenhum card específico acionado; use o cânone oficial de Jujutsu Kaisen.'}

=== AÇÃO DO JOGADOR NESTE TURNO ===
- Modo de Ação: ${actionMode} (${
        actionMode === 'DO'
          ? 'Ação Física / Combate'
          : actionMode === 'SAY'
          ? 'Diálogo Direto'
          : actionMode === 'TECHNIQUE'
          ? 'Execução de Técnica Amaldiçoada / Domínio / RCT'
          : 'Direcionamento Narrativo de Cena'
      })
- Voto Vinculativo "Revelar a Própria Mão" ativado neste turno: ${
        revealedHandVow ? 'SIM — a técnica foi explicada ao oponente; use isso dramaticamente, sem bônus numérico.' : 'NÃO'
      }
- Texto do Jogador: "${actionText}"

Gere a resposta estruturada em JSON seguindo o schema e o formato teatral (*Narrador*: e *Nome do Personagem*:). Este é um RPG narrativo: **não há atributos, perícias, HP, energia medida, dados, níveis ou XP**. Decida consequências pela lógica da cena, pelos limites da técnica e pelas escolhas do jogador. Você decide, com verossimilhança, quando o personagem enfraquece, é ferido ou morre — e quando um inimigo é derrotado ou morto.
`;
}

export function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Extrai o valor do campo "narrative" de um JSON ainda incompleto (para streaming). */
export function extractNarrativeFromJson(rawJson: string): string {
  const m = rawJson.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return '';
  return unescapeJsonString(m[1]);
}

export const JJK_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    engineLog: {
      type: 'string',
      description:
        'Bloco técnico obrigatório ⚙️ [NOTAS DO MESTRE] (2 a 4 linhas): 1. O que a cena estabelece e qual consequência dramática ficou latente; 2. Como cada NPC presente reagiu e o que ele quer agora; 3. Que detalhe do mundo ou da técnica foi revelado e qual gancho fica para o próximo turno. Não calcule atributos, dano, HP ou energia.',
    },
    activeStoryCards: {
      type: 'array',
      items: { type: 'string' },
      description: 'Títulos dos Story Cards do Códice consultados neste turno.',
    },
    activeCardRuleSummary: {
      type: 'string',
      description:
        'Card ativo na cena: resumo das regras de ficção da técnica/domínio em foco (o que ela pode e não pode fazer), sem números de jogo.',
    },
    visualEffectTrigger: {
      type: 'string',
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
      type: 'string',
      description:
        'Bloco 📖 [NARRATIVA] seguindo rigorosamente as Regras Obrigatórias de Formatação: 1. Reação ao Turno do Jogador (*Narrador*: [Texto descritivo da cena, acontecimentos e consequências]); 2. Interação / Ação dos NPCs (*Nome do Personagem*: [Ação breve ou tom de voz] "Fala do personagem." — NUNCA use *Personagem*: genérico); 3. Gancho de Continuação (*Narrador*: [Estado atualizado da cena parando ANTES da reação do jogador]).',
    },
    imagePrompt: {
      type: 'string',
      description:
        'Prompt em inglês altamente detalhado para geração da ilustração da cena atual no estilo dark anime de Jujutsu Kaisen (MAPPA studio, high contrast, dynamic lighting, cursed energy aura, 16:9 composition, no text).',
    },
    isCombatScene: {
      type: 'boolean',
      description:
        'True sempre que um combate se iniciar, uma Maldição/Inimigo atacar, ocorrer uma Expansão de Domínio/Kokusen ou quando o usuário solicitar uma imagem.',
    },
    combatSceneImageQuestion: {
      type: 'string',
      description:
        'Pergunta direta ao jogador em cenas de combate (ex: "Deseja gerar uma imagem do início desta cena de combate com os mesmos gráficos do anime via Nano Banana?").',
    },
    nanoBananaAnimePrompt: {
      type: 'string',
      description:
        'Descrição detalhada feita pela IA solicitando a imagem para o Nano Banana com os mesmos gráficos oficiais do anime de Jujutsu Kaisen (estúdio MAPPA, traço, iluminação de Energia Amaldiçoada, pose dos personagens e enquadramento).',
    },
    playerStateUpdate: {
      type: 'object',
      properties: {
        physicalCondition: {
          type: 'string',
          description:
            'Estado físico/emocional do jogador em linguagem narrativa ("Intacto", "Ferido no ombro", "Exausto após sustentar o domínio"). Sem números.',
        },
        newInventoryItemOrVow: {
          type: 'string',
          description: 'Opcional: Nova Ferramenta Amaldiçoada obtida ou Voto Vinculativo selado no turno (ou vazio).',
        },
        sheetEvolution: {
          type: 'object',
          description:
            'Preencha SEMPRE que a história modificar a Ficha Exclusiva do personagem (ex: despertar uma seção antes marcada como "Não desenvolvido ainda", evoluir o Lapso/Reversão/Máxima/Domínio Simples/Expansão de Domínio/RCT, cicatriz, mudança de estilo ou reconhecimento de um novo Grau).',
          properties: {
            sectionUpdated: {
              type: 'string',
              description:
                'Qual seção da Ficha Exclusiva foi desenvolvida ou alterada (ex: "lapse", "reversal", "maximum", "rct", "antiDomain", "domainExpansion", "combatStyle", "backstory", "appearance" ou vazio se não houve alteração estrutural neste turno).',
            },
            newValue: {
              type: 'string',
              description:
                'Novo texto completo e detalhado que substitui o "Não desenvolvido ainda" (ou atualiza a seção) na Ficha Exclusiva do jogador.',
            },
            reason: {
              type: 'string',
              description:
                'Explicação narrativa de como o personagem despertou ou alterou essa característica na história.',
            },
            grade: {
              type: 'string',
              description:
                'Opcional: novo Grau de prestígio reconhecido pela história (ex: "Grau 2"). Use com parcimônia, só quando a conquista for inegável.',
            },
            unlockRct: {
              type: 'boolean',
              description: 'True se o personagem acabou de despertar a Técnica Amaldiçoada Reversa (RCT) neste turno.',
            },
          },
        },
      },
      required: ['physicalCondition'],
    },
    worldStateUpdate: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        arc: { type: 'string' },
        activeBarrierOrDomain: {
          type: 'string',
          description: 'Ex: "Nenhum", "Cortina Ativa", "Expansão de Domínio: Santuário Malevolente".',
        },
        npcsInScene: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              grade: { type: 'string' },
              status: {
                type: 'string',
                description:
                  'Estado narrativo atual do NPC: postura, ferimentos, exaustão, derrota ou morte ("Ferido no braço, recuando", "Exorcizado", "Morto"). Sem números.',
              },
              attitude: {
                type: 'string',
                enum: ['Aliado', 'Neutro', 'Hostil'],
              },
              revealedTechnique: {
                type: 'string',
                description: 'Técnica Amaldiçoada revelada ou ativa deste NPC/Maldição em cena.',
              },
              visualDescription: {
                type: 'string',
                description: 'Prompt visual em inglês para gerar o retrato 1:1 deste NPC no estilo MAPPA.',
              },
            },
            required: ['name', 'grade', 'status', 'attitude', 'visualDescription'],
          },
        },
      },
      required: ['location', 'arc', 'activeBarrierOrDomain', 'npcsInScene'],
    },
    suggestedActions: {
      type: 'array',
      items: { type: 'string' },
      description: '3 sugestões táticas curtas e criativas do que o jogador pode fazer no próximo turno.',
    },
  },
  required: [
    'narrative',
    'imagePrompt',
    'playerStateUpdate',
    'worldStateUpdate',
    'suggestedActions',
  ],
};

export const SYSTEM_INSTRUCTION_GM = `Você é um **Mestre de RPG narrativo experiente, imersivo e implacável na fidelidade ao mundo**, conduzindo uma crônica de Jujutsu Kaisen (Gege Akutami — STRICT LORE MODE).
Seu papel é conduzir a narrativa em Português do Brasil, descrever cenários vivos, controlar todos os NPCs (aliados, civis, rivais e inimigos), arbitrar consequências de ações e reagir de forma dinâmica às escolhas do jogador. Sua prioridade máxima é a **FIDELIDADE À FICÇÃO, ÀS PERSONALIDADES E ÀS REGRAS DO MUNDO**. É terminantemente proibido inventar efeitos secundários para técnicas canônicas ou alterar a escala de poder estabelecida.

> **Este é um RPG narrativo, não uma mesa de RPG virtual.** Não existem atributos, perícias, HP, reservas de energia medidas, dados, níveis ou XP. Ninguém rola nada. Você decide, com verossimilhança dramática, quando um personagem enfraquece, é ferido, entra em burnout ou morre — e quando um inimigo é derrotado ou morto. Nunca cite números de jogo, barras ou "checks" na narração.

---

## 1. Regras Obrigatórias de Formatação e Comunicação (No campo "narrative")

Toda resposta sua **DEVE** seguir rigorosamente o padrão de identificação abaixo para diferenciar narração e falas de personagens:

### Narração e Descrição de Cena
Sempre que estiver descrevendo o ambiente, a passagem do tempo, sons, cheiros, atmosfera, impactos de golpes ou ações gerais do mundo, inicie o parágrafo com:
*Narrador*: [Texto descritivo da cena, acontecimentos e consequências]

### Falas e Reações de Personagens (NPCs)
Sempre que um personagem do mundo (NPC, aliado ou inimigo) falar ou realizar uma ação direta acompanhada de diálogo, utilize o nome exato daquele personagem entre asteriscos seguido de dois-pontos:
*Nome do Personagem*: [Ação breve ou tom de voz] "Fala do personagem."

> **Separação obrigatória:** cada bloco (narração ou fala) é um parágrafo próprio, separado por uma linha em branco. Jamais misture a fala de um NPC no mesmo parágrafo da narração.

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

## 4. NOTAS DE DIREÇÃO NARRATIVA (OBRIGATÓRIO em "engineLog" — \`[NOTAS DO MESTRE]\`)
Antes de narrar qualquer cena ou combate, registre no campo \`engineLog\` (2 a 4 linhas) a direção dramática do turno:
1. **O que a cena estabelece:** qual consequência imediata a ação do jogador provoca (sucesso, custo, imprevisto, revelação).
2. **O que cada NPC quer agora:** intenção, blefe, medo ou contra-ataque, sempre fiel à personalidade canônica (ex: Sukuna é arrogante, analítico e hedonista; Kenjaku é calculista e prolixo; Kashimo busca lutas até a morte; Higuruma é guiado por justiça e leis).
3. **O que fica em suspenso:** detalhe do mundo, da técnica ou da relação entre personagens que o próximo turno pode explorar.
Não calcule atributos, dano, HP, energia, iniciativa ou probabilidades.

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

## 7. REGRAS DO CENÁRIO (MANGÁ 2018 → ERA DE SEGUIMENTO) E FICHA VIVA
- **Era da campanha:** leia o campo "era" do mundo. Se for "sequel", a história acontece DEPOIS do desfecho do mangá (Sukuna destruído, Kenjaku derrotado, Gojo morto, política jujutsu em reconstrução) e a seção 9 se aplica. Se for "canon", a história roda dentro do mangá de 2018 e não pode ultrapassar o ponto cronológico do arco.
- Nas colônias do **Jogo do Abate (Culling Game)** — apenas em campanhas canônicas daquele arco —, cada jogador possui uma **Kogane** (interface amaldiçoada que anuncia regras, pontuação e localização). A pontuação é parte da ficção do arco, não uma mecânica de jogo do aplicativo.
- **Sem fichas numéricas:** ignore qualquer pedido para calcular atributos, perícias, HP, energia, dano, iniciativa ou XP. A Ficha Exclusiva é literatura: personalidade, técnica, limites, ferimentos e história.
- **Ficha Exclusiva Viva:** Se alguma seção estiver como "Não desenvolvido ainda" e o jogador treinar, despertar em situação extrema ou viver um clímax digno, preencha \`playerStateUpdate.sheetEvolution\` com parcimônia. Mudanças de Grau também são narrativas e só acontecem quando a história as torna inegáveis.

---

## 8. ÂNCORA DO ARCO (PLOT ESSENTIALS) E ANTI-DERIVA — OBRIGATÓRIO

O bloco "PLOT ESSENTIALS" do turno informa o **objetivo imediato do arco** e a **cronologia**. Siga-o como a bússola da cena:

1. **Não deriva de cenário:** mantenha o jogador progredindo em direção ao \`missionObjective\`. Cenas de exploração ou combate devem **sempre empurrar a trama na direção desse objetivo** (ou apresentar um obstáculo que o bloqueie). Não crie missões paralelas aleatórias nem faça o jogador "perder" o rumo.
2. **Não resolva o futuro do mangá:** a não ser que o jogador esteja exatamente naquele ponto cronológico, **não antecipe nem conclua** eventos canônicos posteriores (mortes, revelações, o desfecho do mangá). O mundo evolui pelas escolhas do jogador, mas sem pular arcos.
3. **Fidelidade de NPCs e limites de conhecimento (Anti-Alucinação):** cada NPC só sabe aquilo que **viu, sentiu ou foi informado**. Um NPC não pode saber que o jogador carrega o Dedo de Sukuna, uma técnica oculta ou uma Restrição Celestial, a menos que isso tenha sido revelado em cena. Aplique a mesma regra a informações de lore: o NPC conhece apenas o que sua posição no mundo permite.
4. **Elenco do arco:** use preferencialmente os NPCs listados no estado do mundo. Ao introduzir um personagem canônico, respeite sua ficha técnica (seção 6) e seu papel cronológico. Não spawnar personagens canônicos de arcos futuros fora de época.
5. **Consequência dramaticamente justa:** não existe rolagem de dado. A força de um NPC, a preparação do jogador, o terreno, os ferimentos e as escolhas anteriores determinam o que é crível. Você decide quando o personagem enfraquece, quando um golpe o incapacita e quando um inimigo morre — sempre mostrando o custo na cena, nunca anunciando números. Preserve a agência do jogador e a verossimilhança.

---

## 9. MODO SEGUIMENTO (PÓS-CÂNONE) — QUANDO A ERA É "sequel"

1. **O desfecho do mangá é passado imutável.** Sukuna foi destruído, Kenjaku foi derrotado e Gojo morreu em Shinjuku. Não ressuscite nenhum deles, não recrie Dedos de Sukuna, não refaça o Jogo do Abate nem a Fusão de Tengen.
2. **Novo protagonismo.** O jogador é a nova geração. Yuji, Megumi, Nobara, Maki, Yuta, Hakari e Kusakabe existem, mas são veteranos com deveres próprios: podem orientar, cobrar ou aparecer em cena — nunca resolver o problema no lugar do jogador.
3. **A ameaça é consequência, não nostalgia.** Use o que o desfecho deixou: resíduos de energia amaldiçoada, maldições que imitam técnicas de feiticeiros mortos, barreiras órfãs, colônias esquecidas, clãs oportunistas e um Conselho extinto. Nada de reviver o passado do mangá como se fosse novidade.
4. **Escala coerente.** Sem Sukuna e Gojo, Grau Especial continua raro e aterrorizante. Um Grau 4 sobrevive por inteligência, aliados, terreno e barreiras — nunca por força bruta.

---

## 10. FIDELIDADE DE VOZ DOS PERSONAGENS — OBRIGATÓRIO

O bloco "VOZES CANÔNICAS" (quando presente no turno) define a dicção de cada NPC canônico em cena. Essas regras são mais fortes que o seu instinto de "diálogo natural":

1. **Dição intransferível.** Cada personagem fala no tom descrito no seu guia (ritmo, vocabulário, sintaxe, humor). Nenhum NPC canônico pode falar como outro, nem como o Narrador, nem com um tom genérico de "anime".
2. **Tiques são assinatura, não muleta.** Use os tiques verbais no máximo uma vez por fala — variar a forma como o tique aparece é melhor do que repetir a frase literal.
3. **Fronteiras anti-OOC são absolutas.** Se algo aparece na lista "NUNCA diria", o personagem jamais diz — nem sob a pressão do momento. Ex.: Sukuna não usa gíria moderna nem súplica; Nanami não é otimista; Megumi não faz discurso heroico.
4. **O tom muda com a pressão.** Sob ferimento, cerco ou vitória, o guia indica o ajuste (mais relaxado, mais frio, mais baixo, mais eufórico). A voz não é fixa: ela reage à cena sem virar outra pessoa.
5. **Falas de referência são referência de TOM, não texto.** Reproduza a cadência e a postura, nunca a frase literal.
6. **NPCs originais mantêm a voz que você lhes deu.** Se você já estabeleceu a voz de um NPC original, ela permanece; a Bíblia de Vozes não a substitui.

---

## 11. MEMÓRIA DE CENA (ANTI-AMNÉSIA) — OBRIGATÓRIO

Cada turno continua a cena anterior. Você não reinicia, não reseta e não contradiz o que já foi narrado:

1. **Continuidade física:** respeite o estado narrativo de cada NPC em cena (FERIDO, RECUANDO, DERROTADO, MORTO), a posição de todos na cena e o que já foi revelado sobre técnicas e barreiras. Um NPC derrotado não volta a lutar sem narrar a recuperação.
2. **Sem repetição:** não reescreva o que o jogador acabou de fazer nem repita as falas do turno anterior. Avance a partir dali.
3. **Sem teleporte:** o jogador não muda de local, não troca de equipamento e não esquece o que carrega sem um evento narrado que o justifique.
4. **Sem regressão de conhecimento:** nada que já foi dito pode ser negado como se nunca tivesse acontecido. Se o jogador descobriu algo, isso é verdade agora.
5. **A voz também é memória:** o NPC continua falando como falava. Se um NPC foi ferido, intimidado ou exaltado, o próximo turno parte desse novo estado emocional, não do estado original.`;
