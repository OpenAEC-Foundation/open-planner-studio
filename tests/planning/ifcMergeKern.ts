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
import { MergeNeedsPhase2Error, writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
import { scanStep, StepScanError, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import { classify } from '@/services/ifc/foreign/classify';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { writeIFC } from '@/services/ifc/ifcWriter';
import type { Task } from '@/types/task';
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
    const outcome = await tryMerge(cloneDomain(opened), opened.ifcSource);
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
  const index = scanStep(bytes);
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
      const result = await openReadPlanning(parsed, side);
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
  try { return scanStep(bytes); } catch (e) { if (e instanceof StepScanError) return `${e.reason}: ${e.message}`; throw e; }
}

/** De invarianten van de merge-uitvoer tegen de bron. Leeg = alles klopt. */
export function mergeProblems(source: Uint8Array, out: Uint8Array): string[] {
  const problems: string[] = [];
  const si = scanStep(source);
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
  const index = scanStep(bytes);
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
  | 'taak-erbij' | 'hernoemen' | 'duur' | 'toewijzing-erbij' | 'voortgang' | 'doorrekenen';
/** `applyEdit` neemt de hele verse payload over, ook als een echte actie optionele velden heeft gewist.
 * Een door de app geweigerde poging (bijvoorbeeld een kringrelatie of dubbele toewijzing) blijft een gemeten
 * plannerhandeling: de merge krijgt dan de ongewijzigde payload, geen kale vervanging voor de geweigerde actie. */
export interface Edit { readonly kind: EditKind; readonly label: string; apply(d: Domain): void | Promise<Domain | void>; readonly recalculate?: boolean }

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
 *  - relatie erbij: per taak een FS-relatie naar de volgende taak in `tasks`, als die er nog niet is;
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
    out.push({ kind: 'andere-ouder', label: `${t.id} → onder ${target.id}`, apply: (x) => storeEdit(x, s => s.moveTask(t.id, target.id, undefined, { phaseAssignments: 'move', answered: true })) });
  }
  for (const t of pick(tasks.filter(t => t.parentId))) {
    out.push({ kind: 'niveau-hoger', label: `${t.id} een niveau hoger`, apply: (x) => storeEdit(x, s => s.outdentTasks([t.id], { phaseAssignments: 'move', answered: true })) });
  }
  for (const s of pick(summaries.filter(s => s.childIds.length >= 2))) {
    out.push({ kind: 'volgorde-kinderen', label: `kinderen van ${s.id} omgekeerd`, apply: (x) => storeEdit(x, state => {
      // Dezelfde rijverplaatsing als slepen; de rauwe taakvolgorde en WBS gaan mee.
      [...s.childIds].reverse().forEach((id, childIndex) => state.moveTaskTo(id, { parentId: s.id, childIndex }));
    }) });
  }
  if (tasks.filter(t => !t.parentId).length >= 2) {
    out.push({ kind: 'volgorde-kinderen', label: 'wortels omgekeerd', apply: (x) => storeEdit(x, state => {
      tasks.filter(t => !t.parentId).reverse().forEach((t, childIndex) => state.moveTaskTo(t.id, { parentId: null, childIndex }));
    }) });
  }
  const related = new Set(d.sequences.map(s => `${s.predecessorId}>${s.successorId}`));
  for (let k = 0; k + 1 < tasks.length; k++) {
    const a = tasks[k], b = tasks[k + 1];
    if (related.has(`${a.id}>${b.id}`) || related.has(`${b.id}>${a.id}`) || !pick(tasks).includes(a)) continue;
    out.push({ kind: 'relatie-erbij', label: `FS ${a.id} → ${b.id}`, apply: (x) => storeEdit(x, s => {
      s.addSequence({ predecessorId: a.id, successorId: b.id, type: 'FINISH_START', lagDays: 0 });
    }) });
  }
  for (const t of pick(tasks)) {
    out.push({ kind: 'taak-wissen', label: `${t.id} wissen`, apply: (x) => storeEdit(x, s => s.deleteTask(t.id)) });
  }
  return out;
}

/** De bewerkingen van 1b (brief): taak erbij, hernoemen, duur wijzigen, toewijzing erbij. Eén van elk, op een vaste taak. */
export function basicEdits(d: Domain): Edit[] {
  const leaf = lengthenedTask(d);
  const out: Edit[] = [];
  if (!leaf) return out;
  out.push({ kind: 'taak-erbij', label: `nieuwe taak naast ${leaf.id}`, apply: (x) => storeEdit(x, s => {
    s.addTask({ name: 'Nieuwe taak 1b', position: { anchorId: leaf.id, where: 'below' } }, { phaseAssignments: 'move', answered: true });
  }) });
  out.push({ kind: 'hernoemen', label: `${leaf.id} hernoemd`, apply: (x) => storeEdit(x, s => s.updateTask(leaf.id, { name: 'Hernoemd in 1b' })) });
  out.push({ kind: 'duur', label: `${leaf.id} een dag langer`, apply: (x) => lengthen(x, leaf.id) });
  const resource = d.resources[0];
  if (resource) {
    out.push({ kind: 'toewijzing-erbij', label: `${resource.id} op ${leaf.id}`, apply: (x) => storeEdit(x, s => s.assignResource(leaf.id, resource.id, 4)) });
  }
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
    out.push({ kind: 'voortgang', label: `${leaf.id} voortgang 50 % via invoer`, apply: async (x) => {
      const { store, buildWriteIFCInput } = await storeWith(x);
      const edit = { field: 'completion', value: 0.5 } as const;
      const opts = { today: localTodayIso() };
      let result = store.getState().enterTaskProgress(leaf.id, edit, opts);
      if (!result.ok && result.reason === 'needsActualStart') {
        result = store.getState().enterTaskProgress(leaf.id, edit, { ...opts, actualStart: result.question.latest });
      }
      if (!result.ok) throw new Error(`voortgangsinvoer ${leaf.id}: ${result.reason}`);
      return buildWriteIFCInput(store.getState());
    } });
  }
  return out;
}
