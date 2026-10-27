// .mpp openen via de echte open-pijplijn: `parseOpenedFile` (formatRegistry) → `applyOpenedImport`
// (store). Bewaakt het importverslag (issue #391, `mppImportLoss.ts` + `msProjectImportNotice`):
// - een bestand met in elke categorie iets dat de lezer niet overneemt ⇒ één melding met per
//   categorie een regel en de juiste telling, samen met de rekenprofielregel van .mpp;
// - die melding blijft staan tot het kruisje (`sticky`), want er is data weggelaten;
// - een schoon bestand (ook met een lege aantekening, een NB-baseline en lege eigen velden) ⇒ geen
//   verslag en geen melding;
// - de RTF-aantekeningregel telt zichtbare tekst en echte afbeeldingen/objecten, geen metadata.
// Corpusloos (CI): de fixtures zijn synthetische MPP14-containers (zelfde bouw als `mppFixtures.ts`).
// De sleutels komen uit MPXJ (`FieldMap14.java`); de tellingen zijn lokaal ook nagemeten tegen de
// MPP14-testbestanden van MPXJ (`junit/data/mpp14*.mpp`), zie de PR.
import { readFileSync } from 'node:fs';
import { parseOpenedFile } from '@/services/formatRegistry';
import { useAppStore } from '@/state/appStore';
import { msProjectImportNotice } from '@/state/msProjectImportNotice';
import { rtfHasVisibleText } from '@/services/mpp/mppImportLoss';
import { CfbFile } from '@/services/mpp/cfb';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readMPP } from '@/services/mpp/mppReader';
import { Var2Data } from '@/services/mpp/mppPrimitives';
import { activeImportResult, isMultiDocumentImport, type OpenedImport } from '@/services/importTypes';
import {
  buildNestedCfb, buildVarMetaBytes, concatBytes, encodeCompObjFileFormat, encodePropsEntries,
  encodePropsSingleByteEntry, minimalMpp14Bytes, mppTimestampBytes, type CfbTreeNode,
} from './mppFixtures';

declare const process: { exitCode?: number };
const S = () => useAppStore.getState();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

// ── Bytes ────────────────────────────────────────────────────────────────────────────────────────
const utf16 = (s: string, terminate = false) => {
  const out = new Uint8Array((s.length + (terminate ? 1 : 0)) * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
  return out;
};
const latin1 = (s: string) => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
const int32 = (v: number) => { const o = new Uint8Array(4); new DataView(o.buffer).setInt32(0, v, true); return o; };
const double = (v: number) => { const o = new Uint8Array(8); new DataView(o.buffer).setFloat64(0, v, true); return o; };
const NA_TIMESTAMP = Uint8Array.from([0xff, 0xff, 0xff, 0xff]);
/** `HyperlinkReader.java`: 24 bytes kop, dan weergave, 12 bytes, adres, 12 bytes, subadres. */
const hyperlink = (text: string, address: string) =>
  concatBytes(new Uint8Array(24), utf16(text, true), new Uint8Array(12), utf16(address, true), new Uint8Array(12), utf16('', true));
/** `CostRateTableFactory.java`: 16 bytes kop, dan records van 44 bytes (standaardtarief @0). */
const rateTable = (standardRate: number) => {
  const out = new Uint8Array(16 + 44);
  new DataView(out.buffer).setFloat64(16, standardRate, true);
  return out;
};

/** Var2Data + VarMeta uit `{ uid: { key: bytes } }`. Dezelfde bytearray binnen één storage
 *  betekent een echte gedeelde offset; een kopie met gelijke inhoud blijft een apart blok. */
function varBlocks(entries: Record<number, Record<number, Uint8Array>>): { meta: Uint8Array; data: Uint8Array } {
  const metaEntries: { uniqueId: number; offset: number; type: number }[] = [];
  const parts: Uint8Array[] = [];
  const offsets = new Map<Uint8Array, number>();
  let offset = 0;
  for (const [uid, fields] of Object.entries(entries)) {
    for (const [key, bytes] of Object.entries(fields)) {
      let blockOffset = offsets.get(bytes);
      if (blockOffset === undefined) {
        blockOffset = offset;
        offsets.set(bytes, blockOffset);
        parts.push(int32(bytes.length), bytes);
        offset += 4 + bytes.length;
      }
      metaEntries.push({ uniqueId: Number(uid), offset: blockOffset, type: Number(key) });
    }
  }
  return { meta: buildVarMetaBytes(metaEntries), data: concatBytes(...parts) };
}

/** Een TASK_FIELD_MAP (Props 131092) met de velden van de lezer plus FIXED_COST op offset 130, zodat
 *  de vaste kosten in de data-gedreven veldkaart staan (`FieldMap.createFieldMap`, 28 bytes/entry). */
function taskFieldMap(includeCosts: boolean): Uint8Array {
  const fixed: [number, number][] = [[86, 0], [23, 4], [249, 40], [29, 42], [17, 56], [35, 64], [36, 68], [401, 118]];
  if (includeCosts) fixed.push([8, 130]);
  return fieldMap([...fixed, [14, 65535]]);
}

/** Bewust andere tariefoffsets dan de terugval (28/36/84): een aanwezige kaart bepaalt de layout. */
function resourceFieldMap(includeRates: boolean): Uint8Array {
  const fixed: [number, number][] = includeRates ? [[27, 0], [6, 8], [7, 16], [18, 24], [4, 44]] : [[27, 0], [4, 44]];
  return fieldMap([...fixed, [1, 65535]]);
}

function fieldMap(fields: [number, number][]): Uint8Array {
  const entries = fields.map(([typeValue, dataBlockOffset]) => ({ typeValue, dataBlockOffset }));
  const out = new Uint8Array(entries.length * 28);
  const view = new DataView(out.buffer);
  entries.forEach((e, i) => { view.setUint16(i * 28 + 4, e.dataBlockOffset, true); view.setInt32(i * 28 + 12, e.typeValue, true); });
  return out;
}

interface FixtureAssignment { uid: number; deleted?: boolean; vars: Record<number, Uint8Array> }
interface FixtureTask { uid: number; name: string; fixedCost?: number; vars?: Record<number, Uint8Array> }
interface Fixture {
  tasks: FixtureTask[];
  resourceVars: Record<number, Uint8Array>;
  /** Toewijzingen aan taak 10 en resource 1; `deleted` zet de verwijdermarkering (FixedMeta-byte 0). */
  assignments: FixtureAssignment[];
  criticalSlackLimit?: number;
  /** Ontbrekend: primaire kaarten; `without-costs` bewaart bedragen op de terugvalposities als lokval. */
  fieldMaps?: 'absent' | 'primary' | 'secondary' | 'without-costs';
  resourceRates?: { standard?: number; overtime?: number; perUse?: number };
  resourceRecords?: Uint8Array[];
  resourceVarsByUid?: Record<number, Record<number, Uint8Array>>;
  resourceMap?: Uint8Array;
}

/** Schrijf eerst volledige velden en kort daarna af: gedeeltelijke DOUBLEs houden echte bytes. */
function resourceRecord(options: {
  length: number; uid?: number; uidOffset?: number; maxUnitsOffset?: number | null; maxUnits?: number;
  rates?: Fixture['resourceRates']; rateOffsets?: readonly number[];
}): Uint8Array {
  const uidOffset = options.uidOffset ?? 0;
  const maxUnitsOffset = options.maxUnitsOffset === undefined ? 44 : options.maxUnitsOffset;
  const rateOffsets = options.rateOffsets ?? [28, 36, 84];
  const out = new Uint8Array(Math.max(options.length, uidOffset + 4, (maxUnitsOffset ?? 0) + 8, ...rateOffsets.map(offset => offset + 8)));
  const view = new DataView(out.buffer);
  view.setInt32(uidOffset, options.uid ?? 1, true);
  if (maxUnitsOffset !== null) view.setFloat64(maxUnitsOffset, (options.maxUnits ?? 1) * 10000, true);
  [options.rates?.standard, options.rates?.overtime, options.rates?.perUse].forEach((rate, i) => {
    view.setFloat64(rateOffsets[i], rate ?? 0, true);
  });
  return out.subarray(0, options.length);
}

const RECORD = 168;
const TASK_META_ITEM = 47;
const RESOURCE_META_ITEM = 37;
const ASSIGNMENT_META_ITEM = 34;
const ASSIGNMENT_RECORD = 110;
const START_DAYS = 15000;

function buildMpp(fx: Fixture, largeVarStreams?: Map<string, Uint8Array>): Uint8Array {
  const defaultLayout = fx.fieldMaps === 'absent' || fx.fieldMaps === 'without-costs';
  // Taken: drie lege meta-items (FIRST_TASK_INDEX = 3), dan één record per taak.
  const records = fx.tasks.map((task, i) => {
    const record = new Uint8Array(RECORD);
    const rv = new DataView(record.buffer);
    rv.setInt32(0, task.uid, true); rv.setInt32(4, i + 1, true); rv.setInt16(40, 1, true);
    rv.setInt32(42, 2 * 4800, true);
    rv.setUint16(64, 0, true); rv.setUint16(66, START_DAYS, true);
    rv.setUint16(68, 0, true); rv.setUint16(70, START_DAYS + 1, true);
    rv.setInt32(118, -1, true);
    rv.setFloat64(defaultLayout ? 158 : 130, task.fixedCost ?? 0, true);
    return record;
  });
  const items = 3 + fx.tasks.length;
  const meta = new Uint8Array(16 + items * TASK_META_ITEM);
  const mv = new DataView(meta.buffer);
  mv.setUint32(0, 0xfadfadba, true); mv.setInt32(8, items, true);
  fx.tasks.forEach((_, i) => mv.setInt32(16 + (3 + i) * TASK_META_ITEM + 4, i * RECORD, true));
  const taskVars = varBlocks(Object.fromEntries(fx.tasks.map(task => [task.uid, { 14: utf16(task.name), ...(task.vars ?? {}) }])));

  // Standaard één resource; grensgevallen kunnen korte en dubbele FixedData-records aanbieden.
  const rscRecords = fx.resourceRecords ?? [resourceRecord({
    length: 96, rates: fx.resourceRates, rateOffsets: defaultLayout ? [28, 36, 84] : [8, 16, 24],
  })];
  const rscMeta = new Uint8Array(16 + rscRecords.length * RESOURCE_META_ITEM);
  const rmv = new DataView(rscMeta.buffer);
  rmv.setUint32(0, 0xfadfadba, true); rmv.setInt32(8, rscRecords.length, true);
  let resourceOffset = 0;
  rscRecords.forEach((record, i) => {
    rmv.setInt32(16 + i * RESOURCE_META_ITEM + 4, resourceOffset, true);
    resourceOffset += record.length;
  });
  const rscVars = varBlocks(fx.resourceVarsByUid ?? { 1: { 1: utf16('Timmerman'), ...fx.resourceVars } });
  // Toewijzingen: FixedMeta (34 bytes/item, byte 0 = verwijderd, offset @4) en FixedData (110 bytes/record:
  // uid @0, taak @4, resource @8, eenheden @46), zoals `readAssignments` ze leest.
  const asnMeta = new Uint8Array(16 + fx.assignments.length * ASSIGNMENT_META_ITEM);
  const amv = new DataView(asnMeta.buffer);
  amv.setUint32(0, 0xfadfadba, true); amv.setInt32(8, fx.assignments.length, true);
  const asnRecords = fx.assignments.map((assignment, i) => {
    asnMeta[16 + i * ASSIGNMENT_META_ITEM] = assignment.deleted ? 1 : 0;
    amv.setInt32(16 + i * ASSIGNMENT_META_ITEM + 4, i * ASSIGNMENT_RECORD, true);
    const record = new Uint8Array(ASSIGNMENT_RECORD);
    const view = new DataView(record.buffer);
    view.setInt32(0, assignment.uid, true); view.setInt32(4, 10, true); view.setInt32(8, 1, true);
    view.setFloat64(46, 10000, true);
    return record;
  });
  const asnVars = varBlocks(Object.fromEntries(fx.assignments.map(a => [a.uid, a.vars])));

  const props = encodePropsEntries([
    { key: 37748738, data: mppTimestampBytes(0, START_DAYS) },
    { key: 37748739, data: mppTimestampBytes(0, START_DAYS + 30) },
    { key: 37748765, data: int32(480) },
    { key: 37748744, data: utf16('Verslag') },
    ...(fx.fieldMaps === 'absent' ? [] : [
      { key: fx.fieldMaps === 'secondary' ? 50331668 : 131092, data: taskFieldMap(fx.fieldMaps !== 'without-costs') },
      { key: fx.fieldMaps === 'secondary' ? 50331669 : 131093, data: fx.resourceMap ?? resourceFieldMap(fx.fieldMaps !== 'without-costs') },
    ]),
    ...(fx.criticalSlackLimit !== undefined ? [{ key: 37748756, data: int32(fx.criticalSlackLimit) }] : []),
  ]);
  // De 64 KiB-notities passen niet in de ene FAT-sector van buildNestedCfb. Alleen in die
  // gevallen bewaart de test de echte Var2Data-stream apart; VarMeta en alle records blijven gelijk.
  const varStream = (storage: string, data: Uint8Array): CfbTreeNode => {
    if (!largeVarStreams || data.length < 4096) return { data };
    largeVarStreams.set(`   114/${storage}/Var2Data`, data);
    return { data: new Uint8Array(0) };
  };
  const tree: Record<string, CfbTreeNode> = {
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(893386752, 0) },
    '   114': {
      children: {
        Props: { data: props },
        TBkndTask: { children: {
          FixedMeta: { data: meta }, FixedData: { data: concatBytes(...records) },
          VarMeta: { data: taskVars.meta }, Var2Data: varStream('TBkndTask', taskVars.data),
        } },
        TBkndRsc: { children: {
          FixedMeta: { data: rscMeta }, FixedData: { data: concatBytes(...rscRecords) },
          VarMeta: { data: rscVars.meta }, Var2Data: varStream('TBkndRsc', rscVars.data),
        } },
        TBkndAssn: { children: {
          FixedMeta: { data: asnMeta }, FixedData: { data: concatBytes(...asnRecords) },
          VarMeta: { data: asnVars.meta }, Var2Data: varStream('TBkndAssn', asnVars.data),
        } },
      },
    },
  };
  return buildNestedCfb(tree);
}

const NOTE = latin1('{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\viewkind4\\pard\\f0\\fs20 Let op: wapening keuren\\par}');
/** Alleen een geplakte afbeelding (Word/RichEdit-vorm) en alleen Unicode-tekst (`\\uN`). */
const PICTURE_NOTE = latin1('{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\pard{\\*\\shppict{\\pict\\pngblip 89504e47}}{\\nonshppict{\\pict\\wmetafile8 0100}}\\par}');
const UNICODE_NOTE = latin1('{\\rtf1\\ansi\\uc0\\u9629\\u20013\\par}');
const EMPTY_NOTE = latin1('{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}{\\*\\generator Riched20;}\\viewkind4\\pard\\f0\\fs20\\par}');

/** Knownbug 159: de backslashes zijn ge-escapete tekst in verborgen metadata, geen afbeeldingen. */
const METADATA_NOTE = latin1(String.raw`{\rtf1\ansi{\info{\title \\pict}{\comment {\\object}}}\par}`);
const OBJECT_NOTE = latin1('{\\rtf1\\ansi{\r\n\\object\\objemb{\\*\\objclass Package}{\\*\\objdata 0100}}\\par}');
const BINARY_PICTURE_NOTE = latin1(String.raw`{\rtf1{\*\private\bin1 {}{\pict\pngblip 00}}`);

const LOSSY: Fixture = {
  tasks: [
    { uid: 10, name: 'Fundering', fixedCost: 250, vars: {
      15: NOTE, // NOTES
      215: hyperlink('Tekening', 'https://example.org/fundering.pdf'), // HYPERLINK_DATA
      43: mppTimestampBytes(4800, START_DAYS), // baseline 0 (BASELINE_ESTIMATED_START)
      483: mppTimestampBytes(10200, START_DAYS + 2), // baseline 1 (BASELINE1_ESTIMATED_FINISH)
      51: utf16('Kavel 3', true), // TEXT1
    } },
    // SUBPROJECT_TASKS_UNIQUEID_OFFSET; alleen baselinewerk in baseline 2 (BASELINE2_WORK).
    { uid: 11, name: 'Deelproject installaties', vars: { 458: int32(1000), 496: double(48000) } },
    // SUBPROJECT_TASK_ID; een aantekening met alleen een afbeelding.
    { uid: 12, name: 'Oplevering (extern)', vars: { 255: int32(7), 15: PICTURE_NOTE } },
  ],
  resourceVars: {
    20: NOTE, // NOTES
    136: hyperlink('Cv', 'https://example.org/cv'), // HYPERLINK_DATA
    62: rateTable(55), // COST_RATE_B
    8: utf16('Ploeg A', true), // TEXT1
  },
  assignments: [
    // NOTES, TEXT1, en alleen baselinekosten in baseline 3 (BASELINE3_COST).
    { uid: 1, vars: { 71: NOTE, 88: utf16('Ploeg A', true), 308: double(500) } },
    // Verwijderd: de lezer slaat hem over, dus het verslag ook (NOTES, TEXT2).
    { uid: 2, deleted: true, vars: { 71: NOTE, 89: utf16('Ploeg B', true) } },
  ],
  criticalSlackLimit: 3,
};

const CLEAN: Fixture = {
  tasks: [
    { uid: 10, name: 'Fundering', fixedCost: 0, vars: { 15: EMPTY_NOTE, 1: double(0), 6: double(0), 43: NA_TIMESTAMP, 44: NA_TIMESTAMP, 51: utf16('', true), 87: double(0), 458: int32(0), 255: int32(0) } },
    { uid: 11, name: 'Metselwerk' },
  ],
  resourceVars: { 20: EMPTY_NOTE, 62: rateTable(0) },
  assignments: [{ uid: 1, vars: { 71: EMPTY_NOTE, 16: double(0), 32: double(0), 146: NA_TIMESTAMP } }],
  criticalSlackLimit: 0,
};

async function open(name: string, bytes: Uint8Array): Promise<OpenedImport> {
  const parsed = await parseOpenedFile({ name, bytes });
  S().newProject();
  useAppStore.setState(st => { st.ui.notifications = []; });
  S().applyOpenedImport(parsed, { filePath: null, recompute: true, fit: false, linkedOpen: true });
  return parsed;
}
const resultsOf = (parsed: OpenedImport) => isMultiDocumentImport(parsed) ? parsed.results : [parsed];

/** Dezelfde blokken op echte taak-, resource- en toewijzingsrecords. De eerste notitie staat in
 *  alle drie storages op offset 12, na een 4-byte lengte + vier UTF-16-tekens. */
function noteFixture(
  taskNotes: readonly (Uint8Array | null)[],
  resourceNotes = taskNotes,
  assignmentNotes = taskNotes,
): Fixture {
  return {
    tasks: taskNotes.map<FixtureTask>((note, i) => {
      const vars: Record<number, Uint8Array> = {};
      if (note !== null) vars[15] = note;
      return { uid: 10 + i, name: 'Taak', vars };
    }),
    resourceVars: {},
    resourceRecords: resourceNotes.map((_, i) => resourceRecord({ length: 60, uid: 1 + i })),
    resourceVarsByUid: Object.fromEntries(resourceNotes.map<[number, Record<number, Uint8Array>]>((note, i) => {
      const vars: Record<number, Uint8Array> = { 1: utf16('Mens') };
      if (note !== null) vars[20] = note;
      return [1 + i, vars];
    })),
    assignments: assignmentNotes.map<FixtureAssignment>((note, i) => {
      const vars: Record<number, Uint8Array> = { 1: utf16('Slot') };
      if (note !== null) vars[71] = note;
      return { uid: 1 + i, vars };
    }),
  };
}

/** Observeer echte bytelezingen via de bestaande Var2Data-grens, zonder productiehaak of klok.
 *  Eén proxy per byteview bewaart de identiteit van de gedeelde datablokken. */
function readWithNoteReads(bytes: Uint8Array, largeVarStreams?: ReadonlyMap<string, Uint8Array>) {
  const notes: { type: number; length: number; byteReads: number }[] = [];
  const views = new Map<Uint8Array, Uint8Array>();
  const original = Var2Data.prototype.getByteArray;
  const originalGetStream = CfbFile.prototype.getStream;
  if (largeVarStreams) {
    // De echte VarMeta/Var2Data-lezer verwerkt ook de lange blokken, zonder de CFB-bouwer uit te
    // breiden. De overige imports toetsen ongewijzigd de volledige containerroute.
    CfbFile.prototype.getStream = function (this: CfbFile, path: string[]): Uint8Array | null {
      return largeVarStreams.get(path.join('/')) ?? originalGetStream.call(this, path);
    };
  }
  Var2Data.prototype.getByteArray = function (this: Var2Data, uid: number, type: number): Uint8Array | null {
    const raw = original.call(this, uid, type);
    if (!raw || ![15, 20, 71].includes(type)) return raw;
    let view = views.get(raw);
    if (!view) {
      const note = { type, length: raw.length, byteReads: 0 };
      notes.push(note);
      view = new Proxy(raw, {
        get(target, key) {
          if (typeof key === 'string' && /^\d+$/.test(key)) note.byteReads++;
          return Reflect.get(target, key, target);
        },
      });
      views.set(raw, view);
    }
    return view;
  };
  try {
    return { result: readMPP(bytes), notes };
  } finally {
    Var2Data.prototype.getByteArray = original;
    CfbFile.prototype.getStream = originalGetStream;
  }
}

/** Alleen de lezer, zonder store-herberekening: de matrices hieronder toetsen verliesdetectie. */
const readFixture = async (fx: Fixture) => activeImportResult(await parseOpenedFile({ name: 'verliesdetectie.mpp', bytes: buildMpp(fx) }));

// Letterlijke MPP14-datumvelden: baseline 0–10, taak (estimated én gewone start/einde) en toewijzing.
const TASK_BASELINE_DATES = [
  [43, 44, 1299, 1300], [482, 483, 1302, 1303], [493, 494, 1305, 1306], [504, 505, 1308, 1309],
  [515, 516, 1311, 1312], [526, 527, 1314, 1315], [544, 545, 1317, 1318], [555, 556, 1320, 1321],
  [566, 567, 1323, 1324], [577, 578, 1326, 1327], [588, 589, 1329, 1330],
];
const ASSIGNMENT_BASELINE_DATES = [
  [146, 147], [295, 296], [304, 305], [313, 314], [322, 323], [331, 332],
  [340, 341], [349, 350], [358, 359], [367, 368], [376, 377],
];

async function main(): Promise<void> {
  // (1) RTF-aantekening: zichtbare tekst en echte afbeeldingen/objecten tellen.
  eq('1a aantekening met tekst', rtfHasVisibleText(NOTE), true);
  eq('1b aantekening zonder tekst (alleen opmaak)', rtfHasVisibleText(EMPTY_NOTE), false);
  eq('1c escape telt als tekst', rtfHasVisibleText(latin1('{\\rtf1\\ansi \\\'e9\\par}')), true);
  eq('1d alleen een afbeelding telt als inhoud', rtfHasVisibleText(PICTURE_NOTE), true);
  eq('1e alleen Unicode-tekst telt als tekst', rtfHasVisibleText(UNICODE_NOTE), true);

  // Knownbug 159: groepsbestemmingen herkennen zonder escaped tekst of metadata als inhoud te tellen.
  eq('1f escaped pict/object in metadata', rtfHasVisibleText(METADATA_NOTE), false);
  eq('1g object met CR/LF vóór bestemming', rtfHasVisibleText(OBJECT_NOTE), true);
  eq('1h afbeelding na binaire accolade in verborgen groep', rtfHasVisibleText(BINARY_PICTURE_NOTE), true);
  const noteCases: readonly [string, string, boolean][] = [
    ['oorspronkelijke title-repro', String.raw`{\rtf1{\info{\title \\pict}}\par}`, false],
    ['escaped object in titel', String.raw`{\rtf1{\info{\title \\object}}\par}`, false],
    ['geneste metadata en generator', String.raw`{\rtf1{\info{\title {\\pict}{\\object}}}{\*\generator \\pict \\object;}\par}`, false],
    ['echte groepen binnen metadata blijven verborgen', String.raw`{\rtf1{\info{\title {\*\shppict{\pict\pngblip 00}}}{\comment {\object\objemb}}}\par}`, false],
    ['onbekende destination blijft verborgen', String.raw`{\rtf1{\*\private{\pict\pngblip 00}{\object\objemb}}\par}`, false],
    ['langere controlwoorden zijn geen pict/object', String.raw`{\rtf1{\picture}{\objectives}\par}`, false],
    ['lege afbeeldingswrappers', String.raw`{\rtf1{\*\shppict}{\nonshppict}\par}`, false],
    ['losse afbeelding zonder tekst', String.raw`{\rtf1{\pict\pngblip 00}\par}`, true],
    ['alleen shppict zonder fallback', String.raw`{\rtf1{\*\shppict{\pict\pngblip 00}}\par}`, true],
    ['alleen nonshppict', String.raw`{\rtf1{\nonshppict{\pict\wmetafile8 00}}\par}`, true],
    ['ster bij echte pict-bestemming', String.raw`{\rtf1{\*\pict\pngblip 00}\par}`, true],
    ['ster bij echte object-bestemming', String.raw`{\rtf1{\*\object\objemb{\*\objdata 00}}\par}`, true],
    ['afbeelding na metadata', String.raw`{\rtf1{\info{\title \\pict}}{\*\shppict{\pict\pngblip 00}}\par}`, true],
    ['zichtbare tekst na metadata', String.raw`{\rtf1{\info{\title \\object}}Let op: wapening keuren\par}`, true],
    ['zichtbare letterlijke controlwoorden en accolades', String.raw`{\rtf1{\info{\title \\pict}}\\pict \\object \{tekst\}\par}`, true],
    ['binaire sluitaccolade maakt verborgen tekst niet zichtbaar', String.raw`{\rtf1{\*\private\bin1 }verborgen}}`, false],
    ['binaire backslash verbergt geen zichtbare tekst', String.raw`{\rtf1{\*\private\bin1 \}Zichtbaar\par}`, true],
    ['binaire payload is geen pict-groep', String.raw`{\rtf1\bin7 {\pict}\par}`, false],
    ['nulbytes in binaire payload verbergen geen afbeelding', String.raw`{\rtf1{\*\private\bin1 ${'\0'}}{\pict\pngblip 00}}`, true],
    ['CR/LF tellen mee in binaire payload', String.raw`{\rtf1{\*\private\bin2 ${'\r\n'}}{\pict\pngblip 00}}`, true],
    ['afgekapt bin-blok blijft ruwe payload', String.raw`{\rtf1\bin100 {\pict}}`, false],
    ['lege binaire payload verbergt geen afbeelding', String.raw`{\rtf1{\*\private\bin0 }{\pict\pngblip 00}}`, true],
    ['CR vóór object', String.raw`{\rtf1{${'\r'}\object\objemb{\*\objdata 00}}}`, true],
    ['LF vóór object', String.raw`{\rtf1{${'\n'}\object\objemb{\*\objdata 00}}}`, true],
    ['CR/LF vóór metadata en object blijft verborgen', String.raw`{\rtf1{${'\r\n'}\info{\title {${'\r\n'}\object\objemb{\*\objdata 00}}}}}`, false],
    ['CR/LF rondom ster en afbeeldingsbestemming', String.raw`{\rtf1{${'\r\n'}\*${'\r\n'}\shppict{${'\r\n'}\pict\pngblip 00}}}`, true],
    ['CR/LF vóór RTF-header en verborgen metadata', String.raw`{${'\r\n'}\rtf1{\info{\title \\pict}}}`, false],
    ['RTF-terminator buiten binaire payload', String.raw`{\rtf1\par}${'\0'}{\pict\pngblip 00}`, false],
    ['niet-RTF-terminator blijft gelden', '\0tekst na terminator', false],
    ['platte tekst met controlwoordnamen', String.raw`Controleer \pict en \object in de handleiding.`, true],
    ['lege niet-RTF-tekst', ' \t\r\n', false],
    ['alleen RTF-opmaak', String.raw`{\rtf1{\fonttbl{\f0 Arial;}}\pard\f0\par}`, false],
    ['Unicode blijft zichtbaar', String.raw`{\rtf1\uc0\u9629\u20013\par}`, true],
    ['8-bit escape blijft zichtbaar', String.raw`{\rtf1\ansi \'e9\par}`, true],
    ['leeg bronblok', '', false],
  ];
  for (const [label, text, want] of noteCases) eq(`1i ${label}`, rtfHasVisibleText(latin1(text)), want);

  // Knownbug 157: alle tokenizergevallen uit #505 ook via gedeelde VarMeta-offsets inlezen.
  // Vier gevallen × twee verwijzingen per storage: met de huidige notities (max. 84 bytes)
  // hoogstens 107 minisectoren en 21 gewone sectoren, onder de twee helpergrenzen van 128.
  const CASES_PER_IMPORT = 4;
  for (let start = 0; start < noteCases.length; start += CASES_PER_IMPORT) {
    const batch = noteCases.slice(start, start + CASES_PER_IMPORT);
    const repeatedCases = batch.flatMap(([, text]) => {
      const block = latin1(text);
      return [block, block];
    });
    const sharedCases = readWithNoteReads(buildMpp(noteFixture(repeatedCases)));
    const label = `1j gevallen ${start + 1}–${start + batch.length}`;
    eq(`${label}: gedeelde tokenizergevallen tellen per entiteit`, sharedCases.result.msProjectReport?.notes ?? 0,
      batch.filter(([, , content]) => content).length * 2 * 3);
    eq(`${label}: één datablok per geval per storage`, sharedCases.notes.length, batch.length * 3);
    eq(`${label}: alle notitiebytes eenmaal gelezen, ook bij false`,
      sharedCases.notes.every(note => note.byteReads === note.length), true);
  }

  // Lange zichtbare tekst én lange verborgen metadata: veel verwijzingen, drie bronblokken.
  // De tweede import hergebruikt offsets met andere inhoud; geen resultaat uit het vorige document.
  const longNotes: readonly [string, Uint8Array, boolean][] = [
    ['tekst', latin1(String.raw`{\rtf1 ${'x'.repeat(64 * 1024)}\par}`), true],
    ['metadata', latin1(String.raw`{\rtf1{\info{\title ${'x'.repeat(64 * 1024)}}}\par}`), false],
  ];
  for (const [label, block, content] of longNotes) {
    // Zonder de drie externe Var2Data-streams: 119 minisectoren en 22 gewone sectoren.
    const largeVarStreams = new Map<string, Uint8Array>();
    const bytes = buildMpp(noteFixture(Array<Uint8Array>(12).fill(block)), largeVarStreams);
    const shared = readWithNoteReads(bytes, largeVarStreams);
    eq(`1k ${label}: drie lange Var2Data-streams aangeboden`, largeVarStreams.size, 3);
    eq(`1k ${label}: alle entiteiten blijven ingelezen`,
      [shared.result.tasks.length, shared.result.resources.length, shared.result.assignments.length], [12, 12, 12]);
    eq(`1k ${label}: verlies per entiteit`, shared.result.msProjectReport?.notes ?? 0, content ? 36 : 0);
    eq(`1k ${label}: drie gedeelde blokken eenmaal gedecodeerd`,
      shared.notes.map(note => [note.type, note.byteReads]), [[15, block.length], [20, block.length], [71, block.length]]);
  }

  // Gelijke offsets in verschillende storages hebben andere inhoud. Binnen één storage blijven
  // ontbrekende notities, andere offsets en aparte blokken met gelijke inhoud onafhankelijk.
  // Met een ruime notitiegrens van 256 bytes: hoogstens 91 minisectoren en 19 gewone sectoren.
  const mixed = noteFixture(
    [METADATA_NOTE, NOTE, NOTE, NOTE.slice(), null],
    [BINARY_PICTURE_NOTE, METADATA_NOTE, BINARY_PICTURE_NOTE],
    [OBJECT_NOTE, METADATA_NOTE, OBJECT_NOTE],
  );
  // Hetzelfde blok mag ook een ander veld bedienen; die interpretatie hoort niet in de notitiecache.
  mixed.tasks[0].vars = { ...mixed.tasks[0].vars, 51: NOTE };
  mixed.assignments.push({ uid: 4, deleted: true, vars: { 71: NOTE.slice() } });
  const mixedBytes = buildMpp(mixed);
  for (let pass = 1; pass <= 2; pass++) {
    const imported = readWithNoteReads(mixedBytes);
    eq(`1l ${pass}: verlies per entiteit, verwijderd record telt niet`, imported.result.msProjectReport?.notes, 7);
    eq(`1l ${pass}: eigen veld blijft apart geteld`, imported.result.msProjectReport?.customFields, 1);
    eq(`1l ${pass}: zeven verschillende notitieblokken`, imported.notes.length, 7);
    eq(`1l ${pass}: ieder blok eenmaal gelezen`, imported.notes.every(note => note.byteReads === note.length), true);
    eq(`1l ${pass}: zichtbare taaktekst blijft gelijk`, imported.result.tasks.map(task => [task.name, task.description]),
      Array.from({ length: 5 }, () => ['Taak', '']));
    eq(`1l ${pass}: zichtbare resourcetekst blijft gelijk`, imported.result.resources.map(resource => [resource.name, resource.description]),
      Array.from({ length: 3 }, () => ['Mens', '']));
    eq(`1l ${pass}: drie actieve toewijzingen`, imported.result.assignments.length, 3);
  }

  // (2) Elke categorie: de telling uit de lezer.
  let parsed = await open('verslag.mpp', buildMpp(LOSSY));
  const result = activeImportResult(parsed);
  eq('2a2 één toewijzing ingelezen (de verwijderde niet)', result.assignments.length, 1);
  eq('2a drie taken ingelezen', result.tasks.map(t => t.name), ['Fundering', 'Deelproject installaties', 'Oplevering (extern)']);
  eq('2b verslag', result.msProjectReport, {
    format: 'mpp', baselines: 4, baselineWorkCost: 0, assignmentBaselineDates: 0, customFields: 3, notes: 4, hyperlinks: 2, fixedCosts: 1, resourceRates: 1,
    subprojects: 1, externalTasks: 1, manualTasks: 0, levelingDelays: 0, inactiveTasks: 0, criticalSlackLimitDays: 0,
  });
  // Aantekeningen en baselines ontbreken nog; de kritiekgrens komt wel mee.
  eq('2c taakaantekening niet overgenomen', result.tasks[0]?.description ?? '', '');
  eq('2d geen baseline overgenomen', result.baselines ?? [], []);
  eq('2e kritiek-drempel als projectinstelling', result.project.schedulingOptions?.criticalDefinition, { mode: 'totalFloat', threshold: 3 });

  // (3) Eén melding, met per categorie een regel; de rekenprofielregel van .mpp staat erboven.
  const notices = S().ui.notifications.filter(n => n.messageKey === 'notifications.msProjectImportLoss');
  eq('3a één verslag', notices.length, 1);
  const notice = notices[0];
  eq('3b regels', notice?.detailLines?.filter(l => l.messageKey !== 'notifications.importDatesAsRecorded')
    .map(l => [l.messageKey, l.params?.count]), [
    ['notifications.schedulingProfileApplied', undefined],
    ['notifications.msProjectLostSubprojects', 1],
    ['notifications.msProjectLostExternalTasks', 1],
    ['notifications.msProjectLostBaselines', 4],
    ['notifications.msProjectLostCustomFields', 3],
    ['notifications.msProjectLostNotes', 4],
    ['notifications.msProjectLostHyperlinks', 2],
    ['notifications.msProjectLostFixedCosts', 1],
    ['notifications.msProjectLostResourceRates', 1],
  ]);
  eq('3c info, blijft staan, gids', [notice?.severity, notice?.sticky, notice?.helpArticleId], ['info', true, 'howto-mpp-openen']);
  eq('3d geen tweede melding met hetzelfde verslag', S().ui.notifications.filter(n => n.messageKey.startsWith('notifications.msProject')).length, 1);

  // (4) Schoon bestand: geen verslag, geen melding.
  parsed = await open('schoon.mpp', buildMpp(CLEAN));
  eq('4a geen verslag', activeImportResult(parsed).msProjectReport, undefined);
  eq('4b geen melding', msProjectImportNotice(resultsOf(parsed)), undefined);
  eq('4c geen verslag in de store', S().ui.notifications.some(n => n.messageKey === 'notifications.msProjectImportLoss'), false);
  parsed = await open('minimaal.mpp', minimalMpp14Bytes({ startDays: 11328, finishDays: 11330, projectStartDays: 11328 }));
  eq('4d minimaal bestand: geen verslag', activeImportResult(parsed).msProjectReport, undefined);

  // (4e) Alleen verborgen metadata op taak, resource en toewijzing: geen verliesmelding.
  const metadataOnly: Fixture = {
    tasks: [{ uid: 10, name: 'Fundering', vars: { 15: METADATA_NOTE } }],
    resourceVars: { 20: METADATA_NOTE },
    assignments: [{ uid: 1, vars: { 71: METADATA_NOTE } }],
  };
  parsed = await open('metadata.mpp', buildMpp(metadataOnly));
  eq('4e1 metadata: geen verslag', activeImportResult(parsed).msProjectReport, undefined);
  eq('4e2 metadata: geen melding', msProjectImportNotice(resultsOf(parsed)), undefined);
  eq('4e3 metadata: geen melding in de store', S().ui.notifications.some(n => n.messageKey === 'notifications.msProjectImportLoss'), false);

  // Knownbug 46: echte MPP-bytes → open/store → F5 → IFC → heropenen.
  for (const [raw, expected] of [[undefined, 0], [0, 0], [3, 3], [-2, -2], [36500, 36500], [36501, 0]] as const) {
    const imported = activeImportResult(await open('kritiek.mpp', buildMpp({ ...CLEAN, criticalSlackLimit: raw })));
    const want = { mode: 'totalFloat', threshold: expected };
    eq(`46 ${raw}: lezer bewaart de grens`, imported.project.schedulingOptions?.criticalDefinition, want);
    eq(`46 ${raw}: geen onterechte verliesmelding`, imported.msProjectReport, undefined);
    eq(`46 ${raw}: store neemt de grens over`, S().project.schedulingOptions?.criticalDefinition, want);
    S().runCPM();
    eq(`46 ${raw}: F5 behoudt de grens`, S().project.schedulingOptions?.criticalDefinition, want);
    eq(`46 ${raw}: berekening slaagt`, !!S().cpmResult?.error, false);
    eq(`46 ${raw}: twee bladtaken getoetst`, S().tasks.length, 2);
    eq(`46 ${raw}: berekende kritiekvlag gebruikt de grens`,
      S().tasks.map(task => task.time.isCritical), S().tasks.map(task => task.time.totalFloat <= expected));
    const restored = readIFC(writeIFC(buildWriteIFCInput(S())));
    eq(`46 ${raw}: IFC-round-trip behoudt de grens`, restored.project.schedulingOptions?.criticalDefinition, want);
    S().applyOpenedImport(restored, { filePath: null, recompute: true, fit: false, linkedOpen: true });
    eq(`46 ${raw}: heropend project behoudt de grens`, S().project.schedulingOptions?.criticalDefinition, want);
  }

  // (4f) Gedeelde tokenizer voor taak/resource/toewijzing: zichtbare tekst, bin-grenzen en CR/LF.
  parsed = await open('inhoud.mpp', buildMpp({
    ...metadataOnly,
    tasks: [...metadataOnly.tasks, { uid: 11, name: 'Metselwerk', vars: { 15: NOTE } }],
    resourceVars: { 20: BINARY_PICTURE_NOTE },
    assignments: [{ uid: 1, vars: { 71: OBJECT_NOTE } }],
  }));
  const contentResult = activeImportResult(parsed);
  eq('4f1 drie aantekeningen met inhoud', contentResult.msProjectReport?.notes, 3);
  const contentNotices = S().ui.notifications.filter(n => n.messageKey === 'notifications.msProjectImportLoss');
  eq('4f2 één verliesmelding', contentNotices.length, 1);
  eq('4f3 juiste aantekeningentelling in melding', contentNotices[0]?.detailLines
    ?.filter(l => l.messageKey === 'notifications.msProjectLostNotes').map(l => l.params?.count), [3]);
  eq('4f4 import blijft twee taken en één toewijzing lezen',
    [contentResult.tasks.length, contentResult.assignments.length], [2, 1]);
  eq('4f5 de lezer neemt nog steeds geen aantekeningen over', contentResult.tasks.map(t => t.description ?? ''), ['', '']);

  // (4g) De cache verandert de melding niet: twee verwijzingen per storage blijven zes verliezen.
  parsed = await open('gedeelde-notities.mpp', buildMpp(noteFixture([NOTE, NOTE])));
  eq('4g1 gedeelde notities tellen per entiteit', activeImportResult(parsed).msProjectReport?.notes, 6);
  eq('4g2 één melding met zes verloren notities', S().ui.notifications
    .filter(n => n.messageKey === 'notifications.msProjectImportLoss')
    .map(n => n.detailLines?.filter(line => line.messageKey === 'notifications.msProjectLostNotes').map(line => line.params?.count)), [[6]]);

  // (5) De sleutels bestaan in nl en en (geen lege toast).
  for (const loc of ['nl', 'en']) {
    const json = JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${loc}/common.json`, import.meta.url), 'utf8')) as { notifications: Record<string, string> };
    const keys = ['msProjectImportLoss', ...['Baselines', 'BaselineWorkCost', 'ExtraBaselines', 'CustomFields', 'Notes', 'Hyperlinks', 'FixedCosts', 'ResourceRates',
      'Subprojects', 'ExternalTasks', 'ManualTasks', 'LevelingDelays', 'InactiveTasks', 'CriticalSlack']
      .flatMap(c => [`msProjectLost${c}_one`, `msProjectLost${c}_other`])];
    for (const key of keys) eq(`5 ${loc}: ${key}`, typeof json.notifications[key], 'string');
  }

  // (6) #155: terugval zonder kaarten en beide Props-sleutels. Ieder bedrag afzonderlijk;
  // nulwaarden tellen niet en een aanwezige onvolledige kaart krijgt nooit default-offsets erbij.
  for (const fieldMaps of ['absent', 'primary', 'secondary', 'without-costs'] as const) {
    const cases = [
      { label: 'nulwaarden', fixedCost: 0, resourceRates: { standard: 0, overtime: 0, perUse: 0 }, costs: 0, rates: 0 },
      { label: 'vaste kosten', fixedCost: 250, resourceRates: {}, costs: 1, rates: 0 },
      { label: 'standaardtarief', fixedCost: 0, resourceRates: { standard: 55 }, costs: 0, rates: 1 },
      { label: 'overwerktarief', fixedCost: 0, resourceRates: { overtime: 75 }, costs: 0, rates: 1 },
      { label: 'gebruikskosten', fixedCost: 0, resourceRates: { perUse: 10 }, costs: 0, rates: 1 },
      { label: 'alle bedragen', fixedCost: 250, resourceRates: { standard: 55, overtime: 75, perUse: 10 }, costs: 1, rates: 1 },
    ];
    for (const c of cases) {
      const result = await readFixture({
        tasks: [{ uid: 10, name: 'Fundering', fixedCost: c.fixedCost }], resourceVars: {}, assignments: [],
        fieldMaps, resourceRates: c.resourceRates,
      });
      const label = `6 ${fieldMaps} ${c.label}`;
      const costs = fieldMaps === 'without-costs' ? 0 : c.costs;
      const rates = fieldMaps === 'without-costs' ? 0 : c.rates;
      eq(`${label}: verlies`, [result.msProjectReport?.fixedCosts ?? 0, result.msProjectReport?.resourceRates ?? 0], [costs, rates]);
      if (costs + rates === 0) eq(`${label}: geen verslag`, result.msProjectReport, undefined);
      eq(`${label}: import behoudt taak, datums en resource`, [
        result.tasks[0]?.name, result.tasks[0]?.time.scheduleStart, result.tasks[0]?.time.scheduleFinish,
        result.resources[0]?.name, result.resources[0]?.maxUnits, result.tasks.length, result.resources.length,
      ], ['Fundering', '2025-01-24', '2025-01-25', 'Timmerman', 1, 1, 1]);
    }
  }
  const bothRates = await readFixture({
    tasks: [{ uid: 10, name: 'Fundering' }], resourceVars: { 61: rateTable(55) }, assignments: [],
    fieldMaps: 'absent', resourceRates: { standard: 55, overtime: 75, perUse: 10 },
  });
  eq('6 vaste tarieven en tarieftabel tellen dezelfde resource één keer', bothRates.msProjectReport?.resourceRates, 1);

  // (6b) #155 review: de reader selecteert default-records al vanaf 52 bytes; tarieven worden
  // daarna per volledig beschikbaar DOUBLE-veld geteld. Controleer de import en het verslag samen.
  async function checkResources(
    label: string, records: Uint8Array[], rates: number, maxUnits: number[], resourceMap?: Uint8Array, uids = [1],
  ): Promise<void> {
    const result = await readFixture({
      tasks: [{ uid: 10, name: 'Fundering' }], assignments: [], resourceVars: {},
      fieldMaps: resourceMap ? 'primary' : 'absent', resourceMap, resourceRecords: records,
      resourceVarsByUid: Object.fromEntries(uids.map(uid => [uid, { 1: utf16(`Resource ${uid}`) }])),
    });
    eq(`6b ${label}: geselecteerde resources`, result.resources.map(resource => resource.maxUnits), maxUnits);
    eq(`6b ${label}: tariefverlies`, result.msProjectReport?.resourceRates ?? 0, rates);
    if (rates === 0) eq(`6b ${label}: geen verliesmelding`, result.msProjectReport, undefined);
  }
  const rateCases: [string, Fixture['resourceRates']][] = [
    ['nul', { standard: 0, overtime: 0, perUse: 0 }], ['min nul', { standard: -0, overtime: -0, perUse: -0 }],
    ['standaardtarief', { standard: 55 }], ['overwerktarief', { overtime: 75 }], ['gebruikskosten', { perUse: 10 }],
  ];
  for (const length of [52, 91, 92]) for (const [label, rates] of rateCases) {
    const expected = label === 'standaardtarief' || label === 'overwerktarief' || (label === 'gebruikskosten' && length === 92) ? 1 : 0;
    await checkResources(`${length} bytes ${label}`, [resourceRecord({ length, rates })], expected, [1]);
  }
  await checkResources('geen FixedData-records', [], 0, []);
  await checkResources('51 bytes is geen volledige resource', [resourceRecord({ length: 51, rates: { standard: 55 } })], 0, []);
  await checkResources('plaatshouder vóór kort volledig record', [
    resourceRecord({ length: 16 }), resourceRecord({ length: 52, maxUnits: 2, rates: { standard: 55 } }),
  ], 1, [2]);
  await checkResources('onvolledige MAX_UNITS claimt geen UID', [
    resourceRecord({ length: 51, rates: { standard: 55 } }), resourceRecord({ length: 52, maxUnits: 2 }),
  ], 0, [2]);
  await checkResources('eerste volledig record met nultarief wint', [
    resourceRecord({ length: 52 }), resourceRecord({ length: 92, maxUnits: 2, rates: { standard: 55 } }),
  ], 0, [1]);
  await checkResources('eerste volledig record met tarief wint', [
    resourceRecord({ length: 52, rates: { standard: 55 } }), resourceRecord({ length: 92, maxUnits: 2 }),
  ], 1, [1]);
  await checkResources('UID 0 behoudt de korte sentinel', [
    resourceRecord({ length: 2, uid: 0 }), resourceRecord({ length: 92, uid: 0, rates: { standard: 55 } }),
  ], 0, [1], undefined, [0]);
  await checkResources('record zonder VarMeta-resource telt niet', [
    resourceRecord({ length: 92, uid: 2, rates: { standard: 55 } }), resourceRecord({ length: 52 }),
  ], 0, [1]);
  await checkResources('VarMeta-resource zonder overeenkomstig record telt niet', [
    resourceRecord({ length: 92, uid: 2, rates: { standard: 55 } }),
  ], 0, []);
  await checkResources('eerste-wint geldt per resource', [
    resourceRecord({ length: 52, rates: { standard: 55 } }), resourceRecord({ length: 92, uid: 2, rates: { perUse: 10 } }),
  ], 2, [1, 1], undefined, [1, 2]);
  await checkResources('een gedeeltelijk veld leest niet door in het volgende record', [
    resourceRecord({ length: 91, rates: { perUse: 10 } }), resourceRecord({ length: 52, uid: 2 }),
  ], 0, [1, 1], undefined, [1, 2]);

  // Bij een kortere opgegeven layout kunnen ook standaard-/overwerktarieven gedeeltelijk zijn.
  const smallResourceMap = fieldMap([[27, 0], [4, 8], [6, 28], [7, 36], [18, 84], [1, 65535]]);
  for (const [field, end] of [['standard', 36], ['overtime', 44], ['perUse', 92]] as const) {
    for (const length of [end - 1, end]) {
      await checkResources(`${field}: ${length}/${end} bytes`, [
        resourceRecord({ length, maxUnitsOffset: 8, rates: { [field]: 55 } }),
      ], length === end ? 1 : 0, [1], smallResourceMap);
    }
  }
  const lateUnitsMap = fieldMap([[27, 0], [6, 28], [7, 36], [4, 72], [18, 84], [1, 65535]]);
  for (const length of [79, 80]) {
    await checkResources(`opgegeven MAX_UNITS-grens ${length}/80`, [
      resourceRecord({ length, maxUnitsOffset: 72, rates: { standard: 55 } }),
    ], length === 80 ? 1 : 0, length === 80 ? [1] : [], lateUnitsMap);
  }
  const lateUidMap = fieldMap([[6, 28], [7, 36], [4, 44], [27, 60], [18, 84], [1, 65535]]);
  for (const length of [61, 62]) {
    await checkResources(`opgegeven SHORT-UID-grens ${length}/62`, [
      resourceRecord({ length, uidOffset: 60, rates: { standard: 55 } }),
    ], length === 62 ? 1 : 0, length === 62 ? [1] : [], lateUidMap);
  }
  const noUnitsMap = fieldMap([[27, 0], [6, 28], [7, 36], [18, 84], [1, 65535]]);
  await checkResources('ontbrekende MAX_UNITS vereist geen 52 bytes', [
    resourceRecord({ length: 36, maxUnitsOffset: null, rates: { standard: 55 } }),
  ], 1, [1], noUnitsMap);
  await checkResources('zonder MAX_UNITS wint het eerste record met volledige UID', [
    resourceRecord({ length: 2, maxUnitsOffset: null }), resourceRecord({ length: 92, rates: { standard: 55 } }),
  ], 0, [1], noUnitsMap);

  // (7) #158: alle datumvelden gebruiken de datumdecoder, inclusief gemengde 00/FF-sentinels.
  // Alle baselines samen leeg aanbieden vangt ook één vergeten veld in de classificatie.
  const emptyDates: [string, Uint8Array][] = [
    ['nulbytes', new Uint8Array(4)], ['NB', NA_TIMESTAMP],
    ['00 00 FF FF', Uint8Array.from([0, 0, 0xff, 0xff])],
    ['FF FF 00 00', Uint8Array.from([0xff, 0xff, 0, 0])],
    ['00 00 01 00', Uint8Array.from([0, 0, 1, 0])],
    ['kleine dag met seconden', mppTimestampBytes(1, 50)],
    ['te kort', Uint8Array.from([1, 2, 3])],
  ];
  for (const [label, bytes] of emptyDates) {
    const result = await readFixture({
      tasks: [{ uid: 10, name: 'Fundering', vars: Object.fromEntries(TASK_BASELINE_DATES.flat().map(key => [key, bytes])) }],
      resourceVars: {},
      assignments: [{ uid: 1, vars: Object.fromEntries(ASSIGNMENT_BASELINE_DATES.flat().map(key => [key, bytes])) }],
    });
    eq(`7 ${label}: geen datumverlies`, result.msProjectReport, undefined);
    eq(`7 ${label}: toewijzing blijft ingelezen`, result.assignments.length, 1);
  }
  // Elk datumveld moet zelfstandig verlies blijven melden bij een geldige datum om middernacht.
  for (const [entity, groups] of [['task', TASK_BASELINE_DATES], ['assignment', ASSIGNMENT_BASELINE_DATES]] as const) {
    for (const [number, keys] of groups.entries()) for (const key of keys) {
      const vars = { [key]: mppTimestampBytes(0, START_DAYS) };
      const result = await readFixture({
        tasks: [{ uid: 10, name: 'Fundering', vars: entity === 'task' ? vars : {} }], resourceVars: {},
        assignments: [{ uid: 1, vars: entity === 'assignment' ? vars : {} }],
      });
      eq(`7 ${entity} baseline ${number} veld ${key}: geldige datum`, result.msProjectReport?.baselines, 1);
      eq(`7 ${entity} veld ${key}: baseline niet geïmporteerd`, result.baselines ?? [], []);
    }
  }
  for (const [label, time, days] of [['kleine geldige dag', 10, 50], ['NB-tijd met geldige dag', 65535, START_DAYS]] as const) {
    const result = await readFixture({
      tasks: [{ uid: 10, name: 'Fundering', vars: { 43: mppTimestampBytes(time, days) } }], resourceVars: {}, assignments: [],
    });
    eq(`7 ${label}: volgt getTimestamp`, result.msProjectReport?.baselines, 1);
  }
  const numericBaseline: Fixture = {
    tasks: [{ uid: 10, name: 'Fundering', vars: { 1: double(0), 6: double(0), 27: int32(0), 1301: int32(0), 43: emptyDates[2][1] } }],
    resourceVars: { 342: double(0), 343: double(0) },
    assignments: [{ uid: 1, vars: { 16: double(0), 32: double(0), 146: emptyDates[3][1] } }],
  };
  eq('7 echt nulwerk, nulkosten en nulduur naast lege datums: geen verslag', (await readFixture(numericBaseline)).msProjectReport, undefined);
  numericBaseline.tasks[0].vars = { 27: int32(4800), 43: emptyDates[2][1] };
  numericBaseline.assignments[0].vars = { 32: double(500), 146: emptyDates[3][1] };
  eq('7 duur en kosten naast lege datums blijven tellen, dezelfde baseline één keer', (await readFixture(numericBaseline)).msProjectReport?.baselines, 1);
}

main().then(() => {
  if (fails.length > 0) {
    for (const f of fails) console.log(`XX  mpp-open-notice: ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`OK  mpp-open-notice: ${checks} controles groen`);
  }
}, (e: unknown) => {
  console.log(`XX  mpp-open-notice: uitzondering ${(e as Error).stack}`);
  process.exitCode = 1;
});
