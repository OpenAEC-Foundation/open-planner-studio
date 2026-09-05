/**
 * De baseline-vorm-poort (X0/X1, XER-etappeplan §3/§6): X0 legde het lege harness-skelet vast;
 * X1 vult `xer-fidelity-baseline.json` met de onafhankelijk gemeten corpuspins. Dit bestand bewaakt
 * de VORM daarvan zonder de XER-parser of corpuslus te dupliceren.
 *
 * TWEE LAGEN, zelfde truc als `check-ext-contract.ts`:
 *  (a) COMPILE-TIME — `keys<T>()` klonkt de sleutellijsten vast aan `xerFidelityTypes.ts`'s
 *      interfaces. Een nieuw (ook optioneel) veld op `XerFidelityBaselineEntry`/`XerFidelityCounters`/
 *      `XerFidelityAxisCounts` zonder het hier te registreren geeft een COMPILEERFOUT — dat is het
 *      "veld uit de typelijst verwijderen ⇒ compile-fout"-mutatiebewijs uit de X0-acceptatie.
 *  (b) RUNTIME — `validateBaseline()` toetst een willekeurig JSON-blob TEGEN diezelfde sleutellijsten
 *      (type, aanwezigheid, onverwachte sleutels, en de interne `deviations <= measurable`-invariant
 *      per as). Dit is de laag die "de baseline-vorm muteren ⇒ de schema-check ROOD" bewijst: een
 *      hernoemde/weggehaalde sleutel in een RUW JSON-object (buiten het TS-typesysteem om, precies
 *      zoals een met de hand bewerkt of ooit-verkeerd-geschreven baselinebestand dat zou doen) wordt
 *      hier gevangen, niet pas bij het eerste gebruik door X1.
 *
 * Draait ALTIJD (geen corpus nodig) — dit is pure structuurbewaking, geen corpusmeting.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type XerFidelityAxisCounts, type XerFidelityCounters, type XerFidelityBaselineEntry,
  type XerFidelityBaseline, type XerScannerPrecisionFacts,
  emptyAxisCounts, emptyCounters, createEmptyXerFidelityBaseline,
} from './xerFidelityTypes';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const EXPECTED_BASELINE_KEYS = [
  '0611f9054a4b5663', '0fa5172162fbd689', '146e4c8659bad066', '1ba69d297ee9a5c6',
  '1ba8cf1885491db3', '1d7901d68cc7063b', '2bc12241c3f8ee5b', '2c1dce175b9f0781',
  '467ab0eb0885c4a7', '49aea658c963a005', '4d8bce790a93b9bc', '53f5cdbeb3fbd9c6',
  '55b7e4463dcd36ba', '568c19375b4e0d67', '5d71eac4e70b0d95', '68ce5f0bb2b534d5',
  '78325fb6445d22f5', '790b90fda837bad3', '79f6fb43bb391ed6', '816e01738f496787',
  '9590c4cdc4efa69a', '9679599df9108bd3', '97058f720a70f623', 'a132f8c7ebb070d2',
  'a2ef7b35c00d8cf8', 'a2f3b2469e26f199', 'a7fc367eab6c904e', 'ac4b9d677133c6ed',
  'ad92ce52ba95b275', 'b7ef6d85acfedda1', 'b9547eb91c30af17', 'c872c9e704797d82',
  'deabc76347eaef15', 'def489b2a803af9f',
] as const;
const EXPECTED_MEASURABLE = {
  es: 13_931, ef: 13_937, ls: 13_822, lf: 13_813, tf: 13_677, ff: 13_322,
} as const;
const EXPECTED_MANIFEST_SHA256 = '6defbc4b4a71500565e5847750662060d9baca983952098dd1b334ac81d55786';
const EXPECTED_BASELINE_SHA256 = 'a7075bd27c73cecae71403bc9b06e8ef53707b756049598c60f125dec0c28b29';

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── (a) Sleutellijsten, compile-time vastgeklonken aan xerFidelityTypes.ts — zelfde patroon als
// check-ext-contract.ts's `keys<T>()`. ──────────────────────────────────────────────────────────
function keys<T>() {
  return <K extends readonly (keyof Required<T>)[]>(
    lijst: K & ([keyof Required<T>] extends [K[number]] ? unknown : ['mist:', Exclude<keyof Required<T>, K[number]>]),
  ): readonly (keyof Required<T>)[] => lijst;
}

const AXIS_COUNTS_KEYS = keys<XerFidelityAxisCounts>()(['deviations', 'measurable'] as const);
const COUNTERS_KEYS = keys<XerFidelityCounters>()(['es', 'ef', 'ls', 'lf', 'tf', 'ff'] as const);
const ENTRY_KEYS = keys<XerFidelityBaselineEntry>()([
  'label', 'tasks', 'projects', 'counters', 'precision', 'schemaFingerprint', 'reason',
] as const);
// Optionele subset — plain, TYPEGETOETST tegen `keyof`, maar bewust NIET zelf compile-volledig (dat
// zou de required/optional-scheiding zelf weer dupliceren). REQUIRED wordt hieronder AFGELEID als
// "alles in ENTRY_KEYS min dit" — dus een nieuw veld dat je vergeet hier te noemen valt automatisch
// in REQUIRED, wat de striktere (veiligere) kant is voor een niet-geclassificeerd veld.
const OPTIONAL_ENTRY_KEYS: readonly (keyof XerFidelityBaselineEntry)[] = ['precision', 'schemaFingerprint', 'reason'];
const REQUIRED_ENTRY_KEYS = ENTRY_KEYS.filter(k => !OPTIONAL_ENTRY_KEYS.includes(k));

// ── (b) Runtime-validator ────────────────────────────────────────────────────────────────────
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isNonNegNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function validateAxisCounts(v: unknown, path: string, problems: string[]): void {
  if (!isPlainObject(v)) { problems.push(`${path}: geen object`); return; }
  for (const k of AXIS_COUNTS_KEYS) {
    if (!(k in v)) { problems.push(`${path}.${k}: ontbreekt`); continue; }
    if (!isNonNegNumber(v[k])) problems.push(`${path}.${k}: geen niet-negatief getal (kreeg ${JSON.stringify(v[k])})`);
  }
  for (const k of Object.keys(v)) {
    if (!(AXIS_COUNTS_KEYS as readonly string[]).includes(k)) problems.push(`${path}.${k}: onverwachte sleutel`);
  }
  const deviations = v.deviations;
  const measurable = v.measurable;
  if (isNonNegNumber(deviations) && isNonNegNumber(measurable) && deviations > measurable) {
    problems.push(`${path}: deviations (${deviations}) > measurable (${measurable})`);
  }
}

function validateCounters(v: unknown, path: string, problems: string[]): void {
  if (!isPlainObject(v)) { problems.push(`${path}: geen object`); return; }
  for (const k of COUNTERS_KEYS) {
    if (!(k in v)) { problems.push(`${path}.${k}: ontbreekt`); continue; }
    validateAxisCounts(v[k], `${path}.${k}`, problems);
  }
  for (const k of Object.keys(v)) {
    if (!(COUNTERS_KEYS as readonly string[]).includes(k)) problems.push(`${path}.${k}: onverwachte sleutel`);
  }
}

function validatePrecision(v: unknown, path: string, problems: string[]): void {
  if (!isPlainObject(v)) { problems.push(`${path}: geen object`); return; }
  const expected = ['dateSecondCells', 'dateNonZeroSubminuteCells', 'floatFractionalMinuteCells'] as const satisfies readonly (keyof XerScannerPrecisionFacts)[];
  for (const key of expected) {
    const block = v[key];
    if (!isPlainObject(block)) { problems.push(`${path}.${key}: ontbreekt of geen object`); continue; }
    const axes = key === 'floatFractionalMinuteCells' ? ['tf', 'ff'] : ['es', 'ef', 'ls', 'lf'];
    for (const axis of axes) {
      if (!isNonNegNumber(block[axis])) problems.push(`${path}.${key}.${axis}: geen niet-negatief getal`);
    }
  }
}

function validateEntry(v: unknown, path: string, problems: string[]): void {
  if (!isPlainObject(v)) { problems.push(`${path}: geen object`); return; }
  for (const k of REQUIRED_ENTRY_KEYS) {
    if (!(k in v)) problems.push(`${path}.${String(k)}: ontbreekt (verplicht)`);
  }
  if ('label' in v && typeof v.label !== 'string') problems.push(`${path}.label: geen string`);
  if ('tasks' in v && !isNonNegNumber(v.tasks)) problems.push(`${path}.tasks: geen niet-negatief getal`);
  if ('projects' in v && !isNonNegNumber(v.projects)) problems.push(`${path}.projects: geen niet-negatief getal`);
  if ('counters' in v) validateCounters(v.counters, `${path}.counters`, problems);
  if ('precision' in v) validatePrecision(v.precision, `${path}.precision`, problems);
  if ('schemaFingerprint' in v && typeof v.schemaFingerprint !== 'string') problems.push(`${path}.schemaFingerprint: geen string`);
  if ('reason' in v && typeof v.reason !== 'string') problems.push(`${path}.reason: geen string`);
  for (const k of Object.keys(v)) {
    if (!(ENTRY_KEYS as readonly string[]).includes(k)) problems.push(`${path}.${k}: onverwachte sleutel`);
  }
}

function validateBaseline(v: unknown): string[] {
  const problems: string[] = [];
  if (!isPlainObject(v)) { problems.push('root: geen object'); return problems; }
  for (const k of Object.keys(v)) {
    if (k !== 'files') problems.push(`root.${k}: onverwachte sleutel`);
  }
  if (!('files' in v) || !isPlainObject(v.files)) { problems.push('files: ontbreekt of geen object'); return problems; }
  for (const [hash, entry] of Object.entries(v.files)) {
    validateEntry(entry, `files["${hash}"]`, problems);
  }
  return problems;
}

// ── 1. De committe X1-baseline is gevuld en welgevormd ─────────────────────────────────────────
{
  const raw = readFileSync(join(HERE, 'xer-fidelity-baseline.json'), 'utf-8');
  eq('1a0 volledige corpusloze baseline-inhoud is exact gepind',
    createHash('sha256').update(raw).digest('hex'), EXPECTED_BASELINE_SHA256);
  const parsed: unknown = JSON.parse(raw);
  const problems = validateBaseline(parsed);
  truthy(`1 xer-fidelity-baseline.json is welgevormd (${problems.join('; ')})`, problems.length === 0);
  eq('1a corpusloze CI pint de exacte 34-entryset',
    isPlainObject(parsed) && isPlainObject(parsed.files) ? Object.keys(parsed.files).sort() : [],
    EXPECTED_BASELINE_KEYS);
  truthy('1b elke X1-entry draagt een niet-lege schemaFingerprint',
    isPlainObject(parsed) && isPlainObject(parsed.files)
      && Object.values(parsed.files).every(entry => isPlainObject(entry)
        && typeof entry.schemaFingerprint === 'string' && entry.schemaFingerprint.length > 0));
  if (isPlainObject(parsed) && isPlainObject(parsed.files)) {
    for (const axis of COUNTERS_KEYS) {
      const measurable = Object.values(parsed.files).reduce((sum: number, entry) => {
        if (!isPlainObject(entry) || !isPlainObject(entry.counters)
          || !isPlainObject(entry.counters[axis])) return sum;
        const value = entry.counters[axis].measurable;
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
      eq(`1c corpusloze CI pint totaal meetbaar voor ${axis}`, measurable, EXPECTED_MEASURABLE[axis]);
    }
    truthy('1d corpusloze nulpoort eist nul afwijkingen op elke entry/as',
      Object.values(parsed.files).every(entry => {
        if (!isPlainObject(entry) || !isPlainObject(entry.counters)) return false;
        const counters = entry.counters;
        return COUNTERS_KEYS.every(axis => {
          const value = counters[axis];
          return isPlainObject(value) && value.deviations === 0;
        });
      }));
    truthy('1e corpusloze nulpoort verbiedt reason-pins',
      Object.values(parsed.files).every(entry => isPlainObject(entry) && !('reason' in entry)));
  }
}

// De manifesthash maakt de 93 relatieve paden, volledige bytehashes, herkomstklassen en expliciete
// inclusie-/uitsluitingsbesluiten zelfstandig CI-data. Een corpusmount verifieert die pins opnieuw
// tegen de bytes; zonder mount kan de populatie niet ongemerkt worden verkleind of omgeboekt.
{
  const raw = readFileSync(join(HERE, 'xer-corpus-manifest.json'));
  eq('1f openbaar corpusmanifest is corpusloos exact gepind',
    createHash('sha256').update(raw).digest('hex'), EXPECTED_MANIFEST_SHA256);
  const manifest = JSON.parse(raw.toString('utf-8')) as unknown;
  truthy('1g manifest bevat exact 93 geclassificeerde bestanden', isPlainObject(manifest)
    && isPlainObject(manifest.files) && Object.keys(manifest.files).length === 93);
  if (isPlainObject(manifest) && isPlainObject(manifest.files)) {
    const entries = Object.entries(manifest.files);
    eq('1h manifestselectie bevat 45 herkomstgeschikte orakelbestanden',
      entries.filter(([, entry]) => isPlainObject(entry) && entry.included === true).length, 45);
    eq('1i manifest sluit 48 fixtures/pseudo-/invoerbestanden met reden uit',
      entries.filter(([, entry]) => isPlainObject(entry) && entry.included === false
        && typeof entry.exclusionReason === 'string' && entry.exclusionReason.length > 0).length, 48);
    truthy('1j cases-import.xer is op engine-input-herkomst uitgesloten',
      isPlainObject(manifest.files['cpp-cpm-engine/validation/p6-comparison/cases-import.xer'])
        && manifest.files['cpp-cpm-engine/validation/p6-comparison/cases-import.xer'].role === 'engine-input'
        && manifest.files['cpp-cpm-engine/validation/p6-comparison/cases-import.xer'].included === false);
  }
}

// ── 2. Het X0-harness-skelet blijft een geldige lege bouwsteen ─────────────────────────────────
{
  const built: XerFidelityBaseline = createEmptyXerFidelityBaseline();
  const problems = validateBaseline(built);
  truthy(`2 createEmptyXerFidelityBaseline() is welgevormd (${problems.join('; ')})`, problems.length === 0);
  eq('2a createEmptyXerFidelityBaseline() blijft leeg', built, { files: {} });
}

// ── 3. emptyAxisCounts()/emptyCounters() zijn zelf welgevormde bouwstenen ───────────────────────
{
  const axis = emptyAxisCounts();
  const axisProblems: string[] = [];
  validateAxisCounts(axis, 'axis', axisProblems);
  truthy(`3 emptyAxisCounts() is welgevormd (${axisProblems.join('; ')})`, axisProblems.length === 0);
  eq('3a emptyAxisCounts() === {deviations:0, measurable:0}', axis, { deviations: 0, measurable: 0 });

  const counters = emptyCounters();
  const counterProblems: string[] = [];
  validateCounters(counters, 'counters', counterProblems);
  truthy(`3b emptyCounters() is welgevormd (${counterProblems.join('; ')})`, counterProblems.length === 0);
  for (const axisKey of COUNTERS_KEYS) {
    eq(`3c emptyCounters().${axisKey} === nul`, counters[axisKey], { deviations: 0, measurable: 0 });
  }
}

// ── 4. Een VOLLEDIG gevulde entry (élk optioneel veld gezet) valideert schoon ───────────────────
{
  const sample: XerFidelityBaselineEntry = {
    label: 'crawl-xer/p6diff-baseline.xer',
    tasks: 8,
    projects: 1,
    counters: {
      es: { deviations: 0, measurable: 8 }, ef: { deviations: 0, measurable: 8 },
      ls: { deviations: 0, measurable: 8 }, lf: { deviations: 0, measurable: 8 },
      tf: { deviations: 0, measurable: 8 }, ff: { deviations: 0, measurable: 8 },
    },
    schemaFingerprint: 'proj1|t1,t2,t3',
    reason: 'voorbeeldentry — X0-schema-getuige, geen echte meting',
  };
  const problems: string[] = [];
  validateEntry(sample, 'sample', problems);
  truthy(`4 een volledig gevulde entry valideert schoon (${problems.join('; ')})`, problems.length === 0);
}

// ── 5. Negatieve gevallen — de validator moet ECHT iets afkeuren, geen "altijd waar"-stub ───────
{
  const missingLabel = { tasks: 1, projects: 1, counters: emptyCounters() };
  const p1: string[] = [];
  validateEntry(missingLabel, 'x', p1);
  truthy('5 ontbrekend verplicht veld (label) wordt geweigerd', p1.length > 0);

  const wrongType = { label: 'x', tasks: 'acht', projects: 1, counters: emptyCounters() };
  const p2: string[] = [];
  validateEntry(wrongType, 'x', p2);
  truthy('5a verkeerd type (tasks als string) wordt geweigerd', p2.length > 0);

  const extraKey = { label: 'x', tasks: 1, projects: 1, counters: emptyCounters(), onbekend: true };
  const p3: string[] = [];
  validateEntry(extraKey, 'x', p3);
  truthy('5b een onverwachte sleutel wordt geweigerd', p3.length > 0);

  // De kern van "baseline-vorm muteren ⇒ schema-check ROOD" — een RUW object dat `deviations`
  // hernoemt naar `dev` (zoals een met de hand kapotgemaakt of ooit-verkeerd-geschreven
  // baselinebestand dat zou doen) moet de validator laten struikelen.
  const renamedAxisField = {
    label: 'x', tasks: 1, projects: 1,
    counters: {
      es: { dev: 0, measurable: 1 }, ef: emptyAxisCounts(), ls: emptyAxisCounts(),
      lf: emptyAxisCounts(), tf: emptyAxisCounts(), ff: emptyAxisCounts(),
    },
  };
  const p4: string[] = [];
  validateEntry(renamedAxisField, 'x', p4);
  truthy('5c hernoemd as-veld (deviations -> dev) wordt geweigerd', p4.length > 0);

  const inconsistentAxis = {
    label: 'x', tasks: 1, projects: 1,
    counters: {
      es: { deviations: 5, measurable: 2 }, ef: emptyAxisCounts(), ls: emptyAxisCounts(),
      lf: emptyAxisCounts(), tf: emptyAxisCounts(), ff: emptyAxisCounts(),
    },
  };
  const p5: string[] = [];
  validateEntry(inconsistentAxis, 'x', p5);
  truthy('5d deviations > measurable wordt geweigerd (interne invariant)', p5.length > 0);

  const notAnObject = validateBaseline([1, 2, 3]);
  truthy('5e een array i.p.v. een object wordt geweigerd', notAnObject.length > 0);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: xer-fidelity-baseline-schema — ${checks} checks groen`);
} else {
  console.log(`XX xer-fidelity-baseline-schema — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
