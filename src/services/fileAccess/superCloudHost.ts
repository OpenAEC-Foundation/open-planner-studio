import type {
  SITE_CONFLICT_CODE, SiteFileInfo, SiteStorage, SiteVersionInfo,
} from './siteHost';

export type HostVersion = string | number;

interface SuperCloudHost {
  open(id: string, version?: HostVersion): Promise<unknown>;
  save(bytes: Uint8Array, options: { id?: string; name?: string; expectedVersion?: HostVersion }): Promise<unknown>;
  list(): Promise<unknown>;
  versions(id: string): Promise<unknown>;
}

export const VERSION_CONFLICT_CODE = 'VERSION_CONFLICT';

export const KIND_NOT_ALLOWED_CODE = 'soort_niet_toegestaan';

const CONFLICT: typeof SITE_CONFLICT_CODE = 'conflict';

export function isSuperCloudHost(value: unknown): value is SuperCloudHost {
  if (typeof value !== 'object' || value === null) return false;
  const h = value as Record<string, unknown>;
  return typeof h.open === 'function' && typeof h.save === 'function'
    && typeof h.list === 'function' && typeof h.versions === 'function';
}

const conflictCopies = new WeakSet<object>();

export function isConflictCopyAnswer(answer: unknown): boolean {
  return typeof answer === 'object' && answer !== null && conflictCopies.has(answer);
}

const adapters = new WeakMap<object, SiteStorage>();

export function superCloudStorage(host: SuperCloudHost): SiteStorage {
  let storage = adapters.get(host);
  if (!storage) {
    storage = createAdapter(host);
    adapters.set(host, storage);
  }
  return storage;
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function mapError(err: unknown): unknown {
  if (field(err, 'code') !== VERSION_CONFLICT_CODE) return err;
  const message = typeof field(err, 'message') === 'string' ? field(err, 'message') as string : String(err);
  return Object.assign(new Error(message), { code: CONFLICT, cause: err });
}

function createAdapter(host: SuperCloudHost): SiteStorage {
  const originals = new Map<string, Map<string, HostVersion>>();

  const remember = (id: string, version: unknown): string | null => {
    if (typeof version !== 'string' && typeof version !== 'number') return null;
    const key = text(version);
    if (key === null) return null;
    let known = originals.get(id);
    if (!known) { known = new Map(); originals.set(id, known); }
    known.set(key, version);
    return key;
  };
  const original = (id: string, version: string): HostVersion => originals.get(id)?.get(version) ?? version;

  const call = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (err) {
      throw mapError(err);
    }
  };

  return {
    async list() {
      const files = await call(() => host.list());
      if (!Array.isArray(files)) return [];
      const result: SiteFileInfo[] = [];
      for (const f of files as unknown[]) {
        const id = text(field(f, 'id'));
        const name = field(f, 'name');
        if (id === null || typeof name !== 'string') continue;
        const modified = field(f, 'modified');
        result.push({ id, name, ...(typeof modified === 'string' ? { modified } : {}) });
      }
      return result;
    },

    async open(id, version) {
      const fileId = String(id);
      const answer = await call(() => (version === undefined
        ? host.open(fileId)
        : host.open(fileId, original(fileId, version))));
      const readVersion = remember(fileId, field(answer, 'version'));
      const name = field(answer, 'name');
      const file: SiteFileInfo = {
        id: fileId,
        name: typeof name === 'string' && name.length > 0 ? name : fileId,
        ...(readVersion !== null ? { version: readVersion } : {}),
      };
      return {
        file,
        data: field(answer, 'bytes') as ArrayBuffer | Uint8Array,
        readOnly: field(answer, 'readOnly') === true,
      };
    },

    async save({ id, name, data, baseVersion }) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      const target = id === undefined ? undefined : String(id);
      const options: { id?: string; name?: string; expectedVersion?: HostVersion } = target === undefined
        ? { name }
        : { id: target, ...(baseVersion !== undefined ? { expectedVersion: original(target, baseVersion) } : {}) };
      const answer = await call(() => host.save(bytes, options));
      const savedId = text(field(answer, 'id'));
      const answerName = field(answer, 'name');
      const result: SiteFileInfo = {
        id: savedId ?? '',
        name: typeof answerName === 'string' && answerName.length > 0 ? answerName : name,
      };
      const savedVersion = savedId !== null ? remember(savedId, field(answer, 'version')) : null;
      if (savedVersion !== null) result.version = savedVersion;
      if (target !== undefined && savedId !== null && savedId !== target) conflictCopies.add(result);
      return result;
    },

    async versions(id) {
      const fileId = String(id);
      const list = await call(() => host.versions(fileId));
      if (!Array.isArray(list)) return [];
      const result: SiteVersionInfo[] = [];
      for (const v of list as unknown[]) {
        const version = remember(fileId, field(v, 'version'));
        if (version === null) continue;
        const modified = field(v, 'modified');
        const author = field(v, 'author');
        result.push({
          version,
          ...(typeof modified === 'string' ? { modified } : {}),
          ...(typeof author === 'string' ? { author } : {}),
        });
      }
      return result;
    },
  };
}
