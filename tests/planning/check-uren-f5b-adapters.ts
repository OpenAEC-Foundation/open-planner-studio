// F5b: .mpp, XER en het 08:00-anker (spec `docs/superpowers/specs/2026-10-20-alleen-uren-design.md`
// §1.3 I4 en I8, §3.10; T15, T17; knownbugs 274, 275 en 293).
//
// Wat deze check vastlegt:
//  (1) .mpp (I4): duur en rest zijn de minuten uit het bestand, altijd in de urenmaat (T15), ook bij hele
//      dagen op een kalender die niet promoveert;
//  (2) .mpp (I4): een werktijdlag in dagen of uren wordt minuten (`lagMinutes`), zonder omweg via uren per dag;
//      een kalendertijdlag in uren ook, met de eenheid kalendertijd;
//  (3) XER: een taak op een dagkalender krijgt de urenmaat met de minuten van duur en rest; de lag blijft
//      minuten;
//  (4) P6 XML (knownbug 293): de dagenmaat zonder record is minuten ÷ minuten per dag, één keer gedeeld;
//  (5) I8, schrijven: MSPDI en P6 XML schrijven een einde met zijn echte tijd (16:00, niet 08:00), ook voor
//      een veld zonder tijd (D1–D7); de markering `OPS_LiteralCalendars` noemt de letterlijke kalenders;
//  (6) I8, rondgang: een ankerkalender blijft scalair, een letterlijke kalender wordt een urenkalender, en
//      na laden zijn alle momenten gelijk aan de bron;
//  (7) knownbug 274: in een vreemd bestand blijft een werkelijk einde om 08:00 08:00, ook na IFC-heropenen;
//  (8) knownbug 275: in een OPS-export van v2026.9.0 tot F5b is 08:00 het anker, ook op een urenkalender;
//  (9) de statusdatum: 08:00 is in een vreemd bestand een echte tijd, in een OPS-bestand het anker;
// (10) een onleesbare lijst: de tijden blijven echt; de promotie volgt het tijdsignaal.
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
const byName = (r: { tasks: Task[] }, name: string) => r.tasks.find(t => t.name === name);
const load = (r: ImportResult): DocumentPayload => payloadFromImport(r, null);

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
  const ids = new Map<number, string>([[1, 'A'], [2, 'B'], [3, 'C'], [4, 'D'], [5, 'E']]);
  const records = [
    consRecord(100, 1, 2, 7, 9600), // 2 werkdagen in de weergave dagen: 960 min
    consRecord(101, 2, 3, 5, 1500), // 2,5 u: 150 min
    consRecord(102, 3, 4, 6, 7200), // 12 uur kalendertijd: 720 min, kalendertijd
    consRecord(103, 4, 5, 19, 500), // 50 % (geen minuten)
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
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (3) XER: een taak op een dagkalender in de urenmaat
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const XER = [
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
  const opened = quiet(() => readXER(new TextEncoder().encode(XER)));
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
  task('Lopend', '2026-06-03T10:00', '2026-06-05T16:00', 3, { actualStart: '2026-06-03T10:00', completion: 0.2 }, { status: 'IN_PROGRESS' }),
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
const setInBlock = (xml: string, fmt: Fmt, name: string, tag: string, value: string): string => {
  const block = fmt.block(xml, name);
  ok(`opzet ${fmt.name}: <${tag}> van ${name} gevonden`, new RegExp(`<${tag}>[^<]*</${tag}>`).test(block));
  return xml.replace(block, block.replace(new RegExp(`<${tag}>[^<]*</${tag}>`), `<${tag}>${value}</${tag}>`));
};

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (4) P6 XML, knownbug 293: dagenmaat zonder record, één deling
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const p = payload([task('Dag', '2026-06-01T08:00', '2026-06-03T16:00', 3, { remainingTime: 2, completion: 1 / 3, actualStart: '2026-06-01T08:00' }, { status: 'IN_PROGRESS' })]);
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
  const m = load(MSPDI.read(MSPDI_FOREIGN));
  eq('(7) 274 MSPDI: werkelijk einde blijft 08:00 na laden', byName(m, 'Oplevering')?.time.actualFinish, '2026-06-01T08:00');
  eq('(7) 274 MSPDI: de statusdatum houdt zijn 08:00 (vreemd bestand)', m.project.statusDate, '2026-06-02T08:00');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (8) Knownbug 275: een OPS-export van v2026.9.0 tot F5b, 08:00 op een urenkalender
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Het letterlijke project zonder de markering `OPS_LiteralCalendars`. Het werkelijke begin om 10:00 maakt de
// kalender een urenkalender. Het werkelijke einde van "Klaar" staat op het anker 08:00, zoals die writer een
// datum zonder tijd schreef. Vóór F5b las de lezer daar 08:00; het is het einde van de werkdag, 16:00 (D2).
for (const fmt of FORMATS) {
  const xml = setInBlock(fmt.toF5a(fmt.write(literalProject())), fmt, 'Klaar', fmt.actualFinishTag, '2026-06-02T08:00:00');
  eq(`(8) opzet ${fmt.name}: geen lijst meer`, fmt.listOf(xml), undefined);
  const read = fmt.read(xml);
  ok(`(8) 275 ${fmt.name}: de kalender wordt een urenkalender (10:00)`, read.calendar.workTime !== undefined);
  const loaded = load(read);
  eq(`(8) 275 ${fmt.name}: 08:00 is het anker ⇒ werkelijk einde 16:00`, byName(loaded, 'Klaar')?.time.actualFinish, '2026-06-02T16:00');
  eq(`(8) 275 ${fmt.name}: de echte tijd 10:00 blijft`, byName(loaded, 'Lopend')?.time.actualStart, '2026-06-03T10:00');
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

if (errors.length) {
  for (const e of errors) console.log(`XX uren-f5b: ${e}`);
  process.exitCode = 1;
} else {
  console.log(`OK uren-f5b: ${checks} controles groen`);
}
