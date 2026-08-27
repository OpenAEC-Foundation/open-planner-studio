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
  // ── Fase 3.8 (T2, MSP-pariteit): werkende uitzonderingen — dag-uitzonderingen die een dag WERKEND
  //    maken, evt. met eigen banden. Afwezig `workingExceptions` ⇒ alle drie de sets/maps blijven leeg
  //    en elke `.has(...)` hieronder is false ⇒ byte-identiek gedrag met vóór deze taak.
  private workingExceptionDaySet: Set<number>;    // UTC-dagindices die door een uitzondering WERKEND zijn
  private workingExceptionSet: Set<string>;       // dezelfde dagen als datumstring (voor isHoliday's string-API)
  private workingExceptionBandsByDay: Map<number, { start: number; end: number }[]>; // alleen bij expliciete override-banden
  // Val-kuil (plan §T2): een werkende uitzondering op een NIET-werk-weekdag (bv. zaterdag) zit niet in
  // `workDaysPerWeek`/`countWorkWeekdays` (die kennen alleen het vaste weekpatroon) en moet dus als
  // EXTRA werkdag worden opgeteld in `workDaysBetween` — vandaar een eigen gesorteerde index.
  private workingExceptionOnNonWorkWeekdayIdxSorted: number[];
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
  // Fase 3.8 (T2-review MIDDEN-2, orkestratorbesluit): de banden van een "normale werkdag" van deze
  // kalender — fallback voor een band-loze werkende uitzondering op een dag die zelf géén weekdag-
  // banden heeft (bv. een werkende zaterdag in een ma-vr-uurkalender). Zie `computeStandardWorkdayBands`.
  private standardWorkdayBands: { start: number; end: number }[] = [];

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
    // Fase 3.8 (T2): werkende uitzonderingen — leeg blijven zonder `calendar.workingExceptions`. MOET
    // vóór `holidayWorkdayIdxSorted` hieronder draaien (T2-review HOOG-1): die index moet weten welke
    // holiday-dagen door een uitzondering overruled zijn, anders telt `workDaysBetween` zo'n dag dubbel
    // weg (zie de uitleg bij `holidayWorkdayIdxSorted`).
    this.workingExceptionDaySet = new Set<number>();
    this.workingExceptionSet = new Set<string>();
    this.workingExceptionBandsByDay = new Map<number, { start: number; end: number }[]>();
    this.buildWorkingExceptions();
    // Holiday-dagen die OP een werk-weekdag vallen ÉN niet door een werkende uitzondering overruled
    // zijn, gededupliceerd (via de Set) en oplopend gesorteerd — de aftrekterm van workDaysBetween
    // (binary-search-telling per bereik). T2-review HOOG-1: zonder de `!workingExceptionDaySet.has(idx)`-
    // filter telt `workDaysBetween` een holiday-op-werkdag-die-ook-uitzondering-is dubbel weg —
    // `countWorkWeekdays` telt de dag wél (gewone werk-weekdag) maar deze index trok hem dan alsnog af,
    // terwijl `isWorkDay`/`isHoliday` voor diezelfde dag al `true`/`false` (werkend) teruggeven. Dat gat
    // trad letterlijk op bij `HolOverridden` (zie check-calendar-hours.ts, M13-M16) vóór deze fix.
    this.holidayWorkdayIdxSorted = [...this.holidayDaySet]
      .filter((idx) => this.workDayMask[isoDayOfWeek(new Date(idx * CalendarEngine.MS_PER_DAY))]
        && !this.workingExceptionDaySet.has(idx))
      .sort((a, b) => a - b);
    this.workingExceptionOnNonWorkWeekdayIdxSorted = [...this.workingExceptionDaySet]
      .filter((idx) => !this.workDayMask[isoDayOfWeek(new Date(idx * CalendarEngine.MS_PER_DAY))])
      .sort((a, b) => a - b);
    // ── Fase 2.8b: modus-detectie + uur-setup (§4.1). Afwezige `workTime` ⇒ dag-modus:
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
      const end = parseDate(holiday.endDate);
      const days = diffCalendarDays(start, end);
      for (let i = 0; i <= days; i++) {
        const d = addCalendarDays(start, i);
        this.holidaySet.add(formatDate(d));
        this.holidayDaySet.add(Math.floor(d.getTime() / CalendarEngine.MS_PER_DAY));
      }
    }
  }

  /** Fase 3.8 (T2): materialiseert `calendar.workingExceptions` naar dagindex-/datumstring-sets plus,
   *  bij expliciete override-banden, een dagindex→banden-map. INVARIANT (afgedwongen door de PARSER,
   *  T3/T4 — hier alleen vertrouwd, niet blind: `isWorkDay`/`isHoliday`/`bandsStartingOn`/
   *  `workDaysBetween` blijven correct óók als een datum toch in zowel `holidays` als
   *  `workingExceptions` voorkomt, zie de precedentie-orde in die functies en de HOOG-1-fix hierboven
   *  bij `holidayWorkdayIdxSorted`): een datum staat normaliter nooit tegelijk in `holidays` én in
   *  `workingExceptions`. Mirroring `buildHolidaySet` qua vorm — bewust géén gedeelde helper, zodat een
   *  fout in de ene lus niet stilzwijgend in de andere meelift.
   *
   *  OVERLAP OP DEZELFDE DATUM tussen TWEE `workingExceptions`-entries (mag óók niet voorkomen — de
   *  parser levert per-datum-unieke invoer, T3/T4 — maar hier gedocumenteerd voor het geval die
   *  garantie ooit lekt, T2-review LAAG-8): de LAATST-verwerkte entry MET expliciete banden wint voor
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
        const dayIdx = Math.floor(d.getTime() / CalendarEngine.MS_PER_DAY);
        this.workingExceptionDaySet.add(dayIdx);
        this.workingExceptionSet.add(formatDate(d));
        if (exc.bands && exc.bands.length > 0) {
          // Kopie — nooit de aanroeper-array delen/aliasen (T2-review LAAG-8): een latere mutatie op
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
   *  Pakket A1 (gedragsneutraal): numeriek i.p.v. `workDays.includes` + `formatDate`.
   *  `floor(ms/MS_PER_DAY)` = dezelfde UTC-dagindex als `formatDate` (epoch op UTC-middernacht).
   *  Ongeldige datum: `isoDayOfWeek`→NaN ⇒ `workDayMask[NaN]`=undefined ⇒ return false (identiek
   *  aan het oude `workDays.includes(NaN)===false`, dat óók vóór `formatDate` short-circuitte). */
  isWorkDay(date: Date): boolean {
    // T2-review MIDDEN-A (fix van LAAG-4's guard): ÉÉN pad i.p.v. twee bijna-identieke takken die elk
    // hun eigen `workDayMask`-/`holidayDaySet`-check droegen — de vorige vorm liet de reviewer de
    // holiday-check uit alleen de "met uitzonderingen"-tak weghalen zonder dat een test het merkte
    // (een feestdag werd stil weer een werkdag zodra de kalender ook maar één werkende uitzondering
    // ELDERS had). Deze vorm behoudt de LAAG-4-perfguard (zonder uitzonderingen blijft `!hasExc &&
    // !workDayMask[dow]` de oude vroege-uitstap — `dayIdx` wordt dan pas ná die check berekend) maar
    // deelt de holiday-check tussen beide gevallen, zodat hij niet twee keer onderhouden hoeft te
    // worden. `dayIdx` is NaN voor een ongeldige `date`; `Set.has(NaN)` is hier altijd false (nooit
    // ingevoegd), dus dat valt door naar exact het oude gedrag.
    const dow = isoDayOfWeek(date);
    const hasExc = this.workingExceptionDaySet.size > 0;
    if (!hasExc && !this.workDayMask[dow]) return false;
    const dayIdx = Math.floor(date.getTime() / CalendarEngine.MS_PER_DAY);
    // Fase 3.8 (T2): een werkende uitzondering wint altijd — ook op een niet-werk-weekdag (zaterdag) en
    // ook boven een holiday op diezelfde datum (precedentie; zie de HOOG-1-fix bij `holidayWorkdayIdxSorted`
    // voor de bijbehorende `workDaysBetween`-consistentie). Een holiday op een ANDERE datum (elders in de
    // kalender) mag hierdoor niet stiekem meegetrokken worden — vandaar de gedeelde holiday-check hieronder
    // die voor BEIDE gevallen (met en zonder uitzonderingen) hetzelfde pad volgt.
    if (hasExc && this.workingExceptionDaySet.has(dayIdx)) return true;
    if (!this.workDayMask[dow]) return false;
    return !this.holidayDaySet.has(dayIdx);
  }

  /** Check if a given date string is a holiday. Fase 3.8 (T2): een werkende uitzondering op dezelfde
   *  datum overrulet — die dag is dan geen holiday meer (precedentie, zelfde volgorde als isWorkDay). */
  isHoliday(dateStr: string): boolean {
    return this.holidaySet.has(dateStr) && !this.workingExceptionSet.has(dateStr);
  }

  /**
   * Add working days to a start date.
   * Returns the end date (the last working day).
   * For duration=0 (milestone), returns the start date itself.
   *
   * Byte-identieke `Date`-retour: delegeert naar `addWorkDaysChecked` en pakt `.date` — zo houden alle
   * bestaande aanroepers (o.a. `useBarDrag`, de niet-taakdatum-CPM-plekken) exact dezelfde signatuur.
   */
  addWorkDays(startDate: Date, workDays: number): Date {
    return this.addWorkDaysChecked(startDate, workDays).date;
  }

  /**
   * `addWorkDays` mét expliciet CAP-signaal (WP7 "Onwerkbaar-venster-detectie"). `capped: true` zodra
   * een van de twee veiligheidsgrenzen wordt geraakt — de MAX_SCAN-werkdag-zoek (een kalender die het
   * venster onwerkbaar maakt, bv. een aaneengesloten holiday-blok) óf de MAX_DAYS-tellimiet — waarna de
   * teruggegeven `Date` een gecapte (niet-betekenisvolle) datum is i.p.v. de echte laatste werkdag. De
   * datum-uitkomst is per pad IDENTIEK aan de oude `addWorkDays` (dezelfde `current` op elke return/break);
   * alleen het `capped`-veld is nieuw. De solver aggregeert dit tot een zachte `cappedTaskIds`-waarschuwing.
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
   * Pakket A2 (gedragsneutraal, de O(n²)-killer): arithmetisch i.p.v. dag-voor-dag scannen.
   * Semantiek die exact wordt gerepliceerd t.o.v. de oude lus:
   *  - De oude lus checkte dagen k=0,1,… met dagindex `startIdx+k` zolang
   *    `startMs + k·MS_PER_DAY ≤ endMs` (elke +1 kalenderdag = +MS_PER_DAY in UTC, geen DST).
   *    Aantal dagen = `floor((endMs−startMs)/MS_PER_DAY)+1` als `endMs≥startMs`, anders 0.
   *  - CAP: de oude lus brak af zodra `steps > MAX_DAYS`; hij checkte dan de dagen k=0..MAX_DAYS
   *    (= MAX_DAYS+1 dagen) vóór hij stopte ⇒ `cappedDays = min(totalDays, MAX_DAYS+1)`.
   * Telling: #werk-weekdagen in het (gecapte) bereik − #(holidays op een werk-weekdag) daarin
   *  + #(werkende uitzonderingen op een NIET-werk-weekdag) daarin (fase 3.8, T2 — zie de val-kuil bij
   *  `workingExceptionOnNonWorkWeekdayIdxSorted`: zonder deze term telt een werkende zaterdag niet mee).
   */
  workDaysBetween(start: Date, end: Date): number {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (!(endMs >= startMs)) return 0; // dekt endMs<startMs én NaN (NaN>=x is false) — 0-iteratie-lus
    const totalDays = Math.floor((endMs - startMs) / CalendarEngine.MS_PER_DAY) + 1;
    const cappedDays = Math.min(totalDays, CalendarEngine.MAX_DAYS + 1);
    const startIdx = Math.floor(startMs / CalendarEngine.MS_PER_DAY);
    const lastIdx = startIdx + cappedDays - 1;
    return this.countWorkWeekdays(startIdx, lastIdx)
      - this.countHolidayWorkdaysInRange(startIdx, lastIdx)
      + this.countWorkingExceptionsAddedInRange(startIdx, lastIdx);
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

  /** Aantal elementen van een oplopend gesorteerde dagindex-lijst in het inclusieve bereik
   *  [startIdx, lastIdx], via lower/upper-bound binary search. Gedeeld door de holiday- (aftrekken)
   *  en de werkende-uitzondering-telling (fase 3.8, T2 — optellen): zelfde vorm, ander teken bij de
   *  aanroeper. Extractie is een pure refactor — geen gedragswijziging t.o.v. de oude, hier inline
   *  staande versie. */
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

  /** Fase 3.8 (T2, de val-kuil uit het plan): aantal werkende uitzonderingen ÓP een NIET-werk-weekdag
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

  /** De EFFECTIEVE banden (minuut-van-de-dag, `[start,end)`) die op de KALENDERDAG van `d` gelden —
   *  via hetzelfde `bandsStartingOn`-pad dat de solver zelf voor elke snap/telling gebruikt, dus
   *  INCLUSIEF werkende uitzonderingen en holidays. Alleen voor read-only VERGELIJKING tussen twee
   *  kalenders OP EEN SPECIFIEKE DATUM (Z11-fixronde punt 1, `calendarsAgreeOnSharedWorkdayBands` in
   *  `relationMath.ts`) — geen enkele bestaande dag-/uur-lus leest hierlangs. Een eerdere versie van
   *  deze getter vergeleek de STATISCHE weekdagtabel (`workTime.byWeekday`) zonder datumcontext; die
   *  ziet uitzonderingen/holidays niet — twee kalenders met een identiek WEEKPATROON maar een
   *  afwijkende werkende uitzondering op precies de landingsdag zagen er zo ten onrechte "identiek"
   *  uit (reviewer-probe, exact de msp-04-foutvorm, latent). Geeft een LEGE array terug (nooit
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

  /** Afgeleide `hoursPerDay` voor een uur-kalender (§3.2, Bevinding 8): de MODALE band-som over de
   *  werk-weekdagen (meest voorkomende dagsom in uren), bij gelijkspel de HOOGSTE.
   *
   *  T16-VEEGLIJST (bekende beperking, gedocumenteerd, niet gefixt): deze functie telt een weekdag
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

  /** Fase 3.8 (T2-review MIDDEN-2, orkestratorbesluit; her-review LAAG-9): de banden van een "normale
   *  werkdag" van deze kalender. MOET dezelfde dag aanwijzen als `computeDerivedHoursPerDay` (de MODALE
   *  dagsom, bij gelijkspel de HOOGSTE) — anders spreken `hoursPerDay` en de band-loze-uitzondering-
   *  fallback elkaar tegen. T2-review LAAG-9 (bug, gevonden vóór deze fix): de vorige versie koos de
   *  EERSTE `workDays`-weekdag met banden, ongeacht frequentie; op een asymmetrische kalender (ma 4u,
   *  di-vr 8u) wees dat maandag (4u/240m) aan terwijl `hoursPerDay`=8 (modaal, 4 van de 5 werkdagen) —
   *  een band-loze werkende zaterdag kreeg dan 240m i.p.v. de verwachte 480m.
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
   *  T16-VEEGLIJST (bekende beperking, gedocumenteerd, niet gefixt): het eerste filter hierboven
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
      const freq = new Map<number, number>();
      for (const { minutes } of sums) freq.set(minutes, (freq.get(minutes) ?? 0) + 1);
      let bestMinutes = sums[0].minutes;
      let bestCount = 0;
      for (const [minutes, count] of freq) {
        if (count > bestCount || (count === bestCount && minutes > bestMinutes)) {
          bestMinutes = minutes;
          bestCount = count;
        }
      }
      const match = sums.find((s) => s.minutes === bestMinutes)!; // eerste (laagste wd) met de modale som
      return byWeekday[match.wd]!;
    }
    for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
      const bands = byWeekday[wd];
      if (bands && bands.length > 0) return bands;
    }
    return [];
  }

  // ── Band-materialisatie (venster-gebaseerd, gememoized op het kalender-object, §4.2/§5.6) ──

  /** UTC-middernacht-ms van de dag die `ms` bevat (epoch is op UTC-middernacht uitgelijnd). */
  private dayStartMsOf(ms: number): number {
    return Math.floor(ms / CalendarEngine.MS_PER_DAY) * CalendarEngine.MS_PER_DAY;
  }

  /** Absolute werk-intervallen voor de banden die op de dag `dayMs` STARTEN (§4.2). Een holiday op
   *  díé dag onderdrukt uitsluitend de banden die er starten (Bevinding 9); de staart na middernacht
   *  van de wrap-band van de vórige dag hoort bij die vorige dag en loopt gewoon door (hij wordt bij
   *  díé dag gematerialiseerd). Gememoized op de gedeelde kalender-cache.
   *  Fase 3.8 (T2, precedentie c): een werkende uitzondering op `dayMs` wint van de holiday-onderdrukking
   *  hieronder. Fallback-keten voor de te gebruiken banden (T2-review MIDDEN-2, orkestratorbesluit):
   *  (1) expliciete override-banden op de uitzondering zelf; anders (2) de eigen weekdag-banden van
   *  `dayMs` als die niet leeg zijn; anders (3) `standardWorkdayBands` (de banden van een normale
   *  werkdag van deze kalender) — zodat een band-loze uitzondering op een dag zonder eigen weekdag-
   *  banden (zaterdag in een ma-vr-kalender) niet stilzwijgend 0 minuten oplevert terwijl `isWorkDay`
   *  "werkend" zegt. Zonder `workingExceptions` is `workingExceptionDaySet` leeg en is dit tak-loos
   *  byte-identiek gedrag. */
  private bandsStartingOn(dayMs: number): BandInterval[] {
    const cache = this.bandCache!;
    const hit = cache.days.get(dayMs);
    if (hit) return hit;
    cache.fills++;
    const d = new Date(dayMs);
    const dayIdx = Math.floor(dayMs / CalendarEngine.MS_PER_DAY); // dayMs is altijd dag-uitgelijnd (aanroepers)
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
