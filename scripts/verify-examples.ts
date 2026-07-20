// Verificatie van de gegenereerde voorbeelden — haalt ELK bestand door de ECHTE readIFC en assert:
//  1. parse zonder fouten;
//  2. taak/relatie/resource/toewijzing/code/veld-tellingen conform de declaratieve spec;
//  3. round-trip write→read→write stabiel (data-fixpunt: readIFC → writeIFC → readIFC geeft
//     identieke inhoud — GUIDs zijn per lees-run nieuw, dus we vergelijken structureel, niet als
//     string). Fase 2.10: het digest omvat nu ook notes, voortgang/actuals en baselines, zodat de
//     nieuwe schema-uitbreidingen ook echt round-trip-getoetst worden;
//  4. per showcase dat de beloofde functies aantoonbaar aanwezig zijn (constraints, START/FINISH-
//     + verplichte mijlpaal, baseline). Ploeg-hiërarchie/curve-variatie/oplosbare overallocatie
//     zijn alleen verplicht voor showcases die zelf resources declareren (KLEIN heeft er bewust
//     geen — zie showcases.ts);
//  5. (golf 2) suite-brede unie incl. de 8 geavanceerde functies (hard pin, constraint2, hammock,
//     near-critical, float paths, uren-planning, 2 baselines+rebaseline, externe koppeling) +
//     een aparte bronbestand-consistentiecheck voor de externe koppeling (§4.2).
//
//   npm run verify:examples          # exit 0 = alles groen, 1 = minstens één afwijking
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { useAppStore } from '@/state/appStore';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSpecs } from './gen-core';
import type { ProjectSpec } from './spec';

const ROOT = process.cwd();
const EX_DIR = join(ROOT, 'examples');
const S = () => useAppStore.getState();

type Parsed = ReturnType<typeof readIFC>;

/** Structureel data-fingerprint (ids → namen) zodat de round-trip los van willekeurige GUIDs/ids
 *  vergeleken kan worden. Fase 2.10: ook notes, voortgang/actuals en baselines meegenomen. */
function digest(p: Parsed): string {
  const taskName = new Map(p.tasks.map(t => [t.id, t.name]));
  const resName = new Map(p.resources.map(r => [r.id, r.name]));
  const tasks = [...p.tasks].map(t => ({
    n: t.name, es: t.time.earlyStart, ef: t.time.earlyFinish, tf: t.time.totalFloat,
    ms: t.isMilestone, mk: t.milestoneKind ?? null, man: !!t.mandatory, pr: t.priority,
    c: t.constraint ?? null, dl: t.deadline ?? null, wbs: t.wbsCode,
    notes: [...(t.notes ?? [])].map(n => ({ t: n.text, d: n.done })).sort((a, b) => a.t.localeCompare(b.t)),
    comp: t.time.completion, as: t.time.actualStart ?? null, af: t.time.actualFinish ?? null,
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
  const baselines = [...p.baselines].map(b => ({
    name: b.name,
    tasks: [...b.tasks].map(bt => ({ t: taskName.get(bt.taskId), s: bt.start, f: bt.finish, d: bt.duration }))
      .sort((a, b2) => JSON.stringify(a).localeCompare(JSON.stringify(b2))),
  })).sort((a, b) => a.name.localeCompare(b.name));
  const activeBaselineName = p.activeBaselineId ? (p.baselines.find(b => b.id === p.activeBaselineId)?.name ?? null) : null;
  return JSON.stringify({ tasks, seqs, res, asg, codes, fields, baselines, activeBaselineName });
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

  // 2. tellingen conform spec — inclusief eventuele rebaseline-mutaties (golf 2, `baselines[].
  // mutationBefore`), want die worden ook echt in de store opgebouwd (`gen-core.ts:build()`).
  const mutations = (spec.baselines ?? []).map(b => b.mutationBefore).filter((m): m is NonNullable<typeof m> => !!m);
  const allTasks = [...spec.tasks, ...mutations.flatMap(m => m.addTasks ?? [])];
  const allLinks = [...(spec.links ?? []), ...mutations.flatMap(m => m.addLinks ?? [])];
  const expMilestones = allTasks.filter(t => t.milestone).length;
  const expAssign = allTasks.reduce((a, t) => a + (t.assign?.length ?? 0), 0);
  expect(diffs, parsed.tasks.length === allTasks.length, `taken: ${parsed.tasks.length} ≠ ${allTasks.length}`);
  expect(diffs, parsed.tasks.filter(t => t.isMilestone).length === expMilestones, `mijlpalen: ${parsed.tasks.filter(t => t.isMilestone).length} ≠ ${expMilestones}`);
  expect(diffs, parsed.sequences.length === allLinks.length, `relaties: ${parsed.sequences.length} ≠ ${allLinks.length}`);
  expect(diffs, parsed.resources.length === (spec.resources?.length ?? 0), `resources: ${parsed.resources.length} ≠ ${spec.resources?.length ?? 0}`);
  expect(diffs, parsed.assignments.length === expAssign, `toewijzingen: ${parsed.assignments.length} ≠ ${expAssign}`);
  expect(diffs, parsed.activityCodeTypes.length === (spec.codeTypes?.length ?? 0), `codetypes: ${parsed.activityCodeTypes.length} ≠ ${spec.codeTypes?.length ?? 0}`);
  expect(diffs, parsed.customFieldDefs.length === (spec.fields?.length ?? 0), `customfields: ${parsed.customFieldDefs.length} ≠ ${spec.fields?.length ?? 0}`);
  expect(diffs, parsed.baselines.length === (spec.baselines?.length ?? 0), `baselines: ${parsed.baselines.length} ≠ ${spec.baselines?.length ?? 0}`);

  // 3. round-trip write→read→write stabiel (structureel data-fixpunt)
  // `writeIFC` neemt sinds pakket R één invoer-object (`WriteIFCInput`); een readIFC-resultaat
  // draagt de kalender-bibliotheek al onder de writer-naam `resourceCalendars`, dus hier geen
  // `buildWriteIFCInput` (die verwacht juist het store-veld `calendars`).
  const s2 = writeIFC({
    project: parsed.project, calendar: parsed.calendar, tasks: parsed.tasks,
    sequences: parsed.sequences, resources: parsed.resources, assignments: parsed.assignments,
    activityCodeTypes: parsed.activityCodeTypes, customFieldDefs: parsed.customFieldDefs,
    resourceCalendars: parsed.resourceCalendars,
    baselines: parsed.baselines, activeBaselineId: parsed.activeBaselineId,
  });
  const parsed2 = readIFC(s2);
  expect(diffs, digest(parsed) === digest(parsed2), `round-trip niet stabiel (data verschilt na write→read→write)`);

  return { pass: diffs.length === 0, diffs, parsed };
}

/** Herbereken float/overallocatie/kritieke-paden autoritair door het bestand in de echte store
 *  te laden (fase 2.10, golf 2: ook `criticalPaths.length`/`isNearCritical` voor de golf-2-
 *  union-checks). BELANGRIJK: `isNearCritical`/`floatPath` zijn PURE CPM-afgeleide velden die
 *  NIET via `writeIFC`/`readIFC` round-tripen (bevestigd: op de kale eerste `readIFC`-parse staan
 *  ze altijd leeg) — ze bestaan pas ná een verse `runCPM()`-run zoals hier. De union-check moet
 *  dus op déze herberekende `facts`, niet op de kale `parsed.tasks`. */
function scheduleFacts(parsed: Parsed): {
  negFloat: number; negFloatAll: number; overalloc: string[]; criticalPaths: number; nearCritical: boolean;
  violated: number; outOfSequence: number;
} {
  S().loadState(parsed as any);
  S().runCPM();
  const st = S();
  const negFloat = st.tasks.filter(t => t.childIds.length === 0 && t.time.totalFloat < 0).length;
  // Ook de WBS-ouders meetellen (pakket F): een samenvattingstaak erft de speling van zijn
  // kinderen, dus "geen enkele taak negatief" is strenger dan alleen de leaves.
  const negFloatAll = st.tasks.filter(t => t.time.totalFloat < 0).length;
  const rlr = st.resourceLoadResult;
  const overalloc: string[] = [];
  if (rlr) {
    for (const r of st.resources) {
      if ((rlr.overallocatedDays[r.id] ?? []).length > 0) overalloc.push(r.name);
    }
  }
  const criticalPaths = st.cpmResult?.criticalPaths?.length ?? 1;
  const nearCritical = st.tasks.some(t => t.time.isNearCritical === true);
  const violated = st.cpmResult?.violatedConstraintTaskIds?.length ?? 0;
  const outOfSequence = st.cpmResult?.outOfSequenceSequenceIds?.length ?? 0;
  return { negFloat, negFloatAll, overalloc, criticalPaths, nearCritical, violated, outOfSequence };
}

/**
 * Fase 2.10 (P1-datafix, golf 4): MIDDEL-specifieke nivelleringsproef. De showcase belooft EXPLICIET
 * "een met nivellering oplosbare overallocatie" (de stukadoors) — deze check bewijst dat headless,
 * via de ECHTE `levelResources`/`applyLeveling` (zelfde route als de Level-knop in de UI): vóór
 * leveling moet er overallocatie zijn (al gedekt door de generieke `hasResources`-check hierboven),
 * ná leveling moet ze VOLLEDIG verdwenen zijn (0 overallocated dagen over alle resources). Moet
 * NA `scheduleFacts` draaien (state staat dan al geladen + CPM vers) — laadt zelf niet opnieuw.
 */
function verifyLevelingFullyResolves(diffs: string[]) {
  const st = S();
  const before = st.resourceLoadResult;
  const beforeCount = before ? Object.values(before.overallocatedDays).reduce((a, d) => a + d.length, 0) : 0;
  expect(diffs, beforeCount > 0, `nivellerings-proef: vóór leveling geen overallocatie gevonden (niets te bewijzen)`);
  const result = S().levelResources({ constrainToFloat: false });
  expect(diffs, Object.keys(result.unresolved).length === 0,
    `nivellerings-proef: ${Object.keys(result.unresolved).length} taak/taken blijven onopgelost ná leveling`);
  S().applyLeveling(result);
  S().recomputeResourceLoad();
  const after = S().resourceLoadResult;
  const afterCount = after ? Object.values(after.overallocatedDays).reduce((a, d) => a + d.length, 0) : 0;
  expect(diffs, afterCount === 0, `nivellerings-proef: ná leveling nog ${afterCount} overallocated resource-dag(en) over`);
}

/** Per-showcase: de functies die ÉLKE showcase hoort te tonen, ongeacht schaal (structuur,
 *  mijlpalen, baseline). Resource-afhankelijke functies (ploeg-hiërarchie, curve-variatie, een met
 *  nivellering oplosbare overallocatie) zijn alleen verplicht voor showcases die zelf resources
 *  declareren — KLEIN heeft er bewust geen (instapniveau, zie showcases.ts). Union-brede functies
 *  (deadline, prioriteit 1000, negatieve float, alle relatietypes, %-lag/ELAPSEDTIME/lead,
 *  voortgang+statusdatum, notes, vorstverlet) worden op suite-niveau geverifieerd. */
function verifyShowcase(spec: ProjectSpec, parsed: Parsed, diffs: string[]): ReturnType<typeof scheduleFacts> {
  const T = parsed.tasks;
  const expConstraints = spec.tasks.filter(t => t.constraint).length;
  expect(diffs, T.filter(t => t.constraint).length === expConstraints, `constraints teruggelezen: ${T.filter(t => t.constraint).length} ≠ ${expConstraints}`);
  expect(diffs, T.some(t => t.isMilestone && t.milestoneKind === 'START'), `geen START-mijlpaal`);
  expect(diffs, T.some(t => t.isMilestone && t.milestoneKind === 'FINISH'), `geen FINISH-mijlpaal`);
  expect(diffs, T.some(t => t.mandatory), `geen verplichte mijlpaal`);
  expect(diffs, parsed.baselines.length > 0, `geen baseline aanwezig`);

  const hasResources = (spec.resources?.length ?? 0) > 0;
  if (hasResources) {
    expect(diffs, parsed.resources.some(r => r.parentId), `geen ploeg-hiërarchie (resource met parent)`);
    const curves = new Set(parsed.assignments.map(a => a.curve ?? 'UNIFORM'));
    expect(diffs, curves.size >= 3, `curve-variatie te laag (${curves.size})`);
  }

  const facts = scheduleFacts(parsed);
  if (hasResources) expect(diffs, facts.overalloc.length > 0, `geen overallocatie zichtbaar`);
  return facts;
}

/** Externe-koppeling-consistentiecheck (fase 2.10, golf 2, §4.2): bronbestand moet bestaan +
 *  het bevroren `anchorDate` op GROOT's taak moet overeenkomen met wat een verse `readIFC` van
 *  het bronbestand daadwerkelijk oplevert voor de brontaak (gematcht op NAAM — taak-ids zijn
 *  per leesrun nieuw, dus nooit een stabiel matchveld, ook niet binnen dit script: zie de
 *  bestaande digest()-conventie hierboven). */
function verifyExternalSource(specs: ProjectSpec[], diffs: string[]) {
  const terrain = specs.find(s => s.category === 'external-source');
  if (!terrain) { diffs.push('extern bronbestand-spec ontbreekt (category "external-source")'); return; }
  const terrainPath = join(EX_DIR, `${terrain.slug}.ifc`);
  if (!existsSync(terrainPath)) { diffs.push(`extern bronbestand niet op schijf: ${terrainPath}`); return; }
  const terrainParsed = readIFC(readFileSync(terrainPath, 'utf8'));

  const groot = specs.find(s => s.category === 'showcase' && (s.tags ?? []).includes('groot'));
  if (!groot) { diffs.push('GROOT-showcase (tag "groot") niet gevonden'); return; }
  const grootPath = join(EX_DIR, `${groot.slug}.ifc`);
  if (!existsSync(grootPath)) { diffs.push(`GROOT-bestand niet op schijf: ${grootPath}`); return; }
  const grootParsed = readIFC(readFileSync(grootPath, 'utf8'));

  const withLink = grootParsed.tasks.filter(t => (t.externalLinks?.length ?? 0) > 0);
  if (withLink.length === 0) { diffs.push('GROOT heeft geen taak met een externe koppeling'); return; }
  for (const t of withLink) {
    for (const link of t.externalLinks ?? []) {
      const srcTask = terrainParsed.tasks.find(x => x.name === link.sourceRef.taskName);
      if (!srcTask) { diffs.push(`extern-koppeling: brontaak "${link.sourceRef.taskName}" niet gevonden in bronbestand`); continue; }
      const side = (link.direction === 'predecessor' ? link.relType[0] : link.relType[1]) === 'F' ? 'finish' : 'start';
      const expected = side === 'finish'
        ? (srcTask.time.earlyFinish || srcTask.time.scheduleFinish)
        : (srcTask.time.earlyStart || srcTask.time.scheduleStart);
      expect(diffs, expected === link.anchorDate, `extern-koppeling anchorDate inconsistent: opgeslagen ${link.anchorDate} ≠ herberekend ${expected}`);
      expect(diffs, link.sourceMissing === true, `extern-koppeling: sourceMissing hoort true te zijn (bronbestand niet in PUBLIC-set, architect-besluit 4)`);
    }
  }
}

function main() {
  const specs = allSpecs();
  const showcases = specs.filter(s => s.category === 'showcase');
  let anyFail = false;
  // Suite-brede (union) aggregatie over ALLE showcases (KLEIN + MIDDEL + GROOT sinds golf 2).
  const scResTypes = new Set<string>();
  const scRelTypes = new Set<string>();
  let scCal = false, scPct = false, scElapsed = false, scLead = false;
  let scDeadline = false, scPin = false, scNegFloat = false;
  let scProgress = false, scVorstverlet = false;
  let scHardPin = false, scConstraint2 = false, scHammock = false, scNearCritical = false;
  let scFloatPaths = false, scHourCalendar = false, scAvailSteps = false;
  let scTwoBaselines = false, scActiveBaselineName: string | null = null;
  const scCurves = new Set<string>();
  const allNotes: { text: string; done: boolean }[] = [];

  for (const spec of specs) {
    const { diffs, parsed } = verifySpec(spec);
    const extra: string[] = [];
    if (spec.category === 'showcase') {
      const facts = verifyShowcase(spec, parsed, extra);
      // Fase 2.10 (P1-datafix, golf 4) — showcase-specifieke nivellerings-/schendingsproeven.
      // MIDDEL: "nivellering lost het op" moet aantoonbaar kloppen (headless, echte leveler).
      // GROOT: de datafix moet 0 constraint-violations en 0 out-of-sequence-meldingen opleveren,
      // mét overallocatie nog steeds zichtbaar (de bedoelde les — leveling lost NIET alles op).
      if (spec.slug === 'showcase-rijwoningen-de-akkers') {
        verifyLevelingFullyResolves(extra);
      }
      if (spec.slug === 'showcase-appartementencomplex') {
        expect(extra, facts.violated === 0, `GROOT: ${facts.violated} constraint-violation(s) ná datafix (verwacht 0)`);
        expect(extra, facts.outOfSequence === 0, `GROOT: ${facts.outOfSequence} out-of-sequence-melding(en) ná datafix (verwacht 0)`);
        // Pakket F (datafix 2): de voltooide fase-1/2-keten liep CONFORM PLAN (`actualsFromPlan`),
        // dus er is per definitie geen uitloop op voltooid werk — en dus ook geen negatieve
        // speling. Vangnet tegen terugval naar handgeschreven werkdag-indices, die door de
        // feestdag-blinde `offset()` systematisch schijn-uitloop (⇒ negatieve TF) opleveren.
        expect(extra, facts.negFloatAll === 0, `GROOT: ${facts.negFloatAll} taak/taken met negatieve totale speling (verwacht 0 — voltooide keten conform plan)`);
        expect(extra, facts.overalloc.length > 0, `GROOT: geen overallocatie zichtbaar (verwacht de bedoelde les — nivellering lost niet alles op)`);
        // Meerdere kritieke paden zijn een BELOFTE in GROOTs publicDescription, dus hier expliciet
        // per showcase geasserteerd i.p.v. alleen suite-breed. De FREE_FLOAT-peel noemt een keten
        // pas kritiek als élke taak erin kritiek is; voltooide taken zijn dat nooit, dus dit valt
        // stil zodra de van de torens onafhankelijke garage/terrein-keten (fase 7, eigen wortel ná
        // de statusdatum) niet meer strak tot het projecteinde doorloopt — zie showcase-groot.ts.
        expect(extra, facts.criticalPaths >= 2, `GROOT: ${facts.criticalPaths} kritiek pad/paden (verwacht ≥2 — torens + onafhankelijke garage/terrein-keten)`);
      }
      parsed.resources.forEach(r => scResTypes.add(r.type));
      parsed.sequences.forEach(s => {
        scRelTypes.add(s.type);
        if (s.lagPercent) scPct = true;
        if (s.lagUnit === 'ELAPSEDTIME') scElapsed = true;
        if (s.lagDays < 0) scLead = true;
      });
      parsed.assignments.forEach(a => scCurves.add(a.curve ?? 'UNIFORM'));
      if (parsed.resourceCalendars.length > 0) scCal = true;
      if (parsed.tasks.some(t => t.deadline)) scDeadline = true;
      if (parsed.tasks.some(t => t.priority === 1000)) scPin = true;
      if (facts.negFloat > 0) scNegFloat = true;
      if (parsed.project.statusDate && parsed.tasks.some(t => t.time.completion > 0)) scProgress = true;
      if (parsed.calendar.holidays.some(h => /vorst/i.test(h.name))) scVorstverlet = true;
      parsed.tasks.forEach(t => { for (const n of t.notes ?? []) allNotes.push(n); });
      // Golf 2 — geavanceerde functies.
      if (parsed.tasks.some(t => t.constraint?.hard === true)) scHardPin = true;
      if (parsed.tasks.some(t => !!t.constraint2)) scConstraint2 = true;
      if (parsed.tasks.some(t => t.isHammock === true)) scHammock = true;
      if (facts.nearCritical) scNearCritical = true;
      if (facts.criticalPaths > 1) scFloatPaths = true;
      if (parsed.resourceCalendars.some(c => !!c.workTime) || !!parsed.calendar.workTime) scHourCalendar = true;
      if (parsed.resources.some(r => (r.availabilitySteps?.length ?? 0) > 0)) scAvailSteps = true;
      if (parsed.baselines.length >= 2) scTwoBaselines = true;
      if (parsed.activeBaselineId) {
        const b = parsed.baselines.find(x => x.id === parsed.activeBaselineId);
        if (b) scActiveBaselineName = b.name;
      }
    }
    const all = [...diffs, ...extra];
    const ok = all.length === 0;
    if (!ok) anyFail = true;
    console.log(`${ok ? 'OK ' : 'XX '} ${spec.slug}`);
    for (const d of all) console.log(`     - ${d}`);
  }

  // Union-checks over ALLE showcases samen (golf 2: volledige dekkingsmatrix-unie, §3.3/§5.2).
  const suite: [boolean, string][] = [
    [['LABOR', 'CREW', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACTOR'].every(t => scResTypes.has(t)), `alle 5 resourcetypes (heeft: ${[...scResTypes].sort().join(',')})`],
    [['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH'].every(t => scRelTypes.has(t)), `alle 4 relatietypes (heeft: ${[...scRelTypes].sort().join(',')})`],
    [scCurves.size >= 6, `alle 6 toewijzingscurves (heeft: ${scCurves.size})`],
    [scCal, `resource-kalender aanwezig`],
    [scPct, `%-lag aanwezig`],
    [scElapsed, `ELAPSEDTIME-lag aanwezig`],
    [scLead, `lead (negatieve lag) aanwezig`],
    [scDeadline, `deadline aanwezig`],
    [scPin, `vastgepinde taak (prioriteit 1000) aanwezig`],
    [scNegFloat, `negatieve float (deadline-conflict) aanwezig`],
    [scProgress, `voortgang + statusdatum aanwezig`],
    [scVorstverlet, `extraHolidays/vorstverlet aanwezig`],
    [allNotes.some(n => !n.done) && allNotes.some(n => n.done), `aantekeningen aanwezig met ≥1 open en ≥1 afgevinkt`],
    [scAvailSteps, `availabilitySteps (capaciteitsstappen) aanwezig`],
    [scHardPin, `hard pin (constraint.hard) aanwezig`],
    [scConstraint2, `secundaire constraint (constraint2) aanwezig`],
    [scHammock, `hammock (isHammock) aanwezig`],
    [scNearCritical, `near-critical-markering aanwezig`],
    [scFloatPaths, `meerdere kritieke paden (criticalPaths.length > 1) aanwezig`],
    [scHourCalendar, `uren-kalender (workTime) aanwezig`],
    [scTwoBaselines, `≥2 baselines (rebaseline) aanwezig`],
    [scActiveBaselineName === 'Contract', `activeBaselineId wijst naar "Contract" (heeft: ${scActiveBaselineName ?? '(geen)'})`],
  ];
  console.log('\n── Union over alle showcases (golf 2: KLEIN + MIDDEL + GROOT) ──');
  for (const [ok, label] of suite) {
    if (!ok) anyFail = true;
    console.log(`  ${ok ? 'OK ' : 'XX '} ${label}`);
  }

  const extDiffs: string[] = [];
  verifyExternalSource(specs, extDiffs);
  console.log('\n── Externe koppeling (bronbestand-consistentie, §4.2) ──');
  if (extDiffs.length === 0) {
    console.log('  OK  bronbestand aanwezig + anchorDate consistent');
  } else {
    anyFail = true;
    for (const d of extDiffs) console.log(`  XX  ${d}`);
  }

  console.log(`\n${showcases.length} showcases + ${specs.length - showcases.length - 1} basisvoorbeelden + 1 extern bronbestand geverifieerd — ${anyFail ? 'FALEN' : 'alles groen'}`);
  process.exit(anyFail ? 1 : 0);
}

main();
