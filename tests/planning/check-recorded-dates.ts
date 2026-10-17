/**
 * Batterij voor "datums zoals opgeslagen" (issue #63).
 *
 * De functie bestaat omdat een via P6 → IFC geïmporteerde planning datums draagt maar vaak geen
 * sluitende logica: herberekening verschuift de datums en de bron is dan onzichtbaar. Deze batterij
 * bewaakt de pure laag (Taak 2 van het implementatieplan):
 *  - de laagkeuze (early-laag alleen bij een VOLLEDIG early-paar, anders schedule-laag bij een
 *    volledig schedule-paar, anders geen uitspraak — MOET 1 + MOET 4 uit de kwaliteitsreview),
 *  - de verschiltelling (countShiftedTasks),
 *  - de reconstructie van cpmResult zonder solve (wat wél en wat NIET beweerd mag worden).
 * Betreden/verlaten en de undo-keten horen NIET bij deze batterij — die laag hangt pas in een
 * latere taak van het plan (store/laadpad/UI) en wordt daar apart getest.
 *
 * TZ-gevoelig: draait in run.sh vijf keer onder verschillende tijdzones. Gebruik daarom uitsluitend
 * vaste ISO-datums, nooit `new Date()` zonder anker.
 */
import {
  applyRecordedTimesToTasks,
  captureRecordedDates,
  countShiftedTasks,
  cpmResultFromRecorded,
  shiftedTaskIds,
  type RecordedTime,
} from '@/engine/scheduler/recordedDates';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import { createAppStoreContext, useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { LOCALES } from '../../scripts/i18n-tools';
import { recordedDatesActiveKey, recordedDatesTaskMissingKey, recordedDatesTaskShownKey } from '@/components/layout/recordedDatesNoticeText';
import { recordedTaskMark, recordedTaskWillShift, unrecordedExportGate } from '@/state/recordedDatesSelectors';
import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { CSV_FIXTURE_UNREADABLE_DATES } from '../fixtures/recordedTimesFormats';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { IFC_TASKTIME_SLOTS, TASKTIME_SLOT } from '@/services/ifc/ifcTaskSlots';
import { externIfc, taskArgs } from '../fixtures/recordedDatesIfc';
import {
  leftRecordedDatesMode,
  needsExitRecompute,
  type RecordedDatesObservation,
} from '@/state/recordedDatesExit';
import { markScheduleStale } from '@/state/transaction';
import { ensureFreshSchedule } from '@/services/mcp/staleGuard';
import type { ExternalLink } from '@/types/task';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const S = () => useAppStore.getState();

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

/** Minimale bladtaak; alleen de velden die deze batterij leest. Derde parameter (KLEIN-14,
 *  kwaliteitsreview) voor top-level `Task`-velden zoals `deadline`, die niet op `Task['time']` zitten
 *  en anders met een losse object-spread per callsite herhaald zouden moeten worden. */
const mk = (id: string, o: Partial<Task['time']> = {}, extra: Partial<Task> = {}): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 5, parentId: null, childIds: [], resourceIds: [],
  time: {
    durationType: 'WORKTIME', durationUnit: o.durationUnit ?? (o.durationMinutes != null ? 'hours' : 'days'), scheduleDuration: 5,
    scheduleStart: '2026-03-02', scheduleFinish: '2026-03-06',
    earlyStart: '2026-03-02', earlyFinish: '2026-03-06',
    lateStart: '2026-03-02', lateFinish: '2026-03-06',
    freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    ...o,
  },
  ...extra,
});

// ── (1) Laagkeuze: early vs. schedule, per taak (niet per veld) ──────────────────────────────────
// Bestand gaf GEEN rekenslots maar WEL het schedule-paar ⇒ schedule* is "zoals opgeslagen", niet de
// door de lezer ingevulde earlyStart-van-vandaag. (Dit is het geval van issue #63: een P6-export die
// alleen ScheduleStart/ScheduleFinish vult — beide dus aanwezig in recordedFields, MOET 1.)
const geen = captureRecordedDates(
  [mk('a', { earlyStart: '2099-01-01', earlyFinish: '2099-01-05' })],
  { a: ['scheduleStart', 'scheduleFinish'] },
);
eq('1a zonder rekenslots valt terug op scheduleStart', geen.times['a'].start, '2026-03-02');
eq('1b zonder rekenslots valt terug op scheduleFinish', geen.times['a'].finish, '2026-03-06');
eq('1c zonder rekenslots geen speling beweerd', geen.times['a'].totalFloat, undefined);
eq('1d zonder rekenslots geen kritiek beweerd', geen.times['a'].isCritical, undefined);
eq('1e zonder rekenslots geen lateStart beweerd', geen.times['a'].lateStart, undefined);
eq('1f zonder rekenslots geen lateFinish beweerd', geen.times['a'].lateFinish, undefined);
eq('1g zonder rekenslots geen vrije speling beweerd', geen.times['a'].freeFloat, undefined);

// Bestand gaf ze WEL ⇒ early* wint (en symmetrisch: late*/freeFloat winnen ook als ze aanwezig zijn).
const wel = captureRecordedDates(
  [mk('a', {
    earlyStart: '2026-04-01', earlyFinish: '2026-04-08',
    lateStart: '2026-04-02', lateFinish: '2026-04-09',
    totalFloat: 3, freeFloat: 2, isCritical: true,
  })],
  { a: ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'freeFloat', 'isCritical'] },
);
eq('1h met rekenslots wint earlyStart', wel.times['a'].start, '2026-04-01');
eq('1i met rekenslots wint earlyFinish', wel.times['a'].finish, '2026-04-08');
eq('1j met rekenslots komt speling mee', wel.times['a'].totalFloat, 3);
eq('1k met rekenslots komt kritiek mee', wel.times['a'].isCritical, true);
eq('1l met rekenslots komt lateStart mee', wel.times['a'].lateStart, '2026-04-02');
eq('1m met rekenslots komt lateFinish mee', wel.times['a'].lateFinish, '2026-04-09');
eq('1n met rekenslots komt vrije speling mee', wel.times['a'].freeFloat, 2);

// Geen aanwezigheidsdata (niet-IFC-import) ⇒ helemaal niets vastleggen.
eq('1o zonder recordedFields geen enkele taak', Object.keys(captureRecordedDates([mk('a')], undefined).times), []);

// MOET 4 (kwaliteitsreview, beslissing): een HALF early-paar wordt NIET aangevuld met de andere
// laag — de laag wordt één keer per taak gekozen. `earlyStart` is aanwezig maar `earlyFinish` niet;
// het volledige schedule-paar IS aanwezig, dus de hele taak valt op de schedule-laag (niet een
// samengesteld paar van earlyStart + scheduleFinish, wat een uitspraak zou zijn die het bestand
// nooit deed en zelfs finish-vóór-start had kunnen opleveren).
const halfEarly = captureRecordedDates(
  [mk('a', { earlyStart: '2026-04-01', scheduleStart: '2026-03-02', scheduleFinish: '2026-03-06' })],
  { a: ['earlyStart', 'scheduleStart', 'scheduleFinish'] }, // earlyFinish ontbreekt bewust
);
eq('1p half early-paar ⇒ hele taak op schedule-laag (start)', halfEarly.times['a'].start, '2026-03-02');
eq('1q half early-paar ⇒ hele taak op schedule-laag (finish)', halfEarly.times['a'].finish, '2026-03-06');

// Het NORMALE pad voor élk eigen OPS-bestand (hercontrole kwaliteitsreview): een door OPS zelf
// geschreven bestand vult altijd alle negen slots (zie check-ifc-roundtrip.ts (1b)), dus "beide paren
// compleet, early wint" is niet een randgeval maar de standaardsituatie voor elk eigen bestand — en
// rustte tot nu toe alleen op de ongeteste if/else-if.
const beideCompleet = captureRecordedDates(
  [mk('a', { earlyStart: '2026-04-01', earlyFinish: '2026-04-08' })], // scheduleStart/-Finish blijven de mk-default 2026-03-02/-06
  { a: ['earlyStart', 'earlyFinish', 'scheduleStart', 'scheduleFinish'] },
);
eq('1v beide paren compleet ⇒ early wint (start)', beideCompleet.times['a'].start, '2026-04-01');
eq('1w beide paren compleet ⇒ early wint (finish)', beideCompleet.times['a'].finish, '2026-04-08');

// MOET 1 + MOET 4: geen van beide paren compleet ⇒ geen uitspraak, taak wordt overgeslagen.
const geenPaarCompleet = captureRecordedDates([mk('a', { earlyStart: '2026-04-01' })], { a: ['earlyStart'] });
eq('1r geen compleet paar ⇒ taak niet vastgelegd', Object.keys(geenPaarCompleet.times), []);
eq('1s geen compleet paar ⇒ ook niet in total', geenPaarCompleet.total, 0);

// MOET 1 (KRITIEK, kwaliteitsreview): een IFCTASK ZONDER IfcTaskTime krijgt in ifcReader.ts een
// synthetische "vandaag"-tijd (`createDefaultTaskTime`) én `recordedFields[id] = []` (leeg, niet
// ontbrekend — zie check-ifc-roundtrip.ts §9r). Met een lege presence-lijst is GEEN van beide paren
// compleet, dus deze taak moet volledig worden overgeslagen: niet in `times`, niet in `total`. Zonder
// deze guard zou `scheduleStart` hieronder (hier bewust een absurde placeholder, model voor "vandaag")
// als een echte opgeslagen datum zijn gelezen — precies de kritieke bevinding.
const zonderIfcTaskTime = captureRecordedDates(
  [mk('a', { scheduleStart: '2099-09-09', scheduleFinish: '2099-09-13' })],
  { a: [] },
);
eq('1t taak zonder IfcTaskTime landt niet in times', Object.keys(zonderIfcTaskTime.times), []);
eq('1u taak zonder IfcTaskTime telt niet mee in total', zonderIfcTaskTime.total, 0);

// ── (1B) Bron-orakel — laag 0 (XER-etappeplan §3.3, taak T3) ──────────────────
// De derde parameter (`recordedTimes`) heeft VOORRANG boven `recordedFields` — de twee kanalen
// worden nooit gemengd. `mk('a', ...)` zet hier bewust een early-paar dat de early-laag zou geven
// (2099-...) om het contrast met de orakelwaarde (2026-07-...) scherp te maken: valt de
// implementatie stiekem terug op `recordedFields` zodra beide zijn meegegeven, dan geeft 1x/1y de
// 2099-datum en gaat deze case ROOD — dat IS het mutatiebewijs.
const oracle: Record<string, RecordedTime> = {
  a: {
    start: '2026-07-01', finish: '2026-07-05',
    lateStart: '2026-07-02', lateFinish: '2026-07-06',
    totalFloat: 1, freeFloat: 0.5, isCritical: false,
  },
};
const metOrakel = captureRecordedDates(
  [mk('a', { earlyStart: '2099-01-01', earlyFinish: '2099-01-05' })],
  { a: ['earlyStart', 'earlyFinish'] }, // zou zonder orakel de early-laag geven
  oracle,
);
eq('1x orakel wint van recordedFields (start)', metOrakel.times['a'].start, '2026-07-01');
eq('1y orakel wint van recordedFields (finish)', metOrakel.times['a'].finish, '2026-07-05');
eq('1z orakel draagt late/float/isCritical ongewijzigd door', {
  lateStart: metOrakel.times['a'].lateStart, lateFinish: metOrakel.times['a'].lateFinish,
  totalFloat: metOrakel.times['a'].totalFloat, freeFloat: metOrakel.times['a'].freeFloat,
  isCritical: metOrakel.times['a'].isCritical,
}, {
  lateStart: '2026-07-02', lateFinish: '2026-07-06',
  totalFloat: 1, freeFloat: 0.5, isCritical: false,
});
eq('1aa orakel-total = aantal entries in recordedTimes, niet in recordedFields', metOrakel.total, 1);

// Filtering op onbekende taak-ids: zelfde regel als de andere twee lagen (zie 2e hieronder).
const orakelMetOnbekend: Record<string, RecordedTime> = {
  a: { start: '2026-08-01', finish: '2026-08-02' },
  zzz: { start: '2026-08-03', finish: '2026-08-04' },
};
const gefilterd = captureRecordedDates([mk('a')], undefined, orakelMetOnbekend);
eq('1ab orakel filtert op taak-ids die echt in tasks zitten', Object.keys(gefilterd.times), ['a']);
eq('1ac orakel-total telt alleen de overgebleven, gefilterde entries', gefilterd.total, 1);

// Randgevallen, symmetrisch met (2e)/(2f) hieronder.
eq('1ad orakel + lege takenlijst ⇒ lege vastlegging',
  captureRecordedDates([], undefined, { a: { start: '2026-01-01', finish: '2026-01-02' } }),
  { times: {}, total: 0 });
eq('1ae leeg orakel-object (aanwezig, maar zonder entries) ⇒ lege vastlegging, GEEN terugval op recordedFields',
  captureRecordedDates([mk('a')], { a: ['scheduleStart', 'scheduleFinish'] }, {}),
  { times: {}, total: 0 });

// ── (2) Verschiltelling ──────────────────────────────────────────────────────
// Schedule-paar aanwezig (niet `[]`, zie MOET 1 hierboven — anders wordt de taak overgeslagen en
// blijft `times` leeg, wat deze sectie niets zou laten testen).
const basis = captureRecordedDates(
  [mk('a'), mk('b')],
  { a: ['scheduleStart', 'scheduleFinish'], b: ['scheduleStart', 'scheduleFinish'] },
);
// `total` apart van `tasks.length` getest: 'c' zit in de taaklijst maar NIET in recordedFields,
// dus `total` (2) moet hier uit elkaar lopen met `tasks.length` (3) — anders zou de mutatie
// `total: tasks.length` toevallig hetzelfde antwoord geven en onopgemerkt blijven.
eq('2a total = aantal vastgelegde taken, niet aantal meegegeven taken',
  captureRecordedDates(
    [mk('a'), mk('b'), mk('c')],
    { a: ['scheduleStart', 'scheduleFinish'], b: ['scheduleStart', 'scheduleFinish'] },
  ).total, 2);
eq('2b identiek ⇒ 0 verschoven', countShiftedTasks([mk('a'), mk('b')], basis.times), 0);
eq('2c één verschoven ⇒ 1',
  countShiftedTasks([mk('a', { earlyStart: '2026-05-01' }), mk('b')], basis.times), 1);
eq('2d onbekende taak telt niet mee', countShiftedTasks([mk('c')], basis.times), 0);

// 2b–2d op de GETOONDE datums (eigenaarsbesluit 2026-10-12, optie 1): een voltooide taak staat in de
// modus én herberekend op haar werkelijke datums, een lopende taak begint op haar werkelijke start.
// Een verschil in alleen de vroege datums (P6 zet die op de statusdatum, P3 zelfs een vroeg einde
// vóór die start) telt dus niet. Vorm uit rehab-2 (P3): vastgelegd 27-05 08:00 → 26-05 17:00.
{
  const p3Done: RecordedTime = { start: '2008-05-27T08:00', finish: '2008-05-26T17:00' };
  const done = mk('v', {
    earlyStart: '2008-03-03T08:00', earlyFinish: '2008-03-14T17:00', completion: 1,
    actualStart: '2008-03-03T08:00', actualFinish: '2008-03-14T17:00',
  }, { status: 'COMPLETED' });
  eq('2g voltooide taak: alleen de vroege datums wijken af ⇒ 0 verschoven', countShiftedTasks([done], { v: p3Done }), 0);
  eq('2g …ook als de herberekening een stomp op de statusdatum geeft (P6, C5)',
    countShiftedTasks([{ ...done, time: { ...done.time, earlyStart: '2008-05-27T08:00', earlyFinish: '2008-05-27T08:00' } }], { v: p3Done }), 0);
  const running = mk('l', {
    earlyStart: '2008-05-27T08:00', earlyFinish: '2008-06-06T17:00', completion: 0.4, actualStart: '2008-05-12T08:00',
  }, { status: 'STARTED' });
  eq('2h lopende taak: alleen de vroege start wijkt af (statusdatum vs werkelijke start) ⇒ 0',
    countShiftedTasks([running], { l: { start: '2008-05-12T08:00', finish: '2008-06-06T17:00' } }), 0);
  eq('2i lopende taak: het (rest)einde wijkt af ⇒ 1',
    countShiftedTasks([running], { l: { start: '2008-05-27T08:00', finish: '2008-06-13T17:00' } }), 1);
  eq('2j niet-gestarte taak: de vroege start wijkt af ⇒ 1 (ongewijzigd)',
    countShiftedTasks([mk('a', { earlyStart: '2026-03-03' })], basis.times), 1);
  // Een samenvatting met eigen vastlegging krijgt in de modus haar OPGESLAGEN voortgang terug; de
  // vergelijking bouwt die na. Bestand: 62 %, einde 20-03. Herberekend: voltooid, werkelijk einde 13-03.
  const phase = mk('f', {
    earlyStart: '2026-03-02', earlyFinish: '2026-03-13', completion: 1, actualStart: '2026-03-02', actualFinish: '2026-03-13',
  }, { status: 'COMPLETED', childIds: ['k'] });
  const phaseRec: RecordedTime = {
    start: '2026-03-02', finish: '2026-03-20',
    summaryProgress: { completion: 0.62, status: 'STARTED', actualStart: '2026-03-02' },
  };
  eq('2k samenvatting: opgeslagen 62 % ⇒ in de modus haar vastgelegde einde ⇒ wijkt af', countShiftedTasks([phase], { f: phaseRec }), 1);
  eq('2k …zonder opgeslagen voortgang zou ze op haar werkelijke einde staan (niets verschoven)',
    countShiftedTasks([phase], { f: { start: '2026-03-02', finish: '2026-03-20' } }), 0);
  // De lijst per taak (blok in het eigenschappenpaneel) gebruikt dezelfde vergelijking als de telling.
  const times2l = { v: p3Done, l: { start: '2008-05-27T08:00', finish: '2008-06-13T17:00' } };
  eq('2l lijst per taak = telling: voltooid ⇒ niet verschoven, lopend met ander einde ⇒ verschoven',
    shiftedTaskIds([done, running], times2l), [running.id]);
  // Buiten de modus markeert niets meer (geen aanbod-stand, eigenaar 2026-10-17).
  eq('2l2 buiten de modus geen markering', recordedTaskMark({ times: times2l, total: 2 }, false, running), undefined);
}

// KLEIN-13 (kwaliteitsreview) — randgevallen die niets breken maar tot nu toe niets vastlegden.
eq('2e een id in recordedFields dat niet in tasks zit ⇒ genegeerd',
  captureRecordedDates([mk('a')], { a: ['scheduleStart', 'scheduleFinish'], zzz: [] }).total, 1);
eq('2f lege takenlijst ⇒ lege vastlegging', captureRecordedDates([], { a: [] }), { times: {}, total: 0 });

// ── (3) Reconstructie ────────────────────────────────────────────────────────
const cal = createDefaultCalendar();
const volInfo = captureRecordedDates(
  [mk('a', { earlyStart: '2026-03-02', earlyFinish: '2026-03-06', totalFloat: 0, isCritical: true }),
   mk('b', { earlyStart: '2026-03-09', earlyFinish: '2026-03-13', totalFloat: 4, isCritical: false })],
  { a: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'],
    b: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'] },
);
const rec = cpmResultFromRecorded(volInfo.times, [mk('a'), mk('b')], cal);
eq('3a projecteinde = laatste opgeslagen finish', rec.projectEnd, '2026-03-13');
eq('3b kritiek pad uit isCritical', rec.criticalPath, ['a']);
eq('3c criticalPaths[0] === criticalPath', rec.criticalPaths[0], rec.criticalPath);
eq('3d speling uit het bestand', rec.tasks.get('b')?.totalFloat, 4);
truthy('3e geen foutveld', rec.error === undefined);

// Wat NIET in IFC staat, wordt niet verzonnen.
for (const [label, got] of [
  ['drivingSequenceIds', rec.drivingSequenceIds],
  ['truncatedLeadSequenceIds', rec.truncatedLeadSequenceIds],
  ['violatedConstraintTaskIds', rec.violatedConstraintTaskIds],
  ['outOfSequenceSequenceIds', rec.outOfSequenceSequenceIds],
  ['nearCriticalTaskIds', rec.nearCriticalTaskIds],
  ['hammockNoFinishDriverTaskIds', rec.hammockNoFinishDriverTaskIds],
] as const) {
  eq(`3f ${label} blijft leeg`, got, []);
}
eq('3g sequenceFreeFloat blijft leeg', rec.sequenceFreeFloat, {});
eq('3h floatPathByTask blijft leeg', rec.floatPathByTask, {});

// Zonder isCritical in het bestand: géén kritiek pad beweren. Schedule-paar aanwezig (MOET 1),
// anders wordt 'a' hier overgeslagen en toont deze reconstructie niets.
const zonderKritiek = cpmResultFromRecorded(
  captureRecordedDates([mk('a')], { a: ['scheduleStart', 'scheduleFinish'] }).times, [mk('a')], cal,
);
eq('3i zonder isCritical geen kritiek pad', zonderKritiek.criticalPath, []);
eq('3j zonder isCritical ook criticalPaths leeg', zonderKritiek.criticalPaths, [[]]);

// Dezelfde `zonderKritiek`-reconstructie (taak 'a' zonder late*/float/isCritical-rekenslots, dus
// scheduleStart/-Finish '2026-03-02'/'2026-03-06' als "zoals opgeslagen") legt ook de FALLBACKS
// vast die de docstring belooft: geen late-datum ⇒ gelijk aan de vroege, geen float ⇒ 0, geen
// isCritical ⇒ false.
eq('3k lateStart-fallback = start', zonderKritiek.tasks.get('a')?.lateStart, '2026-03-02');
eq('3l lateFinish-fallback = finish', zonderKritiek.tasks.get('a')?.lateFinish, '2026-03-06');
eq('3m totalFloat-default = 0', zonderKritiek.tasks.get('a')?.totalFloat, 0);
eq('3n freeFloat-default = 0', zonderKritiek.tasks.get('a')?.freeFloat, 0);
eq('3o isCritical-default = false', zonderKritiek.tasks.get('a')?.isCritical, false);

// KLEIN-13: `times` gevuld maar `tasks` leeg ⇒ niets te reconstrueren (de functie filtert `tasks`,
// niet `times`), en een volledig lege taaklijst/tijdlijst crasht niet en geeft het lege resultaat.
const legeTasks = cpmResultFromRecorded(volInfo.times, [], cal);
eq('3p times gevuld maar tasks leeg ⇒ leeg resultaat', legeTasks.tasks.size, 0);
eq('3q times gevuld maar tasks leeg ⇒ geen projecteinde', legeTasks.projectEnd, '');
const legeBeide = cpmResultFromRecorded({}, [], cal);
eq('3r volledig leeg ⇒ projectDuration 0', legeBeide.projectDuration, 0);

// ── (3B) applyRecordedTimesToTasks — gedeelde kern (XER-etappeplan §3.4, taak T3) ─────────────
// Rechtstreekse eenheidstest op de kern zelf (los van de winkel; de laadroute in sectie
// (8) hieronder test hem via de ECHTE store). Bewijst: (a) de teruggegeven `CPMResult` is
// identiek aan `cpmResultFromRecorded` op dezelfde `times`; (b) de taken worden IN-PLACE bijgewerkt
// met exact de oude terugvallen (`?? rec.start`/`?? 0`/`?? false`); (c) `interferingFloat`/
// `isNearCritical`/`floatPath` worden gewist — MUTATIEBEWIJS: haal één van de drie wis-regels uit
// `applyRecordedTimesToTasks` en 3ab/3ac/3ad hieronder gaat ROOD (uitgevoerd en teruggedraaid
// tijdens de bouw van deze taak, zie voortgangsrapport); (d) een taak zonder vastlegging blijft
// volledig onaangeroerd.
{
  const kernTasks = [
    mk('a', {
      earlyStart: '2026-09-01', earlyFinish: '2026-09-05',
      interferingFloat: 3, isNearCritical: true, floatPath: 0,
    }),
    mk('b'), // geen vastlegging voor 'b' ⇒ moet volledig ongemoeid blijven
  ];
  const kernTimes = captureRecordedDates(
    [mk('a', { earlyStart: '2026-09-01', earlyFinish: '2026-09-05', totalFloat: 2, isCritical: true })],
    { a: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'] },
  ).times;
  const kernResult = applyRecordedTimesToTasks(kernTasks, kernTimes, cal);
  const verwachtResult = cpmResultFromRecorded(kernTimes, kernTasks, cal);
  eq('3s applyRecordedTimesToTasks levert hetzelfde CPMResult als cpmResultFromRecorded op dezelfde times',
    kernResult, verwachtResult);
  const aNa = kernTasks.find((t) => t.id === 'a')!;
  const bNa = kernTasks.find((t) => t.id === 'b')!;
  eq('3t taak a — earlyStart bijgewerkt uit de vastlegging', aNa.time.earlyStart, '2026-09-01');
  eq('3u taak a — earlyFinish bijgewerkt uit de vastlegging', aNa.time.earlyFinish, '2026-09-05');
  eq('3v taak a — lateStart-terugval blijft ?? rec.start (geen late* in het bestand)', aNa.time.lateStart, '2026-09-01');
  eq('3w taak a — lateFinish-terugval blijft ?? rec.finish', aNa.time.lateFinish, '2026-09-05');
  eq('3x taak a — totalFloat komt uit het bestand (geen terugval nodig)', aNa.time.totalFloat, 2);
  eq('3y taak a — isCritical komt uit het bestand', aNa.time.isCritical, true);
  eq('3z taak b (geen vastlegging) — time volledig onaangeroerd', bNa.time, mk('b').time);
  eq('3aa taak b — earlyStart blijft de mk-default (bewijst dat filtering op aanwezigheid werkt)',
    bNa.time.earlyStart, '2026-03-02');
  eq('3ab taak a — interferingFloat gewist', aNa.time.interferingFloat, undefined);
  eq('3ac taak a — isNearCritical gewist', aNa.time.isNearCritical, undefined);
  eq('3ad taak a — floatPath gewist', aNa.time.floatPath, undefined);
}

// ── (4) Gemiste deadlines ─────────────────────────────────────────────────────
// `deadline` staat op Task zelf (niet op Task['time']) — vandaar `mk`'s derde parameter.
const overDeadline = mk('a', { earlyStart: '2026-03-02', earlyFinish: '2026-03-06' }, { deadline: '2026-03-05' });
const binnenDeadline = mk('b', { earlyStart: '2026-03-02', earlyFinish: '2026-03-04' }, { deadline: '2026-03-10' });
// Grensgeval (KLEIN-11, verving een tautologie): finish EXACT op de deadline is niet "voorbij" —
// de vergelijking is strikt `>`, dus dit hoort NIET gemeld te worden. Een mutatie naar `>=` zou dit
// wél melden en zonder deze case onopgemerkt blijven (4a alleen bewijst al `=== ['a']`, dus 'b'/'d'
// waren daar al triviaal uitgesloten).
const opDeadline = mk('d', { earlyStart: '2026-03-02', earlyFinish: '2026-03-06' }, { deadline: '2026-03-06' });
const infoDeadline = captureRecordedDates(
  [overDeadline, binnenDeadline, opDeadline],
  { a: ['earlyStart', 'earlyFinish'], b: ['earlyStart', 'earlyFinish'], d: ['earlyStart', 'earlyFinish'] },
);
const recDeadline = cpmResultFromRecorded(infoDeadline.times, [overDeadline, binnenDeadline, opDeadline], cal);
eq('4a finish voorbij deadline ⇒ gemeld, binnen/op de deadline niet', recDeadline.missedDeadlineTaskIds, ['a']);

// ── (5) projectDuration — regressietest voor de TZ-bug (issue-#63-review, MOET 1 van een vorige
// review-ronde) ────────────────────────────────────────────────────────────────────────────────
// `earlyStart`/`earlyFinish` in UUR-modus zijn "YYYY-MM-DDTHH:mm" ZONDER tijdzone-suffix — precies
// wat `formatInstant(d, 'hour')`/de IFC-lezer produceren. Zo'n string moet als UTC gelezen worden
// (`parseInstant`), niet als lokale tijd (`new Date(...)`): onder TZ=Pacific/Auckland gaf de
// `new Date(...)`-versie hier 4 i.p.v. 5. Draait mee in de tijdzone-matrix van run.sh, dus dit moet
// op alle vijf zones exact 5 geven.
const capHour = captureRecordedDates(
  [mk('a', {
    earlyStart: '2026-03-02T08:00', earlyFinish: '2026-03-06T16:00',
    totalFloat: 0, isCritical: true,
  })],
  { a: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'] },
);
const recHour = cpmResultFromRecorded(capHour.times, [mk('a')], cal);
eq('5a projectDuration TZ-onafhankelijk (uur-modus, ma t/m vr)', recHour.projectDuration, 5);

// ── (6) Mijlpaal-alleen-uitzondering (hercontrole kwaliteitsreview, volgend op GRAAG-6) ──────────
// `cpmResultFromRecorded` deelt sinds de vorige ronde `projectDurationOf` met de solver, INCLUSIEF de
// mijlpaal-alleen-uitzondering. Dat is een echte gedragswijziging (was voorheen bewust wég-
// gedocumenteerd als "afwijking 1") en stond tot nu toe zonder assertie.
const mijlpaalOpEenDag = mk('a', { earlyStart: '2026-03-02', earlyFinish: '2026-03-02' }, { isMilestone: true });
const recMijlpaal = cpmResultFromRecorded(
  captureRecordedDates([mijlpaalOpEenDag], { a: ['earlyStart', 'earlyFinish'] }).times,
  [mijlpaalOpEenDag], cal,
);
eq('6a uitsluitend mijlpaal op één dag ⇒ projectDuration 0', recMijlpaal.projectDuration, 0);

// Tegenhanger: een echte werk-taak (geen mijlpaal, scheduleDuration > 0 — de `mk`-default is 5) op
// één dag ⇒ wél 1: de uitzondering slaat NIET toe zodra er écht werk in de set zit.
const werkOpEenDag = mk('b', { earlyStart: '2026-03-02', earlyFinish: '2026-03-02' });
const recWerk = cpmResultFromRecorded(
  captureRecordedDates([werkOpEenDag], { b: ['earlyStart', 'earlyFinish'] }).times,
  [werkOpEenDag], cal,
);
eq('6b echte werk-taak op één dag ⇒ projectDuration 1', recWerk.projectDuration, 1);

// ── Gedeelde helpers voor de store-secties (7 t/m 9) ─────────────────────────────────────────────
// De IFC-fixture zelf staat in `tests/fixtures/recordedDatesIfc.ts` — gedeeld met tests/mcp, zodat
// beide suites over exact hetzelfde "geval van issue #63" praten.

/** Id van de taak met deze WBS-code in de LEVENDE store — na een load, dus niet het parse-resultaat. */
const idOfWbs = (wbs: string) => S().tasks.find((t) => t.wbsCode === wbs)!.id;
/** `earlyStart` van een taak in de levende store. */
const earlyStartOf = (id: string) => S().tasks.find((t) => t.id === id)!.time.earlyStart;

// ── (7) Detectie bij het laden ───────────────────────────────────────────────
// Bestand met vastgelegde datums die NIET uit de logica volgen: b staat vast op 2026-03-16 terwijl
// de FS-relatie hem direct ná a (finish 2026-03-06) zou plaatsen.
{
  const EXTERN = externIfc('');

  // Tussentijdse controle (plan-eis): bewijs dat de fixture ECHT twee taken mét taaktijd en een
  // werkende FS-relatie oplevert, los van wat de store ermee doet — anders test de rest hieronder
  // een vacuüm (de eerdere fout: de taskTime-ref stond op de verkeerde arg-index en de fixture gaf
  // dan gewoon "geen taaktijd" i.p.v. een fout).
  const rtExtern = readIFC(EXTERN);
  eq('7a fixture geeft twee taken', rtExtern.tasks.length, 2);
  eq('7b fixture geeft één FS-relatie', rtExtern.sequences.length, 1);
  const aId = rtExtern.tasks.find(t => t.wbsCode === '1.1')!.id;
  const bId = rtExtern.tasks.find(t => t.wbsCode === '1.2')!.id;
  truthy('7c a heeft écht een taaktijd (scheduleStart uit het bestand)', rtExtern.tasks.find(t => t.id === aId)!.time.scheduleStart === '2026-03-02');
  truthy('7d b heeft écht een taaktijd (scheduleStart uit het bestand)', rtExtern.tasks.find(t => t.id === bId)!.time.scheduleStart === '2026-03-16');
  truthy('7e de relatie loopt van a naar b', rtExtern.sequences[0].predecessorId === aId && rtExtern.sequences[0].successorId === bId);
  // Vier van de negen bewaakte slots gevuld (early- én schedule-paar), de rest ($) niet — bewijst
  // dat de aanwezigheidsregistratie per slot werkt, niet "alles of niets" per IfcTaskTime.
  eq('7f a meldt precies het early- en schedule-paar als aanwezig',
    rtExtern.recordedFields?.[aId], ['earlyStart', 'earlyFinish', 'scheduleStart', 'scheduleFinish']);
  eq('7g b meldt hetzelfde', rtExtern.recordedFields?.[bId], ['earlyStart', 'earlyFinish', 'scheduleStart', 'scheduleFinish']);

  // Nu door de ECHTE store en het ECHTE laadpad (fileSlice.applyLoadedProject), niet de pure laag
  // los aangeroepen — dit is precies het pad dat Taak 4 bouwt.
  S().newProject();
  S().applyLoadedProject(readIFC(EXTERN), { filePath: null, recompute: true });

  truthy('7h afwijking gedetecteerd: recordedDates is gezet', S().recordedDates !== null);
  eq('7i shifted telt de verschoven taak (b)', S().recordedDates?.shifted, 1);
  eq('7j total telt alle vastgelegde taken (a + b)', S().recordedDates?.total, 2);
  // Eigenaarsbesluit 2026-09-09 ("het moet altijd gaan zoals het nu bij XER werkt"): een IFC uit
  // een ANDER pakket (geen IFCAPPLICATION 'OPS', geen OPS_-pset ⇒ herkomst 'ifc') is een verse
  // import en gaat bij afwijkingen automatisch in de modus. Vóór dat besluit bood het alleen aan.
  eq('7k detectie zet de modus AAN voor een IFC uit een ander pakket (herkomst "ifc")', S().datesAsRecorded, true);
  eq('7k2 …met die herkomst op de vastlegging', S().recordedDates?.origin, 'ifc');

  // Tegenproef: een bestand dat de app ZELF schreef, levert geen aanbod op — de writer vult altijd
  // alle negen slots (zie check-ifc-roundtrip.ts (1b)) én runCPM heeft de datums al sluitend gemaakt
  // vóórdat er wordt opgeslagen, dus na het herladen kan er geen verschil zijn.
  S().newProject();
  const ownA = S().addTask({ name: 'Eigen A' });
  const ownB = S().addTask({ name: 'Eigen B' });
  S().addSequence({ predecessorId: ownA, successorId: ownB, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const ownIfc = writeIFC(buildWriteIFCInput(S()));

  S().newProject();
  S().applyLoadedProject(readIFC(ownIfc), { filePath: null, recompute: true });
  eq('7l eigen bestand geeft geen aanbod: recordedDates blijft null', S().recordedDates, null);

  // MOET (reviewronde): de kop-usecase van issue #63 zelf staat nog niet end-to-end getest. `EXTERN`
  // hierboven vult zowel early- als schedule-slots, dus daar loopt alleen de EARLY-laag door het
  // echte laadpad. Een P6-export vult typisch UITSLUITEND ScheduleStart/ScheduleFinish en laat alle
  // zeven rekenslots op `$` — precies het bestand waar `captureRecordedDates` de schedule-laag voor
  // heeft (de laagkeuze in recordedDates.ts, MOET 1/MOET 4). Zonder deze fixture bewijst niets dat
  // die laagkeuze het ook echt redt door het volledige laadpad heen, i.p.v. alleen in de pure-laag-
  // battery (sectie 1) hierboven.
  const ttArgsScheduleOnly = (o: { scheduleStart: string; scheduleFinish: string; duration: string }) => {
    const a: string[] = new Array(IFC_TASKTIME_SLOTS.length).fill('$');
    a[TASKTIME_SLOT.name] = "'T'";
    a[TASKTIME_SLOT.dataOrigin] = '.PREDICTED.';
    a[TASKTIME_SLOT.durationType] = '.WORKTIME.';
    a[TASKTIME_SLOT.scheduleDuration] = `'${o.duration}'`;
    a[TASKTIME_SLOT.scheduleStart] = `'${o.scheduleStart}'`;
    a[TASKTIME_SLOT.scheduleFinish] = `'${o.scheduleFinish}'`;
    // Alle zeven rekenslots (earlyStart t/m isCritical) blijven `$` — dit IS het punt van de fixture.
    return a.join(',');
  };
  const EXTERN_SCHEDULE_ONLY = [
    'ISO-10303-21;', 'HEADER;',
    "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('g1',$,'ExternSchedule',$,$,$,$,$,$);",
    `#9=IFCTASKTIME(${ttArgsScheduleOnly({ scheduleStart: '2026-03-02', scheduleFinish: '2026-03-06', duration: 'P5D' })});`,
    `#2=IFCTASK(${taskArgs({ guid: 'gTaskAS', name: 'A', wbs: '1.1', taskTimeRef: '#9' })});`,
    `#10=IFCTASKTIME(${ttArgsScheduleOnly({ scheduleStart: '2026-03-16', scheduleFinish: '2026-03-20', duration: 'P5D' })});`,
    `#3=IFCTASK(${taskArgs({ guid: 'gTaskBS', name: 'B', wbs: '1.2', taskTimeRef: '#10' })});`,
    "#4=IFCRELSEQUENCE('gSeqS',$,$,$,#2,#3,$,.FINISH_START.,$);",
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');

  // Tussentijdse controle: bewijs dat déze fixture — anders dan EXTERN — alléén het schedule-paar
  // meldt, niet het early-paar, vóórdat de rest van de test daarop leunt.
  const rtScheduleOnly = readIFC(EXTERN_SCHEDULE_ONLY);
  eq('7m fixture geeft twee taken', rtScheduleOnly.tasks.length, 2);
  const aIdS = rtScheduleOnly.tasks.find(t => t.wbsCode === '1.1')!.id;
  const bIdS = rtScheduleOnly.tasks.find(t => t.wbsCode === '1.2')!.id;
  eq('7n a meldt uitsluitend het schedule-paar (geen early-slots)', rtScheduleOnly.recordedFields?.[aIdS], ['scheduleStart', 'scheduleFinish']);
  eq('7o b meldt uitsluitend het schedule-paar', rtScheduleOnly.recordedFields?.[bIdS], ['scheduleStart', 'scheduleFinish']);

  // De pure laag kent de schedule-laag nog (de #63-laagkeuze, sectie 1)…
  const pureS = captureRecordedDates(rtScheduleOnly.tasks, rtScheduleOnly.recordedFields);
  eq('7p pure laag: de schedule-laag levert nog steeds een vastlegging (tegenproef voor 7q)', [pureS.total, pureS.times[bIdS]?.start], [2, '2026-03-16']);
  // …maar eigenaarsbesluit 2026-09-24 ("beperken", afbakening orkestrator): een VREEMD IFC met
  // uitsluitend ScheduleStart/ScheduleFinish vergelijkt invoer met invoer ⇒ geen vastlegging, geen
  // modus, geen aanbod. MUTATIEBEWIJS: `scheduleLayer: true` voor 'ifc' in `recordedDatesSource` ⇒
  // 7q/7r ROOD.
  S().newProject();
  S().applyLoadedProject(readIFC(EXTERN_SCHEDULE_ONLY), { filePath: null, recompute: true });
  eq('7q vreemd IFC met alleen ScheduleStart/-Finish: geen vastlegging en geen modus', [S().recordedDates, S().datesAsRecorded], [null, false]);
  // Tegenproef in dezelfde sectie: het vreemde IFC mét echte early-slots houdt de #63-route.
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('7r')), { filePath: null, recompute: true });
  eq('7r vreemd IFC mét early-slots: vastlegging en modus (de #63-route blijft)', [S().recordedDates?.total, S().datesAsRecorded], [2, true]);
}

// ── (7B) Standaard-aan bij het laden — bron-orakel (XER-etappeplan §3.5, taak T4) ─────────────
// Hergebruikt de fixture van (7) hierboven, maar routeert de vastlegging via het ORAKEL-kanaal
// (`recordedTimes`/`recordedTimesOrigin`) i.p.v. `recordedFields` — precies het contract dat
// `readXER` (bak 4) levert. Dit bestand blijft bewust reader-agnostisch: de synthetische
// `ImportResult` hieronder (gebouwd uit een ECHTE IFC-parse, dus geen verzonnen structuur) bewijst
// het LAADPAD-gedrag zonder aan een specifieke lezer te hangen; `check-xer-open-wiring.ts` bewijst
// hetzelfde met een echte XER.
{
  const rtOracleSource = readIFC(externIfc('7B'));
  const oracleTimes = captureRecordedDates(rtOracleSource.tasks, rtOracleSource.recordedFields).times;
  const asXer: ImportResult = {
    ...rtOracleSource,
    recordedFields: undefined,
    recordedTimes: oracleTimes,
    recordedTimesOrigin: 'xer',
  };

  S().newProject();
  const undoVoorLaad = S().historyEvents.filter(event => event.state === 'applied').length;
  S().applyLoadedProject(asXer, { filePath: null, recompute: true });

  eq('7u bron-orakel + restverschillen ⇒ modus staat AAN meteen na laden', S().datesAsRecorded, true);
  truthy('7v recordedDates is gevuld', S().recordedDates !== null);
  eq('7w shifted telt de verschoven taak (b)', S().recordedDates?.shifted, 1);
  eq('7w2 de vastlegging draagt de herkomst die de meldingstekst stuurt', S().recordedDates?.origin, 'xer');
  eq('7x scheduleStale is false in de modus (risico §5.1, expliciet gecontroleerd)', S().scheduleStale, false);
  truthy('7y cpmResult is de reconstructie (geen solve)', S().cpmResult !== null);
  eq('7z projectEnd komt uit het bestand (orakel), niet uit een herberekening', S().cpmResult?.projectEnd, '2026-03-20');
  eq('7aa het aanzetten bij het laden pusht GEEN undo-snapshot',
    S().historyEvents.filter(event => event.state === 'applied').length, undoVoorLaad);

  S().undo();
  eq('7ab undo() direct na het laden raakt de modus niet (er is niets om naar terug te gaan)',
    S().datesAsRecorded, true);
  eq('7ac …noch de vastlegging', S().recordedDates?.shifted, 1);

  // MUTATIEBEWIJS (O6-patroon): zet `recordedTimesOrigin` NIET ⇒ de modus blijft UIT na het laden,
  // ook al is exact hetzelfde orakel meegegeven. Bewijst dat de auto-aan-route uitsluitend op de
  // herkomstvlag draait, niet op de loutere aanwezigheid van `recordedTimes` — en dus dat een
  // import zonder herkomststempel (extensie-importer) het aanbiedende #63-gedrag houdt.
  // Sinds 2026-09-09 draagt élke lezer een herkomst (ook `readIFC`: 'ifc'/'ifc-own'), dus de
  // "geen herkomst"-route moet hier EXPLICIET worden nagebootst — het geval van een importer
  // zonder stempel (bv. een extensie-importer).
  const asUnknownOrigin: ImportResult = {
    ...rtOracleSource, recordedFields: undefined, recordedTimes: oracleTimes, recordedTimesOrigin: undefined,
  };
  S().newProject();
  S().applyLoadedProject(asUnknownOrigin, { filePath: null, recompute: true });
  eq('7ad zonder recordedTimesOrigin blijft de modus UIT (O6-mutatiebewijs)', S().datesAsRecorded, false);
  // Eigenaarsbesluit 2026-09-24 ("beperken"): zonder herkomst ook geen aanbod meer.
  eq('7ae …en er is ook geen aanbod (geen bron met echte rekenuitvoer)', S().recordedDates, null);

  // Heropen-beleid (orkestratorbesluit, XER-etappe laag 3, 2026-09-05): 'xer-archive' — een
  // heropende IFC met XER-archief (T5) — biedt de modus alleen AAN, net als 'xer-archive' zonder
  // enige herkomst hierboven. Alleen 'xer' (verse import) zet 'm automatisch AAN. MUTATIEBEWIJS:
  // stelde `applyRecordedDatesOnLoad` 'xer-archive' gelijk aan 'xer' (`origin !== undefined` i.p.v.
  // `origin === 'xer'`), dan zou 7ag hieronder `true` worden en dus ROOD slaan.
  const asXerArchive: ImportResult = {
    ...rtOracleSource, recordedFields: undefined, recordedTimes: oracleTimes,
    recordedTimesOrigin: 'xer-archive',
  };
  S().newProject();
  S().applyLoadedProject(asXerArchive, { filePath: null, recompute: true });
  eq('7ag "xer-archive" (heropende IFC met XER-archief, zonder vlag) gaat NIET in de modus, NIET gelijk aan "xer"',
    S().datesAsRecorded, false);
  // Geen aanbod-stand meer (eigenaar, 2026-10-17, optie 1): de app vergeet de opgeslagen datums.
  eq('7ah …en vergeet de opgeslagen datums (geen aanbod)', S().recordedDates, null);

  // Heropen-beleid OPTIE B (eigenaarsbesluit 2026-09-09): dezelfde heropening gaat WEL automatisch
  // aan zolang het bestand zelf zegt dat het sinds de import ongewijzigd is (`importPristine`,
  // uit `OPS_ImportProvenance`). MUTATIEBEWIJS: laat `prepared.importPristine` weg uit
  // `applyRecordedDatesOnLoad` ⇒ 7aj2 slaat ROOD.
  S().newProject();
  S().applyLoadedProject({ ...asXerArchive, importPristine: true }, { filePath: null, recompute: true });
  eq('7aj2 "xer-archive" + ongewijzigd sinds import ⇒ automatisch AAN (optie B)', S().datesAsRecorded, true);
  eq('7aj3 …en de payload draagt de vlag', S().importPristine, true);

  // De formaten met echte rekenuitvoer gedragen zich als XER (eigenaarsbesluit 2026-09-09): verse
  // import ⇒ aan. ('ifc' draagt hier een orakel, dus laag 0 — de laag-2-uitsluiting staat in 7q.)
  for (const origin of ['p6xml', 'mspdi', 'mpp', 'ifc'] as const) {
    S().newProject();
    S().applyLoadedProject({ ...asUnknownOrigin, recordedTimesOrigin: origin }, { filePath: null, recompute: true });
    eq(`7aj4 verse import met herkomst "${origin}" ⇒ automatisch AAN`, S().datesAsRecorded, true);
    eq(`7aj5 …en een verse import is per definitie ongewijzigd sinds import (${origin})`, S().importPristine, true);
    eq(`7aj5b …en de vastlegging onthoudt de bron (${origin})`, S().recordedDates?.sourceFormat, origin);
  }
  // Eigenaarsbesluit 2026-09-24 ("beperken"): CSV vergelijkt invoer met invoer ⇒ niets.
  // MUTATIEBEWIJS: 'csv' in `recordedDatesSource` toelaten ⇒ 7aj4c ROOD.
  S().newProject();
  S().applyLoadedProject({ ...asUnknownOrigin, recordedTimesOrigin: 'csv' }, { filePath: null, recompute: true });
  eq('7aj4c CSV: geen vastlegging, geen modus, geen aanbod', [S().recordedDates, S().datesAsRecorded], [null, false]);
  // 'ifc-own' ZONDER bron (orkestratorbesluit 2026-09-24): onze eigen oude solve tegen de nieuwe ⇒
  // niets, ook met de vlag. MET bron: de app schrijft `SourceFormat` alleen bij opslaan IN de modus
  // (`ifcSaveInput.ts`), dus het bestand opent weer in de modus, ook zonder vlag ("zoals je het
  // achterliet", eigenaar 2026-10-17; vervangt optie B van #167).
  // MUTATIEBEWIJS: 'ifc-own' zonder `recordedSourceFormat` toelaten ⇒ 7aj6/7aj6b ROOD;
  // `|| parsed.recordedSourceFormat !== undefined` weg uit `applyRecordedDatesOnLoad` ⇒ 7aj6c ROOD.
  S().newProject();
  S().applyLoadedProject({ ...asUnknownOrigin, recordedTimesOrigin: 'ifc-own' }, { filePath: null, recompute: true });
  eq('7aj6 heropend eigen IFC zonder bron: niets', [S().datesAsRecorded, S().recordedDates], [false, null]);
  S().newProject();
  S().applyLoadedProject({ ...asUnknownOrigin, recordedTimesOrigin: 'ifc-own', importPristine: true }, { filePath: null, recompute: true });
  eq('7aj6b …ook niet met de vlag "ongewijzigd sinds import"', [S().datesAsRecorded, S().recordedDates], [false, null]);
  S().newProject();
  S().applyLoadedProject({ ...asUnknownOrigin, recordedTimesOrigin: 'ifc-own', recordedSourceFormat: 'mspdi' }, { filePath: null, recompute: true });
  eq('7aj6c heropend eigen IFC mét bron (in de modus opgeslagen), zonder vlag: modus aan, vastlegging terug',
    [S().datesAsRecorded, S().recordedDates !== null, S().importPristine], [true, true, false]);
  S().newProject();
  S().applyLoadedProject({ ...asUnknownOrigin, recordedTimesOrigin: 'ifc-own', recordedSourceFormat: 'mspdi', importPristine: true }, { filePath: null, recompute: true });
  eq('7aj7 heropend eigen IFC mét bron en vlag ⇒ automatisch AAN', S().datesAsRecorded, true);
}

// ── (7C) Crashherstel raakt de #63-route NIET ────────────────────────────────────────────────
// `restoreDocuments` leest de modusvlag van vóór de crash sinds manifest v4 als FEIT uit het
// recovery-manifest (`RecoveryDocInput.datesAsRecorded`, `applyRecordedDatesOnLoad(..., restoredMode)`
// in `documentActivation.ts`) — geen heuristiek meer. Deze sectie pint de tegenkant vast: een gewoon
// #63-document (IFC/CSV/MSPDI/MPP/P6XML) dat met `datesAsRecorded: false` in het manifest stond,
// komt terug ZONDER modus en vergeet de opgeslagen datums (geen aanbod-stand meer, eigenaar 2026-10-17). MUTATIEBEWIJS: geef `restoredMode` in
// `applyRecordedDatesOnLoad` voorrang op de manifestvlag (`restoredMode ?? true`) ⇒ 7aj slaat ROOD.
{
  const parsed = readIFC(externIfc('7C'));
  const input = recoveryInputFromParsed(parsed, { id: 'rec-63', filePath: null, isDirty: true, datesAsRecorded: false });
  S().newProject();
  S().restoreDocuments([input], 'rec-63');
  eq('7aj crashherstel van een gewoon #63-document zet de modus NIET aan', S().datesAsRecorded, false);
  eq('7ak …en vergeet de opgeslagen datums (geen aanbod)', S().recordedDates, null);
}

/**
 * Secties 8 t/m 13 testen het betreden en verlaten van de modus. De uitgangstoestand is een
 * heropend eigen IFC, nagebootst op de gedeelde #63-fixture. BUITEN de modus opgeslagen
 * (`offerOnly`: bewerkt, en zonder `SourceFormat`, want dat schrijft de app alleen in de modus) ⇒ de
 * app opent met de berekening. IN de modus opgeslagen (`inMode`: met `SourceFormat`) ⇒ de app opent
 * in de modus. "Zoals je het achterliet" (eigenaar, 2026-10-17); er is geen aanbod-stand meer.
 */
const offerOnly = (ifcText: string): ImportResult => ({
  ...readIFC(ifcText), recordedTimesOrigin: 'ifc-own', recordedSourceFormat: undefined, importPristine: false,
});
// Hetzelfde eigen IFC, maar IN de modus opgeslagen en ONBEWERKT sinds de import: dat opent in de modus.
const inMode = (ifcText: string): ImportResult => ({ ...offerOnly(ifcText), recordedSourceFormat: 'ifc', importPristine: true });

// ── (8) Geen aanbod-stand meer (eigenaar, 2026-10-17, optie 1) ────────────────
// Zelfde fixture als (7): één FS-relatie waarvan de opgeslagen datums niet uit de logica volgen
// (b staat vast op 2026-03-16, ver ná a's werkelijke opvolgdatum 2026-03-09).
//  - Een BUITEN de modus opgeslagen eigen IFC (bewerkt, geen `SourceFormat`) vergeet de opgeslagen
//    datums: geen `recordedDates`, geen modus, de herberekening blijft staan.
//  - Hetzelfde bestand ONBEWERKT opent in de modus, met de opgeslagen datums en de meting per taak.
{
  S().newProject();
  S().applyLoadedProject(offerOnly(externIfc('2')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');
  eq('8a buiten de modus opgeslagen eigen IFC: geen vastlegging (geen aanbod)', S().recordedDates, null);
  eq('8b buiten de modus opgeslagen eigen IFC: modus uit', S().datesAsRecorded, false);
  eq('8c buiten de modus opgeslagen eigen IFC: b staat op de herberekende datum', S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-09');

  S().newProject();
  S().applyLoadedProject(inMode(externIfc('2')), { filePath: null, recompute: true });
  const aId = idOfWbs('1.1');
  const bId2 = idOfWbs('1.2');
  eq('8f onbewerkt eigen IFC: modus staat aan', S().datesAsRecorded, true);
  eq('8g verschoven taak toont de opgeslagen earlyStart', S().tasks.find((t) => t.id === bId2)!.time.earlyStart, '2026-03-16');
  eq('8h verschoven taak toont de opgeslagen earlyFinish', S().tasks.find((t) => t.id === bId2)!.time.earlyFinish, '2026-03-20');
  eq('8i scheduleStale is false', S().scheduleStale, false);
  eq('8j isDirty blijft false — openen en bekijken maakt niet vies', S().isDirty, false);
  eq('8l projectEnd komt uit het bestand', S().cpmResult?.projectEnd, '2026-03-20');
  eq('8m drivingSequenceIds is leeg (niet in IFC)', S().cpmResult?.drivingSequenceIds, []);
  // De meting per taak (blok in het eigenschappenpaneel): b verschuift bij herberekenen, a niet.
  eq('8n shiftedTaskIds noemt precies b', S().recordedDates?.shiftedTaskIds, [bId2]);
  eq('8o shifted telt hetzelfde als shiftedTaskIds', S().recordedDates?.shifted, 1);
  eq('8p recordedTaskWillShift: b ja, a nee',
    [recordedTaskWillShift(S().recordedDates, S().datesAsRecorded, bId2), recordedTaskWillShift(S().recordedDates, S().datesAsRecorded, aId)],
    [true, false]);
  eq('8q recordedTaskWillShift buiten de modus: onbekend',
    recordedTaskWillShift(S().recordedDates, false, bId2), undefined);
}

// ── (9) De modus verlaten (Taak 6) ───────────────────────────────────────────
// Twee uitgangen, allebei met een werkende Ctrl+Z:
//   A. een datum-rakende BEWERKING — `finishMutation({ stale: true })` zet de modus uit; de snapshot
//      is dan al door `beginUndoable` gepusht MÉT de modus aan, dus één undo herstelt alles.
//   B. F5/"Bereken" — `runCPM` pusht dan (en ALLEEN dan) zelf een undo-snapshot.
// Plus twee bewakingen: de invariant BUITEN de modus (`runCPM` pusht géén snapshot — daar leunen
// `staleGuard.ts` en `batchTool.ts` op) en de bewuste asymmetrie van "undo zonder stale".

// (9.A) Route A — bewerken verlaat de modus, Ctrl+Z draait modus én datums in één stap terug.
{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('9a')), { filePath: null, recompute: true });
  const aId = idOfWbs('1.1');
  const bId = idOfWbs('1.2');

  truthy('9A-1 voorwaarde: recordedDates gezet (b verschoof)', S().recordedDates !== null);
  eq('9A-3 voorwaarde: modus staat aan', S().datesAsRecorded, true);
  eq('9A-4 voorwaarde: b toont weer de opgeslagen datum', earlyStartOf(bId), '2026-03-16');
  eq('9A-5 voorwaarde: planning geldt als vers vóór de bewerking', S().scheduleStale, false);

  const undoVoorA = S().historyEvents.filter(event => event.state === 'applied').length;
  const aTime = S().tasks.find((t) => t.id === aId)!.time;
  // Duur van a van 5 naar 3 werkdagen: een datum-rakende bewerking (`finishMutation({ stale: true })`).
  S().updateTask(aId, { time: { ...aTime, scheduleDuration: 3 } });

  eq('9A-6 een datum-rakende bewerking verlaat de modus', S().datesAsRecorded, false);
  eq('9A-7 …en wist de vastlegging', S().recordedDates, null);
  eq('9A-8 …en zet de planning op verouderd', S().scheduleStale, true);
  eq('9A-9 …in precies één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorA + 1);

  // Wat `useExitRecordedDates` in de app doet (de hook is React en draait hier niet): één keer
  // doorrekenen. Tegelijk de invariant op deze route — de modus stond al uit, dus déze runCPM mag
  // géén tweede undo-stap opleveren.
  S().runCPM();
  eq('9A-10 herrekenen ná het verlaten pusht geen extra undo-stap', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorA + 1);
  eq('9A-11 b staat na het herrekenen op de nieuwe logische datum', earlyStartOf(bId), '2026-03-05');

  S().undo();
  eq('9A-12 undo herstelt de modus', S().datesAsRecorded, true);
  eq('9A-13 undo herstelt de opgeslagen datum van de verschoven taak', earlyStartOf(bId), '2026-03-16');
  truthy('9A-14 undo herstelt de vastlegging', S().recordedDates !== null);
  eq('9A-15 undo herstelt de teller in de vastlegging', S().recordedDates?.shifted, 1);
  eq('9A-16 undo herstelt de vastgelegde start van b', S().recordedDates?.times[bId]?.start, '2026-03-16');
  eq('9A-17 undo herstelt het uit het bestand gereconstrueerde projecteinde', S().cpmResult?.projectEnd, '2026-03-20');
  eq('9A-18 undo herstelt de bewerkte duur van a', S().tasks.find((t) => t.id === aId)!.time.scheduleDuration, 5);

  S().redo();
  eq('9A-19 redo verlaat de modus opnieuw', S().datesAsRecorded, false);
  eq('9A-20 redo wist de vastlegging opnieuw', S().recordedDates, null);
  eq('9A-21 redo herstelt de herberekende datum', earlyStartOf(bId), '2026-03-05');
}

// (9.B) Route B — F5/"Bereken" verlaat de modus, mét een werkende Ctrl+Z.
{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('9b')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');

  eq('9B-1 voorwaarde: modus staat aan', S().datesAsRecorded, true);
  eq('9B-2 voorwaarde: b toont de opgeslagen datum', earlyStartOf(bId), '2026-03-16');
  eq('9B-3 voorwaarde: isDirty is nog false (betreden maakt niet vies)', S().isDirty, false);

  const undoVoorB = S().historyEvents.filter(event => event.state === 'applied').length;
  S().runCPM();

  eq('9B-4 F5 verlaat de modus', S().datesAsRecorded, false);
  eq('9B-5 …en wist de vastlegging', S().recordedDates, null);
  eq('9B-6 …en rekent door: b staat weer op zijn logische datum', earlyStartOf(bId), '2026-03-09');
  eq('9B-7 …in precies één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorB + 1);

  S().undo();
  eq('9B-8 undo na F5 herstelt de modus', S().datesAsRecorded, true);
  eq('9B-9 undo na F5 herstelt de opgeslagen datum', earlyStartOf(bId), '2026-03-16');
  eq('9B-10 undo na F5 herstelt de vastlegging', S().recordedDates?.times[bId]?.start, '2026-03-16');
  eq('9B-11 undo na F5 herstelt het gereconstrueerde projecteinde', S().cpmResult?.projectEnd, '2026-03-20');

  S().redo();
  eq('9B-12 redo verlaat de modus opnieuw', S().datesAsRecorded, false);
  eq('9B-13 redo herstelt de herberekende datum', earlyStartOf(bId), '2026-03-09');
}

// (9.C) DE INVARIANT BUITEN DE MODUS. `staleGuard.ts` (ensureFreshSchedule) en `batchTool.ts`
// (recomputeMidBatch) rekenen stil door in de veronderstelling dat `runCPM` de undo-stack niet
// raakt. De modus-uitgang is daar de enige uitzondering op — deze assertie bewaakt dat die
// uitzondering niet stilletjes het algemene geval wordt.
{
  S().newProject();
  S().applyLoadedProject(offerOnly(externIfc('9c')), { filePath: null, recompute: true });
  eq('9C-1 voorwaarde: de modus staat UIT (buiten de modus opgeslagen eigen IFC)', S().datesAsRecorded, false);
  // Zet `scheduleStale` expres aan (direct, geen actie): zonder dit zou runCPM hooguit "niets te
  // doen" bevestigen, terwijl de assertie moet bewijzen dat een ECHTE herberekening niets pusht.
  useAppStore.setState((s) => { s.scheduleStale = true; });

  const undoVoorC = S().historyEvents.filter(event => event.state === 'applied').length;
  S().runCPM();
  eq('9C-3 runCPM buiten de modus pusht GEEN undo-snapshot', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorC);
  eq('9C-4 buiten de modus is er geen vastlegging (geen aanbod-stand)', S().recordedDates, null);
  eq('9C-5 runCPM buiten de modus zet geen isDirty', S().isDirty, false);
}

// (9.D) De bewuste asymmetrie: een bewerking die GÉÉN datums raakt (`finishMutation` zonder
// `stale`) laat de modus staan. Zou élke `finishMutation` de modus verlaten, dan zou een
// hernummering de modus stil verlaten — en er is dan niets dat de weergegeven datums nog
// herrekent, want `scheduleStale` blijft uit. Precies de mengvorm die de modus moet voorkomen.
{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('9d')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');
  eq('9D-1 voorwaarde: modus staat aan', S().datesAsRecorded, true);

  S().renumberWbs();
  eq('9D-2 een niet-datum-rakende bewerking laat de modus staan', S().datesAsRecorded, true);
  truthy('9D-3 …en laat de vastlegging staan', S().recordedDates !== null);
  eq('9D-4 …en zet de planning niet op verouderd', S().scheduleStale, false);
  eq('9D-5 …en laat de getoonde opgeslagen datum met rust', earlyStartOf(bId), '2026-03-16');

  // Het eigenschappenpaneel schrijft via `updateTask`. Een naam wijzigen raakt geen datum en laat de
  // modus staan (gids `uitleg-datums-zoals-opgeslagen`: "Een naam wijzigen doet dat niet"), net als
  // de naamcel in het taakraster. MUTATIEBEWIJS: `const keepsRecordedMode = false` in
  // `taskSlice.ts` ⇒ 9D-6 ROOD; `'priority'` in `DATE_NEUTRAL_TASK_FIELDS` ⇒ 9D-8 ROOD.
  S().updateTask(bId, { name: 'Hernoemd', description: 'Omschrijving' });
  eq('9D-6 naam + omschrijving via updateTask: modus blijft, niet verouderd, wel vuil',
    [S().datesAsRecorded, S().recordedDates !== null, S().scheduleStale, S().isDirty, S().tasks.find((t) => t.id === bId)!.name],
    [true, true, false, true, 'Hernoemd']);
  eq('9D-7 …en de getoonde opgeslagen datum blijft', earlyStartOf(bId), '2026-03-16');
  // Het paneel (`TaskTypeField`) en *Taak bewerken* schrijven het taaktype via `updateTask`; het
  // raster laat de modus daarbij al staan. Zelfde uitkomst hier. Ook een werkregel via `updateTask`
  // (zoals `setTaskWorkRule`). MUTATIEBEWIJS: `'taskType'` uit `DATE_NEUTRAL_TASK_FIELDS` ⇒ 9D-7a
  // ROOD; `'workRule'` eruit ⇒ 9D-7b ROOD.
  {
    const huidig = S().tasks.find((t) => t.id === bId)!.taskType;
    S().updateTask(bId, { taskType: huidig === 'LOGISTIC' ? 'MOVE' : 'LOGISTIC', customTaskTypeId: undefined });
    eq('9D-7a taaktype via updateTask: modus blijft, niet verouderd, datum blijft',
      [S().datesAsRecorded, S().scheduleStale, earlyStartOf(bId)], [true, false, '2026-03-16']);
    const regel = S().tasks.find((t) => t.id === bId)!.workRule;
    S().updateTask(bId, { workRule: regel === 'FIXED_WORK' ? 'FIXED_DURATION_WORK' : 'FIXED_WORK' });
    eq('9D-7b werkregel via updateTask: modus blijft, niet verouderd, datum blijft',
      [S().datesAsRecorded, S().scheduleStale, earlyStartOf(bId), S().tasks.find((t) => t.id === bId)!.workRule !== regel],
      [true, false, '2026-03-16', true]);
  }
  // Een patch met één planningsveld erbij (prioriteit: invoer voor nivelleren) verlaat de modus wél.
  S().updateTask(bId, { name: 'Nog eens', priority: S().tasks.find((t) => t.id === bId)!.priority + 1 });
  eq('9D-8 naam + prioriteit: modus uit, vastlegging weg, verouderd', [S().datesAsRecorded, S().recordedDates, S().scheduleStale], [false, null, true]);
  // Buiten de modus blijft het pad ongewijzigd: ook een naamwijziging zet de planning op verouderd.
  S().runCPM();
  S().updateTask(bId, { name: 'Buiten de modus' });
  eq('9D-9 buiten de modus: naamwijziging zet de planning (ongewijzigd) op verouderd', S().scheduleStale, true);
}

// ── (10) De tweede ring: élk ánder pad dat herrekent (review taak 6) ─────────
// Routes A en B dekken de twee uitgangen die de gebruiker zelf bedient. Daarnaast rekent de app op
// nog drie plekken door zonder dat er een bewerking aan te pas komt. Die mogen de modus niet stil
// achterlaten (of stil verlaten) — dat is wat deze sectie vastlegt.

// (10.A) K3 — een SLAPEND document dat op de achtergrond wordt doorgerekend.
{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('10a')), { filePath: null, recompute: true });
  const slapendId = S().activeDocumentId;
  const bId = idOfWbs('1.2');
  eq('10A-1 voorwaarde: modus staat aan in het straks-slapende document', S().datesAsRecorded, true);

  S().newDocument(); // het vorige document wordt hiermee een slapende payload
  const payloadVan = () => S().documents.find((d) => d.id === slapendId)?.payload ?? null;
  eq('10A-2 voorwaarde: de slapende payload draagt de modus mee', payloadVan()?.datesAsRecorded, true);
  eq('10A-3 voorwaarde: de slapende payload toont de opgeslagen datum',
    payloadVan()?.tasks.find((t) => t.id === bId)?.time.earlyStart, '2026-03-16');
  eq('10A-4 voorwaarde: de slapende payload staat op NIET-verouderd', payloadVan()?.scheduleStale, false);

  // Forceer `scheduleStale` op de slapende payload. Dit is precies de toestand die `markScheduleStale`
  // onbereikbaar maakt (zie 10.B) — hier met de hand gezet, zodat de BACKSTOP in
  // `recalculateStaleSleepingDocuments` daadwerkelijk getest wordt in plaats van dat de vroege
  // `if (!payload.scheduleStale) continue` de hele assertie tot een vacuüm maakt.
  useAppStore.setState((s) => {
    const entry = s.documents.find((d) => d.id === slapendId);
    if (entry?.payload) entry.payload.scheduleStale = true;
  });

  const herrekend = S().recalculateStaleSleepingDocuments();
  eq('10A-5 voorwaarde: er is écht één slapend document doorgerekend', herrekend, 1);
  eq('10A-6 doorrekenen verlaat de modus op de slapende payload', payloadVan()?.datesAsRecorded, false);
  eq('10A-7 …en wist daar de vastlegging', payloadVan()?.recordedDates, null);
  eq('10A-8 …en de payload toont nu de herberekende datum',
    payloadVan()?.tasks.find((t) => t.id === bId)?.time.earlyStart, '2026-03-09');
}

// (10.B) De regel die "modus aan én verouderd" onbereikbaar maakt. De niet-undoable bibliotheek-
// verversingen zetten `scheduleStale` buiten `finishMutation` om; zonder deze regel ontstaat de
// enige toestand waarin `ensureFreshSchedule` (AI-leestools) en `recalculateStaleSleepingDocuments`
// binnen de modus zouden vuren.
{
  const buiten = { scheduleStale: false, datesAsRecorded: false };
  markScheduleStale(buiten);
  eq('10B-1 buiten de modus zet de vlag gewoon', buiten.scheduleStale, true);

  const binnen = { scheduleStale: false, datesAsRecorded: true };
  markScheduleStale(binnen);
  eq('10B-2 binnen de modus blijft de vlag uit', binnen.scheduleStale, false);
  eq('10B-3 …en blijft de modus zelf onaangeroerd (géén verlaten zonder snapshot)', binnen.datesAsRecorded, true);
}

// (10.C) Het gevolg daarvan, gemeten op de echte store: in de modus is `ensureFreshSchedule` een
// no-op, dus de alleen-lezen AI-leestool (`get_resource_histogram`, `readOnlyHint: true`) kan de
// modus niet weggooien en de undo-stack niet raken.
{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('10c')), { filePath: null, recompute: true });
  eq('10C-1 voorwaarde: modus staat aan', S().datesAsRecorded, true);
  eq('10C-2 in de modus geldt de planning als vers', S().scheduleStale, false);
  truthy('10C-3 in de modus is cpmResult gevuld (de reconstructie)', S().cpmResult !== null);

  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  const bId = idOfWbs('1.2');
  const res = ensureFreshSchedule();
  eq('10C-4 ensureFreshSchedule herrekent niet in de modus', res.recomputed, false);
  eq('10C-5 …raakt de undo-stack niet', S().historyEvents.filter(event => event.state === 'applied').length, undoVoor);
  eq('10C-6 …laat de modus staan', S().datesAsRecorded, true);
  eq('10C-7 …en laat de opgeslagen datum staan', earlyStartOf(bId), '2026-03-16');
}

// (10.D) B3 — acties die datums verschuiven én zélf herrekenen (`moveProject`, `applyLeveling`,
// `clearLeveling`) verlaten de modus in HUN EIGEN producer. Zonder dat deed de aansluitende `runCPM`
// het, in een tweede undo-stap met een tussentoestand die de gebruiker nooit gezien heeft.
{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('10d')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');
  const startVoor = S().project.startDate;
  eq('10D-1 voorwaarde: modus staat aan', S().datesAsRecorded, true);
  eq('10D-2 voorwaarde: b toont de opgeslagen datum', earlyStartOf(bId), '2026-03-16');

  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  const res = S().moveProject('2027-01-04');
  truthy('10D-3 voorwaarde: de verschuiving is écht uitgevoerd', res.moved);

  eq('10D-4 moveProject verlaat de modus', S().datesAsRecorded, false);
  eq('10D-5 …en wist de vastlegging', S().recordedDates, null);
  eq('10D-6 …in precies ÉÉN undo-stap (niet twee)', S().historyEvents.filter(event => event.state === 'applied').length, undoVoor + 1);

  S().undo();
  eq('10D-7 één undo herstelt de modus', S().datesAsRecorded, true);
  eq('10D-8 …de opgeslagen datum', earlyStartOf(bId), '2026-03-16');
  eq('10D-9 …het gereconstrueerde projecteinde', S().cpmResult?.projectEnd, '2026-03-20');
  eq('10D-10 …én de projectstartdatum — geen halve tussentoestand', S().project.startDate, startVoor);
}

// (10.E) Het besluit van `useExitRecordedDates` als pure functies. De hook zelf is React en draait
// niet in deze batterij; het predicaat is daarom uit de subscriber-closure gehaald zodat de twee
// subtiliteiten die het gedrag bepalen — documentwissel en uitgestelde uitvoering — hier wél
// getoetst worden.
{
  const obs = (o: Partial<RecordedDatesObservation> = {}): RecordedDatesObservation =>
    ({ documentId: 'doc-1', inMode: false, scheduleStale: false, ...o });

  truthy('10E-1 modus verlaten binnen hetzelfde document ⇒ inplannen',
    leftRecordedDatesMode(obs({ inMode: true }), obs({ inMode: false })));
  truthy('10E-2 modus staat nog aan ⇒ niets in te plannen',
    !leftRecordedDatesMode(obs({ inMode: true }), obs({ inMode: true })));
  truthy('10E-3 modus stond al uit ⇒ niets in te plannen',
    !leftRecordedDatesMode(obs({ inMode: false }), obs({ inMode: false })));
  // De documentwissel-subtiliteit: van een document MÉT de modus naar een document zonder ziet er
  // in een naïeve subscriber uit als "verlaten", en zou dan een stille F5 op het andere document
  // afvuren.
  truthy('10E-4 documentwissel telt niet als verlaten',
    !leftRecordedDatesMode(obs({ inMode: true }), obs({ documentId: 'doc-2', inMode: false })));

  truthy('10E-5 bij uitvoeren: verouderd en modus uit ⇒ rekenen',
    needsExitRecompute('doc-1', obs({ scheduleStale: true })));
  // Een actie die zélf herrekende (moveProject/applyLeveling/de MCP-transactie) of een bulk die
  // alsnog vers eindigde: niets meer te doen.
  truthy('10E-6 bij uitvoeren: niet meer verouderd ⇒ niet rekenen',
    !needsExitRecompute('doc-1', obs({ scheduleStale: false })));
  // Een Ctrl+Z vlak ná de bewerking: rekenen zou de zojuist herstelde opgeslagen datums meteen
  // weer overschrijven.
  truthy('10E-7 bij uitvoeren: modus opnieuw aan (undo) ⇒ niet rekenen',
    !needsExitRecompute('doc-1', obs({ inMode: true, scheduleStale: true })));
  truthy('10E-8 bij uitvoeren: intussen van document gewisseld ⇒ niet rekenen',
    !needsExitRecompute('doc-1', obs({ documentId: 'doc-2', scheduleStale: true })));
}

// ── (11) De invariant "modus ⇒ niet verouderd" automatisch bewaakt ───────────
// Deze invariant draagt inmiddels drie dingen: de één-undo-stap-belofte van de MCP-transactie, het
// stil doorrekenen van slapende documenten, en de `readOnlyHint: true`-annotatie van
// `get_resource_histogram` (een tool die aan een externe AI-client hangt). Hij werd tot nu toe
// alleen door commentaar beschermd, terwijl één regel `s.scheduleStale = true` hem stil heropent —
// en dat is precies wat een ontwikkelaar hier natuurlijk schrijft: de commit die deze regel
// invoerde moest er VIER uit `librarySlice.ts` verwijderen.
{
  // Broncode-check, naar het voorbeeld van de synchroniciteits-assert in tests/mcp/cases-batch.ts.
  // Wortel via twee kandidaten, want dit script draait zowel gebundeld in tests/planning/ als
  // los vanuit een andere map; wordt `src/` niet gevonden, dan MOET dit rood zijn — een bewaking
  // die zichzelf stil overslaat is geen bewaking.
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find((p) => existsSync(p)) ?? null;
  truthy(`11a de broncontrole vindt src/ (geprobeerd: ${kandidaten.join(', ')})`, srcRoot !== null);

  if (srcRoot) {
    const bestanden: string[] = [];
    const loop = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = joinPath(dir, entry.name);
        if (entry.isDirectory()) loop(full);
        else if (/\.tsx?$/.test(entry.name)) bestanden.push(full);
      }
    };
    loop(srcRoot);
    truthy('11b de broncontrole leest een plausibel aantal bronbestanden', bestanden.length > 100);

    // Alleen de bladhulp `scheduleStale.ts` mag de vlag rechtstreeks zetten; de rest gaat via `finishMutation`
    // (datum-rakende bewerkingen) of `markScheduleStale` (de niet-undoable verversingen). Beide
    // laten de vlag uit zolang "datums zoals opgeslagen" aanstaat.
    const toegestaan = joinPath(srcRoot, 'state', 'scheduleStale.ts');
    const overtreders = bestanden.filter((f) =>
      f !== toegestaan && /\.scheduleStale\s*=\s*true/.test(readFileSync(f, 'utf8')));
    eq(
      '11c `.scheduleStale = true` staat UITSLUITEND in state/scheduleStale.ts — issue #63: buiten '
      + '`finishMutation`/`markScheduleStale` om de vlag zetten maakt "modus aan én verouderd" weer '
      + 'bereikbaar, en dáármee kan een herberekening de modus stil verlaten zonder undo-stap '
      + '(MCP-transactie, slapende documenten, en de readOnlyHint van get_resource_histogram). '
      + 'Gebruik `markScheduleStale(s)` of `finishMutation(s, { stale: true })`',
      overtreders.map((f) => f.slice(srcRoot.length + 1)), [],
    );
  }
}

// (11.2) De omgekeerde assertie, op de echte store: de twee vlaggen mogen nooit tegelijk aanstaan.
// Goedkoop, dus meteen over álle documenten (actief + slapend).
{
  const geenModusEnStale = (label: string) => {
    const s = S();
    truthy(`${label}: actief document is nooit modus-aan én verouderd`, !(s.datesAsRecorded && s.scheduleStale));
    for (const doc of s.documents) {
      const p = doc.payload;
      truthy(`${label}: slapend document is nooit modus-aan én verouderd`,
        !p || !(p.datesAsRecorded && p.scheduleStale));
    }
  };

  S().newProject();
  S().applyLoadedProject(inMode(externIfc('11')), { filePath: null, recompute: true });
  geenModusEnStale('11d na laden (in de modus)');
  const aId = idOfWbs('1.1');
  const aTime = S().tasks.find((t) => t.id === aId)!.time;
  S().updateTask(aId, { time: { ...aTime, scheduleDuration: 3 } });
  geenModusEnStale('11f na een bewerking (modus uit, wél verouderd)');
  S().undo();
  geenModusEnStale('11g na undo (modus terug aan, niet verouderd)');

  // (11h) XER-etappeplan §3.5/§4-T4, risico §5.1: het bron-orakel-laadpad zet de modus AAN in
  // `applyRecordedDatesOnLoad`, dus deze invariant moet ook ná EEN AUTO-AAN-LOAD gelden — niet
  // alleen ná het heropenen van een onbewerkt eigen IFC zoals 11d hierboven.
  const rt11h = offerOnly(externIfc('11h'));
  const oracleTimesFor11h = captureRecordedDates(rt11h.tasks, rt11h.recordedFields).times;
  const asXerFor11h: ImportResult = {
    ...rt11h, recordedFields: undefined,
    recordedTimes: oracleTimesFor11h, recordedTimesOrigin: 'xer',
  };
  S().newProject();
  S().applyLoadedProject(asXerFor11h, { filePath: null, recompute: true });
  truthy('11h voorwaarde: bron-orakel-load zette de modus echt aan', S().datesAsRecorded);
  geenModusEnStale('11h ná een bron-orakel-load (modus meteen aan)');
}

// ── (12) "Alles verversen" blijft één undo-stap (review taak 6, B2) ──────────
// `refreshExternalAnchorsFrom` pusht sinds issue #63 een snapshot. De projectbrede knop lustte daar
// overheen, dus bij twee gewijzigde bronnen kostte één gebaar twee keer Ctrl+Z. De lus leest nu
// eerst álle bronnen in en schrijft daarna één keer.
{
  S().newProject();
  const t1 = S().addTask({ name: 'Met link naar bron A' });
  const t2 = S().addTask({ name: 'Met link naar bron B' });
  const link = (id: string, filePath: string): ExternalLink => ({
    id, direction: 'predecessor', relType: 'FS', anchorDate: '2020-01-01',
    sourceRef: { projectId: 'gedeelde-bron-id', taskId: 'X', filePath }, sourceMissing: false,
  });
  S().updateTask(t1, { externalLinks: [link('l1', '/bron-a.ifc')] });
  S().updateTask(t2, { externalLinks: [link('l2', '/bron-b.ifc')] });

  // `parseExternalSource` leest een echt bestand via de Tauri-fs; hier vervangen we die ene actie
  // door een stub, zodat de LUS eromheen (het onderwerp van deze test) headless te meten is.
  useAppStore.setState({
    parseExternalSource: async (filePath: string) => ({
      projectId: 'gedeelde-bron-id', projectName: 'Bron', filePath,
      tasks: [mk('X', filePath === '/bron-a.ifc'
        ? { earlyStart: '2026-05-04', earlyFinish: '2026-05-08' }
        : { earlyStart: '2026-06-01', earlyFinish: '2026-06-05' })],
    }),
  });

  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  const res = await S().refreshAllExternalAnchors();

  eq('12a beide bronnen zijn ingelezen', res.sources, 2);
  eq('12b beide links zijn ververst', res.refreshed, 2);
  eq('12c "Alles verversen" kost precies ÉÉN undo-stap, ongeacht het aantal bronnen',
    S().historyEvents.filter(event => event.state === 'applied').length, undoVoor + 1);
  eq('12d de link van bron A draagt het verse anker',
    S().tasks.find((t) => t.id === t1)!.externalLinks![0].anchorDate, '2026-05-08');
  eq('12e de link van bron B draagt het verse anker — het ketenen verliest de eerste bron niet',
    S().tasks.find((t) => t.id === t2)!.externalLinks![0].anchorDate, '2026-06-05');
  eq('12e2 gelijke project-id laat iedere bron exact zijn eigen pad verversen', res.refreshed, 2);

  // Eén undo draait het hele gebaar terug.
  S().undo();
  eq('12f één undo herstelt het anker van bron A',
    S().tasks.find((t) => t.id === t1)!.externalLinks![0].anchorDate, '2020-01-01');
  eq('12g één undo herstelt het anker van bron B',
    S().tasks.find((t) => t.id === t2)!.externalLinks![0].anchorDate, '2020-01-01');
}

// ── (13) Async externe verversing blijft aan het startdocument gebonden ───────────────
{
  S().newProject();
  const taskA = S().addTask({ name: 'Document A' });
  const link = (id: string, anchorDate: string): ExternalLink => ({
    id, direction: 'predecessor', relType: 'FS', anchorDate,
    sourceRef: { projectId: 'bron', taskId: 'X', filePath: '/bron.ifc' }, sourceMissing: false,
  });
  S().updateTask(taskA, { externalLinks: [link('a-link', '2026-01-01')] });
  const documentA = S().activeDocumentId;
  let releaseRead!: () => void;
  const waitForRead = new Promise<void>(resolve => { releaseRead = resolve; });
  const brontaak = mk('X', { earlyStart: '2026-03-01', earlyFinish: '2026-03-05' });
  useAppStore.setState({
    parseExternalSource: async (filePath: string) => {
      await waitForRead;
      return { projectId: 'bron', projectName: 'Bron', filePath, tasks: [brontaak] };
    },
  });

  const refreshing = S().refreshAllExternalAnchors();
  S().newDocument();
  const documentB = S().activeDocumentId;
  const taskB = S().addTask({ name: 'Document B' });
  S().updateTask(taskB, { externalLinks: [link('b-link', '2026-02-01')] });
  releaseRead();
  const result = await refreshing;

  eq('13a een verversing meldt na documentwissel geen mutatie in het nieuwe document', result.refreshed, 0);
  eq('13b document B houdt zijn eigen anker',
    S().tasks.find(task => task.id === taskB)!.externalLinks![0].anchorDate, '2026-02-01');
  const sleepingA = S().documents.find(document => document.id === documentA)?.payload;
  eq('13c het slapende document A wordt niet buiten zijn historygrens overschreven',
    sleepingA?.tasks.find(task => task.id === taskA)!.externalLinks![0].anchorDate, '2026-01-01');
  eq('13d de gebruiker blijft in document B', S().activeDocumentId, documentB);
}

// ── (13B) EXPORT-UITGANG: geen verzonnen 0 in de CSV ────────────────────────────────────────
// Critreview laag 3, bevinding 6. In de modus draagt `task.time` de vastlegging van het bestand,
// mét de bewuste terugvallen voor niet-vastgelegde assen. De taaktabel toont daar "Niet
// vastgelegd"; een CSV-cel kan een verzonnen `0` niet van een echte nulspeling onderscheiden, dus
// daar hoort een LEGE cel. MUTATIEBEWIJS: geef de poort (`unrecordedExportGate`) niet mee aan
// `writeCSV` in `fileSlice.exportFile` ⇒ 13Bb hieronder slaat rood.
{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('csv')), { filePath: null, recompute: true });
  truthy('13Ba voorwaarde: de modus staat aan', S().datesAsRecorded);

  // Kolommen op KOP, niet op index: de kopregel groeit mee met de export (issue #27 zette
  // 'OPS Task ID' vooraan, #159 'Outline Level' erachter) en een vaste index las dan stil een
  // andere kolom.
  const kolommen = (csv: string) => {
    const [kop, ...regels] = csv.trim().replace(/^﻿/, '').split('\r\n');
    const index = new Map(kop.split(';').map((h, i) => [h, i] as const));
    const kol = (naam: string): number => {
      const i = index.get(naam);
      if (i === undefined) throw new Error(`13B: CSV-kolom '${naam}' ontbreekt in de kopregel`);
      return i;
    };
    return regels.map(regel => regel.split(';')).map(rij => ({
      start: rij[kol('Start')], critical: rij[kol('Critical')], totalFloat: rij[kol('Total Float')],
    }));
  };
  const inModus = writeCSV(
    S().project, S().calendar, S().tasks, S().sequences, S().resources, S().assignments,
    S().customTaskTypes, unrecordedExportGate(S().recordedDates, S().datesAsRecorded),
  );
  const rijenInModus = kolommen(inModus);
  eq('13Bb in de modus is de niet-vastgelegde totale speling (kolom Total Float) een LEGE cel, geen verzonnen 0',
    rijenInModus.map(rij => rij.totalFloat), ['', '']);
  eq('13Bc … en de niet-vastgelegde kritiek-vlag (kolom Critical) óók, geen verzonnen "No"',
    rijenInModus.map(rij => rij.critical), ['', '']);
  eq('13Bd … terwijl de WÉL vastgelegde datums gewoon geëxporteerd worden',
    rijenInModus.map(rij => rij.start), ['2026-03-02', '2026-03-16']);

  // Tegenproef: buiten de modus is de export byte-identiek aan voorheen — de poort levert dan
  // `undefined` en de kolommen dragen de echte berekening.
  S().runCPM();
  eq('13Be voorwaarde: runCPM verliet de modus', S().datesAsRecorded, false);
  const buitenModus = writeCSV(
    S().project, S().calendar, S().tasks, S().sequences, S().resources, S().assignments,
    S().customTaskTypes, unrecordedExportGate(S().recordedDates, S().datesAsRecorded),
  );
  const rijenBuiten = kolommen(buitenModus);
  eq('13Bf buiten de modus staat de BEREKENDE speling in de kolom', rijenBuiten.map(rij => rij.totalFloat), ['0', '0']);
  eq('13Bg … en de berekende kritiek-vlag', rijenBuiten.map(rij => rij.critical), ['Yes', 'Yes']);
  eq('13Bh zonder poort is de export byte-identiek aan het gedrag van vóór deze wijziging',
    writeCSV(S().project, S().calendar, S().tasks, S().sequences, S().resources, S().assignments,
      S().customTaskTypes), buitenModus);
}

// ── (14) De meldingstekst is BRONAFHANKELIJK ─────────────────────────────────────────────────
// De MODUS-ACTIEF-strook zegt "zoals Primavera ze opsloeg". Die strook is echter gedeeld met de
// #63-route voor elk ander formaat, waar niemand weet uit welk pakket de datums komen — daar is die
// zin een verkeerde bewering. Twee helften:
//  (a) de KEUZE (`recordedDatesActiveKey`, de React-vrije besluitmodule achter de component);
//  (b) de INHOUD in alle talen (`LOCALES`): de Primavera-familie noemt Primavera, de neutrale familie
//      NIET — een vertaler die de zin kopieert wordt hier gepakt, in elke taal.
{
  eq('14a verse XER-import ⇒ Primavera-tekst', recordedDatesActiveKey('xer'), 'recordedDates.activeCount');
  eq('14b heropende IFC met XER-archief ⇒ óók Primavera-tekst (de datums zijn echt van P6)',
    recordedDatesActiveKey('xer-archive'), 'recordedDates.activeCount');
  eq('14c zonder herkomst (de #63-route, elk ander formaat) ⇒ formaatneutrale tekst',
    recordedDatesActiveKey(undefined), 'recordedDates.activeCountNeutral');

  const kandidatenL = [
    fileURLToPath(new URL('../../src/i18n/locales/', import.meta.url).href),
    resolvePath(process.cwd(), 'src/i18n/locales'),
  ];
  const localesRoot = kandidatenL.find((p) => existsSync(p)) ?? null;
  truthy(`14d de tekstcontrole vindt src/i18n/locales/ (geprobeerd: ${kandidatenL.join(', ')})`, localesRoot !== null);

  if (localesRoot) {
    const talen = readdirSync(localesRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort();
    eq('14e alle talen uit LOCALES worden gecontroleerd', talen, [...LOCALES].sort());
    // Noemt de tekst Primavera? Op de stam, want talen verbuigen de naam (pl "Primaverę", cs
    // "Primaveru", hu "Primaverában"), en ru/uk/bg/sr schrijven hem mogelijk in het Cyrillisch.
    const noemtPrimavera = (v: unknown) => typeof v === 'string' && /Primaver|Примавер/i.test(v);

    // Besluit B5 (2026-10-10): een andere taal dan nl/en mag een sleutel of familie nog missen (de app valt
    // terug op en, de vertaalstraat vult hem vóór een release); wat er wél staat, moet kloppen.
    const optioneel = (taal: string) => taal !== 'nl' && taal !== 'en';
    const zonderNeutraal: string[] = [];
    const neutraalNoemtPrimavera: string[] = [];
    const primaveraNoemtHetNiet: string[] = [];
    for (const taal of talen) {
      const json = JSON.parse(readFileSync(joinPath(localesRoot, taal, 'common.json'), 'utf8')) as
        Record<string, Record<string, string>>;
      const rd = json.recordedDates ?? {};
      const primavera = Object.entries(rd).filter(([k]) => k.startsWith('activeCount_'));
      const neutraal = Object.entries(rd).filter(([k]) => k.startsWith('activeCountNeutral_'));
      const eenOntbreekt = neutraal.length === 0 || primavera.length === 0;
      if (eenOntbreekt ? !optioneel(taal) : neutraal.length !== primavera.length) zonderNeutraal.push(taal);
      if (neutraal.some(([, v]) => noemtPrimavera(v))) neutraalNoemtPrimavera.push(taal);
      if (primavera.some(([, v]) => !noemtPrimavera(v))) primaveraNoemtHetNiet.push(taal);
    }
    eq('14f elke taal heeft de neutrale familie met exact dezelfde pluralvormen als de Primavera-familie',
      zonderNeutraal, []);
    eq('14g de NEUTRALE tekst noemt Primavera in geen enkele taal', neutraalNoemtPrimavera, []);
    eq('14h de Primavera-tekst noemt Primavera juist WEL in elke taal (anders bewijst 14g niets)',
      primaveraNoemtHetNiet, []);

    // Her-check laag 3, bevinding 5: dezelfde regel voor het per-taak-BLOK (`task.json`, teksten
    // eigenaar 2026-10-17) — dat zei "Primavera" op élk #63-document.
    eq('14i blok: XER-herkomst ⇒ Primavera-sleutels', [recordedDatesTaskShownKey('xer'), recordedDatesTaskMissingKey('xer')], ['properties.recordedDatesShown', 'properties.recordedDatesMissing']);
    eq('14j blok: archiefherkomst ⇒ óók Primavera-sleutels', [recordedDatesTaskShownKey('xer-archive'), recordedDatesTaskMissingKey('xer-archive')], ['properties.recordedDatesShown', 'properties.recordedDatesMissing']);
    eq('14k blok: zonder herkomst ⇒ neutrale sleutels', [recordedDatesTaskShownKey(undefined), recordedDatesTaskMissingKey(undefined)], ['properties.recordedDatesShownNeutral', 'properties.recordedDatesMissingNeutral']);
    const badgeZonderNeutraal: string[] = [];
    const badgeNeutraalNoemtPrimavera: string[] = [];
    const badgePrimaveraNoemtHetNiet: string[] = [];
    for (const taal of talen) {
      const json = JSON.parse(readFileSync(joinPath(localesRoot, taal, 'task.json'), 'utf8')) as
        Record<string, Record<string, string>>;
      const props = json.properties ?? {};
      for (const stam of ['recordedDatesShown', 'recordedDatesMissing']) {
        const primavera = props[stam];
        const neutraal = props[`${stam}Neutral`];
        if (neutraal === undefined && optioneel(taal)) { /* B5: mag nog ontbreken */ } else if (typeof neutraal !== 'string' || neutraal.length === 0) badgeZonderNeutraal.push(`${taal}:${stam}`);
        else if (noemtPrimavera(neutraal)) badgeNeutraalNoemtPrimavera.push(`${taal}:${stam}`);
        // Op de stam (`noemtPrimavera`): het Pools verbuigt de naam ("przez Primaverę").
        if (!(primavera === undefined && optioneel(taal)) && !noemtPrimavera(primavera)) badgePrimaveraNoemtHetNiet.push(`${taal}:${stam}`);
      }
    }
    eq('14l elke taal heeft de neutrale bloktekst', badgeZonderNeutraal, []);
    eq('14m de NEUTRALE bloktekst noemt Primavera in geen enkele taal', badgeNeutraalNoemtPrimavera, []);
    eq('14n de Primavera-bloktekst noemt Primavera juist WEL in elke taal', badgePrimaveraNoemtHetNiet, []);
  }
}

// ── (15) Samenvattingen rollen in de modus op uit de VASTGELEGDE kinderen ───────────────────────
// Her-check laag 3, bevinding 3: P6 legt de zes uitvoerkolommen alleen op TASK-rijen vast; een
// WBS-rij (of IFC-fase) heeft nooit een eigen vastlegging en hield daardoor de datums van de solve
// die de modus zojuist verwierp (gemeten: hoofd-WBS een half jaar ná `projectEnd`). Zelfde rollup
// als na een echte solve. MUTATIEBEWIJS: haal `rollupSummaryTasks(tasks)` uit
// `applyRecordedTimesToTasks` ⇒ 15a/15b slaan ROOD (de samenvatting houdt haar oude datums).
{
  const base = (id: string) => ({
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, resourceIds: [], activityCodes: {}, customFields: {},
    externalLinks: [], notes: [],
  });
  const leaf = (id: string, parentId: string, es: string, ef: string): Task => ({
    ...base(id),
    parentId,
    childIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 5,
      scheduleStart: es, scheduleFinish: ef, earlyStart: es, earlyFinish: ef,
      lateStart: es, lateFinish: ef, totalFloat: 0, freeFloat: 0, isCritical: true, completion: 0,
    },
  } as Task);
  const summary: Task = {
    ...base('S'),
    parentId: null,
    childIds: ['A', 'B'],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 10,
      // De "weggegooide solve": een half jaar later dan wat de kinderen vastleggen.
      scheduleStart: '2026-09-01', scheduleFinish: '2026-09-30',
      earlyStart: '2026-09-01', earlyFinish: '2026-09-30',
      lateStart: '2026-09-01', lateFinish: '2026-09-30',
      totalFloat: 0, freeFloat: 0, isCritical: true, completion: 0,
      interferingFloat: 0,
    },
  } as Task;
  const tasks: Task[] = [summary, leaf('A', 'S', '2026-09-01', '2026-09-05'), leaf('B', 'S', '2026-09-08', '2026-09-12')];
  const times: Record<string, RecordedTime> = {
    A: { start: '2026-03-02', finish: '2026-03-06', lateStart: '2026-03-09', lateFinish: '2026-03-13', totalFloat: 5, freeFloat: 0, isCritical: false },
    B: { start: '2026-03-09', finish: '2026-03-13', lateStart: '2026-03-09', lateFinish: '2026-03-13', totalFloat: 0, freeFloat: 0, isCritical: true },
  };
  const cpm = applyRecordedTimesToTasks(tasks, times, createDefaultCalendar());
  const s = tasks[0].time;
  eq('15a de samenvatting omspant de VASTGELEGDE kinderen (vroege zijde)',
    [s.earlyStart, s.earlyFinish], ['2026-03-02', '2026-03-13']);
  eq('15b ... en niet meer de weggegooide solve (late zijde en speling uit de kinderen)',
    [s.lateStart, s.lateFinish, s.totalFloat, s.freeFloat, s.isCritical], ['2026-03-09', '2026-03-13', 0, 0, true]);
  eq('15c analyse-afgeleiden zijn ook op de samenvatting gewist',
    [s.interferingFloat, s.isNearCritical, s.floatPath], [undefined, undefined, undefined]);
  eq('15d de balk klopt nu met de projecteinddatum die dezelfde modus rapporteert',
    [cpm.projectEnd, s.earlyFinish <= cpm.projectEnd], ['2026-03-13', true]);
  eq('15e een samenvatting zonder vastgelegde kinderen blijft onaangeroerd (geen vastlegging ⇒ niets te zeggen)',
    (() => {
      const alone: Task = { ...summary, id: 'S2', childIds: ['C'], time: { ...summary.time } } as Task;
      const c = leaf('C', 'S2', '2026-09-01', '2026-09-05');
      applyRecordedTimesToTasks([alone, c], {}, createDefaultCalendar());
      return [alone.time.earlyStart, alone.time.earlyFinish];
    })(), ['2026-09-01', '2026-09-05']);
  // Her-check R1: de opgerolde samenvatting staat óók in het cpmResult — Gantt/taakraster
  // (`task.time`) en rapporten/`projectEnd` (`cpmResult`) mogen elkaar niet tegenspreken.
  eq('15f de opgerolde samenvatting zit in cpmResult.tasks met dezelfde waarden als task.time',
    cpm.tasks.get('S'), {
      earlyStart: s.earlyStart, earlyFinish: s.earlyFinish, lateStart: s.lateStart, lateFinish: s.lateFinish,
      totalFloat: s.totalFloat, freeFloat: s.freeFloat, isCritical: s.isCritical,
    });
  // Her-check R1 (blokkerend): een samenvatting MET eigen vastlegging (de #63-IFC-route: een fase
  // draagt gewoon een IfcTaskTime) blijft staan zoals het bestand haar gaf — de rollup slaat haar
  // over, en task.time == cpmResult. MUTATIEBEWIJS: haal het `skip`-predikaat uit
  // `applyRecordedTimesToTasks` ⇒ 15g slaat ROOD (de rollup overschrijft de vastlegging).
  {
    const recordedSummary: Task = { ...summary, id: 'R', childIds: ['RA', 'RB'], time: { ...summary.time } } as Task;
    const rTasks: Task[] = [recordedSummary, leaf('RA', 'R', '2026-09-01', '2026-09-05'), leaf('RB', 'R', '2026-09-08', '2026-09-12')];
    const rTimes: Record<string, RecordedTime> = {
      R: { start: '2026-02-01', finish: '2026-04-30', lateStart: '2026-02-04', lateFinish: '2026-05-05', totalFloat: 3, freeFloat: 3, isCritical: false },
      RA: { start: '2026-03-02', finish: '2026-03-06', lateStart: '2026-03-09', lateFinish: '2026-03-13', totalFloat: 5, freeFloat: 0, isCritical: false },
      RB: { start: '2026-03-09', finish: '2026-03-13', lateStart: '2026-03-09', lateFinish: '2026-03-13', totalFloat: 0, freeFloat: 0, isCritical: true },
    };
    const rCpm = applyRecordedTimesToTasks(rTasks, rTimes, createDefaultCalendar());
    const r = rTasks[0].time;
    eq('15g een samenvatting mét eigen vastlegging blijft staan zoals het bestand haar gaf (geen rollup eroverheen)',
      [r.earlyStart, r.earlyFinish, r.lateStart, r.lateFinish, r.totalFloat, r.freeFloat, r.isCritical],
      ['2026-02-01', '2026-04-30', '2026-02-04', '2026-05-05', 3, 3, false]);
    eq('15h ... en task.time en cpmResult zeggen daar hetzelfde, projectEnd incluis',
      [rCpm.tasks.get('R')?.earlyFinish, rCpm.projectEnd], ['2026-04-30', '2026-04-30']);
  }
}

// ── (16) "Ongewijzigd sinds import" — heropen-beleid optie B (eigenaarsbesluit 2026-09-09) ────────
// De levenscyclus van `importPristine` door het ECHTE laad-, bewerk-, opslaan- en heropenpad, op een
// IFC uit een ander pakket (herkomst 'ifc'): verse import ⇒ vlag aan ⇒ automatisch in de modus;
// opslaan (ín de modus!) schrijft het pset; heropenen van dat eigen IFC ('ifc-own') gaat opnieuw
// automatisch de modus in; één bewerking wist de vlag; F5 en opslaan niet.
{
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16')), { filePath: null, recompute: true });
  eq('16a verse import uit een ander pakket: vlag aan én modus aan', [S().importPristine, S().datesAsRecorded], [true, true]);

  const savedInMode = writeIFC(buildWriteIFCInput(S()));
  truthy('16b opslaan ín de modus schrijft OPS_ImportProvenance', savedInMode.includes("'OPS_ImportProvenance'"));
  const reopened = readIFC(savedInMode);
  eq('16c het heropende eigen IFC is een heropening mét vlag', [reopened.recordedTimesOrigin, reopened.importPristine], ['ifc-own', true]);
  S().newProject();
  S().applyLoadedProject(reopened, { filePath: null, recompute: true });
  eq('16d heropenen van het ongewijzigde eigen IFC gaat automatisch de modus in (optie B)', [S().datesAsRecorded, S().recordedDates?.origin], [true, 'ifc-own']);
  eq('16e …met dezelfde verschuivingsteller als de verse import', S().recordedDates?.shifted, 1);

  // F5 verlaat de modus maar is geen bewerking; opslaan evenmin.
  S().runCPM();
  eq('16f F5 verlaat de modus zonder de vlag te wissen', [S().datesAsRecorded, S().importPristine], [false, true]);
  const savedOutside = writeIFC(buildWriteIFCInput(S()));
  truthy('16g ook ná F5 draagt het opgeslagen bestand de vlag', savedOutside.includes("'OPS_ImportProvenance'"));
  S().newProject();
  S().applyLoadedProject(readIFC(savedOutside), { filePath: null, recompute: true });
  // Ná F5 draagt het opgeslagen IFC ONZE berekening als taakdatums, en een gewoon IFC heeft — anders
  // dan een XER-archief (check-xer-recorded-roundtrip 4a) — geen apart bronkanaal: de vastlegging
  // ís dan de herberekening, dus er valt niets meer te tonen. Geen modus, geen aanbod.
  eq('16h heropenen na F5+opslaan: het bestand draagt de herberekening zelf ⇒ niets te melden', [S().datesAsRecorded, S().recordedDates], [false, null]);

  // Eén bewerking (echte mutator) wist de vlag. De modus stond sinds 16h al uit, dus deze check
  // toetst alleen de vlag en het vuil worden; het verlaten van de modus staat in 9D-8.
  S().updateTask(S().tasks[0]!.id, { name: 'Bewerkt' });
  eq('16i een bewerking (modus stond al uit, 16h) wist de vlag en maakt vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [false, false, true]);
  const savedEdited = writeIFC(buildWriteIFCInput(S()));
  truthy('16j het bewerkte bestand draagt geen OPS_ImportProvenance meer', !savedEdited.includes("'OPS_ImportProvenance'"));
  S().newProject();
  S().applyLoadedProject(readIFC(savedEdited), { filePath: null, recompute: true });
  eq('16k heropenen van het bewerkte eigen IFC: vlag uit, en (zonder apart bronkanaal) geen verschil met het bestand', [S().datesAsRecorded, S().recordedDates, S().importPristine], [false, null, false]);
  // Undo maakt een bewerkt document niet weer "ongewijzigd" (conservatief, geen snapshot-rol).
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16u')), { filePath: null, recompute: true });
  S().updateTask(S().tasks[0]!.id, { name: 'Bewerkt' });
  S().undo();
  eq('16l undo herstelt de vlag NIET (nooit een gok richting automatisch aan)', S().importPristine, false);

  // Critreview op ded4d8c3, bevinding 3 (+ her-check): een undo van een stap die GEEN bewerking was
  // (F5 in de modus, of "toon opgeslagen datums") mag de importvlag niet wissen. Vuil wordt het
  // document wél: na een undo wijkt het geheugen af van wat er op schijf staat.
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16o')), { filePath: null, recompute: true });
  eq('16o geladen: modus aan, vlag aan, niet vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [true, true, false]);
  S().runCPM();
  eq('16p F5: modus uit, vlag aan, niet vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [false, true, false]);
  S().undo();
  eq('16q Ctrl+Z na F5: modus weer aan, vlag AAN, wel vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [true, true, true]);
  S().redo();
  eq('16r Ctrl+Y: modus weer uit, vlag nog steeds aan, vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [false, true, true]);
  // "Toon opgeslagen datums" vanuit de AANBOD-stand met de vlag aan. Het ECHTE pad daarheen
  // (tweede critreview-ronde, punt 5, nagelopen): een XER-document in de modus → F5 (verlaat de
  // modus, wist de vastlegging, laat de vlag staan — 16f) → crash → herstel met manifestvlag
  // `datesAsRecorded: false`. Het herstelde IFC draagt de vlag én het XER-archief (dat de
  // vastlegging opnieuw levert), en het herstel zet de modus niet aan: aanbod + vlag aan. Hier
  // nagebootst met de #63-fixture als archiefvastlegging; de herstelroute zelf is de echte.
  // (Via een eigen IFC zonder archief kan het sinds de SourceFormat-poort niet meer: buiten de
  // modus wordt geen bron geschreven, dus dan is er bij herstel ook geen aanbod.)
  {
    const src = readIFC(externIfc('16s'));
    const archiefTijden = captureRecordedDates(src.tasks, src.recordedFields).times;
    const na_f5: ImportResult = {
      ...src, recordedFields: undefined, recordedTimes: archiefTijden,
      recordedTimesOrigin: 'xer-archive', importPristine: true,
    };
    S().newProject();
    S().restoreDocuments([recoveryInputFromParsed(na_f5, { id: 'rec-16s', filePath: null, isDirty: false, datesAsRecorded: false })], 'rec-16s');
  }
  // Geen aanbod-stand meer (eigenaar, 2026-10-17, optie 1): herstel buiten de modus VERGEET de
  // opgeslagen datums, ook met de vlag aan.
  eq('16s herstel buiten de modus: geen modus, geen vastlegging, vlag aan, niet vuil', [S().datesAsRecorded, S().recordedDates, S().importPristine, S().isDirty], [false, null, true, false]);
  // Tegenproef: na een ECHTE bewerking blijft 16l gelden.
  S().updateTask(S().tasks[0]!.id, { name: 'Bewerkt' });
  S().undo();
  eq('16u bewerking + undo: vlag blijft uit, document blijft vuil', [S().importPristine, S().isDirty], [false, true]);
  // 16w (her-check): laden → F5 → OPSLAAN → Ctrl+Z. Het geheugen wijkt daarna af van het bestand:
  // het document MOET vuil zijn (anders sluit het zonder vraag en schrijft autosave niets), terwijl
  // de importvlag en de modus terugkomen. "Opslaan" via het echte versie-opgeslagen-pad.
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16w')), { filePath: null, recompute: true });
  S().runCPM();
  S().markAutoSaveVersionSaved(S().activeDocumentId, S());
  eq('16w0 na F5 en opslaan: niet vuil, vlag aan, modus uit', [S().isDirty, S().importPristine, S().datesAsRecorded], [false, true, false]);
  S().undo();
  eq('16w Ctrl+Z na opslaan: vuil, vlag aan, modus aan', [S().isDirty, S().importPristine, S().datesAsRecorded], [true, true, true]);

  // 16x (her-check): `refreshLatestDocumentDataHistoryAfter` werkt het `after` van het laatste event
  // bij na een F5 buiten de modus; het `nonEdit`-kenmerk van dat event moet daarbij blijven staan.
  // Opzet: F5 in de modus (nonEdit-event) → planning verouderd zónder nieuw event → F5 (ververst
  // het laatste event).
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16x')), { filePath: null, recompute: true });
  S().runCPM();
  useAppStore.setState((st) => { markScheduleStale(st); });
  const voorRefresh = S().historyEvents.length;
  S().runCPM();
  {
    const laatste = [...S().historyEvents].sort((a, b) => b.sequence - a.sequence)[0];
    const delta = laatste?.deltas[0];
    eq('16x na het verversen van het laatste event: nog steeds nonEdit, geen nieuw event',
      [delta?.kind === 'document-data' ? delta.nonEdit ?? 'bewerking' : 'geen', S().historyEvents.length - voorRefresh], [true, 0]);
  }

  // 16v: het vangnet in de runtime — een `finishUndoable({ nonEdit })` die een open mutatie sluit
  // waarbinnen tóch een `finishMutation` liep, legt een GEWONE bewerking vast (geen `nonEdit`).
  // Geen productpad doet dat vandaag; dit bewaakt dat een toekomstige nesting geen bewerking als
  // niet-bewerking laat registreren.
  {
    const ctx = createAppStoreContext();
    ctx.store.getState().addTask({ name: 'X' });
    ctx.store.setState((st) => {
      ctx.runtime.beginUndoable(st);
      ctx.runtime.beginUndoable(st);
      st.tasks[0]!.name = 'Y';
      ctx.runtime.finishMutation(st);
      ctx.runtime.finishUndoable(st, { nonEdit: true });
    });
    const last = [...ctx.store.getState().historyEvents].sort((a, b) => b.sequence - a.sequence)[0];
    const delta = last?.deltas[0];
    eq('16v nonEdit wordt genegeerd zodra er binnen dezelfde mutatie een bewerking liep',
      delta?.kind === 'document-data' ? delta.nonEdit ?? 'bewerking' : 'geen event', 'bewerking');
  }

  // Broncodescan: `isDirty = true` staat uitsluitend in `documentEdited.ts` — élke mutator die het
  // document vuil maakt, wist daarmee ook de vlag. Zelfde wortelkandidaten als sectie 11.
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find((p) => existsSync(p)) ?? null;
  truthy('16m de broncontrole vindt src/', srcRoot !== null);
  if (srcRoot) {
    // Twee schrijfwijzen (critreview op ded4d8c3, bevinding 7): de toekenning `isDirty = true` én de
    // objectliteral `isDirty: true` (een payload die zo wordt opgebouwd omzeilt markDocumentEdited
    // net zo goed). Per REGEL, commentaarregels overgeslagen. Elke objectliteral-plek die bewust
    // blijft staat hieronder met reden én een fragment van de regel; een uitzondering die niets
    // meer vangt faalt ook (16n2), zodat de lijst niet stil veroudert.
    const UITZONDERINGEN: { file: string; fragment: string; reden: string }[] = [
      { file: 'services/mcp/tools/documentTools.ts', fragment: 'a fresh undo stack and `isDirty: true`',
        reden: 'tooltekst voor de AI-client (stringliteral), geen state' },
      { file: 'services/recovery/recoveryStore.ts', fragment: 'docs.push({ id, ifc, filePath: null, isDirty: true',
        reden: 'crashherstelmanifest; een hersteld document is te bewaren, de importvlag komt uit het IFC zelf' },
      { file: 'services/recovery/recoveryStore.ts', fragment: "docs: [{ id: 'legacy', ifc, filePath: null, isDirty: true",
        reden: 'idem, legacy-manifest' },
      { file: 'services/recovery/recoveryStore.ts', fragment: 'id, ifc: docKey(generation, id), filePath: null, isDirty: true',
        reden: 'idem, manifestregel per document' },
      { file: 'state/sessionHistory.ts', fragment: '      isDirty: true;',
        reden: 'typebeschrijving van een gematerialiseerd history-doel (geen state); het toepassen loopt via restoreSnapshot' },
      { file: 'state/sessionHistory.ts', fragment: '      isDirty: true,',
        reden: 'waarde in datzelfde history-doel; de live state wordt via restoreSnapshot gemarkeerd' },
      { file: 'state/slices/documentSlice.ts', fragment: 'isDirty: true,',
        reden: 'kopie van een document: zet in dezelfde literal expliciet importPristine: false' },
      { file: 'state/slices/librarySlice.ts', fragment: '...r.before, isDirty: true, resourceLoadResult: null',
        reden: 'undoDistribution op een slapend document: de verdeling zelf liep via applyLeveling → finishMutation '
          + '(vlag al false in de payload); r.before is een Snapshot zonder importPristine, dus de vlag blijft false '
          + '— zelfde uitkomst als restoreSnapshot op het actieve pad (16l)' },
    ];
    const gebruikt = new Set<number>();
    const overtreders: string[] = [];
    const loop = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = joinPath(dir, entry.name);
        if (entry.isDirectory()) { loop(full); continue; }
        if (!/\.tsx?$/.test(entry.name) || full.endsWith('documentEdited.ts')) continue;
        const rel = full.slice(srcRoot.length).replace(/\\/g, '/').replace(/^\//, '');
        readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
          const t = line.trim();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
          if (!/\bisDirty\s*=\s*true\b/.test(line) && !/\bisDirty\s*:\s*true\b/.test(line)) return;
          const u = UITZONDERINGEN.findIndex((x) => x.file === rel && line.includes(x.fragment) && /\bisDirty\s*:/.test(line));
          if (u >= 0) { gebruikt.add(u); return; }
          overtreders.push(`${rel}:${i + 1}`);
        });
      }
    };
    loop(srcRoot);
    eq('16n `isDirty = true` / `isDirty: true` staat nergens buiten markDocumentEdited (documentEdited.ts) en de uitzonderingenlijst', overtreders, []);
    eq('16n2 elke uitzondering vangt nog een regel (geen verouderde lijst)',
      UITZONDERINGEN.filter((_, i) => !gebruikt.has(i)).map((x) => `${x.file}: ${x.fragment}`), []);
  }

  // 16y: een SLAPEND hersteld document in de modus heeft geen meting (`applyRestoredRecordedMode`
  // rekent niet door). Na de wissel ernaartoe zegt het paneel per taak dus NIETS over verschuiven:
  // `recordedTaskWillShift` geeft `undefined`, nooit een verzonnen `false`.
  // MUTATIEBEWIJS: `return recorded.shiftedTaskIds?.includes(taskId) ?? false` in
  // `recordedDatesSelectors.ts` ⇒ 16y3 slaat ROOD.
  {
    const slaap = recoveryInputFromParsed(inMode(externIfc('16y')), { id: 'rec-16y-slaap', filePath: null, isDirty: false, datesAsRecorded: true });
    const wakker = recoveryInputFromParsed(inMode(externIfc('16y')), { id: 'rec-16y-wakker', filePath: null, isDirty: false, datesAsRecorded: true });
    S().newProject();
    S().restoreDocuments([slaap, wakker], 'rec-16y-wakker');
    S().switchDocument('rec-16y-slaap');
    const bId = idOfWbs('1.2');
    eq('16y1 na de wissel: het slapend herstelde document staat in de modus, met vastlegging',
      [S().activeDocumentId, S().datesAsRecorded, S().recordedDates !== null], ['rec-16y-slaap', true, true]);
    eq('16y2 …maar zonder meting', [S().recordedDates?.shifted, S().recordedDates?.shiftedTaskIds], [undefined, undefined]);
    eq('16y3 recordedTaskWillShift: onbekend, geen verzonnen "nee"',
      recordedTaskWillShift(S().recordedDates, S().datesAsRecorded, bId), undefined);
  }
}

// ── (17) CSV met onleesbare datumcellen opent NIET in de modus (critreview ded4d8c3, bevinding 1) ─
// Vóór de fix legde de CSV-lezer "vandaag" vast voor een gevulde maar onleesbare datumcel; B hangt
// aan A, dus na de solve verschoof B t.o.v. die verzonnen vastlegging en ging het document de modus
// in met alle taken op vandaag. Het laadpad hieronder is het echte (`applyOpenedImport`).
{
  S().newProject();
  S().applyOpenedImport(readCSV(CSV_FIXTURE_UNREADABLE_DATES), { filePath: null, recompute: true });
  eq('17a onleesbare CSV-datums: geen modus, geen vastlegging', [S().datesAsRecorded, S().recordedDates], [false, null]);
}

// ── (18) Heropenen van een EIGEN IFC geeft geen openingsmelding (critreview ded4d8c3, bevinding 6) ─
// Scenario: verse import (modus aan) → een bewerking die de modus NIET verlaat (projectomschrijving,
// geen datumwijziging) wist "ongewijzigd sinds import" → opslaan ín de modus → heropenen. Het eigen
// IFC ('ifc-own', vlag uit, mét `SourceFormat`) opent weer in de modus, zoals je het achterliet
// (eigenaar, 2026-10-17), maar zonder openingsmelding: het is geen nieuwe import. Het echte openpad
// (`applyOpenedImport`), dat ook de melding plaatst.
{
  const importMeldingen = () => S().ui.notifications.filter((n) =>
    n.messageKey === 'notifications.importDatesAsRecorded').length;
  S().newProject();
  const voorImport = importMeldingen();
  S().applyOpenedImport(readIFC(externIfc('18')), { filePath: null, recompute: true });
  eq('18a tegenproef: een verse import in de modus geeft wél de openingsmelding', importMeldingen() - voorImport, 1);
  S().setProject({ description: 'bewerkt, zonder datumwijziging' });
  eq('18b de bewerking wist de vlag maar laat de modus staan', [S().datesAsRecorded, S().importPristine], [true, false]);
  const eigen = readIFC(writeIFC(buildWriteIFCInput(S())));
  eq('18c het opgeslagen bestand is een eigen IFC zonder vlag', [eigen.recordedTimesOrigin, eigen.importPristine], ['ifc-own', false]);
  S().newProject();
  const voorHeropen = importMeldingen();
  S().applyOpenedImport(eigen, { filePath: null, recompute: true });
  eq('18d heropenen: in de modus opgeslagen ⇒ weer in de modus, met vastlegging', [S().recordedDates !== null, S().datesAsRecorded], [true, true]);
  eq('18e …en GEEN openingsmelding', importMeldingen() - voorHeropen, 0);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  recorded-dates: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recorded-dates: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
