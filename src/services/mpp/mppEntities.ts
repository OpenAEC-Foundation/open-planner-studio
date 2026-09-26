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
import { tenthsOfMinutesToDays } from '@/services/importDurations';
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
 * minute", ONGEACHT welke eenheid `unitCode` claimt) + eenheidscode → `Sequence`-lagvelden. Spiegelt
 * mspdiReader's lag-afhandeling vanuit MPP's eigen eenheidscodering (`getDurationTimeUnits`):
 *  - percent/elapsedPercent: /10. `mspdiReader.ts` leest `LinkLag` bij LagFormat 19/20 als TIENDEN
 *    VAN EEN PROCENT (`seq.lagPercent = link.lag / 10`; `mspdiWriter.ts` schrijft
 *    `Math.round(seq.lagPercent * 10)`). MPXJ normaliseert de schaal in geen van beide lezers, dus dit
 *    zegt niets over een schaalverschil; met dezelfde /10 leveren beide OPS-lezers HELE procenten.
 *  - elapsedMinutes/elapsedHours: minuut-exact `lagMinutes` (`rawLag / 10`) + ELAPSEDTIME — identiek
 *    aan mspdiReader's `ELAPSED_SUBDAY_FORMATS`-tak.
 *  - andere elapsed-varianten: kalenderdagen via `getDuration(rawLag, 'elapsedDays')` (deelt door
 *    24*60*10), afgerond op hele dagen — identiek aan mspdiReader's ELAPSED_DURATION_FORMATS-tak.
 *  - WORKTIME: dezelfde omrekening als taakduur (`tenthsOfMinutesToDays`, `@/services/importDurations`),
 *    TENZIJ de opvolger in uur-modus zit (`isHourSuccessor`): dan minuut-precies `lagMinutes`
 *    (`Math.round(rawLag/10)`) — exact mspdiReader's `taskHourById.get(link.successorId)`-tak.
 *
 * ⚠️ Dekkingsvoorbehoud: het corpus draagt alleen FINISH_START-relaties met lag=0 — de typetabel
 * (`mspTypeToSequenceType`) en alle lag-takken worden alleen door de synthetische fixtures in
 * `check-mpp-relations.ts` gedekt.
 */
type SequenceLagFields = Pick<Sequence, 'lagDays'> & Partial<Pick<Sequence, 'lagMinutes' | 'lagUnit' | 'lagPercent'>>;

function mppLagToSequenceFields(rawLag: number, unitCode: number, hoursPerDay: number, isHourSuccessor: boolean): SequenceLagFields {
  if (rawLag === -1) return { lagDays: 0 }; // MPPUtility.getAdjustedDuration: duration===-1 ⇒ geen lag
  const unit = getDurationTimeUnits(unitCode);
  if (unit === 'percent' || unit === 'elapsedPercent') {
    const fields: SequenceLagFields = { lagDays: 0, lagPercent: rawLag / 10 };
    if (unit === 'elapsedPercent') fields.lagUnit = 'ELAPSEDTIME';
    return fields;
  }
  // Elapsed MINUTEN/UREN ("emin"/"ehr") zijn een uur-lag: minuut-exact, ongeacht de modus van de
  // opvolger (de elapsed-dag-afronding hieronder zou van "12 ehr" 24 uur en van "8 ehr" 0 maken).
  if (unit === 'elapsedMinutes' || unit === 'elapsedHours') {
    return { lagDays: 0, lagMinutes: Math.round(rawLag / 10), lagUnit: 'ELAPSEDTIME' };
  }
  if (unit.startsWith('elapsed')) {
    return { lagDays: Math.round(getDuration(rawLag, 'elapsedDays')), lagUnit: 'ELAPSEDTIME' };
  }
  // Een uur-modus-opvolger krijgt de lag minuut-precies i.p.v. dag-afgerond — `rawLag` is al tienden
  // van een minuut, dus `/10` volstaat.
  if (isHourSuccessor) return { lagDays: 0, lagMinutes: Math.round(rawLag / 10) };
  return { lagDays: tenthsOfMinutesToDays(rawLag, hoursPerDay) };
}

/** Poort van `ConstraintFactory.process` — `"   114"/TBkndCons` → `Sequence[]`. Geëxporteerd zodat
 *  `check-mpp-relations.ts` hem los kan aanroepen. `taskHourById` (optioneel, default leeg = overal
 *  dag-modus): per opvolger-`Task.id` of die in uur-modus zit, voor de lag-eenheid. */
export function readRelations(
  cfb: CfbFile,
  applicationVersion: number | null,
  hoursPerDay: number,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  taskHourById: ReadonlyMap<string, boolean> = new Map(),
): Sequence[] {
  try {
    return readRelationsUnsafe(cfb, applicationVersion, hoursPerDay, taskIdByUniqueId, taskHourById);
  } catch {
    return [];
  }
}

function readRelationsUnsafe(
  cfb: CfbFile,
  applicationVersion: number | null,
  hoursPerDay: number,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  taskHourById: ReadonlyMap<string, boolean>,
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
      ...mppLagToSequenceFields(lagRaw, lagUnitsRaw, hoursPerDay, taskHourById.get(successorId) ?? false),
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
}

/** Factory i.p.v. een module-singleton: de lege resultaatobjecten gaan de store in, en Immer's
 *  autoFreeze zou een gedeelde instantie module-breed bevriezen. */
function emptyResourcesResult(): ReadResourcesResult {
  return { resources: [], resourceIdByUniqueId: new Map() };
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
  const { offset: typeOffset, mask: typeMask } = resourceTypeBitFlag(applicationVersion);
  const indexByShortUid = new Map<number, number>();
  const itemCount = fixedMeta.getAdjustedItemCount();
  for (let index = 0; index < itemCount; index++) {
    const data = fixedData.getByteArrayValue(index);
    if (!data || data.length < uniqueIdOffset + 2) continue;
    const shortUid = getShort(data, uniqueIdOffset, `${label}/FixedData uniqueId (short, spiegelt MPXJ)`);
    if (!indexByShortUid.has(shortUid)) indexByShortUid.set(shortUid, index); // eerste-wint, spiegelt Java's containsKey-guard
  }

  const resources: Resource[] = [];
  const resourceIdByUniqueId = new Map<number, string>();
    // Itereer op de echte unique-ID's uit VarMeta (`rscVarMeta.getUniqueIdentifierArray()`). UniqueID 0
    // is een GELDIGE resource-id (870d339f60603f71's afgeleide kalenders dragen resource-ID 0), dus
    // GEEN uid===0-skip zoals bij taken (waar 0 de projectsamenvattingstaak is).
  for (const uniqueId of varMeta.getUniqueIdentifierArray()) {
    const index = indexByShortUid.get(uniqueId);
    if (index === undefined) continue;
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;

    // UniqueID 0 is MPP's ingebouwde "niet-toegewezen"-plaatshouder. MPXJ slaat hem over
    // (`createResourceMap`'s `data.length < maxFixedDataSize`-guard, niet geport), maar MS Project
    // schrijft hem WÉL naar zijn MSPDI-export ("Niet toegekend", maxUnits 1). Deze lezer kiest
    // COUNT-PARITEIT MET readMSPDI: het record blijft, met een VASTE naam/type/maxUnits (het
    // placeholder-record is typisch te kort om die uit te lezen). De calendarId-koppeling volgt de
    // normale afleiding.
    const isUnassignedPlaceholder = uniqueId === 0;

    const name = isUnassignedPlaceholder
      ? (labels?.unassignedResource || 'Unassigned')
      : varData.getUnicodeString(uniqueId, nameKey, MAX_VAR_TEXT_BYTES, `${label}/name[uid=${uniqueId}]`) || 'Resource';

    let type: ResourceType;
    if (isUnassignedPlaceholder) {
      type = 'LABOR';
    } else {
      const metaItem = fixedMeta.getByteArrayValue(index);
      const isWork = !!metaItem && metaItem.length > typeOffset && (metaItem[typeOffset] & typeMask) !== 0;
      // Niet-WORK ⇒ Fixed2Meta's COST-bit beslist tussen LABOR (Cost) en MATERIAL.
      type = isWork || isFixed2MetaCostBit(fixed2Meta, index) ? 'LABOR' : 'MATERIAL';
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
  }
  return { resources, resourceIdByUniqueId };
}

/** TBkndAssn/FixedMeta-itemgrootte (MPP14Reader.java: `new FixedMeta(..., 34)`). */
const ASSIGNMENT_FIXED_META_ITEM_SIZE = 34;
/** TBkndAssn/FixedData-itemgrootte — GEEN meta-afgeleide offset/grootte, contigue blokken van 110
 *  bytes vanaf offset 0 (MPP14Reader.java: `new FixedData(110, ...)`, de `withoutMeta`-variant). */
const ASSIGNMENT_FIXED_DATA_ITEM_SIZE = 110;

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
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'VarMeta']);
  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) return [];

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, ASSIGNMENT_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.withoutMeta(ASSIGNMENT_FIXED_DATA_ITEM_SIZE, fixedDataBytes, `${label}/FixedData`);
  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);

  const uniqueIdOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.UniqueId);
  const taskUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.TaskUniqueId);
  const resourceUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.ResourceUniqueId);
  const unitsOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Units);
  if (uniqueIdOffset === null || taskUidOffset === null || resourceUidOffset === null) return [];

  const assignments: ResourceAssignment[] = [];
  // Geklemd (FixedMeta.getItemCount) — ResourceAssignmentFactory.java gebruikt de RUWE headerwaarde.
  const itemCount = fixedMeta.getItemCount();
  for (let index = 0; index < itemCount; index++) {
    const meta = fixedMeta.getByteArrayValue(index);
    // Verwijderd-vlag: hier een enkele BYTE (`meta[0] !== 0`), NIET de SHORT-check van TBkndCons
    // hierboven — spiegelt ResourceAssignmentFactory.java letterlijk (`meta[0] != 0`).
    if (!meta || meta.length < 8 || meta[0] !== 0) continue;

    const offset = getInt(meta, 4, `${label}/FixedMeta offset`);
    const dataIndex = fixedData.getIndexFromOffset(offset);
    if (dataIndex === -1) continue;
    const data = fixedData.getByteArrayValue(dataIndex);
    if (!data || data.length < uniqueIdOffset + 4) continue;

    const uid = getInt(data, uniqueIdOffset, `${label}/FixedData uniqueId`);
    if (!varMeta.containsKey(uid)) continue; // spiegelt `assnVarMeta.getUniqueIdentifierSet().contains(varDataId)`

    if (data.length < taskUidOffset + 4 || data.length < resourceUidOffset + 4) continue;
    const taskUid = getInt(data, taskUidOffset, `${label}/FixedData taskUid`);
    const resourceUid = getInt(data, resourceUidOffset, `${label}/FixedData resourceUid`);
    const taskId = taskIdByUniqueId.get(taskUid);
    const resourceId = resourceIdByUniqueId.get(resourceUid);
    // Onvindbare taak/resource ⇒ overslaan — spiegelt mspdiReader se assignmentsectie
    // (`if (!taskId || !resourceId) continue;`), en dekt tegelijk MPXJ se ASSIGNMENT_NULL_RESOURCE_ID
    // (-65535)-sentinel: die uid komt nooit in `resourceIdByUniqueId` voor, dus de lookup faalt vanzelf.
    if (!taskId || !resourceId) continue;

    // ASSIGNMENT_UNITS (DataType.UNITS, FieldMap.java): 8-byte double, zelfde dubbele `/100` als
    // MAX_UNITS hierboven (PERCENT → FRACTIE-schaal, spiegelt mspdiReader's `<Units>`).
    let unitsPerDay = 1;
    if (unitsOffset !== null && data.length >= unitsOffset + 8) {
      const rawUnits = getDouble(data, unitsOffset, `${label}/FixedData units`);
      unitsPerDay = (Math.abs(rawUnits) < 0.1 ? 0 : rawUnits) / 100 / 100;
    }

    assignments.push({ id: generateId('asgn'), taskId, resourceId, unitsPerDay });
  }
  return assignments;
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
