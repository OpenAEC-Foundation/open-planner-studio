// Een expliciete restduur uit de bron blijft staan (aanval a07 na #600, BLOKKEERT).
//
// `normalizeImportedProgress` leidde de rest van een lopende dagtaak altijd af uit het percentage
// (`applyRemainingDuration`). Dat percentage is in de bron vaak afgerond (MSP: 33 % bij 4 van 6 d) of
// staat los van de rest (P6 fysiek %). Sinds de restduur exact is (B3) gaf dat:
//   - MPP: 6 d, rest 4 d, 33 % ⇒ 4,02 d en een einde op 9 juni 08:10 in plaats van 8 juni 16:00;
//     na opslaan als IFC en heropenen bleef 4,02 staan;
//   - XER in dagenmaat (datums zonder kloktijd), fysiek 75 %, 48 u duur, 32 u rest: direct 4 d, na
//     IFC-heropening 1,5 d (12 u).
// De regel nu: een lezer houdt een aanwezige bronrest; alleen zonder bronrest leidt hij af. Een
// voortgangsbewerking in de app leidt de rest nog steeds af (B3). Uitzondering: een IFC zonder de
// markering van het minutenmodel (een oudere versie schreef de dagenrest afgerond) krijgt de exacte
// afleiding, zoals eigenaarsbesluit B3 voor oude bestanden zegt (check-ifc-legacy-arity 2c). De
// eenheidsregels van `normalizeImportedProgress` staan in check-remaining-duration.ts (sectie 5).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
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

// ── Fixture: één lopende MPP14-taak op een kalender ma–vr 08:00–16:00 ─────────────────────────
// Dezelfde bytes als de aanvalsprobe (`a07-rest.mpp`): duur 28800 tienden = 2880 min = 6 d, rest
// 19200 tienden = 1920 min = 4 d, 33 %, werkelijke start ma 1 juni 2026 08:00, statusdatum wo 3 juni
// 08:00. Geplande start en einde liggen op het kalenderanker 08:00: de lezer kiest de dagenmaat.
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

function runningMpp(): Uint8Array {
  const slots = 4; // drie lege records, dan de taak (zoals de probe)
  const meta = new Uint8Array(16 + slots * 47);
  const mv = new DataView(meta.buffer);
  mv.setUint32(0, 0xfadfadba, true);
  mv.setInt32(8, slots, true);
  const fixed = new Uint8Array(slots * 130);
  const offset = 3 * 130;
  mv.setInt32(16 + 3 * 47 + 4, offset, true);
  const v = new DataView(fixed.buffer, offset, 130);
  v.setInt32(0, 10, true); // unique id
  v.setInt32(4, 1, true); // id
  v.setInt16(40, 1, true);
  v.setInt32(42, 28800, true); // duur in tienden van een minuut
  v.setUint16(46, 0, true);
  v.setInt32(52, 19200, true); // REMAINING_DURATION
  for (const n of [8, 12, 16, 20, 64, 68, 72, 76, 80, 106, 110, 122]) {
    v.setUint16(n, 65535, true);
    v.setUint16(n + 2, 65535, true);
  }
  const stamp = (at: number, minutes: number, day: number) => {
    v.setUint16(at, minutes * 10, true);
    v.setUint16(at + 2, MPP_EPOCH_DAY + day, true);
  };
  stamp(64, 480, 0); // start ma 1 juni 08:00
  stamp(68, 480, 8); // einde zoals MSP het opsloeg
  stamp(72, 480, 0); // werkelijke start ma 1 juni 08:00
  v.setInt16(90, 33, true); // voortgang 33 %
  v.setInt32(118, -1, true);
  const name = utf16('Lopend zes dagen');
  const nameField = new Uint8Array(4 + name.length);
  new DataView(nameField.buffer).setInt32(0, name.length, true);
  nameField.set(name, 4);

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
            VarMeta: { data: buildVarMetaBytes([{ uniqueId: 10, type: 14, offset: 0 }]) },
            Var2Data: { data: nameField },
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
// De lezer houdt de dagenrest alleen in een IFC met de markering van het minutenmodel; een ouder
// bestand schreef hem afgerond en krijgt de exacte afleiding (B3, check-ifc-legacy-arity 2c). De writer
// zet de markering zodra de B5-omzetting niet meer openstaat; de laadberekening bij openen sluit haar.
{
  const S = () => useAppStore.getState();
  const restAfterSave = () => readIFC(writeIFC(buildWriteIFCInput(S()))).tasks
    .filter(t => t.childIds.length === 0).map(t => t.time.remainingTime);
  S().openAsDocument(readMPP(runningMpp()), { name: 'a07-rest.mpp', ref: null });
  eq('app: MPP geopend, omzetting gesloten (de writer zet de markering)', S().minuteModelPending, false);
  eq('app: MPP openen → opslaan → heropenen houdt 4 d', restAfterSave(), [4]);
  S().openAsDocument(xer(true), { name: 'a07-xer-date.xer', ref: null });
  eq('app: XER geopend, omzetting gesloten', S().minuteModelPending, false);
  eq('app: XER dagenmaat openen → opslaan → heropenen houdt 4,5 / 4 / 4 d', restAfterSave(), [4.5, 4, 4]);
}

if (diffs.length === 0) {
  console.log(`OK  import-explicit-rest: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  import-explicit-rest: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
