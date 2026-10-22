import type { CodexCategory, StoryCard, StoryEra } from '../types/jjk';
import { categoryForType } from './codexCategories';

/**
 * Compilador do Códice: Markdown -> verbetes estruturados.
 *
 * Fonte canônica: Codex.md. O build (scripts/build-codex-json.ts) chama
 * compileCodexMarkdown e grava json/codex/*.json. Servidor e cliente consomem
 * apenas os JSONs — nunca fazem parsing de Markdown em runtime.
 *
 * Regras estruturais (nada de heurística por palavra no título):
 *  - A tag do cabeçalho define tipo e categoria.
 *  - Cabeçalhos H1 com prosa própria são verbetes de primeira classe
 *    (H1_OVERRIDES) — no parser antigo essa prosa se perdia.
 *  - A era vem de estrutura (tag Evento / H1 EVENTO), não de regex sobre prosa.
 */

export interface CodexEntry {
  id: string;
  title: string;
  tag: string;
  keys: string[];
  type: StoryCard['type'];
  categoria: CodexCategory;
  era: StoryEra;
  value: string;
}

export interface CompileResult {
  entries: CodexEntry[];
  /** Tags presentes no Markdown que não estão em TAG_MAP (build deve falhar). */
  unknownTags: string[];
  /** Headers H1 com prosa que não estão em H1_OVERRIDES (build deve falhar). */
  unknownH1Headers: string[];
}

interface TagRule {
  type: StoryCard['type'];
  categoria: CodexCategory;
}

/**
 * tag do cabeçalho -> tipo + categoria. Toda tag do Markdown precisa estar aqui.
 * A chave é a tag LITERAL (sem acento-fold), porque o build falha alto se uma
 * tag nova aparecer: nunca cair silenciosamente em "lore".
 */
const TAG_MAP: Record<string, TagRule> = {
  // --- Personagens
  Personagem: { type: 'character', categoria: 'personagens' },
  'Espírito Amaldiçoado': { type: 'character', categoria: 'personagens' },
  'Espírito Amaldiçoado de Grau Especial': { type: 'character', categoria: 'personagens' },
  'Cursed Spirits': { type: 'character', categoria: 'personagens' },
  'Cursed Womb': { type: 'character', categoria: 'personagens' },

  // --- Habilidades
  Techniques: { type: 'technique', categoria: 'habilidades' },
  Technique: { type: 'technique', categoria: 'habilidades' },
  Técnica: { type: 'technique', categoria: 'habilidades' },
  'Técnica Amaldiçoada': { type: 'technique', categoria: 'habilidades' },
  'Técnica Inata': { type: 'technique', categoria: 'habilidades' },
  'Técnica de Barreira': { type: 'technique', categoria: 'habilidades' },
  'Técnica / Expansão de Domínio': { type: 'technique', categoria: 'habilidades' },
  'Técnica / Condição Avançada': { type: 'technique', categoria: 'habilidades' },
  'Técnica / Habilidade Avançada': { type: 'technique', categoria: 'habilidades' },
  'Técnica / Shikigami': { type: 'technique', categoria: 'habilidades' },
  'Técnica / Condição Corporal': { type: 'technique', categoria: 'habilidades' },
  'Técnica Amaldiçoada / Expansión de Dominio': { type: 'technique', categoria: 'habilidades' },
  'Técnica Amaldiçoada / Extensão': { type: 'technique', categoria: 'habilidades' },
  'Técnica Amaldiçoada / Transformação': { type: 'technique', categoria: 'habilidades' },
  Shikigami: { type: 'technique', categoria: 'habilidades' },
  'Puppet / Armadura Mecânica': { type: 'technique', categoria: 'habilidades' },
  'Binding Vow': { type: 'technique', categoria: 'habilidades' },
  Domínio: { type: 'domain', categoria: 'habilidades' },
  'Barreira / Infraestrutura': { type: 'technique', categoria: 'habilidades' },
  'Cursed Tool': { type: 'tool', categoria: 'habilidades' },
  'Cursed Object': { type: 'tool', categoria: 'habilidades' },
  'Ferramenta Amaldiçoada': { type: 'tool', categoria: 'habilidades' },

  // --- Locais
  Localização: { type: 'location', categoria: 'locais' },
  'Localização / Estabelecimento': { type: 'location', categoria: 'locais' },
  Local: { type: 'location', categoria: 'locais' },
  'Local / Instalação': { type: 'location', categoria: 'locais' },
  'Local / Escola': { type: 'location', categoria: 'locais' },

  // --- Outros
  Facção: { type: 'faction', categoria: 'outros' },
  'Facção / Grande Clã': { type: 'faction', categoria: 'outros' },
  'Facção / Linhagem': { type: 'faction', categoria: 'outros' },
  'Facção / Política': { type: 'faction', categoria: 'outros' },
  'Facção / Clã': { type: 'faction', categoria: 'outros' },
  'Facção / Estágio Evolutivo': { type: 'faction', categoria: 'outros' },
  'Espírito Amaldiçoado / Facção': { type: 'faction', categoria: 'outros' },
  Evento: { type: 'lore', categoria: 'outros' },
  Terminology: { type: 'lore', categoria: 'outros' },
  Terminologia: { type: 'lore', categoria: 'outros' },
  'Terminologia / Sistema de Poder': { type: 'lore', categoria: 'outros' },
  'Terminologia / Estratégia de Combate': { type: 'lore', categoria: 'outros' },
  'Terminologia / Regra Fundamental': { type: 'lore', categoria: 'outros' },
  'Terminologia / Dom Técnico': { type: 'lore', categoria: 'outros' },
  'Terminologia / Sociedade': { type: 'lore', categoria: 'outros' },
  'Uniforme / Vestimenta': { type: 'lore', categoria: 'outros' },
  'Conceito / Lore de Mundo': { type: 'lore', categoria: 'outros' },
  'World Info': { type: 'lore', categoria: 'outros' },
};

/**
 * Aliases literais que corrigem erros de digitação no Markdown de origem.
 * O fonte é preservado byte a byte; a correção acontece só na classificação.
 */
const TAG_ALIASES: Record<string, string> = {
  // "Fação" no Codex.md (L3250) é "Facção" com cedilha trocada.
  'Fação / Estágio Evolutivo': 'Facção / Estágio Evolutivo',
  // "Fação" solto não existe no fonte atual, mas o build falha alto se existir.
  Fação: 'Facção',
  // Tags em CAIXA ALTA no fonte (formato "N. TIPO / SUBTIPO: Título", L2816+).
  'FACÇÃO / POLÍTICA': 'Facção / Política',
  'FACÇÃO / CLÃ': 'Facção / Clã',
  'TERMINOLOGIA / SOCIEDADE': 'Terminologia / Sociedade',
};

/**
 * Cabeçalhos H1 que são verbetes (têm prosa própria) e não apenas agrupadores.
 * A prosa do H1 é o corpo do verbete; as linhas "Tipo de Registro:" definem a
 * categoria — quando presentes, prevalecem sobre a tag.
 */
const H1_OVERRIDES: Record<string, { tag: string; rule: TagRule; era?: StoryEra }> = {
  '1. EVENTO: O Desfile Noturno dos Cem Demônios (Hyakki Yakō)': {
    tag: 'Evento',
    rule: { type: 'lore', categoria: 'outros' },
    era: 'canon',
  },
  '2. EVENTO: O Incidente de Shibuya (Shibuya Jihen)': {
    tag: 'Evento',
    rule: { type: 'lore', categoria: 'outros' },
    era: 'canon',
  },
  '1. Time Vessel Association (Associação do Receptáculo do Tempo)': {
    tag: 'Facção',
    rule: { type: 'faction', categoria: 'outros' },
  },
  '2. Shiranui-Gata (Estilo Shiranui)': {
    tag: 'Técnica',
    rule: { type: 'technique', categoria: 'habilidades' },
  },
  '3. Transfigured Human (Humano Transfigurado / Kaizō Ningen)': {
    tag: 'Espírito Amaldiçoado',
    rule: { type: 'character', categoria: 'personagens' },
  },
  '1. Talismã (*Jufu* / 呪符)': {
    tag: 'Ferramenta Amaldiçoada',
    rule: { type: 'tool', categoria: 'habilidades' },
  },
  '2. Clã Abe (Abe Clan / 安倍氏 - *Abe-shi*)': {
    tag: 'Facção',
    rule: { type: 'faction', categoria: 'outros' },
  },
  '3. Clã Fujiwara (Fujiwara Clan / 藤原氏 - *Fujiwara-shi* / O Clã "Toh" - 藤)': {
    tag: 'Facção',
    rule: { type: 'faction', categoria: 'outros' },
  },
  '1. Jujutsu Sorcerer (Feiticeiro Jujutsu / Xamã Jujutsu)': {
    tag: 'Terminologia',
    rule: { type: 'lore', categoria: 'outros' },
  },
  '2. Jujutsu Headquarters (Quartel-General de Jujutsu / Os Figurões / Higher-Ups)': {
    tag: 'Facção',
    rule: { type: 'faction', categoria: 'outros' },
  },
  '3. Innate Domain (Domínio Inato / Território Inato)': {
    tag: 'Terminologia',
    rule: { type: 'lore', categoria: 'outros' },
  },
  '🤖 [Personagem] Ultimate Mechamaru (Kokichi Muta / Corpo Autônomo e Aparelho de Marionetes de Grau Semi-1)': {
    tag: 'Personagem',
    rule: { type: 'character', categoria: 'personagens' },
  },
};

/**
 * H1 que são apenas agrupadores: a prosa que os precede pertence aos H2 filhos.
 * Também cobre o cabeçalho-título do documento e o H1 "Enciclopédia Canônica",
 * que é um separador sem verbete.
 */
const H1_GROUP_HEADERS = new Set([
  'CÓDICE DEFINITIVO E ENCICLOPÉDICO DE JUJUTSU KAISEN',
  'Enciclopédia Canônica e Dossiê de RPG: Jujutsu Kaisen',
  '1. TÉCNICA / EXPANSÃO DE DOMÍNIO',
  '2. PERSONAGEM: CHOSO',
  '3. PERSONAGEM: ESO',
  '3. PERSONAGEM: Ryomen Sukuna',
  '1. Clã Inumaki (狗巻家 - Inumaki-ke)',
  '2. Clã Gojo (五条家 - Gojō-ke)',
  '3. Clã Kamo (加茂家 - Kamo-ke)',
]);

/** Prefixo numérico de seção ("1. ", "2. ") — removido do título final. */
const SECTION_PREFIX = /^\d+\.\s*/;

/** Extrai a tag estrutural do cabeçalho: "[Tag] Título" ou "N. [Tag] Título". */
function extractTag(header: string): string | null {
  const m = header.match(/\[([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

/**
 * Extrai a tag do formato "1. FACÇÃO / POLÍTICA: Título" (3 verbetes no fonte).
 * Retorna null quando o cabeçalho não tem tag estrutural.
 */
function extractColonTag(header: string): string | null {
  const m = header.match(/^(?:\d+\.\s*)?([A-ZÀ-Ú][A-ZÀ-Ú0-9 \/]*?):\s+/);
  return m ? m[1].trim() : null;
}

/** Normaliza um título removendo a tag e a numeração de seção. */
export function normalizeTitle(header: string): string {
  return header
    .replace(/\[([^\]]+)\]\s*/, '')
    .replace(/^(?:\d+\.\s*)?[A-ZÀ-Ú][A-ZÀ-Ú0-9 \/]*?:\s+/, '')
    .replace(SECTION_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gatilhos: linha "**Gatilhos (Keys):** a, b, c" -> lista normalizada sem backticks. */
function extractKeys(body: string, title: string): string[] {
  const match = body.match(/\*\*Gatilhos\s*\(Keys\):\*\*\s*([^\n]+)/i);
  const fromDoc = match
    ? match[1]
        .split(/[,;]/)
        .map((k) => k.replace(/[`*_\r]/g, '').trim().toLowerCase())
        .filter(Boolean)
    : [];
  const fromTitle = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return Array.from(new Set([...fromDoc, ...fromTitle]));
}

interface Block {
  level: 1 | 2;
  header: string;
  body: string;
}

/** Divide o Markdown em blocos H1/H2 preservando o corpo de cada um. */
function splitBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (current) {
      current.body = buffer.join('\n').trim();
      blocks.push(current);
    }
    buffer = [];
  };

  // Normaliza CRLF -> LF: o Codex.md no repo usa CRLF, e um "\r" preso no
  // fim do cabeçalho faria a tag ser lida como "[Tag]\r" (tag desconhecida).
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    if (h1 || h2) {
      flush();
      current = { level: h1 ? 1 : 2, header: (h1?.[1] ?? h2?.[1] ?? '').trim(), body: '' };
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

/**
 * "Tipo de Registro:" do corpo é o sinal estrutural mais forte: quando existe,
 * ele define tipo e categoria por cima da tag. Ex.: "Item Utilitário /
 * Ferramenta de Feitiçaria" => tool/habilidades.
 */
function ruleFromRecordType(body: string): TagRule | null {
  const m = body.match(/\*\*Tipo de Registro:\*\*\s*([^\n]+)/i);
  if (!m) return null;
  const text = m[1].toLowerCase();
  if (text.includes('facção') || text.includes('facao')) {
    return { type: 'faction', categoria: 'outros' };
  }
  if (text.includes('termo') || text.includes('enciclop')) {
    return { type: 'lore', categoria: 'outros' };
  }
  if (text.includes('item') || text.includes('ferramenta') || text.includes('talismã')) {
    return { type: 'tool', categoria: 'habilidades' };
  }
  return null;
}

/** Slug estável para o id do verbete. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Compila o Codex.md em verbetes estruturados.
 * Não lança: devolve unknownTags/unknownH1Headers para o build falhar alto.
 */
export function compileCodexMarkdown(markdown: string): CompileResult {
  const blocks = splitBlocks(markdown);
  const entries: CodexEntry[] = [];
  const unknownTags = new Set<string>();
  const unknownH1Headers = new Set<string>();
  const usedIds = new Set<string>();

  const pushEntry = (
    title: string,
    tag: string,
    body: string,
    rule: TagRule,
    era: StoryEra
  ): void => {
    const base = `codex-${slugify(title)}`;
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    entries.push({
      id,
      title,
      tag,
      keys: extractKeys(body, title),
      type: rule.type,
      categoria: rule.categoria,
      era,
      value: body,
    });
  };

  // 1) H1 que são verbetes: a prosa do H1 fica no próprio bloco (entre o
  // cabeçalho H1 e o próximo cabeçalho H1/H2).
  const h1Prose = new Map<string, string>();
  for (const block of blocks) {
    if (block.level !== 1) continue;
    h1Prose.set(block.header, block.body);
  }

  for (const block of blocks) {
    if (block.level !== 1) continue;
    if (H1_GROUP_HEADERS.has(block.header)) continue;
    const override = H1_OVERRIDES[block.header];
    if (!override) {
      if ((h1Prose.get(block.header) ?? '').length > 200) unknownH1Headers.add(block.header);
      continue;
    }
    const prose = h1Prose.get(block.header) ?? '';
    const rule = ruleFromRecordType(prose) ?? override.rule;
    pushEntry(
      normalizeTitle(block.header),
      override.tag,
      prose,
      rule,
      override.era ?? 'both'
    );
  }

  // 2) H2 que são verbetes.
  for (const block of blocks) {
    if (block.level !== 2) continue;
    const rawTag = extractTag(block.header) ?? extractColonTag(block.header);
    if (!rawTag) {
      unknownTags.add(`(sem tag) ${block.header.slice(0, 60)}`);
      continue;
    }
    const tag = TAG_ALIASES[rawTag] ?? rawTag;
    const rule = TAG_MAP[tag];
    if (!rule) {
      unknownTags.add(rawTag);
      continue;
    }
    const recordRule = ruleFromRecordType(block.body);
    const era: StoryEra = tag === 'Evento' ? 'canon' : 'both';
    pushEntry(
      normalizeTitle(block.header),
      tag,
      block.body,
      recordRule ?? rule,
      era
    );
  }

  return {
    entries,
    unknownTags: Array.from(unknownTags),
    unknownH1Headers: Array.from(unknownH1Headers),
  };
}

/** Agrupa entradas por categoria, na ordem canônica das categorias. */
export function groupByCategory(
  entries: CodexEntry[],
  categories: readonly CodexCategory[]
): Record<CodexCategory, CodexEntry[]> {
  const grouped = Object.fromEntries(
    categories.map((c) => [c, [] as CodexEntry[]])
  ) as Record<CodexCategory, CodexEntry[]>;
  for (const entry of entries) {
    const cat = entry.categoria ?? categoryForType(entry.type);
    grouped[cat].push(entry);
  }
  return grouped;
}
