export type DurationSlot = 'duur' | 'werkelijk' | 'rest' | 'speling' | 'lag-werktijd' | 'lag-kalendertijd' | 'lag-oud';

export interface DurationForm {
  readonly name: string;
  readonly pattern: RegExp;
  readonly slots: readonly DurationSlot[];
  readonly writer: string;
  readonly exact?: (m: RegExpExecArray) => boolean;
}

const JS_NUMBER = '\\d+(?:\\.\\d+)?(?:e[-+]\\d+)?';
const TIME_PART = 'T(?=\\d)(?:(\\d+(?:\\.\\d+)?)H)?(?:(\\d+)M)?(?:(\\d+)S)?';

function wholeMinutes(hours: string | undefined, seconds: string | undefined): boolean {
  if (hours?.includes('.')) {
    const fraction = hours.split('.')[1];
    if (BigInt(fraction) * 60n % 10n ** BigInt(fraction.length) !== 0n) return false;
  }
  return seconds === undefined || BigInt(seconds) % 60n === 0n;
}

const TASK: readonly DurationSlot[] = ['duur', 'werkelijk', 'rest'];
const LAG: readonly DurationSlot[] = ['lag-werktijd', 'lag-kalendertijd'];

export const DURATION_FORMS: readonly DurationForm[] = [
  {
    name: 'dagen-P0Y0M',
    pattern: new RegExp(`^P0Y0M(${JS_NUMBER})D$`),
    slots: [...TASK, 'speling', 'lag-oud'],
    writer: 'OPS, alle versies sinds v0.1.0 (`7eac06470`): taaktijd en speling; de oude lag tot `b1a8cb52c`',
  },
  {
    name: 'dagen-P0Y0M-teken-bij-getal',
    pattern: new RegExp(`^P0Y0M-(${JS_NUMBER})D$`),
    slots: ['speling', 'lag-oud'],
    writer: 'OPS tot `df4214945` (v2026.9.0 en ouder): een negatieve speling; de oude lag met teken (`62df7d3d5`)',
  },
  {
    name: 'dagen-min-P0Y0M',
    pattern: new RegExp(`^-P0Y0M(${JS_NUMBER})D$`),
    slots: ['speling'],
    writer: 'OPS sinds `df4214945` (13 oktober 2026): een negatieve speling',
  },
  {
    name: 'dagen-P',
    pattern: new RegExp(`^P(${JS_NUMBER})D$`),
    slots: [...TASK, 'speling', ...LAG, 'lag-oud'],
    writer: 'OPS sinds `b1a8cb52c` (2 juli 2026): de lag (`IFCDURATION`); elders een ander programma (`P5D`)',
  },
  {
    name: 'dagen-min-P',
    pattern: new RegExp(`^-P(${JS_NUMBER})D$`),
    slots: ['speling', ...LAG, 'lag-oud'],
    writer: 'OPS sinds `b1a8cb52c`: een negatieve lag (`IFCDURATION`); elders een ander programma',
  },
  {
    name: 'minuten-OPS',
    pattern: /^PT(\d+)H(\d+)M0S$/,
    slots: [...TASK, ...LAG],
    writer: 'OPS sinds `0710c0795` (6 juli 2026, `minutesToIsoDuration`): urentaak, lag in uren; sinds `cbde9d4e7` ook een breuk in dagen',
  },
  {
    name: 'minuten-OPS-min',
    pattern: /^-PT(\d+)H(\d+)M0S$/,
    slots: LAG,
    writer: 'OPS sinds `0710c0795`: een negatieve lag in uren',
  },
  {
    name: 'tijd-hele-minuten',
    pattern: new RegExp(`^P${TIME_PART}$`),
    exact: (m) => wholeMinutes(m[1], m[3]),
    slots: [...TASK, ...LAG],
    writer: 'een ander programma (`PT12H`, `PT90M`, `PT0.5H`, `PT3600S`)',
  },
  {
    name: 'tijd-hele-minuten-min',
    pattern: new RegExp(`^-P${TIME_PART}$`),
    exact: (m) => wholeMinutes(m[1], m[3]),
    slots: LAG,
    writer: 'een ander programma: een negatieve lag (`-PT2H`)',
  },
  {
    name: 'dagen-en-tijd',
    pattern: new RegExp(`^P(\\d+)D${TIME_PART}$`),
    exact: (m) => wholeMinutes(m[2], m[4]),
    slots: [...TASK, 'lag-kalendertijd'],
    writer: 'een ander programma (`P2DT12H`); de lezer telt de dagen sinds #871 (`9ee06bb71`)',
  },
];

export function durationForm(text: string, slot: DurationSlot): DurationForm | undefined {
  for (const form of DURATION_FORMS) {
    if (!form.slots.includes(slot)) continue;
    const m = form.pattern.exec(text);
    if (m && (!form.exact || form.exact(m))) return form;
  }
  return undefined;
}

export const DURATION_SLOT_LABEL: Readonly<Record<DurationSlot, string>> = {
  duur: 'de duur',
  werkelijk: 'de werkelijke duur',
  rest: 'de restduur',
  speling: 'de speling',
  'lag-werktijd': 'de lag in werktijd',
  'lag-kalendertijd': 'de lag in kalendertijd',
  'lag-oud': 'de lag in de oude vorm',
};
