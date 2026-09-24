import type { MilestoneKind, Task } from '@/types/task';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import { effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
// Writers moeten ook door tests/extensies aangeleverde pre-T1-objecten (zonder `durationUnit`)
// veilig kunnen bewaren — `taskDurationUnit` draagt dezelfde legacy-regel als de documentmigratie.
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { isoDayOfWeek } from '@/utils/dateUtils';

/**
 * Fase 2.8b (golf 4, ontwerpdoc §7) — gedeelde sub-dag-precisie-helpers voor de IFC/P6/MSPDI-
 * adapters. Alle drie de formaten delen dezelfde discriminator (7-intro, Bevinding 3) en dezelfde
 * minuut↔band-conventies (§3.2); die logica staat hier één keer.
 *
 * NORMATIEVE IMPORT-DISCRIMINATOR (7-intro). Een reader zet `workTime` op een kalender UITSLUITEND
 * bij een echte afwijking van het enkelvoudige dag-patroon:
 *   (a) meer dan één band op een werkdag, of
 *   (b) een band die middernacht kruist (wrap), of
 *   (b2) een band die een VOLLEDIGE dag beslaat (≥1440 min — "24 Hours"-kalender, zie hieronder), of
 *   (c) sub-dag-informatie elders in het bestand — een duur met een uren/minuten-component die niet
 *       op hele dagen valt, of datetimes met een echte tijd-van-de-dag die afwijkt van het
 *       synthetische anker (IFC `T07:00`, P6/MSPDI `T08:00`).
 * Anders blijft het scalar `workStartHour`/`workEndHour`-model staan (dag-modus) ⇒ een round-trip
 * van een dag-bestand blijft byte-identiek.
 *
 * (b2) — INSTRUMENTFIX (Z8-herwerkronde, 2026-08-18, gemeld — dit bestand valt buiten baan S se
 * gewone eigendom, maar de coördinator autoriseerde één gerichte lezer-fix): MSP's ingebouwde
 * "24 Hours"-basiskalender (en elke resource-kalender die 'm kopieert) codeert een werkdag als ÉÉN
 * band `{start:0, end:1440}` — geen tweede band (a), geen middernacht-wrap (b, want `end`(1440) is
 * niet `> 1440`). Zonder (b2) promoveerde zo'n kalender dus NOOIT naar uur-modus (`deviates` bleef
 * `false`), tenzij een TAAK toevallig een eigen (c)-signaal droeg — en resource-kalenders die alleen
 * via een TOEWIJZING (niet via `task.calendarId`) gebruikt worden krijgen nooit zo'n taak-signaal.
 * Gevolg (corpusmeting, mpp14timephased.mpp): de "24 Hour"-resourcekalenders bleven dag-modus, en
 * elke kalenderwandeling die ze als uur-kalender probeerde te gebruiken kreeg stil `isHourMode ===
 * false` (`CalendarEngine`) i.p.v. een fout — een STIL lezer-defect, geen bewijs dat een
 * kalenderwandeling-formule op deze kalenders niet zou werken. Corpusloze fixture:
 * `check-mpp-calendars.ts` (of het bestand waar deze taak 'm plaatst).
 */

const MIN_PER_DAY = 1440;

/** `min` (minuten-vanaf-middernacht, 0..1440) → `'HH:MM:SS'`. */
export function minutesToClock(min: number): string {
  const m = ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
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
 * Minuten → ISO-8601-duur MET tijdcomponent (uur-modus, §7.1/§7.3): vorm `PT{h}H{m}M0S`. Geen
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
 * Canonicaliseer rauwe per-weekdag-banden (minuten-vanaf-middernacht) volgens §3.2: `end > start`
 * (een wrap met niet-oplopende grens wordt `end += 1440`), per dag gesorteerd op start. Meldt
 * tegelijk of de banden AFWIJKEN van het enkelvoudige dag-patroon — discriminator (a) (>1 band op
 * een werkdag), (b) (band over middernacht, `end > 1440`) of (b2) (band die een volledige dag
 * beslaat, `end − start ≥ 1440` — de "24 Hours"-instrumentfix, zie de moduleheader hierboven).
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

/**
 * Afgeleide `hoursPerDay` uit banden (§3.2, Bevinding 8): de MODALE dagsom over de werk-weekdagen
 * (meest voorkomende Σ bandlengtes / 60), bij gelijkspel de HOOGSTE. Spiegelt
 * `CalendarEngine.computeDerivedHoursPerDay`, zodat de opgeslagen `hoursPerDay` (die de adapters
 * voor hun dag↔uur-conversie gebruiken) consistent is met wat de engine berekent.
 */
export function deriveHoursPerDay(bands: WorkTimeBands, fallback: number): number {
  const sums: number[] = [];
  for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    const list = bands.byWeekday[wd];
    if (!list || list.length === 0) continue;
    sums.push(list.reduce((s, b) => s + (b.end - b.start), 0) / 60);
  }
  if (sums.length === 0) return fallback;
  const freq = new Map<number, number>();
  for (const h of sums) freq.set(h, (freq.get(h) ?? 0) + 1);
  let best = sums[0];
  let bestCount = 0;
  for (const [h, c] of freq) {
    if (c > bestCount || (c === bestCount && h > best)) {
      best = h;
      bestCount = c;
    }
  }
  return best;
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
 * Byte-identiek gedeeld door de IFC/MSPDI/P6-readers (voorheen `synth*BandsFromScalar` 3×, F5-d).
 */
export function synthBandsFromScalar(cal: WorkCalendar): WorkTimeBands {
  const raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const band = { start: cal.workStartHour * 60, end: cal.workEndHour * 60 };
  for (const wd of cal.workDays) if (wd >= 1 && wd <= 7) raw[wd as 1] = [{ ...band }];
  return canonicalizeBands(raw).bands;
}

/**
 * Rauwe (gecanonicaliseerde) banden per gelezen kalender-object + of ze afwijken van het
 * enkelvoudige dag-patroon (discriminator (a)/(b)). Eén gedeelde WeakMap (F5-e): de sleutels zijn de
 * per-parse aangemaakte `WorkCalendar`-objecten — elke reader maakt zijn eigen kalenders, dus de drie
 * voormalige per-reader-registers deelden nooit een sleutel. Samenvoegen kan daarom niet lekken en
 * verandert geen enkel gedrag. WeakMap ⇒ per-parse, automatisch opgeruimd.
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
 * (`signaled`). Zet `workTime` + afgeleide `workDays`/`hoursPerDay`. Retourneert of de kalender (nu)
 * uur-modus is — inclusief het geval dat hij al `workTime` droeg. Gedeelde promotie-orkestratie (F5-c);
 * de readers houden zelf hun format-specifieke signaal-verzameling (`cSignalCalIds`/`subDayCals`).
 *
 * `preferCanonicalWhenEmpty` bewaart een BEWUST formaatverschil (F5): het IFC-pad koos altijd de
 * geregistreerde canonical zodra er info was (`info?.canonical ?? synth`), terwijl MSPDI/P6 terugvallen
 * op de scalar-synth zodra de canonical geen werkdag draagt (`length > 0 ? canonical : synth`). Dat
 * verschil raakt alleen de edge-case «geregistreerd maar leeg, gepromoveerd via een (c)-signaal»; om
 * geen enkel formaat stil te veranderen blijft dat per formaat exact behouden.
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
 * T11 (§9/O6-vervolg): geeft `milestoneKind` aan een UUR-modus-mijlpaal wanneer het opgeslagen
 * anker EXACT op een bandgrens van de effectieve kalender ligt — de informatie die T6's solverkant
 * (`succIsFinishMs`/`predEndsBeginOfDay` in `relationMath.ts`) nodig heeft om MS Projects eigen
 * klokstand (bv. `…T17:00`) te herkennen i.p.v. de eerstvolgende werk-instant (`…T08:00` de
 * volgende dag) te forceren. Gedeeld door de MPP- en de MSPDI-lezer (de MSPDI-kopie liep eerder
 * een fix achter: de STRIKTE `> 1440` hieronder, een pariteitsregressie tussen de twee lezers).
 *
 * Kijkt UITSLUITEND naar de KALENDER-EIGEN weekdagbanden (`cal.workTime.byWeekday`, ná promotie
 * door `promoteHourCalendars` — op het moment dat de lezer dit aanroept is `cal.workTime` dus al
 * gezet voor elke uurkalender). Geen dag-specifieke holiday-/werkuitzondering-
 * materialisatie (dat is `CalendarEngine`'s taak in de solver, buiten deze lezer se scope): een
 * mijlpaal-anker landt per definitie nooit op een holiday (die dag heeft geen banden in
 * `byWeekday`), en een werkende uitzondering met eigen banden is een T3-aangelegenheid — als de
 * corpusmeting ooit een taak op zo'n dag laat zien die hierdoor ten onrechte `undefined` blijft,
 * is dat een T13-heroverweging, geen gat in deze functie.
 *
 * `minuteOfDay` vergelijkt op UTC-getters (`getUTCHours`/`getUTCMinutes`) — spiegelt de rest van de
 * engine, die overal in UTC-instants zonder DST rekent (zie `dateUtils.ts`'s moduleheader).
 * Seconden worden genegeerd (de tijdstempels zijn minuut-precies).
 *
 * Bandbegin ⇒ `'START'`; bandeinde ⇒ `'FINISH'`; anders `undefined` (huidig gedrag: geen veld
 * gezet). Een WRAP-band (`end >= 1440`, middernacht-kruisend — INCLUSIEF een band die EXACT om
 * middernacht eindigt, bv. een ploegendienst 20:00–24:00: `resolveOneDay` bouwt zo'n band zonder
 * clamp en `canonicalizeBands` beschouwt 'm niet als afwijkend, dus dit is een volstrekt normale
 * vorm elders in de codebase, geen theoretisch randgeval) staat geregistreerd onder de WEEKDAG
 * WAAROP HIJ BEGINT (§3.2 in `types/calendar.ts`) — de staart landt dus op de VOLGENDE
 * kalenderdag; de bandeinde-check kijkt daarom ook naar de banden van GISTEREN. `b.end - 1440`
 * is dan `0` voor een exact-om-middernacht-eindigende band, wat correct matcht met `minuteOfDay`
 * van een 00:00-anker de dag erna (reviewbevinding: de eerdere STRIKTE `> 1440` miste precies dit
 * geval — een band die letterlijk op middernacht eindigt in plaats van erover heen). Twee
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
 * Bouw de map taak-id → effectieve kalender (§5): `task.calendarId` uit de bibliotheek, anders de
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
 * urentaak rekent (fase 2.8b, §7.2/§7.3). `resourceCalendars` is sinds 2.8a de VOLLE bibliotheek
 * (incl. de §4.3-gemigreerde projectkalender-entry) — die entry uitsluiten voorkomt een dubbele
 * kalender 1.
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

/** Een kalender is uur-modus zodra `workTime` aanwezig is (§3.2). */
export function isHourCalendar(cal: WorkCalendar | undefined): boolean {
  return !!cal?.workTime;
}

/** Een urentaak kan gepland worden wanneer expliciete óf afleidbare geldige werkbands bestaan. */
export function hasConcreteWorkBlocks(calendar: WorkCalendar): boolean {
  return !!effectiveWorkTimeBands(calendar);
}

/**
 * True als een geladen project urenplanning-data draagt (§6.8): minstens één kalender met
 * `workTime` (uur-kalender) of minstens één taak met `durationMinutes`. Gebruikt om de
 * niet-blokkerende uur-data-melding te tonen wanneer de hoofdschakelaar Urenplanning uit staat —
 * nooit stil wegronden.
 */
export function fileHasHourData(tasks: Task[], calendars: WorkCalendar[]): boolean {
  if (calendars.some(isHourCalendar)) return true;
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
