/**
 * Duur-parser en -formatter.
 *
 * Invoer (spec "alleen uren" §3.12, besluiten B2 en B8): een duur is een aantal dagen en/of uren
 * (en/of hele minuten). Dagen en uren mogen een breuk hebben, met een punt of een komma ("2.5d",
 * "1,5u"): de schakelaar Urenplanning bestaat niet meer, dus breuken zijn voor iedereen te typen. Een
 * NAAKT getal = werkdagen. NL- en EN-suffixen: `d` (dagen), `u`/`h` (uren), `m` (minuten).
 *
 * De bron van deze functie is MINUTEN (een dag = `effHoursPerDay × 60` minuten — nooit
 * `workEndHour − workStartHour`); de uitkomst is op hele minuten afgerond. De maat van een taak
 * (dagenmaat of urenmaat) kiest `parseTaskDurationInput`; deze functie is de samengestelde vorm
 * ("2d 4u") die het raster als minuten leest.
 *
 * Afwijzing gebeurt via een `null`-return (geen throw), zodat de UI een inline-fout kan tonen.
 */

/** Weergave-eenheid voor `formatDuration` (Duurweergave). */
export type DurationUnit = 'days' | 'hours' | 'auto';

/**
 * Vertaalde eenheid-afkortingen voor de WEERGAVE. De engine-laag
 * (`durationFormat.ts`) blijft PUUR — geen i18n-import; de UI geeft de vertaalde suffixen als parameter door
 * (licht adapter-laagje, `durationSuffixesFrom(t)` in `taskDuration.ts`). Default = NL `d`/`u`/`m`, zodat
 * aanroepers zonder suffixen (harness-checks, edit-seeds die weer PARSEBAAR moeten zijn) de parsebare vorm krijgen.
 */
export interface DurationSuffixes {
  day: string;
  hour: string;
  minute: string;
}

/** Default-suffixen (NL, tevens de PARSEBARE vorm) — invoer blijft taalonafhankelijk d/u/h/m. */
export const DEFAULT_DURATION_SUFFIXES: DurationSuffixes = { day: 'd', hour: 'h', minute: 'm' };

/**
 * De uur-afkorting voor tekst die de app later weer INLEEST (lag, klembord): de vertaalde afkorting als
 * de parsers hem kennen (`u` in nl, `h` in en), anders `fallback` — de vorm die die plek al schreef.
 * Eigenaarsbesluit 2026-10-20: uren staan als "10u" (nl) en "10h" (en), zonder spatie. Een afkorting
 * als "ч" of "t" zou plakken en bewerken breken, dus die talen houden hier de oude vorm.
 */
export function parseableHourSuffix(suffix: string | undefined, fallback: 'u' | 'h' = 'u'): 'u' | 'h' {
  return suffix === 'u' || suffix === 'h' ? suffix : fallback;
}

/**
 * Parse een duur-invoer naar integer MINUTEN, of `null` bij een parse-fout.
 *
 * Geldig:  "3d", "2,5d", "20u", "1.5u", "20h", "2d 4u", "2d4h", "90m", en een naakt getal ("5" of
 *          "2,5" = werkdagen × effHoursPerDay × 60 min).
 * Ongeldig (⇒ null): een bare rest zonder suffix ("4h30"), een breuk in minuten ("1.5m"), lege
 *          string, niet-numerieke tekst ("abc"), negatieve waarden ("-3d").
 *
 * De term-volgorde is dagen → uren → minuten; elke eenheid mag hoogstens één keer voorkomen.
 * Eenheden mogen aaneengesloten ("2d4h") of met witruimte gescheiden ("2d 4u") staan.
 */
export function parseDuration(input: string, effHoursPerDay: number): number | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (s === '') return null;
  const num = (text: string) => Number(text.replace(',', '.'));
  const result = (minutes: number): number | null => {
    const rounded = Math.round(minutes);
    return Number.isSafeInteger(rounded) && rounded >= 0 ? rounded : null;
  };

  // Naakt getal = werkdagen (óók in uur-modus, Bevinding 10); een breuk mag (B2).
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return result(num(s) * effHoursPerDay * 60);

  // Strikte, volledige match: optioneel dagen, dan optioneel uren (u/h), dan optioneel minuten.
  // Elke eenheid moet direct op zijn getal volgen; alleen witruimte scheidt de termen.
  const m = s.match(/^(?:(\d+(?:[.,]\d+)?)d)?\s*(?:(\d+(?:[.,]\d+)?)[uh])?\s*(?:(\d+)m)?$/);
  if (!m) return null;

  const [, dStr, hStr, mStr] = m;
  // Minstens één eenheid vereist (een "lege" match zou anders 0 opleveren).
  if (dStr === undefined && hStr === undefined && mStr === undefined) return null;

  const days = dStr ? num(dStr) : 0;
  const hours = hStr ? num(hStr) : 0;
  const mins = mStr ? parseInt(mStr, 10) : 0;

  return result(days * effHoursPerDay * 60 + hours * 60 + mins);
}

/**
 * Formatteer integer MINUTEN naar een leesbare duur-string.
 *
 * - `'days'`  ⇒ als (mogelijk fractionele) dagen: `"3d"`, `"0.8d"`.
 * - `'hours'` ⇒ als hele uren + resterende minuten: `"20u"`, `"1u 30m"`, `"45m"`.
 * - `'auto'`  ⇒ hele dagen ⇒ dag-vorm, anders uur-vorm.
 *
 * De eenheid-afkortingen komen via `suffixes` binnen (default NL `d`/`u`/`m`); zo blijft deze util PUUR
 * (geen i18n-import) terwijl de UI de vertaalde suffixen kan doorgeven.
 */
export function formatDuration(
  minutes: number,
  effHoursPerDay: number,
  unit: DurationUnit = 'auto',
  suffixes: DurationSuffixes = DEFAULT_DURATION_SUFFIXES,
): string {
  const minPerDay = effHoursPerDay * 60;

  if (unit === 'days') {
    const days = minPerDay > 0 ? minutes / minPerDay : 0;
    return `${trimNumber(days, 4)}${suffixes.day}`;
  }

  if (unit === 'hours') {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h}${suffixes.hour}`;
    if (h === 0) return `${m}${suffixes.minute}`;
    return `${h}${suffixes.hour} ${m}${suffixes.minute}`;
  }

  // 'auto': hele dagen ⇒ dag-vorm; anders uur-vorm.
  if (minPerDay > 0 && minutes % minPerDay === 0) {
    return `${minutes / minPerDay}${suffixes.day}`;
  }
  return formatDuration(minutes, effHoursPerDay, 'hours', suffixes);
}

/** Compacte getal-weergave: tot `maxDecimals` decimalen, trailing nullen weg (3 → "3", 0.8 → "0.8").
 *  Neutrale punt-notatie — voor invoervelden en tokens, niet voor rapporten (zie `reportNumber.ts`). */
export function trimNumber(n: number, maxDecimals: number): string {
  return String(Number(n.toFixed(maxDecimals)));
}
