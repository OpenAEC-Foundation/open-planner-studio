// check-apply-distribution.ts — B1c-plan3 taak 6 (spec §5/§9 "Store-niveau"). Toepassen schrijft in
// het actieve document én in de slapers; "alles terugdraaien" zet alles terug, inclusief de
// doorrekening. Fixtures via `createAppStore()` + `newDocument()` (echte documenten, echte
// payloads) — de `DistributionProposal` zelf wordt met de hand gebouwd (de afleiding uit een echte
// `computeDistribution`-run is al gedekt door `check-distribute.ts`; hier staat uitsluitend het
// schrijfpad op de proef).
//
// AANGEPAST NA MERGE MET MAIN (sessiehistorie, 2026-09-04): undo/redo is niet langer een
// `undoStack` per document(payload) maar één app-globale sessiechronologie (`historyEvents`). De
// undo-DIEPTEs hieronder zijn daarom event-tellingen, en de terugdraai-poort is de identiteit van
// het history-event dat `applyDistribution` per document achterliet.
//
// Draait via run.sh. Exit 0 = alles groen.
import { createAppStore } from '@/state/appStore';
import { historyDepthsForActiveScope, selectUndoHistoryEvent } from '@/state/sessionHistory';
import { subscribeExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import type { DistributionProposal, DistributionDocResult } from '@/services/library/distribute';
import type { DistributionApplyRecord } from '@/services/library/applyDistribution';
import type { TaskSplitGap } from '@/types/task';

declare const process: { exit(code: number): never };

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

function baseDocResult(docId: string, title: string, extra?: Partial<DistributionDocResult>): DistributionDocResult {
  return {
    docId, title, participated: true, cannotMove: false,
    delays: {}, gaps: {}, projectEndBefore: '2026-08-07', projectEndAfter: '2026-08-07',
    endShiftWorkdays: 0, shortfalls: [],
    ...extra,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Opzet: één store, twee documenten. "Slaper" wordt eerst gevuld en gaat daarna slapen (newDocument
// maakt hem niet-actief); "Actief" blijft het actieve document.
// ═══════════════════════════════════════════════════════════════════════════
const store = createAppStore();
const S = () => store.getState();

S().setProject({ name: 'Slaper', startDate: '2026-08-03' });
const idS1 = S().addTask({ name: 'S1' });
const sleepDocId = S().activeDocumentId;

const activeDocId = S().newDocument();
S().setProject({ name: 'Actief', startDate: '2026-08-03' });
const idActiveIn = S().addTask({ name: 'ActiefIn' });
const idBuiten = S().addTask({ name: 'Buiten' });
S().updateTask(idBuiten, { levelingDelay: 3 });

const levelingGap: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480, source: 'leveling' };

function makeProposal(overrides?: Partial<DistributionProposal>): DistributionProposal {
  return {
    libraryItemId: 'lib-1',
    blocked: null,
    docs: [
      baseDocResult(activeDocId, 'Actief', { delays: { [idActiveIn]: 2 } }),
      baseDocResult(sleepDocId, 'Slaper', {
        delays: { [idS1]: 1 }, gaps: { [idS1]: [levelingGap] }, endShiftWorkdays: 1,
      }),
    ],
    fixedLoadByDay: {}, residualByDay: {}, hasShortfall: false,
    // B1c-plan3 taak 11: `bookingByDay`/`afterLoadByDay`/`afterIncomplete` zijn niet relevant voor
    // dit schrijfpad-fixture (dat toetst `applyDistribution`, niet `computeDistribution` — dat laatste
    // is al gedekt door check-distribute.ts), maar wel verplicht op het type.
    bookingByDay: {}, afterLoadByDay: {}, afterIncomplete: false,
    ...overrides,
  };
}
const scopeTaskIdsByDoc = { [activeDocId]: [idActiveIn], [sleepDocId]: [idS1] };

function sleepPayload() {
  return S().documents.find(d => d.id === sleepDocId)!.payload!;
}

/** Aantal history-events met een `document-data`-delta voor dít document, in de gevraagde stand.
 *  Dit is de sessiehistorie-vervanger van het oude `payload.undoStack.length`: de chronologie is
 *  app-globaal, dus "de undo-diepte van document X" is een filter, geen array-lengte. */
function eventsFor(docId: string, state: 'applied' | 'undone'): number {
  return S().historyEvents.filter(e => e.state === state
    && e.deltas.some(d => d.kind === 'document-data' && d.documentId === docId)).length;
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 1: geblokkeerd voorstel schrijft NIETS.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 1, geblokkeerd --');
{
  const blocked = makeProposal({ blocked: { reason: 'MATERIAL_ITEM', docIds: [] } });
  const before = JSON.stringify(S().tasks);
  const outcome = S().applyDistribution(blocked, scopeTaskIdsByDoc);
  assert(outcome.ok === false && outcome.reason === 'blocked', 'geval 1: blocked ⇒ ok:false met reden blocked');
  assert(JSON.stringify(S().tasks) === before, 'geval 1: het actieve document is niet aangeraakt');
  assert(S().tasks.find(t => t.id === idActiveIn)?.levelingDelay === undefined, 'geval 1: ActiefIn heeft nog geen delay');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2: een tekort blokkeert Toepassen (spec §4 stap 3) — een geldige preview, geen schrijfpad.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 2, tekort blokkeert --');
{
  const shortfall = makeProposal({ hasShortfall: true });
  const outcome = S().applyDistribution(shortfall, scopeTaskIdsByDoc);
  assert(outcome.ok === false && outcome.reason === 'shortfall', 'geval 2: hasShortfall ⇒ ok:false met reden shortfall');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2b (fixronde B1c-etappe-3, bevinding B5): een SLAPENDE write die vastloopt breekt de hele
// actie af — mét reden, zonder halve staat en zonder meldingen. Een relatiecyclus in het slapende
// document laat de `runCPM` binnen de scratch-context een `cpmResult.error` zetten; BESLIST in deze
// fixronde dat dát óók `ok: false` is (zie `DistributionApplyResult`): de nivelleervertraging zou
// anders wél geschreven worden en de bijbehorende datums niet.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 2b, een vastgelopen slapende write --');
{
  const cycleDocId = S().newDocument();
  S().setProject({ name: 'Cyclus', startDate: '2026-08-03' });
  const idC1 = S().addTask({ name: 'C1' });
  const idC2 = S().addTask({ name: 'C2' });
  assert(S().addSequence({ predecessorId: idC1, successorId: idC2, type: 'FINISH_START', lagDays: 0 }) !== null,
    'geval 2b opzet: relatie C1→C2 aangemaakt');
  assert(S().addSequence({ predecessorId: idC2, successorId: idC1, type: 'FINISH_START', lagDays: 0 }) !== null,
    'geval 2b opzet: en de tegenrelatie C2→C1 (de cyclus)');
  S().switchDocument(activeDocId);

  const cyclePayload = () => S().documents.find(d => d.id === cycleDocId)!.payload!;
  const proposal = makeProposal({
    docs: [
      baseDocResult(activeDocId, 'Actief', { delays: { [idActiveIn]: 2 } }),
      baseDocResult(cycleDocId, 'Cyclus', { delays: { [idC1]: 1 } }),
    ],
  });
  const scope = { [activeDocId]: [idActiveIn], [cycleDocId]: [idC1, idC2] };

  const tasksBefore = JSON.stringify(S().tasks);
  const cycleBefore = JSON.stringify(cyclePayload());
  const eventsBefore = S().historyEvents.length;
  const notificationsBefore = S().ui.notifications.length;

  const outcome = S().applyDistribution(proposal, scope);
  assert(outcome.ok === false && outcome.reason === 'scratch-failed',
    `geval 2b: een vastgelopen scratch-run ⇒ ok:false met reden scratch-failed (kreeg ${JSON.stringify(outcome)})`);
  assert(outcome.ok === false && outcome.docId === cycleDocId, 'geval 2b: en het record benoemt het document dat vastliep');
  assert(outcome.ok === false && typeof outcome.error === 'string' && outcome.error.length > 0,
    'geval 2b: met de rauwe technische reden erbij (voor `detail` in de melding)');

  assert(JSON.stringify(S().tasks) === tasksBefore, 'geval 2b: het actieve document is niet aangeraakt');
  assert(JSON.stringify(cyclePayload()) === cycleBefore, 'geval 2b: en de payload van de slaper evenmin');
  assert(S().historyEvents.length === eventsBefore, 'geval 2b: er is geen history-event bijgekomen');
  assert(S().ui.notifications.length === notificationsBefore,
    'geval 2b: en er is geen enkele melding gepusht (die horen bij een bewerking die niet heeft plaatsgevonden)');

  S().closeDocument(cycleDocId);
  S().switchDocument(activeDocId);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3, 4, 5, 6: het echte Toepassen — actief + slapend, scope-behoud, gaten, undo-diepte.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 3-6, schrijven over actief + slapend --');
let applyRecord: DistributionApplyRecord | null;
let sleepCpmBefore: string;
{
  const seen: unknown[] = [];
  const unsub = subscribeExtensionEvent(HOST_EVENTS.scheduleCalculated, (d) => seen.push(d));

  const activeDepthBefore = historyDepthsForActiveScope(S()).undoDepth;
  const activeEventsBefore = eventsFor(activeDocId, 'applied');
  const sleepEventsBefore = eventsFor(sleepDocId, 'applied');
  sleepCpmBefore = JSON.stringify(sleepPayload().cpmResult);

  const outcome3 = S().applyDistribution(makeProposal(), scopeTaskIdsByDoc);
  assert(outcome3.ok === true, 'geval 3: applyDistribution slaagt');
  applyRecord = outcome3.ok ? outcome3.record : null;

  const activeTaskAfter = S().tasks.find(t => t.id === idActiveIn);
  assert(activeTaskAfter?.levelingDelay === 2, 'geval 3: het actieve document kreeg zijn delays');
  assert(sleepPayload().tasks.find(t => t.id === idS1)?.levelingDelay === 1, 'geval 3: het slapende document ook');
  assert(sleepPayload().scheduleStale === false, 'geval 3: de slaper is doorgerekend (scheduleStale false)');
  assert(sleepPayload().cpmResult !== null, 'geval 3: en cpmResult is gepersisteerd');
  assert(sleepPayload().isDirty === true, 'geval 3: het slapende document staat als gewijzigd');
  assert(S().isDirty === true, 'geval 3: het actieve document staat als gewijzigd');
  // Toepassen schrijft ONVOORWAARDELIJK, ook met "Automatisch berekenen" uit (spec §11.5) — de
  // store-default is al uit; dit pint dat applyDistribution zelf geen gate op autoCalcCPM heeft.
  assert(S().ui.autoCalcCPM === false, 'geval 3 opzet: automatisch berekenen staat standaard uit');

  // Geval 4: out-of-scope 'Buiten' behoudt zijn delay — scope-behoud over de documentgrens.
  assert(S().tasks.find(t => t.id === idBuiten)?.levelingDelay === 3, 'geval 4: out-of-scope delay overleeft Toepassen');

  // Geval 5: onderbrekingen worden echt geschreven, met herkomst.
  const gapTask = sleepPayload().tasks.find(t => t.id === idS1);
  assert(gapTask?.splitGaps?.some(g => g.source === 'leveling') === true, 'geval 5: splitGaps geschreven met herkomst');

  // Geval 6: per document ÉÉN history-event. Voor het actieve document is dat óók één stap in de
  // undo-diepte van de actieve scope; voor de slaper telt alleen zijn eigen eventreeks (die staat
  // buiten de actieve scope en is dus onzichtbaar voor Ctrl+Z zolang hij slaapt).
  assert(historyDepthsForActiveScope(S()).undoDepth === activeDepthBefore + 1, 'geval 6: actief — één stap erbij');
  assert(eventsFor(activeDocId, 'applied') === activeEventsBefore + 1, 'geval 6: actief — één history-event erbij');
  assert(eventsFor(sleepDocId, 'applied') === sleepEventsBefore + 1, 'geval 6: slapend — één history-event erbij');
  // En het record wijst naar precies dát event, per document.
  const recDocs = applyRecord!.docs;
  assert(recDocs.length === 2, 'geval 6: het record beschrijft beide documenten');
  assert(recDocs.every(d => S().historyEvents.some(e => e.id === d.historyEventId && e.state === 'applied')),
    'geval 6: elk vastgelegd event bestaat en staat op applied');

  // Geval 9 (spec §9 "Store-niveau"): geen extensie-events voor het SLAPENDE document — hooguit één,
  // van het actieve document dat via het gewone `applyLeveling`-pad draait.
  assert(seen.length <= 1, 'geval 9: extensie-events zijn niet gevuurd voor het slapende document');
  unsub();
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 7: "alles terugdraaien" zet beide documenten terug, inclusief de doorrekening.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 7, alles terugdraaien --');
{
  const report = S().undoDistribution(applyRecord!);
  assert(report.undoneDocIds.sort().join(',') === [activeDocId, sleepDocId].sort().join(','),
    `geval 7: beide documenten teruggedraaid (kreeg ${JSON.stringify(report)})`);
  assert(report.skippedDocIds.length === 0, 'geval 7: niets overgeslagen');
  assert(S().tasks.find(t => t.id === idActiveIn)?.levelingDelay === undefined, 'geval 7: actief document terug bij af');
  assert(sleepPayload().tasks.find(t => t.id === idS1)?.levelingDelay === undefined, 'geval 7: slapend document terug bij af');
  assert(sleepPayload().tasks.find(t => t.id === idS1)?.splitGaps === undefined, 'geval 7: en het leveling-gat is weg');
  assert(JSON.stringify(sleepPayload().cpmResult) === sleepCpmBefore, 'geval 7: ook de doorrekening van de slaper is teruggedraaid');
  assert(sleepPayload().isDirty === true, 'geval 7: de slaper blijft als gewijzigd gemarkeerd (spiegelt restoreSnapshot)');
  // De events staan op `undone` — dat is precies wat een gewone redo straks weer oppakt.
  assert(applyRecord!.docs.every(d => S().historyEvents.some(e => e.id === d.historyEventId && e.state === 'undone')),
    'geval 7: beide events staan op undone');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 8: terugdraaien weigert wat het niet meer herkent — bewerk het slapende document ná het
// toepassen (extra undo-stap erbovenop); "alles terugdraaien" mag dat document dan niet blind
// terugpoppen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 8, gedeeltelijk terugdraaien --');
{
  const outcome8 = S().applyDistribution(makeProposal(), scopeTaskIdsByDoc);
  assert(outcome8.ok === true, 'geval 8 opzet: opnieuw toegepast');
  const record2 = outcome8.ok ? outcome8.record : null;

  // Bewerk het slapende document ZELF (activeren, muteren, weer wegschakelen) — dat legt een JONGER
  // history-event voor dat document vast, bovenop wat applyDistribution er net achterliet. De poort
  // in `undoDistribution` eist dat het vastgelegde event nog het event is dat een gewone Ctrl+Z in
  // dat document zou kiezen; dat is het nu niet meer.
  S().switchDocument(sleepDocId);
  S().addTask({ name: 'Extra' });
  S().switchDocument(activeDocId);

  const report2 = S().undoDistribution(record2!);
  assert(report2.skippedDocIds.join(',') === sleepDocId, `geval 8: het slapende document wordt overgeslagen (kreeg ${JSON.stringify(report2)})`);
  assert(report2.undoneDocIds.join(',') === activeDocId, 'geval 8: het actieve document wordt WEL teruggedraaid');
  // De bewerking op het slapende document staat nog steeds (niet blind teruggepopt).
  assert(sleepPayload().tasks.some(t => t.name === 'Extra'), 'geval 8: de tussentijdse bewerking blijft staan');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 10 (nieuw na de merge met main): per-document-undo/redo via het GEWONE pad. Het event dat
// `applyDistribution` voor een slapend document achterliet, is precies het event dat Ctrl+Z in dat
// document kiest zodra je het activeert — en redo werkt daarna gewoon. Dat is de hele reden om het
// event in de app-globale chronologie te registreren in plaats van in de payload.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 10, per-document undo/redo na activeren --');
{
  // Opzet: geval 8 liet de slaper mét zijn delay achter (het terugdraaien sloeg hem bewust over).
  // Wis die eerst, anders zou het toepassen hieronder niets veranderen aan S1 en zou een undo
  // trivialiter "slagen" zonder iets te bewijzen.
  S().switchDocument(sleepDocId);
  S().clearLeveling();
  assert(S().tasks.find(t => t.id === idS1)?.levelingDelay === undefined, 'geval 10 opzet: de slaper begint zonder delay');
  S().switchDocument(activeDocId);

  const outcome10 = S().applyDistribution(makeProposal(), scopeTaskIdsByDoc);
  assert(outcome10.ok === true, 'geval 10 opzet: opnieuw toegepast');
  const record3 = outcome10.ok ? outcome10.record : null;
  const sleepEventId = record3!.docs.find(d => d.docId === sleepDocId)!.historyEventId;

  S().switchDocument(sleepDocId);
  assert(selectUndoHistoryEvent(S().historyEvents, sleepDocId)?.id === sleepEventId,
    'geval 10: na activeren kiest Ctrl+Z precies het event van het toepassen');
  assert(S().tasks.find(t => t.id === idS1)?.levelingDelay === 1, 'geval 10 opzet: de delay staat er');

  S().undo();
  assert(S().tasks.find(t => t.id === idS1)?.levelingDelay === undefined, 'geval 10: undo draait alleen dit document terug');

  S().redo();
  assert(S().tasks.find(t => t.id === idS1)?.levelingDelay === 1, 'geval 10: redo zet het weer terug');

  S().switchDocument(activeDocId);
  assert(S().tasks.find(t => t.id === idActiveIn)?.levelingDelay === 2, 'geval 10: het actieve document is ondertussen niet geraakt');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 11 (nieuw na de merge met main): een GESLOTEN document belandt netjes in `skippedDocIds`.
// `closeDocument` laat `removeSessionHistoryForDocument` de events van dat document opruimen, dus de
// poort in `undoDistribution` vindt het vastgelegde event simpelweg niet meer terug — precies de
// bedoeling: er is niets meer om terug te draaien, en de rest van het record moet gewoon door.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 11, gesloten document --');
{
  // Opzet: het actieve document draagt de delay van geval 10 nog. Wis 'm, anders zou het toepassen
  // hieronder niets aan `ActiefIn` veranderen en bewijst het terugdraaien niets.
  S().clearLeveling();
  assert(S().tasks.find(t => t.id === idActiveIn)?.levelingDelay === undefined, 'geval 11 opzet: het actieve document begint zonder delay');

  const outcome11 = S().applyDistribution(makeProposal(), scopeTaskIdsByDoc);
  assert(outcome11.ok === true, 'geval 11 opzet: opnieuw toegepast');
  const record4 = outcome11.ok ? outcome11.record : null;
  assert(S().tasks.find(t => t.id === idActiveIn)?.levelingDelay === 2, 'geval 11 opzet: en kreeg zijn delay');

  S().closeDocument(sleepDocId);
  assert(S().documents.some(d => d.id === sleepDocId) === false, 'geval 11 opzet: de slaper is gesloten');
  assert(S().historyEvents.some(e => e.deltas.some(d => d.kind === 'document-data' && d.documentId === sleepDocId)) === false,
    'geval 11: sluiten heeft de history-events van dat document opgeruimd');

  const report4 = S().undoDistribution(record4!);
  assert(report4.skippedDocIds.join(',') === sleepDocId, `geval 11: het gesloten document wordt overgeslagen (kreeg ${JSON.stringify(report4)})`);
  assert(report4.undoneDocIds.join(',') === activeDocId, 'geval 11: het actieve document wordt WEL teruggedraaid');
  assert(S().tasks.find(t => t.id === idActiveIn)?.levelingDelay === undefined, 'geval 11: en dat is ook echt gebeurd');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 12 (B1c-plan3 taak 12, spec §6a): een documentwissel/-sluiting/-opening laat het voorstel
// niet "vervallen met reden" maar SLUIT de verdeeldialoog (besluit eigenaar 2026-08-31). Alle drie
// de wegen lopen via `resetDocumentScopedUI` in `documentSlice`; deze check staat hier — bij de rest
// van het verdeel-schrijfpad — en niet in check-document-activation.ts, omdat het `applied`-record
// uit ditzelfde schrijfpad komt.
//
// AANGEPAST IN DE FIXRONDE OP B1c-ETAPPE 3 (bevinding B3): de TUNE-STATE overleeft die wissel juist
// wél. Ze werd hier tot deze ronde mee weggegooid, en daarmee `levelingDistribution.applied` — het
// record achter "Alles terugdraaien". Dat is de enige manier om een verdeling die over meerdere
// documenten geschreven is in één keer terug te draaien, terwijl je die documenten juist moet kunnen
// bekijken (dus wisselen) om te beoordelen of je haar wilt houden. Verdwenen/verschoven events vangt
// `undoDistribution` zelf af via `skippedDocIds` (geval 8 en 11 hierboven).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 12, documentwissel sluit de verdeeldialoog --');
{
  // Een NIET-leeg `applied`-record: precies de terugweg die in de oude opzet verloren ging.
  const keptRecord: DistributionApplyRecord = {
    libraryItemId: 'lib-1', appliedAt: '2026-09-05T00:00:00.000Z',
    docs: [{ docId: activeDocId, title: 'Actief', historyEventId: 'evt-fictief', historySequence: 1 }],
  };
  const openDialog = (): void => {
    S().setUI({
      showDistributionDialog: true,
      levelingDistribution: {
        companyId: 'bibliotheek-1', libraryItemId: 'lib-1', allowSplits: false,
        order: [], pinned: {}, ceilings: {}, applied: keptRecord,
      },
    });
  };
  const assertClosed = (via: string): void => {
    assert(S().ui.showDistributionDialog === false, `geval 12: ${via} sluit de dialoog`);
    assert(S().ui.levelingDistribution !== null, `geval 12: ${via} laat de tune-state staan`);
    assert(S().ui.levelingDistribution?.applied?.docs.length === 1,
      `geval 12: ${via} laat de terugweg ("alles terugdraaien") intact`);
  };

  openDialog();
  const extraDocId = S().newDocument();
  assertClosed('newDocument');

  openDialog();
  S().switchDocument(activeDocId);
  assertClosed('switchDocument');

  // Het ACTIEVE document sluiten wisselt naar een buur en loopt dus óók langs
  // `resetDocumentScopedUI`.
  openDialog();
  S().switchDocument(extraDocId);
  openDialog();
  S().closeDocument(extraDocId);
  assertClosed('closeDocument van het actieve document');

  // GRENS, bewust vastgelegd: een NIET-actief document sluiten raakt `resetDocumentScopedUI` niet
  // (dat pad wisselt geen document en mag dus ook de TaskDialog van het actieve document niet
  // dichtgooien). De dialoog blijft daar open; het voorstel vervalt in dat geval via de
  // vingerafdruk-bewaking in `useDistributionProposal` — het verdwenen document levert een
  // afwijkende vingerafdruk en dus `stale.edited` met zijn titel.
  const spareDocId = S().newDocument();
  S().switchDocument(activeDocId);
  openDialog();
  S().closeDocument(spareDocId);
  assert(S().ui.showDistributionDialog === true,
    'geval 12: een INACTIEF document sluiten laat de dialoog staan (invalidatie loopt via de vingerafdruk)');
  assert(S().ui.levelingDistribution !== null, 'geval 12: en laat de tune-state staan');
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (fails === 0) {
  console.log(`OK  apply-distribution-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  apply-distribution-check: ${fails} afwijking(en) van ${checks}`);
  process.exit(1);
}
