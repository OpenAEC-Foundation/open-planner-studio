/**
 * Recordselectie voor `.mpp` (MPP14), gedeeld door de lezer (`mppReader.ts`, `mppEntities.ts`) en het
 * importverslag (`mppImportLoss.ts`). Eén plek, zodat het verslag precies de records telt die de lezer
 * ook inleest: verwijderde, null- en spookrecords vallen bij beide weg. Een eigen bladmodule (alleen
 * `mppPrimitives` en `cfb`), zodat `mppImportLoss.ts` haar kan gebruiken zonder kringverwijzing met
 * `mppReader.ts`.
 */
import type { CfbFile } from './cfb';
import { FixedData, FixedMeta, getInt, getShort, VarMeta12 } from './mppPrimitives';

// ── Taken (TBkndTask) ────────────────────────────────────────────────────────────────────────────
/** Fixed-data-blokken kleiner dan dit zijn "null-taak"-plaatshouders (verwijderde/vrijgemaakte
 *  unique-ID's die geen echte taak dragen) — MPP14Reader.java's `NULL_TASK_BLOCK_SIZE`. */
export const NULL_TASK_BLOCK_SIZE = 16;
/** Bit 0x02 in de eerste 4 bytes van een FixedMeta-item markeert een verwijderde taak
 *  (`createTaskMap`'s `flags & 0x02`-check). */
export const DELETED_TASK_FLAG = 0x02;
/** De eerste drie FixedData-slots zijn geen taken (MPP14Reader.java's `createTaskMap`: "First
 *  three items are not tasks, so let's skip them"). */
export const FIRST_TASK_INDEX = 3;

/** Poort van `MPP14Reader.processTaskData`'s `createTaskMap`, vereenvoudigd tot een
 *  `uniqueID → FixedData-index`-tabel zonder verwijderde/null-/spooktaken (KRITIEK voor
 *  taakaantal-pariteit met MS Project). Java itereert achterwaarts en voegt alleen toe als de sleutel
 *  nog niet bestaat (hoogste index wint); hier voorwaarts met overschrijven — zelfde resultaat. */
export function collectValidTaskIndices(fixedMeta: FixedMeta, fixedData: FixedData, varMeta: VarMeta12, uniqueIdOffset: number): Map<number, number> {
  const itemCount = fixedMeta.getAdjustedItemCount();
  const validIndexByUniqueId = new Map<number, number>();
  const deletedIds = new Set<number>();

  for (let index = FIRST_TASK_INDEX; index < itemCount; index++) {
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;
    const metaItem = fixedMeta.getByteArrayValue(index);
    if (!metaItem || metaItem.length < 4) continue;

    const flags = getInt(metaItem, 0, 'TBkndTask/FixedMeta-flags');
    if ((flags & DELETED_TASK_FLAG) !== 0) {
      // Verwijderde-taak-marker: alleen de unique-ID onthouden (voor de spooktaak-check
      // hieronder) — MPP14Reader.java leest 'm hier als SHORT ("Only a short stored for deleted
      // tasks?"), niet als de gebruikelijke INT.
      if (data.length >= 2) deletedIds.add(getShort(data, 0, 'TBkndTask/FixedData deleted-uid'));
      continue;
    }
    // Null-taak-plaatshouder: MPXJ voegt deze wél toe (`task.setNull(true)`) om ID-continuïteit te
    // bewaren, maar hij is nooit zichtbaar in de UI of een XML-export, dus hier overgeslagen. Dit
    // verklaart ID-gaten in een rauwe TBkndTask/FixedData-dump.
    if (data.length === NULL_TASK_BLOCK_SIZE) continue;

    if (data.length < uniqueIdOffset + 4) continue;
    const uniqueId = getInt(data, uniqueIdOffset, 'TBkndTask/FixedData uniqueId');
    validIndexByUniqueId.set(uniqueId, index); // latere/hogere index wint
  }

  // Spooktaak-check (MPP14Reader.java): een unique-ID die zowel als verwijderd gemarkeerd staat
  // ALS een normaal record heeft, telt alleen mee als er var-data voor bestaat.
  for (const uid of deletedIds) {
    if (validIndexByUniqueId.has(uid) && !varMeta.containsKey(uid)) {
      validIndexByUniqueId.delete(uid);
    }
  }

  return validIndexByUniqueId;
}

// ── Toewijzingen (TBkndAssn) ─────────────────────────────────────────────────────────────────────

/** TBkndAssn/FixedMeta-itemgrootte (MPP14Reader.java: `new FixedMeta(..., 34)`). */
export const ASSIGNMENT_FIXED_META_ITEM_SIZE = 34;
/** TBkndAssn/FixedData-itemgrootte — GEEN meta-afgeleide offset/grootte, contigue blokken van 110
 *  bytes vanaf offset 0 (MPP14Reader.java: `new FixedData(110, ...)`, de `withoutMeta`-variant). */
export const ASSIGNMENT_FIXED_DATA_ITEM_SIZE = 110;

/** Eén niet-verwijderde toewijzing met var-data: de MPP-uid en het FixedData-record. */
export interface AssignmentRecord {
  uid: number;
  data: Uint8Array;
}

/**
 * De toewijzingsrecords die `readAssignments` leest, in bestandsvolgorde (poort van
 * `ResourceAssignmentFactory.process`): de verwijdermarkering (byte 0 van het meta-item ≠ 0) valt weg,
 * net als een record zonder var-data. `null` als een vereiste stream ontbreekt. De koppeling aan taak en
 * resource doet de aanroeper.
 */
export function selectAssignmentRecords(
  cfb: CfbFile,
  uniqueIdOffset: number,
): { records: AssignmentRecord[]; varMeta: VarMeta12 } | null {
  const label = '"   114"/TBkndAssn';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'VarMeta']);
  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) return null;

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, ASSIGNMENT_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.withoutMeta(ASSIGNMENT_FIXED_DATA_ITEM_SIZE, fixedDataBytes, `${label}/FixedData`);
  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);

  const records: AssignmentRecord[] = [];
  // Geklemd (FixedMeta.getItemCount) — ResourceAssignmentFactory.java gebruikt de RUWE headerwaarde.
  const itemCount = fixedMeta.getItemCount();
  for (let index = 0; index < itemCount; index++) {
    const meta = fixedMeta.getByteArrayValue(index);
    // Verwijderd-vlag: hier een enkele BYTE (`meta[0] !== 0`), NIET de SHORT-check van TBkndCons —
    // spiegelt ResourceAssignmentFactory.java letterlijk (`meta[0] != 0`).
    if (!meta || meta.length < 8 || meta[0] !== 0) continue;

    const offset = getInt(meta, 4, `${label}/FixedMeta offset`);
    const dataIndex = fixedData.getIndexFromOffset(offset);
    if (dataIndex === -1) continue;
    const data = fixedData.getByteArrayValue(dataIndex);
    if (!data || data.length < uniqueIdOffset + 4) continue;

    const uid = getInt(data, uniqueIdOffset, `${label}/FixedData uniqueId`);
    if (!varMeta.containsKey(uid)) continue; // spiegelt `assnVarMeta.getUniqueIdentifierSet().contains(varDataId)`
    records.push({ uid, data });
  }
  return { records, varMeta };
}
