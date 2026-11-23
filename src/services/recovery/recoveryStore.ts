import { cleanupRecoverySourceCopies, sourceCopyReferenceKey, writeRecoverySourceCopy, type RecoverySourceCopy } from './recoverySourceCopies';
import { ifcSourceMetaFields, type RecoveryIfcSource } from './recoveryIfcSource';
import { isTauri } from '@/utils/platform';
import { IndexedDbUpgradeBlockedError, openDbStores } from '@/utils/idb';
import {
  ownRecoveryNames, recoveryTmpSuffix,
  type RecoveryNames, type RecoveryManifest, type RecoveryManifestDoc,
} from '@/services/recovery/recoveryPaths';
import { writeBytesFileAtomic, writeTextFileAtomic } from '@/services/fileAccess/atomicWrite';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { parseForeignSourceTarget, sameForeignSourceTarget, type ForeignSourceTarget } from '@/services/ifc/foreign/foreignSourceMark';
import { checkRecoveryDocumentIds, checkRecoveryDocuments, checkRecoveryManifestVersion, RecoveryManifestError, RECOVERY_MANIFEST_VERSION } from './recoveryManifest';
export { RECOVERY_MANIFEST_VERSION, RecoveryManifestError } from './recoveryManifest';

export interface RecoveryDocContent {
  id: string;
  ifc: string;
  filePath: string | null;
  isDirty: boolean;
  datesAsRecorded: boolean;
  xerArchive?: string;
  siteFileId?: string | null;
  siteFileVersion?: string | null;
  foreignSource?: ForeignSourceTarget | null;
  ifcSource?: RecoveryIfcSource;
}

export function recoverySiteMeta(record: object | null | undefined): {
  siteFileId: string | null;
  siteFileVersion: string | null;
} {
  const d = (record ?? {}) as { siteFileId?: unknown; siteFileVersion?: unknown };
  const siteFileId = typeof d.siteFileId === 'string' && d.siteFileId.length > 0 ? d.siteFileId : null;
  const siteFileVersion = siteFileId && typeof d.siteFileVersion === 'string' && d.siteFileVersion.length > 0
    ? d.siteFileVersion
    : null;
  return { siteFileId, siteFileVersion };
}

export function sameRecoverySiteMeta(
  a: { siteFileId?: string | null; siteFileVersion?: string | null },
  b: { siteFileId?: string | null; siteFileVersion?: string | null },
): boolean {
  return (a.siteFileId ?? null) === (b.siteFileId ?? null)
    && (a.siteFileVersion ?? null) === (b.siteFileVersion ?? null);
}

export interface RecoveryDocMetadata {
  id: string;
  filePath: string | null;
  isDirty: boolean;
  datesAsRecorded: boolean;
  xerArchive?: string;
  siteFileId?: string | null;
  siteFileVersion?: string | null;
  foreignSource?: ForeignSourceTarget | null;
  ifcSource?: RecoveryIfcSource;
}

export type RecoveryArchiveSupplier = () => Uint8Array;

export interface RecoverySaveInput {
  activeDocumentId: string | null;
  documents: RecoveryDocMetadata[];
  upserts: RecoveryDocContent[];
  archives?: ReadonlyMap<string, RecoveryArchiveSupplier>;
  ifcSourceCopies?: ReadonlyMap<string, RecoverySourceCopy>;
  onSourceCopyFailure?: (documentId: string) => void;
}

export function fullRecoverySave(
  activeDocumentId: string | null,
  docs: RecoveryDocContent[],
  archives?: ReadonlyMap<string, RecoveryArchiveSupplier>,
): RecoverySaveInput {
  return {
    activeDocumentId,
    documents: docs.map(({ id, filePath, isDirty, datesAsRecorded, xerArchive, siteFileId, siteFileVersion, foreignSource, ifcSource }) => ({
      id, filePath, isDirty, datesAsRecorded, ...(xerArchive ? { xerArchive } : {}),
      ...siteMetaFields({ siteFileId, siteFileVersion }),
      ...foreignSourceMetaFields({ foreignSource }),
      ...ifcSourceMetaFields({ ifcSource }),
    })),
    upserts: docs,
    ...(archives ? { archives } : {}),
  };
}

function referencedArchives(input: RecoverySaveInput): Set<string> {
  const out = new Set<string>();
  for (const document of input.documents) {
    if (!document.xerArchive) continue;
    if (!/^[0-9a-f]{64}$/.test(document.xerArchive)) {
      throw new Error(`Recovery: ongeldige archiefverwijzing voor ${JSON.stringify(document.id)}.`);
    }
    if (!input.archives?.has(document.xerArchive)) {
      throw new Error(`Recovery: archiefverwijzing van ${JSON.stringify(document.id)} heeft geen bronbytes.`);
    }
    out.add(document.xerArchive);
  }
  return out;
}

function suppliedArchiveBytes(input: RecoverySaveInput, sha256: string): Uint8Array {
  const bytes = input.archives!.get(sha256)!();
  if (!(bytes instanceof Uint8Array)) throw new Error('Recovery: archiefleverancier gaf geen bytes.');
  return bytes;
}

export interface LoadedRecoveryDoc extends RecoveryDocContent {
  mtime: Date | null;
  sourceCopyDocumentKey?: string;
}

export interface LoadedRecovery {
  readFailures?: readonly { id: string; detail: string }[];
  activeDocumentId: string | null;
  docs: LoadedRecoveryDoc[];
  archives: ReadonlyMap<string, Uint8Array>;
}

const names = ownRecoveryNames;
const manifestName = names.manifest;
const legacyFile = names.legacy;

const TMP_SUFFIX = recoveryTmpSuffix;

export function siteMetaFields(record: object | null | undefined):
  { siteFileId?: string; siteFileVersion?: string } {
  const { siteFileId, siteFileVersion } = recoverySiteMeta(record);
  if (!siteFileId) return {};
  return siteFileVersion ? { siteFileId, siteFileVersion } : { siteFileId };
}

export function foreignSourceMetaFields(record: object | null | undefined): { foreignSource?: ForeignSourceTarget } {
  const foreignSource = parseForeignSourceTarget((record as { foreignSource?: unknown } | null | undefined)?.foreignSource);
  return foreignSource ? { foreignSource } : {};
}

export function sameRecoveryForeignSource(
  a: { foreignSource?: ForeignSourceTarget | null },
  b: { foreignSource?: ForeignSourceTarget | null },
): boolean {
  return sameForeignSourceTarget(a.foreignSource, b.foreignSource);
}

function newRecoveryId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `inst-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
}
const instanceId = newRecoveryId();

const ownWritten = new Set<string>();
const adoptedIfc = new Set<string>();
const restoredIfc = new Set<string>();
const ownWrittenArchives = new Set<string>();

export type ManifestOwnership = 'none' | 'own' | 'legacy' | 'foreign';

export function manifestOwnership(prev: RecoveryManifest | null, self: string): ManifestOwnership {
  if (!prev) return 'none';
  if (typeof prev.ownerId !== 'string' || prev.ownerId === '') return 'legacy';
  return prev.ownerId === self ? 'own' : 'foreign';
}

export interface RecoveryCleanupInput {
  listing: string[];
  prev: RecoveryManifest | null;
  self: string;
  keep: string[];
  ownWritten: string[];
  adopted: string[];
  replaced?: string[];
  names: RecoveryNames;
  keepArchives?: string[];
  ownWrittenArchives?: string[];
}

export interface RecoveryCleanupPlan {
  ownership: ManifestOwnership;
  remove: string[];
  carryOver: RecoveryManifestDoc[];
}

function archiveRemovals(
  candidates: Iterable<string>, referenced: ReadonlySet<string>, present: ReadonlySet<string>, n: RecoveryNames,
): string[] {
  const remove: string[] = [];
  for (const sha of new Set(candidates)) {
    if (referenced.has(sha) || !/^[0-9a-f]{64}$/.test(sha)) continue;
    const name = n.archiveName(sha);
    if (present.has(name)) remove.push(name);
    if (present.has(name + recoveryTmpSuffix)) remove.push(name + recoveryTmpSuffix);
  }
  return remove;
}

export function planRecoveryCleanup(input: RecoveryCleanupInput): RecoveryCleanupPlan {
  const { listing, prev, self, keep, names: n } = input;
  const ownership = manifestOwnership(prev, self);
  const present = new Set(listing);
  const keepSet = new Set(keep);
  const replaced = new Set(input.replaced ?? []);
  const adopted = new Set(input.adopted.filter(name => !replaced.has(name)));

  const candidates = new Set<string>();
  if (prev && (ownership === 'own' || ownership === 'legacy')) {
    for (const d of prev.documents) {
      if (d && typeof d.ifc === 'string') candidates.add(d.ifc);
    }
  }
  for (const name of input.ownWritten) candidates.add(name);
  for (const name of replaced) candidates.add(name);

  const remove: string[] = [];
  for (const name of candidates) {
    if (keepSet.has(name) || adopted.has(name)) continue;
    if (n.snapshotDocId(name) === null) continue;
    if (present.has(name)) remove.push(name);
    if (present.has(name + recoveryTmpSuffix)) remove.push(name + recoveryTmpSuffix);
  }

  const keepArchiveNames = (input.keepArchives ?? []).map((sha) => n.archiveName(sha));
  for (const name of [...keep, ...keepArchiveNames, n.manifest]) {
    const tmp = name + recoveryTmpSuffix;
    if (present.has(tmp) && !remove.includes(tmp)) remove.push(tmp);
  }

  const carryOver: RecoveryManifestDoc[] = [];
  if (prev) {
    for (const d of prev.documents) {
      if (!d || typeof d.ifc !== 'string' || typeof d.id !== 'string') continue;
      if (ownership !== 'foreign' && !adopted.has(d.ifc)) continue;
      if (replaced.has(d.ifc)) continue;
      if (keepSet.has(d.ifc)) continue;
      if (!present.has(d.ifc)) continue;
      carryOver.push({
        id: d.id, ifc: d.ifc, filePath: d.filePath ?? null, isDirty: d.isDirty ?? true,
        datesAsRecorded: d.datesAsRecorded ?? false,
        ...(typeof d.xerArchive === 'string' ? { xerArchive: d.xerArchive } : {}),
        ...siteMetaFields(d),
        ...foreignSourceMetaFields(d),
        ...ifcSourceMetaFields(d),
      });
    }
  }

  const referencedArchives = new Set([
    ...(input.keepArchives ?? []),
    ...carryOver.flatMap((d) => (d.xerArchive ? [d.xerArchive] : [])),
  ]);
  const archiveCandidates = [...(input.ownWrittenArchives ?? [])];
  if (prev && (ownership === 'own' || ownership === 'legacy')) {
    for (const d of prev.documents) if (d && typeof d.xerArchive === 'string') archiveCandidates.push(d.xerArchive);
  }
  for (const d of prev?.documents ?? []) {
    if (replaced.has(d.ifc) && typeof d.xerArchive === 'string') archiveCandidates.push(d.xerArchive);
  }
  for (const name of archiveRemovals(archiveCandidates, referencedArchives, present, n)) {
    if (!remove.includes(name)) remove.push(name);
  }

  return { ownership, remove, carryOver };
}

export function planRecoveryClear(
  listing: string[],
  manifest: RecoveryManifest | null,
  n: RecoveryNames,
): string[] {
  const out = new Set<string>();
  for (const name of listing) {
    if (n.isOwnFile(name)) out.add(name);
  }
  for (const d of manifest?.documents ?? []) {
    if (d && typeof d.ifc === 'string' && n.snapshotDocId(d.ifc) !== null) out.add(d.ifc);
    if (d && typeof d.xerArchive === 'string' && /^[0-9a-f]{64}$/.test(d.xerArchive)) out.add(n.archiveName(d.xerArchive));
  }
  return [...out];
}

export function planRecoveryExitClear(input: {
  listing: string[];
  manifest: RecoveryManifest | null;
  self: string;
  ownWritten: string[];
  adopted: string[];
  names: RecoveryNames;
  ownWrittenArchives?: string[];
}): { remove: string[]; manifest: 'keep' | 'remove' | RecoveryManifestDoc[] } {
  const present = new Set(input.listing);
  const adopted = new Set(input.adopted);
  const remove: string[] = [];
  for (const name of input.ownWritten) {
    if (adopted.has(name) || input.names.snapshotDocId(name) === null) continue;
    if (present.has(name)) remove.push(name);
    if (present.has(name + recoveryTmpSuffix)) remove.push(name + recoveryTmpSuffix);
  }
  const ownManifest = manifestOwnership(input.manifest, input.self) === 'own';
  const removed = new Set(remove);
  const kept = ownManifest
    ? (input.manifest?.documents ?? []).filter((d) =>
      d && typeof d.ifc === 'string' && adopted.has(d.ifc) && !removed.has(d.ifc) && present.has(d.ifc))
    : [];
  const stillReferenced = new Set(
    (ownManifest ? kept : (input.manifest?.documents ?? []))
      .flatMap((d) => (d && typeof d.xerArchive === 'string' ? [d.xerArchive] : [])),
  );
  remove.push(...archiveRemovals(input.ownWrittenArchives ?? [], stillReferenced, present, input.names));
  if (!ownManifest) return { remove, manifest: 'keep' };
  return { remove, manifest: kept.length > 0 ? kept : 'remove' };
}

async function readSnapshotTauri(path: string): Promise<{ ifc: string; mtime: Date | null }> {
  const { readTextFile, stat } = await import('@tauri-apps/plugin-fs');
  const ifc = await readTextFile(path);
  let mtime: Date | null = null;
  try { mtime = (await stat(path)).mtime; } catch { }
  return { ifc, mtime };
}

async function listAppDataTauri(dir: string): Promise<string[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs');
  try {
    return (await readDir(dir)).map((e) => e.name).filter((n): n is string => !!n);
  } catch (err) {
    console.error('Recovery: kon de appDataDir niet doorlopen bij het opruimen:', err);
    return [];
  }
}

function checkedUpserts(input: RecoverySaveInput): Map<string, RecoveryDocContent> {
  const documentIds = new Set<string>();
  for (const document of input.documents) {
    if (!document.id || documentIds.has(document.id)) {
      throw new Error(`Recovery: ongeldige of dubbele manifestdocument-id ${JSON.stringify(document.id)}.`);
    }
    documentIds.add(document.id);
  }
  const upserts = new Map<string, RecoveryDocContent>();
  for (const document of input.upserts) {
    if (!documentIds.has(document.id) || upserts.has(document.id)) {
      throw new Error(`Recovery: upsert ${JSON.stringify(document.id)} hoort niet uniek bij het manifest.`);
    }
    const metadata = input.documents.find((candidate) => candidate.id === document.id)!;
    if (document.filePath !== metadata.filePath || document.isDirty !== metadata.isDirty
      || document.datesAsRecorded !== metadata.datesAsRecorded
      || (document.xerArchive ?? null) !== (metadata.xerArchive ?? null)
      || !sameRecoverySiteMeta(document, metadata)
      || !sameRecoveryForeignSource(document, metadata)) {
      throw new Error(`Recovery: upsertmetadata voor ${JSON.stringify(document.id)} wijkt af van het manifest.`);
    }
    upserts.set(document.id, document);
  }
  return upserts;
}

interface TauriSnapshotWrite {
  name: string;
  ifc: string;
}

export function planTauriV3RecoverySave(
  previous: RecoveryManifest | null,
  input: RecoverySaveInput,
  generation: string,
  recoveryNames: RecoveryNames,
): { documents: RecoveryManifestDoc[]; writes: TauriSnapshotWrite[] } {
  const upserts = checkedUpserts(input);
  const previousById = new Map((previous?.documents ?? []).map((document) => [document.id, document]));
  const documents: RecoveryManifestDoc[] = [];
  const writes: TauriSnapshotWrite[] = [];

  for (const metadata of input.documents) {
    const changed = upserts.get(metadata.id);
    if (changed) {
      const ifc = recoveryNames.generationIfcName(metadata.id, generation);
      documents.push({
        id: metadata.id, ifc, filePath: metadata.filePath, isDirty: metadata.isDirty,
        datesAsRecorded: metadata.datesAsRecorded,
        ...(metadata.xerArchive ? { xerArchive: metadata.xerArchive } : {}),
        ...siteMetaFields(metadata),
        ...foreignSourceMetaFields(metadata),
        ...ifcSourceMetaFields(metadata),
      });
      writes.push({ name: ifc, ifc: changed.ifc });
      continue;
    }
    const previousDocument = previousById.get(metadata.id);
    if (!previousDocument) {
      throw new Error(`Recovery: ${JSON.stringify(metadata.id)} heeft geen vorige snapshot en geen upsert.`);
    }
    documents.push({
      id: metadata.id, ifc: previousDocument.ifc, filePath: metadata.filePath,
      isDirty: metadata.isDirty, datesAsRecorded: metadata.datesAsRecorded,
      ...(metadata.xerArchive ? { xerArchive: metadata.xerArchive } : {}),
      ...siteMetaFields(metadata),
      ...foreignSourceMetaFields(metadata),
      ...ifcSourceMetaFields(metadata),
    });
  }

  return { documents, writes };
}

let generationCounter = 0;
function nextRecoveryGeneration(): string {
  generationCounter += 1;
  return `${Date.now().toString(36)}-${generationCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function existingTauriManifest(dir: string): Promise<RecoveryManifest | null> {
  const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const path = await join(dir, manifestName);
  if (!(await exists(path))) return null;
  const manifest = parseRecoveryManifest(await readTextFile(path));
  if (!manifest) throw new RecoveryManifestError('invalid-shape');
  return manifest;
}

async function saveTauri(input: RecoverySaveInput): Promise<void> {
  const { exists, remove, mkdir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const prev = await existingTauriManifest(dir);
  await mkdir(dir, { recursive: true });

  const writeAtomic = (name: string, text: string) => writeTextFileAtomic(dir, name, text, TMP_SUFFIX);

  const snapshotPlan = planTauriV3RecoverySave(prev, input, nextRecoveryGeneration(), names);
  const keepArchives = [...referencedArchives(input)];
  for (const sha of keepArchives) {
    const name = names.archiveName(sha);
    if (await exists(await join(dir, name))) continue;
    await writeBytesFileAtomic(dir, name, suppliedArchiveBytes(input, sha), TMP_SUFFIX);
    ownWrittenArchives.add(sha);
  }
  for (const write of snapshotPlan.writes) {
    await writeAtomic(write.name, write.ifc);
    ownWritten.add(write.name);
  }
  const keep = snapshotPlan.documents.map((document) => document.ifc);

  const currentById = new Map(snapshotPlan.documents.map(document => [document.id, document.ifc]));
  const replaced = (prev?.documents ?? []).filter(document =>
    restoredIfc.has(document.ifc) && currentById.has(document.id)
    && currentById.get(document.id) !== document.ifc).map(document => document.ifc);
  const listing = await listAppDataTauri(dir);
  const plan = planRecoveryCleanup({
    listing, prev, self: instanceId, keep,
    ownWritten: [...ownWritten], adopted: [...adoptedIfc], replaced, names,
    keepArchives, ownWrittenArchives: [...ownWrittenArchives],
  });
  if (plan.ownership === 'foreign') {
    console.warn(
      `Recovery: het manifest is van een andere instantie (${prev?.ownerId}); ` +
      `${plan.carryOver.length} snapshot(s) blijven staan en worden meegenomen.`,
    );
  }
  for (const d of plan.carryOver) adoptedIfc.add(d.ifc);

  const currentIds = new Set(snapshotPlan.documents.map((document) => document.id));
  const manifest: RecoveryManifest = {
    version: RECOVERY_MANIFEST_VERSION,
    activeDocumentId: input.activeDocumentId,
    documents: [
      ...snapshotPlan.documents,
      ...plan.carryOver.filter((document) => !currentIds.has(document.id)),
    ],
    ownerId: instanceId,
    heartbeatAt: Date.now(),
  };
  await writeAtomic(manifestName, JSON.stringify(manifest));

  for (const name of replaced) {
    adoptedIfc.delete(name);
    restoredIfc.delete(name);
    ownWritten.add(name);
  }
  for (const name of plan.remove) {
    try { await remove(await join(dir, name)); } catch { }
    ownWritten.delete(name);
    const sha = names.archiveSha(name);
    if (sha) ownWrittenArchives.delete(sha);
  }
}

async function readArchivesTauri(dir: string, documents: readonly RecoveryManifestDoc[]): Promise<Map<string, Uint8Array>> {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const archives = new Map<string, Uint8Array>();
  for (const d of documents) {
    const sha = d?.xerArchive;
    if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha) || archives.has(sha)) continue;
    try {
      archives.set(sha, await readFile(await join(dir, names.archiveName(sha))));
    } catch (err) {
      console.error('Recovery: kon archiefblob niet lezen:', sha, err);
    }
  }
  return archives;
}

export function parseRecoveryManifest(raw: string): RecoveryManifest | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new RecoveryManifestError('invalid-shape');
  }
  const m = parsed as RecoveryManifest;
  checkRecoveryManifestVersion(m.version);
  checkRecoveryDocuments(m.documents);
  return m;
}

async function scanTauriSnapshots(): Promise<LoadedRecoveryDoc[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const docs: LoadedRecoveryDoc[] = [];

  for (const entry of await readDir(dir)) {
    const name = entry.name;
    const id = name ? names.stableSnapshotDocId(name) : null;
    if (!name || !id) continue;
    try {
      const { ifc, mtime } = await readSnapshotTauri(await join(dir, name));
      docs.push({ id, ifc, filePath: null, isDirty: true, datesAsRecorded: false, mtime });
    } catch (err) {
      console.error('Recovery: kon gescande snapshot niet lezen:', name, err);
    }
  }
  return docs;
}

async function loadTauri(): Promise<LoadedRecovery> {
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const manifestPath = await join(dir, manifestName);

  if (await exists(manifestPath)) {
    let raw = '';
    try { raw = await readTextFile(manifestPath); } catch (err) {
      console.error('Recovery: kon het manifest niet lezen:', err);
    }
    const manifest = raw ? parseRecoveryManifest(raw) : null;

    if (manifest) {
      const docs: LoadedRecoveryDoc[] = [];
      const readFailures: { id: string; detail: string }[] = [];
      for (const d of manifest.documents) {
        try {
          const { ifc, mtime } = await readSnapshotTauri(await join(dir, d.ifc));
          docs.push({
            id: d.id, ifc, filePath: d.filePath ?? null, isDirty: d.isDirty ?? true,
            datesAsRecorded: d.datesAsRecorded ?? false, mtime,
            ...(typeof d.xerArchive === 'string' ? { xerArchive: d.xerArchive } : {}),
            ...siteMetaFields(d),
            ...foreignSourceMetaFields(d),
            ...ifcSourceMetaFields(d),
          });
        } catch (err) {
          console.error('Recovery: kon documentsnapshot niet lezen:', d.id, err);
          readFailures.push({ id: d.id, detail: err instanceof Error ? err.message : String(err) });
        }
      }
      if (docs.length > 0 || readFailures.length > 0) {
        return {
          activeDocumentId: manifest.activeDocumentId ?? null, docs, readFailures,
          archives: await readArchivesTauri(dir, manifest.documents),
        };
      }
    } else {
      console.error('Recovery: manifest onleesbaar of vormvreemd — terugval op directory-scan.');
    }

    const scanned = await scanTauriSnapshots();
    if (scanned.length > 0) return { activeDocumentId: scanned[0].id, docs: scanned, archives: new Map() };
  }

  const legacyPath = await join(dir, legacyFile);
  if (await exists(legacyPath)) {
    const { ifc, mtime } = await readSnapshotTauri(legacyPath);
    return {
      activeDocumentId: 'legacy',
      docs: [{ id: 'legacy', ifc, filePath: null, isDirty: true, datesAsRecorded: false, mtime }],
      archives: new Map(),
    };
  }

  return { activeDocumentId: null, docs: [], archives: new Map() };
}

async function clearTauri(): Promise<void> {
  const { exists, remove } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();

  const manifest = await existingTauriManifest(dir);
  const manifestPath = await join(dir, manifestName);

  for (const name of planRecoveryClear(await listAppDataTauri(dir), manifest, names)) {
    try { await remove(await join(dir, name)); } catch { }
    ownWritten.delete(name);
    adoptedIfc.delete(name);
    restoredIfc.delete(name);
    const sha = names.archiveSha(name);
    if (sha) ownWrittenArchives.delete(sha);
  }
  if (await exists(manifestPath)) {
    try { await remove(manifestPath); } catch { }
  }
  const legacyPath = await join(dir, legacyFile);
  if (await exists(legacyPath)) {
    try { await remove(legacyPath); } catch { }
  }
}

async function clearOwnTauri(): Promise<void> {
  const { remove } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const manifestPath = await join(dir, manifestName);
  const manifest = await existingTauriManifest(dir);
  const plan = planRecoveryExitClear({
    listing: await listAppDataTauri(dir), manifest, self: instanceId,
    ownWritten: [...ownWritten], adopted: [...adoptedIfc], names,
    ownWrittenArchives: [...ownWrittenArchives],
  });
  if (plan.manifest === 'remove') {
    try { await remove(manifestPath); } catch { }
  } else if (plan.manifest !== 'keep' && manifest) {
    const next: RecoveryManifest = { ...manifest, documents: plan.manifest, heartbeatAt: Date.now() };
    if (!plan.manifest.some((d) => d.id === next.activeDocumentId)) next.activeDocumentId = plan.manifest[0].id;
    await writeTextFileAtomic(dir, manifestName, JSON.stringify(next), TMP_SUFFIX);
  }
  for (const name of plan.remove) {
    try { await remove(await join(dir, name)); } catch { }
    ownWritten.delete(name);
    const sha = names.archiveSha(name);
    if (sha) ownWrittenArchives.delete(sha);
  }
}

async function holdTauri(restoredDocumentIds: readonly string[]): Promise<void> {
  const { appDataDir } = await import('@tauri-apps/api/path');
  const manifest = await existingTauriManifest(await appDataDir());
  for (const d of manifest?.documents ?? []) {
    adoptedIfc.add(d.ifc);
    if (restoredDocumentIds.includes(d.id)) restoredIfc.add(d.ifc);
  }
}

const WEB_DB = 'ops-recovery';
const WEB_STORE = 'records';
const WEB_ARCHIVE_STORE = 'xer-archives';
const WEB_DB_VERSION = 3;
const WEB_KIND_INDEX = 'kind';
let webUpgradeBlocked: IndexedDbUpgradeBlockedError | null = null;

export class RecoveryStorageUnavailableError extends Error {
  constructor(readonly refusal?: unknown) {
    super('Crashherstel is niet beschikbaar: de browser weigert IndexedDB voor deze pagina.');
    this.name = 'RecoveryStorageUnavailableError';
  }
}

let webStorageUnavailable = false;
let webStorageProven = false;

export function recoveryStorageUnavailable(): boolean {
  return !isTauri() && webStorageUnavailable;
}

const isStorageRefusal = (error: unknown): boolean =>
  error instanceof RecoveryStorageUnavailableError
  || (!webStorageProven && typeof error === 'object' && error !== null
    && (error as { name?: unknown }).name === 'SecurityError');

function markStorageUnavailable(cause: unknown): RecoveryStorageUnavailableError {
  if (cause instanceof RecoveryStorageUnavailableError) return cause;
  if (!webStorageUnavailable) {
    webStorageUnavailable = true;
    console.info('Crashherstel staat uit voor deze sessie: de browser weigert IndexedDB.', cause);
  }
  return new RecoveryStorageUnavailableError(cause);
}

const asStorageRefusal = (error: unknown): unknown => (isStorageRefusal(error) ? markStorageUnavailable(error) : error);

const openRecoveryDb = async (): Promise<IDBDatabase> => {
  if (webUpgradeBlocked) throw webUpgradeBlocked;
  if (webStorageUnavailable) throw new RecoveryStorageUnavailableError();
  const refuse = (cause: unknown) => (webStorageProven ? cause : markStorageUnavailable(cause));
  let factory: unknown;
  try { factory = (globalThis as { indexedDB?: unknown }).indexedDB; } catch (error) { throw refuse(error); }
  if (!factory) throw refuse(new Error('indexedDB ontbreekt'));
  try {
    return await openDbStores(
      WEB_DB, WEB_DB_VERSION, [WEB_STORE, WEB_ARCHIVE_STORE],
      [{ storeName: WEB_STORE, name: WEB_KIND_INDEX, keyPath: 'kind' }],
    );
  } catch (error) {
    if (error instanceof IndexedDbUpgradeBlockedError) webUpgradeBlocked = error;
    throw asStorageRefusal(error);
  }
};
const SESSION_KEY = 'ops-recovery-session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const CLAIM_RETRY_MS = 150;

async function claimLock(name: string): Promise<boolean> {
  try {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) return true;
    return await new Promise<boolean>((resolve, reject) => {
      locks.request(name, { mode: 'exclusive', ifAvailable: true }, (lock) => {
        resolve(lock !== null);
        if (!lock) return undefined;
        return new Promise<never>(() => { });
      }).catch(reject);
    });
  } catch {
    return false;
  }
}

const delay = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });

async function resolveSessionId(): Promise<string> {
  let id: string;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    id = stored ?? newRecoveryId();
    if (!stored) sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    return 'default';
  }

  const key = (v: string) => `${SESSION_KEY}:${v}`;
  if (await claimLock(key(id))) return id;
  await delay(CLAIM_RETRY_MS);
  if (await claimLock(key(id))) return id;

  id = newRecoveryId();
  try { sessionStorage.setItem(SESSION_KEY, id); } catch { }
  console.warn('Recovery: sessie-id was al in gebruik door een ander tabblad — nieuwe id genomen.');
  await claimLock(key(id));
  return id;
}

let sessionIdPromise: Promise<string> | null = null;
function sessionId(): Promise<string> {
  if (!sessionIdPromise) sessionIdPromise = resolveSessionId();
  return sessionIdPromise;
}

const HELD_KEY = `${SESSION_KEY}:held`;

function readHeldSessionIds(): string[] {
  try {
    const raw = sessionStorage.getItem(HELD_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeHeldSessionIds(ids: readonly string[]): void {
  try {
    if (ids.length === 0) sessionStorage.removeItem(HELD_KEY);
    else sessionStorage.setItem(HELD_KEY, JSON.stringify(ids));
  } catch { }
}

let heldSessionIdsPromise: Promise<string[]> | null = null;
function heldSessionIds(): Promise<string[]> {
  if (!heldSessionIdsPromise) {
    heldSessionIdsPromise = (async () => {
      const own: string[] = [];
      for (const id of readHeldSessionIds()) {
        const key = `${SESSION_KEY}:${id}`;
        if (await claimLock(key)) { own.push(id); continue; }
        await delay(CLAIM_RETRY_MS);
        if (await claimLock(key)) own.push(id);
      }
      writeHeldSessionIds(own);
      return own;
    })();
  }
  return heldSessionIdsPromise;
}

async function holdWeb(): Promise<void> {
  const current = await sessionId();
  const held = await heldSessionIds();
  checkWebGenerations((await readWebRecovery(true)).records, [current, ...held]);
  if (!held.includes(current)) held.push(current);
  writeHeldSessionIds(held);
  const fresh = newRecoveryId();
  try { sessionStorage.setItem(SESSION_KEY, fresh); } catch { }
  await claimLock(`${SESSION_KEY}:${fresh}`);
  sessionIdPromise = Promise.resolve(fresh);
}

interface WebDocRecord {
  id: string;
  kind: 'doc';
  sessionId: string;
  docId: string;
  ifc: string;
  addedAt: number;
  filePath?: string | null;
  isDirty?: boolean;
}
interface WebManifestRecord {
  id: string;
  kind: 'manifest';
  sessionId: string;
  activeDocumentId: string | null;
  documents?: RecoveryManifestDoc[];
  docIds?: string[];
  version?: number;
  addedAt: number;
}
type WebRecord = WebDocRecord | WebManifestRecord;
interface WebArchiveRecord {
  id: string;
  bytes: Uint8Array;
  addedAt: number;
}

function checkWebManifest(value: unknown): WebManifestRecord {
  if (!value || typeof value !== 'object') throw new RecoveryManifestError('invalid-shape');
  const m = value as WebManifestRecord;
  const unversioned = !Object.prototype.hasOwnProperty.call(m, 'version');
  if (!unversioned) checkRecoveryManifestVersion(m.version);
  if (m.kind !== 'manifest' || typeof m.sessionId !== 'string' || !m.sessionId
    || m.id !== manifestKey(m.sessionId) || typeof m.addedAt !== 'number' || !Number.isFinite(m.addedAt)) {
    throw new RecoveryManifestError('invalid-shape');
  }
  if (unversioned || (m.version! <= 2 && m.documents === undefined)) {
    if (m.documents !== undefined) throw new RecoveryManifestError('invalid-shape');
    checkRecoveryDocumentIds(m.docIds);
  } else {
    checkRecoveryDocuments(m.documents);
  }
  return m;
}

function readableWebManifest(value: unknown): value is WebManifestRecord {
  try { checkWebManifest(value); return true; } catch { return false; }
}

function webManifestCandidates(records: readonly WebRecord[]): WebRecord[] {
  return records.filter(record => record.kind === 'manifest'
    || (typeof record.id === 'string' && record.id.endsWith('::manifest')));
}

function webKeySession(key: unknown): string | null {
  if (typeof key !== 'string') return null;
  const boundary = key.indexOf('::');
  return boundary > 0 ? key.slice(0, boundary) : null;
}

function checkWebGenerations(records: readonly WebRecord[], generations: readonly string[]): void {
  for (const candidate of webManifestCandidates(records)) {
    const keySession = webKeySession(candidate.id);
    if (generations.includes(candidate.sessionId) || (keySession !== null && generations.includes(keySession))) {
      checkWebManifest(candidate);
    }
  }
}

function webArchiveReferences(records: readonly WebRecord[]): Set<string> {
  const out = new Set<string>();
  for (const manifest of webManifestCandidates(records)) {
    if (!readableWebManifest(manifest)) continue;
    for (const document of manifest.documents ?? []) {
      if (document && typeof document.xerArchive === 'string') out.add(document.xerArchive);
    }
  }
  return out;
}

const docKey = (sid: string, docId: string): string => `${sid}::doc::${docId}`;
const manifestKey = (sid: string): string => `${sid}::manifest`;

async function sourceCopyManifests(db: IDBDatabase): Promise<WebRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WEB_STORE, 'readonly'), store = tx.objectStore(WEB_STORE);
    const keys = store.getAllKeys(), indexed = store.index(WEB_KIND_INDEX).getAll('manifest');
    keys.onerror = indexed.onerror = () => reject(keys.error ?? indexed.error);
    let pending = 2;
    const done = () => {
      if (--pending) return;
      const records = indexed.result as WebRecord[];
      const ids = new Set(records.map(r => r.id));
      const extra = keys.result.filter((k): k is string => typeof k === 'string' && k.endsWith('::manifest') && !ids.has(k));
      if (!extra.length) { resolve(records); return; }
      let remaining = extra.length;
      for (const key of extra) {
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          if (request.result !== undefined) records.push(request.result as WebRecord);
          if (--remaining === 0) resolve(records);
        };
      }
    };
    keys.onsuccess = indexed.onsuccess = done;
  });
}

async function cleanupWebSourceCopies(generations = new Set<string>()): Promise<void> {
  const db = await openRecoveryDb();
  const manifests = await sourceCopyManifests(db);
  if (manifests.some(m => !readableWebManifest(m))) return;
  const references = new Set<string>(), hashes = new Set<string>();
  for (const manifest of manifests as WebManifestRecord[]) for (const document of manifest.documents ?? []) {
    const source = ifcSourceMetaFields(document).ifcSource;
    if (!source) { if (document.ifcSource) return; continue; }
    hashes.add(source.sha256);
    references.add(sourceCopyReferenceKey(document.ifc, source.sha256));
  }
  if (generations.size === 0) for (const id of [await sessionId(), ...await heldSessionIds()]) generations.add(id);
  await cleanupRecoverySourceCopies(generations, references, hashes);
}

let sourceCopiesUsed = false;
const failedSourceCopies = new Set<string>();
async function prepareWebSourceCopies(input: RecoverySaveInput): Promise<{ input: RecoverySaveInput; failed: string[] }> {
  if (!input.ifcSourceCopies?.size) return { input, failed: [] };
  sourceCopiesUsed = true;
  const sid = await sessionId(), db = await openRecoveryDb();
  checkWebGenerations(await sourceCopyManifests(db), [sid, ...await heldSessionIds()]);
  const failed: string[] = [], missing = new Set<string>();
  for (const document of input.documents) {
    const copy = input.ifcSourceCopies.get(document.id);
    if (!copy || !document.ifcSource) continue;
    if (failedSourceCopies.has(document.id)) { missing.add(document.id); continue; }
    try { await writeRecoverySourceCopy(docKey(sid, document.id), document.ifcSource.sha256, copy); }
    catch {
      failedSourceCopies.add(document.id); missing.add(document.id); failed.push(document.id);
    }
  }
  const withoutMissing = <T extends RecoveryDocMetadata>(document: T): T => {
    if (!missing.has(document.id)) return document;
    const { ifcSource: _source, ...rest } = document;
    return rest as T;
  };
  return { input: { ...input, documents: input.documents.map(withoutMissing), upserts: input.upserts.map(withoutMissing) }, failed };
}

async function saveWeb(input: RecoverySaveInput): Promise<void> {
  const sid = await sessionId();
  const held = await heldSessionIds();
  const now = Date.now();
  const db = await openRecoveryDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([WEB_STORE, WEB_ARCHIVE_STORE], 'readwrite');
    const store = tx.objectStore(WEB_STORE);
    const archiveStore = tx.objectStore(WEB_ARCHIVE_STORE);
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    tx.oncomplete = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    tx.onerror = () => fail(tx.error ?? new Error('IndexedDB-recoverytransactie mislukt.'));
    tx.onabort = () => fail(tx.error ?? new Error('IndexedDB-recoverytransactie afgebroken.'));

    const keysRequest = store.getAllKeys();
    keysRequest.onerror = () => fail(keysRequest.error ?? new Error('IndexedDB-recoverysleutels niet leesbaar.'));
    keysRequest.onsuccess = () => {
      const recordKeys = (keysRequest.result as IDBValidKey[]).filter((key): key is string => typeof key === 'string');
      const canonicalKeys = recordKeys.filter(key => key.endsWith('::manifest'));
      const manifestRecords: WebRecord[] = [];
      let pending = 2;
      const step = () => {
        pending -= 1;
        if (pending === 0) writeRound();
      };
      const manifestRequest = store.index(WEB_KIND_INDEX).getAll('manifest');
      manifestRequest.onerror = () => fail(manifestRequest.error ?? new Error('IndexedDB-recoverymanifesten niet leesbaar.'));
      manifestRequest.onsuccess = () => {
        manifestRecords.push(...manifestRequest.result as WebRecord[]);
        const indexedIds = new Set(manifestRecords.map(record => record.id));
        const missingKeys = canonicalKeys.filter(key => !indexedIds.has(key));
        pending += missingKeys.length;
        for (const key of missingKeys) {
          const request = store.get(key);
          request.onerror = () => fail(request.error ?? new Error('IndexedDB-recoverymanifest niet leesbaar.'));
          request.onsuccess = () => {
            if (request.result !== undefined) manifestRecords.push(request.result as WebRecord);
            step();
          };
        }
        step();
      };
      let archiveKeys = new Set<string>();
      const archiveKeysRequest = archiveStore.getAllKeys();
      archiveKeysRequest.onerror = () => fail(archiveKeysRequest.error ?? new Error('IndexedDB-archiefsleutels niet leesbaar.'));
      archiveKeysRequest.onsuccess = () => {
        archiveKeys = new Set((archiveKeysRequest.result as IDBValidKey[]).filter((key): key is string => typeof key === 'string'));
        step();
      };

      const writeRound = () => {
        try {
          const candidates = webManifestCandidates(manifestRecords);
          checkWebGenerations(candidates, [sid, ...held]);
          const unknownManifest = candidates.some(value => !readableWebManifest(value));
          const manifests = new Map(candidates.filter(readableWebManifest).map(manifest => [manifest.sessionId, manifest]));
          const upserts = checkedUpserts(input);
          const referenced = referencedArchives(input);
          const ownDocPrefix = `${sid}::doc::`;
          const existing = new Set(recordKeys.filter((key) => key.startsWith(ownDocPrefix)).map((key) => key.slice(ownDocPrefix.length)));
          for (const document of input.documents) {
            if (!upserts.has(document.id) && !existing.has(document.id)) {
              throw new Error(`Recovery: ${JSON.stringify(document.id)} heeft geen webrecord en geen upsert.`);
            }
          }

          for (const sha of referenced) {
            if (archiveKeys.has(sha)) continue;
            const record: WebArchiveRecord = { id: sha, bytes: suppliedArchiveBytes(input, sha), addedAt: now };
            archiveStore.put(record);
          }

          for (const document of upserts.values()) {
            const record: WebDocRecord = {
              id: docKey(sid, document.id), kind: 'doc', sessionId: sid, docId: document.id,
              ifc: document.ifc, addedAt: now,
            };
            store.put(record);
          }

          const manifest: WebManifestRecord = {
            id: manifestKey(sid), kind: 'manifest', sessionId: sid,
            version: RECOVERY_MANIFEST_VERSION,
            activeDocumentId: input.activeDocumentId,
            documents: input.documents.map((document) => ({
              id: document.id,
              ifc: docKey(sid, document.id),
              filePath: document.filePath,
              isDirty: document.isDirty,
              datesAsRecorded: document.datesAsRecorded,
              ...(document.xerArchive ? { xerArchive: document.xerArchive } : {}),
              ...siteMetaFields(document),
              ...foreignSourceMetaFields(document),
              ...ifcSourceMetaFields(document),
            })),
            addedAt: now,
          };
          store.put(manifest);

          const keep = new Set(input.documents.map((document) => docKey(sid, document.id)));
          const survivingManifests: WebManifestRecord[] = [manifest];
          for (const key of recordKeys) {
            const keySession = webKeySession(key);
            if (keySession === sid) {
              if (key.startsWith(ownDocPrefix) && !keep.has(key)) store.delete(key);
              continue;
            }
            if (unknownManifest) continue;
            const other = keySession !== null ? manifests.get(keySession) : undefined;
            if (!other || now - other.addedAt > MAX_AGE_MS) store.delete(key);
          }
          for (const [session, other] of manifests) {
            if (session !== sid && now - other.addedAt <= MAX_AGE_MS) survivingManifests.push(other);
          }
          const stillReferenced = webArchiveReferences(survivingManifests);
          if (!unknownManifest) {
            for (const key of archiveKeys) if (!stillReferenced.has(key)) archiveStore.delete(key);
          }
        } catch (err) {
          fail(err);
          (tx as unknown as { abort?: () => void }).abort?.();
        }
      };
    };
  });
}

async function readWebRecovery(strict = false): Promise<{ records: WebRecord[]; archives: Map<string, Uint8Array> }> {
  try {
    const db = await openRecoveryDb();
    const read = await new Promise<{ records: WebRecord[]; archives: Map<string, Uint8Array> }>((resolve, reject) => {
      const tx = db.transaction([WEB_STORE, WEB_ARCHIVE_STORE], 'readonly');
      const allRequest = tx.objectStore(WEB_STORE).getAll();
      allRequest.onerror = () => reject(allRequest.error);
      allRequest.onsuccess = () => {
        const records = allRequest.result as WebRecord[];
        const wanted = [...webArchiveReferences(records)];
        const archives = new Map<string, Uint8Array>();
        if (wanted.length === 0) { resolve({ records, archives }); return; }
        let pending = wanted.length;
        for (const sha of wanted) {
          const request = tx.objectStore(WEB_ARCHIVE_STORE).get(sha);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const value = request.result as WebArchiveRecord | undefined;
            if (value && value.bytes instanceof Uint8Array) archives.set(sha, value.bytes);
            pending -= 1;
            if (pending === 0) resolve({ records, archives });
          };
        }
      };
    });
    webStorageProven = true;
    return read;
  } catch (error) {
    const refusal = asStorageRefusal(error);
    if (strict || error instanceof IndexedDbUpgradeBlockedError) throw refusal;
    return { records: [], archives: new Map() };
  }
}

async function loadWeb(): Promise<LoadedRecovery> {
  const sid = await sessionId();
  const held = await heldSessionIds();
  const { records: all, archives: allArchives } = await readWebRecovery();
  if (webStorageUnavailable) return emptyRecovery();
  const candidates = webManifestCandidates(all);
  checkWebGenerations(candidates, [sid, ...held]);
  const docs: LoadedRecoveryDoc[] = [];
  const seen = new Set<string>();
  let activeDocumentId: string | null = null;
  for (const generation of [sid, ...held.filter((id) => id !== sid)]) {
    const manifest = candidates.find((r) => r.kind === 'manifest' && r.sessionId === generation) as WebManifestRecord | undefined;
    if (!manifest) continue;
    if (activeDocumentId === null) activeDocumentId = manifest.activeDocumentId;
    const metadata = Array.isArray(manifest.documents)
      ? manifest.documents
      : (manifest.docIds ?? []).map((id): RecoveryManifestDoc => ({
        id, ifc: docKey(generation, id), filePath: null, isDirty: true, datesAsRecorded: false,
      }));
    for (const document of metadata) {
      const docId = document.id;
      if (seen.has(docId)) continue;
      const rec = all.find((r) => r.kind === 'doc' && r.id === docKey(generation, docId)) as WebDocRecord | undefined;
      if (!rec) continue;
      seen.add(docId);
      docs.push({
        id: rec.docId,
        ...(ifcSourceMetaFields(document).ifcSource ? { sourceCopyDocumentKey: rec.id } : {}),
        ifc: rec.ifc,
        filePath: document.filePath ?? rec.filePath ?? null,
        isDirty: (Array.isArray(manifest.documents) ? document.isDirty : undefined) ?? rec.isDirty ?? true,
        datesAsRecorded: document.datesAsRecorded ?? false,
        ...siteMetaFields(document),
        ...foreignSourceMetaFields(document),
        ...ifcSourceMetaFields(document),
        mtime: new Date(rec.addedAt),
        ...(typeof document.xerArchive === 'string' ? { xerArchive: document.xerArchive } : {}),
      });
    }
  }
  const archives = new Map<string, Uint8Array>();
  for (const doc of docs) {
    const bytes = doc.xerArchive ? allArchives.get(doc.xerArchive) : undefined;
    if (doc.xerArchive && bytes) archives.set(doc.xerArchive, bytes);
  }
  return { activeDocumentId, docs, archives };
}

async function clearWeb(): Promise<void> {
  const sid = await sessionId();
  const generations = new Set([sid, ...(await heldSessionIds())]);
  const db = await openRecoveryDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([WEB_STORE, WEB_ARCHIVE_STORE], 'readwrite');
    const store = tx.objectStore(WEB_STORE);
    const archiveStore = tx.objectStore(WEB_ARCHIVE_STORE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const allRequest = store.getAll();
    allRequest.onerror = () => reject(allRequest.error);
    allRequest.onsuccess = () => {
      const keysRequest = archiveStore.getAllKeys();
      keysRequest.onerror = () => reject(keysRequest.error);
      keysRequest.onsuccess = () => {
        const all = allRequest.result as WebRecord[];
        const candidates = webManifestCandidates(all);
        try { checkWebGenerations(candidates, [...generations]); } catch (err) {
          tx.abort();
          reject(err);
          return;
        }
        const unknownManifest = candidates.some(record => !readableWebManifest(record));
        const ours = all.filter((record) => generations.has(record.sessionId));
        for (const record of ours) store.delete(record.id);
        const stillReferenced = webArchiveReferences(candidates.filter(record => !generations.has(record.sessionId)));
        const orphanArchives = (unknownManifest ? [] : keysRequest.result as IDBValidKey[])
          .filter((key): key is string => typeof key === 'string' && !stillReferenced.has(key));
        for (const key of orphanArchives) archiveStore.delete(key);
        writeHeldSessionIds([]);
        heldSessionIdsPromise = Promise.resolve([]);
        if (ours.length === 0 && orphanArchives.length === 0) queueMicrotask(resolve);
      };
    };
  });
}

let recoveryWriteTail: Promise<unknown> = Promise.resolve();
function serializeRecoveryWrite(action: () => Promise<void>): Promise<void> {
  const run = recoveryWriteTail.then(action, action);
  recoveryWriteTail = run.catch(() => undefined);
  return run;
}

const emptyRecovery = (): LoadedRecovery => ({ activeDocumentId: null, docs: [], archives: new Map() });

async function quietWhenRefused(action: () => Promise<void>): Promise<void> {
  if (webStorageUnavailable) return;
  try { await action(); webStorageProven = true; } catch (error) {
    if (isStorageRefusal(error)) { markStorageUnavailable(error); return; }
    throw error;
  }
}

export function saveRecovery(input: RecoverySaveInput): Promise<void> {
  return serializeRecoveryWrite(async () => {
    if (isTauri()) { await saveTauri(input); return; }
    if (webStorageUnavailable) throw new RecoveryStorageUnavailableError();
    try {
      const prepared = await prepareWebSourceCopies(input);
      await saveWeb(prepared.input);
      webStorageProven = true;
      for (const id of prepared.failed) input.onSourceCopyFailure?.(id);
      if (sourceCopiesUsed) await cleanupWebSourceCopies().catch(() => {});
    } catch (error) { throw asStorageRefusal(error); }
  });
}

export async function loadRecovery(): Promise<LoadedRecovery> {
  let loaded: LoadedRecovery;
  if (isTauri()) loaded = await loadTauri();
  else if (webStorageUnavailable) return emptyRecovery();
  else {
    try { loaded = await loadWeb(); } catch (error) {
      if (isStorageRefusal(error)) { markStorageUnavailable(error); return emptyRecovery(); }
      throw error;
    }
  }
  for (const bytes of loaded.archives.values()) await precomputeSha256(bytes);
  return loaded;
}

export function clearRecovery(): Promise<void> {
  return serializeRecoveryWrite(() => (isTauri() ? clearTauri() : quietWhenRefused(async () => {
    const generations = new Set([await sessionId(), ...await heldSessionIds()]);
    await clearWeb();
    await cleanupWebSourceCopies(generations).catch(() => {});
  })));
}

export function clearOwnRecovery(): Promise<void> {
  return serializeRecoveryWrite(() => (isTauri() ? clearOwnTauri() : Promise.resolve()));
}

export function holdRecoveryForLater(restoredDocumentIds: readonly string[] = []): Promise<void> {
  return serializeRecoveryWrite(() => (isTauri() ? holdTauri(restoredDocumentIds) : quietWhenRefused(holdWeb)));
}
