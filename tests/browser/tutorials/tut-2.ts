// Tutorial 2 — Relaties en het kritieke pad (`tut-2-relaties-kritiek-pad`): relaties en lag, Bereken (F5),
// kritiek pad en speling lezen.
import { l, same, type Action, type L, type Snap, type Lang, type TutorialScript } from './dsl';
import { T, taskIs } from './project';

const statusBar = { anchor: 'status-bar' } as const;
const PRED = l('Voorgangers', 'Predecessors');
const DURATION = l('Duur', 'Duration');

/** Een relatie zoals de snapshot hem schrijft (Eind-Start, lag in werkdagen). */
const fs = (pred: L, succ: L, lag = 0) => (lang: Lang) => `${pred[lang]} → ${succ[lang]} FINISH_START ${lag}`;
const linksPresent = (links: ((lang: Lang) => string)[]) => (s: Snap, lang: Lang) =>
  links.map(f => f(lang)).filter(want => !s.links.includes(want)).map(want => `relatie ontbreekt: ${want}`);

/** Typ in de kolom Voorgangers vanaf de cel van `first` naar beneden (Enter gaat naar de cel eronder). */
const typeDown = (first: L, values: string[]): Action[] => [
  { click: { cell: { task: first, column: PRED } } },
  ...values.flatMap((v): Action[] => [{ type: v }, { press: 'Enter' }]),
];

const FOUNDATION_LINKS = [fs(T.setout, T.excavate), fs(T.excavate, T.rebar), fs(T.rebar, T.inspection), fs(T.inspection, T.pour)];
const SHELL_LINKS = [
  fs(T.foundBrick, T.floor), fs(T.floor, T.innerLeaf), fs(T.floor, T.outerLeaf), fs(T.innerLeaf, T.roofElements),
  fs(T.roofElements, T.roofing), fs(T.roofing, T.frames), fs(T.outerLeaf, T.frames), fs(T.frames, T.breakThrough),
];
const FINISHING_LINKS = [
  fs(T.breakThrough, T.services), fs(T.services, T.plaster), fs(T.plaster, T.screed), fs(T.screed, T.tiling, 5),
  fs(T.plaster, T.painting), fs(T.tiling, T.cleaning), fs(T.painting, T.cleaning), fs(T.cleaning, T.handover),
];

const calcF5: Action = { press: 'F5' };
const notStale = { state: (s: Snap) => (s.stale ? ['planning nog verouderd'] : []) };

export const TUTORIAL_2: TutorialScript = {
  id: 'tut-2-relaties-kritiek-pad',
  start: 'na-tut-1',
  end: 'na-tut-2',
  steps: [
    {
      id: 'startpunt',
      do: [{ click: { taskName: T.handover } }],
      expect: [
        notStale,
        { see: statusBar, text: l('Einde: 14-06-2027', 'End: 14-06-2027') },
        { see: statusBar, text: l('Kritiek pad: 1 taak, 6 werkdagen', 'Critical path: 1 task, 6 work days') },
        { state: (s, lang) => taskIs(s, lang, T.handover, { wbs: '4.7', earlyStart: '2027-06-07' }) },
      ],
    },
    {
      id: 'eerste-relatie',
      do: [
        { click: { taskName: T.start } },
        { click: { taskName: T.site }, modifiers: ['Control'] },
        { ribbon: 'start:relation', label: l('Relatie', 'Link') },
        { click: { button: l('Geselecteerde taken koppelen', 'Link selected tasks') } },
      ],
      expect: [
        { state: linksPresent([fs(T.start, T.site)]) },
        { see: { css: 'body' }, text: l('Relatie aangemaakt: Start bouw → Bouwplaats inrichten', 'Relation created: Start of construction → Set up site') },
        { see: statusBar, text: l('Verouderd — herbereken (F5)', 'Out of date — recalculate (F5)') },
      ],
    },
    {
      id: 'relaties-tekenen',
      do: [
        { ribbon: 'start:relation', label: l('Relatie', 'Link') },
        { click: { button: l('Relatie tekenen', 'Draw relation') } },
        { check: { see: { css: 'body' }, text: l(
          'Relatiemodus: sleep in de Gantt van de ene balk naar de andere om een relatie te leggen. Esc stopt.',
          'Link mode: drag from one bar to another in the Gantt to create a relation. Press Esc to stop.',
        ) } },
        { dragBar: { from: T.site, to: T.garden } },
        { waitFor: { text: l('Type relatie', 'Relation type') } },
        // De melding van stap 2 staat er nog; wegklikken zou ook dit venstertje sluiten.
        { shot: { name: 'tut-2-type-relatie', of: { text: l('Type relatie', 'Relation type') }, pad: 120, keepToasts: true } },
        { press: 'Enter' },
        { dragBar: { from: T.garden, to: T.setout } },
        { waitFor: { text: l('Type relatie', 'Relation type') } },
        { press: 'Enter' },
        { press: 'Escape' },
      ],
      expect: [{ state: linksPresent([fs(T.site, T.garden), fs(T.garden, T.setout)]) }],
    },
    {
      id: 'fundering',
      do: [
        { tab: 'table', label: l('Tabel', 'Table') },
        { click: { role: 'button', name: l('Kolom toevoegen', 'Add column') } },
        { expand: l('Relaties', 'Relations'), within: { dialog: true } },
        { click: { role: 'menuitemcheckbox', name: PRED, within: { dialog: true } } },
        ...typeDown(T.excavate, ['1.4 FS', '2.1 FS', '2.2 FS', '2.3 FS']),
      ],
      expect: [
        { state: linksPresent(FOUNDATION_LINKS) },
        { see: { cell: { task: T.pour, column: PRED } }, text: same('2.3 FS') },
      ],
    },
    {
      id: 'lag',
      do: [{ click: { cell: { task: T.foundBrick, column: PRED } } }, { type: '2.4 FS+3' }, { press: 'Enter' }, calcF5],
      expect: [
        { state: linksPresent([fs(T.pour, T.foundBrick, 3)]) },
        notStale,
        { see: { cell: { task: T.foundBrick, column: PRED } }, text: same('2.4 FS+3d') },
        { state: (s, lang) => [
          ...taskIs(s, lang, T.pour, { earlyStart: '2027-06-18' }),
          ...taskIs(s, lang, T.foundBrick, { earlyStart: '2027-06-24' }),
        ] },
      ],
    },
    {
      id: 'ruwbouw',
      do: [
        { click: { cell: { task: T.floor, column: PRED } } }, { type: '2.5 FS' }, { press: 'Enter' },
        ...typeDown(T.innerLeaf, ['2.6 FS', '2.6 FS', '3.1 FS', '3.3 FS', '3.4 FS; 3.2 FS', '3.5 FS']),
      ],
      expect: [
        { state: linksPresent(SHELL_LINKS) },
        { see: { cell: { task: T.frames, column: PRED } }, text: same('3.4 FS; 3.2 FS') },
      ],
    },
    {
      id: 'afbouw',
      do: typeDown(T.services, ['3.6 FS', '4.1 FS', '4.2 FS', '4.3 FS+5', '4.2 FS', '4.4 FS; 4.5 FS', '4.6 FS']),
      expect: [{ state: (s, lang) => [
        ...linksPresent(FINISHING_LINKS)(s, lang),
        ...(s.links.length === 24 ? [] : [`${s.links.length} relaties, verwacht 24`]),
      ] }],
    },
    {
      id: 'berekenen',
      do: [
        { tab: 'start', label: l('Start', 'Home') },
        { ribbon: 'start:calc', label: l('Bereken', 'Calculate') },
      ],
      expect: [
        notStale,
        { see: statusBar, text: l('Einde: 06-08-2027', 'End: 06-08-2027') },
        { see: statusBar, text: l('Kritiek pad: 21 taken, 45 werkdagen', 'Critical path: 21 tasks, 45 work days') },
      ],
      frame: [
        { tab: 'beeld', label: l('Beeld', 'View') },
        { click: { button: l('Passend maken op project', 'Fit to project') } },
        { tab: 'start', label: l('Start', 'Home') },
      ],
      shots: [{ name: 'tut-2-kritiek-pad', of: { anchor: 'gantt-panel' }, pad: 0 }],
    },
    {
      id: 'uitloop',
      do: [
        { tab: 'table', label: l('Tabel', 'Table') },
        { click: { taskName: T.outerLeaf } },
        { check: { see: { anchor: 'properties-panel' }, text: same('06-07-2027') } },
        { check: { see: { anchor: 'properties-panel' }, text: same('08-07-2027') } },
        { check: { see: { cell: { task: T.outerLeaf, column: l('Totale speling', 'Total float') } }, text: same('2') } },
        { check: { see: { cell: { task: T.painting, column: l('Totale speling', 'Total float') } }, text: same('6') } },
        { shot: {
          name: 'tut-2-speling',
          of: [{ cell: { task: T.innerLeaf, column: l('WBS', 'WBS') } }, { cell: { task: T.breakThrough, column: PRED } }],
          pad: 0,
        } },
        { click: { cell: { task: T.outerLeaf, column: DURATION } } }, { type: '9' }, { press: 'Enter' }, calcF5,
      ],
      expect: [
        notStale,
        { state: (s, lang) => taskIs(s, lang, T.outerLeaf, { days: 9 }) },
        { see: statusBar, text: l('Einde: 09-08-2027', 'End: 09-08-2027') },
        { see: statusBar, text: l('Kritiek pad: 19 taken, 46 werkdagen', 'Critical path: 19 tasks, 46 work days') },
      ],
    },
    {
      id: 'terugzetten',
      do: [{ click: { cell: { task: T.outerLeaf, column: DURATION } } }, { type: '6' }, { press: 'Enter' }, calcF5],
      expect: [
        notStale,
        { state: (s, lang) => taskIs(s, lang, T.outerLeaf, { days: 6, totalFloat: 2 }) },
        { see: statusBar, text: l('Einde: 06-08-2027', 'End: 06-08-2027') },
        { see: statusBar, text: l('Kritiek pad: 21 taken, 45 werkdagen', 'Critical path: 21 tasks, 45 work days') },
      ],
    },
  ],
};
