import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { WithheldTaskTimeField } from '@/services/ifc/ifcTaskSlots';
import type { ReadImportResult, RecordedTimesOrigin } from '@/services/importTypes';
import type { DocumentPayload } from '@/state/documentContract';
import { migrateToMinuteModel } from '@/state/migrations/minuteModel';
import { unrecordedExportFields } from '@/state/recordedDatesSelectors';
import { hasTaskTypeData } from '@/state/taskTypesVisibility';
import { normalizeComparedBaselines } from '@/types/baseline';

export type ImportedDocumentData = Pick<DocumentPayload,
  | 'project' | 'calendar' | 'tasks' | 'sequences' | 'resources' | 'assignments' | 'calendars'
  | 'activityCodeTypes' | 'customFieldDefs' | 'customTaskTypes' | 'baselines' | 'activeBaselineId' | 'comparedBaselineIds'
  | 'xerImportMetadata' | 'xerSourceArchive' | 'xerSourceProjectId' | 'ifcSource' | 'foreignSourceMark' | 'ifcxReferences'
  | 'taskTypesVisible' | 'importPristine' | 'xerArchiveIssue' | 'ifcGlobalIds' | 'ifcLiteralCalendarIds' | 'minuteModelPending'>;

export function documentDataFromImport(parsed: ReadImportResult): ImportedDocumentData {
  const data: ImportedDocumentData = {
    project: parsed.project,
    calendar: parsed.calendar,
    tasks: parsed.tasks,
    sequences: parsed.sequences,
    resources: parsed.resources,
    assignments: parsed.assignments,
    calendars: parsed.resourceCalendars ?? [],
    activityCodeTypes: parsed.activityCodeTypes ?? [],
    customFieldDefs: parsed.customFieldDefs ?? [],
    customTaskTypes: parsed.customTaskTypes ?? [],
    baselines: parsed.baselines ?? [],
    activeBaselineId: parsed.activeBaselineId ?? null,
    comparedBaselineIds: normalizeComparedBaselines(parsed.comparedBaselineIds, parsed.baselines ?? [], parsed.activeBaselineId ?? null),
    xerImportMetadata: parsed.xer ?? null,
    xerSourceArchive: parsed.xerSourceArchive ?? null,
    xerSourceProjectId: parsed.xer?.sourceProjectId ?? parsed.xerSourceProjectId ?? null,
    ifcSource: parsed.ifcSource ?? null,
    ifcxReferences: parsed.ifcxReferences ?? null,
    // Het kenmerk zet `applyLoadedProject` (hij kent het doel) of `payloadFromInput` (herstel).
    foreignSourceMark: null,
    // Het geladen bestand ontsluit de werkregel-UI voor zichzelf.
    taskTypesVisible: hasTaskTypeData(parsed.tasks, parsed.assignments, parsed.project),
    // Een VERSE import (xer/p6xml/mspdi/mpp/csv/ifc-uit-ander-pakket) is
    // per definitie ongewijzigd; een HEROPENING (eigen IFC: 'ifc-own'/'xer-archive') draagt de
    // vlag alleen als het bestand haar zelf zegt (`OPS_ImportProvenance`), anders `false`. Zonder
    // herkomst (extensie-importer) `false`: nooit een gok richting automatisch aan.
    importPristine: parsed.importPristine ?? isFreshImportOrigin(parsed.recordedTimesOrigin),
    xerArchiveIssue: parsed.xerArchiveIssue ?? null,
    ifcGlobalIds: parsed.ifcGlobalIds ?? null,
    ifcLiteralCalendarIds: parsed.ifcLiteralCalendarIds ?? null,
    minuteModelPending: false,
  };
  const migrated = migrateToMinuteModel(data, { timeModel: parsed.timeModel, milestonesAtDayEnd: parsed.milestonesAtDayEnd });
  return { ...migrated.payload, minuteModelPending: migrated.report.conversionPending };
}

/** Zie `ImportResult.recordedTimesOrigin`: verse import (automatisch aan bij afwijkingen) versus
 *  heropening van een eigen IFC (automatisch aan bij `importPristine` of opslaan in de modus). Eén definitie,
 *  gedeeld door `payloadFromImport` en `applyRecordedDatesOnLoad`. */
export function isFreshImportOrigin(origin: RecordedTimesOrigin | undefined): boolean {
  return origin === 'xer' || origin === 'p6xml' || origin === 'mspdi' || origin === 'mpp' || origin === 'csv' || origin === 'ifc';
}

/**
 * De round-trip-velden en de bronidentiteit die een IFC-save nodig heeft. De bronbytes staan
 * nooit in de gewone writer-invoer hieronder. Zowel de live (top-level) `AppState` als een `DocumentPayload` voldoen
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
  | 'comparedBaselineIds'
  // Verplicht (review 2026-09-28): als optioneel veld liet een aanroeper met een eigen veldlijst
  // (het IFC-paneel) het stil weg, en verloren alle bewaarde GlobalIds bij Toepassen.
  | 'ifcGlobalIds'
  // Knownbug 1026: verplicht om dezelfde reden als `ifcGlobalIds`.
  | 'ifcLiteralCalendarIds'
  // De bronidentiteit hoort bij de schrijfkeuze, nooit bij de planningtekst of Worker-invoer.
  | 'ifcSource'
  | 'minuteModelPending'
>
  & Partial<Pick<DocumentPayload,
    | 'xerImportMetadata' | 'xerSourceArchive' | 'xerSourceProjectId' | 'importPristine'
    | 'recordedDates' | 'datesAsRecorded'
    // #804 fase 1a: `buildWriteIFCInput` leest dit veld niet, dus een gewone opslag en een export blijven gelijk aan
    // main. Alleen de herstelsnapshot (`recoverySnapshotInput`) en de MCP-backup (`backupService.ts`, fixronde 3)
    // voegen het kenmerk zelf toe.
    | 'foreignSourceMark' | 'ifcxReferences'>>;

export type IFCWriteMode = 'merge' | 'planOnly';

/** Clonebare routemetadata; de gewone writer leest alleen de bestaande inhoudsvelden. */
export type IFCWriteInput = WriteIFCInput & { readonly writeMode: IFCWriteMode };

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
 * `mode` is verplicht; `writeMode` reist met spread/structuredClone mee tot de schrijver.
 * PR 11 gebruikt die keuze voor de doelbewaking; deze builder verandert de uitvoer niet.
 */
export function buildWriteIFCInput(src: IFCSaveSource, mode: IFCWriteMode): IFCWriteInput {
  const withheld = withheldFieldsFor(src);
  return {
    writeMode: mode,
    project: src.project,
    minuteModelPending: src.minuteModelPending,
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
    comparedBaselineIds: src.comparedBaselineIds,
    xer: src.xerImportMetadata ?? undefined,
    xerSourceArchive: src.xerSourceArchive ?? undefined,
    xerSourceProjectId: src.xerSourceProjectId ?? undefined,
    // Alleen `true` wordt geschreven (`writeImportProvenanceMeta`).
    ...(src.importPristine ? { importPristine: true } : {}),
    ...(withheld ? { withheldTaskTimeFields: withheld } : {}),
    // Bestaande objecten houden hun GlobalId uit het ingelezen bestand.
    ...(src.ifcGlobalIds ? { ifcGlobalIds: src.ifcGlobalIds } : {}),
    // Kalenders die letterlijk waren bij het openen, blijven letterlijk (knownbug 1026).
    ...(src.ifcLiteralCalendarIds?.length ? { ifcLiteralCalendarIds: src.ifcLiteralCalendarIds } : {}),
    // De oorspronkelijke bron reist mee in OPS_ImportProvenance, zodat een heropening op de BRON
    // poort en niet op "het is nu een IFC". ALLEEN in de modus: buiten de modus staat
    // onze eigen solve in het bestand; een bron noemen zou bij heropenen onze oude solve met de
    // nieuwe laten vergelijken en dat bv. "MS Project-datums" noemen.
    ...(src.datesAsRecorded && src.recordedDates?.sourceFormat
      ? { recordedSourceFormat: src.recordedDates.sourceFormat } : {}),
  };
}
