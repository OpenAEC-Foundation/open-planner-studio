// X9-compactopslag — verse corpusprocessen meten de volledige IFC- en recoveryketen eerlijk.
// Sinds 2026-10-07 (eigenaarsbesluit plan (9), "bronarchief één keer schrijven") loopt de recoveryprobe
// over de echte tick (`runRecoveryTick`) en het echte herstel via de archiefverwijzing, en is er een
// budgetpoort: een bewerkingstick schrijft geen archiefbytes en blijft onder de helft van de bron.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { clearRecovery, loadRecovery } from '@/services/recovery/recoveryStore';
import { RecoveryDeltaTracker, type RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { readXER } from '@/services/xer/xerReader';
import { decodeXerSourceArchive, sha256Hex } from '@/services/xerSourceArchive';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed, type RecoveryDocInput } from '@/state/documentContract';
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
  deltaEditRestored: boolean;
  /** Bytes die de bewerkingstick naar de opslag schreef (snapshots + manifest + archiefblobs). */
  editTickBytes: number;
  /** Lengte van de INGEBEDDE IFC van het bewerkte document (de oude snapshotvorm), ter vergelijking. */
  editedEmbeddedIfcChars: number;
  /** Archiefbytes in de bewerkingstick (moet 0 zijn). */
  editTickArchiveBytes: number;
  /** Archiefblobs na de eerste tick (twaalf documenten uit één bestand ⇒ 1). */
  archiveBlobs: number;
  firstTickMs: number;
  editTickMs: number;
  restoreMs: number;
}

interface RecoveryStorageWrites {
  documents: number;
  manifests: number;
  readwriteTransactions: number;
  recordBytes: number;
  archiveBytes: number;
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
const EDIT_TICK_ARCHIVE_SAVING = 1.3;
/** Manifest en recordsleutels van één tick. */
const EDIT_TICK_SLACK_BYTES = 64 * 1024;

const sizeOf = (value: unknown): number => {
  if (typeof value === 'string') return value.length;
  if (value instanceof Uint8Array) return value.byteLength;
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + sizeOf(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce((sum: number, item) => sum + sizeOf(item), 0);
  return 0;
};

function installFakeIndexedDb(): { writes: RecoveryStorageWrites; archiveBlobs: () => number } {
  const writes: RecoveryStorageWrites = { documents: 0, manifests: 0, readwriteTransactions: 0, recordBytes: 0, archiveBytes: 0 };
  const idb = installFakeRecoveryIndexedDb({
    onTransaction: (mode) => { if (mode === 'readwrite') writes.readwriteTransactions += 1; },
    onPut: (store, value) => {
      if (store === 'xer-archives') { writes.archiveBytes += sizeOf(value); return; }
      writes.recordBytes += sizeOf(value);
      if (value.id.includes('::doc::')) writes.documents += 1;
      if (value.id.endsWith('::manifest')) writes.manifests += 1;
    },
  });
  return { writes, archiveBlobs: () => idb.store('xer-archives').size };
}

async function runProbe(label: string, mode: ProbeMode, filePath: string): Promise<RecoveryProbe> {
  const { writes: storageWrites, archiveBlobs: countArchiveBlobs } = installFakeIndexedDb();
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
  let deltaEditRestored = false;
  let editTickBytes = 0;
  let editTickArchiveBytes = 0;
  let editedEmbeddedIfcChars = 0;
  let archiveBlobs = 0;
  let firstTickMs = 0;
  let editTickMs = 0;
  let restoreMs = 0;
  let restoredExact = true;
  if (mode === 'recovery') {
    await clearRecovery();
    // De echte auto-save-tick (`useAutoSave` → `runRecoveryTick`): delta, serialisatie met
    // archiefverwijzing, opslag (blob één keer) en pas daarna de persistentiebasis.
    const tracker = new RecoveryDeltaTracker();
    const recoveryDocs = (): RecoverySourceDocument[] => useAppStore.getState().getOpenDocumentPayloads()
      .map(({ id, payload }) => ({
        id, source: payload, filePath: null, isDirty: true, datesAsRecorded: false,
      }));
    const activeId = docs[0]!.id;
    let started = performance.now();
    await runRecoveryTick(tracker, activeId, recoveryDocs());
    firstTickMs = performance.now() - started;
    archiveBlobs = countArchiveBlobs();
    Object.assign(storageWrites, { documents: 0, manifests: 0, readwriteTransactions: 0, recordBytes: 0, archiveBytes: 0 });

    // Eén echte documentedit. De storagegrens krijgt alle manifestregels, maar precies één
    // zware upsert — en geen archiefbytes (eigenaarsbesluit plan (9)).
    useAppStore.getState().switchDocument(activeId);
    useAppStore.getState().setProject({ description: '__x9-recovery-delta__' });
    started = performance.now();
    await runRecoveryTick(tracker, activeId, recoveryDocs());
    editTickMs = performance.now() - started;
    deltaDocumentWrites = storageWrites.documents;
    deltaManifestWrites = storageWrites.manifests;
    editTickBytes = storageWrites.recordBytes + storageWrites.archiveBytes;
    editTickArchiveBytes = storageWrites.archiveBytes;
    const edited = useAppStore.getState().getOpenDocumentPayloads().find((document) => document.id === activeId)!;
    editedEmbeddedIfcChars = writeIFC(buildWriteIFCInput(edited.payload)).length;
    if (storageWrites.readwriteTransactions !== 1) {
      throw new Error(`${label}: recoverydelta gebruikte ${storageWrites.readwriteTransactions} readwrite-transacties`);
    }

    // Herstel zoals `useRecoveryRestore`: de bronbytes komen via de verwijzing uit de opslag.
    started = performance.now();
    const loaded = await loadRecovery();
    const inputs: RecoveryDocInput[] = [];
    for (const document of loaded.docs) {
      const parsed = await readIFCWithXerReconstruction(document.ifc, {}, {
        resolveXerArchiveReference: (sha256) => loaded.archives.get(sha256),
      });
      if (document.id === activeId) deltaEditRestored = parsed.project.description === '__x9-recovery-delta__';
      restoredExact &&= parsed.xerSourceArchive !== undefined
        && sha256Hex(decodeXerSourceArchive(parsed.xerSourceArchive)) === archive.sha256;
      inputs.push(recoveryInputFromParsed(parsed, {
        id: document.id, filePath: document.filePath, isDirty: document.isDirty, datesAsRecorded: document.datesAsRecorded,
      }));
    }
    useAppStore.getState().restoreDocuments(inputs, loaded.activeDocumentId);
    restoreMs = performance.now() - started;
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
    exactBytes: exactBytes && restoredExact,
    deltaDocumentWrites,
    deltaManifestWrites,
    deltaEditRestored,
    editTickBytes,
    editTickArchiveBytes,
    editedEmbeddedIfcChars,
    archiveBlobs,
    firstTickMs,
    editTickMs,
    restoreMs,
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
        probe.deltaDocumentWrites === MAX_DELTA_DOCUMENT_WRITES
        && probe.deltaManifestWrites === REQUIRED_DELTA_MANIFEST_WRITES
        && probe.deltaEditRestored);
      // Budgetpoort (eigenaarsbesluit plan (9)): machine-onafhankelijk in bytes. Het ingebedde archief
      // kost ≥ 1,33 tekens per bronbyte (`check-xer-archive-scale.ts`). De bewerkingstick moet dus
      // minstens 1,3 × de bron MINDER schrijven dan de oude, ingebedde snapshot van datzelfde document,
      // en nul archiefbytes. De rest van de tick is de planning zelf (rehab-2: ±35 MB IFC zonder archief)
      // en valt buiten deze poort.
      expect(`${probe.label}: bewerkingstick schrijft geen archiefbytes en ≥ ${EDIT_TICK_ARCHIVE_SAVING} × bron minder dan een ingebedde snapshot (gemeten ${probe.editTickBytes} B, ingebed ${probe.editedEmbeddedIfcChars} tekens)`,
        probe.editTickArchiveBytes === 0
        && probe.editTickBytes + EDIT_TICK_ARCHIVE_SAVING * probe.sourceBytes <= probe.editedEmbeddedIfcChars + EDIT_TICK_SLACK_BYTES);
      expect(`${probe.label}: alle documenten uit één bestand delen één archiefblob (gemeten ${probe.archiveBlobs})`,
        probe.archiveBlobs === 1);
      expect(`${probe.label}: tick- en hersteltijden zijn werkelijk gemeten`,
        [probe.firstTickMs, probe.editTickMs, probe.restoreMs].every((ms) => Number.isFinite(ms) && ms >= 0));
    }
  }
  const ozbProbe = probes[2]!;
  expect('OZB recovery: de publieke 15-projectenfixture herstelt precies twaalf niet-lege documenten',
    ozbProbe.documents === OZB_RECOVERY_DOCUMENTS
    && ozbProbe.recoveredDocuments === OZB_RECOVERY_DOCUMENTS);
  console.log(`X9 recovery corpus: ${probes.map(probe =>
    `${probe.label}: docs=${probe.documents} source=${probe.sourceBytes} ifc=${probe.ifcChars} time=${probe.elapsedMs.toFixed(1)}ms peak-rss=${probe.peakRssKiB}KiB delta-ifc=${probe.deltaDocumentWrites} delta-manifest=${probe.deltaManifestWrites}`
    + (probe.mode === 'recovery'
      ? ` tick1=${probe.firstTickMs.toFixed(0)}ms edit-tick=${probe.editTickBytes}B/${probe.editTickMs.toFixed(1)}ms restore=${probe.restoreMs.toFixed(0)}ms blobs=${probe.archiveBlobs}`
      : '')
  ).join(' | ')}`);
  if (failures.length > 0) {
    console.log(`XX  xer-archive-recovery-corpus: ${failures.length} afwijking(en)`);
    for (const failure of failures) console.log(`   - ${failure}`);
    process.exit(1);
  }
  console.log(`OK  xer-archive-recovery-corpus: alle ${checks} corpuschecks groen`);
}
