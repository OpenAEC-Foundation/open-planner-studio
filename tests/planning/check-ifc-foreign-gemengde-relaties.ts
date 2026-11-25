import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classify } from '@/services/ifc/foreign/classify';
import type { ForeignChange } from '@/services/ifc/foreign/changeList';
import { checkMergeOutput, MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { splitStepArgs, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import { entityValue, placeTriggers, serializeStepValue, withoutRemovedMembers, type StepValue } from '@/services/ifc/foreign/stepValue';
import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { departuresOf } from '@/services/ifc/foreign/departures';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import { documentContentOf } from '@/state/documentSaveState';
import { computeIfcOutputHere, prepareIfcOutput } from '@/state/prepareIfcOutput';
import { loadStore, openInStore } from './ifcAppRoute';
import { ROOT } from './ifcBonsaiPin';
import { canon, doubleMemberships, mergeProblems, openForeign, sameBytes, settle, shownAfterOpen } from './ifcMergeKern';
import { installDeterminism } from './ifcPariteitKern';

const reseed = installDeterminism();
let checks = 0;
const fails: string[] = [];
const ok = (label: string, condition: boolean) => { checks++; if (!condition) fails.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  const same = JSON.stringify(got) === JSON.stringify(want);
  ok(same ? label : `${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`, same);
};

const encode = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const append = (text: string, rows: readonly string[]) => text.replace(/ENDSEC;(\s*END-ISO-10303-21;)/, (_m, tail: string) => `${rows.join('\n')}\nENDSEC;${tail}`);
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
const lineOf = (bytes: Uint8Array, id: number) => decode(bytes).match(new RegExp(`^#${id}=.*$`, 'm'))?.[0] ?? '';
const event = (id: number, guid: string, name: string) => `#${id}=IFCEVENT('${guid}',#5,'${name}',$,$,$,$,.NOTDEFINED.,.NOTDEFINED.,$,$);`;

const B4D = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc'), 'utf8');
const withNestTask = (t: string) => append(patch(t, 106, 5, '(#104,#108,#8200)'), [event(8200, '0gemengdKind0000000000', 'Steiger opbouwen')]);
const withNestSchedule = (t: string) => append(t, ["#8300=IFCRELNESTS('0gemengdSchema00000000',#5,$,$,#94,(#100,#8301));",
  event(8301, '0gemengdSchemaLid00000', 'Oplevering')]);
const withControlSchedule = (t: string) => append(patch(t, 102, 4, '(#100,#8401)'), [event(8401, '0gemengdControlLid0000', 'Keuring')]);
const withSecondNest = (t: string) => append(patch(t, 133, 4, '(#131,#8501)'), [
  "#8501=IFCTASK('0tweedeTaakAfbouw00000',#130,'Schilderwerk',$,$,'3',$,$,$,.F.,$,$,.NOTDEFINED.);",
  "#8502=IFCRELNESTS('0nestAfbouw00000000000',#132,'WBS Afbouw','Twee leden',#129,(#131,#8501));",
]);
const withSecondCrew = (t: string) => append(patch(t, 120, 4, '(#118,#8700,#30)'),
  ["#8700=IFCLABORRESOURCE('0steigerPloeg000000000',#117,'Steigerploeg',$,$,$,$,$,$,$,.NOTDEFINED.);"]);
const withDoubleCrew = (t: string) => append(t, ["#8710=IFCRELASSIGNSTOPROCESS('0tweedeToewijzing00000',#119,$,$,(#118),$,#104,$);"]);
const withWorkWeek = (t: string) => append(patch(t, 98, 6, '(#8600)'), ["#8600=IFCWORKTIME('Werkweek',.PREDICTED.,$,#8601,$,$);",
  '#8601=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,$,$,(#8602));', "#8602=IFCTIMEPERIOD('07:00:00','16:00:00');"]);
const SHARED_PSET = await settle(new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/council/r5sol-gedeelde-calendar-pset.ifc'))));

const SOURCES: Readonly<Record<string, Uint8Array>> = {
  'bonsai-4d.ifc': encode(B4D),
  'Nests onder een taak': encode(withNestTask(B4D)),
  'Process met twee ploegen': encode(withSecondCrew(B4D)),
  'Process met dezelfde ploeg tweemaal': encode(withDoubleCrew(B4D)),
  'Nests onder een schema': encode(withNestSchedule(B4D)),
  'Control onder een schema': encode(withControlSchedule(B4D)),
  'Nests van het tweede schema': encode(withSecondNest(B4D)),
  'Control onder een kalender met werktijden': encode(patch(withWorkWeek(B4D), 122, 4, '(#104,#108,#131,#144,#160)')),
  'gedeelde pset (b)': SHARED_PSET,
};
const COMBINED = encode(withWorkWeek(withSecondNest(withNestSchedule(withNestTask(B4D)))));

const { buildWriteIFCInput } = await loadStore();
type Store = Awaited<ReturnType<typeof openInStore>>['store'];
type State = ReturnType<Store['getState']>;
const WRITTEN = 'notifications.foreignChangesWritten';
const counts = new WeakMap<Store, unknown[]>();
async function opened(bytes: Uint8Array): Promise<Store> {
  const { store } = await openInStore(bytes);
  const calls: unknown[] = [], notify = store.getState().notify;
  store.setState({ notify: n => { if (n.messageKey === WRITTEN) calls.push(n.params?.count); notify(n); } });
  counts.set(store, calls);
  return store;
}
const countOf = (store: Store) => counts.get(store)!;

async function save(store: Store): Promise<PreparedIfcWrite | MergeNeedsPhase2Error> {
  const state = store.getState();
  try {
    const prepared = (await prepareIfcOutput(state, buildWriteIFCInput(state, 'merge'), undefined, computeIfcOutputHere)).prepared!;
    store.getState().commitSavedDocument(documentContentOf(state, state.activeDocumentId!)!, state, undefined, prepared);
    return prepared;
  } catch (e) {
    if (e instanceof MergeNeedsPhase2Error) return e;
    throw e;
  }
}

const listRefs = (value: StepValue) => new Set(placeTriggers(value).lists.flat());
const valueAt = (index: StepIndex, bytes: Uint8Array, id: number) => {
  const chunk = index.chunkOf(String(id));
  return chunk < 0 ? undefined : entityValue(bytes, index.entityStart(chunk), index.end(chunk));
};

async function conditions(at: string, source: Uint8Array, out: Uint8Array, changes: readonly ForeignChange[], store: Store,
  linksBefore: ReadonlyMap<string, unknown>, stepIds: Readonly<Record<string, number>>, opened: WriteIFCInput) {
  eq(`${at}: het vreemde deel is dat van de bron, op de wijzigingslijst na`, mergeProblems(source, out, changes), []);
  const si = scanForeignStep(source), sc = classify(si), oi = scanForeignStep(out), oc = classify(oi);
  const domain = buildWriteIFCInput(store.getState(), 'merge');
  const planning = (id: number) => { const c = si.chunkOf(String(id)); return c >= 0 && sc.selection.inD[c] === 1; };
  const gone = (id: number) => planning(id) && oi.chunkOf(String(id)) < 0;
  const departure = departuresOf(si, sc.selection.inD, { stepIds, before: opened, after: domain });
  const leaves = (relation: number) => { const d = departure(relation); return 'leave' in d ? d.leave : new Set<number>(); };
  const listed = new Set(changes.map(c => c.id));
  const unlisted: string[] = [];
  for (let i = 0; i < si.count; i++) {
    if (!si.isEntity(i) || sc.classes[i] === 1 || listed.has(Number(si.id(i)))) continue;
    const away = [...leaves(i)].filter(id => !gone(id));
    if (away.length > 0) unlisted.push(`#${si.id(i)} zonder ${away.map(id => `#${id}`).join(',')}`);
  }
  eq(`${at}: geen stuk buiten de wijzigingslijst waar volgens de planning een lid uit moet`, unlisted, []);
  for (const change of changes) {
    if (change.kind === 'vervallen' && change.unusedKeyOfTask !== undefined) continue;
    const before = valueAt(si, source, change.id);
    if (!before) { ok(`${at}: #${change.id} op de lijst staat in de bron`, false); continue; }
    const relation = si.chunkOf(String(change.id));
    const left = (id: number) => gone(id) || leaves(relation).has(id);
    if (change.kind === 'vervallen') {
      ok(`${at}: #${change.id} vervalt alleen omdat zijn planningsleden weg of verplaatst zijn`,
        placeTriggers(before).lists.some(list => list.every(left)) || placeTriggers(before).direct.some(gone) || sc.foreignMembers.includes(relation));
      continue;
    }
    const after = valueAt(oi, out, change.id);
    const kept = after ? listRefs(after) : new Set<number>();
    const removed = new Set([...listRefs(before)].filter(id => !kept.has(id)));
    eq(`${at}: #${change.id} verliest precies de planningsleden die weg zijn of volgens de planning vertrekken`,
      [...removed].sort((x, y) => x - y), [...listRefs(before)].filter(left).sort((x, y) => x - y));
    eq(`${at}: #${change.id} is verder byte voor byte de bron`, after && serializeStepValue(after), serializeStepValue(withoutRemovedMembers(before, removed)));
  }
  const nowPlanning: string[] = [];
  for (let i = 0; i < si.count; i++) {
    if (!si.isEntity(i) || sc.classes[i] === 1) continue;
    const j = oi.chunkOf(si.id(i));
    if (j >= 0 && oc.classes[j] === 1) nowPlanning.push(si.id(i));
  }
  eq(`${at}: geen vreemd stuk wordt na opslaan als planning gelezen`, nowPlanning, []);
  eq(`${at}: geen object in twee Nests of Decomposes`, doubleMemberships(out), []);
  const psets = new Map<string, number>();
  for (let i = 0; i < oi.count; i++) {
    if (!oi.isEntity(i) || oi.type(i) !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = oi.refAt(i, 5), name = pset >= 0 ? oi.name(pset) ?? '' : '';
    for (const owner of oi.refsAt(i, 4)) psets.set(`#${oi.id(owner)} ${name}`, (psets.get(`#${oi.id(owner)} ${name}`) ?? 0) + 1);
  }
  eq(`${at}: geen object met twee psets met dezelfde naam`, [...psets].filter(([, n]) => n > 1).map(([k]) => k), []);
  const reread = await openForeign(out);
  reseed(0x1b04);
  eq(`${at}: na heropenen ziet de planner wat hij zag`, canon(reread, reseed), canon(await shownAfterOpen(buildWriteIFCInput(store.getState(), 'merge')), reseed));
  const links = reread.ifcSource?.elementLinks ?? new Map();
  const shared = [...linksBefore.keys()].filter(id => reread.tasks.some(t => t.id === id));
  eq(`${at}: de koppelingen met bouwdelen blijven`, shared.map(id => [id, links.get(id)]), shared.map(id => [id, linksBefore.get(id)]));
  return reread;
}

interface Outcome { readonly written: boolean; readonly kinds: readonly string[]; readonly detail: string; readonly all: readonly string[]; readonly changes: readonly string[]; readonly out?: Uint8Array }
async function savedStep(at: string, store: Store): Promise<Outcome> {
  const source = store.getState().ifcSource!;
  const linksBefore = new Map(source.elementLinks ?? []);
  const counted = countOf(store).length;
  const result = await save(store);
  if (result instanceof MergeNeedsPhase2Error) {
    const all = result.cases.map(c => `${c.kind} #${c.sourceId}: ${c.detail}`);
    return { written: false, kinds: [...new Set(result.cases.map(c => `${c.kind} #${c.sourceId}`))], changes: [], detail: all.slice(0, 2).join(' | '), all };
  }
  const changes = result.foreignChanges ?? [];
  await conditions(at, source.bytes, result.bytes, changes, store, linksBefore, source.stepIds, source.opened!);
  eq(`${at}: de telling na het opslaan`, countOf(store).slice(counted), changes.length > 0 ? [changes.length] : []);
  const again = await save(store);
  ok(`${at}: een tweede opslag direct daarna is byte voor byte gelijk`, !(again instanceof MergeNeedsPhase2Error) && sameBytes(again.bytes, result.bytes));
  return { written: true, kinds: [], detail: '', all: [], changes: changes.map(c => `${c.kind} #${c.id}`), out: result.bytes };
}

const task = (s: State, name: string) => s.tasks.find(t => t.name === name)!;
const PHASES = { phaseAssignments: 'move', answered: true } as const;
const NEW_CREW = { name: 'Nieuwe ploeg', description: '', type: 'LABOR' as const, maxUnits: 1 };
const reversedChildren = (s: State, name: string) => {
  const parent = task(s, name);
  [...parent.childIds].reverse().forEach((id, childIndex) => s.moveTaskTo(id, { parentId: parent.id, childIndex }, PHASES));
};
const ownCalendar = (s: State, name: string) => {
  const { id: _id, ...calendar } = structuredClone(s.calendar);
  s.updateTask(task(s, name).id, { calendarId: s.addCalendar({ ...calendar, name: 'Eigen kalender' }) });
  s.runCPM();
};

interface Case {
  readonly source: string; readonly label: string; readonly act: (s: State) => void; readonly list: readonly string[];
  readonly then?: (out: Uint8Array, src: Uint8Array) => void | Promise<void>;
}
const CASES: readonly Case[] = [
  { source: 'bonsai-4d.ifc', label: 'Process onder een taak: een toewijzing gewist', act: s => { s.unassignResource(s.assignments[0].id); },
    list: ['gewijzigd #120'], then: (out, src) => eq('Process onder een taak, gewist: #120 houdt de wand', lineOf(out, 120), lineOf(src, 120).replace('(#118,#30)', '(#30)')) },
  { source: 'bonsai-4d.ifc', label: 'Process onder een taak: een tweede ploeg erbij', act: s => { s.assignResource(task(s, 'Wand A bouwen').id, s.addResource(NEW_CREW), 1); },
    list: ['gewijzigd #120'] },
  { source: 'Process met twee ploegen', label: 'Process onder een taak: één van twee ploegen gewist', act: s => {
    s.unassignResource(s.assignments.find(a => s.resources.find(r => r.id === a.resourceId)?.name === 'Metselploeg')!.id);
  }, list: ['gewijzigd #120'], then: (out, src) => eq('Process met twee ploegen, gewist: de andere ploeg en de wand blijven', lineOf(out, 120), lineOf(src, 120).replace('(#118,#8700,#30)', '(#8700,#30)')) },
  { source: 'Process met dezelfde ploeg tweemaal', label: 'Process onder een taak: dezelfde ploeg in twee relaties, alleen de taaknaam anders',
    act: s => { s.updateTask(task(s, 'Wand A bouwen').id, { name: 'Wand A metselen' }); }, list: [],
    then: (out, src) => eq('Process met dezelfde ploeg tweemaal: #120 en #8710 blijven staan', [lineOf(out, 120), lineOf(out, 8710)], [lineOf(src, 120), lineOf(src, 8710)]) },
  { source: 'bonsai-4d.ifc', label: 'Process onder een taak: dezelfde ploeg ook aan een andere taak', act: s => {
    s.assignResource(task(s, 'Wand B bouwen').id, s.resources.find(r => r.name === 'Metselploeg')!.id, 2);
  }, list: [] },
  { source: 'bonsai-4d.ifc', label: 'een wortel-taak van het tweede schema onder een taak van het eerste',
    act: s => { s.moveTaskTo(task(s, 'Stucwerk').id, { parentId: task(s, 'Ruwbouw').id, childIndex: 2 }, PHASES); }, list: [],
    then: (out, src) => eq('tweede schema, Control: de relatie van Bonsai blijft staan, zoals op main', lineOf(out, 133), lineOf(src, 133)) },
  { source: 'bonsai-4d.ifc', label: 'Aggregates onder het werkplan: een baseline vastgelegd', act: s => { s.saveBaseline('Baseline PR 8'); }, list: [],
    then: (out, src) => eq('Aggregates onder het werkplan: #96 byte voor byte', lineOf(out, 96), lineOf(src, 96)) },
  { source: 'Nests onder een taak', label: 'een kind onder een andere ouder', act: s => { s.moveTaskTo(task(s, 'Wand B bouwen').id, { parentId: task(s, 'Stucwerk').id, childIndex: 0 }, PHASES); },
    list: ['gewijzigd #106'], then: (out, src) => eq('Nests onder een taak, andere ouder: #106 houdt Wand A en de gebeurtenis', lineOf(out, 106), lineOf(src, 106).replace('(#104,#108,#8200)', '(#104,#8200)')) },
  { source: 'Nests onder een taak', label: 'een kind wordt een wortel-taak', act: s => { s.moveTaskTo(task(s, 'Wand A bouwen').id, { parentId: null, childIndex: 0 }, PHASES); },
    list: ['gewijzigd #106'] },
  { source: 'Nests onder een taak', label: 'de kinderen in andere volgorde', act: s => { reversedChildren(s, 'Ruwbouw'); }, list: ['gewijzigd #106'],
    then: (out, src) => eq('Nests onder een taak, volgorde: alleen Wand B moet vóór de rest en vertrekt', lineOf(out, 106), lineOf(src, 106).replace('(#104,#108,#8200)', '(#104,#8200)')) },
  { source: 'Nests onder een taak', label: 'een kind erbij, vooraan', act: s => {
    s.addTask({ name: 'Nieuw kind', position: { anchorId: task(s, 'Wand A bouwen').id, where: 'above' } }, PHASES);
  }, list: [] },
  { source: 'Nests onder een taak', label: 'een kind erbij, achteraan', act: s => {
    s.addTask({ name: 'Nieuw kind', position: { anchorId: task(s, 'Wand B bouwen').id, where: 'below' } }, PHASES);
  }, list: ['gewijzigd #106'] },
  { source: 'Nests onder een taak', label: 'een kind gewist', act: s => { s.deleteTask(task(s, 'Wand B bouwen').id); }, list: ['gewijzigd #106', 'gewijzigd #116', 'gewijzigd #122', 'vervallen #178'] },
  { source: 'Nests onder een schema', label: 'een wortel-taak wordt een kind', act: s => {
    const phase = s.addTask({ name: 'Nieuwe fase', position: { anchorId: task(s, 'Ruwbouw').id, where: 'above' } }, PHASES);
    s.moveTaskTo(task(s, 'Ruwbouw').id, { parentId: phase, childIndex: 0 }, PHASES);
  }, list: ['gewijzigd #8300'], then: (out, src) => eq('Nests onder een schema: de gebeurtenis blijft', lineOf(out, 8300), lineOf(src, 8300).replace('(#100,#8301)', '(#8301)')) },
  { source: 'Nests onder een schema', label: 'een kind wordt een wortel-taak', act: s => { s.moveTaskTo(task(s, 'Wand A bouwen').id, { parentId: null, childIndex: 1 }, PHASES); },
    list: [], then: (out, src) => eq('Nests onder een schema, nieuwe wortel: #8300 byte voor byte', lineOf(out, 8300), lineOf(src, 8300)) },
  { source: 'Control onder een schema', label: 'een nieuwe wortel-taak', act: s => {
    s.addTask({ name: 'Nieuwe fase', position: { anchorId: task(s, 'Ruwbouw').id, where: 'above' } }, PHASES);
  }, list: [], then: (out, src) => eq('Control onder een schema: #102 byte voor byte', lineOf(out, 102), lineOf(src, 102)) },
  { source: 'Nests van het tweede schema', label: 'een taak van het tweede schema onder een taak van het eerste',
    act: s => { s.moveTaskTo(task(s, 'Stucwerk').id, { parentId: task(s, 'Ruwbouw').id, childIndex: 2 }, PHASES); }, list: ['gewijzigd #8502'],
    then: async (out, src) => {
      eq('tweede schema, Nests: het andere lid, GlobalId, owner history, Name en Description blijven', lineOf(out, 8502), lineOf(src, 8502).replace('(#131,#8501)', '(#8501)'));
      const reread = await openForeign(out);
      const stuc = reread.tasks.find(t => t.name === 'Stucwerk');
      eq('tweede schema, Nests: na heropenen de gekozen ouder', reread.tasks.find(t => t.id === stuc?.parentId)?.name, 'Ruwbouw');
    } },
  { source: 'Control onder een kalender met werktijden', label: 'een taak met een eigen kalender', act: s => { ownCalendar(s, 'Stucwerk'); },
    list: ['gewijzigd #122'], then: (out, src) => eq('Control onder een kalender: de andere taken en de baselinetaken blijven', lineOf(out, 122), lineOf(src, 122).replace('(#104,#108,#131,#144,#160)', '(#104,#108,#144,#160)')) },
  { source: 'gedeelde pset (b)', label: 'andere uren per dag op de gedeelde kalender', act: s => { s.setCalendar({ ...s.calendar, hoursPerDay: 7 }); },
    list: ['gewijzigd #52'], then: (out, src) => eq('gedeelde pset: de wand houdt de oude pset', [lineOf(out, 51), lineOf(out, 50)], [lineOf(src, 51), lineOf(src, 50)]) },
  { source: 'gedeelde pset (b)', label: 'een andere kalendernaam (niet in de pset)', act: s => { s.setCalendar({ ...s.calendar, name: 'Andere naam' }); }, list: [] },
];

const kinds = new Map<string, number>();
for (const c of CASES) {
  const at = `${c.source}: ${c.label}`;
  const src = SOURCES[c.source];
  const store = await opened(src);
  try { c.act(store.getState()); } catch (e) { ok(`${at}: de bewerking lukt (${(e as Error).message})`, false); continue; }
  const outcome = await savedStep(at, store);
  ok(`${at}: schrijft${outcome.written ? '' : ` (geweigerd: ${outcome.detail})`}`, outcome.written);
  if (!outcome.written) continue;
  eq(`${at}: de wijzigingslijst`, outcome.changes, c.list);
  await c.then?.(outcome.out!, src);
}

{
  const at = 'bonsai-4d.ifc: een toewijzing gewist, opslaan, Ctrl+Z, opslaan (knownbug 2355)';
  const src = SOURCES['bonsai-4d.ifc'];
  const store = await opened(src);
  store.getState().unassignResource(store.getState().assignments[0].id);
  const first = await savedStep(`${at}, eerste opslag`, store);
  store.getState().undo();
  eq(`${at}: Ctrl+Z zet de toewijzing terug`, store.getState().assignments.length, 1);
  const second = await savedStep(`${at}, tweede opslag`, store);
  ok(`${at}: beide opslagen schrijven`, first.written && second.written);
  if (second.out) eq(`${at}: de ploeg staat in een eigen relatie, niet terug in #120`, lineOf(second.out, 120), lineOf(src, 120).replace('(#118,#30)', '(#30)'));
}

{
  const src = SOURCES['Nests van het tweede schema'];
  const store = await opened(src);
  store.getState().moveTaskTo(task(store.getState(), 'Stucwerk').id, { parentId: task(store.getState(), 'Ruwbouw').id, childIndex: 2 }, PHASES);
  store.getState().undo();
  const outcome = await savedStep('tweede schema: verplaatsen en Ctrl+Z vóór het opslaan', store);
  ok(`tweede schema: verplaatsen en Ctrl+Z vóór het opslaan schrijft (${outcome.detail})`, outcome.written);
  eq('tweede schema: verplaatsen en Ctrl+Z vóór het opslaan: niets op de wijzigingslijst', outcome.changes, []);
  if (outcome.out) eq('tweede schema: verplaatsen en Ctrl+Z vóór het opslaan: Stucwerk blijft in de Nests van Bonsai', lineOf(outcome.out, 8502), lineOf(src, 8502));
}

{
  const store = await opened(SOURCES['bonsai-4d.ifc']);
  ownCalendar(store.getState(), 'Wand A bouwen');
  const outcome = await savedStep('knownbug 2378, bonsai-4d.ifc: Wand A bouwen een eigen kalender en doorrekenen', store);
  eq('knownbug 2378: de weigering heeft nog dezelfde redenen', outcome.all, ['bronvorm-leest-anders #undefined: 2 veld(en) in de vorm van de bron lezen na openen anders: '
    + 'taak task-ifc-22icVZXFsEZ1Ius5rjnii6, time.earlyFinish: "2026-02-06T17:00" na herlezen in plaats van "2026-02-02T09:00"; '
    + 'taak task-ifc-22icVZXFsEZ1Ius5rjnii6, time.lateFinish: "2026-02-06T17:00" na herlezen in plaats van "2026-02-02T09:00"']);
}

{
  const store = await opened(SOURCES['bonsai-4d.ifc']);
  const at = 'knownbug 2379, bonsai-4d.ifc';
  store.getState().deleteTask(task(store.getState(), 'Wand B bouwen').id);
  const first = await savedStep(`${at}: Wand B bouwen gewist, opslaan`, store);
  eq(`${at}: de eerste opslag schrijft`, [first.written, first.changes], [true, ['gewijzigd #116', 'gewijzigd #122', 'vervallen #178']]);
  store.getState().addTask({ name: 'Nieuwe taak', position: { anchorId: task(store.getState(), 'Stucwerk').id, where: 'above' } }, PHASES);
  const second = await savedStep(`${at}: een nieuwe taak boven Stucwerk, opslaan`, store);
  eq(`${at}: de tweede opslag schrijft`, [second.written, second.changes], [true, []]);
  store.getState().moveTaskTo(task(store.getState(), 'Wand A bouwen').id, { parentId: null, childIndex: 0 }, PHASES);
  const third = await savedStep(`${at}: Wand A bouwen bovenaan als wortel-taak, opslaan`, store);
  eq(`${at}: de derde opslag weigert nog om dezelfde redenen`, third.all, ['planning-na-openen #undefined: taak task-ifc-2lNOVVAc3x$DPP3aHgo958.time.durationUnit: "hours" → "days"']);
}

async function refusesOutput(label: string, source: string, act: (s: State) => void,
  mutate: (out: string, changes: readonly ForeignChange[]) => readonly [string, readonly ForeignChange[]]) {
  const store = await opened(SOURCES[source]);
  act(store.getState());
  const input = buildWriteIFCInput(store.getState(), 'merge'), ifcSource = store.getState().ifcSource!;
  let prepared: PreparedIfcWrite;
  try { prepared = await prepareIfcWrite(input, ifcSource); } catch (e) {
    ok(`mutatie: ${label}: de merge schrijft de juiste uitvoer (${e instanceof MergeNeedsPhase2Error ? e.cases[0]?.detail : String(e)})`, false);
    return;
  }
  const [text, changes] = mutate(decode(prepared.bytes), prepared.foreignChanges ?? []);
  ok(`mutatie: ${label}: de proef verandert de uitvoer`, text !== decode(prepared.bytes) || changes !== prepared.foreignChanges);
  let reason = '';
  try { await checkMergeOutput(encode(text), input, ifcSource, undefined, changes); } catch (e) { if (e instanceof MergeNeedsPhase2Error) reason = e.cases[0]?.detail ?? e.message; }
  ok(`mutatie: ${label}: de uitvoercontrole houdt haar tegen`, reason !== '');
  console.log(`   mutatie ${label}: ${reason.slice(0, 200)}`);
}
const unassigned = (s: State) => { s.unassignResource(s.assignments[0].id); };
const line120 = (out: string) => out.match(/^#120=.*$/m)![0];
await refusesOutput('het lid blijft in de relatie van het andere programma (dubbele Nests)', 'Nests van het tweede schema',
  s => { s.moveTaskTo(task(s, 'Stucwerk').id, { parentId: task(s, 'Ruwbouw').id, childIndex: 2 }, PHASES); },
  (out, changes) => [out.replace(/^#8502=.*$/m, () => lineOf(SOURCES['Nests van het tweede schema'], 8502)), changes.filter(c => c.id !== 8502)]);
await refusesOutput('het hele stuk vervalt terwijl er vreemde leden over zijn', 'bonsai-4d.ifc', unassigned,
  (out, changes) => [out.replace(`${line120(out)}\n`, ''), changes.map(c => c.id === 120 ? { kind: 'vervallen' as const, id: c.id, oldBytes: c.oldBytes } : c)]);
await refusesOutput('de wijziging staat niet op de wijzigingslijst', 'bonsai-4d.ifc', unassigned, (out, changes) => [out, changes.filter(c => c.id !== 120)]);
await refusesOutput('een vreemd lid gaat mee uit het stuk', 'bonsai-4d.ifc', unassigned, (out, changes) => {
  const trimmed = line120(out).replace('(#30)', '()');
  return [out.replace(line120(out), () => trimmed), changes.map(c => c.id === 120 && c.kind === 'gewijzigd' ? { ...c, newBytes: encode(decode(c.newBytes).replace('(#30)', '()')) } : c)];
});
const pieceText = (bytes: Uint8Array, id: number) => {
  const index = scanForeignStep(bytes), chunk = index.chunkOf(String(id));
  return decode(bytes.slice(index.start(chunk), index.end(chunk)));
};
await refusesOutput('een ongewijzigd lid gaat uit een gemengde relatie (#108 uit #122)', 'bonsai-4d.ifc', unassigned, (out, changes) => {
  const was = pieceText(SOURCES['bonsai-4d.ifc'], 122), now = was.replace('(#104,#108,#144,#160)', '(#104,#144,#160)');
  return [out.replace(was, () => now), [...changes, { kind: 'gewijzigd' as const, id: 122, oldBytes: encode(was), newBytes: encode(now) }]];
});
{
  const store = await opened(SOURCES['bonsai-4d.ifc']);
  unassigned(store.getState());
  const input = buildWriteIFCInput(store.getState(), 'merge'), ifcSource = store.getState().ifcSource!;
  const prepared = await prepareIfcWrite(input, ifcSource);
  let reason = '';
  try { await checkMergeOutput(prepared.bytes, input, ifcSource, undefined, prepared.foreignChanges ?? []); } catch (e) { reason = String(e); }
  eq(`controle 1 aanvaardt de bedoelde wijziging van #120 (${reason})`, [reason, (prepared.foreignChanges ?? []).map(c => `${c.kind} #${c.id}`)], ['', ['gewijzigd #120']]);
}
const nextIds = (out: string, count: number) => {
  const max = Math.max(...[...out.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])));
  return Array.from({ length: count }, (_, k) => max + 1 + k);
};
const insertAfter = (out: string, id: number, rows: readonly string[]) => out.replace(new RegExp(`^(#${id}=.*)$`, 'm'), line => `${line}\n${rows.join('\n')}`);
await refusesOutput('alleen Wand B verplaatst, en ook Wand A gaat uit #106 naar een eigen IfcRelNests', 'Nests onder een taak',
  s => { s.moveTaskTo(task(s, 'Wand B bouwen').id, { parentId: task(s, 'Stucwerk').id, childIndex: 0 }, PHASES); }, (out, changes) => {
    const listed = changes.find(c => c.id === 106)!;
    const was = decode((listed as Extract<ForeignChange, { kind: 'gewijzigd' }>).newBytes), now = was.replace('(#104,#8200)', '(#8200)');
    const [nest] = nextIds(out, 1);
    return [insertAfter(out.replace(was, () => now), 100, [`#${nest}=IFCRELNESTS('0eigenNestWandA0000000',$,$,$,#100,(#104));`]),
      changes.map(c => c.id === 106 ? { ...listed, newBytes: encode(now) } : c)];
  });
await refusesOutput('één ploeg gewist, en ook de andere ploeg gaat uit #120 naar een eigen toewijzing', 'Process met twee ploegen', s => {
  s.unassignResource(s.assignments.find(a => s.resources.find(r => r.id === a.resourceId)?.name === 'Metselploeg')!.id);
}, (out, changes) => {
  const listed = changes.find(c => c.id === 120)!;
  const was = decode((listed as Extract<ForeignChange, { kind: 'gewijzigd' }>).newBytes), now = was.replace('(#8700,#30)', '(#30)');
  const [assign] = nextIds(out, 1);
  return [insertAfter(out.replace(was, () => now), 104, [`#${assign}=IFCRELASSIGNSTOPROCESS('0eigenSteigerToewijzng',$,$,$,(#8700),$,#104,$);`]),
    changes.map(c => c.id === 120 ? { ...listed, newBytes: encode(now) } : c)];
});
await refusesOutput('alleen een andere kalendernaam, en de kalender verlaat de gedeelde OPS_Calendar', 'gedeelde pset (b)', s => {
  s.setCalendar({ ...s.calendar, name: 'Andere naam' });
}, (out, changes) => {
  const src = SOURCES['gedeelde pset (b)'];
  const was = pieceText(src, 52), now = was.replace('(#46,#904)', '(#904)');
  const values = [47, 48, 49, 50], ids = nextIds(out, values.length + 2), [pset, rel] = ids.slice(values.length);
  const copies = values.map((v, k) => lineOf(src, v).replace(`#${v}=`, `#${ids[k]}=`));
  return [insertAfter(out.replace(was, () => now), 46, [...copies,
    `#${pset}=IFCPROPERTYSET('0eigenKalenderPset0000',$,'OPS_Calendar',$,(${ids.slice(0, values.length).map(i => `#${i}`).join(',')}));`,
    `#${rel}=IFCRELDEFINESBYPROPERTIES('0eigenKalenderRel00000',$,$,$,(#46),#${pset});`]),
  [...changes, { kind: 'gewijzigd' as const, id: 52, oldBytes: encode(was), newBytes: encode(now) }]];
});
await refusesOutput('bij (b) wijzigt de pset van het vreemde object mee', 'gedeelde pset (b)', s => { s.setCalendar({ ...s.calendar, hoursPerDay: 7 }); }, (out, changes) => {
  const was = pieceText(SOURCES['gedeelde pset (b)'], 50), now = was.replace(/IFCREAL\([^)]*\)/, 'IFCREAL(7.)');
  return [out.replace(was, () => now), [...changes, { kind: 'gewijzigd' as const, id: 50, oldBytes: encode(was), newBytes: encode(now) }]];
});
await refusesOutput('een lege relatie blijft staan', 'Nests van het tweede schema',
  s => { s.moveTaskTo(task(s, 'Stucwerk').id, { parentId: task(s, 'Ruwbouw').id, childIndex: 2 }, PHASES); s.moveTaskTo(task(s, 'Schilderwerk').id, { parentId: task(s, 'Ruwbouw').id, childIndex: 3 }, PHASES); },
  (out, changes) => {
    const was = pieceText(SOURCES['Nests van het tweede schema'], 8502), empty = was.replace('(#131,#8501)', '()');
    return [out.replace(/ENDSEC;(\s*END-ISO-10303-21;)/, (_m, tail: string) => `${empty.replace(/^\s*/, '')}\nENDSEC;${tail}`),
      changes.map(c => c.id === 8502 ? { kind: 'gewijzigd' as const, id: c.id, oldBytes: c.oldBytes, newBytes: encode(`\n${empty.replace(/^\s*/, '')}`) } : c)];
  });

function prng(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Step = readonly [string, (s: State, pick: <T>(list: readonly T[]) => T) => string | undefined];
const isUnder = (s: State, id: string, ancestor: string) => {
  for (let cur = s.tasks.find(t => t.id === id); cur?.parentId; cur = s.tasks.find(t => t.id === cur!.parentId)) if (cur.parentId === ancestor) return true;
  return false;
};
const nameOf = (s: State, id: string | null | undefined) => s.tasks.find(t => t.id === id)?.name ?? '-';
const leavesOf = (s: State) => s.tasks.filter(t => t.childIds.length === 0 && !t.isMilestone);
const STEPS: readonly Step[] = [
  ['toewijzing gewist', (s, pick) => {
    if (s.assignments.length === 0) return undefined;
    const a = pick(s.assignments);
    s.unassignResource(a.id);
    return `toewijzing van ${nameOf(s, a.taskId)} gewist`;
  }],
  ['ploeg toegewezen', (s, pick) => {
    const leaves = leavesOf(s);
    if (leaves.length === 0 || s.resources.length === 0) return undefined;
    const t = pick(leaves), r = pick(s.resources);
    if (s.assignments.some(a => a.taskId === t.id && a.resourceId === r.id)) return undefined;
    s.assignResource(t.id, r.id, 1);
    return `${r.name} aan ${t.name}`;
  }],
  ['nieuwe ploeg toegewezen', (s, pick) => {
    const leaves = leavesOf(s);
    if (leaves.length === 0) return undefined;
    const t = pick(leaves);
    s.assignResource(t.id, s.addResource(NEW_CREW), 1);
    return `nieuwe ploeg aan ${t.name}`;
  }],
  ['andere ouder', (s, pick) => {
    const t = pick(s.tasks), parents = s.tasks.filter(p => p.id !== t.id && p.id !== t.parentId && !isUnder(s, p.id, t.id) && !p.isMilestone);
    if (parents.length === 0) return undefined;
    const p = pick(parents), at = pick([0, p.childIds.length]);
    s.moveTaskTo(t.id, { parentId: p.id, childIndex: at }, PHASES);
    return `${t.name} onder ${p.name} op plek ${at}`;
  }],
  ['wortel-taak worden', (s, pick) => {
    const children = s.tasks.filter(t => t.parentId);
    if (children.length === 0) return undefined;
    const t = pick(children);
    s.moveTaskTo(t.id, { parentId: null, childIndex: 0 }, PHASES);
    return `${t.name} wortel-taak`;
  }],
  ['andere volgorde', (s, pick) => {
    const parents = s.tasks.filter(t => t.childIds.length >= 2);
    if (parents.length === 0) return undefined;
    const p = pick(parents);
    reversedChildren(s, p.name);
    return `kinderen van ${p.name} omgekeerd`;
  }],
  ['taak erbij', (s, pick) => {
    if (s.tasks.length === 0) return undefined;
    const anchor = pick(s.tasks), where = pick(['above', 'below'] as const);
    s.addTask({ name: `Nieuw ${s.tasks.length}`, position: { anchorId: anchor.id, where } }, PHASES);
    return `nieuwe taak ${where === 'above' ? 'boven' : 'onder'} ${anchor.name}`;
  }],
  ['taak gewist', (s, pick) => {
    const leaves = s.tasks.filter(t => t.childIds.length === 0);
    if (leaves.length <= 1) return undefined;
    const t = pick(leaves);
    s.deleteTask(t.id);
    return `${t.name} gewist`;
  }],
  ['eigen kalender', (s, pick) => {
    const leaves = leavesOf(s).filter(t => !t.calendarId);
    if (leaves.length === 0) return undefined;
    const t = pick(leaves);
    ownCalendar(s, t.name);
    return `${t.name} eigen kalender`;
  }],
  ['Ctrl+Z', s => { s.undo(); return 'Ctrl+Z'; }],
];
const SEEDS = [0x804a, 0x804b, 0x804c, 0x804d];
const TODAY: Readonly<Record<string, readonly string[]>> = {
  "reeks 804a, stap 2": [
    "bronvorm-leest-anders #undefined: 2 veld(en) in de vorm van de bron lezen na openen anders: taak task-ifc-0lcQqRJaYYk6A457FDkszn, time.lateStart: \"2026-02-02T07:00\" na herlezen in plaats van \"2026-02-09T09:00\"; taak task-ifc-0lcQqRJaYYk6A457FDkszn, time.lateFinish: \"2026-02-06T16:00\" na herlezen in plaats van \"2026-02-16T09:00\"",
  ],
  "reeks 804b, stap 5": [
    "bronvorm-leest-anders #undefined: 2 veld(en) in de vorm van de bron lezen na openen anders: taak task-ifc-0tweedeTaakAfbouw00000, time.lateStart: \"2026-02-02T07:00\" na herlezen in plaats van \"2026-02-09T09:00\"; taak task-ifc-0tweedeTaakAfbouw00000, time.lateFinish: \"2026-02-06T16:00\" na herlezen in plaats van \"2026-02-16T09:00\"",
  ],
  "reeks 804d, stap 3": [
    "niet-eenduidig #8622: IFCRELASSIGNSTOCONTROL #8622, argument 1 na de bewerking: #8608 → #101",
    "niet-eenduidig #8622: IFCRELASSIGNSTOCONTROL #8622, argument 4 na de bewerking: (#104) → (#100)",
    "niet-eenduidig #102: IFCRELASSIGNSTOCONTROL #102: heeft in de uitvoer na de bewerking dezelfde tegenhanger (#8558) als een ander stuk van de bron",
    "niet-eenduidig #8622: IFCRELASSIGNSTOCONTROL #8622: heeft in de uitvoer na de bewerking dezelfde tegenhanger (#8558) als een ander stuk van de bron",
  ],
  "reeks 804d, stap 5": [
    "planning-na-openen #undefined: taak task-ifc-2lNOVVAc3x$DPP3aHgo958.time.durationUnit: \"hours\" → \"days\"",
  ],
  "reeks 804d, stap 6": [
    "planning-na-openen #undefined: taak task-ifc-22icVZXFsEZ1Ius5rjnii6.time.lateStart: \"2026-02-09T07:00\" → \"2026-02-02T09:00\"",
  ],
};
const refusedSteps: string[] = [];
const sequenceLog: string[] = [];
let written = 0, refused = 0;
for (const seed of SEEDS) {
  const random = prng(seed), pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const store = await opened(COMBINED);
  const done: string[] = [];
  let undoable = 0;
  for (let step = 0; step < 6; step++) {
    const [label, act] = pick(STEPS);
    if (label === 'Ctrl+Z' && undoable === 0) continue;
    let applied: string | undefined;
    try { applied = act(store.getState(), pick); } catch { applied = undefined; }
    if (applied === undefined) continue;
    undoable += label === 'Ctrl+Z' ? -1 : 1;
    done.push(applied);
    const at = `reeks ${seed.toString(16)}, stap ${step + 1} (${done.join(' → ')})`;
    const outcome = await savedStep(at, store);
    if (outcome.written) { written++; continue; }
    refused++;
    for (const kind of outcome.kinds) kinds.set(kind.split(' ')[0], (kinds.get(kind.split(' ')[0]) ?? 0) + 1);
    const key = `reeks ${seed.toString(16)}, stap ${step + 1}`;
    refusedSteps.push(key);
    eq(`${at}: alleen een weigering met de redenen van vandaag (knownbug 2378, 2379 of 2356 b)`, outcome.all, TODAY[key] ?? []);
    sequenceLog.push(`${at}: geweigerd ${JSON.stringify(outcome.all)}`);
    store.getState().undo();
    undoable--;
  }
}

eq('de reeksen weigeren precies de stappen van vandaag', refusedSteps, Object.keys(TODAY));
console.log(`   reeksen (seeds ${SEEDS.map(s => s.toString(16)).join(', ')}): ${written} opslagen geschreven, ${refused} geweigerd${refused ? ` (${[...kinds].map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`);
for (const line of sequenceLog) console.log(`   ${line}`);
if (fails.length > 0) {
  console.log(`XX  ifc-foreign-gemengde-relaties: ${fails.length} afwijking(en) van ${checks}`);
  for (const f of fails) console.log(`   - ${f}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-gemengde-relaties: ${checks} toetsen groen (${CASES.length} vaste gevallen, ${SEEDS.length} reeksen)`);
