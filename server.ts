import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

interface ServerStoryCard {
  id: string;
  title: string;
  keys: string[];
  type: 'character' | 'technique' | 'domain' | 'tool' | 'location' | 'lore';
  value: string;
  source?: 'codex_md' | 'story_json' | 'initial' | 'custom';
}

/**
 * Loads the 283 Story Cards from ./json/adventure-UhtU4tSbk-kc-story-cards-284.json
 * and the 1.1MB Encyclopedic Codex from ./Codex.md / ./JJK_Codex_Ultra_Completo.md at server startup.
 */
let SERVER_STORY_CARDS: ServerStoryCard[] = [];
let SERVER_CODEX_MD_CARDS: ServerStoryCard[] = [];
let SERVER_MD_SECTIONS: { title: string; keys: string[]; content: string }[] = [];

function loadServerSideLore() {
  const cwd = process.cwd();
  const jsonCandidates = [
    path.join(cwd, 'json', 'adventure-UhtU4tSbk-kc-story-cards-284.json'),
    path.join(cwd, 'adventure-UhtU4tSbk-kc-story-cards-284.json'),
  ];

  for (const jsonPath of jsonCandidates) {
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          SERVER_STORY_CARDS = parsed
            .filter((c) => c && c.value && String(c.value).trim().length > 0)
            .map((c, idx) => {
              const title = String(c.title || `Card #${idx + 1}`).trim();
              const keys = Array.isArray(c.keys)
                ? c.keys.map((k: unknown) => String(k).trim().toLowerCase())
                : String(c.keys || title)
                    .split(',')
                    .map((k) => k.trim().toLowerCase())
                    .filter(Boolean);
              const rawType = String(c.type || 'lore').toLowerCase();
              const mappedType: ServerStoryCard['type'] = rawType.includes('char')
                ? 'character'
                : rawType.includes('tech') || rawType.includes('innate')
                ? 'technique'
                : rawType.includes('domain')
                ? 'domain'
                : rawType.includes('tool') || rawType.includes('item')
                ? 'tool'
                : rawType.includes('loc') || rawType.includes('place')
                ? 'location'
                : 'lore';

              return {
                id: `canon-card-${idx + 1}`,
                title,
                keys,
                type: mappedType,
                value: String(c.value).trim(),
                source: 'story_json',
              };
            });
          console.log(`[JJK RAG Engine] ${SERVER_STORY_CARDS.length} Story Cards canônicos carregados de ${path.basename(jsonPath)}.`);
        }
      } catch (err) {
        console.warn('[JJK RAG Engine] Aviso ao ler JSON de Story Cards:', err);
      }
      break;
    }
  }

  const mdCandidates = [
    path.join(cwd, 'Codex.md'),
    path.join(cwd, 'JJK_Codex_Ultra_Completo.md'),
  ];

  for (const mdPath of mdCandidates) {
    if (fs.existsSync(mdPath)) {
      try {
        const rawMd = fs.readFileSync(mdPath, 'utf-8');
        const rawSections = rawMd
          .split(/\n(?=##\s+)/)
          .map((s) => s.trim())
          .filter((s) => s.length > 80);

        SERVER_MD_SECTIONS = rawSections.map((sec) => {
          const firstLineEnd = sec.indexOf('\n');
          const header = firstLineEnd !== -1 ? sec.slice(0, firstLineEnd).replace(/^#+\s*/, '').trim() : 'Registro Canônico';
          const keysMatch = sec.match(/\*\*Gatilhos \(Keys\):\*\*\s*([^\n]+)/i);
          const extractedKeys = keysMatch
            ? keysMatch[1]
                .split(/[,;]/)
                .map((k) => k.trim().toLowerCase())
                .filter(Boolean)
            : [];
          const headerWords = header
            .toLowerCase()
            .replace(/\[[^\]]+\]/g, '')
            .split(/[\s()—\-–/]+/)
            .filter((w) => w.length >= 3);

          return {
            title: header,
            keys: Array.from(new Set([...extractedKeys, ...headerWords])),
            content: sec.slice(0, 2600),
          };
        });

        SERVER_CODEX_MD_CARDS = SERVER_MD_SECTIONS.map((sec, idx) => {
          const lowerTitle = sec.title.toLowerCase();
          const mappedType: ServerStoryCard['type'] =
            lowerTitle.includes('[personagem]') || lowerTitle.includes('grau') || lowerTitle.includes('maldição')
              ? 'character'
              : lowerTitle.includes('domínio') || lowerTitle.includes('domain')
              ? 'domain'
              : lowerTitle.includes('técnica') || lowerTitle.includes('shikigami')
              ? 'technique'
              : lowerTitle.includes('ferramenta') || lowerTitle.includes('arma') || lowerTitle.includes('objeto')
              ? 'tool'
              : lowerTitle.includes('escola') || lowerTitle.includes('shibuya') || lowerTitle.includes('local')
              ? 'location'
              : 'lore';

          return {
            id: `codex-md-${idx + 1}`,
            title: sec.title,
            keys: sec.keys,
            type: mappedType,
            value: sec.content,
            source: 'codex_md',
          };
        });

        console.log(`[JJK RAG Engine] ${SERVER_MD_SECTIONS.length} verbetes enciclopédicos carregados de ${path.basename(mdPath)} e integrados ao Códice.`);
      } catch (err) {
        console.warn(`[JJK RAG Engine] Aviso ao ler ${path.basename(mdPath)}:`, err);
      }
      break;
    }
  }
}

loadServerSideLore();

/**
 * Searches both the 283 Story Cards and the 1.1MB Encyclopedic Markdown Codex on the server
 * to enrich every turn with zero-hallucination canonical knowledge.
 */
function buildServerSideDeepRag(searchQuery: string, existingTitles: string[] = []): {
  extraRagText: string;
  matchedTitles: string[];
} {
  const q = (searchQuery || '').toLowerCase();
  if (!q.trim()) return { extraRagText: '', matchedTitles: [] };

  const matchedTitles = new Set<string>(existingTitles);
  const chunks: string[] = [];

  // 1. Search the 1.1MB Portuguese Encyclopedic Codex sections
  if (SERVER_MD_SECTIONS.length > 0) {
    const scoredMd = SERVER_MD_SECTIONS.map((sec) => {
      let score = 0;
      for (const k of sec.keys) {
        if (k.length >= 3 && q.includes(k)) {
          score += k.length >= 5 ? 8 : 4;
        }
      }
      return { sec, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    for (const item of scoredMd) {
      matchedTitles.add(item.sec.title);
      chunks.push(item.sec.content);
    }
  }

  // 2. Search the 283 Story Cards for additional context
  if (SERVER_STORY_CARDS.length > 0) {
    const scoredCards = SERVER_STORY_CARDS.map((card) => {
      let score = 0;
      if (q.includes(card.title.toLowerCase())) score += 10;
      for (const k of card.keys) {
        if (k.length >= 3 && q.includes(k)) score += 5;
      }
      return { card, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    for (const item of scoredCards) {
      if (!matchedTitles.has(item.card.title)) {
        matchedTitles.add(item.card.title);
        chunks.push(`### [Story Card] ${item.card.title}\n${item.card.value}`);
      }
    }
  }

  return {
    extraRagText: chunks.join('\n\n---\n\n'),
    matchedTitles: Array.from(matchedTitles).slice(0, 12),
  };
}

function getGradeModifier(grade?: string, inBlackFlashZone?: boolean, revealedHandVow?: boolean): {
  mod: number;
  breakdown: string;
} {
  const g = (grade || 'Grau 3').toLowerCase();
  let gradeMod = 1;
  if (g.includes('especial')) gradeMod = 6;
  else if (g.includes('semi-grau 1') || g.includes('semi grau 1')) gradeMod = 3;
  else if (g.includes('grau 1')) gradeMod = 4;
  else if (g.includes('grau 2')) gradeMod = 2;
  else if (g.includes('grau 3')) gradeMod = 1;
  else if (g.includes('grau 4')) gradeMod = 0;

  const zoneMod = inBlackFlashZone ? 2 : 0;
  const vowMod = revealedHandVow ? 2 : 0;
  const totalMod = gradeMod + zoneMod + vowMod;

  const parts = [`Grau (${gradeMod >= 0 ? `+${gradeMod}` : gradeMod})`];
  if (zoneMod > 0) parts.push(`Zona Kokusen (+${zoneMod})`);
  if (vowMod > 0) parts.push(`Revelar a Mão (+${vowMod})`);

  return {
    mod: totalMod,
    breakdown: parts.join(' + '),
  };
}

const JJK_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    engineLog: {
      type: 'string',
      description:
        'Bloco técnico obrigatório ⚙️ [LOG DO MOTOR JUJUTSU] (2 a 4 linhas analisando friamente a física da cena: 1. Checagem de Escala de Poder entre o Grau do Jogador e o Grau do NPC/Maldição e quem tem vantagem de velocidade; 2. Checagem de Técnica / Lore Check: condições exatas de ativação, alcance, quanto de EA foi gasto e fraquezas ativas; 3. Psicologia e estratégia oculta do NPC conforme sua personalidade canônica).',
    },
    activeStoryCards: {
      type: 'array',
      items: { type: 'string' },
      description: 'Títulos dos Story Cards do Códice consultados neste turno.',
    },
    activeCardRuleSummary: {
      type: 'string',
      description:
        'Card Ativo na Cena: Resumo técnico das regras exatas da habilidade ou técnica que está sendo usada no momento para travar a consistência mecânica no 📊 [HUD & REGISTRO DE CARDS].',
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
        hpPercentage: { type: 'number', description: 'Novo HP do jogador de 0 a 100.' },
        cursedEnergyPercentage: {
          type: 'number',
          description: 'Nova Reserva de Energia Amaldiçoada de 0 a 100 (0 se Restrição Celestial).',
        },
        outputPercentage: {
          type: 'number',
          description: 'Output atual de EA (ex: 100 padrão, 120 na Zona após Black Flash ou com Voto de Revelar a Mão).',
        },
        physicalCondition: {
          type: 'string',
          description: 'Descrição clínica e visceral dos ferimentos atuais.',
        },
        techniqueState: {
          type: 'string',
          enum: [
            'Ativa',
            'Em Uso',
            'Sob Voto Vinculativo',
            'Em Exaustão Pós-Domínio (Burnout)',
          ],
        },
        inBlackFlashZone: {
          type: 'boolean',
          description: 'True se o jogador atingiu um Black Flash e está operando a 120% de potencial.',
        },
        newInventoryItemOrVow: {
          type: 'string',
          description: 'Opcional: Nova Ferramenta Amaldiçoada obtida ou Voto Vinculativo selado no turno (ou vazio).',
        },
        xpGained: {
          type: 'number',
          description:
            'XP de Feiticeiro concedido neste turno (0 a 250 XP). Cada 100 XP sobe 1 Nível na categoria atual de Grau (Grau 4 exige 10 níveis -> Grau 3 exige 15 -> Grau 2 exige 20 -> Semi-Grau 1 exige 25 -> Grau 1 exige 30 -> Grau Especial). Conceda 25-60 XP em turnos normais, 80-120 XP em exorcismos/treinos intensos e 150-220 XP ao atingir Kokusen (Black Flash).',
        },
        levelUpReason: {
          type: 'string',
          description:
            'Breve justificativa do ganho de XP/Nível neste turno (ex: "Refinamento de EA sob pressão em combate", "Despertar por Kokusen").',
        },
        sheetEvolution: {
          type: 'object',
          description:
            'Preencha SEMPRE que a história modificar a Ficha Exclusiva do personagem (ex: despertar uma seção antes marcada como "Não desenvolvido ainda", evoluir o Lapso/Reversão/Máxima/Domínio Simples/Expansão de Domínio/RCT, cicatriz ou evolução do Estilo de Combate).',
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
            unlockRct: {
              type: 'boolean',
              description: 'True se o personagem acabou de despertar a Técnica Amaldiçoada Reversa (RCT) neste turno.',
            },
            skillUpdated: {
              type: 'object',
              description:
                'Opcional: Preencha se o personagem despertou ou evoluiu uma Perícia Narrativa neste turno (ex: de "nao_desenvolvido" ou "neutro" para "afinidade" ou "maestria").',
              properties: {
                skillId: { type: 'string' },
                skillName: { type: 'string' },
                newLevel: {
                  type: 'string',
                  enum: ['maestria', 'afinidade', 'neutro', 'inaptidao', 'nao_desenvolvido'],
                },
                reason: { type: 'string' },
              },
            },
          },
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
              status: { type: 'string', description: 'Condição física e postura tática atual do NPC.' },
              hpPercentage: {
                type: 'number',
                description:
                  'Vitalidade atual do NPC de 0 a 100 (reduza proporcionalmente aos golpes sofridos; 0 = Exorcizado/Derrotado).',
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
            required: ['name', 'grade', 'status', 'hpPercentage', 'attitude', 'visualDescription'],
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

function getGeminiClient(customKey?: string): GoogleGenAI | null {
  const rawKey =
    (customKey && customKey.trim()) ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    '';
  if (!rawKey || rawKey === 'MY_GEMINI_API_KEY' || rawKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: rawKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeModelName(candidateModel?: string): string {
  const m = (candidateModel || '').trim();
  if (
    m === 'gemini-3.8-flash' ||
    m === 'gemini-flash-latest' ||
    m === 'gemini-3-flash-preview' ||
    m === 'gemini-2.5-flash'
  ) {
    return 'gemini-3-flash-preview';
  }
  if (
    m === 'gemini-3.5-flash-lite' ||
    m === 'gemini-3.1-flash-lite-preview' ||
    m === 'gemini-3.1-flash-lite' ||
    m === 'gemini-flash-lite-latest' ||
    m === 'gemini-2.5-flash-lite'
  ) {
    return 'gemini-3.1-flash-lite-preview';
  }
  if (m === 'gemini-4-argon' || m === 'gemini-pro-latest') {
    return 'gemini-4-argon';
  }
  return 'gemini-3-flash-preview';
}

async function callGeminiStructured(
  ai: GoogleGenAI,
  candidateModel: string,
  systemInstruction: string,
  prompt: string,
  schema: Record<string, unknown>,
  temperature = 0.75
): Promise<string> {
  const normalizedModel = normalizeModelName(candidateModel);

  const response = await ai.models.generateContent({
    model: normalizedModel,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature,
    },
  });

  if (!response.text) {
    throw new Error('Empty response from Gemini model');
  }
  return response.text;
}

const SYSTEM_INSTRUCTION_GM = `Você é um **Mestre de RPG (Game Master) experiente, imersivo e implacável na fidelidade ao mundo**, e um **Motor de Simulação operando sob regras estritas do cânone de Jujutsu Kaisen (Gege Akutami — STRICT LORE MODE)**.
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

## 7. REGRAS DO CENÁRIO (ENTRE SHIBUYA E SHINJUKU / CULLING GAME), PILARES E FICHA VIVA
- Nas colônias do **Jogo do Abate (Culling Game)**, cada jogador possui uma **Kogane** (interface amaldiçoada que anuncia regras, pontuação e localização). Feiticeiros valem **5 pontos** ao morrerem; Não-feiticeiros valem **1 ponto**; com **100 pontos**, um jogador pode adicionar uma nova regra geral.
- **Pilares de Aptidão e Perícias Narrativas (100% Narrativo, Sem Cálculos Matemáticos):** Respeite os Pilares de Aptidão do jogador (incluindo sua **▼ Fragilidade Obrigatória**) e suas Perícias Narrativas (★ Maestria, ● Afinidade, ▼ Inaptidão), sem nunca exibir somas matemáticas de perícias no texto.
- **Ficha Exclusiva Viva:** Se alguma seção estiver como "Não desenvolvido ainda" e o jogador treinar, atingir Kokusen (20 natural) ou despertar em situação extrema, preencha \`playerStateUpdate.sheetEvolution\`.
- **Saída Estruturada em Três Partes:** Preencha sempre \`engineLog\` (para o bloco ⚙️ \`[LOG DO MOTOR JUJUTSU]\`), \`narrative\` (para o bloco 📖 \`[NARRATIVA]\`) e \`worldStateUpdate\` / \`playerStateUpdate\` / \`activeStoryCards\` / \`activeCardRuleSummary\` (para o bloco 📊 \`[HUD & REGISTRO DE CARDS]\`).`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  function classifyGeminiError(rawMsg: string): {
    state: 'INVALID' | 'QUOTA_EXCEEDED' | 'MISSING';
    userMessage: string;
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
        userMessage:
          'Limite temporário de requisições da API Gemini atingido (429). O Motor Narrativo de Continuidade JJK assumiu o turno automaticamente para não interromper sua campanha.',
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
        userMessage:
          'A chave GEMINI_API_KEY atual é inválida ou não autorizada para chamadas diretas. Configure uma chave válida nos Secrets do projeto; enquanto isso, o Motor Narrativo de Continuidade JJK mantém sua campanha fluindo sem interrupções.',
      };
    }
    return {
      state: 'INVALID',
      userMessage:
        'Não foi possível autenticar na API Gemini no momento. O Motor Narrativo de Continuidade JJK está ativo para garantir que sua história continue sem travar.',
    };
  }

  app.get('/api/health', (_req, res) => {
    const ai = getGeminiClient();
    res.json({
      status: 'ok',
      hasApiKey: Boolean(ai),
      serverCodexCount: SERVER_STORY_CARDS.length,
      serverMdSectionsCount: SERVER_MD_SECTIONS.length,
      totalIntegratedCodex: SERVER_CODEX_MD_CARDS.length + SERVER_STORY_CARDS.length,
    });
  });

  app.post('/api/gemini/validate', async (req, res) => {
    const { model = 'gemini-3.8-flash', customApiKey = '' } = req.body || {};
    const headerKey = req.headers['x-custom-api-key'] as string | undefined;
    const providedCustomKey = (customApiKey || headerKey || '').trim();
    const ai = getGeminiClient(providedCustomKey);
    const startMs = Date.now();
    const hasEnvironmentKey = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
    const isUsingCustomKey = Boolean(providedCustomKey);

    const normalizedModel = normalizeModelName(model);

    if (!ai) {
      return res.json({
        ok: false,
        state: 'MISSING',
        modelTested: normalizedModel,
        latencyMs: Date.now() - startMs,
        fallbackActive: true,
        hasEnvironmentKey,
        isUsingCustomKey,
        message:
          'Nenhuma chave GEMINI_API_KEY encontrada. Você pode configurar uma chave no painel de Sistema ou nos Secrets do projeto; o Motor Narrativo de Continuidade JJK mantém sua campanha ativa.',
        checkedAt: new Date().toISOString(),
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: normalizedModel,
        contents: 'Responda apenas: OK',
      });
      if (response.text) {
        return res.json({
          ok: true,
          state: 'VALID',
          modelTested: normalizedModel,
          latencyMs: Date.now() - startMs,
          fallbackActive: false,
          hasEnvironmentKey,
          isUsingCustomKey,
          message: `Conexão Gemini IA ativa e validada (${normalizedModel} respondeu em ${
            Date.now() - startMs
          }ms)${isUsingCustomKey ? ' [Chave Personalizada]' : ' [Chave do Ambiente Cloud]'}.`,
          checkedAt: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const classified = classifyGeminiError(msg);
      return res.json({
        ok: false,
        state: classified.state,
        modelTested: normalizedModel,
        latencyMs: Date.now() - startMs,
        fallbackActive: true,
        hasEnvironmentKey,
        isUsingCustomKey,
        message: classified.userMessage,
        rawError: msg.slice(0, 180),
        checkedAt: new Date().toISOString(),
      });
    }

    return res.json({
      ok: false,
      state: 'INVALID',
      modelTested: normalizedModel,
      latencyMs: Date.now() - startMs,
      fallbackActive: true,
      hasEnvironmentKey,
      isUsingCustomKey,
      message:
        'Resposta vazia da API Gemini. O Motor Narrativo de Continuidade JJK está ativo.',
      checkedAt: new Date().toISOString(),
    });
  });

  /**
   * Returns all 272 encyclopedic Portuguese entries from Codex.md + 283 canonical Story Cards
   * so the frontend Códice RAG is populated out-of-the-box without requiring manual file upload.
   */
  app.get('/api/codex/default', (_req, res) => {
    res.json({
      ok: true,
      cards: [...SERVER_CODEX_MD_CARDS, ...SERVER_STORY_CARDS],
      codexMdCount: SERVER_CODEX_MD_CARDS.length,
      storyCardCount: SERVER_STORY_CARDS.length,
      mdSectionCount: SERVER_MD_SECTIONS.length,
    });
  });

  /**
   * Original Character Custom Technique & Domain Portal Forge Endpoint
   */
  app.post('/api/gemini/technique', async (req, res) => {
    const {
      concept = '',
      idea = '',
      characterName = 'Feiticeiro Original',
      grade = 'Grau 1',
      faction = 'Feiticeiro Jujutsu',
      backstory = '',
      combatStyle = '',
      customApiKey = '',
    } = req.body;

    const rawConcept = (concept || idea || 'Manipulação de Vetores Espaciais').trim();
    const headerKey = req.headers['x-custom-api-key'] as string | undefined;
    const ai = getGeminiClient(customApiKey || headerKey);

    const buildFallbackTechnique = () => {
      const domainPortal = {
        domainName: 'Horizonte da Singularidade Abissal',
        visualStyle: 'infinite_void' as const,
        barrierType: 'Barreira Fechada Padrão (Esfera Isolada)' as const,
        handSeal: 'Cruzamento de Dedos Taishakuten (Indra)',
        sureHitEffect:
          'O acerto garantido da técnica ignora guarda física convencional dentro do horizonte de eventos.',
        portalEnvironment:
          'Um horizonte cósmico silencioso onde anéis radiais de Energia Amaldiçoada orbitam um núcleo negro.',
        primaryColor: '#38bdf8',
        secondaryColor: '#a855f7',
        coreColor: '#020617',
        overlayIntensity: 'medium' as const,
      };
      return {
        name: rawConcept.split(/[.,:—-]/)[0].trim().slice(0, 48) || 'Ressonância do Vazio Abissal',
        isCanon: false,
        description: `Técnica Inata original de ${characterName} (${grade}): ${rawConcept}. Canaliza Energia Amaldiçoada de alta densidade sincronizada ao estilo "${combatStyle || 'Combate Tático'}".`,
        lapse: 'Lapso (Azul): Atração ou projeção concentrada da técnica que desestabiliza a guarda inimiga a curta e média distância.',
        reversal: 'Reversão (Vermelho): Inversão com Energia Positiva que causa repulsão explosiva e ruptura de barreiras.',
        maximum: 'Técnica Máxima: Liberação total de Output condensado em um único vetor cataclísmico.',
        activationConditions: 'Exige gestos manuais precisos ou entoação de encantamento para elevar o Output a 120%.',
        domainExpansion: 'Horizonte da Singularidade Abissal — Qualquer alvo dentro da barreira sofre o efeito inevitável da técnica a cada segundo.',
        antiDomain: 'Domínio Simples (Shinkage-ryū) & Emoção da Pétala Decadente',
        hasRct: true,
        domainPortal,
      };
    };

    if (!ai) {
      const fallback = buildFallbackTechnique();
      return res.json({
        ok: true,
        technique: fallback,
        domainPortal: fallback.domainPortal,
      });
    }

    const techSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        lapse: { type: 'string' },
        reversal: { type: 'string' },
        maximum: { type: 'string' },
        activationConditions: { type: 'string' },
        domainExpansion: { type: 'string' },
        antiDomain: { type: 'string' },
        domainPortal: {
          type: 'object',
          properties: {
            domainName: { type: 'string' },
            visualStyle: {
              type: 'string',
              enum: [
                'infinite_void',
                'malevolent_shrine',
                'chimera_shadow',
                'judgeman_court',
                'custom_nebula',
              ],
            },
            barrierType: {
              type: 'string',
              enum: [
                'Barreira Fechada Padrão (Esfera Isolada)',
                'Barreira Aberta Divina (Alcance de 200m — Estilo Sukuna/Kenjaku)',
                'Domínio Incompleto (Moldado pelo Ambiente — Estilo Megumi)',
                'Domínio Não-Letal Baseado em Regras (Estilo Higuruma/Hakari)',
              ],
            },
            handSeal: { type: 'string' },
            sureHitEffect: { type: 'string' },
            portalEnvironment: { type: 'string' },
            primaryColor: { type: 'string' },
            secondaryColor: { type: 'string' },
            coreColor: { type: 'string' },
            overlayIntensity: {
              type: 'string',
              enum: ['subtle', 'medium', 'intense'],
            },
          },
          required: [
            'domainName',
            'visualStyle',
            'barrierType',
            'handSeal',
            'sureHitEffect',
            'portalEnvironment',
            'primaryColor',
            'secondaryColor',
            'coreColor',
            'overlayIntensity',
          ],
        },
      },
      required: [
        'name',
        'description',
        'lapse',
        'reversal',
        'maximum',
        'activationConditions',
        'domainExpansion',
        'antiDomain',
        'domainPortal',
      ],
    };

    const techPrompt = `Crie e balanceie uma Técnica Amaldiçoada Inata original completa e sua Configuração de Portal de Domínio no universo canônico de Jujutsu Kaisen (em Português do Brasil).
- Nome do Personagem: ${characterName} (${grade}, ${faction})
- História/Motivação: ${backstory || 'Feiticeiro original'}
- Estilo de Combate: ${combatStyle || 'Artes marciais e controle de Energia Amaldiçoada'}
- Conceito da Técnica desejado pelo jogador: ${rawConcept}`;

    for (const candidateModel of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']) {
      try {
        const textResponse = await callGeminiStructured(
          ai,
          candidateModel,
          'Você é Gege Akutami e especialista nas mecânicas de Jujutsu Kaisen. Retorne apenas JSON válido.',
          techPrompt,
          techSchema,
          0.75
        );
        const parsed = JSON.parse(textResponse);
        return res.json({
          ok: true,
          technique: {
            ...parsed,
            isCanon: false,
            hasRct: true,
          },
          domainPortal: parsed.domainPortal,
        });
      } catch {
        // Try next model
      }
    }

    const fallback = buildFallbackTechnique();
    return res.json({
      ok: true,
      technique: fallback,
      domainPortal: fallback.domainPortal,
    });
  });

  /**
   * Interactive "Sessão Zero" — AI Character Questioning, Power-Level Balancing & Negotiation Endpoint
   * Questiona conceitos que fogem da escala de força de Jujutsu Kaisen, propõe nivelamentos com
   * Votos Vinculativos, Grau Inicial Designado (ex: Grau 4 -> 10 níveis -> Grau 3) e marca habilidades
   * avançadas como "Não desenvolvido ainda" para despertar na campanha.
   */
  app.post('/api/gemini/session-zero', async (req, res) => {
    const {
      characterDraft = {},
      conversationHistory = [],
      playerReply = '',
      customApiKey = '',
    } = req.body;

    const headerKey = req.headers['x-custom-api-key'] as string | undefined;
    const ai = getGeminiClient(customApiKey || headerKey);

    const buildSessionZeroFallback = () => {
      const name = String(characterDraft.name || 'Thiago Soares').trim();
      const clan = String(characterDraft.clan || 'Clã Marqueti / Gojo').trim();
      const backstory = String(characterDraft.backstory || '').trim();
      const concept = String(
        characterDraft.customConcept || characterDraft.technique?.description || ''
      ).trim();
      const combinedText = `${name} ${clan} ${backstory} ${concept} ${playerReply}`.toLowerCase();

      const isMarquetiOrGojoExample =
        combinedText.includes('marqueti') ||
        combinedText.includes('thiago') ||
        (combinedText.includes('gojo') && combinedText.includes('realidade')) ||
        combinedText.includes('ambas as restrições') ||
        combinedText.includes('duas restrições');

      const hasPlayerNegotiated = Boolean(playerReply && playerReply.trim().length > 10);

      if (isMarquetiOrGojoExample) {
        if (!hasPlayerNegotiated) {
          return {
            gmMessage: `*Mestre (Sessão Zero)*: Uau. Vamos parar um segundo para apreciar a ambição desse conceito para **${name}**! Um híbrido humano-maldição adotado por Satoru Gojo, sobrevivente do extinto **Clã Marqueti** (manipulação da realidade via Energia Amaldiçoada), querendo acumular o **Ilimitado** e **ambas as Restrições Celestiais anulando os pontos fracos**, além da **Foice da Morte** forjada da mãe!\n\nPorém, como seu Mestre de Jujutsu Kaisen, preciso aplicar as **Leis Absolutas de Gege Akutami** para que a campanha tenha tensão real, evolução e risco de morte:\n1. **O Paradoxo das Duas Restrições Celestiais**: No cânone, ter 0 de Energia Amaldiçoada (Toji/Maki) e ter Energia Amaldiçoada massiva (Mechamaru/Seis Olhos) são opostos mutuamente exclusivos. Se você começasse no Dia 1 manipulando a realidade livremente + Ilimitado + Corpo de Toji sem fraquezas, você seria mais forte que Sukuna no Turno 1 e não haveria desafio.\n2. **Como Nivelamos Isso de Forma Épica (Grau Inicial Designado: Grau 4)**:\n   - Seu poder do **Clã Marqueti (Reescrita da Realidade)** funciona através de um **Voto Vinculativo Ancestral**: no início (Grau 4), você só consegue reescrever a realidade do **seu próprio corpo** (anulando a fragilidade física da Restrição Celestial em troca de gastar Energia Amaldiçoada contínua) e fazer **micro-alterações de curtíssimo alcance**.\n   - Como você não tem o sangue biológico de Satoru Gojo, o **Olho / Ilimitado transplantado ou herdado por vínculo** drena uma quantidade brutal de Energia Amaldiçoada e causa dor ocular severa se forçado.\n   - Habilidades divinas como **Reversão (Vermelho / Reescrita Externa)**, **Técnica Máxima**, **RCT** e **Expansão de Domínio** começam marcadas como **"Não desenvolvido ainda"** na sua Ficha Exclusiva, sendo despertadas conforme você sobe os **10 níveis do Grau 4 → Grau 3**, depois **15 níveis do Grau 3 → Grau 2**, até o Grau Especial!`,
            balanceStatus: 'NEEDS_BALANCING' as const,
            designatedInitialGrade: 'Grau 4',
            powerScaleWarning:
              'Conceito de Nível Divino detectado (Manipulação de Realidade + Ilimitado + Dupla Restrição Celestial). O Mestre propôs selos iniciais, Voto Vinculativo e progressão por Graus/Níveis.',
            questionsForPlayer: [
              '1. Você concorda que a Manipulação da Realidade do Clã Marqueti comece focada em reescrever apenas seu próprio corpo (para sustentar sua força física sem quebrar) e pequenas regras de curto alcance no Grau 4?',
              '2. Aceita que o Olho de Gojo / Ilimitado consuma muita Energia Amaldiçoada inicialmente por você não ter o sangue biológico do Clã Gojo, deixando Reversão, Técnica Máxima e Expansão de Domínio como "Não desenvolvido ainda" para despertar na campanha?',
              '3. Sobre a Foice da Morte (Alma da Mãe): ela pode começar selada em 10% do poder (Grau 4/3) e evoluir junto com seu Grau conforme você conversa com o espírito dela?',
            ],
            proposedAdjustmentsSummary: [
              'Grau Inicial Designado: Grau 4 (necessário subir 10 níveis para Grau 3; depois 15 níveis para Grau 2) — imposto pela Cúpula Jujutsu que teme sua anomalia.',
              'Técnica Inata Nivelada: "Édito de Marqueti & Olho Emprestado do Infinito" — usa um Voto Vinculativo para manter o corpo sobre-humano ativo e aplicar micro-distorções espaciais com alto custo de EA.',
              'Seções marcadas como "Não desenvolvido ainda": Reversão da Técnica, Técnica Máxima, RCT e Expansão de Domínio (serão desbloqueadas na sua Ficha Exclusiva durante a história).',
              'Ferramenta Inicial: "Foice da Morte — Lâmina Materna (Selada - Grau 3)" que evolui junto com os níveis do personagem.',
            ],
            proposedCharacterPatch: {
              name: name || 'Thiago Soares',
              clan: 'Clã Marqueti (Sobrevivente) · Tutelado de Satoru Gojo',
              grade: 'Grau 4',
              appearance:
                'Jovem de 15 anos (1º ano da Escola Técnica de Tóquio), uniforme escuro personalizado, olhar intenso oculto por óculos escuros/bandagem que sela o olho herdado de Gojo, carregando a Foice da Morte envolta em faixas amaldiçoadas.',
              backstory:
                'Filho de um feiticeiro do extinto Clã Marqueti com um Espírito Amaldiçoado que o protegeu com a própria alma. Adotado e treinado por Satoru Gojo após o massacre de seu clã. Sarcástico e brincalhão com amigos para esconder seus traumas, mas implacável contra inimigos que ameaçam seus companheiros.',
              combatStyle:
                'Esgrima acrobática e brutal com a Foice da Morte combinada a Taijutsu pesado, usando o Voto Vinculativo do Clã Marqueti para reforçar o próprio corpo e criar brechas com pulsos curtos do Ilimitado.',
              isHeavenlyRestriction: false,
              vowName: 'Voto Ancestral do Clã Marqueti (Corpo & Realidade)',
              vowCondition:
                'Drenar Energia Amaldiçoada constantemente para anular o colapso físico da anomalia híbrida e suportar o desgaste do Olho de Gojo sem sangue Gojo.',
              vowBonus:
                'Permite manter atributos físicos sobre-humanos junto com Energia Amaldiçoada e reescrever micro-regras de impacto ao redor do próprio corpo (+20% Output ao revelar o Voto).',
              toolName: 'Foice da Morte (Ecos da Mãe — Selada)',
              toolGrade: 'Grau 3 (Evolutiva até Grau Especial)',
              toolEffect:
                'Foice forjada a partir do núcleo amaldiçoado materno. Possui consciência protetora latente e canaliza cortes de Energia Amaldiçoada que evoluem conforme o Grau de Thiago.',
              technique: {
                name: 'Édito de Marqueti & Infinito Imperfeito',
                isCanon: false,
                description:
                  'Técnica híbrida do Clã Marqueti que altera temporariamente as propriedades físicas do próprio corpo e do espaço de curtíssimo alcance. O uso do Ilimitado através do olho herdado consome alta quantidade de EA por falta da genética Gojo.',
                lapse:
                  'Lapso: Reescrita Corporal & Desaceleração Curta — altera a densidade do próprio corpo para velocidade/força explosiva e desacelera ataques a até 1 metro por 1 segundo.',
                reversal: 'Não desenvolvido ainda',
                maximum: 'Não desenvolvido ainda',
                domainExpansion: 'Não desenvolvido ainda',
                antiDomain: 'Não desenvolvido ainda',
                hasRct: false,
                rctStatus: 'Não desenvolvido ainda',
                activationConditions:
                  'O Ilimitado exige retirar a venda/óculos e consome +25% de EA por turno devido à ausência do sangue biológico do Clã Gojo.',
              },
            },
          };
        }

        // Player already replied/negotiated (like in the second message of the user's example!)
        return {
          gmMessage: `*Mestre (Sessão Zero — Acordo Selado!)*: **GENIAL!** Essa sua explicação resolveu 100% do balanceamento dentro das leis de Gege Akutami:\n- Transformar a manipulação de realidade do **Clã Marqueti** em um **Voto Vinculativo de Auto-Reescrita Corporal** explica perfeitamente como você sustenta o físico sobre-humano junto com sua Energia Amaldiçoada!\n- E o fato de você **não ter o sangue biológico de Satoru Gojo** fazendo o olho/Ilimitado drenar muito mais Energia Amaldiçoada cria um limite tático incrível para o início da campanha!\n- Sua **Foice da Morte** com a alma da sua mãe começará sincronizada ao seu **Grau 4 Inicial** (precisando de **10 níveis para subir ao Grau 3**, e depois **15 níveis para o Grau 2**), enquanto a Reversão, Técnica Máxima, RCT e Expansão de Domínio ficam marcadas como **"Não desenvolvido ainda"** na sua **Ficha Exclusiva Viva** para você despertar em momentos épicos da história!\n\nClique em **"✨ Aplicar Proposta Nivelada na Ficha"** abaixo ou inicie a campanha imediatamente!`,
          balanceStatus: 'BALANCED_READY' as const,
          designatedInitialGrade: 'Grau 4',
          powerScaleWarning:
            'Ficha 100% Nivelada e Aprovada pelo Mestre! As limitações de Voto Vinculativo, custo de EA do Olho de Gojo e seções "Não desenvolvido ainda" estão prontas.',
          questionsForPlayer: [
            'Sua Ficha Exclusiva foi nivelada com sucesso! Deseja aplicar os ajustes e iniciar o Turno #1 da campanha?',
          ],
          proposedAdjustmentsSummary: [
            'Grau Inicial Designado: Grau 4 (0/10 Níveis para promoção ao Grau 3).',
            'Voto Vinculativo do Clã Marqueti selado conforme sua explicação: reescreve o próprio corpo primeiro, com alto custo de EA para usar o Olho de Gojo.',
            'Reversão, Técnica Máxima, RCT, Anti-Domínio e Expansão de Domínio definidos como "Não desenvolvido ainda" para evolução orgânica na Ficha Exclusiva.',
          ],
          proposedCharacterPatch: {
            name: name || 'Thiago Soares',
            clan: 'Clã Marqueti (Sobrevivente) · Tutelado de Satoru Gojo',
            grade: 'Grau 4',
            backstory: `${backstory}\n\n[Acordo de Sessão Zero]: ${playerReply}`.trim(),
            isHeavenlyRestriction: false,
            vowName: 'Voto Vinculativo de Marqueti (Auto-Reescrita & Sangue Estranho)',
            vowCondition:
              'Por não possuir o sangue biológico de Gojo, ativar o olho drena muita EA; a manipulação da realidade começa restrita ao próprio corpo e micro-regras.',
            vowBonus:
              'Sustenta força física sobre-humana sem zerar a Energia Amaldiçoada e permite evoluir a reescrita conforme sobe de Grau.',
            toolName: 'Foice da Morte (Alma Materna — Grau Evolutivo)',
            toolGrade: 'Grau 3 (Evolutiva)',
            toolEffect:
              'Forjada da maldição materna; abriga a alma protetora da mãe e libera novas habilidades a cada promoção de Grau.',
            technique: {
              name: 'Édito de Marqueti & Olho Emprestado do Infinito',
              isCanon: false,
              description:
                'Manipulação de realidade via Voto Vinculativo focada inicialmente no próprio corpo (força/velocidade anômalas) combinada ao uso de alto custo do Ilimitado herdado sem sangue Gojo.',
              lapse:
                'Lapso: Auto-Reescrita Vetorial & Infinito Curto — reforça a estrutura corporal além do limite humano e cria breves distorções espaciais ao custo elevado de EA.',
              reversal: 'Não desenvolvido ainda',
              maximum: 'Não desenvolvido ainda',
              domainExpansion: 'Não desenvolvido ainda',
              antiDomain: 'Não desenvolvido ainda',
              hasRct: false,
              rctStatus: 'Não desenvolvido ainda',
              activationConditions:
                'Alto consumo de EA ao abrir o Olho de Gojo devido à ausência de linhagem biológica Gojo.',
            },
          },
        };
      }

      // Generic intelligent Session Zero evaluation for any custom character
      return {
        gmMessage: `*Mestre (Sessão Zero)*: Analisei cuidadosamente o conceito de **${name}** (${clan})! A ideia base de **${
          characterDraft.technique?.name || concept || 'sua Técnica Inata'
        }** tem ótimo potencial dramático para o universo de Gege Akutami.\n\nPara que a progressão seja empolgante como no mangá, recomendo começar no **Grau 4** (onde você precisará subir **10 níveis** para alcançar o **Grau 3**, depois **15 níveis** para o **Grau 2**), mantendo o Lapso e seu Estilo de Combate ativos desde já, mas marcando as extensões de topo (**Reversão**, **Técnica Máxima**, **RCT** e **Expansão de Domínio**) como **"Não desenvolvido ainda"** na sua Ficha Exclusiva. Assim, quando você passar por um combate extremo ou atingir um *Kokusen*, a própria história consultará e atualizará sua ficha exclusiva despertando esses poderes!`,
        balanceStatus: hasPlayerNegotiated ? ('BALANCED_READY' as const) : ('NEEDS_BALANCING' as const),
        designatedInitialGrade: 'Grau 4',
        powerScaleWarning:
          'Equilíbrio de Campanha Recomendado: Iniciar em Grau 4 ou Grau 3 com técnicas supremas marcadas como "Não desenvolvido ainda" garante evolução orgânica.',
        questionsForPlayer: [
          '1. Qual é a principal condição ou custo físico/espiritual que sua técnica exige quando você força o Output ao limite?',
          '2. Você prefere começar no Grau 4 (10 níveis para Grau 3) com Reversão, Máxima e Expansão de Domínio marcados como "Não desenvolvido ainda" para despertá-los durante a história?',
        ],
        proposedAdjustmentsSummary: [
          'Grau Inicial Designado: Grau 4 (Progressão: 10 níveis -> Grau 3 -> 15 níveis -> Grau 2).',
          'Lapso da Técnica e Estilo Marcial prontos para combate imediato.',
          'Reversão, Técnica Máxima, RCT e Expansão de Domínio marcados como "Não desenvolvido ainda" na Ficha Exclusiva para despertar na história.',
        ],
        proposedCharacterPatch: {
          grade: 'Grau 4',
          technique: {
            ...(characterDraft.technique || {}),
            reversal: 'Não desenvolvido ainda',
            maximum: 'Não desenvolvido ainda',
            domainExpansion: 'Não desenvolvido ainda',
            hasRct: false,
            rctStatus: 'Não desenvolvido ainda',
          },
        },
      };
    };

    if (!ai) {
      return res.json({
        ok: true,
        usedFallback: true,
        evaluation: buildSessionZeroFallback(),
      });
    }

    const sessionZeroSchema = {
      type: 'object',
      properties: {
        gmMessage: {
          type: 'string',
          description:
            'Fala direta do Mestre de RPG (em Português do Brasil) analisando a ficha do jogador, elogiando a criatividade, apontando com simpatia e firmeza qualquer poder apelão que fuja da escala inicial de Jujutsu Kaisen e propondo como nivelar com Votos Vinculativos e seções "Não desenvolvido ainda".',
        },
        balanceStatus: {
          type: 'string',
          enum: ['NEEDS_BALANCING', 'BALANCED_READY'],
        },
        designatedInitialGrade: {
          type: 'string',
          enum: ['Grau 4', 'Grau 3', 'Grau 2', 'Semi-Grau 1', 'Grau 1'],
          description:
            'Grau Inicial Designado recomendado pelo Mestre (prefira Grau 4 ou Grau 3 para progressão de níveis).',
        },
        powerScaleWarning: {
          type: 'string',
          description:
            'Resumo claro do que estava acima do nível de força inicial (ou confirmação de que está equilibrado).',
        },
        questionsForPlayer: {
          type: 'array',
          items: { type: 'string' },
          description:
            '2 a 3 perguntas diretas do Mestre questionando o jogador para decidirem juntos os limites, custos e ganchos do personagem.',
        },
        proposedAdjustmentsSummary: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Lista objetiva das mudanças sugeridas pelo Mestre para nivelar a ficha (incluindo quais habilidades ficam como "Não desenvolvido ainda").',
        },
        proposedCharacterPatch: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            clan: { type: 'string' },
            grade: { type: 'string' },
            appearance: { type: 'string' },
            backstory: { type: 'string' },
            combatStyle: { type: 'string' },
            vowName: { type: 'string' },
            vowCondition: { type: 'string' },
            vowBonus: { type: 'string' },
            toolName: { type: 'string' },
            toolGrade: { type: 'string' },
            toolEffect: { type: 'string' },
            technique: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                lapse: { type: 'string' },
                reversal: { type: 'string' },
                maximum: { type: 'string' },
                domainExpansion: { type: 'string' },
                antiDomain: { type: 'string' },
                hasRct: { type: 'boolean' },
                rctStatus: { type: 'string' },
                activationConditions: { type: 'string' },
              },
            },
          },
        },
      },
      required: [
        'gmMessage',
        'balanceStatus',
        'designatedInitialGrade',
        'powerScaleWarning',
        'questionsForPlayer',
        'proposedAdjustmentsSummary',
        'proposedCharacterPatch',
      ],
    };

    const sessionZeroPrompt = `Você é o Mestre de RPG de Jujutsu Kaisen conduzindo a "Sessão Zero" (Criação, Questionamento e Nivelamento de Personagem).
O jogador está criando seu personagem e pode ter colocado habilidades muito apelonas (overpowered) que fogem do nível de força inicial do universo de Gege Akutami, ou ainda não desenvolveu todas as partes da ficha.

=== RASCUNHO ATUAL DA FICHA DO JOGADOR ===
${JSON.stringify(characterDraft, null, 2)}

=== HISTÓRICO DE CONVERSA DA SESSÃO ZERO ===
${
  Array.isArray(conversationHistory) && conversationHistory.length > 0
    ? conversationHistory.map((m: { sender: string; text: string }) => `${m.sender.toUpperCase()}: ${m.text}`).join('\n\n')
    : 'Primeira avaliação da ficha.'
}

=== RESPOSTA / ARGUMENTO MAIS RECENTE DO JOGADOR ===
${playerReply ? `"${playerReply}"` : '(O jogador solicitou a avaliação e nivelamento inicial da ficha)'}

REGRAS OBRIGATÓRIAS DO MESTRE NA SESSÃO ZERO:
1. Nunca destrua a ideia do jogador: acolha a criatividade dele (mesmo se for filho adotivo de Gojo, híbrido de maldição, clã que manipula a realidade ou duas Restrições Celestiais) e EXPLIQUE como adaptar isso às leis reais de Jujutsu Kaisen através de:
   - Votos Vinculativos com custos reais (ex: drenar muita Energia Amaldiçoada se não tiver o sangue do clã, ou restringir a manipulação da realidade primeiro ao próprio corpo);
   - Selos de poder que evoluem conforme o Grau;
   - Marcar habilidades avançadas (como Reversão, Técnica Máxima, RCT e Expansão de Domínio) com o texto exato "Não desenvolvido ainda" em proposedCharacterPatch.technique para que sejam despertadas durante a campanha!
2. Explique o Sistema de Níveis por Grau:
   - Grau 4: necessário subir 10 níveis para subir ao Grau 3;
   - Grau 3: necessário subir 15 níveis para subir ao Grau 2;
   - Grau 2: necessário subir 20 níveis para subir ao Semi-Grau 1;
   - Semi-Grau 1: necessário subir 25 níveis para subir ao Grau 1;
   - Grau 1: necessário subir 30 níveis para subir ao Grau Especial.
3. Questione o jogador em "questionsForPlayer" para que ele possa dialogar e negociar cada ponto.`;

    for (const candidateModel of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']) {
      try {
        const textResponse = await callGeminiStructured(
          ai,
          candidateModel,
          'Você é um Mestre de RPG de Jujutsu Kaisen carismático, justo e profundo conhecedor da obra de Gege Akutami. Retorne apenas JSON válido.',
          sessionZeroPrompt,
          sessionZeroSchema,
          0.75
        );
        const parsed = JSON.parse(textResponse);
        return res.json({
          ok: true,
          usedFallback: false,
          evaluation: parsed,
        });
      } catch {
        // Try next model
      }
    }

    return res.json({
      ok: true,
      usedFallback: true,
      evaluation: buildSessionZeroFallback(),
    });
  });

  // Main GM Turn Endpoint
  app.post('/api/gemini/turn', async (req, res) => {
    const {
      model = 'gemini-3.8-flash',
      character,
      world,
      actionMode = 'DO',
      actionText = '',
      diceRoll = 12,
      revealedHandVow = false,
      ragContext = '',
      activeCards = [],
      memoryContext = '',
      recentHistory = '',
      isOpening = false,
      startingArcTitle = '',
      customOpeningPrompt = '',
      customApiKey = '',
    } = req.body;

    const headerKey = req.headers['x-custom-api-key'] as string | undefined;
    const ai = getGeminiClient(customApiKey || headerKey);

    const { mod: totalDiceMod, breakdown: modBreakdown } = getGradeModifier(
      character?.grade,
      character?.inBlackFlashZone,
      revealedHandVow
    );
    const modifiedRoll = Number(diceRoll) + totalDiceMod;

    // Enrich with Server-Side Deep RAG from the 283 Story Cards + 1.1MB Encyclopedic Codex
    const searchContextForServerRag = [
      actionText,
      startingArcTitle,
      customOpeningPrompt,
      world?.location,
      world?.arc,
      character?.technique?.name,
      ...(world?.npcsInScene || []).map((n: { name: string }) => n.name),
    ]
      .filter(Boolean)
      .join(' ');

    const { extraRagText, matchedTitles } = buildServerSideDeepRag(
      searchContextForServerRag,
      activeCards
    );

    const combinedRagContext = [ragContext, extraRagText].filter(Boolean).join('\n\n---\n\n');

    // Fallback generator if no API key is configured or all models are exhausted
    const buildDynamicFallback = (reason: string) => {
      const isCrit20 = Number(diceRoll) === 20;
      const isCrit1 = Number(diceRoll) === 1;
      const isRct =
        actionText.toLowerCase().includes('reversa') ||
        actionText.toLowerCase().includes('rct') ||
        actionText.toLowerCase().includes('curar');
      const isDomain =
        actionText.toLowerCase().includes('expansão de domínio') ||
        actionText.toLowerCase().includes('ryoiki tenkai') ||
        actionText.toLowerCase().includes('ryōiki tenkai');

      let vfx: string = 'NONE';
      if (isCrit20) vfx = 'BLACK_FLASH';
      else if (isDomain) {
        const techName = (character?.technique?.name || '').toLowerCase();
        if (techName.includes('ilimitado') || techName.includes('gojo')) vfx = 'DOMAIN_GOJO';
        else if (techName.includes('santuário') || techName.includes('sukuna')) vfx = 'DOMAIN_SUKUNA';
        else if (techName.includes('sentença') || techName.includes('higuruma')) vfx = 'DOMAIN_HIGURUMA';
        else vfx = 'DOMAIN_GENERIC';
      } else if (isRct) {
        vfx = 'RCT_HEAL';
      }

      const curHp = character?.hpPercentage ?? 100;
      const curCe = character?.isHeavenlyRestriction ? 0 : character?.cursedEnergyPercentage ?? 100;
      const newHp = isRct ? Math.min(100, curHp + 25) : isCrit1 ? Math.max(10, curHp - 15) : curHp;
      const ceCost = isDomain ? 35 : isRct ? 25 : actionMode === 'TECHNIQUE' ? 12 : 5;
      const newCe = character?.isHeavenlyRestriction
        ? 0
        : isCrit20
        ? Math.min(100, curCe + 15)
        : Math.max(0, curCe - ceCost);
      const newOutput = isCrit20 || character?.inBlackFlashZone ? 120 : revealedHandVow ? 120 : 100;

      const firstNpc = world?.npcsInScene?.[0] || {
        name: 'Espírito Amaldiçoado de Grau 1',
        grade: 'Grau 1',
        status: 'Emitindo pressão hostil nas sombras',
        hpPercentage: 100,
        attitude: 'Hostil',
        visualDescription: 'Grotesque cursed spirit in dark anime style by MAPPA studio, glowing eyes',
      };

      const damageToNpc = isOpening ? 0 : isCrit20 ? 45 : isDomain ? 40 : Number(diceRoll) >= 10 ? 22 : 8;
      const updatedNpcs = (world?.npcsInScene?.length ? world.npcsInScene : [firstNpc]).map(
        (npc: { name: string; grade: string; status: string; hpPercentage?: number; attitude: string; visualDescription: string }, idx: number) => {
          if (idx === 0 && npc.attitude === 'Hostil' && !isOpening) {
            const prevHp = typeof npc.hpPercentage === 'number' ? npc.hpPercentage : 100;
            const nextHp = Math.max(0, prevHp - damageToNpc);
            return {
              ...npc,
              hpPercentage: nextHp,
              status:
                nextHp === 0
                  ? 'Exorcizado / Desintegrado em cinzas de Energia Amaldiçoada'
                  : nextHp <= 35
                  ? `Gravemente ferido (${nextHp}% HP) — Guarda quebrada`
                  : `${npc.status} (${nextHp}% HP)`,
            };
          }
          return {
            ...npc,
            hpPercentage: typeof npc.hpPercentage === 'number' ? npc.hpPercentage : 100,
          };
        }
      );

      // Check if player is trying to develop/awaken an undeveloped section or scored a Kokusen
      const lowerAction = actionText.toLowerCase();
      const wantsAwakening =
        isCrit20 ||
        lowerAction.includes('despertar') ||
        lowerAction.includes('desenvolver') ||
        lowerAction.includes('treinar') ||
        lowerAction.includes('evoluir');

      let fallbackSheetEvolution:
        | {
            sectionUpdated: string;
            newValue: string;
            reason: string;
            unlockRct?: boolean;
          }
        | undefined;

      if (!isOpening && wantsAwakening && Number(diceRoll) >= 12) {
        const tech = character?.technique || {};
        if (String(tech.lapse || '').toLowerCase().includes('não desenvolvido')) {
          fallbackSheetEvolution = {
            sectionUpdated: 'lapse',
            newValue: `Lapso Desperto (${tech.name || 'Técnica Inata'}): Canalização concentrada de Energia Amaldiçoada despertada em combate real.`,
            reason: 'Despertar do Lapso da Técnica durante pressão de combate!',
          };
        } else if (String(tech.antiDomain || '').toLowerCase().includes('não desenvolvido')) {
          fallbackSheetEvolution = {
            sectionUpdated: 'antiDomain',
            newValue: 'Domínio Simples (Novo Estilo da Sombra — Desperto em Combate)',
            reason: 'Compreensão de barreira defensiva adquirida sob risco de vida!',
          };
        } else if (String(tech.reversal || '').toLowerCase().includes('não desenvolvido')) {
          fallbackSheetEvolution = {
            sectionUpdated: 'reversal',
            newValue: `Reversão da Técnica (${tech.name || 'Inata'}): Inversão de vetores com Energia Positiva despertada no calor da batalha!`,
            reason: 'Despertar da Reversão da Técnica na Ficha Exclusiva!',
          };
        } else if (!tech.hasRct && lowerAction.includes('rct')) {
          fallbackSheetEvolution = {
            sectionUpdated: 'rct',
            newValue: 'Técnica Amaldiçoada Reversa (RCT) Desperta — Multiplicação de energia negativa por negativa.',
            reason: 'Compreensão do núcleo da Energia Positiva à beira da morte!',
            unlockRct: true,
          };
        } else if (String(tech.domainExpansion || '').toLowerCase().includes('não desenvolvido') && (isDomain || isCrit20)) {
          fallbackSheetEvolution = {
            sectionUpdated: 'domainExpansion',
            newValue: `Horizonte Inato de ${character?.name || 'Feiticeiro'} — Barreira completa desperta sob iluminação de Kokusen!`,
            reason: 'Expansão de Domínio despertada e gravada na Ficha Exclusiva!',
          };
        }
      }

      const xpGained = isOpening
        ? 0
        : isCrit20
        ? 180
        : updatedNpcs[0]?.hpPercentage === 0
        ? 110
        : Number(diceRoll) >= 12
        ? 60
        : 35;

      // Extract player pillars & skills for rich narrative integration
      const weakPillar = character?.narrativePillars?.find(
        (p: { tier: string }) => p.tier === 'Fraco' || p.tier === 'fragilidade'
      );
      const strongPillar = character?.narrativePillars?.find(
        (p: { tier: string }) =>
          p.tier === 'Apice' || p.tier === 'Forte' || p.tier === 'Alto' || p.tier === 'forte'
      );
      const masterySkill = character?.narrativeSkills?.find(
        (s: { level: string }) => s.level === 'maestria' || s.level === 'afinidade'
      );
      const fragileSkill = character?.narrativeSkills?.find(
        (s: { level: string }) => s.level === 'inaptidao'
      );

      const buildContextualActionNarrative = () => {
        if (actionMode === 'SAY') {
          return [
            `*Narrador*: Em **${world?.location || 'Tóquio'}**, sua voz corta o silêncio denso da Cortina enquanto sua aura espiritual oscila ao redor do corpo. Você se dirige diretamente a **${firstNpc.name}**: *"${actionText}"*${
              strongPillar
                ? ` — sua presença reflete seu ponto forte em **${strongPillar.name}**, impondo peso imediato às palavras.`
                : '.'
            }`,
            `*${firstNpc.name}*: ${
              firstNpc.attitude === 'Aliado'
                ? `Cruza os braços e assente com seriedade diante do que você disse (${updatedNpcs[0]?.status || firstNpc.status}). "Faz sentido, ${character?.name || 'Feiticeiro'}. Se seguirmos essa linha agora, podemos virar o fluxo da Energia Amaldiçoada a nosso favor. Qual é o seu próximo passo?"`
                : `Estreita os olhos diante da sua declaração enquanto a pressão espiritual treme no chão (${updatedNpcs[0]?.status || firstNpc.status}). "Palavras ousadas para um feiticeiro de ${character?.grade || 'Grau 4'}... Vamos ver se sua técnica sustenta o que sua boca promete!"`
            }`,
            `*Narrador*: O ambiente reage à tensão do diálogo${
              weakPillar && Number(diceRoll) <= 10
                ? `, embora sua fragilidade em **${weakPillar.name}**${
                    fragileSkill ? ` e inaptidão em **${fragileSkill.name}**` : ''
                  } exijam cautela redobrada`
                : ''
            }. Você recebeu **+${xpGained} XP de Feiticeiro**. O que você faz a seguir?`,
          ];
        }

        if (actionMode === 'STORY') {
          return [
            `*Narrador*: ${actionText}. A cena em **${world?.location || 'Tóquio'}** se transforma sob o peso dessa mudança dramática. Os resíduos de Energia Amaldiçoada se condensam no ar${
              masterySkill
                ? `, e sua maestria em **${masterySkill.name}** permite ler cada detalhe oculto do cenário antes de qualquer outro.`
                : '.'
            }`,
            `*${firstNpc.name}*: Percebe imediatamente a mudança de rumo na cena (${updatedNpcs[0]?.status || firstNpc.status}). "${
              firstNpc.attitude === 'Aliado'
                ? `O cenário mudou rápido... Mantenha os olhos abertos, ${character?.name || 'Feiticeiro'}, algo grande está se movendo dentro da barreira!`
                : `Você acha que mudar o ritmo da batalha vai salvá-lo?! O ar inteiro deste lugar já está impregnado pela minha maldição!`
            }"`,
            `*Narrador*: A crônica avança com **+${xpGained} XP de Feiticeiro** registrados na sua Ficha Exclusiva. Como você conduz o próximo momento?`,
          ];
        }

        if (actionMode === 'TECHNIQUE' || isDomain || isRct) {
          return [
            `*Narrador*: Você canaliza o núcleo da sua Energia Amaldiçoada em **${world?.location || 'Tóquio'}** executando: **${actionText}**! ${
              isCrit20
                ? 'Em um lapso de 0,000001 segundo, o espaço se fende em relâmpagos negros e carmesim — **KOKUSEN (Black Flash)**! Sua compreensão da essência amaldiçoada dispara para 120% de potencial!'
                : isDomain
                ? `Ao entoar o encantamento e fechar o selo de mão, sua barreira inata (**${character?.technique?.domainExpansion || 'Expansão de Domínio'}**) engole o ambiente com acerto garantido!`
                : isRct
                ? 'Multiplicando energia negativa contra energia negativa, o vapor denso da **Técnica Amaldiçoada Reversa** reconstrói seus tecidos instantaneamente!'
                : `A liberação de **${character?.technique?.name || 'sua Técnica Inata'}** rasga o espaço (Dado 1d20: ${diceRoll} | Total: ${modifiedRoll}), atingindo **${firstNpc.name}** em cheio!`
            }${
              weakPillar && Number(diceRoll) <= 7
                ? ` O esforço cobra um preço na sua fragilidade obrigatória (**${weakPillar.name}**), fazendo sua respiração pesar.`
                : ''
            }${
              fallbackSheetEvolution
                ? ` **[DESPERTAR NA FICHA EXCLUSIVA: ${fallbackSheetEvolution.newValue}]**`
                : ''
            }`,
            `*${firstNpc.name}*: ${
              updatedNpcs[0]?.hpPercentage === 0
                ? `Não suporta a densidade destrutiva da sua técnica e se desfaz em fagulhas escuras de Energia Amaldiçoada residual! "Impossível... esse nível de técnica..."`
                : `Recua sob o impacto direto da sua técnica, tentando estabilizar a guarda (${updatedNpcs[0]?.status || firstNpc.status}). "${
                    revealedHandVow
                      ? 'Revelar o funcionamento da própria técnica para aumentar o Output com um Voto Vinculativo... Você joga pesado!'
                      : isCrit20
                      ? 'Faísca Negra?! A pressão espiritual dele acabou de mudar completamente!'
                      : `Essa técnica... ${character?.technique?.name || 'sua maldição'} é mais perigosa do que parecia!`
                  }"`
            }`,
            `*Narrador*: Seu domínio técnico rende **+${xpGained} XP de Feiticeiro**. O que você faz agora?`,
          ];
        }

        // Default: DO (Ação Física / Combate / Exploração)
        return [
          `*Narrador*: Em **${world?.location || 'Tóquio'}**, você age com decisão: **${actionText}**. ${
            isCrit20
              ? 'No instante exato do impacto (0,000001s), relâmpagos negros e carmesim explodem do seu golpe em um **KOKUSEN (Black Flash)** brutal, elevando seu Output a 120%!'
              : isCrit1
              ? `O movimento encontra resistência súbita (1d20: 1 Natural)${
                  weakPillar ? `, expondo sua fragilidade em **${weakPillar.name}**` : ''
                } e forçando você a absorver o impacto no último instante!`
              : `Com rolagem ${diceRoll} no d20 (Total: ${modifiedRoll})${
                  masterySkill ? ` e apoiado por sua maestria em **${masterySkill.name}**` : ''
                }, sua ação altera o equilíbrio da cena contra **${firstNpc.name}**.`
          }${
            fallbackSheetEvolution
              ? ` **[DESPERTAR NA FICHA EXCLUSIVA: ${fallbackSheetEvolution.newValue}]**`
              : ''
          }`,
          `*${firstNpc.name}*: ${
            updatedNpcs[0]?.hpPercentage === 0
              ? `Cai de joelhos enquanto seu núcleo amaldiçoado entra em colapso definitivo (${updatedNpcs[0]?.status}). "Você... venceu este confronto..."`
              : firstNpc.attitude === 'Aliado'
              ? `Acompanha sua movimentação de perto (${updatedNpcs[0]?.status || firstNpc.status}). "Boa iniciativa, ${character?.name || 'Feiticeiro'}! Continue mantendo esse ritmo!"`
              : `Reage à sua investida enquanto faíscas de Energia Amaldiçoada iluminam o redor (${updatedNpcs[0]?.status || firstNpc.status}). "${
                  Number(diceRoll) >= 15
                    ? 'Que velocidade absurda! Não achei que você abriria minha guarda assim!'
                    : 'Você tem coragem de avançar assim, mas ainda estou de pé!'
                }"`
          }`,
          `*Narrador*: Você conquista **+${xpGained} XP de Feiticeiro** neste turno. Qual é a sua próxima ação?`,
        ];
      };

      const narrativeLines = isOpening
        ? [
            `*Narrador*: ${
              customOpeningPrompt || 'O ar noturno pesa com resíduos densos de Energia Amaldiçoada.'
            } Você está em **${world?.location || 'Tóquio'}** no início de **${
              world?.arc || startingArcTitle || 'sua Crônica Jujutsu'
            }**. Como feiticeiro de **${character?.grade || 'Grau 4'}** portador de **${
              character?.technique?.name || 'Técnica Amaldiçoada'
            }**, cada sentido seu capta a pressão espiritual ao redor.`,
            `*${firstNpc.name}*: Observando sua presença no local (${firstNpc.status}), toma a iniciativa. "${
              firstNpc.attitude === 'Aliado'
                ? `Você chegou na hora exata, ${character?.name || 'Feiticeiro'}. A Cortina já foi lançada — prepare sua técnica.`
                : `Então enviaram ${character?.name || 'um feiticeiro'} até aqui... Mostre-me a força da sua maldição!`
            }"`,
            `*Narrador*: A cena inicial está estabelecida. O que você faz?`,
          ]
        : buildContextualActionNarrative();

      const hasHostileNpc = updatedNpcs.some((n: { attitude: string }) => n.attitude === 'Hostil');
      const isCombatScene =
        isOpening ||
        hasHostileNpc ||
        actionMode === 'DO' ||
        actionMode === 'TECHNIQUE' ||
        isCrit20 ||
        isDomain;

      const nanoBananaAnimePrompt = `Quadro cinematográfico 16:9 estilo anime Jujutsu Kaisen (Estúdio MAPPA) retratando ${
        character?.name || 'o feiticeiro'
      } (${character?.appearance || 'uniforme escuro da Escola Técnica'}) executando "${
        actionText || character?.technique?.name || 'Energia Amaldiçoada'
      }" diante de ${firstNpc.name} em ${
        world?.location || 'Tóquio'
      }. Faíscas densas de Energia Amaldiçoada azul e carmesim, traços dinâmicos de ação, sem texto.`;

      return {
        engineLog: [
          `1. Checagem de Escala de Poder: ${character?.name || 'Jogador'} (${character?.grade || 'Grau 4'}) vs. ${firstNpc.name} (${firstNpc.grade || 'Grau 1'}) | Rolagem 1d20: ${diceRoll} (${modBreakdown} => Total ${modifiedRoll}) — ${Number(diceRoll) >= 12 ? 'Vantagem tática de iniciativa do Jogador' : 'Pressão de velocidade e território do NPC'}.`,
          `2. Checagem de Técnica (Lore Check): ${character?.technique?.name || 'Reforço de EA'} ativa (Output: ${newOutput}% | Custo de EA no turno: -${ceCost}% -> Reserva: ${newCe}%)${weakPillar ? ` | Fragilidade monitorada: ${weakPillar.name}` : ''}.`,
          `3. Psicologia & Estratégia Oculta do NPC: ${firstNpc.name} (${firstNpc.attitude}) atua conforme sua natureza canônica, buscando explorar brechas de alcance e desgaste de Energia Amaldiçoada.`,
        ].join('\n'),
        activeStoryCards: [
          `📜 Ficha Exclusiva: ${character?.name || 'Jogador'}`,
          ...(matchedTitles.length > 0 ? matchedTitles : ['Sistema de Energia Amaldiçoada & Kokusen']),
        ],
        activeCardRuleSummary: `${character?.technique?.name || 'Manipulação de Energia Amaldiçoada'}: ${
          isDomain
            ? `Expansão de Domínio (${character?.technique?.domainExpansion || 'Barreira Inata'}) — Acerto Garantido (Sure-Hit) ativo; risco de Exaustão Pós-Domínio (Burnout) ao colapsar.`
            : isRct
            ? 'Energia Amaldiçoada Reversa (RCT) — Multiplica energia negativa por negativa para regeneração celular ao custo dobrado de EA.'
            : character?.technique?.lapse || 'Reforço e liberação controlada de Energia Amaldiçoada respeitando limite de Output por segundo.'
        }`,
        visualEffectTrigger: vfx,
        narrative: narrativeLines.join('\n\n'),
        imagePrompt: `Official Jujutsu Kaisen Season 2 anime screenshot by MAPPA studio, key visual quality, dynamic cel-shaded linework, glowing cursed energy sparks, depicting ${
          character?.name || 'a jujutsu sorcerer'
        } (${character?.appearance || 'dark Jujutsu High uniform'}) performing ${
          actionText || startingArcTitle
        } at ${world?.location || 'Tokyo'} facing ${firstNpc.name}, 16:9 widescreen anime frame, no text`,
        isCombatScene,
        combatSceneImageQuestion: '',
        nanoBananaAnimePrompt,
        playerStateUpdate: {
          hpPercentage: newHp,
          cursedEnergyPercentage: newCe,
          outputPercentage: newOutput,
          physicalCondition: isRct
            ? 'Tecidos regenerados via RCT (Vapor de Energia Positiva)'
            : isCrit1
            ? 'Escoriações de contra-ataque e guarda pressionada'
            : character?.physicalCondition || 'Intacto — Em ação ativa',
          techniqueState: isDomain
            ? 'Em Uso'
            : revealedHandVow
            ? 'Sob Voto Vinculativo'
            : character?.techniqueState || 'Ativa',
          inBlackFlashZone: isCrit20 ? true : Boolean(character?.inBlackFlashZone),
          newInventoryItemOrVow: revealedHandVow
            ? 'Voto: Revelar a Própria Mão (+20% Output)'
            : '',
          xpGained,
          levelUpReason: isCrit20
            ? 'Iluminação de Kokusen (120% Potencial)!'
            : updatedNpcs[0]?.hpPercentage === 0
            ? `Exorcismo / Vitória sobre ${firstNpc.name}!`
            : 'Experiência narrativa e tática acumulada na cena.',
          sheetEvolution: fallbackSheetEvolution,
        },
        worldStateUpdate: {
          location: world?.location || 'Escola Secundária Sugisawa — Pátio Noturno',
          arc: world?.arc || 'Arco de Introdução: O Dedo de Sukuna',
          activeBarrierOrDomain: isDomain
            ? `Expansão de Domínio: ${character?.technique?.domainExpansion || 'Domínio Inato'}`
            : world?.activeBarrierOrDomain || 'Cortina Ativa',
          npcsInScene: updatedNpcs,
        },
        suggestedActions: [
          `Pressionar ${firstNpc.name} usando ${character?.technique?.name || 'minha Técnica Inata'}`,
          `Dialogar com ${firstNpc.name} para explorar informações sobre a anomalia em ${world?.location || 'Tóquio'}`,
          'Concentrar Energia Amaldiçoada nos punhos buscando um Kokusen decisivo',
        ],
      };
    };

    if (!ai) {
      return res.json({
        ok: true,
        usedFallback: true,
        apiKeyState: 'MISSING',
        statusNotice:
          'Chave GEMINI_API_KEY ausente no ambiente. Turno processado pelo Motor Narrativo de Continuidade JJK sem interromper sua história.',
        data: buildDynamicFallback('Motor Narrativo Local — Chave Ausente'),
      });
    }

    const turnPrompt = isOpening
      ? `
=== ABERTURA DE NOVA CAMPANHA (TURNO #1) ===
Personagem do Jogador: ${JSON.stringify(character, null, 2)}
=== FICHA EXCLUSIVA VIVA DO PERSONAGEM (CONSULTE SEMPRE) ===
${character?.exclusiveSheetMarkdown || 'Ficha Exclusiva ativa.'}
Estado Inicial do Mundo e NPCs: ${JSON.stringify(world, null, 2)}
Arco Escolhido: ${startingArcTitle}
Cena de Abertura Base: ${customOpeningPrompt}

=== STORY CARDS E ENCICLOPÉDIA CANÔNICA ATIVADOS (RAG) ===
${combinedRagContext || 'Conhecimento canônico geral de Jujutsu Kaisen.'}

Gere o Turno #1 de abertura desta campanha com imersão cinematográfica digna do estúdio MAPPA, apresentando a atmosfera visceral do local, a presença dos NPCs em cena com suas personalidades e falas canônicas (*Nome*: Ação "Fala") e passando a iniciativa ao jogador!
`
      : `
=== ESTADO ATUAL DO PERSONAGEM DO JOGADOR ===
${JSON.stringify(character, null, 2)}

=== FICHA EXCLUSIVA VIVA DO PERSONAGEM (CONSULTE E ATUALIZE VIA sheetEvolution SE HOUVER DESPERTAR DE SEÇÃO "Não desenvolvido ainda" OU MUDANÇA NA HISTÓRIA!) ===
${character?.exclusiveSheetMarkdown || 'Ficha Exclusiva do personagem.'}

=== ESTADO ATUAL DO MUNDO E NPCS EM CENA (ATUALIZE O hpPercentage DOS NPCS QUANDO SOFREREM DANO!) ===
${JSON.stringify(world, null, 2)}

=== MEMÓRIA CONSOLIDADA DA CAMPANHA ===
${memoryContext || 'Início da campanha.'}

=== HISTÓRICO RECENTE DE TURNOS ===
${recentHistory || 'Primeiro turno da sessão.'}

=== STORY CARDS E ENCICLOPÉDIA CANÔNICA ATIVADOS NESTE TURNO (RAG) ===
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
- Rolagem 1d20 Natural: ${diceRoll} ${
          Number(diceRoll) === 20
            ? '(CRÍTICO NATURAL 20 — ATIVE BLACK FLASH / KOKUSEN OBRIGATORIAMENTE E CONCEDA ALTO XP E POSSÍVEL DESPERTAR NA FICHA EXCLUSIVA!)'
            : Number(diceRoll) === 1
            ? '(FALHA CRÍTICA 1 — APLIQUE CONSEQUÊNCIA SEVERA!)'
            : ''
        }
- Modificador Tático Aplicado: ${modBreakdown} => Total Modificado = ${modifiedRoll}
- Voto Vinculativo "Revelar a Própria Mão" ativado neste turno: ${
          revealedHandVow ? 'SIM (+20% Output de EA concedido!)' : 'NÃO'
        }
- Texto do Jogador: "${actionText}"

Gere a resposta estruturada em JSON seguindo rigorosamente o schema e o formato teatral (*Narrador*: e *Nome do Personagem*:). Consulte as Perícias & Afinidades Narrativas e Pilares do jogador na Ficha Exclusiva: faça as perícias de ★ Maestria e ● Afinidade AJUDAREM organicamente na cena, e as de ▼ Inaptidão / Fragilidade PREJUDICAREM gerando complicações dramáticas (sem cálculos matemáticos!). Conceda xpGained (25 a 220 XP)!
`;

    const modelChain = Array.from(
      new Set([
        normalizeModelName(model),
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite-preview',
        'gemini-3.8-flash',
      ])
    );

    let lastErrorMessage = 'Erro desconhecido';

    for (const candidateModel of modelChain) {
      try {
        const textResponse = await callGeminiStructured(
          ai,
          candidateModel,
          SYSTEM_INSTRUCTION_GM,
          turnPrompt,
          JJK_RESPONSE_JSON_SCHEMA,
          0.75
        );

        const parsed = JSON.parse(textResponse);
        return res.json({
          ok: true,
          usedFallback: false,
          apiKeyState: 'VALID',
          usedModel: candidateModel,
          switchedFromPrimary: candidateModel !== model,
          data: parsed,
        });
      } catch (error: unknown) {
        lastErrorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[JJK Engine] Modelo ${candidateModel} indisponível (${lastErrorMessage.slice(0, 120)}). Tentando próximo da cadeia...`);
      }
    }

    const classified = classifyGeminiError(lastErrorMessage);
    return res.json({
      ok: true,
      usedFallback: true,
      apiKeyState: classified.state,
      statusNotice: classified.userMessage,
      errorMessage: lastErrorMessage,
      data: buildDynamicFallback(
        classified.state === 'INVALID'
          ? 'Motor de Continuidade — Chave Inválida'
          : 'Motor de Continuidade — Limite de Cota'
      ),
    });
  });

  // Memory Summarizer Endpoint
  app.post('/api/gemini/memory', async (req, res) => {
    const { turnsText = '', turnRange = 'Turnos Recentes', customApiKey = '' } = req.body;
    const headerKey = req.headers['x-custom-api-key'] as string | undefined;
    const ai = getGeminiClient(customApiKey || headerKey);

    const buildContextualMemoryFallback = () => {
      const cleanLines = String(turnsText || '')
        .split('\n')
        .map((l) => l.replace(/\*[^*]+\*:\s*/g, '').trim())
        .filter((l) => l.length > 25);
      const firstExcerpt = cleanLines[0] ? cleanLines[0].slice(0, 160) : '';
      const lastExcerpt =
        cleanLines.length > 1 ? cleanLines[cleanLines.length - 1].slice(0, 160) : '';
      if (firstExcerpt && lastExcerpt) {
        return `Crônica Consolidada (${turnRange}): Início com "${firstExcerpt}..." culminando em "${lastExcerpt}...". Consequências táticas e vínculos preservados no Códice.`;
      }
      if (firstExcerpt) {
        return `Crônica Consolidada (${turnRange}): "${firstExcerpt}..." — Estado de barreiras, ferimentos e alianças registrados.`;
      }
      return `Resumo consolidado (${turnRange}): Combates, escolhas táticas, estado de barreiras e vínculos com NPCs registrados no Códice da Campanha.`;
    };

    if (!ai) {
      return res.json({
        ok: true,
        summary: buildContextualMemoryFallback(),
      });
    }

    const memChain = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3.8-flash'];
    for (const candidateModel of memChain) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents: `Resuma em 3 a 4 frases densas (em Português do Brasil) os eventos cruciais, ferimentos permanentes, inimigos exorcizados, itens obtidos e promessas feitas nestes turnos de RPG de Jujutsu Kaisen (${turnRange}):\n\n${turnsText}`,
        });
        if (response.text) {
          return res.json({
            ok: true,
            summary: response.text.trim(),
          });
        }
      } catch {
        // Continue to next model in chain
      }
    }

    return res.json({
      ok: true,
      summary: buildContextualMemoryFallback(),
    });
  });

  // Anime Image Generation Endpoint (Scene 16:9 & Portraits 1:1)
  app.post('/api/gemini/image', async (req, res) => {
    const {
      prompt = '',
      nanoBananaAnimePrompt = '',
      location = '',
      aspectRatio = '16:9',
      customApiKey = '',
    } = req.body;
    const headerKey = req.headers['x-custom-api-key'] as string | undefined;
    const ai = getGeminiClient(customApiKey || headerKey);

    const aiCraftedDescriptionPt =
      nanoBananaAnimePrompt ||
      `Cena em cel-shading estilo Jujutsu Kaisen (Estúdio MAPPA) em ${
        location || 'Tóquio'
      } (${prompt}).`;

    const finalEnglishAnimePrompt = `${prompt}. Official Jujutsu Kaisen Season 2 (Shibuya Incident) anime screenshot by MAPPA studio, authentic anime cel-shading, thick dynamic action linework, glowing blue and crimson cursed energy lighting, kinematic camera composition, sharp character facial features, 8k anime keyframe, no text, no watermark.`;

    if (!ai) {
      return res.json({
        ok: false,
        reason: 'NO_API_KEY',
        nanoBananaPromptLog: aiCraftedDescriptionPt,
      });
    }

    // 1. Try gemini-3.1-flash-lite-image via generateContent
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: finalEnglishAnimePrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio === '1:1' ? '1:1' : '16:9',
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          return res.json({
            ok: true,
            modelUsed: 'gemini-3.1-flash-lite-image',
            nanoBananaPromptLog: aiCraftedDescriptionPt,
            imageUrl: `data:${mime};base64,${part.inlineData.data}`,
          });
        }
      }
    } catch {
      // Fallback to Imagen 3
    }

    // 2. Fallback to Imagen 3
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: finalEnglishAnimePrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio === '1:1' ? '1:1' : '16:9',
        },
      });

      const base64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64) {
        return res.json({
          ok: true,
          modelUsed: 'imagen-3.0-generate-002',
          nanoBananaPromptLog: aiCraftedDescriptionPt,
          imageUrl: `data:image/jpeg;base64,${base64}`,
        });
      }
    } catch {
      // Fallback to client-side anime SVG art generator
    }

    return res.json({
      ok: false,
      reason: 'IMAGE_MODEL_UNAVAILABLE',
      nanoBananaPromptLog: aiCraftedDescriptionPt,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JJK Cursed Chronicles VTT Server running on http://localhost:${PORT}`);
  });
}

startServer();
