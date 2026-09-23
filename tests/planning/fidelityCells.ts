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
//       UITZONDERING: diff→sameday met grotere minuten is rood (`groter`) — de emmer is een
//       kalenderdaggrens, geen maat; alleen bij gelijke of kleinere minuten telt het als verbeterd;
//   (d) een baselinecel die niet meer MEETBAAR is (het orakel heeft geen waarde meer, of de taak is
//       weg) telt NIET als verbeterd maar als "onmeetbaar geworden"      ⇒ rood — een blinder
//       orakel mag nooit als verbetering doorgaan;
//   (e) GROOTTE-RATCHET (eigenaarsbesluit 2026-09-23, versie 2): een cel die in baseline én meting
//       dezelfde emmer `sameday` of `diff` heeft, mag niet GROTER afwijken      ⇒ rood (`groter`);
//       kleiner is groen en telt apart als "verbeterd-grootte" (`kleiner`), te herpinnen.
//   verouderde baselineregels (cel nu exact én meetbaar) zijn toegestaan en onschuldig.
// Herpinnen (`planCellRepin`) mag alleen zonder één rode cel.
//
// Grootte (`minutes`): de absolute afwijking `|ours − truth|` in MINUTEN, voor alle zes assen
// dezelfde eenheid — datum-assen (es/ef/ls/lf) in wandklokminuten tussen de twee canonieke
// `YYYY-MM-DDTHH:MM`-waarden, float-assen (tf/ff) in floatminuten (beide kanten zijn al minuten),
// afgerond op 0,001 minuut zodat drijvende-kommaruis nooit een "groter" maakt. Ruis onder 0,0005 min
// kan zo een `diff`-cel met grootte 0 opleveren (gemeten: twee cellen `4408/98250` op tf/ff): de emmer
// komt uit de ongeafronde vergelijking, de grootte is afgerond. Onschadelijk — de emmer-ratchet houdt
// de cel vast, en elke echte groei (≥ 0,001) is alsnog `groter`. `missing` en de
// hele as `drivingPath` hebben geen grootte (`null`): daar bestaat geen afstand.
//
// Versie 1 (alleen de emmer) wordt in de poort GEWEIGERD met een verwijzing naar het recept; alleen
// `OPS_XER_CELLS_WRITE=1` mét `OPS_XER_CELLS_V1_UPGRADE=1` leest hem nog (als emmer-ratchet, zonder
// grootte) om hem als versie 2 te herschrijven. Die vlag bestaat uitsluitend voor de allereerste
// overgang v1→v2 en mag na het landen van claude/x12-grootte-ratchet niet meer gebruikt worden: bij een
// merge met een v1-cellenbestand neem je altijd de v2-kant (scripts/README.md).
//
// Assen: de zes X12-assen (es/ef/ls/lf/tf/ff) plus `drivingPath` als zevende poort-as
// (eigenaarsbesluit 2026-09-22: "driving path wordt de zevende poort-as"). `drivingPath` valt in
// deze cel-ratchet onder precies dezelfde regels (a)–(c), maar telt niet mee in het zesassige
// nuldoel-getal van X12 (15.056); dat getal blijft de som van de zes datum-/floatassen.
//
// Identiteit: `<proj_id>/<task_id>` is precies de join van `measureXerProductFidelity` (project,
// daarbinnen `sourceTaskId` = P6 `task_id`). `taskCode` is daar uitdrukkelijk géén identiteit.
// Sleutel: volledige SHA-256 van de `.xer`-bytes, dezelfde sleutel als
// `xer-product-fidelity-baseline-v2.json`. Canonicalisatie als daar: `JSON.stringify(value, null, 2)`
// + LF, met alle objectsleutels in UTF-16-code-unit-volgorde gesorteerd.
//
// RATCHET-SCHULD (`ratchetDebt`, orkestratorbesluit 2026-09-23 bij de merge van de grootte-ratchet):
// cellen die bij de allereerste v2-meting op de huidige motor al GROTER afweken dan in de oude
// v2-kant (d4a66772-motor) staan als schuld in het bestand: `{ reference, current }` in minuten.
//   - de ratchet-referentie van zo'n cel is `current` (die staat ook als `minutes` in `files`):
//     verder groeien is `groter`, rood — zoals elke andere cel;
//   - daalt de cel tot ≤ `reference` (of wordt hij exact), dan vervalt de schuld: `carryRatchetDebt`
//     laat de regel bij de volgende herpin weg; daalt hij maar blijft hij > `reference`, dan schuift
//     `current` mee omlaag;
//   - er bestaat GEEN route meer die schuld aanmaakt: de eenmalige overgang van 2026-09-23
//     (`OPS_XER_CELLS_DEBT_INIT`) is na gebruik verwijderd (critreview integratie-eindstand). Een
//     cellenbestand zonder `ratchetDebt`-sectie wordt geweigerd, net als versie 1; de sectie kan
//     alleen krimpen via `OPS_XER_CELLS_WRITE`. Nooit met de hand bewerken: de strikte lezer eist dat
//     elke schuldregel naar een bestaande sameday/diff-cel met `minutes === current` wijst en dat
//     `reference < current`, en `check-fidelity-cells-gate.ts` pint een digest over de schuldSET
//     (`debtDigest`: bestand, as, id, reference) zodat de lijst niet ongemerkt geruild of ingekort
//     kan worden.
//
// MINUTEN-DIGEST (`cellMinutesDigest`, critreview integratie-eindstand 2026-09-23): de grootte van
// een cel is de ratchet-referentie; een met de hand opgerekte grootte (105360 → 205360) zou de
// ratchet stil versoepelen zonder rode regel. Daarom draagt de v2-envelop
// (`xer-product-fidelity-baseline-v2.json`, veld `cellMinutesSha256`) een SHA-256 over alle
// `files[..].minutes` van het cellenbestand, geschreven door `OPS_XER_V2_WRITE` en
// `OPS_XER_CELLS_WRITE`, en getoetst door `check-fidelity-cells-gate.ts` (corpusloos) én de
// X12-check: cellenbestand en v2 moeten dezelfde digest hebben.
//
// Pure functies zonder I/O, zodat `check-fidelity-cells-gate.ts` de poortlogica corpusloos op
// synthetische metingen kan bewijzen.
import { createHash } from 'node:crypto';
import { XER_FIDELITY_AXES } from './xerGroundTruth';

export const CELL_BASELINE_VERSION = 2;
/** Melding bij een versie-1-bestand (emmer zonder grootte). */
export const CELL_V1_PROBLEM = 'versie 1 (alleen emmers, geen grootte) wordt niet meer gelezen — herschrijf hem als versie 2 met '
  + 'OPS_XER_CELLS_WRITE=1 OPS_XER_CELLS_V1_UPGRADE=1 mét corpus, alleen voor de eerste overgang (scripts/README.md, herpinrecept); nooit met de hand';
export const CELL_BASELINE_FILE = 'xer-product-fidelity-cells.json';
/** Melding bij een versie-2-bestand zonder `ratchetDebt`-sectie (van vóór de schuldregel). */
export const CELL_PRE_DEBT_PROBLEM = 'versie 2 zonder ratchetDebt-sectie (van vóór 2026-09-23) wordt geweigerd — er is geen route meer '
  + 'die schuld aanmaakt; neem bij een merge de kant mét ratchetDebt-sectie (scripts/README.md); nooit met de hand';
/** Bovengrens vóór `JSON.parse`; de echte baseline (versie 2) is ±1,39 MB. */
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

/** De zes X12-assen plus `drivingPath` als zevende poort-as (cel-ratchet; niet in het zesassige
 *  nuldoel-getal), gesorteerd. */
export const CELL_AXES: readonly string[] = [...XER_FIDELITY_AXES, 'drivingPath'].sort(codeUnitCompare);
export const CELL_KEY_PATTERN = /^[0-9a-f]{64}$/;
export const CELL_ID_PATTERN = /^[0-9A-Za-z_.-]{1,64}\/[0-9A-Za-z_.-]{1,64}$/;

/** Eén inexacte cel: de emmer plus de absolute afwijking in minuten (`null` bij `missing` en op
 *  `drivingPath`). */
export interface CellValue { bucket: CellBucket; minutes: number | null }
/** files[sha256][as][`proj_id/task_id`] = cel. */
export type CellFiles = Record<string, Record<string, Record<string, CellValue>>>;
/** Eén schuldcel: `reference` = de minuten uit de oude v2-kant, `current` = de huidige (≥) minuten. */
export interface DebtValue { reference: number; current: number }
/** ratchetDebt[sha256][as][`proj_id/task_id`] = schuld; alleen niet-lege niveaus, gesorteerd. */
export type CellDebt = Record<string, Record<string, Record<string, DebtValue>>>;
export interface CellBaseline {
  version: typeof CELL_BASELINE_VERSION;
  /** SHA-256 van `xer-corpus-manifest.json` waarbij deze cellen horen (corpusgroei-route). */
  manifestSha256: string;
  axes: string[];
  buckets: CellBucket[];
  /** Per entry een SHA-256 over de orakel-`driving_path_flag`-waarden (die zit niet in de
   *  `schemaFingerprint` van v2): een orakel dat naar onze waarde toe schuift is zo zichtbaar. */
  drivingPathOracle: Record<string, string>;
  files: CellFiles;
  /** Ratchet-schuld (zie de kop van dit bestand); leeg object als er geen schuld is. */
  ratchetDebt: CellDebt;
}
/** Metagegevens die de meetlat naast de cellen levert. */
export interface CellMeta { manifestSha256: string; drivingPathOracle: ReadonlyMap<string, string> }
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface CellRef {
  file: string; axis: string; id: string; was?: CellBucket; now?: CellBucket;
  wasMinutes?: number; nowMinutes?: number;
}

export interface CellDelta {
  /** (a) was exact, nu inexact. */
  newCells: CellRef[];
  /** (b) emmer verslechterd. */
  worsenedCells: CellRef[];
  /** (c) emmer verbeterd of cel exact geworden (en nog meetbaar) — groen, te herpinnen. */
  improvedCells: CellRef[];
  /** (e) zelfde emmer sameday/diff, grotere afwijking — rood. */
  largerCells: CellRef[];
  /** (e) zelfde emmer sameday/diff, kleinere afwijking — groen, "verbeterd-grootte", te herpinnen. */
  smallerCells: CellRef[];
  /** (d) baselinecel niet meer meetbaar — rood. */
  unmeasurableCells: CellRef[];
  /** Baselinecel van een taak die een eigenaarsbesluit nu uitsluit (`xerManifestExclusions.ts`) — `fileset`. */
  excludedCells: CellRef[];
  /** Nieuwe cel van een taak die in de gepinde uitsluitingslijst stond en nu weer meetelt — `fileset`. */
  reincludedCells: CellRef[];
  /** Gemeten bestand zonder baselinerecord (onbekend corpusbestand of gewijzigde bytes). */
  unknownFiles: string[];
  /** Baselinebestand dat deze meting niet bevat. */
  unmeasuredFiles: string[];
}

export interface MeasuredCell { axis: string; id: string; bucket: CellBucket; minutes: number | null }
/** Heeft het orakel in déze meting een waarde voor (bestand, as, id)? Leverancier: de meetlat. */
export type CellMeasurable = (file: string, axis: string, id: string) => boolean;
/**
 * Uitsluiting per project/taak (eigenaarsbesluit in het manifest): `now` = in deze meting uitgesloten,
 * `was` = uitgesloten volgens de gepinde lijst. Alleen een verschil tussen die twee verklaart een
 * verdwenen of nieuwe cel; zonder dit argument gedraagt `compareCells` zich als vroeger.
 */
export interface CellExclusions { now(file: string, id: string): boolean; was(file: string, id: string): boolean }

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function canonicalAxes(axes: Record<string, Record<string, CellValue>>): Record<string, Record<string, CellValue>> {
  const out: Record<string, Record<string, CellValue>> = {};
  for (const axis of sortedKeys(axes)) {
    const cells: Record<string, CellValue> = {};
    for (const id of sortedKeys(axes[axis]!)) cells[id] = { bucket: axes[axis]![id]!.bucket, minutes: axes[axis]![id]!.minutes };
    out[axis] = cells;
  }
  return out;
}

/** Heeft een cel op deze as met deze emmer een grootte? Alleen sameday/diff op de zes X12-assen. */
export function cellHasMagnitude(axis: string, bucket: CellBucket): boolean {
  return axis !== 'drivingPath' && (bucket === 'sameday' || bucket === 'diff');
}

/** Afronding van de grootte: 0,001 minuut. */
export function roundMinutes(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const CANONICAL_MINUTE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
function wallClockMinutes(value: string): number | undefined {
  const match = CANONICAL_MINUTE.exec(value);
  if (!match) return undefined;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  const ms = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
    || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute) return undefined;
  return ms / 60_000;
}

function finiteNumber(value: string | number | boolean | null | undefined): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

/**
 * De grootte van één cel: `|ours − truth|` in minuten (datum-assen: wandklok; tf/ff: floatminuten),
 * afgerond op 0,001. `null` waar geen grootte bestaat (`missing`, `drivingPath`). `undefined` als
 * een grootte vereist is maar niet te bepalen (geen canonieke minuut, geen eindig getal) — de
 * bouwer maakt daar een nette fout van in plaats van een stille `null`.
 */
export function cellMagnitude(
  axis: string, bucket: CellBucket,
  truth: string | number | boolean | null | undefined, ours: string | number | boolean | null | undefined,
): number | null | undefined {
  if (!cellHasMagnitude(axis, bucket)) return null;
  if (axis === 'tf' || axis === 'ff') {
    const a = finiteNumber(ours);
    const b = finiteNumber(truth);
    return a !== undefined && b !== undefined ? roundMinutes(Math.abs(a - b)) : undefined;
  }
  if (typeof ours !== 'string' || typeof truth !== 'string') return undefined;
  const a = wallClockMinutes(ours);
  const b = wallClockMinutes(truth);
  return a !== undefined && b !== undefined ? roundMinutes(Math.abs(a - b)) : undefined;
}

function isValidMinutes(axis: string, bucket: CellBucket, minutes: unknown): boolean {
  if (!cellHasMagnitude(axis, bucket)) return minutes === null;
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 && roundMinutes(minutes) === minutes;
}

/** Bouwt een (gesorteerde) baseline uit per-bestand-metingen. Dubbele cel ⇒ fout (identiteitslek). */
export function buildCellBaseline(measured: ReadonlyMap<string, readonly MeasuredCell[]>, meta: CellMeta): CellBaseline {
  if (!SHA256_PATTERN.test(meta.manifestSha256)) throw new Error('manifestSha256 is geen sha256');
  const drivingPathOracle: Record<string, string> = {};
  for (const key of [...measured.keys()].sort(codeUnitCompare)) {
    const oracle = meta.drivingPathOracle.get(key);
    if (oracle === undefined || !SHA256_PATTERN.test(oracle)) throw new Error(`drivingPath-orakelhash ontbreekt voor ${key.slice(0, 12)}`);
    drivingPathOracle[key] = oracle;
  }
  if ([...meta.drivingPathOracle.keys()].some(key => !measured.has(key))) throw new Error('drivingPath-orakelhash voor een niet-gemeten entry');
  const files: CellFiles = {};
  for (const key of [...measured.keys()].sort(codeUnitCompare)) {
    if (!CELL_KEY_PATTERN.test(key)) throw new Error(`bestandssleutel ${key.slice(0, 80)} is geen sha256`);
    const axes: Record<string, Record<string, CellValue>> = Object.fromEntries(CELL_AXES.map(axis => [axis, {}]));
    for (const cell of measured.get(key)!) {
      const axis = hasOwn(axes, cell.axis) ? axes[cell.axis]! : undefined;
      if (!axis) throw new Error(`onbekende as ${cell.axis}`);
      if (!CELL_ID_PATTERN.test(cell.id)) throw new Error(`id ${cell.id.slice(0, 80)} heeft de verkeerde vorm`);
      if (!hasOwn(BUCKET_RANK, cell.bucket)) throw new Error(`onbekende emmer ${String(cell.bucket)}`);
      if (hasOwn(axis, cell.id)) throw new Error(`dubbele cel ${key}/${cell.axis}/${cell.id}`);
      if (!isValidMinutes(cell.axis, cell.bucket, cell.minutes)) {
        throw new Error(`cel ${key}/${cell.axis}/${cell.id} (${cell.bucket}): grootte ${String(cell.minutes)} ongeldig — `
          + (cellHasMagnitude(cell.axis, cell.bucket) ? 'verwacht een eindig getal ≥ 0 in minuten (0,001)' : 'verwacht null'));
      }
      axis[cell.id] = { bucket: cell.bucket, minutes: cell.minutes };
    }
    files[key] = canonicalAxes(axes);
  }
  return {
    version: CELL_BASELINE_VERSION, manifestSha256: meta.manifestSha256, axes: [...CELL_AXES], buckets: [...CELL_BUCKETS],
    drivingPathOracle, files, ratchetDebt: {},
  };
}

/** Aantal schuldcellen. */
export function debtCount(debt: CellDebt): number {
  let count = 0;
  for (const axes of Object.values(debt)) for (const cells of Object.values(axes)) count += Object.keys(cells).length;
  return count;
}

function canonicalDebt(debt: CellDebt): CellDebt {
  const out: CellDebt = {};
  for (const file of sortedKeys(debt)) {
    const axes: Record<string, Record<string, DebtValue>> = {};
    for (const axis of sortedKeys(debt[file]!)) {
      const cells: Record<string, DebtValue> = {};
      for (const id of sortedKeys(debt[file]![axis]!)) {
        const value = debt[file]![axis]![id]!;
        cells[id] = { reference: value.reference, current: value.current };
      }
      if (Object.keys(cells).length > 0) axes[axis] = cells;
    }
    if (Object.keys(axes).length > 0) out[file] = axes;
  }
  return out;
}

/**
 * Schuld doorschuiven naar een meting: een schuldcel blijft staan zolang de gemeten cel bestaat en
 * méér dan `reference` afwijkt (`current` = de gemeten minuten); anders vervalt hij. Kan nooit schuld
 * toevoegen: elke uitvoerregel komt uit `debt`.
 */
export function carryRatchetDebt(debt: CellDebt, measured: CellBaseline): CellDebt {
  const out: CellDebt = {};
  for (const [file, axes] of Object.entries(debt)) {
    for (const [axis, cells] of Object.entries(axes)) {
      for (const [id, value] of Object.entries(cells)) {
        const cell = measured.files[file]?.[axis]?.[id];
        if (!cell || cell.minutes === null || cell.minutes <= value.reference) continue;
        ((out[file] ??= {})[axis] ??= {})[id] = { reference: value.reference, current: cell.minutes };
      }
    }
  }
  return canonicalDebt(out);
}

/**
 * Zelfde als `buildCellBaseline`, maar een ongeldige meting (dubbele cel binnen één project,
 * onbekende as/emmer, id in de verkeerde vorm) wordt een foutregel in plaats van een exception —
 * zodat de check een nette XX-regel print in plaats van een stacktrace.
 */
export function tryBuildCellBaseline(
  measured: ReadonlyMap<string, readonly MeasuredCell[]>,
  meta: CellMeta,
): { baseline: CellBaseline; error?: undefined } | { baseline?: undefined; error: string } {
  try { return { baseline: buildCellBaseline(measured, meta) }; } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** `JSON.stringify(value, null, 2)` + LF over een object waarvan elke sleutelreeks gesorteerd is. */
export function serializeCellBaseline(baseline: CellBaseline): string {
  const files: CellFiles = {};
  for (const key of sortedKeys(baseline.files)) files[key] = canonicalAxes(baseline.files[key]!);
  const drivingPathOracle: Record<string, string> = {};
  for (const key of sortedKeys(baseline.drivingPathOracle)) drivingPathOracle[key] = baseline.drivingPathOracle[key]!;
  return `${JSON.stringify({
    version: baseline.version, manifestSha256: baseline.manifestSha256, axes: [...CELL_AXES], buckets: [...CELL_BUCKETS],
    drivingPathOracle, files, ratchetDebt: canonicalDebt(baseline.ratchetDebt ?? {}),
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
export interface ParsedCellBaseline {
  baseline?: CellBaseline;
  problems: string[];
  /** Het bestand is een geldig, canoniek versie-1-bestand. `problems` bevat dan `CELL_V1_PROBLEM` en
   *  `baseline` de emmers met `minutes: null` — uitsluitend bruikbaar voor de herpin (`=1`). */
  legacyV1?: boolean;
  /** Versie-2-bestand ZONDER `ratchetDebt`-sectie: geweigerd (`problems` = `CELL_PRE_DEBT_PROBLEM`),
   *  zonder `baseline` — geen enkele modus leest hem nog. */
  preDebt?: boolean;
}
export function parseCellBaseline(raw: string): ParsedCellBaseline {
  if (raw.length > CELL_BASELINE_MAX_CHARS) return { problems: [`baseline groter dan ${CELL_BASELINE_MAX_CHARS} tekens`] };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch (error) {
    return { problems: [`geen geldige JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }
  if (!isPlainObject(parsed)) return { problems: ['top-level is geen object'] };
  const problems: string[] = [];
  const top = Object.keys(parsed).join(',');
  const legacyV1 = parsed.version === 1;
  const preDebtTop = 'version,manifestSha256,axes,buckets,drivingPathOracle,files';
  const preDebt = !legacyV1 && top === preDebtTop;
  const wantTop = legacyV1 || preDebt ? preDebtTop : `${preDebtTop},ratchetDebt`;
  if (top !== wantTop) problems.push(`top-level sleutels ${top} ≠ ${wantTop}`);
  if (!legacyV1 && parsed.version !== CELL_BASELINE_VERSION) problems.push(`version ≠ ${CELL_BASELINE_VERSION}`);
  if (typeof parsed.manifestSha256 !== 'string' || !SHA256_PATTERN.test(parsed.manifestSha256)) problems.push('manifestSha256 is geen sha256');
  if (!isPlainObject(parsed.drivingPathOracle)) problems.push('drivingPathOracle is geen object');
  else {
    for (const [key, value] of Object.entries(parsed.drivingPathOracle)) {
      if (!CELL_KEY_PATTERN.test(key) || typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
        problems.push(`drivingPathOracle ${JSON.stringify(key.slice(0, 80))}: geen sha256-paar`);
        break;
      }
    }
    if (isPlainObject(parsed.files)
      && JSON.stringify(Object.keys(parsed.drivingPathOracle).sort(codeUnitCompare)) !== JSON.stringify(Object.keys(parsed.files).sort(codeUnitCompare))) {
      problems.push('drivingPathOracle dekt niet precies de bestandssleutels');
    }
  }
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
        const value = cells[id];
        if (legacyV1) {
          if (typeof value !== 'string' || !(CELL_BUCKETS as readonly string[]).includes(value)) {
            problems.push(`${key}/${axis}/${id}: emmer ${JSON.stringify(value)} onbekend`);
            break;
          }
          continue;
        }
        if (!isPlainObject(value) || Object.keys(value).join(',') !== 'bucket,minutes') {
          problems.push(`${key}/${axis}/${id}: cel is geen {bucket, minutes}`);
          break;
        }
        const bucket = value.bucket;
        if (typeof bucket !== 'string' || !(CELL_BUCKETS as readonly string[]).includes(bucket)) {
          problems.push(`${key}/${axis}/${id}: emmer ${JSON.stringify(bucket)} onbekend`);
          break;
        }
        if (!isValidMinutes(axis, bucket as CellBucket, value.minutes)) {
          problems.push(`${key}/${axis}/${id}: grootte ${JSON.stringify(value.minutes)} ongeldig voor ${bucket}`
            + (cellHasMagnitude(axis, bucket as CellBucket) ? ' (vereist: minuten ≥ 0, op 0,001)' : ' (vereist: null)'));
          break;
        }
      }
    }
  }
  if (problems.length > 0) return { problems };
  if (legacyV1) {
    // Canoniek is hier: dezelfde sortering (hierboven gecontroleerd) en dezelfde witruimte.
    if (`${JSON.stringify(parsed, null, 2)}\n` !== raw) {
      return { problems: ['baseline is niet canoniek geserialiseerd (herpin via OPS_XER_CELLS_WRITE=1, niet met de hand)'] };
    }
    const legacyFiles = parsed.files as Record<string, Record<string, Record<string, CellBucket>>>;
    const files: CellFiles = {};
    for (const key of Object.keys(legacyFiles)) {
      files[key] = Object.fromEntries(CELL_AXES.map(axis => [axis, Object.fromEntries(Object.entries(legacyFiles[key]![axis]!)
        .map(([id, bucket]): [string, CellValue] => [id, { bucket, minutes: null }]))]));
    }
    const baseline: CellBaseline = {
      version: CELL_BASELINE_VERSION, manifestSha256: parsed.manifestSha256 as string, axes: [...CELL_AXES], buckets: [...CELL_BUCKETS],
      drivingPathOracle: parsed.drivingPathOracle as Record<string, string>, files, ratchetDebt: {},
    };
    return { baseline, problems: [CELL_V1_PROBLEM], legacyV1: true };
  }
  if (preDebt) return { problems: [CELL_PRE_DEBT_PROBLEM], preDebt: true };
  const debtProblems = validateDebt(parsed.ratchetDebt, parsed.files as CellFiles);
  if (debtProblems.length > 0) return { problems: debtProblems };
  const baseline = parsed as unknown as CellBaseline;
  if (serializeCellBaseline(baseline) !== raw) {
    return { problems: ['baseline is niet canoniek geserialiseerd (herpin via OPS_XER_CELLS_WRITE=1, niet met de hand)'] };
  }
  return { baseline, problems };
}

/** Elke schuldregel wijst naar een bestaande sameday/diff-cel met `minutes === current`, en
 *  `0 ≤ reference < current`; alleen niet-lege niveaus (de canonieke-bytes-check doet de sortering). */
function validateDebt(debt: unknown, files: CellFiles): string[] {
  if (!isPlainObject(debt)) return ['ratchetDebt is geen object'];
  const problems: string[] = [];
  for (const [file, axes] of Object.entries(debt)) {
    if (!CELL_KEY_PATTERN.test(file) || !isPlainObject(axes) || Object.keys(axes).length === 0) {
      problems.push(`ratchetDebt ${JSON.stringify(file.slice(0, 80))}: geen niet-leeg object op een sha256`);
      continue;
    }
    for (const [axis, cells] of Object.entries(axes)) {
      if (!isPlainObject(cells) || Object.keys(cells).length === 0 || !(CELL_AXES as readonly string[]).includes(axis) || axis === 'drivingPath') {
        problems.push(`ratchetDebt ${file.slice(0, 12)}/${axis}: geen niet-leeg object op een grootte-as`);
        continue;
      }
      for (const [id, value] of Object.entries(cells)) {
        const where = `ratchetDebt ${file.slice(0, 12)}/${axis}/${id}`;
        const cell = files[file]?.[axis]?.[id];
        if (!isPlainObject(value) || Object.keys(value).join(',') !== 'reference,current') { problems.push(`${where}: geen {reference, current}`); continue; }
        const { reference, current } = value as { reference: unknown; current: unknown };
        if (!cell || !cellHasMagnitude(axis, cell.bucket)) { problems.push(`${where}: wijst niet naar een sameday/diff-cel`); continue; }
        if (!isValidMinutes(axis, cell.bucket, reference) || !isValidMinutes(axis, cell.bucket, current)) { problems.push(`${where}: minuten ongeldig`); continue; }
        if (current !== cell.minutes) problems.push(`${where}: current ${String(current)} ≠ cel ${String(cell.minutes)}`);
        if ((reference as number) >= (current as number)) problems.push(`${where}: reference ≥ current (geen schuld)`);
      }
    }
  }
  return problems;
}

export function compareCells(baseline: CellBaseline, measured: CellBaseline, measurable: CellMeasurable, exclusions?: CellExclusions): CellDelta {
  const delta: CellDelta = {
    newCells: [], worsenedCells: [], improvedCells: [], largerCells: [], smallerCells: [],
    unmeasurableCells: [], excludedCells: [], reincludedCells: [], unknownFiles: [], unmeasuredFiles: [],
  };
  for (const file of sortedKeys(measured.files)) {
    const was = hasOwn(baseline.files, file) ? baseline.files[file] : undefined;
    if (!was) { delta.unknownFiles.push(file); continue; }
    const now = measured.files[file]!;
    for (const axis of CELL_AXES) {
      const before = was[axis] ?? {};
      const after = now[axis] ?? {};
      for (const id of sortedKeys(after)) {
        const nowCell = after[id]!;
        const nowBucket = nowCell.bucket;
        const wasCell = hasOwn(before, id) ? before[id] : undefined;
        if (wasCell === undefined) {
          if (exclusions?.was(file, id) === true && !exclusions.now(file, id)) delta.reincludedCells.push({ file, axis, id, now: nowBucket });
          else delta.newCells.push({ file, axis, id, now: nowBucket });
          continue;
        }
        const wasBucket = wasCell.bucket;
        if (BUCKET_RANK[nowBucket] > BUCKET_RANK[wasBucket]) delta.worsenedCells.push({ file, axis, id, was: wasBucket, now: nowBucket });
        else if (BUCKET_RANK[nowBucket] < BUCKET_RANK[wasBucket]) {
          // Betere emmer (diff→sameday) met GROTERE minuten is rood: de emmer is een kalenderdaggrens
          // (sameday tot 1020 min, diff vanaf 840 min) en loopt niet gelijk op met de grootte; regel A
          // zegt per cel "de absolute afwijking mag niet groter worden" (orkestratorbesluit 2026-09-23).
          if (cellHasMagnitude(axis, nowBucket) && cellHasMagnitude(axis, wasBucket)
            && wasCell.minutes !== null && nowCell.minutes !== null && nowCell.minutes > wasCell.minutes) {
            delta.largerCells.push({ file, axis, id, was: wasBucket, now: nowBucket, wasMinutes: wasCell.minutes, nowMinutes: nowCell.minutes });
          } else delta.improvedCells.push({ file, axis, id, was: wasBucket, now: nowBucket });
        }
        else if (cellHasMagnitude(axis, nowBucket) && wasCell.minutes !== null && nowCell.minutes !== null) {
          // (e) Grootte-ratchet binnen dezelfde emmer. Een versie-1-baseline (minutes null) slaat dit over.
          const ref: CellRef = { file, axis, id, was: wasBucket, now: nowBucket, wasMinutes: wasCell.minutes, nowMinutes: nowCell.minutes };
          if (nowCell.minutes > wasCell.minutes) delta.largerCells.push(ref);
          else if (nowCell.minutes < wasCell.minutes) delta.smallerCells.push(ref);
        }
      }
      for (const id of sortedKeys(before)) {
        if (hasOwn(after, id)) continue;
        if (exclusions?.now(file, id) === true && !exclusions.was(file, id)) delta.excludedCells.push({ file, axis, id, was: before[id]!.bucket });
        else if (measurable(file, axis, id)) delta.improvedCells.push({ file, axis, id, was: before[id]!.bucket });
        else delta.unmeasurableCells.push({ file, axis, id, was: before[id]!.bucket });
      }
    }
  }
  for (const file of sortedKeys(baseline.files)) if (!hasOwn(measured.files, file)) delta.unmeasuredFiles.push(file);
  return delta;
}

/**
 * Soort rode regel: `hard` blokkeert elke herpin; `fileset` (een entry erbij of eraf, een ander
 * manifest) is alleen toegestaan in de corpusgroei-modus (`=corpus`), en dan uitsluitend bij een
 * gewijzigd manifest.
 */
export type RedKind = 'hard' | 'fileset';
export interface RedLine { kind: RedKind; text: string }

/** Rode regels voor de poort, met hun soort; leeg ⇒ regel A gehouden. */
export function cellGateRedLines(delta: CellDelta): RedLine[] {
  const hard = (text: string): RedLine => ({ kind: 'hard', text });
  const fileset = (text: string): RedLine => ({ kind: 'fileset', text });
  return [
    ...delta.newCells.map(cell => hard(`cel was exact, nu inexact (${cell.now}) — regel A: ${cell.file} as ${cell.axis} id ${cell.id}`)),
    ...delta.worsenedCells.map(cell => hard(`cel verslechterd ${cell.was}→${cell.now} — regel A: ${cell.file} as ${cell.axis} id ${cell.id}`)),
    ...delta.largerCells.map(cell => hard(`cel groter geworden (${cell.now}) ${cell.wasMinutes}→${cell.nowMinutes} min — regel A (grootte): ${cell.file} as ${cell.axis} id ${cell.id}`)),
    ...delta.unmeasurableCells.map(cell => hard(`cel onmeetbaar geworden (was ${cell.was}) — regel A: ${cell.file} as ${cell.axis} id ${cell.id}`)),
    ...delta.excludedCells.map(cell => fileset(`cel valt weg door een nieuwe manifestuitsluiting (was ${cell.was}): ${cell.file} as ${cell.axis} id ${cell.id}`)),
    ...delta.reincludedCells.map(cell => fileset(`cel telt weer mee na het opheffen van een manifestuitsluiting (${cell.now}): ${cell.file} as ${cell.axis} id ${cell.id}`)),
    ...delta.unknownFiles.map(file => fileset(`gemeten bestand ontbreekt in de cel-baseline: ${file}`)),
    ...delta.unmeasuredFiles.map(file => fileset(`cel-baselinebestand niet gemeten: ${file}`)),
  ];
}

export function cellGateFailures(delta: CellDelta): string[] {
  return cellGateRedLines(delta).map(line => line.text);
}

/**
 * Orakel- en manifestpinnen van de cel-baseline tegen de meting. Een gewijzigde drivingPath-
 * orakelhash van een entry die in beide staat is `hard` (het orakel is veranderd, niet het corpus);
 * een ander manifest is `fileset`.
 */
export function cellOracleRedLines(baseline: CellBaseline, measured: CellBaseline, exclusionChangedFiles?: ReadonlySet<string>): RedLine[] {
  const lines: RedLine[] = [];
  if (baseline.manifestSha256 !== measured.manifestSha256) {
    lines.push({ kind: 'fileset', text: `cel-baseline hoort bij een ander corpusmanifest (${baseline.manifestSha256.slice(0, 12)} ≠ ${measured.manifestSha256.slice(0, 12)})` });
  }
  for (const key of sortedKeys(measured.drivingPathOracle)) {
    const was = hasOwn(baseline.drivingPathOracle, key) ? baseline.drivingPathOracle[key] : undefined;
    if (was !== undefined && was !== measured.drivingPathOracle[key]) {
      // Een gewijzigde uitsluitingslijst voor dít bestand verandert de orakelset: corpusgroei, geen orakelwissel.
      if (exclusionChangedFiles?.has(key)) lines.push({ kind: 'fileset', text: `orakel drivingPath gewijzigd door een gewijzigde manifestuitsluiting: ${key}` });
      else lines.push({ kind: 'hard', text: `orakel drivingPath gewijzigd t.o.v. de cel-baseline: ${key}` });
    }
  }
  return lines;
}

/** Per as het aantal inexacte cellen, uitgesplitst per emmer. */
export function cellTotals(baseline: CellBaseline): Record<string, Record<CellBucket | 'total', number>> {
  const totals: Record<string, Record<CellBucket | 'total', number>> = Object.fromEntries(
    CELL_AXES.map(axis => [axis, { sameday: 0, diff: 0, missing: 0, total: 0 }]));
  for (const axes of Object.values(baseline.files)) {
    for (const axis of CELL_AXES) {
      for (const { bucket } of Object.values(axes[axis] ?? {})) { totals[axis]![bucket]++; totals[axis]!.total++; }
    }
  }
  return totals;
}

/**
 * Een ontbrekend cellenbestand wordt alleen met `OPS_XER_CELLS_WRITE=init` aangemaakt; `=1` herpint
 * uitsluitend een bestaand bestand. Zo kan een verdwenen baseline (verkeerde checkout, weggegooid
 * bestand) nooit stil door een gewone herpin opnieuw worden uitgevonden, en maakt `init` nooit een
 * bestaand bestand kapot.
 */
export function cellWriteModeProblem(mode: string | undefined, baselineExists: boolean): string | undefined {
  if (mode === undefined || mode === '') return undefined;
  if (mode !== '1' && mode !== 'init' && mode !== 'corpus') return `OPS_XER_CELLS_WRITE=${mode.slice(0, 20)} onbekend (verwacht 1, corpus of init)`;
  if (mode === 'corpus' && !baselineExists) return `${CELL_BASELINE_FILE} ontbreekt; =corpus werkt alleen op een bestaand bestand (gebruik init)`;
  if (mode === '1' && !baselineExists) {
    return `${CELL_BASELINE_FILE} ontbreekt; OPS_XER_CELLS_WRITE=1 herpint alleen een bestaand bestand — `
      + 'maak een nieuwe baseline bewust aan met OPS_XER_CELLS_WRITE=init';
  }
  if (mode === 'init' && baselineExists) {
    return `${CELL_BASELINE_FILE} bestaat al; OPS_XER_CELLS_WRITE=init maakt alleen een ontbrekend bestand aan — `
      + 'herpin een bestaand bestand met OPS_XER_CELLS_WRITE=1';
  }
  return undefined;
}

/**
 * Herpinnen alleen zonder rode cel: geweigerd bij (a), (b), (d) of (e) groter. Nieuwe bestanden (corpusgroei) mogen
 * erbij — zij hadden geen gepinde exacte cel — en niet meer gemeten bestanden vallen weg; beide
 * staan in de teruggegeven delta. Wat geschreven wordt is precies de meting.
 */
export function planCellRepin(
  baseline: CellBaseline | undefined,
  measured: CellBaseline,
  measurable: CellMeasurable,
  exclusions?: CellExclusions,
): { allowed: true; delta: CellDelta; debt: CellDebt } | { allowed: false; reasons: string[]; delta: CellDelta } {
  const empty: CellBaseline = {
    version: CELL_BASELINE_VERSION, manifestSha256: measured.manifestSha256, axes: [...CELL_AXES], buckets: [...CELL_BUCKETS],
    drivingPathOracle: {}, files: {}, ratchetDebt: {},
  };
  // Uitgesloten of weer meetellende cellen (manifestuitsluiting) zijn geen reden: de poort laat ze
  // alleen in de corpusgroei-modus toe (`fileset`), en dan schrijft de herpin precies de meting.
  const delta = compareCells(baseline ?? empty, measured, measurable, exclusions);
  const reasons = [
    ...delta.newCells.map(cell => `nieuwe inexacte cel ${cell.file.slice(0, 12)} ${cell.axis} ${cell.id}`),
    ...delta.worsenedCells.map(cell => `verslechterde cel ${cell.file.slice(0, 12)} ${cell.axis} ${cell.id} ${cell.was}→${cell.now}`),
    ...delta.largerCells.map(cell => `grotere cel ${cell.file.slice(0, 12)} ${cell.axis} ${cell.id} ${cell.wasMinutes}→${cell.nowMinutes} min`),
    ...delta.unmeasurableCells.map(cell => `onmeetbaar geworden cel ${cell.file.slice(0, 12)} ${cell.axis} ${cell.id}`),
  ];
  if (reasons.length > 0) return { allowed: false, reasons, delta };
  // Schuld kan hier alleen krimpen: `carryRatchetDebt` voegt nooit een regel toe.
  return { allowed: true, delta, debt: carryRatchetDebt(baseline?.ratchetDebt ?? {}, measured) };
}

/** De schuldset als gesorteerde regels `[bestand, as, id, reference]` — `current` hoort er bewust niet
 *  bij (die daalt mee bij een verkleinde cel; de set en de referenties niet). */
export function debtEntries(debt: CellDebt): Array<[string, string, string, number]> {
  const out: Array<[string, string, string, number]> = [];
  for (const file of sortedKeys(debt)) {
    for (const axis of sortedKeys(debt[file]!)) {
      for (const id of sortedKeys(debt[file]![axis]!)) out.push([file, axis, id, debt[file]![axis]![id]!.reference]);
    }
  }
  return out;
}

/** SHA-256 over `debtEntries` (JSON): gepind in `check-fidelity-cells-gate.ts`. */
export function debtDigest(debt: CellDebt): string {
  return createHash('sha256').update(JSON.stringify(debtEntries(debt))).digest('hex');
}

/** SHA-256 over alle grootten van het cellenbestand: gesorteerde regels `[bestand, as, id, minutes]`
 *  voor elke cel met een grootte (sameday/diff op de zes assen). Staat als `cellMinutesSha256` in de
 *  v2-envelop; een met de hand gewijzigde grootte maakt de twee ongelijk. */
export function cellMinutesDigest(baseline: CellBaseline): string {
  const rows: Array<[string, string, string, number]> = [];
  for (const file of sortedKeys(baseline.files)) {
    for (const axis of CELL_AXES) {
      const cells = baseline.files[file]![axis] ?? {};
      for (const id of sortedKeys(cells)) {
        const minutes = cells[id]!.minutes;
        if (minutes !== null) rows.push([file, axis, id, minutes]);
      }
    }
  }
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

/** Markeringen van het gegenereerde schuldpin-blok in `check-fidelity-cells-gate.ts`. */
export const DEBT_PIN_BEGIN = '// BEGIN ratchet-schuldpin — herschreven door OPS_XER_CELLS_WRITE bij een daling; nooit met de hand';
export const DEBT_PIN_END = '// END ratchet-schuldpin';

/** Het schuldpin-blok (markeringen, leesbare lijst, digest-constante) voor een schuldset. */
export function renderDebtPinBlock(debt: CellDebt): string {
  const entries = debtEntries(debt);
  return [
    DEBT_PIN_BEGIN,
    `// ${entries.length} schuldcel(len): bestand (12) · as · id · reference (min)`,
    ...entries.map(([file, axis, id, reference]) => `//   ${file.slice(0, 12)} ${axis} ${id} ${reference}`),
    `const EXPECTED_DEBT_SHA256 = '${debtDigest(debt)}';`,
    DEBT_PIN_END,
  ].join('\n');
}

/** Het schuldpin-blok uit een bronbestand, of `undefined` als de markeringen niet precies één keer staan. */
export function extractDebtPinBlock(source: string): string | undefined {
  const begin = source.indexOf(DEBT_PIN_BEGIN);
  const end = source.indexOf(DEBT_PIN_END);
  if (begin < 0 || end < begin || source.indexOf(DEBT_PIN_BEGIN, begin + 1) >= 0 || source.indexOf(DEBT_PIN_END, end + 1) >= 0) return undefined;
  return source.slice(begin, end + DEBT_PIN_END.length);
}

/**
 * Herschrijft het schuldpin-blok van `oldDebt` naar `newDebt`. Weigert als het blok in de bron niet
 * exact bij `oldDebt` hoort (pin en cellenbestand liepen al uit de pas) of als `newDebt` een regel
 * bevat die niet met dezelfde reference in `oldDebt` stond (schuld kan alleen krimpen).
 */
export function rewriteDebtPin(source: string, oldDebt: CellDebt, newDebt: CellDebt): { text: string; removed: Array<[string, string, string, number]> } | { error: string } {
  const block = extractDebtPinBlock(source);
  if (block === undefined) return { error: 'schuldpin-blok niet (precies één keer) gevonden' };
  if (block !== renderDebtPinBlock(oldDebt)) return { error: 'schuldpin-blok hoort niet bij de gepinde ratchetDebt (met de hand bewerkt?)' };
  const before = new Set(debtEntries(oldDebt).map(entry => JSON.stringify(entry)));
  const after = debtEntries(newDebt);
  if (after.some(entry => !before.has(JSON.stringify(entry)))) return { error: 'nieuwe schuldset bevat een regel die niet in de gepinde stond (schuld kan alleen krimpen)' };
  const kept = new Set(after.map(entry => JSON.stringify(entry)));
  const removed = debtEntries(oldDebt).filter(entry => !kept.has(JSON.stringify(entry)));
  return { text: source.replace(block, () => renderDebtPinBlock(newDebt)), removed };
}

/** Rode regel als het cellenbestand niet bij de minuten-digest van v2 hoort, anders leeg. */
export function cellMinutesProblems(baseline: CellBaseline, v2CellMinutesSha256: string): string[] {
  const got = cellMinutesDigest(baseline);
  return got === v2CellMinutesSha256 ? [] : [
    `${CELL_BASELINE_FILE}: minuten-digest ${got.slice(0, 12)} ≠ cellMinutesSha256 in v2 ${v2CellMinutesSha256.slice(0, 12)} — `
      + 'grootten met de hand bewerkt of maar één van beide bestanden herpind; zet ze terug uit versiebeheer of herpin via '
      + 'OPS_XER_CELLS_WRITE (scripts/README.md)',
  ];
}

/** Eén machineleesbare regel voor `scripts/measure-profiles.mjs`. */
export function cellDeltaLine(profile: string, delta: CellDelta, measured: CellBaseline): string {
  const total = Object.values(cellTotals(measured)).reduce((sum, axis) => sum + axis.total, 0);
  return `CELLDELTA ${profile} nieuw=${delta.newCells.length} verslechterd=${delta.worsenedCells.length} `
    + `groter=${delta.largerCells.length} verbeterd=${delta.improvedCells.length} kleiner=${delta.smallerCells.length} `
    + `onmeetbaar=${delta.unmeasurableCells.length} onbekend=${delta.unknownFiles.length} `
    + `ongemeten=${delta.unmeasuredFiles.length} schuld=${debtCount(measured.ratchetDebt ?? {})} totaal=${total}`;
}
