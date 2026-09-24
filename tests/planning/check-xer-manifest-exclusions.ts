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
  buildCellBaseline, cellDeltaLine, cellGateRedLines, cellOracleRedLines, compareCells, cellMinutesDigest, excludedHiddenRedLines, hiddenPerTask, hiddenTotal, cellRefCounts, parseCellBaseline,
  planCellRepin, serializeCellBaseline,
  type CellExclusions, type HiddenCounts, type MeasuredCell,
} from './fidelityCells';
import { buildXerTargetBaseline, type XerCorpusManifest, type XerSolvedProject } from './xerFidelity';
import { scanXerGroundTruth, XER_FIDELITY_AXES } from './xerGroundTruth';
import { measureXerProductFidelity } from './xerProductFidelity';
import {
  byDecisionDate, changedExclusionFiles, decisionProblem, exclusionHerpinCore, exclusionHerpinLine, exclusionIdentityChanged, exclusionLabelFor,
  exclusionsDigest, exclusionSummary, extractExclusionPinBlock, filterSolvedExclusions,
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
const DECISION = '2026-09-23 eigenaarsbesluit: fixture';
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
  // Critreview 2026-09-23: exact "JJJJ-MM-DD eigenaarsbesluit: <tekst>", bestaande datum, niet in de toekomst.
  refused('decision met niet-bestaande datum 2026-02-31', { ...VALID, decision: '2026-02-31 eigenaarsbesluit: fixture' });
  refused('decision in de verre toekomst 2099-01-01', { ...VALID, decision: '2099-01-01 eigenaarsbesluit: fixture' });
  refused('decision "geen eigenaarsbesluit"', { ...VALID, decision: '2026-09-23 geen eigenaarsbesluit: fixture' });
  refused('decision "… niet als eigenaarsbesluit …"', { ...VALID, decision: '2026-09-23 dit is niet als eigenaarsbesluit bedoeld' });
  refused('decision zonder dubbelepunt en tekst', { ...VALID, decision: '2026-09-23 eigenaarsbesluit' });
  refused('decision met lege tekst na de dubbelepunt', { ...VALID, decision: '2026-09-23 eigenaarsbesluit: ' });
  refused('decision met hoofdletters (niet exact)', { ...VALID, decision: '2026-09-23 Eigenaarsbesluit: fixture' });
  refused('reden korter dan 10 tekens', { decision: DECISION, excludeProjects: [{ projId: 'P2', reason: 'mutant' }] });
  eq('1e toekomst relatief aan vandaag: morgen mag (tijdzonespeling), overmorgen niet',
    [decisionProblem('2026-09-24 eigenaarsbesluit: fixture', '2026-09-23'), decisionProblem('2026-09-25 eigenaarsbesluit: fixture', '2026-09-23') !== undefined],
    [undefined, true]);
  eq('1f schrikkeldag bestaat alleen in een schrikkeljaar',
    [decisionProblem('2024-02-29 eigenaarsbesluit: fixture', '2026-09-23'), decisionProblem('2025-02-29 eigenaarsbesluit: fixture', '2026-09-23') !== undefined],
    [undefined, true]);
  const numeric = readManifestExclusions(manifestWith({ decision: DECISION, excludeTasks: [{ projId: 'P1', taskId: 12345, reason: 'fixture-reden-x' }] }));
  eq('1g taskId als getal ⇒ duidelijke melding', [numeric.records.length, numeric.problems.some(problem => problem.includes('taskId moet een string zijn') && problem.includes('"12345"'))], [0, true]);
  const numericProject = readManifestExclusions(manifestWith({ decision: DECISION, excludeProjects: [{ projId: 2665, reason: 'fixture-reden-x' }] }));
  eq('1h projId als getal ⇒ duidelijke melding', numericProject.problems.some(problem => problem.includes('projId moet een string zijn')), true);
  refused('uitsluiting op een reader-only-entry', VALID, 'reader-only');
  refused('lege excludeTasks', { ...VALID, excludeTasks: [] });
  refused('excludeProjects geen lijst', { ...VALID, excludeProjects: { projId: 'P2', reason: 'fixture-reden-x' } });
  refused('taak met taskId én taskCode', { decision: DECISION, excludeTasks: [{ projId: 'P1', taskId: '2', taskCode: 'A2', reason: 'fixture-reden-x' }] });
  refused('taak zonder taskId en taskCode', { decision: DECISION, excludeTasks: [{ projId: 'P1', reason: 'fixture-reden-x' }] });
  refused('lege reden', { decision: DECISION, excludeProjects: [{ projId: 'P2', reason: ' ' }] });
  refused('onbekende sleutel', { decision: DECISION, excludeProjects: [{ projId: 'P2', reason: 'fixture-reden-x', proj: 'P2' }] });
  refused('dubbele uitsluiting', { decision: DECISION, excludeTasks: [{ projId: 'P1', taskId: '2', reason: 'fixture-reden-x' }, { projId: 'P1', taskId: '2', reason: 'fixture-reden-y' }] });
  refused('taak onder een al uitgesloten project', { decision: DECISION, excludeProjects: [{ projId: 'P1', reason: 'fixture-reden-x' }], excludeTasks: [{ projId: 'P1', taskId: '2', reason: 'fixture-reden-y' }] });
  // Regel-decision (critreview C14-landing 24-09, datumherkomst): een latere uitsluiting draagt haar eigen
  // besluitdatum; de HERPIN-regel volgt die.
  const ruled = readManifestExclusions(manifestWith({ ...VALID, excludeTasks: [{ ...VALID.excludeTasks[0], decision: '2026-09-24 eigenaarsbesluit: later' }] }), '2026-09-24');
  eq('1i regel-decision: eigen datum per regel, entry-decision voor de rest',
    [ruled.problems, ruled.records.map(record => record.decision.slice(0, 10)).sort()], [[], ['2026-09-23', '2026-09-24']]);
  eq('1j HERPIN-regel draagt de datum van de regel',
    ruled.records.map(record => exclusionHerpinCore(record, LABEL).slice(0, 31)).sort(), ['uitsluiting (besluit 2026-09-23', 'uitsluiting (besluit 2026-09-24']);
  eq('1k HERPIN-regel toont herpindatum én besluitdatum; chronologisch op besluitdatum',
    byDecisionDate([...ruled.records].reverse()).map(record => exclusionHerpinLine(record, LABEL, '2026-09-25').slice(0, 52)),
    ['HERPIN 2026-09-25 uitsluiting (besluit 2026-09-23): ', 'HERPIN 2026-09-25 uitsluiting (besluit 2026-09-24): ']);
  refused('regel-decision vóór de entrydatum', { ...VALID, excludeTasks: [{ ...VALID.excludeTasks[0], decision: '2026-09-22 eigenaarsbesluit: eerder' }] });
  refused('regel-decision in een ongeldige vorm', { ...VALID, excludeProjects: [{ ...VALID.excludeProjects[0], decision: '2026-09-24 akkoord' }] });
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
  const ghost = buildXerTargetBaseline(files, manifestWith({ decision: DECISION, excludeProjects: [{ projId: 'P9', reason: 'fixture-reden-x' }] }));
  eq('2l X1 weigert een uitsluiting die niets raakt', ghost.errors.some(error => error.includes('raakt geen enkele orakeltaak')), true);
}

// ── 3. Oplossen: nooit een stille no-op ─────────────────────────────────────────────────────
{
  const record = (extra: Partial<XerExclusionRecord>): XerExclusionRecord => ({ sha256: SHA, kind: 'task', projId: 'P1', reason: 'fixture-reden-x', decision: DECISION, ...extra });
  eq('3a onbekend project ⇒ probleem', resolveExclusions(truthAll.tasks, [record({ kind: 'project', projId: 'P9' })]).problems.length, 1);
  eq('3b onbekende taskId ⇒ probleem', resolveExclusions(truthAll.tasks, [record({ taskId: '99' })]).problems.length, 1);
  eq('3c taskId van een ander project ⇒ probleem', resolveExclusions(truthAll.tasks, [record({ taskId: '10' })]).problems.length, 1);
  const twice = [...truthAll.tasks, { ...truthAll.tasks[0]!, taskId: '4' }];
  eq('3d dubbelzinnige taakcode ⇒ probleem (gebruik taskId)', resolveExclusions(twice, [record({ taskCode: 'A1' })]).problems.some(problem => problem.includes('dubbelzinnig')), true);
  eq('3e taskId-uitsluiting raakt precies één taak', [...resolveExclusions(truthAll.tasks, [record({ taskId: '3' })]).taskKeys], ['P1/3']);
  const both = resolveExclusions(truthAll.tasks, [record({ taskId: '2' }), record({ taskCode: 'A2' })]);
  eq('3f dezelfde taak via taskId én taskCode ⇒ dubbel-fout', both.problems.some(problem => problem.includes('dubbel')), true);
  const viaReader = buildXerTargetBaseline([{ label: LABEL, bytes: XER }], manifestWith({ decision: DECISION,
    excludeTasks: [{ projId: 'P1', taskId: '2', reason: 'fixture-reden-x' }, { projId: 'P1', taskCode: 'A2', reason: 'fixture-reden-y' }] }));
  eq('3g ... ook via het manifest (X1 weigert)', viaReader.errors.some(error => error.includes('dubbel')), true);
}

// ── 4. De pin ───────────────────────────────────────────────────────────────────────────────
{
  const block = renderExclusionPinBlock(records);
  eq('4a blok ⇄ lijst (render en parse)', parseExclusionPinBlock(block), [...records].sort((a, b) => a.kind.localeCompare(b.kind)));
  eq('4b leeg blok heeft de lege digest', exclusionsDigest([]), createHash('sha256').update('[]').digest('hex'));
  eq('4c digest verandert bij een andere reden', exclusionsDigest(records) !== exclusionsDigest(records.map(r => ({ ...r, reason: `${r.reason}!` }))), true);
  eq('4d digest verandert bij een ander besluit', exclusionsDigest(records) !== exclusionsDigest(records.map(r => ({ ...r, decision: '2026-09-22 eigenaarsbesluit: ander besluit' }))), true);
  eq('4e digest is volgorde-onafhankelijk', exclusionsDigest(records), exclusionsDigest([...records].reverse()));
  const source = `voor\n${renderExclusionPinBlock([])}\nna\n`;
  const rewritten = rewriteExclusionPin(source, records);
  eq('4f herschrijven vanaf een ongeschonden blok', 'text' in rewritten ? extractExclusionPinBlock(rewritten.text) === block : rewritten.error, true);
  const tampered = source.replace(/'[0-9a-f]{64}'/, `'${'1'.repeat(64)}'`);
  eq('4g met de hand bewerkt blok ⇒ niet terug te lezen en herschrijven geweigerd',
    [parseExclusionPinBlock(extractExclusionPinBlock(tampered)!), 'error' in rewriteExclusionPin(tampered, records)], [undefined, true]);
  const extraRow = block.replace('\nconst ', `\n//   ${JSON.stringify([SHA, 'project', 'P3', '', '', 'fixture-reden-x', DECISION])}\nconst `);
  eq('4h ingeschoven regel zonder nieuwe digest ⇒ niet terug te lezen', parseExclusionPinBlock(extraRow), undefined);
  eq('4i ontbrekend blok ⇒ herschrijven geweigerd', 'error' in rewriteExclusionPin('niets', records), true);
  const other = 'f'.repeat(64);
  eq('4j gewijzigde bestanden: alleen waar de lijst verschilt', [...changedExclusionFiles(records, [...records, { ...records[0]!, sha256: other }])], [other]);
  eq('4k reden gewijzigd telt als gewijzigd bestand', [...changedExclusionFiles(records, records.map(r => ({ ...r, reason: 'anders' })))], [SHA]);
  eq('4l ongewijzigd ⇒ leeg', changedExclusionFiles(records, [...records].reverse()).size, 0);
  // Identiteitsset (critreview 2026-09-23): alleen een andere set projecten/taken telt voor de meting.
  const reasonOnly = resolveExclusions(truthAll.tasks, records.map(r => ({ ...r, reason: 'andere reden, zelfde set' })));
  eq('4m alleen een andere reden ⇒ identiteit ongewijzigd (dekking/cellen blijven hard)', exclusionIdentityChanged(resolved, reasonOnly), false);
  eq('4n taskCode ⇄ taskId voor dezelfde taak ⇒ identiteit ongewijzigd',
    exclusionIdentityChanged(resolveExclusions(truthAll.tasks, [{ ...records[1]!, taskCode: undefined, taskId: '2' }]),
      resolveExclusions(truthAll.tasks, [records[1]!])), false);
  eq('4o een taak meer ⇒ identiteit gewijzigd', exclusionIdentityChanged(resolved, resolveExclusions(truthAll.tasks, records.filter(r => r.kind === 'project'))), true);
  const manifest = manifestWith(VALID);
  eq('4p HERPIN-regel letterlijk uit het record, met het manifestlabel',
    exclusionHerpinLine(records.find(r => r.kind === 'project')!, exclusionLabelFor(manifest, SHA), '2026-09-24'),
    `HERPIN 2026-09-24 uitsluiting (besluit 2026-09-23): ${LABEL} — P2 niet door P6 doorgerekend`);
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
  eq('5k CELLDELTA noemt het aantal door uitsluiting weggevallen cellen', cellDeltaLine('p6', excludedDelta, afterExclusion).endsWith(' uitgesloten=2 teruggekeerd=0'), true);

  // Verborgen aantallen: niet-stijgende pin PER TAAK (critreview 2026-09-23 punt 6; per taak sinds de
  // her-check C14-landfixes 2026-09-24). X = P1/1, Y = P1/2, Z = P2/10 (fictieve taken).
  const c = (sixAxis: number, drivingPath: number): HiddenCounts => ({ sixAxis, drivingPath });
  const kinds = (lines: { kind: string }[]) => lines.map(line => line.kind);
  const ex = (now: string[], was: string[]): CellExclusions => ({ now: (_file, id) => now.includes(id), was: (_file, id) => was.includes(id) });
  const same = ex(['P1/1', 'P1/2'], ['P1/1', 'P1/2']);
  const none = new Set<string>();
  const changed = new Set([SHA]);
  const pin = { [SHA]: { 'P1/1': c(4, 2) } };
  eq('5l gelijk ⇒ niets', excludedHiddenRedLines(pin, pin, none, same), { lines: [], lower: [] });
  eq('5m gestegen (zelfde uitsluiting) ⇒ hard', kinds(excludedHiddenRedLines(pin, { [SHA]: { 'P1/1': c(5, 2) } }, none, same).lines), ['hard']);
  eq('5n drivingPath gestegen ⇒ hard', kinds(excludedHiddenRedLines(pin, { [SHA]: { 'P1/1': c(1, 3) } }, none, same).lines), ['hard']);
  const lowered = excludedHiddenRedLines(pin, { [SHA]: { 'P1/1': c(3, 2) } }, none, same);
  eq('5o gedaald ⇒ geen rood, te herpinnen', [lowered.lines, lowered.lower.length], [[], 1]);
  eq('5o2 totaal gelijk maar X +1 en Y −1 ⇒ hard (per taak, geen speelruimte tussen taken)',
    kinds(excludedHiddenRedLines({ [SHA]: { 'P1/1': c(4, 0), 'P1/2': c(2, 0) } }, { [SHA]: { 'P1/1': c(5, 0), 'P1/2': c(1, 0) } }, none, same).lines), ['hard']);
  eq('5q uitsluiting zonder gepinde aantallen ⇒ hard', kinds(excludedHiddenRedLines(undefined, pin, none, same).lines), ['hard']);
  eq('5r gepinde aantallen zonder uitsluiting ⇒ hard', kinds(excludedHiddenRedLines(pin, {}, none, same).lines), ['hard']);
  // M1 (her-check 2026-09-24): pin 10 = X 7 + Y 3; Y weer meegeteld zonder afwijking, X stijgt 7 → 10. Met een
  // bestandstotaal gaf dit [] (Y's 3 werd speelruimte voor X); per taak is het hard.
  const xy = { [SHA]: { 'P1/1': c(7, 0), 'P1/2': c(3, 0) } };
  const yBack = ex(['P1/1'], ['P1/1', 'P1/2']);
  eq('5p M1 Y weer meegeteld, X 7 → 10 ⇒ hard', kinds(excludedHiddenRedLines(xy, { [SHA]: { 'P1/1': c(10, 0) } }, changed, yBack).lines), ['hard']);
  eq('5p1 controle: Y weer meegeteld (0 cellen), X gelijk ⇒ fileset (Y-pin vervalt)',
    kinds(excludedHiddenRedLines(xy, { [SHA]: { 'P1/1': c(7, 0) } }, changed, yBack).lines), ['fileset']);
  eq('5p2 Y weer meegeteld met 4 cellen > eigen pin 3 ⇒ hard',
    kinds(excludedHiddenRedLines(xy, { [SHA]: { 'P1/1': c(7, 0) } }, changed, yBack, {}, { [SHA]: { 'P1/2': c(4, 0) } }).lines), ['hard']);
  eq('5p3 Y weer meegeteld met 3 cellen = eigen pin ⇒ fileset',
    kinds(excludedHiddenRedLines(xy, { [SHA]: { 'P1/1': c(7, 0) } }, changed, yBack, {}, { [SHA]: { 'P1/2': c(3, 0) } }).lines), ['fileset']);
  // Nieuwe uitsluiting (vorm HarbourPointe EC1420): Z nieuw uitgesloten, gepinde baseline had 1 cel op Z.
  const zNew = ex(['P1/1', 'P2/10'], ['P1/1']);
  const hp = { [SHA]: { 'P1/1': c(33, 0) } };
  const zGone = { [SHA]: { 'P2/10': c(1, 0) } };
  eq('5p4 Z nieuw uitgesloten met 1 = zijn gepinde cel ⇒ fileset',
    kinds(excludedHiddenRedLines(hp, { [SHA]: { 'P1/1': c(33, 0), 'P2/10': c(1, 0) } }, changed, zNew, zGone).lines), ['fileset']);
  eq('5p5 Z nieuw uitgesloten met 2 > 1 gepinde cel ⇒ hard',
    kinds(excludedHiddenRedLines(hp, { [SHA]: { 'P1/1': c(33, 0), 'P2/10': c(2, 0) } }, changed, zNew, zGone).lines), ['hard']);
  eq('5p6 M2: X 33 → 34 gemaskeerd door Z 1 → 0 ⇒ hard',
    kinds(excludedHiddenRedLines(hp, { [SHA]: { 'P1/1': c(34, 0) } }, changed, zNew, zGone).lines), ['hard']);
  eq('5p7 M3: Z 2 > 1 gemaskeerd door X 33 → 32 ⇒ hard',
    kinds(excludedHiddenRedLines(hp, { [SHA]: { 'P1/1': c(32, 0), 'P2/10': c(2, 0) } }, changed, zNew, zGone).lines), ['hard']);
  eq('5p8 pin op een taak die nergens uitgesloten is ⇒ hard',
    kinds(excludedHiddenRedLines({ [SHA]: { 'P1/1': c(1, 0), 'P1/3': c(1, 0) } }, { [SHA]: { 'P1/1': c(1, 0) } }, changed, ex(['P1/1'], ['P1/1'])).lines), ['hard']);
  // Fable (e), corpusloos met fictieve cellen: P2 heeft in de gepinde baseline 0 zesassige en 2 drivingPath-
  // cellen; +ff-regressie op alleen P2 en tegelijk excludeProjects P2 ⇒ hard; eerlijke uitsluiting ⇒ fileset.
  const pinnedP2 = cells([
    { axis: 'es', id: 'P1/2', bucket: 'diff', minutes: 1440 },
    { axis: 'drivingPath', id: 'P2/10', bucket: 'diff', minutes: null },
    { axis: 'drivingPath', id: 'P2/11', bucket: 'diff', minutes: null },
  ]);
  const afterP2 = cells([{ axis: 'es', id: 'P1/2', bucket: 'diff', minutes: 1440 }]);
  const p2Excluded: CellExclusions = { now: (_file, id) => id.startsWith('P2/'), was: () => false };
  const p2Delta = compareCells(pinnedP2, afterP2, () => true, p2Excluded);
  const p2Gone = cellRefCounts(p2Delta.excludedCells);
  eq('5p9 cellRefCounts per taak: weggevallen cellen op P2', p2Gone, { [SHA]: { 'P2/10': c(0, 1), 'P2/11': c(0, 1) } });
  eq('5p10 Fable (e) fictief: eerlijke uitsluiting van P2 ⇒ fileset',
    kinds(excludedHiddenRedLines(undefined, { [SHA]: { 'P2/10': c(0, 1), 'P2/11': c(0, 1) } }, changed, p2Excluded, p2Gone).lines), ['fileset']);
  eq('5p11 Fable (e) fictief: +ff-regressie op P2 én uitsluiting van P2 ⇒ hard',
    kinds(excludedHiddenRedLines(undefined, { [SHA]: { 'P2/10': c(1, 1), 'P2/11': c(1, 1) } }, changed, p2Excluded, p2Gone).lines), ['hard']);
  const deltas = [
    { projectId: 'P1', taskId: '1', axis: 'es' }, { projectId: 'P1', taskId: '1', axis: 'drivingPath' },
    { projectId: 'P1', taskId: '2', axis: 'ef' }, { projectId: 'P1', taskId: '3', axis: 'tf' },
  ];
  eq('5p12 hiddenPerTask telt per taak, alleen de gevraagde, drivingPath apart',
    [hiddenPerTask(deltas, new Set(['P1/1', 'P1/2'])), hiddenPerTask(deltas, new Set(['P1/4']))],
    [{ 'P1/1': c(1, 1), 'P1/2': c(1, 0) }, {}]);
  eq('5p13 hiddenTotal telt op', hiddenTotal({ 'P1/1': c(1, 1), 'P1/2': c(2, 0) }), c(3, 1));
  const withHidden = { ...cells([{ axis: 'es', id: 'P1/1', bucket: 'sameday', minutes: 60 }]), excludedHidden: pin };
  const text = serializeCellBaseline(withHidden);
  eq('5s excludedHidden round-tript canoniek door het cellenbestand', [parseCellBaseline(text).problems, parseCellBaseline(text).baseline?.excludedHidden], [[], pin]);
  const without = serializeCellBaseline({ ...withHidden, excludedHidden: {} });
  eq('5t leeg ⇒ sectie weggelaten (bestand byte-gelijk aan de vorm zonder veld)', [without.includes('excludedHidden'), parseCellBaseline(without).problems], [false, []]);
  eq('5u lege sectie met de hand ⇒ geweigerd', parseCellBaseline(without.replace(/\n}\n$/, ',\n  "excludedHidden": {}\n}\n')).problems.length > 0, true);
  eq('5v sectie op een niet-gemeten bestand ⇒ geweigerd', parseCellBaseline(text.replace(`"excludedHidden": {\n    "${SHA}"`, `"excludedHidden": {\n    "${'e'.repeat(64)}"`)).problems.length > 0, true);
  eq('5w negatieve of gebroken telling ⇒ geweigerd', parseCellBaseline(text.replace('"sixAxis": 4', '"sixAxis": -1')).problems.length > 0, true);
  eq('5x taak met 0/0 ⇒ geweigerd', parseCellBaseline(serializeCellBaseline({ ...withHidden, excludedHidden: { [SHA]: { 'P1/1': c(0, 0) } } })).problems.length > 0, true);
  eq('5y taak-id in de verkeerde vorm ⇒ geweigerd', parseCellBaseline(text.replace('"P1/1": {\n        "sixAxis"', '"P1 1": {\n        "sixAxis"')).problems.length > 0, true);
  eq('5z bestand met uitsluiting zonder verborgen afwijking (leeg object) ⇒ geldig',
    parseCellBaseline(serializeCellBaseline({ ...withHidden, excludedHidden: { [SHA]: {} } })).problems, []);
  eq('5z2 een opgehoogde per-taakpin verandert cellMinutesDigest (v2-envelop vangt handwerk)',
    cellMinutesDigest(withHidden) !== cellMinutesDigest({ ...withHidden, excludedHidden: { [SHA]: { 'P1/1': c(5, 2) } } }), true);
  eq('5z3 zonder sectie: cellMinutesDigest ongewijzigd t.o.v. de vorm zonder verborgen aantallen',
    cellMinutesDigest({ ...withHidden, excludedHidden: undefined }), cellMinutesDigest(cells([{ axis: 'es', id: 'P1/1', bucket: 'sameday', minutes: 60 }])));
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
