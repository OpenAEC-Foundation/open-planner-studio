import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { refsOutsideText } from '@/services/ifc/foreign/lossCheck';
import { checkMergeOutput, MergeNeedsPhase2Error, prepareIfcWrite, type OwnOutputCheck } from '@/services/ifc/foreign/mergeWriter';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { BASELINE_HEADS, type RestoredOwnSlots } from '@/services/ifc/foreign/ownGroups';
import { mappedChunks, type SourcePieceSlots } from '@/services/ifc/foreign/sourceSlots';
import { sourceSlotArgs, writerAlwaysWrites } from '@/services/ifc/foreign/sourceSlotWrite';
import type { StepIndex } from '@/services/ifc/foreign/stepScanner';
import { IFC_SLOT_TABLES, slotTableNamed, slotTableOf, type IfcSlotTable } from '@/services/ifc/ifcSlotTables';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import { documentContentOf } from '@/state/documentSaveState';
import { computeIfcOutputHere, prepareIfcOutput, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import { cloneDomain, doubleMemberships, lossProbe, mergeProblems, openForeign, sameBytes, tryMerge, type Domain, type Opened } from './ifcMergeKern';
import type { OutLine } from '@/services/ifc/foreign/lossCheck';
import { lengthen, loadStore, openInStore, recalculated, storeEdit } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { InProcessWorker } from './inProcessSaveWorker';
import { regelCOf } from './ifcRegelC';
import { bonsaiPlanning, groupOf, NOT_CARRIED, PIN_FILE, ROOT, SAME_AS_WRITER, soort } from './ifcBonsaiPin';
import { localTodayIso } from '@/utils/dateUtils';
import type { Task } from '@/types/task';

installDeterminism();
const dump = (name: string, bytes: Uint8Array) => {
  const dir = process.env.OPS_MERGE_UITVOER;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), bytes);
};
let checks = 0;
const fails: string[] = [];
const ok = (label: string, condition: boolean) => { checks++; if (!condition) fails.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  const same = JSON.stringify(got) === JSON.stringify(want);
  ok(same ? label : `${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`, same);
};

function wantsSource(table: IfcSlotTable, k: number, changed: ReadonlySet<number>): boolean {
  const own = (j: number) => soort(table, j) === 'constant' || (soort(table, j) === 'domein' && !changed.has(j));
  const group = groupOf(table, k);
  if (!group) return own(k);
  const [main, ...dependents] = group;
  return own(main) && dependents.every(d => !changed.has(d));
}

let ruleSlots = 0;
for (const table of IFC_SLOT_TABLES) {
  const source = table.slots.map((slot, k) => (slot.bronverwijzing ? `(#${900 + k})` : `'bron ${k}'`));
  const written = table.slots.map((_, k) => `'writer ${k}'`);
  const piece: SourcePieceSlots = { entity: table.entities[0], table: table.naam, slots: new Map(table.slots.map((s, k) => [s.key, source[k]])) };
  const expected = (changed: ReadonlySet<number>) => table.slots.map((_, k) => (wantsSource(table, k, changed) ? source[k] : written[k]));
  eq(`${table.naam}: niets veranderd`, sourceSlotArgs(table, piece, written), expected(new Set()));
  table.slots.forEach((slot, k) => {
    ruleSlots++;
    const at = `${table.naam}.${slot.key}`;
    const before = written.map((token, j) => (j === k ? `'eerder ${j}'` : token));
    eq(`${at}: de writer schrijft er nu iets anders dan bij openen`, sourceSlotArgs(table, piece, written, before), expected(new Set([k])));
    eq(`${at}: de planner wijzigde het veld waar de writer dit slot uit schrijft`,
      sourceSlotArgs(table, piece, written, written, j => j === k), expected(new Set([k])));
    if (!slot.bronverwijzing) {
      const withReference: SourcePieceSlots = { ...piece, slots: new Map(piece.slots).set(slot.key, '#77') };
      eq(`${at}: een brontoken met een # buiten de vaste lijst blijft niet staan`, sourceSlotArgs(table, withReference, written)[k], written[k]);
    }
    eq(`${at}: de verliescontrole laat dit slot aan de writer precies bij afgeleid of verwijzing, buiten een relatierol en een groep`,
      writerAlwaysWrites(table, k), (soort(table, k) === 'afgeleid' || soort(table, k) === 'verwijzing') && slot.rol === undefined && !groupOf(table, k));
  });
}


const fixture = bonsaiPlanning(PIN_FILE);
const sourceBytes = new TextEncoder().encode(fixture.text);
const sourceIndex = scanForeignStep(sourceBytes);
const opened = await openForeign(sourceBytes);
const source = opened.ifcSource!;
ok('de proef: het voorbeeld met de planning van Bonsai heeft een vreemd deel en een kaart', source.foreign === true && !!source.sourceSlots);
const pieces = [...mappedChunks(sourceIndex, source.sourceSlots!)];
const inMap = new Set(pieces.map(([, piece]) => piece.table));
for (const table of IFC_SLOT_TABLES) {
  if (!NOT_CARRIED.has(table.naam)) ok(`${table.naam}: de proef heeft een stuk van Bonsai in deze tabel`, inMap.has(table.naam));
}
eq('de proef: elk stuk van Bonsai staat in de kaart', [...fixture.carried].filter(id => !source.sourceSlots!.has(id)), []);
ok('de proef: een IfcConstructionProductResource van Bonsai in de kaart', pieces.some(([c]) => sourceIndex.type(c) === 'IFCCONSTRUCTIONPRODUCTRESOURCE'));

type Index = StepIndex;
const argsAt = (index: Index, chunk: number) => [...index.argTokens(chunk)!].map(t => t.trim());
function counterparts(out: Uint8Array): (chunk: number) => number {
  const index = scanForeignStep(out);
  const byGuid = new Map<string, number>();
  for (let c = 0; c < index.count; c++) if (index.isEntity(c) && index.type(c).startsWith('IFCREL')) byGuid.set(argsAt(index, c)[0], c);
  const owners = new Map<number, { owner: number; slot: number }>();
  for (const [chunk, piece] of pieces) {
    const table = slotTableNamed(piece.table)!;
    const slot = table.naam === 'IfcTask' ? 'taskTime' : table.naam === 'IfcRelSequence' ? 'timeLag' : undefined;
    const owned = slot && piece.owned ? sourceIndex.refAt(chunk, table.slots.findIndex(s => s.key === slot)) : -1;
    if (owned >= 0) owners.set(owned, { owner: chunk, slot: table.slots.findIndex(s => s.key === slot) });
  }
  const self = (chunk: number): number => {
    const owner = owners.get(chunk);
    if (owner) {
      const o = self(owner.owner);
      return o < 0 ? -1 : index.refAt(o, owner.slot);
    }
    if (sourceIndex.type(chunk).startsWith('IFCREL') && sourceIndex.type(chunk) !== 'IFCRELSEQUENCE') {
      return byGuid.get(argsAt(sourceIndex, chunk)[0]) ?? -1;
    }
    return index.chunkOf(sourceIndex.id(chunk));
  };
  return self;
}

function sourceTokenDifferences(out: Uint8Array): string[] {
  const outIndex = scanForeignStep(out), counterpart = counterparts(out), diffs: string[] = [];
  for (const [chunk, piece] of pieces) {
    const table = slotTableNamed(piece.table)!, o = counterpart(chunk);
    if (o < 0) continue;
    const before = argsAt(sourceIndex, chunk), after = argsAt(outIndex, o);
    table.slots.forEach((slot, k) => {
      if (!slot.rol && !writerAlwaysWrites(table, k) && after[k] !== before[k]) diffs.push(`${table.naam}.${slot.key}@${sourceIndex.id(chunk)}`);
    });
  }
  return diffs;
}

const innocent = (d: Domain) => storeEdit(d, s => { s.setProject({ name: `${d.project.name} (elders gewijzigd)` }); });
const innocentEdit = await innocent(cloneDomain(opened));
const first = await tryMerge(innocentEdit, source);
dump('bron.ifc', sourceBytes);
if (first.ok) dump('na-onschuldige-wijziging.ifc', first.bytes);
ok(`na een onschuldige wijziging elders schrijft de merge${first.ok ? '' : ` (${first.error.cases.slice(0, 3).map(c => `${c.kind}: ${c.detail}`).join(' | ')})`}`, first.ok);
const tested = new Set<string>();
if (first.ok) {
  eq('na een onschuldige wijziging elders: elk slot van Bonsai houdt zijn brontoken', sourceTokenDifferences(first.bytes), []);
  eq('na een onschuldige wijziging elders: regel C', regelCOf(sourceBytes, source, first.bytes, opened, innocentEdit), []);
  const outIndex = scanForeignStep(first.bytes);
  const counterpart = counterparts(first.bytes);
  for (const [chunk, piece] of pieces) {
    const table = slotTableNamed(piece.table)!;
    const o = counterpart(chunk);
    const label = `${piece.table} #${sourceIndex.id(chunk)}`;
    if (o < 0) { ok(`${label}: staat in de uitvoer`, false); continue; }
    eq(`${label}: het entiteittype uit de bron`, outIndex.type(o), sourceIndex.type(chunk));
    const before = argsAt(sourceIndex, chunk), after = argsAt(outIndex, o);
    table.slots.forEach((slot, k) => {
      const at = `${table.naam}.${slot.key}`;
      tested.add(at);
      const kind = soort(table, k);
      if (slot.rol === 'leden') {
        eq(`${label}.${slot.key}: dezelfde leden`, refsOutsideText(after[k]).sort(), refsOutsideText(before[k]).sort());
      } else if (slot.rol) {
        eq(`${label}.${slot.key}: dezelfde relating of hetzelfde lid`, after[k], before[k]);
      } else if (wantsSource(table, k, new Set())) {
        eq(`${label}.${slot.key} (${groupOf(table, k) ? 'groep' : kind}): het brontoken`, after[k], before[k]);
      } else if (kind === 'afgeleid') {
        if (fixture.distinct.has(at)) ok(`${label}.${slot.key} (afgeleid): de waarde van de writer, niet het brontoken ${before[k]}`, after[k] !== before[k]);
      } else {
        const targets = refsOutsideText(after[k]).map(id => outIndex.chunkOf(String(id)));
        const types = refsOutsideText(before[k]).map(id => sourceIndex.type(sourceIndex.chunkOf(String(id))));
        ok(`${label}.${slot.key} (verwijzing): wijst naar stukken in de uitvoer (${after[k]})`, targets.every(t => t >= 0));
        if (types.length > 0) eq(`${label}.${slot.key} (verwijzing): naar hetzelfde soort stuk`, [...new Set(targets.map(t => outIndex.type(t)))], [...new Set(types)]);
      }
    });
  }
}
for (const table of IFC_SLOT_TABLES) {
  if (NOT_CARRIED.has(table.naam)) continue;
  table.slots.forEach((slot, k) => {
    const at = `${table.naam}.${slot.key}`;
    ok(`${at}: getoetst van openen tot opslaan`, tested.has(at));
    const kind = soort(table, k);
    if ((kind === 'constant' || kind === 'afgeleid') && !groupOf(table, k) && !slot.rol) {
      ok(`${at}: de proef geeft dit slot een eigen brontoken, of zegt waarom niet`, fixture.distinct.has(at) || at in SAME_AS_WRITER);
    }
  });
}
for (const at of Object.keys(SAME_AS_WRITER)) ok(`${at}: de uitzondering bestaat in het register`, tested.has(at));

if (first.ok) {
  const probe = await lossProbe(sourceBytes, await innocent(cloneDomain(opened)), first.bytes);
  const named = (chunks: readonly number[]) => chunks.map(c => `${sourceIndex.type(c)} #${sourceIndex.id(c)}`);
  eq('de verliescontrole op de echte uitvoer: niets', named(probe.run(probe.o1)), []);
  const counterpart = counterparts(first.bytes);
  const outIdOf = (chunk: number) => Number(scanForeignStep(first.bytes).id(counterpart(chunk)));
  const changedAt = (chunk: number, key: string, token: (was: string) => string): OutLine[] => {
    const table = slotTableNamed([...pieces].find(([c]) => c === chunk)![1].table)!;
    const k = table.slots.findIndex(s => s.key === key), id = outIdOf(chunk);
    return probe.o1.map(line => (line.id === id ? { ...line, args: line.args.map((a, j) => (j === k ? token(a) : a)) } : line));
  };
  const taskPiece = pieces.find(([, p]) => p.table === 'IfcTask' && p.owned)!;
  const timePiece = pieces.find(([c, p]) => p.table === 'IfcTaskTime' && sourceIndex.refAt(taskPiece[0], 11) === c)!;
  ok('een constant slot met de constante van de writer in plaats van het brontoken: de controle weigert',
    probe.run(changedAt(taskPiece[0], 'longDescription', () => '$')).includes(taskPiece[0]));
  ok('een ongewijzigd domeinslot met een andere waarde dan de bron: de controle weigert',
    probe.run(changedAt(taskPiece[0], 'name', () => "'Iets anders'")).includes(taskPiece[0]));
  const ownOwner = probe.o1.find(l => l.type === 'IFCOWNERHISTORY' && l.id !== 990005);
  ok('de proef: een owner history van OPS in de uitvoer', ownOwner !== undefined);
  ok('de owner history van de writer in plaats van die van Bonsai: de controle weigert',
    probe.run(changedAt(taskPiece[0], 'ownerHistory', () => `#${ownOwner!.id}`)).length > 0);
  eq('een afgeleid slot (de naam van de taaktijd) met een andere waarde van de writer: geen verlies',
    named(probe.run(changedAt(timePiece[0], 'name', () => "'Andere naam van de writer'"))), []);
}

const leaves = (d: Domain) => d.tasks.filter(t => t.childIds.length === 0 && !t.isMilestone);
const stepOf = (o: Opened, key: string) => o.ifcSource!.stepIds[key];
const taskStep = (d: Domain) => stepOf(opened, `task:${leaves(d)[0].id}`);
interface DomainEdit { readonly pick: (d: Domain) => number; readonly owned?: true; readonly edit: (d: Domain) => Promise<Domain> | Domain; readonly refusal?: string }
const sync = (f: (d: Domain) => void) => (d: Domain) => { f(d); return d; };
const progress = (completion: number) => (d: Domain) => storeEdit(d, s => {
  const leaf = leaves(d)[0];
  const edit = { field: 'completion', value: completion } as const;
  const opts = { today: localTodayIso() };
  let result = s.enterTaskProgress(leaf.id, edit, opts);
  if (!result.ok && result.reason === 'needsActualStart') result = s.enterTaskProgress(leaf.id, edit, { ...opts, actualStart: result.question.latest });
  if (!result.ok) throw new Error(`voortgang: ${result.reason}`);
});
const lengthened = async (d: Domain) => recalculated(await lengthen(d, leaves(d)[0].id));
const dayLater = (at: string) => {
  const day = new Date(`${at.slice(0, 10)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return `${day.toISOString().slice(0, 10)}${at.slice(10)}`;
};
const floating = (d: Domain): Task => [...leaves(d)].sort((a, b) => (b.time.totalFloat ?? 0) - (a.time.totalFloat ?? 0))[0];
const beyondFloat = async (d: Domain) => {
  const t = floating(d), extra = Math.ceil(t.time.totalFloat ?? 0) + 2;
  return recalculated(await storeEdit(d, s => {
    const task = s.tasks.find(x => x.id === t.id)!;
    s.updateTask(t.id, { time: { ...task.time, durationUnit: 'days', scheduleDuration: task.time.scheduleDuration + extra, durationMinutes: undefined } });
  }));
};
const floatStep = (d: Domain) => stepOf(opened, `task:${floating(d).id}`);
const EDITS: Readonly<Record<string, DomainEdit>> = {
  'IfcTask.name': { pick: taskStep, edit: sync(d => { leaves(d)[0].name = 'Hernoemd'; }) },
  'IfcTask.description': { pick: taskStep, edit: sync(d => { leaves(d)[0].description = 'Nieuwe omschrijving'; }) },
  'IfcTask.identification': { pick: taskStep, edit: sync(d => { leaves(d)[0].wbsCode = '9.9'; }) },
  'IfcTask.status': { pick: taskStep, edit: progress(0.5) },
  'IfcTask.priority': { pick: taskStep, edit: sync(d => { leaves(d)[0].priority = 700; }) },
  'IfcTask.isMilestone': {
    pick: d => stepOf(opened, `task:${d.tasks.find(t => t.isMilestone)!.id}`),
    edit: async (d: Domain) => recalculated(await storeEdit(d, s => { s.updateTask(d.tasks.find(t => t.isMilestone)!.id, { isMilestone: false }); })),
    refusal: 'bronvorm-leest-anders',
  },
  'IfcTask.predefinedType': { pick: taskStep, edit: sync(d => { leaves(d)[0].taskType = 'DEMOLITION'; }) },
  'IfcTaskTime.scheduleDuration': { pick: taskStep, owned: true, edit: lengthened },
  'IfcTaskTime.scheduleFinish': { pick: taskStep, owned: true, edit: sync(d => { leaves(d)[0].time.scheduleFinish = dayLater(leaves(d)[0].time.scheduleFinish); }) },
  'IfcTaskTime.earlyFinish': { pick: taskStep, owned: true, edit: lengthened },
  'IfcTaskTime.lateStart': { pick: taskStep, owned: true, edit: lengthened },
  'IfcTaskTime.scheduleStart': { pick: taskStep, owned: true, edit: sync(d => { leaves(d)[0].time.scheduleStart = dayLater(leaves(d)[0].time.scheduleStart); }) },
  'IfcTaskTime.earlyStart': { pick: taskStep, owned: true, edit: sync(d => { leaves(d)[0].time.earlyStart = dayLater(leaves(d)[0].time.earlyStart); }) },
  'IfcTaskTime.totalFloat': { pick: floatStep, owned: true, edit: beyondFloat },
  'IfcTaskTime.freeFloat': { pick: floatStep, owned: true, edit: beyondFloat },
  'IfcTaskTime.isCritical': { pick: floatStep, owned: true, edit: beyondFloat },
  'IfcTaskTime.lateFinish': { pick: taskStep, owned: true, edit: beyondFloat },
  'IfcTaskTime.durationType': {
    pick: taskStep, owned: true, edit: async d => { leaves(d)[0].time.durationType = 'ELAPSEDTIME'; return recalculated(d); }, refusal: 'bronvorm-leest-anders',
  },
  'IfcTaskTime.actualStart': { pick: taskStep, owned: true, edit: progress(0.5) },
  'IfcTaskTime.remainingTime': { pick: taskStep, owned: true, edit: progress(0.5) },
  'IfcTaskTime.completion': { pick: taskStep, owned: true, edit: progress(0.5) },
  'IfcTaskTime.actualDuration': { pick: taskStep, owned: true, edit: async d => { const x = await progress(0.5)(d); leaves(x)[0].time.actualDuration = 1; return x; } },
  'IfcTaskTime.actualFinish': { pick: taskStep, owned: true, edit: progress(1) },
  'IfcWorkPlan.description': { pick: () => stepOf(opened, `wp:${opened.project.id}`), edit: sync(d => { d.project.description = 'Nieuwe omschrijving'; }) },
  'IfcWorkCalendar.name': { pick: () => stepOf(opened, `cal:${opened.calendar.id}`), edit: sync(d => { d.calendar.name = 'Andere kalender'; }) },
  'IfcWorkCalendar.description': { pick: () => stepOf(opened, `cal:${opened.calendar.id}`), edit: sync(d => { d.calendar.description = 'Andere omschrijving'; }) },
  'resources.name': { pick: d => stepOf(opened, `res:${d.resources[0].id}`), edit: sync(d => { d.resources[0].name = 'Andere ploeg'; }) },
  'resources.description': { pick: d => stepOf(opened, `res:${d.resources[0].id}`), edit: sync(d => { d.resources[0].description = 'Andere omschrijving'; }) },
  'resources.predefinedType': {
    pick: d => stepOf(opened, `res:${d.resources[0].id}`), edit: sync(d => { d.resources[0].type = 'MATERIAL'; }), refusal: 'entiteittype',
  },
  'IfcRelSequence.sequenceType': {
    pick: d => stepOf(opened, `seq:${d.sequences[0].id}`), edit: async d => { d.sequences[0].type = 'START_START'; return recalculated(d); },
  },
  'IfcLagTime.lagValue': {
    pick: d => stepOf(opened, `seq:${d.sequences.find(r => r.lagDays)!.id}`), owned: true,
    edit: async d => { const r = d.sequences.find(x => x.lagDays)!; r.lagDays += 3; delete r.lagMinutes; return recalculated(d); },
  },
  'IfcLagTime.durationType': {
    pick: d => stepOf(opened, `seq:${d.sequences.find(r => r.lagDays)!.id}`), owned: true,
    edit: async d => { d.sequences.find(x => x.lagDays)!.lagUnit = 'ELAPSEDTIME'; return recalculated(d); },
  },
  'IfcWorkCalendar.predefinedType': { pick: () => stepOf(opened, `cal:${opened.calendar.id}`), edit: sync(d => { d.calendar.shift = 'SECOND'; }) },
};
const NOT_EDITABLE: Readonly<Record<string, string>> = {
  'IfcTask.globalId': 'de planner wijzigt geen GlobalId',
  'IfcWorkPlan.globalId': 'de planner wijzigt geen GlobalId',
  'IfcWorkSchedule (live).globalId': 'de planner wijzigt geen GlobalId',
  'IfcWorkCalendar.globalId': 'de planner wijzigt geen GlobalId',
  'resources.globalId': 'de planner wijzigt geen GlobalId',
  'IfcRelSequence.globalId': 'de planner wijzigt geen GlobalId',
};
for (const table of IFC_SLOT_TABLES) {
  if (NOT_CARRIED.has(table.naam)) continue;
  table.slots.forEach((slot, k) => {
    const at = `${table.naam}.${slot.key}`;
    const group = groupOf(table, k);
    if (soort(table, k) !== 'domein' || (group && group[0] !== k)) return;
    ok(`${at}: een bewerking die het veld wijzigt, of de reden waarom niet`, at in EDITS || at in NOT_EDITABLE);
  });
}
for (const [at, entry] of Object.entries(EDITS)) {
  const [naam, key] = [at.slice(0, at.lastIndexOf('.')), at.slice(at.lastIndexOf('.') + 1)];
  const table = slotTableNamed(naam)!;
  const k = table.slots.findIndex(s => s.key === key);
  const d = cloneDomain(opened);
  let edited: Domain;
  try { edited = await entry.edit(d); } catch (e) { ok(`${at}: de bewerking lukt (${(e as Error).message})`, false); continue; }
  const result = await tryMerge(edited, source);
  if (entry.refusal) { ok(`${at}: weigert met ${entry.refusal}`, !result.ok && result.kinds.includes(entry.refusal)); continue; }
  if (!result.ok) { ok(`${at}: schrijft (${result.error.cases.slice(0, 2).map(c => `${c.kind}: ${c.detail}`).join(' | ')})`, false); continue; }
  const owner = sourceIndex.chunkOf(String(entry.pick(cloneDomain(opened))));
  const chunk = entry.owned ? sourceIndex.refAt(owner, slotTableOf(sourceIndex.type(owner), argsAt(sourceIndex, owner))!.slots
    .findIndex(s => s.key === (sourceIndex.type(owner) === 'IFCTASK' ? 'taskTime' : 'timeLag'))) : owner;
  const o = counterparts(result.bytes)(chunk);
  const outIndex = scanForeignStep(result.bytes);
  if (o < 0) { ok(`${at}: het stuk staat in de uitvoer`, false); continue; }
  const was = argsAt(sourceIndex, chunk)[k], now = argsAt(outIndex, o)[k];
  ok(`${at}: de nieuwe waarde van de writer, niet het brontoken (${was} → ${now})`, now !== was);
  eq(`${at}: regel C`, regelCOf(sourceBytes, source, result.bytes, opened, edited), []);
}

interface SingleEdit {
  readonly object: (d: Domain) => number; readonly edit: (d: Domain) => Domain | Promise<Domain>; readonly slots: readonly string[]; readonly refusal?: string;
}
const PROGRESS_SLOTS = ['IfcTask.status', 'IfcTaskTime.completion', 'IfcTaskTime.actualStart', 'IfcTaskTime.actualFinish', 'IfcTaskTime.actualDuration', 'IfcTaskTime.remainingTime'];
const ownedChunk = (chunk: number) => sourceIndex.refAt(chunk, sourceIndex.type(chunk) === 'IFCTASK' ? 11 : 6);
const firstLeaf = (d: Domain) => leaves(d)[0];
const plainLag = (d: Domain) => d.sequences.find(r => r.lagDays && r.lagMinutes === undefined && r.lagPercent === undefined)!;
const resourceStep0 = (d: Domain) => stepOf(opened, `res:${d.resources[0].id}`);
const calendarStep = () => stepOf(opened, `cal:${opened.calendar.id}`);
const sequenceStep = (d: Domain) => stepOf(opened, `seq:${d.sequences[0].id}`);
const lagStep = (d: Domain) => stepOf(opened, `seq:${plainLag(d).id}`);
const time = (f: (t: Task['time']) => void) => sync(d => { f(firstLeaf(d).time); });
const SINGLE: Readonly<Record<string, SingleEdit>> = {
  name: { object: taskStep, edit: sync(d => { firstLeaf(d).name = 'Hernoemd'; }), slots: ['IfcTask.name'] },
  description: { object: taskStep, edit: sync(d => { firstLeaf(d).description = 'Nieuwe omschrijving'; }), slots: ['IfcTask.description'] },
  wbsCode: { object: taskStep, edit: sync(d => { firstLeaf(d).wbsCode = '9.9'; }), slots: ['IfcTask.identification'] },
  priority: { object: taskStep, edit: sync(d => { firstLeaf(d).priority = 700; }), slots: ['IfcTask.priority'] },
  taskType: { object: taskStep, edit: sync(d => { firstLeaf(d).taskType = 'DEMOLITION'; }), slots: ['IfcTask.predefinedType', 'IfcTask.objectType'] },
  isMilestone: {
    object: d => stepOf(opened, `task:${d.tasks.find(t => t.isMilestone)!.id}`),
    edit: sync(d => { d.tasks.find(t => t.isMilestone)!.isMilestone = false; }), slots: ['IfcTask.isMilestone'], refusal: 'bronvorm-leest-anders',
  },
  'time.scheduleDuration': { object: taskStep, edit: time(t => { t.scheduleDuration += 1; }), slots: ['IfcTaskTime.scheduleDuration'] },
  'time.scheduleStart': { object: taskStep, edit: time(t => { t.scheduleStart = dayLater(t.scheduleStart); }), slots: ['IfcTaskTime.scheduleStart'] },
  'time.scheduleFinish': { object: taskStep, edit: time(t => { t.scheduleFinish = dayLater(t.scheduleFinish); }), slots: ['IfcTaskTime.scheduleFinish'] },
  'time.earlyStart': { object: taskStep, edit: time(t => { t.earlyStart = dayLater(t.earlyStart); }), slots: ['IfcTaskTime.earlyStart'] },
  'time.earlyFinish': { object: taskStep, edit: time(t => { t.earlyFinish = dayLater(t.earlyFinish); }), slots: ['IfcTaskTime.earlyFinish'] },
  'time.lateStart': { object: taskStep, edit: time(t => { t.lateStart = dayLater(t.lateStart); }), slots: ['IfcTaskTime.lateStart'] },
  'time.lateFinish': { object: taskStep, edit: time(t => { t.lateFinish = dayLater(t.lateFinish); }), slots: ['IfcTaskTime.lateFinish'] },
  'time.totalFloat': { object: taskStep, edit: time(t => { t.totalFloat = (t.totalFloat ?? 0) + 1; }), slots: ['IfcTaskTime.totalFloat'] },
  'time.freeFloat': { object: taskStep, edit: time(t => { t.freeFloat = (t.freeFloat ?? 0) + 1; }), slots: ['IfcTaskTime.freeFloat'] },
  'time.isCritical': { object: taskStep, edit: time(t => { t.isCritical = !t.isCritical; }), slots: ['IfcTaskTime.isCritical'] },
  'time.durationType': {
    object: taskStep, edit: time(t => { t.durationType = 'ELAPSEDTIME'; }), refusal: 'bronvorm-leest-anders',
    slots: ['IfcTaskTime.durationType', 'IfcTaskTime.scheduleDuration', 'IfcTaskTime.actualDuration', 'IfcTaskTime.remainingTime'],
  },
  'voortgang 50 %': { object: taskStep, edit: progress(0.5), slots: PROGRESS_SLOTS },
  'voortgang 100 %': { object: taskStep, edit: progress(1), slots: PROGRESS_SLOTS },
  'time.actualDuration': { object: taskStep, edit: time(t => { t.actualDuration = 1; }), slots: ['IfcTaskTime.actualDuration'] },
  'time.remainingTime': { object: taskStep, edit: time(t => { t.remainingTime = 2; }), slots: ['IfcTaskTime.remainingTime'] },
  'project.description': { object: () => stepOf(opened, `wp:${opened.project.id}`), edit: sync(d => { d.project.description = 'Andere omschrijving'; }), slots: ['IfcWorkPlan.description'] },
  'calendar.name': { object: calendarStep, edit: sync(d => { d.calendar.name = 'Andere kalender'; }), slots: ['IfcWorkCalendar.name'] },
  'calendar.description': { object: calendarStep, edit: sync(d => { d.calendar.description = 'Andere omschrijving'; }), slots: ['IfcWorkCalendar.description'] },
  'calendar.shift': { object: calendarStep, edit: sync(d => { d.calendar.shift = 'SECOND'; }), slots: ['IfcWorkCalendar.predefinedType', 'IfcWorkCalendar.objectType'] },
  'resource.name': { object: resourceStep0, edit: sync(d => { d.resources[0].name = 'Andere ploeg'; }), slots: ['resources.name'] },
  'resource.description': { object: resourceStep0, edit: sync(d => { d.resources[0].description = 'Andere omschrijving'; }), slots: ['resources.description'] },
  'sequence.type': {
    object: sequenceStep, edit: sync(d => { d.sequences[0].type = 'START_START'; }),
    slots: ['IfcRelSequence.sequenceType', 'IfcRelSequence.userDefinedSequenceType'],
  },
  'sequence.lagDays': { object: lagStep, edit: sync(d => { plainLag(d).lagDays += 3; }), slots: ['IfcLagTime.lagValue'] },
  'sequence.lagUnit': { object: lagStep, edit: sync(d => { plainLag(d).lagUnit = 'ELAPSEDTIME'; }), slots: ['IfcLagTime.durationType'] },
};
const NOT_SINGLE: Readonly<Record<string, string>> = {
  'resources.predefinedType': 'een ander type geeft een andere entiteit; de merge weigert dat (entiteittype)',
};
for (const table of IFC_SLOT_TABLES) {
  if (NOT_CARRIED.has(table.naam)) continue;
  table.slots.forEach((slot, k) => {
    const at = `${table.naam}.${slot.key}`;
    const group = groupOf(table, k);
    if (soort(table, k) !== 'domein' || (group && group[0] !== k)) return;
    ok(`${at}: een bewerking van één veld die dit slot raakt, of de reden waarom niet`,
      Object.values(SINGLE).some(e => e.slots.includes(at)) || at in NOT_EDITABLE || at in NOT_SINGLE);
  });
}
for (const [field, entry] of Object.entries(SINGLE)) {
  const edited = await entry.edit(cloneDomain(opened));
  const result = await tryMerge(edited, source);
  if (entry.refusal) { ok(`${field} gewijzigd: weigert met ${entry.refusal} (${result.ok ? 'schrijft' : result.kinds.join(', ')})`, !result.ok && result.kinds.includes(entry.refusal)); continue; }
  if (!result.ok) { ok(`${field} gewijzigd: schrijft (${result.error.cases.slice(0, 2).map(c => `${c.kind}: ${c.detail}`).join(' | ')})`, false); continue; }
  const object = sourceIndex.chunkOf(String(entry.object(cloneDomain(opened))));
  const allowed = new Set(entry.slots.map(at => {
    const chunk = at.startsWith('IfcTaskTime.') || at.startsWith('IfcLagTime.') ? ownedChunk(object) : object;
    return `${at}@${sourceIndex.id(chunk)}`;
  }));
  eq(`${field} gewijzigd: alleen de slots van dat veld krijgen de waarde van de writer`, sourceTokenDifferences(result.bytes).filter(d => !allowed.has(d)), []);
  eq(`${field} gewijzigd: invarianten`, mergeProblems(sourceBytes, result.bytes), []);
  eq(`${field} gewijzigd: regel C`, regelCOf(sourceBytes, source, result.bytes, opened, edited), []);
}

const { buildWriteIFCInput } = await loadStore();
const ROUTES: readonly (readonly [string, IfcOutputCompute])[] = [
  ['op de hoofdthread', computeIfcOutputHere],
  ['via de opslagworker', createIfcSaveWorker({ createWorker: () => new InProcessWorker('auto') }).compute],
];
const SAVE_SOURCES: readonly (readonly [string, Uint8Array])[] = [
  ['de pinbron', sourceBytes], ['bonsai-4d.ifc', new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc')))],
];
for (const [route, compute] of ROUTES) for (const [label, bytes] of SAVE_SOURCES) {
  const at = `${route}, ${label}`;
  const { store } = await openInStore(bytes);
  const original = store.getState().ifcSource!;
  const commit = async (): Promise<Uint8Array | string> => {
    const state = store.getState();
    try {
      const prepared = (await prepareIfcOutput(state, buildWriteIFCInput(state, 'merge'), undefined, compute)).prepared!;
      store.getState().commitSavedDocument(documentContentOf(state, state.activeDocumentId!)!, state, undefined, prepared);
      return store.getState().ifcSource === prepared.source ? prepared.bytes : 'de opslag zette haar bron niet op het document';
    } catch (e) {
      return e instanceof MergeNeedsPhase2Error ? e.cases.slice(0, 2).map(c => `${c.kind}: ${c.detail}`).join(' | ') : String(e);
    }
  };
  const leaf = store.getState().tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
  store.getState().updateTask(leaf.id, { name: 'Eerste ronde' });
  const once = await commit();
  const twice = await commit();
  store.getState().updateTask(leaf.id, { name: 'Tweede ronde' });
  const second = await commit();
  store.getState().updateTask(leaf.id, { name: 'Derde ronde' });
  const third = await commit();
  for (const [what, out] of [['de eerste opslag', once], ['de tweede opslag zonder wijziging', twice],
    ['de tweede opslag met een wijziging', second], ['de derde opslag met een wijziging', third]] as const) {
    ok(`${at}: ${what} schrijft${typeof out === 'string' ? ` (${out})` : ''}`, typeof out !== 'string');
  }
  ok(`${at}: tweemaal opslaan zonder wijziging: bytegelijk`, once instanceof Uint8Array && twice instanceof Uint8Array && sameBytes(once, twice));
  for (const [what, out] of [['de tweede opslag', second], ['de derde opslag', third]] as const) {
    if (!(out instanceof Uint8Array)) continue;
    eq(`${at}: na ${what} regel C tegenover de oorspronkelijke bron`, regelCOf(bytes, original, out), []);
    eq(`${at}: na ${what} de invarianten tegenover de oorspronkelijke bron`, mergeProblems(bytes, out), []);
    if (bytes !== sourceBytes) continue;
    if (route === ROUTES[0][0]) dump(what === 'de tweede opslag' ? 'tweede-opslag.ifc' : 'derde-opslag.ifc', out);
    const map = counterparts(out), outIndex = scanForeignStep(out);
    for (const [chunk, piece] of pieces) {
      const table = slotTableNamed(piece.table)!, o = map(chunk);
      if (o < 0) { ok(`${at}: ${piece.table} #${sourceIndex.id(chunk)} staat na ${what} nog in de uitvoer`, false); continue; }
      table.slots.forEach((slot, k) => {
        if (soort(table, k) !== 'constant' || groupOf(table, k)) return;
        eq(`${at}: ${piece.table} #${sourceIndex.id(chunk)}.${slot.key} na ${what} nog het token van Bonsai`, argsAt(outIndex, o)[k], argsAt(sourceIndex, chunk)[k]);
      });
    }
  }
}

const relationPieces = pieces.filter(([c]) => sourceIndex.type(c).startsWith('IFCREL') && sourceIndex.type(c) !== 'IFCRELSEQUENCE');
const guidOf = (chunk: number) => argsAt(sourceIndex, chunk)[0];
const relationOf = (type: string, relatingStep: number) => relationPieces.find(([c]) => sourceIndex.type(c) === type
  && sourceIndex.refAt(c, slotTableNamed(relationPieces.find(([x]) => x === c)![1].table)!.slots.findIndex(s => s.rol === 'relating')) === sourceIndex.chunkOf(String(relatingStep)))?.[0] ?? -1;
function membersIn(out: Uint8Array, chunk: number): number[] | undefined {
  const index = scanForeignStep(out);
  for (let c = 0; c < index.count; c++) {
    if (!index.isEntity(c) || index.type(c) !== sourceIndex.type(chunk) || argsAt(index, c)[0] !== guidOf(chunk)) continue;
    const table = slotTableOf(index.type(c), argsAt(index, c))!;
    return refsOutsideText(argsAt(index, c)[table.slots.findIndex(s => s.rol === 'leden')]);
  }
  return undefined;
}
const taskAt = (d: Domain, step: number) => d.tasks.find(t => stepOf(opened, `task:${t.id}`) === step)!;
const nests49 = relationOf('IFCRELNESTS', 49), calendarControl = relationOf('IFCRELASSIGNSTOCONTROL', 38);
const assignment = (d: Domain) => d.assignments.find(a => relationOf('IFCRELASSIGNSTOPROCESS', stepOf(opened, `task:${a.taskId}`)) >= 0)!;
const processOf = (d: Domain) => relationOf('IFCRELASSIGNSTOPROCESS', stepOf(opened, `task:${assignment(d).taskId}`));
const resourceStep = (d: Domain) => stepOf(opened, `res:${assignment(d).resourceId}`);
ok('de proef: een Nests van Bonsai onder #49, een toewijzing van Bonsai en de kalenderrelatie met de projectkalender',
  nests49 >= 0 && calendarControl >= 0 && processOf(cloneDomain(opened)) >= 0);
const RELATION_EDITS: readonly { label: string; edit: (d: Domain) => Promise<Domain>; expect: (out: Uint8Array, d: Domain) => [string, boolean][] }[] = [
  {
    label: 'een taak een niveau hoger', edit: d => storeEdit(d, s => { s.outdentTasks([taskAt(d, 53).id], { phaseAssignments: 'move', answered: true }); }),
    expect: out => [['#53 staat niet meer in de Nests van Bonsai van #49', !(membersIn(out, nests49) ?? []).includes(53)],
      ['#51 blijft in die Nests', (membersIn(out, nests49) ?? []).includes(51)]],
  },
  {
    label: 'een kind erbij', edit: d => storeEdit(d, s => {
      s.addTask({ name: 'Nieuw kind', position: { anchorId: taskAt(d, 53).id, where: 'below' } }, { phaseAssignments: 'move', answered: true });
    }),
    expect: out => [['de Nests van Bonsai van #49 krijgt het nieuwe kind erbij, de oude kinderen blijven', (membersIn(out, nests49) ?? []).length === 3
      && [51, 53].every(id => membersIn(out, nests49)!.includes(id))]],
  },
  {
    label: 'een kind weg (naar een andere ouder)', edit: d => storeEdit(d, s => {
      s.moveTask(taskAt(d, 53).id, taskAt(d, 55).id, undefined, { phaseAssignments: 'move', answered: true });
    }),
    expect: out => [['#53 staat niet meer in de Nests van Bonsai van #49', !(membersIn(out, nests49) ?? []).includes(53)]],
  },
  {
    label: 'een toewijzing weg', edit: d => storeEdit(d, s => { s.unassignResource(assignment(d).id); }),
    expect: (out, d) => [['de resource staat niet meer in de toewijzing van Bonsai', !(membersIn(out, processOf(d)) ?? []).includes(resourceStep(d))]],
  },
  {
    label: 'een kalender wisselen', edit: d => storeEdit(d, s => {
      const { id: _id, ...calendar } = structuredClone(d.calendar);
      const id = s.addCalendar({ ...calendar, name: 'Andere kalender' });
      s.updateTask(taskAt(d, 51).id, { calendarId: id });
    }),
    expect: out => [['#51 volgt de projectkalender niet meer: weg uit de kalenderrelatie van Bonsai', !(membersIn(out, calendarControl) ?? []).includes(51)],
      ['#53 volgt de projectkalender nog', (membersIn(out, calendarControl) ?? []).includes(53)]],
  },
];
for (const [n, { label, edit, expect }] of RELATION_EDITS.entries()) {
  const d = cloneDomain(opened);
  let edited: Domain;
  try { edited = await edit(d); } catch (e) { ok(`${label}: de bewerking lukt (${(e as Error).message})`, false); continue; }
  const result = await tryMerge(edited, source);
  if (!result.ok) { ok(`${label}: schrijft (${result.error.cases.slice(0, 2).map(c => `${c.kind}: ${c.detail}`).join(' | ')})`, false); continue; }
  dump(`relatie-${n + 1}.ifc`, result.bytes);
  eq(`${label}: invarianten`, mergeProblems(sourceBytes, result.bytes), []);
  eq(`${label}: geen lid dubbel`, doubleMemberships(result.bytes).filter(k => !doubleMemberships(sourceBytes).includes(k)), []);
  eq(`${label}: regel C`, regelCOf(sourceBytes, source, result.bytes, opened, edited), []);
  const index = scanForeignStep(result.bytes), counterpart = counterparts(result.bytes);
  for (const [chunk, piece] of relationPieces) {
    const table = slotTableNamed(piece.table)!;
    const o = counterpart(chunk);
    if (o < 0) continue;
    table.slots.forEach((slot, k) => {
      if (!slot.rol) eq(`${label}: ${piece.table} #${sourceIndex.id(chunk)}.${slot.key} blijft het token van Bonsai`, argsAt(index, o)[k], argsAt(sourceIndex, chunk)[k]);
    });
  }
  for (const [what, holds] of expect(result.bytes, d)) ok(`${label}: ${what}`, holds);
}

let restored: RestoredOwnSlots | undefined;
const innocentDomain = await innocent(cloneDomain(opened));
const innocentOut = await prepareIfcWrite(innocentDomain, source, undefined, r => { restored = r; }).catch(() => undefined);
ok('een baselinekop met de owner history van Bonsai: controle (c) vergelijkt de groep van de baselinekoppen gewoon',
  restored !== undefined && !restored.skip.has(BASELINE_HEADS));
if (innocentOut && restored) {
  const own = restored as OwnOutputCheck;
  const text = new TextDecoder().decode(innocentOut.bytes);
  const head = /^#\d+=IFCWORKSCHEDULE\('[^']*',#990005,.*\.BASELINE\.\);$/m.exec(text)?.[0] ?? '';
  ok('de proef: een baselinekop van Bonsai met een eigen Purpose in de uitvoer', head.includes("'Bonsai purpose'"));
  const broken = new TextEncoder().encode(text.replace(head, head.replace("'Bonsai purpose'", "'Iets anders'")));
  const verdict = (bytes: Uint8Array) => checkMergeOutput(bytes, innocentDomain, source, own)
    .then(() => 'geen melding', e => (e instanceof MergeNeedsPhase2Error ? e.cases.map(c => c.kind).join(', ') : String(e)));
  eq('controle (c) op de echte uitvoer: geen melding', await verdict(innocentOut.bytes), 'geen melding');
  eq('controle (c) ziet een gewijzigd slot van een baselinekop van Bonsai', await verdict(broken), 'eigen-uitvoer');
}

const B4D = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc'), 'utf8');
const encode = (text: string) => new TextEncoder().encode(text);
const atEnd = (text: string, extra: string) => text.replace(/ENDSEC;(\s*END-ISO-10303-21;)/, `${extra}\nENDSEC;$1`);
type StoreEdit = Parameters<typeof storeEdit>[1];
const rename = (from: string, to: string): StoreEdit => s => { s.updateTask(s.tasks.find(t => t.name === from)!.id, { name: to }); };
async function saveOn(bytes: Uint8Array, edit: StoreEdit) {
  const o = await openForeign(bytes);
  const edited = await storeEdit(cloneDomain(o), edit);
  const result = await tryMerge(edited, o.ifcSource!);
  return { o, edited, result, rule: () => (result.ok ? regelCOf(bytes, o.ifcSource!, result.bytes, o, edited) : []) };
}
const outArgs = (out: Uint8Array, id: number) => { const index = scanForeignStep(out); return argsAt(index, index.chunkOf(String(id))); };
const typeIn = (out: Uint8Array, id: number) => { const index = scanForeignStep(out); const c = index.chunkOf(String(id)); return c < 0 ? '' : index.type(c); };
const unreferenced = (bytes: Uint8Array, type: string) => {
  const index = scanForeignStep(bytes), ids: string[] = [];
  for (let c = 0; c < index.count; c++) if (index.isEntity(c) && index.type(c) === type && index.inEnd(c) === index.inStart(c)) ids.push(index.id(c));
  return ids;
};
const refusal = (r: Awaited<ReturnType<typeof tryMerge>>) => (r.ok ? 'schrijft' : r.error.cases.slice(0, 2).map(c => `${c.kind} #${c.sourceId}: ${c.detail}`).join(' | '));

const RECURRING = atEnd(B4D.replace(/^#110=IFCTASKTIME\((.*)\);$/m, '#110=IFCTASKTIMERECURRING($1,#8001);'), '#8001=IFCRECURRENCEPATTERN(.DAILY.,$,$,$,2,$,$,$);');
for (const [label, text] of [['een gewone taaktijd', B4D], ['een terugkerende taaktijd', RECURRING]] as const) {
  const bytes = encode(text);
  for (const [what, edit] of [['een andere taak hernoemd', rename('Wand A bouwen', 'Wand A (review)')], ['de taak zelf hernoemd', rename('Wand B bouwen', 'Wand B (review)')]] as const) {
    const { result, rule } = await saveOn(bytes, edit);
    ok(`${label}, ${what}: schrijft (${refusal(result)})`, result.ok);
    if (!result.ok) continue;
    eq(`${label}, ${what}: #108 wijst nog naar #110`, outArgs(result.bytes, 108)[11], '#110');
    eq(`${label}, ${what}: #110 houdt zijn entiteittype`, typeIn(result.bytes, 110), typeIn(bytes, 110));
    eq(`${label}, ${what}: elke taaktijd in de uitvoer heeft een verwijzing`, unreferenced(result.bytes, 'IFCTASKTIME'), []);
    eq(`${label}, ${what}: regel C`, rule(), []);
  }
}
{
  const o = await openForeign(encode(RECURRING));
  const result = await tryMerge(await lengthen(cloneDomain(o), o.tasks.find(t => t.name === 'Wand B bouwen')!.id), o.ifcSource!);
  ok(`een terugkerende taaktijd, de duur van die taak zelf langer: getypeerd geweigerd op #108 (${refusal(result)})`,
    !result.ok && result.error.cases.some(c => c.kind === 'niet-gedragen' && c.sourceId === 108));
}

const WITH_LAG = atEnd(B4D.replace(/(,#104,#108),\$,(\.FINISH_START\.,\$\);)/, '$1,#8010,$2'),
  "#8010=IFCLAGTIME('Bonsai lag',.MEASURED.,$,IFCDURATION('P2D'),.NOTDEFINED.);");
for (const [spelling, days] of [['P2D', 2], ['P02D', 2], ['P0.50D', 0.5]] as const) for (const [what, change, value, unit] of [
  ['de lagwaarde van twee naar drie dagen', { lagDays: 3 }, 'P3D', '.NOTDEFINED.'],
  ['de lageenheid naar verstreken tijd', { lagUnit: 'ELAPSEDTIME' as const }, spelling, '.ELAPSEDTIME.'],
] as const) {
  const at = `een lag van Bonsai in de spelling ${spelling}, ${what}`;
  const { result, rule } = await saveOn(encode(WITH_LAG.replace("'P2D'", `'${spelling}'`)), s => { s.updateSequence(s.sequences.find(q => q.lagDays === days)!.id, change); });
  ok(`${at}: schrijft (${refusal(result)})`, result.ok);
  if (!result.ok) continue;
  eq(`${at}: alleen het slot van dat veld verandert`, outArgs(result.bytes, Number(outArgs(result.bytes, 112)[6].slice(1))),
    ["'Bonsai lag'", '.MEASURED.', '$', `IFCDURATION('${value}')`, unit]);
  eq(`${at}: regel C`, rule(), []);
}

const SHARED_LAG = atEnd(WITH_LAG, "#8013=IFCEVENT('2Bonsaigebeurtenis0001',#111,'Oplevering',$,$,$,$,.ENDEVENT.,.NOTDEFINED.,$,$);\n"
  + "#8014=IFCRELSEQUENCE('3Bonsaigebeurtenisvolg',#111,$,$,#108,#8013,#8010,.FINISH_START.,$);");
{
  const { result, rule } = await saveOn(encode(SHARED_LAG), rename('Wand A bouwen', 'Wand A (review)'));
  ok(`een lag die Bonsai deelt met een reeks buiten de planning, een taak hernoemd: schrijft (${refusal(result)})`, result.ok);
  if (result.ok) {
    eq('een gedeelde lag: #112 wijst nog naar #8010', outArgs(result.bytes, 112)[6], '#8010');
    eq('een gedeelde lag: elke lag in de uitvoer heeft een verwijzing', unreferenced(result.bytes, 'IFCLAGTIME'), []);
    eq('een gedeelde lag: regel C', rule(), []);
  }
  const { result: changed } = await saveOn(encode(SHARED_LAG), s => { s.updateSequence(s.sequences.find(q => q.lagDays === 2)!.id, { lagDays: 3 }); });
  ok(`een gedeelde lag, de lagwaarde gewijzigd: getypeerd geweigerd op #112 (${refusal(changed)})`,
    !changed.ok && changed.error.cases.some(c => c.kind === 'niet-gedragen' && c.sourceId === 112));
}

const TWO_ASSIGNMENTS = B4D.replace(/^(#120=.*?)\(#118,#30\)/m, '$1(#118)')
  .replace(/(#118=IFCLABORRESOURCE\(.*\);)/, "$1\n#8001=IFCLABORRESOURCE('2RAmjWsPoBqSfsFswNCJJX',#117,'Andere ploeg',$,$,$,$,$,$,$,.NOTDEFINED.);")
  .replace(/(#120=IFCRELASSIGNSTOPROCESS\(.*\);)/, "$1\n#8002=IFCRELASSIGNSTOPROCESS('1rmDhv9f7mdZ0AEONco1oi',#119,'Bonsai tweede',$,(#8001),$,#104,#121);");
const assignmentsOf104 = (out: Uint8Array) => {
  const index = scanForeignStep(out), found: string[] = [];
  for (let c = 0; c < index.count; c++) {
    if (index.isEntity(c) && index.type(c) === 'IFCRELASSIGNSTOPROCESS' && index.id(index.refAt(c, 6)) === '104') found.push(`${argsAt(index, c)[0]} ${argsAt(index, c)[4]}`);
  }
  return found.sort();
};
for (const [removed, left] of [
  [['Metselploeg'], ["'1rmDhv9f7mdZ0AEONco1oi' (#8001)"]],
  [['Andere ploeg'], ["'3rmDhv9f7mdZ0AEONco1oi' (#118)"]],
  [['Metselploeg', 'Andere ploeg'], []],
] as const) {
  const { result, rule } = await saveOn(encode(TWO_ASSIGNMENTS), s => {
    const task = s.tasks.find(t => t.name === 'Wand A bouwen')!;
    for (const name of removed) {
      const resource = s.resources.find(r => r.name === name)!;
      s.unassignResource(s.assignments.find(a => a.taskId === task.id && a.resourceId === resource.id)!.id);
    }
  });
  ok(`twee toewijzingen van Bonsai, ${removed.join(' en ')} weg: schrijft (${refusal(result)})`, result.ok);
  if (!result.ok) continue;
  eq(`twee toewijzingen van Bonsai, ${removed.join(' en ')} weg: de overgebleven relatie op haar GlobalId`, assignmentsOf104(result.bytes), [...left]);
  eq(`twee toewijzingen van Bonsai, ${removed.join(' en ')} weg: regel C`, rule(), []);
}

{
  const bytes = encode(TWO_ASSIGNMENTS);
  const { edited, result } = await saveOn(bytes, s => {
    const task = s.tasks.find(t => t.name === 'Wand A bouwen')!, resource = s.resources.find(r => r.name === 'Metselploeg')!;
    s.unassignResource(s.assignments.find(a => a.taskId === task.id && a.resourceId === resource.id)!.id);
  });
  if (result.ok) {
    const probe = await lossProbe(bytes, edited, result.bytes);
    const named = (chunks: readonly number[]) => chunks.map(c => `${probe.index.type(c)} #${probe.index.id(c)}`);
    eq('twee toewijzingen van Bonsai, Metselploeg weg: de verliescontrole op de echte uitvoer meldt niets', named(probe.run(probe.o1)), []);
    const other = probe.o1.find(l => l.type === 'IFCRELASSIGNSTOPROCESS' && l.args[0] === "'1rmDhv9f7mdZ0AEONco1oi'");
    ok('de proef: de relatie van de andere ploeg staat in de uitvoer', other !== undefined);
    const flagged = named(probe.run(probe.o1.filter(l => l !== other)));
    ok(`ook de relatie van de andere ploeg weg, terwijl alleen de toewijzing van de Metselploeg wijzigde: de controle meldt haar (${flagged.join(', ')})`,
      flagged.includes('IFCRELASSIGNSTOPROCESS #8002'));
  }
}

const PADDED = B4D.replace(/#107(?!\d)/g, '#00107');
{
  const { result } = await saveOn(encode(PADDED), rename('Wand A bouwen', 'Wand A (review)'));
  ok(`een owner history met voorloopnullen: schrijft (${refusal(result)})`, result.ok);
  if (result.ok) {
    const text = new TextDecoder().decode(result.bytes);
    eq('een owner history met voorloopnullen: elke verwijzing houdt haar token', [(text.match(/#107(?!\d)/g) ?? []).length, (text.match(/#00107(?!\d)/g) ?? []).length],
      [0, (PADDED.match(/#00107(?!\d)/g) ?? []).length]);
    eq('een owner history met voorloopnullen: de hulpstukken houden hun id', outArgs(result.bytes, 108)[11], '#110');
  }
}

const withLongDescription = (text: string) => B4D.replace(/^#108=IFCTASK\(((?:[^,]*,){6})[^,]*,/m, (_m, head: string) => `#108=IFCTASK(${head}${text},`);
{
  const latin = Uint8Array.from(withLongDescription("'Café bouw'"), ch => ch.charCodeAt(0));
  const { result } = await saveOn(latin, rename('Wand A bouwen', 'Wand A (review)'));
  ok(`een rauwe Latin-1-byte in een slot van Bonsai: getypeerd geweigerd op #108 (${refusal(result)})`,
    !result.ok && result.error.cases.some(c => c.kind === 'vreemde-herkomst' && c.sourceId === 108));
  const utf8 = encode(withLongDescription("'Café bouw'"));
  const { result: valid } = await saveOn(utf8, rename('Wand A bouwen', 'Wand A (review)'));
  ok(`dezelfde tekst in UTF-8: schrijft (${refusal(valid)})`, valid.ok);
  if (valid.ok) eq('dezelfde tekst in UTF-8: de bytes blijven', outArgs(valid.bytes, 108)[6], "'Café bouw'");
}

if (fails.length > 0) {
  console.log(`XX  ifc-source-slot-write: ${fails.length} afwijking(en) van ${checks}`);
  for (const f of fails) console.log(`   - ${f}`);
  process.exit(1);
}
console.log(`OK  ifc-source-slot-write: ${checks} toetsen groen (${ruleSlots} slots in de regel, ${tested.size} van openen tot opslaan, ${Object.keys(EDITS).length} bewerkingen, ${Object.keys(SINGLE).length} van één veld)`);
