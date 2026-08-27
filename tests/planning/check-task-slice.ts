// H1 (Opus-review T15-fixronde, B1-BLOKKER): store-niveau-bewijs voor `applyProgressInvariants`
// (taskSlice.ts) — vóór de fix viel `completion===1` zonder statusdatum terug op
// `formatDate(new Date())` ("vandaag"). Het commentaar bij `applyProgressInvariants` verwees al
// naar dit bestand/deze case-id vóórdat ze bestonden (B1-bevinding) — dit bestand IS nu dat bewijs.
//
// Ankerdatum ver in het verleden (2015-01-05, een maandag): "vandaag" (de dag waarop deze test
// draait) kan daar nooit toevallig mee samenvallen, dus een terugkerende mutatie-regressie (de
// vandaag-fallback komt terug) kan niet per ongeluk groen uitslaan omdat de testdatum toevallig
// overeenkomt met de systeemdatum.
//
// Twee beweringen, in één scenario:
//   1. 100%-completion ZONDER statusdatum ⇒ `actualFinish` wordt de taak se EIGEN geplande finish
//      (earlyFinish, ná runCPM), NOOIT de kalenderdag van vandaag.
//   2. Dezelfde mutatie zet `scheduleStale` ALTIJD op true, óók zonder statusdatum (H1's tweede
//      helft: de oude `stale: !!s.project.statusDate` was een kunstmatige poort).
//
// Draait via run.sh. Exit 0 = alles groen.

import { useAppStore } from '@/state/appStore';
import {
  createDefaultTaskTime, taskHasActiveTimephasedSteering, taskHasTimephasedContours,
} from '@/utils/taskDefaults';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const task = (id: string): Task | undefined => S().tasks.find(t => t.id === id);

// ── Setup: verse project, taak met een anker VER in het verleden, geen statusdatum. ──
S().newProject();
ok('setup: fris project heeft geen statusdatum', S().project.statusDate === undefined);

const idA = S().addTask({
  name: 'A',
  time: createDefaultTaskTime('2015-01-05', 5),
});
S().runCPM();
ok('setup: runCPM zet scheduleStale terug op false', S().scheduleStale === false);

const plannedFinish = task(idA)?.time.earlyFinish;
ok(`setup: taak heeft een berekende earlyFinish (kreeg: ${plannedFinish})`, !!plannedFinish && plannedFinish.startsWith('2015-01'));

// ── Mutatie: 100% invullen, GEEN statusdatum. ──
S().setTaskProgress(idA, 1);
const afterA = task(idA);

// Bewering 1: actualFinish = de EIGEN geplande finish, niet vandaag.
ok(
  `prog-h1-geen-teleport-naar-vandaag: actualFinish (${afterA?.time.actualFinish}) === eigen geplande finish (${plannedFinish}), NIET vandaag`,
  afterA?.time.actualFinish === plannedFinish,
);
ok(
  `prog-h1-geen-teleport-naar-vandaag: actualFinish valt niet toevallig in het huidige kalenderjaar (${afterA?.time.actualFinish})`,
  !!afterA?.time.actualFinish && !afterA.time.actualFinish.startsWith(new Date().getFullYear().toString()),
);
ok('prog-h1-geen-teleport-naar-vandaag: completion blijft 1', afterA?.time.completion === 1);
ok('prog-h1-geen-teleport-naar-vandaag: status COMPLETED', afterA?.status === 'COMPLETED');

// Bewering 2: scheduleStale wordt ALTIJD gezet, ook zonder statusdatum (H1, tweede helft).
ok(
  `prog-h1-stale-zonder-statusdatum: scheduleStale === true ná setTaskProgress(...,1) zonder statusdatum (kreeg: ${S().scheduleStale})`,
  S().scheduleStale === true,
);

// ── Controle: setActualStart/setActualFinish zetten ÓÓK altijd stale, zonder statusdatum. ──
S().runCPM(); // reset scheduleStale=false vóór de volgende losse mutaties
const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2015-02-02', 3) });
S().runCPM();
ok('controle-setup: scheduleStale weer false ná de tweede runCPM', S().scheduleStale === false);
S().setActualStart(idB, '2015-02-02');
ok(
  `prog-h1-stale-zonder-statusdatum (setActualStart): scheduleStale === true (kreeg: ${S().scheduleStale})`,
  S().scheduleStale === true,
);

S().runCPM();
S().setActualFinish(idB, '2015-02-04');
ok(
  `prog-h1-stale-zonder-statusdatum (setActualFinish): scheduleStale === true (kreeg: ${S().scheduleStale})`,
  S().scheduleStale === true,
);

// ── T16-veeglijst: setActualStart/setActualFinish tegen een DATUMLOZE statusdatum — het gefixte
// "uur-precieze actual op de statusdatum-dag" gat (was: RUWE-ISO-string-vergelijking, lexicografisch
// "2026-...T08:00" > "2026-..." ongeacht klokstand). Ankerdatum losstaand van de bovenste scenario's
// (2026-07-06, een maandag), zodat deze sectie op zichzelf leesbaar blijft. ────────────────────────
S().runCPM();
const idC = S().addTask({ name: 'C', time: createDefaultTaskTime('2026-07-06', 3) });
S().setStatusDate('2026-07-06'); // datumloze statusdatum
S().runCPM();

// Bewering 1 (het gefixte gat): een uur-precieze actualStart OP de statusdatum-dag zelf wordt
// geaccepteerd, niet stil geweigerd.
const acceptedSameDayHour = S().setActualStart(idC, '2026-07-06T08:00');
ok(
  `t16-actual-statusdate-zelfde-dag-uur (setActualStart): geaccepteerd (kreeg: ${acceptedSameDayHour})`,
  acceptedSameDayHour === true,
);
ok(
  `t16-actual-statusdate-zelfde-dag-uur: actualStart daadwerkelijk gezet (kreeg: ${task(idC)?.time.actualStart})`,
  task(idC)?.time.actualStart === '2026-07-06T08:00',
);

// Bewering 2 (blijft geweigerd): een actualStart op een dag NÁ de statusdatum, ongeacht precisie.
const rejectedNextDay = S().setActualStart(idC, '2026-07-07T00:01');
ok(
  `t16-actual-statusdate-latere-dag (setActualStart): geweigerd (kreeg: ${rejectedNextDay})`,
  rejectedNextDay === false,
);
ok(
  `t16-actual-statusdate-latere-dag: actualStart blijft ongewijzigd (kreeg: ${task(idC)?.time.actualStart})`,
  task(idC)?.time.actualStart === '2026-07-06T08:00',
);

// Bewering 3: zelfde uur-precieze-op-dezelfde-dag-acceptatie voor setActualFinish.
const acceptedFinishSameDayHour = S().setActualFinish(idC, '2026-07-06T17:00');
ok(
  `t16-actual-statusdate-zelfde-dag-uur (setActualFinish): geaccepteerd (kreeg: ${acceptedFinishSameDayHour})`,
  acceptedFinishSameDayHour === true,
);

// Mutatiebewijs (reviewer-repro, daadwerkelijk gedraaid): `isActualPastStatusDate` teruggezet naar
// de kale RUWE-ISO-stringvergelijking (`return dateIso > statusDateIso;`) en de suite herdraaid —
// 4 van de 16 checks sloegen rood uit ("2026-07-06T08:00" > "2026-07-06" is lexicografisch waar, de
// langere string wint), exact de beweringen 1/2/3 hierboven (het gefixte gat). Teruggezet naar de
// fix: weer 16/16 groen.

// ── Z14b (eigenaarsprincipe 2026-08-18) — edit-time-invalidatie van het GELEZEN Z8-venster.
// `timephasedFinishFloor`/`timephasedStartAnchor` moeten wijken zodra een gebruiker duur/datums of
// kalender wijzigt (`updateTask`/`setTaskCalendar`); de RAUWE bron (`timephasedContours`) blijft
// altijd staan — dat is precies wat het eigenaarsprincipe eist. Zie `taskDefaults.ts`'s
// `clearTimephasedWindow`/`timeUpdateTouchesTimephasedWindow` voor de volledige triggerset-uitleg.
{
  S().runCPM();
  const idW = S().addTask({ name: 'Z14b-venster', time: createDefaultTaskTime('2026-08-03', 5) });
  S().runCPM();

  const seedWindow = () => {
    S().updateTask(idW, {
      timephasedFinishFloor: '2026-08-10T17:00',
      timephasedStartAnchor: '2026-08-03T08:00',
      timephasedContours: [{ resourceUid: 42, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
    });
  };

  // Bewering 1: een NIET-trigger-update (naam) raakt het venster niet — bewijst dat de triggerset
  // écht gescoped is, niet "elke updateTask wist alles".
  seedWindow();
  S().updateTask(idW, { name: 'Z14b-venster (hernoemd)' });
  const afterRename = task(idW);
  ok('z14b-venster: een naamswijziging (geen trigger) laat het venster ongemoeid',
    afterRename?.timephasedFinishFloor === '2026-08-10T17:00' && afterRename?.timephasedStartAnchor === '2026-08-03T08:00');
  ok('z14b-venster: de rauwe contouren blijven sowieso staan (geen trigger geraakt)',
    (afterRename?.timephasedContours?.length ?? 0) === 1);

  // Bewering 2: een DUUR-wijziging (time.scheduleDuration in de patch) wist het venster.
  seedWindow();
  const beforeDur = task(idW)!;
  S().updateTask(idW, { time: { ...beforeDur.time, scheduleDuration: 7 } });
  const afterDur = task(idW);
  ok(`z14b-venster (duur-trigger): timephasedFinishFloor gewist (kreeg: ${afterDur?.timephasedFinishFloor})`,
    afterDur?.timephasedFinishFloor === undefined);
  ok(`z14b-venster (duur-trigger): timephasedStartAnchor gewist (kreeg: ${afterDur?.timephasedStartAnchor})`,
    afterDur?.timephasedStartAnchor === undefined);
  ok('z14b-venster (duur-trigger): de RAUWE contouren blijven staan — eigenaarsprincipe',
    (afterDur?.timephasedContours?.length ?? 0) === 1);

  // Bewering 3: setTaskCalendar (kalender-trigger) wist het venster.
  seedWindow();
  S().addCalendar({ name: 'Z14b-kalender', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [] });
  const newCalId = S().calendars.find((c) => c.name === 'Z14b-kalender')!.id;
  S().setTaskCalendar(idW, newCalId);
  const afterCal = task(idW);
  ok(`z14b-venster (kalender-trigger): timephasedFinishFloor gewist (kreeg: ${afterCal?.timephasedFinishFloor})`,
    afterCal?.timephasedFinishFloor === undefined);
  ok(`z14b-venster (kalender-trigger): timephasedStartAnchor gewist (kreeg: ${afterCal?.timephasedStartAnchor})`,
    afterCal?.timephasedStartAnchor === undefined);
  ok('z14b-venster (kalender-trigger): de RAUWE contouren blijven staan',
    (afterCal?.timephasedContours?.length ?? 0) === 1);

  // Mutatiebewijs (daadwerkelijk uitgevoerd — zie de rapportage): de `clearTimephasedWindow`-aanroep
  // in `taskSlice.ts`'s `updateTask` tijdelijk verwijderd en deze suite herdraaid ⇒ Bewering 2 sloeg
  // rood uit (timephasedFinishFloor/StartAnchor bleven onterecht staan); teruggezet ⇒ weer groen.

  // Bewering 4/5/6: de "toewijzingen"-trigger — `resourceSlice.ts`'s `assignResource`/
  // `moveAssignment`/`unassignResource` (de PLAIN store-acties, niet de mcpTransaction-tweeling die
  // `tests/mcp/cases-draft.ts` al dekt). Een andere resource kan een andere resourcekalender
  // betekenen (de Z8-laag-4-discriminator), dus ook dit is een geldige trigger. Drie VERSE taken,
  // één per verb, zodat de drie beweringen elkaar niet via gedeelde assignment-state raken.
  const resId = S().addResource({ name: 'Z14b-resource', type: 'LABOR', description: '', maxUnits: 1 });

  const idAssign = S().addTask({ name: 'Z14b-venster-assign', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idAssign, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().assignResource(idAssign, resId, 1);
  ok(`z14b-venster (assignResource-trigger): timephasedFinishFloor gewist (kreeg: ${task(idAssign)?.timephasedFinishFloor})`,
    task(idAssign)?.timephasedFinishFloor === undefined);

  const idMoveFrom = S().addTask({ name: 'Z14b-venster-move-van', time: createDefaultTaskTime('2026-08-03', 5) });
  const idMoveTo = S().addTask({ name: 'Z14b-venster-move-naar', time: createDefaultTaskTime('2026-08-03', 5) });
  S().assignResource(idMoveFrom, resId, 1);
  const moveAsnId = S().assignments.find((a) => a.taskId === idMoveFrom && a.resourceId === resId)!.id;
  S().updateTask(idMoveFrom, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().updateTask(idMoveTo, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().moveAssignment(moveAsnId, idMoveTo);
  ok('z14b-venster (moveAssignment-trigger): bronTaak venster gewist', task(idMoveFrom)?.timephasedFinishFloor === undefined);
  ok('z14b-venster (moveAssignment-trigger): doelTaak venster gewist', task(idMoveTo)?.timephasedFinishFloor === undefined);

  const idUnassign = S().addTask({ name: 'Z14b-venster-unassign', time: createDefaultTaskTime('2026-08-03', 5) });
  S().assignResource(idUnassign, resId, 1);
  const unassignAsnId = S().assignments.find((a) => a.taskId === idUnassign && a.resourceId === resId)!.id;
  S().updateTask(idUnassign, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().unassignResource(unassignAsnId);
  ok('z14b-venster (unassignResource-trigger): venster gewist', task(idUnassign)?.timephasedFinishFloor === undefined);

  // ── F2 (spec-review-fixronde op 526af9f9): de "toewijzingen"-trigger moet OOK laag 4
  // (`timephasedDurationWalks`) wissen — een bevroren import-snapshot per toewijzing die stale
  // wordt zodra de toewijzingenset verandert (andere resource ⇒ mogelijk andere resourcekalender,
  // de laag-4-activeringsvoorwaarde). Drie VERSE taken, zelfde opzet als hierboven. ────────────────
  const walkSeed = [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal' }];
  const idAssignW = S().addTask({ name: 'Z14b-walks-assign', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idAssignW, { timephasedDurationWalks: walkSeed });
  S().assignResource(idAssignW, resId, 1);
  ok(`f2 (assignResource-trigger): timephasedDurationWalks gewist (kreeg: ${JSON.stringify(task(idAssignW)?.timephasedDurationWalks)})`,
    task(idAssignW)?.timephasedDurationWalks === undefined);

  const idMoveFromW = S().addTask({ name: 'Z14b-walks-move-van', time: createDefaultTaskTime('2026-08-03', 5) });
  const idMoveToW = S().addTask({ name: 'Z14b-walks-move-naar', time: createDefaultTaskTime('2026-08-03', 5) });
  S().assignResource(idMoveFromW, resId, 1);
  const moveAsnIdW = S().assignments.find((a) => a.taskId === idMoveFromW && a.resourceId === resId)!.id;
  S().updateTask(idMoveFromW, { timephasedDurationWalks: walkSeed });
  S().updateTask(idMoveToW, { timephasedDurationWalks: walkSeed });
  S().moveAssignment(moveAsnIdW, idMoveToW);
  ok('f2 (moveAssignment-trigger): bronTaak timephasedDurationWalks gewist', task(idMoveFromW)?.timephasedDurationWalks === undefined);
  ok('f2 (moveAssignment-trigger): doelTaak timephasedDurationWalks gewist', task(idMoveToW)?.timephasedDurationWalks === undefined);

  const idUnassignW = S().addTask({ name: 'Z14b-walks-unassign', time: createDefaultTaskTime('2026-08-03', 5) });
  S().assignResource(idUnassignW, resId, 1);
  const unassignAsnIdW = S().assignments.find((a) => a.taskId === idUnassignW && a.resourceId === resId)!.id;
  S().updateTask(idUnassignW, { timephasedDurationWalks: walkSeed });
  S().unassignResource(unassignAsnIdW);
  ok('f2 (unassignResource-trigger): timephasedDurationWalks gewist', task(idUnassignW)?.timephasedDurationWalks === undefined);

  // Controle: een duur-trigger (geen toewijzing) laat timephasedDurationWalks ONGEMOEID zolang GEEN
  // enkel item `workMinutes` draagt — die tak wandelt `task.time.durationMinutes` edit-live (task.ts
  // se eigen docblok), dus GEEN dubbele invalidatie nodig. `walkSeed` (hierboven) heeft bewust geen
  // `workMinutes`, precies de PRECIES-1-toewijzing-vorm die dit dekt.
  const idDurationW = S().addTask({ name: 'Z14b-walks-duur', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idDurationW, { timephasedDurationWalks: walkSeed });
  const beforeDurW = task(idDurationW)!;
  S().updateTask(idDurationW, { time: { ...beforeDurW.time, scheduleDuration: 8 } });
  ok('f2 controle: een duur-trigger laat timephasedDurationWalks ONGEMOEID zonder workMinutes (geen dubbele invalidatie)',
    task(idDurationW)?.timephasedDurationWalks?.length === 1);

  // ── N2 (Opus-her-check, tweede ronde): het TEGENOVERGESTELDE geval — een walk-item MET bevroren
  // `workMinutes` (de F2-apportioneringstak, >1 toewijzing) negeert een latere duur-/datum-wijziging
  // VOLLEDIG tenzij de lijst wordt gewist (`CPMSolver.ts`'s `timephasedFinish`: `walk.workMinutes ??
  // durMin` — de bevroren waarde wint altijd zodra ze gezet is). Twee sub-bewijzen: duur-trigger en
  // datum-trigger (scheduleStart) moeten de lijst nu wél wissen. GEEN kalender-sub-bewijs hier: een
  // `setTaskCalendar` kan de laag-4-uitkomst niet beïnvloeden (zie `taskDefaults.ts`'s bijgewerkte
  // "kalender"-paragraaf voor het waarom), dus dat blijft terecht ONGEMOEID — geen N2-scope. ───────
  const walkSeedFrozen = [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal', workMinutes: 1440 }];

  const idDurationWF = S().addTask({ name: 'Z14b-walks-duur-frozen', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idDurationWF, { timephasedDurationWalks: walkSeedFrozen });
  const beforeDurWF = task(idDurationWF)!;
  S().updateTask(idDurationWF, { time: { ...beforeDurWF.time, scheduleDuration: 8 } });
  ok(`n2 (duur-trigger, workMinutes gezet): timephasedDurationWalks GEWIST (kreeg: ${JSON.stringify(task(idDurationWF)?.timephasedDurationWalks)})`,
    task(idDurationWF)?.timephasedDurationWalks === undefined);

  const idDateWF = S().addTask({ name: 'Z14b-walks-datum-frozen', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idDateWF, { timephasedDurationWalks: walkSeedFrozen });
  const beforeDateWF = task(idDateWF)!;
  S().updateTask(idDateWF, { time: { ...beforeDateWF.time, scheduleStart: '2026-08-04' } });
  ok(`n2 (datum-trigger, workMinutes gezet): timephasedDurationWalks GEWIST (kreeg: ${JSON.stringify(task(idDateWF)?.timephasedDurationWalks)})`,
    task(idDateWF)?.timephasedDurationWalks === undefined);

  const idCalWF = S().addTask({ name: 'Z14b-walks-kalender-frozen', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idCalWF, { timephasedDurationWalks: walkSeedFrozen });
  S().addCalendar({ name: 'Z14b-walks-kalender-frozen-cal', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [] });
  const walkFrozenCalId = S().calendars.find((c) => c.name === 'Z14b-walks-kalender-frozen-cal')!.id;
  S().setTaskCalendar(idCalWF, walkFrozenCalId);
  ok(`n2 controle: een kalender-trigger laat timephasedDurationWalks ONGEMOEID óók mét workMinutes (buiten N2-scope, zie boven) (kreeg: ${JSON.stringify(task(idCalWF)?.timephasedDurationWalks)})`,
    task(idCalWF)?.timephasedDurationWalks?.length === 1);

  // ── F3 (spec-review-fixronde op 526af9f9): `resourceSlice.removeCalendar`/`commitCalendarLibrary`
  // zetten `t.calendarId = undefined` rechtstreeks, buiten `setTaskCalendar` om — ook daar moet het
  // Z8-venster wijken. ──────────────────────────────────────────────────────────────────────────
  const idRemoveCal = S().addTask({ name: 'Z14b-removeCalendar', time: createDefaultTaskTime('2026-08-03', 5) });
  const removeCalId = S().addCalendar({
    name: 'Z14b-te-verwijderen', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [],
  });
  S().setTaskCalendar(idRemoveCal, removeCalId);
  S().updateTask(idRemoveCal, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().removeCalendar(removeCalId);
  ok(`f3 (removeCalendar): timephasedFinishFloor gewist (kreeg: ${task(idRemoveCal)?.timephasedFinishFloor})`,
    task(idRemoveCal)?.timephasedFinishFloor === undefined);
  ok('f3 (removeCalendar): taak.calendarId inderdaad terugveld naar projectkalender (voorwaarde)',
    task(idRemoveCal)?.calendarId === undefined);

  const idCommitCal = S().addTask({ name: 'Z14b-commitCalendarLibrary', time: createDefaultTaskTime('2026-08-03', 5) });
  const commitCalId = S().addCalendar({
    name: 'Z14b-commit-weggehaald', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [],
  });
  S().setTaskCalendar(idCommitCal, commitCalId);
  S().updateTask(idCommitCal, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  // Commit een bibliotheek ZONDER `commitCalId` (spiegelt de kalenderdialoog die de kalender liet
  // vallen) — de resterende kalenders + de huidige projectkalender blijven staan.
  const remainingCalendars = S().calendars.filter((c) => c.id !== commitCalId);
  S().commitCalendarLibrary(remainingCalendars, S().project.calendarId!);
  ok(`f3 (commitCalendarLibrary): timephasedFinishFloor gewist (kreeg: ${task(idCommitCal)?.timephasedFinishFloor})`,
    task(idCommitCal)?.timephasedFinishFloor === undefined);
  ok('f3 (commitCalendarLibrary): taak.calendarId inderdaad terugveld naar projectkalender (voorwaarde)',
    task(idCommitCal)?.calendarId === undefined);

  // ── mpp-nul-data-etappe, DEEL 2: de twee-toestanden-logica achter `TaskTimephasedNotice`
  // (`taskHasActiveTimephasedSteering`/`taskHasTimephasedContours` in taskDefaults.ts) —
  // component-loze toets: welke taakvelden geven welke markering. Geen React-rendering nodig, de
  // component zelf is een dunne if/else over deze twee pure functies. ────────────────────────────
  {
    // Toestand 1 — ACTIEF (laag 3): timephasedFinishFloor/StartAnchor gezet + contouren aanwezig.
    const idPanelActive3 = S().addTask({ name: 'Panel-actief-laag3', time: createDefaultTaskTime('2026-08-03', 5) });
    S().updateTask(idPanelActive3, {
      timephasedFinishFloor: '2026-08-10T17:00',
      timephasedStartAnchor: '2026-08-03T08:00',
      timephasedContours: [{ resourceUid: 1, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
    });
    ok('deel2-actief(laag3): taskHasActiveTimephasedSteering === true',
      taskHasActiveTimephasedSteering(task(idPanelActive3)!) === true);
    ok('deel2-actief(laag3): taskHasTimephasedContours === true',
      taskHasTimephasedContours(task(idPanelActive3)!) === true);

    // Toestand 1 — ACTIEF (laag 4): GEEN venster, maar wel een niet-lege timephasedDurationWalks.
    const idPanelActive4 = S().addTask({ name: 'Panel-actief-laag4', time: createDefaultTaskTime('2026-08-03', 5) });
    S().updateTask(idPanelActive4, {
      timephasedDurationWalks: [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal' }],
      timephasedContours: [{ resourceUid: 2, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
    });
    ok('deel2-actief(laag4): taskHasActiveTimephasedSteering === true (walks niet-leeg, geen venster nodig)',
      taskHasActiveTimephasedSteering(task(idPanelActive4)!) === true);

    // Toestand 2 — LOSGELATEN: contouren blijven staan, maar de sturing is ná een bewerking gewist.
    const idPanelLost = S().addTask({ name: 'Panel-losgelaten', time: createDefaultTaskTime('2026-08-03', 5) });
    S().updateTask(idPanelLost, {
      timephasedFinishFloor: '2026-08-10T17:00',
      timephasedStartAnchor: '2026-08-03T08:00',
      timephasedContours: [{ resourceUid: 3, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
    });
    const beforeLost = task(idPanelLost)!;
    S().updateTask(idPanelLost, { time: { ...beforeLost.time, scheduleDuration: 8 } }); // duur-trigger: wist het venster.
    ok('deel2-losgelaten: taskHasActiveTimephasedSteering === false (venster is gewist)',
      taskHasActiveTimephasedSteering(task(idPanelLost)!) === false);
    ok('deel2-losgelaten: taskHasTimephasedContours === true (rauwe bron blijft staan — eigenaarsprincipe)',
      taskHasTimephasedContours(task(idPanelLost)!) === true);

    // Toestand 3 — GEEN MSP-herkomst: geen van beide velden ⇒ geen markering (component rendert null).
    const idPanelNone = S().addTask({ name: 'Panel-geen-msp', time: createDefaultTaskTime('2026-08-03', 5) });
    ok('deel2-geen-msp: taskHasActiveTimephasedSteering === false',
      taskHasActiveTimephasedSteering(task(idPanelNone)!) === false);
    ok('deel2-geen-msp: taskHasTimephasedContours === false',
      taskHasTimephasedContours(task(idPanelNone)!) === false);
  }
}

if (diffs.length === 0) {
  console.log(`OK  task-slice-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  task-slice-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
