import { readFileSync } from 'node:fs';
import { applyEdit, basicEdits, cloneDomain, openForeign, settle, type Domain } from './ifcMergeKern';
import { MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { sourceFormProblems, type SourceFormLeaf } from '@/services/ifc/foreign/sourceForm';
import { scanStep } from '@/services/ifc/foreign/stepScanner';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import type { ImportResult } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';

const FACTOR = 1.5;
let failures = 0;
const check = (label: string, good: boolean, detail = '') => {
  console.log(`${good ? 'OK' : 'XX'}  ${label}${detail ? `: ${detail}` : ''}`);
  if (!good) failures++;
};

type AnyFunction = (this: unknown, ...args: unknown[]) => unknown;
const prototype = Array.prototype as unknown as Record<string, AnyFunction>;
const tally = new Map<string, number>();
let counting = false;
const add = (kind: string, n: number) => { tally.set(kind, (tally.get(kind) ?? 0) + n); };
for (const kind of ['find', 'findIndex', 'findLast', 'findLastIndex', 'filter', 'some', 'every']) {
  const original = prototype[kind];
  prototype[kind] = function (this: unknown, callback: unknown, thisArg?: unknown) {
    if (!counting) return original.call(this, callback, thisArg);
    const visit = function (this: unknown, ...args: unknown[]) { add(kind, 1); return (callback as AnyFunction).apply(this, args); };
    return original.call(this, visit, thisArg);
  } as AnyFunction;
}
for (const kind of ['includes', 'indexOf', 'lastIndexOf', 'shift', 'unshift']) {
  const original = prototype[kind];
  prototype[kind] = function (this: unknown, ...args: unknown[]) {
    if (counting) add(kind, (this as unknown[]).length);
    return original.apply(this, args);
  } as AnyFunction;
}
{
  const original = prototype.splice;
  prototype.splice = function (this: unknown, ...args: unknown[]) {
    if (counting) {
      const length = (this as unknown[]).length, start = Number(args[0] ?? 0);
      add('splice', Math.max(0, length - (start < 0 ? Math.max(0, length + start) : Math.min(start, length))));
    }
    return original.apply(this, args);
  } as AnyFunction;
}

async function counted<T>(run: () => Promise<T>): Promise<{ value: T; work: number; byKind: [string, number][] }> {
  tally.clear();
  counting = true;
  try {
    const value = await run();
    return { value, work: [...tally.values()].reduce((a, b) => a + b, 0), byKind: [...tally].sort((a, b) => b[1] - a[1]) };
  } finally {
    counting = false;
  }
}

const base = await settle(new Uint8Array(readFileSync(new URL('../fixtures/ifc-foreign/eigen-plus-model.ifc', import.meta.url))));
const opened = await openForeign(base);
const source = opened.ifcSource!;

async function written(d: Domain, from = source): Promise<Uint8Array> {
  try {
    return (await prepareIfcWrite(d, from)).bytes;
  } catch (e) {
    if (e instanceof MergeNeedsPhase2Error) throw new Error(`de merge weigerde: ${e.cases.slice(0, 3).map(c => `${c.kind}: ${c.detail}`).join(' | ')}`);
    throw e;
  }
}

function withTasks(n: number): Domain {
  const d = cloneDomain(opened);
  const template = d.tasks.find(t => !t.isSummary && !t.isMilestone && !!t.time && !t.childIds?.length)!;
  d.tasks = [...d.tasks, ...Array.from({ length: n }, (_, i) => ({
    ...structuredClone(template), id: `perf-${i}`, name: `Taak ${i}`, parentId: null, childIds: [], resourceIds: [], wbsCode: `P${i}`,
    notes: [{ id: `note-${i}`, text: 'test', done: false }],
  }))];
  return d;
}

function withHolidays(n: number): Domain {
  const d = cloneDomain(opened);
  const day = (i: number) => new Date(Date.UTC(2040, 0, 1) + i * 86400000).toISOString().slice(0, 10);
  d.calendar = { ...d.calendar, holidays: [...d.calendar.holidays, ...Array.from({ length: n }, (_, i) => ({ name: `Vrij ${i}`, startDate: day(i), endDate: day(i) }))] };
  return d;
}

function largestList(bytes: Uint8Array, lists: Readonly<Record<string, number>>): { type: string; members: number } {
  const index = scanStep(bytes);
  let best = { type: '', members: 0 };
  for (let i = 0; i < index.count; i++) {
    const arg = index.isEntity(i) ? lists[index.type(i)] : undefined;
    if (arg === undefined) continue;
    const members = index.refsAt(i, arg).length;
    if (members > best.members) best = { type: index.type(i), members };
  }
  return best;
}

async function saveAfter(bytes: Uint8Array, edit: (d: Domain) => void, refusal = false) {
  const reopened = await openForeign(bytes);
  const d = cloneDomain(reopened);
  edit(d);
  return counted(async () => {
    try {
      await prepareIfcWrite(d, reopened.ifcSource!);
      return 'schreef';
    } catch (e) {
      if (refusal && e instanceof MergeNeedsPhase2Error) return 'weigerde';
      throw e;
    }
  });
}

const rename = (d: Domain) => {
  const target = d.tasks.find(t => t.id === 'perf-0') ?? d.tasks.find(t => !t.childIds.length)!;
  d.tasks = d.tasks.map(t => (t.id === target.id ? { ...t, name: `${t.name} gewijzigd` } : t));
};
const laterWorkingHours = (d: Domain) => {
  d.calendar = { ...d.calendar, workStartHour: d.calendar.workStartHour + 1, workEndHour: d.calendar.workEndHour + 1 };
};

async function linear(label: string, unit: string, sizes: readonly number[], measure: (n: number) => Promise<{ work: number; byKind: [string, number][] }>) {
  const rows: { n: number; perUnit: number }[] = [];
  for (const n of sizes) {
    const { work, byKind } = await measure(n);
    rows.push({ n, perUnit: work / n });
    console.log(`    ${label}, ${n}: werk ${work} (${(work / n).toFixed(1)} per ${unit}); ${byKind.slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  const [first] = rows;
  for (const row of rows.slice(1)) {
    const ratio = row.perUnit / first.perUnit;
    check(`${label}: werk per ${unit} bij ${row.n} binnen ${FACTOR} keer dat bij ${first.n}`, ratio <= FACTOR, `verhouding ${ratio.toFixed(2)}`);
  }
}

async function grownWithList(label: string, n: number, d: Domain, lists: Readonly<Record<string, number>>): Promise<Uint8Array> {
  const bytes = await written(d);
  const list = largestList(bytes, lists);
  check(`${label}, ${n}: de bron heeft een lijst met minstens ${n} leden`, list.members >= n, `${list.type} met ${list.members}`);
  return bytes;
}

function withLags(n: number): string {
  const d = cloneDomain(opened);
  const template = d.tasks.find(t => !t.isSummary && !t.isMilestone && !!t.time && !t.childIds?.length)!;
  d.tasks = Array.from({ length: n }, (_, i) => ({ ...structuredClone(template), id: `t-${i}`, name: `Taak ${i}`, parentId: null, childIds: [], resourceIds: [], wbsCode: `${i}` }));
  const relation = d.sequences[0];
  d.sequences = Array.from({ length: n - 1 }, (_, i) => ({ ...structuredClone(relation), id: `s-${i}`, predecessorId: `t-${i}`, successorId: `t-${i + 1}`,
    type: 'FINISH_START' as const, lagDays: 2, lagMinutes: 960, lagPercent: undefined, lagUnit: undefined }));
  d.assignments = []; d.baselines = []; d.activeBaselineId = null;
  return writeIFC(d);
}

const bonsai4d = () => readFileSync(new URL('../fixtures/ifc-foreign/bonsai-4d.ifc', import.meta.url), 'latin1');
const latin1 = (text: string) => Uint8Array.from(text, c => c.charCodeAt(0));
const GUID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const guid = (k: number, prefix: number) => {
  let tail = '';
  for (let x = k, j = 0; j < 8; j++, x = Math.floor(x / 64)) tail = GUID_ALPHABET[x % 64] + tail;
  return `${prefix}${'A'.repeat(13)}${tail}`;
};

function bonsaiWithTasks(n: number): Uint8Array {
  const text = bonsai4d();
  const swap = (t: string, from: string, to: string) => {
    const parts = t.split(from);
    if (parts.length !== 2) throw new Error(`bonsai-4d.ifc: ${from} staat er niet precies één keer in`);
    return parts.join(to);
  };
  const added: string[] = [];
  const tasks: string[] = [];
  for (let k = 0; k < n; k++) {
    const task = 100000 + 3 * k;
    tasks.push(`#${task}`);
    added.push(`#${task}=IFCTASK('${guid(k, 1)}',#107,'Wand ${k}',$,$,'1.${k + 3}',$,$,$,.F.,$,#${task + 1},.NOTDEFINED.);`,
      `#${task + 1}=IFCTASKTIME($,$,$,$,'P5D','2026-02-07T09:00:00','2026-02-11T17:00:00',$,$,$,$,$,$,$,$,$,$,$,$,$);`,
      `#${task + 2}=IFCRELASSIGNSTOPROCESS('${guid(k, 2)}',#119,$,$,(#118,#30),$,#${task},#121);`);
  }
  let big = swap(swap(text, '(#104,#108));', `(#104,#108,${tasks.join(',')}));`),
    '(#104,#108,#144,#160),$,#98);', `(#104,#108,#144,#160,${tasks.join(',')}),$,#98);`);
  const end = big.lastIndexOf('ENDSEC;');
  big = `${big.slice(0, end)}${added.join('\n')}\n${big.slice(end)}`;
  return latin1(big);
}

function bonsaiWithRelationsOnOneTask(n: number): Uint8Array {
  const rows = Array.from({ length: n }, (_, k) => `#${200000 + k}=IFCRELASSIGNSTOPROCESS('${guid(k, 3)}',#119,$,$,(#118),$,#104,#121);`);
  return latin1(bonsai4d().replace(/^#120=.*$/m, () => rows.join('\n')));
}

const grownTasks = new Map<number, Uint8Array>();
await linear('opslaan na een naamswijziging', 'taak', [1000, 2000, 4000], async n => {
  const bytes = await grownWithList('taken', n, withTasks(n), { IFCRELNESTS: 5, IFCRELASSIGNSTOCONTROL: 4 });
  grownTasks.set(n, bytes);
  return saveAfter(bytes, rename);
});
await linear('feestdagen in één kalender', 'lid', [1000, 2000, 4000],
  async n => saveAfter(await grownWithList('feestdagen', n, withHolidays(n), { IFCWORKCALENDAR: 7 }), rename));
await linear('opslaan na een verschoven werktijd (de voortoets laat velden vallen)', 'taak', [1000, 2000],
  n => saveAfter(grownTasks.get(n)!, laterWorkingHours));
await linear('lezen van relaties met een lag in uren', 'relatie', [1000, 2000, 4000], n => {
  const text = withLags(n);
  return counted(async () => readIFC(text));
});
await linear('gemengde toewijzingen zoals Bonsai', 'taak', [1000, 2000, 4000], n => saveAfter(bonsaiWithTasks(n), rename, true));
await linear('veel toewijzingsrelaties van Bonsai aan één taak, dezelfde ploeg', 'relatie', [250, 500, 1000], async n => {
  const bytes = bonsaiWithRelationsOnOneTask(n);
  const reopened = await openForeign(bytes);
  const task = reopened.tasks.find(t => t.name === 'Wand A bouwen')!;
  check(`veel relaties aan één taak, ${n}: de lezer leest elke relatie als een toewijzing`, reopened.assignments.filter(a => a.taskId === task.id).length === n);
  return saveAfter(bytes, d => { d.tasks.find(t => t.id === task.id)!.name = 'Wand A gewijzigd'; });
});

{
  const d = cloneDomain(opened);
  const task = d.tasks.find(t => !t.childIds.length)!;
  const back = (tasks: Domain['tasks']) => ({ ...structuredClone(d), tasks: structuredClone(tasks), timeModel: MINUTE_MODEL_TIME_MODEL }) as unknown as ImportResult;
  const leaf: SourceFormLeaf = { kind: 'task', id: task.id, field: 'name' };
  const twin = { ...structuredClone(task), name: 'Tweeling' };
  const rest = d.tasks.filter(t => t.id !== task.id);
  const problems = (domainTasks: Domain['tasks'], backTasks: Domain['tasks'], leaves: readonly SourceFormLeaf[] = [leaf]) =>
    sourceFormProblems(leaves, { ...d, tasks: domainTasks }, back(backTasks));
  check('twee taken met hetzelfde id in het domein: de eerste telt', problems([task, ...rest, twin], [task, ...rest]).length === 0);
  check('twee taken met hetzelfde id in het domein, de tweeling eerst: de eerste telt', problems([twin, ...rest, task], [task, ...rest]).length === 1);
  check('twee taken met hetzelfde id na herlezen: de eerste telt', problems([task, ...rest], [task, ...rest, twin]).length === 0);
  check('twee taken met hetzelfde id na herlezen, de tweeling eerst: de eerste telt', problems([task, ...rest], [twin, ...rest, task]).length === 1);
  const gone: SourceFormLeaf = { kind: 'task', id: 'verdwenen-taak', field: 'name' };
  const missing = problems(d.tasks, d.tasks, [gone]);
  check('een veld van een verdwenen taak: ontbreekt na herlezen', missing.length === 1 && missing[0] === 'taak verdwenen-taak, name: ontbreekt na herlezen', JSON.stringify(missing));
  check('geen velden: niets na te gaan', problems(d.tasks, [], []).length === 0);
  check('een lege takenlijst na herlezen: elk veld ontbreekt', problems(d.tasks, [], [leaf, gone]).length === 2);
}

{
  const text = Array.from(base, b => String.fromCharCode(b)).join('');
  const lines = text.split('\n');
  const entity = /^#(\d+)=([A-Z0-9_]+)\((.*)\);$/;
  const parsed = lines.map((line, at) => { const m = entity.exec(line); return m ? { at, id: Number(m[1]), type: m[2], args: m[3] } : undefined; });
  const maxId = Math.max(...parsed.map(p => p?.id ?? 0));
  const topLevel = (args: string) => {
    const out: string[] = [];
    let depth = 0, quoted = false, current = '';
    for (const c of args) {
      if (c === "'") quoted = !quoted;
      if (!quoted && c === '(') depth++;
      if (!quoted && c === ')') depth--;
      if (!quoted && depth === 0 && c === ',') { out.push(current); current = ''; continue; }
      current += c;
    }
    return [...out, current];
  };
  const members = (token: string) => token.slice(1, -1).split(',').filter(Boolean);
  const variant = (type: string, arg: number, fits: (list: string[]) => boolean, change: (list: string[]) => string[]) => {
    const p = parsed.find(x => x?.type === type && fits(members(topLevel(x.args)[arg])))!;
    const args = topLevel(p.args);
    args[arg] = `(${change(members(args[arg])).join(',')})`;
    const copy = [...lines];
    copy[p.at] = `#${p.id}=${p.type}(${args.join(',')});`;
    return copy;
  };
  const twoOrMore = (list: string[]) => list.length >= 2;
  const doubledWorkTime = () => {
    const calendar = parsed.find(x => x?.type === 'IFCWORKCALENDAR' && members(topLevel(x.args)[7]).length > 0)!;
    const first = Number(members(topLevel(calendar.args)[7])[0].slice(1));
    const workTime = parsed.find(x => x?.id === first)!;
    const copy = variant('IFCWORKCALENDAR', 7, list => list.length > 0, list => [...list, `#${maxId + 1}`]);
    copy.splice(workTime.at + 1, 0, `#${maxId + 1}=${workTime.type}(${workTime.args});`);
    return copy;
  };
  const cases: [string, string[], string][] = [
    ['een lid twee keer achteraan in één IfcRelNests', variant('IFCRELNESTS', 5, twoOrMore, l => [...l, l[0]]),
      'niet-gedragen: IFCRELNESTS #86, argument 5: (#51,#53,#51) → ( #51,#53)'],
    ['een lid twee keer vooraan in één IfcRelNests', variant('IFCRELNESTS', 5, twoOrMore, l => [l[0], ...l]),
      'niet-gedragen: IFCRELNESTS #86, argument 5: (#51,#51,#53) → ( #51,#53)'],
    ['een lid twee keer in IfcRelAssignsToControl', variant('IFCRELASSIGNSTOCONTROL', 4, twoOrMore, l => [...l, l[0]]),
      'niet-gedragen: IFCRELASSIGNSTOCONTROL #174, argument 4: (#47,#49,#51,#53,#55,#57,#59,#61,#63,#65,#67,#69,#71,#73,#75 → (#47,#49,#51,#53,#55,#57,#59,#61,#63,#65,#67,#69,#71,#73,#75'],
    ['een property twee keer in één pset', variant('IFCPROPERTYSET', 4, twoOrMore, l => [...l, l[0]]),
      'niet-gedragen: IFCPROPERTYSET #122 (OPS_Resource), argument 4: (#118,#119,#120,#121,#118) → (#466,#467,#468,#469)'],
    ['een lege ledenlijst', variant('IFCRELNESTS', 5, l => l.length === 1, () => []),
      'niet-gedragen: IFCRELNESTS #144, argument 5: () → (#110)'],
    ['een relatie met één lid', variant('IFCRELNESTS', 5, twoOrMore, l => [l[0]]),
      'niet-gedragen: IFCRELNESTS #90, argument 5: (#47,#49,#55,#67,#79) → (#47,#49,#53,#55,#67,#79)'],
    ['een lid dat naar een verdwenen stuk wijst', variant('IFCRELNESTS', 5, twoOrMore, l => [...l, `#${maxId + 1000}`]), 'schreef'],
    ['twee gelijke feestdagen in één kalender', doubledWorkTime(), 'schreef'],
  ];
  for (const [label, copy, expected] of cases) {
    const bytes = Uint8Array.from(copy.join('\n'), c => c.charCodeAt(0));
    const reopened = await openForeign(bytes);
    const rename = basicEdits(cloneDomain(reopened)).find(e => e.kind === 'hernoemen')!;
    const edited = await applyEdit(rename, cloneDomain(reopened));
    let outcome: string;
    try {
      await prepareIfcWrite(edited, reopened.ifcSource!);
      outcome = 'schreef';
    } catch (e) {
      if (!(e instanceof MergeNeedsPhase2Error)) throw e;
      outcome = e.cases.map(c => `${c.kind}: ${c.detail}`).join(' | ');
    }
    check(`${label}: zelfde uitkomst als main`, outcome === expected, outcome === expected ? '' : outcome);
  }
}

console.log(failures === 0 ? 'OK  werk lineair en randgevallen gelijk' : `XX  ${failures} mislukt`);
process.exitCode = failures === 0 ? 0 : 1;
