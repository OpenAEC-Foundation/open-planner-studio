import { current } from 'immer';
import type { AppSliceFactory, NotifyInput } from './types';
import type { Company, CompanyPool, CompanyLibrary } from '@/types/library';
import { createDefaultLibrary, createEmptyPool, DEFAULT_COMPANY_ID } from '@/types/library';
import { generateId } from '@/utils/id';
import { nextFreePaletteColor } from '@/engine/renderer/resourcePalette';
import { loadLibrary, saveLibrary, bumpPool, makeOrigin, copyCalendarToProject, copyResourceToProject, diffCalendarVsPool, diffResourceVsPool, applyCalendarUpdate, applyResourceUpdate, writePoolIFC, isPoolNewer, computeCalendarHash, computeResourceHash, classifyCalendarOnOpen, classifyResourceOnOpen, matchByName, normalizePoolShape, resolveUniqueCompanyName, isReservedCompanyId, isSafeFileCompanyId, buildDemoLibrarySeed, DEMO_COMPANY_ID, CALENDAR_DIFF_FIELDS as CALENDAR_DIFF_FIELDS_LOCAL, RESOURCE_DIFF_FIELDS as RESOURCE_DIFF_FIELDS_LOCAL } from '@/services/library';
import { markScheduleStale } from '../transaction';
import { syncProjectCalendar } from '../syncProjectCalendar';
import { appLog } from '@/services/debug/appLog';
import { runInScratchDocument } from '../runtime/scratchDocument';
import {
  planDistributionWrites,
  type DistributionApplyRecord,
  type DistributionUndoReport,
} from '@/services/library/applyDistribution';
import type { DistributionProposal } from '@/services/library/distribute';
import {
  invalidateUndoneHistoryForScopes,
  recordSessionHistoryDeltas,
  selectUndoHistoryEvent,
  type HistoryScopeKey,
  type SessionHistoryEvent,
} from '../sessionHistory';
import { snapshotOfPayload, type Snapshot } from '../snapshot';
import { capturePayload, hydratePayload, type DocumentPayload } from '../documentContract';
import { materializeLibraryBoundary } from '../documentActivation';

function invalidateDocumentRedo(
  state: { historyEvents: import('../sessionHistory').SessionHistoryEvent[] },
  documentId: string,
): void {
  const scope: HistoryScopeKey = `document:${documentId}`;
  state.historyEvents = invalidateUndoneHistoryForScopes(state.historyEvents, new Set([scope]));
}

/** Het history-label van een B1c-verdeling. Zelfde soort korte Nederlandse omschrijving als
 *  `gridTransaction.ts` gebruikt; labels zijn interne historie-omschrijvingen, geen UI-tekst. */
const DISTRIBUTION_HISTORY_LABEL = 'Verdeling toepassen';

/**
 * Het jongste toegepaste `document-data`-event voor dit document vanaf `minSequence` (B1c-plan3
 * taak 6, aangepast na de merge met main — sessiehistorie, 2026-09-04).
 *
 * `applyDistribution` gebruikt dit om het event terug te vinden dat `get().applyLeveling(...)` net
 * voor het ACTIEVE document heeft achtergelaten. `minSequence` is de `nextHistorySequence` van vlak
 * vóór die aanroep: die teller loopt door over `pruneSessionHistory` heen, dus hij is een
 * betrouwbaar anker waar een index of een diepte dat niet is. "Jongste" en niet "eerste", omdat
 * `applyLeveling` → `runCPM` in de #63-modus twee events kán opleveren.
 */
function latestDocumentDataEventSince(
  events: readonly SessionHistoryEvent[],
  documentId: string,
  minSequence: number,
): { id: string; sequence: number } | null {
  let selected: SessionHistoryEvent | null = null;
  for (const event of events) {
    if (event.state !== 'applied' || event.sequence < minSequence) continue;
    if (!event.deltas.some((d) => d.kind === 'document-data' && d.documentId === documentId)) continue;
    if (selected === null || event.sequence > selected.sequence) selected = event;
  }
  return selected === null ? null : { id: selected.id, sequence: selected.sequence };
}

/**
 * De poort van "alles terugdraaien" (spec §5): mag dit document nog terug?
 *
 * Drie eisen, samen precies de vraag die undo moet beantwoorden: het event bestaat nog, het staat
 * nog op `applied` (niemand heeft het al met Ctrl+Z teruggedraaid), en het is het event dat
 * `selectUndoHistoryEvent` voor DIT document NU zou kiezen. Die derde eis is de kern: staat er een
 * jonger toepasbaar event bovenop, dan heeft de gebruiker er sinds Toepassen zelf in gewerkt en zou
 * terugdraaien de verkeerde stap ongedaan maken. Een gesloten document valt hier vanzelf uit —
 * `removeSessionHistoryForDocument` heeft zijn events dan al verwijderd.
 *
 * NIET de mutatieteller/vingerafdruk uit taak 4: die twee bedienen de VOORSTEL-invalidatie van de
 * verdeeldialoog (taak 12) — "is het voorstel nog geldig" — en beantwoorden niet de vraag welke
 * undo-stap er nu bovenop ligt. Ze vervangen deze poort dus niet.
 */
function distributionUndoTarget(
  events: readonly SessionHistoryEvent[],
  documentId: string,
  eventId: string,
): SessionHistoryEvent | null {
  const event = events.find((e) => e.id === eventId);
  if (!event || event.state !== 'applied') return null;
  return selectUndoHistoryEvent(events, documentId)?.id === eventId ? event : null;
}

export interface RecognitionCandidate {
  kind: 'resource' | 'calendar';
  projectId: string;
  projectName: string;
  /** De unieke naam-match uit de pool, of null (geen/meerdere kandidaten ⇒ handmatige keuze). */
  suggestedPoolId: string | null;
  suggestedPoolName: string | null;
}
export interface RecognitionLink {
  kind: 'resource' | 'calendar';
  projectId: string;
  poolId: string;
}

/**
 * App-globale bedrijfsbibliotheek (spec B1). NIET per-document (niet in DOCUMENT_FIELDS) — pools zijn
 * bedrijfsdata, gedeeld over alle documenten, net als `installedExtensions`. Persistentie loopt
 * ná elke mutatie via `saveLibrary` (fire-and-forget; de store is de bron van waarheid in-memory).
 */
export interface LibrarySlice {
  companies: Company[];
  defaultCompanyId: string;
  pools: Record<string, CompanyPool>;
  /** True zodra `initLibrary()` de opgeslagen bibliotheek heeft geladen (voorkomt vroege save). */
  libraryLoaded: boolean;

  initLibrary: () => Promise<void>;
  addCompany: (name: string) => string;
  /** Seed (idempotent) de demo-resourcebibliotheek (issue #19, user-verzoek: showcase-voorbeelden
   *  delen één gedeelde pool "dezelfde ploeg in twee projecten"). Bestaat het bedrijf `DEMO_COMPANY_ID`
   *  al, dan gebeurt er NIETS (ook de inhoud wordt niet overschreven — de gebruiker mag 'm bewerkt
   *  hebben) en wordt alleen het id teruggegeven. Loopt door dezelfde `set`/`persist`-laag als
   *  `addCompany` — geen parallelle opslagroute. Retourneert altijd `DEMO_COMPANY_ID`. */
  seedDemoLibrary: () => string;
  renameCompany: (id: string, name: string) => void;
  /** Verwijder een bedrijf (spec §5). Er blijft altijd ≥1 bedrijf (spec §2, no-op op het laatste).
   *  Ontkoppelt expliciet elk GEOPEND document (actief én slapend) dat aan dit bedrijf gekoppeld
   *  was: companyId/companyName gewist, alle herkomststempels van dit bedrijf gestript. Opgeslagen
   *  (niet-geopende) bestanden zijn hier niet bij betrokken — die gedragen zich bij later openen als
   *  ontvangen bestanden (los; §2-scope). Zie `countDocumentsLinkedTo` voor de verwijder-bevestiging. */
  removeCompany: (id: string) => void;
  /** Aantal GEOPENDE documenten (actief + slapend) gekoppeld aan dit bedrijf — voor de
   *  verwijder-bevestiging (spec §5). */
  countDocumentsLinkedTo: (companyId: string) => number;
  setDefaultCompany: (id: string) => void;
  /** Promoveer een projectkalender naar de pool van een bedrijf (spiegel van de bestaande
   *  calendar-`promote`; spec §3). Voegt een POOL-kopie toe met een verse pool-id en bumpt de pool.
   *  Retourneert de nieuwe pool-item-id, of `null` als het bedrijf (de pool) niet bestaat. Stempelt
   *  bovendien het BRON-projectitem (indien aanwezig) met de nieuwe herkomst, zodat "bijwerken vanuit
   *  bibliotheek" direct op het gepromoveerde item werkt. */
  promoteCalendarToPool: (companyId: string, calendar: import('@/types/calendar').WorkCalendar) => string | null;
  /** Resource-variant van `promoteCalendarToPool` — óók de "naar de bibliotheek"-rijactie op een
   *  ongestempelde Projectweergave-rij (issue #19, punt D5). Standaardgedrag (geen `opts`, of
   *  `dedupByName: false`) is ONGEWIJZIGD t.o.v. voorheen: altijd een NIEUW poolitem, ook als de pool
   *  al een gelijknamig item heeft (bewaart de bestaande herkenningsstap-test die bewust twee
   *  gelijknamige poolitems opzet om "ambigu ⇒ geen voorstel" te testen, spec §5.1). Met
   *  `opts.dedupByName: true` (de Resources-tab-rijactie): is er een UNIEKE genormaliseerde-naam-match
   *  al in de pool (`matchByName`), dan wordt GEEN duplicaat gepusht — het bronitem koppelt
   *  (stempelt) in plaats daarvan aan dat bestaande poolitem ("bestond al, gekoppeld"). Retourneert in
   *  beide gevallen de resulterende pool-item-id (nieuw of bestaand), of `null` als het bedrijf (de
   *  pool) niet bestaat. Met dedup: no-op op een reeds gestempeld bronitem. */
  promoteResourceToPool: (companyId: string, resource: import('@/types/resource').Resource, opts?: { dedupByName?: boolean }) => string | null;
  /** Bewerk pool-inhoud rechtstreeks (Backstage). Elke wijziging bumpt de pool. */
  updatePoolCalendar: (companyId: string, calendarId: string, updates: Partial<import('@/types/calendar').WorkCalendar>) => void;
  updatePoolResource: (companyId: string, resourceId: string, updates: Partial<import('@/types/resource').Resource>) => void;
  removePoolCalendar: (companyId: string, calendarId: string) => void;
  removePoolResource: (companyId: string, resourceId: string) => void;
  /** Bedrijfsweergave-CRUD: maak een NIEUW poolitem direct in het bedrijf (spec §4). Raakt
   *  UITSLUITEND s.pools (invariant, plan-eis 3); bumpt de pool. Retourneert de nieuwe pool-id. */
  addPoolResource: (companyId: string, resource: Omit<import('@/types/resource').Resource, 'id'>) => string | null;
  addPoolCalendar: (companyId: string, calendar: Omit<import('@/types/calendar').WorkCalendar, 'id'>) => string | null;

  /** Bind het ACTIEVE project aan een bedrijf (spec §6). Zet project.companyId + companyName; bij
   *  OMkoppelen (ander bedrijf) worden vreemde stempels van het VORIGE bedrijf gestript (spec §5),
   *  zodat de herkenningsstap schoon herbegint. De strip-tak is undoable (GO-NA-fix 1, critreview
   *  5b81aea); een eerste bind of een herbind naar hetzelfde bedrijf strip niets en pusht geen
   *  undo-snapshot. */
  bindProjectToCompany: (companyId: string) => void;
  /** Kandidaten voor de herkenningsstap (spec §5): elk NIET-gestempeld projectitem (resource/
   *  kalender) met de unieke naam-match uit de eigen-bedrijf-pool (of null als er geen/meerdere zijn). */
  computeRecognition: () => RecognitionCandidate[];
  /** Atomisch linken (plan-eis 5): stempel de gekozen projectitems, zet syncedHash, en ververs ze
   *  naar de poolwaarden — alles in één set(). Undoable (GO-NA-fix 1, critreview 5b81aea): een
   *  verdwenen kandidaat (poolId niet meer in de pool) wordt stil overgeslagen (GO-NA-fix 3), de rest
   *  gaat door; zonder toepasbare link geen undo-snapshot. */
  linkRecognizedItems: (links: RecognitionLink[]) => void;
  /** Ontkoppel het actieve project (spec §5): wis companyId/companyName en STRIP alle stempels —
   *  een los project heeft geen herkomst en ververst nergens vandaan. Undoable (GO-NA-fix 1); no-op
   *  (geen undo-snapshot) op een al-los project. */
  unbindProject: () => void;
  /**
   * Voeg een bibliotheek-kalender toe aan het ACTIEVE project (spec §3): kopieer met stempel, dedup
   * op herkomst. Retourneert `{ added, calendarId }` — `added: false` ⇒ item was er al ("al in project").
   */
  addLibraryCalendarToProject: (companyId: string, poolCalendarId: string) => { added: boolean; calendarId: string | null };
  /**
   * Voeg een bibliotheek-resource toe aan het ACTIEVE project (spec §3): kopieer met stempel, laat
   * de eigen kalender meereizen (met dedup), dedup op herkomst. Bindt het project aan het bedrijf als
   * het nog ongebonden was.
   */
  addLibraryResourceToProject: (companyId: string, poolResourceId: string) => { added: boolean; resourceId: string | null };

  /** Bereken de diff van een projectkalender t.o.v. zijn bibliotheekorigineel (spec §3). */
  diffProjectCalendar: (calendarId: string) => import('@/services/library').ItemDiff | null;
  diffProjectResource: (resourceId: string) => import('@/services/library').ItemDiff | null;
  /** Werk één projectkalender bij naar de bibliotheekwaarden (spec §3). No-op als geen herkomst/pool. */
  updateProjectCalendarFromLibrary: (calendarId: string) => void;
  updateProjectResourceFromLibrary: (resourceId: string) => void;

  /** Serialiseer de pool van een bedrijf naar een IFC-string (voor export/backup, spec §4). */
  exportPoolIFC: (companyId: string) => string | null;
  /** Vervang de HELE pool van een bedrijf door een geïmporteerde pool ná bevestiging (spec §4).
   *  De demping-waarschuwing zit in de UI (via `isPoolNewer`). Pool en open-boundary van het
   *  actieve document worden samen gepubliceerd, zodat nooit een halve import zichtbaar is. */
  replacePool: (companyId: string, pool: import('@/types/library').CompanyPool) => void;
  /**
   * Importeer een geïmporteerde pool als NIEUW bedrijf (issue #19: "een bibliotheek importeren"
   * voelde aan als openen, maar was in werkelijkheid de gekozen bibliotheek onvoorwaardelijk
   * overschrijven — deze actie is de veilige tegenhanger in `PoolImportDialog`). Anders dan
   * `replacePool` (dat de HELE pool van een GEKOZEN bestaand bedrijf vervangt) maakt dit een NIEUW
   * bedrijf aan met de inhoud van het bestand:
   * - Naam: `pool.companyName` (met een onderscheidend " (2)"/" (3)"-achtervoegsel bij een lokale
   *   naamsbotsing, via `resolveUniqueCompanyName`).
   * - Id: behoudt `pool.companyId` uit het bestand als dat lokaal nog VRIJ is — dat is precies wat
   *   een meegestuurd project (met stempels naar dat companyId) nodig heeft om zijn bibliotheek na
   *   het delen te herkennen. Bestaat het id al lokaal, is het een RESERVED id (`isReservedCompanyId`
   *   — `DEFAULT_COMPANY_ID`/`DEMO_COMPANY_ID`, GEEN identiteitsbewijs: vrijwel elke installatie deelt
   *   ze, zie critreview F1), of is het geen veilige state-sleutel (`isSafeFileCompanyId` — critreview
   *   F2, een vijandig bestand-id als `"__proto__"` mag nooit als Immer-draft-sleutel eindigen), dan
   *   een vers gegenereerd id (het wordt dan een kopie náást de bestaande, net als bij een naamsbotsing).
   * Bindt het ACTIEVE project NIET aan het nieuwe bedrijf — dat is een aparte, bewuste
   * gebruikershandeling. Retourneert het nieuwe companyId.
   */
  importPoolAsNewCompany: (pool: import('@/types/library').CompanyPool) => string;
  /** True als de lokale pool nieuwer is dan een te importeren pool (demping, spec §4). */
  isLocalPoolNewer: (companyId: string, imported: import('@/types/library').CompanyPool) => boolean;

  /** Verversingsprimitief (spec §3, plan-eis 2): werk UITSLUITEND 'behind'-items van het ACTIEVE
   *  document bij naar de poolwaarden van het gegeven bedrijf (scope §2). 'behind' = file == syncedHash
   *  én pool wijkt af; een 'deviated' (lokaal bewerkt) item blijft ongemoeid (spec §3). Niet-undoable:
   *  geen history-event, geen isDirty, wist botsende redo-history; raakte het een kalender, dan zet het
   *  `scheduleStale` (geen runCPM). Retourneert het aantal gewijzigde items. */
  refreshBehindItems: (companyId: string) => number;

  /** Grens 3/4 (spec §3, plan-eis 1): ververs uitsluitend 'behind'-items van het gegeven bedrijf, in
   *  het ACTIEVE document én in elke SLAPENDE document-payload, binnen één set(). 'deviated'-items
   *  blijven ongemoeid (spec §3). Slapende documenten herrekenen pas bij activering (geen recompute
   *  hier); raakte de verversing een kalender, dan zet het `scheduleStale` (per document/payload),
   *  ZONDER isDirty. Niet-undoable (wist botsende redo-history). Retourneert het totaal aantal gewijzigde items. */
  refreshAllDocumentsFromPool: (companyId: string) => number;


  /** Openings-status van één projectitem t.o.v. zijn eigen-bedrijf-pool (spec §2-scope): drijft de
   *  markeringen in de Projectweergave ("wijkt af — beslis" / "niet meer in het bedrijf"). Geen
   *  eigen-bedrijf-stempel of bedrijf lokaal onbekend ⇒ null (geen markering; los-gedrag). */
  onOpenStatusForResource: (resourceId: string) => import('@/services/library').OnOpenStatus | null;
  onOpenStatusForCalendar: (calendarId: string) => import('@/services/library').OnOpenStatus | null;

  /** Los één afwijking op (spec §3, koppel-/afwijkingenscherm). 'company' = neem de poolwaarde over
   *  (ververs het item, niet-undoable, wist botsende redo-history, geen isDirty). 'file' = neem de BESTANDSwaarde
   *  over in het bedrijf: werk het poolitem bij (bumpt de pool — "geldt voor al je projecten") en
   *  ververs de siblings; het net-geopende item krijgt de verse syncedHash zonder dubbele verversing
   *  (plan-eis 4). */
  resolveDeviation: (ref: { kind: 'resource' | 'calendar'; projectId: string }, choice: 'company' | 'file') => void;

  /** "Losmaken van de bibliotheek" (Resources-tab, Projectweergave, issue #19): verwijder de
   *  `libraryOrigin`-stempel van PRECIES DIT ÉNE projectitem. Anders dan `unbindProject` (dat ALLE
   *  stempels van het hele project strip) raakt dit uitsluitend de gekozen resource — de rest van het
   *  project blijft gekoppeld. De resource zelf blijft gewoon in het project staan, maar wordt weer
   *  volledig bewerkbaar (naam/type/tarief/eenheid zijn dan niet langer bibliotheekafspraken) en volgt
   *  de pool niet meer (geen verversing/afwijkingsvraag meer voor dit item). Undoable
   *  (beginUndoable/finishMutation-patroon). No-op (geen undo-snapshot) op een onbekend id of een
   *  resource zonder stempel. */
  unlinkResourceFromLibrary: (resourceId: string) => void;

  /** Toepassen (spec §5, B1c-plan3 taak 6). Schrijft het voorstel in élk deelnemend document — het
   *  actieve via het gewone top-level-pad, de slapers via een headless scratch-instantie
   *  (`runInScratchDocument`) — en geeft een record terug waarmee de "toegepast"-strook alles in
   *  één keer kan terugdraaien. `null` ⇒ er is niets geschreven (geblokkeerd, tekort, of niets te
   *  doen; zie `planDistributionWrites`). */
  applyDistribution: (
    proposal: DistributionProposal,
    scopeTaskIdsByDoc: Record<string, string[]>,
  ) => DistributionApplyRecord | null;

  /** "Alles terugdraaien" (spec §5): draait per beschreven document precies de undo-stap terug die
   *  `applyDistribution` daar heeft achtergelaten. Een document waarvan de undo-diepte intussen is
   *  verschoven (de gebruiker werkte er zelf in verder) wordt overgeslagen — blind terugpoppen zou
   *  daar de VERKEERDE stap ongedaan maken — en gemeld via `DistributionUndoReport.skippedDocIds`. */
  undoDistribution: (record: DistributionApplyRecord) => DistributionUndoReport;
}

/**
 * Normaliseer één pool defensief tegen vorm-invalide data (bijv. een handmatig bewerkt of door een
 * derde tool geproduceerd `OPS_Library`-bestand zonder `resources`/`calendars`). Dunne her-export van
 * de pure `normalizePoolShape` (F2 vloot-fixpakket, issue #19: verplaatst naar
 * `services/library/libraryOps.ts` zodat `readPoolIFC` 'm ook kan hergebruiken, vóór deze slice
 * bestond dat alleen hier). Puur — geschikt voor losse unit-tests, en herbruikt door zowel het laden
 * van de opgeslagen bibliotheek (`normalizeLoadedLibrary`) als het importeren van één pool
 * (`replacePool`).
 */
export function normalizePool(cid: string, raw: Partial<CompanyPool> | null | undefined, companies: Company[]): CompanyPool {
  return normalizePoolShape(cid, raw, companies);
}

/**
 * Normaliseer een geladen bibliotheek vóór gebruik (defensief tegen vorm-invalide opgeslagen data —
 * bijv. een handmatig bewerkt of ouder bestand). Nooit een TypeError: ontbrekende `companies`/`pools`
 * worden aangevuld (leeg ⇒ geseed met het standaardbedrijf), een `defaultCompanyId` die niet naar een
 * bestaand bedrijf wijst valt terug op het eerste bedrijf, en pools zonder bijbehorend bedrijf
 * (wezen) worden verwijderd. Puur — geen state, geschikt voor losse unit-tests.
 */
export function normalizeLoadedLibrary(lib: Partial<CompanyLibrary> | null | undefined): CompanyLibrary {
  const companies = lib?.companies && lib.companies.length > 0 ? lib.companies : createDefaultLibrary().companies;
  const companyIds = new Set(companies.map((c) => c.id));
  const rawPools = lib?.pools ?? {};
  // Wezen-pools opruimen: pools waarvan companyId niet (meer) bij een bedrijf hoort. Behouden pools
  // óók structureel normaliseren via `normalizePool` (zie daar).
  const pools = Object.fromEntries(
    Object.entries(rawPools)
      .filter(([cid]) => companyIds.has(cid))
      .map(([cid, p]): [string, CompanyPool] => [cid, normalizePool(cid, p, companies)]),
  );
  const defaultCompanyId = lib?.defaultCompanyId && companyIds.has(lib.defaultCompanyId)
    ? lib.defaultCompanyId
    : companies[0].id;
  return { companies, defaultCompanyId, pools };
}

type LibraryPersistenceState = {
  companies: Company[];
  defaultCompanyId: string;
  pools: Record<string, CompanyPool>;
  libraryLoaded: boolean;
  notify: (notification: NotifyInput) => void;
};

/**
 * Serialiseer de huidige bibliotheek-state en persisteer hem.
 *
 * Een mislukte achtergrondopslag was eerder uitsluitend zichtbaar in de
 * debugterminal. Dat is onvoldoende: de gebruiker moet weten dat een zojuist
 * gewijzigde bibliotheek na herstart verloren kan gaan. De aparte
 * `library-save`-sleutel voorkomt tegelijk een toast-stapel bij een aanhoudende
 * opslagfout.
 */
export async function persistLibrary(
  get: () => LibraryPersistenceState,
  save: (library: CompanyLibrary) => Promise<void> = saveLibrary,
): Promise<void> {
  // Vóór initLibrary() is de state nog de verse seed; wegschrijven zou die door de async load heen
  // laten overschrijven (of, erger, de echte opgeslagen bibliotheek voortijdig overschrijven).
  if (!get().libraryLoaded) return;
  const s = get();
  const lib: CompanyLibrary = { companies: s.companies, defaultCompanyId: s.defaultCompanyId, pools: s.pools };
  try {
    await save(lib);
  } catch (err) {
    appLog.emit('error', 'library', 'saveLibrary faalde', err);
    s.notify({
      severity: 'error',
      messageKey: 'notifications.librarySaveFailed',
      detail: err instanceof Error ? err.message : String(err),
      dedupeKey: 'library-save',
    });
  }
}

/** Fire-and-forget-oproep voor de synchronische slice-acties. */
function persist(get: () => LibraryPersistenceState): void {
  void persistLibrary(get);
}

export const createLibrarySlice: AppSliceFactory<LibrarySlice> = (runtime) => (set, get) => ({
  companies: createDefaultLibrary().companies,
  defaultCompanyId: DEFAULT_COMPANY_ID,
  pools: createDefaultLibrary().pools,
  libraryLoaded: false,

  initLibrary: async () => {
    const raw = await loadLibrary();
    const lib = normalizeLoadedLibrary(raw);
    set((s) => {
      s.companies = lib.companies;
      s.defaultCompanyId = lib.defaultCompanyId;
      s.pools = lib.pools;
      // Elk bedrijf moet een pool hebben (verse bedrijven / gemigreerde data).
      for (const c of s.companies) {
        if (!s.pools[c.id]) s.pools[c.id] = createEmptyPool(c);
      }
      s.libraryLoaded = true;
    });
  },

  addCompany: (name) => {
    const id = generateId('company');
    const company: Company = { id, name: name.trim() || 'Nieuwe resourcebibliotheek' };
    set((s) => {
      s.companies.push(company);
      s.pools[id] = createEmptyPool(company);
    });
    persist(get);
    return id;
  },

  seedDemoLibrary: () => {
    // Idempotentie (spec): bestaat het bedrijf al, dan niets aanmaken/overschrijven — alleen het
    // vaste id teruggeven. Companies+pools horen 1-op-1 samen (invariant elders in deze slice), dus
    // de aanwezigheid van het BEDRIJF is voldoende signaal.
    if (get().companies.some((c) => c.id === DEMO_COMPANY_ID)) return DEMO_COMPANY_ID;
    set((s) => {
      const { company, pool } = buildDemoLibrarySeed();
      s.companies.push(company);
      s.pools[company.id] = pool;
    });
    persist(get);
    return DEMO_COMPANY_ID;
  },

  renameCompany: (id, name) => {
    set((s) => {
      const c = s.companies.find(c => c.id === id);
      if (!c) return;
      c.name = name.trim() || c.name;
      // Gedenormaliseerde companyName in de pool meelopen.
      if (s.pools[id]) s.pools[id].companyName = c.name;
    });
    persist(get);
  },

  removeCompany: (id) => {
    // Bevinding 4 (eindreview): als het verwijderde bedrijf het bedrijf van het ACTIEVE project was,
    // hoort bij de ontkoppeling ook het afwijkingenscherm/-signaal te resetten (patroon
    // activatie/newDocument/closeDocument hierboven) — anders blijft een stale dialoog/melding
    // van het net-verwijderde bedrijf staan. Vastleggen vóór de mutatie: de "laatste bedrijf blijft"
    // no-op-tak hieronder mag deze reset niet triggeren als er niets daadwerkelijk verwijderd is.
    const wasActiveCompany = get().companies.length > 1 && get().project.companyId === id;
    set((s) => {
      // Er moet altijd minstens één bedrijf blijven (spec §2). Laatste verwijderen ⇒ no-op.
      if (s.companies.length <= 1) return;
      s.companies = s.companies.filter(c => c.id !== id);
      delete s.pools[id];
      if (s.defaultCompanyId === id) s.defaultCompanyId = s.companies[0].id;
      // Spec §5: ontkoppel gekoppelde OPEN documenten expliciet (stempels strippen). Opgeslagen
      // bestanden gedragen zich bij later openen als ontvangen bestanden (los; §2-scope).
      if (s.project.companyId === id) {
        s.project.companyId = undefined;
        s.project.companyName = undefined;
        s.resources = s.resources.map((r) => r.libraryOrigin?.companyId === id ? (() => { const { libraryOrigin: _d, ...rest } = r; return rest; })() : r);
        s.calendars = s.calendars.map((c) => c.libraryOrigin?.companyId === id ? (() => { const { libraryOrigin: _d, ...rest } = c; return rest; })() : c);
        s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
      }
      for (const d of s.documents) {
        if (!d.payload) continue;
        // Lokale const ná de null-guard: zie de identieke toelichting bij refreshAllDocumentsFromPool
        // (TS narrowt `d.payload` niet door de `.find()`-callback hieronder heen).
        const payload = d.payload;
        if (payload.project.companyId !== id) continue;
        payload.project = { ...payload.project, companyId: undefined, companyName: undefined };
        payload.resources = payload.resources.map((r) => r.libraryOrigin?.companyId === id ? (() => { const { libraryOrigin: _d, ...rest } = r; return rest; })() : r);
        payload.calendars = payload.calendars.map((c) => c.libraryOrigin?.companyId === id ? (() => { const { libraryOrigin: _d, ...rest } = c; return rest; })() : c);
        // F1 (vloot-fixpakket, issue #19): de gedenormaliseerde projectkalender-cache van een SLAPENDE
        // payload moet de zojuist gestripte `calendars`-lijst meelopen — anders draagt de cache
        // (waar de auto-save/writer uitsluitend uit leest, zonder hydrate) nog het herkomststempel
        // van het net-verwijderde bedrijf. Spiegelt de actieve-document-tak hierboven.
        payload.calendar = payload.calendars.find((c) => c.id === payload.project.calendarId) ?? payload.calendar;
      }
    });
    persist(get);
    if (wasActiveCompany) {
      get().setUI({ showLibraryLinkDialog: false, libraryRefreshNotice: null });
    }
  },

  countDocumentsLinkedTo: (companyId) => {
    const s = get();
    let n = s.project.companyId === companyId ? 1 : 0;
    for (const d of s.documents) if (d.payload && d.payload.project.companyId === companyId) n++;
    return n;
  },

  setDefaultCompany: (id) => {
    set((s) => {
      if (s.companies.some(c => c.id === id)) s.defaultCompanyId = id;
    });
    persist(get);
  },

  promoteCalendarToPool: (companyId, calendar) => {
    // Return-eerlijkheid (review taak 7): mint de pool-id pas als de pool echt bestaat; anders `null`
    // (geen id die nergens naar verwijst).
    let newId: string | null = null;
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      const id = generateId('cal');
      // Verse pool-identiteit; strip een eventuele bestaande herkomst (dit wordt zelf een origineel).
      const { libraryOrigin: _drop, ...rest } = calendar;
      pool.calendars.push({ ...structuredClone(rest), id });
      const bumped = bumpPool(pool);
      s.pools[companyId] = bumped;
      // Terug-stempel op het BRON-projectitem (indien aanwezig): eerst bumpen, dan stempelen met de
      // NIEUWE versie (off-by-one-val).
      const src = s.calendars.find((c) => c.id === calendar.id);
      if (src) {
        // Fix B4: de PROJECTSTEMPEL-mutatie is undo-BESCHERMD (de pool-mutatie hierboven blijft
        // bewust app-globaal/niet-undoable — pools zijn geen projectdata). Zonder dit veegt een
        // latere, volledig ongerelateerde undo de stempel stilzwijgend weg, want de stempel-mutatie
        // stond op geen enkele undo-snapshot (bewezen B7 stress-undo-redo, scenario A1/A2): undo van
        // C2 verwijderde óók de eerder aangebrachte stempel op C1. `beginUndoable` legt de staat
        // VÓÓR de stempel vast, zodat een undo van DEZE actie de stempel weer verwijdert (poolkopie
        // blijft staan — bewust, zie docs/library.md "Bekende kleine punten"), maar een LATERE
        // ongerelateerde undo 'm niet meer kan meesleuren.
        runtime.beginUndoable(s);
        // GO-NA-FIX 3 (critreview 9f9f0aa): een net-gepromoveerd item is byte-identiek aan zijn
        // poolitem — de back-stamp krijgt daarom meteen de hash VAN DAT POOLITEM mee, anders
        // classificeert het projectitem in latere taken als 'deviated' (spurieuze afwijkingsvraag).
        const poolCal = bumped.calendars.find((c) => c.id === id)!;
        src.libraryOrigin = makeOrigin(bumped, id, computeCalendarHash(poolCal));
        // De gedenormaliseerde projectkalender-cache (`s.calendar`) moet de zojuist gestempelde
        // bibliotheek-entry weerspiegelen (§9.1); anders schrijft de writer (leest uit `s.calendar`)
        // de herkomst NIET weg als de PROJECTDEFAULT-kalender werd gepromoveerd → functieverlies bij
        // herladen (geen bijwerken, dedup stuk). Onvoorwaardelijk & goedkoop (spiegel updateCalendar).
        syncProjectCalendar(s);
        runtime.finishMutation(s);
      }
      newId = id;
    });
    persist(get);
    // F4 (vloot-fixpakket, issue #19): promote valt onder hetzelfde pool-bump-regime als
    // updatePoolCalendar/removePoolCalendar — voor bestaande kopieën is dit een no-op behalve de
    // onvoorwaardelijke redo-history-wis (er is nooit een 'behind'-item van het NET-gepromoveerde item,
    // dat is per definitie in-sync met de pool die het zelf net gevoed heeft).
    get().refreshAllDocumentsFromPool(companyId);
    return newId;
  },

  promoteResourceToPool: (companyId, resource, opts) => {
    let newId: string | null = null;
    // Dedup op naam (issue #19, punt D5 — "naar de bibliotheek tillen" vanaf een projecteigen rij in
    // de Resources-tab) — UITSLUITEND bij `opts.dedupByName: true` (de Resources-tab-rijactie): heeft
    // de pool al een UNIEKE genormaliseerde-naam-match (zelfde matcher als de herkenningsstap, spec
    // §5.1/`matchByName`), dan wordt er GEEN duplicaat-poolitem gepusht — het bronprojectitem koppelt
    // in plaats daarvan aan het bestaande poolitem ("bestond al, gekoppeld"). Ambigu (0 of >1
    // kandidaten) ⇒ gewoon een nieuw poolitem. Zonder de vlag (elke andere/bestaande aanroeper, incl.
    // de herkenningsstap-test die bewust twee gelijknamige poolitems opzet) blijft het gedrag exact
    // zoals voorheen: altijd een nieuw poolitem, nooit stilzwijgend koppelen.
    const existingPool = opts?.dedupByName ? get().pools[companyId] : undefined;
    const existingMatch = existingPool ? matchByName(resource.name, existingPool.resources) : null;
    if (existingMatch) {
      // F10 (critreview op 352bb94): boolean-vlag i.p.v. een Immer-draft-referentie vasthouden buiten
      // de producer (`s.resources[idx]` is na `set()` een gerevoked proxy — nooit bewaren/uitlezen).
      let linked = false;
      set((s) => {
        const idx = s.resources.findIndex((r) => r.id === resource.id);
        if (idx < 0 || s.resources[idx].libraryOrigin) return; // onbekend, of al gestempeld: no-op.
        runtime.beginUndoable(s);
        const pool = s.pools[companyId];
        s.resources[idx].libraryOrigin = makeOrigin(pool, existingMatch.id, computeResourceHash(existingMatch));
        runtime.finishMutation(s);
        linked = true;
      });
      if (linked) get().recomputeViewRows();
      // F8 (critreview op 352bb94): de no-op-tak (onbekend bronitem, of al gestempeld) mag NIET
      // `existingMatch.id` teruggeven alsof er iets gebeurde — dat zou de aanroeper (de "bestond
      // al"-notice) laten liegen over een koppeling die niet plaatsvond.
      return linked ? existingMatch.id : null;
    }
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      const id = generateId('res');
      const { libraryOrigin: _drop, parentId: _p, ...rest } = resource;
      // Een gepromoveerde resource verwijst niet naar een project-lokale kalender-id.
      pool.resources.push({ ...structuredClone(rest), id, calendarId: undefined });
      const bumped = bumpPool(pool);
      s.pools[companyId] = bumped;
      // Terug-stempel op het BRON-projectitem (indien aanwezig) met de zojuist gebumpte versie.
      const src = s.resources.find((r) => r.id === resource.id);
      if (src) {
        // Fix B4: undo-beschermde projectstempel-mutatie — zie de uitgebreide toelichting bij
        // promoteCalendarToPool hierboven (identiek patroon, resource-variant).
        runtime.beginUndoable(s);
        // GO-NA-FIX 3 (critreview 9f9f0aa): zelfde toelichting als promoteCalendarToPool hierboven.
        const poolRes = bumped.resources.find((r) => r.id === id)!;
        src.libraryOrigin = makeOrigin(bumped, id, computeResourceHash(poolRes));
        runtime.finishMutation(s);
      }
      newId = id;
    });
    persist(get);
    // Naamloze metadata-wijziging (herkomststempel) raakt geen histogram, wél eventueel de tabel.
    get().recomputeViewRows();
    // F4 (vloot-fixpakket, issue #19): zelfde pool-bump-regime als promoteCalendarToPool hierboven.
    get().refreshAllDocumentsFromPool(companyId);
    return newId;
  },

  updatePoolCalendar: (companyId, calendarId, updates) => {
    set((s) => {
      const pool = s.pools[companyId];
      const idx = pool?.calendars.findIndex(c => c.id === calendarId) ?? -1;
      if (!pool || idx < 0) return;
      Object.assign(pool.calendars[idx], updates);
      s.pools[companyId] = bumpPool(pool);
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  updatePoolResource: (companyId, resourceId, updates) => {
    set((s) => {
      const pool = s.pools[companyId];
      const idx = pool?.resources.findIndex(r => r.id === resourceId) ?? -1;
      if (!pool || idx < 0) return;
      Object.assign(pool.resources[idx], updates);
      s.pools[companyId] = bumpPool(pool);
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  removePoolCalendar: (companyId, calendarId) => {
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      pool.calendars = pool.calendars.filter(c => c.id !== calendarId);
      s.pools[companyId] = bumpPool(pool);
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  removePoolResource: (companyId, resourceId) => {
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      pool.resources = pool.resources.filter(r => r.id !== resourceId);
      // F7 (critreview op 352bb94): spiegelt resourceSlice.removeResource — leden van een verwijderde
      // ploeg (CREW) vallen terug op geen ouder, anders houdt de pool een dangling parentId over.
      for (const r of pool.resources) {
        if (r.parentId === resourceId) r.parentId = undefined;
      }
      s.pools[companyId] = bumpPool(pool);
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  addPoolResource: (companyId, resource) => {
    let newId: string | null = null;
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      const id = generateId('res');
      const { libraryOrigin: _o, parentId: _p, calendarId: _c, ...rest } = resource as import('@/types/resource').Resource;
      // #21 (B7): nieuwe bibliotheekresource krijgt automatisch de eerste vrije paletkleur
      // (tenzij de aanroeper er een meegaf). Promoties vanuit het project doen dat bewust NIET —
      // die kunnen al een gekozen kleur dragen.
      const color = rest.color ?? nextFreePaletteColor(pool.resources);
      pool.resources.push({ ...structuredClone(rest), id, color });
      s.pools[companyId] = bumpPool(pool);
      newId = id;
    });
    persist(get);
    return newId;
  },
  addPoolCalendar: (companyId, calendar) => {
    let newId: string | null = null;
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      const id = generateId('cal');
      const { libraryOrigin: _o, ...rest } = calendar as import('@/types/calendar').WorkCalendar;
      pool.calendars.push({ ...structuredClone(rest), id });
      s.pools[companyId] = bumpPool(pool);
      newId = id;
    });
    persist(get);
    return newId;
  },

  bindProjectToCompany: (companyId) => {
    set((s) => {
      const company = s.companies.find(c => c.id === companyId);
      if (!company) return;
      const previous = s.project.companyId;
      // Omkoppelen (spec §5, GO-NA-fix 1): alleen de strip-tak is een gebruikersgebaar dat undo-bare
      // dataverlies veroorzaakt (stempels verdwijnen) — die krijgt een undo-snapshot. Een pure
      // (her)bind naar hetzelfde bedrijf (of de EERSTE bind vanuit ongebonden) strip niets en mag dus
      // GEEN loze undo-stap opleveren.
      const isRebind = !!previous && previous !== companyId;
      if (isRebind) runtime.beginUndoable(s);
      s.project.companyId = company.id;
      s.project.companyName = company.name;
      s.project.modifiedAt = new Date().toISOString();
      // Omkoppelen (spec §5): stempels van het VORIGE bedrijf zijn nu vreemd — strip ze zodat de
      // herkenningsstap schoon herbegint. Matches worden daarna opnieuw voorgesteld/gelinkt.
      if (isRebind) {
        s.resources = s.resources.map((r) => r.libraryOrigin?.companyId === previous ? (() => { const { libraryOrigin: _d, ...rest } = r; return rest; })() : r);
        s.calendars = s.calendars.map((c) => c.libraryOrigin?.companyId === previous ? (() => { const { libraryOrigin: _d, ...rest } = c; return rest; })() : c);
        s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
      }
      // isDirty blijft onvoorwaardelijk (élke bind is een wijziging); scheduleStale blijft ongemoeid
      // (strippen van een stempel raakt geen kalenderWAARDEN, dus geen datumimpact).
      runtime.finishMutation(s);
    });
  },

  addLibraryCalendarToProject: (companyId, poolCalendarId) => {
    // Plan-eis 9: materialiseren gebeurt UITSLUITEND op een project dat al aan dit bedrijf gekoppeld
    // is. Het oude sticky-autobind ("bind een ongebonden project stil") bestaat niet meer — de UI
    // (Bedrijfsweergave) toont materialiseren alleen voor een gekoppeld project. Anders: no-op + warn.
    if (get().project.companyId !== companyId) {
      appLog.emit('warn', 'library', `materialisatie genegeerd: actief project niet aan bedrijf ${companyId} gekoppeld (project=${get().project.companyId ?? 'geen'})`);
      return { added: false, calendarId: null };
    }
    let result: { added: boolean; calendarId: string | null } = { added: false, calendarId: null };
    set((s) => {
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      // De copy-helper doet `structuredClone` op de bron-pool-items; een Immer-draft-proxy is niet
      // kloonbaar (DataCloneError). `current()` levert een gewone snapshot van de (ongemuteerde) pool.
      const pool = current(draftPool);
      const copy = copyCalendarToProject(pool, poolCalendarId, s.calendars, generateId);
      if (!copy) return;
      if (copy.reused) {
        // Hergebruik = geen mutatie ⇒ vóór beginUndoable terugkeren, geen loze undo-stap.
        result = { added: false, calendarId: copy.calendar.id };
        return;
      }
      runtime.beginUndoable(s);
      s.calendars = [...s.calendars, copy.calendar];
      s.isDirty = true;
      result = { added: true, calendarId: copy.calendar.id };
      runtime.finishMutation(s);
    });
    // Pure kalender-mutatie → histogram verversen (spiegel resourceSlice.addCalendar:224-225).
    get().recomputeResourceLoad();
    return result;
  },

  addLibraryResourceToProject: (companyId, poolResourceId) => {
    // Plan-eis 9: materialiseren gebeurt UITSLUITEND op een project dat al aan dit bedrijf gekoppeld
    // is. Het oude sticky-autobind ("bind een ongebonden project stil") bestaat niet meer — de UI
    // (Bedrijfsweergave) toont materialiseren alleen voor een gekoppeld project. Anders: no-op + warn.
    if (get().project.companyId !== companyId) {
      appLog.emit('warn', 'library', `materialisatie genegeerd: actief project niet aan bedrijf ${companyId} gekoppeld (project=${get().project.companyId ?? 'geen'})`);
      return { added: false, resourceId: null };
    }
    let result: { added: boolean; resourceId: string | null } = { added: false, resourceId: null };
    set((s) => {
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      // Zie addLibraryCalendarToProject: snapshot de draft-pool voordat de copy-helper 'm kloont.
      const pool = current(draftPool);
      const copy = copyResourceToProject(pool, poolResourceId, s.resources, s.calendars, generateId);
      if (!copy) return;
      if (copy.reused) {
        // Hergebruik = geen mutatie ⇒ vóór beginUndoable terugkeren, geen loze undo-stap.
        // (Bij reused levert copyResourceToProject nooit een travelingCalendar, dus niets te doen.)
        result = { added: false, resourceId: copy.resource.id };
        return;
      }
      runtime.beginUndoable(s);
      // Meereizende kalender toevoegen als hij vers is (dedup gaf `reused: true` ⇒ al aanwezig).
      if (copy.travelingCalendar && !copy.travelingCalendar.reused) {
        s.calendars = [...s.calendars, copy.travelingCalendar.calendar];
      }
      s.resources = [...s.resources, copy.resource];
      result = { added: true, resourceId: copy.resource.id };
      runtime.finishMutation(s);
    });
    // Pure resource-mutatie → histogram + rijen verversen (spiegel resourceSlice.addResource:61-64).
    get().recomputeResourceLoad();
    get().recomputeViewRows();
    return result;
  },

  diffProjectCalendar: (calendarId) => {
    const s = get();
    const cal = s.calendars.find(c => c.id === calendarId);
    const companyId = cal?.libraryOrigin?.companyId;
    const pool = companyId ? s.pools[companyId] : undefined;
    if (!cal || !cal.libraryOrigin || !pool) return null;
    return diffCalendarVsPool(cal, pool);
  },

  diffProjectResource: (resourceId) => {
    const s = get();
    const res = s.resources.find(r => r.id === resourceId);
    const companyId = res?.libraryOrigin?.companyId;
    const pool = companyId ? s.pools[companyId] : undefined;
    if (!res || !res.libraryOrigin || !pool) return null;
    return diffResourceVsPool(res, pool);
  },

  updateProjectCalendarFromLibrary: (calendarId) => {
    set((s) => {
      const idx = s.calendars.findIndex(c => c.id === calendarId);
      const cal = idx >= 0 ? s.calendars[idx] : undefined;
      const companyId = cal?.libraryOrigin?.companyId;
      const draftPool = companyId ? s.pools[companyId] : undefined;
      if (!cal || !cal.libraryOrigin || !draftPool) return;
      // Draft-snapshots: applyCalendarUpdate doet structuredClone op de pool-bron; een Immer-draft-proxy
      // is niet kloonbaar (DataCloneError, zie de add-acties sinds 4a60a5f) → `current()`.
      const pool = current(draftPool);
      const snapCal = current(cal);
      // Alleen écht bijwerken als er iets te bijwerken VALT ('changed') — vóór beginUndoable, geen
      // loze undo-stap bij een no-op: dat geldt niet alleen voor 'removed' (origineel weg) maar ook
      // voor 'up-to-date' (project is al gelijk aan de pool; critreview taak 9).
      if (diffCalendarVsPool(snapCal, pool).status !== 'changed') return;
      runtime.beginUndoable(s);
      s.calendars[idx] = applyCalendarUpdate(snapCal, pool);
      syncProjectCalendar(s); // gedenormaliseerde projectkalender-cache in sync (E-2, §9.1).
      runtime.finishMutation(s, { stale: true }); // kalenderwijziging raakt datums.
    });
    get().recomputeResourceLoad();
  },

  updateProjectResourceFromLibrary: (resourceId) => {
    set((s) => {
      const idx = s.resources.findIndex(r => r.id === resourceId);
      const res = idx >= 0 ? s.resources[idx] : undefined;
      const companyId = res?.libraryOrigin?.companyId;
      const draftPool = companyId ? s.pools[companyId] : undefined;
      if (!res || !res.libraryOrigin || !draftPool) return;
      // Zie updateProjectCalendarFromLibrary: snapshot de draft vóór applyResourceUpdate 'm kloont.
      const pool = current(draftPool);
      const snapRes = current(res);
      // No-op vóór beginUndoable (E-3): alleen 'changed' rechtvaardigt een mutatie — 'removed'
      // (origineel weg) én 'up-to-date' (al gelijk) leveren beide geen undo-stap op (critreview taak 9).
      if (diffResourceVsPool(snapRes, pool).status !== 'changed') return;
      runtime.beginUndoable(s);
      s.resources[idx] = applyResourceUpdate(snapRes, pool);
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (E-2, §4.3).
  },

  exportPoolIFC: (companyId) => {
    const pool = get().pools[companyId];
    return pool ? writePoolIFC(pool) : null;
  },

  replacePool: (companyId, pool) => {
    const state = get();
    const company = state.companies.find(c => c.id === companyId);
    if (!company) return;
    // De geïmporteerde pool krijgt het DOEL-companyId (import in een gekozen bedrijf, spec §4).
    // Eerst normaliseren (fix critreview taak 10): een vorm-invalide pool — bijv. een hand-gemaakt
    // of door een derde tool geproduceerd OPS_Library-bestand zonder resources/calendars — mag na
    // import nooit een TypeError geven op een latere `.push`/`.find` (promote, addLibrary*ToProject).
    const normalized = {
      ...normalizePool(companyId, pool, state.companies),
      companyName: company.name,
    };
    const pools = { ...state.pools, [companyId]: normalized };
    const activation = materializeLibraryBoundary({
      payload: capturePayload(state),
      companies: state.companies,
      pools,
      mode: 'open-boundary',
    });
    set((s) => {
      s.pools[companyId] = normalized;
      hydratePayload(s, activation.payload);
      s.viewRows = [...activation.viewRows];
      s.resourceLoadResult = activation.resourceLoadResult;
      s.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
      s.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
      if (activation.invalidateRedoScope) invalidateDocumentRedo(s, s.activeDocumentId);
    });
    persist(get);
  },

  importPoolAsNewCompany: (pool) => {
    const state = get();
    const name = resolveUniqueCompanyName(pool.companyName ?? '', state.companies.map((c) => c.name));
    // Behoud het companyId uit het bestand ALLEEN als het (a) lokaal nog vrij is, (b) GEEN reserved
    // id is (critreview F1 — DEFAULT_COMPANY_ID/DEMO_COMPANY_ID zijn géén identiteitsbewijs, vrijwel
    // elke installatie deelt ze) en (c) een veilige state-sleutel is (critreview F2 — een vijandig
    // bestand-id als "__proto__" mag nooit als Immer-draft-sleutel eindigen). Anders een vers id,
    // net als bij een naamsbotsing (zie de uitgebreide toelichting bij de interface hierboven).
    const fileId = pool.companyId;
    const canKeepFileId = !!fileId
      && isSafeFileCompanyId(fileId)
      && !isReservedCompanyId(fileId)
      && !state.companies.some((c) => c.id === fileId);
    const id = canKeepFileId ? fileId : generateId('company');
    const company: Company = { id, name };
    const companies = [...state.companies, company];
    // Zelfde defensieve normalisatie als replacePool (vorm-invalide bestand ⇒ geen TypeError op
    // een latere .push/.find in promote/add-acties); companyName wordt daarna overschreven met de
    // (mogelijk gededupliceerde) `name` — normalizePoolShape zou anders het RUWE pool.companyName
    // laten staan.
    const normalized = { ...normalizePoolShape(id, pool, companies), companyName: name };
    const pools = { ...state.pools, [id]: normalized };
    const activation = materializeLibraryBoundary({
      payload: capturePayload(state),
      companies,
      pools,
      mode: 'open-boundary',
    });
    set((s) => {
      s.companies.push(company);
      s.pools[id] = normalized;
      hydratePayload(s, activation.payload);
      s.viewRows = [...activation.viewRows];
      s.resourceLoadResult = activation.resourceLoadResult;
      s.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
      s.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
      if (activation.invalidateRedoScope) invalidateDocumentRedo(s, s.activeDocumentId);
    });
    persist(get);
    // De actie koppelt het actieve project niet automatisch. Alleen een al in het bestand aanwezige
    // binding met hetzelfde, behouden companyId kan hierdoor meteen zijn open-boundary doorlopen.
    return id;
  },

  isLocalPoolNewer: (companyId, imported) => {
    return isPoolNewer(get().pools[companyId], imported);
  },

  refreshBehindItems: (companyId) => {
    const state = get();
    if (state.project.companyId !== companyId) return 0;
    const activation = materializeLibraryBoundary({
      payload: capturePayload(state),
      companies: state.companies,
      pools: state.pools,
      mode: 'silent-switch',
    });
    const changed = activation.signals.refreshed;
    if (changed === 0) return 0;
    set((s) => {
      hydratePayload(s, activation.payload);
      s.viewRows = [...activation.viewRows];
      s.resourceLoadResult = activation.resourceLoadResult;
      if (activation.invalidateRedoScope) invalidateDocumentRedo(s, s.activeDocumentId);
    });
    return changed;
  },

  refreshAllDocumentsFromPool: (companyId) => {
    let changed = 0;
    set((s) => {
      if (!s.companies.some((c) => c.id === companyId)) return;
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      const pool = current(draftPool);

      // Behind-only (review-fix): alleen items waarvan het BESTAND ongewijzigd is (file == syncedHash)
      // maar de pool wijkt af. 'deviated' blijft staan. Review-fix (critreview 71762fd, GO-NA 2/3):
      // per-BESTEMMING tellers (niet gedeeld tussen het actieve document en elke slapende payload) —
      // zo wijzen we `s.calendars`/`s.resources`/`doc.payload.*` alleen opnieuw toe, wissen we de
      // botsende redo-history en zetten we scheduleStale alleen als er in DIE ENE bestemming ook echt iets
      // ververst is. Geen identiteitschurn bij nul treffers, geen te-brede redo-wis over slapende
      // documenten die deze pool-edit niet raakten.
      const refreshCalendars = (
        cals: import('@/types/calendar').WorkCalendar[],
      ): { items: import('@/types/calendar').WorkCalendar[]; calChanged: number } => {
        let calChanged = 0;
        const items = cals.map((cal) => {
          if (cal.libraryOrigin?.companyId !== companyId) return cal;
          if (classifyCalendarOnOpen(cal, pool) !== 'behind') return cal;
          calChanged++;
          return applyCalendarUpdate(cal, pool);
        });
        return { items, calChanged };
      };
      const refreshResources = (
        ress: import('@/types/resource').Resource[],
      ): { items: import('@/types/resource').Resource[]; resChanged: number } => {
        let resChanged = 0;
        const items = ress.map((res) => {
          if (res.libraryOrigin?.companyId !== companyId) return res;
          if (classifyResourceOnOpen(res, pool) !== 'behind') return res;
          resChanged++;
          return applyResourceUpdate(res, pool);
        });
        return { items, resChanged };
      };

      // Actief document (top-level) — alleen als het aan dit bedrijf gekoppeld is.
      if (s.project.companyId === companyId) {
        const cals = refreshCalendars(s.calendars.map((c) => current(c)));
        const ress = refreshResources(s.resources.map((r) => current(r)));
        const docChanged = cals.calChanged + ress.resChanged;
        // F4 (vloot-fixpakket, issue #19): de redo-history-wis is ONVOORWAARDELIJK voor elk document dat
        // aan DIT bedrijf gebonden is, losgekoppeld van `docChanged` — een pool-bump (elke mutatie die
        // hier binnenkomt via updatePool*/removePool*/promote*) mag een "opnieuw" op dit document nooit
        // meer laten terugzetten naar een toestand van vóór de bump, ook als er toevallig nul 'behind'-
        // items waren (bv. alle kopieën waren al 'deviated', of raakten alleen niet-gevolgde velden).
        // De array-toewijzingen/scheduleStale/recomputes blijven wél achter hun tellers (geen
        // identiteitschurn bij nul treffers).
        invalidateDocumentRedo(s, s.activeDocumentId);
        if (docChanged > 0) {
          if (cals.calChanged > 0) s.calendars = cals.items;
          if (ress.resChanged > 0) s.resources = ress.items;
          s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
          if (cals.calChanged > 0) markScheduleStale(s); // kalenderwijziging raakt datums (geen isDirty, geen runCPM)
          changed += docChanged;
        }
      }

      // Slapende payloads (plan-eis 1): muteer binnen dezelfde set(); herrekening pas bij activering.
      for (const doc of s.documents) {
        if (!doc.payload) continue; // actief document heeft payload===null.
        // Lokale const ná de null-guard: TS narrowt `doc.payload` niet door de `.find()`-callback
        // hieronder heen (property-narrowing overleeft geen geneste closure), een losse const wel.
        const payload = doc.payload;
        if (payload.project.companyId !== companyId) continue;
        const cals = refreshCalendars(payload.calendars.map((c) => current(c)));
        const ress = refreshResources(payload.resources.map((r) => current(r)));
        const docChanged = cals.calChanged + ress.resChanged;
        // F4: zelfde onvoorwaardelijke redo-wis-garantie voor elke SLAPENDE payload die aan dit
        // bedrijf gebonden is (zie toelichting bij de actieve-documenttak hierboven).
        invalidateDocumentRedo(s, doc.id);
        if (docChanged > 0) {
          if (cals.calChanged > 0) {
            payload.calendars = cals.items;
            // F1 (vloot-fixpakket, issue #19): de gedenormaliseerde projectkalender-cache van deze
            // SLAPENDE payload meesyncen met de zojuist ververste `calendars` — zonder dit blijft
            // `payload.calendar` de OUDE (mogelijk stale) waarde dragen terwijl de auto-save die
            // cache rechtstreeks serialiseert (geen hydrate), wat verkeerde uren in de recovery-IFC
            // oplevert. Alleen binnen deze tak (calendars daadwerkelijk gewijzigd).
            payload.calendar = payload.calendars.find((c) => c.id === payload.project.calendarId) ?? payload.calendar;
          }
          if (ress.resChanged > 0) payload.resources = ress.items;
          if (cals.calChanged > 0) markScheduleStale(payload); // zichtbaar bij switchDocument/activering
          changed += docChanged;
        }
      }
    });
    if (changed > 0) {
      get().recomputeResourceLoad();
      get().recomputeViewRows();
    }
    return changed;
  },

  onOpenStatusForResource: (resourceId) => {
    const s = get();
    const res = s.resources.find((r) => r.id === resourceId);
    const companyId = res?.libraryOrigin?.companyId;
    // §2-scope: alleen eigen-bedrijf-stempels van een lokaal bestaand bedrijf.
    if (!res || !companyId || companyId !== s.project.companyId || !s.companies.some((c) => c.id === companyId)) return null;
    const pool = s.pools[companyId];
    return pool ? classifyResourceOnOpen(res, pool) : null;
  },
  onOpenStatusForCalendar: (calendarId) => {
    const s = get();
    const cal = s.calendars.find((c) => c.id === calendarId);
    const companyId = cal?.libraryOrigin?.companyId;
    if (!cal || !companyId || companyId !== s.project.companyId || !s.companies.some((c) => c.id === companyId)) return null;
    const pool = s.pools[companyId];
    return pool ? classifyCalendarOnOpen(cal, pool) : null;
  },

  computeRecognition: () => {
    const s = get();
    const companyId = s.project.companyId;
    if (!companyId || !s.companies.some((c) => c.id === companyId)) return [];
    const pool = s.pools[companyId];
    if (!pool) return [];
    const out: RecognitionCandidate[] = [];
    for (const r of s.resources) {
      // F3 (vloot-fixpakket, issue #19): herkenning is UITSLUITEND voor stempel-loze items — een item
      // met een stempel van een ANDER bedrijf (bijv. ná omkoppelen-zonder-undo, of een undo die de
      // strip-tak ongedaan maakte terwijl het project inmiddels aan B gekoppeld is) hoort hier niet
      // als kandidaat te verschijnen. Voorheen skipte dit alleen EIGEN-bedrijfsstempels.
      if (r.libraryOrigin) continue;
      const m = matchByName(r.name, pool.resources);
      out.push({ kind: 'resource', projectId: r.id, projectName: r.name, suggestedPoolId: m?.id ?? null, suggestedPoolName: m?.name ?? null });
    }
    for (const c of s.calendars) {
      if (c.libraryOrigin) continue;
      const m = matchByName(c.name, pool.calendars);
      out.push({ kind: 'calendar', projectId: c.id, projectName: c.name, suggestedPoolId: m?.id ?? null, suggestedPoolName: m?.name ?? null });
    }
    return out;
  },

  linkRecognizedItems: (links) => {
    set((s) => {
      const companyId = s.project.companyId;
      if (!companyId) return;
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      const pool = current(draftPool);
      // GO-NA-fix 3: een verdwenen kandidaat (poolId niet meer in de pool — bv. een race met
      // removePoolResource/removePoolCalendar) mag niet knallen; stille pre-scan zodat we (a) een
      // link zonder geldig poolitem straks stil overslaan én (b) GEEN undo-snapshot pushen als er
      // over de hele linkset niets toepasbaars overblijft (geen loze undo-stap, GO-NA-fix 1).
      const anyApplicable = links.some((link) => link.kind === 'resource'
        ? pool.resources.some((r) => r.id === link.poolId)
        : pool.calendars.some((c) => c.id === link.poolId));
      if (!anyApplicable) return;
      // GO-NA-fix 1: dit is een expliciet gebruikersgebaar — undoable, met de gebruikelijke
      // slice-conventie (beginUndoable vóór, finishMutation ná de mutatie).
      runtime.beginUndoable(s);
      let calendarLinked = false;
      // Plan-eis 5: alles in één set() — atomisch, geen half-gestempelde tussentoestand.
      for (const link of links) {
        if (link.kind === 'resource') {
          if (!pool.resources.some((r) => r.id === link.poolId)) continue; // GO-NA-fix 3: verdwenen kandidaat ⇒ stille skip
          const idx = s.resources.findIndex((r) => r.id === link.projectId);
          if (idx < 0) continue;
          const stamped = { ...current(s.resources[idx]), libraryOrigin: makeOrigin(pool, link.poolId) };
          s.resources[idx] = applyResourceUpdate(stamped, pool); // stempelt + ververst + zet syncedHash
        } else {
          if (!pool.calendars.some((c) => c.id === link.poolId)) continue; // GO-NA-fix 3: verdwenen kandidaat ⇒ stille skip
          const idx = s.calendars.findIndex((c) => c.id === link.projectId);
          if (idx < 0) continue;
          const stamped = { ...current(s.calendars[idx]), libraryOrigin: makeOrigin(pool, link.poolId) };
          s.calendars[idx] = applyCalendarUpdate(stamped, pool);
          calendarLinked = true;
        }
      }
      s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
      // GO-NA-fix 2: een gelinkte kalender raakt datums ⇒ scheduleStale (patroon updateProjectCalendarFromLibrary).
      runtime.finishMutation(s, { stale: calendarLinked });
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  unbindProject: () => {
    set((s) => {
      // GO-NA-fix 1: een al-los project (geen binding, dus per invariant ook geen stempels) is een
      // no-op — geen loze undo-stap.
      if (!s.project.companyId) return;
      runtime.beginUndoable(s);
      s.project.companyId = undefined;
      s.project.companyName = undefined;
      s.resources = s.resources.map((r) => { const { libraryOrigin: _d, ...rest } = r; return rest; });
      s.calendars = s.calendars.map((c) => { const { libraryOrigin: _d, ...rest } = c; return rest; });
      s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? { ...s.calendar };
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  resolveDeviation: (ref, choice) => {
    const companyId = get().project.companyId;
    if (!companyId) return;
    if (choice === 'company') {
      // Neem poolwaarde over: gerichte niet-undoable verversing van dit ene item.
      set((s) => {
        const draftPool = s.pools[companyId];
        if (!draftPool) return;
        const pool = current(draftPool);
        if (ref.kind === 'resource') {
          const idx = s.resources.findIndex((r) => r.id === ref.projectId);
          if (idx < 0 || diffResourceVsPool(current(s.resources[idx]), pool).status !== 'changed') return;
          s.resources[idx] = applyResourceUpdate(current(s.resources[idx]), pool);
        } else {
          const idx = s.calendars.findIndex((c) => c.id === ref.projectId);
          if (idx < 0 || diffCalendarVsPool(current(s.calendars[idx]), pool).status !== 'changed') return;
          s.calendars[idx] = applyCalendarUpdate(current(s.calendars[idx]), pool);
          s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
          // Review-fix (spec §3): kalenderwaarden gewijzigd ⇒ scheduleStale (geen isDirty, geen runCPM).
          markScheduleStale(s);
        }
        invalidateDocumentRedo(s, s.activeDocumentId);
      });
      get().recomputeResourceLoad();
      get().recomputeViewRows();
      return;
    }
    // choice === 'file': schrijf de BESTANDSwaarde naar het poolitem (bump), zet de verse syncedHash op
    // het net-geopende item, en ververs de siblings (plan-eis 4: geen dubbele verversing van dit item).
    set((s) => {
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      if (ref.kind === 'resource') {
        // findIndex + current(s.resources[idx]) (bewezen patroon elders in dit bestand, zie
        // resolveDeviation('company')/linkRecognizedItems) — current() op het RESULTAAT van
        // .find() zelf faalt onder Immer ("expects a draft"), dus altijd via de index.
        const rIdx = s.resources.findIndex((r) => r.id === ref.projectId);
        if (rIdx < 0) return;
        const item = current(s.resources[rIdx]);
        const libId = item.libraryOrigin?.libraryItemId;
        const pIdx = libId ? draftPool.resources.findIndex((r) => r.id === libId) : -1;
        if (pIdx < 0) return;
        // Overschrijf de gevolgde velden van het poolitem met de bestandswaarden.
        for (const f of RESOURCE_DIFF_FIELDS_LOCAL) (draftPool.resources[pIdx] as unknown as Record<string, unknown>)[f] = (item as unknown as Record<string, unknown>)[f];
        // Bewezen patroon (zie promoteResourceToPool hierboven): werk verder met de PLAIN
        // `bumped`-return-waarde, niet met een current()-herlezing van s.pools[companyId] — die
        // combinatie (plain top-level object met nog-proxied nested arrays) laat Immers current()
        // stikken ("expects a draft, got: [object Object]").
        const bumped = bumpPool(draftPool);
        s.pools[companyId] = bumped;
        const newHash = computeResourceHash(bumped.resources[pIdx]);
        s.resources[rIdx] = { ...item, libraryOrigin: makeOrigin(bumped, libId!, newHash) };
      } else {
        const cIdx = s.calendars.findIndex((c) => c.id === ref.projectId);
        if (cIdx < 0) return;
        const item = current(s.calendars[cIdx]);
        const libId = item.libraryOrigin?.libraryItemId;
        const pIdx = libId ? draftPool.calendars.findIndex((c) => c.id === libId) : -1;
        if (pIdx < 0) return;
        for (const f of CALENDAR_DIFF_FIELDS_LOCAL) (draftPool.calendars[pIdx] as unknown as Record<string, unknown>)[f] = (item as unknown as Record<string, unknown>)[f];
        const bumped = bumpPool(draftPool);
        s.pools[companyId] = bumped;
        const newHash = computeCalendarHash(bumped.calendars[pIdx]);
        s.calendars[cIdx] = { ...item, libraryOrigin: makeOrigin(bumped, libId!, newHash) };
        s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
      }
      // Niet-undoable (spiegel de 'company'-tak hierboven): wis botsende redo-history expliciet. Zonder dit
      // overleeft een bestaande redo-entry het oplossen van precies één afwijking (de sibling-
      // verversing hieronder wist 'm alleen bij docChanged>0) — "opnieuw" zou dan oude stempels
      // over de zojuist gebumpte pool kunnen terugzetten (GO-NA-fix, critreview 3870ef9).
      invalidateDocumentRedo(s, s.activeDocumentId);
    });
    persist(get);
    // Siblings in alle open/slapende documenten volgen de nieuwe pool (plan-eis 4). Het net-opgeloste
    // item is nu gelijk aan de pool (diff up-to-date) ⇒ refreshAllDocumentsFromPool raakt het niet.
    get().refreshAllDocumentsFromPool(companyId);
  },

  unlinkResourceFromLibrary: (resourceId) => {
    set((s) => {
      const idx = s.resources.findIndex((r) => r.id === resourceId);
      if (idx < 0 || !s.resources[idx].libraryOrigin) return; // onbekend id of al stempel-loos: no-op.
      runtime.beginUndoable(s);
      const calendarId = s.resources[idx].calendarId;
      const { libraryOrigin: _drop, ...rest } = s.resources[idx];
      s.resources[idx] = rest;
      // F4 (critreview op 352bb94): "losmaken" moet ook de MEEGEREISDE kalenderkopie loskoppelen —
      // anders blijft die de pool volgen (bijwerken vanuit bibliotheek, afwijkingsvragen) terwijl de
      // resource zelf al los is, precies wat losmaken hoort te voorkomen. Alleen strippen als geen
      // ENKELE ANDERE, nog gestempelde resource dezelfde kalender gebruikt (anders trek je 'm onder
      // een collega vandaan die 'm nog wél via de bibliotheek wil laten volgen). Zelfde undo-snapshot.
      if (calendarId) {
        const calIdx = s.calendars.findIndex((c) => c.id === calendarId);
        const cal = calIdx >= 0 ? s.calendars[calIdx] : undefined;
        if (cal?.libraryOrigin) {
          const stillFollowed = s.resources.some(
            (r) => r.id !== resourceId && r.calendarId === calendarId && !!r.libraryOrigin,
          );
          if (!stillFollowed) {
            const { libraryOrigin: _calDrop, ...calRest } = cal;
            s.calendars[calIdx] = calRest;
            // Gedenormaliseerde projectkalender-cache meesyncen (§9.1-patroon) als dit de projectdefault was.
            s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
          }
        }
      }
      runtime.finishMutation(s);
    });
    // Puur stempels weg: geen enkel bewaard VELD verandert (naam/type/tarief/eenheid/maxUnits/kalender-
    // INHOUD blijven exact wat ze waren), dus geen datumimpact en geen belasting-/rijenherberekening
    // nodig — anders dan updateResource/removeResource hierboven raakt dit geen CPM- of tabelinvoer.
  },

  applyDistribution: (proposal, scopeTaskIdsByDoc) => {
    const plan = planDistributionWrites(proposal, scopeTaskIdsByDoc);
    if (!plan.ok) return null;

    // Een lopende coalesce-reeks (Gantt-sleep, tikken in een invoerveld) mag deze samengestelde
    // bewerking niet opslokken: `finishUndoable` zou het `after` van dát oudere event bijschrijven
    // in plaats van een eigen event te maken, en dan is er geen event om in het record te zetten.
    runtime.resetUndoCoalescing();

    const state = get();
    const activeWrite = plan.writes.find((w) => w.docId === state.activeDocumentId);
    const sleepingWrites = plan.writes.filter((w) => w.docId !== state.activeDocumentId);

    // Fase 1 — BUITEN de producer: draai elke slapende write in zijn eigen, wegwerpbare scratch-
    // instantie (`runInScratchDocument`). Zolang hier niets geschreven is naar `s.documents`, is de
    // hele actie nog terug te trekken — precies de atomiciteitsgarantie van
    // `recalculateStaleSleepingDocuments`. De scratch-context draait de ECHTE actie (applyLeveling →
    // M10-strip, `finishMutation({ stale: true })`, `runCPM`, meldingen); zijn EIGEN `historyEvents`
    // worden weggegooid — het history-event voor dit document schrijven we hieronder zelf, in de
    // app-globale sessiechronologie waar undo/redo daadwerkelijk uit kiest.
    const sleepingResults: { docId: string; before: DocumentPayload; after: DocumentPayload }[] = [];
    for (const w of sleepingWrites) {
      const entry = state.documents.find((d) => d.id === w.docId);
      if (!entry?.payload) continue; // tussentijds gesloten/geactiveerd — dit document doet niet meer mee.
      // Het ECHTE docId gaat mee de scratch-context in (derde singleton-rand, zie
      // `runInScratchDocument`): `applyLeveling` sleutelt zijn eenmalige M10-melding op
      // `activeDocumentId`, en die gate is app-globale sessie-state. Zonder dit id claimde de
      // scratch-run 'm voor een vreemd document.
      const out = runInScratchDocument(entry.payload, (s) => {
        s.applyLeveling(w.write, { scopeTaskIds: w.scopeTaskIds });
      }, w.docId);
      // Meldingen bubbelen ALTIJD op (spec §5, rand (b)) — ook bij een geslaagde run kan `applyLeveling`
      // een M10-afrondingsmelding of (bij een onverwachte cyclus) een schedule-fout hebben gezet; niets
      // daarvan mag in het onzichtbare kanaal van de scratch-context blijven hangen.
      for (const n of out.notifications) get().notify(n);
      if (!out.ok) {
        // Er is nog NIETS gemuteerd (het actieve document komt pas hierna aan de beurt, en de
        // eerdere scratch-runs schreven alleen naar hun eigen, weggegooide payload) — dus de hele
        // actie stopt hier, zonder halve staat.
        return null;
      }
      sleepingResults.push({ docId: w.docId, before: entry.payload, after: out.payload });
    }

    // Het actieve document (als het meedoet), via het GEWONE pad: `applyLeveling` opent zelf zijn
    // undoable en draait zelf `runCPM` — precies dezelfde actie als een gebruiker zou triggeren.
    // `runCPM` ververst daarna het `after` van datzelfde event (`refreshLatestDocumentDataHistoryAfter`),
    // zodat de doorgerekende datums in dezelfde ene undo-stap zitten. Dat is gewenst.
    let activeEvent: { id: string; sequence: number } | null = null;
    if (activeWrite) {
      // Anker: alles vanaf hier is ván deze aanroep. `nextHistorySequence` loopt door over pruning
      // heen, dus dit is een betrouwbare ondergrens (anders dan een index of een diepte).
      const sequenceBefore = get().nextHistorySequence;
      get().applyLeveling(activeWrite.write, { scopeTaskIds: activeWrite.scopeTaskIds });
      activeEvent = latestDocumentDataEventSince(
        get().historyEvents, activeWrite.docId, sequenceBefore,
      );
    }

    // Fase 2 — ÉÉN producer: de nieuwe slaper-payloads terugschrijven ÉN per slaper het history-event
    // registreren dat "alles terugdraaien" straks moet herkennen. Beide in dezelfde producer, want een
    // payload zonder event zou onterugdraaibaar zijn en een event zonder payload zou een niet-bestaande
    // wijziging beloven. Sla een document over dat intussen gesloten of geactiveerd is
    // (`entry.payload === null`), exact zoals `recalculateStaleSleepingDocuments` dat doet.
    const sleepingEvents = new Map<string, { id: string; sequence: number }>();
    if (sleepingResults.length > 0) {
      set((s) => {
        for (const r of sleepingResults) {
          const entry = s.documents.find((d) => d.id === r.docId);
          if (!entry || entry.payload === null) continue;
          entry.payload = r.after;
          const event = recordSessionHistoryDeltas(s, DISTRIBUTION_HISTORY_LABEL, [{
            kind: 'document-data',
            documentId: r.docId,
            before: snapshotOfPayload(r.before),
            after: snapshotOfPayload(r.after),
          }]);
          if (event) sleepingEvents.set(r.docId, { id: event.id, sequence: event.sequence });
        }
      });
    }

    // Bouw het record — alleen voor documenten die daadwerkelijk geschreven zijn (een tussentijds
    // gesloten slaper werd hierboven al overgeslagen; een write die per saldo niets veranderde
    // levert géén event en hoort dus ook niet in een "alles terugdraaien").
    const docs: DistributionApplyRecord['docs'] = [];
    if (activeWrite && activeEvent) {
      const docResult = proposal.docs.find((d) => d.docId === activeWrite.docId);
      if (docResult) {
        docs.push({
          docId: activeWrite.docId, title: docResult.title,
          historyEventId: activeEvent.id, historySequence: activeEvent.sequence,
        });
      }
    }
    for (const r of sleepingResults) {
      const event = sleepingEvents.get(r.docId);
      const docResult = proposal.docs.find((d) => d.docId === r.docId);
      if (!event || !docResult) continue;
      docs.push({
        docId: r.docId, title: docResult.title,
        historyEventId: event.id, historySequence: event.sequence,
      });
    }
    if (docs.length === 0) return null;

    return { libraryItemId: proposal.libraryItemId, appliedAt: new Date().toISOString(), docs };
  },

  undoDistribution: (record) => {
    const state = get();
    const undoneDocIds: string[] = [];
    const skippedDocIds: string[] = [];

    const activeEntry = record.docs.find((d) => d.docId === state.activeDocumentId);
    const sleepingEntries = record.docs.filter((d) => d.docId !== state.activeDocumentId);

    // Fase 1 — PUUR bepalen wie er terug mag. Per document geldt de poort van
    // `distributionUndoTarget`: het event bestaat nog, staat op `applied`, en is het event dat een
    // gewone Ctrl+Z in dát document NU zou kiezen. Is dat niet zo, dan heeft de gebruiker er
    // intussen in gewerkt (of is het document gesloten — `removeSessionHistoryForDocument` haalt de
    // events dan weg) en zou terugdraaien de VERKEERDE stap ongedaan maken.
    const restores: { docId: string; before: Snapshot; eventId: string }[] = [];
    for (const d of sleepingEntries) {
      const entry = state.documents.find((x) => x.id === d.docId);
      const event = distributionUndoTarget(state.historyEvents, d.docId, d.historyEventId);
      const delta = event?.deltas.find((x) => x.kind === 'document-data' && x.documentId === d.docId);
      if (!entry?.payload || !event || delta?.kind !== 'document-data') {
        skippedDocIds.push(d.docId);
        continue;
      }
      restores.push({ docId: d.docId, before: delta.before, eventId: event.id });
    }

    // Het actieve document, via het gewone `undo()`-pad — dat kiest per constructie precies dit
    // event zodra de poort hierboven slaagt.
    if (activeEntry) {
      if (distributionUndoTarget(state.historyEvents, activeEntry.docId, activeEntry.historyEventId)) {
        get().undo();
        undoneDocIds.push(activeEntry.docId);
      } else {
        skippedDocIds.push(activeEntry.docId);
      }
    }

    // Fase 2 — ÉÉN producer: de `before`-snapshot terug in de slapende payload, en het event op
    // `undone`. Een slaper heeft geen live state om `restoreSnapshot` op te draaien, dus de snapshot
    // wordt over de payload gespreid; hij komt uit `snapshotOfPayload` van diezelfde payloadvorm, dus
    // er valt niets te migreren en `project.calendarId`/`calendars`/`calendar` blijven onderling
    // consistent. `resourceLoadResult: null` omdat `switchDocument` bij activering tóch
    // onvoorwaardelijk `recomputeResourceLoad()` draait (en viewRows daar afleidt); `isDirty: true`
    // spiegelt `restoreSnapshot` op het actieve pad. Redo loopt daarna over het gewone `redo()`-pad
    // zodra de gebruiker dat document activeert: het event staat dan als enige op `undone`.
    const restoredDocIds: string[] = [];
    if (restores.length > 0) {
      set((s) => {
        for (const r of restores) {
          const entry = s.documents.find((x) => x.id === r.docId);
          const stored = s.historyEvents.find((e) => e.id === r.eventId);
          if (!entry || entry.payload === null || !stored || stored.state !== 'applied') continue;
          entry.payload = { ...entry.payload, ...r.before, isDirty: true, resourceLoadResult: null };
          stored.state = 'undone';
          restoredDocIds.push(r.docId);
        }
      });
    }
    for (const r of restores) {
      if (restoredDocIds.includes(r.docId)) undoneDocIds.push(r.docId);
      else skippedDocIds.push(r.docId);
    }

    return { undoneDocIds, skippedDocIds };
  },
});
