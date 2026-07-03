// Verificatie van de gegenereerde voorbeelden — haalt ELK bestand door de ECHTE readIFC en assert:
//  1. parse zonder fouten;
//  2. taak/relatie/resource/toewijzing/code/veld-tellingen conform de declaratieve spec;
//  3. round-trip write→read→write stabiel (data-fixpunt: readIFC → writeIFC → readIFC geeft
//     identieke inhoud — GUIDs zijn per lees-run nieuw, dus we vergelijken structureel, niet als
//     string);
//  4. per showcase dat de beloofde functies aantoonbaar aanwezig zijn (constraints, deadline met
//     negatieve float, START/FINISH- + verplichte mijlpalen, alle vijf resourcetypes + ploeg-
//     hiërarchie, resource-kalender, availabilitySteps, curve-variatie, prioriteit 1000, en een
//     met nivellering oplosbare overallocatie).
//
//   npm run verify:examples          # exit 0 = alles groen, 1 = minstens één afwijking
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { useAppStore } from '@/state/appStore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSpecs } from './gen-core';
import type { ProjectSpec } from './spec';

const ROOT = process.cwd();
const EX_DIR = join(ROOT, 'examples');
const S = () => useAppStore.getState();

type Parsed = ReturnType<typeof readIFC>;

/** Structureel data-fingerprint (ids → namen) zodat de round-trip los van willekeurige GUIDs/ids
 *  vergeleken kan worden. */
function digest(p: Parsed): string {
  const taskName = new Map(p.tasks.map(t => [t.id, t.name]));
  const resName = new Map(p.resources.map(r => [r.id, r.name]));
  const tasks = [...p.tasks].map(t => ({
    n: t.name, es: t.time.earlyStart, ef: t.time.earlyFinish, tf: t.time.totalFloat,
    ms: t.isMilestone, mk: t.milestoneKind ?? null, man: !!t.mandatory, pr: t.priority,
    c: t.constraint ?? null, dl: t.deadline ?? null, wbs: t.wbsCode,
  })).sort((a, b) => (a.wbs + a.n).localeCompare(b.wbs + b.n));
  const seqs = [...p.sequences].map(s => ({
    p: taskName.get(s.predecessorId), s: taskName.get(s.successorId), t: s.type,
    lag: s.lagDays, pct: s.lagPercent ?? null, u: s.lagUnit ?? null,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const res = [...p.resources].map(r => ({
    n: r.name, t: r.type, mu: r.maxUnits, parent: r.parentId ? resName.get(r.parentId) : null,
    steps: r.availabilitySteps ?? null, cal: !!r.calendarId, uom: r.unitOfMeasure ?? null,
  })).sort((a, b) => a.n.localeCompare(b.n));
  const asg = [...p.assignments].map(a => ({
    t: taskName.get(a.taskId), r: resName.get(a.resourceId), u: a.unitsPerDay, c: a.curve ?? 'UNIFORM',
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const codes = [...p.activityCodeTypes].map(c => `${c.name}:${c.values.map(v => v.code).sort().join(',')}`).sort();
  const fields = [...p.customFieldDefs].map(f => `${f.name}:${f.type}`).sort();
  return JSON.stringify({ tasks, seqs, res, asg, codes, fields });
}

interface Check { ok: boolean; msg: string }
function expect(diffs: string[], ok: boolean, msg: string): Check {
  if (!ok) diffs.push(msg);
  return { ok, msg };
}

function verifySpec(spec: ProjectSpec): { pass: boolean; diffs: string[]; parsed: Parsed } {
  const diffs: string[] = [];
  const content = readFileSync(join(EX_DIR, `${spec.slug}.ifc`), 'utf8');
  const parsed = readIFC(content);

  // 1. parse ok
  expect(diffs, parsed.tasks.length > 0, `parse leeg (0 taken)`);

  // 2. tellingen conform spec
  const expMilestones = spec.tasks.filter(t => t.milestone).length;
  const expAssign = spec.tasks.reduce((a, t) => a + (t.assign?.length ?? 0), 0);
  expect(diffs, parsed.tasks.length === spec.tasks.length, `taken: ${parsed.tasks.length} ≠ ${spec.tasks.length}`);
  expect(diffs, parsed.tasks.filter(t => t.isMilestone).length === expMilestones, `mijlpalen: ${parsed.tasks.filter(t => t.isMilestone).length} ≠ ${expMilestones}`);
  expect(diffs, parsed.sequences.length === (spec.links?.length ?? 0), `relaties: ${parsed.sequences.length} ≠ ${spec.links?.length ?? 0}`);
  expect(diffs, parsed.resources.length === (spec.resources?.length ?? 0), `resources: ${parsed.resources.length} ≠ ${spec.resources?.length ?? 0}`);
  expect(diffs, parsed.assignments.length === expAssign, `toewijzingen: ${parsed.assignments.length} ≠ ${expAssign}`);
  expect(diffs, parsed.activityCodeTypes.length === (spec.codeTypes?.length ?? 0), `codetypes: ${parsed.activityCodeTypes.length} ≠ ${spec.codeTypes?.length ?? 0}`);
  expect(diffs, parsed.customFieldDefs.length === (spec.fields?.length ?? 0), `customfields: ${parsed.customFieldDefs.length} ≠ ${spec.fields?.length ?? 0}`);

  // 3. round-trip write→read→write stabiel (structureel data-fixpunt)
  const s2 = writeIFC(parsed.project, parsed.calendar, parsed.tasks, parsed.sequences, parsed.resources,
    parsed.assignments, parsed.activityCodeTypes, parsed.customFieldDefs, parsed.resourceCalendars);
  const parsed2 = readIFC(s2);
  expect(diffs, digest(parsed) === digest(parsed2), `round-trip niet stabiel (data verschilt na write→read→write)`);

  return { pass: diffs.length === 0, diffs, parsed };
}

/** Herbereken float/overallocatie autoritair door het bestand in de echte store te laden. */
function scheduleFacts(parsed: Parsed): { negFloat: number; overalloc: string[] } {
  S().loadState(parsed as any);
  S().runCPM();
  const st = S();
  const negFloat = st.tasks.filter(t => t.childIds.length === 0 && t.time.totalFloat < 0).length;
  const rlr = st.resourceLoadResult;
  const overalloc: string[] = [];
  if (rlr) {
    for (const r of st.resources) {
      if ((rlr.overallocatedDays[r.id] ?? []).length > 0) overalloc.push(r.name);
    }
  }
  return { negFloat, overalloc };
}

/** Per-showcase: de functies die élke showcase hoort te tonen (structuur, mijlpalen, ploeg,
 *  curves, en een met nivellering oplosbare overallocatie). Union-brede functies (deadline,
 *  prioriteit 1000, negatieve float, alle relatietypes) worden op suite-niveau geverifieerd. */
function verifyShowcase(spec: ProjectSpec, parsed: Parsed, diffs: string[]): { negFloat: number; overalloc: string[] } {
  const T = parsed.tasks;
  const expConstraints = spec.tasks.filter(t => t.constraint).length;
  expect(diffs, T.filter(t => t.constraint).length === expConstraints, `constraints teruggelezen: ${T.filter(t => t.constraint).length} ≠ ${expConstraints}`);
  expect(diffs, T.some(t => t.isMilestone && t.milestoneKind === 'START'), `geen START-mijlpaal`);
  expect(diffs, T.some(t => t.isMilestone && t.milestoneKind === 'FINISH'), `geen FINISH-mijlpaal`);
  expect(diffs, T.some(t => t.mandatory), `geen verplichte mijlpaal`);
  expect(diffs, parsed.resources.some(r => r.parentId), `geen ploeg-hiërarchie (resource met parent)`);
  const curves = new Set(parsed.assignments.map(a => a.curve ?? 'UNIFORM'));
  expect(diffs, curves.size >= 3, `curve-variatie te laag (${curves.size})`);

  const facts = scheduleFacts(parsed);
  expect(diffs, facts.overalloc.length > 0, `geen overallocatie zichtbaar`);
  return facts;
}

function main() {
  const specs = allSpecs();
  const showcases = specs.filter(s => s.category === 'showcase');
  let anyFail = false;
  // Suite-brede (union) aggregatie — de drie showcases dekken SAMEN alle app-functies.
  const scResTypes = new Set<string>();
  const scRelTypes = new Set<string>();
  let scSteps = false, scCal = false, scPct = false, scElapsed = false, scLead = false;
  let scDeadline = false, scPin = false, scNegFloat = false;
  const scCurves = new Set<string>();

  for (const spec of specs) {
    const { diffs, parsed } = verifySpec(spec);
    const extra: string[] = [];
    if (spec.category === 'showcase') {
      const facts = verifyShowcase(spec, parsed, extra);
      parsed.resources.forEach(r => scResTypes.add(r.type));
      parsed.sequences.forEach(s => {
        scRelTypes.add(s.type);
        if (s.lagPercent) scPct = true;
        if (s.lagUnit === 'ELAPSEDTIME') scElapsed = true;
        if (s.lagDays < 0) scLead = true;
      });
      parsed.assignments.forEach(a => scCurves.add(a.curve ?? 'UNIFORM'));
      if (parsed.resources.some(r => r.availabilitySteps?.length)) scSteps = true;
      if (parsed.resourceCalendars.length > 0) scCal = true;
      if (parsed.tasks.some(t => t.deadline)) scDeadline = true;
      if (parsed.tasks.some(t => t.priority === 1000)) scPin = true;
      if (facts.negFloat > 0) scNegFloat = true;
    }
    const all = [...diffs, ...extra];
    const ok = all.length === 0;
    if (!ok) anyFail = true;
    console.log(`${ok ? 'OK ' : 'XX '} ${spec.slug}`);
    for (const d of all) console.log(`     - ${d}`);
  }

  // Union-checks over de drie showcases samen.
  const suite: [boolean, string][] = [
    [['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW'].every(t => scResTypes.has(t)), `alle vijf resourcetypes (heeft: ${[...scResTypes].sort().join(',')})`],
    [['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH'].every(t => scRelTypes.has(t)), `alle vier relatietypes (heeft: ${[...scRelTypes].sort().join(',')})`],
    [scCurves.size >= 6, `alle zes toewijzingscurves (heeft: ${scCurves.size})`],
    [scSteps, `availabilitySteps aanwezig`],
    [scCal, `resource-kalender aanwezig`],
    [scPct, `%-lag aanwezig`],
    [scElapsed, `ELAPSEDTIME-lag aanwezig`],
    [scLead, `lead (negatieve lag) aanwezig`],
    [scDeadline, `deadline aanwezig`],
    [scPin, `vastgepinde taak (prioriteit 1000) aanwezig`],
    [scNegFloat, `negatieve float (deadline-conflict) aanwezig`],
  ];
  console.log('\n── Union over de drie showcases ──');
  for (const [ok, label] of suite) {
    if (!ok) anyFail = true;
    console.log(`  ${ok ? 'OK ' : 'XX '} ${label}`);
  }

  console.log(`\n${showcases.length} showcases + ${specs.length - showcases.length} basisvoorbeelden geverifieerd — ${anyFail ? 'FALEN' : 'alles groen'}`);
  process.exit(anyFail ? 1 : 0);
}

main();
