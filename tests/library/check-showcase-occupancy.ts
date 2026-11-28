import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useAppStore } from '@/state/appStore';
import { applyDemoLibraryToShowcaseProject } from '@/state/demoLibraryShowcase';
import { capturePayload } from '@/state/documentContract';
import { DEMO_COMPANY_ID } from '@/services/library/demoLibrary';
import { computeLibraryOccupancy } from '@/services/library/occupancy';
import type { OccupancyDocInput } from '@/services/library/occupancy';
import { computeDistribution } from '@/services/library/distribute';
import type { DistributionDocInput } from '@/services/library/distribute';
import { assignmentDayUnits, contourLookup, maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { enumerateWorkDays } from '@/engine/scheduler/ResourceLoad';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';

declare const process: { exit(code: number): never; cwd(): string };

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

const SLUGS = [
  'showcase-verbouwing-eengezinswoning',
  'showcase-rijwoningen-de-akkers',
  'showcase-appartementencomplex',
];

const CONFLICT_ITEM = 'Masonry crew';

const S = () => useAppStore.getState();
const EX_DIR = join(process.cwd(), 'public', 'examples');

for (const [i, slug] of SLUGS.entries()) {
  if (i > 0) S().newDocument();
  await S().openExampleFromString(readFileSync(join(EX_DIR, `${slug}.ifc`), 'utf8'), slug);
  applyDemoLibraryToShowcaseProject();
  S().runCPM();
}

const state = S();
const pool = state.pools[DEMO_COMPANY_ID];
assert(!!pool, 'demo-bibliotheek geseed (pool aanwezig)');
assert(state.documents.length === SLUGS.length, `drie showcase-documenten open (heeft: ${state.documents.length})`);

const payloads = state.documents.map((d) => ({
  docId: d.id,
  payload: d.id === state.activeDocumentId ? capturePayload(state) : d.payload!,
}));

for (const { payload } of payloads) {
  assert(payload.project.companyId === DEMO_COMPANY_ID,
    `"${payload.project.name}" is aan de demo-bibliotheek gebonden`);
}

const inputs: OccupancyDocInput[] = payloads.map(({ docId, payload }) => ({
  docId,
  title: payload.project.name,
  scheduleStale: payload.scheduleStale,
  companyId: payload.project.companyId ?? null,
  resources: payload.resources,
  assignments: payload.assignments,
  tasks: payload.tasks,
  calendar: payload.calendar,
  calendars: payload.calendars,
  loadOptions: solveOptionsFor(payload.project).schedulingOptions,
  solveInput: {
    tasks: payload.tasks,
    sequences: payload.sequences,
    options: { ...solveOptionsFor(payload.project), projectStartDate: undefined, projectEndDate: undefined },
  },
}));

const CROSS_ITEM = 'Plasterers';

const EXPECTED_CONFLICT_ITEMS = [CONFLICT_ITEM, CROSS_ITEM];

const poolItem = pool?.resources.find((r) => r.name === CONFLICT_ITEM);
assert(!!poolItem, `poolitem "${CONFLICT_ITEM}" aanwezig in de demo-bibliotheek`);

const occupancy = computeLibraryOccupancy(DEMO_COMPANY_ID, pool, inputs);
const row = occupancy.rows.find((r) => r.libraryItemId === poolItem?.id);
assert(!!row, `"${CONFLICT_ITEM}" heeft een rij in het bezettingsoverzicht (wordt in minstens één showcase geboekt)`);
if (row) {
  assert(row.conflictDays.length > 0,
    `"${CONFLICT_ITEM}" heeft conflictdagen (heeft: 0) — de showcases boeken de ploeg niet meer tegelijk`);
  const conflictSet = new Set(row.conflictDays);
  const docsOnConflictDays = row.docs.filter(
    (b) => b.counted && Object.keys(b.dailyLoad).some((iso) => conflictSet.has(iso)),
  );
  assert(docsOnConflictDays.length >= 2,
    `conflict op "${CONFLICT_ITEM}" komt van ${docsOnConflictDays.length} document(en) — verwacht ≥2 (kruis-project)`);
  assert(row.capacityAtPeak > 0, `"${CONFLICT_ITEM}" heeft een bedrijfscapaciteit > 0 op de piekdag`);
}

{
  const rood = occupancy.rows.filter((r) => r.conflictDays.length > 0).map((r) => r.name).sort();
  const verwacht = [...EXPECTED_CONFLICT_ITEMS].sort();
  assert(
    rood.length === verwacht.length && rood.every((n, i) => n === verwacht[i]),
    `rode rijen in het bezettingsoverzicht: [${rood.join(', ')}] — verwacht exact [${verwacht.join(', ')}]. ` +
    'Een item dat hier onbedoeld bij staat maakt de demo onleesbaar; verhoog de capaciteit in ' +
    'src/services/library/demoLibrary.ts (en bump DEMO_LIBRARY_SEED_VERSION) of neem de ' +
    'overboeking in de showcase-spec weg.',
  );
}

{
  const crossPoolItem = pool?.resources.find((r) => r.name === CROSS_ITEM);
  const crossRow = occupancy.rows.find((r) => r.libraryItemId === crossPoolItem?.id);
  assert(!!crossRow, `"${CROSS_ITEM}" heeft een rij in het bezettingsoverzicht`);
  if (crossRow) {
    assert(crossRow.conflictDays.length > 0, `"${CROSS_ITEM}" heeft conflictdagen (heeft: 0)`);
    const cset = new Set(crossRow.conflictDays);
    const docs = crossRow.docs.filter((b) => b.counted && Object.keys(b.dailyLoad).some((iso) => cset.has(iso)));
    assert(docs.length >= 2,
      `conflict op "${CROSS_ITEM}" komt van ${docs.length} document(en) — verwacht ≥2 (kruis-project)`);
  }
}

const distInputs: DistributionDocInput[] = inputs.map((input, i) => ({
  ...input,
  rank: i + 1,
  pinned: false,
  datesAsRecorded: false,
  ceilingWorkdays: null,
  levelInput: input.solveInput!,
}));
if (poolItem) {
  const proposal = computeDistribution(DEMO_COMPANY_ID, pool, poolItem.id, distInputs, { allowSplits: false });
  assert(proposal.blocked === null,
    `verdeling geblokkeerd: ${proposal.blocked ? proposal.blocked.reason : ''}`);
  assert(proposal.hasShortfall === false,
    `verdeling laat een tekort achter (${proposal.docs.reduce((a, d) => a + d.shortfalls.length, 0)} niet-geplaatste taak/taken) — het conflict is dus niet oplosbaar`);
  const moved = proposal.docs.filter((d) => d.endShiftWorkdays > 0);
  assert(moved.length >= 1,
    `geen enkel document schuift op (endShiftWorkdays > 0) — dan valt er niets te demonstreren`);
  for (const d of moved) {
    assert(d.endShiftWorkdays <= 15,
      `"${d.title}" schuift ${d.endShiftWorkdays} werkdagen op — dat is geen bescheiden verschuiving meer`);
  }
}

{
  const crossPoolItem = pool?.resources.find((r) => r.name === CROSS_ITEM);
  if (crossPoolItem) {
    const proposal = computeDistribution(DEMO_COMPANY_ID, pool, crossPoolItem.id, distInputs, { allowSplits: false });
    assert(proposal.blocked === null,
      `verdeling "${CROSS_ITEM}" geblokkeerd: ${proposal.blocked ? proposal.blocked.reason : ''}`);
    assert(proposal.hasShortfall === false,
      `verdeling "${CROSS_ITEM}" laat een tekort achter (${proposal.docs.reduce((a, d) => a + d.shortfalls.length, 0)} niet-geplaatste taak/taken)`);
  }
}

{
  const CEILING = 15;
  const AKKERS = 1;
  const withCeiling: DistributionDocInput[] = distInputs.map((d, i) => ({
    ...d, ceilingWorkdays: i === AKKERS ? CEILING : null,
  }));
  if (poolItem) {
    const off = computeDistribution(DEMO_COMPANY_ID, pool, poolItem.id, withCeiling, { allowSplits: false });
    const on = computeDistribution(DEMO_COMPANY_ID, pool, poolItem.id, withCeiling, { allowSplits: true });
    const shortfallsOf = (p: typeof off): number => p.docs.reduce((a, d) => a + d.shortfalls.length, 0);
    const gapTasksOf = (p: typeof off): number => p.docs.reduce((a, d) => a + Object.keys(d.gaps).length, 0);

    assert(off.blocked === null && on.blocked === null,
      `"${CONFLICT_ITEM}" met plafond ${CEILING}: de actie mag in geen van beide standen geblokkeerd zijn`);
    assert(shortfallsOf(off) > 0,
      `"${CONFLICT_ITEM}" met plafond ${CEILING} en onderbrekingen UIT: verwacht een tekort (kreeg ${shortfallsOf(off)}). ` +
      'Zonder dat tekort valt er niets te winnen en meldt het prijskaartje weer "zou niets besparen".');
    assert(shortfallsOf(on) === 0,
      `"${CONFLICT_ITEM}" met plafond ${CEILING} en onderbrekingen AAN: verwacht GEEN tekort (kreeg ${shortfallsOf(on)})`);
    assert(gapTasksOf(on) >= 1,
      `"${CONFLICT_ITEM}" met onderbrekingen AAN: verwacht minstens één taak met leveling-gaten (kreeg ${gapTasksOf(on)})`);
    const maxOn = Math.max(0, ...on.docs.map((d) => d.endShiftWorkdays));
    assert(maxOn > 0 && maxOn <= CEILING,
      `"${CONFLICT_ITEM}" met onderbrekingen AAN: uitloop ${maxOn} werkdagen — verwacht > 0 en binnen het plafond ${CEILING}`);
  }
}

{
  if (poolItem) {
    const werkt: number[] = [];
    for (const c of [13, 14, 15, 16, 17, 18]) {
      const inp: DistributionDocInput[] = distInputs.map((d, i) => ({ ...d, ceilingWorkdays: i === 1 ? c : null }));
      const off = computeDistribution(DEMO_COMPANY_ID, pool, poolItem.id, inp, { allowSplits: false });
      const on = computeDistribution(DEMO_COMPANY_ID, pool, poolItem.id, inp, { allowSplits: true });
      const sf = (p: typeof off): number => p.docs.reduce((a, d) => a + d.shortfalls.length, 0);
      if (sf(off) > 0 && sf(on) === 0) werkt.push(c);
    }
    assert(werkt.length >= 3,
      `het plafondbereik waarin de schakelaar verschil maakt is [${werkt.join(', ')}] — verwacht ≥3 opeenvolgende ` +
      'waarden, anders is het verschil in de demo niet te vinden. Vergroot het aantal vrije werkdagen vóór de ' +
      'blokkade via KLEIN\'s `anchorShiftDays` in scripts/showcases.ts.');
    assert(werkt.includes(15),
      `het gekozen plafond van 15 werkdagen (drie weken) zit niet in het werkzame bereik [${werkt.join(', ')}]`);
  }
}

for (const { payload } of payloads) {
  const stamped = new Map(
    payload.resources
      .filter((r) => r.libraryOrigin?.companyId === DEMO_COMPANY_ID)
      .map((r) => [r.id, r.libraryOrigin!.libraryItemId]),
  );
  const tasksById = new Map(payload.tasks.map((t) => [t.id, t]));
  const lookup = contourLookup(payload.assignments);
  const engineCache = new Map<string, CalendarEngine>();
  const engineFor = (calendarId: string | undefined): CalendarEngine => {
    const cal = (calendarId && payload.calendars.find((c) => c.id === calendarId)) || payload.calendar;
    let e = engineCache.get(cal.id);
    if (!e) { e = new CalendarEngine(cal); engineCache.set(cal.id, e); }
    return e;
  };
  for (const a of payload.assignments) {
    const itemId = stamped.get(a.resourceId);
    if (!itemId) continue;
    const item = pool?.resources.find((r) => r.id === itemId);
    const task = tasksById.get(a.taskId);
    if (!item || !task || task.childIds.length > 0) continue;
    const engine = engineFor(task.calendarId);
    const days = enumerateWorkDays(engine, task.time.earlyStart, task.time.earlyFinish);
    const perDay = assignmentDayUnits(task, a, engine.hoursPerDay * 60, lookup(task, a), payload.assignments);
    perDay.forEach((units, i) => {
      const iso = days[i];
      if (iso === undefined) return;
      const cap = maxUnitsOn(item, iso);
      assert(units <= cap + 1e-9,
        `"${payload.project.name}" — taak "${task.name}" vraagt ${units} van "${item.name}" op ${iso}, boven de bedrijfscapaciteit ${cap}: intrinsiek onoplosbaar`);
    });
  }
}

console.log(fails === 0
  ? `OK  check-showcase-occupancy: ${checks} controles groen`
  : `    ${fails}/${checks} controles gefaald`);
process.exit(fails === 0 ? 0 : 1);
