// F4b, fixronde 1 (review r1 op PR #584): drie invoerroutes houden de waarde die de planner koos.
//
//  1. Een eenheidswissel houdt het eindmoment onder elk profiel. Onder P6/MSP telt een dag als de
//     werktijd per dag, bij kalendertijd als 1440 klokminuten; alleen de OPS-dagenmaat volgt de kalender
//     dag voor dag (`proposeTaskDurationConversion` met `taskCountsInWorkdays`).
//  2. Een getypt einde onder P6 geeft na herberekenen precies dat einde terug
//     (`durationForShownFinish`: werkminuten ÷ werktijd per dag).
//  3. Een externe relatie houdt de breuk van een lag in dagen: invoer, terugtonen, het raster, opslaan in
//     IFC en de berekening.
//
// Kalender: de voorbeeldweek, ma–do 07–12 + 13–16 (8 u), vr 07–12 + 13–14 (6 u). Start ma 1 juni 2026.
// Elk scenario is het faalgeval uit het reviewrapport. Exit 0 = groen.
//
// Mutatiebewijs (2026-10-24, 65 checks): de omzetter altijd in de OPS-dagenmaat ⇒ 13 rood (P6: 5,25 d en
// einde 11:00; kalendertijd: 3 d en einde 4 juni); het getypte einde altijd in de dagenmaat ⇒ 4 rood
// (5,375 d en 12:00); de externe invoer weer afronden ⇒ 18 rood; het relatieplan weer een heel getal laten
// eisen ⇒ 6 rood; de weergave weer afronden ⇒ 10 rood.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { convertTaskDurationUnit } from '@/utils/taskDurationInput';
import { profileCountsWorkdays } from '@/utils/taskDuration';
import {
  formatExternalLagShort,
  formatExternalRelationClipboard,
  formatExternalRelationVisible,
  parseExternalLagInput,
  parseExternalRelationClipboard,
} from '@/engine/taskGrid/relationFormat';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import type { CellEditIntent } from '@/types/taskGrid';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

type Bands = { start: number; end: number }[];
function weekdays(monToThu: Bands, friday: Bands): WorkTimeBands {
  return { byWeekday: { 1: monToThu, 2: monToThu, 3: monToThu, 4: monToThu, 5: friday, 6: [], 7: [] } };
}
const week: WorkCalendar = {
  id: 'cal-week', name: 'Voorbeeldweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [],
  workTime: weekdays([{ start: 420, end: 720 }, { start: 780, end: 960 }], [{ start: 420, end: 720 }, { start: 780, end: 840 }]),
};

type Profile = 'ops' | 'p6' | 'msproject';
function fixture(profile: Profile) {
  const ctx = createAppStoreContext();
  const S = ctx.store.getState;
  S().setCalendar(week);
  S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string): Task => S().tasks.find(t => t.id === id)!;
  const addTask = (name: string, time: Partial<Task['time']>): string => {
    const id = S().addTask({ name });
    S().updateTask(id, { time: { ...taskOf(id).time, ...time } });
    return id;
  };
  const cell = (taskId: string, columnId: string, value: unknown): CellEditIntent =>
    ({ kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route: 'task-schedule', value });
  const edit = (taskId: string, columnId: string, value: unknown) => S().runGridMutation([cell(taskId, columnId, value)]).ok;
  const measure = () => ({ workdayDurationMeasure: profileCountsWorkdays(S().project) });
  const solved = (id: string) => {
    S().runCPM();
    const t = taskOf(id).time;
    return [t.earlyStart, t.earlyFinish];
  };
  return { S, taskOf, addTask, edit, measure, solved };
}

// ── 1a. P6 en MSP, korte vrijdag: 40 u ⇒ Dagen geeft 5 d en het einde blijft ma 8 juni 09:00 ─────────
for (const profile of ['p6', 'msproject'] as const) {
  const f = fixture(profile);
  const id = f.addTask('Veertig uur', { durationUnit: 'hours', durationMinutes: 2400, scheduleDuration: 5 });
  same(`1a ${profile}: 40 u vóór de wissel`, f.solved(id), ['2026-06-01T07:00', '2026-06-08T09:00']);
  same(`1a ${profile}: paneel en dialoog stellen 5 d voor`,
    convertTaskDurationUnit(f.taskOf(id), 'days', week, f.measure()), { unit: 'days', scheduleDuration: 5, explicitUnit: true });
  same(`1a ${profile}: de Tabel kiest Dagen`, f.edit(id, 'task.time.durationUnit', 'days'), true);
  same(`1a ${profile}: de store krijgt 5 d`, [f.taskOf(id).time.durationUnit, f.taskOf(id).time.scheduleDuration], ['days', 5]);
  same(`1a ${profile}: na herberekenen hetzelfde einde`, f.solved(id), ['2026-06-01T07:00', '2026-06-08T09:00']);
  // Terug naar uren: 5 d is onder P6/MSP 40 u (niet de 38 u van de OPS-dagenmaat).
  same(`1a ${profile}: terug naar Uren geeft 40 u`, f.edit(id, 'task.time.durationUnit', 'hours'), true);
  same(`1a ${profile}: de store krijgt 2400 min`, f.taskOf(id).time.durationMinutes, 2400);
  same(`1a ${profile}: na herberekenen nog steeds 09:00`, f.solved(id), ['2026-06-01T07:00', '2026-06-08T09:00']);
}

// ── 1b. Kalendertijd: 24 u ⇒ Dagen geeft 1 kalenderdag, het einde blijft staan ─────────────────────
for (const profile of ['ops', 'p6'] as const) {
  const f = fixture(profile);
  const id = f.addTask('Uitharden', { durationType: 'ELAPSEDTIME', durationUnit: 'hours', durationMinutes: 1440, scheduleDuration: 3 });
  const before = f.solved(id);
  same(`1b ${profile}: 24 u kalendertijd duurt 24 klokuren`,
    (Date.parse(before[1]!) - Date.parse(before[0]!)) / 3_600_000, 24);
  same(`1b ${profile}: paneel en dialoog stellen 1 d voor`,
    convertTaskDurationUnit(f.taskOf(id), 'days', week, f.measure()), { unit: 'days', scheduleDuration: 1, explicitUnit: true });
  same(`1b ${profile}: de Tabel kiest Dagen`, f.edit(id, 'task.time.durationUnit', 'days'), true);
  same(`1b ${profile}: de store krijgt 1 d`, [f.taskOf(id).time.durationUnit, f.taskOf(id).time.scheduleDuration], ['days', 1]);
  same(`1b ${profile}: na herberekenen hetzelfde einde`, f.solved(id), before);
  same(`1b ${profile}: terug naar Uren geeft 1440 min`, f.edit(id, 'task.time.durationUnit', 'hours') && f.taskOf(id).time.durationMinutes, 1440);
  same(`1b ${profile}: en weer hetzelfde einde`, f.solved(id), before);
}
// Kalendertijd met een dagdeel dat geen hele minuut is, is geen exacte wissel: de eenheid blijft.
{
  const f = fixture('ops');
  const id = f.addTask('Kort', { durationType: 'ELAPSEDTIME', durationUnit: 'hours', durationMinutes: 60, scheduleDuration: 0.125 });
  same('1b kalendertijd 1 u ⇒ geen exacte dagwaarde, geen voorstel',
    convertTaskDurationUnit(f.taskOf(id), 'days', week, f.measure()), null);
}
// Controle: de OPS-dagenmaat volgt de kalender dag voor dag (korte vrijdag), zoals voorheen.
{
  const f = fixture('ops');
  const id = f.addTask('Vijf dagen', { durationUnit: 'days', scheduleDuration: 5, durationMinutes: undefined });
  const before = f.solved(id);
  same('1c ops: 5 d eindigt vr 14:00', before, ['2026-06-01T07:00', '2026-06-05T14:00']);
  same('1c ops: Uren geeft 38 u', f.edit(id, 'task.time.durationUnit', 'hours') && f.taskOf(id).time.durationMinutes, 2280);
  same('1c ops: hetzelfde einde', f.solved(id), before);
}

// ── 2. Einde typen onder P6: 5 d, einde 8 juni 09:00; typ 10:00 ⇒ 5,125 d en na herberekenen 10:00 ──
for (const profile of ['p6', 'msproject'] as const) {
  const f = fixture(profile);
  const id = f.addTask('Dagtaak', { durationUnit: 'days', scheduleDuration: 5, durationMinutes: undefined });
  same(`2 ${profile}: 5 d eindigt ma 8 juni 09:00`, f.solved(id), ['2026-06-01T07:00', '2026-06-08T09:00']);
  same(`2 ${profile}: einde 08-06-2026 10:00 typen`, f.edit(id, 'task.time.finish', '2026-06-08T10:00'), true);
  same(`2 ${profile}: de store krijgt 41 werkuren = 5,125 d`,
    [f.taskOf(id).time.durationUnit, f.taskOf(id).time.scheduleDuration], ['days', 5.125]);
  same(`2 ${profile}: na herberekenen exact het getypte einde`, f.solved(id), ['2026-06-01T07:00', '2026-06-08T10:00']);
}
// Controle: in OPS telt een getypt einde in de dagenmaat (5 werkdagen + 3 van de 8 uur).
{
  const f = fixture('ops');
  const id = f.addTask('Dagtaak', { durationUnit: 'days', scheduleDuration: 5, durationMinutes: undefined });
  f.solved(id);
  same('2 ops: einde 08-06-2026 10:00 typen', f.edit(id, 'task.time.finish', '2026-06-08T10:00'), true);
  same('2 ops: de store krijgt 5,375 d', f.taskOf(id).time.scheduleDuration, 5.375);
  same('2 ops: na herberekenen exact het getypte einde', f.solved(id), ['2026-06-01T07:00', '2026-06-08T10:00']);
}

// ── 3. Externe relatie, "0,5d": de breuk blijft, ook in de berekening ──────────────────────────────
same('3 invoer "0,5d" ⇒ een halve werkdag', parseExternalLagInput('0,5d'), { lagDays: 0.5 });
same('3 invoer "1,5d" ⇒ anderhalve werkdag', parseExternalLagInput('1,5d'), { lagDays: 1.5 });
for (const profile of ['ops', 'p6'] as const) {
  const f = fixture(profile);
  const id = f.addTask('Opvolger', { durationUnit: 'days', scheduleDuration: 2, durationMinutes: undefined });
  const lag = parseExternalLagInput('0,5d')!;
  // Zoals Relatie → Externe relatie toevoegen bewaart (`ExternalLinkDialog`, handmatige bron).
  const linkId = f.S().addExternalLink(id, {
    direction: 'predecessor', relType: 'SS', ...lag, anchorDate: '2026-06-01T07:00', sourceMissing: false,
    sourceRef: { projectId: 'bron', projectName: 'Bron', taskId: 'BT', taskName: 'Brontaak' },
  });
  const link = () => f.taskOf(id).externalLinks!.find(candidate => candidate.id === linkId)!;
  same(`3 ${profile}: de store bewaart 0,5 d`, [link().lagDays, link().lagMinutes], [0.5, undefined]);
  same(`3 ${profile}: SS na een anker om 07:00 start om 11:00`, f.solved(id)[0], '2026-06-01T11:00');
  // Terugtonen: de dialoog vult het veld met `formatExternalLagShort`, de Tabel toont de zichtbare tekst.
  same(`3 ${profile}: de dialoog toont "+0.5d"`, formatExternalLagShort(link(), 'u'), '+0.5d');
  same(`3 ${profile}: de cel toont "SS+0.5d"`, formatExternalRelationVisible(link()).endsWith('SS+0.5d'), true);
  // Opslaan: IFC bewaart de breuk.
  const reopened = readIFC(writeIFC(buildWriteIFCInput(f.S()))).tasks.find(t => t.name === 'Opvolger');
  same(`3 ${profile}: na opslaan en openen nog 0,5 d`, reopened?.externalLinks?.map(l => l.lagDays), [0.5]);
  // Het raster: de cel "SS+1,5d" via de relatiecel (klembordvorm) bewaart 1,5 d.
  const text = formatExternalRelationClipboard(id, link()).replace('SS+0.5d', 'SS+1,5d');
  const parsed = parseExternalRelationClipboard(text, { ownerTaskId: id, direction: 'predecessor' });
  same(`3 ${profile}: de relatiecel leest "SS+1,5d"`, parsed.ok ? parsed.value.lag : parsed.code, { lagDays: 1.5 });
  if (parsed.ok) {
    const result = f.S().runGridMutation([{
      kind: 'relation-set', taskId: id, direction: 'predecessor',
      value: [{ kind: 'external', external: parsed.value, source: { index: 0, start: 0, end: text.length, text } }],
    }]);
    same(`3 ${profile}: het raster neemt de breuk aan`, result.ok, true);
    same(`3 ${profile}: de store krijgt 1,5 d`, link().lagDays, 1.5);
    // 1,5 werkdag na ma 07:00: 12 werkuren, dus di 11:00.
    same(`3 ${profile}: SS met 1,5 d start di 11:00`, f.solved(id)[0], '2026-06-02T11:00');
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX  ${failure}`);
  console.log(`\n${failures.length}/${checks} F4b-review-r1-checks mislukt.`);
  process.exit(1);
}
console.log(`OK  F4b review r1: ${checks} checks groen.`);
