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
// Assen: de zes X12-assen plus `drivingPath` als zevende poort-as (cel-ratchet; niet in het
// zesassige nuldoel-getal) — alle zeven onder dezelfde poortregels.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCellBaseline, CELL_AXES, CELL_BASELINE_FILE, CELL_BUCKETS, cellGateFailures, cellWriteModeProblem, compareCells,
  parseCellBaseline, planCellRepin, serializeCellBaseline, tryBuildCellBaseline, type CellBaseline, type MeasuredCell,
} from './fidelityCells';
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
function measure(f1: MeasuredCell[], f2: MeasuredCell[] | null = []): CellBaseline {
  const map = new Map<string, MeasuredCell[]>([[F1, f1]]);
  if (f2) map.set(F2, f2);
  return buildCellBaseline(map);
}
const BASE: MeasuredCell[] = [
  { axis: 'es', id: '1/20', bucket: 'sameday' },
  { axis: 'es', id: '1/10', bucket: 'diff' },
  { axis: 'tf', id: '1/10', bucket: 'diff' },
  { axis: 'lf', id: '2/7', bucket: 'missing' },
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
  const newCell = compareCells(baseline, with_(cells => [...cells, { axis: 'ef', id: '1/30', bucket: 'sameday' }]), MEASURABLE);
  eq('(a) één toegevoegde inexacte cel ⇒ precies die cel rood', cellGateFailures(newCell),
    [`cel was exact, nu inexact (sameday) — regel A: ${F1} as ef id 1/30`]);

  // (b) verslechterde emmer — volgorde exact < sameday < diff < missing (spec §5), elke stap naar
  //     rechts is rood: sameday→diff, diff→missing en sameday→missing.
  const worse = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/20' ? { ...cell, bucket: 'diff' } : cell)), MEASURABLE);
  eq('(b) sameday→diff ⇒ rood', cellGateFailures(worse), [`cel verslechterd sameday→diff — regel A: ${F1} as es id 1/20`]);
  const toMissing = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'tf' ? { ...cell, bucket: 'missing' } : cell)), MEASURABLE);
  eq('(b) diff→missing ⇒ rood', cellGateFailures(toMissing).length, 1);
  const samedayToMissing = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'es' && cell.id === '1/20' ? { ...cell, bucket: 'missing' } : cell)), MEASURABLE);
  eq('(b) sameday→missing ⇒ rood', cellGateFailures(samedayToMissing),
    [`cel verslechterd sameday→missing — regel A: ${F1} as es id 1/20`]);

  // Per cel, niet per som: één cel beter en één cel slechter op dezelfde as blijft rood.
  const swapped = compareCells(baseline, with_(cells => [
    ...cells.filter(cell => !(cell.axis === 'es' && cell.id === '1/20')),
    { axis: 'es', id: '1/30', bucket: 'sameday' },
  ]), MEASURABLE);
  eq('gelijke som, andere cel ⇒ toch rood', cellGateFailures(swapped).length, 1);

  // (c) verbetering: cel exact geworden, of diff→sameday ⇒ groen, te herpinnen.
  const resolved = compareCells(baseline, with_(cells => cells.filter(cell => cell.axis !== 'lf')), MEASURABLE);
  eq('(c) één weggehaalde cel ⇒ geen rode regels', cellGateFailures(resolved), []);
  eq('(c) één weggehaalde cel ⇒ één te herpinnen', resolved.improvedCells, [{ file: F1, axis: 'lf', id: '2/7', was: 'missing' }]);
  const milder = compareCells(baseline, with_(cells => cells.map(cell =>
    cell.axis === 'tf' ? { ...cell, bucket: 'sameday' } : cell)), MEASURABLE);
  eq('(c) diff→sameday ⇒ geen rode regels', cellGateFailures(milder), []);
  eq('(c) diff→sameday ⇒ één te herpinnen', milder.improvedCells.length, 1);

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
    planCellRepin(baseline, with_(cells => [...cells, { axis: 'ef', id: '1/30', bucket: 'diff' }]), MEASURABLE).allowed, false);
  eq('herpin met een verslechterde cel wordt geweigerd',
    planCellRepin(baseline, with_(cells => cells.map(cell => cell.axis === 'tf' ? { ...cell, bucket: 'missing' } : cell)), MEASURABLE).allowed, false);
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
  throws('dubbele cel', [...BASE, { axis: 'es', id: '1/10', bucket: 'diff' }]);
  throws('emmer exact', [{ axis: 'es', id: '1/1', bucket: 'exact' as MeasuredCell['bucket'] }]);
  throws('onbekende as', [{ axis: 'xx', id: '1/1', bucket: 'diff' }]);
  throws('id zonder project', [{ axis: 'es', id: '11', bucket: 'diff' }]);
  throws('__proto__ als as', [{ axis: '__proto__', id: '1/1', bucket: 'diff' }]);

  // Een dubbele cel binnen één project wordt een foutregel (de check maakt er een XX-regel van),
  // geen exception die als stacktrace de run afbreekt.
  const duplicate = tryBuildCellBaseline(new Map([[F1, [...BASE, { axis: 'es', id: '1/10', bucket: 'diff' as const }]]]));
  eq('dubbele cel ⇒ nette foutregel', duplicate.error, `dubbele cel ${F1}/es/1/10`);
  eq('geldige meting ⇒ geen foutregel', tryBuildCellBaseline(new Map([[F1, BASE]])).error, undefined);

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
  rejects('ongesorteerde ids', text.replace('"1/10": "diff",\n        "1/20": "sameday"', '"1/20": "sameday",\n        "1/10": "diff"'));
  rejects('onbekende emmer', text.replace('"1/20": "sameday"', '"1/20": "exact"'));
  rejects('id in verkeerde vorm', text.replace('"1/20"', '"1 20"'));
  rejects('niet-canonieke witruimte', text.replace('"version": 1', '"version":  1'));
  rejects('CRLF-einde', text.replace(/\n/g, '\r\n'));
  rejects('geen LF aan het eind', text.slice(0, -1));
  rejects('verkeerde versie', text.replace('"version": 1', '"version": 2'));
  rejects('ontbrekende as', text.replace(`"ef": {},\n`, ''));
  rejects('sleutel geen sha256', text.replace(F2, 'B'.repeat(64)));
  rejects('dubbele bestandssleutel', text.replace(F2, F1));
  rejects('geen JSON', '{');
}

// ── 2. Gecommitte baseline in de pas met de v2-tellingen ──────────────────────────────────────
{
  const parsed = parseCellBaseline(readFileSync(join(HERE, CELL_BASELINE_FILE), 'utf8'));
  eq(`${CELL_BASELINE_FILE} is geldig en canoniek`, parsed.problems, []);
  const v2 = validateProductBaselineV2(readFileSync(join(HERE, 'xer-product-fidelity-baseline-v2.json'), 'utf8'));
  eq('xer-product-fidelity-baseline-v2.json is geldig', v2.problems, []);
  if (parsed.baseline && v2.payload) {
    const cells = parsed.baseline;
    const counts = v2.payload.files;
    eq(`${CELL_BASELINE_FILE} dekt precies de v2-entries`, Object.keys(cells.files).sort(), Object.keys(counts).sort());
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
          if (got.filter(value => value === bucket).length !== want[bucket]) mismatches.push(`${key.slice(0, 12)}/${axis}/${bucket}`);
        }
        if (got.length !== want.deviations) mismatches.push(`${key.slice(0, 12)}/${axis}/deviations`);
      }
    }
    eq(`${CELL_BASELINE_FILE}: per entry/as/emmer aantal cellen === v2-telling`, mismatches, []);
    console.log(`   . ${CELL_BASELINE_FILE}: ${Object.keys(cells.files).length} entries, ${total} inexacte cellen`);
  }
}

if (diffs.length > 0) {
  console.log(`XX  fidelity-cellen (regel A): ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  fidelity-cellen (regel A): ${checks} checks groen — poortlogica mutatiebewezen, cel-baseline canoniek en in de pas met de v2-tellingen`);
