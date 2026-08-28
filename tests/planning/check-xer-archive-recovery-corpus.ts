// X9-compactopslag — verse corpusprocessen meten de volledige IFC- en recoveryketen eerlijk.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { clearRecovery, fullRecoverySave, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';
import { readXER } from '@/services/xer/xerReader';
import { decodeXerSourceArchive, sha256Hex } from '@/services/xerSourceArchive';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

declare const process: {
  argv: string[];
  cwd(): string;
  env: Record<string, string | undefined>;
  execPath: string;
  exit(code: number): never;
  resourceUsage(): { maxRSS: number };
};

type ProbeMode = 'ifc' | 'recovery';
interface RecoveryProbe {
  label: string;
  mode: ProbeMode;
  sourceBytes: number;
  documents: number;
  ifcChars: number;
  elapsedMs: number;
  peakRssKiB: number;
  recoveredDocuments: number;
  recoveredArchives: number;
  exactBytes: boolean;
  deltaDocumentWrites: number;
  deltaManifestWrites: number;
  deltaWriteIfcCalls: number;
  deltaEditRestored: boolean;
}

interface RecoveryStorageWrites {
  documents: number;
  manifests: number;
  readwriteTransactions: number;
}

// Harde guardrails zijn uitsluitend semantisch/structureel en daardoor machine-onafhankelijk:
// één documentedit mag exact één volledige IFC-upsert en één manifestcommit veroorzaken; OZB
// blijft twaalf herstelbare documenten. Walltime en OS-peak-RSS zijn wel echte procesmetingen en
// worden hieronder altijd gelogd, maar krijgen bewust GEEN bovengrens: CPU, beschikbare RAM,
// kernel/page-cache en CI-host verschillen te sterk om zo'n getal een betrouwbare veiligheidspoort
// te maken. Een niet-positieve/niet-eindige meting is wél rood, want dan meet de probe niet echt.
const MAX_DELTA_DOCUMENT_WRITES = 1;
const REQUIRED_DELTA_MANIFEST_WRITES = 1;
const OZB_RECOVERY_DOCUMENTS = 12;

function installFakeIndexedDb(): RecoveryStorageWrites {
  const records = new Map<string, unknown>();
  const writes: RecoveryStorageWrites = { documents: 0, manifests: 0, readwriteTransactions: 0 };
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    close: () => undefined,
    onversionchange: null as (() => void) | null,
    transaction: (_store: string, mode: string) => {
      if (mode === 'readwrite') writes.readwriteTransactions += 1;
      const tx = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
        objectStore: () => ({
          getAll: () => {
            const request = { result: [] as unknown[], error: null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
            queueMicrotask(() => { request.result = [...records.values()]; request.onsuccess?.(); });
            return request;
          },
          put: (value: { id: string }) => {
            if (value.id.includes('::doc::')) writes.documents += 1;
            if (value.id.endsWith('::manifest')) writes.manifests += 1;
            records.set(value.id, structuredClone(value));
            queueMicrotask(() => tx.oncomplete?.());
          },
          delete: (id: string) => {
            records.delete(id);
            queueMicrotask(() => tx.oncomplete?.());
          },
        }),
      };
      return tx;
    },
  };
  const fakeIndexedDb = {
    open: () => {
      const request = {
        result: fakeDb,
        error: null,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
      return request;
    },
  };
  (globalThis as unknown as { window: object }).window = {};
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = fakeIndexedDb;
  return writes;
}

async function runProbe(label: string, mode: ProbeMode, filePath: string): Promise<RecoveryProbe> {
  const storageWrites = installFakeIndexedDb();
  const started = performance.now();
  const bytes = new Uint8Array(readFileSync(filePath));
  const opened = readXER(bytes);
  const imported = isMultiDocumentImport(opened) ? opened.results : [opened];
  const archive = imported[0]?.xerSourceArchive;
  if (!archive) throw new Error(`${label}: XER mist bronarchief`);

  const state = useAppStore.getState();
  state.newProject();
  state.applyOpenedImport(opened, {
    filePath: null, fileHandle: null, recompute: false, fit: false,
    hourDataNotice: false, linkedOpen: false,
  });
  const docs = useAppStore.getState().getOpenDocumentPayloads();
  const ifcs = docs.map(document => writeIFC(buildWriteIFCInput(document.payload)));
  const independent = ifcs.map(ifc => readIFC(ifc));
  const exactBytes = independent.every(result => result.xerSourceArchive !== undefined
    && sha256Hex(decodeXerSourceArchive(result.xerSourceArchive)) === archive.sha256);

  let recoveredDocuments = 0;
  let recoveredArchives = 0;
  let deltaDocumentWrites = 0;
  let deltaManifestWrites = 0;
  let deltaWriteIfcCalls = 0;
  let deltaEditRestored = false;
  if (mode === 'recovery') {
    await clearRecovery();
    await saveRecovery(fullRecoverySave(docs[0]!.id, docs.map((document, index) => ({
      id: document.id,
      ifc: ifcs[index]!,
      filePath: null,
      isDirty: true,
    }))));
    storageWrites.documents = 0;
    storageWrites.manifests = 0;
    storageWrites.readwriteTransactions = 0;

    // Een echte documentedit produceert één nieuwe IFC-tekst. De storagegrens krijgt daarnaast
    // alle twaalf manifestregels, maar precies één zware upsert — de cruciale OZB-regressie.
    const editedPayload = {
      ...docs[0]!.payload,
      project: { ...docs[0]!.payload.project, description: '__x9-recovery-delta__' },
    };
    const editedIfc = writeIFC(buildWriteIFCInput(editedPayload));
    deltaWriteIfcCalls = 1;
    await saveRecovery({
      activeDocumentId: docs[0]!.id,
      documents: docs.map((document) => ({ id: document.id, filePath: null, isDirty: true })),
      upserts: [{ id: docs[0]!.id, ifc: editedIfc, filePath: null, isDirty: true }],
    });
    deltaDocumentWrites = storageWrites.documents;
    deltaManifestWrites = storageWrites.manifests;
    if (storageWrites.readwriteTransactions !== 1) {
      throw new Error(`${label}: recoverydelta gebruikte ${storageWrites.readwriteTransactions} readwrite-transacties`);
    }
    const loaded = await loadRecovery();
    deltaEditRestored = readIFC(loaded.docs.find((document) => document.id === docs[0]!.id)!.ifc)
      .project.description === '__x9-recovery-delta__';
    const inputs = loaded.docs.map(document => recoveryInputFromParsed(
      readIFC(document.ifc),
      { id: document.id, filePath: document.filePath, isDirty: document.isDirty },
    ));
    useAppStore.getState().restoreDocuments(inputs, loaded.activeDocumentId);
    const recovered = useAppStore.getState().getOpenDocumentPayloads();
    recoveredDocuments = recovered.length;
    recoveredArchives = new Set(recovered.map(document => document.payload.xerSourceArchive)).size;
    await clearRecovery();
  }

  return {
    label,
    mode,
    sourceBytes: bytes.length,
    documents: docs.length,
    ifcChars: ifcs.reduce((total, ifc) => total + ifc.length, 0),
    elapsedMs: performance.now() - started,
    // De probe is een vers Node-proces: dit is de OS-piek van de volledige keten, geen heapdelta.
    peakRssKiB: process.resourceUsage().maxRSS,
    recoveredDocuments,
    recoveredArchives,
    exactBytes,
    deltaDocumentWrites,
    deltaManifestWrites,
    deltaWriteIfcCalls,
    deltaEditRestored,
  };
}

function runChild(label: string, mode: ProbeMode, filePath: string): RecoveryProbe {
  const entry = process.argv[1];
  if (!entry) throw new Error('X9-recoveryprobe mist eigen bundelpad');
  const output = execFileSync(process.execPath, [entry, '--x9-recovery-probe', label, mode, filePath], {
    cwd: process.cwd(), encoding: 'utf8', env: process.env,
  });
  const line = output.trim().split('\n').find(value => value.startsWith('X9_RECOVERY_PROBE '));
  if (!line) throw new Error(`${label}: recoveryprobe gaf geen meetregel terug`);
  return JSON.parse(line.slice('X9_RECOVERY_PROBE '.length)) as RecoveryProbe;
}

const probeArgs = process.argv.slice(2);
if (probeArgs[0] === '--x9-recovery-probe') {
  const [_, label, mode, filePath] = probeArgs;
  if (!label || (mode !== 'ifc' && mode !== 'recovery') || !filePath) {
    throw new Error('X9-recoveryprobe kreeg ongeldige argumenten');
  }
  console.log(`X9_RECOVERY_PROBE ${JSON.stringify(await runProbe(label, mode, filePath))}`);
  process.exit(0);
}

const root = process.env.OPS_XER_CORPUS;
const rehab = root ? join(root, 'crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer') : '';
const ozb = root ? join(root, 'crawl-xer/eh_P6Workshops/OZB-Start-09Dec24.xer') : '';
if (!root || !existsSync(rehab) || !existsSync(ozb)) {
  console.log('OK  X9-recovery-corpus: rehab-2/OZB niet aanwezig — corpusprobe overgeslagen');
} else {
  const probes = [
    runChild('rehab-2 zelfstandige compacte IFC-ronde', 'ifc', rehab),
    runChild('rehab-2 recovery', 'recovery', rehab),
    runChild('OZB recovery', 'recovery', ozb),
  ];
  const failures: string[] = [];
  let checks = 0;
  const expect = (label: string, condition: boolean): void => {
    checks += 1;
    if (!condition) failures.push(label);
  };
  for (const probe of probes) {
    expect(`${probe.label}: bron, tijd en OS-peak RSS zijn werkelijk gemeten`,
      probe.sourceBytes > 0 && probe.documents > 0 && Number.isFinite(probe.elapsedMs) && probe.elapsedMs >= 0
      && Number.isFinite(probe.peakRssKiB) && probe.peakRssKiB > 0);
    expect(`${probe.label}: iedere compacte IFC herleest de exacte bronbytes`, probe.exactBytes);
    if (probe.mode === 'recovery') {
      expect(`${probe.label}: recovery herstelt elk document en canoniseert het gedeelde archief`,
        probe.recoveredDocuments === probe.documents && probe.recoveredArchives === 1);
      expect(`${probe.label}: één documentedit schrijft één IFC en één snapshotrecord, niet alle documenten`,
        probe.deltaWriteIfcCalls === 1
        && probe.deltaDocumentWrites === MAX_DELTA_DOCUMENT_WRITES
        && probe.deltaManifestWrites === REQUIRED_DELTA_MANIFEST_WRITES
        && probe.deltaEditRestored);
    }
  }
  const ozbProbe = probes[2]!;
  expect('OZB recovery: de publieke 15-projectenfixture herstelt precies twaalf niet-lege documenten',
    ozbProbe.documents === OZB_RECOVERY_DOCUMENTS
    && ozbProbe.recoveredDocuments === OZB_RECOVERY_DOCUMENTS);
  console.log(`X9 recovery corpus: ${probes.map(probe =>
    `${probe.label}: docs=${probe.documents} source=${probe.sourceBytes} ifc=${probe.ifcChars} time=${probe.elapsedMs.toFixed(1)}ms peak-rss=${probe.peakRssKiB}KiB delta-ifc=${probe.deltaDocumentWrites} delta-manifest=${probe.deltaManifestWrites}`
  ).join(' | ')}`);
  if (failures.length > 0) {
    console.log(`XX  xer-archive-recovery-corpus: ${failures.length} afwijking(en)`);
    for (const failure of failures) console.log(`   - ${failure}`);
    process.exit(1);
  }
  console.log(`OK  xer-archive-recovery-corpus: alle ${checks} corpuschecks groen`);
}
