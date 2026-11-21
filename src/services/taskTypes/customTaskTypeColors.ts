// Kleur van een eigen werksoort (issue #856, besluit Ethan 21 november 2026): een werksoort krijgt één
// keer een kleur die nog niet in gebruik is, en die kleur blijft bij haar (bibliotheek, IFC-bestand).
// Puur, zonder opslag.
//
// Een definitie zonder geldige kleur (een oud bestand, een andere schrijver, een import, een oude
// bibliotheek) krijgt de eerste vrije kleur. De ontbrekende kleuren gaan op volgorde van id, dus
// hetzelfde bestand geeft bij elk openen dezelfde kleuren, ongeacht de volgorde van de catalogus.
import { BUILTIN_TASK_TYPE_COLORS, CUSTOM_TASK_TYPE_COLOR_ORDER } from '@/engine/renderer/resourcePalette';
import type { CustomTaskType, CustomTaskTypeDraft } from '@/types/taskType';

/** Een bewaarde werksoortkleur is `#RRGGBB`. Iets anders telt als geen kleur. */
export function isTaskTypeColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** De eerste kleur die nog niet in gebruik is. De kleuren van de vaste werkcategorieën tellen altijd als in gebruik,
 *  ook als geen taak ze nu heeft. Na de vaste reeks (`CUSTOM_TASK_TYPE_COLOR_ORDER`) volgt een onbegrensde reeks
 *  berekende tinten, dus een nieuwe werksoort deelt nooit een kleur (review ronde 3 van optie 2 op #952). */
export function freeTaskTypeColor(taken: Iterable<string>): string {
  const used = new Set([...BUILTIN_TASK_TYPE_COLORS, ...taken].map(color => color.toUpperCase()));
  const fixed = CUSTOM_TASK_TYPE_COLOR_ORDER.find(color => !used.has(color));
  if (fixed) return fixed;
  for (let i = 0; ; i++) {
    const color = generatedColor(i);
    if (color && !used.has(color)) return color;
  }
}

/** Tint `i` van de berekende reeks: de gulden hoek over de kleurcirkel, in drie lichtheden. Tinten bij rood slaan we
 *  over (`undefined`), want die lijken op de balk van een kritieke taak. */
function generatedColor(i: number): string | undefined {
  const hue = (25 + i * 137.508) % 360;
  if (hue < 15 || hue > 345) return undefined;
  const s = 0.65, l = [0.42, 0.55, 0.32][i % 3];
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

/** `drafts` met een kleur per definitie. Een geldige kleur blijft precies zoals ze is; een ontbrekende
 *  wordt de eerste vrije kleur naast de kleuren in `drafts` en in `context`. Volgorde blijft gelijk. */
export function withTaskTypeColors(
  drafts: readonly CustomTaskTypeDraft[],
  context: readonly CustomTaskType[] = [],
): CustomTaskType[] {
  const taken = [...context, ...drafts].map(type => type.color).filter(isTaskTypeColor);
  const assigned = new Map<string, string>();
  for (const draft of [...drafts].filter(type => !isTaskTypeColor(type.color)).sort((a, b) => compareIds(a.id, b.id))) {
    const color = freeTaskTypeColor(taken);
    taken.push(color);
    assigned.set(draft.id, color);
  }
  return drafts.map(({ id, name, color }) => ({ id, name, color: isTaskTypeColor(color) ? color : assigned.get(id)! }));
}

/** Brondefinities van `OPS_TaskTypes` met de kleur die het openen gaf erbij, voor wie er geen had (`opened`: de lezing van
 *  dezelfde bron). Alleen een ontbrekend `color` wordt aangevuld; id, naam, een bestaande kleur en elk ander veld blijven
 *  zoals in de bron. Voor de verliescontrole van IFC met vreemde inhoud: zo telt een bron van vóór het veld als gelijk aan
 *  wat de writer schrijft, zolang alleen de kleur van het openen erbij kwam. */
export function withOpenedColors(definitions: unknown, opened: readonly CustomTaskType[]): unknown {
  if (!Array.isArray(definitions)) return definitions;
  const color = new Map(opened.map(type => [type.id, type.color]));
  return definitions.map((definition: unknown) => {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition) || 'color' in definition) return definition;
    const id = (definition as { id?: unknown }).id;
    const added = typeof id === 'string' ? color.get(id.trim()) : undefined;
    return added ? { ...definition, color: added } : definition;
  });
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
