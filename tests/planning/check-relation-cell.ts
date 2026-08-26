import { buildTaskRelationIndex, taskRelations } from '@/engine/taskGrid/relationIndex';
import {
  buildRelationCellItems,
  buildTaskRelationAnalysisItems,
  normalizeRelationTokenSources,
  parseRelationCellText,
  relationCellClipboardText,
  relationCellText,
  relationDrivingText,
  relationFreeFloatText,
  relationTaskOptions,
  relationWarningsText,
} from '@/engine/taskGrid/relationCell';
import { planRelationSet, type ParsedInternalRelationToken } from '@/engine/taskGrid/relationPlan';
import type { Sequence } from '@/types/sequence';
import type { ExternalLink, Task } from '@/types/task';
import type { TaskColumnContext } from '@/types/taskGrid';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, value: boolean): void { eq(label, value, true); }

function task(id: string, wbsCode: string, name: string, externalLinks?: ExternalLink[]): Task {
  return {
    id, wbsCode, name, parentId: null, childIds: [], externalLinks, isMilestone: false,
    time: { scheduleDuration: 5 },
  } as unknown as Task;
}

const externalLink: ExternalLink = {
  id: 'ext-west', direction: 'predecessor', relType: 'FS', lagDays: 2,
  anchorDate: '2026-08-24', sourceMissing: true,
  sourceRef: {
    projectId: 'west', projectName: 'Project, West', taskId: 'west-foundation',
    taskName: 'Fundering, fase 1', filePath: '/projecten/west.ops',
  },
};
const A = task('A', '1.5', 'Afwerking');
const B = task('B', '1.2', 'Ontgraven');
const C = task('C', '1.4', 'Beton storten');
const D = task('D', '2.1', 'Opleveren', [externalLink]);
const tasks = [A, B, C, D];
const sequences: Sequence[] = [
  { id: 'seq-fs', predecessorId: 'B', successorId: 'D', type: 'FINISH_START', lagDays: 2 },
  { id: 'seq-ss', predecessorId: 'C', successorId: 'D', type: 'START_START', lagDays: 0, lagPercent: 50 },
  { id: 'seq-ff', predecessorId: 'A', successorId: 'D', type: 'FINISH_FINISH', lagDays: -10, lagUnit: 'ELAPSEDTIME' },
];
const relationIndex = buildTaskRelationIndex(tasks, sequences, {
  drivingSequenceIds: ['seq-fs'],
  sequenceFreeFloat: { 'seq-fs': 0, 'seq-ss': 4 },
  truncatedLeadSequenceIds: ['seq-ss'],
  outOfSequenceSequenceIds: ['seq-ff'],
  droppedSequenceIds: ['seq-ss'],
});
const context: TaskColumnContext = {
  projectId: 'project-local',
  tasksById: new Map(tasks.map(item => [item.id, item])),
  relationIndex,
  assignmentsByTaskId: new Map(), resourcesById: new Map(), baselinesById: new Map(),
  scheduleStale: true,
};

const items = buildRelationCellItems({
  ownerTaskId: D.id,
  direction: 'predecessor',
  entries: taskRelations(relationIndex, D.id, 'predecessor'),
  context,
});

eq('interne en externe labels komen uit hetzelfde readmodel', items.map(item => item.label), [
  '1.2 FS+2d',
  '1.4 SS+50%',
  '1.5 FF-10ed',
  '"Project, West" / "Fundering, fase 1" FS+2d',
]);
eq('celtekst is de zichtbare volledige set', relationCellText(items),
  '1.2 FS+2d; 1.4 SS+50%; 1.5 FF-10ed; "Project, West" / "Fundering, fase 1" FS+2d');
ok('clipboard bewaart voor extern de verliesloze payload', relationCellClipboardText(items).includes('⟦OPS-EXT/1:'));
eq('driving en float komen uit de indexanalyse', items.slice(0, 3).map(item => [item.driving, item.freeFloat]), [
  [true, 0], [false, 4], [false, undefined],
]);
eq('interne waarschuwingen blijven per relatie', items.slice(0, 3).map(item => item.warnings), [
  [], ['dropped', 'truncated-lead'], ['lead-exceeds-duration', 'out-of-sequence'],
]);
ok('lead groter dan voorgangerduur blijft als waarschuwing zichtbaar',
  items[2]?.warnings.includes('lead-exceeds-duration') === true);
eq('ontbrekende externe bron blijft zichtbaar als waarschuwing', items[3]?.warnings, ['source-missing']);
ok('alle items tonen dat de berekening stale is', items.every(item => item.stale));

const analysisItems = buildTaskRelationAnalysisItems(D, context);
const warningLabel = (key: string): string => ({
  'relations.warnDropped': 'niet meegerekend',
  'relations.warnTruncatedLead': 'lead afgekapt',
  'relations.warnLeadExceedsDuration': 'lead groter dan voorgangerduur',
  'relations.warnOutOfSequence': 'buiten volgorde',
  'relations.warnSourceMissing': 'bron ontbreekt',
}[key] ?? key);
eq('drivingkolom toont richting en WBS', relationDrivingText(analysisItems), '← 1.2');
eq('relationele vrije-spelingkolom toont alle berekende waarden',
  relationFreeFloatText(analysisItems), '← 1.2: 0d; ← 1.4: 4d');
eq('waarschuwingenkolom labelt elke betrokken relatie', relationWarningsText(analysisItems, warningLabel),
  '← 1.4: niet meegerekend, lead afgekapt; ← 1.5: lead groter dan voorgangerduur, buiten volgorde; ← Fundering, fase 1: bron ontbreekt');
eq('RTL keert alleen de betekenisdragende relatiepijlen om', [
  relationDrivingText(analysisItems, 'rtl'),
  relationFreeFloatText(analysisItems, 'rtl'),
  relationWarningsText(analysisItems, warningLabel, 'rtl'),
], [
  '→ 1.2',
  '→ 1.2: 0d; → 1.4: 4d',
  '→ 1.4: niet meegerekend, lead afgekapt; → 1.5: lead groter dan voorgangerduur, buiten volgorde; → Fundering, fase 1: bron ontbreekt',
]);
eq('interactief opgebouwde interne tokens behouden relatie- en taakidentiteit', items[0]?.parsedToken, {
  kind: 'internal', wbsCode: '1.2', taskId: 'B', relType: 'FS', lagText: '+2d', relationId: 'seq-fs',
  source: { index: 0, start: 0, end: 9, text: '1.2 FS+2d' },
});

const parsedCombined = parseRelationCellText({
  text: relationCellClipboardText(items), ownerTaskId: D.id, direction: 'predecessor',
});
ok('gemengde interne en externe clipboardcel parseert', parsedCombined.ok);
if (parsedCombined.ok) {
  eq('komma in externe project- en taaknaam splitst geen tokens', parsedCombined.value.length, 4);
  eq('vrije tekst verliest bewust onzichtbare ids', parsedCombined.value.map(token => token.relationId),
    [undefined, undefined, undefined, undefined]);
  eq('tokenposities wijzen in de oorspronkelijke celtekst', parsedCombined.value.map(token => [
    token.source.index, token.source.text,
  ]), [
    [0, '1.2 FS+2d'], [1, '1.4 SS+50%'], [2, '1.5 FF-10ed'],
    [3, items[3]?.clipboardText],
  ]);
}

const unknownExternal = parseRelationCellText({
  text: 'Project West / Fundering FS+2d', ownerTaskId: D.id, direction: 'predecessor',
});
eq('extern ogende vrije tekst stuurt naar het dialoogvenster', unknownExternal.ok ? [] : unknownExternal.errors.map(error => error.code),
  ['externalRelationRequiresDialog']);

const badSecond = parseRelationCellText({
  text: '1.2 FS; geen-relatie', ownerTaskId: D.id, direction: 'predecessor',
});
if (!badSecond.ok) {
  eq('fout bevat tokenindex', badSecond.errors[0]?.tokenIndex, 1);
  eq('fout bevat exacte tekenpositie', [badSecond.errors[0]?.start, badSecond.errors[0]?.end], [8, 20]);
}

eq('autocomplete zoekt op WBS en naam en sluit de eigenaar uit',
  relationTaskOptions(tasks, D.id, 'beton').map(option => option.label), ['1.4 Beton storten']);
eq('lege autocomplete toont alle andere taken in documentvolgorde',
  relationTaskOptions(tasks, D.id, '').map(option => option.taskId), ['A', 'B', 'C']);

const normalized = normalizeRelationTokenSources([
  { ...(items[0]!.parsedToken as ParsedInternalRelationToken), lagText: '+4d' },
  items[3]!.parsedToken,
]);
eq('chipbewerking herbouwt posities maar bewaart identiteiten', normalized.map(token => ({
  relationId: token.relationId,
  taskId: token.kind === 'internal' ? token.taskId : token.external.sourceRef.taskId,
  source: token.source,
})), [
  { relationId: 'seq-fs', taskId: 'B', source: { index: 0, start: 0, end: 9, text: '1.2 FS+4d' } },
  {
    relationId: 'ext-west', taskId: 'west-foundation',
    source: { index: 1, start: 11, end: 54, text: '"Project, West" / "Fundering, fase 1" FS+2d' },
  },
]);

const duplicateWbsTasks = [task('X1', '3.1', 'Eerste'), task('X2', '3.1', 'Tweede'), D];
const typedToken: ParsedInternalRelationToken = {
  kind: 'internal', wbsCode: '3.1', relType: 'FS', lagText: '',
  source: { index: 0, start: 0, end: 6, text: '3.1 FS' },
};
const typedPlan = planRelationSet({
  tasks: duplicateWbsTasks, sequences: [], ownerTaskId: D.id, direction: 'predecessor', tokens: [typedToken],
});
eq('exact getypte dubbele WBS blijft ambigu', typedPlan.ok ? [] : typedPlan.errors.map(error => error.code), ['ambiguousWbs']);
const chosenPlan = planRelationSet({
  tasks: duplicateWbsTasks, sequences: [], ownerTaskId: D.id, direction: 'predecessor',
  tokens: [{ ...typedToken, taskId: 'X2' }],
});
ok('autocompletekeuze met taak-id maakt dezelfde WBS eenduidig', chosenPlan.ok);
if (chosenPlan.ok) eq('gekozen taak-id bepaalt het echte eindpunt', chosenPlan.value.sequenceAdditions[0]?.predecessorId, 'X2');
const mismatchedPlan = planRelationSet({
  tasks: duplicateWbsTasks, sequences: [], ownerTaskId: D.id, direction: 'predecessor',
  tokens: [{ ...typedToken, taskId: 'D' }],
});
eq('verouderde of vervalste autocomplete-identiteit wordt geweigerd',
  mismatchedPlan.ok ? [] : mismatchedPlan.errors.map(error => error.code), ['taskIdentity']);

if (diffs.length) {
  console.error(`XX relation-cell: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK relation-cell: ${checks}/${checks} checks groen`);
