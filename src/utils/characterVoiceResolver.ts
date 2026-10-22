import { CHARACTER_VOICE_GUIDES, type CharacterVoiceGuide } from '../data/characterVoices.ts';

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Encontra o guia de voz de um NPC canônico. Compara nome completo e aliases
 * (sem acento, caixa baixa); o match mais longo vence. NPC original devolve
 * undefined — a voz é construída pelo Mestre e mantida.
 */
export function findVoiceGuideForNpc(npcName: string): CharacterVoiceGuide | undefined {
  const target = normalizeName(npcName || '');
  if (!target) return undefined;
  let best: { guide: CharacterVoiceGuide; score: number } | undefined;
  for (const guide of CHARACTER_VOICE_GUIDES) {
    const candidates = [guide.name, ...guide.aliases].map(normalizeName).filter(Boolean);
    for (const candidate of candidates) {
      const matches =
        candidate === target || target.includes(candidate) || candidate.includes(target);
      if (matches && (!best || candidate.length > best.score)) {
        best = { guide, score: candidate.length };
      }
    }
  }
  return best?.guide;
}
