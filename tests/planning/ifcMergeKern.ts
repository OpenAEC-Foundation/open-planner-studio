// #804 fase 1b: gedeelde kern voor `check-ifc-foreign-preserve.ts` en `check-ifc-foreign-merge-telling.ts`.
//
// - `openForeign`: een bestand openen zoals de app met de flag (de bytes-route, zonder Worker).
// - `mergeProblems`: de invarianten van de merge-writer op uitvoer tegen bron (ontwerp §4.10, de eerste drie alinea's):
//   kop en staart byte-gelijk; elk niet-P-stuk met hetzelfde `#id`, dezelfde bytes en in dezelfde volgorde; geen ander
//   niet-P-stuk erbij (wat er nieuw is, deelt de uitvoer zelf in als P); hetzelfde regeleinde; de scanner neemt de
//   uitvoer aan (dus geen dubbel `#id`).
// - `canon`: het domein zoals de writer het ziet, als tekst met een vaste klok (de maat die ook de open-check gebruikt).
// - `editsFor`: de gewone bewerkingen van een planner op het domein, per taak of per paar (bijsturing 1, punt 2).
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import { MergeNeedsPhase2Error, writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
import { scanStep, StepScanError, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import { classify } from '@/services/ifc/foreign/classify';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { writeIFC } from '@/services/ifc/ifcWriter';
import type { Task } from '@/types/task';

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

/** Openen zoals Bestand → Openen met de flag: de bytes-route, synchroon (geen Worker). */
export async function openForeign(bytes: Uint8Array): Promise<Opened> {
  const r = await readIfcBytesDetailed(bytes, {}, { createWorker: () => null });
  return r.result as Opened;
}

/** Een kopie van het domein zonder de bron (die blijft gedeeld en wordt niet bewerkt). */
export function cloneDomain(d: Opened): Domain {
  const { ifcSource: _source, ...rest } = d;
  return structuredClone(rest) as Domain;
}

/** De uitkomst van één merge: de bytes, of de weigering met haar gevallen. Een andere fout gooit door. */
export type MergeOutcome = { ok: true; bytes: Uint8Array } | { ok: false; kinds: string[]; error: MergeNeedsPhase2Error };
export function tryMerge(d: Domain, source: IfcSource): MergeOutcome {
  try {
    return { ok: true, bytes: concat(writeIfcMerge(d, source)) };
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

/** Het domein zoals de writer het ziet: `writeIFC` zonder vreemd deel, met een vaste klok en reeks. */
export function canon(d: Domain, reseed: (seed: number) => void): string {
  reseed(0x1b04);
  return writeIFC(d);
}

/** Het eerste verschil tussen twee teksten, met wat omringende tekst. */
export function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `@${i}: «${a.slice(Math.max(0, i - 80), i + 80)}» ≠ «${b.slice(Math.max(0, i - 80), i + 80)}»`;
}

// ── De gewone bewerkingen (bijsturing 1, punt 2) ──

export type EditKind = 'niets' | 'andere-ouder' | 'niveau-hoger' | 'volgorde-kinderen' | 'relatie-erbij' | 'taak-wissen'
  | 'taak-erbij' | 'hernoemen' | 'duur' | 'toewijzing-erbij';
export interface Edit { readonly kind: EditKind; readonly label: string; apply(d: Domain): void }

const byId = (d: Domain) => new Map(d.tasks.map(t => [t.id, t]));
const isDescendant = (tasks: ReadonlyMap<string, Task>, id: string, ancestor: string): boolean => {
  for (let cur = tasks.get(id); cur?.parentId; cur = tasks.get(cur.parentId)) if (cur.parentId === ancestor) return true;
  return false;
};
/** Haal een taak uit de kinderen van haar ouder (of uit de wortels: die volgen de volgorde van `tasks`). */
function detach(d: Domain, t: Task): void {
  if (!t.parentId) return;
  const parent = byId(d).get(t.parentId);
  if (parent) parent.childIds = parent.childIds.filter(c => c !== t.id);
}

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
    out.push({ kind: 'andere-ouder', label: `${t.id} → onder ${target.id}`, apply: (x) => {
      const m = byId(x); const task = m.get(t.id)!; const parent = m.get(target.id)!;
      detach(x, task); task.parentId = parent.id; parent.childIds.push(task.id);
    } });
  }
  for (const t of pick(tasks.filter(t => t.parentId))) {
    out.push({ kind: 'niveau-hoger', label: `${t.id} een niveau hoger`, apply: (x) => {
      const m = byId(x); const task = m.get(t.id)!; const parent = m.get(task.parentId!)!;
      detach(x, task);
      task.parentId = parent.parentId;
      if (parent.parentId) {
        const grand = m.get(parent.parentId)!;
        grand.childIds.splice(grand.childIds.indexOf(parent.id) + 1, 0, task.id);
      } else {
        // Een wortel: de volgorde van `tasks` bepaalt de volgorde van de wortels; zet de taak achter haar oude ouder.
        x.tasks.splice(x.tasks.indexOf(task), 1);
        x.tasks.splice(x.tasks.indexOf(parent) + 1, 0, task);
      }
    } });
  }
  for (const s of pick(summaries.filter(s => s.childIds.length >= 2))) {
    out.push({ kind: 'volgorde-kinderen', label: `kinderen van ${s.id} omgekeerd`, apply: (x) => { byId(x).get(s.id)!.childIds.reverse(); } });
  }
  if (tasks.filter(t => !t.parentId).length >= 2) {
    out.push({ kind: 'volgorde-kinderen', label: 'wortels omgekeerd', apply: (x) => {
      const roots = x.tasks.filter(t => !t.parentId).reverse();
      let k = 0;
      x.tasks = x.tasks.map(t => (t.parentId ? t : roots[k++]));
    } });
  }
  const related = new Set(d.sequences.map(s => `${s.predecessorId}>${s.successorId}`));
  for (let k = 0; k + 1 < tasks.length; k++) {
    const a = tasks[k], b = tasks[k + 1];
    if (related.has(`${a.id}>${b.id}`) || related.has(`${b.id}>${a.id}`) || !pick(tasks).includes(a)) continue;
    out.push({ kind: 'relatie-erbij', label: `FS ${a.id} → ${b.id}`, apply: (x) => {
      x.sequences.push({ id: `seq-1b-${k}`, predecessorId: a.id, successorId: b.id, type: 'FINISH_START', lagDays: 0 });
    } });
  }
  for (const t of pick(tasks)) {
    out.push({ kind: 'taak-wissen', label: `${t.id} wissen`, apply: (x) => {
      const m = byId(x);
      const gone = new Set([t.id, ...x.tasks.filter(o => isDescendant(m, o.id, t.id)).map(o => o.id)]);
      detach(x, m.get(t.id)!);
      x.tasks = x.tasks.filter(o => !gone.has(o.id));
      x.sequences = x.sequences.filter(s => !gone.has(s.predecessorId) && !gone.has(s.successorId));
      x.assignments = x.assignments.filter(a => !gone.has(a.taskId));
    } });
  }
  return out;
}

/** De bewerkingen van 1b (brief): taak erbij, hernoemen, duur wijzigen, toewijzing erbij. Eén van elk, op een vaste taak. */
export function basicEdits(d: Domain): Edit[] {
  const leaf = d.tasks.find(t => t.childIds.length === 0 && !t.isMilestone) ?? d.tasks[0];
  const out: Edit[] = [];
  if (!leaf) return out;
  out.push({ kind: 'taak-erbij', label: `nieuwe taak naast ${leaf.id}`, apply: (x) => {
    const m = byId(x); const base = m.get(leaf.id)!;
    const task: Task = { ...structuredClone(base), id: 'taak-1b-nieuw', name: 'Nieuwe taak 1b', wbsCode: `${base.wbsCode}.9`, resourceIds: [] };
    x.tasks.splice(x.tasks.indexOf(base) + 1, 0, task);
    if (base.parentId) { const p = m.get(base.parentId)!; p.childIds.splice(p.childIds.indexOf(base.id) + 1, 0, task.id); }
  } });
  out.push({ kind: 'hernoemen', label: `${leaf.id} hernoemd`, apply: (x) => { byId(x).get(leaf.id)!.name = 'Hernoemd in 1b'; } });
  out.push({ kind: 'duur', label: `${leaf.id} een dag langer`, apply: (x) => {
    const time = byId(x).get(leaf.id)!.time;
    time.scheduleDuration += 1;
    if (time.durationMinutes !== undefined) time.durationMinutes += 480;
  } });
  const resource = d.resources[0];
  if (resource) {
    out.push({ kind: 'toewijzing-erbij', label: `${resource.id} op ${leaf.id}`, apply: (x) => {
      x.assignments.push({ id: 'toewijzing-1b', taskId: leaf.id, resourceId: resource.id, unitsPerDay: 4 });
      const task = byId(x).get(leaf.id)!;
      if (!task.resourceIds.includes(resource.id)) task.resourceIds.push(resource.id);
    } });
  }
  return out;
}
