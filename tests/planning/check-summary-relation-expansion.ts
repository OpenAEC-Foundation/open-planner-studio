// Samenvattingsrelatie-propagatie (vervolg op 489a9ef2, CPM-review-vervolg): unit- en hostile-checks
// voor de PURE functie `expandSummaryRelations` (los van de CPM-cases in cases-edge.json, die de
// vier vormen + de vooroudersguard (C1) + de vier conservatieve-semantiek-pins (I3) end-to-end via
// de echte store dekken — zie de "wbs-summary-relation-*"-cases). Hier zitten de boomtopologie-
// randgevallen die met handberekende datums lastig te toetsen zijn: welke relaties exact worden
// gegenereerd (ids/richting/lag-behoud), cyclusvastheid, de MAX_EXPANDED_RELATIONS-klem onder een
// hostile kruisproduct, de vooroudersguard op functie-niveau (C1), de terugvouw-functie voor
// synthetische ids in de solver-uitvoer (I2), en de id-botsingsklem (M9).
//
// Draait via run.sh (esbuild-bundel, zoals check-advanced-cpm.ts). Exit 0 = alles groen.
import {
  expandSummaryRelations, foldSyntheticSequenceIds, originalSequenceId, MAX_EXPANDED_RELATIONS,
} from '@/engine/scheduler/expandSummaryRelations';
import { CPMSolver, type CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(label);
};
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// Schone dag-kalender ma-vr (§10d, echte CPMSolver-doorloop van de C1-guard).
const CAL: WorkCalendar = {
  id: 'c', name: 'c', description: 'c',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

function mkTask(id: string, extra: Partial<Task> = {}): Task {
  return {
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: createDefaultTaskTime('2026-06-01', 1), resourceIds: [],
    ...extra,
  };
}
function fs(id: string, pred: string, succ: string, lagDays = 0): Sequence {
  return { id, predecessorId: pred, successorId: succ, type: 'FINISH_START', lagDays };
}
/** Sorteer synthetische output op (pred,succ) zodat de assertie ongevoelig is voor generatievolgorde. */
function sortedPairs(seqs: Sequence[]): string[] {
  return seqs.map((s) => `${s.predecessorId}>${s.successorId}`).sort();
}

// ── 1) Bladtaak-naar-bladtaak — geen samenvatting aan weerskant: ongewijzigd doorgeven ───────────
{
  const tasks = [mkTask('A'), mkTask('B')];
  const seq = fs('s1', 'A', 'B', 3);
  const { sequences, droppedSequenceIds } = expandSummaryRelations(tasks, [seq]);
  eq('01 leaf->leaf: exact 1 relatie terug', sequences.length, 1);
  eq('02 leaf->leaf: id ongewijzigd (geen synthetische suffix)', sequences[0]?.id, 's1');
  eq('03 leaf->leaf: predecessorId ongewijzigd', sequences[0]?.predecessorId, 'A');
  eq('04 leaf->leaf: successorId ongewijzigd', sequences[0]?.successorId, 'B');
  eq('05 leaf->leaf: lag behouden', sequences[0]?.lagDays, 3);
  eq('06 leaf->leaf: niets gedropt', droppedSequenceIds.length, 0);
}

// ── 2) Samenvatting als VOORGANGER: elk bladkind wordt zelf voorganger van de opvolger ───────────
{
  const p1 = mkTask('P1', { childIds: ['K1a', 'K1b'] });
  const k1a = mkTask('K1a', { parentId: 'P1' });
  const k1b = mkTask('K1b', { parentId: 'P1' });
  const l = mkTask('L');
  const seq = fs('pred-sum', 'P1', 'L', 2);
  const { sequences, droppedSequenceIds } = expandSummaryRelations([p1, k1a, k1b, l], [seq]);
  eq('07 pred-summary: 2 gegenereerde relaties (1 per bladkind)', sequences.length, 2);
  eq(
    '08 pred-summary: precies K1a->L en K1b->L',
    sortedPairs(sequences).join(','),
    'K1a>L,K1b>L',
  );
  truthy('09 pred-summary: elke synthetische id begint met het origineel + "::exp-"', sequences.every((s) => s.id.startsWith('pred-sum::exp-')));
  truthy('10 pred-summary: type/lag behouden op elke gegenereerde relatie', sequences.every((s) => s.type === 'FINISH_START' && s.lagDays === 2));
  eq('11 pred-summary: origineel niet zelf in de output (P1 komt nergens als predecessorId voor)', sequences.some((s) => s.predecessorId === 'P1'), false);
  eq('12 pred-summary: niets gedropt', droppedSequenceIds.length, 0);
}

// ── 3) Samenvatting als OPVOLGER: elk bladkind wordt zelf opvolger van de voorganger ──────────────
{
  const p1 = mkTask('P1', { childIds: ['K1a', 'K1b'] });
  const k1a = mkTask('K1a', { parentId: 'P1' });
  const k1b = mkTask('K1b', { parentId: 'P1' });
  const l = mkTask('L');
  const seq = fs('succ-sum', 'L', 'P1');
  const { sequences, droppedSequenceIds } = expandSummaryRelations([l, p1, k1a, k1b], [seq]);
  eq('13 succ-summary: 2 gegenereerde relaties', sequences.length, 2);
  eq('14 succ-summary: precies L->K1a en L->K1b', sortedPairs(sequences).join(','), 'L>K1a,L>K1b');
  eq('15 succ-summary: niets gedropt', droppedSequenceIds.length, 0);
}

// ── 4) BEIDE kanten samenvatting: kruisproduct ────────────────────────────────────────────────────
{
  const p1 = mkTask('P1', { childIds: ['K1a', 'K1b'] });
  const k1a = mkTask('K1a', { parentId: 'P1' });
  const k1b = mkTask('K1b', { parentId: 'P1' });
  const p2 = mkTask('P2', { childIds: ['K2a', 'K2b'] });
  const k2a = mkTask('K2a', { parentId: 'P2' });
  const k2b = mkTask('K2b', { parentId: 'P2' });
  const seq = fs('both-sum', 'P1', 'P2');
  const { sequences, droppedSequenceIds } = expandSummaryRelations([p1, k1a, k1b, p2, k2a, k2b], [seq]);
  eq('16 both-summary: kruisproduct 2x2 = 4 relaties', sequences.length, 4);
  eq(
    '17 both-summary: exact het kruisproduct {K1a,K1b}x{K2a,K2b}',
    sortedPairs(sequences).join(','),
    'K1a>K2a,K1a>K2b,K1b>K2a,K1b>K2b',
  );
  eq('18 both-summary: niets gedropt', droppedSequenceIds.length, 0);
}

// ── 5) Geneste samenvattingen: recursief tot bladtaken (P3 -> P4 -> {G1,G2}) ──────────────────────
{
  const p3 = mkTask('P3', { childIds: ['P4'] });
  const p4 = mkTask('P4', { parentId: 'P3', childIds: ['G1', 'G2'] });
  const g1 = mkTask('G1', { parentId: 'P4' });
  const g2 = mkTask('G2', { parentId: 'P4' });
  const l = mkTask('L');
  const seq = fs('nested-sum', 'P3', 'L');
  const { sequences, droppedSequenceIds } = expandSummaryRelations([p3, p4, g1, g2, l], [seq]);
  eq('19 nested: daalt door P4 af tot de echte bladtaken G1/G2 (2 relaties)', sequences.length, 2);
  eq('20 nested: precies G1->L en G2->L (niet P4->L)', sortedPairs(sequences).join(','), 'G1>L,G2>L');
  eq('21 nested: niets gedropt', droppedSequenceIds.length, 0);
}

// ── 6) Kapotte tak: samenvatting met alleen een verweesd kind-id ⇒ geen bladafstammelingen ────────
{
  const ghost = mkTask('Ghost', { childIds: ['nonexistent-child'] });
  const l = mkTask('L');
  const seq = fs('ghost-sum', 'Ghost', 'L');
  const { sequences, droppedSequenceIds } = expandSummaryRelations([ghost, l], [seq]);
  eq('22 kapotte tak: 0 relaties gegenereerd', sequences.length, 0);
  eq('23 kapotte tak: origineel id in droppedSequenceIds', droppedSequenceIds.join(','), 'ghost-sum');
}

// ── 7) Cyclusvastheid: taak die (indirect) zijn eigen afstammeling is — geen oneindige lus ────────
{
  const self = mkTask('SelfSum', { childIds: ['SelfSum'] }); // corrupt: verwijst naar zichzelf
  const l = mkTask('L');
  const seq = fs('self-cycle', 'SelfSum', 'L');
  const t0 = Date.now();
  const { sequences, droppedSequenceIds } = expandSummaryRelations([self, l], [seq]);
  const elapsedMs = Date.now() - t0;
  truthy(`24 zelf-cyclus: rondt direct af (${elapsedMs}ms), geen hang`, elapsedMs < 1000);
  eq('25 zelf-cyclus: geen bladafstammelingen gevonden ⇒ 0 relaties', sequences.length, 0);
  eq('26 zelf-cyclus: origineel gedropt (niet gecrasht)', droppedSequenceIds.join(','), 'self-cycle');

  // Twee-knopen-cyclus C1<->C2, geen van beide heeft een echte bladtaak als kind.
  const c1 = mkTask('C1', { childIds: ['C2'] });
  const c2 = mkTask('C2', { childIds: ['C1'] });
  const seq2 = fs('mutual-cycle', 'C1', 'L');
  const t1 = Date.now();
  const res2 = expandSummaryRelations([c1, c2, l], [seq2]);
  const elapsedMs2 = Date.now() - t1;
  truthy(`27 wederzijdse cyclus: rondt direct af (${elapsedMs2}ms), geen hang`, elapsedMs2 < 1000);
  eq('28 wederzijdse cyclus: 0 relaties', res2.sequences.length, 0);
  eq('29 wederzijdse cyclus: origineel gedropt (niet gecrasht)', res2.droppedSequenceIds.join(','), 'mutual-cycle');
}

// ── 8) Verweesd/ongeldig taak-id (géén samenvattingsgeval): ongewijzigd doorgeven, niet hier gedropt
//      — dat blijft het vangnet van de CPMSolver-constructor-guard (489a9ef2). ─────────────────────
{
  const l = mkTask('L');
  const seq = fs('dangling', 'L', 'does-not-exist');
  const { sequences, droppedSequenceIds } = expandSummaryRelations([l], [seq]);
  eq('30 verweesd id: ongewijzigd doorgegeven (geen expansie, geen drop hier)', sequences.length, 1);
  eq('31 verweesd id: origineel id/predecessor/successor intact', `${sequences[0]?.id}|${sequences[0]?.predecessorId}|${sequences[0]?.successorId}`, 'dangling|L|does-not-exist');
  eq('32 verweesd id: niet in droppedSequenceIds (dat is de solver-guard zijn taak)', droppedSequenceIds.length, 0);
}

// ── 9) HOSTILE: kruisproduct-klem — twee samenvattingen van elk 300 bladkinderen (90.000 combinaties
//      > MAX_EXPANDED_RELATIONS) mogen de solver niet laten vastlopen/OOM'en. De hele relatie wordt
//      ATOMAIR gedropt (geen half-juiste subset), binnen een tijdslimiet. ──────────────────────────
{
  const N = 300; // 300*300 = 90.000 > 50.000
  truthy(`33 hostile-fixture bewijst zijn eigen premisse (${N}x${N}=${N * N} > MAX=${MAX_EXPANDED_RELATIONS})`, N * N > MAX_EXPANDED_RELATIONS);

  const bigPChildren = Array.from({ length: N }, (_, i) => `BP-${i}`);
  const bigQChildren = Array.from({ length: N }, (_, i) => `BQ-${i}`);
  const bigP = mkTask('BigP', { childIds: bigPChildren });
  const bigQ = mkTask('BigQ', { childIds: bigQChildren });
  const leaves = [
    ...bigPChildren.map((id) => mkTask(id, { parentId: 'BigP' })),
    ...bigQChildren.map((id) => mkTask(id, { parentId: 'BigQ' })),
  ];
  // Een onschuldige, klein-blijvende relatie ernaast — bewijst dat de klem NIET de hele aanroep
  // laat mislukken, alleen de relatie(s) die zelf niet passen. VOLGORDE is bewust "small" vóór
  // "big": budgetExhausted is permanent zodra één relatie niet past (§ zie het functiecommentaar
  // "geen her-proberen op een kleiner kruisproduct verderop in de lijst") — "small" moet dus vóór
  // "big" in de lijst staan om nog binnen het budget te vallen.
  const small = mkTask('Small');
  const seqSmall = fs('small-fs', 'Small', 'BigP');
  const seqBig = fs('big-cross', 'BigP', 'BigQ');

  const TIME_LIMIT_MS = 5000;
  const t0 = Date.now();
  const { sequences, droppedSequenceIds } = expandSummaryRelations(
    [bigP, bigQ, small, ...leaves],
    [seqSmall, seqBig],
  );
  const elapsedMs = Date.now() - t0;

  truthy(`34 hostile: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(
    `35 hostile: totaal aantal gegenereerde relaties blijft onder de klem (${sequences.length} <= ${MAX_EXPANDED_RELATIONS})`,
    sequences.length <= MAX_EXPANDED_RELATIONS,
  );
  eq('36 hostile: de te-grote relatie is volledig (atomair) gedropt, geen partiële subset', sequences.some((s) => s.predecessorId.startsWith('BP-') && s.successorId.startsWith('BQ-')), false);
  truthy('37 hostile: de te-grote relatie staat in droppedSequenceIds', droppedSequenceIds.includes('big-cross'));
  // "small-fs" (Small -> BigP, N=300 combinaties) past nog ruim binnen het budget en moet dus WEL
  // volledig geëxpandeerd zijn — de klem raakt alleen wat zelf niet past, niet de rest van de batch.
  eq('38 hostile: de kleine relatie ernaast is wél volledig geëxpandeerd (300 relaties)', sequences.filter((s) => s.predecessorId === 'Small').length, N);
  eq('39 hostile: de kleine relatie staat niet in droppedSequenceIds', droppedSequenceIds.includes('small-fs'), false);
}

// ── 10) CPM-REVIEW C1 (blokkerend): vooroudersguard — een taak gekoppeld aan zijn EIGEN (voor)ouder-
//       samenvatting (in beide richtingen) of P->P mag nooit een cyclus genereren. Zonder de guard
//       zou minstens P->P letterlijk K1->K2 ÉN K2->K1 opleveren (kruisproduct van predIds/succIds
//       die hier IDENTIEK zijn), en dat crasht `CPMSolver.solve()` met "Circular dependency" —
//       PROJECTBREED geen datums meer, niet alleen voor deze ene relatie. ──────────────────────────
{
  const TOP = mkTask('TOP', { childIds: ['K1', 'K2'] });
  const k1 = mkTask('K1', { parentId: 'TOP' });
  const k2 = mkTask('K2', { parentId: 'TOP' });
  const l = mkTask('L');
  const tasks = [TOP, k1, k2, l];

  // 10a) SUB->TOP: K1 (bladkind) als voorganger van zijn EIGEN ouder-samenvatting TOP.
  {
    const seq = fs('sub-to-top', 'K1', 'TOP');
    const { sequences, droppedSequenceIds } = expandSummaryRelations(tasks, [seq]);
    eq('40 C1 SUB->TOP: 0 gegenereerde relaties (geen cyclus mogelijk maken)', sequences.length, 0);
    eq('41 C1 SUB->TOP: origineel gedropt', droppedSequenceIds.join(','), 'sub-to-top');
  }

  // 10b) TOP->SUB: de samenvatting TOP als voorganger van zijn EIGEN bladkind K1 (de spiegeling).
  {
    const seq = fs('top-to-sub', 'TOP', 'K1');
    const { sequences, droppedSequenceIds } = expandSummaryRelations(tasks, [seq]);
    eq('42 C1 TOP->SUB: 0 gegenereerde relaties', sequences.length, 0);
    eq('43 C1 TOP->SUB: origineel gedropt', droppedSequenceIds.join(','), 'top-to-sub');
  }

  // 10c) P->P: letterlijk dezelfde samenvatting aan beide kanten — zonder guard predIds===succIds=
  //      [K1,K2], dus het kruisproduct zou K1->K2 ÉN K2->K1 genereren (een directe 2-cyclus).
  {
    const seq = fs('p-to-p', 'TOP', 'TOP');
    const { sequences, droppedSequenceIds } = expandSummaryRelations(tasks, [seq]);
    eq('44 C1 P->P: 0 gegenereerde relaties (geen K1->K2/K2->K1-paar)', sequences.length, 0);
    eq('45 C1 P->P: origineel gedropt', droppedSequenceIds.join(','), 'p-to-p');
  }

  // 10d) "de rest doorrekent": alle drie de vooroudersrelaties hierboven SAMEN met een normale,
  //      ongerelateerde relatie in ÉÉN aanroep — bewijst dat de guard alleen de foute relaties raakt,
  //      niet de batch. Vervolgens ECHT door CPMSolver.solve() heen (niet alleen expandSummaryRelations
  //      zelf) — dat is precies het pad dat vóór C1 crashte: op de HELE solve, niet op deze functie.
  {
    const other = mkTask('Other', { time: createDefaultTaskTime('2026-06-01', 2) });
    const allTasks = [TOP, k1, k2, l, other];
    const seqs = [
      fs('sub-to-top-2', 'K1', 'TOP'),
      fs('top-to-sub-2', 'TOP', 'K1'),
      fs('p-to-p-2', 'TOP', 'TOP'),
      fs('other-to-l', 'Other', 'L'),
    ];
    const { sequences, droppedSequenceIds } = expandSummaryRelations(allTasks, seqs);
    eq(
      '46 C1 gemengde batch: exact 1 gegenereerde relatie (de enige geldige, "Other"->"L")',
      sequences.length, 1,
    );
    eq('47 C1 gemengde batch: precies Other->L overleeft', sortedPairs(sequences).join(','), 'Other>L');
    eq(
      '48 C1 gemengde batch: alle drie vooroudersrelaties gedropt, "other-to-l" NIET',
      [...droppedSequenceIds].sort().join(','),
      ['p-to-p-2', 'sub-to-top-2', 'top-to-sub-2'].sort().join(','),
    );

    const leafTasks = allTasks.filter((t) => t.childIds.length === 0);
    let threw: unknown = null;
    let cpm: CPMResult | null = null;
    try {
      cpm = new CPMSolver(leafTasks, sequences, CAL, [], {}).solve();
    } catch (err) {
      threw = err;
    }
    truthy(
      `49 C1 vóór de fix crashte dit: CPMSolver.solve() na expansie gooit niet (${threw instanceof Error ? threw.message : String(threw ?? '')})`,
      threw === null && cpm !== null,
    );
    truthy('50 C1: geen circulaire-dependency-fout (projectbreed geen datums meer was precies het risico)', !!cpm && !cpm.error);
    truthy('51 C1: L heeft een echt gerekend resultaat (de overlevende relatie deed haar werk)', !!cpm && cpm.tasks.has('L'));
  }
}

// ── 11) I2 (CPM-review): terugvouwen van synthetische ids in CPMResult ────────────────────────────
{
  const mkResult = (over: Partial<CPMResult> = {}): CPMResult => ({
    tasks: new Map(),
    criticalPath: [],
    drivingSequenceIds: [],
    sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [],
    violatedConstraintTaskIds: [],
    missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [],
    nearCriticalTaskIds: [],
    criticalPaths: [[]],
    floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [],
    projectEnd: '2026-06-01',
    projectDuration: 1,
    ...over,
  });

  // 11a) originalSequenceId: idempotent, alleen een TRAILEND ::exp-N-patroon strippen.
  eq('52 originalSequenceId: strip een trailend synthetisch suffix', originalSequenceId('seq-1::exp-3'), 'seq-1');
  eq('53 originalSequenceId: dubbele cijfers werken ook', originalSequenceId('seq-1::exp-42'), 'seq-1');
  eq('54 originalSequenceId: geen suffix ⇒ ongewijzigd (idempotent)', originalSequenceId('seq-1'), 'seq-1');
  eq(
    '55 originalSequenceId: "::exp-" NIET aan het eind (midden van een echte id) blijft ONGEMOEID',
    originalSequenceId('seq-1::exp-weird-not-a-number'),
    'seq-1::exp-weird-not-a-number',
  );

  // 11b) drivingSequenceIds: OR + dedup — minstens één synthetische instantie driving ⇒ origineel
  //      driving, en de verzameling is gededupliceerd (geen 3x "seq-1" als 3 instanties driving zijn).
  {
    const result = mkResult({
      drivingSequenceIds: ['seq-1::exp-0', 'seq-1::exp-1', 'seq-2::exp-0', 'plain-seq'],
    });
    foldSyntheticSequenceIds(result);
    eq(
      '56 drivingSequenceIds: OR + dedup naar originele ids',
      [...result.drivingSequenceIds].sort().join(','),
      ['plain-seq', 'seq-1', 'seq-2'].sort().join(','),
    );
  }

  // 11c) sequenceFreeFloat: MIN over alle synthetische instanties van dezelfde originele relatie.
  {
    const result = mkResult({
      sequenceFreeFloat: {
        'seq-1::exp-0': 5, 'seq-1::exp-1': 0, 'seq-1::exp-2': 3, // MIN = 0
        'seq-2::exp-0': 4, 'seq-2::exp-1': 2,                    // MIN = 2
        'plain-seq': 7,                                          // ongewijzigd
      },
    });
    foldSyntheticSequenceIds(result);
    eq('57 sequenceFreeFloat: MIN over seq-1-instanties (0)', result.sequenceFreeFloat['seq-1'], 0);
    eq('58 sequenceFreeFloat: MIN over seq-2-instanties (2)', result.sequenceFreeFloat['seq-2'], 2);
    eq('59 sequenceFreeFloat: al-originele sleutel ongewijzigd', result.sequenceFreeFloat['plain-seq'], 7);
    eq('60 sequenceFreeFloat: geen synthetische sleutels meer over', Object.keys(result.sequenceFreeFloat).some((k) => k.includes('::exp-')), false);
  }

  // 11d) truncatedLeadSequenceIds / outOfSequenceSequenceIds: dedup, GEEN optelling — dit was precies
  //      de N×-tellerbug in de StatusBar (één samenvattingsrelatie met een kruisproduct van 5 paren
  //      telde als 5 in plaats van 1).
  {
    const result = mkResult({
      truncatedLeadSequenceIds: ['seq-1::exp-0', 'seq-1::exp-1', 'seq-1::exp-2'],
      outOfSequenceSequenceIds: ['seq-1::exp-0', 'seq-1::exp-1', 'seq-1::exp-2', 'seq-1::exp-3', 'seq-1::exp-4'],
    });
    foldSyntheticSequenceIds(result);
    eq('61 truncatedLeadSequenceIds: 3 synthetische instanties vouwen naar 1 origineel (geen optelling)', result.truncatedLeadSequenceIds.length, 1);
    eq('62 truncatedLeadSequenceIds: het juiste origineel', result.truncatedLeadSequenceIds[0], 'seq-1');
    eq('63 outOfSequenceSequenceIds: 5 kruisproduct-paren vouwen naar 1 (de N×-tellerbug, gefixt)', result.outOfSequenceSequenceIds.length, 1);
  }

  // 11e) droppedSequenceIds: defensief ook gefold + gededupliceerd; optioneel veld blijft optioneel.
  {
    const result = mkResult({ droppedSequenceIds: ['seq-1::exp-0', 'seq-1::exp-1', 'plain'] });
    foldSyntheticSequenceIds(result);
    eq(
      '64 droppedSequenceIds: gefold + gededupliceerd',
      [...(result.droppedSequenceIds ?? [])].sort().join(','),
      ['plain', 'seq-1'].sort().join(','),
    );
    const noDropped = mkResult();
    foldSyntheticSequenceIds(noDropped);
    eq('65 droppedSequenceIds afwezig: blijft afwezig (geen [] erbij verzinnen)', noDropped.droppedSequenceIds, undefined);
  }

  // 11f) Idempotent: een tweede keer folden verandert niets meer.
  {
    const result = mkResult({
      drivingSequenceIds: ['seq-1::exp-0', 'seq-2'],
      sequenceFreeFloat: { 'seq-1::exp-0': 1, 'seq-2': 3 },
    });
    foldSyntheticSequenceIds(result);
    const once = JSON.stringify({ d: result.drivingSequenceIds, f: result.sequenceFreeFloat });
    foldSyntheticSequenceIds(result);
    const twice = JSON.stringify({ d: result.drivingSequenceIds, f: result.sequenceFreeFloat });
    eq('66 foldSyntheticSequenceIds is idempotent (2x toepassen == 1x)', twice, once);
  }
}

// ── 12) M9: id-botsingsklem — een ECHTE relatie-id die toevallig al op het "::exp-N"-patroon eindigt
//       mag nooit stil samenvallen met een gegenereerde synthetische id. ─────────────────────────────
{
  const p1 = mkTask('P1', { childIds: ['K1a', 'K1b'] });
  const k1a = mkTask('K1a', { parentId: 'P1' });
  const k1b = mkTask('K1b', { parentId: 'P1' });
  const l = mkTask('L');
  // Deze ECHTE relatie-id ZOU exact botsen met de eerste synthetische id die "pred-sum" anders zou
  // genereren ("pred-sum::exp-0") — hij is zelf een gewone, geldige bladtaak-naar-bladtaak relatie
  // (K1a->L) die dus ONGEWIJZIGD (met precies die id) in de output terecht moet komen.
  const collidingReal: Sequence = { id: 'pred-sum::exp-0', predecessorId: 'K1a', successorId: 'L', type: 'FINISH_START', lagDays: 0 };
  const seq = fs('pred-sum', 'P1', 'L'); // expandeert naar K1a->L + K1b->L, wil ook "pred-sum::exp-0" als eerste kandidaat-id
  const { sequences } = expandSummaryRelations([p1, k1a, k1b, l], [collidingReal, seq]);

  const ids = sequences.map((s) => s.id);
  eq('67 M9: geen dubbele ids in de output ondanks de botsende bron-id', new Set(ids).size, ids.length);
  eq('68 M9: precies drie relaties totaal (de botsende echte + 2 synthetische voor pred-sum)', sequences.length, 3);
  truthy(
    '69 M9: de echte, botsende relatie overleeft ONGEWIJZIGD op zijn eigen id (K1a->L, "pred-sum::exp-0")',
    sequences.some((s) => s.id === 'pred-sum::exp-0' && s.predecessorId === 'K1a' && s.successorId === 'L'),
  );
  // De twee gegenereerde relaties voor "pred-sum" (K1a->L, K1b->L) bestaan ALSNOG, op ANDERE ids dan
  // de al-bezette "pred-sum::exp-0" — de klem moet dus doortellen i.p.v. de tweede relatie te laten
  // verdwijnen (wat een stille datavernietiging zou zijn, erger dan de botsing zelf).
  eq(
    '70 M9: beide gegenereerde pred-sum-paren (K1a->L, K1b->L) bestaan alsnog, elk op een vrije id',
    sortedPairs(sequences.filter((s) => s.id !== 'pred-sum::exp-0')).join(','),
    'K1a>L,K1b>L',
  );
  // Exacte ids: de teller wijkt bij de eerste botsing uit naar "::exp-1", en telt normaal door naar
  // "::exp-2" voor het tweede paar (geen sprong terug naar 0 per paar, zie de O(1)-toelichting in
  // expandSummaryRelations.ts).
  eq(
    '71 M9: de uitgeweken ids zijn precies "::exp-1" en "::exp-2" (monotoon doorgeteld, niet herstart)',
    [...ids].sort().join(','),
    ['pred-sum::exp-0', 'pred-sum::exp-1', 'pred-sum::exp-2'].sort().join(','),
  );
}

if (diffs.length === 0) {
  console.log(`OK  summary-relation-expansion: alle checks groen (${checks})`);
} else {
  console.log(`XX  summary-relation-expansion: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exitCode = 1;
}
