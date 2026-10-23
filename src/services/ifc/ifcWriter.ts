import { minuteModelWriteView } from './minuteModelWrite';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource } from '@/types/resource';
import { ResourceAssignment } from '@/types/resource';
import { Project, SchedulingOptions, SchedulingProfile, projectIfcSchema } from '@/types/project';
import { carriesProfile, schedulingProfileToJson } from '@/services/ifc/schedulingOptionsRead';
import { legacyOptionsBlobFor } from '@/services/ifc/schedulingProfileMigration';
import { holidayEndDate, WorkCalendar, type WorkTimeBands } from '@/types/calendar';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';
import { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { Baseline } from '@/types/baseline';
import type { CustomTaskType } from '@/types/taskType';
import {
  canonicalizeBands, clockToMinutes, deriveHoursPerDay, hoursPerDayDiffers, effectiveCalendarByTask, minutesToClock, minutesToIsoDuration,
  scalarHourFromClock, taskMinutesForWrite,
} from '@/services/subdayIo';
import { effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import type { ImportResult, RecordedSourceFormat } from '@/services/importTypes';
import {
  IFC_TIME_ANCHOR, FIELD_MEASURE, RESOURCE_TYPE_TO_IFC,
} from './ifcConstants';
import { PSET, PER_TASK_PSETS, OPS_APP_VERSION, ifcStr, ifcJson, asciiJson, ifcTypedReal, stepReal, ifcDateValue } from './ifcPsets';
import { ifcSchemaQuestionFor } from './ifcSchemaQuestion';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { projectFileBase } from '@/utils/documents';
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES, XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT,
  XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION, XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT,
  XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_SCHEMA_VERSION, type XerSourceArchive,
} from '@/services/xerSourceArchive';
import {
  IFC_TASK_SLOTS, IFC_TASKTIME_SLOTS, type TaskTimeWriteCtx, type TaskWriteCtx, type WithheldTaskTimeField,
} from './ifcTaskSlots';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { groupBy } from '@/utils/collections';

/** De OUDE GlobalId-afleiding: een 32-bits hash, geen conforme IFC-GUID. De writer gebruikt hem niet
 *  meer (zie `ifcGuid128`); de lezer herberekent hem nog voor bestanden van vóór audit 2026-09-26,
 *  waarin een resource- of baseline-verwijzing alleen via deze hash terug te vinden is. */
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

const IFC_GUID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/**
 * GlobalId voor een object zonder bewaarde GlobalId (audit 2026-09-26, eigenaarsbesluit 2026-09-28):
 * een 128-bits hash van de seed (cyrb128), in de IFC-vorm: 22 tekens uit `IFC_GUID_CHARS`, het
 * eerste teken draagt de hoogste twee bits en is dus `0`–`3`. Deterministisch en niet willekeurig:
 * dezelfde nieuwe taak krijgt bij elk opslaan hetzelfde GlobalId, ook zonder heropenen. De uniciteit
 * komt uit de seed (het interne id draagt al tijd en toeval).
 */
export function ifcGuid128(seed: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const words = [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  const bit = (k: number) => (words[k >>> 5] >>> (31 - (k & 31))) & 1;
  let out = IFC_GUID_CHARS[(bit(0) << 1) | bit(1)];
  for (let c = 0; c < 21; c++) {
    let v = 0;
    for (let b = 0; b < 6; b++) v = (v << 1) | bit(2 + c * 6 + b);
    out += IFC_GUID_CHARS[v];
  }
  return out;
}

// ifcStr/ifcBool komen uit ./ifcPsets (gedeeld met de per-taak-pset-registry).

/** Tekst voor een attribuut dat een waarde MOET hebben (niet OPTIONAL, of een WHERE-regel eist
 *  `EXISTS`): leeg wordt `''` in plaats van `$`. De lezer (`ifcSlotText`) leest beide als ''. */
function ifcRequiredStr(s: string): string {
  return s ? ifcStr(s) : "''";
}

function ifcDateTime(iso: string): string {
  if (!iso) return '$';
  // Ensure format: 'YYYY-MM-DDT07:00:00' (anker gedeeld met de reader via IFC_TIME_ANCHOR).
  if (iso.length === 10) return `'${iso}T${IFC_TIME_ANCHOR}'`;
  // IfcDateTime vraagt seconden (`YYYY-MM-DDThh:mm:ss`): een tijd zonder seconden
  // (`YYYY-MM-DDThh:mm`, zoals de store uur-instants bewaart) krijgt `:00`.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return `'${iso}:00'`;
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

/** Eén formatterkeuze voor de taakslots én hun getoonde planomvang: een kale datum is bij
 *  een urentaak middernacht, bij een dagtaak het bestaande IFC-daganker. */
function taskDateTimeFormatter(task: Task): (iso: string) => string {
  return taskDurationUnit(task) === 'hours' ? ifcDateTimeHour : ifcDateTime;
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
  // ISO 8601 zet het minteken vóór de P (`-P0Y0M2D`), niet bij het getal (`P0Y0M-2D`, zoals v2026.9.0).
  // Beide lezers, ook die van v2026.9.0, lezen het voorloopteken (`parseDurationDays`).
  if (days < 0) return `'-P0Y0M${ifcDayNumber(-days)}D'`;
  return `'P0Y0M${ifcDayNumber(days)}D'`;
}

/** Duur van een UUR-taak in minuten als ISO-8601-duur met tijdcomponent
 *  (`PT{h}H{m}M0S`); minuut-precies en byte-stabiel terug te lezen (`isoDurationToMinutes`). Geen
 *  ruis- of exponentrisico zoals bij `ifcDayNumber`: `minutesToIsoDuration` rondt op hele minuten. */
function ifcDurationHour(minutes: number): string {
  return `'${minutesToIsoDuration(minutes)}'`;
}

/**
 * De argumenten van een IfcWorkPlan/IfcWorkSchedule (`IfcWorkControl`), precies de 14 van het schema
 * (IFC4/IFC4X3/IFC4X3_ADD2 gelijk): GlobalId, OwnerHistory, Name, Description, ObjectType,
 * Identification, CreationDate, Creators, Purpose, Duration, TotalFloat, StartTime, FinishTime,
 * PredefinedType. Oudere versies schreven er 15 (één `$` te veel vóór StartTime); de lezer kent beide
 * (`ifcWorkControlSlots.ts`), `check-ifc-arity` bewaakt het aantal.
 */
function workControlArgs(a: {
  guid: string; ownerHistId: number; name: string; description: string;
  creationDate: string; predefinedType: 'PLANNED' | 'BASELINE';
  // Al geformatteerde STEP-waarden: de taakgebonden dag-/uursemantiek moet behouden blijven.
  startTimeArg: string; finishTimeArg: string;
}): string {
  return [
    ifcStr(a.guid), `#${a.ownerHistId}`, ifcStr(a.name), ifcStr(a.description),
    '$', // ObjectType
    '$', // Identification
    ifcDateTime(a.creationDate),
    '$', // Creators
    '$', // Purpose
    '$', // Duration
    '$', // TotalFloat
    a.startTimeArg,
    a.finishTimeArg,
    `.${a.predefinedType}.`,
  ].join(',');
}

/** De vroegste start in een baseline (ISO, lexicaal te vergelijken); '' bij een lege baseline. */
function baselineStart(b: Baseline): string {
  let first = '';
  for (const t of b.tasks ?? []) if (t.start && (!first || t.start < first)) first = t.start;
  return first;
}

export interface WriteContext {
  literalCalendarIds?: ReadonlySet<string>;
  milestonesAtDayEnd?: ReadonlySet<string>;
  lines: string[];
  nextId: number;
  idMap: Map<string, number>; // our ID -> STEP #id
  /** seed → daadwerkelijk uitgegeven GlobalId. */
  guids: Map<string, string>;
  /** Alle uitgegeven GlobalIds, om botsingen te detecteren. */
  usedGuids: Set<string>;
  /** seed → GlobalId uit het ingelezen bestand (`ImportResult.ifcGlobalIds`): wint van de hash. */
  preservedGuids: ReadonlyMap<string, string>;
  /** De waarden van `preservedGuids`: een nieuw object mag die nooit krijgen, ook niet als zijn
   *  eigenaar pas later in het bestand aan de beurt is. */
  reservedGuids: ReadonlySet<string>;
  /** Project-id: zout voor de GlobalIds van hulpentiteiten en de projectkalender (zie `guidOf`). */
  auxSalt: string;
}

/**
 * Geef het GlobalId uit voor een hulpentiteit (pset, rel, werkschema) met een vaste of afgeleide
 * `seed`. De hash krijgt het project-id mee (`auxSalt`): zonder dat hadden `agg_ps`, `ctrl`,
 * `pset_sequences` e.d. in élk OPS-bestand hetzelfde GlobalId (audit 2026-09-26). Geen lezer rekent
 * deze GlobalIds na, dus het zout mag hier.
 */
function guidOf(ctx: WriteContext, seed: string): string {
  return issueGuid(ctx, seed, `${ctx.auxSalt}/${seed}`);
}

/**
 * De enige plek die GlobalIds uitgeeft, en garandeert dat ze uniek zijn binnen dit bestand. Eerst het
 * GlobalId dat het object in het ingelezen bestand al had (`preservedGuids`, op `key`), anders
 * `ifcGuid128(hashSeed)`. Botst dat met een eerder uitgegeven of gereserveerd GlobalId, dan wordt er
 * deterministisch doorgezocht met een gesuffixte seed.
 *
 * Een gesuffixt GlobalId is alleen terug te vinden omdat de writer expliciet wegschrijft wélk
 * GlobalId hij per taak gebruikte (zie `writeBaselineMeta`); de reader herberekent de hash niet.
 */
function issueGuid(ctx: WriteContext, key: string, hashSeed: string): string {
  const cached = ctx.guids.get(key);
  if (cached !== undefined) return cached;
  const kept = ctx.preservedGuids.get(key);
  let guid: string;
  if (kept !== undefined && !ctx.usedGuids.has(kept)) {
    guid = kept;
  } else {
    guid = ifcGuid128(hashSeed);
    for (let n = 1; ctx.usedGuids.has(guid) || ctx.reservedGuids.has(guid); n++) guid = ifcGuid128(`${hashSeed}#dup${n}`);
  }
  ctx.guids.set(key, guid);
  ctx.usedGuids.add(guid);
  return guid;
}

/** Soort van een object met een eigen id. De seed krijgt de soort als voorvoegsel: uit XER kunnen
 *  taak, relatie en kalender hetzelfde kale getal als id dragen (task_id, task_pred_id, clndr_id), en
 *  zonder voorvoegsel kregen ze via de cache van `guidOf` hetzelfde GlobalId (audit 2026-09-26).
 *  `wp`/`ws`: het werkplan en het (niet-baseline) werkschema van het project, sleutel = project-id;
 *  het werkschema is het anker voor 4D-koppelingen in andere pakketten (review 2026-09-28). */
export type IfcObjectKind = 'task' | 'res' | 'cal' | 'seq' | 'proj' | 'wp' | 'ws';

/** De seed (en sleutel in `ImportResult.ifcGlobalIds`) van een object. */
export function ifcObjectSeed(kind: IfcObjectKind, id: string): string {
  return `${kind}:${id}`;
}

function objectGuid(ctx: WriteContext, kind: IfcObjectKind, id: string): string {
  const key = ifcObjectSeed(kind, id);
  // De projectkalender heet in elk project `cal-default`: zonder zout had hij in elk nieuw bestand
  // hetzelfde GlobalId. Geen lezer rekent zijn GlobalId na (DurationWalks schrijft het uit).
  return issueGuid(ctx, key, kind === 'cal' && id === DEFAULT_CALENDAR_ID ? `${key}@${ctx.auxSalt}` : key);
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
  minuteModelPending?: boolean;
  /**
   * "Datums zoals opgeslagen": per taak-id de rekenslots die de
   * writer als `$` moet schrijven, omdat `task.time` daar in de modus een weergave-terugval draagt
   * en geen vastlegging uit het bronbestand. Alleen gevuld door `buildWriteIFCInput` wanneer de modus
   * aanstaat; afwezig ⇒ alles gewoon geschreven.
   */
  withheldTaskTimeFields?: Readonly<Record<string, readonly WithheldTaskTimeField[]>>;
  /**
   * Hoe het XER-bronarchief in het bestand landt. `embedded` (standaard) schrijft de volledige
   * bronbytes: elk projectbestand, export en echte AutoSave. `recovery-reference` schrijft alleen
   * lengte + SHA-256 en is UITSLUITEND voor crashherstel-snapshots (`serializeRecoverySnapshot`):
   * de bytes staan daar één keer als blob naast de snapshots. Zie
   * `docs/superpowers/plans/2026-10-07-xer-archief-eenmalig.md`.
   */
  xerSourceArchiveStorage?: 'embedded' | 'recovery-reference';
};

export function writeIFC(input: WriteIFCInput): string {
  const {
    project, calendar, tasks: sourceTasks, sequences, resources, assignments,
    activityCodeTypes = [],
    customFieldDefs = [],
    customTaskTypes = [],
    resourceCalendars = [],
    baselines: sourceBaselines = [],
    activeBaselineId = null,
    libraryPool = undefined,
    xerSourceArchive = undefined,
    xer = undefined,
    xerSourceProjectId = undefined,
    importPristine = undefined,
    withheldTaskTimeFields = undefined,
    recordedSourceFormat = undefined,
    ifcGlobalIds = undefined,
    xerSourceArchiveStorage = 'embedded',
  } = input;
  const writeView = minuteModelWriteView({ tasks: sourceTasks, calendar, resourceCalendars, baselines: sourceBaselines });
  const { tasks, baselines } = writeView;
  const preservedGuids = new Map(Object.entries(ifcGlobalIds ?? {}));
  const ctx: WriteContext = {
    literalCalendarIds: writeView.literalCalendarIds, milestonesAtDayEnd: writeView.atDayEnd,
    lines: [], nextId: 1, idMap: new Map(), guids: new Map(), usedGuids: new Set(),
    preservedGuids, reservedGuids: new Set(preservedGuids.values()), auxSalt: project.id,
  };
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
  // projectnaam blijft leeg in `IFCPROJECT.Name` (`''`, zie daar) — dat is de plek waar "geen naam"
  // hoort te staan.
  const headerFileName = projectFileBase(headerText(project.name)) + '.ifc';
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');",
    `FILE_NAME(${ifcStr(headerFileName)},${ifcStr(now)},(${ifcStr(headerText(project.author || 'Open Planner Studio'))}),(${ifcStr(headerText(project.company || 'OpenAEC Foundation'))}),'Open Planner Studio 0.1','Open Planner Studio','');`,
    // Het schema van het project (issue #292, `Project.ifcSchema`; afwezig ⇒ `DEFAULT_IFC_SCHEMA`,
    // IFC4X3_ADD2 = IFC 4.3.2.0, ISO 16739-1:2024). Voor alle entiteiten die OPS schrijft, zijn de drie
    // schema's gelijk in aantal en volgorde van attributen (zie `IFC_SCHEMAS`); `projectIfcSchema` laat
    // nooit een vrije tekst in de kop toe.
    `FILE_SCHEMA(('${projectIfcSchema(project)}'));`,
    'ENDSEC;',
    'DATA;',
    '',
  ].join('\n');

  // Owner history. `IfcOrganization.Name` is verplicht, en `IfcPerson` eist een naam of id
  // (WHERE-regel IdentifiablePerson). Leeg ⇒ `''` in plaats van `$`; de lezer (`extractProject`) leest
  // beide als ''.
  const personId = addLine(ctx, '_person', `IFCPERSON($,${ifcRequiredStr(project.author)},$,$,$,$,$,$)`);
  const orgId = addLine(ctx, '_org', `IFCORGANIZATION($,${ifcRequiredStr(project.company)},$,$,$)`);
  const personOrgId = addLine(ctx, '_personorg', `IFCPERSONANDORGANIZATION(#${personId},#${orgId},$)`);
  const appOrgId = addLine(ctx, '_apporg', `IFCORGANIZATION($,'OpenAEC Foundation',$,$,$)`);
  // Version is een formaatteken (zie `OPS_APP_VERSION`): de lezer decodeert STEP-tekst pas vanaf '0.2'.
  const appId = addLine(ctx, '_app', `IFCAPPLICATION(#${appOrgId},${ifcStr(OPS_APP_VERSION)},'Open Planner Studio','OPS')`);
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
  // uit de IFCWORKPLAN.Description-slot, met terugval op deze. Name: een naamloos project schrijft `''`
  // (geen verzonnen naam), omdat `IfcProject.HasName` (WHERE-regel) een Name eist. De lezer leest `''`
  // en `$` allebei als leeg.
  addLine(ctx, '_project', `IFCPROJECT(${ifcStr(objectGuid(ctx, 'proj', project.id))},#${ownerHistId},${ifcRequiredStr(project.name)},${ifcStr(project.description)},$,$,$,(#${ctxId}),#${unitAssId})`);
  if (!input.minuteModelPending) {
    const prop = addLine(ctx, '_time_model', `IFCPROPERTYSINGLEVALUE('TimeModel',$,IFCLABEL(${ifcStr(MINUTE_MODEL_TIME_MODEL)}),$)`);
    const pset = addLine(ctx, '_time_model_pset', `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'time_model'))},#${ownerHistId},'OPS_Project',$,(#${prop}))`);
    addLine(ctx, '_time_model_rel', `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'time_model_rel'))},#${ownerHistId},$,$,(${ref(ctx, '_project')}),#${pset})`);
  }
  writeXerSourceArchive(ctx, ownerHistId, xerSourceArchive, xer?.sourceProjectId ?? xerSourceProjectId, xerSourceArchiveStorage);

  // Calendar (projectkalender — altijd de EERSTE IFCWORKCALENDAR in het bestand; vaste conventie
  // die de reader aanhoudt om 'm van de bibliotheek-kalenders hieronder te onderscheiden).
  const effCalByTask = effectiveCalendarByTask(tasks, calendar, resourceCalendars);
  const hourTaskCalendarIds = writeView.literalCalendarIds;
  const projectCalWritten = writeCalendar(ctx, calendar, ownerHistId, '_calendar', hourTaskCalendarIds.has(calendar.id));
  writeCalendarGenerationMeta(ctx, calendar, ownerHistId, projectCalWritten);

  // Planomvang van de GETOONDE taken, zoals de Gantt en de basislijn: werkelijke datums waar
  // die vaststaan, anders early, anders invoer (`taskDates`). Ook samenvattingen tellen mee.
  // Invoerankers en contractuele projectdatums blijven apart bewaard; opslaan rekent niet.
  // Normaliseer vóór de GETOONDE datumkeuze én min/max met de IfcTaskTime-formatter: een kale
  // uurdatum is 00:00, een kale dagdatum 07:00. Ook de vergelijking actual/computed in een fase
  // moet die tijden zien. Alleen een tijdelijke kopie; de invoer en taakslots blijven onaangeroerd.
  const taskSpans = tasks.map(task => {
    const dt = taskDateTimeFormatter(task);
    // Hergebruik de echte writersemantiek en haal alleen de STEP-aanhalingstekens weg, zodat
    // shownStart/shownFinish ISO-datums vergelijken. Leeg blijft leeg; `$` is geen taakdatum.
    const iso = (value: string | undefined): string => value ? dt(value).slice(1, -1) : '';
    const normalized: Task = { ...task, time: { ...task.time,
      scheduleStart: iso(task.time.scheduleStart), scheduleFinish: iso(task.time.scheduleFinish),
      earlyStart: iso(task.time.earlyStart), earlyFinish: iso(task.time.earlyFinish),
      actualStart: iso(task.time.actualStart), actualFinish: iso(task.time.actualFinish),
    } };
    return { start: dt(shownStart(normalized)), finish: dt(shownFinish(normalized)) };
  });
  const startArgs = taskSpans.map(span => span.start).filter(arg => arg !== '$').sort();
  const endArgs = taskSpans.map(span => span.finish).filter(arg => arg !== '$').sort();

  // IfcWorkPlan en IfcWorkSchedule: de 14 argumenten van het schema (`workControlArgs`). StartTime is
  // VERPLICHT. Een project zonder taken en zonder startdatum heeft geen planstart; dan het
  // schrijfmoment, zodat StartTime nooit `$` is. De OPS-lezer gebruikt dit slot dan niet:
  // OPS_ProjectSettings draagt `ProjectStartDate` altijd (ook leeg) en wint.
  const workControlStartArg = startArgs[0] || ifcDateTime(project.startDate || now);
  const workControlFinishArg = endArgs[endArgs.length - 1] || ifcDateTime(project.endDate);
  const workPlanId = addLine(ctx, '_workplan', `IFCWORKPLAN(${workControlArgs({
    guid: objectGuid(ctx, 'wp', project.id), ownerHistId, name: project.name, description: project.description,
    creationDate: now, startTimeArg: workControlStartArg, finishTimeArg: workControlFinishArg, predefinedType: 'PLANNED',
  })})`);

  const workSchedId = addLine(ctx, '_worksched', `IFCWORKSCHEDULE(${workControlArgs({
    guid: objectGuid(ctx, 'ws', project.id), ownerHistId, name: 'Construction schedule v1.0', description: '',
    creationDate: now, startTimeArg: workControlStartArg, finishTimeArg: workControlFinishArg, predefinedType: 'PLANNED',
  })})`);

  // Baselines — per baseline één `.BASELINE.`-IfcWorkSchedule-header (Name +
  // CreationDate, ZONDER taak-duplicatie: de datums leven verliesloos in het OPS_Baselines-JSON
  // hieronder). Puur een interop-signaal "deze baselines bestaan" voor externe IFC-tools.
  // Golden rule: geen baselines ⇒ geen extra IfcWorkSchedule (de lus doet niets).
  // StartTime en CreationDate zijn in het schema verplicht: de vroegste start in de baseline, anders de
  // planstart van het werkschema hierboven; een baseline zonder aanmaakdatum krijgt het schrijfmoment.
  // De OPS-lezer leest deze slots niet (de datums staan in het JSON); ze zijn er voor andere pakketten.
  const baselineSchedRefs: string[] = [];
  for (const b of baselines) {
    const start = baselineStart(b);
    const bId = addLine(ctx, `_baseline_ws_${b.id}`, `IFCWORKSCHEDULE(${workControlArgs({
      guid: guidOf(ctx, 'baseline_ws_' + b.id), ownerHistId, name: b.name, description: '',
      creationDate: b.createdAt || now, startTimeArg: start ? ifcDateTime(start) : workControlStartArg,
      finishTimeArg: ifcDateTime(b.projectEnd),
      predefinedType: 'BASELINE',
    })})`);
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
  storage: 'embedded' | 'recovery-reference',
): void {
  if (!archive) return;
  if (!sourceProjectId) throw new Error('XER-bronarchief kan niet zonder OPS_XerDocument-selector worden opgeslagen.');
  if (!archive.diagnostics.documentViews[sourceProjectId]) {
    throw new Error('XER-bronarchief kan niet zonder geldige OPS_XerDocument-selector worden opgeslagen.');
  }
  const props: number[] = [];
  const property = (name: string, value: string) => props.push(addLine(ctx, `xerarchive_prop_${name}`, `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value},$)`));
  if (storage === 'recovery-reference') {
    // Crashherstel: alleen de verwijzing. De bytes (en hun base64-codering) raken deze tick niet.
    property('SchemaVersion', `IFCINTEGER(${XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_SCHEMA_VERSION})`);
    property('Format', `IFCLABEL(${ifcStr(archive.format)})`);
    property('StorageFormat', `IFCLABEL(${ifcStr(XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT)})`);
    property('ByteLength', `IFCINTEGER(${archive.byteLength})`);
    property('Sha256', `IFCTEXT(${ifcStr(archive.sha256)})`);
  } else {
    property('SchemaVersion', `IFCINTEGER(${XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION})`);
    property('Format', `IFCLABEL(${ifcStr(archive.format)})`);
    property('StorageFormat', `IFCLABEL(${ifcStr(XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT)})`);
    property('ByteLength', `IFCINTEGER(${archive.byteLength})`);
    property('Sha256', `IFCTEXT(${ifcStr(archive.sha256)})`);
    property('ByteChunkSize', `IFCINTEGER(${XER_SOURCE_ARCHIVE_CHUNK_BYTES})`);
    property('ByteChunkCount', `IFCINTEGER(${archive.byteChunks.length})`);
    archive.byteChunks.forEach((chunk, index) => property(`ByteChunk${String(index).padStart(6, '0')}`, `IFCTEXT(${ifcStr(chunk)})`));
  }
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
  for (const task of tasks) if (task.customTaskTypeId) taskTypeIds[objectGuid(ctx, 'task', task.id)] = task.customTaskTypeId;
  const value = JSON.stringify({ definitions, taskTypeIds });
  const propId = addLine(ctx, '_ps_tasktypes_json',
    `IFCPROPERTYSINGLEVALUE('TaskTypes',$,IFCTEXT(${ifcStr(asciiJson(value))}),$)`);
  const setId = addLine(ctx, '_pset_tasktypes',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tasktypes'))},#${ownerHistId},${ifcStr(PSET.TaskTypes)},$,(#${propId}))`);
  addLine(ctx, '_rel_tasktypes',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tasktypes'))},#${ownerHistId},$,$,(#${ctx.idMap.get('_project')}),#${setId})`);
}

// FIELD_MEASURE (IfcSimplePropertyTemplate.PrimaryMeasureType per custom-field-type) staat in
// ./ifcConstants zodat de reader er de inverse uit afleidt (geen stille divergentie).

function ifcTypedValue(type: CustomFieldType, value: CustomFieldValue): string {
  switch (type) {
    // Tekst: `ifcRequiredStr`, want `IFCTEXT($)` is geen geldige STEP (een getypte waarde draagt
    // altijd een waarde). Leeg ⇒ `IFCTEXT('')`.
    case 'text': return `IFCTEXT(${ifcRequiredStr(String(value))})`;
    // REAL-typen altijd met decimale punt (`stepReal`); een niet-eindig getal ⇒ NominalValue `$`.
    case 'number': return ifcTypedReal('IFCREAL', Number(value));
    case 'integer': return `IFCINTEGER(${Math.round(Number(value))})`;
    case 'cost': return ifcTypedReal('IFCMONETARYMEASURE', Number(value));
    // Datum via `ifcDateValue`: een tijd erin wordt IFCDATETIME, andere tekst IFCTEXT (geen schemafout).
    case 'date': return ifcDateValue(String(value));
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
    // `ifcDateValue`: datum ⇒ IFCDATE, mét tijd (uur-modus) ⇒ IFCDATETIME met seconden. IfcDate kent
    // geen tijd, dus anders staat de statusdatum na opslaan + openen op middernacht.
    projSettingProps.push(addLine(ctx, '_ps_statusdate',
      `IFCPROPERTYSINGLEVALUE('StatusDate',$,${ifcDateValue(project.statusDate)},$)`));
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
  // Codering: gezet ⇒ `ifcDateValue` (datum ⇒ IFCDATE, mét tijd zoals na een XER-import ⇒
  // IFCDATETIME met seconden), leeg ⇒ NominalValue `$` ("aanwezig, maar geen waarde"), zodat de
  // lezer dat onderscheidt van "veld afwezig" (ouder bestand of ander tool ⇒ WORKPLAN-slot). De motor
  // rekent met de tijd van het projecteinde (`useProjectEndDateForFloat`), de P6- en MSPDI-export met
  // beide. Zie docs/ifc-round-trip.md, "Projectstart en -einde met tijd".
  const contractDateProp = (key: string, name: string, value: string): number =>
    addLine(ctx, key,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value ? ifcDateValue(value) : '$'},$)`);
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
  // De schemavraag bij opslaan (besluit eigenaar 2026-10-13, `services/ifc/ifcSchemaQuestion.ts`).
  // Staat de vraag nog open (automatisch opslaan, crashherstel, MCP-backup), dan bewaart
  // `IfcSchemaUnconfirmed` het schema van het geopende bestand: zo blijft de vraag na herstel staan,
  // ook als dat schema niet in de kop past (IFC2X3). Anders zegt `IfcSchemaConfirmed` dat er niets te
  // vragen valt, zodat een bewust als IFC4 bewaard bestand bij heropenen niet opnieuw vraagt. Een
  // bestand zonder een van beide (oudere versie, ander pakket) vraagt het één keer.
  const schemaQuestion = ifcSchemaQuestionFor(project);
  projSettingProps.push(schemaQuestion
    ? addLine(ctx, '_ps_ifcschemaunconfirmed',
      `IFCPROPERTYSINGLEVALUE('IfcSchemaUnconfirmed',$,IFCLABEL(${ifcStr(schemaQuestion.fileSchema)}),$)`)
    : addLine(ctx, '_ps_ifcschemaconfirmed',
      `IFCPROPERTYSINGLEVALUE('IfcSchemaConfirmed',$,IFCBOOLEAN(.T.),$)`));
  // P6 Project-ID (zie `documentProjectCode`). Golden rule: alleen wanneer gezet.
  if (project.p6ProjectCode) {
    projSettingProps.push(addLine(ctx, '_ps_p6projectcode',
      `IFCPROPERTYSINGLEVALUE('P6ProjectCode',$,IFCTEXT(${ifcStr(project.p6ProjectCode)}),$)`));
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
    `IFCPROPERTYSINGLEVALUE('structure',$,IFCTEXT(${ifcStr(asciiJson(metaJson))}),$)`);
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
      // `IfcPropertyEnumeration.EnumerationValues` is een LIST [1:?]: een codetype zonder waarden
      // krijgt geen enumeratie (Enumerators `$`). De OPS-lezer haalt de definities uit
      // OPS_StructureMeta; de template is alleen voor andere tools.
      const labels = t.values.map(v => `IFCLABEL(${ifcRequiredStr(v.code)})`).join(',');
      const enumRef = t.values.length > 0
        ? `#${addLine(ctx, `_acte_${t.id}`, `IFCPROPERTYENUMERATION(${ifcRequiredStr(t.name)},(${labels}),$)`)}`
        : '$';
      const id = addLine(ctx, `_actt_${t.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(guidOf(ctx, 'actt_' + t.id))},#${ownerHistId},${ifcStr(t.name)},$,.P_ENUMERATEDVALUE.,$,$,${enumRef},$,$,$,$)`);
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
          `IFCPROPERTYSINGLEVALUE(${ifcRequiredStr(def.name)},$,${ifcTypedValue(def.type, value)},$)`);
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
          `IFCPROPERTYENUMERATEDVALUE(${ifcRequiredStr(t.name)},$,(IFCLABEL(${ifcRequiredStr(v.code)})),$)`);
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
    `IFCPROPERTYSINGLEVALUE('pool',$,IFCTEXT(${ifcStr(asciiJson(json))}),$)`);
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
      const specs = desc.write(task, { atDayEnd: ctx.milestonesAtDayEnd?.has(task.id) === true });
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
    `IFCPROPERTYSINGLEVALUE('Baselines',$,IFCTEXT(${ifcStr(asciiJson(json))}),$)`));
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
      if (bt.taskId) baselineTaskGuids[bt.taskId] = objectGuid(ctx, 'task', bt.taskId);
    }
  }
  if (Object.keys(baselineTaskGuids).length > 0) {
    props.push(addLine(ctx, '_ps_baselines_guids',
      `IFCPROPERTYSINGLEVALUE('TaskGuids',$,IFCTEXT(${ifcJson(baselineTaskGuids)}),$)`));
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
    `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT(${ifcStr(asciiJson(json))}),$)`);
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
    `IFCPROPERTYSINGLEVALUE('SchedulingProfile',$,IFCTEXT(${ifcStr(asciiJson(json))}),$)`);
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
  /** Een DAGkalender zonder gematerialiseerde blokken, waarvan de lezer de ene geschreven periode zelf
   *  als afwijkend ziet (`canonicalizeBands`: een hele dag of over middernacht) en dus zonder markering
   *  zou promoveren naar een uurkalender. */
  scalarPeriodReadsAsHour: boolean;
  /** `WorkingTimes` draagt meer dan één weekgroep (werkblokken die per weekdag verschillen, zie
   *  `weekBandGroups`). Dan is de scalar werktijd niet eenduidig uit de periodes af te leiden: een
   *  oudere lezer neemt de eerste groep, deze lezer de eerste werkdag met blokken. */
  perDayWeek: boolean;
  /** Alleen bij een UURkalender (`cal.workTime`): de uren per dag die de lezer uit de GESCHREVEN blokken
   *  afleidt (`promoteHourCalendar` → `deriveHoursPerDay`, de modale dagsom). `NaN` als er geen blok
   *  geschreven is (de lezer heeft dan geen eigen afleiding). Dagkalender ⇒ `undefined`. */
  readerHourCalendarHoursPerDay: number | undefined;
}

/** Eén `IFCWORKTIME` in `WorkingTimes`: de werkdagen (in `cal.workDays`-volgorde) met precies
 *  dezelfde set blokken, en die blokken. */
interface WeekBandGroup {
  days: number[];
  bands: ReadonlyArray<{ start: number; end: number }>;
}

/** Engelse dagafkortingen voor het label van een `IFCWORKTIME`-groep (ISO 1 = maandag). */
const ISO_DAY_LABEL: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

/**
 * Groepeert de werkdagen van een kalender op een identieke set blokken: één groep per
 * `IFCWORKTIME` in `WorkingTimes`, met een eigen `IFCRECURRENCEPATTERN(.WEEKLY.)` (WeekdayComponent +
 * TimePeriods). Zo modelleert IFC 4.3 zelf een week met een korte vrijdag (`IfcWorkCalendar`, figuur 1:
 * ma–do 8:00–12:00 + 13:00–17:00, vr 8:00–14:00 — elk een eigen `IfcWorkTime`, zonder overlap).
 *
 *  - Alleen de dagen uit `cal.workDays`, net als vóór deze indeling (dagen buiten `workDays` schreef de
 *    writer nooit). Een werkdag zonder eigen blokken krijgt, net als vroeger, de blokken van de eerste
 *    werkdag (`cal.workDays[0]`): zo blijft elke kalender die vroeger verliesloos was één groep.
 *  - Twee dagen horen bij dezelfde groep als hun blokken (gesorteerd op begin) gelijk zijn; de groep
 *    schrijft de blokken in de volgorde van zijn eerste dag.
 *  - Volgorde: die van `cal.workDays` (eerste voorkomen). De eerste groep met blokken is die van de
 *    eerste werkdag. Verder heeft de volgorde geen betekenis: `WorkingTimes` is een SET.
 *  - Een uitgebrachte OPS-versie (t/m v2026.9.0) leest `WorkingTimes` niet, want zij verwacht de
 *    kalender met 8 attributen (zie `writeCalendar` en docs/ifc-round-trip.md, "Oudere OPS-versies").
 *    Daarom is er geen terugvalweek meer (besluit orkestrator 2026-10-13, PR #344; hij zat in geen
 *    enkele release).
 *  - Eén groep (uniforme week) ⇒ het bestand is byte-identiek aan vroeger.
 */
function weekBandGroups(workDays: readonly number[], workTime: WorkTimeBands): WeekBandGroup[] {
  const ownBands = (day: number) => (day >= 1 && day <= 7 ? workTime.byWeekday[day as 1] : undefined) ?? [];
  const firstDayBands = workDays.length > 0 ? ownBands(workDays[0]) : [];
  const groups: WeekBandGroup[] = [];
  const byKey = new Map<string, WeekBandGroup>();
  for (const day of workDays) {
    const own = ownBands(day);
    const bands = own.length > 0 ? own : firstDayBands;
    const key = [...bands].sort((a, b) => a.start - b.start || a.end - b.end)
      .map((b) => `${b.start}-${b.end}`).join(',');
    let group = byKey.get(key);
    if (!group) {
      group = { days: [], bands };
      byKey.set(key, group);
      groups.push(group);
    }
    group.days.push(day);
  }
  return groups;
}

function writeCalendar(
  ctx: WriteContext,
  cal: WorkCalendar,
  ownerHistId: number,
  key: string = '_calendar',
  includeEffectiveScalarBands = false,
): WriteCalendarResult {
  // Work time recurrence (weekdays)
  let firstPeriod: [string, string] | undefined;
  let perDayWeek = false;
  let scalarPeriodReadsAsHour = false;
  const workTime = cal.workTime ?? (includeEffectiveScalarBands ? effectiveWorkTimeBands(cal) : undefined);
  // Werkblokken die per weekdag verschillen ⇒ meer groepen, elk een eigen `IFCWORKTIME` (zie
  // `weekBandGroups`). Een uniforme week (één groep) en een kalender zonder blokken nemen de tak
  // hieronder ongewijzigd: hun bestand blijft byte-identiek. Een scalaire kalender is altijd uniform
  // (`effectiveWorkTimeBands` geeft elke werkdag dezelfde blokken).
  const groups = workTime ? weekBandGroups(cal.workDays, workTime) : [];
  const workTimeIds: number[] = [];
  /** Eén `IFCWORKTIME` met een WEEKLY-patroon; geeft zijn STEP-id terug. */
  // Alleen aangeroepen met een groep die blokken en dagen heeft (`written` hieronder): geen lege lijst.
  const writeWeek = (days: readonly number[], bands: WeekBandGroup['bands'], label: string): number => {
    const ids = bands.map((b) =>
      addLine(ctx, '_timeperiod', `IFCTIMEPERIOD('${minutesToClock(b.start)}','${minutesToClock(b.end, true)}')`),
    );
    if (!firstPeriod && bands[0]) firstPeriod = [minutesToClock(bands[0].start), minutesToClock(bands[0].end, true)];
    const recurrenceId = addLine(ctx, '_recurrence',
      `IFCRECURRENCEPATTERN(.WEEKLY.,$,(${days.join(',')}),$,$,$,$,(${ids.map((i) => `#${i}`).join(',')}))`);
    return addLine(ctx, '_worktime', `IFCWORKTIME(${ifcStr(label)},.PREDICTED.,$,#${recurrenceId},$,$)`);
  };
  if (groups.length > 1) {
    // Een groep zonder blokken (de eerste werkdag heeft er geen) heeft geen werktijd; IFC kent geen
    // "werkdag zonder tijdvakken" (een WEEKLY-patroon zonder TimePeriods is de hele dag). Hij gaat dus
    // niet mee — de lezer zou zo'n dag via `promoteHourCalendar` toch uit de werkdagen halen.
    const written = groups.filter((g) => g.bands.length > 0);
    perDayWeek = written.length > 1;
    for (const group of written) {
      const label = `Standard work week (${group.days.map((d) => ISO_DAY_LABEL[d] ?? String(d)).join(', ')})`;
      workTimeIds.push(writeWeek(group.days, group.bands, label));
    }
  } else {
    const dayNums = cal.workDays.join(',');
    let timePeriodRefs: string;
    if (workTime) {
      // UUR-kalender ⇒ `TimePeriods` als LIJST van per-dag-banden (`IfcRecurrencePattern.TimePeriods`
      // is native een lijst). Eén groep: elke werkdag draagt dezelfde banden; we schrijven die van de
      // eerste werkdag. Een wrap-band (`end > 1440`) emitteert het eind als tijd-van-de-dag
      // (`end % 1440`), waaruit de reader de wrap herkent (`end ≤ start`). Een band tot precies
      // middernacht eindigt op '24:00:00' (einde van de dag, begin vóór eind); oudere bestanden met
      // '00:00:00' leest de wrapregel nog.
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
      // Leest de lezer deze ene periode zelf als afwijkend (een hele dag 00:00–24:00, of over
      // middernacht; `canonicalizeBands`), dan promoveert hij de dagkalender zonder markering naar een
      // uurkalender, met de dagsom als uren per dag (0402ScheduleMSP.xml: 8 ⇒ 24). Zelfde toets als de
      // lezer, op dezelfde klokstrings.
      const s = clockToMinutes(startTime);
      const e = clockToMinutes(endTime);
      scalarPeriodReadsAsHour = s != null && e != null && canonicalizeBands({ 1: [{ start: s, end: e }] }).deviates;
    }
    // WeekdayComponent en TimePeriods zijn OPTIONAL SET/LIST [1:?]: een lege lijst `()` is ongeldig,
    // dus leeg ⇒ `$` (een kalender zonder werkdagen, of een uurkalender zonder blokken). De lezer leest
    // `$` en `()` gelijk (geen dagen, geen tijdvakken).
    const recurrenceId = addLine(ctx, '_recurrence',
      `IFCRECURRENCEPATTERN(.WEEKLY.,$,${dayNums ? `(${dayNums})` : '$'},$,$,$,$,${timePeriodRefs ? `(${timePeriodRefs})` : '$'})`);
    // Engelstalig label: dit belandt in ELK opgeslagen IFC-bestand, ook bij een gebruiker die
    // de app in het Duits of Japans draait — en IFC is een Engelstalige standaard, dus een Nederlands
    // label is hier vreemde eend. Veilig te wijzigen: de lezer gebruikt van de `IFCWORKTIME`'s in
    // `WorkingTimes` alleen args[3] (de RecurrencePattern-ref), nooit de naam. Let op het verschil met de
    // FEESTDAG-IFCWORKTIME's in ExceptionTimes: dáár leest de lezer args[0] wél, als feestdagnaam —
    // die komen uit `cal.holidays` en staan hier los van.
    workTimeIds.push(addLine(ctx, '_worktime', `IFCWORKTIME('Standard work week',.PREDICTED.,$,#${recurrenceId},$,$)`));
  }

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
  // De 9 attributen van het schema: GlobalId, OwnerHistory, Name, Description, ObjectType,
  // Identification (`$`, OPS heeft geen kalendercode), WorkingTimes, ExceptionTimes, PredefinedType.
  // OPS t/m v2026.9.0 schreef er 8, zonder Identification; de lezer kent beide (`workCalendarSlots` in
  // `ifcWorkControlSlots.ts`). Zo'n oudere versie leest deze kalender verkeerd: aanvaard, besluit eigenaar
  // 2026-10-13 ("alles in één keer", PR #336). Gemeten in docs/ifc-round-trip.md, "Oudere OPS-versies".
  const calStepId = addLine(ctx, key,
    `IFCWORKCALENDAR(${ifcStr(objectGuid(ctx, 'cal', cal.id))},#${ownerHistId},${ifcStr(cal.name)},${ifcStr(cal.description)},${objectType},$,(${workTimeIds.map((i) => `#${i}`).join(',')}),${exceptStr},${shiftToPredefinedType(cal.shift)})`);
  return {
    calStepId,
    workingExceptionStepIds,
    readerScalarHours: firstPeriod
      ? { start: scalarHourFromClock(firstPeriod[0]), end: scalarHourFromClock(firstPeriod[1]) }
      : undefined,
    materializedScalarBands: !cal.workTime && workTime !== undefined,
    scalarPeriodReadsAsHour,
    perDayWeek,
    readerHourCalendarHoursPerDay: cal.workTime ? writtenWeekHoursPerDay(groups) : undefined,
  };
}

/**
 * De uren per dag die de lezer voor een uurkalender afleidt: de modale dagsom (`deriveHoursPerDay`) van
 * de blokken zoals ze in het bestand staan, dus per groep van `weekBandGroups`. Een dag buiten `workDays`
 * schrijft de writer niet, en een werkdag zonder eigen blokken krijgt die van de eerste werkdag. Geen
 * enkel blok ⇒ `NaN`. `deriveHoursPerDay` leest alleen weekdag 1–7 en slaat dagen zonder blokken over.
 */
function writtenWeekHoursPerDay(groups: readonly WeekBandGroup[]): number {
  const byWeekday: Record<number, WeekBandGroup['bands']> = {};
  for (const group of groups) for (const day of group.days) byWeekday[day] = group.bands;
  return deriveHoursPerDay({ byWeekday } as WorkTimeBands, NaN);
}

/**
 * OPS-metadata van een kalender als `OPS_Calendar`-pset op de bijbehorende `IFCWORKCALENDAR`
 * (`IFCPROPERTYSINGLEVALUE`s + `IFCRELDEFINESBYPROPERTIES`). Elke property volgt de golden rule
 * (alleen schrijven wat afwijkt of gezet is):
 *  - `generation` (regelset-herkomst): alleen bij een gegenereerde kalender.
 *  - `HoursPerDay`: alleen wanneer hij AFWIJKT van wat de lezer zonder deze eigenschap afleidt — bij een
 *    dagkalender `workEndHour − workStartHour` (bv. "Bouwkalender NL" 07-16 met lunchuur: 8 ≠ 9), bij
 *    een uurkalender de modale dagsom van de geschreven blokken (`readerHourCalendarHoursPerDay`). De
 *    regel voor schrijver en lezer staat in docs/ifc-round-trip.md, "Uren per dag bij een
 *    blokkenkalender".
 *  - `WorkingExceptionIds`: de STEP-ids van de werkende-uitzondering-`IFCWORKTIME`'s uit
 *    `writeCalendar`. Dit IS de discriminator waarmee de reader een werkende uitzondering van een
 *    (evt. recurrente) feestdag onderscheidt — een RecurrencePattern-ref is geen IFC-gereserveerd
 *    signaal (zie `writeCalendar`).
 *
 * Kalenderidentiteit door de round-trip:
 *  - `WorkStartHour`/`WorkEndHour`: de lezer haalt de scalar werktijd uit de periodes — sinds 2026-10
 *    bij meer periodes begin eerste / einde laatste periode, daarvóór de EERSTE `IFCTIMEPERIOD`
 *    (`scalarHourFromClock`). De toets hier blijft tegen de eerste periode (`readerScalarHours`): dat is
 *    de afleiding van de lezers sinds H7 (`d16f22881`), die de eigenschappen al lazen. Uitgebrachte
 *    versies tot en met v2026.9.0 lezen deze eigenschappen NIET; zij nemen altijd de eerste periode
 *    (07:00–16:00 met lunchblokken wordt daar 07:00–12:00). Per veld alleen geschreven wanneer de
 *    eerste periode hem niet teruggeeft. Een kalender die nog de oude eerste-blok-scalar draagt (bv.
 *    08:00–12:00 bij blokken 08–12 + 13–17) krijgt dus geen `WorkEndHour` en wordt bij lezen 8–17.
 *    Uitzondering: een week met meer `IFCWORKTIME`-groepen (`perDayWeek`) krijgt beide altijd — daar
 *    leidt een oudere lezer de scalar uit de eerste groep af en deze lezer uit de eerste werkdag met
 *    blokken, dus geen enkele periode geeft hem eenduidig terug.
 *  - `IsHourCalendar = .F.`: alleen wanneer de `IFCTIMEPERIOD`s gematerialiseerde effectieve banden van
 *    een SCALAIRE kalender zijn (een urentaak gebruikt hem). IFC zelf ziet daar gewoon de lunchpauze
 *    (interop); de OPS-lezer weet zo dat de kalender scalair was en promoveert hem niet naar uur-modus.
 *    Ook bij een SCALAIRE kalender waarvan de lezer de ene periode zelf als afwijkend ziet (een hele dag
 *    00:00–24:00, of over middernacht; `scalarPeriodReadsAsHour`): zonder markering werd zo'n
 *    dagkalender na heropenen een uurkalender met de dagsom als uren per dag.
 */
function writeCalendarGenerationMeta(
  ctx: WriteContext,
  cal: WorkCalendar,
  ownerHistId: number,
  written: WriteCalendarResult,
): void {
  const {
    calStepId, workingExceptionStepIds, readerScalarHours, materializedScalarBands, perDayWeek,
    readerHourCalendarHoursPerDay, scalarPeriodReadsAsHour,
  } = written;
  const markScalar = materializedScalarBands || scalarPeriodReadsAsHour;
  const literalTimes = ctx.literalCalendarIds?.has(cal.id) === true;
  const gen = cal.generation;
  // De uren per dag die de lezer zonder deze eigenschap zou afleiden: bij een dagkalender
  // einde − begin, bij een uurkalender de modale dagsom van de geschreven blokken.
  const derivedHoursPerDay = cal.workTime
    ? readerHourCalendarHoursPerDay
    : cal.workEndHour - cal.workStartHour;
  const needsHoursPerDayOverride = hoursPerDayDiffers(cal.hoursPerDay, derivedHoursPerDay);
  const hasWorkingExceptions = workingExceptionStepIds.length > 0;
  const hasP6Source = cal.p6Source === 'XER';
  const hasRejectedPenaltyDiagnostic = cal.p6NonWorkPenaltyDatesState === 'REJECTED';
  const hasSimpleBreak = !cal.workTime
    && (cal.simpleBreakStartMinute !== undefined || cal.simpleBreakDurationMinutes !== undefined);
  // Een enkele 08:00–16:00-band is aan de IFC-kant niet te onderscheiden van een dagkalender met
  // dezelfde scalar-uren. De OPS-markering bewaart daarom de kalenderidentiteit ook zonder urentaak.
  const isHourCalendar = cal.workTime !== undefined;
  // Week met meer groepen: altijd schrijven. Oudere lezers nemen de scalar uit de eerste groep, deze
  // lezer uit de eerste werkdag met blokken (`firstBlockedDay`); die twee kunnen verschillen.
  const needsWorkStartHour = Number.isFinite(cal.workStartHour)
    && (perDayWeek || readerScalarHours?.start !== cal.workStartHour);
  const needsWorkEndHour = Number.isFinite(cal.workEndHour)
    && (perDayWeek || readerScalarHours?.end !== cal.workEndHour);
  if (!gen && !cal.libraryOrigin && !needsHoursPerDayOverride && !hasWorkingExceptions
    && !hasSimpleBreak && !isHourCalendar && !markScalar && !needsWorkStartHour && !needsWorkEndHour
    && !hasP6Source && !hasRejectedPenaltyDiagnostic && !literalTimes) return;
  const props: number[] = [];
  if (literalTimes) props.push(addLine(ctx, `_opscal_literal_${cal.id}`, "IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.T.),$)"));
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
      `IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT(${ifcJson(cal.libraryOrigin)}),$)`));
  }
  if (needsHoursPerDayOverride) {
    props.push(addLine(ctx, `_opscal_hpd_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('HoursPerDay',$,${ifcTypedReal('IFCREAL', cal.hoursPerDay)},$)`));
  }
  if (needsWorkStartHour) {
    props.push(addLine(ctx, `_opscal_workstart_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('WorkStartHour',$,${ifcTypedReal('IFCREAL', cal.workStartHour)},$)`));
  }
  if (needsWorkEndHour) {
    props.push(addLine(ctx, `_opscal_workend_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('WorkEndHour',$,${ifcTypedReal('IFCREAL', cal.workEndHour)},$)`));
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
  } else if (markScalar) {
    props.push(addLine(ctx, `_opscal_hourmode_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('IsHourCalendar',$,IFCBOOLEAN(.F.),$)`));
  }
  if (hasWorkingExceptions) {
    const idJson = JSON.stringify(workingExceptionStepIds.map(String));
    props.push(addLine(ctx, `_opscal_wexc_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('WorkingExceptionIds',$,IFCTEXT(${ifcStr(asciiJson(idJson))}),$)`));
  }
  if (hasP6Source) {
    props.push(addLine(ctx, `_opscal_p6source_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('P6Source',$,IFCLABEL('XER'),$)`));
  }
  if (hasP6Source) {
    props.push(addLine(ctx, `_opscal_p6penalty_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('P6NonWorkPenaltyDates',$,IFCTEXT(${ifcJson(cal.p6NonWorkPenaltyDates ?? [])}),$)`));
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
  const dt = taskDateTimeFormatter(task);
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
    task, ownerHistId, guidArg: ifcStr(objectGuid(ctx, 'task', task.id)), taskTimeId, customTaskTypeLabel,
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
    // REAL met decimale punt (`stepReal`): 100 % ⇒ `IFCRATIOMEASURE(1.)`, niet `(1)`. De guard
    // hierboven maakt het getal eindig, dus `stepReal` geeft altijd een waarde.
    return `IFCRATIOMEASURE(${stepReal(seq.lagPercent / 100)!})`;
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
    `IFCRELSEQUENCE(${ifcStr(objectGuid(ctx, 'seq', seq.id))},#${ownerHistId},$,$,${ref(ctx, `task_${seq.predecessorId}`)},${ref(ctx, `task_${seq.successorId}`)},${lagRef},.${seq.type}.,$)`);
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
    .map(sequence => objectGuid(ctx, 'seq', sequence.id));
  if (boundarySequenceGuids.length === 0) return;
  const propId = addLine(ctx, '_ps_seq_boundary',
    `IFCPROPERTYSINGLEVALUE('P6StartAtPredecessorFinishBoundarySequenceGuids',$,IFCTEXT(${ifcJson(boundarySequenceGuids)}),$)`);
  const setId = addLine(ctx, '_pset_sequences',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_sequences'))},#${ownerHistId},${ifcStr(PSET.Sequences)},$,(#${propId}))`);
  addLine(ctx, '_rel_sequences',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_sequences'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

function writeResource(ctx: WriteContext, res: Resource, ownerHistId: number): void {
  // Entiteitnaam uit de gedeelde RESOURCE_TYPE_TO_IFC-map (reader leidt de inverse eruit af);
  // onbekend type ⇒ MATERIAL.
  const entityName = RESOURCE_TYPE_TO_IFC[res.type] ?? 'IFCCONSTRUCTIONMATERIALRESOURCE';
  // De 11 argumenten van het schema (alle vijf soorten, IFC4/IFC4X3 gelijk): GlobalId, OwnerHistory,
  // Name, Description, ObjectType, Identification, LongDescription, Usage, BaseCosts, BaseQuantity,
  // PredefinedType. Oudere versies schreven er 9, met het type op de plek van BaseCosts. De lezer leest
  // alleen GlobalId, Name en Description, dus voor hem maakt het aantal niet uit.
  // PredefinedType `.NOTDEFINED.`: `.USERDEFINED.` (wat oudere versies bedoelden) eist een ObjectType
  // (regel CorrectPredefinedType), en OPS kent geen verfijning onder de vijf soorten.
  const entity = `${entityName}(${ifcStr(objectGuid(ctx, 'res', res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,$,$,.NOTDEFINED.)`;
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
        `IFCPROPERTYSINGLEVALUE('MaxUnits',$,${ifcTypedReal('IFCREAL', res.maxUnits)},$)`);
      props.push(`#${id}`);
    }
    if (res.costPerHour !== undefined) {
      const id = addLine(ctx, `_resch_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('CostPerHour',$,${ifcTypedReal('IFCMONETARYMEASURE', res.costPerHour)},$)`);
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
        `IFCPROPERTYSINGLEVALUE('ParentGuid',$,IFCTEXT(${ifcStr(objectGuid(ctx, 'res', res.parentId))}),$)`);
      props.push(`#${id}`);
    }
    if (res.libraryOrigin) {
      const id = addLine(ctx, `_reslo_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT(${ifcJson(res.libraryOrigin)}),$)`);
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
      const resGuid = objectGuid(ctx, 'res', a.resourceId); // zelfde GUID als writeResource gebruikte
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
      plannedUnitsPerDay?: number;
    }> = {};
    list.forEach((a, index) => {
      // `curveValues` (de exacte 21-punts P6-/MSPDI-curve) reist in hetzelfde JSON-blob mee — een
      // toewijzing zonder venster én zonder curve schrijft niets. De drie optionele werkvelden
      // (begroot/verricht/resterend, minuten) idem — zelfde blob, zelfde `GUID#N`-sleutel. Het
      // begrote tempo (`plannedUnitsPerDay`, alleen naast een P6-resttempo) ook: het pipe-formaat
      // van `OPS_Assignments` blijft ongewijzigd.
      if (a.workWindowStart === undefined && a.workWindowFinish === undefined && a.curveValues === undefined
        && a.plannedWorkMinutes === undefined && a.actualWorkMinutes === undefined && a.remainingWorkMinutes === undefined
        && a.plannedUnitsPerDay === undefined) return;
      const resGuid = objectGuid(ctx, 'res', a.resourceId);
      const propName = `${resGuid}#${index}`;
      windows[propName] = {
        ...(a.workWindowStart !== undefined ? { workWindowStart: a.workWindowStart } : {}),
        ...(a.workWindowFinish !== undefined ? { workWindowFinish: a.workWindowFinish } : {}),
        ...(a.curveValues !== undefined ? { curveValues: [...a.curveValues] } : {}),
        ...(a.plannedWorkMinutes !== undefined ? { plannedWorkMinutes: a.plannedWorkMinutes } : {}),
        ...(a.actualWorkMinutes !== undefined ? { actualWorkMinutes: a.actualWorkMinutes } : {}),
        ...(a.remainingWorkMinutes !== undefined ? { remainingWorkMinutes: a.remainingWorkMinutes } : {}),
        ...(a.plannedUnitsPerDay !== undefined ? { plannedUnitsPerDay: a.plannedUnitsPerDay } : {}),
      };
    });
    if (Object.keys(windows).length === 0) continue;
    const propId = addLine(ctx, `_ps_tp_${task.id}`,
      `IFCPROPERTYSINGLEVALUE('Windows',$,IFCTEXT(${ifcJson(windows)}),$)`);
    const setId = addLine(ctx, `_pset_tp_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tp_' + task.id))},#${ownerHistId},${ifcStr(PSET.Timephased)},$,(#${propId}))`);
    addLine(ctx, `_rel_tp_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tp_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

/**
 * `Task.timephasedDurationWalks` als eigen `OPS_TimephasedDurationWalks`-JSON-pset, NIET via
 * `ifcPsets.PER_TASK_PSETS`: `resourceCalendarId` is een app-interne kalenderverwijzing die bij
 * inlezen een ander id kan krijgen (de lezer leidt het af uit het GlobalId).
 *
 * Vertaling via `resourceCalendarGuid`, niet via de kalenderNAAM (die is niet uniek ⇒ stille
 * datacorruptie). `objectGuid(ctx, 'cal', cal.id)` is per `ctx` gememoïseerd en élke kalender is vóór deze
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
      resourceCalendarGuid: objectGuid(ctx, 'cal', w.resourceCalendarId),
      ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
    }));
    const propId = addLine(ctx, `_ps_tpdw_${task.id}`,
      `IFCPROPERTYSINGLEVALUE('DurationWalks',$,IFCTEXT(${ifcJson(json)}),$)`);
    const setId = addLine(ctx, `_pset_tpdw_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tpdw_' + task.id))},#${ownerHistId},${ifcStr(PSET.DurationWalks)},$,(#${propId}))`);
    addLine(ctx, `_rel_tpdw_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tpdw_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}
