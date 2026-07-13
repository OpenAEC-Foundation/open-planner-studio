import { Task, TaskConstraint, ConstraintType } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, Holiday, WorkTimeBands, createDefaultCalendar } from '@/types/calendar';
import { Baseline, BaselineTask } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { formatDate, formatInstant, parseInstant } from '@/utils/dateUtils';
import { normalizeImportedProgress } from '@/services/importNormalize';
import type { ImportResult } from '@/services/importTypes';
import { WORKCONTOUR_TO_CURVE } from './mspdiWriter';
import {
  canonicalizeBands, clockToMinutes, deriveHoursPerDay, hasNonAnchorTime, isSubDayMinutes, workDaysFromBands,
} from '@/services/subdayIo';

/** Synthetisch anker dat de DAG-schrijver op date-only datetimes plakt (§7.3). */
const MSP_TIME_ANCHOR = '08:00:00';

/** Gecanonicaliseerde banden per gelezen kalender + afwijking (a/b), voor de uur-modus-beslissing. */
const mspBandRegistry = new WeakMap<WorkCalendar, { canonical: WorkTimeBands; deviates: boolean }>();

// WORKCONTOUR_TO_CURVE (spiegel van mspdiWriter's CURVE_TO_WORKCONTOUR, §8.3) wordt nu uit de
// writer geïmporteerd — daar programmatisch afgeleid, dus reader en writer kunnen niet divergeren.

function getElementText(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

function getElementInt(parent: Element, tagName: string, fallback = 0): number {
  const text = getElementText(parent, tagName);
  const n = parseInt(text);
  return isNaN(n) ? fallback : n;
}

function getElementFloat(parent: Element, tagName: string, fallback = 0): number {
  const text = getElementText(parent, tagName);
  const n = parseFloat(text);
  return isNaN(n) ? fallback : n;
}

function parseMSPDate(s: string): string {
  if (!s) return formatDate(new Date());
  // MS Project format: 2026-03-09T08:00:00
  return s.substring(0, 10);
}

/** Datum uit MSPDI in UUR-modus: echte tijd-van-de-dag behouden (`parseInstant`+`formatInstant`, §7.3). */
function parseMSPInstant(s: string): string {
  if (!s) return formatDate(new Date());
  return formatInstant(parseInstant(s), 'hour');
}

/** ISO-8601-duur met tijdcomponent (`PT{H}H{M}M{S}S`) → minuten; `null` als er geen tijdcomponent is. */
function mspDurationMinutes(s: string): number | null {
  if (!s) return null;
  const m = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return (parseInt(m[1] || '0', 10)) * 60 + parseInt(m[2] || '0', 10) + Math.round(parseInt(m[3] || '0', 10) / 60);
}

/**
 * Duur in DAGEN (dag-modus). Fase 2.8b (§7.3): de hardcoded `/8` is vervangen door `hoursPerDay`
 * (latente bug bij niet-8u-kalenders), en de uren komen uit `mspDurationMinutes`. `PnD` blijft
 * elapsed-dagen. In uur-modus gebruikt de reader `mspDurationMinutes` rechtstreeks (geen afronding).
 */
function parseMSPDuration(s: string, hoursPerDay: number): number {
  if (!s) return 0;
  const mins = mspDurationMinutes(s);
  if (mins != null) {
    const perDay = hoursPerDay * 60;
    return perDay > 0 ? Math.round(mins / perDay) : 0;
  }
  const dayMatch = s.match(/P(\d+)D/);
  if (dayMatch) return parseInt(dayMatch[1]);
  return 0;
}

function mspTypeToSequenceType(type: number): SequenceType {
  switch (type) {
    case 0: return 'FINISH_FINISH';
    case 1: return 'FINISH_START';
    case 2: return 'START_FINISH';
    case 3: return 'START_START';
    default: return 'FINISH_START';
  }
}

/**
 * Fase 2.9 (§6) — MSPDI `ConstraintType`-code → OPS-constraint (spiegel van `mspConstraintCode`).
 * 2/3 (Must Start/Finish On) zijn HARD ⇒ `MSO`/`MFO` mét `hard:true` (daar klopt de semantiek); 4-7
 * zijn de soft SNET/SNLT/FNET/FNLT; 0 (ASAP, default) en onbekend ⇒ `undefined` (geen constraint).
 */
function mspCodeToConstraint(code: number): { type: ConstraintType; hard?: boolean } | undefined {
  switch (code) {
    case 1: return { type: 'ALAP' };
    case 2: return { type: 'MSO', hard: true };
    case 3: return { type: 'MFO', hard: true };
    case 4: return { type: 'SNET' };
    case 5: return { type: 'SNLT' };
    case 6: return { type: 'FNET' };
    case 7: return { type: 'FNLT' };
    default: return undefined;
  }
}

function tenthsOfMinutesToDays(tenths: number, hoursPerDay: number): number {
  // tenths of minutes -> days
  const minutes = tenths / 10;
  const hours = minutes / 60;
  return Math.round(hours / hoursPerDay);
}

export function readMSPDI(content: string): ImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');

  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Invalid XML: ' + parserError.textContent);
  }

  const root = doc.documentElement;

  // Parse project
  const project = parseProject(root);
  const calendar = parseCalendar(root);
  const hoursPerDay = calendar.hoursPerDay;

  // Resource-kalenders (fase 2.5, §8.2): elk <Calendar>-element in <Calendars> behalve UID 1
  // (de projectkalender, altijd als eerste geschreven/gelezen — zelfde aanname als parseCalendar).
  const calendarsRoot = root.getElementsByTagName('Calendars')[0];
  const calUidToId = new Map<number, string>();
  const resourceCalendars: WorkCalendar[] = [];
  if (calendarsRoot) {
    const calElements = calendarsRoot.getElementsByTagName('Calendar');
    for (let i = 0; i < calElements.length; i++) {
      const calEl = calElements[i];
      if (calEl.parentElement !== calendarsRoot) continue;
      const uid = getElementInt(calEl, 'UID', -1);
      if (uid <= 1) continue; // UID 1 = projectkalender, al gelezen door parseCalendar
      const cal = createDefaultCalendar();
      cal.id = generateId('rescal');
      cal.name = getElementText(calEl, 'Name') || cal.name;
      // §8.3: werkweek/uren/feestdagen ook voor bibliotheek-kalenders teruglezen (voorheen alleen
      // naam/id — dezelfde beperking die de projectkalender vóór 2.8a had). MSPDI kent geen
      // regelset-herkomst (verliesmatrix §8.4) — generation blijft altijd undefined.
      applyCalendarBody(calEl, cal);
      delete cal.generation;
      calUidToId.set(uid, cal.id);
      resourceCalendars.push(cal);
    }
  }

  // Resources (fase 2.5, §8.2)
  const resourcesRoot = root.getElementsByTagName('Resources')[0];
  const resources: Resource[] = [];
  const resUidToId = new Map<number, string>();
  if (resourcesRoot) {
    const resElements = resourcesRoot.getElementsByTagName('Resource');
    for (let i = 0; i < resElements.length; i++) {
      const resEl = resElements[i];
      if (resEl.parentElement !== resourcesRoot) continue;
      const uid = getElementInt(resEl, 'UID', -1);
      if (uid < 0) continue;
      const id = generateId('res');
      resUidToId.set(uid, id);

      const name = getElementText(resEl, 'Name') || 'Resource';
      const type = getElementInt(resEl, 'Type', 1);
      const maxUnits = getElementFloat(resEl, 'MaxUnits', 1);
      const materialLabel = getElementText(resEl, 'MaterialLabel');
      const calUid = getElementInt(resEl, 'CalendarUID', -1);
      const standardRate = getElementText(resEl, 'StandardRate');

      // MSP maakt geen onderscheid tussen LABOR/EQUIPMENT/CREW/SUBCONTRACTOR (Type=1 =
      // "Work") — zonder verdere hint komt dat terug als LABOR (geaccepteerd verlies, §8.4).
      const resource: Resource = {
        id,
        name,
        type: type === 0 ? 'MATERIAL' : 'LABOR',
        description: '',
        maxUnits,
      };
      if (materialLabel) resource.unitOfMeasure = materialLabel;
      if (calUid >= 0 && calUidToId.has(calUid)) resource.calendarId = calUidToId.get(calUid);
      const rate = parseFloat(standardRate);
      if (Number.isFinite(rate) && standardRate) resource.costPerHour = rate;
      resources.push(resource);
    }
  }

  // Parse tasks
  const taskElements = root.getElementsByTagName('Task');
  const tasks: Task[] = [];
  const uidToId = new Map<number, string>();
  const uidToWbs = new Map<number, string>();
  const pendingLinks: { successorId: string; predUid: number; type: number; lag: number; lagFormat: number }[] = [];
  // Baseline 0 (fase 2.6, §9.1): per taak de gesnapshotte Start/Finish/Duration.
  const baselineEntries: BaselineTask[] = [];

  // Fase 2.8b (§7.3): uur-modus-beslissing per kalender (discriminator a/b/c) vóór het bouwen van de
  // taken. `effCalIdOfUid` geeft per taak de effectieve kalender-id (CalendarUID 1/ontbrekend =
  // projectkalender). `taskHourById` voedt de lag-eenheid-keuze verderop.
  const calById = new Map<string, WorkCalendar>();
  calById.set(calendar.id, calendar);
  for (const c of resourceCalendars) calById.set(c.id, c);
  const effCalIdOfUid = (calUid: number): string => (calUid > 1 && calUidToId.get(calUid)) || calendar.id;
  const taskHourById = new Map<string, boolean>();

  const cSignalCalIds = new Set<string>();
  for (let i = 0; i < taskElements.length; i++) {
    const te = taskElements[i];
    if (te.parentElement?.tagName !== 'Tasks') continue;
    const calId = effCalIdOfUid(getElementInt(te, 'CalendarUID', 1));
    const cal = calById.get(calId);
    if (!cal) continue;
    const durMin = mspDurationMinutes(getElementText(te, 'Duration'));
    const durSignal = durMin != null && isSubDayMinutes(durMin, cal.hoursPerDay);
    const dateSignal = hasNonAnchorTime(getElementText(te, 'Start'), MSP_TIME_ANCHOR)
      || hasNonAnchorTime(getElementText(te, 'Finish'), MSP_TIME_ANCHOR);
    if (durSignal || dateSignal) cSignalCalIds.add(calId);
  }
  const hourModeCalIds = new Set<string>();
  for (const [id, cal] of calById) {
    const info = mspBandRegistry.get(cal);
    if (!((info?.deviates ?? false) || cSignalCalIds.has(id))) continue;
    hourModeCalIds.add(id);
    if (cal.workTime) continue;
    const bands = info && workDaysFromBands(info.canonical).length > 0 ? info.canonical : synthMspBandsFromScalar(cal);
    cal.workTime = bands;
    const wd = workDaysFromBands(bands);
    if (wd.length > 0) cal.workDays = wd;
    cal.hoursPerDay = deriveHoursPerDay(bands, cal.hoursPerDay);
  }

  for (let i = 0; i < taskElements.length; i++) {
    const te = taskElements[i];
    // Skip if this is nested inside another element (like PredecessorLink)
    if (te.parentElement?.tagName !== 'Tasks') continue;

    const uid = getElementInt(te, 'UID', -1);
    if (uid < 0) continue;

    // Skip project summary task (UID 0)
    const outlineLevel = getElementInt(te, 'OutlineLevel', 1);
    if (uid === 0 && outlineLevel === 0) continue;

    const id = generateId('task');
    uidToId.set(uid, id);

    const name = getElementText(te, 'Name') || 'Task';
    const wbs = getElementText(te, 'WBS') || `${uid}`;
    uidToWbs.set(uid, wbs);
    // Taak-kalender (fase 2.8a, §8.3): effectieve <CalendarUID> → task.calendarId. UID 1 (of
    // ontbrekend, legacy-bestanden) = projectkalender ⇒ undefined (bestaande conventie).
    const taskCalUid = getElementInt(te, 'CalendarUID', 1);
    const taskCalendarId = taskCalUid > 1 ? calUidToId.get(taskCalUid) : undefined;
    // Fase 2.8b (§7.3): uur- vs dag-modus voor deze taak.
    const effCalId = effCalIdOfUid(taskCalUid);
    const isHour = hourModeCalIds.has(effCalId);
    const effHpd = calById.get(effCalId)?.hoursPerDay ?? hoursPerDay;

    const durationStr = getElementText(te, 'Duration');
    // Duur: uur ⇒ minuten (bron van waarheid, geen afronding, §7.3); dag ⇒ het bestaande dag-pad.
    const durationMinutes = isHour ? (mspDurationMinutes(durationStr) ?? 0) : undefined;
    const duration = isHour ? (effHpd > 0 ? durationMinutes! / (effHpd * 60) : 0) : parseMSPDuration(durationStr, hoursPerDay);
    const start = isHour ? parseMSPInstant(getElementText(te, 'Start')) : parseMSPDate(getElementText(te, 'Start'));
    const finish = isHour ? parseMSPInstant(getElementText(te, 'Finish')) : parseMSPDate(getElementText(te, 'Finish'));
    const isMilestone = getElementInt(te, 'Milestone') === 1;
    const percentComplete = getElementInt(te, 'PercentComplete');
    const priority = getElementInt(te, 'Priority', 500);
    const description = getElementText(te, 'Notes');

    // Actuals (fase 2.6, §9.1) — leeg ⇒ undefined (invarianten volgen bij normalizeImportedProgress).
    const actualStartRaw = getElementText(te, 'ActualStart');
    const actualFinishRaw = getElementText(te, 'ActualFinish');
    const remainingRaw = getElementText(te, 'RemainingDuration');
    const actualStart = actualStartRaw ? (isHour ? parseMSPInstant(actualStartRaw) : parseMSPDate(actualStartRaw)) : undefined;
    const actualFinish = actualFinishRaw ? (isHour ? parseMSPInstant(actualFinishRaw) : parseMSPDate(actualFinishRaw)) : undefined;
    // RemainingDuration: uur ⇒ minuten; dag ⇒ het bestaande dag-pad.
    const remainingMinutes = isHour && remainingRaw ? (mspDurationMinutes(remainingRaw) ?? undefined) : undefined;
    const remainingTime = !isHour && remainingRaw ? parseMSPDuration(remainingRaw, hoursPerDay) : undefined;

    let status: 'NOT_STARTED' | 'STARTED' | 'COMPLETED' = 'NOT_STARTED';
    if (percentComplete >= 100) status = 'COMPLETED';
    else if (percentComplete > 0) status = 'STARTED';

    // Datum-constraint (fase 2.9, §6): ConstraintType/ConstraintDate. 0/ontbrekend ⇒ geen constraint
    // (default-inert). MSPDI kent geen secundaire constraint. Datum: uur ⇒ echte tijd, dag ⇒ strip.
    const parseCstrDate = (raw: string): string => isHour ? parseMSPInstant(raw) : parseMSPDate(raw);
    let constraint: TaskConstraint | undefined;
    const cTypeRaw = getElementText(te, 'ConstraintType');
    if (cTypeRaw) {
      const mapped = mspCodeToConstraint(parseInt(cTypeRaw, 10));
      if (mapped) {
        const cdateRaw = getElementText(te, 'ConstraintDate');
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(cdateRaw ? { date: parseCstrDate(cdateRaw) } : {}),
        };
      }
    }
    // Zachte deadline (fase 2.9, §6): native <Deadline> → task.deadline.
    const deadlineRaw = getElementText(te, 'Deadline');
    const deadline = deadlineRaw ? parseCstrDate(deadlineRaw) : undefined;

    // Baseline 0: eerste direct-kind <Baseline> met <Number>0</Number>.
    const baselineEls = te.getElementsByTagName('Baseline');
    for (let b = 0; b < baselineEls.length; b++) {
      const bEl = baselineEls[b];
      if (bEl.parentElement !== te) continue;
      if (getElementInt(bEl, 'Number', -1) !== 0) continue;
      baselineEntries.push({
        taskId: id,
        start: parseMSPDate(getElementText(bEl, 'Start')),
        finish: parseMSPDate(getElementText(bEl, 'Finish')),
        duration: parseMSPDuration(getElementText(bEl, 'Duration'), hoursPerDay),
        isMilestone,
      });
      break;
    }

    tasks.push({
      id,
      name,
      description,
      wbsCode: wbs,
      taskType: 'CONSTRUCTION',
      status,
      isMilestone,
      priority,
      parentId: null,
      childIds: [],
      time: {
        durationType: 'WORKTIME',
        scheduleDuration: duration,
        ...(durationMinutes != null ? { durationMinutes } : {}),
        scheduleStart: start,
        scheduleFinish: finish,
        earlyStart: start,
        earlyFinish: finish,
        lateStart: start,
        lateFinish: finish,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        actualStart,
        actualFinish,
        remainingTime,
        ...(remainingMinutes != null ? { remainingMinutes } : {}),
        completion: percentComplete / 100,
      },
      resourceIds: [],
      ...(constraint ? { constraint } : {}),
      ...(deadline ? { deadline } : {}),
      ...(taskCalendarId ? { calendarId: taskCalendarId } : {}),
    });
    taskHourById.set(id, isHour);

    // Parse predecessor links within task element
    const predLinks = te.getElementsByTagName('PredecessorLink');
    for (let j = 0; j < predLinks.length; j++) {
      const pl = predLinks[j];
      const predUid = getElementInt(pl, 'PredecessorUID', -1);
      const linkType = getElementInt(pl, 'Type', 1);
      const linkLag = getElementInt(pl, 'LinkLag', 0);
      const lagFormat = getElementInt(pl, 'LagFormat', 7);
      if (predUid >= 0) {
        pendingLinks.push({
          successorId: id,
          predUid,
          type: linkType,
          lag: linkLag,
          lagFormat,
        });
      }
    }
  }

  // Rebuild parent-child hierarchy from WBS codes
  const wbsToId = new Map<string, string>();
  for (const task of tasks) {
    wbsToId.set(task.wbsCode, task.id);
  }

  for (const task of tasks) {
    if (!task.wbsCode || !task.wbsCode.includes('.')) continue;
    const parts = task.wbsCode.split('.');
    parts.pop();
    const parentWbs = parts.join('.');
    const parentId = wbsToId.get(parentWbs);
    if (parentId) {
      task.parentId = parentId;
      const parent = tasks.find(t => t.id === parentId);
      if (parent && !parent.childIds.includes(task.id)) {
        parent.childIds.push(task.id);
      }
    }
  }

  // Resolve sequences. LagFormat (subset van MSPDI DurationFormat): 19/20 = (elapsed) procent
  // met LinkLag in tienden van een procent; 4/6/8/10/12 = elapsed duren (24/7); rest = werktijd
  // in tienden van minuten (bestaand pad).
  const ELAPSED_DURATION_FORMATS = new Set([4, 6, 8, 10, 12]);
  const sequences: Sequence[] = [];
  for (const link of pendingLinks) {
    const predId = uidToId.get(link.predUid);
    if (!predId) continue;
    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: link.successorId,
      type: mspTypeToSequenceType(link.type),
      lagDays: 0,
    };
    if (link.lagFormat === 19 || link.lagFormat === 20) {
      seq.lagPercent = link.lag / 10;
      if (link.lagFormat === 20) seq.lagUnit = 'ELAPSEDTIME';
    } else if (ELAPSED_DURATION_FORMATS.has(link.lagFormat)) {
      seq.lagDays = Math.round(link.lag / 10 / 60 / 24);
      seq.lagUnit = 'ELAPSEDTIME';
    } else if (taskHourById.get(link.successorId)) {
      // Fase 2.8b (§7.3): uur-opvolger ⇒ lag minuut-precies (tienden-van-minuten ÷ 10, geen
      // dag-afronding). LinkLag is al in tienden van minuten.
      seq.lagMinutes = Math.round(link.lag / 10);
    } else {
      seq.lagDays = tenthsOfMinutesToDays(link.lag, hoursPerDay);
    }
    sequences.push(seq);
  }

  // Assignments (fase 2.5, §8.2)
  const assignmentsRoot = root.getElementsByTagName('Assignments')[0];
  const assignments: ResourceAssignment[] = [];
  if (assignmentsRoot) {
    const asgnElements = assignmentsRoot.getElementsByTagName('Assignment');
    for (let i = 0; i < asgnElements.length; i++) {
      const asgnEl = asgnElements[i];
      if (asgnEl.parentElement !== assignmentsRoot) continue;
      const taskUid = getElementInt(asgnEl, 'TaskUID', -1);
      const resourceUid = getElementInt(asgnEl, 'ResourceUID', -1);
      if (taskUid < 0 || resourceUid < 0) continue;
      const taskId = uidToId.get(taskUid);
      const resourceId = resUidToId.get(resourceUid);
      if (!taskId || !resourceId) continue;

      const unitsText = getElementText(asgnEl, 'Units');
      const units = parseFloat(unitsText);
      const contour = getElementInt(asgnEl, 'WorkContour', 0);
      const curve = WORKCONTOUR_TO_CURVE[contour];

      assignments.push({
        id: generateId('asgn'),
        taskId,
        resourceId,
        unitsPerDay: Number.isFinite(units) && unitsText ? units : 1,
        ...(curve && curve !== 'UNIFORM' ? { curve } : {}),
      });
    }
  }

  // Baseline 0 → één actieve OPS-baseline "Baseline (MSPDI)" (fase 2.6, §9.1).
  const baselines: Baseline[] = [];
  let activeBaselineId: string | null = null;
  if (baselineEntries.length > 0) {
    const id = generateId('baseline');
    const finishes = baselineEntries.map(b => b.finish).filter(Boolean).sort();
    baselines.push({
      id,
      name: 'Baseline (MSPDI)',
      createdAt: new Date().toISOString(),
      tasks: baselineEntries,
      projectEnd: finishes[finishes.length - 1] || '',
      projectDuration: 0,
    });
    activeBaselineId = id;
  }

  // Voortgang-invarianten op de rauw ingelezen actuals (§3.2/§15.6).
  normalizeImportedProgress(tasks, project.statusDate);

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars,
    baselines,
    activeBaselineId,
  };
}

function parseProject(root: Element): Project {
  const project: Project = {
    id: generateId('proj'),
    name: getElementText(root, 'Name') || getElementText(root, 'Title') || 'MS Project Import',
    description: '',
    startDate: parseMSPDate(getElementText(root, 'StartDate')),
    endDate: parseMSPDate(getElementText(root, 'FinishDate')),
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: getElementText(root, 'Author'),
    company: getElementText(root, 'Company'),
  };
  // Statusdatum (fase 2.6, §9.1) → project.statusDate. Alleen wanneer aanwezig.
  const statusDateRaw = getElementText(root, 'StatusDate');
  if (statusDateRaw) project.statusDate = parseMSPDate(statusDateRaw);
  // Scheduling-options (fase 2.9, §6): CriticalSlackLimit → criticalDefinition.threshold (dagen,
  // mode 'totalFloat'). Alleen wanneer het element aanwezig is (spiegel van de writer). threshold 0
  // is de default (tf≤0) en dus inert. De overige opties zitten niet in MSPDI (alleen via IFC).
  const cslRaw = getElementText(root, 'CriticalSlackLimit');
  if (cslRaw) {
    const csl = parseInt(cslRaw, 10);
    if (Number.isFinite(csl)) {
      project.schedulingOptions = { criticalDefinition: { mode: 'totalFloat', threshold: csl } };
    }
  }
  return project;
}

/**
 * Werkdagen/uren/feestdagen uit een `<Calendar>`-element in `calendar` toepassen (spiegel van
 * `writeCalendarBlock`) — gedeeld tussen de projectkalender (`parseCalendar`) en elke
 * bibliotheek-kalender (fase 2.8a, §8.3: voorheen kregen resource-kalenders alleen naam/id, nooit
 * hun eigen werkweek/uren/feestdagen terug — dezelfde beperkte lezing als de projectkalender vóór
 * 2.8a). Golden rule: ontbrekende WeekDay/WorkingTime/Exception-elementen laten de
 * `createDefaultCalendar()`-defaults ongemoeid.
 */
function applyCalendarBody(calEl: Element, calendar: WorkCalendar): void {
  // Parse work days from WeekDay elements
  const weekDays = calEl.getElementsByTagName('WeekDay');
  const workDays: number[] = [];
  // Fase 2.8b (§7.3): ALLE <WorkingTime>-banden per weekdag lezen (nu las de reader alleen het eerste
  // blok als scalar) → rauwe banden voor de uur-modus-beslissing.
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};

  for (let i = 0; i < weekDays.length; i++) {
    const wd = weekDays[i];
    // Only process direct children of WeekDays
    if (wd.parentElement?.tagName !== 'WeekDays') continue;

    const dayType = getElementInt(wd, 'DayType');
    const dayWorking = getElementInt(wd, 'DayWorking');

    if (dayWorking === 1 && dayType >= 1 && dayType <= 7) {
      // Convert MSP day (1=Sun, 2=Mon, ..., 7=Sat) to ISO (1=Mon, ..., 7=Sun)
      const isoDay = dayType === 1 ? 7 : dayType - 1;
      workDays.push(isoDay);
      const wts = wd.getElementsByTagName('WorkingTime');
      const dayBands: { start: number; end: number }[] = [];
      for (let k = 0; k < wts.length; k++) {
        const s = clockToMinutes(getElementText(wts[k], 'FromTime'));
        const e = clockToMinutes(getElementText(wts[k], 'ToTime'));
        if (s != null && e != null) dayBands.push({ start: s, end: e });
      }
      if (dayBands.length > 0) rawByWeekday[isoDay as 1] = dayBands;
    }
  }

  if (workDays.length > 0) {
    calendar.workDays = workDays.sort((a, b) => a - b);
  }

  // Parse working times for start/end hours (scalar, bestaand dag-pad)
  const workingTimes = calEl.getElementsByTagName('WorkingTime');
  if (workingTimes.length > 0) {
    const fromTime = getElementText(workingTimes[0], 'FromTime');
    const toTime = getElementText(workingTimes[0], 'ToTime');
    if (fromTime) {
      const h = parseInt(fromTime.split(':')[0]);
      if (!isNaN(h)) calendar.workStartHour = h;
    }
    if (toTime) {
      const h = parseInt(toTime.split(':')[0]);
      if (!isNaN(h)) calendar.workEndHour = h;
    }
    calendar.hoursPerDay = calendar.workEndHour - calendar.workStartHour;
    if (calendar.hoursPerDay <= 0) calendar.hoursPerDay = 8;
  }

  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  mspBandRegistry.set(calendar, { canonical: bands, deviates });

  // Parse exceptions (holidays)
  const exceptions = calEl.getElementsByTagName('Exception');
  const holidays: Holiday[] = [];
  for (let i = 0; i < exceptions.length; i++) {
    const exc = exceptions[i];
    const dayWorking = getElementInt(exc, 'DayWorking');
    if (dayWorking === 0) {
      const name = getElementText(exc, 'Name') || 'Holiday';
      const timePeriods = exc.getElementsByTagName('TimePeriod');
      if (timePeriods.length > 0) {
        const fromDate = parseMSPDate(getElementText(timePeriods[0], 'FromDate'));
        const toDate = parseMSPDate(getElementText(timePeriods[0], 'ToDate'));
        holidays.push({ name, startDate: fromDate, endDate: toDate });
      }
    }
  }
  if (holidays.length > 0) {
    calendar.holidays = holidays;
  }
}

/** Enkelband-kalender uit de scalar `workStartHour/EndHour` (fallback bij (c)-promotie zonder banden). */
function synthMspBandsFromScalar(cal: WorkCalendar): WorkTimeBands {
  const raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const band = { start: cal.workStartHour * 60, end: cal.workEndHour * 60 };
  for (const wd of cal.workDays) if (wd >= 1 && wd <= 7) raw[wd as 1] = [{ ...band }];
  return canonicalizeBands(raw).bands;
}

function parseCalendar(root: Element): WorkCalendar {
  const calElements = root.getElementsByTagName('Calendar');
  if (calElements.length === 0) return createDefaultCalendar();

  const cal = calElements[0];
  const calName = getElementText(cal, 'Name') || 'Imported Calendar';
  const calendar = createDefaultCalendar();
  calendar.name = calName;
  // MSPDI kent geen regelset-herkomst (verliesmatrix §8.4) — createDefaultCalendar() zet 'm altijd
  // (nieuwe projecten zijn per definitie gegenereerd); een uit MSPDI gelezen kalender is dat niet.
  delete calendar.generation;

  applyCalendarBody(cal, calendar);

  // Parse minutes per day from project level — authoritatief, overschrijft de
  // WorkingTime-afgeleide waarde uit applyCalendarBody (bestaand gedrag).
  const minutesPerDay = getElementInt(root, 'MinutesPerDay');
  if (minutesPerDay > 0) {
    calendar.hoursPerDay = minutesPerDay / 60;
  }

  return calendar;
}
