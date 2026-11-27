import { projectForIfcExport } from '@/services/ifc/ifcSchemaQuestion';
import { buildWriteIFCInput, type IFCSaveSource, type IFCWriteInput, type IFCWriteMode } from '@/services/documentData';
import { savedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';

export { buildWriteIFCInput, type IFCSaveSource, type IFCWriteInput, type IFCWriteMode } from '@/services/documentData';

/** De writer-invoer voor een EXPORT naar een nieuw bestand: als `buildWriteIFCInput`, maar zonder een open
 *  schemavraag die niet bij de kop van de export past (`projectForIfcExport`, review #336 punt 4).
 *  Opslaan, AutoSave, crashherstel en de MCP-backup gebruiken `buildWriteIFCInput`. */
export function buildExportIFCInput(src: IFCSaveSource, mode: IFCWriteMode): IFCWriteInput {
  const input = buildWriteIFCInput(src, mode);
  return { ...input, project: projectForIfcExport(input.project) };
}

/** De sleutels van `IFCSaveSource` op WAARDE-niveau. Twee compile-time asserts hieronder koppelen
 *  deze lijst aan het type, zodat hij niet stil kan afdrijven van `buildWriteIFCInput`. */
const IFC_SAVE_KEYS = [
  'project', 'calendar', 'tasks', 'sequences', 'resources', 'assignments',
  'activityCodeTypes', 'customFieldDefs', 'customTaskTypes', 'calendars', 'baselines', 'activeBaselineId', 'comparedBaselineIds',
  'xerImportMetadata', 'xerSourceArchive', 'xerSourceProjectId', 'importPristine',
  'recordedDates', 'datesAsRecorded', 'minuteModelPending', 'ifcGlobalIds', 'ifcLiteralCalendarIds', 'foreignSourceMark',
  'ifcSource', 'ifcxReferences',
] as const;

type MissingSaveKey = Exclude<keyof IFCSaveSource, typeof IFC_SAVE_KEYS[number]>;
type ExtraSaveKey = Exclude<typeof IFC_SAVE_KEYS[number], keyof IFCSaveSource>;
const _assertSaveKeysComplete: MissingSaveKey extends never ? true : ['IFC_SAVE_KEYS mist:', MissingSaveKey] = true;
const _assertSaveKeysNoExtras: ExtraSaveKey extends never ? true : ['IFC_SAVE_KEYS bevat onbekende sleutels:', ExtraSaveKey] = true;
void _assertSaveKeysComplete;
void _assertSaveKeysNoExtras;

/** Een nieuwe bron is opslagmetadata, geen bewerking en geen reden voor een nieuwe herstelsnapshot. */
const IFC_DIRTY_KEYS = IFC_SAVE_KEYS.filter(
  (key): key is Exclude<typeof IFC_SAVE_KEYS[number], 'ifcSource'> => key !== 'ifcSource',
);
type DirtyKey = Exclude<keyof IFCSaveSource, 'ifcSource'>;
type MissingDirtyKey = Exclude<DirtyKey, typeof IFC_DIRTY_KEYS[number]>;
type ExtraDirtyKey = Exclude<typeof IFC_DIRTY_KEYS[number], DirtyKey>;
const _assertDirtyKeysComplete: MissingDirtyKey extends never ? true : ['IFC_DIRTY_KEYS mist:', MissingDirtyKey] = true;
const _assertDirtyKeysNoExtras: ExtraDirtyKey extends never ? true : ['IFC_DIRTY_KEYS bevat onbekende sleutels:', ExtraDirtyKey] = true;
void _assertDirtyKeysComplete;
void _assertDirtyKeysNoExtras;

/** Is de op te slaan documentinhoud nog dezelfde? Referentievergelijking volstaat: Immer geeft
 *  elk gemuteerd inhoudsveld een NIEUWE referentie, dus ongelijkheid = "er is iets gewijzigd".
 *  `ifcSource` telt niet mee; de AutoSave-kandidaat bewaakt haar identiteit afzonderlijk. Gebruikt
 *  door `saveFile`/`saveFileAs` om te bepalen of `isDirty` gewist mag worden ná een opslaan-dialoog
 *  die minuten open kan hebben gestaan (stil `isDirty=false` zetten terwijl de gebruiker intussen
 *  wijzigde, is stil dataverlies), en door AutoSave, het herstel en de MCP-bestandstools.
 *  Eén uitzondering: een andere werksoortcatalogus telt alleen als de door taken gebruikte definities
 *  verschillen (`savedCustomTaskTypes`, dezelfde selectie als de IFC-schrijver). Een ongebruikte
 *  definitie gaat niet mee in het bestand, dus haar stille nieuwe naam (#804 keuze 7) is geen wijziging. */
export function sameIFCSource(a: IFCSaveSource, b: IFCSaveSource): boolean {
  return IFC_DIRTY_KEYS.every((k) => a[k] === b[k]
    || (k === 'customTaskTypes' && a.tasks === b.tasks && sameSavedCustomTaskTypes(a, b)));
}

/** Zoals de schrijver ze vastlegt (`JSON.stringify` van de definities): elk veld telt mee. */
function sameSavedCustomTaskTypes(a: IFCSaveSource, b: IFCSaveSource): boolean {
  return JSON.stringify(savedCustomTaskTypes(a.tasks, a.customTaskTypes))
    === JSON.stringify(savedCustomTaskTypes(b.tasks, b.customTaskTypes));
}
