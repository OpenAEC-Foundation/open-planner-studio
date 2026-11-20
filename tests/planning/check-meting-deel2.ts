// METING stap 5 deel 2 (niet mergen). Per eigen projectpset: een slot dat de herleestoets (b) terugzet (een omschrijving
// van een ander programma op de pset, of een datum met tijd), gevolgd door de gewone handeling die die groep verandert.
// Per geval: schrijft het, welke verklaring uit lijst A droeg het (de MEET2-regels van de opslag), en wie vangt een fout
// in de echte uitvoer (het nieuwe stuk eruit): de nacontrole of explainO1 in `lossCheck`, en daarna `checkMergeOutput`
// met de echte overslag (controle 1, heropening, (c) zonder de herstelde groep) en met (c) op alle groepen.
// Elk geval ook zonder het teruggezette slot, als tegenhanger (dan geldt de toets).
import { checkMergeOutput, MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { editedOwnGroup, linesView, ownGroupMembers } from '@/services/ifc/foreign/ownGroups';
import { lossCheck, parseOutLine, refsOutsideText, type LossCheckInput, type Meet2Frame, type OutLine } from '@/services/ifc/foreign/lossCheck';
import { PROP, PSET } from '@/services/ifc/ifcPsets';
import { prepareIfcOutput } from '@/state/prepareIfcOutput';
import { openInStore } from './ifcAppRoute';
import { savedCatalogStart, openForeign, cloneDomain } from './ifcMergeKern';
import { addTask, BASE, bytesOf, clock, latin1, read, REVIT_WALL, SOURCES, withLines } from './ifcEigenKern';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';

const hook = globalThis as typeof globalThis & { meet2LossInput?: (input: LossCheckInput) => void; meet2LastFrame?: Meet2Frame };
const lineOf = (line: OutLine) => `#${line.id}=${line.type}(${line.args.join(',')});`;
type S = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Mutation = { readonly name: string; readonly apply: (lines: OutLine[], source: OutLine[]) => OutLine[] | undefined };

/** De pset met deze naam op projectniveau (de eerste). */
const psetLine = (lines: readonly OutLine[], pset: string) => lines.find(l => l.type === 'IFCPROPERTYSET' && l.args[2] === `'${pset}'`);
/** Een omschrijving op de pset; de rest byte voor byte gelijk. */
function withDescription(bytes: Uint8Array, pset: string): Uint8Array {
  let n = 0;
  const text = latin1(bytes).split('\n').map(raw => {
    const line = parseOutLine(raw);
    if (n || line?.type !== 'IFCPROPERTYSET' || line.args[2] !== `'${pset}'`) return raw;
    if (line.args[3] !== '$') throw new Error(`${pset}: omschrijving is al gezet`);
    n++;
    return lineOf({ ...line, args: line.args.map((x, k) => k === 3 ? "'Omschrijving van een ander programma'" : x) });
  });
  if (n !== 1) throw new Error(`${pset} niet gevonden`);
  return bytesOf(text.join('\n'));
}
/** ProjectStartDate als datum met tijd (T2). */
function withStartDateTime(bytes: Uint8Array): Uint8Array {
  let n = 0;
  const text = latin1(bytes).split('\n').map(raw => {
    const line = parseOutLine(raw);
    if (line?.type !== 'IFCPROPERTYSINGLEVALUE' || line.args[0] !== "'ProjectStartDate'") return raw;
    const m = /^IFCDATE\('(\d{4}-\d{2}-\d{2})'\)$/.exec(line.args[2]);
    if (!m) throw new Error(`ProjectStartDate is geen IFCDATE: ${line.args[2]}`);
    n++;
    return lineOf({ ...line, args: line.args.map((x, k) => k === 2 ? `IFCDATETIME('${m[1]}T07:30:00')` : x) });
  });
  if (n !== 1) throw new Error('ProjectStartDate niet gevonden');
  return bytesOf(text.join('\n'));
}
/** De property van deze pset terug op haar bronwaarde. */
const propBack = (pset: string, prop: string): Mutation => ({
  name: `${prop} terug op de bronwaarde`,
  apply: (lines, source) => {
    const ofPset = (ls: readonly OutLine[]) => {
      const set = psetLine(ls, pset);
      const members = new Set(set ? refsOutsideText(set.args[4]) : []);
      return ls.find(l => members.has(l.id) && l.type === 'IFCPROPERTYSINGLEVALUE' && l.args[0] === `'${prop}'`);
    };
    const now = ofPset(lines), before = ofPset(source);
    if (!now || !before || now.args[2] === before.args[2]) return undefined;
    return lines.map(l => l === now ? { ...l, args: l.args.map((x, k) => k === 2 ? before.args[2] : x) } : l);
  },
});
/** Haal een property uit de pset weg (een nieuw lid). */
const propGone = (pset: string, prop: string): Mutation => ({
  name: `${prop} weg uit de pset`,
  apply: lines => {
    const set = psetLine(lines, pset);
    if (!set) return undefined;
    const members = refsOutsideText(set.args[4]);
    const gone = lines.find(l => members.includes(l.id) && l.type === 'IFCPROPERTYSINGLEVALUE' && l.args[0] === `'${prop}'`);
    if (!gone) return undefined;
    return lines.filter(l => l !== gone).map(l => l === set ? { ...l, args: l.args.map((x, k) => k !== 4 ? x : `(${members.filter(r => r !== gone.id).map(r => '#' + r).join(',')})`) } : l);
  },
});
/** Haal de nieuwe codetemplate (en haar enumeratie) weg (het geval van de review). */
const withoutTemplate = (code: string): Mutation => ({
  name: 'nieuwe codetemplate weg',
  apply: lines => {
    const member = lines.find(l => l.type === 'IFCSIMPLEPROPERTYTEMPLATE' && l.args[2] === `'${code}'`);
    if (!member) return undefined;
    const [enumeration] = refsOutsideText(member.args[7]);
    const parent = lines.find(l => l.type === 'IFCPROPERTYSETTEMPLATE' && refsOutsideText(l.args[6]).includes(member.id));
    if (!parent) return undefined;
    return lines.filter(l => l !== member && l.id !== enumeration).map(l => l === parent ? {
      ...l, args: l.args.map((x, k) => k !== 6 ? x : `(${refsOutsideText(x).filter(r => r !== member.id).map(r => '#' + r).join(',')})`),
    } : l);
  },
});

/** Pas een mutatie toe op de echte uitvoerbytes, regel voor regel. */
function mutateBytes(bytes: Uint8Array, m: Mutation, source: OutLine[]): Uint8Array | undefined {
  const raw = latin1(bytes).split('\n');
  const entries = raw.map(l => parseOutLine(l)).filter((l): l is OutLine => !!l);
  const after = m.apply(entries, source);
  if (!after) return undefined;
  const remaining = new Map(after.map(l => [l.id, l]));
  return bytesOf(raw.filter(l => { const p = parseOutLine(l); return !p || remaining.has(p.id); }).map(l => {
    const p = parseOutLine(l);
    if (!p) return l;
    const a = remaining.get(p.id)!;
    return lineOf(a) === lineOf(p) ? l : lineOf(a);
  }).join('\n'));
}

const kindsOf = (e: unknown) => e instanceof MergeNeedsPhase2Error ? [...new Set(e.cases.map(c => c.kind))].join(',') : `fout ${String(e).slice(0, 80)}`;
const CATCH: Record<string, string> = { 'uitvoer-controle': 'controle 1', 'planning-na-openen': 'heropening', 'ongewijzigd-getal': 'heropening (getal)', 'eigen-uitvoer': '(c)' };

interface Case { readonly label: string; readonly start: () => Promise<Uint8Array>; readonly slot?: (b: Uint8Array) => Uint8Array; readonly act: (s: S) => void; readonly mutations: readonly Mutation[] }

const leavesOf = (s: S) => s.tasks.filter((t: S) => !t.isMilestone && !t.childIds.length);
const catalogOne = () => savedCatalogStart(SOURCES.eigen, false);
const catalogTwo = () => savedCatalogStart(SOURCES.eigen, true);
let provenanceStart: Uint8Array | undefined;
/** Een eigen bestand met een importvlag (`OPS_ImportProvenance`), in de lay-out van de writer, de vlag behouden. */
async function provenance(): Promise<Uint8Array> {
  if (provenanceStart) return provenanceStart;
  const raw = bytesOf(withLines(latin1(read('tests/planning/fixtures/ifc-arity-oude-writer.ifc')), REVIT_WALL));
  const initial = await openForeign(raw);
  const d = cloneDomain(initial);
  d.tasks[0].name = d.tasks[0].name + ' ';
  const first = await prepareIfcWrite(d, initial.ifcSource!);
  const o = await openForeign(first.bytes);
  const back = cloneDomain(o);
  back.tasks[0].name = initial.tasks[0].name;
  back.importPristine = true;
  provenanceStart = (await prepareIfcWrite(back, o.ifcSource!)).bytes;
  if (!latin1(provenanceStart).includes("'UnchangedSinceImport'")) throw new Error('importvlag niet in de beginstand');
  return provenanceStart;
}

const desc = (pset: string) => (b: Uint8Array) => withDescription(b, pset);
const CASES: Case[] = [
  { label: 'OPS_StructureMeta: tweede code (geval van de review)', start: catalogOne, slot: desc(PSET.StructureMeta),
    act: s => { const c = s.addActivityCodeType('Meetcode tweede'); s.addActivityCodeValue(c, { code: 'M', description: 'Meet' }); },
    mutations: [withoutTemplate('Meetcode tweede'), propBack(PSET.StructureMeta, PROP.StructureMeta.structure)] },
  { label: 'OPS_TaskTypes: nieuw type en toewijzen', start: catalogOne, slot: desc(PSET.TaskTypes),
    act: s => { s.ensureProjectTaskType({ id: 'type-meet', name: 'Type meet' }); s.updateTask(leavesOf(s).find((t: S) => !t.customTaskTypeId).id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-meet' }); },
    mutations: [propBack(PSET.TaskTypes, PROP.TaskTypes.TaskTypes)] },
  { label: 'OPS_TaskTypes: type wisselen', start: catalogTwo, slot: desc(PSET.TaskTypes),
    act: s => { s.updateTask(s.tasks.find((t: S) => t.customTaskTypeId === 'type-7d-a').id, { customTaskTypeId: 'type-7d-b' }); },
    mutations: [propBack(PSET.TaskTypes, PROP.TaskTypes.TaskTypes)] },
  { label: 'OPS_Baselines: baseline vastleggen', start: catalogOne, slot: desc(PSET.Baselines),
    act: s => { addTask(s, 'Meettaak'); s.saveBaseline('Meet C'); },
    mutations: [propBack(PSET.Baselines, PROP.Baselines.Baselines), propBack(PSET.Baselines, PROP.Baselines.TaskGuids), propBack(PSET.Baselines, PROP.Baselines.ActiveBaselineId)] },
  { label: 'OPS_Baselines: andere baseline actief', start: catalogOne, slot: desc(PSET.Baselines),
    act: s => { s.setActiveBaseline(s.baselines.find((b: S) => b.id !== s.activeBaselineId).id); },
    mutations: [propBack(PSET.Baselines, PROP.Baselines.ActiveBaselineId)] },
  { label: 'OPS_ProjectSettings: statusdatum zetten', start: catalogOne, slot: desc(PSET.ProjectSettings),
    act: s => { s.setStatusDate('2026-12-01'); },
    mutations: [propGone(PSET.ProjectSettings, PROP.ProjectSettings.StatusDate), propBack(PSET.ProjectSettings, PROP.ProjectSettings.ModifiedAt)] },
  { label: 'OPS_ProjectSettings: WBS-nummering uit', start: catalogOne, slot: desc(PSET.ProjectSettings),
    act: s => { s.setWbsAutoNumber(false); },
    mutations: [propBack(PSET.ProjectSettings, PROP.ProjectSettings.wbsAutoNumber), propGone(PSET.ProjectSettings, PROP.ProjectSettings.wbsAutoNumber), propBack(PSET.ProjectSettings, PROP.ProjectSettings.ModifiedAt)] },
  { label: 'OPS_ProjectSettings (ProjectStartDate met tijd): statusdatum zetten', start: catalogOne, slot: withStartDateTime,
    act: s => { s.setStatusDate('2026-12-01'); },
    mutations: [propBack(PSET.ProjectSettings, PROP.ProjectSettings.StatusDate), propBack(PSET.ProjectSettings, PROP.ProjectSettings.ModifiedAt)] },
  { label: 'OPS_ImportProvenance: eerste bewerking (taak hernoemen)', start: provenance, slot: desc(PSET.ImportProvenance),
    act: s => { const t = leavesOf(s)[0]; s.updateTask(t.id, { name: t.name + ' meet' }); },
    mutations: [] },
];

let failures = 0;
for (const c of CASES) for (const withSlot of [true, false]) {
  const label = `${c.label}${withSlot ? '' : ' [tegenhanger zonder teruggezet slot]'}`;
  try {
    clock.start();
    const start = await c.start();
    const bytes = withSlot && c.slot ? c.slot(start) : start;
    const sourceLines = latin1(bytes).split('\n').map(l => parseOutLine(l)).filter((l): l is OutLine => !!l);
    const { store, snapshot } = await openInStore(bytes);
    c.act(store.getState());
    const state = store.getState();
    const input = snapshot(store);
    let loss: LossCheckInput | undefined;
    hook.meet2LossInput = x => { loss = { ...x, o1: x.o1.map(l => ({ ...l, args: [...l.args] })), meet: undefined }; };
    hook.meet2LastFrame = undefined;
    clock.start();
    let prepared;
    try { prepared = (await prepareIfcOutput(state, input)).prepared; }
    catch (e) {
      const frame = hook.meet2LastFrame as Meet2Frame | undefined;
      console.log(`MEETGEVAL ${label}: geweigerd (${kindsOf(e)}: ${e instanceof MergeNeedsPhase2Error ? e.cases[0]?.detail.slice(0, 200) : ''}); lijst A: ${frame?.recs.map(r => `${r.namen.join('+')} [${r.plek}] ${r.why}`).join(' | ') || 'niets'}`);
      continue;
    } finally { delete hook.meet2LossInput; }
    const frame = hook.meet2LastFrame as Meet2Frame | undefined;
    if (!prepared || !loss) { console.log(`MEETGEVAL ${label}: geen merge (stuk 1 of geen lossCheck)`); continue; }
    const l = loss;
    const memberMap = ownGroupMembers(linesView(l.o1, id => l.index.type(l.index.chunkOf(String(id)))));
    // De overslag van (c) zoals bij opslaan: uit de edits van (b). `lossCheck` opnieuw, zonder meetframe, voor de edits.
    const { edits } = lossCheck({ ...l, meet: { ran: false, recs: [] } }, () => {});
    const skip = new Set(edits.map(e => editedOwnGroup(memberMap, l.o1.find(x => x.id === e.id)!, e.arg)).filter((g): g is string => !!g));
    const outText = latin1(prepared.bytes);
    const settings = psetLine(outText.split('\n').map(x => parseOutLine(x)).filter((x): x is OutLine => !!x), PSET.ProjectSettings);
    console.log(`MEETUITVOER ${label}: OPS_ProjectSettings-leden ${settings?.args[4]}; StatusDate ${/'StatusDate'/.test(outText) ? 'aanwezig' : 'afwezig'}; statusDate in het domein ${input.project.statusDate ?? '-'}`);
    console.log(`MEETGEVAL ${label}: geschreven; (c) slaat over: ${[...skip].join(', ') || 'niets'}; (b) zet terug: ${edits.length}; lijst A: ${frame?.recs.map(r => `${r.namen.join('+')} [${r.plek}; ${r.groep}; ${r.reden}] ${r.why}`).join(' | ') || 'niets'}`);
    for (const m of c.mutations) {
      const o1 = m.apply([...l.o1], sourceLines);
      const mutant = mutateBytes(prepared.bytes, m, sourceLines);
      if (!o1 || !mutant) { console.log(`MEETMUTATIE ${label} · ${m.name}: niet toepasbaar (geen verschil met de bron)`); continue; }
      const probe: Meet2Frame = { ran: false, recs: [] };
      const errs: string[] = [];
      lossCheck({ ...l, o1, meet: probe }, f => errs.push(f.detail.slice(0, 160)));
      const nacontrole = probe.recs.filter(r => r.plek === 'nacontrole' && r.why.startsWith('weigert'));
      const own = { stepIds: prepared.source.stepIds, writtenAt: new Date(BASE), skip };
      let real = 'niemand';
      try { await checkMergeOutput(mutant, input, state.ifcSource!, own); } catch (e) { real = kindsOf(e).split(',').map(k => CATCH[k] ?? k).join(','); }
      let all = 'niemand';
      try { await checkMergeOutput(mutant, input, state.ifcSource!, { ...own, skip: new Set() }); } catch (e) { all = kindsOf(e).split(',').map(k => CATCH[k] ?? k).join(','); }
      console.log(`MEETMUTATIE ${label} · ${m.name}: lossCheck ${errs.length ? `weigert (${nacontrole.length ? 'nacontrole' : 'explainO1'}: ${errs[0]})` : 'geen bezwaar'}; na samenvoegen met de echte overslag: ${real}; met (c) op alle groepen: ${all}`);
    }
  } catch (e) {
    failures++;
    console.log(`XX  meting deel 2 ${label}: ${(e as Error).stack?.slice(0, 400)}`);
  }
}
console.log(failures ? `XX  meting deel 2: ${failures} geval(len) niet gelukt` : 'OK  meting deel 2: alle gevallen gedraaid');
if (failures) process.exitCode = 1;
