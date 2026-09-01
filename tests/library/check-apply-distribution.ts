// check-apply-distribution.ts — B1c-plan3 taak 6 (spec §5/§9 "Store-niveau"). Toepassen schrijft in
// het actieve document én in de slapers; "alles terugdraaien" zet alles terug, inclusief de
// doorrekening. Fixtures via `createAppStore()` + `newDocument()` (echte documenten, echte
// payloads) — de `DistributionProposal` zelf wordt met de hand gebouwd (de afleiding uit een echte
// `computeDistribution`-run is al gedekt door `check-distribute.ts`; hier staat uitsluitend het
// schrijfpad op de proef).
//
// Draait via run.sh. Exit 0 = alles groen.
import { createAppStore } from '@/state/appStore';
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
    ...overrides,
  };
}
const scopeTaskIdsByDoc = { [activeDocId]: [idActiveIn], [sleepDocId]: [idS1] };

function sleepPayload() {
  return S().documents.find(d => d.id === sleepDocId)!.payload!;
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 1: geblokkeerd voorstel schrijft NIETS.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 1, geblokkeerd --');
{
  const blocked = makeProposal({ blocked: { reason: 'MATERIAL_ITEM', docIds: [] } });
  const before = JSON.stringify(S().tasks);
  const record = S().applyDistribution(blocked, scopeTaskIdsByDoc);
  assert(record === null, 'geval 1: blocked ⇒ geen record');
  assert(JSON.stringify(S().tasks) === before, 'geval 1: het actieve document is niet aangeraakt');
  assert(S().tasks.find(t => t.id === idActiveIn)?.levelingDelay === undefined, 'geval 1: ActiefIn heeft nog geen delay');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2: een tekort blokkeert Toepassen (spec §4 stap 3) — een geldige preview, geen schrijfpad.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 2, tekort blokkeert --');
{
  const shortfall = makeProposal({ hasShortfall: true });
  const record = S().applyDistribution(shortfall, scopeTaskIdsByDoc);
  assert(record === null, 'geval 2: hasShortfall ⇒ geen record');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3, 4, 5, 6: het echte Toepassen — actief + slapend, scope-behoud, gaten, undo-diepte.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 3-6, schrijven over actief + slapend --');
let applyRecord: DistributionApplyRecord | null;
{
  const seen: unknown[] = [];
  const unsub = subscribeExtensionEvent(HOST_EVENTS.scheduleCalculated, (d) => seen.push(d));

  const activeDepthBefore = S().undoStack.length;
  const sleepDepthBefore = sleepPayload().undoStack.length;

  applyRecord = S().applyDistribution(makeProposal(), scopeTaskIdsByDoc);
  assert(applyRecord !== null, 'geval 3: applyDistribution levert een record');

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

  // Geval 6: per document ÉÉN undo-stap.
  assert(S().undoStack.length === activeDepthBefore + 1, 'geval 6: actief — één stap erbij');
  assert(sleepPayload().undoStack.length === sleepDepthBefore + 1, 'geval 6: slapend — één stap erbij');

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
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 8: terugdraaien weigert wat het niet meer herkent — bewerk het slapende document ná het
// toepassen (extra undo-stap erbovenop); "alles terugdraaien" mag dat document dan niet blind
// terugpoppen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-distribution: geval 8, gedeeltelijk terugdraaien --');
{
  const record2 = S().applyDistribution(makeProposal(), scopeTaskIdsByDoc);
  assert(record2 !== null, 'geval 8 opzet: opnieuw toegepast');

  // Bewerk het slapende document ZELF (activeren, muteren, weer wegschakelen) — een extra undo-stap
  // op zijn stack, bovenop wat applyDistribution er net op zette.
  S().switchDocument(sleepDocId);
  S().addTask({ name: 'Extra' });
  S().switchDocument(activeDocId);

  const report2 = S().undoDistribution(record2!);
  assert(report2.skippedDocIds.join(',') === sleepDocId, `geval 8: het slapende document wordt overgeslagen (kreeg ${JSON.stringify(report2)})`);
  assert(report2.undoneDocIds.join(',') === activeDocId, 'geval 8: het actieve document wordt WEL teruggedraaid');
  // De bewerking op het slapende document staat nog steeds (niet blind teruggepopt).
  assert(sleepPayload().tasks.some(t => t.name === 'Extra'), 'geval 8: de tussentijdse bewerking blijft staan');
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (fails === 0) {
  console.log(`OK  apply-distribution-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  apply-distribution-check: ${fails} afwijking(en) van ${checks}`);
  process.exit(1);
}
