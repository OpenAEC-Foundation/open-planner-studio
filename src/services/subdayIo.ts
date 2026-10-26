import type { MilestoneKind, Task } from '@/types/task';
import { isHourModeCalendar, type WorkCalendar, type WorkTimeBands } from '@/types/calendar';
import { effectiveWorkTimeBands, firstBlockedDay, seedScalarBands } from '@/utils/effectiveWorkTime';
// Writers moeten ook door tests/extensies aangeleverde objecten zonder `durationUnit`
// veilig kunnen bewaren — `taskDurationUnit` draagt dezelfde legacy-regel als de documentmigratie.
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { isoDayOfWeek } from '@/utils/dateUtils';
import { modalBandHoursPerDay } from '@/engine/scheduler/CalendarEngine';

/**
 * Gedeelde sub-dag-precisie-helpers voor de IFC/P6/MSPDI-adapters. Alle drie de formaten delen
 * dezelfde discriminator en dezelfde minuut↔band-conventies; die logica staat hier één keer.
 *
 * NORMATIEVE IMPORT-DISCRIMINATOR. Een reader zet `workTime` op een kalender UITSLUITEND
 * bij een echte afwijking van het enkelvoudige dag-patroon:
 *   (a) meer dan één band op een werkdag, of
 *   (b) een band die middernacht kruist (wrap), of
 *   (b2) een band die een VOLLEDIGE dag beslaat (≥1440 min — "24 Hours"-kalender, zie hieronder), of
 *   (c) sub-dag-informatie elders in het bestand — een duur met een uren/minuten-component die niet
 *       op hele dagen valt, of datetimes met een echte tijd-van-de-dag die afwijkt van het
 *       synthetische anker (IFC `T07:00`, P6/MSPDI `T08:00`).
 * Anders blijft het scalar `workStartHour`/`workEndHour`-model staan (dag-modus) ⇒ een round-trip
 * van een dag-bestand blijft ongewijzigd.
 *
 * (b2): MSP's ingebouwde "24 Hours"-basiskalender (en elke resource-kalender die 'm kopieert)
 * codeert een werkdag als ÉÉN band `{start:0, end:1440}` — geen tweede band (a), geen
 * middernacht-wrap (b, want `end`(1440) is niet `> 1440`). Zonder (b2) promoveert zo'n kalender
 * NOOIT naar uur-modus, tenzij een TAAK toevallig een eigen (c)-signaal draagt — en resource-kalenders
 * die alleen via een TOEWIJZING gebruikt worden krijgen nooit zo'n taak-signaal. Elke
 * kalenderwandeling op zo'n kalender kreeg dan stil `isHourMode === false` (`CalendarEngine`) i.p.v.
 * een fout (bv. de "24 Hour"-resourcekalenders in mpp14timephased.mpp).
 */

const MIN_PER_DAY = 1440;

/**
 * `min` (minuten-vanaf-middernacht, 0..1440) → `'HH:MM:SS'`. Standaard valt 1440 op `'00:00:00'`
 * (tijd-van-de-dag, zoals de MSPDI/P6-writers het schrijven). `endOfDay` is voor het EINDE van een
 * IFC-tijdvak: precies 1440 wordt dan `'24:00:00'` — een geldige IfcTime (XML Schema Part 2 staat 24:00:00
 * toe) die, anders dan `'00:00:00'`, IfcTimePeriods "begin vóór eind" respecteert; de IFC-lezer leest
 * hem als 1440 (`clockToMinutes`) resp. 24 (`scalarHourFromClock`). Een wrap-einde (> 1440) blijft
 * tijd-van-de-dag.
 */
export function minutesToClock(min: number, endOfDay = false): string {
  if (endOfDay && min === MIN_PER_DAY) return '24:00:00';
  const m = ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

/**
 * Het scalar UUR dat de IFC-lezer uit een `IFCTIMEPERIOD`-klokstring haalt: het deel vóór de eerste
 * `:` (een minuutdeel valt dus weg; onparseerbaar ⇒ `NaN`). Voor een geldige IfcTime (`hh:mm:ss`) is
 * dat het hele uur; het oudere OPS-formaat met een uurfractie (`'7.5:00:00'`) levert via
 * `parseFloat` zijn fractie exact terug. Gedeeld door lezer én schrijver: de schrijver bepaalt
 * hiermee of de scalar werktijd apart in `OPS_Calendar` moet — alleen wanneer deze afleiding uit de
 * eerste geschreven periode hem niet teruggeeft.
 */
export function scalarHourFromClock(clock: string): number {
  return parseFloat(clock.split(':')[0]);
}

/** `'HH:MM[:SS]'` → minuten-vanaf-middernacht, of `null` bij een onparseerbare klokstring. */
export function clockToMinutes(clock: string): number | null {
  const m = clock.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

/**
 * Minuten → ISO-8601-duur MET tijdcomponent (uur-modus): vorm `PT{h}H{m}M0S`. Geen
 * dag-component: zo is de encoding hpd-onafhankelijk en minuut-precies terug te lezen. Een negatieve
 * waarde (lead) krijgt het ISO-voorloopteken (`-PT..`).
 */
export function minutesToIsoDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}PT${h}H${m}M0S`;
}

/** De grootste ruis van uren met zes decimalen, in minuten: 0,5 × 10⁻⁶ u × 60. */
export const SIX_DECIMAL_HOUR_NOISE_MINUTES = 0.00003;

/**
 * Uren uit een bron met zes decimalen (XER, P6 XML) → minuten. Een hele minuut is meestal geen eindige
 * decimale breuk van een uur: 40 min staat er als 0,666667 u, dus 40,00002 min. Ligt `uren × 60` binnen
 * `SIX_DECIMAL_HOUR_NOISE_MINUTES` van een hele minuut, dan is het die hele minuut. Een echte breuk blijft
 * staan (0,33 u = 19,8 min), alleen zonder de floatruis van uren × 60, op een miljoenste minuut
 * (0,12 u × 60 = 7,199999999999999 ⇒ 7,2). Reden: met de ruis springt een late datum soms een dag terug
 * (knownbug 385), en worden P6-cellen onexact (regel A).
 */
export function sixDecimalHoursToMinutes(hours: number): number {
  const minutes = hours * 60;
  const whole = Math.round(minutes);
  if (Math.abs(minutes - whole) <= SIX_DECIMAL_HOUR_NOISE_MINUTES) return whole;
  return Math.round(minutes * 1e6) / 1e6;
}

/**
 * Parse een ISO-8601-duurstring naar minuten ALS hij een tijdcomponent (`T..H/M/S`) draagt; anders
 * `null` — een pure dag-duur (`P0Y0M5D`, `P5D`) houdt het dag-substraat ongewijzigd. Dit is de
 * duur-kant van discriminator (c): een niet-null resultaat is sub-dag-informatie.
 */
export function isoDurationToMinutes(iso: string): number | null {
  if (!iso) return null;
  const tIdx = iso.indexOf('T');
  if (tIdx < 0) return null; // geen tijdcomponent ⇒ dag-duur
  const timePart = iso.slice(tIdx + 1);
  const hMatch = /(-?\d+(?:\.\d+)?)H/.exec(timePart);
  const mMatch = /(-?\d+(?:\.\d+)?)M/.exec(timePart);
  const sMatch = /(-?\d+(?:\.\d+)?)S/.exec(timePart);
  if (!hMatch && !mMatch && !sMatch) return null;
  const mins =
    (hMatch ? parseFloat(hMatch[1]) * 60 : 0) +
    (mMatch ? parseFloat(mMatch[1]) : 0) +
    (sMatch ? parseFloat(sMatch[1]) / 60 : 0);
  const neg = iso.trimStart().startsWith('-');
  const rounded = Math.round(Math.abs(mins));
  return neg ? -rounded : rounded;
}

/**
 * True als `iso` een echte tijd-van-de-dag draagt die afwijkt van het synthetische anker
 * (datetime-kant van discriminator (c)). `anchorClock` = `'HH:MM'`/`'HH:MM:SS'`. Date-only (geen
 * `'T'`) ⇒ false (dag-substraat, geen sub-dag-info).
 */
export function hasNonAnchorTime(iso: string, anchorClock: string): boolean {
  const tIdx = iso.indexOf('T');
  if (tIdx < 0) return false;
  const time = iso.slice(tIdx + 1).replace(/[Zz].*$/, '').replace(/[+-]\d\d:?\d\d$/, '');
  return time.slice(0, 5) !== anchorClock.slice(0, 5);
}

/** True als `minutes` NIET op een heel aantal werkdagen van `hoursPerDay` valt (duur-kant van (c)). */
export function isSubDayMinutes(minutes: number, hoursPerDay: number): boolean {
  const perDay = Math.round(hoursPerDay * 60);
  if (perDay <= 0) return true;
  return Math.round(minutes) % perDay !== 0;
}

/**
 * Canonicaliseer rauwe per-weekdag-banden (minuten-vanaf-middernacht): `end > start`
 * (een wrap met niet-oplopende grens wordt `end += 1440`), per dag gesorteerd op start. Meldt
 * tegelijk of de banden AFWIJKEN van het enkelvoudige dag-patroon — discriminator (a) (>1 band op
 * een werkdag), (b) (band over middernacht, `end > 1440`) of (b2) (band die een volledige dag
 * beslaat, `end − start ≥ 1440` — de "24 Hours"-kalender, zie de moduleheader hierboven).
 */
export function canonicalizeBands(
  raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>>,
): { bands: WorkTimeBands; deviates: boolean } {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  let deviates = false;
  for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    const list = raw[wd] ?? [];
    if (list.length > 1) deviates = true; // (a)
    const norm = list
      .map((b) => {
        const rawStart = b.start;
        let end = b.end;
        if (end <= b.start) end += MIN_PER_DAY; // ongeldige encoding → canoniek wrap
        if (end > MIN_PER_DAY) deviates = true; // (b) wrap over middernacht
        if (end - rawStart >= MIN_PER_DAY) deviates = true; // (b2) volledige dag ("24 Hours")
        return { start: b.start, end };
      })
      .sort((a, b) => a.start - b.start);
    byWeekday[wd] = norm;
  }
  return { bands: { byWeekday }, deviates };
}

/** Twee bloklijsten met dezelfde begin- en eindminuten, in dezelfde volgorde. */
export function sameBlocks(
  a: ReadonlyArray<{ start: number; end: number }>, b: ReadonlyArray<{ start: number; end: number }>,
): boolean {
  return a.length === b.length && a.every((x, i) => x.start === b[i].start && x.end === b[i].end);
}

/** De blokken die elke werkdag met blokken deelt (canonieke banden); `'verschilt'` als twee werkdagen
 *  andere blokken hebben; `undefined` als geen dag blokken heeft. */
export function sharedWeekBlocks(bands: WorkTimeBands): ReadonlyArray<{ start: number; end: number }> | 'verschilt' | undefined {
  let shared: ReadonlyArray<{ start: number; end: number }> | undefined;
  for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    const day = bands.byWeekday[wd];
    if (day.length === 0) continue;
    if (!shared) shared = day;
    else if (!sameBlocks(shared, day)) return 'verschilt';
  }
  return shared;
}

/** De twee blokken van een dagkalender met pauze, zoals de eigen MSPDI- en P6 XML-writer die schrijven:
 *  op elke werkdag dezelfde twee blokken (`effectiveWorkTimeBands` van een dagkalender), met een echte
 *  pauze ertussen, binnen de dag. Anders `undefined`. Alleen voor een bestand van OPS zelf: een bestand
 *  van een ander programma met 08:00–12:00 + 13:00–17:00 blijft een uurkalender. */
export function opsDayWithBreak(bands: WorkTimeBands): ReadonlyArray<{ start: number; end: number }> | undefined {
  const shared = sharedWeekBlocks(bands);
  return Array.isArray(shared) && shared.length === 2
    && shared[0].end < shared[1].start && shared[1].end <= MIN_PER_DAY
    ? shared : undefined;
}

/**
 * Afgeleide `hoursPerDay` uit banden: de MODALE dagsom over de werk-weekdagen,
 * bij gelijkspel de HOOGSTE. Dezelfde functie als de engine gebruikt (`modalBandHoursPerDay`), zodat
 * de opgeslagen `hoursPerDay` (die de adapters voor hun dag↔uur-conversie gebruiken) per definitie
 * gelijk is aan wat de engine berekent.
 */
export const deriveHoursPerDay = modalBandHoursPerDay;

/**
 * Wijkt de opgeslagen `hoursPerDay` af van de uren per dag die uit de werktijd volgen? Strikte
 * ongelijkheid, geen marge. Eén regel voor drie plekken:
 *  - de IFC-schrijver schrijft `HoursPerDay` alleen bij een afwijking (`writeCalendarGenerationMeta`;
 *    `docs/ifc-round-trip.md`, "Uren per dag bij een blokkenkalender");
 *  - de uren per dag volgen de blokken alleen zonder afwijking ({@link hoursPerDayFollowsBlocks});
 *  - het kalendervenster toont alleen bij een afwijking het oranje blok onder *Standaard werkdag*
 *    (besluit eigenaar 2026-10-20, punt 8, optie 2).
 * `derived` is `undefined` of `NaN` als er niets af te leiden is; dat telt als afwijking, zoals in de
 * schrijver. Een aanroeper die dan geen afwijking wil, vangt dat zelf af.
 */
export function hoursPerDayDiffers(stored: number, derived: number | undefined): boolean {
  return stored !== derived;
}

/**
 * De scalaire werkdag van één dag met werkblokken: begin van het EERSTE blok, einde van het LAATSTE
 * blok en de netto uren (som van de blokken). Eén definitie voor de MSPDI-, `.mpp`- en IFC-lezer en
 * voor de resourcebibliotheek (fix werkdag-einde, 2026-10): MS Projects 08:00–12:00 + 13:00–17:00 is
 * 8–17 met 8 netto uren, niet 8–12.
 *
 *  - Canonieke minuten: een blok met `end <= start` loopt over middernacht (`end += 1440`); de blokken
 *    worden op begintijd gesorteerd (een bestand hoeft ze niet op volgorde te schrijven).
 *  - Middernacht: eindigt het laatste blok ná middernacht (drieploegen 06–14, 14–22, 22–06), dan is
 *    het einde 24 — zoals MSPDI's `00:00:00`. Anders het hele-uurdeel (FLOOR) van het einde.
 *  - `firstBlockEndHour`: het einde van het eerste blok, de scalar die de lezers van vóór deze fix
 *    namen (om oude bibliotheekdata te herkennen, zie {@link withRepairedFirstBlockScalar}).
 *
 * De lezers gebruiken dit alleen voor een dag met MEER blokken; bij één blok houdt elke lezer zijn
 * eigen, ongewijzigde afleiding. Geen blokken ⇒ `undefined`.
 */
export interface BlockedWorkDay {
  startHour: number;
  endHour: number;
  netHours: number;
  blocks: number;
  firstBlockEndHour: number;
}
export function workDayFromBlocks(dayBlocks: ReadonlyArray<{ start: number; end: number }>): BlockedWorkDay | undefined {
  const blocks = dayBlocks
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))
    .map((b) => ({ start: b.start, end: b.end <= b.start ? b.end + MIN_PER_DAY : b.end }))
    .sort((a, b) => a.start - b.start);
  if (blocks.length === 0) return undefined;
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  return {
    startHour: Math.floor(first.start / 60),
    endHour: last.end > MIN_PER_DAY ? 24 : Math.floor(last.end / 60),
    netHours: blocks.reduce((sum, b) => sum + (b.end - b.start), 0) / 60,
    blocks: blocks.length,
    firstBlockEndHour: Math.floor(Math.min(first.end, MIN_PER_DAY) / 60),
  };
}

/** Zie `firstBlockedDay` in `@/utils/effectiveWorkTime` (daar gedefinieerd, zonder importcyclus);
 *  hier opnieuw geëxporteerd voor de lezers en de dialoog. */
export { firstBlockedDay };

/**
 * Laatste terugval voor een werkdag die aan gaat zonder bron voor zijn blokken: de standaardwerkdag van
 * een nieuwe kalender (`createDefaultCalendar`: 07:00–16:00, 8 netto uur, pauze 12:00–13:00). Dezelfde
 * werkdag als de knop *Ma–vr* bij een eenvoudige kalender, dus voor de gebruiker herkenbaar.
 */
export const STANDARD_DAY_BLOCKS: ReadonlyArray<{ start: number; end: number }> = [
  { start: 7 * 60, end: 12 * 60 }, { start: 13 * 60, end: 16 * 60 },
];

/**
 * De beginstand van een kalender voor de regel van de uren per dag ({@link hoursPerDayFollowsBlocks}) en
 * voor de blokken die een werkdag terugkrijgt: de kalender zoals het kalendervenster hem in deze sessie
 * opende, of zoals de laatste preset hem zette. Het venster bewaart hem per kalender in zijn eigen buffer,
 * niet in de store. Eén MCP-call is één sessie: dan is de beginstand de kalender vóór de call.
 */
export type WorkTimeSessionStart = Pick<WorkCalendar, 'workTime' | 'hoursPerDay'>;

/**
 * Volgt `hoursPerDay` in deze sessie de blokken? Eén keer bepaald op de beginstand, zodat alle
 * werkdag- en blokwissels samen als één wissel tellen en de klikvolgorde niets uitmaakt.
 *
 * `hoursPerDay` is de omrekening tussen dagen en uren (P6 `day_hr_cnt`) en mag afwijken van de blokken:
 * "Late ploeg" 14:00–24:00 met 8 uur per dag. Zo'n afwijking is projectdata en blijft staan. Hij volgt de
 * blokken alleen als hij bij de beginstand gelijk was aan hun modale dagsom ({@link deriveHoursPerDay}).
 * Strikte gelijkheid, zoals de IFC-schrijver beslist of hij `HoursPerDay` apart bewaart
 * (`docs/ifc-round-trip.md`, "Uren per dag bij een blokkenkalender").
 *
 * Geen dagsom, dan volgt hij ook: een dagkalender bij openen (zijn uren per dag komen uit begin, einde en
 * pauze; *Per weekdag instellen…* maakt er in de sessie een uurkalender van) en een week zonder enig blok.
 * Zo maakt een wissel nooit zelf een afwijking.
 */
export function hoursPerDayFollowsBlocks(start: WorkTimeSessionStart): boolean {
  if (!start.workTime) return true;
  const modal = deriveHoursPerDay(start.workTime, NaN);
  return Number.isNaN(modal) || !hoursPerDayDiffers(start.hoursPerDay, modal);
}

/**
 * `hoursPerDay` voor de nieuwe blokken `workTime` van kalender `cal`: de modale dagsom als hij in deze
 * sessie de blokken volgt, anders blijft hij staan. Zonder enig blok blijft hij ook staan (geen dagsom).
 * Eén regel voor de werkdagknoppen, *Ma–vr* en het blok *Werktijden* in het venster, en MCP
 * `planner_update_calendar` met alleen `workDays`.
 */
export function hoursPerDayForBlocks(
  start: WorkTimeSessionStart,
  cal: Pick<WorkCalendar, 'hoursPerDay'>,
  workTime: WorkTimeBands,
): number {
  return hoursPerDayFollowsBlocks(start) ? deriveHoursPerDay(workTime, cal.hoursPerDay) : cal.hoursPerDay;
}

/**
 * Wat een werkdagknop in de kalenderdialoog doet. Dagkalender: alleen `workDays`. Uurkalender: de
 * blokken gaan mee, want de motor gebruikt beide (het werkdagmasker voor de dagtelling, de blokken voor
 * de uren) en een `workDays` zonder blokken verdween na opslaan en heropenen.
 *  - Dag uit ⇒ zijn blokken leeg.
 *  - Dag aan ⇒ in deze volgorde: (1) de eigen blokken van die dag in de beginstand `opened` (de kalender
 *    zoals het venster hem opende — een korte vrijdag 08–12 + 13–15 komt zo terug als 08–12 + 13–15); (2)
 *    een kopie van de eerste werkdag met blokken ({@link firstBlockedDay}); (3) staat er geen enkel blok
 *    meer, de eerste werkdag met blokken van de beginstand (alle dagen uit en dan Za aan: Za krijgt de
 *    werkdag van het openen); (4) had ook de beginstand geen blok, de effectieve blokken van de enkelvoudige
 *    werkdag (begin, einde, pauze; `seedScalarBands`); (5) levert ook dat niets op (een nachtscalar 22→06,
 *    of netto meer dan de spanne), de standaardwerkdag {@link STANDARD_DAY_BLOCKS}. Zo ontstaat een werkdag
 *    nooit zonder blokken, en zaait (4) alleen bij een kalender zonder dagsom, dus nooit met een
 *    afwijkende `hoursPerDay` (die zou een verzonnen pauze geven).
 * `hoursPerDay`: {@link hoursPerDayForBlocks} met de beginstand `opened`, of zonder sessie de kalender zelf.
 */
export function workDayTogglePatch(
  cal: Pick<WorkCalendar, 'workDays' | 'workTime' | 'hoursPerDay' | 'workStartHour' | 'workEndHour'
    | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>,
  day: number,
  opened?: WorkTimeSessionStart,
): Partial<WorkCalendar> {
  const has = cal.workDays.includes(day);
  const workDays = has ? cal.workDays.filter((x) => x !== day) : [...cal.workDays, day].sort((a, b) => a - b);
  if (!cal.workTime || day < 1 || day > 7) return { workDays };
  const own = opened?.workTime?.byWeekday[day as 1];
  const seeded = () => {
    const bands = seedScalarBands(cal.workStartHour * 60, cal.workEndHour * 60, cal.hoursPerDay,
      cal.simpleBreakStartMinute, cal.simpleBreakDurationMinutes);
    return bands.length > 0 ? bands : STANDARD_DAY_BLOCKS;
  };
  const source = has
    ? []
    : (own && own.length > 0 ? own : firstBlockedDay(cal.workTime) ?? firstBlockedDay(opened?.workTime)) ?? seeded();
  const workTime: WorkTimeBands = {
    byWeekday: { ...cal.workTime.byWeekday, [day as 1]: source.map((b) => ({ ...b })) },
  };
  return { workDays, workTime, hoursPerDay: hoursPerDayForBlocks(opened ?? cal, cal, workTime) };
}

/**
 * Zet de werkdagen van een kalender in één keer op `days` (de knop *Ma–vr* in de kalenderdialoog, MCP met
 * alleen `workDays`). Elke dag die van stand wisselt, gaat door {@link workDayTogglePatch}; bij een
 * uurkalender gaan de blokken dus mee en houdt een dag die aan blijft zijn eigen blokken. Eerst gaan de
 * dagen aan (zij kopiëren dan nog van een bestaande werkdag), daarna gaan de andere uit.
 *
 * `hoursPerDay` volgt {@link hoursPerDayForBlocks} met de beginstand `opened`, of zonder sessie de
 * kalender van vóór de zet: de hele zet is één wissel, los van de tussenstanden.
 */
export function workDaysSetPatch(
  cal: Pick<WorkCalendar, 'workDays' | 'workTime' | 'hoursPerDay' | 'workStartHour' | 'workEndHour'
    | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>,
  days: readonly number[],
  opened?: WorkTimeSessionStart,
): Partial<WorkCalendar> {
  let cur = { ...cal };
  for (const on of [true, false]) {
    for (let day = 1; day <= 7; day++) {
      if (days.includes(day) === on && cur.workDays.includes(day) !== on) {
        cur = { ...cur, ...workDayTogglePatch(cur, day, opened) };
      }
    }
  }
  return cur.workTime
    ? { workDays: cur.workDays, workTime: cur.workTime, hoursPerDay: hoursPerDayForBlocks(opened ?? cal, cal, cur.workTime) }
    : { workDays: cur.workDays };
}

/** De scalaire werkdag van een kalender met weekbanden: de eerste werkdag met blokken. */
function scalarDayOfBands(cal: Pick<WorkCalendar, 'workTime'>): BlockedWorkDay | undefined {
  const day = firstBlockedDay(cal.workTime);
  return day ? workDayFromBlocks(day) : undefined;
}

/**
 * Herstelt de oude eerste-blok-scalar van een kalender met weekbanden (MSPDI/`.mpp` van vóór 2026-10:
 * 08:00–12:00 + 13:00–17:00 werd `workEndHour` 12). Alleen als het patroon aantoonbaar dat is: meer
 * blokken op de scalaire dag, begin = begin eerste blok, einde = einde eerste blok, en het laatste blok
 * eindigt later. Dan wordt `workEndHour` het einde van het laatste blok; al het andere blijft. Voor de
 * resourcebibliotheek, die zulke kalenders als JSON bewaart (`normalizePoolShape`) — de lezers zelf
 * leiden het einde al goed af. Geen weekbanden of geen patroon ⇒ dezelfde kalender terug.
 */
export function withRepairedFirstBlockScalar<T extends Pick<WorkCalendar, 'workTime' | 'workStartHour' | 'workEndHour'>>(cal: T): T {
  const day = scalarDayOfBands(cal);
  if (!day || day.blocks < 2) return cal;
  if (cal.workStartHour !== day.startHour || cal.workEndHour !== day.firstBlockEndHour) return cal;
  if (day.endHour <= cal.workEndHour) return cal;
  return { ...cal, workEndHour: day.endHour };
}

/**
 * Omgekeerde van {@link withRepairedFirstBlockScalar}: de kalender zoals een lezer van vóór 2026-10 hem
 * gaf (einde = einde eerste blok), als de huidige scalar precies begin eerste / einde laatste blok is.
 * Voor de stempelvergelijking van de bibliotheek: een `syncedHash` uit een oud bestand dekt die oude
 * scalar. Anders `undefined`.
 */
export function firstBlockScalarVariant<T extends Pick<WorkCalendar, 'workTime' | 'workStartHour' | 'workEndHour'>>(cal: T): T | undefined {
  const day = scalarDayOfBands(cal);
  if (!day || day.blocks < 2) return undefined;
  if (cal.workStartHour !== day.startHour || cal.workEndHour !== day.endHour) return undefined;
  if (day.firstBlockEndHour >= day.endHour) return undefined;
  return { ...cal, workEndHour: day.firstBlockEndHour };
}

/** De werk-weekdagen (ISO 1..7) met ≥1 band. */
export function workDaysFromBands(bands: WorkTimeBands): number[] {
  const days: number[] = [];
  for (let wd = 1; wd <= 7; wd++) {
    if ((bands.byWeekday[wd as 1] ?? []).length > 0) days.push(wd);
  }
  return days;
}

/**
 * Enkelband-kalender uit de scalar `workStartHour/EndHour` (fallback bij (c)-promotie zonder
 * geregistreerde banden — bv. een default-kalender die door een sub-dag-taak alsnog uur-modus wordt).
 * Gedeeld door de IFC/MSPDI/P6-readers.
 */
export function synthBandsFromScalar(cal: WorkCalendar): WorkTimeBands {
  const raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const band = { start: cal.workStartHour * 60, end: cal.workEndHour * 60 };
  for (const wd of cal.workDays) if (wd >= 1 && wd <= 7) raw[wd as 1] = [{ ...band }];
  return canonicalizeBands(raw).bands;
}

/**
 * Rauwe (gecanonicaliseerde) banden per gelezen kalender-object + of ze afwijken van het
 * enkelvoudige dag-patroon (discriminator (a)/(b)). Eén gedeelde WeakMap: de sleutels zijn de
 * per-parse aangemaakte `WorkCalendar`-objecten — elke reader maakt zijn eigen kalenders, dus readers
 * delen nooit een sleutel en kunnen niet in elkaar lekken. WeakMap ⇒ per-parse, automatisch opgeruimd.
 */
const bandRegistry = new WeakMap<WorkCalendar, { canonical: WorkTimeBands; deviates: boolean }>();

/** Registreer de gecanonicaliseerde banden + afwijking van een zojuist gelezen kalender. */
export function registerCalendarBands(
  cal: WorkCalendar,
  info: { canonical: WorkTimeBands; deviates: boolean },
): void {
  bandRegistry.set(cal, info);
}

/** De geregistreerde banden van een kalender, of `undefined` als er geen banden gelezen zijn. */
export function getCalendarBands(
  cal: WorkCalendar,
): { canonical: WorkTimeBands; deviates: boolean } | undefined {
  return bandRegistry.get(cal);
}

/**
 * Promoveer één kalender naar uur-modus als hij afwijkt (a/b, `deviates`) of een (c)-signaal droeg
 * (`signaled`). Zet `workTime` + afgeleide `workDays`/`hoursPerDay`; een lezer met een eigen uren per dag
 * uit het bestand zet die daarna terug (XER, IFC, P6 XML, MSPDI, `.mpp`). Retourneert of de kalender (nu)
 * uur-modus is — inclusief het geval dat hij al `workTime` droeg. Gedeelde promotie-orkestratie;
 * de readers houden zelf hun format-specifieke signaal-verzameling (`cSignalCalIds`/`subDayCals`).
 *
 * `preferCanonicalWhenEmpty` bewaart een BEWUST formaatverschil: het IFC-pad kiest altijd de
 * geregistreerde canonical zodra er info is (`info?.canonical ?? synth`), terwijl MSPDI/P6 terugvallen
 * op de scalar-synth zodra de canonical geen werkdag draagt (`length > 0 ? canonical : synth`). Dat
 * verschil raakt alleen de edge-case «geregistreerd maar leeg, gepromoveerd via een (c)-signaal».
 */
export function promoteHourCalendar(
  cal: WorkCalendar,
  info: { canonical: WorkTimeBands; deviates: boolean } | undefined,
  signaled: boolean,
  preferCanonicalWhenEmpty: boolean,
): boolean {
  if (!((info?.deviates ?? false) || signaled)) return false;
  if (cal.workTime) return true;
  const canonical = info?.canonical;
  const useCanonical = !!canonical && (preferCanonicalWhenEmpty || workDaysFromBands(canonical).length > 0);
  const bands = useCanonical ? canonical! : synthBandsFromScalar(cal);
  cal.workTime = bands;
  const wd = workDaysFromBands(bands);
  if (wd.length > 0) cal.workDays = wd;
  cal.hoursPerDay = deriveHoursPerDay(bands, cal.hoursPerDay);
  return true;
}

/**
 * Geeft `milestoneKind` aan een UUR-modus-mijlpaal wanneer het opgeslagen anker EXACT op een
 * bandgrens van de effectieve kalender ligt — de informatie die de solver
 * (`succIsFinishMs`/`predEndsBeginOfDay` in `relationMath.ts`) nodig heeft om MS Projects eigen
 * klokstand (bv. `…T17:00`) te herkennen i.p.v. de eerstvolgende werk-instant (`…T08:00` de
 * volgende dag) te forceren. Gedeeld door de MPP- en de MSPDI-lezer, zodat die niet uit elkaar lopen.
 *
 * Kijkt UITSLUITEND naar de KALENDER-EIGEN weekdagbanden (`cal.workTime.byWeekday`, ná promotie
 * door `promoteHourCalendars` — op het moment dat de lezer dit aanroept is `cal.workTime` dus al
 * gezet voor elke uurkalender). Geen dag-specifieke holiday-/werkuitzondering-
 * materialisatie (dat is `CalendarEngine`'s taak in de solver, buiten deze lezer se scope): een
 * mijlpaal-anker landt per definitie nooit op een holiday (die dag heeft geen banden in
 * `byWeekday`); de eigen banden van een werkende uitzondering worden hier niet bekeken.
 *
 * `minuteOfDay` vergelijkt op UTC-getters (`getUTCHours`/`getUTCMinutes`) — spiegelt de rest van de
 * engine, die overal in UTC-instants zonder DST rekent (zie `dateUtils.ts`'s moduleheader).
 * Seconden worden genegeerd (de tijdstempels zijn minuut-precies).
 *
 * Bandbegin ⇒ `'START'`; bandeinde ⇒ `'FINISH'`; anders `undefined` (geen veld gezet). Een WRAP-band (`end >= 1440`, middernacht-kruisend — INCLUSIEF een band die EXACT om
 * middernacht eindigt, bv. een ploegendienst 20:00–24:00: `resolveOneDay` bouwt zo'n band zonder
 * clamp en `canonicalizeBands` beschouwt 'm niet als afwijkend, dus dit is een volstrekt normale
 * vorm elders in de codebase, geen theoretisch randgeval) staat geregistreerd onder de WEEKDAG
 * WAAROP HIJ BEGINT (zie `types/calendar.ts`) — de staart landt dus op de VOLGENDE
 * kalenderdag; de bandeinde-check kijkt daarom ook naar de banden van GISTEREN. `b.end - 1440`
 * is dan `0` voor een exact-om-middernacht-eindigende band, wat correct matcht met `minuteOfDay`
 * van een 00:00-anker de dag erna (een STRIKTE `> 1440` zou precies dit geval missen). Twee
 * aangrenzende banden zonder pauze ertussen (bandeinde van de ene band == bandbegin van de andere,
 * op dezelfde dag) zijn een gedegenereerd geval dat hier als `'START'` uitvalt (de bandbegin-check
 * loopt eerst) — onschadelijk: bij een pauzeloze aaneensluiting is het gat tussen de banden nul,
 * dus of het anker als START van de tweede band of als FINISH van de eerste wordt geclassificeerd
 * maakt voor de datumberekening (dezelfde klokstand, geen dag-boundary-sprong) niets uit.
 */
export function milestoneKindAt(cal: WorkCalendar, anchor: Date): MilestoneKind | undefined {
  const bands = cal.workTime;
  if (!bands) return undefined;
  const wd = isoDayOfWeek(anchor) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const prevWd = (((wd + 5) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7; // wd - 1, gewrapt naar 1..7
  const minuteOfDay = anchor.getUTCHours() * 60 + anchor.getUTCMinutes();
  const todays = bands.byWeekday[wd] ?? [];
  for (const b of todays) {
    if (b.start === minuteOfDay) return 'START';
  }
  for (const b of todays) {
    if (b.end === minuteOfDay) return 'FINISH';
  }
  const yesterdays = bands.byWeekday[prevWd] ?? [];
  for (const b of yesterdays) {
    if (b.end >= 1440 && b.end - 1440 === minuteOfDay) return 'FINISH';
  }
  return undefined;
}

/**
 * {@link promoteHourCalendar} over alle kalenders van een bestand (ook de kalenders die geen taak
 * raakt: afwijkende banden alleen zijn al genoeg). `entries` koppelt elke kalender aan de sleutel
 * waaronder de lezer hem kent (id, of de kalender zelf); het resultaat zijn de sleutels van de
 * kalenders die in uurmodus rekenen.
 */
export function promoteHourCalendars<K>(
  entries: Iterable<readonly [K, WorkCalendar]>,
  signaled: (key: K) => boolean,
  preferCanonicalWhenEmpty: boolean,
): Set<K> {
  const promoted = new Set<K>();
  for (const [key, cal] of entries) {
    if (promoteHourCalendar(cal, getCalendarBands(cal), signaled(key), preferCanonicalWhenEmpty)) promoted.add(key);
  }
  return promoted;
}

/**
 * Bouw de map taak-id → effectieve kalender: `task.calendarId` uit de bibliotheek, anders de
 * projectkalender. Gebruikt door de schrijvers om per taak uur- vs dag-modus te bepalen.
 */
export function effectiveCalendarByTask(
  tasks: Task[],
  projectCal: WorkCalendar,
  library: WorkCalendar[],
): Map<string, WorkCalendar> {
  const byId = new Map<string, WorkCalendar>();
  for (const c of library) byId.set(c.id, c);
  const result = new Map<string, WorkCalendar>();
  for (const t of tasks) {
    result.set(t.id, (t.calendarId && byId.get(t.calendarId)) || projectCal);
  }
  return result;
}

/**
 * De kalenderindeling van een XML-export (MSPDI/P6): de projectkalender krijgt nummer 1, de overige
 * bibliotheekkalenders 2, 3, …; plus per taak de effectieve kalender en de kalenders waarop een
 * urentaak rekent. `resourceCalendars` is de VOLLE bibliotheek (incl. de gemigreerde
 * projectkalender-entry) — die entry uitsluiten voorkomt een dubbele kalender 1.
 */
export function exportCalendarLayout(tasks: Task[], calendar: WorkCalendar, resourceCalendars: WorkCalendar[]): {
  libraryCalendars: WorkCalendar[];
  calendarNumber: Map<string, number>;
  effCalByTask: Map<string, WorkCalendar>;
  hourTaskCalendarIds: Set<string>;
} {
  const libraryCalendars = resourceCalendars.filter(c => c.id !== calendar.id);
  const calendarNumber = new Map<string, number>([[calendar.id, 1]]);
  libraryCalendars.forEach((cal, i) => calendarNumber.set(cal.id, i + 2));
  const effCalByTask = effectiveCalendarByTask(tasks, calendar, libraryCalendars);
  const hourTaskCalendarIds = new Set(tasks.flatMap((task) => {
    const calendarId = taskDurationUnit(task) === 'hours' ? effCalByTask.get(task.id)?.id : undefined;
    return calendarId ? [calendarId] : [];
  }));
  return { libraryCalendars, calendarNumber, effCalByTask, hourTaskCalendarIds };
}


/** Een urentaak kan gepland worden wanneer expliciete óf afleidbare geldige werkbands bestaan. */
export function hasConcreteWorkBlocks(calendar: WorkCalendar): boolean {
  return !!effectiveWorkTimeBands(calendar);
}

/**
 * True als een geladen project urenplanning-data draagt: minstens één kalender met
 * `workTime` (uur-kalender) of minstens één taak met `durationMinutes`.
 * Het rekenprofiel gebruikt deze detectie bij het openen.
 */
export function fileHasHourData(tasks: Task[], calendars: WorkCalendar[]): boolean {
  if (calendars.some(isHourModeCalendar)) return true;
  return tasks.some((t) => taskDurationUnit(t) === 'hours');
}

/**
 * Duur van een taak in minuten voor de SCHRIJVERS (uur-modus): `durationMinutes` als bron van
 * waarheid, anders afgeleid uit de dag-duur (`scheduleDuration × hpd × 60`). Analoog aan
 * `durationMinutesOf` in de engine, maar zonder de engine-afhankelijkheid.
 */
export function taskMinutesForWrite(task: Task, hoursPerDay: number): number {
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return Math.round(task.time.scheduleDuration * hoursPerDay * 60);
}
