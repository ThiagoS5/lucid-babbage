import type { CharacterVoiceGuide } from '@/entities/character/data/characterVoices';
import { findVoiceGuideForNpc } from '@/shared/lib/characterVoiceResolver';

/**
 * Converte um guia de voz no texto consumido pelo Mestre. Cada campo existe
 * para impedir um deslize de interpretação: diccao define o como, os tiques
 * e as falas de referencia definem o tom, e "nunca diria" fecha a fronteira
 * anti-OOC.
 */
export function renderVoiceGuideContent(guide: CharacterVoiceGuide): string {
  const lines: string[] = [];
  lines.push(`- ${guide.name}`);
  lines.push(`  Dicção: ${guide.diction}`);
  if (guide.register) lines.push(`  Registro: ${guide.register}`);
  if (guide.underPressure) lines.push(`  Sob pressão: ${guide.underPressure}`);
  if (guide.humor) lines.push(`  Humor: ${guide.humor}`);
  if (guide.verbalTics.length > 0) {
    lines.push(`  Tiques verbais: ${guide.verbalTics.join(' | ')}`);
  }
  if (guide.neverSays.length > 0) {
    lines.push(`  NUNCA diria: ${guide.neverSays.join(' | ')}`);
  }
  if (guide.sampleLines.length > 0) {
    lines.push(`  Falas de referência (reproduza o TOM, nunca o texto literal):`);
    for (const line of guide.sampleLines) lines.push(`    ${line}`);
  }
  if (guide.sceneBehavior) lines.push(`  Comportamento em cena: ${guide.sceneBehavior}`);
  return lines.join('\n');
}

/**
 * Bloco VOZES CANÔNICAS injetado no prompt do Mestre. Só entra quando há NPCs
 * canônicos em cena — e nunca inclui NPCs originais, cuja voz é construída
 * pelo Mestre e mantida ao longo da campanha.
 */
export function renderCanonicalVoices(npcNames: string[]): string {
  const seen = new Set<string>();
  const contents: string[] = [];

  for (const rawName of npcNames || []) {
    const guide = findVoiceGuideForNpc(rawName);
    if (!guide || seen.has(guide.id)) continue;
    seen.add(guide.id);
    contents.push(renderVoiceGuideContent(guide));
  }

  if (contents.length === 0) return '';

  return [
    '=== VOZES CANÔNICAS (OBRIGATÓRIO — OS NPCs EM CENA FALAM ASSIM) ===',
    'Cada personagem abaixo tem uma dicção própria e intransferível. Escreva as falas',
    'deles nesse tom exato: mesmo ritmo, mesmo vocabulário, mesmo tipo de humor.',
    'Nenhum NPC canônico pode falar como outro, nem como o Narrador.',
    '',
    ...contents,
    '',
  ].join('\n');
}
