// B1c — "Verdelen over projecten" op de ECHTE showcase-voorbeelden.
//
// Waarom deze check bestaat: de drie showcase-IFC's zijn het materiaal waarmee een gebruiker (en
// een demo) het bezettingsoverzicht en de knop "Verdelen…" leert kennen. Dat werkt alleen als er
// in die bestanden ook echt een OPLOSBAAR kruis-project-conflict zit. Dat conflict is een
// eigenschap van gegenereerde DATA (scripts/showcases.ts → public/examples/*.ifc), niet van code —
// dus kan het bij elke spec-tweak stilzwijgend verdwijnen zonder dat één unit-test rood wordt.
// Deze batterij leest daarom de bestanden zoals ze op schijf staan, doet exact wat de app doet bij
// Backstage → Voorbeelden (`applyDemoLibraryToShowcaseProject`: demo-bibliotheek seeden, project
// binden, ondubbelzinnige naam-matches koppelen) en toetst de belofte headless.
//
// Patroon: de ECHTE Zustand-store (zoals check-demo-library.ts / check-library-slice.ts) met drie
// open documenten, daarna de pure kernen `computeLibraryOccupancy` en `computeDistribution` over
// dezelfde `OccupancyDocInput`-mapping die `ResourceOccupancyView` opbouwt.
//
// Exitcode is de poort; XX-regels tonen de afwijkingen.
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

declare const process: { exit(code: number): never; cwd(): string };

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

/** De drie showcases, in de volgorde waarin de gebruiker ze redelijkerwijs opent (klein → groot).
 *  De rangorde in de verdeling volgt deze volgorde: 1 = KLEIN wordt het meest ontzien. */
const SLUGS = [
  'showcase-verbouwing-eengezinswoning',
  'showcase-rijwoningen-de-akkers',
  'showcase-appartementencomplex',
];

/** Het schaarse poolitem waar het demo-conflict op moet zitten: bedrijfscapaciteit 1, één ploeg die
 *  in twee projecten tegelijk gevraagd wordt — precies het verhaal van `demoLibraryShowcase.ts`. */
const CONFLICT_ITEM = 'Masonry crew';

const S = () => useAppStore.getState();
const EX_DIR = join(process.cwd(), 'public', 'examples');

// ── Opzet: drie documenten, elk geladen + gekoppeld + doorgerekend zoals de app het doet ────────
SLUGS.forEach((slug, i) => {
  if (i > 0) S().newDocument();
  S().openExampleFromString(readFileSync(join(EX_DIR, `${slug}.ifc`), 'utf8'), slug);
  applyDemoLibraryToShowcaseProject();
  S().runCPM();
});

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

/** Zelfde mapping als `ResourceOccupancyView` opbouwt (§4.4). Geen `skipEphemeralSolve`: hier is
 *  geen actief-document-perf-poort, elk document is vers doorgerekend. */
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
  solveInput: {
    tasks: payload.tasks,
    sequences: payload.sequences,
    dataDate: payload.project.statusDate,
    progressMode: payload.project.progressMode,
    schedulingOptions: payload.project.schedulingOptions,
  },
}));

/** Het TWEEDE bedoelde knelpunt: één stukadoorsploeg die in alle drie de showcases meedoet. Anders
 *  dan `CONFLICT_ITEM` is dit conflict NIET zonder tekort te verdelen — MIDDEL en GROOT hebben elk
 *  hun eigen, in hun spec gedocumenteerde interne stukadoors-overallocatie (GROOT vraagt op één dag
 *  9 van de 3), en geen enkele volgorde van projecten neemt die weg. De eis hieronder is daarom
 *  alleen het KRUIS-deel: er moet een conflict zijn dat uit ≥2 documenten komt. */
const CROSS_ITEM = 'Plasterers';

/** De EXACTE set poolitems die met de drie showcases open rood mag staan. Waarom exact en niet
 *  "minstens": de demo was een ruïne — bijna élke rij stond rood omdat de demo-bibliotheek kleiner
 *  gedimensioneerd was dan wat de showcases er samen op boeken, waardoor het bedoelde verhaal
 *  (dezelfde metselploeg in twee projecten, de stukadoors in drie) verdronk in ruis. Een "minstens
 *  deze twee"-assert had dat niet gezien. Deze set is dus de poort die een toekomstige regeneratie
 *  van de voorbeelden — of een krappere bibliotheekcapaciteit — dwingt bewust te zijn. */
const EXPECTED_CONFLICT_ITEMS = [CONFLICT_ITEM, CROSS_ITEM];

const poolItem = pool?.resources.find((r) => r.name === CONFLICT_ITEM);
assert(!!poolItem, `poolitem "${CONFLICT_ITEM}" aanwezig in de demo-bibliotheek`);

// ═══ (a) Het bezettingsoverzicht toont een conflict op het schaarse poolitem, over ≥2 documenten ══
const occupancy = computeLibraryOccupancy(DEMO_COMPANY_ID, pool, inputs);
const row = occupancy.rows.find((r) => r.libraryItemId === poolItem?.id);
assert(!!row, `"${CONFLICT_ITEM}" heeft een rij in het bezettingsoverzicht (wordt in minstens één showcase geboekt)`);
if (row) {
  assert(row.conflictDays.length > 0,
    `"${CONFLICT_ITEM}" heeft conflictdagen (heeft: 0) — de showcases boeken de ploeg niet meer tegelijk`);
  // ≥2 verschillende documenten die op een conflictdag daadwerkelijk belasting hebben: het punt is
  // KRUIS-project-dubbelbezetting, niet een overallocatie binnen één planning.
  const conflictSet = new Set(row.conflictDays);
  const docsOnConflictDays = row.docs.filter(
    (b) => b.counted && Object.keys(b.dailyLoad).some((iso) => conflictSet.has(iso)),
  );
  assert(docsOnConflictDays.length >= 2,
    `conflict op "${CONFLICT_ITEM}" komt van ${docsOnConflictDays.length} document(en) — verwacht ≥2 (kruis-project)`);
  assert(row.capacityAtPeak > 0, `"${CONFLICT_ITEM}" heeft een bedrijfscapaciteit > 0 op de piekdag`);
}

// ═══ (a2) ALLEEN de bedoelde items staan rood — exacte set ═══════════════════════════════════════
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

// ═══ (a3) Het tweede bedoelde knelpunt is ECHT een kruis-project-conflict ════════════════════════
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

// ═══ (b) "Verdeel automatisch" lost het op: geen blokkade, geen tekort, en er verschuift iets ═════
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
  // Bescheiden verschuiving: het voorstel moet iets te kiezen geven (rangorde/pin/plafond), geen
  // maandenlange uitloop. De grens is ruim — hij bewaakt de ORDE van grootte, geen exact getal.
  for (const d of moved) {
    assert(d.endShiftWorkdays <= 15,
      `"${d.title}" schuift ${d.endShiftWorkdays} werkdagen op — dat is geen bescheiden verschuiving meer`);
  }
}

// ═══ (b2) Ook het tweede knelpunt is verdeelbaar — zij het niet bescheiden ═══════════════════════
// Gemeten: geen blokkade, geen tekort, maar GROOT schuift ~27 werkdagen op. Dat is geen fout maar
// het gevolg van GROOT's eigen, in zijn spec beloofde interne stukadoors-overallocatie (één ploeg
// van 3 voor drie torens, vraag 9): die moet de verdeling er óók uit werken. De ≤15-werkdagen-eis
// van (b) geldt hier dus bewust NIET — alleen "oplosbaar zonder tekort".
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

// ═══ (b3) "Onderbrekingen toestaan" maakt op de showcases ECHT verschil ══════════════════════════
// De aanleiding (2026-09-14): met de drie showcases open meldde het prijskaartje van de schakelaar
// in beide standen exact hetzelfde getal — "zou niets besparen". De demo bevatte dus een knop die
// aantoonbaar niets deed.
//
// WAT ER GEMETEN IS, EN WAAROM DE EIS NIET "KLEINERE UITLOOP" IS. `allowSplits` is in
// `ResourceLeveler.findSlot` geen tweede zoekstrategie maar een TERUGVAL: de aaneengesloten
// kandidaatscan loopt eerst, en `scatterSlot` (de pauzedagen) komt pas aan bod als díé scan binnen
// het venster faalt. Twee gevolgen die je moet kennen voor je deze assert "strenger" maakt:
//  1. Zónder venster — en `computeDistribution` zet `constrainToFloat: false`, dus het venster
//     bestaat alleen bij een expliciete "maximale uitloop" (`ceilingWorkdays`) — vindt de
//     aaneengesloten scan ALTIJD een slot en is de schakelaar per constructie een no-op. Gemeten op
//     deze drie showcases: 10 werkdagen uitloop in beide standen. Dat is engine-gedrag en met geen
//     enkele spec-tweak aan de voorbeelden te veranderen.
//  2. Slaat de aaneengesloten scan WEL af (plafond bindt), dan blijft de taak in de uit-stand op
//     haar PF liggen MET conflictdagen — een TEKORT, geen grotere uitloop. Een eis van de vorm
//     "kleinere uitloop in beide standen, zonder tekort" is daarom niet alleen niet gehaald maar
//     onbereikbaar: de twee standen kunnen per definitie alleen verschillen op het punt waar de
//     uit-stand een tekort heeft.
// De eerlijke, wél demonstreerbare belofte is dus deze: mét een plafond verandert de schakelaar een
// ONOPLOSBAAR voorstel (tekort ⇒ Toepassen geblokkeerd) in een toepasbaar voorstel binnen datzelfde
// plafond. Dat is het verschil dat de gids "Uitproberen met de voorbeelden" beschrijft.
{
  const CEILING = 15;        // werkdagen — het midden van het werkzame bereik 14 t/m 17 (zie hieronder)
  const AKKERS = 1;          // index van MIDDEL in SLUGS
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

// ═══ (b4) Het werkzame plafondbereik is breed genoeg om te DEMONSTREREN ══════════════════════════
// Waarom dit een eigen poort is: vóór de ankerschuif van KLEIN (63 → 66, zie `scripts/showcases.ts`)
// werkte exact ÉÉN plafondwaarde (14) — wie 13 of 15 intikte zag niets en concludeerde terecht dat
// de schakelaar niets doet. Het bereik is precies zo breed als het aantal VRIJE werkdagen dat de
// wijkende taak vóór de blokkade heeft; deze assert is dus de mechanische bewaking op dat aantal.
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
      `het ronde plafond van 15 werkdagen (drie weken) — dat de gids noemt — zit niet in het werkzame bereik [${werkt.join(', ')}]`);
  }
}

// ═══ (c) Geen intrinsieke overvraag: geen showcase-taak vraagt op één dag meer dan de poolcapaciteit ══
// Zou één taak méér vragen dan het bedrijf heeft, dan is het conflict per definitie onoplosbaar en
// levert "Verdeel automatisch" altijd een tekort — hoe de documenten ook geschoven worden.
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
