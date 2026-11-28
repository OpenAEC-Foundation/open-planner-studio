import {
  applyRecordedTimesToTasks,
  captureRecordedDates,
  countShiftedTasks,
  cpmResultFromRecorded,
  shiftedTaskIds,
  type RecordedTime,
} from '@/engine/scheduler/recordedDates';
import { documentContentOf } from '@/state/documentSaveState';
import { knownDrivingSequenceIds } from '@/engine/scheduler/drivingInfo';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { WorkTimeBands } from '@/types/calendar';
import { createAppStoreContext, useAppStore } from '@/state/appStore';
import { payloadFromImport, recoveryInputFromParsed } from '@/state/documentContract';
import { applyRestoredRecordedMode, prepareLoadedPayload } from '@/state/documentActivation';
import { LOCALES } from '../../scripts/i18n-tools';
import { recordedDatesActiveKey, recordedDatesTaskMissingKey, recordedDatesTaskShownKey } from '@/components/layout/recordedDatesNoticeText';
import { recordedTaskMark, recordedTaskWillShift, unrecordedExportGate } from '@/state/recordedDatesSelectors';
import { writeCSV } from '@/services/csv/csvWriter';
import { CsvDateImportError, readCSV } from '@/services/csv/csvReader';
import { CSV_FIXTURE_UNREADABLE_DATES } from '../fixtures/recordedTimesFormats';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { parseStep } from './ifcSchemaCheck';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { IFC_TASKTIME_SLOTS, TASKTIME_SLOT } from '@/services/ifc/ifcTaskSlots';
import { externIfc, taskArgs } from '../fixtures/recordedDatesIfc';
import {
  leftRecordedDatesMode,
  needsExitRecompute,
  restoredFromHistory,
  type RecordedDatesObservation,
} from '@/state/recordedDatesExit';
import { normalizeTaskDates } from '@/state/migrations/minuteModel';
import { currentRecordedTimes } from '@/state/minuteModelTransition';
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

eq('1o zonder recordedFields geen enkele taak', Object.keys(captureRecordedDates([mk('a')], undefined).times), []);

const halfEarly = captureRecordedDates(
  [mk('a', { earlyStart: '2026-04-01', scheduleStart: '2026-03-02', scheduleFinish: '2026-03-06' })],
  { a: ['earlyStart', 'scheduleStart', 'scheduleFinish'] },
);
eq('1p half early-paar ⇒ hele taak op schedule-laag (start)', halfEarly.times['a'].start, '2026-03-02');
eq('1q half early-paar ⇒ hele taak op schedule-laag (finish)', halfEarly.times['a'].finish, '2026-03-06');

const beideCompleet = captureRecordedDates(
  [mk('a', { earlyStart: '2026-04-01', earlyFinish: '2026-04-08' })],
  { a: ['earlyStart', 'earlyFinish', 'scheduleStart', 'scheduleFinish'] },
);
eq('1v beide paren compleet ⇒ early wint (start)', beideCompleet.times['a'].start, '2026-04-01');
eq('1w beide paren compleet ⇒ early wint (finish)', beideCompleet.times['a'].finish, '2026-04-08');

const geenPaarCompleet = captureRecordedDates([mk('a', { earlyStart: '2026-04-01' })], { a: ['earlyStart'] });
eq('1r geen compleet paar ⇒ taak niet vastgelegd', Object.keys(geenPaarCompleet.times), []);
eq('1s geen compleet paar ⇒ ook niet in total', geenPaarCompleet.total, 0);

const zonderIfcTaskTime = captureRecordedDates(
  [mk('a', { scheduleStart: '2099-09-09', scheduleFinish: '2099-09-13' })],
  { a: [] },
);
eq('1t taak zonder IfcTaskTime landt niet in times', Object.keys(zonderIfcTaskTime.times), []);
eq('1u taak zonder IfcTaskTime telt niet mee in total', zonderIfcTaskTime.total, 0);

const oracle: Record<string, RecordedTime> = {
  a: {
    start: '2026-07-01', finish: '2026-07-05',
    lateStart: '2026-07-02', lateFinish: '2026-07-06',
    totalFloat: 1, freeFloat: 0.5, isCritical: false,
  },
};
const metOrakel = captureRecordedDates(
  [mk('a', { earlyStart: '2099-01-01', earlyFinish: '2099-01-05' })],
  { a: ['earlyStart', 'earlyFinish'] },
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

const orakelMetOnbekend: Record<string, RecordedTime> = {
  a: { start: '2026-08-01', finish: '2026-08-02' },
  zzz: { start: '2026-08-03', finish: '2026-08-04' },
};
const gefilterd = captureRecordedDates([mk('a')], undefined, orakelMetOnbekend);
eq('1ab orakel filtert op taak-ids die echt in tasks zitten', Object.keys(gefilterd.times), ['a']);
eq('1ac orakel-total telt alleen de overgebleven, gefilterde entries', gefilterd.total, 1);

eq('1ad orakel + lege takenlijst ⇒ lege vastlegging',
  captureRecordedDates([], undefined, { a: { start: '2026-01-01', finish: '2026-01-02' } }),
  { times: {}, total: 0 });
eq('1ae leeg orakel-object (aanwezig, maar zonder entries) ⇒ lege vastlegging, GEEN terugval op recordedFields',
  captureRecordedDates([mk('a')], { a: ['scheduleStart', 'scheduleFinish'] }, {}),
  { times: {}, total: 0 });

const basis = captureRecordedDates(
  [mk('a'), mk('b')],
  { a: ['scheduleStart', 'scheduleFinish'], b: ['scheduleStart', 'scheduleFinish'] },
);
eq('2a total = aantal vastgelegde taken, niet aantal meegegeven taken',
  captureRecordedDates(
    [mk('a'), mk('b'), mk('c')],
    { a: ['scheduleStart', 'scheduleFinish'], b: ['scheduleStart', 'scheduleFinish'] },
  ).total, 2);
eq('2b identiek ⇒ 0 verschoven', countShiftedTasks([mk('a'), mk('b')], basis.times), 0);
eq('2c één verschoven ⇒ 1',
  countShiftedTasks([mk('a', { earlyStart: '2026-05-01' }), mk('b')], basis.times), 1);
eq('2d onbekende taak telt niet mee', countShiftedTasks([mk('c')], basis.times), 0);

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
  const times2l = { v: p3Done, l: { start: '2008-05-27T08:00', finish: '2008-06-13T17:00' } };
  eq('2l lijst per taak = telling: voltooid ⇒ niet verschoven, lopend met ander einde ⇒ verschoven',
    shiftedTaskIds([done, running], times2l), [running.id]);
  eq('2l2 buiten de modus geen markering', recordedTaskMark({ times: times2l, total: 2 }, false, running), undefined);
}

eq('2e een id in recordedFields dat niet in tasks zit ⇒ genegeerd',
  captureRecordedDates([mk('a')], { a: ['scheduleStart', 'scheduleFinish'], zzz: [] }).total, 1);
eq('2f lege takenlijst ⇒ lege vastlegging', captureRecordedDates([], { a: [] }), { times: {}, total: 0 });

const cal = createDefaultCalendar();
const volInfo = captureRecordedDates(
  [mk('a', { earlyStart: '2026-03-02', earlyFinish: '2026-03-06', totalFloat: 0, isCritical: true }),
   mk('b', { earlyStart: '2026-03-09', earlyFinish: '2026-03-13', totalFloat: 4, isCritical: false })],
  { a: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'],
    b: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'] },
);
const rec = cpmResultFromRecorded(volInfo.times, [mk('a'), mk('b')], cal, []);
eq('3a projecteinde = laatste opgeslagen finish', rec.projectEnd, '2026-03-13');
eq('3b kritiek pad uit isCritical', rec.criticalPath, ['a']);
eq('3c criticalPaths[0] === criticalPath', rec.criticalPaths[0], rec.criticalPath);
eq('3d speling uit het bestand', rec.tasks.get('b')?.totalFloat, 4);
truthy('3e geen foutveld', rec.error === undefined);

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

eq('3h1 opgeslagen datums markeren driving als onbekend', rec.drivingUnknown, true);
eq('3h2 lezers krijgen geen driving-informatie uit de reconstructie', knownDrivingSequenceIds(rec), undefined);
eq('3h3 onbekend wint ook van een achtergebleven driving-id',
  knownDrivingSequenceIds({ ...rec, drivingSequenceIds: ['oud'] }), undefined);
eq('3h4 berekend zonder driving blijft een bekende lege lijst',
  knownDrivingSequenceIds({ ...rec, drivingUnknown: undefined, drivingSequenceIds: [] }), []);
eq('3h5 bekende driving-ids blijven beschikbaar',
  knownDrivingSequenceIds({ ...rec, drivingUnknown: undefined, drivingSequenceIds: ['ab'] }), ['ab']);
eq('3h6 geen berekening is onbekend', knownDrivingSequenceIds(null), undefined);
eq('3h7 ontbrekend resultaat is onbekend', knownDrivingSequenceIds(undefined), undefined);
eq('3h8 mislukte berekening verbergt achtergebleven driving-ids',
  knownDrivingSequenceIds({ ...rec, drivingUnknown: undefined, drivingSequenceIds: ['ab'], error: 'kring' }), undefined);

const zonderKritiek = cpmResultFromRecorded(
  captureRecordedDates([mk('a')], { a: ['scheduleStart', 'scheduleFinish'] }).times, [mk('a')], cal, [],
);
eq('3i zonder isCritical geen kritiek pad', zonderKritiek.criticalPath, []);
eq('3j zonder isCritical ook criticalPaths leeg', zonderKritiek.criticalPaths, [[]]);

eq('3k lateStart-fallback = start', zonderKritiek.tasks.get('a')?.lateStart, '2026-03-02');
eq('3l lateFinish-fallback = finish', zonderKritiek.tasks.get('a')?.lateFinish, '2026-03-06');
eq('3m totalFloat-default = 0', zonderKritiek.tasks.get('a')?.totalFloat, 0);
eq('3n freeFloat-default = 0', zonderKritiek.tasks.get('a')?.freeFloat, 0);
eq('3o isCritical-default = false', zonderKritiek.tasks.get('a')?.isCritical, false);

const legeTasks = cpmResultFromRecorded(volInfo.times, [], cal, []);
eq('3p times gevuld maar tasks leeg ⇒ leeg resultaat', legeTasks.tasks.size, 0);
eq('3q times gevuld maar tasks leeg ⇒ geen projecteinde', legeTasks.projectEnd, '');
const legeBeide = cpmResultFromRecorded({}, [], cal, []);
eq('3r volledig leeg ⇒ projectDuration 0', legeBeide.projectDuration, 0);

{
  const kernTasks = [
    mk('a', {
      earlyStart: '2026-09-01', earlyFinish: '2026-09-05',
      interferingFloat: 3, isNearCritical: true, floatPath: 0,
    }),
    mk('b'),
  ];
  const kernTimes = captureRecordedDates(
    [mk('a', { earlyStart: '2026-09-01', earlyFinish: '2026-09-05', totalFloat: 2, isCritical: true })],
    { a: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'] },
  ).times;
  const kernResult = applyRecordedTimesToTasks(kernTasks, kernTimes, cal, []);
  const verwachtResult = cpmResultFromRecorded(kernTimes, kernTasks, cal, []);
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

const overDeadline = mk('a', { earlyStart: '2026-03-02', earlyFinish: '2026-03-06' }, { deadline: '2026-03-05' });
const binnenDeadline = mk('b', { earlyStart: '2026-03-02', earlyFinish: '2026-03-04' }, { deadline: '2026-03-10' });
const opDeadline = mk('d', { earlyStart: '2026-03-02', earlyFinish: '2026-03-06' }, { deadline: '2026-03-06' });
const infoDeadline = captureRecordedDates(
  [overDeadline, binnenDeadline, opDeadline],
  { a: ['earlyStart', 'earlyFinish'], b: ['earlyStart', 'earlyFinish'], d: ['earlyStart', 'earlyFinish'] },
);
const recDeadline = cpmResultFromRecorded(infoDeadline.times, [overDeadline, binnenDeadline, opDeadline], cal, []);
eq('4a finish voorbij deadline ⇒ gemeld, binnen/op de deadline niet', recDeadline.missedDeadlineTaskIds, ['a']);

{
  const band = [{ start: 480, end: 960 }];
  S().newProject();
  const h8 = {
    ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [],
    workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
  };
  S().setCalendar(h8);
  const urentaak = () => {
    const time = createDefaultTaskTime('2026-07-06', 1, 'hours');
    time.durationMinutes = 480;
    return time;
  };
  S().addTask({ name: 'A', time: urentaak(), deadline: '2026-07-06' });
  S().addTask({ name: 'B', time: urentaak(), deadline: '2026-07-06' });
  S().runCPM();
  const naam = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => S().tasks.find((t) => t.id === id)?.name).sort();
  eq('4b na berekenen: A en B eindigen ma 16:00 op de deadline-dag ⇒ niet gemist',
    naam(S().cpmResult?.missedDeadlineTaskIds), []);

  const parsed = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  const times = captureRecordedDates(parsed.tasks, parsed.recordedFields).times;
  const idB = parsed.tasks.find((t) => t.name === 'B')!.id;
  times[idB] = { ...times[idB], start: '2026-07-07T08:00', finish: '2026-07-07T16:00' };
  S().newProject();
  S().applyLoadedProject(
    { ...parsed, recordedFields: undefined, recordedTimes: times, recordedTimesOrigin: 'xer' },
    { filePath: null, recompute: true },
  );
  eq('4c de afwijkende vastlegging van B zet de modus aan', S().datesAsRecorded, true);
  eq('4d in de modus: A (klaar op de deadline-dag 16:00) niet gemist, B (een dag later) wel',
    naam(S().cpmResult?.missedDeadlineTaskIds), ['B']);

  const calH8 = { ...h8, holidays: [{ name: 'vrij', startDate: '2026-07-08', endDate: '2026-07-08' }] };
  const uur = (id: string, finish: string, deadline: string) =>
    mk(id, { durationUnit: 'hours', durationMinutes: 480, earlyStart: finish.slice(0, 10) + 'T08:00', earlyFinish: finish },
      { deadline });
  const puur = [
    uur('opDag', '2026-07-06T16:00', '2026-07-06'),
    uur('metTijd', '2026-07-06T16:00', '2026-07-06T12:00'),
    uur('feestdagOk', '2026-07-07T16:00', '2026-07-08'),
    uur('feestdagTeLaat', '2026-07-09T16:00', '2026-07-08'),
    uur('weekendOk', '2026-07-10T16:00', '2026-07-11'),
  ];
  const puurInfo = captureRecordedDates(puur, Object.fromEntries(puur.map((t) => [t.id, ['earlyStart', 'earlyFinish'] as const])));
  eq('4e deadline zonder tijd, met tijd, op een feestdag en in het weekend: dezelfde grens als de solver',
    cpmResultFromRecorded(puurInfo.times, puur, calH8, []).missedDeadlineTaskIds, ['metTijd', 'feestdagTeLaat']);
}

for (const [label, uur] of [['4f dagtaak', false], ['4g urentaak', true]] as const) {
  const banden = (dagen: number[]) => ({
    byWeekday: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, dagen.includes(d) ? [{ start: 480, end: 960 }] : []])),
  }) as WorkTimeBands;
  S().newProject();
  S().setCalendar({
    ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [],
    workTime: uur ? banden([1, 2, 3, 4, 5]) : undefined,
  });
  S().setProject({ startDate: '2026-07-06' });
  const { id: _projectCalId, ...projectCal } = S().calendar;
  const zaterdagId = S().addCalendar({
    ...projectCal, name: 'Zaterdagwerk', workDays: [1, 2, 3, 4, 5, 6],
    workTime: uur ? banden([1, 2, 3, 4, 5, 6]) : undefined,
  });
  const tijd = (start: string) => createDefaultTaskTime(start, uur ? 8 : 1, uur ? 'hours' : 'days');
  const idA = S().addTask({ name: 'A', time: tijd('2026-07-11'), deadline: '2026-07-12' });
  S().setTaskCalendar(idA, zaterdagId);
  S().addTask({ name: 'B', time: tijd('2026-07-06'), deadline: '2026-07-17' });
  S().runCPM();
  const naam = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => S().tasks.find((t) => t.id === id)?.name).sort();
  const eindeA = () => S().tasks.find((t) => t.name === 'A')?.time.earlyFinish;
  eq(`${label}: na berekenen eindigt A za 11 juli op de zaterdagkalender, niets gemist`,
    [eindeA(), naam(S().cpmResult?.missedDeadlineTaskIds)], ['2026-07-11T16:00', []]);

  const parsed = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  const times = captureRecordedDates(parsed.tasks, parsed.recordedFields).times;
  const idB = parsed.tasks.find((t) => t.name === 'B')!.id;
  times[idB] = uur
    ? { ...times[idB], start: '2026-07-20T08:00', finish: '2026-07-20T16:00' }
    : { ...times[idB], start: '2026-07-20', finish: '2026-07-20' };
  S().newProject();
  S().applyLoadedProject(
    { ...parsed, recordedFields: undefined, recordedTimes: times, recordedTimesOrigin: 'xer' },
    { filePath: null, recompute: true },
  );
  eq(`${label}: in de modus houdt A zijn eigen kalender en datum, alleen B (ma 20 juli) is gemist`,
    [S().datesAsRecorded, S().tasks.find((t) => t.name === 'A')?.calendarId !== undefined, eindeA(),
      naam(S().cpmResult?.missedDeadlineTaskIds)],
    [true, true, '2026-07-11T16:00', ['B']]);
}

const capHour = captureRecordedDates(
  [mk('a', {
    earlyStart: '2026-03-02T08:00', earlyFinish: '2026-03-06T16:00',
    totalFloat: 0, isCritical: true,
  })],
  { a: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'] },
);
const recHour = cpmResultFromRecorded(capHour.times, [mk('a')], cal, []);
eq('5a projectDuration TZ-onafhankelijk (uur-modus, ma t/m vr)', recHour.projectDuration, 5);

const mijlpaalOpEenDag = mk('a', { earlyStart: '2026-03-02', earlyFinish: '2026-03-02' }, { isMilestone: true });
const recMijlpaal = cpmResultFromRecorded(
  captureRecordedDates([mijlpaalOpEenDag], { a: ['earlyStart', 'earlyFinish'] }).times,
  [mijlpaalOpEenDag], cal, [],
);
eq('6a uitsluitend mijlpaal op één dag ⇒ projectDuration 0', recMijlpaal.projectDuration, 0);

const werkOpEenDag = mk('b', { earlyStart: '2026-03-02', earlyFinish: '2026-03-02' });
const recWerk = cpmResultFromRecorded(
  captureRecordedDates([werkOpEenDag], { b: ['earlyStart', 'earlyFinish'] }).times,
  [werkOpEenDag], cal, [],
);
eq('6b echte werk-taak op één dag ⇒ projectDuration 1', recWerk.projectDuration, 1);

const idOfWbs = (wbs: string) => S().tasks.find((t) => t.wbsCode === wbs)!.id;
const earlyStartOf = (id: string) => S().tasks.find((t) => t.id === id)!.time.earlyStart;

{
  const input = buildWriteIFCInput(createAppStoreContext().store.getState(), 'planOnly');
  for (const durationUnit of ['days', 'hours'] as const) {
    const hammock = mk('hammock', {
      scheduleDuration: 5, durationUnit, ...(durationUnit === 'hours' ? { durationMinutes: 2400 } : {}),
      scheduleStart: '2026-03-16T07:00', scheduleFinish: '2026-03-20T16:00',
      earlyStart: '2026-03-16T07:00', earlyFinish: '2026-03-20T16:00',
    }, { isHammock: true });
    const duration = (task: Task) => [task.time.scheduleDuration, task.time.durationUnit, task.time.durationMinutes];
    const want = duration(hammock);
    for (const route of ['orakel', 'snapshot'] as const) {
      const task = { ...hammock, time: { ...hammock.time } };
      const oracle = { [task.id]: { start: task.time.earlyStart, finish: task.time.earlyFinish } };
      const oracleBefore = JSON.stringify(oracle);
      const captured = route === 'orakel' ? captureRecordedDates([task], undefined, oracle) : currentRecordedTimes({ tasks: [task] });
      task.time.scheduleDuration = 0; task.time.durationUnit = 'hours'; task.time.durationMinutes = 0;
      applyRecordedTimesToTasks([task], captured.times, input.calendar, []);
      eq(`356 ${durationUnit}/${route}: onafhankelijke duurkopie`, duration(task), want);
      eq(`356 ${durationUnit}/${route}: bronorakel ongewijzigd`, JSON.stringify(oracle), oracleBefore);
    }
    let text = writeIFC({ ...input, project: { ...input.project, startDate: '2026-03-02' }, tasks: [hammock], recordedSourceFormat: 'ifc' });
    for (let round = 1; round <= 2; round++) {
      const app = createAppStoreContext().store;
      const parsed = readIFC(text);
      eq(`356 ${durationUnit}/${round}: lezer houdt bronduur`, duration(parsed.tasks[0]), want);
      app.getState().applyLoadedProject(parsed, { recompute: true });
      eq(`356 ${durationUnit}/${round}: opgeslagen modus`, app.getState().datesAsRecorded, true);
      eq(`356 ${durationUnit}/${round}: bronduur na verworpen solve`, duration(app.getState().tasks[0]), want);
      eq(`356 ${durationUnit}/${round}: brondatums`, [app.getState().tasks[0].time.earlyStart,
        app.getState().tasks[0].time.earlyFinish], ['2026-03-16T07:00', '2026-03-20T16:00']);
      text = writeIFC(buildWriteIFCInput(app.getState(), 'planOnly'));
      app.getState().runCPM();
      eq(`356 ${durationUnit}/${round}: expliciet Bereken mag duur afleiden`, app.getState().tasks[0].time.scheduleDuration, 0);
      app.getState().undo();
      eq(`356 ${durationUnit}/${round}: undo geeft bronduur terug`, duration(app.getState().tasks[0]), want);
    }
  }
}

{
  const EXTERN = externIfc('');

  const rtExtern = readIFC(EXTERN);
  eq('7a fixture geeft twee taken', rtExtern.tasks.length, 2);
  eq('7b fixture geeft één FS-relatie', rtExtern.sequences.length, 1);
  const aId = rtExtern.tasks.find(t => t.wbsCode === '1.1')!.id;
  const bId = rtExtern.tasks.find(t => t.wbsCode === '1.2')!.id;
  truthy('7c a heeft écht een taaktijd (scheduleStart uit het bestand)', rtExtern.tasks.find(t => t.id === aId)!.time.scheduleStart === '2026-03-02');
  truthy('7d b heeft écht een taaktijd (scheduleStart uit het bestand)', rtExtern.tasks.find(t => t.id === bId)!.time.scheduleStart === '2026-03-16');
  truthy('7e de relatie loopt van a naar b', rtExtern.sequences[0].predecessorId === aId && rtExtern.sequences[0].successorId === bId);
  eq('7f a meldt precies het early- en schedule-paar als aanwezig',
    rtExtern.recordedFields?.[aId], ['earlyStart', 'earlyFinish', 'scheduleStart', 'scheduleFinish']);
  eq('7g b meldt hetzelfde', rtExtern.recordedFields?.[bId], ['earlyStart', 'earlyFinish', 'scheduleStart', 'scheduleFinish']);

  S().newProject();
  S().applyLoadedProject(readIFC(EXTERN), { filePath: null, recompute: true });

  truthy('7h afwijking gedetecteerd: recordedDates is gezet', S().recordedDates !== null);
  eq('7i shifted telt de verschoven taak (b)', S().recordedDates?.shifted, 1);
  eq('7j total telt alle vastgelegde taken (a + b)', S().recordedDates?.total, 2);
  eq('7k detectie zet de modus AAN voor een IFC uit een ander pakket (herkomst "ifc")', S().datesAsRecorded, true);
  eq('7k2 …met die herkomst op de vastlegging', S().recordedDates?.origin, 'ifc');

  S().newProject();
  const ownA = S().addTask({ name: 'Eigen A' });
  const ownB = S().addTask({ name: 'Eigen B' });
  S().addSequence({ predecessorId: ownA, successorId: ownB, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const ownIfc = writeIFC(buildWriteIFCInput(S(), 'planOnly'));

  S().newProject();
  S().applyLoadedProject(readIFC(ownIfc), { filePath: null, recompute: true });
  eq('7l eigen bestand geeft geen aanbod: recordedDates blijft null', S().recordedDates, null);

  const ttArgsScheduleOnly = (o: { scheduleStart: string; scheduleFinish: string; duration: string }) => {
    const a: string[] = new Array(IFC_TASKTIME_SLOTS.length).fill('$');
    a[TASKTIME_SLOT.name] = "'T'";
    a[TASKTIME_SLOT.dataOrigin] = '.PREDICTED.';
    a[TASKTIME_SLOT.durationType] = '.WORKTIME.';
    a[TASKTIME_SLOT.scheduleDuration] = `'${o.duration}'`;
    a[TASKTIME_SLOT.scheduleStart] = `'${o.scheduleStart}'`;
    a[TASKTIME_SLOT.scheduleFinish] = `'${o.scheduleFinish}'`;
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

  const rtScheduleOnly = readIFC(EXTERN_SCHEDULE_ONLY);
  eq('7m fixture geeft twee taken', rtScheduleOnly.tasks.length, 2);
  const aIdS = rtScheduleOnly.tasks.find(t => t.wbsCode === '1.1')!.id;
  const bIdS = rtScheduleOnly.tasks.find(t => t.wbsCode === '1.2')!.id;
  eq('7n a meldt uitsluitend het schedule-paar (geen early-slots)', rtScheduleOnly.recordedFields?.[aIdS], ['scheduleStart', 'scheduleFinish']);
  eq('7o b meldt uitsluitend het schedule-paar', rtScheduleOnly.recordedFields?.[bIdS], ['scheduleStart', 'scheduleFinish']);

  const pureS = captureRecordedDates(rtScheduleOnly.tasks, rtScheduleOnly.recordedFields);
  eq('7p pure laag: de schedule-laag levert nog steeds een vastlegging (tegenproef voor 7q)', [pureS.total, pureS.times[bIdS]?.start], [2, '2026-03-16']);
  S().newProject();
  S().applyLoadedProject(readIFC(EXTERN_SCHEDULE_ONLY), { filePath: null, recompute: true });
  eq('7q vreemd IFC met alleen ScheduleStart/-Finish: geen vastlegging en geen modus', [S().recordedDates, S().datesAsRecorded], [null, false]);
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('7r')), { filePath: null, recompute: true });
  eq('7r vreemd IFC mét early-slots: vastlegging en modus (de #63-route blijft)', [S().recordedDates?.total, S().datesAsRecorded], [2, true]);
}

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
  eq('7z projectEnd komt uit het bestand (orakel), niet uit een herberekening', S().cpmResult?.projectEnd, "2026-03-20T16:00");
  eq('7aa het aanzetten bij het laden pusht GEEN undo-snapshot',
    S().historyEvents.filter(event => event.state === 'applied').length, undoVoorLaad);

  S().undo();
  eq('7ab undo() direct na het laden raakt de modus niet (er is niets om naar terug te gaan)',
    S().datesAsRecorded, true);
  eq('7ac …noch de vastlegging', S().recordedDates?.shifted, 1);

  const asUnknownOrigin: ImportResult = {
    ...rtOracleSource, recordedFields: undefined, recordedTimes: oracleTimes, recordedTimesOrigin: undefined,
  };
  S().newProject();
  S().applyLoadedProject(asUnknownOrigin, { filePath: null, recompute: true });
  eq('7ad zonder recordedTimesOrigin blijft de modus UIT (O6-mutatiebewijs)', S().datesAsRecorded, false);
  eq('7ae …en er is ook geen aanbod (geen bron met echte rekenuitvoer)', S().recordedDates, null);

  const asXerArchive: ImportResult = {
    ...rtOracleSource, recordedFields: undefined, recordedTimes: oracleTimes,
    recordedTimesOrigin: 'xer-archive',
  };
  S().newProject();
  S().applyLoadedProject(asXerArchive, { filePath: null, recompute: true });
  eq('7ag "xer-archive" (heropende IFC met XER-archief, zonder vlag) gaat NIET in de modus, NIET gelijk aan "xer"',
    S().datesAsRecorded, false);
  eq('7ah …en vergeet de opgeslagen datums (geen aanbod)', S().recordedDates, null);

  S().newProject();
  S().applyLoadedProject({ ...asXerArchive, importPristine: true }, { filePath: null, recompute: true });
  eq('7aj2 "xer-archive" + ongewijzigd sinds import ⇒ automatisch AAN (optie B)', S().datesAsRecorded, true);
  eq('7aj3 …en de payload draagt de vlag', S().importPristine, true);

  for (const origin of ['p6xml', 'mspdi', 'mpp', 'ifc'] as const) {
    S().newProject();
    S().applyLoadedProject({ ...asUnknownOrigin, recordedTimesOrigin: origin }, { filePath: null, recompute: true });
    eq(`7aj4 verse import met herkomst "${origin}" ⇒ automatisch AAN`, S().datesAsRecorded, true);
    eq(`7aj5 …en een verse import is per definitie ongewijzigd sinds import (${origin})`, S().importPristine, true);
    eq(`7aj5b …en de vastlegging onthoudt de bron (${origin})`, S().recordedDates?.sourceFormat, origin);
  }
  S().newProject();
  S().applyLoadedProject({ ...asUnknownOrigin, recordedTimesOrigin: 'csv' }, { filePath: null, recompute: true });
  eq('7aj4c CSV: geen vastlegging, geen modus, geen aanbod', [S().recordedDates, S().datesAsRecorded], [null, false]);
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

{
  const parsed = readIFC(externIfc('7C'));
  const input = recoveryInputFromParsed(parsed, { id: 'rec-63', filePath: null, isDirty: true, datesAsRecorded: false });
  S().newProject();
  S().restoreDocuments([input], 'rec-63');
  eq('7aj crashherstel van een gewoon #63-document zet de modus NIET aan', S().datesAsRecorded, false);
  eq('7ak …en vergeet de opgeslagen datums (geen aanbod)', S().recordedDates, null);
}

{
  const input = buildWriteIFCInput(createAppStoreContext().store.getState(), 'planOnly');
  const variants: { label: string; children: Task[] }[] = [
    { label: 'lopend op 100 %', children: [mk('L', { completion: 1, actualStart: '2026-03-02' }, { status: 'STARTED' })] },
    { label: 'voltooid + niet-gestarte mijlpaal', children: [
      mk('V', { completion: 1, actualStart: '2026-03-02', actualFinish: '2026-03-06' }, { status: 'COMPLETED' }),
      mk('M', { scheduleDuration: 0, scheduleStart: '2026-03-09', scheduleFinish: '2026-03-09',
        earlyStart: '2026-03-09', earlyFinish: '2026-03-09' }, { isMilestone: true }),
    ] },
  ];
  const saved = (task: Task) => ({
    status: task.status, completion: task.time.completion,
    actualStart: task.time.actualStart ?? null, actualFinish: task.time.actualFinish ?? null,
    remainingTime: task.time.remainingTime,
    scheduleStart: task.time.scheduleStart, scheduleFinish: task.time.scheduleFinish,
    earlyStart: task.time.earlyStart, earlyFinish: task.time.earlyFinish,
    lateStart: task.time.lateStart, lateFinish: task.time.lateFinish,
    totalFloat: task.time.totalFloat, freeFloat: task.time.freeFloat, isCritical: task.time.isCritical,
  });
  for (const variant of variants) {
    const children = variant.children.map(t => ({ ...t, parentId: 'F' }));
    const source = mk('F', {
      completion: 1, actualStart: '2026-02-26', remainingTime: 3,
      scheduleStart: '2026-03-16', scheduleFinish: '2026-03-27',
      earlyStart: '2026-03-16', earlyFinish: '2026-03-27',
      lateStart: '2026-03-23', lateFinish: '2026-04-03', totalFloat: 5, freeFloat: 2,
    }, { status: 'STARTED', childIds: children.map(t => t.id) });
    let text = writeIFC({ ...input, project: { ...input.project, startDate: '2026-02-23', statusDate: '2026-03-10' },
      tasks: [source, ...children], recordedSourceFormat: 'ifc' });
    for (let n = 1; n <= 2; n++) {
      const planHeaders = parseStep(text).filter(e => e.type === 'IFCWORKPLAN' || e.type === 'IFCWORKSCHEDULE');
      eq(`7D ${variant.label}, ronde ${n}: workplan en schema volgen de getoonde fase`,
        planHeaders.map(e => [e.type, ...[11, 12].map(i => { const v = e.args[i]; return v.k === 'str' ? v.raw : '$'; })]),
        [['IFCWORKPLAN', "'2026-02-26T07:00:00'", "'2026-03-27T07:00:00'"],
          ['IFCWORKSCHEDULE', "'2026-02-26T07:00:00'", "'2026-03-27T07:00:00'"]]);
      const parsed = readIFC(text);
      const payload = prepareLoadedPayload(payloadFromImport(parsed, null), { recompute: false });
      eq(`7D ${variant.label}, ronde ${n}: geen solve bij payloadvoorbereiding`, payload.cpmResult, null);
      applyRestoredRecordedMode(payload, parsed);
      eq(`7D ${variant.label}, ronde ${n}: opgeslagen-datummodus actief`,
        [payload.datesAsRecorded, payload.scheduleStale, payload.recordedDates?.sourceFormat], [true, false, 'ifc']);
      const phase = payload.tasks.find(t => t.id === source.id)!;
      eq(`7D ${variant.label}, ronde ${n}: fase houdt al haar eigen datums en voortgang`, saved(phase), saved(normalizeTaskDates(source, payload)));
      eq(`7D ${variant.label}, ronde ${n}: vastlegging heeft geen verzonnen werkelijk einde`,
        payload.recordedDates?.times[source.id]?.summaryProgress,
        { completion: 1, status: 'STARTED', actualStart: '2026-02-26T07:00' });
      eq(`7D ${variant.label}, ronde ${n}: reconstructie toont het opgeslagen fase-einde`,
        payload.cpmResult?.tasks.get(source.id)?.earlyFinish, '2026-03-27T16:00');
      text = writeIFC(buildWriteIFCInput(payload, 'planOnly'));
    }
  }
}

const offerOnly = (ifcText: string): ImportResult => ({
  ...readIFC(ifcText), timeModel: 'MINUTES-1', recordedTimesOrigin: 'ifc-own', recordedSourceFormat: undefined, importPristine: false,
});
const inMode = (ifcText: string): ImportResult => ({ ...offerOnly(ifcText), recordedSourceFormat: 'ifc', importPristine: true });

{
  S().newProject();
  S().applyLoadedProject(offerOnly(externIfc('2')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');
  eq('8a buiten de modus opgeslagen eigen IFC: geen vastlegging (geen aanbod)', S().recordedDates, null);
  eq('8b buiten de modus opgeslagen eigen IFC: modus uit', S().datesAsRecorded, false);
  eq('8c buiten de modus opgeslagen eigen IFC: b staat op de herberekende datum', S().tasks.find((t) => t.id === bId)!.time.earlyStart, "2026-03-09T07:00");

  S().newProject();
  S().applyLoadedProject(inMode(externIfc('2')), { filePath: null, recompute: true });
  const aId = idOfWbs('1.1');
  const bId2 = idOfWbs('1.2');
  eq('8f onbewerkt eigen IFC: modus staat aan', S().datesAsRecorded, true);
  eq('8g verschoven taak toont de opgeslagen earlyStart', S().tasks.find((t) => t.id === bId2)!.time.earlyStart, "2026-03-16T07:00");
  eq('8h verschoven taak toont de opgeslagen earlyFinish', S().tasks.find((t) => t.id === bId2)!.time.earlyFinish, "2026-03-20T16:00");
  eq('8i scheduleStale is false', S().scheduleStale, false);
  eq('8j isDirty blijft false — openen en bekijken maakt niet vies', S().isDirty, false);
  eq('8l projectEnd komt uit het bestand', S().cpmResult?.projectEnd, "2026-03-20T16:00");
  eq('8m drivingSequenceIds is leeg (niet in IFC)', S().cpmResult?.drivingSequenceIds, []);
  eq('8n shiftedTaskIds noemt precies b', S().recordedDates?.shiftedTaskIds, [bId2]);
  eq('8o shifted telt hetzelfde als shiftedTaskIds', S().recordedDates?.shifted, 1);
  eq('8p recordedTaskWillShift: b ja, a nee',
    [recordedTaskWillShift(S().recordedDates, S().datesAsRecorded, bId2), recordedTaskWillShift(S().recordedDates, S().datesAsRecorded, aId)],
    [true, false]);
  eq('8q recordedTaskWillShift buiten de modus: onbekend',
    recordedTaskWillShift(S().recordedDates, false, bId2), undefined);
}

{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('9a')), { filePath: null, recompute: true });
  const aId = idOfWbs('1.1');
  const bId = idOfWbs('1.2');

  truthy('9A-1 voorwaarde: recordedDates gezet (b verschoof)', S().recordedDates !== null);
  eq('9A-3 voorwaarde: modus staat aan', S().datesAsRecorded, true);
  eq('9A-4 voorwaarde: b toont weer de opgeslagen datum', earlyStartOf(bId), "2026-03-16T07:00");
  eq('9A-5 voorwaarde: planning geldt als vers vóór de bewerking', S().scheduleStale, false);

  const undoVoorA = S().historyEvents.filter(event => event.state === 'applied').length;
  const aTime = S().tasks.find((t) => t.id === aId)!.time;
  S().updateTask(aId, { time: { ...aTime, scheduleDuration: 3 } });

  eq('9A-6 een datum-rakende bewerking verlaat de modus', S().datesAsRecorded, false);
  eq('9A-7 …en wist de vastlegging', S().recordedDates, null);
  eq('9A-8 …en zet de planning op verouderd', S().scheduleStale, true);
  eq('9A-9 …in precies één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorA + 1);

  S().runCPM();
  eq('9A-10 herrekenen ná het verlaten pusht geen extra undo-stap', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorA + 1);
  eq('9A-11 b staat na het herrekenen op de nieuwe logische datum', earlyStartOf(bId), "2026-03-05T07:00");

  S().undo();
  eq('9A-12 undo herstelt de modus', S().datesAsRecorded, true);
  eq('9A-13 undo herstelt de opgeslagen datum van de verschoven taak', earlyStartOf(bId), "2026-03-16T07:00");
  truthy('9A-14 undo herstelt de vastlegging', S().recordedDates !== null);
  eq('9A-15 undo herstelt de teller in de vastlegging', S().recordedDates?.shifted, 1);
  eq('9A-16 undo herstelt de vastgelegde start van b', S().recordedDates?.times[bId]?.start, "2026-03-16T07:00");
  eq('9A-17 undo herstelt het uit het bestand gereconstrueerde projecteinde', S().cpmResult?.projectEnd, "2026-03-20T16:00");
  eq('9A-18 undo herstelt de bewerkte duur van a', S().tasks.find((t) => t.id === aId)!.time.scheduleDuration, 5);

  S().redo();
  eq('9A-19 redo verlaat de modus opnieuw', S().datesAsRecorded, false);
  eq('9A-20 redo wist de vastlegging opnieuw', S().recordedDates, null);
  eq('9A-21 redo herstelt de herberekende datum', earlyStartOf(bId), "2026-03-05T07:00");
}

{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('9b')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');

  eq('9B-1 voorwaarde: modus staat aan', S().datesAsRecorded, true);
  eq('9B-2 voorwaarde: b toont de opgeslagen datum', earlyStartOf(bId), "2026-03-16T07:00");
  eq('9B-3 voorwaarde: isDirty is nog false (betreden maakt niet vies)', S().isDirty, false);

  const undoVoorB = S().historyEvents.filter(event => event.state === 'applied').length;
  S().runCPM();

  eq('9B-4 F5 verlaat de modus', S().datesAsRecorded, false);
  eq('9B-5 …en wist de vastlegging', S().recordedDates, null);
  eq('9B-6 …en rekent door: b staat weer op zijn logische datum', earlyStartOf(bId), "2026-03-09T07:00");
  eq('9B-7 …in precies één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorB + 1);

  S().undo();
  eq('9B-8 undo na F5 herstelt de modus', S().datesAsRecorded, true);
  eq('9B-9 undo na F5 herstelt de opgeslagen datum', earlyStartOf(bId), "2026-03-16T07:00");
  eq('9B-10 undo na F5 herstelt de vastlegging', S().recordedDates?.times[bId]?.start, "2026-03-16T07:00");
  eq('9B-11 undo na F5 herstelt het gereconstrueerde projecteinde', S().cpmResult?.projectEnd, "2026-03-20T16:00");

  S().redo();
  eq('9B-12 redo verlaat de modus opnieuw', S().datesAsRecorded, false);
  eq('9B-13 redo herstelt de herberekende datum', earlyStartOf(bId), "2026-03-09T07:00");
}

{
  S().newProject();
  S().applyLoadedProject(offerOnly(externIfc('9c')), { filePath: null, recompute: true });
  eq('9C-1 voorwaarde: de modus staat UIT (buiten de modus opgeslagen eigen IFC)', S().datesAsRecorded, false);
  useAppStore.setState((s) => { s.scheduleStale = true; });

  const undoVoorC = S().historyEvents.filter(event => event.state === 'applied').length;
  S().runCPM();
  eq('9C-3 runCPM buiten de modus pusht GEEN undo-snapshot', S().historyEvents.filter(event => event.state === 'applied').length, undoVoorC);
  eq('9C-4 buiten de modus is er geen vastlegging (geen aanbod-stand)', S().recordedDates, null);
  eq('9C-5 runCPM buiten de modus zet geen isDirty', S().isDirty, false);
}

{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('9d')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');
  eq('9D-1 voorwaarde: modus staat aan', S().datesAsRecorded, true);

  S().renumberWbs();
  eq('9D-2 een niet-datum-rakende bewerking laat de modus staan', S().datesAsRecorded, true);
  truthy('9D-3 …en laat de vastlegging staan', S().recordedDates !== null);
  eq('9D-4 …en zet de planning niet op verouderd', S().scheduleStale, false);
  eq('9D-5 …en laat de getoonde opgeslagen datum met rust', earlyStartOf(bId), "2026-03-16T07:00");

  S().updateTask(bId, { name: 'Hernoemd', description: 'Omschrijving' });
  eq('9D-6 naam + omschrijving via updateTask: modus blijft, niet verouderd, wel vuil',
    [S().datesAsRecorded, S().recordedDates !== null, S().scheduleStale, S().isDirty, S().tasks.find((t) => t.id === bId)!.name],
    [true, true, false, true, 'Hernoemd']);
  eq('9D-7 …en de getoonde opgeslagen datum blijft', earlyStartOf(bId), "2026-03-16T07:00");
  {
    const huidig = S().tasks.find((t) => t.id === bId)!.taskType;
    S().updateTask(bId, { taskType: huidig === 'LOGISTIC' ? 'MOVE' : 'LOGISTIC', customTaskTypeId: undefined });
    eq('9D-7a taaktype via updateTask: modus blijft, niet verouderd, datum blijft',
      [S().datesAsRecorded, S().scheduleStale, earlyStartOf(bId)], [true,false,"2026-03-16T07:00"]);
    const regel = S().tasks.find((t) => t.id === bId)!.workRule;
    S().updateTask(bId, { workRule: regel === 'FIXED_DURATION_WORK' ? 'FIXED_RATE' : 'FIXED_DURATION_WORK' });
    eq('9D-7b werkregel via updateTask: modus blijft, niet verouderd, datum blijft',
      [S().datesAsRecorded, S().scheduleStale, earlyStartOf(bId), S().tasks.find((t) => t.id === bId)!.workRule !== regel],
      [true,false,"2026-03-16T07:00",true]);
  }
  S().updateTask(bId, { name: 'Nog eens', priority: S().tasks.find((t) => t.id === bId)!.priority + 1 });
  eq('9D-8 naam + prioriteit: modus uit, vastlegging weg, verouderd', [S().datesAsRecorded, S().recordedDates, S().scheduleStale], [false, null, true]);
  S().runCPM();
  S().updateTask(bId, { name: 'Buiten de modus' });
  eq('9D-9 buiten de modus: naamwijziging zet de planning (ongewijzigd) op verouderd', S().scheduleStale, true);
}

{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('10a')), { filePath: null, recompute: true });
  const slapendId = S().activeDocumentId;
  const bId = idOfWbs('1.2');
  eq('10A-1 voorwaarde: modus staat aan in het straks-slapende document', S().datesAsRecorded, true);

  S().newDocument();
  const payloadVan = () => S().documents.find((d) => d.id === slapendId)?.payload ?? null;
  eq('10A-2 voorwaarde: de slapende payload draagt de modus mee', payloadVan()?.datesAsRecorded, true);
  eq('10A-3 voorwaarde: de slapende payload toont de opgeslagen datum',
    payloadVan()?.tasks.find((t) => t.id === bId)?.time.earlyStart, "2026-03-16T07:00");
  eq('10A-4 voorwaarde: de slapende payload staat op NIET-verouderd', payloadVan()?.scheduleStale, false);

  useAppStore.setState((s) => {
    const entry = s.documents.find((d) => d.id === slapendId);
    if (entry?.payload) entry.payload.scheduleStale = true;
  });

  const herrekend = S().recalculateStaleSleepingDocuments();
  eq('10A-5 voorwaarde: er is écht één slapend document doorgerekend', herrekend, 1);
  eq('10A-6 doorrekenen verlaat de modus op de slapende payload', payloadVan()?.datesAsRecorded, false);
  eq('10A-7 …en wist daar de vastlegging', payloadVan()?.recordedDates, null);
  eq('10A-8 …en de payload toont nu de herberekende datum',
    payloadVan()?.tasks.find((t) => t.id === bId)?.time.earlyStart, "2026-03-09T07:00");
}

{
  const buiten = { scheduleStale: false, datesAsRecorded: false };
  markScheduleStale(buiten);
  eq('10B-1 buiten de modus zet de vlag gewoon', buiten.scheduleStale, true);

  const binnen = { scheduleStale: false, datesAsRecorded: true };
  markScheduleStale(binnen);
  eq('10B-2 binnen de modus blijft de vlag uit', binnen.scheduleStale, false);
  eq('10B-3 …en blijft de modus zelf onaangeroerd (géén verlaten zonder snapshot)', binnen.datesAsRecorded, true);
}

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
  eq('10C-7 …en laat de opgeslagen datum staan', earlyStartOf(bId), "2026-03-16T07:00");
}

{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('10d')), { filePath: null, recompute: true });
  const bId = idOfWbs('1.2');
  const startVoor = S().project.startDate;
  eq('10D-1 voorwaarde: modus staat aan', S().datesAsRecorded, true);
  eq('10D-2 voorwaarde: b toont de opgeslagen datum', earlyStartOf(bId), "2026-03-16T07:00");

  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  const res = S().moveProject('2027-01-04');
  truthy('10D-3 voorwaarde: de verschuiving is écht uitgevoerd', res.moved);

  eq('10D-4 moveProject verlaat de modus', S().datesAsRecorded, false);
  eq('10D-5 …en wist de vastlegging', S().recordedDates, null);
  eq('10D-6 …in precies ÉÉN undo-stap (niet twee)', S().historyEvents.filter(event => event.state === 'applied').length, undoVoor + 1);

  S().undo();
  eq('10D-7 één undo herstelt de modus', S().datesAsRecorded, true);
  eq('10D-8 …de opgeslagen datum', earlyStartOf(bId), "2026-03-16T07:00");
  eq('10D-9 …het gereconstrueerde projecteinde', S().cpmResult?.projectEnd, "2026-03-20T16:00");
  eq('10D-10 …én de projectstartdatum — geen halve tussentoestand', S().project.startDate, startVoor);
}

{
  const obs = (o: Partial<RecordedDatesObservation> = {}): RecordedDatesObservation =>
    ({ documentId: 'doc-1', inMode: false, scheduleStale: false, history: [], ...o });

  truthy('10E-1 modus verlaten binnen hetzelfde document ⇒ inplannen',
    leftRecordedDatesMode(obs({ inMode: true }), obs({ inMode: false })));
  truthy('10E-2 modus staat nog aan ⇒ niets in te plannen',
    !leftRecordedDatesMode(obs({ inMode: true }), obs({ inMode: true })));
  truthy('10E-3 modus stond al uit ⇒ niets in te plannen',
    !leftRecordedDatesMode(obs({ inMode: false }), obs({ inMode: false })));
  truthy('10E-4 documentwissel telt niet als verlaten',
    !leftRecordedDatesMode(obs({ inMode: true }), obs({ documentId: 'doc-2', inMode: false })));

  truthy('10E-5 bij uitvoeren: verouderd en modus uit ⇒ rekenen',
    needsExitRecompute('doc-1', obs({ scheduleStale: true })));
  truthy('10E-6 bij uitvoeren: niet meer verouderd ⇒ niet rekenen',
    !needsExitRecompute('doc-1', obs({ scheduleStale: false })));
  truthy('10E-7 bij uitvoeren: modus opnieuw aan (undo) ⇒ niet rekenen',
    !needsExitRecompute('doc-1', obs({ inMode: true, scheduleStale: true })));
  truthy('10E-8 bij uitvoeren: intussen van document gewisseld ⇒ niet rekenen',
    !needsExitRecompute('doc-1', obs({ documentId: 'doc-2', scheduleStale: true })));

  const applied = [{ id: 'e1', state: 'applied' as const }, { id: 'e2', state: 'applied' as const }];
  const afterUndo = [applied[0], { id: 'e2', state: 'undone' as const }];
  truthy('10E-9 undo verlaat de modus ⇒ niet inplannen',
    !leftRecordedDatesMode(obs({ inMode: true, history: applied }), obs({ inMode: false, history: afterUndo })));
  truthy('10E-10 redo verlaat de modus ⇒ niet inplannen',
    !leftRecordedDatesMode(obs({ inMode: true, history: afterUndo }), obs({ inMode: false, history: applied })));
  truthy('10E-11 bewerking met een nieuw event verlaat de modus ⇒ wel inplannen',
    leftRecordedDatesMode(obs({ inMode: true, history: applied }),
      obs({ inMode: false, history: [...applied, { id: 'e3', state: 'applied' }] })));
  truthy('10E-12 bewerking die een undone event opruimt ⇒ wel inplannen',
    leftRecordedDatesMode(obs({ inMode: true, history: afterUndo }),
      obs({ inMode: false, history: [applied[0], { id: 'e3', state: 'applied' }] })));
  truthy('10E-13 modus verlaten zonder historiewijziging ⇒ wel inplannen',
    leftRecordedDatesMode(obs({ inMode: true, history: applied }), obs({ inMode: false, history: applied })));
  truthy('10E-14 restoredFromHistory: dezelfde array is geen herstel',
    !restoredFromHistory(applied, applied));
}

{
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
    S().tasks.find((t) => t.id === t1)!.externalLinks![0].anchorDate, '2026-05-08T16:00');
  eq('12e de link van bron B draagt het verse anker — het ketenen verliest de eerste bron niet',
    S().tasks.find((t) => t.id === t2)!.externalLinks![0].anchorDate, '2026-06-05T16:00');
  eq('12e2 gelijke project-id laat iedere bron exact zijn eigen pad verversen', res.refreshed, 2);

  S().undo();
  eq('12f één undo herstelt het anker van bron A',
    S().tasks.find((t) => t.id === t1)!.externalLinks![0].anchorDate, "2020-01-01T16:00");
  eq('12g één undo herstelt het anker van bron B',
    S().tasks.find((t) => t.id === t2)!.externalLinks![0].anchorDate, "2020-01-01T16:00");
}

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
    S().tasks.find(task => task.id === taskB)!.externalLinks![0].anchorDate, "2026-02-01T16:00");
  const sleepingA = S().documents.find(document => document.id === documentA)?.payload;
  eq('13c het slapende document A wordt niet buiten zijn historygrens overschreven',
    sleepingA?.tasks.find(task => task.id === taskA)!.externalLinks![0].anchorDate, "2026-01-01T16:00");
  eq('13d de gebruiker blijft in document B', S().activeDocumentId, documentB);
}

{
  S().newProject();
  S().applyLoadedProject(inMode(externIfc('csv')), { filePath: null, recompute: true });
  truthy('13Ba voorwaarde: de modus staat aan', S().datesAsRecorded);

  const kolommen = (csv: string) => {
    const [kop, ...regels] = csv.trim().replace(/^﻿/, '').split('\r\n');
    const delimiter = kop.includes(';') ? ';' : ',';
    const index = new Map(kop.split(delimiter).map((h, i) => [h, i] as const));
    const kol = (naam: string): number => {
      const i = index.get(naam);
      if (i === undefined) throw new Error(`13B: CSV-kolom '${naam}' ontbreekt in de kopregel`);
      return i;
    };
    return regels.map(regel => regel.split(delimiter)).map(rij => ({
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
    rijenInModus.map(rij => rij.start), ["2026-03-02T07:00","2026-03-16T07:00"]);

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
    const noemtPrimavera = (v: unknown) => typeof v === 'string' && /Primaver|Примавер/i.test(v);

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
        if (neutraal === undefined && optioneel(taal)) { } else if (typeof neutraal !== 'string' || neutraal.length === 0) badgeZonderNeutraal.push(`${taal}:${stam}`);
        else if (noemtPrimavera(neutraal)) badgeNeutraalNoemtPrimavera.push(`${taal}:${stam}`);
        if (!(primavera === undefined && optioneel(taal)) && !noemtPrimavera(primavera)) badgePrimaveraNoemtHetNiet.push(`${taal}:${stam}`);
      }
    }
    eq('14l elke taal heeft de neutrale bloktekst', badgeZonderNeutraal, []);
    eq('14m de NEUTRALE bloktekst noemt Primavera in geen enkele taal', badgeNeutraalNoemtPrimavera, []);
    eq('14n de Primavera-bloktekst noemt Primavera juist WEL in elke taal', badgePrimaveraNoemtHetNiet, []);
  }
}

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
  const cpm = applyRecordedTimesToTasks(tasks, times, createDefaultCalendar(), []);
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
      applyRecordedTimesToTasks([alone, c], {}, createDefaultCalendar(), []);
      return [alone.time.earlyStart, alone.time.earlyFinish];
    })(), ['2026-09-01', '2026-09-05']);
  eq('15f de opgerolde samenvatting zit in cpmResult.tasks met dezelfde waarden als task.time',
    cpm.tasks.get('S'), {
      earlyStart: s.earlyStart, earlyFinish: s.earlyFinish, lateStart: s.lateStart, lateFinish: s.lateFinish,
      totalFloat: s.totalFloat, freeFloat: s.freeFloat, isCritical: s.isCritical,
    });
  {
    const recordedSummary: Task = { ...summary, id: 'R', childIds: ['RA', 'RB'], time: { ...summary.time } } as Task;
    const rTasks: Task[] = [recordedSummary, leaf('RA', 'R', '2026-09-01', '2026-09-05'), leaf('RB', 'R', '2026-09-08', '2026-09-12')];
    const rTimes: Record<string, RecordedTime> = {
      R: { start: '2026-02-01', finish: '2026-04-30', lateStart: '2026-02-04', lateFinish: '2026-05-05', totalFloat: 3, freeFloat: 3, isCritical: false },
      RA: { start: '2026-03-02', finish: '2026-03-06', lateStart: '2026-03-09', lateFinish: '2026-03-13', totalFloat: 5, freeFloat: 0, isCritical: false },
      RB: { start: '2026-03-09', finish: '2026-03-13', lateStart: '2026-03-09', lateFinish: '2026-03-13', totalFloat: 0, freeFloat: 0, isCritical: true },
    };
    const rCpm = applyRecordedTimesToTasks(rTasks, rTimes, createDefaultCalendar(), []);
    const r = rTasks[0].time;
    eq('15g een samenvatting mét eigen vastlegging blijft staan zoals het bestand haar gaf (geen rollup eroverheen)',
      [r.earlyStart, r.earlyFinish, r.lateStart, r.lateFinish, r.totalFloat, r.freeFloat, r.isCritical],
      ['2026-02-01', '2026-04-30', '2026-02-04', '2026-05-05', 3, 3, false]);
    eq('15h ... en task.time en cpmResult zeggen daar hetzelfde, projectEnd incluis',
      [rCpm.tasks.get('R')?.earlyFinish, rCpm.projectEnd], ['2026-04-30', '2026-04-30']);
  }
}

{
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16')), { filePath: null, recompute: true });
  eq('16a verse import uit een ander pakket: vlag aan én modus aan', [S().importPristine, S().datesAsRecorded], [true, true]);

  const savedInMode = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  truthy('16b opslaan ín de modus schrijft OPS_ImportProvenance', savedInMode.includes("'OPS_ImportProvenance'"));
  const reopened = readIFC(savedInMode);
  eq('16c het heropende eigen IFC is een heropening mét vlag', [reopened.recordedTimesOrigin, reopened.importPristine], ['ifc-own', true]);
  S().newProject();
  S().applyLoadedProject(reopened, { filePath: null, recompute: true });
  eq('16d heropenen van het ongewijzigde eigen IFC gaat automatisch de modus in (optie B)', [S().datesAsRecorded, S().recordedDates?.origin], [true, 'ifc-own']);
  eq('16e …met dezelfde verschuivingsteller als de verse import', S().recordedDates?.shifted, 1);

  S().runCPM();
  eq('16f F5 verlaat de modus zonder de vlag te wissen', [S().datesAsRecorded, S().importPristine], [false, true]);
  const savedOutside = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  truthy('16g ook ná F5 draagt het opgeslagen bestand de vlag', savedOutside.includes("'OPS_ImportProvenance'"));
  S().newProject();
  S().applyLoadedProject(readIFC(savedOutside), { filePath: null, recompute: true });
  eq('16h heropenen na F5+opslaan: het bestand draagt de herberekening zelf ⇒ niets te melden', [S().datesAsRecorded, S().recordedDates], [false, null]);

  S().updateTask(S().tasks[0]!.id, { name: 'Bewerkt' });
  eq('16i een bewerking (modus stond al uit, 16h) wist de vlag en maakt vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [false, false, true]);
  const savedEdited = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  truthy('16j het bewerkte bestand draagt geen OPS_ImportProvenance meer', !savedEdited.includes("'OPS_ImportProvenance'"));
  S().newProject();
  S().applyLoadedProject(readIFC(savedEdited), { filePath: null, recompute: true });
  eq('16k heropenen van het bewerkte eigen IFC: vlag uit, en (zonder apart bronkanaal) geen verschil met het bestand', [S().datesAsRecorded, S().recordedDates, S().importPristine], [false, null, false]);
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16u')), { filePath: null, recompute: true });
  S().updateTask(S().tasks[0]!.id, { name: 'Bewerkt' });
  S().undo();
  eq('16l undo herstelt de vlag NIET (nooit een gok richting automatisch aan)', S().importPristine, false);

  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16o')), { filePath: null, recompute: true });
  eq('16o geladen: modus aan, vlag aan, niet vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [true, true, false]);
  S().runCPM();
  eq('16p F5: modus uit, vlag aan, niet vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [false, true, false]);
  S().undo();
  eq('16q Ctrl+Z na F5: modus weer aan, vlag AAN, wel vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [true, true, true]);
  S().redo();
  eq('16r Ctrl+Y: modus weer uit, vlag nog steeds aan, vuil', [S().datesAsRecorded, S().importPristine, S().isDirty], [false, true, true]);
  {
    const src = readIFC(externIfc('16s'));
    const archiefTijden = captureRecordedDates(src.tasks, src.recordedFields).times;
    const na_f5: ImportResult = {
      ...src, timeModel: 'MINUTES-1', recordedFields: undefined, recordedTimes: archiefTijden,
      recordedTimesOrigin: 'xer-archive', importPristine: true,
    };
    S().newProject();
    S().restoreDocuments([recoveryInputFromParsed(na_f5, { id: 'rec-16s', filePath: null, isDirty: false, datesAsRecorded: false })], 'rec-16s');
  }
  eq('16s herstel buiten de modus: geen modus, geen vastlegging, vlag aan, niet vuil', [S().datesAsRecorded, S().recordedDates, S().importPristine, S().isDirty], [false, null, true, false]);
  S().updateTask(S().tasks[0]!.id, { name: 'Bewerkt' });
  S().undo();
  eq('16u bewerking + undo: vlag blijft uit, document blijft vuil', [S().importPristine, S().isDirty], [false, true]);
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('16w')), { filePath: null, recompute: true });
  S().runCPM();
  S().markAutoSaveVersionSaved(documentContentOf(S(), S().activeDocumentId)!, S());
  eq('16w0 na F5 en opslaan: niet vuil, vlag aan, modus uit', [S().isDirty, S().importPristine, S().datesAsRecorded], [false, true, false]);
  S().undo();
  eq('16w Ctrl+Z na opslaan: vuil, vlag aan, modus aan', [S().isDirty, S().importPristine, S().datesAsRecorded], [true, true, true]);

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

  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find((p) => existsSync(p)) ?? null;
  truthy('16m de broncontrole vindt src/', srcRoot !== null);
  if (srcRoot) {
    const UITZONDERINGEN: { file: string; fragment: string; reden: string }[] = [
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
      { file: 'state/slices/librarySlice.ts', fragment: '...castDraft(r.before), isDirty: true, resourceLoadResult: null',
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

{
  const ctx = createAppStoreContext({ emitHostEvents: false });
  const state = () => ctx.store.getState();
  state().applyOpenedImport(readIFC(externIfc('17')), { filePath: '/projecten/bestaand-17.ifc', recompute: true });
  const historyCount = state().historyEvents.length;
  state().setProject({ description: 'Bestaande bewerking behouden bij een geweigerde CSV' });
  const before = state();
  const documentsBefore = J(before.getOpenDocumentPayloads());
  eq('17a tegenproef: bestaand IFC met twee taken en echte vastlegging in de modus', {
    tasks: before.tasks.map(t => [t.name, t.time.earlyStart, t.time.earlyFinish]),
    datesAsRecorded: before.datesAsRecorded,
    recordedCount: Object.keys(before.recordedDates?.times ?? {}).length,
  }, {
    tasks: [['A', '2026-03-02T07:00', '2026-03-06T16:00'], ['B', '2026-03-16T07:00', '2026-03-20T16:00']],
    datesAsRecorded: true, recordedCount: 2,
  });
  eq('17b tegenproef: eigen bewerking, historie en bestaand opslagdoel',
    [before.isDirty, before.historyEvents.length - historyCount, before.importPristine, before.filePath],
    [true, 1, false, '/projecten/bestaand-17.ifc']);

  let applyReached = false;
  let error: CsvDateImportError | undefined;
  try {
    const parsed = readCSV(CSV_FIXTURE_UNREADABLE_DATES);
    applyReached = true;
    state().applyOpenedImport(parsed, { filePath: null, recompute: true });
  } catch (e) {
    if (!(e instanceof CsvDateImportError)) throw e;
    error = e;
  }
  truthy('17c onleesbare CSV geeft de specifieke datumvalidatiefout', error instanceof CsvDateImportError);
  eq('17d de fout noemt onafhankelijk verwachte naam, melding en oorspronkelijke celcontext', error ? {
    name: error.name, message: error.message, row: error.row, column: error.column, value: error.value,
  } : null, {
    name: 'CsvDateImportError',
    message: 'CSV record 2, column "Start": unrecognised date "Mon 3/2/26". Use YYYY-MM-DD, DD-MM-YYYY or DD/MM/YYYY.',
    row: 2, column: 'Start', value: 'Mon 3/2/26',
  });
  eq('17e mislukte parse bereikt applyOpenedImport niet', applyReached, false);
  truthy('17f geen activatie of andere storemutatie', state() === before);
  eq('17g alle bestaande documenten en taakgegevens behouden', J(state().getOpenDocumentPayloads()), documentsBefore);
  eq('17h bestaande datummodus en vastlegging behouden, geen verzonnen CSV-vastlegging',
    [state().datesAsRecorded, state().recordedDates, state().importPristine],
    [before.datesAsRecorded, before.recordedDates, before.importPristine]);
  eq('17i historie, dirty-status en opslagdoel behouden',
    [state().historyEvents, state().nextHistorySequence, state().isDirty, state().filePath, state().fileHandle, state().siteFileId, state().siteFileVersion],
    [before.historyEvents, before.nextHistorySequence, before.isDirty, before.filePath, before.fileHandle, before.siteFileId, before.siteFileVersion]);
}

{
  const importMeldingen = () => S().ui.notifications.filter((n) =>
    (n.messageKey === 'notifications.importDatesAsRecorded'
      || n.detailLines?.some(line => line.messageKey === 'notifications.importDatesAsRecorded'))).reduce((total, n) => total + (n.count ?? 1), 0);
  S().newProject();
  useAppStore.setState(s => { s.ui.notifications = []; });
  const voorImport = importMeldingen();
  S().applyOpenedImport(readIFC(externIfc('18')), { filePath: null, recompute: true });
  eq('18a tegenproef: een verse import in de modus geeft wél de openingsmelding', importMeldingen() - voorImport, 1);
  S().setProject({ description: 'bewerkt, zonder datumwijziging' });
  eq('18b de bewerking wist de vlag maar laat de modus staan', [S().datesAsRecorded, S().importPristine], [true, false]);
  const eigen = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  eq('18c het opgeslagen bestand is een eigen IFC zonder vlag', [eigen.recordedTimesOrigin, eigen.importPristine], ['ifc-own', false]);
  S().newProject();
  const voorHeropen = importMeldingen();
  S().applyOpenedImport(eigen, { filePath: null, recompute: true });
  eq('18d heropenen: in de modus opgeslagen ⇒ weer in de modus, met vastlegging', [S().recordedDates !== null, S().datesAsRecorded], [true, true]);
  eq('18e …en GEEN openingsmelding', importMeldingen() - voorHeropen, 0);
}

{
  type Speling = { tf: number; tfMin?: number; ff: number; ffMin?: number };
  const bron = (tag: string, speling: Record<string, Speling>): string => {
    const p = payloadFromImport(readIFC(externIfc(tag)), null);
    p.minuteModelPending = false;
    p.datesAsRecorded = true;
    for (const t of p.tasks) {
      const s = speling[t.name];
      t.time.totalFloat = s.tf;
      t.time.totalFloatMinutes = s.tfMin;
      t.time.freeFloat = s.ff;
      t.time.freeFloatMinutes = s.ffMin;
    }
    p.recordedDates = {
      times: Object.fromEntries(p.tasks.map((t) => [t.id, {
        start: t.time.earlyStart, finish: t.time.earlyFinish, lateStart: t.time.lateStart, lateFinish: t.time.lateFinish,
        totalFloat: t.time.totalFloat, freeFloat: t.time.freeFloat, isCritical: false,
      }])),
      total: p.tasks.length, origin: 'ifc-own', sourceFormat: 'ifc',
    };
    return writeIFC(buildWriteIFCInput(p, 'planOnly'));
  };
  const spelingVan = (tasks: readonly Task[]) => Object.fromEntries(tasks.map((t) =>
    [t.name, [t.time.totalFloat, t.time.totalFloatMinutes ?? null, t.time.freeFloat, t.time.freeFloatMinutes ?? null]]));
  const resultaatVan = (s: ReturnType<typeof createAppStoreContext>['store']) => Object.fromEntries(s.getState().tasks.map((t) => {
    const r = s.getState().cpmResult?.tasks.get(t.id);
    return [t.name, [r?.totalFloatMinutes ?? null, r?.freeFloatMinutes ?? null]];
  }));
  const openen = (tekst: string) => {
    const s = createAppStoreContext().store;
    s.getState().applyLoadedProject(readIFC(tekst), { filePath: null, recompute: true });
    return s;
  };

  const metMinuten = bron('19a', { A: { tf: 2.5, tfMin: 1200, ff: 0.75, ffMin: 360 }, B: { tf: 2.5, tfMin: 1200, ff: 0.75, ffMin: 360 } });
  eq('19a opzet: de kale lezer leest de minuten', spelingVan(readIFC(metMinuten).tasks),
    { A: [2.5, 1200, 0.75, 360], B: [2.5, 1200, 0.75, 360] });
  const a = openen(metMinuten);
  eq('19b opzet: het bestand opent in de modus', a.getState().datesAsRecorded, true);
  eq('19c in de modus: dagen én minuten uit het bestand', spelingVan(a.getState().tasks),
    { A: [2.5, 1200, 0.75, 360], B: [2.5, 1200, 0.75, 360] });
  eq('19d de reconstructie (cpmResult) draagt dezelfde minuten', resultaatVan(a), { A: [1200, 360], B: [1200, 360] });
  const opnieuw = writeIFC(buildWriteIFCInput(a.getState(), 'planOnly'));
  truthy('19e opnieuw opslaan schrijft de exacte speling', opnieuw.includes('"TotalFloat":[2.5,1200]') && opnieuw.includes('"FreeFloat":[0.75,360]'));
  truthy('19f …en nooit de minuten van de verworpen solve', !/"(?:Total|Free)Float":\[[\d.]+,0\]/.test(opnieuw));
  eq('19g opnieuw lezen: dezelfde speling', spelingVan(readIFC(opnieuw).tasks), { A: [2.5, 1200, 0.75, 360], B: [2.5, 1200, 0.75, 360] });
  eq('19h opnieuw openen via de laadroute: dezelfde speling', spelingVan(openen(opnieuw).getState().tasks),
    { A: [2.5, 1200, 0.75, 360], B: [2.5, 1200, 0.75, 360] });

  const zonderMinuten = bron('19z', { A: { tf: 2.5, ff: 0.75 }, B: { tf: 3, ff: 1 } });
  eq('19i opzet: de kale lezer leest geen minuten', spelingVan(readIFC(zonderMinuten).tasks),
    { A: [2.5, null, 0.75, null], B: [3, null, 1, null] });
  const z = openen(zonderMinuten);
  eq('19j opzet: ook dit bestand opent in de modus', z.getState().datesAsRecorded, true);
  eq('19k in de modus: de dagen uit het bestand, de minuten van de solve gewist', spelingVan(z.getState().tasks),
    { A: [2.5, null, 0.75, null], B: [3, null, 1, null] });
  eq('19l de reconstructie verzint geen minuten', resultaatVan(z), { A: [null, null], B: [null, null] });
  const zOpnieuw = writeIFC(buildWriteIFCInput(z.getState(), 'planOnly'));
  truthy('19m opnieuw opslaan: de breuk zonder minuten, geen 0', zOpnieuw.includes('"TotalFloat":[2.5,null]') && zOpnieuw.includes('"FreeFloat":[0.75,null]'));
  eq('19n opnieuw lezen: dezelfde speling, zonder minuten', spelingVan(readIFC(zOpnieuw).tasks),
    { A: [2.5, null, 0.75, null], B: [3, null, 1, null] });

  const getoond = currentRecordedTimes({ tasks: [mk('a', { totalFloat: 0.25, totalFloatMinutes: 120, freeFloat: 0, freeFloatMinutes: 0 }), mk('b')] });
  eq('19o getoonde vastlegging: minuten mee, en weg waar de taak er geen heeft',
    [getoond.times.a.totalFloatMinutes, getoond.times.a.freeFloatMinutes, 'totalFloatMinutes' in getoond.times.b], [120, 0, false]);
}

if (diffs.length === 0) {
  console.log(`OK  recorded-dates: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recorded-dates: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
