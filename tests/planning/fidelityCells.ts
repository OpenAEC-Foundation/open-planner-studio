// Cel-baseline voor regel A (rekenprofielen-spec §2 besluit 5, §5) onder het P6-profiel (X12).
//
// Een cel is (bestand-sha256, `<proj_id>/<task_id>`, as) met als waarde de afwijkingsemmer uit
// `XerProductTaskDelta.bucket` (`sameday` | `diff` | `missing`). Een cel die niet in de baseline
// staat, was exact. Poortregels:
//   (a) een cel die exact was en nu een emmer heeft                        ⇒ rood;
//   (b) een cel waarvan de emmer verslechtert                              ⇒ rood;
//       volgorde (spec §5): exact < sameday < diff < missing — elke stap naar rechts is
//       verslechteren (ook sameday→missing), elke stap naar links verbeteren;
//   (c) verbetering (emmer → exact, of een lagere rang)                     ⇒ groen, "te herpinnen";
//   verouderde baselineregels (cel nu exact) zijn toegestaan en onschuldig.
// Herpinnen (`planCellRepin`) mag alleen zonder één rode cel.
//
// Identiteit: `<proj_id>/<task_id>` is precies de join van `measureXerProductFidelity` (project,
// daarbinnen `sourceTaskId` = P6 `task_id`). `taskCode` is daar uitdrukkelijk géén identiteit.
// Sleutel: volledige SHA-256 van de `.xer`-bytes, dezelfde sleutel als
// `xer-product-fidelity-baseline-v2.json`. Canonicalisatie als daar: `JSON.stringify(value, null, 2)`
// + LF, met alle objectsleutels in UTF-16-code-unit-volgorde gesorteerd.
//
// Pure functies zonder I/O, zodat `check-fidelity-cells-gate.ts` de poortlogica corpusloos op
// synthetische metingen kan bewijzen.
import { XER_FIDELITY_AXES } from './xerGroundTruth';

export const CELL_BASELINE_VERSION = 1;
export const CELL_BASELINE_FILE = 'xer-product-fidelity-cells.json';
/** Bovengrens vóór `JSON.parse`; de echte baseline is ±0,5 MB. */
export const CELL_BASELINE_MAX_CHARS = 16 * 1024 * 1024;

export type CellBucket = 'sameday' | 'diff' | 'missing';
/** Oplopend slechter (spec §5): exact (0, niet in de baseline) < sameday < diff < missing. */
export const BUCKET_RANK: Readonly<Record<CellBucket, number>> = { sameday: 1, diff: 2, missing: 3 };
export const CELL_BUCKETS: readonly CellBucket[] = ['sameday', 'diff', 'missing'];

function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function sortedKeys(value: object): string[] {
  return Object.keys(value).sort(codeUnitCompare);
}

/** De zes poortassen plus de rapportage-as `drivingPath`, gesorteerd. */
export const CELL_AXES: readonly string[] = [...XER_FIDELITY_AXES, 'drivingPath'].sort(codeUnitCompare);
export const CELL_KEY_PATTERN = /^[0-9a-f]{64}$/;
export const CELL_ID_PATTERN = /^[0-9A-Za-z_.-]{1,64}\/[0-9A-Za-z_.-]{1,64}$/;

/** files[sha256][as][`proj_id/task_id`] = emmer. */
export type CellFiles = Record<string, Record<string, Record<string, CellBucket>>>;
export interface CellBaseline {
  version: typeof CELL_BASELINE_VERSION;
  axes: string[];
  buckets: CellBucket[];
  files: CellFiles;
}

export interface CellRef { file: string; axis: string; id: string; was?: CellBucket; now?: CellBucket }

export interface CellDelta {
  /** (a) was exact, nu inexact. */
  newCells: CellRef[];
  /** (b) emmer verslechterd. */
  worsenedCells: CellRef[];
  /** (c) emmer verbeterd of cel exact geworden — groen, te herpinnen. */
  improvedCells: CellRef[];
  /** Gemeten bestand zonder baselinerecord (onbekend corpusbestand of gewijzigde bytes). */
  unknownFiles: string[];
  /** Baselinebestand dat deze meting niet bevat. */
  unmeasuredFiles: string[];
}

export interface MeasuredCell { axis: string; id: string; bucket: CellBucket }

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function canonicalAxes(axes: Record<string, Record<string, CellBucket>>): Record<string, Record<string, CellBucket>> {
  const out: Record<string, Record<string, CellBucket>> = {};
  for (const axis of sortedKeys(axes)) {
    const cells: Record<string, CellBucket> = {};
    for (const id of sortedKeys(axes[axis]!)) cells[id] = axes[axis]![id]!;
    out[axis] = cells;
  }
  return out;
}

/** Bouwt een (gesorteerde) baseline uit per-bestand-metingen. Dubbele cel ⇒ fout (identiteitslek). */
export function buildCellBaseline(measured: ReadonlyMap<string, readonly MeasuredCell[]>): CellBaseline {
  const files: CellFiles = {};
  for (const key of [...measured.keys()].sort(codeUnitCompare)) {
    if (!CELL_KEY_PATTERN.test(key)) throw new Error(`bestandssleutel ${key.slice(0, 80)} is geen sha256`);
    const axes: Record<string, Record<string, CellBucket>> = Object.fromEntries(CELL_AXES.map(axis => [axis, {}]));
    for (const cell of measured.get(key)!) {
      const axis = hasOwn(axes, cell.axis) ? axes[cell.axis]! : undefined;
      if (!axis) throw new Error(`onbekende as ${cell.axis}`);
      if (!CELL_ID_PATTERN.test(cell.id)) throw new Error(`id ${cell.id.slice(0, 80)} heeft de verkeerde vorm`);
      if (!hasOwn(BUCKET_RANK, cell.bucket)) throw new Error(`onbekende emmer ${String(cell.bucket)}`);
      if (hasOwn(axis, cell.id)) throw new Error(`dubbele cel ${key}/${cell.axis}/${cell.id}`);
      axis[cell.id] = cell.bucket;
    }
    files[key] = canonicalAxes(axes);
  }
  return { version: CELL_BASELINE_VERSION, axes: [...CELL_AXES], buckets: [...CELL_BUCKETS], files };
}

/** `JSON.stringify(value, null, 2)` + LF over een object waarvan elke sleutelreeks gesorteerd is. */
export function serializeCellBaseline(baseline: CellBaseline): string {
  const files: CellFiles = {};
  for (const key of sortedKeys(baseline.files)) files[key] = canonicalAxes(baseline.files[key]!);
  return `${JSON.stringify({
    version: baseline.version, axes: [...CELL_AXES], buckets: [...CELL_BUCKETS], files,
  }, null, 2)}\n`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStrictlySorted(keys: readonly string[]): boolean {
  for (let index = 1; index < keys.length; index++) if (codeUnitCompare(keys[index - 1]!, keys[index]!) >= 0) return false;
  return true;
}

/**
 * Strikte lezer: schema, sleutel-/id-vorm, emmerwaarden, sortering en canonieke bytes. Een baseline
 * die niet byte-gelijk is aan zijn eigen herserialisatie is met de hand bewerkt en wordt geweigerd.
 */
export function parseCellBaseline(raw: string): { baseline?: CellBaseline; problems: string[] } {
  if (raw.length > CELL_BASELINE_MAX_CHARS) return { problems: [`baseline groter dan ${CELL_BASELINE_MAX_CHARS} tekens`] };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch (error) {
    return { problems: [`geen geldige JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }
  if (!isPlainObject(parsed)) return { problems: ['top-level is geen object'] };
  const problems: string[] = [];
  const top = Object.keys(parsed).join(',');
  if (top !== 'version,axes,buckets,files') problems.push(`top-level sleutels ${top} ≠ version,axes,buckets,files`);
  if (parsed.version !== CELL_BASELINE_VERSION) problems.push(`version ≠ ${CELL_BASELINE_VERSION}`);
  if (JSON.stringify(parsed.axes) !== JSON.stringify(CELL_AXES)) problems.push(`axes ≠ ${JSON.stringify(CELL_AXES)}`);
  if (JSON.stringify(parsed.buckets) !== JSON.stringify(CELL_BUCKETS)) problems.push(`buckets ≠ ${JSON.stringify(CELL_BUCKETS)}`);
  if (!isPlainObject(parsed.files)) return { problems: [...problems, 'files is geen object'] };
  const fileKeys = Object.keys(parsed.files);
  if (!isStrictlySorted(fileKeys)) problems.push('bestandssleutels niet strikt oplopend gesorteerd');
  for (const key of fileKeys) {
    if (!CELL_KEY_PATTERN.test(key)) { problems.push(`bestandssleutel ${JSON.stringify(key.slice(0, 80))} is geen sha256`); continue; }
    const axes = parsed.files[key];
    if (!isPlainObject(axes)) { problems.push(`${key}: geen object`); continue; }
    if (Object.keys(axes).join(',') !== CELL_AXES.join(',')) problems.push(`${key}: assen ≠ ${CELL_AXES.join(',')}`);
    for (const axis of CELL_AXES) {
      const cells = axes[axis];
      if (!isPlainObject(cells)) { problems.push(`${key}/${axis}: geen object`); continue; }
      const ids = Object.keys(cells);
      if (!isStrictlySorted(ids)) problems.push(`${key}/${axis}: ids niet strikt oplopend gesorteerd`);
      for (const id of ids) {
        if (!CELL_ID_PATTERN.test(id)) { problems.push(`${key}/${axis}: id ${JSON.stringify(id.slice(0, 80))} heeft de verkeerde vorm`); break; }
        const bucket = cells[id];
        if (typeof bucket !== 'string' || !(CELL_BUCKETS as readonly string[]).includes(bucket)) {
          problems.push(`${key}/${axis}/${id}: emmer ${JSON.stringify(bucket)} onbekend`);
          break;
        }
      }
    }
  }
  if (problems.length > 0) return { problems };
  const baseline = parsed as unknown as CellBaseline;
  if (serializeCellBaseline(baseline) !== raw) {
    return { problems: ['baseline is niet canoniek geserialiseerd (herpin via OPS_XER_CELLS_WRITE=1, niet met de hand)'] };
  }
  return { baseline, problems };
}

export function compareCells(baseline: CellBaseline, measured: CellBaseline): CellDelta {
  const delta: CellDelta = { newCells: [], worsenedCells: [], improvedCells: [], unknownFiles: [], unmeasuredFiles: [] };
  for (const file of sortedKeys(measured.files)) {
    const was = hasOwn(baseline.files, file) ? baseline.files[file] : undefined;
    if (!was) { delta.unknownFiles.push(file); continue; }
    const now = measured.files[file]!;
    for (const axis of CELL_AXES) {
      const before = was[axis] ?? {};
      const after = now[axis] ?? {};
      for (const id of sortedKeys(after)) {
        const nowBucket = after[id]!;
        const wasBucket = hasOwn(before, id) ? before[id] : undefined;
        if (wasBucket === undefined) delta.newCells.push({ file, axis, id, now: nowBucket });
        else if (BUCKET_RANK[nowBucket] > BUCKET_RANK[wasBucket]) delta.worsenedCells.push({ file, axis, id, was: wasBucket, now: nowBucket });
        else if (BUCKET_RANK[nowBucket] < BUCKET_RANK[wasBucket]) delta.improvedCells.push({ file, axis, id, was: wasBucket, now: nowBucket });
      }
      for (const id of sortedKeys(before)) {
        if (!hasOwn(after, id)) delta.improvedCells.push({ file, axis, id, was: before[id] });
      }
    }
  }
  for (const file of sortedKeys(baseline.files)) if (!hasOwn(measured.files, file)) delta.unmeasuredFiles.push(file);
  return delta;
}

/** Rode regels voor de poort; leeg ⇒ regel A gehouden. */
export function cellGateFailures(delta: CellDelta): string[] {
  return [
    ...delta.newCells.map(cell => `cel was exact, nu inexact (${cell.now}) — regel A: ${cell.file} as ${cell.axis} id ${cell.id}`),
    ...delta.worsenedCells.map(cell => `cel verslechterd ${cell.was}→${cell.now} — regel A: ${cell.file} as ${cell.axis} id ${cell.id}`),
    ...delta.unknownFiles.map(file => `gemeten bestand ontbreekt in de cel-baseline: ${file}`),
    ...delta.unmeasuredFiles.map(file => `cel-baselinebestand niet gemeten: ${file}`),
  ];
}

/** Per as het aantal inexacte cellen, uitgesplitst per emmer. */
export function cellTotals(baseline: CellBaseline): Record<string, Record<CellBucket | 'total', number>> {
  const totals: Record<string, Record<CellBucket | 'total', number>> = Object.fromEntries(
    CELL_AXES.map(axis => [axis, { sameday: 0, diff: 0, missing: 0, total: 0 }]));
  for (const axes of Object.values(baseline.files)) {
    for (const axis of CELL_AXES) {
      for (const bucket of Object.values(axes[axis] ?? {})) { totals[axis]![bucket]++; totals[axis]!.total++; }
    }
  }
  return totals;
}

/**
 * Herpinnen alleen zonder rode cel: geweigerd bij (a) of (b). Nieuwe bestanden (corpusgroei) mogen
 * erbij — zij hadden geen gepinde exacte cel — en niet meer gemeten bestanden vallen weg; beide
 * staan in de teruggegeven delta. Wat geschreven wordt is precies de meting.
 */
export function planCellRepin(
  baseline: CellBaseline | undefined,
  measured: CellBaseline,
): { allowed: true; delta: CellDelta } | { allowed: false; reasons: string[]; delta: CellDelta } {
  const empty: CellBaseline = { version: CELL_BASELINE_VERSION, axes: [...CELL_AXES], buckets: [...CELL_BUCKETS], files: {} };
  const delta = compareCells(baseline ?? empty, measured);
  const reasons = [
    ...delta.newCells.map(cell => `nieuwe inexacte cel ${cell.file.slice(0, 12)} ${cell.axis} ${cell.id}`),
    ...delta.worsenedCells.map(cell => `verslechterde cel ${cell.file.slice(0, 12)} ${cell.axis} ${cell.id} ${cell.was}→${cell.now}`),
  ];
  return reasons.length > 0 ? { allowed: false, reasons, delta } : { allowed: true, delta };
}

/** Eén machineleesbare regel voor `scripts/measure-profiles.mjs`. */
export function cellDeltaLine(profile: string, delta: CellDelta, measured: CellBaseline): string {
  const total = Object.values(cellTotals(measured)).reduce((sum, axis) => sum + axis.total, 0);
  return `CELLDELTA ${profile} nieuw=${delta.newCells.length} verslechterd=${delta.worsenedCells.length} `
    + `verbeterd=${delta.improvedCells.length} onbekend=${delta.unknownFiles.length} `
    + `ongemeten=${delta.unmeasuredFiles.length} totaal=${total}`;
}
