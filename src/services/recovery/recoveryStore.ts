import { isTauri } from '@/utils/platform';
import { idbGetAll, idbPut, idbDelete } from '@/utils/idb';

/** Eén recovery-document (IFC-CONTENT, niet de bestandsnaam). */
export interface RecoveryDocContent {
  id: string;
  ifc: string;
  filePath: string | null;
  isDirty: boolean;
}

/** Geladen record incl. weergave-mtime (Tauri: bestand-mtime; web: addedAt). */
export interface LoadedRecoveryDoc extends RecoveryDocContent {
  mtime: Date | null;
}

export interface LoadedRecovery {
  activeDocumentId: string | null;
  docs: LoadedRecoveryDoc[];
}

// ---------------------------------------------------------------------------
// Tauri-backend — appDataDir + plugin-fs (dev-slug-isolatie behouden, spec §7).
// ---------------------------------------------------------------------------

const recoveryBase = __OPS_DEV_INSTANCE__ ? `recovery.${__OPS_DEV_INSTANCE__}` : 'recovery';
const manifestName = `${recoveryBase}.documents.json`;
const legacyFile = `${recoveryBase}.ifc`;
const ifcName = (docId: string): string => `${recoveryBase}.${docId}.ifc`;

interface TauriManifest {
  version: number;
  activeDocumentId: string | null;
  documents: { id: string; ifc: string; filePath: string | null; isDirty: boolean }[];
}

async function saveTauri(activeId: string, docs: RecoveryDocContent[]): Promise<void> {
  const { writeTextFile, readDir, remove } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();

  for (const d of docs) {
    await writeTextFile(await join(dir, ifcName(d.id)), d.ifc);
  }

  const manifest: TauriManifest = {
    version: 1,
    activeDocumentId: activeId,
    documents: docs.map((d) => ({ id: d.id, ifc: ifcName(d.id), filePath: d.filePath, isDirty: d.isDirty })),
  };
  await writeTextFile(await join(dir, manifestName), JSON.stringify(manifest));

  // Ruim snapshots op van documenten die niet meer open zijn (zelfde slug).
  const keep = new Set(docs.map((d) => ifcName(d.id)));
  const prefix = `${recoveryBase}.`;
  for (const entry of await readDir(dir)) {
    const name = entry.name;
    if (name && name.startsWith(prefix) && name.endsWith('.ifc') && !keep.has(name)) {
      await remove(await join(dir, name));
    }
  }
}

async function loadTauri(): Promise<LoadedRecovery> {
  const { readTextFile, exists, stat } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const manifestPath = await join(dir, manifestName);

  if (await exists(manifestPath)) {
    const manifest = JSON.parse(await readTextFile(manifestPath)) as TauriManifest;
    const docs: LoadedRecoveryDoc[] = [];
    for (const d of manifest.documents) {
      try {
        const ifcPath = await join(dir, d.ifc);
        const ifc = await readTextFile(ifcPath);
        let mtime: Date | null = null;
        try { mtime = (await stat(ifcPath)).mtime; } catch { /* geen mtime — laat null */ }
        docs.push({ id: d.id, ifc, filePath: d.filePath ?? null, isDirty: d.isDirty ?? true, mtime });
      } catch (err) {
        console.error('Recovery: kon documentsnapshot niet lezen:', d.id, err);
      }
    }
    return { activeDocumentId: manifest.activeDocumentId ?? null, docs };
  }

  // Terugval: oude losse <base>.ifc (één document).
  const legacyPath = await join(dir, legacyFile);
  if (await exists(legacyPath)) {
    const ifc = await readTextFile(legacyPath);
    let mtime: Date | null = null;
    try { mtime = (await stat(legacyPath)).mtime; } catch { /* geen mtime */ }
    return { activeDocumentId: 'legacy', docs: [{ id: 'legacy', ifc, filePath: null, isDirty: true, mtime }] };
  }

  return { activeDocumentId: null, docs: [] };
}

async function clearTauri(): Promise<void> {
  const { exists, readTextFile, remove } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const manifestPath = await join(dir, manifestName);
  if (await exists(manifestPath)) {
    try {
      const manifest = JSON.parse(await readTextFile(manifestPath)) as TauriManifest;
      for (const d of manifest.documents) {
        try { await remove(await join(dir, d.ifc)); } catch { /* al weg */ }
      }
    } catch { /* corrupt manifest — negeren */ }
    try { await remove(manifestPath); } catch { /* al weg */ }
  }
  const legacyPath = await join(dir, legacyFile);
  if (await exists(legacyPath)) {
    try { await remove(legacyPath); } catch { /* al weg */ }
  }
}

// ---------------------------------------------------------------------------
// Web-backend — IndexedDB 'ops-recovery', per-tab sessionId-scoping (spec §7).
// ---------------------------------------------------------------------------

const WEB_DB = 'ops-recovery';
const WEB_STORE = 'records';
const SESSION_KEY = 'ops-recovery-session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dagen

/** Per-tab id: overleeft reload/crash van hetzelfde tab (sessionStorage), niet tab-sluiten. */
function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch {
    return 'default'; // sessionStorage geblokkeerd → vaste sleutel
  }
}

interface WebDocRecord {
  id: string; // `${sid}::doc::${docId}`
  kind: 'doc';
  sessionId: string;
  docId: string;
  ifc: string;
  filePath: string | null;
  isDirty: boolean;
  addedAt: number;
}
interface WebManifestRecord {
  id: string; // `${sid}::manifest`
  kind: 'manifest';
  sessionId: string;
  activeDocumentId: string | null;
  docIds: string[];
  addedAt: number;
}
type WebRecord = WebDocRecord | WebManifestRecord;

const docKey = (sid: string, docId: string): string => `${sid}::doc::${docId}`;
const manifestKey = (sid: string): string => `${sid}::manifest`;

async function saveWeb(activeId: string, docs: RecoveryDocContent[]): Promise<void> {
  const sid = sessionId();
  const now = Date.now();
  const all = await idbGetAll<WebRecord>(WEB_DB, WEB_STORE);

  // Ruim verweesde vreemde sessies op (ouder dan 7 dagen).
  for (const r of all) {
    if (r.sessionId !== sid && now - r.addedAt > MAX_AGE_MS) {
      await idbDelete(WEB_DB, WEB_STORE, r.id);
    }
  }

  // Schrijf de huidige docs van deze sessie.
  for (const d of docs) {
    const rec: WebDocRecord = {
      id: docKey(sid, d.id), kind: 'doc', sessionId: sid, docId: d.id,
      ifc: d.ifc, filePath: d.filePath, isDirty: d.isDirty, addedAt: now,
    };
    await idbPut(WEB_DB, WEB_STORE, rec);
  }
  const manifest: WebManifestRecord = {
    id: manifestKey(sid), kind: 'manifest', sessionId: sid,
    activeDocumentId: activeId, docIds: docs.map((d) => d.id), addedAt: now,
  };
  await idbPut(WEB_DB, WEB_STORE, manifest);

  // Ruim doc-records van DEZE sessie op die niet meer open zijn.
  const keep = new Set(docs.map((d) => docKey(sid, d.id)));
  for (const r of all) {
    if (r.sessionId === sid && r.kind === 'doc' && !keep.has(r.id)) {
      await idbDelete(WEB_DB, WEB_STORE, r.id);
    }
  }
}

async function loadWeb(): Promise<LoadedRecovery> {
  const sid = sessionId();
  const all = await idbGetAll<WebRecord>(WEB_DB, WEB_STORE);
  const manifest = all.find((r) => r.kind === 'manifest' && r.sessionId === sid) as WebManifestRecord | undefined;
  if (!manifest) return { activeDocumentId: null, docs: [] };
  const docs: LoadedRecoveryDoc[] = [];
  for (const docId of manifest.docIds) {
    const rec = all.find((r) => r.kind === 'doc' && r.id === docKey(sid, docId)) as WebDocRecord | undefined;
    if (!rec) continue;
    docs.push({ id: rec.docId, ifc: rec.ifc, filePath: rec.filePath, isDirty: rec.isDirty, mtime: new Date(rec.addedAt) });
  }
  return { activeDocumentId: manifest.activeDocumentId, docs };
}

async function clearWeb(): Promise<void> {
  const sid = sessionId();
  const all = await idbGetAll<WebRecord>(WEB_DB, WEB_STORE);
  for (const r of all) {
    if (r.sessionId === sid) await idbDelete(WEB_DB, WEB_STORE, r.id);
  }
}

// ---------------------------------------------------------------------------
// Publieke API — backend-keuze bij runtime.
// ---------------------------------------------------------------------------

export function saveRecovery(activeId: string, docs: RecoveryDocContent[]): Promise<void> {
  return isTauri() ? saveTauri(activeId, docs) : saveWeb(activeId, docs);
}

export function loadRecovery(): Promise<LoadedRecovery> {
  return isTauri() ? loadTauri() : loadWeb();
}

export function clearRecovery(): Promise<void> {
  return isTauri() ? clearTauri() : clearWeb();
}
