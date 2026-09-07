import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { DocumentPayload } from './documentContract';

/**
 * De projectdata-velden die in een IFC-save meeschrijven — precies de round-trip-velden van het
 * documentcontract. Zowel de live (top-level) `AppState` als een `DocumentPayload` voldoen
 * structureel aan deze vorm, dus alle callsites (canoniek save-pad, de inmiddels verwijderde MenuBar-quicksave, IFCPanel,
 * auto-save, devBridge) kunnen dezelfde bron doorgeven.
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
> & Partial<Pick<DocumentPayload, 'xerImportMetadata' | 'xerSourceArchive' | 'xerSourceProjectId'>>;

/**
 * Bouw de VOLLEDIGE `writeIFC`-invoer uit de state/payload. Eén plek bepaalt welke velden
 * meeschrijven, zodat losse callsites niet meer stil velden kunnen weglaten (bug-klasse B4/R1:
 * de (inmiddels verwijderde) MenuBar-quicksave liet structuur — activity-codes/custom-fields — én baselines vallen →
 * stil dataverlies bij opslaan via die weg). De enige naamsvertaling: het store-veld `calendars`
 * (de gedeelde kalender-bibliotheek) heet in de writer-invoer `resourceCalendars`.
 */
export function buildWriteIFCInput(src: IFCSaveSource): WriteIFCInput {
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
  };
}

/** De sleutels van `IFCSaveSource` op WAARDE-niveau. Twee compile-time asserts hieronder koppelen
 *  deze lijst aan het type, zodat hij niet stil kan afdrijven van `buildWriteIFCInput`. */
const IFC_SAVE_KEYS = [
  'project', 'calendar', 'tasks', 'sequences', 'resources', 'assignments',
  'activityCodeTypes', 'customFieldDefs', 'customTaskTypes', 'calendars', 'baselines', 'activeBaselineId',
  'xerImportMetadata', 'xerSourceArchive', 'xerSourceProjectId',
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
 *  die minuten open kan hebben gestaan (bevinding K8b: stilletjes `isDirty=false` zetten terwijl de
 *  gebruiker onderhanden wijzigingen deed, was stil dataverlies). */
export function sameIFCSource(a: IFCSaveSource, b: IFCSaveSource): boolean {
  return IFC_SAVE_KEYS.every((k) => a[k] === b[k]);
}
