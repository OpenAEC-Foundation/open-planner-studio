// check-docs-resources-voorbeelden.ts — pint de rekenvoorbeelden uit de gebruikersdocumentatie
// van het domein Resources & werk (`public/docs/{nl,en}/uitleg-werkregels.md`,
// `uitleg-nivelleren.md` en de bijbehorende how-to's).
//
// De artikelen noemen wat-als-getallen op het tutorialproject *Aanbouw woning* (stand na tutorial 4,
// met de resources en toewijzingen van tutorial 5): oplevering 02-09 bij prioriteit Hoog, 25-08 →
// 30-08 zonder SNET, Vast werk bij inzet 3, enzovoort. `check-tutorial-project.ts` pint alleen de
// basisstanden; deze check pint de variaties, zodat een motor- of storewijziging die een getal
// verandert rood wordt in plaats van de documentatie stil te laten liegen. Verandert een getal
// bewust, pas dan de pin hieronder ÉN de artikelen (nl en en) aan.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { workDaySlotsToPeriods } from '@/engine/contour/contourEdit';
import { distributeUnits } from '@/engine/scheduler/ResourceLoad';
import type { WorkRule } from '@/types/workRule';
import { buildTutorialProject, ASSIGNMENTS, HOUR_TASKS, RESOURCES, TASKS, WORK_RULE, type ResourceKey, type TaskKey } from '../../scripts/tutorial-project';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const name = (k: TaskKey): string => TASKS.find(t => t.key === k)!.name.nl;
const task = (k: TaskKey) => S().tasks.find(t => t.name === name(k))!;
const byName = (n: string) => S().tasks.find(t => t.name === n)!;
const day = (iso: string): string => iso.slice(0, 10);
const span = (k: TaskKey): string => `${day(task(k).time.earlyStart)}..${day(task(k).time.earlyFinish)}`;
const oplevering = (): string => day(task('msHandover').time.earlyStart);

let na4Ifc = '';
let resIds = new Map<ResourceKey, string>();

/** Stand na tutorial 4 + de resources en toewijzingen van tutorial 5 (Stucwerk: Vast werk, inzet 2). */
async function tutorialBase(opts: { noConstraint?: boolean; plasterRule?: boolean } = {}): Promise<void> {
  await S().openExampleFromString(na4Ifc, 'na-tut-4.ifc');
  resIds = new Map();
  for (const r of RESOURCES) {
    resIds.set(r.key, S().addResource({
      name: r.name.nl, type: r.type, description: '', maxUnits: r.maxUnits,
      ...(r.unitOfMeasure ? { unitOfMeasure: r.unitOfMeasure } : {}),
    }));
  }
  if (opts.noConstraint) S().updateTask(task('frames').id, { constraint: { type: 'ASAP' } as never });
  S().runCPM();
  // Bewust zonder de toewijzingen op de urentaken (betonstort, vloer, dakelementen): de check pint
  // geen getallen waarin een urentaak korter dan een werkdag meespeelt.
  const hourKeys = new Set<TaskKey>(HOUR_TASKS.map(h => h.task));
  for (const a of ASSIGNMENTS.filter(x => !hourKeys.has(x.task))) S().assignResource(task(a.task).id, resIds.get(a.res)!, a.units);
  S().runCPM();
  if (opts.plasterRule) {
    const p = task(WORK_RULE.task);
    S().setTaskWorkRule(p.id, WORK_RULE.rule);
    S().updateAssignment(S().assignments.find(a => a.taskId === p.id)!.id, { unitsPerDay: WORK_RULE.unitsAfter });
    S().runCPM();
  }
}

function level(constrainToFloat: boolean) {
  return S().levelResources({
    constrainToFloat,
    resourceIds: S().resources.filter(r => r.type !== 'MATERIAL').map(r => r.id),
  });
}
const delaysByName = (r: ReturnType<typeof level>): Record<string, number> =>
  Object.fromEntries(Object.entries(r.delays).map(([id, v]) => [S().tasks.find(t => t.id === id)!.name, v]));

// ── Stucwerk-opstelling (uitleg-werkregels): 4 wd, één stukadoor, 32 uur ────────────────────────
async function plasterBase(rule: WorkRule, units = 1, maxUnits = 3, second = false): Promise<{ id: string; res: string; res2: string }> {
  await S().openExampleFromString(na4Ifc, 'na-tut-4.ifc');
  S().runCPM();
  const p = byName(name('plaster'));
  const res = S().addResource({ name: 'Stukadoor', type: 'SUBCONTRACTOR', description: '', maxUnits });
  S().assignResource(p.id, res, units);
  let res2 = '';
  if (second) {
    res2 = S().addResource({ name: 'Stukadoor 2', type: 'SUBCONTRACTOR', description: '', maxUnits });
    S().assignResource(p.id, res2, units);
  }
  S().runCPM();
  S().setTaskWorkRule(p.id, rule);
  return { id: p.id, res, res2 };
}
const dur = (id: string): number => S().tasks.find(t => t.id === id)!.time.scheduleDuration;
const asg = (taskId: string, resId?: string) => S().assignments.find(a => a.taskId === taskId && (!resId || a.resourceId === resId))!;
const workH = (a: { remainingWorkMinutes?: number }): number | null => a.remainingWorkMinutes === undefined ? null : a.remainingWorkMinutes / 60;
/** Belasting per werkdag van de resource binnen de taakspanne. */
function dayLoad(taskId: string, resId: string): number[] {
  const t = S().tasks.find(x => x.id === taskId)!;
  const l = S().resourceLoadResult?.load[resId] ?? {};
  return Object.entries(l).filter(([d]) => d >= day(t.time.earlyStart) && d <= day(t.time.earlyFinish)).map(([, v]) => v as number);
}

async function main(): Promise<void> {
  na4Ifc = buildTutorialProject('nl').stages.find(s => s.id === 'na-tut-4')!.ifc;

  // ── uitleg-nivelleren: het voorbeeld met de metselaar ──
  console.log('-- docs-resources: nivelleren --');
  {
    await tutorialBase({ plasterRule: true });
    eq('nivelleren: binnenspouwblad speling', task('innerLeaf').time.totalFloat, 3);
    eq('nivelleren: buitenspouwblad speling', task('outerLeaf').time.totalFloat, 5);
    eq('nivelleren: alleen de metselaar overbezet', Object.keys(S().resourceLoadResult!.overallocatedDays).filter(id => S().resourceLoadResult!.overallocatedDays[id].length > 0), [resIds.get('bricklayer')]);
    eq('nivelleren: oplevering voor', oplevering(), '2027-08-30');
    const r = level(false);
    eq('nivelleren: buitenspouwblad +5 werkdagen', delaysByName(r), { [name('outerLeaf')]: 5 });
    eq('nivelleren: niets onoplosbaar', Object.keys(r.unresolved).length, 0);
    S().applyLeveling(r);
    eq('nivelleren: buitenspouwblad na nivelleren', span('outerLeaf'), '2027-07-06..2027-07-13');
    eq('nivelleren: binnenspouwblad blijft', span('innerLeaf'), '2027-06-29..2027-07-05');
    eq('nivelleren: oplevering na', oplevering(), '2027-08-30');
    eq('nivelleren: niemand meer overbezet', Object.values(S().resourceLoadResult!.overallocatedDays).flat().length, 0);
  }
  {
    await tutorialBase({ plasterRule: true });
    const r = level(true);
    eq('smoothing op het tutorialproject: zelfde uitkomst', delaysByName(r), { [name('outerLeaf')]: 5 });
    eq('smoothing op het tutorialproject: geen conflict', Object.keys(r.unresolved).length, 0);
  }
  {
    await tutorialBase({ noConstraint: true, plasterRule: true });
    eq('zonder SNET: oplevering voor nivelleren', oplevering(), '2027-08-25');
    const smooth = level(true);
    eq('zonder SNET + smoothing: geen verschuiving', delaysByName(smooth), {});
    eq('zonder SNET + smoothing: conflict INSUFFICIENT_CAPACITY (5 dagen)',
      [Object.values(smooth.unresolvedReasons), Object.values(smooth.unresolved).map(v => v.length)],
      [['INSUFFICIENT_CAPACITY'], [5]]);
    const plain = level(false);
    eq('zonder SNET: buitenspouwblad +5', delaysByName(plain), { [name('outerLeaf')]: 5 });
    S().applyLeveling(plain);
    eq('zonder SNET: oplevering na nivelleren', oplevering(), '2027-08-30');
  }
  {
    await tutorialBase({ plasterRule: true });
    S().updateTask(task('outerLeaf').id, { priority: 900 });
    const r = level(false);
    eq('prioriteit Hoog: binnenspouwblad wijkt 6 werkdagen', delaysByName(r), { [name('innerLeaf')]: 6 });
    eq('prioriteit Hoog: oplevering voor -> na', [r.projectEndBefore, r.projectEndAfter].map(d => String(d).slice(0, 10)), ['2027-08-30', '2027-09-02']);
    S().applyLeveling(r);
    eq('prioriteit Hoog: binnenspouwblad', span('innerLeaf'), '2027-07-07..2027-07-13');
    eq('prioriteit Hoog: buitenspouwblad blijft', span('outerLeaf'), '2027-06-29..2027-07-06');
    eq('prioriteit Hoog: oplevering', oplevering(), '2027-09-02');
  }
  {
    await tutorialBase({ plasterRule: true });
    S().updateTask(task('outerLeaf').id, { priority: 1000 });
    S().updateTask(task('innerLeaf').id, { priority: 1000 });
    const r = level(false);
    eq('beide op 1000: geen verschuiving, geen conflictmelding', [delaysByName(r), Object.keys(r.unresolved).length], [{}, 0]);
    S().applyLeveling(r);
    ok('beide op 1000: de metselaar blijft overbezet', (S().resourceLoadResult!.overallocatedDays[resIds.get('bricklayer')!] ?? []).length > 0);
  }
  {
    await tutorialBase({ plasterRule: true });
    S().updateResource(resIds.get('bricklayer')!, { maxUnits: 2 });
    eq('Max. eenheden 2: niemand overbezet', Object.values(S().resourceLoadResult!.overallocatedDays).flat().length, 0);
    const r = level(false);
    eq('Max. eenheden 2: geen verschuivingen, niets onoplosbaar', [delaysByName(r), Object.keys(r.unresolved).length], [{}, 0]);
  }

  // ── uitleg-werkregels: het stucwerk ──
  console.log('-- docs-resources: werkregels --');
  {
    const f = await plasterBase('FIXED_WORK');
    S().undo();
    eq('Ongedaan na het kiezen van een werkregel: regel weg, weergave blijft aan',
      [S().tasks.find(t => t.id === f.id)!.workRule ?? null, S().taskTypesVisible], [null, true]);
  }
  {
    const f = await plasterBase('FIXED_WORK');
    eq('stucwerk: 4 werkdagen, 32 uur', [dur(f.id), workH(asg(f.id))], [4, 32]);
    S().updateAssignment(asg(f.id).id, { unitsPerDay: 2 });
    eq('Vast werk, inzet 1 -> 2: 2 werkdagen, werk blijft 32 uur', [dur(f.id), workH(asg(f.id))], [2, 32]);
  }
  {
    const f = await plasterBase('FIXED_DURATION_RATE');
    S().updateAssignment(asg(f.id).id, { unitsPerDay: 2 });
    eq('Vaste duur en inzet, inzet 1 -> 2: duur blijft 4, inzet 2 (werk 64 uur)', [dur(f.id), asg(f.id).unitsPerDay], [4, 2]);
  }
  {
    const f = await plasterBase('FIXED_WORK');
    S().updateAssignment(asg(f.id).id, { unitsPerDay: 3 });
    S().runCPM();
    eq('Vast werk, inzet 3: 2 werkdagen (32 / 24 = 1,33 naar boven)', dur(f.id), 2);
    eq('Vast werk, inzet 3: histogram 2 per dag', dayLoad(f.id, f.res), [2, 2]);
  }
  {
    const f = await plasterBase('FIXED_WORK', 1, 4);
    const r2 = S().addResource({ name: 'Stukadoor 2', type: 'SUBCONTRACTOR', description: '', maxUnits: 4 });
    S().assignResource(f.id, r2, 2);
    const a1 = asg(f.id, f.res), a2 = asg(f.id, r2);
    eq('Vast werk, verhouding 1 : 2: 10,7 en 21,3 uur, 2 werkdagen',
      [dur(f.id), Math.round((workH(a1) ?? 0) * 10) / 10, Math.round((workH(a2) ?? 0) * 10) / 10], [2, 10.7, 21.3]);
  }
  {
    const f = await plasterBase('FIXED_WORK');
    const cal = S().project.calendarId!;
    S().commitCalendarLibrary(S().calendars.map(c => c.id === cal ? { ...c, hoursPerDay: 6, workStartHour: 7, workEndHour: 14 } : c), cal);
    eq('kalender 8 -> 6 uur per dag onder Vast werk: 6 werkdagen', dur(f.id), 6);
  }
  {
    // Twee resources die elk 32 uur werk en inzet 1 hebben (samen 4 werkdagen): de inzet van de
    // eerste gaat naar 0,5. Wat de andere resource doet, hangt van de regel af.
    for (const [rule, want] of [
      ['FIXED_WORK', { a: [0.5, 32], b: [0.5, 32], dur: 8 }],
      ['FIXED_RATE', { a: [0.5, 32], b: [1, null], dur: 8 }],
    ] as const) {
      const f = await plasterBase(rule, 1, 3, true);
      S().updateAssignment(asg(f.id, f.res).id, { unitsPerDay: 0.5 });
      eq(`${rule}, twee resources, inzet van de eerste 1 -> 0,5`,
        { a: [asg(f.id, f.res).unitsPerDay, workH(asg(f.id, f.res))], b: [asg(f.id, f.res2).unitsPerDay, workH(asg(f.id, f.res2))], dur: dur(f.id) }, want);
      if (rule === 'FIXED_RATE') eq('Vaste inzet: de andere resource werkt 8 dagen x 1 x 8 uur = 64', dur(f.id) * asg(f.id, f.res2).unitsPerDay * 8, 64);
    }
  }

  // ── howto-urenverdeling-aanpassen: wat de inzet en de duur doen met een eigen verdeling ──
  console.log('-- docs-resources: urenverdeling --');
  const SLOTS = [240, 480, 480, 720]; // 4, 8, 8 en 12 uur = 32 uur
  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
  for (const [rule, load, total] of [
    ['FIXED_DURATION_RATE', [0.5, 1, 1, 1.5], 32],
    ['FIXED_DURATION_WORK', [1, 2, 2, 3], 64],
  ] as const) {
    const f = await plasterBase(rule);
    S().setAssignmentContour(asg(f.id).id, workDaySlotsToPeriods(SLOTS, byName(name('plaster')).splitGaps, 480) as never);
    S().runCPM();
    S().updateAssignment(asg(f.id).id, { unitsPerDay: 2 });
    S().runCPM();
    eq(`eigen verdeling, ${rule}, inzet 1 -> 2: duur 4 en dagbelasting`, [dur(f.id), dayLoad(f.id, f.res)], [4, load]);
    eq(`eigen verdeling, ${rule}, inzet 1 -> 2: totaal uren`, sum(dayLoad(f.id, f.res)) * 8, total);
  }
  {
    const f = await plasterBase('FIXED_WORK');
    S().setAssignmentContour(asg(f.id).id, workDaySlotsToPeriods(SLOTS, byName(name('plaster')).splitGaps, 480) as never);
    S().runCPM();
    S().updateAssignment(asg(f.id).id, { unitsPerDay: 2 });
    S().runCPM();
    eq('eigen verdeling, Vast werk, inzet 1 -> 2: 2 werkdagen, samengedrukt, 32 uur', [dur(f.id), dayLoad(f.id, f.res), sum(dayLoad(f.id, f.res)) * 8], [2, [1.5, 2.5], 32]);
  }
  for (const [rule, total] of [
    ['FIXED_DURATION_RATE', 64], ['FIXED_DURATION_WORK', 32], ['FIXED_WORK', 32], ['FIXED_RATE', 64],
  ] as const) {
    const f = await plasterBase(rule);
    S().setAssignmentContour(asg(f.id).id, workDaySlotsToPeriods(SLOTS, byName(name('plaster')).splitGaps, 480) as never);
    S().runCPM();
    const t = S().tasks.find(x => x.id === f.id)!;
    S().updateTask(f.id, { time: { ...t.time, scheduleDuration: 8 } });
    S().runCPM();
    eq(`eigen verdeling, ${rule}, duur 4 -> 8: totaal uren`, [dur(f.id), sum(dayLoad(f.id, f.res)) * 8], [8, total]);
  }

  // ── howto-resource-toewijzen: de curves ──
  console.log('-- docs-resources: curves --');
  eq('Klokvorm, inzet 1 over 6 dagen: 0,1,2,2,1,0', distributeUnits(1, 6, 'BELL'), [0, 1, 2, 2, 1, 0]);
  eq('Schildpad over 10 dagen bij inzet 1', distributeUnits(1, 10, 'TURTLE'), [0, 1, 1, 2, 2, 1, 1, 1, 1, 0]);
  eq('Schildpad = Vroege piek over 10 dagen bij inzet 1', distributeUnits(1, 10, 'TURTLE'), distributeUnits(1, 10, 'EARLY_PEAK'));
}

main().then(() => {
  if (diffs.length === 0) {
    console.log(`OK  docs-resources-voorbeelden: alle checks groen (${checks})`);
    process.exit(0);
  } else {
    console.log(`XX  docs-resources-voorbeelden: ${diffs.length} afwijking(en) van ${checks}`);
    for (const d of diffs) console.log(`   - ${d}`);
    process.exit(1);
  }
}, (err: unknown) => {
  console.log(`XX  docs-resources-voorbeelden: ${(err as Error).stack ?? String(err)}`);
  process.exit(1);
});
