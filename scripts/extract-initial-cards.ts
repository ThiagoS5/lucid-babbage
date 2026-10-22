/**
 * Extrai INITIAL_STORY_CARDS do initialCodex.ts para json/inicial.json.
 *
 * Usa o runtime do TS (tsx) para importar o módulo real — nada de regex.
 * A categoria vem da taxonomia compartilhada (categoryForType) e a era é
 * estrutural ('both': são cards de personagem/técnica reutilizáveis).
 *
 *   npm run codex:extract
 *
 * Uso: este script é a ferramenta de MIGRAÇÃO (o array foi movido para o
 * JSON). Rodá-lo de novo sobre o módulo já migrado sobrescreveria o JSON com
 * um acervo vazio — por isso ele falha se o módulo não expuser mais cards.
 */
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_STORY_CARDS } from '../src/data/initialCodex.ts';
import { categoryForType } from '../src/utils/codexCategories.ts';
import type { StoryCard } from '../src/types/jjk.ts';

const out = path.join(process.cwd(), 'json', 'inicial.json');

if (!Array.isArray(INITIAL_STORY_CARDS) || INITIAL_STORY_CARDS.length === 0) {
  console.error(
    '[codex:extract] INITIAL_STORY_CARDS está vazio — o módulo já foi migrado para o JSON? ' +
      'Não rode esta extração de novo (o script é de migração, não de sincronização).'
  );
  process.exit(1);
}

const entries = INITIAL_STORY_CARDS.map((card) => ({
  id: card.id,
  title: card.title,
  keys: card.keys,
  type: card.type,
  categoria: categoryForType(card.type),
  era: 'both' as const,
  value: card.value,
}));

const payload = {
  categoria: 'inicial',
  label: 'Base inicial',
  total: entries.length,
  entries,
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
console.log(`[codex:extract] ${entries.length} cards -> ${out}`);
for (const e of entries) {
  console.log(`  ${e.id.padEnd(18)} ${e.type.padEnd(10)} ${e.categoria.padEnd(12)} ${e.title.slice(0, 46)}`);
}

// Sanidade: o tipo do card precisa continuar compatível com StoryCard.
const _typeCheck: StoryCard[] = entries;
void _typeCheck;
