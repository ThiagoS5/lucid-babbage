/**
 * Portrait & Scene Artwork Resolver for Jujutsu Kaisen: Cursed Chronicles.
 *
 * 1. Canonical Jujutsu Kaisen characters resolve directly to:
 *    - The 5 ArtStation portraits (/portraits/artstation/*.png) for Kento Nanami, Ryomen Sukuna, Satoru Gojo, Choso, and Suguru Geto.
 *    - The 318 Fandom Wiki portraits (/portraits/wiki/*.png) for all other canonical characters (e.g. /portraits/wiki/AoiP.png for Aoi Todo).
 * 2. Exclusive Narrative Characters (original NPCs, curses, shikigami, managers, or custom sorcerers created during narration)
 *    receive a deterministic, archetype-specific anime SVG portrait so every speaker in the story has a unique visual identity.
 */

import { resolveCanonicalPortraitUrl } from '../data/characterPortraits';

function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Generates a rich, deterministic generic anime portrait for Exclusive Narrative Characters
 * (non-canonical NPCs, custom Cursed Spirits, Curse Users, Shikigami, Civilians, or Player OCs).
 */
function generateExclusiveNarrativePortraitSvg(
  name: string,
  roleOrContext: string = ''
): string {
  const combined = `${name} ${roleOrContext}`.toLowerCase();
  const h = hashString(name.trim().toLowerCase() || 'exclusive-npc');
  const initials = name
    .replace(/\*+/g, '')
    .split(/[\s—–\-()]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  // Archetype 1: Exclusive Cursed Spirit / Maldição
  const isCursedSpirit =
    combined.includes('maldiç') ||
    combined.includes('maldic') ||
    combined.includes('espírito') ||
    combined.includes('espirito') ||
    combined.includes('curse') ||
    combined.includes('portador') ||
    combined.includes('aberraç') ||
    combined.includes('feto');

  if (isCursedSpirit) {
    const cursePalettes = [
      { aura: '#e11d48', secondary: '#7c3aed', skin: '#2a1829', eye: '#facc15' },
      { aura: '#9333ea', secondary: '#db2777', skin: '#1e1b2e', eye: '#f43f5e' },
      { aura: '#10b981', secondary: '#047857', skin: '#132620', eye: '#fbbf24' },
      { aura: '#f97316', secondary: '#dc2626', skin: '#291715', eye: '#38bdf8' },
    ];
    const pal = cursePalettes[h % cursePalettes.length];
    const eyeCount = 2 + (h % 3); // 2 to 4 eyes

    return toSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <defs>
          <radialGradient id="curseAura_${h % 99}" cx="50%" cy="48%" r="58%">
            <stop offset="0%" stop-color="${pal.aura}" stop-opacity="0.6"/>
            <stop offset="55%" stop-color="${pal.secondary}" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#050508" stop-opacity="1"/>
          </radialGradient>
        </defs>
        <rect width="400" height="400" fill="#050508"/>
        <circle cx="200" cy="195" r="185" fill="url(#curseAura_${h % 99})"/>
        <!-- Cursed miasma tendrils -->
        <path d="M40 380 Q90 250 55 130 Q115 210 125 380 Z" fill="${pal.secondary}" opacity="0.25"/>
        <path d="M360 380 Q310 250 345 120 Q285 210 275 380 Z" fill="${pal.aura}" opacity="0.25"/>
        <!-- Monstrous Shoulders & Chitin/Muscle Silhouette -->
        <path d="M50 400 L95 265 L155 240 L245 240 L305 265 L350 400 Z" fill="#0f0914" stroke="${pal.aura}" stroke-width="2" stroke-opacity="0.6"/>
        <!-- Horned / Distorted Head -->
        <path d="M125 140 L95 65 L155 110 L200 70 L245 110 L305 65 L275 140 Z" fill="#181021" stroke="${pal.aura}" stroke-width="2"/>
        <path d="M135 135 Q132 250 200 265 Q268 250 265 135 Z" fill="${pal.skin}" stroke="${pal.aura}" stroke-width="1.8"/>
        <!-- Multiple Cursed Eyes -->
        <ellipse cx="168" cy="168" rx="16" ry="8" fill="${pal.eye}"/>
        <circle cx="168" cy="168" r="4" fill="#050508"/>
        <ellipse cx="232" cy="168" rx="16" ry="8" fill="${pal.eye}"/>
        <circle cx="232" cy="168" r="4" fill="#050508"/>
        ${
          eyeCount >= 3
            ? `<ellipse cx="200" cy="142" rx="13" ry="6" fill="${pal.aura}"/><circle cx="200" cy="142" r="3" fill="#fff"/>`
            : ''
        }
        ${
          eyeCount >= 4
            ? `<ellipse cx="165" cy="195" rx="10" ry="4" fill="${pal.eye}" opacity="0.85"/><ellipse cx="235" cy="195" rx="10" ry="4" fill="${pal.eye}" opacity="0.85"/>`
            : ''
        }
        <!-- Jagged Maw -->
        <path d="M158 218 L172 230 L186 216 L200 232 L214 216 L228 230 L242 218" fill="none" stroke="${pal.aura}" stroke-width="3.5" stroke-linecap="round"/>
        <!-- Exclusive Badge -->
        <rect x="14" y="14" width="94" height="24" rx="6" fill="#09090b" fill-opacity="0.85" stroke="${pal.aura}" stroke-width="1.2"/>
        <text x="61" y="30" text-anchor="middle" fill="${pal.aura}" font-family="sans-serif" font-size="11" font-weight="bold">MALDIÇÃO</text>
      </svg>
    `);
  }

  // Archetype 2: Shikigami / Invocação
  const isShikigami =
    combined.includes('shikigami') ||
    combined.includes('invoca') ||
    combined.includes('nue') ||
    combined.includes('cão divino') ||
    combined.includes('serpente');

  if (isShikigami) {
    return toSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <defs>
          <radialGradient id="shikiAura_${h % 99}" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.5"/>
            <stop offset="60%" stop-color="#1e1b4b" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#050508" stop-opacity="1"/>
          </radialGradient>
        </defs>
        <rect width="400" height="400" fill="#050508"/>
        <circle cx="200" cy="200" r="180" fill="url(#shikiAura_${h % 99})"/>
        <circle cx="200" cy="200" r="145" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="10 6" opacity="0.5"/>
        <path d="M90 380 L135 230 L115 110 L175 155 L200 85 L225 155 L285 110 L265 230 L310 380 Z" fill="#0b1120" stroke="#38bdf8" stroke-width="2.2"/>
        <polygon points="155,185 188,192 175,205" fill="#38bdf8"/>
        <polygon points="245,185 212,192 225,205" fill="#38bdf8"/>
        <path d="M185 145 L200 125 L215 145 L200 165 Z" fill="none" stroke="#f59e0b" stroke-width="2.5"/>
        <rect x="14" y="14" width="98" height="24" rx="6" fill="#09090b" fill-opacity="0.85" stroke="#38bdf8" stroke-width="1.2"/>
        <text x="63" y="30" text-anchor="middle" fill="#38bdf8" font-family="sans-serif" font-size="11" font-weight="bold">SHIKIGAMI</text>
      </svg>
    `);
  }

  // Archetype 3: Auxiliary Manager / Civilian / Window Supervisor
  const isManagerOrCivilian =
    combined.includes('gerente') ||
    combined.includes('auxiliar') ||
    combined.includes('civil') ||
    combined.includes('médic') ||
    combined.includes('supervisor') ||
    combined.includes('estudante comum');

  if (isManagerOrCivilian) {
    return toSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <rect width="400" height="400" fill="#08090e"/>
        <circle cx="200" cy="195" r="165" fill="#1e293b" opacity="0.45"/>
        <!-- Formal Suit & Tie -->
        <path d="M75 400 L115 275 L200 305 L285 275 L325 400 Z" fill="#0f172a" stroke="#475569" stroke-width="2"/>
        <polygon points="192,285 208,285 205,365 200,378 195,365" fill="#38bdf8" opacity="0.8"/>
        <!-- Head -->
        <path d="M148 148 Q148 236 200 248 Q252 236 252 148 Z" fill="#f1dca7"/>
        <!-- Neat Hair -->
        <path d="M140 160 Q145 100 200 100 Q255 100 260 160 Q200 130 140 160 Z" fill="#1e293b"/>
        <!-- Glasses -->
        <rect x="156" y="166" width="34" height="18" rx="3" fill="none" stroke="#94a3b8" stroke-width="2.5"/>
        <rect x="210" y="166" width="34" height="18" rx="3" fill="none" stroke="#94a3b8" stroke-width="2.5"/>
        <line x1="190" y1="175" x2="210" y2="175" stroke="#94a3b8" stroke-width="2"/>
        <path d="M186 216 L214 216" stroke="#475569" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="14" y="14" width="76" height="24" rx="6" fill="#09090b" fill-opacity="0.85" stroke="#94a3b8" stroke-width="1.2"/>
        <text x="52" y="30" text-anchor="middle" fill="#cbd5e1" font-family="sans-serif" font-size="11" font-weight="bold">${initials || 'NPC'}</text>
      </svg>
    `);
  }

  // Archetype 4: Exclusive Sorcerer or Curse User (with deterministic hair, aura & scar variations)
  const isHostileUser =
    combined.includes('hostil') ||
    combined.includes('usuário de maldi') ||
    combined.includes('usuario de maldi') ||
    combined.includes('mercenári') ||
    combined.includes('assassino') ||
    combined.includes('inimigo');

  const palettes = isHostileUser
    ? [
        { primary: '#f43f5e', secondary: '#881337', hair: '#18181b' },
        { primary: '#a855f7', secondary: '#4c1d95', hair: '#31102f' },
        { primary: '#fb7185', secondary: '#9f1239', hair: '#cbd5e1' },
      ]
    : [
        { primary: '#38bdf8', secondary: '#1d4ed8', hair: '#0f172a' },
        { primary: '#818cf8', secondary: '#4338ca', hair: '#1e293b' },
        { primary: '#34d399', secondary: '#047857', hair: '#1e1b4b' },
        { primary: '#f59e0b', secondary: '#b45309', hair: '#27272a' },
      ];

  const pal = palettes[h % palettes.length];
  const hasScar = h % 2 === 0;
  const hasHighCollar = h % 3 !== 0;

  return toSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <radialGradient id="sorcAura_${h % 99}" cx="50%" cy="48%" r="56%">
          <stop offset="0%" stop-color="${pal.primary}" stop-opacity="0.48"/>
          <stop offset="60%" stop-color="${pal.secondary}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#07070a" stop-opacity="1"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="#07070a"/>
      <circle cx="200" cy="195" r="178" fill="url(#sorcAura_${h % 99})"/>
      <!-- Jujutsu Uniform -->
      <path d="M68 400 L110 272 L158 248 L242 248 L290 272 L332 400 Z" fill="#0c101c" stroke="${pal.primary}" stroke-width="1.8" stroke-opacity="0.6"/>
      ${
        hasHighCollar
          ? `<path d="M138 278 L150 212 L250 212 L262 278 Z" fill="#111626" stroke="${pal.primary}" stroke-width="1.2" stroke-opacity="0.45"/>`
          : ''
      }
      <!-- Jujutsu High Golden Swirl Button -->
      <circle cx="228" cy="296" r="7" fill="#f59e0b"/>
      <!-- Face -->
      <path d="M145 145 Q145 236 200 248 Q255 236 255 145 Z" fill="#f3dfc8"/>
      ${
        hasScar
          ? `<path d="M162 152 L176 196" stroke="#9f1239" stroke-width="2" opacity="0.65"/>`
          : ''
      }
      <!-- Dynamic Anime Hair -->
      <path d="M126 158 L108 98 L150 116 L162 64 L200 102 L238 62 L250 116 L292 98 L274 158 Q200 124 126 158 Z" fill="${pal.hair}" stroke="${pal.primary}" stroke-width="1.5" stroke-opacity="0.65"/>
      <!-- Glowing Anime Eyes -->
      <polygon points="158,172 186,174 180,182 155,178" fill="${pal.primary}"/>
      <polygon points="242,172 214,174 220,182 245,178" fill="${pal.primary}"/>
      <!-- Expression -->
      <path d="M184 215 L216 213" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Cursed Energy Sparks -->
      <path d="M52 140 L86 168 L70 194 L106 224" fill="none" stroke="${pal.primary}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M348 132 L314 164 L330 190 L294 220" fill="none" stroke="${pal.primary}" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Initials Tag -->
      <rect x="14" y="14" width="66" height="24" rx="6" fill="#09090b" fill-opacity="0.82" stroke="${pal.primary}" stroke-width="1.2"/>
      <text x="47" y="30" text-anchor="middle" fill="${pal.primary}" font-family="sans-serif" font-size="11" font-weight="bold">${initials || 'JJK'}</text>
    </svg>
  `);
}

/**
 * Resolves a character portrait:
 * - First checks the 5 ArtStation portraits (Nanami, Sukuna, Gojo, Choso, Geto)
 *   and all 318 downloaded Jujutsu Kaisen Fandom Wiki portraits (e.g. AoiP.png for Aoi Todo).
 * - If the character is exclusive to the narration (or a custom player OC), generates
 *   a deterministic generic anime portrait tailored to their archetype.
 */
export function generateCanonicalPortraitSvg(
  nameOrPrompt: string,
  roleOrContext: string = ''
): string {
  const canonicalUrl = resolveCanonicalPortraitUrl(nameOrPrompt);
  if (canonicalUrl) {
    return canonicalUrl;
  }
  return generateExclusiveNarrativePortraitSvg(nameOrPrompt, roleOrContext);
}

export function generateSceneIllustrationSvg(promptOrContext: string, visualEffect?: string): string {
  const lower = promptOrContext.toLowerCase();
  const isDomain =
    visualEffect === 'DOMAIN_EXPANSION' ||
    visualEffect?.startsWith('DOMAIN_') ||
    lower.includes('domínio') ||
    lower.includes('domain') ||
    lower.includes('santuário') ||
    lower.includes('vazio');
  const isBlackFlash =
    visualEffect === 'BLACK_FLASH' ||
    lower.includes('kokusen') ||
    lower.includes('black flash') ||
    lower.includes('faísca negra');
  const isShibuya = lower.includes('shibuya') || lower.includes('estação') || lower.includes('cortina');

  const accentPrimary = isBlackFlash
    ? '#e11d48'
    : isDomain
    ? '#a855f7'
    : isShibuya
    ? '#f43f5e'
    : '#38bdf8';

  const accentSecondary = isBlackFlash
    ? '#000000'
    : isDomain
    ? '#e11d48'
    : '#2563eb';

  return toSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#050508"/>
          <stop offset="55%" stop-color="#0d0e18"/>
          <stop offset="100%" stop-color="#141122"/>
        </linearGradient>
        <radialGradient id="moonGlow" cx="72%" cy="28%" r="38%">
          <stop offset="0%" stop-color="${accentPrimary}" stop-opacity="0.55"/>
          <stop offset="45%" stop-color="${accentSecondary}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#07070a" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="groundMist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accentPrimary}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${accentPrimary}" stop-opacity="0.25"/>
        </linearGradient>
      </defs>

      <!-- Abyssal Night Sky -->
      <rect width="1280" height="720" fill="url(#skyGrad)"/>
      <circle cx="920" cy="200" r="340" fill="url(#moonGlow)"/>

      <!-- Crimson / Spiritual Moon or Domain Sphere -->
      <circle cx="920" cy="200" r="88" fill="${accentPrimary}" opacity="0.22"/>
      <circle cx="920" cy="200" r="68" fill="none" stroke="${accentPrimary}" stroke-width="2.5" opacity="0.7"/>
      <circle cx="920" cy="200" r="115" fill="none" stroke="${accentPrimary}" stroke-width="1" stroke-dasharray="12 8" opacity="0.45"/>

      <!-- Traditional Torii & Urban Tokyo Skyline Silhouette -->
      <rect x="60" y="280" width="95" height="440" fill="#08090f"/>
      <rect x="175" y="220" width="120" height="500" fill="#0a0c14"/>
      <rect x="320" y="310" width="85" height="410" fill="#08090f"/>
      <rect x="1020" y="250" width="130" height="470" fill="#090b12"/>
      <rect x="1165" y="190" width="90" height="530" fill="#07080d"/>

      <!-- Torii / Shrine Architecture in Midground -->
      <path d="M450 265 Q640 240 830 265 L815 288 Q640 268 465 288 Z" fill="#12131f" stroke="${accentPrimary}" stroke-width="1.5" stroke-opacity="0.5"/>
      <rect x="495" y="315" width="290" height="16" fill="#12131f"/>
      <rect x="525" y="282" width="22" height="360" fill="#0e101a"/>
      <rect x="733" y="282" width="22" height="360" fill="#0e101a"/>

      <!-- Perspective Ground Grid -->
      <path d="M0 580 L1280 580 L1280 720 L0 720 Z" fill="#060609"/>
      <rect x="0" y="480" width="1280" height="240" fill="url(#groundMist)"/>
      <line x1="0" y1="580" x2="1280" y2="580" stroke="${accentPrimary}" stroke-width="1.5" opacity="0.4"/>

      <!-- Sorcerer Silhouette & Cursed Energy Clash -->
      <path d="M595 620 L620 465 L665 465 L690 620 Z" fill="#050508" stroke="${accentPrimary}" stroke-width="2"/>
      <circle cx="642" cy="435" r="20" fill="#050508" stroke="${accentPrimary}" stroke-width="2"/>

      <!-- Dynamic Cursed Energy Lightning Bolts -->
      <path d="M240 120 L420 290 L380 330 L590 480" fill="none" stroke="${accentPrimary}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
      <path d="M1060 95 L850 285 L895 320 L690 475" fill="none" stroke="#e11d48" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
      <path d="M510 520 Q640 370 770 520" fill="none" stroke="${accentPrimary}" stroke-width="3" stroke-dasharray="8 6" opacity="0.65"/>
    </svg>
  `);
}
