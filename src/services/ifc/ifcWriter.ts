import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource } from '@/types/resource';
import { ResourceAssignment } from '@/types/resource';
import { Project, SchedulingOptions, SchedulingProfile } from '@/types/project';
import { carriesProfile, schedulingProfileToJson } from '@/services/ifc/schedulingOptionsRead';
import { legacyOptionsBlobFor } from '@/services/ifc/schedulingProfileMigration';
import { holidayEndDate, WorkCalendar } from '@/types/calendar';
import { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { Baseline } from '@/types/baseline';
import type { CustomTaskType } from '@/types/taskType';
import {
  effectiveCalendarByTask, minutesToClock, minutesToIsoDuration, scalarHourFromClock, taskMinutesForWrite,
} from '@/services/subdayIo';
import { effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import type { ImportResult, RecordedSourceFormat } from '@/services/importTypes';
import {
  IFC_TIME_ANCHOR, FIELD_MEASURE, RESOURCE_TYPE_TO_IFC,
} from './ifcConstants';
import { PSET, PER_TASK_PSETS, ifcStr } from './ifcPsets';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { projectFileBase } from '@/utils/documents';
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES, XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT,
  XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION, type XerSourceArchive,
} from '@/services/xerSourceArchive';
import {
  IFC_TASK_SLOTS, IFC_TASKTIME_SLOTS, type TaskTimeWriteCtx, type TaskWriteCtx, type WithheldTaskTimeField,
} from './ifcTaskSlots';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { groupBy } from '@/utils/collections';

/** Generate a 22-character IFC GlobalId (simplified). Geëxporteerd zodat de reader
 *  (`extractBaselines`) baseline-taskId's — die als interne id in de OPS_Baselines-JSON staan —
 *  deterministisch kan terugmappen op de her-gegenereerde taak-id's via de IFCTASK-GlobalId. */
export function ifcGuid(seed: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  let result = '';
  for (let i = 0; i < 22; i++) {
    const idx = Math.abs((hash * (i + 1) * 31 + i * 17) % chars.length);
    result += chars[idx];
    hash = ((hash << 3) ^ (hash >> 2) + i) | 0;
  }
  return result;
}

// ifcStr/ifcBool komen uit ./ifcPsets (gedeeld met de per-taak-pset-registry).

function ifcDateTime(iso: string): string {
  if (!iso) return '$';
  // Ensure format: 'YYYY-MM-DDT07:00:00' (anker gedeeld met de reader via IFC_TIME_ANCHOR).
  if (iso.length === 10) return `'${iso}T${IFC_TIME_ANCHOR}'`;
  return `'${iso}'`;
}

/** Datetime van een UUR-taak: de echte tijd-van-de-dag blijft behouden (geen
 *  synthetisch `T07`-anker). De store bewaart uur-instants als `YYYY-MM-DDTHH:mm` (16 tekens,
 *  `formatInstant`); vul aan tot seconden voor een spec-conforme IfcDateTime. Een (onverwacht)
 *  date-only bij een uur-taak = middernacht. */
function ifcDateTimeHour(iso: string): string {
  if (!iso) return '$';
  if (iso.length === 10) return `'${iso}T00:00:00'`;
  if (iso.length === 16) return `'${iso}:00'`; // YYYY-MM-DDTHH:mm → +seconden
  return `'${iso}'`;
}

/**
 * Het getal in een ISO-8601-dagduur (`P…D`). Hele dagen (en niet-eindige waarden) blijven exact
 * `${days}`. Een fractionele dag (CSV-import, Tabel
 * "1d 4u", AI-bridge, afgeleide speling van uurtaken) wordt afgerond op 6 decimalen, zodat er nooit
 * float-ruis (`0.30000000000000004`) of exponent-notatie (`1e-7`) in het bestand komt.
 *
 * Waarom 6: de fijnste kalender (24 u/dag) heeft 1440 minuten per dag, dus één minuut is ≈ 6,9·10⁻⁴
 * dag. De afrondfout is hooguit 5·10⁻⁷ dag, oftewel 0,0007 minuut (43 ms) bij 24 u/dag: `dagen ×
 * uren-per-dag × 60` geeft na teruglezen dezelfde minuut, bij elke taakkalender. Float-ruis ligt rond
 * 10⁻¹⁵ relatief en valt voor elke realistische duur ruim onder die grens, dus hij verdwijnt altijd.
 * Hetzelfde afrondniveau als de procent-lag in de reader. Na afronding is de kleinste waarde ≠ 0
 * 0.000001, en die schrijft JS nog zonder exponent (dat doet hij pas onder 10⁻⁶ en vanaf 10²¹ dagen).
 */
function ifcDayNumber(days: number): string {
  if (!Number.isFinite(days) || Number.isInteger(days)) return `${days}`;
  return `${Math.round(days * 1e6) / 1e6}`;
}

function ifcDuration(days: number): string {
  return `'P0Y0M${ifcDayNumber(days)}D'`;
}

/** Duur van een UUR-taak in minuten als ISO-8601-duur met tijdcomponent
 *  (`PT{h}H{m}M0S`); minuut-precies en byte-stabiel terug te lezen (`isoDurationToMinutes`). Geen
 *  ruis- of exponentrisico zoals bij `ifcDayNumber`: `minutesToIsoDuration` rondt op hele minuten. */
function ifcDurationHour(minutes: number): string {
  return `'${minutesToIsoDuration(minutes)}'`;
}

export interface WriteContext {
  lines: string[];
  nextId: number;
  idMap: Map<string, number>; // our ID -> STEP #id
  /** seed → daadwerkelijk uitgegeven GlobalId. */
  guids: Map<string, string>;
  /** Alle uitgegeven GlobalIds, om botsingen te detecteren. */
  usedGuids: Set<string>;
}

/**
 * Geef het GlobalId uit voor `seed` — en garandeer dat het uniek is binnen dit bestand.
 *
 * `ifcGuid` is een 32-bits hash, geen UUID en geen conforme IFC-GUID: een verjaardagsbotsing bij
 * tienduizenden id's is niet uit te sluiten, en een botsing geeft stille kruisbesmetting van
 * baselines of toewijzingen.
 *
 * Dit is de enige plek die GlobalIds uitgeeft. Botst een hash met een eerder uitgegeven GlobalId,
 * dan wordt er deterministisch doorgezocht met een gesuffixte seed; zonder botsing is de uitkomst
 * gewoon de hash.
 *
 * Een gesuffixt GlobalId is alleen terug te vinden omdat de writer expliciet wegschrijft wélk
 * GlobalId hij per taak gebruikte (zie `writeBaselineMeta`); de reader herberekent de hash niet.
 */
function guidOf(ctx: WriteContext, seed: string): string {
  const cached = ctx.guids.get(seed);
  if (cached !== undefined) return cached;
  let guid = ifcGuid(seed);
  for (let n = 1; ctx.usedGuids.has(guid); n++) guid = ifcGuid(`${seed}#dup${n}`);
  ctx.guids.set(seed, guid);
  ctx.usedGuids.add(guid);
  return guid;
}

function ref(ctx: WriteContext, key: string): string {
  return `#${ctx.idMap.get(key) || 0}`;
}

function addLine(ctx: WriteContext, key: string, line: string): number {
  const id = ctx.nextId++;
  ctx.idMap.set(key, id);
  // STEP vereist dat elke entity met ';' eindigt — anders parst de reader (ifcReader regex `\)\s*;`) niets.
  ctx.lines.push(`#${id}=${line};`);
  return id;
}

/**
 * Invoer voor `writeIFC`. Eén input-object dwingt volledigheid af via de compiler (losse positionele
 * params lieten een callsite stil ONVOLLEDIGE IFC schrijven). Hergebruikt `ImportResult`: de writer
 * heeft exact dezelfde payload nodig als wat de readers teruggeven ⇒ symmetrische round-trip,
 * geen dubbele typedefinitie. De kernvelden zijn verplicht; de optionele vullen we hier met de
 * bestaande defaults (`[]` / `null`).
 */
export type WriteIFCInput = ImportResult & {
  /**
   * "Datums zoals opgeslagen": per taak-id de rekenslots die de
   * writer als `$` moet schrijven, omdat `task.time` daar in de modus een weergave-terugval draagt
   * en geen vastlegging uit het bronbestand. Alleen gevuld door `buildWriteIFCInput` wanneer de modus
   * aanstaat; afwezig ⇒ alles gewoon geschreven.
   */
  withheldTaskTimeFields?: Readonly<Record<string, readonly WithheldTaskTimeField[]>>;
};

export function writeIFC(input: WriteIFCInput): string {
  const {
    project, calendar, tasks, sequences, resources, assignments,
    activityCodeTypes = [],
    customFieldDefs = [],
    customTaskTypes = [],
    resourceCalendars = [],
    baselines = [],
    activeBaselineId = null,
    libraryPool = undefined,
    xerSourceArchive = undefined,
    xer = undefined,
    xerSourceProjectId = undefined,
    importPristine = undefined,
    withheldTaskTimeFields = undefined,
    recordedSourceFormat = undefined,
  } = input;
  const ctx: WriteContext = { lines: [], nextId: 1, idMap: new Map(), guids: new Map(), usedGuids: new Set() };
  const now = new Date().toISOString().split('.')[0];

  // Header. Naam/auteur/bedrijf MOETEN door `ifcStr`: rauw geïnterpoleerd levert een gewone
  // apostrof al syntactisch ongeldig STEP op (`FILE_NAME('O'Hara Tower.ifc',…)`), en `DATA;`/`ENDSEC;`
  // in de projectnaam zet die tokens vóór de echte sectiegrens ⇒ nul entiteiten. Onze eigen reader
  // raakt de header niet aan, maar Synchro of BlenderBIM wel. Let op de VORM: `ifcStr(x + '.ifc')`,
  // NIET `'${ifcStr(x)}.ifc'` (dat zet quotes om de al-gequote waarde heen). Alle drie de waarden
  // zijn nooit leeg, dus `ifcStr` geeft hier nooit `$`.
  //
  // Quoten alléén is niet genoeg: een REGELEINDE in de projectnaam (via een geïmporteerd IFC of de
  // MCP-tool `update_project`) is ongeldig STEP in een stringliteral, en zet de tekst erna aan het
  // begin van een regel, waar een `DATA;` de sectiegrens van een regel-verankerde lezer verzet.
  // Vandaar `headerText`: regeleindes en andere controltekens worden één spatie. Alleen voor de
  // drie headervelden; in de datasectie is de scan quote-bewust en zijn regeleindes onschadelijk.
  // Stuurtekens zijn hier het DOEL van de regex: de header-sanitizer maakt ze onschadelijk vóór ze
  // de STEP-header in gaan.
  // eslint-disable-next-line no-control-regex
  const headerText = (s: string) => s.replace(/[\u0000-\u001F\u007F]+/g, ' ');
  // FILE_NAME[1] is per ISO 10303-21 de BESTANDSNAAM van het uitwisselingsbestand, niet de
  // projectnaam. Een naamloos project zou daar letterlijk `'.ifc'` opleveren. Vandaar dezelfde
  // neutrale, taalonafhankelijke basis die de opslaan-dialoog voorstelt (`projectFileBase` ->
  // `project.ifc`), zodat header en voorgestelde bestandsnaam dezelfde waarde dragen. De ECHTE
  // projectnaam blijft `IFCPROJECT.Name = $` — dat is de plek waar "geen naam" hoort te staan, en die
  // raken we niet aan.
  const headerFileName = projectFileBase(headerText(project.name)) + '.ifc';
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');",
    `FILE_NAME(${ifcStr(headerFileName)},${ifcStr(now)},(${ifcStr(headerText(project.author || 'Open Planner Studio'))}),(${ifcStr(headerText(project.company || 'OpenAEC Foundation'))}),'Open Planner Studio 0.1','Open Planner Studio','');`,
    "FILE_SCHEMA(('IFC4X3'));",
    'ENDSEC;',
    'DATA;',
    '',
  ].join('\n');

  // Owner history
  const personId = addLine(ctx, '_person', `IFCPERSON($,${ifcStr(project.author)},$,$,$,$,$,$)`);
  const orgId = addLine(ctx, '_org', `IFCORGANIZATION($,${ifcStr(project.company)},$,$,$)`);
  const personOrgId = addLine(ctx, '_personorg', `IFCPERSONANDORGANIZATION(#${personId},#${orgId},$)`);
  const appOrgId = addLine(ctx, '_apporg', `IFCORGANIZATION($,'OpenAEC Foundation',$,$,$)`);
  const appId = addLine(ctx, '_app', `IFCAPPLICATION(#${appOrgId},'0.1','Open Planner Studio','OPS')`);
  const ownerHistId = addLine(ctx, '_owner', `IFCOWNERHISTORY(#${personOrgId},#${appId},$,.NOCHANGE.,$,$,$,${Math.floor(Date.now() / 1000)})`);

  // Units
  const mId = addLine(ctx, '_m', `IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const sId = addLine(ctx, '_s', `IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.)`);
  const unitAssId = addLine(ctx, '_units', `IFCUNITASSIGNMENT((#${mId},#${sId}))`);

  // Context
  const ptId = addLine(ctx, '_pt', `IFCCARTESIANPOINT((0.,0.,0.))`);
  const axId = addLine(ctx, '_ax', `IFCAXIS2PLACEMENT3D(#${ptId},$,$)`);
  const ctxId = addLine(ctx, '_ctx', `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',3,1.0E-05,#${axId},$)`);

  // Project. Description (arg 3) draagt project.description — de reader leest 'm terug
  // uit de IFCWORKPLAN.Description-slot, met terugval op deze.
  addLine(ctx, '_project', `IFCPROJECT(${ifcStr(guidOf(ctx, project.id))},#${ownerHistId},${ifcStr(project.name)},${ifcStr(project.description)},$,$,$,(#${ctxId}),#${unitAssId})`);
  writeXerSourceArchive(ctx, ownerHistId, xerSourceArchive, xer?.sourceProjectId ?? xerSourceProjectId);

  // Calendar (projectkalender — altijd de EERSTE IFCWORKCALENDAR in het bestand; vaste conventie
  // die de reader aanhoudt om 'm van de bibliotheek-kalenders hieronder te onderscheiden).
  const effCalByTask = effectiveCalendarByTask(tasks, calendar, resourceCalendars);
  const hourTaskCalendarIds = new Set(tasks.flatMap((task) => {
    const calendarId = taskDurationUnit(task) === 'hours' ? effCalByTask.get(task.id)?.id : undefined;
    return calendarId ? [calendarId] : [];
  }));
  const projectCalWritten = writeCalendar(ctx, calendar, ownerHistId, '_calendar', hourTaskCalendarIds.has(calendar.id));
  writeCalendarGenerationMeta(ctx, calendar, ownerHistId, projectCalWritten);

  // Work plan & schedule
  const startDates = tasks.map(t => t.time.scheduleStart).filter(Boolean).sort();
  const endDates = tasks.map(t => t.time.scheduleFinish).filter(Boolean).sort();
  const planStart = startDates[0] || project.startDate;
  const planEnd = endDates[endDates.length - 1] || project.endDate;

  const workPlanId = addLine(ctx, '_workplan',
    `IFCWORKPLAN(${ifcStr(guidOf(ctx, project.id + '_wp'))},#${ownerHistId},${ifcStr(project.name)},${ifcStr(project.description)},$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  const workSchedId = addLine(ctx, '_worksched',
    `IFCWORKSCHEDULE(${ifcStr(guidOf(ctx, project.id + '_ws'))},#${ownerHistId},${ifcStr('Construction schedule v1.0')},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  // Baselines — per baseline één `.BASELINE.`-IfcWorkSchedule-header (Name +
  // CreationDate, ZONDER taak-duplicatie: de datums leven verliesloos in het OPS_Baselines-JSON
  // hieronder). Puur een interop-signaal "deze baselines bestaan" voor externe IFC-tools.
  // Golden rule: geen baselines ⇒ geen extra IfcWorkSchedule (de lus doet niets).
  const baselineSchedRefs: string[] = [];
  for (const b of baselines) {
    const bId = addLine(ctx, `_baseline_ws_${b.id}`,
      `IFCWORKSCHEDULE(${ifcStr(guidOf(ctx, 'baseline_ws_' + b.id))},#${ownerHistId},${ifcStr(b.name)},$,$,$,${ifcDateTime(b.createdAt)},$,$,$,$,$,$,${ifcDateTime(b.projectEnd)},.BASELINE.)`);
    baselineSchedRefs.push(`#${bId}`);
  }

  const schedRefs = [`#${workSchedId}`, ...baselineSchedRefs].join(',');
  addLine(ctx, '_agg_plan_sched',
    `IFCRELAGGREGATES(${ifcStr(guidOf(ctx, 'agg_ps'))},#${ownerHistId},$,$,#${workPlanId},(${schedRefs}))`);

  // Tasks. Per taak bepaalt de effectieve kalender uur- vs dag-modus
  // (uur ⇒ echte tijden + minuut-duren; dag ⇒ `T07:00:00` + `P0Y0M{days}D`).
  for (const task of tasks) {
    const effCal = effCalByTask.get(task.id);
    writeTask(
      ctx, task, ownerHistId, project.statusDate, taskDurationUnit(task) === 'hours',
      effCal?.hoursPerDay ?? calendar.hoursPerDay,
      customTaskTypes.find(type => type.id === task.customTaskTypeId)?.name,
      withheldTaskTimeFields?.[task.id],
    );
  }

  // WBS nesting
  writeWBSNesting(ctx, tasks, ownerHistId);

  // Root tasks -> schedule nesting
  const rootTasks = tasks.filter(t => !t.parentId);
  if (rootTasks.length > 0) {
    const rootRefs = rootTasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_nest_sched',
      `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_root'))},#${ownerHistId},'WBS Hoofd',$,#${workSchedId},(${rootRefs}))`);
  }

  // Sequences
  for (const seq of sequences) {
    writeSequence(ctx, seq, ownerHistId);
  }
  writeSequenceMeta(ctx, workSchedId, sequences, ownerHistId);

  // Resources
  for (const res of resources) {
    writeResource(ctx, res, ownerHistId);
  }
  writeResourceMeta(ctx, resources, ownerHistId);
  writeCrewNesting(ctx, resources, ownerHistId);
  // Kalender-bibliotheek: de projectkalender-entry (id === project.calendarId) is hierboven al als
  // eerste IFCWORKCALENDAR geschreven — uitsluiten voorkomt een duplicaat, want `resourceCalendars`
  // is de VOLLEDIGE bibliotheek (incl. de projectentry).
  writeCalendarLibrary(
    ctx, resources, tasks,
    resourceCalendars.filter(c => c.id !== project.calendarId),
    ownerHistId,
    hourTaskCalendarIds,
  );

  // Resource assignments
  writeAssignments(ctx, assignments, ownerHistId);
  writeAssignmentMeta(ctx, tasks, assignments, ownerHistId);
  // Timephased-venster (`workWindowStart`/`Finish`) als eigen OPS_Timephased-JSON-pset, NAAST (niet in)
  // het OPS_Assignments-pipe-formaat hierboven.
  writeTimephasedMeta(ctx, tasks, assignments, ownerHistId);
  // Kalenderwandelingen (`timephasedDurationWalks`), eigen pset (zie de functie zelf voor waarom
  // dit niet via PER_TASK_PSETS kan).
  writeTimephasedDurationWalksMeta(ctx, tasks, ownerHistId);

  // Tasks -> WorkSchedule control
  if (tasks.length > 0) {
    const allTaskRefs = tasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_ctrl',
      `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'ctrl'))},#${ownerHistId},$,$,(${allTaskRefs}),$,#${workSchedId})`);
  }

  // Structuurdefinities (activity codes / custom fields) + waarden per taak + projectsettings
  writeStructure(ctx, project, tasks, activityCodeTypes, customFieldDefs, ownerHistId);
  writeTaskTypeMeta(ctx, tasks, customTaskTypes, ownerHistId);
  // Resourcebibliotheek-pool: alleen een pool-BESTAND draagt dit; anders undefined ⇒ niets.
  writeLibraryPool(ctx, ownerHistId, libraryPool);

  // De per-taak-psets via de gedeelde registry (ifcPsets.PER_TASK_PSETS), in registervolgorde.
  // Reader-kant zit in dezelfde descriptors (apply), gedispatcht in extractStructure. OPS_Analysis
  // wordt bewust NIET geschreven (afgeleide runCPM-uitvoer) — zie WRITTEN_PER_TASK_PSETS hieronder.
  emitPerTaskPsets(ctx, tasks, ownerHistId);
  // Baselines: OPS_Baselines-pset (JSON autoritair) op de IfcWorkSchedule
  writeBaselineMeta(ctx, workSchedId, baselines, activeBaselineId, ownerHistId);
  // Scheduling-options: OPS_SchedulingOptions-pset (JSON autoritair) op de IfcWorkSchedule
  // Rekenprofielen: OPS_SchedulingOptions = projectopties + A22/A23 alleen als ze opgelost true zijn
  // (compat met uitgebrachte versies); het profiel staat in OPS_SchedulingProfile, alleen als het ≠
  // het standaardprofiel.
  writeSchedulingOptionsMeta(ctx, workSchedId, legacyOptionsBlobFor(project), ownerHistId);
  writeSchedulingProfileMeta(ctx, workSchedId, project.schedulingProfile, ownerHistId);
  // Heropen-beleid: OPS_ImportProvenance-pset, alleen bij `importPristine === true` of een bekend
  // bronformaat.
  writeImportProvenanceMeta(ctx, workSchedId, importPristine === true, recordedSourceFormat, ownerHistId);

  // Footer
  const footer = '\nENDSEC;\nEND-ISO-10303-21;\n';

  return header + ctx.lines.join('\n') + footer;
}

/** Eén self-contained Pset met manifest én deterministisch geordende bytes. */
function writeXerSourceArchive(
  ctx: WriteContext, ownerHistId: number, archive: XerSourceArchive | undefined, sourceProjectId: string | undefined,
): void {
  if (!archive) return;
  if (!sourceProjectId) throw new Error('XER-bronarchief kan niet zonder OPS_XerDocument-selector worden opgeslagen.');
  if (!archive.diagnostics.documentViews[sourceProjectId]) {
    throw new Error('XER-bronarchief kan niet zonder geldige OPS_XerDocument-selector worden opgeslagen.');
  }
  const props: number[] = [];
  const property = (name: string, value: string) => props.push(addLine(ctx, `xerarchive_prop_${name}`, `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value},$)`));
  property('SchemaVersion', `IFCINTEGER(${XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION})`);
  property('Format', `IFCLABEL(${ifcStr(archive.format)})`);
  property('StorageFormat', `IFCLABEL(${ifcStr(XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT)})`);
  property('ByteLength', `IFCINTEGER(${archive.byteLength})`);
  property('Sha256', `IFCTEXT(${ifcStr(archive.sha256)})`);
  property('ByteChunkSize', `IFCINTEGER(${XER_SOURCE_ARCHIVE_CHUNK_BYTES})`);
  property('ByteChunkCount', `IFCINTEGER(${archive.byteChunks.length})`);
  archive.byteChunks.forEach((chunk, index) => property(`ByteChunk${String(index).padStart(6, '0')}`, `IFCTEXT(${ifcStr(chunk)})`));
  const setId = addLine(ctx, 'pset_xerarchive', `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_xerarchive'))},#${ownerHistId},${ifcStr(PSET.XerSourceArchive)},$,(${props.map(id => `#${id}`).join(',')}))`);
  addLine(ctx, 'rel_xerarchive', `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_xerarchive'))},#${ownerHistId},$,$,(${ref(ctx, '_project')}),#${setId})`);
  const selectorProps: number[] = [];
  const selector = (name: string, value: string) => selectorProps.push(addLine(ctx, `xerdoc_prop_${name}`, `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value},$)`));
  selector('ArchiveSha256', `IFCTEXT(${ifcStr(archive.sha256)})`);
  selector('SourceProjectId', `IFCTEXT(${ifcStr(sourceProjectId)})`);
  const selectorSet = addLine(ctx, 'pset_xerdocument', `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_xerdocument'))},#${ownerHistId},${ifcStr(PSET.XerDocument)},$,(${selectorProps.map(id => `#${id}`).join(',')}))`);
  addLine(ctx, 'rel_xerdocument', `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_xerdocument'))},#${ownerHistId},$,$,(${ref(ctx, '_project')}),#${selectorSet})`);
}

/** Eigen taaktypen blijven IFC-geldig: de taak zelf is `.USERDEFINED.` met een ObjectType-label;
 * deze project-pset bewaart alleen de stabiele OPS-id en projectkopie. */
function writeTaskTypeMeta(
  ctx: WriteContext, tasks: Task[], customTaskTypes: CustomTaskType[], ownerHistId: number,
): void {
  const used = new Set(tasks.map(t => t.customTaskTypeId).filter((id): id is string => !!id));
  if (used.size === 0) return;
  const definitions = customTaskTypes.filter(t => used.has(t.id));
  const taskTypeIds: Record<string, string> = {};
  for (const task of tasks) if (task.customTaskTypeId) taskTypeIds[guidOf(ctx, task.id)] = task.customTaskTypeId;
  const value = JSON.stringify({ definitions, taskTypeIds });
  const propId = addLine(ctx, '_ps_tasktypes_json',
    `IFCPROPERTYSINGLEVALUE('TaskTypes',$,IFCTEXT(${ifcStr(value)}),$)`);
  const setId = addLine(ctx, '_pset_tasktypes',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tasktypes'))},#${ownerHistId},${ifcStr(PSET.TaskTypes)},$,(#${propId}))`);
  addLine(ctx, '_rel_tasktypes',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tasktypes'))},#${ownerHistId},$,$,(#${ctx.idMap.get('_project')}),#${setId})`);
}

// FIELD_MEASURE (IfcSimplePropertyTemplate.PrimaryMeasureType per custom-field-type) staat in
// ./ifcConstants zodat de reader er de inverse uit afleidt (geen stille divergentie).

function ifcTypedValue(type: CustomFieldType, value: CustomFieldValue): string {
  switch (type) {
    case 'text': return `IFCTEXT(${ifcStr(String(value))})`;
    case 'number': return `IFCREAL(${Number(value)})`;
    case 'integer': return `IFCINTEGER(${Math.round(Number(value))})`;
    case 'cost': return `IFCMONETARYMEASURE(${Number(value)})`;
    case 'date': return `IFCDATE(${ifcStr(String(value))})`;
    case 'boolean': return `IFCBOOLEAN(${value ? '.T.' : '.F.'})`;
    default: {
      // Exhaustiviteitscheck: een nieuw CustomFieldType zonder eigen case geeft hier een
      // COMPILE-fout (het valt dan niet meer onder `never`). Zo kan de writer nooit stil een
      // veld overslaan.
      const _exhaustive: never = type;
      throw new Error(`Onbekend custom-field-type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Structuur naar IFC 4.3:
 *  - definities als IFCPROPERTYSETTEMPLATE + IFCSIMPLEPROPERTYTEMPLATE (P_SINGLEVALUE voor
 *    custom fields met PrimaryMeasureType; P_ENUMERATEDVALUE + IFCPROPERTYENUMERATION voor
 *    activity-code-types), gedeclareerd aan het project via IFCRELDECLARES — leesbaar voor
 *    conformante IFC-tools;
 *  - daarnaast één OPS_StructureMeta-pset met de volledige definitie-JSON (autoritair voor
 *    onze eigen reader: behoudt ids/kleuren/omschrijvingen verliesloos);
 *  - waarden per taak als eigen psets OPS_CustomFields (IFCPROPERTYSINGLEVALUE, getypeerd)
 *    en OPS_ActivityCodes (IFCPROPERTYENUMERATEDVALUE), via IFCRELDEFINESBYPROPERTIES;
 *  - OPS_ProjectSettings-pset op het project (wbsAutoNumber).
 * Identiteit in de psets is de NAAM (type-/veldnaam); de reader mapt namen terug naar ids
 * via de meta-JSON (of mint verse ids bij bestanden van derden).
 */
function writeStructure(
  ctx: WriteContext,
  project: Project,
  tasks: Task[],
  activityCodeTypes: ActivityCodeType[],
  customFieldDefs: CustomFieldDef[],
  ownerHistId: number,
): void {
  const projRef = ref(ctx, '_project');
  const relDefines = (key: string, objRef: string, setId: number) =>
    addLine(ctx, key,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, key))},#${ownerHistId},$,$,(${objRef}),#${setId})`);

  // Projectsettings — wbsAutoNumber + statusDate/progressMode.
  // Golden rule: elk veld alleen wanneer gezet; geen enkel veld ⇒ geen OPS_ProjectSettings-pset.
  const projSettingProps: number[] = [];
  // Externe bronverversing bewaart naast taak-id ook project-id. Zonder deze waarde krijgt hetzelfde
  // IFC-bestand bij iedere parse een nieuw project-id, zodat een ververste link geen blijvend
  // canonieke bronidentiteit heeft. Oudere bestanden vallen in de reader terug op IFC GlobalId.
  projSettingProps.push(addLine(ctx, '_ps_projectid',
    `IFCPROPERTYSINGLEVALUE('InternalProjectId',$,IFCTEXT(${ifcStr(project.id)}),$)`));
  if (project.wbsAutoNumber !== undefined) {
    projSettingProps.push(addLine(ctx, '_ps_wbsauto',
      `IFCPROPERTYSINGLEVALUE('wbsAutoNumber',$,IFCBOOLEAN(${project.wbsAutoNumber ? '.T.' : '.F.'}),$)`));
  }
  if (project.defaultTaskDurationUnit) {
    projSettingProps.push(addLine(ctx, '_ps_defaultdurationunit',
      `IFCPROPERTYSINGLEVALUE('DefaultTaskDurationUnit',$,IFCLABEL(${ifcStr(project.defaultTaskDurationUnit)}),$)`));
  }
  // Projectstandaard-werkregel, alleen wanneer gezet (golden rule).
  if (project.defaultWorkRule) {
    projSettingProps.push(addLine(ctx, '_ps_defaultworkrule',
      `IFCPROPERTYSINGLEVALUE('DefaultWorkRule',$,IFCLABEL(${ifcStr(project.defaultWorkRule)}),$)`));
  }
  if (project.statusDate) {
    // Datum ⇒ IFCDATE. Mét tijd (uur-modus, `YYYY-MM-DDTHH:mm`) ⇒ IFCDATETIME met seconden: IfcDate
    // kent geen tijd, dus anders staat de statusdatum na opslaan + openen op middernacht.
    const sd = project.statusDate;
    const typed = sd.length > 10
      ? `IFCDATETIME(${ifcStr(sd.length === 16 ? `${sd}:00` : sd)})`
      : `IFCDATE(${ifcStr(sd)})`;
    projSettingProps.push(addLine(ctx, '_ps_statusdate',
      `IFCPROPERTYSINGLEVALUE('StatusDate',$,${typed},$)`));
  }
  // ProgressMode alleen als afwijkend van de default RETAINED_LOGIC (golden rule).
  if (project.progressMode && project.progressMode !== 'RETAINED_LOGIC') {
    projSettingProps.push(addLine(ctx, '_ps_progressmode',
      `IFCPROPERTYSINGLEVALUE('ProgressMode',$,IFCLABEL(${ifcStr(project.progressMode)}),$)`));
  }
  // CreatedAt/ModifiedAt: project-tijdstempels als verbatim ISO-instant. Bewust in het
  // OPS_ProjectSettings-pset i.p.v. de native IFCOWNERHISTORY-slots (IfcTimeStamp): OwnerHistory
  // draagt al een schrijf-tijdstempel (teruglezen zou createdAt van elk bestaand bestand wijzigen),
  // en IfcTimeStamp kapt de milliseconden af. Golden rule: alleen wanneer gezet.
  // ProjectStartDate/ProjectEndDate — de CONTRACTUELE projectdatums. Bewust hier en niet in de
  // IFCWORKPLAN.StartTime/FinishTime-slots: die dragen de AFGELEIDE plan-omvang (min/max van de
  // taak-span), zoals andere IFC-tools ze ook lezen.
  //
  // AFWIJKING van de golden rule: deze twee worden ALTIJD geschreven, ook leeg — anders valt de
  // lezer terug op het WORKPLAN-slot en vult de afgeleide datum een bewust léég gelaten einddatum.
  // Codering: gezet ⇒ IFCDATE(...), leeg ⇒ NominalValue `$` ("aanwezig, maar geen waarde"), zodat
  // de lezer dat onderscheidt van "veld afwezig" (ouder bestand of ander tool ⇒ WORKPLAN-slot).
  const contractDateProp = (key: string, name: string, value: string): number =>
    addLine(ctx, key,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value ? `IFCDATE(${ifcStr(value)})` : '$'},$)`);
  projSettingProps.push(contractDateProp('_ps_projstart', 'ProjectStartDate', project.startDate));
  projSettingProps.push(contractDateProp('_ps_projend', 'ProjectEndDate', project.endDate));

  if (project.createdAt) {
    projSettingProps.push(addLine(ctx, '_ps_createdat',
      `IFCPROPERTYSINGLEVALUE('CreatedAt',$,IFCTEXT(${ifcStr(project.createdAt)}),$)`));
  }
  if (project.modifiedAt) {
    projSettingProps.push(addLine(ctx, '_ps_modifiedat',
      `IFCPROPERTYSINGLEVALUE('ModifiedAt',$,IFCTEXT(${ifcStr(project.modifiedAt)}),$)`));
  }
  // Projectbinding aan een resourcebibliotheek. Golden rule: alleen wanneer gebonden.
  if (project.companyId) {
    projSettingProps.push(addLine(ctx, '_ps_companyid',
      `IFCPROPERTYSINGLEVALUE('CompanyId',$,IFCTEXT(${ifcStr(project.companyId)}),$)`));
  }
  if (project.companyName) {
    projSettingProps.push(addLine(ctx, '_ps_companyname',
      `IFCPROPERTYSINGLEVALUE('CompanyName',$,IFCTEXT(${ifcStr(project.companyName)}),$)`));
  }
  if (projSettingProps.length > 0) {
    const setId = addLine(ctx, '_pset_projset',
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_projset'))},#${ownerHistId},${ifcStr(PSET.ProjectSettings)},$,(${projSettingProps.map(i => `#${i}`).join(',')}))`);
    relDefines('_rel_projset', projRef, setId);
  }

  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) return;

  // Autoritaire meta-JSON (verliesloos: ids, kleuren, omschrijvingen).
  const metaJson = JSON.stringify({ activityCodeTypes, customFieldDefs });
  const metaPropId = addLine(ctx, '_ps_structmeta',
    `IFCPROPERTYSINGLEVALUE('structure',$,IFCTEXT(${ifcStr(metaJson)}),$)`);
  const metaSetId = addLine(ctx, '_pset_structmeta',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_structmeta'))},#${ownerHistId},${ifcStr(PSET.StructureMeta)},$,(#${metaPropId}))`);
  relDefines('_rel_structmeta', projRef, metaSetId);

  // Conformante templates + declaratie aan het project.
  const templateIds: number[] = [];
  if (customFieldDefs.length > 0) {
    const fieldTmplRefs = customFieldDefs.map(def => {
      const id = addLine(ctx, `_cft_${def.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(guidOf(ctx, 'cft_' + def.id))},#${ownerHistId},${ifcStr(def.name)},$,.P_SINGLEVALUE.,${ifcStr(FIELD_MEASURE[def.type])},$,$,$,$,$,$)`);
      return `#${id}`;
    });
    templateIds.push(addLine(ctx, '_psett_fields',
      `IFCPROPERTYSETTEMPLATE(${ifcStr(guidOf(ctx, 'psett_fields'))},#${ownerHistId},${ifcStr(PSET.CustomFields)},$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(${fieldTmplRefs.join(',')}))`));
  }
  if (activityCodeTypes.length > 0) {
    const codeTmplRefs = activityCodeTypes.map(t => {
      const labels = t.values.map(v => `IFCLABEL(${ifcStr(v.code)})`).join(',');
      const enumId = addLine(ctx, `_acte_${t.id}`,
        `IFCPROPERTYENUMERATION(${ifcStr(t.name)},(${labels}),$)`);
      const id = addLine(ctx, `_actt_${t.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(guidOf(ctx, 'actt_' + t.id))},#${ownerHistId},${ifcStr(t.name)},$,.P_ENUMERATEDVALUE.,$,$,#${enumId},$,$,$,$)`);
      return `#${id}`;
    });
    templateIds.push(addLine(ctx, '_psett_codes',
      `IFCPROPERTYSETTEMPLATE(${ifcStr(guidOf(ctx, 'psett_codes'))},#${ownerHistId},${ifcStr(PSET.ActivityCodes)},$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(${codeTmplRefs.join(',')}))`));
  }
  if (templateIds.length > 0) {
    addLine(ctx, '_decl_templates',
      `IFCRELDECLARES(${ifcStr(guidOf(ctx, 'decl_templates'))},#${ownerHistId},$,$,${projRef},(${templateIds.map(i => `#${i}`).join(',')}))`);
  }

  // Waarden per taak.
  const typeById = new Map(activityCodeTypes.map(t => [t.id, t]));
  const defById = new Map(customFieldDefs.map(d => [d.id, d]));
  for (const task of tasks) {
    const fieldEntries = Object.entries(task.customFields ?? {}).filter(([defId]) => defById.has(defId));
    if (fieldEntries.length > 0) {
      const propRefs = fieldEntries.map(([defId, value]) => {
        const def = defById.get(defId)!;
        const id = addLine(ctx, `_cfv_${task.id}_${defId}`,
          `IFCPROPERTYSINGLEVALUE(${ifcStr(def.name)},$,${ifcTypedValue(def.type, value)},$)`);
        return `#${id}`;
      });
      const setId = addLine(ctx, `_pset_cf_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_cf_' + task.id))},#${ownerHistId},${ifcStr(PSET.CustomFields)},$,(${propRefs.join(',')}))`);
      relDefines(`_rel_cf_${task.id}`, ref(ctx, `task_${task.id}`), setId);
    }

    const codeEntries = Object.entries(task.activityCodes ?? {}).filter(([typeId, valueId]) => {
      const t = typeById.get(typeId);
      return !!t && t.values.some(v => v.id === valueId);
    });
    if (codeEntries.length > 0) {
      const propRefs = codeEntries.map(([typeId, valueId]) => {
        const t = typeById.get(typeId)!;
        const v = t.values.find(x => x.id === valueId)!;
        const id = addLine(ctx, `_acv_${task.id}_${typeId}`,
          `IFCPROPERTYENUMERATEDVALUE(${ifcStr(t.name)},$,(IFCLABEL(${ifcStr(v.code)})),$)`);
        return `#${id}`;
      });
      const setId = addLine(ctx, `_pset_ac_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_ac_' + task.id))},#${ownerHistId},${ifcStr(PSET.ActivityCodes)},$,(${propRefs.join(',')}))`);
      relDefines(`_rel_ac_${task.id}`, ref(ctx, `task_${task.id}`), setId);
    }
  }
}

/**
 * De VOLLEDIGE resourcebibliotheek-pool als één autoritatief JSON-blob in het `OPS_Library`-pset op het
 * IfcProject (patroon `OPS_StructureMeta`: één IFCTEXT-property, verliesloos, incl. ids en versie).
 * Alleen een pool-BESTAND draagt dit; een gewoon projectbestand roept dit met `undefined` aan ⇒
 * niets geschreven (golden rule). De IFCWORKCALENDAR/resource-entiteiten in het
 * bestand blijven voor derden leesbaar, maar deze JSON is voor ONZE reader de bron van waarheid.
 */
function writeLibraryPool(
  ctx: WriteContext,
  ownerHistId: number,
  pool: import('@/types/library').CompanyPool | undefined,
): void {
  if (!pool) return;
  const projRef = ref(ctx, '_project');
  const json = JSON.stringify(pool);
  const propId = addLine(ctx, '_ps_library',
    `IFCPROPERTYSINGLEVALUE('pool',$,IFCTEXT(${ifcStr(json)}),$)`);
  const setId = addLine(ctx, '_pset_library',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_library'))},#${ownerHistId},${ifcStr(PSET.Library)},$,(#${propId}))`);
  addLine(ctx, '_rel_library',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_library'))},#${ownerHistId},$,$,(${projRef}),#${setId})`);
}

/**
 * `OPS_Analysis` (interferingFloat / isNearCritical / floatPath) wordt BEWUST NIET MEER GESCHREVEN.
 * Die drie velden zijn pure uitvoer van `runCPM` (scheduleAnalysis) — geen gebruikersinvoer — en
 * worden bit-exact gereproduceerd door elk laadpad (alle laadpaden gaan via `applyLoadedProject`
 * met `recompute: true` ⇒ `runCPM()`; recovery-herstel rekent zelf door). Ze zouden een flink deel
 * van elke auto-save-schrijfactie kosten (~10 s-throttle per document).
 * De LEESkant blijft intact: bestaande bestanden mét `OPS_Analysis` laden gewoon (de descriptor
 * staat nog in `PER_TASK_PSET_BY_NAME`, waar ifcReader op dispatcht) — `runCPM` overschrijft de
 * gelezen waarden daarna toch.
 */
const WRITTEN_PER_TASK_PSETS = PER_TASK_PSETS.filter(d => d.name !== PSET.Analysis);

/**
 * Schrijf de per-taak-psets via de gedeelde registry (ifcPsets.PER_TASK_PSETS), minus de afgeleide
 * `OPS_Analysis` (zie hierboven). Elk descriptor levert de property-lijst (`write`); een
 * lege/`null`-lijst = golden rule ⇒ niets geschreven. Buitenlus over de registry-VOLGORDE,
 * binnenlus over `tasks`, zodat de STEP-uitvoer stabiel blijft. De read-kant leeft in
 * dezelfde descriptors (`apply`), gedispatcht in ifcReader.extractStructure.
 */
function emitPerTaskPsets(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const desc of WRITTEN_PER_TASK_PSETS) {
    for (const task of tasks) {
      const specs = desc.write(task);
      if (!specs || specs.length === 0) continue;
      const propRefs = specs.map((s, i) =>
        `#${addLine(ctx, `_prop_${desc.name}_${task.id}_${i}`,
          `IFCPROPERTYSINGLEVALUE(${ifcStr(s.name)},$,${s.value},$)`)}`);
      const setId = addLine(ctx, `_pset_${desc.name}_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, desc.psetSeed + task.id))},#${ownerHistId},${ifcStr(desc.name)},$,(${propRefs.join(',')}))`);
      addLine(ctx, `_rel_${desc.name}_${task.id}`,
        `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, desc.relSeed + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
    }
  }
}

/**
 * Baselines als `OPS_Baselines`-pset op de `IfcWorkSchedule` (spiegel van het
 * `OPS_StructureMeta`-dubbelspoor). Eén `IFCPROPERTYSINGLEVALUE`
 * met de volledige `JSON.stringify(baselines)` (autoritair en verliesloos — dit is de bron die
 * de reader gebruikt) + een `ActiveBaselineId`-property. Golden rule: geen baselines ⇒ geen pset.
 * De per-baseline `.BASELINE.`-IfcWorkSchedule-headers (interop-signaal) staan al bij het
 * werkplan/-schema hierboven; deze pset draagt de datums.
 */
function writeBaselineMeta(
  ctx: WriteContext,
  workSchedId: number,
  baselines: Baseline[],
  activeBaselineId: string | null,
  ownerHistId: number,
): void {
  if (baselines.length === 0) return;
  const json = JSON.stringify(baselines);
  const props: number[] = [];
  props.push(addLine(ctx, '_ps_baselines_json',
    `IFCPROPERTYSINGLEVALUE('Baselines',$,IFCTEXT(${ifcStr(json)}),$)`));
  // De baseline-JSON draagt INTERNE taak-id's. Zou de reader die terugmappen door zelf
  // `ifcGuid(taskId)` te herberekenen, dan gaf een hashbotsing stille kruisbesmetting tussen
  // baselines en vond hij een gesuffixt GlobalId (wat `guidOf` bij een botsing uitgeeft) nooit terug.
  //
  // We schrijven daarom expliciet wég welk GlobalId deze writer per baseline-taak gebruikte. De
  // reader leest die map en herberekent niets; de hash is alleen een naamgenerator.
  // Alleen de taak-id's die in baselines voorkomen — de map blijft zo klein en de golden rule
  // ("alleen schrijven wat nodig is") overeind.
  const baselineTaskGuids: Record<string, string> = {};
  for (const b of baselines) {
    for (const bt of b.tasks ?? []) {
      if (bt.taskId) baselineTaskGuids[bt.taskId] = guidOf(ctx, bt.taskId);
    }
  }
  if (Object.keys(baselineTaskGuids).length > 0) {
    props.push(addLine(ctx, '_ps_baselines_guids',
      `IFCPROPERTYSINGLEVALUE('TaskGuids',$,IFCTEXT(${ifcStr(JSON.stringify(baselineTaskGuids))}),$)`));
  }
  if (activeBaselineId) {
    props.push(addLine(ctx, '_ps_baselines_active',
      `IFCPROPERTYSINGLEVALUE('ActiveBaselineId',$,IFCTEXT(${ifcStr(activeBaselineId)}),$)`));
  }
  const setId = addLine(ctx, '_pset_baselines',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_baselines'))},#${ownerHistId},${ifcStr(PSET.Baselines)},$,(${props.map(i => `#${i}`).join(',')}))`);
  addLine(ctx, '_rel_baselines',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_baselines'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

/**
 * Het volledige `schedulingOptions`-blok als één `OPS_SchedulingOptions`-pset
 * op de `IfcWorkSchedule` (exact het OPS_Baselines-patroon: één autoritatief JSON-veld ⇒ verliesloze
 * round-trip van álle sub-opties, ook wat P6/MSPDI niet native kunnen). Golden rule: afwezig of leeg
 * blok ⇒ geen pset.
 */
function writeSchedulingOptionsMeta(
  ctx: WriteContext,
  workSchedId: number,
  options: SchedulingOptions | undefined,
  ownerHistId: number,
): void {
  if (!options || Object.keys(options).length === 0) return;
  const json = JSON.stringify(options);
  const propId = addLine(ctx, '_ps_schedopts',
    `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT(${ifcStr(json)}),$)`);
  const setId = addLine(ctx, '_pset_schedopts',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_schedopts'))},#${ownerHistId},${ifcStr(PSET.SchedulingOptions)},$,(#${propId}))`);
  addLine(ctx, '_rel_schedopts',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_schedopts'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

/**
 * Rekenprofielen — het profiel als één `OPS_SchedulingProfile`-pset op de `IfcWorkSchedule`
 * (exact het `writeSchedulingOptionsMeta`-patroon). De JSON draagt alle zevenentwintig conventies
 * OPGELOST (`schedulingProfileToJson`), plus de afwijkingen letterlijk. Golden rule: afwezig profiel
 * of het standaardprofiel (`ops` zonder enige afwijking, `carriesProfile`) ⇒ geen pset.
 */
export function writeSchedulingProfileMeta(
  ctx: WriteContext,
  workSchedId: number,
  profile: SchedulingProfile | undefined,
  ownerHistId: number,
): void {
  if (!carriesProfile(profile)) return;
  const json = JSON.stringify(schedulingProfileToJson(profile));
  const propId = addLine(ctx, '_ps_schedprofile',
    `IFCPROPERTYSINGLEVALUE('SchedulingProfile',$,IFCTEXT(${ifcStr(json)}),$)`);
  const setId = addLine(ctx, '_pset_schedprofile',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_schedprofile'))},#${ownerHistId},${ifcStr(PSET.SchedulingProfile)},$,(#${propId}))`);
  addLine(ctx, '_rel_schedprofile',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_schedprofile'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

/**
 * Heropen-beleid — "ongewijzigd sinds import" plus het oorspronkelijke bronformaat als één
 * `OPS_ImportProvenance`-pset op de `IfcWorkSchedule`. Golden rule: `UnchangedSinceImport` alleen
 * als de vlag `true` is, `SourceFormat` alleen als hij bekend is; geen van beide ⇒ geen pset. Een
 * afwezige vlag leest terug als `false` (nooit een gok richting "automatisch aan").
 */
function writeImportProvenanceMeta(
  ctx: WriteContext,
  workSchedId: number,
  importPristine: boolean,
  sourceFormat: RecordedSourceFormat | undefined,
  ownerHistId: number,
): void {
  if (!importPristine && !sourceFormat) return;
  const propIds: number[] = [];
  if (importPristine) {
    propIds.push(addLine(ctx, '_ps_importprov',
      `IFCPROPERTYSINGLEVALUE('UnchangedSinceImport',$,IFCBOOLEAN(.T.),$)`));
  }
  // De oorspronkelijke bron met echte rekenuitvoer, zodat
  // een heropening de modus alleen kent voor XER/P6 XML/MSPDI/.mpp/vreemd-IFC-met-early-slots.
  if (sourceFormat) {
    propIds.push(addLine(ctx, '_ps_importprov_source',
      `IFCPROPERTYSINGLEVALUE('SourceFormat',$,IFCLABEL(${ifcStr(sourceFormat)}),$)`));
  }
  const setId = addLine(ctx, '_pset_importprov',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_importprov'))},#${ownerHistId},${ifcStr(PSET.ImportProvenance)},$,(${propIds.map(id => `#${id}`).join(',')}))`);
  addLine(ctx, '_rel_importprov',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_importprov'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

/** `IfcWorkCalendar.PredefinedType` uit `calendar.shift`. CONVENTIE: buildingSMART definieert de
 *  dag/avond/nacht-semantiek van `.FIRSTSHIFT./.SECONDSHIFT./.THIRDSHIFT.` NIET — OPS gebruikt ze
 *  als ploeg-classificatie. Afwezig/FIRST ⇒ `.FIRSTSHIFT.`. */
function shiftToPredefinedType(shift: WorkCalendar['shift']): string {
  switch (shift) {
    case 'SECOND': return '.SECONDSHIFT.';
    case 'THIRD': return '.THIRDSHIFT.';
    case 'USERDEFINED': return '.USERDEFINED.';
    default: return '.FIRSTSHIFT.';
  }
}

/** Terugkeerwaarde van `writeCalendar`: naast het STEP-id van de
 *  `IFCWORKCALENDAR` zelf ook de STEP-ids van de werkende-uitzondering-`IFCWORKTIME`'s, zodat
 *  `writeCalendarGenerationMeta` die als OPS-discriminator kan wegschrijven (zie aldaar). */
interface WriteCalendarResult {
  calStepId: number;
  workingExceptionStepIds: number[];
  /** Het scalar begin-/einduur zoals de lezer het uit de EERSTE geschreven `IFCTIMEPERIOD`
   *  afleidt (`scalarHourFromClock`); `undefined` ⇒ er is geen periode geschreven. */
  readerScalarHours: { start: number; end: number } | undefined;
  /** De `IFCTIMEPERIOD`s zijn de EFFECTIEVE banden van een SCALAIRE kalender (een urentaak
   *  gebruikt hem), niet de expliciete `workTime` van een uurkalender. */
  materializedScalarBands: boolean;
}

function writeCalendar(
  ctx: WriteContext,
  cal: WorkCalendar,
  ownerHistId: number,
  key: string = '_calendar',
  includeEffectiveScalarBands = false,
): WriteCalendarResult {
  // Work time recurrence (weekdays)
  const dayNums = cal.workDays.join(',');
  let timePeriodRefs: string;
  let firstPeriod: [string, string] | undefined;
  const workTime = cal.workTime ?? (includeEffectiveScalarBands ? effectiveWorkTimeBands(cal) : undefined);
  if (workTime) {
    // UUR-kalender ⇒ `TimePeriods` als LIJST van per-dag-banden (`IfcRecurrencePattern.TimePeriods`
    // is native een lijst). IFC's enkele recurrence draagt één set periodes voor alle
    // DayComponent-dagen; we schrijven de banden van de eerste werkdag (uniform-over-de-week). Een
    // wrap-band (`end > 1440`) emitteert het eind als tijd-van-de-dag (`end % 1440`), waaruit de
    // reader de wrap herkent (`end ≤ start`). Een band tot precies middernacht eindigt op '24:00:00'
    // (einde van de dag, begin vóór eind); oudere bestanden met '00:00:00' leest de wrapregel nog.
    const firstDay = cal.workDays[0] as 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined;
    const bands = (firstDay && workTime.byWeekday[firstDay]) || [];
    const ids = bands.map((b) =>
      addLine(ctx, '_timeperiod', `IFCTIMEPERIOD('${minutesToClock(b.start)}','${minutesToClock(b.end, true)}')`),
    );
    timePeriodRefs = ids.map((i) => `#${i}`).join(',');
    if (bands[0]) firstPeriod = [minutesToClock(bands[0].start), minutesToClock(bands[0].end, true)];
  } else {
    // Geldige IfcTime `hh:mm:ss` (07:30 ⇒ '07:30:00', niet '7.5:00:00'); 24 ⇒ '24:00:00' (einde dag).
    const startTime = minutesToClock(Math.round(cal.workStartHour * 60));
    const endTime = minutesToClock(Math.round(cal.workEndHour * 60), true);
    const timePeriodId = addLine(ctx, '_timeperiod', `IFCTIMEPERIOD('${startTime}','${endTime}')`);
    timePeriodRefs = `#${timePeriodId}`;
    firstPeriod = [startTime, endTime];
  }
  const recurrenceId = addLine(ctx, '_recurrence', `IFCRECURRENCEPATTERN(.WEEKLY.,$,(${dayNums}),$,$,$,$,(${timePeriodRefs}))`);
  // Engelstalig label: dit belandt in ELK opgeslagen IFC-bestand, ook bij een gebruiker die
  // de app in het Duits of Japans draait — en IFC is een Engelstalige standaard, dus een Nederlands
  // label is hier vreemde eend. Veilig te wijzigen: de lezer gebruikt van dit "hoofd"-IFCWORKTIME
  // alleen args[3] (de RecurrencePattern-ref), nooit de naam. Let op het verschil met de
  // FEESTDAG-IFCWORKTIME's in ExceptionTimes: dáár leest de lezer args[0] wél, als feestdagnaam —
  // die komen uit `cal.holidays` en staan hier los van.
  const workTimeId = addLine(ctx, '_worktime', `IFCWORKTIME('Standard work week',.PREDICTED.,$,#${recurrenceId},$,$)`);

  // Holidays as exception times
  const holidayRefs: string[] = [];
  for (const holiday of cal.holidays) {
    const hId = addLine(ctx, `_holiday_${holiday.name}`,
      `IFCWORKTIME(${ifcStr(holiday.name)},.PREDICTED.,$,$,'${holiday.startDate}','${holidayEndDate(holiday)}')`);
    holidayRefs.push(`#${hId}`);
  }

  // Werkende uitzonderingen als exception times. Zelfde `ExceptionTimes`-lijst als de
  // feestdagen hierboven; de banden blijven als datadrager in een RecurrencePattern staan
  // (`TimePeriods`, args[7]; DayComponent, args[2], blijft `$` — een enkele datumrange heeft geen
  // weekdag-patroon nodig). MAAR de RecurrencePattern-ref is GEEN discriminator: IFC 4.3
  // reserveert die niet voor werkende uitzonderingen, en een spec-conforme externe tool kan een
  // RECURRENTE FEESTDAG ("elke 25 december") met exact zo'n gevulde ref schrijven. Het echte
  // onderscheid is de OPS-pset-markering hieronder (`writeCalendarGenerationMeta`,
  // `WorkingExceptionIds`) — de STEP-ids van deze IFCWORKTIME's worden daar expliciet
  // weggeschreven, en de reader behandelt alléén een gemarkeerd id als werkende uitzondering
  // (conservatief: ongemarkeerd + gevulde ref ⇒ feestdag). Golden rule: `cal.workingExceptions`
  // afwezig/leeg ⇒ deze lus doet niets (geen nieuwe entiteiten, geen gewijzigde ExceptionTimes,
  // geen nieuwe pset-property).
  const workingExceptionRefs: string[] = [];
  const workingExceptionStepIds: number[] = [];
  for (const exc of cal.workingExceptions ?? []) {
    const bandIds = (exc.bands ?? []).map((b) =>
      addLine(ctx, '_excband', `IFCTIMEPERIOD('${minutesToClock(b.start)}','${minutesToClock(b.end, true)}')`));
    const bandRefs = bandIds.length > 0 ? `(${bandIds.map((i) => `#${i}`).join(',')})` : '$';
    const excRecId = addLine(ctx, '_excrecurrence', `IFCRECURRENCEPATTERN(.DAILY.,$,$,$,$,$,$,${bandRefs})`);
    const wId = addLine(ctx, `_workexc_${exc.name}`,
      `IFCWORKTIME(${ifcStr(exc.name)},.PREDICTED.,$,#${excRecId},'${exc.startDate}','${exc.endDate}')`);
    workingExceptionRefs.push(`#${wId}`);
    workingExceptionStepIds.push(wId);
  }

  const allExceptionRefs = [...holidayRefs, ...workingExceptionRefs];
  const exceptStr = allExceptionRefs.length > 0 ? `(${allExceptionRefs.join(',')})` : '$';
  // ObjectType (arg 4): alleen een label bij USERDEFINED-ploeg; anders `$`.
  const objectType = cal.shift === 'USERDEFINED' ? ifcStr('USERDEFINED') : '$';
  const calStepId = addLine(ctx, key,
    `IFCWORKCALENDAR(${ifcStr(guidOf(ctx, cal.id))},#${ownerHistId},${ifcStr(cal.name)},${ifcStr(cal.description)},${objectType},(#${workTimeId}),${exceptStr},${shiftToPredefinedType(cal.shift)})`);
  return {
    calStepId,
    workingExceptionStepIds,
    readerScalarHours: firstPeriod
      ? { start: scalarHourFromClock(firstPeriod[0]), end: scalarHourFromClock(firstPeriod[1]) }
      : undefined,
    materializedScalarBands: !cal.workTime && workTime !== undefined,
  };
}

/**
 * OPS-metadata van een kalender als `OPS_Calendar`-pset op de bijbehorende `IFCWORKCALENDAR`
 * (`IFCPROPERTYSINGLEVALUE`s + `IFCRELDEFINESBYPROPERTIES`). Elke property volgt de golden rule
 * (alleen schrijven wat afwijkt of gezet is):
 *  - `generation` (regelset-herkomst): alleen bij een gegenereerde kalender.
 *  - `HoursPerDay`: alleen voor DAG-kalenders (`!cal.workTime`; uurkalenders leiden hem af uit de
 *    banden) en alleen wanneer hij AFWIJKT van `workEndHour − workStartHour` (bv. "Bouwkalender NL"
 *    07-16 met lunchuur: 8 ≠ 9) — anders overschrijft de afgeleide span hem bij het lezen.
 *  - `WorkingExceptionIds`: de STEP-ids van de werkende-uitzondering-`IFCWORKTIME`'s uit
 *    `writeCalendar`. Dit IS de discriminator waarmee de reader een werkende uitzondering van een
 *    (evt. recurrente) feestdag onderscheidt — een RecurrencePattern-ref is geen IFC-gereserveerd
 *    signaal (zie `writeCalendar`).
 *
 * Kalenderidentiteit door de round-trip:
 *  - `WorkStartHour`/`WorkEndHour`: de lezer haalt de scalar werktijd uit de EERSTE `IFCTIMEPERIOD`
 *    (`scalarHourFromClock`). Bij meer banden — een uurkalender, of een scalaire kalender waarvoor
 *    `writeCalendar` de effectieve banden materialiseert — is dat niet de scalar (07:00–16:00 zou
 *    07:00–12:00 worden). Per veld alleen geschreven wanneer die afleiding hem niet teruggeeft.
 *  - `IsHourCalendar = .F.`: alleen wanneer de `IFCTIMEPERIOD`s gematerialiseerde effectieve banden van
 *    een SCALAIRE kalender zijn (een urentaak gebruikt hem). IFC zelf ziet daar gewoon de lunchpauze
 *    (interop); de OPS-lezer weet zo dat de kalender scalair was en promoveert hem niet naar uur-modus.
 */
function writeCalendarGenerationMeta(
  ctx: WriteContext,
  cal: WorkCalendar,
  ownerHistId: number,
  written: WriteCalendarResult,
): void {
  const { calStepId, workingExceptionStepIds, readerScalarHours, materializedScalarBands } = written;
  const gen = cal.generation;
  const derivedHoursPerDay = cal.workEndHour - cal.workStartHour;
  const needsHoursPerDayOverride = !cal.workTime && cal.hoursPerDay !== derivedHoursPerDay;
  const hasWorkingExceptions = workingExceptionStepIds.length > 0;
  const hasP6Source = cal.p6Source === 'XER';
  const hasRejectedPenaltyDiagnostic = cal.p6NonWorkPenaltyDatesState === 'REJECTED';
  const hasSimpleBreak = !cal.workTime
    && (cal.simpleBreakStartMinute !== undefined || cal.simpleBreakDurationMinutes !== undefined);
  // Een enkele 08:00–16:00-band is aan de IFC-kant niet te onderscheiden van een dagkalender met
  // dezelfde scalar-uren. De OPS-markering bewaart daarom de kalenderidentiteit ook zonder urentaak.
  const isHourCalendar = cal.workTime !== undefined;
  const needsWorkStartHour = Number.isFinite(cal.workStartHour) && readerScalarHours?.start !== cal.workStartHour;
  const needsWorkEndHour = Number.isFinite(cal.workEndHour) && readerScalarHours?.end !== cal.workEndHour;
  if (!gen && !cal.libraryOrigin && !needsHoursPerDayOverride && !hasWorkingExceptions
    && !hasSimpleBreak && !isHourCalendar && !materializedScalarBands && !needsWorkStartHour && !needsWorkEndHour
    && !hasP6Source && !hasRejectedPenaltyDiagnostic) return;
  const props: number[] = [];
  if (gen) {
    props.push(addLine(ctx, `_opscal_ruleset_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('RuleSetId',$,IFCLABEL(${ifcStr(gen.ruleSetId)}),$)`));
    if (gen.region) {
      props.push(addLine(ctx, `_opscal_region_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE('Region',$,IFCLABEL(${ifcStr(gen.region)}),$)`));
    }
    if (gen.breakChoice) {
      props.push(addLine(ctx, `_opscal_break_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE('BreakChoice',$,IFCLABEL(${ifcStr(gen.breakChoice)}),$)`));
    }
    props.push(addLine(ctx, `_opscal_from_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('GeneratedFromYear',$,IFCINTEGER(${gen.generatedFromYear}),$)`));
    props.push(addLine(ctx, `_opscal_to_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('GeneratedToYear',$,IFCINTEGER(${gen.generatedToYear}),$)`));
  }
  if (cal.libraryOrigin) {
    props.push(addLine(ctx, `_opscal_lo_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT(${ifcStr(JSON.stringify(cal.libraryOrigin))}),$)`));
  }
  if (needsHoursPerDayOverride) {
    props.push(addLine(ctx, `_opscal_hpd_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(${cal.hoursPerDay}),$)`));
  }
  if (needsWorkStartHour) {
    props.push(addLine(ctx, `_opscal_workstart_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('WorkStartHour',$,IFCREAL(${cal.workStartHour}),$)`));
  }
  if (needsWorkEndHour) {
    props.push(addLine(ctx, `_opscal_workend_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('WorkEndHour',$,IFCREAL(${cal.workEndHour}),$)`));
  }
  // IFC kent geen semantisch "eenvoudig pauzepatroon". Bewaar het daarom als OPS-metadata,
  // uitsluitend wanneer de gebruiker de nieuwe velden werkelijk heeft gezet.
  if (hasSimpleBreak) {
    if (cal.simpleBreakStartMinute !== undefined) {
      props.push(addLine(ctx, `_opscal_breakstart_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE('SimpleBreakStart',$,IFCINTEGER(${cal.simpleBreakStartMinute}),$)`));
    }
    if (cal.simpleBreakDurationMinutes !== undefined) {
      props.push(addLine(ctx, `_opscal_breakduration_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE('SimpleBreakDuration',$,IFCINTEGER(${cal.simpleBreakDurationMinutes}),$)`));
    }
  }
  if (isHourCalendar) {
    props.push(addLine(ctx, `_opscal_hourmode_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('IsHourCalendar',$,IFCBOOLEAN(.T.),$)`));
  } else if (materializedScalarBands) {
    props.push(addLine(ctx, `_opscal_hourmode_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('IsHourCalendar',$,IFCBOOLEAN(.F.),$)`));
  }
  if (hasWorkingExceptions) {
    const idJson = JSON.stringify(workingExceptionStepIds.map(String));
    props.push(addLine(ctx, `_opscal_wexc_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('WorkingExceptionIds',$,IFCTEXT(${ifcStr(idJson)}),$)`));
  }
  if (hasP6Source) {
    props.push(addLine(ctx, `_opscal_p6source_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('P6Source',$,IFCLABEL('XER'),$)`));
  }
  if (hasP6Source) {
    props.push(addLine(ctx, `_opscal_p6penalty_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('P6NonWorkPenaltyDates',$,IFCTEXT(${ifcStr(JSON.stringify(cal.p6NonWorkPenaltyDates ?? []))}),$)`));
  }
  if (hasRejectedPenaltyDiagnostic) {
    props.push(addLine(ctx, `_opscal_p6penaltystate_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('P6NonWorkPenaltyDatesState',$,IFCLABEL('REJECTED'),$)`));
  }
  const setId = addLine(ctx, `_pset_opscal_${cal.id}`,
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_opscal_' + cal.id))},#${ownerHistId},${ifcStr(PSET.Calendar)},$,(${props.map(i => `#${i}`).join(',')}))`);
  addLine(ctx, `_rel_opscal_${cal.id}`,
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_opscal_' + cal.id))},#${ownerHistId},$,$,(#${calStepId}),#${setId})`);
}

/**
 * Kalender-bibliotheek: elke bibliotheek-entry (de projectkalender-entry is al als eerste
 * IFCWORKCALENDAR geschreven door de aanroeper en zit hier dus NIET meer in) krijgt een eigen
 * IFCWORKCALENDAR (dezelfde `writeCalendar`, parametrische key) + eventuele
 * `OPS_Calendar`-generatiemeta + IFCRELASSIGNSTOCONTROL-relaties naar wie ernaar verwijst: één
 * naar de resources (`resource.calendarId === cal.id`) en apart één naar de taken
 * (`task.calendarId === cal.id`) — twee losse rel-entiteiten omdat de reader
 * taken/resources via `taskStepIdMap`/`resourceStepIdMap` uit elkaar houdt. Golden rule: een
 * kalender zonder gebruikers schrijft alleen de IFCWORKCALENDAR zelf, geen rel; taken zonder
 * eigen kalender krijgen nooit een rel.
 */
function writeCalendarLibrary(
  ctx: WriteContext,
  resources: Resource[],
  tasks: Task[],
  calendars: WorkCalendar[],
  ownerHistId: number,
  hourTaskCalendarIds: Set<string>,
): void {
  for (const cal of calendars) {
    const written = writeCalendar(ctx, cal, ownerHistId, `calendar_${cal.id}`, hourTaskCalendarIds.has(cal.id));
    const { calStepId } = written;
    writeCalendarGenerationMeta(ctx, cal, ownerHistId, written);

    const resRefs = resources
      .filter(r => r.calendarId === cal.id)
      .map(r => ref(ctx, `res_${r.id}`))
      .filter(r => r !== '#0');
    if (resRefs.length > 0) {
      addLine(ctx, `resctrl_${cal.id}`,
        `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'resctrl_' + cal.id))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,#${calStepId})`);
    }

    const taskRefs = tasks
      .filter(t => t.calendarId === cal.id)
      .map(t => ref(ctx, `task_${t.id}`))
      .filter(r => r !== '#0');
    if (taskRefs.length > 0) {
      addLine(ctx, `taskctrl_${cal.id}`,
        `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'taskctrl_' + cal.id))},#${ownerHistId},$,$,(${taskRefs.join(',')}),$,#${calStepId})`);
    }
  }
}

function writeTask(
  ctx: WriteContext, task: Task, ownerHistId: number, statusDate: string | undefined,
  isHour: boolean, effHoursPerDay: number, customTaskTypeLabel?: string,
  withheld?: readonly WithheldTaskTimeField[],
): void {
  const t = task.time;
  // In UUR-modus dragen de datetimes de echte tijd-van-de-dag en is de duur minuut-precies
  // (`durationMinutes`, bron van waarheid; anders afgeleid uit de dag-duur). In DAG-modus valt alles
  // terug op het `T07:00:00`/`P0Y0M{days}D`-pad.
  const dt = isHour ? ifcDateTimeHour : ifcDateTime;
  // De ISO-vorm bewaart de TAAK-eenheid: P…D = werkdagen, PT…H…M = werkuren. De kalender bepaalt
  // alleen de datetime-precisie en plaatsing; een uurkalender maakt van een dagtaak geen urentaak.
  const schedDurArg = taskDurationUnit(task) === 'hours'
    ? ifcDurationHour(taskMinutesForWrite(task, effHoursPerDay))
    : ifcDuration(t.scheduleDuration);
  // Voortgang — spec-conforme IfcTaskTime-slots (0-based arg-index in de lijst
  // hieronder): 14 StatusTime, 15 ActualDuration, 16 ActualStart, 17 ActualFinish, 18 RemainingTime,
  // 19 Completion. Golden rule: een taak zonder actuals houdt 14-18 op `$`. StatusTime = de
  // projectbrede statusdatum (peildatum), alleen op taken die daadwerkelijk actuals dragen.
  const hasActuals = !!(t.actualStart || t.actualFinish);
  const statusTimeArg = hasActuals && statusDate ? dt(statusDate) : '$';
  const actualDurationArg = t.actualDuration != null ? ifcDuration(t.actualDuration) : '$';
  const actualStartArg = t.actualStart ? dt(t.actualStart) : '$';
  const actualFinishArg = t.actualFinish ? dt(t.actualFinish) : '$';
  // RemainingTime: uur-modus schrijft de resterende MINUTEN (`remainingMinutes`); anders de
  // dag-duur `remainingTime`.
  const remainingArg = isHour && t.remainingMinutes != null
    ? ifcDurationHour(t.remainingMinutes)
    : t.remainingTime != null ? ifcDuration(t.remainingTime) : '$';

  // IFCTASKTIME + IFCTASK worden via de gedeelde slot-registry (./ifcTaskSlots) geëmitteerd: de writer
  // ITEREERT de geordende descriptor-lijst en `.join(',')`t de per-slot geformatteerde waarden. De
  // reader (parseTaskTime/applyHourModeIFC/extractTasks) leest via dezelfde lijst-indices, zodat
  // writer-positie en reader-index niet kunnen divergeren. `dt`/`ifcDuration`/
  // `guidArg` worden meegegeven omdat ze in ifcWriter wonen (injectie vermijdt een import-cyclus).
  const ttCtx: TaskTimeWriteCtx = {
    task, dt, ifcDuration, schedDurArg, statusTimeArg,
    actualDurationArg, actualStartArg, actualFinishArg, remainingArg,
    ...(withheld && withheld.length > 0 ? { withheld: new Set(withheld) } : {}),
  };
  const taskTimeId = addLine(ctx, `tasktime_${task.id}`,
    `IFCTASKTIME(${IFC_TASKTIME_SLOTS.map(s => s.write(ttCtx)).join(',')})`);

  const taskCtx: TaskWriteCtx = {
    task, ownerHistId, guidArg: ifcStr(guidOf(ctx, task.id)), taskTimeId, customTaskTypeLabel,
  };
  addLine(ctx, `task_${task.id}`,
    `IFCTASK(${IFC_TASK_SLOTS.map(s => s.write(taskCtx)).join(',')})`);
}

function writeWBSNesting(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const task of tasks) {
    if (!isSummaryTask(task)) continue;
    const childRefs = task.childIds
      .map(cid => ref(ctx, `task_${cid}`))
      .filter(r => r !== '#0')
      .join(',');
    if (childRefs) {
      addLine(ctx, `nest_${task.id}`,
        `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_' + task.id))},#${ownerHistId},${ifcStr('WBS ' + task.name)},$,${ref(ctx, `task_${task.id}`)},( ${childRefs}))`);
    }
  }
}

// IfcLagTime.LagValue is een IfcTimeOrRatioSelect: een getypte IFCDURATION voor vaste lag of
// IFCRATIOMEASURE voor procent-lag (IFC 4.3 zelf: ratio 0.5 = "start wanneer de voorganger 50%
// gereed is"). Een lead (negatieve lag) krijgt het ISO-8601-voorloopteken ('-P2D') — dat is de
// standaardnotatie; niet elke externe tool leest het teken, maar onze round-trip behoudt het.
function ifcLagValue(seq: Sequence): string {
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return `IFCRATIOMEASURE(${seq.lagPercent / 100})`;
  }
  // Uur-lag (`lagMinutes`, bron van waarheid) als minuut-precieze IFCDURATION met
  // tijdcomponent; de reader herkent de `T`-component en zet `lagMinutes` terug.
  if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) {
    return `IFCDURATION('${minutesToIsoDuration(seq.lagMinutes)}')`;
  }
  const d = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  return d < 0 ? `IFCDURATION('-P${ifcDayNumber(-d)}D')` : `IFCDURATION('P${ifcDayNumber(d)}D')`;
}

function writeSequence(ctx: WriteContext, seq: Sequence, ownerHistId: number): void {
  let lagRef = '$';
  const hasPercent = typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent);
  const hasMinutes = typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes) && seq.lagMinutes !== 0;
  if (seq.lagDays !== 0 || hasPercent || hasMinutes) {
    // Conform IFC 4.3: IFCLAGTIME(Name, DataOrigin, UserDefinedDataOrigin, LagValue, DurationType)
    // — LagValue als getypte select in arg 4, DurationType (.WORKTIME./.ELAPSEDTIME.) in arg 5.
    // (Oudere app-versies hadden die twee omgewisseld; de reader kent beide lay-outs.)
    const durationType = seq.lagUnit === 'ELAPSEDTIME' ? 'ELAPSEDTIME' : 'WORKTIME';
    const lagId = addLine(ctx, `lag_${seq.id}`,
      `IFCLAGTIME('Lag',.PREDICTED.,$,${ifcLagValue(seq)},.${durationType}.)`);
    lagRef = `#${lagId}`;
  }

  addLine(ctx, `seq_${seq.id}`,
    `IFCRELSEQUENCE(${ifcStr(guidOf(ctx, seq.id))},#${ownerHistId},$,$,${ref(ctx, `task_${seq.predecessorId}`)},${ref(ctx, `task_${seq.successorId}`)},${lagRef},.${seq.type}.,$)`);
}

/**
 * Relatie-eigen P6/XER-ankerdata. IFC 4.3 staat geen `IfcPropertySet` rechtstreeks op een
 * `IfcRelSequence` toe (die is geen IfcObjectDefinition). Daarom is dit een geldige pset op de
 * IfcWorkSchedule, met de werkelijk geschreven IFC-GlobalId van iedere gemarkeerde relatie als
 * sleutel. Dat bewaart de semantiek relationeel én blijft interoperabel STEP.
 */
function writeSequenceMeta(
  ctx: WriteContext,
  workSchedId: number,
  sequences: readonly Sequence[],
  ownerHistId: number,
): void {
  const boundarySequenceGuids = sequences
    .filter(sequence => sequence.p6StartAtPredecessorFinishBoundary === true)
    .map(sequence => guidOf(ctx, sequence.id));
  if (boundarySequenceGuids.length === 0) return;
  const propId = addLine(ctx, '_ps_seq_boundary',
    `IFCPROPERTYSINGLEVALUE('P6StartAtPredecessorFinishBoundarySequenceGuids',$,IFCTEXT(${ifcStr(JSON.stringify(boundarySequenceGuids))}),$)`);
  const setId = addLine(ctx, '_pset_sequences',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_sequences'))},#${ownerHistId},${ifcStr(PSET.Sequences)},$,(#${propId}))`);
  addLine(ctx, '_rel_sequences',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_sequences'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

function writeResource(ctx: WriteContext, res: Resource, ownerHistId: number): void {
  // Entiteitnaam uit de gedeelde RESOURCE_TYPE_TO_IFC-map (reader leidt de inverse eruit af);
  // onbekend type ⇒ MATERIAL.
  const entityName = RESOURCE_TYPE_TO_IFC[res.type] ?? 'IFCCONSTRUCTIONMATERIALRESOURCE';
  const entity = `${entityName}(${ifcStr(guidOf(ctx, res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
  addLine(ctx, `res_${res.id}`, entity);
}

/**
 * `OPS_Resource`-pset: capaciteit/tarief/eenheid/tijd-gefaseerde-capaciteit + de
 * `ParentGuid`-vangnetproperty voor ploeg-lidmaatschap. Exact het OPS_Constraints/OPS_Milestone-
 * patroon: alleen schrijven wanneer minstens één veld van de default afwijkt (golden rule).
 */
function writeResourceMeta(ctx: WriteContext, resources: Resource[], ownerHistId: number): void {
  for (const res of resources) {
    const props: string[] = [];
    if (res.maxUnits !== 1) {
      const id = addLine(ctx, `_resmu_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('MaxUnits',$,IFCREAL(${res.maxUnits}),$)`);
      props.push(`#${id}`);
    }
    if (res.costPerHour !== undefined) {
      const id = addLine(ctx, `_resch_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('CostPerHour',$,IFCMONETARYMEASURE(${res.costPerHour}),$)`);
      props.push(`#${id}`);
    }
    if (res.unitOfMeasure) {
      const id = addLine(ctx, `_resuom_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('UnitOfMeasure',$,IFCLABEL(${ifcStr(res.unitOfMeasure)}),$)`);
      props.push(`#${id}`);
    }
    if (res.color) {
      // Weergavekleur (hex) voor de resource-kleurmodi in de rapportexport. Presentatie, geen
      // planningsdata — reist mee in het project-IFC zodat de export op elke machine gelijk kleurt.
      const id = addLine(ctx, `_rescol_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('Color',$,IFCTEXT(${ifcStr(res.color)}),$)`);
      props.push(`#${id}`);
    }
    if (res.availabilitySteps && res.availabilitySteps.length > 0) {
      // Compacte encoding "from:maxUnits;from:maxUnits", chronologisch.
      const encoded = [...res.availabilitySteps]
        .sort((a, b) => a.from.localeCompare(b.from))
        .map(s => `${s.from}:${s.maxUnits}`)
        .join(';');
      const id = addLine(ctx, `_resas_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('AvailabilitySteps',$,IFCTEXT(${ifcStr(encoded)}),$)`);
      props.push(`#${id}`);
    }
    if (res.parentId) {
      // Vangnet naast IFCRELNESTS (writeCrewNesting): de eigen reader hoeft nooit
      // afhankelijk te zijn van relatie-richting-interpretatie door andere IFC-tools.
      const id = addLine(ctx, `_respg_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('ParentGuid',$,IFCTEXT(${ifcStr(guidOf(ctx, res.parentId))}),$)`);
      props.push(`#${id}`);
    }
    if (res.libraryOrigin) {
      const id = addLine(ctx, `_reslo_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT(${ifcStr(JSON.stringify(res.libraryOrigin))}),$)`);
      props.push(`#${id}`);
    }
    if (props.length === 0) continue;
    const setId = addLine(ctx, `_pset_res_${res.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_res_' + res.id))},#${ownerHistId},${ifcStr(PSET.Resource)},$,(${props.join(',')}))`);
    addLine(ctx, `_rel_res_${res.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_res_' + res.id))},#${ownerHistId},$,$,(${ref(ctx, `res_${res.id}`)}),#${setId})`);
  }
}

/**
 * Ploeg-hiërarchie: `IFCRELNESTS` (niet `IFCRELAGGREGATES`), consistent
 * met hoe OPS al WBS-taakhiërarchie modelleert (`writeWBSNesting`) — RelatingObject = de
 * CREW-resource, RelatedObjects = de leden. Alleen geschreven wanneer de ploeg leden heeft.
 */
function writeCrewNesting(ctx: WriteContext, resources: Resource[], ownerHistId: number): void {
  const crews = resources.filter(r => r.type === 'CREW');
  for (const crew of crews) {
    const memberRefs = resources
      .filter(r => r.parentId === crew.id)
      .map(r => ref(ctx, `res_${r.id}`))
      .filter(r => r !== '#0');
    if (memberRefs.length === 0) continue;
    addLine(ctx, `nest_res_${crew.id}`,
      `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_res_' + crew.id))},#${ownerHistId},${ifcStr('Ploeg ' + crew.name)},$,${ref(ctx, `res_${crew.id}`)},(${memberRefs.join(',')}))`);
  }
}

/**
 * Toewijzingen per taak, in lijstvolgorde, zonder die waarvan de resource niet (meer) is geschreven —
 * bv. een vergiftigd document met resourceId null. Overslaan i.p.v. dat guidOf op een null-seed
 * crasht en daarmee élke save/auto-save permanent blokkeert; voor gezonde documenten filtert dit
 * niets. De volgorde bepaalt het `#index` in de
 * property-sleutels van `writeAssignmentMeta`/`writeTimephasedMeta`, dus die groeperen via deze ene
 * functie.
 */
function writtenAssignmentsByTask(ctx: WriteContext, assignments: ResourceAssignment[]): Map<string, ResourceAssignment[]> {
  return groupBy(assignments.filter(a => ref(ctx, `res_${a.resourceId}`) !== '#0'), a => a.taskId);
}

function writeAssignments(ctx: WriteContext, assignments: ResourceAssignment[], ownerHistId: number): void {
  for (const [taskId, list] of writtenAssignmentsByTask(ctx, assignments)) {
    const taskRef = ref(ctx, `task_${taskId}`);
    if (taskRef === '#0') continue;
    const resRefs = list.map(a => ref(ctx, `res_${a.resourceId}`));
    addLine(ctx, `assign_${taskId}`,
      `IFCRELASSIGNSTOPROCESS(${ifcStr(guidOf(ctx, 'assign_' + taskId))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,${taskRef},$)`);
  }
}

/**
 * `OPS_Assignments`-pset op de `IFCTASK`: `IFCRELASSIGNSTOPROCESS` kan
 * geen eigen pset dragen (het is een `IfcRelationship`, geen `IfcObjectDefinition` —
 * `IfcRelDefinesByProperties.RelatedObjects` accepteert dat type niet). Per-assignment
 * `unitsPerDay`+`curve` gaat daarom in een pset op de taak zelf: één
 * `IFCPROPERTYSINGLEVALUE` per assignment, waarde = `"unitsPerDay|curve"`.
 *
 * Property-naam = `"<resource-GUID>#<volgnummer>"`: de kale resource-GUID als propertynaam zou
 * meerdere assignments van DEZELFDE resource op één taak (bv. R×1(UNIFORM) + R×0.5(BELL))
 * corrumperen — de reader dedupt op propertynaam → last-wins. Het
 * `#<volgnummer>`-achtervoegsel (0-based positie binnen de assignmentlijst van de taak) maakt
 * elke property uniek. `guidOf(ctx, ...)` produceert nooit een `#`, dus het scheidingsteken is
 * eenduidig. De reader leest ZOWEL dit formaat (`GUID#N`) als het oude kale-GUID-formaat
 * (legacy bestanden). Alleen geschreven wanneer de taak minstens één assignment heeft
 * (golden rule).
 */
function writeAssignmentMeta(
  ctx: WriteContext,
  tasks: Task[],
  assignments: ResourceAssignment[],
  ownerHistId: number,
): void {
  const byTask = writtenAssignmentsByTask(ctx, assignments);
  for (const task of tasks) {
    const list = byTask.get(task.id);
    if (!list) continue;
    const props = list.map((a, index) => {
      const resGuid = guidOf(ctx, a.resourceId); // zelfde GUID als writeResource gebruikte
      const propName = `${resGuid}#${index}`; // uniek per assignment
      const val = `${a.unitsPerDay}|${a.curve ?? 'UNIFORM'}`;
      const propId = addLine(ctx, `_asgn_${task.id}_${a.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(propName)},$,IFCTEXT(${ifcStr(val)}),$)`);
      return `#${propId}`;
    });
    const setId = addLine(ctx, `_pset_asgn_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_asgn_' + task.id))},#${ownerHistId},${ifcStr(PSET.Assignments)},$,(${props.join(',')}))`);
    addLine(ctx, `_rel_asgn_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_asgn_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

/**
 * `OPS_Timephased`-pset op de `IFCTASK`: het timephased-venster
 * (`ResourceAssignment.workWindowStart`/`workWindowFinish`, MS Project "contouring")
 * van elke toewijzing van deze taak, als één autoritatief JSON-blob (`writeBaselineMeta`-vorm) —
 * NIET het `OPS_Assignments`-pipe-formaat hierboven uitbreiden (dat zou de legacy-parse-symmetrie
 * van dat formaat breken). Property-sleutel = EXACT dezelfde `"<resource-GUID>#<volgnummer>"` als
 * `writeAssignmentMeta` gebruikt (zelfde `byTask`-groepering, zelfde resource-bestaans-filter, dus
 * zelfde volgnummer) — dat is hoe de reader een venster weer aan de juiste toewijzing koppelt zonder
 * het pipe-formaat zelf aan te raken. Golden rule: geen enkele toewijzing van de taak draagt een
 * venster ⇒ geen pset.
 */
function writeTimephasedMeta(
  ctx: WriteContext,
  tasks: Task[],
  assignments: ResourceAssignment[],
  ownerHistId: number,
): void {
  const byTask = writtenAssignmentsByTask(ctx, assignments);
  for (const task of tasks) {
    const list = byTask.get(task.id);
    if (!list) continue;
    const windows: Record<string, {
      workWindowStart?: string; workWindowFinish?: string; curveValues?: number[];
      plannedWorkMinutes?: number; actualWorkMinutes?: number; remainingWorkMinutes?: number;
    }> = {};
    list.forEach((a, index) => {
      // `curveValues` (de exacte 21-punts P6-/MSPDI-curve) reist in hetzelfde JSON-blob mee — een
      // toewijzing zonder venster én zonder curve schrijft niets. De drie optionele werkvelden
      // (begroot/verricht/resterend, minuten) idem — zelfde blob, zelfde `GUID#N`-sleutel.
      if (a.workWindowStart === undefined && a.workWindowFinish === undefined && a.curveValues === undefined
        && a.plannedWorkMinutes === undefined && a.actualWorkMinutes === undefined && a.remainingWorkMinutes === undefined) return;
      const resGuid = guidOf(ctx, a.resourceId);
      const propName = `${resGuid}#${index}`;
      windows[propName] = {
        ...(a.workWindowStart !== undefined ? { workWindowStart: a.workWindowStart } : {}),
        ...(a.workWindowFinish !== undefined ? { workWindowFinish: a.workWindowFinish } : {}),
        ...(a.curveValues !== undefined ? { curveValues: [...a.curveValues] } : {}),
        ...(a.plannedWorkMinutes !== undefined ? { plannedWorkMinutes: a.plannedWorkMinutes } : {}),
        ...(a.actualWorkMinutes !== undefined ? { actualWorkMinutes: a.actualWorkMinutes } : {}),
        ...(a.remainingWorkMinutes !== undefined ? { remainingWorkMinutes: a.remainingWorkMinutes } : {}),
      };
    });
    if (Object.keys(windows).length === 0) continue;
    const propId = addLine(ctx, `_ps_tp_${task.id}`,
      `IFCPROPERTYSINGLEVALUE('Windows',$,IFCTEXT(${ifcStr(JSON.stringify(windows))}),$)`);
    const setId = addLine(ctx, `_pset_tp_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tp_' + task.id))},#${ownerHistId},${ifcStr(PSET.Timephased)},$,(#${propId}))`);
    addLine(ctx, `_rel_tp_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tp_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

/**
 * `Task.timephasedDurationWalks` als eigen `OPS_TimephasedDurationWalks`-JSON-pset, NIET via
 * `ifcPsets.PER_TASK_PSETS`: `resourceCalendarId` is een app-interne kalenderverwijzing die bij
 * inlezen een NIEUW id krijgt.
 *
 * Vertaling via `resourceCalendarGuid`, niet via de kalenderNAAM (die is niet uniek ⇒ stille
 * datacorruptie). `guidOf(ctx, cal.id)` is per `ctx` gememoïseerd en élke kalender is vóór deze
 * aanroep geschreven (zie `writeIFC`), dus dit levert exact de GlobalId van de bijbehorende
 * `IFCWORKCALENDAR` — hetzelfde remap-patroon als `writeBaselineMeta` voor taken. Golden rule: geen
 * taak met `timephasedDurationWalks` ⇒ geen pset.
 *
 * `workMinutes` (apportionering bij >1 toewijzing) wordt conditioneel meegeschreven: een
 * PRECIES-1-toewijzing-walk draagt hem niet.
 */
function writeTimephasedDurationWalksMeta(
  ctx: WriteContext,
  tasks: Task[],
  ownerHistId: number,
): void {
  for (const task of tasks) {
    const walks = task.timephasedDurationWalks;
    if (!walks || walks.length === 0) continue;
    const json = walks.map(w => ({
      anchor: w.anchor,
      resourceCalendarGuid: guidOf(ctx, w.resourceCalendarId),
      ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
    }));
    const propId = addLine(ctx, `_ps_tpdw_${task.id}`,
      `IFCPROPERTYSINGLEVALUE('DurationWalks',$,IFCTEXT(${ifcStr(JSON.stringify(json))}),$)`);
    const setId = addLine(ctx, `_pset_tpdw_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tpdw_' + task.id))},#${ownerHistId},${ifcStr(PSET.DurationWalks)},$,(#${propId}))`);
    addLine(ctx, `_rel_tpdw_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tpdw_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}
