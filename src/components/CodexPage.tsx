import React, { useMemo, useState } from 'react';
import type { StoryCard } from '../types/jjk';
import { parseJsonStoryCards, parseMarkdownCodex } from '../utils/jjkEngine';
import { resolveCanonicalPortraitUrl } from '../data/characterPortraits';
import { ArrowLeft, Search, Upload } from 'lucide-react';

interface CodexPageProps {
  cards: StoryCard[];
  onImportCodexCards: (cards: StoryCard[]) => void;
}

const TYPE_LABEL: Record<StoryCard['type'], string> = {
  character: 'Personagem',
  technique: 'Técnica',
  domain: 'Domínio',
  lore: 'Fundamento',
  location: 'Lugar',
  faction: 'Facção',
  tool: 'Ferramenta',
};

const SOURCE_LABEL: Record<NonNullable<StoryCard['source']>, string> = {
  codex_md: 'Códice',
  story_json: 'Acervo canônico',
  initial: 'Base inicial',
  custom: 'Acervo pessoal',
};

const TYPE_ORDER: StoryCard['type'][] = [
  'character',
  'technique',
  'domain',
  'lore',
  'location',
  'faction',
  'tool',
];

type FilterId = 'all' | 'character' | 'technique' | 'location';

const cleanTitle = (title: string) =>
  title.replace(/^\[[^\]]+\]\s*/, '').replace(/\s+/g, ' ').trim();

const splitTitle = (title: string) => {
  const clean = cleanTitle(title);
  const [main, ...rest] = clean.split(' — ');
  return { main: main.trim(), subtitle: rest.join(' — ').trim() };
};

const cleanBody = (value: string) =>
  value
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*[-*]\s*/gm, '• ')
    .replace(/^---+$/gm, '')
    .replace(/^•\s*Gatilhos.*$/gim, '')
    .replace(/^•\s*Chaves.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const CodexPage: React.FC<CodexPageProps> = ({ cards, onImportCodexCards }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sourceRank: Record<string, number> = {
      initial: 0,
      story_json: 1,
      codex_md: 2,
      custom: 3,
    };
    const originalOrder = new Map(cards.map((card, index) => [card.id, index]));
    return [...cards]
      .filter((card) => {
        if (filter === 'character' && card.type !== 'character') return false;
        if (
          filter === 'technique' &&
          card.type !== 'technique' &&
          card.type !== 'domain' &&
          card.type !== 'tool'
        ) {
          return false;
        }
        if (filter === 'location' && card.type !== 'location') return false;
        if (!q) return true;
        return (
          card.title.toLowerCase().includes(q) ||
          card.value.toLowerCase().includes(q) ||
          card.keys.some((k) => k.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const typeDelta = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
        if (typeDelta !== 0) return typeDelta;
        const sourceDelta =
          (sourceRank[a.source || 'custom'] ?? 9) - (sourceRank[b.source || 'custom'] ?? 9);
        if (sourceDelta !== 0) return sourceDelta;
        return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
      });
  }, [cards, filter, query]);

  const selectedCard =
    sorted.find((card) => card.id === selectedId) ?? sorted[0] ?? null;

  const handleSelect = (card: StoryCard) => {
    setSelectedId(card.id);
    setMobileDetailOpen(true);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = file.name.endsWith('.json')
      ? parseJsonStoryCards(text)
      : parseMarkdownCodex(text);
    if (imported.length > 0) {
      onImportCodexCards(imported);
      setQuery('');
      setFilter('all');
    }
    event.target.value = '';
  };

  const renderDetail = (card: StoryCard, compact = false) => {
    const { main, subtitle } = splitTitle(card.title);
    const portrait = card.type === 'character' ? resolveCanonicalPortraitUrl(main) : null;
    return (
      <div className={compact ? '' : 'sticky top-24'}>
        <div className="editorial-eyebrow">
          {TYPE_LABEL[card.type]} · {subtitle || SOURCE_LABEL[card.source || 'custom']}
        </div>
        <h2 className="editorial-page-title mt-4 text-[#eee5d4]">{main}</h2>

        <div className="mt-7 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="editorial-body max-w-[620px] whitespace-pre-line lg:col-start-1 lg:row-start-1">
            {cleanBody(card.value)}
          </div>

          {portrait && (
            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="border border-[rgba(201,169,106,0.22)] bg-[#0d0c09] p-2">
                <img
                  src={portrait}
                  alt={main}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-[4/5] w-full object-cover object-top"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 border-t border-[rgba(201,169,106,0.22)] pt-6 sm:grid-cols-3 lg:col-start-1 lg:row-start-2">
            <div>
              <div className="editorial-label">Tipo</div>
              <div className="editorial-serif text-sm text-[#ded4c1]">{TYPE_LABEL[card.type]}</div>
            </div>
            <div>
              <div className="editorial-label">Fonte</div>
              <div className="editorial-serif text-sm text-[#ded4c1]">
                {SOURCE_LABEL[card.source || 'custom']}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="editorial-label">Gatilhos</div>
              <div className="editorial-serif text-sm text-[#ded4c1]">
                {card.keys.length > 0 ? card.keys.slice(0, 4).join(' · ') : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#090806]">
      <div className="editorial-topbar flex shrink-0 items-center justify-between px-5 sm:px-8">
        <div className="editorial-eyebrow">Enciclopédia</div>
        <label className="editorial-link flex cursor-pointer items-center gap-2">
          <Upload className="h-3.5 w-3.5" />
          Importar .md/.json
          <input type="file" accept=".md,.json,.txt" className="hidden" onChange={handleFile} />
        </label>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(300px,390px)_1fr]">
        <section className="min-h-0 overflow-y-auto border-[rgba(201,169,106,0.16)] px-5 py-8 sm:px-8 md:border-r">
          <div className="editorial-eyebrow">Acervo</div>
          <h1 className="editorial-page-title mt-3">Códice</h1>

          <div className="relative mt-7">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f6659]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar personagens, técnicas, lugares..."
              className="editorial-input pl-7"
              aria-label="Buscar no Códice"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[rgba(201,169,106,0.16)] pb-3">
            {(
              [
                ['all', 'Todos'],
                ['character', 'Personagens'],
                ['technique', 'Técnicas'],
                ['location', 'Lugares'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={
                  'font-sans text-[10px] uppercase tracking-[0.16em] transition-colors ' +
                  (filter === id
                    ? 'border-b border-[#c9a96a] pb-1 text-[#e6cfa2]'
                    : 'pb-1 text-[#837968] hover:text-[#ceb482]')
                }
              >
                {label}
              </button>
            ))}
            <span className="ml-auto font-sans text-[9px] uppercase tracking-[0.14em] text-[#6f6659]">
              {sorted.length} verbetes
            </span>
          </div>

          <div className="mt-2 divide-y divide-[rgba(255,255,255,0.06)]">
            {sorted.length === 0 && (
              <p className="editorial-muted py-8 font-sans text-xs">
                Nenhum verbete encontrado para essa busca.
              </p>
            )}
            {sorted.map((card) => {
              const active = selectedCard?.id === card.id;
              const { main, subtitle } = splitTitle(card.title);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleSelect(card)}
                  className={
                    'flex w-full items-start gap-3 px-2 py-4 text-left transition-colors ' +
                    (active ? 'bg-[rgba(201,169,106,0.06)]' : 'hover:bg-[rgba(201,169,106,0.035)]')
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="editorial-eyebrow text-[8px]">{TYPE_LABEL[card.type]}</div>
                    <div className="editorial-serif mt-1 line-clamp-2 text-[17px] leading-tight text-[#e7ddcb]">
                      {main}
                    </div>
                    <div className="editorial-muted mt-1 truncate font-sans text-[10px]">
                      {subtitle || cleanBody(card.value).replace(/\s+/g, ' ').slice(0, 90)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="hidden min-h-0 overflow-y-auto px-10 py-10 md:block">
          {selectedCard ? (
            renderDetail(selectedCard)
          ) : (
            <p className="editorial-muted font-sans text-xs">Selecione um verbete.</p>
          )}
        </section>
      </div>

      {mobileDetailOpen && selectedCard && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-[#090806] px-5 py-5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileDetailOpen(false)}
            className="editorial-link flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Códice
          </button>
          <div className="mt-8">{renderDetail(selectedCard, true)}</div>
        </div>
      )}
    </div>
  );
};
