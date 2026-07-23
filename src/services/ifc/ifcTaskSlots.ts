import type { Task, TaskTime } from '@/types/task';
import { ifcStr, ifcBool } from './ifcPsets';
import { DEFAULT_PRIORITY } from './ifcConstants';

/**
 * IFCTASK/IFCTASKTIME-slot-registry (modulariteit-audit, bevinding A2 — "IFCTASK-layout dubbel;
 * IFCTASKTIME-slots op 3 plekken"). Vóór dit bestand leefde de POSITIONELE slot-layout van de twee
 * IFC-kern-entiteiten als hardcoded argument-indices op minstens drie plekken die alleen via
 * commentaar aan elkaar gekoppeld waren:
 *   - `ifcWriter.writeTask` (de IFCTASKTIME- en IFCTASK-template-literals, ~20 resp. ~13 posities);
 *   - `ifcReader.parseTaskTime` (leest de IFCTASKTIME-slots op index);
 *   - `ifcReader.applyHourModeIFC` (uur-post-pass, herleest dezelfde IFCTASKTIME-slots op index);
 *   - `ifcReader.extractTasks` (leest de IFCTASK-slots, mét arg-count-detectie voor de legacy-lay-out).
 * Eén verschoven index tussen writer en reader faalde STIL: de reader las simpelweg de verkeerde
 * kolom → dataverlies bij opslaan/herladen.
 *
 * Hier is de VOLGORDE van de slots de enige bron. `IFC_TASKTIME_SLOTS`/`IFC_TASK_SLOTS` zijn geordende
 * descriptor-lijsten (array-positie = STEP-argument-index). De writer ITEREERT de lijst en `.join(',')`t
 * de per-slot geformatteerde waarden ⇒ byte-identieke STEP-uitvoer (zelfde volgorde, zelfde
 * `$`/lege-waarde-conventies). De reader leest via de afgeleide naam→index-maps `TASKTIME_SLOT`/
 * `TASK_SLOT`, zodat writer-positie en reader-index niet meer kunnen divergeren.
 *
 * WEL in descriptors gevangen: de volledige IFCTASKTIME write+read (per-slot, zoals ifcPsets), en de
 * IFCTASK write. BEWUST NIET (audit-richting — "verweven arg-count-detectie buiten de refactor houden"):
 *   - `extractTasks` blijft in ifcReader met zijn taak-time-ref-resolutie, mijlpaal-neveneffect en
 *     priority-parse; de legacy-12-detectie wordt daar één OFFSET die de gedeelde `TASK_SLOT`-indices
 *     verschuift (i.p.v. losse ternary's per slot).
 *   - `applyHourModeIFC` blijft in ifcReader (verweven signaal-detectie + herinterpretatie), maar
 *     leest via dezelfde `TASKTIME_SLOT`-namen.
 * De STEP-parse-helpers (parseDateFromIFC/parseDurationDays/optDate/optDuration) blijven in ifcReader
 * en worden aan de read-descriptors doorgegeven (dependency-injectie) — zo importeert dit bestand
 * alleen uit `@/types`, `./ifcPsets` en `./ifcConstants` (leaves) en ontstaat er geen import-cyclus
 * met ifcReader/ifcWriter.
 */

// ── IFCTASKTIME ─────────────────────────────────────────────────────────────────────────────────

/** Vooraf-berekende invoer voor de IFCTASKTIME-write-slots. `dt`/`ifcDuration` worden GEÏNJECTEERD
 *  (ze wonen in ifcWriter — injectie i.p.v. import vermijdt een cyclus): `dt` is de per-taak gekozen
 *  datetime-formatter (dag ⇒ ifcDateTime, uur ⇒ ifcDateTimeHour), `ifcDuration` de dag-duur-formatter
 *  voor de float-slots. De actuals/duur/status-args zijn al in `writeTask` samengesteld. */
export interface TaskTimeWriteCtx {
  task: Task;
  dt: (iso: string) => string;
  ifcDuration: (days: number) => string;
  schedDurArg: string;
  statusTimeArg: string;
  actualDurationArg: string;
  actualStartArg: string;
  actualFinishArg: string;
  remainingArg: string;
}

/** STEP-parse-helpers die de reader aan de IFCTASKTIME-read-descriptors doorgeeft. Ze wonen in
 *  ifcReader (STEP-specifieke `$`/quote-semantiek); injectie houdt dit bestand cyclusvrij. */
export interface TaskTimeReadHelpers {
  /** parseDateFromIFC(arg || '') — `$`/leeg/afwezig ⇒ vandaag (bestaande semantiek). */
  parseDate: (arg: string | undefined) => string;
  /** parseDurationDays(arg || '') — `$`/leeg ⇒ 0. */
  parseDur: (arg: string | undefined) => number;
  /** optionele datum — `$`/leeg/afwezig ⇒ undefined (geen "vandaag"-fallback). */
  optDate: (arg: string | undefined) => string | undefined;
  /** optionele duur — `$`/leeg/afwezig ⇒ undefined. */
  optDur: (arg: string | undefined) => number | undefined;
}

export interface TaskTimeSlot {
  key: string;
  /** Geformatteerde STEP-waarde voor deze positie (byte-identiek aan de vroegere template-literal). */
  write(w: TaskTimeWriteCtx): string;
  /** Zet de gelezen rauwe arg-string terug op het TaskTime-veld. Afwezig ⇒ slot wordt bij het lezen
   *  genegeerd (Name/DataOrigin/UserDefinedDataOrigin, en StatusTime — dat lezen we uit
   *  OPS_ProjectSettings, niet uit dit slot). */
  read?(t: TaskTime, arg: string | undefined, p: TaskTimeReadHelpers): void;
}

/**
 * De 20 IFCTASKTIME-argumenten in STEP-volgorde (0-based). Spiegelt exact de vroegere
 * `writeTask`-template + `parseTaskTime`-indexlezing. Voortgang-slots (14 StatusTime, 15
 * ActualDuration, 16 ActualStart, 17 ActualFinish, 18 RemainingTime) blijven `$` bij een taak zonder
 * actuals ⇒ byte-identieke round-trip van bestaande bestanden.
 */
export const IFC_TASKTIME_SLOTS: TaskTimeSlot[] = [
  { key: 'name', write: (w) => ifcStr(w.task.name + ' Time') },
  { key: 'dataOrigin', write: () => '.PREDICTED.' },
  { key: 'userDefinedDataOrigin', write: () => '$' },
  {
    key: 'durationType',
    write: (w) => `.${w.task.time.durationType}.`,
    read: (t, arg) => { t.durationType = arg?.includes('ELAPSED') ? 'ELAPSEDTIME' : 'WORKTIME'; },
  },
  {
    key: 'scheduleDuration',
    write: (w) => w.schedDurArg,
    read: (t, arg, p) => { t.scheduleDuration = p.parseDur(arg); },
  },
  {
    key: 'scheduleStart',
    write: (w) => w.dt(w.task.time.scheduleStart),
    read: (t, arg, p) => { t.scheduleStart = p.parseDate(arg); },
  },
  {
    key: 'scheduleFinish',
    write: (w) => w.dt(w.task.time.scheduleFinish),
    read: (t, arg, p) => { t.scheduleFinish = p.parseDate(arg); },
  },
  {
    key: 'earlyStart',
    write: (w) => w.dt(w.task.time.earlyStart),
    read: (t, arg, p) => { t.earlyStart = p.parseDate(arg); },
  },
  {
    key: 'earlyFinish',
    write: (w) => w.dt(w.task.time.earlyFinish),
    read: (t, arg, p) => { t.earlyFinish = p.parseDate(arg); },
  },
  {
    key: 'lateStart',
    write: (w) => w.dt(w.task.time.lateStart),
    read: (t, arg, p) => { t.lateStart = p.parseDate(arg); },
  },
  {
    key: 'lateFinish',
    write: (w) => w.dt(w.task.time.lateFinish),
    read: (t, arg, p) => { t.lateFinish = p.parseDate(arg); },
  },
  {
    key: 'freeFloat',
    write: (w) => w.ifcDuration(w.task.time.freeFloat),
    read: (t, arg, p) => { t.freeFloat = p.parseDur(arg); },
  },
  {
    key: 'totalFloat',
    write: (w) => w.ifcDuration(w.task.time.totalFloat),
    read: (t, arg, p) => { t.totalFloat = p.parseDur(arg); },
  },
  {
    key: 'isCritical',
    write: (w) => ifcBool(w.task.time.isCritical),
    read: (t, arg) => { t.isCritical = arg?.includes('T') || false; },
  },
  // StatusTime (14): geschreven als peildatum bij actuals, maar bij het lezen genegeerd — de
  // projectbrede statusdatum komt uit OPS_ProjectSettings (§15.3). Geen `read`.
  { key: 'statusTime', write: (w) => w.statusTimeArg },
  {
    key: 'actualDuration',
    write: (w) => w.actualDurationArg,
    read: (t, arg, p) => { t.actualDuration = p.optDur(arg); },
  },
  {
    key: 'actualStart',
    write: (w) => w.actualStartArg,
    read: (t, arg, p) => { t.actualStart = p.optDate(arg); },
  },
  {
    key: 'actualFinish',
    write: (w) => w.actualFinishArg,
    read: (t, arg, p) => { t.actualFinish = p.optDate(arg); },
  },
  {
    key: 'remainingTime',
    write: (w) => w.remainingArg,
    read: (t, arg, p) => { t.remainingTime = p.optDur(arg); },
  },
  {
    key: 'completion',
    write: (w) => w.task.time.completion.toFixed(1),
    read: (t, arg) => { t.completion = parseFloat(arg || '0') || 0; },
  },
];

// ── IFCTASK ─────────────────────────────────────────────────────────────────────────────────────

/** Vooraf-berekende invoer voor de IFCTASK-write-slots. `guidArg` (ifcStr(ifcGuid(task.id))) en de
 *  IFCTASKTIME-ref-id worden vooraf berekend in `writeTask` (ifcGuid woont in ifcWriter). */
export interface TaskWriteCtx {
  task: Task;
  ownerHistId: number;
  guidArg: string;
  taskTimeId: number;
}

export interface TaskSlot {
  key: string;
  write(w: TaskWriteCtx): string;
}

/**
 * De 13 IFCTASK-argumenten in de spec-conforme IFC 4.3-volgorde (0-based; geverifieerd tegen
 * ifc43-docs.standards.buildingsmart.org, IfcTask-attribuuttabel). ObjectType/LongDescription/Status/
 * WorkMethod blijven `$` (pragmatische subset); Priority alleen bij afwijking van de default (golden
 * rule §7.7). Oudere OPS-bestanden schreven 12 args (zonder WorkMethod op index 8, waardoor de vier
 * slots erná één positie eerder zaten) — de reader (`extractTasks`) verschuift de gedeelde
 * `TASK_SLOT`-indices met één OFFSET voor die legacy-lay-out.
 */
export const IFC_TASK_SLOTS: TaskSlot[] = [
  { key: 'globalId', write: (w) => w.guidArg },
  { key: 'ownerHistory', write: (w) => `#${w.ownerHistId}` },
  { key: 'name', write: (w) => ifcStr(w.task.name) },
  { key: 'description', write: (w) => ifcStr(w.task.description) },
  { key: 'objectType', write: () => '$' },
  { key: 'identification', write: (w) => ifcStr(w.task.wbsCode) },
  { key: 'longDescription', write: () => '$' },
  { key: 'status', write: () => '$' },
  { key: 'workMethod', write: () => '$' },
  { key: 'isMilestone', write: (w) => ifcBool(w.task.isMilestone) },
  { key: 'priority', write: (w) => (w.task.priority !== DEFAULT_PRIORITY ? String(Math.round(w.task.priority)) : '$') },
  { key: 'taskTime', write: (w) => `#${w.taskTimeId}` },
  { key: 'predefinedType', write: (w) => `.${w.task.taskType}.` },
];

// ── Afgeleide naam→index-maps (single-source: de array-positie boven is de index) ─────────────────

function indexMap(slots: { key: string }[]): Record<string, number> {
  const m: Record<string, number> = {};
  slots.forEach((s, i) => { m[s.key] = i; });
  return m;
}

/** Naam→arg-index voor de IFCTASKTIME-slots (spec-lay-out). Gebruikt door `applyHourModeIFC`. */
export const TASKTIME_SLOT = indexMap(IFC_TASKTIME_SLOTS);

/** Naam→arg-index voor de IFCTASK-slots (spec-lay-out). `extractTasks` verschuift de post-WorkMethod-
 *  slots met een OFFSET voor de 12-arg-legacy-lay-out. */
export const TASK_SLOT = indexMap(IFC_TASK_SLOTS);
