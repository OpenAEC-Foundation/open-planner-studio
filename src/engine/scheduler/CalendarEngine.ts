import { WorkCalendar } from '@/types/calendar';
import { parseDate, isoDayOfWeek, addCalendarDays, formatDate, diffCalendarDays } from '@/utils/dateUtils';

/** Eén gematerialiseerd werk-interval, absolute UTC-ms, half-open `[start, end)` (fase 2.8b, §4.2). */
interface BandInterval {
  start: number;
  end: number;
}

/** Band-uitrol-cache, GEMEMOIZED op het KALENDER-OBJECT (§5.6). Twee `CalendarEngine`-instanties
 *  die op hetzelfde kalender-object worden gebouwd (bv. de 4 solver-instantiaties) delen deze
 *  cache — de uitrol wordt zo één keer gedaan. `fills` telt de dag-materialisaties (cache-misses)
 *  en is observeerbaar voor de memoization-test. */
interface BandCache {
  days: Map<number, BandInterval[]>;
  fills: number;
}

/** WeakMap kalender-object → gedeelde band-cache. Bewust op het OBJECT (identiteit), niet per
 *  engine-instantie, zodat parallelle engines op dezelfde kalender de uitrol delen (§5.6). */
const bandCacheRegistry = new WeakMap<WorkCalendar, BandCache>();

export class CalendarEngine {
  private calendar: WorkCalendar;
  private holidaySet: Set<string>;
  // ── Numerieke afgeleide structuren (pakket A1/A2, gedragsneutraal) ─────────────
  // Vervangen de string/dag-voor-dag-hotpaths in isWorkDay/workDaysBetween door
  // O(1)- resp. O(1+#holidays·log)-arithmetiek. NAAST de bestaande string-structuren:
  // de uur-modus (bandsStartingOn/isHoliday) blijft byte-identiek op holidaySet leunen.
  private workDayMask: boolean[];         // index 1..7 (ISO-weekdag) ⇒ is-werkdag
  private workDaysPerWeek: number;        // som van true in workDayMask[1..7]
  private holidayDaySet: Set<number>;     // UTC-dagindices van alle holiday-dagen
  private holidayWorkdayIdxSorted: number[]; // holiday-dagindices OP een werk-weekdag, oplopend
  // Veiligheidsgrenzen tegen vastlopen bij een kapotte kalender (geen werkdagen)
  // of een ongeldige/sentinel-datum: MAX_SCAN = max dagen zoeken naar een werkdag;
  // MAX_DAYS = absolute iteratielimiet (~547 jaar) voor de tel-lussen.
  private static readonly MAX_SCAN = 366;
  private static readonly MAX_DAYS = 200_000;
  // Uur-modus (fase 2.8b): absolute minuut-grens, analoog aan MAX_SCAN/MAX_DAYS. Een duur groter
  // dan dit wordt niet uitgeteld (een kapotte/sentinel-invoer mag de banden-lus niet laten hangen).
  private static readonly MAX_MINUTES = CalendarEngine.MAX_DAYS * 24 * 60;
  private static readonly MS_PER_MIN = 60_000;
  private static readonly MS_PER_DAY = 86_400_000;

  // ── Fase 2.8b: uur-modus-state (dood in dag-modus) ─────────────────────────
  private mode: 'day' | 'hour' = 'day';
  private derivedHpd = 0;
  private bandCache?: BandCache;

  constructor(calendar: WorkCalendar) {
    this.calendar = calendar;
    // Werkdag-masker + weekdag-som (numeriek, pakket A1/A2). Alleen indices 1..7 tellen mee;
    // een out-of-range workDays-entry raakt nooit een echte isoDayOfWeek (1..7) en verstoort
    // dus niets — byte-identiek met de oude `workDays.includes(...)`-semantiek.
    this.workDayMask = new Array(8).fill(false);
    for (const wd of this.calendar.workDays) this.workDayMask[wd] = true;
    this.workDaysPerWeek = 0;
    for (let wd = 1; wd <= 7; wd++) if (this.workDayMask[wd]) this.workDaysPerWeek++;
    this.holidaySet = new Set<string>();
    this.holidayDaySet = new Set<number>();
    this.buildHolidaySet(); // vult zowel de string-set (uur-modus) als de numerieke dagindex-set
    // Holiday-dagen die OP een werk-weekdag vallen, gededupliceerd (via de Set) en oplopend
    // gesorteerd — de aftrekterm van workDaysBetween (binary-search-telling per bereik).
    this.holidayWorkdayIdxSorted = [...this.holidayDaySet]
      .filter((idx) => this.workDayMask[isoDayOfWeek(new Date(idx * CalendarEngine.MS_PER_DAY))])
      .sort((a, b) => a - b);
    // ── Fase 2.8b: modus-detectie + uur-setup (§4.1). Afwezige `workTime` ⇒ dag-modus:
    //    dan wordt niets hieronder geraakt en draaien de bevroren dag-lussen ongewijzigd.
    this.mode = calendar.workTime ? 'hour' : 'day';
    if (this.mode === 'hour') {
      this.derivedHpd = this.computeDerivedHoursPerDay();
      let cache = bandCacheRegistry.get(calendar);
      if (!cache) {
        cache = { days: new Map(), fills: 0 };
        bandCacheRegistry.set(calendar, cache);
      }
      this.bandCache = cache;
    }
  }

  private buildHolidaySet(): void {
    for (const holiday of this.calendar.holidays) {
      const start = parseDate(holiday.startDate);
      const end = parseDate(holiday.endDate);
      const days = diffCalendarDays(start, end);
      for (let i = 0; i <= days; i++) {
        const d = addCalendarDays(start, i);
        this.holidaySet.add(formatDate(d));
        this.holidayDaySet.add(Math.floor(d.getTime() / CalendarEngine.MS_PER_DAY));
      }
    }
  }

  /** Heeft de kalender überhaupt werkdagen? Een lege werkweek levert anders stil onzin-datums. */
  hasWorkingDays(): boolean {
    return Array.isArray(this.calendar.workDays) && this.calendar.workDays.length > 0;
  }

  /** Check if a given date is a working day.
   *  Pakket A1 (gedragsneutraal): numeriek i.p.v. `workDays.includes` + `formatDate`.
   *  `floor(ms/MS_PER_DAY)` = dezelfde UTC-dagindex als `formatDate` (epoch op UTC-middernacht).
   *  Ongeldige datum: `isoDayOfWeek`→NaN ⇒ `workDayMask[NaN]`=undefined ⇒ return false (identiek
   *  aan het oude `workDays.includes(NaN)===false`, dat óók vóór `formatDate` short-circuitte). */
  isWorkDay(date: Date): boolean {
    const dow = isoDayOfWeek(date);
    if (!this.workDayMask[dow]) return false;
    const dayIdx = Math.floor(date.getTime() / CalendarEngine.MS_PER_DAY);
    if (this.holidayDaySet.has(dayIdx)) return false;
    return true;
  }

  /** Check if a given date string is a holiday */
  isHoliday(dateStr: string): boolean {
    return this.holidaySet.has(dateStr);
  }

  /**
   * Add working days to a start date.
   * Returns the end date (the last working day).
   * For duration=0 (milestone), returns the start date itself.
   */
  addWorkDays(startDate: Date, workDays: number): Date {
    if (workDays <= 0) return new Date(startDate.getTime());

    let current = new Date(startDate.getTime());
    // Ensure we start on a work day
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return current; // geen werkdag — niet vastlopen
    }

    let remaining = workDays - 1; // first work day counts as day 1
    let steps = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, 1);
      if (this.isWorkDay(current)) {
        remaining--;
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return current;
  }

  /**
   * Calculate the number of working days between two dates (inclusive).
   *
   * Pakket A2 (gedragsneutraal, de O(n²)-killer): arithmetisch i.p.v. dag-voor-dag scannen.
   * Semantiek die exact wordt gerepliceerd t.o.v. de oude lus:
   *  - De oude lus checkte dagen k=0,1,… met dagindex `startIdx+k` zolang
   *    `startMs + k·MS_PER_DAY ≤ endMs` (elke +1 kalenderdag = +MS_PER_DAY in UTC, geen DST).
   *    Aantal dagen = `floor((endMs−startMs)/MS_PER_DAY)+1` als `endMs≥startMs`, anders 0.
   *  - CAP: de oude lus brak af zodra `steps > MAX_DAYS`; hij checkte dan de dagen k=0..MAX_DAYS
   *    (= MAX_DAYS+1 dagen) vóór hij stopte ⇒ `cappedDays = min(totalDays, MAX_DAYS+1)`.
   * Telling: #werk-weekdagen in het (gecapte) bereik − #(holidays op een werk-weekdag) daarin.
   */
  workDaysBetween(start: Date, end: Date): number {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (!(endMs >= startMs)) return 0; // dekt endMs<startMs én NaN (NaN>=x is false) — 0-iteratie-lus
    const totalDays = Math.floor((endMs - startMs) / CalendarEngine.MS_PER_DAY) + 1;
    const cappedDays = Math.min(totalDays, CalendarEngine.MAX_DAYS + 1);
    const startIdx = Math.floor(startMs / CalendarEngine.MS_PER_DAY);
    const lastIdx = startIdx + cappedDays - 1;
    return this.countWorkWeekdays(startIdx, lastIdx) - this.countHolidayWorkdaysInRange(startIdx, lastIdx);
  }

  /** #werk-weekdagen in het INCLUSIEVE dagindex-bereik [startIdx, lastIdx]. Volledige weken dragen
   *  elk `workDaysPerWeek` bij (elke weekdag komt precies één keer voor); de resterende dagen worden
   *  uitgeteld vanaf de weekdag van `startIdx` (consistent met de per-dag-check in de oude lus). */
  private countWorkWeekdays(startIdx: number, lastIdx: number): number {
    const L = lastIdx - startIdx + 1;
    if (L <= 0) return 0;
    const fullWeeks = Math.floor(L / 7);
    let count = fullWeeks * this.workDaysPerWeek;
    const rem = L - fullWeeks * 7;
    if (rem > 0) {
      let wd = isoDayOfWeek(new Date(startIdx * CalendarEngine.MS_PER_DAY)); // 1..7
      for (let i = 0; i < rem; i++) {
        if (this.workDayMask[wd]) count++;
        wd = wd === 7 ? 1 : wd + 1;
      }
    }
    return count;
  }

  /** Aantal holiday-dagen ÓP een werk-weekdag in het inclusieve bereik [startIdx, lastIdx], via
   *  lower/upper-bound binary search over de oplopende `holidayWorkdayIdxSorted`. */
  private countHolidayWorkdaysInRange(startIdx: number, lastIdx: number): number {
    const a = this.holidayWorkdayIdxSorted;
    // lo = eerste index i met a[i] >= startIdx (lower bound)
    let lo = 0;
    let loHi = a.length;
    while (lo < loHi) {
      const mid = (lo + loHi) >>> 1;
      if (a[mid] < startIdx) lo = mid + 1;
      else loHi = mid;
    }
    // hi = eerste index i met a[i] > lastIdx (upper bound)
    let hi = 0;
    let hiHi = a.length;
    while (hi < hiHi) {
      const mid = (hi + hiHi) >>> 1;
      if (a[mid] <= lastIdx) hi = mid + 1;
      else hiHi = mid;
    }
    return hi - lo;
  }

  /**
   * Get the next working day on or after the given date.
   */
  nextWorkDay(date: Date): Date {
    let current = new Date(date.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  /**
   * Get the next working day strictly after the given date.
   */
  nextWorkDayAfter(date: Date): Date {
    let current = addCalendarDays(date, 1);
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  /**
   * Eerste werkdag op of vóór de datum (spiegel van nextWorkDay). Gebruikt om een
   * kalenderdag-lag in de backward-pass richtingbewust op een werkdag te snappen:
   * een bovengrens ("niet later dan…") die op een weekend valt, hoort terug naar vrijdag.
   */
  prevWorkDay(date: Date): Date {
    let current = new Date(date.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, -1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  /**
   * Get the next working day strictly before the given date.
   * Spiegel van nextWorkDayAfter — gebruikt door de backward-pass zodat de
   * "successor start de werkdag ná de predecessor"-relatie symmetrisch terugloopt.
   */
  prevWorkDayBefore(date: Date): Date {
    let current = addCalendarDays(date, -1);
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, -1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  /**
   * Subtract working days from an end date.
   * Returns the start date.
   */
  subtractWorkDays(endDate: Date, workDays: number): Date {
    if (workDays <= 0) return new Date(endDate.getTime());

    let current = new Date(endDate.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, -1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }

    let remaining = workDays - 1;
    let steps = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, -1);
      if (this.isWorkDay(current)) {
        remaining--;
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return current;
  }

  /**
   * Verschuif `n` werkdagen vanaf een datum: n=0 => dezelfde (werk)dag, n>0 vooruit, n<0 achteruit.
   * Anders dan addWorkDays/subtractWorkDays telt de begindag hier NIET als "dag 1" — dit is een
   * zuivere offset over werkdagen. Nodig voor correcte lag/lead (positief, negatief én 0) en voor
   * de relatie-logica (FF/SF) in de CPM-solver, waar "N werkdagen verderop/eerder" exact N moet zijn.
   *
   * INVARIANT: de aanroeper voert een wérkdag aan. Alle CPM-paden garanderen dat (early/late-datums
   * zijn altijd werkdagen); een kalenderdag-lag die op een weekend landt wordt op de gebruiksplek
   * eerst richtingbewust gesnapt (forward: nextWorkDay, backward: prevWorkDay) vóór hij hier
   * binnenkomt. Een niet-werkdag zou hier vooruit normaliseren, wat voor n<0 een dag zou schelen.
   */
  addWorkingDaysSigned(date: Date, n: number): Date {
    let current = this.nextWorkDay(new Date(date.getTime()));
    if (n === 0) return current;
    const step = n > 0 ? 1 : -1;
    let remaining = Math.abs(n);
    let guard = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, step);
      if (this.isWorkDay(current)) remaining--;
      if (++guard > CalendarEngine.MAX_DAYS) break;
    }
    return current;
  }

  get hoursPerDay(): number {
    if (this.mode === 'hour') return this.derivedHpd;
    return this.calendar.hoursPerDay;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Fase 2.8b — UUR-MODUS (§4). Alles hieronder is DOOD in dag-modus: geen enkele
  //  bestaande dag-lus hierboven roept iets van dit blok aan. De solver (golf 2)
  //  dispatcht per taak via `isHourMode` (§5.1). Conventies (§4.1):
  //    band = [start, end);  nextWorkInstant(t)=t als t∈[start,end);
  //    prevWorkInstant(t)=t als t∈(start,end];  strikte varianten met "After"/"Before".
  // ═══════════════════════════════════════════════════════════════════════════

  /** True ⇒ uur-kalender (`workTime` aanwezig). Vervult het `DurationCalendar`-contract (duration.ts). */
  get isHourMode(): boolean {
    return this.mode === 'hour';
  }

  /** Afgeleide `hoursPerDay` voor een uur-kalender (§3.2, Bevinding 8): de MODALE band-som over de
   *  werk-weekdagen (meest voorkomende dagsom in uren), bij gelijkspel de HOOGSTE. */
  private computeDerivedHoursPerDay(): number {
    const byWeekday = this.calendar.workTime!.byWeekday;
    const sums: number[] = [];
    for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
      const bands = byWeekday[wd] ?? [];
      if (bands.length === 0) continue; // niet-werkdag telt niet mee
      const minutes = bands.reduce((s, b) => s + (b.end - b.start), 0);
      sums.push(minutes / 60);
    }
    if (sums.length === 0) return this.calendar.hoursPerDay; // fallback: geen banden
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

  // ── Band-materialisatie (venster-gebaseerd, gememoized op het kalender-object, §4.2/§5.6) ──

  /** UTC-middernacht-ms van de dag die `ms` bevat (epoch is op UTC-middernacht uitgelijnd). */
  private dayStartMsOf(ms: number): number {
    return Math.floor(ms / CalendarEngine.MS_PER_DAY) * CalendarEngine.MS_PER_DAY;
  }

  /** Absolute werk-intervallen voor de banden die op de dag `dayMs` STARTEN (§4.2). Een holiday op
   *  díé dag onderdrukt uitsluitend de banden die er starten (Bevinding 9); de staart na middernacht
   *  van de wrap-band van de vórige dag hoort bij die vorige dag en loopt gewoon door (hij wordt bij
   *  díé dag gematerialiseerd). Gememoized op de gedeelde kalender-cache. */
  private bandsStartingOn(dayMs: number): BandInterval[] {
    const cache = this.bandCache!;
    const hit = cache.days.get(dayMs);
    if (hit) return hit;
    cache.fills++;
    const d = new Date(dayMs);
    let result: BandInterval[];
    if (this.holidaySet.has(formatDate(d))) {
      result = []; // holiday onderdrukt de shifts die op deze dag STARTEN
    } else {
      const wd = isoDayOfWeek(d) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      const bands = this.calendar.workTime!.byWeekday[wd] ?? [];
      result = bands.map((b) => ({
        start: dayMs + b.start * CalendarEngine.MS_PER_MIN,
        end: dayMs + b.end * CalendarEngine.MS_PER_MIN,
      }));
    }
    cache.days.set(dayMs, result);
    return result;
  }

  /** De band die `tMs` bevat, of null. `leftOpen=false` ⇒ voorwaartse conventie `[start,end)`;
   *  `leftOpen=true` ⇒ achterwaartse conventie `(start,end]`. Scant de huidige dag plus twee dagen
   *  terug om de staart van een wrap-band (`end ∈ (1440,2880]`) op te vangen. */
  private findContaining(tMs: number, leftOpen: boolean): BandInterval | null {
    const day0 = this.dayStartMsOf(tMs);
    for (let k = -2; k <= 0; k++) {
      const dayMs = day0 + k * CalendarEngine.MS_PER_DAY;
      for (const band of this.bandsStartingOn(dayMs)) {
        const inside = leftOpen
          ? band.start < tMs && tMs <= band.end
          : band.start <= tMs && tMs < band.end;
        if (inside) return band;
      }
    }
    return null;
  }

  /** Vroegste bandstart strikt > `tMs` (in ms). Dag-scan vooruit; banden zijn per dag gesorteerd en
   *  dag-starts lopen op, dus de eerste hit is globaal de kleinste. */
  private nextBandStartStrictAfter(tMs: number): number {
    let dayMs = this.dayStartMsOf(tMs);
    let scan = 0;
    while (scan <= CalendarEngine.MAX_SCAN) {
      for (const band of this.bandsStartingOn(dayMs)) {
        if (band.start > tMs) return band.start;
      }
      dayMs += CalendarEngine.MS_PER_DAY;
      scan++;
    }
    return tMs; // geen werkdagen — best effort (kapotte kalender)
  }

  /** Laatste band-eind ≤ `tMs` (of strikt < bij `strict`), in ms. Dag-scan achteruit; stopt zodra
   *  geen eerdere dag het beste resultaat nog kan verbeteren (max mogelijke eind = dagstart+2880m). */
  private prevBandEndBound(tMs: number, strict: boolean): number {
    let best = Number.NEGATIVE_INFINITY;
    let dayMs = this.dayStartMsOf(tMs);
    let scan = 0;
    const span = 2880 * CalendarEngine.MS_PER_MIN;
    while (scan <= CalendarEngine.MAX_SCAN) {
      if (best !== Number.NEGATIVE_INFINITY && dayMs + span <= best) break;
      for (const band of this.bandsStartingOn(dayMs)) {
        const ok = strict ? band.end < tMs : band.end <= tMs;
        if (ok && band.end > best) best = band.end;
      }
      dayMs -= CalendarEngine.MS_PER_DAY;
      scan++;
    }
    return best === Number.NEGATIVE_INFINITY ? tMs : best;
  }

  // ── Instant-vinders (§4.1) ─────────────────────────────────────────────────

  /** t valt binnen een band `[start,end)`. Uur-tegenhanger van `isWorkDay`. */
  isWorkInstant(t: Date): boolean {
    return this.findContaining(t.getTime(), false) !== null;
  }

  /** t als t ∈ `[bandstart, bandeind)`, anders de eerstvolgende bandstart > t (§4.1). */
  nextWorkInstant(t: Date): Date {
    const tMs = t.getTime();
    if (this.findContaining(tMs, false)) return new Date(tMs);
    return new Date(this.nextBandStartStrictAfter(tMs));
  }

  /** De eerstvolgende bandstart STRIKT > t (bij band-eindgrens: de volgende band) (§4.1). */
  nextWorkInstantAfter(t: Date): Date {
    return new Date(this.nextBandStartStrictAfter(t.getTime()));
  }

  /** t als t ∈ `(bandstart, bandeind]`, anders het laatste band-eind ≤ t (§4.1). Een finish exact op
   *  een band-eind is legitiem en blijft staan (rand `(start,end]`). */
  prevWorkInstant(t: Date): Date {
    const tMs = t.getTime();
    if (this.findContaining(tMs, true)) return new Date(tMs);
    return new Date(this.prevBandEndBound(tMs, false));
  }

  /** Het laatste band-eind STRIKT < t (§4.1). */
  prevWorkInstantBefore(t: Date): Date {
    return new Date(this.prevBandEndBound(t.getTime(), true));
  }

  // ── Minuut-lussen (§4.2) ───────────────────────────────────────────────────

  /** Tel `minutes` werkminuten op vanaf `startInstant` (§4.2): verbruik over opeenvolgende banden,
   *  spring bij een bandgrens naar de volgende bandstart. Een verbruik dat exact op een band-eind
   *  landt geeft die eindgrens terug (legitiem finish-moment). `minutes ≤ 0` ⇒ start ongewijzigd
   *  (spiegelt `addWorkDays`' `≤0`-tak, voor mijlpalen). */
  addWorkMinutes(startInstant: Date, minutes: number): Date {
    if (minutes <= 0) return new Date(startInstant.getTime());
    let remaining = Math.min(minutes, CalendarEngine.MAX_MINUTES);
    let curMs = this.nextWorkInstant(startInstant).getTime();
    let steps = 0;
    while (remaining > 0) {
      const band = this.findContaining(curMs, false);
      if (!band) break; // geen werk (kapotte kalender) — niet vastlopen
      const availMin = (band.end - curMs) / CalendarEngine.MS_PER_MIN;
      if (remaining <= availMin) {
        curMs += remaining * CalendarEngine.MS_PER_MIN;
        remaining = 0;
      } else {
        remaining -= availMin;
        curMs = this.nextWorkInstant(new Date(band.end)).getTime(); // band-eind ⇒ volgende bandstart
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return new Date(curMs);
  }

  /** Trek `minutes` werkminuten af van `endInstant` (spiegel van `addWorkMinutes`, §4.2/§5.2). Een
   *  landing exact op een bandstart is legitiem (rand `(start,end]`). */
  subtractWorkMinutes(endInstant: Date, minutes: number): Date {
    if (minutes <= 0) return new Date(endInstant.getTime());
    let remaining = Math.min(minutes, CalendarEngine.MAX_MINUTES);
    let curMs = this.prevWorkInstant(endInstant).getTime();
    let steps = 0;
    while (remaining > 0) {
      const band = this.findContaining(curMs, true);
      if (!band) break;
      const availMin = (curMs - band.start) / CalendarEngine.MS_PER_MIN;
      if (remaining <= availMin) {
        curMs -= remaining * CalendarEngine.MS_PER_MIN;
        remaining = 0;
      } else {
        remaining -= availMin;
        curMs = this.prevWorkInstant(new Date(band.start)).getTime(); // bandstart ⇒ vorig band-eind
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return new Date(curMs);
  }

  /** Getekende werkminuten in `[a,b)` (§5.5, voor vrije speling). Positief als b>a, negatief als
   *  b<a, 0 als gelijk. */
  workMinutesBetween(a: Date, b: Date): number {
    const aMs = a.getTime();
    const bMs = b.getTime();
    if (aMs === bMs) return 0;
    const sign = bMs > aMs ? 1 : -1;
    const lo = Math.min(aMs, bMs);
    const hi = Math.max(aMs, bMs);
    let total = 0;
    // Begin twee dagen vóór `lo`: een wrap-band (end ≤ +2880m) van een eerdere dag kan in [lo,hi) reiken.
    let dayMs = this.dayStartMsOf(lo) - 2 * CalendarEngine.MS_PER_DAY;
    let steps = 0;
    while (dayMs < hi) {
      for (const band of this.bandsStartingOn(dayMs)) {
        const s = Math.max(band.start, lo);
        const e = Math.min(band.end, hi);
        if (e > s) total += (e - s) / CalendarEngine.MS_PER_MIN;
      }
      dayMs += CalendarEngine.MS_PER_DAY;
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return sign * total;
  }

  /** Zuivere getekende offset over werkminuten (uur-tegenhanger van `addWorkingDaysSigned`, voor
   *  lag/lead). m=0 ⇒ genormaliseerd naar `nextWorkInstant(t)`; m>0 vooruit, m<0 achteruit. */
  addWorkingMinutesSigned(t: Date, m: number): Date {
    const current = this.nextWorkInstant(t);
    if (m === 0) return current;
    return m > 0 ? this.addWorkMinutes(current, m) : this.subtractWorkMinutes(current, -m);
  }

  // ── Cross-modus-primitieven (§4.3) — de solver (golf 2) wisselt hiermee tussen dag- en uur-taken ──

  /** De dag-van-t indien t exact op middernacht valt, anders de volgende dag (§4.3). Modus-agnostisch
   *  (zuivere datum-rekenkunde): een dag-taak kan niet midden op een dag starten. */
  ceilToWorkDay(t: Date): Date {
    const tMs = t.getTime();
    const dayMs = this.dayStartMsOf(tMs);
    return new Date(tMs === dayMs ? dayMs : dayMs + CalendarEngine.MS_PER_DAY);
  }

  /** De exclusieve "beschikbaar-vanaf"-instant die een taak op DEZE engine als VOORGANGER levert
   *  (§4.3). Uur-modus ⇒ de exclusieve finish-instant zelf; dag-modus ⇒ `(ef + 1 dag) @ 00:00` (de
   *  dag-taak bezet zijn hele finish-dag). In een puur dag→dag-net levert de combinatie met
   *  `availableStart` exact `nextWorkDayAfter(ef)` — bit-identiek met het huidige gedrag. */
  predDoneAt(ef: Date): Date {
    if (this.mode === 'hour') return new Date(ef.getTime());
    return new Date(this.dayStartMsOf(ef.getTime()) + CalendarEngine.MS_PER_DAY);
  }

  /** De ES die een taak op DEZE engine als OPVOLGER consumeert uit een `predDoneAt`-instant (§4.3).
   *  Uur-modus ⇒ `nextWorkInstant(predDoneAt)`; dag-modus ⇒ `nextWorkDay(ceilToWorkDay(predDoneAt))`. */
  availableStart(predDoneAt: Date): Date {
    if (this.mode === 'hour') return this.nextWorkInstant(predDoneAt);
    return this.nextWorkDay(this.ceilToWorkDay(predDoneAt));
  }

  /**
   * Werk-intervallen (absolute UTC-`Date`-paren, half-open `[start,end)`) die het venster
   * `[from, to]` snijden — voor de balk-opsplitsing/bar-necking in de Gantt (§6.9). Hergebruikt de
   * op het kalender-object GEMEMOIZEDE band-materialisatie (`bandsStartingOn`), dus geen extra
   * uitrol per frame. Alleen zinvol in uur-modus; een dag-kalender geeft `[]` (dag-taken renderen
   * altijd doorlopend). Scant vanaf de dag vóór `from` om de na-middernacht-staart van een
   * wrap-band (nachtploeg) mee te nemen.
   */
  workIntervalsBetween(from: Date, to: Date): { start: Date; end: Date }[] {
    if (this.mode !== 'hour') return [];
    const fromMs = from.getTime();
    const toMs = to.getTime();
    if (!(toMs > fromMs)) return [];
    const out: { start: Date; end: Date }[] = [];
    const lastDay = this.dayStartMsOf(toMs);
    let dayMs = this.dayStartMsOf(fromMs) - CalendarEngine.MS_PER_DAY; // vang wrap-staart vorige dag
    let scan = 0;
    while (dayMs <= lastDay && scan <= CalendarEngine.MAX_SCAN + 2) {
      for (const band of this.bandsStartingOn(dayMs)) {
        const s = Math.max(band.start, fromMs);
        const e = Math.min(band.end, toMs);
        if (e > s) out.push({ start: new Date(s), end: new Date(e) });
      }
      dayMs += CalendarEngine.MS_PER_DAY;
      scan++;
    }
    out.sort((a, b) => a.start.getTime() - b.start.getTime());
    return out;
  }

  // ── Introspectie voor de memoization-test (§5.6). Twee engines op hetzelfde kalender-object
  //    delen deze cache-identiteit en teller. In dag-modus is er geen cache (0 / undefined). ──
  /** Aantal dag-materialisaties (cache-misses) op de GEDEELDE kalender-object-cache. */
  materializationCount(): number {
    return this.bandCache ? this.bandCache.fills : 0;
  }
  /** Identiteit van de gedeelde band-cache (voor een `===`-check tussen twee engines). */
  bandCacheRef(): unknown {
    return this.bandCache;
  }
}
