import { createHash } from 'node:crypto';
import { cloneDomain, openForeign, settle, type Domain, type Opened } from './ifcMergeKern';
import { storeEdit } from './ifcAppRoute';
import { MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import type { IfcSource, PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { scanStep } from '@/services/ifc/foreign/stepScanner';
import { ifcStr } from '@/services/ifc/ifcPsets';

export interface MainCase {
  readonly label: string;
  readonly input: string;
  readonly verdict: string;
  readonly output?: string;
  readonly mapUnchanged?: boolean;
  readonly mapEdit?: boolean;
}

export const WINDOW_TASK_GUID = '06AdBvh4v8lXgXlHO1$rfO';
const R109 = '3LKE2mEiGfOR4VMIq3h_xv';
const R110 = '34SuBObt1dKPNSent0osWG';
const R111 = '1XVcwxvomwVx$qDRoCxjQu';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const text = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));

export function windowsOf(bytes: Uint8Array, taskGuid: string): string | undefined {
  const index = scanStep(bytes);
  for (let k = 0; k < index.count; k++) {
    if (!index.isEntity(k) || index.type(k) !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const set = index.refAt(k, 5), owner = index.refsAt(k, 4)[0];
    if (set < 0 || owner === undefined || owner < 0 || index.name(set) !== 'OPS_Timephased' || index.globalId(owner) !== taskGuid) continue;
    const prop = index.refsAt(set, 4).find(n => n >= 0 && index.name(n) === 'Windows');
    if (prop !== undefined) return index.propertyText(prop);
  }
  return undefined;
}

function patchWindows(s: string, json: string, next: string): string {
  const from = `IFCTEXT(${ifcStr(json)})`;
  if (s.split(from).length !== 2) throw new Error(`vensterkaart: ${s.split(from).length - 1} keer gevonden`);
  return s.replace(from, () => `IFCTEXT(${ifcStr(next)})`);
}

async function outcome(domain: Domain, source: IfcSource): Promise<{ verdict: string; prepared?: PreparedIfcWrite }> {
  try { return { verdict: 'schreef', prepared: await prepareIfcWrite(domain, source) }; }
  catch (e) {
    if (!(e instanceof MergeNeedsPhase2Error)) throw e;
    return { verdict: e.cases.map(c => `${c.kind}: ${c.detail}`).join(' | ').replace(/asgn-[a-z0-9]+/g, 'asgn-…') };
  }
}

type Step = (d: Domain, o: Opened) => Domain | Promise<Domain>;

export async function windowCases(raw: Uint8Array, reseed: (seed: number) => void, sourceOf: (s: IfcSource) => IfcSource = s => s): Promise<MainCase[]> {
  reseed(301);
  const fixture = await settle(raw);
  const opened = await openForeign(fixture);
  const taskAt = (o: Opened, step: number) => o.tasks.find(t => o.ifcSource!.stepIds[`task:${t.id}`] === step)!.id;
  const resAt = (o: Opened, step: number) => o.resources.find(r => o.ifcSource!.stepIds[`res:${r.id}`] === step)!.id;
  const on = (d: Domain, o: Opened, step: number) => d.assignments.find(a => a.taskId === taskAt(o, 63) && a.resourceId === resAt(o, step))!;
  const third = (d: Domain, o: Opened) => d.tasks.find(t => t.id !== taskAt(o, 63) && t.id !== taskAt(o, 65) && !t.isMilestone && !t.isSummary
    && t.childIds.length === 0 && !d.assignments.some(a => a.taskId === t.id && a.resourceId === resAt(o, 110)))!;
  const costOf = (d: Domain, o: Opened) => d.assignments.find(a => a.taskId === taskAt(o, 63) && a.costAmount === 50)!;
  let grown = await storeEdit(cloneDomain(opened), st => {
    const cost = st.addResource({ name: 'Leges', type: 'COST', description: '', maxUnits: 1 } as never);
    st.assignResource(taskAt(opened, 63), cost, 1, undefined, 50);
  });
  const leges = grown.resources.find(r => r.name === 'Leges')!.id;
  grown = {
    ...grown,
    resources: grown.resources.map(r => r.id === leges ? { ...r, id: 'res-leges' } : r),
    assignments: grown.assignments.map(a => a.resourceId === leges ? { ...a, id: 'asgn-leges', resourceId: 'res-leges' } : a),
  };
  grown = {
    ...grown,
    assignments: [
      ...grown.assignments.map(a => a.taskId === taskAt(opened, 63) && a.costAmount === undefined ? { ...a, plannedWorkMinutes: 480 } : a),
      { ...grown.assignments.find(a => a.taskId === taskAt(opened, 63) && a.resourceId === resAt(opened, 110))!, id: 'asgn-110-op-65',
        taskId: taskAt(opened, 65), plannedWorkMinutes: 240 },
    ],
  };
  const base = await outcome(grown, opened.ifcSource!);
  if (!base.prepared) throw new Error(`vensterkaart: bron niet geschreven (${base.verdict})`);
  const g = text(base.prepared.bytes);
  const w63 = windowsOf(base.prepared.bytes, WINDOW_TASK_GUID)!;
  const costKey = Object.keys(JSON.parse(w63) as Record<string, unknown>).find(k => !k.startsWith(`${R109}#`) && !k.startsWith(`${R110}#`))!;
  const variant = (edit: (json: string) => string) => latin1(patchWindows(g, w63, edit(w63)));
  const places: readonly [string, Uint8Array][] = [
    ['in een venster onder een toewijzing', variant(j => j.replace(`"${R110}#1":{`, `"${R110}#1":{"vendorW":"w-110",`))],
    ['in een venster zonder toewijzing', variant(j => j.replace(/\}$/, `,"${R111}#0":{"plannedWorkMinutes":480,"vendor":"oud"}}`))],
    ['als hoofdlid', variant(j => j.replace(/^\{/, '{"vendorMapNote":"m",'))],
  ];
  const work = (minutes: number): Step => (d, o) => {
    const a = on(d, o, 110);
    return { ...d, assignments: d.assignments.map(x => x === a ? { ...x, plannedWorkMinutes: minutes } : x) };
  };
  const description: Step = d => ({ ...d, project: { ...d.project, description: `${d.project.description} (vensterkaart)` } });
  const changing: readonly [string, Step][] = [
    ['een nieuwe toewijzing van dezelfde resource', (d, o) => ({ ...d, assignments: [...d.assignments, { ...on(d, o, 110), id: 'asgn-tweede-110' }] })],
    ['een nieuwe toewijzing van een andere resource', (d, o) => storeEdit(d, st => { st.assignResource(taskAt(o, 63), resAt(o, 111), 1); })],
    ['kosten', (d, o) => storeEdit(d, st => st.setAssignmentCost(costOf(d, o).id, 75))],
    ['werk', work(960)],
    ['verplaatsen', (d, o) => storeEdit(d, st => { if (!st.moveAssignment(on(d, o, 110).id, third(d, o).id)) throw new Error('verplaatsen'); })],
    ['omwisselen via een derde taak', (d, o) => {
      const a = on(d, o, 110), b = d.assignments.find(x => x.taskId === taskAt(o, 65) && x.resourceId === resAt(o, 110))!, t = third(d, o);
      return storeEdit(d, st => { st.moveAssignment(a.id, t.id); })
        .then(x => storeEdit(x, st => { st.moveAssignment(b.id, taskAt(o, 63)); }))
        .then(x => storeEdit(x, st => { st.moveAssignment(a.id, taskAt(o, 65)); }));
    }],
    ['wissen en opnieuw maken', (d, o) => {
      const a = on(d, o, 110);
      return storeEdit(d, st => { st.unassignResource(a.id); st.assignResource(a.taskId, a.resourceId, a.unitsPerDay); });
    }],
    ['van resource wisselen', (d, o) => {
      const a = on(d, o, 110);
      return { ...d, assignments: d.assignments.map(x => x === a ? { ...x, resourceId: resAt(o, 111) } : x) };
    }],
  ];
  const keeping: readonly [string, Step][] = [
    ['een andere taak', (d, o) => { const t = third(d, o); return { ...d, tasks: d.tasks.map(x => x === t ? { ...x, name: `${x.name} (proef)` } : x) }; }],
    ['de projectbeschrijving', description],
    ['een notitie', (d, o) => ({ ...d, tasks: d.tasks.map(t => t.id === taskAt(o, 63) ? { ...t, notes: [{ id: 'n-proef', text: 'nieuw', done: false }] } : t) })],
  ];
  const out: MainCase[] = [];
  let seed = 400;
  const run = async (label: string, src: Uint8Array, edit: Step, mapEdit?: boolean) => {
    reseed(seed++);
    const o = await openForeign(src);
    const d = await edit(cloneDomain(o), o);
    const r = await outcome(d, sourceOf(o.ifcSource!));
    const written = r.prepared?.bytes;
    out.push({ label, input: sha(src), verdict: r.verdict, ...(mapEdit === undefined ? {} : { mapEdit }), ...(written ? { output: sha(written), mapUnchanged: windowsOf(written, WINDOW_TASK_GUID) === windowsOf(src, WINDOW_TASK_GUID) } : {}) });
    return { ...r, domain: d, opened: o };
  };
  for (const [place, src] of places) {
    for (const [label, edit] of changing) await run(`vensterkaart, onbekende sleutel ${place}: ${label}`, src, edit, true);
    for (const [label, edit] of keeping) await run(`vensterkaart, onbekende sleutel ${place}: ${label}`, src, edit, false);
  }
  const orphanWithRoot = variant(j => j.replace(/^\{/, '{"vendorMapNote":"m",').replace(/\}$/, `,"${R111}#0":{"plannedWorkMinutes":480,"vendor":"oud"}}`));
  await run('ronde 4, blokkade 1: B#0 zonder toewijzing, dan B toewijzen met 480 minuten', orphanWithRoot, (d, o) => storeEdit(d, st => {
    st.assignResource(taskAt(o, 63), resAt(o, 111), 1);
  }).then(x => ({ ...x, assignments: x.assignments.map(a => a.taskId === taskAt(o, 63) && a.resourceId === resAt(o, 111) ? { ...a, plannedWorkMinutes: 480 } : a) })));
  const onlyOrphan = variant(j => j.replace(/\}$/, `,"${R111}#99":{"vendor":"oud"}}`));
  await run('ronde 4, blokkade 2: B#99 als enige onbekende lid, ongewijzigd', onlyOrphan, description);
  await run('ronde 4, blokkade 2: B#99 als enige onbekende lid, het werk van A gewijzigd', onlyOrphan, work(960));
  const costMarked = variant(j => j.replace(`"${costKey}":{`, `"${costKey}":{"vendorC":"c",`));
  const replaced: Step = (d, o) => {
    const a = costOf(d, o);
    return storeEdit(description(d, o) as Domain, st => { st.unassignResource(a.id); st.assignResource(a.taskId, a.resourceId, 1, undefined, 50); });
  };
  const first = await run('ronde 4, vervolg: de kostentoewijzing wissen en gelijk opnieuw maken, en de projectbeschrijving', costMarked, replaced);
  if (first.prepared) {
    reseed(seed++);
    const next = description(first.domain, first.opened) as Domain;
    const again = await outcome(next, sourceOf(first.prepared.source));
    out.push({ label: 'ronde 4, vervolg: daarna een tweede gewijzigde opslag zonder heropenen', input: sha(first.prepared.bytes), verdict: again.verdict,
      ...(again.prepared ? { output: sha(again.prepared.bytes), mapUnchanged: windowsOf(again.prepared.bytes, WINDOW_TASK_GUID) === windowsOf(first.prepared.bytes, WINDOW_TASK_GUID) } : {}) });
  }
  return out;
}
