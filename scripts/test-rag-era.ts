import fs from 'fs';
import { selectActiveStoryCardsForTurn } from '../src/shared/lib/jjkEngine';
import type { StoryCard } from '../src/shared/types/jjk';

const raw = JSON.parse(
  fs.readFileSync('json/adventure-UhtU4tSbk-kc-story-cards-284.json', 'utf-8')
) as Array<Record<string, unknown>>;

const cards: StoryCard[] = raw.map((c, idx) => ({
  id: 'card-' + idx,
  title: String(c.title || ''),
  keys: Array.isArray(c.keys) ? c.keys.map(String) : [],
  type: 'lore',
  value: String(c.value || ''),
}));

const query =
  'Shinjuku, cratera, residuo de energia amaldicoada. O Jogo do Abate, o Incidente de Shibuya e o Goodwill Event sao historia.';

const sequel = selectActiveStoryCardsForTurn(cards, query, 12, 'sequel');
const canon = selectActiveStoryCardsForTurn(cards, query, 12, 'canon');

const banned = /shibuya incident|goodwill event|night parade|jogo do abate|culling game|prison realm|sukuna'?s finger/i;
console.log('SEQUEL_COUNT', sequel.length);
console.log('SEQUEL_TITLES', sequel.map((c) => c.title).join(' | ').slice(0, 500));
console.log('SEQUEL_CANON_EVENTS', sequel.filter((c) => banned.test(c.title + ' ' + c.value)).length);
console.log('CANON_TITLES', canon.map((c) => c.title).join(' | ').slice(0, 350));
