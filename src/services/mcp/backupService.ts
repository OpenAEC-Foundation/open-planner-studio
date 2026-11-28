import type { EnsureBackupFn, McpToolDef } from './contracts';
import type { AppStoreContext } from '@/state/appStoreFactory';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { foreignSourceBackupRecord } from '@/services/ifc/foreign/foreignSourceMark';
import { DEFAULT_PROJECT_FILE_BASE } from '@/utils/documents';

export const BACKUP_ROOT = 'ai-backups';

export const BACKUP_RETENTION = {
  recentDays: 7,
  recentMax: 20,
  weeklyUntilDays: 30,
  monthlyUntilDays: 365,
} as const;

const MUTATING_KINDS: ReadonlySet<McpToolDef['kind']> = new Set<McpToolDef['kind']>(['mutate', 'batch']);

export interface BackupFs {
  appDataDir(): Promise<string>;
  join(...parts: string[]): Promise<string>;
  mkdir(dir: string): Promise<void>;
  writeTextFile(path: string, content: string): Promise<void>;
  readDir(dir: string): Promise<{ name: string; isDirectory?: boolean }[]>;
  remove(path: string): Promise<void>;
}

export interface BackupDeps {
  getFs: () => Promise<BackupFs>;
  getDoc: (docId: string) => { ifc: string; projectName: string; filePath?: string | null } | null;
  autoBackupEnabled: () => Promise<boolean>;
  now: () => number;
  activeDocId: () => string | null;
}

export interface BackupService {
  ensureBackup: EnsureBackupFn;
  makeManualBackup: () => Promise<string>;
  markDuplicateBorn: (docId: string) => void;
  resetSession: () => void;
}

export function sanitizeProjectName(name: string): string {
  const cleaned = (name ?? '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : DEFAULT_PROJECT_FILE_BASE;
}

function stamp(ts: number): string {
  return new Date(ts).toISOString().replace(/[:.]/g, '-');
}

export function backupFileName(projectName: string, ts: number): string {
  return `${sanitizeProjectName(projectName)}-${stamp(ts)}.ifc`;
}

export function backupBucket(docId: string, filePath: string | null | undefined): string {
  if (!filePath) return `unsaved-${docId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < filePath.length; i++) {
    hash ^= filePath.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const base = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]*$/, '') ?? '';
  return `file-${sanitizeProjectName(base).slice(0, 40)}-${hash.toString(16).padStart(8, '0')}`;
}

const TS_SUFFIX = /-(\d{4}-\d\d-\d\d)T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z\.ifc$/;
export function backupTimeOf(fileName: string): number | null {
  const m = fileName.match(TS_SUFFIX);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return Number.isFinite(t) ? t : null;
}

const DAY_MS = 86_400_000;

export function backupsToRemove(
  names: readonly string[],
  now: number,
  keepYearly: boolean,
  protectedNames: ReadonlySet<string> = new Set(),
): string[] {
  const ours = names
    .map((name) => ({ name, t: backupTimeOf(name) }))
    .filter((e): e is { name: string; t: number } => e.t !== null)
    .sort((a, b) => b.t - a.t || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  const R = BACKUP_RETENTION;
  const seen = new Set<string>();
  const remove: string[] = [];
  let recent = 0;
  for (const { name, t } of ours) {
    const age = now - t;
    let keep: boolean;
    if (age < R.recentDays * DAY_MS) {
      keep = protectedNames.has(name) || recent < R.recentMax;
      if (keep) recent++;
    } else {
      const d = new Date(t);
      const key = age < R.weeklyUntilDays * DAY_MS ? `w${Math.floor((t + 3 * DAY_MS) / (7 * DAY_MS))}`
        : age < R.monthlyUntilDays * DAY_MS ? `m${d.getUTCFullYear()}-${d.getUTCMonth()}`
        : keepYearly ? `y${d.getUTCFullYear()}`
        : null;
      keep = protectedNames.has(name) || (key !== null && !seen.has(key));
      if (key !== null) seen.add(key);
    }
    if (!keep) remove.push(name);
  }
  return remove;
}

function bucketKeepsYearly(bucket: string): boolean {
  return !bucket.startsWith('unsaved-');
}

export function createBackupService(deps: BackupDeps): BackupService {
  const autoBackedUp = new Set<string>();
  const duplicateBorn = new Set<string>();
  const writtenThisSession = new Set<string>();
  let sweptOtherBuckets = false;

  async function writeSnapshot(docId: string): Promise<string> {
    const doc = deps.getDoc(docId);
    if (!doc) throw new Error(`MCP backup: document '${docId}' not found`);
    const fs = await deps.getFs();
    const base = await fs.appDataDir();
    const bucket = backupBucket(docId, doc.filePath);
    const docDir = await fs.join(base, BACKUP_ROOT, bucket);
    await fs.mkdir(docDir);
    const now = deps.now();
    const name = backupFileName(doc.projectName, now);
    const path = await fs.join(docDir, name);
    await fs.writeTextFile(path, doc.ifc);
    writtenThisSession.add(name);
    try {
      await prune(fs, docDir, bucketKeepsYearly(bucket), now);
      if (!sweptOtherBuckets) {
        sweptOtherBuckets = true;
        await sweepOtherBuckets(fs, await fs.join(base, BACKUP_ROOT), bucket, now);
      }
    } catch (err) {
      console.warn('MCP-backup: opruimen mislukt', err);
    }
    return path;
  }

  async function prune(fs: BackupFs, dir: string, keepYearly: boolean, now: number): Promise<boolean> {
    const entries = await fs.readDir(dir);
    const doomed = backupsToRemove(entries.map((e) => e.name), now, keepYearly, writtenThisSession);
    for (const name of doomed) await fs.remove(await fs.join(dir, name));
    return entries.length > doomed.length;
  }

  async function sweepOtherBuckets(fs: BackupFs, root: string, current: string, now: number): Promise<void> {
    for (const entry of await fs.readDir(root)) {
      if (!entry.isDirectory || entry.name === current) continue;
      try {
        const dir = await fs.join(root, entry.name);
        const keepYearly = bucketKeepsYearly(entry.name);
        const nonEmpty = await prune(fs, dir, keepYearly, now);
        if (!nonEmpty && !keepYearly) await fs.remove(dir);
      } catch (err) {
        console.warn(`MCP-backup: map '${entry.name}' opruimen mislukt`, err);
      }
    }
  }

  const ensureBackup: EnsureBackupFn = async (docId, kind) => {
    if (!MUTATING_KINDS.has(kind)) return null;
    if (duplicateBorn.has(docId)) return null;
    if (autoBackedUp.has(docId)) return null;
    if (!(await deps.autoBackupEnabled())) return null;
    const path = await writeSnapshot(docId);
    autoBackedUp.add(docId);
    return path;
  };

  async function makeManualBackup(): Promise<string> {
    const docId = deps.activeDocId();
    if (!docId) throw new Error('MCP-backup: geen actief document om te back-uppen');
    const path = await writeSnapshot(docId);
    autoBackedUp.delete(docId);
    return path;
  }

  return {
    ensureBackup,
    makeManualBackup,
    markDuplicateBorn: (docId: string) => { duplicateBorn.add(docId); },
    resetSession: () => { autoBackedUp.clear(); duplicateBorn.clear(); },
  };
}

async function realFs(): Promise<BackupFs> {
  const { writeTextFile, readDir, remove, mkdir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  return {
    appDataDir: () => appDataDir(),
    join: (...parts: string[]) => join(...parts),
    mkdir: async (dir: string) => { await mkdir(dir, { recursive: true }); },
    writeTextFile: (p: string, c: string) => writeTextFile(p, c),
    readDir: async (dir: string) => (await readDir(dir)).map((e) => ({ name: e.name, isDirectory: e.isDirectory })),
    remove: (p: string) => remove(p),
  };
}

function realDeps(app: AppStoreContext): BackupDeps {
  return {
    getFs: realFs,
    getDoc: (docId) => {
      const state = app.store.getState();
      const found = state.getOpenDocumentPayloads().find((d) => d.id === docId);
      if (!found) return null;
      const recoveryForeignSource = foreignSourceBackupRecord(found.payload.foreignSourceMark);
      return {
        ifc: writeIFC({ ...buildWriteIFCInput(found.payload, 'planOnly'), ...(recoveryForeignSource ? { recoveryForeignSource } : {}) }),
        projectName: found.payload.project.name,
        filePath: found.payload.filePath,
      };
    },
    autoBackupEnabled: () => import('@/utils/settingsStore').then((m) => m.loadAiAutoBackup()),
    now: () => Date.now(),
    activeDocId: () => app.store.getState().activeDocumentId,
  };
}

const appServices = new WeakMap<AppStoreContext, BackupService>();
export type AppBackupOverrides = Partial<
  Pick<BackupDeps, 'getFs' | 'autoBackupEnabled' | 'now'>
>;
export function createAppBackupService(
  app: AppStoreContext,
  overrides?: AppBackupOverrides,
): BackupService {
  if (overrides) return createBackupService({ ...realDeps(app), ...overrides });
  const existing = appServices.get(app);
  if (existing) return existing;
  const created = createBackupService(realDeps(app));
  appServices.set(app, created);
  return created;
}

