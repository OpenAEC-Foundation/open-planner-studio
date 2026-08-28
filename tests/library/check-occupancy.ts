// B1b-bezettingskern (spec 2026-08-14-b1b-bezettingsoverzicht-design.md §4/§6/§10). Headless
// batterij over de pure `computeLibraryOccupancy`: handgebouwde `OccupancyDocInput`-fixtures +
// een minimale `CompanyPool`. Exitcode is de poort (XX-regels tonen afwijkingen). Cases 1–13 dekken
// het VANGNETpad (§4.3): hun stale-fixtures dragen bewust géén `solveInput`, dus de default-solve
// geeft `null` terug en het document blijft zichtbaar-ongeteld. Cases 14–16 dekken de efemere solve
// van §4.3b (doorrekenen i.p.v. uitsluiten). Case 10 dekt daarnaast de
// `OccupancyDocBooking.dailyLoad`-uitbreiding (histogramvoeding, som-invariant).
//
// Cases 17–20 zijn de enige die de ECHTE Zustand-store aanraken (patroon: check-library-slice.ts /
// tests/planning/check-move-assignment.ts): het TERUGSCHRIJFBESLUIT van §4.3b woont in een
// store-actie (`recalculateStaleSleepingDocuments` in `documentSlice`) en die is alleen zinvol te
// testen tegen echte payloads in de documentregistry. Cases 1–16 blijven puur.
import { computeLibraryOccupancy, ephemeralSolve } from '@/services/library/occupancy';
import type { OccupancyDocInput, OccupancyEphemeralSolve } from '@/services/library/occupancy';
import { computeResourceLoad, maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { useAppStore } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { resolveLibrarySliceCache } from '@/components/panels/ResourceOccupancyView';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { DocumentPayload, RecoveryDocInput } from '@/state/documentContract';
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

// ── Fixture-bouwstenen ───────────────────────────────────────────────────────────────────────────
// Ma–vr-kalender; alle taken vallen in de week van ma 2026-08-03 t/m vr 2026-08-07.

function cal(id = 'cal-1'): WorkCalendar {
  return {
    id, name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
}

function poolRes(id: string, name: string, maxUnits: number, extra?: Partial<Resource>): Resource {
  return { id, name, type: 'LABOR', description: '', maxUnits, ...extra };
}

/** Projectkopie met herkomststempel naar `libraryItemId` in bibliotheek `companyId`. */
function stamped(id: string, libraryItemId: string, companyId = 'c1', extra?: Partial<Resource>): Resource {
  return {
    id, name: `kopie ${libraryItemId}`, type: 'LABOR', description: '', maxUnits: 99,
    libraryOrigin: { companyId, libraryItemId, poolVersion: 1 },
    ...extra,
  };
}

/** Leaf-taak met doorgerekende datums (earlyStart/earlyFinish sturen de dag-mapping). */
function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', scheduleDuration: durationDays,
      scheduleStart: earlyStart, scheduleFinish: earlyFinish,
      earlyStart, earlyFinish, lateStart: earlyStart, lateFinish: earlyFinish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  };
}

function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve };
}

/** Taak met een ANKER (scheduleStart) dat afwijkt van de opgeslagen — verouderde — early-datums:
 *  de efemere solve moet de early-datums op het anker herrekenen (§4.3b, case 14/16). */
function staleTask(id: string, anchor: string, staleStart: string, staleFinish: string, durationDays: number): Task {
  const t = task(id, staleStart, staleFinish, durationDays);
  t.time.scheduleStart = anchor;
  t.time.scheduleFinish = anchor;
  return t;
}

interface DocOpts {
  companyId?: string | null;
  scheduleStale?: boolean;
  resources?: Resource[];
  assignments?: ResourceAssignment[];
  tasks?: Task[];
  /** Zetten ⇒ het document draagt `solveInput` (§4.3b, de VOLLEDIGE takenlijst). Afwezig ⇒ géén
   *  solve-invoer, dus het vangnetpad van §4.3 — zo dekken cases 1–13 bewust het vangnetgedrag. */
  solveTasks?: Task[];
  solveSequences?: Sequence[];
}

function doc(docId: string, opts: DocOpts = {}): OccupancyDocInput {
  return {
    docId, title: `Project ${docId}`,
    scheduleStale: opts.scheduleStale ?? false,
    companyId: opts.companyId === undefined ? 'c1' : opts.companyId,
    resources: opts.resources ?? [],
    assignments: opts.assignments ?? [],
    tasks: opts.tasks ?? [],
    calendar: cal(),
    calendars: [],
    ...(opts.solveTasks !== undefined
      ? { solveInput: { tasks: opts.solveTasks, sequences: opts.solveSequences ?? [] } }
      : {}),
  };
}

function pool(resources: Resource[]): CompanyPool {
  return {
    companyId: 'c1', companyName: 'Bibliotheek 1', poolVersion: 1,
    modifiedAt: '2026-08-14T00:00:00.000Z', calendars: [], resources,
  };
}

// ── Case 1 (§10.1): twee documenten, overlappende dagen, som > maxUnits ──────────────────────────
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const mkDoc = (id: string) => doc(id, {
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-05', 3)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 1.5)],
  });
  const { rows, anyStale } = computeLibraryOccupancy('c1', p, [mkDoc('d1'), mkDoc('d2')]);

  assert(rows.length === 1, 'case 1: precies één rij (één geboekt poolitem)');
  const row = rows[0];
  assert(row.libraryItemId === 'lib-1' && row.name === 'Kraan', 'case 1: rij draagt poolitem-id en poolnaam');
  assert(row.docs.length === 2, 'case 1: beide documenten in docs');
  assert(
    JSON.stringify(row.conflictDays) === JSON.stringify(['2026-08-03', '2026-08-04', '2026-08-05']),
    `case 1: conflictDays = de drie overlapdagen, oplopend (kreeg ${JSON.stringify(row.conflictDays)})`,
  );
  assert(row.totalPeak === 3, `case 1: totalPeak = 1,5 + 1,5 = 3 (kreeg ${row.totalPeak})`);
  assert(row.capacityAtPeak === 2, `case 1: capacityAtPeak = maxUnits 2 (kreeg ${row.capacityAtPeak})`);
  const d1 = row.docs.find(d => d.docId === 'd1');
  assert(d1?.firstDay === '2026-08-03' && d1?.lastDay === '2026-08-05', 'case 1: per-document firstDay/lastDay = taakspanne');
  assert(d1?.peak === 1.5, `case 1: per-document peak = 1,5 (kreeg ${d1?.peak})`);
  assert(row.docs.every(d => d.counted === true), 'case 1: niet-stale boekingen zijn counted');
  assert(anyStale === false, 'case 1: geen stale documenten ⇒ anyStale false');
}

// ── Case 2 (§10.2): zelfde overlap maar som ≤ capaciteit; grens som == capaciteit is GEEN conflict ─
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const mkDoc = (id: string) => doc(id, {
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-05', 3)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 1)], // som = 2 == capaciteit
  });
  const { rows } = computeLibraryOccupancy('c1', p, [mkDoc('d1'), mkDoc('d2')]);

  assert(rows.length === 1 && rows[0].totalPeak === 2, 'case 2: rij bestaat met totalPeak 2');
  assert(rows[0].conflictDays.length === 0, `case 2: som == capaciteit ⇒ géén conflict (>, niet ≥; kreeg ${JSON.stringify(rows[0].conflictDays)})`);
}

// ── Case 3 (§10.3): availabilitySteps op het POOLitem — conflict alléén ná de capaciteitsdaling ──
{
  // Poolcapaciteit: 3 t/m 2026-08-04, daarna 1 (stap per 2026-08-05). Som over twee docs = 2/dag.
  const p = pool([poolRes('lib-1', 'Kraan', 3, { availabilitySteps: [{ from: '2026-08-05', maxUnits: 1 }] })]);
  const mkDoc = (id: string) => doc(id, {
    // Projectkopieën hebben bewust ruime eigen maxUnits (99): de capaciteit MOET van het poolitem komen.
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-07', 5)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 1)],
  });
  const { rows } = computeLibraryOccupancy('c1', p, [mkDoc('d1'), mkDoc('d2')]);

  assert(
    JSON.stringify(rows[0]?.conflictDays) === JSON.stringify(['2026-08-05', '2026-08-06', '2026-08-07']),
    `case 3: conflict alléén vanaf de availability-stap op het poolitem (kreeg ${JSON.stringify(rows[0]?.conflictDays)})`,
  );
  assert(rows[0]?.totalPeak === 2, 'case 3: totalPeak 2 over de hele spanne');
}

// ── Case 4 (§10.4): vreemde stempel en companyId:null dragen niets bij ───────────────────────────
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const vreemdeStempel = doc('d1', {
    // Document hangt aan c1, maar de resource is uit bibliotheek c2 gestempeld ⇒ telt niet.
    resources: [stamped('d1-r1', 'lib-1', 'c2')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 5)],
  });
  const losDocument = doc('d2', {
    // Document zonder bibliotheek (companyId null) ⇒ telt niet, óók niet via een geldige c1-stempel.
    companyId: null,
    resources: [stamped('d2-r1', 'lib-1', 'c1')],
    tasks: [task('d2-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d2-a1', 'd2-t1', 'd2-r1', 5)],
  });
  const { rows, anyStale } = computeLibraryOccupancy('c1', p, [vreemdeStempel, losDocument]);

  assert(rows.length === 0, `case 4: vreemde stempel + companyId:null ⇒ geen enkele rij (kreeg ${rows.length})`);
  assert(anyStale === false, 'case 4: niets telt mee ⇒ anyStale false');
}

// ── Case 5 (§10.5): wees (stempel naar verwijderd poolitem) ⇒ geen rij ───────────────────────────
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]); // 'lib-verwijderd' zit NIET (meer) in de pool
  const d1 = doc('d1', {
    resources: [stamped('d1-r1', 'lib-verwijderd')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 5)],
  });
  const { rows } = computeLibraryOccupancy('c1', p, [d1]);

  assert(rows.length === 0, `case 5: wees-stempel hoort bij geen enkel poolitem ⇒ geen rij (kreeg ${rows.length})`);
}

// ── Case 6 (§10.6): identieke naam, verschillende id's ⇒ twee losse rijen (id-matching) ──────────
{
  const p = pool([poolRes('lib-a', 'Timmerman', 2), poolRes('lib-b', 'Timmerman', 2)]);
  const d1 = doc('d1', {
    resources: [stamped('d1-r1', 'lib-a'), stamped('d1-r2', 'lib-b')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [
      assign('d1-a1', 'd1-t1', 'd1-r1', 1),
      assign('d1-a2', 'd1-t1', 'd1-r2', 2),
    ],
  });
  const { rows } = computeLibraryOccupancy('c1', p, [d1]);

  assert(rows.length === 2, `case 6: twee rijen ondanks identieke naam (kreeg ${rows.length})`);
  const a = rows.find(r => r.libraryItemId === 'lib-a');
  const b = rows.find(r => r.libraryItemId === 'lib-b');
  assert(a?.totalPeak === 1 && b?.totalPeak === 2, 'case 6: boekingen NIET samengevoegd op naam — elk poolitem houdt zijn eigen belasting');
}

// ── Case 7 (§10.7 herzien): stale telt NIET mee, maar de booking blijft zichtbaar ────────────────
{
  const p = pool([poolRes('lib-1', 'Kraan', 5)]);
  const vers = doc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 1)],
  });
  const stale = doc('d2', {
    scheduleStale: true,
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('d2-t1', '2026-08-04', '2026-08-06', 3)],
    assignments: [assign('d2-a1', 'd2-t1', 'd2-r1', 1)],
  });
  const { rows, anyStale } = computeLibraryOccupancy('c1', p, [vers, stale]);

  assert(rows.length === 1 && rows[0].docs.length === 2, 'case 7: beide documenten zichtbaar (stale als ongetelde booking)');
  assert(rows[0].totalPeak === 1, `case 7: totalPeak telt ALLEEN het verse document (1, niet 2; kreeg ${rows[0].totalPeak})`);
  const staleBooking = rows[0].docs.find(d => d.docId === 'd2');
  assert(staleBooking?.counted === false && staleBooking?.scheduleStale === true, 'case 7: stale booking is counted:false + scheduleStale:true');
  assert(
    staleBooking !== undefined && staleBooking.peak === 0 && staleBooking.firstDay === null &&
    staleBooking.lastDay === null && Object.keys(staleBooking.dailyLoad).length === 0,
    'case 7: stale booking draagt géén cijfers (dailyLoad {}, firstDay/lastDay null, peak 0)',
  );
  assert(rows[0].docs.find(d => d.docId === 'd1')?.counted === true, 'case 7: het verse document blijft gewoon geteld');
  assert(anyStale === true, 'case 7: anyStale staat door de ongetelde booking');
}

// ── Case 8 (§10.8): binnen-document-overbezetting verschijnt óók als conflict (§6 punt 2) ────────
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = doc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 3)], // één document boekt in z'n eentje 3 > 2
  });
  const { rows } = computeLibraryOccupancy('c1', p, [d1]);

  assert(rows.length === 1 && rows[0].docs.length === 1, 'case 8: één document, één rij');
  assert(
    JSON.stringify(rows[0].conflictDays) === JSON.stringify(['2026-08-03', '2026-08-04', '2026-08-05']),
    `case 8: binnen-document-overbezetting telt mee in de som (kreeg ${JSON.stringify(rows[0].conflictDays)})`,
  );
  assert(rows[0].totalPeak === 3 && rows[0].capacityAtPeak === 2, 'case 8: totalPeak 3 vs capaciteit 2');
}

// ── Case 9 (§10.9): curve-consistentie — FRONT_LOADED spiegelt computeResourceLoad exact ─────────
{
  const poolItem = poolRes('lib-1', 'Kraan', 2);
  const p = pool([poolItem]);
  const d1 = doc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-06', 4)],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 2, 'FRONT_LOADED')],
  });
  const { rows } = computeLibraryOccupancy('c1', p, [d1]);

  // Referentie: exact dezelfde engine-aanroep als de kern per document hoort te doen.
  const ref = computeResourceLoad(d1.resources, d1.assignments, d1.tasks, d1.calendar, d1.calendars);
  const refDaily = ref.load['d1-r1'];
  const refDays = Object.keys(refDaily).sort();
  const refPeak = Math.max(...refDays.map(iso => refDaily[iso]));
  const loadedDays = refDays.filter(iso => refDaily[iso] > 0);
  const refConflicts = refDays.filter(iso => refDaily[iso] > maxUnitsOn(poolItem, iso));

  const row = rows[0];
  assert(row !== undefined && row.docs.length === 1, 'case 9: één rij met één documentboeking');
  assert(row.totalPeak === refPeak, `case 9: totalPeak == max van computeResourceLoad (${refPeak}; kreeg ${row.totalPeak})`);
  assert(
    row.docs[0].firstDay === loadedDays[0] && row.docs[0].lastDay === loadedDays[loadedDays.length - 1],
    'case 9: firstDay/lastDay == eerste/laatste belaste dag volgens computeResourceLoad',
  );
  assert(row.docs[0].peak === refPeak, 'case 9: documentpiek == curve-piek van computeResourceLoad');
  assert(
    JSON.stringify(row.conflictDays) === JSON.stringify(refConflicts),
    `case 9: conflictDays == dagen waar de curve boven de poolcapaciteit komt (${JSON.stringify(refConflicts)}; kreeg ${JSON.stringify(row.conflictDays)})`,
  );
  // Sanity: de FRONT_LOADED-curve moet daadwerkelijk vooraan pieken (anders test dit niets).
  assert(refConflicts.length > 0 && refConflicts[0] === '2026-08-03', 'case 9 sanity: FRONT_LOADED piekt op de eerste dag boven capaciteit');
}

// ── Case 10: dailyLoad — som over documenten per dag == de kern-som; dagen binnen first..last ───
{
  const poolItem = poolRes('lib-1', 'Kraan', 2);
  const p = pool([poolItem]);
  const d1 = doc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-06', 4)],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 2, 'FRONT_LOADED')],
  });
  const d2 = doc('d2', {
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('d2-t1', '2026-08-04', '2026-08-07', 4)],
    assignments: [assign('d2-a1', 'd2-t1', 'd2-r1', 1)],
  });
  const { rows } = computeLibraryOccupancy('c1', p, [d1, d2]);
  const row = rows[0];

  // Referentie per document — dezelfde som-invariant als case 9, nu per dag over twee documenten.
  const refSum = new Map<string, number>();
  for (const d of [d1, d2]) {
    const ref = computeResourceLoad(d.resources, d.assignments, d.tasks, d.calendar, d.calendars);
    const daily = ref.load[d.resources[0].id];
    for (const [iso, units] of Object.entries(daily)) {
      if (units > 0) refSum.set(iso, (refSum.get(iso) ?? 0) + units);
    }
  }

  // 10a: som van dailyLoad over documenten per dag == de referentiesom van computeResourceLoad.
  const gotSum = new Map<string, number>();
  for (const booking of row.docs) {
    for (const [iso, units] of Object.entries(booking.dailyLoad)) {
      gotSum.set(iso, (gotSum.get(iso) ?? 0) + units);
    }
  }
  const toSorted = (m: Map<string, number>) => JSON.stringify([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  assert(
    toSorted(gotSum) === toSorted(refSum),
    `case 10: Σ dailyLoad over documenten per dag == computeResourceLoad-som (${toSorted(refSum)}; kreeg ${toSorted(gotSum)})`,
  );

  // 10b: dezelfde som draagt ook totalPeak/conflictDays (interne consistentie van de rij).
  const refPeak = Math.max(...refSum.values());
  const refConflicts = [...refSum.keys()].sort().filter(iso => refSum.get(iso)! > maxUnitsOn(poolItem, iso));
  assert(row.totalPeak === refPeak, `case 10: totalPeak == piek van de dailyLoad-som (${refPeak}; kreeg ${row.totalPeak})`);
  assert(
    JSON.stringify(row.conflictDays) === JSON.stringify(refConflicts),
    `case 10: conflictDays consistent met de dailyLoad-som (${JSON.stringify(refConflicts)}; kreeg ${JSON.stringify(row.conflictDays)})`,
  );

  // 10c: elke dailyLoad-dag valt binnen firstDay..lastDay van zijn eigen booking, en is > 0.
  for (const booking of row.docs) {
    const days = Object.keys(booking.dailyLoad).sort();
    assert(days.length > 0, `case 10: booking ${booking.docId} heeft dailyLoad-dagen`);
    assert(
      booking.firstDay !== null && booking.lastDay !== null &&
      days.every(iso => iso >= booking.firstDay! && iso <= booking.lastDay!),
      `case 10: dailyLoad-dagen van ${booking.docId} vallen binnen firstDay..lastDay`,
    );
    assert(days[0] === booking.firstDay && days[days.length - 1] === booking.lastDay,
      `case 10: firstDay/lastDay van ${booking.docId} zijn exact de rand-dagen van dailyLoad`);
    assert(
      Object.values(booking.dailyLoad).every(u => u > 0),
      `case 10: dailyLoad van ${booking.docId} bevat alleen dagen met belasting > 0`,
    );
  }
}

// ── Case 11 (§10.11): stale-uitsluiting maskeert geen conflict verkeerd-groen ────────────────────
{
  // 11a: een echt conflict (het niet-stale document boekt in z'n eentje boven capaciteit) blijft
  // staan, óók met een stale document ernaast.
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const overboekt = doc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 3)], // 3 > 2, zonder hulp van het stale document
  });
  const staleDoc = doc('d2', {
    scheduleStale: true,
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('d2-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d2-a1', 'd2-t1', 'd2-r1', 1)],
  });
  const a = computeLibraryOccupancy('c1', p, [overboekt, staleDoc]);
  assert(
    JSON.stringify(a.rows[0]?.conflictDays) === JSON.stringify(['2026-08-03', '2026-08-04', '2026-08-05']),
    `case 11a: conflict van het getelde document blijft staan naast een stale document (kreeg ${JSON.stringify(a.rows[0]?.conflictDays)})`,
  );
  assert(a.rows[0]?.totalPeak === 3, 'case 11a: totalPeak = alleen het getelde document (3)');
  assert(a.anyStale === true, 'case 11a: anyStale staat (ongetelde booking aanwezig)');

  // 11b: de som zou alléén mét het stale document boven capaciteit komen (1,5 + 1,5 > 2) ⇒ géén
  // conflictdag (geen verzonnen cijfers), wél anyStale + de ongetelde booking (de banner draagt
  // de waarschuwing).
  const binnenCapaciteit = doc('d3', {
    resources: [stamped('d3-r1', 'lib-1')],
    tasks: [task('d3-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d3-a1', 'd3-t1', 'd3-r1', 1.5)],
  });
  const staleAanvuller = doc('d4', {
    scheduleStale: true,
    resources: [stamped('d4-r1', 'lib-1')],
    tasks: [task('d4-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d4-a1', 'd4-t1', 'd4-r1', 1.5)],
  });
  const b = computeLibraryOccupancy('c1', p, [binnenCapaciteit, staleAanvuller]);
  assert(
    b.rows[0]?.conflictDays.length === 0,
    `case 11b: som alleen-mét-stale boven capaciteit ⇒ géén conflictdag (kreeg ${JSON.stringify(b.rows[0]?.conflictDays)})`,
  );
  assert(b.rows[0]?.totalPeak === 1.5, `case 11b: totalPeak = alleen het getelde document (1,5; kreeg ${b.rows[0]?.totalPeak})`);
  assert(b.anyStale === true, 'case 11b: anyStale staat wél — de banner draagt de waarschuwing');
  assert(
    b.rows[0]?.docs.some(d => d.docId === 'd4' && d.counted === false),
    'case 11b: de ongetelde booking van het stale document is zichtbaar',
  );
}

// ── Case 12 (§10.12): fantoomrij-triggers — 0 eenheden en ontbrekende datums (niet-stale) ───────
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);

  // 12a: niet-stale toewijzing met unitsPerDay 0 ⇒ geen booking, geen rij.
  const nulEenheden = doc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('d1-t1', '2026-08-03', '2026-08-05', 3)],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 0)],
  });
  const a = computeLibraryOccupancy('c1', p, [nulEenheden]);
  assert(a.rows.length === 0, `case 12a: unitsPerDay 0 (niet-stale) ⇒ geen booking en geen rij (kreeg ${a.rows.length})`);
  assert(a.anyStale === false, 'case 12a: geen ongetelde booking ⇒ anyStale false');

  // 12b: niet-stale document zonder doorgerekende datums (earlyStart '') ⇒ idem. Dit is precies
  // de val uit de critreview: ResourceLoad maakt de load-emmer al vóór de daglus aan, dus een
  // truthy leeg object mag geen boeking opleveren.
  const zonderDatums = doc('d2', {
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('d2-t1', '', '', 3)],
    assignments: [assign('d2-a1', 'd2-t1', 'd2-r1', 2)],
  });
  const b = computeLibraryOccupancy('c1', p, [zonderDatums]);
  assert(b.rows.length === 0, `case 12b: earlyStart '' zonder stale-vlag ⇒ geen booking en geen rij (kreeg ${b.rows.length})`);
  assert(b.anyStale === false, 'case 12b: geen ongetelde booking ⇒ anyStale false');
}

// ── Case 13 (§10.13): stale zonder bruikbare datums ⇒ tóch zichtbaar als ongetelde booking ──────
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const staleZonderDatums = doc('d1', {
    scheduleStale: true,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('d1-t1', '', '', 3)], // geen bruikbare datums — niets verdwijnt stil
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 2)],
  });
  const { rows, anyStale } = computeLibraryOccupancy('c1', p, [staleZonderDatums]);

  assert(rows.length === 1, `case 13: stale met toewijzingen op het poolitem ⇒ wél een rij (kreeg ${rows.length})`);
  const booking = rows[0]?.docs[0];
  assert(rows[0]?.docs.length === 1 && booking?.counted === false, 'case 13: één zichtbare ongetelde booking');
  assert(
    booking !== undefined && booking.peak === 0 && booking.firstDay === null && booking.lastDay === null &&
    Object.keys(booking.dailyLoad).length === 0,
    'case 13: de ongetelde booking draagt géén cijfers',
  );
  assert(rows[0]?.totalPeak === 0 && rows[0]?.conflictDays.length === 0, 'case 13: geen getelde belasting ⇒ totalPeak 0, geen conflictdagen');
  assert(anyStale === true, 'case 13: anyStale staat door de zichtbare ongetelde booking');
}

// ── Case 14 (§10.14): efemere solve — stale mét solve-invoer telt mee met VERSE cijfers ─────────
{
  const poolItem = poolRes('lib-1', 'Kraan', 2);
  const p = pool([poolItem]);
  // Het document is stale: de opgeslagen early-datums (2026-08-10..12) zijn verouderd, het anker
  // staat op 2026-08-03. Zonder efemere solve zou de belasting in de week van de 10e landen (of
  // helemaal wegvallen); mét solve hoort ze op 03..05 te staan.
  const staleTasks = [staleTask('t1', '2026-08-03', '2026-08-10', '2026-08-12', 3)];
  const d1 = doc('d1', {
    scheduleStale: true,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: staleTasks,
    assignments: [assign('d1-a1', 't1', 'd1-r1', 1.5)],
    solveTasks: staleTasks,
  });
  // De injectie is hier expliciet de ECHTE kern (dezelfde die de default gebruikt) — dat is precies
  // het punt van §4.3b: pariteit by construction, geen tweede implementatie.
  const { rows, anyStale } = computeLibraryOccupancy('c1', p, [d1], ephemeralSolve);

  // Referentie: dezelfde invoer vers doorgerekend (solveProject == de kern van runCPM) en dan door
  // computeResourceLoad — precies wat F5-in-het-document + het projecthistogram zouden opleveren.
  const refTasks = cloneTasksForSolve(staleTasks);
  const refResult = solveProject({ tasks: refTasks, sequences: [], calendar: cal(), calendars: [] });
  const refLoad = computeResourceLoad(d1.resources, d1.assignments, refTasks, cal(), []);
  const refDaily = refLoad.load['d1-r1'];
  const refDays = Object.keys(refDaily).filter(iso => refDaily[iso] > 0).sort();

  assert(refResult.error === undefined, 'case 14 sanity: de referentie-solve slaagt');
  assert(refDays.length > 0 && refDays[0] === '2026-08-03',
    `case 14 sanity: de verse planning landt op het anker, niet op de verouderde datums (kreeg ${JSON.stringify(refDays)})`);

  const row = rows[0];
  const booking = row?.docs[0];
  assert(rows.length === 1 && row?.docs.length === 1, `case 14: één rij met één booking (kreeg ${rows.length} rijen)`);
  assert(booking?.counted === true, 'case 14: efemeer doorgerekend ⇒ counted true');
  assert(booking?.scheduleStale === true, 'case 14: scheduleStale blijft true (informatieve ⚠)');
  assert(anyStale === true, 'case 14: anyStale staat — er zit een stale document in het overzicht');
  assert(
    JSON.stringify(booking?.dailyLoad) === JSON.stringify(Object.fromEntries(refDays.map(iso => [iso, refDaily[iso]]))),
    `case 14: dailyLoad exact gelijk aan de vers doorgerekende invoer (${JSON.stringify(refDaily)}; kreeg ${JSON.stringify(booking?.dailyLoad)})`,
  );
  assert(booking?.firstDay === refDays[0] && booking?.lastDay === refDays[refDays.length - 1],
    `case 14: firstDay/lastDay volgen de verse planning (kreeg ${booking?.firstDay}..${booking?.lastDay})`);
  assert(booking?.peak === Math.max(...refDays.map(iso => refDaily[iso])), `case 14: peak == verse curve-piek (kreeg ${booking?.peak})`);
  assert(row?.totalPeak === 1.5 && row?.capacityAtPeak === 2, `case 14: het document telt mee in de som (totalPeak ${row?.totalPeak})`);
  assert(
    Object.keys(booking?.dailyLoad ?? {}).every(iso => iso < '2026-08-10'),
    'case 14: er wordt NIET op de verouderde datums gerekend',
  );
}

// ── Case 15 (§10.15): efemere solve faalt (gooit of geeft null) ⇒ vangnetgedrag ─────────────────
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const staleTasks = [staleTask('t1', '2026-08-03', '2026-08-10', '2026-08-12', 3)];
  const mkDoc = () => doc('d1', {
    scheduleStale: true,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: staleTasks,
    assignments: [assign('d1-a1', 't1', 'd1-r1', 1.5)],
    solveTasks: staleTasks,
  });

  // 15a: de injectie gooit (staat voor een onverwachte solverfout) — een leesvenster mag daar nooit
  // op omvallen.
  const throwing: OccupancyEphemeralSolve = () => { throw new Error('cyclus'); };
  const a = computeLibraryOccupancy('c1', p, [mkDoc()], throwing);
  assert(a.rows.length === 1 && a.rows[0].docs.length === 1, `case 15a: de booking blijft zichtbaar (kreeg ${a.rows.length} rijen)`);
  assert(a.rows[0].docs[0].counted === false, 'case 15a: gefaalde solve ⇒ vangnet, counted false');
  assert(
    a.rows[0].docs[0].peak === 0 && a.rows[0].docs[0].firstDay === null &&
    a.rows[0].docs[0].lastDay === null && Object.keys(a.rows[0].docs[0].dailyLoad).length === 0,
    'case 15a: de ongetelde booking draagt géén cijfers',
  );
  assert(a.rows[0].totalPeak === 0 && a.rows[0].conflictDays.length === 0, 'case 15a: geen getelde belasting ⇒ geen som, geen conflictdagen');
  assert(a.anyStale === true, 'case 15a: anyStale staat');

  // 15b: de injectie geeft null (de echte `ephemeralSolve` doet dit bij een error-resultaat, bijv.
  // een relatiecyclus) — zelfde uitkomst.
  const nullSolve: OccupancyEphemeralSolve = () => null;
  const b = computeLibraryOccupancy('c1', p, [mkDoc()], nullSolve);
  assert(b.rows.length === 1 && b.rows[0].docs[0].counted === false && b.anyStale === true,
    'case 15b: null-resultaat ⇒ zelfde vangnetgedrag als een exception');

  // 15c: een ECHTE cyclus door de echte kern — bewijst dat `ephemeralSolve` een error-resultaat als
  // mislukking behandelt in plaats van halve datums door te laten.
  const cycTasks = [
    staleTask('t1', '2026-08-03', '2026-08-10', '2026-08-12', 3),
    staleTask('t2', '2026-08-03', '2026-08-10', '2026-08-12', 3),
  ];
  const cycSeqs: Sequence[] = [
    { id: 's1', predecessorId: 't1', successorId: 't2', type: 'FINISH_START', lagDays: 0 },
    { id: 's2', predecessorId: 't2', successorId: 't1', type: 'FINISH_START', lagDays: 0 },
  ];
  const cyclisch = doc('d1', {
    scheduleStale: true,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: cycTasks,
    assignments: [assign('d1-a1', 't1', 'd1-r1', 1.5)],
    solveTasks: cycTasks,
    solveSequences: cycSeqs,
  });
  const c = computeLibraryOccupancy('c1', p, [cyclisch]); // default = de echte ephemeralSolve
  assert(
    c.rows.length === 1 && c.rows[0].docs.length === 1 && c.rows[0].docs[0].counted === false && c.anyStale === true,
    'case 15c: een echte relatiecyclus valt via ephemeralSolve op het vangnet terug',
  );
}

// ── Case 16 (§10.16): de efemere solve muteert zijn invoer niet ─────────────────────────────────
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const staleTasks = [
    staleTask('t1', '2026-08-03', '2026-08-10', '2026-08-12', 3),
    // Verzameltaak erboven: `applyCpmResult` doet de rollup op de PARENT, dus die moet ook
    // ongemoeid blijven — precies het veld dat een ondiepe kloon zou laten lekken.
    { ...task('p1', '2026-08-10', '2026-08-12', 3), childIds: ['t1'] },
  ];
  staleTasks[0].parentId = 'p1';
  const d1 = doc('d1', {
    scheduleStale: true,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: staleTasks,
    assignments: [assign('d1-a1', 't1', 'd1-r1', 1.5)],
    solveTasks: staleTasks,
  });
  const before = JSON.stringify(staleTasks);
  const { rows } = computeLibraryOccupancy('c1', p, [d1]);
  const after = JSON.stringify(staleTasks);

  assert(before === after, 'case 16: de payload-taken zijn ná de aanroep byte-gelijk aan ervoor');
  // Sanity: er is daadwerkelijk gerekend (anders bewijst de gelijkheid niets).
  assert(
    rows.length === 1 && rows[0].docs[0].counted === true && rows[0].docs[0].firstDay === '2026-08-03',
    `case 16 sanity: de solve is écht gedraaid (kreeg counted ${rows[0]?.docs[0]?.counted}, firstDay ${rows[0]?.docs[0]?.firstDay})`,
  );
}

// ══ Terugschrijven mét "Automatisch berekenen" (§4.3b, tweede ronde) ════════════════════════════
// `recalculateStaleSleepingDocuments()` in `documentSlice`: elk NIET-actief document met een
// verouderde planning wordt écht doorgerekend en teruggeschreven (taken/`cpmResult`/
// `scheduleStale: false`/`resourceLoadResult: null`), zónder undo-snapshot en zónder `isDirty` te
// raken. Tegen de echte store, want het gaat precies om de payloads in de documentregistry.

const S = () => useAppStore.getState();
/** De (slapende) payload van document `id` uit de registry. */
const sleeping = (id: string): DocumentPayload | null => S().documents.find(d => d.id === id)?.payload ?? null;

// ── Case 17: een stale SLAPENDE payload wordt echt bijgewerkt (en de actie meldt er precies één) ──
let parkedId = '';
let afterPayload: DocumentPayload | null = null;
{
  // Bouw het document met ECHTE store-acties, zodat de payload ook een echte undo-historie krijgt en
  // de stale-vlag op de gewone manier gezet is (addTask/addSequence ⇒ finishMutation({stale: true})).
  const t1 = S().addTask({ name: 'A1' });
  const t2 = S().addTask({ name: 'A2' });
  const seqId = S().addSequence({ predecessorId: t1, successorId: t2, type: 'FINISH_START', lagDays: 0 });
  assert(seqId !== null, 'case 17 setup: de FS-relatie is geaccepteerd');
  assert(S().scheduleStale === true, 'case 17 setup: de bewerkingen zetten scheduleStale');

  parkedId = S().activeDocumentId;
  S().newDocument(); // parkeert het bewerkte document als slapende payload en maakt een leeg tabblad actief.

  const before = sleeping(parkedId);
  assert(before !== null && before.scheduleStale === true, 'case 17 setup: de geparkeerde payload is stale');
  const undoBefore = JSON.stringify(before?.undoStack);
  const dirtyBefore = before?.isDirty;
  assert((before?.undoStack.length ?? 0) > 0, 'case 17 setup: de geparkeerde payload draagt een undo-historie');
  const startBefore = before?.tasks.map(t => t.time.earlyStart) ?? [];
  assert(
    startBefore.length === 2 && startBefore[0] === startBefore[1],
    `case 17 setup: vóór de doorrekening starten beide taken op dezelfde dag (kreeg ${JSON.stringify(startBefore)})`,
  );

  const n = S().recalculateStaleSleepingDocuments();
  assert(n === 1, `case 17: precies één document bijgewerkt (kreeg ${n})`);

  afterPayload = sleeping(parkedId);
  assert(afterPayload?.scheduleStale === false, 'case 17: scheduleStale staat op false');
  assert(afterPayload?.cpmResult !== null && afterPayload?.cpmResult?.error === undefined, 'case 17: cpmResult is gezet en foutloos');
  assert(afterPayload?.resourceLoadResult === null, 'case 17: resourceLoadResult is genuld (switchDocument herrekent hem toch)');
  const a1 = afterPayload?.tasks.find(t => t.id === t1);
  const a2 = afterPayload?.tasks.find(t => t.id === t2);
  assert(
    !!a1?.time.earlyStart && !!a1?.time.earlyFinish && !!a2?.time.earlyStart,
    'case 17: de taken dragen doorgerekende datums',
  );
  assert(
    !!a1 && !!a2 && a2.time.earlyStart > a1.time.earlyFinish,
    `case 17: de FS-relatie is écht doorgerekend (A2 start ná A1 klaar; kreeg ${a1?.time.earlyFinish} → ${a2?.time.earlyStart})`,
  );
  // Semantiek spiegelt runCPM: geen undo-snapshot, isDirty ongemoeid.
  assert(JSON.stringify(afterPayload?.undoStack) === undoBefore, 'case 17: de undo-stack van de payload is ongewijzigd');
  assert(afterPayload?.redoStack.length === 0, 'case 17: de redo-stack blijft leeg (geen bewerking)');
  assert(afterPayload?.isDirty === dirtyBefore, 'case 17: isDirty is ongemoeid');
}

// ── Case 18: no-op voor niet-stale payloads (zelfs de payload-REFERENTIE blijft staan) ───────────
{
  const n = S().recalculateStaleSleepingDocuments();
  assert(n === 0, `case 18: niets stale ⇒ 0 bijgewerkte documenten (kreeg ${n})`);
  assert(sleeping(parkedId) === afterPayload, 'case 18: de payload-referentie is niet vervangen (geen store-mutatie)');
}

// ── Cases 19/20: een relatiecyclus blijft onaangeraakt, de rest wordt gewoon bijgewerkt ─────────
{
  // `restoreDocuments` is het enige pad dat een SLAPENDE payload met een cyclische relatiegraaf kan
  // opleveren (addSequence weigert dat via relationRules): precies het crashherstel-geval, waar elke
  // niet-actieve payload per definitie `scheduleStale: true` draagt.
  const recoveryDoc = (id: string, tasks: Task[], sequences: Sequence[]): RecoveryDocInput => ({
    id, filePath: null, isDirty: false,
    project: { ...createDefaultProject(), name: id },
    calendar: createDefaultCalendar(),
    tasks, sequences, resources: [], assignments: [],
  });
  const cycTasks = [task('c1', '2026-08-03', '2026-08-05', 3), task('c2', '2026-08-03', '2026-08-05', 3)];
  const cycSeqs: Sequence[] = [
    { id: 'cs1', predecessorId: 'c1', successorId: 'c2', type: 'FINISH_START', lagDays: 0 },
    { id: 'cs2', predecessorId: 'c2', successorId: 'c1', type: 'FINISH_START', lagDays: 0 },
  ];
  const okTasks = [task('o1', '2026-08-03', '2026-08-05', 3), task('o2', '2026-08-03', '2026-08-05', 3)];
  const okSeqs: Sequence[] = [
    { id: 'os1', predecessorId: 'o1', successorId: 'o2', type: 'FINISH_START', lagDays: 0 },
  ];
  S().restoreDocuments([
    recoveryDoc('doc-actief', [task('x1', '2026-08-03', '2026-08-05', 3)], []),
    recoveryDoc('doc-cyclus', cycTasks, cycSeqs),
    recoveryDoc('doc-gezond', okTasks, okSeqs),
  ], 'doc-actief');

  const cycBefore = sleeping('doc-cyclus');
  const cycBeforeJson = JSON.stringify(cycBefore);
  assert(cycBefore?.scheduleStale === true && sleeping('doc-gezond')?.scheduleStale === true,
    'case 19 setup: beide slapende payloads zijn stale (crashherstel)');

  const n = S().recalculateStaleSleepingDocuments();
  assert(n === 1, `case 19: alleen het gezonde document telt mee in de uitkomst (kreeg ${n})`);

  // 19: de cyclus-payload is volledig onaangeraakt — zelfde referentie én byte-gelijk.
  assert(sleeping('doc-cyclus') === cycBefore, 'case 19: de payload-referentie van het cyclische document is niet vervangen');
  assert(JSON.stringify(sleeping('doc-cyclus')) === cycBeforeJson, 'case 19: de cyclus-payload is byte-gelijk aan ervoor');
  assert(sleeping('doc-cyclus')?.scheduleStale === true, 'case 19: het cyclische document blijft stale (vangnet §4.3 blijft gelden)');
  assert(sleeping('doc-cyclus')?.cpmResult === null, 'case 19: er is geen (fout-)cpmResult in de cyclus-payload geschreven');

  // 20: het gezonde document ernaast is wél doorgerekend — één falend document blokkeert de rest niet.
  const okAfter = sleeping('doc-gezond');
  assert(okAfter?.scheduleStale === false, 'case 20: het gezonde document is bijgewerkt');
  assert(okAfter?.cpmResult?.error === undefined, 'case 20: foutloos cpmResult');
  const o1 = okAfter?.tasks.find(t => t.id === 'o1');
  const o2 = okAfter?.tasks.find(t => t.id === 'o2');
  assert(!!o1 && !!o2 && o2.time.earlyStart > o1.time.earlyFinish, 'case 20: de relatie is doorgerekend (o2 ná o1)');
  assert(okAfter?.undoStack.length === 0 && okAfter?.isDirty === false, 'case 20: geen undo-snapshot, isDirty ongemoeid');
}

// ── Case 21: de viewslicecache isoleert company en pool expliciet ──────────────────────────
// Dezelfde payload-referentie wordt bewust in drie contexten aangeboden. Een cache die alleen op
// payload is gesleuteld zou bij de company- of poolwissel de eerste snit hergebruiken en daarmee
// boekingen uit de vorige bibliotheek tonen.
{
  const base = capturePayload(S());
  const sharedPayload: DocumentPayload = {
    ...base,
    project: { ...base.project, companyId: 'c1', companyName: 'Bibliotheek 1' },
    resources: [
      stamped('project-c1', 'lib-c1', 'c1'),
      stamped('project-c2', 'lib-c2', 'c2'),
    ],
    tasks: [task('cache-task-c1', '2026-08-03', '2026-08-05', 3), task('cache-task-c2', '2026-08-03', '2026-08-05', 3)],
    assignments: [
      assign('cache-a-c1', 'cache-task-c1', 'project-c1', 1),
      assign('cache-a-c2', 'cache-task-c2', 'project-c2', 1),
    ],
  };
  const c1Pool = pool([poolRes('lib-c1', 'Kraan C1', 2)]);
  const c2Pool: CompanyPool = {
    ...pool([poolRes('lib-c2', 'Kraan C2', 2)]),
    companyId: 'c2',
    companyName: 'Bibliotheek 2',
  };

  const first = resolveLibrarySliceCache(undefined, sharedPayload, 'c1', c1Pool);
  const same = resolveLibrarySliceCache(first.cache, sharedPayload, 'c1', c1Pool);
  assert(same.cache === first.cache && same.slice === first.slice,
    'case 21: dezelfde company/pool/payload-combinatie hergebruikt de bestaande snit');
  assert(first.slice.resources.map(r => r.id).join(',') === 'project-c1',
    'case 21 setup: de eerste snit bevat uitsluitend de c1-resource');

  const switchedCompany = resolveLibrarySliceCache(first.cache, sharedPayload, 'c2', c2Pool);
  assert(switchedCompany.cache !== first.cache,
    'case 21: een companywissel maakt een nieuw expliciet cacherecord');
  assert(switchedCompany.slice.resources.map(r => r.id).join(',') === 'project-c2',
    'case 21: de companywissel gebruikt niet de c1-snit uit de vorige context');

  const changedPool: CompanyPool = {
    ...c1Pool,
    poolVersion: c1Pool.poolVersion + 1,
    resources: [poolRes('lib-anders', 'Andere kraan', 2)],
  };
  const switchedPool = resolveLibrarySliceCache(first.cache, sharedPayload, 'c1', changedPool);
  assert(switchedPool.cache !== first.cache && switchedPool.slice.resources.length === 0,
    'case 21: een nieuwe poolreferentie kan geen slice uit de vorige pool hergebruiken');
}

// ── Case 22 (B1c-W0.1): splitGaps — dailyLoad bevat de pauzedagen NIET, de werkdagen wél ─────────
// Zelfde referentiegaten als `check-split-walk.ts`/`check-resource-load-splits.ts`: taak van 3
// werkdagen met twee gaten van 1 werkdag na resp. dag 1 en aspositie 1440 ⇒ de taak werkt op de
// 1e/3e/5e kalenderdag van de spanne, niet op de 2e/4e (pauzedagen). Dit dekt dat de bezettingskern
// (via `computeResourceLoad`) de W0.1-fix meekrijgt, niet alleen de directe aanroepers.
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const splitTask: Task = {
    ...task('d1-t1', '2026-08-03', '2026-08-07', 3),
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  };
  const d1 = doc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [splitTask],
    assignments: [assign('d1-a1', 'd1-t1', 'd1-r1', 1)],
  });
  const { rows } = computeLibraryOccupancy('c1', p, [d1]);
  const booking = rows[0]?.docs[0];

  assert(rows.length === 1 && booking !== undefined, 'case 22: de gesplitste taak levert een rij en een booking op');
  assert(
    booking !== undefined &&
      Object.keys(booking.dailyLoad).sort().join(',') === ['2026-08-03', '2026-08-05', '2026-08-07'].join(','),
    `case 22: dailyLoad bevat alleen de werkdagen 08-03/08-05/08-07 (kreeg ${JSON.stringify(Object.keys(booking?.dailyLoad ?? {}).sort())})`,
  );
  assert(
    booking !== undefined && booking.dailyLoad['2026-08-04'] === undefined && booking.dailyLoad['2026-08-06'] === undefined,
    'case 22: de pauzedagen 08-04/08-06 dragen géén last',
  );
  assert(
    booking !== undefined && booking.dailyLoad['2026-08-03'] === 1 && booking.dailyLoad['2026-08-05'] === 1 && booking.dailyLoad['2026-08-07'] === 1,
    'case 22: elke werkdag draagt de volle 1 eenheid (UNIFORM-curve)',
  );
}

console.log(`occupancy: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
