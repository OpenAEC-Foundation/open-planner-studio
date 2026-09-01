import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';
import type { CompanyPool } from '@/types/library';
import type { RecordedFieldKey } from '@/services/ifc/ifcTaskSlots';
import type { XerResourceCatalog } from './xer/xerResources';
import type { XerResourceIssue, XerTaskResourceSource } from './xer/xerResourceTypes';
import type { XerMetadataCatalog } from './xer/xerMetadataTypes';
import type { XerSourceArchive } from './xerSourceArchive';

export type XerSourceEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';

export interface XerTableReportMetadata {
  encoding: XerSourceEncoding;
  endMarkerSeen: boolean;
  issues: Array<{
    code: string;
    line: number;
    table?: string;
    expected?: number;
    actual?: number;
    field?: string;
    currencyCode?: string;
    ignoredRecords?: number;
    ignoredLines?: number;
  }>;
  unknownTables: Array<{ name: string; rows: number }>;
  /** Additief sinds XER-exportverlies fixronde 2; afwezig in oudere ingebedde bronarchieven. */
  unknownFields?: Array<{ table: string; name: string; rows: number }>;
}

export interface XerCalendarIssueMetadata {
  code: string;
  calendarId: string;
  line: number;
  reason: string;
  resolution: 'RECOVERED' | 'REJECTED' | 'UNLINKED';
}

export interface XerEnumFallback {
  family: 'activityType' | 'durationType' | 'completePctType' | 'status' | 'priority' | 'constraint' | 'relation';
  token: string;
  fallback: string;
  table: 'PROJECT' | 'TASK' | 'TASKPRED';
  field: string;
  line: number;
}

export interface XerScheduleOptionFallback {
  field: string;
  token: string;
  fallback: string;
  line: number;
}

export interface XerScheduleOptionsSourceRow {
  table: 'PROJECT' | 'SCHEDOPTIONS';
  line: number;
  cells: Record<string, string>;
}

export interface XerScheduleOptionsDiagnostic {
  code: 'XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID';
  projectId: string;
  /** Indexen in `XerScheduleOptionsSourceArchive.rows`; zo blijven de raw rijen één bronkopie. */
  rowIndexes: number[];
  lines: number[];
}

/**
 * Bestandsbreed XER-bronarchief voor X5 en de geplande X9-native opslag. PROJECT- en
 * SCHEDOPTIONS-rijen worden precies eenmaal gekopieerd. Projectmetadata verwijst met indexen naar
 * deze ene bron; verweesde SCHEDOPTIONS-rijen blijven daardoor zichtbaar zonder aan een verkeerd
 * project te worden toegeschreven.
 */
export interface XerScheduleOptionsSourceArchive {
  rows: XerScheduleOptionsSourceRow[];
  unmatchedScheduleOptionsRowIndexes: number[];
  diagnostics: XerScheduleOptionsDiagnostic[];
}

/** Neutraal documentcontract voor X5-bronbewijs. Dit staat bewust buiten de lazy XER-chunk:
 * algemene document-/recoverycode mag het type kennen zonder de reader statisch te laden. */
export interface XerScheduleOptionsMetadata {
  source: 'schedoptions' | 'xer-defaults';
  retainedSource: {
    sched_use_project_end_date_for_float?: boolean;
  };
  fallbacks: XerScheduleOptionFallback[];
  diagnostics: XerScheduleOptionsDiagnostic[];
  sourceArchive: XerScheduleOptionsSourceArchive;
  /** Projectgebonden view-indexen in het bestandsbrede archief; bevat bij duplicaten alle rijen. */
  sourceRowIndexes: number[];
  /** Compatibele projectview; de rijobjecten zijn referenties naar `sourceArchive.rows`. */
  sourceRows: XerScheduleOptionsSourceRow[];
}

export interface XerExternalRelation {
  id: string;
  localProjectId: string;
  localTaskId: string;
  externalProjectId: string;
  externalTaskId: string;
  direction: 'predecessor' | 'successor';
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lagMinutes: number;
}

export type XerBaselineFallbackReason =
  | 'self-reference'
  | 'cycle'
  | 'all-projects-baselines';

/** Eén gededupliceerde relatie tussen twee werkelijk geopende XER-projectdocumenten. */
export interface XerDocumentExternalLink {
  id: string;
  predecessor: { projectId: string; taskId: string };
  successor: { projectId: string; taskId: string };
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lagMinutes: number;
}

/** Uniform XER-openingsverslag; aanwezig bij zowel één als meerdere PROJECT-rijen. */
export interface XerImportReport {
  projectsSeen: number;
  documentsOpened: number;
  emptyProjectsSkipped: number;
  baselineProjectsExcluded: number;
  baselinesMaterialized: number;
  danglingBaselineReferences: number;
  externalLinksPreserved: number;
  baselineExclusionReverted: boolean;
  baselineFallbackReasons: XerBaselineFallbackReason[];
}

/** X6-bronbewijs. De catalogus is één bestandsbreed, immutable object; per document blijft alleen
 * de gefilterde TASKRSRC-view over. X9 bepaalt later de exacte serialisatie naar IFC/recovery. */
export interface XerResourceMetadata {
  catalog: XerResourceCatalog;
  assignments: XerTaskResourceSource[];
  issues: XerResourceIssue[];
}

/** X8-bronbewijs: één readonly catalogus per geopend XER-bestand; projectvelden zijn losse views. */
export interface XerMetadataMetadata {
  catalog: XerMetadataCatalog;
}

/** Documentgebonden XER-brondata. Externe relaties zijn nadrukkelijk geen solverrelaties. */
export interface XerImportMetadata {
  /** PROJECT.proj_id dat dit document binnen het gedeelde XER-bronarchief vertegenwoordigt. */
  sourceProjectId?: string;
  defaultCurrencyCode: string;
  tableReport: XerTableReportMetadata;
  calendarIssues: XerCalendarIssueMetadata[];
  enumFallbacks: XerEnumFallback[];
  /** X5: afleidingsbron, terugvallen en retained/TODO-waarden van precies dit project. */
  scheduleOptions: XerScheduleOptionsMetadata;
  externalRelations: XerExternalRelation[];
  /** Canonieke cross-documentlinks waarbij dit document een eindpunt is; nooit solverinvoer. */
  externalLinks: XerDocumentExternalLink[];
  /** Bestandsbreed verslag, bewust ook documentgebonden zodat X10 het na openen kan consumeren. */
  report: XerImportReport;
  /** X6 retained-data; baseline- en unscoped TASKRSRC-rijen blijven uitsluitend catalogusdata voor X9. */
  resources?: XerResourceMetadata;
  /** X8 retained-data; X9 bepaalt de definitieve documentcontract-/IFC-serialisatie. */
  metadata?: XerMetadataMetadata;
}

/**
 * Eén gedeelde payload-vorm voor een ingelezen project (audit P1). De vier readers (`readIFC`,
 * `readMSPDI`, `readP6XML`, `readCSV`) gaven elk een eigen ad-hoc objectvorm terug (11/9/7/6
 * velden), die de store met `as`-casts moest verzoenen. Nu retourneren ze allemaal dit type:
 *
 *  - De **kernvelden** levert elk formaat altijd.
 *  - De **optionele velden** levert niet elk formaat: CSV/P6 kennen bv. geen baselines, alleen
 *    IFC kent activity-codes/custom-fields. Ontbrekend ⇒ afwezig (`undefined`), de aanroeper
 *    valt terug op `?? []` / `?? null`.
 *
 * `writeIFC` hergebruikt dit type (zie `WriteIFCInput` in `ifcWriter.ts`) omdat de writer exact
 * dezelfde payload nodig heeft — zo blijft de IFC-round-trip symmetrisch getypeerd.
 */
/**
 * Vertaalde teksten die een aanroeper aan een reader meegeeft. De readers zijn dienstlaag: ze
 * hebben geen `t(...)`, en `@/i18n/config` importeren is daar geen optie — die module raakt bij
 * module-init `document.documentElement`, wat de headless test-/scriptbundels (`tests/planning`,
 * `tests/mcp`, `scripts/verify-examples`) meteen sloopt met `document is not defined`.
 *
 * Zelfde patroon als `PrintOptions.labels` in `services/print/printPreview.ts`: de UI-laag lost de
 * tekst op en geeft 'm door. Elk veld is optioneel; ontbreekt het, dan valt de reader terug op een
 * Engelse default (net als `'Imported Calendar'` in de MSPDI-reader).
 */
export interface ImportLabels {
  /**
   * Projectnaam voor een bestand dat GEEN `IFCPROJECT` bevat — het noodgeval-pad voor een kapot of
   * vreemd bestand. Deze naam wordt bewust in de DATA gestempeld (anders zou de weergave terugvallen
   * op "naamloos", wat misleidend is zodra er wél taken uit het bestand komen); de taal van het
   * moment bakt daarmee in de naam, en de gebruiker hernoemt.
   */
  importedProject?: string;
  /**
   * Naam voor de ingebouwde "niet-toegewezen"-resource (MPP-uniqueID 0 — MS Project schrijft die
   * altijd mee, ook in zijn eigen MSPDI-export als "Niet toegekend"; T7-spec-review, B3). Zelfde
   * DATA-stempel-redenering als `importedProject`. Engelse default `'Unassigned'` — de vertaalde
   * doorgifte volgt via T8, net als de andere `ImportLabels`-velden.
   */
  unassignedResource?: string;
}

export interface ImportResult {
  // Kernvelden — door elk formaat geleverd.
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  // Optionele velden — niet elk formaat levert deze.
  resourceCalendars?: WorkCalendar[];
  activityCodeTypes?: ActivityCodeType[];
  customFieldDefs?: CustomFieldDef[];
  baselines?: Baseline[];
  activeBaselineId?: string | null;
  /** OPTIONEEL — een pool-bestand (spec B1, §4) draagt zijn autoritatieve pool-JSON in het
   *  OPS_Library-pset; een gewoon projectbestand niet. Afwezig ⇒ geen pool-bestand. */
  libraryPool?: CompanyPool;
  /**
   * OPTIONEEL — T12 (datumgetrouwheid-etappe, §9/O1), HERZIEN door Z16 (etappe "nul afwijkingen").
   * Telling van taken met een aantoonbaar onderbroken, genivelleerde of resource-gedreven
   * (timephased/contouring) planning in het bronbestand. Alleen `readMPP`
   * (`services/mpp/mppReader.ts`) vult dit vooralsnog — de andere lezers laten het weg.
   * Uitsluitend een IMPORT-TIJD-telling voor de eenmalige meldingen bij openen (`fileSlice.ts`,
   * patroon `summaryRelationsDropped`); GEEN persistent taakveld en dus geen documentcontract-
   * impact (§9/O3) — een taak die zo gemarkeerd was, verliest die markering bij de eerstvolgende
   * opslaan/heropenen-cyclus, en dat is bewust zo.
   *
   * Z16: vóór deze etappe was dit `{ leveled, spanGt }` — `spanGt` was een AFGELEIDE PROXY (het
   * MSP-eigen venster tussen start en finish, geteld in werkminuten, groter dan de MSP-eigen
   * opgeslagen duur), nodig omdat splits en timephased-vensters toen nog niet zelf leesbaar waren.
   * Sinds Z4 (`Task.splitGaps`) en Z8 (`Task.timephasedFinishFloor`/`timephasedDurationWalks`) zijn
   * beide ECHT leesbaar — de proxy is vervangen door drie ECHTE tellingen, één per categorie uit de
   * meldingstekst: `leveled` (`Task.levelingDelayMinutes` gezet), `split` (`Task.splitGaps` niet-
   * leeg), `timephased` (`Task.timephasedFinishFloor` of `Task.timephasedDurationWalks` gezet).
   * `total` blijft de VERENIGING van alle drie (een taak die meerdere signalen draagt telt in
   * `total` maar één keer) — dat is het getal dat de melding toont. Zie `countScheduleNotes` in
   * `mppReader.ts` voor de implementatie en `mpp14resource.mpp`'s "Contoured Task" (nu WEL geteld,
   * via `timephased`) voor het gevolg: de vroegere "resource-contouring niet betrouwbaar
   * detecteerbaar"-beperking is met de echte telling opgelost voor elke taak die een échte,
   * gedecodeerde timephased-periode draagt.
   */
  sourceScheduleNotes?: { total: number; leveled: number; split: number; timephased: number };

  /** OPTIONEEL — per taak-id welke IfcTaskTime-slots het bestand daadwerkelijk vulde: de zeven
   *  REKENSLOTS (`RECORDED_SLOT_KEYS`) én de twee INVOERSLOTS ScheduleStart/ScheduleFinish
   *  (`RECORDED_INPUT_SLOT_KEYS`) — de laatste twee zijn nodig als terugval-anker wanneer de
   *  rekenslots leeg zijn (issue #63). Alleen `readIFC` levert dit; CSV/MSPDI/P6/extensie-import
   *  kennen geen IfcTaskTime-slots en laten het weg. Nodig omdat `parseDateFromIFC` een `$`-slot als
   *  "vandaag" inleest — na het parsen is een leeg slot niet meer van een echte datum te
   *  onderscheiden. Een taak-id ZONDER IfcTaskTime krijgt een lege array (niet: ontbrekende sleutel)
   *  — "geen enkel slot gevuld" is een uitspraak, "onbekend" niet. */
  recordedFields?: Record<string, RecordedFieldKey[]>;
  /** Alleen XER: bronmetadata en solverloze cross-projectrelaties voor het geladen document. */
  xer?: XerImportMetadata;
  /** Alleen XER: exact, gedeeld en immutable bronarchief; nooit solverinvoer. */
  xerSourceArchive?: XerSourceArchive;
  /** Selector uit OPS_XerDocument; bronproject binnen een self-contained IFC. */
  xerSourceProjectId?: string;
}

/**
 * Eén bronbestand kan uitzonderlijk meerdere zelfstandige projectdocumenten opleveren. De
 * individuele payloads blijven het bestaande `ImportResult`-contract volgen; alleen de openroute
 * krijgt hier de extra informatie welke tab na het openen actief hoort te zijn. Zo blijven alle
 * enkelvoudige readers en hun bestaande laadpaden structureel ongewijzigd.
 */
export interface MultiDocumentImport {
  kind: 'multi-document';
  results: ImportResult[];
  activeDocumentIndex: number;
}

/** Het resultaat van een reader op de centrale open-pijplijn. */
export type OpenedImport = ImportResult | MultiDocumentImport;

export function isMultiDocumentImport(value: OpenedImport): value is MultiDocumentImport {
  return 'kind' in value && value.kind === 'multi-document';
}

/** De primaire payload voor read-only consumenten die per ontwerp slechts één project kennen. */
export function activeImportResult(value: OpenedImport): ImportResult {
  if (!isMultiDocumentImport(value)) return value;
  const active = value.results[value.activeDocumentIndex];
  if (!active) throw new Error('Meervoudige import bevat geen actief document');
  return active;
}
