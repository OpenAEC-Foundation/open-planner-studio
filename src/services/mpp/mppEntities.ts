/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Entiteiten: relaties (TBkndCons), resources (TBkndRsc) en assignments (TBkndAssn) — de
 * aanvullende data bovenop de taken uit `mppReader.ts` en de kalenders uit `mppCalendars.ts`. Deze
 * functies lezen alleen CFB-storages, field maps en (voor `readResources`) het `CalendarReadResult`,
 * en hebben geen afhankelijkheid van de taaklaag. Ze delen de altijd-vangende-wrapperconventie
 * (`readXUnsafe` + dunne `readX`-try/catch).
 *
 * `readAssignmentTimephasedRaw` (onderaan) opent `Var2Data` van `TBkndAssn` voor de vier
 * timephased-categorieën uit `mppTimephased.ts` — een bewust aparte lus naast `readAssignments`
 * (zie de sectiekop daar).
 */
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment, ResourceType } from '@/types/resource';
import type { ImportLabels } from '@/services/importTypes';
import { generateId } from '@/utils/id';
import { mspTypeToSequenceType } from '@/services/msproject/mspdiReader';
import type { CfbFile } from './cfb';
import {
  FixedData, FixedMeta, Var2Data, VarMeta12,
  getDouble, getDuration, getDurationTimeUnits, getInt, getShort,
} from './mppPrimitives';
import {
  AssignmentFieldId, ResourceFieldId,
  fixedOffsetOf, varDataKeyOf, type FieldMapTable,
} from './fieldMap14';
import type { CalendarReadResult } from './mppCalendars';
import { MAX_VAR_TEXT_BYTES } from './limits';
import type { AssignmentTimephasedRaw } from './mppTimephased';
import { selectAssignmentRecords } from './mppRecords';

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Relaties (TBkndCons), resources (TBkndRsc) en assignments (TBkndAssn).
//
// LET OP DE NAAMSVERWARRING: "constraints" is in MPP-bestandsjargon TBkndCons = de
// RELATIE-/link-data (`ConstraintFactory.java`); taak-DATUMconstraints komen uit de taak-fieldmap
// (`TaskFieldId.ConstraintType`/`ConstraintDate`). Poort-bronnen: `ConstraintFactory.java`
// (relaties), `MPP14Reader.java`'s `createResourceMap`/`processResourceData` (resources) en
// `ResourceAssignmentFactory.java` (assignments).
//
// Alle drie: een dunne, altijd-vangende wrapper rond de `*Unsafe`-implementatie — een
// kapotte/afwezige storage mag `readMPP` niet laten falen; taken en kalenders zijn dan al gelezen.
// De terugval is een lege array (een geldig, leeg `ImportResult`-onderdeel).
//
// BEWUSTE ASYMMETRIE met `readTasks`: die gooit HARD bij een taak-veldmap zonder
// UNIQUE_ID/ID/NAME/SCHEDULED_START/SCHEDULED_FINISH, terwijl resources/assignments bij een onvolledige
// veldmap stil een LEGE lijst geven. Taken zijn de ruggengraat van het document; een deelresultaat
// (taken + kalenders) is bruikbaarder dan een mislukte import.
//
// Twee bewuste MPXJ-afwijkingen, gemeten als 0 voorkomens over 52 bestanden/650 assignments:
//  (a) `ResourceAssignmentFactory.java` vult een te kort assignment-FixedData-record aan met nullbytes
//      tot `fieldMap.getMaxFixedDataSize(0)`. Hier niet: de per-veld-`data.length`-checks slaan een
//      veld over. In het corpus is `TBkndAssn/FixedData` altijd een exact veelvoud van 110 bytes.
//  (b) MPXJ dedupliceert (`if (task.getExistingResourceAssignment(resource) != null) continue;`); deze
//      lezer niet — een herhaald taak+resource-paar geeft hier twee assignments.
//
// Dubbele offsets (VarMeta-dedup bij resourcenamen, `FixedData.getIndexFromOffset`) kosten hoogstens
// input-lineaire tijd (O(1)-lookup per verwijzing, mppPrimitives.ts), dus geen aparte klem.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** TBkndCons/FixedMeta-itemgrootte (ConstraintFactory.java: `new FixedMeta(..., 10)`). */
const CONS_FIXED_META_ITEM_SIZE = 10;
/** TBkndCons/FixedData-itemgrootte — ALTIJD 20, ongeacht wat de meta zelf rapporteert
 *  (ConstraintFactory.java: `new FixedData(consFixedMeta, 20, ...)`, de `withItemSizeOverride`-
 *  variant van `FixedData`, zie mppPrimitives.ts "meta's itemSize is fout"). */
const CONS_FIXED_DATA_ITEM_SIZE = 20;

/**
 * Ruwe TBkndCons-lag (tienden van een minuut — MPPUtility.getDuration: "value is given in 1/10 of
 * minute", ONGEACHT welke eenheid `unitCode` claimt) + eenheidscode → `Sequence`-lagvelden. Zonder afronding
 * op hele dagen (alleen uren §3.3, §3.10, T15; I4, F5b), in dezelfde vormen als de MSPDI-lezer (F5a):
 *  - percent/elapsedPercent: /10. `mspdiReader.ts` leest `LinkLag` bij LagFormat 19/20 als TIENDEN
 *    VAN EEN PROCENT (`seq.lagPercent = link.lag / 10`; `mspdiWriter.ts` schrijft
 *    `Math.round(seq.lagPercent * 10)`). MPXJ normaliseert de schaal in geen van beide lezers, dus dit
 *    zegt niets over een schaalverschil; met dezelfde /10 leveren beide OPS-lezers HELE procenten.
 *  - elapsedDays: exacte kalenderdagen (`rawLag / (24 × 60 × 10)`) + ELAPSEDTIME, zoals MSPDI LagFormat 8.
 *    Vroeger afgerond op hele dagen.
 *  - de andere elapsed-eenheden (minuten, uren, weken, maanden): minuut-exact `lagMinutes` (`rawLag / 10`)
 *    + ELAPSEDTIME, zoals MSPDI LagFormat 4, 6, 10 en 12.
 *  - WORKTIME: de urenmaat, `lagMinutes` = `rawLag / 10`, voor elke opvolger: een `.mpp` draagt geen
 *    OPS-markering voor een lag in de dagenmaat (T15). Vroeger kreeg een opvolger op een dagkalender hele
 *    werkdagen op de projectbrede `hoursPerDay`.
 *  Tienden van een minuut blijven staan (§3.10, review #591 r1, punt 3), ook na opslaan en exporteren (r2): IFC
 *  met het record `ExactMinuteLags`, MSPDI in `LinkLag` (tienden), P6 XML in de uren van `<Lag>`.
 *
 * ⚠️ Dekkingsvoorbehoud: het corpus draagt alleen FINISH_START-relaties met lag=0 — de typetabel
 * (`mspTypeToSequenceType`) en alle lag-takken worden alleen door de synthetische fixtures in
 * `check-mpp-relations.ts` gedekt.
 */
type SequenceLagFields = Pick<Sequence, 'lagDays'> & Partial<Pick<Sequence, 'lagMinutes' | 'lagUnit' | 'lagPercent'>>;

function mppLagToSequenceFields(rawLag: number, unitCode: number): SequenceLagFields {
  if (rawLag === -1) return { lagDays: 0 }; // MPPUtility.getAdjustedDuration: duration===-1 ⇒ geen lag
  const unit = getDurationTimeUnits(unitCode);
  if (unit === 'percent' || unit === 'elapsedPercent') {
    const fields: SequenceLagFields = { lagDays: 0, lagPercent: rawLag / 10 };
    if (unit === 'elapsedPercent') fields.lagUnit = 'ELAPSEDTIME';
    return fields;
  }
  if (unit === 'elapsedDays') return { lagDays: getDuration(rawLag, 'elapsedDays'), lagUnit: 'ELAPSEDTIME' };
  if (unit.startsWith('elapsed')) return { lagDays: 0, lagMinutes: rawLag / 10, lagUnit: 'ELAPSEDTIME' };
  return { lagDays: 0, lagMinutes: rawLag / 10 };
}

/** Poort van `ConstraintFactory.process` — `"   114"/TBkndCons` → `Sequence[]`. Geëxporteerd zodat
 *  `check-mpp-relations.ts` hem los kan aanroepen. */
export function readRelations(
  cfb: CfbFile,
  applicationVersion: number | null,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Sequence[] {
  try {
    return readRelationsUnsafe(cfb, applicationVersion, taskIdByUniqueId);
  } catch {
    return [];
  }
}

function readRelationsUnsafe(
  cfb: CfbFile,
  applicationVersion: number | null,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Sequence[] {
  const label = '"   114"/TBkndCons';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndCons', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndCons', 'FixedData']);
  if (!fixedMetaBytes || !fixedDataBytes) return []; // legitiem afwezig (geen relaties in dit bestand)

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, CONS_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.withItemSizeOverride(fixedMeta, CONS_FIXED_DATA_ITEM_SIZE, fixedDataBytes, `${label}/FixedData`);

  // project15 (ConstraintFactory.java): mppFileType===14 (altijd waar — assertReadable laat alleen
  // MPP14 door) && applicationVersion > PROJECT_2010(14) — dezelfde "modern"-drempel als elders.
  const project15 = (applicationVersion ?? 0) > 14;
  const durationOffset = project15 ? 14 : 16;
  const durationUnitsOffset = project15 ? 18 : 14;

  const sequences: Sequence[] = [];
  // Geklemd (FixedMeta.getItemCount, mppPrimitives.ts) — ConstraintFactory.java gebruikt hier de
  // RUWE headerwaarde als lusbovengrens.
  const itemCount = fixedMeta.getItemCount();
  for (let index = 0; index < itemCount; index++) {
    const metaItem = fixedMeta.getByteArrayValue(index);
    if (!metaItem || metaItem.length < 8) continue;
    // Verwijderd-vlag: SHORT (niet BYTE — zie de asymmetrie met TBkndAssn hieronder), spiegelt
    // ConstraintFactory.java se "SourceForge bug 2209477"-commentaar letterlijk.
    if (getShort(metaItem, 0, `${label}/FixedMeta deleted-flag`) !== 0) continue;

    const dataOffset = getInt(metaItem, 4, `${label}/FixedMeta offset`);
    const dataIndex = fixedData.getIndexFromOffset(dataOffset);
    if (dataIndex === -1) continue;
    const data = fixedData.getByteArrayValue(dataIndex);
    if (!data || data.length < 14) continue;

    const predecessorUid = getInt(data, 4, `${label}/FixedData taskId1`);
    const successorUid = getInt(data, 8, `${label}/FixedData taskId2`);
    if (predecessorUid === 0 || successorUid === 0) continue; // relatie met de projectsamenvattingstaak
    if (predecessorUid === successorUid) continue; // circulaire relatie (ConstraintFactory.java)

    // Relatie naar een niet-bestaande/gefilterde taak overslaan — spiegelt MPXJ's
    // `task1 != null && task2 != null`-guard (bv. een door `collectValidTaskIndices` gefilterde
    // null-/spooktaak).
    const predecessorId = taskIdByUniqueId.get(predecessorUid);
    const successorId = taskIdByUniqueId.get(successorUid);
    if (!predecessorId || !successorId) continue;

    const relationTypeRaw = getShort(data, 12, `${label}/FixedData type`);
    const type = mspTypeToSequenceType(relationTypeRaw);

    const lagRaw = data.length >= durationOffset + 4 ? getInt(data, durationOffset, `${label}/FixedData lag`) : -1;
    const lagUnitsRaw = data.length >= durationUnitsOffset + 2 ? getShort(data, durationUnitsOffset, `${label}/FixedData lagUnits`) : 0;

    sequences.push({
      id: generateId('seq'),
      predecessorId,
      successorId,
      type,
      ...mppLagToSequenceFields(lagRaw, lagUnitsRaw),
    });
  }
  return sequences;
}

/** TBkndRsc/FixedMeta-itemgrootte (MPP14Reader.java: `new FixedMeta(..., 37)`). */
const RESOURCE_FIXED_META_ITEM_SIZE = 37;
/** TBkndRsc/Fixed2Meta-itemgrootte-KANDIDATEN (MPP14Reader.java: `new FixedMeta(...,
 *  rscFixedData, 50, 51)` — de heuristische variant, `FixedMeta.withHeuristicItemSize`). */
const RESOURCE_FIXED2_META_ITEM_SIZES = [50, 51];

/** Bit die WORK vs. niet-WORK onderscheidt in het TBkndRsc/FixedMeta-item (37 bytes) — spiegelt
 *  MPP14Reader.java se `processResourceData`-tabelkeuze, zelfde "modern"-drempel als
 *  `milestoneBitFlag`/mppCalendars.ts se `useModernOffsets`. */
function resourceTypeBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  const version = applicationVersion ?? 0;
  return version > 14
    ? { offset: 12, mask: 0x10 } // PROJECT2013_RESOURCE_META_DATA_BIT_FLAGS
    : { offset: 9, mask: 0x02 }; // PROJECT2010_RESOURCE_META_DATA_BIT_FLAGS
}

/**
 * COST- vs. MATERIAL-bit voor niet-WORK-resources. MPXJ leest die uit **Fixed2META**, niet
 * Fixed2Data (`MPP14Reader.java`: `byte[] metaData2 = rscFixed2Meta.getByteArrayValue(offset); ...
 * if ((metaData2[8] & 0x10) != 0) resource.setType(COST); else resource.setType(MATERIAL);`).
 *  - `Fixed2Meta` wordt gelezen met dezelfde heuristische constructor als MPXJ
 *    (`FixedMeta.withHeuristicItemSize`, kandidaten 50/51 tegen de itemcount van `rscFixedData`).
 *  - De stream kan legitiem ontbreken; dan niet-WORK ⇒ MATERIAL.
 *  - **Cost → LABOR** (niet MATERIAL): spiegelt mspdiReader's collapse (alleen MSP-Type 0 is
 *    MATERIAL); `ResourceType` kent geen `'COST'`.
 */
function isFixed2MetaCostBit(fixed2Meta: FixedMeta | null, index: number): boolean {
  const item = fixed2Meta?.getByteArrayValue(index) ?? null;
  return !!item && item.length > 8 && (item[8] & 0x10) !== 0;
}

export interface ReadResourcesResult {
  resources: Resource[];
  resourceIdByUniqueId: Map<number, string>;
  /** De `Resource.id`'s van MS Project-KOSTENresources (geen werkbit, wel de Fixed2Meta-kostenbit,
   *  zie `isFixed2MetaCostBit`). `ResourceType` kent geen COST, dus deze resources staan als LABOR in
   *  `resources`. Alleen de lezer gebruikt deze lijst: een kostenresource stuurt in MS Project de duur
   *  niet ("assigning material resources or cost resources to a task doesn't affect task
   *  scheduling"), dus `deriveTimephasedWindowsForTasks` laat haar niet meewandelen. */
  costResourceIds: Set<string>;
}

/** Factory i.p.v. een module-singleton: de lege resultaatobjecten gaan de store in, en Immer's
 *  autoFreeze zou een gedeelde instantie module-breed bevriezen. */
function emptyResourcesResult(): ReadResourcesResult {
  return { resources: [], resourceIdByUniqueId: new Map(), costResourceIds: new Set() };
}

/** Poort van `MPP14Reader.processResourceData`/`createResourceMap` — `"   114"/TBkndRsc` →
 *  `Resource[]`. Geëxporteerd voor `check-mpp-relations.ts`. `labels`: zie de UID-0-toelichting in
 *  `readResourcesUnsafe`. */
export function readResources(
  cfb: CfbFile,
  resourceFieldMap: FieldMapTable,
  applicationVersion: number | null,
  calResult: CalendarReadResult,
  labels?: ImportLabels,
): ReadResourcesResult {
  try {
    return readResourcesUnsafe(cfb, resourceFieldMap, applicationVersion, calResult, labels);
  } catch {
    return emptyResourcesResult();
  }
}

function readResourcesUnsafe(
  cfb: CfbFile,
  resourceFieldMap: FieldMapTable,
  applicationVersion: number | null,
  calResult: CalendarReadResult,
  labels: ImportLabels | undefined,
): ReadResourcesResult {
  const label = '"   114"/TBkndRsc';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndRsc', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndRsc', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndRsc', 'VarMeta']);
  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) return emptyResourcesResult();
  const var2DataBytes = cfb.getStream(['   114', 'TBkndRsc', 'Var2Data']); // legitiem afwezig (mppPrimitives.ts)

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, RESOURCE_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, 0, 0, `${label}/FixedData`);
  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);
  const varData = new Var2Data(varMeta, var2DataBytes);

  // Fixed2Meta is optioneel (zie `isFixed2MetaCostBit`); ontbreekt/onleesbaar ⇒ `null` en niet-WORK
  // valt terug op MATERIAL.
  const fixed2MetaBytes = cfb.getStream(['   114', 'TBkndRsc', 'Fixed2Meta']);
  let fixed2Meta: FixedMeta | null = null;
  if (fixed2MetaBytes) {
    try {
      fixed2Meta = FixedMeta.withHeuristicItemSize(fixed2MetaBytes, fixedData, RESOURCE_FIXED2_META_ITEM_SIZES, `${label}/Fixed2Meta`);
    } catch {
      fixed2Meta = null;
    }
  }

  const uniqueIdOffset = fixedOffsetOf(resourceFieldMap, ResourceFieldId.UniqueId);
  const nameKey = varDataKeyOf(resourceFieldMap, ResourceFieldId.Name);
  const maxUnitsOffset = fixedOffsetOf(resourceFieldMap, ResourceFieldId.MaxUnits);
  if (uniqueIdOffset === null || nameKey === null) return emptyResourcesResult();

  // Poort van `createResourceMap` (MPP14Reader.java r. 935-958): uniqueID→FixedData-index via een
  // SHORT-read op `uniqueIdOffset` — een letterlijke MPXJ-eigenaardigheid (het veld is een 4-byte INT
  // volgens de field map). Alleen een interne join-sleutel; de echte unique-ID komt uit
  // `varMeta.getUniqueIdentifierArray()`. Bij < 65536 resources is de truncatie een no-op; bewust
  // letterlijk gespiegeld.
  // MPXJ toetst de volledige fieldmap-lengte vóór de eerste-wint-join. Onze fieldmap kent alleen
  // locaties, geen veldbreedtes: eis het volledige bereik van de velden die we lezen (SHORT-uid en
  // optionele DOUBLE MAX_UNITS). De offsets komen uit het bestand, ook bij Project 2013/2016/2021;
  // een vaste recordmaat zou geldige kortere layouts of de default-layout ten onrechte weren.
  const minFixedDataSize = Math.max(uniqueIdOffset + 2, maxUnitsOffset === null ? 0 : maxUnitsOffset + 8);
  const { offset: typeOffset, mask: typeMask } = resourceTypeBitFlag(applicationVersion);
  const indexByShortUid = new Map<number, number>();
  const itemCount = fixedMeta.getAdjustedItemCount();
  for (let index = 0; index < itemCount; index++) {
    const data = fixedData.getByteArrayValue(index);
    if (!data || data.length < uniqueIdOffset + 2) continue;
    const shortUid = getShort(data, uniqueIdOffset, `${label}/FixedData uniqueId (short, spiegelt MPXJ)`);
    // UID 0 blijft de bewust ondersteunde sentinel; voor echte resources mag een kort
    // plaatshoudersrecord nooit de index (en daarmee type/meta en maxUnits) vastleggen.
    if (shortUid !== 0 && data.length < minFixedDataSize) continue;
    if (!indexByShortUid.has(shortUid)) indexByShortUid.set(shortUid, index); // eerste-wint, spiegelt Java's containsKey-guard
  }

  const resources: Resource[] = [];
  const resourceIdByUniqueId = new Map<number, string>();
  const costResourceIds = new Set<string>();
    // Itereer op de echte unique-ID's uit VarMeta (`rscVarMeta.getUniqueIdentifierArray()`). UniqueID 0
    // is een GELDIGE resource-id (870d339f60603f71's afgeleide kalenders dragen resource-ID 0), dus
    // GEEN uid===0-skip zoals bij taken (waar 0 de projectsamenvattingstaak is).
  for (const uniqueId of varMeta.getUniqueIdentifierArray()) {
    const index = indexByShortUid.get(uniqueId);
    if (index === undefined) continue;
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;

    // UniqueID 0 is MPP's ingebouwde "niet-toegewezen"-plaatshouder. MPXJ slaat hem over
    // (`createResourceMap`'s `data.length < maxFixedDataSize`-guard), maar MS Project
    // schrijft hem WÉL naar zijn MSPDI-export ("Niet toegekend", maxUnits 1). Deze lezer kiest
    // COUNT-PARITEIT MET readMSPDI: het record blijft, met een VASTE naam/type/maxUnits (het
    // placeholder-record is typisch te kort om die uit te lezen). De calendarId-koppeling volgt de
    // normale afleiding.
    const isUnassignedPlaceholder = uniqueId === 0;

    const name = isUnassignedPlaceholder
      ? (labels?.unassignedResource || 'Unassigned')
      : varData.getUnicodeString(uniqueId, nameKey, MAX_VAR_TEXT_BYTES, `${label}/name[uid=${uniqueId}]`) || 'Resource';

    let type: ResourceType;
    let isCost = false;
    if (isUnassignedPlaceholder) {
      type = 'LABOR';
    } else {
      const metaItem = fixedMeta.getByteArrayValue(index);
      const isWork = !!metaItem && metaItem.length > typeOffset && (metaItem[typeOffset] & typeMask) !== 0;
      // Niet-WORK ⇒ Fixed2Meta's COST-bit beslist tussen LABOR (Cost) en MATERIAL.
      isCost = !isWork && isFixed2MetaCostBit(fixed2Meta, index);
      type = isWork || isCost ? 'LABOR' : 'MATERIAL';
    }

    // MAX_UNITS (DataType.UNITS, FieldMap.java): 8-byte double. FieldMap.java's eigen `/100` levert
    // MPXJ's PERCENT-schaal (100.0 = voltijds); dit project rekent in de FRACTIE-schaal (1 = 100%,
    // zoals mspdiReader), dus nóg een `/100`. Zonder die tweede deling kreeg elke resource 100× de
    // MSPDI-waarde.
    let maxUnits = 1;
    if (!isUnassignedPlaceholder && maxUnitsOffset !== null && data.length >= maxUnitsOffset + 8) {
      const rawUnits = getDouble(data, maxUnitsOffset, `${label}/FixedData maxUnits`);
      maxUnits = (Math.abs(rawUnits) < 0.1 ? 0 : rawUnits) / 100 / 100;
    }

    const resource: Resource = { id: generateId('res'), name, type, description: '', maxUnits };
    const calUid = calResult.resourceCalendarUniqueIdByResourceUniqueId.get(uniqueId);
    if (calUid !== undefined) {
      const cal = calResult.calendarByUniqueId.get(calUid);
      if (cal) resource.calendarId = cal.id;
    }

    resources.push(resource);
    resourceIdByUniqueId.set(uniqueId, resource.id);
    if (isCost) costResourceIds.add(resource.id);
  }
  return { resources, resourceIdByUniqueId, costResourceIds };
}

/** Poort van `ResourceAssignmentFactory.process` — `"   114"/TBkndAssn` → `ResourceAssignment[]`,
 *  met mspdiReader's `unitsPerDay`-afleiding. Geëxporteerd voor `check-mpp-relations.ts`. */
export function readAssignments(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  resourceIdByUniqueId: ReadonlyMap<number, string>,
): ResourceAssignment[] {
  try {
    return readAssignmentsUnsafe(cfb, assignmentFieldMap, taskIdByUniqueId, resourceIdByUniqueId);
  } catch {
    return [];
  }
}

function readAssignmentsUnsafe(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  resourceIdByUniqueId: ReadonlyMap<number, string>,
): ResourceAssignment[] {
  const label = '"   114"/TBkndAssn';
  const uniqueIdOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.UniqueId);
  const taskUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.TaskUniqueId);
  const resourceUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.ResourceUniqueId);
  const unitsOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Units);
  if (uniqueIdOffset === null || taskUidOffset === null || resourceUidOffset === null) return [];
  // De recordselectie (verwijderd, geen var-data) is gedeeld met het importverslag (`mppRecords.ts`).
  const selected = selectAssignmentRecords(cfb, uniqueIdOffset);
  if (!selected) return [];

  const assignments: ResourceAssignment[] = [];
  for (const { data } of selected.records) {
    if (data.length < taskUidOffset + 4 || data.length < resourceUidOffset + 4) continue;
    const taskUid = getInt(data, taskUidOffset, `${label}/FixedData taskUid`);
    const resourceUid = getInt(data, resourceUidOffset, `${label}/FixedData resourceUid`);
    const taskId = taskIdByUniqueId.get(taskUid);
    const resourceId = resourceIdByUniqueId.get(resourceUid);
    // Onvindbare taak/resource ⇒ overslaan — spiegelt mspdiReader se assignmentsectie
    // (`if (!taskId || !resourceId) continue;`), en dekt tegelijk MPXJ se ASSIGNMENT_NULL_RESOURCE_ID
    // (-65535)-sentinel: die uid komt nooit in `resourceIdByUniqueId` voor, dus de lookup faalt vanzelf.
    if (!taskId || !resourceId) continue;

    const unitsPerDay = decodeAssignmentUnits(data, unitsOffset) ?? 1;

    assignments.push({ id: generateId('asgn'), taskId, resourceId, unitsPerDay });
  }
  return assignments;
}

/** ASSIGNMENT_UNITS (DataType.UNITS, FieldMap.java): 8-byte double, zelfde dubbele `/100` als
 *  MAX_UNITS in `readResourcesUnsafe` (PERCENT → FRACTIE-schaal, spiegelt mspdiReader's `<Units>`).
 *  `null` als het veld niet in de veldkaart staat of het record te kort is; `readAssignments` valt
 *  dan terug op 1. Gedeeld met `mppReader.ts`'s `buildAssignmentUidLinks`, zodat de wandeling per
 *  toewijzing dezelfde inzet ziet als `ResourceAssignment.unitsPerDay`. */
export function decodeAssignmentUnits(data: Uint8Array, unitsOffset: number | null): number | null {
  if (unitsOffset === null || data.length < unitsOffset + 8) return null;
  const rawUnits = getDouble(data, unitsOffset, '"   114"/TBkndAssn/FixedData units');
  return (Math.abs(rawUnits) < 0.1 ? 0 : rawUnits) / 100 / 100;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Timephased-plumbing: opent `Var2Data` van `TBkndAssn` en geeft de vier ruwe categoriebyteblokken
// (`mppTimephased.ts`'s `AssignmentTimephasedRaw`) door, GEKEYD OP DE RUWE MPP-ASSIGNMENT-UNIQUEID,
// niet op `ResourceAssignment.id` (dat gegenereerde ID bestaat pas ná `readAssignments`).
//
// Een bewust aparte lus: `readAssignments` heeft een vast testcontract (een kale
// `ResourceAssignment[]`, `check-mpp-relations.ts`). Alleen VarMeta/Var2Data zijn nodig (Var2Data is
// al op uniqueId geïndexeerd), dus de "verwijderd"-vlag uit FixedMeta wordt HIER niet getoetst: een
// verwijderde toewijzing met achtergebleven var-data komt hier door. De koppeling aan taken gebeurt
// in `mppReader.ts` (`buildAssignmentUidLinks`), die de uid's via FixedMeta/FixedData oplost.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** De vier VAR_DATA-lookups van `ResourceAssignmentFactory.process` voor de timephased-categorieën.
 *  Geëxporteerd voor `check-mpp-import.ts`. */
export function readAssignmentTimephasedRaw(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
): Map<number, AssignmentTimephasedRaw> {
  try {
    return readAssignmentTimephasedRawUnsafe(cfb, assignmentFieldMap);
  } catch {
    return new Map();
  }
}

function readAssignmentTimephasedRawUnsafe(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
): Map<number, AssignmentTimephasedRaw> {
  const label = '"   114"/TBkndAssn';
  const varMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'VarMeta']);
  if (!varMetaBytes) return new Map(); // legitiem afwezig (bv. bestand zonder assignments)
  const var2DataBytes = cfb.getStream(['   114', 'TBkndAssn', 'Var2Data']); // legitiem afwezig (mppPrimitives.ts)

  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);
  const varData = new Var2Data(varMeta, var2DataBytes);

  const actualRegularKey = varDataKeyOf(assignmentFieldMap, AssignmentFieldId.ActualRegularWork);
  const remainingRegularKey = varDataKeyOf(assignmentFieldMap, AssignmentFieldId.RemainingRegularWork);
  const actualOvertimeKey = varDataKeyOf(assignmentFieldMap, AssignmentFieldId.ActualOvertimeWork);
  const actualIrregularKey = varDataKeyOf(assignmentFieldMap, AssignmentFieldId.ActualIrregularWork);

  const result = new Map<number, AssignmentTimephasedRaw>();
  for (const uniqueId of varMeta.getUniqueIdentifierArray()) {
    const raw: AssignmentTimephasedRaw = {
      actualRegularWork: actualRegularKey === null ? null : varData.getByteArray(uniqueId, actualRegularKey),
      remainingRegularWork: remainingRegularKey === null ? null : varData.getByteArray(uniqueId, remainingRegularKey),
      actualOvertimeWork: actualOvertimeKey === null ? null : varData.getByteArray(uniqueId, actualOvertimeKey),
      actualIrregularWork: actualIrregularKey === null ? null : varData.getByteArray(uniqueId, actualIrregularKey),
    };
    if (raw.actualRegularWork || raw.remainingRegularWork || raw.actualOvertimeWork || raw.actualIrregularWork) {
      result.set(uniqueId, raw);
    }
  }
  return result;
}
