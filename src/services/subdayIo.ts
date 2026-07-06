import type { Task } from '@/types/task';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

/**
 * Fase 2.8b (golf 4, ontwerpdoc §7) — gedeelde sub-dag-precisie-helpers voor de IFC/P6/MSPDI-
 * adapters. Alle drie de formaten delen dezelfde discriminator (7-intro, Bevinding 3) en dezelfde
 * minuut↔band-conventies (§3.2); die logica staat hier één keer.
 *
 * NORMATIEVE IMPORT-DISCRIMINATOR (7-intro). Een reader zet `workTime` op een kalender UITSLUITEND
 * bij een echte afwijking van het enkelvoudige dag-patroon:
 *   (a) meer dan één band op een werkdag, of
 *   (b) een band die middernacht kruist (wrap), of
 *   (c) sub-dag-informatie elders in het bestand — een duur met een uren/minuten-component die niet
 *       op hele dagen valt, of datetimes met een echte tijd-van-de-dag die afwijkt van het
 *       synthetische anker (IFC `T07:00`, P6/MSPDI `T08:00`).
 * Anders blijft het scalar `workStartHour`/`workEndHour`-model staan (dag-modus) ⇒ een round-trip
 * van een dag-bestand blijft byte-identiek.
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
 * een werkdag) of (b) (band over middernacht, `end > 1440`).
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
        let end = b.end;
        if (end <= b.start) end += MIN_PER_DAY; // ongeldige encoding → canoniek wrap
        if (end > MIN_PER_DAY) deviates = true; // (b) wrap over middernacht
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

/** Een kalender is uur-modus zodra `workTime` aanwezig is (§3.2). */
export function isHourCalendar(cal: WorkCalendar | undefined): boolean {
  return !!cal?.workTime;
}

/**
 * True als een geladen project urenplanning-data draagt (§6.8): minstens één kalender met
 * `workTime` (uur-kalender) of minstens één taak met `durationMinutes`. Gebruikt om de
 * niet-blokkerende uur-data-melding te tonen wanneer de hoofdschakelaar Urenplanning uit staat —
 * nooit stil wegronden.
 */
export function fileHasHourData(tasks: Task[], calendars: WorkCalendar[]): boolean {
  if (calendars.some(isHourCalendar)) return true;
  return tasks.some((t) => t.time.durationMinutes != null);
}

/**
 * Duur van een taak in minuten voor de SCHRIJVERS (uur-modus): `durationMinutes` als bron van
 * waarheid, anders afgeleid uit de dag-duur (`scheduleDuration × hpd × 60`). Analoog aan
 * `durationMinutesOf` in de engine, maar zonder de engine-afhankelijkheid.
 */
export function taskMinutesForWrite(task: Task, hoursPerDay: number): number {
  const dm = task.time.durationMinutes;
  if (dm != null) return dm;
  return Math.round(task.time.scheduleDuration * hoursPerDay * 60);
}
