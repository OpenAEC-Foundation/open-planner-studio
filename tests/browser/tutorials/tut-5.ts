// De dagenmaat (§3.14): de waarden zijn die van de urenreferentie (minute-model-tutorial-f3.json).
// Tutorial 5 — Resources en nivelleren (`tut-5-resources`): vijf resources, twaalf toewijzingen, de werkregel
// van het stucwerk, het histogram, overbezetting en nivelleren.
import { l, same, type Action, type Check, type L, type Lang, type Snap, type TutorialScript } from './dsl';
import { R, T, taskIs } from './project';

const statusBar = { anchor: 'status-bar' } as const;
const props = { anchor: 'properties-panel' } as const;
const dialog = { dialog: true } as const;
const draftRow = { css: 'tr[data-ops-pending-new-row="true"]' } as const;
/** Het resourcepaneel (de kaart met de resourcetabel). */
const resourcePanel = { css: '.ui-card:has(table)' } as const;
const notStale: Check = { state: (s: Snap) => (s.stale ? ['planning nog verouderd'] : []) };
const status = (nl: string, en: string): Check => ({ see: statusBar, text: l(nl, en) });
const OVERALLOCATED = l('⚠ 1 resource(s) overbezet', '⚠ 1 resource(s) overallocated');


/** Eén resource in de conceptrij: naam, type, eventueel Max. eenheden en Eenheid, Enter. */
const resource = (name: L, type: L, max?: string, unit?: string): Action[] => [
  { type: name },
  // Kolommen van de conceptrij: 3 Type, 4 Max. eenheden, 8 Eenheid. Enter in de rij legt hem vast (ook met
  // de focus op de keuzelijst Type).
  { select: { css: 'td:nth-child(3) select', within: draftRow }, option: type },
  ...(max ? [{ click: { css: 'td:nth-child(4) input', within: draftRow }, double: true } as Action, { type: max } as Action] : []),
  ...(unit ? [{ click: { css: 'td:nth-child(8) input', within: draftRow } } as Action, { type: unit } as Action] : []),
  { press: 'Enter' },
];

/** Taak selecteren, Toewijzen ▾ openen en de resource aanklikken (eventueel eerst Eenh./dag). */
const assign = (task: L, res: L, units?: string): Action[] => [
  { click: { taskName: task } },
  { ribbon: 'resources:resourceAssign', label: l('Toewijzen', 'Assign') },
  ...(units ? [{ click: { field: l('Eenh./dag', 'Units/day') }, double: true } as Action, { type: units } as Action] : []),
  { click: { button: res } },
];

const has = (task: L, res: L, units: number) => (lang: Lang) => `${task[lang]} ← ${res[lang]} × ${units}`;
const assignmentsPresent = (want: ((lang: Lang) => string)[]) => (s: Snap, lang: Lang) =>
  want.map(f => f(lang)).filter(a => !s.assignments.includes(a)).map(a => `toewijzing ontbreekt: ${a}`);

const BRICKLAYER = [has(T.foundBrick, R.bricklayer, 1), has(T.innerLeaf, R.bricklayer, 1), has(T.outerLeaf, R.bricklayer, 1), has(T.breakThrough, R.bricklayer, 1)];
const CREW_CRANE = [
  has(T.rebar, R.crew, 1), has(T.floor, R.crew, 1), has(T.roofElements, R.crew, 1), has(T.frames, R.crew, 1),
  has(T.floor, R.crane, 1), has(T.roofElements, R.crane, 1),
];
const OTHER = [has(T.plaster, R.plasterer, 1), has(T.pour, R.concrete, 8)];

export const TUTORIAL_5: TutorialScript = {
  id: 'tut-5-resources',
  start: 'na-tut-4',
  end: 'na-tut-5',
  steps: [
    {
      id: 'startpunt',
      do: [],
      expect: [
        notStale,
        status('Einde: 01-09-2027', 'End: 01-09-2027'),
        status('Kritiek pad: 8 taken, 48 werkdagen', 'Critical path: 8 tasks, 48 work days'),
        { notSee: statusBar, text: l('overbezet', 'overallocated') },
      ],
    },
    {
      id: 'resources',
      do: [
        { ribbon: 'resources:newResource', label: l('Nieuwe resource', 'New resource') },
        ...resource(R.crew, l('Ploeg', 'Crew')),
        ...resource(R.bricklayer, l('Arbeid', 'Labor')),
        ...resource(R.crane, l('Materieel', 'Equipment')),
        ...resource(R.plasterer, l('Onderaannemer', 'Subcontractor'), '2'),
        ...resource(R.concrete, l('Materiaal', 'Material'), '50', 'm³'),
        { press: 'Escape' },
      ],
      expect: [{ state: (s, lang) => {
        const got = JSON.stringify(s.resources);
        const want = JSON.stringify([
          { name: R.crew[lang], type: 'CREW', maxUnits: 1, unit: null },
          { name: R.bricklayer[lang], type: 'LABOR', maxUnits: 1, unit: null },
          { name: R.crane[lang], type: 'EQUIPMENT', maxUnits: 1, unit: null },
          { name: R.plasterer[lang], type: 'SUBCONTRACTOR', maxUnits: 2, unit: null },
          { name: R.concrete[lang], type: 'MATERIAL', maxUnits: 50, unit: 'm³' },
        ]);
        return got === want ? [] : [`resources ${got}`];
      } }],
      shots: [{ name: 'tut-5-resources', of: resourcePanel, pad: 0, maxWidth: 1000, maxHeight: 220 }],
    },
    {
      id: 'toewijzen-metselaar',
      do: [
        { click: { role: 'button', name: l('Sluiten', 'Close'), within: resourcePanel } },
        ...assign(T.foundBrick, R.bricklayer),
        ...assign(T.innerLeaf, R.bricklayer),
        ...assign(T.outerLeaf, R.bricklayer),
        ...assign(T.breakThrough, R.bricklayer),
      ],
      expect: [{ state: assignmentsPresent(BRICKLAYER) }, { see: statusBar, text: OVERALLOCATED }],
    },
    {
      id: 'toewijzen-ploeg-kraan',
      do: [
        ...assign(T.rebar, R.crew), ...assign(T.floor, R.crew), ...assign(T.roofElements, R.crew), ...assign(T.frames, R.crew),
        ...assign(T.floor, R.crane), ...assign(T.roofElements, R.crane),
      ],
      expect: [{ state: assignmentsPresent(CREW_CRANE) }],
    },
    {
      id: 'toewijzen-overig',
      do: [...assign(T.plaster, R.plasterer), ...assign(T.pour, R.concrete, '8')],
      expect: [{ state: (s, lang) => [
        ...assignmentsPresent([...BRICKLAYER, ...CREW_CRANE, ...OTHER])(s, lang),
        ...(s.assignments.length === 12 ? [] : [`${s.assignments.length} toewijzingen, verwacht 12`]),
      ] }],
    },
    {
      id: 'werkregel',
      do: [
        { ribbon: 'instellingen:projectSettings', label: l('App-instellingen', 'App settings') },
        { waitFor: dialog },
        { click: { button: l('Planning', 'Planning'), within: dialog } },
        { click: { text: l('Taaktypes gebruiken', 'Use task types'), within: dialog } },
        { check: { state: s => (s.ui.showTaskTypes ? [] : ['werkregels niet zichtbaar']) } },
        { click: { button: l('Sluiten', 'Close'), within: dialog } },
        { click: { taskName: T.plaster } },
        { select: { field: l('Taaktype', 'Task type'), within: props }, option: l('Vast werk', 'Fixed work') },
      ],
      expect: [
        { state: (s, lang) => {
          const t = s.tasks.find(x => x.name === T.plaster[lang]);
          return t?.workRule?.includes('FIXED_WORK') ? [] : [`werkregel ${t?.workRule}`];
        } },
        { see: props, text: l('Vast werk', 'Fixed work') },
        // B1 (spec "alleen uren" §3.2 B1a, §5.2 geval 11c): vast werk is altijd urenmaat. Het stucwerk van
        // 4 d wordt 4 × 8 u = 32 u, en die maatwissel is planning: de planning is verouderd.
        { state: (s, lang) => [...taskIs(s, lang, T.plaster, { minutes: 32 * 60 }), ...(s.stale ? [] : ['niet verouderd'])] },
      ],
      shots: [{
        name: 'tut-5-werkregel',
        of: [{ text: l('Taaktype', 'Task type'), within: props }, { text: l('Vast werk', 'Fixed work'), within: props }],
        pad: 10,
      }],
    },
    {
      id: 'tweede-stukadoor',
      do: [
        { click: { role: 'textbox', name: l('Eenh./dag — Stukadoor', 'Units/day — Plasterer'), within: props }, double: true },
        { type: '2' },
        { press: 'Enter' },
      ],
      expect: [
        // B1 (B1a): de urenmaat-taak van 32 u wordt met inzet 2 16 u (2 werkdagen van 8 u).
        { state: (s, lang) => [...assignmentsPresent([has(T.plaster, R.plasterer, 2)])(s, lang), ...taskIs(s, lang, T.plaster, { minutes: 16 * 60 })] },
        status('Verouderd — herbereken (F5)', 'Out of date — recalculate (F5)'),
      ],
    },
    {
      id: 'berekenen',
      do: [{ ribbon: 'start:calc', label: l('Bereken', 'Calculate') }],
      expect: [
        notStale,
        { state: (s, lang) => taskIs(s, lang, T.plaster, { earlyStart: '2027-07-23', earlyFinish: '2027-07-26' }) },
        status('Einde: 30-08-2027', 'End: 30-08-2027'),
        status('Kritiek pad: 8 taken, 46 werkdagen', 'Critical path: 8 tasks, 46 work days'),
        { see: statusBar, text: OVERALLOCATED },
      ],
    },
    {
      id: 'histogram',
      do: [
        { ribbon: 'resources:toggleHistogram', label: l('Histogram', 'Histogram') },
        { press: 'Escape' },
        { histogramPick: R.crane },
      ],
      expect: [{ state: (s, lang) => [
        ...(s.ui.showHistogram ? [] : ['histogram dicht']),
        ...(s.ui.histogramResource === R.crane[lang] ? [] : [`histogram toont ${s.ui.histogramResource}`]),
      ] }],
      shots: [{ name: 'tut-5-histogram-kraan', of: { anchor: 'histogram-strip' }, pad: 0 }],
    },
    {
      id: 'overbezetting',
      do: [
        { click: { text: OVERALLOCATED, within: statusBar } },
        { click: { text: R.bricklayer, within: { anchor: 'rail:warnings' }, exact: false } },
      ],
      expect: [
        // F3c-tussenstand (B2): de oude belastingroute telt 28 juni t/m 2 juli. Het doel, 6 dagen van 28 juni
        // t/m 5 juli (plaatsingsreferentie), haalt F3c deel 3 (belasting per werkdag uit momenten, §3.11).
        { see: { anchor: 'rail:warnings' }, text: l('Overbezet op 5 dag(en) (28-06-2027 – 02-07-2027)', 'Overallocated on 5 day(s) (28-06-2027 – 02-07-2027)') },
        { state: (s, lang) => (s.ui.histogramResource === R.bricklayer[lang] ? [] : [`histogram toont ${s.ui.histogramResource}`]) },
      ],
      shots: [{ name: 'tut-5-overbezetting', of: [{ anchor: 'gantt-panel' }, { anchor: 'histogram-strip' }], pad: 0 }],
    },
    {
      id: 'nivelleren',
      do: [
        { ribbon: 'resources:levelResources', label: l('Nivelleren…', 'Level…') },
        { waitFor: dialog },
        { click: { button: l('Berekenen', 'Calculate'), within: dialog } },
        { check: { see: dialog, text: l('Projecteinddatum: ongewijzigd (30-08-2027)', 'Project end date: unchanged (30-08-2027)') } },
        { check: { see: dialog, text: same('05-07-2027') } },
        { shot: { name: 'tut-5-nivelleren', of: dialog, pad: 0 } },
        { click: { button: l('Toepassen', 'Apply'), within: dialog } },
      ],
      expect: [
        { gone: dialog },
        { state: (s, lang) => [
          ...taskIs(s, lang, T.outerLeaf, { earlyStart: '2027-07-05T10:00', earlyFinish: '2027-07-13T10:00', totalFloat: 0.625, critical: false }),
          ...(s.overallocated.length === 0 ? [] : [`nog overbezet: ${s.overallocated.join(', ')}`]),
        ] },
        { notSee: statusBar, text: l('overbezet', 'overallocated') },
        status('Kritiek pad: 8 taken, 46 werkdagen', 'Critical path: 8 tasks, 46 work days'),
        { see: { anchor: 'ribbon-group:resources:overallocationIndicator' }, text: l('Geen', 'None') },
      ],
    },
  ],
};
