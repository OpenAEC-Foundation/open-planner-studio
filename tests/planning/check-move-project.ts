// "Project verplaatsen"-checks (pakket D1) — headless tegen de ECHTE Zustand-store en de PURE
// engine-helpers (`src/engine/moveProject.ts`), zelfde patroon als `check-move-assignment.ts`.
//
// WAAROM NAAST `cases-move-project.json`: de JSON-batterij bewijst de PLANNINGSUITKOMST (es/ef/
// projectEnd) via de solver. Een flink deel van de veld-inventarisatie is daar echter onzichtbaar —
// `Resource.availabilitySteps[].from`, `externalLinks[].sourceMissing`, de bewust NIET-geschoven
// `customFields` van type 'date', de kalender-feestdagen, de vormbehoudende `shiftIso` en de
// preview-zuiverheid (droogrun mag NIETS muteren). Die worden hier veld-voor-veld nagelopen.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import {
  shiftIso, computeMoveDelta, computeMoveImpact, computeHolidayGaps,
  shiftTask, shiftResource, shiftBaseline, shiftProjectDates,
} from '@/engine/moveProject';
import type { Task } from '@/types/task';
import type { Resource } from '@/types/resource';
import type { Baseline } from '@/types/baseline';
import type { WorkCalendar } from '@/types/calendar';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 1) shiftIso — VORMBEHOUD (paragraaf 2 van het ontwerp)
// ═══════════════════════════════════════════════════════════════════════════
eq('01 date-only blijft date-only', shiftIso('2026-06-01', 7), '2026-06-08');
eq('02 datetime blijft datetime, tijdstip exact behouden', shiftIso('2026-06-01T13:45', 7), '2026-06-08T13:45');
eq('03 middernacht behoudt zijn tijd-component', shiftIso('2026-06-01T00:00', 1), '2026-06-02T00:00');
// R10/paragraaf 2: er wordt NIET naar het eerstvolgende werkmoment gesnapt — dat is solver-werk.
// Zaterdag 09:30 + 7 dagen blijft zaterdag 09:30; een snap zou er maandag 08:00 van maken.
eq('04 GEEN snap naar werkmoment: zaterdag blijft zaterdag', shiftIso('2026-07-04T09:30', 7), '2026-07-11T09:30');
eq('05 GEEN snap: zondag (date-only) blijft zondag', shiftIso('2026-06-07', 7), '2026-06-14');
eq('06 negatieve delta (R1)', shiftIso('2026-06-08', -7), '2026-06-01');
eq('07 maandgrens', shiftIso('2026-06-30', 1), '2026-07-01');
eq('08 jaargrens (R2)', shiftIso('2026-12-31T16:00', 1), '2027-01-01T16:00');
eq('09 lege string blijft leeg', shiftIso('', 7), '');
eq('10 undefined blijft undefined', shiftIso(undefined, 7), undefined);
eq('11 onparseerbaar (corrupte import) blijft ongemoeid', shiftIso('niet-een-datum', 7), 'niet-een-datum');
eq('12 delta 0 is een exacte no-op', shiftIso('2026-06-01T13:45', 0), '2026-06-01T13:45');

// computeMoveDelta — R9-guards
eq('13 delta over een schrikkelvrije maandgrens', computeMoveDelta('2026-06-01', '2026-07-01'), 30);
eq('14 negatieve delta', computeMoveDelta('2026-06-08', '2026-06-01'), -7);
eq('15 gelijke datums => 0 (R8)', computeMoveDelta('2026-06-01', '2026-06-01'), 0);
eq('16 lege huidige startdatum => NaN (R9)', Number.isNaN(computeMoveDelta('', '2026-06-01')), true);
eq('17 onparseerbare nieuwe datum => NaN (R9)', Number.isNaN(computeMoveDelta('2026-06-01', 'x')), true);
// De projectstartdatum MAG een datetime zijn; delta blijft een geheel aantal kalenderdagen.
eq('18 datetime-startdatum kapt naar hele dagen', computeMoveDelta('2026-06-01T23:00', '2026-06-08'), 7);

// ═══════════════════════════════════════════════════════════════════════════
// 2) Pure shift-functies — élke MEE-cel uit de veld-inventarisatie
// ═══════════════════════════════════════════════════════════════════════════
const baseTask: Task = {
  id: 't1', name: 'A', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: {
    ...createDefaultTaskTime('2026-06-01', 5),
    actualStart: '2026-06-01', actualFinish: '2026-06-03',
    actualDuration: 3, remainingTime: 2, remainingMinutes: 960, completion: 0.6,
    earlyStart: '2026-06-01', earlyFinish: '2026-06-05',
    lateStart: '2026-06-01', lateFinish: '2026-06-05',
  },
  constraint: { type: 'SNET', date: '2026-06-04' },
  constraint2: { type: 'FNLT', date: '2026-06-20' },
  deadline: '2026-06-25',
  externalLinks: [{
    id: 'x1', direction: 'predecessor', relType: 'FS', lagDays: 2,
    anchorDate: '2026-05-29',
    sourceRef: { projectId: 'p2', taskId: 't9', filePath: '/elders.ifc' },
    sourceMissing: false,
  }],
  customFields: { 'cf-date': '2026-06-01', 'cf-text': 'blijft' },
  levelingDelay: 3,
};
const st = shiftTask(baseTask, 7);

// MEE
eq('20 time.scheduleStart schuift (HET anker)', st.time.scheduleStart, '2026-06-08');
eq('21 time.scheduleFinish schuift', st.time.scheduleFinish, shiftIso(baseTask.time.scheduleFinish, 7));
eq('22 time.actualStart schuift (R5)', st.time.actualStart, '2026-06-08');
eq('23 time.actualFinish schuift (R5)', st.time.actualFinish, '2026-06-10');
eq('24 constraint.date schuift', st.constraint?.date, '2026-06-11');
eq('25 constraint2.date schuift (fase 2.9 — het makkelijkst te vergeten veld)', st.constraint2?.date, '2026-06-27');
eq('26 deadline schuift', st.deadline, '2026-07-02');
eq('27 externalLinks[].anchorDate schuift (R6)', st.externalLinks?.[0].anchorDate, '2026-06-05');

// NIET / AFGELEID
eq('28 constraint.type blijft', st.constraint?.type, 'SNET');
eq('29 externalLinks[].sourceMissing BLIJFT false (R6: betekent "bron onvindbaar", niet "anker verouderd")', st.externalLinks?.[0].sourceMissing, false);
eq('30 externalLinks[].lagDays blijft (duur)', st.externalLinks?.[0].lagDays, 2);
eq('31 externalLinks[].sourceRef blijft ongemoeid', st.externalLinks?.[0].sourceRef, baseTask.externalLinks![0].sourceRef);
eq('32 customFields van type date schuiven BEWUST NIET (paragraaf 1.7)', st.customFields?.['cf-date'], '2026-06-01');
eq('33 customFields tekstwaarde blijft', st.customFields?.['cf-text'], 'blijft');
eq('34 time.actualDuration blijft (duur)', st.time.actualDuration, 3);
eq('35 time.remainingTime blijft (duur)', st.time.remainingTime, 2);
eq('36 time.remainingMinutes blijft (duur)', st.time.remainingMinutes, 960);
eq('37 time.completion blijft (fractie)', st.time.completion, 0.6);
eq('38 time.scheduleDuration blijft (duur)', st.time.scheduleDuration, 5);
eq('39 levelingDelay blijft (relatieve vertraging)', st.levelingDelay, 3);
eq('40 earlyStart blijft ongemoeid (AFGELEID — runCPM overschrijft)', st.time.earlyStart, '2026-06-01');
eq('41 lateFinish blijft ongemoeid (AFGELEID)', st.time.lateFinish, '2026-06-05');

// Zuiverheid: het BRONobject mag niet gemuteerd zijn, en `time` moet ALTIJD een kopie zijn.
eq('42 bron-taak ongemoeid (puur)', baseTask.time.scheduleStart, '2026-06-01');
eq('43 bron-constraint ongemoeid (puur)', baseTask.constraint?.date, '2026-06-04');
eq('44 time is ALTIJD een nieuw object, ook bij delta 0 (anders muteert de preview-solver de store)',
  shiftTask(baseTask, 0).time !== baseTask.time, true);
eq('45 externalLinks is een nieuwe array bij delta 0',
  shiftTask(baseTask, 0).externalLinks !== baseTask.externalLinks, true);

// ASAP/ALAP hebben geen constraint-datum ⇒ no-op, geen crash.
const asapTask: Task = { ...baseTask, constraint: { type: 'ASAP' }, constraint2: undefined };
eq('46 ASAP-constraint zonder datum blijft datumloos', shiftTask(asapTask, 7).constraint, { type: 'ASAP' });
// R4: de harde pin-VLAG blijft, de datum eronder schuift mee.
const pinned: Task = { ...baseTask, constraint: { type: 'MSO', date: '2026-06-15', hard: true } };
eq('47 R4 harde pin: datum schuift', shiftTask(pinned, 7).constraint?.date, '2026-06-22');
eq('48 R4 harde pin: hard-vlag blijft true', shiftTask(pinned, 7).constraint?.hard, true);

// Resource.availabilitySteps[].from — effective-dated capaciteit is PROJECT-planning.
const res: Resource = {
  id: 'r1', name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1,
  availabilitySteps: [{ from: '2026-06-01', maxUnits: 1 }, { from: '2026-07-01', maxUnits: 3 }],
};
const sr = shiftResource(res, 7);
eq('49 availabilitySteps[0].from schuift', sr.availabilitySteps?.[0].from, '2026-06-08');
eq('50 availabilitySteps[1].from schuift', sr.availabilitySteps?.[1].from, '2026-07-08');
eq('51 availabilitySteps[].maxUnits blijft (getal)', sr.availabilitySteps?.[1].maxUnits, 3);
eq('52 bron-resource ongemoeid (puur)', res.availabilitySteps?.[0].from, '2026-06-01');
eq('53 resource zonder stappen: geen crash', shiftResource({ id: 'r2', name: 'X', type: 'LABOR', description: '', maxUnits: 1 }, 7).availabilitySteps, undefined);

// Baseline — alleen bij shiftBaselines:true; createdAt is een ARCHIEFdatum en schuift NOOIT.
const bl: Baseline = {
  id: 'b1', name: 'Baseline 1', createdAt: '2026-05-20T09:00:00.000Z',
  tasks: [{ taskId: 't1', start: '2026-06-01', finish: '2026-06-05', duration: 5, isMilestone: false }],
  projectEnd: '2026-06-10', projectDuration: 8,
};
const sb = shiftBaseline(bl, 7);
eq('54 baseline task.start schuift', sb.tasks[0].start, '2026-06-08');
eq('55 baseline task.finish schuift', sb.tasks[0].finish, '2026-06-12');
eq('56 baseline.projectEnd schuift', sb.projectEnd, '2026-06-17');
eq('57 baseline.createdAt schuift NOOIT (archiefdatum, ook niet bij shiftBaselines)', sb.createdAt, '2026-05-20T09:00:00.000Z');
eq('58 baseline.projectDuration blijft (duur)', sb.projectDuration, 8);

// Project — drie datums mee, createdAt/modifiedAt niet.
const sp = shiftProjectDates(
  {
    id: 'p', name: 'P', description: '', startDate: '2026-06-01', endDate: '2026-12-31',
    calendarId: 'cal-default', createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: '2026-05-01T00:00:00.000Z', author: '', company: '', statusDate: '2026-06-03T12:00',
  },
  7,
);
eq('59 project.startDate schuift', sp.startDate, '2026-06-08');
eq('60 project.endDate schuift', sp.endDate, '2027-01-07');
eq('61 project.statusDate schuift, datetime-vorm behouden (R5)', sp.statusDate, '2026-06-10T12:00');
eq('62 project.createdAt schuift NIET (bestandshistorie)', sp.createdAt, '2026-01-01T00:00:00.000Z');
eq('63 project.modifiedAt schuift NIET met delta', sp.modifiedAt, '2026-05-01T00:00:00.000Z');
eq('64 lege endDate blijft leeg', shiftProjectDates({ ...sp, endDate: '' }, 7).endDate, '');
eq('65 afwezige statusDate blijft afwezig', 'statusDate' in shiftProjectDates({ ...sp, statusDate: undefined }, 7), true);

// ═══════════════════════════════════════════════════════════════════════════
// 3) computeHolidayGaps — R7 (nieuw gevonden randgeval)
// ═══════════════════════════════════════════════════════════════════════════
const genCal: WorkCalendar = {
  id: 'c-gen', name: 'NL bouw', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [],
  generation: { ruleSetId: 'NL', generatedFromYear: 2025, generatedToYear: 2029 },
};
const manualCal: WorkCalendar = { ...genCal, id: 'c-man', name: 'Handmatig', generation: undefined };
eq('70 binnen de spanne => geen waarschuwing', computeHolidayGaps([genCal], '2026-06-01', '2027-01-07'), []);
eq('71 einde voorbij de spanne => waarschuwing met het jaar',
  computeHolidayGaps([genCal], '2031-06-01', '2031-08-01'),
  [{ name: 'NL bouw', from: 2025, to: 2029, year: 2031 }]);
eq('72 start vóór de spanne => waarschuwing (verschuiving naar het verleden, R1+R7)',
  computeHolidayGaps([genCal], '2022-01-05', '2022-03-01'),
  [{ name: 'NL bouw', from: 2025, to: 2029, year: 2022 }]);
eq('73 exact op de bovengrens => geen waarschuwing', computeHolidayGaps([genCal], '2029-01-01', '2029-12-31'), []);
eq('74 handmatige kalender (geen generation) => nooit een waarschuwing', computeHolidayGaps([manualCal], '2031-06-01', '2031-08-01'), []);
eq('75 dubbele id wordt gededupliceerd (projectkalender-cache + bibliotheek)',
  computeHolidayGaps([genCal, { ...genCal }], '2031-06-01', '2031-08-01').length, 1);
eq('76 onparseerbare datum => geen waarschuwing i.p.v. onzin', computeHolidayGaps([genCal], '', ''), []);

// ═══════════════════════════════════════════════════════════════════════════
// 4) computeMoveImpact — de tellingen die de preview-waarschuwingen voeden
// ═══════════════════════════════════════════════════════════════════════════
const impact = computeMoveImpact(
  [baseTask, pinned, { ...baseTask, id: 't3', constraint: undefined, constraint2: undefined, deadline: undefined, externalLinks: undefined, customFields: undefined, time: { ...baseTask.time, actualStart: undefined, actualFinish: undefined } }],
  [res],
  [bl],
  [{ id: 'cf-date', name: 'Keuringsdatum', type: 'date' }, { id: 'cf-text', name: 'Opmerking', type: 'text' }],
);
eq('80 taskCount telt alle taken met minstens één verschuifbare datum', impact.taskCount, 3);
eq('81 constraintCount telt taken met een constraint-datum', impact.constraintCount, 2);
eq('82 hardPinCount telt de harde pins (R4)', impact.hardPinCount, 1);
eq('83 deadlineCount', impact.deadlineCount, 2);
eq('84 actualCount telt taken met werkelijke datums (R5)', impact.actualCount, 2);
eq('85 externalLinkCount telt de koppelingen, niet de taken (R6)', impact.externalLinkCount, 2);
eq('86 availabilityStepCount', impact.availabilityStepCount, 2);
eq('87 dateCustomFieldCount telt alleen INGEVULDE date-velden (paragraaf 1.7)', impact.dateCustomFieldCount, 2);
eq('88 baselineCount', impact.baselineCount, 1);

// ═══════════════════════════════════════════════════════════════════════════
// 5) De store-actie: guards, kalender-onaantastbaarheid en preview-ZUIVERHEID
// ═══════════════════════════════════════════════════════════════════════════
S().newProject();
S().setCalendar({
  ...S().calendar,
  workDays: [1, 2, 3, 4, 5],
  holidays: [{ name: 'Bouwvak', startDate: '2026-06-22', endDate: '2026-06-26' }],
});
S().setProject({ startDate: '2026-06-01', endDate: '2026-06-30' });
const tA = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-06-01', 5) });
const tB = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-06-08', 3) });
S().addSequence({ predecessorId: tA, successorId: tB, type: 'FINISH_START', lagDays: 0 });
const rid = S().addResource({
  name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1,
  availabilitySteps: [{ from: '2026-06-01', maxUnits: 1 }],
});
S().runCPM();

// --- Preview-zuiverheid: de droogrun mag NIETS muteren (levelResources-precedent). ---
const snapshotBefore = JSON.stringify({
  project: S().project, tasks: S().tasks, resources: S().resources,
  calendar: S().calendar, calendars: S().calendars, baselines: S().baselines,
  cpmResult: { end: S().cpmResult?.projectEnd, dur: S().cpmResult?.projectDuration },
  undoLen: S().undoStack.length, dirty: S().isDirty,
});
const prev = S().previewMoveProject('2026-06-22');
eq('90 preview: state volledig ONGEWIJZIGD (droogrun muteert niets)',
  JSON.stringify({
    project: S().project, tasks: S().tasks, resources: S().resources,
    calendar: S().calendar, calendars: S().calendars, baselines: S().baselines,
    cpmResult: { end: S().cpmResult?.projectEnd, dur: S().cpmResult?.projectDuration },
    undoLen: S().undoStack.length, dirty: S().isDirty,
  }),
  snapshotBefore);
eq('91 preview.deltaDays', prev.deltaDays, 21);
eq('92 preview.endBefore (huidige planning)', prev.endBefore, '2026-06-10');
eq('93 preview.endAfter — over de bouwvakweek heen', prev.endAfter, '2026-07-08');
// HET PUNT van de preview (ontwerpbesluit 2): het einde schuift 28 dagen terwijl delta 21 is.
eq('94 preview.endDeltaDays wijkt af van deltaDays => de kalender heeft ingegrepen', prev.endDeltaDays, 28);
eq('95 preview: projectduur in werkdagen blijft gelijk', [prev.durationBefore, prev.durationAfter], [8, 8]);
eq('96 preview.impact.availabilityStepCount', prev.impact.availabilityStepCount, 1);
eq('97 preview: geen solver-fout', prev.error, undefined);

// --- Commit: guards R8/R9 ---
const undoLenBefore = S().undoStack.length;
const noop = S().moveProject('2026-06-01');
eq('100 R8 delta=0 => moved:false', noop.moved, false);
eq('101 R8 delta=0 => GEEN undo-stap gepusht', S().undoStack.length, undoLenBefore);
const bad = S().moveProject('geen-datum');
eq('102 R9 ongeldige datum => moved:false', bad.moved, false);
eq('103 R9 ongeldige datum => GEEN undo-stap gepusht', S().undoStack.length, undoLenBefore);
eq('104 R9 ongeldige datum => project.startDate ongewijzigd', S().project.startDate, '2026-06-01');

// --- Commit: de echte verschuiving ---
const holidaysBefore = JSON.stringify(S().calendar.holidays);
const createdAtBefore = S().project.createdAt;
const moved = S().moveProject('2026-06-22');
eq('110 moved:true', moved.moved, true);
eq('111 deltaDays', moved.deltaDays, 21);
eq('112 taskCount', moved.taskCount, 2);
eq('113 project.startDate exact op de gekozen datum', S().project.startDate, '2026-06-22');
eq('114 project.endDate schuift mee', S().project.endDate, '2026-07-21');
eq('115 project.createdAt ongemoeid', S().project.createdAt, createdAtBefore);
// ONTWERPBESLUIT 2 — het hart van de feature: de KALENDER schuift NIET mee.
eq('116 kalender-feestdagen BLIJVEN op hun absolute datums staan', JSON.stringify(S().calendar.holidays), holidaysBefore);
eq('117 taakanker A schuift (zonder dit doet moveProject niets aan de planning)',
  S().tasks.find(t => t.id === tA)?.time.scheduleStart, '2026-06-22');
eq('118 resource.availabilitySteps[].from schuift mee',
  S().resources.find(r => r.id === rid)?.availabilitySteps?.[0].from, '2026-06-22');
eq('119 de planning is vers doorgerekend (runCPM draaide mee)', S().scheduleStale, false);
eq('120 projecteinde na de verschuiving (over de bouwvak heen)', S().cpmResult?.projectEnd, '2026-07-08');
eq('121 het verplaatste project wordt in beeld gebracht (pendingFit)', S().view.pendingFit, true);
eq('122 document als gewijzigd gemarkeerd', S().isDirty, true);

// --- Undo herstelt óók de projectdatums (bewaakt dat `project` in de undo-snapshot zit) ---
S().undo();
eq('130 undo herstelt project.startDate', S().project.startDate, '2026-06-01');
eq('131 undo herstelt project.endDate', S().project.endDate, '2026-06-30');
eq('132 undo herstelt het taakanker', S().tasks.find(t => t.id === tA)?.time.scheduleStart, '2026-06-01');
eq('133 undo herstelt de capaciteitsstap', S().resources.find(r => r.id === rid)?.availabilitySteps?.[0].from, '2026-06-01');
S().redo();
eq('134 redo verschuift opnieuw, inclusief de projectdatum', S().project.startDate, '2026-06-22');
eq('135 redo herstelt het taakanker', S().tasks.find(t => t.id === tA)?.time.scheduleStart, '2026-06-22');

// --- R3: leeg project — de actie moet slagen en de preview mag geen epoch-datum tonen ---
S().newProject();
S().setProject({ startDate: '2026-06-01' });
const emptyPrev = S().previewMoveProject('2027-03-01');
eq('140 R3 leeg project: preview toont GEEN einddatum (geen 1970-01-01-lek)', [emptyPrev.endBefore, emptyPrev.endAfter], ['', '']);
eq('141 R3 leeg project: taskCount 0', emptyPrev.impact.taskCount, 0);
const emptyMove = S().moveProject('2027-03-01');
eq('142 R3 leeg project: de actie slaagt', emptyMove.moved, true);
eq('143 R3 leeg project: alleen de projectdatum verschuift', S().project.startDate, '2027-03-01');

// ═══════════════════════════════════════════════════════════════════════════
// 6) IFC-round-trip na een verschuiving (paragraaf 4 van het ontwerp)
// ═══════════════════════════════════════════════════════════════════════════
// "Project verplaatsen" wijzigt geen datamodel, alleen WAARDEN in bestaande, al round-trippende
// velden — dus er is geen reader/writer-aanpassing nodig. Deze check bewijst dat: verplaats,
// schrijf IFC, lees terug, vergelijk. Belangrijkste val: `ifcWriter` leidt planStart/planEnd af uit
// min(scheduleStart)/max(scheduleFinish) en gebruikt `project.startDate` alleen als FALLBACK — zou
// alleen `scheduleStart` schuiven (en `scheduleFinish` aan runCPM overgelaten worden), dan zou een
// opslaan-vóór-herberekenen een IFC met een inconsistente planEnd wegschrijven. Dat is precies de
// reden dat `scheduleFinish` in de MEE-lijst staat.
S().newProject();
S().setProject({ startDate: '2026-06-01', endDate: '2026-06-30' });
const rtA = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-06-01', 5) });
const rtB = S().addTask({
  name: 'B',
  time: createDefaultTaskTime('2026-06-08', 3),
  constraint: { type: 'SNET', date: '2026-06-08' },
  deadline: '2026-06-30',
});
S().addSequence({ predecessorId: rtA, successorId: rtB, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
S().moveProject('2026-09-07');

const movedProject = { start: S().project.startDate, end: S().project.endDate };
const movedAnchors = S().tasks.map(t => [t.name, t.time.scheduleStart, t.time.scheduleFinish]);
const movedConstraint = S().tasks.find(t => t.id === rtB)?.constraint?.date;
const movedDeadline = S().tasks.find(t => t.id === rtB)?.deadline;

const ifc = writeIFC(buildWriteIFCInput(S()));
const back = readIFC(ifc);

eq('150 round-trip: project.startDate identiek terug', back.project?.startDate, movedProject.start);
// De CONTRACTUELE einddatum overleeft de round-trip ongeschonden. Dat was ooit anders: `ifcWriter`
// schreef 'm alleen naar IFCWORKPLAN.FinishTime — een slot dat de AFGELEIDE plan-omvang
// (max(scheduleFinish)) draagt en `project.endDate` slechts als terugval bij nul taken gebruikte.
// Opslaan+herladen verving de contractuele einddatum daardoor door de planningseinddatum (hier:
// verschoven naar 2026-10-06, terug als 2026-09-16 = de laatste scheduleFinish). De contractuele
// datums hebben nu eigen opslag in het OPS_ProjectSettings-pset; IFCWORKPLAN.StartTime/FinishTime
// blijft onveranderd de afgeleide plan-omvang dragen, want dát is wat andere IFC-tools eruit lezen.
eq('151 round-trip: contractuele project.endDate identiek terug (niet de afgeleide planningsdatum)',
  back.project?.endDate, movedProject.end);
eq('152 de verschuiving zelf was wél correct toegepast op endDate', movedProject.end, '2026-10-06');
eq('153 round-trip: taakankers (scheduleStart/scheduleFinish) identiek terug',
  back.tasks.map(t => [t.name, t.time.scheduleStart, t.time.scheduleFinish]).sort(),
  [...movedAnchors].sort());
eq('154 round-trip: verschoven constraint-datum identiek terug',
  back.tasks.find(t => t.name === 'B')?.constraint?.date, movedConstraint);
eq('155 round-trip: verschoven deadline identiek terug',
  back.tasks.find(t => t.name === 'B')?.deadline, movedDeadline);
eq('156 de verschuiving is echt aangekomen (geen toevallig gelijke waarden)',
  [movedProject.start, movedConstraint], ['2026-09-07', '2026-09-14']);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  move-project-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  move-project-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
