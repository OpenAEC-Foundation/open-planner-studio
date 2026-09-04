// Resource-/taakkleurpalet (#21 punt 1-nieuw, ontwerpdoc 2026-08-14 §3). Eén vast, printvriendelijk
// palet voor twee doelen: (a) automatische kleurtoewijzing aan resources (B1/B7), (b) de automatische
// per-taak-regenboog (B6, modus 'auto'). PUUR: geen store-/React-imports — headless testbaar.
//
// Ontwerpeisen (vastgelegd in tests/planning/check-bar-colors.ts):
//  1. 12 kleuren, onderling onderscheidbaar ÓÓK in grijswaarden (elke kleur een eigen lichtheidsband
//     — zwart-wit laserprinters en grijswaarden-PDF-viewers bestaan echt op bouwplaatsen);
//  2. géén van de kleuren is de kritiek-roodtint van het printpalet ('#DC2626') — rood is gereserveerd
//     voor de rode rand om kritieke taken in de niet-critical kleurmodi (B5);
//  3. voldoende verzadiging om op een lichte printachtergrond te staan.
//
// De lichtheden lopen bewust sterk uiteen: band 1/12 breed per kleur.
import type { Resource } from '@/types/resource';

// Samengesteld op lichtheid (relatieve lichtheid via 0.2126R+0.7152G+0.0722B): twaalf tinten over
// het volle bereik ~0.16 … ~0.87, elk ≥ ~0.06 uit elkaar — 10 van de 12 lichtheidsbanden uniek
// (bewaakt door de check). Binnen een band verschilt de hue maximaal (grijs/rood/pink/oranje/
// teal/indigo/amber/violet/sky/green/geel/lime). Noot: red-700 (#B91C1C) is donkerder én
// duidelijk anders van tint dan critical-rood (#DC2626) — de rode kritiek-rand blijft leesbaar.
export const RESOURCE_PALETTE: readonly string[] = [
  '#1E293B', // 0  slate-800   (l ≈ 0.16)
  '#B91C1C', // 1  red-700     (l ≈ 0.24)
  '#DB2777', // 2  pink-600    (l ≈ 0.33)
  '#C2410C', // 3  orange-700  (l ≈ 0.35)
  '#6366F1', // 4  indigo-500  (l ≈ 0.44)
  '#0D9488', // 5  teal-600    (l ≈ 0.46)
  '#D97706', // 6  amber-600   (l ≈ 0.52)
  '#A78BFA', // 7  violet-400  (l ≈ 0.60)
  '#38BDF8', // 8  sky-400     (l ≈ 0.65)
  '#4ADE80', // 9  green-400   (l ≈ 0.72)
  '#FBBF24', // 10 amber-400   (l ≈ 0.76)
  '#BEF264', // 11 lime-300    (l ≈ 0.87)
];

/** Kleine, deterministische string-hash (FNV-1a, 32-bit) — geen cryptografie, wel stabiel op
 *  elke machine/run (B7): hetzelfde id krijgt altijd dezelfde kleur, ongeacht volgorde. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Weergavekleur voor een willekeurig id (resource of taak): hash → paletindex. Puur. */
export function paletteColorForId(id: string): string {
  return RESOURCE_PALETTE[hashId(id) % RESOURCE_PALETTE.length];
}

/**
 * De kleur waarin een resource getekend wordt: haar eigen, expliciet gekozen kleur als die er is,
 * anders de deterministische hash-fallback (B7). Muteert NOOIT de resource — kleurloze resources
 * blijven kleurloos in de data; de fallback is puur weergave. Zo werkt resource-kleuring direct
 * voor elk bestaand project zonder migratie of dirty-vlag.
 */
export function resourceDisplayColor(res: Pick<Resource, 'id' | 'color'>): string {
  return res.color || paletteColorForId(res.id);
}

/**
 * Eerste paletkleur die nog niet door een andere resource in gebruik is (B7, auto-toewijzing bij
 * aanmaak). Alles bezet → hergebruik cyclisch vanaf index 0 (palet is eindig; bij >12 resources
 * is een dubbel onvermijdbaar en is "voorspelbaar" belangrijker dan "uniek"). Vergelijkt de
 * DISPLAYkleur (eigen kleur òf hash), niet alleen het `color`-veld — twee resources waarvan de
 * ene expliciet de hash-kleur van de andere koos zijn visueel dezelfde, en dat is wat telt.
 */
export function nextFreePaletteColor(existing: ReadonlyArray<Pick<Resource, 'id' | 'color'>>): string {
  const used = new Set(existing.map(resourceDisplayColor));
  for (const c of RESOURCE_PALETTE) if (!used.has(c)) return c;
  return RESOURCE_PALETTE[0];
}

// --- Scherm-zichtbaarheid (donker thema) ---------------------------------------------------------
//
// Het palet is op PAPIER ontworpen: de donkere tinten (lichtheid tot ~0.16) zijn precies wat een
// grijswaarden-laserprint onderscheidbaar maakt. Op het DONKERE schermthema (werkruimte-achtergrond
// ≈ #0F172A, lichtheid ~0.06) vallen diezelfde tinten weg — gemeten: het slate-800-accent was
// vrijwel onzichtbaar. Daarom krijgt het SCHERM (niet de export — papier is licht en print blijft
// de exacte kleur) een verlichting: onder een minimale lichtheid wordt de tint in HSL-ruimte
// opgehoogd, met hue en verzadiging intact. Puur en deterministisch.

/** Relatieve lichtheid van een #rrggbb-hex (zelfde formule als de palet-check). */
function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Minimale scherm-lichtheid in het donkere thema — boven de werkruimte-achtergrond (~0.06) mét
 *  voldoendecontrast, onder de lichte palettinten zodat hue-identiteit behouden blijft. */
const DARK_THEME_MIN_LUMA = 0.34;

/** hex → {h, s, l} (h in graden, s/l in [0,1]). */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** {h, s, l} → #rrggbb. */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Scherm-variant van een resourcekleur: in het DONKERE thema worden te donkere tinten verlicht
 * naar {@link DARK_THEME_MIN_LUMA} (hue/verzadiging intact); in het lichte thema en voor al voldoende
 * lichte kleuren is dit de identieke kleur. De EXPORT gebruikt deze functie NIET — papier is licht,
 * daar blijft de exacte gekozen kleur staan.
 */
export function ensureThemeVisible(hex: string, dark: boolean): string {
  if (!dark || hexLuminance(hex) >= DARK_THEME_MIN_LUMA) return hex;
  const { h, s, l } = hexToHsl(hex);
  // L in HSL is niet dezelfde schaal als relatieve lichtheid; zoek deterministisch de L die de
  // minimum-lichtheid haalt (max ~10 stappen van 0.02 — convergeert altijd, want luma stijgt met L).
  let nl = l;
  for (let i = 0; i < 60 && hexLuminance(hslToHex(h, s, nl)) < DARK_THEME_MIN_LUMA; i++) nl = Math.min(1, nl + 0.02);
  return hslToHex(h, s, nl);
}
