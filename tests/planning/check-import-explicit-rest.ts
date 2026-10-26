// Een expliciete restduur uit de bron blijft staan (aanval a07 na #600, BLOKKEERT).
//
// `normalizeImportedProgress` leidde de rest van een lopende dagtaak altijd af uit het percentage
// (`applyRemainingDuration`). Dat percentage is in de bron vaak afgerond (MSP: 33 % bij 4 van 6 d) of
// staat los van de rest (P6 fysiek %). Sinds de restduur exact is (B3) gaf dat:
//   - MPP: 6 d, rest 4 d, 33 % ⇒ 4,02 d en een einde op 9 juni 08:10 in plaats van 8 juni 16:00;
//     na opslaan als IFC en heropenen bleef 4,02 staan;
//   - XER in dagenmaat (datums zonder kloktijd), fysiek 75 %, 48 u duur, 32 u rest: direct 4 d, na
//     IFC-heropening 1,5 d (12 u).
// De regel nu: een lezer houdt de bronrest van een lopende taak; alleen zonder bronrest leidt hij af.
// Een voltooide taak krijgt rest 0. Een voortgangsbewerking in de app leidt de rest nog steeds af (B3).
// Dat geldt ook voor een IFC zonder de markering van het minutenmodel (fixronde 1 van #663): het bestand
// zegt niet of een rest ingevoerd of afgeleid was, dus de opgeslagen waarde is het feit
// (check-ifc-legacy-arity 2c). De eenheidsregels van `normalizeImportedProgress` staan in
// check-remaining-duration.ts (sectie 5).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { createAppStore } from '@/state/appStoreFactory';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readMPP } from '@/services/mpp/mppReader';
import { readXER } from '@/services/xer/xerReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import type { Task } from '@/types/task';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import {
  buildCalFixedDataRecord, buildCalFixedMetaBlob, buildCalHoursBlock, buildNestedCfb, buildVarMetaBytes,
  encodeCompObjFileFormat, encodePropsEntries, encodePropsSingleByteEntry, mppTimestampBytes,
} from './mppFixtures';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}

// ── Fixture: MPP14-taken op een kalender ma–vr 08:00–16:00 ────────────────────────────────────
// De standaardtaak heeft dezelfde bytes als de aanvalsprobe (`a07-rest.mpp`): duur 28800 tienden =
// 2880 min = 6 d, rest 19200 tienden = 1920 min = 4 d, 33 %, werkelijke start ma 1 juni 2026 08:00,
// statusdatum wo 3 juni 08:00. Geplande start en einde liggen op het kalenderanker 08:00: de lezer
// kiest de dagenmaat (een werkelijk einde op een andere kloktijd maakt de kalender een uurkalender).
const MPP_EPOCH_DAY = Math.round((Date.UTC(2026, 5, 1) - Date.UTC(1983, 11, 31)) / 86400000);
const utf16 = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
  return out;
};
const int32 = (n: number): Uint8Array => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, n, true);
  return out;
};

/** Eén MPP-taak; een moment is [minuten na middernacht, dag na ma 1 juni 2026]. */
interface MppTask {
  name: string;
  duration: number;
  rest: number;
  pct: number;
  start: [number, number];
  finish: [number, number];
  actualStart?: [number, number];
  actualFinish?: [number, number];
}
const RUNNING: MppTask = {
  name: 'Lopend zes dagen', duration: 28800, rest: 19200, pct: 33, start: [480, 0], finish: [480, 8], actualStart: [480, 0],
};

function mpp(tasks: MppTask[]): Uint8Array {
  const slots = 3 + tasks.length; // drie lege records, dan de taken (zoals de probe)
  const meta = new Uint8Array(16 + slots * 47);
  const mv = new DataView(meta.buffer);
  mv.setUint32(0, 0xfadfadba, true);
  mv.setInt32(8, slots, true);
  const fixed = new Uint8Array(slots * 130);
  const names: Uint8Array[] = [];
  const varMeta: { uniqueId: number; type: number; offset: number }[] = [];
  let varSize = 0;
  tasks.forEach((task, j) => {
    const offset = (3 + j) * 130;
    mv.setInt32(16 + (3 + j) * 47 + 4, offset, true);
    const v = new DataView(fixed.buffer, offset, 130);
    v.setInt32(0, 10 + j, true); // unique id
    v.setInt32(4, j + 1, true); // id
    v.setInt16(40, 1, true);
    v.setInt32(42, task.duration, true); // duur in tienden van een minuut
    v.setUint16(46, 0, true);
    v.setInt32(52, task.rest, true); // REMAINING_DURATION
    for (const n of [8, 12, 16, 20, 64, 68, 72, 76, 80, 106, 110, 122]) {
      v.setUint16(n, 65535, true);
      v.setUint16(n + 2, 65535, true);
    }
    const stamp = (at: number, moment: [number, number] | undefined) => {
      if (!moment) return;
      v.setUint16(at, moment[0] * 10, true);
      v.setUint16(at + 2, MPP_EPOCH_DAY + moment[1], true);
    };
    stamp(64, task.start);
    stamp(68, task.finish);
    stamp(72, task.actualStart);
    stamp(76, task.actualFinish);
    v.setInt16(90, task.pct, true); // voortgang in hele procenten
    v.setInt32(118, -1, true);
    const name = utf16(task.name);
    const field = new Uint8Array(4 + name.length);
    new DataView(field.buffer).setInt32(0, name.length, true);
    field.set(name, 4);
    varMeta.push({ uniqueId: 10 + j, type: 14, offset: varSize });
    varSize += field.length;
    names.push(field);
  });
  const var2 = new Uint8Array(varSize);
  let at = 0;
  for (const field of names) { var2.set(field, at); at += field.length; }

  const calName = 'A07 kalender';
  const hours = buildCalHoursBlock([0, 1, 2, 3, 4, 5, 6].map(d => (d === 0 || d === 6
    ? { defaultFlag: 0 as const }
    : { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] })));
  const calVar = new Uint8Array(104 + hours.length);
  new DataView(calVar.buffer).setInt32(0, utf16(calName).length, true);
  calVar.set(utf16(calName), 4);
  new DataView(calVar.buffer).setInt32(100, hours.length, true);
  calVar.set(hours, 104);

  const props = encodePropsEntries([
    { key: 37748738, data: mppTimestampBytes(4800, MPP_EPOCH_DAY) }, // projectstart
    { key: 37748739, data: mppTimestampBytes(4800, MPP_EPOCH_DAY + 30) }, // projecteinde
    { key: 37748744, data: utf16('A07') }, // titel
    { key: 37748765, data: int32(480) }, // minuten per dag
    { key: 37748756, data: int32(0) }, // kritiekgrens
    { key: 37748750, data: utf16(calName) }, // standaardkalender
    { key: 37748805, data: mppTimestampBytes(4800, MPP_EPOCH_DAY + 2) }, // statusdatum wo 3 juni 08:00
  ]);
  return buildNestedCfb({
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(893386752, 0) },
    '   114': {
      children: {
        Props: { data: props },
        TBkndTask: {
          children: {
            FixedMeta: { data: meta },
            FixedData: { data: fixed },
            VarMeta: { data: buildVarMetaBytes(varMeta) },
            Var2Data: { data: var2 },
          },
        },
        TBkndCal: {
          children: {
            FixedMeta: { data: buildCalFixedMetaBlob([0]) },
            FixedData: { data: buildCalFixedDataRecord(1, 1, -1) },
            VarMeta: { data: buildVarMetaBytes([{ uniqueId: 1, type: 1, offset: 0 }, { uniqueId: 1, type: 8, offset: 100 }]) },
            Var2Data: { data: calVar },
          },
        },
      },
    },
  });
}
/** De lopende standaardtaak, met desgewenst een andere duur, rest of voortgang. */
const runningMpp = (over: Partial<MppTask> = {}): Uint8Array => mpp([{ ...RUNNING, ...over }]);

/** Rekent door zoals F5 (de taken dragen daarna het resultaat), met de kalenderlijst van de store. */
function solved(imported: ImportResult): ImportResult {
  const { project, tasks, sequences, calendar, resourceCalendars } = imported;
  const result = solveProject(solveInputFor(project, tasks, sequences, calendar, resourceCalendars ?? []));
  if (result.error) throw new Error(`solve faalde: ${result.error}`);
  return imported;
}
const reopen = (imported: ImportResult): ImportResult => readIFC(writeIFC(imported));
const leaf = (r: { tasks: Task[] }): Task => r.tasks.find(t => t.childIds.length === 0)!;

// ── 1. MPP: de bronrest van 4 d blijft staan, ook na opslaan als IFC en heropenen ─────────────────
{
  const imported = readMPP(runningMpp());
  const t = leaf(imported);
  eq('MPP: voorwaarde lopend, dagenmaat, 6 d, 33 %',
    [t.status, t.time.durationUnit, t.time.scheduleDuration, t.time.completion], ['STARTED', 'days', 6, 0.33]);
  eq('MPP: bronrest 19200 tienden = 1920 min blijft 4 d (niet 6 × 0,67 = 4,02)', t.time.remainingTime, 4);
  const d = solved(imported);
  eq('MPP: einde na F5 volgt de bronrest (ma 8 juni 16:00, niet di 9 juni 08:10)', leaf(d).time.earlyFinish, '2026-06-08T16:00');
  const back = reopen(d);
  eq('MPP → IFC → heropenen: nog 4 d rest', leaf(back).time.remainingTime, 4);
  eq('MPP → IFC → heropenen: zelfde einde na F5', leaf(solved(back)).time.earlyFinish, '2026-06-08T16:00');
}

// ── 1b. MPP: een gebroken dagenrest komt exact binnen ───────────────────────────────────────────
// De rest is geen signaal voor de uurmodus: een dagtaak kan een rest van een halve dag dragen. 7 d
// (33600 tienden), rest 2,5 d (12000 tienden), 64 %: exact 2,5 d; afgeleid zou 2,52 d geven, en de
// afronding van de duur (`tenthsOfMinutesToDays`) 3 d.
{
  const t = leaf(readMPP(runningMpp({ duration: 33600, rest: 12000, pct: 64 })));
  eq('MPP: gebroken bronrest 2,5 d blijft 2,5 d (niet 2,52 d, niet 3 d)',
    [t.time.durationUnit, t.time.scheduleDuration, t.time.remainingTime], ['days', 7, 2.5]);
}

// ── 2. XER in dagenmaat (datums zonder kloktijd): de rest uit de bron overleeft IFC ──────────────
// Drie voortgangsfamilies, 48 u duur (6 d van 8 u), 32 u rest. CP_Drtn leidt de rest uit het
// duurpercentage af (25 % ⇒ 36 u = 4,5 d, ook in de lezer); CP_Phys en CP_Units houden de 32 u.
function xer(dateOnly: boolean): ImportResult {
  const fields = ['task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type', 'status_code',
    'complete_pct_type', 'complete_pct', 'phys_complete_pct', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt',
    'target_start_date', 'target_end_date', 'act_start_date', 'act_end_date'];
  const at = (date: string, clock: string) => (dateOnly ? date : `${date} ${clock}`);
  const rows: Record<string, string | number>[] = [
    { complete_pct_type: 'CP_Drtn', complete_pct: 25 },
    { complete_pct_type: 'CP_Phys', phys_complete_pct: 75 },
    { complete_pct_type: 'CP_Units', complete_pct: 50 },
  ];
  const lines = [
    'ERMHDR\t23.12\t2026-06-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date', '%R\tP1\tA07\tC1\t2026-06-03 16:00',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data', '%R\tC1\tA07\tCA_Project\t8\t40\t',
    '%T\tTASK', `%F\t${fields.join('\t')}`,
    ...rows.map((over, j) => {
      const row: Record<string, string | number> = {
        task_id: `T${j}`, proj_id: 'P1', clndr_id: 'C1', task_code: `T${j}`, task_name: `T${j}`, task_type: 'TT_Task',
        duration_type: 'DT_FixedDUR2', status_code: 'TK_Active', complete_pct_type: 'CP_Phys', complete_pct: 33,
        phys_complete_pct: 33, target_drtn_hr_cnt: 48, remain_drtn_hr_cnt: 32,
        target_start_date: at('2026-06-01', '08:00'), target_end_date: at('2026-06-08', '16:00'),
        act_start_date: at('2026-06-01', '08:00'), ...over,
      };
      return `%R\t${fields.map(f => row[f] ?? '').join('\t')}`;
    }),
    '%E',
  ];
  const result = readXER(new TextEncoder().encode(lines.join('\n')));
  if (isMultiDocumentImport(result)) throw new Error('de enkelprojectfixture gaf meerdere documenten');
  return result;
}
{
  const imported = xer(true);
  const rest = (r: { tasks: Task[] }) => r.tasks.map(t => [t.time.durationUnit, t.time.completion, t.time.remainingTime]);
  eq('XER dagenmaat: direct na lezen 4,5 / 4 / 4 d rest', rest(imported),
    [['days', 0.25, 4.5], ['days', 0.75, 4], ['days', 0.5, 4]]);
  const back = reopen(solved(imported));
  eq('XER dagenmaat → IFC → heropenen: CP_Phys houdt 4 d = 32 u (niet 1,5 d), CP_Units 4 d (niet 3 d)', rest(back),
    [['days', 0.25, 4.5], ['days', 0.75, 4], ['days', 0.5, 4]]);
}
{
  // Met kloktijden (urenmaat) bleven de bronminuten al staan; dit houdt dat zo.
  const back = reopen(solved(xer(false)));
  eq('XER urenmaat → IFC → heropenen: restminuten 2160 / 1920 / 1920',
    back.tasks.map(t => [t.time.durationUnit, t.time.remainingMinutes]), [['hours', 2160], ['hours', 1920], ['hours', 1920]]);
}

// ── 3. Een voortgangsbewerking in de app leidt de rest nog steeds af (B3) ────────────────────────
{
  const S = () => useAppStore.getState();
  S().loadState(readMPP(runningMpp()));
  const id = leaf({ tasks: S().tasks }).id;
  const task = () => S().tasks.find(t => t.id === id)!;
  eq('store: geladen MPP-taak houdt de bronrest 4 d', task().time.remainingTime, 4);
  S().setTaskProgress(id, 0.5);
  eq('store: 50 % in de app ⇒ rest 6 × 0,5 = 3 d (afgeleid, B3)', [task().time.completion, task().time.remainingTime], [0.5, 3]);
  S().setTaskProgress(id, 0.33);
  eq('store: terug naar 33 % ⇒ rest exact 6 × 0,67 = 4,02 d (afgeleid, niet de oude bronrest)', task().time.remainingTime, 4.02);
}

// ── 4. De route van de app: openen, meteen opslaan (zonder F5), heropenen ─────────────────────────
{
  const S = () => useAppStore.getState();
  const restAfterSave = () => readIFC(writeIFC(buildWriteIFCInput(S()))).tasks
    .filter(t => t.childIds.length === 0).map(t => t.time.remainingTime);
  S().openAsDocument(readMPP(runningMpp()), { name: 'a07-rest.mpp', ref: null });
  eq('app: MPP openen → opslaan → heropenen houdt 4 d', restAfterSave(), [4]);
  S().openAsDocument(xer(true), { name: 'a07-xer-date.xer', ref: null });
  eq('app: XER dagenmaat openen → opslaan → heropenen houdt 4,5 / 4 / 4 d', restAfterSave(), [4.5, 4, 4]);
}

// ── 5. Een IFC zonder de markering van het minutenmodel houdt zijn expliciete rest ────────────────
// Review r1 van #663: zonder `TimeModel` las 6 d, 33 %, 4 d rest als 4,02 d; na openen en opslaan stond
// die waarde vast (nu mét markering) en eindigde de taak di 9 juni 08:10 in plaats van ma 8 juni 16:00.
{
  const withMarker = writeIFC(solved(readMPP(runningMpp())));
  const legacy = withMarker.replace("IFCPROPERTYSINGLEVALUE('TimeModel'", "IFCPROPERTYSINGLEVALUE('Onbekend'");
  eq('zonder markering: voorwaarde (het bestand had de markering, de kopie niet)',
    [readIFC(withMarker).timeModel, readIFC(legacy).timeModel], ['MINUTES-1', undefined]);
  eq('zonder markering: de expliciete rest 4 d blijft 4 d (niet 4,02 d)', leaf(readIFC(legacy)).time.remainingTime, 4);
  const app = createAppStore();
  app.getState().openAsDocument(readIFC(legacy), { name: 'zonder-markering.ifc', ref: null });
  app.getState().runCPM();
  eq('zonder markering: na openen en F5 einde ma 8 juni 16:00', leaf(app.getState()).time.earlyFinish, '2026-06-08T16:00');
  eq('zonder markering: openen → opslaan → heropenen houdt 4 d',
    leaf(readIFC(writeIFC(buildWriteIFCInput(app.getState())))).time.remainingTime, 4);
}

// ── 6. B1a/B5 → Ctrl+Z → opslaan → heropenen houdt de rest ───────────────────────────────────────
// Review r1 van #663: een minutenbestand met een vastwerktaak in dagen (B1a zet haar om naar uren, B5
// maakt daar één undo-stap van) en een lopende dagtaak met 4 d rest. Ctrl+Z op de omzetting zet
// `minuteModelPending` terug op `true`; de writer laat `TimeModel` dan weg. Heropenen gaf 4,02 d.
{
  const q = readMPP(mpp([
    { name: 'Vast werk nog dagen', duration: 14400, rest: 14400, pct: 0, start: [480, 2], finish: [480, 6] },
    { ...RUNNING, name: 'Lopend expliciete rest' },
  ]));
  q.tasks[0].workRule = 'FIXED_WORK';
  q.tasks[1].workRule = 'FIXED_DURATION_RATE';
  const app = createAppStore();
  app.getState().openAsDocument(readIFC(writeIFC(q)), { name: 'B1a.ifc', ref: null });
  const rest = (r: { tasks: Task[] }) => r.tasks.find(t => t.name === 'Lopend expliciete rest')?.time.remainingTime;
  eq('B1a/B5: voorwaarde (omzetting gesloten, één undo-stap, vast werk in uren)',
    [app.getState().minuteModelPending, app.getState().historyEvents.length, app.getState().tasks[0].time.durationUnit],
    [false, 1, 'hours']);
  eq('B1a/B5: na openen 4 d rest', rest(app.getState()), 4);
  app.getState().undo();
  const saved = writeIFC(buildWriteIFCInput(app.getState()));
  eq('B1a/B5 → Ctrl+Z: voorwaarde (omzetting open, bestand zonder markering)',
    [app.getState().minuteModelPending, readIFC(saved).timeModel], [true, undefined]);
  eq('B1a/B5 → Ctrl+Z → opslaan → heropenen houdt 4 d (niet 4,02 d)', rest(readIFC(saved)), 4);
}

// ── 7. Een voltooide taak krijgt rest 0, ook met een bronrest (VERVOLG uit review r1 van #663) ────
// Een werkelijk einde om 15:00 maakt de kalender een uurkalender. MPP: 2880 min, 100 %, werkelijk einde,
// 1920 bronminuten rest. Vroeger bleef de taak `COMPLETED` met 1920 min rest, ook na IFC-heropening.
{
  const imported = readMPP(runningMpp({ name: 'Voltooid met bronrest', pct: 100, actualFinish: [900, 1] }));
  const state = (t: Task) => [t.status, t.time.durationUnit, t.time.remainingMinutes, t.time.remainingTime];
  eq('voltooid: urentaak krijgt rest 0 (niet 1920 min)', state(leaf(imported)), ['COMPLETED', 'hours', 0, 0]);
  eq('voltooid → IFC → heropenen: rest 0', state(leaf(reopen(solved(imported)))), ['COMPLETED', 'hours', 0, 0]);
}

if (diffs.length === 0) {
  console.log(`OK  import-explicit-rest: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  import-explicit-rest: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
