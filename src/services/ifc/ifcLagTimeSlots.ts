export type LagValueSlot =
  | { readonly kind: 'ratio' | 'duur' | 'tekst'; readonly arg: 3; readonly text: string }
  | { readonly kind: 'oud'; readonly arg: 4; readonly text: string };

export const LAG_SLOT = { ratio: 'ratio', duur: 'duur', tekst: 'tekst', oud: 'oud' } as const satisfies Record<LagValueSlot['kind'], LagValueSlot['kind']>;

export function lagValueSlot(args: readonly string[]): LagValueSlot {
  const lagValue = (args[3] || '').trim();
  const ratio = lagValue.match(/^IFCRATIOMEASURE\s*\(\s*(-?[\d.]+(?:E[+-]?\d+)?)\s*\)$/i);
  if (ratio) return { kind: 'ratio', arg: 3, text: ratio[1] };
  const duration = lagValue.match(/^IFCDURATION\s*\(\s*(.+?)\s*\)$/i);
  if (duration) return { kind: 'duur', arg: 3, text: duration[1] };
  if (lagValue.startsWith("'")) return { kind: 'tekst', arg: 3, text: lagValue };
  return { kind: 'oud', arg: 4, text: args[4] || '' };
}
