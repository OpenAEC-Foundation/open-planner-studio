// Datagestuurd testharnas voor de ECHTE store + rekenmotor (headless).
// Voert testgevallen (JSON) uit via de echte acties en vergelijkt actueel vs. verwacht.
//
// Gebruik:  node harness.mjs <cases.json>
// cases.json = { cases: Case[] }  (zie type Case hieronder)
//
// Case = {
//   id, title,
//   calendar?: { workDays?: number[], holidays?: {name,startDate,endDate}[] }  // default: SCHOON (ma-vr, geen feestdagen)
//   anchor?: "YYYY-MM-DD"   // startdatum voor wortel-taken (default 2026-06-01)
//   tasks: [{ name, dur?, start?, milestone?, constraint?, deadline? }]
//     dur in werkdagen (default 1); milestone => duur 0
//     constraint: { type: ASAP|ALAP|SNET|SNLT|FNET|FNLT|MSO|MFO, date? } (P6-soft; MSO/MFO = Start/Finish On)
//     deadline: "YYYY-MM-DD" (zacht: alleen late datums/float)
//   links: [{ pred, succ, type, lag?, lagUnit?, lagPercent? }]
//     type: FINISH_START|START_START|FINISH_FINISH|START_FINISH
//     lag in dagen (default 0, negatief = lead); lagUnit: WORKTIME (default) | ELAPSEDTIME (kalenderdagen);
//     lagPercent: % van de voorgangerduur (overstemt lag)
//   resources?: [{ name, type?, maxUnits?, calendar?: Cal, steps?: {from,maxUnits}[] }]   (fase 2.5)
//     type: LABOR|EQUIPMENT|MATERIAL|SUBCONTRACTOR|CREW (default LABOR); maxUnits default 1
//     calendar: eigen resource-kalender (default: geen, dus projectkalender geldt)
//     steps: availabilitySteps (effective-dated capaciteit)
//   tasks[].assign?: [{ res, units, curve? }]   // res = naam uit resources[]; curve default UNIFORM
//   level?: { constrainToFloat?: boolean; resources?: string[] }   // leveler bestaat nog niet — zie buildAndSolve
//   expect: {
//     tasks?: { [name]: { es?,ef?,ls?,lf?,tf?,ff?,crit? } },   // datums "YYYY-MM-DD"; tf/ff getallen; crit boolean
//     criticalPathSet?: [names],   // vergeleken als verzameling (volgorde-onafhankelijk)
//     drivingSet?: [[pred,succ,type]],  // welke relaties driving zijn (verzameling van triples)
//     violatedConstraintsSet?: [names], missedDeadlinesSet?: [names],  // taak-namen (verzameling)
//     projectEnd?, projectDuration?,
//     load?: { [resName]: { [isoDate]: number } },              // spot-checks op resourceLoadResult.load
//     overallocatedDays?: { [resName]: string[] },              // vergeleken als verzameling
//     error?: boolean | string     // true => verwacht een fout; string => substring in de foutmelding
//   }
// }
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/types/task';
import type { ResourceType, ResourceCurve } from '@/types/resource';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { readFileSync } from 'node:fs';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

type Cal = { workDays?: number[]; holidays?: { name: string; startDate: string; endDate: string }[] };
interface CaseResource {
  name: string; type?: ResourceType; maxUnits?: number;
  calendar?: Cal; steps?: { from: string; maxUnits: number }[];
  /** Naam van een eerder gedefinieerde CREW-resource (ploeg-lidmaatschap, puur weergave — §2.1). */
  parent?: string;
}
interface Case {
  id: string; title: string;
  calendar?: Cal; anchor?: string;
  resources?: CaseResource[];
  tasks: {
    name: string; dur?: number; start?: string; milestone?: boolean; milestoneKind?: 'START' | 'FINISH';
    mandatory?: boolean; parent?: string; constraint?: { type: string; date?: string }; deadline?: string;
    priority?: number;
    assign?: { res: string; units: number; curve?: ResourceCurve }[];
  }[];
  links?: { pred: string; succ: string; type: string; lag?: number; lagUnit?: string; lagPercent?: number }[];
  level?: { constrainToFloat?: boolean; resources?: string[] };
  /** Zuiverheids-guard: draai de leveler-PREVIEW (levelResources) ZONDER applyLeveling en
   *  her-draai daarna CPM. `levelResources` hoort puur te zijn (geen state-mutatie), dus de
   *  assertions moeten identiek zijn aan een kale runCPM. Wederzijds exclusief met `level`. */
  levelPreview?: { constrainToFloat?: boolean; resources?: string[] };
  /** Ops ná de eerste runCPM (deze golf), in volgorde uitgevoerd — voor A5/A6-scenario's die een
   *  mutatie ZONDER F5, een assign-verse-load, een undo of een nivellering testen. De gewone
   *  `expect`-assertions lopen tegen de EINDstaat. */
  afterCPM?: AfterOp[];
  /** Nivelleer-PREVIEW-assertions (deze golf, A1/A3/A4): draait `levelResources` (puur, geen apply)
   *  en checkt de teruggegeven `LevelingResult`. */
  previewExpect?: {
    constrainToFloat?: boolean; resources?: string[];
    projectEndAfter?: string;
    shiftedTasks?: string[];      // namen aanwezig in result.shifts (verzameling)
    unresolvedTasks?: string[];   // namen aanwezig in result.unresolved (verzameling)
    reasons?: Record<string, string>; // taaknaam → verwachte reden
  };
  expect: any;
}

type AfterOp =
  | { setDuration: { task: string; dur: number } }
  | { assign: { task: string; res: string; units: number; curve?: ResourceCurve } }
  | { runCPM: true }
  | { undo: true }
  | { applyLevel: { constrainToFloat?: boolean; resources?: string[] } };

function resolveResourceIds(names: string[] | undefined, resIds: Record<string, string>, ctx: string): string[] | undefined {
  return names
    ? names.map(n => {
        if (!resIds[n]) throw new Error(`${ctx}: onbekende resource "${n}"`);
        return resIds[n];
      })
    : undefined;
}

function buildAndSolve(c: Case): {
  ids: Record<string, string>;
  resIds: Record<string, string>;
  previewResult: LevelingResult | null;
} {
  S().newProject();
  // Kalender: schoon tenzij expliciet opgegeven.
  const base = S().calendar;
  S().setCalendar({
    ...base,
    workDays: c.calendar?.workDays ?? CLEAN_WORKDAYS,
    holidays: c.calendar?.holidays ?? [],
  } as any);
  const anchor = c.anchor ?? '2026-06-01';
  S().setProject({ startDate: anchor });

  // Resources (fase 2.5) — vóór de taken irrelevant qua volgorde, maar vóór assign[] nodig.
  const resIds: Record<string, string> = {};
  for (const r of c.resources ?? []) {
    if (resIds[r.name]) throw new Error(`dubbele resourcenaam "${r.name}"`);
    if (r.parent && !resIds[r.parent]) {
      throw new Error(`resource "${r.name}": parent "${r.parent}" nog niet gedefinieerd — zet die eerder in de resources-lijst`);
    }
    let calendarId: string | undefined;
    if (r.calendar) {
      const { id: _calBaseId, ...calBase } = S().calendar;
      void _calBaseId;
      calendarId = S().addResourceCalendar({
        ...calBase,
        name: `${r.name} kalender`,
        workDays: r.calendar.workDays ?? CLEAN_WORKDAYS,
        holidays: r.calendar.holidays ?? [],
      });
    }
    const resId = S().addResource({
      name: r.name,
      type: r.type ?? 'LABOR',
      description: '',
      maxUnits: r.maxUnits ?? 1,
      ...(calendarId ? { calendarId } : {}),
      ...(r.steps ? { availabilitySteps: r.steps } : {}),
      ...(r.parent ? { parentId: resIds[r.parent] } : {}),
    });
    resIds[r.name] = resId;
  }

  const ids: Record<string, string> = {};
  for (const t of c.tasks) {
    // Luide fouten i.p.v. stille maskering: dubbele namen (de naam is de enige sleutel in
    // ids/expect/criticalPathSet), en een ouder die nog niet bestaat (anders wordt het kind
    // stil een root, met een heel andere topologie maar zonder waarschuwing).
    if (ids[t.name]) throw new Error(`dubbele taaknaam "${t.name}"`);
    if (t.parent && !ids[t.parent]) {
      throw new Error(`taak "${t.name}": ouder "${t.parent}" nog niet gedefinieerd — zet de ouder eerder in de tasks-lijst`);
    }
    const start = t.start ?? anchor;
    const dur = t.milestone ? 0 : (t.dur ?? 1);
    const id = S().addTask({
      name: t.name,
      isMilestone: !!t.milestone,
      parentId: t.parent ? ids[t.parent] : null,
      time: createDefaultTaskTime(start, dur),
      ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}),
      ...(t.priority !== undefined ? { priority: t.priority } : {}),
      ...(t.mandatory !== undefined ? { mandatory: t.mandatory } : {}),
      ...(t.constraint ? { constraint: t.constraint as any } : {}),
      ...(t.deadline ? { deadline: t.deadline } : {}),
    });
    ids[t.name] = id;
  }
  for (const l of c.links ?? []) {
    if (!ids[l.pred]) throw new Error(`relatie: onbekende voorganger "${l.pred}"`);
    if (!ids[l.succ]) throw new Error(`relatie: onbekende opvolger "${l.succ}"`);
    S().addSequence({
      predecessorId: ids[l.pred], successorId: ids[l.succ], type: l.type as any,
      lagDays: l.lag ?? 0,
      ...(l.lagUnit !== undefined ? { lagUnit: l.lagUnit as any } : {}),
      ...(l.lagPercent !== undefined ? { lagPercent: l.lagPercent } : {}),
    });
  }
  // Toewijzingen — ná addTask (assignResource is leaf/mijlpaal-bewust, §2.4) en vóór runCPM
  // (de belasting wordt binnen runCPM herberekend, zie scheduleSlice.runCPM).
  for (const t of c.tasks) {
    for (const a of t.assign ?? []) {
      if (!resIds[a.res]) throw new Error(`taak "${t.name}": onbekende resource "${a.res}"`);
      S().assignResource(ids[t.name], resIds[a.res], a.units, a.curve);
    }
  }
  S().runCPM();

  // Nivellering (fase 2.5): draai de leveler ná runCPM en pas het resultaat toe via
  // applyLeveling (dat één undo-snapshot pusht en zelf runCPM heraanroept, §5.6) — zodat
  // alle expect-checks (es/ef/float/projectEnd/load/overallocatedDays) tegen het
  // GENIVELLEERDE schema lopen.
  if (c.level) {
    const resourceIds = c.level.resources
      ? c.level.resources.map(n => {
          if (!resIds[n]) throw new Error(`level.resources: onbekende resource "${n}"`);
          return resIds[n];
        })
      : undefined;
    const result = S().levelResources({
      constrainToFloat: !!c.level.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
    S().applyLeveling(result);
  }

  // Preview-zuiverheids-guard (fase 2.5, §5.6): `levelResources` moet puur zijn. We draaien de
  // preview (GEEN applyLeveling) en her-draaien CPM; de assertions horen exact gelijk te blijven
  // aan een kale runCPM. Zou de leveler stiekem `levelingDelay` op de echte task-objecten zetten
  // (referentie-delen met de store), dan zou deze her-runCPM de datums opschuiven — precies het
  // scenario dat we willen bewaken.
  if (c.levelPreview) {
    const resourceIds = resolveResourceIds(c.levelPreview.resources, resIds, 'levelPreview.resources');
    S().levelResources({
      constrainToFloat: !!c.levelPreview.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
    S().runCPM();
  }

  // Ops ná de eerste runCPM (A5/A6): mutaties zonder F5, assign-verse-load, undo, nivellering.
  for (const op of c.afterCPM ?? []) {
    if ('setDuration' in op) {
      const tid = ids[op.setDuration.task];
      if (!tid) throw new Error(`afterCPM.setDuration: onbekende taak "${op.setDuration.task}"`);
      const task = S().tasks.find(t => t.id === tid)!;
      S().updateTask(tid, { time: { ...task.time, scheduleDuration: op.setDuration.dur } });
    } else if ('assign' in op) {
      const tid = ids[op.assign.task];
      if (!tid) throw new Error(`afterCPM.assign: onbekende taak "${op.assign.task}"`);
      if (!resIds[op.assign.res]) throw new Error(`afterCPM.assign: onbekende resource "${op.assign.res}"`);
      S().assignResource(tid, resIds[op.assign.res], op.assign.units, op.assign.curve);
    } else if ('runCPM' in op) {
      S().runCPM();
    } else if ('undo' in op) {
      S().undo();
    } else if ('applyLevel' in op) {
      const resourceIds = resolveResourceIds(op.applyLevel.resources, resIds, 'afterCPM.applyLevel.resources');
      const r = S().levelResources({
        constrainToFloat: !!op.applyLevel.constrainToFloat,
        ...(resourceIds ? { resourceIds } : {}),
      });
      S().applyLeveling(r);
    }
  }

  // Nivelleer-PREVIEW-assertions (A1/A3/A4): puur, geen apply.
  let previewResult: LevelingResult | null = null;
  if (c.previewExpect) {
    const resourceIds = resolveResourceIds(c.previewExpect.resources, resIds, 'previewExpect.resources');
    previewResult = S().levelResources({
      constrainToFloat: !!c.previewExpect.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
  }

  return { ids, resIds, previewResult };
}

function readTask(name: string, ids: Record<string, string>) {
  const t = S().tasks.find(x => x.id === ids[name]);
  if (!t) return null;
  return {
    es: t.time.earlyStart, ef: t.time.earlyFinish,
    ls: t.time.lateStart, lf: t.time.lateFinish,
    tf: t.time.totalFloat, ff: t.time.freeFloat, crit: t.time.isCritical,
  };
}

const KEYMAP: Record<string, string> = { es: 'es', ef: 'ef', ls: 'ls', lf: 'lf', tf: 'tf', ff: 'ff', crit: 'crit' };

/** taskId → naam (omgekeerde van de ids-map), voor de preview-assertions. */
function nameOf(tid: string, ids: Record<string, string>): string {
  for (const [n, i] of Object.entries(ids)) if (i === tid) return n;
  return tid;
}

function runCase(c: Case) {
  const diffs: string[] = [];
  let ids: Record<string, string> = {};
  let resIds: Record<string, string> = {};
  let previewResult: LevelingResult | null = null;
  try {
    ({ ids, resIds, previewResult } = buildAndSolve(c));
  } catch (e) {
    return { id: c.id, title: c.title, pass: false, diffs: [`THREW: ${String(e)}`] };
  }
  const cpm = S().cpmResult;
  const exp = c.expect ?? {};

  // Fout-verwachting
  if (exp.error !== undefined) {
    const gotErr = cpm?.error ?? '';
    if (exp.error === true && !gotErr) diffs.push(`error: verwacht een fout, kreeg geen`);
    if (exp.error === false && gotErr) diffs.push(`error: verwacht geen fout, kreeg "${gotErr}"`);
    if (typeof exp.error === 'string' && !gotErr.includes(exp.error)) diffs.push(`error: verwacht substring "${exp.error}", kreeg "${gotErr}"`);
  }

  // Per-taak velden
  if (exp.tasks) {
    for (const [name, want] of Object.entries<any>(exp.tasks)) {
      const got = readTask(name, ids);
      if (!got) { diffs.push(`taak "${name}" niet gevonden`); continue; }
      for (const [k, wv] of Object.entries<any>(want)) {
        const gk = KEYMAP[k] ?? k;
        const gv = (got as any)[gk];
        if (gv !== wv) diffs.push(`${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(gv)}`);
      }
    }
  }

  // Relatie-verzamelingen ([voorganger, opvolger, type]-triples): driving en afgekapte leads
  const seqSetCheck = (label: string, wantTriples: string[][] | undefined, gotIds: string[]) => {
    if (!wantTriples) return;
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const seqById = new Map(S().sequences.map(q => [q.id, q]));
    const got = gotIds
      .map((sid: string) => {
        const q = seqById.get(sid);
        return q ? `${idToName[q.predecessorId] ?? q.predecessorId}|${idToName[q.successorId] ?? q.successorId}|${q.type}` : '?';
      })
      .sort();
    const want = [...wantTriples].map((t: string[]) => t.join('|')).sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      diffs.push(`${label}: verwacht {${want.join(', ')}}, kreeg {${got.join(', ')}}`);
  };
  seqSetCheck('drivingSet', exp.drivingSet, (cpm as any)?.drivingSequenceIds ?? []);
  seqSetCheck('truncatedLeadSet', exp.truncatedLeadSet, (cpm as any)?.truncatedLeadSequenceIds ?? []);

  // Taak-naam-verzamelingen: geschonden constraints en gemiste deadlines
  const taskSetCheck = (label: string, wantNames: string[] | undefined, gotIds: string[]) => {
    if (!wantNames) return;
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const got = gotIds.map(tid => idToName[tid] ?? tid).sort();
    const want = [...wantNames].sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      diffs.push(`${label}: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
  };
  taskSetCheck('violatedConstraintsSet', exp.violatedConstraintsSet, (cpm as any)?.violatedConstraintTaskIds ?? []);
  taskSetCheck('missedDeadlinesSet', exp.missedDeadlinesSet, (cpm as any)?.missedDeadlineTaskIds ?? []);

  // Kritiek pad als verzameling (namen)
  if (exp.criticalPathSet) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const gotNames = (cpm?.criticalPath ?? []).map(i => idToName[i] ?? i).sort();
    const wantNames = [...exp.criticalPathSet].sort();
    if (JSON.stringify(gotNames) !== JSON.stringify(wantNames))
      diffs.push(`criticalPath: verwacht {${wantNames.join(',')}}, kreeg {${gotNames.join(',')}}`);
  }

  if (exp.projectEnd !== undefined && cpm?.projectEnd !== exp.projectEnd)
    diffs.push(`projectEnd: verwacht ${exp.projectEnd}, kreeg ${cpm?.projectEnd}`);
  if (exp.projectDuration !== undefined && cpm?.projectDuration !== exp.projectDuration)
    diffs.push(`projectDuration: verwacht ${exp.projectDuration}, kreeg ${cpm?.projectDuration}`);

  // "Verouderd"-vlag (A6): staat de planning-stale-vlag op de verwachte waarde na de afterCPM-ops?
  if (exp.scheduleStale !== undefined && S().scheduleStale !== exp.scheduleStale)
    diffs.push(`scheduleStale: verwacht ${exp.scheduleStale}, kreeg ${S().scheduleStale}`);

  // Nivelleer-PREVIEW-assertions (A1/A3/A4) tegen het teruggegeven LevelingResult.
  if (c.previewExpect) {
    const pr = previewResult;
    if (!pr) {
      diffs.push('previewExpect: geen LevelingResult (levelResources gaf niets terug)');
    } else {
      const pe = c.previewExpect;
      if (pe.projectEndAfter !== undefined && pr.projectEndAfter !== pe.projectEndAfter)
        diffs.push(`preview.projectEndAfter: verwacht ${pe.projectEndAfter}, kreeg ${pr.projectEndAfter}`);
      if (pe.shiftedTasks) {
        const got = Object.keys(pr.shifts).map(tid => nameOf(tid, ids)).sort();
        const want = [...pe.shiftedTasks].sort();
        if (JSON.stringify(got) !== JSON.stringify(want))
          diffs.push(`preview.shiftedTasks: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
      }
      if (pe.unresolvedTasks) {
        const got = Object.keys(pr.unresolved).map(tid => nameOf(tid, ids)).sort();
        const want = [...pe.unresolvedTasks].sort();
        if (JSON.stringify(got) !== JSON.stringify(want))
          diffs.push(`preview.unresolvedTasks: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
      }
      if (pe.reasons) {
        for (const [name, want] of Object.entries(pe.reasons)) {
          const tid = ids[name];
          const got = tid ? pr.unresolvedReasons[tid] : undefined;
          if (got !== want) diffs.push(`preview.reasons.${name}: verwacht ${want}, kreeg ${got}`);
        }
      }
    }
  }

  // Resource-belasting spot-checks (fase 2.5): S().resourceLoadResult?.load[resId]?.[iso].
  if (exp.load) {
    const rlr = S().resourceLoadResult;
    for (const [resName, days] of Object.entries<Record<string, number>>(exp.load)) {
      const resId = resIds[resName];
      if (!resId) { diffs.push(`load: onbekende resource "${resName}"`); continue; }
      for (const [iso, want] of Object.entries(days)) {
        // Ontbrekende dag => 0 (het engine schrijft nooit een expliciete 0-entry, alleen
        // dagen met daadwerkelijke belasting) — zo kan een case "geen belasting op dag X"
        // testen (bv. CREW-geen-rollup) zonder een aparte "afwezig"-sentinel nodig te hebben.
        const got = rlr?.load[resId]?.[iso] ?? 0;
        if (got !== want) diffs.push(`load.${resName}.${iso}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
      }
    }
  }

  // Overallocatie-dagen per resource, vergeleken als verzameling (volgorde-onafhankelijk).
  if (exp.overallocatedDays) {
    const rlr = S().resourceLoadResult;
    for (const [resName, wantDays] of Object.entries<string[]>(exp.overallocatedDays)) {
      const resId = resIds[resName];
      if (!resId) { diffs.push(`overallocatedDays: onbekende resource "${resName}"`); continue; }
      const got = [...(rlr?.overallocatedDays[resId] ?? [])].sort();
      const want = [...wantDays].sort();
      if (JSON.stringify(got) !== JSON.stringify(want))
        diffs.push(`overallocatedDays.${resName}: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
    }
  }

  return { id: c.id, title: c.title, pass: diffs.length === 0, diffs };
}

const files = process.argv.slice(2);
let grandPass = 0;
let grandTotal = 0;
let anyFail = false;
for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const cases: Case[] = data.cases ?? [];
  const name = file.replace(/^.*\/cases-/, '').replace(/\.json$/, '');
  // Een leeg/sleutelloos casusbestand mag niet stil als "0/0 groen" passeren.
  if (cases.length === 0) {
    console.log(`XX ${name}: GEEN cases (leeg of ontbrekende "cases"-sleutel)`);
    anyFail = true;
    continue;
  }
  const results = cases.map(runCase);
  const passed = results.filter((r) => r.pass).length;
  grandPass += passed;
  grandTotal += results.length;
  const ok = passed === results.length;
  if (!ok) anyFail = true;
  console.log(`${ok ? 'OK ' : 'XX '} ${name}: ${passed}/${results.length}`);
  for (const r of results) {
    if (r.pass) continue;
    console.log(`   x [${r.id}] ${r.title}`);
    for (const d of r.diffs) console.log(`       - ${d}`);
  }
}
console.log(`\nTOTAAL: ${grandPass}/${grandTotal}${anyFail ? '  (FALEN)' : '  (alles groen)'}`);
process.exit(anyFail ? 1 : 0);
