import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { RecordedDatesState } from '@/engine/scheduler/recordedDates';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { Baseline } from '@/types/baseline';
import type { ImportResult } from '@/services/importTypes';
import type { ColumnConfig, ViewState } from './slices/types';
import type { Snapshot } from './snapshot';
import type { AppState } from './appStore';
import { createDefaultProject } from './defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultView } from './defaults';
import { syncProjectCalendar, promoteProjectCalendarToLibrary } from './syncProjectCalendar';

/**
 * HET DOCUMENTCONTRACT — één canonieke bron voor de per-document-state (audit P10, F1/F3).
 *
 * De ~20 per-document-velden werden voorheen ONAFHANKELIJK opgesomd op ~13 plekken
 * (`DocumentPayload`, `capturePayload`, `hydratePayload`, `freshPayload`, `payloadFromInput`,
 * `Snapshot`+`createSnapshot`, undo/redo-restore, de reset-blokken in projectSlice/fileSlice, de
 * recovery-mapping). De imperatieve varianten (hydrate, undo/redo, reset) checkten volledigheid
 * NIET — een vergeten veld lekte stil van het vorige document/project.
 *
 * Nu is er één `DOCUMENT_FIELDS`-descriptorlijst. Elk veld beschrijft:
 *  - `get`/`set`: waar het in de live (top-level) state woont — default `s[key]`, met één
 *    expliciete uitzondering: `collapsedTaskIds` woont in `s.ui` (per-document geswapt, maar de
 *    rest van `ui` blijft app-globaal).
 *  - `fresh`: de verse default voor een nieuw, leeg document.
 *  - `snapshot`: de rol in de undo/redo-snapshot ('data' = muteerbare projectdata, 'derived' =
 *    afgeleid resultaat/scalar, 'none' = niet in de snapshot). Zie `snapshot.ts` voor de
 *    per-veld-keuzes én voor waarom 'data' en 'derived' allebei per referentie worden bewaard.
 *  - `fromPayload` (optioneel): lees-migratie bij hydrate (defaults / legacy-alias / normalisatie).
 *
 * `capturePayload`/`hydratePayload`/`freshPayload` lopen key-gedreven over deze ENE lijst, zodat
 * capture en hydrate niet meer kunnen divergeren. Een nieuw veld in `DocumentPayload` dat de lijst
 * mist geeft een COMPILE-fout (`_assertAllFieldsCovered` onderaan).
 */
export interface DocumentPayload {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  /** Gedeelde kalender-bibliotheek (fase 2.8a; hernoemd uit `resourceCalendars`). */
  calendars: WorkCalendar[];
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  selectedTaskIds: string[];
  cpmResult: CPMResult | null;
  /** Afgeleide belasting per document (A5): anders toont het histogram na een tabwissel dat van het
   *  vórige document. */
  resourceLoadResult: ResourceLoadResult | null;
  /** "Verouderd"-vlag per document (A6) — leekt anders tussen documenten. */
  scheduleStale: boolean;
  /** "Datums zoals opgeslagen" (issue #63) — zie `ScheduleSlice.recordedDates`. */
  recordedDates: RecordedDatesState | null;
  /** "Datums zoals opgeslagen" (issue #63) — zie `ScheduleSlice.datesAsRecorded`. */
  datesAsRecorded: boolean;
  /** Baselines per document (fase 2.6). `statusDate`/`progressMode` rijden mee in `project`. */
  baselines: Baseline[];
  activeBaselineId: string | null;
  view: ViewState;
  /** Woont in `s.ui` maar wordt per-document geswapt (zie descriptor-uitzondering). */
  collapsedTaskIds: string[];
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  filePath: string | null;
  /** Web-opslaan-doel (browser-bestandstoegang). ALLEEN het FSA-opslaan-doel — nooit identiteit/titel (die blijft filePath: echt pad in Tauri, bestandsnaam in web). null in Tauri/fallback-web. */
  fileHandle: FileSystemFileHandle | null;
  isDirty: boolean;
}

/** Per-document projectdata + metadata om bij crash-recovery te herstellen.
 *  Alleen de IFC-round-trip-velden + identiteit; view/undo/cpm worden vers
 *  opgebouwd (zijn niet kritiek na een crash).
 *
 *  AFGELEID van `ImportResult` (bevinding K3), niet meer met de hand opgesomd. De twee lijsten
 *  waren uit elkaar gelopen: `baselines`/`activeBaselineId` stonden hier wél, maar de recovery-
 *  leeskant vulde ze niet — en omdat ze optioneel zijn zweeg `tsc`, dus baselines verdwenen STIL
 *  bij crashherstel terwijl de writer ze gewoon had weggeschreven. Door af te leiden GROEIT dit
 *  type automatisch MEE met `ImportResult`: een nieuw round-trip-veld kan niet opnieuw stil
 *  wegvallen. Het verschil met `ImportResult` is uitsluitend de document-identiteit
 *  (`id`/`filePath`/`isDirty`) — dezelfde les als `buildWriteIFCInput` op de schrijfkant. */
export type RecoveryDocInput = ImportResult & {
  id: string;
  filePath: string | null;
  isDirty: boolean;
};

/** Document-identiteit rond een herstelde snapshot: alles wat NIET uit de IFC komt maar uit de
 *  recovery-metadata (welk tabblad, welk bestand, was het ongewijzigd opgeslagen). */
export interface RecoveryDocMeta {
  id: string;
  filePath: string | null;
  isDirty: boolean;
}

/**
 * Bouw de VOLLEDIGE recovery-invoer uit een geparste snapshot — de leeskant-spiegel van
 * `buildWriteIFCInput` (`./ifcSaveInput.ts`). Eén plek bepaalt welke velden bij crashherstel
 * meegaan, zodat de aanroeper (de recovery-hook) geen veldkennis meer heeft en niet opnieuw stil
 * velden kan laten vallen (bug-klasse K3: de hook somde de velden met de hand op en sloeg
 * `baselines`/`activeBaselineId` over — beide optioneel, dus `tsc` zweeg en de baselines
 * verdwenen geruisloos bij crashherstel).
 *
 * De spread is hier de hele implementatie: `RecoveryDocInput` ÍS `ImportResult` + identiteit, dus
 * élk round-trip-veld rijdt automatisch mee, ook velden die er later bij komen. `meta` staat NA
 * de spread zodat de identiteitsvelden altijd winnen van een gelijknamig veld uit de parser.
 */
export function recoveryInputFromParsed(parsed: ImportResult, meta: RecoveryDocMeta): RecoveryDocInput {
  return { ...parsed, ...meta };
}

/**
 * Rol van een documentveld in de undo/redo-snapshot.
 *
 * De rollen 'data' en 'derived' zeggen allebei "dit veld zit IN de snapshot" en verschillen alleen
 * in wát voor waarde het is; ze worden allebei per REFERENTIE opgeslagen. Dat mag omdat Immer de
 * hele state na elke producer diep bevriest — zie de kop van `snapshot.ts` voor de invariant en
 * waarom hier vroeger een diepe JSON-kloon stond.
 */
export type SnapshotRole =
  | 'data' // muteerbare projectdata (heette 'clone' toen de snapshot nog diep kloonde).
  | 'derived' // afgeleid resultaat of scalar (heette 'ref').
  | 'none'; // niet in de snapshot (selectie/view/pad/undo-stacks e.d.).

interface FieldDesc<K extends keyof DocumentPayload, R extends SnapshotRole = SnapshotRole> {
  readonly key: K;
  /** Waarde ophalen uit de live state (default top-level `s[key]`). */
  readonly get: (s: AppState) => DocumentPayload[K];
  /** Waarde terugschrijven naar de live state. */
  readonly set: (s: AppState, v: DocumentPayload[K]) => void;
  /** Verse default voor een nieuw, leeg document. */
  readonly fresh: () => DocumentPayload[K];
  /** Rol in de undo/redo-snapshot (literal behouden per entry, zodat snapshot.ts de
   *  non-'none'-keyunie compile-time kan afleiden en tegen het `Snapshot`-type kan asserten). */
  readonly snapshot: R;
  /** Optionele lees-migratie bij hydrate (defaults / legacy-alias / view-normalisatie).
   *  Afwezig ⇒ `p[key]` letterlijk overnemen. */
  readonly fromPayload?: (p: DocumentPayload) => DocumentPayload[K];
}

/** Type-behoudende builder: houdt de literal `key` én `snapshot`-rol per entry vast zodat de
 *  compile-time volledigheidschecks (onderaan, en in snapshot.ts) werken. */
function field<K extends keyof DocumentPayload, R extends SnapshotRole>(d: FieldDesc<K, R>): FieldDesc<K, R> {
  return d;
}

/**
 * Vul ontbrekende fase-2.7-view-velden aan en migreer het oude `groupBy` naar `group` (§12.2/§7.5).
 * Oude payloads/recovery (van vóór 2.7) missen filter/group/sort/collapsedGroupKeys; `?? default`-
 * guards houden ze veilig. Migratie: een `groupBy`-string zonder `group` → één activity-code-niveau.
 */
export function normalizeView(v: ViewState): ViewState {
  // `groupBy` bestaat niet meer op ViewState (golf 2) maar kan nog in oude payloads/recovery zitten.
  const legacyGroupBy = (v as ViewState & { groupBy?: string }).groupBy;
  const group = v.group && v.group.length > 0
    ? v.group
    : legacyGroupBy
      ? [{ field: { src: 'activityCode' as const, typeId: legacyGroupBy }, dir: 'asc' as const }]
      : [];
  const out: ViewState & { groupBy?: string; columns?: unknown } = {
    ...v,
    filter: v.filter ?? null,
    group,
    sort: v.sort ?? [],
    collapsedGroupKeys: v.collapsedGroupKeys ?? [],
  };
  delete out.groupBy; // gemigreerd — niet opnieuw laten meereizen in payloads
  delete out.columns; // taakgridkolommen zijn vanaf Task 3 uitsluitend app-globale voorkeuren
  return out;
}

/** De canonieke documentveld-lijst. Volgorde = onafhankelijk; volledigheid compile-gecheckt. */
export const DOCUMENT_FIELDS = [
  // Pakket H: `project` doet VOLLEDIG mee in de snapshot (was 'none' met een nauwe wbsAutoNumber-
  // projectie). Voorwaarde daarvoor — elke project-mutator pusht zelf een snapshot — is vervuld in
  // projectSlice; zie de kop van snapshot.ts.
  field({ key: 'project', get: (s) => s.project, set: (s, v) => { s.project = v; }, fresh: createDefaultProject, snapshot: 'data' }),
  // De gedenormaliseerde projectkalender-cache rijdt mee (§9.1): `restoreSnapshot` synct hem ná de
  // restore alsnog uit `calendars`, maar zonder eigen snapshot-waarde zou de undo-orphan-fallback
  // (`promoteProjectCalendarToLibrary`) de NIEUWE cache promoveren i.p.v. de oude.
  field({ key: 'calendar', get: (s) => s.calendar, set: (s, v) => { s.calendar = v; }, fresh: createDefaultCalendar, snapshot: 'data' }),
  field({ key: 'tasks', get: (s) => s.tasks, set: (s, v) => { s.tasks = v; }, fresh: () => [], snapshot: 'data' }),
  field({ key: 'sequences', get: (s) => s.sequences, set: (s, v) => { s.sequences = v; }, fresh: () => [], snapshot: 'data' }),
  field({ key: 'resources', get: (s) => s.resources, set: (s, v) => { s.resources = v; }, fresh: () => [], snapshot: 'data' }),
  field({ key: 'assignments', get: (s) => s.assignments, set: (s, v) => { s.assignments = v; }, fresh: () => [], snapshot: 'data' }),
  field({
    key: 'calendars', get: (s) => s.calendars, set: (s, v) => { s.calendars = v; }, fresh: () => [], snapshot: 'data',
    // Lees-alias (§4.2): oude payloads dragen `resourceCalendars`; nieuwe `calendars`.
    fromPayload: (p) => p.calendars ?? (p as { resourceCalendars?: WorkCalendar[] }).resourceCalendars ?? [],
  }),
  field({ key: 'activityCodeTypes', get: (s) => s.activityCodeTypes, set: (s, v) => { s.activityCodeTypes = v; }, fresh: () => [], snapshot: 'data', fromPayload: (p) => p.activityCodeTypes ?? [] }),
  field({ key: 'customFieldDefs', get: (s) => s.customFieldDefs, set: (s, v) => { s.customFieldDefs = v; }, fresh: () => [], snapshot: 'data', fromPayload: (p) => p.customFieldDefs ?? [] }),
  field({ key: 'selectedTaskIds', get: (s) => s.selectedTaskIds, set: (s, v) => { s.selectedTaskIds = v; }, fresh: () => [], snapshot: 'none' }),
  field({ key: 'cpmResult', get: (s) => s.cpmResult, set: (s, v) => { s.cpmResult = v; }, fresh: () => null, snapshot: 'derived' }),
  field({ key: 'resourceLoadResult', get: (s) => s.resourceLoadResult, set: (s, v) => { s.resourceLoadResult = v; }, fresh: () => null, snapshot: 'derived', fromPayload: (p) => p.resourceLoadResult ?? null }),
  field({ key: 'scheduleStale', get: (s) => s.scheduleStale, set: (s, v) => { s.scheduleStale = v; }, fresh: () => false, snapshot: 'derived', fromPayload: (p) => p.scheduleStale ?? false }),
  // "Datums zoals opgeslagen" (issue #63). `snapshot: 'derived'` net als cpmResult/scheduleStale:
  // beide worden altijd als geheel vervangen, nooit in-place gemuteerd. Dat is precies wat Ctrl+Z
  // nodig heeft — samen met `tasks` ('data') draait één undo de datums én de modus terug.
  // De invariant uit snapshot.ts geldt: élke mutator van deze velden pusht een snapshot.
  field({ key: 'recordedDates', get: (s) => s.recordedDates, set: (s, v) => { s.recordedDates = v; }, fresh: () => null, snapshot: 'derived', fromPayload: (p) => p.recordedDates ?? null }),
  field({ key: 'datesAsRecorded', get: (s) => s.datesAsRecorded, set: (s, v) => { s.datesAsRecorded = v; }, fresh: () => false, snapshot: 'derived', fromPayload: (p) => p.datesAsRecorded ?? false }),
  field({ key: 'baselines', get: (s) => s.baselines, set: (s, v) => { s.baselines = v; }, fresh: () => [], snapshot: 'data', fromPayload: (p) => p.baselines ?? [] }),
  field({ key: 'activeBaselineId', get: (s) => s.activeBaselineId, set: (s, v) => { s.activeBaselineId = v; }, fresh: () => null, snapshot: 'derived', fromPayload: (p) => p.activeBaselineId ?? null }),
  field({ key: 'view', get: (s) => s.view, set: (s, v) => { s.view = v; }, fresh: createDefaultView, snapshot: 'none', fromPayload: (p) => normalizeView(p.view) }),
  // Uitzondering: collapsedTaskIds woont in `s.ui` (wordt wél per-document geswapt).
  field({ key: 'collapsedTaskIds', get: (s) => s.ui.collapsedTaskIds, set: (s, v) => { s.ui.collapsedTaskIds = v; }, fresh: () => [], snapshot: 'none' }),
  field({ key: 'undoStack', get: (s) => s.undoStack, set: (s, v) => { s.undoStack = v; }, fresh: () => [], snapshot: 'none' }),
  field({ key: 'redoStack', get: (s) => s.redoStack, set: (s, v) => { s.redoStack = v; }, fresh: () => [], snapshot: 'none' }),
  field({ key: 'filePath', get: (s) => s.filePath, set: (s, v) => { s.filePath = v; }, fresh: () => null, snapshot: 'none' }),
  field({ key: 'fileHandle', get: (s) => s.fileHandle, set: (s, v) => { s.fileHandle = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.fileHandle ?? null }),
  field({ key: 'isDirty', get: (s) => s.isDirty, set: (s, v) => { s.isDirty = v; }, fresh: () => false, snapshot: 'none' }),
];

// Compile-time volledigheidscheck: elke DocumentPayload-key MOET in DOCUMENT_FIELDS staan. Voeg je
// een veld aan `DocumentPayload` toe zonder descriptor-entry, dan faalt deze regel (het uitgesloten
// keytype is niet langer `never`).
type CoveredKey = typeof DOCUMENT_FIELDS[number]['key'];
type MissingFields = Exclude<keyof DocumentPayload, CoveredKey>;
const _assertAllFieldsCovered: MissingFields extends never ? true : ['DOCUMENT_FIELDS mist velden:', MissingFields] = true;
void _assertAllFieldsCovered;

// ── De andere kant van het contract: geen ongeclassificeerde state ────────────────────────────
//
// De check hierboven sluit de PAYLOAD-kant: elk `DocumentPayload`-veld heeft een descriptor. Wat
// hij NIET zag, is de STATE-kant. Wie een nieuw top-level veld aan een slice toevoegt kreeg
// stilzwijgend app-globaal gedrag: het lekt tussen documenten, staat niet in de undo-snapshot en
// wordt niet gereset door `newProject()`. De compiler zweeg, de suite zweeg, en je merkt het pas
// als een gebruiker data van document A in document B ziet staan.
//
// Daarom classificeert de assert hieronder ELKE niet-functie-key van `AppState` in precies één van
// drie categorieën. Voeg je een veld toe zonder keuze te maken, dan faalt de build — de keuze is
// dus verplicht en bewust, in plaats van een stille default.

/** Niet-functie-keys van T: de dataterreinen van de state, zonder de acties. */
type StateDataKey<T> = { [K in keyof T]-?: T[K] extends (...a: never[]) => unknown ? never : K }[keyof T];

/**
 * Categorie 2 — app-globaal: bewust NIET per document geswapt, want het hoort bij de applicatie
 * of bij de gebruiker, niet bij één project. Voeg hier alleen iets toe als je zeker weet dat het
 * gedeeld hoort te zijn tussen alle open documenten.
 */
type AppGlobalKey =
  // Chrome en gebruikersvoorkeuren. (`ui.collapsedTaskIds` is de ene uitzondering: dat veld zit
  // wél in DOCUMENT_FIELDS en wordt per document geswapt.)
  | 'ui'
  // Klembord: expliciet app-globaal, zodat kopiëren/plakken tússen documenten werkt.
  | 'taskClipboard'
  // Recente bestanden: een eigenschap van de installatie, niet van een project.
  | 'recentFiles'
  // Multi-document-boekhouding zelf — dit ís de laag die de rest swapt.
  | 'documents' | 'activeDocumentId'
  // Extensies: app-niveau data, geen projectdata (zie CLAUDE.md, *Extensiesysteem*).
  | 'installedExtensions' | 'extensionRibbonButtons' | 'extensionImporters'
  | 'catalogEntries' | 'catalogLoading' | 'catalogError' | 'catalogLastFetched'
  // Resourcebibliotheek: app-globaal, net als extensies (zie CLAUDE.md, *Resourcebibliotheken*).
  | 'companies' | 'defaultCompanyId' | 'pools' | 'libraryLoaded'
  // Taakgridkolommen, surface-scroll en MRU zijn persoonlijke instellingen.
  | 'taskGridSurfaces' | 'recentTaskColumns';

/**
 * Categorie 3 — afgeleid: geen bron van waarheid, wordt herberekend uit velden die wél in het
 * contract staan. Hoort daarom noch in de payload (dan zou hij kunnen verouderen) noch bij de
 * app-globale velden. Elk swap-pad in `documentSlice` roept `recomputeViewRows()` aan.
 */
type DerivedKey = 'viewRows';

type Unclassified = Exclude<StateDataKey<AppState>, keyof DocumentPayload | AppGlobalKey | DerivedKey>;
const _assertNoUnclassifiedState: Unclassified extends never ? true : [
  'Nieuw state-veld zonder keuze. Zet het in DocumentPayload (per document), in AppGlobalKey (gedeeld) of in DerivedKey (herberekend):',
  Unclassified,
] = true;
void _assertNoUnclassifiedState;

// Mutatiebewijs voor de richting van de assert: voeg denkbeeldig één ongeclassificeerd bronveld
// aan AppState toe en bewijs dat precies die key door dezelfde typeformule wordt gevangen. Dit is
// bewust een compileerbare fixture; voeg de fixturekey tijdelijk echt aan een slice toe om de rode
// compilertekst van de gewone AppState-assert te zien.
type TaskGridContractMutationFixture = AppState & { __taskGridContractMutationFixture: string };
type FixtureUnclassified = Exclude<
  StateDataKey<TaskGridContractMutationFixture>,
  keyof DocumentPayload | AppGlobalKey | DerivedKey
>;
const _assertMutationFixtureIsCaught: FixtureUnclassified extends '__taskGridContractMutationFixture'
  ? true
  : ['Mutatiefixture werd niet als ongeclassificeerd stateveld gevangen:', FixtureUnclassified] = true;
void _assertMutationFixtureIsCaught;

// En andersom: een classificatie die naar een verdwenen veld wijst is dode ballast die de check
// stilletjes zwakker maakt. Hernoem of verwijder je een veld, dan valt deze regel om.
type StaleClassification = Exclude<AppGlobalKey | DerivedKey, StateDataKey<AppState>>;
const _assertNoStaleClassification: StaleClassification extends never ? true : [
  'Geclassificeerd veld bestaat niet (meer) in AppState:',
  StaleClassification,
] = true;
void _assertNoStaleClassification;

// ── Payload-operaties (key-gedreven over DOCUMENT_FIELDS) ─────────────────────────────────────
// De descriptor-lijst is een UNIE van `FieldDesc<K>` voor elke K; binnen een generieke loop kan TS
// `get`/`set` niet correleren (klassiek correlated-union-probleem). We isoleren die onveiligheid in
// deze twee helpers met een expliciete cast; alle callers blijven type-veilig via DocumentPayload.
type AnyField = typeof DOCUMENT_FIELDS[number];
function readField(f: AnyField, s: AppState): unknown {
  return f.get(s);
}
function writeField(f: AnyField, s: AppState, v: unknown): void {
  (f.set as (s: AppState, v: unknown) => void)(s, v);
}

/** Lees de actieve (top-level) projectdata uit als losstaande payload (allen per referentie). */
export function capturePayload(s: AppState): DocumentPayload {
  const out: Record<string, unknown> = {};
  for (const f of DOCUMENT_FIELDS) out[f.key] = readField(f, s);
  return out as unknown as DocumentPayload;
}

/** Schrijf een payload terug naar de top-level (actieve) state. Symmetrisch met capture: dezelfde
 *  lijst bepaalt welke velden gezet worden — capture en hydrate kunnen niet meer divergeren. */
export function hydratePayload(s: AppState, p: DocumentPayload): void {
  const raw = p as unknown as Record<string, unknown>;
  // Vang de oude actieve documentkolommen vóór `normalizeView` ze uit het documentcontract
  // verwijdert. De TaskGridSlice bewaart deze bron tijdelijk per store-instantie, buiten AppState;
  // bootstrap gebruikt hem alleen wanneer de nieuwe gebruikerssleutel werkelijk ontbreekt.
  s.stageLegacyTaskGridColumns(p.project.id,
    (p.view as ViewState & { columns?: ColumnConfig[] }).columns);
  for (const f of DOCUMENT_FIELDS) {
    writeField(f, s, f.fromPayload ? f.fromPayload(p) : raw[f.key]);
  }
  // §4.3: oude/verse documenten zonder bibliotheek-entry voor hun projectkalender krijgen er hier
  // één (idempotent — no-op als de entry al bestaat, bv. bij een gewone switchDocument/undo).
  promoteProjectCalendarToLibrary(s);
  syncProjectCalendar(s); // §9.1: gedenormaliseerde projectkalender-cache gelijkzetten ná hydrate/switch.
}

/** Verse, lege document-payload (nieuw project). */
export function freshPayload(): DocumentPayload {
  const out: Record<string, unknown> = {};
  for (const f of DOCUMENT_FIELDS) out[f.key] = f.fresh();
  return out as unknown as DocumentPayload;
}

/** Verse payload uit herstelde recovery-projectdata (view/undo/cpm worden vers opgebouwd).
 *
 *  Delegeert naar `payloadFromImport` (bevinding K3): een `RecoveryDocInput` ÍS een `ImportResult`
 *  + identiteit, dus de veldmapping is exact dezelfde — inclusief de `resourceCalendars`→
 *  `calendars`-hernoeming en alle `?? []` / `?? null`-defaults. Eén veldlijst i.p.v. twee die uit
 *  elkaar kunnen lopen. Twee echte verschillen met de import-kant:
 *
 *  1. Recovery herstelt een NIET-opgeslagen document, dus `isDirty` komt uit de snapshot-metadata
 *     in plaats van hard op `false`.
 *  2. `scheduleStale` gaat op `true`. `freshPayload()` zet hem op `false` met een verse
 *     `cpmResult: null` — dat klopt voor het ACTIEVE document (dat wordt na herstel doorgerekend),
 *     maar `documentSlice` gebruikt deze functie óók voor de INACTIEVE documenten bij
 *     crash-recovery, en `switchDocument` roept nooit `runCPM` aan. Met `false` toont
 *     `StatusBar` dan geen waarschuwing terwijl er geen kritiek pad en geen float berekend is:
 *     een planning die er correct uitziet en het niet is. `true` vertelt de waarheid — het
 *     schema ís nog niet berekend — en laat de gebruiker met F5 verder.
 */
export function payloadFromInput(d: RecoveryDocInput): DocumentPayload {
  return { ...payloadFromImport(d, d.filePath), isDirty: d.isDirty, scheduleStale: true };
}

/** Verse payload uit een ingelezen project (IFC/CSV/MSPDI/P6). Alleen de IFC-round-trip-velden
 *  worden overgenomen; selectie/cpm/undo/scheduleStale starten vers. `view`/`collapsedTaskIds`
 *  vult de aanroeper (`applyLoadedProject` behoudt die van het huidige document — load-semantiek). */
export function payloadFromImport(parsed: ImportResult, filePath: string | null): DocumentPayload {
  return {
    ...freshPayload(),
    project: parsed.project,
    calendar: parsed.calendar,
    tasks: parsed.tasks,
    sequences: parsed.sequences,
    resources: parsed.resources,
    assignments: parsed.assignments,
    calendars: parsed.resourceCalendars ?? [],
    activityCodeTypes: parsed.activityCodeTypes ?? [],
    customFieldDefs: parsed.customFieldDefs ?? [],
    baselines: parsed.baselines ?? [],
    activeBaselineId: parsed.activeBaselineId ?? null,
    filePath,
    isDirty: false,
  };
}
