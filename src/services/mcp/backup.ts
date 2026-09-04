// AI-backup-service (T16, spec §AI-backup — NORMATIEF, review-gehard).
//
// Draait op de dispatch-grens, vóór `runInMcpTransaction`: bij de EERSTE muterende tool-aanroep per
// document (per server-sessie) schrijft de service eerst een IFC-snapshot naar
// `<appDataDir>/ai-backups/<docId>/<veilige-projectnaam>-<timestamp>.ifc` — zelfde `ifcWriter`-route
// als opslaan/recovery, gekeyd op document-id (per-document-submap, conform de recovery-conventie).
//
// Kernontwerp: één PURE, injecteerbare kern (`createBackupService`) met een `BackupFs`- en
// `BackupDeps`-naad, zodat de headless tests fs/appDataDir/klok/toggle mocken zonder Tauri. De
// publieke wrappers (`ensureBackup`/`makeManualBackup`/…) zijn dunne `isTauri()`-gates die de echte
// Tauri-fs (dynamisch geïmporteerd, net als recoveryStore) injecteren. In de web-build is er geen
// bridge, dus `ensureBackup` geeft daar null terug mét één `console.warn` (theoretisch pad — de
// bridge start sowieso alleen in Tauri).

import type { EnsureBackupFn, McpToolDef } from './contracts';
import { isTauri } from '@/utils/platform';
import { appStoreContext, type AppStoreContext } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { DEFAULT_PROJECT_FILE_BASE } from '@/utils/documents';

/** Submap-wortel onder `appDataDir` waarin per document een backup-submap komt. */
export const BACKUP_ROOT = 'ai-backups';
/** Opruimbeleid: hoogstens dit aantal backups per document-id-submap; oudere worden verwijderd. */
export const MAX_PER_DOC = 10;

/** Alleen deze tool-`kind`s triggeren een auto-backup (spec §Triggerregels). `batch` telt als ÉÉN. */
const MUTATING_KINDS: ReadonlySet<McpToolDef['kind']> = new Set<McpToolDef['kind']>(['mutate', 'batch']);

// --- Injecteerbare naden -------------------------------------------------------------------------

/** Minimale fs-abstractie; de Tauri-implementatie zit in `realFs()`, de test spuit een fake in. */
export interface BackupFs {
  appDataDir(): Promise<string>;
  join(...parts: string[]): Promise<string>;
  /** Maakt de submap aan (recursief); no-op wanneer hij al bestaat. */
  mkdir(dir: string): Promise<void>;
  writeTextFile(path: string, content: string): Promise<void>;
  readDir(dir: string): Promise<{ name: string }[]>;
  remove(path: string): Promise<void>;
}

export interface BackupDeps {
  /** Levert de fs lui op (Tauri: dynamische import binnen `isTauri()`). */
  getFs: () => Promise<BackupFs>;
  /** Serialiseer document `docId` naar IFC + lever de projectnaam; null = document niet gevonden. */
  getDoc: (docId: string) => { ifc: string; projectName: string } | null;
  /** Staat de auto-backup-toggle aan? (spec: default aan; uit ⇒ altijd null). */
  autoBackupEnabled: () => Promise<boolean>;
  /** Tijdstempel-bron (testbaar); moet monotoon oplopen voor sorteerbare bestandsnamen. */
  now: () => number;
  /** Actief document-id — bron voor `makeManualBackup`. */
  activeDocId: () => string | null;
}

export interface BackupService {
  /** Auto-backup-hook (dispatch-grens): `(docId, kind) => backup-pad | null`. */
  ensureBackup: EnsureBackupFn;
  /** "Nu backup maken" op het actieve document; reset diens auto-teller. Rejec­t bij fout. */
  makeManualBackup: () => Promise<string>;
  /** Registreer een deze-sessie via `duplicate_document` geboren document (slaat auto-backup over). */
  markDuplicateBorn: (docId: string) => void;
  /** Reset de in-memory tellers (auto-backup-set + duplicate-born-set) — bij server-(her)start. */
  resetSession: () => void;
}

// --- Naam-/padhelpers ----------------------------------------------------------------------------

/** Saneer een projectnaam tot een veilige bestandsnaam-component; lege input → de gedeelde
 *  neutrale terugval (`DEFAULT_PROJECT_FILE_BASE`, ook gebruikt door de opslaan-dialoog, de
 *  rapport-export, de STEP-header en de MSPDI/P6-export — één begrip, één waarde). */
export function sanitizeProjectName(name: string): string {
  const cleaned = (name ?? '')
    .replace(/[\/\\:*?"<>|]/g, '_') // padscheiders + Windows-verboden tekens
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '') // geen trailing punt/spatie (Windows)
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : DEFAULT_PROJECT_FILE_BASE;
}

/** Compacte, lexicografisch-sorteerbare tijdstempel (= chronologisch): `2026-07-24T14-30-00-000Z`. */
function stamp(ts: number): string {
  return new Date(ts).toISOString().replace(/[:.]/g, '-');
}

/** Bestandsnaam `<veilige-projectnaam>-<timestamp>.ifc`. */
export function backupFileName(projectName: string, ts: number): string {
  return `${sanitizeProjectName(projectName)}-${stamp(ts)}.ifc`;
}

/** Trekt het tijdstempel-achtervoegsel uit een backup-bestandsnaam (voor chronologisch opruimen). */
const TS_SUFFIX = /-(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z)\.ifc$/;
function stampOf(fileName: string): string {
  const m = fileName.match(TS_SUFFIX);
  return m ? m[1] : ''; // geen match ⇒ sorteert als oudste
}

// --- Pure kern -----------------------------------------------------------------------------------

export function createBackupService(deps: BackupDeps): BackupService {
  // In-memory tellers, één instantie per server-sessie (reset via `resetSession`).
  const autoBackedUp = new Set<string>(); // docId's die deze sessie al een auto-backup kregen
  const duplicateBorn = new Set<string>(); // docId's geboren via duplicate_document (auto overslaan)

  /** Schrijf één snapshot voor `docId`, ruim daarna op, en geef het pad terug. Rejec­t bij fs-fout. */
  async function writeSnapshot(docId: string): Promise<string> {
    const doc = deps.getDoc(docId);
    if (!doc) throw new Error(`AI-backup: document '${docId}' niet gevonden`);
    const fs = await deps.getFs();
    const base = await fs.appDataDir();
    const docDir = await fs.join(base, BACKUP_ROOT, docId);
    await fs.mkdir(docDir);
    const path = await fs.join(docDir, backupFileName(doc.projectName, deps.now()));
    await fs.writeTextFile(path, doc.ifc); // een fout hier propageert → runtime vertaalt naar BACKUP_FAILED
    await prune(fs, docDir);
    return path;
  }

  /** Houd hoogstens `MAX_PER_DOC` .ifc-backups in de submap; verwijder de oudste (op tijdstempel). */
  async function prune(fs: BackupFs, docDir: string): Promise<void> {
    const names = (await fs.readDir(docDir)).map((e) => e.name).filter((n) => n.endsWith('.ifc'));
    if (names.length <= MAX_PER_DOC) return;
    names.sort((a, b) => (stampOf(a) < stampOf(b) ? -1 : stampOf(a) > stampOf(b) ? 1 : 0)); // oudste eerst
    for (const name of names.slice(0, names.length - MAX_PER_DOC)) {
      await fs.remove(await fs.join(docDir, name));
    }
  }

  const ensureBackup: EnsureBackupFn = async (docId, kind) => {
    if (!MUTATING_KINDS.has(kind)) return null;         // alleen mutate/batch triggeren
    if (duplicateBorn.has(docId)) return null;          // duplicate-born → geboortestaat ís de bron
    if (autoBackedUp.has(docId)) return null;           // al één auto-backup deze sessie
    if (!(await deps.autoBackupEnabled())) return null; // toggle uit
    const path = await writeSnapshot(docId);            // fout propageert (fail-safe, geen consume)
    autoBackedUp.add(docId);
    return path;
  };

  async function makeManualBackup(): Promise<string> {
    const docId = deps.activeDocId();
    if (!docId) throw new Error('AI-backup: geen actief document om te back-uppen');
    const path = await writeSnapshot(docId);
    autoBackedUp.delete(docId); // reset de auto-teller voor dit document (spec)
    return path;
  }

  return {
    ensureBackup,
    makeManualBackup,
    markDuplicateBorn: (docId: string) => { duplicateBorn.add(docId); },
    resetSession: () => { autoBackedUp.clear(); duplicateBorn.clear(); },
  };
}

// --- Echte (Tauri) fs + deps ---------------------------------------------------------------------

/** Tauri-fs: dynamische imports binnen `isTauri()` (nooit top-level — dat breekt de web-build). */
async function realFs(): Promise<BackupFs> {
  const { writeTextFile, readDir, remove, mkdir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  return {
    appDataDir: () => appDataDir(),
    join: (...parts: string[]) => join(...parts),
    mkdir: async (dir: string) => { await mkdir(dir, { recursive: true }); },
    writeTextFile: (p: string, c: string) => writeTextFile(p, c),
    readDir: async (dir: string) => (await readDir(dir)).map((e) => ({ name: e.name })),
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
      return { ifc: writeIFC(buildWriteIFCInput(found.payload)), projectName: found.payload.project.name };
    },
    autoBackupEnabled: () => import('@/utils/settingsStore').then((m) => m.loadAiAutoBackup()),
    now: () => Date.now(),
    activeDocId: () => app.store.getState().activeDocumentId,
  };
}

/**
 * Bouw een backupservice rond precies één storecontext. De optionele overrides zijn de testnaad
 * voor fs, klok en toggle; `getDoc` en `activeDocId` blijven standaard uitsluitend uit `app` komen.
 * Zonder overrides hergebruiken we per context één instantie, zodat de eenmalig-per-sessie-tellers
 * niet bij elk nieuw MCP-request opnieuw beginnen.
 */
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

// --- Appwrapper + publieke Tauri-gated wrappers --------------------------------------------------

function service(): BackupService {
  return createAppBackupService(appStoreContext);
}

let warnedWeb = false;
function warnWebOnce(): null {
  if (!warnedWeb) {
    warnedWeb = true;
    console.warn('AI-backup: geen bridge in de web-build; backup overgeslagen (theoretisch pad).');
  }
  return null;
}

/** Auto-backup-hook voor `buildMcpContext`. Web/niet-Tauri ⇒ null (met één waarschuwing). */
export const ensureBackup: EnsureBackupFn = (docId, kind) =>
  isTauri() ? service().ensureBackup(docId, kind) : Promise.resolve(warnWebOnce());

/** "Nu backup maken". Web/niet-Tauri ⇒ reject (er is geen fs-bestemming). */
export function makeManualBackup(): Promise<string> {
  if (!isTauri()) return Promise.reject(new Error('AI-backup: alleen in de desktop-app beschikbaar'));
  return service().makeManualBackup();
}

/**
 * Registreer een via `duplicate_document` (baan F2) in DEZE sessie geboren document, zodat het de
 * automatische backup overslaat (zijn geboortestaat is de nog-openstaande bron). CONTRACT voor de
 * document-tools: roep dit aan direct nadat een `duplicate_document`-kopie het actieve document is
 * geworden, met het id van de kopie. "Nu backup maken" blijft op zo'n document gewoon werken.
 */
export function markDuplicateBorn(docId: string): void {
  if (!isTauri()) return;
  service().markDuplicateBorn(docId);
}

/** Reset de per-sessie-tellers; aanroepen bij het (her)starten van de bridge. */
export function resetBackupSession(): void {
  if (!isTauri()) return;
  service().resetSession();
}

/** Open de ai-backups-map in de bestandsbeheerder (shell-open-plugin); maakt hem eerst aan. */
export async function openBackupFolder(): Promise<void> {
  if (!isTauri()) return;
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { mkdir } = await import('@tauri-apps/plugin-fs');
  const { open } = await import('@tauri-apps/plugin-shell');
  const dir = await join(await appDataDir(), BACKUP_ROOT);
  await mkdir(dir, { recursive: true }); // op een verse installatie bestaat de map nog niet
  await open(dir);
}
