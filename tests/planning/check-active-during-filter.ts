// "Actief tussen"-filterveld (issue-discussie #32, manuvarkey): een gebruiker kan filteren op
// taken die op een willekeurig moment binnen een periode actief zijn, niet alleen taken die
// binnen die periode STARTEN of EINDIGEN. Dat verschil is precies wat een taak mist die de hele
// periode overspant (start ervoor, einde erna) — een "start binnen periode OF einde binnen
// periode"-filter zou zo'n taak nooit vinden, terwijl hij overduidelijk actief was.
//
// `evaluateActiveDuring` (filterEval.ts) lost dit op met de klassieke interval-overlaptest
// (start ≤ tot ÉN finish ≥ van) i.p.v. de generieke resolveField/applyOperator-route, omdat die
// laatste maar één scalar per veld levert terwijl deze check start ÉN finish tegelijk nodig
// heeft. Deze batterij bewijst het gedrag via de ECHTE store + de echte `evaluate()`.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { evaluate, type ViewContext } from '@/engine/view/filterEval';
import type { Task } from '@/types/task';
import type { FilterNode } from '@/types/view';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const task = (id: string): Task => S().tasks.find(t => t.id === id)!;
const ctx: ViewContext = { activityCodeTypes: [], customFieldDefs: [], resources: [], assignments: [], noneLabel: '(geen)' };

const rule = (value?: string, value2?: string): FilterNode => ({
  kind: 'rule',
  field: { src: 'builtin', key: 'activeDuring' },
  operator: 'between',
  value,
  value2,
});

S().newProject();
S().setProject({ startDate: '2027-01-01' });

// Basistaak om een geldig `TaskTime`-sjabloon uit te lenen — alleen start/finish worden overschreven.
const idBase = S().addTask({ name: 'Basis' });
const withSpan = (start: string, finish: string): string => {
  const base = task(idBase).time;
  return S().addTask({
    name: `${start}..${finish}`,
    time: { ...base, scheduleStart: start, scheduleFinish: finish, earlyStart: start, earlyFinish: finish },
  });
};

// De testperiode: 2027-06-10 t/m 2027-06-20.
const PERIODE = rule('2027-06-10', '2027-06-20');

const idBinnen = withSpan('2027-06-12', '2027-06-15');
eq('01 volledig binnen de periode', evaluate(PERIODE, task(idBinnen), ctx), true);

const idOverspant = withSpan('2027-06-01', '2027-06-30');
eq('02 overspant de hele periode (start ervoor, einde erna) — juist het geval dat "start OF einde binnen periode" mist',
  evaluate(PERIODE, task(idOverspant), ctx), true);

const idEindigtErin = withSpan('2027-06-01', '2027-06-12');
eq('03 begint ervoor, eindigt erin', evaluate(PERIODE, task(idEindigtErin), ctx), true);

const idBeginErin = withSpan('2027-06-15', '2027-06-30');
eq('04 begint erin, eindigt erna', evaluate(PERIODE, task(idBeginErin), ctx), true);

const idVoor = withSpan('2027-05-01', '2027-05-10');
eq('05 volledig vóór de periode — geen overlap', evaluate(PERIODE, task(idVoor), ctx), false);

const idNa = withSpan('2027-07-01', '2027-07-10');
eq('06 volledig ná de periode — geen overlap', evaluate(PERIODE, task(idNa), ctx), false);

const idRaaktStart = withSpan('2027-06-20', '2027-06-25');
eq('07 start precies op de laatste dag van de periode — inclusieve grens', evaluate(PERIODE, task(idRaaktStart), ctx), true);

const idRaaktEinde = withSpan('2027-06-01', '2027-06-10');
eq('08 eindigt precies op de eerste dag van de periode — inclusieve grens', evaluate(PERIODE, task(idRaaktEinde), ctx), true);

const idNetErnaast = withSpan('2027-06-21', '2027-06-25');
eq('09 start één dag na de periode — geen overlap', evaluate(PERIODE, task(idNetErnaast), ctx), false);

// Onvolledige regel (bv. tijdens het intypen in de dialoog): undefined-tolerant, geen throw, geen match.
eq('10 ontbrekende tweede datum matcht niets', evaluate(rule('2027-06-10', undefined), task(idBinnen), ctx), false);
eq('11 helemaal geen datums matcht niets', evaluate(rule(undefined, undefined), task(idBinnen), ctx), false);

// AND-groep zoals de gebruiker 'm in de FilterDialog zou opbouwen (§ discussie #32): een AND van
// twee gewone lte/gte-regels op start/finish moet HETZELFDE resultaat geven als het synthetische
// veld — dat was immers de "makkelijkere optie" die het synthetische veld vervangt.
const equivalentAnd: FilterNode = {
  kind: 'group', op: 'AND',
  children: [
    { kind: 'rule', field: { src: 'builtin', key: 'start' }, operator: 'lte', value: '2027-06-20' },
    { kind: 'rule', field: { src: 'builtin', key: 'finish' }, operator: 'gte', value: '2027-06-10' },
  ],
};
for (const id of [idBinnen, idOverspant, idEindigtErin, idBeginErin, idVoor, idNa, idRaaktStart, idRaaktEinde, idNetErnaast]) {
  eq(`12.${id} synthetisch veld ⇔ handmatige AND-groep`, evaluate(PERIODE, task(id), ctx), evaluate(equivalentAnd, task(id), ctx));
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  active-during-filter: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  active-during-filter: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
