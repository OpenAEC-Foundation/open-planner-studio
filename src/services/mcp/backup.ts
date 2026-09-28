// AI-backup-service.
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

/**
 * Opruimbeleid per map: uitdunnen (eigenaarsbesluit 2026-09-28). Hoe ouder, hoe minder er blijven:
 *  - jonger dan `recentDays`: alles, met een veiligheidsgrens van `recentMax` stuks;
 *  - tot `weeklyUntilDays`: de nieuwste per kalenderweek (UTC, maandag als begin);
 *  - tot `monthlyUntilDays`: de nieuwste per kalendermaand;
 *  - ouder: de nieuwste per kalenderjaar, behalve in de map van een nooit opgeslagen document
 *    (`unsaved-`, zie `bucketKeepsYearly`): die is per sessie nieuw; bleef daar één per jaar staan,
 *    dan groeide het aantal mappen onbegrensd door.
 * Wat deze service in de lopende sessie schreef, blijft altijd staan. Een bestand zonder ons
 * tijdstempel in de naam is niet van ons en wordt nooit aangeraakt.
 */
export const BACKUP_RETENTION = {
  recentDays: 7,
  recentMax: 20,
  weeklyUntilDays: 30,
  monthlyUntilDays: 365,
} as const;

/** Alleen deze tool-`kind`s triggeren een auto-backup. `batch` telt als ÉÉN. */
const MUTATING_KINDS: ReadonlySet<McpToolDef['kind']> = new Set<McpToolDef['kind']>(['mutate', 'batch']);

// --- Injecteerbare naden -------------------------------------------------------------------------

/** Minimale fs-abstractie; de Tauri-implementatie zit in `realFs()`, de test spuit een fake in. */
export interface BackupFs {
  appDataDir(): Promise<string>;
  join(...parts: string[]): Promise<string>;
  /** Maakt de submap aan (recursief); no-op wanneer hij al bestaat. */
  mkdir(dir: string): Promise<void>;
  writeTextFile(path: string, content: string): Promise<void>;
  readDir(dir: string): Promise<{ name: string; isDirectory?: boolean }[]>;
  /** Verwijdert een bestand of een LEGE map (niet recursief). */
  remove(path: string): Promise<void>;
}

export interface BackupDeps {
  /** Levert de fs lui op (Tauri: dynamische import binnen `isTauri()`). */
  getFs: () => Promise<BackupFs>;
  /** Serialiseer document `docId` naar IFC + lever de projectnaam en (indien opgeslagen) het
   *  bestandspad; null = document niet gevonden. */
  getDoc: (docId: string) => { ifc: string; projectName: string; filePath?: string | null } | null;
  /** Staat de auto-backup-toggle aan? (default aan; uit ⇒ altijd null). */
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

/**
 * De backup-submap van een document. Document-id's zijn per sessie nieuw (tijd + toeval), dus een
 * submap per id liet het opruimbeleid ("laatste 10") nooit over sessies heen werken: elke
 * app-start opende voor hetzelfde projectbestand een nieuwe map met een volle IFC, en de map groeide
 * onbegrensd (audit 2026-09-26). Een opgeslagen document krijgt daarom een VASTE submap op zijn
 * bestandspad (leesbare bestandsnaam + hash van het volledige pad, zodat twee gelijknamige
 * bestanden in verschillende mappen niet in één emmer vallen). Een nooit opgeslagen document houdt
 * zijn doc-id: er is geen stabielere identiteit, en projectnamen botsen (spec §AI-backup).
 */
export function backupBucket(docId: string, filePath: string | null | undefined): string {
  // Voorvoegsel sinds de review van 2026-09-28: zo is een map van een nooit opgeslagen document te
  // onderscheiden van een map van vóór deze wijziging (kale doc-id; kan bij een opgeslagen bestand
  // horen). Alleen `unsaved-` valt onder het strengste opruimregime (zie `bucketKeepsYearly`).
  if (!filePath) return `unsaved-${docId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < filePath.length; i++) {
    hash ^= filePath.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const base = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]*$/, '') ?? '';
  return `file-${sanitizeProjectName(base).slice(0, 40)}-${hash.toString(16).padStart(8, '0')}`;
}

/** Trekt het tijdstempel-achtervoegsel uit een backup-bestandsnaam (spiegel van `stamp`). */
const TS_SUFFIX = /-(\d{4}-\d\d-\d\d)T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z\.ifc$/;
/** Tijdstip van een backup uit zijn bestandsnaam, of null als het niet onze naam is. Bewust niet de
 *  wijzigingstijd van het bestand: kopiëren en synchroniseren zetten die opnieuw. */
export function backupTimeOf(fileName: string): number | null {
  const m = fileName.match(TS_SUFFIX);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return Number.isFinite(t) ? t : null;
}

const DAY_MS = 86_400_000;

/**
 * Welke backups in één map weg mogen volgens `BACKUP_RETENTION`. Puur: `names` zijn de namen in de
 * map, `keepYearly` is onwaar alleen voor de map van een nooit opgeslagen document, `protectedNames` zijn de
 * in deze sessie geschreven backups. Namen zonder ons tijdstempel komen nooit in de uitvoer.
 */
export function backupsToRemove(
  names: readonly string[],
  now: number,
  keepYearly: boolean,
  protectedNames: ReadonlySet<string> = new Set(),
): string[] {
  const ours = names
    .map((name) => ({ name, t: backupTimeOf(name) }))
    .filter((e): e is { name: string; t: number } => e.t !== null)
    .sort((a, b) => b.t - a.t || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0)); // nieuwste eerst
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
      // 1970-01-01 was een donderdag: +3 dagen legt de weekgrens op maandag.
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

/**
 * Blijft er in deze map na een jaar één backup per jaar staan? Nee alleen voor de map van een
 * nooit opgeslagen document (`unsaved-`): die is per sessie nieuw, dus anders groeit het aantal mappen
 * onbegrensd. Wel voor de vaste map van een opgeslagen bestand (`file-`), en ook voor een map van
 * vóór 2026-09-28 (kale doc-id): die kan bij een opgeslagen bestand horen, en het oude beleid hield
 * de laatste tien er voor altijd. Het zijn er een eindig aantal.
 */
function bucketKeepsYearly(bucket: string): boolean {
  return !bucket.startsWith('unsaved-');
}

// --- Pure kern -----------------------------------------------------------------------------------

export function createBackupService(deps: BackupDeps): BackupService {
  // In-memory tellers, één instantie per server-sessie (reset via `resetSession`).
  const autoBackedUp = new Set<string>(); // docId's die deze sessie al een auto-backup kregen
  const duplicateBorn = new Set<string>(); // docId's geboren via duplicate_document (auto overslaan)
  const writtenThisSession = new Set<string>(); // bestandsnamen die deze instantie schreef: nooit opruimen
  let sweptOtherBuckets = false;              // de andere mappen één keer per sessie nalopen

  /** Schrijf één snapshot voor `docId`, ruim daarna op, en geef het pad terug. Rejec­t bij fs-fout. */
  async function writeSnapshot(docId: string): Promise<string> {
    const doc = deps.getDoc(docId);
    if (!doc) throw new Error(`AI-backup: document '${docId}' niet gevonden`);
    const fs = await deps.getFs();
    const base = await fs.appDataDir();
    const bucket = backupBucket(docId, doc.filePath);
    const docDir = await fs.join(base, BACKUP_ROOT, bucket);
    await fs.mkdir(docDir);
    const now = deps.now();
    const name = backupFileName(doc.projectName, now);
    const path = await fs.join(docDir, name);
    await fs.writeTextFile(path, doc.ifc); // een fout hier propageert → runtime vertaalt naar BACKUP_FAILED
    writtenThisSession.add(name);
    // Opruimen is bijzaak: een fout daarin mag de geschreven backup (en de tool-aanroep) niet laten falen.
    try {
      await prune(fs, docDir, bucketKeepsYearly(bucket), now);
      if (!sweptOtherBuckets) {
        sweptOtherBuckets = true;
        await sweepOtherBuckets(fs, await fs.join(base, BACKUP_ROOT), bucket, now);
      }
    } catch (err) {
      console.warn('AI-backup: opruimen mislukt', err);
    }
    return path;
  }

  /** Dun één map uit volgens `BACKUP_RETENTION`; geeft terug of er nog iets in de map staat. */
  async function prune(fs: BackupFs, dir: string, keepYearly: boolean, now: number): Promise<boolean> {
    const entries = await fs.readDir(dir);
    const doomed = backupsToRemove(entries.map((e) => e.name), now, keepYearly, writtenThisSession);
    for (const name of doomed) await fs.remove(await fs.join(dir, name));
    return entries.length > doomed.length;
  }

  /** De mappen die niet meer beschreven worden (vorige sessies, nooit opgeslagen documenten) ook
   *  uitdunnen, en een map van een nooit opgeslagen document weghalen zodra hij leeg is. */
  async function sweepOtherBuckets(fs: BackupFs, root: string, current: string, now: number): Promise<void> {
    for (const entry of await fs.readDir(root)) {
      if (!entry.isDirectory || entry.name === current) continue;
      // Per map afgeschermd: één onleesbare of vergrendelde map mag de rest niet overslaan (de sweep
      // draait maar één keer per sessie).
      try {
        const dir = await fs.join(root, entry.name);
        const keepYearly = bucketKeepsYearly(entry.name);
        const nonEmpty = await prune(fs, dir, keepYearly, now);
        if (!nonEmpty && !keepYearly) await fs.remove(dir);
      } catch (err) {
        console.warn(`AI-backup: map '${entry.name}' opruimen mislukt`, err);
      }
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
    autoBackedUp.delete(docId); // reset de auto-teller voor dit document
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
      return {
        ifc: writeIFC(buildWriteIFCInput(found.payload)),
        projectName: found.payload.project.name,
        filePath: found.payload.filePath,
      };
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
 * Registreer een via `duplicate_document` in DEZE sessie geboren document, zodat het de
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
