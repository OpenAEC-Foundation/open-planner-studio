/**
 * Corpusloze XER-fidelity-eindpoort (X12, plan §1/§2/§3/§4.1).
 *
 * Dit is nadrukkelijk GEEN tweede XER-lezer. De check leest uitsluitend gereviewde, statische
 * contractdata en bewaakt drie verschillende beweringen die CI zonder corpus nog kan doen:
 *
 *  A. 93 publieke bronoccurrences met hun volledige SHA-256, rol en inclusiebesluit;
 *  B. de onafhankelijke, na byte- en schema-dedup geselecteerde 34 orakelentries;
 *  D. de openbare task-replay-pin die A en B kruist zonder een replay uit te voeren.
 *
 * Laag C is een compacte maar volledig uitgepakte v2-karakteriseringssnapshot: hij bewaakt de
 * 34 entries en 47 projecten, maar verklaart zijn strict-nulpoort expliciet rood en ongeaccepteerd.
 * Daardoor kan corpusloze CI niet veinzen dat productfidelity nul is. `readXER`, scanner,
 * dedupbuilder, solveProject en de product-/replayadapter zijn hier daarom verboden imports.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { PRODUCT_AXES, canonicalProductJson, createProductEnvelope, decodeProductEnvelopeUnchecked, deriveStrictEntryGate, productProjectionDigest, productSha256, sealProductBaseline, selectProductReportMode, validateProductBaselineV2, type ProductBaselineV2, type ProductCountsV2, type ProductEnvelopeV2, type ProductValidationPins } from './xerProductBaselineV2';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const AXES = ['es', 'ef', 'ls', 'lf', 'tf', 'ff'] as const;
const ROLES = [
  'oracle', 'engine-input', 'parser-fixture', 'pseudo-xer', 'reference-only', 'synthetic-fixture',
] as const;

type Axis = (typeof AXES)[number];
type Role = (typeof ROLES)[number];
type AxisCounts = { deviations: number; measurable: number };
type ManifestEntry = {
  sha256: string;
  source: string;
  role: Role;
  included: boolean;
  exclusionReason?: string;
};
type Manifest = { version: number; policy: string; files: Record<string, ManifestEntry> };
type OracleEntry = {
  label: string;
  tasks: number;
  projects: number;
  counters: Record<Axis, AxisCounts>;
  schemaFingerprint?: string;
  reason?: string;
};
type OracleBaseline = { files: Record<string, OracleEntry> };
type ReplayAggregate = Record<Axis | 'overall', { improved: number; regressed: number; unchanged: number }>;
type ReplayPin = {
  version: number;
  manifestEntries: number;
  selectedEntries: number;
  projects: number;
  tasks: number;
  candidates: Record<string, { aggregate: ReplayAggregate; rejected: boolean; exitCode: number }>;
};
type ProductCounts = ProductCountsV2;
type ProductV2 = ProductBaselineV2;
type ProductEnvelope = ProductEnvelopeV2;

const EXPECTED = {
  manifestRawSha256: '6defbc4b4a71500565e5847750662060d9baca983952098dd1b334ac81d55786',
  baselineRawSha256: 'a7075bd27c73cecae71403bc9b06e8ef53707b756049598c60f125dec0c28b29',
  manifestProjectionSha256: 'd38022159ee17e335bb8bf8f736cb9549c8d5f9410132f9a9b4674fe6c23b56d',
  byteMultisetSha256: 'b48a8facd1f056a6b0f8219afb4aea46a01fda7be4df060af7cdc429bbf2fb19',
  oracleByteUniqueSha256: 'fad95534c46d31dca1d93ea634ba096fa467e101ade8f7e127fd95285d433528',
  selectedFullSha256: '685f738809d41450c89804dcb6cdd3481610d787e99734f00534b6f1797af0a3',
  selectedSchemaSha256: '26f635e84f858817b19d7493f4958a06113adcfbb46a2c1ba44409b99bf57f06',
  selectedContractSha256: 'a5805cef640d38568f1dfe2b67ee17a4f5324ae488fdd1abfd33afa0e4fb3daa',
  occurrences: 93,
  included: 45,
  excluded: 48,
  byteUnique: 84,
  oracleByteUnique: 36,
  selected: 34,
  projects: 47,
  tasks: 13_982,
  tasksWithAnyMeasuredAxis: 13_959,
  measurable: { es: 13_931, ef: 13_937, ls: 13_822, lf: 13_813, tf: 13_677, ff: 13_322 },
  productStrict: {
    exact: { es: 12_680, ef: 12_437, ls: 8_807, lf: 8_769, tf: 8_912, ff: 12_499 },
    sameday: { es: 96, ef: 97, ls: 129, lf: 93, tf: 0, ff: 0 },
    diff: { es: 1_155, ef: 1_403, ls: 4_886, lf: 4_951, tf: 4_765, ff: 823 },
    missing: { es: 0, ef: 0, ls: 0, lf: 0, tf: 0, ff: 0 },
    deviations: { es: 1_251, ef: 1_500, ls: 5_015, lf: 5_044, tf: 4_765, ff: 823 },
    drivingPath: { exact: 13_186, sameday: 0, diff: 410, missing: 0, measurable: 13_596, deviations: 410 },
  },
  productPayloadSha256: 'a97aa10c39687e33cabf23ff7a4f832556401192f4620a6cf643d97e49160783',
  productPayloadGzipSha256: '99476b658c45a4e5fcaf42e1b94ffc827437d26a98dba2db51c6a0f9400c82bb',
  productProjectProjectionSha256: 'ab8fef5851dd85d941e7f7f862c4ee62440e3bc2dd8f5299250053b81cfd5c7f',
  roles: {
    oracle: 45,
    'engine-input': 14,
    'parser-fixture': 15,
    'pseudo-xer': 13,
    'reference-only': 1,
    'synthetic-fixture': 5,
  } satisfies Record<Role, number>,
} as const;

const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_16 = /^[0-9a-f]{16}$/;
const ALLOWED_STATIC_IMPORTS = new Set([
  'node:crypto',
  'node:fs',
  'node:path',
  'node:url',
  'node:zlib',
  './xerProductBaselineV2',
]);
const diffs: string[] = [];
const mutationEvidence: string[] = [];
let checks = 0;

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function rawHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function issue(problems: string[], message: string): void {
  problems.push(message);
}

function equal(problems: string[], label: string, got: unknown, want: unknown): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    issue(problems, `${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function checkEqual(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function manifestEntries(manifest: Manifest): Array<{ label: string; entry: ManifestEntry }> {
  return Object.entries(manifest.files).map(([label, entry]) => ({ label, entry }));
}

function manifestProjection(manifest: Manifest): unknown[] {
  return manifestEntries(manifest)
    .map(({ label, entry }) => ({
      label,
      sha256: entry.sha256,
      source: entry.source,
      role: entry.role,
      included: entry.included,
      exclusionReason: entry.exclusionReason ?? null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function byHash(manifest: Manifest): Map<string, Array<{ label: string; entry: ManifestEntry }>> {
  const index = new Map<string, Array<{ label: string; entry: ManifestEntry }>>();
  for (const item of manifestEntries(manifest)) {
    const current = index.get(item.entry.sha256) ?? [];
    current.push(item);
    index.set(item.entry.sha256, current);
  }
  return index;
}

function selectedProjection(baseline: OracleBaseline, manifest: Manifest): Array<{
  prefix: string;
  sha256: string | null;
  schemaFingerprint: string | null;
  projects: number;
  tasks: number;
  counters: Record<Axis, AxisCounts>;
  reason: string | null;
}> {
  const fullHashes = [...byHash(manifest).keys()];
  return Object.entries(baseline.files)
    .map(([prefix, entry]) => ({
      prefix,
      sha256: fullHashes.filter(full => full.startsWith(prefix))[0] ?? null,
      schemaFingerprint: entry.schemaFingerprint ?? null,
      projects: entry.projects,
      tasks: entry.tasks,
      counters: entry.counters,
      reason: entry.reason ?? null,
    }))
    .sort((left, right) => (left.sha256 ?? '').localeCompare(right.sha256 ?? ''));
}

function validateInventory(raw: unknown): { manifest: Manifest | null; problems: string[] } {
  const problems: string[] = [];
  const root = asObject(raw);
  if (!root || !asObject(root.files)) {
    issue(problems, 'inventaris: root/files is geen object');
    return { manifest: null, problems };
  }
  const manifest = raw as Manifest;
  const entries = manifestEntries(manifest);
  equal(problems, 'inventaris.version', manifest.version, 1);
  equal(problems, 'inventaris.occurrences', entries.length, EXPECTED.occurrences);

  const roleCounts = Object.fromEntries(ROLES.map(role => [role, 0])) as Record<Role, number>;
  let included = 0;
  let excluded = 0;
  for (const { label, entry } of entries) {
    if (!label.trim()) issue(problems, 'inventaris: lege occurrence-identiteit');
    if (!entry || typeof entry !== 'object') { issue(problems, `inventaris ${label}: geen entry`); continue; }
    if (!HEX_64.test(entry.sha256 ?? '')) issue(problems, `inventaris ${label}: sha256 is niet 64 lowercase hex`);
    if (!isRole(entry.role)) issue(problems, `inventaris ${label}: onbekende rol`);
    else roleCounts[entry.role]++;
    if (entry.included !== (entry.role === 'oracle')) {
      issue(problems, `inventaris ${label}: included moet precies role=oracle volgen`);
    }
    if (entry.included) included++;
    else {
      excluded++;
      if (typeof entry.exclusionReason !== 'string' || !entry.exclusionReason.trim()) {
        issue(problems, `inventaris ${label}: uitgesloten entry mist exclusionReason`);
      }
    }
  }
  equal(problems, 'inventaris.rolverdeling', roleCounts, EXPECTED.roles);
  equal(problems, 'inventaris.included', included, EXPECTED.included);
  equal(problems, 'inventaris.excluded', excluded, EXPECTED.excluded);

  const hashIndex = byHash(manifest);
  equal(problems, 'inventaris.byte-uniek', hashIndex.size, EXPECTED.byteUnique);
  const occurrenceMultiset = Object.entries(Object.fromEntries(
    [...hashIndex.entries()].map(([hash, occurrences]) => [hash, occurrences.length]),
  )).sort(([left], [right]) => left.localeCompare(right));
  equal(problems, 'inventaris.byte-multiset-digest', stableHash(occurrenceMultiset), EXPECTED.byteMultisetSha256);
  equal(problems, 'inventaris.semantische-projectie', stableHash(manifestProjection(manifest)), EXPECTED.manifestProjectionSha256);
  return { manifest, problems };
}

function validateOracle(raw: unknown, manifest: Manifest): { baseline: OracleBaseline | null; problems: string[] } {
  const problems: string[] = [];
  const root = asObject(raw);
  if (!root || !asObject(root.files)) {
    issue(problems, 'orakel: root/files is geen object');
    return { baseline: null, problems };
  }
  const baseline = raw as OracleBaseline;
  const entries = Object.entries(baseline.files);
  equal(problems, 'orakel.selectie-aantal', entries.length, EXPECTED.selected);

  const fullIndex = byHash(manifest);
  const includedUnique = [...fullIndex.entries()]
    .filter(([, occurrences]) => occurrences.some(({ entry }) => entry.role === 'oracle' && entry.included))
    .map(([hash]) => hash)
    .sort();
  equal(problems, 'orakel.byte-unieke-orakels', includedUnique.length, EXPECTED.oracleByteUnique);
  equal(problems, 'orakel.byte-unieke-orakels-digest', stableHash(includedUnique), EXPECTED.oracleByteUniqueSha256);

  const seenFull = new Set<string>();
  const seenFingerprints = new Set<string>();
  let projects = 0;
  let tasks = 0;
  const measurable = { es: 0, ef: 0, ls: 0, lf: 0, tf: 0, ff: 0 } as Record<Axis, number>;
  for (const [prefix, entry] of entries) {
    if (!HEX_16.test(prefix)) issue(problems, `orakel ${prefix}: sleutel is geen 16-hexprefix`);
    const matches = [...fullIndex.entries()].filter(([hash]) => hash.startsWith(prefix));
    if (matches.length !== 1) issue(problems, `orakel ${prefix}: prefixbotsing of ontbrekende volledige SHA (${matches.length})`);
    const [fullHash, occurrences] = matches[0] ?? [];
    if (fullHash) {
      if (seenFull.has(fullHash)) issue(problems, `orakel ${prefix}: dubbele geselecteerde volledige SHA`);
      seenFull.add(fullHash);
      if (!occurrences?.some(({ entry: manifestEntry }) => manifestEntry.role === 'oracle' && manifestEntry.included)) {
        issue(problems, `orakel ${prefix}: verwijst niet naar een inbegrepen orakelentry`);
      }
    }
    if (!entry || typeof entry !== 'object') { issue(problems, `orakel ${prefix}: geen entry`); continue; }
    if (typeof entry.schemaFingerprint !== 'string' || !entry.schemaFingerprint.trim()) {
      issue(problems, `orakel ${prefix}: schemaFingerprint ontbreekt`);
    } else if (seenFingerprints.has(entry.schemaFingerprint)) {
      issue(problems, `orakel ${prefix}: dubbele schemaFingerprint`);
    } else seenFingerprints.add(entry.schemaFingerprint);
    if ('reason' in entry) issue(problems, `orakel ${prefix}: reason is in de nulpoort verboden`);
    if (!isNonNegativeInteger(entry.projects) || !isNonNegativeInteger(entry.tasks)) {
      issue(problems, `orakel ${prefix}: projects/tasks zijn geen niet-negatieve gehele getallen`);
    } else {
      projects += entry.projects;
      tasks += entry.tasks;
    }
    for (const axis of AXES) {
      const counts = entry.counters?.[axis];
      if (!counts || !isNonNegativeInteger(counts.measurable) || !isNonNegativeInteger(counts.deviations)) {
        issue(problems, `orakel ${prefix}.${axis}: ongeldige counters`);
        continue;
      }
      if (counts.deviations !== 0) issue(problems, `orakel ${prefix}.${axis}: deviations moet nul zijn`);
      if (counts.deviations > counts.measurable) issue(problems, `orakel ${prefix}.${axis}: deviations > measurable`);
      measurable[axis] += counts.measurable;
    }
  }
  equal(problems, 'orakel.tweede-dedup', includedUnique.length - seenFull.size, 2);
  equal(problems, 'orakel.geselecteerde-volledige-SHAs', stableHash([...seenFull].sort()), EXPECTED.selectedFullSha256);
  equal(problems, 'orakel.schemafingerprintset', stableHash(selectedProjection(baseline, manifest)
    .map(({ sha256, schemaFingerprint }) => ({ sha256, schemaFingerprint }))), EXPECTED.selectedSchemaSha256);
  equal(problems, 'orakel.volledige-selectiecontract', stableHash(selectedProjection(baseline, manifest)), EXPECTED.selectedContractSha256);
  equal(problems, 'orakel.projecten', projects, EXPECTED.projects);
  equal(problems, 'orakel.TASK-rijen', tasks, EXPECTED.tasks);
  equal(problems, 'orakel.meetbaar-per-as', measurable, EXPECTED.measurable);
  return { baseline, problems };
}

function validateReplay(raw: unknown, oracle: OracleBaseline): string[] {
  const problems: string[] = [];
  const root = asObject(raw);
  if (!root || !asObject(root.candidates)) return ['replay: root/candidates is geen object'];
  const replay = raw as ReplayPin;
  const oracleEntries = Object.values(oracle.files);
  const oracleProjects = oracleEntries.reduce((sum, entry) => sum + entry.projects, 0);
  const oracleTasks = oracleEntries.reduce((sum, entry) => sum + entry.tasks, 0);
  const oracleMeasurable = Object.fromEntries(AXES.map(axis => [axis,
    oracleEntries.reduce((sum, entry) => sum + entry.counters[axis].measurable, 0),
  ])) as Record<Axis, number>;
  equal(problems, 'replay.version', replay.version, 1);
  equal(problems, 'replay.manifestEntries', replay.manifestEntries, EXPECTED.occurrences);
  equal(problems, 'replay.selectedEntries', replay.selectedEntries, EXPECTED.selected);
  equal(problems, 'replay.projecten', replay.projects, oracleProjects);
  equal(problems, 'replay.TASK-rijen', replay.tasks, oracleTasks);
  const zero = replay.candidates['synthetic-zero-regression'];
  const negative = replay.candidates['drop-p6-finish-milestone-boundary'];
  if (!zero || !negative) return [...problems, 'replay: verplichte kandidaten ontbreken'];
  for (const axis of AXES) {
    const candidate = zero.aggregate?.[axis];
    if (!candidate) { issue(problems, `replay nul ${axis}: aggregate ontbreekt`); continue; }
    equal(problems, `replay nul ${axis}.improved`, candidate.improved, 0);
    equal(problems, `replay nul ${axis}.regressed`, candidate.regressed, 0);
    equal(problems, `replay nul ${axis}.unchanged`, candidate.unchanged, oracleMeasurable[axis]);
  }
  equal(problems, 'replay nul overall.improved', zero.aggregate?.overall?.improved, 0);
  equal(problems, 'replay nul overall.regressed', zero.aggregate?.overall?.regressed, 0);
  equal(problems, 'replay nul overall.unchanged', zero.aggregate?.overall?.unchanged, EXPECTED.tasksWithAnyMeasuredAxis);
  equal(problems, 'replay nul exitcode', zero.exitCode, 0);
  equal(problems, 'replay nul rejected', zero.rejected, false);
  const negativeRegressions = AXES.reduce((sum, axis) => sum + (negative.aggregate?.[axis]?.regressed ?? 0), 0);
  checkProblem(problems, 'replay negatief heeft minstens één regressie', negativeRegressions > 0);
  equal(problems, 'replay negatief exitcode', negative.exitCode, 1);
  equal(problems, 'replay negatief rejected', negative.rejected, true);
  return problems;
}

function decodeProductPayload(envelope: ProductEnvelope): ProductV2 {
  return decodeProductEnvelopeUnchecked(envelope);
}

function withMutatedProduct(envelope: ProductEnvelope, mutate: (product: ProductV2) => void): ProductEnvelope {
  const product = clone(decodeProductPayload(envelope));
  mutate(product);
  return createProductEnvelope(sealProductBaseline(product));
}

function withRawMutatedProduct(envelope: ProductEnvelope, mutate: (product: ProductV2) => void): ProductEnvelope {
  const product = clone(decodeProductPayload(envelope));
  mutate(product);
  const payloadText = canonicalProductJson(product);
  const compressed = gzipSync(Buffer.from(payloadText, 'utf8'), { level: 9 });
  return {
    ...envelope,
    payloadSha256: productSha256(payloadText),
    payloadGzipSha256: productSha256(compressed),
    projectProjectionSha256: productProjectionDigest(product),
    payloadGzipBase64: compressed.toString('base64'),
  };
}

function productPins(manifest: Manifest, oracle: OracleBaseline): ProductValidationPins {
  const fullHashes = [...byHash(manifest).keys()];
  const entries = Object.fromEntries(Object.entries(oracle.files).map(([prefix, entry]) => {
    const matches = fullHashes.filter(hashValue => hashValue.startsWith(prefix));
    if (matches.length !== 1 || !entry.schemaFingerprint) throw new Error(`product-v2-pin ${prefix} is niet eenduidig`);
    return [matches[0]!, { schemaFingerprint: entry.schemaFingerprint }];
  }));
  const counters = Object.fromEntries(AXES.map(axis => [axis, {
    exact: EXPECTED.productStrict.exact[axis],
    sameday: EXPECTED.productStrict.sameday[axis],
    diff: EXPECTED.productStrict.diff[axis],
    missing: EXPECTED.productStrict.missing[axis],
    measurable: EXPECTED.measurable[axis],
    deviations: EXPECTED.productStrict.deviations[axis],
  }])) as Record<Axis, ProductCounts>;
  return {
    manifestSha256: rawHash(manifestRaw),
    entries,
    projects: EXPECTED.projects,
    tasks: EXPECTED.tasks,
    counters,
    drivingPath: EXPECTED.productStrict.drivingPath,
    payloadSha256: EXPECTED.productPayloadSha256,
    payloadGzipSha256: EXPECTED.productPayloadGzipSha256,
    projectProjectionSha256: EXPECTED.productProjectProjectionSha256,
  };
}

/**
 * Corpusloze laag C pakt de volledige v2-snapshot uit en valideert hem tegen de al gepinde
 * manifest-/orakelselectie. Hij kan niet zélf productnul bewijzen, maar hij mag evenmin een
 * overgangssnapshot als eindacceptatie presenteren.
 */
function validateProductV2(raw: string | ProductEnvelope, manifest: Manifest, oracle: OracleBaseline): string[] {
  const rawText = typeof raw === 'string' ? raw : canonicalProductJson(raw);
  return validateProductBaselineV2(rawText, productPins(manifest, oracle)).problems;
}

function checkProblem(problems: string[], label: string, condition: boolean): void {
  if (!condition) issue(problems, label);
}

function stripExecutableNoise(source: string): string {
  let result = '';
  let state: 'code' | 'line-comment' | 'block-comment' | 'single-quote' | 'double-quote' | 'template' = 'code';
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    const next = source[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        result += '  ';
        index++;
        state = 'line-comment';
        continue;
      }
      if (char === '/' && next === '*') {
        result += '  ';
        index++;
        state = 'block-comment';
        continue;
      }
      if (char === '\'') {
        result += char;
        state = 'single-quote';
        escaped = false;
        continue;
      }
      if (char === '"') {
        result += char;
        state = 'double-quote';
        escaped = false;
        continue;
      }
      if (char === '`') {
        result += char;
        state = 'template';
        escaped = false;
        continue;
      }
      result += char;
      continue;
    }

    if (state === 'line-comment') {
      result += char === '\n' ? '\n' : ' ';
      if (char === '\n') state = 'code';
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        result += '  ';
        index++;
        state = 'code';
      } else {
        result += char === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (state === 'single-quote') {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '\'') state = 'code';
      continue;
    }

    if (state === 'double-quote') {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') state = 'code';
      continue;
    }

    result += char;
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '`') state = 'code';
  }

  return result;
}

const DYNAMIC_IMPORT_RE = new RegExp(['\\b', 'import', '\\s*', '\\('].join(''));
const DYNAMIC_REQUIRE_RE = new RegExp(['\\b', 'require', '\\s*', '\\('].join(''));
const DYNAMIC_IMPORT_LABEL = ['import', '()'].join('');
const DYNAMIC_REQUIRE_LABEL = ['require', '()'].join('');

function validateOwnSource(raw: string): string[] {
  const problems: string[] = [];
  const importModules: string[] = [];
  const lines = raw.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) continue;

    const match = trimmed.match(/^import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?$/);
    if (!match) {
      issue(problems, `bron ${index + 1}: statische importregel is niet line-anchored of niet exact`);
      continue;
    }
    importModules.push(match[1]!);
  }

  equal(problems, 'bron.statische-import-aantal', importModules.length, 6);
  equal(problems, 'bron.statische-import-modules', [...new Set(importModules)].sort(), [...ALLOWED_STATIC_IMPORTS].sort());
  for (const module of importModules) {
    if (!ALLOWED_STATIC_IMPORTS.has(module)) {
      issue(problems, `bron: verboden statische import ${module}`);
    }
  }

  const executableScan = stripExecutableNoise(raw);
  if (DYNAMIC_IMPORT_RE.test(executableScan)) issue(problems, `bron: dynamische ${DYNAMIC_IMPORT_LABEL} is verboden`);
  if (DYNAMIC_REQUIRE_RE.test(executableScan)) issue(problems, `bron: ${DYNAMIC_REQUIRE_LABEL} is verboden`);

  return problems;
}

function validateContract(manifestRaw: unknown, oracleRaw: unknown, replayRaw: unknown): string[] {
  const inventory = validateInventory(manifestRaw);
  if (!inventory.manifest) return inventory.problems;
  const oracle = validateOracle(oracleRaw, inventory.manifest);
  if (!oracle.baseline) return [...inventory.problems, ...oracle.problems];
  return [...inventory.problems, ...oracle.problems, ...validateReplay(replayRaw, oracle.baseline)];
}

function expectRejected(label: string, manifest: Manifest, oracle: OracleBaseline, replay: ReplayPin): void {
  checks++;
  const problems = validateContract(manifest, oracle, replay);
  if (problems.length === 0) diffs.push(`${label}: mutant werd ten onrechte geaccepteerd`);
  else mutationEvidence.push(`${label}: ROOD — ${problems[0]}`);
}

function expectProductRejected(label: string, envelope: string | ProductEnvelope, manifest: Manifest, oracle: OracleBaseline): void {
  checks++;
  const problems = validateProductV2(envelope, manifest, oracle);
  if (problems.length === 0) diffs.push(`${label}: product-v2-mutant werd ten onrechte geaccepteerd`);
  else mutationEvidence.push(`${label}: ROOD — ${problems[0]}`);
}

const manifestRaw = readFileSync(join(HERE, 'xer-corpus-manifest.json'), 'utf8');
const oracleRaw = readFileSync(join(HERE, 'xer-fidelity-baseline.json'), 'utf8');
const replayRaw = readFileSync(join(HERE, 'xer-task-replay-public-pin.json'), 'utf8');
const productV2Raw = readFileSync(join(HERE, 'xer-product-fidelity-baseline.json'), 'utf8');
const sourceRaw = readFileSync(join(HERE, 'check-xer-corpusless-fidelity-gate.ts'), 'utf8');
const manifest = JSON.parse(manifestRaw) as Manifest;
const oracle = JSON.parse(oracleRaw) as OracleBaseline;
const replay = JSON.parse(replayRaw) as ReplayPin;
const productV2 = JSON.parse(productV2Raw) as ProductEnvelope;

// De actuele contracten worden als drie afzonderlijke lagen gecontroleerd. Een lege foutlijst is
// de eerste groene toestand; de matrix hieronder bewijst vervolgens dat iedere bescherming bij
// één gerichte in-memory wijziging rood wordt, zonder een tracked JSON-bestand aan te raken.
{
  const currentSourceProblems = validateOwnSource(sourceRaw);
  checkEqual('bron huidige ongebundelde TS-bron is strikt corpusloos', currentSourceProblems, []);

  const mutantSourceProblems = validateOwnSource(`${sourceRaw}\nimport { readXER } from '@/services/xer/xerReader';\n`);
  checkEqual('bronmutant met readXER-import wordt afgewezen', mutantSourceProblems.length > 0, true);

  const templateExpressionRequireSource = [
    sourceRaw,
    "const templateTrap = `probe ${" + ['requ', "ire('x')"].join('') + "} binnen een template-expressie`;",
    '',
  ].join('\n');
  const templateExpressionRequireProblems = validateOwnSource(templateExpressionRequireSource);
  checkEqual(
    'bronmutant met require in template-expressie wordt afgewezen',
    templateExpressionRequireProblems.length > 0,
    true,
  );

  const multilineImportSource = [
    sourceRaw,
    'import {',
    '  readXER',
    "} from '@/services/xer/xerReader';",
    '',
  ].join('\n');
  const multilineImportProblems = validateOwnSource(multilineImportSource);
  checkEqual('bronmutant met multiline import wordt afgewezen', multilineImportProblems.length > 0, true);

  const problems = validateContract(manifest, oracle, replay);
  checkEqual(`A+B+D huidige statische contracten zijn consistent (${problems.join('; ')})`, problems, []);
  checkEqual('A raw manifestbytes zijn exact gepind', rawHash(manifestRaw), EXPECTED.manifestRawSha256);
  checkEqual('B raw oraclebaselinebytes zijn exact gepind', rawHash(oracleRaw), EXPECTED.baselineRawSha256);
  const productProblems = validateProductV2(productV2Raw, manifest, oracle);
  checkEqual(`C v2-karakteriseringssnapshot is volledig maar strict zichtbaar rood (${productProblems.join('; ')})`, productProblems, []);
  console.log('INFO xer-corpusless-fidelity-gate: v2 productkarakterisering is volledig vastgepind; strict minute-exact eindnul blijft expliciet rood en ongeaccepteerd.');
}

// In-memory mutantmatrix. Elke mutatie treft één contractuitspraak; niets op schijf verandert.
{
  const firstLabel = Object.keys(manifest.files)[0]!;
  const excludedLabel = Object.entries(manifest.files)
    .find(([, entry]) => !entry.included)?.[0];
  const firstOracle = Object.keys(oracle.files)[0]!;
  const secondOracle = Object.keys(oracle.files)[1]!;
  const excludedHash = excludedLabel ? manifest.files[excludedLabel]!.sha256 : undefined;

  const removedOccurrence = clone(manifest);
  delete removedOccurrence.files[firstLabel];
  expectRejected('M1 occurrence verwijderen', removedOccurrence, oracle, replay);

  const addedOccurrence = clone(manifest);
  addedOccurrence.files['mutant-extra-occurrence.xer'] = clone(addedOccurrence.files[firstLabel]!);
  expectRejected('M2 occurrence toevoegen', addedOccurrence, oracle, replay);

  const changedSha = clone(manifest);
  changedSha.files[firstLabel]!.sha256 = `0${changedSha.files[firstLabel]!.sha256.slice(1)}`;
  expectRejected('M3 volledige SHA wijzigen', changedSha, oracle, replay);

  const changedRole = clone(manifest);
  changedRole.files[firstLabel]!.role = 'parser-fixture';
  expectRejected('M4 rol wijzigen zonder included mee te wijzigen', changedRole, oracle, replay);

  const changedIncluded = clone(manifest);
  changedIncluded.files[firstLabel]!.included = !changedIncluded.files[firstLabel]!.included;
  expectRejected('M5 included wijzigen zonder rol', changedIncluded, oracle, replay);

  const missingExclusionReason = clone(manifest);
  if (excludedLabel) delete missingExclusionReason.files[excludedLabel]!.exclusionReason;
  expectRejected('M6 uitsluitingsreden verwijderen', missingExclusionReason, oracle, replay);

  const emptyOccurrenceIdentity = clone(manifest);
  emptyOccurrenceIdentity.files[''] = emptyOccurrenceIdentity.files[firstLabel]!;
  delete emptyOccurrenceIdentity.files[firstLabel];
  expectRejected('M7 lege occurrence-identiteit', emptyOccurrenceIdentity, oracle, replay);

  const excludedOracleSource = clone(oracle);
  if (excludedHash) {
    delete excludedOracleSource.files[firstOracle];
    excludedOracleSource.files[excludedHash.slice(0, 16)] = clone(oracle.files[firstOracle]!);
  }
  expectRejected('M8 uitgesloten bron als orakel selecteren', manifest, excludedOracleSource, replay);

  const shortenedSourcePrefix = clone(oracle);
  delete shortenedSourcePrefix.files[firstOracle];
  shortenedSourcePrefix.files[firstOracle.slice(0, 15)] = clone(oracle.files[firstOracle]!);
  expectRejected('M9 bronhashprefix inkorten', manifest, shortenedSourcePrefix, replay);

  const duplicateFingerprint = clone(oracle);
  duplicateFingerprint.files[secondOracle]!.schemaFingerprint = duplicateFingerprint.files[firstOracle]!.schemaFingerprint;
  expectRejected('M10 duplicate schemafingerprint', manifest, duplicateFingerprint, replay);

  const changedFingerprint = clone(oracle);
  const originalFingerprint = changedFingerprint.files[firstOracle]!.schemaFingerprint!;
  changedFingerprint.files[firstOracle]!.schemaFingerprint = `${originalFingerprint.slice(0, -1)}${originalFingerprint.endsWith('0') ? '1' : '0'}`;
  expectRejected('M11 schemafingerprint wijzigen', manifest, changedFingerprint, replay);

  const lostSelectedKey = clone(oracle);
  delete lostSelectedKey.files[firstOracle];
  expectRejected('M12 selected keysetverlies', manifest, lostSelectedKey, replay);

  const measurableMinusOne = clone(oracle);
  measurableMinusOne.files[firstOracle]!.counters.es.measurable--;
  expectRejected('M13 measurable -1', manifest, measurableMinusOne, replay);

  const deviationOne = clone(oracle);
  deviationOne.files[firstOracle]!.counters.es.deviations = 1;
  expectRejected('M14 deviation 1', manifest, deviationOne, replay);

  const reasonAdded = clone(oracle);
  reasonAdded.files[firstOracle]!.reason = 'verboden eindpoort-pin';
  expectRejected('M15 reason toevoegen', manifest, reasonAdded, replay);

  const swappedTotals = clone(replay);
  swappedTotals.tasks = EXPECTED.tasksWithAnyMeasuredAxis;
  expectRejected('M16 13982/13959 verwisselen', manifest, oracle, swappedTotals);

  const zeroRegressed = clone(replay);
  zeroRegressed.candidates['synthetic-zero-regression']!.aggregate.es.regressed = 1;
  expectRejected('M17 replay nul kandidaat regressed 1', manifest, oracle, zeroRegressed);

  const negativeExitGreen = clone(replay);
  negativeExitGreen.candidates['drop-p6-finish-milestone-boundary']!.exitCode = 0;
  expectRejected('M18 replay negatieve kandidaat exitcode 0', manifest, oracle, negativeExitGreen);

  const negativeWithoutRegression = clone(replay);
  for (const axis of AXES) {
    negativeWithoutRegression.candidates['drop-p6-finish-milestone-boundary']!.aggregate[axis].regressed = 0;
  }
  expectRejected('M19 replay negatieve kandidaat zonder regressie', manifest, oracle, negativeWithoutRegression);

  const firstProductLabel = Object.keys(decodeProductPayload(productV2).files)[0]!;
  const multiProjectLabel = Object.entries(decodeProductPayload(productV2).files)
    .find(([, entry]) => entry.projectMeasurements.length >= 2)?.[0];
  const algebraProjectLabel = Object.entries(decodeProductPayload(productV2).files)
    .find(([, entry]) => entry.projectMeasurements.some((project, index) => project.counters.es.exact > 0
      && entry.projectMeasurements.some((candidate, candidateIndex) => candidateIndex !== index
        && candidate.counters.es.diff > 0)))?.[0];
  if (!multiProjectLabel) throw new Error('product-v2-mutanten vereisen minstens een multi-projectentry');
  if (!algebraProjectLabel) throw new Error('product-v2-mutanten vereisen geschikte projecttellers');
  const v1AsFinal = clone(productV2);
  (v1AsFinal as { version: number }).version = 1;
  expectProductRejected('M20 v1-baseline kan niet stil als finale v2 gelden', v1AsFinal, manifest, oracle);

  expectProductRejected('M21 projectnoemer vergeten', withMutatedProduct(productV2, product => {
    product.files[firstProductLabel]!.projects--;
  }), manifest, oracle);

  expectProductRejected('M22 een meetbare cel stil overslaan', withMutatedProduct(productV2, product => {
    product.files[firstProductLabel]!.projectMeasurements[0]!.counters.es.measurable--;
  }), manifest, oracle);

  expectProductRejected('M23 entry-project-taskcode-identiteit drift', withMutatedProduct(productV2, product => {
    product.files[firstProductLabel]!.projectMeasurements[0]!.taskCodeExact--;
  }), manifest, oracle);

  expectProductRejected('M24 productmanifesthash drift', withMutatedProduct(productV2, product => {
    product.manifestSha256 = `0${product.manifestSha256.slice(1)}`;
  }), manifest, oracle);

  expectProductRejected('M25 productschemafingerprint drift', withMutatedProduct(productV2, product => {
    const entry = product.files[firstProductLabel]!;
    entry.schemaFingerprint = `${entry.schemaFingerprint.slice(0, -1)}${entry.schemaFingerprint.endsWith('0') ? '1' : '0'}`;
  }), manifest, oracle);

  const drivingEntry = Object.values(decodeProductPayload(productV2).files)
    .find(entry => entry.drivingPath.deviations > 0);
  if (!drivingEntry) throw new Error('M26 vereist een entry met driving-path-afwijking');
  const strictZeroDrivingRed = clone(drivingEntry);
  for (const axis of PRODUCT_AXES) {
    const entryCounts = strictZeroDrivingRed.counters[axis];
    Object.assign(entryCounts, { exact: entryCounts.measurable, sameday: 0, diff: 0, missing: 0, deviations: 0 });
    for (const project of strictZeroDrivingRed.projectMeasurements) {
      const counts = project.counters[axis];
      Object.assign(counts, { exact: counts.measurable, sameday: 0, diff: 0, missing: 0, deviations: 0 });
    }
  }
  checkEqual('M26 gedragsmutant: drivingPath aan zesassige gate koppelen wordt rood', {
    canonicalStrictGate: deriveStrictEntryGate(strictZeroDrivingRed),
    mutatedDrivingGate: deriveStrictEntryGate(strictZeroDrivingRed)
      && strictZeroDrivingRed.drivingPath.deviations === 0,
  }, { canonicalStrictGate: true, mutatedDrivingGate: false });
  mutationEvidence.push('M26 gedragsmutant drivingPath in zesassige gate: ROOD — canoniek true, mutant false');

  const routeInputs = {
    strictMinuteExact: 'STRICT-INVOER',
    historicalCompletedLate: 'HISTORISCH-TEGENFEIT',
    sourceDayPrecision: 'DAGPRECISIE-TEGENFEIT',
  };
  const strictRoute = selectProductReportMode('strict-minute-exact', routeInputs);
  const swappedRoute = selectProductReportMode('historical-completed-late', routeInputs);
  checkEqual('M27 gedragsmutant: strict werkelijk naar tegenfeitelijke invoer routeren wordt rood', {
    canonical: [strictRoute.report, strictRoute.strictGateEligible],
    mutated: [swappedRoute.report, swappedRoute.strictGateEligible],
  }, {
    canonical: ['STRICT-INVOER', true],
    mutated: ['HISTORISCH-TEGENFEIT', false],
  });
  mutationEvidence.push('M27 gedragsmutant strict naar historische invoer: ROOD — andere invoer en niet poortgeschikt');
  const swappedModes = clone(productV2);
  (swappedModes as unknown as { reportModes: string[] }).reportModes = [
    'historical-completed-late', 'strict-minute-exact', 'source-day-precision',
  ];
  expectProductRejected('M27b verwisselde runtime-modusvolgorde in envelope', swappedModes, manifest, oracle);

  expectProductRejected('M28 onbekend priveveld in entry', withRawMutatedProduct(productV2, product => {
    (product.files[firstProductLabel] as unknown as Record<string, unknown>).privateCustomerName = 'verboden';
  }), manifest, oracle);

  for (const forbiddenKey of ['taskName', 'taskCodes', ' reason Note ', 'acceptedDeviation'] as const) {
    expectProductRejected(`M28 privacy/beslisveld ${JSON.stringify(forbiddenKey)}`, withRawMutatedProduct(productV2, product => {
      (product.files[firstProductLabel] as unknown as Record<string, unknown>)[forbiddenKey] = 'verboden';
    }), manifest, oracle);
  }
  expectProductRejected('M28 unknown envelopekey', Object.assign(clone(productV2), { unknownEnvelopeKey: true }), manifest, oracle);
  expectProductRejected('M28 unknown payloadkey', withRawMutatedProduct(productV2, product => {
    (product as unknown as Record<string, unknown>).unknownPayloadKey = true;
  }), manifest, oracle);
  expectProductRejected('M28 unknown projectkey', withRawMutatedProduct(productV2, product => {
    (product.files[firstProductLabel]!.projectMeasurements[0] as unknown as Record<string, unknown>).unknownProjectKey = true;
  }), manifest, oracle);
  expectProductRejected('M28 unknown identityCoverage-key', withRawMutatedProduct(productV2, product => {
    (product.files[firstProductLabel]!.identityCoverage as unknown as Record<string, unknown>).unknownIdentityKey = true;
  }), manifest, oracle);
  expectProductRejected('M28 unknown tellerkey', withRawMutatedProduct(productV2, product => {
    (product.files[firstProductLabel]!.counters.es as unknown as Record<string, unknown>).unknownCountKey = 0;
  }), manifest, oracle);

  expectProductRejected('M29 projectprojecties tussen twee project-IDs migreren', withMutatedProduct(productV2, product => {
    const projects = product.files[multiProjectLabel]!.projectMeasurements;
    [projects[0]!.projectId, projects[1]!.projectId] = [projects[1]!.projectId, projects[0]!.projectId];
  }), manifest, oracle);

  const recompressedPayload = gunzipSync(Buffer.from(productV2.payloadGzipBase64, 'base64'));
  expectProductRejected('M30 pure gziprecompressie', {
    ...clone(productV2),
    payloadGzipSha256: productSha256(gzipSync(recompressedPayload, { level: 1 })),
    payloadGzipBase64: gzipSync(recompressedPayload, { level: 1 }).toString('base64'),
  }, manifest, oracle);
  const compactPayload = JSON.stringify(decodeProductPayload(productV2));
  const compactCompressed = gzipSync(Buffer.from(compactPayload, 'utf8'), { level: 9 });
  expectProductRejected('M30b compacte payloadserialisatie zonder finale newline', {
    ...clone(productV2),
    payloadSha256: productSha256(compactPayload),
    payloadGzipSha256: productSha256(compactCompressed),
    payloadGzipBase64: compactCompressed.toString('base64'),
  }, manifest, oracle);
  expectProductRejected('M30c compacte envelopeserialisatie zonder finale newline',
    JSON.stringify(productV2), manifest, oracle);

  expectProductRejected('M31 gatePassed flip', withMutatedProduct(productV2, product => {
    product.files[firstProductLabel]!.gatePassed = !product.files[firstProductLabel]!.gatePassed;
  }), manifest, oracle);

  expectProductRejected('M32 projecttelleralgebra breken met behouden entrysom', withMutatedProduct(productV2, product => {
    const projects = product.files[algebraProjectLabel]!.projectMeasurements;
    const donor = projects.find(project => project.counters.es.exact > 0);
    const receiver = projects.find(project => project !== donor && project.counters.es.diff > 0);
    if (!donor || !receiver) throw new Error('M32 vereist twee geschikte projecttellers');
    donor.counters.es.exact--;
    donor.counters.es.diff++;
    receiver.counters.es.exact++;
    receiver.counters.es.diff--;
  }), manifest, oracle);
}

if (diffs.length === 0) {
  if (process.env.OPS_XER_MUTATION_REPORT === '1') {
    for (const evidence of mutationEvidence) console.log(`MUTANT ${evidence}`);
  }
  console.log(`OK: xer-corpusless-fidelity-gate — ${checks} checks groen`);
} else {
  console.log(`XX xer-corpusless-fidelity-gate — ${diffs.length} van ${checks} checks rood:`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
