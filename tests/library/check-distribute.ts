// check-distribute.ts — B1c-plan-2 taak 10: het sequentiële plaatsingsprotocol (spec §4/§9).
// Cases 1-15 volgen de spec-testlijst (§9, blok "Verdeler"). Poolitem P (capaciteit 2/dag) in
// bibliotheek c1; week ma 2026-08-03 t/m vr 2026-08-07 tenzij anders vermeld. Fixture-bouwstenen
// gekopieerd (niet geïmporteerd) uit `tests/library/check-occupancy.ts` en `check-ifc-hostile.ts` —
// stijl van deze suite.
//
// Draait via run.sh. Exit 0 = alles groen.
import { computeDistribution, type DistributionDocInput, type DistributionLevelRun } from '@/services/library/distribute';
import type { LevelingPoolLedger } from '@/engine/scheduler/ResourceLeveler';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { ImportResult } from '@/services/importTypes';
import type { CompanyPool } from '@/types/library';
import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

declare const process: { exit(code: number): never };

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

// ── Fixture-bouwstenen (kopie van check-occupancy.ts) ──────────────────────────────────────────────
function cal(id = 'cal-1'): WorkCalendar {
  return {
    id, name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
}
function poolRes(id: string, name: string, maxUnits: number, extra?: Partial<Resource>): Resource {
  return { id, name, type: 'LABOR', description: '', maxUnits, ...extra };
}
function stamped(id: string, libraryItemId: string, companyId = 'c1', extra?: Partial<Resource>): Resource {
  return {
    id, name: `kopie ${libraryItemId}`, type: 'LABOR', description: '', maxUnits: 99,
    libraryOrigin: { companyId, libraryItemId, poolVersion: 1 },
    ...extra,
  };
}
function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: durationDays,
      scheduleStart: earlyStart, scheduleFinish: earlyFinish,
      earlyStart, earlyFinish, lateStart: earlyStart, lateFinish: earlyFinish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}
function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve };
}
function pool(resources: Resource[]): CompanyPool {
  return {
    companyId: 'c1', companyName: 'Bibliotheek 1', poolVersion: 1,
    modifiedAt: '2026-08-14T00:00:00.000Z', calendars: [], resources,
  };
}

interface DistDocOpts {
  companyId?: string | null;
  rank?: number;
  pinned?: boolean;
  datesAsRecorded?: boolean;
  ceilingWorkdays?: number | null;
  resources?: Resource[];
  assignments?: ResourceAssignment[];
  tasks?: Task[];
  sequences?: Sequence[];
  calendar?: WorkCalendar;
  scheduleStale?: boolean;
  /** Forceert het vangnetpad (§4.3): geen `solveInput` meegeven ⇒ `counted: false` bij een stale
   *  document — case 14 (UNCOUNTED_DOCUMENT). */
  omitSolveInput?: boolean;
}
function distDoc(docId: string, opts: DistDocOpts = {}): DistributionDocInput {
  const calendar = opts.calendar ?? cal();
  const tasks = opts.tasks ?? [];
  const sequences = opts.sequences ?? [];
  return {
    docId, title: `Project ${docId}`,
    scheduleStale: opts.scheduleStale ?? false,
    companyId: opts.companyId === undefined ? 'c1' : opts.companyId,
    resources: opts.resources ?? [],
    assignments: opts.assignments ?? [],
    tasks,
    calendar,
    calendars: [],
    ...(opts.omitSolveInput ? {} : { solveInput: { tasks, sequences } }),
    rank: opts.rank ?? 1,
    pinned: opts.pinned ?? false,
    datesAsRecorded: opts.datesAsRecorded ?? false,
    ceilingWorkdays: opts.ceilingWorkdays ?? null,
    levelInput: { tasks, sequences },
  };
}
const OPTS_OFF = { allowSplits: false };

// ═══════════════════════════════════════════════════════════════════════════
// Case 1 (§9.1): float eerst — een document met float benut die en verschuift zijn EINDDATUM niet.
// d0 (gepind) bezet ma 08-03 volledig (2/2). d1 heeft twee onafhankelijke takken: Z (3 wd, geen
// resource, de kritieke tak) en A (2 wd, stamped op P) — A heeft dus 1 werkdag float t.o.v. Z. A kan
// niet op ma starten (P vol door d0), schuift naar di/wo (delay 1) — precies haar float, dus Z blijft
// de projecteinddatum bepalen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: float eerst, geen einddatum-kosten (case 1) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const taskZ = task('z', '2026-08-03', '2026-08-05', 3);
  const taskA = task('a', '2026-08-03', '2026-08-04', 2);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [taskZ, taskA],
    assignments: [assign('d1-a1', 'a', 'd1-r1', 1)],
  });
  const result = computeDistribution('c1', p, 'lib-1', [d0, d1], OPTS_OFF);
  assert(result.blocked === null, 'case 1: geen blokkade');
  const doc1 = result.docs.find(d => d.docId === 'd1')!;
  assert(doc1 !== undefined, 'case 1: d1 staat in het voorstel');
  assert(doc1.delays['a'] === 1, `case 1: A wijkt met precies 1 dag (kreeg ${JSON.stringify(doc1.delays)})`);
  assert(doc1.endShiftWorkdays === 0, `case 1: float wordt benut zonder einddatum-kosten (kreeg ${doc1.endShiftWorkdays})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 2 (§9.2): rangorde gerespecteerd — nr. 1 nivelleert alleen tegen de vaste last (ziet géén van
// de andere deelnemers), nr. 2 ziet nr. 1 wél. Twee documenten willen allebei de volle poolcapaciteit
// (2/dag) op dezelfde dag.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: rangorde gerespecteerd (case 2) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const mk = (id: string, rank: number) => distDoc(id, {
    rank,
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 2)],
  });
  const d1 = mk('d1', 1);
  const d2 = mk('d2', 2);
  const p2 = computeDistribution('c1', p, 'lib-1', [d1, d2], OPTS_OFF);
  assert(p2.docs.length === 2, 'case 2: twee deelnemers in het voorstel');
  assert(JSON.stringify(p2.docs[0].delays) === '{}', `case 2: nr. 1 blijft staan (kreeg ${JSON.stringify(p2.docs[0].delays)})`);
  assert(Object.keys(p2.docs[1].delays).length > 0, 'case 2: nr. 2 wijkt om nr. 1 heen');
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 3 (§9.3): uitschieter minimaal — dezelfde fixture met de rangorde omgedraaid toont dat de
// verdeling meebeweegt: de rangorde ÍS de fairness-knop (spec §4 stap 2).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: rangorde is de fairness-knop (case 3) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const mk = (id: string, rank: number) => distDoc(id, {
    rank,
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 2)],
  });
  const normal = computeDistribution('c1', p, 'lib-1', [mk('d1', 1), mk('d2', 2)], OPTS_OFF);
  const reversed = computeDistribution('c1', p, 'lib-1', [mk('d1', 2), mk('d2', 1)], OPTS_OFF);
  const wijktNormal = normal.docs.find(d => Object.keys(d.delays).length > 0)?.docId;
  const wijktReversed = reversed.docs.find(d => Object.keys(d.delays).length > 0)?.docId;
  assert(wijktNormal === 'd2', `case 3: bij normale rangorde wijkt d2 (kreeg ${wijktNormal})`);
  assert(wijktReversed === 'd1', `case 3: bij omgedraaide rangorde wijkt d1 (kreeg ${wijktReversed})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 4 (§9.4): plafonds hard — d1 (rank1, geen plafond) bezet 08-03+08-04 volledig; d2 (rank2, 1 wd,
// eigen deadline op ma ⇒ float 0, plafond 1) kan niet ver genoeg wijken ⇒ tekort. Reden is RESIDUAL_FULL
// (fixronde B1c-plan-2-etappe-2, bevinding 4, was CEILING_TOO_TIGHT): d2 se EIGEN projectinzet had op
// 08-03 nooit een probleem (RA se maxUnits is ruim) — elke afgewezen kandidaat liep uitsluitend vast op
// het GEDEELDE poolgrootboek dat d1 al volledig bezet houdt (`poolBlockedOnly`), dus de eerlijke reden
// wijst naar de pool, niet naar d2 se eigen (onschuldige) plafond van 1 werkdag. Zie case 4b hieronder
// voor het omgekeerde: een taak die WEL door haar eigen plafond geblokkeerd wordt (geen pool-conflict).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: plafonds zijn hard (case 4) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-04', 2)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 2)],
  });
  const d2 = distDoc('d2', {
    rank: 2, ceilingWorkdays: 1,
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('a2', '2026-08-03', '2026-08-03', 1, { deadline: '2026-08-03' })],
    assignments: [assign('d2-a1', 'a2', 'd2-r1', 2)],
  });
  const p4 = computeDistribution('c1', p, 'lib-1', [d1, d2], OPTS_OFF);
  assert(p4.docs[0].docId === 'd1' && p4.docs[0].shortfalls.length === 0, 'case 4: d1 (rank1) plaatst zonder tekort');
  assert(p4.docs[1].docId === 'd2', 'case 4: d2 staat op index 1');
  assert(p4.docs[1].shortfalls.length > 0, 'case 4: d2 houdt een tekort over');
  assert(
    p4.docs[1].shortfalls[0]?.reason === 'RESIDUAL_FULL',
    `case 4: reden is RESIDUAL_FULL — het is de pool, niet d2 se eigen plafond (kreeg ${p4.docs[1].shortfalls[0]?.reason})`,
  );
  assert(p4.hasShortfall === true, 'case 4: hasShortfall staat');
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 4b (fixronde B1c-plan-2-etappe-2, bevinding 4): het omgekeerde van case 4 — GEEN blokker op de
// pool (poolcapaciteit ruim, niemand anders boekt), maar d1 se EIGEN (krappe) projectinzet blokkeert
// A2, en met plafond 0 kan A2 ook geen dag uitwijken. Zelfde fixture als case 9 (min met de
// projectinzet), maar nu MET een plafond van 0 werkdagen — case 9 liet A2 nog gewoon 1 dag wijken;
// hier kán dat niet meer, dus wordt het een tekort. De afwijzing lag nooit aan de pool (die had de
// hele week ruimte), dus de eerlijke reden blijft CEILING_TOO_TIGHT.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: CEILING_TOO_TIGHT blijft bestaan zonder pool-blokkade (case 4b) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 5)]); // ruime pool, niemand anders boekt
  const d1 = distDoc('d1', {
    rank: 1, ceilingWorkdays: 0,
    resources: [stamped('d1-r1', 'lib-1', 'c1', { maxUnits: 1 })], // krappe PROJECTinzet
    tasks: [
      task('a1', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('a2', '2026-08-03', '2026-08-03', 1, { priority: 100, deadline: '2026-08-03' }),
    ],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1), assign('d1-a2', 'a2', 'd1-r1', 1)],
  });
  const p4b = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  const shortfallA2 = p4b.docs[0].shortfalls.find(s => s.taskId === 'a2');
  assert(
    shortfallA2?.reason === 'CEILING_TOO_TIGHT',
    `case 4b: zonder pool-blokkade blijft het eigen plafond de reden (kreeg ${shortfallA2?.reason})`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 5 (§9.5): het plafond meet vanaf de HUIDIGE (mét bestaande nivellering berekende) planning.
// X (buiten scope — geen bibliotheekstempel) draagt al `levelingDelay: 2` uit een eerdere
// nivellering elders in hetzelfde document; A (FS-opvolger van X, in scope) volgt X se VERSCHOVEN
// positie. Een pin blokkeert A se natuurlijke landingsdag; met plafond 0 (= float, geen ruimte) is
// dat een tekort, met plafond 1 past het precies.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: plafond t.o.v. de huidige (genivelleerde) planning (case 5) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-06', '2026-08-06', 1)], // do 08-06 volledig bezet
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const mkD1 = (ceilingWorkdays: number) => {
    const taskX = task('x', '2026-08-03', '2026-08-03', 1, { levelingDelay: 2 }); // ⇒ EF wordt 08-05
    const taskA = task('a', '2026-08-06', '2026-08-06', 1);
    const seq: Sequence = { id: 'seq-xa', predecessorId: 'x', successorId: 'a', type: 'FINISH_START', lagDays: 0 };
    return distDoc('d1', {
      rank: 1, ceilingWorkdays,
      resources: [stamped('d1-r1', 'lib-1')],
      tasks: [taskX, taskA],
      sequences: [seq],
      assignments: [assign('d1-a1', 'a', 'd1-r1', 2)],
    });
  };
  const p5a = computeDistribution('c1', p, 'lib-1', [d0, mkD1(0)], OPTS_OFF);
  const p5b = computeDistribution('c1', p, 'lib-1', [d0, mkD1(1)], OPTS_OFF);
  const doc5a = p5a.docs.find(d => d.docId === 'd1')!;
  const doc5b = p5b.docs.find(d => d.docId === 'd1')!;
  assert(doc5a.shortfalls.length > 0, 'case 5: plafond 0 (geen ruimte) ⇒ tekort');
  assert(doc5b.shortfalls.length === 0 && doc5b.delays['a'] === 1, `case 5: plafond 1 past precies (kreeg ${JSON.stringify(doc5b.delays)}, tekorten ${JSON.stringify(doc5b.shortfalls)})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 6 (§9.6): plafond onbereikbaar door een deadline die de lateStart ver vóór de PF duwt — eigen
// reden (CEILING_UNREACHABLE), spiegelt `check-leveler-ceiling.ts` geval 3.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: onbereikbaar plafond door een deadline (case 6) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1, ceilingWorkdays: 5,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [
      task('d', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('c', '2026-08-03', '2026-08-03', 1, { priority: 100, deadline: '2026-06-01' }),
    ],
    assignments: [assign('d1-a1', 'd', 'd1-r1', 2), assign('d1-a2', 'c', 'd1-r1', 2)],
  });
  const p6 = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  const doc6 = p6.docs[0];
  assert(doc6.delays['d'] === undefined, 'case 6: D (hoogste prioriteit) plaatst zonder delay');
  const shortfallC = doc6.shortfalls.find(s => s.taskId === 'c');
  assert(shortfallC?.reason === 'CEILING_UNREACHABLE', `case 6: onbereikbaar plafond ⇒ eigen reden (kreeg ${shortfallC?.reason})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 7 (§9.7): gepind document — volledig ongemoeid ÉN meegeteld als vaste last.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: gepind document (case 7) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const p7 = computeDistribution('c1', p, 'lib-1', [d0], OPTS_OFF);
  assert(p7.docs.length === 1, 'case 7: het gepinde document staat in het voorstel');
  assert(JSON.stringify(p7.docs[0].delays) === '{}', 'case 7: gepind document doet niet mee');
  assert(p7.docs[0].participated === false && p7.docs[0].pinnedReason === 'pin', 'case 7: pinnedReason is "pin"');
  assert((p7.fixedLoadByDay['2026-08-03'] ?? 0) > 0, `case 7: maar bezet het profiel wél (kreeg ${p7.fixedLoadByDay['2026-08-03']})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 8 (§9.8): priority-1000-document — alle taken vastgepind ⇒ "kan niet wijken".
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: document kan niet wijken (case 8) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  const d2 = distDoc('d2', {
    rank: 2,
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('a2', '2026-08-03', '2026-08-03', 1, { priority: 1000 })],
    assignments: [assign('d2-a1', 'a2', 'd2-r1', 1)],
  });
  const p8 = computeDistribution('c1', p, 'lib-1', [d1, d2], OPTS_OFF);
  assert(p8.docs[0].docId === 'd1' && p8.docs[0].cannotMove === false, 'case 8: d1 (rank1) is gewoon movable');
  assert(p8.docs[1].docId === 'd2', 'case 8: d2 staat op index 1');
  assert(p8.docs[1].cannotMove === true, `case 8: document kan niet wijken (kreeg ${p8.docs[1].cannotMove})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 9 (§9.9): `min` met de projectinzet — de PROJECTkopie heeft maxUnits 1, dus een tweede taak op
// dezelfde resource kan niet 2 boeken ook al is er poolrest over.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: min met de projectinzet (case 9) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1', 'c1', { maxUnits: 1 })],
    tasks: [
      task('a1', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('a2', '2026-08-03', '2026-08-03', 1, { priority: 100, deadline: '2026-08-03' }),
    ],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1), assign('d1-a2', 'a2', 'd1-r1', 1)],
  });
  const p9 = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  // De PROJECTinzet (RA se eigen maxUnits 1) blokkeert A2 op 08-03, ook al heeft de pool (2/dag)
  // daar nog volop rest — A2 wijkt dus gewoon één dag uit, ondanks de ruime poolrest. Geen enkele
  // afgewezen kandidaat faalde UITSLUITEND op de pool, dus een eventuele onopgeloste reden zou hier
  // nooit RESIDUAL_FULL mogen zijn (spiegelt `check-leveler-pool-ledger.ts` geval 2).
  assert(p9.docs[0].delays['a2'] === 1, `case 9: A2 wijkt om de eigen (krappere) projectinzet heen (kreeg ${JSON.stringify(p9.docs[0].delays)})`);
  const shortfallA2 = p9.docs[0].shortfalls.find(s => s.taskId === 'a2');
  assert(shortfallA2 === undefined || shortfallA2.reason !== 'RESIDUAL_FULL', 'case 9: nooit RESIDUAL_FULL — de pool zelf had ruimte');
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 10 (§9.10): dubbele stempel in één document — twee gestempelde resources trekken van HETZELFDE
// grootboek, geen dubbeltelling (spiegelt `check-leveler-pool-ledger.ts` geval 3, hier op
// verdelerniveau). Poolcapaciteit hier bewust 1 (niet de gedeelde default 2).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: gedeeld grootboek binnen één document (case 10) --');
{
  const p10pool = pool([poolRes('lib-1', 'Kraan', 1)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1'), stamped('d1-r2', 'lib-1')],
    tasks: [
      task('a', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('b', '2026-08-03', '2026-08-03', 1, { priority: 100 }),
    ],
    assignments: [assign('d1-a1', 'a', 'd1-r1', 1), assign('d1-a2', 'b', 'd1-r2', 1)],
  });
  const p10 = computeDistribution('c1', p10pool, 'lib-1', [d1], OPTS_OFF);
  assert(p10.docs[0].delays['a'] === undefined, 'case 10: A plaatst zonder delay (eerst in de rij)');
  assert(p10.docs[0].delays['b'] === 1, `case 10: gedeeld grootboek — B wijkt één dag (kreeg ${JSON.stringify(p10.docs[0].delays)})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 11 (§9.11): som ≠ oplossing — twee documenten met elk een plafond van 1 werkdag lijken
// samen "genoeg" speling te hebben, maar een blokker bezet de HELE relevante week volledig: geen van
// beide vindt ergens een slot ⇒ allebei een tekort, geen "opgelost"-shortcut op de som.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: som van plafonds ≠ oplossing (case 11) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    // Een volle week (5 wd) volledig bezet — ruim voorbij beide documenten se plafond van 1 wd.
    tasks: [task('x0', '2026-08-03', '2026-08-07', 5)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const mk = (id: string, rank: number) => distDoc(id, {
    rank, ceilingWorkdays: 1,
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1, { deadline: '2026-08-03' })],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 1)],
  });
  const p11 = computeDistribution('c1', p, 'lib-1', [d0, mk('d1', 1), mk('d2', 2)], OPTS_OFF);
  assert(p11.hasShortfall === true, 'case 11: hasShortfall staat');
  const part = p11.docs.filter(d => d.participated);
  assert(part.length === 2 && part.every(d => d.shortfalls.length > 0), 'case 11: BEIDE documenten houden een tekort — geen som-shortcut');
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 12 (§9.12): niet-plaatsbaar document ⇒ tekort geregistreerd, restprofiel blijft ≥ 0, GEEN
// cascade — het document ná het tekort krijgt exact dezelfde plaatsing als wanneer het tekortdocument
// er niet was. Poolcapaciteit hier bewust 1.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: tekort cascadeert niet (case 12) --');
{
  const p12pool = pool([poolRes('lib-1', 'Kraan', 1)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  // d2 vraagt STRUCTUREEL meer dan de poolcapaciteit ooit kan bieden (3 > 1, altijd) — intrinsiek
  // onoplosbaar, boekt dus NIETS in het grootboek.
  const d2 = distDoc('d2', {
    rank: 2,
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('a2', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d2-a1', 'a2', 'd2-r1', 3)],
  });
  const d3 = distDoc('d3', {
    rank: 3,
    resources: [stamped('d3-r1', 'lib-1')],
    tasks: [task('a3', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d3-a1', 'a3', 'd3-r1', 1)],
  });
  const withShortfallDoc = computeDistribution('c1', p12pool, 'lib-1', [d1, d2, d3], OPTS_OFF);
  const withoutShortfallDoc = computeDistribution('c1', p12pool, 'lib-1', [d1, d3], OPTS_OFF);

  const d2Result = withShortfallDoc.docs.find(d => d.docId === 'd2')!;
  assert(d2Result.shortfalls.length > 0, 'case 12: d2 (intrinsiek onoplosbaar) houdt een tekort');

  const d3With = withShortfallDoc.docs.find(d => d.docId === 'd3')!;
  const d3Without = withoutShortfallDoc.docs.find(d => d.docId === 'd3')!;
  assert(
    JSON.stringify(d3With.delays) === JSON.stringify(d3Without.delays),
    `case 12: geen cascade — d3 krijgt dezelfde plaatsing mét/zonder het tekortdocument (met: ${JSON.stringify(d3With.delays)}, zonder: ${JSON.stringify(d3Without.delays)})`,
  );
  assert(Object.keys(d3With.delays).length > 0, 'case 12 sanity: d3 wijkt daadwerkelijk (anders test dit niets)');
  for (const v of Object.values(withShortfallDoc.residualByDay)) {
    assert(v >= 0, `case 12: restprofiel blijft altijd >= 0 (kreeg ${v})`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 13 (§9.13): #63 ("datums zoals opgeslagen") is impliciet gepind, met een eigen label.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: #63 is impliciet gepind (case 13) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    datesAsRecorded: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 1)],
  });
  const p13 = computeDistribution('c1', p, 'lib-1', [d0], OPTS_OFF);
  assert(p13.docs[0]?.pinnedReason === 'dates-as-recorded', `case 13: #63 is impliciet gepind (kreeg ${p13.docs[0]?.pinnedReason})`);
  assert(JSON.stringify(p13.docs[0]?.delays) === '{}', 'case 13: #63-document wordt nooit beschreven');
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 14 (§9.14/§3.1): een UNCOUNTED document blokkeert de HELE actie met uitleg — geen stille
// uitsluiting. Stale document zonder solveInput ⇒ vangnetpad (counted: false).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: uncounted blokkeert de hele actie (case 14) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const staleDoc = distDoc('doc-stale', {
    scheduleStale: true, omitSolveInput: true,
    resources: [stamped('ds-r1', 'lib-1')],
    tasks: [task('ds-t1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('ds-a1', 'ds-t1', 'ds-r1', 1)],
  });
  const okDoc = distDoc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  const p14 = computeDistribution('c1', p, 'lib-1', [staleDoc, okDoc], OPTS_OFF);
  assert(p14.blocked?.reason === 'UNCOUNTED_DOCUMENT', `case 14: uncounted blokkeert (kreeg ${p14.blocked?.reason})`);
  assert(JSON.stringify(p14.blocked?.docIds) === JSON.stringify(['doc-stale']), `case 14: en noemt welk document (kreeg ${JSON.stringify(p14.blocked?.docIds)})`);
  assert(p14.docs.length === 0, 'case 14: en levert geen voorstel');
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 15 (§9.15): onderbreek-modus — met `allowSplits` schrijft het voorstel geldige `splitGaps`
// MÉT herkomstveld, en die komen door de OPS_TaskSplits-round-trip (writeIFC/readIFC) heen. Zelfde
// blokker/deadline/plafond-vorm als `check-leveler-splitmode.ts` geval 1 ("aan").
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: onderbreek-modus schrijft geldige splitGaps (case 15) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 1)]);
  const blocker = task('x0', '2026-08-03', '2026-08-05', 3, {
    priority: 900,
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }], // bezet ma+wo+do, di vrij
  });
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [blocker],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 1)],
  });
  const d1 = distDoc('d1', {
    rank: 1, ceilingWorkdays: 3,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('b', '2026-08-03', '2026-08-04', 2, { deadline: '2026-08-04' })],
    assignments: [assign('d1-a1', 'b', 'd1-r1', 1)],
  });
  const p15 = computeDistribution('c1', p, 'lib-1', [d0, d1], { allowSplits: true });
  const doc15 = p15.docs.find(d => d.docId === 'd1')!;
  const gaps = doc15.gaps['b'];
  assert(!!gaps && gaps.length === 1 && gaps[0].source === 'leveling', `case 15: het voorstel draagt precies één leveling-gat (kreeg ${JSON.stringify(gaps)})`);

  // Round-trip door de ECHTE OPS_TaskSplits-pset (writeIFC → readIFC), zelfde patroon als
  // `check-ifc-hostile.ts`s `minimalFixture`.
  const fixture: ImportResult = {
    project: createDefaultProject(),
    calendar: createDefaultCalendar(),
    tasks: [task('rt', '2026-08-03', '2026-08-04', 2, { splitGaps: gaps })],
    sequences: [], resources: [], assignments: [],
  };
  const back = readIFC(writeIFC(fixture));
  assert(
    JSON.stringify(back.tasks[0]?.splitGaps) === JSON.stringify(gaps),
    `case 15: het leveling-gat (incl. herkomstveld) overleeft de IFC-round-trip (kreeg ${JSON.stringify(back.tasks[0]?.splitGaps)}, verwacht ${JSON.stringify(gaps)})`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 16 (fixronde B1c-plan-2-etappe-2, bevinding 1) — repro van de keurder: twee documenten die elk
// 1 eenheid van een MATERIAL-poolitem met capaciteit 1 boeken op dezelfde dag. `levelResources`
// nivelleert `MATERIAL` nooit (spec §5.3, `renewable`-filter), dus zonder de `MATERIAL_ITEM`-poort
// kreeg elke scope-taak stilzwijgend `hasDemand === false`: een LEEG voorstel dat "opgelost" oogt
// (geen delays, geen tekorten), terwijl het bezettingsoverzicht gewoon een conflict toont.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: MATERIAL-poolitem blokkeert de hele actie (case 16, bevinding 1) --');
{
  const p = pool([poolRes('lib-mat', 'Beton', 1, { type: 'MATERIAL' })]);
  const mk = (id: string, rank: number) => distDoc(id, {
    rank,
    resources: [stamped(`${id}-r1`, 'lib-mat', 'c1', { type: 'MATERIAL' })],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 1)],
  });
  const p16 = computeDistribution('c1', p, 'lib-mat', [mk('d1', 1), mk('d2', 2)], OPTS_OFF);
  assert(p16.blocked?.reason === 'MATERIAL_ITEM', `case 16: MATERIAL-poolitem blokkeert (kreeg ${p16.blocked?.reason})`);
  assert(p16.docs.length === 0, 'case 16: en levert geen leeg "opgelost"-voorstel');
  assert(
    JSON.stringify([...(p16.blocked?.docIds ?? [])].sort()) === JSON.stringify(['d1', 'd2']),
    `case 16: noemt beide documenten die er al op boeken (kreeg ${JSON.stringify(p16.blocked?.docIds)})`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Case 17 (fixronde B1c-plan-2-etappe-2, bevinding 1, algemener deel): het poolitem zelf is LABOR
// (geen `MATERIAL_ITEM`-blokkade), maar de gestempelde PROJECTresource staat — inconsistent —  op
// MATERIAL. Dezelfde "geen enkele scope-taak heeft vraag"-situatie als case 16, nu zonder dat het
// poolitem het zelf verraadt: het algemenere `NO_DEMAND`-vangnet moet dit alsnog blokkeren i.p.v. een
// leeg "opgelost"-voorstel te tonen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: NO_DEMAND is het algemenere vangnet naast MATERIAL_ITEM (case 17, bevinding 1) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]); // poolitem zelf: gewoon LABOR
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1', 'c1', { type: 'MATERIAL' })], // inconsistente stempel
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  const p17 = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  assert(p17.blocked?.reason === 'NO_DEMAND', `case 17: algemener vangnet blokkeert (kreeg ${p17.blocked?.reason})`);
  assert(p17.docs.length === 0, 'case 17: en levert geen leeg "opgelost"-voorstel');
}

// ═══════════════════════════════════════════════════════════════════════════
// B1c-plan3 taak 1, bevinding 6: het grootboek boekt PER ITEM. `makeLedgerForDoc` negeerde `itemId`
// volledig (`residualOn: (_itemId, iso) => residualOn(iso)`). Dat was tot dusver correct omdat
// `poolItemOf` uitsluitend `libraryItemId` teruggeeft — maar het is een ONGESCHREVEN invariant, en
// een toekomstige verdeler over meerdere poolitems tegelijk zou stil alles op één hoop boeken. Deze
// case pint dat de sleutel gebruikt WORDT: de `runLeveling`-hook (dezelfde injecteerbare motor-rand
// als de rest van dit bestand) vangt de door `computeDistribution` gebouwde `poolLedger` op, zodat
// de test rechtstreeks tegen `book`/`residualOn` kan toetsen — `makeLedgerForDoc` zelf is niet
// geëxporteerd.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- distribute: het poolitem-grootboek boekt PER ITEM (bevinding 6) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  let capturedLedger: LevelingPoolLedger | undefined;
  const stubRun: DistributionLevelRun = (_doc, options) => {
    capturedLedger = options.poolLedger;
    return {
      delays: {}, unresolved: {}, unresolvedReasons: {}, shifts: {},
      projectEndBefore: '2026-08-03', projectEndAfter: '2026-08-03', gaps: {},
    };
  };
  computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF, stubRun);
  const l = capturedLedger!;
  assert(l !== undefined, 'bevinding 6: de motor-run kreeg een poolLedger mee');
  const before = l.residualOn('lib-1', '2026-08-03');
  l.book('een-ander-item', '2026-08-03', 99);
  assert(
    l.residualOn('lib-1', '2026-08-03') === before,
    'bevinding 6: een boeking op een ANDER itemId raakt dit poolitem niet',
  );
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (fails === 0) {
  console.log(`OK  distribute: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  distribute: ${fails} afwijking(en) van ${checks}`);
  process.exit(1);
}
