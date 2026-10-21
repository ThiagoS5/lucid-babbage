import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  inferStoryCardEra,
  isStoryCardAllowedForEra,
  storyCardEraTag,
} from './src/utils/storyCardEra';

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

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Híbrido: pré-filtra por keyword (rápido) e, quando há cliente Gemini válido,
 * re-ordena os candidatos por similaridade de cosseno via embeddings
 * (gemini-embedding-001). Se o embedding falhar, mantém o resultado por keyword.
 */
async function buildServerSideDeepRag(
  searchQuery: string,
  existingTitles: string[] = [],
  ai: GoogleGenAI | null = null,
  campaignEra?: 'canon' | 'sequel'
): Promise<{ extraRagText: string; matchedTitles: string[] }> {
  const rawQuery = (searchQuery || '').trim();
  const q = rawQuery.toLowerCase();
  if (!q) return { extraRagText: '', matchedTitles: [] };

  const matchedTitles = new Set<string>(existingTitles);

  interface Candidate {
    title: string;
    text: string;
    source: 'md' | 'card';
    /** Ex.: " · Cânone 2018" — ajuda o Mestre a não tratar o passado como presente. */
    eraTag?: string;
  }

  const candidates: Candidate[] = [];

  // 1. Keyword pré-filtro sobre as seções do Códice
  if (SERVER_MD_SECTIONS.length > 0) {
    const scoredMd = SERVER_MD_SECTIONS.map((sec) => {
      let score = 0;
      for (const k of sec.keys) {
        if (k.length >= 3 && q.includes(k)) score += k.length >= 5 ? 8 : 4;
      }
      return { sec, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    for (const item of scoredMd) {
      candidates.push({
        title: item.sec.title,
        text: item.sec.content.slice(0, 900),
        source: 'md',
      });
    }
  }

  // 2. Keyword pré-filtro sobre os Story Cards
  if (SERVER_STORY_CARDS.length > 0) {
    // Filtro de era: um card do Jogo do Abate não deve cair numa cena de 2020.
    const eraPool = campaignEra
      ? SERVER_STORY_CARDS.filter((card) => isStoryCardAllowedForEra(card, campaignEra))
      : SERVER_STORY_CARDS;
    const scoredCards = eraPool.map((card) => {
      let score = 0;
      if (q.includes(card.title.toLowerCase())) score += 10;
      for (const k of card.keys) {
        if (k.length >= 3 && q.includes(k)) score += 5;
      }
      if (campaignEra === 'sequel' && inferStoryCardEra(card) === 'sequel') score += 2;
      return { card, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    for (const item of scoredCards) {
      candidates.push({
        title: item.card.title,
        text: `${item.card.title}. ${item.card.value}`.slice(0, 900),
        source: 'card',
        eraTag: storyCardEraTag(item.card),
      });
    }
  }

  if (candidates.length === 0) {
    return { extraRagText: '', matchedTitles: Array.from(matchedTitles) };
  }

  // 3. Re-ranking por embeddings (similaridade de cosseno)
  let ranked: Candidate[] = candidates;
  if (ai) {
    try {
      const embedModel = 'gemini-embedding-001';
      const contents = [
        { parts: [{ text: rawQuery.slice(0, 1500) }] },
        ...candidates.map((c) => ({ parts: [{ text: c.text }] })),
      ];
      const resp = await ai.models.embedContent({ model: embedModel, contents });
      const embs = resp.embeddings || [];
      const queryVec = embs[0]?.values;
      if (queryVec && queryVec.length > 0) {
        const scored = candidates
          .map((c, i) => ({
            c,
            sim: cosineSimilarity(queryVec, embs[i + 1]?.values || []),
          }))
          .sort((a, b) => b.sim - a.sim);
        ranked = scored.map((s) => s.c);
      }
    } catch (err) {
      console.warn(
        '[JJK RAG] Falha no re-ranking por embeddings; mantendo keyword:',
        err instanceof Error ? err.message.slice(0, 120) : err
      );
    }
  }

  // 4. Seleciona top-k (máx. 4 verbetes + 4 cards) para controlar o tamanho do prompt
  const topMd = ranked.filter((c) => c.source === 'md').slice(0, 4);
  const topCards = ranked.filter((c) => c.source === 'card').slice(0, 4);
  const selected = [...topMd, ...topCards];

  const chunks: string[] = [];
  for (const c of selected) {
    if (matchedTitles.has(c.title)) continue;
    matchedTitles.add(c.title);
    chunks.push(
      c.source === 'card'
        ? `### [Story Card${c.eraTag || ''}] ${c.title}\n${c.text}`
        : `### [Códice] ${c.title}\n${c.text}`
    );
  }

  return {
    extraRagText: chunks.join('\n\n---\n\n'),
    matchedTitles: Array.from(matchedTitles).slice(0, 12),
  };
}

interface TurnPromptParams {
  character: unknown;
  world: unknown;
  actionMode: string;
  actionText: string;
  diceRoll: number;
  revealedHandVow: boolean;
  modBreakdown: string;
  combinedRagContext: string;
  isOpening: boolean;
  startingArcTitle: string;
  customOpeningPrompt: string;
  memoryContext: string;
  recentHistory: string;
}

interface ArcContractWorld {
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
function withoutKeys<T extends Record<string, unknown>>(obj: T, keys: string[]): T {
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
function renderArcContract(
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
function firstSceneLine(text: string, maxLen = 420): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return stop > 120 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`;
}

function buildTurnPrompt(p: TurnPromptParams): string {
  const {
    character,
    world,
    actionMode,
    actionText,
    diceRoll,
    revealedHandVow,
    modBreakdown,
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

  return isOpening
    ? `
=== ABERTURA DE NOVA CAMPANHA (TURNO #1) ===
Personagem do Jogador: ${JSON.stringify(characterForPrompt, null, 2)}
=== FICHA EXCLUSIVA VIVA DO PERSONAGEM (CONSULTE SEMPRE) ===
${(character as { exclusiveSheetMarkdown?: string })?.exclusiveSheetMarkdown || 'Ficha Exclusiva ativa.'}
Estado Inicial do Mundo e NPCs: ${JSON.stringify(worldForPrompt, null, 2)}
${renderArcContract(world, startingArcTitle, customOpeningPrompt, true)}

=== STORY CARDS E ENCICLOPÉDIA CANÔNICA ATIVADOS (RAG) ===
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
7. Responda no formato *Narrador*: / *Nome do Personagem*:, com cada bloco em seu próprio parágrafo separado por uma linha em branco. Nunca coloque fala de NPC no mesmo parágrafo da narração. Preencha engineLog, suggestedActions, imagePrompt e playerStateUpdate. xpGained inicial entre 15 e 40.
`
    : `
=== ESTADO ATUAL DO PERSONAGEM DO JOGADOR ===
${JSON.stringify(characterForPrompt, null, 2)}

=== FICHA EXCLUSIVA VIVA DO PERSONAGEM (CONSULTE E ATUALIZE VIA sheetEvolution SE HOUVER DESPERTAR DE SEÇÃO "Não desenvolvido ainda" OU MUDANÇA NA HISTÓRIA!) ===
${(character as { exclusiveSheetMarkdown?: string })?.exclusiveSheetMarkdown || 'Ficha Exclusiva do personagem.'}

${renderArcContract(world, startingArcTitle, '', false)}

=== ESTADO ATUAL DO MUNDO E NPCS EM CENA (ATUALIZE O hpPercentage DOS NPCS QUANDO SOFREREM DANO!) ===
${JSON.stringify(worldForPrompt, null, 2)}

=== MEMÓRIA CONSOLIDADA DA CAMPANHA ===
${memoryContext || 'Início da campanha.'}

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
- Rolagem (referência de tensão): ${diceRoll} — valor ALTO sugere sorte/momento favorável; valor BAIXO sugere contratempo. É apenas um guia: o resultado final deve seguir a lógica da cena, a ficha e o Grau, NUNCA um Black Flash automático por rolagem.
- Modificador Tático de Contexto: ${modBreakdown}
- Voto Vinculativo "Revelar a Própria Mão" ativado neste turno: ${
        revealedHandVow ? 'SIM (+20% Output de EA concedido!)' : 'NÃO'
      }
- Texto do Jogador: "${actionText}"

Gere a resposta estruturada em JSON seguindo o schema e o formato teatral (*Narrador*: e *Nome do Personagem*:). Consulte as Perícias & Afinidades Narrativas e Pilares do jogador na Ficha Exclusiva: faça as perícias de ★ Maestria e ● Afinidade AJUDAREM organicamente na cena, e as de ▼ Inaptidão PREJUDICAREM gerando complicações dramáticas (sem cálculos matemáticos!). Conceda xpGained (15 a 120 XP, conforme o peso narrativo do turno)!
`;
}

function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Extrai o valor do campo "narrative" de um JSON ainda incompleto (para streaming). */
function extractNarrativeFromJson(rawJson: string): string {
  const m = rawJson.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return '';
  return unescapeJsonString(m[1]);
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
    'narrative',
    'imagePrompt',
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
  // IDs reais da Gemini API (ai.google.dev/gemini-api/docs/models).
  if (m === 'gemini-3.8-flash' || m === 'gemini-flash-latest') {
    return 'gemini-3.8-flash';
  }
  if (m === 'gemini-3.5-flash-lite' || m === 'gemini-flash-lite-latest') {
    return 'gemini-3.5-flash-lite';
  }
  if (m === 'gemini-3.1-flash-lite') {
    return 'gemini-3.1-flash-lite';
  }
  if (m === 'gemini-4-argon' || m === 'gemini-pro-latest') {
    return 'gemini-4-argon';
  }
  // Aliases legados/inexistentes -> modelo real mais próximo.
  if (m === 'gemini-3-flash-preview' || m === 'gemini-2.5-flash') {
    return 'gemini-3.8-flash';
  }
  if (m === 'gemini-3.1-flash-lite-preview' || m === 'gemini-2.5-flash-lite') {
    return 'gemini-3.1-flash-lite';
  }
  return 'gemini-3.8-flash';
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

## 7. REGRAS DO CENÁRIO (MANGÁ 2018 → ERA DE SEGUIMENTO), PILARES E FICHA VIVA
- **Era da campanha:** leia o campo "era" do mundo. Se for "sequel", a história acontece DEPOIS do desfecho do mangá (Sukuna destruído, Kenjaku derrotado, Gojo morto, política jujutsu em reconstrução) e a seção 9 se aplica. Se for "canon", a história roda dentro do mangá de 2018 e não pode ultrapassar o ponto cronológico do arco.
- Nas colônias do **Jogo do Abate (Culling Game)** — apenas em campanhas canônicas daquele arco —, cada jogador possui uma **Kogane** (interface amaldiçoada que anuncia regras, pontuação e localização). Feiticeiros valem **5 pontos** ao morrerem; Não-feiticeiros valem **1 ponto**; com **100 pontos**, um jogador pode adicionar uma nova regra geral.
- **Pilares de Aptidão e Perícias Narrativas (100% Narrativo, Sem Cálculos Matemáticos):** Respeite os Pilares de Aptidão do jogador e suas Perícias Narrativas (★ Maestria, ● Afinidade, ▼ Inaptidão), sem nunca exibir somas matemáticas de perícias no texto.
- **Ficha Exclusiva Viva:** Se alguma seção estiver como "Não desenvolvido ainda" e o jogador treinar, despertar em situação extrema ou em um momento de clímax digno, preencha \`playerStateUpdate.sheetEvolution\` com parcimônia.

---

## 8. ÂNCORA DO ARCO (PLOT ESSENTIALS) E ANTI-DERIVA — OBRIGATÓRIO

O bloco "PLOT ESSENTIALS" do turno informa o **objetivo imediato do arco** e a **cronologia**. Siga-o como a bússola da cena:

1. **Não deriva de cenário:** mantenha o jogador progredindo em direção ao \`missionObjective\`. Cenas de exploração ou combate devem **sempre empurrar a trama na direção desse objetivo** (ou apresentar um obstáculo que o bloqueie). Não crie missões paralelas aleatórias nem faça o jogador "perder" o rumo.
2. **Não resolva o futuro do mangá:** a não ser que o jogador esteja exatamente naquele ponto cronológico, **não antecipe nem conclua** eventos canônicos posteriores (mortes, revelações, o desfecho do mangá). O mundo evolui pelas escolhas do jogador, mas sem pular arcos.
3. **Fidelidade de NPCs e limites de conhecimento (Anti-Alucinação):** cada NPC só sabe aquilo que **viu, sentiu ou foi informado**. Um NPC não pode saber que o jogador carrega o Dedo de Sukuna, uma técnica oculta ou uma Restrição Celestial, a menos que isso tenha sido revelado em cena. Aplique a mesma regra a informações de lore: o NPC conhece apenas o que sua posição no mundo permite.
4. **Elenco do arco:** use preferencialmente os NPCs listados no estado do mundo. Ao introduzir um personagem canônico, respeite sua ficha técnica (seção 6) e seu papel cronológico. Não spawnar personagens canônicos de arcos futuros fora de época.
5. **Rolagem como guia, não como árbitro:** o valor de dado informado é apenas uma **referência de tensão narrativa** (sorte/azar da cena). **Nunca** trate um "20" como Black Flash automático nem um "1" como punição obrigatória: o Kokusen e as consequências críticas devem ser decididos pela **lógica da cena + ficha + Grau**, como um Mestre de mesa faria. Preserve a agência do jogador e a verossimilhança.

---

## 9. MODO SEGUIMENTO (PÓS-CÂNONE) — QUANDO A ERA É "sequel"

1. **O desfecho do mangá é passado imutável.** Sukuna foi destruído, Kenjaku foi derrotado e Gojo morreu em Shinjuku. Não ressuscite nenhum deles, não recrie Dedos de Sukuna, não refaça o Jogo do Abate nem a Fusão de Tengen.
2. **Novo protagonismo.** O jogador é a nova geração. Yuji, Megumi, Nobara, Maki, Yuta, Hakari e Kusakabe existem, mas são veteranos com deveres próprios: podem orientar, cobrar ou aparecer em cena — nunca resolver o problema no lugar do jogador.
3. **A ameaça é consequência, não nostalgia.** Use o que o desfecho deixou: resíduos de energia amaldiçoada, maldições que imitam técnicas de feiticeiros mortos, barreiras órfãs, colônias esquecidas, clãs oportunistas e um Conselho extinto. Nada de reviver o passado do mangá como se fosse novidade.
4. **Escala coerente.** Sem Sukuna e Gojo, Grau Especial continua raro e aterrorizante. Um Grau 4 sobrevive por inteligência, aliados, terreno e barreiras — nunca por força bruta.`;

async function startServer() {
  const app = express();
  // Cloud Run injeta PORT (normalmente 8080); localmente continua 3000.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  // ---------------------------------------------------------------------------
  // Segurança e limite de uso dos endpoints de IA
  // ---------------------------------------------------------------------------
  app.disable('x-powered-by');

  const ACCESS_CODE = (process.env.APP_ACCESS_CODE || '').trim();
  const RATE_WINDOW_MS = 60_000;
  const ROUTE_LIMITS: Record<string, number> = {
    '/api/gemini/turn': 20,
    '/api/gemini/turn/stream': 20,
    '/api/gemini/image': 6,
    '/api/gemini/technique': 10,
    '/api/gemini/session-zero': 15,
    '/api/gemini/validate': 10,
    '/api/gemini/memory': 10,
  };
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();

  // 1. Porta de entrada: mesma origem (bloqueia sites de terceiros chamando o
  //    localhost) e, opcionalmente, código de acesso do servidor.
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();

    const origin = req.headers.origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (req.headers.host && parsed.host !== req.headers.host) {
          return res.status(403).json({
            ok: false,
            reason: 'ORIGIN_NOT_ALLOWED',
            message: 'Origem não autorizada para chamadas de IA.',
          });
        }
      } catch {
        return res.status(403).json({
          ok: false,
          reason: 'ORIGIN_NOT_ALLOWED',
          message: 'Cabeçalho Origin inválido.',
        });
      }
    }

    if (ACCESS_CODE) {
      const provided = String(req.headers['x-access-code'] || '');
      if (provided !== ACCESS_CODE) {
        return res.status(401).json({
          ok: false,
          reason: 'ACCESS_CODE_REQUIRED',
          message:
            'Este servidor exige um código de acesso. Informe-o em Sistema & Nuvem → Código de acesso do servidor.',
        });
      }
    }

    return next();
  });

  // 2. Rate limit por rota e por IP (janela fixa de 60 s). Sem dependências.
  app.use('/api/gemini', (req, res, next) => {
    const routePath = req.originalUrl.split('?')[0];
    const limit = ROUTE_LIMITS[routePath];
    if (!limit) return next();

    const now = Date.now();
    const key = `${routePath}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    let bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
      rateBuckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));

    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        ok: false,
        reason: 'RATE_LIMITED',
        message: `Limite de ${limit} chamadas por minuto atingido. Tente novamente em ${retryAfter}s.`,
        retryAfterSeconds: retryAfter,
      });
    }

    // Limpeza oportunista para o mapa não crescer sem limite.
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) {
        if (v.resetAt <= now) rateBuckets.delete(k);
      }
    }

    return next();
  });

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
      const name = String(characterDraft.name || 'Feiticeiro').trim();
      const clan = String(characterDraft.clan || 'Sem Clã').trim();
      const concept = String(
        characterDraft.customConcept || characterDraft.technique?.description || ''
      ).trim();
      const hasPlayerNegotiated = Boolean(playerReply && playerReply.trim().length > 10);

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

    const { extraRagText, matchedTitles } = await buildServerSideDeepRag(
      searchContextForServerRag,
      activeCards,
      ai,
      world?.era
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

      // O motor local também lê o contrato do arco: sem isso o fallback
      // virava uma cena genérica de "feiticeiro contra maldição".
      const contractWorld = (world || {}) as ArcContractWorld;
      const premise = (contractWorld.campaignPremise || '').trim();
      const playerRole = (contractWorld.playerRole || '').trim();
      const objective = (contractWorld.missionObjective || '').trim();
      const openingScene = (contractWorld.openingScene || customOpeningPrompt || '').trim();
      const beats = contractWorld.mustEstablish || [];

      let vfx: string = 'NONE';
      if (isDomain) {
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
              firstSceneLine(openingScene, 700) || 'O ar noturno pesa com resíduos densos de Energia Amaldiçoada.'
            } Você está em **${world?.location || 'Tóquio'}** no início de **${
              world?.arc || startingArcTitle || 'sua Crônica Jujutsu'
            }**. Como feiticeiro de **${character?.grade || 'Grau 4'}** portador de **${
              character?.technique?.name || 'Técnica Amaldiçoada'
            }**, cada sentido seu capta a pressão espiritual ao redor.`,
            premise ? `*Narrador*: ${premise}` : '',
            `*${firstNpc.name}*: Observando sua presença no local (${firstNpc.status}), toma a iniciativa. "${
              firstNpc.attitude === 'Aliado'
                ? `Você chegou na hora exata, ${character?.name || 'Feiticeiro'}. A Cortina já foi lançada — prepare sua técnica.`
                : `Então enviaram ${character?.name || 'um feiticeiro'} até aqui... Mostre-me a força da sua maldição!`
            }"`,
            objective
              ? `*Narrador*: Objetivo imediato: ${objective} A cena inicial está estabelecida. O que você faz?`
              : `*Narrador*: A cena inicial está estabelecida. O que você faz?`,
          ].filter(Boolean)
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
        assistantMode: 'continuity-engine',
        fallbackReason: reason,
        engineLog: [
          `0. MOTOR LOCAL DE CONTINUIDADE — ${reason}. Sem narração generativa: a cena segue o contrato do arco (era, objetivo, fatos e limites).${objective ? ` Objetivo: ${objective}` : ''}`,
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
        imagePrompt: `Official Jujutsu Kaisen anime keyframe by MAPPA studio, key visual quality, dynamic cel-shaded linework, glowing cursed energy sparks, depicting ${
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
          objective
            ? `Avançar no objetivo do arco: ${objective}`
            : `Pressionar ${firstNpc.name} usando ${character?.technique?.name || 'minha Técnica Inata'}`,
          `Dialogar com ${firstNpc.name} para explorar informações sobre a anomalia em ${world?.location || 'Tóquio'}`,
          beats.length > 0
            ? `Reagir à cena: ${beats[0]}`
            : 'Concentrar Energia Amaldiçoada nos punhos buscando um Kokusen decisivo',
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

    const turnPrompt = buildTurnPrompt({
      character,
      world,
      actionMode,
      actionText,
      diceRoll: Number(diceRoll),
      revealedHandVow,
      modBreakdown,
      combinedRagContext,
      isOpening,
      startingArcTitle,
      customOpeningPrompt,
      memoryContext,
      recentHistory,
    });

    const modelChain = Array.from(
      new Set([
        normalizeModelName(model),
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
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

  // Streaming GM Turn Endpoint (SSE) — narração progressiva + estado estruturado ao final
  app.post('/api/gemini/turn/stream', async (req, res) => {
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

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const done = () => res.end();

    const headerKey = req.headers['x-custom-api-key'] as string | undefined;
    const ai = getGeminiClient(customApiKey || headerKey);

    if (!ai) {
      send('error', { reason: 'NO_API_KEY', message: 'Chave GEMINI_API_KEY ausente.' });
      return done();
    }

    const { mod: totalDiceMod, breakdown: modBreakdown } = getGradeModifier(
      character?.grade,
      character?.inBlackFlashZone,
      revealedHandVow
    );

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

    const { extraRagText } = await buildServerSideDeepRag(
      searchContextForServerRag,
      activeCards,
      ai,
      world?.era
    );
    const combinedRagContext = [ragContext, extraRagText].filter(Boolean).join('\n\n---\n\n');

    const turnPrompt = buildTurnPrompt({
      character,
      world,
      actionMode,
      actionText,
      diceRoll: Number(diceRoll),
      revealedHandVow,
      modBreakdown,
      combinedRagContext,
      isOpening,
      startingArcTitle,
      customOpeningPrompt,
      memoryContext,
      recentHistory,
    });

    const modelChain = Array.from(
      new Set([
        normalizeModelName(model),
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
      ])
    );

    let lastError = 'Erro desconhecido';
    for (const candidateModel of modelChain) {
      let buffer = '';
      let lastNarrativeLen = 0;
      try {
        const stream = await ai.models.generateContentStream({
          model: candidateModel,
          contents: turnPrompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_GM,
            responseMimeType: 'application/json',
            responseSchema: JJK_RESPONSE_JSON_SCHEMA,
            temperature: 0.75,
          },
        });

        for await (const chunk of stream) {
          buffer += chunk.text ?? '';
          const narrative = extractNarrativeFromJson(buffer);
          if (narrative.length > lastNarrativeLen) {
            const delta = narrative.slice(lastNarrativeLen);
            lastNarrativeLen = narrative.length;
            send('delta', { text: delta });
          }
        }

        const parsed = JSON.parse(buffer);
        send('done', {
          ok: true,
          usedFallback: false,
          apiKeyState: 'VALID',
          usedModel: candidateModel,
          switchedFromPrimary: candidateModel !== normalizeModelName(model),
          data: parsed,
        });
        return done();
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[JJK Stream] Modelo ${candidateModel} indisponível (${lastError.slice(0, 120)}). Tentando próximo...`);
      }
    }

    send('error', {
      reason: 'MODEL_FAILED',
      message: 'Falha ao gerar o turno em streaming. Use o endpoint não-streaming como fallback.',
      errorMessage: lastError,
    });
    return done();
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

    const memChain = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
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
      referenceImages = [],
      charactersInScene = [],
    } = req.body;
    const headerKey = req.headers['x-custom-api-key'] as string | undefined;
    const ai = getGeminiClient(customApiKey || headerKey);

    // Monta as imagens de referência (retratos locais ou base64) para consistência.
    const refParts: { inlineData: { mimeType: string; data: string } }[] = [];
    for (const ref of (Array.isArray(referenceImages) ? referenceImages : []).slice(0, 6)) {
      if (typeof ref !== 'string' || !ref.trim()) continue;
      try {
        if (ref.startsWith('data:')) {
          const m = ref.match(/^data:([^;]+);base64,(.+)$/);
          if (m) refParts.push({ inlineData: { mimeType: m[1] || 'image/png', data: m[2] } });
        } else if (ref.startsWith('/portraits/')) {
          const localPath = path.join(process.cwd(), 'public', ref.replace(/^\/+/, ''));
          if (fs.existsSync(localPath)) {
            const ext = path.extname(localPath).toLowerCase();
            const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
            refParts.push({ inlineData: { mimeType: mime, data: fs.readFileSync(localPath).toString('base64') } });
          }
        }
      } catch {
        // Ignora referência inválida e segue com as demais.
      }
    }

    const sceneText =
      (nanoBananaAnimePrompt && nanoBananaAnimePrompt.trim()) ||
      `Cena de ${location || 'Tóquio'}: ${prompt}`;

    const charBlock =
      Array.isArray(charactersInScene) && charactersInScene.length > 0
        ? ` Characters in the scene (keep their canonical appearances and outfits): ${charactersInScene.join('; ')}.`
        : '';

    const finalEnglishAnimePrompt = `${sceneText}.${charBlock} Official Jujutsu Kaisen anime keyframe style (MAPPA studio), authentic anime cel-shading, thick dynamic action linework, glowing blue and crimson cursed energy lighting, cinematic camera composition, sharp character facial features, high detail, no text, no watermark.`;

    const nanoBananaPromptLog = sceneText;

    if (!ai) {
      return res.json({
        ok: false,
        reason: 'NO_API_KEY',
        message: 'Chave GEMINI_API_KEY ausente. Configure uma chave válida para gerar imagens.',
        nanoBananaPromptLog,
      });
    }

    const generateWithImageModel = async (model: string, useRefs: boolean) => {
      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: finalEnglishAnimePrompt },
      ];
      if (useRefs) parts.push(...refParts);
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          imageConfig: { aspectRatio: aspectRatio === '1:1' ? '1:1' : '16:9' },
        },
      });
      const outParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of outParts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          return { imageUrl: `data:${mime};base64,${part.inlineData.data}`, modelUsed: model };
        }
      }
      return null;
    };

    let lastImageError = '';
    // 1. Nano Banana 2 / Pro (multi-referência, consistência de personagens)
    for (const model of ['gemini-3.1-flash-image', 'gemini-3-pro-image']) {
      try {
        const result = await generateWithImageModel(model, true);
        if (result) return res.json({ ok: true, ...result, nanoBananaPromptLog });
      } catch (err) {
        lastImageError = err instanceof Error ? err.message : String(err);
        console.warn(`[JJK Image] ${model} indisponível:`, lastImageError.slice(0, 120));
      }
    }

    // 2. Nano Banana legado (text-to-image, sem referência)
    try {
      const result = await generateWithImageModel('gemini-2.5-flash-image', false);
      if (result) return res.json({ ok: true, ...result, nanoBananaPromptLog });
    } catch (err) {
      lastImageError = err instanceof Error ? err.message : String(err);
      console.warn('[JJK Image] gemini-2.5-flash-image indisponível:', lastImageError.slice(0, 120));
    }

    const quotaExceeded = /429|quota|billing/i.test(lastImageError);
    return res.json({
      ok: false,
      reason: quotaExceeded ? 'IMAGE_QUOTA_EXCEEDED' : 'IMAGE_MODEL_UNAVAILABLE',
      message: quotaExceeded
        ? 'Cota de geração de imagens excedida na sua conta Google. Verifique o plano/faturamento (ai.google.dev) para liberar os modelos de imagem (Nano Banana).'
        : 'Nenhum modelo de imagem respondeu. Verifique a chave e a cota da API Gemini.',
      nanoBananaPromptLog,
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
