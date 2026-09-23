/**
 * Corpusloze fixtures en mutanten voor de manifestuitsluiting per project/taak
 * (`xerManifestExclusions.ts`): een mini-manifest met een project- en twee taakuitsluitingen tegen een
 * mini-XER met twee projecten.
 *
 *  1. De lezer: geldige uitsluitingen worden canoniek gelezen; zonder `decision` (datum +
 *     "eigenaarsbesluit"), op een niet-orakel, leeg, dubbel of met een onbekende sleutel ⇒ geweigerd.
 *  2. De telling: uitgesloten projecten/taken tellen niet in de zes assen, drivingPath en de
 *     nuldoelregels (X12-meting), noch in de X1-doelbaseline; de schemavingerafdruk blijft die van
 *     het hele bestand; de samenvatting noemt precies "N taken in K projecten" met reden.
 *  3. Oplossen tegen de grondwaarheid: een uitsluiting die niets raakt of een dubbelzinnige taakcode
 *     is een fout, geen stille no-op.
 *  4. De pin: digest en gegenereerd blok (render ⇄ parse), herschrijven alleen vanaf een ongeschonden
 *     blok, en per bestand welke uitsluitingen veranderden.
 *  5. De cel-poort: een cel die door een NIEUWE uitsluiting wegvalt of na het opheffen terugkomt is
 *     `fileset` (alleen `=corpus`), zonder uitsluitingswijziging blijft hij `hard`.
 *  6. Mutanten van het mechanisme: alleen één kant filteren (grondwaarheid óf opgelost) geeft
 *     identiteitsfouten; een filter dat de projectgrens negeert raakt een taak in een ander project.
 */
import {
  buildCellBaseline, cellGateRedLines, cellOracleRedLines, compareCells, planCellRepin,
  type CellExclusions, type MeasuredCell,
} from './fidelityCells';
import { buildXerTargetBaseline, type XerCorpusManifest, type XerSolvedProject } from './xerFidelity';
import { scanXerGroundTruth, XER_FIDELITY_AXES } from './xerGroundTruth';
import { measureXerProductFidelity } from './xerProductFidelity';
import {
  changedExclusionFiles, exclusionsDigest, exclusionSummary, extractExclusionPinBlock, filterSolvedExclusions,
  filterTruthExclusions, parseExclusionPinBlock, readManifestExclusions, renderExclusionPinBlock, resolveExclusions,
  rewriteExclusionPin, type XerExclusionRecord,
} from './xerManifestExclusions';
import { createHash } from 'node:crypto';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

// ── Mini-XER: project P1 (taken 1, 2, 3) en P2 (taken 10, 11); A2 heeft taakcode "A2". ─────────
const FIELDS = ['proj_id', 'task_id', 'task_code', 'status_code', 'early_start_date', 'early_end_date',
  'late_start_date', 'late_end_date', 'total_float_hr_cnt', 'free_float_hr_cnt', 'driving_path_flag'];
function row(project: string, id: string, code: string, day: string, driving: 'Y' | 'N'): string {
  return ['%R', project, id, code, 'TK_NotStart', `2026-01-0${day} 08:00`, `2026-01-0${day} 17:00`,
    `2026-01-0${day} 08:00`, `2026-01-0${day} 17:00`, '0', '0', driving].join('\t');
}
const XER = new TextEncoder().encode([
  '%T\tTASK', `%F\t${FIELDS.join('\t')}`,
  row('P1', '1', 'A1', '5', 'Y'), row('P1', '2', 'A2', '6', 'Y'), row('P1', '3', 'A3', '7', 'N'),
  row('P2', '10', 'B1', '5', 'Y'), row('P2', '11', 'B2', '6', 'N'), '%E',
].join('\n'));
const SHA = createHash('sha256').update(XER).digest('hex');
/** Opgeloste taak: exact, of (dev) een uur later op alle datumassen en drivingPath omgedraaid. */
function solvedTask(id: string, code: string, day: string, driving: boolean, dev = false): XerSolvedProject['tasks'][number] {
  const hour = dev ? '09' : '08';
  return {
    sourceTaskId: id, taskCode: code,
    earlyStart: `2026-01-0${day}T${hour}:00`, earlyFinish: `2026-01-0${day}T17:00`,
    lateStart: `2026-01-0${day}T${hour}:00`, lateFinish: `2026-01-0${day}T17:00`,
    totalFloatMinutes: 0, freeFloatMinutes: 0, drivingPath: dev ? !driving : driving,
  };
}
// Afwijkingen: A2 (P1/2) en heel P2 wijken af; A1 en A3 zijn exact.
const SOLVED: XerSolvedProject[] = [
  { projectId: 'P1', tasks: [solvedTask('1', 'A1', '5', true), solvedTask('2', 'A2', '6', true, true), solvedTask('3', 'A3', '7', false)] },
  { projectId: 'P2', tasks: [solvedTask('10', 'B1', '5', true, true), solvedTask('11', 'B2', '6', false, true)] },
];
const DECISION = '2026-09-24 eigenaarsbesluit: fixture';
const LABEL = 'mini/mini.xer';
function manifestWith(extra: Record<string, unknown>, role = 'oracle'): XerCorpusManifest {
  return {
    version: 1, policy: 'fixture',
    files: { [LABEL]: { sha256: SHA, source: 'fixture', role: role as 'oracle', included: role === 'oracle', ...(role === 'oracle' ? {} : { exclusionReason: 'fixture' }), ...extra } },
  };
}
const VALID = {
  decision: DECISION,
  excludeProjects: [{ projId: 'P2', reason: 'P2 niet door P6 doorgerekend' }],
  excludeTasks: [{ projId: 'P1', taskCode: 'A2', reason: 'verouderde P6-uitvoer' }],
};

// ── 1. De lezer ─────────────────────────────────────────────────────────────────────────────
{
  const read = readManifestExclusions(manifestWith(VALID));
  eq('1a geldige uitsluitingen: geen probleem, twee regels', [read.problems, read.records.length], [[], 2]);
  eq('1b gegroepeerd per bestands-SHA', [...read.bySha.keys()], [SHA]);
  eq('1c zonder uitsluitingen: niets', readManifestExclusions(manifestWith({})).records, []);
  const refused = (label: string, extra: Record<string, unknown>, role = 'oracle') => {
    const result = readManifestExclusions(manifestWith(extra, role));
    eq(`1 weigert ${label}`, [result.problems.length > 0, result.records.length], [true, 0]);
  };
  refused('uitsluiting zonder decision', { excludeProjects: VALID.excludeProjects });
  refused('decision zonder datum', { ...VALID, decision: 'eigenaarsbesluit zonder datum' });
  refused('decision zonder het woord eigenaarsbesluit', { ...VALID, decision: '2026-09-24 akkoord' });
  refused('decision met onmogelijke datum', { ...VALID, decision: '2026-13-01 eigenaarsbesluit' });
  refused('decision zonder uitsluiting', { decision: DECISION });
  refused('uitsluiting op een reader-only-entry', VALID, 'reader-only');
  refused('lege excludeTasks', { ...VALID, excludeTasks: [] });
  refused('excludeProjects geen lijst', { ...VALID, excludeProjects: { projId: 'P2', reason: 'x' } });
  refused('taak met taskId én taskCode', { decision: DECISION, excludeTasks: [{ projId: 'P1', taskId: '2', taskCode: 'A2', reason: 'x' }] });
  refused('taak zonder taskId en taskCode', { decision: DECISION, excludeTasks: [{ projId: 'P1', reason: 'x' }] });
  refused('lege reden', { decision: DECISION, excludeProjects: [{ projId: 'P2', reason: ' ' }] });
  refused('onbekende sleutel', { decision: DECISION, excludeProjects: [{ projId: 'P2', reason: 'x', proj: 'P2' }] });
  refused('dubbele uitsluiting', { decision: DECISION, excludeTasks: [{ projId: 'P1', taskId: '2', reason: 'x' }, { projId: 'P1', taskId: '2', reason: 'y' }] });
  refused('taak onder een al uitgesloten project', { decision: DECISION, excludeProjects: [{ projId: 'P1', reason: 'x' }], excludeTasks: [{ projId: 'P1', taskId: '2', reason: 'y' }] });
  const twin = manifestWith(VALID);
  twin.files['mini/twin.xer'] = { sha256: SHA, source: 'fixture', role: 'oracle', included: true };
  eq('1 weigert byte-identieke orakellabels met verschillende uitsluitingen', readManifestExclusions(twin).problems.length > 0, true);
  twin.files['mini/twin.xer'] = { sha256: SHA, source: 'fixture', role: 'oracle', included: true, ...VALID };
  eq('1d byte-identieke orakellabels met dezelfde uitsluitingen: één lijst', [readManifestExclusions(twin).problems, readManifestExclusions(twin).records.length], [[], 2]);
}

// ── 2. De telling (X12-meting en X1-doelbaseline) ─────────────────────────────────────────────
const truthAll = scanXerGroundTruth(XER);
eq('2a mini-XER scant zonder fouten', truthAll.errors, []);
const records = readManifestExclusions(manifestWith(VALID)).records;
const resolved = resolveExclusions(truthAll.tasks, records);
{
  eq('2b oplossen: geen probleem; P2 en P1/2 uitgesloten', [resolved.problems, [...resolved.projects], [...resolved.taskKeys].sort()],
    [[], ['P2'], ['P1/2', 'P2/10', 'P2/11']]);
  const all = measureXerProductFidelity(truthAll, SOLVED);
  const sixAll = XER_FIDELITY_AXES.reduce((sum, axis) => sum + all.counters[axis].deviations, 0);
  eq('2c zonder uitsluiting: 3 afwijkende taken × 2 assen (es, ls) en 3 drivingPath', [sixAll, all.drivingPath.deviations, all.gatePassed], [6, 3, false]);
  const truth = filterTruthExclusions(truthAll, resolved);
  const measured = measureXerProductFidelity(truth, filterSolvedExclusions(SOLVED, resolved));
  eq('2d met uitsluiting: alleen A1 en A3 tellen, nul afwijkingen, nuldoel gehaald, geen identiteitsfout', {
    projects: measured.truthProjects, tasks: measured.truthTasks, solved: measured.solvedTasks,
    six: XER_FIDELITY_AXES.reduce((sum, axis) => sum + measured.counters[axis].deviations, 0),
    measurableEs: measured.counters.es.measurable, driving: measured.drivingPath.deviations,
    drivingMeasurable: measured.drivingPath.measurable, detail: measured.detail.length,
    identity: measured.identityErrors, gate: measured.gatePassed,
  }, { projects: 1, tasks: 2, solved: 2, six: 0, measurableEs: 2, driving: 0, drivingMeasurable: 2, detail: 0, identity: [], gate: true });
  eq('2e het origineel blijft onaangeraakt', [truthAll.tasks.length, SOLVED[1]!.tasks.length], [5, 2]);
  const summary = exclusionSummary([{ label: LABEL, resolved }]);
  eq('2f samenvatting: 3 taken in 2 projecten, met reden', [summary.tasks, summary.projects,
    summary.line.startsWith('uitgesloten: 3 taken in 2 projecten — '), summary.line.includes('P2 niet door P6 doorgerekend'),
    summary.line.includes('verouderde P6-uitvoer')], [3, 2, true, true, true]);
  eq('2g lege samenvatting is expliciet nul', exclusionSummary([]).line, 'uitgesloten: 0 taken in 0 projecten');

  const files = [{ label: LABEL, bytes: XER }];
  const without = buildXerTargetBaseline(files, manifestWith({}));
  const withExclusions = buildXerTargetBaseline(files, manifestWith(VALID));
  const entryWithout = Object.values(without.baseline.files)[0]!;
  const entryWith = Object.values(withExclusions.baseline.files)[0]!;
  eq('2h X1: zonder fouten, telt alleen de niet-uitgesloten taken', {
    errors: withExclusions.errors, tasks: entryWith.tasks, projects: entryWith.projects, es: entryWith.counters.es.measurable,
    selected: withExclusions.stats.selectedMeasurable.es, uniqueTasks: withExclusions.stats.uniqueOracleTasks,
  }, { errors: [], tasks: 2, projects: 1, es: 2, selected: 2, uniqueTasks: 2 });
  eq('2i X1: zonder uitsluiting alle vijf; vingerafdruk (dedup) ongewijzigd door de uitsluiting',
    [entryWithout.tasks, entryWithout.schemaFingerprint === entryWith.schemaFingerprint], [5, true]);
  eq('2j X1: de ruwe corpusdekking telt het hele bestand', withExclusions.stats.sixAxisTasks, without.stats.sixAxisTasks);
  const refused = buildXerTargetBaseline(files, manifestWith({ excludeProjects: VALID.excludeProjects }));
  eq('2k X1 weigert een uitsluiting zonder decision', refused.errors.some(error => error.includes('eigenaarsbesluit')), true);
  const ghost = buildXerTargetBaseline(files, manifestWith({ decision: DECISION, excludeProjects: [{ projId: 'P9', reason: 'x' }] }));
  eq('2l X1 weigert een uitsluiting die niets raakt', ghost.errors.some(error => error.includes('raakt geen enkele orakeltaak')), true);
}

// ── 3. Oplossen: nooit een stille no-op ─────────────────────────────────────────────────────
{
  const record = (extra: Partial<XerExclusionRecord>): XerExclusionRecord => ({ sha256: SHA, kind: 'task', projId: 'P1', reason: 'x', decision: DECISION, ...extra });
  eq('3a onbekend project ⇒ probleem', resolveExclusions(truthAll.tasks, [record({ kind: 'project', projId: 'P9' })]).problems.length, 1);
  eq('3b onbekende taskId ⇒ probleem', resolveExclusions(truthAll.tasks, [record({ taskId: '99' })]).problems.length, 1);
  eq('3c taskId van een ander project ⇒ probleem', resolveExclusions(truthAll.tasks, [record({ taskId: '10' })]).problems.length, 1);
  const twice = [...truthAll.tasks, { ...truthAll.tasks[0]!, taskId: '4' }];
  eq('3d dubbelzinnige taakcode ⇒ probleem (gebruik taskId)', resolveExclusions(twice, [record({ taskCode: 'A1' })]).problems.some(problem => problem.includes('dubbelzinnig')), true);
  eq('3e taskId-uitsluiting raakt precies één taak', [...resolveExclusions(truthAll.tasks, [record({ taskId: '3' })]).taskKeys], ['P1/3']);
}

// ── 4. De pin ───────────────────────────────────────────────────────────────────────────────
{
  const block = renderExclusionPinBlock(records);
  eq('4a blok ⇄ lijst (render en parse)', parseExclusionPinBlock(block), [...records].sort((a, b) => a.kind.localeCompare(b.kind)));
  eq('4b leeg blok heeft de lege digest', exclusionsDigest([]), createHash('sha256').update('[]').digest('hex'));
  eq('4c digest verandert bij een andere reden', exclusionsDigest(records) !== exclusionsDigest(records.map(r => ({ ...r, reason: `${r.reason}!` }))), true);
  eq('4d digest verandert bij een ander besluit', exclusionsDigest(records) !== exclusionsDigest(records.map(r => ({ ...r, decision: '2026-09-25 eigenaarsbesluit' }))), true);
  eq('4e digest is volgorde-onafhankelijk', exclusionsDigest(records), exclusionsDigest([...records].reverse()));
  const source = `voor\n${renderExclusionPinBlock([])}\nna\n`;
  const rewritten = rewriteExclusionPin(source, records);
  eq('4f herschrijven vanaf een ongeschonden blok', 'text' in rewritten ? extractExclusionPinBlock(rewritten.text) === block : rewritten.error, true);
  const tampered = source.replace(/'[0-9a-f]{64}'/, `'${'1'.repeat(64)}'`);
  eq('4g met de hand bewerkt blok ⇒ niet terug te lezen en herschrijven geweigerd',
    [parseExclusionPinBlock(extractExclusionPinBlock(tampered)!), 'error' in rewriteExclusionPin(tampered, records)], [undefined, true]);
  const extraRow = block.replace('\nconst ', `\n//   ${JSON.stringify([SHA, 'project', 'P3', '', '', 'x', DECISION])}\nconst `);
  eq('4h ingeschoven regel zonder nieuwe digest ⇒ niet terug te lezen', parseExclusionPinBlock(extraRow), undefined);
  eq('4i ontbrekend blok ⇒ herschrijven geweigerd', 'error' in rewriteExclusionPin('niets', records), true);
  const other = 'f'.repeat(64);
  eq('4j gewijzigde bestanden: alleen waar de lijst verschilt', [...changedExclusionFiles(records, [...records, { ...records[0]!, sha256: other }])], [other]);
  eq('4k reden gewijzigd telt als gewijzigd bestand', [...changedExclusionFiles(records, records.map(r => ({ ...r, reason: 'anders' })))], [SHA]);
  eq('4l ongewijzigd ⇒ leeg', changedExclusionFiles(records, [...records].reverse()).size, 0);
}

// ── 5. De cel-poort ─────────────────────────────────────────────────────────────────────────
{
  const META = { manifestSha256: 'c'.repeat(64), drivingPathOracle: new Map([[SHA, 'd'.repeat(64)]]) };
  const cells = (list: MeasuredCell[]) => buildCellBaseline(new Map([[SHA, list]]), META);
  const pinned = cells([
    { axis: 'es', id: 'P1/2', bucket: 'sameday', minutes: 60 },
    { axis: 'es', id: 'P2/10', bucket: 'sameday', minutes: 60 },
  ]);
  const afterExclusion = cells([]);
  const blind = () => false;
  const nowExcluded: CellExclusions = { now: (_file, id) => id === 'P1/2' || id.startsWith('P2/'), was: () => false };
  const excludedDelta = compareCells(pinned, afterExclusion, blind, nowExcluded);
  eq('5a nieuwe uitsluiting: verdwenen cellen zijn excludedCells, niet onmeetbaar', [excludedDelta.excludedCells.length, excludedDelta.unmeasurableCells.length], [2, 0]);
  eq('5b ... en alleen fileset-regels', cellGateRedLines(excludedDelta).map(line => line.kind), ['fileset', 'fileset']);
  eq('5c ... en de herpin mag (poort laat fileset alleen via =corpus toe)', planCellRepin(pinned, afterExclusion, blind, nowExcluded).allowed, true);
  const noExclusion = compareCells(pinned, afterExclusion, blind);
  eq('5d zonder uitsluitingswijziging blijft een verdwenen, onmeetbare cel hard', cellGateRedLines(noExclusion).map(line => line.kind), ['hard', 'hard']);
  eq('5e zonder uitsluitingswijziging weigert de herpin', planCellRepin(pinned, afterExclusion, blind).allowed, false);
  const stillExcluded: CellExclusions = { now: () => true, was: () => true };
  eq('5f al gepind uitgesloten maar toch een cel in de pin ⇒ hard (geen verklaring)', cellGateRedLines(compareCells(pinned, afterExclusion, blind, stillExcluded)).map(line => line.kind), ['hard', 'hard']);
  const reincluded: CellExclusions = { now: () => false, was: (_file, id) => id === 'P2/10' };
  const back = compareCells(afterExclusion, cells([{ axis: 'es', id: 'P2/10', bucket: 'diff', minutes: 1440 }]), () => true, reincluded);
  eq('5g opgeheven uitsluiting: terugkerende cel is reincluded (fileset), geen nieuwe cel', [back.reincludedCells.length, back.newCells.length, cellGateRedLines(back).map(line => line.kind)], [1, 0, ['fileset']]);
  const brandNew = compareCells(afterExclusion, cells([{ axis: 'es', id: 'P1/3', bucket: 'diff', minutes: 1440 }]), () => true, reincluded);
  eq('5h een cel die nooit uitgesloten was blijft een nieuwe, harde cel', cellGateRedLines(brandNew).map(line => line.kind), ['hard']);
  const shifted = buildCellBaseline(new Map([[SHA, []]]), { ...META, drivingPathOracle: new Map([[SHA, 'e'.repeat(64)]]) });
  eq('5i drivingPath-orakelhash verschoven door een gewijzigde uitsluiting ⇒ fileset', cellOracleRedLines(afterExclusion, shifted, new Set([SHA])).map(line => line.kind), ['fileset']);
  eq('5j ... zonder uitsluitingswijziging ⇒ hard', cellOracleRedLines(afterExclusion, shifted, new Set()).map(line => line.kind), ['hard']);
}

// ── 6. Mutanten van het mechanisme ─────────────────────────────────────────────────────────
{
  const truthOnly = measureXerProductFidelity(filterTruthExclusions(truthAll, resolved), SOLVED);
  eq('6a mutant "alleen de grondwaarheid filteren" ⇒ identiteitsfouten', truthOnly.identityErrors.length > 0, true);
  const solvedOnly = measureXerProductFidelity(truthAll, filterSolvedExclusions(SOLVED, resolved));
  eq('6b mutant "alleen de opgeloste kant filteren" ⇒ identiteitsfouten', solvedOnly.identityErrors.length > 0, true);
  // Een filter op taak-id zonder projectgrens zou in een ander project een gelijknamige taak raken.
  const crossProject = [...truthAll.tasks, { ...truthAll.tasks[3]!, projectId: 'P3', taskId: '2' }];
  const keys = resolveExclusions(crossProject, records.filter(record => record.kind === 'task')).taskKeys;
  eq('6c taakuitsluiting respecteert de projectgrens', [...keys], ['P1/2']);
  const withTwinTruth = { ...truthAll, tasks: crossProject };
  eq('6d filter houdt de gelijknamige taak in het andere project', filterTruthExclusions(withTwinTruth, resolveExclusions(crossProject, records.filter(record => record.kind === 'task'))).tasks.some(task => task.projectId === 'P3' && task.taskId === '2'), true);
}

if (diffs.length > 0) {
  console.log(`XX  manifestuitsluiting: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  manifestuitsluiting: ${checks} checks groen — lezer (decision verplicht), telling (X12 + X1), oplossen zonder stille no-op, digest-pin, cel-poort (fileset/hard), mutanten`);
