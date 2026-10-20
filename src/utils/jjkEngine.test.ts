import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNarrativeBlocks,
  getDiceOutcomeInfo,
  selectActiveStoryCardsForTurn,
  parseJsonStoryCards,
  parseMarkdownCodex,
  resolveDomainTheme,
  applyNewInventoryItemOrVow,
} from './jjkEngine.ts';
import { INITIAL_STORY_CARDS, CANONICAL_TECHNIQUES } from '../data/initialCodex.ts';

test('parseNarrativeBlocks separates *Narrador*: and *Nome do Personagem*: blocks with quotes and actions', () => {
  const sample = `*Narrador*: A chuva cai pesada sobre o pátio da Escola Sugisawa enquanto a energia carmesim pulsa.\n\n*Satoru Gojo*: Ele abaixa levemente a venda preta, revelando o brilho azul incandescente dos Seis Olhos. "Ora, ora... parece que chegamos bem na hora da festa."`;

  const npcs = [
    {
      name: 'Satoru Gojo',
      grade: 'Grau Especial',
      hpPercentage: 100,
      status: 'Intacto',
      attitude: 'Aliado' as const,
      visualDescription: 'Gojo portrait',
    },
  ];

  const blocks = parseNarrativeBlocks(sample, npcs);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'narrator');
  assert.equal(blocks[0].speaker, 'Narrador');
  assert.ok(blocks[0].rawText.includes('Escola Sugisawa'));

  assert.equal(blocks[1].type, 'character');
  assert.equal(blocks[1].speaker, 'Satoru Gojo');
  assert.equal(blocks[1].npcMatch?.attitude, 'Aliado');
  assert.deepEqual(blocks[1].spokenQuotes, ['Ora, ora... parece que chegamos bem na hora da festa.']);
  assert.ok(blocks[1].actionText?.includes('venda preta'));
});

test('getDiceOutcomeInfo classifies 1, 2-9, 10-18, 19, and Natural 20 (Kokusen) accurately', () => {
  assert.equal(getDiceOutcomeInfo(1).tier, 'CRITICAL_FAIL');
  assert.equal(getDiceOutcomeInfo(5).tier, 'PARTIAL');
  assert.equal(getDiceOutcomeInfo(14).tier, 'SOLID');
  assert.equal(getDiceOutcomeInfo(19).tier, 'CRITICAL_HIT');
  assert.equal(getDiceOutcomeInfo(20).tier, 'BLACK_FLASH');
  assert.ok(getDiceOutcomeInfo(20).title.includes('KOKUSEN'));
});

test('selectActiveStoryCardsForTurn retrieves matching canonical Story Cards for RAG injection', () => {
  const active = selectActiveStoryCardsForTurn(
    INITIAL_STORY_CARDS,
    'Eu avanço com Megumi Fushiguro usando Dez Sombras contra Ryomen Sukuna tentando um Kokusen!',
    6
  );
  const titles = active.map((c) => c.title);
  assert.ok(titles.some((t) => t.includes('Megumi Fushiguro')));
  assert.ok(titles.some((t) => t.includes('Ryomen Sukuna')));
  assert.ok(titles.some((t) => t.includes('Kokusen')));
});

test('parseJsonStoryCards and parseMarkdownCodex parse external lorebooks accurately', () => {
  const jsonSample = JSON.stringify([
    {
      title: 'Hiromi Higuruma',
      keys: 'higuruma, sentença mortal, judas',
      type: 'character',
      value: 'Advogado prodígio despertado no Jogo do Abate.',
    },
  ]);
  const parsedJson = parseJsonStoryCards(jsonSample);
  assert.equal(parsedJson.length, 1);
  assert.equal(parsedJson[0].title, 'Hiromi Higuruma');
  assert.ok(parsedJson[0].keys.includes('higuruma'));

  const mdSample = `## Kinji Hakari — Febre da Aposta\nGatilhos: hakari, jackpot, trem privado\nFeiticeiro suspenso da Escola de Tóquio com Expansão de Domínio ligada a pachinko.\n---\n## Hajime Kashimo — Deus do Trovão\nGatilhos: kashimo, eletricidade, besta mítica âmbar\nFeiticeiro letal de 400 anos atrás.`;
  const parsedMd = parseMarkdownCodex(mdSample);
  assert.equal(parsedMd.length, 2);
  assert.ok(parsedMd[0].title.includes('Kinji Hakari'));
  assert.ok(parsedMd[0].keys.includes('jackpot'));
});

test('resolveDomainTheme identifies Curtain vs Domain Expansion visual themes', () => {
  const none = resolveDomainTheme('Nenhum');
  assert.equal(none.isDomainActive, false);
  assert.equal(none.isCurtainActive, false);

  const curtain = resolveDomainTheme('Cortina Ativa');
  assert.equal(curtain.isCurtainActive, true);
  assert.equal(curtain.isDomainActive, false);

  const sukunaDomain = resolveDomainTheme('Expansão de Domínio: Santuário Malevolente (Ryomen Sukuna)');
  assert.equal(sukunaDomain.isDomainActive, true);
  assert.ok(sukunaDomain.bannerTitle.includes('SANTUÁRIO MALEVOLENTE'));
});

test('applyNewInventoryItemOrVow adds binding vows and inventory items without duplicates', () => {
  const baseChar = {
    name: 'Ren',
    appearance: 'Sorcerer',
    avatarUrl: '',
    faction: 'Tóquio',
    clan: 'Zenin',
    grade: 'Grau 2',
    isHeavenlyRestriction: false,
    hpPercentage: 100,
    cursedEnergyPercentage: 100,
    outputPercentage: 100,
    physicalCondition: 'Intacto',
    techniqueState: 'Ativa' as const,
    inBlackFlashZone: false,
    technique: CANONICAL_TECHNIQUES[0],
    inventory: [],
    bindingVows: [],
  };

  const vowResult = applyNewInventoryItemOrVow(
    baseChar,
    'Voto Vinculativo: Hora Extra — +20% Output após as 18h'
  );
  assert.equal(vowResult.updatedCharacter.bindingVows.length, 1);
  assert.equal(vowResult.updatedCharacter.bindingVows[0].name, 'Hora Extra');

  const itemResult = applyNewInventoryItemOrVow(
    vowResult.updatedCharacter,
    'Dedo de Ryomen Sukuna (Grau Especial): Objeto amaldiçoado letal'
  );
  assert.equal(itemResult.updatedCharacter.inventory.length, 1);
  assert.ok(itemResult.updatedCharacter.inventory[0].name.includes('Dedo de Ryomen Sukuna'));
});
