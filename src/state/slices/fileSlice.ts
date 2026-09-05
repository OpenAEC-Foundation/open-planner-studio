import { notifyTaskTypesUnlocked } from '../taskTypesNotice';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { writeCSV } from '@/services/csv/csvWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { openFileDialog, saveFileDialog, saveToRef, readFromRef, readBytesFromRef, type FileRef, type SaveOutcome } from '@/services/fileAccess';
import { openDialogFilters, binaryExtensions, readFormatForFile, parseOpenedFile, importErrorMessageKey, saveTargetFor, readFormatInput, readIFCWithXerReconstruction, type ExportFormat } from '@/services/formatRegistry';
import { loadRecents, addRecent, removeRecent, type RecentEntry } from '@/services/fileAccess/recentFiles';
import { emitExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import type { AppSliceFactory, NotifyInput, NotificationDetailLine } from './types';
import type { AppState } from '../appStore';
import { isTauri } from '@/utils/platform';
import type { Task } from '@/types/task';
import { activeImportResult, isMultiDocumentImport, type ImportLabels, type ImportResult, type OpenedImport } from '@/services/importTypes';
import { hydratePayload, payloadFromImport, type DocumentPayload } from '../documentContract';
import { materializeLibraryBoundary, prepareLoadedPayload } from '../documentActivation';
import { captureRecordedDates, countShiftedTasks } from '@/engine/scheduler/recordedDates';
import { buildWriteIFCInput, sameIFCSource } from '../ifcSaveInput';
import { fileHasHourData } from '@/services/subdayIo';
import { projectFileBase } from '@/utils/documents';
import { refreshExternalAnchors, type ExternalSourceDoc } from '@/engine/externalLinks';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { detectXerExportLoss, type XerExportLossWarning } from '@/services/xerExportLoss';
import { runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import {
  invalidateUndoneHistoryForScopes,
  removeSessionHistoryForDocumentFromState,
  type HistoryScopeKey, type SessionHistoryEvent,
} from '../sessionHistory';

function invalidateDocumentRedo(
  state: { historyEvents: SessionHistoryEvent[] },
  documentId: string,
): void {
  const scope: HistoryScopeKey = `document:${documentId}`;
  state.historyEvents = invalidateUndoneHistoryForScopes(state.historyEvents, new Set([scope]));
}

/** Een vers, ongewijzigd, leeg document — dan mag de open-actie het hergebruiken
 *  i.p.v. een nieuw tabblad te openen (anders krijg je een leeg eerste tabblad).
 *  Geëxporteerd omdat de MCP-tool `planner_import_schedule` exact hetzelfde laadpatroon
 *  moet volgen (spec §Bestands-tools) — één definitie, geen tweede die kan afdrijven. */
export function isActivePristine(s: AppState): boolean {
  return (
    s.tasks.length === 0 &&
    s.sequences.length === 0 &&
    s.resources.length === 0 &&
    s.filePath === null &&
    !s.isDirty
  );
}

/** De in-app gids achter de ene bestandsbrede XER-openingsmelding. */
export const XER_IMPORT_HELP_ARTICLE_ID = 'gids-xer-import';

/**
 * Vorm één gebruikerszichtbaar verslag uit uitsluitend de feiten die de XER-lezer bestandsbreed
 * bewaart. Deze helper zit nadrukkelijk buiten `applyLoadedProject`: één XER kan twaalf documenten
 * openen, maar is nog steeds één bestandsactie en dus één melding.
 */
export function xerImportNotice(results: readonly ImportResult[]): NotifyInput | undefined {
  const xers = results.flatMap(result => result.xer ? [result.xer] : []);
  const xer = xers[0];
  if (!xer) return undefined;

  // X9 bewaart de file-wide diagnostics precies eenmaal in het immutable bronarchief. De
  // documentviews bevatten daarnaast de werkelijk projectgebonden keuzes (enum- en
  // scheduling-terugvallen). Gebruik het archief zodra het er is, maar blijf ook bruikbaar voor
  // een directe X4b-resultaatview vóórdat die in een archief is gebonden.
  const archive = results.find(result => result.xerSourceArchive)?.xerSourceArchive;
  const fileDiagnostics = archive?.diagnostics.file;
  const report = fileDiagnostics?.importReport ?? xer.report;
  const tableReport = fileDiagnostics?.tableReport ?? xer.tableReport;
  const enumFallbacks = xers.reduce((total, item) => total + item.enumFallbacks.length, 0);
  const scheduleFallbacks = xers.reduce((total, item) => total + item.scheduleOptions.fallbacks.length, 0);
  const calendarIssues = xer.calendarIssues.length;
  const numberIssues = tableReport.issues.filter(issue => /(?:NUMBER|DECIMAL)/.test(issue.code)).length
    + xer.calendarIssues.filter(issue => issue.code === 'XER_CALENDAR_INVALID_PERIOD_HOURS').length;
  const parserIssues = tableReport.issues.length - tableReport.issues
    .filter(issue => /(?:NUMBER|DECIMAL)/.test(issue.code)).length;
  // Deze regel is bewust smaller dan alle overige importdiagnostiek: alleen de P6-
  // schedulingopties die naar een veilige semantische default terugvallen horen onder
  // "unsupported semantics". Resource-/metadatacatalogusissues zijn afzonderlijke
  // bron- of koppelproblemen, geen planningsemantiek, en mogen deze teller niet opblazen.
  const unsupportedSemantics = scheduleFallbacks;
  const detailLines: NotificationDetailLine[] = [
    { messageKey: 'notifications.xerImportProjectsSeen', params: { count: report.projectsSeen } },
  ];
  const addCount = (count: number, messageKey: NotificationDetailLine['messageKey']) => {
    if (count > 0) detailLines.push({ messageKey, params: { count } });
  };

  addCount(report.emptyProjectsSkipped, 'notifications.xerImportEmptyProjectsSkipped');
  addCount(report.baselineProjectsExcluded, 'notifications.xerImportBaselineProjectsExcluded');
  addCount(report.baselinesMaterialized, 'notifications.xerImportBaselinesMaterialized');
  addCount(report.danglingBaselineReferences, 'notifications.xerImportDanglingBaselineReferences');
  if (report.baselineExclusionReverted || report.baselineFallbackReasons.length > 0) {
    detailLines.push({ messageKey: 'notifications.xerImportBaselineFallback' });
  }
  addCount(report.externalLinksPreserved, 'notifications.xerImportExternalLinks');

  // UTF-8 zonder BOM is de standaard. Iedere andere gerapporteerde keuze is een daadwerkelijk
  // detecteerbare bronfeit (BOM of Windows-1252-terugval) en verdient daarom uitleg; we beweren
  // nadrukkelijk niet dat afzonderlijke rijen werden overgeslagen.
  if (tableReport.encoding !== 'utf-8') {
    detailLines.push({
      messageKey: 'notifications.xerImportEncoding',
      params: { encoding: tableReport.encoding },
    });
  }
  addCount(parserIssues, 'notifications.xerImportParserIssues');
  addCount(calendarIssues, 'notifications.xerImportCalendarIssues');
  addCount(numberIssues, 'notifications.xerImportNumberIssues');
  addCount(enumFallbacks, 'notifications.xerImportEnumFallbacks');
  addCount(unsupportedSemantics, 'notifications.xerImportUnsupportedSemantics');

  return {
    severity: 'info',
    messageKey: 'notifications.xerImportOpened',
    params: { count: report.documentsOpened },
    detailLines,
    helpArticleId: XER_IMPORT_HELP_ARTICLE_ID,
  };
}

// `ExportFormat` woont nu in de formatRegistry (T1); hier her-exporteren zodat bestaande
// importeurs (Backstage, via appStore) ongewijzigd blijven werken.
export { type ExportFormat };

/** Resultaat van `exportAs` (K7): bij een cyclische planning wordt de export afgebroken vóór de
 *  opslaan-dialoog en de CPM-cyclusfout (`cpmResult.error`) als boodschap meegegeven, zodat de
 *  aanroeper die kan tonen i.p.v. stilletjes niets te doen. */
export type ExportResult =
  | { ok: true; warnings: readonly XerExportLossWarning[] }
  | { ok: false; error: string };

/** Opties voor `applyLoadedProject` — de één gedeelde "vul de actieve document-state met een
 *  geparsed project"-implementatie (audit P5/F6). Elke variant (de drie open-paden + `loadState`)
 *  dekt zijn historische gedrag af met deze vlaggen; defaults staan bewust op "niets doen". */
export interface ApplyLoadedProjectOpts {
  /** Nieuw bestandspad (string), `null` voor naamloos (voorbeeld/import), of weglaten
   *  (`undefined`) om `filePath` ongemoeid te laten — dat laatste is de loadState-semantiek
   *  (in-place vervangen zonder het pad te raken). De recente-bestandenlijst wordt door de
   *  AANROEPER bijgewerkt (die kent de herbruikbare `FileRef`). */
  filePath?: string | null;
  /** Web-opslaan-doel voor het geladen document. undefined = laat de huidige handle ongemoeid
   *  (loadState-semantiek); null = geen handle (voorbeeld/fallback-web); een handle = FSA-openen. */
  fileHandle?: FileSystemFileHandle | null;
  /** Direct doorrekenen op de geïsoleerde laadpayload, vóór publicatie. */
  recompute?: boolean;
  /** Canvas op het hele project passen (requestFitToProject). Open-paden: true; loadState: false. */
  fit?: boolean;
  /** Uur-data-melding (§6.8) berekenen en zetten. Open-paden: true; loadState: false. */
  hourDataNotice?: boolean;
  /** True = een echt open-pad (openFile/openRecentFile): behoud bedrijfsbinding + stempels en draai
   *  de grens-1-check. False (default) = een volledig-vervangende load (loadState: IFCPanel/MenuBar/
   *  extensie-import): laad LOS — strip companyId/companyName + alle libraryOrigin-stempels (spec §5).
   *  (Crash-herstel loopt NIET door applyLoadedProject maar via `restoreDocuments`, dat de opgeslagen —
   *  dus gekoppelde — staat exact herstelt en de grens-1-check apart draait, Taak 11.) */
  linkedOpen?: boolean;
  /** Optionele view-start die samen met de nieuwe brondata wordt gepubliceerd (IFC-tab). */
  viewStartDate?: string;
}

/** Feitelijke uitkomst van de centrale opennaad; gebruikt door DevBridge en MCP voor eerlijke ids. */
export interface AppliedOpenedImport {
  documentIds: string[];
  activeDocumentId: string;
  reusedActiveTab: boolean;
}

export interface FileSlice {
  /** `labels` — vertaalde teksten die de UI aanlevert omdat de store-laag geen `t(...)` heeft (zie
   *  `ImportLabels`); weglaten geeft de Engelse default. Geldt voor elk laadpad hieronder. */
  openFile: (labels?: ImportLabels) => Promise<void>;
  saveFile: () => Promise<void>;
  /** Bewaar exact het bedoelde document en meld of zijn ongewijzigde snapshot is vastgelegd. */
  saveFileForDocument: (documentId: string) => Promise<boolean>;
  saveFileAs: () => Promise<void>;
  exportAs: (format: ExportFormat) => Promise<ExportResult>;
  /** Exporteer het project + (spec §4) schrijf de gebonden bedrijfs-pool als tweede, LOS bestand
   *  ernaast. Géén embed. No-op op de pool-kant als het project niet aan een bedrijf gebonden is.
   *  Geeft hetzelfde `ExportResult` terug als `exportAs` — inclusief de K7-cyclusguard. */
  exportProjectWithPool: () => Promise<ExportResult>;
  /** App-globale MRU-lijst van recente bestanden (spec §6). Async gehydrateerd bij opstart. */
  recentFiles: RecentEntry[];
  /** Lees de recents uit IndexedDB (met eenmalige localStorage-migratie) in de store. */
  hydrateRecentFiles: () => Promise<void>;
  openRecentFile: (id: string, labels?: ImportLabels) => Promise<void>;
  /** Read-only parse van een bronbestand voor externe koppelingen (fase 2.9, §5.5): geeft de
   *  projectidentiteit + taken terug ZONDER het als document te openen (hergebruikt de bestaande
   *  readers). null bij een leesfout/onbekend formaat/niet-Tauri. */
  parseExternalSource: (filePath: string, labels?: ImportLabels) => Promise<{ projectId: string; projectName: string; filePath: string; tasks: Task[] } | null>;
  /** Ververs alle externe ankers die naar `filePath` verwijzen uit de actuele bron (fase 2.9, §4.5/§5.5).
   *  Parset de bron read-only, herberekent de ankers + `sourceMissing`, en herrekent de planning. */
  refreshExternalAnchorsFrom: (filePath: string, labels?: ImportLabels) => Promise<{ refreshed: number; missing: number } | null>;
  /** Projectbrede ververs-actie ("Ververs externe ankers"): ververs elke gerefereerde bron één keer. */
  refreshAllExternalAnchors: (labels?: ImportLabels) => Promise<{ refreshed: number; missing: number; sources: number }>;
  /** Open een meegeleverd voorbeeldproject uit een IFC-string als NIEUW document
   *  (geen filePath — opslaan wordt opslaan-als; isDirty=false). Werkt in web én
   *  Tauri; het bestand wordt door de aanroeper via fetch('/examples/…') geladen. */
  openExampleFromString: (content: string, name: string, labels?: ImportLabels) => Promise<void>;
  /** Eén gedeelde load-implementatie (audit P5/F6): vul de ACTIEVE document-state met een geparsed
   *  project en voer de opt-afhankelijke nastappen uit (runCPM/fit/uur-melding/extensie-event).
   *  Neemt géén besluit over een nieuw tabblad — dat blijft bij de aanroeper vóór de load.
   *  `loadState` en de drie open-paden lopen hier allemaal doorheen. */
  applyLoadedProject: (parsed: ImportResult, opts: ApplyLoadedProjectOpts) => void;
  /**
   * Centrale open-naad voor één of meer geparste projectpayloads. Alleen XER gebruikt vandaag de
   * meervoudige vorm; de individuele documenten lopen daarna letterlijk door hetzelfde
   * applyLoadedProject-pad als IFC/CSV/MSPDI/MPP/P6XML.
   */
  applyOpenedImport: (parsed: OpenedImport, opts: ApplyLoadedProjectOpts) => AppliedOpenedImport;
}

export const createFileSlice: AppSliceFactory<FileSlice> = (runtime) => (set, get) => {
  // Voeg een geopend/opgeslagen bestand toe aan de recents (elke herbruikbare ref).
  const pushRecent = async (ref: FileRef | null, name: string) => {
    if (!ref) return; // fallback-web: geen herbruikbare ref → niet aan recents (spec §6)
    const list = await addRecent(ref, name);
    set((s) => { s.recentFiles = list; });
  };

  /**
   * Kwam het bestand via de download-terugval binnen in plaats van op de gekozen plek? Zeg dat dan,
   * want anders zoekt de gebruiker zijn bestand op een locatie waar het niet staat. Dit is
   * nadrukkelijk GEEN fout (severity `info`): het opslaan is geslaagd, alleen langs een andere weg.
   * Eén gedeelde helper zodat alle vier de opslaan/exporteer-paden dezelfde melding geven.
   */
  const noticeIfDownloaded = (outcome: SaveOutcome | null) => {
    if (!outcome?.viaDownload) return;
    get().notify({
      severity: 'info',
      messageKey: 'notifications.savedViaDownload',
      params: { name: outcome.name },
      // Bij "project + bibliotheek" vallen twee downloads vlak na elkaar; die horen niet als twee
      // losse toasts de stapel te vullen.
      dedupeKey: 'saved-via-download',
    });
  };

  const saveSourceForDocument = (state: AppState, documentId: string): AppState | DocumentPayload | null => {
    if (state.activeDocumentId === documentId) return state;
    return state.documents.find(document => document.id === documentId)?.payload ?? null;
  };

  const commitSavedDocument = (
    documentId: string,
    savedSource: AppState,
    destination?: { filePath: string; fileHandle: FileSystemFileHandle | null },
  ): boolean => {
    const currentSource = saveSourceForDocument(get(), documentId);
    if (!currentSource) return false;
    const unchanged = sameIFCSource(savedSource, currentSource);
    set((state) => {
      if (state.activeDocumentId === documentId) {
        if (destination) {
          state.filePath = destination.filePath;
          state.fileHandle = destination.fileHandle;
        }
        if (unchanged) state.isDirty = false;
        return;
      }
      const entry = state.documents.find(document => document.id === documentId);
      if (!entry?.payload) return;
      if (destination) {
        entry.payload.filePath = destination.filePath;
        entry.payload.fileHandle = destination.fileHandle;
      }
      if (unchanged) entry.payload.isDirty = false;
    });
    return unchanged;
  };

  const saveActiveDocument = (expectedDocumentId?: string): Promise<boolean> => runProjectFileWrite(async () => {
    const state = get();
    const documentId = state.activeDocumentId;
    if (expectedDocumentId && expectedDocumentId !== documentId) return false;
    const content = writeIFC(buildWriteIFCInput(state));

    try {
      const ref: FileRef | null = state.fileHandle
        ? { kind: 'handle', handle: state.fileHandle }
        : (isTauri() && state.filePath ? { kind: 'path', path: state.filePath } : null);

      if (ref && await saveToRef(ref, content)) {
        return commitSavedDocument(documentId, state);
      }

      const outcome = await saveFileDialog(
        `${projectFileBase(state.project.name)}.ifc`,
        content,
        [{ name: 'IFC Files', extensions: ['ifc'] }],
      );
      if (!outcome) return false;
      const saved = commitSavedDocument(documentId, state, {
        filePath: outcome.ref?.kind === 'path' ? outcome.ref.path : outcome.name,
        fileHandle: outcome.ref?.kind === 'handle' ? outcome.ref.handle : null,
      });
      await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
      return saved;
    } catch (err) {
      console.error('Save failed:', err);
      get().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: (err as Error).message });
      return false;
    }
  });

  return {
    applyLoadedProject: (parsed, opts) => {
      const current = get();
      const filePath = opts.filePath !== undefined ? opts.filePath : current.filePath;
      const payload = payloadFromImport(parsed, filePath);
      payload.view = opts.viewStartDate === undefined
        ? { ...current.view }
        : { ...current.view, viewStartDate: opts.viewStartDate };
      payload.collapsedTaskIds = current.ui.collapsedTaskIds;
      payload.fileHandle = opts.fileHandle !== undefined ? opts.fileHandle : current.fileHandle;
      if (!opts.linkedOpen) {
        payload.project = { ...payload.project, companyId: undefined, companyName: undefined };
        payload.resources = payload.resources.map((resource) => {
          const { libraryOrigin: _discarded, ...rest } = resource;
          return rest;
        });
        payload.calendars = payload.calendars.map((calendar) => {
          const { libraryOrigin: _discarded, ...rest } = calendar;
          return rest;
        });
        payload.calendar = payload.calendars.find(calendar =>
          calendar.id === payload.project.calendarId) ?? payload.calendar;
      }
      const recorded = opts.recompute
        ? captureRecordedDates(payload.tasks, parsed.recordedFields)
        : null;
      const prepared = prepareLoadedPayload(payload, { recompute: !!opts.recompute });
      if (recorded && recorded.total > 0) {
        const shifted = countShiftedTasks(prepared.tasks, recorded.times);
        if (shifted > 0) prepared.recordedDates = { ...recorded, shifted };
      }
      const activation = materializeLibraryBoundary({
        payload: prepared,
        companies: current.companies,
        pools: current.pools,
        mode: opts.linkedOpen ? 'open-boundary' : 'silent-switch',
      });
      set((s) => {
        removeSessionHistoryForDocumentFromState(s, s.activeDocumentId);
        if (activation.invalidateRedoScope) {
          invalidateDocumentRedo(s, s.activeDocumentId);
        }
        hydratePayload(s, activation.payload);
        s.viewRows = [...activation.viewRows];
        s.resourceLoadResult = activation.resourceLoadResult;
        s.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
        s.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
        if (opts.hourDataNotice) {
          s.ui.hourDataNotice = !s.ui.enableHourPlanning && fileHasHourData(s.tasks, [s.calendar, ...s.calendars]);
        }
      });
      // Taaktypes-etappe (spec §7): het bestand draagt taaktypedata terwijl de instelling uit staat
      // ⇒ de werkregel-UI is voor dit document ontsloten; meld dat één keer (met gids-link).
      {
        const st = get();
        if (st.taskTypesVisible && !st.ui.showTaskTypes) notifyTaskTypesUnlocked(st.notify, st.activeDocumentId);
      }
      if (opts.recompute) {
        const cpm = activation.payload.cpmResult;
        if (cpm?.error) {
          get().notify({
            severity: 'error',
            messageKey: 'notifications.scheduleFailed',
            detail: cpm.error,
            dedupeKey: 'cpm-error',
          });
        }
        emitExtensionEvent(HOST_EVENTS.scheduleCalculated, {
          hasError: !!cpm?.error,
          error: cpm?.error ?? null,
          criticalTasks: activation.payload.tasks.filter(task => task.time.isCritical).length,
        });
      }
      if (opts.fit) get().requestFitToProject(); // Issue #16: canvas op het HELE project passen.
      // Relaties die de solver ECHT niet kon meerekenen (eigenaarsbesluit 2026-08-15): een
      // verzameltaak-eindpunt op zich is sinds `expandSummaryRelations` GEEN reden meer om te
      // melden — die relaties rekenen gewoon mee. Wat overblijft is de voorouder-guard (een taak
      // gekoppeld aan zijn eigen (voor)ouder-samenvatting), een lege/kapotte tak, of de
      // MAX_EXPANDED_RELATIONS-klem — stuk voor stuk gevallen waarin de relatie écht geen effect
      // heeft. Rechtstreeks `expandSummaryRelations` aanroepen i.p.v. op `cpmResult.
      // droppedSequenceIds` leunen: de pure expansiefunctie geeft hier hetzelfde antwoord zonder
      // timing-afhankelijkheid van `cpmResult`. Bewust
      // NIET gefilterd uit het document — dat zou logica uit het bronbestand vernietigen bij open +
      // opslaan — maar wel één keer gemeld, want anders merkt niemand die een P6/MSP-plan importeert
      // dat er logica stilvalt.
      const dropped = expandSummaryRelations(parsed.tasks, parsed.sequences).droppedSequenceIds.length;
      if (dropped > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.summaryRelationsDropped',
          params: { total: dropped },
          dedupeKey: 'summary-relations-dropped',
        });
      }
      // T12 (§9/O1, mpp-datumgetrouwheid), HERSCHREVEN door Z16 (etappe "nul afwijkingen"): een
      // `.mpp`-bestand met aantoonbaar onderbroken, genivelleerde of resource-gedreven
      // (nivellering/splits/timephased-vensters) taken. VÓÓR Z16 was dit een excuus voor mogelijk
      // afwijkende datums ("wij rekenen aaneengesloten door") — sinds Z1-Z15 rekent de motor die
      // taken echt door zoals MS Project (zie `CPMSolver.ts`, `mppReader.ts`'s `countScheduleNotes`),
      // dus de melding is nu uitsluitend INFORMATIEF: ze vertelt dát het bestand zulke taken bevat,
      // niet dat de datums onbetrouwbaar zouden zijn. Alleen `readMPP` vult `sourceScheduleNotes`
      // (ander formaat ⇒ `undefined` ⇒ geen melding). Zelfde patroon als `summaryRelationsDropped`
      // hierboven: info, één keer per open, gededupliceerd op dedupeKey. Géén taakveld (§9/O3) —
      // puur een import-tijd-telling voor deze melding.
      const scheduleNotesTotal = parsed.sourceScheduleNotes?.total ?? 0;
      if (scheduleNotesTotal > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.mppSourceScheduleNotes',
          params: { count: scheduleNotesTotal },
          dedupeKey: 'mpp-split-leveled',
        });
      }
      emitExtensionEvent(HOST_EVENTS.projectLoaded, {
        tasks: parsed.tasks.length,
        sequences: parsed.sequences.length,
        resources: parsed.resources.length,
      });
    },

    applyOpenedImport: (parsed, opts) => {
      const results = isMultiDocumentImport(parsed) ? parsed.results : [parsed];
      if (results.length === 0) throw new Error('Openroute ontving geen projectdocumenten');

      const reusedActiveTab = isActivePristine(get());
      const openedDocumentIds: string[] = [];
      for (const result of results) {
        // De eerste payload mag het lege starttabblad hergebruiken; elk volgend project krijgt
        // gegarandeerd een eigen tab. Dit leest de actuele state per iteratie, want de vorige load
        // heeft die state bewust niet-pristine gemaakt.
        if (!isActivePristine(get())) get().newDocument();
        openedDocumentIds.push(get().activeDocumentId);
        // `applyLoadedProject` draait de open-/bibliotheekgrens zelf (materializeLibraryBoundary),
        // dus elk document krijgt hem — geen aparte runOpenBoundary-aanroep meer nodig.
        get().applyLoadedProject(result, opts);
      }

      // X10: de rapportage is bestandsbreed en identiek op iedere XER-resultaatview. Plaats deze
      // pas ná de volledige lus, anders ontstaat er één toast per nieuw document. Andere formats
      // leveren geen `xer`-metadata en houden hun bestaande, stille openpad.
      const notice = xerImportNotice(results);
      if (notice) get().notify(notice);

      const activeIndex = isMultiDocumentImport(parsed) ? parsed.activeDocumentIndex : 0;
      const activeId = openedDocumentIds[activeIndex];
      if (activeId && activeId !== get().activeDocumentId) get().switchDocument(activeId);
      return {
        documentIds: openedDocumentIds,
        activeDocumentId: get().activeDocumentId,
        reusedActiveTab,
      };
    },

    openFile: async (labels) => {
      try {
        const opened = await openFileDialog(openDialogFilters(), { binaryExtensions: binaryExtensions() });
        if (!opened) return;
        const parsed = await parseOpenedFile({ name: opened.name, text: opened.content, bytes: opened.bytes }, labels);

        // Opslagdoel-guard (T8, stap 5a; verbreed T8-spec-review F4; T11: via `canBeSaveTarget` op
        // de registry-entry i.p.v. een `id === 'ifc'`-vergelijking hier). Opslaan schrijft altijd
        // IFC-TEKST, dus élk ANDER bronformaat (csv/xml/mpp — niet uitsluitend binaire formaten)
        // zou bij een naïeve toewijzing zijn eigen bronbestand met IFC-inhoud laten overschrijven
        // door de eerstvolgende Ctrl+S. "Opslaan" wordt dan "opslaan-als". Zelfde vlag als de
        // MCP-kant (`fileTools.ts` leest óók `canBeSaveTarget`).
        const target = saveTargetFor(readFormatForFile(opened.name), opened.ref, opened.name);

        // De centrale naad splitst alleen een expliciete multi-import; enkelvoudige formaten
        // volgen byte-identiek hetzelfde laadpad, inclusief pristine-tab-hergebruik.
        get().applyOpenedImport(parsed, {
          filePath: target.filePath,
          fileHandle: target.fileHandle,
          recompute: true,
          fit: true,
          hourDataNotice: true,
          linkedOpen: true,
        });

        // Recents: elke herbruikbare ref (Tauri-pad óf Chromium-handle) — óók bij een niet-IFC
        // bronformaat: heropenen via recents moet blijven werken, alleen het OPSLAGDOEL wordt niet
        // gezet (zie `target` hierboven).
        await pushRecent(opened.ref, opened.name);
      } catch (err) {
        console.error('Failed to open file:', err);
        get().notify({ severity: 'error', messageKey: importErrorMessageKey(err), detail: (err as Error).message });
      }
    },

    saveFile: async () => { await saveActiveDocument(); },
    saveFileForDocument: (documentId) => saveActiveDocument(documentId),

    saveFileAs: async () => runProjectFileWrite(async () => {
      const state = get();
      const documentId = state.activeDocumentId;
      // Gedeelde helper (pakket R1): één plek voor het state→IFC-options-object, zodat dit
      // pad niet opnieuw velden kan laten vallen.
      const content = writeIFC(buildWriteIFCInput(state));
      // `state` = momentopname vóór de eerste await; zelfde reden als bij saveFile: isDirty pas
      // wissen als er tijdens de opslaan-als-dialoog niets gewijzigd is (K8b).

      try {
        const outcome = await saveFileDialog(
          state.filePath ?? `${projectFileBase(state.project.name)}.ifc`,
          content,
          [{ name: 'IFC Files', extensions: ['ifc'] }],
        );
        if (!outcome) return;
        commitSavedDocument(documentId, state, {
          filePath: outcome.ref?.kind === 'path' ? outcome.ref.path : outcome.name,
          fileHandle: outcome.ref?.kind === 'handle' ? outcome.ref.handle : null,
        });
        await pushRecent(outcome.ref, outcome.name);
        noticeIfDownloaded(outcome);
      } catch (err) {
        console.error('Save As failed:', err);
        get().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: (err as Error).message });
      }
    }),

    exportAs: async (format: ExportFormat): Promise<ExportResult> => {
      // K7 (docs/onderhoudbaarheid): alle vier exporters schrijven de CPM-uitvoer
      // (task.time.earlyStart en afgeleiden) weg naar derden die die datums contractueel lezen.
      // Een verouderde of cyclische planning mag dus niet stil worden uitgevoerd. Daarom: bij een
      // stale schema eerst runCPM, en dán expliciet op cpmResult.error controleren vóór de
      // opslaan-dialoog. Die tweede check is nodig omdat runCPM op zijn EERSTE regel al
      // scheduleStale=false zet (vóór de solve); bij een cyclus breekt hij af mét cpmResult.error
      // gezet én task.time nog op de oude waarden — een guard die alleen op scheduleStale kijkt
      // zou de export in dat geval wél met verouderde datums doorlaten. De guard staat vóór de
      // eerste await (saveFileDialog), zodat er niets half gebeurt.
      if (get().scheduleStale) get().runCPM();
      const cpmError = get().cpmResult?.error;
      if (cpmError) return { ok: false, error: cpmError };

      const state = get();
      const warnings = detectXerExportLoss(format, {
        sourceArchive: state.xerSourceArchive,
        importMetadata: state.xerImportMetadata,
        project: state.project,
        tasks: state.tasks,
        sequences: state.sequences,
        assignments: state.assignments,
        activityCodeTypes: state.activityCodeTypes,
        customFieldDefs: state.customFieldDefs,
        baselines: state.baselines,
        activeBaselineId: state.activeBaselineId,
      });

      let content: string;
      let ext: string;
      let filters: { name: string; extensions: string[] }[];

      switch (format) {
        case 'csv':
          content = writeCSV(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments, state.customTaskTypes,
          );
          ext = 'csv';
          filters = [{ name: 'CSV Files', extensions: ['csv'] }];
          break;
        case 'mspdi':
          content = writeMSPDI(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments, state.calendars,
            // Baselines meegeven (fase 2.6, §9.1): de actieve baseline gaat naar MSPDI-slot 0.
            // Zonder deze twee argumenten viel de writer terug op zijn defaults ([] / null) en
            // ging de baseline stil verloren bij export, terwijl de reader hem wél inleest.
            state.baselines, state.activeBaselineId, state.customTaskTypes,
          );
          ext = 'xml';
          filters = [{ name: 'XML Files', extensions: ['xml'] }];
          break;
        case 'p6':
          content = writeP6XML(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments, state.calendars, state.customTaskTypes,
          );
          ext = 'xml';
          filters = [{ name: 'XML Files', extensions: ['xml'] }];
          break;
        case 'ifc':
        default:
          content = writeIFC(buildWriteIFCInput(state));
          ext = 'ifc';
          filters = [{ name: 'IFC Files', extensions: ['ifc'] }];
          break;
      }

      const outcome = await saveFileDialog(`${projectFileBase(state.project.name)}.${ext}`, content, filters);
      // Cancel is geen export: geen toast en ook geen latente warnings in de succes-envelope.
      // De centrale plaatsing hier maakt Backstage en ribbon automatisch één meldschrijver.
      if (!outcome) return { ok: true, warnings: [] };
      await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
      if (warnings.length > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.xerExportLoss',
          params: { format: format === 'mspdi' ? 'MSPDI' : format.toUpperCase() },
          dedupeKey: `xer-export-loss:${state.activeDocumentId}:${format}`,
          helpArticleId: XER_IMPORT_HELP_ARTICLE_ID,
        });
      }
      return { ok: true, warnings };
    },

    exportProjectWithPool: async (): Promise<ExportResult> => {
      // Zelfde K7-guard als `exportAs`: dit pad schrijft óók de CPM-uitvoer weg, dus een stale of
      // cyclische planning mag hier evenmin stil worden geëxporteerd.
      if (get().scheduleStale) get().runCPM();
      const cpmError = get().cpmResult?.error;
      if (cpmError) return { ok: false, error: cpmError };

      const state = get();
      // 1. Het project zelf (bevat altijd al alle gebruikte items — kernprincipe §1).
      const projectContent = writeIFC(buildWriteIFCInput(state));
      const base = projectFileBase(state.project.name);
      const outcome = await saveFileDialog(`${base}.ifc`, projectContent, [{ name: 'IFC Files', extensions: ['ifc'] }]);
      if (!outcome) return { ok: true, warnings: [] }; // dialoog geannuleerd — geen fout
      await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
      // 2. De pool ernaast (los bestand), alleen als het project aan een bedrijf gebonden is.
      const companyId = state.project.companyId;
      if (!companyId) return { ok: true, warnings: [] };
      const poolContent = state.exportPoolIFC(companyId);
      if (!poolContent) return { ok: true, warnings: [] };
      noticeIfDownloaded(await saveFileDialog(`${base}-bibliotheek.ifc`, poolContent, [{ name: 'IFC Files', extensions: ['ifc'] }]));
      return { ok: true, warnings: [] };
    },

    recentFiles: [],

    hydrateRecentFiles: async () => {
      const list = await loadRecents();
      set((s) => { s.recentFiles = list; });
    },

    parseExternalSource: async (filePath: string, labels) => {
      if (!isTauri()) return null;
      try {
        const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
        const input = await readFormatInput(filePath, { readTextFile, readFile });
        const parsed = activeImportResult(await parseOpenedFile(input, labels));
        return {
          projectId: parsed.project.id,
          projectName: parsed.project.name,
          filePath,
          tasks: parsed.tasks,
        };
      } catch (err) {
        console.error('parseExternalSource: kon bronbestand niet lezen:', err);
        return null;
      }
    },

    refreshExternalAnchorsFrom: async (filePath: string, labels) => {
      const targetDocumentId = get().activeDocumentId;
      const src = await get().parseExternalSource(filePath, labels);
      if (!src) return null;
      if (get().activeDocumentId !== targetDocumentId) return { refreshed: 0, missing: 0 };
      const source: ExternalSourceDoc = {
        projectId: src.projectId, filePath: src.filePath, projectName: src.projectName, tasks: src.tasks,
      };
      const result = refreshExternalAnchors(get().tasks, source);
      if (result.changed) {
        let applied = false;
        set((s) => {
          if (s.activeDocumentId !== targetDocumentId) return;
          // Wél een snapshot (issue #63, review taak 6). Dit was de énige
          // `finishMutation({ stale: true })` zónder `beginUndoable` — een bewuste asymmetrie
          // ("externe-anker-verversing is niet undoable") die niet houdbaar is zodra de modus
          // "datums zoals opgeslagen" bestaat: `finishMutation` verlaat die modus, en zonder
          // snapshot is het aanbod dan onherstelbaar weg (laden → aanbod → ankers verversen →
          // weg, zonder weg terug). Erger nog, het breekt de invariant van `snapshot.ts`: een
          // undo van een OUDERE bewerking zou `datesAsRecorded: true` terugzetten terwijl de
          // ankers al ververst zijn. Deze verversing verandert taakdatums en draait meteen
          // `runCPM` — een gewone, zichtbare datamutatie dus, en die hoort ongedaan te kunnen.
          runtime.beginUndoable(s);
          s.tasks = result.tasks;
          runtime.finishMutation(s, { stale: true });
          applied = true;
        });
        if (applied) {
          get().recomputeViewRows();
          get().runCPM();
        }
      }
      return { refreshed: result.refreshed, missing: result.missing };
    },

    refreshAllExternalAnchors: async (labels) => {
      const targetDocumentId = get().activeDocumentId;
      // Verzamel de distinct bron-bestandspaden uit alle links (fallback: geen pad ⇒ niet verversbaar).
      const paths = new Map<string, string>();
      // FIX 8c (eindreview, onderzoek): `normalizeExternalSourcePath` geeft null voor zowel "geen
      // pad" als "een pad dat niet lexicaal absoluut is" (relatief). Het tweede geval is BEREIKBAAR:
      // `OPS_ExternalLink` schrijft `task.externalLinks` ongefilterd als één JSON-blob weg
      // (ifcPsets.ts) en leest 'm bij het laden ook ongevalideerd terug — een van elders aangeleverd
      // of met de hand bewerkt IFC-bestand kan dus een relatief `sourceRef.filePath` bevatten. Zo'n
      // pad kan de app nooit betrouwbaar herlezen (er is geen vaste "relatief-ten-opzichte-van"-map),
      // dus het blijft terecht overgeslagen als bron — maar voorheen verdween die link daardoor
      // volledig onzichtbaar uit de hele bewerking (niet in `refreshed`, niet in `missing`). Hij telt
      // nu mee in `missing`, zodat de bestaande toast ("N ververst, M ontbrekend") de gebruiker
      // tenminste laat weten dat er iets niet kon, in plaats van stilzwijgend niets te doen.
      let unusablePathCount = 0;
      for (const task of get().tasks) {
        for (const link of task.externalLinks ?? []) {
          const originalPath = link.sourceRef.filePath;
          if (!originalPath) continue;
          const normalizedPath = normalizeExternalSourcePath(originalPath);
          if (normalizedPath === null) { unusablePathCount++; continue; }
          if (!paths.has(normalizedPath)) paths.set(normalizedPath, originalPath);
        }
      }

      // ÉÉN GEBAAR = ÉÉN UNDO-STAP (review taak 6). Deze actie lustte eerder over
      // `refreshExternalAnchorsFrom`, dat sinds issue #63 zelf een snapshot pusht — bij twee
      // gewijzigde bronnen kostte de knop "Alles verversen" dan twee keer Ctrl+Z.
      //
      // De oplossing is NIET `withTransaction`/`enterBatch` om de lus heen: er zit een `await` in
      // (bestanden inlezen), en de bulk-suppressie is module-state. Alles wat de gebruiker tijdens
      // dat inlezen doet zou dan zijn eigen undo-stap verliezen en in deze stap opgaan.
      //
      // Daarom in twee fasen: eerst ALLE bronnen async inlezen zonder iets te muteren, dan de pure
      // `refreshExternalAnchors` (die muteert niets in-place) over de takenlijst KETENEN, en pas
      // daarna één keer schrijven. Levert meteen één `runCPM` in plaats van N.
      const sourceDocs: ExternalSourceDoc[] = [];
      for (const p of paths.values()) {
        const src = await get().parseExternalSource(p, labels);
        if (!src) continue; // onleesbaar/geen Tauri ⇒ deze bron telt niet mee (ongewijzigd gedrag)
        sourceDocs.push({
          projectId: src.projectId, filePath: src.filePath, projectName: src.projectName, tasks: src.tasks,
        });
      }

      if (get().activeDocumentId !== targetDocumentId) {
        return { refreshed: 0, missing: 0, sources: sourceDocs.length };
      }

      // Een IFC-kopie bewaart terecht zijn persistente project-id. Staan twee verschillende
      // bronpaden met zo'n gedeelde id in dezelfde bulkactie, dan is project-id alleen niet langer
      // onderscheidend: de eerste bron zou anders beide links verversen en de tweede beide opnieuw.
      // Alleen in die aantoonbaar ambigue groep eisen we daarom het genormaliseerde bronpad. Een
      // gewone enkelbronverversing blijft project-id-primair, zodat een verplaatst bestand werkt.
      const pathsByProjectId = new Map<string, Set<string>>();
      for (const source of sourceDocs) {
        const projectId = source.projectId.trim();
        const sourcePath = normalizeExternalSourcePath(source.filePath ?? '');
        if (!projectId || sourcePath === null) continue;
        const sourcePaths = pathsByProjectId.get(projectId) ?? new Set<string>();
        sourcePaths.add(sourcePath);
        pathsByProjectId.set(projectId, sourcePaths);
      }
      const ambiguousProjectIds = new Set(
        [...pathsByProjectId].filter(([, sourcePaths]) => sourcePaths.size > 1).map(([projectId]) => projectId),
      );

      let tasks = get().tasks;
      let refreshed = 0;
      // Begint bij `unusablePathCount` (zie hierboven) — een link met een pad dat nooit een bron kon
      // worden telt hier mee als "ontbrekend", net als een link waarvan de bron wél gelezen werd maar
      // de betreffende taak niet meer bevatte.
      let missing = unusablePathCount;
      let anyChanged = false;
      for (const source of sourceDocs) {
        const result = refreshExternalAnchors(
          tasks,
          source,
          ambiguousProjectIds.has(source.projectId.trim()) ? 'file-path' : 'project-or-path',
        );
        tasks = result.tasks; // ketenen: elke bron ververst zijn eigen links op het vorige resultaat
        refreshed += result.refreshed;
        missing += result.missing;
        if (result.changed) anyChanged = true;
      }

      if (anyChanged) {
        let applied = false;
        set((s) => {
          if (s.activeDocumentId !== targetDocumentId) return;
          runtime.beginUndoable(s);
          s.tasks = tasks;
          runtime.finishMutation(s, { stale: true });
          applied = true;
        });
        if (applied) {
          get().recomputeViewRows();
          get().runCPM();
        }
      }
      return { refreshed, missing, sources: sourceDocs.length };
    },

    openRecentFile: async (id: string, labels) => {
      const entry = get().recentFiles.find((e) => e.id === id);
      if (!entry) return;
      // T8-spec-review (F2): ÉÉN keer opzoeken, twee keer gebruikt — `kind` voor de lees-tak
      // (bytes vs tekst), `id` voor de opslagdoel-guard hieronder (F4).
      const readFormat = readFormatForFile(entry.name);
      const isBinary = readFormat.kind === 'binary';
      const content = isBinary ? null : await readFromRef(entry.ref);
      const bytes = isBinary ? await readBytesFromRef(entry.ref) : null;
      // Bij een binair formaat is `content` altijd null (niet gelezen) — dan telt uitsluitend
      // `bytes`; bij een tekstformaat is `bytes` altijd null — dan telt uitsluitend `content`.
      // Exact hetzelfde null-pad (geweigerd/verdwenen → entry stil verwijderen) als voorheen.
      if (isBinary ? bytes === null : content === null) {
        const list = await removeRecent(entry.id);
        set((s) => { s.recentFiles = list; });
        return;
      }
      try {
        const parsed = await parseOpenedFile(
          { name: entry.name, text: content ?? undefined, bytes: bytes ?? undefined },
          labels,
        );

        // Opslagdoel-guard (T8, stap 5a; verbreed T8-spec-review F4; T11: `saveTargetFor` — zie
        // openFile voor de volledige toelichting). `readFormat` is hierboven al opgezocht (F2).
        const target = saveTargetFor(readFormat, entry.ref, entry.name);

        // Zelfde open-pad-semantiek als openFile (zie daar), ook voor meervoudige XER-import.
        get().applyOpenedImport(parsed, {
          filePath: target.filePath,
          fileHandle: target.fileHandle,
          recompute: true,
          fit: true,
          hourDataNotice: true,
          linkedOpen: true,
        });

        // MRU verversen: het net-geopende bestand naar boven (óók bij een niet-IFC bronformaat —
        // alleen het opslagdoel blijft leeg, zie `target` hierboven).
        await pushRecent(entry.ref, entry.name);
      } catch (err) {
        console.error('Failed to open recent file:', err);
        get().notify({ severity: 'error', messageKey: importErrorMessageKey(err), detail: (err as Error).message });
      }
    },

    openExampleFromString: async (content: string, name: string, labels) => {
      try {
        const parsed = await readIFCWithXerReconstruction(content, labels);

        // Zelfde multi-document-gedrag als openFile: hergebruik het actieve
        // tabblad alleen als dat nog leeg en ongewijzigd is, anders nieuw tabblad.
        if (!isActivePristine(get())) get().newDocument();

        // Voorbeeld = geen bronbestand: filePath=null + geen opslaan-doel (opslaan wordt
        // opslaan-als, geen recent-entry). Verder de open-pad-semantiek: doorrekenen + fitten
        // + uur-melding.
        get().applyLoadedProject(parsed, {
          filePath: null,
          fileHandle: null,
          recompute: true,
          fit: true,
          hourDataNotice: true,
        });
      } catch (err) {
        console.error(`Failed to open example "${name}":`, err);
        // `params: { name }` achterwege gelaten: de bestaande `notifications.openFailed`-string
        // bevat geen {{name}}-placeholder, en i18n niet aanraken is een harde grens. De naam staat
        // wel in de debug-terminal (console.error hierboven).
        get().notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: (err as Error).message });
      }
    },
  };
};
