import './domStub';
import { useAppStore, createAppStoreContext } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { DocumentPayload } from '@/state/documentContract';

declare const process: { exit(code: number): never };

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(`${label} (kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)})`,
    JSON.stringify(got) === JSON.stringify(want));
}
const byName = (tasks: readonly Task[], name: string): Task => {
  const t = tasks.find(x => x.name === name);
  if (!t) throw new Error(`taak ${name} ontbreekt`);
  return t;
};

function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = '';
  for (const ch of inner) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
const lineRe = (type: string) => new RegExp(`^(#\\d+=${type}\\()(.*)(\\);\\s*)$`);
function argsOf(ifc: string, type: string, name: string): string[] {
  for (const line of ifc.split('\n')) {
    const m = line.match(lineRe(type));
    if (!m) continue;
    const args = splitArgs(m[2]);
    if (args[type === 'IFCTASK' ? 2 : 0] === `'${name}'`) return args;
  }
  throw new Error(`geen ${type}-regel voor ${name}`);
}
function editLines(ifc: string, type: string, pick: (args: string[]) => boolean, edit: (args: string[]) => string[]): string {
  let hits = 0;
  const out = ifc.split('\n').map((line) => {
    const m = line.match(lineRe(type));
    if (!m) return line;
    const args = splitArgs(m[2]);
    if (!pick(args)) return line;
    hits++;
    return `${m[1]}${edit(args).join(',')}${m[3]}`;
  }).join('\n');
  if (hits === 0) throw new Error(`geen ${type}-regel gevonden om te bewerken`);
  return out;
}
const isTask = (name: string) => (args: string[]) => args[2] === `'${name}'`;
const setTaskStatus = (ifc: string, name: string, value: string) =>
  editLines(ifc, 'IFCTASK', isTask(name), (a) => { a[STATUS] = value; return a; });

const STATUS = 7;
const WORK_METHOD = 8;
const TT_ACTUAL_FINISH = 17;

S().newProject();
S().setProject({ startDate: '2015-01-05', statusDate: '2015-01-07' });
const idL = S().addTask({ name: 'L', time: createDefaultTaskTime('2015-01-05', 10) });
const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2015-01-19', 5) });
const idV = S().addTask({ name: 'V', time: createDefaultTaskTime('2015-01-05', 2) });
const idH = S().addTask({ name: 'H', time: createDefaultTaskTime('2015-01-05', 4) });
S().addTask({ name: 'N', time: createDefaultTaskTime('2015-01-12', 3) });
S().addSequence({ predecessorId: idL, successorId: idB, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
const tL = byName(S().tasks, 'L');
S().updateTask(idL, { status: 'STARTED', time: { ...tL.time, completion: 1, actualStart: '2015-01-05' } });
const tV = byName(S().tasks, 'V');
S().updateTask(idV, { status: 'COMPLETED', time: { ...tV.time, completion: 1, actualStart: '2015-01-05', actualFinish: '2015-01-06', remainingTime: 0 } });
const tH = byName(S().tasks, 'H');
S().updateTask(idH, { status: 'STARTED', time: { ...tH.time, completion: 0.5, actualStart: '2015-01-05', remainingTime: 2 } });
S().runCPM();
void idB;

const before = {
  tasks: S().tasks.map(t => structuredClone(t)),
};
const ifc = writeIFC(buildWriteIFCInput(S(), 'planOnly'));

ok('0a opzet: L is lopend op 100 % zonder werkelijk einde',
  byName(before.tasks, 'L').status === 'STARTED' && byName(before.tasks, 'L').time.completion === 1
  && !byName(before.tasks, 'L').time.actualFinish);

const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
async function openIfc(text: string): Promise<{ doc: DocumentPayload; resave: () => string }> {
  const store = createAppStoreContext().store;
  store.getState().applyOpenedImport(await parseOpenedFile({ name: 'rondgang.ifc', text }), OPEN);
  return {
    doc: store.getState().getOpenDocumentPayloads()[0].payload,
    resave: () => writeIFC(buildWriteIFCInput(store.getState(), 'planOnly')),
  };
}
const progress = (t: Task) => ({
  status: t.status, completion: t.time.completion,
  actualStart: t.time.actualStart ?? null, actualFinish: t.time.actualFinish ?? null,
  remainingTime: t.time.remainingTime ?? null, remainingMinutes: t.time.remainingMinutes ?? null,
});
const dates = (t: Task) => {
  const x = t.time;
  const totalFloat = Math.round(x.totalFloat * 1e6) / 1e6;
  return [x.scheduleStart, x.scheduleFinish, x.earlyStart, x.earlyFinish, x.lateStart, x.lateFinish, totalFloat, x.isCritical];
};

{
  eq('1a L (lopend, 100 %): IfcTask.Status', argsOf(ifc, 'IFCTASK', 'L')[STATUS], "'STARTED'");
  for (const name of ['B', 'V', 'H', 'N']) {
    eq(`1b ${name}: IfcTask.Status blijft $`, argsOf(ifc, 'IFCTASK', name)[STATUS], '$');
  }
  const statussen = ifc.split('\n').map(l => l.match(lineRe('IFCTASK'))).filter(m => m !== null)
    .map(m => splitArgs(m[2])[STATUS]).filter(v => v !== '$');
  eq('1c precies één IFCTASK met een Status', statussen, ["'STARTED'"]);
  eq('1d IFCTASK heeft 13 argumenten (spec-lay-out)', argsOf(ifc, 'IFCTASK', 'L').length, 13);
}

{
  const store = createAppStoreContext().store;
  const G = () => store.getState();
  G().newProject();
  G().setProject({ startDate: '2015-01-05', statusDate: '2015-01-07' });
  const f1 = G().addTask({ name: 'F1', time: createDefaultTaskTime('2015-01-05', 2) });
  const k1 = G().addTask({ name: 'K1', time: createDefaultTaskTime('2015-01-05', 2) });
  const m1 = G().addTask({ name: 'M1', isMilestone: true, time: { ...createDefaultTaskTime('2015-01-09', 0), scheduleDuration: 0 } });
  const f2 = G().addTask({ name: 'F2', time: createDefaultTaskTime('2015-01-05', 2) });
  const k2 = G().addTask({ name: 'K2', time: createDefaultTaskTime('2015-01-05', 20) });
  const w = G().addTask({ name: 'W', time: createDefaultTaskTime('2015-01-05', 2) });
  const f3 = G().addTask({ name: 'F3', time: createDefaultTaskTime('2015-01-05', 2) });
  const k3 = G().addTask({ name: 'K3', time: createDefaultTaskTime('2015-01-05', 2) });
  const f4 = G().addTask({ name: 'F4', time: createDefaultTaskTime('2015-01-05', 2) });
  const k4 = G().addTask({ name: 'K4', time: createDefaultTaskTime('2015-01-05', 2) });
  G().indentTasks([k1, m1]);
  G().indentTasks([k2]);
  G().indentTasks([k3]);
  G().indentTasks([k4]);
  G().runCPM();
  const at = (id: string) => G().tasks.find(t => t.id === id)!;
  G().updateTask(k1, { status: 'COMPLETED', time: { ...at(k1).time, completion: 1, actualStart: '2015-01-05', actualFinish: '2015-01-06' } });
  G().updateTask(k2, { status: 'STARTED', time: { ...at(k2).time, completion: 0.9996, actualStart: '2015-01-05' } });
  G().updateTask(w, { status: 'STARTED', time: { ...at(w).time, completion: 1, actualStart: '2015-01-05', actualFinish: '2015-01-06' } });
  G().updateTask(k3, { status: 'STARTED', time: { ...at(k3).time, completion: 1, actualStart: '2015-01-05' } });
  G().updateTask(k4, { status: 'COMPLETED', time: { ...at(k4).time, completion: 1, actualStart: '2015-01-05', actualFinish: '2015-01-06' } });
  G().runCPM();
  const fase = (id: string) => [at(id).status, at(id).time.completion, at(id).time.actualFinish ?? null];
  eq('1e opzet: F1 (taken klaar + niet-gestarte mijlpaal) is STARTED op 1 zonder werkelijk einde', fase(f1), ['STARTED', 1, null]);
  eq('1f opzet: F2 (99,96 %) is STARTED op 1 zonder werkelijk einde', fase(f2), ['STARTED', 1, null]);
  eq('1g opzet: W is STARTED op 1 mét werkelijk einde', fase(w), ['STARTED', 1, "2015-01-06T16:00"]);
  const fIfc = writeIFC(buildWriteIFCInput(G(), 'planOnly'));
  eq('1h F1 (fase): IfcTask.Status blijft $', argsOf(fIfc, 'IFCTASK', 'F1')[STATUS], '$');
  eq('1i F2 (fase): IfcTask.Status blijft $', argsOf(fIfc, 'IFCTASK', 'F2')[STATUS], '$');
  eq('1j W (werkelijk einde): IfcTask.Status blijft $', argsOf(fIfc, 'IFCTASK', 'W')[STATUS], '$');
  eq('1k K2 (99,96 %, taak): IfcTask.Status blijft $', argsOf(fIfc, 'IFCTASK', 'K2')[STATUS], '$');

  eq('116-0 F3 rolt op naar 100 % zonder werkelijk einde',
    [at(f3).time.completion, at(f3).time.actualFinish ?? null], [1, null]);
  let round = fIfc;
  for (let n = 1; n <= 2; n++) {
    const parsed = readIFC(round);
    for (const id of [f1, f2, f3, f4]) {
      const source = at(id);
      const back = byName(parsed.tasks, source.name);
      eq(`116-${n} ${source.name}: actuals, percentage en restduur blijven zoals de rollup`,
        { ...progress(back), status: undefined }, { ...progress(source), status: undefined });
      eq(`116-${n} ${source.name}: opgeslagen datums en speling blijven staan`, dates(back), dates(source));
      eq(`116-${n} ${source.name}: alleen een vastgelegd werkelijk einde betekent voltooid`,
        back.status, id === f4 ? 'COMPLETED' : 'STARTED');
    }
    eq(`116-${n} M1 blijft niet gestart zonder actuals`, progress(byName(parsed.tasks, 'M1')),
      progress(at(m1)));
    eq(`116-${n} K3 blijft lopend op 100 % zonder werkelijk einde`, progress(byName(parsed.tasks, 'K3')),
      progress(at(k3)));
    round = writeIFC(parsed);
  }
}

const opened = await openIfc(ifc);
const after = opened.doc;
{
  for (const name of ['L', 'B', 'V', 'H', 'N']) {
    eq(`2a ${name}: voortgang gelijk na opslaan en heropenen`, progress(byName(after.tasks, name)), progress(byName(before.tasks, name)));
    eq(`2b ${name}: datums, speling en kritiek gelijk na de solve`, dates(byName(after.tasks, name)), dates(byName(before.tasks, name)));
  }
  eq('2c L blijft lopend', byName(after.tasks, 'L').status, 'STARTED');
  eq('2d V blijft voltooid met zijn eigen werkelijke einde', [byName(after.tasks, 'V').status, byName(after.tasks, 'V').time.actualFinish],
    ['COMPLETED', "2015-01-06T16:00"]);
  const again = opened.resave();
  eq('2e tweede ronde: L houdt Status STARTED', argsOf(again, 'IFCTASK', 'L')[STATUS], "'STARTED'");
}

const oud = setTaskStatus(ifc, 'L', '$');
{
  const r = readIFC(oud);
  const l = byName(r.tasks, 'L');
  eq('3a oud bestand: L wordt voltooid', l.status, 'COMPLETED');
  eq('3b oud bestand: werkelijk einde op de statusdatum', l.time.actualFinish, '2015-01-07');
  const oudDoc = (await openIfc(oud)).doc;
  ok(`3c oud bestand: datums van L of B veranderen (oud gedrag; kreeg L ${JSON.stringify(dates(byName(oudDoc.tasks, 'L')))})`,
    JSON.stringify(['L', 'B'].map(n => dates(byName(oudDoc.tasks, n))))
    !== JSON.stringify(['L', 'B'].map(n => dates(byName(before.tasks, n)))));
}

{
  const metAf = editLines(ifc, 'IFCTASKTIME', (a) => a[0] === "'L Time'",
    (a) => { a[TT_ACTUAL_FINISH] = "'2015-01-15T17:00:00'"; return a; });
  ok('4a controle: de bewerking zette een werkelijk einde in het bestand', metAf !== ifc);
  const l = byName(readIFC(metAf).tasks, 'L');
  eq('4b STARTED + werkelijk einde: voltooid', l.status, 'COMPLETED');
  ok(`4c STARTED + werkelijk einde: het werkelijke einde uit het bestand wint (kreeg ${l.time.actualFinish})`,
    !!l.time.actualFinish && l.time.actualFinish.startsWith('2015-01-15'));
}

{
  const zonder = byName(readIFC(ifc).tasks, 'H');
  const met = byName(readIFC(setTaskStatus(ifc, 'H', "'STARTED'")).tasks, 'H');
  eq('5a H (50 %) met Status STARTED leest als zonder', progress(met), progress(zonder));
  eq('5b H blijft lopend op 50 %', [met.status, met.time.completion], ['STARTED', 0.5]);
  const n = byName(readIFC(setTaskStatus(ifc, 'N', "'STARTED'")).tasks, 'N');
  eq('5c N (0 %) met Status STARTED blijft niet gestart', [n.status, n.time.actualStart ?? null], ['NOT_STARTED', null]);
}

{
  const oudL = byName(readIFC(oud).tasks, 'L');
  for (const tekst of ["'started'", "'ACTIVE'", "'IN PROGRESS'", "'COMPLETED'", "''"]) {
    const l = byName(readIFC(setTaskStatus(ifc, 'L', tekst)).tasks, 'L');
    eq(`6 Status ${tekst}: leest als een oud bestand`, progress(l), progress(oudL));
  }
}

{
  const legacy = editLines(ifc, 'IFCTASK', () => true, (a) => { a.splice(WORK_METHOD, 1); return a; });
  eq('7a controle: L heeft nu 12 argumenten', argsOf(legacy, 'IFCTASK', 'L').length, 12);
  eq('7b controle: Status staat nog op index 7', argsOf(legacy, 'IFCTASK', 'L')[STATUS], "'STARTED'");
  const r = readIFC(legacy);
  eq('7c legacy: L blijft lopend', progress(byName(r.tasks, 'L')), progress(byName(readIFC(ifc).tasks, 'L')));
  eq('7d legacy: L status STARTED', byName(r.tasks, 'L').status, 'STARTED');
  eq('7e legacy: V blijft voltooid', byName(r.tasks, 'V').status, 'COMPLETED');
  const legacyOud = editLines(oud, 'IFCTASK', () => true, (a) => { a.splice(WORK_METHOD, 1); return a; });
  eq('7f legacy met $: L voltooid zoals voorheen', byName(readIFC(legacyOud).tasks, 'L').status, 'COMPLETED');
}

{
  const mk = (id: string, extra: Partial<Task['time']>, unit: 'days' | 'hours' = 'days'): Task => ({
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...createDefaultTaskTime('2015-01-05', 20), durationUnit: unit,
      ...(unit === 'hours' ? { durationMinutes: 20 * 8 * 60 } : {}), ...extra },
  });
  const fysiek = mk('fysiek', { completion: 1, actualStart: '2015-01-05T08:00', remainingMinutes: 48000 }, 'hours');
  const duur = mk('duur', { completion: 1, actualStart: '2015-01-05', remainingTime: 5 });
  const ander = mk('ander', { completion: 1, actualStart: '2015-01-05' });
  const metAf = mk('metAf', { completion: 1, actualStart: '2015-01-05', actualFinish: '2015-01-20' });
  const half = mk('half', { completion: 0.5, actualStart: '2015-01-05' });
  normalizeImportedProgress([fysiek, duur, ander, metAf, half], '2015-01-07', new Set(['fysiek', 'duur', 'metAf', 'half']));
  eq('8a urentaak in de set: lopend, geen werkelijk einde, restduur zoals vastgelegd',
    [fysiek.status, fysiek.time.actualFinish ?? null, fysiek.time.remainingMinutes, fysiek.time.remainingTime ?? null],
    ['STARTED', null, 48000, null]);
  eq('8b dagtaak in de set: lopend, geen werkelijk einde, vastgelegde restduur 5 blijft',
    [duur.status, duur.time.actualFinish ?? null, duur.time.remainingTime ?? null], ['STARTED', null, 5]);
  eq('8c taak niet in de set: voltooid op de statusdatum', [ander.status, ander.time.actualFinish], ['COMPLETED', '2015-01-07']);
  eq('8d in de set mét werkelijk einde: voltooid, eigen einde', [metAf.status, metAf.time.actualFinish], ['COMPLETED', '2015-01-20']);
  eq('8e in de set onder 100 %: lopend zoals altijd', [half.status, half.time.completion], ['STARTED', 0.5]);
}

{
  const input = buildWriteIFCInput(createAppStoreContext().store.getState(), 'planOnly');
  const child: Task = {
    id: 'bron-kind', name: 'bron-kind', description: '', wbsCode: '1.1', taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: 'bron-fase', childIds: [], resourceIds: [],
    time: createDefaultTaskTime('2015-01-12', 5),
  };
  const variants: { name: string; time: Partial<Task['time']>; extra?: Partial<Task>; status: Task['status'] }[] = [
    { name: '100 % zonder actuals', time: { completion: 1 }, status: 'STARTED' },
    { name: '100 % met start', time: { completion: 1, actualStart: '2015-01-08' }, status: 'STARTED' },
    { name: '62 % met eigen einde zonder start', time: { completion: 0.62, actualFinish: '2015-01-09' }, status: 'COMPLETED' },
    { name: '0 % met start', time: { completion: 0, actualStart: '2015-01-08' }, status: 'STARTED' },
    { name: '0 % zonder actuals', time: { completion: 0 }, status: 'NOT_STARTED' },
    { name: 'handmatig 100 %', time: { completion: 1 }, extra: { manuallyScheduled: true }, status: 'STARTED' },
    { name: 'lege fase 100 %', time: { completion: 1 }, extra: { isSummary: true, childIds: [] }, status: 'STARTED' },
  ];
  for (const variant of variants) {
    const source: Task = {
      ...child, id: 'bron-fase', name: 'bron-fase', parentId: null, childIds: [child.id],
      ...variant.extra,
      time: { ...createDefaultTaskTime('2015-01-05', 10), remainingTime: 3, ...variant.time },
    };
    let text = writeIFC({ ...input, project: { ...input.project, startDate: '2015-01-05', statusDate: '2015-01-07' },
      tasks: [source, ...(source.childIds.length ? [child] : [])] });
    for (let n = 1; n <= 2; n++) {
      const parsed = readIFC(text);
      const back = byName(parsed.tasks, source.name);
      eq(`116-bron ${variant.name}, ronde ${n}: voortgang en actuals exact uit bestand`,
        progress(back), { ...progress(source), status: variant.status });
      eq(`116-bron ${variant.name}, ronde ${n}: datums exact uit bestand`, dates(back), dates(source));
      text = writeIFC(parsed);
    }
  }
}

if (diffs.length === 0) {
  console.log(`OK  ifc-lopend-100: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  ifc-lopend-100: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
