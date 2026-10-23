// F3c deel 4: de dagenmaat met breuken, de lagmaat en de speling in minuten door IFC (spec
// `docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §3.3, §3.4, §3.10, §5.4; T5 en T21).
//
// Wat deze check vastlegt:
//  (1) de voorbeeldweek met drie relaties naast elkaar (FS 0,5 d dagenmaat, FS 240 min urenmaat,
//      FS 1,5 ed): de vorm in het bestand, de records in `OPS_Sequences.DayMeasureLags`, en IFC ⇒ OPS
//      met dezelfde velden;
//  (2) een gewijzigde lag (`PT4H0M0S` ⇒ `PT6H0M0S`): de nieuwe OPS leest 360 min urenmaat, het record
//      telt niet;
//  (3) de opvolgertijden vr 10:00 en vr 11:00 (die hangen af van de motor, deel 1);
//  (4) de maat in elk profiel: onder P6 dezelfde bytes, en OPS ⇒ P6 ⇒ OPS geeft dezelfde velden;
//  (5) de lagkalender bepaalt de minuten (voorganger, opvolger, project, 24 uur);
//  (6) duur, rest en werkelijke duur met een breuk, en kalendertijd met een breuk;
//  (7) een gewijzigde duur of rest; (8) de speling (T5); (9) een letterlijke kalender blijft scalair;
//  (10) de lezer van v2026.9.0, als `OPS_MINUTE_MODEL_OLD_READER` naar een gebundelde lezer van die tag
//      wijst (zie tests/planning/README.md, "F2: omzetting en bestandscompatibiliteit").
//
// Draait via run.sh (esbuild-bundel). Alleen de exitcode telt.
import './domStub';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freshPayload, payloadFromImport, type DocumentPayload } from '@/state/documentContract';
import { prepareLoadedPayload } from '@/state/documentActivation';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { builtInProfile, switchProfile } from '@/engine/scheduler/conventions/registry';
import { computeCalendarHash } from '@/services/library/libraryOps';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ImportResult } from '@/services/importTypes';
import type { Task, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) errors.push(label);
}

// ── Opzet: de voorbeeldweek (§0): ma–do 07:00–12:00 + 13:00–16:00 (8 u), vr 07:00–12:00 + 13:00–14:00 (6 u).
const LONG = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const FRIDAY = [{ start: 420, end: 720 }, { start: 780, end: 840 }];
const WEEK: WorkTimeBands = { byWeekday: { 1: LONG, 2: LONG, 3: LONG, 4: LONG, 5: FRIDAY, 6: [], 7: [] } };

function task(id: string, start: string, finish: string, days: number, extra: Partial<TaskTime> = {}): Task {
  return {
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      ...createDefaultTaskTime('2026-06-01', days), scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish, ...extra,
    },
  };
}

function weekPayload(): DocumentPayload {
  const p = freshPayload();
  p.project = { ...p.project, startDate: '2026-06-01' };
  p.calendar = { ...p.calendar, holidays: [], workTime: WEEK, hoursPerDay: 8 };
  p.calendars = p.calendars.map(c => (c.id === p.calendar.id ? p.calendar : c));
  // A: 4 d dagenmaat, ma 1 jun 07:00 – do 4 jun 16:00. B, C, D: 1 d, elk met een eigen lag na A.
  p.tasks = [
    task('A', '2026-06-01T07:00', '2026-06-04T16:00', 4),
    task('B', '2026-06-05T07:00', '2026-06-05T14:00', 1),
    task('C', '2026-06-05T07:00', '2026-06-05T14:00', 1),
    task('D', '2026-06-08T07:00', '2026-06-08T16:00', 1),
  ];
  p.sequences = [
    { id: 'lag-dagen', predecessorId: 'A', successorId: 'B', type: 'FINISH_START', lagDays: 0.5 },
    { id: 'lag-uren', predecessorId: 'A', successorId: 'C', type: 'FINISH_START', lagDays: 0, lagMinutes: 240 },
    { id: 'lag-ed', predecessorId: 'A', successorId: 'D', type: 'FINISH_START', lagDays: 1.5, lagUnit: 'ELAPSEDTIME' },
  ];
  return p;
}

const lagFields = (s: Sequence | undefined) => s && { lagDays: s.lagDays, lagMinutes: s.lagMinutes, lagUnit: s.lagUnit, lagPercent: s.lagPercent };
function seqByPair(r: { sequences: Sequence[]; tasks: Task[] }, pred: string, succ: string): Sequence | undefined {
  const name = new Map(r.tasks.map(t => [t.id, t.name]));
  return r.sequences.find(s => name.get(s.predecessorId) === pred && name.get(s.successorId) === succ);
}
/** De STEP-regel van de IFCLAGTIME van de relatie met deze GlobalId. */
function lagLineOf(text: string, guid: string): string {
  const rel = text.split('\n').find(l => l.includes(`IFCRELSEQUENCE('${guid}'`));
  const lagRef = rel?.match(/IFCRELSEQUENCE\((?:[^,]*,){6}(#\d+)/)?.[1];
  return text.split('\n').find(l => lagRef !== undefined && l.startsWith(`${lagRef}=IFCLAGTIME(`)) ?? '';
}
function dayMeasureLagsOf(text: string): Record<string, unknown> {
  const raw = text.match(/IFCPROPERTYSINGLEVALUE\('DayMeasureLags',\$,IFCTEXT\('(.*)'\),\$\)/)?.[1];
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}
function taskTimeLine(text: string, name: string): string {
  return text.split('\n').find(l => l.includes(`IFCTASKTIME('${name} Time'`)) ?? '';
}
/** Vervang in één regel van het bestand (gekozen met `line`) een tekst; de rest blijft byte-gelijk. */
function patchLine(text: string, line: string, from: string, to: string): string {
  ok(`opzet: de te wijzigen regel bevat ${from}`, line.includes(from));
  return text.replace(line, line.replace(from, to));
}
const minutesOf = (iso: string): number => {
  const m = iso.match(/^(-?)PT(\d+)H(\d+)M/);
  return m ? (m[1] ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : NaN;
};

// ── (1) De voorbeeldweek: drie relaties naast elkaar ───────────────────────────────────────────────
const week = weekPayload();
const weekText = writeIFC(buildWriteIFCInput(week));
const weekRead = readIFC(weekText);
/** De GlobalId van de relatie pred → succ in een gelezen bestand (relaties krijgen bij inlezen een id uit
 *  hun GlobalId; `ifcGlobalIds` is daarop gesleuteld). */
function guidOfPair(r: ImportResult, pred: string, succ: string): string {
  const seq = seqByPair(r, pred, succ);
  return (seq && r.ifcGlobalIds?.[`seq:${seq.id}`]) ?? '';
}
const SUCCESSOR_OF: Record<string, string> = { 'lag-dagen': 'B', 'lag-uren': 'C', 'lag-ed': 'D' };
const guidOf = (id: string) => guidOfPair(weekRead, 'A', SUCCESSOR_OF[id]);
{
  ok('(1) opzet: elke relatie heeft een GlobalId in het bestand', ['lag-dagen', 'lag-uren', 'lag-ed'].every(id => guidOf(id).length === 22));
  eq('(1) FS 0,5 d dagenmaat: PT…, werktijd', /IFCDURATION\('PT4H0M0S'\),\.WORKTIME\./.test(lagLineOf(weekText, guidOf('lag-dagen'))), true);
  eq('(1) FS 240 min urenmaat: PT…, werktijd', /IFCDURATION\('PT4H0M0S'\),\.WORKTIME\./.test(lagLineOf(weekText, guidOf('lag-uren'))), true);
  eq('(1) FS 1,5 ed: PT… (dagen × 1440), kalendertijd', /IFCDURATION\('PT36H0M0S'\),\.ELAPSEDTIME\./.test(lagLineOf(weekText, guidOf('lag-ed'))), true);
  eq('(1) records alleen voor de breuken in dagen', dayMeasureLagsOf(weekText),
    { [guidOf('lag-dagen')]: [0.5, 240], [guidOf('lag-ed')]: [1.5, 2160] });
  ok('(1) de records staan in OPS_Sequences', /IFCPROPERTYSET\('[^']+',#\d+,'OPS_Sequences',\$,\(#\d+\)\)/.test(weekText));
  ok('(1) geen gebroken P…D in het bestand', !/'-?P(?:0Y0M)?-?\d+\.\d+D'/.test(weekText));
  eq('(1) IFC ⇒ OPS: FS 0,5 d dagenmaat', lagFields(seqByPair(weekRead, 'A', 'B')), { lagDays: 0.5 });
  eq('(1) IFC ⇒ OPS: FS 240 min urenmaat', lagFields(seqByPair(weekRead, 'A', 'C')), { lagDays: 0, lagMinutes: 240 });
  eq('(1) IFC ⇒ OPS: FS 1,5 ed', lagFields(seqByPair(weekRead, 'A', 'D')), { lagDays: 1.5, lagUnit: 'ELAPSEDTIME' });
  const loaded = payloadFromImport(readIFC(weekText), null);
  eq('(1) ook na de laadgrens (payloadFromImport)', ['B', 'C', 'D'].map(s => lagFields(seqByPair(loaded, 'A', s))),
    [{ lagDays: 0.5 }, { lagDays: 0, lagMinutes: 240 }, { lagDays: 1.5, lagUnit: 'ELAPSEDTIME' }]);
  const again = writeIFC(buildWriteIFCInput(loaded));
  eq('(1) tweede ronde: dezelfde lagregels en records', [
    lagLineOf(again, guidOf('lag-dagen')).replace(/^#\d+=/, ''), lagLineOf(again, guidOf('lag-ed')).replace(/^#\d+=/, ''),
    dayMeasureLagsOf(again),
  ], [
    lagLineOf(weekText, guidOf('lag-dagen')).replace(/^#\d+=/, ''), lagLineOf(weekText, guidOf('lag-ed')).replace(/^#\d+=/, ''),
    dayMeasureLagsOf(weekText),
  ]);
}

// ── (2) Een gewijzigde lag: alleen het standaardveld van de eerste relatie verandert ────────────────
const changedLagText = patchLine(weekText, lagLineOf(weekText, guidOf('lag-dagen')), "'PT4H0M0S'", "'PT6H0M0S'");
{
  const r = readIFC(changedLagText);
  eq('(2) PT6H0M0S ⇒ 360 min urenmaat, het record telt niet', lagFields(seqByPair(r, 'A', 'B')), { lagDays: 0, lagMinutes: 360 });
  eq('(2) de andere relaties blijven gelijk', [lagFields(seqByPair(r, 'A', 'C')), lagFields(seqByPair(r, 'A', 'D'))],
    [{ lagDays: 0, lagMinutes: 240 }, { lagDays: 1.5, lagUnit: 'ELAPSEDTIME' }]);
  const elapsed = readIFC(patchLine(weekText, lagLineOf(weekText, guidOf('lag-ed')), "'PT36H0M0S'", "'PT30H0M0S'"));
  eq('(2) kalendertijd PT30H0M0S ⇒ 1800 kalenderminuten', lagFields(seqByPair(elapsed, 'A', 'D')),
    { lagDays: 0, lagMinutes: 1800, lagUnit: 'ELAPSEDTIME' });
  // Een record dat bij een relatie zonder `PT`-lag hoort (hand-gewijzigd naar `P1D`) telt ook niet.
  const days = readIFC(patchLine(weekText, lagLineOf(weekText, guidOf('lag-dagen')), "IFCDURATION('PT4H0M0S')", "IFCDURATION('P1D')"));
  eq('(2) P1D naast een record ⇒ 1 d, zoals zonder record', lagFields(seqByPair(days, 'A', 'B')), { lagDays: 1 });
}

// ── (3) De opvolgertijden na IFC ⇒ OPS (hangt af van de motor, deel 1) ────────────────────────────
const startOf = (p: DocumentPayload, name: string) => p.tasks.find(t => t.name === name)?.time.earlyStart;
function solvedAfterIfc(text: string): DocumentPayload {
  return prepareLoadedPayload(payloadFromImport(readIFC(text), null), { recompute: true });
}
{
  const solved = solvedAfterIfc(weekText);
  eq('(3) A eindigt do 4 jun 16:00', solved.tasks.find(t => t.name === 'A')?.time.earlyFinish, '2026-06-04T16:00');
  // B2: tussenstand. F3c-motor → doel: B (0,5 d dagenmaat = de helft van de vrijdag van 6 u) start
  // vr 5 jun 10:00 (spec §3.3). Zonder de lopers van de dagenmaat telt de motor 0,5 d nog als 4 u.
  eq('(3) B na FS 0,5 d dagenmaat (B2: F3c-motor → doel vr 10:00)', startOf(solved, 'B'), '2026-06-05T11:00');
  eq('(3) C na FS 240 min urenmaat: vr 11:00', startOf(solved, 'C'), '2026-06-05T11:00');
  const changed = solvedAfterIfc(changedLagText);
  eq('(3) gewijzigde lag: B na 360 min urenmaat start vr 14:00 → ma 07:00', startOf(changed, 'B'), '2026-06-08T07:00');
}

// ── (4) De maat in elk profiel ─────────────────────────────────────────────────────────────────────
{
  const p6 = weekPayload();
  p6.project = { ...p6.project, schedulingProfile: builtInProfile('p6') };
  const p6Text = writeIFC(buildWriteIFCInput(p6));
  const p6Read = readIFC(p6Text);
  const p6Guid = (id: string) => guidOfPair(p6Read, 'A', SUCCESSOR_OF[id]);
  const body = (text: string, guid: string) => lagLineOf(text, guid).replace(/^#\d+=/, '');
  eq('(4) onder P6: dezelfde lagregels (PT… = 0,5 d × 8 u, wat P6 rekent)',
    ['lag-dagen', 'lag-uren', 'lag-ed'].map(id => body(p6Text, p6Guid(id))),
    ['lag-dagen', 'lag-uren', 'lag-ed'].map(id => body(weekText, guidOf(id))));
  eq('(4) onder P6: dezelfde records (de maat blijft bewaard)', Object.values(dayMeasureLagsOf(p6Text)), [[0.5, 240], [1.5, 2160]]);
  eq('(4) onder P6: IFC ⇒ OPS dezelfde velden', ['B', 'C', 'D'].map(s => lagFields(seqByPair(p6Read, 'A', s))),
    [{ lagDays: 0.5 }, { lagDays: 0, lagMinutes: 240 }, { lagDays: 1.5, lagUnit: 'ELAPSEDTIME' }]);
  // OPS-profiel ⇒ P6-profiel ⇒ OPS-profiel, telkens door IFC.
  let doc = weekPayload();
  for (const base of ['p6', 'ops'] as const) {
    doc = payloadFromImport(readIFC(writeIFC(buildWriteIFCInput({
      ...doc, project: { ...doc.project, schedulingProfile: switchProfile(doc.project.schedulingProfile, base) },
    }))), null);
  }
  eq('(4) OPS ⇒ P6 ⇒ OPS door IFC: dezelfde velden', ['B', 'C', 'D'].map(s => lagFields(seqByPair(doc, 'A', s))),
    [{ lagDays: 0.5 }, { lagDays: 0, lagMinutes: 240 }, { lagDays: 1.5, lagUnit: 'ELAPSEDTIME' }]);
  const solvedP6 = prepareLoadedPayload(payloadFromImport(p6Read, null), { recompute: true });
  // Onder P6 telt een lag in dagenmaat als urenmaat (§3.3): 0,5 d × 8 u = 4 u.
  eq('(4) onder P6: B en C allebei vr 11:00', [startOf(solvedP6, 'B'), startOf(solvedP6, 'C')], ['2026-06-05T11:00', '2026-06-05T11:00']);
}

// ── (5) De lagkalender bepaalt de minuten ──────────────────────────────────────────────────────────
{
  const TEN: WorkTimeBands = { byWeekday: { 1: [{ start: 420, end: 1020 }], 2: [{ start: 420, end: 1020 }], 3: [{ start: 420, end: 1020 }], 4: [{ start: 420, end: 1020 }], 5: [{ start: 420, end: 1020 }], 6: [], 7: [] } };
  const tenCal: WorkCalendar = {
    id: 'cal-tien', name: 'Tien uur', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 17,
    hoursPerDay: 10, holidays: [], workTime: TEN,
  };
  const cases: [string, NonNullable<DocumentPayload['project']['schedulingOptions']>['lagCalendar'], string][] = [
    ['voorganger (standaard)', undefined, 'PT4H0M0S'],
    ['opvolger op een kalender van 10 u', 'successor', 'PT5H0M0S'],
    ['projectkalender', 'projectDefault', 'PT4H0M0S'],
    ['24 uur', '24hour', 'PT12H0M0S'],
  ];
  for (const [label, lagCalendar, want] of cases) {
    const p = weekPayload();
    p.calendars = [...p.calendars, tenCal];
    p.tasks = p.tasks.map(t => (t.name === 'B' ? { ...t, calendarId: tenCal.id } : t));
    p.project = { ...p.project, schedulingOptions: { ...p.project.schedulingOptions, ...(lagCalendar ? { lagCalendar } : {}) } };
    const text = writeIFC(buildWriteIFCInput(p));
    const r = readIFC(text);
    const guid = guidOfPair(r, 'A', 'B');
    eq(`(5) lagkalender ${label}: 0,5 d ⇒ ${want}`, lagLineOf(text, guid).includes(`'${want}'`), true);
    eq(`(5) lagkalender ${label}: record met dezelfde minuten`, dayMeasureLagsOf(text)[guid], [0.5, minutesOf(want)]);
    eq(`(5) lagkalender ${label}: IFC ⇒ OPS 0,5 d`, lagFields(seqByPair(r, 'A', 'B')), { lagDays: 0.5 });
  }
}

// ── (6) Duur, rest en werkelijke duur met een breuk ────────────────────────────────────────────────
function durationPayload(): DocumentPayload {
  const p = weekPayload();
  p.project = { ...p.project, statusDate: '2026-06-03' };
  p.sequences = [];
  p.tasks = [
    task('E', '2026-06-01T07:00', '2026-06-03T12:00', 2.5),
    // F: lopend op 100 % (P6 `TK_Active`): de import houdt dan de rest uit het bestand
    // (`normalizeImportedProgress`), zodat het rest-record zelf getoetst wordt.
    { ...task('F', '2026-06-01T07:00', '2026-06-03T16:00', 3, {
      completion: 1, actualStart: '2026-06-01T07:00', remainingTime: 1.5,
    }), status: 'STARTED' },
    // F2: een gewone lopende taak op 50 %; de import leidt de rest af uit het percentage.
    task('F2', '2026-06-01T07:00', '2026-06-03T16:00', 3, {
      completion: 0.5, actualStart: '2026-06-01T07:00', remainingTime: 1.5,
    }),
    task('G', '2026-06-01T07:00', '2026-06-02T19:00', 1.5, { durationType: 'ELAPSEDTIME' }),
    task('H', '2026-06-01T07:00', '2026-06-02T16:00', 2, {
      completion: 0.25, actualStart: '2026-06-01T07:00', actualDuration: 0.5, remainingTime: 2,
    }),
    task('I', '2026-06-01T07:00', '2026-06-02T09:00', 1.25, { durationUnit: 'hours', durationMinutes: 600 }),
    task('J', '2026-06-01T07:00', '2026-06-03T16:00', 3),
  ];
  return p;
}
const durationText = writeIFC(buildWriteIFCInput(durationPayload()));
const durationFields = (t: Task | undefined) => t && {
  durationUnit: t.time.durationUnit, durationType: t.time.durationType, scheduleDuration: t.time.scheduleDuration,
  durationMinutes: t.time.durationMinutes, remainingTime: t.time.remainingTime, remainingMinutes: t.time.remainingMinutes,
  actualDuration: t.time.actualDuration,
};
const byName = (r: { tasks: Task[] }, name: string) => r.tasks.find(t => t.name === name);
/** Het record `DayMeasureDurations` uit de `OPS_WorkRule`-pset van de taak met deze naam. */
function dayMeasureDurationsOf(text: string, name: string): unknown {
  const lines = new Map(text.split('\n').map(l => [l.match(/^(#\d+)=/)?.[1] ?? '', l] as const));
  const taskRef = [...lines].find(([, l]) => l.includes('=IFCTASK(') && l.includes(`,'${name}',`))?.[0];
  for (const line of lines.values()) {
    const psetRef = taskRef ? line.match(new RegExp(`^#\\d+=IFCRELDEFINESBYPROPERTIES\\(.*\\(${taskRef}\\),(#\\d+)\\);$`))?.[1] : undefined;
    const pset = psetRef ? lines.get(psetRef) : undefined;
    if (!pset?.includes("'OPS_WorkRule'")) continue;
    for (const ref of pset.match(/#\d+/g) ?? []) {
      const raw = lines.get(ref)?.match(/^#\d+=IFCPROPERTYSINGLEVALUE\('DayMeasureDurations',\$,IFCTEXT\('(.*)'\),\$\);$/)?.[1];
      if (raw) return JSON.parse(raw);
    }
  }
  return undefined;
}
{
  const read = readIFC(durationText);
  const loaded = payloadFromImport(read, null);
  const slot = (name: string, index: number) => taskTimeLine(durationText, name).replace(/^#\d+=IFCTASKTIME\(/, '').split(',')[index];
  // IfcTaskTime: 4 = ScheduleDuration, 15 = ActualDuration, 18 = RemainingTime.
  eq('(6) E: 2,5 d ⇒ PT20H0M0S', slot('E', 4), "'PT20H0M0S'");
  eq('(6) E: record', dayMeasureDurationsOf(durationText, 'E'), { ScheduleDuration: [2.5, 1200] });
  eq('(6) F: 3 d met 1,5 d rest ⇒ duur en rest als PT…', [slot('F', 4), slot('F', 18)], ["'PT24H0M0S'", "'PT12H0M0S'"]);
  eq('(6) F: records', dayMeasureDurationsOf(durationText, 'F'), { ScheduleDuration: [3, 1440], RemainingTime: [1.5, 720] });
  eq('(6) F2: zelfde vorm', [slot('F2', 4), slot('F2', 18), dayMeasureDurationsOf(durationText, 'F2')],
    ["'PT24H0M0S'", "'PT12H0M0S'", { ScheduleDuration: [3, 1440], RemainingTime: [1.5, 720] }]);
  eq('(6) G: 1,5 ed ⇒ PT36H0M0S met ELAPSEDTIME', [slot('G', 3), slot('G', 4)], ['.ELAPSEDTIME.', "'PT36H0M0S'"]);
  eq('(6) G: record in kalenderminuten', dayMeasureDurationsOf(durationText, 'G'), { ScheduleDuration: [1.5, 2160] });
  eq('(6) H: hele duur blijft P{n}D, werkelijke duur 0,5 d ⇒ PT4H0M0S', [slot('H', 4), slot('H', 15), slot('H', 18)],
    ["'P0Y0M2D'", "'PT4H0M0S'", "'P0Y0M2D'"]);
  eq('(6) H: record alleen voor de werkelijke duur', dayMeasureDurationsOf(durationText, 'H'), { ActualDuration: [0.5, 240] });
  eq('(6) I: urenmaat zonder record', [slot('I', 4), dayMeasureDurationsOf(durationText, 'I')], ["'PT10H0M0S'", undefined]);
  eq('(6) J: hele dagen zonder record', [slot('J', 4), dayMeasureDurationsOf(durationText, 'J')], ["'P0Y0M3D'", undefined]);
  ok('(6) geen gebroken P…D in het bestand', !/'-?P(?:0Y0M)?-?\d+\.\d+D'/.test(durationText));
  const want: Record<string, unknown> = {
    E: { durationUnit: 'days', durationType: 'WORKTIME', scheduleDuration: 2.5 },
    F: { durationUnit: 'days', durationType: 'WORKTIME', scheduleDuration: 3, remainingTime: 1.5 },
    // B2: tussenstand. F3c-winkel → doel 1,5 d (B3, alleen uren §3.5: rest exact). De import leidt de
    // rest van een lopende dagtaak af uit het percentage (`applyRemainingDuration`, nu op hele dagen).
    F2: { durationUnit: 'days', durationType: 'WORKTIME', scheduleDuration: 3, remainingTime: 2 },
    G: { durationUnit: 'days', durationType: 'ELAPSEDTIME', scheduleDuration: 1.5 },
    H: { durationUnit: 'days', durationType: 'WORKTIME', scheduleDuration: 2, remainingTime: 2, actualDuration: 0.5 },
    I: { durationUnit: 'hours', durationType: 'WORKTIME', scheduleDuration: 1.25, durationMinutes: 600 },
    J: { durationUnit: 'days', durationType: 'WORKTIME', scheduleDuration: 3 },
  };
  for (const name of Object.keys(want)) {
    eq(`(6) ${name}: IFC ⇒ OPS dezelfde velden (lezer)`, durationFields(byName(read, name)), want[name]);
    eq(`(6) ${name}: IFC ⇒ OPS dezelfde velden (na de laadgrens)`, durationFields(byName(loaded, name)), want[name]);
  }
  const again = writeIFC(buildWriteIFCInput(loaded));
  eq('(6) tweede ronde: dezelfde IfcTaskTime-duren', ['E', 'F', 'G', 'H'].map(n => [4, 15, 18].map(i => taskTimeLine(again, n).replace(/^#\d+=IFCTASKTIME\(/, '').split(',')[i])),
    ['E', 'F', 'G', 'H'].map(n => [4, 15, 18].map(i => slot(n, i))));
}

// ── (7) Een gewijzigde duur of rest: het standaardveld wint ────────────────────────────────────────
{
  const e = readIFC(patchLine(durationText, taskTimeLine(durationText, 'E'), "'PT20H0M0S'", "'PT22H0M0S'"));
  eq('(7) duur PT20H ⇒ PT22H: urenmaat 1320 min, het record telt niet',
    [byName(e, 'E')?.time.durationUnit, byName(e, 'E')?.time.durationMinutes], ['hours', 1320]);
  const f = readIFC(patchLine(durationText, taskTimeLine(durationText, 'F'), "'PT12H0M0S'", "'PT10H0M0S'"));
  eq('(7) rest PT12H ⇒ PT10H: dagenmaat blijft, rest = 600 ÷ 480 = 1,25 d',
    [byName(f, 'F')?.time.durationUnit, byName(f, 'F')?.time.scheduleDuration, byName(f, 'F')?.time.remainingTime, byName(f, 'F')?.time.remainingMinutes],
    ['days', 3, 1.25, undefined]);
  const fDur = readIFC(patchLine(durationText, taskTimeLine(durationText, 'F'), "'PT24H0M0S'", "'PT26H0M0S'"));
  eq('(7) duur van F gewijzigd: urenmaat, de rest in minuten (het rest-record telt dan niet)',
    [byName(fDur, 'F')?.time.durationUnit, byName(fDur, 'F')?.time.durationMinutes, byName(fDur, 'F')?.time.remainingMinutes],
    ['hours', 1560, 720]);
  const g = readIFC(patchLine(durationText, taskTimeLine(durationText, 'G'), "'PT36H0M0S'", "'PT30H0M0S'"));
  eq('(7) kalendertijd PT36H ⇒ PT30H: 1800 kalenderminuten in de urenmaat',
    [byName(g, 'G')?.time.durationUnit, byName(g, 'G')?.time.durationType, byName(g, 'G')?.time.durationMinutes], ['hours', 'ELAPSEDTIME', 1800]);
  const h = readIFC(patchLine(durationText, taskTimeLine(durationText, 'H'), "'PT4H0M0S'", "'PT6H0M0S'"));
  eq('(7) werkelijke duur PT4H ⇒ PT6H: 360 ÷ 480 = 0,75 d', byName(h, 'H')?.time.actualDuration, 0.75);
}

// ── (8) Speling (T5): hele dagen in IfcTaskTime, exacte dagen en minuten in OPS_Analysis ──────────
{
  const p = durationPayload();
  p.tasks = [
    task('S1', '2026-06-01T07:00', '2026-06-01T16:00', 1, { totalFloat: 2.5, totalFloatMinutes: 1200, freeFloat: 0.75, freeFloatMinutes: 360 }),
    task('S2', '2026-06-01T07:00', '2026-06-01T16:00', 1, { totalFloat: 2, totalFloatMinutes: 960, freeFloat: 0, freeFloatMinutes: 0 }),
    task('S3', '2026-06-01T07:00', '2026-06-01T16:00', 1, { totalFloat: -1.5, freeFloat: 0 }),
    task('S4', '2026-06-01T07:00', '2026-06-01T16:00', 1, { totalFloat: 3, freeFloat: 1 }),
  ];
  const text = writeIFC(buildWriteIFCInput(p));
  const slot = (name: string, index: number) => taskTimeLine(text, name).replace(/^#\d+=IFCTASKTIME\(/, '').split(',')[index];
  // IfcTaskTime: 11 = FreeFloat, 12 = TotalFloat.
  eq('(8) slots in hele dagen (afgerond)', ['S1', 'S2', 'S3', 'S4'].map(n => [slot(n, 12), slot(n, 11)]), [
    ["'P0Y0M3D'", "'P0Y0M1D'"], ["'P0Y0M2D'", "'P0Y0M0D'"], ["'-P0Y0M1D'", "'P0Y0M0D'"], ["'P0Y0M3D'", "'P0Y0M1D'"],
  ]);
  ok('(8) geen gebroken P…D in het bestand', !/'-?P(?:0Y0M)?-?\d+\.\d+D'/.test(text));
  const floats = (r: { tasks: Task[] }, name: string) => {
    const t = byName(r, name)?.time;
    return t && [t.totalFloat, t.totalFloatMinutes, t.freeFloat, t.freeFloatMinutes];
  };
  const read = readIFC(text);
  eq('(8) S1: exacte dagen en minuten terug', floats(read, 'S1'), [2.5, 1200, 0.75, 360]);
  eq('(8) S2: hele dagen met minuten terug', floats(read, 'S2'), [2, 960, 0, 0]);
  eq('(8) S3: negatieve breuk zonder minuten terug', floats(read, 'S3'), [-1.5, undefined, 0, undefined]);
  eq('(8) S4: hele dagen zonder minuten: geen record, geen minuten', floats(read, 'S4'), [3, undefined, 1, undefined]);
  eq('(8) records alleen waar nodig (S4 krijgt geen OPS_Analysis)', (text.match(/'ExactFloat'/g) ?? []).length, 3);
  eq('(8) ook na de laadgrens', floats(payloadFromImport(read, null), 'S1'), [2.5, 1200, 0.75, 360]);
  // Een ander programma wijzigt het standaardveld: dan geldt dat, zonder minuten.
  const stale = readIFC(patchLine(text, taskTimeLine(text, 'S1'), "'P0Y0M3D'", "'P0Y0M4D'"));
  eq('(8) gewijzigde TotalFloat: het slot wint, het record telt niet', floats(stale, 'S1'), [4, undefined, 0.75, 360]);
  // "Datums zoals opgeslagen": een achtergehouden slot krijgt `$` en ook geen record.
  const withheld = writeIFC({ ...buildWriteIFCInput(p), withheldTaskTimeFields: { [p.tasks[0].id]: ['totalFloat'] } });
  const wSlot = taskTimeLine(withheld, 'S1').replace(/^#\d+=IFCTASKTIME\(/, '').split(',');
  eq('(8) achtergehouden TotalFloat: $ en geen TotalFloat-record', [wSlot[12], /"TotalFloat"/.test(withheld.split('\n').find(l => l.includes("'ExactFloat'") && l.includes('0.75')) ?? '')], ['$', false]);
}

// ── (9) Een dagenmaat-taak met een breuk maakt een scalaire kalender letterlijk; die blijft scalair ─
{
  const p = freshPayload();
  p.project = { ...p.project, startDate: '2026-06-01' };
  p.calendar = { ...p.calendar, holidays: [] };
  p.calendars = p.calendars.map(c => (c.id === p.calendar.id ? p.calendar : c));
  p.tasks = [task('K', '2026-06-01T07:00', '2026-06-03T12:00', 2.5)];
  const hashBefore = computeCalendarHash(p.calendar);
  const text = writeIFC(buildWriteIFCInput(p));
  ok('(9) de kalender is letterlijk (LiteralTimes)', text.includes("'LiteralTimes'"));
  ok('(9) de kalender is als scalair gemarkeerd (IsHourCalendar .F.)', text.includes("IFCPROPERTYSINGLEVALUE('IsHourCalendar',$,IFCBOOLEAN(.F.),$)"));
  const back = payloadFromImport(readIFC(text), null);
  eq('(9) de kalender blijft scalair', back.calendar.workTime, undefined);
  eq('(9) de kalenderhash verandert niet door opslaan', computeCalendarHash(p.calendar), hashBefore);
  eq('(9) K komt terug als 2,5 d dagenmaat met de eigen tijden', [durationFields(byName(back, 'K')), byName(back, 'K')?.time.earlyFinish],
    [{ durationUnit: 'days', durationType: 'WORKTIME', scheduleDuration: 2.5 }, '2026-06-03T12:00']);
}

// Bestanden voor de lezervergelijking `check-minute-model-compat.ts` (zie tests/planning/README.md):
// D0 = de voorbeeldweek met de drie lagvormen, D1 = de duren met een breuk plus de spelingen van (8).
// F (lopend op 100 %) blijft eruit: v2026.9.0 maakt die taak voltooid (#357), los van de dagenmaat.
{
  const compatOut = process.env.OPS_MINUTE_MODEL_COMPAT_OUT;
  if (compatOut) {
    const p = durationPayload();
    p.tasks = [
      ...p.tasks.filter(t => t.name !== 'F'),
      task('S1', '2026-06-01T07:00', '2026-06-01T16:00', 1, { totalFloat: 2.5, totalFloatMinutes: 1200, freeFloat: 0.75, freeFloatMinutes: 360 }),
      task('S3', '2026-06-01T07:00', '2026-06-01T16:00', 1, { totalFloat: -1.5, freeFloat: 0 }),
    ];
    mkdirSync(compatOut, { recursive: true });
    writeFileSync(join(compatOut, 'D0.ifc'), weekText);
    writeFileSync(join(compatOut, 'D1.ifc'), writeIFC(buildWriteIFCInput(p)));
  }
}

// ── (10) De lezer van v2026.9.0 ───────────────────────────────────────────────────────────────────
async function oldReaderChecks(): Promise<void> {
  const reader = process.env.OPS_MINUTE_MODEL_OLD_READER;
  if (!reader) { console.log('Lezer van v2026.9.0: niet gemeten (OPS_MINUTE_MODEL_OLD_READER ontbreekt).'); return; }
  const old = await import(pathToFileURL(reader).href) as { readIFC: (text: string) => ImportResult };
  const lags = old.readIFC(weekText);
  eq('(10) v2026.9.0: FS 0,5 d dagenmaat ⇒ 240 min (geen 5 dagen)', lagFields(seqByPair(lags, 'A', 'B')), { lagDays: 0, lagMinutes: 240 });
  eq('(10) v2026.9.0: FS 240 min urenmaat', lagFields(seqByPair(lags, 'A', 'C')), { lagDays: 0, lagMinutes: 240 });
  eq('(10) v2026.9.0: FS 1,5 ed ⇒ 2160 kalenderminuten (geen 5 dagen)', lagFields(seqByPair(lags, 'A', 'D')),
    { lagDays: 0, lagMinutes: 2160, lagUnit: 'ELAPSEDTIME' });
  eq('(10) v2026.9.0: gewijzigde lag ⇒ 360 min', lagFields(seqByPair(old.readIFC(changedLagText), 'A', 'B')), { lagDays: 0, lagMinutes: 360 });
  const durations = old.readIFC(durationText);
  const t = (name: string) => byName(durations, name)?.time;
  eq('(10) v2026.9.0: E = urentaak van 1200 min (geen 5 dagen)', [t('E')?.durationUnit, t('E')?.durationMinutes], ['hours', 1200]);
  eq('(10) v2026.9.0: F = urentaak van 1440 min met 720 min rest', [t('F')?.durationUnit, t('F')?.durationMinutes, t('F')?.remainingMinutes],
    ['hours', 1440, 720]);
  eq('(10) v2026.9.0: G = kalendertijd-urentaak van 2160 min', [t('G')?.durationUnit, t('G')?.durationType, t('G')?.durationMinutes],
    ['hours', 'ELAPSEDTIME', 2160]);
  eq('(10) v2026.9.0: J blijft een gewone dagtaak van 3 d', [t('J')?.durationUnit, t('J')?.scheduleDuration], ['days', 3]);
  // De werkelijke duur kent in v2026.9.0 alleen hele dagen: `PT4H0M0S` wordt ceil(4 ÷ 8) = 1 d (geen 5).
  eq('(10) v2026.9.0: werkelijke duur 0,5 d ⇒ 1 d (afgerond, geen 5)', t('H')?.actualDuration, 1);
  const p = durationPayload();
  p.tasks = [task('S1', '2026-06-01T07:00', '2026-06-01T16:00', 1, { totalFloat: 2.5, totalFloatMinutes: 1200, freeFloat: 0.75, freeFloatMinutes: 360 })];
  const s1 = byName(old.readIFC(writeIFC(buildWriteIFCInput(p))), 'S1')?.time;
  eq('(10) v2026.9.0: speling 2,5 d ⇒ 3 d, 0,75 d ⇒ 1 d (afgerond, geen 5)', [s1?.totalFloat, s1?.freeFloat], [3, 1]);

  // Geen dag kwijt in de tijd: v2026.9.0 leest elke datum van elke taak gelijk aan de nieuwe lezer
  // (de kalender is letterlijk, §3.6). Zelfde vergelijking als check-minute-model-compat.ts.
  const DATE_FIELDS = ['scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'actualStart', 'actualFinish'] as const;
  for (const [label, text] of [['week', weekText], ['duren', durationText]] as const) {
    const now = readIFC(text), before = old.readIFC(text);
    eq(`(10) v2026.9.0 ${label}: zelfde aantal taken`, before.tasks.length, now.tasks.length);
    for (const nowTask of now.tasks) {
      const got = byName(before, nowTask.name)?.time;
      for (const field of DATE_FIELDS) {
        // F loopt op 100 % (`IfcTask.Status` 'STARTED'). v2026.9.0 kent die vorm niet en maakt F voltooid,
        // met een werkelijk einde: bekend en besloten (#357, docs/ifc-round-trip.md "Lopend op 100 %"),
        // los van de dagenmaat.
        if (nowTask.name === 'F' && field === 'actualFinish') continue;
        const want = nowTask.time[field];
        const trim = (s: string | undefined) => s?.slice(0, want?.includes('T') ? 16 : 10);
        eq(`(10) v2026.9.0 ${label}: ${nowTask.name} ${field}`, trim(got?.[field]), trim(want));
      }
    }
  }
}

void oldReaderChecks().then(() => {
  if (errors.length === 0) {
    console.log(`OK  ifc-dagenmaat: alle checks groen (${checks})`);
    process.exit(0);
  }
  console.log(`XX  ifc-dagenmaat: ${errors.length} afwijking(en) van ${checks}`);
  for (const e of errors) console.log(`   - ${e}`);
  process.exit(1);
}, (error: unknown) => {
  console.error(error);
  process.exit(1);
});
