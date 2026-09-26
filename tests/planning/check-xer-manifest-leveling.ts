/**
 * Corpusloze fixtures en mutanten voor het manifestveld `leveledProjects` (`xerManifestLeveling.ts`,
 * etappe P6-nivellering FUNDAMENT: mechanisme zonder data).
 *
 *  1. De lezer: geldige regels canoniek; afwezig ⇒ niets; op een niet-orakel, geen lijst, leeg, zonder
 *     of met een ongeldig besluit, te korte reden, numeriek projId, onbekende sleutel of dubbel ⇒ geweigerd.
 *     Byte-identieke orakellabels met een verschillende lijst ⇒ geweigerd.
 *  2. Geen invloed op de telling: de X1-doelbaseline met een geldige `leveledProjects` is byte-gelijk aan
 *     die zonder; een ongeldige wordt door X1 geweigerd (net als een ongeldige uitsluiting).
 *  3. Oplossen: een regel voor een project dat niet in het bestand staat is een fout.
 *  4. De stand van het echte manifest: NUL regels. Een eerste regel is een eigenaarsbesluit
 *     (eigenaarsbeslissing 2, onderzoek 2026-09-24 §7 stap 6) en werkt deze pin bewust bij.
 *
 * Mutanten: `decisionProblem` overslaan ⇒ 1b rood; het veld in `buildXerTargetBaseline` meetellen
 * (bv. projecten wegfilteren) ⇒ 2a rood; `resolveLeveledProjects` altijd raak ⇒ 3a rood.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildXerTargetBaseline, type XerCorpusManifest } from './xerFidelity';
import { scanXerGroundTruth } from './xerGroundTruth';
import { leveledSummary, readManifestLeveledProjects, resolveLeveledProjects } from './xerManifestLeveling';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

const FIELDS = ['proj_id', 'task_id', 'task_code', 'status_code', 'early_start_date', 'early_end_date',
  'late_start_date', 'late_end_date', 'total_float_hr_cnt', 'free_float_hr_cnt', 'driving_path_flag'];
const row = (project: string, id: string, day: string) => ['%R', project, id, `C${id}`, 'TK_NotStart',
  `2026-01-0${day} 08:00`, `2026-01-0${day} 17:00`, `2026-01-0${day} 08:00`, `2026-01-0${day} 17:00`, '0', '0', 'Y'].join('\t');
const XER = new TextEncoder().encode(['%T\tTASK', `%F\t${FIELDS.join('\t')}`,
  row('P1', '1', '5'), row('P1', '2', '6'), row('P2', '10', '5'), '%E'].join('\n'));
const SHA = createHash('sha256').update(XER).digest('hex');
const LABEL = 'mini/leveled.xer';
const DECISION = '2026-09-23 eigenaarsbesluit: fixture nivellering';
function manifestWith(extra: Record<string, unknown>, role = 'oracle'): XerCorpusManifest {
  return {
    version: 1, policy: 'fixture',
    files: { [LABEL]: {
      sha256: SHA, source: 'fixture', role: role as 'oracle', included: role === 'oracle',
      ...(role === 'oracle' ? {} : { exclusionReason: 'fixture' }), ...extra,
    } },
  };
}
const VALID = { leveledProjects: [{ projId: 'P1', decision: DECISION, reason: 'P6 nivelleerde PM-1 in P1' }] };
const refusedBy = (extra: Record<string, unknown>, role = 'oracle') => {
  const read = readManifestLeveledProjects(manifestWith(extra, role));
  return read.problems.length > 0 && read.records.length === 0;
};

// ── 1. De lezer ──────────────────────────────────────────────────────────────────────────────
{
  const read = readManifestLeveledProjects(manifestWith(VALID));
  eq('1a geldige regel: één record, geen problemen', [read.problems, read.records],
    [[], [{ sha256: SHA, projId: 'P1', decision: DECISION, reason: 'P6 nivelleerde PM-1 in P1' }]]);
  eq('1a afwezig veld: niets', readManifestLeveledProjects(manifestWith({})), { records: [], bySha: new Map(), problems: [] });
  const cases: Array<[string, Record<string, unknown>, string?]> = [
    ['1b zonder decision', { leveledProjects: [{ projId: 'P1', reason: 'P6 nivelleerde PM-1' }] }],
    ['1b decision zonder "eigenaarsbesluit"', { leveledProjects: [{ projId: 'P1', decision: '2026-09-23 besluit: x', reason: 'P6 nivelleerde PM-1' }] }],
    ['1b decision in de toekomst', { leveledProjects: [{ projId: 'P1', decision: '2999-01-01 eigenaarsbesluit: x', reason: 'P6 nivelleerde PM-1' }] }],
    ['1c te korte reden', { leveledProjects: [{ projId: 'P1', decision: DECISION, reason: 'kort' }] }],
    ['1c numeriek projId', { leveledProjects: [{ projId: 9033, decision: DECISION, reason: 'P6 nivelleerde PM-1' }] }],
    ['1c onbekende sleutel', { leveledProjects: [{ projId: 'P1', decision: DECISION, reason: 'P6 nivelleerde PM-1', leveled: true }] }],
    ['1c dubbel project', { leveledProjects: [VALID.leveledProjects[0], VALID.leveledProjects[0]] }],
    ['1d geen lijst', { leveledProjects: VALID.leveledProjects[0] }],
    ['1d lege lijst', { leveledProjects: [] }],
    ['1d element geen object', { leveledProjects: ['P1'] }],
    ['1e op een niet-orakel', VALID, 'reader-only'],
  ];
  for (const [label, extra, role] of cases) eq(`${label} ⇒ geweigerd`, refusedBy(extra, role), true);

  // Een project dat zowel genivelleerd gemeten als uitgesloten zou worden is tegenstrijdig: de uitsluiting
  // haalt het uit de meting, de nivelleerregel zegt hoe het gemeten moet worden. Weigeren, niet kiezen.
  const both = readManifestLeveledProjects(manifestWith({ ...VALID, decision: DECISION,
    excludeProjects: [{ projId: 'P1', reason: 'fixture-uitsluiting van P1' }] }));
  eq('1g project in zowel leveledProjects als excludeProjects ⇒ geweigerd',
    [both.records.length, both.problems.some(problem => problem.includes('excludeProjects'))], [0, true]);
  const other = readManifestLeveledProjects(manifestWith({ ...VALID, decision: DECISION,
    excludeProjects: [{ projId: 'P2', reason: 'fixture-uitsluiting van P2' }] }));
  eq('1g ander project uitgesloten ⇒ geen probleem', [other.problems, other.records.length], [[], 1]);
  const twin: XerCorpusManifest = manifestWith(VALID);
  twin.files['mini/twin.xer'] = { sha256: SHA, source: 'fixture', role: 'oracle', included: true };
  eq('1f byte-identieke orakellabels met verschillende lijsten ⇒ geweigerd',
    readManifestLeveledProjects(twin).problems.some(problem => problem.includes('verschillende leveledProjects')), true);
}

// ── 2. Geen invloed op de telling ────────────────────────────────────────────────────────────
{
  const files = [{ label: LABEL, bytes: XER }];
  const without = buildXerTargetBaseline(files, manifestWith({}));
  const withLeveled = buildXerTargetBaseline(files, manifestWith(VALID));
  eq('2a X1-doelbaseline met een geldige leveledProjects is gelijk aan die zonder (telt nergens mee)',
    [withLeveled.errors, JSON.stringify(withLeveled.baseline), JSON.stringify(withLeveled.stats)],
    [[], JSON.stringify(without.baseline), JSON.stringify(without.stats)]);
  const refused = buildXerTargetBaseline(files, manifestWith({ leveledProjects: [{ projId: 'P1', reason: 'P6 nivelleerde PM-1' }] }));
  eq('2b X1 weigert een leveledProjects-regel zonder eigenaarsbesluit', refused.errors.some(error => error.includes('decision')), true);
}

// ── 3. Oplossen tegen de grondwaarheid + samenvatting ──────────────────────────────────────────
{
  const projects = scanXerGroundTruth(XER).projects;
  const hit = resolveLeveledProjects(projects, readManifestLeveledProjects(manifestWith(VALID)).records);
  eq('3a bestaand project wordt geraakt', hit, { projects: ['P1'], problems: [] });
  const ghost = resolveLeveledProjects(projects, [{ sha256: SHA, projId: 'P9', decision: DECISION, reason: 'bestaat niet in het bestand' }]);
  eq('3a project dat niet bestaat is een fout, geen no-op', [ghost.projects, ghost.problems.length], [[], 1]);
  const summary = leveledSummary([{ label: LABEL, records: readManifestLeveledProjects(manifestWith(VALID)).records }]);
  eq('3b samenvatting noemt het aantal, het project en de reden', [summary.projects,
    summary.line.startsWith('genivelleerd volgens eigenaar: 1 projecten — '), summary.line.includes('P6 nivelleerde PM-1 in P1')],
  [1, true, true]);
  eq('3b lege samenvatting is expliciet nul', leveledSummary([]).line, 'genivelleerd volgens eigenaar: 0 projecten');
}

// ── 4. Stand van het echte manifest ─────────────────────────────────────────────────────────
{
  const manifest = JSON.parse(readFileSync(new URL('./xer-corpus-manifest.json', import.meta.url), 'utf8')) as XerCorpusManifest;
  const read = readManifestLeveledProjects(manifest);
  eq('4 echte manifest: leveledProjects geldig en (nog) leeg — een eerste regel is eigenaarsbeslissing 2',
    [read.problems, read.records.length], [[], 0]);
}

if (diffs.length > 0) {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  xer-manifest-leveling: ${diffs.length}/${checks} checks GEFAALD`);
  process.exit(1);
}
console.log(`OK  xer-manifest-leveling: alle checks groen (${checks})`);
