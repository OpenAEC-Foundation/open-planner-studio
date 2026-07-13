import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { ensureExtension } from '@/utils/filePath';
import { emitExtensionEvent, HOST_EVENTS } from '@/extensions/eventBus';
import type { AppSlice } from './types';
import type { AppState } from '../appStore';
import { isTauri } from '@/utils/platform';
import type { Task } from '@/types/task';
import type { ImportResult } from '@/services/importTypes';
import { promoteProjectCalendarToLibrary } from '../syncProjectCalendar';
import { fileHasHourData } from '@/services/subdayIo';
import { refreshExternalAnchors, type ExternalSourceDoc } from '@/engine/externalLinks';

/** Een vers, ongewijzigd, leeg document — dan mag de open-actie het hergebruiken
 *  i.p.v. een nieuw tabblad te openen (anders krijg je een leeg eerste tabblad). */
function isActivePristine(s: AppState): boolean {
  return (
    s.tasks.length === 0 &&
    s.sequences.length === 0 &&
    s.resources.length === 0 &&
    s.filePath === null &&
    !s.isDirty
  );
}

/** Kies de juiste XML-reader op basis van inhoudsmarkers (P6 vóór MS Project).
 *  Gooit bij een onbekend formaat i.p.v. stil als MSPDI te parsen. */
function parseProjectXml(content: string) {
  const isP6 = content.includes('APIBusinessObjects') || content.includes('Primavera');
  const isMsProject =
    content.includes('schemas.microsoft.com/project') || content.includes('<Project');
  if (isP6) return readP6XML(content);
  if (isMsProject) return readMSPDI(content);
  throw new Error('Onbekend XML-formaat: geen MS Project- of Primavera-markers gevonden');
}

export type ExportFormat = 'ifc' | 'csv' | 'mspdi' | 'p6';

/** Opties voor `applyLoadedProject` — de één gedeelde "vul de actieve document-state met een
 *  geparsed project"-implementatie (audit P5/F6). Elke variant (de drie open-paden + `loadState`)
 *  dekt zijn historische gedrag af met deze vlaggen; defaults staan bewust op "niets doen". */
export interface ApplyLoadedProjectOpts {
  /** Nieuw bestandspad (string), `null` voor naamloos (voorbeeld/import), of weglaten
   *  (`undefined`) om `filePath` ongemoeid te laten — dat laatste is de loadState-semantiek
   *  (in-place vervangen zonder het pad te raken). Een string-pad wordt tevens aan de
   *  recente-bestandenlijst toegevoegd. */
  filePath?: string | null;
  /** Direct doorrekenen (runCPM) na de load. Open-paden: true; loadState: false. */
  recompute?: boolean;
  /** Canvas op het hele project passen (requestFitToProject). Open-paden: true; loadState: false. */
  fit?: boolean;
  /** Uur-data-melding (§6.8) berekenen en zetten. Open-paden: true; loadState: false. */
  hourDataNotice?: boolean;
}

// ---- Recente bestanden (localStorage) ----
const RECENT_FILES_KEY = 'open-planner-studio-recent-files';
const MAX_RECENT_FILES = 10;

function readRecentFiles(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentFile(filePath: string): void {
  const recent = readRecentFiles().filter(f => f !== filePath);
  recent.unshift(filePath);
  if (recent.length > MAX_RECENT_FILES) recent.length = MAX_RECENT_FILES;
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent));
}

export interface FileSlice {
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  exportAs: (format: ExportFormat) => Promise<void>;
  getRecentFiles: () => string[];
  openRecentFile: (path: string) => Promise<void>;
  /** Read-only parse van een bronbestand voor externe koppelingen (fase 2.9, §5.5): geeft de
   *  projectidentiteit + taken terug ZONDER het als document te openen (hergebruikt de bestaande
   *  readers). null bij een leesfout/onbekend formaat/niet-Tauri. */
  parseExternalSource: (filePath: string) => Promise<{ projectId: string; projectName: string; filePath: string; tasks: Task[] } | null>;
  /** Ververs alle externe ankers die naar `filePath` verwijzen uit de actuele bron (fase 2.9, §4.5/§5.5).
   *  Parset de bron read-only, herberekent de ankers + `sourceMissing`, en herrekent de planning. */
  refreshExternalAnchorsFrom: (filePath: string) => Promise<{ refreshed: number; missing: number } | null>;
  /** Projectbrede ververs-actie ("Ververs externe ankers"): ververs elke gerefereerde bron één keer. */
  refreshAllExternalAnchors: () => Promise<{ refreshed: number; missing: number; sources: number }>;
  /** Open een meegeleverd voorbeeldproject uit een IFC-string als NIEUW document
   *  (geen filePath — opslaan wordt opslaan-als; isDirty=false). Werkt in web én
   *  Tauri; het bestand wordt door de aanroeper via fetch('/examples/…') geladen. */
  openExampleFromString: (content: string, name: string) => void;
  /** Eén gedeelde load-implementatie (audit P5/F6): vul de ACTIEVE document-state met een geparsed
   *  project en voer de opt-afhankelijke nastappen uit (runCPM/fit/uur-melding/recente-bestand/
   *  extensie-event). Neemt géén besluit over een nieuw tabblad — dat blijft bij de aanroeper vóór
   *  de load. `loadState` en de drie open-paden lopen hier allemaal doorheen. */
  applyLoadedProject: (parsed: ImportResult, opts: ApplyLoadedProjectOpts) => void;
}

export const createFileSlice: AppSlice<FileSlice> = (set, get) => ({
  applyLoadedProject: (parsed, opts) => {
    set((s) => {
      s.project = parsed.project;
      s.calendar = parsed.calendar;
      s.tasks = parsed.tasks;
      s.sequences = parsed.sequences;
      s.resources = parsed.resources;
      s.assignments = parsed.assignments;
      s.calendars = parsed.resourceCalendars ?? [];
      // §4.3-migratie: bestand zonder bibliotheek-entry voor zijn projectkalender krijgt de eerste.
      promoteProjectCalendarToLibrary(s);
      // Structuur (activity-codes/custom-fields) hoort bij het project en round-tript door IFC —
      // altijd overnemen. (Fix van bevinding F6: de open-paden lieten dit historisch weg, waardoor
      // Bestand → Openen + Opslaan activity-codes/custom-fields stil vernietigde.)
      s.activityCodeTypes = parsed.activityCodeTypes ?? [];
      s.customFieldDefs = parsed.customFieldDefs ?? [];
      // Uur-data-melding (§6.8): bevat het bestand urenplanning terwijl de hoofdschakelaar uit
      // staat, toon de niet-blokkerende melding — nooit stil wegronden (de engine rekent sowieso).
      if (opts.hourDataNotice) {
        s.ui.hourDataNotice = !s.ui.enableHourPlanning && fileHasHourData(s.tasks, [s.calendar, ...s.calendars]);
      }
      // Baselines (fase 2.6, §8.3): IFC/MSPDI leveren ze; CSV/P6 niet (dan leeg).
      s.baselines = parsed.baselines ?? [];
      s.activeBaselineId = parsed.activeBaselineId ?? null;
      s.selectedTaskIds = [];
      s.cpmResult = null;
      s.resourceLoadResult = null;
      s.scheduleStale = false;
      s.undoStack = [];
      s.redoStack = [];
      s.isDirty = false;
      // string = nieuw pad, null = naamloos, undefined = laat filePath ongemoeid (loadState-semantiek).
      if (opts.filePath !== undefined) s.filePath = opts.filePath;
    });
    // Na een IFC-load meteen doorrekenen (CLAUDE.md "after an IFC load"), consistent met de
    // IFCPanel-plakroute — anders blijven statusbalk/histogram leeg tot de gebruiker F5 drukt (A5).
    if (opts.recompute) get().runCPM();
    if (opts.fit) get().requestFitToProject(); // Issue #16: canvas op het HELE project passen.
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: parsed.tasks.length,
      sequences: parsed.sequences.length,
      resources: parsed.resources.length,
    });
    // Een string-pad landt in de recente-bestandenlijst; null/undefined (voorbeeld, in-place) niet.
    if (typeof opts.filePath === 'string') addRecentFile(opts.filePath);
  },

  openFile: async () => {
    if (!isTauri()) return;
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'All Supported', extensions: ['ifc', 'csv', 'xml'] },
        { name: 'IFC Files', extensions: ['ifc'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'XML Files', extensions: ['xml'] },
      ],
    });
    if (!selected) return;
    const filePath = selected as string;
    try {
      const content = await readTextFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      let parsed: ImportResult;

      if (ext === 'csv') {
        parsed = readCSV(content);
      } else if (ext === 'xml') {
        parsed = parseProjectXml(content);
      } else {
        parsed = readIFC(content);
      }

      // Multi-document: open het bestand in een eigen tabblad. Hergebruik het
      // actieve tabblad alleen als dat nog leeg en ongewijzigd is.
      if (!isActivePristine(get())) get().newDocument();

      // Gedeelde load-implementatie; open-pad-semantiek: pad zetten (+ recent), direct
      // doorrekenen + fitten en de uur-melding evalueren.
      get().applyLoadedProject(parsed, {
        filePath,
        recompute: true,
        fit: true,
        hourDataNotice: true,
      });
    } catch (err) {
      console.error('Failed to parse file:', err);
    }
  },

  saveFile: async () => {
    if (!isTauri()) return;
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const state = get();

    const content = writeIFC({
      project: state.project,
      calendar: state.calendar,
      tasks: state.tasks,
      sequences: state.sequences,
      resources: state.resources,
      assignments: state.assignments,
      activityCodeTypes: state.activityCodeTypes,
      customFieldDefs: state.customFieldDefs,
      resourceCalendars: state.calendars,
      baselines: state.baselines,
      activeBaselineId: state.activeBaselineId,
    });

    if (state.filePath) {
      await writeTextFile(state.filePath, content);
      set((s) => { s.isDirty = false; });
    } else {
      const picked = await save({
        defaultPath: `${state.project.name || 'project'}.ifc`,
        filters: [{ name: 'IFC Files', extensions: ['ifc'] }],
      });
      if (picked) {
        const savedPath = ensureExtension(picked, 'ifc');
        await writeTextFile(savedPath, content);
        set((s) => {
          s.filePath = savedPath;
          s.isDirty = false;
        });
        addRecentFile(savedPath);
      }
    }
  },

  saveFileAs: async () => {
    if (!isTauri()) return;
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const state = get();

    const content = writeIFC({
      project: state.project,
      calendar: state.calendar,
      tasks: state.tasks,
      sequences: state.sequences,
      resources: state.resources,
      assignments: state.assignments,
      activityCodeTypes: state.activityCodeTypes,
      customFieldDefs: state.customFieldDefs,
      resourceCalendars: state.calendars,
      baselines: state.baselines,
      activeBaselineId: state.activeBaselineId,
    });

    const picked = await save({
      defaultPath: state.filePath ?? `${state.project.name || 'project'}.ifc`,
      filters: [{ name: 'IFC Files', extensions: ['ifc'] }],
    });
    if (picked) {
      const savedPath = ensureExtension(picked, 'ifc');
      await writeTextFile(savedPath, content);
      set((s) => {
        s.filePath = savedPath;
        s.isDirty = false;
      });
      addRecentFile(savedPath);
    }
  },

  exportAs: async (format: ExportFormat) => {
    if (!isTauri()) return;
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
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
        content = writeIFC({
          project: state.project,
          calendar: state.calendar,
          tasks: state.tasks,
          sequences: state.sequences,
          resources: state.resources,
          assignments: state.assignments,
          activityCodeTypes: state.activityCodeTypes,
          customFieldDefs: state.customFieldDefs,
          resourceCalendars: state.calendars,
          baselines: state.baselines,
          activeBaselineId: state.activeBaselineId,
        });
        ext = 'ifc';
        filters = [{ name: 'IFC Files', extensions: ['ifc'] }];
        break;
    }

    const picked = await save({
      defaultPath: `${state.project.name || 'project'}.${ext}`,
      filters,
    });
    if (picked) {
      const savedPath = ensureExtension(picked, ext);
      await writeTextFile(savedPath, content);
      addRecentFile(savedPath);
    }
  },

  getRecentFiles: () => readRecentFiles(),

  parseExternalSource: async (filePath: string) => {
    if (!isTauri()) return null;
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const parsed = ext === 'csv' ? readCSV(content) : ext === 'xml' ? parseProjectXml(content) : readIFC(content);
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

  refreshExternalAnchorsFrom: async (filePath: string) => {
    const src = await get().parseExternalSource(filePath);
    if (!src) return null;
    const source: ExternalSourceDoc = {
      projectId: src.projectId, filePath: src.filePath, projectName: src.projectName, tasks: src.tasks,
    };
    const result = refreshExternalAnchors(get().tasks, source);
    if (result.changed) {
      set((s) => {
        s.tasks = result.tasks;
        s.isDirty = true;
        s.scheduleStale = true;
      });
      get().recomputeViewRows();
      get().runCPM();
    }
    return { refreshed: result.refreshed, missing: result.missing };
  },

  refreshAllExternalAnchors: async () => {
    // Verzamel de distinct bron-bestandspaden uit alle links (fallback: geen pad ⇒ niet verversbaar).
    const paths = new Set<string>();
    for (const task of get().tasks) {
      for (const link of task.externalLinks ?? []) {
        if (link.sourceRef.filePath) paths.add(link.sourceRef.filePath);
      }
    }
    let refreshed = 0;
    let missing = 0;
    let sources = 0;
    for (const p of paths) {
      const r = await get().refreshExternalAnchorsFrom(p);
      if (r) { refreshed += r.refreshed; missing += r.missing; sources++; }
    }
    return { refreshed, missing, sources };
  },

  openRecentFile: async (filePath: string) => {
    if (!isTauri()) return;
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    try {
      const content = await readTextFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      let parsed: ImportResult;

      if (ext === 'csv') {
        parsed = readCSV(content);
      } else if (ext === 'xml') {
        parsed = parseProjectXml(content);
      } else {
        parsed = readIFC(content);
      }

      if (!isActivePristine(get())) get().newDocument();

      // Zelfde open-pad-semantiek als openFile (zie daar); loopt door de gedeelde implementatie.
      get().applyLoadedProject(parsed, {
        filePath,
        recompute: true,
        fit: true,
        hourDataNotice: true,
      });
    } catch (err) {
      console.error('Failed to open recent file:', err);
    }
  },

  openExampleFromString: (content: string, name: string) => {
    try {
      const parsed = readIFC(content);

      // Zelfde multi-document-gedrag als openFile: hergebruik het actieve
      // tabblad alleen als dat nog leeg en ongewijzigd is, anders nieuw tabblad.
      if (!isActivePristine(get())) get().newDocument();

      // Voorbeeld = geen bronbestand: filePath=null (opslaan wordt opslaan-als, geen recent-entry).
      // Verder de open-pad-semantiek: direct doorrekenen + fitten + uur-melding.
      get().applyLoadedProject(parsed, {
        filePath: null,
        recompute: true,
        fit: true,
        hourDataNotice: true,
      });
    } catch (err) {
      console.error(`Failed to open example "${name}":`, err);
    }
  },
});
