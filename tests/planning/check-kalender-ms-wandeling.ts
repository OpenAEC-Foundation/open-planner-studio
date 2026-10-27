// De twee fysieke kalenderwandelingen rekenen in hele milliseconden (review #591 r7; was knownbug 385 en 388).
//
// `CalendarEngine.addWorkMinutes` en `subtractWorkMinutes` rekenden met kommagetalminuten. Bij een bandgrens
// bleef dan soms een rest van ~10⁻¹³ min of een deel van een ms over, en de terugwandeling koos het vorige
// werkeinde. Sinds F5b komen zulke breuken gewoon binnen (XER 8,72 u = 523,2 min, `.mpp`-tienden), en
// veranderden speling, kritiek pad en ALAP.
//
// Wat deze check vastlegt:
//  (a) de spiegel `subtractWorkMinutes(addWorkMinutes(t, m), m) === t` vanaf ma 08:00, op de milliseconde, voor
//      tienden 0,1–5000 min, uren met twee decimalen 0,01–83 u, hele minuten 1–5000 en drie breuken die geen
//      heel aantal ms zijn; op een kalender ma–vr 08:00–16:00 en op een kalender met pauze (08–12, 13–17);
//  (b) de reproductie uit review r7 via de echte openroute (XER → store → Bereken): A 8 u op 24/7 FS B op
//      ma–vr 08:00–16:00, B 8,72 u of 8,57 u (controle 10,64 u). A krijgt LS di 00:00, LF di 08:00, 960 min
//      speling en is niet kritisch; B LS blijft di 08:00. Onder P6, OPS en MS Project;
//  (c) dezelfde invoer met A op ALAP: A staat di 00:00–08:00, met speling 0 (niet negatief), onder elk profiel;
//  (d) een `.mpp` met B = 512,2 min (een tiende): B LS is gelijk aan B ES (B is kritisch, zonder speling).
//
// Draait via run.sh (esbuild-bundel, ook in de tijdzone-matrix). Alleen de exitcode telt.
import './domStub';
import { installDOMParser } from './xmldom-shim';
import { addElapsedMinutes, subtractElapsedMinutes } from '@/engine/scheduler/duration';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createAppStoreContext } from '@/state/appStore';
import { parseOpenedFile } from '@/services/formatRegistry';
import type { DocumentPayload } from '@/state/documentContract';
import type { WorkCalendar } from '@/types/calendar';
import type { BuiltInProfileId } from '@/types/project';
import {
  buildNestedCfb, buildVarMetaBytes, encodeCompObjFileFormat, encodePropsEntries, encodePropsSingleByteEntry,
  mppTimestampBytes,
} from './mppFixtures';

installDOMParser();
let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) errors.push(label);
}
function quiet<T>(fn: () => T): T {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
}
async function quietAsync<T>(fn: () => Promise<T>): Promise<T> {
  const warn = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = warn; }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (a) De spiegel op de milliseconde
// ════════════════════════════════════════════════════════════════════════════════════════════════
function hourCalendar(id: string, bands: { start: number; end: number }[]): WorkCalendar {
  return {
    id, name: id, description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
    holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
  };
}
const CALENDARS = [
  hourCalendar('ma-vr 08-16', [{ start: 480, end: 960 }]),
  hourCalendar('ma-vr 08-12 13-17', [{ start: 480, end: 720 }, { start: 780, end: 1020 }]),
];
const START = new Date('2026-06-01T08:00:00Z');
const RASTERS: { name: string; values: number[] }[] = [
  { name: 'tienden 0,1–5000 min', values: Array.from({ length: 50_000 }, (_, i) => (i + 1) / 10) },
  // Uren met twee decimalen, zoals XER en P6 XML ze dragen (minuten via de lezerregel: op een miljoenste minuut).
  { name: 'uren 0,01–83 u', values: Array.from({ length: 8300 }, (_, i) => Math.round((i + 1) / 100 * 60 * 1e6) / 1e6) },
  { name: 'hele minuten 1–5000', values: Array.from({ length: 5000 }, (_, i) => i + 1) },
  // Geen heel aantal ms: de ruis van zes decimalen, de werkregel (1920 min werk bij inzet 7) en een XER-breuk.
  { name: 'geen heel aantal ms', values: [1600.00002, 1920 / 7, 2407.40742] },
];
for (const calendar of CALENDARS) {
  const engine = new CalendarEngine(calendar);
  for (const raster of RASTERS) {
    const misses: string[] = [];
    let fractionalEnd = 0;
    for (const m of raster.values) {
      const end = engine.addWorkMinutes(START, m);
      if (!Number.isInteger(end.getTime())) fractionalEnd++;
      const back = engine.subtractWorkMinutes(end, m);
      if (back.getTime() !== START.getTime()) misses.push(`${m} min ⇒ ${back.toISOString()}`);
    }
    eq(`(a) ${calendar.name}, ${raster.name}: spiegel, aantal afwijkingen (eerste drie)`,
      [misses.length, misses.slice(0, 3)], [0, []]);
    eq(`(a) ${calendar.name}, ${raster.name}: elk einde op een hele ms`, fractionalEnd, 0);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (b) en (c) De reproductie uit review r7: echte XER, gemengde kalenders, ASAP en ALAP, drie profielen
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Invoer: `/tmp/aanval/rev-f5b-r7-gemengd-8_72.xer` en de varianten van review r7. C1 is ma–vr 08:00–16:00
// (zondag is dag 1 in P6), C2 is 24/7. A (8 u, C2) FS B (C1), lag 0, statusdatum ma 1 juni 2026 08:00.
const C1_DATA = '(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|16:00)())))'
  + '(0||3()((0||0(s|08:00|f|16:00)())))(0||4()((0||0(s|08:00|f|16:00)())))(0||5()((0||0(s|08:00|f|16:00)())))'
  + '(0||6()((0||0(s|08:00|f|16:00)())))(0||7()())))(0||Exceptions()())))';
const C2_DATA = '(0||CalendarData()((0||DaysOfWeek()((0||1()((0||0(s|00:00|f|24:00)())))'
  + '(0||2()((0||0(s|00:00|f|24:00)())))(0||3()((0||0(s|00:00|f|24:00)())))(0||4()((0||0(s|00:00|f|24:00)())))'
  + '(0||5()((0||0(s|00:00|f|24:00)())))(0||6()((0||0(s|00:00|f|24:00)())))(0||7()((0||0(s|00:00|f|24:00)())))))'
  + '(0||Exceptions()())))';
function mixedXer(hours: string, alap: boolean): Uint8Array {
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-06-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date', '%R\tP1\tR7\tC1\t2026-06-01 08:00',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tDagkalender\tP1\tCA_Project\t8\t40\t${C1_DATA}`,
    `%R\tC2\tVolcontinu\tP1\tCA_Project\t24\t168\t${C2_DATA}`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct'
      + '\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date'
      + (alap ? '\tcstr_type' : ''),
    '%R\tT1\tP1\tC2\tA\tA\tTT_Task\tTK_NotStart\tCP_Drtn\t0\t\t8\t8\t2026-06-01 08:00\t2026-06-01 16:00\t'
      + (alap ? '\tCS_ALAP' : ''),
    `%R\tT2\tP1\tC1\tB\tB\tTT_Task\tTK_NotStart\tCP_Phys\t0\t0\t${hours}\t${hours}\t2026-06-02 08:00\t2026-06-30 16:00\t`
      + (alap ? '\t' : ''),
    '%T\tTASKPRED', '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tT2\tT1\tP1\tP1\tPR_FS\t0', '%E',
  ].join('\n'));
}
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
/** De echte openroute: inlezen, in de store zetten, het profiel kiezen (zoals in Projectinstellingen) en Bereken. */
async function openWithProfile(
  name: string, input: { text?: string; bytes?: Uint8Array }, profile?: BuiltInProfileId,
): Promise<DocumentPayload> {
  const store = createAppStoreContext().store;
  const opened = await quietAsync(() => parseOpenedFile({ name, ...input }));
  quiet(() => store.getState().applyOpenedImport(opened, OPEN));
  if (profile) {
    quiet(() => store.getState().applySchedulingSettings({
      profile: { id: profile, baseId: profile, name: '', overrides: {} },
      options: store.getState().project.schedulingOptions,
    }));
  }
  quiet(() => store.getState().runCPM());
  return store.getState().getOpenDocumentPayloads()[0].payload;
}
const byName = (doc: DocumentPayload, name: string) => doc.tasks.find(t => t.name === name);
for (const profile of ['p6', 'ops', 'msproject'] as const) {
  for (const [hours, minutes] of [['8.72', 523.2], ['8.57', 514.2], ['10.64', 638.4]] as const) {
    {
      const doc = await openWithProfile('gemengd.xer', { bytes: mixedXer(hours, false) }, profile);
      const a = byName(doc, 'A');
      const b = byName(doc, 'B');
      eq(`(b) ${profile}, B ${hours} u: B gelezen als ${minutes} min, LS di 08:00`,
        [b?.time.durationMinutes, b?.time.lateStart], [minutes, '2026-06-02T08:00']);
      eq(`(b) ${profile}, B ${hours} u: A LS di 00:00, LF di 08:00, 960 min speling, niet kritisch`,
        [a?.time.lateStart, a?.time.lateFinish, a?.time.totalFloatMinutes, a?.time.isCritical],
        ['2026-06-02T00:00', '2026-06-02T08:00', 960, false]);
    }
    {
      const doc = await openWithProfile('gemengd-alap.xer', { bytes: mixedXer(hours, true) }, profile);
      const a = byName(doc, 'A');
      ok(`(c) opzet ${profile}, B ${hours} u: A is ALAP`, a?.constraint?.type === 'ALAP');
      eq(`(c) ${profile}, B ${hours} u: A ALAP op di 00:00–08:00`,
        [a?.time.earlyStart, a?.time.earlyFinish], ['2026-06-02T00:00', '2026-06-02T08:00']);
      ok(`(c) ${profile}, B ${hours} u: A ALAP zonder negatieve speling (kreeg ${a?.time.totalFloatMinutes})`,
        a !== undefined && Math.abs(a.time.totalFloatMinutes ?? NaN) < 1e-6);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (d) Een .mpp met een tiende: B = 512,2 min
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Twee taken (UID 10 en 11), A 480 min FS B, MPP14, zelfde opbouw als `mppLagBytes` in
// `check-uren-f5b-adapters.ts`; de duur en de rest van B in tienden van een minuut.
function mppPairBytes(tenthsB: number): Uint8Array {
  const text = (s: string) => {
    const out = new Uint8Array((s.length + 1) * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  };
  const int32 = (v: number) => { const o = new Uint8Array(4); new DataView(o.buffer).setInt32(0, v, true); return o; };
  const props = encodePropsEntries([
    { key: 37748738, data: mppTimestampBytes(0, 15493) },
    { key: 37748739, data: mppTimestampBytes(0, 15523) },
    { key: 37748765, data: int32(480) },
    { key: 37748744, data: text('Tienden') },
  ]);
  const data = new Uint8Array(260);
  for (let n = 0; n < 2; n++) {
    const r = new DataView(data.buffer, n * 130, 130);
    const raw = n === 0 ? 4800 : tenthsB;
    r.setInt32(0, 10 + n, true); r.setInt32(4, 1 + n, true); r.setInt16(40, 1, true);
    r.setInt32(42, raw, true); r.setInt16(46, 0, true); r.setInt32(52, raw, true); r.setInt16(56, 0, true);
    r.setUint16(64, 4800, true); r.setUint16(66, 15493 + n, true); r.setUint16(68, 9600, true); r.setUint16(70, 15493 + n, true);
    r.setInt32(118, -1, true);
  }
  const meta = new Uint8Array(16 + 5 * 47);
  const mv = new DataView(meta.buffer);
  mv.setUint32(0, 0xfadfadba, true); mv.setInt32(8, 5, true); mv.setInt32(16 + 4 * 47 + 4, 130, true);
  const names = ['A', 'B'].map(text);
  const varData = new Uint8Array(names.reduce((n, a) => n + 4 + a.length, 0));
  const entries: { uniqueId: number; offset: number; type: number }[] = [];
  let pos = 0;
  names.forEach((name, n) => {
    new DataView(varData.buffer).setInt32(pos, name.length, true);
    varData.set(name, pos + 4);
    entries.push({ uniqueId: 10 + n, offset: pos, type: 14 });
    pos += 4 + name.length;
  });
  const consMeta = new Uint8Array(16 + 10);
  const cmv = new DataView(consMeta.buffer);
  cmv.setUint32(0, 0xfadfadba, true); cmv.setInt32(8, 1, true); cmv.setInt32(16 + 4, 0, true);
  const cons = new Uint8Array(20);
  const cv = new DataView(cons.buffer);
  cv.setInt32(0, 100, true); cv.setInt32(4, 10, true); cv.setInt32(8, 11, true); cv.setInt16(12, 1, true); // FS
  cv.setInt16(14, 5, true); cv.setInt32(16, 0, true); // lag 0
  return buildNestedCfb({
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(893386752, 0) },
    '   114': {
      children: {
        Props: { data: props },
        TBkndTask: { children: { FixedMeta: { data: meta }, FixedData: { data }, VarMeta: { data: buildVarMetaBytes(entries) }, Var2Data: { data: varData } } },
        TBkndCons: { children: { FixedMeta: { data: consMeta }, FixedData: { data: cons } } },
      },
    },
  });
}
for (const tenths of [5120, 5122]) {
  const doc = await openWithProfile('tienden.mpp', { bytes: mppPairBytes(tenths) });
  const b = byName(doc, 'B');
  ok(`(d) opzet .mpp B ${tenths / 10} min: twee taken en één relatie`, doc.tasks.length === 2 && doc.sequences.length === 1);
  eq(`(d) .mpp B ${tenths / 10} min: B LS gelijk aan B ES, zonder speling`,
    [b?.time.durationMinutes, b?.time.lateStart, b?.time.totalFloatMinutes], [tenths / 10, b?.time.earlyStart, 0]);
}

// (e) Knownbug 389: klokduur en kloklag gebruiken dezelfde hele-ms-spiegel, ook rond middernacht.
for (const anchor of ['2026-06-01T00:00:00Z', '2026-06-01T08:00:00Z']) {
  const start = new Date(anchor);
  for (const minutes of [1920 / 7, 1600.00002, 2407.40742, 240.00048, 512.2, 0.5 / 60_000, -0.5 / 60_000, -240.00048, 0]) {
    const delta = Math.sign(minutes) * Math.round(Math.abs(minutes) * 60_000);
    const finish = addElapsedMinutes(start, minutes);
    eq(`(e) ${anchor}, ${minutes}: klokduur op afgeronde ms`, finish.getTime() - start.getTime(), delta);
    eq(`(e) ${anchor}, ${minutes}: exacte klokspiegel`, subtractElapsedMinutes(finish, minutes).getTime(), start.getTime());
  }
  for (const minutes of [NaN, Infinity, -Infinity]) {
    eq(`(e) ${anchor}: niet-eindige duur blijft no-op`, [addElapsedMinutes(start, minutes).getTime(),
      subtractElapsedMinutes(start, minutes).getTime()], [start.getTime(), start.getTime()]);
  }
  for (const sign of [-1, 1]) {
    const cap = sign * 200_000 * 24 * 60 * 60_000;
    eq(`(e) ${anchor}, teken ${sign}: bestaande duurklem`, addElapsedMinutes(start, sign * 1e12).getTime() - start.getTime(), cap);
  }
}
function elapsedStore(profile: BuiltInProfileId, start: string) {
  const app = createAppStoreContext().store;
  app.setState(state => {
    state.project.startDate = start;
    state.project.schedulingProfile = { id: profile, baseId: profile, name: '', overrides: {} };
    const bands = [{ start: 0, end: 1440 }];
    state.calendar = { ...state.calendar, workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24,
      hoursPerDay: 24, holidays: [], workTime: { byWeekday: {
        1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: bands, 7: bands,
      } } };
    state.calendars = [];
  });
  return app;
}
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const start of ['2026-06-01T00:00', '2026-06-01T08:00']) {
    const app = elapsedStore(profile, start);
    const id = app.getState().addTask({ name: 'Klokduur', time: { ...createDefaultTaskTime(start, 0.166667), durationType: 'ELAPSEDTIME' } });
    app.getState().runCPM();
    const task = app.getState().tasks.find(t => t.id === id)!;
    eq(`(e) ${profile}/${start}: 0,166667 ed geen vorige minuut/dag`, task.time.lateStart, task.time.earlyStart);
    eq(`(e) ${profile}/${start}: geen negatieve ms-speling`, task.time.totalFloatMinutes, 0);
  }
  for (const type of ['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH'] as const) {
    for (const sign of [-1, 1]) {
      const start = '2026-06-01T08:00';
      const app = elapsedStore(profile, start);
      const time = { ...createDefaultTaskTime(start, 8, 'hours'), durationType: 'ELAPSEDTIME' as const };
      const a = app.getState().addTask({ name: 'A', time });
      const b = app.getState().addTask({ name: 'B', time: { ...time } });
      app.getState().addSequence({ predecessorId: a, successorId: b, type, lagUnit: 'ELAPSEDTIME', lagDays: sign * 0.166667 });
      app.getState().runCPM();
      ok(`(e) ${profile}/${type}/${sign}: geen negatieve lagruis`,
        app.getState().tasks.every(t => (t.time.totalFloatMinutes ?? -Infinity) >= 0));
    }
  }
}

if (errors.length) {
  for (const e of errors) console.log(`XX kalender-ms-wandeling: ${e}`);
  process.exitCode = 1;
} else {
  console.log(`OK kalender-ms-wandeling: ${checks} controles groen`);
}
