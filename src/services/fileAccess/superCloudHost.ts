/**
 * De SUPERCLOUD-VORM van het hostcontract (issue #818). De echte OpenAEC SuperCloud zet de functies
 * direct op `window.openaecHost`, niet onder `storage`:
 *
 * ```ts
 * interface HostFileRef { id: string; name: string; version: string | number }
 * open(id, version?)  → HostFileRef & { readOnly: boolean; bytes: ArrayBuffer | Uint8Array }
 * save(bytes, { id?, name?, expectedVersion? }) → HostFileRef
 * list()              → { id, name, modified }[]
 * versions(id)        → { version, modified, author? }[]
 * ```
 *
 * Deze module zet zo'n host om naar de interne `SiteStorage` uit `siteHost.ts`, zodat de rest van de
 * app (site-backend, opslaanroute, dialogen) maar één vorm kent. Afspraken:
 *
 *  - Eén adapter per hostobject (WeakMap): de adapter onthoudt per bestand welke versiewaarde de host
 *    gaf (getal of tekst). De interne laag werkt met tekst; `expectedVersion` en `open(id, version)`
 *    krijgen de oorspronkelijke waarde terug, in dezelfde soort.
 *  - Ids zijn altijd tekst (`String()`).
 *  - `save` met `id` dat een ANDER `id` teruggeeft, is een conflictkopie: de host bewaarde het werk in
 *    een kopie. De adapter markeert dat antwoord (`isConflictCopyAnswer`); alleen dan accepteert de
 *    site-backend een ander id. Bij de `storage`-vorm blijft een ander id een fout.
 *  - Een fout met `code: 'VERSION_CONFLICT'` (zo meldt Open Calc Studio een conflict) wordt een fout
 *    met `code: 'conflict'`, de bestaande conflictmelding. Elke andere fout gaat ongewijzigd door,
 *    ook `soort_niet_toegestaan` (de tool toont dan de tekst van de host).
 *  - `readOnly: true` van `open` gaat mee in het antwoord; de site-backend opent het document dan
 *    zonder opslagdoel.
 *
 * Bewust zonder `instanceof`: een host op `window.parent` maakt zijn objecten in een ander venster.
 */
import type {
  SITE_CONFLICT_CODE, SiteFileInfo, SiteStorage, SiteVersionInfo,
} from './siteHost';

/** De versiewaarde zoals de SuperCloud hem geeft. */
export type HostVersion = string | number;

/** De functies van de SuperCloud-vorm, zoals de adapter ze aanroept. */
interface SuperCloudHost {
  open(id: string, version?: HostVersion): Promise<unknown>;
  save(bytes: Uint8Array, options: { id?: string; name?: string; expectedVersion?: HostVersion }): Promise<unknown>;
  list(): Promise<unknown>;
  versions(id: string): Promise<unknown>;
}

/** De code waarmee Open Calc Studio (en mogelijk een host) een conflict meldt. */
export const VERSION_CONFLICT_CODE = 'VERSION_CONFLICT';

/** De code waarmee de SuperCloud een opslag in een vreemd formaat weigert. */
export const KIND_NOT_ALLOWED_CODE = 'soort_niet_toegestaan';

// Een letterlijke waarde in plaats van een import: `siteHost.ts` importeert deze module, en zo
// blijft de afhankelijkheid één kant op (alleen typen hierheen).
const CONFLICT: typeof SITE_CONFLICT_CODE = 'conflict';

/** Heeft de host zelf de vier functies van de SuperCloud-vorm? */
export function isSuperCloudHost(value: unknown): value is SuperCloudHost {
  if (typeof value !== 'object' || value === null) return false;
  const h = value as Record<string, unknown>;
  return typeof h.open === 'function' && typeof h.save === 'function'
    && typeof h.list === 'function' && typeof h.versions === 'function';
}

/** Antwoorden van `save` die een conflictkopie zijn. Alleen deze module vult de set. */
const conflictCopies = new WeakSet<object>();

/** Is dit antwoord van `save` een conflictkopie van de SuperCloud-vorm? */
export function isConflictCopyAnswer(answer: unknown): boolean {
  return typeof answer === 'object' && answer !== null && conflictCopies.has(answer);
}

const adapters = new WeakMap<object, SiteStorage>();

/** De adapter voor deze host. Eén per hostobject, zodat de onthouden versies blijven. */
export function superCloudStorage(host: SuperCloudHost): SiteStorage {
  let storage = adapters.get(host);
  if (!storage) {
    storage = createAdapter(host);
    adapters.set(host, storage);
  }
  return storage;
}

/** Tekst uit een veld van de host, of `null` als het leeg of afwezig is. */
function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

/** Zet `VERSION_CONFLICT` om naar de interne conflictcode; elke andere fout gaat ongewijzigd door. */
function mapError(err: unknown): unknown {
  if (field(err, 'code') !== VERSION_CONFLICT_CODE) return err;
  const message = typeof field(err, 'message') === 'string' ? field(err, 'message') as string : String(err);
  return Object.assign(new Error(message), { code: CONFLICT, cause: err });
}

function createAdapter(host: SuperCloudHost): SiteStorage {
  // Per bestand-id: de versie als tekst → de waarde zoals de host hem gaf.
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
  /** De waarde voor de host. Onbekend: de tekst zelf (een host die tekst gebruikt, krijgt dan tekst). */
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
      // Zonder versie roept de adapter `open` met één argument aan, zoals het contract het toont.
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
      // `bytes` zet de site-backend om (`siteDataToBytes`, zonder `instanceof`); een ontbrekende
      // inhoud geeft daar een duidelijke fout.
      return {
        file,
        data: field(answer, 'bytes') as ArrayBuffer | Uint8Array,
        readOnly: field(answer, 'readOnly') === true,
      };
    },

    async save({ id, name, data, baseVersion }) {
      // `arrayBuffer` en geen `instanceof Blob`: zie de kop.
      const bytes = new Uint8Array(await data.arrayBuffer());
      const target = id === undefined ? undefined : String(id);
      const options: { id?: string; name?: string; expectedVersion?: HostVersion } = target === undefined
        ? { name }
        : { id: target, ...(baseVersion !== undefined ? { expectedVersion: original(target, baseVersion) } : {}) };
      const answer = await call(() => host.save(bytes, options));
      const savedId = text(field(answer, 'id'));
      const answerName = field(answer, 'name');
      const result: SiteFileInfo = {
        // Geen id: de site-backend weigert het antwoord (geen `?? target`, anders valt dat stil weg).
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
