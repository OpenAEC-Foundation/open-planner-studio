/**
 * Duur-parser en -formatter (fase 2.8b, §6.4/§6.5).
 *
 * BINDENDE USER-REGEL (hele-eenheden-besluit, recenter dan het ontwerpdoc): een duur is
 * uitsluitend een GEHEEL aantal dagen en/of GEHELE uren (en/of GEHELE minuten). Decimalen
 * (bv. "2.5d", "1,5u") zijn een parse-fout — géén stille conversie naar fractionele dagen.
 * Een NAAKT geheel getal = werkdagen (§6.4, Bevinding 10). NL- en EN-suffixen: `d` (dagen),
 * `u`/`h` (uren), `m` (minuten).
 *
 * De interne bron-van-waarheid voor duur is integer MINUTEN (§2.1); `effHoursPerDay` is de
 * dag↔minuut-factor (een dag = `effHoursPerDay × 60` minuten, §2.3 — nooit
 * `workEndHour − workStartHour`).
 *
 * Afwijzing gebeurt via een `null`-return (geen throw), zodat de UI een inline-fout kan tonen.
 */

/** Weergave-eenheid voor `formatDuration` (§6.5 Duurweergave). */
export type DurationUnit = 'days' | 'hours' | 'auto';

/**
 * Vertaalde eenheid-afkortingen voor de WEERGAVE (fase 2.8b QA-golf, §6.4/§11 open punt). De engine-laag
 * (`durationFormat.ts`) blijft PUUR — geen i18n-import; de UI geeft de vertaalde suffixen als parameter door
 * (licht adapter-laagje, `durationSuffixesFrom(t)` in `taskDuration.ts`). Default = NL `d`/`u`/`m`, zodat
 * bestaande aanroepers (harness-checks, edit-seeds die weer PARSEBAAR moeten zijn) byte-identiek blijven.
 */
export interface DurationSuffixes {
  day: string;
  hour: string;
  minute: string;
}

/** Default-suffixen (NL, tevens de PARSEBARE vorm) — invoer blijft taalonafhankelijk d/u/h/m (§6.4). */
export const DEFAULT_DURATION_SUFFIXES: DurationSuffixes = { day: 'd', hour: 'u', minute: 'm' };

/**
 * Parse een duur-invoer naar integer MINUTEN, of `null` bij een parse-fout.
 *
 * Geldig:  "3d", "20u", "20h", "2d 4u", "2d4h", "90m", en een naakt geheel getal ("5" = 5
 *          werkdagen = 5 × effHoursPerDay × 60 min).
 * Ongeldig (⇒ null): decimalen ("2.5d", "1,5u"), een bare rest zonder suffix ("4h30"),
 *          lege string, niet-numerieke tekst ("abc"), negatieve waarden ("-3d").
 *
 * De term-volgorde is dagen → uren → minuten; elke eenheid mag hoogstens één keer voorkomen.
 * Eenheden mogen aaneengesloten ("2d4h") of met witruimte gescheiden ("2d 4u") staan.
 */
export function parseDuration(input: string, effHoursPerDay: number): number | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (s === '') return null;

  // Naakt geheel getal = werkdagen (óók in uur-modus, Bevinding 10).
  if (/^\d+$/.test(s)) {
    return parseInt(s, 10) * effHoursPerDay * 60;
  }

  // Strikte, volledige match: optioneel dagen, dan optioneel uren (u/h), dan optioneel minuten.
  // Elke eenheid moet direct op zijn getal volgen; alleen witruimte scheidt de termen.
  const m = s.match(/^(?:(\d+)d)?\s*(?:(\d+)[uh])?\s*(?:(\d+)m)?$/);
  if (!m) return null;

  const [, dStr, hStr, mStr] = m;
  // Minstens één eenheid vereist (een "lege" match zou anders 0 opleveren).
  if (dStr === undefined && hStr === undefined && mStr === undefined) return null;

  const days = dStr ? parseInt(dStr, 10) : 0;
  const hours = hStr ? parseInt(hStr, 10) : 0;
  const mins = mStr ? parseInt(mStr, 10) : 0;

  return days * effHoursPerDay * 60 + hours * 60 + mins;
}

/**
 * Formatteer integer MINUTEN naar een leesbare duur-string.
 *
 * - `'days'`  ⇒ als (mogelijk fractionele) dagen: `"3d"`, `"0.8d"` (fractionele dagen zijn
 *   toegestaan als WEERGAVE, §6.4 — nooit als invoer).
 * - `'hours'` ⇒ als hele uren + resterende minuten: `"20u"`, `"1u 30m"`, `"45m"`.
 * - `'auto'`  ⇒ hele dagen ⇒ dag-vorm, anders uur-vorm.
 *
 * De eenheid-afkortingen komen via `suffixes` binnen (default NL `d`/`u`/`m`); zo blijft deze util PUUR
 * (geen i18n-import) terwijl de UI de vertaalde suffixen kan doorgeven (§6.4/§11).
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
    return `${trimNumber(days)}${suffixes.day}`;
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

/** Compacte getal-weergave: tot 4 decimalen, trailing nullen weg (3 → "3", 0.8 → "0.8"). */
function trimNumber(n: number): string {
  return String(Number(n.toFixed(4)));
}
