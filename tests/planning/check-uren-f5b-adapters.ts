// F5b: .mpp, XER en het 08:00-anker (spec `docs/superpowers/specs/2026-10-20-alleen-uren-design.md`
// §1.3 I4 en I8, §3.10; T15, T17; knownbugs 274, 275 en 293).
//
// Wat deze check vastlegt:
//  (1) .mpp (I4): duur en rest zijn de minuten uit het bestand, altijd in de urenmaat (T15), ook bij hele
//      dagen op een kalender die niet promoveert; tienden van een minuut blijven staan, ook na de store, IFC
//      en MSPDI (review #591 r1, punt 3);
//  (2) .mpp (I4): een werktijdlag in dagen of uren wordt minuten (`lagMinutes`), zonder omweg via uren per dag;
//      een kalendertijdlag in uren ook, met de eenheid kalendertijd; ook een lag houdt zijn tienden;
//  (3) XER: een taak op een dagkalender krijgt de urenmaat met de minuten van duur en rest; de lag blijft
//      minuten;
//  (4) P6 XML (knownbug 293): de dagenmaat zonder record is minuten ÷ minuten per dag, één keer gedeeld;
//  (5) I8, schrijven: MSPDI en P6 XML schrijven een einde met zijn echte tijd (16:00, niet 08:00), ook voor
//      een veld zonder tijd (D1–D7); de markering `OPS_LiteralCalendars` noemt de letterlijke kalenders;
//  (6) I8, rondgang: een ankerkalender blijft scalair, een letterlijke kalender wordt een urenkalender, en
//      na laden zijn alle momenten gelijk aan de bron;
//  (7) knownbug 274: in een vreemd bestand blijft een werkelijk einde om 08:00 08:00, ook na IFC-heropenen;
//  (8) een OPS-export van de basis (F5a) en van v2026.10.0, uit hun ECHTE writers: een echte 08:00 op een
//      urenkalender blijft 08:00, door de store, IFC en een tweede export (review #591 r1, punt 1);
//  (9) de statusdatum: 08:00 is in een vreemd bestand een echte tijd, in een OPS-bestand het anker;
// (10) een onleesbare lijst: de tijden blijven echt; de promotie volgt het tijdsignaal;
// (11) een OPS-export van v2026.7.0 en v2026.8.1 (geen markering), uit hun ECHTE writers: herkend aan de
//      vingerafdruk, 08:00 is het anker; een voltooide dagtaak eindigt om 16:00, door de hele route (punt 2);
// (12) de vingerafdruk is streng: één afwijking in de vorm, en het bestand leest als vreemd bestand;
// (13) een `.mpp`-lag met tienden (150,5 min werktijd, 720,5 min kalendertijd) blijft exact door de store, IFC
//      opslaan en heropenen, MSPDI heen en terug (twee keer) en P6 XML heen en terug (twee keer); review #591
//      r2, was knownbug 309;
// (14) een XER-lag van 0,33 u (19,8 min) blijft 19,8 min door de store, IFC opslaan en heropenen, MSPDI en
//      P6 XML heen en terug; 0,12 u wordt precies 7,2 min, zonder floatruis (review #591 r3, was knownbug 307);
// (15) XER-duur en -rest op de hele minuut (40,33 u = 2419,8 min wordt 2420, 16,33 u wordt 980), ook de rest
//      van een lopende `CP_Drtn`-taak; anders worden P6-cellen onexact (regel A, meting 2026-10-26). Een breuk
//      in minuten in duur en rest (.mpp: 2419,8 en 979,8 min) blijft exact door de store, IFC, MSPDI en P6 XML.
//
// Draait via run.sh (esbuild-bundel). Alleen de exitcode telt.
import './domStub';
import { installDOMParser } from './xmldom-shim';
import { freshPayload, payloadFromImport, type DocumentPayload } from '@/state/documentContract';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readXER } from '@/services/xer/xerReader';
import { readMPP } from '@/services/mpp/mppReader';
import { readRelations } from '@/services/mpp/mppEntities';
import { CfbFile } from '@/services/mpp/cfb';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createAppStoreContext } from '@/state/appStore';
import { parseOpenedFile } from '@/services/formatRegistry';
import { isLegacyOpsMspdi } from '@/services/msproject/mspdiReader';
import { isLegacyOpsP6Xml } from '@/services/p6/p6xmlReader';
import {
  F5A_BASE_MSPDI, F5A_BASE_P6, LEGACY_V2026_7_0_MSPDI, LEGACY_V2026_7_0_P6, LEGACY_V2026_8_1_MSPDI,
  LEGACY_V2026_8_1_P6, V2026_10_0_MSPDI, V2026_10_0_P6,
} from '../fixtures/legacyOpsExports';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import type { Task, TaskTime } from '@/types/task';
import {
  buildNestedCfb, buildVarMetaBytes, concatBytes, encodeCompObjFileFormat, encodePropsEntries,
  encodePropsSingleByteEntry, mppTimestampBytes, type CfbTreeNode,
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
/** De writers en lezers melden verliezen via console.warn; die horen niet bij deze check. */
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
const byName = (r: { tasks: Task[] }, name: string) => r.tasks.find(t => t.name === name);
const load = (r: ImportResult): DocumentPayload => payloadFromImport(r, null);
/** De echte openroute van de app: inlezen, in de store zetten (met herberekening bij openen) en daarna nog
 *  een keer `runCPM`, zoals een planner op Bereken klikt. Geeft het document zoals de store het heeft. */
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
async function openAndRecalc(name: string, input: { text?: string; bytes?: Uint8Array }): Promise<DocumentPayload> {
  const store = createAppStoreContext().store;
  const opened = await quietAsync(() => parseOpenedFile({ name, ...input }));
  quiet(() => store.getState().applyOpenedImport(opened, OPEN));
  quiet(() => store.getState().runCPM());
  return store.getState().getOpenDocumentPayloads()[0].payload;
}
/** Openen ⇒ IFC opslaan en heropenen ⇒ tweede XML-export (`write`) en die weer openen. */
async function storeRoute(name: string, input: { text?: string; bytes?: Uint8Array }, write: (p: DocumentPayload) => string):
  Promise<[string, DocumentPayload][]> {
  const opened = await openAndRecalc(name, input);
  const reopened = await openAndRecalc('heropend.ifc', { text: quiet(() => writeIFC(buildWriteIFCInput(opened))) });
  const again = await openAndRecalc('tweede-export.xml', { text: write(reopened) });
  return [['geopend', opened], ['IFC heropend', reopened], ['tweede export', again]];
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (1) .mpp: duur en rest in minuten (I4)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Eén taak, MPP14, de standaardveldkaart: duur op offset 42, duureenheid op 46 (0 = dagen, werktijd), rest
// op 52 (`DEFAULT_TASK_FIELDS`, fieldMap14.ts). Zelfde opbouw als `minimalMpp14Bytes` (mppFixtures.ts).
function mppTaskBytes(opts: { durationRaw: number; remainingRaw: number; percentComplete?: number }): Uint8Array {
  const ascii = (s: string) => {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  };
  const int32 = (v: number) => { const o = new Uint8Array(4); new DataView(o.buffer).setInt32(0, v, true); return o; };
  const START_DAYS = 15493; // ma 1 juni 2026 in MPP-dagen (epoch 1983-12-31)
  const props = encodePropsEntries([
    { key: 37748738, data: mppTimestampBytes(0, START_DAYS) },
    { key: 37748739, data: mppTimestampBytes(0, START_DAYS + 30) },
    { key: 37748765, data: int32(480) },
    { key: 37748744, data: ascii('F5b') },
  ]);
  const record = new Uint8Array(130);
  const rv = new DataView(record.buffer);
  rv.setInt32(0, 10, true); rv.setInt32(4, 1, true); rv.setInt16(40, 1, true);
  rv.setInt32(42, opts.durationRaw, true);
  rv.setInt16(46, 0, true);
  rv.setInt32(52, opts.remainingRaw, true);
  rv.setInt16(56, 0, true);
  rv.setUint16(64, 4800, true); rv.setUint16(66, START_DAYS, true); // 08:00
  rv.setUint16(68, 9600, true); rv.setUint16(70, START_DAYS + 2, true); // 16:00
  rv.setInt32(118, -1, true);
  const itemSize = 47, items = 4;
  const meta = new Uint8Array(16 + items * itemSize);
  const mv = new DataView(meta.buffer);
  mv.setUint32(0, 0xfadfadba, true); mv.setInt32(8, items, true);
  const nameBytes = ascii('M');
  const var2 = new Uint8Array(4 + nameBytes.length);
  new DataView(var2.buffer).setInt32(0, nameBytes.length, true);
  var2.set(nameBytes, 4);
  const tree: Record<string, CfbTreeNode> = {
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(893386752, 0) },
    '   114': {
      children: {
        Props: { data: props },
        TBkndTask: {
          children: {
            FixedMeta: { data: meta },
            FixedData: { data: record },
            VarMeta: { data: buildVarMetaBytes([{ uniqueId: 10, offset: 0, type: 14 }]) },
            Var2Data: { data: var2 },
          },
        },
      },
    },
  };
  return buildNestedCfb(tree);
}
{
  // 3 werkdagen (1440 min) met 2 dagen rest (960 min): hele dagen, dus geen subdagsignaal. Vóór F5b werd
  // dit een dagtaak (3 d, rest 2 d via uren per dag) zonder minuten.
  const r = quiet(() => readMPP(mppTaskBytes({ durationRaw: 14400, remainingRaw: 9600 })));
  const m = byName(r, 'M');
  eq('(1) .mpp: hele dagen ⇒ urenmaat met de minuten uit het bestand (T15)',
    [m?.time.durationUnit, m?.time.durationMinutes, m?.time.remainingMinutes, m?.time.scheduleDuration],
    ['hours', 1440, 960, 3]);
  ok('(1) .mpp: geen dagenrest naast de minuten', m?.time.remainingTime === undefined);
  // Een duur die geen hele dag is: 1470 min en 630 min rest, op de minuut.
  const s = byName(quiet(() => readMPP(mppTaskBytes({ durationRaw: 14700, remainingRaw: 6300 }))), 'M');
  eq('(1) .mpp: 1470 min met 630 min rest, op de minuut', [s?.time.durationUnit, s?.time.durationMinutes, s?.time.remainingMinutes],
    ['hours', 1470, 630]);
  // Tienden van een minuut (review #591 r1, punt 3). Het corpus heeft er 4 duren en 19 resten mee, zoals
  // `OzBuild Workshop 14 After Para 26.mpp`, taak-UID 15: rest 137095 tienden = 13709,5 min (was 13710).
  const t = byName(quiet(() => readMPP(mppTaskBytes({ durationRaw: 34284, remainingRaw: 137095 }))), 'M');
  eq('(1) .mpp: tienden blijven staan (3428,4 min, rest 13709,5 min)', [t?.time.durationMinutes, t?.time.remainingMinutes],
    [3428.4, 13709.5]);
  // Door de store, IFC en MSPDI: het `ExactMinutes`-record draagt de breuk (T14).
  for (const [step, doc] of await storeRoute('tienden.mpp', { bytes: mppTaskBytes({ durationRaw: 137095, remainingRaw: 137095 }) },
    p => quiet(() => writeMSPDI(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments, p.calendars,
      p.baselines, p.activeBaselineId, p.customTaskTypes)))) {
    const m2 = byName(doc, 'M');
    eq(`(1) .mpp 13709,5 min, ${step}`, [m2?.time.durationUnit, m2?.time.durationMinutes], ['hours', 13709.5]);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (2) .mpp: lag in minuten (I4)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// TBkndCons: FixedMeta itemSize 10, FixedData itemSize 20; zonder herkende applicatieversie de layout met
// de duureenheid op 14 en de duur op 16 (zelfde bouwers als check-mpp-relations.ts).
function consMeta(count: number): Uint8Array {
  const out = new Uint8Array(16 + count * 10);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0xfadfadba, true);
  view.setInt32(8, count, true);
  for (let i = 0; i < count; i++) view.setInt32(16 + i * 10 + 4, i * 20, true);
  return out;
}
function consRecord(uniqueId: number, pred: number, succ: number, durationUnits: number, duration: number): Uint8Array {
  const out = new Uint8Array(20);
  const view = new DataView(out.buffer);
  view.setInt32(0, uniqueId, true);
  view.setInt32(4, pred, true);
  view.setInt32(8, succ, true);
  view.setInt16(12, 1, true); // FS
  view.setInt16(14, durationUnits, true);
  view.setInt32(16, duration, true);
  return out;
}
{
  const ids = new Map<number, string>([[1, 'A'], [2, 'B'], [3, 'C'], [4, 'D'], [5, 'E'], [6, 'F'], [7, 'G']]);
  const records = [
    consRecord(100, 1, 2, 7, 9600), // 2 werkdagen in de weergave dagen: 960 min
    consRecord(101, 2, 3, 5, 1500), // 2,5 u: 150 min
    consRecord(102, 3, 4, 6, 7200), // 12 uur kalendertijd: 720 min, kalendertijd
    consRecord(103, 4, 5, 19, 500), // 50 % (geen minuten)
    consRecord(104, 5, 6, 5, 1505), // 150,5 min werktijd: de tienden blijven
    consRecord(105, 6, 7, 6, 7205), // 720,5 min kalendertijd: de tienden blijven
  ];
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: consMeta(records.length) }, FixedData: { data: concatBytes(...records) } } } } },
  }));
  const seqs = readRelations(cfb, null, ids);
  const lag = (succ: string) => {
    const s = seqs.find(x => x.successorId === succ);
    return s && [s.lagDays, s.lagMinutes ?? null, s.lagUnit ?? null, s.lagPercent ?? null];
  };
  eq('(2) .mpp-lag 2 d werktijd ⇒ 960 min, geen dagen', lag('B'), [0, 960, null, null]);
  eq('(2) .mpp-lag 2,5 u werktijd ⇒ 150 min', lag('C'), [0, 150, null, null]);
  eq('(2) .mpp-lag 12 uur kalendertijd ⇒ 720 min, kalendertijd', lag('D'), [0, 720, 'ELAPSEDTIME', null]);
  eq('(2) .mpp-lag 50 % blijft een procentlag', lag('E')?.[3], 50);
  eq('(2) .mpp-lag 150,5 min werktijd houdt zijn tienden', lag('F'), [0, 150.5, null, null]);
  eq('(2) .mpp-lag 720,5 min kalendertijd houdt zijn tienden', lag('G'), [0, 720.5, 'ELAPSEDTIME', null]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (3) XER: een taak op een dagkalender in de urenmaat
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Twee taken op een dagkalender van 8 u en één FS-relatie met 4 u lag. Ook gebruikt in (14).
const XER_FIXTURE = [
  'ERMHDR\t23.12\t2026-06-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tF5b\tC1\t2026-06-03',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tDagkalender\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date',
  '%R\tT1\tP1\tC1\tA\tLopend\tTT_Task\tTK_Active\tCP_Phys\t0\t50\t40\t16\t2026-06-01 08:00\t2026-06-05 16:00\t2026-06-01 08:00',
  '%R\tT2\tP1\tC1\tB\tVolgend\tTT_Task\tTK_NotStart\tCP_Drtn\t0\t\t16\t16\t2026-06-08 08:00\t2026-06-09 16:00\t',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tT2\tT1\tP1\tP1\tPR_FS\t4',
  '%E',
].join('\n');
{
  const opened = quiet(() => readXER(new TextEncoder().encode(XER_FIXTURE)));
  ok('(3) XER: één document', !isMultiDocumentImport(opened));
  if (!isMultiDocumentImport(opened)) {
    const a = byName(opened, 'Lopend');
    eq('(3) XER: dagkalender ⇒ urenmaat, 2400 min met 960 min rest (T15)',
      [a?.time.durationUnit, a?.time.durationMinutes, a?.time.remainingMinutes, a?.time.scheduleDuration],
      ['hours', 2400, 960, 5]);
    ok('(3) XER: geen dagenrest naast de minuten', a?.time.remainingTime === undefined);
    const b = byName(opened, 'Volgend');
    eq('(3) XER: niet gestart, 960 min', [b?.time.durationUnit, b?.time.durationMinutes], ['hours', 960]);
    const seq = opened.sequences[0];
    eq('(3) XER: lag 4 u ⇒ 240 min', [seq?.lagMinutes, seq?.lagDays], [240, 0.5]);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Gedeelde opzet voor (4)–(10): kalender ma–vr 08:00–16:00 (8 u), project ma 1 juni 2026.
// ════════════════════════════════════════════════════════════════════════════════════════════════
function task(name: string, start: string, finish: string, days: number, extra: Partial<TaskTime> = {}, rest: Partial<Task> = {}): Task {
  return {
    id: `t-${name}`, name, description: '', wbsCode: name, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      ...createDefaultTaskTime('2026-06-01', days), scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish, ...extra,
    },
    ...rest,
  };
}
function payload(tasks: Task[], statusDate?: string): DocumentPayload {
  const p = freshPayload();
  p.project = { ...p.project, startDate: '2026-06-01', ...(statusDate ? { statusDate } : {}) };
  p.calendar = { ...p.calendar, holidays: [], workStartHour: 8, workEndHour: 16, hoursPerDay: 8 };
  delete p.calendar.workTime;
  delete p.calendar.simpleBreakStartMinute;
  delete p.calendar.simpleBreakDurationMinutes;
  p.calendars = p.calendars.map(c => (c.id === p.calendar.id ? p.calendar : c));
  p.tasks = tasks;
  p.sequences = [];
  return p;
}
const done = (name: string, start: string, finish: string, days: number) =>
  task(name, start, finish, days, { actualStart: start, actualFinish: finish, completion: 1 }, { status: 'COMPLETED' });
/** Een ankerproject: elk moment is afleidbaar (D1 08:00, D2 16:00). */
const scalarProject = () => payload([
  done('Klaar', '2026-06-01T08:00', '2026-06-02T16:00', 2),
  task('Later', '2026-06-03T08:00', '2026-06-05T16:00', 3),
], '2026-06-03');
/** Een letterlijk project: een werkelijk begin om 10:00 is niet afleidbaar (T17). */
const literalProject = () => payload([
  done('Klaar', '2026-06-01T08:00', '2026-06-02T16:00', 2),
  task('Lopend', '2026-06-03T10:00', '2026-06-05T16:00', 3, { actualStart: '2026-06-03T10:00', completion: 0.2 }, { status: 'STARTED' }),
]);

type Fmt = {
  name: 'MSPDI' | 'P6 XML';
  write: (p: DocumentPayload) => string;
  read: (xml: string) => ImportResult;
  /** Het blok van de taak (MSPDI `<Task>`, P6 `<Activity>`) met deze naam. */
  block: (xml: string, name: string) => string;
  finishTag: string;
  actualFinishTag: string;
  /** Laat de markering `OPS_LiteralCalendars` weg: zo schreef OPS van v2026.9.0 tot F5b. */
  toF5a: (xml: string) => string;
  /** Laat elke OPS-definitie weg: een vreemd bestand. */
  toForeign: (xml: string) => string;
  /** Vervang de lijst door onleesbare tekst. */
  breakList: (xml: string) => string;
  listOf: (xml: string) => string | undefined;
};
const dropBlocks = (xml: string, tag: string, keep: (block: string) => boolean): string =>
  xml.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g'), b => (keep(b) ? b : ''));
const tagValue = (block: string, tag: string) => block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
const MSPDI: Fmt = {
  name: 'MSPDI',
  write: p => quiet(() => writeMSPDI(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments,
    p.calendars, p.baselines, p.activeBaselineId, p.customTaskTypes)),
  read: xml => quiet(() => readMSPDI(xml)),
  block: (xml, name) => xml.split('<Task>').slice(1).map(b => b.split('</Task>')[0]).find(b => b.includes(`<Name>${name}</Name>`)) ?? '',
  finishTag: 'Finish',
  actualFinishTag: 'ActualFinish',
  toF5a: xml => dropBlocks(xml, 'ExtendedAttribute', b => !b.includes('<FieldID>188744010</FieldID>')),
  toForeign: xml => xml.replace(/\s*<ExtendedAttributes>[\s\S]*?<\/ExtendedAttributes>/, ''),
  breakList: xml => xml.replace(/(<FieldID>188744010<\/FieldID>\s*<Value>)[^<]*(<\/Value>)/, '$1kapot$2'),
  listOf: xml => xml.match(/<FieldID>188744010<\/FieldID>\s*<Value>([^<]*)<\/Value>/)?.[1],
};
const P6: Fmt = {
  name: 'P6 XML',
  write: p => quiet(() => writeP6XML(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments, p.calendars, p.customTaskTypes)),
  read: xml => quiet(() => readP6XML(xml)),
  block: (xml, name) => xml.split('<Activity>').slice(1).map(b => b.split('</Activity>')[0]).find(b => b.includes(`<Name>${name}</Name>`)) ?? '',
  finishTag: 'PlannedFinishDate',
  actualFinishTag: 'ActualFinishDate',
  toF5a: xml => dropBlocks(dropBlocks(xml, 'UDFType', b => !b.includes('<ObjectId>900000007</ObjectId>')),
    'UDF', b => !b.includes('<TypeObjectId>900000007</TypeObjectId>')),
  toForeign: xml => dropBlocks(xml, 'UDFType', () => false),
  breakList: xml => xml.replace(/(<TypeObjectId>900000007<\/TypeObjectId>\s*<TextValue>)[^<]*(<\/TextValue>)/, '$1kapot$2'),
  listOf: xml => xml.match(/<TypeObjectId>900000007<\/TypeObjectId>\s*<TextValue>([^<]*)<\/TextValue>/)?.[1],
};
const FORMATS = [MSPDI, P6];
const datesOf = (t: Task | undefined) => t && [t.time.scheduleStart, t.time.scheduleFinish, t.time.actualStart ?? null, t.time.actualFinish ?? null];

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (4) P6 XML, knownbug 293: dagenmaat zonder record, één deling
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const p = payload([task('Dag', '2026-06-01T08:00', '2026-06-03T16:00', 3, { remainingTime: 2, completion: 1 / 3, actualStart: '2026-06-01T08:00' }, { status: 'STARTED' })]);
  const xml = P6.write(p);
  eq('(4) P6 XML: 3 d ⇒ PlannedDuration 24 u, rest 16 u', [tagValue(P6.block(xml, 'Dag'), 'PlannedDuration'), tagValue(P6.block(xml, 'Dag'), 'RemainingDuration')], ['24', '16']);
  const back = byName(P6.read(xml), 'Dag');
  eq('(4) P6 XML: dagenmaat 3 d met 2 d rest terug (24 u ÷ 8 u, één keer)',
    [back?.time.durationUnit, back?.time.scheduleDuration, back?.time.remainingTime], ['days', 3, 2]);
  // 10 u op een kalender van 8 u: 1,25 d, zonder record (een bestand van vóór F5a schreef er geen).
  const noRecord = xml.replace('<PlannedDuration>24</PlannedDuration>', '<PlannedDuration>10</PlannedDuration>')
    .replace('<RemainingDuration>16</RemainingDuration>', '<RemainingDuration>6</RemainingDuration>');
  const other = byName(P6.read(noRecord), 'Dag');
  eq('(4) P6 XML: 10 u en 6 u rest zonder record ⇒ 1,25 d en 0,75 d', [other?.time.scheduleDuration, other?.time.remainingTime], [1.25, 0.75]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (5) I8, schrijven: het einde met zijn echte tijd
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const fmt of FORMATS) {
  const xml = fmt.write(scalarProject());
  const k = fmt.block(xml, 'Klaar');
  eq(`(5) ${fmt.name}: einde en werkelijk einde 16:00, niet 08:00`,
    [tagValue(k, fmt.finishTag), tagValue(k, fmt.actualFinishTag)], ['2026-06-02T16:00:00', '2026-06-02T16:00:00']);
  eq(`(5) ${fmt.name}: geen letterlijke kalender in een ankerproject`, fmt.listOf(xml), '[]');
  // Een veld zonder tijd (de ruwe route, bijvoorbeeld een extensie): het moment volgens D1–D7.
  const raw = payload([done('Kaal', '2026-06-01', '2026-06-02', 2)]);
  const rawBlock = fmt.block(fmt.write(raw), 'Kaal');
  eq(`(5) ${fmt.name}: kaal einde ⇒ 16:00 (D2), kale start ⇒ 08:00 (D1)`,
    [tagValue(rawBlock, fmt.finishTag), tagValue(rawBlock, fmt.actualFinishTag)], ['2026-06-02T16:00:00', '2026-06-02T16:00:00']);
  eq(`(5) ${fmt.name}: letterlijk project ⇒ de projectkalender in de lijst`, fmt.listOf(fmt.write(literalProject())), '[1]');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (6) I8, rondgang: ankerkalender blijft scalair, letterlijke kalender wordt urenkalender
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const fmt of FORMATS) {
  const src = scalarProject();
  const read = fmt.read(fmt.write(src));
  ok(`(6) ${fmt.name}: ankerkalender blijft scalair (geen werkblokken)`, read.calendar.workTime === undefined);
  const loaded = load(read);
  eq(`(6) ${fmt.name}: na laden dezelfde momenten als de bron`, ['Klaar', 'Later'].map(n => datesOf(byName(loaded, n))),
    ['Klaar', 'Later'].map(n => datesOf(byName(src, n))));
  // Tweede ronde: dezelfde datums in het bestand.
  const again = fmt.write(loaded);
  eq(`(6) ${fmt.name}: tweede export dezelfde datums`, ['Klaar', 'Later'].map(n => [tagValue(fmt.block(again, n), fmt.finishTag), tagValue(fmt.block(again, n), fmt.actualFinishTag) ?? null]),
    ['Klaar', 'Later'].map(n => [tagValue(fmt.block(fmt.write(src), n), fmt.finishTag), tagValue(fmt.block(fmt.write(src), n), fmt.actualFinishTag) ?? null]));
  const lit = literalProject();
  const litRead = fmt.read(fmt.write(lit));
  ok(`(6) ${fmt.name}: letterlijke kalender wordt een urenkalender`, litRead.calendar.workTime !== undefined);
  eq(`(6) ${fmt.name}: letterlijk project na laden dezelfde momenten`, ['Klaar', 'Lopend'].map(n => datesOf(byName(load(litRead), n))),
    ['Klaar', 'Lopend'].map(n => datesOf(byName(lit, n))));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (7) Knownbug 274: een vreemd bestand met een werkelijk einde om precies 08:00
// ════════════════════════════════════════════════════════════════════════════════════════════════
// De eindmijlpaal uit review ronde 3 van PR #559, nu met een werkelijk einde om 08:00. Alle datums staan
// op 08:00, dus er is geen uursignaal en de kalender blijft scalair. Vóór F5b las de lezer 08:00 als
// daganker en maakte de laadgrens er 16:00 van.
{
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d =>
    `<StandardWorkHours><DayOfWeek>${d}</DayOfWeek><WorkTime><Start>08:00:00</Start><Finish>16:00:00</Finish></WorkTime></StandardWorkHours>`).join('');
  const P6_FOREIGN = `<?xml version="1.0"?><APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects">`
    + `<Calendar><ObjectId>1</ObjectId><Name>Bouw</Name><Type>Global</Type><HoursPerDay>8</HoursPerDay><StandardWorkWeek>${days}</StandardWorkWeek></Calendar>`
    + `<Project><ObjectId>10</ObjectId><Id>P</Id><Name>Oplevering</Name><ActivityDefaultCalendarObjectId>1</ActivityDefaultCalendarObjectId>`
    + `<PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate><DataDate>2026-06-02T08:00:00</DataDate>`
    + `<Activity><ObjectId>100</ObjectId><ProjectObjectId>10</ProjectObjectId><Id>M1</Id><Name>Oplevering</Name><Type>Finish Milestone</Type>`
    + `<CalendarObjectId>1</CalendarObjectId><PlannedDuration>0</PlannedDuration><PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>`
    + `<PlannedFinishDate>2026-06-01T08:00:00</PlannedFinishDate><ActualFinishDate>2026-06-01T08:00:00</ActualFinishDate><Status>Completed</Status></Activity>`
    + `</Project></APIBusinessObjects>`;
  const read = P6.read(P6_FOREIGN);
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml').documentElement;
  ok('(7) 274 P6 XML: geen vingerafdruk van een oude OPS-export', !isLegacyOpsP6Xml(parse(P6_FOREIGN)));
  ok('(7) 274 P6 XML: de kalender blijft scalair (08:00 is geen uursignaal)', read.calendar.workTime === undefined);
  const loaded = load(read);
  eq('(7) 274 P6 XML: werkelijk einde blijft 08:00 na laden', byName(loaded, 'Oplevering')?.time.actualFinish, '2026-06-01T08:00');
  const reopened = load(quiet(() => readIFC(writeIFC(buildWriteIFCInput(loaded)))));
  eq('(7) 274 P6 XML: ook na opslaan als IFC en heropenen', byName(reopened, 'Oplevering')?.time.actualFinish, '2026-06-01T08:00');
  eq('(7) 274 P6 XML: de statusdatum houdt zijn 08:00 (vreemd bestand)', loaded.project.statusDate, '2026-06-02T08:00');
  // Dezelfde mijlpaal in MSPDI, zonder OPS-definities.
  const MSPDI_FOREIGN = `<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><Name>Oplevering</Name>`
    + `<StartDate>2026-06-01T08:00:00</StartDate><StatusDate>2026-06-02T08:00:00</StatusDate><MinutesPerDay>480</MinutesPerDay><Tasks>`
    + `<Task><UID>1</UID><ID>1</ID><Name>Oplevering</Name><OutlineLevel>1</OutlineLevel><Milestone>1</Milestone>`
    + `<Start>2026-06-01T08:00:00</Start><Finish>2026-06-01T08:00:00</Finish><Duration>PT0H0M0S</Duration>`
    + `<ActualStart>2026-06-01T08:00:00</ActualStart><ActualFinish>2026-06-01T08:00:00</ActualFinish><PercentComplete>100</PercentComplete></Task>`
    + `</Tasks></Project>`;
  ok('(7) 274 MSPDI: geen vingerafdruk van een oude OPS-export', !isLegacyOpsMspdi(parse(MSPDI_FOREIGN)));
  const m = load(MSPDI.read(MSPDI_FOREIGN));
  eq('(7) 274 MSPDI: werkelijk einde blijft 08:00 na laden', byName(m, 'Oplevering')?.time.actualFinish, '2026-06-01T08:00');
  eq('(7) 274 MSPDI: de statusdatum houdt zijn 08:00 (vreemd bestand)', m.project.statusDate, '2026-06-02T08:00');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (8) Een OPS-export van de basis (F5a) en van v2026.10.0: een echte 08:00 op een urenkalender (punt 1)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Uitvoer van de ECHTE writers (herkomst: `tests/fixtures/legacyOpsExports.ts`). Een voltooide urentaak van
// 07:00 tot 08:00 (60 min) en een opvolger van 08:00 tot 10:00, op een kalender van 07:00 tot 15:00. Beide
// bestanden dragen de duureenheidmarkering, geen lijst (`opsAnchor`). De kalender wordt een urenkalender (de
// duur van 60 min is korter dan een werkdag), dus de writer schreef elke tijd als moment. Vóór fixronde 1 las
// F5b elke 08:00 hier als anker: het werkelijke einde werd het dageinde 15:00, de start van de opvolger 07:00.
const SOURCES_PUNT1 = [
  { label: 'basis F5a', fmt: MSPDI, xml: F5A_BASE_MSPDI },
  { label: 'basis F5a', fmt: P6, xml: F5A_BASE_P6 },
  { label: 'v2026.10.0', fmt: MSPDI, xml: V2026_10_0_MSPDI },
  { label: 'v2026.10.0', fmt: P6, xml: V2026_10_0_P6 },
];
for (const { label, fmt, xml } of SOURCES_PUNT1) {
  const read = fmt.read(xml);
  ok(`(8) ${label} ${fmt.name}: de kalender wordt een urenkalender`, read.calendar.workTime !== undefined);
  eq(`(8) ${label} ${fmt.name}: de lezer houdt 08:00`, [byName(read, 'Voltooid 07-08')?.time.actualFinish, byName(read, 'Opvolger 08-10')?.time.scheduleStart],
    ['2026-06-01T08:00', '2026-06-01T08:00']);
  for (const [step, doc] of await storeRoute('oude-export.xml', { text: xml }, fmt.write)) {
    const a = byName(doc, 'Voltooid 07-08');
    eq(`(8) ${label} ${fmt.name}, ${step}: voltooide urentaak 07:00–08:00`, [a?.time.actualStart, a?.time.actualFinish, a?.time.durationMinutes],
      ['2026-06-01T07:00', '2026-06-01T08:00', 60]);
    const b = byName(doc, 'Opvolger 08-10');
    eq(`(8) ${label} ${fmt.name}, ${step}: de opvolger 08:00–10:00`, [b?.time.scheduleStart, b?.time.earlyStart, b?.time.earlyFinish],
      ['2026-06-01T08:00', '2026-06-01T08:00', '2026-06-01T10:00']);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (9) De statusdatum: anker in een OPS-bestand, echte tijd in een vreemd bestand
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const fmt of FORMATS) {
  const xml = fmt.write(scalarProject()); // statusdatum 2026-06-03 zonder tijd ⇒ geschreven als 08:00
  eq(`(9) ${fmt.name}: OPS-bestand (F5b) ⇒ statusdatum zonder tijd terug`, fmt.read(xml).project.statusDate, '2026-06-03');
  eq(`(9) ${fmt.name}: OPS-bestand (F5a) ⇒ statusdatum zonder tijd terug`, fmt.read(fmt.toF5a(xml)).project.statusDate, '2026-06-03');
  eq(`(9) ${fmt.name}: vreemd bestand ⇒ 08:00 is een echte tijd`, fmt.read(fmt.toForeign(xml)).project.statusDate, '2026-06-03T08:00');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (10) Een onleesbare lijst: de tijden blijven echt, de promotie volgt het tijdsignaal
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const fmt of FORMATS) {
  const src = scalarProject();
  const read = fmt.read(fmt.breakList(fmt.write(src)));
  ok(`(10) ${fmt.name}: zonder geldige lijst telt het tijdsignaal (einde 16:00) ⇒ urenkalender`, read.calendar.workTime !== undefined);
  eq(`(10) ${fmt.name}: na laden dezelfde momenten als de bron`, ['Klaar', 'Later'].map(n => datesOf(byName(load(read), n))),
    ['Klaar', 'Later'].map(n => datesOf(byName(src, n))));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (11) Een OPS-export van v2026.7.0 en v2026.8.1: geen markering, wel de vingerafdruk (punt 2)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Uitvoer van de ECHTE writers (herkomst: `tests/fixtures/legacyOpsExports.ts`; v2026.6.0 schrijft hetzelfde
// als v2026.7.0, v2026.7.14 en v2026.8.0 hetzelfde als v2026.8.1). Een voltooide dagtaak van ma 1 tot di 2
// juni en een opvolger van 3 tot 4 juni, op een kalender van 08:00 tot 16:00. De writer schreef elke datum
// zonder tijd als het anker 08:00. Vóór fixronde 1 las F5b zo'n bestand als vreemd bestand: het einde bleef
// 2 juni 08:00 in plaats van 16:00.
// v2026.7.0 schreef nog geen statusdatum.
const SOURCES_PUNT2 = [
  { label: 'v2026.8.1', fmt: MSPDI, xml: LEGACY_V2026_8_1_MSPDI, statusDate: '2026-06-03' },
  { label: 'v2026.8.1', fmt: P6, xml: LEGACY_V2026_8_1_P6, statusDate: '2026-06-03' },
  { label: 'v2026.7.0', fmt: MSPDI, xml: LEGACY_V2026_7_0_MSPDI, statusDate: undefined },
  { label: 'v2026.7.0', fmt: P6, xml: LEGACY_V2026_7_0_P6, statusDate: undefined },
];
const rootOf = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml').documentElement;
const legacy = (fmt: Fmt, xml: string) => (fmt === MSPDI ? isLegacyOpsMspdi(rootOf(xml)) : isLegacyOpsP6Xml(rootOf(xml)));
for (const { label, fmt, xml, statusDate } of SOURCES_PUNT2) {
  ok(`(11) ${label} ${fmt.name}: de vingerafdruk herkent de export`, legacy(fmt, xml));
  const read = fmt.read(xml);
  ok(`(11) ${label} ${fmt.name}: de kalender blijft scalair (alleen ankers)`, read.calendar.workTime === undefined);
  eq(`(11) ${label} ${fmt.name}: 08:00 is het anker ⇒ datums zonder tijd`,
    ['Voltooid 1-2 juni', 'Opvolger 3-4 juni'].map(n => datesOf(byName(read, n))),
    [['2026-06-01', '2026-06-02', '2026-06-01', '2026-06-02'], ['2026-06-03', '2026-06-04', null, null]]);
  for (const [step, doc] of await storeRoute('oude-export.xml', { text: xml }, fmt.write)) {
    const end = doc.calendar.workEndHour;
    const clock = `${String(end).padStart(2, '0')}:00`;
    eq(`(11) ${label} ${fmt.name}, ${step}: voltooide taak eindigt op 2 juni om het dageinde`,
      byName(doc, 'Voltooid 1-2 juni')?.time.actualFinish, `2026-06-02T${clock}`);
    eq(`(11) ${label} ${fmt.name}, ${step}: de opvolger eindigt op 4 juni om het dageinde`,
      byName(doc, 'Opvolger 3-4 juni')?.time.scheduleFinish, `2026-06-04T${clock}`);
    eq(`(11) ${label} ${fmt.name}, ${step}: de statusdatum blijft een datum (anker)`, doc.project.statusDate, statusDate);
  }
}
{
  // Het dageinde in (11) is de kalender van het bestand: 16:00 voor v2026.8.1.
  const doc = (await storeRoute('oude-export.xml', { text: LEGACY_V2026_8_1_MSPDI }, MSPDI.write))[0][1];
  eq('(11) v2026.8.1 MSPDI: het dageinde is 16:00', byName(doc, 'Voltooid 1-2 juni')?.time.actualFinish, '2026-06-02T16:00');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (12) De vingerafdruk is streng: één afwijking, en het bestand is een vreemd bestand
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Elke variant wijkt op één punt af van de echte export van v2026.8.1. Dan geldt de regel voor een vreemd
// bestand: 08:00 is een echte tijd. Ook de vreemde bestanden uit (7) en een export van nu herkent hij niet.
{
  const mspdiVariants: [string, string][] = [
    // Na de kop, zodat alleen de eis "geen `<SaveVersion>`" hem tegenhoudt.
    ['met <SaveVersion>', LEGACY_V2026_8_1_MSPDI.replace('<StatusDate>2026-06-03T08:00:00</StatusDate>',
      '<StatusDate>2026-06-03T08:00:00</StatusDate>\n  <SaveVersion>14</SaveVersion>')],
    ['CreationDate niet op het anker', LEGACY_V2026_8_1_MSPDI.replace('<CreationDate>2026-06-01T08:00:00</CreationDate>', '<CreationDate>2026-06-01T09:12:00</CreationDate>')],
    ['samenvattingstaak met een extra veld', LEGACY_V2026_8_1_MSPDI.replace('<Summary>1</Summary>', '<Summary>1</Summary><Type>1</Type>')],
    ['taak met een andere volgorde', LEGACY_V2026_8_1_MSPDI.replace(/<Duration>PT16H0M0S<\/Duration>\s*<Start>2026-06-01T08:00:00<\/Start>/,
      '<Start>2026-06-01T08:00:00</Start><Duration>PT16H0M0S</Duration>')],
  ];
  for (const [what, xml] of mspdiVariants) {
    ok(`(12) MSPDI ${what}: opzet wijkt af`, xml !== LEGACY_V2026_8_1_MSPDI);
    ok(`(12) MSPDI ${what}: niet herkend`, !isLegacyOpsMspdi(rootOf(xml)));
    eq(`(12) MSPDI ${what}: 08:00 is een echte tijd`, byName(MSPDI.read(xml), 'Voltooid 1-2 juni')?.time.actualFinish, '2026-06-02T08:00');
  }
  const activities = LEGACY_V2026_8_1_P6.match(/<Activity>[\s\S]*?<\/Activity>/g) ?? [];
  const nested = activities.reduce((xml, act) => xml.replace(act, ''), LEGACY_V2026_8_1_P6)
    .replace('</Project>', `${activities.join('')}</Project>`);
  const p6Variants: [string, string][] = [
    ['activiteiten in het project', nested],
    ['project met een extra veld', LEGACY_V2026_8_1_P6.replace('<Status>Planned</Status>', '<Status>Planned</Status><WBSCodeSeparator>.</WBSCodeSeparator>')],
    ['project-ObjectId niet 1', LEGACY_V2026_8_1_P6.replace('<ObjectId>1</ObjectId>\n    <Id>proj-oud</Id>', '<ObjectId>7</ObjectId>\n    <Id>proj-oud</Id>')],
  ];
  for (const [what, xml] of p6Variants) {
    ok(`(12) P6 XML ${what}: opzet wijkt af`, xml !== LEGACY_V2026_8_1_P6);
    ok(`(12) P6 XML ${what}: niet herkend`, !isLegacyOpsP6Xml(rootOf(xml)));
  }
  eq('(12) P6 XML met een extra projectveld: 08:00 is een echte tijd',
    byName(P6.read(p6Variants[1][1]), 'Voltooid 1-2 juni')?.time.actualFinish, '2026-06-02T08:00');
  for (const fmt of FORMATS) {
    ok(`(12) ${fmt.name}: een export van nu valt niet onder de vingerafdruk`, !legacy(fmt, fmt.write(scalarProject())));
    ok(`(12) ${fmt.name}: zonder OPS-definities ook niet`, !legacy(fmt, fmt.toForeign(fmt.write(scalarProject()))));
    ok(`(12) ${fmt.name}: de basis en v2026.10.0 ook niet (die hebben de markering)`,
      !legacy(fmt, fmt === MSPDI ? F5A_BASE_MSPDI : F5A_BASE_P6) && !legacy(fmt, fmt === MSPDI ? V2026_10_0_MSPDI : V2026_10_0_P6));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (13) Een lag met tienden van een minuut door de hele route (review #591 r2; was knownbug 309)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Twee taken (UID 10 en 11) en één FS-relatie in TBkndCons, MPP14, zoals de probe van de review. De lag staat
// in tienden van een minuut. Vóór fixronde 2 werd 150,5 min na IFC opslaan en na MSPDI heropenen 151 min.
function mppLagBytes(unitCode: number, rawLag: number): Uint8Array {
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
    { key: 37748744, data: text('Lag') },
  ]);
  const data = new Uint8Array(260);
  for (let n = 0; n < 2; n++) {
    const r = new DataView(data.buffer, n * 130, 130);
    r.setInt32(0, 10 + n, true); r.setInt32(4, 1 + n, true); r.setInt16(40, 1, true);
    r.setInt32(42, 4800, true); r.setInt16(46, 0, true); r.setInt32(52, 4800, true); r.setInt16(56, 0, true);
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
  return buildNestedCfb({
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(893386752, 0) },
    '   114': {
      children: {
        Props: { data: props },
        TBkndTask: { children: { FixedMeta: { data: meta }, FixedData: { data }, VarMeta: { data: buildVarMetaBytes(entries) }, Var2Data: { data: varData } } },
        TBkndCons: { children: { FixedMeta: { data: consMeta(1) }, FixedData: { data: consRecord(100, 10, 11, unitCode, rawLag) } } },
      },
    },
  });
}
const LAG_CASES = [
  { label: '150,5 min werktijd', unit: 5, raw: 1505, minutes: 150.5, lagUnit: null, lagFormat: '7' },
  { label: '720,5 min kalendertijd', unit: 6, raw: 7205, minutes: 720.5, lagUnit: 'ELAPSEDTIME', lagFormat: '6' },
];
const lagOf = (doc: DocumentPayload) => {
  const seq = doc.sequences[0];
  return [doc.sequences.length, seq?.lagDays, seq?.lagMinutes ?? null, seq?.lagUnit ?? null];
};
const linkLagOf = (xml: string) => [tagValue(xml, 'LinkLag'), tagValue(xml, 'LagFormat')];
for (const c of LAG_CASES) {
  const want = [1, 0, c.minutes, c.lagUnit];
  const opened = await openAndRecalc('lag.mpp', { bytes: mppLagBytes(c.unit, c.raw) });
  eq(`(13) ${c.label}: .mpp in de store, na Bereken`, lagOf(opened), want);
  // IFC: het slot draagt hele minuten, het record de breuk.
  const ifc = quiet(() => writeIFC(buildWriteIFCInput(opened)));
  const record = ifc.match(/IFCPROPERTYSINGLEVALUE\('ExactMinuteLags',\$,IFCTEXT\('\{"[^"]+":(\[[^\]]*\])\}'\),\$\)/)?.[1];
  eq(`(13) ${c.label}: IFC-record [exacte minuten, geschreven minuten]`, record, `[${c.minutes},${Math.round(c.minutes)}]`);
  const reopened = await openAndRecalc('lag.ifc', { text: ifc });
  eq(`(13) ${c.label}: IFC opgeslagen, heropend en berekend`, lagOf(reopened), want);
  // Leesregel: wijzigde een ander programma de lengte in het slot, dan telt het record niet.
  const slot = ifc.match(/IFCLAGTIME\('Lag',\.PREDICTED\.,\$,IFCDURATION\('-?PT[^']*'\)/)?.[0];
  ok(`(13) ${c.label}: opzet, het lagslot gevonden`, slot !== undefined);
  const changed = await openAndRecalc('lag-gewijzigd.ifc',
    { text: ifc.replace(slot ?? '', "IFCLAGTIME('Lag',.PREDICTED.,$,IFCDURATION('PT3H0M0S')") });
  eq(`(13) ${c.label}: IFC met een ander slot ⇒ het slot geldt (180 min)`, changed.sequences[0]?.lagMinutes, 180);
  // MSPDI: twee keer heen en terug.
  const mspdi1 = MSPDI.write(reopened);
  eq(`(13) ${c.label}: MSPDI LinkLag in tienden`, linkLagOf(mspdi1), [String(c.raw), c.lagFormat]);
  const m1 = await openAndRecalc('lag.xml', { text: mspdi1 });
  eq(`(13) ${c.label}: MSPDI heropend en berekend`, lagOf(m1), want);
  const mspdi2 = MSPDI.write(m1);
  eq(`(13) ${c.label}: tweede MSPDI-export dezelfde LinkLag`, linkLagOf(mspdi2), [String(c.raw), c.lagFormat]);
  eq(`(13) ${c.label}: tweede MSPDI-export heropend`, lagOf(await openAndRecalc('lag-2.xml', { text: mspdi2 })), want);
  // P6 XML: twee keer heen en terug.
  const p6a = P6.write(reopened);
  const p1 = await openAndRecalc('lag-p6.xml', { text: p6a });
  eq(`(13) ${c.label}: P6 XML heropend en berekend`, lagOf(p1), want);
  const p6b = P6.write(p1);
  eq(`(13) ${c.label}: tweede P6-export dezelfde <Lag>`, tagValue(p6b, 'Lag'), tagValue(p6a, 'Lag'));
  eq(`(13) ${c.label}: tweede P6-export heropend`, lagOf(await openAndRecalc('lag-p6-2.xml', { text: p6b })), want);
}
{
  // Hele minuten krijgen geen record.
  const whole = await openAndRecalc('lag.mpp', { bytes: mppLagBytes(5, 1500) });
  ok('(13) 150 min: geen ExactMinuteLags in IFC', !quiet(() => writeIFC(buildWriteIFCInput(whole))).includes('ExactMinuteLags'));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (14) Een XER-lag met een breuk in minuten door de hele route (review #591 r3; was knownbug 307)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// XER telt een lag in uren als kommagetal. Vóór fixronde 3 werd 0,33 u (19,8 min) 20 min: in de store, na
// IFC en in MSPDI (`LinkLag` 200).
{
  const xerWithLag = (hours: string) => {
    const text = XER_FIXTURE.replace('PR_FS\t4', `PR_FS\t${hours}`);
    ok(`(14) opzet: lag ${hours} u in de fixture`, text !== XER_FIXTURE);
    return new TextEncoder().encode(text);
  };
  const lagMinOf = (doc: { sequences: DocumentPayload['sequences'] }) => {
    const seq = doc.sequences[0];
    return [doc.sequences.length, seq?.lagMinutes ?? null, seq?.lagUnit ?? null];
  };
  const want = [1, 19.8, null];
  const direct = quiet(() => readXER(xerWithLag('0.33')));
  if (!isMultiDocumentImport(direct)) eq('(14) XER 0,33 u: readXER', lagMinOf(direct), want);
  // 0,12 × 60 = 7,199999999999999 in een float; de lezer maakt er 7,2 van.
  const noise = quiet(() => readXER(xerWithLag('0.12')));
  if (!isMultiDocumentImport(noise)) eq('(14) XER 0,12 u: precies 7,2 min, zonder floatruis', noise.sequences[0]?.lagMinutes, 7.2);
  const opened = await openAndRecalc('lag.xer', { bytes: xerWithLag('0.33') });
  eq('(14) XER 0,33 u: in de store, na Bereken', lagMinOf(opened), want);
  const ifc = quiet(() => writeIFC(buildWriteIFCInput(opened)));
  const record = ifc.match(/IFCPROPERTYSINGLEVALUE\('ExactMinuteLags',\$,IFCTEXT\('\{"[^"]+":(\[[^\]]*\])\}'\),\$\)/)?.[1];
  eq('(14) XER 0,33 u: IFC-record [19.8,20]', record, '[19.8,20]');
  const reopened = await openAndRecalc('lag.ifc', { text: ifc });
  eq('(14) XER 0,33 u: IFC opgeslagen, heropend en berekend', lagMinOf(reopened), want);
  const mspdi = MSPDI.write(reopened);
  eq('(14) XER 0,33 u: MSPDI LinkLag in tienden', linkLagOf(mspdi), ['198', '7']);
  eq('(14) XER 0,33 u: MSPDI heropend en berekend', lagMinOf(await openAndRecalc('lag.xml', { text: mspdi })), want);
  const p6 = P6.write(reopened);
  eq('(14) XER 0,33 u: P6 XML <Lag> in uren', Number(tagValue(p6, 'Lag')), 0.33);
  eq('(14) XER 0,33 u: P6 XML heropend en berekend', lagMinOf(await openAndRecalc('lag-p6.xml', { text: p6 })), want);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (15) XER-duur en -rest op de hele minuut; een breuk in minuten (.mpp) door de hele route
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Fixronde 3 (review #591 r3) liet de afronding van XER-duur en -rest weg: 40,33 u werd 2419,8 min. Dat maakte
// 29 P6-cellen onexact (regel A; measure:profiles met het P6-corpus, meting 2026-10-26). De lezer rondt duur en
// rest daarom weer af op de hele minuut, ook in de percentagetak van een lopende `CP_Drtn`-taak (was knownbug
// 315). De lag houdt zijn breuk (14).
{
  // Taak C is lopend met `CP_Drtn` en 33,33 % gereed. Zijn rest komt uit de percentagetak, niet uit
  // `remain_drtn_hr_cnt` (40,33 u, dus 2420 min als de tak niet loopt).
  const text = XER_FIXTURE
    .replace('CP_Phys\t0\t50\t40\t16\t', 'CP_Phys\t0\t50\t40.33\t16.33\t')
    .replace('CP_Drtn\t0\t\t16\t16\t', 'CP_Drtn\t0\t\t16.33\t16.33\t')
    .replace('\n%T\tTASKPRED', '\n%R\tT3\tP1\tC1\tC\tLopend op duur\tTT_Task\tTK_Active\tCP_Drtn\t33.33\t\t40.33\t40.33'
      + '\t2026-06-01 08:00\t2026-06-05 16:00\t2026-06-01 08:00\n%T\tTASKPRED');
  ok('(15) opzet: duur en rest met een breuk in de fixture, en een lopende CP_Drtn-taak',
    text.includes('CP_Phys\t0\t50\t40.33\t16.33\t') && text.includes('CP_Drtn\t0\t\t16.33\t16.33\t')
    && text.includes('\tLopend op duur\tTT_Task\tTK_Active\tCP_Drtn\t33.33\t'));
  const minutesOf = (doc: { tasks: Task[] }) => ['Lopend', 'Volgend', 'Lopend op duur'].map(name => {
    const t = byName(doc, name);
    return [t?.time.durationUnit, t?.time.durationMinutes, t?.time.remainingMinutes];
  });
  // 40,33 u = 2419,8 min ⇒ 2420; 16,33 u = 979,8 min ⇒ 980; percentagetak 2419,8 × (1 − 0,3333) = 1613,28 ⇒ 1613.
  const want = [['hours', 2420, 980], ['hours', 980, 980], ['hours', 2420, 1613]];
  const direct = quiet(() => readXER(new TextEncoder().encode(text)));
  ok('(15) XER: één document', !isMultiDocumentImport(direct));
  if (!isMultiDocumentImport(direct)) eq('(15) XER 40,33 u en 16,33 u: readXER op de hele minuut', minutesOf(direct), want);
  const opened = await openAndRecalc('duur.xer', { bytes: new TextEncoder().encode(text) });
  eq('(15) XER: in de store, na Bereken', minutesOf(opened), want);
  const reopened = await openAndRecalc('duur.ifc', { text: quiet(() => writeIFC(buildWriteIFCInput(opened))) });
  eq('(15) XER: IFC opgeslagen, heropend en berekend', minutesOf(reopened), want);
}
{
  // Een breuk in minuten in duur en rest blijft exact door de store, IFC, MSPDI en P6 XML. De bron is nu een
  // `.mpp` in tienden van een minuut (24198 en 9798 tienden), met dezelfde getallen als vroeger uit XER.
  const minutesOf = (doc: { tasks: Task[] }) => {
    const t = byName(doc, 'M');
    return [t?.time.durationUnit, t?.time.durationMinutes, t?.time.remainingMinutes];
  };
  const want = ['hours', 2419.8, 979.8];
  const opened = await openAndRecalc('duur.mpp', { bytes: mppTaskBytes({ durationRaw: 24198, remainingRaw: 9798 }) });
  eq('(15) .mpp 2419,8 en 979,8 min: in de store, na Bereken', minutesOf(opened), want);
  const reopened = await openAndRecalc('duur.ifc', { text: quiet(() => writeIFC(buildWriteIFCInput(opened))) });
  eq('(15) .mpp: IFC opgeslagen, heropend en berekend', minutesOf(reopened), want);
  eq('(15) .mpp: MSPDI heropend en berekend', minutesOf(await openAndRecalc('duur.xml', { text: MSPDI.write(reopened) })), want);
  eq('(15) .mpp: P6 XML heropend en berekend', minutesOf(await openAndRecalc('duur-p6.xml', { text: P6.write(reopened) })), want);
}

if (errors.length) {
  for (const e of errors) console.log(`XX uren-f5b: ${e}`);
  process.exitCode = 1;
} else {
  console.log(`OK uren-f5b: ${checks} controles groen`);
}
