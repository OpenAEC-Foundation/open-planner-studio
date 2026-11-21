// check-work-others-notice.ts — #954, besluit Ethan 2026-11-21 "melding als uren van anderen
// veranderen": past een bewerking aan één toewijzing (inzet, werk, resource erbij of eraf) de uren
// van een ANDERE resource op dezelfde taak echt aan, dan meldt de app wat er veranderde, met een
// knop Ongedaan maken die de hele bewerking (ook de duur) in één stap terugzet. Verandert er bij de
// anderen niets, dan komt er geen melding.
//
// "Echt" = zichtbaar in het paneel: het restwerk in uren op twee decimalen.
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { OTHER_WORK_NOTICE_KEY } from '@/state/otherWorkNotice';
import { selectUndoHistoryEvent } from '@/state/sessionHistory';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { workDaySlotsToPeriods } from '@/engine/contour/contourEdit';
import type { AppNotification, NotificationAction } from '@/state/slices/types';
import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { WorkRule } from '@/types/workRule';

const S = () => useAppStore.getState();
let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: kreeg ${g}, verwachtte ${w}`);
}

function reset(): void {
  S().newProject();
  useAppStore.setState((s) => { s.historyEvents = []; s.nextHistorySequence = 1; s.ui.notifications = []; s.isDirty = false; });
}
const task = (id: string): Task => S().tasks.find((t) => t.id === id)!;
const asg = (taskId: string, resourceId: string): ResourceAssignment =>
  S().assignments.find((a) => a.taskId === taskId && a.resourceId === resourceId)!;
const labor = (name: string): string => S().addResource({ name, type: 'LABOR', description: '', maxUnits: 1 });
const notice = (): AppNotification | undefined => S().ui.notifications.find((n) => n.dedupeKey === OTHER_WORK_NOTICE_KEY);
/** De knop van de melding; zonder melding een knop die bij geen enkel event hoort (de checks erna worden rood, niet fataal). */
const noticeAction = (n = notice()): NotificationAction => n?.action ?? { kind: 'undoHistoryEvent', eventId: '(geen melding)', labelKey: 'notifications.actions.undo' };
const clearNotices = () => useAppStore.setState((s) => { s.ui.notifications = []; });
/** De stap die Ctrl+Z nu terugzet. */
const latestId = () => selectUndoHistoryEvent(S().historyEvents, S().activeDocumentId)?.id;
/** Wat de planner leest: hoofdregel, duur, en per regel naam + uren. */
function summary(n: AppNotification | undefined): unknown {
  if (!n) return null;
  return {
    key: n.messageKey,
    duration: n.numberParams?.days ?? n.numberParams?.hours ?? null,
    lines: (n.detailLines ?? []).map((l) => [l.params?.name, l.numberParams?.before, l.numberParams?.after]),
    action: n.action?.kind,
  };
}

/** Taak van `days` werkdagen (8 u) met de resources (naam → inzet) en daarna de werkregel: zo heeft
 *  iedereen `days` × 8 u × inzet (onder Vast werk of Vaste inzet zou een tweede resource erbij de
 *  taak al korter maken). */
function seed(rule: WorkRule, days: number, people: Record<string, number>): { t: string; r: Record<string, string> } {
  reset();
  const t = S().addTask({ name: 'Metselwerk', time: createDefaultTaskTime('2026-06-01', days) });
  const r: Record<string, string> = {};
  for (const [name, units] of Object.entries(people)) {
    r[name] = labor(name);
    S().assignResource(t, r[name], units);
  }
  S().setTaskWorkRule(t, rule);
  S().runCPM();
  clearNotices();
  return { t, r };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a) Vaste inzet: Bram 100 % → 50 % maakt de taak 20 dagen, Anna 80 → 160 u --');
{
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  const events0 = S().historyEvents.length;
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  eq('a1 taak duurt nu 20 dagen', task(t).time.scheduleDuration, 20);
  eq('a2 melding: duur 20 dagen, Anna 80 → 160 u, knop Ongedaan maken', summary(notice()), {
    key: 'notifications.otherWork.durationDays', duration: 20, lines: [['Anna', 80, 160]], action: 'undoHistoryEvent',
  });
  eq('a3 meervoud volgt de duur', notice()?.params?.count, 20);
  eq('a4 Bram zelf staat niet in de melding', (notice()?.detailLines ?? []).some((l) => l.params?.name === 'Bram'), false);
  eq('a5 één stap in de geschiedenis', S().historyEvents.length - events0, 1);
  const action = noticeAction();
  eq('a6 de knop hoort bij die stap, de stap van Ctrl+Z', action.kind === 'undoHistoryEvent' && action.eventId === latestId(), true);
  if (action.kind === 'undoHistoryEvent') S().undoHistoryEvent(action.eventId);
  eq('a7 één keer Ongedaan maken: duur, inzet van Bram en uren van Anna terug',
    [task(t).time.scheduleDuration, asg(t, r.Bram).unitsPerDay, asg(t, r.Anna).remainingWorkMinutes ?? 10 * 8 * 60 * asg(t, r.Anna).unitsPerDay],
    [10, 1, 80 * 60]);
  eq('a8 na het terugzetten is de melding weg', summary(notice()), null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (b) een nieuwere bewerking: de melding verdwijnt, ook na Ctrl+Z van die bewerking --');
{
  // Review #1120 ronde 4 en 5: de knop zou de nieuwere bewerking meenemen, en de cijfers kunnen niet meer
  // kloppen. Weg is weg: Ctrl+Z van de nieuwere bewerking brengt de oude melding niet terug.
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  S().updateTask(t, { name: 'Metselwerk gevel' });
  eq('b1 na een andere bewerking is de melding weg', summary(notice()), null);
  S().undo();
  eq('b2 Ctrl+Z van die bewerking: naam terug, de melding blijft weg', [task(t).name, summary(notice())], ['Metselwerk', null]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (c) geen melding als de uren van de anderen gelijk blijven --');
{
  // Vaste inzet, één persoon: de duur verandert, maar er zijn geen anderen.
  const one = seed('FIXED_RATE', 10, { Bram: 1 });
  S().updateAssignment(asg(one.t, one.r.Bram).id, { unitsPerDay: 0.5 });
  eq('c1 Vaste inzet, alleen Bram: duur 20, geen melding', [task(one.t).time.scheduleDuration, summary(notice())], [20, null]);

  // Vaste inzet, drie personen: werk van Piet omlaag, de duur blijft (#955) ⇒ anderen gelijk.
  const three = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1, Piet: 1 });
  S().setAssignmentWork(asg(three.t, three.r.Piet).id, 40 * 60);
  eq('c2 Vaste inzet, werk van Piet 80 → 40 u: duur 10, geen melding', [task(three.t).time.scheduleDuration, summary(notice())], [10, null]);

  // Vast werk: de inzet van de anderen volgt, hun uren blijven.
  const fw = seed('FIXED_WORK', 10, { Anna: 1, Bram: 1 });
  S().updateAssignment(asg(fw.t, fw.r.Bram).id, { unitsPerDay: 0.5 });
  eq('c3 Vast werk, Bram 50 %: duur 20, Anna houdt 80 u, geen melding',
    [task(fw.t).time.scheduleDuration, asg(fw.t, fw.r.Anna).remainingWorkMinutes, summary(notice())], [20, 80 * 60, null]);

  // Standaardregel (Vaste duur en inzet): niets verandert bij de anderen.
  const std = seed('FIXED_DURATION_RATE', 10, { Anna: 1, Bram: 1 });
  S().updateAssignment(asg(std.t, std.r.Bram).id, { unitsPerDay: 0.5 });
  eq('c4 Vaste duur en inzet: duur 10, geen melding', [task(std.t).time.scheduleDuration, summary(notice())], [10, null]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (d) Vaste inzet: werk typen bij Bram maakt de taak langer --');
{
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  S().setAssignmentWork(asg(t, r.Bram).id, 160 * 60);
  eq('d1 werk Bram 80 → 160 u: duur 20, Anna 80 → 160 u', [task(t).time.scheduleDuration, summary(notice())], [20, {
    key: 'notifications.otherWork.durationDays', duration: 20, lines: [['Anna', 80, 160]], action: 'undoHistoryEvent',
  }]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (e) resource erbij of eraf: de uren van wie er al stond, veranderen --');
{
  const { t } = seed('FIXED_WORK', 10, { Anna: 1 });
  const bram = labor('Bram');
  S().assignResource(t, bram, 1);
  // Vast werk maakt een dagentaak een urentaak (B1a): de melding noemt de duur in de eenheid van de taak.
  eq('e1 Vast werk, Bram erbij: 40 uur (5 dagen), Anna 80 → 40 u', [task(t).time.scheduleDuration, summary(notice())], [5, {
    key: 'notifications.otherWork.durationHours', duration: 40, lines: [['Anna', 80, 40]], action: 'undoHistoryEvent',
  }]);
  clearNotices();
  S().unassignResource(asg(t, bram).id);
  eq('e2 Vast werk, Bram eraf: 80 uur (10 dagen), Anna 40 → 80 u', [task(t).time.scheduleDuration, summary(notice())], [10, {
    key: 'notifications.otherWork.durationHours', duration: 80, lines: [['Anna', 40, 80]], action: 'undoHistoryEvent',
  }]);

  // Vaste duur en werk: de duur blijft, het werk wordt verdeeld ⇒ melding zonder duurzin.
  const fdw = seed('FIXED_DURATION_WORK', 10, { Anna: 1 });
  S().assignResource(fdw.t, labor('Bram'), 1);
  eq('e3 Vaste duur en werk, Bram erbij: duur 10, Anna 80 → 40 u, hoofdregel zonder duur',
    [task(fdw.t).time.scheduleDuration, summary(notice())], [10, {
      key: 'notifications.otherWork.durationSame', duration: null, lines: [['Anna', 80, 40]], action: 'undoHistoryEvent',
    }]);

  // Vaste duur en inzet: een resource erbij raakt de anderen niet.
  const std = seed('FIXED_DURATION_RATE', 10, { Anna: 1 });
  S().assignResource(std.t, labor('Bram'), 1);
  eq('e4 Vaste duur en inzet, Bram erbij: geen melding', summary(notice()), null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (f) urentaak: de duur staat in uren --');
{
  reset();
  const t = S().addTask({ name: 'Inmeten', time: { ...createDefaultTaskTime('2026-06-01', 1), durationUnit: 'hours', durationMinutes: 4 * 60, scheduleDuration: 0.5 } });
  const anna = labor('Anna');
  const bram = labor('Bram');
  S().assignResource(t, anna, 1);
  S().assignResource(t, bram, 1);
  S().setTaskWorkRule(t, 'FIXED_RATE');
  clearNotices();
  S().updateAssignment(asg(t, bram).id, { unitsPerDay: 0.5 });
  eq('f1 urentaak: duur 8 uur, Anna 4 → 8 u', [task(t).time.durationMinutes, summary(notice())], [8 * 60, {
    key: 'notifications.otherWork.durationHours', duration: 8, lines: [['Anna', 4, 8]], action: 'undoHistoryEvent',
  }]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (g) een tweede bewerking vervangt de melding --');
{
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.25 });
  const notes = S().ui.notifications.filter((n) => n.dedupeKey === OTHER_WORK_NOTICE_KEY);
  eq('g1 één melding, met de laatste stand (40 dagen, Anna 160 → 320 u) en geen teller',
    [notes.length, summary(notes[0]), notes[0]?.count], [1, {
      key: 'notifications.otherWork.durationDays', duration: 40, lines: [['Anna', 160, 320]], action: 'undoHistoryEvent',
    }, 1]);
  const g = noticeAction(notes[0]);
  eq('g2 de knop hoort bij de laatste stap', g.kind === 'undoHistoryEvent' && g.eventId === latestId(), true);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (h) eigen urenverdeling: de melding noemt de uren van *Werk (u)* --');
{
  // Review #1120 ronde 1: zonder opgeslagen werkveld toont het paneel de contoursom; de melding ook.
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  const mpd = S().calendar.hoursPerDay * 60;
  S().setAssignmentContour(asg(t, r.Anna).id, workDaySlotsToPeriods(Array(10).fill(0.5 * mpd), undefined, mpd));
  eq('h0 Anna heeft geen werkveld (het paneel leest de contour)', asg(t, r.Anna).remainingWorkMinutes, undefined);
  clearNotices();
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  eq('h1 Bram 50 %: 20 dagen, Anna 40 → 80 u zoals de urenverdeling', [task(t).time.scheduleDuration, summary(notice())], [20, {
    key: 'notifications.otherWork.durationDays', duration: 20, lines: [['Anna', 40, 80]], action: 'undoHistoryEvent',
  }]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (i) Taak bewerken: geen melding, Annuleren is daar de weg terug --');
{
  // Review #1120 ronde 1 t/m 3: Taak bewerken bundelt meerdere bewerkingen (inzet, werk, duur, naam,
  // een werksoort) tot één stap. "Eén wijziging aan één persoon" is daar niet eenduidig en een knop past
  // niet op één stap; de dialoog heeft Annuleren. De melding hoort dus bij een losse bewerking buiten een
  // bewerksessie (het taakpaneel), niet bij de dialoog (knownbug 2054).
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  const mark = S().historyMark();
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  eq('i1 in de dialoog geen melding', summary(notice()), null);
  S().updateTask(t, { name: 'Metselwerk gevel' });
  S().squashHistorySince(mark, 'Taak bewerken');
  eq('i2 na Opslaan geen melding, en Ctrl+Z zet de hele taakbewerking terug', [summary(notice()), (S().undo(), [task(t).name, task(t).time.scheduleDuration, asg(t, r.Bram).unitsPerDay])], [null, ['Metselwerk', 10, 1]]);

  const c = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  const mark2 = S().historyMark();
  S().updateAssignment(asg(c.t, c.r.Bram).id, { unitsPerDay: 0.5 });
  S().revertHistorySince(mark2);
  eq('i3 na Annuleren: duur weer 10 en geen melding', [task(c.t).time.scheduleDuration, summary(notice())], [10, null]);

  // Na de dialoog werkt het paneel weer gewoon: een losse bewerking meldt.
  S().updateAssignment(asg(c.t, c.r.Bram).id, { unitsPerDay: 0.5 });
  eq('i4 daarna in het paneel: wel de melding', summary(notice()),
    { key: 'notifications.otherWork.durationDays', duration: 20, lines: [['Anna', 80, 160]], action: 'undoHistoryEvent' });
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (j) een ander document: de melding hoort bij het vorige --');
{
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  eq('j0 melding staat', summary(notice()) !== null, true);
  S().newDocument();
  eq('j1 na een documentwissel is de melding weg', summary(notice()), null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (k) Ctrl+Z zet de stap terug: de melding verdwijnt --');
{
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  eq('k0 melding staat', summary(notice()) !== null, true);
  S().undo();
  eq('k1 na Ctrl+Z: duur 10 en de melding is weg', [task(t).time.scheduleDuration, summary(notice())], [10, null]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (l) een volgende bewerking achterhaalt de cijfers: de hele melding verdwijnt --');
{
  // Review #1120 ronde 4: na een duurcorrectie in het paneel bleef "Taak duurt nu 20 dagen. Anna: 80 → 160 u"
  // staan, alleen de knop verdween. De melding staat er zolang haar stap de stap van Ctrl+Z is.
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  eq('l0 de melding staat', summary(notice()) !== null, true);
  S().updateTask(t, { time: { ...task(t).time, scheduleDuration: 12 } });
  eq('l1 na de duurcorrectie naar 12 dagen is de melding weg', [task(t).time.scheduleDuration, summary(notice())], [12, null]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (m) twee toewijzingen van dezelfde resource: dat is geen ander persoon --');
{
  // Review #1120 ronde 4: een IFC kan één resource twee keer op een taak zetten. Een inzetwijziging op de
  // eerste regel meldde de tweede als "Bram: 80 → 160 u".
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  useAppStore.setState((s) => {
    const first = s.assignments.find((a) => a.taskId === t && a.resourceId === r.Bram)!;
    s.assignments.push({ ...first, id: 'bram-tweede-regel' });
  });
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  eq('m1 Bram 50 %: 20 dagen, alleen Anna in de melding', [task(t).time.scheduleDuration, summary(notice())], [20, {
    key: 'notifications.otherWork.durationDays', duration: 20, lines: [['Anna', 80, 160]], action: 'undoHistoryEvent',
  }]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (n) de berekening (F5, Automatisch berekenen) laat de melding staan --');
{
  // De berekening schrijft alleen berekende taakvelden en maakt geen eigen stap; de duur en de uren in de
  // melding blijven gelden. Met Automatisch berekenen draait ze vlak na elke bewerking.
  const { t, r } = seed('FIXED_RATE', 10, { Anna: 1, Bram: 1 });
  S().updateAssignment(asg(t, r.Bram).id, { unitsPerDay: 0.5 });
  S().runCPM();
  eq('n1 na F5 staat de melding er nog', summary(notice()), {
    key: 'notifications.otherWork.durationDays', duration: 20, lines: [['Anna', 80, 160]], action: 'undoHistoryEvent',
  });
  const action = noticeAction();
  if (action.kind === 'undoHistoryEvent') S().undoHistoryEvent(action.eventId);
  eq('n2 Ongedaan maken zet de bewerking terug: 10 dagen, Bram 100 %', [task(t).time.scheduleDuration, asg(t, r.Bram).unitsPerDay], [10, 1]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (o) een bibliotheekverversing verandert het project buiten de geschiedenis: de melding verdwijnt --');
{
  // Review #1120 ronde 5: Resources → Bibliotheek, de gekoppelde kalender van 8 naar 6 u per dag, Toepassen.
  // De taak werd 26⅔ dagen; de melding bleef op 20 dagen staan, en de knop zette de kalenderkopie mee terug.
  reset();
  S().setProject({ startDate: '2026-06-01' });
  S().ensureProjectCalendarInLibrary();
  const t = S().addTask({ name: 'Metselwerk', time: createDefaultTaskTime('2026-06-01', 10) });
  const anna = labor('Anna');
  const bram = labor('Bram');
  S().assignResource(t, anna, 1);
  S().assignResource(t, bram, 1);
  S().setTaskWorkRule(t, 'FIXED_RATE');
  S().runCPM();
  const cid = S().addCompany('Bouwbedrijf');
  S().bindProjectToCompany(cid);
  const poolId = S().promoteCalendarToPool(cid, S().calendars.find((c) => c.id === S().project.calendarId)!)!;
  clearNotices();
  S().updateAssignment(asg(t, bram).id, { unitsPerDay: 0.5 });
  eq('o0 de taak duurt 20 dagen en de melding staat', [task(t).time.scheduleDuration, summary(notice()) !== null], [20, true]);
  const pool = S().pools[cid].calendars.find((c) => c.id === poolId)!;
  const six: WorkCalendar = { ...structuredClone(pool), workEndHour: 13, hoursPerDay: 6 };
  S().updatePoolCalendar(cid, poolId, six);
  eq('o1 kalender 6 u: de taak duurt 26⅔ dagen en de melding is weg',
    [S().calendar.hoursPerDay, Math.round(task(t).time.scheduleDuration * 100) / 100, summary(notice())], [6, 26.67, null]);
  S().updateTask(t, { name: 'Metselwerk gevel' });
  S().undo();
  eq('o2 een volgende bewerking en Ctrl+Z daarvan brengen de melding niet terug', summary(notice()), null);
}

if (diffs.length) {
  console.log(`XX check-work-others-notice: ${diffs.length} van ${checks} checks rood`);
  for (const d of diffs) console.log(`XX   ${d}`);
  process.exit(1);
}
console.log(`check-work-others-notice: ${checks} checks groen`);
