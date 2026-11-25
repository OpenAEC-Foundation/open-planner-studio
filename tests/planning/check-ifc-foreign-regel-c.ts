import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { constraintBlockingStart, predecessorDrivenTaskIds, startConstraintAfterEdit } from '@/engine/startEditConstraint';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { splitStepArgs } from '@/services/ifc/foreign/stepScanner';
import { documentContentOf } from '@/state/documentSaveState';
import { computeIfcOutputHere, prepareIfcOutput } from '@/state/prepareIfcOutput';
import type { Task } from '@/types/task';
import { localTodayIso } from '@/utils/dateUtils';
import { shownStart, startAnchorAfterEdit } from '@/utils/taskDates';
import { lengthen, loadStore, openInStore, storeEdit } from './ifcAppRoute';
import { bonsaiPlanning, PIN_FILE, ROOT } from './ifcBonsaiPin';
import { cloneDomain, openForeign, sameBytes, shownAfterOpen, tryMerge, type Domain, type MergeOutcome, type Opened } from './ifcMergeKern';
import { installDeterminism } from './ifcPariteitKern';
import { editScope, referenceGraph, regelC } from './ifcRegelC';

installDeterminism();
let checks = 0;
const fails: string[] = [];
const ok = (label: string, condition: boolean) => { checks++; if (!condition) fails.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  const same = JSON.stringify(got) === JSON.stringify(want);
  ok(same ? label : `${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`, same);
};

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const append = (text: string, rows: string) => text.replace(/ENDSEC;(\s*END-ISO-10303-21;)/, `${rows}\nENDSEC;$1`);
function patch(text: string, id: number, slot: number, token: string): string {
  let count = 0;
  const out = text.replace(new RegExp(`^#${id}=(\\w+)\\((.*)\\);$`, 'm'), (_m, type: string, raw: string) => {
    count++;
    const args = splitStepArgs(raw);
    args[slot] = token;
    return `#${id}=${type}(${args.join(',')});`;
  });
  if (count !== 1) throw new Error(`#${id}.${slot} ontbreekt in de proefbron`);
  return out;
}
const OPS_OWNER = ["#8013=IFCOWNERHISTORY(#8017,#8014,$,.NOCHANGE.,$,$,$,1794225600);", "#8014=IFCAPPLICATION(#8015,'0.2','Open Planner Studio','OPS');",
  "#8015=IFCORGANIZATION($,'OpenAEC Foundation',$,$,$);", "#8016=IFCPERSON($,'Corpus',$,$,$,$,$,$);", "#8017=IFCPERSONANDORGANIZATION(#8016,#8018,$);",
  "#8018=IFCORGANIZATION($,'OpenAEC corpus',$,$,$);"].join('\n');
const ofOps = (text: string, id: number) => append(patch(text, id, 1, '#8013'), OPS_OWNER);

const B4D = read('tests/fixtures/ifc-foreign/bonsai-4d.ifc');
const TWO_CREW = append(patch(patch(B4D, 120, 4, '(#118)'), 120, 2, "'Eerste inzet'"),
  "#8002=IFCRELASSIGNSTOPROCESS('1rmDhv9f7mdZ0AEONco1oi',#119,'Tweede inzet',$,(#118),$,#104,#8011);\n"
  + '#8011=IFCMEASUREWITHUNIT(IFCCOUNTMEASURE(9.),#7);');
const SHARED_LAG = append(append(patch(B4D, 112, 6, '#8010'), "#8010=IFCLAGTIME('Bonsai lag',.MEASURED.,$,IFCDURATION('P02D'),.NOTDEFINED.);"),
  "#8012=IFCRELSEQUENCE('3BShrdLag0000000000000',#111,$,$,#104,#108,#8010,.START_START.,$);");
const TWO_CREW_OPS = append(patch(patch(B4D, 120, 4, '(#118)'), 120, 2, "'Eerste inzet'"),
  `#8002=IFCRELASSIGNSTOPROCESS('1rmDhv9f7mdZ0AEONco1oi',#8013,$,$,(#118),$,#104,$);\n${OPS_OWNER}`);
const SHARED_TIME = patch(B4D, 108, 11, '#109').replace(/^#110=IFCTASKTIME.*\n/m, '');
const R6 = read('tests/fixtures/ifc-foreign/council/r6opus-twee-werkplannen.na.ifc');
const R6_LONG = 'r6opus-twee-werkplannen.na.ifc met IfcTask en IfcLaborResource in de lengte van IFC4';
const CALENDAR = append(patch(patch(B4D, 98, 6, '(#8100)'), 98, 7, '(#8110)'), ["#8100=IFCWORKTIME('Standard work week',.PREDICTED.,$,#8101,$,$);",
  '#8101=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,$,$,(#8102));', "#8102=IFCTIMEPERIOD('07:00:00','16:00:00');",
  "#8110=IFCWORKTIME('Vrij',.USERDEFINED.,'Bonsai oorsprong',$,'2026-02-18','2026-02-18');"].join('\n'));
const SOURCES: readonly (readonly [string, string])[] = [
  ['de pinbron', bonsaiPlanning(PIN_FILE).text],
  ['bonsai-4d.ifc', B4D],
  ['r6opus-twee-werkplannen.na.ifc', R6],
  [R6_LONG, R6
    .replace(/^(#\d+=IFCTASK\('[^']*',#2,'[^']*',\$,\$,'[^']*',\$,\$,)/gm, '$1$,').replace(/^(#\d+=IFCLABORRESOURCE\('[^']*',#2,'[^']*',)/gm, '$1$,')],
  ['twee inzetten van dezelfde ploeg', TWO_CREW],
  ['een kalender met een eigen werkweek en een vrije dag met herkomstlabel', CALENDAR],
  ['een kalender waarvan de werkweek haar herhaling deelt met een taaktijd', CALENDAR.replace(/^#110=IFCTASKTIME\((.*)\);$/m, '#110=IFCTASKTIMERECURRING($1,#8101);')],
  ['een gedeelde lag', SHARED_LAG],
  ['een gedeelde taaktijd', SHARED_TIME],
  ['twee inzetten van dezelfde ploeg, de tweede van OPS', TWO_CREW_OPS],
  ['een gedeelde lag, de tweede reeks van OPS', ofOps(SHARED_LAG, 8012)],
  ['een gedeelde taaktijd, de tweede taak van OPS', ofOps(SHARED_TIME, 108)],
];

const sync = (f: (d: Domain) => void) => (d: Domain) => { f(d); return d; };
const dayLater = (at: string) => {
  const day = new Date(`${at.slice(0, 10)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return `${day.toISOString().slice(0, 10)}${at.slice(10)}`;
};
type Time = Task['time'];
const DATES = ['scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish'] as const;
const TASK_FIELDS: Readonly<Record<string, (t: Task) => void>> = {
  omschrijving: t => { t.description = 'Nieuwe omschrijving'; },
  code: t => { t.wbsCode = `${t.wbsCode ?? ''}.9`; },
  prioriteit: t => { t.priority = (t.priority ?? 500) + 100; },
  taaksoort: t => { t.taskType = t.taskType === 'DEMOLITION' ? 'CONSTRUCTION' : 'DEMOLITION'; },
};
const TIME_FIELDS: Readonly<Record<string, (t: Time) => void>> = {
  ...Object.fromEntries(DATES.map(key => [key, (t: Time) => { t[key] = dayLater(t[key]!); }])),
  totalFloat: t => { t.totalFloat = (t.totalFloat ?? 0) + 1; },
  freeFloat: t => { t.freeFloat = (t.freeFloat ?? 0) + 1; },
  isCritical: t => { t.isCritical = !t.isCritical; },
  durationType: t => { t.durationType = t.durationType === 'ELAPSEDTIME' ? 'WORKTIME' : 'ELAPSEDTIME'; },
  actualDuration: t => { t.actualDuration = 1; },
  remainingTime: t => { t.remainingTime = 2; },
};
const progress = (id: string, completion: number) => (d: Domain) => storeEdit(d, s => {
  const edit = { field: 'completion', value: completion } as const;
  const opts = { today: localTodayIso() };
  let result = s.enterTaskProgress(id, edit, opts);
  if (!result.ok && result.reason === 'needsActualStart') result = s.enterTaskProgress(id, edit, { ...opts, actualStart: result.question.latest });
  if (!result.ok) throw new Error(`voortgang: ${result.reason}`);
});

interface Case { readonly label: string; readonly edit: (d: Domain) => Domain | Promise<Domain>; readonly removes?: string }
function casesOf(o: Opened): Case[] {
  const out: Case[] = [];
  const step = (key: string) => o.ifcSource!.stepIds[key] ?? '?';
  const task = (d: Domain, id: string) => d.tasks.find(t => t.id === id)!;
  const sequence = (d: Domain, id: string) => d.sequences.find(q => q.id === id)!;
  for (const t of o.tasks) {
    const at = `taak #${step(`task:${t.id}`)} ${JSON.stringify(t.name)}`;
    out.push({ label: `${at} hernoemd`, edit: sync(d => { task(d, t.id).name = `${t.name} (hernoemd)`; }) });
    for (const [field, change] of Object.entries(TASK_FIELDS)) out.push({ label: `${at}: ${field} gewijzigd`, edit: sync(d => change(task(d, t.id))) });
    out.push({ label: `${at}: mijlpaal gewijzigd`, edit: d => storeEdit(d, s => {
      const now = s.tasks.find(x => x.id === t.id)!;
      s.updateTask(t.id, taskMilestoneTransition(now, !now.isMilestone));
    }) });
    out.push({ label: `${at}: duur een dag langer${t.isMilestone ? ' (een mijlpaal)' : ''}`, edit: d => lengthen(d, t.id) });
    for (const [field, change] of Object.entries(TIME_FIELDS)) {
      if (DATES.some(key => key === field) && !t.time[field as typeof DATES[number]]) continue;
      out.push({ label: `${at}: ${field} gewijzigd`, edit: sync(d => change(task(d, t.id).time)) });
    }
    if (t.childIds.length > 0 || t.isMilestone) continue;
    for (const completion of [0.5, 1]) out.push({ label: `${at}: voortgang ${completion * 100} %`, edit: progress(t.id, completion) });
    out.push({ label: `${at} gewist`, edit: d => storeEdit(d, s => { s.deleteTask(t.id); }) });
  }
  for (const q of o.sequences) {
    const at = `relatie #${step(`seq:${q.id}`)}`;
    out.push({ label: `${at}: soort gewijzigd`, edit: sync(d => { const x = sequence(d, q.id); x.type = x.type === 'START_START' ? 'FINISH_START' : 'START_START'; }) });
    out.push({ label: `${at}: lagwaarde gewijzigd`, edit: sync(d => {
      const x = sequence(d, q.id);
      x.lagDays = (x.lagDays ?? 0) + 3;
      delete x.lagMinutes;
      delete x.lagPercent;
    }) });
    if (q.lagDays || q.lagMinutes || q.lagPercent) {
      out.push({ label: `${at}: lageenheid gewijzigd`, edit: sync(d => { const x = sequence(d, q.id); x.lagUnit = x.lagUnit === 'ELAPSEDTIME' ? 'WORKTIME' : 'ELAPSEDTIME'; }) });
    }
    out.push({ label: `${at} gewist`, edit: d => storeEdit(d, s => { s.removeSequence(q.id); }) });
  }
  out.push({ label: 'kalender: naam gewijzigd', edit: sync(d => { d.calendar.name = `${d.calendar.name} (gewijzigd)`; }) });
  out.push({ label: 'kalender: omschrijving gewijzigd', edit: sync(d => { d.calendar.description = 'Andere omschrijving'; }) });
  out.push({ label: 'kalender: ploeg gewijzigd', edit: sync(d => { d.calendar.shift = d.calendar.shift === 'SECOND' ? 'FIRST' : 'SECOND'; }) });
  o.calendar.holidays.forEach((_, n) => out.push({ label: `kalender: vrije dag ${n + 1} een dag langer`, edit: sync(d => {
    d.calendar.holidays = d.calendar.holidays.map((x, k) => (k === n ? { ...x, endDate: dayLater(x.endDate) } : x));
  }) }));
  out.push({ label: 'werkplan: omschrijving gewijzigd', edit: sync(d => { d.project.description = 'Andere omschrijving'; }) });
  for (const r of o.resources) {
    const at = `resource #${step(`res:${r.id}`)}`;
    out.push({ label: `${at}: naam gewijzigd`, edit: sync(d => { d.resources.find(x => x.id === r.id)!.name = `${r.name} (gewijzigd)`; }) });
    out.push({ label: `${at}: omschrijving gewijzigd`, edit: sync(d => { d.resources.find(x => x.id === r.id)!.description = 'Andere omschrijving'; }) });
  }
  o.assignments.forEach((a, n) => {
    const label = `toewijzing ${n + 1} (taak #${step(`task:${a.taskId}`)}, resource #${step(`res:${a.resourceId}`)}) gewist`;
    out.push({ label, removes: a.id, edit: d => storeEdit(d, s => { s.unassignResource(a.id); }) });
  });
  return out;
}

const refusal = (r: MergeOutcome) => (r.ok ? 'schrijft' : r.error.cases.slice(0, 2).map(c => `${c.kind} #${c.sourceId}: ${c.detail}`).join(' | '));
type Refused = MergeNeedsPhase2Error['cases'][number];
interface Boundary { readonly id: string; readonly reason: string; readonly fits: (c: Refused, source: string, label: string) => boolean }
const SHARED = new Set(['een gedeelde lag', 'een gedeelde lag, de tweede reeks van OPS', 'een gedeelde taaktijd', 'een gedeelde taaktijd, de tweede taak van OPS']);
const ONLY_SECOND = [120, 8002, 8011];
const OPS_OWNER_IDS = [...OPS_OWNER.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1]));
const BOUNDARIES: readonly Boundary[] = [
  { id: '2369', reason: 'een hulpstuk dat twee planningsstukken delen; de writer zou het splitsen',
    fits: (c, source) => SHARED.has(source) && [8010, 8012, 109, 108].includes(c.sourceId ?? -1) },
  { id: '2368', reason: 'dezelfde ploeg twee keer aan één taak; welke inzet de planner wiste, is niet vast te stellen',
    fits: (c, source, label) => source.startsWith('twee inzetten') && /^toewijzing [12] \(taak #104, resource #118\) gewist$/.test(label)
      && (ONLY_SECOND.includes(c.sourceId ?? -1) || (c.kind === 'niet-gedragen' && OPS_OWNER_IDS.includes(c.sourceId ?? -1))) },
  { id: '2233', reason: 'een kalenderhulpstuk van een ander programma met een herkomstlabel of een gedeelde herhaling',
    fits: (c, source) => source.startsWith('een kalender') && ((c.sourceId === 8110 && c.kind === 'niet-eenduidig') || (c.sourceId === 8100 && c.kind === 'niet-gedragen')) },
  { id: '2234', reason: 'de projectkalender wordt letterlijk (mijlpaal of verstreken duur)',
    fits: (c, source, label) => source === 'de pinbron' && c.kind === 'bronvorm-leest-anders' && /: ((mijlpaal|durationType) gewijzigd|duur een dag langer \(een mijlpaal\))$/.test(label) },
  { id: '2256', reason: 'een taak zonder volledige taaktijd in de bron, met een afgeleide waarde die herlezen anders afleidt',
    fits: (c, source) => (source === R6_LONG && ((c.kind === 'bronvorm-leest-anders' && /anders: taak task-ifc-0sub0+, time\./.test(c.detail))
      || (c.kind === 'planning-na-openen' && /^taak task-ifc-0task0+\.time\.scheduleDuration: 5 → 0$/.test(c.detail))))
      || (source === 'bonsai-4d.ifc' && c.kind === 'planning-na-openen' && c.detail.startsWith('taak task-ifc-2lNOVVAc3x$DPP3aHgo958.time.durationUnit:')) },
  { id: 'PR 8', reason: 'een gemengde relatie: resources en producten in één IfcRelAssignsToProcess, of een gemengde kalenderrelatie',
    fits: c => c.kind === 'gemengde-relatie' },
  { id: 'main', reason: 'een taak en een resource in een oude lay-out buiten het register; main weigert het bestand op herkomst',
    fits: (_c, source) => source === 'r6opus-twee-werkplannen.na.ifc' },
];
const unnamed = (r: MergeOutcome, source: string, label: string) => (r.ok ? '' : r.error.cases
  .filter(c => !BOUNDARIES.some(b => b.fits(c, source, label))).slice(0, 3).map(c => `${c.kind} #${c.sourceId}: ${c.detail}`).join(' | '));
const boundaryOf = (r: MergeOutcome, source: string, label: string): Boundary | undefined => {
  if (r.ok) return undefined;
  const fit = (c: Refused) => BOUNDARIES.find(b => b.fits(c, source, label));
  return r.error.cases.every(c => fit(c) !== undefined) ? fit(r.error.cases[0]) : undefined;
};
const perBoundary = new Map<string, number>();
interface Outcome { readonly written: number; readonly refused: number; readonly idle: number; readonly kinds: Readonly<Record<string, number>> }
const outcomes = new Map<string, Outcome>();
const detail = process.env.OPS_REGEL_C_VERSLAG === '1';
for (const [name, text] of SOURCES) {
  const bytes = new TextEncoder().encode(text), pristine = Uint8Array.from(bytes);
  const o = await openForeign(bytes);
  const source = o.ifcSource!;
  ok(`${name}: de proef opent met een vreemd deel en een kaart`, source.foreign && source.sourceSlots !== undefined);
  const graph = referenceGraph(bytes);
  eq(`${name}: de bron zelf heeft geen losse verwijzing`, graph.dangling, []);
  let written = 0, refused = 0, idle = 0;
  const unchanged = JSON.stringify(cloneDomain(o));
  const kinds: Record<string, number> = {};
  for (const c of casesOf(o)) {
    const at = `${name}, ${c.label}`;
    let edited: Domain;
    try { edited = await c.edit(cloneDomain(o)); } catch (e) { ok(`${at}: de bewerking lukt (${(e as Error).message})`, false); continue; }
    if (JSON.stringify(edited) === unchanged) { idle++; continue; }
    if (c.removes) eq(`${at}: de proef: precies die toewijzing weg`, edited.assignments.map(a => a.id), o.assignments.map(a => a.id).filter(id => id !== c.removes));
    let result: MergeOutcome;
    try { result = await tryMerge(edited, source); } catch (e) { ok(`${at}: een weigering is getypeerd (${String(e)})`, false); continue; }
    if (!result.ok) {
      refused++;
      for (const kind of result.kinds) kinds[kind] = (kinds[kind] ?? 0) + 1;
      ok(`${at}: geweigerd, en de bron staat er byte voor byte`, sameBytes(source.bytes, pristine));
      const boundary = boundaryOf(result, name, c.label);
      ok(`${at}: de weigering hoort bij een benoemde grens (zonder grens: ${unnamed(result, name, c.label)})`, boundary !== undefined);
      if (boundary) perBoundary.set(boundary.id, (perBoundary.get(boundary.id) ?? 0) + 1);
      if (detail) console.log(`   geweigerd  ${at}: ${refusal(result)}`);
      continue;
    }
    written++;
    if (detail) console.log(`   geschreven ${at}`);
    eq(`${at}: regel C`, regelC(source, graph, referenceGraph(result.bytes), editScope(graph, source, o, edited, result.changes)), []);
  }
  outcomes.set(name, { written, refused, idle, kinds });
}
for (const name of ['de pinbron', 'bonsai-4d.ifc', 'r6opus-twee-werkplannen.na.ifc met IfcTask en IfcLaborResource in de lengte van IFC4', 'twee inzetten van dezelfde ploeg',
  'twee inzetten van dezelfde ploeg, de tweede van OPS']) {
  ok(`${name}: de proef schrijft gevallen (${JSON.stringify(outcomes.get(name))})`, (outcomes.get(name)?.written ?? 0) > 0);
}

async function reproduction(label: string, text: string, edit: (o: Opened) => (d: Domain) => Domain | Promise<Domain>, sourceId: number) {
  const o = await openForeign(new TextEncoder().encode(text));
  const result = await tryMerge(await edit(o)(cloneDomain(o)), o.ifcSource!);
  ok(`${label}: getypeerd geweigerd als niet-eenduidig op #${sourceId} (${refusal(result)})`,
    !result.ok && result.error.cases.some(c => c.kind === 'niet-eenduidig' && c.sourceId === sourceId));
}
const crew = (o: Opened) => {
  const task = o.tasks.find(t => t.name === 'Wand A bouwen')!;
  return o.assignments.filter(a => a.taskId === task.id);
};
for (const [n, sourceId] of [[0, 120], [1, 8002]] as const) {
  await reproduction(`Sol r2, reproductie 1: twee inzetten van dezelfde ploeg, inzet ${n + 1} gewist`, TWO_CREW, o => {
    const rows = crew(o);
    ok('de proef: twee inzetten van één ploeg op één taak', rows.length === 2 && rows[0].resourceId === rows[1].resourceId);
    return d => storeEdit(d, s => { s.unassignResource(rows[n].id); });
  }, sourceId);
}
const renameA = (o: Opened) => sync(d => { d.tasks.find(t => t.id === o.tasks.find(x => x.name === 'Wand A bouwen')!.id)!.name = 'Wand A hernoemd'; });
await reproduction('Sol r2, reproductie 2: een gedeelde lag, een taak hernoemd', SHARED_LAG, renameA, 8010);
await reproduction('Sol r2, reproductie 2: een gedeelde taaktijd, een taak hernoemd', SHARED_TIME, renameA, 109);

type State = Parameters<Parameters<typeof storeEdit>[1]>[0];
type Act = (s: State) => void;
function view(d: Domain): string {
  const tasks = new Map(d.tasks.map(t => [t.id, t])), resources = new Map(d.resources.map(r => [r.id, r]));
  const name = (id: string | null | undefined) => (id ? tasks.get(id)?.name ?? '?' : '-');
  return JSON.stringify({
    tasks: d.tasks.map(t => [t.name, name(t.parentId), t.time.scheduleDuration, t.time.durationUnit, t.time.completion ?? 0, t.isMilestone]).sort(),
    children: d.tasks.filter(t => t.childIds.length > 0).map(t => [t.name, ...t.childIds.map(name)]).sort(),
    assignments: d.assignments.map(a => [name(a.taskId), resources.get(a.resourceId)?.name ?? '?', a.unitsPerDay]),
    sequences: d.sequences.map(q => [name(q.predecessorId), name(q.successorId), q.type, q.lagDays ?? 0, q.lagMinutes ?? null]).sort(),
    holidays: d.calendar.holidays.map(h => [h.startDate, h.endDate]).sort(),
    resources: d.resources.map(r => r.name).sort(),
  });
}
const taskNamed = (s: State, name: string) => s.tasks.find(t => t.name === name)!;
const startLater = (s: State, id: string) => {
  const task = s.tasks.find(t => t.id === id)!;
  const anchor = startAnchorAfterEdit(task, dayLater(shownStart(task)));
  if (anchor === undefined) throw new Error('de start verschuift niet');
  const driven = predecessorDrivenTaskIds(s.tasks, s.sequences).has(id);
  if (constraintBlockingStart(task, driven)) throw new Error('een constraint houdt de start tegen');
  const snet = startConstraintAfterEdit(task, anchor, driven);
  s.updateTask(id, { time: { ...task.time, scheduleStart: anchor }, ...(snet ? { constraint: snet.constraint } : {}) });
};
const withProgress = (s: State, id: string) => {
  const edit = { field: 'completion', value: 0.5 } as const, opts = { today: localTodayIso() };
  let result = s.enterTaskProgress(id, edit, opts);
  if (!result.ok && result.reason === 'needsActualStart') result = s.enterTaskProgress(id, edit, { ...opts, actualStart: result.question.latest });
  if (!result.ok) throw new Error(`voortgang: ${result.reason}`);
};
const reversed = (s: State, id: string) => {
  [...s.tasks.find(t => t.id === id)!.childIds].reverse().forEach((child, childIndex) => s.moveTaskTo(child, { parentId: id, childIndex }));
};
const NEW_RESOURCE = { name: 'Nieuwe ploeg', description: '', type: 'LABOR' as const, maxUnits: 1 };
function ordinaryWork(o: Opened): { readonly edits: readonly (readonly [string, (d: Domain) => Promise<Domain>])[]; readonly assign: Act } {
  const leaves = o.tasks.filter(t => t.childIds.length === 0 && !t.isMilestone);
  const assigned = o.assignments[0];
  const crew = o.resources.find(r => r.id === assigned.resourceId)!.name;
  const free = leaves.find(t => !o.assignments.some(a => a.taskId === t.id))!;
  const [first, second] = leaves;
  const parent = o.tasks.find(t => t.childIds.length >= 2)!;
  const child = leaves.find(t => t.parentId !== null)!;
  const day = dayLater(first.time.scheduleStart).slice(0, 10);
  const assign: Act = s => { s.assignResource(taskNamed(s, free.name).id, s.resources.find(r => r.name === crew)!.id, 2); };
  const newRelation: Act = s => {
    for (const a of leaves) for (const b of leaves) {
      if (a.id === b.id || s.sequences.some(q => [q.predecessorId, q.successorId].includes(a.id) && [q.predecessorId, q.successorId].includes(b.id))) continue;
      if (s.addSequence({ predecessorId: a.id, successorId: b.id, type: 'FINISH_START', lagDays: 0 }) !== null) return;
    }
    throw new Error('geen nieuwe relatie mogelijk');
  };
  const acts: readonly (readonly [string, Act])[] = [
    ['een taak hernoemd', s => { s.updateTask(first.id, { name: `${first.name} (hernoemd)` }); }],
    ['de start van een taak een dag later', s => { startLater(s, free.id); }],
    ['voortgang 50 % op een taak', s => { withProgress(s, second.id); }],
    ['doorrekenen', s => { s.runCPM(); }],
    [`de bestaande ${crew} ook aan "${free.name}"`, assign],
    ['een nieuwe ploeg gemaakt en toegewezen', s => { const id = s.addResource(NEW_RESOURCE); s.assignResource(taskNamed(s, free.name).id, id, 1); }],
    ['een toewijzing gewist', s => { s.unassignResource(assigned.id); }],
    ['een relatie toegevoegd', newRelation],
    ...(o.sequences.length > 0 ? [
      ['een relatie van soort gewijzigd', (s: State) => { s.updateSequence(o.sequences[0].id, { type: o.sequences[0].type === 'START_START' ? 'FINISH_START' : 'START_START' }); }],
      ['een relatie gewist', (s: State) => { s.removeSequence(o.sequences[0].id); }],
    ] as const : []),
    ['een taak toegevoegd', s => { s.addTask({ name: 'Nieuwe taak', position: { anchorId: first.id, where: 'below' } }, { phaseAssignments: 'move', answered: true }); }],
    ['een taak een niveau hoger', s => { s.outdentTasks([child.id], { phaseAssignments: 'move', answered: true }); }],
    ['de kinderen van een taak in andere volgorde gesleept', s => { reversed(s, parent.id); }],
    ['een taak gewist', s => { s.deleteTask(free.id); }],
    ['een vrije dag toegevoegd', s => { s.setCalendar({ ...s.calendar, holidays: [...s.calendar.holidays, { name: 'Extra vrije dag', startDate: day, endDate: day }] }); }],
    ['een taak hernoemd en een ploeg toegewezen, in één opslag', s => { s.updateTask(first.id, { name: `${first.name} (hernoemd)` }); assign(s); }],
  ];
  return {
    edits: [['de duur van een taak een dag langer', d => lengthen(d, first.id)], ...acts.map(([label, act]) => [label, (d: Domain) => storeEdit(d, act)] as const)],
    assign,
  };
}
const { buildWriteIFCInput } = await loadStore();
const ordinary = new Map<string, string[]>();
for (const [name, text] of [['de pinbron', SOURCES[0][1]], ['bonsai-4d.ifc', B4D]] as const) {
  const bytes = new TextEncoder().encode(text), graph = referenceGraph(bytes);
  const o = await openForeign(bytes);
  const outcomes: string[] = [];
  const work = ordinaryWork(o);
  for (const [label, edit] of work.edits) {
    const at = `gewoon werk op ${name}: ${label}`;
    let edited: Domain;
    try { edited = await edit(cloneDomain(o)); }
    catch (e) { ok(`${at}: de bewerking lukt (${(e as Error).message})`, false); continue; }
    ok(`${at}: de bewerking veranderde de planning`, JSON.stringify(edited) !== JSON.stringify(cloneDomain(o)) || label === 'doorrekenen');
    const result = await tryMerge(edited, o.ifcSource!);
    if (!result.ok) {
      const boundary = boundaryOf(result, name, label);
      outcomes.push(`${label}: geweigerd (${boundary ? `grens ${boundary.id}` : refusal(result)})`);
      ok(`${at}: schrijft, of weigert op een benoemde grens (zonder grens: ${unnamed(result, name, label)})`, boundary !== undefined);
      continue;
    }
    outcomes.push(`${label}: geschreven`);
    eq(`${at}: regel C`, regelC(o.ifcSource!, graph, referenceGraph(result.bytes), editScope(graph, o.ifcSource!, o, edited, result.changes)), []);
    eq(`${at}: na heropenen ziet de planner wat hij zag`, view(await openForeign(result.bytes)), view(await shownAfterOpen(edited)));
  }
  {
    const { store } = await openInStore(bytes);
    const opened = store.getState().ifcSource!;
    const commit = async (): Promise<Uint8Array | string> => {
      const state = store.getState();
      try {
        const prepared = (await prepareIfcOutput(state, buildWriteIFCInput(state, 'merge'), undefined, computeIfcOutputHere)).prepared!;
        store.getState().commitSavedDocument(documentContentOf(state, state.activeDocumentId!)!, state, undefined, prepared);
        return prepared.bytes;
      } catch (e) {
        return e instanceof MergeNeedsPhase2Error ? e.cases.slice(0, 2).map(c => `${c.kind}: ${c.detail}`).join(' | ') : String(e);
      }
    };
    work.assign(store.getState());
    const once = await commit();
    store.getState().updateTask(store.getState().tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!.id, { name: 'Na de eerste opslag' });
    const twice = await commit();
    const label = 'opslaan, nog een bewerking, weer opslaan';
    ok(`gewoon werk op ${name}: ${label}: beide opslagen schrijven (${typeof once === 'string' ? once : ''}${typeof twice === 'string' ? twice : ''})`,
      once instanceof Uint8Array && twice instanceof Uint8Array);
    outcomes.push(`${label}: ${once instanceof Uint8Array && twice instanceof Uint8Array ? 'geschreven' : 'geweigerd'}`);
    if (twice instanceof Uint8Array) {
      eq(`gewoon werk op ${name}: ${label}: regel C tegenover de oorspronkelijke bron`, regelC(opened, graph, referenceGraph(twice)), []);
      eq(`gewoon werk op ${name}: ${label}: na heropenen ziet de planner wat hij zag`,
        view(await openForeign(twice)), view(await shownAfterOpen(buildWriteIFCInput(store.getState(), 'merge'))));
    }
  }
  ordinary.set(name, outcomes);
}

{
  const bytes = new TextEncoder().encode(B4D);
  const o = await openForeign(bytes);
  const edited = await storeEdit(cloneDomain(o), s => { s.assignResource(taskNamed(s, 'Wand B bouwen').id, s.resources.find(r => r.name === 'Metselploeg')!.id, 2); });
  const result = await tryMerge(edited, o.ifcSource!);
  const label = 'Sol r3: in het ongewijzigde bonsai-4d.ifc de Metselploeg ook aan Wand B';
  ok(`${label}: geschreven (${refusal(result)})`, result.ok);
  if (result.ok) {
    const line = (text: string) => text.match(/^#120=.*$/m)?.[0];
    eq(`${label}: #120 byte voor byte`, line(new TextDecoder().decode(result.bytes)), line(B4D));
    const reopened = await openForeign(result.bytes);
    const perTask = (d: Domain) => d.assignments.map(a => `${d.tasks.find(t => t.id === a.taskId)!.name}: ${d.resources.find(r => r.id === a.resourceId)!.name} ${a.unitsPerDay}`);
    eq(`${label}: na heropenen dezelfde twee toewijzingen met dezelfde inzet per taak`, perTask(reopened), ['Wand A bouwen: Metselploeg 1', 'Wand B bouwen: Metselploeg 2']);
    const swapped = new TextEncoder().encode(new TextDecoder().decode(result.bytes).replace(/^(#106=IFCRELNESTS\(.*)\(#104,#108\)/m, '$1(#108,#104)'));
    const graph = referenceGraph(bytes);
    ok('de proef van regel C ziet een verwisseling van de kinderen in een IfcRelNests',
      regelC(o.ifcSource!, graph, referenceGraph(swapped), editScope(graph, o.ifcSource!, o, edited, result.changes)).some(p => p.includes('IFCRELNESTS #106 heeft in slot 5 een andere volgorde')));
  }
}

{
  const o = await openForeign(new TextEncoder().encode(B4D));
  const label = 'beide kinderen van Ruwbouw gewist';
  const result = await tryMerge(await storeEdit(cloneDomain(o), s => { for (const n of ['Wand A bouwen', 'Wand B bouwen']) s.deleteTask(taskNamed(s, n).id); }), o.ifcSource!);
  const boundary = boundaryOf(result, 'bonsai-4d.ifc', label);
  ok(`bonsai-4d.ifc, ${label}: weigert onder grens 2256 (${refusal(result)})`, boundary?.id === '2256');
  if (boundary) perBoundary.set(boundary.id, (perBoundary.get(boundary.id) ?? 0) + 1);
}

{
  const bytes = new TextEncoder().encode(SOURCES[0][1]), graph = referenceGraph(bytes);
  const o = await openForeign(bytes);
  const [p, q] = o.tasks.filter(t => t.childIds.length >= 2);
  const edited = await storeEdit(cloneDomain(o), s => { reversed(s, p.id); });
  const result = await tryMerge(edited, o.ifcSource!);
  const label = `de pinbron: de kinderen van ${JSON.stringify(p.name)} in andere volgorde gesleept`;
  ok(`${label}: geschreven (${refusal(result)})`, result.ok);
  if (result.ok) {
    const scope = editScope(graph, o.ifcSource!, o, edited, result.changes);
    eq(`${label}: regel C`, regelC(o.ifcSource!, graph, referenceGraph(result.bytes), scope), []);
    const text = new TextDecoder().decode(result.bytes), at = `#${o.ifcSource!.stepIds[`task:${q.id}`]}`;
    const nest = [...text.matchAll(/^#(\d+)=IFCRELNESTS\((.*)\);$/gm)].map(m => ({ id: Number(m[1]), args: splitStepArgs(m[2]) })).find(n => n.args[4] === at)!;
    const members = nest.args[5].slice(1, -1).split(',');
    const swapped = patch(text, nest.id, 5, `(${[members[1], members[0], ...members.slice(2)].join(',')})`);
    ok(`${label}: een verwisseling bij ${JSON.stringify(q.name)} blijft rood`, regelC(o.ifcSource!, graph, referenceGraph(new TextEncoder().encode(swapped)), scope)
      .some(x => x === `IFCRELNESTS #${nest.id} heeft in slot 5 een andere volgorde`));
  }
}

for (const [name, list] of ordinary) console.log(`   gewoon werk op ${name}:\n${list.map(x => `     ${x}`).join('\n')}`);
for (const b of BOUNDARIES) console.log(`   grens ${b.id} (${b.reason}): ${perBoundary.get(b.id) ?? 0} weigering(en)`);
for (const [name, { written, refused, idle, kinds }] of outcomes) {
  console.log(`   ${name}: ${written + refused} gevallen, ${written} geschreven, ${refused} geweigerd${refused ? ` (${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`
    + `${idle ? `; ${idle} bewerking(en) liet de app niet toe` : ''}`);
}
const total = [...outcomes.values()].reduce((sum, x) => ({ written: sum.written + x.written, refused: sum.refused + x.refused }), { written: 0, refused: 0 });
if (fails.length > 0) {
  console.log(`XX  ifc-foreign-regel-c: ${fails.length} afwijking(en) van ${checks}`);
  for (const f of fails) console.log(`   - ${f}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-regel-c: ${checks} toetsen groen (${SOURCES.length} bronnen, ${total.written + total.refused} gevallen: ${total.written} geschreven, ${total.refused} geweigerd)`);
