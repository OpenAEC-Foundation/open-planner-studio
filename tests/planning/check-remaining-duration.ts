// Restduur in de eigen eenheid van de taak (G4, zijvondst weergaven W8).
//
// `applyProgressInvariants` rondde `remainingTime` voor ELKE taak af op hele werkdagen. Een urentaak
// van 5 u op 40 % kreeg zo restduur 0 (3 u werk ⇒ 0,375 dag ⇒ 0) en geen `remainingMinutes`; MSPDI en
// P6 exporteerden dan `RemainingDuration` 0, en na teruglezen plande de solver de taak af op de
// statusdatum. De regel is nu: de restduur staat in dezelfde vorm als de duur van de taak —
//   - dagtaak: `remainingTime` in hele werkdagen, zoals `scheduleDuration` (ongewijzigd);
//   - urentaak: `remainingMinutes` in hele minuten, zoals `durationMinutes`, en `remainingTime` als
//     onafgeronde werkdagfractie, zoals `scheduleDuration` (minuten ÷ (uren per dag × 60)).
// Eén functie (`applyRemainingDuration`) voor alle store-routes (paneel, raster, MCP) én de lezers
// (`normalizeImportedProgress`); de lezers laten een in het bestand vastgelegde `remainingMinutes`
// staan (T9: MSP's eigen exacte restduur). De adapter-round-trip staat in check-adapters-hours.ts.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import { progress } from '@/state/mcpValidation';
import { normalizeImportedProgress } from '@/services/importNormalize';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { CellEditIntent } from '@/types/taskGrid';

const S = () => useAppStore.getState();
let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}
function near(label: string, got: number | undefined, want: number): void {
  checks++;
  if (got === undefined || Math.abs(got - want) > 1e-9) diffs.push(`${label}: kreeg ${got} ≠ verwacht ${want}`);
}

const STATUS_DATE = '2026-06-01T10:00';
const band = [{ start: 8 * 60, end: 16 * 60 }];
const byWeekday = { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] };

/** Vers uurproject (8 u/dag), statusdatum ma 10:00, urentaak U (5 u) en dagtaak D (5 d). */
function setup(hoursPerDay = 8): { u: string; d: string } {
  S().newProject();
  S().setUI({ enableHourPlanning: true });
  const end = 8 * 60 + hoursPerDay * 60;
  const b = [{ start: 8 * 60, end }];
  S().setCalendar({
    ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay, workStartHour: 8, workEndHour: end / 60,
    workTime: { byWeekday: hoursPerDay === 8 ? byWeekday : { 1: b, 2: b, 3: b, 4: b, 5: b, 6: [], 7: [] } },
  } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'G4' });
  S().setStatusDate(STATUS_DATE);
  const u = S().addTask({ name: 'U', time: { durationUnit: 'hours', durationMinutes: 5 * 60 } as Task['time'] });
  const d = S().addTask({ name: 'D', time: { scheduleDuration: 5 } as Task['time'] });
  S().runCPM();
  return { u, d };
}
const task = (id: string): Task => S().tasks.find(t => t.id === id)!;
const rem = (t: Task) => ({ remainingMinutes: t.time.remainingMinutes, remainingTime: t.time.remainingTime });
const cell = (taskId: string, columnId: string, value: unknown): CellEditIntent =>
  ({ kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route: 'task-progress', value });

// De verwachte waarden: 5 u op 40 % ⇒ 180 min rest = 180/480 dag; 5 d op 30 % ⇒ round(3,5) = 4 d.
const HOUR_40 = { remainingMinutes: 180, remainingTime: 0.375 };
const DAY_30 = { remainingMinutes: undefined, remainingTime: 4 };

// ── 1. Paneel/taakdialoog (`setTaskProgress`) ────────────────────────────────────────────────
{
  const { u, d } = setup();
  S().setTaskProgress(u, 0.4);
  S().setTaskProgress(d, 0.3);
  eq('paneel: urentaak 5 u op 40 % houdt 3 u rest (minuten + werkdagfractie)', rem(task(u)), HOUR_40);
  eq('paneel: dagtaak 5 d op 30 % blijft hele werkdagen', rem(task(d)), DAY_30);
  // De solver plande altijd al met `durationMinutes × (1 − c)`: de opgeslagen restduur verzet niets.
  S().runCPM();
  eq('paneel: einde urentaak ongewijzigd (statusdatum 10:00 + 3 u)', task(u).time.earlyFinish, '2026-06-01T13:00');

  // Werkelijk einde ⇒ voltooid ⇒ restduur 0 in beide vormen.
  S().setActualFinish(u, '2026-06-01T10:00');
  eq('paneel: werkelijk einde ⇒ restduur 0', rem(task(u)), { remainingMinutes: 0, remainingTime: 0 });
  // Werkelijk einde wissen ⇒ weer lopend op 0 % ⇒ de volle duur resteert.
  S().setActualFinish(u, undefined);
  eq('paneel: werkelijk einde gewist ⇒ volle 5 u rest', rem(task(u)), { remainingMinutes: 300, remainingTime: 0.625 });
}

// ── 2. Raster (`runGridMutation`): voortgangscel en statuscel ─────────────────────────────────
{
  const { u, d } = setup();
  const r = runGridMutation([{ kind: 'paste', writes: [cell(u, 'task.time.completion', 0.4), cell(d, 'task.time.completion', 0.3)] }]);
  eq('raster: voortgang geaccepteerd', r.ok, true);
  eq('raster: urentaak 5 u op 40 %', rem(task(u)), HOUR_40);
  eq('raster: dagtaak 5 d op 30 %', rem(task(d)), DAY_30);
  const s = runGridMutation([{ kind: 'cell-edit', taskId: u, columnId: 'task.status' as CellEditIntent['columnId'], route: 'task-progress', value: 'NOT_STARTED' }]);
  eq('raster: status Niet gestart geaccepteerd', s.ok, true);
  eq('raster: niet gestart ⇒ volle 5 u rest', rem(task(u)), { remainingMinutes: 300, remainingTime: 0.625 });
  // Een ingevoerde restduur blijft exact wat de gebruiker typte (de invariant rekent eerst, de invoer wint).
  const e = runGridMutation([{ kind: 'cell-edit', taskId: u, columnId: 'task.time.remainingTime' as CellEditIntent['columnId'], route: 'task-progress', value: 100 }]);
  eq('raster: ingevoerde restduur 1 u 40 min geaccepteerd', e.ok, true);
  eq('raster: ingevoerde restduur blijft exact', rem(task(u)), { remainingMinutes: 100, remainingTime: 100 / 480 });
}

// ── 3. MCP (`planner_set_progress`-kern) ────────────────────────────────────────────────────
{
  setup();
  const draft = { tasks: structuredClone(S().tasks) } as unknown as Parameters<typeof progress.applyProgressUpdate>[0];
  const tasks = draft.tasks as Task[];
  const uT = tasks.find(t => t.name === 'U')!;
  const dT = tasks.find(t => t.name === 'D')!;
  eq('MCP: urentaak toegepast', progress.applyProgressUpdate(draft, uT.id, { completion: 40 }, STATUS_DATE).applied, true);
  eq('MCP: dagtaak toegepast', progress.applyProgressUpdate(draft, dT.id, { completion: 30 }, STATUS_DATE).applied, true);
  eq('MCP: urentaak 5 u op 40 %', rem(uT), HOUR_40);
  eq('MCP: dagtaak 5 d op 30 %', rem(dT), DAY_30);
}

// ── 4. Andere uren per dag: de werkdagfractie is minuten ÷ (uren/dag × 60), zonder afronding ──
{
  const { u } = setup(7.5);
  S().setTaskProgress(u, 0.4);
  const t = task(u);
  eq('7,5 u/dag: 180 min rest', t.time.remainingMinutes, 180);
  near('7,5 u/dag: werkdagfractie = 180 / 450', t.time.remainingTime, 180 / 450);
}

// ── 5. Lezers (`normalizeImportedProgress`): dezelfde regel, maar de restduur uit het bestand wint ─
{
  const base = (over: Partial<Task['time']>, unit: 'hours' | 'days'): Task => ({
    id: `t-${unit}-${Math.random()}`, name: 'X', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: unit, scheduleDuration: unit === 'hours' ? 2880 / 480 : 5,
      ...(unit === 'hours' ? { durationMinutes: 2880 } : {}),
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-08', earlyStart: '2026-06-01', earlyFinish: '2026-06-08',
      lateStart: '2026-06-01', lateFinish: '2026-06-08', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
      ...over,
    },
  });
  // T9: MSP's eigen restduur (25 u = 1500 min) bij een afgeronde 48 % blijft staan; de
  // werkdagfractie volgt die minuten (1500/480 = 3,125), niet de afgeronde voortgang.
  const recorded = base({ completion: 0.48, actualStart: '2026-06-01', remainingMinutes: 1500 }, 'hours');
  // Oud bestand zonder restduur-minuten (onze eigen export van vóór deze fix: 'P0Y0M0D').
  const legacy = base({ completion: 0.4, actualStart: '2026-06-01', remainingTime: 0 }, 'hours');
  const day = base({ completion: 0.3, actualStart: '2026-06-01', remainingTime: 2 }, 'days');
  const untouched = base({}, 'hours');
  normalizeImportedProgress([recorded, legacy, day, untouched], '2026-06-03');
  eq('lezer: vastgelegde restduur-minuten (T9) blijven staan', rem(recorded), { remainingMinutes: 1500, remainingTime: 3.125 });
  eq('lezer: urentaak zonder restduur-minuten krijgt ze afgeleid (40 % van 48 u)', rem(legacy), { remainingMinutes: 1728, remainingTime: 3.6 });
  eq('lezer: dagtaak houdt hele werkdagen (afgeleid uit %)', rem(day), DAY_30);
  eq('lezer: taak zonder voortgang blijft ongemoeid', rem(untouched), { remainingMinutes: undefined, remainingTime: undefined });
}

if (diffs.length === 0) {
  console.log(`OK  remaining-duration: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  remaining-duration: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
