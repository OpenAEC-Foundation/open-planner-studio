/**
 * Restduur en restwerk bij een duurwijziging (eigenaarsbesluit 2026-10-19, optie 2; spec
 * `docs/superpowers/specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md` §3.5).
 *
 * De fout op main: de restduur van een NIET-gestarte taak volgde een duurbewerking niet. Een uit het
 * bestand gelezen restveld bleef op de oude duur staan, `settleDurationEdit` zag geen wijziging en
 * de toewijzingen bleven ongemoeid. Gevolgen: *Resterend* ≠ duur, een spookdeel "verricht" in het
 * histogram, een werkelijke start op 0 % die het restwerk alsnog liet springen (320 → 352 u), en
 * onder Vast werk een inzet die niet volgde.
 *
 * Het besluit: bij een duurwijziging volgt de app de regel van de taak, zoals P6, zonder vraag.
 * Werk volgt de duur (FIXED_DURATION_RATE) ⇒ restwerk = inzet × nieuwe restduur, óók als het
 * restwerk uit het bestand kwam en afweek; werkbeschermend (FIXED_WORK, FIXED_DURATION_WORK) ⇒ het
 * werk blijft en de inzet volgt. Verdwijnt daarbij een bewaard, afwijkend restwerk, dan volgt één
 * melding per transactie; Ctrl+Z zet het in één stap terug. Nooit iets bij openen of herberekenen.
 *
 * De fixture bootst Harbour Point DCP-03 Baseline Rev 0, taak E-1010, na (TT_Task, DT_FixedDrtn,
 * TK_NotStart, 80 h; Design Engineer target/remain 320 h bij 1/h, resttempo 0). Geen corpusbestand
 * in de repo. Daarnaast een Roads-achtige taak zonder toewijzingen (A15131), een gestarte taak,
 * Vast werk, Vaste duur en werk, een gewone dagtaak, splitsen, raster, MCP en IFC heen en terug.
 */
import './domStub';
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import { draft, runInMcpTransaction } from '@/state/mcpTransaction';
import { readXER } from '@/services/xer/xerReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readXerArchiveIFC } from './xerArchiveTestReader';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import fs from 'node:fs';
import path from 'node:path';
import { assignmentWorkDeviation, workDeviationEffectKey } from '@/engine/work/assignmentWorkDeviation';
import { captureTriangle, remainingMinutesOf, settleDurationEdit, totalMinutesOf } from '@/engine/work/workRuleApply';
import { workDaySlotsToPeriods } from '@/engine/contour/contourEdit';
import { assignmentDayUnits } from '@/engine/scheduler/ResourceLoad';
import { createDefaultTaskTime, taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import type { CellEditIntent } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function ok(label: string, cond: unknown): void {
  checks++;
  if (!cond) diffs.push(label);
}
const r4 = (n: number | undefined) => (n === undefined ? undefined : Math.round(n * 10000) / 10000);

// ── De fixture ───────────────────────────────────────────────────────────────────────────────────
const day = '(0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())';
const weekBands = `(0||DaysOfWeek()((0||1()())(0||2()(${day}))(0||3()(${day}))(0||4()(${day}))(0||5()(${day}))(0||6()(${day}))(0||7()())))`;
const calendarData = `(0||CalendarData()(${weekBands}(0||Exceptions()())))`;
const TASK_FIELDS = 'task_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date';
const taskRow = (id: string, code: string, name: string, durationType: string, status: string, pct: string, target: string, remain: string, actStart = '') =>
  `%R\t${id}\tP1\tC1\t${code}\t${name}\tTT_Task\t${durationType}\t${status}\tCP_Phys\t${pct}\t${target}\t${remain}\t2024-01-09 08:00\t2024-01-22 17:00\t${actStart}\t`;
const xer = [
  'ERMHDR\t23.12\t2024-01-08\t\t\t\t\t\tGBP',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tdef_duration_type\tlast_recalc_date',
  '%R\tP1\tHP-DCP03-BL\tC1\tDT_FixedDrtn\t2024-01-15 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\t5-Day Office / Design Week\tP1\tCA_Project\t8\t40\t${calendarData}`,
  '%T\tTASK',
  `%F\t${TASK_FIELDS}`,
  // E-1010 zoals in DCP-03: niet gestart, 80 h, rest 80 h.
  taskRow('6001', 'E-1010', 'Mobilise Design Team', 'DT_FixedDrtn', 'TK_NotStart', '0', '80', '80'),
  // Tweede afwijkende taak, voor plakken in meer rijen.
  taskRow('6002', 'E-1020', 'Concept Design', 'DT_FixedDrtn', 'TK_NotStart', '0', '40', '40'),
  // Werkbeschermend: Vast werk en Vaste duur en werk.
  taskRow('6003', 'E-1030', 'Vast werk', 'DT_FixedQty', 'TK_NotStart', '0', '80', '80'),
  taskRow('6004', 'E-1040', 'Vaste duur en werk', 'DT_FixedDUR2', 'TK_NotStart', '0', '80', '80'),
  // Roads A15131: geen toewijzingen.
  taskRow('6005', 'A15131', 'Roads zonder toewijzing', 'DT_FixedDrtn', 'TK_NotStart', '0', '60', '60'),
  // Gestart op 50 %: rest 40 h, restwerk 320 h (wijkt af van 1 × 40 h).
  taskRow('6006', 'E-1050', 'Gestart', 'DT_FixedDrtn', 'TK_Active', '50', '80', '40', '2024-01-09 08:00'),
  // Controle: restwerk = inzet × restduur (80 h), dus geen melding.
  taskRow('6007', 'E-1060', 'Klopt al', 'DT_FixedDrtn', 'TK_NotStart', '0', '80', '80'),
  // Vaste inzet (DT_FixedRate): restwerk volgt inzet × restduur, net als vaste duur en inzet.
  taskRow('6008', 'E-1070', 'Vaste inzet', 'DT_FixedRate', 'TK_NotStart', '0', '80', '80'),
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr\tunit_id',
  '%R\t4500\tDesign Engineer\tRT_Labor\tC1\t1\t',
  '%R\t4501\tDesign Engineer 2\tRT_Labor\tC1\t1\t',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trsrc_type\ttarget_qty_per_hr\tremain_qty_per_hr\tremain_qty\ttarget_qty\tact_reg_qty\tact_ot_qty',
  '%R\t7500\tP1\t6001\t4500\tRT_Labor\t1\t0\t320\t320\t0\t0',
  '%R\t7501\tP1\t6002\t4501\tRT_Labor\t1\t0\t160\t160\t0\t0',
  '%R\t7502\tP1\t6003\t4500\tRT_Labor\t1\t0\t320\t320\t0\t0',
  '%R\t7503\tP1\t6004\t4500\tRT_Labor\t1\t0\t320\t320\t0\t0',
  '%R\t7504\tP1\t6006\t4500\tRT_Labor\t1\t0\t320\t320\t0\t0',
  '%R\t7505\tP1\t6007\t4500\tRT_Labor\t1\t0\t80\t80\t0\t0',
  '%R\t7506\tP1\t6008\t4500\tRT_Labor\t1\t0\t320\t320\t0\t0',
  '%E',
].join('\n');

const S = () => useAppStore.getState();
const OPEN_OPTIONS = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
function openFixture(): void {
  const opened = readXER(new TextEncoder().encode(xer));
  if (isMultiDocumentImport(opened)) throw new Error('fixture gaf meerdere documenten');
  S().applyOpenedImport(opened, OPEN_OPTIONS);
  useAppStore.setState((s) => { s.ui.notifications = []; });
}
const byCode = (code: string): Task => {
  const t = S().tasks.find((x) => x.wbsCode === code);
  if (!t) throw new Error(`taak ${code} ontbreekt`);
  return t;
};
const asg = (sourceId: string): ResourceAssignment => {
  const a = S().assignments.find((x) => x.id === `xer-assignment:${sourceId}`);
  if (!a) throw new Error(`toewijzing ${sourceId} ontbreekt`);
  return a;
};
const H = 60;
const hpdOf = (t: Task) => taskCalendarHoursPerDay(t, S().calendars, S().calendar);
const deviationOf = (code: string, sourceId: string) => {
  const t = byCode(code);
  const a = asg(sourceId);
  return assignmentWorkDeviation(t, a.unitsPerDay, a.remainingWorkMinutes, hpdOf(t), false);
};
const notices = () => S().ui.notifications.map((n) => ({ key: n.messageKey, params: n.params, numberParams: n.numberParams }));
const workNotices = () => notices().filter((n) => n.key.startsWith('notifications.remainingWorkRecomputed'));
const setHours = (code: string, hours: number, opts?: { coalesceKey?: string }) => {
  const t = byCode(code);
  S().updateTask(t.id, { time: { ...t.time, durationMinutes: hours * H } }, opts);
};

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a) bij openen en herberekenen verandert er niets --');
openFixture();
{
  const t = byCode('E-1010');
  eq('a1 voorwaarde: E-1010 uurtaak 80 h, rest 80 h, vaste duur en inzet', [t.time.durationUnit, t.time.durationMinutes, t.time.remainingMinutes, t.workRule], ['hours', 80 * H, 80 * H, 'FIXED_DURATION_RATE']);
  eq('a2 voorwaarde: Design Engineer inzet 1, restwerk 320 h (bewaard)', [asg('7500').unitsPerDay, asg('7500').remainingWorkMinutes], [1, 320 * H]);
  eq('a3 het waarschuwingsteken staat (320 / 80)', deviationOf('E-1010', '7500'), { stored: 320, derived: 80 });
  S().runCPM();
  eq('a4 herberekenen laat restwerk en rest staan', [asg('7500').remainingWorkMinutes, byCode('E-1010').time.remainingMinutes], [320 * H, 80 * H]);
  eq('a5 …en meldt niets', workNotices(), []);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (b) E-1010 in het paneel: 80 → 72 h onder vaste duur en inzet --');
openFixture();
{
  const events0 = S().historyEvents.length;
  setHours('E-1010', 72);
  const t = byCode('E-1010');
  eq('b1 duur 72 h, rest volgt: 72 h', [t.time.durationMinutes, t.time.remainingMinutes], [72 * H, 72 * H]);
  eq('b2 restwerk = inzet × nieuwe restduur = 72 h, inzet blijft 1', [asg('7500').remainingWorkMinutes, asg('7500').unitsPerDay], [72 * H, 1]);
  eq('b3 het waarschuwingsteken is weg', deviationOf('E-1010', '7500'), null);
  eq('b4 één melding met naam en oud → nieuw in uren', workNotices(), [{
    key: 'notifications.remainingWorkRecomputed', params: { name: 'Mobilise Design Team' }, numberParams: { before: 320, after: 72 },
  }]);
  eq('b5 één undo-stap', S().historyEvents.length - events0, 1);
  S().undo();
  const back = byCode('E-1010');
  eq('b6 Ctrl+Z: duur, rest en restwerk in één stap terug', [back.time.durationMinutes, back.time.remainingMinutes, asg('7500').remainingWorkMinutes], [80 * H, 80 * H, 320 * H]);
  eq('b7 …en het waarschuwingsteken staat weer', deviationOf('E-1010', '7500'), { stored: 320, derived: 80 });
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (c) E-1010: 80 → 88 h, daarna werkelijke start op 0 % en het histogram --');
openFixture();
{
  setHours('E-1010', 88);
  const t = byCode('E-1010');
  eq('c1 rest 88 h, restwerk 88 h', [t.time.remainingMinutes, asg('7500').remainingWorkMinutes], [88 * H, 88 * H]);
  const ctx = { hoursPerDay: hpdOf(t) };
  eq('c2 (vervolgfout b) geen spookdeel verricht: rest = totaal', totalMinutesOf(t, ctx) - remainingMinutesOf(t, ctx), 0);
  const slot = hpdOf(t) * H;
  const load = assignmentDayUnits(t, asg('7500'), slot, null, [asg('7500')]);
  ok(`c3 (vervolgfout b) histogram telt precies het restwerk, 88 h (kreeg ${r4(load.reduce((n, x) => n + x, 0) * slot / H)} h)`,
    Math.abs(load.reduce((n, x) => n + x, 0) * slot - 88 * H) < 1e-6);
  S().setProject({ statusDate: '2024-01-15' });
  useAppStore.setState((s) => { s.ui.notifications = []; });
  eq('c4 werkelijke start zetten slaagt', S().setActualStart(t.id, '2024-01-09T08:00'), true);
  eq('c5 (vervolgfout a) werkelijke start op 0 % laat het restwerk staan (geen 352 h)', asg('7500').remainingWorkMinutes, 88 * H);
  eq('c6 …en meldt niets over restwerk', workNotices(), []);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (d) werkbeschermend: Vast werk en Vaste duur en werk --');
openFixture();
{
  setHours('E-1030', 72);
  eq('d1 (vervolgfout c) Vast werk: rest volgt (72 h)', byCode('E-1030').time.remainingMinutes, 72 * H);
  eq('d2 Vast werk: restwerk blijft 320 h, inzet volgt (320 / 72)', [asg('7502').remainingWorkMinutes, asg('7502').unitsPerDay], [320 * H, 320 / 72]);
  eq('d3 Vast werk: geen melding (het bewaarde werk bleef)', workNotices(), []);
  eq('d4 Vast werk: geen waarschuwingsteken meer', deviationOf('E-1030', '7502'), null);
  setHours('E-1040', 64);
  eq('d5 Vaste duur en werk: rest 64 h, restwerk blijft 320 h, inzet 5', [byCode('E-1040').time.remainingMinutes, asg('7503').remainingWorkMinutes, asg('7503').unitsPerDay], [64 * H, 320 * H, 5]);
  eq('d6 Vaste duur en werk: geen melding', workNotices(), []);
  eq('d7 voorwaarde: E-1070 is vaste inzet met een bewaard restwerk van 320 h', [byCode('E-1070').workRule, asg('7506').remainingWorkMinutes], ['FIXED_RATE', 320 * H]);
  setHours('E-1070', 72);
  eq('d8 Vaste inzet: rest 72 h, restwerk = inzet × nieuwe restduur = 72 h, inzet blijft 1', [byCode('E-1070').time.remainingMinutes, asg('7506').remainingWorkMinutes, asg('7506').unitsPerDay], [72 * H, 72 * H, 1]);
  eq('d9 Vaste inzet: één melding 320 → 72 h', workNotices().map((n) => [n.key, n.numberParams]), [['notifications.remainingWorkRecomputed', { before: 320, after: 72 }]]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (e) Roads A15131 zonder toewijzingen, en een restwerk dat al klopte --');
openFixture();
{
  setHours('A15131', 70);
  eq('e1 Roads: 60 → 70 h, rest volgt', [byCode('A15131').time.durationMinutes, byCode('A15131').time.remainingMinutes], [70 * H, 70 * H]);
  eq('e2 Roads: geen melding', workNotices(), []);
  // De lezer bewaart een restwerk dat gelijk is aan inzet × restduur niet ("afwezig ⇒ afgeleid");
  // zet het hier zoals een eerdere werkbewerking het vastlegt, zodat er een bewaard maar kloppend veld staat.
  eq('e3 voorwaarde: kloppend restwerk komt uit de lezer als afgeleid', asg('7505').remainingWorkMinutes, undefined);
  useAppStore.setState((s) => { s.assignments.find((x) => x.id === 'xer-assignment:7505')!.remainingWorkMinutes = 80 * H; });
  setHours('E-1060', 90);
  eq('e4 bewaard restwerk dat klopte volgt de duur (90 h) zonder melding', [asg('7505').remainingWorkMinutes, workNotices()], [90 * H, []]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (f) gestarte taak: rest schuift mee, afwijkend restwerk wordt herrekend en gemeld --');
openFixture();
{
  const t0 = byCode('E-1050');
  eq('f0 voorwaarde: 50 %, rest 40 h, restwerk 320 h', [t0.time.completion, t0.time.remainingMinutes, asg('7504').remainingWorkMinutes], [0.5, 40 * H, 320 * H]);
  setHours('E-1050', 88);
  eq('f1 rest 40 + 8 = 48 h', byCode('E-1050').time.remainingMinutes, 48 * H);
  eq('f2 restwerk = 1 × 48 h', asg('7504').remainingWorkMinutes, 48 * H);
  eq('f3 één melding 320 → 48', workNotices().map((n) => n.numberParams), [{ before: 320, after: 48 }]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (g) Gantt-sleep: drie stappen met één coalesceKey ⇒ één melding met de eindwaarde, één undo-stap --');
openFixture();
{
  const events0 = S().historyEvents.length;
  setHours('E-1010', 84, { coalesceKey: 'sleep-1' });
  setHours('E-1010', 88, { coalesceKey: 'sleep-1' });
  setHours('E-1010', 92, { coalesceKey: 'sleep-1' });
  eq('g1 restwerk volgt tot 92 h', asg('7500').remainingWorkMinutes, 92 * H);
  // Alleen de eerste stap ziet een afwijkend restwerk; de melding toont toch de eindwaarde, met het
  // "vóór" dat Ctrl+Z terugzet (review #380, V1).
  eq('g2 één melding met de eindwaarde: 320 → 92 h', workNotices().map((n) => n.numberParams), [{ before: 320, after: 92 }]);
  eq('g2b dezelfde melding bijgewerkt, geen teller', S().ui.notifications.filter((n) => n.messageKey.startsWith('notifications.remainingWorkRecomputed')).map((n) => n.count), [1]);
  eq('g3 één undo-stap', S().historyEvents.length - events0, 1);
  S().undo();
  eq('g4 undo: terug naar 80 h en 320 h', [byCode('E-1010').time.durationMinutes, asg('7500').remainingWorkMinutes], [80 * H, 320 * H]);
  // Een nieuw gebaar met dezelfde sleutel ná de undo is een nieuwe undo-stap: geen oude items mee.
  useAppStore.setState((s) => { s.ui.notifications = []; });
  setHours('E-1010', 72, { coalesceKey: 'sleep-1' });
  eq('g5 na undo: nieuwe melding 320 → 72 h', workNotices().map((n) => n.numberParams), [{ before: 320, after: 72 }]);
  // Een ander event ertussen (een gewone bewerking van een andere taak) breekt de reeks af.
  setHours('E-1060', 81);
  useAppStore.setState((s) => { s.ui.notifications = []; });
  setHours('E-1010', 64, { coalesceKey: 'sleep-1' });
  eq('g6 andere bewerking ertussen: geen melding meer (72 h klopte al)', workNotices(), []);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (h) taakraster: één cel, en twee rijen in één transactie --');
openFixture();
{
  const cell = (code: string, hours: number): CellEditIntent => ({
    kind: 'cell-edit', taskId: byCode(code).id, columnId: 'task.time.scheduleDuration' as CellEditIntent['columnId'],
    route: 'task-schedule', value: { unit: 'hours', durationMinutes: hours * H, explicitUnit: false },
  });
  const res = runGridMutation([cell('E-1010', 72)]);
  eq('h1 rastercel 80 → 72 h slaagt', res.ok, true);
  eq('h2 rest en restwerk 72 h', [byCode('E-1010').time.remainingMinutes, asg('7500').remainingWorkMinutes], [72 * H, 72 * H]);
  eq('h3 één melding met naam', workNotices(), [{
    key: 'notifications.remainingWorkRecomputed', params: { name: 'Mobilise Design Team' }, numberParams: { before: 320, after: 72 },
  }]);
  S().undo();
  eq('h4 undo zet 320 h terug', asg('7500').remainingWorkMinutes, 320 * H);
  useAppStore.setState((s) => { s.ui.notifications = []; });
  const res2 = runGridMutation([cell('E-1010', 72), cell('E-1020', 36)]);
  eq('h5 twee rijen in één transactie slagen', res2.ok, true);
  eq('h6 beide herrekend', [asg('7500').remainingWorkMinutes, asg('7501').remainingWorkMinutes], [72 * H, 36 * H]);
  eq('h7 één melding met het aantal taken', workNotices(), [{
    key: 'notifications.remainingWorkRecomputedMany', params: { count: 2 }, numberParams: undefined,
  }]);
  S().undo();
  eq('h8 één undo zet beide terug', [asg('7500').remainingWorkMinutes, asg('7501').remainingWorkMinutes], [320 * H, 160 * H]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (i) MCP: geen vraag, het resultaat noemt het herschreven restwerk --');
openFixture();
{
  const id = byCode('E-1010').id;
  const res = runInMcpTransaction(() => { draft.patchTaskFields(id, {}, { durationMinutes: 72 * H, scheduleDuration: 9 }); });
  ok('i1 transactie slaagt', res.ok);
  eq('i2 rest en restwerk 72 h', [byCode('E-1010').time.remainingMinutes, asg('7500').remainingWorkMinutes], [72 * H, 72 * H]);
  eq('i3 het resultaat noemt het herschreven restwerk',
    res.ok ? res.remainingWorkRecomputed.map((r) => [r.taskId, r.assignmentId, r.beforeMinutes, r.afterMinutes]) : null,
    [[id, 'xer-assignment:7500', 320 * H, 72 * H]]);
  eq('i4 en de app meldt het één keer', workNotices().map((n) => n.numberParams), [{ before: 320, after: 72 }]);
  S().undo();
  eq('i5 undo zet 320 h terug', asg('7500').remainingWorkMinutes, 320 * H);
  useAppStore.setState((s) => { s.ui.notifications = []; });
  const geen = runInMcpTransaction(() => { draft.patchTaskFields(byCode('A15131').id, {}, { durationMinutes: 70 * H, scheduleDuration: 70 / 8 }); });
  eq('i6 zonder afwijkend restwerk: lege lijst en geen melding', [geen.ok ? geen.remainingWorkRecomputed : null, workNotices()], [[], []]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (j) splitsen verandert de werkduur: zelfde regel --');
openFixture();
{
  const id = byCode('E-1010').id;
  const refusal = S().setTaskSplits(id, [{ kind: 'work', minutes: 40 * H }, { kind: 'gap', minutes: 8 * H }, { kind: 'work', minutes: 48 * H }]);
  eq('j1 split slaagt', refusal, null);
  eq('j2 duur 88 h, rest volgt', [byCode('E-1010').time.durationMinutes, byCode('E-1010').time.remainingMinutes], [88 * H, 88 * H]);
  eq('j3 restwerk 88 h en één melding', [asg('7500').remainingWorkMinutes, workNotices().length], [88 * H, 1]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (k) IFC opslaan en heropenen houdt de nieuwe rest en het nieuwe restwerk --');
openFixture();
{
  setHours('E-1010', 88);
  const ifc = writeIFC(buildWriteIFCInput(S()));
  // Opslaan zoals de app (`buildWriteIFCInput`, met het XER-bronarchief) en heropenen met de
  // archiefreconstructie die productie ook gebruikt.
  const back: ImportResult = readXerArchiveIFC(ifc);
  const t = back.tasks.find((x) => x.wbsCode === 'E-1010')!;
  const a = back.assignments.find((x) => x.taskId === t.id)!;
  eq('k1 duur en rest 88 h na heropenen', [t.time.durationMinutes, t.time.remainingMinutes], [88 * H, 88 * H]);
  eq('k2 restwerk 88 h na heropenen', a.remainingWorkMinutes, 88 * H);
  const hpd = taskCalendarHoursPerDay(t, back.resourceCalendars ?? [], back.calendar);
  eq('k3 geen waarschuwingsteken na heropenen', assignmentWorkDeviation(t, a.unitsPerDay, a.remainingWorkMinutes, hpd, false), null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (l) dagtaak: rest volgt, afwijkend restwerk wordt herrekend --');
{
  S().newProject();
  useAppStore.setState((s) => { s.ui.notifications = []; });
  const slot = S().calendar.hoursPerDay * H;
  const t = S().addTask({ name: 'Dagtaak', time: createDefaultTaskTime('2026-06-01', 10) });
  const r = S().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(t, r, 1);
  // Zoals na een import: een expliciete restduur en een bewaard, afwijkend restwerk.
  useAppStore.setState((s) => {
    s.tasks.find((x) => x.id === t)!.time.remainingTime = 10;
    s.assignments.find((a) => a.taskId === t)!.remainingWorkMinutes = 40 * H;
  });
  S().runCPM();
  const cur = S().tasks.find((x) => x.id === t)!;
  S().updateTask(t, { time: { ...cur.time, scheduleDuration: 11 } });
  const after = S().tasks.find((x) => x.id === t)!;
  const a = S().assignments.find((x) => x.taskId === t)!;
  eq('l1 dagtaak 10 → 11 d: rest volgt', [after.time.scheduleDuration, after.time.remainingTime], [11, 11]);
  eq('l2 restwerk = 1 × 11 d', a.remainingWorkMinutes, 11 * slot);
  eq('l3 één melding 40 → 88 h', workNotices().map((n) => n.numberParams), [{ before: 40, after: 11 * slot / H }]);
  S().undo();
  eq('l4 undo zet rest en restwerk terug', [S().tasks.find((x) => x.id === t)!.time.remainingTime, S().assignments.find((x) => x.taskId === t)!.remainingWorkMinutes], [10, 40 * H]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (m) randen: een opgegeven rest wint, voortgang alleen is geen duurbewerking --');
openFixture();
{
  const t = byCode('A15131');
  S().updateTask(t.id, { time: { ...t.time, durationMinutes: 70 * H, remainingMinutes: 50 * H } });
  eq('m1 duur én rest in één patch: de opgegeven rest wint', byCode('A15131').time.remainingMinutes, 50 * H);
  const e = byCode('E-1010');
  S().updateTask(e.id, { time: { ...e.time, completion: 0.25 } });
  eq('m2 alleen voortgang: geen melding over restwerk', workNotices(), []);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (n) contract: de restregel van settleDurationEdit raakt alleen niet-gestarte taken --');
openFixture();
{
  // Een gestarte taak krijgt haar nieuwe rest van `carryRemainingThroughDurationEdit`, vóór deze stap.
  // Roept een route `settleDurationEdit` aan zonder die stap, dan zet de restregel hier niets
  // (geen rest = duur × (1 − %), dat zou het gedane werk verschuiven).
  const t = byCode('E-1050');
  useAppStore.setState((s) => {
    const d = s.tasks.find((x) => x.id === t.id)!;
    // Momentopname in dezelfde draft: de settle schrijft in de toewijzingen uit de momentopname.
    const captured = captureTriangle(d, s.assignments, s);
    d.time.durationMinutes = 88 * H;
    d.time.scheduleDuration = 11;
    settleDurationEdit(d, captured);
  });
  eq('n1 gestarte taak zonder meeschuifstap: de restregel laat de rest staan (40 h)', byCode('E-1050').time.remainingMinutes, 40 * H);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (o) een toewijzing met eigen urenverdeling telt niet mee voor de melding --');
openFixture();
{
  // Hetzelfde criterium als het waarschuwingsteken: met een contour vormt die de inzet per dag zelf.
  const t = byCode('E-1010');
  S().setAssignmentContour(asg('7500').id, workDaySlotsToPeriods(Array.from({ length: 10 }, () => 32 * H), t.splitGaps, 8 * H));
  useAppStore.setState((s) => { s.ui.notifications = []; });
  eq('o0 voorwaarde: restwerk = de contoursom, 320 h', asg('7500').remainingWorkMinutes, 320 * H);
  setHours('E-1010', 72);
  eq('o1 duur 80 → 72 h met contour: geen melding', workNotices(), []);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (p) tabel: ⚠ in de kolom Resterend werk (eigenaarsbesluit 2026-10-19, optie 1) --');
{
  // De echte rasteradapter met de kolom `assignment.remainingWork`. De tekst komt uit een stub die
  // sleutel en waarden teruggeeft, zodat de check ziet WELKE uitleg met WELKE getallen er staat.
  const warningOf = (code: string) => {
    const s = S();
    const adapter = createTaskGridAdapter({
      projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
      assignments: s.assignments, resources: s.resources, baselines: s.baselines,
      activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
      scheduleStale: s.scheduleStale, wbsAutoNumber: false, taskTypesUnlocked: true,
      effectiveHoursPerDay: (t) => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
      labelForColumn: (k) => k,
      labelForText: (k, v) => (k.startsWith('properties.assignments.') ? `${k.slice('properties.assignments.'.length)}${JSON.stringify(v ?? {})}` : k),
      numberLocale: 'nl', surfaceId: 'full-task-grid', rows: s.viewRows, selectedTaskIds: [],
    });
    const row = s.viewRows.find((r) => r.kind === 'task' && r.task.id === byCode(code).id)!;
    return adapter.getCell(row.rowKey, taskColumnId('assignment.remainingWork'))?.warning ?? null;
  };
  openFixture();
  eq('p1 E-1010 (320 h op 80 h, één toewijzing): ⚠ met de uitleg van het paneel',
    warningOf('E-1010'), { kind: 'remaining-work-deviates', text: 'workDeviatesHint{"stored":320,"derived":80,"durationEffect":"workDeviatesFollowsDuration{}"}' });
  eq('p2 E-1060 (restwerk klopt): geen ⚠', warningOf('E-1060'), null);
  eq('p3 Roads A15131 (geen toewijzing): geen ⚠', warningOf('A15131'), null);
  setHours('E-1010', 72);
  eq('p4 na een duurwijziging rekent de app het restwerk uit: ⚠ weg', warningOf('E-1010'), null);
  S().undo();
  eq('p5 na Ctrl+Z: ⚠ terug', warningOf('E-1010'), { kind: 'remaining-work-deviates', text: 'workDeviatesHint{"stored":320,"derived":80,"durationEffect":"workDeviatesFollowsDuration{}"}' });

  // Twee toewijzingen, één wijkt af: één ⚠ met per afwijkende toewijzing naam en getallen.
  const e1020 = byCode('E-1020');
  S().assignResource(e1020.id, asg('7500').resourceId, 1);
  eq('p6 E-1020 met twee toewijzingen (Design Engineer 2 wijkt af): één ⚠, naam en getallen',
    warningOf('E-1020'), {
      kind: 'remaining-work-deviates',
      text: `workDeviatesMany${JSON.stringify({
        lines: `workDeviatesLine${JSON.stringify({ name: 'Design Engineer 2', stored: 160, derived: 40 })}`,
        durationEffect: 'workDeviatesFollowsDuration{}',
      })}`,
    });

  // Contour: die vormt de inzet per dag zelf — dezelfde uitzondering als het paneel.
  openFixture();
  const t = byCode('E-1010');
  S().setAssignmentContour(asg('7500').id, workDaySlotsToPeriods(Array.from({ length: 10 }, () => 32 * H), t.splitGaps, 8 * H));
  eq('p7 voorwaarde: restwerk 320 h op 80 h, nu met contour', [asg('7500').remainingWorkMinutes, byCode('E-1010').time.remainingMinutes], [320 * H, 80 * H]);
  eq('p8 met contour: geen ⚠ (zoals het paneel)', warningOf('E-1010'), null);

  // Materiaal telt niet mee (het paneel toont daar "—").
  openFixture();
  const engineer = asg('7500').resourceId;
  useAppStore.setState((s) => { s.resources.find((r) => r.id === engineer)!.type = 'MATERIAL'; });
  eq('p9 materiaal met afwijkend restwerk: geen ⚠', warningOf('E-1010'), null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (q) besluit V10: de slotzin van de uitleg volgt de regel, in tabel en paneel gelijk --');
{
  // De ECHTE Nederlandse tekst (src/i18n/locales/nl/task.json), met dezelfde {{…}}-invulling als i18next.
  const nlTask = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/i18n/locales/nl/task.json'), 'utf8')) as Record<string, unknown>;
  const nlText = (key: string, values?: Readonly<Record<string, string | number>>): string => {
    const raw = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], nlTask);
    if (typeof raw !== 'string') throw new Error(`nl-tekst ${key} ontbreekt`);
    return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(values?.[name] ?? `{{${name}}}`));
  };
  const FOLLOWS = 'De app verandert dit niet vanzelf. Wijzig je de duur, dan vervangt de app dit werk door inzet × nieuwe duur. Je krijgt dan een melding; Ctrl+Z zet het terug.';
  const KEEPS = 'De app verandert dit niet vanzelf. Wijzig je de duur, dan blijft dit werk staan en past de app de inzet aan.';
  eq('q0 nl-bron: de twee slotzinnen letterlijk zoals besloten',
    [nlText('properties.assignments.workDeviatesFollowsDuration'), nlText('properties.assignments.workDeviatesKeepsWork')], [FOLLOWS, KEEPS]);
  // Tabel: de echte rasteradapter met de projectstandaard, precies zoals FullTaskGrid hem doorgeeft.
  const tableText = (code: string): string | null => {
    const s = S();
    const adapter = createTaskGridAdapter({
      projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
      assignments: s.assignments, resources: s.resources, baselines: s.baselines,
      activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
      scheduleStale: s.scheduleStale, wbsAutoNumber: false, taskTypesUnlocked: true,
      defaultWorkRule: s.project.defaultWorkRule,
      effectiveHoursPerDay: (t) => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
      labelForColumn: (k) => k, labelForText: nlText,
      numberLocale: 'nl', surfaceId: 'full-task-grid', rows: s.viewRows, selectedTaskIds: [],
    });
    const row = s.viewRows.find((r) => r.kind === 'task' && r.task.id === byCode(code).id)!;
    return adapter.getCell(row.rowKey, taskColumnId('assignment.remainingWork'))?.warning?.text ?? null;
  };
  // Paneel: dezelfde invulling als `TaskAssignmentsSection` (hint + slotzin uit workDeviationEffectKey).
  const panelText = (code: string, sourceId: string): string | null => {
    const d = deviationOf(code, sourceId);
    return d && nlText('properties.assignments.workDeviatesHint', {
      ...d, durationEffect: nlText(workDeviationEffectKey(byCode(code), S().project.defaultWorkRule)),
    });
  };
  const hint = (stored: number, derived: number, slot: string) =>
    `Opgeslagen werk ${stored}u wijkt af van inzet × resterende duur (${derived}u). Het histogram volgt het opgeslagen werk over de hele taakduur. ${slot}`;

  // Per regel: de zin in tabel en paneel, en dan de echte duurwijziging — de zin moet kloppen met wat er gebeurt.
  const cases: { label: string; code: string; src: string; prep?: () => void; keeps: boolean }[] = [
    { label: 'Vaste duur en inzet (E-1010)', code: 'E-1010', src: '7500', keeps: false },
    { label: 'Vaste inzet (E-1070)', code: 'E-1070', src: '7506', keeps: false },
    { label: 'Vast werk (E-1030)', code: 'E-1030', src: '7502', keeps: true },
    { label: 'Vaste duur en werk (E-1040)', code: 'E-1040', src: '7503', keeps: true },
    {
      label: 'Vaste duur en werk, MSP effort-driven (E-1040)', code: 'E-1040', src: '7503', keeps: false,
      prep: () => useAppStore.setState((s) => {
        const t = s.tasks.find((x) => x.wbsCode === 'E-1040')!;
        t.mspTaskType = 'FIXED_DURATION'; t.effortDriven = true;
      }),
    },
    {
      label: 'geen eigen regel, projectstandaard Vast werk (E-1010)', code: 'E-1010', src: '7500', keeps: true,
      prep: () => useAppStore.setState((s) => {
        delete s.tasks.find((x) => x.wbsCode === 'E-1010')!.workRule;
        s.project.defaultWorkRule = 'FIXED_WORK';
      }),
    },
    {
      label: 'geen eigen regel, projectstandaard Vaste duur en inzet (E-1030)', code: 'E-1030', src: '7502', keeps: false,
      prep: () => useAppStore.setState((s) => {
        delete s.tasks.find((x) => x.wbsCode === 'E-1030')!.workRule;
        s.project.defaultWorkRule = 'FIXED_DURATION_RATE';
      }),
    },
    {
      label: 'geen eigen regel, geen projectstandaard (E-1030)', code: 'E-1030', src: '7502', keeps: false,
      prep: () => useAppStore.setState((s) => {
        delete s.tasks.find((x) => x.wbsCode === 'E-1030')!.workRule;
        delete s.project.defaultWorkRule;
      }),
    },
  ];
  for (const c of cases) {
    openFixture();
    c.prep?.();
    const slot = c.keeps ? KEEPS : FOLLOWS;
    const d = deviationOf(c.code, c.src)!;
    eq(`q1 ${c.label}: tabel toont de slotzin "${c.keeps ? 'werk blijft' : 'werk volgt de duur'}"`, tableText(c.code), hint(d.stored, d.derived, slot));
    eq(`q2 ${c.label}: paneel toont dezelfde tekst als de tabel`, panelText(c.code, c.src), tableText(c.code));
    const before = asg(c.src).remainingWorkMinutes;
    setHours(c.code, 72);
    const stayed = asg(c.src).remainingWorkMinutes === before;
    eq(`q3 ${c.label}: de duurwijziging doet wat de zin zegt (werk bleef staan: ${c.keeps})`, stayed, c.keeps);
    eq(`q4 ${c.label}: melding alleen als het werk vervangen werd`, workNotices().length > 0, !c.keeps);
  }

  // Meer toewijzingen: één slotzin onder de regels.
  openFixture();
  S().assignResource(byCode('E-1020').id, asg('7500').resourceId, 1);
  eq('q5 twee toewijzingen (Vaste duur en inzet): de regels en daaronder één slotzin', tableText('E-1020'),
    `Opgeslagen werk wijkt af van inzet × resterende duur:\nDesign Engineer 2: 160u (inzet × resterende duur: 40u)\n${FOLLOWS}`);
  useAppStore.setState((s) => { s.tasks.find((x) => x.wbsCode === 'E-1020')!.workRule = 'FIXED_WORK'; });
  eq('q6 dezelfde taak onder Vast werk: de andere slotzin', tableText('E-1020'),
    `Opgeslagen werk wijkt af van inzet × resterende duur:\nDesign Engineer 2: 160u (inzet × resterende duur: 40u)\n${KEEPS}`);
}

if (diffs.length > 0) {
  console.log(`XX  check-restwerk-duurwijziging: ${diffs.length}/${checks} checks rood`);
  for (const d of diffs) console.log(`XX    ${d}`);
  process.exit(1);
}
console.log(`OK  check-restwerk-duurwijziging: ${checks} checks groen`);
