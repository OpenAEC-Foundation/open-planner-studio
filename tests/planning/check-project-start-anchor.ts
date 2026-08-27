// T7b (plan-§9/O2-vervolg, orkestratorbesluit 2026-08-15 — optie B) + T7-review-fixronde
// (H3/L3/L4/M4) — headless tegen de ECHTE Zustand-store, zelfde patroon als `check-move-
// project.ts`/`check-notifications.ts`.
//
// WAAROM DEZE CHECK BESTAAT (en niet meer in `cases-edge.json`): T7 maakte `CPMSolver` MSP-getrouw
// — een ingelezen anker wordt nooit meer door de projectstart-vloer overruled (§9/O2, de brede
// regel). Dat loste de importgetrouwheid op, maar verwijderde ook de bescherming tegen een ANDER,
// legitiem scenario: een gebruiker die de projectstartdatum via Projectinfo naar een latere datum
// verzet, terwijl een wortel-taak nog op haar oude (nu verouderde) `scheduleStart` staat. In de
// solver hebben "verouderd in-app-anker" en "aantoonbaar-eerder MS-Project-anker" EXACT dezelfde
// vorm (wortel-taak, `scheduleStart < project.startDate`, geen constraint) — de solver kan ze niet
// uit elkaar houden (architect-analyse, T7-escalatie). Het intentiesignaal "de gebruiker heeft
// zojuist zelf de projectstart verzet" bestaat wél op één plek: `projectSlice.setProject`. Deze
// check bewaakt die verplaatste bescherming rechtstreeks op het bewerkmoment.
//
// TESTDATUMS: 2026-08-15 is een ZATERDAG — bewust NIET als klem-doel gebruikt (dat zou de
// snap-naar-werkdag-logica zelf laten meesturen en de assertie-waarden onnodig indirect maken).
// 2026-08-17 (maandag) en 2026-08-24 (volgende maandag) zijn de klem-doelen hieronder.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();
const N = () => S().ui.notifications;
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const truthy = (label: string, got: boolean) => {
  checks++;
  if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};
/** Leeg de meldingenlijst zonder aan te nemen hóé dat elders gebeurt (zelfde precedent als
 *  `check-notifications.ts` — er is bewust geen clear-actie op de store zelf). */
const clearAll = () => { for (const n of [...N()]) S().dismissNotification(n.id); };

const HOUR_CAL: Pick<WorkCalendar, 'workTime'> = {
  workTime: { byWeekday: {
    1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
    4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
  } },
};

// ═══════════════════════════════════════════════════════════════════════════
// 1) De klem zelf: een LATERE startDate klemt wortel-ankers zonder voorganger/constraint vooruit
// ═══════════════════════════════════════════════════════════════════════════
S().newProject();
S().setProject({ startDate: '2026-06-01' });
clearAll();

// A/A2: wortel-taken zonder voorganger, zonder constraint, met een expliciet VROEG eigen anker —
// precies het T7-corpusscenario, hier gesimuleerd door de start met de hand vroeg te zetten.
const tA = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });
const finishABefore = S().tasks.find(t => t.id === tA)!.time.scheduleFinish;
const tA2 = S().addTask({ name: 'A2', time: createDefaultTaskTime('2026-05-15', 3) });
// B/C: C -> B (FS). B heeft dus een voorganger — geen wortel-anker, blijft ONGEMOEID ondanks een
// even vroeg eigen anker (de solver bepaalt B's ES toch al via de relatie, niet via ownAnchor).
const tC = S().addTask({ name: 'C', time: createDefaultTaskTime('2026-05-01', 2) });
const tB = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-05-01', 2) });
S().addSequence({ predecessorId: tC, successorId: tB, type: 'FINISH_START', lagDays: 0 } as Omit<Sequence, 'id'>);
// D: wortel-taak MET een expliciete constraint (SNET vóór de nieuwe startdatum) — constraint wint
// altijd, ongeacht of de eigen start vóór of ná de nieuwe projectstart ligt.
const tD = S().addTask({
  name: 'D', time: createDefaultTaskTime('2026-05-01', 2),
  constraint: { type: 'SNET', date: '2026-05-10' },
});
// E: wortel-taak zonder voorganger/constraint, maar het eigen anker ligt al NÁ de nieuwe
// projectstart — niets te klemmen (`< updates.startDate` is dan false).
const tE = S().addTask({ name: 'E', time: createDefaultTaskTime('2026-09-01', 2) });
// L1 — een DATELESS ASAP-constraint heeft geen forward-effect in de solver en mag de klem dus niet
// blokkeren (vóór de review-fix telde elke aanwezige `constraint` mee, ook een lege ASAP).
const tAsap = S().addTask({
  name: 'Asap', time: createDefaultTaskTime('2026-05-01', 2), constraint: { type: 'ASAP' },
});
// L2 — een hammock-wortel: de solver negeert `scheduleStart` van een hammock toch (`hammockEarlyStart`
// gebruikt nooit `ownAnchor`/`rootFloor`), dus de klem-lus moet 'm overslaan — anders blaast hij
// alleen `{{count}}` in de melding op zonder dat het ooit iets aan de solver-uitkomst verandert.
const tHammock = S().addTask({ name: 'Hammock', time: createDefaultTaskTime('2026-05-01', 2), isHammock: true });

const undoLenBeforeClamp = S().undoStack.length;
S().setProject({ startDate: '2026-08-17' }); // maandag, LATER dan alle bovenstaande vroege ankers

eq('01 A (wortel, geen voorganger/constraint) klemt naar de nieuwe startdatum',
  S().tasks.find(t => t.id === tA)?.time.scheduleStart, '2026-08-17');
eq('02 A2 klemt eveneens', S().tasks.find(t => t.id === tA2)?.time.scheduleStart, '2026-08-17');
eq('03 B (heeft een voorganger C) blijft ongemoeid', S().tasks.find(t => t.id === tB)?.time.scheduleStart, '2026-05-01');
eq('04 C (zelf ook wortel, geen voorganger/constraint) klemt', S().tasks.find(t => t.id === tC)?.time.scheduleStart, '2026-08-17');
eq('05 D (expliciete SNET-constraint) blijft ongemoeid ondanks een vroeg eigen anker',
  S().tasks.find(t => t.id === tD)?.time.scheduleStart, '2026-05-01');
eq('06 D.constraint zelf blijft ongemoeid', S().tasks.find(t => t.id === tD)?.constraint, { type: 'SNET', date: '2026-05-10' });
eq('07 E (eigen anker al ná de nieuwe startdatum) blijft ongemoeid', S().tasks.find(t => t.id === tE)?.time.scheduleStart, '2026-09-01');
eq('08 project.startDate is de nieuwe datum', S().project.startDate, '2026-08-17');
eq('09 precies ÉÉN undo-stap voor de hele klem-transactie (klem + startDate samen)', S().undoStack.length, undoLenBeforeClamp + 1);
eq('L1: dateless ASAP blokkeert de klem niet', S().tasks.find(t => t.id === tAsap)?.time.scheduleStart, '2026-08-17');
eq('L2: de hammock-wortel wordt overgeslagen (eigen scheduleStart blijft ongemoeid)',
  S().tasks.find(t => t.id === tHammock)?.time.scheduleStart, '2026-05-01');

// H3b — scheduleFinish schuift consistent mee (duurbehoudend, klokbehoudend): NIET blijven staan
// op de oude waarde (die zou dan vóór scheduleStart liggen — de K7-inconsistentie uit de review).
const aAfter = S().tasks.find(t => t.id === tA)!;
truthy('H3b: A.scheduleFinish is meegeschoven (≠ de waarde vóór de klem)', aAfter.time.scheduleFinish !== finishABefore);
truthy('H3b: A.scheduleFinish ligt nog steeds NÁ scheduleStart (geen finish<start)',
  aAfter.time.scheduleFinish > aAfter.time.scheduleStart);

// ── Melding: severity info, juiste sleutel, juiste teller (A, A2, C, Asap = 4 geklemde ankers;
//    B/D/E/Hammock NIET) ──────────────────────────────────────────────────────────────────────
eq('10 precies één melding', N().length, 1);
eq('11 severity info', N()[0]?.severity, 'info');
eq('12 messageKey', N()[0]?.messageKey, 'notifications.projectStartAnchorsClamped');
eq('13 count = precies de geklemde ankers (A, A2, C, Asap — niet B/D/E/Hammock)', N()[0]?.params, { count: 4 });
eq('14 dedupeKey', N()[0]?.dedupeKey, 'project-start-anchors-clamped');

// H3c — de transactie herrekent meteen: de melding is WAAR op het moment dat hij verschijnt.
eq('15 H3c: scheduleStale is af (runCPM draaide al mee)', S().scheduleStale, false);
truthy('16 H3c: er staat een vers cpmResult (geen undefined ná de klem)', !!S().cpmResult);

// ═══════════════════════════════════════════════════════════════════════════
// 2) Undo/redo: de klem hoort bij dezelfde transactie als de startDate-wijziging
// ═══════════════════════════════════════════════════════════════════════════
S().undo();
eq('20 undo herstelt project.startDate', S().project.startDate, '2026-06-01');
eq('21 undo herstelt het geklemde taakanker A', S().tasks.find(t => t.id === tA)?.time.scheduleStart, '2026-05-01');
eq('22 undo herstelt het geklemde taakanker A2', S().tasks.find(t => t.id === tA2)?.time.scheduleStart, '2026-05-15');
eq('23 undo herstelt het geklemde taakanker C', S().tasks.find(t => t.id === tC)?.time.scheduleStart, '2026-05-01');
// L3/L4 (T7-review): de melding zit NIET in het documentcontract (`ui.notifications` staat niet in
// `DOCUMENT_FIELDS`, zie `documentContract.ts`) — dat is BESTAAND, app-breed meldingenkanaal-gedrag
// (elke melding overleeft undo/redo, niet iets specifiek voor deze feature; `dedupeKey`/`count`-
// samenvouwing gedraagt zich identiek aan `summaryRelationsDropped` — laatste-`params`-wint, zie
// `notify` in `uiSlice.ts`). Vastgelegd hier zodat een toekomstige wijziging aan dat kanaal deze
// aanname niet stilzwijgend breekt.
eq('L3: de melding overleeft de undo (app-globaal, geen documentveld)', N().length, 1);
S().redo();
eq('24 redo klemt opnieuw', S().tasks.find(t => t.id === tA)?.time.scheduleStart, '2026-08-17');
eq('25 redo herstelt project.startDate', S().project.startDate, '2026-08-17');

// L4: een tweede klem met een ANDER aantal op dezelfde dedupeKey vervangt `params` met de LAATSTE
// waarde (geen optelling) — exact hoe `summaryRelationsDropped` zich ook gedraagt (`existing.params
// = n.params` in `notify`, geen accumulatie). Vers project (i.p.v. verder te bouwen op de A/A2/C/
// Asap van hierboven, die na de eerste klem NOG STEEDS vóór 2026-08-24 liggen en dus zelf een
// tweede keer zouden meeklemmen — dat zou hier alleen maar de telling vertroebelen, niet de
// dedupe-vraag testen) zodat de tweede klem gegarandeerd precies één ander aantal oplevert.
S().newProject();
S().setProject({ startDate: '2026-06-01' });
S().addTask({ name: 'G1', time: createDefaultTaskTime('2026-05-01', 2) });
S().addTask({ name: 'G2', time: createDefaultTaskTime('2026-05-01', 2) });
S().addTask({ name: 'G3', time: createDefaultTaskTime('2026-05-01', 2) });
clearAll();
S().setProject({ startDate: '2026-08-17' }); // eerste klem: 3 ankers (G1/G2/G3)
eq('L4-voorwaarde: eerste klem telt 3', N()[0]?.params, { count: 3 });
const tF = S().addTask({ name: 'F', time: createDefaultTaskTime('2026-05-01', 2) }); // ná de klem toegevoegd
S().setProject({ startDate: '2026-08-24' }); // opnieuw later ⇒ tweede klem, nu alléén F (de rest staat al op 08-17, dus nog steeds < 08-24 — ook díe klemmen dus opnieuw mee)
eq('L4: params vervangt (niet optelt) bij een herhaalde dedupeKey — het aantal van de LAATSTE call',
  N()[0]?.params, { count: 4 });
eq('L4: de dedupe-badge (count) telt wél de OCCURRENCES op', N()[0]?.count, 2);
eq('L4-controle: F is ook echt geklemd', S().tasks.find(t => t.id === tF)?.time.scheduleStart, '2026-08-24');

// ═══════════════════════════════════════════════════════════════════════════
// 3) No-op-paden: alleen een ECHTE verzetting naar een LATERE datum klemt
// ═══════════════════════════════════════════════════════════════════════════
S().newProject();
S().setProject({ startDate: '2026-08-17' });
const t3 = S().addTask({ name: 'X', time: createDefaultTaskTime('2026-05-01', 5) });
clearAll();

// 3a — EERDERE datum: geen klem, geen melding.
S().setProject({ startDate: '2026-06-01' });
eq('30 een EERDERE startDate klemt niets', S().tasks.find(t => t.id === t3)?.time.scheduleStart, '2026-05-01');
eq('31 geen melding bij een eerdere startDate', N().length, 0);
eq('32 project.startDate is wél gewoon bijgewerkt', S().project.startDate, '2026-06-01');

// 3b — DEZELFDE datum (het no-op-guard-pad, pakket H): geen undo-stap, geen klem, geen melding.
clearAll();
const undoLenBeforeSame = S().undoStack.length;
S().setProject({ startDate: '2026-06-01' });
eq('33 identieke startDate is een volledige no-op (geen undo-stap)', S().undoStack.length, undoLenBeforeSame);
eq('34 geen melding bij een ongewijzigde startDate', N().length, 0);

// 3c — een LATERE datum zonder klembare wortel-taken (alle taken hebben al een latere eigen start,
// een constraint, of een voorganger): geen melding, want `clampedAnchors` blijft 0.
S().newProject();
S().setProject({ startDate: '2026-06-01' });
const t3c = S().addTask({ name: 'Y', time: createDefaultTaskTime('2026-09-01', 2) }); // al ná de nieuwe datum
clearAll();
S().setProject({ startDate: '2026-08-17' });
eq('35 niets te klemmen => geen melding', N().length, 0);
eq('36 taak Y blijft op zijn eigen (latere) anker', S().tasks.find(t => t.id === t3c)?.time.scheduleStart, '2026-09-01');

// ═══════════════════════════════════════════════════════════════════════════
// 4) Geïmporteerde bestanden raken dit pad NIET (kern van het orkestratorbesluit — importgetrouwheid
// (T7) en bewerkbescherming (T7b) staan volledig los van elkaar): `loadState` (en daarmee elk
// open-pad, dat allemaal via `applyLoadedProject` loopt) hydrateert de payload rechtstreeks via het
// documentcontract en roept `setProject` NERGENS aan — dus de klem/melding vuurt hier niet, ook al
// heeft de geladen `project.startDate` precies dezelfde vorm (later dan een wortel-taak-anker
// zonder constraint) als de trigger hierboven.
// ═══════════════════════════════════════════════════════════════════════════
S().newProject();
S().setProject({ startDate: '2026-05-01' });
const t4 = S().addTask({ name: 'Geïmporteerde taak', time: createDefaultTaskTime('2026-05-01', 5) });
const loadedProject = { ...S().project, startDate: '2026-08-17' }; // MSP-bestand: latere projectstart, oud taakanker intact
const loadedTasks = S().tasks;
clearAll();
S().loadState({
  project: loadedProject,
  calendar: createDefaultCalendar(),
  tasks: loadedTasks,
  sequences: [],
  resources: [],
  assignments: [],
});
eq('40 loadState klemt het geïmporteerde taakanker NIET', S().tasks.find(t => t.id === t4)?.time.scheduleStart, '2026-05-01');
eq('41 loadState vuurt de klem-melding niet af', N().some(n => n.messageKey === 'notifications.projectStartAnchorsClamped'), false);
eq('42 project.startDate komt wél gewoon over uit het geladen bestand', S().project.startDate, '2026-08-17');

// ═══════════════════════════════════════════════════════════════════════════
// 5) H3a — uurmodus: de klem snapt naar de eerstvolgende WERK-INSTANT, nooit naar een kale
// middernacht-datum. Dit is de dekking die de vervallen `edge-root-project-start-floor-hour-
// mixed/hour-task`-cases in `cases-edge.json` boden vóór die naar `check-project-start-anchor.ts`
// verhuisden (die cases testten de OUDE solver-vloer; dit hier test de NIEUWE bewerk-klem).
// ═══════════════════════════════════════════════════════════════════════════
S().newProject();
S().setCalendar({ ...S().calendar, ...HOUR_CAL } as WorkCalendar);
S().setProject({ startDate: '2026-08-17' }); // maandag
const tH = S().addTask({ name: 'H', time: createDefaultTaskTime('2026-08-14', 3) }); // vrijdag, al vóór de anker
const finishHBefore = S().tasks.find(t => t.id === tH)!.time.scheduleFinish;
clearAll();

S().setProject({ startDate: '2026-08-24' }); // volgende maandag — LATER, dus H (nog steeds vóór) klemt

eq('50 uurmodus: het anker snapt naar de eerste werk-instant (08:00), geen kale middernacht',
  S().tasks.find(t => t.id === tH)?.time.scheduleStart, '2026-08-24T08:00');
eq('51 uurmodus-melding met precies 1 geklemd anker', N()[0]?.params, { count: 1 });
const hAfter = S().tasks.find(t => t.id === tH)!;
truthy('52 uurmodus H3b: scheduleFinish is meegeschoven', hAfter.time.scheduleFinish !== finishHBefore);
truthy('53 uurmodus H3b: scheduleFinish ligt nog steeds NÁ scheduleStart', hAfter.time.scheduleFinish > hAfter.time.scheduleStart);

// ── Afronding ────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  project-start-anchor: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  project-start-anchor: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
