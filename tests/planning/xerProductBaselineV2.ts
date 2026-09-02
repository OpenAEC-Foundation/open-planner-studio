import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export const PRODUCT_AXES = ['es', 'ef', 'ls', 'lf', 'tf', 'ff'] as const;
export const PRODUCT_REPORT_MODES = [
  'strict-minute-exact',
  'historical-completed-late',
  'source-day-precision',
] as const;
export const PRODUCT_OPEN_CATEGORIES = [
  'strict-six-axis-deviations',
  'strict-sameday-deviations',
  'driving-path-report-only',
] as const;

export type ProductAxis = (typeof PRODUCT_AXES)[number];
export type ProductReportMode = (typeof PRODUCT_REPORT_MODES)[number];

export interface ProductCountsV2 {
  exact: number;
  sameday: number;
  diff: number;
  missing: number;
  measurable: number;
  deviations: number;
}

export interface ProductProjectV2 {
  projectId: string;
  truthTasks: number;
  solvedTasks: number;
  taskCodePresent: number;
  taskCodeExact: number;
  counters: Record<ProductAxis, ProductCountsV2>;
  drivingPath: ProductCountsV2;
  identityErrors: string[];
  projectionSha256: string;
}

export interface ProductIdentityCoverageV2 {
  solvedTasks: number;
  taskCodePresent: number;
  taskCodeExact: number;
}

export interface ProductEntryV2 {
  sha256: string;
  schemaFingerprint: string;
  projects: number;
  tasks: number;
  identityCoverage: ProductIdentityCoverageV2;
  projectMeasurements: ProductProjectV2[];
  projectProjectionSha256: string;
  counters: Record<ProductAxis, ProductCountsV2>;
  drivingPath: ProductCountsV2;
  identityErrors: string[];
  scannerErrors: string[];
  gatePassed: boolean;
}

export interface ProductCharacterizationV2 {
  finalZeroGate: 'red';
  accepted: false;
  openCategories: typeof PRODUCT_OPEN_CATEGORIES;
}

export interface ProductBaselineV2 {
  version: 2;
  manifestSha256: string;
  characterization: ProductCharacterizationV2;
  files: Record<string, ProductEntryV2>;
}

export interface ProductEnvelopeV2 {
  version: 2;
  manifestSha256: string;
  characterization: ProductCharacterizationV2;
  reportModes: typeof PRODUCT_REPORT_MODES;
  encoding: 'gzip-base64-json';
  canonicalization: {
    json: 'JSON.stringify(value, null, 2) + LF';
    gzip: 'gzip level 9, deterministic header';
  };
  payloadSha256: string;
  payloadGzipSha256: string;
  projectProjectionSha256: string;
  payloadGzipBase64: string;
}

export interface ProductValidationPins {
  manifestSha256: string;
  entries: Readonly<Record<string, { schemaFingerprint: string }>>;
  projects: number;
  tasks: number;
  counters: Record<ProductAxis, ProductCountsV2>;
  drivingPath: ProductCountsV2;
  payloadSha256?: string;
  payloadGzipSha256?: string;
  projectProjectionSha256?: string;
}

export interface ProductValidationResult {
  problems: string[];
  envelope?: ProductEnvelopeV2;
  payload?: ProductBaselineV2;
}

type ProductProjectDraft = Omit<ProductProjectV2, 'projectionSha256'> & { projectionSha256?: string };
type ProductEntryDraft = Omit<ProductEntryV2, 'projectMeasurements' | 'projectProjectionSha256'> & {
  projectMeasurements: ProductProjectDraft[];
  projectProjectionSha256?: string;
};
export type ProductBaselineDraft = Omit<ProductBaselineV2, 'files'> & {
  files: Record<string, ProductEntryDraft>;
};

const HEX_64 = /^[0-9a-f]{64}$/;
const ENVELOPE_KEYS = [
  'version', 'manifestSha256', 'characterization', 'reportModes', 'encoding', 'canonicalization',
  'payloadSha256', 'payloadGzipSha256', 'projectProjectionSha256', 'payloadGzipBase64',
] as const;
const CANONICALIZATION_KEYS = ['json', 'gzip'] as const;
const CHARACTERIZATION_KEYS = ['finalZeroGate', 'accepted', 'openCategories'] as const;
const PAYLOAD_KEYS = ['version', 'manifestSha256', 'characterization', 'files'] as const;
const ENTRY_KEYS = [
  'sha256', 'schemaFingerprint', 'projects', 'tasks', 'identityCoverage', 'projectMeasurements',
  'projectProjectionSha256', 'counters', 'drivingPath', 'identityErrors', 'scannerErrors', 'gatePassed',
] as const;
const PROJECT_KEYS = [
  'projectId', 'truthTasks', 'solvedTasks', 'taskCodePresent', 'taskCodeExact', 'counters',
  'drivingPath', 'identityErrors', 'projectionSha256',
] as const;
const IDENTITY_KEYS = ['solvedTasks', 'taskCodePresent', 'taskCodeExact'] as const;
const COUNTS_KEYS = ['exact', 'sameday', 'diff', 'missing', 'measurable', 'deviations'] as const;
const FORBIDDEN_NORMALIZED_KEYS = new Set([
  'taskname', 'tasknames', 'taskcode', 'taskcodes', 'taskcodelist', 'taskcodelists',
  'individualtaskcode', 'individualtaskcodes', 'individualtaskcodelist',
  'reason', 'reasons', 'reasonnote', 'reasonnotes',
  'accepteddeviation', 'accepteddeviations', 'acceptance', 'acceptatie', 'acceptatieveld',
  'privatecustomername', 'customername',
]);

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function issue(problems: string[], message: string): void {
  problems.push(message);
}

function equal(problems: string[], label: string, got: unknown, expected: unknown): void {
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    issue(problems, `${label}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(got)}`);
  }
}

function equalTextBytes(problems: string[], label: string, got: string, expected: string): void {
  if (got !== expected) {
    issue(problems, `${label}: SHA-256 ${productSha256(got)} != ${productSha256(expected)}`);
  }
}

function exactKeys(
  problems: string[],
  path: string,
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> {
  const object = objectValue(value);
  if (!object) {
    issue(problems, `${path}: object verwacht`);
    return false;
  }
  equal(problems, `${path}: exacte keyset`, Object.keys(object).sort(), [...expected].sort());
  return true;
}

function rejectForbiddenKeys(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectForbiddenKeys(item, `${path}[${index}]`, problems));
    return;
  }
  const object = objectValue(value);
  if (!object) return;
  for (const [key, nested] of Object.entries(object)) {
    const normalized = key.toLowerCase().replace(/[\s_-]+/g, '');
    if (FORBIDDEN_NORMALIZED_KEYS.has(normalized)) {
      issue(problems, `${path}: verboden privacy-/acceptatieveld ${JSON.stringify(key)}`);
    }
    rejectForbiddenKeys(nested, `${path}.${key}`, problems);
  }
}

export function canonicalProductJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function productSha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalGzip(value: string): Buffer {
  return gzipSync(Buffer.from(value, 'utf8'), { level: 9 });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function projectProjection(
  project: ProductProjectDraft | ProductProjectV2,
): Omit<ProductProjectV2, 'projectionSha256'> {
  return {
    projectId: project.projectId,
    truthTasks: project.truthTasks,
    solvedTasks: project.solvedTasks,
    taskCodePresent: project.taskCodePresent,
    taskCodeExact: project.taskCodeExact,
    counters: project.counters,
    drivingPath: project.drivingPath,
    identityErrors: project.identityErrors,
  };
}

function projectProjectionDigest(projects: readonly ProductProjectV2[]): string {
  return productSha256(canonicalProductJson(projects.map(project => ({
    projectId: project.projectId,
    projectionSha256: project.projectionSha256,
  }))));
}

export function productProjectionDigest(payload: ProductBaselineV2): string {
  return productSha256(canonicalProductJson(Object.entries(payload.files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sha256, entry]) => ({ sha256, projectProjectionSha256: entry.projectProjectionSha256 }))));
}

export function sealProductBaseline(payload: ProductBaselineDraft | ProductBaselineV2): ProductBaselineV2 {
  const files = Object.fromEntries(Object.entries(payload.files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sha256, rawEntry]) => {
      const entry = clone(rawEntry) as ProductEntryDraft;
      const projects = entry.projectMeasurements
        .map(rawProject => {
          const project = clone(rawProject);
          return {
            ...projectProjection(project),
            projectionSha256: productSha256(canonicalProductJson(projectProjection(project))),
          } as ProductProjectV2;
        })
        .sort((left, right) => left.projectId.localeCompare(right.projectId));
      return [sha256, {
        sha256: entry.sha256,
        schemaFingerprint: entry.schemaFingerprint,
        projects: entry.projects,
        tasks: entry.tasks,
        identityCoverage: entry.identityCoverage,
        projectMeasurements: projects,
        projectProjectionSha256: projectProjectionDigest(projects),
        counters: entry.counters,
        drivingPath: entry.drivingPath,
        identityErrors: entry.identityErrors,
        scannerErrors: entry.scannerErrors,
        gatePassed: entry.gatePassed,
      } satisfies ProductEntryV2];
    }));
  return {
    version: 2,
    manifestSha256: payload.manifestSha256,
    characterization: {
      finalZeroGate: 'red',
      accepted: false,
      openCategories: PRODUCT_OPEN_CATEGORIES,
    },
    files,
  };
}

export function createProductEnvelope(payloadInput: ProductBaselineDraft | ProductBaselineV2): ProductEnvelopeV2 {
  const payload = sealProductBaseline(payloadInput);
  const payloadText = canonicalProductJson(payload);
  const compressed = canonicalGzip(payloadText);
  return {
    version: 2,
    manifestSha256: payload.manifestSha256,
    characterization: payload.characterization,
    reportModes: PRODUCT_REPORT_MODES,
    encoding: 'gzip-base64-json',
    canonicalization: {
      json: 'JSON.stringify(value, null, 2) + LF',
      gzip: 'gzip level 9, deterministic header',
    },
    payloadSha256: productSha256(payloadText),
    payloadGzipSha256: productSha256(compressed),
    projectProjectionSha256: productProjectionDigest(payload),
    payloadGzipBase64: compressed.toString('base64'),
  };
}

export function canonicalProductEnvelope(payload: ProductBaselineDraft | ProductBaselineV2): string {
  return canonicalProductJson(createProductEnvelope(payload));
}

export function decodeProductEnvelopeUnchecked(envelope: { payloadGzipBase64: string }): ProductBaselineV2 {
  return JSON.parse(gunzipSync(Buffer.from(envelope.payloadGzipBase64, 'base64')).toString('utf8')) as ProductBaselineV2;
}

function validateStringArray(problems: string[], path: string, value: unknown, mustBeEmpty: boolean): value is string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    issue(problems, `${path}: stringarray verwacht`);
    return false;
  }
  if (mustBeEmpty && value.length !== 0) issue(problems, `${path}: moet leeg zijn`);
  return true;
}

function validateCounts(
  problems: string[],
  path: string,
  value: unknown,
  denominator: number,
): value is ProductCountsV2 {
  if (!exactKeys(problems, path, value, COUNTS_KEYS)) return false;
  const counts = value as unknown as ProductCountsV2;
  for (const key of COUNTS_KEYS) {
    if (!nonNegativeInteger(counts[key])) issue(problems, `${path}.${key}: niet-negatief geheel getal verwacht`);
  }
  if (!COUNTS_KEYS.every(key => nonNegativeInteger(counts[key]))) return false;
  if (counts.exact + counts.sameday + counts.diff + counts.missing !== counts.measurable) {
    issue(problems, `${path}: exact+sameday+diff+missing moet measurable zijn`);
  }
  if (counts.sameday + counts.diff + counts.missing !== counts.deviations) {
    issue(problems, `${path}: sameday+diff+missing moet deviations zijn`);
  }
  if (counts.measurable > denominator) issue(problems, `${path}: measurable overschrijdt taaknoemer ${denominator}`);
  return true;
}

function addCounts(target: ProductCountsV2, source: ProductCountsV2): void {
  for (const key of COUNTS_KEYS) target[key] += source[key];
}

function emptyCounts(): ProductCountsV2 {
  return { exact: 0, sameday: 0, diff: 0, missing: 0, measurable: 0, deviations: 0 };
}

function validateCounterSet(
  problems: string[],
  path: string,
  value: unknown,
  denominator: number,
): value is Record<ProductAxis, ProductCountsV2> {
  if (!exactKeys(problems, path, value, PRODUCT_AXES)) return false;
  const counters = value as unknown as Record<ProductAxis, ProductCountsV2>;
  let valid = true;
  for (const axis of PRODUCT_AXES) valid = validateCounts(problems, `${path}.${axis}`, counters[axis], denominator) && valid;
  return valid;
}

function validateCharacterization(problems: string[], path: string, value: unknown): value is ProductCharacterizationV2 {
  if (!exactKeys(problems, path, value, CHARACTERIZATION_KEYS)) return false;
  const characterization = value as unknown as ProductCharacterizationV2;
  equal(problems, `${path}.finalZeroGate`, characterization.finalZeroGate, 'red');
  equal(problems, `${path}.accepted`, characterization.accepted, false);
  equal(problems, `${path}.openCategories`, characterization.openCategories, PRODUCT_OPEN_CATEGORIES);
  return true;
}

export function deriveStrictEntryGate(entry: Pick<ProductEntryV2,
  'counters' | 'identityErrors' | 'scannerErrors'>): boolean {
  return entry.identityErrors.length === 0
    && entry.scannerErrors.length === 0
    && PRODUCT_AXES.every(axis => entry.counters[axis].deviations === 0);
}

function validateProject(problems: string[], path: string, value: unknown): ProductProjectV2 | null {
  if (!exactKeys(problems, path, value, PROJECT_KEYS)) return null;
  const project = value as unknown as ProductProjectV2;
  if (typeof project.projectId !== 'string' || !project.projectId.trim()) issue(problems, `${path}.projectId: niet-lege string verwacht`);
  for (const key of ['truthTasks', 'solvedTasks', 'taskCodePresent', 'taskCodeExact'] as const) {
    if (!nonNegativeInteger(project[key])) issue(problems, `${path}.${key}: niet-negatief geheel getal verwacht`);
  }
  if (!nonNegativeInteger(project.truthTasks)) return null;
  if (nonNegativeInteger(project.solvedTasks) && project.solvedTasks > project.truthTasks) issue(problems, `${path}.solvedTasks: boven truthTasks`);
  if (nonNegativeInteger(project.taskCodePresent) && nonNegativeInteger(project.solvedTasks)
    && project.taskCodePresent > project.solvedTasks) issue(problems, `${path}.taskCodePresent: boven solvedTasks`);
  if (nonNegativeInteger(project.taskCodeExact) && nonNegativeInteger(project.taskCodePresent)
    && project.taskCodeExact > project.taskCodePresent) issue(problems, `${path}.taskCodeExact: boven taskCodePresent`);
  if (project.truthTasks !== project.solvedTasks || project.truthTasks !== project.taskCodePresent
    || project.truthTasks !== project.taskCodeExact) issue(problems, `${path}: identiteitsdekking is niet exact`);
  const countersValid = validateCounterSet(problems, `${path}.counters`, project.counters, project.truthTasks);
  const drivingValid = validateCounts(problems, `${path}.drivingPath`, project.drivingPath, project.truthTasks);
  const identityErrorsValid = validateStringArray(problems, `${path}.identityErrors`, project.identityErrors, true);
  if (!HEX_64.test(project.projectionSha256 ?? '')) issue(problems, `${path}.projectionSha256: volledige SHA-256 verwacht`);
  equal(problems, `${path}.projectionSha256`, project.projectionSha256,
    productSha256(canonicalProductJson(projectProjection(project))));
  return countersValid && drivingValid && identityErrorsValid ? project : null;
}

function validateEntry(problems: string[], key: string, value: unknown): ProductEntryV2 | null {
  const path = `product-v2.files.${key}`;
  if (!exactKeys(problems, path, value, ENTRY_KEYS)) return null;
  const entry = value as unknown as ProductEntryV2;
  if (!HEX_64.test(key) || entry.sha256 !== key) issue(problems, `${path}: entrysleutel en volledige SHA-256 moeten exact gelijk zijn`);
  if (typeof entry.schemaFingerprint !== 'string' || !entry.schemaFingerprint.trim()) issue(problems, `${path}.schemaFingerprint: niet-lege string verwacht`);
  const denominatorsValid = nonNegativeInteger(entry.projects) && nonNegativeInteger(entry.tasks);
  if (!denominatorsValid) issue(problems, `${path}: projects/tasks moeten niet-negatieve gehele getallen zijn`);
  if (!exactKeys(problems, `${path}.identityCoverage`, entry.identityCoverage, IDENTITY_KEYS)) return null;
  for (const identityKey of IDENTITY_KEYS) {
    if (!nonNegativeInteger(entry.identityCoverage[identityKey])) issue(problems, `${path}.identityCoverage.${identityKey}: ongeldig`);
  }
  if (!Array.isArray(entry.projectMeasurements)) {
    issue(problems, `${path}.projectMeasurements: array verwacht`);
    return null;
  }
  const projects = entry.projectMeasurements.map((project, index) => validateProject(
    problems, `${path}.projectMeasurements[${index}]`, project,
  )).filter((project): project is ProductProjectV2 => project !== null);
  const projectIds = projects.map(project => project.projectId);
  equal(problems, `${path}: project-ID-volgorde`, projectIds, [...projectIds].sort((left, right) => left.localeCompare(right)));
  if (new Set(projectIds).size !== projectIds.length) issue(problems, `${path}: dubbele project-ID`);
  equal(problems, `${path}.projects`, entry.projects, projects.length);
  equal(problems, `${path}.tasks`, entry.tasks, projects.reduce((sum, project) => sum + project.truthTasks, 0));
  const identityTotals = {
    solvedTasks: projects.reduce((sum, project) => sum + project.solvedTasks, 0),
    taskCodePresent: projects.reduce((sum, project) => sum + project.taskCodePresent, 0),
    taskCodeExact: projects.reduce((sum, project) => sum + project.taskCodeExact, 0),
  };
  equal(problems, `${path}.identityCoverage: projectsom`, entry.identityCoverage, identityTotals);
  if (entry.identityCoverage.solvedTasks !== entry.tasks
    || entry.identityCoverage.taskCodePresent !== entry.tasks
    || entry.identityCoverage.taskCodeExact !== entry.tasks) issue(problems, `${path}.identityCoverage: niet volledig`);
  const projectCounters = Object.fromEntries(PRODUCT_AXES.map(axis => [axis, emptyCounts()])) as Record<ProductAxis, ProductCountsV2>;
  const projectDriving = emptyCounts();
  for (const project of projects) {
    for (const axis of PRODUCT_AXES) addCounts(projectCounters[axis], project.counters[axis]);
    addCounts(projectDriving, project.drivingPath);
  }
  const countersValid = nonNegativeInteger(entry.tasks)
    && validateCounterSet(problems, `${path}.counters`, entry.counters, entry.tasks);
  if (countersValid) {
    for (const axis of PRODUCT_AXES) equal(problems, `${path}.counters.${axis}: projectsom`, entry.counters[axis], projectCounters[axis]);
  }
  const drivingValid = nonNegativeInteger(entry.tasks)
    && validateCounts(problems, `${path}.drivingPath`, entry.drivingPath, entry.tasks);
  if (drivingValid) {
    equal(problems, `${path}.drivingPath: projectsom`, entry.drivingPath, projectDriving);
  }
  const identityErrorsValid = validateStringArray(problems, `${path}.identityErrors`, entry.identityErrors, true);
  const scannerErrorsValid = validateStringArray(problems, `${path}.scannerErrors`, entry.scannerErrors, true);
  if (typeof entry.gatePassed !== 'boolean') issue(problems, `${path}.gatePassed: boolean verwacht`);
  else if (countersValid && identityErrorsValid && scannerErrorsValid) {
    equal(problems, `${path}.gatePassed: herleid`, entry.gatePassed, deriveStrictEntryGate(entry));
  }
  if (!HEX_64.test(entry.projectProjectionSha256 ?? '')) issue(problems, `${path}.projectProjectionSha256: volledige SHA-256 verwacht`);
  equal(problems, `${path}.projectProjectionSha256: herleid`, entry.projectProjectionSha256, projectProjectionDigest(projects));
  return denominatorsValid && countersValid && drivingValid && identityErrorsValid && scannerErrorsValid
    ? entry
    : null;
}

export function validateProductBaselineV2(rawText: string, pins?: ProductValidationPins): ProductValidationResult {
  const problems: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return { problems: ['product-v2: envelope is geen JSON'] };
  }
  rejectForbiddenKeys(raw, 'product-v2', problems);
  if (!exactKeys(problems, 'product-v2.envelope', raw, ENVELOPE_KEYS)) return { problems };
  const envelope = raw as unknown as ProductEnvelopeV2;
  equalTextBytes(problems, 'product-v2.envelope: canonieke JSON+LF-bytes', rawText, canonicalProductJson(raw));
  equal(problems, 'product-v2.envelope.version', envelope.version, 2);
  if (!HEX_64.test(envelope.manifestSha256 ?? '')) issue(problems, 'product-v2.envelope.manifestSha256: volledige SHA-256 verwacht');
  validateCharacterization(problems, 'product-v2.envelope.characterization', envelope.characterization);
  equal(problems, 'product-v2.envelope.reportModes', envelope.reportModes, PRODUCT_REPORT_MODES);
  equal(problems, 'product-v2.envelope.encoding', envelope.encoding, 'gzip-base64-json');
  if (exactKeys(problems, 'product-v2.envelope.canonicalization', envelope.canonicalization, CANONICALIZATION_KEYS)) {
    equal(problems, 'product-v2.envelope.canonicalization.json', envelope.canonicalization.json, 'JSON.stringify(value, null, 2) + LF');
    equal(problems, 'product-v2.envelope.canonicalization.gzip', envelope.canonicalization.gzip, 'gzip level 9, deterministic header');
  }
  for (const field of ['payloadSha256', 'payloadGzipSha256', 'projectProjectionSha256'] as const) {
    if (!HEX_64.test(envelope[field] ?? '')) issue(problems, `product-v2.envelope.${field}: volledige SHA-256 verwacht`);
  }
  if (typeof envelope.payloadGzipBase64 !== 'string'
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.payloadGzipBase64)) {
    return { problems: [...problems, 'product-v2: payloadGzipBase64 is geen canonieke base64string'], envelope };
  }
  const compressed = Buffer.from(envelope.payloadGzipBase64, 'base64');
  if (compressed.toString('base64') !== envelope.payloadGzipBase64) issue(problems, 'product-v2: base64 is niet canoniek');
  let payloadText: string;
  let payloadRaw: unknown;
  try {
    payloadText = gunzipSync(compressed).toString('utf8');
    payloadRaw = JSON.parse(payloadText);
  } catch {
    return { problems: [...problems, 'product-v2: gzip-payload is niet volledig decodeerbaar JSON'], envelope };
  }
  equalTextBytes(problems, 'product-v2.payload: canonieke JSON+LF-bytes', payloadText, canonicalProductJson(payloadRaw));
  const canonicalCompressed = canonicalGzip(canonicalProductJson(payloadRaw));
  if (!compressed.equals(canonicalCompressed)) {
    issue(problems, `product-v2.payload: gzipbytes wijken af van canonieke level-9-recompressie (${productSha256(compressed)} != ${productSha256(canonicalCompressed)})`);
  }
  equal(problems, 'product-v2.envelope.payloadSha256', envelope.payloadSha256, productSha256(payloadText));
  equal(problems, 'product-v2.envelope.payloadGzipSha256', envelope.payloadGzipSha256, productSha256(compressed));
  rejectForbiddenKeys(payloadRaw, 'product-v2.payload', problems);
  if (!exactKeys(problems, 'product-v2.payload', payloadRaw, PAYLOAD_KEYS)) return { problems, envelope };
  const payload = payloadRaw as unknown as ProductBaselineV2;
  equal(problems, 'product-v2.payload.version', payload.version, 2);
  equal(problems, 'product-v2.payload.manifestSha256', payload.manifestSha256, envelope.manifestSha256);
  validateCharacterization(problems, 'product-v2.payload.characterization', payload.characterization);
  equal(problems, 'product-v2.envelope-payload.characterization', payload.characterization, envelope.characterization);
  const filesObject = objectValue(payload.files);
  if (!filesObject) return { problems: [...problems, 'product-v2.payload.files: object verwacht'], envelope };
  const entries = Object.keys(filesObject).sort();
  const totals = Object.fromEntries(PRODUCT_AXES.map(axis => [axis, emptyCounts()])) as Record<ProductAxis, ProductCountsV2>;
  const driving = emptyCounts();
  let projects = 0;
  let tasks = 0;
  for (const key of entries) {
    const entry = validateEntry(problems, key, filesObject[key]);
    if (!entry) continue;
    projects += entry.projects;
    tasks += entry.tasks;
    for (const axis of PRODUCT_AXES) addCounts(totals[axis], entry.counters[axis]);
    addCounts(driving, entry.drivingPath);
  }
  const computedProjection = productProjectionDigest(payload);
  equal(problems, 'product-v2.envelope.projectProjectionSha256: herleid', envelope.projectProjectionSha256, computedProjection);
  if (pins) {
    equal(problems, 'product-v2.pin.manifestSha256', envelope.manifestSha256, pins.manifestSha256);
    equal(problems, 'product-v2.pin.entryset', entries, Object.keys(pins.entries).sort());
    for (const [sha256, expected] of Object.entries(pins.entries)) {
      equal(problems, `product-v2.pin.${sha256}.schemaFingerprint`, payload.files[sha256]?.schemaFingerprint, expected.schemaFingerprint);
    }
    equal(problems, 'product-v2.pin.projects', projects, pins.projects);
    equal(problems, 'product-v2.pin.tasks', tasks, pins.tasks);
    equal(problems, 'product-v2.pin.counters', totals, pins.counters);
    equal(problems, 'product-v2.pin.drivingPath', driving, pins.drivingPath);
    if (pins.projectProjectionSha256) equal(problems, 'product-v2.pin.projectProjectionSha256', computedProjection, pins.projectProjectionSha256);
    if (pins.payloadSha256) equal(problems, 'product-v2.pin.payloadSha256', envelope.payloadSha256, pins.payloadSha256);
    if (pins.payloadGzipSha256) equal(problems, 'product-v2.pin.payloadGzipSha256', envelope.payloadGzipSha256, pins.payloadGzipSha256);
  }
  return { problems, envelope, payload };
}

export interface ProductReportInputs<T> {
  strictMinuteExact: T;
  historicalCompletedLate: T;
  sourceDayPrecision: T;
}

export function selectProductReportMode<T>(mode: ProductReportMode, inputs: ProductReportInputs<T>): {
  mode: ProductReportMode;
  strictGateEligible: boolean;
  report: T;
} {
  switch (mode) {
    case 'strict-minute-exact': return { mode, strictGateEligible: true, report: inputs.strictMinuteExact };
    case 'historical-completed-late': return { mode, strictGateEligible: false, report: inputs.historicalCompletedLate };
    case 'source-day-precision': return { mode, strictGateEligible: false, report: inputs.sourceDayPrecision };
  }
}
