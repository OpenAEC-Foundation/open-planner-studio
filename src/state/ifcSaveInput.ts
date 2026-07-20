import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { DocumentPayload } from './documentContract';

/**
 * De projectdata-velden die in een IFC-save meeschrijven — precies de round-trip-velden van het
 * documentcontract. Zowel de live (top-level) `AppState` als een `DocumentPayload` voldoen
 * structureel aan deze vorm, dus alle callsites (canoniek save-pad, MenuBar-quicksave, IFCPanel,
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
  | 'calendars'
  | 'baselines'
  | 'activeBaselineId'
>;

/**
 * Bouw de VOLLEDIGE `writeIFC`-invoer uit de state/payload. Eén plek bepaalt welke velden
 * meeschrijven, zodat losse callsites niet meer stil velden kunnen weglaten (bug-klasse B4/R1:
 * de MenuBar-quicksave liet structuur — activity-codes/custom-fields — én baselines vallen →
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
    resourceCalendars: src.calendars,
    baselines: src.baselines,
    activeBaselineId: src.activeBaselineId,
  };
}
