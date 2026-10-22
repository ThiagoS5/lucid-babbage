import type { StoryEra } from '../types/jjk';

/**
 * Filtro de era para o RAG.
 *
 * O acervo de Story Cards é canônico de 2018. Em uma campanha de SEGUIMENTO
 * (pós-mangá), injetar um card de evento do Jogo do Abate ou do Incidente de
 * Shibuya faz o Mestre tratar o passado como se estivesse acontecendo agora.
 * A classificação é conservadora: só exclui o que é claramente específico de
 * um evento/arco; personagens, técnicas, clãs e locais continuam disponíveis.
 */

export interface StoryCardLike {
  title: string;
  type?: string;
  value?: string;
  description?: string;
  keys?: string[];
  era?: StoryEra;
}

const CANON_EVENT_PATTERNS: RegExp[] = [
  /jogo do abate/i,
  /culling game/i,
  /jeu de l.extermination/i,
  /incidente de shibuya/i,
  /shibuya incident/i,
  /incident de shibuya/i,
  /festival de interc[aâ]mbio/i,
  /goodwill event/i,
  /pris[aã]o no reino/i,
  /prison realm/i,
  /dedo de sukuna/i,
  /sukuna'?s finger/i,
  /confronto de shinjuku/i,
  /shinjuku showdown/i,
  /noite dos cem dem[oô]nios/i,
  /night parade of a hundred demons/i,
  /d[eé]fil[eé] nocturne/i,
  /incidente de kyoto/i,
  /kyoto incident/i,
  /estrela placent[aá]ria/i,
  /tengen.*fus[aã]o/i,
  /fus[aã]o de tengen/i,
];

const SEQUEL_PATTERNS: RegExp[] = [
  /p[oó]s-mang[aá]/i,
  /p[oó]s-desfecho/i,
  /seguimento/i,
  /seq[uü][eê]ncia p[oó]s/i,
  /nova gera[cç][aã]o/i,
  /era vazia/i,
  /col[oô]nia residual/i,
  /res[ií]duo de shinjuku/i,
  /cratera de shinjuku/i,
  /um ano de shinjuku/i,
];

/**
 * Padrões de sequel aplicados só à IDENTIDADE do card (título + gatilhos).
 * Deliberadamente SEM /shinjuku/ isolado: "Shinjuku" como local existe nas
 * duas eras, então não pode ser classificado como 'sequel'.
 */
const SEQUEL_STRUCTURE_PATTERNS: RegExp[] = [
  /p[oó]s-mang[aá]/i,
  /p[oó]s-desfecho/i,
  /seq[uü][eê]ncia p[oó]s/i,
  /nova gera[cç][aã]o/i,
  /era vazia/i,
  /col[oô]nia residual/i,
  /res[ií]duo de shinjuku/i,
  /cratera de shinjuku/i,
  /um ano de shinjuku/i,
];

/** Identidade textual do card: título + gatilhos (sem prosa). */
function cardIdentity(card: { title?: string; keys?: string[] }): string {
  return [card.title || '', ...(card.keys || [])].filter(Boolean).join(' ');
}

function cardText(card: StoryCardLike): string {
  return [card.title, card.value, card.description, ...(card.keys || [])]
    .filter(Boolean)
    .join(' ');
}

/**
 * Classifica a era pela ESTRUTURA do card, sem varrer a prosa.
 *
 * - tag/tipo "Evento" => evento canônico de 2018 (era 'canon')
 * - título/chaves com padrão de evento canônico => 'canon'
 * - título/chaves com padrão de sequel => 'sequel'
 * - resto => 'both' (personagens, técnicas, clãs, locais)
 *
 * A prosa de um card NÃO participa: é por isso que personagens como Yorozu,
 * Yuji Itadori e Mahito deixavam de ser canônicos só porque a biografia
 * mencionava o Jogo do Abate. Só a identidade do card (título + gatilhos)
 * decide.
 */
export function inferEraByStructure(card: {
  title?: string;
  type?: string;
  tag?: string;
  keys?: string[];
  era?: StoryEra;
}): StoryEra {
  if (card.era === 'canon' || card.era === 'sequel' || card.era === 'both') {
    return card.era;
  }
  const rawType = String(card.type || '').trim().toLowerCase();
  const rawTag = String(card.tag || '').trim().toLowerCase();
  if (rawType === 'event' || rawTag === 'evento') return 'canon';
  const identity = cardIdentity({
    title: card.title || '',
    keys: card.keys || [],
  });
  if (SEQUEL_STRUCTURE_PATTERNS.some((re) => re.test(identity))) return 'sequel';
  if (CANON_EVENT_PATTERNS.some((re) => re.test(identity))) return 'canon';
  return 'both';
}

/**
 * Classifica a era de um card qualquer. Usada por cards SEM `era` explícito
 * (importados pelo usuário), onde não há tag estrutural: aí varre a prosa.
 */
export function inferStoryCardEra(card: StoryCardLike): StoryEra {
  if (card.era === 'canon' || card.era === 'sequel' || card.era === 'both') {
    return card.era;
  }
  const text = cardText(card);
  if (SEQUEL_PATTERNS.some((re) => re.test(text))) return 'sequel';
  if (String(card.type || '').toLowerCase() === 'event') return 'canon';
  if (CANON_EVENT_PATTERNS.some((re) => re.test(text))) return 'canon';
  return 'both';
}

export function isStoryCardAllowedForEra(
  card: StoryCardLike,
  era?: 'canon' | 'sequel'
): boolean {
  if (!era) return true;
  const cardEra = inferStoryCardEra(card);
  return cardEra === 'both' || cardEra === era;
}

export function storyCardEraLabel(era: StoryEra): string {
  if (era === 'canon') return 'Cânone 2018';
  if (era === 'sequel') return 'Seguimento';
  return 'Referência';
}

export function storyCardEraTag(card: StoryCardLike): string {
  const era = inferStoryCardEra(card);
  return era === 'both' ? '' : ` · ${storyCardEraLabel(era)}`;
}
