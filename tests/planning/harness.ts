// Datagestuurd testharnas voor de ECHTE store + rekenmotor (headless).
// Voert testgevallen (JSON) uit via de echte acties en vergelijkt actueel vs. verwacht.
//
// Gebruik:  node harness.mjs <cases.json>
// cases.json = { cases: Case[] }  (zie type Case hieronder)
//
// Case = {
//   id, title,
//   calendar?: { workDays?: number[], holidays?: {name,startDate,endDate}[] }  // default: SCHOON (ma-vr, geen feestdagen)
//   anchor?: "YYYY-MM-DD"   // startdatum voor wortel-taken (default 2026-06-01)
//   tasks: [{ name, dur?, start?, milestone?, constraint?, constraint2?, hammock?, deadline? }]
//     dur in werkdagen (default 1); milestone => duur 0, TENZIJ `dur` expliciet meegegeven is
//              (T15, "mijlpaal-met-duur" — MSP staat `isMilestone=true` mét een reële duur toe en
//              plant dan gewoon volgens die duur, zie CPMSolver.ts's `isZeroDurationMilestone`)
//     durationType: WORKTIME (default) | ELAPSEDTIME (T8, MSP-pariteit) — ELAPSEDTIME rekent de
//              taakduur zelf 24/7 in klokTIJD (precedent: lagUnit ELAPSEDTIME hierboven, zelfde
//              semantiek toegepast op duur i.p.v. lag); afwezig => WORKTIME (byte-identiek)
//     hammock: true => LOE/hammock (fase 2.9 §4.4); afgeleide span-duur (SS/FS=start-driver, FF/SF=finish-driver),
//              eigen duur genegeerd, nooit kritiek, tf=ff=0
//     constraint: { type: ASAP|ALAP|SNET|SNLT|FNET|FNLT|MSO|MFO, date? } (P6-soft; MSO/MFO = Start/Finish On)
//     deadline: "YYYY-MM-DD" (zacht: alleen late datums/float)
//   links: [{ pred, succ, type, lag?, lagUnit?, lagPercent? }]
//     type: FINISH_START|START_START|FINISH_FINISH|START_FINISH
//     lag in dagen (default 0, negatief = lead); lagUnit: WORKTIME (default) | ELAPSEDTIME (kalenderdagen);
//     lagPercent: % van de voorgangerduur (overstemt lag)
//   resources?: [{ name, type?, maxUnits?, calendar?: Cal, steps?: {from,maxUnits}[] }]   (fase 2.5)
//     type: LABOR|EQUIPMENT|MATERIAL|SUBCONTRACTOR|CREW (default LABOR); maxUnits default 1
//     calendar: eigen resource-kalender (default: geen, dus projectkalender geldt)
//     steps: availabilitySteps (effective-dated capaciteit)
//   tasks[].assign?: [{ res, units, curve? }]   // res = naam uit resources[]; curve default UNIFORM
//   level?: { constrainToFloat?: boolean; resources?: string[] }   // leveler bestaat nog niet — zie buildAndSolve
//   schedulingOptions?: {…}   // fase 2.9 (§3.4): nearCriticalThreshold, criticalDefinition
//     {mode:'totalFloat'|'longestPath', threshold?}, totalFloatMode, makeOpenEndedCritical
//   expect: {
//     tasks?: { [name]: { es?,ef?,ls?,lf?,tf?,ff?,crit?,intf?,nearCrit?,floatPath? } },
//        // datums "YYYY-MM-DD"; tf/ff/intf getallen; crit/nearCrit boolean; intf=interfering (tf−ff)
//     criticalPathSet?: [names],   // vergeleken als verzameling (volgorde-onafhankelijk)
//     nearCriticalSet?: [names],   // near-critical-taken (0<tf≤drempel), verzameling (fase 2.9 §4.6)
//     hammockNoFinishDriversSet?: [names],   // hammocks zonder finish-driver (nul-lengte, fase 2.9 §4.4)
//     floatPaths?: { [name]: nr },   // float-path-nummer per taak (fase 2.9 golf 3 §4.6); ontbrekende taak = geen pad
//     criticalPaths?: [[names]],     // kritieke ketens (fase 2.9 golf 3 §4.6), verzameling-van-verzamelingen
//     drivingSet?: [[pred,succ,type]],  // welke relaties driving zijn (verzameling van triples)
//     violatedConstraintsSet?: [names], missedDeadlinesSet?: [names],  // taak-namen (verzameling)
//     projectEnd?, projectDuration?,
//     projectStartDate?,           // project.startDate ná de afterCPM-ops (pakket D1: moveProject/undo)
//     baselineTasks?: { [naam]: { start?, finish? } },  // datums in de ACTIEVE baseline (pakket D1 §1.6)
//     load?: { [resName]: { [isoDate]: number } },              // spot-checks op resourceLoadResult.load
//     overallocatedDays?: { [resName]: string[] },              // vergeleken als verzameling
//     error?: boolean | string     // true => verwacht een fout; string => substring in de foutmelding
//   }
// }
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { SchedulingOptions } from '@/types/project';
import { isDefaultProfile } from '@/engine/scheduler/conventions/registry';
import { legacyOptionsToProfile } from '@/services/ifc/schedulingProfileMigration';
import type { ResourceType, ResourceCurve } from '@/types/resource';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDuration } from '@/utils/durationFormat';
import type { WorkTimeBands, WorkingException } from '@/types/calendar';
import { computeVariance } from '@/engine/variance';
import {
  computeViewRows, isTreeMode, encodeBandKey, firstRowIndexByTask, NONE_RAWKEY,
  type ViewRow, type ViewContext,
} from '@/engine/view/visibleRows';
import type { FieldRef, FilterNode, GroupLevel, SortLevel } from '@/types/view';
import { scaleFromZoom, TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
import type { CustomFieldType } from '@/types/structure';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateId } from '@/utils/id';
import { isAncestorRelation, relationCycle } from '@/state/relationRules';
import { writeFileSync } from 'node:fs';
import { capturePayload } from '@/state/documentContract';
import {
  migrateToMinuteModel, normalizeTaskDate, taskDateContext, taskDateFieldSide, DayClockCache,
  MINUTE_MODEL_TIME_MODEL, type TaskDateContext, type TaskDateField,
} from '@/state/migrations/minuteModel';
import { dayStartInstant, isDateOnly, workdayOfInstant } from '@/engine/calendar/workdayRules';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isElapsedTask, isPinnedComplete } from '@/engine/scheduler/duration';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  MINUTENMODEL (fase F0 van "alleen uren", spec docs/superpowers/specs/2026-10-20-alleen-uren-design.md
//  §6.1). Met OPS_MINUTE_MODEL_RUN=1 of =2 rekent de harness elke DAGcase op de tijdas in minuten en
//  vergelijkt hij op dagniveau. Zonder de variabele verandert er niets.
//
//  - Run 1 (dagenmaat, het OPS-profiel na besluit B1): taken, lags en nivelleervertraging blijven in
//    dagen. Run 2 (urenmaat, zoals de conventie dagenmaat "uit" na F3): duur en lag gaan bij de invoer
//    naar minuten (werktijd per dag van de taak- of voorgangerkalender; kalendertijd × 1440).
//  - Laadgrens: de case wordt gebouwd zoals altijd. Vlak voor de eerste berekening loopt de
//    productiefunctie `migrateToMinuteModel` over de payload (een oud bestand: normalisatie D1–D7 en T1),
//    krijgt elke kalender zijn werkblokken (`calendarForEngine`, wat de motor na F2 zelf doet), en leest
//    de harness de projectstart met D1 en de statusdatum met D5 (de motorregel van F2).
//  - Vergelijker: elke verwachte datum zonder tijd gaat door dezelfde regel van zijn veld en wordt met
//    de werkdag van een moment (§0) vergeleken met de gekregen waarde, in de klok van de taak. Speling
//    met 10⁻⁶. Verwachte dag-getallen (duur, projectduur, variance) met 10⁻⁶; een gekregen getal dat
//    geen geheel aantal dagen is, staat als "~ niet geheel" in de uitvoer. Het projecteinde en de late
//    finish van een kalendertijd-taak zonder opvolger lezen anders dan D3 per veld; zie
//    `minuteComparer`. Een verwachte waarde MET tijd (alleen in `minuteModel.expect`) vergelijkt exact.
//  - Redencodes: een case die bewust anders uitkomt, draagt `minuteModel: { reason, expect, note }`. In
//    de runs van die code geldt `expect` met de velden uit `minuteModel.expect` erover. Haalt de run
//    dat doel nog niet, dan is de status BEWUST_ROOD en staat de case in het vangnet.
//  - Hulp bij analyseren: OPS_MINUTE_MODEL_VERBOSE=1 toont per afwijkende case de verschillen,
//    OPS_MINUTE_MODEL_DEBUG=1 daarbij de datums van alle taken uit de motor.
//  - Vangnet: de cases die niet gelijk zijn (na de redencodes) staan per run en per batterij in
//    `minute-model-runs.json`. Een afwijking van die lijst is rood. Bijwerken: zie tests/planning/README.md.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const MM_RUN_ENV = process.env.OPS_MINUTE_MODEL_RUN;
const MM_RUN: 0 | 1 | 2 = MM_RUN_ENV === '1' ? 1 : MM_RUN_ENV === '2' ? 2 : 0;
if (MM_RUN_ENV !== undefined && MM_RUN_ENV !== '' && MM_RUN === 0) {
  console.log(`XX OPS_MINUTE_MODEL_RUN="${MM_RUN_ENV}": verwacht 1 of 2`);
  process.exit(1);
}
/** Run 2: dagduur en daglag gaan bij de invoer naar minuten. */
const MM_HOURS = MM_RUN === 2;
const MM_LABEL = MM_RUN === 1 ? 'run 1 (dagenmaat)' : 'run 2 (urenmaat)';
/** Hulpmiddel bij het analyseren: zet per afwijkende case de motordatums in de uitvoer. */
const MM_DEBUG = process.env.OPS_MINUTE_MODEL_DEBUG === '1';
/** De case kan niet naar het minutenmodel (bijv. een duur die geen geheel aantal minuten is). */
class NotConvertible extends Error {}
const MM_DATETIME_RE = /\d{4}-\d\d-\d\dT\d\d:\d\d/;

/** Reden waarom een case al een URENcase is (dan hoort hij niet bij de runs), of null. Dezelfde
 *  indeling als de meting in §10 (branch claude/uren-poc-meting): 422 dagcases en 138 urencases. */
function hourCaseReason(c: Case): string | null {
  // De hele case, zoals de meting; alleen de eigen sleutel `minuteModel` telt niet mee.
  const { minuteModel: _mm, ...rest } = c;
  void _mm;
  const s = JSON.stringify(rest);
  if (s.includes('"workTime"')) return 'workTime';
  if (MM_DATETIME_RE.test(s)) return 'datetime';
  if (s.includes('"lagMinutes"')) return 'lagMinutes';
  if (s.includes('"remainingMinutes"')) return 'remainingMinutes';
  if (s.includes('"levelingDelayMinutes"')) return 'levelingDelayMinutes';
  for (const t of c.tasks ?? []) {
    if (typeof t.dur === 'string' && !/^\d+d$/i.test(t.dur.trim())) return `dur "${t.dur}"`;
  }
  for (const l of c.links ?? []) if (typeof l.lag === 'string') return `lag "${l.lag}"`;
  return null;
}

function intMinutes(v: number, label: string): number {
  if (Math.abs(v - Math.round(v)) > 1e-9) throw new NotConvertible(`${label}: ${v} min is geen geheel aantal minuten`);
  return Math.round(v);
}

/** De laadgrens van het minutenmodel (zie boven): migratie, werkblokken voor elke kalender, en de
 *  projectdatums zoals de motor ze na F2 leest (start D1, statusdatum D5 = D1). */
function minuteModelLoad(): void {
  const { payload } = migrateToMinuteModel(capturePayload(S()));
  const projectClock = new DayClockCache(payload.calendar, payload.calendars).calendarClock(undefined);
  const project = S().project;
  const startDate = dayStartInstant(projectClock, project.startDate) ?? project.startDate;
  const withBlocks = (cal: WorkCalendar): WorkCalendar => calendarForEngine(cal);
  useAppStore.setState((s) => {
    s.tasks = payload.tasks as typeof s.tasks;
    s.baselines = payload.baselines as typeof s.baselines;
    s.calendar = withBlocks(payload.calendar) as typeof s.calendar;
    s.calendars = payload.calendars.map(withBlocks) as typeof s.calendars;
    s.project.startDate = startDate;
  });
}

/** Normalisatie bij invoer ná de laadgrens (F2 doet dat in de store-acties): dezelfde functie over de
 *  payload; een moment blijft een moment, dus alleen nieuwe datums zonder tijd veranderen. */
function minuteModelNormalizeInput(): void {
  const { payload } = migrateToMinuteModel(capturePayload(S()), { timeModel: MINUTE_MODEL_TIME_MODEL });
  useAppStore.setState((s) => {
    s.tasks = payload.tasks as typeof s.tasks;
    s.baselines = payload.baselines as typeof s.baselines;
  });
}

type Shift = 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
type Cal = {
  workDays?: number[]; holidays?: { name: string; startDate: string; endDate: string }[];
  /** Fase 2.8b (§3.2/§8.1): werktijd-banden ⇒ UUR-kalender. Afwezig ⇒ dag-kalender (byte-identiek). */
  workTime?: WorkTimeBands; shift?: Shift;
  /** Fase 3.8 (T2/T13, MSP-pariteit): dag-uitzonderingen die een dag WERKEND maken. ADDITIEF —
   *  afwezig ⇒ byte-identiek gedrag met vóór T13 (geen enkele bestaande case zet dit veld, dus geen
   *  bestaande verwachting kan hierdoor wijzigen). Zelfde vorm als `WorkCalendar.workingExceptions`
   *  (T2's model, `src/types/calendar.ts`) — de harness geeft 'm ongewijzigd door aan
   *  `setCalendar`/`addCalendar`. */
  workingExceptions?: WorkingException[];
  /** Z7-fixronde-2 (MIDDEN): expliciete `hoursPerDay`-override voor een DAG-kalender (bij `workTime`
   *  aanwezig wordt `hoursPerDay` toch AFGELEID uit de banden, zie `CalendarEngine.
   *  computeDerivedHoursPerDay` — deze override is dus alleen zinvol zonder `workTime`). Afwezig ⇒
   *  de default van `S().calendar` (8, byte-identiek voor elke bestaande case — geen enkele zet dit
   *  veld). Nodig om een NIET-GEHELE `hoursPerDay` (bv. 8,4 — vrij invoerbaar via Projectinfo) op een
   *  dag-kalender corpusloos te reproduceren; zonder deze knop is dat via de bestaande `Cal`-vorm niet
   *  te zetten (`workTime` zou de taak juist naar de uur-modus-tak duwen, een ANDER codepad). */
  hoursPerDay?: number;
};
interface CaseResource {
  name: string; type?: ResourceType; maxUnits?: number;
  calendar?: Cal; steps?: { from: string; maxUnits: number }[];
  /** Naam van een eerder gedefinieerde CREW-resource (ploeg-lidmaatschap, puur weergave — §2.1). */
  parent?: string;
}
/** Baseline-mutaties (fase 2.6, variance-cases): toegepast NÁ saveBaseline, vóór de tweede runCPM. */
type VarOp =
  | { setDuration: { task: string; dur: number } }
  | { deleteTask: { task: string } }
  | { addTask: { name: string; dur?: number; start?: string; milestone?: boolean;
      links?: { pred: string; succ: string; type: string; lag?: number }[] } };

// --- Fase 2.7 weergaven (§14.1): headless view-cases ---
// Een FieldRef wordt in cases met NAMEN geschreven (typenaam/veldnaam), de harness vertaalt naar ids.
//   builtin: "name"|"wbsCode"|"duration"|"start"|"finish"|"totalFloat"|"isCritical"|"completion"|"taskType"|"isMilestone"
//   resource: "resource"
//   activity code: { code: <typenaam> }     custom field: { field: <veldnaam> }
type FieldRefSpec =
  | string
  | { code: string }
  | { field: string };
type FilterSpec =
  | { op: 'AND' | 'OR'; children: FilterSpec[] }
  | { field: FieldRefSpec; operator: string; value?: unknown; value2?: unknown };
interface GroupSpec { field: FieldRefSpec; dir?: 'asc' | 'desc'; }
interface ViewCaseSpec {
  filter?: FilterSpec | null;
  group?: GroupSpec[];
  sort?: GroupSpec[];
  collapsedTasks?: string[];             // taaknamen
  collapsedGroups?: (string | number | boolean)[][]; // pad van humane bandwaarden per niveau
  expectRows?: ExpectRow[];
  expectTreeMode?: boolean;
  expectFirstIndex?: Record<string, number>;
  timescaleRoundtrip?: boolean;
}
type ExpectRow =
  | { t: string; dim?: boolean; depth?: number }
  | { g: string; count?: number; collapsed?: boolean; level?: number };

interface Case {
  id: string; title: string;
  calendar?: Cal; anchor?: string;
  /** Benoemde bibliotheek-kalenders (fase 2.8a, §10.1): taken verwijzen ernaar via tasks[].calendar.
   *  Fase 2.8b: optioneel `workTime`/`shift` ⇒ uur-kalender (§8.1). */
  calendars?: { name: string; workDays?: number[]; holidays?: Cal['holidays']; workTime?: WorkTimeBands; shift?: Shift; workingExceptions?: Cal['workingExceptions'] }[];
  resources?: CaseResource[];
  /** Activity-code-types + waarden (fase 2.7 view-cases). */
  codes?: { name: string; values: { code: string; description?: string }[] }[];
  /** Custom-field-definities (fase 2.7 view-cases). */
  customFields?: { name: string; type: CustomFieldType }[];
  /** Headless view-pijplijn-assertie (fase 2.7, §14.1). */
  view?: ViewCaseSpec;
  /** Tabel↔Gantt-pariteitscheck (§14.1): statische bron-assert dat beide consumenten hetzelfde
   *  store-veld `viewRows` lezen en er géén tweede flatten-pad meer bestaat. */
  sourceParity?: boolean;
  /** Statusdatum (P6 data date, fase 2.6) — stuurt de CPM-voortgangstakken. */
  statusDate?: string;
  scheduleOptions?: { progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE' };
  /** Project-scoped reken-opties (fase 2.9, §3.4/§4.6): near-critical-drempel, kritiek-definitie
   *  (totalFloat/longestPath + drempel), TF-berekeningswijze, open-ended-kritiek. Afwezig ⇒ elke
   *  default ⇒ byte-identiek. Gaat via `setProject({schedulingOptions})` naar `runCPM`. */
  schedulingOptions?: SchedulingOptions;
  tasks: {
    /** Fase 2.8b (§8.1): `dur` mag een string zijn — "2d 4u"/"4h"/"90m"/"12u" (hele eenheden, via
     *  `parseDuration`) ⇒ `durationMinutes` op de taak; een getal ⇒ werkdagen (dag-modus, ongewijzigd). */
    name: string; dur?: number | string; start?: string; milestone?: boolean; milestoneKind?: 'START' | 'FINISH';
    mandatory?: boolean; parent?: string; deadline?: string;
    /** T8 (MSP-pariteit, plan §BAAN S): WORKTIME (default, afwezig ⇒ byte-identiek) | ELAPSEDTIME —
     *  de taakduur zelf loopt dan 24/7 in klokTIJD i.p.v. over werkdagen/-uren (zie `duration.ts`'s
     *  `elapsedMinutesOf`/`addElapsedMinutes`/`subtractElapsedMinutes`, hergebruik van het
     *  `resolveElapsedMinutes`-precedent voor relatie-lags). */
    durationType?: 'WORKTIME' | 'ELAPSEDTIME';
    /** Fase 2.9 (§4.1/§4.2): `hard` op de PRIMAIRE constraint ⇒ logica-brekende Mandatory-pin
     *  (alleen zinvol op MSO/MFO). `date` mag een datetime zijn op een uur-taak (§4.1, S13). */
    constraint?: { type: string; date?: string; hard?: boolean };
    /** Fase 2.9 (§4.3): SECUNDAIRE constraint (altijd soft). */
    constraint2?: { type: string; date?: string };
    /** Fase 2.9 (§4.4): hammock/LOE — afgeleide duur (span tussen start- en finish-driver); eigen
     *  duur-invoer genegeerd; nooit kritiek. Afwezig ⇒ gewone taak (byte-identiek). */
    hammock?: boolean;
    /** Fase 2.9 (§4.5): externe (cross-project) dependencies — bevroren datum-grenzen. `lag` ⇒ `lagDays`,
     *  `lagMinutes` ⇒ minuten (uur-modus). `sourceProject`/`sourceTask`/`sourceFile` vullen de `sourceRef`.
     *  Afwezig ⇒ geen (byte-identiek). */
    externalLinks?: {
      direction: 'predecessor' | 'successor'; relType: 'FS' | 'SS' | 'FF' | 'SF';
      lag?: number; lagMinutes?: number; anchorDate: string; sourceMissing?: boolean;
      sourceProject?: string; sourceTask?: string; sourceFile?: string;
    }[];
    priority?: number;
    /** Fase 2.8b (§8.3, durationMinutes-op-dag-kalender-invariant): zet `durationMinutes` RAUW op de
     *  taak, ontkoppeld van `dur` — om te bewijzen dat het veld op een dag-kalender wordt genegeerd
     *  (`scheduleDuration` wint) i.p.v. een fractionele dag in `addWorkDays` te stoppen (Bevinding 2). */
    durationMinutesRaw?: number;
    /** Fase 2.8b (§5.3, uur-voortgang): resterend werk in integer MINUTEN (overstemt completion-afleiding). */
    remainingMinutes?: number;
    /** Naam van een bibliotheek-kalender uit Case.calendars (fase 2.8a). undefined = projectkalender. */
    calendar?: string;
    assign?: { res: string; units: number; curve?: ResourceCurve }[];
    // Voortgang (fase 2.6): completion via de store-actie (dwingt de invarianten af);
    // actualStart/actualFinish via de dedicated acties; rawCompletion zet time.completion
    // RAUW (import-simulatie, geen invarianten) om het solver-vangnet (§4.2 tak 2b) te testen.
    completion?: number; actualStart?: string; actualFinish?: string; rawCompletion?: number;
    /** Z12-herwerk (dossier out-of-sequence-actuals): rauw op `time.resume`/`time.stop` gezet, net
     *  als `remainingMinutes` hierboven (import-simulatie — geen dedicated store-actie voor deze
     *  twee, spiegelt `mppReader.ts`'s rechtstreekse veld-99/100-lezing). `resume` is het signaal
     *  dat `CPMSolver.ts`'s out-of-sequence-tak activeert; `stop` rondt alleen mee, wordt door geen
     *  enkele solverberekening gelezen. */
    resume?: string; stop?: string;
    /** Activity-code-toewijzing: typenaam → code (fase 2.7 view-cases). */
    code?: Record<string, string>;
    /** Custom-field-waarde: veldnaam → waarde (fase 2.7 view-cases). */
    field?: Record<string, string | number | boolean>;
    /** Z0 (etappe "nul afwijkingen"): typecontract-doorgifte, nog ONGEBRUIKT door de solver — zie
     *  `Task.splitGaps`/`TaskSplitGap` (`src/types/task.ts`). Afwezig ⇒ geen splits (byte-identiek). */
    splitGaps?: { afterMinutes: number; gapMinutes: number }[];
    /** Z0: typecontract-doorgifte, nog ONGEBRUIKT door de solver — zie `Task.manuallyScheduled`.
     *  Afwezig ⇒ normale (auto-geplande) taak (byte-identiek). */
    manuallyScheduled?: boolean;
    /** Z6: door `CPMSolver.forwardPass` toegepast (uur-/minuutprecisie, wint van `levelingDelay`
     *  hieronder wanneer aanwezig) — zie `Task.levelingDelayMinutes`. Afwezig ⇒ `levelingDelay`
     *  (werkdagen) blijft de bron (byte-identiek). */
    levelingDelayMinutes?: number;
    /** Z6: door `CPMSolver.forwardPass` toegepast — zie `Task.levelingDelayElapsed`. Afwezig ⇒
     *  WORKTIME (byte-identiek). */
    levelingDelayElapsed?: boolean;
    /** Z13 (etappe "nul afwijkingen"): typecontract-doorgifte naar `Task.timephasedStartAnchor`/
     *  `timephasedFinishFloor` — normaal UITSLUITEND door `mppReader.ts`'s Z8-laag-3 gezet, hier
     *  rechtstreeks instelbaar om `CPMSolver.ts`'s `timephasedAnchorIsDegenerateResnap`/
     *  `timephasedFinishFloorIsDegenerateResnap`-wacht corpusloos te reproduceren (zie die
     *  toelichting in `forwardPass`). Afwezig ⇒ byte-identiek (geen laag-3-signaal). */
    timephasedStartAnchor?: string;
    timephasedFinishFloor?: string;
  }[];
  /** Fase 2.8b (§8.1): `lag` mag een string zijn — "4h"/"90m"/"2d" (via `parseDuration` in de
   *  VOORGANGER-kalender) ⇒ `lagMinutes`; een getal ⇒ `lagDays` (dag-modus, ongewijzigd). `lagMinutes`
   *  mag ook rechtstreeks. */
  links?: { pred: string; succ: string; type: string; lag?: number | string; lagMinutes?: number; lagUnit?: string; lagPercent?: number }[];
  level?: { constrainToFloat?: boolean; resources?: string[] };
  /** Baseline opslaan ná de eerste runCPM (fase 2.6, variance-cases). */
  baseline?: boolean | { name?: string };
  varianceMutations?: VarOp[];
  /** Zuiverheids-guard: draai de leveler-PREVIEW (levelResources) ZONDER applyLeveling en
   *  her-draai daarna CPM. `levelResources` hoort puur te zijn (geen state-mutatie), dus de
   *  assertions moeten identiek zijn aan een kale runCPM. Wederzijds exclusief met `level`. */
  levelPreview?: { constrainToFloat?: boolean; resources?: string[] };
  /** Ops ná de eerste runCPM (deze golf), in volgorde uitgevoerd — voor A5/A6-scenario's die een
   *  mutatie ZONDER F5, een assign-verse-load, een undo of een nivellering testen. De gewone
   *  `expect`-assertions lopen tegen de EINDstaat. */
  afterCPM?: AfterOp[];
  /** Nivelleer-PREVIEW-assertions (deze golf, A1/A3/A4): draait `levelResources` (puur, geen apply)
   *  en checkt de teruggegeven `LevelingResult`. */
  previewExpect?: {
    constrainToFloat?: boolean; resources?: string[];
    projectEndAfter?: string;
    shiftedTasks?: string[];      // namen aanwezig in result.shifts (verzameling)
    unresolvedTasks?: string[];   // namen aanwezig in result.unresolved (verzameling)
    reasons?: Record<string, string>; // taaknaam → verwachte reden
  };
  /** Vrije toelichting in het casusbestand — puur documentatie, de harness doet er niets mee. */
  note?: string;
  expect?: CaseExpect;
  /** Minutenmodel (fase F0 "alleen uren", spec §6.1): deze case komt BEWUST anders uit op de tijdas in
   *  minuten. Alleen gelezen met OPS_MINUTE_MODEL_RUN; een gewone run negeert dit veld. */
  minuteModel?: MinuteModelCase;
}

/** Redencode van een dagcase in het minutenmodel (spec §6.1, §4.5). `expect` geeft alleen de velden die
 *  anders uitkomen; ze gaan over `expect` heen in de runs waarin de code geldt. */
interface MinuteModelCase {
  reason: ReasonCode;
  expect?: CaseExpect;
  /** Waarom deze uitkomst bewust anders is (bron of besluit). */
  note?: string;
}

// ── Verwachtingen ────────────────────────────────────────────────────────────────────────────────
// Dit was tot bevinding K10b `expect: any`, en `any` betekende: geen enkele controle. Een typefout
// in een sleutel (`projectEndd`) liet het bijbehorende assertieblok stil verdwijnen — de casus bleef
// groen zónder ook maar iets te toetsen. Het type hieronder legt de vorm vast; de RUNTIME-controle
// (`validateCaseKeys`, onderaan) maakt van een onbekende sleutel een harde fout, want de casussen
// komen uit JSON en glippen dus langs elke compile-tijd-controle.

/** Per-taak-velden; de sleutels spiegelen `readTask`/`KEYMAP`. */
interface TaskExpect {
  es?: string; ef?: string; ls?: string; lf?: string;
  tf?: number; ff?: number; intf?: number;
  crit?: boolean; nearCrit?: boolean;
  floatPath?: number;
  /** T8 (uurmodus-hammock-scheduleDuration-pin, T10-reviewtoevoeging): `task.time.scheduleDuration`/
   *  `durationMinutes` NA de solve — voor hammocks worden deze door de forward-pass HERSCHREVEN
   *  (afgeleide ES→EF-span, zie CPMSolver.ts), dus alleen dáár zinvol te pinnen. */
  scheduleDuration?: number; durationMinutes?: number;
  /** Z0-fixronde (Opus-review, BEVINDING 1): doorgifte-bewijs voor de vier Z0-typecontractvelden op
   *  `Task` — ze bereiken de taak via de JSON-case-interpreter. Nog GEEN solver-gedrag (alle vier
   *  zijn voorlopig ongebruikt); dit toetst uitsluitend dat `buildAndSolve` de waarde daadwerkelijk
   *  doorgeeft aan `addTask`. `splitGapCount` i.p.v. de rauwe `splitGaps`-array: de generieke
   *  `gv !== wv`-vergelijking in `runCase` (verderop) is referentiegelijkheid en zou een array altijd
   *  ongelijk vinden; de LENGTE is als scalar wél mutatie-bewijsbaar zonder die vergelijking aan te
   *  passen. */
  manuallyScheduled?: boolean;
  splitGapCount?: number;
  levelingDelayMinutes?: number;
  levelingDelayElapsed?: boolean;
}

interface CaseExpect {
  /** true ⇒ verwacht een fout; string ⇒ substring in de foutmelding; false ⇒ verwacht géén fout. */
  error?: boolean | string;
  tasks?: Record<string, TaskExpect>;
  /** Verzamelingen van taaknamen (volgorde-onafhankelijk vergeleken). */
  criticalPathSet?: string[];
  nearCriticalSet?: string[];
  hammockNoFinishDriversSet?: string[];
  violatedConstraintsSet?: string[];
  missedDeadlinesSet?: string[];
  /** Verzamelingen van relatie-triples [voorganger, opvolger, type]. */
  drivingSet?: string[][];
  truncatedLeadSet?: string[][];
  outOfSequenceSet?: string[][];
  /** Float-path-nummer per taaknaam; kritieke ketens als verzameling-van-verzamelingen. */
  floatPaths?: Record<string, number>;
  criticalPaths?: string[][];
  projectEnd?: string;
  projectDuration?: number;
  projectStartDate?: string;
  /** Datums in de ACTIEVE baseline, per taaknaam. */
  baselineTasks?: Record<string, { start?: string; finish?: string; duration?: number }>;
  scheduleStale?: boolean;
  calendarInvariant?: boolean;
  /** resourcenaam → ISO-dag → belasting; resourcenaam → overbelaste dagen (verzameling). */
  load?: Record<string, Record<string, number>>;
  overallocatedDays?: Record<string, string[]>;
  variance?: {
    rows?: Record<string, Record<string, unknown>>;
    projectEndDelta?: number;
  };
}

type AfterOp =
  | { setDuration: { task: string; dur: number } }
  | { assign: { task: string; res: string; units: number; curve?: ResourceCurve } }
  | { runCPM: true }
  | { undo: true }
  | { applyLevel: { constrainToFloat?: boolean; resources?: string[] } }
  /** Z6-testtoevoeging: zet `Task.levelingDelay` (hele WERKdagen) rechtstreeks — dat veld wordt in
   *  de echte app UITSLUITEND door `ResourceLeveler` gezet (`taskSlice.addTask` sluit het bewust
   *  uit, zie de toelichting daar), maar de Z6-cases moeten de hele-dagen-terugval en de
   *  ELAPSEDTIME-invariant-case (§"Invariant-waarschuwing", nul-afwijkingen-plan) corpusloos bouwen
   *  ZONDER de volledige leveler (resources/toewijzingen) op te tuigen. `updateTask` accepteert
   *  elk `Partial<Task>`-veld (geen allowlist zoals `addTask`), dus dit is geen omweg om een
   *  productie-guard te omzeilen — puur een testgemak. Zet GEEN `scheduleStale`/`runCPM` zelf; een
   *  navolgende `{ runCPM: true }` is vereist om het effect te zien. */
  | { setLevelingDelay: { task: string; days: number } }
  /** Undo-orphan-regressie (fase 2.8a QA, fix 1): voeg een nieuwe bibliotheek-kalender toe EN
   *  zet hem meteen als projectdefault (spiegelt CalendarDialog "Als projectdefault") — precies
   *  de twee acties die de bug triggerde (addCalendar pusht een undo-snapshot, setProjectCalendar
   *  bewust niet, §9.3), zodat een navolgende `{ undo: true }` de bibliotheek-entry wegneemt terwijl
   *  `project.calendarId` er nog naar wijst. */
  | { addCalendarAsDefault: { name: string } }
  /** "Project verplaatsen" (pakket D1): verschuif de HELE planning naar een nieuwe startdatum.
   *  `moveProject` draait zelf al `runCPM` + fit, dus een navolgende `{runCPM:true}` is optioneel.
   *  `shiftBaselines` default false — baselines blijven dan bewust staan (§1.6). */
  | { moveProject: { newStart: string; shiftBaselines?: boolean } };

function resolveResourceIds(names: string[] | undefined, resIds: Record<string, string>, ctx: string): string[] | undefined {
  return names
    ? names.map(n => {
        if (!resIds[n]) throw new Error(`${ctx}: onbekende resource "${n}"`);
        return resIds[n];
      })
    : undefined;
}

function buildAndSolve(c: Case): {
  ids: Record<string, string>;
  resIds: Record<string, string>;
  codeTypeIds: Record<string, string>;
  codeValueIds: Record<string, Record<string, string>>;
  fieldDefIds: Record<string, string>;
  previewResult: LevelingResult | null;
} {
  S().newProject();
  // Kalender: schoon tenzij expliciet opgegeven.
  const base = S().calendar;
  S().setCalendar({
    ...base,
    workDays: c.calendar?.workDays ?? CLEAN_WORKDAYS,
    holidays: c.calendar?.holidays ?? [],
    // Fase 2.8b: alleen wanneer expliciet gegeven ⇒ uur-projectkalender. Afwezig ⇒ géén workTime-sleutel
    // (dag-modus, byte-identiek voor de 290).
    ...(c.calendar?.workTime ? { workTime: c.calendar.workTime } : {}),
    ...(c.calendar?.shift ? { shift: c.calendar.shift } : {}),
    // T13 (§T2-afwijking): alleen wanneer expliciet gegeven ⇒ werkende uitzonderingen. Afwezig ⇒ géén
    // workingExceptions-sleutel — byte-identiek voor elke bestaande case (additief, zie Cal se doc).
    ...(c.calendar?.workingExceptions ? { workingExceptions: c.calendar.workingExceptions } : {}),
    // Z7-fixronde-2 (MIDDEN): alleen wanneer expliciet gegeven ⇒ hoursPerDay-override. Afwezig ⇒
    // de default van `base` (8) — byte-identiek voor elke bestaande case (additief, zie Cal se doc).
    ...(c.calendar?.hoursPerDay != null ? { hoursPerDay: c.calendar.hoursPerDay } : {}),
  } as any);
  const anchor = c.anchor ?? '2026-06-01';
  S().setProject({ startDate: anchor });

  // Benoemde bibliotheek-kalenders (fase 2.8a, §10.1) — vóór de taken zodat setTaskCalendar kan verwijzen.
  const calByName: Record<string, string> = {};
  for (const cal of c.calendars ?? []) {
    if (calByName[cal.name]) throw new Error(`dubbele kalendernaam "${cal.name}"`);
    const { id: _cid, ...calBase } = S().calendar;
    void _cid;
    calByName[cal.name] = S().addCalendar({
      ...calBase,
      name: cal.name,
      workDays: cal.workDays ?? CLEAN_WORKDAYS,
      holidays: cal.holidays ?? [],
      ...(cal.workTime ? { workTime: cal.workTime } : {}),
      ...(cal.shift ? { shift: cal.shift } : {}),
      // T13 (§T2-afwijking): zie de gelijknamige toevoeging bij setCalendar hierboven.
      ...(cal.workingExceptions ? { workingExceptions: cal.workingExceptions } : {}),
    });
  }

  // Fase 2.8b (§8.1): effectieve `hoursPerDay` (dag↔minuut-factor) van de kalender waarin een taak
  // rekent — de benoemde `tasks[].calendar` (uit `Case.calendars`) óf de projectkalender. Wordt
  // ALLEEN aangeroepen voor uur-invoer (string-`dur`/string-`lag`), dus de 290 raken hem nooit.
  // De `hoursPerDay` is de AFGELEIDE waarde (modale band-som voor uur-kalenders, §3.2) via een
  // wegwerp-CalendarEngine — exact wat de solver intern gebruikt.
  const effHoursPerDayFor = (calName: string | undefined): number => {
    const wc = calName ? S().calendars.find((x) => x.id === calByName[calName]) : S().calendar;
    return new CalendarEngine((wc ?? S().calendar) as any).hoursPerDay;
  };

  // Resources (fase 2.5) — vóór de taken irrelevant qua volgorde, maar vóór assign[] nodig.
  const resIds: Record<string, string> = {};
  for (const r of c.resources ?? []) {
    if (resIds[r.name]) throw new Error(`dubbele resourcenaam "${r.name}"`);
    if (r.parent && !resIds[r.parent]) {
      throw new Error(`resource "${r.name}": parent "${r.parent}" nog niet gedefinieerd — zet die eerder in de resources-lijst`);
    }
    let calendarId: string | undefined;
    if (r.calendar) {
      const { id: _calBaseId, ...calBase } = S().calendar;
      void _calBaseId;
      calendarId = S().addCalendar({
        ...calBase,
        name: `${r.name} kalender`,
        workDays: r.calendar.workDays ?? CLEAN_WORKDAYS,
        holidays: r.calendar.holidays ?? [],
      });
    }
    const resId = S().addResource({
      name: r.name,
      type: r.type ?? 'LABOR',
      description: '',
      maxUnits: r.maxUnits ?? 1,
      ...(calendarId ? { calendarId } : {}),
      ...(r.steps ? { availabilitySteps: r.steps } : {}),
      ...(r.parent ? { parentId: resIds[r.parent] } : {}),
    });
    resIds[r.name] = resId;
  }

  // Activity-code-types + waarden (fase 2.7 view-cases) — vóór de taken zodat code-toewijzing kan.
  const codeTypeIds: Record<string, string> = {};
  const codeValueIds: Record<string, Record<string, string>> = {};
  for (const ct of c.codes ?? []) {
    if (codeTypeIds[ct.name]) throw new Error(`dubbel codetype "${ct.name}"`);
    const typeId = S().addActivityCodeType(ct.name);
    codeTypeIds[ct.name] = typeId;
    codeValueIds[ct.name] = {};
    for (const v of ct.values) {
      codeValueIds[ct.name][v.code] = S().addActivityCodeValue(typeId, { code: v.code, description: v.description });
    }
  }
  // Custom-field-definities (fase 2.7 view-cases).
  const fieldDefIds: Record<string, string> = {};
  for (const f of c.customFields ?? []) {
    if (fieldDefIds[f.name]) throw new Error(`dubbel custom field "${f.name}"`);
    fieldDefIds[f.name] = S().addCustomField(f.name, f.type);
  }

  const ids: Record<string, string> = {};
  for (const t of c.tasks) {
    // Luide fouten i.p.v. stille maskering: dubbele namen (de naam is de enige sleutel in
    // ids/expect/criticalPathSet), en een ouder die nog niet bestaat (anders wordt het kind
    // stil een root, met een heel andere topologie maar zonder waarschuwing).
    if (ids[t.name]) throw new Error(`dubbele taaknaam "${t.name}"`);
    if (t.parent && !ids[t.parent]) {
      throw new Error(`taak "${t.name}": ouder "${t.parent}" nog niet gedefinieerd — zet de ouder eerder in de tasks-lijst`);
    }
    const start = t.start ?? anchor;
    // Duur-resolutie (fase 2.8b, §8.1): een zuivere `Nd`-string en een getal zijn dagtaken;
    // `h`/`u`/`m`-strings gaan via `parseDuration` naar MINUTEN (urentaak) met het afgeleide
    // `scheduleDuration = minuten/(effHpd×60)`. Zo test de DSL dezelfde expliciete suffixregel als
    // de productinvoer en kan `1d` niet toevallig als `8h` groen worden.
    let durDays: number;
    let durMinutes: number | undefined;
    if (t.milestone && t.dur === undefined) {
      // T15: het gebruikelijke pad — een mijlpaal ZONDER expliciete `dur` blijft byte-identiek 0.
      durDays = 0;
    } else if (typeof t.dur === 'string' && /^\d+d$/i.test(t.dur.trim())) {
      durDays = Number.parseInt(t.dur, 10);
    } else if (typeof t.dur === 'string') {
      const effHpd = effHoursPerDayFor(t.calendar);
      const mins = parseDuration(t.dur, effHpd);
      if (mins == null) throw new Error(`taak "${t.name}": onparseerbare duur "${t.dur}"`);
      durMinutes = mins;
      durDays = mins / (effHpd * 60);
    } else {
      durDays = t.dur ?? 1;
    }
    // Minutenmodel, run 2 (urenmaat): dagduur ⇒ minuten (werktijd per dag van de taakkalender;
    // kalendertijd × 1440). `durationMinutesRaw` test juist een dagtaak met een vreemd minuutveld.
    if (MM_HOURS && durMinutes === undefined) {
      if (t.durationMinutesRaw !== undefined) {
        throw new NotConvertible(`taak "${t.name}": durationMinutesRaw test juist een dagtaak met een vreemd minuutveld`);
      }
      const factor = t.durationType === 'ELAPSEDTIME' ? 1440 : effHoursPerDayFor(t.calendar) * 60;
      durMinutes = intMinutes(durDays * factor, `taak "${t.name}" duur`);
    }
    // De case-DSL vertegenwoordigt de twee native invoervormen expliciet. Dit is ook de
    // deterministische legacy-migratie die de productiecode toepast (minuten aanwezig => uren);
    // de kalender bepaalt deze identiteit nooit. `durationMinutesRaw` blijft juist een expliciete
    // dagtaak met een vreemd oud minuutveld, zodat "expliciete eenheid wint" gericht testbaar blijft.
    const time = createDefaultTaskTime(start, durDays, durMinutes !== undefined ? 'hours' : 'days');
    if (durMinutes !== undefined) time.durationMinutes = durMinutes;
    // Rauwe override (§8.3-invariant): zet `durationMinutes` los van `scheduleDuration`.
    if (t.durationMinutesRaw !== undefined) time.durationMinutes = t.durationMinutesRaw;
    // T8: afwezig => `createDefaultTaskTime`s default 'WORKTIME' blijft staan (byte-identiek).
    if (t.durationType !== undefined) time.durationType = t.durationType;
    const id = S().addTask({
      name: t.name,
      isMilestone: !!t.milestone,
      parentId: t.parent ? ids[t.parent] : null,
      time,
      ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}),
      ...(t.priority !== undefined ? { priority: t.priority } : {}),
      ...(t.mandatory !== undefined ? { mandatory: t.mandatory } : {}),
      ...(t.constraint ? { constraint: t.constraint as any } : {}),
      ...(t.constraint2 ? { constraint2: t.constraint2 as any } : {}),
      ...(t.hammock ? { isHammock: true } : {}),
      ...(t.externalLinks ? {
        externalLinks: t.externalLinks.map((e, i) => ({
          id: `${t.name}-ext-${i}`,
          direction: e.direction,
          relType: e.relType,
          ...(e.lag !== undefined ? { lagDays: e.lag } : {}),
          ...(e.lagMinutes !== undefined ? { lagMinutes: e.lagMinutes } : {}),
          // Minutenmodel, run 2: daglag ⇒ minuten in de taakkalender.
          ...(MM_HOURS && e.lag && e.lagMinutes === undefined
            ? { lagMinutes: intMinutes(e.lag * effHoursPerDayFor(t.calendar) * 60, `externe lag ${t.name}`) } : {}),
          anchorDate: e.anchorDate,
          sourceRef: {
            projectId: e.sourceProject ?? 'ext-project',
            taskId: e.sourceTask ?? 'ext-task',
            ...(e.sourceFile !== undefined ? { filePath: e.sourceFile } : {}),
          },
          sourceMissing: e.sourceMissing ?? false,
        })),
      } : {}),
      ...(t.deadline ? { deadline: t.deadline } : {}),
      // Z0 (etappe "nul afwijkingen"): typecontract-doorgifte — de solver leest deze velden nog
      // NERGENS (Task.splitGaps/manuallyScheduled/levelingDelayMinutes/levelingDelayElapsed bestaan
      // alleen als type). Alle vier zijn per veld mutatie-bewezen doorgegeven aan `addTask`: de case
      // "msp-14-z0-typecontract-passthrough" (cases-msp-pariteit.json) assert elk ervan via
      // expect.tasks (manuallyScheduled/levelingDelayMinutes/levelingDelayElapsed rechtstreeks,
      // splitGaps via de afgeleide `splitGapCount` in readTask — zie TaskExpect hierboven).
      ...(t.splitGaps ? { splitGaps: t.splitGaps } : {}),
      ...(t.manuallyScheduled !== undefined ? { manuallyScheduled: t.manuallyScheduled } : {}),
      ...(t.levelingDelayMinutes !== undefined ? { levelingDelayMinutes: t.levelingDelayMinutes } : {}),
      ...(t.levelingDelayElapsed !== undefined ? { levelingDelayElapsed: t.levelingDelayElapsed } : {}),
    });
    ids[t.name] = id;
    if (t.calendar !== undefined) {
      const calId = calByName[t.calendar];
      if (!calId) throw new Error(`taak "${t.name}": onbekende kalender "${t.calendar}" (niet in Case.calendars)`);
      S().setTaskCalendar(id, calId);
    }
  }
  for (const l of c.links ?? []) {
    if (!ids[l.pred]) throw new Error(`relatie: onbekende voorganger "${l.pred}"`);
    if (!ids[l.succ]) throw new Error(`relatie: onbekende opvolger "${l.succ}"`);
    // Lag-resolutie (fase 2.8b, §8.1): een string-lag ⇒ MINUTEN via `parseDuration` in de
    // VOORGANGER-kalender (`LAG_CALENDAR='predecessor'`), gezet als `lagMinutes`; een getal ⇒ `lagDays`
    // (dag-modus, ongewijzigd). `lagMinutes` mag ook rechtstreeks.
    let lagMinutes = l.lagMinutes;
    const lagDaysVal = typeof l.lag === 'number' ? l.lag : undefined;
    if (typeof l.lag === 'string') {
      const predCalName = c.tasks.find((t) => t.name === l.pred)?.calendar;
      const predHpd = effHoursPerDayFor(predCalName);
      const mins = parseDuration(l.lag, predHpd);
      if (mins == null) throw new Error(`relatie ${l.pred}->${l.succ}: onparseerbare lag "${l.lag}"`);
      lagMinutes = mins;
    }
    // Minutenmodel, run 2: daglag ⇒ minuten, in de VOORGANGER-kalender (LAG_CALENDAR); kalendertijd
    // × 1440. `lagDays` blijft staan (zoals de IFC-lezer beide velden vult); een procentlag blijft.
    if (MM_HOURS && lagMinutes === undefined && lagDaysVal) {
      const predCalName = c.tasks.find((t) => t.name === l.pred)?.calendar;
      const factor = l.lagUnit === 'ELAPSEDTIME' ? 1440 : effHoursPerDayFor(predCalName) * 60;
      lagMinutes = intMinutes(lagDaysVal * factor, `lag ${l.pred}->${l.succ}`);
    }
    const seqInput = {
      predecessorId: ids[l.pred], successorId: ids[l.succ], type: l.type as any,
      lagDays: lagDaysVal ?? 0,
      ...(lagMinutes !== undefined ? { lagMinutes } : {}),
      ...(l.lagUnit !== undefined ? { lagUnit: l.lagUnit as any } : {}),
      ...(l.lagPercent !== undefined ? { lagPercent: l.lagPercent } : {}),
    };
    // Zelf-lus (edge-selfloop-01), voorouder-relaties (wbs-summary-relation-ancestor-guard-01) EN
    // kringen (edge-cycle-*): `addSequence` weigert ze sinds de relatieregels (verwacht gedrag, zie
    // relationRules.ts; de kringtoets sinds de audit taakmutaties, bevinding 2) en
    // zou ze stil buiten de sequences houden — dan test dit harnas de CPM-solver/`expandSummaryRelations`
    // z'n EIGEN guards nooit. Zulke relaties kunnen nog steeds bestaan (bv. een corrupt/legacy IFC of
    // een P6/MSP-export die via `loadState` binnenkomt, ongefilterd door de aanmaak-guard — spec §5:
    // bestaande exemplaren blijven behouden), dus omzeil hier bewust de store-actie en zet ze
    // rechtstreeks — de solver-/expansielaag moet ze zelf afvangen, niet de aanmaak-validatie.
    const lookup = (id: string) => S().tasks.find((t) => t.id === id);
    if (
      seqInput.predecessorId === seqInput.successorId
      || isAncestorRelation(lookup, { predecessorId: seqInput.predecessorId, successorId: seqInput.successorId })
      || relationCycle(S().tasks, S().sequences, seqInput) !== null
    ) {
      useAppStore.setState((s) => {
        s.sequences.push({ ...seqInput, id: generateId('seq') });
      });
    } else if (S().addSequence(seqInput) === null) {
      throw new Error(`relatie ${l.pred}->${l.succ} geweigerd door de relatieregels`);
    }
  }
  // Toewijzingen — ná addTask (assignResource is leaf/mijlpaal-bewust, §2.4) en vóór runCPM
  // (de belasting wordt binnen runCPM herberekend, zie scheduleSlice.runCPM).
  for (const t of c.tasks) {
    for (const a of t.assign ?? []) {
      if (!resIds[a.res]) throw new Error(`taak "${t.name}": onbekende resource "${a.res}"`);
      S().assignResource(ids[t.name], resIds[a.res], a.units, a.curve);
    }
    // Activity-code- + custom-field-toewijzingen (fase 2.7 view-cases).
    for (const [typeName, code] of Object.entries(t.code ?? {})) {
      const typeId = codeTypeIds[typeName];
      if (!typeId) throw new Error(`taak "${t.name}": onbekend codetype "${typeName}"`);
      const valueId = codeValueIds[typeName]?.[code];
      if (!valueId) throw new Error(`taak "${t.name}": onbekende codewaarde "${code}" van "${typeName}"`);
      S().setTaskActivityCode(ids[t.name], typeId, valueId);
    }
    for (const [fieldName, value] of Object.entries(t.field ?? {})) {
      const defId = fieldDefIds[fieldName];
      if (!defId) throw new Error(`taak "${t.name}": onbekend custom field "${fieldName}"`);
      S().setTaskCustomField(ids[t.name], defId, value);
    }
  }

  // Voortgang + statusdatum (fase 2.6) — vóór runCPM zodat de solver-voortgangstakken meelopen.
  if (c.statusDate) S().setStatusDate(c.statusDate);
  if (c.scheduleOptions?.progressMode) S().setProgressMode(c.scheduleOptions.progressMode);
  // Reken-opties (fase 2.9, §3.4) op het project — vóór runCPM zodat de solver ze meeneemt.
  if (c.schedulingOptions) {
    // Rekenprofielen: de case-JSON's zijn oude SchedulingOptions-blobs (bv. cases-progress.json met
    // resumeFromActualElapsed). Ze gaan door EXACT de IFC-migratie, dus het gedrag blijft identiek.
    const migrated = legacyOptionsToProfile(c.schedulingOptions);
    S().setProject({
      schedulingOptions: migrated.options,
      schedulingProfile: isDefaultProfile(migrated.profile) ? undefined : migrated.profile,
    });
  }
  for (const t of c.tasks) {
    const id = ids[t.name];
    if (t.rawCompletion !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, completion: t.rawCompletion } });
    }
    if (t.actualStart !== undefined) S().setActualStart(id, t.actualStart);
    if (t.actualFinish !== undefined) S().setActualFinish(id, t.actualFinish);
    if (t.completion !== undefined) S().setTaskProgress(id, t.completion);
    // remainingMinutes RAUW ná completion (uur-voortgang, §5.3): `setTaskProgress` leidt de restduur
    // van een urentaak af uit de voortgang (`applyRemainingDuration`); deze override komt daarna, via
    // `updateTask` (dat geen invarianten draait), en simuleert zo een geïmporteerde restduur.
    if (t.remainingMinutes !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, remainingMinutes: t.remainingMinutes } });
    }
    // Z12-herwerk — resume/stop, zelfde rauwe-override-vorm als remainingMinutes hierboven.
    if (t.resume !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, resume: t.resume } });
    }
    if (t.stop !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, stop: t.stop } });
    }
    // Z13: `timephasedStartAnchor`/`timephasedFinishFloor` zijn TOP-LEVEL `Task`-velden (geen
    // `time`-subveld) — `updateTask`'s `Object.assign(s.tasks[idx], rest)` (taskSlice.ts) zet ze
    // dus rechtstreeks, ANDERS dan `resume`/`stop` hierboven die via `time` moeten. `addTask` zelf
    // (buiten dit bestand se eigendom) kent deze twee velden niet — vandaar de post-patch hier,
    // net als `levelingDelay` elders in dit bestand (regel ~743) al voor een ander top-level veld
    // doet.
    if (t.timephasedStartAnchor !== undefined) {
      S().updateTask(id, { timephasedStartAnchor: t.timephasedStartAnchor });
    }
    if (t.timephasedFinishFloor !== undefined) {
      S().updateTask(id, { timephasedFinishFloor: t.timephasedFinishFloor });
    }
  }

  // Minutenmodel: run 2 houdt een latere duurwijziging in dagen ook in minuten bij (de taak is een
  // urentaak geworden).
  const mmDurPatch = (taskName: string, dur: number): { durationMinutes?: number } => {
    if (!MM_HOURS) return {};
    const tk = S().tasks.find((x) => x.id === ids[taskName]);
    if (!tk || tk.time.durationUnit !== 'hours') return {};
    const ct = c.tasks.find((x) => x.name === taskName);
    const factor = ct?.durationType === 'ELAPSEDTIME' ? 1440 : effHoursPerDayFor(ct?.calendar) * 60;
    return { durationMinutes: intMinutes(dur * factor, `setDuration ${taskName}`) };
  };

  // Minutenmodel: de laadgrens, vlak voor de eerste berekening (zie minuteModelLoad).
  if (MM_RUN) minuteModelLoad();

  S().runCPM();

  // Baselines & variance (fase 2.6 golf 1): baseline vastleggen, muteren, herberekenen.
  if (c.baseline) {
    S().saveBaseline(typeof c.baseline === 'object' ? (c.baseline.name ?? 'Baseline 1') : 'Baseline 1');
    for (const m of c.varianceMutations ?? []) {
      if ('setDuration' in m) {
        const tid = ids[m.setDuration.task];
        if (!tid) throw new Error(`varianceMutations.setDuration: onbekende taak "${m.setDuration.task}"`);
        const task = S().tasks.find((t) => t.id === tid)!;
        S().updateTask(tid, { time: { ...task.time, scheduleDuration: m.setDuration.dur, ...mmDurPatch(m.setDuration.task, m.setDuration.dur) } });
      } else if ('deleteTask' in m) {
        const tid = ids[m.deleteTask.task];
        if (!tid) throw new Error(`varianceMutations.deleteTask: onbekende taak "${m.deleteTask.task}"`);
        S().deleteTask(tid);
      } else if ('addTask' in m) {
        const a = m.addTask;
        if (ids[a.name]) throw new Error(`varianceMutations.addTask: dubbele taaknaam "${a.name}"`);
        const start = a.start ?? (c.anchor ?? '2026-06-01');
        const dur = a.milestone ? 0 : (a.dur ?? 1);
        // Minutenmodel, run 2: een nieuwe taak is een urentaak (werktijd per dag van het project).
        const addTime = MM_HOURS
          ? { ...createDefaultTaskTime(start, dur, 'hours'), durationMinutes: intMinutes(dur * effHoursPerDayFor(undefined) * 60, `varianceMutations ${a.name}`) }
          : createDefaultTaskTime(start, dur);
        const nid = S().addTask({
          name: a.name, isMilestone: !!a.milestone, parentId: null,
          time: addTime,
        });
        ids[a.name] = nid;
        for (const l of a.links ?? []) {
          if (!ids[l.pred]) throw new Error(`varianceMutations.addTask.links: onbekende voorganger "${l.pred}"`);
          if (!ids[l.succ]) throw new Error(`varianceMutations.addTask.links: onbekende opvolger "${l.succ}"`);
          S().addSequence({
            predecessorId: ids[l.pred], successorId: ids[l.succ], type: l.type as any, lagDays: l.lag ?? 0,
            ...(MM_HOURS && l.lag ? { lagMinutes: intMinutes(l.lag * effHoursPerDayFor(undefined) * 60, 'varianceMutations lag') } : {}),
          });
        }
      }
    }
    // Minutenmodel: een nieuwe taak kwam met datums zonder tijd binnen; de store normaliseert die na F2.
    if (MM_RUN) minuteModelNormalizeInput();
    S().runCPM();
  }

  // Nivellering (fase 2.5): draai de leveler ná runCPM en pas het resultaat toe via
  // applyLeveling (dat één undo-snapshot pusht en zelf runCPM heraanroept, §5.6) — zodat
  // alle expect-checks (es/ef/float/projectEnd/load/overallocatedDays) tegen het
  // GENIVELLEERDE schema lopen.
  if (c.level) {
    const resourceIds = c.level.resources
      ? c.level.resources.map(n => {
          if (!resIds[n]) throw new Error(`level.resources: onbekende resource "${n}"`);
          return resIds[n];
        })
      : undefined;
    const result = S().levelResources({
      constrainToFloat: !!c.level.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
    S().applyLeveling(result);
  }

  // Preview-zuiverheids-guard (fase 2.5, §5.6): `levelResources` moet puur zijn. We draaien de
  // preview (GEEN applyLeveling) en her-draaien CPM; de assertions horen exact gelijk te blijven
  // aan een kale runCPM. Zou de leveler stiekem `levelingDelay` op de echte task-objecten zetten
  // (referentie-delen met de store), dan zou deze her-runCPM de datums opschuiven — precies het
  // scenario dat we willen bewaken.
  if (c.levelPreview) {
    const resourceIds = resolveResourceIds(c.levelPreview.resources, resIds, 'levelPreview.resources');
    S().levelResources({
      constrainToFloat: !!c.levelPreview.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
    S().runCPM();
  }

  // Ops ná de eerste runCPM (A5/A6): mutaties zonder F5, assign-verse-load, undo, nivellering.
  for (const op of c.afterCPM ?? []) {
    if ('setDuration' in op) {
      const tid = ids[op.setDuration.task];
      if (!tid) throw new Error(`afterCPM.setDuration: onbekende taak "${op.setDuration.task}"`);
      const task = S().tasks.find(t => t.id === tid)!;
      S().updateTask(tid, { time: { ...task.time, scheduleDuration: op.setDuration.dur, ...mmDurPatch(op.setDuration.task, op.setDuration.dur) } });
    } else if ('assign' in op) {
      const tid = ids[op.assign.task];
      if (!tid) throw new Error(`afterCPM.assign: onbekende taak "${op.assign.task}"`);
      if (!resIds[op.assign.res]) throw new Error(`afterCPM.assign: onbekende resource "${op.assign.res}"`);
      S().assignResource(tid, resIds[op.assign.res], op.assign.units, op.assign.curve);
    } else if ('runCPM' in op) {
      S().runCPM();
    } else if ('undo' in op) {
      S().undo();
    } else if ('applyLevel' in op) {
      const resourceIds = resolveResourceIds(op.applyLevel.resources, resIds, 'afterCPM.applyLevel.resources');
      const r = S().levelResources({
        constrainToFloat: !!op.applyLevel.constrainToFloat,
        ...(resourceIds ? { resourceIds } : {}),
      });
      S().applyLeveling(r);
    } else if ('moveProject' in op) {
      // Minutenmodel: de nieuwe projectstart zoals de motor hem na F2 leest (D1 op de projectkalender).
      const newStart = MM_RUN
        ? (dayStartInstant(new DayClockCache(S().calendar, S().calendars).calendarClock(undefined), op.moveProject.newStart)
          ?? op.moveProject.newStart)
        : op.moveProject.newStart;
      S().moveProject(newStart, { shiftBaselines: !!op.moveProject.shiftBaselines });
    } else if ('addCalendarAsDefault' in op) {
      const { id: _cid, ...calBase } = S().calendar;
      void _cid;
      const newId = S().addCalendar({ ...calBase, name: op.addCalendarAsDefault.name });
      S().setProjectCalendar(newId);
    } else if ('setLevelingDelay' in op) {
      const tid = ids[op.setLevelingDelay.task];
      if (!tid) throw new Error(`afterCPM.setLevelingDelay: onbekende taak "${op.setLevelingDelay.task}"`);
      // Minutenmodel, run 2: kalendertijdvertraging telt 24 uur per dag, werktijd de taakkalender.
      S().updateTask(tid, MM_HOURS
        ? {
            levelingDelay: op.setLevelingDelay.days,
            levelingDelayMinutes: intMinutes(op.setLevelingDelay.days
              * (c.tasks.find((x) => x.name === op.setLevelingDelay.task)?.durationType === 'ELAPSEDTIME'
                ? 24 : effHoursPerDayFor(c.tasks.find((x) => x.name === op.setLevelingDelay.task)?.calendar)) * 60, 'levelingDelay'),
          }
        : { levelingDelay: op.setLevelingDelay.days });
    }
  }

  // Nivelleer-PREVIEW-assertions (A1/A3/A4): puur, geen apply.
  let previewResult: LevelingResult | null = null;
  if (c.previewExpect) {
    const resourceIds = resolveResourceIds(c.previewExpect.resources, resIds, 'previewExpect.resources');
    previewResult = S().levelResources({
      constrainToFloat: !!c.previewExpect.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
  }

  return { ids, resIds, codeTypeIds, codeValueIds, fieldDefIds, previewResult };
}

// --- Vertaling van naam-gebaseerde view-specs naar echte FieldRef/FilterNode (fase 2.7) ---
const BUILTIN_KEYS = new Set([
  'name', 'wbsCode', 'duration', 'start', 'finish',
  'totalFloat', 'isCritical', 'completion', 'taskType', 'isMilestone',
]);

interface ViewMaps {
  ids: Record<string, string>;
  codeTypeIds: Record<string, string>;
  codeValueIds: Record<string, Record<string, string>>;
  fieldDefIds: Record<string, string>;
}

/** Naam-spec → FieldRef. Onbekende code/veld-namen worden bewust NIET afgekapt (missing-ref-test §8.4):
 *  de rauwe naam gaat als id door en resolveField levert dan `undefined`. */
function toFieldRef(spec: FieldRefSpec, m: ViewMaps): FieldRef {
  if (typeof spec === 'string') {
    if (spec === 'resource') return { src: 'resource' };
    if (BUILTIN_KEYS.has(spec)) return { src: 'builtin', key: spec as any };
    throw new Error(`onbekende builtin-veldsleutel "${spec}"`);
  }
  if ('code' in spec) return { src: 'activityCode', typeId: m.codeTypeIds[spec.code] ?? spec.code };
  return { src: 'customField', defId: m.fieldDefIds[spec.field] ?? spec.field };
}

/** Vertaal een filter-waarde: activity-code-labels → valueId (onbekend blijft rauw). */
function toFilterValue(spec: { field: FieldRefSpec; value?: unknown }, m: ViewMaps): unknown {
  const f = spec.field;
  if (typeof f === 'object' && 'code' in f) {
    const map = m.codeValueIds[f.code] ?? {};
    const tr = (v: unknown) => (typeof v === 'string' ? (map[v] ?? v) : v);
    return Array.isArray(spec.value) ? spec.value.map(tr) : tr(spec.value);
  }
  return spec.value;
}

function toFilterNode(spec: FilterSpec, m: ViewMaps): FilterNode {
  if ('op' in spec) {
    return { kind: 'group', op: spec.op, children: spec.children.map(c => toFilterNode(c, m)) };
  }
  return {
    kind: 'rule',
    field: toFieldRef(spec.field, m),
    operator: spec.operator as any,
    value: toFilterValue(spec, m) as any,
    ...(spec.value2 !== undefined ? { value2: spec.value2 as any } : {}),
  };
}

function toGroupLevels(specs: GroupSpec[] | undefined, m: ViewMaps): GroupLevel[] {
  return (specs ?? []).map(g => ({ field: toFieldRef(g.field, m), dir: g.dir ?? 'asc' }));
}
function toSortLevels(specs: GroupSpec[] | undefined, m: ViewMaps): SortLevel[] {
  return (specs ?? []).map(g => ({ field: toFieldRef(g.field, m), dir: g.dir ?? 'asc' }));
}

const NONE_LABEL = '(geen)';

/** Humane bandwaarde → rauwe bandsleutel voor één groepniveau (spiegelt bucketsForLeaf). */
function bandRawKey(fieldSpec: FieldRefSpec, human: string | number | boolean, m: ViewMaps): string {
  if (human === NONE_LABEL) return NONE_RAWKEY;
  if (typeof fieldSpec === 'object' && 'code' in fieldSpec) {
    return m.codeValueIds[fieldSpec.code]?.[String(human)] ?? String(human);
  }
  return String(human);
}

function readTask(name: string, ids: Record<string, string>) {
  const t = S().tasks.find(x => x.id === ids[name]);
  if (!t) return null;
  return {
    es: t.time.earlyStart, ef: t.time.earlyFinish,
    ls: t.time.lateStart, lf: t.time.lateFinish,
    tf: t.time.totalFloat, ff: t.time.freeFloat, crit: t.time.isCritical,
    // Fase 2.9 golf 2 (§4.6): interfererende speling (altijd), near-critical + float-path (optie-gated).
    intf: t.time.interferingFloat, nearCrit: t.time.isNearCritical, floatPath: t.time.floatPath,
    // T8: rauw uitgelezen, geen KEYMAP-alias nodig (sleutelnaam == veldnaam).
    scheduleDuration: t.time.scheduleDuration, durationMinutes: t.time.durationMinutes,
    // Z0-fixronde: doorgifte-bewijs voor alle vier de nieuwe velden, zie TaskExpect hierboven.
    // `splitGaps` zelf is een array (referentiegelijkheid onbruikbaar in de `!==`-vergelijking
    // hieronder in `runCase`) — vandaar de LENGTE als scalar-observatie.
    manuallyScheduled: t.manuallyScheduled,
    splitGapCount: t.splitGaps?.length ?? 0,
    levelingDelayMinutes: t.levelingDelayMinutes,
    levelingDelayElapsed: t.levelingDelayElapsed,
  };
}

const KEYMAP: Record<string, string> = {
  es: 'es', ef: 'ef', ls: 'ls', lf: 'lf', tf: 'tf', ff: 'ff', crit: 'crit',
  intf: 'intf', nearCrit: 'nearCrit', floatPath: 'floatPath',
};

/** taskId → naam (omgekeerde van de ids-map), voor de preview-assertions. */
function nameOf(tid: string, ids: Record<string, string>): string {
  for (const [n, i] of Object.entries(ids)) if (i === tid) return n;
  return tid;
}

/**
 * Tabel↔Gantt-pariteit (§14.1/§17-risico 1): de structurele garantie tegen divergentie is dat
 * beide consumenten HETZELFDE store-veld `viewRows` lezen en nergens meer zelf flattenen.
 * Statische bron-assert: (a) beide lezen `s.viewRows`, (b) de oude eigen flatten-paden
 * (flattenTasks/flattenGrouped/groupTasksByCode) komen niet meer voor in de consumenten.
 */
function runSourceParity(): string[] {
  const diffs: string[] = [];
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');
  const sources: [string, string][] = [
    ['src/components/task-grid/FullTaskGrid.tsx', read('src/components/task-grid/FullTaskGrid.tsx')],
    ['src/components/canvas/GanttCanvas.tsx', read('src/components/canvas/GanttCanvas.tsx')],
    ['src/engine/renderer/GanttRenderer.ts', read('src/engine/renderer/GanttRenderer.ts')],
  ];
  // (a) beide consumenten lezen dezelfde store-cache.
  for (const name of ['FullTaskGrid.tsx', 'GanttCanvas.tsx']) {
    const [, src] = sources.find(([p]) => p.endsWith(name))!;
    if (!/useAppStore\((?:s|state) => (?:s|state)\.viewRows\)/.test(src)) {
      diffs.push(`${name}: leest niet uit de gedeelde store-cache (useAppStore(... => ...viewRows))`);
    }
  }
  // (b) geen tweede flatten-pad meer.
  for (const [path, src] of sources) {
    for (const banned of ['groupTasksByCode', 'flattenTasks', 'flattenGrouped']) {
      if (src.includes(banned)) diffs.push(`${path}: bevat nog een eigen flatten-pad ("${banned}")`);
    }
  }
  return diffs;
}

type Built = ReturnType<typeof buildAndSolve>;

/** Uitkomst van één case. `status` alleen in een minutenmodel-run. */
interface CaseResult {
  id: string; title: string; pass: boolean; diffs: string[];
  status?: MinuteStatus;
  /** Minutenmodel: de case is rood op de OORSPRONKELIJKE verwachting (zonder redencode) — de telling
   *  die met de meting in §10 te vergelijken is. */
  rawRed?: boolean;
  reason?: ReasonCode;
  notes?: string[];
}

function runCase(c: Case): CaseResult {
  if (MM_RUN) return runMinuteCase(c);
  if (c.sourceParity) {
    const diffs = runSourceParity();
    return { id: c.id, title: c.title, pass: diffs.length === 0, diffs };
  }
  let built: Built;
  try {
    built = buildAndSolve(c);
  } catch (e) {
    return { id: c.id, title: c.title, pass: false, diffs: [`THREW: ${String(e)}`] };
  }
  const diffs = evaluateCase(c, c.expect ?? {}, built, EXACT);
  return { id: c.id, title: c.title, pass: diffs.length === 0, diffs };
}

/** Minutenmodel: dezelfde case op de tijdas in minuten, beoordeeld op dagniveau (zie bovenin). */
function runMinuteCase(c: Case): CaseResult {
  const why = hourCaseReason(c);
  if (why) return { id: c.id, title: c.title, pass: true, diffs: [`urencase (${why})`], status: 'UREN' };
  if (c.sourceParity) {
    const diffs = runSourceParity();
    const pass = diffs.length === 0;
    return { id: c.id, title: c.title, pass, diffs, status: pass ? 'GELIJK' : 'ROOD', rawRed: !pass };
  }
  let built: Built;
  try {
    built = buildAndSolve(c);
  } catch (e) {
    if (e instanceof NotConvertible) {
      return { id: c.id, title: c.title, pass: false, diffs: [`niet omzetbaar: ${e.message}`], status: 'NIET_OMZETBAAR', rawRed: true };
    }
    return { id: c.id, title: c.title, pass: false, diffs: [`THREW: ${String(e)}`], status: 'ROOD', rawRed: true };
  }
  const cmp = minuteComparer(built.ids);
  const rawDiffs = evaluateCase(c, c.expect ?? {}, built, cmp);
  const reason = activeReason(c);
  const diffs = reason ? evaluateCase(c, mergeExpect(c.expect ?? {}, c.minuteModel!.expect ?? {}), built, cmp) : rawDiffs;
  const pass = diffs.length === 0;
  const status: MinuteStatus = reason
    ? (pass ? (rawDiffs.length === 0 ? 'GELIJK' : 'BEWUST') : 'BEWUST_ROOD')
    : (pass ? 'GELIJK' : 'ROOD');
  const notes = [...new Set(cmp.notes)];
  if (reason && rawDiffs.length === 0) {
    notes.push(pass
      ? `redencode ${reason} is in ${MM_LABEL} niet nodig: de oorspronkelijke verwachting klopt`
      : `${MM_LABEL} geeft nog de oorspronkelijke uitkomst; het doel van ${reason} is hier nog niet gehaald`);
  }
  if (MM_DEBUG && (!pass || rawDiffs.length > 0)) {
    for (const t of S().tasks) {
      const tt = t.time;
      notes.push(`debug ${t.name}: unit=${tt.durationUnit} type=${tt.durationType} es=${tt.earlyStart} ef=${tt.earlyFinish} `
        + `ls=${tt.lateStart} lf=${tt.lateFinish} tf=${tt.totalFloat} ff=${tt.freeFloat}`
        + `${tt.actualStart ? ` as=${tt.actualStart}` : ''}${tt.actualFinish ? ` af=${tt.actualFinish}` : ''}`
        + `${t.deadline ? ` dl=${t.deadline}` : ''}${t.constraint ? ` c=${t.constraint.type}@${t.constraint.date}` : ''}`);
    }
    notes.push(`debug project: start=${S().project.startDate} status=${S().project.statusDate ?? '-'} end=${S().cpmResult?.projectEnd}`);
  }
  return {
    id: c.id, title: c.title, pass, diffs, status, rawRed: rawDiffs.length > 0,
    ...(reason ? { reason } : {}), notes,
  };
}

/** Beoordeelt de staat na `buildAndSolve` tegen `exp`. Leest alleen; mag dus twee keer draaien. */
function evaluateCase(c: Case, exp: CaseExpect, built: Built, cmp: Comparer): string[] {
  const { ids, resIds, codeTypeIds, codeValueIds, fieldDefIds, previewResult } = built;
  const diffs: string[] = [];
  const cpm = S().cpmResult;

  // Fout-verwachting
  if (exp.error !== undefined) {
    const gotErr = cpm?.error ?? '';
    if (exp.error === true && !gotErr) diffs.push(`error: verwacht een fout, kreeg geen`);
    if (exp.error === false && gotErr) diffs.push(`error: verwacht geen fout, kreeg "${gotErr}"`);
    if (typeof exp.error === 'string' && !gotErr.includes(exp.error)) diffs.push(`error: verwacht substring "${exp.error}", kreeg "${gotErr}"`);
  }

  // Per-taak velden
  if (exp.tasks) {
    for (const [name, want] of Object.entries<any>(exp.tasks)) {
      const got = readTask(name, ids);
      if (!got) { diffs.push(`taak "${name}" niet gevonden`); continue; }
      for (const [k, wv] of Object.entries<any>(want)) {
        const gk = KEYMAP[k] ?? k;
        const gv = (got as any)[gk];
        if (!cmp.taskField(name, k, gv, wv)) diffs.push(`${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(gv)}`);
      }
    }
  }

  // Relatie-verzamelingen ([voorganger, opvolger, type]-triples): driving en afgekapte leads
  const seqSetCheck = (label: string, wantTriples: string[][] | undefined, gotIds: string[]) => {
    if (!wantTriples) return;
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const seqById = new Map(S().sequences.map(q => [q.id, q]));
    const got = gotIds
      .map((sid: string) => {
        const q = seqById.get(sid);
        return q ? `${idToName[q.predecessorId] ?? q.predecessorId}|${idToName[q.successorId] ?? q.successorId}|${q.type}` : '?';
      })
      .sort();
    const want = [...wantTriples].map((t: string[]) => t.join('|')).sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      diffs.push(`${label}: verwacht {${want.join(', ')}}, kreeg {${got.join(', ')}}`);
  };
  seqSetCheck('drivingSet', exp.drivingSet, (cpm as any)?.drivingSequenceIds ?? []);
  seqSetCheck('truncatedLeadSet', exp.truncatedLeadSet, (cpm as any)?.truncatedLeadSequenceIds ?? []);
  seqSetCheck('outOfSequenceSet', exp.outOfSequenceSet, (cpm as any)?.outOfSequenceSequenceIds ?? []);

  // Taak-naam-verzamelingen: geschonden constraints en gemiste deadlines
  const taskSetCheck = (label: string, wantNames: string[] | undefined, gotIds: string[]) => {
    if (!wantNames) return;
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const got = gotIds.map(tid => idToName[tid] ?? tid).sort();
    const want = [...wantNames].sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      diffs.push(`${label}: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
  };
  taskSetCheck('violatedConstraintsSet', exp.violatedConstraintsSet, (cpm as any)?.violatedConstraintTaskIds ?? []);
  taskSetCheck('missedDeadlinesSet', exp.missedDeadlinesSet, (cpm as any)?.missedDeadlineTaskIds ?? []);
  // Near-critical-verzameling (fase 2.9 golf 2, §4.6): taak-namen met 0 < tf ≤ drempel.
  taskSetCheck('nearCriticalSet', exp.nearCriticalSet, (cpm as any)?.nearCriticalTaskIds ?? []);
  // Hammocks zonder finish-driver (fase 2.9 golf 4, §4.4): nul-lengte-terugval + waarschuwing.
  taskSetCheck('hammockNoFinishDriversSet', exp.hammockNoFinishDriversSet, (cpm as any)?.hammockNoFinishDriverTaskIds ?? []);

  // Kritiek pad als verzameling (namen)
  if (exp.criticalPathSet) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const gotNames = (cpm?.criticalPath ?? []).map(i => idToName[i] ?? i).sort();
    const wantNames = [...exp.criticalPathSet].sort();
    if (JSON.stringify(gotNames) !== JSON.stringify(wantNames))
      diffs.push(`criticalPath: verwacht {${wantNames.join(',')}}, kreeg {${gotNames.join(',')}}`);
  }

  // Float-path-nummers per taak (fase 2.9 golf 3, §4.6): {naam: nr} tegen `floatPathByTask`. Een taak
  // die géén floatPath kreeg (bv. boven maxPaths) ontbreekt in de map ⇒ ontbreekt ook in de verwachting.
  if (exp.floatPaths) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const got: Record<string, number> = {};
    for (const [tid, nr] of Object.entries((cpm as any)?.floatPathByTask ?? {})) got[idToName[tid] ?? tid] = nr as number;
    const norm = (o: Record<string, number>) => JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
    if (norm(got) !== norm(exp.floatPaths))
      diffs.push(`floatPaths: verwacht ${norm(exp.floatPaths)}, kreeg ${norm(got)}`);
  }

  // Kritieke ketens (fase 2.9 golf 3, §4.6): lijst van paden, elk als naam-verzameling — vergeleken als
  // verzameling-van-verzamelingen (volgorde-onafhankelijk in beide dimensies). De strikte invariant
  // `criticalPaths[0] === criticalPath` wordt apart in check-advanced-cpm.ts bewezen.
  if (exp.criticalPaths) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const enc = (paths: string[][], map: boolean) => JSON.stringify(
      paths.map(p => [...p].map(x => (map ? (idToName[x] ?? x) : x)).sort())
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    );
    const got = enc((cpm as any)?.criticalPaths ?? [], true);
    const want = enc(exp.criticalPaths, false);
    if (got !== want) diffs.push(`criticalPaths: verwacht ${want}, kreeg ${got}`);
  }

  // Universele invariant (fase 2.9 golf 2, §8.4-b): interferingFloat == totalFloat − freeFloat over
  // ÁLLE cases, voor elke leaf-taak (die zit gegarandeerd in het solver-resultaat). Loopt automatisch
  // mee op alle bestaande batterijen; mag geen bestaande float breken. Alleen bij een geslaagde solve.
  if (cpm && !cpm.error) {
    for (const t of S().tasks) {
      if (t.childIds.length > 0) continue; // samenvattingstaken: aparte rollup, geen solver-resultaat
      const it = t.time;
      const name = Object.entries(ids).find(([, i]) => i === t.id)?.[0] ?? t.name;
      if (it.interferingFloat === undefined) {
        diffs.push(`intf-invariant: leaf "${name}" mist interferingFloat`);
      } else if (!(Math.abs(it.interferingFloat - (it.totalFloat - it.freeFloat)) <= 1e-9)) {
        diffs.push(`intf-invariant: "${name}" intf=${it.interferingFloat} ≠ tf−ff=${it.totalFloat - it.freeFloat}`);
      }
    }
  }

  // Universele invariant (fase 2.9 golf 8, §3.5/§4.6): `criticalPaths` is NOOIT leeg (lengte ≥ 1) en
  // `criticalPaths[0]` is ALTIJD gelijk aan `criticalPath` — het vorm-contract dat elke consument
  // (renderer, rapporten) mag aannemen, met én zonder de floatPaths-optie. Over álle cases.
  if (cpm && !cpm.error) {
    const cp = cpm.criticalPath ?? [];
    const cps = (cpm as any).criticalPaths ?? [];
    if (cps.length < 1) diffs.push(`critpaths-invariant: criticalPaths leeg (verwacht ≥1)`);
    else if (JSON.stringify(cps[0]) !== JSON.stringify(cp))
      diffs.push(`critpaths-invariant: criticalPaths[0]=${JSON.stringify(cps[0])} ≠ criticalPath=${JSON.stringify(cp)}`);
  }

  // Universele invariant (fase 2.9 golf 8, §4.4): een hammock zit NOOIT in `floatPathByTask`, is nooit
  // near-critical (tf definitorisch 0 ⇒ valt buiten 0<tf≤drempel) en komt in geen enkele kritieke keten
  // voor. No-op op cases zonder hammocks (byte-veilig). Over álle cases.
  if (cpm && !cpm.error) {
    const fpbt = (cpm as any).floatPathByTask ?? {};
    const nearIds = new Set<string>((cpm as any).nearCriticalTaskIds ?? []);
    const cps: string[][] = (cpm as any).criticalPaths ?? [];
    for (const t of S().tasks) {
      if (t.isHammock !== true) continue;
      const name = Object.entries(ids).find(([, i]) => i === t.id)?.[0] ?? t.name;
      if (fpbt[t.id] !== undefined) diffs.push(`hammock-invariant: "${name}" heeft floatPath ${fpbt[t.id]}`);
      if (nearIds.has(t.id)) diffs.push(`hammock-invariant: "${name}" in nearCriticalTaskIds`);
      if (cps.some((p) => p.includes(t.id))) diffs.push(`hammock-invariant: "${name}" in een criticalPaths-keten`);
    }
  }

  // Projectstartdatum (pakket D1): het metadataveld dat `moveProject` exact op de gekozen datum zet
  // — en dat een `undo` weer moet terugdraaien (move-12; bewaakt dat `project` in de undo-snapshot zit).
  if (exp.projectStartDate !== undefined && !cmp.projectDate(S().project.startDate, exp.projectStartDate, 'scheduleStart'))
    diffs.push(`projectStartDate: verwacht ${exp.projectStartDate}, kreeg ${S().project.startDate}`);

  // Baseline-taakdatums (pakket D1, §1.6): bewaakt dat een baseline standaard NIET meeschuift, zodat
  // de verschuiving als afwijking zichtbaar blijft. Keyed op taaknaam.
  if (exp.baselineTasks) {
    const active = S().baselines.find((b) => b.id === S().activeBaselineId);
    if (!active) diffs.push('baselineTasks: geen actieve baseline');
    else {
      for (const [name, want] of Object.entries<any>(exp.baselineTasks)) {
        const bt = active.tasks.find((x) => x.taskId === ids[name]);
        if (!bt) { diffs.push(`baselineTasks: taak "${name}" niet in de baseline`); continue; }
        for (const [k, wv] of Object.entries<any>(want)) {
          const gv = (bt as any)[k];
          const ok = k === 'start' ? cmp.taskDate(name, gv, wv, 'baselineStart')
            : k === 'finish' ? cmp.taskDate(name, gv, wv, cmp.shownFinishField(name))
              : k === 'duration' ? cmp.dayNumber(`baselineTasks.${name}.duration`, gv, wv)
                : gv === wv;
          if (!ok) diffs.push(`baselineTasks.${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(gv)}`);
        }
      }
    }
  }

  if (exp.projectEnd !== undefined && !cmp.projectDate(cpm?.projectEnd, exp.projectEnd, 'earlyFinish'))
    diffs.push(`projectEnd: verwacht ${exp.projectEnd}, kreeg ${cpm?.projectEnd}`);
  if (exp.projectDuration !== undefined && !cmp.dayNumber('projectDuration', cpm?.projectDuration, exp.projectDuration))
    diffs.push(`projectDuration: verwacht ${exp.projectDuration}, kreeg ${cpm?.projectDuration}`);

  // "Verouderd"-vlag (A6): staat de planning-stale-vlag op de verwachte waarde na de afterCPM-ops?
  if (exp.scheduleStale !== undefined && S().scheduleStale !== exp.scheduleStale)
    diffs.push(`scheduleStale: verwacht ${exp.scheduleStale}, kreeg ${S().scheduleStale}`);

  // Kalender-cache-invariant (fase 2.8a, §9.1): `project.calendarId` moet een bestaande
  // bibliotheek-entry raken EN die entry moet gelijk zijn aan de gedenormaliseerde `s.calendar`-
  // cache. Regressie-guard voor de undo-orphan-bug (fix 1, QA fase 2.8a).
  if (exp.calendarInvariant !== undefined) {
    const entry = S().calendars.find((c) => c.id === S().project.calendarId);
    const got = !!entry && S().calendar.id === S().project.calendarId;
    if (got !== exp.calendarInvariant)
      diffs.push(`calendarInvariant: verwacht ${exp.calendarInvariant}, kreeg ${got} (project.calendarId=${S().project.calendarId}, calendars=[${S().calendars.map(c => c.id).join(',')}], calendar.id=${S().calendar.id})`);
  }

  // Nivelleer-PREVIEW-assertions (A1/A3/A4) tegen het teruggegeven LevelingResult.
  if (c.previewExpect) {
    const pr = previewResult;
    if (!pr) {
      diffs.push('previewExpect: geen LevelingResult (levelResources gaf niets terug)');
    } else {
      const pe = c.previewExpect;
      if (pe.projectEndAfter !== undefined && !cmp.projectDate(pr.projectEndAfter, pe.projectEndAfter, 'earlyFinish'))
        diffs.push(`preview.projectEndAfter: verwacht ${pe.projectEndAfter}, kreeg ${pr.projectEndAfter}`);
      if (pe.shiftedTasks) {
        const got = Object.keys(pr.shifts).map(tid => nameOf(tid, ids)).sort();
        const want = [...pe.shiftedTasks].sort();
        if (JSON.stringify(got) !== JSON.stringify(want))
          diffs.push(`preview.shiftedTasks: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
      }
      if (pe.unresolvedTasks) {
        const got = Object.keys(pr.unresolved).map(tid => nameOf(tid, ids)).sort();
        const want = [...pe.unresolvedTasks].sort();
        if (JSON.stringify(got) !== JSON.stringify(want))
          diffs.push(`preview.unresolvedTasks: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
      }
      if (pe.reasons) {
        for (const [name, want] of Object.entries(pe.reasons)) {
          const tid = ids[name];
          const got = tid ? pr.unresolvedReasons[tid] : undefined;
          if (got !== want) diffs.push(`preview.reasons.${name}: verwacht ${want}, kreeg ${got}`);
        }
      }
    }
  }

  // Resource-belasting spot-checks (fase 2.5): S().resourceLoadResult?.load[resId]?.[iso].
  if (exp.load) {
    const rlr = S().resourceLoadResult;
    for (const [resName, days] of Object.entries<Record<string, number>>(exp.load)) {
      const resId = resIds[resName];
      if (!resId) { diffs.push(`load: onbekende resource "${resName}"`); continue; }
      for (const [iso, want] of Object.entries(days)) {
        // Ontbrekende dag => 0 (het engine schrijft nooit een expliciete 0-entry, alleen
        // dagen met daadwerkelijke belasting) — zo kan een case "geen belasting op dag X"
        // testen (bv. CREW-geen-rollup) zonder een aparte "afwezig"-sentinel nodig te hebben.
        const got = rlr?.load[resId]?.[iso] ?? 0;
        if (got !== want) diffs.push(`load.${resName}.${iso}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
      }
    }
  }

  // Overallocatie-dagen per resource, vergeleken als verzameling (volgorde-onafhankelijk).
  if (exp.overallocatedDays) {
    const rlr = S().resourceLoadResult;
    for (const [resName, wantDays] of Object.entries<string[]>(exp.overallocatedDays)) {
      const resId = resIds[resName];
      if (!resId) { diffs.push(`overallocatedDays: onbekende resource "${resName}"`); continue; }
      const got = [...(rlr?.overallocatedDays[resId] ?? [])].sort();
      const want = [...wantDays].sort();
      if (JSON.stringify(got) !== JSON.stringify(want))
        diffs.push(`overallocatedDays.${resName}: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
    }
  }

  // Variance (fase 2.6 golf 1): computeVariance tegen de actieve baseline.
  if (exp.variance) {
    const cal = new CalendarEngine(S().calendar);
    const active = S().baselines.find((b) => b.id === S().activeBaselineId) ?? null;
    const vres = computeVariance(S().tasks, active, cal, S().cpmResult?.projectEnd);
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const rowByName: Record<string, any> = {};
    for (const r of vres.rows) rowByName[idToName[r.taskId] ?? r.taskId] = r;
    if (exp.variance.rows) {
      for (const [name, want] of Object.entries<any>(exp.variance.rows)) {
        const got = rowByName[name];
        if (!got) { diffs.push(`variance-rij "${name}" niet gevonden`); continue; }
        for (const [k, wv] of Object.entries<any>(want)) {
          const ok = k === 'baselineStart' || k === 'currentStart' ? cmp.taskDate(name, got[k], wv, 'actualStart')
            : k === 'baselineFinish' || k === 'currentFinish' ? cmp.taskDate(name, got[k], wv, cmp.shownFinishField(name))
              : k === 'deltaStart' || k === 'deltaFinish' ? cmp.dayNumber(`variance.${name}.${k}`, got[k], wv)
                : got[k] === wv;
          if (!ok) diffs.push(`variance.${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(got[k])}`);
        }
      }
    }
    if (exp.variance.projectEndDelta !== undefined && !cmp.dayNumber('variance.projectEndDelta', vres.projectEndDelta, exp.variance.projectEndDelta))
      diffs.push(`variance.projectEndDelta: verwacht ${exp.variance.projectEndDelta}, kreeg ${vres.projectEndDelta}`);
  }

  // Headless view-pijplijn (fase 2.7, §14.1): filter→groep→sorteer→flatten(collapse).
  if (c.view) {
    const v = c.view;
    const m: ViewMaps = { ids, codeTypeIds, codeValueIds, fieldDefIds };
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;

    // Round-trip-stabiliteit van de timescale-presets (§3.3). Fase 2.8b (§6.2): 'hour' round-trippt
    // alleen met de urenplanning-vlag; de vijf dag-granulaire presets zonder vlag (byte-identiek).
    if (v.timescaleRoundtrip) {
      for (const s of ['year', 'quarter', 'month', 'week', 'day'] as const) {
        const got = scaleFromZoom(TIMESCALE_ZOOM[s]);
        if (got !== s) diffs.push(`timescale: scaleFromZoom(${TIMESCALE_ZOOM[s]})=${got}, verwacht ${s}`);
      }
      const gotHour = scaleFromZoom(TIMESCALE_ZOOM.hour);
      if (gotHour !== 'hour') diffs.push(`timescale: scaleFromZoom(${TIMESCALE_ZOOM.hour}, true)=${gotHour}, verwacht hour`);
    }

    const groupSpecs = v.group ?? [];
    const opts = {
      filter: v.filter ? toFilterNode(v.filter, m) : null,
      group: toGroupLevels(groupSpecs, m),
      sort: toSortLevels(v.sort, m),
      collapsedTaskIds: new Set((v.collapsedTasks ?? []).map(n => ids[n]).filter(Boolean)),
      collapsedGroupKeys: new Set(
        (v.collapsedGroups ?? []).map(path =>
          encodeBandKey(path.map((val, i) => bandRawKey(groupSpecs[i].field, val, m))),
        ),
      ),
    };
    const ctx: ViewContext = {
      activityCodeTypes: S().activityCodeTypes,
      customFieldDefs: S().customFieldDefs,
      resources: S().resources,
      assignments: S().assignments,
      noneLabel: NONE_LABEL,
    };
    let rows: ViewRow[] = [];
    try {
      rows = computeViewRows(S().tasks, opts, ctx);
    } catch (e) {
      diffs.push(`computeViewRows THREW: ${String(e)}`);
    }

    if (v.expectTreeMode !== undefined) {
      const got = isTreeMode({ filter: opts.filter, group: opts.group, sort: opts.sort });
      if (got !== v.expectTreeMode) diffs.push(`treeMode: verwacht ${v.expectTreeMode}, kreeg ${got}`);
    }

    if (v.expectRows) {
      const actual = rows.map(r =>
        r.kind === 'task'
          ? { kind: 'task' as const, name: idToName[r.task.id] ?? r.task.id, dim: r.dimmed, depth: r.depth }
          : { kind: 'group' as const, label: r.label, count: r.count, collapsed: r.collapsed, level: r.levelIndex },
      );
      const fmt = (x: any) => x.kind === 'task' ? `T:${x.name}` : `G:${x.label}`;
      if (actual.length !== v.expectRows.length) {
        diffs.push(`rows: verwacht ${v.expectRows.length} rijen [${v.expectRows.map((e: any) => e.t ? 'T:' + e.t : 'G:' + e.g).join(', ')}], kreeg ${actual.length} [${actual.map(fmt).join(', ')}]`);
      } else {
        v.expectRows.forEach((want: any, i) => {
          const got: any = actual[i];
          if ('t' in want) {
            if (got.kind !== 'task') { diffs.push(`rows[${i}]: verwacht taak "${want.t}", kreeg band "${got.label}"`); return; }
            if (got.name !== want.t) diffs.push(`rows[${i}].t: verwacht ${want.t}, kreeg ${got.name}`);
            if (want.dim !== undefined && got.dim !== want.dim) diffs.push(`rows[${i}](${got.name}).dim: verwacht ${want.dim}, kreeg ${got.dim}`);
            if (want.depth !== undefined && got.depth !== want.depth) diffs.push(`rows[${i}](${got.name}).depth: verwacht ${want.depth}, kreeg ${got.depth}`);
          } else {
            if (got.kind !== 'group') { diffs.push(`rows[${i}]: verwacht band "${want.g}", kreeg taak "${got.name}"`); return; }
            if (got.label !== want.g) diffs.push(`rows[${i}].g: verwacht ${want.g}, kreeg ${got.label}`);
            if (want.count !== undefined && got.count !== want.count) diffs.push(`rows[${i}](${got.label}).count: verwacht ${want.count}, kreeg ${got.count}`);
            if (want.collapsed !== undefined && got.collapsed !== want.collapsed) diffs.push(`rows[${i}](${got.label}).collapsed: verwacht ${want.collapsed}, kreeg ${got.collapsed}`);
            if (want.level !== undefined && got.level !== want.level) diffs.push(`rows[${i}](${got.label}).level: verwacht ${want.level}, kreeg ${got.level}`);
          }
        });
      }
    }

    if (v.expectFirstIndex) {
      const map = firstRowIndexByTask(rows);
      for (const [name, want] of Object.entries(v.expectFirstIndex)) {
        const got = map.get(ids[name]);
        if (got !== want) diffs.push(`firstIndex.${name}: verwacht ${want}, kreeg ${got}`);
      }
    }
  }

  return diffs;
}

// ── Minutenmodel: vergelijker en redencodes ─────────────────────────────────────────────────────

/** Hoe `evaluateCase` waarden vergelijkt: exact (gewone run) of op dagniveau (minutenmodel). */
interface Comparer {
  /** Een veld uit `expect.tasks[naam]`. */
  taskField(name: string, key: string, got: unknown, want: unknown): boolean;
  /** Een datum op projectniveau. Begin: projectkalender. Einde: de betekenis van de taak die het zet. */
  projectDate(got: unknown, want: unknown, field: TaskDateField): boolean;
  /** Een datum van een taak buiten `expect.tasks` (baseline, variance), in de klok van die taak. */
  taskDate(name: string, got: unknown, want: unknown, field: TaskDateField): boolean;
  /** Een getal in werkdagen (duur, projectduur, variance-delta). */
  dayNumber(label: string, got: unknown, want: unknown): boolean;
  /** Het veld dat het GETOONDE einde van een taak draagt (`shownFinish`): voltooid ⇒ het werkelijke
   *  einde (inclusief), anders het vroege einde (exclusief bij kalendertijd). */
  shownFinishField(name: string): TaskDateField;
  readonly notes: string[];
}

const EXACT: Comparer = {
  taskField: (_n, _k, got, want) => got === want,
  projectDate: (got, want) => got === want,
  taskDate: (_n, got, want) => got === want,
  dayNumber: (_l, got, want) => got === want,
  shownFinishField: () => 'baselineFinish',
  notes: [],
};

const TASK_DATE_FIELD: Record<string, TaskDateField> = {
  es: 'earlyStart', ef: 'earlyFinish', ls: 'lateStart', lf: 'lateFinish',
};

/** Vergelijker op dagniveau (§0 "gelijk op dagniveau"): de verwachte datum zonder tijd gaat door de
 *  regel van zijn veld (D1–D7, met D3 voor kalendertijd), daarna vergelijkt de werkdag van een moment
 *  beide kanten in de klok van de taak. Speling met 10⁻⁶.
 *
 *  Twee aanvullingen op §6.1, omdat D3 per veld daar niet volstaat (F0-bevinding, msp-14/-22/-31/-33):
 *  - Het projecteinde is in het dagpad het grootste vroege einde. De datum heeft dus de betekenis van
 *    `earlyFinish` van de taak die het einde zet: exclusief bij een kalendertijd-taak (D3), anders D2
 *    in de kalender van die taak. Die taak is de eerste bladtaak met dat vroege einde in de uitkomst;
 *    zonder zo'n taak (bijv. een nivelleervoorbeeld) geldt D2 in de projectkalender.
 *  - D3 noemt `lateFinish` van een kalendertijd-taak inclusief: het dagpad rekent hem als opvolgerstart
 *    min één kalenderdag. Zonder opvolger, deadline of beperking komt hij uit het projecteinde en heeft
 *    hij diens betekenis (msp-14: lf = ef = projecteinde, exclusief). */
function minuteComparer(ids: Record<string, string>): Comparer {
  const clocks = new DayClockCache(S().calendar, S().calendars);
  const projectCtx: TaskDateContext = { clock: clocks.calendarClock(undefined), milestoneKind: null };
  const taskOf = (name: string) => S().tasks.find((x) => x.id === ids[name]);
  const ctxOf = (name: string): TaskDateContext => {
    const t = taskOf(name);
    return t ? taskDateContext(t, clocks) : projectCtx;
  };
  const endSetterCtx = (got: unknown): TaskDateContext => {
    if (typeof got !== 'string') return projectCtx;
    const t = S().tasks.find((x) => !isSummaryTask(x) && x.time.earlyFinish === got);
    return t ? taskDateContext(t, clocks) : projectCtx;
  };
  /** Kalendertijd-taak waarvan de late finish uit het projecteinde komt (zie hierboven). */
  const lateFinishFromProjectEnd = (name: string): boolean => {
    const t = taskOf(name);
    if (!t || !isElapsedTask(t) || t.deadline || t.constraint || t.constraint2) return false;
    if (t.externalLinks?.some((l) => l.direction === 'successor')) return false;
    return !S().sequences.some((q) => q.predecessorId === t.id);
  };
  const notes: string[] = [];
  const sameDay = (got: unknown, want: unknown, field: TaskDateField, ctx: TaskDateContext): boolean => {
    if (typeof want !== 'string' || typeof got !== 'string' || !isDateOnly(want)) return got === want;
    const side = taskDateFieldSide(field);
    const w = normalizeTaskDate(want, field, ctx) ?? want;
    const g = normalizeTaskDate(got, field, ctx) ?? got;
    return workdayOfInstant(ctx.clock, w, side) === workdayOfInstant(ctx.clock, g, side);
  };
  const near = (got: unknown, want: unknown): boolean =>
    (typeof got === 'number' && typeof want === 'number' ? Math.abs(got - want) <= 1e-6 : got === want);
  const dayNumber = (label: string, got: unknown, want: unknown): boolean => {
    if (typeof got === 'number' && Math.abs(got - Math.round(got)) > 1e-6) notes.push(`~ niet geheel: ${label} = ${got}`);
    return near(got, want);
  };
  return {
    notes,
    taskField(name, key, got, want) {
      const field = TASK_DATE_FIELD[key];
      if (field === 'lateFinish' && lateFinishFromProjectEnd(name))
        return sameDay(got, want, 'earlyFinish', endSetterCtx(S().cpmResult?.projectEnd));
      if (field) return sameDay(got, want, field, ctxOf(name));
      if (key === 'tf' || key === 'ff' || key === 'intf') return near(got, want);
      if (key === 'scheduleDuration') return dayNumber(`${name}.scheduleDuration`, got, want);
      return got === want;
    },
    projectDate: (got, want, field) =>
      sameDay(got, want, field, field === 'earlyFinish' ? endSetterCtx(got) : projectCtx),
    taskDate: (name, got, want, field) => sameDay(got, want, field, ctxOf(name)),
    dayNumber,
    shownFinishField(name) {
      const t = taskOf(name);
      return t && isPinnedComplete(t.time) ? 'baselineFinishCompleted' : 'baselineFinish';
    },
  };
}

/** De redencodes van §6.1 en de runs waarin ze gelden. */
const REASON_RUNS = {
  'CONV-SF': [1, 2],
  'PCT-LAG-EXACT': [1, 2],
  'REST-EXACT': [1, 2],
  'KALENDERTIJD-EINDE': [1, 2],
  'PROFIEL-URENMAAT': [2],
} as const satisfies Record<string, readonly (1 | 2)[]>;
type ReasonCode = keyof typeof REASON_RUNS;

/** Status van een dagcase in een minutenmodel-run. GELIJK = gelijk op dagniveau; ROOD = niet gelijk,
 *  zonder redencode; BEWUST = met redencode gelijk aan `minuteModel.expect`; BEWUST_ROOD = de redencode
 *  geldt, maar de uitkomst is ook niet `minuteModel.expect` (het doel is nog niet gehaald);
 *  NIET_OMZETBAAR = de case past niet in het minutenmodel; UREN = urencase, telt niet mee. */
type MinuteStatus = 'GELIJK' | 'ROOD' | 'BEWUST' | 'BEWUST_ROOD' | 'NIET_OMZETBAAR' | 'UREN';

function activeReason(c: Case): ReasonCode | null {
  const mm = c.minuteModel;
  if (!mm || !MM_RUN) return null;
  return (REASON_RUNS[mm.reason] as readonly number[]).includes(MM_RUN) ? mm.reason : null;
}

/** `expect` met de velden uit `minuteModel.expect` erover: per taak per veld, per baseline-taak per
 *  veld; elke andere sleutel vervangt de oude. */
function mergeExpect(base: CaseExpect, over: CaseExpect): CaseExpect {
  const out: CaseExpect = { ...base, ...over };
  if (base.tasks || over.tasks) {
    const tasks: Record<string, TaskExpect> = { ...(base.tasks ?? {}) };
    for (const [name, t] of Object.entries(over.tasks ?? {})) tasks[name] = { ...(tasks[name] ?? {}), ...t };
    out.tasks = tasks;
  }
  if (base.baselineTasks || over.baselineTasks) {
    const bt: NonNullable<CaseExpect['baselineTasks']> = { ...(base.baselineTasks ?? {}) };
    for (const [name, t] of Object.entries(over.baselineTasks ?? {})) bt[name] = { ...(bt[name] ?? {}), ...t };
    out.baselineTasks = bt;
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  SCHEMACONTROLE OP DE CASUS-JSON (bevinding K10b)
//
//  De casussen komen uit JSON en gaan dus als `any` het typesysteem binnen: geen enkele sleutel
//  wordt bij het lezen gecontroleerd. Elke OPTIONELE sleutel gedroeg zich daardoor hetzelfde bij een
//  typefout — stil weg. `previewExpectt` liet het complete preview-assertieblok verdwijnen (casus
//  blijft groen, toetst niets meer); `linkss` gooide de relaties weg, waarna de casus een ánder
//  scenario doorrekende dan bedoeld en de verwachtingen daar toevallig bij konden passen.
//
//  Daarom: een onbekende sleutel — op casus-niveau, in `expect` of in `expect.tasks[naam]` — is een
//  HARDE fout, met bestand, casusnaam en de onbekende sleutel erbij.
//
//  De sleutel-tabellen zijn `satisfies Record<keyof X, true>`: een nieuw veld op `Case`/`CaseExpect`
//  moet hier óók worden opgevoerd (anders compile-fout in tsconfig.tests.json), en een sleutel die
//  op het type niet bestaat wordt door de excess-property-controle geweigerd. Zo kunnen de tabel en
//  het type niet uit elkaar lopen.
// ════════════════════════════════════════════════════════════════════════════════════════════════

const CASE_KEYS = {
  id: true, title: true, note: true,
  calendar: true, anchor: true, calendars: true,
  resources: true, codes: true, customFields: true,
  view: true, sourceParity: true,
  statusDate: true, scheduleOptions: true, schedulingOptions: true,
  tasks: true, links: true,
  level: true, levelPreview: true,
  baseline: true, varianceMutations: true,
  afterCPM: true, previewExpect: true,
  expect: true, minuteModel: true,
} satisfies Record<keyof Case, true>;

const MINUTE_MODEL_KEYS = { reason: true, expect: true, note: true } satisfies Record<keyof MinuteModelCase, true>;

const EXPECT_KEYS = {
  error: true, tasks: true,
  criticalPathSet: true, nearCriticalSet: true, hammockNoFinishDriversSet: true,
  violatedConstraintsSet: true, missedDeadlinesSet: true,
  drivingSet: true, truncatedLeadSet: true, outOfSequenceSet: true,
  floatPaths: true, criticalPaths: true,
  projectEnd: true, projectDuration: true, projectStartDate: true,
  baselineTasks: true, scheduleStale: true, calendarInvariant: true,
  load: true, overallocatedDays: true, variance: true,
} satisfies Record<keyof CaseExpect, true>;

const TASK_EXPECT_KEYS = {
  es: true, ef: true, ls: true, lf: true,
  tf: true, ff: true, intf: true,
  crit: true, nearCrit: true, floatPath: true,
  scheduleDuration: true, durationMinutes: true,
  manuallyScheduled: true, splitGapCount: true,
  levelingDelayMinutes: true, levelingDelayElapsed: true,
} satisfies Record<keyof TaskExpect, true>;

// Z0 (etappe "nul afwijkingen"): vóór deze taak had `Case['tasks'][number]` GEEN allowlist — een
// typefout in een taaksleutel (bv. "manualyScheduled") viel stil weg via de `...(t.x ? {...} : {})`
// -spreads in `buildAndSolve` en de casus draaide gewoon door tegen het defaultgedrag, zonder ooit
// het bedoelde veld te zetten. Zelfde bugklasse als K10b (`CASE_KEYS`/`EXPECT_KEYS`/
// `TASK_EXPECT_KEYS` hierboven), nu voor de taak-INVOER i.p.v. de taak-VERWACHTING.
const TASK_KEYS = {
  name: true, dur: true, start: true, milestone: true, milestoneKind: true,
  mandatory: true, parent: true, deadline: true, durationType: true,
  constraint: true, constraint2: true, hammock: true, externalLinks: true,
  priority: true, durationMinutesRaw: true, remainingMinutes: true, calendar: true,
  assign: true, completion: true, actualStart: true, actualFinish: true, rawCompletion: true,
  code: true, field: true,
  splitGaps: true, manuallyScheduled: true, levelingDelayMinutes: true, levelingDelayElapsed: true,
  resume: true, stop: true,
  timephasedStartAnchor: true, timephasedFinishFloor: true,
} satisfies Record<keyof Case['tasks'][number], true>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
/** Eigen sleutel? (`in` zou ook `toString` & co. accepteren.) */
const known = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);

/** Schemafouten van één casus; lege lijst = schoon. */
function validateCaseKeys(file: string, raw: unknown, index: number): string[] {
  const errs: string[] = [];
  if (!isPlainObject(raw)) return [`${file}: casus #${index} is geen object`];
  const id = typeof raw.id === 'string' ? raw.id : `#${index}`;
  const title = typeof raw.title === 'string' ? ` — ${raw.title}` : '';
  const where = `${file}: casus [${id}]${title}`;

  for (const k of Object.keys(raw)) {
    if (!known(CASE_KEYS, k)) errs.push(`${where}: onbekende sleutel "${k}" op casus-niveau`);
  }

  // Z0: taak-INVOER-sleutels tegen TASK_KEYS — zie de toelichting bij TASK_KEYS hierboven.
  const rawTasks = raw.tasks;
  if (rawTasks !== undefined) {
    if (!Array.isArray(rawTasks)) {
      errs.push(`${where}: "tasks" is geen array`);
    } else {
      rawTasks.forEach((t: unknown, ti: number) => {
        if (!isPlainObject(t)) { errs.push(`${where}: tasks[${ti}] is geen object`); return; }
        for (const k of Object.keys(t)) {
          if (!known(TASK_KEYS, k)) errs.push(`${where}: onbekende sleutel "${k}" in tasks[${ti}]`);
        }
      });
    }
  }

  validateExpectKeys(where, 'expect', raw.expect, errs);

  // Minutenmodel: dezelfde controle voor de redencode en haar verwachting.
  const mm = raw.minuteModel;
  if (mm !== undefined) {
    if (!isPlainObject(mm)) {
      errs.push(`${where}: "minuteModel" is geen object`);
    } else {
      for (const k of Object.keys(mm)) {
        if (!known(MINUTE_MODEL_KEYS, k)) errs.push(`${where}: onbekende sleutel "${k}" in minuteModel`);
      }
      if (typeof mm.reason !== 'string' || !known(REASON_RUNS, mm.reason)) {
        errs.push(`${where}: minuteModel.reason ${JSON.stringify(mm.reason)} is geen redencode (${Object.keys(REASON_RUNS).join(', ')})`);
      }
      validateExpectKeys(where, 'minuteModel.expect', mm.expect, errs);
    }
  }
  return errs;
}

/** Sleutels van een verwachting (`expect` of `minuteModel.expect`) en van haar taken. */
function validateExpectKeys(where: string, label: string, exp: unknown, errs: string[]): void {
  if (exp === undefined) return;
  if (!isPlainObject(exp)) {
    errs.push(`${where}: "${label}" is geen object`);
    return;
  }
  for (const k of Object.keys(exp)) {
    if (!known(EXPECT_KEYS, k)) errs.push(`${where}: onbekende sleutel "${k}" in ${label}`);
  }
  const tasks = exp.tasks;
  if (tasks === undefined) return;
  if (!isPlainObject(tasks)) {
    errs.push(`${where}: "${label}.tasks" is geen object`);
    return;
  }
  for (const [taskName, want] of Object.entries(tasks)) {
    if (!isPlainObject(want)) {
      errs.push(`${where}: "${label}.tasks.${taskName}" is geen object`);
      continue;
    }
    for (const k of Object.keys(want)) {
      if (!known(TASK_EXPECT_KEYS, k))
        errs.push(`${where}: onbekende sleutel "${k}" in ${label}.tasks."${taskName}"`);
    }
  }
}

// ── Minutenmodel: uitvoer per batterij en het vangnet ──────────────────────────────────────────
const MM_RUNS_FILE = join(dirname(fileURLToPath(import.meta.url)), 'minute-model-runs.json');
const MM_VERBOSE = process.env.OPS_MINUTE_MODEL_VERBOSE === '1';
/** Batterij → de dagcases die na de redencodes niet gelijk zijn (ROOD, BEWUST_ROOD, NIET_OMZETBAAR). */
const mmNotEqual: Record<string, string[]> = {};
const mmTotals = { day: 0, rawRed: 0, GELIJK: 0, ROOD: 0, BEWUST: 0, BEWUST_ROOD: 0, NIET_OMZETBAAR: 0, UREN: 0 };

function reportMinuteBattery(name: string, results: CaseResult[]): void {
  const n = (st: MinuteStatus) => results.filter((r) => r.status === st).length;
  const dayResults = results.filter((r) => r.status !== 'UREN');
  const rawRed = dayResults.filter((r) => r.rawRed).length;
  mmTotals.day += dayResults.length;
  mmTotals.rawRed += rawRed;
  for (const st of ['GELIJK', 'ROOD', 'BEWUST', 'BEWUST_ROOD', 'NIET_OMZETBAAR', 'UREN'] as const) mmTotals[st] += n(st);
  console.log(`MM ${MM_LABEL} ${name}: dagcases ${dayResults.length}, rood zonder redencodes ${rawRed}; `
    + `na redencodes gelijk ${n('GELIJK')}, rood ${n('ROOD')}, bewust ${n('BEWUST')}, bewust maar rood ${n('BEWUST_ROOD')}, `
    + `niet omzetbaar ${n('NIET_OMZETBAAR')}; urencases overgeslagen ${n('UREN')}`);
  for (const r of dayResults) {
    // Machineleesbaar: run, batterij, case, status, rood zonder redencodes, redencode.
    if (r.status !== 'GELIJK' || r.rawRed) {
      console.log(`MMCASE\t${MM_RUN}\t${name}\t${r.id}\t${r.status}\t${r.rawRed ? 'rauw-rood' : 'rauw-gelijk'}\t${r.reason ?? '-'}`);
    }
    if (r.status !== 'GELIJK' && r.status !== 'BEWUST' && MM_VERBOSE) {
      for (const d of r.diffs) console.log(`       - ${d}`);
    }
    for (const note of r.notes ?? []) console.log(`   ~ [${r.id}] ${note}`);
  }
  mmNotEqual[name] = dayResults
    .filter((r) => r.status === 'ROOD' || r.status === 'BEWUST_ROOD' || r.status === 'NIET_OMZETBAAR')
    .map((r) => r.id)
    .sort();
}

/** Totaal en het vangnet: de niet-gelijke cases per batterij tegen `minute-model-runs.json`. Met
 *  OPS_MINUTE_MODEL_UPDATE=1 schrijft hij de lijst van deze run voor de gedraaide batterijen. */
function finishMinuteRun(): boolean {
  const t = mmTotals;
  console.log(`MM ${MM_LABEL} TOTAAL: dagcases ${t.day}, rood zonder redencodes ${t.rawRed}; na redencodes gelijk ${t.GELIJK}, `
    + `rood ${t.ROOD}, bewust ${t.BEWUST}, bewust maar rood ${t.BEWUST_ROOD}, niet omzetbaar ${t.NIET_OMZETBAAR}; `
    + `urencases overgeslagen ${t.UREN}`);
  const key = `run${MM_RUN}`;
  let file: Record<string, unknown> = {};
  try {
    file = JSON.parse(readFileSync(MM_RUNS_FILE, 'utf8'));
  } catch {
    file = {};
  }
  const pinned = (file[key] ?? {}) as Record<string, string[]>;
  if (process.env.OPS_MINUTE_MODEL_UPDATE === '1') {
    const next: Record<string, string[]> = { ...pinned, ...mmNotEqual };
    file[key] = Object.fromEntries(Object.keys(next).sort().map((b) => [b, next[b]]));
    writeFileSync(MM_RUNS_FILE, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`OK  minutenmodel ${MM_LABEL}: minute-model-runs.json bijgewerkt (${Object.keys(mmNotEqual).length} batterij(en))`);
    return true;
  }
  let ok = true;
  for (const [battery, list] of Object.entries(mmNotEqual)) {
    const want = pinned[battery];
    if (!Array.isArray(want)) {
      console.log(`XX  minutenmodel ${MM_LABEL}: batterij ${battery} ontbreekt in minute-model-runs.json (zie tests/planning/README.md)`);
      ok = false;
      continue;
    }
    const added = list.filter((id) => !want.includes(id));
    const gone = want.filter((id) => !list.includes(id));
    if (added.length > 0) {
      console.log(`XX  minutenmodel ${MM_LABEL} ${battery}: nieuw niet gelijk op dagniveau: ${added.join(', ')}`);
      ok = false;
    }
    if (gone.length > 0) {
      console.log(`XX  minutenmodel ${MM_LABEL} ${battery}: nu wel gelijk, haal uit minute-model-runs.json: ${gone.join(', ')}`);
      ok = false;
    }
  }
  if (ok) console.log(`OK  minutenmodel ${MM_LABEL}: de niet-gelijke cases kloppen met minute-model-runs.json`);
  return ok;
}

const files = process.argv.slice(2);
let grandPass = 0;
let grandTotal = 0;
let anyFail = false;
for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const name = file.replace(/^.*\/cases-/, '').replace(/\.json$/, '');
  if (data?.cases !== undefined && !Array.isArray(data.cases)) {
    console.log(`XX ${name}: "cases" is geen array`);
    anyFail = true;
    continue;
  }
  const cases: Case[] = data.cases ?? [];
  // Een leeg/sleutelloos casusbestand mag niet stil als "0/0 groen" passeren.
  if (cases.length === 0) {
    console.log(`XX ${name}: GEEN cases (leeg of ontbrekende "cases"-sleutel)`);
    anyFail = true;
    continue;
  }
  // Schemacontrole vóór het rekenen: een typefout in een sleutel mag nooit stil een assertieblok
  // laten verdwijnen. Bij fouten draaien we de batterij bewust NIET — het resultaat zou toch niet
  // betekenen wat het lijkt te betekenen.
  const schemaErrs = cases.flatMap((c, i) => validateCaseKeys(name, c, i));
  if (schemaErrs.length > 0) {
    console.log(`XX ${name}: ${schemaErrs.length} schemafout(en) — batterij niet gedraaid`);
    for (const e of schemaErrs) console.log(`   - ${e}`);
    anyFail = true;
    continue;
  }
  const results = cases.map(runCase);
  if (MM_RUN) {
    reportMinuteBattery(name, results);
    continue;
  }
  const passed = results.filter((r) => r.pass).length;
  grandPass += passed;
  grandTotal += results.length;
  const ok = passed === results.length;
  if (!ok) anyFail = true;
  console.log(`${ok ? 'OK ' : 'XX '} ${name}: ${passed}/${results.length}`);
  for (const r of results) {
    if (r.pass) continue;
    console.log(`   x [${r.id}] ${r.title}`);
    for (const d of r.diffs) console.log(`       - ${d}`);
  }
}
if (MM_RUN) {
  if (!finishMinuteRun()) anyFail = true;
  process.exit(anyFail ? 1 : 0);
}
console.log(`\nTOTAAL: ${grandPass}/${grandTotal}${anyFail ? '  (FALEN)' : '  (alles groen)'}`);
process.exit(anyFail ? 1 : 0);
