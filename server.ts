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
import {
  SYSTEM_INSTRUCTION_GM,
  JJK_RESPONSE_JSON_SCHEMA,
  buildTurnPrompt,
  extractNarrativeFromJson,
  firstSceneLine,
  type ArcContractWorld,
} from './src/server/promptBuilder';

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

  const mdCandidates = [path.join(cwd, 'Codex.md')];

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
            'Este servidor exige um código de acesso. Salve-o no navegador em localStorage (chave JJK_SERVER_ACCESS_CODE) e recarregue.',
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
   * Sessão Zero — conversa de criação e calibragem narrativa. O Mestre acolhe
   * o conceito, negocia limites de ficção (Votos, custos, segredos) e marca
   * extensões avançadas como "Não desenvolvido ainda". Não há níveis nem XP.
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
        }** tem ótimo potencial dramático para o universo de Gege Akutami.\n\nComo esta é uma crônica narrativa, não vamos falar em níveis ou pontos: o que importa é o que o personagem já sabe fazer, o preço que cada poder cobra e o que ainda é semente. Sugiro começar com o **Grau 4** de prestígio, mantendo o Lapso e seu Estilo de Combate ativos desde já, e marcar as extensões de topo (**Reversão**, **Técnica Máxima**, **RCT** e **Expansão de Domínio**) como **"Não desenvolvido ainda"** na sua Ficha Exclusiva. Assim, quando você viver um treino brutal, uma perda ou um momento de clímax, a própria história despertará esses poderes — sem somar experiência.`,
        balanceStatus: hasPlayerNegotiated ? ('BALANCED_READY' as const) : ('NEEDS_BALANCING' as const),
        designatedInitialGrade: 'Grau 4',
        powerScaleWarning:
          'Equilíbrio de Campanha Recomendado: começar em Grau 4 ou Grau 3 e deixar as técnicas supremas como "Não desenvolvido ainda" cria espaço para evolução dramática, sem fichas numéricas.',
        questionsForPlayer: [
          '1. Qual é a principal condição ou custo físico/espiritual que sua técnica exige quando você a força além do seguro?',
          '2. Quem ou o que você perdeu para chegar até aqui — e o que ainda está disposto a sacrificar para dominar essa técnica?',
        ],
        proposedAdjustmentsSummary: [
          'Grau inicial de prestígio: Grau 4 — reconhecimento, não nível numérico.',
          'Lapso da Técnica e Estilo Marcial prontos para a ficção desde o primeiro turno.',
          'Reversão, Técnica Máxima, RCT e Expansão de Domínio marcados como "Não desenvolvido ainda" para despertar na história.',
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
            'Grau inicial de prestígio recomendado pelo Mestre. É um título na ficção, não um nível com barra de progresso.',
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
            'Lista objetiva das mudanças sugeridas pelo Mestre para ajustar a ficha à ficção (incluindo quais habilidades ficam como "Não desenvolvido ainda").',
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

    const sessionZeroPrompt = `Você é o Mestre de RPG narrativo de Jujutsu Kaisen conduzindo a "Sessão Zero" (criação, questionamento e calibragem de personagem).
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
${playerReply ? `"${playerReply}"` : '(O jogador solicitou a avaliação e calibragem inicial da ficha)'}

REGRAS OBRIGATÓRIAS DO MESTRE NA SESSÃO ZERO:
1. Nunca destrua a ideia do jogador: acolha a criatividade dele (mesmo se for filho adotivo de Gojo, híbrido de maldição, clã que manipula a realidade ou duas Restrições Celestiais) e EXPLIQUE como adaptar isso às leis reais de Jujutsu Kaisen através de:
   - Votos Vinculativos com custos reais (ex: drenar muita energia espiritual se não tiver o sangue do clã, ou restringir a manipulação da realidade primeiro ao próprio corpo);
   - Segredos, dívidas e limites que a história pode cobrar depois;
   - Marcar habilidades avançadas (como Reversão, Técnica Máxima, RCT e Expansão de Domínio) com o texto exato "Não desenvolvido ainda" em proposedCharacterPatch.technique para que sejam despertadas durante a campanha!
2. Deixe claro que esta é uma crônica narrativa: **não existem atributos, perícias, HP, energia medida, dados, níveis ou XP**. O Grau é prestígio reconhecido na ficção e só muda quando a história o justificar. O Mestre decide quando o personagem enfraquece ou é ferido e quando um inimigo morre.
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
      // Motor local de continuidade: não simula dados, HP, energia, XP ou
      // níveis. Apenas mantém a cena viva, coerente com o contrato do arco,
      // quando a IA generativa não está disponível. Quem decide ferimentos e
      // mortes é a ficção — e, aqui, a ficção é conservadora: ninguém morre
      // por conta de um fallback.
      const contractWorld = (world || {}) as ArcContractWorld;
      const premise = (contractWorld.campaignPremise || '').trim();
      const objective = (contractWorld.missionObjective || '').trim();
      const openingScene = (contractWorld.openingScene || customOpeningPrompt || '').trim();
      const beats = contractWorld.mustEstablish || [];
      const lowerAction = (actionText || '').toLowerCase();
      const actionForNarration = (actionText || '').trim().replace(/[.!?]+$/, '');

      const isRct =
        lowerAction.includes('reversa') ||
        lowerAction.includes('rct') ||
        lowerAction.includes('curar');
      const isDomain =
        lowerAction.includes('expansão de domínio') ||
        lowerAction.includes('ryoiki tenkai') ||
        lowerAction.includes('ryōiki tenkai');
      const isKokusen =
        lowerAction.includes('kokusen') ||
        lowerAction.includes('faísca negra') ||
        lowerAction.includes('black flash');

      let vfx = 'NONE';
      if (isDomain) {
        const techName = (character?.technique?.name || '').toLowerCase();
        if (techName.includes('ilimitado') || techName.includes('gojo')) vfx = 'DOMAIN_GOJO';
        else if (techName.includes('santuário') || techName.includes('sukuna')) vfx = 'DOMAIN_SUKUNA';
        else if (techName.includes('sentença') || techName.includes('higuruma')) vfx = 'DOMAIN_HIGURUMA';
        else vfx = 'DOMAIN_GENERIC';
      } else if (isRct) {
        vfx = 'RCT_HEAL';
      } else if (isKokusen) {
        vfx = 'BLACK_FLASH';
      }

      const firstNpc = world?.npcsInScene?.[0] || {
        name: 'Espírito Amaldiçoado de Grau 1',
        grade: 'Grau 1',
        status: 'Emitindo pressão hostil nas sombras',
        attitude: 'Hostil',
        visualDescription: 'Grotesque cursed spirit in dark anime style by MAPPA studio, glowing eyes',
      };

      const updatedNpcs = (world?.npcsInScene?.length ? world.npcsInScene : [firstNpc]).map(
        (
          npc: {
            name: string;
            grade: string;
            status: string;
            attitude: string;
            visualDescription: string;
            revealedTechnique?: string;
            avatarUrl?: string;
          },
          idx: number
        ) => {
          if (idx === 0 && npc.attitude === 'Hostil' && !isOpening) {
            const nextStatus =
              isDomain || isKokusen
                ? 'Atingido em cheio — guarda destruída, tentando se recompor'
                : actionMode === 'TECHNIQUE'
                ? 'Sob pressão da técnica, recuando meio passo'
                : npc.status;
            return { ...npc, status: nextStatus };
          }
          return npc;
        }
      );

      const wantsAwakening =
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

      if (!isOpening && wantsAwakening) {
        const tech = character?.technique || {};
        if (String(tech.lapse || '').toLowerCase().includes('não desenvolvido')) {
          fallbackSheetEvolution = {
            sectionUpdated: 'lapse',
            newValue: `Lapso Desperto (${tech.name || 'Técnica Inata'}): a canalização que antes era instinto agora encontra forma deliberada.`,
            reason: 'Despertar do Lapso da Técnica sob pressão real.',
          };
        } else if (String(tech.antiDomain || '').toLowerCase().includes('não desenvolvido')) {
          fallbackSheetEvolution = {
            sectionUpdated: 'antiDomain',
            newValue: 'Domínio Simples (Novo Estilo da Sombra) — a compreensão de barreira nasce de um erro quase fatal.',
            reason: 'Compreensão de barreira defensiva adquirida sob risco de vida.',
          };
        } else if (String(tech.reversal || '').toLowerCase().includes('não desenvolvido')) {
          fallbackSheetEvolution = {
            sectionUpdated: 'reversal',
            newValue: `Reversão da Técnica (${tech.name || 'Inata'}): a inversão com energia positiva finalmente responde.`,
            reason: 'Despertar da Reversão da Técnica na Ficha Exclusiva.',
          };
        } else if (!tech.hasRct && lowerAction.includes('rct')) {
          fallbackSheetEvolution = {
            sectionUpdated: 'rct',
            newValue:
              'Técnica Amaldiçoada Reversa (RCT) — a multiplicação de energia negativa por negativa produz calor vivo.',
            reason: 'Compreensão do núcleo da Energia Positiva à beira da exaustão.',
            unlockRct: true,
          };
        } else if (
          String(tech.domainExpansion || '').toLowerCase().includes('não desenvolvido') &&
          isDomain
        ) {
          fallbackSheetEvolution = {
            sectionUpdated: 'domainExpansion',
            newValue: `Horizonte Inato de ${character?.name || 'Feiticeiro'} — a barreira completa se ergue pela primeira vez.`,
            reason: 'Expansão de Domínio despertada e gravada na Ficha Exclusiva.',
          };
        }
      }

      const buildContextualActionNarrative = () => {
        if (actionMode === 'SAY') {
          return [
            `*Narrador*: Em **${world?.location || 'Tóquio'}**, sua voz corta o silêncio denso da Cortina. Você se dirige diretamente a **${firstNpc.name}**: *"${actionText}"*`,
            `*${firstNpc.name}*: ${
              firstNpc.attitude === 'Aliado'
                ? `Cruza os braços e assente com seriedade (${updatedNpcs[0]?.status || firstNpc.status}). "Faz sentido, ${character?.name || 'Feiticeiro'}. Se seguirmos essa linha agora, podemos virar o fluxo da Energia Amaldiçoada a nosso favor. Qual é o seu próximo passo?"`
                : `Estreita os olhos diante da sua declaração enquanto a pressão espiritual treme no chão (${updatedNpcs[0]?.status || firstNpc.status}). "Palavras ousadas para um feiticeiro de ${character?.grade || 'Grau 4'}... Vamos ver se sua técnica sustenta o que sua boca promete!"`
            }`,
            `*Narrador*: O ambiente reage à tensão do diálogo. O que você faz a seguir?`,
          ];
        }

        if (actionMode === 'STORY') {
          return [
            `*Narrador*: ${actionForNarration}. A cena em **${world?.location || 'Tóquio'}** se transforma sob o peso dessa mudança dramática.`,
            `*${firstNpc.name}*: Percebe imediatamente a mudança de rumo na cena (${updatedNpcs[0]?.status || firstNpc.status}). "${
              firstNpc.attitude === 'Aliado'
                ? `O cenário mudou rápido... Mantenha os olhos abertos, ${character?.name || 'Feiticeiro'}, algo grande está se movendo dentro da barreira!`
                : `Você acha que mudar o ritmo da batalha vai salvá-lo?! O ar inteiro deste lugar já está impregnado pela minha maldição!`
            }"`,
            `*Narrador*: A crônica avança. Como você conduz o próximo momento?`,
          ];
        }

        if (actionMode === 'TECHNIQUE' || isDomain || isRct) {
          return [
            `*Narrador*: Você canaliza o núcleo da sua Energia Amaldiçoada em **${world?.location || 'Tóquio'}** executando: **${actionForNarration}**! ${
              isKokusen
                ? 'Em um lapso de um milionésimo de segundo, o espaço se fende em relâmpagos negros e carmesim — **KOKUSEN (Black Flash)**. A cena inteira muda de temperatura.'
                : isDomain
                ? `Ao entoar o encantamento e fechar o selo de mão, sua barreira inata (**${character?.technique?.domainExpansion || 'Expansão de Domínio'}**) engole o ambiente.`
                : isRct
                ? 'Multiplicando energia negativa contra energia negativa, o vapor denso da **Técnica Amaldiçoada Reversa** reconstrói seus tecidos.'
                : `A liberação de **${character?.technique?.name || 'sua Técnica Inata'}** rasga o espaço e atinge **${firstNpc.name}**.`
            }${
              fallbackSheetEvolution
                ? ` **[DESPERTAR NA FICHA EXCLUSIVA: ${fallbackSheetEvolution.newValue}]**`
                : ''
            }`,
            `*${firstNpc.name}*: ${
              isDomain || isKokusen
                ? `É arremessado para trás e se ergue com dificuldade, o corpo fumegando (${updatedNpcs[0]?.status || firstNpc.status}). "Impossível... esse nível de técnica..."`
                : `Recua sob o impacto direto da sua técnica, tentando estabilizar a guarda (${updatedNpcs[0]?.status || firstNpc.status}). "${
                    revealedHandVow
                      ? 'Revelar o funcionamento da própria técnica... Você joga pesado, mas agora eu conheço o seu jogo!'
                      : isKokusen
                      ? 'Faísca Negra?! A pressão espiritual dele acabou de mudar completamente!'
                      : `Essa técnica... ${character?.technique?.name || 'sua maldição'} é mais perigosa do que parecia!`
                  }"`
            }`,
            `*Narrador*: O confronto não terminou. O que você faz agora?`,
          ];
        }

        return [
          `*Narrador*: Em **${world?.location || 'Tóquio'}**, você age com decisão: **${actionForNarration}**. ${
            isKokusen
              ? 'No instante exato do impacto, relâmpagos negros e carmesim explodem do seu golpe em um **KOKUSEN (Black Flash)** brutal.'
              : 'O movimento encontra a resistência que a cena impõe, e o equilíbrio pende por um fio.'
          }`,
          `*${firstNpc.name}*: ${
            firstNpc.attitude === 'Aliado'
              ? `Acompanha sua movimentação de perto (${updatedNpcs[0]?.status || firstNpc.status}). "Boa iniciativa, ${character?.name || 'Feiticeiro'}! Continue mantendo esse ritmo!"`
              : `Reage à sua investida enquanto faíscas de Energia Amaldiçoada iluminam o redor (${updatedNpcs[0]?.status || firstNpc.status}). "Você tem coragem de avançar assim... mas ainda estou de pé!"`
          }`,
          `*Narrador*: Você ainda tem a iniciativa. Qual é a sua próxima ação?`,
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
        isOpening || hasHostileNpc || actionMode === 'DO' || actionMode === 'TECHNIQUE' || isKokusen || isDomain;

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
          `1. Consequência imediata: a ação "${actionText}" provoca uma reação concreta em ${firstNpc.name}, sem calcular atributos, dano ou probabilidades.`,
          `2. Direção dos NPCs: ${firstNpc.name} (${firstNpc.attitude}) age conforme sua natureza e o estado narrativo "${updatedNpcs[0]?.status || firstNpc.status}".`,
          `3. Gancho em suspenso: a cena termina com a iniciativa ainda com o jogador; ferimentos e mortes ficam em aberto para a ficção decidir.`,
        ].join('\n'),
        activeStoryCards: [
          `📜 Ficha Exclusiva: ${character?.name || 'Jogador'}`,
          ...(matchedTitles.length > 0 ? matchedTitles : ['Sistema de Energia Amaldiçoada & Kokusen']),
        ],
        activeCardRuleSummary: `${character?.technique?.name || 'Manipulação de Energia Amaldiçoada'}: ${
          isDomain
            ? `Expansão de Domínio (${character?.technique?.domainExpansion || 'Barreira Inata'}) — acerto garantido narrativo, com exaustão consequente ao colapsar.`
            : isRct
            ? 'Energia Amaldiçoada Reversa (RCT) — regeneração celular com custo dramático, decisão do Mestre.'
            : character?.technique?.lapse || 'Reforço e liberação controlada de Energia Amaldiçoada dentro dos limites da ficção.'
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
          physicalCondition: isDomain
            ? 'Exausto pela Expansão de Domínio — consciente, mas com o corpo pesando'
            : isRct
            ? 'Ferimentos recentes tratados com energia positiva — ainda sentindo o custo'
            : isKokusen
            ? 'Adrenalina e dor misturadas após o Kokusen'
            : character?.physicalCondition || 'Em ação',
          newInventoryItemOrVow: revealedHandVow
            ? 'Voto: Revelar a Própria Mão — a técnica foi explicada ao oponente'
            : '',
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
            : 'Mudar o ritmo da cena e forçar uma abertura',
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
      revealedHandVow,
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
      revealedHandVow,
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
    console.log(`JJK Cursed Chronicles — servidor narrativo em http://localhost:${PORT}`);
  });
}

startServer();
