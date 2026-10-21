import { Task, TaskTime, TaskType, TASK_TYPES } from '@/types/task';
import { WORK_RULES, type WorkRule } from '@/types/workRule';
import { normalizeCurveValues } from '@/engine/contour/contourEngine';
import type { CustomTaskType } from '@/types/taskType';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, AvailabilityStep, ResourceCurve, isResourceCurve } from '@/types/resource';
import { Project, ProjectSchedulingOptions, SchedulingOptions, SchedulingProfile, isIfcSchemaId, type IfcSchemaId } from '@/types/project';
import { WorkCalendar, Holiday, CalendarGeneration, WorkingException, type WorkTimeBands } from '@/types/calendar';
import { DEFAULT_CALENDAR_ID, createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { HolidayCountry } from '@/engine/calendar/holidays';
import type { LibraryOrigin } from '@/types/library';
import { ActivityCodeType, CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { Baseline, BaselineTask, normalizeComparedBaselines, type ComparedBaselineIds } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { formatInstant, localTodayIso } from '@/utils/dateUtils';
import { ifcGuid, ifcGuid128, ifcObjectSeed } from './ifcWriter';
import { IfcParseError } from './ifcErrors';
import { workCalendarSlots, workControlSlots } from './ifcWorkControlSlots';
import { cleanIfcSchemaName, ifcSchemaUnconfirmedOnRead } from './ifcSchemaQuestion';
import type { ImportLabels, ImportResult, RecordedSourceFormat, XerArchiveIssue, XerArchiveIssueCode } from '@/services/importTypes';
import {
  DEFAULT_PRIORITY, IFC_TIME_ANCHOR, MEASURE_TO_FIELD, IFC_TO_RESOURCE_TYPE,
} from './ifcConstants';
import { OPS_LEGACY_LITERAL_APP_VERSION, PSET, PER_TASK_PSET_BY_NAME, readIfcDate } from './ifcPsets';
import {
  IFC_TASKTIME_SLOTS, ALL_RECORDED_SLOT_KEYS, TASK_SLOT, TASKTIME_SLOT, IFC_TASK_STATUS_RUNNING,
  type RecordedFieldKey, type TaskTimeReadHelpers,
} from './ifcTaskSlots';
import { normalizeImportedProgress, reconstructResourceIds } from '@/services/importNormalize';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import type { XerImportMetadata } from '@/services/importTypes';
import {
  bindXerImportMetadataToArchive, createXerSourceArchiveFromOwnedMetadata, decodeXerBase64Chunk,
  parseXerArchiveMetadataPayload, sha256Hex,
  XER_SOURCE_ARCHIVE_CHUNK_BYTES, XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT,
  XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION, XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT,
  XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_SCHEMA_VERSION,
  XER_SOURCE_ARCHIVE_SCHEMA_VERSION, type XerSourceArchive, type XerSourceArchiveBom,
  type XerSourceArchiveEncoding, type XerSourceArchiveNewline, type XerArchiveMetadataPayloadV1,
  type XerSourceReconstruction,
} from '@/services/xerSourceArchive';
import {
  MAX_PROFILE_JSON_LENGTH, profileAfterRead, sanitizeSchedulingOptions, sanitizeSchedulingProfile,
} from '@/services/ifc/schedulingOptionsRead';
import { optionKeysOnly } from '@/services/ifc/schedulingProfileMigration';
import { emptyMissingScheduleDates, importStatusDate, parseImportedInstant, resolveMissingScheduleDates } from '@/services/importDates';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { seedScalarBands } from '@/utils/effectiveWorkTime';
import { hourRemainingDays } from '@/engine/taskMutationRules';
import {
  canonicalizeBands, clockToMinutes, firstBlockedDay, getCalendarBands, hasNonAnchorTime,
  isoDurationToMinutes, isSubDayMinutes, minutesToClock, promoteHourCalendar, promoteHourCalendars,
  registerCalendarBands, scalarHourFromClock, workDayFromBlocks,
} from '@/services/subdayIo';

// IFC_TIME_ANCHOR (discriminator c) en DEFAULT_PRIORITY wonen in ./ifcConstants zodat reader en
// writer gegarandeerd hetzelfde anker/dezelfde default gebruiken. De rauwe-banden-registry en
// `synthBandsFromScalar` wonen gedeeld in subdayIo.

/**
 * Expliciete injectienaad: de compacte schema-2-envelope bewaart alleen bronbytes; de zware,
 * lazy XER-reader levert de afleiding daarvan uitsluitend via de officiële async ingang.
 *
 * ONTWERPKEUZE — "datums zoals opgeslagen" overleeft een IFC-opslag en -heropening via DEZE naad,
 * niet via een eigen `OPS_`-pset. Afweging:
 *
 *  - *Geen tweede afleiding.* De reconstructie draait een volledige `readXER` over sha256-geverifieerde
 *    bytes, dus de vastlegging (bak 4) is per constructie identiek aan die van het oorspronkelijke
 *    openen (kalenderpromotie, dag/uur-representatie, getalnotatie). Zelf herrekenen in de IFC-laag
 *    zou dat moeten NABOOTSEN — één representatieverschil ⇒ élke taak telt als "verschoven".
 *  - *De chunkgrens blijft heel.* `parseXerNumber` statisch importeren trekt de hele XER-parser de
 *    hoofdbundel in.
 *  - *Id-matching is al opgelost.* XER-taak-id's ZIJN de rauwe `task_id`-cellen, en
 *    `OPS_TaskIdentity` draagt exact die id's door de opslag heen (zie `stableIfcTaskId`).
 *  - *Werkt óók bij opslaan buiten de modus.* `runCPM` wist `recordedDates` bij het verlaten van de
 *    modus; een pset zou de vastlegging dan verliezen. De bronroute is modus-onafhankelijk.
 *  - *Geen contractwijziging* (`DOCUMENT_FIELDS`, `IFC_SAVE_KEYS`, `sameIFCSource`/`isDirty`) en
 *    geen extra parse.
 *
 * BEKENDE GRENS: historische schema-1-archieven (niet-compact) krijgen géén `recordedTimes` terug:
 * `readIFCWithXerReconstruction` geeft daar bewust geen reconstructor mee (synchroon pad, zonder
 * XER-chunk). De huidige writer schrijft uitsluitend schema 2.
 */
export type XerArchiveReconstructor = (bytes: Uint8Array) => XerSourceReconstruction;

export interface IfcReadOptions {
  /** Alleen `readIFCWithXerReconstruction` vult dit. De lage sync-lezer mag schema-2 nooit
   * afhankelijk maken van een toevallig eerder geïmporteerde module. */
  reconstructXerArchive?: XerArchiveReconstructor;
  /**
   * Alleen crashherstel vult dit (`useRecoveryRestore`): de bronbytes van een recovery-snapshot met
   * een archiefVERWIJZING (schema 3, `recovery-reference-v1`). Sleutel = SHA-256 van de bronbytes.
   * `undefined` ⇒ de blob is weg; het document opent dan zonder archief, met `xerArchiveIssue`
   * `bytes-missing` ("openen met melding").
   */
  resolveXerArchiveReference?: (sha256: string) => Uint8Array | undefined;
}

interface StepEntity {
  id: string; // STEP entity ID (may include letters, e.g. "300T")
  type: string;
  args: string[];
  raw: string;
}

// ── Integriteitscontract ───────────────────────────────────────────────────────────────────────
// Zonder contract wordt alles wat er niet uit te halen valt stil een leeg project, en is een
// afgekapte auto-save-snapshot onzichtbaar. De minimale, formaat-eigen controle: een
// STEP-uitwisselingsbestand BEGINT met `ISO-10303-21;` en EINDIGT met `END-ISO-10303-21;` (ISO 10303-21
// §5). Ontbreekt de kop, dan is het geen STEP-bestand; ontbreekt de sluitmarkering, dan is de tekst
// afgekapt — het enige signaal dat een half weggeschreven bestand überhaupt afgeeft. Bewust GEEN
// inhoudelijke drempel (zoals "minstens één taak"): een leeg-maar-echt project — verse wizard met
// kalender en resources — is legitiem, en zou anders bij crashherstel als onbruikbaar worden
// weggegooid.
const STEP_HEADER = 'ISO-10303-21;';
const STEP_TERMINATOR = 'END-ISO-10303-21;';
/** Hoeveel tekens vanaf het EIND we afzoeken naar de sluitmarkering (die staat er per definitie). */
const TERMINATOR_PROBE = 4096;

/**
 * Werp een {@link IfcParseError} als `content` geen compleet STEP-bestand is. Tolerant waar het
 * mag (BOM, witruimte vóór de kop, kleine letters), streng waar het moet (kop én sluitmarkering).
 */
export function assertIfcIntegrity(content: string): void {
  // Kop: BOM en voorafgaande witruimte overslaan zonder de hele tekst te kopiëren (bestanden zijn
  // megabytes groot; `trimStart()` zou er een kopie van maken).
  let i = content.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (i < content.length && isSpaceCode(content.charCodeAt(i))) i++;
  if (content.slice(i, i + STEP_HEADER.length).toUpperCase() !== STEP_HEADER) {
    throw new IfcParseError(
      'not-step',
      `Geen IFC/STEP-bestand: de verplichte kop '${STEP_HEADER}' ontbreekt.`,
    );
  }
  if (!content.slice(-TERMINATOR_PROBE).toUpperCase().includes(STEP_TERMINATOR)) {
    throw new IfcParseError(
      'truncated',
      `Onvolledig IFC-bestand: de afsluitende '${STEP_TERMINATOR}' ontbreekt — ` +
      'de tekst is afgekapt (bijvoorbeeld door een crash tijdens het schrijven).',
    );
  }
}

/**
 * Engelse terugval voor `ImportLabels.importedProject` — de app valt in i18n ook op Engels terug
 * (`fallbackLng: 'en'`), en de MSPDI-reader doet hetzelfde met `'Imported Calendar'`. Aanroepers
 * die bij een `t(...)` kunnen, horen die mee te geven.
 */
export const DEFAULT_IMPORTED_PROJECT_NAME = 'Imported project';

/**
 * Parse an IFC STEP file into the internal model.
 *
 * `labels` levert de vertaalde teksten die deze dienstlaag zelf niet kan oplossen — op dit moment
 * alleen de projectnaam voor een bestand zónder `IFCPROJECT`. Weglaten is toegestaan en levert de
 * Engelse default; zie `ImportLabels`.
 */
export function readIFC(
  content: string,
  labels: ImportLabels = {},
  options: IfcReadOptions = {},
): ImportResult {
  // Eerst de integriteitspoort: liever een expliciete fout dan een stil half project.
  assertIfcIntegrity(content);
  const entities = parseSTEP(content);
  // Vóór elke lezing van een string: STEP-codering (`\X2\…\X0\`, `\\` e.d.) terug naar tekst. Oude
  // eigen bestanden schreven letterlijk en blijven byte-voor-byte gelezen zoals voorheen.
  if (stringsAreStepEncoded(entities)) decodeEntityStrings(entities);
  const entityMap = new Map<string, StepEntity>();
  for (const e of entities) {
    entityMap.set(e.id, e);
  }

  // Taakidentiteit moet vóór `extractTasks` bekend zijn. Externe links bewaren het taak-id van een
  // geparseerde bron; een nieuw willekeurig id bij iedere parse zou een echte Tauri-refresh van
  // hetzelfde IFC-bestand altijd `sourceMissing` maken. OPS-bestanden dragen het
  // oorspronkelijke id in OPS_TaskIdentity; oudere/andere IFC-bestanden vallen stabiel terug op
  // hun IFCTASK.GlobalId.
  const taskIdentityByStepId = extractTaskIdentityByStepId(entities, entityMap);

  // Extract project
  const project = extractProject(entities, entityMap, labels);
  // Het schema uit de kop (issue #292): de kop is de opslag van `Project.ifcSchema`, zodat een geopend
  // IFC4- of IFC4X3-bestand bij opslaan in zijn eigen schema blijft. Een ander schema (IFC2X3,
  // IFC4X3_ADD1, …) laat het veld weg: dan schrijft opslaan de standaard. Of het eerste opslaan eerst
  // vraagt, volgt hieronder na de psets (`ifcSchemaUnconfirmed`).
  const fileSchemaName = readFileSchemaName(content);
  if (isIfcSchemaId(fileSchemaName)) project.ifcSchema = fileSchemaName;
  // "Openen met melding": het XER-bronarchief is een sidecar, geen
  // fundament. Is het onbruikbaar, dan vallen archief, selector, XER-metadata en de daaruit
  // gereconstrueerde `recordedTimes` SAMEN weg en opent het project gewoon — met een verplicht
  // `xerArchiveIssue`-signaal, zodat het verlies nooit stil is. Zie `readXerArchiveOrIssue`.
  const archiveRead = readXerArchiveOrIssue(entities, entityMap, options);
  const xerSource = archiveRead.source;
  const xerSourceArchive = xerSource?.archive;
  const xerSourceProjectId = archiveRead.sourceProjectId;
  const xer = archiveRead.xer;
  const xerArchiveIssue = archiveRead.issue;
  // "Datums zoals opgeslagen" over een IFC-opslag/heropening heen. GEEN eigen pset en geen
  // eigen afleiding: dit is letterlijk de map die `readXER` over dezelfde, sha256-geverifieerde
  // bronbytes maakte (zie `XerArchiveReconstructor` hierboven voor de volledige afweging). De
  // selector `OPS_XerDocument` kiest het project; een bestand zonder XER-archief, met een onbekende
  // selector of uit een historische schema-1-envelope houdt `recordedTimes` afwezig.
  const recordedTimes = xerSourceProjectId
    ? xerSource?.recordedTimesByProject[xerSourceProjectId]
    : undefined;
  // Heropen-beleid ("elk formaat zoals XER"): de herkomst van de vastlegging beslist het laadbeleid.
  // Een IFC dat deze app ZELF schreef (IFCAPPLICATION met identifier 'OPS', of een `OPS_`-pset) is een
  // HEROPENING ('ifc-own', of 'xer-archive' mét XER-archief) en gaat alleen automatisch in "datums
  // zoals opgeslagen" zolang het document sinds de import ongewijzigd is (`OPS_ImportProvenance`); elk
  // ander IFC is een verse import uit een ander pakket ('ifc') en gedraagt zich als XER: automatisch
  // aan bij afwijkingen.
  const ownAuthored = isOpsAuthoredIfc(entities);
  const importPristine = ownAuthored ? extractImportPristine(entities, entityMap) : undefined;
  const recordedSourceFormat = ownAuthored ? extractRecordedSourceFormat(entities, entityMap) : undefined;
  const calendar = extractCalendar(entities, entityMap);
  // Taken die aan een `.BASELINE.`-IfcWorkSchedule hangen zijn baseline-snapshots, geen live
  // taken — sla ze over (robuust tegen externe tools; OPS zelf hangt er geen op).
  const baselineTaskStepIds = collectBaselineTaskStepIds(entities);
  const { tasks, taskStepIdMap, taskTimeEntities, recordedFields, runningStatusIds } = extractTasks(
    entities, entityMap, baselineTaskStepIds, taskIdentityByStepId, calendar.hoursPerDay,
  );
  const p6BoundarySequenceGuids = extractP6BoundarySequenceGuids(
    entities, entityMap, new Set(taskStepIdMap.keys()),
  );
  // Intern id → GlobalId per object uit dit bestand (zie `collectIfcGlobalIds`); de extractors
  // hieronder vullen hem terwijl ze id's uit GlobalIds afleiden.
  const guidLog: Record<string, string> = {};
  const sequences = extractSequences(
    entities, entityMap, taskStepIdMap, p6BoundarySequenceGuids, calendar.hoursPerDay, guidLog,
  );
  extractNesting(entities, entityMap, tasks, taskStepIdMap);
  // BEWUST GEEN normalisatie van `isMilestone` op taken met kinderen: de app zelf laat een mijlpaal
  // kinderen krijgen (`indentTasks`, `updateTask`, de checkbox) en de writer schrijft die vlag rauw —
  // een lezer-reset maakt schrijven≠lezen en laat de vlag stil verdwijnen bij opslaan/openen én
  // crashherstel. De guard "samenvatting is nooit mijlpaal" hoort bij de EXPORTgrenzen
  // (MSPDI-writer), niet in het native formaat.
  const { resources, resourceStepIdMap, resourceGuidMap } = extractResources(entities, entityMap, guidLog);
  extractResourceMeta(entities, entityMap, resources, resourceStepIdMap, resourceGuidMap);
  extractCrewNesting(entities, resources, resourceStepIdMap);
  const { calendars: resourceCalendars, idByGuid: calendarIdByGuid } = extractCalendarLibrary(
    entities, entityMap, resources, resourceStepIdMap, tasks, taskStepIdMap, guidLog,
  );
  // De PROJECTkalender zit niet in `extractCalendarLibrary`'s bibliotheek-lus (die sluit
  // 'm expliciet uit); haar GUID→id hoort wel in dezelfde vertaaltabel. Zelfde "eerste IFCWORKCALENDAR
  // in het bestand"-conventie als `extractCalendar`/`extractCalendarLibrary` zelf hanteren.
  const projectCalendarEntityForGuid = entities.find(e => e.type === 'IFCWORKCALENDAR');
  if (projectCalendarEntityForGuid) {
    calendarIdByGuid.set(stripQuotes(projectCalendarEntityForGuid.args[0] || ''), calendar.id);
    const projectCalendarGuid = ifcSlotText(projectCalendarEntityForGuid.args[0]);
    if (projectCalendarGuid) guidLog[ifcObjectSeed('cal', calendar.id)] = projectCalendarGuid;
  }
  // Uur-modus-post-pass. Ná extractCalendarLibrary zodat elke
  // `task.calendarId` (en dus de effectieve kalender) is geresolved. Zet `workTime` op kalenders
  // die afwijken van het dag-patroon (discriminator a/b/c) en herinterpreteert de duren/datetimes
  // van uur-taken minuut-precies. Dag-bestanden leveren geen signaal ⇒ ongemoeid.
  applyHourModeIFC(tasks, calendar, resourceCalendars, taskTimeEntities);
  fillEmptyComputedDateSlots(tasks, taskTimeEntities, recordedFields);
  const assignments = extractAssignments(entities, entityMap, taskStepIdMap, resourceStepIdMap);
  // task.resourceIds herbouwen uit de assignments. De assignments zijn de ENIGE bron
  // van waarheid voor de taak↔resource-koppeling in het bestand (geen dubbele opslag) — de reader
  // projecteert ze terug op elke taak. Deterministische, gede-dupliceerde volgorde (eerste-zien in
  // de assignments-volgorde, die op zijn beurt uit de STEP-volgorde komt).
  reconstructResourceIds(tasks, assignments);
  const libraryPoolOut: { value: import('@/types/library').CompanyPool | undefined } = { value: undefined };
  const projectStartRecorded = { value: false };
  const ifcSchemaMarkers: IfcSchemaMarkers = { confirmed: false };
  const { activityCodeTypes, customFieldDefs } = extractStructure(
    entities, entityMap, project, tasks, taskStepIdMap, libraryPoolOut, projectStartRecorded, ifcSchemaMarkers,
  );
  // De schemavraag bij opslaan (besluit eigenaar 2026-10-13): staat er een andere kop dan de standaard
  // en heeft de gebruiker nog niet gekozen, dan vraagt het eerste expliciete opslaan het eerst.
  const ifcSchemaUnconfirmed = ifcSchemaUnconfirmedOnRead(fileSchemaName, ifcSchemaMarkers);
  if (ifcSchemaUnconfirmed) project.ifcSchemaUnconfirmed = ifcSchemaUnconfirmed;
  for (const task of tasks) reconcileP6SuspendResume(task);
  const customTaskTypes = extractTaskTypeMeta(entities, entityMap, tasks, taskStepIdMap);
  // Kalenderwandelingen (`timephasedDurationWalks`), eigen pset (zie de functie zelf voor waarom dit
  // niet via de PER_TASK_PSETS-registry loopt): GUID→id-vertaling, dus
  // pas NA extractCalendarLibrary hierboven (die tabel levert `calendarIdByGuid`).
  extractTimephasedDurationWalksMeta(entities, entityMap, tasks, taskStepIdMap, calendarIdByGuid);
  // `TaskTimephasedContour.resourceId` verwijst naar een resource-id uit
  // het SCHRIJVENDE document; deze lezer leidt resource-ids af uit het GlobalId (`extractResources`),
  // en dat is voor een in de app gemaakte resource bij het eerste openen een ander id. De verwijzing
  // moet dus mee (`mappedResourceId`: hetzelfde id, of via de GlobalId die de writer voor die
  // resource gebruikte, zie `extractBaselines`' taak-remap-precedent). Ná
  // `extractStructure`, want dáár landen de `OPS_TimephasedContours`-psets op de taken. Een
  // verwijzing die niet terug te vinden is (GUID-botsing met `#dup`-suffix, of een extern bestand)
  // blijft ongewijzigd staan — de koppeling valt dan terug op de 1-op-1-regel van de engine.
  remapContourResourceIds(tasks, resourceGuidMap, new Set(resources.map(r => r.id)));

  // Baselines: autoritatieve OPS_Baselines-JSON, met taskId-remap via GlobalId.
  const { baselines, activeBaselineId, comparedBaselineIds } = extractBaselines(entities, entityMap, taskStepIdMap);

  // Scheduling-options en rekenprofiel: eerst het profiel —
  // de OPS_SchedulingProfile-pset wint, anders `legacyOptionsToProfile` over het gelezen blok —, dán
  // conventiesleutels en de XER-bronmarkering strippen: het project draagt alleen projectopties.
  const schedulingOptions = extractSchedulingOptions(entities, entityMap);
  const schedulingProfile = profileAfterRead(extractSchedulingProfile(entities, entityMap), schedulingOptions);
  if (schedulingProfile) project.schedulingProfile = schedulingProfile;
  const projectOptions = optionKeysOnly(schedulingOptions);
  if (projectOptions) {
    remapLevelingResourceIds(projectOptions, resourceGuidMap, new Set(resources.map(r => r.id)));
    project.schedulingOptions = projectOptions;
  }

  // Ontbrekende ScheduleStart/-Finish (een `$`-slot, of een IFCTASK zonder IfcTaskTime) — gedeelde
  // regel voor alle lezers (`resolveMissingScheduleDates`), vóór de voortgang-invarianten: start ⇒ de
  // projectstart (zoals `addTask`), finish ⇒ start + duur waar eenduidig. Aanwezigheid komt uit
  // `recordedFields` (de slot-lezer zelf zet nog de vandaag-plaatshouder).
  // Projectstart uit IfcWorkPlan.StartTime (dus niet uit OPS_ProjectSettings): valt die LATER dan de
  // vroegste ingelezen taakstart, dan wint hij niet en geldt die taakstart. In het bSI/xbim-voorbeeld
  // `construction-scheduling-task` is StartTime 2010-09-23 (de aanmaakdag), terwijl de taken op
  // 2010-09-20 beginnen; als projectstart zou hij via de projectstart-vloer 63 van de 72 taken drie
  // dagen later laten starten. Een StartTime vóór de eerste taak blijft staan (zoals de kubusbestanden
  // van BlenderBIM). Alleen taken met een ingelezen ScheduleStart tellen (`recordedFields`).
  if (project.startDate && !projectStartRecorded.value) {
    const earliestTaskStart = tasks
      .filter(t => (recordedFields[t.id] ?? []).includes('scheduleStart'))
      .map(t => (t.time.scheduleStart ?? '').slice(0, 10))
      .filter(Boolean)
      .sort()[0];
    if (earliestTaskStart && earliestTaskStart < project.startDate) project.startDate = earliestTaskStart;
  }
  const missingDates = emptyMissingScheduleDates();
  for (const t of tasks) {
    const present = recordedFields[t.id] ?? [];
    if (!present.includes('scheduleStart')) missingDates.start.add(t.id);
    if (!present.includes('scheduleFinish')) missingDates.finish.add(t.id);
  }
  // Projectstart niet in het bestand (geen gevuld IFCWORKPLAN-slot en geen OPS_ProjectSettings,
  // zie de ''-sentinel bij de projectbouw) ⇒ het anker = de vroegste AANWEZIGE taak-scheduleStart in
  // plaats van "vandaag" te verzinnen: een verzonnen datum is geen invoer en mag dus ook niet via de
  // projectstart-vloer (`CPMSolver.rootFloor`) taken mét voorgangers naar de leesdatum tillen.
  // Pas als het bestand ook geen enkele taakstart draagt, valt hij terug op vandaag (leeg project).
  // MAAR: heeft het OPS-pset het veld GEZEGD — óók als "bewust leeg" —
  // dan is leeg een uitspraak van de gebruiker en blijft hij leeg; afleiden zou de round-trip van
  // een leeggemaakte startdatum corrumperen (writer codeert dat als NominalValue $). Taken zonder
  // start krijgen dan wel het afgeleide anker.
  const startAnchor = resolveMissingScheduleDates(tasks, missingDates, project.startDate,
    (task) => resolveCalendar(task.calendarId, resourceCalendars, calendar));
  if (!project.startDate && !projectStartRecorded.value) project.startDate = startAnchor;

  // Voortgang-invarianten op de rauw ingelezen actuals — ná extractStructure zodat
  // project.statusDate (uit OPS_ProjectSettings) beschikbaar is als default-actualFinish.
  // `runningStatusIds`: taken met `IfcTask.Status` = 'STARTED' — een lopende taak op 100 % blijft
  // dan lopend (eigenaarsbesluit 2026-10-14). Oude bestanden (`$`) lezen als voorheen.
  normalizeImportedProgress(tasks, project.statusDate, runningStatusIds);

  const ifcGlobalIds = collectIfcGlobalIds(entities, entityMap, taskStepIdMap, project.id, guidLog);

  return {
    project, calendar, tasks, sequences, resources, assignments,
    activityCodeTypes, customFieldDefs, customTaskTypes, resourceCalendars,
    baselines, activeBaselineId, comparedBaselineIds,
    libraryPool: libraryPoolOut.value,
    recordedFields,
    // Heropen-beleid: 'xer-archive', NIET 'xer' — deze route is een HEROPENING, geen verse import.
    // `applyRecordedDatesOnLoad` zet de modus bij 'xer-archive' alleen aan zolang het bestand
    // ongewijzigd is sinds de import (`importPristine`); anders vergeet hij de opgeslagen datums, want
    // een intussen bewerkte en opgeslagen planning mag bij heropenen niet stilzwijgend P6's oude datums
    // tonen. Zie `importTypes.ts` (`recordedTimesOrigin`) voor het volledige onderscheid.
    ...(recordedTimes ? { recordedTimes, recordedTimesOrigin: 'xer-archive' as const }
      : { recordedTimesOrigin: ownAuthored ? 'ifc-own' as const : 'ifc' as const }),
    ...(importPristine !== undefined ? { importPristine } : {}),
    ...(recordedSourceFormat ? { recordedSourceFormat } : {}),
    ...(xerSourceArchive ? { xerSourceArchive } : {}),
    ...(xerSourceProjectId ? { xerSourceProjectId } : {}),
    // `xerOrigin` is eerlijk: alleen gezet wanneer er ook echt archiefmetadata (`xer`) is. Een
    // onbruikbaar archief is weggelaten (`xerArchiveIssue`) en draagt dus géén `xer` en géén
    // `xerOrigin` — er is geen archief om naar te verwijzen.
    ...(xer ? { xer, xerOrigin: 'xer-archive' as const } : {}),
    ...(xerArchiveIssue ? { xerArchiveIssue } : {}),
    ...(ifcGlobalIds ? { ifcGlobalIds } : {}),
  };
}

/**
 * De GlobalIds die bij opslaan terug moeten komen (audit 2026-09-26), gesleuteld op
 * `ifcObjectSeed(soort, id)`: per ingelezen taak, resource, kalender en relatie, en het project met zijn
 * werkplan en werkschema.
 * Taken houden hun id (OPS_TaskIdentity of het GlobalId), resources, kalenders en relaties krijgen
 * een id afgeleid uit hun GlobalId (`stableIdFromGuid`), het project via zijn GlobalId. Met deze
 * kaart geeft de writer elk bestaand object zijn GlobalId terug, ook een oud of vreemd GlobalId dat
 * niet uit het id af te leiden is. De soort in de sleutel voorkomt dat een taak en het project (of
 * een relatie) met hetzelfde kale id uit XER elkaars GlobalId overschrijven.
 */
function collectIfcGlobalIds(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
  projectId: string,
  guidLog: Record<string, string>,
): Record<string, string> | undefined {
  const out: Record<string, string> = { ...guidLog };
  for (const [stepId, taskId] of taskStepIdMap) {
    const guid = ifcSlotText(entityMap.get(stepId)?.args[TASK_SLOT.globalId]);
    if (guid) out[ifcObjectSeed('task', taskId)] = guid;
  }
  const proj = entities.find(e => e.type === 'IFCPROJECT');
  const projectGuid = proj ? ifcSlotText(proj.args[0]) : '';
  if (projectGuid) out[ifcObjectSeed('proj', projectId)] = projectGuid;
  // Werkplan en het eerste niet-baseline-werkschema (de writer schrijft er van elk één per project).
  const plan = entities.find(e => e.type === 'IFCWORKPLAN');
  const planGuid = plan ? ifcSlotText(plan.args[0]) : '';
  if (planGuid) out[ifcObjectSeed('wp', projectId)] = planGuid;
  const schedule = entities.find(e => e.type === 'IFCWORKSCHEDULE' && !isBaselineSchedule(e));
  const scheduleGuid = schedule ? ifcSlotText(schedule.args[0]) : '';
  if (scheduleGuid) out[ifcObjectSeed('ws', projectId)] = scheduleGuid;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Stabiel id voor een resource, kalender of relatie: afgeleid uit het GlobalId van de entiteit, zodat
 * hetzelfde bestand bij elk openen dezelfde id's geeft (audit 2026-09-26; voorheen `generateId`, bij
 * elk openen nieuw). Zonder GlobalId de STEP-id; een dubbel id binnen het bestand krijgt `-dup-N`,
 * net als `stableIfcTaskId`. Legt het GlobalId vast in `guidLog` voor de writer.
 */
function stableIdFromGuid(
  kind: 'res' | 'cal' | 'seq',
  prefix: string,
  entity: StepEntity,
  usedIds: Set<string>,
  guidLog: Record<string, string>,
): string {
  const guid = ifcSlotText(entity.args[0]);
  const base = guid ? `${prefix}-ifc-${guid}` : `${prefix}-ifc-step-${entity.id}`;
  let id = base;
  for (let duplicate = 2; usedIds.has(id); duplicate++) id = `${base}-dup-${duplicate}`;
  usedIds.add(id);
  if (guid) guidLog[ifcObjectSeed(kind, id)] = guid;
  return id;
}

/** Resource-id uit het schrijvende document → ons id. Bestaat een resource met dat id al (een
 *  resource die bij het vorige openen haar id uit haar GlobalId kreeg), dan is het dezelfde; anders
 *  via het GlobalId dat de writer uit dat id afleidde: eerst de huidige afleiding
 *  (`ifcGuid128(ifcObjectSeed('res', id))`), dan die van oudere bestanden (`ifcGuid(id)`). */
function mappedResourceId(
  resourceGuidMap: Map<string, string>, resourceIds: ReadonlySet<string>, writtenId: string,
): string | undefined {
  if (resourceIds.has(writtenId)) return writtenId;
  return resourceGuidMap.get(ifcGuid128(ifcObjectSeed('res', writtenId))) ?? resourceGuidMap.get(ifcGuid(writtenId));
}

/**
 * Interne fout van de archiefvalidator: draagt de gestructureerde reden. Verlaat deze module NOOIT —
 * `readXerArchiveOrIssue` vangt hem en zet hem om in een `XerArchiveIssue` op het `ImportResult`.
 */
class XerArchiveInvalid extends Error {
  readonly code: XerArchiveIssueCode;
  constructor(code: XerArchiveIssueCode, message: string) {
    super(message);
    this.name = 'XerArchiveInvalid';
    this.code = code;
    Object.setPrototypeOf(this, XerArchiveInvalid.prototype);
  }
}

interface XerArchiveRead {
  source?: XerSourceReconstruction;
  sourceProjectId?: string;
  xer?: XerImportMetadata;
  issue?: XerArchiveIssue;
}

/**
 * Lees archief + selector + selectorview als ÉÉN eenheid: slaagt één van de drie niet, dan valt
 * alles weg (een archief zonder geldige selector, of een selector zonder archief, is geen half
 * bruikbare herkomst maar een onbetrouwbare). Het resultaat is dan `{ issue }` — nooit een stille
 * lege uitkomst: `issue` is aanwezig zodra er archiefsporen waren en het archief ontbreekt.
 *
 * Wat hier NIET wordt afgevangen: een `IfcParseError` (de aanroeper-contractfout "compacte bron via
 * de synchrone ingang", zie `extractCompactXerSourceArchive`). Een ONVERWACHTE fout in de
 * archiefvalidatie (bv. een typed value die de pset-lezer niet kent) wordt wél een issue
 * (`structure`, met de oorspronkelijke melding als detail): ook dan mag de sidecar het project niet
 * gijzelen, en het signaal houdt de fout zichtbaar.
 */
function readXerArchiveOrIssue(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  options: IfcReadOptions,
): XerArchiveRead {
  try {
    const source = extractXerSourceArchive(entities, entityMap, options);
    const sourceProjectId = extractXerSourceProjectId(entities, entityMap, source?.archive);
    const xer = extractXerImportMetadata(source?.archive, sourceProjectId);
    return { source, sourceProjectId, xer };
  } catch (error) {
    if (error instanceof IfcParseError) throw error;
    if (error instanceof XerArchiveInvalid) return { issue: { code: error.code, detail: capXerArchiveDetail(error.message) } };
    return {
      issue: {
        code: 'structure',
        detail: capXerArchiveDetail(
          `Ongeldig OPS_XerSourceArchive: onverwachte fout bij het lezen: ${error instanceof Error ? error.message : String(error)}`,
        ),
      },
    };
  }
}

/** Bovengrens voor `XerArchiveIssue.detail`: de reden komt uit
 *  validator- of reconstructiefouten en kan bronfragmenten meeslepen; het detail landt in meldingen
 *  en logs, dus nooit onbegrensd. */
const XER_ARCHIVE_DETAIL_MAX = 500;
function capXerArchiveDetail(detail: string): string {
  return detail.length <= XER_ARCHIVE_DETAIL_MAX ? detail : `${detail.slice(0, XER_ARCHIVE_DETAIL_MAX - 1)}…`;
}

function extractXerImportMetadata(
  archive: XerSourceArchive | undefined, sourceProjectId: string | undefined,
): XerImportMetadata | undefined {
  if (!archive || !sourceProjectId) return undefined;
  try {
    return bindXerImportMetadataToArchive(archive, sourceProjectId);
  } catch (error) {
    xerArchiveError(error instanceof Error ? error.message : 'selectorview is ongeldig', 'metadata-invalid');
  }
}

function extractXerSourceProjectId(
  entities: StepEntity[], entityMap: Map<string, StepEntity>, archive: XerSourceArchive | undefined,
): string | undefined {
  const props = archiveProps(entities, entityMap, PSET.XerDocument);
  if (!props) {
    if (archive) xerArchiveError('OPS_XerDocument-selector ontbreekt');
    return undefined;
  }
  // Typisch voor andere IFC-software die de grote archief-pset liet vallen maar de kleine selector
  // meenam: de sporen zijn er, de bronbytes niet.
  if (!archive) xerArchiveError('OPS_XerDocument bestaat zonder OPS_XerSourceArchive', 'bytes-missing');
  if (JSON.stringify([...props.keys()]) !== JSON.stringify(['ArchiveSha256', 'SourceProjectId'])) {
    xerArchiveError('OPS_XerDocument-properties zijn niet exact en deterministisch geordend');
  }
  if (requiredString(props, 'ArchiveSha256') !== archive.sha256) xerArchiveError('selector ArchiveSha256 wijst niet naar het archief', 'hash-mismatch');
  return requiredString(props, 'SourceProjectId');
}

/** Het archief is onbruikbaar ⇒ gestructureerde, interne fout (zie `readXerArchiveOrIssue`).
 *  Default `structure`: pset-/propertyvorm; de specifiekere redenen geven hun code expliciet mee. */
function xerArchiveError(message: string, code: XerArchiveIssueCode = 'structure'): never {
  throw new XerArchiveInvalid(code, `Ongeldig OPS_XerSourceArchive: ${message}`);
}

function archiveProps(entities: StepEntity[], entityMap: Map<string, StepEntity>, psetName: string): Map<string, unknown> | undefined {
  const sets = entities.filter(entity => entity.type === 'IFCPROPERTYSET' && stripQuotes(entity.args[2] || '') === psetName);
  if (sets.length === 0) return undefined;
  if (sets.length !== 1) xerArchiveError(`Pset '${psetName}' komt ${sets.length} keer voor`);
  const projects = entities.filter(entity => entity.type === 'IFCPROJECT');
  if (projects.length !== 1) xerArchiveError(`Pset '${psetName}' vereist exact één IFCPROJECT; gevonden: ${projects.length}`);
  const project = projects[0]!;
  const attachments = entities.filter(entity =>
    entity.type === 'IFCRELDEFINESBYPROPERTIES'
    && parseRef(entity.args[5] || '') === sets[0]!.id,
  );
  if (!project || attachments.length !== 1
    || JSON.stringify(parseRefs(attachments[0]!.args[4] || '')) !== JSON.stringify([project.id])) {
    xerArchiveError(`Pset '${psetName}' hangt niet één-op-één aan IFCPROJECT`);
  }
  const values = new Map<string, unknown>();
  for (const ref of parseRefs(sets[0]!.args[4] || '')) {
    const prop = entityMap.get(ref);
    if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') xerArchiveError(`property '${ref}' ontbreekt of is geen single value`);
    const name = stripQuotes(prop.args[0] || '');
    if (!name || values.has(name)) xerArchiveError(`property '${name || ref}' ontbreekt of is dubbel`);
    values.set(name, parseTypedValue(prop.args[2] || ''));
  }
  return values;
}

function validateArchivePropertyOrder(
  props: Map<string, unknown>, manifestNames: readonly string[], chunkCount: number, diagnosticsCount: number,
): void {
  assertSourceBytesPresent(props, chunkCount);
  const propertyBudget = props.size - manifestNames.length;
  if (propertyBudget < 0
    || chunkCount > propertyBudget
    || diagnosticsCount > propertyBudget - chunkCount) {
    xerArchiveError('chunkcounts overschrijden het werkelijk aanwezige propertybudget', 'truncated');
  }
  if (chunkCount + diagnosticsCount !== propertyBudget) {
    xerArchiveError('chunkcounts passen niet exact bij het werkelijk aanwezige propertybudget', 'truncated');
  }
  let position = 0;
  for (const actual of props.keys()) {
    let expected: string;
    if (position < manifestNames.length) {
      expected = manifestNames[position]!;
    } else if (position < manifestNames.length + chunkCount) {
      expected = `ByteChunk${String(position - manifestNames.length).padStart(6, '0')}`;
    } else {
      expected = `DiagnosticsChunk${String(position - manifestNames.length - chunkCount).padStart(6, '0')}`;
    }
    if (actual !== expected) xerArchiveError('properties zijn niet uniek en deterministisch geordend');
    position += 1;
  }
}

function validateCompactArchivePropertyOrder(
  props: Map<string, unknown>, manifestNames: readonly string[], chunkCount: number,
): void {
  assertSourceBytesPresent(props, chunkCount);
  const propertyBudget = props.size - manifestNames.length;
  if (propertyBudget < 0 || chunkCount !== propertyBudget) {
    xerArchiveError('chunkcount past niet exact bij het werkelijk aanwezige propertybudget', 'truncated');
  }
  let position = 0;
  for (const actual of props.keys()) {
    const expected = position < manifestNames.length
      ? manifestNames[position]!
      : `ByteChunk${String(position - manifestNames.length).padStart(6, '0')}`;
    if (actual !== expected) xerArchiveError('properties zijn niet uniek en deterministisch geordend');
    position += 1;
  }
}

/** Het manifest belooft bronbytes, maar er staat GEEN ENKELE `ByteChunk######`-property: niet
 *  afgeknot maar weggelaten — het kenmerk van een herschrijvend IFC-programma dat grote
 *  tekstwaarden laat vallen. Apart van `truncated` (een deel is er nog wel). */
function assertSourceBytesPresent(props: Map<string, unknown>, chunkCount: number): void {
  if (chunkCount === 0) return;
  for (const name of props.keys()) if (/^ByteChunk\d{6}$/.test(name)) return;
  xerArchiveError(`manifest belooft ${chunkCount} bronchunk(s), maar er is er geen enkele aanwezig`, 'bytes-missing');
}

function nonNegativeSafeInteger(value: unknown, name: string, code: XerArchiveIssueCode = 'structure'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) xerArchiveError(`${name} is geen niet-negatief safe integer`, code);
  return value;
}

function requiredString(props: Map<string, unknown>, name: string, code: XerArchiveIssueCode = 'structure'): string {
  const value = props.get(name);
  if (typeof value !== 'string' || !value) xerArchiveError(`${name} ontbreekt of is geen tekenreeks`, code);
  return value;
}

function concatArchiveChunks(props: Map<string, unknown>, prefix: string, count: number, expectedLength: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (let index = 0; index < count; index++) {
    const name = `${prefix}${String(index).padStart(6, '0')}`;
    const raw = requiredString(props, name, 'truncated');
    if (index < count - 1 && raw.includes('=')) xerArchiveError(`${name} bevat verboden base64-padding vóór de laatste chunk`);
    let decoded: Uint8Array;
    try { decoded = decodeXerBase64Chunk(raw); } catch { xerArchiveError(`${name} bevat ongeldige base64`); }
    const expectedChunkLength = index === count - 1 ? expectedLength - index * XER_SOURCE_ARCHIVE_CHUNK_BYTES : XER_SOURCE_ARCHIVE_CHUNK_BYTES;
    if (decoded.length !== expectedChunkLength) xerArchiveError(`${name} heeft ${decoded.length} i.p.v. ${expectedChunkLength} bytes`, 'truncated');
    chunks.push(decoded);
  }
  for (const name of props.keys()) {
    if (!name.startsWith(prefix)) continue;
    if (name === `${prefix}Size` || name === `${prefix}Count`) continue;
    const suffix = name.slice(prefix.length);
    if (!/^\d{6}$/.test(suffix) || Number(suffix) >= count) xerArchiveError(`${name} ligt buiten de aaneengesloten chunkreeks`);
  }
  let output: Uint8Array;
  try { output = new Uint8Array(expectedLength); } catch { xerArchiveError('byteLength kan op dit platform niet worden gealloceerd'); }
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

/** Lees en valideer vóór allocatie de self-contained XER-bronarchiefcontainer; afwezig blijft
 *  legacy-compatibel. Levert de volledige `XerSourceReconstruction`; de schema-1-tak draagt geen vastlegging
 *  (zie de bekende grens bij `XerArchiveReconstructor`) en geeft daar een lege map bij. */
function extractXerSourceArchive(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  options: IfcReadOptions,
): XerSourceReconstruction | undefined {
  const props = archiveProps(entities, entityMap, PSET.XerSourceArchive);
  if (!props) return undefined;
  const schemaVersion = nonNegativeSafeInteger(props.get('SchemaVersion'), 'SchemaVersion', 'schema-version');
  if (schemaVersion === XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION) {
    return extractCompactXerSourceArchive(props, options.reconstructXerArchive);
  }
  if (schemaVersion === XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_SCHEMA_VERSION) {
    return extractReferencedXerSourceArchive(props, options);
  }
  if (schemaVersion !== XER_SOURCE_ARCHIVE_SCHEMA_VERSION) xerArchiveError(`onbekend SchemaVersion ${schemaVersion}`, 'schema-version');
  if (requiredString(props, 'Format', 'schema-version') !== 'primavera-p6-xer') xerArchiveError('Format is niet primavera-p6-xer', 'schema-version');
  const byteLength = nonNegativeSafeInteger(props.get('ByteLength'), 'ByteLength');
  const chunkSize = nonNegativeSafeInteger(props.get('ByteChunkSize'), 'ByteChunkSize');
  if (chunkSize !== XER_SOURCE_ARCHIVE_CHUNK_BYTES) xerArchiveError(`ByteChunkSize is niet ${XER_SOURCE_ARCHIVE_CHUNK_BYTES}`);
  const chunkCount = nonNegativeSafeInteger(props.get('ByteChunkCount'), 'ByteChunkCount');
  if (chunkCount !== Math.ceil(byteLength / chunkSize)) xerArchiveError('ByteChunkCount past niet bij ByteLength', 'truncated');
  const diagnosticsLength = nonNegativeSafeInteger(props.get('DiagnosticsByteLength'), 'DiagnosticsByteLength');
  const diagnosticsCount = nonNegativeSafeInteger(props.get('DiagnosticsChunkCount'), 'DiagnosticsChunkCount');
  if (diagnosticsCount !== Math.ceil(diagnosticsLength / chunkSize)) xerArchiveError('DiagnosticsChunkCount past niet bij DiagnosticsByteLength', 'truncated');
  const manifestNames = [
    'SchemaVersion', 'Format', 'ByteLength', 'Sha256', 'Encoding', 'Bom', 'Newline',
    'ByteChunkSize', 'ByteChunkCount', 'DiagnosticsByteLength', 'DiagnosticsSha256', 'DiagnosticsChunkCount',
  ];
  validateArchivePropertyOrder(props, manifestNames, chunkCount, diagnosticsCount);
  const sourceBytes = concatArchiveChunks(props, 'ByteChunk', chunkCount, byteLength);
  const diagnosticBytes = concatArchiveChunks(props, 'DiagnosticsChunk', diagnosticsCount, diagnosticsLength);
  const sourceHash = requiredString(props, 'Sha256');
  const diagnosticsHash = requiredString(props, 'DiagnosticsSha256');
  if (!/^[0-9a-f]{64}$/.test(sourceHash) || sha256Hex(sourceBytes) !== sourceHash) xerArchiveError('Sha256 is ongeldig of past niet bij de bytes', 'hash-mismatch');
  if (!/^[0-9a-f]{64}$/.test(diagnosticsHash) || sha256Hex(diagnosticBytes) !== diagnosticsHash) xerArchiveError('DiagnosticsSha256 is ongeldig of past niet bij de diagnostics', 'hash-mismatch');
  let archiveMetadata: XerArchiveMetadataPayloadV1;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(diagnosticBytes));
    archiveMetadata = parseXerArchiveMetadataPayload(parsed);
  } catch (error) {
    if (error instanceof XerArchiveInvalid) throw error;
    xerArchiveError(`diagnostics/readmodel is ongeldig: ${error instanceof Error ? error.message : 'geen geldige JSON'}`, 'metadata-invalid');
  }
  const encoding = requiredString(props, 'Encoding');
  const bom = requiredString(props, 'Bom');
  const newline = requiredString(props, 'Newline');
  if (!(['utf-8', 'utf-16le', 'utf-16be', 'windows-1252'] as readonly string[]).includes(encoding)) xerArchiveError('Encoding is onbekend', 'metadata-invalid');
  if (!(['none', 'utf-8', 'utf-16le', 'utf-16be'] as readonly string[]).includes(bom)) xerArchiveError('Bom is onbekend', 'metadata-invalid');
  if (!(['lf', 'crlf', 'cr', 'mixed', 'none'] as readonly string[]).includes(newline)) xerArchiveError('Newline is onbekend', 'metadata-invalid');
  try {
    // Schema 1 draagt geen vastlegging (bak 4): het leesmodel bewaart de TASK-bronrijen wél, maar de
    // omrekening ervan vraagt de XER-kalender-/getallaag, en dit pad loopt bewust ZONDER die chunk.
    return {
      archive: createXerSourceArchiveFromOwnedMetadata(sourceBytes, {
        schemaVersion,
        encoding: encoding as XerSourceArchiveEncoding,
        bom: bom as XerSourceArchiveBom,
        newline: newline as XerSourceArchiveNewline,
        diagnostics: archiveMetadata.diagnostics,
        readModel: archiveMetadata.readModel,
      }),
      recordedTimesByProject: {},
    };
  } catch (error) {
    xerArchiveError(`diagnostics/readmodel kon niet worden opgebouwd: ${error instanceof Error ? error.message : String(error)}`, 'metadata-invalid');
  }
}

/**
 * Schema 3 = crashherstel-verwijzing: de pset noemt alleen lengte en SHA-256; de bytes komen uit de
 * crashherstelopslag via `resolveXerArchiveReference`. Daarna exact dezelfde poorten als schema 2
 * (lengte, hash, reconstructie). Een ontbrekende blob is `bytes-missing`: het document opent zonder
 * archief en met melding, nooit stil en nooit geblokkeerd.
 */
function extractReferencedXerSourceArchive(
  props: Map<string, unknown>,
  options: IfcReadOptions,
): XerSourceReconstruction {
  if (requiredString(props, 'Format', 'schema-version') !== 'primavera-p6-xer') xerArchiveError('Format is niet primavera-p6-xer', 'schema-version');
  if (requiredString(props, 'StorageFormat', 'schema-version') !== XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT) {
    xerArchiveError('StorageFormat is onbekend', 'schema-version');
  }
  const expected = ['SchemaVersion', 'Format', 'StorageFormat', 'ByteLength', 'Sha256'];
  if (JSON.stringify([...props.keys()]) !== JSON.stringify(expected)) {
    xerArchiveError('properties van de archiefverwijzing zijn niet exact en deterministisch geordend');
  }
  const byteLength = nonNegativeSafeInteger(props.get('ByteLength'), 'ByteLength');
  const sourceHash = requiredString(props, 'Sha256');
  if (!/^[0-9a-f]{64}$/.test(sourceHash)) xerArchiveError('Sha256 is ongeldig', 'hash-mismatch');
  const sourceBytes = options.resolveXerArchiveReference?.(sourceHash);
  if (!sourceBytes) {
    xerArchiveError('de crashherstelopslag heeft geen archiefblob voor deze verwijzing', 'bytes-missing');
  }
  if (sourceBytes.byteLength !== byteLength) {
    xerArchiveError(`archiefblob heeft ${sourceBytes.byteLength} i.p.v. ${byteLength} bytes`, 'truncated');
  }
  if (sha256Hex(sourceBytes) !== sourceHash) xerArchiveError('archiefblob past niet bij Sha256', 'hash-mismatch');
  return reconstructVerifiedXerSource(sourceBytes, byteLength, sourceHash, options.reconstructXerArchive);
}

/** Schema 2 bevat alleen de bronbytes. Alle afleidbare caches herleven uit die bron. */
function extractCompactXerSourceArchive(
  props: Map<string, unknown>,
  reconstructXerArchive: XerArchiveReconstructor | undefined,
): XerSourceReconstruction {
  if (requiredString(props, 'Format', 'schema-version') !== 'primavera-p6-xer') xerArchiveError('Format is niet primavera-p6-xer', 'schema-version');
  if (requiredString(props, 'StorageFormat', 'schema-version') !== XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT) {
    xerArchiveError('StorageFormat is onbekend', 'schema-version');
  }
  const byteLength = nonNegativeSafeInteger(props.get('ByteLength'), 'ByteLength');
  const chunkSize = nonNegativeSafeInteger(props.get('ByteChunkSize'), 'ByteChunkSize');
  if (chunkSize !== XER_SOURCE_ARCHIVE_CHUNK_BYTES) xerArchiveError(`ByteChunkSize is niet ${XER_SOURCE_ARCHIVE_CHUNK_BYTES}`);
  const chunkCount = nonNegativeSafeInteger(props.get('ByteChunkCount'), 'ByteChunkCount');
  if (chunkCount !== Math.ceil(byteLength / chunkSize)) xerArchiveError('ByteChunkCount past niet bij ByteLength', 'truncated');
  const manifestNames = [
    'SchemaVersion', 'Format', 'StorageFormat', 'ByteLength', 'Sha256', 'ByteChunkSize', 'ByteChunkCount',
  ];
  validateCompactArchivePropertyOrder(props, manifestNames, chunkCount);
  const sourceBytes = concatArchiveChunks(props, 'ByteChunk', chunkCount, byteLength);
  const sourceHash = requiredString(props, 'Sha256');
  if (!/^[0-9a-f]{64}$/.test(sourceHash) || sha256Hex(sourceBytes) !== sourceHash) {
    xerArchiveError('Sha256 is ongeldig of past niet bij de bytes', 'hash-mismatch');
  }
  return reconstructVerifiedXerSource(sourceBytes, byteLength, sourceHash, reconstructXerArchive);
}

/** Gedeelde staart van schema 2 en 3: de bytes zijn al op lengte en SHA-256 gecontroleerd. */
function reconstructVerifiedXerSource(
  sourceBytes: Uint8Array,
  byteLength: number,
  sourceHash: string,
  reconstructXerArchive: XerArchiveReconstructor | undefined,
): XerSourceReconstruction {
  if (!reconstructXerArchive) {
    // GEEN archieffout maar een AANROEPERcontractfout: de lage synchrone ingang laadt de lazy
    // XER-chunk bewust niet. Dat is geen eigenschap van het bestand, dus ook geen reden om het
    // archief stil te laten vallen — `readXerArchiveOrIssue` laat deze fout door.
    throw new IfcParseError(
      'xer-source-archive',
      'Ongeldig OPS_XerSourceArchive: compacte bron vereist readIFCWithXerReconstruction; de lage ' +
      'synchrone readIFC-ingang laadt de XER-reader bewust niet zelf',
    );
  }
  let reconstruction: XerSourceReconstruction;
  try {
    reconstruction = reconstructXerArchive(sourceBytes);
  } catch (error) {
    xerArchiveError(`compacte bron kon niet worden gereconstrueerd: ${error instanceof Error ? error.message : String(error)}`, 'metadata-invalid');
  }
  const archive = reconstruction.archive;
  if (archive.sha256 !== sourceHash || archive.byteLength !== byteLength) {
    xerArchiveError('gereconstrueerd archief past niet bij de canonieke bronbytes', 'hash-mismatch');
  }
  // De hashpoort hierboven geldt daarmee ook voor `recordedTimesByProject`: die map komt uit
  // dezelfde `readXER` over dezelfde, geverifieerde bytes.
  return reconstruction;
}

// ── STEP-tekstscan: één quote-bewuste toestandsmachine voor álle lagen ──────────────────────────
// Sectiegrens, commentaar-strip en entiteitsgrens moeten allemaal quote-bewust zijn: `);`, `(…)`,
// `/* */` en zelfs `ENDSEC;` zijn normale Nederlandse plantekst ("Fase 1 (ruwbouw); fase 2"). Een
// quote-blinde laag kapt stil planningsdata af — een afgekapte IFCTASK verliest zijn TaskTime-ref en
// valt terug op de DEFAULT-duur, zodat de planning bij opslaan en heropenen zonder signaal verandert.
// Alle lagen draaien daarom op `skipQuotedOrComment` hieronder. De scan blijft lineair: één pas
// over de tekst, geen index of terugsprongen.

const CH_QUOTE = 39;   // '
const CH_STAR = 42;    // *
const CH_SLASH = 47;   // /
const CH_HASH = 35;    // #
const CH_LPAREN = 40;  // (
const CH_RPAREN = 41;  // )
const CH_SEMI = 59;    // ;
const CH_EQ = 61;      // =
const CH_E = 69;       // E

/** Woordteken (`\w`): letters, cijfers, `_`. */
function isWordCode(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
}
/** Witruimte (`\s`, ASCII-deel — STEP kent geen unicode-witruimte buiten strings). */
function isSpaceCode(c: number): boolean {
  return c === 32 || (c >= 9 && c <= 13);
}

/**
 * DÉ plek waar de STEP-quoteregels worden geïnterpreteerd. Staat `i` op het begin van een
 * stringliteral (`'…'`, met `''` als ontsnapte apostrof — precies wat `splitArgs` en `stripQuotes`
 * al aanhouden) of van een `/* … *\/`-commentaar, geef dan de index DIRECT ERNA; anders `-1`.
 * Een niet-afgesloten string/commentaar loopt door tot het einde van de tekst (tolerant).
 */
function skipQuotedOrComment(text: string, i: number): number {
  const c = text.charCodeAt(i);
  if (c === CH_QUOTE) {
    for (let j = i + 1; j < text.length; j++) {
      if (text.charCodeAt(j) !== CH_QUOTE) continue;
      if (text.charCodeAt(j + 1) === CH_QUOTE) { j++; continue; } // '' = ontsnapte apostrof
      return j + 1;
    }
    return text.length;
  }
  if (c === CH_SLASH && text.charCodeAt(i + 1) === CH_STAR) {
    const end = text.indexOf('*/', i + 2);
    return end < 0 ? text.length : end + 2;
  }
  return -1;
}

/** ASCII-hoofdletterongevoelige match van `token` (zélf in hoofdletters) op positie `i`. Geen
 *  `toUpperCase()` over de hele tekst: bestanden zijn megabytes groot en dat zou een kopie maken. */
function startsWithTokenCI(text: string, i: number, token: string): boolean {
  for (let k = 0; k < token.length; k++) {
    let c = text.charCodeAt(i + k);
    if (c >= 0x61 && c <= 0x7a) c -= 0x20; // a-z → A-Z
    if (c !== token.charCodeAt(k)) return false;
  }
  return true;
}

/** Zoek `token` (in hoofdletters aangeleverd) op CODE-niveau: voorkomens binnen een stringliteral
 *  of commentaar tellen niet mee. ASCII-hoofdletterongevoelig — STEP-sleutelwoorden zijn
 *  case-insensitief, en `assertIfcIntegrity` accepteert kleine letters al (kop/sluitmarkering),
 *  dus de sectiegrens moet dat ook (een bestand met `data;` viel er anders alsnog doorheen). */
function indexOfCode(text: string, token: string, from: number): number {
  const first = token.charCodeAt(0);
  for (let i = from; i < text.length;) {
    let c = text.charCodeAt(i);
    if (c === CH_QUOTE || c === CH_SLASH) {
      const skip = skipQuotedOrComment(text, i);
      if (skip >= 0) { i = skip; continue; }
    }
    if (c >= 0x61 && c <= 0x7a) c -= 0x20; // a-z → A-Z
    if (c === first && startsWithTokenCI(text, i, token)) return i;
    i++;
  }
  return -1;
}

/** Verwijder `/* … *\/`-commentaar, maar uitsluitend BUITEN stringliterals. Geen commentaar in de
 *  tekst (het gangbare geval — onze eigen writer schrijft er geen) ⇒ de tekst gaat onaangeroerd
 *  terug, zonder kopie. */
function stripStepComments(text: string): string {
  if (text.indexOf('/*') < 0) return text;
  let out = '';
  let copiedFrom = 0;
  for (let i = 0; i < text.length;) {
    const c = text.charCodeAt(i);
    if (c === CH_QUOTE) { i = skipQuotedOrComment(text, i); continue; } // string verbatim houden
    if (c === CH_SLASH && text.charCodeAt(i + 1) === CH_STAR) {
      out += text.slice(copiedFrom, i);
      i = skipQuotedOrComment(text, i);
      copiedFrom = i;
      continue;
    }
    i++;
  }
  return out + text.slice(copiedFrom);
}

/**
 * Lees één `#id=TYPE(args);` vanaf `at` en zet 'm in `out`. Geeft de index NÁ de puntkomma terug,
 * of `-1` als het geen complete entiteit is — dan schuift de scan één teken op over onbegrepen
 * tekst. De sluithaak wordt op HAAKDIEPTE gezocht met `skipQuotedOrComment` erlangs, zodat een `);`
 * binnen een taaknaam of notitie de entiteit niet afkapt.
 */
function readEntity(text: string, at: number, out: StepEntity[]): number {
  const n = text.length;
  let i = at + 1;
  const idStart = i;
  while (i < n && isWordCode(text.charCodeAt(i))) i++;
  if (i === idStart) return -1;
  const id = text.slice(idStart, i);

  while (i < n && isSpaceCode(text.charCodeAt(i))) i++;
  if (text.charCodeAt(i) !== CH_EQ) return -1;
  i++;
  while (i < n && isSpaceCode(text.charCodeAt(i))) i++;

  const typeStart = i;
  while (i < n && isWordCode(text.charCodeAt(i))) i++;
  if (i === typeStart) return -1;
  const type = text.slice(typeStart, i);

  while (i < n && isSpaceCode(text.charCodeAt(i))) i++;
  if (text.charCodeAt(i) !== CH_LPAREN) return -1;
  const argsStart = i + 1;

  let depth = 0;
  let argsEnd = -1;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === CH_QUOTE || c === CH_SLASH) {
      const skip = skipQuotedOrComment(text, i);
      if (skip >= 0) { i = skip; continue; }
    }
    if (c === CH_LPAREN) depth++;
    else if (c === CH_RPAREN) {
      depth--;
      if (depth === 0) { argsEnd = i; i++; break; }
    }
    i++;
  }
  if (argsEnd < 0) return -1;

  while (i < n && isSpaceCode(text.charCodeAt(i))) i++;
  if (text.charCodeAt(i) !== CH_SEMI) return -1;
  i++;

  out.push({
    id,
    type: type.toUpperCase(),
    args: splitArgs(text.slice(argsStart, argsEnd)),
    raw: text.slice(at, i),
  });
  return i;
}

/**
 * Begin van de datasectie: de offset van het `DATA;`-token dat de sectiegrens vormt, of −1.
 *
 * TWEE POGINGEN, in deze volgorde — de volgorde is essentieel.
 *
 *  1. **Quote- en commentaar-bewust** (`indexOfCode`): juist voor élk syntactisch geldig
 *     STEP-bestand — slaat `DATA;` in een header-string of `/* … *\/` over en is ongevoelig voor
 *     opmaak (geen regeleindes, `ENDSEC;DATA;` op één regel, form feed/NBSP vóór het token).
 *  2. **Regel-verankerd**, alleen als (1) niets vond: LEGACY-bestanden waarin oudere versies van onze
 *     writer naam/auteur/bedrijf rauw in `FILE_NAME(...)` zetten ("Van 't Hof Toren" ⇒
 *     ONGEBALANCEERDE apostrof). De quote-bewuste scan loopt daar uit de pas ⇒ zonder terugval stil
 *     een leeg project.
 *
 * Niet andersom: regelverankering als PRIMAIRE scan weigert geldige bestanden uit (1) en pikt een
 * `DATA;` op aan het begin van een regel binnen een commentaar of een header-string met een echt
 * regeleinde (nul entiteiten zónder fout, of verzonnen entiteiten uit commentaar). Beide gevallen zijn
 * getest in `check-step-strings` (9f–9k).
 */
function indexOfDataSection(content: string): number {
  const strict = indexOfCode(content, 'DATA;', 0);
  if (strict >= 0) return strict;
  // `i`-vlag: zelfde hoofdletterongevoeligheid als de primaire scan (en als `assertIfcIntegrity`).
  const anchored = /^[ \t]*DATA;/im.exec(content);
  return anchored ? anchored.index + anchored[0].toUpperCase().indexOf('DATA;') : -1;
}

function parseSTEP(content: string): StepEntity[] {
  const entities: StepEntity[] = [];
  // 1. Begin van de datasectie — een `DATA;` binnen de FILE_NAME-string van de header telt niet mee.
  const dataAt = indexOfDataSection(content);
  // Geen sectiegrens ⇒ getypeerde fout, GEEN leeg resultaat. `openFile`/`useRecoveryRestore` tonen
  // dan de leesfout in plaats van een leeg document te openen bovenop het pad van de gebruiker.
  if (dataAt < 0) {
    throw new IfcParseError(
      'no-data-section',
      "Onleesbaar IFC-bestand: de verplichte 'DATA;'-sectiegrens ontbreekt.",
    );
  }

  // 2. Commentaar strippen (buiten strings). Regeleindes NIET normaliseren: de tokenizer behandelt \r al
  //    als witruimte, en een globale \r\n → \n-vervanging veranderde ook de tekst BINNEN strings (een
  //    notitie of naam met Windows-regeleinden kwam na opslaan en openen anders terug).
  const clean = stripStepComments(content.slice(dataAt + 'DATA;'.length));

  // 3. Entiteiten (`#123=IFCTYPE(...);`, ook `#300T=IFCTASKTIME(...);`). Het afsluitende `ENDSEC;`
  //    van de datasectie wordt hier op CODE-niveau herkend — ongevoelig voor `ENDSEC;` in een
  //    taaknaam. Één pas, geen aparte zoek-pas over de sectie.
  for (let i = 0; i < clean.length;) {
    const c = clean.charCodeAt(i);
    if (c === CH_QUOTE) { i = skipQuotedOrComment(clean, i); continue; }
    if (c === CH_HASH) {
      const next = readEntity(clean, i, entities);
      i = next > 0 ? next : i + 1;
      continue;
    }
    if (c === CH_E && clean.startsWith('ENDSEC;', i)) break;
    i++;
  }

  return entities;
}

/**
 * Het schema uit de kop zoals het er staat: de eerste naam in `FILE_SCHEMA(('…'))`, in hoofdletters
 * (`cleanIfcSchemaName`), ook als de app dat schema niet schrijft (IFC2X3); geen of een vreemde naam ⇒
 * `undefined`. Quote-bewust gezocht, want een projectnaam in `FILE_NAME` kan die tekst bevatten. Oude
 * eigen bestanden met een ongebalanceerde apostrof in `FILE_NAME` (zie `indexOfDataSection`) vallen
 * terug op een regel-verankerde match.
 */
export function readFileSchemaName(content: string): string | undefined {
  const dataAt = indexOfDataSection(content);
  const header = dataAt >= 0 ? content.slice(0, dataAt) : content;
  let name: string | undefined;
  const at = indexOfCode(header, 'FILE_SCHEMA', 0);
  if (at >= 0) {
    const m = /^FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i.exec(header.slice(at));
    name = m?.[1];
  }
  if (name === undefined) name = /^[ \t]*FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/im.exec(header)?.[1];
  return cleanIfcSchemaName(name);
}

/** Het schema uit de kop, alleen als het een van de drie is die de writer kan schrijven
 *  (`IFC_SCHEMAS`); anders `undefined` (issue #292). Zie `readFileSchemaName`. */
export function readFileSchema(content: string): IfcSchemaId | undefined {
  const name = readFileSchemaName(content);
  return isIfcSchemaId(name) ? name : undefined;
}

/** Is deze IFCWORKSCHEDULE een baseline (PredefinedType `.BASELINE.`)? De positie hangt af van de
 *  argumenten: 13 in het schema (en WorkControlType in IFC2X3), 14 in bestanden van oudere OPS-versies
 *  (`workControlSlots`). */
function isBaselineSchedule(e: StepEntity): boolean {
  return (e.args[workControlSlots(e.args).predefinedType] || '').includes('BASELINE');
}

/** Split IFC arguments respecting nested parentheses and quotes */
function splitArgs(argsStr: string): string[] {
  // Elk argument is een aaneengesloten deel van `argsStr` (tekens worden nooit omgezet, ook `''` niet),
  // dus snijden i.p.v. teken voor teken een string opbouwen.
  const args: string[] = [];
  let segStart = 0;
  let depth = 0;
  let inString = false;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === "'" && !inString) {
      inString = true;
    } else if (ch === "'" && inString) {
      if (i + 1 < argsStr.length && argsStr[i + 1] === "'") i++;
      else inString = false;
    } else if (inString) {
      // teken binnen een string
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push(argsStr.slice(segStart, i).trim());
      segStart = i + 1;
    }
  }
  const tail = argsStr.slice(segStart).trim();
  if (tail) args.push(tail);
  return args;
}

/**
 * Zijn de stringliterals in dit bestand volgens ISO 10303-21 gecodeerd? Alleen onze eigen writer
 * schreef vroeger letterlijk (een `\` of `é` stond er rauw in); die bestanden dragen
 * IFCAPPLICATION.Version '0.1', of hebben alleen `OPS_`-psets zonder IFCAPPLICATION. Hen decoderen
 * zou een letterlijke `\\` in bv. een JSON-pset halveren en die JSON breken. Elk ander bestand, ook
 * dat van een ander pakket, volgt de norm.
 */
function stringsAreStepEncoded(entities: StepEntity[]): boolean {
  for (const e of entities) {
    if (e.type === 'IFCAPPLICATION' && stripQuotes(e.args[3] || '') === 'OPS') {
      return stripQuotes(e.args[1] || '') !== OPS_LEGACY_LITERAL_APP_VERSION;
    }
  }
  return !isOpsAuthoredIfc(entities);
}

/** Decodeer in place elke stringliteral in de argumenten; de apostrof blijft `''`-verdubbeld, zodat
 *  alle bestaande lezers (`stripQuotes`, `splitArgs`) ongewijzigd werken. Alleen argumenten met een
 *  backslash kunnen iets gecodeerd bevatten. */
function decodeEntityStrings(entities: StepEntity[]): void {
  for (const e of entities) {
    const args = e.args;
    for (let k = 0; k < args.length; k++) {
      if (args[k].indexOf('\\') >= 0) args[k] = decodeQuotedSegments(args[k]);
    }
  }
}

function decodeQuotedSegments(arg: string): string {
  let out = '';
  let i = 0;
  while (i < arg.length) {
    const open = arg.indexOf("'", i);
    if (open < 0) { out += arg.slice(i); break; }
    out += arg.slice(i, open + 1);
    let j = open + 1;
    for (;;) {
      const q = arg.indexOf("'", j);
      if (q < 0) { j = arg.length; break; }
      if (arg.charCodeAt(q + 1) === CH_QUOTE) { j = q + 2; continue; }
      j = q;
      break;
    }
    const body = arg.slice(open + 1, j);
    out += body.indexOf('\\') >= 0
      ? decodeStepText(body.replace(/''/g, "'")).replace(/'/g, "''")
      : body;
    if (j < arg.length) out += "'";
    i = j + 1;
  }
  return out;
}

const HEX4 = /^[0-9A-Fa-f]{4}$/;
const HEX8 = /^[0-9A-Fa-f]{8}$/;

/**
 * STEP-stringinhoud (zonder de omsluitende quotes, `''` al samengevoegd) terug naar tekst:
 * `\\` → `\`, `\X2\hhhh…\X0\` (UTF-16), `\X4\hhhhhhhh…\X0\` (codepunten), `\X\hh` (ISO 8859-1)
 * en `\S\c` (teken + 128). `\Px\` (codetabelkeuze) wordt weggelaten; de lezer neemt voor `\S\`
 * altijd ISO 8859-1 aan. Een onbekende reeks blijft letterlijk staan. Tegenhanger van
 * `encodeStepText` (ifcPsets).
 */
export function decodeStepText(s: string): string {
  if (s.indexOf('\\') < 0) return s;
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const b = s.indexOf('\\', i);
    if (b < 0) { out += s.slice(i); break; }
    out += s.slice(i, b);
    i = b;
    if (s.startsWith('\\\\', i)) { out += '\\'; i += 2; continue; }
    if (s.startsWith('\\X2\\', i) || s.startsWith('\\X4\\', i)) {
      const width = s[i + 2] === '2' ? 4 : 8;
      const end = s.indexOf('\\X0\\', i + 4);
      const hexRun = end >= 0 ? s.slice(i + 4, end) : '';
      const pattern = width === 4 ? HEX4 : HEX8;
      let decoded = '';
      let valid = end >= 0 && hexRun.length % width === 0;
      for (let k = 0; valid && k < hexRun.length; k += width) {
        const h = hexRun.slice(k, k + width);
        if (!pattern.test(h)) { valid = false; break; }
        const v = parseInt(h, 16);
        if (width === 8 && v > 0x10FFFF) { valid = false; break; }
        decoded += width === 4 ? String.fromCharCode(v) : String.fromCodePoint(v);
      }
      if (valid) { out += decoded; i = end + 4; continue; }
    } else if (s.startsWith('\\X\\', i) && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 3, i + 5))) {
      out += String.fromCharCode(parseInt(s.slice(i + 3, i + 5), 16));
      i += 5;
      continue;
    } else if (s.startsWith('\\S\\', i) && i + 3 < n) {
      out += String.fromCharCode(s.charCodeAt(i + 3) + 128);
      i += 4;
      continue;
    } else if (s[i + 1] === 'P' && s[i + 3] === '\\' && /[A-I]/.test(s[i + 2] ?? '')) {
      i += 4;
      continue;
    }
    out += '\\';
    i++;
  }
  return out;
}

function stripQuotes(s: string): string {
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

/** Optionele tekst uit een IFC-slot: `$`/leeg/afwezig ⇒ '' (nooit een letterlijke '$').
 *  Gebruikt voor slots waar de writer bewust `$` schrijft als het veld leeg is (bv. project-
 *  omschrijving, IFCPERSON.FamilyName). */
function ifcSlotText(s: string | undefined): string {
  if (!s || s === '$') return '';
  return stripQuotes(s);
}

function parseRef(s: string): string | null {
  const m = s.trim().match(/^#(\w+)$/);
  return m ? m[1] : null;
}

function parseRefs(s: string): string[] {
  const refs: string[] = [];
  const matches = s.matchAll(/#(\w+)/g);
  for (const m of matches) {
    refs.push(m[1]);
  }
  return refs;
}

// Datum-parse: BEWUST niet gedeeld met MSPDI/P6/CSV. Deze variant handelt eerst de
// STEP-quoting (`stripQuotes`) en de `$`-null-conventie af en houdt de exacte lege-tail-semantiek
// (een quoted-lege slot geeft '' terug, niet vandaag) — dat is STEP-specifiek en mag niet verschuiven.
function parseDateFromIFC(s: string): string {
  if (!s || s === '$') return localTodayIso();
  const clean = stripQuotes(s);
  // Extract just the date part
  return clean.substring(0, 10);
}

function parseDurationDays(s: string, hoursPerDay: number): number {
  if (!s || s === '$') return 0;
  const clean = stripQuotes(s);
  // Parse ISO 8601 duration: P0Y0M5D of P5D of PT8H. Negatief kan op twee manieren voorkomen:
  // standaardconform met voorloopteken vóór de P ('-P2D', zo schrijven wij een lead) of als
  // app-interne legacy-notatie met het teken bij het getal ('P0Y0M-2D'). Beide lezen.
  // Het getal mag een decimale fractie hebben (ISO 8601 staat die toe op de kleinste component, en
  // onze writer schrijft een fractionele dag als `P0Y0M2.5D`); een kaal `(\d+)` pakt bij `2.5D`
  // alleen de cijfers ná de punt. De exponent is er alleen voor oudere bestanden zonder
  // writer-afronding (`1e-7` mag geen −7 worden); een getal
  // dat daardoor niet eindig is (`1e999`) telt als 0. Decimaalkomma bewust niet: `isoDurationToMinutes`
  // leest die ook niet, en een van beide laten afwijken zou `PT4,5H` per pad anders lezen.
  const leadingNeg = clean.startsWith('-');
  const applySign = (n: number) => (leadingNeg && n > 0 ? -n : n);
  const dayMatch = clean.match(/(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)D/);
  if (dayMatch) {
    const d = parseFloat(dayMatch[1]);
    return Number.isFinite(d) ? applySign(d) : 0;
  }
  const hourMatch = clean.match(/(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)H/);
  if (hourMatch) {
    const h = parseFloat(hourMatch[1]);
    if (!Number.isFinite(h)) return 0;
    // Kale `PT{n}H` (andermans bestand) ⇒ werkdagen van de meegegeven kalender, niet van een vaste 8
    // (zoals de MSPDI-lezer).
    return applySign(h < 0 ? -Math.ceil(-h / hoursPerDay) : Math.ceil(h / hoursPerDay));
  }
  return 0;
}

/**
 * Het dag-deel (`P{d}D`, VÓÓR een eventuele `T`) van een ISO-8601-duur, in minuten. Bewust LOKAAL
 * (niet in `subdayIo.ts`'s `isoDurationToMinutes`, die andere aanroepers heeft): alleen voor de
 * verdedigende lag-leestak hierboven, voor bestanden van andere tools — onze eigen schrijver
 * (`minutesToIsoDuration`) emitteert nooit een dag-component vóór `T`.
 *
 * Geïnterpreteerd als KALENDERTIJD (1D = 1440 minuten), niet als werkdag × hoursPerDay: ISO 8601 is
 * kalendertijd (`CPMSolver.resolveElapsedMinutes` rekent een ELAPSEDTIME-dag-lag ook ×24×60), en de
 * kalender van de voorganger is hier nog niet bekend (sequences worden vóór de kalendertoewijzing
 * geëxtraheerd). Bij een WORKTIME-lag is `lagMinutes` in dit randgeval dus licht ruw — bewust, want
 * het dag-deel laten verdwijnen is strikt slechter.
 *
 * Geen dag-component vóór `T` ⇒ 0.
 */
function isoDurationLeadingDaysMinutes(iso: string): number {
  const MIN_PER_CALENDAR_DAY = 1440;
  const clean = iso.trim();
  const neg = clean.startsWith('-');
  const tIdx = clean.indexOf('T');
  const datePart = tIdx >= 0 ? clean.slice(0, tIdx) : '';
  // Zelfde getalvorm als `parseDurationDays`: een decimale fractie mag (ISO 8601; een kaal `(\d+)`
  // leest bij `P1.5DT2H` alleen de cijfers ná de punt, 5 dagen). Het resultaat
  // blijft een hele minuut, zoals `isoDurationToMinutes` levert.
  const dayMatch = datePart.match(/(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)D/);
  if (!dayMatch) return 0;
  const days = parseFloat(dayMatch[1]);
  if (!Number.isFinite(days)) return 0;
  return Math.round((neg && days > 0 ? -days : days) * MIN_PER_CALENDAR_DAY);
}

function parseTaskType(s: string): TaskType {
  // IFC-specifieke normalisatie: STEP-enum-punten strippen (`.CONSTRUCTION.` → `CONSTRUCTION`).
  const clean = s.replace(/\./g, '').trim();
  return TASK_TYPES.includes(clean as TaskType) ? (clean as TaskType) : 'CONSTRUCTION';
}

function parseSequenceType(s: string): SequenceType {
  const clean = s.replace(/\./g, '').trim();
  const map: Record<string, SequenceType> = {
    'FINISH_START': 'FINISH_START',
    'START_START': 'START_START',
    'FINISH_FINISH': 'FINISH_FINISH',
    'START_FINISH': 'START_FINISH',
  };
  return map[clean] || 'FINISH_START';
}

function extractProject(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  labels: ImportLabels,
): Project {
  const proj = entities.find(e => e.type === 'IFCPROJECT');
  const wp = entities.find(e => e.type === 'IFCWORKPLAN');
  const wpSlots = workControlSlots(wp?.args ?? []);
  // Een tijd telt alleen als stringliteral (IfcDateTime). In IFC2X3 staan op deze plekken verwijzingen
  // (IfcDateTimeSelect); die geven geen datum, net als een leeg slot.
  const wpTime = (slot: number): string => {
    const raw = (wp?.args[slot] ?? '').trim();
    return raw.startsWith("'") ? raw : '';
  };
  const wpStart = wpTime(wpSlots.startTime);
  const wpFinish = wpTime(wpSlots.finishTime);
  const projectGlobalId = proj ? ifcSlotText(proj.args[0]) : '';

  // Auteur/organisatie uit de owner-history-keten (IFCOWNERHISTORY → IFCPERSONANDORGANIZATION →
  // IFCPERSON.FamilyName / IFCORGANIZATION.Name; spiegel van wat de writer schrijft). Via de keten
  // i.p.v. `entities.find('IFCPERSON')` zodat we de PROJECT-persoon/organisatie pakken en niet de
  // applicatie-organisatie ('OpenAEC Foundation'). Ontbreekt de keten (bestand van een ander tool)
  // of is een slot leeg (`$`) ⇒ ''.
  let author = '';
  let company = '';
  const owner = entities.find(e => e.type === 'IFCOWNERHISTORY');
  if (owner) {
    const po = entityMap.get(parseRef(owner.args[0] || '') || '');
    if (po && po.type === 'IFCPERSONANDORGANIZATION') {
      const person = entityMap.get(parseRef(po.args[0] || '') || '');
      if (person && person.type === 'IFCPERSON') author = ifcSlotText(person.args[1]);
      const org = entityMap.get(parseRef(po.args[1] || '') || '');
      if (org && org.type === 'IFCORGANIZATION') company = ifcSlotText(org.args[1]);
    }
  }

  return {
    id: projectGlobalId
      ? `proj-ifc-${projectGlobalId}`
      : `proj-ifc-step-${proj?.id ?? wp?.id ?? 'missing'}`,
    // Twee verschillende gevallen, bewust verschillend afgehandeld:
    //
    //  1. Er ís een IFCPROJECT. Dan telt zijn naamslot — óók als die leeg is. `ifcSlotText`, niet
    //     `stripQuotes`: een naamloos project schrijft de writer als `$` (`ifcStr('')`), en
    //     `stripQuotes` geeft daar letterlijk '$' op terug — dan staat er na opslaan+heropenen een
    //     dollarteken als projectnaam. Leeg blijft leeg, zodat de weergave-fallback
    //     (`common:project.untitled`) ook ná het openen werkt.
    //  2. Er is GEEN IFCPROJECT (kapot/vreemd bestand). Dan stempelen we wél een naam in de data:
    //     leeg laten zou "Nieuwe planning" tonen, en dat suggereert ten onrechte dat de import
    //     mislukt is terwijl er misschien gewoon taken uit het bestand komen. De tekst komt van de
    //     aanroeper (`ImportLabels`), want deze dienstlaag heeft geen `t(...)`.
    name: proj ? ifcSlotText(proj.args[2]) : (labels.importedProject || DEFAULT_IMPORTED_PROJECT_NAME),
    // Omschrijving uit de IFCWORKPLAN.Description-slot (waar de writer 'm schrijft), met terugval op
    // de IFCPROJECT.Description-slot; `$`/leeg ⇒ ''.
    description: ifcSlotText(wp?.args[3]) || ifcSlotText(proj?.args[3]),
    // Geen IFCWORKPLAN, of een IFCWORKPLAN met een LEEG StartTime-slot ($) ⇒ startdatum hier LEEG
    // laten; `readIFC` leidt hem dan af uit de vroegste taakstart (en pas als óók die ontbreekt:
    // vandaag). Direct "vandaag" zou verzonnen data zijn die via de projectstart-vloer taken mét
    // voorgangers naar de leesdatum tilt (check-recorded-dates 9A/9B). `parseDateFromIFC`
    // wordt bewust alleen op een niet-lege slottekst losgelaten — op '' levert hij zelf "vandaag".
    // StartTime/FinishTime op de plek die bij de argumenten hoort: schema, oude OPS-indeling (ook na
    // IfcOpenShell MergeProjects) of IFC2X3 (`workControlSlots`).
    startDate: ifcSlotText(wpStart) ? parseDateFromIFC(wpStart) : '',
    // Zelfde regel voor FinishTime: een leeg slot is "geen einde", niet vandaag. Het
    // OPS_ProjectSettings-pset wint hierna nog steeds als het er is.
    endDate: ifcSlotText(wpFinish) ? parseDateFromIFC(wpFinish) : '',
    calendarId: 'cal-default',
    // createdAt/modifiedAt: default = nu; overschreven door het OPS_ProjectSettings-pset in
    // extractStructure als het bestand ze draagt (oude bestanden ⇒ deze default blijft staan).
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author,
    company,
  };
}

function extractCalendar(entities: StepEntity[], entityMap: Map<string, StepEntity>): WorkCalendar {
  const cal = entities.find(e => e.type === 'IFCWORKCALENDAR');
  if (!cal) return createDefaultCalendar();
  return buildCalendarFromEntity(cal, entityMap, entities);
}

/**
 * Uur-modus-post-pass. Draait ná het resolven van elke `task.calendarId`.
 * Beslist per kalender (project + bibliotheek) of hij uur-modus is volgens de normatieve
 * discriminator: (a)/(b) uit de eigen banden, of (c) sub-dag-informatie van een taak die
 * hem gebruikt (een duur met tijdcomponent die niet op hele dagen valt, of een datetime met een
 * echte tijd-van-de-dag ≠ `T07:00`). Uur-kalenders krijgen `workTime` + afgeleide `hoursPerDay`;
 * hun taken krijgen minuut-precieze `durationMinutes` en echte tijden. Geen signaal ⇒ alles blijft
 * dag-modus.
 */
function applyHourModeIFC(
  tasks: Task[],
  projectCal: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  taskTimeEntities: Map<string, StepEntity>,
): void {
  const libById = new Map(resourceCalendars.map(c => [c.id, c]));
  const effCalOf = (t: Task): WorkCalendar => (t.calendarId && libById.get(t.calendarId)) || projectCal;

  // 1. Sub-dag-signaal (c) per taak, t.o.v. de HUIDIGE (scalar/afgeleide) hpd van de effectieve
  //    kalender. Verzamel welke kalenders daardoor uur-modus moeten worden.
  const subDayCals = new Set<WorkCalendar>();
  for (const t of tasks) {
    const e = taskTimeEntities.get(t.id);
    if (!e) continue;
    const effCal = effCalOf(t);
    const durMin = isoDurationToMinutes(stripQuotes(e.args[TASKTIME_SLOT.scheduleDuration] || ''));
    const durSignal = durMin != null && isSubDayMinutes(durMin, effCal.hoursPerDay);
    // Datetime-slots die een echte tijd-van-de-dag (≠ `T07:00`) kunnen dragen (schedule/early/late
    // start+finish + actual start/finish) — via de gedeelde slot-namen i.p.v. magische indices.
    const dateSignal = [
      TASKTIME_SLOT.scheduleStart, TASKTIME_SLOT.scheduleFinish,
      TASKTIME_SLOT.earlyStart, TASKTIME_SLOT.earlyFinish,
      TASKTIME_SLOT.lateStart, TASKTIME_SLOT.lateFinish,
      TASKTIME_SLOT.actualStart, TASKTIME_SLOT.actualFinish,
    ].some(i => hasNonAnchorTime(stripQuotes(e.args[i] || ''), IFC_TIME_ANCHOR));
    if (durSignal || dateSignal) subDayCals.add(effCal);
  }

  // 2. Promoveer kalenders die afwijken (a/b uit de banden) of een (c)-signaal droegen. IFC kiest
  //    altijd de geregistreerde canonical zodra er info is (preferCanonicalWhenEmpty = true) — zie
  //    de noot bij `promoteHourCalendar`.
  //    Een door OPS als scalair gemarkeerde kalender (`IsHourCalendar = .F.`) doet niet mee — hij
  //    blijft scalair, ook met meer banden of urentaken erop.
  promoteHourCalendars(
    [projectCal, ...resourceCalendars].filter(cal => !declaredScalarCalendars.has(cal)).map(cal => [cal, cal] as const),
    cal => subDayCals.has(cal),
    true,
  );

  // 3. Herstel de echte tijden op taken met een uurkalender. De ISO-duurvorm die parseTaskTime al
  //    las bepaalt onafhankelijk daarvan de taakidentiteit (P…D = dagen, PT… = uren).
  for (const t of tasks) {
    const effCal = effCalOf(t);
    // Een urentaak op een gemarkeerd-scalaire kalender draagt in het geheugen óók echte tijden en
    // minuten — lees hem dus zoals op een uurkalender. Dagtaken daarop blijven dag-precies.
    const minutePrecise = !!effCal.workTime
      || (declaredScalarCalendars.has(effCal) && t.time.durationUnit === 'hours');
    if (!minutePrecise) {
      // Dag-kalender, uur-taak (kale `PT{n}H` uit andermans bestand): de compatibiliteitsafgeleide
      // `scheduleDuration` komt uit `parseDurationDays`' vaste `/8`. Zelfde afleiding als de
      // uurkalender-tak hieronder: werkminuten ÷ de werktijd per dag van de EFFECTIEVE kalender.
      if (t.time.durationUnit === 'hours' && t.time.durationMinutes != null && effHoursPerDay(effCal) > 0) {
        t.time.scheduleDuration = hourTaskScheduleDuration(t.time.durationMinutes, effCal);
      }
      if (t.time.durationUnit === 'hours') readRemainingMinutes(t, taskTimeEntities.get(t.id));
      continue;
    }
    const e = taskTimeEntities.get(t.id);
    if (!e) continue;
    const durMin = isoDurationToMinutes(stripQuotes(e.args[TASKTIME_SLOT.scheduleDuration] || ''));
    if (t.time.durationUnit === 'hours') {
      const minutes = durMin != null ? durMin : (t.time.durationMinutes ?? 0);
      t.time.durationMinutes = minutes;
      // Compatibiliteitsafgeleide voor bestaande analyse/exportcode; nooit invoerbron. Via
      // `hourTaskScheduleDuration` (niet ÷ een apart bewaarde `HoursPerDay`): zo geeft opslaan en
      // heropenen hetzelfde getal als het raster. De wachter houdt bij een kalender zonder werktijd het
      // gelezen getal, in plaats van 0.
      if (effHoursPerDay(effCal) > 0) t.time.scheduleDuration = hourTaskScheduleDuration(minutes, effCal);
    } else {
      t.time.durationMinutes = undefined;
    }
    const toHour = (raw: string | undefined): string | undefined => {
      const q = stripQuotes(raw || '');
      return q && q !== '$' ? formatInstant(parseImportedInstant(q), 'hour') : undefined;
    };
    const ss = toHour(e.args[TASKTIME_SLOT.scheduleStart]); if (ss) t.time.scheduleStart = ss;
    const sf = toHour(e.args[TASKTIME_SLOT.scheduleFinish]); if (sf) t.time.scheduleFinish = sf;
    const es = toHour(e.args[TASKTIME_SLOT.earlyStart]); if (es) t.time.earlyStart = es;
    const ef = toHour(e.args[TASKTIME_SLOT.earlyFinish]); if (ef) t.time.earlyFinish = ef;
    const ls = toHour(e.args[TASKTIME_SLOT.lateStart]); if (ls) t.time.lateStart = ls;
    const lf = toHour(e.args[TASKTIME_SLOT.lateFinish]); if (lf) t.time.lateFinish = lf;
    const as = toHour(e.args[TASKTIME_SLOT.actualStart]); if (as) t.time.actualStart = as;
    const af = toHour(e.args[TASKTIME_SLOT.actualFinish]); if (af) t.time.actualFinish = af;
    readRemainingMinutes(t, e);
  }
}

/**
 * Restduur-minuten uit een `PT…`-RemainingTime-slot. Bij een urentaak krijgt `remainingTime` dezelfde
 * werkdagfractie als de store haar geeft (`hourRemainingDays`, de vorm van `scheduleDuration`): de
 * `parseDurationDays`-lezing van `PT5H` is `ceil(5 / uren per dag)` hele dagen, en een taak zonder
 * voortgang komt niet langs `normalizeImportedProgress`, dus die waarde bleef anders staan.
 */
function readRemainingMinutes(t: Task, e: StepEntity | undefined): void {
  const remMin = e ? isoDurationToMinutes(stripQuotes(e.args[TASKTIME_SLOT.remainingTime] || '')) : null;
  if (remMin == null) return;
  t.time.remainingMinutes = remMin;
  if (t.time.durationUnit === 'hours') t.time.remainingTime = hourRemainingDays(t.time, remMin);
}

/**
 * Welke slots vulde dit IfcTaskTime écht? `$`, leeg en afwezig tellen NIET mee. Rekenslots
 * (`RECORDED_SLOT_KEYS`) én de twee invoerslots ScheduleStart/ScheduleFinish
 * (`RECORDED_INPUT_SLOT_KEYS`) tellen allebei mee — de tweelagenkeuze in "datums zoals opgeslagen"
 * heeft de aanwezigheid van BEIDE nodig: zonder de invoerslots hier kan de terugvallaag een
 * `$`-ScheduleStart niet onderscheiden van een écht geëxporteerde datum.
 *
 * Bewust hier en niet in de slot-`read`-descriptors: `read` krijgt de rauwe arg al binnen, maar zijn
 * contract (`read?(t, arg, p)`) zou voor alle twintig slots moeten wijzigen om deze ene uitkomst
 * naar buiten te krijgen. De arg-index staat via `TASKTIME_SLOT` toch al ter beschikking.
 */
function recordedSlotsOf(e: StepEntity): RecordedFieldKey[] {
  const out: RecordedFieldKey[] = [];
  for (const key of ALL_RECORDED_SLOT_KEYS) {
    const arg = e.args[TASKTIME_SLOT[key]];
    if (arg && arg !== '$') out.push(key);
  }
  return out;
}

/**
 * STEP-id van IFCTASK → door OPS opgeslagen intern taak-id.
 *
 * Dit is opzettelijk een kleine pre-pass naast de algemene per-taak-psetdispatch: die algemene
 * dispatch krijgt pas bestaande Task-objecten. Identiteit bepaalt juist met welk id die objecten,
 * sequence-maps en recordedFields vanaf het begin worden gemaakt.
 */
function extractTaskIdentityByStepId(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET'
      || stripQuotes(pset.args[2] || '') !== PSET.TaskIdentity) continue;
    let internalId: string | undefined;
    for (const propRef of parseRefs(pset.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE'
        || stripQuotes(prop.args[0] || '') !== 'InternalTaskId') continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (isValidPersistedIfcId(value)) internalId = value;
    }
    if (!internalId) continue;
    for (const objectRef of parseRefs(rel.args[4] || '')) {
      if (entityMap.get(objectRef)?.type === 'IFCTASK') out.set(objectRef, internalId);
    }
  }
  return out;
}

function isValidPersistedIfcId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
    && !Array.from(value).some(character => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127;
    });
}

function stableIfcTaskId(
  taskEntity: StepEntity,
  persistedIds: Map<string, string>,
  usedIds: Set<string>,
): string {
  const globalId = ifcSlotText(taskEntity.args[TASK_SLOT.globalId]);
  const base = persistedIds.get(taskEntity.id)
    ?? (globalId ? `task-ifc-${globalId}` : `task-ifc-step-${taskEntity.id}`);
  let id = base;
  for (let duplicate = 2; usedIds.has(id); duplicate++) id = `${base}-dup-${duplicate}`;
  usedIds.add(id);
  return id;
}

function extractTasks(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  baselineTaskStepIds: Set<string> = new Set(),
  persistedIds: Map<string, string> = new Map(),
  hoursPerDay = 8,
): {
  tasks: Task[]; taskStepIdMap: Map<string, string>; taskTimeEntities: Map<string, StepEntity>;
  recordedFields: Record<string, RecordedFieldKey[]>; runningStatusIds: Set<string>;
} {
  const taskEntities = entities.filter(e => e.type === 'IFCTASK' && !baselineTaskStepIds.has(e.id));
  const tasks: Task[] = [];
  const taskStepIdMap = new Map<string, string>(); // STEP #id -> our task id
  // Onze taak-id → IFCTASKTIME-entiteit, zodat de uur-modus-post-pass de rauwe
  // duur-/datetime-strings kan herlezen zodra de effectieve kalender bekend is.
  const taskTimeEntities = new Map<string, StepEntity>();
  // Aanwezigheidsregistratie voor "datums zoals opgeslagen": per taak-id de rekenslots die het
  // bestand echt vulde. Een taak ZONDER IfcTaskTime krijgt een lege lijst (niet: ontbrekend) —
  // "geen enkel slot gevuld" is een uitspraak, "onbekend" niet.
  const recordedFields: Record<string, RecordedFieldKey[]> = {};
  const usedIds = new Set<string>();
  // Taken met `IfcTask.Status` precies `'STARTED'` (zie `IFC_TASK_STATUS_RUNNING`). Alleen
  // `normalizeImportedProgress` leest dit, en alleen voor een taak op 100 % zonder werkelijk einde.
  const runningStatusIds = new Set<string>();

  for (const te of taskEntities) {
    const id = stableIfcTaskId(te, persistedIds, usedIds);
    taskStepIdMap.set(te.id, id);

    // Twee IFCTASK-lay-outs (zie writeTask): spec-conform IFC 4.3 telt 13 args
    // (WorkMethod op index 8; IsMilestone/Priority/TaskTime/PredefinedType op 9/10/11/12) —
    // dat schrijven wij zelf en dat schrijven ook bestanden van derden. Oudere
    // OPS-bestanden tellen 12 args (WorkMethod ontbrak; dezelfde vier attributen één
    // positie eerder op 8/9/10/11). Detectie op arg-count: exact 12 = legacy-OPS-lay-out,
    // al het andere = spec-lay-out. De legacy-lay-out mist WorkMethod (spec-index 8), dus alle
    // slots ná die positie schuiven één plek terug — één OFFSET op de gedeelde `TASK_SLOT`-indices
    // (./ifcTaskSlots) i.p.v. losse ternary's. Name/Description/Identification (< 8) schuiven niet.
    const legacy12 = te.args.length === 12;
    const shift = legacy12 ? 1 : 0;
    const isMilestoneIdx = TASK_SLOT.isMilestone - shift;
    const priorityIdx = TASK_SLOT.priority - shift;
    const taskTimeIdx = TASK_SLOT.taskTime - shift;
    const predefinedTypeIdx = TASK_SLOT.predefinedType - shift;

    // Parse IfcTaskTime reference
    const taskTimeRef = parseRef(te.args[taskTimeIdx] || '');
    const ttEntity = taskTimeRef ? entityMap.get(taskTimeRef) : undefined;
    const time = ttEntity ? parseTaskTime(ttEntity, hoursPerDay) : createDefaultTaskTime(localTodayIso(), 5);
    if (ttEntity) taskTimeEntities.set(id, ttEntity);
    recordedFields[id] = ttEntity ? recordedSlotsOf(ttEntity) : [];

    // Status (spec-index 7) staat vóór WorkMethod: geen OFFSET in de legacy-lay-out. Een andere of
    // onbekende tekst negeren we, zoals voorheen.
    if (ifcSlotText(te.args[TASK_SLOT.status]) === IFC_TASK_STATUS_RUNNING) runningStatusIds.add(id);

    const isMilestone = te.args[isMilestoneIdx]?.includes('T') || false;
    if (isMilestone) time.scheduleDuration = 0;

    // IfcTask.Priority (zie writeTask voor de index-verificatie). Veilige parse
    // zonder `||`-valkuil: `0 || 500` zou een legitieme prioriteit 0 corrumperen.
    const priorityRaw = (te.args[priorityIdx] || '').trim();
    let priority = DEFAULT_PRIORITY;
    if (priorityRaw && priorityRaw !== '$') {
      const p = parseInt(priorityRaw, 10);
      priority = Number.isFinite(p) ? p : DEFAULT_PRIORITY;
    }

    tasks.push({
      id,
      name: ifcSlotText(te.args[TASK_SLOT.name]) || 'Naamloze taak',
      // `$`/leeg/afwezig ⇒ '' (niet de letterlijke '$' — zelfde regel als IFCPROJECT.Description
      // hierboven; de writer schrijft description/identification bewust als bare `$` via `ifcStr`
      // wanneer leeg, zie ifcTaskSlots.ts).
      description: ifcSlotText(te.args[TASK_SLOT.description]),
      wbsCode: ifcSlotText(te.args[TASK_SLOT.identification]),
      taskType: te.args[predefinedTypeIdx] ? parseTaskType(te.args[predefinedTypeIdx]) : 'CONSTRUCTION',
      customTaskTypeId: undefined,
      status: 'NOT_STARTED',
      isMilestone,
      priority,
      parentId: null,
      childIds: [],
      time,
      resourceIds: [],
    });
  }

  return { tasks, taskStepIdMap, taskTimeEntities, recordedFields, runningStatusIds };
}

/** Lees de OPS-catalogus defensief. Zonder metadata blijft een extern/oud USERDEFINED-bestand
 * gewoon USERDEFINED; ObjectType wordt daarbij niet als id geraden. */
function extractTaskTypeMeta(
  entities: StepEntity[], entityMap: Map<string, StepEntity>, tasks: Task[], taskStepIdMap: Map<string, string>,
): CustomTaskType[] {
  let raw: unknown;
  for (const pset of entities) {
    if (pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== PSET.TaskTypes) continue;
    for (const ref of parseRefs(pset.args[4] || '')) {
      const prop = entityMap.get(ref);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE' || stripQuotes(prop.args[0] || '') !== 'TaskTypes') continue;
      raw = parseTypedValue(prop.args[2] || '');
    }
  }
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as { definitions?: unknown; taskTypeIds?: unknown };
    const definitions: CustomTaskType[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    if (Array.isArray(parsed.definitions)) {
      for (const rawDefinition of parsed.definitions) {
        if (!rawDefinition || typeof rawDefinition !== 'object'
          || typeof (rawDefinition as CustomTaskType).id !== 'string'
          || typeof (rawDefinition as CustomTaskType).name !== 'string') continue;
        const definition = {
          id: (rawDefinition as CustomTaskType).id.trim(),
          name: (rawDefinition as CustomTaskType).name.trim(),
        };
        const nameKey = definition.name.toLocaleLowerCase();
        if (!definition.id || !definition.name || seenIds.has(definition.id) || seenNames.has(nameKey)) continue;
        seenIds.add(definition.id);
        seenNames.add(nameKey);
        definitions.push(definition);
      }
    }
    if (!parsed.taskTypeIds || typeof parsed.taskTypeIds !== 'object') return definitions;
    const byStep = new Map<string, string>(taskStepIdMap);
    const byTaskId = new Map(tasks.map(t => [t.id, t]));
    for (const [stepId, entity] of entityMap) {
      if (entity.type !== 'IFCTASK') continue;
      const taskId = byStep.get(stepId);
      const typeId = (parsed.taskTypeIds as Record<string, unknown>)[stripQuotes(entity.args[0] || '')];
      const task = taskId ? byTaskId.get(taskId) : undefined;
      if (task && typeof typeId === 'string' && typeId.trim()) {
        task.taskType = 'USERDEFINED';
        task.customTaskTypeId = typeId.trim();
      }
    }
    return definitions;
  } catch { return []; }
}

/** Datumbereik van een IfcWorkTime-uitzondering (Start-/FinishDate, allebei optioneel in IFC 4.3):
 *  één lege kant neemt de andere over (één dag), beide leeg ⇒ `null` (geen uitzondering). */
function workTimeDateRange(wt: StepEntity): { startDate: string; endDate: string } | null {
  const start = optDate(wt.args[4]);
  const end = optDate(wt.args[5]);
  if (!start && !end) return null;
  return { startDate: start ?? end!, endDate: end ?? start! };
}

/**
 * Lege rekenslots (Early/Late Start/Finish = `$`) krijgen de EIGEN geplande datum van de taak in
 * plaats van de "vandaag"-terugval van `parseDateFromIFC`. Het laden rekent ze toch opnieuw uit en
 * "datums zoals opgeslagen" leest hun aanwezigheid uit `recordedFields`, maar vóór die solve lezen o.a.
 * `normalizeImportedProgress` (AS/AF-default van een voltooide taak) en slapende herstelde documenten
 * deze waarden — die zouden anders de leesdatum zien. Zelfde keuze als de CSV-lezer (early/late =
 * start/finish). Ná `applyHourModeIFC`, zodat een uurtaak de uur-precieze Schedule-datum overneemt. Een
 * IFCTASK zonder IfcTaskTime blijft ongemoeid (daar komt alles uit `createDefaultTaskTime`).
 */
function fillEmptyComputedDateSlots(
  tasks: Task[],
  taskTimeEntities: Map<string, StepEntity>,
  recordedFields: Record<string, RecordedFieldKey[]>,
): void {
  for (const t of tasks) {
    if (!taskTimeEntities.has(t.id)) continue;
    const present = new Set(recordedFields[t.id] ?? []);
    if (!present.has('earlyStart')) t.time.earlyStart = t.time.scheduleStart;
    if (!present.has('earlyFinish')) t.time.earlyFinish = t.time.scheduleFinish;
    if (!present.has('lateStart')) t.time.lateStart = t.time.scheduleStart;
    if (!present.has('lateFinish')) t.time.lateFinish = t.time.scheduleFinish;
  }
}

/** Optionele datum/duur uit een IfcTaskTime-slot: `$`/leeg ⇒ undefined (geen "vandaag"-fallback,
 *  anders zou een legacy-bestand met lege actuals-slots ze als gezet inlezen). */
function optDate(s: string | undefined): string | undefined {
  return s && s !== '$' ? parseDateFromIFC(s) : undefined;
}
/** STEP-parse-helpers die aan de IFCTASKTIME-read-descriptors (./ifcTaskSlots) worden doorgegeven —
 *  ze wonen hier (STEP-specifieke `$`/quote-semantiek) en worden geïnjecteerd zodat de slot-registry
 *  cyclusvrij blijft. `parseDate`/`parseDur` behandelen een afwezige arg als ''.
 *  Fabriek per kalender-hpd: een kale `PT{n}H` in duur, speling of actuals
 *  wordt met de PROJECTkalender naar dagen vertaald — niet met een vaste 8; de effectieve
 *  taakkalender kent de lezer op dit punt nog niet, `applyHourModeIFC` corrigeert de duur later. */
function taskTimeReadHelpers(hoursPerDay: number): TaskTimeReadHelpers {
  return {
    parseDate: (arg) => parseDateFromIFC(arg || ''),
    parseDur: (arg) => parseDurationDays(arg || '', hoursPerDay),
    optDate,
    optDur: (s) => (s && s !== '$' ? parseDurationDays(s, hoursPerDay) : undefined),
  };
}

/**
 * IFCTASKTIME → TaskTime via de gedeelde slot-registry (./ifcTaskSlots.IFC_TASKTIME_SLOTS): per slot
 * dispatcht de descriptor zijn eigen `read` (spiegel van de `write` die de writer emitteerde), zodat
 * arg-index en veld niet los kunnen divergeren. Slots zonder `read` (Name/DataOrigin/
 * UserDefinedDataOrigin en StatusTime slot 14 — die statusdatum komt uit OPS_ProjectSettings) laten
 * hun veld ongemoeid ⇒ `$`/afwezige actuals blijven undefined.
 */
function parseTaskTime(e: StepEntity, hoursPerDay: number): TaskTime {
  const time = {} as TaskTime;
  const helpers = taskTimeReadHelpers(hoursPerDay);
  for (let i = 0; i < IFC_TASKTIME_SLOTS.length; i++) {
    IFC_TASKTIME_SLOTS[i].read?.(time, e.args[i], helpers);
  }
  const rawDuration = stripQuotes(e.args[TASKTIME_SLOT.scheduleDuration] || '');
  const hasTimeComponent = /^-?P[^T]*T/i.test(rawDuration);
  time.durationUnit = hasTimeComponent ? 'hours' : 'days';
  if (hasTimeComponent) {
    const minutes = isoDurationToMinutes(rawDuration);
    if (minutes != null) time.durationMinutes = minutes;
  }
  return time;
}

function extractSequences(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
  p6BoundarySequenceGuids: ReadonlySet<string>,
  hoursPerDay: number,
  guidLog: Record<string, string>,
): Sequence[] {
  const seqEntities = entities.filter(e => e.type === 'IFCRELSEQUENCE');
  const sequences: Sequence[] = [];
  const usedIds = new Set<string>();

  for (const se of seqEntities) {
    const predRef = parseRef(se.args[4] || '');
    const succRef = parseRef(se.args[5] || '');
    if (!predRef || !succRef) continue;

    const predId = taskStepIdMap.get(predRef);
    const succId = taskStepIdMap.get(succRef);
    if (!predId || !succId) continue;

    // Lag. Twee lay-outs van IFCLAGTIME ondersteunen:
    //  - conform IFC 4.3 (huidige writer): arg 4 = LagValue als getypte select
    //    (IFCDURATION('P2D') / IFCRATIOMEASURE(0.5)), arg 5 = DurationType (.WORKTIME./.ELAPSEDTIME.);
    //  - legacy (oudere app-versies, omgewisseld): arg 4 = .WORKTIME., arg 5 = 'P0Y0M2D'.
    let lagDays = 0;
    let lagUnit: Sequence['lagUnit'];
    let lagPercent: number | undefined;
    // Uur-lag heeft een tijdcomponent (`IFCDURATION('PT..')`) ⇒ `lagMinutes` als
    // bron van waarheid. Alleen de uur-schrijver emitteert die vorm; dag-bestanden (`P{d}D`) leveren
    // `null` en houden `lagDays`.
    let lagMinutes: number | undefined;
    const lagRef = parseRef(se.args[6] || '');
    if (lagRef) {
      const lagEntity = entityMap.get(lagRef);
      if (lagEntity && lagEntity.type === 'IFCLAGTIME') {
        const lagValue = (lagEntity.args[3] || '').trim();
        const durType = (lagEntity.args[4] || '').trim();
        // Een STEP-REAL mag een exponent dragen (`5.E-1`). De writer schrijft altijd een decimale
        // punt (`1.` voor 100 %); dat las `[\d.]+` al.
        const ratioMatch = lagValue.match(/^IFCRATIOMEASURE\s*\(\s*(-?[\d.]+(?:E[+-]?\d+)?)\s*\)$/i);
        const durMatch = lagValue.match(/^IFCDURATION\s*\(\s*(.+?)\s*\)$/i);
        if (ratioMatch) {
          // Ratio → procent; afronden tegen floating-point-ruis (0.33*100 = 33.000000000000004).
          lagPercent = Math.round(parseFloat(ratioMatch[1]) * 100 * 1e6) / 1e6;
        } else if (durMatch) {
          // EERST `lagMinutes` proberen (discriminator (c), subdayIo/mspdiReader-conventie "geen
          // dag-afronding"). Een duur MET tijdcomponent (`PT2H0M0S`) is minuut-precies ⇒ `lagDays`
          // blijft 0, nooit de grove uur→dag-ceil van `parseDurationDays` (die zou een correcte
          // `lagMinutes` stilzwijgend overschrijven met een afgeronde dag, 2u → +1d).
          // Alleen een PUUR dag-duur (`P{d}D`, geen `T`) levert `isoDurationToMinutes === null` en
          // valt terug op `parseDurationDays`.
          const raw = stripQuotes(durMatch[1]);
          const timeMinutes = isoDurationToMinutes(raw);
          if (timeMinutes != null) {
            // GEMENGDE vorm (`P1DT2H0M0S`) uit een vreemd bestand — onze
            // eigen schrijver emitteert nooit een dag-component vóór de `T` (zie `minutesToIsoDuration`),
            // maar deze soepel-lezen-tak bestaat juist voor andermans bestanden. Zonder dit zou het
            // dag-deel stil verdwijnen (`isoDurationLeadingDaysMinutes` hieronder). Samen optellen i.p.v.
            // kiezen voorkomt dataverlies aan beide kanten.
            lagMinutes = timeMinutes + isoDurationLeadingDaysMinutes(raw);
            lagDays = 0;
          } else {
            lagMinutes = undefined;
            lagDays = parseDurationDays(durMatch[1], hoursPerDay);
          }
        } else if (lagValue.startsWith("'")) {
          // Ongetypte duur-string (soepel lezen van andermans bestanden) — zelfde volgorde als hierboven.
          const raw = stripQuotes(lagValue);
          const timeMinutes = isoDurationToMinutes(raw);
          if (timeMinutes != null) {
            lagMinutes = timeMinutes + isoDurationLeadingDaysMinutes(raw);
            lagDays = 0;
          } else {
            lagMinutes = undefined;
            lagDays = parseDurationDays(lagValue, hoursPerDay);
          }
        } else {
          // Legacy-lay-out: de duur staat in arg 5.
          lagDays = parseDurationDays(lagEntity.args[4] || '', hoursPerDay);
        }
        if (/ELAPSEDTIME/i.test(durType)) lagUnit = 'ELAPSEDTIME';
      }
    }

    const seq: Sequence = {
      id: stableIdFromGuid('seq', 'seq', se, usedIds, guidLog),
      predecessorId: predId,
      successorId: succId,
      type: parseSequenceType(se.args[7] || ''),
      lagDays,
    };
    if (lagUnit) seq.lagUnit = lagUnit;
    if (lagPercent !== undefined) seq.lagPercent = lagPercent;
    if (lagMinutes !== undefined) seq.lagMinutes = lagMinutes;
    if (p6BoundarySequenceGuids.has(stripQuotes(se.args[0] || ''))) {
      seq.p6StartAtPredecessorFinishBoundary = true;
    }
    sequences.push(seq);
  }

  return sequences;
}

/**
 * Lees de relationele P6-grensmetadata. De pset hangt schema-geldig op de IfcWorkSchedule;
 * de payload bevat daarom IfcRelSequence-GlobalIds in plaats van vluchtige OPS-relatie-id's.
 * Corrupt/ongeldig metadata blijft inert: alleen een volledige string-array activeert een vlag.
 */
function extractP6BoundarySequenceGuids(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  liveTaskStepIds: ReadonlySet<string>,
): Set<string> {
  // Alleen een niet-baseline schema dat de daadwerkelijk ingelezen live taken bestuurt/nest,
  // is voor deze import het relevante IfcWorkSchedule. Een gelijknamige losse pset is geen bewijs.
  const relevantScheduleIds = new Set<string>();
  for (const entity of entities) {
    if (entity.type === 'IFCRELNESTS') {
      const scheduleId = parseRef(entity.args[4] || '');
      const schedule = scheduleId ? entityMap.get(scheduleId) : undefined;
      if (schedule?.type === 'IFCWORKSCHEDULE' && !isBaselineSchedule(schedule)
        && parseRefs(entity.args[5] || '').some(id => liveTaskStepIds.has(id))) {
        relevantScheduleIds.add(scheduleId!);
      }
    } else if (entity.type === 'IFCRELASSIGNSTOCONTROL') {
      const scheduleId = parseRef(entity.args[6] || '');
      const schedule = scheduleId ? entityMap.get(scheduleId) : undefined;
      if (schedule?.type === 'IFCWORKSCHEDULE' && !isBaselineSchedule(schedule)
        && parseRefs(entity.args[4] || '').some(id => liveTaskStepIds.has(id))) {
        relevantScheduleIds.add(scheduleId!);
      }
    }
  }

  const accepted: Set<string>[] = [];
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const owners = parseRefs(rel.args[4] || '');
    if (owners.length !== 1 || !relevantScheduleIds.has(owners[0])) continue;
    const entity = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!entity || entity.type !== 'IFCPROPERTYSET'
      || stripQuotes(entity.args[2] || '') !== PSET.Sequences) continue;
    for (const propRef of parseRefs(entity.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== 'P6StartAtPredecessorFinishBoundarySequenceGuids') continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(value => typeof value === 'string' && value.length > 0)) {
          accepted.push(new Set(parsed));
        }
      } catch { /* corrupt relationeel bronmetadata blijft inert */ }
    }
  }
  // Meer dan één geldige bron voor dezelfde semantiek is ambigu en faalt gesloten. Een orphan of
  // pset op een ander schema telt niet mee en kan een latere geldige koppeling dus niet maskeren.
  return accepted.length === 1 ? accepted[0] : new Set();
}

/** Parse een getypeerd NominalValue zoals IFCTEXT('x'), IFCREAL(1.5), IFCBOOLEAN(.T.),
 *  IFCDATE('2026-01-01'), IFCINTEGER(2), IFCMONETARYMEASURE(3.5). */
function parseTypedValue(s: string): CustomFieldValue | undefined {
  const m = (s || '').trim().match(/^IFC\w+\s*\(([\s\S]*)\)$/i);
  if (!m) return undefined;
  const inner = m[1].trim();
  if (inner === '.T.') return true;
  if (inner === '.F.') return false;
  if (inner.startsWith("'")) return stripQuotes(inner);
  const n = parseFloat(inner);
  return Number.isFinite(n) ? n : undefined;
}

// MEASURE_TO_FIELD (IFC-measure → custom-field-type) staat in ./ifcConstants, waar het
// programmatisch uit de writer-map FIELD_MEASURE wordt afgeleid (kan niet divergeren).

/**
 * Structuurdefinities en taakwaarden teruglezen (spiegel van writeStructure):
 * de OPS_StructureMeta-JSON is autoritair (verliesloos, behoudt ids/kleuren); ontbreekt die
 * (bestand van een andere tool), dan reconstrueren we de definities uit de conformante
 * IFCPROPERTYSETTEMPLATE-declaraties met verse ids. Taakwaarden (OPS_CustomFields /
 * OPS_ActivityCodes-psets) worden per NAAM teruggemapt naar de definities; het
 * OPS_ProjectSettings-pset zet project.wbsAutoNumber.
 */
/** Wat `OPS_ProjectSettings` over de schemavraag zegt (zie `ifcSchemaUnconfirmedOnRead`). */
interface IfcSchemaMarkers {
  confirmed: boolean;
  unconfirmed?: string;
}

function extractStructure(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  project: Project,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
  libraryPoolOut: { value: import('@/types/library').CompanyPool | undefined },
  // Het OPS-pset kan "bewust leeg" zeggen — de aanroeper mag
  // de startdatum dan NIET alsnog afleiden. Presentie is een aparte uitspraak naast de waarde.
  projectStartRecorded: { value: boolean },
  // Wat `OPS_ProjectSettings` over de schemavraag zegt (`IfcSchemaConfirmed`/`IfcSchemaUnconfirmed`);
  // de aanroeper combineert het met de kop (`ifcSchemaUnconfirmedOnRead`).
  ifcSchemaMarkers: IfcSchemaMarkers,
): { activityCodeTypes: ActivityCodeType[]; customFieldDefs: CustomFieldDef[] } {
  let activityCodeTypes: ActivityCodeType[] = [];
  let customFieldDefs: CustomFieldDef[] = [];

  // 1. Autoritaire meta-JSON.
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.StructureMeta) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      try {
        const meta = JSON.parse(raw);
        if (Array.isArray(meta.activityCodeTypes)) activityCodeTypes = meta.activityCodeTypes;
        if (Array.isArray(meta.customFieldDefs)) customFieldDefs = meta.customFieldDefs;
      } catch { /* corrupte meta — val terug op templates */ }
    }
  }

  // 2. Terugval: reconstrueer definities uit de conformante templates (verse ids).
  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) {
    for (const e of entities) {
      if (e.type !== 'IFCPROPERTYSETTEMPLATE') continue;
      const setName = stripQuotes(e.args[2] || '');
      for (const tmplRef of parseRefs(e.args[6] || '')) {
        const tmpl = entityMap.get(tmplRef);
        if (!tmpl || tmpl.type !== 'IFCSIMPLEPROPERTYTEMPLATE') continue;
        const name = stripQuotes(tmpl.args[2] || '');
        const templateType = (tmpl.args[4] || '').replace(/\./g, '').trim();
        if (setName === PSET.CustomFields && templateType === 'P_SINGLEVALUE') {
          const measure = stripQuotes(tmpl.args[5] || '').toLowerCase();
          customFieldDefs.push({ id: generateId('cfd'), name, type: MEASURE_TO_FIELD[measure] ?? 'text' });
        } else if (setName === PSET.ActivityCodes && templateType === 'P_ENUMERATEDVALUE') {
          const enumEntity = entityMap.get(parseRef(tmpl.args[7] || '') || '');
          const values = enumEntity && enumEntity.type === 'IFCPROPERTYENUMERATION'
            ? splitArgs((enumEntity.args[1] || '').replace(/^\(|\)$/g, ''))
                .map(v => parseTypedValue(v))
                .filter((v): v is string => typeof v === 'string')
                .map(code => ({ id: generateId('acv'), code }))
            : [];
          activityCodeTypes.push({ id: generateId('act'), name, values });
        }
      }
    }
  }

  const typeByName = new Map(activityCodeTypes.map(t => [t.name, t]));
  const defByName = new Map(customFieldDefs.map(d => [d.name, d]));
  const taskById = new Map(tasks.map(t => [t.id, t]));

  // 3. Waarden per object via IFCRELDEFINESBYPROPERTIES.
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    const psetName = stripQuotes(pset.args[2] || '');
    const objectRefs = parseRefs(rel.args[4] || '');
    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p);

    // De per-taak-psets via de gedeelde registry: één dispatch op naam. De read-logica leeft naast de
    // write-logica in ifcPsets.PER_TASK_PSETS (kan niet divergeren).
    const perTask = PER_TASK_PSET_BY_NAME.get(psetName);
    if (perTask) {
      const singleValueProps = props
        .filter(p => p.type === 'IFCPROPERTYSINGLEVALUE')
        .map(p => ({ name: stripQuotes(p.args[0] || ''), value: parseTypedValue(p.args[2] || ''), raw: p.args[2] || '' }));
      for (const objRef of objectRefs) {
        const taskId = taskStepIdMap.get(objRef);
        const task = taskId ? taskById.get(taskId) : undefined;
        if (task) perTask.apply(task, singleValueProps);
      }
      continue;
    }

    if (psetName === PSET.Library) {
      for (const prop of props) {
        if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
        if (stripQuotes(prop.args[0] || '') !== 'pool') continue;
        const v = parseTypedValue(prop.args[2] || '');
        if (typeof v === 'string' && v) {
          try {
            libraryPoolOut.value = JSON.parse(v) as import('@/types/library').CompanyPool;
          } catch { /* corrupte pool-JSON: negeren, geen pool-resultaat */ }
        }
      }
      continue;
    }

    if (psetName === PSET.ProjectSettings) {
      for (const prop of props) {
        if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
        const name = stripQuotes(prop.args[0] || '');
        const v = parseTypedValue(prop.args[2] || '');
        if (name === 'InternalProjectId') {
          if (isValidPersistedIfcId(v)) project.id = v;
        } else if (name === 'wbsAutoNumber') {
          if (typeof v === 'boolean') project.wbsAutoNumber = v;
        } else if (name === 'DefaultTaskDurationUnit') {
          if (v === 'days' || v === 'hours') project.defaultTaskDurationUnit = v;
        } else if (name === 'DefaultWorkRule') {
          // Onbekende waarde ⇒ stil weg (default blijft staan).
          if (typeof v === 'string' && (WORK_RULES as readonly string[]).includes(v)) project.defaultWorkRule = v as WorkRule;
        } else if (name === 'StatusDate') {
          // P6 data date → project.statusDate. Een tijd-van-de-dag (uur-modus) blijft behouden:
          // IFCDATETIME, én oudere bestanden die de tijd in IFCDATE zetten (spiegel van
          // writeStructure). Datum zonder tijd ⇒ `YYYY-MM-DD`. Zelfde
          // regel als MSPDI en P6 (`statusDateFromXml`). `readIfcDate` met `importStatusDate` als
          // regel voor IFCDATE: precies wat deze lezer altijd deed.
          if (typeof v === 'string' && v) project.statusDate = readIfcDate(prop.args[2] || '', v, importStatusDate);
        } else if (name === 'ProgressMode') {
          // Alleen PROGRESS_OVERRIDE wordt geschreven; RETAINED_LOGIC is de default.
          if (v === 'PROGRESS_OVERRIDE' || v === 'RETAINED_LOGIC') project.progressMode = v;
        } else if (name === 'ProjectStartDate' || name === 'ProjectEndDate') {
          // Contractuele projectdatums (spiegel van writeStructure). Het PSET WINT wanneer het veld
          // aanwezig is — óók als het leeg is: de writer codeert "bewust leeg" als NominalValue `$`
          // (parseTypedValue ⇒ undefined) en dat moet leeg terugkomen, niet terugvallen op de
          // AFGELEIDE datum uit IFCWORKPLAN.StartTime/FinishTime die extractProject al invulde.
          // Ontbreekt het veld helemaal (ouder bestand of ander tool), dan komen we hier niet en
          // blijft die WORKPLAN-terugval staan.
          // De tijd komt alleen uit IFCDATETIME (`readIfcDate`; de writer sinds docs/ifc-round-trip.md,
          // "Projectstart en -einde met tijd"). IFCDATE (en IFCTEXT) geeft de datum, ook met een tijd
          // erin (zo schreef main vóór #344 een projectstart na een XER-import); zulke bestanden lazen
          // altijd zonder tijd.
          const date = typeof v !== 'string' ? '' : readIfcDate(prop.args[2] || '', v, (x) => x.substring(0, 10));
          if (name === 'ProjectStartDate') { project.startDate = date; projectStartRecorded.value = true; }
          else project.endDate = date;
        } else if (name === 'CreatedAt') {
          // Project-aanmaakdatum als verbatim ISO-instant (spiegel van writeStructure).
          if (typeof v === 'string' && v) project.createdAt = v;
        } else if (name === 'ModifiedAt') {
          if (typeof v === 'string' && v) project.modifiedAt = v;
        } else if (name === 'CompanyId') {
          if (typeof v === 'string' && v) project.companyId = v;
        } else if (name === 'CompanyName') {
          if (typeof v === 'string' && v) project.companyName = v;
        } else if (name === 'IfcSchemaConfirmed') {
          if (v === true) ifcSchemaMarkers.confirmed = true;
        } else if (name === 'IfcSchemaUnconfirmed') {
          if (typeof v === 'string' && v) ifcSchemaMarkers.unconfirmed = v;
        } else if (name === 'P6ProjectCode') {
          // P6 Project-ID (spiegel van writeStructure).
          if (typeof v === 'string' && v) project.p6ProjectCode = v;
        }
      }
      continue;
    }

    if (psetName !== PSET.CustomFields && psetName !== PSET.ActivityCodes) continue;
    for (const objRef of objectRefs) {
      const taskId = taskStepIdMap.get(objRef);
      const task = taskId ? taskById.get(taskId) : undefined;
      if (!task) continue;
      for (const prop of props) {
        const name = stripQuotes(prop.args[0] || '');
        if (psetName === PSET.CustomFields && prop.type === 'IFCPROPERTYSINGLEVALUE') {
          const def = defByName.get(name);
          const parsed = parseTypedValue(prop.args[2] || '');
          // Een datumveld: IFCDATETIME ⇒ de store-vorm (`readIfcDate`); IFCDATE en IFCTEXT letterlijk,
          // zoals altijd.
          const value = def?.type === 'date' && typeof parsed === 'string' ? readIfcDate(prop.args[2] || '', parsed) : parsed;
          if (def && value !== undefined) {
            task.customFields = { ...(task.customFields ?? {}), [def.id]: value };
          }
        } else if (psetName === PSET.ActivityCodes && prop.type === 'IFCPROPERTYENUMERATEDVALUE') {
          const type = typeByName.get(name);
          const codes = splitArgs((prop.args[2] || '').replace(/^\(|\)$/g, ''))
            .map(v => parseTypedValue(v))
            .filter((v): v is string => typeof v === 'string');
          const value = type?.values.find(v => v.code === codes[0]);
          if (type && value) {
            task.activityCodes = { ...(task.activityCodes ?? {}), [type.id]: value.id };
          }
        }
      }
    }
  }

  return { activityCodeTypes, customFieldDefs };
}

function extractNesting(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): void {
  const nestEntities = entities.filter(e => e.type === 'IFCRELNESTS');
  // Index tasks by id once: een tasks.find() per parent/child in de lus maakt nesting
  // O(nestings × children × tasks).
  const taskById = new Map<string, Task>(tasks.map(t => [t.id, t]));

  for (const ne of nestEntities) {
    const parentRef = parseRef(ne.args[4] || '');
    if (!parentRef) continue;
    const parentId = taskStepIdMap.get(parentRef);
    if (!parentId) continue; // Could be WorkSchedule, skip
    const parent = taskById.get(parentId);
    if (!parent) continue;

    const childRefs = parseRefs(ne.args[5] || '');
    for (const childRef of childRefs) {
      const childId = taskStepIdMap.get(childRef);
      if (!childId) continue;
      const child = taskById.get(childId);
      if (!child) continue;
      child.parentId = parentId;
      if (!parent.childIds.includes(childId)) {
        parent.childIds.push(childId);
      }
    }
  }
}

function extractResources(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
  guidLog: Record<string, string>,
): { resources: Resource[]; resourceStepIdMap: Map<string, string>; resourceGuidMap: Map<string, string> } {
  const resources: Resource[] = [];
  const usedIds = new Set<string>();
  const resourceStepIdMap = new Map<string, string>();
  const resourceGuidMap = new Map<string, string>(); // IFC GlobalId-string -> ons resource-id

  for (const e of entities) {
    // IFC-entiteit → resource-type via de gedeelde inverse-map (incl. de inkomende-alleen
    // IFCCONSTRUCTIONPRODUCTRESOURCE→EQUIPMENT-alias).
    const resType = IFC_TO_RESOURCE_TYPE[e.type];
    if (!resType) continue;

    const id = stableIdFromGuid('res', 'res', e, usedIds, guidLog);
    resourceStepIdMap.set(e.id, id);
    resourceGuidMap.set(stripQuotes(e.args[0] || ''), id);

    resources.push({
      id,
      name: ifcSlotText(e.args[2]) || 'Resource',
      type: resType,
      // `$`/leeg/afwezig ⇒ '' (zelfde regel als IfcTask.Description hierboven).
      description: ifcSlotText(e.args[3]),
      maxUnits: 1,
    });
  }

  return { resources, resourceStepIdMap, resourceGuidMap };
}

/**
 * `OPS_Resource`-pset teruglezen (spiegel van `writeResourceMeta`):
 * MaxUnits/CostPerHour/UnitOfMeasure/AvailabilitySteps + de `ParentGuid`-vangnetproperty
 * — die laatste wordt alleen toegepast als `extractCrewNesting` de relatie nog niet
 * had gelegd (IFCRELNESTS is de primaire bron, ParentGuid is het vangnet voor bestanden van
 * andere tools die de nest-relatie anders lezen).
 */
function extractResourceMeta(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
  resourceGuidMap: Map<string, string>,
): void {
  const resourceById = new Map(resources.map(r => [r.id, r]));
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    if (stripQuotes(pset.args[2] || '') !== PSET.Resource) continue;

    const objectRefs = parseRefs(rel.args[4] || '');
    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const objRef of objectRefs) {
      const resId = resourceStepIdMap.get(objRef);
      const res = resId ? resourceById.get(resId) : undefined;
      if (!res) continue;

      for (const prop of props) {
        const name = stripQuotes(prop.args[0] || '');
        const value = parseTypedValue(prop.args[2] || '');
        if (name === 'MaxUnits' && typeof value === 'number') {
          res.maxUnits = value;
        } else if (name === 'CostPerHour' && typeof value === 'number') {
          res.costPerHour = value;
        } else if (name === 'UnitOfMeasure' && typeof value === 'string') {
          res.unitOfMeasure = value;
        } else if (name === 'Color' && typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
          // Weergavekleur — alleen een geldige #rrggbb-hex accepteren (hostiele/mistorde
          // invoer valt stil terug op "geen kleur" i.p.v. rommel in de kleurmodi te krijgen).
          res.color = value;
        } else if (name === 'AvailabilitySteps' && typeof value === 'string') {
          const steps: AvailabilityStep[] = value
            .split(';')
            .map(pair => {
              const [from, maxUnitsStr] = pair.split(':');
              return { from: (from || '').trim(), maxUnits: parseFloat(maxUnitsStr) };
            })
            .filter(s => s.from && Number.isFinite(s.maxUnits));
          if (steps.length > 0) res.availabilitySteps = steps;
        } else if (name === 'ParentGuid' && typeof value === 'string' && !res.parentId) {
          const parentId = resourceGuidMap.get(value);
          if (parentId) res.parentId = parentId;
        } else if (name === 'LibraryOrigin' && typeof value === 'string' && value && !res.libraryOrigin) {
          // EERSTE geldige LibraryOrigin wint (gezet-is-gezet-guard), gelijk aan het kalenderpad
          // (extractCalendarLibraryOrigin returnt op de eerste treffer). Zonder de
          // `!res.libraryOrigin`-guard kiest dit pad de LAATSTE bij dubbele props in één pset.
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed.companyId === 'string' && typeof parsed.libraryItemId === 'string'
                && typeof parsed.poolVersion === 'number') {
              // `syncedHash` is optioneel, maar als het veld AANWEZIG
              // is moet het een string zijn — een corrupte/vervalste waarde (bv. een getal) mag niet
              // als "syncedHash" doorschieten naar de classificatielogica (`classifyOnOpen` doet
              // `fileHash === syncedHash`, een non-string zou daar altijd `false` geven, wat toevallig
              // ongevaarlijk is, maar type-onveilig blijft). Veilige kant: veld weglaten, rest van de
              // stempel (companyId/libraryItemId/poolVersion) behouden.
              if ('syncedHash' in parsed && typeof parsed.syncedHash !== 'string') delete parsed.syncedHash;
              res.libraryOrigin = parsed;
            }
          } catch { /* corrupte JSON: negeren */ }
        }
      }
    }
  }
}

/**
 * Ploeg-hiërarchie teruglezen (spiegel van `writeCrewNesting`): dezelfde
 * `IFCRELNESTS`-entiteiten als de WBS-taakhiërarchie (`extractNesting`), maar dan met
 * `RelatingObject`/`RelatedObjects` die via `resourceStepIdMap` resolven i.p.v.
 * `taskStepIdMap` — relaties voor taken resolven hier simpelweg niet (`continue`).
 */
function extractCrewNesting(
  entities: StepEntity[],
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
): void {
  const resourceById = new Map(resources.map(r => [r.id, r]));
  for (const ne of entities) {
    if (ne.type !== 'IFCRELNESTS') continue;
    const parentRef = parseRef(ne.args[4] || '');
    if (!parentRef) continue;
    const parentId = resourceStepIdMap.get(parentRef);
    if (!parentId) continue; // geen resource-nest (WBS/workschedule) — niet onze zaak

    const childRefs = parseRefs(ne.args[5] || '');
    for (const childRef of childRefs) {
      const childId = resourceStepIdMap.get(childRef);
      const child = childId ? resourceById.get(childId) : undefined;
      if (child) child.parentId = parentId;
    }
  }
}

/** Parse een STEP-lijstwaarde van gehele getallen zoals `(1,2,3,4,5)` naar `[1,2,3,4,5]`. Leeg/`$`
 *  ⇒ `[]` (golden rule bij de aanroeper: alleen toepassen als er iets uitkomt). */
function parseIntList(s: string): number[] {
  const inner = (s || '').trim().replace(/^\(|\)$/g, '');
  if (!inner) return [];
  return inner.split(',').map(x => parseInt(x.trim(), 10)).filter(Number.isFinite);
}

/**
 * `IFCRELDEFINESBYPROPERTIES` per doel-STEP-id, in bestandsvolgorde; één keer per entiteitenlijst
 * opgebouwd. De kalender-psetlezers liepen per kalender (en per lezer, zes keer) álle entiteiten door
 * en parseerden daarbij elke relatie opnieuw: O(kalenders × entiteiten × 6) — met 13 kalenders op een
 * project van 8000 taken een derde van de leestijd. Een relatie die hetzelfde doel twee keer noemt,
 * staat er één keer in (zoals de oude `includes`-toets).
 */
const relDefinesIndex = new WeakMap<StepEntity[], Map<string, StepEntity[]>>();
function relDefinesByTarget(entities: StepEntity[]): Map<string, StepEntity[]> {
  let index = relDefinesIndex.get(entities);
  if (index) return index;
  index = new Map();
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    for (const target of new Set(parseRefs(rel.args[4] || ''))) {
      let list = index.get(target);
      if (!list) { list = []; index.set(target, list); }
      list.push(rel);
    }
  }
  relDefinesIndex.set(entities, index);
  return index;
}

/**
 * De `IFCPROPERTYSINGLEVALUE`s van elk `OPS_Calendar`-pset dat de kalender met STEP-id `calStepId`
 * target (`IFCRELDEFINESBYPROPERTIES` → `IFCPROPERTYSET`), één lijst per pset in bestandsvolgorde.
 * Gedeeld door de kalender-psetlezers hieronder; elk leest zijn eigen property's en houdt zijn eigen
 * terugval.
 */
function* opsCalendarPsetProps(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): Generator<StepEntity[]> {
  for (const rel of relDefinesByTarget(entities).get(calStepId) ?? []) {
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== PSET.Calendar) continue;
    yield parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');
  }
}

/**
 * `calendar.generation`-herkomst teruglezen uit het `OPS_Calendar`-pset
 * (spiegel van `writeCalendarGenerationMeta`): zoekt de `IFCRELDEFINESBYPROPERTIES` die het
 * `IFCWORKCALENDAR` met STEP-id `calStepId` target. Golden rule/legacy: geen pset
 * gevonden, of een onvolledige/corrupte set (ontbrekende RuleSetId/jaren) ⇒ `undefined` — NOOIT
 * een kalender laten hergenereren op basis van een gok.
 */
function extractCalendarGeneration(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): CalendarGeneration | undefined {
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    let ruleSetId: HolidayCountry | undefined;
    let region: string | undefined;
    let breakChoice: CalendarGeneration['breakChoice'];
    let generatedFromYear: number | undefined;
    let generatedToYear: number | undefined;
    for (const prop of props) {
      const name = stripQuotes(prop.args[0] || '');
      const value = parseTypedValue(prop.args[2] || '');
      if (name === 'RuleSetId' && typeof value === 'string') ruleSetId = value as HolidayCountry;
      else if (name === 'Region' && typeof value === 'string') region = value;
      else if (name === 'BreakChoice' && typeof value === 'string') breakChoice = value as CalendarGeneration['breakChoice'];
      // 'WinterStop' (verwijderde feature) wordt in oude bestanden genegeerd; de
      // gematerialiseerde feestdagen zelf staan los in de kalender en blijven behouden.
      else if (name === 'GeneratedFromYear' && typeof value === 'number') generatedFromYear = value;
      else if (name === 'GeneratedToYear' && typeof value === 'number') generatedToYear = value;
    }
    if (!ruleSetId || generatedFromYear === undefined || generatedToYear === undefined) continue; // onvolledig — negeer

    return {
      ruleSetId,
      ...(region ? { region } : {}),
      ...(breakChoice ? { breakChoice } : {}),
      generatedFromYear,
      generatedToYear,
    };
  }
  return undefined;
}

/**
 * `LibraryOrigin`-herkomststempel teruglezen uit het `OPS_Calendar`-pset (spiegel van
 * de writer, die 'm naast de generation-props schrijft). BEWUST losstaand van
 * `extractCalendarGeneration`: die `continue`t bij een onvolledige generation, waardoor een kalender
 * met ALLEEN een LibraryOrigin (gepromoveerd, niet gegenereerd) er verloren zou gaan. Geen/corrupte
 * property ⇒ `undefined`.
 */
function extractCalendarLibraryOrigin(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): LibraryOrigin | undefined {
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    for (const prop of props) {
      if (stripQuotes(prop.args[0] || '') !== 'LibraryOrigin') continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value !== 'string' || !value) continue;
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed.companyId === 'string' && typeof parsed.libraryItemId === 'string'
            && typeof parsed.poolVersion === 'number') {
          // Zie de identieke toelichting bij het resourcepad
          // hierboven — aanwezig-maar-niet-string `syncedHash` wordt weggelaten, rest van de stempel
          // blijft staan (veilige/deviated-kant).
          if ('syncedHash' in parsed && typeof parsed.syncedHash !== 'string') delete parsed.syncedHash;
          return parsed as LibraryOrigin;
        }
      } catch { /* corrupte JSON: negeren */ }
    }
  }
  return undefined;
}

/**
 * Expliciete `HoursPerDay` teruglezen uit het `OPS_Calendar`-
 * pset (spiegel van `writeCalendarGenerationMeta`'s `needsHoursPerDayOverride`-tak). BEWUST
 * losstaand van `extractCalendarGeneration`/`extractCalendarLibraryOrigin` — zelfde reden: een
 * kalender met ALLEEN een `HoursPerDay`-afwijking (geen generation, geen libraryOrigin) mag 'm
 * niet mislopen. Geen/corrupte property ⇒ `undefined` (fallback blijft de bestaande
 * `workEndHour − workStartHour`-derivatie in `buildCalendarFromEntity`).
 */
function extractCalendarHoursPerDay(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): number | undefined {
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    for (const prop of props) {
      if (stripQuotes(prop.args[0] || '') !== 'HoursPerDay') continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    }
  }
  return undefined;
}

/** Leest het optionele eenvoudige scalar-pauzepatroon uit `OPS_Calendar`. */
function extractCalendarSimpleBreak(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): Pick<WorkCalendar, 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'> {
  const result: Pick<WorkCalendar, 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'> = {};
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    for (const prop of props) {
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value !== 'number' || !Number.isInteger(value)) continue;
      if (stripQuotes(prop.args[0] || '') === 'SimpleBreakStart') result.simpleBreakStartMinute = value;
      if (stripQuotes(prop.args[0] || '') === 'SimpleBreakDuration') result.simpleBreakDurationMinutes = value;
    }
  }
  return result;
}

/** OPS-eigen aanvulling op IFC's ambigue standaardwerkweek (`OPS_Calendar`, spiegel van
 * `writeCalendarGenerationMeta`):
 *  - `IsHourCalendar = .T.` bewaart dat een kalender met precies één gewone band toch uur-modus was;
 *  - `IsHourCalendar = .F.` zegt dat de `IFCTIMEPERIOD`s de effectieve banden van een SCALAIRE
 *    kalender zijn (een urentaak gebruikte hem) — die mag dan niet naar uur-modus promoveren;
 *  - `WorkStartHour`/`WorkEndHour` dragen de scalar werktijd waar de eerste periode hem niet geeft.
 * Zonder markering blijft de conservatieve externe fallback (de discriminator a/b/c) staan; alleen
 * bestanden die OPS zelf schreef krijgen dit expliciete vertrouwen. */
function extractCalendarHourMeta(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): { hourMode?: boolean } & Partial<Pick<WorkCalendar, 'workStartHour' | 'workEndHour'>> {
  const result: { hourMode?: boolean } & Partial<Pick<WorkCalendar, 'workStartHour' | 'workEndHour'>> = {};
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    for (const prop of props) {
      const name = stripQuotes(prop.args[0] || '');
      const value = parseTypedValue(prop.args[2] || '');
      if (name === 'IsHourCalendar' && typeof value === 'boolean') result.hourMode = value;
      else if (name === 'WorkStartHour' && typeof value === 'number' && value >= 0 && value <= 24) {
        result.workStartHour = value;
      } else if (name === 'WorkEndHour' && typeof value === 'number' && value >= 0 && value <= 24) {
        result.workEndHour = value;
      }
    }
  }
  return result;
}

/**
 * Herkent een SCALAIRE dagkalender in een bestand van een oudere OPS-versie zonder de
 * `IsHourCalendar = .F.`-markering. Die writer materialiseerde voor een scalaire kalender met urentaak
 * de effectieve banden (07–12 + 13–16) zonder te zeggen dat de kalender scalair was, waardoor hij als
 * uurkalender 07:00–12:00 terugkwam. Alle drie de voorwaarden zijn vereist:
 *  1. een OPS-scalarkenmerk in `OPS_Calendar`: `HoursPerDay` of `SimpleBreakStart`/`SimpleBreakDuration`.
 *     `SimpleBreak*` schrijft de writer uitsluitend bij `!cal.workTime`; `HoursPerDay` bij een uurkalender
 *     alleen samen met `IsHourCalendar = .T.`, en deze herkenning draait alleen zonder die markering (zie
 *     docs/ifc-round-trip.md, "Uren per dag bij een blokkenkalender"; bewaakt in
 *     `check-ifc-calendar-identity.ts` §10);
 *  2. precies twee `IFCTIMEPERIOD`s — meer levert de effectieve-bandafleiding (`seedScalarBands`) niet;
 *  3. zelfcontrole: de scalar die we reconstrueren (begin eerste band – eind laatste band, hpd en pauze
 *     uit de pset) levert via `seedScalarBands` exact dezelfde banden op als in het bestand staan.
 * Faalt één voorwaarde, dan `undefined`: het gewone pad (discriminator a/b/c) blijft staan, niets geraden.
 * Bestanden van andere pakketten dragen geen `OPS_Calendar` en komen hier dus nooit door.
 */
function legacyScalarFromEffectiveBands(
  periods: { start: number; end: number }[],
  calendar: WorkCalendar,
  hoursPerDayProp: number | undefined,
): Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay'> | undefined {
  const hasSimpleBreak = calendar.simpleBreakStartMinute !== undefined
    || calendar.simpleBreakDurationMinutes !== undefined;
  if (hoursPerDayProp === undefined && !hasSimpleBreak) return undefined;
  if (periods.length !== 2) return undefined;
  const bands = canonicalizeBands({ 1: periods }).bands.byWeekday[1];
  const start = bands[0].start;
  const end = bands[bands.length - 1].end;
  if (end > 24 * 60) return undefined; // over middernacht: geen scalaire werkdag
  // Zonder `HoursPerDay` gold bij het schrijven hpd = eind − begin (spiegel `needsHoursPerDayOverride`).
  const hoursPerDay = hoursPerDayProp ?? (end - start) / 60;
  const reseeded = seedScalarBands(
    start, end, hoursPerDay, calendar.simpleBreakStartMinute, calendar.simpleBreakDurationMinutes,
  );
  if (JSON.stringify(reseeded) !== JSON.stringify(bands)) return undefined;
  return { workStartHour: start / 60, workEndHour: end / 60, hoursPerDay };
}

/** Kalenders die het bestand expliciet als SCALAIR markeert (`IsHourCalendar = .F.`). Per parse
 * aangemaakte objecten als sleutel (zelfde patroon als het bandregister in `subdayIo`), dus niets lekt
 * tussen twee `readIFC`-aanroepen. `applyHourModeIFC` promoveert deze kalenders nooit, en leest de
 * urentaken erop toch minuut-precies. */
const declaredScalarCalendars = new WeakSet<WorkCalendar>();

/**
 * Het STEP-id-signaal
 * dat een `IFCWORKTIME` in `ExceptionTimes` een WERKENDE UITZONDERING is, i.p.v. een feestdag.
 * Spiegel van `writeCalendarGenerationMeta`'s `WorkingExceptionIds`-property in hetzelfde
 * `OPS_Calendar`-pset als generation/libraryOrigin/hoursPerDay. BEWUST geen discriminator op
 * `IfcWorkTime.RecurrencePattern` (args[3]): IFC 4.3 reserveert die ref niet voor werkende
 * uitzonderingen — een spec-conforme externe tool kan een RECURRENTE FEESTDAG ("elke 25 december")
 * met exact zo'n gevulde ref schrijven, en die zou dan zonder deze pset-check als werkdag
 * ingelezen worden. Geen/corrupte property ⇒ `undefined` — de aanroeper valt dan terug op "alles
 * in ExceptionTimes is een feestdag", het conservatieve gedrag voor bestanden zonder deze markering.
 */
function extractCalendarExceptionMetadata(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): {
  workingExceptionIds?: Set<string>;
  p6Source?: 'XER';
  p6NonWorkPenaltyDates?: string[];
  p6NonWorkPenaltyDatesState?: import('@/types/calendar').P6NonWorkPenaltyDatesState;
} {
  for (const props of opsCalendarPsetProps(calStepId, entities, entityMap)) {
    const result: {
      workingExceptionIds?: Set<string>;
      p6Source?: 'XER';
      p6NonWorkPenaltyDates?: string[];
      p6NonWorkPenaltyDatesState?: import('@/types/calendar').P6NonWorkPenaltyDatesState;
    } = {};
    let p6SourceSeen = false;
    let rejectedDiagnosticSeen = false;
    let penaltyState: import('@/types/calendar').P6NonWorkPenaltyDatesState = 'ABSENT';
    let candidatePenaltyDates: string[] | undefined;
    for (const prop of props) {
      const name = stripQuotes(prop.args[0] || '');
      if (name !== 'WorkingExceptionIds' && name !== 'P6Source'
        && name !== 'P6NonWorkPenaltyDates' && name !== 'P6NonWorkPenaltyDatesState') continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value !== 'string' || !value) continue;
      if (name === 'P6NonWorkPenaltyDatesState') {
        if (value === 'REJECTED') rejectedDiagnosticSeen = true;
        continue;
      }
      if (name === 'P6Source') {
        if (value === 'XER') p6SourceSeen = true;
        continue;
      }
      try {
        const parsed = JSON.parse(value);
        if (name === 'WorkingExceptionIds'
          && Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
          result.workingExceptionIds = new Set(parsed);
        } else if (name === 'P6NonWorkPenaltyDates' && Array.isArray(parsed)) {
          const dates = parsed.filter((candidate): candidate is string => {
            if (typeof candidate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return false;
            const date = new Date(`${candidate}T00:00:00Z`);
            return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate;
          });
          if (dates.length === parsed.length) {
            candidatePenaltyDates = [...new Set(dates)];
            penaltyState = candidatePenaltyDates.length === 0 ? 'VALID_EMPTY' : 'VALID_VALUES';
          } else {
            penaltyState = 'REJECTED';
          }
        } else if (name === 'P6NonWorkPenaltyDates') {
          penaltyState = 'REJECTED';
        }
      } catch {
        if (name === 'P6NonWorkPenaltyDates') penaltyState = 'REJECTED';
      }
    }
    if (!rejectedDiagnosticSeen && p6SourceSeen
      && (penaltyState === 'VALID_EMPTY' || penaltyState === 'VALID_VALUES')) {
      result.p6Source = 'XER';
      result.p6NonWorkPenaltyDates = candidatePenaltyDates ?? [];
      result.p6NonWorkPenaltyDatesState = penaltyState;
    } else if (rejectedDiagnosticSeen || p6SourceSeen) {
      // All-or-nothing: ontbrekende of corrupte lijst mag de XER-stempel niet half actief laten.
      result.p6NonWorkPenaltyDatesState = rejectedDiagnosticSeen ? 'REJECTED' : penaltyState;
    }
    return result;
  }
  return {};
}

/** Vereniging van de tijdvakken die twee of meer `IFCWORKTIME`'s ZONDER datum aan dezelfde weekdag geven
 *  (werktijden met een datum doen niet mee, zie `buildCalendarFromEntity`). IFC 4.3
 *  legt overlap tussen werktijden niet vast en OPS schrijft hem nooit; een ander pakket kan wel één
 *  `IFCWORKTIME` per tijdvak schrijven (ma–vr 08–12 en ma–vr 13–17). Canoniek (`end ≤ start` ⇒ wrap,
 *  `+1440`), op begin gesorteerd; overlappende of dubbele tijdvakken worden één vak, aansluitende
 *  (12:00–12:00) blijven twee. */
function unionPeriods(list: ReadonlyArray<{ start: number; end: number }>): { start: number; end: number }[] {
  const sorted = list
    .map(p => ({ start: p.start, end: p.end <= p.start ? p.end + 24 * 60 : p.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: { start: number; end: number }[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && p.start < last.end) last.end = Math.max(last.end, p.end);
    else out.push({ ...p });
  }
  return out;
}

/** Bouwt een `WorkCalendar` uit een `IFCWORKCALENDAR`-entiteit: naam/omschrijving/feestdagen,
 *  plus werkdagen/uren teruggelezen uit de `WorkingTimes`-keten (args[6], oud args[5], zie
 *  `workCalendarSlots` → IFCWORKTIME's → RecurrencePattern-ref → IFCRECURRENCEPATTERN WeekdayComponent
 *  (args[2]) + TimePeriods (args[7]) → IFCTIMEPERIOD start/eind-uur), spiegel van `ifcWriter.ts`
 *  `writeCalendar` (één IFCWORKTIME per groep weekdagen met dezelfde blokken). Golden rule:
 *  ontbreekt de keten (bestand van een ander tool, of geen worktime), dan blijven de
 *  `createDefaultCalendar()`-defaults (ma-vr 07-16) staan. Tot slot de
 *  `OPS_Calendar`-pset → `generation` (legacy/onvolledig ⇒ `undefined`, nooit gegokt).
 *  De argumentposities hangen af van de argumenten van de kalender (`workCalendarSlots`, issue #292):
 *  9 = het schema (WorkingTimes 6), 8 = oudere OPS-versies zonder Identification (WorkingTimes 5). */
function buildCalendarFromEntity(
  cal: StepEntity,
  entityMap: Map<string, StepEntity>,
  entities: StepEntity[],
): WorkCalendar {
  const calendar = createDefaultCalendar();
  calendar.name = ifcSlotText(cal.args[2]) || calendar.name;
  // `ifcSlotText` i.p.v. kale `stripQuotes` — een lege omschrijving schrijft de writer als
  // STEP-null (`$`), en `stripQuotes('$')` geeft het letterlijke tweetekentje `'$'` terug (het start/
  // eindigt niet met een quote, dus de functie laat de string ongewijzigd) i.p.v. '' — dezelfde
  // `$`-conventie die elders via `ifcSlotText` wordt toegepast (bv. project-omschrijving).
  // Bewust GEEN terugval op de omschrijving van `createDefaultCalendar()`: `$` is een lege
  // omschrijving (zoals bij project, taak en resource), geen "onbekend". Die terugval zou van een
  // bewust lege omschrijving na heropenen de standaardtekst van déze machine maken
  // (Bouwmodus-afhankelijk), zodat een bibliotheekkopie onterecht "wijkt af" wordt.
  calendar.description = ifcSlotText(cal.args[3]);
  Object.assign(calendar, extractCalendarSimpleBreak(cal.id, entities, entityMap));
  const hourMeta = extractCalendarHourMeta(cal.id, entities, entityMap);

  // Posities op de argumenten: 9 = het schema (WorkingTimes 6, ExceptionTimes 7, PredefinedType 8),
  // 8 = oudere OPS-versies zonder Identification (5, 6, 7), en 9 met een lijst op Identification = zo'n
  // oud bestand na IfcOpenShell MergeProjects (ook 5, 6, 7). Zie `workCalendarSlots`.
  const calSlots = workCalendarSlots(cal.args);
  // Werkweek + uren. WorkingTimes (`calSlots.workingTimes`) is een SET van IFCWORKTIME's; de
  // holiday-IFCWORKTIME's zitten in ExceptionTimes (`calSlots.exceptionTimes`). Elke IFCWORKTIME met een
  // IFCRECURRENCEPATTERN (args[3]) draagt zijn weekdagen (WeekdayComponent, args[2]) en zijn tijdvakken
  // (TimePeriods, args[7]).
  //  - Een IFCWORKTIME met een StartDate of FinishDate (args[4]/args[5]) doet NIET mee. Datumgebonden
  //    werktijden (een zomer- en een winterweek, een losse werkzaterdag) worden (nog) niet gelezen; als
  //    gewone week zouden ze elke week gelden (07–16 en 08–17 werd 07–17, een losse zaterdag elke
  //    zaterdag). Hieronder valt ook de terugvalweek (StartDate = FinishDate = 1900-01-01) die main tussen
  //    #340 en #344 vooraan schreef; hij zat in geen release, maar zo'n bestand leest hiermee goed. Een
  //    uitgebrachte OPS-versie schreef in `WorkingTimes` nooit een datum (feestdagen en werkende
  //    uitzonderingen staan in `ExceptionTimes`), dus oude OPS-bestanden lezen ongewijzigd.
  //  - Blijft er zo geen patroon over (ALLE werktijden hebben een datum, bijv. één week 08–16 van
  //    2026-01-01 t/m 2027-12-31), dan het eerste patroon met een datum, zoals de lezer vóór de indeling
  //    per weekdag deed. Anders kreeg zo'n kalender de standaardweek (07–16).
  //  - Twee of meer zulke patronen MET weekdagen: werkblokken die per weekdag verschillen (zo schrijft
  //    `weekBandGroups` een korte vrijdag, en zo modelleert IFC 4.3 het zelf, `IfcWorkCalendar` figuur 1).
  //    Elke dag krijgt de tijdvakken van zijn eigen patroon; `workDays` is de vereniging. Staat een
  //    weekdag in meer patronen (IFC legt overlap niet vast; OPS schrijft het nooit), dan de vereniging
  //    van hun tijdvakken (`unionPeriods`) — zo leest ook een bestand met één IFCWORKTIME per tijdvak
  //    goed. Patronen zonder weekdagen doen dan niet mee.
  //  - Anders het eerste patroon, op elke weekdag dezelfde tijdvakken: ongewijzigd t.o.v. vroeger, ook
  //    voor bestanden van oudere OPS-versies (één IFCWORKTIME) en voor één DAILY-patroon zonder weekdagen.
  const workTimeRefs = parseRefs(cal.args[calSlots.workingTimes] || '');
  const recurrences: StepEntity[] = [];
  const datedRecurrences: StepEntity[] = []; // datumgebonden: zie hierboven
  for (const wtRef of workTimeRefs) {
    const wt = entityMap.get(wtRef);
    if (!wt || wt.type !== 'IFCWORKTIME') continue;
    const recurrenceRef = parseRef(wt.args[3] || '');
    if (!recurrenceRef) continue;
    const rec = entityMap.get(recurrenceRef);
    if (!rec || rec.type !== 'IFCRECURRENCEPATTERN') continue;
    (workTimeDateRange(wt) ? datedRecurrences : recurrences).push(rec);
  }
  if (recurrences.length === 0 && datedRecurrences.length > 0) recurrences.push(datedRecurrences[0]);
  const weekRecurrences = recurrences.filter(rec => parseIntList(rec.args[2] || '').length > 0);
  // ALLE TimePeriods van één patroon (`TimePeriods` is native een lijst — pauze/split-shift).
  const readPeriods = (timePeriodRefs: string[]): { start: number; end: number }[] => {
    const out: { start: number; end: number }[] = [];
    for (const tpRef of timePeriodRefs) {
      const tp = entityMap.get(tpRef);
      if (!tp || tp.type !== 'IFCTIMEPERIOD') continue;
      const s = clockToMinutes(stripQuotes(tp.args[0] || ''));
      const e = clockToMinutes(stripQuotes(tp.args[1] || ''));
      if (s != null && e != null) out.push({ start: s, end: e });
    }
    return out;
  };
  let periods: { start: number; end: number }[] = []; // de banden van de scalaire dag (minuten)
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const perDayWeek = weekRecurrences.length > 1;
  if (perDayWeek) {
    const listsByDay = new Map<number, { start: number; end: number }[][]>();
    for (const rec of weekRecurrences) {
      const recPeriods = readPeriods(parseRefs(rec.args[7] || ''));
      for (const d of parseIntList(rec.args[2] || '')) {
        if (d < 1 || d > 7) continue;
        const lists = listsByDay.get(d) ?? [];
        lists.push(recPeriods);
        listsByDay.set(d, lists);
      }
    }
    const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
    for (const [d, lists] of listsByDay) {
      const dayPeriods = lists.length === 1 ? lists[0].map(p => ({ ...p })) : unionPeriods(lists.flat());
      byWeekday[d as 1] = dayPeriods;
      rawByWeekday[d as 1] = dayPeriods;
    }
    const unionDays = [...listsByDay.keys()].sort((a, b) => a - b);
    if (unionDays.length > 0) calendar.workDays = unionDays;
    // De scalaire dag: de eerste werkdag met blokken in de volgorde van de MSPDI- en `.mpp`-lezer
    // (`firstBlockedDay`: zondag, dan maandag t/m zaterdag) — onafhankelijk van de volgorde in de SET.
    periods = (firstBlockedDay({ byWeekday }) ?? []).map(p => ({ ...p }));
    if (periods.length === 1) {
      // Eén blok: dezelfde afleiding als een enkele periode hieronder, via de klok die de schrijver
      // voor dit blok schrijft.
      const startHour = scalarHourFromClock(minutesToClock(periods[0].start));
      const endHour = scalarHourFromClock(minutesToClock(periods[0].end, true));
      calendar.workStartHour = startHour;
      calendar.workEndHour = endHour;
      if (endHour > startHour) calendar.hoursPerDay = endHour - startHour;
    }
  } else if (recurrences.length > 0) {
    const rec = recurrences[0];
    const workDays = parseIntList(rec.args[2] || '');
    if (workDays.length > 0) calendar.workDays = workDays;

    const timePeriodRefs = parseRefs(rec.args[7] || '');
    periods = readPeriods(timePeriodRefs);
    // Meer periodes: scalar = begin eerste / einde laatste periode (fix werkdag-einde, 2026-10) — zie
    // hieronder. Eén periode: scalar uit die periode, de oude afleiding (ook voor oude klokken als
    // '7.5:00:00'). Houdt de dag-kalender scalair (de post-pass promoveert pas naar uur-modus bij een
    // echte afwijking, discriminator a/b/c).
    if (timePeriodRefs.length === 1) {
      const tp = entityMap.get(timePeriodRefs[0]);
      if (tp && tp.type === 'IFCTIMEPERIOD') {
        const startHour = scalarHourFromClock(stripQuotes(tp.args[0] || ''));
        const endHour = scalarHourFromClock(stripQuotes(tp.args[1] || ''));
        if (Number.isFinite(startHour)) calendar.workStartHour = startHour;
        if (Number.isFinite(endHour)) calendar.workEndHour = endHour;
        if (Number.isFinite(startHour) && Number.isFinite(endHour) && endHour > startHour) {
          calendar.hoursPerDay = endHour - startHour;
        }
      }
    }
    // Dezelfde periodes op elke werkdag van het patroon (zonder weekdagen: de standaardwerkdagen).
    const days = (workDays.length > 0 ? workDays : calendar.workDays).filter(d => d >= 1 && d <= 7);
    for (const d of days) rawByWeekday[d as 1] = periods.map(p => ({ ...p }));
  } else {
    // Geen patroon: de standaardwerkdagen zonder blokken (zoals vroeger).
    for (const d of calendar.workDays.filter(d => d >= 1 && d <= 7)) rawByWeekday[d as 1] = [];
  }
  // Rauwe banden per weekdag, gecanonicaliseerd + afwijking (a/b) — voor de uur-modus-post-pass.
  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  // Meer periodes op de scalaire dag (een uurkalender, of de gematerialiseerde blokken van een
  // scalaire kalender): begin van de eerste en einde van de laatste periode op begintijd, met de
  // middernachtregel, en NETTO uren als tussenwaarde — één definitie met de MSPDI- en `.mpp`-lezer
  // (`workDayFromBlocks`). Meer periodes op de scalaire dag ⇒ discriminator (a) ⇒ de post-pass promoveert
  // de kalender en zet `hoursPerDay` op de modale dagsom (`promoteHourCalendar`); bij blokken die per
  // weekdag verschillen is dat dus ook zo. Vroeger de eerste periode: MS Projects 08:00–12:00 + 13:00–17:00 werd
  // 8–12, een drieploegenkalender 6–14. Een OPS-bestand dat die oude scalar bewaarde, draagt geen
  // `WorkEndHour` (de schrijver bewaart hem alleen als hij afwijkt van de eerste periode) en herstelt dus
  // hier vanzelf. Netto alleen als de kalender niet als SCALAIR gemarkeerd is (`IsHourCalendar = .F.`):
  // daar zijn de periodes de afgeleide blokken van de scalar van de gebruiker, en geldt de oude afspraak
  // met de schrijver (`HoursPerDay` ontbreekt ⇔ hpd = einde − begin, `needsHoursPerDayOverride`).
  const blocked = periods.length > 1 ? workDayFromBlocks(periods) : undefined;
  const netHours = blocked && hourMeta.hourMode !== false ? blocked.netHours : undefined;
  if (blocked) {
    calendar.workStartHour = blocked.startHour;
    calendar.workEndHour = blocked.endHour;
    calendar.hoursPerDay = netHours ?? (blocked.endHour > blocked.startHour ? blocked.endHour - blocked.startHour : calendar.hoursPerDay);
  }
  // Expliciete scalar werktijd (alleen geschreven waar de eerste periode hem niet teruggeeft). De
  // afgeleide hpd volgt dan de echte scalar — precies de `workEndHour − workStartHour` waartegen de
  // writer `needsHoursPerDayOverride` toetst; een expliciete `HoursPerDay` wint hieronder nog steeds.
  if (hourMeta.workStartHour !== undefined || hourMeta.workEndHour !== undefined) {
    if (hourMeta.workStartHour !== undefined) calendar.workStartHour = hourMeta.workStartHour;
    if (hourMeta.workEndHour !== undefined) calendar.workEndHour = hourMeta.workEndHour;
    // Bij meer periodes blijft de tussenwaarde netto (de som van de blokken); een expliciete
    // `HoursPerDay` wint hieronder nog steeds.
    if (netHours !== undefined) calendar.hoursPerDay = netHours;
    else if (calendar.workEndHour > calendar.workStartHour) {
      calendar.hoursPerDay = calendar.workEndHour - calendar.workStartHour;
    }
  }

  // Rauwe banden registreren (per weekdag, zie hierboven), voor de uur-modus-post-pass.
  registerCalendarBands(calendar, { canonical: bands, deviates });

  // Ploeg-classificatie uit `PredefinedType` → `shift`. `.FIRSTSHIFT.`/afwezig ⇒
  // undefined (de schrijver emitteert `.FIRSTSHIFT.` voor undefined).
  const predef = (cal.args[calSlots.predefinedType] || '').toUpperCase();
  if (predef.includes('SECONDSHIFT')) calendar.shift = 'SECOND';
  else if (predef.includes('THIRDSHIFT')) calendar.shift = 'THIRD';
  else if (predef.includes('USERDEFINED')) calendar.shift = 'USERDEFINED';

  // ExceptionTimes draagt zowel feestdagen als werkende uitzonderingen. Het onderscheid is de
  // OPS-pset-markering (`extractWorkingExceptionStepIds`), NIET de aanwezigheid van een gevulde
  // RecurrencePattern-ref (args[3]): een spec-conforme externe tool kan een RECURRENTE FEESTDAG
  // ("elke 25 december") met precies zo'n gevulde ref schrijven, en die zou dan zonder deze
  // pset-check als WERKDAG worden ingelezen. Geen markering (ouder eigen bestand, of extern) ⇒
  // alles in ExceptionTimes
  // is een feestdag, óók met een gevulde recurrence-ref.
  const calendarExceptionMetadata = extractCalendarExceptionMetadata(cal.id, entities, entityMap);
  const workingExceptionIds = calendarExceptionMetadata.workingExceptionIds;
  const exceptionRefs = parseRefs(cal.args[calSlots.exceptionTimes] || '');
  const holidays: Holiday[] = [];
  const workingExceptions: WorkingException[] = [];
  for (const ref of exceptionRefs) {
    const wt = entityMap.get(ref);
    if (!wt || wt.type !== 'IFCWORKTIME') continue;
    // Start-/FinishDate zijn OPTIONEEL in IfcWorkTime. Een leeg slot mag geen "vandaag" worden (dat
    // verzint een feestdag op de leesdatum): één datum ⇒ die ene dag, geen datum ⇒ geen uitzondering.
    const range = workTimeDateRange(wt);
    if (!range) continue;
    if (!workingExceptionIds?.has(ref)) {
      holidays.push({
        name: ifcSlotText(wt.args[0]) || 'Feestdag',
        ...range,
      });
      continue;
    }
    // OPS-gemarkeerd als werkende uitzondering. De banden zitten — indien geschreven — nog steeds
    // in de RecurrencePattern-ref (args[3] → TimePeriods, args[7]); DayComponent is hier altijd
    // leeg. Canoniseren naar `end > start` (`WorkingException.bands`): een
    // wrap-band komt als tijd-van-de-dag terug (`e ≤ s`) en krijgt hier `+1440` terug, precies
    // zoals de hoofd-werktijdlus hierboven het aan `canonicalizeBands` overlaat.
    const bands: { start: number; end: number }[] = [];
    const excRecRef = parseRef(wt.args[3] || '');
    if (excRecRef) {
      const excRec = entityMap.get(excRecRef);
      if (excRec && excRec.type === 'IFCRECURRENCEPATTERN') {
        for (const bRef of parseRefs(excRec.args[7] || '')) {
          const tp = entityMap.get(bRef);
          if (!tp || tp.type !== 'IFCTIMEPERIOD') continue;
          const s = clockToMinutes(stripQuotes(tp.args[0] || ''));
          let e = clockToMinutes(stripQuotes(tp.args[1] || ''));
          if (s != null && e != null) {
            if (e <= s) e += 1440;
            bands.push({ start: s, end: e });
          }
        }
      }
    }
    workingExceptions.push({
      name: ifcSlotText(wt.args[0]) || 'Werkende uitzondering',
      ...range,
      ...(bands.length > 0 ? { bands } : {}),
    });
  }
  // `calendar.holidays` is VERPLICHT; een lege lijst betekent "geen feestdagen", niet "veld
  // ontbrak". Deze functie draait alleen als de `IFCWORKCALENDAR` zelf bestaat, dus de gelezen lijst
  // is de volledige waarheid — ook leeg. Een `length > 0`-guard zou de
  // `createDefaultCalendar()`-defaults (NL-feestdagen) laten staan: een `.mpp` met 0 feestdagen
  // kreeg ze dan bij de eerste IFC-save alsnog. `workingExceptions` blijft WEL conditioneel: dat
  // veld is optioneel en alle lezers houden "geen uitzonderingen" op `undefined`.
  calendar.holidays = holidays;
  if (workingExceptions.length > 0) calendar.workingExceptions = workingExceptions;
  if (calendarExceptionMetadata.p6Source === 'XER') {
    calendar.p6Source = 'XER';
    calendar.p6NonWorkPenaltyDates = calendarExceptionMetadata.p6NonWorkPenaltyDates ?? [];
  }
  if (calendarExceptionMetadata.p6NonWorkPenaltyDatesState) {
    calendar.p6NonWorkPenaltyDatesState = calendarExceptionMetadata.p6NonWorkPenaltyDatesState;
  }

  // Golden rule: createDefaultCalendar() zet altijd `generation` (nieuwe projecten zijn
  // per definitie gegenereerd) — een uit IFC gelezen kalender is dat NIET tenzij de OPS_Calendar-
  // pset het expliciet zegt. Eerst wissen, dan (evt.) invullen uit de pset.
  delete calendar.generation;
  calendar.generation = extractCalendarGeneration(cal.id, entities, entityMap);
  calendar.libraryOrigin = extractCalendarLibraryOrigin(cal.id, entities, entityMap);

  // Expliciete `HoursPerDay` uit het `OPS_Calendar`-pset heeft
  // voorrang boven de hierboven afgeleide `workEndHour − workStartHour` (die alleen een fallback
  // is voor bestanden zonder deze pset-waarde — legacy/andere tools). Golden rule: ontbreekt de
  // property, dan blijft de derivatie hierboven ongewijzigd staan.
  const hpdOverride = extractCalendarHoursPerDay(cal.id, entities, entityMap);
  if (hpdOverride != null) calendar.hoursPerDay = hpdOverride;
  if (hourMeta.hourMode === true) {
    // `promoteHourCalendar` zet `hoursPerDay` op de modale dagsom van de blokken; een expliciete
    // `HoursPerDay` wint daarna. Alleen bij deze markering: zie docs/ifc-round-trip.md, "Uren per dag
    // bij een blokkenkalender".
    promoteHourCalendar(calendar, getCalendarBands(calendar), true, true);
    if (hpdOverride != null) calendar.hoursPerDay = hpdOverride;
  } else if (hourMeta.hourMode === false) {
    declaredScalarCalendars.add(calendar);
  } else if (hourMeta.workStartHour === undefined && hourMeta.workEndHour === undefined) {
    // Geen `IsHourCalendar`-markering: herken een scalaire kalender die een oudere OPS-versie
    // schreef (herkennen en herstellen, zonder melding).
    const legacy = legacyScalarFromEffectiveBands(periods, calendar, hpdOverride);
    if (legacy) {
      Object.assign(calendar, legacy);
      declaredScalarCalendars.add(calendar);
    }
  }

  return calendar;
}

/**
 * Kalender-bibliotheek teruglezen: alle `IFCWORKCALENDAR`-entiteiten behalve degene die
 * `extractCalendar` al als projectkalender heeft gepakt (de eerste in het bestand, conform
 * `writeIFC`).
 *
 * Onderscheid taken-vs-resources via `IFCRELASSIGNSTOCONTROL.RelatedObjects`: de writer schrijft
 * per bibliotheek-kalender twee LOSSE rel-entiteiten (één met resource-refs, één met taak-refs),
 * dus elke rel resolvet hier via precies één van de twee maps. Eén kalender kan zo door zowel een
 * resource- als een taak-rel worden aangewezen — de STEP-id van het `IFCWORKCALENDAR` dedupt de
 * kalender zelf (`calByStepId`) zodat hij maar één keer in de bibliotheek terechtkomt.
 *
 * Retourneert ook `idByGuid` (`IFCWORKCALENDAR.GlobalId` → onze verse `WorkCalendar.id`): de
 * stabiele, unieke sleutel waarmee `extractTimephasedDurationWalksMeta` `resourceCalendarId`
 * vertaalt (kalendernamen zijn niet uniek).
 */
function extractCalendarLibrary(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
  guidLog: Record<string, string>,
): { calendars: WorkCalendar[]; idByGuid: Map<string, string> } {
  const projectCalendarEntity = entities.find(e => e.type === 'IFCWORKCALENDAR');
  // De projectkalender heet altijd 'cal-default' (`extractCalendar`); een bibliotheekkalender kan
  // die naam nooit krijgen, ook niet via een afgeleid id.
  const usedIds = new Set<string>([DEFAULT_CALENDAR_ID]);
  const resourceById = new Map(resources.map(r => [r.id, r]));
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const calendars: WorkCalendar[] = [];
  const calByStepId = new Map<string, WorkCalendar>(); // IFCWORKCALENDAR STEP-id -> onze kalender
  const idByGuid = new Map<string, string>(); // IFCWORKCALENDAR.GlobalId -> onze kalender-id

  for (const ce of entities) {
    if (ce.type !== 'IFCRELASSIGNSTOCONTROL') continue;
    const controlRef = parseRef(ce.args[6] || '');
    if (!controlRef) continue;
    const controlEntity = entityMap.get(controlRef);
    if (!controlEntity || controlEntity.type !== 'IFCWORKCALENDAR') continue;
    if (projectCalendarEntity && controlRef === projectCalendarEntity.id) continue; // projectkalender, geen bibliotheek-entry

    let cal = calByStepId.get(controlRef);
    if (!cal) {
      cal = buildCalendarFromEntity(controlEntity, entityMap, entities);
      cal.id = stableIdFromGuid('cal', 'rescal', controlEntity, usedIds, guidLog);
      calByStepId.set(controlRef, cal);
      calendars.push(cal);
      idByGuid.set(stripQuotes(controlEntity.args[0] || ''), cal.id);
    }

    const relatedRefs = parseRefs(ce.args[4] || '');
    for (const r of relatedRefs) {
      const resId = resourceStepIdMap.get(r);
      if (resId) {
        const res = resourceById.get(resId);
        if (res) res.calendarId = cal.id;
        continue;
      }
      const taskId = taskStepIdMap.get(r);
      if (taskId) {
        const task = taskById.get(taskId);
        if (task) task.calendarId = cal.id;
      }
    }
  }

  // Bibliotheekkalenders ZONDER gebruiker. De lus hierboven vindt kalenders uitsluitend via
  // IFCRELASSIGNSTOCONTROL (wie 'm gebruikt). Een gepromote/toegevoegde kalender die nog geen
  // resource-/taak-toewijzing heeft — het normale "voeg toe vóór toewijzing"-patroon — wordt wel door
  // writeIFC geschreven maar zou hier niet teruggevonden worden (stil verlies incl.
  // libraryOrigin-stempel). Vang daarom álle overige IFCWORKCALENDAR-entiteiten (behalve de
  // projectkalender) op, gededupliceerd tegen wat de rel-route al vond (calByStepId), met behoud van
  // bestandsvolgorde (rel-gevonden eerst, ongebruikte daarna).
  for (const ce of entities) {
    if (ce.type !== 'IFCWORKCALENDAR') continue;
    if (projectCalendarEntity && ce.id === projectCalendarEntity.id) continue;
    if (calByStepId.has(ce.id)) continue;
    const cal = buildCalendarFromEntity(ce, entityMap, entities);
    cal.id = stableIdFromGuid('cal', 'rescal', ce, usedIds, guidLog);
    calByStepId.set(ce.id, cal);
    calendars.push(cal);
    idByGuid.set(stripQuotes(ce.args[0] || ''), cal.id);
  }

  return { calendars, idByGuid };
}

interface AssignmentMeta {
  unitsPerDay: number;
  curve?: ResourceCurve;
}

/** Eén gelezen timephased-venster (`OPS_Timephased`, spiegel van `writeTimephasedMeta`). */
interface WindowMeta {
  workWindowStart?: string;
  workWindowFinish?: string;
  /** Exacte 21-punts curve, zie `ResourceAssignment.curveValues`. */
  curveValues?: number[];
  /** De drie optionele werkvelden in minuten, zelfde blob. */
  plannedWorkMinutes?: number;
  actualWorkMinutes?: number;
  remainingWorkMinutes?: number;
  /** Begroot tempo naast een P6-resttempo, zie `ResourceAssignment.plannedUnitsPerDay`. */
  plannedUnitsPerDay?: number;
}

/** Eindig, niet-negatief werkgetal uit het JSON-blob; al het andere blijft weg (nooit NaN in de state). */
function workMinutesOf(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** Per-taak verzamelde OPS_Assignments-meta: nieuw formaat (`GUID#N`-propnamen) als
 *  geordende wachtrij per resource-GUID, oud formaat (kale GUID) als één meta per GUID. */
interface TaskAssignmentMeta {
  /** Nieuw formaat: resource-GUID -> metas gesorteerd op `#N`-volgnummer. Meerdere
   *  assignments van dezelfde resource op één taak consumeren de wachtrij in volgorde —
   *  de `IFCRELASSIGNSTOPROCESS.RelatedObjects`-volgorde en de `#N`-volgorde komen uit
   *  dezelfde bron (de assignments-array, zie writeAssignments/writeAssignmentMeta), dus
   *  ze lopen per resource synchroon. */
  queues: Map<string, AssignmentMeta[]>;
  /** Legacy formaat (oudere bestanden): kale resource-GUID als propnaam, max één meta
   *  per GUID (het oude last-wins-gedrag — meer valt uit zo'n bestand niet te herstellen). */
  legacy: Map<string, AssignmentMeta>;
}

/**
 * `OPS_Assignments`-pset teruglezen (spiegel van `writeAssignmentMeta`):
 * property-naam = `"<resource-GUID>#<volgnummer>"` (nieuw formaat: uniek per assignment, zodat
 * dubbele assignments van dezelfde resource op één taak niet last-wins-dedupen) óf de kale
 * resource-GUID (legacy, oudere bestanden); waarde =
 * `"unitsPerDay|curve"`. Ontbreekt de pset-entry (legacy bestand) dan geldt de bestaande
 * fallback `unitsPerDay: 1, curve: undefined`.
 *
 * Leest in dezelfde sweep ook `OPS_Timephased` — het
 * timephased-venster (`workWindowStart`/`workWindowFinish`) per assignment, spiegel van
 * `writeTimephasedMeta`. Aparte pset, zelfde `GUID#N`-sleutelconventie, geen wijziging aan het
 * `OPS_Assignments`-pipe-formaat hierboven.
 */
function extractAssignments(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
  resourceStepIdMap: Map<string, string>,
): ResourceAssignment[] {
  // 1. OPS_Assignments-psets per taak verzamelen: taskStepRef -> TaskAssignmentMeta.
  const metaByTask = new Map<string, TaskAssignmentMeta>();
  // OPS_Timephased-psets per taak verzamelen: taskStepRef -> resource-GUID -> wachtrij
  // van WindowMeta (zelfde `GUID#N`-volgnummer-conventie als de queues hierboven, maar dan uit
  // één JSON-blob-property ('Windows') i.p.v. losse IFCPROPERTYSINGLEVALUE's per assignment).
  const windowsByTask = new Map<string, Map<string, WindowMeta[]>>();
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    const psetName = stripQuotes(pset.args[2] || '');

    if (psetName === PSET.Timephased) {
      const windowProp = parseRefs(pset.args[4] || '')
        .map(r => entityMap.get(r))
        .find((p): p is StepEntity =>
          !!p && p.type === 'IFCPROPERTYSINGLEVALUE' && stripQuotes(p.args[0] || '') === 'Windows');
      const raw = windowProp ? parseTypedValue(windowProp.args[2] || '') : undefined;
      if (typeof raw !== 'string' || !raw) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { continue; }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const indexed: { guid: string; index: number; meta: WindowMeta }[] = [];
      for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        const m = key.match(/^(.+)#(\d+)$/);
        if (!m || !val || typeof val !== 'object') continue;
        const vv = val as Record<string, unknown>;
        const curveValues = normalizeCurveValues(vv.curveValues);
        const planned = workMinutesOf(vv.plannedWorkMinutes);
        const actual = workMinutesOf(vv.actualWorkMinutes);
        const remaining = workMinutesOf(vv.remainingWorkMinutes);
        // Zelfde validatie als de werkvelden: eindig en niet-negatief, anders weg (nooit NaN).
        const plannedUnits = workMinutesOf(vv.plannedUnitsPerDay);
        const meta: WindowMeta = {
          ...(typeof vv.workWindowStart === 'string' ? { workWindowStart: vv.workWindowStart } : {}),
          ...(typeof vv.workWindowFinish === 'string' ? { workWindowFinish: vv.workWindowFinish } : {}),
          ...(curveValues ? { curveValues } : {}),
          ...(planned !== undefined ? { plannedWorkMinutes: planned } : {}),
          ...(actual !== undefined ? { actualWorkMinutes: actual } : {}),
          ...(remaining !== undefined ? { remainingWorkMinutes: remaining } : {}),
          ...(plannedUnits !== undefined ? { plannedUnitsPerDay: plannedUnits } : {}),
        };
        if (Object.keys(meta).length === 0) continue;
        indexed.push({ guid: m[1], index: parseInt(m[2], 10), meta });
      }
      indexed.sort((a, b) => a.index - b.index);
      for (const objRef of parseRefs(rel.args[4] || '')) {
        let taskWindows = windowsByTask.get(objRef);
        if (!taskWindows) { taskWindows = new Map(); windowsByTask.set(objRef, taskWindows); }
        for (const { guid, meta } of indexed) {
          let queue = taskWindows.get(guid);
          if (!queue) { queue = []; taskWindows.set(guid, queue); }
          queue.push(meta);
        }
      }
      continue;
    }

    if (psetName !== PSET.Assignments) continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const objRef of parseRefs(rel.args[4] || '')) {
      let taskMeta = metaByTask.get(objRef);
      if (!taskMeta) {
        taskMeta = { queues: new Map(), legacy: new Map() };
        metaByTask.set(objRef, taskMeta);
      }
      // Nieuw formaat eerst indexeren zodat de wachtrij op volgnummer gesorteerd wordt
      // (de STEP-property-volgorde in de pset is in de praktijk al de schrijfvolgorde,
      // maar de expliciete `#N` is de autoritaire volgorde).
      const indexed: { guid: string; index: number; meta: AssignmentMeta }[] = [];
      for (const prop of props) {
        const propName = stripQuotes(prop.args[0] || '');
        const value = parseTypedValue(prop.args[2] || '');
        if (typeof value !== 'string') continue;
        const [unitsRaw, curveRaw] = value.split('|');
        const unitsPerDay = parseFloat(unitsRaw);
        const curve = isResourceCurve(curveRaw) ? curveRaw : undefined;
        const meta: AssignmentMeta = { unitsPerDay: Number.isFinite(unitsPerDay) ? unitsPerDay : 1, curve };
        // `#` komt nooit voor in een IFC-GlobalId (charset [0-9A-Za-z_$]), dus een
        // `GUID#N`-match is eenduidig nieuw formaat; al het andere is legacy kale-GUID.
        const m = propName.match(/^(.+)#(\d+)$/);
        if (m) {
          indexed.push({ guid: m[1], index: parseInt(m[2], 10), meta });
        } else {
          taskMeta.legacy.set(propName, meta);
        }
      }
      indexed.sort((a, b) => a.index - b.index);
      for (const { guid, meta } of indexed) {
        let queue = taskMeta.queues.get(guid);
        if (!queue) { queue = []; taskMeta.queues.set(guid, queue); }
        queue.push(meta);
      }
    }
  }

  // 2. IFCRELASSIGNSTOPROCESS: task <-> resources, met de meta uit stap 1 erbij.
  const assignEntities = entities.filter(e => e.type === 'IFCRELASSIGNSTOPROCESS');
  const assignments: ResourceAssignment[] = [];

  for (const ae of assignEntities) {
    const taskRef = parseRef(ae.args[6] || '');
    if (!taskRef) continue;
    const taskId = taskStepIdMap.get(taskRef);
    if (!taskId) continue;
    const taskMeta = metaByTask.get(taskRef);

    const resRefs = parseRefs(ae.args[4] || '');
    for (const resRef of resRefs) {
      const resId = resourceStepIdMap.get(resRef);
      if (!resId) continue;

      const resEntity = entityMap.get(resRef);
      const resGuid = resEntity ? stripQuotes(resEntity.args[0] || '') : '';
      // Nieuw formaat: consumeer de volgende meta uit de wachtrij voor deze resource
      // (elke herhaling van dezelfde resource in RelatedObjects is een eigen assignment);
      // val terug op de legacy kale-GUID-meta voor oudere bestanden.
      const meta = taskMeta?.queues.get(resGuid)?.shift() ?? taskMeta?.legacy.get(resGuid);
      // Timephased-venster, zelfde wachtrij-consumptie als `meta` hierboven (geen legacy-tak:
      // OPS_Timephased heeft altijd de `GUID#N`-sleutels gebruikt).
      const window = windowsByTask.get(taskRef)?.get(resGuid)?.shift();

      // 'UNIFORM' is de writer-default (a.curve ?? 'UNIFORM') — canonicaliseer terug naar
      // undefined zodat undefined en 'UNIFORM' round-trippen naar dezelfde waarde
      // (Resource-Assignment.curve: "undefined = UNIFORM", zie src/types/resource.ts).
      assignments.push({
        id: generateId('asgn'),
        taskId,
        resourceId: resId,
        unitsPerDay: meta?.unitsPerDay ?? 1,
        ...(window?.plannedUnitsPerDay !== undefined ? { plannedUnitsPerDay: window.plannedUnitsPerDay } : {}),
        ...(meta?.curve && meta.curve !== 'UNIFORM' ? { curve: meta.curve } : {}),
        ...(window?.workWindowStart !== undefined ? { workWindowStart: window.workWindowStart } : {}),
        ...(window?.workWindowFinish !== undefined ? { workWindowFinish: window.workWindowFinish } : {}),
        ...(window?.curveValues !== undefined ? { curveValues: window.curveValues } : {}),
        ...(window?.plannedWorkMinutes !== undefined ? { plannedWorkMinutes: window.plannedWorkMinutes } : {}),
        ...(window?.actualWorkMinutes !== undefined ? { actualWorkMinutes: window.actualWorkMinutes } : {}),
        ...(window?.remainingWorkMinutes !== undefined ? { remainingWorkMinutes: window.remainingWorkMinutes } : {}),
      });
    }
  }

  return assignments;
}

/** Zie de aanroepplek in `readIFC`. Muteert de contouren in-place. */
function remapContourResourceIds(
  tasks: Task[], resourceGuidMap: Map<string, string>, resourceIds: ReadonlySet<string>,
): void {
  for (const task of tasks) {
    if (!task.timephasedContours) continue;
    for (const contour of task.timephasedContours) {
      if (contour.resourceId === undefined) continue;
      const mapped = mappedResourceId(resourceGuidMap, resourceIds, contour.resourceId);
      if (mapped) contour.resourceId = mapped;
    }
  }
}

/**
 * Nivellering (fundament): `schedulingOptions.leveling.resources[].resourceId` draagt de resource-id
 * van het geschreven document; de lezer leidt resource-ids af uit het GlobalId, dus terugmappen via
 * dezelfde GlobalId die `writeResource` voor dat id gebruikte (spiegel van `remapContourResourceIds`). Een id
 * zonder resource in dit bestand blijft letterlijk staan (data, geen rekeninvoer).
 */
function remapLevelingResourceIds(
  options: ProjectSchedulingOptions, resourceGuidMap: Map<string, string>, resourceIds: ReadonlySet<string>,
): void {
  for (const entry of options.leveling?.resources ?? []) {
    const mapped = mappedResourceId(resourceGuidMap, resourceIds, entry.resourceId);
    if (mapped) entry.resourceId = mapped;
  }
}


/**
 * Verzamel de STEP-#id's van taken die onder een `.BASELINE.`-IfcWorkSchedule hangen
 * OPS zelf hangt géén taken onder baseline-schema's (de datums leven in de OPS_Baselines-
 * JSON), maar externe tools kunnen dat wél doen; die taken zijn baseline-snapshots, geen live
 * taken, en mogen niet als echte taak worden ingeladen. Koppeling via IFCRELNESTS (RelatingObject
 * = het schema) of IFCRELASSIGNSTOCONTROL (control = het schema). PredefinedType `.BASELINE.` staat
 * op arg-index 13 van IFCWORKSCHEDULE (schema en IFC2X3, daar als WorkControlType), of 14 in
 * bestanden van oudere OPS-versies (`isBaselineSchedule`, `workControlSlots`).
 *
 * Review #336 (sinds de herkenning ook bij 14 argumenten werkt, dus bij bestanden van andere pakketten):
 *  - Alleen uitsluiten als er óók een gewoon (niet-baseline) werkschema is, met minstens één taak
 *    eronder. Anders is het baselineschema de enige planning in het bestand, en dan zijn die taken
 *    de taken (herbeoordeling #336: een leeg gewoon werkschema gaf anders een leeg project).
 *  - De hele boom onder het baselineschema gaat mee (kinderen via IFCRELNESTS, transitief), zoals
 *    Bonsai een werkschema opbouwt: één wortel per schema, de rest genest. Anders blijven de kinderen
 *    als losse dubbele taken over.
 *  - Een taak die (ook) onder het gewone schema hangt, is een live taak en blijft.
 */
function collectBaselineTaskStepIds(entities: StepEntity[]): Set<string> {
  const baselineSchedIds = new Set<string>();
  const liveSchedIds = new Set<string>();
  for (const e of entities) {
    if (e.type === 'IFCWORKSCHEDULE') (isBaselineSchedule(e) ? baselineSchedIds : liveSchedIds).add(e.id);
  }
  const taskStepIds = new Set<string>();
  if (baselineSchedIds.size === 0 || liveSchedIds.size === 0) return taskStepIds;

  const baselineRoots: string[] = [];
  const liveRoots: string[] = [];
  const nestedUnder = new Map<string, string[]>();
  for (const e of entities) {
    if (e.type === 'IFCRELNESTS') {
      const relating = parseRef(e.args[4] || '');
      if (!relating) continue;
      const related = parseRefs(e.args[5] || '');
      if (baselineSchedIds.has(relating)) baselineRoots.push(...related);
      else if (liveSchedIds.has(relating)) liveRoots.push(...related);
      else nestedUnder.set(relating, [...(nestedUnder.get(relating) ?? []), ...related]);
    } else if (e.type === 'IFCRELASSIGNSTOCONTROL') {
      const control = parseRef(e.args[6] || '');
      if (!control) continue;
      const related = parseRefs(e.args[4] || '');
      if (baselineSchedIds.has(control)) baselineRoots.push(...related);
      else if (liveSchedIds.has(control)) liveRoots.push(...related);
    }
  }
  const tree = (roots: string[]): Set<string> => {
    const seen = new Set<string>();
    const todo = [...roots];
    while (todo.length > 0) {
      const id = todo.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      todo.push(...(nestedUnder.get(id) ?? []));
    }
    return seen;
  };
  const live = tree(liveRoots);
  if (live.size === 0) return taskStepIds;
  for (const id of tree(baselineRoots)) if (!live.has(id)) taskStepIds.add(id);
  return taskStepIds;
}

/**
 * Baselines teruglezen uit het autoritatieve `OPS_Baselines`-JSON (spiegel van
 * `writeBaselineMeta`). De JSON bewaart per baseline-taak de INTERNE `taskId` van t.t.v. opslaan;
 * bij het inlezen zijn de taak-id's her-gegenereerd, dus we mappen elke `taskId` deterministisch
 * terug via de meegeschreven `TaskGuids`-map (oudere bestanden: `ifcGuid(taskId)`) → de
 * IFCTASK-GlobalId → de nieuwe id. Baseline-taken zonder match
 * (taak sindsdien verwijderd) behouden hun oude id en tonen later als "vervallen" in de variance.
 */
function extractBaselines(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
): { baselines: Baseline[]; activeBaselineId: string | null; comparedBaselineIds: ComparedBaselineIds } {
  // GlobalId → nieuwe taak-id (voor de taskId-remap).
  const guidToTaskId = new Map<string, string>();
  for (const e of entities) {
    if (e.type !== 'IFCTASK') continue;
    const newId = taskStepIdMap.get(e.id);
    // GlobalId (slot-index 0, ongevoelig voor de 12/13-arg-lay-out) via de gedeelde slot-naam.
    if (newId) guidToTaskId.set(stripQuotes(e.args[TASK_SLOT.globalId] || ''), newId);
  }

  let baselines: Baseline[] = [];
  let activeBaselineId: string | null = null;
  let comparedRaw: unknown = null;
  /** Expliciete interne-taakId → GlobalId-map uit het bestand; leeg bij oudere bestanden. */
  let taskGuids: Record<string, string> | null = null;

  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.Baselines) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const name = stripQuotes(prop.args[0] || '');
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      if (name === 'Baselines') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) baselines = parsed as Baseline[];
        } catch { /* corrupte JSON — negeer, baselines blijft leeg */ }
      } else if (name === 'ActiveBaselineId') {
        activeBaselineId = raw;
      } else if (name === 'ComparedBaselineIds') {
        try { comparedRaw = JSON.parse(raw); } catch { /* corrupte JSON — geen vergelijking */ }
      } else if (name === 'TaskGuids') {
        // De writer schrijft expliciet weg wélk GlobalId hij per baseline-taak gebruikte, zodat wij
        // de hash niet hoeven na te rekenen. Ontbreekt de map (oudere bestanden), dan valt de remap
        // hieronder terug op het herberekenen van de hash.
        try {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            taskGuids = parsed as Record<string, string>;
          }
        } catch { /* corrupte JSON — negeer, we vallen terug op herberekening */ }
      }
    }
  }

  // taskId-remap via GlobalId.
  for (const b of baselines) {
    if (!Array.isArray(b.tasks)) { b.tasks = []; continue; }
    for (const bt of b.tasks as BaselineTask[]) {
      // Gebruik het GlobalId dat de writer daadwerkelijk uitgaf. Alleen bij oudere bestanden zonder
      // `TaskGuids`-map vallen we terug op het herberekenen van de hash.
      const guid = taskGuids?.[bt.taskId] ?? ifcGuid(bt.taskId);
      const remapped = guidToTaskId.get(guid);
      if (remapped) bt.taskId = remapped;
    }
  }

  // Actieve id valideren tegen de geladen set; anders op de nieuwste (of null) terugvallen.
  if (activeBaselineId && !baselines.some(b => b.id === activeBaselineId)) {
    activeBaselineId = baselines.length ? baselines[baselines.length - 1].id : null;
  }

  // Vergelijking: alleen bekende, niet-actieve, niet-dubbele id's; oudere bestanden hebben hem niet.
  const comparedBaselineIds = normalizeComparedBaselines(
    Array.isArray(comparedRaw) ? comparedRaw.map(v => (typeof v === 'string' ? v : null)) : null,
    baselines, activeBaselineId,
  );

  return { baselines, activeBaselineId, comparedBaselineIds };
}

/**
 * `OPS_TimephasedDurationWalks` teruglezen (spiegel van
 * `ifcWriter.writeTimephasedDurationWalksMeta`), PER TAAK via `IFCRELDEFINESBYPROPERTIES`.
 *
 * `resourceCalendarGuid` (de `IFCWORKCALENDAR.GlobalId`, uniek) wordt vertaald via
 * `calendarIdByGuid` (`extractCalendarLibrary`'s `idByGuid` + de projectkalender uit `readIFC`),
 * dus deze functie draait NA `extractCalendarLibrary`. Niet via de kalenderNAAM: die is niet uniek,
 * en twee gelijknamige kalenders zouden stil naar dezelfde (verkeerde) kalender resolven.
 *
 * Een GUID die niet in `calendarIdByGuid` voorkomt (kalender weg, of een extern bestand) laat die
 * ENE walk-entry VALLEN — liever geen afgeleide sturing dan een onbetrouwbare — i.p.v. een rauwe
 * GUID als kalender-id door te laten naar `resolveCalendar`.
 */
function extractTimephasedDurationWalksMeta(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
  calendarIdByGuid: ReadonlyMap<string, string>,
): void {
  const taskById = new Map(tasks.map(t => [t.id, t]));

  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== PSET.DurationWalks) continue;
    const prop = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .find((p): p is StepEntity =>
        !!p && p.type === 'IFCPROPERTYSINGLEVALUE' && stripQuotes(p.args[0] || '') === 'DurationWalks');
    const raw = prop ? parseTypedValue(prop.args[2] || '') : undefined;
    if (typeof raw !== 'string' || !raw) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(parsed)) continue;
    // `workMinutes` (apportionering bij >1 toewijzing) is OPTIONEEL: een oudere IFC of een
    // PRECIES-1-toewijzing-walk draagt 'm niet, spiegelt `ifcWriter.ts`'s conditionele
    // spread. `typeof ... === 'number'` (niet `!== undefined`) sluit ook een corrupt non-number-veld
    // uit i.p.v. het rauw door te laten.
    const isValidWalk = (w: unknown): w is { anchor: string; resourceCalendarGuid: string; workMinutes?: number } =>
      !!w && typeof w === 'object'
      && typeof (w as { anchor?: unknown }).anchor === 'string'
      && typeof (w as { resourceCalendarGuid?: unknown }).resourceCalendarGuid === 'string'
      && ((w as { workMinutes?: unknown }).workMinutes === undefined || typeof (w as { workMinutes?: unknown }).workMinutes === 'number');
    if (parsed.length === 0 || !parsed.every(isValidWalk)) continue;
    const walks = (parsed as { anchor: string; resourceCalendarGuid: string; workMinutes?: number }[])
      .map(w => ({
        anchor: w.anchor, resourceCalendarId: calendarIdByGuid.get(w.resourceCalendarGuid),
        ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
      }))
      .filter((w): w is { anchor: string; resourceCalendarId: string; workMinutes?: number } => w.resourceCalendarId !== undefined);
    if (walks.length === 0) continue;
    for (const objRef of parseRefs(rel.args[4] || '')) {
      const taskId = taskStepIdMap.get(objRef);
      const task = taskId ? taskById.get(taskId) : undefined;
      if (task) task.timephasedDurationWalks = walks;
    }
  }
}

/**
 * Rekenprofielen — alleen de `OPS_SchedulingProfile`-pset uit een IFC-tekst lezen, los van `readIFC`
 * (diagnose/tests). Geen pset of een onbruikbare ⇒ `undefined`; de migratie van het legacy-blok doet
 * `profileAfterRead` (in `readIFC`).
 */
export function readSchedulingProfile(content: string): SchedulingProfile | undefined {
  const entities = parseSTEP(content);
  const entityMap = new Map<string, StepEntity>();
  for (const e of entities) entityMap.set(e.id, e);
  return extractSchedulingProfile(entities, entityMap);
}

/**
 * Rekenprofielen — het profiel teruglezen uit de `OPS_SchedulingProfile`-JSON op de
 * `IfcWorkSchedule` (spiegel van `writeSchedulingProfileMeta`, exact het extractSchedulingOptions-
 * patroon). Afwezig, te groot (> `MAX_PROFILE_JSON_LENGTH`), corrupte JSON of geen object ⇒
 * `undefined`, waarna de lezer op de legacy-migratie terugvalt.
 */
function extractSchedulingProfile(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): SchedulingProfile | undefined {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.SchedulingProfile) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== 'SchedulingProfile') continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string' || !raw || raw.length > MAX_PROFILE_JSON_LENGTH) continue;
      try {
        return sanitizeSchedulingProfile(JSON.parse(raw));
      } catch { /* corrupte JSON — negeer, de legacy-migratie neemt het over */ }
    }
  }
  return undefined;
}

/**
 * Is dit IFC door Open Planner Studio zelf geschreven? Twee
 * onafhankelijke sporen, elk voldoende: de `IFCAPPLICATION` met ApplicationIdentifier `'OPS'` die
 * `ifcWriter.ts` sinds het begin schrijft, of om het even welk `OPS_`-pset. Een IFC uit een ander
 * pakket heeft geen van beide en is dus een verse import ('ifc'). Bewust GEEN heuristiek op de
 * FILE_NAME-header: die is vrij tekstveld (en oudere versies vulden hem rauw met projectnaam/auteur).
 */
function isOpsAuthoredIfc(entities: StepEntity[]): boolean {
  for (const e of entities) {
    if (e.type === 'IFCAPPLICATION' && stripQuotes(e.args[3] || '') === 'OPS') return true;
    if (e.type === 'IFCPROPERTYSET' && stripQuotes(e.args[2] || '').startsWith('OPS_')) return true;
  }
  return false;
}

/**
 * Heropen-beleid — `OPS_ImportProvenance.UnchangedSinceImport` (spiegel van
 * `writeImportProvenanceMeta`). Afwezig of niet exact `.T.` ⇒ `false`: een heropening is pas
 * "ongewijzigd sinds import" als het bestand dat zelf zegt.
 */
function extractImportPristine(entities: StepEntity[], entityMap: Map<string, StepEntity>): boolean {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.ImportProvenance) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== 'UnchangedSinceImport') continue;
      return (prop.args[2] || '').replace(/\s+/g, '').toUpperCase() === 'IFCBOOLEAN(.T.)';
    }
  }
  return false;
}

/**
 * `OPS_ImportProvenance.SourceFormat` (spiegel van
 * `writeImportProvenanceMeta`). Alleen een bekende waarde telt; iets anders ⇒ `undefined` (geen
 * bron ⇒ geen modus, nooit een gok).
 */
function extractRecordedSourceFormat(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): RecordedSourceFormat | undefined {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.ImportProvenance) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== 'SourceFormat') continue;
      const m = /^IFCLABEL\('([a-z0-9]+)'\)$/i.exec((prop.args[2] || '').trim());
      const v = m?.[1];
      return v === 'xer' || v === 'p6xml' || v === 'mspdi' || v === 'mpp' || v === 'ifc' ? v : undefined;
    }
  }
  return undefined;
}

/**
 * Scheduling-options teruglezen uit het autoritatieve `OPS_SchedulingOptions`-
 * JSON op de `IfcWorkSchedule` (spiegel van `writeSchedulingOptionsMeta`, exact het extractBaselines-
 * patroon). Afwezig/corrupt ⇒ `undefined` (default-inert; alle solver-defaults blijven staan).
 * Het geparste object gaat door `sanitizeSchedulingOptions`: onbekende
 * sleutels en verkeerd getypeerde waarden vallen weg in plaats van ongefilterd de solver in te gaan.
 */
function extractSchedulingOptions(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): SchedulingOptions | undefined {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== PSET.SchedulingOptions) continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== 'SchedulingOptions') continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string' || !raw) continue;
      try {
        return sanitizeSchedulingOptions(JSON.parse(raw));
      } catch { /* corrupte JSON — negeer, opties blijven op default */ }
    }
  }
  return undefined;
}
