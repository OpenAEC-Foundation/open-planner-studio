/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * T7-entiteiten: relaties (TBkndCons), resources (TBkndRsc) en assignments (TBkndAssn) — de
 * "aanvullende" data bovenop de taken/hiërarchie uit `mppReader.ts` (T5) en de kalenders uit
 * `mppCalendars.ts` (T6). Verhuisd uit `mppReader.ts` in T11 (eindronde, T7-kwaliteitsreview-
 * agenda, stap 0-bis): gemeten NUL terugafhankelijkheden op de taaklaag — deze drie functies lezen
 * uitsluitend CFB-storages, field maps en (voor `readResources`) het al-gebouwde `CalendarReadResult`
 * van T6, en worden pas ná `readTasks` in `readMPP`'s orkestratie samengevoegd. Eén gedeeld bestand
 * (i.p.v. drie losse `mppResources.ts`/`mppAssignments.ts`/`mppRelations.ts`) omdat ze in het
 * originele bestand al onder één T7-banner stonden, dezelfde ALTIJD-vangende-wrapper-conventie delen
 * (`readXUnsafe` + dunne `readX`-try/catch, spiegelt `readCalendars`'s I1-les) en elkaars buren
 * blijven in `readMPP`; drie bestanden voor ~450 regels nauw verwante, gelijkvormige code had de
 * splitsing eerder vergroot dan verduidelijkt. `readRelations` hangt alleen af van de eigen
 * `mppLagToSequenceFields`-duurhelper (hieronder, puur intern) — geen aparte module nodig daarvoor.
 *
 * Pure verhuizing, geen gedragswijziging: alle bestaande baselines (taak-/kalender-/relatie-/
 * resource-/assignment-aantallen, per-veld-budgetten) blijven exact gelijk. Zie `mppReader.ts`'s
 * eigen moduleheader voor de bredere T5-T7-context (hiërarchie, WBS, outline-level-klem, enz.).
 *
 * Z3 (etappe "nul afwijkingen"): `readAssignmentTimephasedRaw` (onderaan) opent `Var2Data` van
 * `TBkndAssn` voor de vier timephased-categorieën uit `mppTimephased.ts` — een BEWUST TWEEDE lus
 * naast `readAssignments`, zie haar eigen sectiekop voor de volledige motivering (readAssignments'
 * return-vorm mag niet wijzigen, dat zou `check-mpp-relations.ts` breken, buiten deze taak se
 * bestandseigendom).
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
// T7 — relaties (TBkndCons), resources (TBkndRsc) en assignments (TBkndAssn).
//
// LET OP DE NAAMSVERWARRING uit het plan: "constraints" is in MPP-bestandsjargon TBkndCons =
// de RELATIE-/link-data (`ConstraintFactory.java`) — taak-DATUMconstraints kwamen al uit het
// taak-fieldmap in T5 (`TaskFieldId.ConstraintType`/`ConstraintDate`). Poort-bronnen:
// `ConstraintFactory.java` (relaties), `MPP14Reader.java`'s `createResourceMap`/
// `processResourceData` (resources) en `ResourceAssignmentFactory.java` (assignments).
//
// Alle drie functies volgen `readCalendars`'s I1-les (T6-kwaliteitsreview): een dunne, ALTIJD-
// vangende wrapper rond de eigenlijke `*Unsafe`-implementatie — een kapotte/afwezige backend-
// storage voor relaties/resources/assignments mag `readMPP` niet laten falen, taken en kalenders
// zijn dan al gelezen en blijven bruikbaar. Anders dan calendars is de terugval hier een lege
// array (geen "generieke default"-equivalent nodig — een lege relatie-/resource-/assignmentlijst
// is een geldig, leeg `ImportResult`-onderdeel, spiegelt `readCSV` voor formaten zonder die data).
//
// BEWUSTE ASYMMETRIE (T7-kwaliteitsreview, M5) t.o.v. T5's `readTasks`: die gooit HARD zodra de
// taak-veldmap UNIQUE_ID/ID/NAME/SCHEDULED_START/SCHEDULED_FINISH mist (taken zonder naam/datum
// zijn geen leesbaar bestand maar een mis-parse), terwijl `readResourcesUnsafe`/
// `readAssignmentsUnsafe` hierboven bij een onvolledige veldmap stil een LEGE lijst teruggeven i.p.v.
// te gooien. Geen inconsistentie: taken zijn de RUGGENGRAAT van het document (zonder taken is er
// niets zinvols te tonen), relaties/resources/assignments zijn AANVULLEND — een deelresultaat (taken
// + kalenders, zonder relaties/resources) is voor de gebruiker bruikbaarder dan de hele import te
// laten falen op een veld dat deze etappe toevallig niet kent.
//
// TWEE VERDERE, ongenoemde MPXJ-afwijkingen (T7-spec-review, B6) — bewust, gedocumenteerd, en
// GEMETEN als 0-voorkomens over het volledige beschikbare materiaal (drie ground-truth-bestanden +
// 49-bestand-crawl, 52 bestanden/650 assignments samen, T7-spec-review-meting 2026-08-14):
//  (a) `ResourceAssignmentFactory.java` vult een TE KORT assignment-FixedData-record aan met
//      nullbytes tot `fieldMap.getMaxFixedDataSize(0)` vóórdat het de velden leest (`if (data.length
//      < fieldMap.getMaxFixedDataSize(0)) { newData = new byte[maxSize]; arraycopy(data, newData); }
//      data = newData;`). `readAssignmentsUnsafe` doet dat niet — elk per-veld-`data.length`-check
//      hierboven (bv. `data.length >= unitsOffset + 8`) slaat een veld gewoon over/default'', i.p.v.
//      het transparant als nullen te lezen. Op elk bestand in dit corpus+crawl is `TBkndAssn/
//      FixedData` se lengte een EXACT veelvoud van 110 bytes (`FixedData.withoutMeta`'s itemSize),
//      dus deze situatie doet zich hier nooit voor — een toekomstig bestand met een afgekapte
//      laatste record zou wél verschillend gedrag kunnen zien (deze lezer laat 'm dan gewoon
//      onvolledig/overgeslagen, i.p.v. de MPXJ-nulvulling).
//  (b) `ResourceAssignmentFactory.java` dedupliceert: `if (task.getExistingResourceAssignment
//      (resource) != null) continue;` — een taak+resource-paar dat MEERDERE malen in TBkndAssn
//      voorkomt, levert bij MPXJ maar ÉÉN `ResourceAssignment`. `readAssignmentsUnsafe` dedupliceert
//      niet — elk geldig record wordt een eigen `ResourceAssignment`, ook bij een herhaald paar.
//      Over alle 52 beschikbare bestanden komt geen enkel taak+resource-paar dubbel voor (gemeten:
//      0 van 650), dus dit verschil is hier onobserveerbaar — een bestand waarin een gebruiker
//      dezelfde resource tweemaal aan dezelfde taak toewijst (bv. via een editor-bug of handmatige
//      TBkndAssn-manipulatie) zou hier WEL twee assignments opleveren i.p.v. MPXJ's ene.
//
// DUPLICAAT-OFFSET-AMPLIFICATIE (T7-kwaliteitsreview, M8): net als T5's I1 voor Var2Data al
// vaststelde, kost een gedeelde/dubbele offset hier hoogstens INPUT-LINEAIRE tijd — elke duplicaat-
// verwijzing (VarMeta se dedup bij resourcenamen, of TBkndCons/TBkndAssn se `FixedData.
// getIndexFromOffset`) triggert precies één O(1)-lookup (mppPrimitives.ts se I2-hardening), geen
// amplificatie — dus bewust GEEN aparte klem hier, binnen hetzelfde precedent als T5.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** TBkndCons/FixedMeta-itemgrootte (ConstraintFactory.java: `new FixedMeta(..., 10)`). */
const CONS_FIXED_META_ITEM_SIZE = 10;
/** TBkndCons/FixedData-itemgrootte — ALTIJD 20, ongeacht wat de meta zelf rapporteert
 *  (ConstraintFactory.java: `new FixedData(consFixedMeta, 20, ...)`, de `withItemSizeOverride`-
 *  variant van `FixedData`, zie mppPrimitives.ts se moduleheader "meta's itemSize is fout"). */
const CONS_FIXED_DATA_ITEM_SIZE = 20;

/**
 * Ruwe TBkndCons-lag (tienden-van-minuut, MPPUtility.getDuration se javadoc: "value is given in
 * 1/10 of minute" — ONGEACHT welke eenheidscode `unitCode` claimt) + eenheidscode →
 * `Sequence`-lagvelden. Spiegelt mspdiReader's lag-afhandeling (spiegelplicht, T7-taaktekst) maar
 * vanuit MPP se eigen eenheidscodering (`getDurationTimeUnits`, mppPrimitives.ts):
 *  - percent/elapsedPercent: /10 — T7-spec-review (B2), BESLUIT: `mspdiReader.ts` behandelt
 *    `LinkLag` bij LagFormat 19/20 als TIENDEN VAN EEN PROCENT (`seq.lagPercent = link.lag / 10`,
 *    zie de `ELAPSED_DURATION_FORMATS`-sectie daar en `mspdiWriter.ts`'s spiegelbeeldige
 *    `Math.round(seq.lagPercent * 10)` — een round-trip-consistent, project-eigen domeinconventie).
 *    MPXJ se eigen `ConstraintFactory`/`MPPUtility.getDuration` laat de MPP-ruwe waarde voor
 *    percent-eenheden ONGESCHAALD (geen /10) — maar MPXJ se `MSPDIReader.java` doet dat ZELF óók
 *    (`Duration.getInstance(lag, lagUnits)` zonder /10 voor `TimeUnit.PERCENT`); dat is dus geen
 *    signaal dat de MPP- en MSPDI-schaal VERSCHILLEN, alleen dat MPXJ se eigen `Duration`-model de
 *    schaal niet normaliseert. Om beide OPS-lezers dezelfde domeinsemantiek (HELE procenten in
 *    `Sequence.lagPercent`) te laten leveren, past deze functie dezelfde /10 toe als mspdiReader.ts
 *    — vóór deze fix gaf een percent-lag hier 100× de waarde die mspdiReader voor eenzelfde
 *    LinkLag-getal zou leveren (T7-spec-review, B2).
 *  - elke andere "elapsed"-variant (minuten/uren/dagen/weken/maanden delen allemaal dezelfde ruwe
 *    tienden-van-minuut-basis): kalenderdag-omrekening via `getDuration(rawLag, 'elapsedDays')`
 *    (mppPrimitives.ts — T7-kwaliteitsreview M1: hergebruikt i.p.v. een losse `rawLag/10/60/24`-
 *    inline-formule; `getDuration`'s `elapsedDays`-tak deelt door 14400 = 24*60*10, wiskundig
 *    identiek), afgerond op hele dagen — identiek aan mspdiReader's ELAPSED_DURATION_FORMATS-tak.
 *  - elke WORKTIME-variant (niet-elapsed): dezelfde omrekening als taakduur
 *    (`tenthsOfMinutesToDays`, gedeeld met mspdiReader.ts — T7-kwaliteitsreview M2, zie
 *    `@/services/importDurations`) — spiegelt mspdiReader's "anders"-tak, TENZIJ de OPVOLGER
 *    (etappe 1.5) in uur-modus zit: dan wint `lagMinutes` (minuut-precies, `Math.round(rawLag/10)`,
 *    geen dag-afronding) — exact mspdiReader's `taskHourById.get(link.successorId)`-tak.
 *    `isHourSuccessor` hieronder is die vertaling.
 *
 * ⚠️ Dekkingsvoorbehoud (T7-spec-review, B1): het corpus (§Corpus & referentiemateriaal) draagt
 * uitsluitend FINISH_START-relaties met lag=0 — de type-tabel (`mspTypeToSequenceType`) en alle
 * lag-takken hierboven (WORKTIME met een echte dagenwaarde, ELAPSED, percent/elapsedPercent) worden
 * dus UITSLUITEND door de synthetische fixtures in `check-mpp-relations.ts` gedekt, niet door het
 * corpus. Zie de moduleheader daar voor de volledige toelichting.
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
  if (unit.startsWith('elapsed')) {
    return { lagDays: Math.round(getDuration(rawLag, 'elapsedDays')), lagUnit: 'ELAPSEDTIME' };
  }
  // Etappe 1.5 (spiegelt mspdiReader's `taskHourById.get(link.successorId)`-tak): een uur-modus-
  // opvolger krijgt de lag minuut-precies i.p.v. dag-afgerond — `rawLag` is al tienden van een
  // minuut, dus `/10` volstaat (geen `tenthsOfMinutesToDays`-omrekening).
  if (isHourSuccessor) return { lagDays: 0, lagMinutes: Math.round(rawLag / 10) };
  return { lagDays: tenthsOfMinutesToDays(rawLag, hoursPerDay) };
}

/** Poort van `ConstraintFactory.process` (T7, stap 1) — `"   114"/TBkndCons` → `Sequence[]`.
 *  Geëxporteerd (spiegelt `readCalendars`'s testbaarheidspatroon, T6) zodat
 *  `check-mpp-relations.ts` 'm los kan aanroepen zonder de volledige `readMPP` te hoeven draaien.
 *  `taskHourById` (etappe 1.5, OPTIONEEL — default een lege map, dus elke bestaande aanroep zonder
 *  dit argument blijft ongewijzigd DAG-modus-gedrag geven): per opvolger-`Task.id` of die in
 *  uur-modus zit, spiegelt mspdiReader's `taskHourById`-gebruik voor de lag-eenheid-keuze. */
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

  // project15 (ConstraintFactory.java): mppFileType===14 (altijd waar — assertReadable/T4 laat
  // alleen MPP14 door) && applicationVersion > PROJECT_2010(14) — dezelfde "modern"-drempel als
  // elders (mppCalendars.ts se useModernOffsets, milestoneBitFlag hierboven).
  const project15 = (applicationVersion ?? 0) > 14;
  const durationOffset = project15 ? 14 : 16;
  const durationUnitsOffset = project15 ? 18 : 14;

  const sequences: Sequence[] = [];
  // GEKLEMD (mppPrimitives.ts se FixedMeta-I1) — ConstraintFactory.java gebruikt hier de RUWE
  // headerwaarde als lusbovengrens (plan-waarschuwing); onze klem is al veilig, dus geen aparte
  // klem nodig op dit niveau.
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

    // Relatie naar een niet-bestaande/gefilterde taak overslaan — spiegelt MPXJ se
    // `task1 != null && task2 != null`-guard (getTaskByUniqueID geeft null voor een taak die T5's
    // `collectValidTaskIndices` al wegfilterde, bv. een null-/spooktaak).
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
 * T7-spec-review (B7, CORRECTIE): een eerdere versie van dit bestand beweerde dat het WORK/niet-
 * WORK-onderscheid hierboven het enige geporte resourcetype-signaal was, en dat MPXJ het COST-vs-
 * MATERIAL-onderscheid via "een bit in Fixed2Data" trekt — BEIDE beweringen waren fout. MPXJ leest
 * de COST-bit uit **Fixed2META**, niet Fixed2Data (`MPP14Reader.java`: `byte[] metaData2 =
 * rscFixed2Meta.getByteArrayValue(offset); ... if ((metaData2[8] & 0x10) != 0)
 * resource.setType(COST); else resource.setType(MATERIAL);`), en die stream is WEL aanwezig in
 * alle drie ground-truth-bestanden (679/526/424 bytes) — "buiten scope" was dus geen juiste
 * motivering. Alsnog geport:
 *  - `Fixed2Meta` wordt met dezelfde heuristische constructor gelezen als MPXJ gebruikt
 *    (`FixedMeta.withHeuristicItemSize`, kandidaten 50/51 tegen `rscFixedData`'s itemcount als
 *    ankerpunt — al geport in T4/`mppPrimitives.ts`, hier voor het eerst daadwerkelijk gebruikt).
 *  - Defensief: de stream kan legitiem ontbreken (oudere/kleinere bestanden) — dan blijft het
 *    gedrag exact zoals vóór deze fix (niet-WORK ⇒ MATERIAL).
 *  - **Cost → LABOR** (niet MATERIAL): spiegelt mspdiReader.ts se eigen collapse (r. 180:
 *    `type: type === 0 ? 'MATERIAL' : 'LABOR'` — UITSLUITEND MSP-Type 0 is MATERIAL, alles anders
 *    (Work ÉN Cost) is LABOR). `ResourceType` in dit project heeft sowieso geen `'COST'`-waarde
 *    (`src/types/resource.ts`); MATERIAL zou een Cost-resource dus fout hebben ingedeeld.
 *
 * Gemeten uitkomst per corpusbestand (T7-spec-review, B5) staat in `check-mpp-relations.ts` se
 * corpussectie, mét het versieverschil-voorbehoud dat ook de rest van de T5/T7-vergelijkingen kent.
 */
function isFixed2MetaCostBit(fixed2Meta: FixedMeta | null, index: number): boolean {
  const item = fixed2Meta?.getByteArrayValue(index) ?? null;
  return !!item && item.length > 8 && (item[8] & 0x10) !== 0;
}

export interface ReadResourcesResult {
  resources: Resource[];
  resourceIdByUniqueId: Map<number, string>;
}

/** T7-kwaliteitsreview (I1, BLOKKEREND): een module-singleton hier (`const EMPTY = {...}`,
 *  teruggegeven bij elke lege/foute lezing) zou ÉÉN gedeelde array-/Map-instantie over ALLE
 *  aanroepen zijn — die instantie gaat de Zustand-store in (multi-document: elk open document kan
 *  z'n eigen `ImportResult` binnenhalen) en Immer's autoFreeze bevriest 'm bij de eerste mutatie-
 *  poging MODULE-BREED, dus een latere, ANDERE lege lezing zou tegen een bevroren object aanlopen.
 *  Spiegelt daarom `mppCalendars.ts`'s `fallbackResult()`-patroon: een FACTORY die bij elke aanroep
 *  een verse `{ resources: [], resourceIdByUniqueId: new Map() }` teruggeeft. */
function emptyResourcesResult(): ReadResourcesResult {
  return { resources: [], resourceIdByUniqueId: new Map() };
}

/** Poort van `MPP14Reader.processResourceData`/`createResourceMap` (T7, stap 2) — `"   114"/
 *  TBkndRsc` → `Resource[]`. Geëxporteerd, zelfde testbaarheidsreden als `readRelations`
 *  hierboven. `labels` (T7-spec-review, B3): zie `readResourcesUnsafe`'s UID-0-toelichting. */
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

  // B7: Fixed2Meta is OPTIONEEL op storage-niveau (defensief — zie `isFixed2MetaCostBit`'s
  // toelichting); ontbreekt/onleesbaar ⇒ `fixed2Meta` blijft `null` en elke resource valt terug op
  // het WORK-bit-only-gedrag van vóór deze fix.
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

  // Poort van `createResourceMap` (MPP14Reader.java r. 935-958): uniqueID→FixedData-index, gebouwd
  // via een SHORT-read op `uniqueIdOffset` — een letterlijke MPXJ-eigenaardigheid (het veld is een
  // 4-byte INT volgens de field map, maar `createResourceMap` leest 'm toch als SHORT). Puur een
  // interne join-sleutel; de ECHTE unique-ID komt uit `varMeta.getUniqueIdentifierArray()`
  // hieronder. Op elk realistisch bestand (resourceaantallen ruim < 65536, plan-corpus: 5-9) is de
  // truncatie een no-op — T7 spiegelt de Java-bron hier bewust letterlijk i.p.v. 'm te "corrigeren"
  // naar een INT-read.
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
  // Iterate op VarMeta se echte unique-ID's (spiegelt `rscVarMeta.getUniqueIdentifierArray()`) —
  // uniqueID 0 is een GELDIGE resource-id (plan-waarschuwing, geverifieerd via mppCalendars.ts's
  // T6-spec-review-fix-toelichting: 870d339f60603f71 se afgeleide kalenders dragen resource-ID's t/m 0),
  // dus GEEN uid===0-skip zoals bij taken (waar 0 de projectsamenvattingstaak is).
  for (const uniqueId of varMeta.getUniqueIdentifierArray()) {
    const index = indexByShortUid.get(uniqueId);
    if (index === undefined) continue;
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;

    // T7-spec-review (B3, BESLUIT): uniqueID 0 is MPP's ingebouwde "niet-toegewezen"-plaatshouder —
    // MPXJ zelf SLAAT dit record OVER (`createResourceMap`'s `data.length < maxFixedDataSize`-
    // guard, niet geport — zie de taakvariant se toelichting bij `collectValidTaskIndices`), dus
    // MPXJ's eigen resourcetelling voor dit corpus zou 8/6/4 zijn, NIET 9/7/5. MS Project schrijft
    // datzelfde record echter WÉL naar zijn eigen MSPDI-export (als "Niet toegekend", maxUnits 1) —
    // deze lezer kiest bewust voor COUNT-PARITEIT MET readMSPDI (9/7/5) i.p.v. MPXJ-pariteit: het
    // record blijft dus gematerialiseerd, maar met een VASTE, betekenisvolle vorm in plaats van de
    // velden van een placeholder-FixedData-record te vertrouwen (die record is typisch te kort/leeg
    // om een geldige naam/MAX_UNITS/type uit te lezen — vandaar hieronder de VASTE vorm i.p.v. de
    // normale per-veld-afleiding). `isUnassignedPlaceholder` overschrijft UITSLUITEND naam/type/
    // maxUnits — calendarId-koppeling (verderop) blijft de normale afleiding volgen: T6 heeft al
    // vastgesteld dat resource-uniqueID 0 een geldig kalender-koppelpunt kan zijn (870d339f60603f71's
    // afgeleide kalenders dragen resource-ID's t/m 0), dat blijft ongewijzigd. Zie
    // `check-mpp-relations.ts`'s moduleheader voor deze bewuste MPXJ-divergentie (9/7/5 vs. 8/6/4).
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
      // B7: niet-WORK ⇒ Fixed2Meta se COST-bit beslist tussen LABOR (Cost, spiegelt mspdiReader se
      // collapse) en MATERIAL — zie `isFixed2MetaCostBit`'s toelichting hierboven.
      type = isWork || isFixed2MetaCostBit(fixed2Meta, index) ? 'LABOR' : 'MATERIAL';
    }

    // MAX_UNITS (DataType.UNITS, FieldMap.java): 8-byte double. FieldMap.java's eigen `/100`
    // ("ignore the amount if result will be less than 0.1%") levert MPXJ's PERCENT-schaal op
    // (100.0 = voltijds) — dít project rekent in de FRACTIE-schaal die mspdiReader ook gebruikt
    // (`Resource.maxUnits`'s docblok: "1 = 100%"), dus daar bovenop nóg een `/100`. Corpus-
    // geverifieerd tegen de MSPDI-ground-truth (T7): zonder de tweede `/100` gaf elke resource
    // 100× de verwachte waarde (bv. "Tom" 200 i.p.v. 2, "malic" 150 i.p.v. 1.5) — dezelfde
    // afleiding als ASSIGNMENT_UNITS hieronder.
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

/** Poort van `ResourceAssignmentFactory.process` (T7, stap 2) — `"   114"/TBkndAssn` →
 *  `ResourceAssignment[]`, met mspdiReader se `unitsPerDay`-afleiding. Geëxporteerd, zelfde
 *  testbaarheidsreden als `readRelations` hierboven. */
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
  // GEKLEMD (mppPrimitives.ts se FixedMeta-I1) — ResourceAssignmentFactory.java gebruikt hier
  // `assnFixedMeta.getItemCount()` (de RUWE headerwaarde) als lusbovengrens; onze klem is al veilig.
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

    // ASSIGNMENT_UNITS (DataType.UNITS, FieldMap.java): 8-byte double. Zelfde dubbele `/100` als
    // `readResourcesUnsafe`'s MAX_UNITS hierboven — MPXJ's eigen `/100` levert de PERCENT-schaal op
    // (100.0 = voltijds), dit project rekent in de FRACTIE-schaal (`ResourceAssignment.unitsPerDay`'s
    // docblok: "1 = 100%", spiegelt mspdiReader's `<Units>`-lezing). Corpus-geverifieerd: zonder de
    // tweede `/100` gaf elke assignment 100 i.p.v. 1.
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
// Z3 (etappe "nul afwijkingen") — timephased-plumbing: opent `Var2Data` van `TBkndAssn` en geeft
// de vier ruwe categoriebyteblokken (zie `mppTimephased.ts`'s `AssignmentTimephasedRaw`) door,
// GEKEYD OP DE RUWE MPP-ASSIGNMENT-UNIQUEID — nadrukkelijk NIET op `ResourceAssignment.id`.
//
// BEWUST EEN TWEEDE, ONAFHANKELIJKE LUS (spiegelt Z1's `mppGroundTruth.ts`-precedent, dezelfde
// motivering): `readAssignments`/`readAssignmentsUnsafe` hierboven is TEST-ONLY geëxporteerd en
// wordt in `tests/planning/check-mpp-relations.ts` (buiten Z3's bestandseigendom, zie de
// taakspecificatie) rechtstreeks aangeroepen met de aanname dat ze een kale `ResourceAssignment[]`
// teruggeeft — die return-vorm wijzigen (bv. naar `{ assignments, timephasedByAssignmentId }`) zou
// die tests laten falen op een bestand dat deze taak niet mag aanraken. Deze functie duplicaat
// daarom bewust een KLEIN deel van het TBkndAssn-openpad (alleen VarMeta/Var2Data — geen
// FixedMeta/FixedData nodig, want Var2Data is zelf al op uniqueId geïndexeerd via VarMeta12's
// eigen tabel) i.p.v. readAssignments's contract aan te raken. Consequentie van "geen FixedMeta/
// FixedData": de "verwijderd"-vlag (FixedMeta byte 0) wordt HIER niet getoetst — een verwijderde
// toewijzing die toevallig nog var-data draagt, komt hier wél door terwijl readAssignments haar al
// weglaat. Onschadelijk voor Z3 (puur-lezen, niets consumeert dit resultaat nog — zie
// mppTimephased.ts's moduleheader), maar gedocumenteerd zodat Z4 (die dit WEL aan taken koppelt)
// het weet.
//
// AANSLUITPUNT VOOR Z4: deze functie levert GEEN correlatie met `ResourceAssignment.id` (dat
// gegenereerde ID bestaat pas ná `readAssignments`, en de twee lussen delen geen state). Z4 —
// die zowel `mppTimephased.ts` als `mppReader.ts` in haar bestandenlijst heeft — moet zelf de
// brug slaan tussen deze rauwe-uniqueId-sleutel en de taak/toewijzing die de motor kent (bv. door
// `readAssignmentsUnsafe`'s eigen taskUid/resourceUid-resolutie te hergebruiken op dezelfde
// FixedData-doorloop, of door `readAssignments`'s contract op dát moment alsnog uit te breiden).
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Poort van `ResourceAssignmentFactory.process`'s eerste stappen (T7, stap 2 hierboven) — hier
 *  UITSLUITEND de vier VAR_DATA-lookups die de timephased-categorieën nodig hebben. Geëxporteerd,
 *  zelfde testbaarheidsreden als `readAssignments` hierboven. */
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
