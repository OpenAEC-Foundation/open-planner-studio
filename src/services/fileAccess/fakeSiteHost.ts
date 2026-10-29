/**
 * NEP-SITE voor ontwikkeling (issue #309). Alleen in DEV: `main.tsx` laadt deze module dynamisch
 * achter `import.meta.env.DEV` en `?fakeSite=1`, dus hij valt volledig uit een productiebouw.
 *
 * Doet wat een echte site doet volgens het contract in `siteHost.ts`: bestanden met versies, hier in
 * IndexedDB (`ops-fake-site`, dus met het `ops-`-voorvoegsel). Bij de eerste keer komen er een paar
 * startbestanden in uit `public/examples/`; het eerste krijgt twee versies, zodat "oudere versie
 * openen" meteen te proberen is.
 *
 * Extra URL-vlaggen, alleen om paden te kunnen proberen:
 *  - `fakeSiteConflict=1`: elke opslag van een nieuwe versie wordt geweigerd met `code: 'conflict'`.
 *  - `fakeSiteInitial=1`: de host zet `initialFileId` op het eerste bestand (startbestand).
 *  - `skipWelcome=1`: de host zet `skipWelcome: true` (#583). Dat staat er meteen, nog vóór de
 *    database gevuld is, zodat de welkomstcheck (na de herstelcontrole) het in de regel al ziet.
 *
 * De host komt pas na het vullen van de database, dus via het event `openaec-host-ready` — precies de
 * route van een site die de host na het laden zet.
 */
import { openDb, idbGetAll } from '@/utils/idb';
import {
  SITE_CONFLICT_CODE, SITE_HOST_READY_EVENT, SITE_NOT_FOUND_CODE,
  type OpenAECHost, type SiteFileInfo, type SiteStorage, type SiteVersionInfo,
} from './siteHost';
import { extensionOf } from '@/utils/filePath';
import { generateId } from '@/utils/id';

const DB = 'ops-fake-site';
const STORE = 'files';
const AUTHOR = 'Nep-site';

interface FakeVersion { version: string; modified: string; author: string; data: string }
/** Eén bestand; `versions` oudste eerst. */
interface FakeFile { id: string; name: string; versions: FakeVersion[] }

async function allFiles(): Promise<FakeFile[]> {
  return idbGetAll<FakeFile>(DB, STORE);
}

async function findFile(id: string): Promise<FakeFile> {
  const file = (await allFiles()).find((f) => f.id === id);
  if (!file) {
    // Zoals het contract het vraagt: "bestaat niet" met een eigen code, zodat Recent het opruimt.
    throw Object.assign(new Error(`Bestand ${id} bestaat niet op de nep-site.`), { code: SITE_NOT_FOUND_CODE });
  }
  return file;
}

/** Schrijven MET foutmelding (anders dan `idbPut`, dat stil faalt): een nep-site die doet alsof hij
 *  opsloeg terwijl dat niet zo is, zou precies het verkeerde gedrag laten zien. */
async function putFile(file: FakeFile): Promise<void> {
  const db = await openDb(DB, STORE);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Nep-site: schrijven mislukt.'));
    tx.onabort = () => reject(tx.error ?? new Error('Nep-site: schrijven afgebroken.'));
  });
}

const latest = (file: FakeFile): FakeVersion => file.versions[file.versions.length - 1];

function infoOf(file: FakeFile, version = latest(file)): SiteFileInfo {
  return { id: file.id, name: file.name, version: version.version, modified: version.modified, size: version.data.length };
}

function newId(): string {
  // Geen `crypto.randomUUID`: dat bestaat alleen in een veilige context (https of localhost), en de
  // dev-server draait ook op een gewoon http-adres (Tailscale).
  return generateId('fake');
}

function flag(name: string): boolean {
  return new URLSearchParams(window.location.search).get(name) === '1';
}

const storage: SiteStorage = {
  async list(query) {
    const extensions = query?.extensions?.map((e) => e.toLowerCase());
    return (await allFiles())
      .filter((f) => !extensions || extensions.includes(extensionOf(f.name)))
      .sort((a, b) => latest(b).modified.localeCompare(latest(a).modified))
      .map((f) => infoOf(f));
  },

  async open(id, version) {
    const file = await findFile(id);
    const found = version === undefined ? latest(file) : file.versions.find((v) => v.version === version);
    if (!found) throw new Error(`Versie ${version} van ${file.name} bestaat niet op de nep-site.`);
    return { file: infoOf(file, found), data: new Blob([found.data], { type: 'application/x-step' }) };
  },

  async save({ id, name, data, baseVersion }) {
    // Bewust `arrayBuffer` en geen `instanceof Blob` (zie het contract): ook een site in een ander
    // venster moet zo met de inhoud overweg kunnen.
    const text = new TextDecoder('utf-8').decode(await data.arrayBuffer());
    const modified = new Date().toISOString();
    if (id === undefined) {
      const file: FakeFile = { id: newId(), name, versions: [{ version: '1', modified, author: AUTHOR, data: text }] };
      await putFile(file);
      return infoOf(file);
    }
    const file = await findFile(id);
    const current = latest(file);
    if (flag('fakeSiteConflict') || (baseVersion !== undefined && baseVersion !== current.version)) {
      throw Object.assign(
        new Error(`De nep-site heeft al versie ${current.version}; de tool ging uit van versie ${baseVersion ?? '?'}.`),
        { code: SITE_CONFLICT_CODE },
      );
    }
    file.versions.push({ version: String(Number(current.version) + 1), modified, author: AUTHOR, data: text });
    await putFile(file);
    return infoOf(file);
  },

  async versions(id) {
    const file = await findFile(id);
    return [...file.versions].reverse().map((v): SiteVersionInfo => ({
      version: v.version, modified: v.modified, author: v.author, label: v.version,
    }));
  },
};

interface ExampleEntry { file: string; name: string; category?: string }

/** Vul een lege nep-site met twee voorbeelden; het eerste krijgt twee versies. */
async function seedIfEmpty(): Promise<void> {
  if ((await allFiles()).length > 0) return;
  const base = import.meta.env.BASE_URL;
  const manifest = await fetch(`${base}examples/manifest.json`).then((r) => r.json()) as { examples?: ExampleEntry[] };
  const examples = (manifest.examples ?? []).slice(0, 2);
  const now = Date.now();
  for (const [index, example] of examples.entries()) {
    const data = await fetch(`${base}examples/${example.file}`).then((r) => r.text());
    const versions: FakeVersion[] = index === 0
      ? [
        { version: '1', modified: new Date(now - 2 * 86_400_000).toISOString(), author: AUTHOR, data },
        { version: '2', modified: new Date(now - 86_400_000).toISOString(), author: AUTHOR, data },
      ]
      : [{ version: '1', modified: new Date(now - 3 * 86_400_000).toISOString(), author: AUTHOR, data }];
    await putFile({ id: newId(), name: example.file, versions });
  }
}

/** Installeer de nep-site op `window.openaecHost` en meld dat met `openaec-host-ready`. */
export async function installFakeSiteHost(): Promise<void> {
  const skipWelcome = flag('skipWelcome');
  // Alleen het welkomstveld, zonder opslag: zo is er nog geen site tot de database klaar is.
  if (skipWelcome) window.openaecHost = { skipWelcome: true } satisfies OpenAECHost;
  try {
    await seedIfEmpty();
  } catch (err) {
    console.error('[nep-site] Startbestanden laden mislukt:', err);
  }
  const host: OpenAECHost = { storage, ...(skipWelcome ? { skipWelcome: true } : {}) };
  if (flag('fakeSiteInitial')) {
    const first = (await storage.list())[0];
    if (first) host.initialFileId = first.id;
  }
  window.openaecHost = host;
  window.dispatchEvent(new Event(SITE_HOST_READY_EVENT));
  console.info('[nep-site] window.openaecHost staat klaar (alleen DEV).');
}
