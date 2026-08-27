// X9-R2 — de echte exportAs-route moet XER-only verlies als getypeerd resultaat teruggeven.
// X10 vertaalt en toont dit later; deze headless contracttest schrijft bewust geen UI.
import {
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveDocumentView,
  createEmptyXerArchiveReadModel,
  createXerSourceArchive,
  bindXerImportMetadataToArchive,
} from '@/services/xerSourceArchive';
import type { XerImportMetadata } from '@/services/importTypes';
import { EXPORT_FORMATS } from '@/services/formatRegistry';
import { xerExportTargetVerdict } from '@/services/xerExportLoss';

declare const process: { exit(code: number): never };
const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};

const captures: string[] = [];
const global = globalThis as Record<string, any>;
global.window = global.window ?? {};
global.Blob = class {
  constructor(parts: unknown[]) { captures.push(parts.join('')); }
};
global.URL = global.URL ?? {};
global.URL.createObjectURL = () => 'blob:x9-export-loss';
global.URL.revokeObjectURL = () => undefined;
global.document = {
  createElement: () => ({ href: '', download: '', click: () => undefined }),
};

const { useAppStore } = await import('@/state/appStore');
const store = () => useAppStore.getState();
store().newProject();
store().setProject({ name: 'X9 export-loss', startDate: '2034-01-02' });

const view = createEmptyXerArchiveDocumentView('P-X9-LOSS');
const readModel = createEmptyXerArchiveReadModel();
const diagnostics = {
  ...createEmptyXerArchiveDiagnostics(),
  documentViews: { 'P-X9-LOSS': view },
};
const archive = createXerSourceArchive(new TextEncoder().encode('%T\tUNKNOWN\r\n%F\tx\r\n%R\torigineel\r\n%E'), {
  encoding: 'windows-1252', bom: 'none', newline: 'crlf', diagnostics, readModel,
});
const xer: XerImportMetadata = bindXerImportMetadataToArchive(archive, 'P-X9-LOSS');
useAppStore.setState({
  xerSourceArchive: archive,
  xerImportMetadata: xer,
  xerSourceProjectId: 'P-X9-LOSS',
  scheduleStale: false,
});

const warned: string[] = [];
const originalWarn = console.warn;
console.warn = (...values: unknown[]) => warned.push(values.join(' '));
const results = [];
try {
  for (const format of ['csv', 'mspdi', 'p6', 'ifc'] as const) {
    results.push([format, await store().exportAs(format)] as const);
  }
} finally {
  console.warn = originalWarn;
}

for (const [format, result] of results) {
  const warnings = result.ok && 'warnings' in result && Array.isArray(result.warnings)
    ? result.warnings
    : [];
  if (format === 'ifc') {
    expect('IFC blijft de lossless export en levert geen XER-lossmelding', result.ok && warnings.length === 0);
  } else {
    expect(`${format} levert één gericht getypeerd XER-lossresultaat`, result.ok
      && warnings.length === 1
      && warnings[0]?.code === 'XER_ONLY_DATA_NOT_EXPRESSIBLE'
      && warnings[0]?.format === format
      && warnings[0]?.categories.includes('exact-source-bytes')
      && warnings[0]?.categories.includes('typed-diagnostics')
      && warnings[0]?.categories.includes('project-report'));
  }
}
expect('de X9-runtimegrens is niet langer console-only', warned.length === 0);
expect('alle vier echte exportpaden schreven daadwerkelijk uitvoer', captures.length === 4 && captures.every(Boolean));
expect('MPP heeft geen misleidende exportadapter en een expliciet unsupported-verdict',
  !EXPORT_FORMATS.some(item => (item.format as string) === 'mpp')
  && xerExportTargetVerdict('mpp') === 'unsupported');

if (failures.length === 0) {
  console.log(`OK  xer-export-loss: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-export-loss: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
