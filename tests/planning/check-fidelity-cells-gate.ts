// Regel A als poort (rekenprofielen-spec §2 besluit 5, §5) — corpusloos deel.
//
// 1. Mutatiebewijs op synthetische metingen: de pure poortlogica uit `fidelityCells.ts` geeft rood
//    op één cel die exact was en inexact wordt, rood op één verslechterde emmer, groen ("te
//    herpinnen") op één verbeterde of verdwenen cel, en weigert een herpin met een rode cel.
//    `check-xer-product-fidelity-x12.ts` roept dezelfde functies aan; dat die bedrading op het
//    corpus werkt is hier NIET bewezen (daarvoor is `OPS_XER_CORPUS` nodig), alleen de logica.
// 2. De gecommitte `xer-product-fidelity-cells.json` is geldig, canoniek en in de pas met
//    `xer-product-fidelity-baseline-v2.json`: per entry, per as en per emmer is het aantal cellen
//    gelijk aan de gepinde telling. Zo kan de cel-baseline op geen enkele machine stil uit de pas
//    lopen met de tellingen.
// 3. Grootte-ratchet (versie 2, eigenaarsbesluit 2026-09-23): de versie is gepind, elke
//    sameday/diff-cel op de zes X12-assen draagt een grootte in minuten (missing en drivingPath
//    `null`), een versie-1-bestand wordt geweigerd met verwijzing naar het recept, en een cel die
//    binnen dezelfde emmer groter wordt is rood (`groter`), kleiner is "verbeterd-grootte".
// 4. Ratchet-schuld (orkestratorbesluit 2026-09-23): de schuldSET van het gecommitte bestand
//    (bestand, as, id, reference) is gepind als digest (`EXPECTED_DEBT_SHA256`, gegenereerd blok
//    hieronder), zodat de lijst niet ongemerkt geruild, verlengd of ingekort kan worden; een schuldcel
//    die verder groeit dan `current` is rood; daalt hij tot ≤ `reference` (of wordt hij exact), dan
//    vervalt de schuld en herpint `OPS_XER_CELLS_WRITE` het blok mee; daalt hij maar blijft hij boven
//    `reference`, dan schuift `current` mee. Er is geen route meer die schuld aanmaakt: een bestand
//    zonder schuldsectie wordt geweigerd, en de lezer weigert een schuldregel die niet klopt.
// 5. Minuten-digest (critreview integratie-eindstand 2026-09-23): de grootten van het cellenbestand
//    horen bij `cellMinutesSha256` in de v2-envelop; een met de hand opgerekte grootte is rood.
// Assen: de zes X12-assen plus `drivingPath` als zevende poort-as (cel-ratchet; niet in het
// zesassige nuldoel-getal) — alle zeven onder dezelfde poortregels.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCellBaseline, CELL_AXES, CELL_BASELINE_VERSION, CELL_V1_PROBLEM, cellDeltaLine, cellHasMagnitude, cellMagnitude, cellOracleRedLines,
  type CellMeta, CELL_BASELINE_FILE, CELL_BUCKETS, cellGateFailures, cellWriteModeProblem, compareCells,
  parseCellBaseline, planCellRepin, serializeCellBaseline, tryBuildCellBaseline, type CellBaseline, type MeasuredCell,
  carryRatchetDebt, debtCount, CELL_PRE_DEBT_PROBLEM, debtDigest, cellMinutesDigest, cellMinutesProblems,
  renderDebtPinBlock, extractDebtPinBlock, rewriteDebtPin, type CellDebt,
} from './fidelityCells';

/** Ratchet-schuld van de eenmalige overgang bij de merge van de grootte-ratchet (2026-09-23): 14 cellen in
 *  Roads_Project_TEC (plan XER §9 "Ratchet-schuld 2026-09-23"). Mag alleen KRIMPEN. Het blok hieronder
 *  wordt bij een daling door `OPS_XER_CELLS_WRITE` herschreven (digest + lijst); zet er dan met de hand
 *  een HERPIN-regel bij die noemt welke cel ontschuld is (de schrijfmodus print ze).
 *  HERPIN 2026-09-23 (fixronde critreview integratie-eindstand): telpin 14 vervangen door een digest over
 *  de schuldset; de eenmalige init-route (`OPS_XER_CELLS_DEBT_INIT`) is verwijderd.
 *  HERPIN 2026-09-23 (X12 brok 6, merge met de etappebranch; late kant van C5/C6 plus C9): alle 14
 *  ontschuld, nu exact — Roads_Project_TEC (a2ef7b35c00d) project 1346: A15112 (85462) ls/lf, B2921
 *  (86905) ls/lf, B2922 (86912) ls/lf; tf van OCEC10851 (86945), OCEC11701 (86962), OCEC20101 (87055),
 *  OCEC11741/11751/11762/11771/12121 (87145–87149). Schuldset leeg. */
// BEGIN ratchet-schuldpin — herschreven door OPS_XER_CELLS_WRITE bij een daling; nooit met de hand
// 0 schuldcel(len): bestand (12) · as · id · reference (min)
const EXPECTED_DEBT_SHA256 = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
// END ratchet-schuldpin
import { validateProductBaselineV2 } from './xerProductBaselineV2';
import { XER_FIDELITY_AXES } from './xerGroundTruth';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

const F1 = 'a'.repeat(64);
const F2 = 'b'.repeat(64);
const MANIFEST = 'c'.repeat(64);
function metaFor(keys: Iterable<string>, manifestSha256 = MANIFEST, oracle = 'd'): CellMeta {
  return { manifestSha256, drivingPathOracle: new Map([...keys].map(key => [key, oracle.repeat(64)])) };
}
function measure(f1: MeasuredCell[], f2: MeasuredCell[] | null = []): CellBaseline {
  const map = new Map<string, MeasuredCell[]>([[F1, f1]]);
  if (f2) map.set(F2, f2);
  return buildCellBaseline(map, metaFor(map.keys()));
}
const BASE: MeasuredCell[] = [
  { axis: 'es', id: '1/20', bucket: 'sameday', minutes: 60 },
  { axis: 'es', id: '1/10', bucket: 'diff', minutes: 1440 },
  { axis: 'tf', id: '1/10', bucket: 'diff', minutes: 480 },
  { axis: 'lf', id: '2/7', bucket: 'missing', minutes: null },
];
/** In de synthetische meting is elke cel meetbaar, behalve wat een test expliciet blind maakt. */
const MEASURABLE = () => true;
const with_ = (change: (cells: MeasuredCell[]) => MeasuredCell[]) => measure(change(BASE.map(cell => ({ ...cell }))));

// ── 1. Mutatiebewijs ─────────────────────────────────────────────────────────────────────────
{
  const baseline = measure(BASE);
  eq('build vult elke as, ook lege', Object.keys(baseline.files[F2]!), [...CELL_AXES]);
  eq('build sorteert ids binnen een as', Object.keys(baseline.files[F1]!.es!), ['1/10', '1/20']);

  eq('ongewijzigde meting: geen rode regels', cellGateFailures(compareCells(baseline, measure(BASE), MEASURABLE)), []);
  eq('ongewijzigde meting: niets te herpinnen', compareCells(baseline, measure(BASE), MEASURABLE).improvedCells.length, 0);

  // (a) één cel die exact was (1/30 op ef) wordt inexact ⇒ rood met bestand/as/id.
  const newCell = compareCells(baseline, with_(cells => [...cells, { axis: 'ef', id: '1/30', bucket: 'sameday', minutes: 30 }]), MEASURABLE);
  eq('(a) één toegevoegde inexacte cel ⇒ precies die cel rood', cellGateFailures(newCell),
    [`cel was exact, nu inexact (sameday) — regel A: ${F1} as ef id 1/30`]);

  // (b) verslechterde emmer — volgorde exact < sameday < diff < missing (spec §5), elke stap naar
  //     rechts is rood: sameday→diff, diff→missing en sameday→missing.
  const worse = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/20' ? { ...cell, bucket: 'diff', minutes: 1500 } : cell)), MEASURABLE);
  eq('(b) sameday→diff ⇒ rood', cellGateFailures(worse), [`cel verslechterd sameday→diff — regel A: ${F1} as es id 1/20`]);
  const toMissing = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'tf' ? { ...cell, bucket: 'missing', minutes: null } : cell)), MEASURABLE);
  eq('(b) diff→missing ⇒ rood', cellGateFailures(toMissing).length, 1);
  const samedayToMissing = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/20' ? { ...cell, bucket: 'missing', minutes: null } : cell)), MEASURABLE);
  eq('(b) sameday→missing ⇒ rood', cellGateFailures(samedayToMissing),
    [`cel verslechterd sameday→missing — regel A: ${F1} as es id 1/20`]);

  // Per cel, niet per som: één cel beter en één cel slechter op dezelfde as blijft rood.
  const swapped = compareCells(baseline, with_(cells => [
    ...cells.filter(cell => !(cell.axis === 'es' && cell.id === '1/20')),
    { axis: 'es', id: '1/30', bucket: 'sameday', minutes: 60 },
  ]), MEASURABLE);
  eq('gelijke som, andere cel ⇒ toch rood', cellGateFailures(swapped).length, 1);

  // (c) verbetering: cel exact geworden, of diff→sameday ⇒ groen, te herpinnen.
  const resolved = compareCells(baseline, with_(cells => cells.filter(cell => cell.axis !== 'lf')), MEASURABLE);
  eq('(c) één weggehaalde cel ⇒ geen rode regels', cellGateFailures(resolved), []);
  eq('(c) één weggehaalde cel ⇒ één te herpinnen', resolved.improvedCells, [{ file: F1, axis: 'lf', id: '2/7', was: 'missing' }]);
  const milder = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/10' ? { ...cell, bucket: 'sameday', minutes: 2000 } : cell)), MEASURABLE);
  eq('(c) diff→sameday met grotere grootte ⇒ rood (groter, emmer wint niet)', [milder.largerCells.length, milder.improvedCells.length, cellGateFailures(milder).length], [1, 0, 1]);
  const milderSmall = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/10' ? { ...cell, bucket: 'sameday', minutes: 900 } : cell)), MEASURABLE);
  eq('(c) diff→sameday met kleinere grootte ⇒ geen rode regels', cellGateFailures(milderSmall), []);
  eq('(c) diff→sameday met kleinere grootte ⇒ één te herpinnen', milderSmall.improvedCells.length, 1);
  const milderSame = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/10' ? { ...cell, bucket: 'sameday' } : cell)), MEASURABLE);
  eq('(c) diff→sameday met gelijke grootte ⇒ verbeterd, niet rood', [milderSame.improvedCells.length, cellGateFailures(milderSame).length], [1, 0]);

  // (d) een baselinecel die exact lijkt maar niet meer meetbaar is (blinder orakel) ⇒ rood, niet "verbeterd".
  const blind = (file: string, axis: string, id: string) => !(file === F1 && axis === 'lf' && id === '2/7');
  const blinder = compareCells(baseline, with_(cells => cells.filter(cell => cell.axis !== 'lf')), blind);
  eq('(d) onmeetbaar geworden cel telt niet als verbeterd', blinder.improvedCells, []);
  eq('(d) onmeetbaar geworden cel ⇒ rood', cellGateFailures(blinder),
    [`cel onmeetbaar geworden (was missing) — regel A: ${F1} as lf id 2/7`]);
  eq('(d) herpin met een onmeetbaar geworden cel wordt geweigerd',
    planCellRepin(baseline, with_(cells => cells.filter(cell => cell.axis !== 'lf')), blind).allowed, false);

  // Bestandsdekking.
  eq('onbekend gemeten bestand ⇒ rood', compareCells(measure(BASE, null), baseline, MEASURABLE).unknownFiles, [F2]);
  eq('baselinebestand niet gemeten ⇒ rood', compareCells(baseline, measure(BASE, null), MEASURABLE).unmeasuredFiles, [F2]);

  // Herpinnen alleen zonder rode cel.
  eq('herpin met een nieuwe inexacte cel wordt geweigerd',
    planCellRepin(baseline, with_(cells => [...cells, { axis: 'ef', id: '1/30', bucket: 'diff', minutes: 2880 }]), MEASURABLE).allowed, false);
  eq('herpin met een verslechterde cel wordt geweigerd',
    planCellRepin(baseline, with_(cells => cells.map(cell => cell.axis === 'tf' ? { ...cell, bucket: 'missing', minutes: null } : cell)), MEASURABLE).allowed, false);
  const betterMeasurement = with_(cells => cells.filter(cell => cell.axis !== 'lf'));
  eq('herpin met alleen verbeteringen mag', planCellRepin(baseline, betterMeasurement, MEASURABLE).allowed, true);
  eq('na herpin is dezelfde meting groen en niets meer te herpinnen',
    compareCells(betterMeasurement, betterMeasurement, MEASURABLE).improvedCells.length, 0);
  eq('eerste pin (geen baseline) mag', planCellRepin(undefined, baseline, MEASURABLE).allowed, true);

  // Bouwer weigert onzin in plaats van hem stil te pinnen.
  const throws = (label: string, cells: MeasuredCell[]) => {
    checks++;
    try { measure(cells); diffs.push(`build accepteert ${label}`); } catch { /* verwacht */ }
  };
  throws('dubbele cel', [...BASE, { axis: 'es', id: '1/10', bucket: 'diff', minutes: 1440 }]);
  throws('emmer exact', [{ axis: 'es', id: '1/1', bucket: 'exact' as MeasuredCell['bucket'], minutes: null }]);
  throws('onbekende as', [{ axis: 'xx', id: '1/1', bucket: 'diff', minutes: 1 }]);
  throws('id zonder project', [{ axis: 'es', id: '11', bucket: 'diff', minutes: 1 }]);
  throws('__proto__ als as', [{ axis: '__proto__', id: '1/1', bucket: 'diff', minutes: 1 }]);
  throws('diff zonder grootte', [{ axis: 'es', id: '1/1', bucket: 'diff', minutes: null }]);
  throws('sameday met NaN-grootte (niet te bepalen)', [{ axis: 'ef', id: '1/1', bucket: 'sameday', minutes: NaN }]);
  throws('negatieve grootte', [{ axis: 'tf', id: '1/1', bucket: 'diff', minutes: -5 }]);
  throws('grootte niet op 0,001', [{ axis: 'tf', id: '1/1', bucket: 'diff', minutes: 0.00049 }]);
  throws('missing met grootte', [{ axis: 'es', id: '1/1', bucket: 'missing', minutes: 0 }]);
  throws('drivingPath met grootte', [{ axis: 'drivingPath', id: '1/1', bucket: 'diff', minutes: 1 }]);

  // Een dubbele cel binnen één project wordt een foutregel (de check maakt er een XX-regel van),
  // geen exception die als stacktrace de run afbreekt.
  const duplicate = tryBuildCellBaseline(new Map([[F1, [...BASE, { axis: 'es', id: '1/10', bucket: 'diff' as const, minutes: 1440 }]]]), metaFor([F1]));
  eq('dubbele cel ⇒ nette foutregel', duplicate.error, `dubbele cel ${F1}/es/1/10`);
  eq('geldige meting ⇒ geen foutregel', tryBuildCellBaseline(new Map([[F1, BASE]]), metaFor([F1])).error, undefined);
  eq('ontbrekende drivingPath-orakelhash ⇒ foutregel', tryBuildCellBaseline(new Map([[F1, BASE]]), metaFor([])).error !== undefined, true);

  // Orakel- en manifestpinnen: een orakel dat naar onze waarde toe schuift verandert de
  // drivingPath-hash van een bestaande entry ⇒ hard rood; een ander manifest ⇒ fileset.
  const shifted = buildCellBaseline(new Map([[F1, BASE], [F2, []]]), {
    manifestSha256: MANIFEST, drivingPathOracle: new Map([[F1, 'e'.repeat(64)], [F2, 'd'.repeat(64)]]),
  });
  eq('gewijzigde drivingPath-orakelhash ⇒ hard', cellOracleRedLines(baseline, shifted).map(line => line.kind), ['hard']);
  const otherManifest = buildCellBaseline(new Map([[F1, BASE], [F2, []]]), metaFor([F1, F2], 'f'.repeat(64)));
  eq('ander manifest ⇒ fileset', cellOracleRedLines(baseline, otherManifest).map(line => line.kind), ['fileset']);
  eq('ongewijzigd orakel en manifest ⇒ niets', cellOracleRedLines(baseline, measure(BASE)), []);
  eq('=corpus zonder bestand wordt geweigerd', cellWriteModeProblem('corpus', false) !== undefined, true);
  eq('=corpus met bestaand bestand mag (manifestcontrole in de check)', cellWriteModeProblem('corpus', true), undefined);

  // Schrijfmodus: een ontbrekend bestand vraagt `init`, `=1` herpint alleen een bestaand bestand.
  eq('geen schrijfmodus ⇒ geen probleem', cellWriteModeProblem(undefined, false), undefined);
  eq('=1 met bestaand bestand mag', cellWriteModeProblem('1', true), undefined);
  eq('init zonder bestand mag', cellWriteModeProblem('init', false), undefined);
  eq('=1 zonder bestand wordt geweigerd met uitleg', cellWriteModeProblem('1', false)?.includes('OPS_XER_CELLS_WRITE=init'), true);
  eq('init over een bestaand bestand wordt geweigerd', cellWriteModeProblem('init', true) !== undefined, true);
  eq('onbekende schrijfmodus wordt geweigerd', cellWriteModeProblem('yes', true) !== undefined, true);

  // Serialisatie en strikte lezer.
  const text = serializeCellBaseline(baseline);
  eq('serialisatie is JSON.stringify(value, null, 2) + LF', text, `${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  eq('eigen serialisatie wordt teruggelezen', parseCellBaseline(text).problems, []);
  eq('round-trip is identiek', parseCellBaseline(text).baseline, baseline);
  const rejects = (label: string, raw: string) => {
    checks++;
    if (raw === text) diffs.push(`mutatie "${label}" veranderde de tekst niet`);
    else if (parseCellBaseline(raw).problems.length === 0) diffs.push(`lezer accepteert ${label}`);
  };
  const cell = (bucket: string, minutes: string) => `{\n          "bucket": "${bucket}",\n          "minutes": ${minutes}\n        }`;
  rejects('ongesorteerde ids', text.replace(`"1/10": ${cell('diff', '1440')},\n        "1/20": ${cell('sameday', '60')}`,
    `"1/20": ${cell('sameday', '60')},\n        "1/10": ${cell('diff', '1440')}`));
  rejects('onbekende emmer', text.replace(`"1/20": ${cell('sameday', '60')}`, `"1/20": ${cell('exact', '60')}`));
  rejects('id in verkeerde vorm', text.replace('"1/20"', '"1 20"'));
  rejects('niet-canonieke witruimte', text.replace('"version": 2', '"version":  2'));
  rejects('CRLF-einde', text.replace(/\n/g, '\r\n'));
  rejects('geen LF aan het eind', text.slice(0, -1));
  rejects('verkeerde versie', text.replace('"version": 2', '"version": 3'));
  rejects('sameday zonder grootte', text.replace(`"1/20": ${cell('sameday', '60')}`, `"1/20": ${cell('sameday', 'null')}`));
  rejects('grootte als tekst', text.replace(`"1/20": ${cell('sameday', '60')}`, `"1/20": ${cell('sameday', '"60"')}`));
  rejects('missing met grootte', text.replace(`"2/7": ${cell('missing', 'null')}`, `"2/7": ${cell('missing', '0')}`));
  rejects('cel als kale emmer (versie-1-vorm in een versie-2-bestand)', text.replace(`"1/20": ${cell('sameday', '60')}`, '"1/20": "sameday"'));
  rejects('ontbrekende as', text.replace(`"ef": {},\n`, ''));
  rejects('sleutel geen sha256', text.replace(F2, 'B'.repeat(64)));
  rejects('dubbele bestandssleutel', text.replace(F2, F1));
  rejects('geen JSON', '{');
}

// ── 2. Gecommitte baseline in de pas met de v2-tellingen ──────────────────────────────────────
const OWN_SOURCE = readFileSync(join(HERE, 'check-fidelity-cells-gate.ts'), 'utf8');
/** Rood als de schuldset niet bij de gepinde digest hoort of het gegenereerde blok niet bij de set. */
function debtPinProblems(debt: CellDebt, source = OWN_SOURCE): string[] {
  const problems: string[] = [];
  if (debtDigest(debt) !== EXPECTED_DEBT_SHA256) {
    problems.push(`schuldset-digest ${debtDigest(debt).slice(0, 12)} ≠ gepind ${EXPECTED_DEBT_SHA256.slice(0, 12)} — de schuldlijst is geruild, verlengd of ingekort`);
  }
  if (extractDebtPinBlock(source) !== renderDebtPinBlock(debt)) problems.push('schuldpin-blok in de bron hoort niet bij de schuldset');
  return problems;
}
let committed: { cells: CellBaseline; v2Minutes: string } | undefined;
{
  const parsed = parseCellBaseline(readFileSync(join(HERE, CELL_BASELINE_FILE), 'utf8'));
  eq(`${CELL_BASELINE_FILE} is geldig en canoniek`, parsed.problems, []);
  const v2 = validateProductBaselineV2(readFileSync(join(HERE, 'xer-product-fidelity-baseline-v2.json'), 'utf8'));
  eq('xer-product-fidelity-baseline-v2.json is geldig', v2.problems, []);
  if (parsed.baseline && v2.payload) {
    const cells = parsed.baseline;
    const counts = v2.payload.files;
    eq(`${CELL_BASELINE_FILE} dekt precies de v2-entries`, Object.keys(cells.files).sort(), Object.keys(counts).sort());
    eq(`${CELL_BASELINE_FILE} hoort bij hetzelfde corpusmanifest als v2`, cells.manifestSha256, v2.payload.manifestSha256);
    const mismatches: string[] = [];
    let total = 0;
    for (const [key, entry] of Object.entries(counts)) {
      const file = cells.files[key];
      if (!file) continue;
      for (const axis of [...XER_FIDELITY_AXES, 'drivingPath'] as const) {
        const want = axis === 'drivingPath' ? entry.drivingPath : entry.counters[axis];
        const got = Object.values(file[axis] ?? {});
        total += got.length;
        for (const bucket of CELL_BUCKETS) {
          if (got.filter(value => value.bucket === bucket).length !== want[bucket]) mismatches.push(`${key.slice(0, 12)}/${axis}/${bucket}`);
        }
        if (got.length !== want.deviations) mismatches.push(`${key.slice(0, 12)}/${axis}/deviations`);
      }
    }
    eq(`${CELL_BASELINE_FILE}: per entry/as/emmer aantal cellen === v2-telling`, mismatches, []);
    // Pin van de grootte-ratchet op het gecommitte bestand: versie 2, en elke sameday/diff-cel op de
    // zes assen draagt een grootte (missing/drivingPath: null). De strikte lezer eist dit al; deze
    // pin maakt het expliciet en telt de cellen mét grootte.
    eq(`${CELL_BASELINE_FILE} is versie ${CELL_BASELINE_VERSION}`, cells.version, 2);
    const sizeProblems: string[] = [];
    let sized = 0;
    for (const [key, file] of Object.entries(cells.files)) {
      for (const axis of CELL_AXES) {
        for (const [id, value] of Object.entries(file[axis] ?? {})) {
          const wantSize = cellHasMagnitude(axis, value.bucket);
          if (wantSize && typeof value.minutes === 'number') sized++;
          else if (wantSize || value.minutes !== null) sizeProblems.push(`${key.slice(0, 12)}/${axis}/${id}`);
        }
      }
    }
    eq(`${CELL_BASELINE_FILE}: grootte op precies de sameday/diff-cellen van de zes assen`, sizeProblems.slice(0, 5), []);
    console.log(`   . ${CELL_BASELINE_FILE}: ${Object.keys(cells.files).length} entries, ${total} inexacte cellen, ${sized} met grootte`);
    // Ratchet-schuld: gepinde schuldset (digest), alleen krimpen via OPS_XER_CELLS_WRITE.
    eq(`${CELL_BASELINE_FILE}: ratchet-schuldset = gepinde digest (${debtCount(cells.ratchetDebt)} cellen; alleen krimpen)`,
      debtPinProblems(cells.ratchetDebt), []);
    // Minuten: het cellenbestand hoort bij cellMinutesSha256 in de v2-envelop.
    eq(`${CELL_BASELINE_FILE}: grootten = cellMinutesSha256 in v2`, cellMinutesProblems(cells, v2.envelope!.cellMinutesSha256), []);
    committed = { cells, v2Minutes: v2.envelope!.cellMinutesSha256 };
  }
}

// ── 3. Grootte-ratchet (versie 2) ─────────────────────────────────────────────────────────────
{
  // Grootte: |ours − truth| in minuten; datum-assen in wandklok, float-assen in floatminuten.
  eq('grootte datum-as sameday: 08:00 vs 10:30 ⇒ 150 min', cellMagnitude('es', 'sameday', '2026-03-02T08:00', '2026-03-02T10:30'), 150);
  eq('grootte datum-as diff over maandgrens ⇒ 1440 min', cellMagnitude('lf', 'diff', '2026-03-01T17:00', '2026-02-28T17:00'), 1440);
  eq('grootte datum-as diff over jaargrens ⇒ absolute waarde', cellMagnitude('ef', 'diff', '2025-12-31T23:00', '2026-01-01T01:00'), 120);
  eq('grootte float-as: tf 2400 vs 1920 ⇒ 480 min', cellMagnitude('tf', 'diff', 2400, 1920), 480);
  eq('grootte float-as: drijvende-kommaruis afgerond op 0,001', cellMagnitude('ff', 'diff', 0.1 + 0.2, 0), 0.3);
  eq('grootte missing ⇒ null', cellMagnitude('es', 'missing', null, '2026-03-02T08:00'), null);
  eq('grootte drivingPath ⇒ null', cellMagnitude('drivingPath', 'diff', true, false), null);
  eq('grootte niet-canonieke minuut ⇒ niet te bepalen', cellMagnitude('es', 'diff', '2026-03-02T08:00', '2026-03-02 08:00'), undefined);
  eq('grootte ongeldige datum ⇒ niet te bepalen', cellMagnitude('es', 'diff', '2026-02-30T08:00', '2026-03-02T08:00'), undefined);

  // Bestand-in-geheugen: één cel wordt binnen dezelfde emmer groter ⇒ rood; kleiner ⇒ verbeterd-grootte.
  const pinned = measure(BASE);
  const pinnedText = serializeCellBaseline(pinned);
  const reread = parseCellBaseline(pinnedText).baseline!;
  const larger = compareCells(reread, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/10' ? { ...cell, minutes: 1441 } : cell)), MEASURABLE);
  eq('grootte: diff 1440→1441 ⇒ precies één groter', larger.largerCells.map(ref => [ref.axis, ref.id, ref.wasMinutes, ref.nowMinutes]), [['es', '1/10', 1440, 1441]]);
  eq('grootte: groter ⇒ rood', cellGateFailures(larger),
    [`cel groter geworden (diff) 1440→1441 min — regel A (grootte): ${F1} as es id 1/10`]);
  eq('grootte: groter ⇒ herpin geweigerd', planCellRepin(reread, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/10' ? { ...cell, minutes: 1441 } : cell)), MEASURABLE).allowed, false);
  const largerSameday = compareCells(reread, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/20' ? { ...cell, minutes: 61 } : cell)), MEASURABLE);
  eq('grootte: sameday 60→61 ⇒ rood', cellGateFailures(largerSameday).length, 1);
  const smaller = compareCells(reread, with_(cells => cells.map(cell =>
    cell.axis === 'tf' ? { ...cell, minutes: 479.5 } : cell)), MEASURABLE);
  eq('grootte: kleiner ⇒ geen rode regels', cellGateFailures(smaller), []);
  eq('grootte: kleiner ⇒ verbeterd-grootte, niet bucket-verbeterd',
    [smaller.smallerCells.length, smaller.improvedCells.length, smaller.largerCells.length], [1, 0, 0]);
  eq('grootte: kleiner ⇒ herpin mag', planCellRepin(reread, with_(cells => cells.map(cell =>
    cell.axis === 'tf' ? { ...cell, minutes: 479.5 } : cell)), MEASURABLE).allowed, true);
  eq('grootte: één groter en één kleiner op dezelfde as ⇒ toch rood (per cel, niet per som)',
    cellGateFailures(compareCells(reread, with_(cells => cells.map(cell =>
      cell.axis === 'es' ? { ...cell, minutes: cell.id === '1/10' ? 1500 : 1 } : cell)), MEASURABLE)).length, 1);
  eq('grootte: delta-regel draagt groter= en kleiner=', cellDeltaLine('p6', smaller, pinned),
    'CELLDELTA p6 nieuw=0 verslechterd=0 groter=0 verbeterd=0 kleiner=1 onmeetbaar=0 onbekend=0 ongemeten=0 schuld=0 totaal=4');

  // Versie 1 wordt geweigerd met verwijzing naar het recept; de lezer levert de emmers wel voor de herpin.
  const v1 = `${JSON.stringify({
    version: 1, manifestSha256: pinned.manifestSha256, axes: [...CELL_AXES], buckets: [...CELL_BUCKETS],
    drivingPathOracle: pinned.drivingPathOracle,
    files: Object.fromEntries(Object.entries(pinned.files).map(([key, axes]) => [key, Object.fromEntries(Object.entries(axes)
      .map(([axis, cells]) => [axis, Object.fromEntries(Object.entries(cells).map(([id, value]) => [id, value.bucket]))]))])),
  }, null, 2)}
`;
  const legacy = parseCellBaseline(v1);
  eq('versie 1 ⇒ geweigerd met verwijzing naar het recept', legacy.problems, [CELL_V1_PROBLEM]);
  eq('versie-1-melding noemt OPS_XER_CELLS_WRITE=1 en het recept',
    CELL_V1_PROBLEM.includes('OPS_XER_CELLS_WRITE=1') && CELL_V1_PROBLEM.includes('OPS_XER_CELLS_V1_UPGRADE=1') && CELL_V1_PROBLEM.includes('scripts/README.md'), true);
  eq('versie 1 ⇒ gemarkeerd als legacy', legacy.legacyV1, true);
  eq('versie 1 ⇒ emmers voor de herpin, zonder grootte', legacy.baseline?.files[F1]?.es, {
    '1/10': { bucket: 'diff', minutes: null }, '1/20': { bucket: 'sameday', minutes: null },
  });
  eq('herpin vanaf versie 1: emmer-ratchet blijft, grootte wordt niet vergeleken',
    [compareCells(legacy.baseline!, with_(cells => cells.map(cell => cell.axis === 'tf' ? { ...cell, minutes: 9999 } : cell)), MEASURABLE).largerCells.length,
      planCellRepin(legacy.baseline, with_(cells => [...cells, { axis: 'ef', id: '1/30', bucket: 'diff', minutes: 1 }]), MEASURABLE).allowed],
    [0, false]);
  eq('versie 1 niet canoniek ⇒ gewoon ongeldig, geen legacy', parseCellBaseline(v1.replace('"version": 1', '"version":  1')).legacyV1, undefined);
}

// ── 4. Ratchet-schuld ─────────────────────────────────────────────────────────────────────────
{
  // Oude kant: es 1/10 diff 1440, tf 1/10 diff 480. Beide groeien: er is GEEN route die daar schuld
  // van maakt (de eenmalige init-route van 2026-09-23 is verwijderd) — de herpin weigert.
  const old = measure(BASE);
  const grown = with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/10' ? { ...cell, minutes: 2000 } : cell.axis === 'tf' ? { ...cell, minutes: 900 } : cell));
  eq('schuld: groter wordt nooit schuld — de herpin weigert', planCellRepin(old, grown, MEASURABLE).allowed, false);
  eq('schuld: herpin zonder schuld schrijft geen schuld', (() => {
    const plan = planCellRepin(old, measure(BASE), MEASURABLE);
    return plan.allowed ? debtCount(plan.debt) : -1;
  })(), 0);
  // Een bestaande schuldsectie (zoals de gecommitte, ontstaan op 2026-09-23), hier synthetisch.
  const withDebt: CellBaseline = { ...grown, ratchetDebt: {
    [F1]: { es: { '1/10': { reference: 1440, current: 2000 } }, tf: { '1/10': { reference: 480, current: 900 } } },
  } };
  const text = serializeCellBaseline(withDebt);
  const reread = parseCellBaseline(text);
  eq('schuld: canoniek bestand met schuld wordt geaccepteerd', [reread.problems, debtCount(reread.baseline?.ratchetDebt ?? {})], [[], 2]);
  // Een schuldcel die verder groeit: herpin geweigerd (schuld kan niet stijgen).
  const growAgain = with_(cells => cells.map(cell => cell.axis === 'tf' ? { ...cell, minutes: 901 } : cell.axis === 'es' && cell.id === '1/10' ? { ...cell, minutes: 2000 } : cell));
  eq('schuld: schuldcel groeit ⇒ herpin geweigerd (schuld kan niet stijgen)',
    planCellRepin(reread.baseline!, growAgain, MEASURABLE).allowed, false);
  // Schuldcel groeit verder dan current ⇒ rood (ratchet-referentie is current).
  eq('schuld: groter dan current ⇒ rood', cellGateFailures(compareCells(reread.baseline!, growAgain, MEASURABLE)),
    [`cel groter geworden (diff) 900→901 min — regel A (grootte): ${F1} as tf id 1/10`]);
  // Daalt tot ≤ reference ⇒ schuld vervalt (kleiner, te herpinnen); daalt maar blijft > reference ⇒ current schuift mee.
  const down = with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/10' ? { ...cell, minutes: 1440 } : cell.axis === 'tf' ? { ...cell, minutes: 700 } : cell));
  const downDelta = compareCells(reread.baseline!, down, MEASURABLE);
  eq('schuld: dalende schuldcellen tellen als kleiner, niet rood', [cellGateFailures(downDelta), downDelta.smallerCells.length], [[], 2]);
  eq('schuld: ≤ reference ⇒ ontschuld; boven reference ⇒ current schuift mee', carryRatchetDebt(reread.baseline!.ratchetDebt, down), {
    [F1]: { tf: { '1/10': { reference: 480, current: 700 } } },
  });
  const downPlan = planCellRepin(reread.baseline!, down, MEASURABLE);
  eq('schuld: herpin na daling schrijft de verkleinde schuld', downPlan.allowed ? debtCount(downPlan.debt) : -1, 1);
  // Exact geworden (cel weg) ⇒ ontschuld en verbeterd.
  const exact = with_(cells => cells.filter(cell => cell.axis !== 'tf')
    .map(cell => cell.axis === 'es' && cell.id === '1/10' ? { ...cell, minutes: 2000 } : cell));
  const exactDelta = compareCells(reread.baseline!, exact, MEASURABLE);
  eq('schuld: exact geworden ⇒ verbeterd en ontschuld',
    [exactDelta.improvedCells.map(ref => [ref.axis, ref.id]), debtCount(carryRatchetDebt(reread.baseline!.ratchetDebt, exact))], [[['tf', '1/10']], 1]);
  eq('schuld: delta-regel draagt schuld=', cellDeltaLine('p6', exactDelta, { ...exact, ratchetDebt: carryRatchetDebt(reread.baseline!.ratchetDebt, exact) }).includes(' schuld=1 '), true);
  // De lezer weigert schuld die niet klopt (met de hand bewerkt).
  const tamper = (mutate: (value: Record<string, unknown>) => void) => {
    const json = JSON.parse(text) as Record<string, unknown>;
    mutate(json);
    return parseCellBaseline(`${JSON.stringify(json, null, 2)}
`).problems.length > 0;
  };
  const debtOf = (json: Record<string, unknown>) => (json.ratchetDebt as Record<string, Record<string, Record<string, { reference: number; current: number }>>>)[F1]!;
  eq('schuld: current ≠ celminuten ⇒ geweigerd', tamper(json => { debtOf(json).tf!['1/10']!.current = 800; }), true);
  eq('schuld: reference ≥ current ⇒ geweigerd', tamper(json => { debtOf(json).tf!['1/10']!.reference = 900; }), true);
  eq('schuld: regel zonder bijbehorende cel ⇒ geweigerd', tamper(json => { debtOf(json).es!['1/99'] = { reference: 1, current: 2 }; }), true);
  eq('schuld: schuld op drivingPath ⇒ geweigerd', tamper(json => { debtOf(json).drivingPath = { '1/10': { reference: 1, current: 2 } }; }), true);
  // Een versie-2-bestand zonder schuldsectie wordt geweigerd (net als versie 1): geen baseline, geen route.
  const preDebt = `${JSON.stringify({ ...JSON.parse(serializeCellBaseline(old)), ratchetDebt: undefined }, null, 2)}
`;
  const pre = parseCellBaseline(preDebt);
  eq('schuld: v2 zonder ratchetDebt-sectie ⇒ geweigerd, geen baseline', [pre.preDebt, pre.problems, pre.baseline === undefined], [true, [CELL_PRE_DEBT_PROBLEM], true]);

  // Schuldpin-blok: herschrijven alleen bij krimp, vanaf een blok dat bij de oude set hoort.
  const oldDebt = reread.baseline!.ratchetDebt;
  const shrunk = carryRatchetDebt(oldDebt, down);
  const source = `voor\n${renderDebtPinBlock(oldDebt)}\nna\n`;
  const rewritten = rewriteDebtPin(source, oldDebt, shrunk);
  eq('schuldpin: krimp ⇒ blok herschreven, ontschulde cel genoemd',
    'text' in rewritten ? [extractDebtPinBlock(rewritten.text) === renderDebtPinBlock(shrunk), rewritten.removed] : rewritten.error,
    [true, [[F1, 'es', '1/10', 1440]]]);
  eq('schuldpin: nieuwe regel in de set ⇒ geweigerd', 'error' in rewriteDebtPin(source, shrunk, oldDebt), true);
  eq('schuldpin: blok hoort niet bij de gepinde set ⇒ geweigerd', 'error' in rewriteDebtPin(source, shrunk, shrunk), true);
  eq('schuldpin: digest verandert bij een andere reference', debtDigest({ [F1]: { tf: { '1/10': { reference: 481, current: 700 } } } }) !== debtDigest(shrunk), true);
  eq('schuldpin: digest negeert current (die daalt mee)', debtDigest({ [F1]: { tf: { '1/10': { reference: 480, current: 650 } } } }), debtDigest(shrunk));
}

// ── 5. Mutanten op het GECOMMITTE cellenbestand (critreview integratie-eindstand 2026-09-23) ──
// Elke mutant is canoniek en voor de strikte lezer geldig; de pinnen moeten hem toch rood maken.
if (committed) {
  const { cells, v2Minutes } = committed;
  const mutate = (change: (copy: CellBaseline) => void): CellBaseline => {
    const copy = parseCellBaseline(serializeCellBaseline(cells)).baseline!;
    change(copy);
    const reparsed = parseCellBaseline(serializeCellBaseline(copy));
    if (!reparsed.baseline) throw new Error(`mutant is voor de lezer al ongeldig: ${reparsed.problems.join('; ')}`);
    return reparsed.baseline;
  };
  const debtKeys = new Set(debtEntriesOf(cells.ratchetDebt));
  function debtEntriesOf(debt: CellDebt): string[] {
    return Object.entries(debt).flatMap(([file, axes]) => Object.entries(axes).flatMap(([axis, ids]) => Object.keys(ids).map(id => `${file}|${axis}|${id}`)));
  }
  // Een niet-schuldcel met grootte (de eerste in bestandsvolgorde) en de eerste schuldcel.
  let plain: { file: string; axis: string; id: string; minutes: number } | undefined;
  for (const [file, axes] of Object.entries(cells.files)) {
    for (const axis of CELL_AXES) {
      for (const [id, value] of Object.entries(axes[axis] ?? {})) {
        if (!plain && value.minutes !== null && value.minutes > 0 && !debtKeys.has(`${file}|${axis}|${id}`)) plain = { file, axis, id, minutes: value.minutes };
      }
    }
  }
  // Sinds X12 brok 6 is de schuldset leeg (alle 14 ontschuld). De mutanten die een BESTAANDE schuldcel
  // wijzigen (M2, M4, M5) hebben dan geen doel; M1 (schuld erbij) is dan juist de kern: schuld kan niet
  // ontstaan.
  const firstDebt = [...debtKeys][0]?.split('|') as [string, string, string] | undefined;
  eq('mutant-basis: een niet-schuldcel met grootte gevonden', plain !== undefined, true);
  if (plain) {
    const target = plain;
    // M1: 15e schuldcel (geldige regel: wijst naar een bestaande cel, reference < current = minuten).
    const extra = mutate(copy => { ((copy.ratchetDebt[target.file] ??= {})[target.axis] ??= {})[target.id] = { reference: 0, current: target.minutes }; });
    eq(`M1 ${debtCount(cells.ratchetDebt) + 1}e schuldcel ⇒ rood (schuldset-digest)`, debtPinProblems(extra.ratchetDebt).length > 0, true);
    if (firstDebt) {
    const [debtFile, debtAxis, debtId] = firstDebt;
    // M2: schuldcel met de hand groter (cel én current opgerekt; reference gelijk ⇒ zelfde schuldset).
    const grownDebt = mutate(copy => {
      copy.files[debtFile]![debtAxis]![debtId]!.minutes! += 100000;
      copy.ratchetDebt[debtFile]![debtAxis]![debtId]!.current += 100000;
    });
    eq('M2 schuldcel met de hand groter ⇒ rood (minuten-digest ≠ v2)', cellMinutesProblems(grownDebt, v2Minutes).length > 0, true);
    // M4: schuldlijst ingekort (één regel weg) en geruild (reference anders) ⇒ rood.
    const shortened = mutate(copy => { delete copy.ratchetDebt[debtFile]![debtAxis]![debtId]; });
    eq('M4 schuldlijst ingekort ⇒ rood (schuldset-digest)', debtPinProblems(shortened.ratchetDebt).length > 0, true);
    const swapped = mutate(copy => { copy.ratchetDebt[debtFile]![debtAxis]![debtId]!.reference -= 1; });
    eq('M5 schuldregel geruild (andere reference) ⇒ rood (schuldset-digest)', debtPinProblems(swapped.ratchetDebt).length > 0, true);
    }
    // M3: niet-schuldcel met de hand groter (de mutant van de reviewer: 105360 → 205360).
    const grownPlain = mutate(copy => { copy.files[target.file]![target.axis]![target.id]!.minutes = target.minutes + 100000; });
    eq(`M3 niet-schuldcel met de hand groter (${target.minutes} → ${target.minutes + 100000}) ⇒ rood (minuten-digest ≠ v2)`,
      [cellMinutesProblems(grownPlain, v2Minutes).length > 0, cellMinutesDigest(grownPlain) !== cellMinutesDigest(cells)], [true, true]);
  }
  // M6: sectie weg ⇒ geweigerd door de lezer.
  const noSection = `${JSON.stringify({ ...JSON.parse(serializeCellBaseline(cells)), ratchetDebt: undefined }, null, 2)}\n`;
  eq('M6 cellenbestand zonder ratchetDebt-sectie ⇒ geweigerd', parseCellBaseline(noSection).problems, [CELL_PRE_DEBT_PROBLEM]);
  // M7: schuldpin-blok in de bron met de hand bewerkt: de derde blokregel weg. Bij een gevulde schuldset
  // is dat de eerste lijstregel (digest blijft staan); bij de lege schuldset van nu (X12 brok 6) is het
  // de digestregel zelf. Beide moeten rood zijn.
  const ownBlock = extractDebtPinBlock(OWN_SOURCE) ?? '';
  const blockLines = ownBlock.split('\n');
  const tamperedSource = OWN_SOURCE.replace(ownBlock, () => [...blockLines.slice(0, 2), ...blockLines.slice(3)].join('\n'));
  eq('M7 schuldpin-blok met de hand ingekort ⇒ rood', [tamperedSource !== OWN_SOURCE, debtPinProblems(cells.ratchetDebt, tamperedSource).length > 0], [true, true]);
}

if (diffs.length > 0) {
  console.log(`XX  fidelity-cellen (regel A): ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  fidelity-cellen (regel A): ${checks} checks groen — poortlogica mutatiebewezen (emmer + grootte), cel-baseline versie 2 canoniek en in de pas met de v2-tellingen, grootten = cellMinutesSha256, schuldset = gepinde digest`);
