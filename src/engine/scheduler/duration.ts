import type { Task, TaskSplitGap } from '@/types/task';

/** Expliciete eenheid met deterministische leesmigratie voor oudere runtime-data. */
export function taskDurationUnit(task: Task): 'days' | 'hours' {
  const legacy = task.time as Task['time'] & { durationUnit?: 'days' | 'hours' };
  return legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
}

/**
 * Gedeelde duur-resolutie-helpers (fase 2.8b, ontwerpdoc §3.1).
 *
 * PLAATSING: het ontwerpdoc beschrijft deze helpers onder §3.1 ("src/types/task.ts") maar hun
 * tweede argument is de effectieve KALENDER-ENGINE (`isHourMode`/`hoursPerDay`), die in
 * `src/engine/scheduler` leeft. Ze in `src/types` zetten zou een types→engine-afhankelijkheid
 * introduceren; de golf-0-tabel (§10, rij G0) noemt bovendien geen helper-bestand. Daarom leven
 * ze hier, naast `CalendarEngine`/`CPMSolver` — de enige aanroepers (golf 1/2), conform de
 * expliciete fallback in de golf-0-opdracht.
 *
 * FORWARD-COMPAT: het argument is getypeerd als het minimale structurele contract
 * `DurationCalendar` ({ isHourMode, hoursPerDay }). Golf 1 laat `CalendarEngine` dit contract
 * vervullen (het krijgt daar `isHourMode`); tot die tijd is de helper testbaar met een plain
 * object, en roept nog niemand hem aan (geen gedragswijziging in golf 0).
 */

/**
 * T15 (mijlpaal-met-duur, §9/O1) / H3 (Opus-review T15-iteratie-2, gedeeld getrokken uit
 * CPMSolver.ts): MS Projects `isMilestone`-vlag is een WEERGAVEmarkering die onafhankelijk van de
 * opgeslagen duur gezet kan worden ("Markeer taak als mijlpaal" in Taakinformatie) — MSP's eigen
 * rekenkern plant zo'n taak gewoon volgens haar eigen duur, ze klapt NIET stil om naar 0. Bewijs:
 * `mpp14task.mpp`/`mpp14task-from2013.mpp` (MSO-taak, `isMilestone=true`, duur 5 dagen — MSP-finish
 * = start + 5 werkdagen) en `taskFlags-mpp14Project2010/2013.mpp` ("Milestone: Yes", duur 8 dagen,
 * zelfde patroon) — vier publieke MPXJ-testfixtures. Alleen een taak met duur 0 is voor de PLANNING
 * een echte mijlpaal.
 *
 * H3 verplaatste deze helper van `CPMSolver.ts` naar hier (in plaats van 'm daar te laten en
 * `relationMath.ts` ernaar te laten importeren): `relationMath.ts` heeft ZIJN EIGEN kale
 * `isMilestone`-checks (`succElapsed`/`predElapsed`/`predIsMilestone`/`succIsFinishMs`/
 * `succIsStartMs`) die dezelfde bug droegen (msp-30/msp-31-mutatiebewijs: een ELAPSEDTIME-taak die
 * ÓÓK `milestone:true` + een reële duur draagt, kreeg via `relationMath.ts` een dag verschoven
 * resultaat t.o.v. de niet-mijlpaal-controlevariant) — maar `CPMSolver.ts` importeert zelf al UIT
 * `relationMath.ts` (`forwardConstraint`/`backwardConstraint`), dus een import de andere kant op zou
 * een cyclus zijn. `duration.ts` is voor beide bestanden al een blaadje (geen afhankelijkheid naar
 * `CPMSolver`/`relationMath`), dus hier kan de EEN definitie zonder cyclus door beide gedeeld worden.
 */
export function isZeroDurationMilestone(task: Task): boolean {
  return task.isMilestone && task.time.scheduleDuration === 0;
}

/** Minimaal contract dat een uur-bewuste kalender-engine vervult (golf 1). */
export interface DurationCalendar {
  /** True ⇒ uur-kalender (`WorkCalendar.workTime` aanwezig); false ⇒ dag-kalender. */
  readonly isHourMode: boolean;
  /** Netto werkuren per dag; de dag↔minuut-factor is `hoursPerDay × 60`. */
  readonly hoursPerDay: number;
}

/**
 * Duur van een taak in MINUTEN, in de effectieve kalender.
 *
 * - Urentaak: `durationMinutes` is altijd de bron van waarheid, los van de kalenderidentiteit.
 * - Dagtaak: `scheduleDuration × hoursPerDay × 60`; dit is alleen een kalenderafhankelijk
 *   equivalent voor analyse/weergave en verandert de opgeslagen dagaantallen nooit.
 */
export function durationMinutesOf(task: Task, effCal: DurationCalendar): number {
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return task.time.scheduleDuration * effCal.hoursPerDay * 60;
}

/**
 * Duur van een taak in eigen-kalender-WERKDAGEN (mogelijk fractioneel voor een urentaak).
 *
 * Dit equivalent mag nooit worden gebruikt om een urentaak op een bandloze kalender alsnog als
 * dagen te plannen; `CPMSolver.solve` blokkeert dat expliciet. De native bron blijft minuten.
 */
export function durationDaysOf(task: Task, effCal: DurationCalendar): number {
  if (taskDurationUnit(task) === 'hours') {
    return (task.time.durationMinutes ?? 0) / (effCal.hoursPerDay * 60);
  }
  return task.time.scheduleDuration;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// T8 — ELAPSEDTIME rekent 24/7 in KLOK-tijd, niet in werktijd. Precedent: `resolveElapsedMinutes`
// + de `lagUnit === 'ELAPSEDTIME'`-takken in `relationMath.ts` doen exact dit al voor relatie-lags
// (kale Date-rekenkunde, geen kalenderband-toetsing) — dit is dezelfde semantiek toegepast op
// taakDUUR i.p.v. lag. GEEN tweede variant: `MS_PER_MIN` hieronder is bewust dezelfde constante
// als `relationMath.ts` exporteert (lokaal gedupliceerd i.p.v. geïmporteerd, want duration.ts is
// een blaadmodule zonder afhankelijkheid op relationMath — zie de moduleheader hierboven).
// ─────────────────────────────────────────────────────────────────────────────────────────────
const MS_PER_MIN = 60_000;
// T8-review M3 — zonder klem geeft een absurde ELAPSEDTIME-duur (via MCP `duration`, een corrupt
// bestand, of gewoon een tikfout — een taak-duur is invoer, niet gevalideerd tot hier) een
// `new Date(...)` buiten JS's representeerbare bereik (±8.64e15 ms rond epoch). `new Date()` zelf
// gooit dan niet (levert stil een Invalid Date), maar élke `formatDate`/`formatInstant` erop
// (`.toISOString()`, overal in deze solver) gooit een ONGEVANGEN RangeError — een crash diep in de
// forward/backward-pass zonder duidelijke herkomst. `MAX_ELAPSED_MINUTES` spiegelt
// `CalendarEngine.MAX_DAYS` (200.000 dagen ≈ 547 jaar, ruim boven elk plausibel bouwproject) × 24×60
// — dezelfde beproefde bovengrens, geen derde losse magic number — en de klem-PLAATS spiegelt
// `CalendarEngine.addWorkMinutes` (`Math.min(minutes, MAX_MINUTES)`, vlak vóór de Date-rekenkunde).
const MAX_ELAPSED_MINUTES = 200_000 * 24 * 60;

/** Klem `minutes` op `±MAX_ELAPSED_MINUTES`; NaN/Infinity (kapotte invoer) ⇒ 0 (no-op, nooit een
 *  gecrashte Date i.p.v. een stille verkeerde). */
function clampElapsedMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  if (minutes > MAX_ELAPSED_MINUTES) return MAX_ELAPSED_MINUTES;
  if (minutes < -MAX_ELAPSED_MINUTES) return -MAX_ELAPSED_MINUTES;
  return minutes;
}

/**
 * Duur van een ELAPSEDTIME-taak in KLOK-minuten (24/7).
 *
 * - Urentaak: `durationMinutes` is al klok-tijd-neutraal (T10-scoping in `mppReader.ts`: dat
 *   veld is `raw.durationRaw / 10` ONGEACHT WORKTIME/ELAPSEDTIME — "een minuut is een minuut") —
 *   direct bruikbaar, geen omrekening nodig.
 * - Dagtaak:
 *   `scheduleDuration` is voor ELAPSEDTIME het aantal KALENDERdagen (`mppReader.ts` zet dit al zo:
 *   `raw.durationRaw / (24 × 60 × 10)`) × 24 × 60 — de VASTE klokdag, NOOIT `hoursPerDay` (dat zou
 *   de T10-dubbele-deling-valkuil zijn, hier toegepast op duur i.p.v. op de leeskant).
 */
export function elapsedMinutesOf(task: Task, effCal: DurationCalendar): number {
  void effCal;
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return task.time.scheduleDuration * 24 * 60;
}

/** Tel `minutes` KLOK-minuten op bij `start` (24/7, geen kalenderband-toetsing) — de
 *  ELAPSEDTIME-tegenhanger van `CalendarEngine.addWorkMinutes`/`addWorkDaysChecked`. Geklemd
 *  (M3, T8-review): zie `MAX_ELAPSED_MINUTES` hierboven. */
export function addElapsedMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + clampElapsedMinutes(minutes) * MS_PER_MIN);
}

/** Trek `minutes` KLOK-minuten af van `end` (24/7, spiegel van `addElapsedMinutes`) — de
 *  ELAPSEDTIME-tegenhanger van `CalendarEngine.subtractWorkMinutes`/`subtractWorkDays`. Geklemd
 *  (M3, T8-review): zie `MAX_ELAPSED_MINUTES` hierboven. */
export function subtractElapsedMinutes(end: Date, minutes: number): Date {
  return new Date(end.getTime() - clampElapsedMinutes(minutes) * MS_PER_MIN);
}

/**
 * Getekend KLOK-span van `a` naar `b`, in eigen-kalender-DAGEN (fractioneel mogelijk) — de
 * ELAPSEDTIME-tegenhanger van `CPMSolver.signedWorkDays`/`workMinutesBetween÷(hoursPerDay×60)`
 * voor float-rekenwerk (§5.5).
 *
 * BEVINDING (T8, msp-14-mutatiebewijs): een ELAPSEDTIME-taak mag zijn ES/EF op een NIET-werkdag
 * hebben (dat is het hele punt van 24/7) — iets wat een WORKTIME-taak per constructie nooit
 * overkomt. `signedWorkDays`s `workDaysBetween(a,a) − 1` gaat daarop STUK: op een niet-werkdag
 * telt `workDaysBetween` 0 werkdagen, dus een taak met LS=ES/LF=EF (geen enkele speling-oorzaak)
 * kreeg tóch tf=−1 — spookspeling, puur omdat de klassieke WORKTIME-tel-conventie (inclusieve
 * werkdag-telling) een niet-werkdag niet kan representeren. Deze functie rekent daarom met de
 * RUWE klok-ms-afstand — geen werkdag-telling, geen inclusieve −1-correctie (die correctie hoort
 * bij WORKTIMEs "dag 1 telt al mee"-conventie, niet bij een kale kloktijd-spanne) — zodat a===b
 * altijd exact 0 geeft, ongeacht welke dag van de week dat is. `effCal.isHourMode` doet hier NIET
 * ter zake voor de rekenkunde zelf (§L2, T8-review): een klokdag is altijd 24×60×`MS_PER_MIN`,
 * of de kalender nu uur- of dag-precisie kent — het `DurationCalendar`-argument staat er puur om
 * dezelfde aanroepvorm te delen met `durationMinutesOf`/`durationDaysOf` (die dat verschil wél
 * nodig hebben, via `hoursPerDay`).
 *
 * EENHEDENBESLUIT (T8-review M1, orkestratorbesluit — 2026-08-17, herformulering T8-hercheck 2):
 * een ELAPSEDTIME-taak rapporteert `tf`/`ff` dus in KALENDERdagen, ONGEMARKEERD naast WORKTIME-
 * taken in dezelfde `tf`/`ff`-velden (die in WERKdagen rekenen, `signedWorkDays`). Onderzocht vóór
 * dit besluit: de lokale MPXJ-broncheckout onder `testdata-crawl/mpxj` bevat alleen de
 * `SlackCalculator`-INTERFACE (`org.mpxj.SlackCalculator`), zonder een MSP-implementatie (`org.
 * mpxj.cpm.MicrosoftSlackCalculator` — de klasse die MS Projects "Total Slack" daadwerkelijk
 * berekent — bestaat niet in deze checkout; wel aanwezig: Primavera-slackcode) — geen uitsluitsel
 * over wélke eenheid MSP zelf toont voor een elapsed-taak. Wel bevestigd (`TimeUnit.java`): MPXJ's
 * `Duration`-model kent
 * native `ELAPSED_DAYS`/`ELAPSED_HOURS`/… als aparte eenheden náást `DAYS`/`HOURS` — een per-taak
 * eenheid voor duur (en dus impliciet voor afgeleide velden als slack) is dus een bestaand MPXJ-
 * concept, geen verzinsel van dit project. Bij ontbrekend uitsluitsel: per-taak-semantiek behouden
 * (consistent met hoe `scheduleDuration` al vóór T8 werkte — ook daar bepaalt de taak zijn eigen
 * eenheid). Gepind in `cases-msp-pariteit.json` (`msp-21-t8-review-m1-eenheden-float`): een
 * ELAPSEDTIME-taak en een WORKTIME-sibling onder dezelfde FS-sink krijgen zichtbaar verschillende
 * getallen (kalenderdagen resp. werkdagen) — en binnen ÉÉN taak wijkt `tf` (kalenderdagen, deze
 * functie) zelfs af van `ff` (nog werkdag-geteld, zie M2/L3-beperking bij de relFloat-regel in
 * `scheduleAnalysis.ts`). Toekomstig werk dat dit wil markeren (bv. een `floatUnit`-veld) is een
 * plan-notitie, geen T8-scope.
 */
export function signedElapsedSpan(a: Date, b: Date, effCal: DurationCalendar): number {
  void effCal;
  return (b.getTime() - a.getTime()) / (24 * 60 * MS_PER_MIN);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Z7 (etappe "nul afwijkingen") — SPLITGAPS in de duur-optelling. Canonieke regel (plan-§Z7,
// letterlijk): "de finish is de start plus de duur, waarbij elk gat als extra niet-werktijd telt
// op zijn eigen offset" — een UITBREIDING van de duur-optelling, GEEN tweede algoritme.
//
// Z7-FIXRONDE (H1, WORTELFIX — AS-VERWARRING gecorrigeerd, reviewbevinding): de EERSTE versie van
// dit blok telde gaten binnen een `[windowStart, windowEnd)`-venster met een KALE overlap-
// vergelijking tegen `windowEnd = totale duur in minuten` (`durationMinutesOf`) — dat klemde/
// trunceerde elk gat waarvan `afterMinutes + gapMinutes` boven die grens uitkwam. Reviewer-bewijs
// dat dit FOUT was: `mpxj/junit/data/mpp14timephased.mpp`s "Task 5 - 24 Hour" — de ONGEKLEMDE som
// `4500 (duur) + 5760 (gat) minuten` vanaf `2008-11-20T09:00` reproduceert MSP's eigen opgeslagen
// finish EXACT; de geklemde versie sneed het gat af en gaf een finish >9 werkdagen te vroeg.
//
// DE ECHTE OORZAAK: `TaskSplitGap.afterMinutes`/`gapMinutes` staan NIET op de "kale werkduur"-as
// (`durationMinutesOf`s eenheid, die per definitie GEEN gaten bevat) — ze staan op MPXJ/MSP's eigen
// `elapsedWorkMinutes`-as (`mppTimephased.ts`'s `TimephasedWorkPeriod`), die CUMULATIEF door de
// tijdgefaseerde periodes loopt en daarbij ELKE periode meetelt, ook een periode met `workMinutes
// === 0` (een gat telt dus ZELF ook mee in hoeveel de as voor het VOLGENDE gat al is opgeschoven).
// Voor een taak met twee of meer gaten is deze as dus NIET gelijk aan "zuivere werktijd sinds
// taakstart" — elk volgend gat se `afterMinutes` incorporeert de voorgaande gaten al. Vergelijken
// tegen `durationMinutesOf` (dat wél zuivere werktijd is) was daarom een appels-met-peren-vergelijking.
//
// DE FIX: geen vast venster meer, maar een WANDELING over de gaten-as — exact de tegenhanger van
// hoe `CalendarEngine.addWorkMinutes`/`addWorkDaysChecked` een ECHTE kalender wandelen (werksegment
// verbruiken, bij een niet-werk-blok overspringen, herhalen). `splitTotalSpanMinutes` hieronder doet
// dat op de SYNTHETISCHE gaten-as i.p.v. op echte kalenderbanden: gegeven een hoeveelheid ZUIVERE
// werk-minuten die verzet moet worden, loopt ze de (gesorteerde) gaten langs en telt élk gat waarvan
// de eigen voorafgaande werksegment nog niet genoeg is om de gevraagde hoeveelheid te dekken volledig
// mee — "duur + alle VOORAFGAANDE gaten" (letterlijk de tweede oplossingsvorm die de fixronde
// aanreikte), zonder dat de LEZER (`mppTimephased.ts`, baan L) de as hoeft om te rekenen: de
// consument (hier) interpreteert `afterMinutes` voortaan correct als een AS-POSITIE, niet als een
// zuiver-werk-hoeveelheid — dat is de "kleinste-oppervlak"-keuze (blijft binnen `src/engine/
// scheduler/**`, geen wijziging aan de byte-decoder of de vorm van `TaskSplitGap` zelf).
//
// Bijkomend, gratis effect (H3, randgedrag): "offset ≥ duur ⇒ genegeerd" volgt nu VANZELF uit de
// wandeling (een gat waarvan het voorafgaande werksegment de gevraagde hoeveelheid al haalt/evenaart
// wordt nooit overgestoken) — geen aparte trunceer-regel meer nodig.
//
// AANGRIJPINGSPUNTEN 1/3/4 (volledige duur): `splitTotalSpanMinutes(gaps, durationMinutesOf(...))`
// geeft de TOTALE as-lengte (duur + alle geraakte gaten) — rechtstreeks door te geven aan
// `addWorkMinutes`/`addWorkDaysChecked`/`subtractWork*`/`addWorkingDaysSigned`, GEEN losse optelling
// meer nodig.
//
// AANGRIJPINGSPUNT 2 (IN-PROGRESS-restwerk, H2): het restwerkvenster is nu een VERSCHIL van twee
// wandelingen — `splitTotalSpanMinutes(gaps, totaleWerkMinuten) − splitTotalSpanMinutes(gaps,
// reedsAfgewerkteWerkMinuten)` — beide op DEZELFDE as-wandeling, dus consistent met elkaar (in
// tegenstelling tot de oude bug: `completedSpan` was een zuivere-werk-hoeveelheid die rechtstreeks
// tegen de as-gepositioneerde `afterMinutes` vergeleken werd — bij ≥2 gaten waarvan er één al
// gepasseerd was, liep dat uiteen en werd een gepasseerd gat soms dubbel meegeteld). Omdat de
// wandelfunctie monotoon/prefix-consistent is (twee keer wandelen vanaf 0 met een groter en een
// kleiner doel deelt exact hetzelfde begin-traject), is dit verschil altijd correct: gaten die
// VOLLEDIG vóór het reeds-afgewerkte doel liggen heffen elkaar in het verschil precies op (nul
// netto bijdrage), gaten die (deels) ná dat doel liggen tellen voluit mee in het restwerk.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Totale as-lengte (in werkMINUTEN, `TaskSplitGap`s eigen eenheid) die nodig is om `workMinutes`
 * aan ZUIVERE werk te verzetten, gegeven `gaps` — een wandeling over de synthetische gaten-as
 * (spiegelt `CalendarEngine.addWorkMinutes`s band-voor-band-wandeling, maar op gaten i.p.v. echte
 * kalenderbanden). `gaps` hoeft niet vooraf gesorteerd te zijn (defensief gesorteerd op
 * `afterMinutes`, zelfde "nooit blindelings vertrouwen op aanroeper-volgorde"-conventie als
 * `deriveSplitGapsFromPeriods` in `mppTimephased.ts`).
 *
 * ALGORITME: loop de (gesorteerde) gaten langs; per gat is `segment = gat.afterMinutes − axisPos`
 * het ZUIVERE werksegment vóór dat gat (geen ander gat kan er middenin zitten, want gesorteerd en
 * `axisPos` schuift alleen over reeds-verwerkte gaten heen). Haalt `workDone + segment` het doel
 * (`workMinutes`), dan ligt de aankomst BINNEN dat segment — `axisPos + (workMinutes − workDone)`,
 * het gat wordt NIET overgestoken (dekt zowel "doel vóór het gat" als "doel exact op de gat-start"
 * — H3: "gat dat exact op de grens begint telt niet mee vóór die grens", spiegelbeeld van "telt wél
 * mee ná die grens" in de verschil-vorm hierboven). Anders: `workDone += segment`, `axisPos` springt
 * over het HELE gat heen (`gat.afterMinutes + gat.gapMinutes`) en de wandeling gaat door. Geen gaten
 * meer (of geen enkel gat gehaald) ⇒ het restant is zuiver werk: `axisPos + (workMinutes − workDone)`.
 *
 * Defensief (`splitGaps` is afgeleide data — een corrupt/hostiel document, bv. via MCP of een
 * handgemaakte IFC/JSON-import, kan in theorie een niet-eindig, negatief-lengte, of terugspringend
 * gat dragen): NaN/Infinity/`gapMinutes<=0` wordt overgeslagen; `gapStart` wordt geklemd op
 * `axisPos` (nooit terug de tijd in) zodat een overlappend/uit-volgorde gat de wandeling niet kan
 * laten teruglopen. `workMinutes<=0` ⇒ 0 (spiegelt `addWorkMinutes`s `minutes<=0`-kortsluiting).
 */
export function splitTotalSpanMinutes(gaps: readonly TaskSplitGap[] | undefined, workMinutes: number): number {
  if (!gaps || gaps.length === 0 || !(workMinutes > 0)) return Math.max(0, workMinutes || 0);
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  let axisPos = 0;
  let workDone = 0;
  for (const g of sorted) {
    if (!Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes) || g.gapMinutes <= 0) continue;
    const gapStart = Math.max(g.afterMinutes, axisPos);
    const gapEnd = g.afterMinutes + g.gapMinutes;
    if (gapEnd <= gapStart) continue; // volledig al ingehaald/ontaard — geen bijdrage
    const segment = gapStart - axisPos;
    if (workDone + segment >= workMinutes) {
      return axisPos + (workMinutes - workDone);
    }
    workDone += segment;
    axisPos = gapEnd;
  }
  return axisPos + (workMinutes - workDone);
}

/**
 * `splitTotalSpanMinutes` omgerekend naar eigen-kalender-WERKDAGEN (dag-modus-aanroepers).
 *
 * Z7-FIXRONDE-2 (MIDDEN, WORTELFIX — dag-modus-regressie op een NIET-GEHELE `hoursPerDay`,
 * reviewbevinding): de eerste versie deed onvoorwaardelijk `splitTotalSpanMinutes(gaps,
 * workMinutes) / (hoursPerDay×60)` — voor een GATLOZE taak is dat `(scheduleDuration×hoursPerDay
 * ×60) / (hoursPerDay×60)`, een vermenigvuldig-dan-delen-rondje door DEZELFDE factor dat bij een
 * niet-representeerbare `hoursPerDay` (bv. 8,4 — vrij invoerbaar via Projectinfo, en aanwezig in
 * `.mpp`-kalenders; corpus mist dit toevallig omdat alles daar op hpd 8 staat, exact in binair)
 * GEEN exacte 3 teruggeeft maar 3.0000000000000004. `addWorkDaysChecked`s lus (`remaining =
 * workDays−1`, `while(remaining>0){…; remaining--;}`) ziet die epsilon als "nog niet klaar" en
 * doet er ÉÉN werkdag te veel bij — een gatloze 3-daagse taak landde zo een dag te laat.
 *
 * FIX (reviewer-voorstel, letterlijk gevolgd): houd de EXACTE integer-basis — `durationDaysOf`
 * leest voor een dag-kalender `scheduleDuration` RAUW terug, geen vermenigvuldiging, dus geen
 * rondingsrisico — en tel ALLEEN de gat-TOESLAG er fractioneel bij op. Voor een gatloze taak is
 * die toeslag `splitTotalSpanMinutes(undefined, workMinutes) − workMinutes = 0` EXACT (de
 * kortsluiting in `splitTotalSpanMinutes` hierboven geeft `workMinutes` ongewijzigd terug), dus
 * `totalDays = durationDaysOf(task, eng) + 0` — BYTE-IDENTIEK aan het pad van vóór Z7. Voor een
 * taak MET gaten blijft de toeslag zelf een deling door `hoursPerDay×60` (onvermijdelijk, want
 * `TaskSplitGap` leeft in minuten) — dat rondingsrisico was er al vóór deze fixronde en verandert
 * niet; de fix schrapt uitsluitend het EXTRA, VERMIJDBARE rondje voor de gatloze meerderheid.
 *
 * Signatuur gewijzigd naar `(task, eng)` i.p.v. `(gaps, workMinutes, effCal)` — de aanroeper mag
 * `durationMinutesOf(task, eng)` niet meer VOORAF berekenen (dat was precies de bron van de extra
 * afronding); deze functie beslist zelf, per taak, of de minuten-omweg nodig is.
 */
export function splitTotalSpanDays(task: Task, eng: DurationCalendar): number {
  const base = durationDaysOf(task, eng);
  if (!task.splitGaps || task.splitGaps.length === 0) return base;
  const workMinutes = durationMinutesOf(task, eng);
  const extraMinutes = splitTotalSpanMinutes(task.splitGaps, workMinutes) - workMinutes;
  return base + extraMinutes / (eng.hoursPerDay * 60);
}
