// De schrijfregel per slotsoort (#804 fase 2, PR 2 deel 2; ontwerp §4.5 "Vier soorten slots"), vastgepind met een lus over
// het register (`IFC_SLOT_TABLES`): een slot dat erbij komt, wordt vanzelf getoetst, en een slot zonder proef geeft rood.
//   1. De regel zelf (`sourceSlotArgs`, `writerAlwaysWrites`), voor elk slot van elke tabel.
//   2. Van openen tot opslaan, op een eigen voorbeeld waarvan elk D- en R-stuk de owner history van Bonsai kreeg en elk
//      constant en afgeleid slot een eigen brontoken: na één onschuldige wijziging elders staat in de uitvoer het token
//      dat de slotsoort voorschrijft.
//   3. Een gewijzigd domeinveld krijgt de nieuwe waarde, nooit het brontoken; per domeinslot een bewerking, of de reden
//      waarom de planner dat veld niet kan wijzigen.
//   4. Tweemaal opslaan: zonder wijziging bytegelijk, met een wijziging blijft alles van Bonsai staan.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '@/services/ifc/foreign/classify';
import { refsOutsideText } from '@/services/ifc/foreign/lossCheck';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { mappedChunks, type SourcePieceSlots } from '@/services/ifc/foreign/sourceSlots';
import { sourceSlotArgs, writerAlwaysWrites } from '@/services/ifc/foreign/sourceSlotWrite';
import type { StepIndex } from '@/services/ifc/foreign/stepScanner';
import { IFC_SLOT_TABLES, slotTableNamed, slotTableOf, type IfcSlotTable } from '@/services/ifc/ifcSlotTables';
import { cloneDomain, doubleMemberships, lossProbe, mergeProblems, openForeign, sameBytes, tryMerge, type Domain, type Opened } from './ifcMergeKern';
import type { OutLine } from '@/services/ifc/foreign/lossCheck';
import { lengthen, recalculated, storeEdit } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { IFC_SCHEMA_TABLES } from './ifcSchemaTable';
import { localTodayIso } from '@/utils/dateUtils';
import type { Task } from '@/types/task';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
installDeterminism();
let checks = 0;
const fails: string[] = [];
const ok = (label: string, condition: boolean) => { checks++; if (!condition) fails.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  const same = JSON.stringify(got) === JSON.stringify(want);
  ok(same ? label : `${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`, same);
};

const soort = (table: IfcSlotTable, k: number) => table.slots[k].soortVreemd ?? table.slots[k].soort;
/** De slots die de descriptor samen schrijft (een hoofdslot en wat het `volgt`), het hoofdslot eerst. */
function groupOf(table: IfcSlotTable, k: number): number[] | undefined {
  const main = table.slots[k].volgt ?? table.slots[k].key;
  const members = table.slots.flatMap((slot, j) => (slot.key === main || slot.volgt === main ? [j] : []));
  if (members.length < 2) return undefined;
  return [members.find(j => table.slots[j].key === main)!, ...members.filter(j => table.slots[j].key !== main)];
}
/** Het ontwerp, letterlijk: constant het brontoken; domein het brontoken zolang het niet veranderde; afgeleid en
 *  verwijzing de writer; een afhankelijk slot samen met zijn hoofdslot. */
function wantsSource(table: IfcSlotTable, k: number, changed: ReadonlySet<number>): boolean {
  const own = (j: number) => soort(table, j) === 'constant' || (soort(table, j) === 'domein' && !changed.has(j));
  const group = groupOf(table, k);
  if (!group) return own(k);
  const [main, ...dependents] = group;
  return own(main) && dependents.every(d => !changed.has(d));
}

// ── 1. De regel, voor elk slot van elke tabel ──
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

// ── 2. Van openen tot opslaan ──
/** Wat de kaart bewust niet draagt: daar blijft de weigering `vreemde-herkomst` (sectie 5). */
const NOT_CARRIED: ReadonlySet<string> = new Set(['IfcRelDeclares', 'IfcRelDefinesByProperties']);
/** Slots waarvan de proef het brontoken niet anders kan maken dan wat de writer schrijft, met de reden. */
const SAME_AS_WRITER: Readonly<Record<string, string>> = {
  'IfcWorkSchedule (baseline).globalId': 'de kop van een baseline houdt zijn id via zijn GlobalId',
  'IfcWorkSchedule (baseline).name': 'een baselinekop hoort bij de planning via naam en datum in OPS_Baselines',
  'IfcWorkSchedule (baseline).creationDate': 'een baselinekop hoort bij de planning via naam en datum in OPS_Baselines',
  'IfcWorkSchedule (baseline).predefinedType': 'een ander type maakt er geen baseline meer van',
  'IfcWorkSchedule (live).predefinedType': 'BASELINE maakt er een baseline van; elke andere waarde laat de proef staan',
  'IfcRelAssignsToControl.relatedObjectsType': 'in IFC 4.3 (het schema van het voorbeeld) een attribuut dat leeg moet zijn',
  'IfcRelAssignsToProcess.relatedObjectsType': 'in IFC 4.3 (het schema van het voorbeeld) een attribuut dat leeg moet zijn',
};
const BONSAI = [
  "#990001=IFCPERSON($,'Bonsai',$,$,$,$,$,$);",
  "#990002=IFCORGANIZATION($,'Bonsai Org',$,$,$);",
  '#990003=IFCPERSONANDORGANIZATION(#990001,#990002,$);',
  "#990004=IFCAPPLICATION(#990002,'0.8','Bonsai','Bonsai');",
  '#990005=IFCOWNERHISTORY(#990003,#990004,.READWRITE.,.ADDED.,1767268800,#990003,#990004,1767268800);',
  "#990010=IFCRESOURCETIME('Inzet van Bonsai',$,$,$,$,$,$,$,$,$,$,$,$,$,$,$,$,$);",
  "#990011=IFCCOSTVALUE('Prijs van Bonsai',$,$,$,$,$,$,$,$,$);",
  "#990012=IFCQUANTITYCOUNT('Aantal van Bonsai',$,$,3.,$);",
  '#990013=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);',
  '#990014=IFCMEASUREWITHUNIT(IFCCOUNTMEASURE(2.),#990013);',
  // De lezer slaat een relatie met de projectkalender over: het lid volgt dan de projectkalender (§4.5).
  "#990020=IFCRELASSIGNSTOCONTROL('0Bonsaiprojectkalender',#990005,'Kalender van Bonsai',$,(#51,#53),$,#38);",
];
/** De constante slots met een `#` (de vaste lijst van §4.5): een verwijzing naar een stuk van Bonsai. */
const BONSAI_REFERENCE: Readonly<Record<string, string>> = {
  ownerHistory: '#990005', creators: '(#990001)', usage: '#990010', baseCosts: '(#990011)', baseQuantity: '#990012',
  quantityInProcess: '#990014',
};
const codeOf = (type: string, k: number) => {
  const attribute = IFC_SCHEMA_TABLES.IFC4X3_ADD2.attributes[type]?.[k];
  return attribute?.slice(attribute.indexOf(':') + 1).replace(/\?$/, '');
};
/** Een eigen brontoken voor een constant of afgeleid slot, op de soort van het schema; `undefined` als de proef er geen heeft. */
function ownToken(code: string | undefined, current: string, key: string): string | undefined {
  if (code === 'S') return `'Bonsai ${key}'`;
  if (code === 'DT') return "'2001-02-03T04:05:00'";
  if (code === 'DU') return "'P9D'";
  if (code === 'G') return `'0Bonsai${current.trim().slice(8)}`;
  const literals = code?.startsWith('E=') ? code.slice(2).split('|') : undefined;
  const other = literals?.find(l => `.${l}.` !== current.trim() && l !== 'USERDEFINED' && l !== 'NOTDEFINED');
  return other ? `.${other}.` : undefined;
}
/** Dezelfde tekst in een andere STEP-vorm (de eerste letter als `\X2\…\X0\`): de lezer leest hetzelfde. */
const otherForm = (token: string) => (/^'[A-Za-z]/.test(token)
  ? `'\\X2\\${token.charCodeAt(1).toString(16).toUpperCase().padStart(4, '0')}\\X0\\${token.slice(2)}` : undefined);

interface Fixture { readonly text: string; readonly distinct: ReadonlySet<string>; readonly carried: ReadonlySet<number> }
/** Het voorbeeld met een planning van Bonsai: elk D- en R-stuk dat de kaart draagt (en zijn taaktijd of lag), met eigen
 *  brontokens. De Status van de taken wordt een tekst van Bonsai (sectie 3: de lezer leest die niet). */
function bonsaiPlanning(file: string): Fixture {
  const original = readFileSync(join(ROOT, file), 'latin1');
  const index = scanForeignStep(new TextEncoder().encode(original));
  const cls = classify(index);
  const lines = new Map<string, string[]>();
  const distinct = new Set<string>();
  const carried = new Set<number>();
  const rewrite = (chunk: number, table: IfcSlotTable, foreign: boolean) => {
    const args = [...index.argTokens(chunk)!];
    table.slots.forEach((slot, k) => {
      const at = `${table.naam}.${slot.key}`;
      const kind = foreign ? soort(table, k) : slot.soort;
      if (groupOf(table, k) || slot.rol) return;
      let next: string | undefined;
      if (slot.bronverwijzing) next = BONSAI_REFERENCE[slot.key];
      else if (kind === 'constant' || kind === 'afgeleid') next = SAME_AS_WRITER[at] ? undefined : ownToken(codeOf(index.type(chunk), k), args[k], slot.key);
      else if (kind === 'domein' && table.naam === 'IfcTask' && slot.key === 'status') next = "'Bonsai: in uitvoering'";
      else if (kind === 'domein' && codeOf(index.type(chunk), k) === 'S' && args[k].trim() !== '$') next = otherForm(args[k].trim());
      else if (kind === 'domein' && /^'P0Y0M\d+D'$/.test(args[k].trim())) next = `'P${args[k].trim().slice(6)}`;
      if (next === undefined || next === args[k].trim()) return;
      args[k] = next;
      distinct.add(at);
    });
    lines.set(index.id(chunk), args);
  };
  for (let chunk = 0; chunk < index.count; chunk++) {
    if (!index.isEntity(chunk) || (!cls.selection.inD[chunk] && !cls.inR[chunk])) continue;
    const args = index.argTokens(chunk)!;
    const table = slotTableOf(index.type(chunk), args);
    if (!table || NOT_CARRIED.has(table.naam) || args.length !== table.slots.length) continue;
    carried.add(Number(index.id(chunk)));
    rewrite(chunk, table, true);
    const ownedSlot = table.naam === 'IfcTask' ? 'taskTime' : table.naam === 'IfcRelSequence' ? 'timeLag' : undefined;
    const owned = ownedSlot ? index.refAt(chunk, table.slots.findIndex(s => s.key === ownedSlot)) : -1;
    if (owned >= 0) rewrite(owned, slotTableOf(index.type(owned), index.argTokens(owned)!)!, true);
  }
  // Vervolgpunt 4 van #1182: een `IfcConstructionProductResource` van Bonsai (de lezer leest hem als materieel).
  let product = false;
  const text = original.split(/\r?\n/).map(line => {
    const m = /^#(\d+)=([A-Z0-9_]+)\(/.exec(line);
    const args = m ? lines.get(m[1]) : undefined;
    const type = m?.[2] === 'IFCLABORRESOURCE' && !product && (product = true) ? 'IFCCONSTRUCTIONPRODUCTRESOURCE' : m?.[2];
    return args ? `#${m![1]}=${type}(${args.join(',')});` : line;
  }).join('\n').replace('ENDSEC;\nEND-ISO', `${BONSAI.join('\n')}\nENDSEC;\nEND-ISO`);
  return { text, distinct, carried };
}

const FILE = 'public/examples/showcase-verbouwing-eengezinswoning.ifc';
const fixture = bonsaiPlanning(FILE);
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
/** Het stuk in de uitvoer bij een bronstuk: een D-stuk op zijn id, een relatie op haar GlobalId, een taaktijd of lag via zijn
 *  eigenaar. */
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

const innocent = (d: Domain) => storeEdit(d, s => { s.setProject({ name: `${d.project.name} (elders gewijzigd)` }); });
const first = await tryMerge(await innocent(cloneDomain(opened)), source);
ok(`na een onschuldige wijziging elders schrijft de merge${first.ok ? '' : ` (${first.error.cases.slice(0, 3).map(c => `${c.kind}: ${c.detail}`).join(' | ')})`}`, first.ok);
const tested = new Set<string>();
if (first.ok) {
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

// ── 2b. De verliescontrole oordeelt per slotsoort over wat de writer aanbood (een fout van de writer in O1 nagebootst) ──
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

// ── 3. Een gewijzigd domeinveld: de nieuwe waarde ──
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
/** Dezelfde tijd een kalenderdag later. */
const dayLater = (at: string) => {
  const day = new Date(`${at.slice(0, 10)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return `${day.toISOString().slice(0, 10)}${at.slice(10)}`;
};
/** De taak met de meeste speling: langer dan haar speling, en doorgerekend (F5). */
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
  'IfcTaskTime.durationType': { pick: taskStep, owned: true, edit: async d => { leaves(d)[0].time.durationType = 'ELAPSEDTIME'; return recalculated(d); } },
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
/** Domeinslots die de planner niet kan wijzigen, of die een bewerking hierboven al raakt, met de reden. */
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
}

// ── 4. Tweemaal opslaan ──
if (first.ok) {
  const reread = await openForeign(first.bytes);
  const again = await tryMerge(cloneDomain(reread), reread.ifcSource!);
  ok('tweemaal opslaan zonder wijziging: bytegelijk', again.ok && sameBytes(again.bytes, first.bytes));
  const renamed = await storeEdit(cloneDomain(reread), s => { s.updateTask(leaves(reread)[0].id, { name: 'Tweede ronde' }); });
  const second = await tryMerge(renamed, reread.ifcSource!);
  ok(`tweemaal opslaan met een wijziging ertussen: schrijft${second.ok ? '' : ` (${second.error.cases.slice(0, 2).map(c => c.detail).join(' | ')})`}`, second.ok);
  if (second.ok) {
    const map = counterparts(second.bytes), outIndex = scanForeignStep(second.bytes);
    for (const [chunk, piece] of pieces) {
      const table = slotTableNamed(piece.table)!, o = map(chunk);
      if (o < 0) { ok(`${piece.table} #${sourceIndex.id(chunk)}: staat na de tweede opslag nog in de uitvoer`, false); continue; }
      table.slots.forEach((slot, k) => {
        if (soort(table, k) !== 'constant' || groupOf(table, k)) return;
        eq(`${piece.table} #${sourceIndex.id(chunk)}.${slot.key}: na de tweede opslag nog het token van Bonsai`, argsAt(outIndex, o)[k], argsAt(sourceIndex, chunk)[k]);
      });
    }
  }
}

// ── 5. Relaties van Bonsai bij een bewerking: geen lid dubbel, geen lid kwijt, de bewaarde slots intact ──
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
for (const { label, edit, expect } of RELATION_EDITS) {
  const d = cloneDomain(opened);
  let edited: Domain;
  try { edited = await edit(d); } catch (e) { ok(`${label}: de bewerking lukt (${(e as Error).message})`, false); continue; }
  const result = await tryMerge(edited, source);
  if (!result.ok) { ok(`${label}: schrijft (${result.error.cases.slice(0, 2).map(c => `${c.kind}: ${c.detail}`).join(' | ')})`, false); continue; }
  eq(`${label}: invarianten`, mergeProblems(sourceBytes, result.bytes), []);
  eq(`${label}: geen lid dubbel`, doubleMemberships(result.bytes).filter(k => !doubleMemberships(sourceBytes).includes(k)), []);
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

if (fails.length > 0) {
  console.log(`XX  ifc-source-slot-write: ${fails.length} afwijking(en) van ${checks}`);
  for (const f of fails.slice(0, 60)) console.log(`   - ${f}`);
  process.exit(1);
}
console.log(`OK  ifc-source-slot-write: ${checks} toetsen groen (${ruleSlots} slots in de regel, ${tested.size} van openen tot opslaan, ${Object.keys(EDITS).length} bewerkingen)`);
