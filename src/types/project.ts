/** Voortgangs-scheduling-modus (P6, fase 2.6). undefined ⇒ RETAINED_LOGIC (de default). */
export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

/**
 * Project-scoped reken-opties (fase 2.9, §3.4/§7). ELKE default = het huidige gedrag ⇒ een afwezig
 * (of leeg) blok is byte-identiek aan vóór 2.9. Deze opties horen bij het BESTAND (net als
 * statusDate/progressMode), niet bij de app-settings — anders zou hetzelfde bestand op twee machines
 * een ander schema geven (§7). De solver leest ze via `CPMOptions.schedulingOptions`.
 */
export interface SchedulingOptions {
  /** Kalender voor relatie-lag (P6 4-way, Rapport B §7.1). Default 'predecessor' = de huidige
   *  LAG_CALENDAR-constante (lagCalendar.ts) ⇒ byte-identiek. */
  lagCalendar?: 'predecessor' | 'successor' | '24hour' | 'projectDefault';
  /** Kritiek-definitie. `threshold` is de bestaande grens in taakdagen; `thresholdHours` bewaart
   *  een P6/XER-grens in bronuren en wordt per taak tegen floaturen op diens effectieve kalender
   *  vergeleken. Bij beide wint `thresholdHours`. Beide grenzen mogen negatief zijn. */
  criticalDefinition?: {
    mode: 'totalFloat' | 'longestPath';
    threshold?: number;
    thresholdHours?: number;
  };
  /** TF-berekeningswijze. Default 'smallest' = de huidige min(finish,start)-float. */
  totalFloatMode?: 'start' | 'finish' | 'smallest';
  /** Open-ended taken kritiek? Default = huidig gedrag (een eindtaak krijgt tf via LF−EF). */
  makeOpenEndedCritical?: boolean;
  /** P6/XER-bronsignaal: verwachte einddatums mogen de resterende duur begrenzen. X7 consumeert
   *  dit pas samen met het taakveld; bewaren voorkomt dat de SCHEDOPTIONS-keuze verloren gaat. */
  useExpectedFinishDates?: boolean;
  /** P6/XER-bronsemantiek voor de late zijde bij voortgang: een gestart activiteit houdt zijn
   *  geregistreerde start als LS, een voltooide activiteit houdt haar actual-venster als LS/LF,
   *  en zo'n voltooide opvolger trekt een nog open voorganger niet historisch terug. Afwezig/false
   *  bewaart de bestaande niet-XER-semantiek. */
  preserveActualDatesInBackwardPass?: boolean;
  /** P6/XER rapporteert vrije float niet negatief: bij een onhaalbare late constraint blijft TF
   *  negatief maar wordt FF nul. Afwezig/false bewaart de algemene getekende OPS-semantiek. */
  clampNegativeFreeFloat?: boolean;
  /** Near-critical-drempel in werkdagen (fractioneel in uur-modus). Default undefined ⇒ feature uit. */
  nearCriticalThreshold?: number;
  /** Multiple float paths. Default undefined ⇒ uit (byte-identiek). */
  floatPaths?: { enabled: boolean; method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number };
  /** T9 (voortgangsafronding, MSP-pariteit): MS Project hervat het restwerk van een IN PROGRESS-
   *  taak NIET op `max(statusDate, voorganger-druk)` (P6's eigen RETAINED_LOGIC-conventie, de
   *  huidige/default-berekening — zie `CPMSolver.ts`'s voortgangstak) maar op `actualStart +
   *  reeds-verstreken-duur` (`scheduleDuration/durationMinutes − remaining`, doorgesnapt via
   *  dezelfde werk-optelling als het restwerk zelf) — als DERDE, uitsluitend VERHOGENDE vloer naast
   *  de bestaande twee. Default `undefined`/`false` ⇒ het bestaande, P6-getrouwe gedrag, byte-
   *  identiek (bewaakt door `cases-progress.json`'s Scenario A/B/C, die P6's eigen gedocumenteerde
   *  RETAINED_LOGIC-semantiek toetsen — dít veld mag die niet stilzwijgend wijzigen). Uitsluitend
   *  `true` gezet door `mppReader.ts` (élke `.mpp`-import) — MSPDI/P6/CSV/IFC blijven op de
   *  bestaande P6-semantiek tot een eigen, apart gemeten reden om ze ook om te zetten. */
  resumeFromActualElapsed?: boolean;
  /** B1 (eindreview T16c, dossier (c)4-herdiagnose): MS Project verschuift een NIET-GESTARTE taak
   *  (`completion === 0`) NIET automatisch naar op-of-ná de statusdatum — dat "NIET GESTART:
   *  statusdatum als ondergrens"-gedrag (`CPMSolver.ts`'s forward-pass, vlak vóór
   *  `addDurationChecked`) is P6-eigen RETAINED_LOGIC-semantiek, net als `resumeFromActualElapsed`
   *  hierboven een P6-conventie vervangt voor de VOORTGANG-tak. Bewijs (reviewer-meting,
   *  `calendar-exception-precedence.mpp`, publiek MPXJ-fixture): mét de vloer wijkt de taak ~8 jaar
   *  af van MS Project se eigen opgeslagen Start/Finish (de statusdatum, 2023-05-01, ligt ver ná de
   *  taak se eigen 2015-10-01-anker); zónder de vloer is het resultaat minuut-exact. Een EIGEN,
   *  sibling-vlag i.p.v. hergebruik van `resumeFromActualElapsed` zelf: die twee bestrijken
   *  disjuncte taak-populaties (`completion > 0` resp. `completion === 0`) en een taak kan hooguit
   *  in één van beide vallen — samenvoegen tot één vlag zou geen enkel gedrag delen, alleen de
   *  "MSP-voortgangsconventie i.p.v. P6-RETAINED_LOGIC"-FAMILIE is gedeeld. Default `undefined`/
   *  `false` ⇒ het bestaande, P6-getrouwe gedrag, byte-identiek (bewaakt door dezelfde
   *  `cases-progress.json`-scenario's als `resumeFromActualElapsed`). Uitsluitend `true` gezet door
   *  `mppReader.ts` (élke `.mpp`-import); MSPDI/P6/CSV/IFC blijven op de bestaande P6-semantiek —
   *  het P6-pad (`progressMode`/statusdatum-gedreven planningen) behoudt de vloer bewust: dat is
   *  precies de RETAINED_LOGIC-conventie die P6 zélf documenteert. */
  unstartedIgnoresStatusDate?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string; // ISO 8601
  endDate: string;
  calendarId: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
  company: string;
  /**
   * WBS-codes automatisch nummeren (1.2.3.4, afgeleid uit de boompositie): aan ⇒ live
   * hernummeren bij elke structuurmutatie; uit/ontbreekt ⇒ vrije tekst (bestaand gedrag),
   * met een expliciete "Hernummer WBS"-actie. Nieuwe projecten krijgen true; geladen
   * bestanden zonder vlag blijven op vrije tekst (MSP-stabiliteitsmodel: codes in
   * omloop worden niet stilzwijgend herschreven).
   */
  wbsAutoNumber?: boolean;
  /** P6 "data date" (fase 2.6): de grens verleden/toekomst. undefined = geen statusdatum ⇒ gedrag
   *  exact als vóór 2.6. Gezet ⇒ remaining werk kan niet vóór deze dag starten. */
  statusDate?: string;    // ISO — date-only in dag-modus; mag datetime zijn in uur-modus (fase 2.8b, §3.4)
  /** Voortgangs-scheduling-modus (fase 2.6). undefined ⇒ RETAINED_LOGIC. Documentinstelling. */
  progressMode?: ProgressMode;
  /** OPTIONEEL — project-scoped reken-opties (fase 2.9, §3.4/§7). Afwezig ⇒ elke default ⇒
   *  byte-identiek gedrag. */
  schedulingOptions?: SchedulingOptions;
  /** OPTIONEEL — projectbinding aan een bedrijfsbibliotheek (spec B1, §2). Afwezig ⇒ project is
   *  (nog) aan geen enkel bedrijf gebonden; heropening zonder de pool is onschuldig. `companyName`
   *  is een gedenormaliseerde cache zodat een gedeeld bestand het bedrijf toont zonder de pool. */
  companyId?: string;
  companyName?: string;
}

export interface ProjectStats {
  totalTasks: number;
  totalMilestones: number;
  criticalPathLength: number; // in work days
  totalFloat: number; // in work days
  percentComplete: number; // 0-100
}
