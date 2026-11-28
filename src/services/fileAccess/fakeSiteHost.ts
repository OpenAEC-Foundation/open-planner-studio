import { openDb, idbGetAll } from '@/utils/idb';
import {
  SITE_CONFLICT_CODE, SITE_HOST_READY_EVENT, SITE_NOT_FOUND_CODE,
  type OpenAECHost, type SiteFileInfo, type SiteStorage, type SiteVersionInfo,
} from './siteHost';
import { extensionOf } from '@/utils/filePath';
import { generateId } from '@/utils/id';
import { KIND_NOT_ALLOWED_CODE, type HostVersion } from './superCloudHost';

const DB = 'ops-fake-site';
const STORE = 'files';
const AUTHOR = 'Nep-site';

interface FakeVersion { version: string; modified: string; author: string; data: string }
interface FakeFile { id: string; name: string; versions: FakeVersion[] }

async function allFiles(): Promise<FakeFile[]> {
  return idbGetAll<FakeFile>(DB, STORE);
}

async function findFile(id: string): Promise<FakeFile> {
  const file = (await allFiles()).find((f) => f.id === id);
  if (!file) {
    throw Object.assign(new Error(`Bestand ${id} bestaat niet op de nep-site.`), { code: SITE_NOT_FOUND_CODE });
  }
  return file;
}

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

async function pushVersion(file: FakeFile, text: string): Promise<void> {
  const modified = new Date().toISOString();
  file.versions.push({ version: String(Number(latest(file).version) + 1), modified, author: AUTHOR, data: text });
  await putFile(file);
}

function hostRef(file: FakeFile, version = latest(file)) {
  return { id: file.id, name: file.name, version: Number(version.version) };
}

const superCloudFunctions = {
  async open(id: string, version?: HostVersion) {
    const file = await findFile(id);
    const found = version === undefined ? latest(file) : file.versions.find((v) => Number(v.version) === Number(version));
    if (!found) throw new Error(`Versie ${String(version)} van ${file.name} bestaat niet op de nep-site.`);
    return {
      ...hostRef(file, found),
      readOnly: version !== undefined || flag('fakeSiteReadOnly'),
      bytes: new TextEncoder().encode(found.data),
    };
  },

  async save(bytes: Uint8Array, options: { id?: string; name?: string; expectedVersion?: HostVersion }) {
    const text = new TextDecoder('utf-8').decode(bytes);
    const modified = new Date().toISOString();
    if (options.id === undefined) {
      const name = options.name ?? 'Naamloos.ifc';
      if (extensionOf(name) !== 'ifc') {
        throw Object.assign(new Error(`De nep-site neemt geen .${extensionOf(name) || '?'}-bestanden aan voor deze tool.`), { code: KIND_NOT_ALLOWED_CODE });
      }
      const file: FakeFile = { id: newId(), name, versions: [{ version: '1', modified, author: AUTHOR, data: text }] };
      await putFile(file);
      return hostRef(file);
    }
    const file = await findFile(options.id);
    const current = Number(latest(file).version);
    if (flag('fakeSiteConflict') || (options.expectedVersion !== undefined && Number(options.expectedVersion) !== current)) {
      const ext = /\.[^.]+$/.exec(file.name)?.[0] ?? '';
      const copy: FakeFile = {
        id: newId(),
        name: `${ext ? file.name.slice(0, -ext.length) : file.name} (kopie)${ext}`,
        versions: [{ version: '1', modified, author: AUTHOR, data: text }],
      };
      await putFile(copy);
      return hostRef(copy);
    }
    await pushVersion(file, text);
    return hostRef(file);
  },

  async list() {
    return (await allFiles())
      .sort((a, b) => latest(b).modified.localeCompare(latest(a).modified))
      .map((f) => ({ id: f.id, name: f.name, modified: latest(f).modified }));
  },

  async versions(id: string) {
    const file = await findFile(id);
    return [...file.versions].reverse().map((v) => ({ version: Number(v.version), modified: v.modified, author: v.author }));
  },
};

interface ExampleEntry { file: string; name: string; category?: string }

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

export async function installFakeSiteHost(): Promise<void> {
  const skipWelcome = flag('skipWelcome');
  if (skipWelcome) window.openaecHost = { skipWelcome: true } satisfies OpenAECHost;
  try {
    await seedIfEmpty();
  } catch (err) {
    console.error('[nep-site] Startbestanden laden mislukt:', err);
  }
  const superCloud = new URLSearchParams(window.location.search).get('fakeSiteShape') === 'supercloud';
  const host: OpenAECHost = superCloud
    ? { ...superCloudFunctions, ...(skipWelcome ? { skipWelcome: true } : {}) }
    : { storage, ...(skipWelcome ? { skipWelcome: true } : {}) };
  if (flag('fakeSiteInitial')) {
    const first = (await storage.list())[0];
    if (first) host.initialFileId = first.id;
  }
  window.openaecHost = host;
  window.dispatchEvent(new Event(SITE_HOST_READY_EVENT));
  console.info(`[nep-site] window.openaecHost staat klaar${superCloud ? ' in de SuperCloud-vorm' : ''} (alleen DEV).`);
}
