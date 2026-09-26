import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { WithheldTaskTimeField } from '@/services/ifc/ifcTaskSlots';
import type { DocumentPayload } from './documentContract';
import { unrecordedExportFields } from './recordedDatesSelectors';

/**
 * De projectdata-velden die in een IFC-save meeschrijven — precies de round-trip-velden van het
 * documentcontract. Zowel de live (top-level) `AppState` als een `DocumentPayload` voldoen
 * structureel aan deze vorm, dus alle callsites (canoniek save-pad, IFCPanel, auto-save, devBridge)
 * kunnen dezelfde bron doorgeven.
 */
export type IFCSaveSource = Pick<
  DocumentPayload,
  | 'project'
  | 'calendar'
  | 'tasks'
  | 'sequences'
  | 'resources'
  | 'assignments'
  | 'activityCodeTypes'
  | 'customFieldDefs'
  | 'customTaskTypes'
  | 'calendars'
  | 'baselines'
  | 'activeBaselineId'
>
  & Partial<Pick<DocumentPayload,
    | 'xerImportMetadata' | 'xerSourceArchive' | 'xerSourceProjectId' | 'importPristine'
    | 'recordedDates' | 'datesAsRecorded'>>;

/**
 * "Datums zoals opgeslagen": in de modus draagt `task.time` op de
 * assen die het bronbestand NIET vastlegde een weergave-terugval (`applyRecordedTimesToTasks`:
 * `lateStart ?? start`, `totalFloat ?? 0`, `isCritical ?? false`). Schreef de writer die terugvallen
 * als gewone waarden weg, dan las een heropening ze als vastlegging — "speling 0, niet kritiek, zoals
 * opgeslagen" over iets wat MS Project/P6/CSV nooit zei. Hier per taak de assen die de
 * writer als `$` moet schrijven; dezelfde definitie als de CSV-/MCP-uitgang (`unrecordedExportFields`).
 * Buiten de modus staat er onze eigen, echte berekening: dan niets achterhouden.
 *
 * Een taak ZONDER vastlegging (niet in het bronbestand, of een samenvatting die in de modus uit haar
 * kinderen oprolt) draagt in de modus de datums van een solve die de modus juist verwierp; een
 * heropening als eigen IFC mét bron zou die als vastlegging lezen. Voor zo'n taak dus álle zeven
 * rekenslots `$`, de vroege datums inbegrepen. ScheduleStart/-Finish (invoer) blijven staan.
 */
const ALL_COMPUTED_SLOTS: readonly WithheldTaskTimeField[] = [
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'freeFloat', 'isCritical',
];
function withheldFieldsFor(src: IFCSaveSource): WriteIFCInput['withheldTaskTimeFields'] {
  const recorded = src.recordedDates;
  if (!src.datesAsRecorded || !recorded) return undefined;
  const out: Record<string, readonly WithheldTaskTimeField[]> = {};
  for (const task of src.tasks) {
    const rec = recorded.times[task.id];
    const fields = rec ? unrecordedExportFields(rec) : ALL_COMPUTED_SLOTS;
    if (fields.length > 0) out[task.id] = fields;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Bouw de VOLLEDIGE `writeIFC`-invoer uit de state/payload. Eén plek bepaalt welke velden
 * meeschrijven, zodat losse callsites niet stil velden kunnen weglaten (stil dataverlies bij
 * opslaan). De enige naamsvertaling: het store-veld `calendars`
 * (de gedeelde kalender-bibliotheek) heet in de writer-invoer `resourceCalendars`.
 */
export function buildWriteIFCInput(src: IFCSaveSource): WriteIFCInput {
  const withheld = withheldFieldsFor(src);
  return {
    project: src.project,
    calendar: src.calendar,
    tasks: src.tasks,
    sequences: src.sequences,
    resources: src.resources,
    assignments: src.assignments,
    activityCodeTypes: src.activityCodeTypes,
    customFieldDefs: src.customFieldDefs,
    customTaskTypes: src.customTaskTypes,
    resourceCalendars: src.calendars,
    baselines: src.baselines,
    activeBaselineId: src.activeBaselineId,
    xer: src.xerImportMetadata ?? undefined,
    xerSourceArchive: src.xerSourceArchive ?? undefined,
    xerSourceProjectId: src.xerSourceProjectId ?? undefined,
    // Alleen `true` wordt geschreven (`writeImportProvenanceMeta`).
    ...(src.importPristine ? { importPristine: true } : {}),
    ...(withheld ? { withheldTaskTimeFields: withheld } : {}),
    // De oorspronkelijke bron reist mee in OPS_ImportProvenance, zodat een heropening op de BRON
    // poort en niet op "het is nu een IFC". ALLEEN in de modus: buiten de modus (aanbodstand) staat
    // onze eigen solve in het bestand; een bron noemen zou bij heropenen onze oude solve met de
    // nieuwe laten vergelijken en dat bv. "MS Project-datums" noemen.
    ...(src.datesAsRecorded && src.recordedDates?.sourceFormat
      ? { recordedSourceFormat: src.recordedDates.sourceFormat } : {}),
  };
}

/** De sleutels van `IFCSaveSource` op WAARDE-niveau. Twee compile-time asserts hieronder koppelen
 *  deze lijst aan het type, zodat hij niet stil kan afdrijven van `buildWriteIFCInput`. */
const IFC_SAVE_KEYS = [
  'project', 'calendar', 'tasks', 'sequences', 'resources', 'assignments',
  'activityCodeTypes', 'customFieldDefs', 'customTaskTypes', 'calendars', 'baselines', 'activeBaselineId',
  'xerImportMetadata', 'xerSourceArchive', 'xerSourceProjectId', 'importPristine',
  'recordedDates', 'datesAsRecorded',
] as const;

type MissingSaveKey = Exclude<keyof IFCSaveSource, typeof IFC_SAVE_KEYS[number]>;
type ExtraSaveKey = Exclude<typeof IFC_SAVE_KEYS[number], keyof IFCSaveSource>;
const _assertSaveKeysComplete: MissingSaveKey extends never ? true : ['IFC_SAVE_KEYS mist:', MissingSaveKey] = true;
const _assertSaveKeysNoExtras: ExtraSaveKey extends never ? true : ['IFC_SAVE_KEYS bevat onbekende sleutels:', ExtraSaveKey] = true;
void _assertSaveKeysComplete;
void _assertSaveKeysNoExtras;

/** Is de op te slaan documentinhoud nog dezelfde? Referentievergelijking volstaat: Immer geeft
 *  elk gemuteerd veld een NIEUWE referentie, dus ongelijkheid = "er is iets gewijzigd". Gebruikt
 *  door `saveFile`/`saveFileAs` om te bepalen of `isDirty` gewist mag worden ná een opslaan-dialoog
 *  die minuten open kan hebben gestaan (stil `isDirty=false` zetten terwijl de gebruiker intussen
 *  wijzigde, is stil dataverlies). */
export function sameIFCSource(a: IFCSaveSource, b: IFCSaveSource): boolean {
  return IFC_SAVE_KEYS.every((k) => a[k] === b[k]);
}
