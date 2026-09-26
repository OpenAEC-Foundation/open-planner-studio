import { holidayEndDate, WorkCalendar, type WorkTimeBands } from '@/types/calendar';
import { parseDate, isoDayOfWeek, addCalendarDays, formatDate, diffCalendarDays, MS_PER_DAY, utcDayIndex } from '@/utils/dateUtils';

/** Eén gematerialiseerd werk-interval, absolute UTC-ms, half-open `[start, end)`. */
interface BandInterval {
  start: number;
  end: number;
}

/** Band-uitrol-cache, GEMEMOIZED op het KALENDER-OBJECT. Twee `CalendarEngine`-instanties
 *  die op hetzelfde kalender-object worden gebouwd (bv. de 4 solver-instantiaties) delen deze
 *  cache — de uitrol wordt zo één keer gedaan. `fills` telt de dag-materialisaties (cache-misses)
 *  en is observeerbaar voor de memoization-test. */
interface BandCache {
  days: Map<number, BandInterval[]>;
  fills: number;
}

/** WeakMap kalender-object → gedeelde band-cache. Bewust op het OBJECT (identiteit), niet per
 *  engine-instantie, zodat parallelle engines op dezelfde kalender de uitrol delen. */
const bandCacheRegistry = new WeakMap<WorkCalendar, BandCache>();

/** De meest voorkomende waarde van een niet-lege lijst, bij gelijkspel de HOOGSTE — de "modale
 *  dagsom" waarmee zowel `hoursPerDay` als de standaardwerkdag van een uur-kalender gekozen worden. */
function modalHighest(values: readonly number[]): number {
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, count] of freq) {
    if (count > bestCount || (count === bestCount && v > best)) {
      best = v;
      bestCount = count;
    }
  }
  return best;
}

/** Afgeleide `hoursPerDay` uit banden: de MODALE dagsom in uren over de
 *  weekdagen die banden dragen, bij gelijkspel de HOOGSTE; zonder banden `fallback`. */
export function modalBandHoursPerDay(bands: WorkTimeBands, fallback: number): number {
  const sums: number[] = [];
  for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    const list = bands.byWeekday[wd] ?? [];
    if (list.length === 0) continue; // niet-werkdag telt niet mee
    sums.push(list.reduce((s, b) => s + (b.end - b.start), 0) / 60);
  }
  return sums.length === 0 ? fallback : modalHighest(sums);
}

export class CalendarEngine {
  private calendar: WorkCalendar;
  private holidaySet: Set<string>;
  // ── Numerieke afgeleide structuren ─────────────
  // O(1)- resp. O(1+#holidays·log)-arithmetiek voor isWorkDay/workDaysBetween, i.p.v. dag-voor-dag
  // scannen. NAAST de string-structuren: de uur-modus (bandsStartingOn/isHoliday) leunt op holidaySet.
  private workDayMask: boolean[];         // index 1..7 (ISO-weekdag) ⇒ is-werkdag
  private workDaysPerWeek: number;        // som van true in workDayMask[1..7]
  private holidayDaySet: Set<number>;     // UTC-dagindices van alle holiday-dagen
  private holidayWorkdayIdxSorted: number[]; // holiday-dagindices OP een werk-weekdag, oplopend
  // ── Werkende uitzonderingen — dag-uitzonderingen die een dag WERKEND
  //    maken, evt. met eigen banden. Afwezig `workingExceptions` ⇒ alle drie de sets/maps blijven leeg
  //    en elke `.has(...)` hieronder is false.
  private workingExceptionDaySet: Set<number>;    // UTC-dagindices die door een uitzondering WERKEND zijn
  private workingExceptionSet: Set<string>;       // dezelfde dagen als datumstring (voor isHoliday's string-API)
  private workingExceptionBandsByDay: Map<number, { start: number; end: number }[]>; // alleen bij expliciete override-banden
  // Valkuil: een werkende uitzondering op een NIET-werk-weekdag (bv. zaterdag) zit niet in
  // `workDaysPerWeek`/`countWorkWeekdays` (die kennen alleen het vaste weekpatroon) en moet dus als
  // EXTRA werkdag worden opgeteld in `workDaysBetween` — vandaar een eigen gesorteerde index.
  private workingExceptionOnNonWorkWeekdayIdxSorted: number[];
  // Veiligheidsgrenzen tegen vastlopen bij een kapotte kalender (geen werkdagen)
  // of een ongeldige/sentinel-datum: MAX_SCAN = max dagen zoeken naar een werkdag;
  // MAX_DAYS = absolute iteratielimiet (~547 jaar) voor de tel-lussen.
  private static readonly MAX_SCAN = 366;
  private static readonly MAX_DAYS = 200_000;
  // Uur-modus: absolute minuut-grens, analoog aan MAX_SCAN/MAX_DAYS. Een duur groter
  // dan dit wordt niet uitgeteld (een kapotte/sentinel-invoer mag de banden-lus niet laten hangen).
  private static readonly MAX_MINUTES = CalendarEngine.MAX_DAYS * 24 * 60;
  private static readonly MS_PER_MIN = 60_000;

  // ── Uur-modus-state (dood in dag-modus) ─────────────────────────
  private mode: 'day' | 'hour' = 'day';
  private derivedHpd = 0;
  private bandCache?: BandCache;
  // De banden van een "normale werkdag" van deze
  // kalender — fallback voor een band-loze werkende uitzondering op een dag die zelf géén weekdag-
  // banden heeft (bv. een werkende zaterdag in een ma-vr-uurkalender). Zie `computeStandardWorkdayBands`.
  private standardWorkdayBands: { start: number; end: number }[] = [];

  constructor(calendar: WorkCalendar) {
    this.calendar = calendar;
    // Werkdag-masker + weekdag-som. Alleen indices 1..7 tellen mee; een out-of-range workDays-entry
    // raakt nooit een echte isoDayOfWeek (1..7) en verstoort dus niets (`workDays.includes`-semantiek).
    this.workDayMask = new Array(8).fill(false);
    for (const wd of this.calendar.workDays) this.workDayMask[wd] = true;
    this.workDaysPerWeek = 0;
    for (let wd = 1; wd <= 7; wd++) if (this.workDayMask[wd]) this.workDaysPerWeek++;
    this.holidaySet = new Set<string>();
    this.holidayDaySet = new Set<number>();
    this.buildHolidaySet(); // vult zowel de string-set (uur-modus) als de numerieke dagindex-set
    // Werkende uitzonderingen — leeg blijven zonder `calendar.workingExceptions`. MOET
    // vóór `holidayWorkdayIdxSorted` hieronder draaien: die index moet weten welke
    // holiday-dagen door een uitzondering overruled zijn, anders telt `workDaysBetween` zo'n dag dubbel
    // weg (zie de uitleg bij `holidayWorkdayIdxSorted`).
    this.workingExceptionDaySet = new Set<number>();
    this.workingExceptionSet = new Set<string>();
    this.workingExceptionBandsByDay = new Map<number, { start: number; end: number }[]>();
    this.buildWorkingExceptions();
    // Holiday-dagen die OP een werk-weekdag vallen ÉN niet door een werkende uitzondering overruled
    // zijn, gededupliceerd (via de Set) en oplopend gesorteerd — de aftrekterm van workDaysBetween
    // (binary-search-telling per bereik). Zonder de `!workingExceptionDaySet.has(idx)`-filter telt
    // `workDaysBetween` een holiday-op-werkdag-die-ook-uitzondering-is dubbel weg, terwijl
    // `isWorkDay`/`isHoliday` die dag werkend noemen (`HolOverridden` in check-calendar-hours.ts).
    this.holidayWorkdayIdxSorted = [...this.holidayDaySet]
      .filter((idx) => this.workDayMask[isoDayOfWeek(new Date(idx * MS_PER_DAY))]
        && !this.workingExceptionDaySet.has(idx))
      .sort((a, b) => a - b);
    this.workingExceptionOnNonWorkWeekdayIdxSorted = [...this.workingExceptionDaySet]
      .filter((idx) => !this.workDayMask[isoDayOfWeek(new Date(idx * MS_PER_DAY))])
      .sort((a, b) => a - b);
    // ── Modus-detectie + uur-setup. Afwezige `workTime` ⇒ dag-modus:
    //    dan wordt niets hieronder geraakt en draaien de bevroren dag-lussen ongewijzigd.
    this.mode = calendar.workTime ? 'hour' : 'day';
    if (this.mode === 'hour') {
      this.derivedHpd = this.computeDerivedHoursPerDay();
      this.standardWorkdayBands = this.computeStandardWorkdayBands();
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
      const end = parseDate(holidayEndDate(holiday));
      const days = diffCalendarDays(start, end);
      for (let i = 0; i <= days; i++) {
        const d = addCalendarDays(start, i);
        this.holidaySet.add(formatDate(d));
        this.holidayDaySet.add(utcDayIndex(d.getTime()));
      }
    }
  }

  /** Materialiseert `calendar.workingExceptions` naar dagindex-/datumstring-sets plus,
   *  bij expliciete override-banden, een dagindex→banden-map. INVARIANT (afgedwongen door de PARSER;
   *  hier vertrouwd maar niet blind: `isWorkDay`/`isHoliday`/`bandsStartingOn`/`workDaysBetween`
   *  blijven correct óók als een datum toch in zowel `holidays` als `workingExceptions` voorkomt, zie
   *  de precedentie-orde in die functies en de filter bij `holidayWorkdayIdxSorted`): een datum staat normaliter nooit tegelijk in `holidays` én in
   *  `workingExceptions`. Mirroring `buildHolidaySet` qua vorm — bewust géén gedeelde helper, zodat een
   *  fout in de ene lus niet stilzwijgend in de andere meelift.
   *
   *  OVERLAP OP DEZELFDE DATUM tussen TWEE `workingExceptions`-entries (mag óók niet voorkomen — de
   *  parser levert per-datum-unieke invoer — maar gedocumenteerd voor het geval die garantie
   *  lekt): de LAATST-verwerkte entry MET expliciete banden wint voor
   *  die datum (`.set(...)` overschrijft). Een LATERE entry ZONDER banden wist een eerder gezette
   *  override-bandenset NIET — de `if (exc.bands...)`-guard slaat dan simpelweg over, dus de eerdere
   *  banden blijven staan. Dit is geen "laatste-wint-altijd"-semantiek; het is bewust niet verder
   *  dichtgetimmerd omdat de parser-invariant dit pad dood hoort te houden. */
  private buildWorkingExceptions(): void {
    for (const exc of this.calendar.workingExceptions ?? []) {
      const start = parseDate(exc.startDate);
      const end = parseDate(exc.endDate);
      const days = diffCalendarDays(start, end);
      for (let i = 0; i <= days; i++) {
        const d = addCalendarDays(start, i);
        const dayIdx = utcDayIndex(d.getTime());
        this.workingExceptionDaySet.add(dayIdx);
        this.workingExceptionSet.add(formatDate(d));
        if (exc.bands && exc.bands.length > 0) {
          // Kopie — nooit de aanroeper-array delen/aliasen: een latere mutatie op
          // `exc.bands` door de aanroeper mag de al-gematerialiseerde kalenderstate niet raken.
          this.workingExceptionBandsByDay.set(dayIdx, [...exc.bands]);
        }
      }
    }
  }

  /** Heeft de kalender überhaupt werkdagen? Een lege werkweek levert anders stil onzin-datums. */
  hasWorkingDays(): boolean {
    return Array.isArray(this.calendar.workDays) && this.calendar.workDays.length > 0;
  }

  /** Check if a given date is a working day.
   *  Numeriek: `floor(ms/MS_PER_DAY)` = dezelfde UTC-dagindex als `formatDate` (epoch op
   *  UTC-middernacht). Ongeldige datum: `isoDayOfWeek`→NaN ⇒ `workDayMask[NaN]`=undefined ⇒ false. */
  isWorkDay(date: Date): boolean {
    // ÉÉN pad met een gedeelde holiday-check voor beide gevallen (met en zonder werkende
    // uitzonderingen): twee takken met elk een eigen check lopen stil uit elkaar. Zonder
    // uitzonderingen is `!hasExc && !workDayMask[dow]` de snelle vroege uitstap (`dayIdx` pas daarna).
    // `dayIdx` is NaN voor een ongeldige `date`; `Set.has(NaN)` is altijd false.
    const dow = isoDayOfWeek(date);
    const hasExc = this.workingExceptionDaySet.size > 0;
    if (!hasExc && !this.workDayMask[dow]) return false;
    const dayIdx = utcDayIndex(date.getTime());
    // Een werkende uitzondering wint altijd — ook op een niet-werk-weekdag (zaterdag) en
    // ook boven een holiday op diezelfde datum (precedentie; zie de filter bij `holidayWorkdayIdxSorted`
    // voor de bijbehorende `workDaysBetween`-consistentie). Een holiday op een ANDERE datum (elders in de
    // kalender) mag hierdoor niet stiekem meegetrokken worden — vandaar de gedeelde holiday-check hieronder
    // die voor BEIDE gevallen (met en zonder uitzonderingen) hetzelfde pad volgt.
    if (hasExc && this.workingExceptionDaySet.has(dayIdx)) return true;
    if (!this.workDayMask[dow]) return false;
    return !this.holidayDaySet.has(dayIdx);
  }

  /** Check if a given date string is a holiday. Een werkende uitzondering op dezelfde
   *  datum overrulet — die dag is dan geen holiday meer (precedentie, zelfde volgorde als isWorkDay). */
  isHoliday(dateStr: string): boolean {
    return this.holidaySet.has(dateStr) && !this.workingExceptionSet.has(dateStr);
  }

  /**
   * Add working days to a start date.
   * Returns the end date (the last working day).
   * For duration=0 (milestone), returns the start date itself.
   *
   * Delegeert naar `addWorkDaysChecked` en pakt `.date`, voor aanroepers (o.a. `useBarDrag`, de
   * niet-taakdatum-CPM-plekken) die het cap-signaal niet nodig hebben.
   */
  addWorkDays(startDate: Date, workDays: number): Date {
    return this.addWorkDaysChecked(startDate, workDays).date;
  }

  /**
   * `addWorkDays` mét expliciet CAP-signaal. `capped: true` zodra
   * een van de twee veiligheidsgrenzen wordt geraakt — de MAX_SCAN-werkdag-zoek (een kalender die het
   * venster onwerkbaar maakt, bv. een aaneengesloten holiday-blok) óf de MAX_DAYS-tellimiet — waarna de
   * teruggegeven `Date` een gecapte (niet-betekenisvolle) datum is i.p.v. de echte laatste werkdag.
   * De solver aggregeert dit tot een zachte `cappedTaskIds`-waarschuwing.
   */
  addWorkDaysChecked(startDate: Date, workDays: number): { date: Date; capped: boolean } {
    if (workDays <= 0) return { date: new Date(startDate.getTime()), capped: false };

    let current = new Date(startDate.getTime());
    // Ensure we start on a work day
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return { date: current, capped: true }; // geen werkdag — niet vastlopen
    }

    let remaining = workDays - 1; // first work day counts as day 1
    let steps = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, 1);
      if (this.isWorkDay(current)) {
        remaining--;
      }
      if (++steps > CalendarEngine.MAX_DAYS) return { date: current, capped: true };
    }
    return { date: current, capped: false };
  }

  /**
   * Calculate the number of working days between two dates (inclusive).
   *
   * Arithmetisch i.p.v. dag-voor-dag scannen (anders O(n²) in de solver). Semantiek:
   *  - Dagen k=0,1,… met dagindex `startIdx+k` zolang `startMs + k·MS_PER_DAY ≤ endMs` (elke +1
   *    kalenderdag = +MS_PER_DAY in UTC, geen DST). Aantal dagen = `floor((endMs−startMs)/MS_PER_DAY)+1`
   *    als `endMs≥startMs`, anders 0.
   *  - CAP: hoogstens MAX_DAYS+1 dagen ⇒ `cappedDays = min(totalDays, MAX_DAYS+1)`.
   * Telling: #werk-weekdagen in het (gecapte) bereik − #(holidays op een werk-weekdag) daarin
   *  + #(werkende uitzonderingen op een NIET-werk-weekdag) daarin (zonder die term telt een werkende
   *  zaterdag niet mee, zie `workingExceptionOnNonWorkWeekdayIdxSorted`).
   */
  workDaysBetween(start: Date, end: Date): number {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (!(endMs >= startMs)) return 0; // dekt endMs<startMs én NaN (NaN>=x is false) — 0-iteratie-lus
    const totalDays = Math.floor((endMs - startMs) / MS_PER_DAY) + 1;
    const cappedDays = Math.min(totalDays, CalendarEngine.MAX_DAYS + 1);
    const startIdx = utcDayIndex(startMs);
    const lastIdx = startIdx + cappedDays - 1;
    return this.countWorkWeekdays(startIdx, lastIdx)
      - this.countHolidayWorkdaysInRange(startIdx, lastIdx)
      + this.countWorkingExceptionsAddedInRange(startIdx, lastIdx);
  }

  /** Getekend werkdag-verschil van `a` naar `b`: a≤b ⇒ +stappen (`workDaysBetween − 1`), a>b ⇒
   *  −stappen. De ene definitie achter de CPM-vrije speling, de variance- en rapportdeltas, de
   *  baselinekolommen van het taakraster en de nivelleervoorvertoning. */
  signedWorkDaysBetween(a: Date, b: Date): number {
    return a <= b ? this.workDaysBetween(a, b) - 1 : -(this.workDaysBetween(b, a) - 1);
  }

  /** #werk-weekdagen in het INCLUSIEVE dagindex-bereik [startIdx, lastIdx]. Volledige weken dragen
   *  elk `workDaysPerWeek` bij (elke weekdag komt precies één keer voor); de resterende dagen worden
   *  uitgeteld vanaf de weekdag van `startIdx`. */
  private countWorkWeekdays(startIdx: number, lastIdx: number): number {
    const L = lastIdx - startIdx + 1;
    if (L <= 0) return 0;
    const fullWeeks = Math.floor(L / 7);
    let count = fullWeeks * this.workDaysPerWeek;
    const rem = L - fullWeeks * 7;
    if (rem > 0) {
      let wd = isoDayOfWeek(new Date(startIdx * MS_PER_DAY)); // 1..7
      for (let i = 0; i < rem; i++) {
        if (this.workDayMask[wd]) count++;
        wd = wd === 7 ? 1 : wd + 1;
      }
    }
    return count;
  }

  /** Aantal elementen van een oplopend gesorteerde dagindex-lijst in het inclusieve bereik
   *  [startIdx, lastIdx], via lower/upper-bound binary search. Gedeeld door de holiday- (aftrekken)
   *  en de werkende-uitzondering-telling: zelfde vorm, ander teken bij de
   *  aanroeper. */
  private countSortedIdxInRange(sorted: number[], startIdx: number, lastIdx: number): number {
    // lo = eerste index i met sorted[i] >= startIdx (lower bound)
    let lo = 0;
    let loHi = sorted.length;
    while (lo < loHi) {
      const mid = (lo + loHi) >>> 1;
      if (sorted[mid] < startIdx) lo = mid + 1;
      else loHi = mid;
    }
    // hi = eerste index i met sorted[i] > lastIdx (upper bound)
    let hi = 0;
    let hiHi = sorted.length;
    while (hi < hiHi) {
      const mid = (hi + hiHi) >>> 1;
      if (sorted[mid] <= lastIdx) hi = mid + 1;
      else hiHi = mid;
    }
    return hi - lo;
  }

  /** Aantal holiday-dagen ÓP een werk-weekdag in het inclusieve bereik [startIdx, lastIdx]. */
  private countHolidayWorkdaysInRange(startIdx: number, lastIdx: number): number {
    return this.countSortedIdxInRange(this.holidayWorkdayIdxSorted, startIdx, lastIdx);
  }

  /** Aantal werkende uitzonderingen ÓP een NIET-werk-weekdag
   *  in het inclusieve bereik [startIdx, lastIdx] — dagen die `countWorkWeekdays` (kent alleen het
   *  vaste weekpatroon) NIET meetelt en die hier dus als EXTRA werkdag worden opgeteld. Een werkende
   *  uitzondering op een reeds-werkende weekdag zit al in `countWorkWeekdays` en staat daarom niet in
   *  `workingExceptionOnNonWorkWeekdayIdxSorted` (gefilterd in de constructor) — geen dubbeltelling. */
  private countWorkingExceptionsAddedInRange(startIdx: number, lastIdx: number): number {
    return this.countSortedIdxInRange(this.workingExceptionOnNonWorkWeekdayIdxSorted, startIdx, lastIdx);
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
  //  UUR-MODUS. Alles hieronder is DOOD in dag-modus: geen enkele
  //  dag-lus hierboven roept iets van dit blok aan. De solver
  //  dispatcht per taak via `isHourMode`. Conventies:
  //    band = [start, end);  nextWorkInstant(t)=t als t∈[start,end);
  //    prevWorkInstant(t)=t als t∈(start,end];  strikte varianten met "After"/"Before".
  // ═══════════════════════════════════════════════════════════════════════════

  /** True ⇒ uur-kalender (`workTime` aanwezig). Vervult het `DurationCalendar`-contract (duration.ts). */
  get isHourMode(): boolean {
    return this.mode === 'hour';
  }

  /** De EFFECTIEVE banden (minuut-van-de-dag, `[start,end)`) die op de KALENDERDAG van `d` gelden —
   *  via hetzelfde `bandsStartingOn`-pad dat de solver zelf voor elke snap/telling gebruikt, dus
   *  INCLUSIEF werkende uitzonderingen en holidays. Alleen voor read-only VERGELIJKING tussen twee
   *  kalenders OP EEN SPECIFIEKE DATUM (`calendarsAgreeOnSharedWorkdayBands` in `relationMath.ts`) —
   *  geen dag-/uur-lus leest hierlangs. Bewust met datumcontext: de STATISCHE weekdagtabel
   *  (`workTime.byWeekday`) ziet uitzonderingen/holidays niet, zodat twee kalenders met een identiek
   *  WEEKPATROON maar een afwijkende werkende uitzondering op de landingsdag ten onrechte "identiek"
   *  lijken (de msp-04-foutvorm). Geeft een LEGE array terug (nooit
   *  `undefined`) in dag-modus — dag-modus draagt geen bandtijden, dat is een leeg antwoord, geen
   *  onbekend antwoord — en op elke dag die voor deze kalender niet werkt (holiday, geen band).
   *  Geeft altijd een VERSE kopie terug, nooit de gememoizede cache-array van `bandsStartingOn` zelf. */
  effectiveBandsOn(d: Date): ReadonlyArray<Readonly<{ start: number; end: number }>> {
    if (this.mode !== 'hour') return [];
    const dayMs = this.dayStartMsOf(d.getTime());
    return this.bandsStartingOn(dayMs).map((b) => ({
      start: (b.start - dayMs) / CalendarEngine.MS_PER_MIN,
      end: (b.end - dayMs) / CalendarEngine.MS_PER_MIN,
    }));
  }

  /** Afgeleide `hoursPerDay` voor een uur-kalender: de MODALE band-som over de
   *  werk-weekdagen (meest voorkomende dagsom in uren), bij gelijkspel de HOOGSTE.
   *
   *  BEKENDE BEPERKING (niet gefixt): deze functie telt een weekdag
   *  mee zodra hij BANDEN draagt (`bands.length===0`-check), ongeacht `workDayMask`/`calendar.
   *  workDays` — `computeStandardWorkdayBands` hieronder telt een weekdag alleen mee als hij ZOWEL
   *  in `workDayMask` staat ALS banden draagt. Op een INTERN CONSISTENTE kalender (elke `workDays`-
   *  dag heeft banden, elke bandloze dag staat niet in `workDays`) maken beide filters exact
   *  dezelfde weekdagenset mee, dus is dit onderscheid onzichtbaar. Op een ZELF-TEGENSTRIJDIGE
   *  kalender (bv. `workDays` bevat zaterdag NIET, maar `workTime.byWeekday[6]` draagt toch banden
   *  — een vorm die geen van de lezers (`mppReader.ts`/`mspdiReader.ts`/`p6xmlReader.ts`) produceert,
   *  parser-invariant net als de `holidays`/`workingExceptions`-exclusiviteit hierboven) kunnen deze
   *  functie en `computeStandardWorkdayBands` een ANDERE weekdag als "modaal" aanwijzen, en dus een
   *  `hoursPerDay` teruggeven die niet bij `standardWorkdayBands`'s minutensom past. Geen corpus-
   *  of synthetische case raakt dit (de parsers garanderen de consistentie), dus bewust ongefixt. */
  private computeDerivedHoursPerDay(): number {
    return modalBandHoursPerDay(this.calendar.workTime!, this.calendar.hoursPerDay);
  }

  /** De banden van een "normale
   *  werkdag" van deze kalender. MOET dezelfde dag aanwijzen als `computeDerivedHoursPerDay` (de MODALE
   *  dagsom, bij gelijkspel de HOOGSTE) — anders spreken `hoursPerDay` en de band-loze-uitzondering-
   *  fallback elkaar tegen (bv. ma 4u, di-vr 8u: de EERSTE weekdag met banden zou 240m geven, terwijl
   *  `hoursPerDay`=8 een band-loze werkende zaterdag 480m laat verwachten).
   *  Fallback voor een band-loze werkende uitzondering op een dag zonder eigen weekdagbanden (bv. een
   *  werkende zaterdag in een ma-vr-uurkalender, `byWeekday[6]=[]`): zonder deze fallback zou zo'n dag
   *  `isWorkDay`-achtig "werkend" zijn maar 0 werkminuten opleveren — dag- en uurmodus zouden elkaar
   *  tegenspreken en ResourceLoad/workdayAxis zouden een werkdag zonder capaciteit zien. MPXJ produceert
   *  dit scenario nooit (het raakt alleen ons eigen model), maar de semantiek moet gedefinieerd zijn.
   *  Rekent in MINUTEN (niet in afgeronde uren zoals `computeDerivedHoursPerDay`) zodat de modale
   *  waarde exact is; bij gelijke frequentie wint de HOOGSTE minutensom, en van de weekdagen die dié
   *  modale som halen de EERSTE (laagste ISO-weekdagnummer) — deterministisch, ook als twee weekdagen
   *  dezelfde som maar een andere bandvorm hebben. Degenererende kalender (geen `workDays`-weekdag
   *  heeft banden) ⇒ val terug op de eerste niet-lege weekdag ongeacht `workDays`; blijft dat leeg,
   *  dan `[]` (de bestaande MAX_SCAN/geen-werk-paden vangen dat al af).
   *
   *  BEKENDE BEPERKING (niet gefixt): het eerste filter hierboven
   *  eist zowel `workDayMask[wd]` ALS banden — `computeDerivedHoursPerDay` eist alleen banden. Zie
   *  de toelichting daar voor de volledige analyse; op een zelf-tegenstrijdige kalender (`workDays`
   *  en `workTime.byWeekday` niet in overeenstemming, een vorm die geen lezer produceert) kunnen
   *  beide functies een andere weekdag als "modaal" aanwijzen. */
  private computeStandardWorkdayBands(): { start: number; end: number }[] {
    const byWeekday = this.calendar.workTime!.byWeekday;
    const sums: { wd: 1 | 2 | 3 | 4 | 5 | 6 | 7; minutes: number }[] = [];
    for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
      if (!this.workDayMask[wd]) continue;
      const bands = byWeekday[wd];
      if (!bands || bands.length === 0) continue;
      sums.push({ wd, minutes: bands.reduce((s, b) => s + (b.end - b.start), 0) });
    }
    if (sums.length > 0) {
      const bestMinutes = modalHighest(sums.map((s) => s.minutes));
      const match = sums.find((s) => s.minutes === bestMinutes)!; // eerste (laagste wd) met de modale som
      return byWeekday[match.wd]!;
    }
    for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
      const bands = byWeekday[wd];
      if (bands && bands.length > 0) return bands;
    }
    return [];
  }

  // ── Band-materialisatie (venster-gebaseerd, gememoized op het kalender-object) ──

  /** UTC-middernacht-ms van de dag die `ms` bevat (epoch is op UTC-middernacht uitgelijnd). */
  private dayStartMsOf(ms: number): number {
    return utcDayIndex(ms) * MS_PER_DAY;
  }

  /** Absolute werk-intervallen voor de banden die op de dag `dayMs` STARTEN. Een holiday op
   *  díé dag onderdrukt uitsluitend de banden die er starten; de staart na middernacht
   *  van de wrap-band van de vórige dag hoort bij die vorige dag en loopt gewoon door (hij wordt bij
   *  díé dag gematerialiseerd). Gememoized op de gedeelde kalender-cache.
   *  Een werkende uitzondering op `dayMs` wint van de holiday-onderdrukking
   *  hieronder. Fallback-keten voor de te gebruiken banden:
   *  (1) expliciete override-banden op de uitzondering zelf; anders (2) de eigen weekdag-banden van
   *  `dayMs` als die niet leeg zijn; anders (3) `standardWorkdayBands` (de banden van een normale
   *  werkdag van deze kalender) — zodat een band-loze uitzondering op een dag zonder eigen weekdag-
   *  banden (zaterdag in een ma-vr-kalender) niet stilzwijgend 0 minuten oplevert terwijl `isWorkDay`
   *  "werkend" zegt. Zonder `workingExceptions` is `workingExceptionDaySet` leeg en speelt dit niet. */
  private bandsStartingOn(dayMs: number): BandInterval[] {
    const cache = this.bandCache!;
    const hit = cache.days.get(dayMs);
    if (hit) return hit;
    cache.fills++;
    const d = new Date(dayMs);
    const dayIdx = utcDayIndex(dayMs); // dayMs is altijd dag-uitgelijnd (aanroepers)
    const wd = isoDayOfWeek(d) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    let bands: { start: number; end: number }[];
    if (this.workingExceptionDaySet.has(dayIdx)) {
      const override = this.workingExceptionBandsByDay.get(dayIdx);
      const ownWeekdayBands = this.calendar.workTime!.byWeekday[wd];
      bands = override ?? (ownWeekdayBands && ownWeekdayBands.length > 0 ? ownWeekdayBands : this.standardWorkdayBands);
    } else if (this.holidaySet.has(formatDate(d))) {
      bands = []; // holiday onderdrukt de shifts die op deze dag STARTEN
    } else {
      bands = this.calendar.workTime!.byWeekday[wd] ?? [];
    }
    const result: BandInterval[] = bands.map((b) => ({
      start: dayMs + b.start * CalendarEngine.MS_PER_MIN,
      end: dayMs + b.end * CalendarEngine.MS_PER_MIN,
    }));
    cache.days.set(dayMs, result);
    return result;
  }

  /** De band die `tMs` bevat, of null. `leftOpen=false` ⇒ voorwaartse conventie `[start,end)`;
   *  `leftOpen=true` ⇒ achterwaartse conventie `(start,end]`. Scant de huidige dag plus twee dagen
   *  terug om de staart van een wrap-band (`end ∈ (1440,2880]`) op te vangen. */
  private findContaining(tMs: number, leftOpen: boolean): BandInterval | null {
    const day0 = this.dayStartMsOf(tMs);
    for (let k = -2; k <= 0; k++) {
      const dayMs = day0 + k * MS_PER_DAY;
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
      dayMs += MS_PER_DAY;
      scan++;
    }
    return tMs; // geen werkdagen — best effort (kapotte kalender)
  }

  /** Laatste band-eind ≤ `tMs` (of strikt < bij `strict`), in ms. Dag-scan achteruit; stopt zodra
   *  geen eerdere dag het beste resultaat nog kan verbeteren (max mogelijke eind = dagstart+2880m). */
  private prevBandEndBound(tMs: number, strict: boolean): number | null {
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
      dayMs -= MS_PER_DAY;
      scan++;
    }
    return best === Number.NEGATIVE_INFINITY ? null : best;
  }

  // ── Instant-vinders ─────────────────────────────────────────────────

  /** t valt binnen een band `[start,end)`. Uur-tegenhanger van `isWorkDay`. */
  isWorkInstant(t: Date): boolean {
    return this.findContaining(t.getTime(), false) !== null;
  }

  /** t als t ∈ `[bandstart, bandeind)`, anders de eerstvolgende bandstart > t. */
  nextWorkInstant(t: Date): Date {
    const tMs = t.getTime();
    if (this.findContaining(tMs, false)) return new Date(tMs);
    return new Date(this.nextBandStartStrictAfter(tMs));
  }

  /** De eerstvolgende bandstart STRIKT > t (bij band-eindgrens: de volgende band). */
  nextWorkInstantAfter(t: Date): Date {
    return new Date(this.nextBandStartStrictAfter(t.getTime()));
  }

  /** t als t ∈ `(bandstart, bandeind]`, anders het laatste band-eind ≤ t. Een finish exact op
   *  een band-eind is legitiem en blijft staan (rand `(start,end]`). */
  prevWorkInstant(t: Date): Date {
    const tMs = t.getTime();
    if (this.findContaining(tMs, true)) return new Date(tMs);
    return new Date(this.prevBandEndBound(tMs, false) ?? tMs);
  }

  /** Begrensde variant voor aanroepers die "geen band gevonden" semantisch moeten onderscheiden
   *  van de bestaande best-effort-terugval op `t`. Dezelfde MAX_SCAN-zoektocht, nooit een tweede lus. */
  prevWorkInstantOrNull(t: Date): Date | null {
    const tMs = t.getTime();
    if (this.findContaining(tMs, true)) return new Date(tMs);
    const found = this.prevBandEndBound(tMs, false);
    return found === null ? null : new Date(found);
  }

  /** Het laatste band-eind STRIKT < t. */
  prevWorkInstantBefore(t: Date): Date {
    const tMs = t.getTime();
    return new Date(this.prevBandEndBound(tMs, true) ?? tMs);
  }

  // ── Minuut-lussen ───────────────────────────────────────────────────
  //
  // SNAP-REGEL OP NIET-WERK-INSTANTS — waarom `addWorkMinutes` en `subtractWorkMinutes` elkaars
  // exacte spiegel zijn, en waar die spiegel schijnbaar (maar niet werkelijk) breekt.
  //
  // Beide lussen normaliseren hun aangrijpingspunt eerst naar een werk-instant, elk IN DE RICHTING
  // VAN DE EIGEN WANDELING: `addWorkMinutes` gebruikt `nextWorkInstant` (vooruit), en
  // `subtractWorkMinutes` gebruikt `prevWorkInstant` (achteruit). Daaruit volgen drie regels die je
  // moet kennen vóór je hier iets aanraakt:
  //
  //  1. Voor elk WERK-instant `t` geldt `subtractWorkMinutes(addWorkMinutes(t, n), n) === t` op de
  //     milliseconde. Dat is geen toevallige eigenschap maar de invariant waarop de backward-pass
  //     van de solver leunt: `LS..LF` moet exact evenveel werktijd overspannen als `ES..EF`.
  //  2. Voor een `t` die GEEN werk-instant is (midden in een weekend, een feestdag of een
  //     aaneengesloten vrij blok van dagen) is er geen ronde-reis-identiteit, en dat is correct:
  //     `add` snapt naar de eerstvolgende bandstart, `sub` naar het laatste band-eind ervóór. De
  //     twee snappunten liggen per definitie aan weerszijden van hetzelfde gat. Een aanroeper die
  //     een niet-werk-instant aanlevert vraagt om een richtingsafhankelijk antwoord en krijgt het.
  //  3. Op een BANDGRENS zijn twee verschillende instants hetzelfde punt op de werk-as: het eind van
  //     de ene band en het begin van de volgende hebben nul werkminuten tussen zich. `sub` levert
  //     daarom een bandstart waar `add` een band-eind levert, zónder dat er werktijd verschilt. De
  //     juiste gelijkheidstest tussen twee posities op de werk-as is `workMinutesBetween(a, b) === 0`,
  //     NIET `a.getTime() === b.getTime()`.
  //
  // Er is GEEN brongebonden uitzondering op die drie regels: P6-vrije dagen worden in de XER-decoder
  // gereconstrueerd (`xerCalendarData.ts`), niet met een asymmetrische wandeling hier.
  // `tests/planning/check-calendar-mirror.ts` pint deze drie regels vast, over een aaneengesloten
  // niet-werkblok van tien dagen, in dag-modus en in uur-modus met 1, 2 en 3 banden per dag.

  /** Tel `minutes` werkminuten op vanaf `startInstant`: verbruik over opeenvolgende banden,
   *  spring bij een bandgrens naar de volgende bandstart. Een verbruik dat exact op een band-eind
   *  landt geeft die eindgrens terug (legitiem finish-moment). `minutes ≤ 0` ⇒ start ongewijzigd
   *  (spiegelt `addWorkDays`' `≤0`-tak, voor mijlpalen). */
  addWorkMinutes(startInstant: Date, minutes: number): Date {
    return this.addPhysicalWorkMinutes(startInstant, minutes);
  }

  /** De fysieke bandwandeling. */
  private addPhysicalWorkMinutes(startInstant: Date, minutes: number): Date {
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

  /** Trek `minutes` werkminuten af van `endInstant` (spiegel van `addWorkMinutes`). Een
   *  landing exact op een bandstart is legitiem (rand `(start,end]`). */
  subtractWorkMinutes(endInstant: Date, minutes: number): Date {
    return this.subtractPhysicalWorkMinutes(endInstant, minutes);
  }

  /** De fysieke achterwaartse bandwandeling. */
  private subtractPhysicalWorkMinutes(endInstant: Date, minutes: number): Date {
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

  /** Getekende werkminuten in `[a,b)` (voor vrije speling). Positief als b>a, negatief als
   *  b<a, 0 als gelijk. */
  workMinutesBetween(a: Date, b: Date): number {
    return this.physicalWorkMinutesBetween(a, b);
  }

  /** Fysieke bandminuten in `[a,b)`. */
  private physicalWorkMinutesBetween(a: Date, b: Date): number {
    const aMs = a.getTime();
    const bMs = b.getTime();
    if (aMs === bMs) return 0;
    const sign = bMs > aMs ? 1 : -1;
    const lo = Math.min(aMs, bMs);
    const hi = Math.max(aMs, bMs);
    let total = 0;
    // Begin twee dagen vóór `lo`: een wrap-band (end ≤ +2880m) van een eerdere dag kan in [lo,hi) reiken.
    let dayMs = this.dayStartMsOf(lo) - 2 * MS_PER_DAY;
    let steps = 0;
    while (dayMs < hi) {
      for (const band of this.bandsStartingOn(dayMs)) {
        const s = Math.max(band.start, lo);
        const e = Math.min(band.end, hi);
        if (e > s) total += (e - s) / CalendarEngine.MS_PER_MIN;
      }
      dayMs += MS_PER_DAY;
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

  // ── Cross-modus-primitieven — de solver wisselt hiermee tussen dag- en uur-taken ──

  /** De dag-van-t indien t exact op middernacht valt, anders de volgende dag. Modus-agnostisch
   *  (zuivere datum-rekenkunde): een dag-taak kan niet midden op een dag starten. */
  ceilToWorkDay(t: Date): Date {
    const tMs = t.getTime();
    const dayMs = this.dayStartMsOf(tMs);
    return new Date(tMs === dayMs ? dayMs : dayMs + MS_PER_DAY);
  }

  /** De exclusieve "beschikbaar-vanaf"-instant die een taak op DEZE engine als VOORGANGER levert
   *  Uur-modus ⇒ de exclusieve finish-instant zelf; dag-modus ⇒ `(ef + 1 dag) @ 00:00` (de
   *  dag-taak bezet zijn hele finish-dag). In een puur dag→dag-net levert de combinatie met
   *  `availableStart` exact `nextWorkDayAfter(ef)` — bit-identiek met het huidige gedrag. */
  predDoneAt(ef: Date): Date {
    if (this.mode === 'hour') return new Date(ef.getTime());
    return new Date(this.dayStartMsOf(ef.getTime()) + MS_PER_DAY);
  }

  /** De ES die een taak op DEZE engine als OPVOLGER consumeert uit een `predDoneAt`-instant.
   *  Uur-modus ⇒ `nextWorkInstant(predDoneAt)`; dag-modus ⇒ `nextWorkDay(ceilToWorkDay(predDoneAt))`. */
  availableStart(predDoneAt: Date): Date {
    if (this.mode === 'hour') return this.nextWorkInstant(predDoneAt);
    return this.nextWorkDay(this.ceilToWorkDay(predDoneAt));
  }

  /**
   * Werk-intervallen (absolute UTC-`Date`-paren, half-open `[start,end)`) die het venster
   * `[from, to]` snijden — voor de balk-opsplitsing/bar-necking in de Gantt. Hergebruikt de
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
    let dayMs = this.dayStartMsOf(fromMs) - MS_PER_DAY; // vang wrap-staart vorige dag
    let scan = 0;
    while (dayMs <= lastDay && scan <= CalendarEngine.MAX_SCAN + 2) {
      for (const band of this.bandsStartingOn(dayMs)) {
        const s = Math.max(band.start, fromMs);
        const e = Math.min(band.end, toMs);
        if (e > s) out.push({ start: new Date(s), end: new Date(e) });
      }
      dayMs += MS_PER_DAY;
      scan++;
    }
    out.sort((a, b) => a.start.getTime() - b.start.getTime());
    return out;
  }

  // ── Introspectie voor de memoization-test. Twee engines op hetzelfde kalender-object
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
