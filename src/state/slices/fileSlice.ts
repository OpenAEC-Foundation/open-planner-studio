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

const isTauri = () => '__TAURI_INTERNALS__' in window;

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
}

export const createFileSlice: AppSlice<FileSlice> = (set, get) => ({
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
      let parsed;

      if (ext === 'csv') {
        parsed = readCSV(content);
      } else if (ext === 'xml') {
        parsed = parseProjectXml(content);
      } else {
        parsed = readIFC(content);
      }

      set((s) => {
        s.project = parsed.project;
        s.calendar = parsed.calendar;
        s.tasks = parsed.tasks;
        s.sequences = parsed.sequences;
        s.resources = parsed.resources;
        s.assignments = parsed.assignments;
        s.selectedTaskIds = [];
        s.cpmResult = null;
        s.undoStack = [];
        s.redoStack = [];
        s.isDirty = false;
        s.filePath = filePath;
      });
      emitExtensionEvent(HOST_EVENTS.projectLoaded, {
        tasks: parsed.tasks.length,
        sequences: parsed.sequences.length,
        resources: parsed.resources.length,
      });
      addRecentFile(filePath);
    } catch (err) {
      console.error('Failed to parse file:', err);
    }
  },

  saveFile: async () => {
    if (!isTauri()) return;
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const state = get();

    const content = writeIFC(
      state.project, state.calendar, state.tasks,
      state.sequences, state.resources, state.assignments,
    );

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

    const content = writeIFC(
      state.project, state.calendar, state.tasks,
      state.sequences, state.resources, state.assignments,
    );

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
          state.sequences, state.resources, state.assignments,
        );
        ext = 'xml';
        filters = [{ name: 'XML Files', extensions: ['xml'] }];
        break;
      case 'p6':
        content = writeP6XML(
          state.project, state.calendar, state.tasks,
          state.sequences, state.resources, state.assignments,
        );
        ext = 'xml';
        filters = [{ name: 'XML Files', extensions: ['xml'] }];
        break;
      case 'ifc':
      default:
        content = writeIFC(
          state.project, state.calendar, state.tasks,
          state.sequences, state.resources, state.assignments,
        );
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

  openRecentFile: async (filePath: string) => {
    if (!isTauri()) return;
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    try {
      const content = await readTextFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      let parsed;

      if (ext === 'csv') {
        parsed = readCSV(content);
      } else if (ext === 'xml') {
        parsed = parseProjectXml(content);
      } else {
        parsed = readIFC(content);
      }

      set((s) => {
        s.project = parsed.project;
        s.calendar = parsed.calendar;
        s.tasks = parsed.tasks;
        s.sequences = parsed.sequences;
        s.resources = parsed.resources;
        s.assignments = parsed.assignments;
        s.selectedTaskIds = [];
        s.cpmResult = null;
        s.undoStack = [];
        s.redoStack = [];
        s.isDirty = false;
        s.filePath = filePath;
      });
      emitExtensionEvent(HOST_EVENTS.projectLoaded, {
        tasks: parsed.tasks.length,
        sequences: parsed.sequences.length,
        resources: parsed.resources.length,
      });
      addRecentFile(filePath);
    } catch (err) {
      console.error('Failed to open recent file:', err);
    }
  },
});
