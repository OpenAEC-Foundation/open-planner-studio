// #804 fase 1b: gedeelde kern voor `check-ifc-foreign-preserve.ts` en `check-ifc-foreign-merge-telling.ts`.
//
// - `openForeign`: een bestand openen zoals de app met de flag: een eigen store-context (`appStoreFactory.ts`, zoals de
//   headless kern), `openOpenedFile` met de bytes, en dan het domein zoals Opslaan het aan de writer geeft
//   (`buildWriteIFCInput`) plus `ifcSource`. Dat is de toestand die 1c de merge geeft: na de lezer, de omzetting naar het
//   minutenmodel en de herberekening bij openen (vervolg-PR van #867, #886). `openForeignRaw` is de oude
//   testroute (de lezer direct), alleen nog voor de vergelijking in de telling.
// - `mergeProblems`: de invarianten van de merge-writer op uitvoer tegen bron (ontwerp §4.10, de eerste drie alinea's):
//   kop en staart byte-gelijk; elk niet-P-stuk met hetzelfde `#id`, dezelfde bytes en in dezelfde volgorde; geen ander
//   niet-P-stuk erbij (wat er nieuw is, deelt de uitvoer zelf in als P); hetzelfde regeleinde; de scanner neemt de
//   uitvoer aan (dus geen dubbel `#id`).
// - `canon`: het domein zoals de writer het ziet, als tekst met een vaste klok (de maat die ook de open-check gebruikt).
// - `settle`: een eigen bestand van een oudere versie zoals de huidige writer het schrijft, voor proeven die een bron nodig
//   hebben die de leesverliestoets doorstaat (fixronde 2 van #867).
// - `editsFor`: de gewone bewerkingen van een planner op het domein, per taak of per paar (bijsturing 1, punt 2).
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import { MergeNeedsPhase2Error, prepareIfcWrite, writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
import { StepScanError, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { classify } from '@/services/ifc/foreign/classify';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { writeIFC } from '@/services/ifc/ifcWriter';
import type { Task } from '@/types/task';
import { relationAddVerdict } from '@/state/relationRules';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { isCostResource } from '@/types/resource';
import { localTodayIso } from '@/utils/dateUtils';
import { lengthen, lengthenedTask, openInStore, openReadPlanning, recalculated as recalculatedInStore, storeEdit, storeWith } from './ifcAppRoute';
export { openInStore, openReadPlanning } from './ifcAppRoute';

export type Domain = Parameters<typeof writeIfcMerge>[0];
export type Opened = Domain & { ifcSource?: IfcSource };

export const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
export const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/** De oude testroute: de lezer direct (de bytes-route, synchroon, zonder Worker). Zonder de omzetting naar het
 *  minutenmodel en zonder de herberekening bij openen; alleen nog voor de vergelijking in de telling. */
export async function openForeignRaw(bytes: Uint8Array): Promise<Opened> {
  const r = await readIfcBytesDetailed(bytes, {}, { createWorker: () => null });
  return r.result as Opened;
}

/** Openen zoals Bestand → Openen met de flag (#886), zie `openInStore` in `ifcAppRoute.ts`: wat Opslaan aan de writer
 *  geeft (`buildWriteIFCInput`) met `ifcSource` erbij. Dat is de toestand die 1c de merge geeft: na de lezer, de omzetting
 *  naar het minutenmodel en de herberekening bij openen. */
export async function openForeign(bytes: Uint8Array, name = 'bron.ifc'): Promise<Opened> {
  const { store, snapshot } = await openInStore(bytes, name);
  return snapshot(store) as Opened;
}

/**
 * Wat de app laat zien na opslaan en heropenen van hetzelfde domein zonder vreemd deel: `writeIFC` en dan `openForeign`
 * (de route van de app, met de omzetting en de herberekening bij openen). Een gewone opslag rondt hier en daar af (een
 * duur van 17 cijfers); de merge houdt daar de bronwaarde. Voor de vraag of herlezen de planning geeft die de planner zag:
 * `shownAfterOpen`.
 */
export function reopenPlain(d: Domain): Promise<Opened> {
  return openForeign(new TextEncoder().encode(writeIFC(d)));
}

/**
 * De planning die de planner zag, zoals de app haar na openen laat zien: het domein zelf, zonder writer of lezer ertussen,
 * geopend in een eigen store (`openAsDocument`: de omzetting naar het minutenmodel, die op een domein van de app niets meer
 * omzet, en de herberekening bij openen). Een merge die schrijft, moet na heropenen via de app precies dit geven
 * (vervolg-PR van #867, #886).
 */
export async function shownAfterOpen(d: Domain): Promise<Opened> {
  return await openReadPlanning(d, 'domein') as Opened;
}

/** Doorrekenen (F5) zoals de app: `recalculated` uit `ifcAppRoute.ts`. */
export const recalculated = (d: Domain): Promise<Domain> => recalculatedInStore(d);

/** Een kopie van het domein zonder de bron (die blijft gedeeld en wordt niet bewerkt). */
export function cloneDomain(d: Opened): Domain {
  const { ifcSource: _source, ...rest } = d;
  return structuredClone(rest) as Domain;
}

/**
 * Een eigen bestand zoals de huidige writer het schrijft (fixronde 2 van #867). Een bestand van een oudere versie weigert
 * met `niet-gedragen` om velden die de lezer niet draagt (zoals de GlobalIds van `OPS_Resource`, knownbug 1023). Een proef
 * die over iets anders gaat, heeft een bron nodig die de leesverliestoets doorstaat. `settle` zet daarvoor in de BRON per
 * melding de waarde die de writer schrijft: alleen `niet-gedragen` op één argument, met een uitvoerwaarde zonder
 * verwijzing. Ids en het vreemde deel blijven gelijk. Kan een melding zo niet weg (een ontbrekend stuk, een andere
 * lay-out, een verwijzing), dan gooit `settle`. Zo blijft elke afwijking van de bron zichtbaar in de proef die haar nodig had.
 */
export async function settle(bytes: Uint8Array): Promise<Uint8Array> {
  let current = bytes;
  for (let round = 0; round < 4; round++) {
    const opened = await openForeign(current);
    if (!opened.ifcSource?.foreign) throw new Error('settle: geen vreemd deel');
    // Stuk 1 schrijft een ongewijzigde bron letterlijk terug. Deze fixturevoorbereiding
    // moet juist de herschrijf-/verliespoort onderzoeken; alleen de proefbeschrijving wijzigt.
    // De geslaagde uitvoer wordt niet de fixture: zoals voorheen patchen we uitsluitend
    // de concrete niet-gedragen tokens, met behoud van bron-ids en vreemde bytes.
    const candidate = cloneDomain(opened);
    candidate.project.description = `${candidate.project.description} (fixturevoorbereiding)`;
    const outcome = await tryMerge(candidate, opened.ifcSource);
    if (outcome.ok) return current;
    const cases = outcome.error.cases;
    const refOutsideText = (tok: string) => /#\d/.test(tok.replace(/'(?:[^']|'')*'/g, "''"));
    const stuck = cases.filter(c => c.kind !== 'niet-gedragen' || !c.field || c.field.whole || c.field.slotless
      || c.sourceId === undefined || refOutsideText(c.field.out));
    if (stuck.length > 0) throw new Error(`settle: niet te zetten: ${stuck.slice(0, 3).map(c => `${c.kind}: ${c.detail}`).join(' | ')}`);
    current = patchArgs(current, cases.map(c => ({ id: String(c.sourceId), arg: c.field!.arg, value: c.field!.out })));
  }
  throw new Error('settle: na vier rondes nog meldingen');
}

/** Vervang argumenten van entiteiten (op `#id`), byte voor byte; de rest van het bestand blijft gelijk. */
function patchArgs(bytes: Uint8Array, patches: readonly { id: string; arg: number; value: string }[]): Uint8Array {
  const index = scanForeignStep(bytes);
  const byChunk = new Map<number, Map<number, string>>();
  for (const p of patches) {
    const i = index.chunkOf(p.id);
    if (i < 0) throw new Error(`settle: geen #${p.id}`);
    let m = byChunk.get(i);
    if (!m) byChunk.set(i, m = new Map());
    m.set(p.arg, p.value);
  }
  const parts: Uint8Array[] = [];
  let at = 0;
  for (const i of [...byChunk.keys()].sort((x, y) => x - y)) {
    const args = [...(index.argTokens(i) ?? [])].map(t => t.trim());
    for (const [k, v] of byChunk.get(i)!) args[k] = v;
    const from = index.entityStart(i);
    const tail = latin1Text(bytes.subarray(from, index.end(i)));
    const close = tail.lastIndexOf(');');
    parts.push(bytes.subarray(at, from), latin1Bytes(`#${index.id(i)}=${index.type(i)}(${args.join(',')}`), latin1Bytes(tail.slice(close)));
    at = index.end(i);
  }
  parts.push(bytes.subarray(at));
  return concat(parts);
}
const latin1Text = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const latin1Bytes = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));

/** De uitkomst van één merge: de bytes, of de weigering met haar gevallen. Een andere fout gooit door. */
export type MergeOutcome = { ok: true; bytes: Uint8Array; shown: Domain } | { ok: false; kinds: string[]; error: MergeNeedsPhase2Error };
export async function tryMerge(d: Domain, source: IfcSource): Promise<MergeOutcome> {
  try {
    let shown: Domain | undefined;
    const parts = await writeIfcMerge(d, source, async (parsed, side) => {
      const result = structuredClone(parsed);
      if (side === 'uitvoer') shown = result;
      return result;
    });
    if (!shown) throw new Error('merge gaf geen planning aan de naad');
    return { ok: true, bytes: concat(parts), shown };
  } catch (e) {
    if (e instanceof MergeNeedsPhase2Error) return { ok: false, kinds: [...new Set(e.cases.map(c => c.kind))].sort(), error: e };
    throw e;
  }
}

function scanOrReason(bytes: Uint8Array): StepIndex | string {
  try { return scanForeignStep(bytes); } catch (e) { if (e instanceof StepScanError) return `${e.reason}: ${e.message}`; throw e; }
}

/** De invarianten van de merge-uitvoer tegen de bron. Leeg = alles klopt. */
export function mergeProblems(source: Uint8Array, out: Uint8Array): string[] {
  const problems: string[] = [];
  const si = scanForeignStep(source);
  const sc = classify(si);
  const oi = scanOrReason(out);
  if (typeof oi === 'string') return [`de scanner weigert de uitvoer (${oi})`];
  const oc = classify(oi);
  if (oi.lineEnding !== si.lineEnding) problems.push(`regeleinde ${JSON.stringify(oi.lineEnding)} in plaats van ${JSON.stringify(si.lineEnding)}`);
  const chunk = (index: StepIndex, bytes: Uint8Array, i: number) => bytes.subarray(index.start(i), index.end(i));
  // Kop, `DATA;`-stukken en staart: in dezelfde volgorde en byte-gelijk.
  const plain = (index: StepIndex) => Array.from({ length: index.count }, (_, i) => i).filter(i => !index.isEntity(i));
  const sp = plain(si), op = plain(oi);
  if (sp.length !== op.length) problems.push(`${op.length} stukken zonder entiteit in plaats van ${sp.length}`);
  for (let k = 0; k < Math.min(sp.length, op.length); k++) {
    if (!sameBytes(chunk(si, source, sp[k]), chunk(oi, out, op[k]))) problems.push(`stuk zonder entiteit ${k + 1} (kop, DATA of staart) is anders`);
  }
  const outById = new Map<string, number>();
  for (let i = 0; i < oi.count; i++) if (oi.isEntity(i)) outById.set(oi.id(i), i);
  const sourceNonP = new Set<string>();
  let last = -1;
  for (let i = 0; i < si.count; i++) {
    if (!si.isEntity(i) || sc.classes[i] === 1) continue;
    const id = si.id(i);
    sourceNonP.add(id);
    const j = outById.get(id);
    if (j === undefined) { problems.push(`#${id} (${si.type(i)}) ontbreekt`); continue; }
    if (!sameBytes(chunk(si, source, i), chunk(oi, out, j))) problems.push(`#${id} (${si.type(i)}) heeft andere bytes`);
    if (j < last) problems.push(`#${id} (${si.type(i)}) staat op een andere plek in de volgorde`);
    last = Math.max(last, j);
  }
  for (let j = 0; j < oi.count; j++) {
    if (!oi.isEntity(j) || sourceNonP.has(oi.id(j)) || oc.classes[j] === 1) continue;
    problems.push(`#${oi.id(j)} (${oi.type(j)}) is nieuw en geen P (klasse ${oc.classes[j]})`);
  }
  return problems;
}

/** Per relatietype (`Decomposes` via IfcRelAggregates, `Nests`, `HasContext` via IfcRelDeclares) de objecten die in meer
 *  dan één relatie van dat type als lid staan. Die inverse attributen zijn SET [0:1]. */
export function doubleMemberships(bytes: Uint8Array): string[] {
  const index = scanForeignStep(bytes);
  const seen = new Map<string, number>();
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    const type = index.type(i);
    if (type !== 'IFCRELAGGREGATES' && type !== 'IFCRELNESTS' && type !== 'IFCRELDECLARES') continue;
    for (const m of index.refsAt(i, 5)) {
      if (m < 0) continue;
      const key = `${type} #${index.id(m)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k).sort();
}

/** Het domein zoals de writer het ziet: `writeIFC` zonder vreemd deel, met een vaste klok en reeks; een baselineregel
 *  zonder taak zonder haar id. */
export function canon(d: Domain, reseed: (seed: number) => void): string {
  reseed(0x1b04);
  // Een baselineregel zonder taak telt zonder haar id (#886, `orphanRowsWithoutId`).
  return planningCanon(d);
}

/** Het eerste verschil tussen twee teksten, met wat omringende tekst. */
export function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `@${i}: «${a.slice(Math.max(0, i - 80), i + 80)}» ≠ «${b.slice(Math.max(0, i - 80), i + 80)}»`;
}

// ── De gewone bewerkingen (bijsturing 1, punt 2) ──

export type EditKind = 'niets' | 'andere-ouder' | 'niveau-hoger' | 'volgorde-kinderen' | 'relatie-erbij' | 'taak-wissen'
  | 'taak-erbij' | 'hernoemen' | 'duur' | 'toewijzing-erbij' | 'voortgang' | 'doorrekenen'
  | 'resource-erbij' | 'kalender-erbij' | 'baseline-vastleggen'
  | 'reeks-taak-baseline' | 'reeks-resource-kalender-toewijzing' | 'reeks-taak-bestaand-type' | 'reeks-twee-baselines'
  | 'reeks-tweede-code' | 'reeks-tweede-type' | 'reeks-type-wisselen' | 'reeks-actieve-baseline';
/** Een niet-toepasselijke soort blijft zichtbaar, maar gaat nooit naar de merge. */
export interface Edit { readonly kind: EditKind; readonly label: string; apply(d: Domain): void | Promise<Domain | void>; readonly recalculate?: boolean; readonly notApplicable?: string }
export class EditNotAppliedError extends Error {
  constructor(readonly outcome: 'niet-van-toepassing' | 'door-app-geweigerd', detail: string) { super(detail); }
}
const unavailable = (kind: EditKind, reason: string): Edit => ({ kind, label: reason, notApplicable: reason,
  apply: () => { throw new EditNotAppliedError('niet-van-toepassing', reason); } });
/** Meteen na de echte actie de bedoelde wijziging bewaken; een verse payload alleen is geen bewijs.
 * Deze kandidaten zijn vooraf geldig bevonden. Een weigering/no-op is dus onverwacht en maakt de telling rood.
 */
function appEdit(kind: EditKind, label: string, apply: Edit['apply'], changed: (before: Domain, after: Domain) => boolean): Edit {
  return { kind, label, apply: async d => {
    const before = structuredClone(d), result = await apply(d), after = result ?? d;
    if (!changed(before, after)) throw new EditNotAppliedError('door-app-geweigerd', `${kind}: geldige actie veranderde niet wat zij moest veranderen (${label})`);
    return after;
  } };
}
/** Een bewerking toepassen, met doorrekenen als ze dat vraagt. */
export async function applyEdit(edit: Edit, d: Domain): Promise<Domain> {
  const changed = await edit.apply(d);
  const next = changed ? changed : d;
  return edit.recalculate ? recalculated(next) : next;
}

const byId = (d: Domain) => new Map(d.tasks.map(t => [t.id, t]));
const isDescendant = (tasks: ReadonlyMap<string, Task>, id: string, ancestor: string): boolean => {
  for (let cur = tasks.get(id); cur?.parentId; cur = tasks.get(cur.parentId)) if (cur.parentId === ancestor) return true;
  return false;
};
/**
 * De bewerkingen voor één domein, in vaste volgorde. Keuze (bijsturing 1, punt 2):
 *  - andere ouder: elke taak onder de eerste samenvattingstaak die niet haar ouder, zijzelf of een nakomeling is;
 *  - niveau hoger: elke taak met een ouder gaat naar de ouder van die ouder (achter die ouder);
 *  - volgorde van kinderen: per samenvattingstaak met minstens twee kinderen de volgorde omkeren; plus de wortels;
 *  - relatie erbij: per gekozen voorganger de eerste FS-opvolger die de echte appregels toelaten; anders niet toepasbaar;
 *  - taak wissen: per taak, met haar nakomelingen, relaties en toewijzingen.
 * `max` begrenst het aantal per soort met een vaste stap over de taken (een vaste steekproef bij grote bestanden).
 */
export function plannerEdits(d: Domain, max = Infinity): Edit[] {
  const tasks = d.tasks;
  const pick = <T>(list: readonly T[]): T[] => {
    if (list.length <= max) return [...list];
    const step = list.length / max;
    return Array.from({ length: max }, (_, k) => list[Math.floor(k * step)]);
  };
  const summaries = tasks.filter(t => t.childIds.length > 0);
  const out: Edit[] = [{ kind: 'niets', label: 'niets', apply: () => {} }];
  for (const t of pick(tasks)) {
    const map = byId(d);
    const target = summaries.find(s => s.id !== t.id && s.id !== t.parentId && !isDescendant(map, s.id, t.id));
    if (!target) continue;
    out.push(appEdit('andere-ouder', `${t.id} → onder ${target.id}`, x => storeEdit(x, s => s.moveTask(t.id, target.id, undefined, { phaseAssignments: 'move', answered: true })),
      (before, after) => before.tasks.find(a => a.id === t.id)?.parentId !== target.id && after.tasks.find(a => a.id === t.id)?.parentId === target.id));
  }
  for (const t of pick(tasks.filter(t => t.parentId))) {
    out.push(appEdit('niveau-hoger', `${t.id} een niveau hoger`, x => storeEdit(x, s => s.outdentTasks([t.id], { phaseAssignments: 'move', answered: true })),
      (before, after) => after.tasks.some(a => a.id === t.id && a.parentId === (before.tasks.find(p => p.id === t.parentId)?.parentId ?? null))));
  }
  for (const s of pick(summaries.filter(s => s.childIds.length >= 2))) {
    out.push(appEdit('volgorde-kinderen', `kinderen van ${s.id} omgekeerd`, x => storeEdit(x, state => {
      // Dezelfde rijverplaatsing als slepen; de rauwe taakvolgorde en WBS gaan mee.
      [...s.childIds].reverse().forEach((id, childIndex) => state.moveTaskTo(id, { parentId: s.id, childIndex }));
    }), (before, after) => {
      const was = before.tasks.find(t => t.id === s.id)!.childIds, now = after.tasks.find(t => t.id === s.id)!.childIds;
      return was.length >= 2 && now.length === was.length && now.every((id, i) => id === was[was.length - 1 - i]);
    }));
  }
  if (tasks.filter(t => !t.parentId).length >= 2) {
    out.push(appEdit('volgorde-kinderen', 'wortels omgekeerd', x => storeEdit(x, state => {
      tasks.filter(t => !t.parentId).reverse().forEach((t, childIndex) => state.moveTaskTo(t.id, { parentId: null, childIndex }));
    }), (before, after) => {
      const was = before.tasks.filter(t => !t.parentId), now = after.tasks.filter(t => !t.parentId);
      return was.length >= 2 && now.length === was.length && now.every((t, i) => t.id === was[was.length - 1 - i].id);
    }));
  }
  // Eerst in het hele bestand geldige paren zoeken, daarna de vaste steekproef nemen.
  // Zo verbergt een samenvatting zonder legale opvolger niet de geldige relaties tussen haar bladeren.
  const relations = tasks.flatMap(a => {
    const b = tasks.find(b => relationAddVerdict(tasks, d.sequences, { predecessorId: a.id, successorId: b.id, type: 'FINISH_START' }).ok);
    return b ? [{ a, b }] : [];
  });
  if (!relations.length) out.push(unavailable('relatie-erbij', 'geen geldig FS-paar dat de app toelaat'));
  for (const { a, b } of pick(relations)) {
    out.push(appEdit('relatie-erbij', `FS ${a.id} → ${b.id}`, x => storeEdit(x, s => {
      const id = s.addSequence({ predecessorId: a.id, successorId: b.id, type: 'FINISH_START', lagDays: 0 });
      if (id === null) throw new EditNotAppliedError('door-app-geweigerd', `addSequence weigert de geldige kandidaat ${a.id} → ${b.id}`);
    }), (before, after) => after.sequences.length === before.sequences.length + 1
      && after.sequences.some(r => !before.sequences.some(old => old.id === r.id) && r.predecessorId === a.id && r.successorId === b.id && r.type === 'FINISH_START' && r.lagDays === 0)));
  }
  for (const t of pick(tasks)) {
    out.push(appEdit('taak-wissen', `${t.id} wissen`, x => storeEdit(x, s => s.deleteTask(t.id)),
      (before, after) => before.tasks.some(a => a.id === t.id) && !after.tasks.some(a => a.id === t.id)));
  }
  return out;
}

/** Taak erbij, hernoemen en duur op de vaste taak; toewijzing op het eerste vrije, geldige taak/resource-paar. */
export function basicEdits(d: Domain): Edit[] {
  const leaf = lengthenedTask(d);
  const out: Edit[] = [];
  if (!leaf) return out;
  out.push(appEdit('taak-erbij', `nieuwe taak naast ${leaf.id}`, x => storeEdit(x, s => {
    s.addTask({ name: 'Nieuwe taak 1b', position: { anchorId: leaf.id, where: 'below' } }, { phaseAssignments: 'move', answered: true });
  }), (before, after) => after.tasks.length === before.tasks.length + 1 && after.tasks.some(t => !before.tasks.some(old => old.id === t.id) && t.name === 'Nieuwe taak 1b')));
  const name = leaf.name === 'Hernoemd in 1b' ? 'Opnieuw hernoemd in 1b' : 'Hernoemd in 1b';
  out.push(appEdit('hernoemen', `${leaf.id} hernoemd`, x => storeEdit(x, s => s.updateTask(leaf.id, { name })),
    (before, after) => before.tasks.find(t => t.id === leaf.id)?.name !== name && after.tasks.find(t => t.id === leaf.id)?.name === name));
  out.push(appEdit('duur', `${leaf.id} een dag langer`, x => lengthen(x, leaf.id), (before, after) => {
    const was = before.tasks.find(t => t.id === leaf.id)!.time, now = after.tasks.find(t => t.id === leaf.id)!.time;
    return was.durationUnit === 'hours' ? now.durationMinutes === (was.durationMinutes ?? 0) + 480 : now.scheduleDuration === was.scheduleDuration + 1;
  }));
  const candidate = d.tasks.filter(t => !isSummaryTask(t)).flatMap(task => d.resources
    .filter(resource => (!task.isMilestone || isCostResource(resource)) && !d.assignments.some(a => a.taskId === task.id && a.resourceId === resource.id))
    .map(resource => ({ task, resource })))[0];
  if (candidate) {
    const { task, resource } = candidate;
    out.push(appEdit('toewijzing-erbij', `${resource.id} op ${task.id}`, x => storeEdit(x, s => s.assignResource(task.id, resource.id, 4)),
      (before, after) => after.assignments.length === before.assignments.length + 1 && after.assignments.some(a => a.taskId === task.id && a.resourceId === resource.id && a.unitsPerDay === (isCostResource(resource) ? 1 : 4))));
  } else out.push(unavailable('toewijzing-erbij', 'geen vrij taak/resource-paar dat de app toelaat'));
  return out;
}

/** De gewone bewerkingen van `basicEdits`, plus (vervolg-PR van #867) doorrekenen (F5, na de langere duur) en voortgang
 *  (50 % via enterTaskProgress; een startvraag bevestigen met het voorstel). Op dezelfde vaste taak. */
export function ordinaryEdits(d: Domain): Edit[] {
  const out = basicEdits(d);
  const lengthen = out.find(e => e.kind === 'duur');
  const leaf = d.tasks.find(t => t.childIds.length === 0 && !t.isMilestone);
  if (lengthen) out.push({ kind: 'doorrekenen', label: `${lengthen.label} en doorgerekend`, apply: lengthen.apply, recalculate: true });
  if (leaf) {
    const completion = leaf.time.completion === 0.5 ? 0.25 : 0.5;
    out.push(appEdit('voortgang', `${leaf.id} voortgang ${completion * 100} % via invoer`, async x => {
      const { store, buildWriteIFCInput } = await storeWith(x);
      const edit = { field: 'completion', value: completion } as const;
      const opts = { today: localTodayIso() };
      let result = store.getState().enterTaskProgress(leaf.id, edit, opts);
      if (!result.ok && result.reason === 'needsActualStart') {
        result = store.getState().enterTaskProgress(leaf.id, edit, { ...opts, actualStart: result.question.latest });
      }
      if (!result.ok) throw new Error(`voortgangsinvoer ${leaf.id}: ${result.reason}`);
      return structuredClone(buildWriteIFCInput(store.getState(), 'merge'));
    }, (before, after) => before.tasks.find(t => t.id === leaf.id)?.time.completion !== completion && after.tasks.find(t => t.id === leaf.id)?.time.completion === completion));
  }
  return [...out, ...newObjectEdits(d)];
}

/** Eerste opslag van nieuwe eigen stukken: dezelfde acties als de resource-/kalender- en baselinepanelen. */
export function newObjectEdits(d: Domain): Edit[] {
  const resource = d.resources.find(r => !isCostResource(r));
  const { id: _id, ...calendar } = structuredClone(d.calendar);
  return [
    appEdit('resource-erbij', 'nieuwe resource', x => storeEdit(x, s => {
      s.addResource({ name: 'Nieuwe resource 1c', type: 'EQUIPMENT', description: 'Eerste opslag', maxUnits: 2, costPerHour: 37.5 });
    }), (before, after) => after.resources.length === before.resources.length + 1
      && after.resources.some(r => !before.resources.some(old => old.id === r.id) && r.name === 'Nieuwe resource 1c' && r.maxUnits === 2 && r.costPerHour === 37.5)),
    appEdit('kalender-erbij', resource ? `nieuwe kalender op ${resource.id}` : 'nieuwe losse kalender', x => storeEdit(x, s => {
      const id = s.addCalendar({ ...calendar, name: 'Nieuwe kalender 1c' });
      if (resource) s.updateResource(resource.id, { calendarId: id });
    }), (before, after) => {
      const added = (after.resourceCalendars ?? []).find(c => !(before.resourceCalendars ?? []).some(old => old.id === c.id));
      return (after.resourceCalendars?.length ?? 0) === (before.resourceCalendars?.length ?? 0) + 1
        && added?.name === 'Nieuwe kalender 1c' && (!resource || after.resources.find(r => r.id === resource.id)?.calendarId === added.id);
    }),
    appEdit('baseline-vastleggen', 'nieuwe baseline vastgelegd', x => storeEdit(x, s => { s.saveBaseline('Nieuwe baseline 1c'); }), (before, after) => {
      const added = after.baselines?.find(b => !before.baselines?.some(old => old.id === b.id));
      return (after.baselines?.length ?? 0) === (before.baselines?.length ?? 0) + 1
        && added?.name === 'Nieuwe baseline 1c' && after.activeBaselineId === added.id;
    }),
  ];
}

/** 1571: één werkelijk opgeslagen beginstand voor de vier vaste reeksen; nooit een stille skip bij setupfouten. */
export async function savedSequenceStart(bytes: Uint8Array): Promise<Uint8Array> {
  const { store, snapshot } = await openInStore(bytes);
  const state = store.getState();
  const leaf = state.tasks.find(t => !t.isMilestone && !t.childIds.length);
  if (!leaf) throw new Error('vaste reeksen: geen gewone taak in de beginstand');
  state.saveBaseline('Opgeslagen beginbaseline 7c');
  state.ensureProjectTaskType({ id: 'type-7c', name: 'Opgeslagen taaktype 7c' });
  state.updateTask(leaf.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-7c' });
  const input = snapshot(store);
  const prepared = await prepareIfcWrite(input, input.ifcSource!);
  const output = concat(prepared.parts);
  const reopened = await openForeign(output);
  if (!reopened.baselines?.some(b => b.name === 'Opgeslagen beginbaseline 7c')
    || reopened.tasks.find(t => t.id === leaf.id)?.customTaskTypeId !== 'type-7c'
    || mergeProblems(bytes, output).length) throw new Error('vaste reeksen: opgeslagen beginstand niet behouden');
  return output;
}

/** Alleen op drie vaste bronnen aanroepen: deze reeksen horen niet in ordinaryEdits van het hele corpus. */
export function fixedSequenceEdits(d: Domain): Edit[] {
  const leaf = d.tasks.find(t => !t.isMilestone && !t.childIds.length)!;
  const add = (s: Parameters<Parameters<typeof storeEdit>[1]>[0]) => {
    const id = s.addTask({ name: 'Nieuwe taak 7c', position: { anchorId: leaf.id, where: 'below' } }, { phaseAssignments: 'move', answered: true });
    if (!id) throw new Error('vaste reeksen: taak toevoegen geweigerd');
    return id;
  };
  return [
    appEdit('reeks-taak-baseline', 'taak toevoegen → baseline vastleggen', x => storeEdit(x, s => {
      add(s); s.saveBaseline('Nieuwe baseline 7c');
    }), (a, b) => b.tasks.length === a.tasks.length + 1 && b.baselines?.length === (a.baselines?.length ?? 0) + 1),
    appEdit('reeks-resource-kalender-toewijzing', 'resource → kalender → koppelen → toewijzing', x => storeEdit(x, s => {
      const resource = s.addResource({ name: 'Resource 7c', type: 'EQUIPMENT', description: 'Vaste reeks', maxUnits: 2, costPerHour: 42 });
      const { id: _id, ...calendar } = structuredClone(s.calendar);
      const id = s.addCalendar({ ...calendar, name: 'Kalender 7c' });
      s.updateResource(resource, { calendarId: id }); s.assignResource(leaf.id, resource, 1);
    }), (a, b) => {
      const resource = b.resources.find(r => !a.resources.some(old => old.id === r.id));
      return !!resource && b.resourceCalendars?.some(c => c.id === resource.calendarId && c.name === 'Kalender 7c') === true
        && b.assignments.some(v => v.taskId === leaf.id && v.resourceId === resource.id && v.unitsPerDay === 1);
    }),
    appEdit('reeks-taak-bestaand-type', 'taak toevoegen → bestaand eigen taaktype geven', x => storeEdit(x, s => {
      const id = add(s); s.updateTask(id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-7c' });
    }), (a, b) => b.tasks.some(t => !a.tasks.some(old => old.id === t.id) && t.customTaskTypeId === 'type-7c')),
    appEdit('reeks-twee-baselines', 'twee baselines achter elkaar', x => storeEdit(x, s => {
      s.saveBaseline('Baseline A 7c'); s.saveBaseline('Baseline B 7c');
    }), (a, b) => b.baselines?.length === (a.baselines?.length ?? 0) + 2),
  ];
}

/** 7d: twee gebruikte typen, één code en twee baselines in één echte eerste opslag. */
export async function savedCatalogStart(bytes: Uint8Array, twoTypes = true): Promise<Uint8Array> {
  const { store, snapshot } = await openInStore(bytes);
  const s = store.getState(), leaves = s.tasks.filter(t => !t.isMilestone && !t.childIds.length);
  if (leaves.length < 4) throw new Error('catalogusreeksen: vier gewone taken nodig');
  for (const [i, id] of (twoTypes ? ['type-7d-a', 'type-7d-b'] : ['type-7d-a']).entries()) {
    s.ensureProjectTaskType({ id, name: `Type ${i} 7d` });
    s.updateTask(leaves[i].id, { taskType: 'USERDEFINED', customTaskTypeId: id });
  }
  // Beide typen blijven gebruikt wanneer de eerste taak wisselt of haar type verliest.
  s.updateTask(leaves[2].id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-7d-a' });
  const code = s.addActivityCodeType('Code A 7d'), value = s.addActivityCodeValue(code, { code: 'A', description: 'Waarde A' });
  s.setTaskActivityCode(leaves[0].id, code, value);
  s.saveBaseline('Baseline A 7d'); s.saveBaseline('Baseline B 7d');
  const input = snapshot(store), output = concat((await prepareIfcWrite(input, input.ifcSource!)).parts);
  const reread = await openForeign(output);
  if (JSON.stringify(reread.customTaskTypes) !== JSON.stringify(input.customTaskTypes)
    || JSON.stringify(reread.activityCodeTypes) !== JSON.stringify(input.activityCodeTypes)
    || JSON.stringify(reread.baselines) !== JSON.stringify(input.baselines)
    || mergeProblems(bytes, output).length) throw new Error('catalogusreeksen: beginstand niet behouden');
  return output;
}
export function fixedCatalogEdits(_d: Domain): Edit[] {
  return [
    appEdit('reeks-tweede-code', 'tweede codedefinitie', x => storeEdit(x, s => {
      const code = s.addActivityCodeType('Code B 7d'), value = s.addActivityCodeValue(code, { code: 'B', description: 'Waarde B' });
      s.setTaskActivityCode(s.tasks.find(t => !t.childIds.length && !t.customTaskTypeId)!.id, code, value);
    }), (a, b) => b.activityCodeTypes!.length === a.activityCodeTypes!.length + 1),
    appEdit('reeks-tweede-type', 'nieuwe taaktypedefinitie en koppeling', x => storeEdit(x, s => {
      s.ensureProjectTaskType({ id: 'type-7d-c', name: 'Type C 7d' });
      s.updateTask(s.tasks.find(t => !t.childIds.length && !t.customTaskTypeId)!.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-7d-c' });
    }), (a, b) => b.customTaskTypes!.length === a.customTaskTypes!.length + 1),
    appEdit('reeks-type-wisselen', 'taak wisselt naar bestaand type', x => storeEdit(x, s => {
      s.updateTask(s.tasks.find(t => t.customTaskTypeId === 'type-7d-a')!.id, { customTaskTypeId: 'type-7d-b' });
    }), (a, b) => b.tasks.some(t => t.customTaskTypeId !== a.tasks.find(old => old.id === t.id)?.customTaskTypeId)),
    appEdit('reeks-actieve-baseline', 'andere bestaande baseline actief', x => storeEdit(x, s => {
      s.setActiveBaseline(s.baselines.find(b => b.id !== s.activeBaselineId)!.id);
    }), (a, b) => a.activeBaselineId !== b.activeBaselineId),
  ];
}
