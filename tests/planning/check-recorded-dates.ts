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
  type RecordedTime,
} from '@/engine/scheduler/recordedDates';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { recordedDatesActiveKey } from '@/components/layout/recordedDatesNoticeText';
import { unrecordedExportGate } from '@/state/recordedDatesSelectors';
import { writeCSV } from '@/services/csv/csvWriter';
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
// Rechtstreekse eenheidstest op de kern zelf (los van de winkel/`showRecordedDates`, die in sectie
// (8) hieronder via de ECHTE store getest wordt). Bewijst: (a) de teruggegeven `CPMResult` is
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
  eq('7k detectie zet de modus niet aan', S().datesAsRecorded, false);

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

  // Door de ECHTE store: detectie moet aanslaan ÉN de vastgelegde start/finish moeten uit de
  // SCHEDULE-laag komen (er is geen early-laag om op terug te vallen).
  S().newProject();
  S().applyLoadedProject(readIFC(EXTERN_SCHEDULE_ONLY), { filePath: null, recompute: true });

  truthy('7p schedule-only: afwijking gedetecteerd', S().recordedDates !== null);
  eq('7q schedule-only: shifted telt de verschoven taak (b)', S().recordedDates?.shifted, 1);
  eq('7r schedule-only: total telt alle vastgelegde taken (a + b)', S().recordedDates?.total, 2);
  const bIdSAfterLoad = S().tasks.find(t => t.wbsCode === '1.2')!.id;
  eq('7s schedule-only: vastgelegde start van b komt uit de schedule-laag', S().recordedDates?.times[bIdSAfterLoad]?.start, '2026-03-16');
  eq('7t schedule-only: vastgelegde finish van b komt uit de schedule-laag', S().recordedDates?.times[bIdSAfterLoad]?.finish, '2026-03-20');
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
  // IFC/CSV/MSPDI/MPP/P6XML-document (die dit veld nooit zet) byte-identiek #63-gedrag houdt.
  const asUnknownOrigin: ImportResult = {
    ...rtOracleSource, recordedFields: undefined, recordedTimes: oracleTimes,
  };
  S().newProject();
  S().applyLoadedProject(asUnknownOrigin, { filePath: null, recompute: true });
  eq('7ad zonder recordedTimesOrigin blijft de modus UIT (O6-mutatiebewijs)', S().datesAsRecorded, false);
  truthy('7ae …maar het aanbod verschijnt nog gewoon (recordedDates gevuld)', S().recordedDates !== null);
  eq('7af …met dezelfde teller', S().recordedDates?.shifted, 1);

  // Heropen-beleid (orkestratorbesluit, XER-etappe laag 3, 2026-09-05): 'xer-archive' — een
  // heropende IFC met XER-archief (T5) — biedt de modus alleen AAN, net als 'xer-archive' zonder
  // enige herkomst hierboven. Alleen 'xer' (verse import) zet 'm automatisch AAN. MUTATIEBEWIJS:
  // stelde `applyRecordedDatesOnLoad` 'xer-archive' gelijk aan 'xer' (`origin !== undefined` i.p.v.
  // `origin === 'xer'`), dan zou 7ah hieronder `true` worden en dus ROOD slaan.
  const asXerArchive: ImportResult = {
    ...rtOracleSource, recordedFields: undefined, recordedTimes: oracleTimes,
    recordedTimesOrigin: 'xer-archive',
  };
  S().newProject();
  S().applyLoadedProject(asXerArchive, { filePath: null, recompute: true });
  eq('7ag "xer-archive" (heropende IFC met XER-archief) biedt de modus alleen aan, NIET gelijk aan "xer"',
    S().datesAsRecorded, false);
  truthy('7ah …maar het aanbod verschijnt wél', S().recordedDates !== null);
  eq('7ai …met dezelfde teller als de verse import (sectie 7u)', S().recordedDates?.shifted, 1);
  eq('7ai2 …en draagt de archiefherkomst, dus óók de Primavera-tekst (sectie 14)',
    S().recordedDates?.origin, 'xer-archive');
}

// ── (7C) Crashherstel raakt de #63-route NIET ────────────────────────────────────────────────
// `restoreDocuments` gebruikt sinds het heropen-beleid (XER-etappe laag 3, T8) een eigen
// `applyRecordedDatesOnRestore` die de modusvlag van vóór de crash TERUGLEEST uit een bron-orakel.
// Deze sectie pint de tegenkant vast: een gewoon #63-document (IFC/CSV/MSPDI/MPP/P6XML) heeft geen
// orakel, dus er valt niets terug te lezen — daar blijft het bestaande gedrag "alleen aanbieden"
// gelden. Zonder deze check zou die terugleesregel stil doorslaan naar élk hersteld document: bij
// de `recordedFields`-route komt de vastlegging namelijk uit de taken zélf, dus een vergelijking
// van die taken met die vastlegging is per definitie 0 verschoven — "de modus stond aan" zou daar
// dus ALTIJD waar lijken. MUTATIEBEWIJS: haal de orakel-voorwaarde uit
// `applyRecordedDatesOnRestore` weg (`wasInModeBeforeCrash` zonder `hasOracle`) ⇒ 7aj slaat ROOD.
{
  const parsed = readIFC(externIfc('7C'));
  const input = recoveryInputFromParsed(parsed, { id: 'rec-63', filePath: null, isDirty: true, datesAsRecorded: false });
  S().newProject();
  S().restoreDocuments([input], 'rec-63');
  eq('7aj crashherstel van een gewoon #63-document zet de modus NIET aan', S().datesAsRecorded, false);
  truthy('7ak …maar herstelt wél het aanbod', S().recordedDates !== null);
  eq('7al …met dezelfde teller als het gewone openen (sectie 7i)', S().recordedDates?.shifted, 1);
  eq('7am …en zonder herkomststempel, dus met de formaatneutrale tekst', S().recordedDates?.origin, undefined);
}

// ── (8) showRecordedDates — de modus betreden (Taak 5) ────────────────────────
// Zelfde fixture als (7): één FS-relatie waarvan de opgeslagen datums niet uit de logica volgen
// (b staat vast op 2026-03-16, ver ná a's werkelijke opvolgdatum 2026-03-09), zodat er na de echte
// solve écht iets "terug te tonen" is.
{
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('2')), { filePath: null, recompute: true });
  truthy('8a voorwaarde: recordedDates is gezet (b verschoof)', S().recordedDates !== null);

  const aId = idOfWbs('1.1');
  const bId = idOfWbs('1.2');

  // Zet near-critical/float-paths AAN buiten een actie om (directe draft-mutatie, geen undo/isDirty-
  // bijwerking), zodat de aansluitende runCPM écht een waarde in interferingFloat/isNearCritical/
  // floatPath schrijft — zonder dit blijven isNearCritical/floatPath toch al `undefined` (de
  // projectdefaults staan uit) en zou de wis-assertie hieronder niets bewijzen.
  useAppStore.setState((s) => {
    s.project.schedulingOptions = {
      nearCriticalThreshold: 5,
      floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 5 },
    };
  });
  S().runCPM();
  truthy('8b voorwaarde: interferingFloat staat vóór het betreden op een waarde',
    S().tasks.find((t) => t.id === aId)!.time.interferingFloat !== undefined);
  truthy('8c voorwaarde: isNearCritical staat vóór het betreden op een waarde',
    S().tasks.find((t) => t.id === aId)!.time.isNearCritical !== undefined);
  truthy('8d voorwaarde: floatPath staat vóór het betreden op een waarde',
    S().tasks.find((t) => t.id === aId)!.time.floatPath !== undefined);
  eq('8e voorwaarde: isDirty nog steeds false (setState/runCPM zijn geen acties)', S().isDirty, false);

  // Zet scheduleStale ook expres AAN (direct, geen actie): zonder dit staat hij door de zojuist
  // gedraaide runCPM al op false, en zou de assertie "scheduleStale is false" hieronder een mutatie
  // die de eigen `s.scheduleStale = false`-regel weghaalt niet vangen (was al false vóór de aanroep).
  useAppStore.setState((s) => { s.scheduleStale = true; });
  truthy('8e2 voorwaarde: scheduleStale staat vóór het betreden op waar', S().scheduleStale);

  const undoDepthBefore = S().historyEvents.filter(event => event.state === 'applied').length;
  S().showRecordedDates();

  eq('8f modus staat aan', S().datesAsRecorded, true);
  eq('8g verschoven taak toont weer opgeslagen earlyStart', S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-16');
  eq('8h verschoven taak toont weer opgeslagen earlyFinish', S().tasks.find((t) => t.id === bId)!.time.earlyFinish, '2026-03-20');
  eq('8i scheduleStale is false', S().scheduleStale, false);
  eq('8j isDirty blijft false — openen en bekijken maakt niet vies', S().isDirty, false);
  truthy('8k cpmResult is niet null', S().cpmResult !== null);
  eq('8l projectEnd komt uit het bestand', S().cpmResult?.projectEnd, '2026-03-20');
  eq('8m drivingSequenceIds is leeg (niet in IFC)', S().cpmResult?.drivingSequenceIds, []);
  eq('8n precies één undo-stap erbij', S().historyEvents.filter(event => event.state === 'applied').length, undoDepthBefore + 1);
  eq('8o interferingFloat gewist', S().tasks.find((t) => t.id === aId)!.time.interferingFloat, undefined);
  eq('8p isNearCritical gewist', S().tasks.find((t) => t.id === aId)!.time.isNearCritical, undefined);
  eq('8q floatPath gewist', S().tasks.find((t) => t.id === aId)!.time.floatPath, undefined);

  // Tweede aanroep: no-op (géén tweede undo-stap, geen wijziging).
  const undoDepthAfterFirst = S().historyEvents.filter(event => event.state === 'applied').length;
  S().showRecordedDates();
  eq('8r tweede aanroep pusht geen undo-stap', S().historyEvents.filter(event => event.state === 'applied').length, undoDepthAfterFirst);
  eq('8s tweede aanroep laat de modus aan staan', S().datesAsRecorded, true);
  eq('8t tweede aanroep laat de opgeslagen datum met rust', S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-16');

  // Zonder recordedDates (bv. na newProject()) doet de actie niets.
  S().newProject();
  eq('8u voorwaarde: newProject geeft geen recordedDates', S().recordedDates, null);
  const undoDepthZonder = S().historyEvents.filter(event => event.state === 'applied').length;
  S().showRecordedDates();
  eq('8v zonder recordedDates blijft de modus uit', S().datesAsRecorded, false);
  eq('8w zonder recordedDates geen undo-stap', S().historyEvents.filter(event => event.state === 'applied').length, undoDepthZonder);
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
  S().applyLoadedProject(readIFC(externIfc('9a')), { filePath: null, recompute: true });
  const aId = idOfWbs('1.1');
  const bId = idOfWbs('1.2');

  truthy('9A-1 voorwaarde: recordedDates gezet (b verschoof)', S().recordedDates !== null);
  eq('9A-2 voorwaarde: de solve zette b op zijn logische datum', earlyStartOf(bId), '2026-03-09');
  S().showRecordedDates();
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
  S().applyLoadedProject(readIFC(externIfc('9b')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');

  S().showRecordedDates();
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
  S().applyLoadedProject(readIFC(externIfc('9c')), { filePath: null, recompute: true });
  eq('9C-1 voorwaarde: de modus staat UIT (detectie zet hem niet aan)', S().datesAsRecorded, false);
  truthy('9C-2 voorwaarde: er is wél iets aan te bieden (anders meet dit een vacuüm)', S().recordedDates !== null);
  // Zet `scheduleStale` expres aan (direct, geen actie): zonder dit zou runCPM hooguit "niets te
  // doen" bevestigen, terwijl de assertie moet bewijzen dat een ECHTE herberekening niets pusht.
  useAppStore.setState((s) => { s.scheduleStale = true; });

  const undoVoorC = S().historyEvents.filter(event => event.state === 'applied').length;
  S().runCPM();
  eq('9C-3 runCPM buiten de modus pusht GEEN undo-snapshot', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorC);
  truthy('9C-4 runCPM buiten de modus laat de vastlegging staan', S().recordedDates !== null);
  eq('9C-5 runCPM buiten de modus zet geen isDirty', S().isDirty, false);
}

// (9.D) De bewuste asymmetrie: een bewerking die GÉÉN datums raakt (`finishMutation` zonder
// `stale`) laat de modus staan. Zou élke `finishMutation` de modus verlaten, dan zou een
// hernummering het aanbod stil weggooien — en er is dan niets dat de weergegeven datums nog
// herrekent, want `scheduleStale` blijft uit. Precies de mengvorm die de modus moet voorkomen.
{
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('9d')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');
  S().showRecordedDates();
  eq('9D-1 voorwaarde: modus staat aan', S().datesAsRecorded, true);

  S().renumberWbs();
  eq('9D-2 een niet-datum-rakende bewerking laat de modus staan', S().datesAsRecorded, true);
  truthy('9D-3 …en laat de vastlegging staan', S().recordedDates !== null);
  eq('9D-4 …en zet de planning niet op verouderd', S().scheduleStale, false);
  eq('9D-5 …en laat de getoonde opgeslagen datum met rust', earlyStartOf(bId), '2026-03-16');
}

// ── (10) De tweede ring: élk ánder pad dat herrekent (review taak 6) ─────────
// Routes A en B dekken de twee uitgangen die de gebruiker zelf bedient. Daarnaast rekent de app op
// nog drie plekken door zonder dat er een bewerking aan te pas komt. Die mogen de modus niet stil
// achterlaten (of stil verlaten) — dat is wat deze sectie vastlegt.

// (10.A) K3 — een SLAPEND document dat op de achtergrond wordt doorgerekend.
{
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('10a')), { filePath: null, recompute: true });
  S().showRecordedDates();
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
  S().applyLoadedProject(readIFC(externIfc('10c')), { filePath: null, recompute: true });
  S().showRecordedDates();
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
  S().applyLoadedProject(readIFC(externIfc('10d')), { filePath: null, recompute: true });
  S().showRecordedDates();
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
  S().applyLoadedProject(readIFC(externIfc('11')), { filePath: null, recompute: true });
  geenModusEnStale('11d na laden');
  S().showRecordedDates();
  geenModusEnStale('11e in de modus');
  const aId = idOfWbs('1.1');
  const aTime = S().tasks.find((t) => t.id === aId)!.time;
  S().updateTask(aId, { time: { ...aTime, scheduleDuration: 3 } });
  geenModusEnStale('11f na een bewerking (modus uit, wél verouderd)');
  S().undo();
  geenModusEnStale('11g na undo (modus terug aan, niet verouderd)');

  // (11h) XER-etappeplan §3.5/§4-T4, risico §5.1: het bron-orakel-laadpad zet de modus AAN in
  // `applyRecordedDatesOnLoad`, dus deze invariant moet ook ná EEN AUTO-AAN-LOAD gelden — niet
  // alleen ná een handmatige `showRecordedDates()`-aanroep zoals 11d/11e hierboven.
  const rt11h = readIFC(externIfc('11h'));
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
  S().applyLoadedProject(readIFC(externIfc('csv')), { filePath: null, recompute: true });
  S().showRecordedDates();
  truthy('13Ba voorwaarde: de modus staat aan', S().datesAsRecorded);

  const kolommen = (csv: string) => csv.trim().split('\r\n').slice(1).map(regel => regel.split(';'));
  const inModus = writeCSV(
    S().project, S().calendar, S().tasks, S().sequences, S().resources, S().assignments,
    S().customTaskTypes, unrecordedExportGate(S().recordedDates, S().datesAsRecorded),
  );
  const rijenInModus = kolommen(inModus);
  eq('13Bb in de modus is de niet-vastgelegde totale speling (kolom 13) een LEGE cel, geen verzonnen 0',
    rijenInModus.map(rij => rij[13]), ['', '']);
  eq('13Bc … en de niet-vastgelegde kritiek-vlag (kolom 12) óók, geen verzonnen "No"',
    rijenInModus.map(rij => rij[12]), ['', '']);
  eq('13Bd … terwijl de WÉL vastgelegde datums gewoon geëxporteerd worden',
    rijenInModus.map(rij => rij[3]), ['2026-03-02', '2026-03-16']);

  // Tegenproef: buiten de modus is de export byte-identiek aan voorheen — de poort levert dan
  // `undefined` en de kolommen dragen de echte berekening.
  S().runCPM();
  eq('13Be voorwaarde: runCPM verliet de modus', S().datesAsRecorded, false);
  const buitenModus = writeCSV(
    S().project, S().calendar, S().tasks, S().sequences, S().resources, S().assignments,
    S().customTaskTypes, unrecordedExportGate(S().recordedDates, S().datesAsRecorded),
  );
  const rijenBuiten = kolommen(buitenModus);
  eq('13Bf buiten de modus staat de BEREKENDE speling in de kolom', rijenBuiten.map(rij => rij[13]), ['0', '0']);
  eq('13Bg … en de berekende kritiek-vlag', rijenBuiten.map(rij => rij[12]), ['Yes', 'Yes']);
  eq('13Bh zonder poort is de export byte-identiek aan het gedrag van vóór deze wijziging',
    writeCSV(S().project, S().calendar, S().tasks, S().sequences, S().resources, S().assignments,
      S().customTaskTypes), buitenModus);
}

// ── (14) De meldingstekst is BRONAFHANKELIJK ─────────────────────────────────────────────────
// De MODUS-ACTIEF-strook zegt "zoals Primavera ze opsloeg". Die strook is echter gedeeld met de
// #63-route voor elk ander formaat, waar niemand weet uit welk pakket de datums komen — daar is die
// zin een verkeerde bewering. Twee helften:
//  (a) de KEUZE (`recordedDatesActiveKey`, de React-vrije besluitmodule achter de component);
//  (b) de INHOUD in alle veertien talen: de Primavera-familie noemt Primavera, de neutrale familie
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
    eq('14e alle veertien talen worden gecontroleerd', talen.length, 14);

    const zonderNeutraal: string[] = [];
    const neutraalNoemtPrimavera: string[] = [];
    const primaveraNoemtHetNiet: string[] = [];
    for (const taal of talen) {
      const json = JSON.parse(readFileSync(joinPath(localesRoot, taal, 'common.json'), 'utf8')) as
        Record<string, Record<string, string>>;
      const rd = json.recordedDates ?? {};
      const primavera = Object.entries(rd).filter(([k]) => k.startsWith('activeCount_'));
      const neutraal = Object.entries(rd).filter(([k]) => k.startsWith('activeCountNeutral_'));
      if (neutraal.length === 0 || neutraal.length !== primavera.length) zonderNeutraal.push(taal);
      if (neutraal.some(([, v]) => v.includes('Primavera'))) neutraalNoemtPrimavera.push(taal);
      if (primavera.some(([, v]) => !v.includes('Primavera'))) primaveraNoemtHetNiet.push(taal);
    }
    eq('14f elke taal heeft de neutrale familie met exact dezelfde pluralvormen als de Primavera-familie',
      zonderNeutraal, []);
    eq('14g de NEUTRALE tekst noemt Primavera in geen enkele taal', neutraalNoemtPrimavera, []);
    eq('14h de Primavera-tekst noemt Primavera juist WEL in elke taal (anders bewijst 14g niets)',
      primaveraNoemtHetNiet, []);
  }
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
