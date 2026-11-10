/**
 * De duurvormen die de merge laat staan: één lijst, per vorm een naam, de slots waarin de lezer hem exact leest, en
 * wie hem schrijft (#804 fase 1b, fixronde 6; bijsturing van Trias, 10 november 2026).
 *
 * De regel is omgekeerd ten opzichte van fixronde 4 tot en met 5b: een duur die de lezer leest, mag alleen blijven als
 * hij in deze lijst staat. Al het andere weigert de merge als `duur-deels-gelezen` ("bij twijfel weigeren"). Vijf rondes
 * lang vond de review telkens een nieuwe vorm die de lezer anders leest dan de tekst zegt (dagen vóór `T`, STEP-codering,
 * een komma, de speling, de lag, de oude lagvorm, een minteken in het tijddeel, seconden). Een lijst van vormen die mogen,
 * mist er geen.
 *
 * Elke vorm hier heeft in `tests/planning/check-ifc-duurvormen.ts` per slot een test die bewijst dat de lezer hem exact
 * leest: de waarde na openen is de waarde die de tekst zegt. Elke vorm die OPS zelf ooit schreef, ook vóór `771db15cb`,
 * staat erin (de kolom `writer`); een planning die OPS maakte, weigert dus nooit om een duur. Een vorm erbij zetten (na een
 * fix in de lezer) kan alleen samen met zo'n test: de check faalt bij een vorm of slot zonder voorbeeld.
 *
 * De vormen zijn strikte vormherkenning op de tekst zoals de lezer haar ziet (na de STEP-decodering), geen tweede
 * duurparser: de waarde zelf leest alleen de lezer. Twee vormen hebben een voorwaarde op de getallen: het tijddeel moet
 * op een hele minuut vallen, want `isoDurationToMinutes` (`subdayIo.ts`) rondt af (`PT90S` wordt 2 minuten, knownbug
 * 1035).
 */

/**
 * Een duurslot, met de lezer van dat slot (`ifcReader.ts`):
 *  - `duur`, `werkelijk`, `rest`: `ScheduleDuration`, `ActualDuration` en `RemainingTime` van een `IfcTaskTime`. Zonder
 *    `T` leest `parseDurationDays` de dagen; met `T` leest `isoDurationToMinutes` het tijddeel en telt `applyTaskTimeRecords`
 *    de dagen vóór `T` mee met de minuten per dag van de taak (#871);
 *  - `speling`: `FreeFloat` en `TotalFloat`. `parseDurationDays` leest alleen dagen (knownbug 1033);
 *  - `lag-werktijd`, `lag-kalendertijd`: de `LagValue` van een `IfcLagTime` als `IFCDURATION` of ongetypte tekst
 *    (`lagValueSlot`), met `DurationType` werktijd of kalendertijd. Met `T` minuten plus de dagen vóór `T` als 1440 minuten
 *    (`isoDurationLeadingDaysMinutes`); in werktijd is dat niet wat de dag betekent (knownbug 1033);
 *  - `lag-oud`: de oude indeling van OPS met de duur in argument 5. `parseDurationDays`: alleen dagen.
 */
export type DurationSlot = 'duur' | 'werkelijk' | 'rest' | 'speling' | 'lag-werktijd' | 'lag-kalendertijd' | 'lag-oud';

export interface DurationForm {
  /** De naam; de test in `check-ifc-duurvormen.ts` en de tabel in de PR-tekst gebruiken hem. */
  readonly name: string;
  readonly pattern: RegExp;
  /** De slots waarin de lezer deze vorm exact leest. */
  readonly slots: readonly DurationSlot[];
  /** Wie de vorm schrijft: de OPS-versie of commit, of een ander programma. */
  readonly writer: string;
  /** Een voorwaarde op de getallen, als de vorm alleen niet genoeg zegt. */
  readonly exact?: (m: RegExpExecArray) => boolean;
}

/** Een getal zoals JavaScript het schrijft (`${n}`): `3`, `2.5`, `2.3333333333333335`, `1e-7`, `1e+21`. Zo schreef de
 *  writer de dagen tot `b738a5096` (24 september 2026); `parseDurationDays` leest het met dezelfde exponent. */
const JS_NUMBER = '\\d+(?:\\.\\d+)?(?:e[-+]\\d+)?';
/** Een tijddeel: uren (een decimale punt mag), minuten en seconden, elk zonder teken; minstens één. */
const TIME_PART = 'T(?=\\d)(?:(\\d+(?:\\.\\d+)?)H)?(?:(\\d+)M)?(?:(\\d+)S)?';

/** Valt dit tijddeel op een hele minuut? Uren met een breuk (`0.5H` is 30 minuten), en seconden per 60. Met gehele
 *  getallen (`BigInt`), zodat er geen afronding in de toets zelf zit. */
function wholeMinutes(hours: string | undefined, seconds: string | undefined): boolean {
  if (hours?.includes('.')) {
    const fraction = hours.split('.')[1];
    if (BigInt(fraction) * 60n % 10n ** BigInt(fraction.length) !== 0n) return false;
  }
  return seconds === undefined || BigInt(seconds) % 60n === 0n;
}

const TASK: readonly DurationSlot[] = ['duur', 'werkelijk', 'rest'];
const LAG: readonly DurationSlot[] = ['lag-werktijd', 'lag-kalendertijd'];

/**
 * De lijst. De eerste vorm die past, telt (alleen voor de naam in een melding; de toets is of er één past). Een minteken
 * staat alleen in de slots waar OPS het schrijft (speling en lag): een negatieve taakduur, werkelijke duur of restduur
 * schreef OPS nooit, dus die weigert.
 */
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

/** De vorm uit de lijst waarin deze duur in dit slot valt, of `undefined`: dan weigert de merge. */
export function durationForm(text: string, slot: DurationSlot): DurationForm | undefined {
  for (const form of DURATION_FORMS) {
    if (!form.slots.includes(slot)) continue;
    const m = form.pattern.exec(text);
    if (m && (!form.exact || form.exact(m))) return form;
  }
  return undefined;
}

/**
 * Waarom een duur buiten de lijst valt, voor de melding: de leesfout die erbij hoort, als die bekend is. Dit beslist
 * niets (dat doet alleen `durationForm`); het helpt de planner en de lezer van de melding.
 */
export function durationHint(text: string, slot: DurationSlot): string {
  if (text.includes(',')) return 'een decimale komma; de lezer leest alleen de cijfers na de komma (knownbug 1029)';
  if (/^-?P(?:[^T]*[YMW])/.test(text) && !/^-?P0Y0M/.test(text)) return 'jaren, maanden of weken; de lezer leest die niet (knownbug 1028)';
  if (/T.*-/.test(text) || /^-?P[^T]*\d-\d/.test(text)) return 'een minteken in een deel; de lezer neemt de waarde zonder teken (knownbug 1034)';
  if (/^-|^P0Y0M-/.test(text) && (slot === 'duur' || slot === 'werkelijk' || slot === 'rest')) return 'een negatieve taakduur, werkelijke duur of restduur; OPS schrijft die nooit';
  if (/T/.test(text) && slot === 'speling') return 'een speling met een tijddeel; de lezer leest een speling alleen in hele dagen (knownbug 1033)';
  if (/T/.test(text) && slot === 'lag-oud') return 'een tijddeel in de oude lagvorm; de lezer leest daar alleen dagen';
  if (/^-?P\d+(?:\.\d+)?DT/.test(text) && slot === 'lag-werktijd') return "dagen vóór T in een lag in werktijd; de lezer telt die als 24 uur werktijd, en 'P1D' als één werkdag (knownbug 1033)";
  if (/T/.test(text) && /^-?P[^,]*T(?:[\d.]*H)?(?:\d+M)?(?:\d+S)?$/.test(text)) return 'een tijddeel dat niet op een hele minuut valt; de lezer rondt af (knownbug 1035)';
  return 'een vorm die de lezer niet exact leest (knownbug 1030)';
}

/** De slots in een melding. */
export const DURATION_SLOT_LABEL: Readonly<Record<DurationSlot, string>> = {
  duur: 'de duur',
  werkelijk: 'de werkelijke duur',
  rest: 'de restduur',
  speling: 'de speling',
  'lag-werktijd': 'de lag in werktijd',
  'lag-kalendertijd': 'de lag in kalendertijd',
  'lag-oud': 'de lag in de oude vorm',
};
