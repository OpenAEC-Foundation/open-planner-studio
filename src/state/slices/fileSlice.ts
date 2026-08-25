import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeCSV } from '@/services/csv/csvWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { openFileDialog, saveFileDialog, saveToRef, readFromRef, readBytesFromRef, type FileRef, type SaveOutcome } from '@/services/fileAccess';
import { openDialogFilters, binaryExtensions, readFormatForFile, parseOpenedFile, importErrorMessageKey, saveTargetFor, readFormatInput, type ExportFormat } from '@/services/formatRegistry';
import { loadRecents, addRecent, removeRecent, type RecentEntry } from '@/services/fileAccess/recentFiles';
import { emitExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import type { AppSlice } from './types';
import type { AppState } from '../appStore';
import { isTauri } from '@/utils/platform';
import type { Task } from '@/types/task';
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import { hydratePayload, payloadFromImport } from '../documentContract';
import { captureRecordedDates, countShiftedTasks } from '@/engine/scheduler/recordedDates';
import { buildWriteIFCInput, sameIFCSource } from '../ifcSaveInput';
import { beginUndoable, finishMutation } from '../transaction';
import { fileHasHourData } from '@/services/subdayIo';
import { projectFileBase } from '@/utils/documents';
import { refreshExternalAnchors, type ExternalSourceDoc } from '@/engine/externalLinks';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';

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

// `ExportFormat` woont nu in de formatRegistry (T1); hier her-exporteren zodat bestaande
// importeurs (Backstage, via appStore) ongewijzigd blijven werken.
export { type ExportFormat };

/** Resultaat van `exportAs` (K7): bij een cyclische planning wordt de export afgebroken vóór de
 *  opslaan-dialoog en de CPM-cyclusfout (`cpmResult.error`) als boodschap meegegeven, zodat de
 *  aanroeper die kan tonen i.p.v. stilletjes niets te doen. */
export type ExportResult = { ok: true } | { ok: false; error: string };

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
  /** Direct doorrekenen (runCPM) na de load. Open-paden: true; loadState: false. */
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
}

export interface FileSlice {
  /** `labels` — vertaalde teksten die de UI aanlevert omdat de store-laag geen `t(...)` heeft (zie
   *  `ImportLabels`); weglaten geeft de Engelse default. Geldt voor elk laadpad hieronder. */
  openFile: (labels?: ImportLabels) => Promise<void>;
  saveFile: () => Promise<void>;
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
  openExampleFromString: (content: string, name: string, labels?: ImportLabels) => void;
  /** Eén gedeelde load-implementatie (audit P5/F6): vul de ACTIEVE document-state met een geparsed
   *  project en voer de opt-afhankelijke nastappen uit (runCPM/fit/uur-melding/extensie-event).
   *  Neemt géén besluit over een nieuw tabblad — dat blijft bij de aanroeper vóór de load.
   *  `loadState` en de drie open-paden lopen hier allemaal doorheen. */
  applyLoadedProject: (parsed: ImportResult, opts: ApplyLoadedProjectOpts) => void;
}

export const createFileSlice: AppSlice<FileSlice> = (set, get) => {
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

  return {
    applyLoadedProject: (parsed, opts) => {
      set((s) => {
        // string = nieuw pad, null = naamloos, undefined = laat filePath ongemoeid (loadState-semantiek).
        const filePath = opts.filePath !== undefined ? opts.filePath : s.filePath;
        // Reset-pad (audit P10): bouw een verse payload uit het geparste project (selectie/cpm/undo/
        // scheduleStale starten vers, isDirty=false) en hydrateer die via het documentcontract —
        // dezelfde `DOCUMENT_FIELDS`-lijst als switchDocument/undo, dus geen stille lek. hydratePayload
        // doet ook de §4.3-promote + §9.1-sync van de projectkalender (was hier voorheen apart).
        // Structuur (activity-codes/custom-fields) rijdt in payloadFromImport mee — altijd overnemen
        // (fix F6: de open-paden lieten dit historisch weg → stil dataverlies bij openen + opslaan).
        const payload = payloadFromImport(parsed, filePath);
        // Load-semantiek: het HUIDIGE document behoudt zijn view/inklap (in-place vervangen van de
        // projectdata raakt zoom/groepering/inklap niet — historisch gedrag van applyLoadedProject).
        payload.view = s.view;
        payload.collapsedTaskIds = s.ui.collapsedTaskIds;
        // Web-opslaan-doel: undefined = ongemoeid laten (loadState-semantiek), anders expliciet zetten.
        payload.fileHandle = opts.fileHandle !== undefined ? opts.fileHandle : s.fileHandle;
        hydratePayload(s, payload);
        // Spec §5 (review-punt 3): een volledig-vervangende load zonder open-pad-semantiek levert een
        // LOS document — geen stille koppeling, geen stille herkenning. Strip bedrijfsbinding + stempels.
        if (!opts.linkedOpen) {
          s.project = { ...s.project, companyId: undefined, companyName: undefined };
          s.resources = s.resources.map((r) => { const { libraryOrigin: _d, ...rest } = r; return rest; });
          s.calendars = s.calendars.map((c) => { const { libraryOrigin: _d, ...rest } = c; return rest; });
          s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
        }
        // Uur-data-melding (§6.8): bevat het bestand urenplanning terwijl de hoofdschakelaar uit
        // staat, toon de niet-blokkerende melding — nooit stil wegronden (de engine rekent sowieso).
        if (opts.hourDataNotice) {
          s.ui.hourDataNotice = !s.ui.enableHourPlanning && fileHasHourData(s.tasks, [s.calendar, ...s.calendars]);
        }
      });
      // "Datums zoals opgeslagen" (issue #63): leg VÓÓR de solve vast wat het bestand zei. `set()`
      // hierboven is synchroon en er zit niets tussenin, dus `get().tasks` hier is nog exact wat
      // `hydratePayload` er net neerzette. Dat moet vóór de recompute hieronder: `payloadFromImport`
      // geeft `parsed.tasks` per referentie door, dus `s.tasks`/`get().tasks` en `parsed.tasks` zijn
      // dezelfde objecten — `runCPM` muteert ze in-place, dus na de solve zijn de gelezen waarden ook
      // in `parsed` alweer overschreven.
      const recorded = opts.recompute ? captureRecordedDates(get().tasks, parsed.recordedFields) : null;
      // Na een IFC-load meteen doorrekenen (CLAUDE.md "after an IFC load"), consistent met de
      // IFCPanel-plakroute — anders blijven statusbalk/histogram leeg tot de gebruiker F5 drukt (A5).
      if (opts.recompute) get().runCPM();
      // …en pas dán vergelijken. Nul verschil ⇒ niets in de state; de strook blijft dan onzichtbaar,
      // precies zoals bedoeld.
      if (recorded && recorded.total > 0) {
        const shifted = countShiftedTasks(get().tasks, recorded.times);
        if (shifted > 0) set((s) => { s.recordedDates = { ...recorded, shifted }; });
      }
      if (parsed.xer?.enumFallbacks.length) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.xerEnumFallback',
          params: {
            family: parsed.xer.enumFallbacks.map(item => item.family).join(', '),
            token: parsed.xer.enumFallbacks.map(item => item.token).join(', '),
            fallback: parsed.xer.enumFallbacks.map(item => item.fallback).join(', '),
          },
          dedupeKey: 'xer-enum-fallback',
        });
      }
      if (opts.fit) get().requestFitToProject(); // Issue #16: canvas op het HELE project passen.
      // Relaties die de solver ECHT niet kon meerekenen (eigenaarsbesluit 2026-08-15): een
      // verzameltaak-eindpunt op zich is sinds `expandSummaryRelations` GEEN reden meer om te
      // melden — die relaties rekenen gewoon mee. Wat overblijft is de voorouder-guard (een taak
      // gekoppeld aan zijn eigen (voor)ouder-samenvatting), een lege/kapotte tak, of de
      // MAX_EXPANDED_RELATIONS-klem — stuk voor stuk gevallen waarin de relatie écht geen effect
      // heeft. Rechtstreeks `expandSummaryRelations` aanroepen i.p.v. op `cpmResult.
      // droppedSequenceIds` leunen: die is alleen gevuld ná `runCPM`, en `loadState` (extensie-
      // imports, devBridge) draait die BEWUST NIET (`opts.recompute: false`, zie `loadState` in
      // `projectSlice.ts`) — de pure expansiefunctie geeft hier hetzelfde antwoord, ongeacht of er
      // straks nog wordt doorgerekend, en zonder de timing-afhankelijkheid van `cpmResult`. Bewust
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

    openFile: async (labels) => {
      try {
        const opened = await openFileDialog(openDialogFilters(), { binaryExtensions: binaryExtensions() });
        if (!opened) return;
        const parsed = await parseOpenedFile({ name: opened.name, text: opened.content, bytes: opened.bytes }, labels);

        // Multi-document: open het bestand in een eigen tabblad. Hergebruik het
        // actieve tabblad alleen als dat nog leeg en ongewijzigd is.
        if (!isActivePristine(get())) get().newDocument();

        // Opslagdoel-guard (T8, stap 5a; verbreed T8-spec-review F4; T11: via `canBeSaveTarget` op
        // de registry-entry i.p.v. een `id === 'ifc'`-vergelijking hier). Opslaan schrijft altijd
        // IFC-TEKST, dus élk ANDER bronformaat (csv/xml/mpp — niet uitsluitend binaire formaten)
        // zou bij een naïeve toewijzing zijn eigen bronbestand met IFC-inhoud laten overschrijven
        // door de eerstvolgende Ctrl+S. "Opslaan" wordt dan "opslaan-als". Zelfde vlag als de
        // MCP-kant (`fileTools.ts` leest óók `canBeSaveTarget`).
        const target = saveTargetFor(readFormatForFile(opened.name), opened.ref, opened.name);

        // Gedeelde load-implementatie; open-pad-semantiek: identiteit + opslaan-doel zetten,
        // direct doorrekenen + fitten en de uur-melding evalueren.
        get().applyLoadedProject(parsed, {
          filePath: target.filePath,
          fileHandle: target.fileHandle,
          recompute: true,
          fit: true,
          hourDataNotice: true,
          linkedOpen: true,
        });

        // Grens 1 (spec §3, plan-eis 4): ná VOLLEDIGE hydratatie — behind stil verversen, deviated
        // markeren/vragen. Nooit tijdens de hydratatie zelf.
        get().runOpenBoundary();

        // Recents: elke herbruikbare ref (Tauri-pad óf Chromium-handle) — óók bij een niet-IFC
        // bronformaat: heropenen via recents moet blijven werken, alleen het OPSLAGDOEL wordt niet
        // gezet (zie `target` hierboven).
        await pushRecent(opened.ref, opened.name);
      } catch (err) {
        console.error('Failed to open file:', err);
        get().notify({ severity: 'error', messageKey: importErrorMessageKey(err), detail: (err as Error).message });
      }
    },

    saveFile: async () => {
      const state = get();
      // Gedeelde helper (pakket R1): één plek voor het state→IFC-options-object, zodat dit
      // pad niet opnieuw velden kan laten vallen.
      const content = writeIFC(buildWriteIFCInput(state));
      // `state` is de momentopname vóór de eerste await. De opslaan-dialoog (en in Tauri de
      // schrijfactie) kan minuten duren en de gebruiker kan ondertussen doorwerken; `content` is
      // dan verouderd. Daarom mag `isDirty` pas worden gewist als de inhoud ná de await nog
      // letterlijk dezelfde is — bepaald via `sameIFCSource` (bevinding K8b: anders stil verlies).

      try {
        // Bestaand opslaan-doel? Web: fileHandle. Tauri: het echte pad in filePath.
        const ref: FileRef | null = state.fileHandle
          ? { kind: 'handle', handle: state.fileHandle }
          : (isTauri() && state.filePath ? { kind: 'path', path: state.filePath } : null);

        if (ref && await saveToRef(ref, content)) {
          // "Nog ongewijzigd?" bewust BUITEN de Immer-producer berekend met get(): binnen een draft
          // is `s.tasks` e.d. een proxy en nóóit referentie-gelijk aan de plain array, dus een
          // sameIFCSource(state, s) binnen de producer zou altijd false geven en isDirty nóóit
          // meer wissen — een ergere regressie dan de bug die we hier repareren.
          if (sameIFCSource(state, get())) set((s) => { s.isDirty = false; });
          return;
        }

        // Geen (bruikbare) ref, of in-place opslaan geweigerd → opslaan-als.
        const outcome = await saveFileDialog(
          `${projectFileBase(state.project.name)}.ifc`,
          content,
          [{ name: 'IFC Files', extensions: ['ifc'] }],
        );
        if (!outcome) return;
        // Opnieuw buiten de producer bepalen of er tijdens de dialoog iets gewijzigd is.
        const unchanged = sameIFCSource(state, get());
        set((s) => {
          s.filePath = outcome.ref?.kind === 'path' ? outcome.ref.path : outcome.name;
          s.fileHandle = outcome.ref?.kind === 'handle' ? outcome.ref.handle : null;
          // Alleen "opgeslagen" als er tijdens de dialoog niets gewijzigd is; anders blijft het
          // document terecht gewijzigd en houdt de gebruiker zijn sluitwaarschuwing.
          if (unchanged) s.isDirty = false;
        });
        await pushRecent(outcome.ref, outcome.name);
        noticeIfDownloaded(outcome);
      } catch (err) {
        console.error('Save failed:', err);
        get().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: (err as Error).message });
      }
    },

    saveFileAs: async () => {
      const state = get();
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
        const unchanged = sameIFCSource(state, get());
        set((s) => {
          s.filePath = outcome.ref?.kind === 'path' ? outcome.ref.path : outcome.name;
          s.fileHandle = outcome.ref?.kind === 'handle' ? outcome.ref.handle : null;
          if (unchanged) s.isDirty = false;
        });
        await pushRecent(outcome.ref, outcome.name);
        noticeIfDownloaded(outcome);
      } catch (err) {
        console.error('Save As failed:', err);
        get().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: (err as Error).message });
      }
    },

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

      let content: string;
      let ext: string;
      let filters: { name: string; extensions: string[] }[];

      switch (format) {
        case 'csv':
          content = writeCSV(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments,
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
            state.baselines, state.activeBaselineId,
          );
          ext = 'xml';
          filters = [{ name: 'XML Files', extensions: ['xml'] }];
          break;
        case 'p6':
          content = writeP6XML(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments, state.calendars,
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
      if (outcome) await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
      return { ok: true };
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
      if (!outcome) return { ok: true }; // dialoog geannuleerd — geen fout
      await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
      // 2. De pool ernaast (los bestand), alleen als het project aan een bedrijf gebonden is.
      const companyId = state.project.companyId;
      if (!companyId) return { ok: true };
      const poolContent = state.exportPoolIFC(companyId);
      if (!poolContent) return { ok: true };
      noticeIfDownloaded(await saveFileDialog(`${base}-bibliotheek.ifc`, poolContent, [{ name: 'IFC Files', extensions: ['ifc'] }]));
      return { ok: true };
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
        const parsed = await parseOpenedFile(input, labels);
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
      const src = await get().parseExternalSource(filePath, labels);
      if (!src) return null;
      const source: ExternalSourceDoc = {
        projectId: src.projectId, filePath: src.filePath, projectName: src.projectName, tasks: src.tasks,
      };
      const result = refreshExternalAnchors(get().tasks, source);
      if (result.changed) {
        set((s) => {
          // Wél een snapshot (issue #63, review taak 6). Dit was de énige
          // `finishMutation({ stale: true })` zónder `beginUndoable` — een bewuste asymmetrie
          // ("externe-anker-verversing is niet undoable") die niet houdbaar is zodra de modus
          // "datums zoals opgeslagen" bestaat: `finishMutation` verlaat die modus, en zonder
          // snapshot is het aanbod dan onherstelbaar weg (laden → aanbod → ankers verversen →
          // weg, zonder weg terug). Erger nog, het breekt de invariant van `snapshot.ts`: een
          // undo van een OUDERE bewerking zou `datesAsRecorded: true` terugzetten terwijl de
          // ankers al ververst zijn. Deze verversing verandert taakdatums en draait meteen
          // `runCPM` — een gewone, zichtbare datamutatie dus, en die hoort ongedaan te kunnen.
          beginUndoable(s);
          s.tasks = result.tasks;
          finishMutation(s, { stale: true });
        });
        get().recomputeViewRows();
        get().runCPM();
      }
      return { refreshed: result.refreshed, missing: result.missing };
    },

    refreshAllExternalAnchors: async (labels) => {
      // Verzamel de distinct bron-bestandspaden uit alle links (fallback: geen pad ⇒ niet verversbaar).
      const paths = new Set<string>();
      for (const task of get().tasks) {
        for (const link of task.externalLinks ?? []) {
          if (link.sourceRef.filePath) paths.add(link.sourceRef.filePath);
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
      for (const p of paths) {
        const src = await get().parseExternalSource(p, labels);
        if (!src) continue; // onleesbaar/geen Tauri ⇒ deze bron telt niet mee (ongewijzigd gedrag)
        sourceDocs.push({
          projectId: src.projectId, filePath: src.filePath, projectName: src.projectName, tasks: src.tasks,
        });
      }

      let tasks = get().tasks;
      let refreshed = 0;
      let missing = 0;
      let anyChanged = false;
      for (const source of sourceDocs) {
        const result = refreshExternalAnchors(tasks, source);
        tasks = result.tasks; // ketenen: elke bron ververst zijn eigen links op het vorige resultaat
        refreshed += result.refreshed;
        missing += result.missing;
        if (result.changed) anyChanged = true;
      }

      if (anyChanged) {
        set((s) => {
          beginUndoable(s);
          s.tasks = tasks;
          finishMutation(s, { stale: true });
        });
        get().recomputeViewRows();
        get().runCPM();
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

        if (!isActivePristine(get())) get().newDocument();

        // Opslagdoel-guard (T8, stap 5a; verbreed T8-spec-review F4; T11: `saveTargetFor` — zie
        // openFile voor de volledige toelichting). `readFormat` is hierboven al opgezocht (F2).
        const target = saveTargetFor(readFormat, entry.ref, entry.name);

        // Zelfde open-pad-semantiek als openFile (zie daar); loopt door de gedeelde implementatie.
        get().applyLoadedProject(parsed, {
          filePath: target.filePath,
          fileHandle: target.fileHandle,
          recompute: true,
          fit: true,
          hourDataNotice: true,
          linkedOpen: true,
        });

        // Grens 1 (idem openFile): ná hydratatie de openings-check draaien.
        get().runOpenBoundary();

        // MRU verversen: het net-geopende bestand naar boven (óók bij een niet-IFC bronformaat —
        // alleen het opslagdoel blijft leeg, zie `target` hierboven).
        await pushRecent(entry.ref, entry.name);
      } catch (err) {
        console.error('Failed to open recent file:', err);
        get().notify({ severity: 'error', messageKey: importErrorMessageKey(err), detail: (err as Error).message });
      }
    },

    openExampleFromString: (content: string, name: string, labels) => {
      try {
        const parsed = readIFC(content, labels);

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
