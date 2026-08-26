import { Task, TaskTime, TaskType, TASK_TYPES } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, AvailabilityStep, ResourceCurve } from '@/types/resource';
import { Project, SchedulingOptions } from '@/types/project';
import { WorkCalendar, Holiday, CalendarGeneration, WorkingException } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { HolidayCountry } from '@/engine/calendar/holidays';
import type { LibraryOrigin } from '@/types/library';
import { ActivityCodeType, CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { Baseline, BaselineTask } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { formatDate, formatInstant, parseInstant } from '@/utils/dateUtils';
import { ifcGuid } from './ifcWriter';
import { IfcParseError } from './ifcErrors';
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import {
  DEFAULT_PRIORITY, IFC_TIME_ANCHOR, MEASURE_TO_FIELD, IFC_TO_RESOURCE_TYPE,
} from './ifcConstants';
import { PSET, PER_TASK_PSET_BY_NAME } from './ifcPsets';
import {
  IFC_TASKTIME_SLOTS, ALL_RECORDED_SLOT_KEYS, TASK_SLOT, TASKTIME_SLOT,
  type RecordedFieldKey, type TaskTimeReadHelpers,
} from './ifcTaskSlots';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import type { XerImportMetadata } from '@/services/importTypes';
import {
  createXerSourceArchive, decodeXerBase64Chunk, sha256Hex, XER_SOURCE_ARCHIVE_CHUNK_BYTES,
  XER_SOURCE_ARCHIVE_SCHEMA_VERSION, type XerSourceArchive, type XerSourceArchiveBom,
  type XerSourceArchiveEncoding, type XerSourceArchiveNewline,
} from '@/services/xerSourceArchive';
import {
  canonicalizeBands, clockToMinutes, getCalendarBands, hasNonAnchorTime, isoDurationToMinutes,
  isSubDayMinutes, promoteHourCalendar, registerCalendarBands,
} from '@/services/subdayIo';

// IFC_TIME_ANCHOR (§7.1, discriminator c) en DEFAULT_PRIORITY (fase 2.5) wonen nu in ./ifcConstants
// zodat reader en writer gegarandeerd hetzelfde anker/dezelfde default gebruiken. De rauwe-banden-
// registry (voorheen een lokale WeakMap) en `synthBandsFromScalar` wonen nu gedeeld in subdayIo (F5).

const VALID_CURVES: ResourceCurve[] = ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK'];

interface StepEntity {
  id: string; // STEP entity ID (may include letters, e.g. "300T")
  type: string;
  args: string[];
  raw: string;
}

// ── Integriteitscontract (bevinding K4) ────────────────────────────────────────────────────────
// `readIFC` had geen enkel contract: alles wat er niet uit te halen viel werd stil een leeg
// project. Precies dát maakte een afgekapte auto-save-snapshot onzichtbaar. De minimale,
// formaat-eigen controle: een STEP-uitwisselingsbestand BEGINT met `ISO-10303-21;` en EINDIGT met
// `END-ISO-10303-21;` (ISO 10303-21 §5). Ontbreekt de kop, dan is het geen STEP-bestand; ontbreekt
// de sluitmarkering, dan is de tekst afgekapt — het enige signaal dat een half weggeschreven
// bestand überhaupt afgeeft. Bewust GEEN inhoudelijke drempel (zoals "minstens één taak"): een
// leeg-maar-echt project — verse wizard met kalender en resources — is legitiem, en zou anders bij
// crashherstel als onbruikbaar worden weggegooid.
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
export function readIFC(content: string, labels: ImportLabels = {}): ImportResult {
  // Eerst de integriteitspoort: liever een expliciete fout dan een stil half project (K4).
  assertIfcIntegrity(content);
  const entities = parseSTEP(content);
  const entityMap = new Map<string, StepEntity>();
  for (const e of entities) {
    entityMap.set(e.id, e);
  }

  // Extract project
  const project = extractProject(entities, entityMap, labels);
  const xerSourceArchive = extractXerSourceArchive(entities, entityMap);
  const xerSourceProjectId = extractXerSourceProjectId(entities, entityMap, xerSourceArchive);
  const xer = extractXerImportMetadata(xerSourceArchive, xerSourceProjectId);
  const calendar = extractCalendar(entities, entityMap);
  // Taken die aan een `.BASELINE.`-IfcWorkSchedule hangen zijn baseline-snapshots, geen live
  // taken (fase 2.6, §8.3) — sla ze over (robuust tegen externe tools; OPS zelf hangt er geen op).
  const baselineTaskStepIds = collectBaselineTaskStepIds(entities);
  const { tasks, taskStepIdMap, taskTimeEntities, recordedFields } = extractTasks(entities, entityMap, baselineTaskStepIds);
  const sequences = extractSequences(entities, entityMap, taskStepIdMap);
  extractNesting(entities, entityMap, tasks, taskStepIdMap);
  const { resources, resourceStepIdMap, resourceGuidMap } = extractResources(entities, entityMap);
  extractResourceMeta(entities, entityMap, resources, resourceStepIdMap, resourceGuidMap);
  extractCrewNesting(entities, resources, resourceStepIdMap);
  const { calendars: resourceCalendars, idByGuid: calendarIdByGuid } = extractCalendarLibrary(
    entities, entityMap, resources, resourceStepIdMap, tasks, taskStepIdMap,
  );
  // Z14b (F1) — de PROJECTkalender zit niet in `extractCalendarLibrary`'s bibliotheek-lus (die sluit
  // 'm expliciet uit); haar GUID→id hoort wel in dezelfde vertaaltabel. Zelfde "eerste IFCWORKCALENDAR
  // in het bestand"-conventie als `extractCalendar`/`extractCalendarLibrary` zelf hanteren.
  const projectCalendarEntityForGuid = entities.find(e => e.type === 'IFCWORKCALENDAR');
  if (projectCalendarEntityForGuid) {
    calendarIdByGuid.set(stripQuotes(projectCalendarEntityForGuid.args[0] || ''), calendar.id);
  }
  // Fase 2.8b (§7.1, golf 4): uur-modus-post-pass. Ná extractCalendarLibrary zodat elke
  // `task.calendarId` (en dus de effectieve kalender) is geresolved. Zet `workTime` op kalenders
  // die afwijken van het dag-patroon (discriminator a/b/c) en herinterpreteert de duren/datetimes
  // van uur-taken minuut-precies. Dag-bestanden leveren geen signaal ⇒ ongemoeid (byte-identiek).
  applyHourModeIFC(tasks, calendar, resourceCalendars, taskTimeEntities);
  const assignments = extractAssignments(entities, entityMap, taskStepIdMap, resourceStepIdMap);
  // Fase 3 (H2): task.resourceIds herbouwen uit de assignments. De assignments zijn de ENIGE bron
  // van waarheid voor de taak↔resource-koppeling in het bestand (geen dubbele opslag) — de reader
  // projecteert ze terug op elke taak. Deterministische, gede-dupliceerde volgorde (eerste-zien in
  // de assignments-volgorde, die op zijn beurt uit de STEP-volgorde komt).
  reconstructResourceIds(tasks, assignments);
  const libraryPoolOut: { value: import('@/types/library').CompanyPool | undefined } = { value: undefined };
  const projectStartRecorded = { value: false };
  const { activityCodeTypes, customFieldDefs } = extractStructure(
    entities, entityMap, project, tasks, taskStepIdMap, libraryPoolOut, projectStartRecorded,
  );
  for (const task of tasks) reconcileP6SuspendResume(task);
  // Z14b (Z8-nataak, F1-fixronde) — LAAG-4-kalenderwandelingen, eigen pset (zie de functie se
  // moduleheader voor waarom dit niet via de PER_TASK_PSETS-registry loopt): GUID→id-vertaling, dus
  // pas NA extractCalendarLibrary hierboven (die tabel levert `calendarIdByGuid`).
  extractTimephasedDurationWalksMeta(entities, entityMap, tasks, taskStepIdMap, calendarIdByGuid);
  // Fase 3 (P11): OPS_Leveling wordt nu binnen extractStructure via de per-taak-registry gedispatcht
  // (samen met de andere zeven per-taak-psets) — geen losse extractLevelingMeta-aanroep meer.

  // Baselines (fase 2.6, §8.3): autoritatieve OPS_Baselines-JSON, met taskId-remap via GlobalId.
  const { baselines, activeBaselineId } = extractBaselines(entities, entityMap, taskStepIdMap);

  // Scheduling-options (fase 2.9, §3.4/§6): het volledige blok uit de OPS_SchedulingOptions-JSON.
  const schedulingOptions = extractSchedulingOptions(entities, entityMap);
  if (schedulingOptions) project.schedulingOptions = schedulingOptions;

  // Voortgang-invarianten op de rauw ingelezen actuals (§3.2/§15.6) — ná extractStructure zodat
  // project.statusDate (uit OPS_ProjectSettings) beschikbaar is als default-actualFinish.
  normalizeImportedProgress(tasks, project.statusDate);

  // Projectstart niet in het bestand (geen gevuld IFCWORKPLAN-slot en geen OPS_ProjectSettings,
  // zie de ''-sentinel bij de projectbouw) ⇒ afleiden uit de vroegste taak-scheduleStart in plaats
  // van "vandaag" te verzinnen: een verzonnen datum is geen invoer en mag dus ook niet via de
  // T7-projectstart-vloer (`CPMSolver.rootFloor`) taken mét voorgangers naar de leesdatum tillen.
  // Pas als het bestand ook geen enkele taakstart draagt, valt hij terug op vandaag (leeg project).
  // MAAR (critreview-bevinding 1): heeft het OPS-pset het veld GEZEGD — óók als "bewust leeg" —
  // dan is leeg een uitspraak van de gebruiker en blijft hij leeg; afleiden zou de round-trip van
  // een leeggemaakte startdatum corrumperen (writer codeert dat als NominalValue $).
  if (!project.startDate && !projectStartRecorded.value) {
    let earliest = '';
    for (const t of tasks) {
      const st = t.time?.scheduleStart;
      if (st && (!earliest || st < earliest)) earliest = st;
    }
    project.startDate = earliest ? earliest.substring(0, 10) : formatDate(new Date());
  }

  return {
    project, calendar, tasks, sequences, resources, assignments,
    activityCodeTypes, customFieldDefs, resourceCalendars,
    baselines, activeBaselineId,
    libraryPool: libraryPoolOut.value,
    recordedFields,
    ...(xerSourceArchive ? { xerSourceArchive } : {}),
    ...(xerSourceProjectId ? { xerSourceProjectId } : {}),
    ...(xer ? { xer } : {}),
  };
}

function extractXerImportMetadata(
  archive: XerSourceArchive | undefined, sourceProjectId: string | undefined,
): XerImportMetadata | undefined {
  if (!archive || !sourceProjectId) return undefined;
  const all = archive.diagnostics.documentMetadataByProject;
  if (all === undefined) return undefined;
  if (!all || typeof all !== 'object' || Array.isArray(all)) xerArchiveError('documentMetadataByProject is geen object');
  const candidate = (all as Record<string, unknown>)[sourceProjectId];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) xerArchiveError('selector wijst naar ontbrekende documentmetadata');
  const metadata = candidate as Record<string, unknown>;
  if (metadata.sourceProjectId !== sourceProjectId
    || typeof metadata.defaultCurrencyCode !== 'string'
    || !metadata.tableReport || typeof metadata.tableReport !== 'object'
    || !Array.isArray(metadata.calendarIssues)
    || !Array.isArray(metadata.enumFallbacks)
    || !metadata.scheduleOptions || typeof metadata.scheduleOptions !== 'object'
    || !Array.isArray(metadata.externalRelations)
    || !Array.isArray(metadata.externalLinks)
    || !metadata.report || typeof metadata.report !== 'object') {
    xerArchiveError('documentmetadata heeft niet het verwachte XER-contract');
  }
  const resources = metadata.resources;
  if (resources !== undefined && (!resources || typeof resources !== 'object'
    || Array.isArray(resources)
    || !Array.isArray((resources as Record<string, unknown>).assignments)
    || !Array.isArray((resources as Record<string, unknown>).issues))) {
    xerArchiveError('X6-provenance heeft niet het verwachte contract');
  }
  // Een IFC-document krijgt een zelfstandige, mutable documentview; het bronarchief blijft frozen.
  return structuredClone(metadata) as unknown as XerImportMetadata;
}

function extractXerSourceProjectId(
  entities: StepEntity[], entityMap: Map<string, StepEntity>, archive: XerSourceArchive | undefined,
): string | undefined {
  const props = archiveProps(entities, entityMap, PSET.XerDocument);
  if (!props) {
    if (archive) xerArchiveError('OPS_XerDocument-selector ontbreekt');
    return undefined;
  }
  if (!archive) xerArchiveError('OPS_XerDocument bestaat zonder OPS_XerSourceArchive');
  if (JSON.stringify([...props.keys()]) !== JSON.stringify(['ArchiveSha256', 'SourceProjectId'])) {
    xerArchiveError('OPS_XerDocument-properties zijn niet exact en deterministisch geordend');
  }
  if (requiredString(props, 'ArchiveSha256') !== archive.sha256) xerArchiveError('selector ArchiveSha256 wijst niet naar het archief');
  return requiredString(props, 'SourceProjectId');
}

function xerArchiveError(message: string): never {
  throw new IfcParseError('xer-source-archive', `Ongeldig OPS_XerSourceArchive: ${message}`);
}

function archiveProps(entities: StepEntity[], entityMap: Map<string, StepEntity>, psetName: string): Map<string, unknown> | undefined {
  const sets = entities.filter(entity => entity.type === 'IFCPROPERTYSET' && stripQuotes(entity.args[2] || '') === psetName);
  if (sets.length === 0) return undefined;
  if (sets.length !== 1) xerArchiveError(`Pset '${psetName}' komt ${sets.length} keer voor`);
  const project = entities.find(entity => entity.type === 'IFCPROJECT');
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

function nonNegativeSafeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) xerArchiveError(`${name} is geen niet-negatief safe integer`);
  return value;
}

function requiredString(props: Map<string, unknown>, name: string): string {
  const value = props.get(name);
  if (typeof value !== 'string' || !value) xerArchiveError(`${name} ontbreekt of is geen tekenreeks`);
  return value;
}

function concatArchiveChunks(props: Map<string, unknown>, prefix: string, count: number, expectedLength: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (let index = 0; index < count; index++) {
    const name = `${prefix}${String(index).padStart(6, '0')}`;
    const raw = requiredString(props, name);
    if (index < count - 1 && raw.includes('=')) xerArchiveError(`${name} bevat verboden base64-padding vóór de laatste chunk`);
    let decoded: Uint8Array;
    try { decoded = decodeXerBase64Chunk(raw); } catch { xerArchiveError(`${name} bevat ongeldige base64`); }
    const expectedChunkLength = index === count - 1 ? expectedLength - index * XER_SOURCE_ARCHIVE_CHUNK_BYTES : XER_SOURCE_ARCHIVE_CHUNK_BYTES;
    if (decoded.length !== expectedChunkLength) xerArchiveError(`${name} heeft ${decoded.length} i.p.v. ${expectedChunkLength} bytes`);
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

/** Lees en valideer vóór allocatie de self-contained X9-container; afwezig blijft legacy-compatibel. */
function extractXerSourceArchive(entities: StepEntity[], entityMap: Map<string, StepEntity>): XerSourceArchive | undefined {
  const props = archiveProps(entities, entityMap, PSET.XerSourceArchive);
  if (!props) return undefined;
  const schemaVersion = nonNegativeSafeInteger(props.get('SchemaVersion'), 'SchemaVersion');
  if (schemaVersion !== XER_SOURCE_ARCHIVE_SCHEMA_VERSION) xerArchiveError(`onbekend SchemaVersion ${schemaVersion}`);
  if (requiredString(props, 'Format') !== 'primavera-p6-xer') xerArchiveError('Format is niet primavera-p6-xer');
  const byteLength = nonNegativeSafeInteger(props.get('ByteLength'), 'ByteLength');
  const chunkSize = nonNegativeSafeInteger(props.get('ByteChunkSize'), 'ByteChunkSize');
  if (chunkSize !== XER_SOURCE_ARCHIVE_CHUNK_BYTES) xerArchiveError(`ByteChunkSize is niet ${XER_SOURCE_ARCHIVE_CHUNK_BYTES}`);
  const chunkCount = nonNegativeSafeInteger(props.get('ByteChunkCount'), 'ByteChunkCount');
  if (chunkCount !== Math.ceil(byteLength / chunkSize)) xerArchiveError('ByteChunkCount past niet bij ByteLength');
  const diagnosticsLength = nonNegativeSafeInteger(props.get('DiagnosticsByteLength'), 'DiagnosticsByteLength');
  const diagnosticsCount = nonNegativeSafeInteger(props.get('DiagnosticsChunkCount'), 'DiagnosticsChunkCount');
  if (diagnosticsCount !== Math.ceil(diagnosticsLength / chunkSize)) xerArchiveError('DiagnosticsChunkCount past niet bij DiagnosticsByteLength');
  const manifestNames = [
    'SchemaVersion', 'Format', 'ByteLength', 'Sha256', 'Encoding', 'Bom', 'Newline',
    'ByteChunkSize', 'ByteChunkCount', 'DiagnosticsByteLength', 'DiagnosticsSha256', 'DiagnosticsChunkCount',
  ];
  const orderedNames = [
    ...manifestNames,
    ...Array.from({ length: chunkCount }, (_, index) => `ByteChunk${String(index).padStart(6, '0')}`),
    ...Array.from({ length: diagnosticsCount }, (_, index) => `DiagnosticsChunk${String(index).padStart(6, '0')}`),
  ];
  if (JSON.stringify([...props.keys()]) !== JSON.stringify(orderedNames)) xerArchiveError('properties zijn niet uniek en deterministisch geordend');
  const sourceBytes = concatArchiveChunks(props, 'ByteChunk', chunkCount, byteLength);
  const diagnosticBytes = concatArchiveChunks(props, 'DiagnosticsChunk', diagnosticsCount, diagnosticsLength);
  const sourceHash = requiredString(props, 'Sha256');
  const diagnosticsHash = requiredString(props, 'DiagnosticsSha256');
  if (!/^[0-9a-f]{64}$/.test(sourceHash) || sha256Hex(sourceBytes) !== sourceHash) xerArchiveError('Sha256 is ongeldig of past niet bij de bytes');
  if (!/^[0-9a-f]{64}$/.test(diagnosticsHash) || sha256Hex(diagnosticBytes) !== diagnosticsHash) xerArchiveError('DiagnosticsSha256 is ongeldig of past niet bij de diagnostics');
  let diagnostics: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(diagnosticBytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) xerArchiveError('diagnostics is geen object');
    diagnostics = parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof IfcParseError) throw error;
    xerArchiveError('diagnostics is geen geldige JSON');
  }
  const encoding = requiredString(props, 'Encoding');
  const bom = requiredString(props, 'Bom');
  const newline = requiredString(props, 'Newline');
  if (!(['utf-8', 'utf-16le', 'utf-16be', 'windows-1252'] as readonly string[]).includes(encoding)) xerArchiveError('Encoding is onbekend');
  if (!(['none', 'utf-8', 'utf-16le', 'utf-16be'] as readonly string[]).includes(bom)) xerArchiveError('Bom is onbekend');
  if (!(['lf', 'crlf', 'cr', 'mixed', 'none'] as readonly string[]).includes(newline)) xerArchiveError('Newline is onbekend');
  return createXerSourceArchive(sourceBytes, { schemaVersion, encoding: encoding as XerSourceArchiveEncoding, bom: bom as XerSourceArchiveBom, newline: newline as XerSourceArchiveNewline, diagnostics });
}

// ── STEP-tekstscan: één quote-bewuste toestandsmachine voor álle lagen (bevinding K2) ───────────
// De parser was string-ONVEILIG in drie lagen, elk met een eigen quote-BLINDE truc:
//   1. sectie-split      `content.split('DATA;')[1]?.split('ENDSEC;')[0]`
//   2. commentaar-strip  een globale `/*…*/`-regex
//   3. entity-regex      non-greedy tot de EERSTE `);`
// `);`, `(…)`, `/* */` en zelfs `ENDSEC;` zijn normale Nederlandse plantekst ("Fase 1 (ruwbouw);
// fase 2"), dus alle drie kapten stil planningsdata af — het ergst bij (3): een afgekapte IFCTASK
// verliest zijn TaskTime-ref en valt terug op de DEFAULT-duur, waardoor de planning bij opslaan en
// heropenen zonder enig signaal verandert. `splitArgs` kende `inString` wél, maar draaide pas ná de
// truncatie en kon het niet meer redden. Alle lagen draaien nu op `skipQuotedOrComment` hieronder.
// De scan blijft lineair: één pas over de tekst, geen index of terugsprongen.

const CH_QUOTE = 39;   // '
const CH_STAR = 42;    // *
const CH_SLASH = 47;   // /
const CH_HASH = 35;    // #
const CH_LPAREN = 40;  // (
const CH_RPAREN = 41;  // )
const CH_SEMI = 59;    // ;
const CH_EQ = 61;      // =
const CH_E = 69;       // E

/** Woordteken (`\w` van de oude entity-regex): letters, cijfers, `_`. */
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
 * Een niet-afgesloten string/commentaar loopt door tot het einde van de tekst (tolerant, net als de
 * oude regex, die zulke invoer simpelweg niet matchte).
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
 * of `-1` als het geen complete entiteit is — dan schuift de scan één teken op, precies zoals de
 * oude regex over onbegrepen tekst heen liep. De sluithaak wordt op HAAKDIEPTE gezocht met
 * `skipQuotedOrComment` erlangs, zodat een `);` binnen een taaknaam of notitie de entiteit niet
 * meer afkapt.
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
 * TWEE POGINGEN, in deze volgorde — de volgorde ís de bevinding.
 *
 *  1. **Quote- en commentaar-bewust** (`indexOfCode`). Dit is de juiste scan voor élk syntactisch
 *     geldig STEP-bestand: hij slaat `DATA;` binnen een header-string of binnen een `/* … *\/`
 *     over, en hij is ongevoelig voor opmaak — een bestand zónder één regeleinde (volkomen legaal;
 *     regeleindes zijn witruimte, geen syntaxis), `ENDSEC;DATA;` op één regel, of witruimte als
 *     form feed / vertical tab / NBSP vóór het token.
 *  2. **Regel-verankerd**, alleen als (1) niets vond. Dat gebeurt bij LEGACY-bestanden: onze writer
 *     schreef t/m v2026.7.12 naam/auteur/bedrijf rauw in `FILE_NAME(...)`, dus een project
 *     "Van 't Hof Toren" levert daar een ONGEBALANCEERDE apostrof op. De quote-bewuste scan loopt
 *     daarop de rest van het bestand uit de pas en vindt niets ⇒ zonder deze terugval stil een
 *     leeg project op een bestand dat deze app zélf geschreven heeft.
 *
 * Niet andersom: regelverankering als PRIMAIRE scan weigert de geldige bestanden uit (1) en pikt
 * bovendien een `DATA;` op dat aan het begin van een regel binnen een commentaar of binnen een
 * header-string met een echt regeleinde staat — dat laatste levert nul entiteiten zónder fout, en
 * verzonnen entiteiten uit commentaar. Beide gevallen zijn getest in `check-step-strings` (9f–9k).
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

  // 2. Commentaar strippen (buiten strings) + regeleindes normaliseren — zelfde volgorde als voorheen.
  const clean = stripStepComments(content.slice(dataAt + 'DATA;'.length)).replace(/\r\n/g, '\n');

  // 3. Entiteiten (`#123=IFCTYPE(...);`, ook `#300T=IFCTASKTIME(...);`). Het afsluitende `ENDSEC;`
  //    van de datasectie wordt hier op CODE-niveau herkend — dezelfde grens als de oude split, maar
  //    nu ongevoelig voor `ENDSEC;` in een taaknaam. Één pas, geen aparte zoek-pas over de sectie.
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

/** Split IFC arguments respecting nested parentheses and quotes */
function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      if (i + 1 < argsStr.length && argsStr[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inString = false;
        current += ch;
      }
    } else if (inString) {
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function stripQuotes(s: string): string {
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

/** Optionele tekst uit een IFC-slot: `$`/leeg/afwezig ⇒ '' (geen letterlijke '$' meer teruggeven).
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

// Datum-parse: BEWUST niet gedeeld met MSPDI/P6/CSV (F5-a). Deze variant handelt eerst de
// STEP-quoting (`stripQuotes`) en de `$`-null-conventie af en houdt de exacte lege-tail-semantiek
// (een quoted-lege slot geeft '' terug, niet vandaag) — dat is STEP-specifiek en mag niet verschuiven.
function parseDateFromIFC(s: string): string {
  if (!s || s === '$') return formatDate(new Date());
  const clean = stripQuotes(s);
  // Extract just the date part
  return clean.substring(0, 10);
}

function parseDurationDays(s: string): number {
  if (!s || s === '$') return 0;
  const clean = stripQuotes(s);
  // Parse ISO 8601 duration: P0Y0M5D of P5D of PT8H. Negatief kan op twee manieren voorkomen:
  // standaardconform met voorloopteken vóór de P ('-P2D', zo schrijven wij een lead) of als
  // app-interne legacy-notatie met het teken bij het getal ('P0Y0M-2D'). Beide lezen.
  const leadingNeg = clean.startsWith('-');
  const applySign = (n: number) => (leadingNeg && n > 0 ? -n : n);
  const dayMatch = clean.match(/(-?\d+)D/);
  if (dayMatch) return applySign(parseInt(dayMatch[1]));
  const hourMatch = clean.match(/(-?\d+)H/);
  if (hourMatch) {
    const h = parseInt(hourMatch[1]);
    return applySign(h < 0 ? -Math.ceil(-h / 8) : Math.ceil(h / 8));
  }
  return 0;
}

/**
 * Review-follow-up (2026-08, op bugfix B1) — het dag-deel (`P{d}D`, VÓÓR een eventuele `T`) van een
 * ISO-8601-duur, in minuten. Bewust LOKAAL hier (niet in `subdayIo.ts`'s `isoDurationToMinutes`,
 * die drie andere aanroepers heeft — schedule-/remaining-duur in de uur-modus-post-pass — die
 * ongetest zouden meeveranderen): deze functie bestaat uitsluitend voor de lag-leestak hierboven,
 * die zelf ook alleen een VERDEDIGENDE tak is voor bestanden van andere tools (onze eigen schrijver,
 * `minutesToIsoDuration`, emitteert nooit een dag-component vóór `T`, dus dit raakt nooit de eigen
 * round-trip).
 *
 * KEUZE + ONDERBOUWING: geïnterpreteerd als KALENDERTIJD (1D = 1440 minuten), niet als werkdag ×
 * hoursPerDay. Twee redenen: (1) ISO 8601 zelf is kalendertijd — de WORKTIME/ELAPSEDTIME-duiding
 * (`IfcLagTime.DurationType`) stuurt pas LATER hoe de resulterende hoeveelheid tegen een kalender
 * wordt afgezet (`CPMSolver.resolveElapsedMinutes` rekent een dag-lag bij ELAPSEDTIME ook al ×24×60,
 * exact deze conventie); (2) een werkdag-interpretatie zou de kalender van de VOORGANGER-taak nodig
 * hebben (`hoursPerDay`), die op dit punt in de reader niet beschikbaar is (sequences worden vóór de
 * kalenderbibliotheek/taak-kalender-toewijzing geëxtraheerd) — gokken met een impliciete 8u-default
 * zou een tweede, ONGEDOCUMENTEERDE aanname toevoegen. Bij een WORKTIME-lag blijft de resulterende
 * `lagMinutes` dus licht ruw (kalenderminuten i.p.v. werkminuten) voor dit randgeval — een bewuste,
 * gedocumenteerde afweging, geen stille correctheidsclaim; het alternatief (het dag-deel laten
 * verdwijnen, zoals vóór deze fix) is strikt slechter.
 *
 * Geen dag-component vóór `T` (het normale eigen-schrijver-pad) ⇒ 0, dus geen gedragswijziging voor
 * bestaande bestanden of de andere twee ondersteunde lag-lay-outs.
 */
function isoDurationLeadingDaysMinutes(iso: string): number {
  const MIN_PER_CALENDAR_DAY = 1440;
  const clean = iso.trim();
  const neg = clean.startsWith('-');
  const tIdx = clean.indexOf('T');
  const datePart = tIdx >= 0 ? clean.slice(0, tIdx) : '';
  const dayMatch = datePart.match(/(\d+)D/);
  if (!dayMatch) return 0;
  const days = parseInt(dayMatch[1], 10);
  return (neg ? -days : days) * MIN_PER_CALENDAR_DAY;
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

  // Auteur/organisatie uit de owner-history-keten (IFCOWNERHISTORY → IFCPERSONANDORGANIZATION →
  // IFCPERSON.FamilyName / IFCORGANIZATION.Name; spiegel van wat de writer schrijft). Via de keten
  // i.p.v. `entities.find('IFCPERSON')` zodat we de PROJECT-persoon/organisatie pakken en niet de
  // applicatie-organisatie ('OpenAEC Foundation'). Ontbreekt de keten (bestand van een ander tool)
  // of is een slot leeg (`$`) ⇒ '' (de bestaande default; oude bestanden laden identiek).
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
    id: generateId('proj'),
    // Twee verschillende gevallen, bewust verschillend afgehandeld:
    //
    //  1. Er ís een IFCPROJECT. Dan telt zijn naamslot — óók als die leeg is. `ifcSlotText`, niet
    //     `stripQuotes`: een naamloos project schrijft de writer als `$` (`ifcStr('')`), en
    //     `stripQuotes` gaf daar letterlijk '$' op terug — dan stond er na opslaan+heropenen een
    //     dollarteken als projectnaam. Leeg blijft leeg, zodat de weergave-fallback
    //     (`common:project.untitled`) ook ná het openen werkt.
    //  2. Er is GEEN IFCPROJECT (kapot/vreemd bestand). Dan stempelen we wél een naam in de data:
    //     leeg laten zou "Nieuwe planning" tonen, en dat suggereert ten onrechte dat de import
    //     mislukt is terwijl er misschien gewoon taken uit het bestand komen. De tekst komt van de
    //     aanroeper (`ImportLabels`), want deze dienstlaag heeft geen `t(...)`.
    name: proj ? ifcSlotText(proj.args[2]) : (labels.importedProject || DEFAULT_IMPORTED_PROJECT_NAME),
    // Omschrijving uit de IFCWORKPLAN.Description-slot (waar de writer 'm schrijft), met terugval op
    // de IFCPROJECT.Description-slot; `$`/leeg ⇒ '' (voorheen kwam letterlijk '$' terug — een bug).
    description: ifcSlotText(wp?.args[3]) || ifcSlotText(proj?.args[3]),
    // Geen IFCWORKPLAN, of een IFCWORKPLAN met een LEEG StartTime-slot ($) ⇒ startdatum hier LEEG
    // laten; `readIFC` leidt hem dan af uit de vroegste taakstart (en pas als óók die ontbreekt:
    // vandaag). Voorheen stond hier direct "vandaag" — verzonnen data die via de T7-projectstart-
    // vloer taken mét voorgangers naar de leesdatum tilde (main-merge vóór v2026.8.1,
    // check-recorded-dates 9A/9B; het lege-slot-geval: critreview-bevinding 4). `parseDateFromIFC`
    // wordt bewust alleen op een niet-lege slottekst losgelaten — op '' levert hij zelf "vandaag".
    startDate: wp && ifcSlotText(wp.args[12]) ? parseDateFromIFC(wp.args[12]) : '',
    endDate: wp ? parseDateFromIFC(wp.args[13] || '') : '',
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
 * Fase 2.8b (§7.1, golf 4) — uur-modus-post-pass. Draait ná het resolven van elke `task.calendarId`.
 * Beslist per kalender (project + bibliotheek) of hij uur-modus is volgens de normatieve
 * discriminator (7-intro): (a)/(b) uit de eigen banden, of (c) sub-dag-informatie van een taak die
 * hem gebruikt (een duur met tijdcomponent die niet op hele dagen valt, of een datetime met een
 * echte tijd-van-de-dag ≠ `T07:00`). Uur-kalenders krijgen `workTime` + afgeleide `hoursPerDay`;
 * hun taken krijgen minuut-precieze `durationMinutes` en echte tijden. Geen signaal ⇒ alles blijft
 * dag-modus (byte-identiek).
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
  //    de F5-noot bij `promoteHourCalendar`.
  for (const cal of [projectCal, ...resourceCalendars]) {
    promoteHourCalendar(cal, getCalendarBands(cal), subDayCals.has(cal), true);
  }

  // 3. Herinterpreteer de taken op een uur-kalender: minuut-precieze duur + echte tijden.
  for (const t of tasks) {
    const effCal = effCalOf(t);
    if (!effCal.workTime) continue;
    const e = taskTimeEntities.get(t.id);
    if (!e) continue;
    const hpd = effCal.hoursPerDay;
    const durMin = isoDurationToMinutes(stripQuotes(e.args[TASKTIME_SLOT.scheduleDuration] || ''));
    const minutes = durMin != null ? durMin : Math.round(t.time.scheduleDuration * hpd * 60);
    t.time.durationMinutes = minutes;
    if (hpd > 0) t.time.scheduleDuration = minutes / (hpd * 60);
    const toHour = (raw: string | undefined): string | undefined => {
      const q = stripQuotes(raw || '');
      return q && q !== '$' ? formatInstant(parseInstant(q), 'hour') : undefined;
    };
    const ss = toHour(e.args[TASKTIME_SLOT.scheduleStart]); if (ss) t.time.scheduleStart = ss;
    const sf = toHour(e.args[TASKTIME_SLOT.scheduleFinish]); if (sf) t.time.scheduleFinish = sf;
    const es = toHour(e.args[TASKTIME_SLOT.earlyStart]); if (es) t.time.earlyStart = es;
    const ef = toHour(e.args[TASKTIME_SLOT.earlyFinish]); if (ef) t.time.earlyFinish = ef;
    const ls = toHour(e.args[TASKTIME_SLOT.lateStart]); if (ls) t.time.lateStart = ls;
    const lf = toHour(e.args[TASKTIME_SLOT.lateFinish]); if (lf) t.time.lateFinish = lf;
    const as = toHour(e.args[TASKTIME_SLOT.actualStart]); if (as) t.time.actualStart = as;
    const af = toHour(e.args[TASKTIME_SLOT.actualFinish]); if (af) t.time.actualFinish = af;
    const remMin = isoDurationToMinutes(stripQuotes(e.args[TASKTIME_SLOT.remainingTime] || ''));
    if (remMin != null) t.time.remainingMinutes = remMin;
  }
}

/**
 * Welke slots vulde dit IfcTaskTime écht? `$`, leeg en afwezig tellen NIET mee. Rekenslots
 * (`RECORDED_SLOT_KEYS`) én de twee invoerslots ScheduleStart/ScheduleFinish
 * (`RECORDED_INPUT_SLOT_KEYS`) tellen allebei mee — de tweelagenkeuze in "datums zoals opgeslagen"
 * heeft de aanwezigheid van BEIDE nodig (kwaliteitsreview MOET 1): zonder de invoerslots hier kon de
 * terugvallaag een `$`-ScheduleStart niet onderscheiden van een écht geëxporteerde datum.
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

function extractTasks(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  baselineTaskStepIds: Set<string> = new Set(),
): { tasks: Task[]; taskStepIdMap: Map<string, string>; taskTimeEntities: Map<string, StepEntity>; recordedFields: Record<string, RecordedFieldKey[]> } {
  const taskEntities = entities.filter(e => e.type === 'IFCTASK' && !baselineTaskStepIds.has(e.id));
  const tasks: Task[] = [];
  const taskStepIdMap = new Map<string, string>(); // STEP #id -> our task id
  // Fase 2.8b (§7.1): onze taak-id → IFCTASKTIME-entiteit, zodat de uur-modus-post-pass de rauwe
  // duur-/datetime-strings kan herlezen zodra de effectieve kalender bekend is.
  const taskTimeEntities = new Map<string, StepEntity>();
  // Aanwezigheidsregistratie voor "datums zoals opgeslagen": per taak-id de rekenslots die het
  // bestand echt vulde. Een taak ZONDER IfcTaskTime krijgt een lege lijst (niet: ontbrekend) —
  // "geen enkel slot gevuld" is een uitspraak, "onbekend" niet.
  const recordedFields: Record<string, RecordedFieldKey[]> = {};

  for (const te of taskEntities) {
    const id = generateId('task');
    taskStepIdMap.set(te.id, id);

    // Twee IFCTASK-lay-outs (L1-fix, zie writeTask): spec-conform IFC 4.3 telt 13 args
    // (WorkMethod op index 8; IsMilestone/Priority/TaskTime/PredefinedType op 9/10/11/12) —
    // dat schrijven wij nu zelf en dat schrijven ook bestanden van derden. Oudere
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
    const time = ttEntity ? parseTaskTime(ttEntity) : createDefaultTaskTime(formatDate(new Date()), 5);
    if (ttEntity) taskTimeEntities.set(id, ttEntity);
    recordedFields[id] = ttEntity ? recordedSlotsOf(ttEntity) : [];

    const isMilestone = te.args[isMilestoneIdx]?.includes('T') || false;
    if (isMilestone) time.scheduleDuration = 0;

    // IfcTask.Priority (zie writeTask voor de index-verificatie). Veilige parse
    // zonder `||`-valkuil (§7.6): `0 || 500` zou een legitieme prioriteit 0 corrumperen.
    const priorityRaw = (te.args[priorityIdx] || '').trim();
    let priority = DEFAULT_PRIORITY;
    if (priorityRaw && priorityRaw !== '$') {
      const p = parseInt(priorityRaw, 10);
      priority = Number.isFinite(p) ? p : DEFAULT_PRIORITY;
    }

    tasks.push({
      id,
      name: stripQuotes(te.args[TASK_SLOT.name] || '') || 'Naamloze taak',
      // `$`/leeg/afwezig ⇒ '' (niet de letterlijke '$' — zelfde bug/fix als IFCPROJECT.Description
      // hierboven; de writer schrijft description/identification bewust als bare `$` via `ifcStr`
      // wanneer leeg, zie ifcTaskSlots.ts).
      description: ifcSlotText(te.args[TASK_SLOT.description]),
      wbsCode: ifcSlotText(te.args[TASK_SLOT.identification]),
      taskType: te.args[predefinedTypeIdx] ? parseTaskType(te.args[predefinedTypeIdx]) : 'CONSTRUCTION',
      status: 'NOT_STARTED',
      isMilestone,
      priority,
      parentId: null,
      childIds: [],
      time,
      resourceIds: [],
    });
  }

  return { tasks, taskStepIdMap, taskTimeEntities, recordedFields };
}

/** Optionele datum/duur uit een IfcTaskTime-slot: `$`/leeg ⇒ undefined (geen "vandaag"-fallback,
 *  anders zou een legacy-bestand met lege actuals-slots ze als gezet inlezen). */
function optDate(s: string | undefined): string | undefined {
  return s && s !== '$' ? parseDateFromIFC(s) : undefined;
}
function optDuration(s: string | undefined): number | undefined {
  return s && s !== '$' ? parseDurationDays(s) : undefined;
}

/** STEP-parse-helpers die aan de IFCTASKTIME-read-descriptors (./ifcTaskSlots) worden doorgegeven —
 *  ze wonen hier (STEP-specifieke `$`/quote-semantiek) en worden geïnjecteerd zodat de slot-registry
 *  cyclusvrij blijft. `parseDate`/`parseDur` reproduceren de vroegere `... (e.args[N] || '')`-vorm. */
const TASKTIME_READ_HELPERS: TaskTimeReadHelpers = {
  parseDate: (arg) => parseDateFromIFC(arg || ''),
  parseDur: (arg) => parseDurationDays(arg || ''),
  optDate,
  optDur: optDuration,
};

/**
 * IFCTASKTIME → TaskTime via de gedeelde slot-registry (./ifcTaskSlots.IFC_TASKTIME_SLOTS): per slot
 * dispatcht de descriptor zijn eigen `read` (spiegel van de `write` die de writer emitteerde), zodat
 * arg-index en veld niet meer op drie plekken los kunnen divergeren (bevinding A2). Slots zonder
 * `read` (Name/DataOrigin/UserDefinedDataOrigin en StatusTime slot 14 — die statusdatum komt uit
 * OPS_ProjectSettings, §15.3) laten hun veld ongemoeid ⇒ `$`/afwezige actuals blijven undefined en
 * legacy-bestanden laden ongewijzigd. Veld-voor-veld resultaat-identiek aan de vroegere object-literal.
 */
function parseTaskTime(e: StepEntity): TaskTime {
  const time = {} as TaskTime;
  for (let i = 0; i < IFC_TASKTIME_SLOTS.length; i++) {
    IFC_TASKTIME_SLOTS[i].read?.(time, e.args[i], TASKTIME_READ_HELPERS);
  }
  return time;
}

function extractSequences(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
): Sequence[] {
  const seqEntities = entities.filter(e => e.type === 'IFCRELSEQUENCE');
  const sequences: Sequence[] = [];

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
    // Fase 2.8b (§7.1): uur-lag heeft een tijdcomponent (`IFCDURATION('PT..')`) ⇒ `lagMinutes` als
    // bron van waarheid. Alleen de uur-schrijver emitteert die vorm; dag-bestanden (`P{d}D`) leveren
    // `null` en houden `lagDays`.
    let lagMinutes: number | undefined;
    const lagRef = parseRef(se.args[6] || '');
    if (lagRef) {
      const lagEntity = entityMap.get(lagRef);
      if (lagEntity && lagEntity.type === 'IFCLAGTIME') {
        const lagValue = (lagEntity.args[3] || '').trim();
        const durType = (lagEntity.args[4] || '').trim();
        const ratioMatch = lagValue.match(/^IFCRATIOMEASURE\s*\(\s*(-?[\d.]+)\s*\)$/i);
        const durMatch = lagValue.match(/^IFCDURATION\s*\(\s*(.+?)\s*\)$/i);
        if (ratioMatch) {
          // Ratio → procent; afronden tegen floating-point-ruis (0.33*100 = 33.000000000000004).
          lagPercent = Math.round(parseFloat(ratioMatch[1]) * 100 * 1e6) / 1e6;
        } else if (durMatch) {
          // Bugfix B1 (gebruikstest 2026-08): EERST `lagMinutes` proberen (discriminator (c),
          // subdayIo/mspdiReader-conventie "geen dag-afronding"). Een duur MET tijdcomponent
          // (`PT2H0M0S`) is minuut-precies ⇒ `lagDays` blijft 0, nooit de grove uur→dag-ceil van
          // `parseDurationDays` (die was bedoeld voor kale `PT8H`-duren van vóór fase 2.8b, zónder
          // `lagMinutes`-veld — nu overbodig én fout: elke duur met een H/M/S-component parseert ook
          // via `isoDurationToMinutes`, dus de ceil-tak werd altijd samen met een correcte
          // `lagMinutes` geraakt en overschreef die stilzwijgend met een afgeronde dag (2u → +1d).
          // Alleen een PUUR dag-duur (`P{d}D`, geen `T`) levert `isoDurationToMinutes === null` en
          // valt terug op `parseDurationDays`.
          const raw = stripQuotes(durMatch[1]);
          const timeMinutes = isoDurationToMinutes(raw);
          if (timeMinutes != null) {
            // Review-follow-up (2026-08): GEMENGDE vorm (`P1DT2H0M0S`) uit een vreemd bestand — onze
            // eigen schrijver emitteert nooit een dag-component vóór de `T` (zie `minutesToIsoDuration`),
            // maar deze soepel-lezen-tak bestaat juist voor andermans bestanden. Zonder dit zou het
            // dag-deel stil verdwijnen (`isoDurationLeadingDaysMinutes` hieronder). Samen optellen i.p.v.
            // kiezen voorkomt dataverlies aan beide kanten.
            lagMinutes = timeMinutes + isoDurationLeadingDaysMinutes(raw);
            lagDays = 0;
          } else {
            lagMinutes = undefined;
            lagDays = parseDurationDays(durMatch[1]);
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
            lagDays = parseDurationDays(lagValue);
          }
        } else {
          // Legacy-lay-out: de duur staat in arg 5.
          lagDays = parseDurationDays(lagEntity.args[4] || '');
        }
        if (/ELAPSEDTIME/i.test(durType)) lagUnit = 'ELAPSEDTIME';
      }
    }

    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: succId,
      type: parseSequenceType(se.args[7] || ''),
      lagDays,
    };
    if (lagUnit) seq.lagUnit = lagUnit;
    if (lagPercent !== undefined) seq.lagPercent = lagPercent;
    if (lagMinutes !== undefined) seq.lagMinutes = lagMinutes;
    sequences.push(seq);
  }

  return sequences;
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

// MEASURE_TO_FIELD (IFC-measure → custom-field-type) is verhuisd naar ./ifcConstants, waar het
// programmatisch uit de writer-map FIELD_MEASURE wordt afgeleid (kan niet meer divergeren).

/**
 * Fase 2.2 — structuurdefinities en taakwaarden teruglezen (spiegel van writeStructure):
 * de OPS_StructureMeta-JSON is autoritair (verliesloos, behoudt ids/kleuren); ontbreekt die
 * (bestand van een andere tool), dan reconstrueren we de definities uit de conformante
 * IFCPROPERTYSETTEMPLATE-declaraties met verse ids. Taakwaarden (OPS_CustomFields /
 * OPS_ActivityCodes-psets) worden per NAAM teruggemapt naar de definities; het
 * OPS_ProjectSettings-pset zet project.wbsAutoNumber.
 */
function extractStructure(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  project: Project,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
  libraryPoolOut: { value: import('@/types/library').CompanyPool | undefined },
  // Critreview-bevinding 1 (v2026.8.1): het OPS-pset kan "bewust leeg" zeggen — de aanroeper mag
  // de startdatum dan NIET alsnog afleiden. Presentie is een aparte uitspraak naast de waarde.
  projectStartRecorded: { value: boolean },
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

    // Fase 3 (P11) — de acht per-taak-psets via de gedeelde registry: één dispatch op naam vervangt
    // de vroegere zeven losse `if (psetName === 'OPS_X')`-blokken + de losse extractLevelingMeta. De
    // read-logica leeft naast de write-logica in ifcPsets.PER_TASK_PSETS (kan niet meer divergeren).
    const perTask = PER_TASK_PSET_BY_NAME.get(psetName);
    if (perTask) {
      const singleValueProps = props
        .filter(p => p.type === 'IFCPROPERTYSINGLEVALUE')
        .map(p => ({ name: stripQuotes(p.args[0] || ''), value: parseTypedValue(p.args[2] || '') }));
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
        if (name === 'wbsAutoNumber') {
          if (typeof v === 'boolean') project.wbsAutoNumber = v;
        } else if (name === 'StatusDate') {
          // Fase 2.6 (§8.2): P6 data date → project.statusDate.
          if (typeof v === 'string' && v) project.statusDate = v.substring(0, 10);
        } else if (name === 'ProgressMode') {
          // Fase 2.6 (§8.2): alleen PROGRESS_OVERRIDE wordt geschreven; RETAINED_LOGIC is de default.
          if (v === 'PROGRESS_OVERRIDE' || v === 'RETAINED_LOGIC') project.progressMode = v;
        } else if (name === 'ProjectStartDate' || name === 'ProjectEndDate') {
          // Contractuele projectdatums (spiegel van writeStructure). Het PSET WINT wanneer het veld
          // aanwezig is — óók als het leeg is: de writer codeert "bewust leeg" als NominalValue `$`
          // (parseTypedValue ⇒ undefined) en dat moet leeg terugkomen, niet terugvallen op de
          // AFGELEIDE datum uit IFCWORKPLAN.StartTime/FinishTime die extractProject al invulde.
          // Ontbreekt het veld helemaal (bestand van vóór deze versie of van een ander tool), dan
          // komen we hier niet en blijft die WORKPLAN-terugval staan — gedrag exact als voorheen.
          const date = typeof v === 'string' ? v.substring(0, 10) : '';
          if (name === 'ProjectStartDate') { project.startDate = date; projectStartRecorded.value = true; }
          else project.endDate = date;
        } else if (name === 'CreatedAt') {
          // Fase 3 (H2): project-aanmaakdatum als verbatim ISO-instant (spiegel van writeStructure).
          if (typeof v === 'string' && v) project.createdAt = v;
        } else if (name === 'ModifiedAt') {
          if (typeof v === 'string' && v) project.modifiedAt = v;
        } else if (name === 'CompanyId') {
          if (typeof v === 'string' && v) project.companyId = v;
        } else if (name === 'CompanyName') {
          if (typeof v === 'string' && v) project.companyName = v;
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
          const value = parseTypedValue(prop.args[2] || '');
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
  // Index tasks by id once. Voorheen werd elke parent/child via tasks.find()
  // in de lus opgezocht, waardoor nesting O(nestings × children × tasks) was.
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
): { resources: Resource[]; resourceStepIdMap: Map<string, string>; resourceGuidMap: Map<string, string> } {
  const resources: Resource[] = [];
  const resourceStepIdMap = new Map<string, string>();
  const resourceGuidMap = new Map<string, string>(); // IFC GlobalId-string -> ons resource-id

  for (const e of entities) {
    // IFC-entiteit → resource-type via de gedeelde inverse-map (incl. de inkomende-alleen
    // IFCCONSTRUCTIONPRODUCTRESOURCE→EQUIPMENT-alias, §8.A).
    const resType = IFC_TO_RESOURCE_TYPE[e.type];
    if (!resType) continue;

    const id = generateId('res');
    resourceStepIdMap.set(e.id, id);
    resourceGuidMap.set(stripQuotes(e.args[0] || ''), id);

    resources.push({
      id,
      name: stripQuotes(e.args[2] || '') || 'Resource',
      type: resType,
      // `$`/leeg/afwezig ⇒ '' (zelfde bug/fix als IfcTask.Description hierboven).
      description: ifcSlotText(e.args[3]),
      maxUnits: 1,
    });
  }

  return { resources, resourceStepIdMap, resourceGuidMap };
}

/**
 * Fase 2.5 — `OPS_Resource`-pset teruglezen (§7.2, spiegel van `writeResourceMeta`):
 * MaxUnits/CostPerHour/UnitOfMeasure/AvailabilitySteps + de `ParentGuid`-vangnetproperty
 * (§7.3) — die laatste wordt alleen toegepast als `extractCrewNesting` de relatie nog niet
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
          // A6-fix: EERSTE geldige LibraryOrigin wint (gezet-is-gezet-guard), gelijk aan het
          // kalenderpad (extractCalendarLibraryOrigin returnt op de eerste treffer). Zonder de
          // `!res.libraryOrigin`-guard koos dit pad de LAATSTE bij dubbele props in één pset —
          // een stille inconsistentie tussen de twee paden.
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed.companyId === 'string' && typeof parsed.libraryItemId === 'string'
                && typeof parsed.poolVersion === 'number') {
              // F2 (vloot-fixpakket, issue #19): `syncedHash` is optioneel, maar als het veld AANWEZIG
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
 * Fase 2.5 — ploeg-hiërarchie teruglezen (§7.3, spiegel van `writeCrewNesting`): dezelfde
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
 * Fase 2.8a (§8.2) — `calendar.generation`-herkomst teruglezen uit het `OPS_Calendar`-pset
 * (spiegel van `writeCalendarGenerationMeta`): zoekt de `IFCRELDEFINESBYPROPERTIES` die het
 * `IFCWORKCALENDAR` met STEP-id `calStepId` target. Golden rule/legacy (§4.3/§8.2): geen pset
 * gevonden, of een onvolledige/corrupte set (ontbrekende RuleSetId/jaren) ⇒ `undefined` — NOOIT
 * een kalender laten hergenereren op basis van een gok.
 */
function extractCalendarGeneration(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): CalendarGeneration | undefined {
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const objectRefs = parseRefs(rel.args[4] || '');
    if (!objectRefs.includes(calStepId)) continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== PSET.Calendar) continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

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
      // 'WinterStop' (verwijderde feature, fase 2.8b) wordt in oude bestanden genegeerd; de
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
 * Fase B1 (§6) — `LibraryOrigin`-herkomststempel teruglezen uit het `OPS_Calendar`-pset (spiegel van
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
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const objectRefs = parseRefs(rel.args[4] || '');
    if (!objectRefs.includes(calStepId)) continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== PSET.Calendar) continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const prop of props) {
      if (stripQuotes(prop.args[0] || '') !== 'LibraryOrigin') continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value !== 'string' || !value) continue;
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed.companyId === 'string' && typeof parsed.libraryItemId === 'string'
            && typeof parsed.poolVersion === 'number') {
          // F2 (vloot-fixpakket, issue #19): zie de identieke toelichting bij het resourcepad
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
 * Bugfix B2 (gebruikstest 2026-08) — expliciete `HoursPerDay` teruglezen uit het `OPS_Calendar`-
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
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const objectRefs = parseRefs(rel.args[4] || '');
    if (!objectRefs.includes(calStepId)) continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== PSET.Calendar) continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const prop of props) {
      if (stripQuotes(prop.args[0] || '') !== 'HoursPerDay') continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    }
  }
  return undefined;
}

/**
 * T5-HERZIENING (2026-08-15, spec-reviewbevinding: zie het plandocument §T5) — het STEP-id-signaal
 * dat een `IFCWORKTIME` in `ExceptionTimes` een WERKENDE UITZONDERING is, i.p.v. een feestdag.
 * Spiegel van `writeCalendarGenerationMeta`'s `WorkingExceptionIds`-property in hetzelfde
 * `OPS_Calendar`-pset als generation/libraryOrigin/hoursPerDay. BEWUST geen discriminator op
 * `IfcWorkTime.RecurrencePattern` (args[3]): IFC 4.3 reserveert die ref niet voor werkende
 * uitzonderingen — een spec-conforme externe tool kan een RECURRENTE FEESTDAG ("elke 25 december")
 * met exact zo'n gevulde ref schrijven, en die zou dan zonder deze pset-check als werkdag
 * ingelezen worden (bewezen met een geconstrueerd fragment in de spec-review). Geen/corrupte
 * property ⇒ `undefined` — de aanroeper valt dan terug op "alles in ExceptionTimes is een
 * feestdag", het conservatieve pre-T5-gedrag voor bestanden zonder deze markering.
 */
function extractWorkingExceptionStepIds(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): Set<string> | undefined {
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const objectRefs = parseRefs(rel.args[4] || '');
    if (!objectRefs.includes(calStepId)) continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== PSET.Calendar) continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const prop of props) {
      if (stripQuotes(prop.args[0] || '') !== 'WorkingExceptionIds') continue;
      const value = parseTypedValue(prop.args[2] || '');
      if (typeof value !== 'string' || !value) continue;
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
          return new Set(parsed);
        }
      } catch { /* corrupte JSON: negeren — valt terug op "alles is feestdag" */ }
    }
  }
  return undefined;
}

/** Bouwt een `WorkCalendar` uit een `IFCWORKCALENDAR`-entiteit: naam/omschrijving/feestdagen
 *  (bestaand), plus (fase 2.8a, §8.1) werkdagen/uren teruggelezen uit de
 *  `WorkingTimes`-keten (args[5] → IFCWORKTIME → RecurrencePattern-ref → IFCRECURRENCEPATTERN
 *  DayComponent (args[2]) + TimePeriods (args[7]) → IFCTIMEPERIOD start/eind-uur) — de writer
 *  schreef dit al spec-conform (`ifcWriter.ts` `writeCalendar`), alleen de reader las het nog
 *  niet terug. Golden rule: ontbreekt de keten (bestand van een ander tool, of geen worktime),
 *  dan blijven de `createDefaultCalendar()`-defaults (ma-vr 07-16) staan. Tot slot (§8.2) de
 *  `OPS_Calendar`-pset → `generation` (legacy/onvolledig ⇒ `undefined`, nooit gegokt). */
function buildCalendarFromEntity(
  cal: StepEntity,
  entityMap: Map<string, StepEntity>,
  entities: StepEntity[],
): WorkCalendar {
  const calendar = createDefaultCalendar();
  calendar.name = stripQuotes(cal.args[2] || '') || calendar.name;
  // Fix B7: `ifcSlotText` i.p.v. kale `stripQuotes` — een lege omschrijving schrijft de writer als
  // STEP-null (`$`), en `stripQuotes('$')` geeft het letterlijke tweetekentje `'$'` terug (het start/
  // eindigt niet met een quote, dus de functie laat de string ongewijzigd) i.p.v. '' — dezelfde
  // `$`-conventie die elders al via `ifcSlotText` wordt toegepast (bv. project-omschrijving).
  calendar.description = ifcSlotText(cal.args[3]) || calendar.description;

  // Werkweek + uren (§8.1). WorkingTimes (args[5]) is een lijst met precies één ref (zo schrijft
  // de writer 'm) naar het "hoofd"-IFCWORKTIME; de holiday-IFCWORKTIME's zitten in ExceptionTimes
  // (args[6]) en hebben geen RecurrencePattern-ref (args[3] blijft `$` daar).
  const workTimeRefs = parseRefs(cal.args[5] || '');
  let periods: { start: number; end: number }[] = []; // ALLE banden (minuten), fase 2.8b §7.1
  let calWorkDays: number[] = [];
  for (const wtRef of workTimeRefs) {
    const wt = entityMap.get(wtRef);
    if (!wt || wt.type !== 'IFCWORKTIME') continue;
    const recurrenceRef = parseRef(wt.args[3] || '');
    if (!recurrenceRef) continue;
    const rec = entityMap.get(recurrenceRef);
    if (!rec || rec.type !== 'IFCRECURRENCEPATTERN') continue;

    const workDays = parseIntList(rec.args[2] || '');
    if (workDays.length > 0) { calendar.workDays = workDays; calWorkDays = workDays; }

    const timePeriodRefs = parseRefs(rec.args[7] || '');
    // ALLE TimePeriods lezen (fase 2.8b §7.1: `TimePeriods` is native een lijst — pauze/split-shift).
    for (const tpRef of timePeriodRefs) {
      const tp = entityMap.get(tpRef);
      if (!tp || tp.type !== 'IFCTIMEPERIOD') continue;
      const s = clockToMinutes(stripQuotes(tp.args[0] || ''));
      const e = clockToMinutes(stripQuotes(tp.args[1] || ''));
      if (s != null && e != null) periods.push({ start: s, end: e });
    }
    // Scalar uit de EERSTE periode — houdt de dag-kalender byte-identiek (de post-pass promoveert
    // pas naar uur-modus bij een echte afwijking, discriminator a/b/c).
    if (timePeriodRefs.length > 0) {
      const tp = entityMap.get(timePeriodRefs[0]);
      if (tp && tp.type === 'IFCTIMEPERIOD') {
        const startHour = parseInt(stripQuotes(tp.args[0] || '').split(':')[0], 10);
        const endHour = parseInt(stripQuotes(tp.args[1] || '').split(':')[0], 10);
        if (Number.isFinite(startHour)) calendar.workStartHour = startHour;
        if (Number.isFinite(endHour)) calendar.workEndHour = endHour;
        if (Number.isFinite(startHour) && Number.isFinite(endHour) && endHour > startHour) {
          calendar.hoursPerDay = endHour - startHour;
        }
      }
    }
    break; // writer schrijft precies één werktijdslot in WorkingTimes
  }

  // Rauwe banden registreren (dezelfde periodes op elke werkdag — IFC's enkele recurrence-conventie)
  // + afwijking (a/b) bepalen, voor de uur-modus-post-pass.
  const days = (calWorkDays.length > 0 ? calWorkDays : calendar.workDays).filter(d => d >= 1 && d <= 7);
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  for (const d of days) rawByWeekday[d as 1] = periods.map(p => ({ ...p }));
  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  registerCalendarBands(calendar, { canonical: bands, deviates });

  // Ploeg-classificatie uit `PredefinedType` (arg 7) → `shift` (§7.1). `.FIRSTSHIFT.`/afwezig ⇒
  // undefined (byte-identiek — de schrijver emitteert `.FIRSTSHIFT.` voor undefined).
  const predef = (cal.args[7] || '').toUpperCase();
  if (predef.includes('SECONDSHIFT')) calendar.shift = 'SECOND';
  else if (predef.includes('THIRDSHIFT')) calendar.shift = 'THIRD';
  else if (predef.includes('USERDEFINED')) calendar.shift = 'USERDEFINED';

  // ExceptionTimes (args[6]) draagt zowel feestdagen als werkende uitzonderingen (fase 3.8, T5,
  // HERZIEN 2026-08-15 na spec-reviewbevinding — zie het plandocument §T5). Het onderscheid is de
  // OPS-pset-markering (`extractWorkingExceptionStepIds`), NIET de aanwezigheid van een gevulde
  // RecurrencePattern-ref (args[3]): een spec-conforme externe tool kan een RECURRENTE FEESTDAG
  // ("elke 25 december") met precies zo'n gevulde ref schrijven, en die zou dan zonder deze
  // pset-check als WERKDAG worden ingelezen — een regressie t.o.v. het conservatieve pre-T5-gedrag.
  // Geen markering (eigen bestand van vóór deze herziening, of extern) ⇒ alles in ExceptionTimes
  // is een feestdag, óók met een gevulde recurrence-ref.
  const workingExceptionIds = extractWorkingExceptionStepIds(cal.id, entities, entityMap);
  const exceptionRefs = parseRefs(cal.args[6] || '');
  const holidays: Holiday[] = [];
  const workingExceptions: WorkingException[] = [];
  for (const ref of exceptionRefs) {
    const wt = entityMap.get(ref);
    if (!wt || wt.type !== 'IFCWORKTIME') continue;
    if (!workingExceptionIds?.has(ref)) {
      holidays.push({
        name: stripQuotes(wt.args[0] || '') || 'Feestdag',
        startDate: parseDateFromIFC(wt.args[4] || ''),
        endDate: parseDateFromIFC(wt.args[5] || ''),
      });
      continue;
    }
    // OPS-gemarkeerd als werkende uitzondering. De banden zitten — indien geschreven — nog steeds
    // in de RecurrencePattern-ref (args[3] → TimePeriods, args[7]); DayComponent is hier altijd
    // leeg. Canoniseren naar `end > start` (§3.2-conventie, `WorkingException.bands`): een
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
      name: stripQuotes(wt.args[0] || '') || 'Werkende uitzondering',
      startDate: parseDateFromIFC(wt.args[4] || ''),
      endDate: parseDateFromIFC(wt.args[5] || ''),
      ...(bands.length > 0 ? { bands } : {}),
    });
  }
  // Bugfix B2 (eindreview T16c, gemeten: 204/213 crawl + 3/3 bedrijfsbestanden geraakt, ook
  // auto-save): `calendar.holidays` is een VERPLICHT veld (`WorkCalendar.holidays: Holiday[]`,
  // geen `?`) — een lege lijst is een geldige, betekenisvolle waarde ("deze kalender heeft geen
  // feestdagen"), geen "veld ontbrak". Omdat deze functie uitsluitend wordt aangeroepen wanneer de
  // `IFCWORKCALENDAR`-ENTITEIT zelf bestaat (`extractCalendar`/`extractCalendarLibrary` vallen pas
  // op `createDefaultCalendar()` terug als de entiteit zelf ontbreekt), is de hierboven uit
  // `ExceptionTimes` gelezen `holidays`-lijst de volledige waarheid voor dít bestand — ook als hij
  // leeg is. De oude `if (holidays.length > 0)`-guard liet een lege lijst stil de
  // `createDefaultCalendar()`-bouwmodus-defaults (29 NL-feestdagen) laten staan: een `.mpp` met 0
  // feestdagen kreeg ze er bij de eerste IFC-save alsnog bij. `workingExceptions` blijft WEL
  // conditioneel: dat veld is optioneel (`?:`) en elke lezer in de codebase (`mspdiReader.ts`,
  // `mppCalendars.ts`, `extMappers.ts`) houdt "geen uitzonderingen" bewust op `undefined` i.p.v.
  // een expliciete lege array — beide zijn overal `?? []`-equivalent, dus geen gedragsverschil.
  calendar.holidays = holidays;
  if (workingExceptions.length > 0) calendar.workingExceptions = workingExceptions;

  // §4.3/§8.2 golden rule: createDefaultCalendar() zet altijd `generation` (nieuwe projecten zijn
  // per definitie gegenereerd) — een uit IFC gelezen kalender is dat NIET tenzij de OPS_Calendar-
  // pset het expliciet zegt. Eerst wissen, dan (evt.) invullen uit de pset.
  delete calendar.generation;
  calendar.generation = extractCalendarGeneration(cal.id, entities, entityMap);
  calendar.libraryOrigin = extractCalendarLibraryOrigin(cal.id, entities, entityMap);

  // Bugfix B2 (gebruikstest 2026-08): expliciete `HoursPerDay` uit het `OPS_Calendar`-pset heeft
  // voorrang boven de hierboven afgeleide `workEndHour − workStartHour` (die alleen een fallback
  // is voor bestanden zonder deze pset-waarde — legacy/andere tools). Golden rule: ontbreekt de
  // property, dan blijft de derivatie hierboven ongewijzigd staan. Voor uur-kalenders overschrijft
  // de latere `promoteHourCalendar`-post-pass dit sowieso met de band-afgeleide waarde
  // (`deriveHoursPerDay`), dus deze override raakt alleen dag-kalenders — precies de bedoeling.
  const hpdOverride = extractCalendarHoursPerDay(cal.id, entities, entityMap);
  if (hpdOverride != null) calendar.hoursPerDay = hpdOverride;

  return calendar;
}

/**
 * Fase 2.8a (§8.2) — kalender-bibliotheek teruglezen (generalisatie van de oude "resource-
 * kalenders"-route, fase 2.5 §7.5): alle `IFCWORKCALENDAR`-entiteiten behalve degene die
 * `extractCalendar` al als projectkalender heeft gepakt (de eerste in het bestand — zelfde,
 * bewust ongewijzigde regel als `extractCalendar` zelf hanteert, en de schrijf-conventie die
 * `writeIFC` aanhoudt: de projectkalender staat altijd als eerste in het bestand).
 *
 * Onderscheid taken-vs-resources via `IFCRELASSIGNSTOCONTROL.RelatedObjects`: de writer schrijft
 * per bibliotheek-kalender twee LOSSE rel-entiteiten (één met resource-refs, één met taak-refs),
 * dus elke rel resolvet hier via precies één van de twee maps. Eén kalender kan zo door zowel een
 * resource- als een taak-rel worden aangewezen — de STEP-id van het `IFCWORKCALENDAR` dedupt de
 * kalender zelf (`calByStepId`) zodat hij maar één keer in de bibliotheek terechtkomt.
 *
 * Z14b-fixronde (F1) — retourneert sinds deze fix ook `idByGuid` (`IFCWORKCALENDAR.GlobalId` →
 * onze verse `WorkCalendar.id`): de STABIELE, per-constructie-unieke sleutel die
 * `extractTimephasedDurationWalksMeta` nodig heeft om `resourceCalendarId` te vertalen. GEEN
 * naam-gebaseerde vertaling (zie de F1-toelichting bij `extractTimephasedDurationWalksMeta`): twee
 * kalenders met dezelfde naam zijn een geldige, niet-afgedwongen toestand (de app kent geen
 * naam-uniciteitseis) en zouden op naam stilzwijgend naar elkaars kalender resolven.
 */
function extractCalendarLibrary(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): { calendars: WorkCalendar[]; idByGuid: Map<string, string> } {
  const projectCalendarEntity = entities.find(e => e.type === 'IFCWORKCALENDAR');
  const resourceById = new Map(resources.map(r => [r.id, r]));
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const calendars: WorkCalendar[] = [];
  const calByStepId = new Map<string, WorkCalendar>(); // IFCWORKCALENDAR STEP-id -> onze kalender
  const idByGuid = new Map<string, string>(); // Z14b (F1) — IFCWORKCALENDAR.GlobalId -> onze kalender-id

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
      cal.id = generateId('rescal');
      calByStepId.set(controlRef, cal);
      calendars.push(cal);
      idByGuid.set(stripQuotes(controlEntity.args[0] || ''), cal.id); // Z14b (F1)
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

  // A2-fix: bibliotheekkalenders ZONDER gebruiker. De lus hierboven vindt kalenders uitsluitend via
  // IFCRELASSIGNSTOCONTROL (wie 'm gebruikt). Een gepromote/toegevoegde kalender die nog geen
  // resource-/taak-toewijzing heeft — het normale "voeg toe vóór toewijzing"-patroon — werd wel door
  // writeIFC geschreven maar hier nooit teruggevonden: stil verlies incl. libraryOrigin-stempel. Vang
  // daarom álle overige IFCWORKCALENDAR-entiteiten (behalve de projectkalender) op, gededupliceerd
  // tegen wat de rel-route al vond (calByStepId), met behoud van bestandsvolgorde (rel-gevonden eerst,
  // ongebruikte daarna) zodat bestaande round-trip-gedragingen onveranderd blijven.
  for (const ce of entities) {
    if (ce.type !== 'IFCWORKCALENDAR') continue;
    if (projectCalendarEntity && ce.id === projectCalendarEntity.id) continue;
    if (calByStepId.has(ce.id)) continue;
    const cal = buildCalendarFromEntity(ce, entityMap, entities);
    cal.id = generateId('rescal');
    calByStepId.set(ce.id, cal);
    calendars.push(cal);
    idByGuid.set(stripQuotes(ce.args[0] || ''), cal.id); // Z14b (F1)
  }

  return { calendars, idByGuid };
}

interface AssignmentMeta {
  unitsPerDay: number;
  curve?: ResourceCurve;
}

/** Z14 — één gelezen timephased-venster (`OPS_Timephased`, spiegel van `writeTimephasedMeta`). */
interface WindowMeta {
  workWindowStart?: string;
  workWindowFinish?: string;
}

/** Per-taak verzamelde OPS_Assignments-meta: nieuw formaat (`GUID#N`-propnamen) als
 *  geordende wachtrij per resource-GUID, oud formaat (kale GUID) als één meta per GUID. */
interface TaskAssignmentMeta {
  /** Nieuw formaat (M3): resource-GUID -> metas gesorteerd op `#N`-volgnummer. Meerdere
   *  assignments van dezelfde resource op één taak consumeren de wachtrij in volgorde —
   *  de `IFCRELASSIGNSTOPROCESS.RelatedObjects`-volgorde en de `#N`-volgorde komen uit
   *  dezelfde bron (de assignments-array, zie writeAssignments/writeAssignmentMeta), dus
   *  ze lopen per resource synchroon. */
  queues: Map<string, AssignmentMeta[]>;
  /** Legacy formaat (pre-M3-bestanden): kale resource-GUID als propnaam, max één meta
   *  per GUID (het oude last-wins-gedrag — meer valt uit zo'n bestand niet te herstellen). */
  legacy: Map<string, AssignmentMeta>;
}

/**
 * Fase 2.5 — `OPS_Assignments`-pset teruglezen (§7.4, spiegel van `writeAssignmentMeta`):
 * property-naam = `"<resource-GUID>#<volgnummer>"` (nieuw formaat, M3-fix: uniek per
 * assignment, zodat dubbele assignments van dezelfde resource op één taak niet meer
 * last-wins-dedupen) óf de kale resource-GUID (legacy, pre-M3-bestanden); waarde =
 * `"unitsPerDay|curve"`. Ontbreekt de pset-entry (legacy bestand) dan geldt de bestaande
 * fallback `unitsPerDay: 1, curve: undefined`.
 *
 * Z14 (etappe "nul afwijkingen"): leest in dezelfde sweep ook `OPS_Timephased` — het
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
  // Z14 — OPS_Timephased-psets per taak verzamelen: taskStepRef -> resource-GUID -> wachtrij
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
        const meta: WindowMeta = {
          ...(typeof vv.workWindowStart === 'string' ? { workWindowStart: vv.workWindowStart } : {}),
          ...(typeof vv.workWindowFinish === 'string' ? { workWindowFinish: vv.workWindowFinish } : {}),
        };
        if (meta.workWindowStart === undefined && meta.workWindowFinish === undefined) continue;
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
        const curve = VALID_CURVES.includes(curveRaw as ResourceCurve) ? (curveRaw as ResourceCurve) : undefined;
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
      // val terug op de legacy kale-GUID-meta voor pre-M3-bestanden.
      const meta = taskMeta?.queues.get(resGuid)?.shift() ?? taskMeta?.legacy.get(resGuid);
      // Z14 — timephased-venster, zelfde wachtrij-consumptie als `meta` hierboven (geen legacy-tak:
      // OPS_Timephased is nieuw, er bestaan geen pre-Z14-bestanden die het al schreven).
      const window = windowsByTask.get(taskRef)?.get(resGuid)?.shift();

      // 'UNIFORM' is de writer-default (a.curve ?? 'UNIFORM') — canonicaliseer terug naar
      // undefined zodat undefined en 'UNIFORM' round-trippen naar dezelfde waarde
      // (Resource-Assignment.curve: "undefined = UNIFORM", zie src/types/resource.ts).
      assignments.push({
        id: generateId('asgn'),
        taskId,
        resourceId: resId,
        unitsPerDay: meta?.unitsPerDay ?? 1,
        ...(meta?.curve && meta.curve !== 'UNIFORM' ? { curve: meta.curve } : {}),
        ...(window?.workWindowStart !== undefined ? { workWindowStart: window.workWindowStart } : {}),
        ...(window?.workWindowFinish !== undefined ? { workWindowFinish: window.workWindowFinish } : {}),
      });
    }
  }

  return assignments;
}

/**
 * Fase 3 (H2) — `task.resourceIds` reconstrueren uit de assignments. Het IFC-bestand slaat de
 * taak↔resource-koppeling uitsluitend op via de `ResourceAssignment`s (IFCRELASSIGNSTOPROCESS +
 * OPS_Assignments); `resourceIds` is een afgeleide projectie daarvan en wordt NIET los in het
 * bestand bewaard (geen dubbele opslag/waarheid). Volgorde is deterministisch: eerste-zien in de
 * assignments-volgorde, met deduplicatie (één resource kan meerdere assignments op één taak hebben).
 */
function reconstructResourceIds(tasks: Task[], assignments: ResourceAssignment[]): void {
  const byTask = new Map<string, string[]>();
  for (const a of assignments) {
    let list = byTask.get(a.taskId);
    if (!list) { list = []; byTask.set(a.taskId, list); }
    if (!list.includes(a.resourceId)) list.push(a.resourceId);
  }
  for (const t of tasks) {
    const ids = byTask.get(t.id);
    if (ids) t.resourceIds = ids;
  }
}

// Fase 3 (P11) — `OPS_Leveling` (§7.6) wordt nu, net als de andere zeven per-taak-psets, teruggelezen
// via de gedeelde registry-dispatch in `extractStructure` (ifcPsets.PER_TASK_PSETS). De losse
// extractLevelingMeta is daardoor vervallen.

/**
 * Fase 2.6 — verzamel de STEP-#id's van taken die onder een `.BASELINE.`-IfcWorkSchedule hangen
 * (§8.3). OPS zelf hangt géén taken onder baseline-schema's (de datums leven in de OPS_Baselines-
 * JSON), maar externe tools kunnen dat wél doen; die taken zijn baseline-snapshots, geen live
 * taken, en mogen niet als echte taak worden ingeladen. Koppeling via IFCRELNESTS (RelatingObject
 * = het schema) of IFCRELASSIGNSTOCONTROL (control = het schema). PredefinedType `.BASELINE.` staat
 * op arg-index 14 van IFCWORKSCHEDULE.
 */
function collectBaselineTaskStepIds(entities: StepEntity[]): Set<string> {
  const baselineSchedIds = new Set(
    entities
      .filter(e => e.type === 'IFCWORKSCHEDULE' && (e.args[14] || '').includes('BASELINE'))
      .map(e => e.id),
  );
  const taskStepIds = new Set<string>();
  if (baselineSchedIds.size === 0) return taskStepIds;
  for (const e of entities) {
    if (e.type === 'IFCRELNESTS') {
      const relating = parseRef(e.args[4] || '');
      if (relating && baselineSchedIds.has(relating)) {
        for (const r of parseRefs(e.args[5] || '')) taskStepIds.add(r);
      }
    } else if (e.type === 'IFCRELASSIGNSTOCONTROL') {
      const control = parseRef(e.args[6] || '');
      if (control && baselineSchedIds.has(control)) {
        for (const r of parseRefs(e.args[4] || '')) taskStepIds.add(r);
      }
    }
  }
  return taskStepIds;
}

/**
 * Fase 2.6 — baselines teruglezen uit het autoritatieve `OPS_Baselines`-JSON (§8.3, spiegel van
 * `writeBaselineMeta`). De JSON bewaart per baseline-taak de INTERNE `taskId` van t.t.v. opslaan;
 * bij het inlezen zijn de taak-id's her-gegenereerd, dus we mappen elke `taskId` deterministisch
 * terug via `ifcGuid(taskId)` → de IFCTASK-GlobalId → de nieuwe id. Baseline-taken zonder match
 * (taak sindsdien verwijderd) behouden hun oude id en tonen later als "vervallen" in de variance.
 */
function extractBaselines(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
): { baselines: Baseline[]; activeBaselineId: string | null } {
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
  /** Expliciete interne-taakId → GlobalId-map uit het bestand (B8); leeg bij oudere bestanden. */
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
      } else if (name === 'TaskGuids') {
        // Bevinding B8: de writer schrijft sinds deze versie expliciet weg wélk GlobalId hij per
        // baseline-taak gebruikte, zodat wij de hash niet meer hoeven na te rekenen. Ontbreekt de
        // map (bestanden van vóór die wijziging), dan valt de remap hieronder terug op de oude weg.
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
      // B8: gebruik het GlobalId dat de writer daadwerkelijk uitgaf. Alleen bij bestanden van
      // vóór de `TaskGuids`-map vallen we terug op het herberekenen van de hash.
      const guid = taskGuids?.[bt.taskId] ?? ifcGuid(bt.taskId);
      const remapped = guidToTaskId.get(guid);
      if (remapped) bt.taskId = remapped;
    }
  }

  // Actieve id valideren tegen de geladen set; anders op de nieuwste (of null) terugvallen.
  if (activeBaselineId && !baselines.some(b => b.id === activeBaselineId)) {
    activeBaselineId = baselines.length ? baselines[baselines.length - 1].id : null;
  }

  return { baselines, activeBaselineId };
}

/**
 * Z14b (Z8-nataak, eigenaarsbesluit 2026-08-18) — `OPS_TimephasedDurationWalks` teruglezen (spiegel
 * van `ifcWriter.writeTimephasedDurationWalksMeta`): PER TAAK via `IFCRELDEFINESBYPROPERTIES` (niet
 * globaal zoals `extractBaselines` — dit is taak-eigen data, geen projectbrede lijst).
 *
 * F1-FIXRONDE (spec-review op 526af9f9): de EERSTE versie vertaalde `resourceCalendarId` via de
 * kalenderNAAM. De reviewer bewees empirisch dat dat stille datacorruptie geeft — de app dwingt
 * kalendernaam-uniciteit NERGENS af, dus twee kalenders met dezelfde naam dedupliceerden op de
 * naam→id-Map en beide taken resolven na round-trip naar dezelfde, voor minstens één van de twee
 * VERKEERDE kalender, zonder waarschuwing. Fix: `resourceCalendarGuid` (de `IFCWORKCALENDAR.
 * GlobalId`, per-constructie uniek — `guidOf`'s eigen botsingsdetectie garandeert dat, zie
 * ifcWriter.ts) i.p.v. de naam, vertaald via `calendarIdByGuid` (`extractCalendarLibrary`'s nieuwe
 * `idByGuid`-uitvoer + de projectkalender-toevoeging in `readIFC` — vandaar dat deze functie NA
 * `extractCalendarLibrary` draait). Spiegelt zo `OPS_Baselines`' taskId-GUID-remap-precedent
 * exact, alleen voor kalenders i.p.v. taken.
 *
 * Een GUID die niet in `calendarIdByGuid` voorkomt (dangling: de kalender bestaat niet meer, of een
 * extern-geschreven bestand droeg een andere GUID-vorm) laat die ENE walk-entry VALLEN — spiegelt
 * het eigenaarsprincipe (liever geen afgeleide sturing dan een onbetrouwbare) i.p.v. een rauwe GUID
 * als kalender-id te laten doorsijpelen naar `resolveCalendar`.
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
    // Z19 — `workMinutes` (apportionering bij >1 toewijzing) is OPTIONEEL: een oudere IFC (vóór
    // Z19) of een PRECIES-1-toewijzing-walk draagt 'm niet, spiegelt `ifcWriter.ts`'s conditionele
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
 * Fase 2.9 (§3.4/§6) — scheduling-options teruglezen uit het autoritatieve `OPS_SchedulingOptions`-
 * JSON op de `IfcWorkSchedule` (spiegel van `writeSchedulingOptionsMeta`, exact het extractBaselines-
 * patroon). Afwezig/corrupt ⇒ `undefined` (default-inert; alle solver-defaults blijven staan).
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
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as SchedulingOptions;
        }
      } catch { /* corrupte JSON — negeer, opties blijven op default */ }
    }
  }
  return undefined;
}
