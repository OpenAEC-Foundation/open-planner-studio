// check-task-trigger-changes.ts — de ENE wijzigingsdetectie achter de gevolgregels van een
// taakbewerking: `sameValue` (src/utils/sameValue.ts, structurele gelijkheid) en
// `taskTriggerChanges` (taskDefaults.ts: welke trigger-relevante velden ECHT een andere waarde
// kregen). Puur, zonder store. Dat de schrijfroutes er daadwerkelijk op leunen, bewijst
// check-value-based-triggers.ts (store + taakraster) en tests/mcp/cases-waarde-triggers.ts (MCP).
//
// MOET de eerste import blijven: zie domStub.ts.
import './domStub';
import { sameValue } from '@/utils/sameValue';
import { createDefaultTaskTime, mergeTaskTime, taskTriggerChanges } from '@/utils/taskDefaults';
import type { Task, TaskTime } from '@/types/task';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

// ── sameValue ────────────────────────────────────────────────────────────────
console.log('-- task-trigger-changes: sameValue --');
eq('scalars gelijk', sameValue(5, 5), true);
eq('scalars ongelijk', sameValue(5, 7), false);
eq('NaN ≡ NaN', sameValue(Number.NaN, Number.NaN), true);
eq('undefined ≡ undefined', sameValue(undefined, undefined), true);
eq('undefined ≠ null', sameValue(undefined, null), false);
eq('0 ≠ "0"', sameValue(0, '0'), false);
eq('object met undefined-sleutel ≡ object zonder die sleutel', sameValue({ a: 1, b: undefined }, { a: 1 }), true);
eq('… ook andersom', sameValue({ a: 1 }, { a: 1, b: undefined }), true);
eq('sleutelvolgorde telt niet', sameValue({ type: 'SNET', date: '2026-07-01' }, { date: '2026-07-01', type: 'SNET' }), true);
eq('ontbrekende sleutel met waarde ≠', sameValue({ a: 1 }, { a: 1, b: 2 }), false);
eq('geneste wijziging telt', sameValue({ c: { d: [1, 2] } }, { c: { d: [1, 3] } }), false);
eq('arrays positioneel', sameValue([1, 2], [2, 1]), false);
eq('arrays gelijke lengte en inhoud', sameValue([{ a: 1 }], [{ a: 1, b: undefined }]), true);
eq('array ≠ object met dezelfde sleutels', sameValue([1], { 0: 1 }), false);
eq('object ≠ null', sameValue({}, null), false);

// ── taskTriggerChanges ───────────────────────────────────────────────────────
console.log('-- task-trigger-changes: taskTriggerChanges --');
const baseTime = createDefaultTaskTime('2026-06-01', 5);
const base = {
  time: baseTime,
  calendarId: 'kal-a',
  constraint: { type: 'SNET' as const, date: '2026-06-01' },
  constraint2: undefined,
} satisfies Pick<Task, 'time' | 'calendarId' | 'constraint' | 'constraint2'>;
const withTime = (time: Partial<TaskTime>) => ({ ...base, time: mergeTaskTime(base.time, time) });
const none = { timeBase: false, calendar: false, levelingGaps: false };

// De vorm van TaskDialog.handleSave: het volledige bestaande time-object, `durationMinutes:
// undefined` bij een dagtaak, en dezelfde top-level velden (verse objectkopieën).
eq('volledige ongewijzigde time + kopieën van calendarId/constraint ⇒ niets',
  taskTriggerChanges(base, {
    ...withTime({ ...baseTime, durationMinutes: undefined, scheduleDuration: baseTime.scheduleDuration }),
    calendarId: 'kal-a',
    constraint: { date: '2026-06-01', type: 'SNET' },
    constraint2: undefined,
  }),
  none);
eq('duur 5 → 7 ⇒ tijdbasis + nivelleergaten', taskTriggerChanges(base, withTime({ scheduleDuration: 7 })),
  { timeBase: true, calendar: false, levelingGaps: true });
eq('scheduleStart gewijzigd ⇒ tijdbasis', taskTriggerChanges(base, withTime({ scheduleStart: '2026-06-02' })).timeBase, true);
eq('durationType gewijzigd ⇒ tijdbasis', taskTriggerChanges(base, withTime({ durationType: 'ELAPSEDTIME' })).timeBase, true);
eq('eenheid dagen → uren ⇒ tijdbasis',
  taskTriggerChanges(base, withTime({ durationUnit: 'hours', durationMinutes: 5 * 480 })).timeBase, true);
eq('voortgang (completion) ⇒ alleen nivelleergaten', taskTriggerChanges(base, withTime({ completion: 0.5 })),
  { timeBase: false, calendar: false, levelingGaps: true });
eq('actualStart gezet ⇒ alleen nivelleergaten', taskTriggerChanges(base, withTime({ actualStart: '2026-06-01' })),
  { timeBase: false, calendar: false, levelingGaps: true });
eq('calendarId gewijzigd ⇒ kalender + nivelleergaten', taskTriggerChanges(base, { ...base, calendarId: 'kal-b' }),
  { timeBase: false, calendar: true, levelingGaps: true });
eq('calendarId gewist ⇒ kalender', taskTriggerChanges(base, { ...base, calendarId: undefined }).calendar, true);
eq('constraint-datum gewijzigd ⇒ alleen nivelleergaten',
  taskTriggerChanges(base, { ...base, constraint: { type: 'SNET', date: '2026-06-03' } }),
  { timeBase: false, calendar: false, levelingGaps: true });
eq('constraint2 gezet ⇒ alleen nivelleergaten',
  taskTriggerChanges(base, { ...base, constraint2: { type: 'FNLT', date: '2026-06-30' } }).levelingGaps, true);
eq('een CPM-uitvoerveld (earlyStart) is geen trigger',
  taskTriggerChanges(base, withTime({ earlyStart: '2026-06-09', totalFloat: 3 })), none);
// Een oude taak zonder `durationUnit`-sleutel: `mergeTaskTime` vult de afgeleide eenheid in, en
// dezelfde effectieve eenheid is geen wijziging.
{
  const { durationUnit: _dropped, ...legacyTime } = baseTime;
  const legacy = { ...base, time: legacyTime as TaskTime };
  eq('legacy-taak zonder durationUnit: afgeleide eenheid invullen is geen wijziging',
    taskTriggerChanges(legacy, { ...legacy, time: mergeTaskTime(legacy.time, { completion: 0 }) }), none);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  task-trigger-changes: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  task-trigger-changes: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
