import { createAppStore } from '@/state/appStore';
import { __resetTimephasedLossNoticeForTests } from '@/state/timephasedLossNotice';
import type { DistributionProposal, DistributionDocResult } from '@/services/library/distribute';

declare const process: { exit(code: number): never };

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

const LOSS_KEY = 'notifications.levelingDelayRoundedToWorkdays';

const store = createAppStore();
const S = () => store.getState();

__resetTimephasedLossNoticeForTests();

function docResult(docId: string, title: string, delays: Record<string, number>): DistributionDocResult {
  return {
    docId, title, participated: true, cannotMove: false,
    delays, gaps: {}, projectEndBefore: '2026-08-07', projectEndAfter: '2026-08-07',
    endShiftWorkdays: 0, shortfalls: [],
  };
}

function proposalOf(docs: DistributionDocResult[]): DistributionProposal {
  return {
    libraryItemId: 'lib-1', blocked: null, docs,
    fixedLoadByDay: {}, residualByDay: {}, hasShortfall: false,
    bookingByDay: {}, afterLoadByDay: {}, afterIncomplete: false,
  };
}

const lossNoticesFor = (docId: string) =>
  S().ui.notifications.filter(n => n.messageKey === LOSS_KEY && n.dedupeKey === `leveling-delay-rounded-${docId}`);

const sleepPayload = (docId: string) => S().documents.find(d => d.id === docId)!.payload!;

console.log('-- distribution-loss-notice: afgebroken schrijfronde, dan geslaagde herpoging --');

S().setProject({ name: 'Minuten', startDate: '2026-08-03' });
const idM = S().addTask({ name: 'M' });
S().updateTask(idM, { levelingDelayMinutes: 480 });
const minDocId = S().activeDocumentId;

const activeDocId = S().newDocument();
S().setProject({ name: 'Actief', startDate: '2026-08-03' });
const idA = S().addTask({ name: 'A' });

const cycleDocId = S().newDocument();
S().setProject({ name: 'Cyclus', startDate: '2026-08-03' });
const idC1 = S().addTask({ name: 'C1' });
const idC2 = S().addTask({ name: 'C2' });
assert(S().addSequence({ predecessorId: idC1, successorId: idC2, type: 'FINISH_START', lagDays: 0 }) !== null,
  'opzet: relatie C1→C2 aangemaakt');
store.setState(s => {
  s.sequences.push({ id: 'seq-kring', predecessorId: idC2, successorId: idC1, type: 'FINISH_START', lagDays: 0 });
});
S().switchDocument(activeDocId);

const outcome1 = S().applyDistribution(proposalOf([
  docResult(activeDocId, 'Actief', { [idA]: 2 }),
  docResult(minDocId, 'Minuten', { [idM]: 1 }),
  docResult(cycleDocId, 'Cyclus', { [idC1]: 1 }),
]), { [activeDocId]: [idA], [minDocId]: [idM], [cycleDocId]: [idC1, idC2] });

assert(outcome1.ok === false && outcome1.reason === 'scratch-failed',
  `eerste poging breekt af op de cyclus-slaper (kreeg ${JSON.stringify(outcome1)})`);
assert(outcome1.ok === false && outcome1.docId === cycleDocId, 'de afbreking benoemt het cyclusdocument');
assert(lossNoticesFor(minDocId).length === 0, 'na de afgebroken ronde is er geen verliesmelding gepusht');
assert(sleepPayload(minDocId).tasks.find(t => t.id === idM)?.levelingDelayMinutes === 480,
  'het slapende document is onaangeraakt: de minuten staan er nog');

S().closeDocument(cycleDocId);
if (S().activeDocumentId !== activeDocId) S().switchDocument(activeDocId);

const outcome2 = S().applyDistribution(proposalOf([
  docResult(activeDocId, 'Actief', { [idA]: 2 }),
  docResult(minDocId, 'Minuten', { [idM]: 1 }),
]), { [activeDocId]: [idA], [minDocId]: [idM] });

assert(outcome2.ok === true, `de herpoging zonder cyclusdocument slaagt (kreeg ${JSON.stringify(outcome2)})`);
const mAfter = sleepPayload(minDocId).tasks.find(t => t.id === idM);
assert(mAfter?.levelingDelayMinutes === undefined, 'de herpoging voerde het verlies door: minuten gewist');
assert(mAfter?.levelingDelay === 1, 'en de nieuwe vertraging staat erop');
assert(lossNoticesFor(minDocId).length === 1,
  `de geslaagde herpoging meldt het verloren minuten wél, precies één keer (kreeg ${lossNoticesFor(minDocId).length})`);

console.log('-- distribution-loss-notice: zonder eerdere afbreking blijft het precies één melding --');

const min2DocId = S().newDocument();
S().setProject({ name: 'Minuten2', startDate: '2026-08-03' });
const idM2 = S().addTask({ name: 'M2' });
S().updateTask(idM2, { levelingDelayMinutes: 240 });
S().switchDocument(activeDocId);

const scope2 = { [activeDocId]: [idA], [min2DocId]: [idM2] };
const firstApply = S().applyDistribution(proposalOf([
  docResult(activeDocId, 'Actief', { [idA]: 2 }),
  docResult(min2DocId, 'Minuten2', { [idM2]: 1 }),
]), scope2);
assert(firstApply.ok === true, `eerste poging zonder afbreking slaagt (kreeg ${JSON.stringify(firstApply)})`);
assert(lossNoticesFor(min2DocId).length === 1,
  `eerste geslaagde ronde meldt precies één keer (kreeg ${lossNoticesFor(min2DocId).length})`);

S().switchDocument(min2DocId);
S().updateTask(idM2, { levelingDelayMinutes: 240 });
S().switchDocument(activeDocId);
const secondApply = S().applyDistribution(proposalOf([
  docResult(activeDocId, 'Actief', { [idA]: 3 }),
  docResult(min2DocId, 'Minuten2', { [idM2]: 2 }),
]), scope2);
assert(secondApply.ok === true, `tweede ronde slaagt (kreeg ${JSON.stringify(secondApply)})`);
assert(sleepPayload(min2DocId).tasks.find(t => t.id === idM2)?.levelingDelayMinutes === undefined,
  'tweede ronde voerde opnieuw verlies door: minuten weer gewist');
assert(lossNoticesFor(min2DocId).length === 1,
  `tweede verlies in hetzelfde document meldt NIET opnieuw (kreeg ${lossNoticesFor(min2DocId).length})`);

if (fails === 0) {
  console.log(`OK  distribution-loss-notice: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  distribution-loss-notice: ${fails} afwijking(en) van ${checks}`);
  process.exit(1);
}
