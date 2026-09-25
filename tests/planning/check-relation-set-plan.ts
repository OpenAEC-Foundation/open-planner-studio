import type { Sequence, SequenceType } from '@/types/sequence';
import type { ExternalLink, Task } from '@/types/task';
import {
  applyRelationMutationPlan,
  isParsedRelationTokenArray,
  planRelationSet,
  type ParsedInternalRelationToken,
  type ParsedRelationToken,
} from '@/engine/taskGrid/relationPlan';
import {
  formatExternalRelationClipboard,
  parseExternalRelationClipboard,
} from '@/engine/taskGrid/relationFormat';
import { detectCycleInEdges } from '@/engine/scheduler/graphWalk';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, value: boolean): void { eq(label, value, true); }

function task(
  id: string,
  wbsCode: string,
  options: { parentId?: string | null; childIds?: string[]; externalLinks?: ExternalLink[] } = {},
): Task {
  return {
    id, wbsCode, name: id, parentId: options.parentId ?? null,
    childIds: options.childIds ?? [], externalLinks: options.externalLinks,
  } as unknown as Task;
}

function seq(
  id: string,
  predecessorId: string,
  successorId: string,
  type: SequenceType = 'FINISH_START',
  lagDays = 0,
): Sequence {
  return { id, predecessorId, successorId, type, lagDays };
}

let tokenIndex = 0;
function internal(
  wbsCode: string,
  relType: 'FS' | 'SS' | 'FF' | 'SF' = 'FS',
  lagText = '',
  relationId?: string,
): ParsedInternalRelationToken {
  const index = tokenIndex++;
  return {
    kind: 'internal', wbsCode, relType, lagText, relationId,
    source: { index, start: index * 10, end: index * 10 + 5, text: `${wbsCode} ${relType}${lagText}` },
  };
}

function errorsOf(result: ReturnType<typeof planRelationSet>): string[] {
  return result.ok ? [] : result.errors.map(error => error.code);
}

const A = task('A', '1.1');
const B = task('B', '1.2');
const C = task('C', '1.3');
const D = task('D', '1.4');
const baseTasks = [A, B, C, D];

// Eén cel is de volledige gewenste set: A blijft maar krijgt lag, B verdwijnt, C komt erbij.
{
  const existing = [seq('s-a', 'A', 'D'), seq('s-b', 'B', 'D', 'START_START')];
  const result = planRelationSet({
    tasks: baseTasks, sequences: existing, ownerTaskId: 'D', direction: 'predecessor',
    tokens: [internal('1.1', 'FS', '+2d'), internal('1.3', 'FF')],
  });
  ok('add/update/remove-set slaagt', result.ok);
  if (result.ok) {
    eq('lagwijziging is update met bestaand id', result.value.sequenceUpdates.map(item => item.id), ['s-a']);
    eq('verdwenen token wordt verwijderd', result.value.sequenceRemovals, ['s-b']);
    eq('nieuwe token wordt toegevoegd zonder vooraf verzonnen id', result.value.sequenceAdditions, [{
      predecessorId: 'C', successorId: 'D', type: 'FINISH_FINISH', lagDays: 0,
    }]);
    eq('nieuwe lag wist alle hogere-precedentievelden', result.value.sequenceUpdates[0]?.sequence, {
      predecessorId: 'A', successorId: 'D', type: 'FINISH_START', lagDays: 2, id: 's-a',
    });
  }
}

// Exacte key en editor-idmetadata behouden ids; een eenduidige typewisseling ook.
{
  const existing = [seq('keep-exact', 'A', 'D'), seq('keep-meta', 'B', 'D'), seq('keep-type', 'C', 'D')];
  const result = planRelationSet({
    tasks: baseTasks, sequences: existing, ownerTaskId: 'D', direction: 'predecessor',
    tokens: [
      internal('1.1', 'FS'),
      internal('1.2', 'SS', '+1.5u', 'keep-meta'),
      internal('1.3', 'FF'),
    ],
  });
  ok('id-behoudset slaagt', result.ok);
  if (result.ok) {
    eq('exacte key blijft no-op en wordt niet herschreven', result.value.sequenceUpdates.some(item => item.id === 'keep-exact'), false);
    eq('metadata-id wint bij type/lagwijziging', result.value.sequenceUpdates.find(item => item.id === 'keep-meta')?.sequence, {
      predecessorId: 'B', successorId: 'D', type: 'START_START', lagDays: 0, lagMinutes: 90,
      id: 'keep-meta',
    });
    eq('eenduidige typefallback behoudt id', result.value.sequenceUpdates.find(item => item.id === 'keep-type')?.sequence.type, 'FINISH_FINISH');
  }
}

// Meerdere typen op hetzelfde paar: exacte keys blijven, maar de overige keuze krijgt niet
// willekeurig het id van "de eerste" oude relatie.
{
  const existing = [seq('multi-fs', 'A', 'D'), seq('multi-ss', 'A', 'D', 'START_START')];
  const result = planRelationSet({
    tasks: baseTasks, sequences: existing, ownerTaskId: 'D', direction: 'predecessor',
    tokens: [internal('1.1', 'FS'), internal('1.1', 'FF')],
  });
  ok('veel-type-set zelf is geldig', result.ok);
  if (result.ok) {
    eq('exact FS-id blijft behouden zonder update', result.value.sequenceUpdates.some(item => item.id === 'multi-fs'), false);
    eq('ambigue oude SS wordt verwijderd', result.value.sequenceRemovals, ['multi-ss']);
    eq('nieuwe FF is add en erft geen willekeurig id', result.value.sequenceAdditions.map(item => item.type), ['FINISH_FINISH']);
  }
}

// Tokenfouten hebben precieze tokenposities en er komt nooit een half plan terug.
{
  const duplicate = planRelationSet({
    tasks: baseTasks, sequences: [], ownerTaskId: 'D', direction: 'predecessor',
    tokens: [internal('1.1'), internal('1.1')],
  });
  eq('exact duplicaat wordt geweigerd', errorsOf(duplicate), ['duplicate', 'duplicate']);
  if (!duplicate.ok) eq('duplicaatfouten wijzen beide tokenindices aan', duplicate.errors.map(error => error.tokenIndex), [tokenIndex - 2, tokenIndex - 1]);

  eq('zelfrelatie wordt geweigerd', errorsOf(planRelationSet({
    tasks: baseTasks, sequences: [], ownerTaskId: 'D', direction: 'predecessor', tokens: [internal('1.4')],
  })), ['self']);
  eq('onbekende WBS wordt geweigerd', errorsOf(planRelationSet({
    tasks: baseTasks, sequences: [], ownerTaskId: 'D', direction: 'predecessor', tokens: [internal('9.9')],
  })), ['unknownWbs']);
  const duplicateWbsTasks = [...baseTasks, task('A2', '1.1')];
  eq('gelijke WBS is ambigu en wordt geweigerd', errorsOf(planRelationSet({
    tasks: duplicateWbsTasks, sequences: [], ownerTaskId: 'D', direction: 'predecessor', tokens: [internal('1.1')],
  })), ['ambiguousWbs']);
  eq('ongeldige interne lag wordt geweigerd', errorsOf(planRelationSet({
    tasks: baseTasks, sequences: [], ownerTaskId: 'D', direction: 'predecessor', tokens: [internal('1.1', 'FS', '+2x')],
  })), ['invalidLag']);
}

// Voorouderregel komt uit de centrale relationRules, ook in de setplanner.
{
  const parent = task('P', '2', { childIds: ['K'] });
  const child = task('K', '2.1', { parentId: 'P' });
  const result = planRelationSet({
    tasks: [parent, child], sequences: [], ownerTaskId: 'P', direction: 'predecessor',
    tokens: [internal('2.1')],
  });
  eq('kind naar eigen ouder wordt geweigerd', errorsOf(result), ['ancestor']);
}

// De planner valideert de finale set, niet "oude + nieuwe". Een reeds corrupte kring mag worden
// hersteld door de betrokken cel leeg te maken; omgekeerd wordt een nieuwe finale kring geweigerd.
{
  const cyclicExisting = [seq('ab', 'A', 'B'), seq('bc', 'B', 'C'), seq('ca', 'C', 'A')];
  const repair = planRelationSet({
    tasks: baseTasks, sequences: cyclicExisting, ownerTaskId: 'C', direction: 'successor', tokens: [],
  });
  ok('verwijderen uit een bestaande kring valideert tegen de herstelde eindgraaf', repair.ok);
  const newCycle = planRelationSet({
    tasks: baseTasks, sequences: [seq('ab', 'A', 'B'), seq('bc', 'B', 'C')],
    ownerTaskId: 'C', direction: 'successor', tokens: [internal('1.1')],
  });
  eq('cyclus die pas in de finale set ontstaat wordt geweigerd', errorsOf(newCycle), ['cycle']);
}

// Summarysemantiek: directe eindpunten lijken acyclisch, maar expansie naar bladtaken onthult de kring.
{
  const summary = task('S', '3', { childIds: ['X', 'Y'] });
  const x = task('X', '3.1', { parentId: 'S' });
  const y = task('Y', '3.2', { parentId: 'S' });
  const z = task('Z', '4');
  const result = planRelationSet({
    tasks: [summary, x, y, z], sequences: [seq('zx', 'Z', 'X')],
    ownerTaskId: 'S', direction: 'successor', tokens: [internal('4')],
  });
  eq('summary-expansie onthult en weigert bladcyclus', errorsOf(result), ['cycle']);
}

// Alleen fouten die de bewerking zelf TOEVOEGT tellen (audit taakmutaties, bevinding 3). Een bewust
// bewaarde voorouder-relatie of kring (uit een import, of na verhangen) mag geen ongerelateerde cel
// blokkeren — de eindgraaf wordt tegen de graaf van vóór de bewerking gelegd.
{
  const phase = task('P', '5', { childIds: ['K'] });
  const kid = task('K', '5.1', { parentId: 'P' });
  const tasks = [...baseTasks, phase, kid];
  const keptAncestor = [seq('pk', 'P', 'K')];
  const unrelated = planRelationSet({
    tasks, sequences: keptAncestor, ownerTaskId: 'B', direction: 'predecessor', tokens: [internal('1.1')],
  });
  eq('bestaande voorouder-relatie blokkeert een ongerelateerde cel niet', errorsOf(unrelated), []);
  const ownCell = planRelationSet({
    tasks, sequences: keptAncestor, ownerTaskId: 'K', direction: 'predecessor',
    tokens: [internal('5', 'FS', '2d'), internal('1.1')],
  });
  eq('de cel met de bestaande voorouder-relatie blijft bewerkbaar (lag + extra relatie)', errorsOf(ownCell), []);
  eq('… en de voorouder-relatie houdt haar id', ownCell.ok ? ownCell.value.sequenceUpdates.map(u => u.id) : null, ['pk']);
  const extraType = planRelationSet({
    tasks, sequences: keptAncestor, ownerTaskId: 'K', direction: 'predecessor',
    tokens: [internal('5'), internal('5', 'SS')],
  });
  eq('een TWEEDE relatie naar de eigen fase erbij blijft geweigerd', errorsOf(extraType), ['ancestor']);

  const keptCycle = [seq('ab', 'A', 'B'), seq('ba', 'B', 'A')];
  const besideCycle = planRelationSet({
    tasks: baseTasks, sequences: keptCycle, ownerTaskId: 'D', direction: 'predecessor', tokens: [internal('1.3')],
  });
  eq('bestaande kring blokkeert een relatie ernaast niet', errorsOf(besideCycle), []);
  const intoNewCycle = planRelationSet({
    tasks: baseTasks, sequences: [...keptCycle, seq('cd', 'C', 'D')], ownerTaskId: 'C', direction: 'predecessor',
    tokens: [internal('1.4')],
  });
  eq('een nieuwe kring naast de bestaande blijft geweigerd', errorsOf(intoNewCycle), ['cycle']);
  const cycleThroughOld = planRelationSet({
    tasks: baseTasks, sequences: keptCycle, ownerTaskId: 'A', direction: 'predecessor',
    tokens: [internal('1.2'), internal('1.3')],
  });
  eq('een relatie die niets aan de bestaande kring toevoegt mag', errorsOf(cycleThroughOld), []);
  const cycleIntoOld = planRelationSet({
    tasks: baseTasks, sequences: [...keptCycle, seq('bc', 'B', 'C')], ownerTaskId: 'A', direction: 'predecessor',
    tokens: [internal('1.2'), internal('1.3')],
  });
  eq('een nieuwe kring door de bestaande heen wordt geweigerd', errorsOf(cycleIntoOld), ['cycle']);
}

function externalToken(
  ownerTaskId: string,
  targetOwnerTaskId: string,
  targetDirection: 'predecessor' | 'successor',
  link: ExternalLink,
  visibleReplacement?: [string, string],
  relationId?: string,
): ParsedRelationToken {
  let text = formatExternalRelationClipboard(ownerTaskId, link);
  if (visibleReplacement) text = text.replace(visibleReplacement[0], visibleReplacement[1]);
  const parsed = parseExternalRelationClipboard(text, { ownerTaskId: targetOwnerTaskId, direction: targetDirection });
  if (!parsed.ok) throw new Error(`fixture kon externe token niet parsen: ${parsed.code}`);
  const index = tokenIndex++;
  return {
    kind: 'external', external: parsed.value, relationId,
    source: { index, start: index * 10, end: index * 10 + text.length, text },
  };
}

const extLink: ExternalLink = {
  id: 'ext-old', direction: 'predecessor', relType: 'FS', lagDays: 2,
  anchorDate: '2026-06-10', sourceMissing: false,
  sourceRef: { projectId: 'bron', projectName: 'Bron', taskId: 'BT', taskName: 'Brontaak', filePath: '/bron.ifc' },
};

// Same-owner behoudt id en technische bron; cross-task maakt bewust een nieuwe link-id.
{
  const owner = task('D', '1.4', { externalLinks: [extLink] });
  const same = planRelationSet({
    tasks: [A, owner], sequences: [], ownerTaskId: 'D', direction: 'predecessor',
    tokens: [externalToken('D', 'D', 'predecessor', extLink, ['FS+2d ⟦', 'FS-1u ⟦'])],
  });
  ok('same-owner externe lagwijziging slaagt', same.ok);
  if (same.ok) {
    eq('same-owner behoudt externe id', same.value.externalUpdates.map(item => item.id), ['ext-old']);
    eq('same-owner normaliseert naar uitsluitend minuten', same.value.externalUpdates[0]?.link, {
      direction: 'predecessor', relType: 'FS', lagMinutes: -60, anchorDate: '2026-06-10',
      sourceRef: extLink.sourceRef, sourceMissing: false, id: 'ext-old',
    });
  }

  const target = task('C', '1.3');
  const cross = planRelationSet({
    tasks: [owner, target], sequences: [], ownerTaskId: 'C', direction: 'predecessor',
    tokens: [externalToken('D', 'C', 'predecessor', extLink)],
  });
  ok('cross-task externe token slaagt met volledige payload', cross.ok);
  if (cross.ok) {
    eq('cross-task gebruikt add in plaats van oorsprongs-id', cross.value.externalUpdates.length, 0);
    eq('cross-task bewaart bron, anker en missing-status', cross.value.externalAdditions, [{
      direction: 'predecessor', relType: 'FS', lagDays: 2, anchorDate: '2026-06-10',
      sourceRef: extLink.sourceRef, sourceMissing: false,
    }]);
  }
}

// Externe exacte identiteit bevat sourceProjectKey + source task + type; dubbele tokens zijn fout.
{
  const target = task('C', '1.3');
  const first = externalToken('D', 'C', 'predecessor', extLink);
  const second = { ...first, source: { ...first.source, index: tokenIndex++ } };
  const result = planRelationSet({
    tasks: [target], sequences: [], ownerTaskId: 'C', direction: 'predecessor', tokens: [first, second],
  });
  eq('dubbele externe technische key wordt per token geweigerd', errorsOf(result), ['duplicate', 'duplicate']);
}

// De runtimegrens vertrouwt niet op TypeScript wanneer intents uit clipboard/IPC komen.
{
  const valid = internal('1.1');
  ok('normaal intern token passeert runtimegrens', isParsedRelationTokenArray([valid]));
  eq('omgekeerd bronbereik faalt runtimegrens', isParsedRelationTokenArray([{
    ...valid, source: { ...valid.source, start: 9, end: 3 },
  }]), false);
  const target = task('C-runtime', '8');
  const external = externalToken('D', target.id, 'predecessor', extLink);
  if (external.kind !== 'external') throw new Error('externe runtimefixture is intern');
  eq('externe lag met twee actieve opslagvormen faalt runtimegrens', isParsedRelationTokenArray([{
    ...external,
    external: { ...external.external, lag: { lagDays: 1, lagMinutes: 60 } },
  }]), false);
  eq('niet-eindige gekopieerde lag faalt runtimegrens', isParsedRelationTokenArray([{
    ...external,
    external: { ...external.external, copiedLag: { lagDays: Number.POSITIVE_INFINITY } },
  }]), false);
}

// Het applypad genereert ids pas in de geïsoleerde commit en schrijft add/update/remove samen.
{
  const state = {
    tasks: [task('D', '1.4')],
    sequences: [seq('remove-me', 'A', 'D')],
  };
  const result = planRelationSet({
    tasks: [A, C, state.tasks[0]], sequences: state.sequences,
    ownerTaskId: 'D', direction: 'predecessor', tokens: [internal('1.3')],
  });
  if (!result.ok) throw new Error(`applyfixture faalde: ${result.errors.map(error => error.code).join(',')}`);
  applyRelationMutationPlan(state, result.value, {
    sequenceId: () => 'seq-new', externalLinkId: () => 'ext-new',
  });
  eq('apply vervangt de hele relevante set', state.sequences, [{
    predecessorId: 'C', successorId: 'D', type: 'FINISH_START', lagDays: 0, id: 'seq-new',
  }]);
}

// Grote geïmporteerde planningen mogen de JavaScript-callstack niet als verborgen limiet hebben.
// Zowel een lange acyclische keten als een kring diep in die keten moet iteratief worden afgehandeld.
{
  const edges = Array.from({ length: 20_000 }, (_, index) => ({
    predecessorId: `deep-${index}`,
    successorId: `deep-${index + 1}`,
  }));
  eq('diepe relatietak blijft zonder stack overflow acyclisch', detectCycleInEdges(edges), null);
  const cycle = detectCycleInEdges([...edges, {
    predecessorId: 'deep-20000', successorId: 'deep-19990',
  }]);
  ok('diepe kring wordt gevonden zonder stack overflow', cycle !== null);
  eq('gevonden kring is werkelijk gesloten', cycle ? cycle[0] : null, cycle ? cycle[cycle.length - 1] : null);
}

if (diffs.length > 0) {
  console.error(`RELATION SET PLAN: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  XX ${diff}`);
  process.exit(1);
}
console.log(`OK  relation-set-plan: ${checks}/${checks}`);
