import type { ShortcutCombo } from './shortcutRegistry';

export function isMacPlatform(): boolean {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav) return false;
  const uaPlatform = (nav as { userAgentData?: { platform?: string } }).userAgentData?.platform;
  return /mac/i.test(uaPlatform ?? nav.platform ?? nav.userAgent ?? '');
}

function keyGlyph(key: string): string {
  switch (key) {
    case 'ArrowUp': return '↑';
    case 'ArrowDown': return '↓';
    case 'ArrowLeft': return '←';
    case 'ArrowRight': return '→';
    case 'Escape': return 'Esc';
    case ' ': return 'Space';
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

export function formatCombo(combo: ShortcutCombo, isMac: boolean): string {
  if (!combo.mod && !combo.alt && !combo.shift && combo.key === '=') return '+ / =';

  const glyph = keyGlyph(combo.key);
  if (isMac) {
    let prefix = '';
    if (combo.alt) prefix += '⌥';
    if (combo.shift) prefix += '⇧';
    if (combo.mod) prefix += '⌘';
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
