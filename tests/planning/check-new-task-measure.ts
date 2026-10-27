/**
 * Standaardmaat voor nieuwe taken (spec "alleen uren" §3.2, besluit B1a; regel in
 * `src/state/newTaskMeasure.ts`).
 *
 *  - OPS-profiel: de gekozen maat; zonder veld de dagenmaat. Koos de planner de urenmaat, dan is een
 *    nieuwe taak 5 u (bestaand gedrag, `check-task-duration-unit.ts`).
 *  - P6 en MS Project (en elk profiel met `workdayDurationMeasure` uit): vast op urenmaat. Een nieuwe
 *    taak zonder eigen maat is 5 werkdagen in uren. Het veld blijft staan voor een wissel terug.
 *  - Vast werk (eigen regel of projectstandaard): altijd urenmaat, ook als de aanroeper dagen gaf.
 *  - Een aanroeper die zelf een maat geeft (plakken, MCP met `duration`), houdt die onder P6.
 * Routes: store `addTask`, de MCP-draft (`planner_add_tasks`) en de wizard (`createNewProject`).
 *
 * Voorbeeldweek (§0): ma–do 8 u, vr 6 u. 5 werkdagen vanaf ma 07:00 eindigen in de dagenmaat vr 14:00;
 * 40 u eindigen ma 09:00 (8+8+8+8+6 = 38, dan 2 u).
 */
import { makeMcpContext } from '../mcp/harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolResult } from '@/services/mcp/contracts';
import type { WorkCalendar } from '@/types/calendar';
import type { Project } from '@/types/project';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStoreFactory';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { defaultTaskMeasure, defaultTaskMeasureLocked } from '@/state/newTaskMeasure';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}

const WEEK: WorkCalendar = {
  id: 'cal-week', name: 'Voorbeeldweek', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: {
    byWeekday: {
      1: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      2: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      3: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      4: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      5: [{ start: 420, end: 720 }, { start: 780, end: 840 }],
      6: [], 7: [],
    },
  },
};
const MA = '2026-06-01';

function app(project: Partial<Project> = {}): AppStoreContext {
  const context = createAppStoreContext();
  context.store.setState(s => {
    Object.assign(s.project, { startDate: MA }, project);
    s.calendar = WEEK; s.calendars = [];
  });
  return context;
}
const timeOf = (c: AppStoreContext, id: string) => {
  const t = c.store.getState().tasks.find(x => x.id === id)!.time;
  return { unit: t.durationUnit, minutes: t.durationMinutes ?? null, days: t.scheduleDuration, finish: t.scheduleFinish };
};
const P6 = builtInProfile('p6');
const MSP = builtInProfile('msproject');
const DAYS_5 = { unit: 'days', minutes: null, days: 5, finish: '2026-06-05T14:00' };
const HOURS_40 = { unit: 'hours', minutes: 2400, days: 5, finish: '2026-06-08T09:00' };

// ── De regel zelf ───────────────────────────────────────────────────────────────
eq('r1 OPS zonder veld: dagenmaat, vrij te kiezen', [defaultTaskMeasure({}), defaultTaskMeasureLocked({})], ['days', false]);
eq('r2 OPS met urenmaat gekozen', defaultTaskMeasure({ defaultTaskDurationUnit: 'hours' }), 'hours');
eq('r3 P6 en MSP: vast op urenmaat, ook als het veld dagen zegt',
  [defaultTaskMeasure({ schedulingProfile: P6, defaultTaskDurationUnit: 'days' }), defaultTaskMeasure({ schedulingProfile: MSP }),
    defaultTaskMeasureLocked({ schedulingProfile: P6 })], ['hours', 'hours', true]);
eq('r4 eigen profiel op OPS-basis zonder dagenmaat: vast op urenmaat',
  defaultTaskMeasureLocked({ schedulingProfile: { ...builtInProfile('ops'), id: 'eigen', name: 'Eigen', overrides: { workdayDurationMeasure: false } } }), true);
eq('r5 eigen profiel op P6-basis met dagenmaat: vrij te kiezen',
  defaultTaskMeasure({ schedulingProfile: { ...P6, id: 'eigen-p6', name: 'Eigen P6', overrides: { workdayDurationMeasure: true } }, defaultTaskDurationUnit: 'days' }), 'days');

// ── Store addTask ────────────────────────────────────────────────────────────────
{
  const c = app();
  eq('s1 OPS: nieuwe taak 5 d dagenmaat', timeOf(c, c.store.getState().addTask({ name: 'a' })), DAYS_5);
}
{
  const c = app({ defaultTaskDurationUnit: 'hours' });
  eq('s2 OPS met gekozen urenmaat: 5 u (bestaand gedrag)', timeOf(c, c.store.getState().addTask({ name: 'a' })),
    { unit: 'hours', minutes: 300, days: 0.625, finish: '2026-06-01T12:00' });
}
for (const [label, profile] of [['P6', P6], ['MSP', MSP]] as const) {
  const c = app({ schedulingProfile: profile, defaultTaskDurationUnit: 'days' });
  eq(`s3 ${label}: nieuwe taak is 5 werkdagen in de urenmaat, einde start + 40 werkuren`, timeOf(c, c.store.getState().addTask({ name: 'a' })), HOURS_40);
  const m = c.store.getState().addTask({ name: 'm', isMilestone: true });
  eq(`s4 ${label}: een mijlpaal blijft 0 d`, [timeOf(c, m).unit, timeOf(c, m).days], ['days', 0]);
  const given = c.store.getState().addTask({ name: 'p', time: createDefaultTaskTime(`${MA}T07:00`, 3, 'days', WEEK) });
  eq(`s5 ${label}: een meegegeven dagenmaat blijft (het profiel telt haar als uren)`, [timeOf(c, given).unit, timeOf(c, given).days], ['days', 3]);
}
{
  const c = app({ schedulingProfile: P6, defaultTaskDurationUnit: 'hours' });
  c.store.getState().setProject({ schedulingProfile: undefined });
  eq('s6 terug naar OPS: de eigen keuze urenmaat geldt weer', [c.store.getState().project.defaultTaskDurationUnit, defaultTaskMeasure(c.store.getState().project)], ['hours', 'hours']);
}
{
  const c = app({ defaultWorkRule: 'FIXED_WORK' });
  eq('s7 projectstandaard vast werk: nieuwe taak is urenmaat (B1a)', timeOf(c, c.store.getState().addTask({ name: 'a' })), HOURS_40);
  const given = c.store.getState().addTask({ name: 'g', time: createDefaultTaskTime(`${MA}T07:00`, 3, 'days', WEEK) });
  eq('s8 projectstandaard vast werk: ook een meegegeven dagenmaat wordt urenmaat (3 d = 24 u)',
    timeOf(c, given), { unit: 'hours', minutes: 1440, days: 3, finish: '2026-06-03T16:00' });
}
{
  const c = app();
  const id = c.store.getState().addTask({ name: 'a', workRule: 'FIXED_WORK' });
  eq('s9 eigen regel vast werk: nieuwe taak is urenmaat (B1a)', timeOf(c, id), HOURS_40);
  const copy = c.store.getState().addTask({ name: 'b', workRule: 'FIXED_DURATION_WORK' });
  eq('s10 een andere regel volgt de standaardmaat', timeOf(c, copy), DAYS_5);
}

// ── MCP en wizard ──────────────────────────────────────────────────────────────
async function rest() {
  {
    const c = app({ schedulingProfile: P6 });
    const res = await getTool('planner_add_tasks')!.handler({ tasks: [
      { tempId: 'tmp-a', name: 'zonder duur' },
      { tempId: 'tmp-b', name: 'met duur', duration: 3 },
    ] }, makeMcpContext(c)) as McpToolResult;
    eq('m1 add_tasks onder P6 slaagt', res.ok, true);
    const created = res.ok ? (res.data as { created: Record<string, string> }).created : {};
    eq('m2 add_tasks onder P6 zonder duur: 5 werkdagen in de urenmaat', timeOf(c, created['tmp-a']), HOURS_40);
    eq('m3 add_tasks onder P6 met duur zonder maat: dagen als invoer, dagenmaat (§3.13)', [timeOf(c, created['tmp-b']).unit, timeOf(c, created['tmp-b']).days], ['days', 3]);
  }
  {
    const c = app();
    const res = await getTool('planner_add_tasks')!.handler({ tasks: [
      { tempId: 'tmp-a', name: 'vast werk', duration: 3, workRule: 'FIXED_WORK' },
      { tempId: 'tmp-b', name: 'gewoon' },
    ] }, makeMcpContext(c)) as McpToolResult;
    const created = res.ok ? (res.data as { created: Record<string, string> }).created : {};
    eq('m4 add_tasks met vast werk en 3 d: 24 u urenmaat (B1a), einde start + 24 werkuren',
      [res.ok, timeOf(c, created['tmp-a'])], [true, { unit: 'hours', minutes: 1440, days: 3, finish: '2026-06-03T16:00' }]);
    eq('m5 add_tasks onder OPS zonder duur: 5 d dagenmaat', timeOf(c, created['tmp-b']), DAYS_5);
  }
  {
    const c = app({ defaultTaskDurationUnit: 'hours' });
    const res = await getTool('planner_add_tasks')!.handler({ tasks: [{ tempId: 'tmp-a', name: 'a' }] }, makeMcpContext(c)) as McpToolResult;
    const created = res.ok ? (res.data as { created: Record<string, string> }).created : {};
    eq('m6 add_tasks volgt de gekozen urenmaat zoals de store (5 u)', timeOf(c, created['tmp-a']).minutes, 300);
  }
  for (const [label, profile, want] of [['OPS', undefined, DAYS_5], ['P6', P6, HOURS_40]] as const) {
    const c = createAppStoreContext();
    c.store.getState().createNewProject({ name: 'w', startDate: MA, calendar: WEEK, phaseNames: ['Fase 1'], schedulingProfile: profile });
    const id = c.store.getState().tasks[0].id;
    const t = timeOf(c, id);
    eq(`w1 wizard ${label}: fase krijgt de standaardmaat`, [t.unit, t.minutes, t.days], [want.unit, want.minutes, want.days]);
  }

  if (errors.length) { for (const e of errors) console.log(`XX ${e}`); process.exitCode = 1; }
  console.log(`standaardmaat nieuwe taken: ${checks - errors.length}/${checks} groen`);
}
void rest().catch(error => { console.error(error); process.exitCode = 1; });
