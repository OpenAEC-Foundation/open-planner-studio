// Tutorial 4 — Plannen in uren (`tut-4-uren`): urenplanning aanzetten, de stort en twee kraaninzetten in uren.
import { l, type Action, type Check, type L, type Snap, type TutorialScript } from './dsl';
import { T, taskIs } from './project';

const statusBar = { anchor: 'status-bar' } as const;
const dialog = { dialog: true } as const;
const notStale: Check = { state: (s: Snap) => (s.stale ? ['planning nog verouderd'] : []) };
const status = (nl: string, en: string): Check => ({ see: statusBar, text: l(nl, en) });
const END_AND_PATH: Check[] = [status('Einde: 01-09-2027', 'End: 01-09-2027'), status('Kritiek pad: 8 taken, 48 werkdagen', 'Critical path: 8 tasks, 48 work days')];

/** Taak aanklikken en de duur in Eigenschappen vervangen (dubbelklik selecteert de oude waarde). */
const setDuration = (task: L, value: string): Action[] => [
  { click: { taskName: task } },
  { click: { role: 'textbox', name: l('Duur', 'Duration') }, double: true },
  { type: value },
  { press: 'Enter' },
];

export const TUTORIAL_4: TutorialScript = {
  id: 'tut-4-uren',
  start: 'na-tut-3',
  end: 'na-tut-4',
  steps: [
    {
      id: 'startpunt',
      do: [],
      expect: [notStale, ...END_AND_PATH, { see: { cell: { task: T.pour, column: l('Duur', 'Duration') } }, text: '1d' }],
    },
    {
      id: 'urenplanning',
      do: [
        { ribbon: 'instellingen:projectSettings', label: l('Instellingen', 'Settings') },
        { waitFor: dialog },
        { click: { button: l('Planning', 'Planning'), within: dialog } },
        { click: { text: l('Urenplanning inschakelen', 'Enable hour planning'), within: dialog } },
        { check: { visible: { text: l('Gemengde dag/uur-planning toestaan', 'Allow mixed day/hour planning'), within: dialog } } },
        { check: { state: s => (s.ui.enableHourPlanning ? [] : ['urenplanning staat uit']) } },
        { shot: { name: 'tut-4-urenplanning', of: dialog, pad: 0 } },
        { click: { button: l('Sluiten', 'Close'), within: dialog } },
      ],
      expect: [{ gone: dialog }, { state: s => (s.ui.enableHourPlanning ? [] : ['urenplanning staat uit']) }],
    },
    {
      id: 'stort',
      do: setDuration(T.pour, '6h'),
      expect: [
        { state: (s, lang) => [...taskIs(s, lang, T.pour, { minutes: 360 }), ...(s.stale ? [] : ['niet verouderd'])] },
        { see: { cell: { task: T.pour, column: l('Duur', 'Duration') } }, text: '6h' },
        status('Verouderd — herbereken (F5)', 'Out of date — recalculate (F5)'),
      ],
    },
    {
      id: 'kraan-vloer',
      do: setDuration(T.floor, '5h'),
      expect: [{ state: (s, lang) => taskIs(s, lang, T.floor, { minutes: 300 }) }],
    },
    {
      id: 'kraan-dak',
      do: setDuration(T.roofElements, '6h'),
      expect: [{ state: (s, lang) => taskIs(s, lang, T.roofElements, { minutes: 360 }) }],
    },
    {
      id: 'berekenen',
      do: [
        { ribbon: 'start:calc', label: l('Bereken', 'Calculate') },
        { tab: 'table', label: l('Tabel', 'Table') },
        { dragColumnEdge: { column: l('Start', 'Start'), dx: 40 } },
        { dragColumnEdge: { column: l('Einde', 'Finish'), dx: 40 } },
      ],
      expect: [
        notStale,
        ...END_AND_PATH,
        { state: (s, lang) => [
          ...taskIs(s, lang, T.pour, { earlyStart: '2027-06-18T07:00', earlyFinish: '2027-06-18T14:00', totalFloat: 3.25 }),
          ...taskIs(s, lang, T.floor, { earlyStart: '2027-06-28T07:00', earlyFinish: '2027-06-28T12:00', totalFloat: 3.375 }),
          ...taskIs(s, lang, T.roofElements, { earlyStart: '2027-07-06T07:00', earlyFinish: '2027-07-06T14:00', totalFloat: 3.25 }),
        ] },
        { see: { cell: { task: T.pour, column: l('Start', 'Start') } }, text: '07:00' },
        { see: { cell: { task: T.floor, column: l('Totale speling', 'Total float') } }, text: l('3,38', '3.38') },
      ],
      shots: [{
        name: 'tut-4-kloktijden',
        of: [{ cell: { task: T.rebar, column: l('WBS', 'WBS') } }, { cell: { task: T.roofing, column: l('Voortgang', 'Progress') } }],
        pad: 0,
      }],
    },
    {
      id: 'langere-kraan',
      do: [...setDuration(T.roofElements, '12h'), { press: 'F5' }],
      expect: [
        notStale,
        ...END_AND_PATH,
        { state: (s, lang) => [
          ...taskIs(s, lang, T.roofElements, { minutes: 720, earlyStart: '2027-07-06T07:00', earlyFinish: '2027-07-07T11:00', totalFloat: 2.5 }),
          ...taskIs(s, lang, T.roofing, { earlyStart: '2027-07-08', earlyFinish: '2027-07-09', totalFloat: 2 }),
          ...taskIs(s, lang, T.innerLeaf, { totalFloat: 2 }),
        ] },
      ],
    },
    {
      id: 'terugzetten',
      do: [...setDuration(T.roofElements, '6h'), { press: 'F5' }],
      expect: [
        notStale,
        ...END_AND_PATH,
        { state: (s, lang) => [
          ...taskIs(s, lang, T.roofElements, { minutes: 360, earlyFinish: '2027-07-06T14:00', totalFloat: 3.25 }),
          ...taskIs(s, lang, T.roofing, { earlyStart: '2027-07-07' }),
        ] },
      ],
    },
  ],
};
