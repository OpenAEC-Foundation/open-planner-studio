// F5a-2: MSPDI en P6 XML dragen dagenmaat, rest en lag verliesvrij (spec
// `docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §3.3, §3.10, §3.11; T13, T14, T21).
//
// Wat deze check vastlegt, voor beide formaten:
//  (1) de voorbeeldweek met drie relaties naast elkaar (FS 0,5 d dagenmaat, FS 240 min urenmaat,
//      FS 1,5 ed): het standaardveld, de records in `OPS_DayMeasureLags`, OPS ⇒ bestand ⇒ OPS met dezelfde
//      velden, de opvolgers vr 10:00 en vr 11:00, en een tweede ronde met dezelfde bytes;
//  (2) een gewijzigde lag in het standaardveld: urenmaat, het record telt niet;
//  (3) onder het P6-profiel dezelfde bytes en velden, en B en C allebei vr 11:00;
//  (4) twee relaties tussen hetzelfde paar (SS + 0,5 d, FF + 0,25 d): elk een eigen record;
//  (5) de lagkalender bepaalt de minuten (voorganger, opvolger, project, 24 uur);
//  (6) duur en rest met een breuk (2,5 d met 1,5 d rest), 3 d met 1 d rest bij een afgerond percentage,
//      kalendertijd (MSPDI), en een gewijzigde duur of rest;
//  (7) de urenmaat zonder afronding: een breuk in minuten via `OPS_ExactMinutes`;
//  (8) T13: een dag is de werktijd per dag, ook als de opgeslagen uren per dag afwijken; een ouder bestand
//      zonder de nieuwe definities leest met de opgeslagen uren per dag;
//  (9) knownbug 256 (MSPDI-deel): een kale planningsstart op een letterlijke kalender 09:00–17:00 wordt 09:00.
//
// Draait via run.sh (esbuild-bundel). Alleen de exitcode telt.
import './domStub';
import { installDOMParser } from './xmldom-shim';
import { freshPayload, payloadFromImport, type DocumentPayload } from '@/state/documentContract';
import { prepareLoadedPayload } from '@/state/documentActivation';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ImportResult } from '@/services/importTypes';
import type { Task, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

installDOMParser();
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
/** De writers melden verliezen via console.warn; die horen niet bij deze check. */
function quiet<T>(fn: () => T): T {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
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

const decode = (raw: string): string => raw.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&amp;/g, '&');

type Format = {
  name: string;
  write: (p: DocumentPayload) => string;
  read: (text: string) => ImportResult;
  /** Het blok van de taak met deze naam. */
  block: (text: string, name: string) => string;
  /** Het OPS-record van een soort ('durations' | 'exact' | 'lags') op de taak met deze naam, als JSON. */
  record: (text: string, name: string, kind: RecordKind) => unknown;
  /** De lag in het standaardveld van de relatie naar deze opvolger (MSPDI `LinkLag/LagFormat`, P6 `Lag`). */
  lagOf: (text: string, pred: string, succ: string, type?: string) => string;
  /** Vervang de lag in het standaardveld van de relatie naar deze opvolger. */
  patchLag: (text: string, pred: string, succ: string, to: string) => string;
  /** Duur en rest in het standaardveld van de taak. */
  durationOf: (text: string, name: string) => [string | undefined, string | undefined];
  /** Vervang een standaardveld (`Duration`/`RemainingDuration` of `PlannedDuration`/`RemainingDuration`). */
  patchField: (text: string, name: string, field: 'duration' | 'remaining', to: string) => string;
};
type RecordKind = 'durations' | 'exact' | 'lags';

const MSP_FIELD: Record<RecordKind, string> = { durations: '188744014', exact: '188744013', lags: '188744012' };
const P6_UDF: Record<RecordKind, string> = { durations: '900000003', exact: '900000004', lags: '900000005' };

const mspBlock = (text: string, name: string): string =>
  text.split('<Task>').slice(1).map(b => b.split('</Task>')[0]).find(b => b.includes(`<Name>${name}</Name>`)) ?? '';
const mspUid = (text: string, name: string): string => mspBlock(text, name).match(/<UID>(\d+)<\/UID>/)?.[1] ?? '';
const MSP_TYPE: Record<string, string> = { FF: '0', FS: '1', SF: '2', SS: '3' };
function mspLink(text: string, pred: string, succ: string, type = 'FS'): string {
  const uid = mspUid(text, pred);
  return mspBlock(text, succ).split('<PredecessorLink>').slice(1).map(l => l.split('</PredecessorLink>')[0])
    .find(l => l.includes(`<PredecessorUID>${uid}</PredecessorUID>`) && l.includes(`<Type>${MSP_TYPE[type]}</Type>`)) ?? '';
}
const MSPDI: Format = {
  name: 'MSPDI',
  write: p => quiet(() => writeMSPDI(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments, p.calendars,
    p.baselines, p.activeBaselineId, p.customTaskTypes)),
  read: text => quiet(() => readMSPDI(text)),
  block: mspBlock,
  record: (text, name, kind) => {
    const raw = mspBlock(text, name).match(new RegExp(`<ExtendedAttribute>\\s*<FieldID>${MSP_FIELD[kind]}</FieldID>\\s*<Value>([^<]*)</Value>`))?.[1];
    return raw === undefined ? undefined : JSON.parse(decode(raw));
  },
  lagOf: (text, pred, succ, type) => {
    const link = mspLink(text, pred, succ, type);
    return `${link.match(/<LinkLag>(-?\d+)<\/LinkLag>/)?.[1]}/${link.match(/<LagFormat>(\d+)<\/LagFormat>/)?.[1]}`;
  },
  patchLag: (text, pred, succ, to) => {
    const link = mspLink(text, pred, succ);
    ok(`opzet MSPDI: relatie ${pred} → ${succ} gevonden`, link.length > 0);
    return text.replace(link, link.replace(/<LinkLag>-?\d+<\/LinkLag>/, `<LinkLag>${to}</LinkLag>`));
  },
  durationOf: (text, name) => {
    const b = mspBlock(text, name);
    return [b.match(/<Duration>([^<]*)<\/Duration>/)?.[1], b.match(/<RemainingDuration>([^<]*)<\/RemainingDuration>/)?.[1]];
  },
  patchField: (text, name, field, to) => {
    const b = mspBlock(text, name);
    const tag = field === 'duration' ? 'Duration' : 'RemainingDuration';
    ok(`opzet MSPDI: ${tag} van ${name} gevonden`, new RegExp(`<${tag}>`).test(b));
    return text.replace(b, b.replace(new RegExp(`<${tag}>[^<]*</${tag}>`), `<${tag}>${to}</${tag}>`));
  },
};

const p6Block = (text: string, name: string): string =>
  text.split('<Activity>').slice(1).map(b => b.split('</Activity>')[0]).find(b => b.includes(`<Name>${name}</Name>`)) ?? '';
const p6ObjectId = (text: string, name: string): string => p6Block(text, name).match(/<ObjectId>(\d+)<\/ObjectId>/)?.[1] ?? '';
const P6_TYPE: Record<string, string> = { FF: 'Finish to Finish', FS: 'Finish to Start', SF: 'Start to Finish', SS: 'Start to Start' };
function p6Relationship(text: string, pred: string, succ: string, type = 'FS'): string {
  const [p, s] = [p6ObjectId(text, pred), p6ObjectId(text, succ)];
  return (text.match(/<Relationship>[\s\S]*?<\/Relationship>/g) ?? []).find(r =>
    r.includes(`<PredecessorActivityObjectId>${p}</PredecessorActivityObjectId>`)
    && r.includes(`<SuccessorActivityObjectId>${s}</SuccessorActivityObjectId>`) && r.includes(`<Type>${P6_TYPE[type]}</Type>`)) ?? '';
}
const P6XML: Format = {
  name: 'P6 XML',
  write: p => quiet(() => writeP6XML(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments, p.calendars,
    p.customTaskTypes)),
  read: text => quiet(() => readP6XML(text)),
  block: p6Block,
  record: (text, name, kind) => {
    const raw = p6Block(text, name).match(new RegExp(`<UDF>\\s*<TypeObjectId>${P6_UDF[kind]}</TypeObjectId>\\s*<TextValue>([^<]*)</TextValue>`))?.[1];
    return raw === undefined ? undefined : JSON.parse(decode(raw));
  },
  lagOf: (text, pred, succ, type) => p6Relationship(text, pred, succ, type).match(/<Lag>(-?[\d.]+)<\/Lag>/)?.[1] ?? '(geen)',
  patchLag: (text, pred, succ, to) => {
    const rel = p6Relationship(text, pred, succ);
    ok(`opzet P6: relatie ${pred} → ${succ} gevonden`, rel.length > 0);
    return text.replace(rel, rel.replace(/<Lag>-?[\d.]+<\/Lag>/, `<Lag>${to}</Lag>`));
  },
  durationOf: (text, name) => {
    const b = p6Block(text, name);
    return [b.match(/<PlannedDuration>([^<]*)<\/PlannedDuration>/)?.[1], b.match(/<RemainingDuration>([^<]*)<\/RemainingDuration>/)?.[1]];
  },
  patchField: (text, name, field, to) => {
    const b = p6Block(text, name);
    const tag = field === 'duration' ? 'PlannedDuration' : 'RemainingDuration';
    ok(`opzet P6: ${tag} van ${name} gevonden`, new RegExp(`<${tag}>`).test(b));
    return text.replace(b, b.replace(new RegExp(`<${tag}>[^<]*</${tag}>`), `<${tag}>${to}</${tag}>`));
  },
};

const lagFields = (s: Sequence | undefined) => s && { lagDays: s.lagDays, lagMinutes: s.lagMinutes, lagUnit: s.lagUnit, lagPercent: s.lagPercent };
function seqByPair(r: { sequences: Sequence[]; tasks: Task[] }, pred: string, succ: string, type?: Sequence['type']): Sequence | undefined {
  const name = new Map(r.tasks.map(t => [t.id, t.name]));
  return r.sequences.find(s => name.get(s.predecessorId) === pred && name.get(s.successorId) === succ && (!type || s.type === type));
}
const byName = (r: { tasks: Task[] }, name: string) => r.tasks.find(t => t.name === name);
const startOf = (p: DocumentPayload, name: string) => byName(p, name)?.time.earlyStart;
const load = (r: ImportResult): DocumentPayload => payloadFromImport(r, null);
const solve = (p: DocumentPayload): DocumentPayload => prepareLoadedPayload(p, { recompute: true });
const withProfile = (p: DocumentPayload, base: 'p6' | 'ops'): DocumentPayload =>
  ({ ...p, project: { ...p.project, schedulingProfile: builtInProfile(base) } });

const WEEK_WANT = [{ lagDays: 0.5 }, { lagDays: 0, lagMinutes: 240 }, { lagDays: 1.5, lagUnit: 'ELAPSEDTIME' }];
const weekFields = (r: { sequences: Sequence[]; tasks: Task[] }) => ['B', 'C', 'D'].map(s => lagFields(seqByPair(r, 'A', s)));

for (const fmt of [MSPDI, P6XML]) {
  const tag = fmt.name;
  const isMsp = fmt === MSPDI;

  // ── (1) De voorbeeldweek: drie relaties naast elkaar ─────────────────────────────────────────────
  const weekText = fmt.write(weekPayload());
  const weekRead = fmt.read(weekText);
  {
    // Het standaardveld draagt de lengte: 0,5 d × 8 u (werktijd per dag van de voorganger) = 240 min,
    // 240 min, en 1,5 ed. MSPDI: `LinkLag` in tienden van minuten, met `LagFormat` 7 (d) of 8 (ed). P6 kent
    // geen kalendertijd per relatie: 1,5 ed gaat als 1,5 werkdag (12 u), het record bewaart de maat.
    eq(`(1) ${tag}: standaardvelden`, ['B', 'C', 'D'].map(s => fmt.lagOf(weekText, 'A', s)),
      isMsp ? ['2400/7', '2400/7', '21600/8'] : ['4', '4', '12']);
    eq(`(1) ${tag}: record voor de dagenmaat-lag`, Object.values(fmt.record(weekText, 'B', 'lags') as object ?? {}), [[0.5, 240]]);
    eq(`(1) ${tag}: geen record voor de urenmaat-lag`, fmt.record(weekText, 'C', 'lags'), undefined);
    eq(`(1) ${tag}: kalendertijd`, fmt.record(weekText, 'D', 'lags') && Object.values(fmt.record(weekText, 'D', 'lags') as object),
      isMsp ? undefined : [[1.5, 720, 'ed']]);
    const key = Object.keys(fmt.record(weekText, 'B', 'lags') as object ?? {})[0];
    eq(`(1) ${tag}: de sleutel is voorganger plus type`, key, `${isMsp ? mspUid(weekText, 'A') : p6ObjectId(weekText, 'A')}:FS`);
    eq(`(1) ${tag} ⇒ OPS: dezelfde velden`, weekFields(weekRead), WEEK_WANT);
    const loaded = load(weekRead);
    eq(`(1) ${tag}: ook na de laadgrens`, weekFields(loaded), WEEK_WANT);
    const solved = solve(load(fmt.read(weekText)));
    eq(`(1) ${tag}: A eindigt do 4 jun 16:00`, byName(solved, 'A')?.time.earlyFinish, '2026-06-04T16:00');
    // B: 0,5 d dagenmaat is de helft van de vrijdag van 6 u (3 u); C: 240 min urenmaat is 4 u.
    eq(`(1) ${tag}: B na FS 0,5 d dagenmaat vr 10:00, C na FS 240 min vr 11:00`,
      [startOf(solved, 'B'), startOf(solved, 'C')], ['2026-06-05T10:00', '2026-06-05T11:00']);
    const again = fmt.write(loaded);
    eq(`(1) ${tag}: tweede ronde dezelfde standaardvelden en records`,
      [['B', 'C', 'D'].map(s => fmt.lagOf(again, 'A', s)), ['B', 'C', 'D'].map(s => fmt.record(again, s, 'lags'))],
      [['B', 'C', 'D'].map(s => fmt.lagOf(weekText, 'A', s)), ['B', 'C', 'D'].map(s => fmt.record(weekText, s, 'lags'))]);
    eq(`(1) ${tag}: tweede ronde dezelfde velden`, weekFields(fmt.read(again)), WEEK_WANT);
  }

  // ── (2) Een gewijzigde lag in het standaardveld ─────────────────────────────────────────────────
  {
    const changed = fmt.patchLag(weekText, 'A', 'B', isMsp ? '3600' : '6');
    const r = fmt.read(changed);
    eq(`(2) ${tag}: 360 min urenmaat, het record telt niet`, lagFields(seqByPair(r, 'A', 'B')), { lagDays: 0, lagMinutes: 360 });
    eq(`(2) ${tag}: de andere relaties blijven gelijk`, weekFields(r).slice(1), WEEK_WANT.slice(1));
    eq(`(2) ${tag}: B na 360 min urenmaat: vr 14:00 → ma 07:00`, startOf(solve(load(r)), 'B'), '2026-06-08T07:00');
    // De kalendertijd-lag gewijzigd. MSPDI: `LagFormat` 8 zegt de eenheid, zonder afronding (I2). P6: het
    // record telt niet, en P6 rekent `Lag` in werktijd.
    const elapsed = fmt.read(fmt.patchLag(weekText, 'A', 'D', isMsp ? '18000' : '10'));
    eq(`(2) ${tag}: gewijzigde kalendertijd-lag`, lagFields(seqByPair(elapsed, 'A', 'D')),
      isMsp ? { lagDays: 1.25, lagUnit: 'ELAPSEDTIME' } : { lagDays: 0, lagMinutes: 600 });
  }

  // ── (3) Onder het P6-profiel ─────────────────────────────────────────────────────────────────────
  {
    const p6Text = fmt.write(withProfile(weekPayload(), 'p6'));
    eq(`(3) ${tag} onder P6: dezelfde standaardvelden en records`,
      [['B', 'C', 'D'].map(s => fmt.lagOf(p6Text, 'A', s)), ['B', 'C', 'D'].map(s => fmt.record(p6Text, s, 'lags'))],
      [['B', 'C', 'D'].map(s => fmt.lagOf(weekText, 'A', s)), ['B', 'C', 'D'].map(s => fmt.record(weekText, s, 'lags'))]);
    const read = fmt.read(p6Text);
    eq(`(3) ${tag} onder P6: dezelfde velden`, weekFields(read), WEEK_WANT);
    const solvedP6 = solve(withProfile(load(read), 'p6'));
    // Onder P6 telt een lag in dagenmaat als urenmaat (§3.3): 0,5 d × 8 u = 4 u.
    eq(`(3) ${tag} onder P6: B en C allebei vr 11:00`, [startOf(solvedP6, 'B'), startOf(solvedP6, 'C')],
      ['2026-06-05T11:00', '2026-06-05T11:00']);
    // OPS ⇒ P6-profiel ⇒ OPS-profiel, telkens door het formaat.
    let doc = weekPayload();
    for (const base of ['p6', 'ops'] as const) doc = load(fmt.read(fmt.write(withProfile(doc, base))));
    eq(`(3) ${tag}: OPS ⇒ P6 ⇒ OPS dezelfde velden`, weekFields(doc), WEEK_WANT);
  }

  // ── (4) Twee relaties tussen hetzelfde paar ──────────────────────────────────────────────────────
  {
    const p = weekPayload();
    p.sequences = [
      { id: 'ss', predecessorId: 'A', successorId: 'B', type: 'START_START', lagDays: 0.5 },
      { id: 'ff', predecessorId: 'A', successorId: 'B', type: 'FINISH_FINISH', lagDays: 0.25 },
    ];
    const text = fmt.write(p);
    const pred = isMsp ? mspUid(text, 'A') : p6ObjectId(text, 'A');
    eq(`(4) ${tag}: elk een eigen record`, fmt.record(text, 'B', 'lags'), { [`${pred}:SS`]: [0.5, 240], [`${pred}:FF`]: [0.25, 120] });
    eq(`(4) ${tag}: standaardvelden`, [fmt.lagOf(text, 'A', 'B', 'SS'), fmt.lagOf(text, 'A', 'B', 'FF')],
      isMsp ? ['2400/7', '1200/7'] : ['4', '2']);
    const r = fmt.read(text);
    eq(`(4) ${tag} ⇒ OPS`, [lagFields(seqByPair(r, 'A', 'B', 'START_START')), lagFields(seqByPair(r, 'A', 'B', 'FINISH_FINISH'))],
      [{ lagDays: 0.5 }, { lagDays: 0.25 }]);
  }

  // ── (5) De lagkalender bepaalt de minuten ───────────────────────────────────────────────────────
  {
    const TEN: WorkTimeBands = { byWeekday: { 1: [{ start: 420, end: 1020 }], 2: [{ start: 420, end: 1020 }], 3: [{ start: 420, end: 1020 }], 4: [{ start: 420, end: 1020 }], 5: [{ start: 420, end: 1020 }], 6: [], 7: [] } };
    const tenCal: WorkCalendar = {
      id: 'cal-tien', name: 'Tien uur', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 17,
      hoursPerDay: 10, holidays: [], workTime: TEN,
    };
    const cases: [string, NonNullable<DocumentPayload['project']['schedulingOptions']>['lagCalendar'], number][] = [
      ['voorganger (standaard)', undefined, 240], ['opvolger op een kalender van 10 u', 'successor', 300],
      ['projectkalender', 'projectDefault', 240], ['24 uur', '24hour', 720],
    ];
    for (const [label, lagCalendar, minutes] of cases) {
      const p = weekPayload();
      p.calendars = [...p.calendars, tenCal];
      p.tasks = p.tasks.map(t => (t.name === 'B' ? { ...t, calendarId: tenCal.id } : t));
      p.sequences = [p.sequences[0]];
      p.project = { ...p.project, schedulingOptions: { ...p.project.schedulingOptions, ...(lagCalendar ? { lagCalendar } : {}) } };
      const text = fmt.write(p);
      eq(`(5) ${tag} lagkalender ${label}: standaardveld`, fmt.lagOf(text, 'A', 'B'), isMsp ? `${minutes * 10}/7` : String(minutes / 60));
      eq(`(5) ${tag} lagkalender ${label}: record met dezelfde minuten`, Object.values(fmt.record(text, 'B', 'lags') as object ?? {}), [[0.5, minutes]]);
      eq(`(5) ${tag} lagkalender ${label}: terug als 0,5 d`, lagFields(seqByPair(fmt.read(text), 'A', 'B')), { lagDays: 0.5 });
    }
  }

  // ── (6) Duur en rest met een breuk ──────────────────────────────────────────────────────────────
  {
    const p = weekPayload();
    p.project = { ...p.project, statusDate: '2026-06-03' };
    p.sequences = [];
    p.tasks = [
      task('E', '2026-06-01T07:00', '2026-06-03T12:00', 2.5),
      // F: 2,5 d met 1,5 d rest (40 %).
      { ...task('F', '2026-06-01T07:00', '2026-06-03T12:00', 2.5, {
        completion: 0.4, actualStart: '2026-06-01T07:00', remainingTime: 1.5,
      }), status: 'STARTED' },
      // K: 3 d met 1 d rest. MSPDI schrijft het percentage als geheel getal (67); de rest blijft toch 1 d.
      { ...task('K', '2026-06-01T07:00', '2026-06-03T16:00', 3, {
        completion: 2 / 3, actualStart: '2026-06-01T07:00', remainingTime: 1,
      }), status: 'STARTED' },
      task('J', '2026-06-01T07:00', '2026-06-03T16:00', 3),
      ...(isMsp ? [task('G', '2026-06-01T07:00', '2026-06-02T19:00', 1.5, { durationType: 'ELAPSEDTIME' })] : []),
    ];
    const text = fmt.write(p);
    const fields = isMsp ? { d: 'Duration', r: 'RemainingDuration' } : { d: 'PlannedDuration', r: 'RemainingDuration' };
    eq(`(6) ${tag} E: 2,5 d ⇒ 20 u met record`, [fmt.durationOf(text, 'E')[0], fmt.record(text, 'E', 'durations')],
      [isMsp ? 'PT20H0M0S' : '20', { [fields.d]: [2.5, 1200] }]);
    eq(`(6) ${tag} F: duur en rest met records`, [fmt.durationOf(text, 'F'), fmt.record(text, 'F', 'durations')],
      [isMsp ? ['PT20H0M0S', 'PT12H0M0S'] : ['20', '12'], { [fields.d]: [2.5, 1200], [fields.r]: [1.5, 720] }]);
    eq(`(6) ${tag} J: hele dagen zonder record`, fmt.record(text, 'J', 'durations'), undefined);
    const r = fmt.read(text);
    const dur = (t: Task | undefined) => t && [t.time.durationUnit, t.time.scheduleDuration, t.time.remainingTime];
    eq(`(6) ${tag} ⇒ OPS: E 2,5 d`, dur(byName(r, 'E'))?.slice(0, 2), ['days', 2.5]);
    eq(`(6) ${tag} ⇒ OPS: F 2,5 d met 1,5 d rest`, dur(byName(r, 'F')), ['days', 2.5, 1.5]);
    eq(`(6) ${tag} ⇒ OPS: K 3 d met 1 d rest (B3)`, dur(byName(r, 'K')), ['days', 3, 1]);
    eq(`(6) ${tag} ⇒ OPS: J 3 d`, dur(byName(r, 'J'))?.slice(0, 2), ['days', 3]);
    const loaded = load(r);
    eq(`(6) ${tag}: ook na de laadgrens`, ['F', 'K'].map(n => dur(byName(loaded, n))), [['days', 2.5, 1.5], ['days', 3, 1]]);
    const second = fmt.read(fmt.write(loaded));
    eq(`(6) ${tag}: tweede ronde`, ['E', 'F', 'K'].map(n => dur(byName(second, n))?.slice(0, 3)),
      [dur(byName(r, 'E')), ['days', 2.5, 1.5], ['days', 3, 1]]);
    if (isMsp) {
      eq('(6) MSPDI G: 1,5 ed ⇒ PT36H0M0S met record', [fmt.durationOf(text, 'G')[0], fmt.record(text, 'G', 'durations')],
        ['PT36H0M0S', { Duration: [1.5, 2160] }]);
      const g = byName(r, 'G');
      eq('(6) MSPDI ⇒ OPS: G 1,5 ed', [g?.time.durationUnit, g?.time.durationType, g?.time.scheduleDuration], ['days', 'ELAPSEDTIME', 1.5]);
    }
    // Een gewijzigde duur: urenmaat in minuten, het record telt niet.
    const changedDuration = fmt.read(fmt.patchField(text, 'E', 'duration', isMsp ? 'PT22H0M0S' : '22'));
    const e = byName(changedDuration, 'E');
    eq(`(6) ${tag}: gewijzigde duur ⇒ urenmaat 1320 min`, [e?.time.durationUnit, e?.time.durationMinutes], ['hours', 1320]);
    // Een gewijzigde rest (de duur ongewijzigd): de dagenmaat blijft, de rest volgt het standaardveld.
    const changedRest = fmt.read(fmt.patchField(text, 'F', 'remaining', isMsp ? 'PT16H0M0S' : '16'));
    eq(`(6) ${tag}: gewijzigde rest ⇒ 2 d`, dur(byName(changedRest, 'F')), ['days', 2.5, 2]);
  }

  // ── (7) De urenmaat zonder afronding (ExactMinutes) ─────────────────────────────────────────────
  {
    const p = weekPayload();
    p.sequences = [];
    const exact = 1920 / 7;
    p.tasks = [
      task('U', '2026-06-01T07:00', '2026-06-01T12:00', 1, { durationUnit: 'hours', durationMinutes: exact }),
      task('V', '2026-06-01T07:00', '2026-06-01T12:00', 1, { durationUnit: 'hours', durationMinutes: 300 }),
    ];
    const text = fmt.write(p);
    eq(`(7) ${tag} U: standaardveld op de hele minuut`, fmt.durationOf(text, 'U')[0], isMsp ? 'PT4H34M0S' : String(274 / 60));
    eq(`(7) ${tag} U: record met de exacte minuten`, (fmt.record(text, 'U', 'exact') as Record<string, unknown> | undefined)?.[isMsp ? 'Duration' : 'PlannedDuration'],
      [exact, 274]);
    eq(`(7) ${tag} V: hele minuten zonder record`, fmt.record(text, 'V', 'exact'), undefined);
    const r = fmt.read(text);
    eq(`(7) ${tag} ⇒ OPS: exacte minuten`, [byName(r, 'U')?.time.durationUnit, byName(r, 'U')?.time.durationMinutes], ['hours', exact]);
    eq(`(7) ${tag}: tweede ronde exact`, byName(fmt.read(fmt.write(load(r))), 'U')?.time.durationMinutes, exact);
    const changed = fmt.read(fmt.patchField(text, 'U', 'duration', isMsp ? 'PT5H0M0S' : '5'));
    eq(`(7) ${tag}: gewijzigde duur ⇒ 300 min, het record telt niet`, byName(changed, 'U')?.time.durationMinutes, 300);
  }

  // ── (8) T13: een dag is de werktijd per dag ─────────────────────────────────────────────────────
  {
    // Opgeslagen 8 u per dag, blokken van 10 u (07:00–12:00 + 12:30–17:30).
    const TEN2 = [{ start: 420, end: 720 }, { start: 750, end: 1050 }];
    const p = weekPayload();
    p.calendar = { ...p.calendar, hoursPerDay: 8, workStartHour: 7, workEndHour: 17.5,
      workTime: { byWeekday: { 1: TEN2, 2: TEN2, 3: TEN2, 4: TEN2, 5: TEN2, 6: [], 7: [] } } };
    p.calendars = p.calendars.map(c => (c.id === p.calendar.id ? p.calendar : c));
    p.sequences = [];
    p.tasks = [task('T', '2026-06-01T07:00', '2026-06-03T17:30', 3)];
    const text = fmt.write(p);
    eq(`(8) ${tag}: 3 d ⇒ 30 u`, fmt.durationOf(text, 'T')[0], isMsp ? 'PT30H0M0S' : '30');
    const t = byName(fmt.read(text), 'T');
    eq(`(8) ${tag} ⇒ OPS: 3 d`, [t?.time.durationUnit, t?.time.scheduleDuration], ['days', 3]);
    // Een ouder OPS-bestand (tot en met F5a-1): 3 d als 3 × 8 u, zonder de nieuwe definities.
    const old = (isMsp
      ? text.replace(/<ExtendedAttribute>\s*<FieldID>18874401[234]<\/FieldID>\s*<FieldName>[\s\S]*?<\/ExtendedAttribute>/g, '')
      : text.replace(/<UDFType>(?:(?!<\/UDFType>)[\s\S])*<ObjectId>90000000[345]<\/ObjectId>[\s\S]*?<\/UDFType>/g, ''));
    ok(`(8) ${tag} opzet: de definities zijn weg`, !/OPS_DayMeasureDurations/.test(old));
    const oldRead = byName(fmt.read(fmt.patchField(old, 'T', 'duration', isMsp ? 'PT24H0M0S' : '24')), 'T');
    eq(`(8) ${tag}: ouder bestand 24 u ⇒ 3 d met de opgeslagen 8 u`, [oldRead?.time.durationUnit, oldRead?.time.scheduleDuration], ['days', 3]);
  }
}

// ── (9) Knownbug 256 (MSPDI-deel): een kale planningsstart op een letterlijke kalender ─────────────
{
  const NINE = [{ start: 540, end: 1020 }];
  const p = weekPayload();
  p.calendar = { ...p.calendar, hoursPerDay: 8, workStartHour: 9, workEndHour: 17,
    workTime: { byWeekday: { 1: NINE, 2: NINE, 3: NINE, 4: NINE, 5: NINE, 6: [], 7: [] } } };
  p.calendars = p.calendars.map(c => (c.id === p.calendar.id ? p.calendar : c));
  p.sequences = [];
  p.tasks = [task('S', '2026-06-01', '2026-06-01T17:00', 1)];
  const text = MSPDI.write(p);
  eq('(9) MSPDI: kale start op 09:00–17:00 ⇒ 09:00', MSPDI.block(text, 'S').match(/<Start>([^<]*)<\/Start>/)?.[1], '2026-06-01T09:00:00');
}

if (errors.length) {
  for (const e of errors) console.log(`XX uren-f5a2: ${e}`);
  process.exitCode = 1;
} else {
  console.log(`OK uren-f5a2: ${checks} controles groen`);
}
