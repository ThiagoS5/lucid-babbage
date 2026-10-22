import fs from 'node:fs';
import path from 'node:path';
import type { CodexCategory, StoryCard, StoryEra } from '../types/jjk';
import { CODEX_CATEGORIES, RAW_STORY_TYPE_MAP } from '../utils/codexCategories';
import { inferEraByStructure } from '../utils/storyCardEra';

/**
 * Carregador do acervo do servidor.
 *
 * Lê os JSONs JÁ GERADOS (json/codex/*.json) e o acervo canônico de 284
 * story cards. Nenhum parsing de Markdown acontece em runtime: o Markdown é
 * compilado por `npm run codex:build` e vira JSON estruturado.
 *
 * Falha alto: tipo cru desconhecido ou JSON ausente => erro no boot, nunca
 * classificação silenciosa em "lore".
 */

export interface ServerStoryCard {
  id: string;
  title: string;
  keys: string[];
  type: StoryCard['type'];
  categoria: CodexCategory;
  value: string;
  era: StoryEra;
  source?: 'codex_md' | 'story_json' | 'initial' | 'custom';
}

interface CodexJsonEntry {
  id: string;
  title: string;
  tag: string;
  keys: string[];
  type: StoryCard['type'];
  categoria: CodexCategory;
  era: StoryEra;
  value: string;
}

interface CodexJsonFile {
  categoria: CodexCategory;
  total: number;
  entries: CodexJsonEntry[];
}

export interface LoadedLore {
  codexCards: ServerStoryCard[];
  storyCards: ServerStoryCard[];
  /** Seções do Códice para o pré-filtro de keyword do RAG. */
  mdSections: { title: string; keys: string[]; content: string; era: StoryEra }[];
}

/** Carrega os 4 JSONs do Códice de json/codex/. */
export function loadCodexJson(cwd: string): ServerStoryCard[] {
  const cards: ServerStoryCard[] = [];
  for (const categoria of CODEX_CATEGORIES) {
    const file = path.join(cwd, 'json', 'codex', `${categoria}.json`);
    if (!fs.existsSync(file)) {
      throw new Error(
        `[JJK RAG Engine] JSON do Códice ausente: ${file}. Rode "npm run codex:build" antes de iniciar o servidor.`
      );
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as CodexJsonFile;
    if (!Array.isArray(parsed.entries)) {
      throw new Error(`[JJK RAG Engine] JSON do Códice malformado (sem "entries"): ${file}`);
    }
    for (const entry of parsed.entries) {
      cards.push({
        id: entry.id,
        title: entry.title,
        keys: Array.isArray(entry.keys) ? entry.keys : [],
        type: entry.type,
        categoria: entry.categoria,
        value: entry.value,
        era: entry.era,
        source: 'codex_md',
      });
    }
  }
  return cards;
}

/**
 * Carrega o acervo canônico de 284 story cards.
 * O tipo cru vem do próprio acervo e é mapeado por tabela explícita; um tipo
 * novo quebra o boot em vez de virar "lore".
 */
export function loadStoryCards(cwd: string): ServerStoryCard[] {
  const candidates = [
    path.join(cwd, 'json', 'adventure-UhtU4tSbk-kc-story-cards-284.json'),
    path.join(cwd, 'adventure-UhtU4tSbk-kc-story-cards-284.json'),
  ];
  const jsonPath = candidates.find((p) => fs.existsSync(p));
  if (!jsonPath) {
    throw new Error(
      '[JJK RAG Engine] Acervo canônico ausente: json/adventure-UhtU4tSbk-kc-story-cards-284.json'
    );
  }

  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Array<Record<string, unknown>>;
  const cards: ServerStoryCard[] = [];
  const unknownTypes = new Set<string>();

  parsed
    .filter((c) => c && c.value && String(c.value).trim().length > 0)
    .forEach((c, idx) => {
      const title = String(c.title || `Card #${idx + 1}`).trim();
      const keys = Array.isArray(c.keys)
        ? c.keys.map((k: unknown) => String(k).trim().toLowerCase())
        : String(c.keys || title)
            .split(',')
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean);
      const rawType = String(c.type || '').trim().toLowerCase();
      const rule = RAW_STORY_TYPE_MAP[rawType];
      if (!rule) {
        unknownTypes.add(rawType || '(vazio)');
        return;
      }
      cards.push({
        id: `canon-card-${idx + 1}`,
        title,
        keys,
        type: rule.type,
        categoria: rule.categoria,
        value: String(c.value).trim(),
        era: rule.era ?? inferEraByStructure({ title, type: rawType, keys }),
        source: 'story_json',
      });
    });

  if (unknownTypes.size > 0) {
    throw new Error(
      `[JJK RAG Engine] Tipos crus sem mapeamento em RAW_STORY_TYPE_MAP: ${Array.from(unknownTypes).join(', ')}`
    );
  }
  return cards;
}

/** Carrega todo o acervo: Códice (JSONs) + story cards (JSON). */
export function loadLore(cwd: string): LoadedLore {
  const codexCards = loadCodexJson(cwd);
  const storyCards = loadStoryCards(cwd);
  const mdSections = codexCards.map((card) => ({
    title: card.title,
    keys: card.keys,
    content: card.value,
    era: card.era,
  }));
  return { codexCards, storyCards, mdSections };
}
