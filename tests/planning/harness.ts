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
//   tasks: [{ name, dur?, start?, milestone?, constraint?, deadline? }]
//     dur in werkdagen (default 1); milestone => duur 0
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
//     drivingSet?: [[pred,succ,type]],  // welke relaties driving zijn (verzameling van triples)
//     violatedConstraintsSet?: [names], missedDeadlinesSet?: [names],  // taak-namen (verzameling)
//     projectEnd?, projectDuration?,
//     load?: { [resName]: { [isoDate]: number } },              // spot-checks op resourceLoadResult.load
//     overallocatedDays?: { [resName]: string[] },              // vergeleken als verzameling
//     error?: boolean | string     // true => verwacht een fout; string => substring in de foutmelding
//   }
// }
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/types/task';
import type { SchedulingOptions } from '@/types/project';
import type { ResourceType, ResourceCurve } from '@/types/resource';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDuration } from '@/utils/durationFormat';
import type { WorkTimeBands } from '@/types/calendar';
import { computeVariance } from '@/engine/variance';
import {
  computeViewRows, isTreeMode, encodeBandKey, firstRowIndexByTask, NONE_RAWKEY,
  type ViewRow, type ViewContext,
} from '@/engine/view/visibleRows';
import type { FieldRef, FilterNode, GroupLevel, SortLevel } from '@/state/slices/types';
import { scaleFromZoom, TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
import type { CustomFieldType } from '@/types/structure';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

type Shift = 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
type Cal = {
  workDays?: number[]; holidays?: { name: string; startDate: string; endDate: string }[];
  /** Fase 2.8b (§3.2/§8.1): werktijd-banden ⇒ UUR-kalender. Afwezig ⇒ dag-kalender (byte-identiek). */
  workTime?: WorkTimeBands; shift?: Shift;
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
  calendars?: { name: string; workDays?: number[]; holidays?: Cal['holidays']; workTime?: WorkTimeBands; shift?: Shift }[];
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
    /** Fase 2.9 (§4.1/§4.2): `hard` op de PRIMAIRE constraint ⇒ logica-brekende Mandatory-pin
     *  (alleen zinvol op MSO/MFO). `date` mag een datetime zijn op een uur-taak (§4.1, S13). */
    constraint?: { type: string; date?: string; hard?: boolean };
    /** Fase 2.9 (§4.3): SECUNDAIRE constraint (altijd soft). */
    constraint2?: { type: string; date?: string };
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
    /** Activity-code-toewijzing: typenaam → code (fase 2.7 view-cases). */
    code?: Record<string, string>;
    /** Custom-field-waarde: veldnaam → waarde (fase 2.7 view-cases). */
    field?: Record<string, string | number | boolean>;
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
  expect: any;
}

type AfterOp =
  | { setDuration: { task: string; dur: number } }
  | { assign: { task: string; res: string; units: number; curve?: ResourceCurve } }
  | { runCPM: true }
  | { undo: true }
  | { applyLevel: { constrainToFloat?: boolean; resources?: string[] } }
  /** Undo-orphan-regressie (fase 2.8a QA, fix 1): voeg een nieuwe bibliotheek-kalender toe EN
   *  zet hem meteen als projectdefault (spiegelt CalendarDialog "Als projectdefault") — precies
   *  de twee acties die de bug triggerde (addCalendar pusht een undo-snapshot, setProjectCalendar
   *  bewust niet, §9.3), zodat een navolgende `{ undo: true }` de bibliotheek-entry wegneemt terwijl
   *  `project.calendarId` er nog naar wijst. */
  | { addCalendarAsDefault: { name: string } };

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
    // Duur-resolutie (fase 2.8b, §8.1): een string ⇒ `parseDuration` naar MINUTEN (uur-modus) met het
    // afgeleide `scheduleDuration = minuten/(effHpd×60)`; een getal ⇒ werkdagen (dag-modus, ongewijzigd).
    let durDays: number;
    let durMinutes: number | undefined;
    if (t.milestone) {
      durDays = 0;
    } else if (typeof t.dur === 'string') {
      const effHpd = effHoursPerDayFor(t.calendar);
      const mins = parseDuration(t.dur, effHpd);
      if (mins == null) throw new Error(`taak "${t.name}": onparseerbare duur "${t.dur}"`);
      durMinutes = mins;
      durDays = mins / (effHpd * 60);
    } else {
      durDays = t.dur ?? 1;
    }
    const time = createDefaultTaskTime(start, durDays);
    if (durMinutes !== undefined) time.durationMinutes = durMinutes;
    // Rauwe override (§8.3-invariant): zet `durationMinutes` los van `scheduleDuration`.
    if (t.durationMinutesRaw !== undefined) time.durationMinutes = t.durationMinutesRaw;
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
      ...(t.deadline ? { deadline: t.deadline } : {}),
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
    S().addSequence({
      predecessorId: ids[l.pred], successorId: ids[l.succ], type: l.type as any,
      lagDays: lagDaysVal ?? 0,
      ...(lagMinutes !== undefined ? { lagMinutes } : {}),
      ...(l.lagUnit !== undefined ? { lagUnit: l.lagUnit as any } : {}),
      ...(l.lagPercent !== undefined ? { lagPercent: l.lagPercent } : {}),
    });
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
  if (c.schedulingOptions) S().setProject({ schedulingOptions: c.schedulingOptions });
  for (const t of c.tasks) {
    const id = ids[t.name];
    if (t.rawCompletion !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, completion: t.rawCompletion } });
    }
    if (t.actualStart !== undefined) S().setActualStart(id, t.actualStart);
    if (t.actualFinish !== undefined) S().setActualFinish(id, t.actualFinish);
    if (t.completion !== undefined) S().setTaskProgress(id, t.completion);
    // remainingMinutes RAUW ná completion (uur-voortgang, §5.3): `applyProgressInvariants` raakt alleen
    // `remainingTime` (dagen), niet `remainingMinutes`, dus deze override overleeft `setTaskProgress`.
    if (t.remainingMinutes !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, remainingMinutes: t.remainingMinutes } });
    }
  }

  S().runCPM();

  // Baselines & variance (fase 2.6 golf 1): baseline vastleggen, muteren, herberekenen.
  if (c.baseline) {
    S().saveBaseline(typeof c.baseline === 'object' ? (c.baseline.name ?? 'Baseline 1') : 'Baseline 1');
    for (const m of c.varianceMutations ?? []) {
      if ('setDuration' in m) {
        const tid = ids[m.setDuration.task];
        if (!tid) throw new Error(`varianceMutations.setDuration: onbekende taak "${m.setDuration.task}"`);
        const task = S().tasks.find((t) => t.id === tid)!;
        S().updateTask(tid, { time: { ...task.time, scheduleDuration: m.setDuration.dur } });
      } else if ('deleteTask' in m) {
        const tid = ids[m.deleteTask.task];
        if (!tid) throw new Error(`varianceMutations.deleteTask: onbekende taak "${m.deleteTask.task}"`);
        S().deleteTask(tid);
      } else if ('addTask' in m) {
        const a = m.addTask;
        if (ids[a.name]) throw new Error(`varianceMutations.addTask: dubbele taaknaam "${a.name}"`);
        const start = a.start ?? (c.anchor ?? '2026-06-01');
        const dur = a.milestone ? 0 : (a.dur ?? 1);
        const nid = S().addTask({
          name: a.name, isMilestone: !!a.milestone, parentId: null,
          time: createDefaultTaskTime(start, dur),
        });
        ids[a.name] = nid;
        for (const l of a.links ?? []) {
          if (!ids[l.pred]) throw new Error(`varianceMutations.addTask.links: onbekende voorganger "${l.pred}"`);
          if (!ids[l.succ]) throw new Error(`varianceMutations.addTask.links: onbekende opvolger "${l.succ}"`);
          S().addSequence({
            predecessorId: ids[l.pred], successorId: ids[l.succ], type: l.type as any, lagDays: l.lag ?? 0,
          });
        }
      }
    }
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
      S().updateTask(tid, { time: { ...task.time, scheduleDuration: op.setDuration.dur } });
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
    } else if ('addCalendarAsDefault' in op) {
      const { id: _cid, ...calBase } = S().calendar;
      void _cid;
      const newId = S().addCalendar({ ...calBase, name: op.addCalendarAsDefault.name });
      S().setProjectCalendar(newId);
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
    ['src/components/panels/TableEditor.tsx', read('src/components/panels/TableEditor.tsx')],
    ['src/components/canvas/GanttCanvas.tsx', read('src/components/canvas/GanttCanvas.tsx')],
    ['src/engine/renderer/GanttRenderer.ts', read('src/engine/renderer/GanttRenderer.ts')],
  ];
  // (a) beide consumenten lezen dezelfde store-cache.
  for (const name of ['TableEditor.tsx', 'GanttCanvas.tsx']) {
    const [, src] = sources.find(([p]) => p.endsWith(name))!;
    if (!/useAppStore\(s => s\.viewRows\)/.test(src)) {
      diffs.push(`${name}: leest niet uit de gedeelde store-cache (useAppStore(s => s.viewRows))`);
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

function runCase(c: Case) {
  if (c.sourceParity) {
    const diffs = runSourceParity();
    return { id: c.id, title: c.title, pass: diffs.length === 0, diffs };
  }
  const diffs: string[] = [];
  let ids: Record<string, string> = {};
  let resIds: Record<string, string> = {};
  let codeTypeIds: Record<string, string> = {};
  let codeValueIds: Record<string, Record<string, string>> = {};
  let fieldDefIds: Record<string, string> = {};
  let previewResult: LevelingResult | null = null;
  try {
    ({ ids, resIds, codeTypeIds, codeValueIds, fieldDefIds, previewResult } = buildAndSolve(c));
  } catch (e) {
    return { id: c.id, title: c.title, pass: false, diffs: [`THREW: ${String(e)}`] };
  }
  const cpm = S().cpmResult;
  const exp = c.expect ?? {};

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
        if (gv !== wv) diffs.push(`${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(gv)}`);
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

  // Kritiek pad als verzameling (namen)
  if (exp.criticalPathSet) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const gotNames = (cpm?.criticalPath ?? []).map(i => idToName[i] ?? i).sort();
    const wantNames = [...exp.criticalPathSet].sort();
    if (JSON.stringify(gotNames) !== JSON.stringify(wantNames))
      diffs.push(`criticalPath: verwacht {${wantNames.join(',')}}, kreeg {${gotNames.join(',')}}`);
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
      } else if (Math.abs(it.interferingFloat - (it.totalFloat - it.freeFloat)) > 1e-9) {
        diffs.push(`intf-invariant: "${name}" intf=${it.interferingFloat} ≠ tf−ff=${it.totalFloat - it.freeFloat}`);
      }
    }
  }

  if (exp.projectEnd !== undefined && cpm?.projectEnd !== exp.projectEnd)
    diffs.push(`projectEnd: verwacht ${exp.projectEnd}, kreeg ${cpm?.projectEnd}`);
  if (exp.projectDuration !== undefined && cpm?.projectDuration !== exp.projectDuration)
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
      if (pe.projectEndAfter !== undefined && pr.projectEndAfter !== pe.projectEndAfter)
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
          if (got[k] !== wv) diffs.push(`variance.${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(got[k])}`);
        }
      }
    }
    if (exp.variance.projectEndDelta !== undefined && vres.projectEndDelta !== exp.variance.projectEndDelta)
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
      const gotHour = scaleFromZoom(TIMESCALE_ZOOM.hour, true);
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

  return { id: c.id, title: c.title, pass: diffs.length === 0, diffs };
}

const files = process.argv.slice(2);
let grandPass = 0;
let grandTotal = 0;
let anyFail = false;
for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const cases: Case[] = data.cases ?? [];
  const name = file.replace(/^.*\/cases-/, '').replace(/\.json$/, '');
  // Een leeg/sleutelloos casusbestand mag niet stil als "0/0 groen" passeren.
  if (cases.length === 0) {
    console.log(`XX ${name}: GEEN cases (leeg of ontbrekende "cases"-sleutel)`);
    anyFail = true;
    continue;
  }
  const results = cases.map(runCase);
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
console.log(`\nTOTAAL: ${grandPass}/${grandTotal}${anyFail ? '  (FALEN)' : '  (alles groen)'}`);
process.exit(anyFail ? 1 : 0);
