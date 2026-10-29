/**
 * Importverslag voor `.mpp` (MPP14): wat `readMPP` NIET overneemt (issue #391, "exchange without
 * silent loss"). Alleen tellen; de lezer zelf blijft ongewijzigd.
 *
 * De veldkaarten in `fieldMap14.ts` dienen zowel de lezer als dit verslag; kosten en tarieven
 * worden alleen voor verliesdetectie opgezocht. De lezer neemt de hieronder getelde velden niet over.
 * De var-data-sleutels en fixed-data-veld-id's komen letterlijk uit MPXJ (`FieldMap14.java`,
 * `getDefaultTaskData`/`getDefaultResourceData`/`getDefaultAssignmentData`; MPP14 gebruikt de
 * veld-id zelf als var-data-sleutel, `useTypeAsVarDataKey()`), de baseline-sleutels uit
 * `MPPTaskField.mapMpp14` (in MPP14 staan de baselinedatums onder de *_ESTIMATED_*-id's), de
 * hyperlinkvorm uit `HyperlinkReader.java` en de tarieftabelvorm uit `CostRateTableFactory.java`.
 * Gemeten tegen de MPP14-testbestanden van MPXJ (`junit/data/mpp14*.mpp`), zie het PR-verslag.
 *
 * Niet geteld (bewust): terugkerende taken (de keren staan als gewone subtaken in het bestand),
 * vlaggen (ja/nee-velden zijn bitvelden in de metadata, geen var-data) en kostenresources (die komen
 * mee als resource).
 */
import type { CfbFile } from './cfb';
import { FixedData, FixedMeta, getDouble, getShort, getUnicodeString, Var2Data, VarMeta12 } from './mppPrimitives';
import { AssignmentFieldId, fixedOffsetOf, ResourceFieldId, TaskFieldId, type FieldMapTable } from './fieldMap14';
import { collectValidTaskIndices, selectAssignmentRecords } from './mppRecords';
import { emptyMsProjectImportReport, type MsProjectImportReport } from '@/services/importTypes';

// ── Taak (TBkndTask) ─────────────────────────────────────────────────────────────────────────────
const TASK_NOTES = 15;
const TASK_HYPERLINK_DATA = 215;
/** `SUBPROJECT_TASKS_UNIQUEID_OFFSET`: alleen een ingevoegd project draagt dit (MPXJ `mpp14subproject.mpp`). */
const TASK_SUBPROJECT_UNIQUEID_OFFSET = 458;
/** `SUBPROJECT_TASK_ID` ≠ 0 ⇒ externe taak (MPP14Reader.java: `task.setExternalTask(true)`). */
const TASK_SUBPROJECT_TASK_ID = 255;
/** Baselinevelden gescheiden naar datatype: datums volgen dezelfde decoder als de lezer,
 *  numerieke velden houden hun bestaande nulcontrole. */
interface BaselineFields {
  dates: readonly number[];
  values: readonly number[];
}
/** Baseline 0–10 van een taak: alle var-data-velden met gegevens (`FieldMap14.getDefaultTaskData`):
 *  start, einde en duur (in MPP14 onder de *_ESTIMATED_*-id's, `MPPTaskField.mapMpp14`, plus de
 *  1299+-varianten), werk en kosten. De eenhedenvelden (`*_DURATION_UNITS`) tellen niet. */
const TASK_BASELINE_KEYS: readonly BaselineFields[] = [
  { dates: [43, 44, 1299, 1300], values: [1, 6, 27, 1301] },
  ...[482, 493, 504, 515, 526, 544, 555, 566, 577, 588].map((start, i) => {
    const late = 1302 + i * 3;
    return { dates: [start, start + 1, late, late + 1], values: [start + 2, start + 3, start + 5, late + 2] };
  }),
];
/** Baseline 1–10 van een resource: werk en kosten (var-data). Baseline 0 staat in vaste velden en is
 *  de optelling van de toewijzingen, die hieronder al tellen. */
const RESOURCE_BASELINE_KEYS: readonly (readonly number[])[] = [
  [], ...[342, 352, 362, 372, 382, 392, 402, 412, 422, 432].map(work => [work, work + 1]),
];
/** Baseline 0–10 van een toewijzing: werk, kosten, start, einde. */
const ASSIGNMENT_BASELINE_KEYS: readonly BaselineFields[] = [
  { dates: [146, 147], values: [16, 32] },
  ...[289, 298, 307, 316, 325, 334, 343, 352, 361, 370].map(work => ({
    dates: [work + 6, work + 7], values: [work, work + 1],
  })),
];
/** Eigen velden van een taak (Text/Number/Date/Start/Finish/Cost/Duration 1–n, Outline Code 1–10 en
 *  de enterprise-varianten): var-data-sleutels uit `FieldMap14.getDefaultTaskData`. */
const TASK_CUSTOM_KEYS = ranges([
  [51, 70], [87, 91], [103, 108], [258, 291], [302, 336],
  [417, 417], [419, 419], [421, 421], [423, 423], [425, 425], [427, 427], [429, 429], [431, 431], [433, 433], [435, 435],
  [599, 648], [699, 738], [799, 838],
]);

// ── Resource (TBkndRsc) ──────────────────────────────────────────────────────────────────────────
const RESOURCE_NOTES = 20;
const RESOURCE_HYPERLINK_DATA = 136;
/** `COST_RATE_A`…`COST_RATE_E`. */
const RESOURCE_COST_RATE_KEYS = [61, 62, 63, 64, 65];
const RESOURCE_CUSTOM_KEYS = ranges([
  [8, 9], [30, 32], [97, 119], [123, 125], [166, 194], [205, 244],
  [279, 279], [281, 281], [283, 283], [285, 285], [287, 287], [289, 289], [291, 291], [293, 293], [295, 295], [297, 297],
  [446, 495], [546, 585], [646, 685],
]);

// ── Toewijzing (TBkndAssn) ───────────────────────────────────────────────────────────────────────
const ASSIGNMENT_NOTES = 71;
const ASSIGNMENT_CUSTOM_KEYS = ranges([[88, 115], [119, 121], [159, 187], [198, 237], [381, 430], [461, 540]]);

/** Zelfde vaste maten als de lezer (`mppReader.ts`, `mppEntities.ts`). */
const TASK_FIXED_META_ITEM_SIZE = 47;
const RESOURCE_FIXED_META_ITEM_SIZE = 37;
const MAX_NOTE_BYTES = 1_048_576;

function ranges(list: readonly (readonly [number, number])[]): number[] {
  const out: number[] = [];
  for (const [from, to] of list) for (let key = from; key <= to; key++) out.push(key);
  return out;
}

/** Leeg = ontbreekt, of alleen nullen (lege tekst, getal 0) of alleen 0xFF ("NB"-datum). */
function hasValue(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length === 0) return false;
  return bytes.some(b => b !== 0) && bytes.some(b => b !== 0xff);
}

function baselineHasValue(data: Var2Data, uid: number, fields: BaselineFields): boolean {
  return fields.dates.some(key => data.getTimestamp(uid, key) !== null)
    || fields.values.some(key => hasValue(data.getByteArray(uid, key)));
}

/**
 * Inhoud in een RTF-aantekening (MS Project bewaart aantekeningen als 8-bit RTF). Inhoud is zichtbare
 * tekst (ook `\'hh` en Unicode via `\uN`), een afbeelding (`\pict`, ook binnen `{\*\shppict}`) of
 * een ingesloten object (`\object`). Een aantekening met alleen opmaak telt niet. Metadata en
 * onbekende destinations met `\*` worden volledig overgeslagen; afbeeldingswrappers mogen wel echte
 * afbeeldingen bevatten. De lezer neemt geen enkele aantekening over, dus elke aantekening met
 * inhoud is verloren.
 */
export function rtfHasVisibleText(bytes: Uint8Array): boolean {
  let text = '';
  // Eén byte per teken: ook nulbytes kunnen binnen een `\binN`-payload vallen.
  for (let i = 0; i < bytes.length && i < MAX_NOTE_BYTES; i++) text += String.fromCharCode(bytes[i]);
  if (!/^\{[\r\n]*\\rtf/.test(text)) {
    const end = text.indexOf('\0');
    return (end < 0 ? text : text.slice(0, end)).trim() !== '';
  }
  const SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'generator', 'listtable', 'listoverridetable']);
  const skipStack: boolean[] = [];
  let skip = false;
  let destination: 'start' | 'starred' | 'body' = 'body';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    // CR/LF zijn geen teksttokens; een nulbyte is alleen buiten binaire payload de terminator.
    if (c === '\0') break;
    if (c === '\r' || c === '\n') continue;
    if (c === '{') {
      if (destination === 'starred') skip = true;
      skipStack.push(skip);
      destination = 'start';
    } else if (c === '}') {
      skip = skipStack.pop() ?? false;
      destination = 'body';
    } else if (c === '\\') {
      const next = text[i + 1];
      if (next === '*' && destination !== 'body') {
        destination = 'starred';
        i++;
        continue;
      }
      const m = /^\\([a-z]+)(-?\d+)? ?/.exec(text.slice(i, i + 40));
      if (m) {
        const word = m[1];
        if (destination !== 'body') {
          // De eerste controlwoordtoken bepaalt de bestemming, ook na CR/LF of `\*`.
          // Geërfde metadata blijft verborgen; `\\pict` wordt hieronder als tekstescape verwerkt.
          if (!skip && (word === 'pict' || word === 'object')) return true;
          // Word/RichEdit gebruikt `{\*\shppict{\pict …}}`; deze wrapper heft een geërfde skip niet op.
          if (SKIP.has(word) || (destination === 'starred' && word !== 'shppict' && word !== 'nonshppict')) skip = true;
        }
        destination = 'body';
        // `\uN` is één Unicode-teken (`\uc0` en `\ucN` zijn alleen een instelling).
        if (word === 'u' && m[2] !== undefined && !skip) return true;
        i += m[0].length - 1;
        if (word === 'bin' && m[2] !== undefined) {
          // Ruwe bytes zijn geen tokens, ook niet in overgeslagen bestemmingen. Accolades,
          // backslashes, CR/LF en nulbytes in de payload veranderen dus geen groepsgrenzen.
          i += Math.min(Math.max(0, Number(m[2])), text.length - i - 1);
        }
      } else {
        if (destination === 'starred') skip = true;
        destination = 'body';
        if (next === "'") { if (!skip) return true; i += 3; continue; }
        if (next === '\\' || next === '{' || next === '}') { if (!skip) return true; i++; continue; }
        i++;
      }
    } else {
      if (destination === 'starred') {
        if (/\s/.test(c)) continue;
        skip = true;
      }
      destination = 'body';
      if (!skip && !/\s/.test(c)) return true;
    }
  }
  return false;
}

/** `HyperlinkReader.java`: drie UTF-16-teksten (weergave, adres, subadres), elk 12 bytes na de vorige. */
function hyperlinkHasText(bytes: Uint8Array | null): boolean {
  if (!bytes) return false;
  let offset = 24;
  for (let part = 0; part < 3; part++) {
    if (offset >= bytes.length) return false;
    const value = getUnicodeString(bytes, offset, 4096, 'mpp hyperlink');
    if (value.trim() !== '') return true;
    offset += (value.length + 1) * 2 + 12;
  }
  return false;
}

/** `CostRateTableFactory.java`: records van 44 bytes vanaf 16; standaard @0, overwerk @16, per gebruik @32. */
function rateTableHasRate(bytes: Uint8Array | null): boolean {
  if (!bytes) return false;
  for (let i = 16; i + 44 <= bytes.length; i += 44) {
    if (getDouble(bytes, i) !== 0 || getDouble(bytes, i + 16) !== 0 || getDouble(bytes, i + 32) !== 0) return true;
  }
  return false;
}

function doubleAt(data: Uint8Array | null, offset: number | null): number {
  return data && offset !== null && data.length >= offset + 8 ? getDouble(data, offset) : 0;
}

function openVar(cfb: CfbFile, storage: string): { meta: VarMeta12; data: Var2Data } | null {
  const metaBytes = cfb.getStream(['   114', storage, 'VarMeta']);
  if (!metaBytes) return null;
  const meta = new VarMeta12(metaBytes, `${storage}/VarMeta`);
  return { meta, data: new Var2Data(meta, cfb.getStream(['   114', storage, 'Var2Data'])) };
}

export interface MppImportLossInput {
  cfb: CfbFile;
  taskFieldMap: FieldMapTable;
  resourceFieldMap: FieldMapTable;
  assignmentFieldMap: FieldMapTable;
  /** De taken die de lezer echt inlas (`taskIdByUniqueId`). */
  taskUniqueIds: ReadonlySet<number>;
  /** De resources die de lezer echt inlas (`resourceIdByUniqueId`). */
  resourceUniqueIds: ReadonlySet<number>;
}

/** Telt per categorie wat `readMPP` niet overneemt. Fouten in een deel (kapotte stream) laten dat deel
 *  op 0: het verslag mag het openen nooit breken. */
export function scanMppImportLoss(input: MppImportLossInput): MsProjectImportReport {
  const report = emptyMsProjectImportReport('mpp');
  // Var2Data levert voor gedeelde offsets dezelfde byteview. Elke storage heeft eigen views,
  // ook als offset/inhoud gelijk zijn. Alleen notitievelden gebruiken deze cache; hij leeft één
  // scan en bewaart ook false, zodat opmaak/verborgen metadata niet per entiteit opnieuw scant.
  const noteContentByBlock = new WeakMap<Uint8Array, boolean>();
  const noteHasContent = (bytes: Uint8Array | null): boolean => {
    if (!bytes) return false;
    const cached = noteContentByBlock.get(bytes);
    if (cached !== undefined) return cached;
    const content = rtfHasVisibleText(bytes);
    noteContentByBlock.set(bytes, content);
    return content;
  };
  const customFields = new Set<string>();
  const baselines = new Set<number>();
  const guard = (part: () => void) => { try { part(); } catch { /* deel overslaan */ } };

  guard(() => {
    const task = openVar(input.cfb, 'TBkndTask');
    if (!task) return;
    for (const uid of input.taskUniqueIds) {
      if (!task.meta.containsKey(uid)) continue;
      const bytes = (key: number) => task.data.getByteArray(uid, key);
      if (noteHasContent(bytes(TASK_NOTES))) report.notes++;
      if (hyperlinkHasText(bytes(TASK_HYPERLINK_DATA))) report.hyperlinks++;
      if (hasValue(bytes(TASK_SUBPROJECT_UNIQUEID_OFFSET))) report.subprojects++;
      if (task.data.getInt(uid, TASK_SUBPROJECT_TASK_ID) !== 0) report.externalTasks++;
      TASK_BASELINE_KEYS.forEach((keys, number) => {
        if (baselineHasValue(task.data, uid, keys)) baselines.add(number);
      });
      for (const key of TASK_CUSTOM_KEYS) if (hasValue(bytes(key))) customFields.add(`task:${key}`);
    }
  });

  guard(() => {
    const offset = fixedOffsetOf(input.taskFieldMap, TaskFieldId.FixedCost);
    const uidOffset = fixedOffsetOf(input.taskFieldMap, TaskFieldId.UniqueId);
    const metaBytes = input.cfb.getStream(['   114', 'TBkndTask', 'FixedMeta']);
    const dataBytes = input.cfb.getStream(['   114', 'TBkndTask', 'FixedData']);
    const varMetaBytes = input.cfb.getStream(['   114', 'TBkndTask', 'VarMeta']);
    if (offset === null || uidOffset === null || !metaBytes || !dataBytes || !varMetaBytes) return;
    const meta = FixedMeta.withItemSize(metaBytes, TASK_FIXED_META_ITEM_SIZE, 'TBkndTask/FixedMeta');
    const data = FixedData.fromMeta(meta, dataBytes, 0, 0, 'TBkndTask/FixedData');
    // Dezelfde recordselectie als de lezer (`mppRecords.ts`).
    const indices = collectValidTaskIndices(meta, data, new VarMeta12(varMetaBytes, 'TBkndTask/VarMeta'), uidOffset);
    for (const [uid, index] of indices) {
      if (!input.taskUniqueIds.has(uid)) continue;
      if (doubleAt(data.getByteArrayValue(index), offset) !== 0) report.fixedCosts++;
    }
  });

  guard(() => {
    const resource = openVar(input.cfb, 'TBkndRsc');
    if (!resource) return;
    const rateLost = new Set<number>();
    for (const uid of input.resourceUniqueIds) {
      if (!resource.meta.containsKey(uid)) continue;
      const bytes = (key: number) => resource.data.getByteArray(uid, key);
      if (noteHasContent(bytes(RESOURCE_NOTES))) report.notes++;
      if (hyperlinkHasText(bytes(RESOURCE_HYPERLINK_DATA))) report.hyperlinks++;
      if (RESOURCE_COST_RATE_KEYS.some(key => rateTableHasRate(bytes(key)))) rateLost.add(uid);
      RESOURCE_BASELINE_KEYS.forEach((keys, number) => {
        if (keys.some(key => hasValue(bytes(key)))) baselines.add(number);
      });
      for (const key of RESOURCE_CUSTOM_KEYS) if (hasValue(bytes(key))) customFields.add(`resource:${key}`);
    }
    // Tabel A slaat MS Project soms niet op (CostRateTableFactory: "economises"); dan staan de tarieven
    // alleen in de vaste velden.
    guard(() => {
      const offsets = [ResourceFieldId.StandardRate, ResourceFieldId.OvertimeRate, ResourceFieldId.CostPerUse]
        .map(field => fixedOffsetOf(input.resourceFieldMap, field));
      const uidOffset = fixedOffsetOf(input.resourceFieldMap, ResourceFieldId.UniqueId);
      const maxUnitsOffset = fixedOffsetOf(input.resourceFieldMap, ResourceFieldId.MaxUnits);
      const metaBytes = input.cfb.getStream(['   114', 'TBkndRsc', 'FixedMeta']);
      const dataBytes = input.cfb.getStream(['   114', 'TBkndRsc', 'FixedData']);
      if (uidOffset === null || !metaBytes || !dataBytes) return;
      const meta = FixedMeta.withItemSize(metaBytes, RESOURCE_FIXED_META_ITEM_SIZE, 'TBkndRsc/FixedMeta');
      const data = FixedData.fromMeta(meta, dataBytes, 0, 0, 'TBkndRsc/FixedData');
      // Dezelfde selectie als `readResources`: UID en optionele MAX_UNITS moeten passen, behalve
      // bij de ondersteunde UID-0-sentinel. Tariefvelden bepalen de recordselectie niet.
      const minLength = Math.max(uidOffset + 2, maxUnitsOffset === null ? 0 : maxUnitsOffset + 8);
      const seen = new Set<number>();
      for (let index = 0; index < meta.getAdjustedItemCount(); index++) {
        const item = data.getByteArrayValue(index);
        if (!item || item.length < uidOffset + 2) continue;
        const uid = getShort(item, uidOffset);
        if (uid !== 0 && item.length < minLength) continue;
        if (seen.has(uid) || !input.resourceUniqueIds.has(uid)) continue;
        seen.add(uid);
        // Een geselecteerd kort record kan al een volledig tarief dragen. Ontbrekende of slechts
        // gedeeltelijk aanwezige DOUBLE-velden geven via `doubleAt` afzonderlijk 0.
        if (offsets.some(offset => doubleAt(item, offset) !== 0)) rateLost.add(uid);
      }
    });
    report.resourceRates = rateLost.size;
  });

  guard(() => {
    // Dezelfde recordselectie als `readAssignments` (`mppRecords.ts`): een verwijderde toewijzing met
    // achtergebleven var-data telt niet.
    const uidOffset = fixedOffsetOf(input.assignmentFieldMap, AssignmentFieldId.UniqueId);
    if (uidOffset === null) return;
    const selected = selectAssignmentRecords(input.cfb, uidOffset);
    if (!selected) return;
    const data = new Var2Data(selected.varMeta, input.cfb.getStream(['   114', 'TBkndAssn', 'Var2Data']));
    for (const { uid } of selected.records) {
      const bytes = (key: number) => data.getByteArray(uid, key);
      if (noteHasContent(bytes(ASSIGNMENT_NOTES))) report.notes++;
      for (const key of ASSIGNMENT_CUSTOM_KEYS) if (hasValue(bytes(key))) customFields.add(`assignment:${key}`);
      ASSIGNMENT_BASELINE_KEYS.forEach((keys, number) => {
        if (baselineHasValue(data, uid, keys)) baselines.add(number);
      });
    }
  });

  report.baselines = baselines.size;
  report.customFields = customFields.size;
  return report;
}
