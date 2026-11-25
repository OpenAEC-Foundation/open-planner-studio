import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { splitStepArgs } from '@/services/ifc/foreign/stepScanner';
import type { Task } from '@/types/task';
import { localTodayIso } from '@/utils/dateUtils';
import { lengthen, storeEdit } from './ifcAppRoute';
import { bonsaiPlanning, PIN_FILE, ROOT } from './ifcBonsaiPin';
import { cloneDomain, openForeign, sameBytes, tryMerge, type Domain, type MergeOutcome, type Opened } from './ifcMergeKern';
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
const CALENDAR = append(patch(patch(B4D, 98, 6, '(#8100)'), 98, 7, '(#8110)'), ["#8100=IFCWORKTIME('Standard work week',.PREDICTED.,$,#8101,$,$);",
  '#8101=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,$,$,(#8102));', "#8102=IFCTIMEPERIOD('07:00:00','16:00:00');",
  "#8110=IFCWORKTIME('Vrij',.USERDEFINED.,'Bonsai oorsprong',$,'2026-02-18','2026-02-18');"].join('\n'));
const SOURCES: readonly (readonly [string, string])[] = [
  ['de pinbron', bonsaiPlanning(PIN_FILE).text],
  ['bonsai-4d.ifc', B4D],
  ['r6opus-twee-werkplannen.na.ifc', R6],
  ['r6opus-twee-werkplannen.na.ifc met IfcTask en IfcLaborResource in de lengte van IFC4', R6
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
    out.push({ label: `${at}: duur een dag langer`, edit: d => lengthen(d, t.id) });
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
      if (detail) console.log(`   geweigerd  ${at}: ${refusal(result)}`);
      continue;
    }
    written++;
    if (detail) console.log(`   geschreven ${at}`);
    eq(`${at}: regel C`, regelC(source, graph, referenceGraph(result.bytes), editScope(graph, source, o, edited)), []);
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
