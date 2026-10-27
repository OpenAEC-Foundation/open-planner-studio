// check-work-rule-explain.ts — de uitleg achter het i-icoon van het veld *Werkregel* naast de
// rekenkern (`src/engine/work/workTriangle.ts`). Besluit eigenaar 2026-10-15: per regel drie delen
// (wat volgt, wat er gebeurt als je de andere grootheid wijzigt, wat een extra resource doet).
//
// Drie lagen:
//   (a) MEANING: per zin wat hij beweert, met de letterlijke nl- en en-tekst. Een gewijzigde tekst in
//       `task.json` zonder bijgewerkte betekenis hier is rood.
//   (b) Per combinatie van regel × effortDriven (undefined, true, false) en elke bewerking (duur,
//       inzet, werk, resource erbij) rekent de kern de uitkomst; elke bewering van de uitleg moet
//       daarmee kloppen. Een zin die niet klopt met de kern is rood.
//   (c) Volledigheid: elke uitleg zegt voor ELKE bewerking (duur, inzet, werk) precies één keer wat
//       zich aanpast, en heeft precies één resourcezin.
//
// Draait via run.sh (esbuild-bundel, Node). Exit 0 = groen.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  applyAssignmentAdded, applyDurationEdit, applyUnitsEdit, applyWorkEdit, remainingWorkOf,
  type TriangleResult, type TriangleState,
} from '@/engine/work/workTriangle';
import { WORK_RULES, type WorkRule } from '@/types/workRule';
import { WORK_RULE_SENTENCES, workRuleExplanation, type WorkRuleSentence } from '@/components/task-sections/workRuleExplain';

declare const process: { exit(code: number): never };

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

type Q = 'duration' | 'units' | 'work';
type ResourceEffect = 'workUp' | 'durationSame' | 'unitsDown' | 'durationDown';
interface Meaning {
  /** Bewerking van de sleutel ⇒ de grootheid die zich aanpast (de derde blijft gelijk). */
  edits?: Partial<Record<Q, Q>>;
  /** Wat een extra resource doet (zelfde inzet als de bestaande). */
  resource?: readonly ResourceEffect[];
  nl: string;
  en: string;
}

// (a) De betekenis van elke zin, naast de letterlijke tekst.
const MEANING: Record<WorkRuleSentence, Meaning> = {
  followsWork: { edits: { duration: 'work', units: 'work' },
    nl: 'Het werk volgt uit de duur en de inzet.', en: 'Work follows from duration and units.' },
  followsUnits: { edits: { duration: 'units', work: 'units' },
    nl: 'De inzet volgt uit de duur en het werk.', en: 'Units follow from duration and work.' },
  followsDuration: { edits: { work: 'duration', units: 'duration' },
    nl: 'De duur volgt uit het werk en de inzet.', en: 'Duration follows from work and units.' },
  followsUnitsFromWork: { edits: { work: 'units' },
    nl: 'De inzet volgt uit het werk.', en: 'Units follow from work.' },
  workAdjustsUnits: { edits: { work: 'units' },
    nl: 'Wijzig je het werk, dan past de inzet zich aan.', en: 'If you change the work, the units adjust.' },
  unitsAdjustsWork: { edits: { units: 'work' },
    nl: 'Wijzig je de inzet, dan past het werk zich aan.', en: 'If you change the units, the work adjusts.' },
  durationAdjustsUnits: { edits: { duration: 'units' },
    nl: 'Wijzig je de duur, dan past de inzet zich aan.', en: 'If you change the duration, the units adjust.' },
  durationAdjustsWork: { edits: { duration: 'work' },
    nl: 'Wijzig je de duur, dan past het werk zich aan.', en: 'If you change the duration, the work adjusts.' },
  unitsOrDurationAdjustsWork: { edits: { units: 'work', duration: 'work' },
    nl: 'Wijzig je de inzet of de duur, dan past het werk zich aan.',
    en: 'If you change the units or the duration, the work adjusts.' },
  resourceAddsWork: { resource: ['workUp'],
    nl: 'Een extra resource voegt werk toe.', en: 'An extra resource adds work.' },
  resourceSharesWork: { resource: ['durationSame', 'unitsDown'],
    nl: 'Een extra resource neemt een deel van het werk over; de inzet per resource daalt.',
    en: 'An extra resource takes over part of the work; the units per resource go down.' },
  resourceShorter: { resource: ['durationDown'],
    nl: 'Een extra resource maakt de taak korter.', en: 'An extra resource makes the task shorter.' },
  resourceAddsWorkSameDuration: { resource: ['workUp', 'durationSame'],
    nl: 'Een extra resource voegt werk toe; de duur blijft gelijk.',
    en: 'An extra resource adds work; the duration stays the same.' },
};

// Alleen bereikbare uitlegzinnen vormen het contract; ongebruikte vertaalsleutels horen daar niet bij.
const reachable = new Set(WORK_RULES.flatMap(rule => [undefined, true, false].flatMap(ed => {
  const ex = workRuleExplanation(rule, ed);
  return [ex.lead, ...ex.rest];
})));
// De tekst in task.json moet letterlijk de tekst zijn waarvan hierboven de betekenis staat.
const here = dirname(fileURLToPath(import.meta.url));
for (const lang of ['nl', 'en'] as const) {
  const json = JSON.parse(readFileSync(join(here, '../../src/i18n/locales', lang, 'task.json'), 'utf8')) as {
    workRule?: { explain?: Record<string, string> };
  };
  const explain = json.workRule?.explain ?? {};
  for (const s of WORK_RULE_SENTENCES) {
    ok(`${lang}: workRule.explain.${s} = "${explain[s]}", verwacht "${MEANING[s][lang]}" (pas de betekenis in deze check mee aan)`,
      explain[s] === MEANING[s][lang]);
    ok(`${lang}: workRule.explain.${s} wordt in geen enkele uitleg gebruikt`, reachable.has(s));
  }
}

// (b) De rekenkern: 8 u/dag, 5 werkdagen, één werkresource op 1,0 (40 u).
// De kern rekent in werkminuten; één dag wordt met een tweede resource exact een halve dag.
const SLOT = 8 * 60;
function base(rule: WorkRule, effortDriven: boolean | undefined, days = 5): TriangleState {
  return {
    rule, effortDriven, remainingMinutes: days * SLOT, slotMinutes: SLOT,
    assignments: [{ id: 'a', unitsPerDay: 1, drivesDuration: true }],
  };
}
interface Measure { duration: number; units: number; work: number }
function measure(s: TriangleState, id = 'a'): Measure {
  const a = s.assignments.find(x => x.id === id)!;
  return { duration: s.remainingMinutes, units: a.unitsPerDay, work: remainingWorkOf(a, s.remainingMinutes) };
}
const same = (x: number, y: number) => Math.abs(x - y) < 1e-6;
const stateOf = (r: TriangleResult, label: string): TriangleState | null => {
  ok(`${label}: de kern weigert de bewerking (${r.ok ? '' : r.reason})`, r.ok);
  return r.ok ? r.state : null;
};

/** Welke grootheid paste zich aan bij een bewerking van `edited`? `null` = geen of meer dan één. */
function adjusted(rule: WorkRule, ed: boolean | undefined, edited: Q): Q | null {
  const s0 = base(rule, ed);
  const label = `${rule}/${String(ed)}/${edited}`;
  const r = edited === 'duration' ? applyDurationEdit(s0, 10 * SLOT)
    : edited === 'units' ? applyUnitsEdit(s0, 'a', 0.5)
      : applyWorkEdit(s0, 'a', 80 * 60);
  const s1 = stateOf(r, label);
  if (!s1) return null;
  const before = measure(s0);
  const after = measure(s1);
  const changed = (['duration', 'units', 'work'] as const).filter(q => q !== edited && !same(before[q], after[q]));
  return changed.length === 1 ? changed[0] : null;
}

function resourceEffects(rule: WorkRule, ed: boolean | undefined, days: number): Set<ResourceEffect> {
  const s0 = base(rule, ed, days);
  const out = new Set<ResourceEffect>();
  const s1 = stateOf(applyAssignmentAdded(s0, { id: 'b', unitsPerDay: 1 }), `${rule}/${String(ed)}/${days}d/resource`);
  if (!s1) return out;
  const totalWork = (s: TriangleState) => s.assignments.reduce((sum, a) => sum + remainingWorkOf(a, s.remainingMinutes), 0);
  if (totalWork(s1) > totalWork(s0) + 1e-6) out.add('workUp');
  if (same(s1.remainingMinutes, s0.remainingMinutes)) out.add('durationSame');
  if (s1.remainingMinutes < s0.remainingMinutes - 1e-6) out.add('durationDown');
  if (measure(s1).units < measure(s0).units - 1e-6) out.add('unitsDown');
  return out;
}

const table: string[] = [];
for (const rule of WORK_RULES) {
  for (const ed of [undefined, true, false] as const) {
    const ex = workRuleExplanation(rule, ed);
    const sentences = [ex.lead, ...ex.rest];
    const label = `${rule} effortDriven=${String(ed)}`;
    // (c) volledigheid: elke bewerking precies één bewering, precies één resourcezin.
    const claims = new Map<Q, Q>();
    for (const s of sentences) {
      for (const [edited, adj] of Object.entries(MEANING[s].edits ?? {}) as [Q, Q][]) {
        ok(`${label}: bewerking "${edited}" staat in meer dan één zin`, !claims.has(edited));
        claims.set(edited, adj);
      }
    }
    for (const q of ['duration', 'units', 'work'] as const) ok(`${label}: geen zin zegt wat er gebeurt bij een ${q}wijziging`, claims.has(q));
    const resourceSentences = sentences.filter(s => MEANING[s].resource);
    ok(`${label}: ${resourceSentences.length} resourcezinnen, verwacht 1`, resourceSentences.length === 1);
    ok(`${label}: de vette zin moet zeggen wat volgt`, MEANING[ex.lead].edits !== undefined);

    // (b) naast de rekenkern.
    const row: string[] = [];
    for (const [edited, claim] of claims) {
      const actual = adjusted(rule, ed, edited);
      row.push(`${edited}→${actual ?? '?'}`);
      ok(`${label}: zin zegt "${edited} gewijzigd ⇒ ${claim} past aan", de rekenkern past ${actual ?? 'niet precies één grootheid'} aan`,
        actual === claim);
    }
    // De resourcezin moet kloppen bij 5 dagen én bij 1 dag (uitkomst: een halve dag).
    for (const days of [5, 1]) {
      const effects = resourceEffects(rule, ed, days);
      row.push(`resource(${days}d): ${[...effects].join('+')}`);
      for (const s of resourceSentences) {
        for (const e of MEANING[s].resource!) {
          ok(`${label} ${days} d: zin "${MEANING[s].nl}" beweert ${e}, de rekenkern geeft ${[...effects].join('+') || 'niets'}`, effects.has(e));
        }
      }
    }
    table.push(`${label.padEnd(46)} ${row.join('  ')}  ⇒ ${sentences.join(', ')}`);
  }
}

// T14: de kern verdeelt één werkdag exact in twee helften.
{
  const state = stateOf(applyAssignmentAdded(base('FIXED_WORK', undefined, 1), { id: 'b', unitsPerDay: 1 }), '1 werkdag');
  ok(`1 werkdag + resource: duur ${state?.remainingMinutes} min, verwacht ${SLOT / 2}`, state?.remainingMinutes === SLOT / 2);
  ok('Vast werk gebruikt de korte zin',
    workRuleExplanation('FIXED_WORK', undefined).rest.includes('resourceShorter'));
  ok('extra resource behoudt het totale werk', state !== null
    && same(state.assignments.reduce((sum, a) => sum + remainingWorkOf(a, state.remainingMinutes), 0), SLOT));
  ok('extra resource behoudt de inzet per resource', state !== null && state.assignments.every(a => a.unitsPerDay === 1));
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX  werkregel-uitleg: ${d}`);
  console.log(`XX  check-work-rule-explain: ${diffs.length} van ${checks} controles rood`);
  for (const line of table) console.log(`    ${line}`);
  process.exit(1);
}
console.log(`OK  check-work-rule-explain: ${checks} controles; elke uitlegzin klopt met de rekenkern (4 regels × 3 effortDriven × 4 bewerkingen)`);
