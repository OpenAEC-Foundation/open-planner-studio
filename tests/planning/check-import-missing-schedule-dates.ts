// Import/export-audit, vervolg op bevinding 6: een ONTBREKENDE geplande start in een ingelezen bestand
// werd in elke lezer de leesdatum ("vandaag"). Een wortel-taak gebruikt zijn eigen start als anker in
// de forward pass, dus hij verhuisde naar vandaag — en een voltooide taak zonder actuals werd "vandaag
// gedaan". Nu (één gedeelde regel, `resolveMissingScheduleDates` in services/importDates.ts, vóór
// `normalizeImportedProgress`):
//   - ontbrekende start ⇒ de projectstart (zoals `addTask`); ontbreekt die ook ⇒ de vroegste
//     AANWEZIGE taakstart; pas bij een project zonder enige datum ⇒ vandaag;
//   - ontbrekende finish ⇒ start + duur waar dat eenduidig is (nul-duur, of hele werkdagen op de
//     effectieve kalender); anders blijft de plaatshouder van de lezer staan.
// Per lezer getoetst: CSV, MSPDI, P6, IFC en MPP. Ankerjaar 2015 zodat "vandaag" nooit toevallig
// klopt. Draait via run.sh. Exit 0 = alles groen.

import { installDOMParser } from './xmldom-shim';
import { useAppStore } from '@/state/appStore';
import { readCSV } from '@/services/csv/csvReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { readMPP } from '@/services/mpp/mppReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import {
  buildNestedCfb, encodeCompObjFileFormat, encodePropsEntries, encodePropsSingleByteEntry,
  buildVarMetaBytes, type CfbTreeNode,
} from './mppFixtures';

installDOMParser();

const S = () => useAppStore.getState();
const THIS_YEAR = new Date().getFullYear().toString();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(`${label} (kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)})`,
    JSON.stringify(got) === JSON.stringify(want));
}
const byName = (tasks: readonly Task[], name: string): Task => {
  const t = tasks.find(x => x.name === name);
  if (!t) throw new Error(`taak ${name} ontbreekt`);
  return t;
};
const dates = (t: Task) => ({
  start: t.time.scheduleStart.slice(0, 10), finish: t.time.scheduleFinish.slice(0, 10),
  earlyStart: t.time.earlyStart.slice(0, 10), earlyFinish: t.time.earlyFinish.slice(0, 10),
});

/** Gedeelde verwachtingen voor een lezer: B (3 werkdagen, voltooid zonder actuals) en M (mijlpaal)
 *  droegen geen geplande start/finish; A wel. */
function expectResolved(tag: string, parsed: ImportResult, anchor: string, bFinish: string): void {
  const b = byName(parsed.tasks, 'B');
  const m = byName(parsed.tasks, 'M');
  eq(`${tag}: B zonder start/finish ⇒ start = anker, finish = start + 3 werkdagen (early spiegelt)`,
    dates(b), { start: anchor, finish: bFinish, earlyStart: anchor, earlyFinish: bFinish });
  eq(`${tag}: mijlpaal M zonder datums ⇒ start = finish = anker`,
    [m.time.scheduleStart.slice(0, 10), m.time.scheduleFinish.slice(0, 10)], [anchor, anchor]);
  eq(`${tag}: B op 100 % zonder actuals ⇒ AS/AF uit de opgeloste datums (niet vandaag)`,
    [b.time.actualStart?.slice(0, 10), b.time.actualFinish?.slice(0, 10)], [anchor, bFinish]);
  ok(`${tag}: geen enkele geplande datum is "vandaag" (${JSON.stringify(parsed.tasks.map(dates))})`,
    !parsed.tasks.some(t => t.time.scheduleStart.startsWith(THIS_YEAR) || t.time.scheduleFinish.startsWith(THIS_YEAR)));
}

// ── Bronproject in de store: projectstart ma 5-1-2015, A (5 d) start wo 7-1, B (3 d), M (mijlpaal). ──
S().newProject();
S().setProject({ startDate: '2015-01-05' });
S().addTask({ name: 'A', time: createDefaultTaskTime('2015-01-07', 5) });
const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2015-01-05', 3) });
S().addTask({ name: 'M', time: createDefaultTaskTime('2015-01-05', 0) });
S().runCPM();
// B op 100 % zonder actuals (zoals updateTask/een extern bestand hem achterlaat).
S().updateTask(idB, { time: { ...byName(S().tasks, 'B').time, completion: 1 } });
const src = S();

// ── 1. CSV: lege Start/Finish-cellen; CSV kent geen projectstart ⇒ vroegste aanwezige start (A). ──
{
  const csv = [
    'WBS;Name;Duration;Start;Finish;Completion (%)',
    '1;A;5;2015-01-07;2015-01-13;0',
    '2;B;3;;;100',
    '3;M;0;;;0',
  ].join('\r\n');
  const parsed = readCSV(csv);
  expectResolved('1 CSV', parsed, '2015-01-07', '2015-01-09');
  eq('1 CSV: projectstart = vroegste aanwezige taakstart, niet vandaag', parsed.project.startDate, '2015-01-07');
}

// ── 2. MSPDI: <Start>/<Finish> van B en M weg. ─────────────────────────────────────────────────────
/** Verwijder in het blok `<tag>…<Name>naam</Name>…</tag>` de genoemde elementen. */
function stripInBlock(xml: string, tag: string, name: string, elements: string[]): string {
  const re = new RegExp(`<${tag}>(?:(?!</${tag}>)[\\s\\S])*?<Name>${name}</Name>[\\s\\S]*?</${tag}>`);
  const m = xml.match(re);
  if (!m) throw new Error(`geen <${tag}> met naam ${name}`);
  let block = m[0];
  for (const el of elements) block = block.replace(new RegExp(`\\s*<${el}>[^<]*</${el}>`, 'g'), '');
  return xml.replace(m[0], block);
}
{
  let xml = writeMSPDI(src.project, src.calendar, src.tasks, src.sequences, src.resources, src.assignments, src.calendars);
  for (const n of ['B', 'M']) xml = stripInBlock(xml, 'Task', n, ['Start', 'Finish', 'ActualStart', 'ActualFinish']);
  expectResolved('2 MSPDI (projectstart in bestand)', readMSPDI(xml), '2015-01-05', '2015-01-07');
  const zonderProjectStart = xml.replace(/<StartDate>[^<]*<\/StartDate>/, '');
  const parsed = readMSPDI(zonderProjectStart);
  expectResolved('2 MSPDI (zonder projectstart)', parsed, '2015-01-07', '2015-01-09');
  eq('2 MSPDI zonder projectstart: projectstart = vroegste aanwezige taakstart', parsed.project.startDate, '2015-01-07');
}

// ── 3. P6: <PlannedStartDate>/<PlannedFinishDate> van B en M weg. ─────────────────────────────────
{
  let xml = writeP6XML(src.project, src.calendar, src.tasks, src.sequences, src.resources, src.assignments, src.calendars);
  for (const n of ['B', 'M']) {
    xml = stripInBlock(xml, 'Activity', n, [
      'PlannedStartDate', 'PlannedFinishDate', 'StartDate', 'FinishDate', 'ActualStartDate', 'ActualFinishDate',
    ]);
  }
  expectResolved('3 P6 (projectstart in bestand)', readP6XML(xml), '2015-01-05', '2015-01-07');
  // Projectniveau: het eerste <PlannedStartDate> vóór de eerste <Activity> is dat van <Project>.
  const firstActivity = xml.indexOf('<Activity>');
  const head = xml.slice(0, firstActivity).replace(/<PlannedStartDate>[^<]*<\/PlannedStartDate>/, '');
  const parsed = readP6XML(head + xml.slice(firstActivity));
  expectResolved('3 P6 (zonder projectstart)', parsed, '2015-01-07', '2015-01-09');
  eq('3 P6 zonder projectstart: projectstart = vroegste aanwezige taakstart', parsed.project.startDate, '2015-01-07');
}

// ── 4. IFC: ScheduleStart/-Finish (en de rekenslots) van B en M op `$`. ───────────────────────────
function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = '';
  for (const ch of inner) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function blankTaskTimeSlots(ifc: string, name: string, slots: number[]): string {
  const lines = ifc.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#\d+=IFCTASKTIME\()(.*)(\);\s*)$/);
    if (!m) continue;
    const args = splitArgs(m[2]);
    if (args[0] !== `'${name} Time'`) continue;
    for (const s of slots) args[s] = '$';
    lines[i] = `${m[1]}${args.join(',')}${m[3]}`;
    return lines.join('\n');
  }
  throw new Error(`geen IFCTASKTIME voor ${name}`);
}
{
  let ifc = writeIFC(buildWriteIFCInput(src));
  // 5 ScheduleStart, 6 ScheduleFinish, 7-10 Early/Late, 16/17 ActualStart/-Finish.
  for (const n of ['B', 'M']) ifc = blankTaskTimeSlots(ifc, n, [5, 6, 7, 8, 9, 10, 16, 17]);
  const parsed = readIFC(ifc);
  expectResolved('4 IFC', parsed, '2015-01-05', '2015-01-07');
  eq('4 IFC: projectstart uit het bestand blijft', parsed.project.startDate, '2015-01-05');
}

// ── 5. MPP: één taak met een lege (null) ScheduledStart/-Finish. ──────────────────────────────────
// Minimale MPP14-fixture, zelfde constructie als tests/mcp/cases-doc-file.ts (daar niet
// geëxporteerd). Datums in MPP-dagen sinds 1984-01-01; 65535 = "NA" (getTimestamp ⇒ null).
const MPP_NA = 65535;
function mppTimestampBytes(time: number, days: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint16(0, time, true);
  view.setUint16(2, days, true);
  return out;
}
function mppBytes(opts: { startDays: number; finishDays: number; projectStartDays: number }): Uint8Array {
  const ascii = (s: string) => {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  };
  const int32 = (v: number) => { const o = new Uint8Array(4); new DataView(o.buffer).setInt32(0, v, true); return o; };
  const props = encodePropsEntries([
    { key: 37748738, data: mppTimestampBytes(0, opts.projectStartDays) }, // project start
    { key: 37748739, data: mppTimestampBytes(0, opts.projectStartDays + 30) }, // project finish
    { key: 37748765, data: int32(480) }, // minutes per day
    { key: 37748744, data: ascii('Fixture') },
  ]);
  const record = new Uint8Array(130);
  const rv = new DataView(record.buffer);
  rv.setInt32(0, 10, true); rv.setInt32(4, 1, true); rv.setInt16(40, 1, true);
  rv.setInt32(42, 3 * 4800, true); // 3 werkdagen @ 480 min/dag, in tienden van een minuut
  rv.setInt16(56, 0, true);
  rv.setUint16(64, 0, true); rv.setUint16(66, opts.startDays, true);
  rv.setUint16(68, 0, true); rv.setUint16(70, opts.finishDays, true);
  rv.setInt32(118, -1, true);
  const itemSize = 47, items = 4;
  const meta = new Uint8Array(16 + items * itemSize);
  const mv = new DataView(meta.buffer);
  mv.setUint32(0, 0xfadfadba, true); mv.setInt32(8, items, true);
  mv.setInt32(16 + 3 * itemSize, 0, true); mv.setInt32(16 + 3 * itemSize + 4, 0, true);
  const nameBytes = ascii('B');
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
  // Referentie: dezelfde taak MET datums, zodat de verwachting uit de lezer zelf komt (geen eigen
  // MPP-epoch-rekenwerk in de test). 11328 = ma 5-1-2015 in MPP-dagen.
  const withDates = readMPP(mppBytes({ startDays: 11328, finishDays: 11330, projectStartDays: 11328 }));
  const ref = byName(withDates.tasks, 'B');
  eq('5 MPP referentie: projectstart en taakdatums zoals bedoeld',
    [withDates.project.startDate, ref.time.scheduleStart.slice(0, 10), ref.time.scheduleFinish.slice(0, 10)],
    ['2015-01-05', '2015-01-05', '2015-01-07']);
  const parsed = readMPP(mppBytes({ startDays: MPP_NA, finishDays: MPP_NA, projectStartDays: 11328 }));
  const b = byName(parsed.tasks, 'B');
  eq('5 MPP: lege ScheduledStart/-Finish ⇒ projectstart, finish = start + 3 werkdagen',
    [b.time.scheduleStart.slice(0, 10), b.time.scheduleFinish.slice(0, 10)], ['2015-01-05', '2015-01-07']);
}

if (diffs.length === 0) {
  console.log(`OK  import-missing-schedule-dates: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  import-missing-schedule-dates: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
