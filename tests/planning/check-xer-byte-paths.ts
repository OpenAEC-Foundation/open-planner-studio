import { openDialogFilters, binaryExtensions, parseOpenedFile } from '@/services/formatRegistry';
import { readOpenedTauriPath } from '@/services/fileAccess/tauriBackend';
import { openFileDialogWeb, readBytesFromRefWeb } from '@/services/fileAccess/webBackend';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function fixture(projectName: string): string {
  return [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_data',
    '%R\tC1\tStandaard\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    `%R\tP1\t${projectName}\tC1\t2026-01-01 08:00`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\tA1\tTaak\t2026-01-01 08:00\t2026-01-01 16:00',
    '%E',
  ].join('\n');
}

function utf16(text: string, littleEndian: boolean): Uint8Array {
  const out = new Uint8Array(2 + text.length * 2);
  out.set(littleEndian ? [0xff, 0xfe] : [0xfe, 0xff]);
  for (let index = 0; index < text.length; index++) {
    const value = text.charCodeAt(index);
    out[2 + index * 2] = littleEndian ? value & 0xff : value >>> 8;
    out[3 + index * 2] = littleEndian ? value >>> 8 : value & 0xff;
  }
  return out;
}

function cp1252(text: string): Uint8Array {
  return Uint8Array.from([...text].map(character => {
    if (character === '€') return 0x80;
    if (character === 'é') return 0xe9;
    return character.charCodeAt(0);
  }));
}

const encodings = [
  ['CP1252', cp1252(fixture('Café €'))],
  ['UTF-16LE BOM', utf16(fixture('Café €'), true)],
  ['UTF-16BE BOM', utf16(fixture('Café €'), false)],
] as const;

const g = globalThis as unknown as {
  window: Record<string, unknown>;
  document: Record<string, unknown>;
};
g.window = {};
let nextBytes = new Uint8Array();
let webTextCalls = 0;
let webArrayCalls = 0;
g.document = {
  documentElement: { dir: '', lang: '' },
  createElement: (tag: string) => {
    if (tag !== 'input') return {};
    const input: {
      type: string;
      accept: string;
      files?: unknown[];
      onchange: (() => void | Promise<void>) | null;
      addEventListener: () => void;
      click: () => void;
    } = {
      type: '',
      accept: '',
      onchange: null,
      addEventListener: () => undefined,
      click: () => {
        input.files = [{
          name: 'route.xer',
          text: async () => { webTextCalls++; return 'verboden'; },
          arrayBuffer: async () => {
            webArrayCalls++;
            return nextBytes.buffer.slice(nextBytes.byteOffset, nextBytes.byteOffset + nextBytes.byteLength);
          },
        }];
        void input.onchange?.();
      },
    };
    return input;
  },
};

for (const [encoding, bytes] of encodings) {
  // Web-openroute: de echte input-fallback moet arrayBuffer kiezen en File.text volledig mijden.
  nextBytes = new Uint8Array(bytes);
  webTextCalls = 0;
  webArrayCalls = 0;
  const webOpened = await openFileDialogWeb(openDialogFilters(), { binaryExtensions: binaryExtensions() });
  const webParsed = await parseOpenedFile({
    name: webOpened?.name ?? '',
    bytes: webOpened?.bytes,
    text: webOpened?.content,
  });
  eq(`web ${encoding}: originele bytes via File.arrayBuffer`, {
    name: webParsed.project.name,
    textCalls: webTextCalls,
    arrayCalls: webArrayCalls,
  }, { name: 'Café €', textCalls: 0, arrayCalls: 1 });

  // Tauri-openroute: dezelfde oorspronkelijke bytes via plugin-fs.readFile, niet readTextFile.
  const tauriCalls: string[] = [];
  const tauriOpened = await readOpenedTauriPath('/tmp/route.xer', {
    binaryExtensions: binaryExtensions(),
  }, {
    readTextFile: async () => { tauriCalls.push('text'); return 'verboden'; },
    readFile: async () => { tauriCalls.push('bytes'); return bytes; },
  });
  const tauriParsed = await parseOpenedFile(tauriOpened);
  eq(`Tauri ${encoding}: plugin-fs-bytes blijven ongewijzigd`, {
    name: tauriParsed.project.name,
    calls: tauriCalls,
  }, { name: 'Café €', calls: ['bytes'] });

  // Recents-webroute: een bewaarde handle wordt als bytes herlezen en daarna normaal geparsed.
  const handle = {
    kind: 'file',
    name: 'route.xer',
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    getFile: async () => ({
      text: async () => 'verboden',
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }),
  } as unknown as FileSystemFileHandle;
  const recentBytes = await readBytesFromRefWeb({ kind: 'handle', handle });
  const recentParsed = await parseOpenedFile({ name: 'route.xer', bytes: recentBytes ?? undefined });
  eq(`recents ${encoding}: handle-bytepad bereikt de XER-reader`, recentParsed.project.name, 'Café €');
}

// Dev bridge: injecteer uitsluitend de filesystemrand; de echte openFromPath-kern kiest de
// registry, parsed en laadt de store. De dynamische import volgt pas na de browserstubs hierboven.
const { openFromPathWithIO } = await import('@/utils/devBridge');
const { useAppStore } = await import('@/state/appStore');
for (const [encoding, bytes] of encodings) {
  const calls: string[] = [];
  const opened = await openFromPathWithIO('/tmp/route.xer', {
    readTextFile: async () => { calls.push('text'); return 'verboden'; },
    readFile: async () => { calls.push('bytes'); return bytes; },
  });
  eq(`dev bridge ${encoding}: bytes → registry → store`, {
    calls,
    project: useAppStore.getState().project.name,
    tasks: opened.tasks,
  }, { calls: ['bytes'], project: 'Café €', tasks: 1 });
}

// Echte fileSlice-openactie boven op het web-bytepad: de bron wordt geladen, maar krijgt nooit
// een opslagdoel omdat saveTargetFor alleen IFC doorlaat.
nextBytes = new Uint8Array(encodings[0][1]);
await useAppStore.getState().openFile();
eq('fileSlice web-open: XER laadt maar wordt geen Ctrl+S-opslagdoel', {
  project: useAppStore.getState().project.name,
  filePath: useAppStore.getState().filePath,
  fileHandle: useAppStore.getState().fileHandle,
}, { project: 'Café €', filePath: null, fileHandle: null });

// Echte openRecentFile-actie boven op de handle-bytebackend. De entry kan door de headless
// IndexedDB-terugval opnieuw worden opgebouwd, maar de handle mag nooit documentopslagdoel worden.
const recentSource = encodings[2][1];
const recentHandle = {
  kind: 'file',
  name: 'recent.xer',
  isSameEntry: async () => false,
  queryPermission: async () => 'granted',
  requestPermission: async () => 'granted',
  getFile: async () => ({
    text: async () => 'verboden',
    arrayBuffer: async () => recentSource.buffer.slice(
      recentSource.byteOffset,
      recentSource.byteOffset + recentSource.byteLength,
    ),
  }),
} as unknown as FileSystemFileHandle;
useAppStore.setState({
  recentFiles: [{
    id: 'xer-recent',
    name: 'recent.xer',
    ref: { kind: 'handle', handle: recentHandle },
    addedAt: Date.now(),
  }],
});
await useAppStore.getState().openRecentFile('xer-recent');
eq('fileSlice recents: UTF-16BE-XER laadt zonder opslagdoel', {
  project: useAppStore.getState().project.name,
  filePath: useAppStore.getState().filePath,
  fileHandle: useAppStore.getState().fileHandle,
}, { project: 'Café €', filePath: null, fileHandle: null });

if (diffs.length > 0) {
  console.error(`XER-bytepaden: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-bytepaden: ${checks} web/Tauri/recents/dev × drie encodings`);
