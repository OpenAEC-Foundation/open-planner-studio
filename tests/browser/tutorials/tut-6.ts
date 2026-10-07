// Tutorial 6 — Voortgang en afwijking (`tut-6-uitvoering`): baseline, statusdatum, voortgang in de tabel,
// rekenen en de afwijking lezen.
import { l, same, type Action, type Check, type L, type Snap, type TutorialScript } from './dsl';
import { PHASES, T, taskIs } from './project';
import { enableHourPlanningFromNotice } from './tut-5';

const statusBar = { anchor: 'status-bar' } as const;
const dialog = { dialog: true } as const;
const baselinesGroup = { anchor: 'ribbon-group:planning:baselines' } as const;
const notStale: Check = { state: (s: Snap) => (s.stale ? ['planning nog verouderd'] : []) };
const status = (nl: string, en: string): Check => ({ see: statusBar, text: l(nl, en) });

const ACTUAL_START = l('Werkelijke start', 'Actual start');
const ACTUAL_FINISH = l('Werkelijke einde', 'Actual finish');
const PROGRESS = l('Voortgang', 'Progress');

/** Een kolom toevoegen via Tabel › Kolommen › Kolommen…: categorie openklappen en de kolom kiezen. */
const addColumn = (category: L, column: L): Action[] => [
  { ribbon: 'table:tableColumns', label: l('Kolommen…', 'Columns…') },
  { waitFor: dialog },
  { expand: category, within: dialog },
  { click: { role: 'menuitemcheckbox', name: column, within: dialog } },
  { waitFor: dialog, state: 'hidden' },
];

/** Dubbelklik op een cel van de tabel, typ de waarde en Enter. */
const enter = (task: L, column: L, value: string): Action[] => [
  { click: { cell: { task, column } }, double: true },
  { type: value },
  { press: 'Enter' },
];

/** Klaar met deze werkelijke datums (een mijlpaal: alleen het einde). */
const done = (task: L, start: string | null, finish: string): Action[] => [
  ...(start ? enter(task, ACTUAL_START, start) : []),
  ...enter(task, ACTUAL_FINISH, finish),
];

const finished = (task: L, start: string, finish: string) => (s: Snap, lang: 'nl' | 'en') =>
  taskIs(s, lang, task, { completion: 1, actualStart: start, actualFinish: finish });

export const TUTORIAL_6: TutorialScript = {
  id: 'tut-6-uitvoering',
  start: 'na-tut-5',
  end: 'na-tut-6',
  steps: [
    {
      id: 'startpunt',
      do: [enableHourPlanningFromNotice],
      expect: [notStale, status('Einde: 30-08-2027', 'End: 30-08-2027'), status('Kritiek pad: 17 taken, 46 werkdagen', 'Critical path: 17 tasks, 46 work days')],
    },
    {
      id: 'baseline',
      do: [
        { tab: 'planning', label: l('Planning', 'Planning') },
        { click: { button: l('Baselines beheren…', 'Manage baselines…'), within: baselinesGroup } },
        { waitFor: dialog },
        { fill: { field: l('Nieuwe baseline opslaan', 'Save new baseline'), within: dialog }, value: l('Basisplanning', 'Baseline') },
        { click: { button: l('Opslaan', 'Save'), within: dialog } },
        { check: { state: (s, lang) => (JSON.stringify(s.baselines) === JSON.stringify([l('Basisplanning', 'Baseline')[lang]]) && s.activeBaseline === l('Basisplanning', 'Baseline')[lang] ? [] : [`baselines ${JSON.stringify(s.baselines)} actief ${s.activeBaseline}`]) } },
        { shot: { name: 'tut-6-baseline', of: dialog, pad: 0 } },
        { click: { button: l('Sluiten', 'Close'), within: dialog } },
      ],
      expect: [{ gone: dialog }],
    },
    {
      id: 'statusdatum',
      do: [
        { date: { field: l('Statusdatum', 'Status date'), within: baselinesGroup }, value: same('28-06-2027') },
        { press: 'Enter' },
      ],
      expect: [
        { state: s => [...(s.statusDate?.startsWith('2027-06-28') ? [] : [`statusdatum ${s.statusDate}`]), ...(s.stale ? [] : ['niet verouderd'])] },
        status('Verouderd — herbereken (F5)', 'Out of date — recalculate (F5)'),
      ],
    },
    {
      id: 'voorbereiding',
      do: [
        { tab: 'table', label: l('Tabel', 'Table') },
        ...addColumn(PROGRESS, ACTUAL_START),
        ...addColumn(PROGRESS, ACTUAL_FINISH),
        ...done(T.start, null, '07-06-2027'),
        ...done(T.site, '07-06-2027', '08-06-2027'),
        ...done(T.garden, '09-06-2027', '09-06-2027'),
        ...done(T.setout, '10-06-2027', '10-06-2027'),
      ],
      expect: [
        { state: (s, lang) => [
          ...finished(T.start, '2027-06-07', '2027-06-07')(s, lang),
          ...finished(T.site, '2027-06-07', '2027-06-08')(s, lang),
          ...finished(T.garden, '2027-06-09', '2027-06-09')(s, lang),
          ...finished(T.setout, '2027-06-10', '2027-06-10')(s, lang),
          ...taskIs(s, lang, PHASES.prep, { completion: 0 }),
        ] },
        status('Einde: 30-08-2027', 'End: 30-08-2027'),
      ],
    },
    {
      id: 'ontgraven',
      do: done(T.excavate, '11-06-2027', '15-06-2027'),
      expect: [{ state: finished(T.excavate, '2027-06-11', '2027-06-15') }],
    },
    {
      id: 'fundering',
      do: [
        ...done(T.rebar, '16-06-2027', '18-06-2027'),
        ...done(T.inspection, null, '18-06-2027'),
        ...done(T.pour, '21-06-2027 07:00', '21-06-2027 14:00'),
      ],
      expect: [{ state: (s, lang) => [
        ...finished(T.rebar, '2027-06-16', '2027-06-18')(s, lang),
        ...finished(T.inspection, '2027-06-18', '2027-06-18')(s, lang),
        ...finished(T.pour, '2027-06-21T07:00', '2027-06-21T14:00')(s, lang),
      ] }],
    },
    {
      id: 'metselwerk',
      do: [...enter(T.foundBrick, ACTUAL_START, '25-06-2027'), ...enter(T.foundBrick, PROGRESS, '50')],
      expect: [{ state: (s, lang) => taskIs(s, lang, T.foundBrick, { completion: 0.5, actualStart: '2027-06-25', actualFinish: null }) }],
      shots: [{
        name: 'tut-6-voortgang',
        of: [{ css: '[role="grid"] [role="columnheader"]' }, { cell: { task: T.floor, column: ACTUAL_FINISH } }],
        pad: 0,
        viewport: { width: 1440, height: 1050 },
      }],
    },
    {
      id: 'berekenen',
      do: [{ ribbon: 'table:calc', label: l('Bereken', 'Calculate') }],
      expect: [
        notStale,
        status('Einde: 31-08-2027', 'End: 31-08-2027'),
        status('Kritiek pad: 10 taken, 47 werkdagen', 'Critical path: 10 tasks, 47 work days'),
        { state: (s, lang) => [
          ...taskIs(s, lang, T.handover, { earlyFinish: '2027-08-31' }),
          ...taskIs(s, lang, PHASES.prep, { completion: 1 }),
          ...taskIs(s, lang, T.excavate, { critical: false }),
        ] },
      ],
    },
    {
      id: 'afwijking-gantt',
      do: [{ tab: 'start', label: l('Start', 'Home') }],
      expect: [{ visible: { anchor: 'gantt-panel' } }],
      frame: [
        { tab: 'beeld', label: l('Beeld', 'View') },
        { click: { button: l('Passend maken op project', 'Fit to project') } },
        { tab: 'start', label: l('Start', 'Home') },
      ],
      shots: [{ name: 'tut-6-afwijking-gantt', of: { anchor: 'gantt-panel' }, pad: 0 }],
    },
    {
      id: 'afwijking-tabel',
      do: [
        { tab: 'table', label: l('Tabel', 'Table') },
        ...addColumn(l('Baseline', 'Baseline'), l('Basisplanning — Eindafwijking', 'Baseline — Finish variance')),
      ],
      expect: [
        { see: { cell: { task: T.setout, column: l('Basisplanning — Eindafwijking', 'Baseline — Finish variance') } }, text: '0' },
        { see: { cell: { task: T.excavate, column: l('Basisplanning — Eindafwijking', 'Baseline — Finish variance') } }, text: '1' },
        { see: { cell: { task: T.handover, column: l('Basisplanning — Eindafwijking', 'Baseline — Finish variance') } }, text: '1' },
      ],
    },
  ],
};
