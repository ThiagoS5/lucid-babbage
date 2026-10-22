import type { CodexCategory, StoryCard, StoryEra } from '../types/jjk';

/**
 * Taxonomia do Códice — fonte única da verdade compartilhada pelo servidor
 * (server.ts) e pelo cliente (React). Sem dependências de Node/fs, para poder
 * ser importada dos dois lados (mesmo padrão de src/utils/storyCardEra.ts).
 */

export const CODEX_CATEGORIES: readonly CodexCategory[] = [
  'personagens',
  'habilidades',
  'locais',
  'outros',
];

export const CODEX_CATEGORY_LABELS: Record<CodexCategory, string> = {
  personagens: 'Personagens',
  habilidades: 'Habilidades',
  locais: 'Locais',
  outros: 'Outros',
};

/** Categoria -> arquivo em json/codex/ (espelha scripts/build-codex-json.ts). */
export const CODEX_CATEGORY_FILES: Record<CodexCategory, string> = {
  personagens: 'personagens.json',
  habilidades: 'habilidades.json',
  locais: 'locais.json',
  outros: 'outros.json',
};

/** Tipos de verbete que pertencem a cada categoria do Códice. */
export const CATEGORY_TYPES: Record<CodexCategory, readonly StoryCard['type'][]> = {
  personagens: ['character'],
  habilidades: ['technique', 'domain', 'tool'],
  locais: ['location'],
  outros: ['lore', 'faction'],
};

/** Categoria de um verbete a partir do seu tipo. */
export function categoryForType(type: StoryCard['type']): CodexCategory {
  if (type === 'character') return 'personagens';
  if (type === 'technique' || type === 'domain' || type === 'tool') return 'habilidades';
  if (type === 'location') return 'locais';
  return 'outros';
}

/** Categoria de um card, priorizando o campo explícito (vindo do JSON). */
export function categoryOfCard(card: Pick<StoryCard, 'type' | 'categoria'>): CodexCategory {
  return card.categoria ?? categoryForType(card.type);
}

/**
 * Tipo cru -> tipo + categoria + era dos Story Cards de
 * json/adventure-UhtU4tSbk-kc-story-cards-284.json.
 *
 * Substitui a heurística por substring que o servidor usava
 * (server.ts:55-66), que classificava 61 cards como "lore" e errava
 * Shikigami / Cursed Spirits / Cursed Womb / faction / Event.
 * Tipo desconhecido => erro no boot, nunca "lore" silencioso.
 */
export const RAW_STORY_TYPE_MAP: Record<
  string,
  { type: StoryCard['type']; categoria: CodexCategory; era?: StoryEra }
> = {
  power: { type: 'technique', categoria: 'habilidades' },
  techniques: { type: 'technique', categoria: 'habilidades' },
  technique: { type: 'technique', categoria: 'habilidades' },
  shikigami: { type: 'technique', categoria: 'habilidades' },
  puppet: { type: 'technique', categoria: 'habilidades' },
  'binding vow': { type: 'technique', categoria: 'habilidades' },
  'cursed tool': { type: 'tool', categoria: 'habilidades' },
  'cursed object': { type: 'tool', categoria: 'habilidades' },
  character: { type: 'character', categoria: 'personagens' },
  'cursed spirits': { type: 'character', categoria: 'personagens' },
  'cursed womb': { type: 'character', categoria: 'personagens' },
  location: { type: 'location', categoria: 'locais' },
  faction: { type: 'faction', categoria: 'outros' },
  event: { type: 'lore', categoria: 'outros', era: 'canon' },
  terminology: { type: 'lore', categoria: 'outros' },
  uniforms: { type: 'lore', categoria: 'outros' },
  'world info': { type: 'lore', categoria: 'outros' },
};
