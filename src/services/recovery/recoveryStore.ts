import { isTauri } from '@/utils/platform';
import { idbGetAll, idbPut, idbDelete } from '@/utils/idb';
import {
  ownRecoveryNames, recoveryTmpSuffix,
  type RecoveryNames, type RecoveryManifest, type RecoveryManifestDoc,
} from '@/hooks/recoveryPaths';

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

// Padnamen + manifestvorm komen uit `@/hooks/recoveryPaths` — één bron voor de dev-slug-isolatie
// (zie daar), gedeeld met de auto-save-/herstel-hooks.
const names = ownRecoveryNames;
const manifestName = names.manifest;
const legacyFile = names.legacy;
const ifcName = names.ifcName;

/** Achtervoegsel van het halffabricaat van een atomaire schrijfactie (zie `saveTauri`). */
const TMP_SUFFIX = recoveryTmpSuffix;

/** Manifestversie mét eigenaarschapsvelden. Zie `RecoveryManifest` voor de migratieregel. */
export const RECOVERY_MANIFEST_VERSION = 2;

/**
 * Id van DEZE app-instantie (proces/realm). Wordt in het manifest gezet zodat een volgende
 * schrijfronde kan zien of het manifest dat er staat van onszelf is of van iemand anders — zie
 * `manifestOwnership` en `planRecoveryCleanup`.
 */
function newInstanceId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
const instanceId = newInstanceId();

/** IFC-bestandsnamen die DEZE instantie ooit zelf heeft geschreven. */
const ownWritten = new Set<string>();
/**
 * IFC-bestandsnamen die we van een VREEMDE eigenaar in ons manifest hebben overgenomen. Ze staan
 * daarmee wel in "ons" manifest, maar ze zijn niet van ons en mogen dus nooit door onze opruimlus
 * gewist worden.
 */
const adoptedIfc = new Set<string>();

export type ManifestOwnership = 'none' | 'own' | 'legacy' | 'foreign';

/**
 * Van wie is het manifest dat er staat?
 *   `none`    — er is er geen (of hij was onleesbaar);
 *   `own`     — door deze instantie geschreven;
 *   `legacy`  — v1-manifest zonder `ownerId`: geschreven door een build van vóór deze wijziging,
 *               dus per definitie niet door een gelijktijdig draaiende instantie mét de fix.
 *               Overnemen is hier de veilige keuze; niet-overnemen zou betekenen dat de eerste
 *               start na de update nooit meer opruimt;
 *   `foreign` — een andere `ownerId`.
 */
export function manifestOwnership(prev: RecoveryManifest | null, self: string): ManifestOwnership {
  if (!prev) return 'none';
  if (typeof prev.ownerId !== 'string' || prev.ownerId === '') return 'legacy';
  return prev.ownerId === self ? 'own' : 'foreign';
}

export interface RecoveryCleanupInput {
  /** Bestandsnamen zoals `readDir` ze oplevert (namen, geen paden). */
  listing: string[];
  /** Het manifest zoals het er stond VÓÓR deze schrijfronde (null = geen/onleesbaar). */
  prev: RecoveryManifest | null;
  /** Id van deze app-instantie. */
  self: string;
  /** IFC-bestandsnamen die we zojuist geschreven hebben — die blijven per definitie staan. */
  keep: string[];
  /** IFC-bestandsnamen die deze instantie ooit zelf schreef. */
  ownWritten: string[];
  /** IFC-bestandsnamen die we van een vreemde eigenaar hebben overgenomen. */
  adopted: string[];
  /** Naamgeving van DEZE base. */
  names: RecoveryNames;
}

export interface RecoveryCleanupPlan {
  ownership: ManifestOwnership;
  /** Exacte bestandsnamen die weg mogen. */
  remove: string[];
  /** Documentregels van een vreemde eigenaar die in ons manifest mee moeten. */
  carryOver: RecoveryManifestDoc[];
}

/**
 * Bepaal wat één auto-save-ronde mag opruimen (bevinding K5).
 *
 * De oude lus was "alles in de map met de prefix dat niet in mijn keep-set zit" en dat is precies
 * de bug: bij twee vensters wiste elke ronde de complete snapshotverzameling van de ander. De
 * regel is nu omgedraaid — opruimen mag ALLEEN binnen de eigen boekhouding:
 *
 *   kandidaten = (het vorige manifest, mits van onszelf of van vóór deze wijziging)
 *              ∪ (wat deze instantie zelf heeft geschreven)
 *   minus        (wat we net geschreven hebben)
 *   minus        (wat we van een vreemde eigenaar hebben overgenomen)
 *   ∩            (wat er daadwerkelijk in de map staat, op EXACTE naam)
 *
 * Er wordt dus nooit meer op een prefix door de map geveegd: een bestand dat wij niet zelf hebben
 * aangemaakt of geërfd, raken we niet aan — ook niet als single-instance ooit bewust uit gaat.
 *
 * Is het manifest van een ander, dan worden diens documentregels NIET gewist maar meegenomen in
 * ons manifest (`carryOver`), zodat ze bij de volgende start nog steeds als herstelkandidaat
 * worden aangeboden in plaats van stil wees te worden.
 *
 * Over `heartbeatAt`: dat veld wordt geschreven en is hier beschikbaar, maar het bepaalt bewust
 * NIET of we mogen wissen. Een verse heartbeat is niet te onderscheiden tussen "er draait nu een
 * tweede venster" en "het proces is drie seconden geleden gecrasht" — precies het geval waarvoor
 * recovery bestaat. Elke drempel kiest dus tussen het wissen van de bestanden van een levend
 * venster en het wissen van de bestanden van een crashslachtoffer. Daarom wissen we hier
 * überhaupt niets van een vreemde eigenaar; opruimen van vreemde snapshots gebeurt uitsluitend
 * via `clearRecovery()`, dus nadat de gebruiker ze aangeboden heeft gekregen en heeft gekozen.
 */
export function planRecoveryCleanup(input: RecoveryCleanupInput): RecoveryCleanupPlan {
  const { listing, prev, self, keep, names: n } = input;
  const ownership = manifestOwnership(prev, self);
  const present = new Set(listing);
  const keepSet = new Set(keep);
  const adopted = new Set(input.adopted);

  const candidates = new Set<string>();
  if (prev && (ownership === 'own' || ownership === 'legacy')) {
    for (const d of prev.documents) {
      if (d && typeof d.ifc === 'string') candidates.add(d.ifc);
    }
  }
  for (const name of input.ownWritten) candidates.add(name);

  const remove: string[] = [];
  for (const name of candidates) {
    if (keepSet.has(name) || adopted.has(name)) continue;
    // Naamvorm van een ándere base (of geen snapshotnaam) → nooit aanraken. Dit is de tweede
    // helft van K5: de productie-base `recovery` is een prefix van elke dev-base.
    if (n.snapshotDocId(name) === null) continue;
    if (present.has(name)) remove.push(name);
    if (present.has(name + recoveryTmpSuffix)) remove.push(name + recoveryTmpSuffix);
  }

  // Halffabricaten van een afgebroken schrijfactie voor bestanden die we NU schrijven (en voor het
  // manifest zelf): die horen na een geslaagde `rename` niet meer te bestaan, dus wat er ligt is
  // een restant van een crash. Ze worden op exacte naam aangewezen, niet met een sweep, zodat een
  // in-flight `.tmp` van een andere instantie buiten schot blijft.
  for (const name of [...keep, n.manifest]) {
    const tmp = name + recoveryTmpSuffix;
    if (present.has(tmp) && !remove.includes(tmp)) remove.push(tmp);
  }

  const carryOver: RecoveryManifestDoc[] = [];
  if (prev && ownership === 'foreign') {
    for (const d of prev.documents) {
      if (!d || typeof d.ifc !== 'string' || typeof d.id !== 'string') continue;
      if (keepSet.has(d.ifc)) continue;      // zelfde document — onze eigen regel wint
      if (!present.has(d.ifc)) continue;     // snapshot is er niet (meer)
      carryOver.push({ id: d.id, ifc: d.ifc, filePath: d.filePath ?? null, isDirty: d.isDirty ?? true });
    }
  }

  return { ownership, remove, carryOver };
}

/**
 * Bepaal wat `clearRecovery()` weghaalt: alle bestanden van DEZE base, op exacte naam.
 *
 * Bewust breder dan de opruimlus hierboven, en dat is bevinding K4: sinds `loadTauri` bij een
 * corrupt manifest terugvalt op een directory-scan zou een snapshot die het manifest niet noemde
 * anders bij de VOLGENDE start opnieuw als herstelkandidaat opduiken — terwijl de gebruiker net
 * "verwerpen" (of een geslaagd herstel) achter de rug heeft. Wissen betekent wissen.
 *
 * Bewust NIET afhankelijk van eigenaarschap: wat hier weggaat is exact wat de gebruiker zojuist
 * kreeg aangeboden, en `loadTauri` biedt aan wat er staat. De begrenzing zit in de EXACTE
 * naamvorm — een productiebuild raakt geen `recovery.<slug>.…` van een dev-worktree meer aan, en
 * een dev-build geen productiebestanden.
 */
export function planRecoveryClear(
  listing: string[],
  manifest: RecoveryManifest | null,
  n: RecoveryNames,
): string[] {
  const out = new Set<string>();
  for (const name of listing) {
    if (n.isOwnFile(name)) out.add(name);
  }
  // Manifestregels meenemen ook als de directory-scan niets opleverde (bijv. `readDir` faalde):
  // wél gefilterd op onze eigen naamvorm.
  for (const d of manifest?.documents ?? []) {
    if (d && typeof d.ifc === 'string' && n.snapshotDocId(d.ifc) !== null) out.add(d.ifc);
  }
  return [...out];
}

async function saveTauri(activeId: string, docs: RecoveryDocContent[]): Promise<void> {
  const { writeTextFile, readDir, readTextFile, exists, remove, rename, mkdir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  await mkdir(dir, { recursive: true }); // op een verse installatie bestaat de map nog niet (issue #72)

  /**
   * Schrijf-en-vervang in twee stappen (bevinding K4). `writeTextFile` truncate't het doelbestand
   * vóórdat het schrijft, dus een crash midden in de schrijfactie liet precies datgene achter
   * waarvoor recovery bestaat: een AFGEKAPTE snapshot — en die kwam er ongemerkt doorheen, want
   * `readIFC` gooide nooit.
   *
   * Een atomaire schrijf-primitief kent `plugin-fs` niet; `rename` is het beste wat er is. Die
   * mapt op `std::fs::rename`, en binnen dezelfde map (dus gegarandeerd hetzelfde volume) is dat
   * een atomaire vervanging op zowel POSIX als Windows. Na een crash staat er dus óf het complete
   * oude, óf het complete nieuwe bestand — nooit een halve.
   *
   * Wat dit NIET afdekt: er is geen `fsync`/flush in `plugin-fs`, dus bij stroomuitval of een
   * kernel-panic kan de rename op sommige bestandssystemen vóór de data landen. Tegen een
   * app-crash — het scenario van deze bevinding — dekt het wel volledig.
   */
  const writeAtomic = async (name: string, text: string): Promise<void> => {
    const target = await join(dir, name);
    const tmp = await join(dir, `${name}${TMP_SUFFIX}`);
    await writeTextFile(tmp, text);
    try {
      await rename(tmp, target);
    } catch (err) {
      try { await remove(tmp); } catch { /* al weg */ }
      throw err;
    }
  };

  // Het manifest zoals het er NU staat, vóór we het overschrijven: dat is de enige bron waaruit
  // we weten welke snapshots van ons zijn (en of er inmiddels een andere instantie schrijft).
  let prev: RecoveryManifest | null = null;
  try {
    const manifestPath = await join(dir, manifestName);
    if (await exists(manifestPath)) prev = parseRecoveryManifest(await readTextFile(manifestPath));
  } catch (err) {
    console.error('Recovery: kon het bestaande manifest niet lezen vóór het opslaan:', err);
  }

  const keep: string[] = [];
  for (const d of docs) {
    const name = ifcName(d.id);
    await writeAtomic(name, d.ifc);
    ownWritten.add(name);
    keep.push(name);
  }

  let listing: string[] = [];
  try {
    listing = (await readDir(dir)).map((e) => e.name).filter((n): n is string => !!n);
  } catch (err) {
    console.error('Recovery: kon de appDataDir niet doorlopen bij het opruimen:', err);
  }

  const plan = planRecoveryCleanup({
    listing, prev, self: instanceId, keep,
    ownWritten: [...ownWritten], adopted: [...adoptedIfc], names,
  });
  if (plan.ownership === 'foreign') {
    console.warn(
      `Recovery: het manifest is van een andere instantie (${prev?.ownerId}); ` +
      `${plan.carryOver.length} snapshot(s) blijven staan en worden meegenomen.`,
    );
  }
  for (const d of plan.carryOver) adoptedIfc.add(d.ifc);

  const manifest: RecoveryManifest = {
    version: RECOVERY_MANIFEST_VERSION,
    activeDocumentId: activeId,
    documents: [
      ...docs.map((d) => ({ id: d.id, ifc: ifcName(d.id), filePath: d.filePath, isDirty: d.isDirty })),
      ...plan.carryOver,
    ],
    ownerId: instanceId,
    heartbeatAt: Date.now(),
  };
  await writeAtomic(manifestName, JSON.stringify(manifest));

  for (const name of plan.remove) {
    try { await remove(await join(dir, name)); } catch { /* al weg */ }
    ownWritten.delete(name);
  }
}

/**
 * Lees het manifest defensief (bevinding K4). Voorheen stond deze `JSON.parse` BUITEN try/catch,
 * terwijl de per-document-lees eronder wél was afgeschermd: één corrupt manifestbestand liet
 * `loadRecovery()` gooien, waarna de opstartflow alle documenten als verloren beschouwde — terwijl
 * de losse `recovery.*.ifc`-snapshots gewoon nog op schijf stonden. Geeft `null` bij onleesbare of
 * vormvreemde inhoud, zodat de aanroeper kan terugvallen op de directory-scan.
 */
export function parseRecoveryManifest(raw: string): RecoveryManifest | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const m = parsed as RecoveryManifest;
    // Geldig JSON dat toevallig geen manifest is (`{"foo":1}`) moet net zo goed terugvallen:
    // zonder deze check gooide de `for…of` eronder alsnog.
    if (!Array.isArray(m.documents)) return null;
    return m;
  } catch {
    return null;
  }
}

/**
 * Terugval als het manifest ontbreekt of niet parst (bevinding K4): scan de appDataDir op losse
 * `<base>.<docId>.ifc`-snapshots. Eén stukgelopen JSON-bestandje mag nooit betekenen dat het
 * ECHTE werk — de snapshots zelf — als weg wordt beschouwd. Zonder manifest kennen we `filePath`
 * niet meer; `isDirty` staat op `true`, wat voor een crashsnapshot per definitie klopt.
 */
async function scanTauriSnapshots(): Promise<LoadedRecoveryDoc[]> {
  const { readDir, readTextFile, stat } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const docs: LoadedRecoveryDoc[] = [];

  for (const entry of await readDir(dir)) {
    const name = entry.name;
    // EXACTE naamvorm (K5): met de oude prefix-vergelijking pikte een productiebuild hier ook de
    // `recovery.<slug>.<docId>.ifc` van elke dev-worktree op. Het legacy-bestand valt hier
    // automatisch buiten (dat heeft geen doc-id-segment) en heeft zijn eigen terugval hieronder.
    const id = name ? names.snapshotDocId(name) : null;
    if (!name || !id) continue;
    try {
      const path = await join(dir, name);
      const ifc = await readTextFile(path);
      let mtime: Date | null = null;
      try { mtime = (await stat(path)).mtime; } catch { /* geen mtime — laat null */ }
      docs.push({ id, ifc, filePath: null, isDirty: true, mtime });
    } catch (err) {
      console.error('Recovery: kon gescande snapshot niet lezen:', name, err);
    }
  }
  return docs;
}

async function loadTauri(): Promise<LoadedRecovery> {
  const { readTextFile, exists, stat } = await import('@tauri-apps/plugin-fs');
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
      if (docs.length > 0) return { activeDocumentId: manifest.activeDocumentId ?? null, docs };
      // Manifest gelezen maar géén enkel document eruit leesbaar → alsnog scannen (hieronder):
      // misschien staan er snapshots die dit manifest niet (meer) noemt.
    } else {
      console.error('Recovery: manifest onleesbaar of vormvreemd — terugval op directory-scan.');
    }

    // Terugval (K4): de losse snapshots staan er nog; die mogen niet verloren gaan omdat één
    // klein JSON-bestand stuk is.
    const scanned = await scanTauriSnapshots();
    if (scanned.length > 0) return { activeDocumentId: scanned[0].id, docs: scanned };
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
  const { exists, readTextFile, remove, readDir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();

  let manifest: RecoveryManifest | null = null;
  const manifestPath = await join(dir, manifestName);
  if (await exists(manifestPath)) {
    try { manifest = parseRecoveryManifest(await readTextFile(manifestPath)); }
    catch { /* onleesbaar manifest — de directory-scan hieronder ruimt alsnog op */ }
  }

  let listing: string[] = [];
  try {
    listing = (await readDir(dir)).map((e) => e.name).filter((n): n is string => !!n);
  } catch (err) {
    console.error('Recovery: kon de appDataDir niet doorlopen bij het opruimen:', err);
  }

  for (const name of planRecoveryClear(listing, manifest, names)) {
    try { await remove(await join(dir, name)); } catch { /* al weg */ }
    ownWritten.delete(name);
    adoptedIfc.delete(name);
  }
  // Het manifest zelf zit al in de scan; als `readDir` faalde staat hij er nog.
  if (await exists(manifestPath)) {
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

/** Hoe lang we wachten voordat we een niet-verkregen claim als "echt bezet" beschouwen. */
const CLAIM_RETRY_MS = 150;

/**
 * Claim `name` voor de LEVENSDUUR van deze pagina via de Web Locks API.
 *
 * De lock wordt bewust nooit vrijgegeven: de callback geeft een promise terug die nooit rond komt,
 * waardoor de browser hem pas loslaat als het document weg is. Dat is het gedocumenteerde patroon
 * voor een "page lease". `ifAvailable` zorgt dat we niet gaan wachten maar meteen weten of iemand
 * anders hem al heeft.
 */
function claimLock(name: string): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return Promise.resolve(true); // geen Web Locks → oude situatie, geen detectie
  return new Promise<boolean>((resolve) => {
    locks.request(name, { mode: 'exclusive', ifAvailable: true }, (lock) => {
      resolve(lock !== null);
      if (!lock) return undefined;
      return new Promise<never>(() => { /* nooit vrijgeven: leeft zolang deze pagina leeft */ });
    }).catch(() => resolve(false));
  });
}

const delay = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });

/**
 * Per-tab id: overleeft reload/crash van hetzelfde tab (sessionStorage), niet tab-sluiten.
 *
 * Waarom hier een lock omheen staat (bevinding K5, webhelft). `sessionStorage` scheidt tabs — met
 * één uitzondering: "Tabblad dupliceren" KOPIEERT de volledige sessionStorage naar het nieuwe tab.
 * Twee levende tabs deelden daarna dezelfde sessie-id en daarmee dezelfde IndexedDB-sleutels: de
 * `clearRecovery()` van tab B wiste de records van tab A, en de opruimlus in `saveWeb` verwijderde
 * elke ronde de doc-records die B niet open had. Zelfde bug als de Tauri-kant, ander opslagmedium.
 *
 * De detectie moet noodzakelijk aan de andere tabs gevraagd worden — een gekopieerde
 * sessionStorage is lokaal niet van een echte te onderscheiden — en dat kan alleen asynchroon.
 * Vandaar dat dit een promise is die één keer per pagina wordt uitgerekend; de drie
 * web-backend-functies zijn toch al async.
 *
 * Bewuste keuze bij twijfel: als de claim mislukt minten we een NIEUWE id in plaats van de oude
 * te delen. De prijs bij een vals alarm (een reload waarbij de oude lock nog net niet los is) is
 * dat dit tab zijn eigen vorige snapshot niet meer terugvindt — die blijft staan en verdwijnt via
 * de 7-daagse opruiming. De prijs bij niet-detecteren is dat twee tabs elkaars snapshots WISSEN.
 * De ene retry met een korte pauze houdt dat valse alarm klein.
 */
async function resolveSessionId(): Promise<string> {
  let id: string;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    id = stored ?? crypto.randomUUID();
    if (!stored) sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    return 'default'; // sessionStorage geblokkeerd → vaste sleutel, zoals voorheen
  }

  const key = (v: string) => `${SESSION_KEY}:${v}`;
  if (await claimLock(key(id))) return id;
  // Eén korte retry: bij een gewone herlaad van hetzelfde tab kan de lock van het vorige document
  // net nog vastzitten, en dan is dit géén duplicaat.
  await delay(CLAIM_RETRY_MS);
  if (await claimLock(key(id))) return id;

  // Bezet door een ander levend tab (gedupliceerd tabblad): eigen id nemen.
  id = crypto.randomUUID();
  try { sessionStorage.setItem(SESSION_KEY, id); } catch { /* niet te schrijven — id blijft lokaal */ }
  console.warn('Recovery: sessie-id was al in gebruik door een ander tabblad — nieuwe id genomen.');
  await claimLock(key(id));
  return id;
}

let sessionIdPromise: Promise<string> | null = null;
function sessionId(): Promise<string> {
  if (!sessionIdPromise) sessionIdPromise = resolveSessionId();
  return sessionIdPromise;
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
  const sid = await sessionId();
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
  const sid = await sessionId();
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
  const sid = await sessionId();
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
