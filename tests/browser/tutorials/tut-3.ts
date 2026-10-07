// Tutorial 3 — De kalender en datumafspraken (`tut-3-kalender`): de bouwvak in de projectkalender, een
// constraint en een deadline.
import { l, same, type Action, type Check, type Snap, type TutorialScript } from './dsl';
import { T, taskIs } from './project';

const statusBar = { anchor: 'status-bar' } as const;
const props = { anchor: 'properties-panel' } as const;
const dialog = { dialog: true } as const;

const notStale: Check = { state: (s: Snap) => (s.stale ? ['planning nog verouderd'] : []) };
const status = (nl: string, en: string): Check => ({ see: statusBar, text: l(nl, en) });
const BOUWVAK = 'Bouwvak (Midden) 2027-08-02..2027-08-20';

/** De deadline in Eigenschappen: de drie vakjes dag, maand, jaar; daarna Enter en F5. */
const setDeadline = (date: string): Action[] => [
  { date: { field: l('Deadline', 'Deadline'), within: props }, value: same(date) },
  { press: 'Enter' },
  { press: 'F5' },
];

const fitToProject: Action[] = [
  { tab: 'beeld', label: l('Beeld', 'View') },
  { click: { button: l('Passend maken op project', 'Fit to project') } },
  { tab: 'start', label: l('Start', 'Home') },
];

export const TUTORIAL_3: TutorialScript = {
  id: 'tut-3-kalender',
  start: 'na-tut-2',
  end: 'na-tut-3',
  steps: [
    {
      id: 'startpunt',
      do: [],
      expect: [notStale, status('Einde: 06-08-2027', 'End: 06-08-2027'), status('Kritiek pad: 21 taken, 45 werkdagen', 'Critical path: 21 tasks, 45 work days')],
    },
    {
      id: 'bouwvak',
      do: [
        { ribbon: 'planning:calendar', label: l('Kalender', 'Calendar') },
        { waitFor: dialog },
        { click: { button: l('Feestdagen genereren…', 'Generate holidays…'), within: dialog } },
        { check: { see: { field: l('Land', 'Country'), within: dialog }, text: l('Nederland', 'Netherlands') } },
        { click: { button: l('Midden', 'Central'), within: dialog } },
        { shot: {
          name: 'tut-3-feestdagen-genereren',
          of: [{ button: l('Feestdagen genereren…', 'Generate holidays…'), within: dialog }, { button: l('Genereren', 'Generate'), within: dialog }],
          pad: 12,
        } },
        { click: { button: l('Genereren', 'Generate'), within: dialog } },
        { click: { button: l('Toepassen', 'Apply'), within: dialog } },
      ],
      expect: [
        { state: s => (s.holidays.includes(BOUWVAK) ? [] : [`bouwvak ontbreekt: ${s.holidays.filter(h => h.includes('2027-08')).join(', ')}`]) },
        notStale,
        status('Einde: 27-08-2027', 'End: 27-08-2027'),
        status('Kritiek pad: 21 taken, 45 werkdagen', 'Critical path: 21 tasks, 45 work days'),
        { state: (s, lang) => taskIs(s, lang, T.tiling, { earlyStart: '2027-08-24' }) },
      ],
    },
    {
      id: 'constraint',
      do: [
        { click: { taskName: T.frames } },
        { select: { field: l('Constraint', 'Constraint'), within: props }, option: l('Start niet eerder dan (SNET)', 'Start no earlier than (SNET)') },
        { date: { field: l('Constraint-datum', 'Constraint date'), within: props }, value: same('14-07-2027') },
        { press: 'Enter' },
      ],
      expect: [
        { state: (s, lang) => [...taskIs(s, lang, T.frames, { constraint: 'SNET 2027-07-14' }), ...(s.stale ? [] : ['niet verouderd'])] },
        status('Verouderd — herbereken (F5)', 'Out of date — recalculate (F5)'),
      ],
    },
    {
      id: 'berekenen',
      do: [{ press: 'F5' }],
      expect: [
        notStale,
        { state: (s, lang) => taskIs(s, lang, T.frames, { earlyStart: '2027-07-14' }) },
        status('Einde: 01-09-2027', 'End: 01-09-2027'),
        status('Kritiek pad: 8 taken, 48 werkdagen', 'Critical path: 8 tasks, 48 work days'),
      ],
      frame: [
        ...fitToProject,
        { click: { taskName: T.painting } },
        { check: { see: props, text: l(
          '⚠ Deze taak loopt over Bouwvak (Midden) — een vrije periode van 23 dagen (31-07-2027 t/m 22-08-2027).',
          '⚠ This task runs through Bouwvak (Midden) — a 23-day non-working period (31-07-2027 to 22-08-2027).',
        ) } },
      ],
      shots: [{ name: 'tut-3-bouwvak-constraint', of: { anchor: 'gantt-panel' }, pad: 0 }],
    },
    {
      id: 'deadline',
      do: [{ click: { taskName: T.handover } }, ...setDeadline('10-09-2027')],
      expect: [
        notStale,
        { state: (s, lang) => taskIs(s, lang, T.handover, { deadline: '2027-09-10', earlyFinish: '2027-09-01' }) },
        { notSee: statusBar, text: l('overschreden', 'missed') },
        status('Kritiek pad: 8 taken, 48 werkdagen', 'Critical path: 8 tasks, 48 work days'),
      ],
    },
    {
      id: 'deadline-krap',
      do: [...setDeadline('27-08-2027')],
      expect: [
        notStale,
        { state: (s, lang) => taskIs(s, lang, T.handover, { deadline: '2027-08-27', earlyFinish: '2027-09-01', totalFloat: -3 }) },
        status('1 deadline(s) overschreden', '1 deadline(s) missed'),
      ],
      frame: [
        { click: { text: l('1 deadline(s) overschreden', '1 deadline(s) missed'), within: statusBar, exact: false } },
        { check: { see: { anchor: 'rail:warnings' }, text: l(
          'Deadline 27-08-2027 overschreden — vroegste einde 01-09-2027',
          'Deadline 27-08-2027 missed — early finish 01-09-2027',
        ) } },
      ],
      shots: [{ name: 'tut-3-deadline-overschreden', of: { anchor: 'rail:warnings' }, pad: 0 }],
    },
    {
      id: 'terugzetten',
      do: [{ click: { taskName: T.handover } }, ...setDeadline('10-09-2027')],
      expect: [
        notStale,
        { state: (s, lang) => taskIs(s, lang, T.handover, { deadline: '2027-09-10' }) },
        { notSee: statusBar, text: l('overschreden', 'missed') },
        status('Kritiek pad: 8 taken, 48 werkdagen', 'Critical path: 8 tasks, 48 work days'),
        status('Einde: 01-09-2027', 'End: 01-09-2027'),
      ],
    },
  ],
};
