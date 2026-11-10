/**
 * `api.data.loadProject` op HETZELFDE project (lees-wijzig-laad, het gedocumenteerde pad om
 * toewijzingen te zetten): houd vast wat `ExtImportResult` niet kan dragen. Anders verdwijnt dat stil
 * bij elke extensie-load (review #169, N3 en de fixrondes van 2026-10-12). Reden, net als B29: een
 * extensie mag het project niet stil veranderen.
 *
 * Wat het contract (`ExtImportResult`, contract 1.4.x) draagt en wat niet:
 *  - rekenprofiel: niet (alleen-lezen, B29) ⇒ van het document;
 *  - P6 Project-ID (`documentProjectCode`): niet (niet publiek) ⇒ van het document, als
 *    `project.p6ProjectCode`; bij een XER-document uit de broncache, die hieronder vervalt;
 *  - reken-opties: alleen de zes publieke (`PUBLIC_SCHEDULING_OPTION_KEYS`) ⇒ die volgen de extensie
 *    (ook weglaten), de rest komt van het document;
 *  - baselines en `activeBaselineId`: niet ⇒ van het document;
 *  - resourcekalenders (`calendars`): niet (alleen de projectkalender `calendar`) ⇒ van het document;
 *    de projectkalender zelf volgt de extensie, met de bronvelden (`CALENDAR_SOURCE_FIELDS`) van de
 *    documentkalender met hetzelfde id erover, zoals de kalenderdialoog ze bij een bewerking laat staan;
 *  - `activityCodeTypes` en `customFieldDefs`: niet (taken dragen alleen de waarden) ⇒ van het document;
 *  - `ifcGlobalIds`: niet ⇒ van het document;
 *  - IFC-schema (`project.ifcSchema`) en de open schemavraag (`project.ifcSchemaUnconfirmed`): niet
 *    (eigenschappen van het bestand, `NIET_PUBLIEK` in check-ext-contract) ⇒ van het document. Anders
 *    vroeg de app na een extensie-load niets meer en schreef ze een IFC4-bestand stil als IFC 4.3 ADD2,
 *    en viel de AutoSave-blokkade bij IFC2X3 weg (review #336, issue #292);
 *  - `customTaskTypes`: alleen wat de extensie meestuurt (lijst plus de typen op haar taken) ⇒ de
 *    documententries die zij niet meestuurt, komen erbij. Botst een documententry met een entry van de
 *    extensie op id of op naam (dezelfde sleutels als `fromExtImportResult`: id getrimd, naam
 *    hoofdletterongevoelig), dan wint de extensie en valt de documententry weg; `fromExtImportResult`
 *    gooit alleen bij botsingen BINNEN de invoer van de extensie;
 *  - bronvelden op taken en relaties (`TASK_SOURCE_FIELDS`, `SEQUENCE_SOURCE_FIELDS`): zichtbaar maar
 *    alleen-lezen (`fromExtTask`/`fromExtSequence` nemen ze niet over) ⇒ van de taak of relatie met
 *    hetzelfde id in het document. De solver leest ze (P6-route), dus zonder dit rekent een P6-project
 *    na een ONGEWIJZIGDE lees-wijzig-laad anders. De lijsten zijn gelijk aan `LEES_ALLEEN_EXT` in
 *    check-ext-contract; daar staat ook dat er geen niet-publieke taak-/relatievelden zijn
 *    (`NIET_PUBLIEK`). De .mpp-/MSP-velden (`mspTaskType`, `timephased*`, …) reizen al gewoon mee.
 *  - bronveld op toewijzingen (`ASSIGNMENT_SOURCE_FIELDS`): het begrote tempo naast een P6-resttempo
 *    (`plannedUnitsPerDay`, resttempo-besluit 2026-10-15) is niet publiek ⇒ van de toewijzing met
 *    hetzelfde id in het document. Zonder dit schreef de P6 XML-export na een ONGEWIJZIGDE
 *    lees-wijzig-laad het resttempo als `PlannedUnitsPerTime` (review #361).
 * Draagt een latere contractversie een van deze velden wél, dan hoort die waarde hier de extensie te
 * volgen (ook leeg) in plaats van het document.
 *
 * Bewust NIET vastgehouden (ook niet bij hetzelfde id):
 *  - XER-bron (`xerImportMetadata`, `xerSourceArchive`): een generieke load is geen XER-document meer;
 *    tests 47/48 en D1 in check-ext-contract pinnen dat.
 *  - `companyId`/`companyName`: `applyLoadedProject` wist de bibliotheekkoppeling bewust bij elke
 *    niet-gekoppelde load (`silent-switch`), net als de herkomststempels.
 *  - `importPristine`: na een wijziging door een extensie is het project niet meer onbewerkt.
 *
 * Ander project-id: een nieuw project; dan geldt niets hiervan en rekent het als OPS.
 *
 * Gedeelde referenties: wat van het document komt, gaat ZONDER kopie mee. Dat is veilig omdat de
 * store-objecten bevroren zijn (Immer auto-freeze) en het laadpad (`applyLoadedProject` →
 * `payloadFromImport`/`prepareLoadedPayload`/`stripLibraryOrigins`/`ensureUniqueImportIds`) alleen
 * nieuwe objecten maakt; een mutatie in place zou in strict mode gooien. check-ext-contract N3D-12
 * pint dat de gedeelde objecten bevroren zijn en de load slaagt.
 */
import type { AppState, AppStore } from '@/state/appStore';
import { markDocumentEdited } from '@/state/documentEdited';
import type { ExtImportResult } from './extTypes';
import type { ImporterDefinition } from './types';
import type { ImportResult } from '@/services/importTypes';
import type { ProjectSchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { COST_ASSIGNMENT_WORK_FIELDS, isCostResource, type ResourceAssignment } from '@/types/resource';
import { PUBLIC_SCHEDULING_OPTION_KEYS, fromExtImportResult } from './extMappers';
import { documentProjectCode } from '@/utils/documentProjectCode';

/** Alleen-lezen bronvelden: `toExt*` geeft ze door, `fromExt*` neemt ze niet over. */
export const TASK_SOURCE_FIELDS = [
  'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow',
  'p6CompletePctType', 'p6ExpectedFinish', 'p6SuspendResume',
] as const satisfies readonly (keyof Task)[];
export const SEQUENCE_SOURCE_FIELDS = ['p6StartAtPredecessorFinishBoundary'] as const satisfies readonly (keyof Sequence)[];
/** Kalender: de alleen-lezen P6-velden plus de niet-publieke herkomst (`generation`,
 *  `p6NonWorkPenaltyDatesState`). `libraryOrigin` hoort er niet bij: elke niet-gekoppelde load wist hem. */
export const CALENDAR_SOURCE_FIELDS = [
  'p6Source', 'p6NonWorkPenaltyDates', 'p6NonWorkPenaltyDatesState', 'generation',
] as const satisfies readonly (keyof WorkCalendar)[];
/** Toewijzing: het niet-publieke begrote tempo naast een P6-resttempo. */
export const ASSIGNMENT_SOURCE_FIELDS = ['plannedUnitsPerDay'] as const satisfies readonly (keyof ResourceAssignment)[];

/** Zet de bronvelden van het documentitem met hetzelfde id terug op het geladen item. */
function withSourceFields<T extends { id: string }>(items: T[], own: readonly T[], fields: readonly (keyof T)[]): T[] {
  const byId = new Map(own.map((item) => [item.id, item]));
  return items.map((item) => {
    const source = byId.get(item.id);
    if (!source) return item;
    const extra: Partial<T> = {};
    for (const field of fields) if (source[field] !== undefined) extra[field] = source[field];
    return Object.keys(extra).length > 0 ? { ...item, ...extra } : item;
  });
}

/** Documententries die de extensie niet meestuurt, achter die van de extensie (zie de kop). */
function mergeCustomTaskTypes(
  fromExtension: readonly { id: string; name: string }[],
  own: readonly { id: string; name: string }[],
): { id: string; name: string }[] {
  const ids = new Set(fromExtension.map((t) => t.id.trim()));
  const names = new Set(fromExtension.map((t) => t.name.trim().toLocaleLowerCase()));
  return [
    ...fromExtension,
    ...own.filter((t) => !ids.has(t.id.trim()) && !names.has(t.name.trim().toLocaleLowerCase())),
  ];
}

/** Het deel van het actieve document dat deze stap leest. */
export type ActiveDocument = Pick<AppState,
  'project' | 'tasks' | 'sequences' | 'assignments' | 'customTaskTypes' | 'calendars' | 'baselines' | 'activeBaselineId' | 'activityCodeTypes' | 'customFieldDefs' | 'ifcGlobalIds'
  | 'xerImportMetadata'>;

/** Alleen voor hetzelfde project-id; die keuze maakt `loadExtensionProject`. Bij een ander id gaat het
 *  resultaat ongewijzigd door, precies zoals vóór deze stap. */
export function retainActiveDocument(loaded: ImportResult, active: ActiveDocument): ImportResult {

  // Reken-opties: die van het document, met de publieke sleutels vervangen door die van de extensie.
  const options: Record<string, unknown> = { ...active.project.schedulingOptions };
  for (const key of PUBLIC_SCHEDULING_OPTION_KEYS) delete options[key];
  Object.assign(options, loaded.project.schedulingOptions);
  // Projectkalender: laat de extensie `project.calendarId` ongemoeid maar stuurt zij een `calendar` met
  // een ander id mee, dan IS die kalender de nieuwe projectkalender (`calendar` is per contract de
  // projectkalender). Wijzigt zij `project.calendarId` wél, dan telt die keuze.
  const calendarId = loaded.project.calendarId === active.project.calendarId ? loaded.calendar.id : loaded.project.calendarId;
  const p6ProjectCode = documentProjectCode(active.project, active.xerImportMetadata);
  const project = {
    ...loaded.project,
    calendarId,
    schedulingProfile: active.project.schedulingProfile,
    schedulingOptions: Object.keys(options).length > 0 ? options as ProjectSchedulingOptions : undefined,
    ...(active.project.ifcSchema !== undefined ? { ifcSchema: active.project.ifcSchema } : {}),
    ...(active.project.ifcSchemaUnconfirmed !== undefined ? { ifcSchemaUnconfirmed: active.project.ifcSchemaUnconfirmed } : {}),
    ...(p6ProjectCode ? { p6ProjectCode } : {}),
    ...(active.project.dependentProjectsFolder ? { dependentProjectsFolder: active.project.dependentProjectsFolder } : {}),
  };

  // Kalenders. Eerst gaat de kalender die de extensie meestuurt (`calendar`) de bibliotheek in, met de
  // bronvelden van de documentkalender met hetzelfde id erover (`p6Source`, `generation`, …: die draagt
  // `ExtCalendar` niet naar binnen). Daarna is de projectkalender de entry met `project.calendarId`:
  // wisselt de extensie daarmee van kalender, dan blijft de oude gewoon in de bibliotheek. De
  // projectkalender staat NIET ook in `resourceCalendars`: dan hernoemde `ensureUniqueImportIds` hem als
  // dubbel id (`…-dup-2`); het laden zet hem zelf weer in de bibliotheek (`promoteProjectCalendarToLibrary`).
  const [sent] = withSourceFields([loaded.calendar], active.calendars, CALENDAR_SOURCE_FIELDS);
  const own = active.calendars.some((c) => c.id === sent.id);
  const library = [...active.calendars.map((c) => (c.id === sent.id ? sent : c)), ...(own ? [] : [sent])];
  const calendar = library.find((c) => c.id === project.calendarId) ?? sent;
  const resourceCalendars = library.filter((c) => c.id !== calendar.id);

  return cleanDanglingReferences({
    ...loaded,
    project,
    tasks: withSourceFields(loaded.tasks, active.tasks, TASK_SOURCE_FIELDS),
    sequences: withSourceFields(loaded.sequences, active.sequences, SEQUENCE_SOURCE_FIELDS),
    assignments: withSourceFields(loaded.assignments, active.assignments, ASSIGNMENT_SOURCE_FIELDS),
    calendar,
    resourceCalendars,
    baselines: active.baselines,
    activeBaselineId: active.activeBaselineId,
    activityCodeTypes: active.activityCodeTypes,
    customFieldDefs: active.customFieldDefs,
    customTaskTypes: mergeCustomTaskTypes(loaded.customTaskTypes ?? [], active.customTaskTypes),
    ...(active.ifcGlobalIds ? { ifcGlobalIds: active.ifcGlobalIds } : {}),
  });
}

/** Alleen bij hetzelfde id: een resource of taak met een `calendarId` naar een kalender die niet in
 *  het geladen resultaat staat (de extensie wees naar een onbekend id), krijgt geen `calendarId` meer
 *  en rekent dus op de projectkalender. De berekening verandert daardoor niet: de solver viel bij een
 *  onbekend id al terug op de projectkalender (`resolveCalendar`). */
export function cleanDanglingReferences(loaded: ImportResult): ImportResult {
  const calendarIds = new Set([loaded.calendar.id, ...(loaded.resourceCalendars ?? []).map((c) => c.id)]);
  const known = (id: string | undefined) => !id || calendarIds.has(id);
  return {
    ...loaded,
    resources: loaded.resources.map((r) => (known(r.calendarId) ? r : { ...r, calendarId: undefined })),
    tasks: loaded.tasks.map((t) => (known(t.calendarId) ? t : { ...t, calendarId: undefined })),
  };
}

/** Weigert een toewijzing die niet past bij het type van haar resource (issue #815): een bedrag op een
 *  werk- of materiaalresource, of inzet, curve of werk op een kostenresource. Zoals `fromExtImportResult`
 *  andere ongeldige invoer weigert: met een fout, vóór er iets geladen is. Een toewijzing naar een
 *  onbekende resource laat het laden zelf vallen. */
function assertAssignmentsFitResources(loaded: ImportResult): void {
  const resourceById = new Map(loaded.resources.map((r) => [r.id, r] as const));
  for (const a of loaded.assignments) {
    const resource = resourceById.get(a.resourceId);
    if (!resource) continue;
    const where = `ExtImportResult.assignments['${a.id}']`;
    if (isCostResource(resource)) {
      const workField = COST_ASSIGNMENT_WORK_FIELDS.find((k) => a[k] !== undefined && !(k === 'curve' && a.curve === 'UNIFORM'));
      if (workField || a.unitsPerDay !== 1) {
        throw new Error(`${where}: kostenresource '${resource.id}' draagt geen ${workField ?? 'unitsPerDay ≠ 1'}`);
      }
    } else if (a.costAmount !== undefined) {
      throw new Error(`${where}: costAmount hoort alleen bij een kostenresource, niet bij '${resource.id}' (${resource.type})`);
    }
  }
}

/**
 * `api.data.loadProject`: laad een extensie-resultaat over het ACTIEVE document.
 *
 *  - Hetzelfde project-id (lees-wijzig-laad): `retainActiveDocument`; het opslagdoel blijft, en ook
 *    AutoSave naar bestand (`autoSaveToFile`), dat het laden anders stil uitzet (`freshPayload`).
 *  - Ander id: een nieuw project zonder opslagdoel, zodat opslaan om een nieuwe plek vraagt in plaats
 *    van het bestand van het vorige project te overschrijven.
 *  - Altijd: het document staat daarna op gewijzigd (`markDocumentEdited`), zodat de afsluitcontrole
 *    en AutoSave het zien; het laden zelf zet `isDirty` op false, zoals voor een geopend bestand.
 *
 * De extensie-importer (Backstage → Importeren) loopt hier NIET door: zie `openExtensionImport`.
 */
export function loadExtensionProject(store: AppStore, result: ExtImportResult): void {
  const before = store.getState();
  const loaded = fromExtImportResult(result);
  assertAssignmentsFitResources(loaded);
  const sameProject = loaded.project.id === before.project.id;
  const autoSaveToFile = before.autoSaveToFile;
  before.loadState(sameProject ? retainActiveDocument(loaded, before) : loaded);
  store.getState().runCPM();
  store.setState((s) => {
    markDocumentEdited(s);
    if (sameProject) {
      s.autoSaveToFile = autoSaveToFile;
    } else {
      s.filePath = null;
      s.fileHandle = null;
      s.siteFileId = null;
      s.siteFileVersion = null;
    }
  });
}

/**
 * Backstage → Importeren: open het resultaat van een extensie-importer als NIEUW document, via dezelfde
 * route als de ingebouwde formaten (`openAsDocument`): een eigen tabblad (of het lege, ongewijzigde
 * actieve tabblad), doorrekenen en passend zoomen. Het actieve document blijft ongemoeid, dus er is
 * geen bevestigingsvraag. Zoals na elke verse import is het nieuwe document niet gewijzigd. Het heeft
 * geen opslagdoel (`saveTarget: false`): de bron is geen IFC, dus opslaan vraagt om een plek.
 */
export function openExtensionImport(store: AppStore, result: ExtImportResult, fileName: string): void {
  store.getState().openAsDocument(fromExtImportResult(result), { name: fileName, ref: null, saveTarget: false });
}

/**
 * Backstage → Importeren: draai de importer van een extensie en open het resultaat
 * (`openExtensionImport`). Gooit de importer (of de omzetting van zijn resultaat), dan ziet de gebruiker
 * een foutmelding via het meldingenkanaal, met de naam van de importer en de foutboodschap als detail —
 * zoals een mislukte open-actie van de ingebouwde formaten (`notifications.openFailed` + `detail`). Het
 * actieve document blijft dan ongemoeid. Geeft `true` terug als het resultaat geopend is.
 */
export async function importWithExtension(
  store: AppStore,
  importer: Pick<ImporterDefinition, 'name' | 'handler'>,
  file: File,
): Promise<boolean> {
  try {
    openExtensionImport(store, await importer.handler(file), file.name);
    return true;
  } catch (err) {
    console.error('[Extensies] Import mislukt:', err);
    store.getState().notify({
      severity: 'error',
      messageKey: 'notifications.extImportFailed',
      params: { name: importer.name },
      detail: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
