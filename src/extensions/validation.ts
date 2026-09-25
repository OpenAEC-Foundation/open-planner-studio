import type {
  CatalogEntry,
  CatalogIssue,
  ExtensionCategory,
  ExtensionCatalog,
  ExtensionManifest,
  ExtensionPermission,
  ParseResult,
  ReadyStoredExtension,
} from './types';
import { KNOWN_PERMISSIONS } from './permissions';

export type ManifestParseMode = 'fresh' | 'stored-legacy';

export const EXTENSION_LIMITS = {
  id: 128,
  name: 160,
  version: 64,
  author: 160,
  description: 4_000,
  main: 512,
  tags: 32,
  tag: 64,
  iconBytes: 128 * 1024,
  storedMainCodeBytes: 48 * 1024 * 1024,
  assetBytes: 24 * 1024 * 1024,
  assetTotalBytes: 48 * 1024 * 1024,
} as const;

const EXTENSION_CATEGORIES: readonly ExtensionCategory[] = [
  'Import/Export',
  'Planning',
  'Reporting',
  'Utility',
  'Fonts',
  'Other',
];

// GEEN eigen permissielijst hier: `permissions.ts` is de ene bron van waarheid (regressiebevinding
// her-review 2 — een tweede, handgekopieerde lijst hier liet 'importSource' onbereikbaar voor élke
// extensie, want elk installatiepad parseert met mode 'fresh' en `parsePermissions` weigert een
// niet-erkende permissie). `permissions.ts` importeert alleen `./types` en `appLog`, dus dit vormt
// geen cyclus.
const EXTENSION_PERMISSIONS: readonly ExtensionPermission[] = KNOWN_PERMISSIONS;

const VERSION_PATTERN = /^[0-9]+(?:\.[0-9]+){0,3}$/;
const EXTENSION_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,127})$/;
const RESERVED_IDS = new Set(['__proto__', 'prototype', 'constructor']);

function fail<T>(error: string): ParseResult<T> {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseString(
  value: unknown,
  field: string,
  maxLength: number,
  allowEmpty = false,
): ParseResult<string> {
  if (typeof value !== 'string') return fail(`${field} moet een string zijn`);
  if (!allowEmpty && value.length === 0) return fail(`${field} mag niet leeg zijn`);
  if (value.length > maxLength) {
    return fail(`${field} mag maximaal ${maxLength} tekens bevatten`);
  }
  return { ok: true, value, warnings: [] };
}

function parseVersion(value: unknown, field: string): ParseResult<string> {
  const parsed = parseString(value, field, EXTENSION_LIMITS.version);
  if (!parsed.ok) return parsed;
  if (!VERSION_PATTERN.test(parsed.value)) {
    return fail(`${field} moet uit één tot vier numerieke delen bestaan`);
  }
  return parsed;
}

function parseExtensionId(value: unknown): ParseResult<string> {
  const parsed = parseString(value, 'id', EXTENSION_LIMITS.id);
  if (!parsed.ok) return parsed;
  if (!EXTENSION_ID_PATTERN.test(parsed.value) || RESERVED_IDS.has(parsed.value)) {
    return fail('id heeft geen geldige extensie-identiteit');
  }
  return parsed;
}

function parseMainPath(value: unknown): ParseResult<string> {
  const parsed = parseString(value, 'main', EXTENSION_LIMITS.main);
  if (!parsed.ok) return parsed;
  if (parsed.value.includes('\\') || parsed.value.includes('\0')) {
    return fail('main moet een veilig relatief pad met /-scheiding zijn');
  }
  const segments = parsed.value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return fail('main moet een veilig relatief pad zonder lege, .- of ..-segmenten zijn');
  }
  return parsed;
}

function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.startsWith('/') || value.includes('\\') || value.includes('\0')) {
    return false;
  }
  return !value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
}

function parseStoredAssets(input: unknown): ParseResult<Record<string, Uint8Array>> {
  if (!isPlainRecord(input)) return fail('assets moet een gewoon object zijn');

  const assets: Record<string, Uint8Array> = Object.create(null);
  let totalBytes = 0;
  for (const [name, value] of Object.entries(input)) {
    if (!isSafeRelativePath(name)) {
      return fail(`assetnaam ${JSON.stringify(name)} is geen veilig relatief pad`);
    }
    if (!(value instanceof Uint8Array)) {
      return fail(`asset "${name}" moet een Uint8Array zijn`);
    }
    if (value.byteLength > EXTENSION_LIMITS.assetBytes) {
      return fail(
        `asset "${name}" overschrijdt de limiet van ${EXTENSION_LIMITS.assetBytes} bytes`,
      );
    }
    totalBytes += value.byteLength;
    if (totalBytes > EXTENSION_LIMITS.assetTotalBytes) {
      return fail(
        `assets overschrijden samen de limiet van ${EXTENSION_LIMITS.assetTotalBytes} bytes`,
      );
    }
    assets[name] = new Uint8Array(value);
  }
  return { ok: true, value: assets, warnings: [] };
}

function isExtensionCategory(value: string): value is ExtensionCategory {
  return EXTENSION_CATEGORIES.some((category) => category === value);
}

function isExtensionPermission(value: unknown): value is ExtensionPermission {
  return typeof value === 'string'
    && EXTENSION_PERMISSIONS.some((permission) => permission === value);
}

function parseCategory(value: unknown): ParseResult<ExtensionCategory> {
  if (typeof value !== 'string' || !isExtensionCategory(value)) {
    return fail('category is geen bekende extensiecategorie');
  }
  return { ok: true, value, warnings: [] };
}

function parsePermissions(
  value: unknown,
  mode: ManifestParseMode,
): ParseResult<ExtensionPermission[]> {
  if (!Array.isArray(value)) return fail('permissions moet een array zijn');

  const permissions: ExtensionPermission[] = [];
  let removed = 0;
  for (const candidate of value) {
    if (!isExtensionPermission(candidate)) {
      if (mode === 'fresh') return fail('permissions bevat een onbekende permission');
      removed++;
      continue;
    }
    if (!permissions.includes(candidate)) permissions.push(candidate);
  }

  return {
    ok: true,
    value: permissions,
    warnings: removed > 0
      ? [`${removed} onbekende legacypermission(s) verwijderd`]
      : [],
  };
}

function parseTags(value: unknown): ParseResult<string[]> {
  if (!Array.isArray(value)) return fail('tags moet een array zijn');
  if (value.length > EXTENSION_LIMITS.tags) {
    return fail(`tags mag maximaal ${EXTENSION_LIMITS.tags} waarden bevatten`);
  }

  const tags: string[] = [];
  for (const candidate of value) {
    const parsed = parseString(candidate, 'tag', EXTENSION_LIMITS.tag, true);
    if (!parsed.ok) return parsed;
    if (!tags.includes(parsed.value)) tags.push(parsed.value);
  }
  return { ok: true, value: tags, warnings: [] };
}

function parseHttpUrl(value: unknown, field: string): ParseResult<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return fail(`${field} moet een niet-lege http(s)-URL zijn`);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fail(`${field} moet een http(s)-URL zijn`);
    }
  } catch {
    return fail(`${field} moet een geldige http(s)-URL zijn`);
  }
  return { ok: true, value, warnings: [] };
}

function parseLastUpdated(value: unknown): ParseResult<string> {
  if (typeof value !== 'string') return fail('lastUpdated moet een ISO-datumstring zijn');
  const isoPattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/;
  if (!isoPattern.test(value)) return fail('lastUpdated moet een geldige ISO-datum zijn');
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    return fail('lastUpdated moet een bestaande ISO-datum zijn');
  }
  return { ok: true, value, warnings: [] };
}

function parseIcon(value: unknown): ParseResult<string> {
  if (typeof value !== 'string') return fail('icon moet een string zijn');
  if (new TextEncoder().encode(value).byteLength > EXTENSION_LIMITS.iconBytes) {
    return fail(`icon mag maximaal ${EXTENSION_LIMITS.iconBytes} UTF-8-bytes bevatten`);
  }
  return { ok: true, value, warnings: [] };
}

/**
 * Reconstrueer een manifest uit een niet-vertrouwde waarde.
 *
 * `fresh` is strikt voor nieuwe JS-/ZIP-/catalogusinvoer. `stored-legacy` accepteert uitsluitend de
 * expliciete, veilige compatibiliteitsdefaults voor oudere IndexedDB-records en meldt iedere
 * normalisatie. De uitkomst deelt geen arrays of objectvelden met de bron.
 */
export function parseExtensionManifest(
  input: unknown,
  mode: ManifestParseMode,
): ParseResult<ExtensionManifest> {
  if (!isRecord(input)) return fail('manifest moet een object zijn');

  const id = parseExtensionId(input.id);
  if (!id.ok) return id;
  const name = parseString(input.name, 'name', EXTENSION_LIMITS.name);
  if (!name.ok) return name;
  const version = parseVersion(input.version, 'version');
  if (!version.ok) return version;
  const author = parseString(input.author, 'author', EXTENSION_LIMITS.author);
  if (!author.ok) return author;
  const description = parseString(
    input.description,
    'description',
    EXTENSION_LIMITS.description,
    true,
  );
  if (!description.ok) return description;
  const category = parseCategory(input.category);
  if (!category.ok) return category;
  const main = parseMainPath(input.main);
  if (!main.ok) return main;

  const warnings: string[] = [];

  let minAppVersion: string;
  if (input.minAppVersion === undefined && mode === 'stored-legacy') {
    minAppVersion = '0.0.0';
    warnings.push('minAppVersion ontbreekt; legacydefault 0.0.0 toegepast');
  } else {
    const parsed = parseVersion(input.minAppVersion, 'minAppVersion');
    if (!parsed.ok) return parsed;
    minAppVersion = parsed.value;
  }

  let permissions: ExtensionPermission[];
  if (input.permissions === undefined && mode === 'stored-legacy') {
    permissions = [];
    warnings.push('permissions ontbreken; legacydefault [] toegepast');
  } else {
    const parsed = parsePermissions(input.permissions, mode);
    if (!parsed.ok) return parsed;
    permissions = parsed.value;
    warnings.push(...parsed.warnings);
  }

  let apiVersion: string | undefined;
  if (input.apiVersion !== undefined) {
    const parsed = parseVersion(input.apiVersion, 'apiVersion');
    if (!parsed.ok) return parsed;
    apiVersion = parsed.value;
  }

  let tags: string[] | undefined;
  if (input.tags !== undefined) {
    const parsed = parseTags(input.tags);
    if (!parsed.ok) return parsed;
    tags = parsed.value;
  }

  let repository: string | undefined;
  if (input.repository !== undefined) {
    const parsed = parseHttpUrl(input.repository, 'repository');
    if (!parsed.ok) return parsed;
    repository = parsed.value;
  }

  let icon: string | undefined;
  if (input.icon !== undefined) {
    const parsed = parseIcon(input.icon);
    if (!parsed.ok) return parsed;
    icon = parsed.value;
  }

  const value: ExtensionManifest = {
    id: id.value,
    name: name.value,
    version: version.value,
    minAppVersion,
    author: author.value,
    description: description.value,
    category: category.value,
    main: main.value,
    permissions,
  };
  if (apiVersion !== undefined) value.apiVersion = apiVersion;
  if (repository !== undefined) value.repository = repository;
  if (tags !== undefined) value.tags = tags;
  if (icon !== undefined) value.icon = icon;

  return { ok: true, value, warnings };
}

/**
 * Reconstrueer één IndexedDB-record en koppel het aan de sleutel waarmee het werkelijk is gelezen.
 * Legacydefaults bestaan alleen in de geretourneerde waarde; deze parser schrijft niets terug.
 */
export function parseStoredExtension(
  input: unknown,
  storageKey: IDBValidKey,
): ParseResult<ReadyStoredExtension> {
  if (!isRecord(input)) return fail('opgeslagen extensie moet een object zijn');

  const id = parseExtensionId(input.id);
  if (!id.ok) return id;
  if (storageKey !== id.value) {
    return fail('opslagsleutel en record-id moeten exact gelijk zijn');
  }

  const manifest = parseExtensionManifest(input.manifest, 'stored-legacy');
  if (!manifest.ok) return manifest;
  if (manifest.value.id !== id.value) {
    return fail('manifest-id en record-id moeten exact gelijk zijn');
  }

  if (typeof input.mainCode !== 'string') return fail('mainCode moet een string zijn');
  if (input.mainCode.length === 0) return fail('mainCode mag niet leeg zijn');
  const mainCodeBytes = new TextEncoder().encode(input.mainCode).byteLength;
  if (mainCodeBytes > EXTENSION_LIMITS.storedMainCodeBytes) {
    return fail(
      `mainCode overschrijdt de limiet van ${EXTENSION_LIMITS.storedMainCodeBytes} UTF-8-bytes`,
    );
  }
  if (typeof input.enabled !== 'boolean') return fail('enabled moet een boolean zijn');

  let assets: Record<string, Uint8Array> | undefined;
  if (input.assets !== undefined) {
    const parsedAssets = parseStoredAssets(input.assets);
    if (!parsedAssets.ok) return parsedAssets;
    assets = parsedAssets.value;
  }

  return {
    ok: true,
    value: {
      id: id.value,
      manifest: manifest.value,
      mainCode: input.mainCode,
      enabled: input.enabled,
      ...(assets !== undefined ? { assets } : {}),
      legacyWarnings: [...manifest.warnings],
      storageKey,
    },
    warnings: [...manifest.warnings],
  };
}

function generatedJavaScriptManifest(fileName: string): unknown {
  const id = fileName.replace(/\.js$/, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  return {
    id,
    name: fileName.replace(/\.js$/, ''),
    version: '1.0.0',
    // Zonder expliciet manifest is de contractversie onbekend; de bestaande compatibiliteitspoort
    // behandelt een ontbrekende apiVersion als legacy in plaats van een garantie te verzinnen.
    minAppVersion: '0.0.0',
    author: 'Onbekend',
    description: `Extensie geladen uit ${fileName}`,
    category: 'Other',
    main: 'main.js',
    permissions: ['events'],
  };
}

function manifestJsonFromComment(code: string): ParseResult<unknown> | null {
  const blockComment = /\/\*[\s\S]*?\*\//g;
  let found: ParseResult<unknown> | null = null;

  for (const match of code.matchAll(blockComment)) {
    const comment = match[0].slice(2, -2);
    const marker = /@manifest\b/.exec(comment);
    if (!marker) continue;
    if (found !== null) return fail('meer dan één @manifest-commentblok gevonden');

    const tail = comment.slice(marker.index + marker[0].length).trimStart();
    if (!tail.startsWith('{')) {
      found = fail('@manifest moet direct door een JSON-object worden gevolgd');
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let index = 0; index < tail.length; index++) {
      const character = tail[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === '{') depth++;
      else if (character === '}') {
        depth--;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }

    if (end < 0 || depth !== 0 || inString) {
      found = fail('@manifest bevat geen afgesloten JSON-object');
      continue;
    }
    if (tail.slice(end + 1).trim().length > 0) {
      found = fail('@manifest bevat tekst na het JSON-object');
      continue;
    }

    try {
      found = { ok: true, value: JSON.parse(tail.slice(0, end + 1)) as unknown, warnings: [] };
    } catch (error) {
      found = fail(`@manifest bevat ongeldige JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return found;
}

/** Lees een optioneel `@manifest`-commentblok en valideer altijd de uiteindelijke fresh vorm. */
export function manifestFromJavaScript(
  code: string,
  fileName: string,
): ParseResult<ExtensionManifest> {
  const extracted = manifestJsonFromComment(code);
  if (extracted !== null) {
    if (!extracted.ok) return extracted;
    return parseExtensionManifest(extracted.value, 'fresh');
  }
  return parseExtensionManifest(generatedJavaScriptManifest(fileName), 'fresh');
}

function parseCatalogEntry(input: unknown): ParseResult<CatalogEntry> {
  if (!isRecord(input)) return fail('catalogusentry moet een object zijn');

  const id = parseExtensionId(input.id);
  if (!id.ok) return id;
  const name = parseString(input.name, 'name', EXTENSION_LIMITS.name);
  if (!name.ok) return name;
  const version = parseVersion(input.version, 'version');
  if (!version.ok) return version;
  const author = parseString(input.author, 'author', EXTENSION_LIMITS.author);
  if (!author.ok) return author;
  const description = parseString(
    input.description,
    'description',
    EXTENSION_LIMITS.description,
    true,
  );
  if (!description.ok) return description;
  const category = parseCategory(input.category);
  if (!category.ok) return category;
  const tags = parseTags(input.tags);
  if (!tags.ok) return tags;
  const minAppVersion = parseVersion(input.minAppVersion, 'minAppVersion');
  if (!minAppVersion.ok) return minAppVersion;
  const repository = parseHttpUrl(input.repository, 'repository');
  if (!repository.ok) return repository;
  const downloadUrl = parseHttpUrl(input.downloadUrl, 'downloadUrl');
  if (!downloadUrl.ok) return downloadUrl;

  let apiVersion: string | undefined;
  if (input.apiVersion !== undefined) {
    const parsed = parseVersion(input.apiVersion, 'apiVersion');
    if (!parsed.ok) return parsed;
    apiVersion = parsed.value;
  }

  let sha256: string | undefined;
  if (input.sha256 !== undefined) {
    if (typeof input.sha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(input.sha256)) {
      return fail('sha256 moet exact 64 hextekens bevatten');
    }
    sha256 = input.sha256;
  }

  let icon: string | undefined;
  if (input.icon !== undefined) {
    const parsed = parseIcon(input.icon);
    if (!parsed.ok) return parsed;
    icon = parsed.value;
  }

  const value: CatalogEntry = {
    id: id.value,
    name: name.value,
    version: version.value,
    author: author.value,
    description: description.value,
    category: category.value,
    tags: tags.value,
    minAppVersion: minAppVersion.value,
    repository: repository.value,
    downloadUrl: downloadUrl.value,
  };
  if (apiVersion !== undefined) value.apiVersion = apiVersion;
  if (sha256 !== undefined) value.sha256 = sha256;
  if (icon !== undefined) value.icon = icon;

  return { ok: true, value, warnings: [] };
}

function catalogIdHint(input: unknown): string | undefined {
  if (!isRecord(input) || typeof input.id !== 'string' || input.id.length === 0) return undefined;
  return input.id.slice(0, EXTENSION_LIMITS.id);
}

/** Parse het catalogustopobject atomair en isoleer fouten vervolgens per entry. */
export function parseCatalog(input: unknown): ParseResult<{
  catalog: ExtensionCatalog;
  issues: CatalogIssue[];
}> {
  if (!isRecord(input)) return fail('catalogus moet een object zijn');
  const version = parseVersion(input.version, 'catalogus.version');
  if (!version.ok) return version;
  const lastUpdated = parseLastUpdated(input.lastUpdated);
  if (!lastUpdated.ok) return lastUpdated;
  if (!Array.isArray(input.extensions)) return fail('catalogus.extensions moet een array zijn');

  const extensions: CatalogEntry[] = [];
  const issues: CatalogIssue[] = [];
  const acceptedIds = new Set<string>();

  for (let index = 0; index < input.extensions.length; index++) {
    const rawEntry = input.extensions[index];
    const parsed = parseCatalogEntry(rawEntry);
    if (!parsed.ok) {
      const idHint = catalogIdHint(rawEntry);
      issues.push({
        index,
        ...(idHint !== undefined ? { idHint } : {}),
        error: parsed.error,
      });
      continue;
    }
    if (acceptedIds.has(parsed.value.id)) {
      issues.push({
        index,
        idHint: parsed.value.id,
        error: `dubbele catalogus-id "${parsed.value.id}"`,
      });
      continue;
    }
    acceptedIds.add(parsed.value.id);
    extensions.push(parsed.value);
  }

  return {
    ok: true,
    value: {
      catalog: {
        version: version.value,
        lastUpdated: lastUpdated.value,
        extensions,
      },
      issues,
    },
    warnings: [],
  };
}
