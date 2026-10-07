// Tutorial 1 — Je eerste planning (`tut-1-eerste-planning`): nieuw project, fasen, taken, mijlpalen, Bereken.
import { l, same, type Action, type L, type Snap, type TutorialScript } from './dsl';
import { PHASES as P, T, taskIs } from './project';

const dialog = { dialog: true } as const;
const durationField = { role: 'textbox', name: l('Duur', 'Duration') } as const;

/** Een nieuwe taak onder de geselecteerde: Taak, naam, Enter. */
const addTask = (name: L): Action[] => [
  { ribbon: 'start:addTask', label: l('Taak', 'Task') },
  { type: name },
  { press: 'Enter' },
];
/** De duur in Eigenschappen: dubbelklik selecteert de oude waarde, dan typen en Enter. */
const setDuration = (days: number): Action[] => [
  { click: durationField, double: true },
  { type: String(days) },
  { press: 'Enter' },
];
const milestone = (kind: L, name: L): Action[] => [
  { ribbon: 'start:milestone', label: l('Mijlpaal', 'Milestone') },
  { click: { button: kind } },
  { type: name },
  { press: 'Enter' },
];
const indent: Action = { ribbon: 'planning:indent', label: l('Inspringen', 'Indent') };

const START_MS = l('Startmijlpaal', 'Start milestone');
const FINISH_MS = l('Eindmijlpaal', 'Finish milestone');
const INSPECTION_MS = l('Inspectiemoment (verplicht)', 'Inspection point (mandatory)');

/** De taken van een fase (vanaf de tweede: de eerste krijgt inspringen erbij). */
type Item = { name: L; days?: number; ms?: L };
const phaseItems = (items: Item[]): Action[] => items.flatMap((item, i) => [
  ...(item.ms ? milestone(item.ms, item.name) : addTask(item.name)),
  ...(i === 0 ? [indent] : []),
  ...(item.days !== undefined ? setDuration(item.days) : []),
]);

/** Klopt de fase: precies deze taken eronder, in deze volgorde, met deze duur? */
const phaseIs = (phase: L, items: Item[]) => (s: Snap, lang: 'nl' | 'en') => {
  const under = s.tasks.filter(t => t.parent === phase[lang]).map(t => t.name);
  const want = items.map(i => i.name[lang]);
  const problems = JSON.stringify(under) === JSON.stringify(want) ? [] : [`onder ${phase[lang]}: ${JSON.stringify(under)}, verwacht ${JSON.stringify(want)}`];
  for (const item of items) {
    problems.push(...taskIs(s, lang, item.name, item.ms ? { milestone: true } : { days: item.days }));
  }
  return problems;
};

const FOUNDATION: Item[] = [
  { name: T.excavate, days: 2 },
  { name: T.rebar, days: 3 },
  { name: T.inspection, ms: INSPECTION_MS },
  { name: T.pour, days: 1 },
  { name: T.foundBrick, days: 2 },
  { name: T.floor, days: 1 },
];
const SHELL: Item[] = [
  { name: T.innerLeaf, days: 5 },
  { name: T.outerLeaf, days: 6 },
  { name: T.roofElements, days: 1 },
  { name: T.roofing, days: 2 },
  { name: T.frames, days: 2 },
  { name: T.breakThrough, days: 2 },
];
const FINISHING: Item[] = [
  { name: T.services, days: 3 },
  { name: T.plaster, days: 4 },
  { name: T.screed, days: 1 },
  { name: T.tiling, days: 3 },
  { name: T.painting, days: 3 },
  { name: T.cleaning, days: 1 },
  { name: T.handover, ms: FINISH_MS },
];

export const TUTORIAL_1: TutorialScript = {
  id: 'tut-1-eerste-planning',
  start: null,
  end: 'na-tut-1',
  steps: [
    {
      id: 'nieuw-project',
      do: [
        { ribbon: 'start:new', label: l('Nieuw', 'New') },
        { waitFor: dialog },
        { fill: { field: l('Projectnaam', 'Project Name'), within: dialog }, value: l('Aanbouw woning', 'House extension') },
        { date: { field: l('Startdatum', 'Start Date'), within: dialog }, value: same('07-06-2027') },
        { click: { role: 'button', name: l('Geen', 'None'), within: dialog } },
        { check: { see: { field: l('Land', 'Country'), within: dialog }, text: l('Nederland', 'Netherlands') } },
        { check: { see: dialog, text: l('36 feestdagen, 2026–2030', '36 holidays, 2026–2030') } },
        { shot: { name: 'tut-1-nieuw-project', of: dialog, pad: 0 } },
        { click: { role: 'button', name: l('Aanmaken', 'Create'), within: dialog } },
      ],
      expect: [
        { gone: dialog },
        { state: (s, lang) => [
          ...(s.projectName === l('Aanbouw woning', 'House extension')[lang] ? [] : [`projectnaam ${s.projectName}`]),
          ...(s.startDate === '2027-06-07' ? [] : [`startdatum ${s.startDate}`]),
          ...(s.tasks.length === 0 ? [] : [`${s.tasks.length} taken`]),
          ...(s.holidays.length > 0 ? [] : ['geen feestdagen']),
        ] },
      ],
    },
    {
      id: 'fasen',
      do: [P.prep, P.foundation, P.shell, P.finishing].flatMap(addTask),
      expect: [{ state: (s, lang) => {
        const top = s.tasks.filter(t => t.parent === null).map(t => `${t.wbs} ${t.name}`);
        const want = [P.prep, P.foundation, P.shell, P.finishing].map((p, i) => `${i + 1} ${p[lang]}`);
        return JSON.stringify(top) === JSON.stringify(want) ? [] : [`fasen ${JSON.stringify(top)}`];
      } }],
    },
    {
      id: 'mijlpaal',
      do: [{ click: { taskName: P.prep } }, ...milestone(START_MS, T.start)],
      expect: [{ state: (s, lang) => taskIs(s, lang, T.start, { milestone: true, kind: 'START', wbs: '2', parent: null }) }],
    },
    {
      id: 'inspringen',
      do: [indent],
      expect: [{ state: (s, lang) => taskIs(s, lang, T.start, { wbs: '1.1', parent: P.prep }) }],
    },
    {
      id: 'voorbereiding',
      do: [
        ...addTask(T.site), ...setDuration(2),
        ...addTask(T.garden), ...setDuration(1),
        ...addTask(T.setout), ...setDuration(1),
      ],
      expect: [{ state: phaseIs(P.prep, [{ name: T.start, ms: START_MS }, { name: T.site, days: 2 }, { name: T.garden, days: 1 }, { name: T.setout, days: 1 }]) }],
    },
    {
      id: 'fundering',
      do: [{ click: { taskName: P.foundation } }, ...phaseItems(FOUNDATION)],
      expect: [{ state: phaseIs(P.foundation, FOUNDATION) }],
    },
    {
      id: 'ruwbouw',
      do: [{ click: { taskName: P.shell } }, ...phaseItems(SHELL)],
      expect: [{ state: phaseIs(P.shell, SHELL) }],
    },
    {
      id: 'afbouw',
      do: [{ click: { taskName: P.finishing } }, ...phaseItems(FINISHING)],
      expect: [
        { state: phaseIs(P.finishing, FINISHING) },
        { see: { anchor: 'status-bar' }, text: l('Taken: 23', 'Tasks: 23') },
        { see: { anchor: 'status-bar' }, text: l('Mijlpalen: 3', 'Milestones: 3') },
      ],
    },
    {
      id: 'berekenen',
      do: [{ ribbon: 'start:calc', label: l('Bereken', 'Calculate') }],
      expect: [
        { state: s => (s.stale ? ['nog verouderd'] : []) },
        { see: { anchor: 'status-bar' }, text: l('Kritiek pad: 1 taak, 6 werkdagen', 'Critical path: 1 task, 6 work days') },
        { see: { anchor: 'status-bar' }, text: l('Einde: 14-06-2027', 'End: 14-06-2027') },
      ],
      shots: [{ name: 'tut-1-berekend', of: { anchor: 'gantt-panel' }, pad: 0, maxWidth: 900 }],
    },
  ],
};
