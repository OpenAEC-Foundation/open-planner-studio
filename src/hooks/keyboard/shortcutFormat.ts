// Platform-bewuste sneltoets-formattering (fase 2.10, golf 3) — puur presentatielaag voor de
// Ctrl/Cmd+/-overzichtsdialoog. Geen enkele afhandel-logica hier; alleen `ShortcutCombo` -> tekst.
import type { ShortcutCombo } from './shortcutRegistry';

/**
 * Runtime mac-detectie voor cosmetische toetsenbord-symbolen (⌘/⌥/⇧). Dit is BEWUST los van
 * `isTauri()`/`@tauri-apps/plugin-os` (die geven het OS van de desktopschil async) — de dialoog
 * moet synchroon renderen en werkt ook in de kale web-build, waar `navigator` de enige bron is.
 * `matchesCombo` in shortcutRegistry.ts blijft de bron van waarheid voor het WERKELIJKE gedrag
 * (e.ctrlKey || e.metaKey); dit hier bepaalt uitsluitend hoe we die combo weergeven.
 */
export function isMacPlatform(): boolean {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav) return false;
  // userAgentData is nog niet overal beschikbaar (o.a. Firefox/Safari) — platform blijft de
  // brede fallback, exact zoals `feedbackService.ts` al doet voor OS-detectie elders in de app.
  const uaPlatform = (nav as { userAgentData?: { platform?: string } }).userAgentData?.platform;
  return /mac/i.test(uaPlatform ?? nav.platform ?? nav.userAgent ?? '');
}

/** KeyboardEvent.key -> leesbaar glyph/label voor niet-letterlijke toetsen. */
function keyGlyph(key: string): string {
  switch (key) {
    case 'ArrowUp': return '↑';
    case 'ArrowDown': return '↓';
    case 'ArrowLeft': return '←';
    case 'ArrowRight': return '→';
    case 'Escape': return 'Esc';
    case ' ': return 'Space';
    default:
      // Enkel teken (letter/cijfer/symbool): toon in hoofdletter voor letters; cijfers/symbolen
      // ongewijzigd (bv. '/', '=', '-', '0'..'9'). Namen van meerdere tekens (Delete, Insert,
      // Backspace, Home, F2, F5, F11, ...) blijven zoals ze zijn — al leesbaar.
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/**
 * Formatteert één combo naar een korte toetsenbord-tekst.
 * mac: ⌥⇧⌘-symbolen direct voor de toets (Apple-conventie, geen '+').
 * win/linux: 'Ctrl+Shift+Alt+Toets'.
 *
 * Uitzondering: de "kale" zoom-combo zonder modifiers op de fysieke '='-toets matcht in
 * `useZoomShortcuts.ts` zowel '+' als '=' (zie shortcutRegistry.ts, `view.zoomIn`-alias) — dat kan
 * geen enkel los glyph eerlijk weergeven, dus expliciet "+ / =".
 */
export function formatCombo(combo: ShortcutCombo, isMac: boolean): string {
  if (!combo.mod && !combo.alt && !combo.shift && combo.key === '=') return '+ / =';

  const glyph = keyGlyph(combo.key);
  if (isMac) {
    let prefix = '';
    if (combo.alt) prefix += '⌥';   // ⌥ Option
    if (combo.shift) prefix += '⇧'; // ⇧ Shift
    if (combo.mod) prefix += '⌘';   // ⌘ Command
    return `${prefix}${glyph}`;
  }
  const parts: string[] = [];
  if (combo.mod) parts.push('Ctrl');
  if (combo.shift) parts.push('Shift');
  if (combo.alt) parts.push('Alt');
  parts.push(glyph);
  return parts.join('+');
}

function sameModifiers(a: ShortcutCombo, b: ShortcutCombo): boolean {
  return Boolean(a.mod) === Boolean(b.mod) && Boolean(a.alt) === Boolean(b.alt) && Boolean(a.shift) === Boolean(b.shift);
}

/**
 * Formatteert een GROEP combo's die dezelfde `labelKey` delen (aliassen, bv. `Alt+→` naast
 * `Alt+Shift+→`, of de negen `Ctrl+1..9`-documentwissels) naar één regel tekst.
 * - Aaneengesloten cijferreeks (1..9) met identieke modifiers -> compact bereik "Ctrl+1–9".
 * - Overige gevallen -> individuele combo's, gesorteerd op aantal modifiers (kaal eerst), met
 *   `orJoiner` ("of"/"or"/...) ertussen.
 */
export function formatComboGroup(combos: ShortcutCombo[], isMac: boolean, orJoiner: string): string {
  if (combos.length === 0) return '';

  if (combos.length >= 3) {
    const nums = combos.map(c => Number(c.key));
    const sameMods = combos.every(c => sameModifiers(c, combos[0]));
    if (sameMods && nums.every(n => Number.isInteger(n))) {
      const sorted = [...nums].sort((a, b) => a - b);
      const contiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
      if (contiguous) {
        const first = formatCombo({ ...combos[0], key: String(sorted[0]) }, isMac);
        const last = keyGlyph(String(sorted[sorted.length - 1]));
        return `${first}–${last}`;
      }
    }
  }

  const modifierWeight = (c: ShortcutCombo) => Number(Boolean(c.mod)) + Number(Boolean(c.alt)) + Number(Boolean(c.shift));
  const sorted = [...combos].sort((a, b) => modifierWeight(a) - modifierWeight(b));

  // Ontdubbel identieke weergaven (bv. twee combo's die toevallig hetzelfde formatteren).
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const c of sorted) {
    const label = formatCombo(c, isMac);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels.join(` ${orJoiner} `);
}
