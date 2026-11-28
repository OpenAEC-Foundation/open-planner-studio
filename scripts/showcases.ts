import type { ProjectSpec, TaskSpec, LinkSpec } from './spec';

const KLEIN: ProjectSpec = {
  slug: 'showcase-verbouwing-eengezinswoning',
  name: 'Refurbishment & Extension of a Family Home',
  author: 'Contractor',
  company: 'Van Dijk Construction BV',
  category: 'showcase',
  description: 'Extension plus internal refurbishment of a family home — entry-level schedule.',
  publicDescription:
    'Entry-level showcase: an extension to a family home with WBS phasing, a finish-start chain with one ' +
    'start-start overlap (walls/roof) and one finish-finish link (painting just after tiling), an ' +
    'SNET permit constraint, a start milestone and a mandatory handover milestone, a comfortable deadline ' +
    '(no conflict) and one baseline taken right after set-up. A small crew set from the shared demo ' +
    'resource library, without any overallocation of its own — the masonry crew is booked in the same ' +
    'week as the terraced houses showcase, so the occupancy overview shows a cross-project conflict.',
  tags: ['residential', 'small', 'entry-level', 'milestones', 'constraints', 'baseline', 'resources'],
  anchorShiftDays: 66,
  tasks: [
    { key: 'ms_start', name: 'Start of refurbishment', milestone: true, milestoneKind: 'START' },
    { key: 'P1', name: '1. Preparation', taskType: 'LOGISTIC' },
    { key: 'v1', name: 'Set up site', parent: 'P1', dur: 2, taskType: 'LOGISTIC' },
    { key: 'v2', name: 'Demolish existing extension', parent: 'P1', dur: 3, taskType: 'DEMOLITION',
      constraint: { type: 'SNET', offsetDay: 6 } },
    { key: 'P2', name: '2. Foundations & structure', taskType: 'CONSTRUCTION' },
    { key: 'f1', name: 'Earthworks for extension', parent: 'P2', dur: 3, taskType: 'CONSTRUCTION' },
    { key: 'f2', name: 'Extension foundations', parent: 'P2', dur: 4, taskType: 'CONSTRUCTION' },
    { key: 'f3', name: 'Pour ground floor slab', parent: 'P2', dur: 3, taskType: 'CONSTRUCTION' },
    { key: 'f4', name: 'Build masonry walls', parent: 'P2', dur: 6, taskType: 'CONSTRUCTION',
      assign: [{ res: 'Masonry crew', units: 1 }, { res: 'Bricklayers', units: 2 }] },
    { key: 'f5', name: 'Install roof structure', parent: 'P2', dur: 4, taskType: 'CONSTRUCTION',
      assign: [{ res: 'Carpenters', units: 2 }] },
    { key: 'P3', name: '3. Fit-out', taskType: 'CONSTRUCTION' },
    { key: 'a1', name: 'Apply roofing', parent: 'P3', dur: 3, taskType: 'CONSTRUCTION',
      assign: [{ res: 'Carpenters', units: 2 }] },
    { key: 'a2', name: 'Install window frames', parent: 'P3', dur: 4, taskType: 'INSTALLATION',
      assign: [{ res: 'Carpenters', units: 2 }] },
    { key: 'a3', name: 'Plastering', parent: 'P3', dur: 5, taskType: 'CONSTRUCTION',
      assign: [{ res: 'Plasterers', units: 2 }] },
    { key: 'a4', name: 'Tiling', parent: 'P3', dur: 4, taskType: 'INSTALLATION',
      assign: [{ res: 'Tilers', units: 2 }] },
    { key: 'a5', name: 'Painting', parent: 'P3', dur: 3, taskType: 'CONSTRUCTION',
      assign: [{ res: 'Painters', units: 2 }] },
    { key: 'P4', name: '4. Handover', taskType: 'ATTENDANCE' },
    { key: 'o1', name: 'Final cleaning', parent: 'P4', dur: 1, taskType: 'LOGISTIC' },
    { key: 'ms_opl', name: 'Handover inspection', parent: 'P4', milestone: true, milestoneKind: 'FINISH',
      mandatory: true, deadlineDay: 60,
      description: 'Mandatory handover inspection; the deadline has ample margin (no conflict).' },
    { key: 'o2', name: 'Final handover with the occupant', parent: 'P4', dur: 1, taskType: 'ATTENDANCE' },
  ],
  links: [
    { pred: 'ms_start', succ: 'v1' }, { pred: 'v1', succ: 'v2' }, { pred: 'v2', succ: 'f1' },
    { pred: 'f1', succ: 'f2' }, { pred: 'f2', succ: 'f3' }, { pred: 'f3', succ: 'f4' },
    { pred: 'f4', succ: 'f5', type: 'START_START', lag: 2 },
    { pred: 'f5', succ: 'a1' }, { pred: 'a1', succ: 'a2' }, { pred: 'a2', succ: 'a3' },
    { pred: 'a3', succ: 'a4' }, { pred: 'a3', succ: 'a5' },
    { pred: 'a4', succ: 'a5', type: 'FINISH_FINISH', lag: 1 },
    { pred: 'a5', succ: 'o1' }, { pred: 'o1', succ: 'ms_opl' }, { pred: 'ms_opl', succ: 'o2' },
  ],
  resources: [
    { name: 'Masonry crew', type: 'CREW', maxUnits: 1,
      description: 'The same masonry crew as on the terraced houses — it comes over for the extension walls' },
    { name: 'Bricklayers', type: 'LABOR', maxUnits: 2, costPerHour: 46, parent: 'Masonry crew' },
    { name: 'Carpenters', type: 'LABOR', maxUnits: 2, costPerHour: 45 },
    { name: 'Plasterers', type: 'LABOR', maxUnits: 2, costPerHour: 42 },
    { name: 'Tilers', type: 'LABOR', maxUnits: 2, costPerHour: 43 },
    { name: 'Painters', type: 'LABOR', maxUnits: 2, costPerHour: 38 },
  ],
  baselines: [{ name: 'Baseline plan' }],
};

const HOUSES = [1, 2, 3, 4, 5, 6];
const middelTasks: TaskSpec[] = [];
const middelLinks: LinkSpec[] = [];

middelTasks.push(
  { key: 'ms_start', name: 'Start of construction', milestone: true, milestoneKind: 'START', codes: { House: 'GEN' },
    completion: 1, actualStartDay: 0, actualFinishDay: 0 },
  { key: 'P1', name: '1. Site set-up', taskType: 'LOGISTIC', codes: { House: 'GEN' } },
  { key: 't0', name: 'Install site board & safety fencing', parent: 'P1', dur: 1, taskType: 'LOGISTIC',
    codes: { House: 'GEN' },
    completion: 1, actualStartDay: 0, actualFinishDay: 1 },
  { key: 't1', name: 'Construct site road', parent: 'P1', dur: 3, taskType: 'LOGISTIC',
    codes: { House: 'GEN' },
    completion: 1, actualStartDay: 1, actualFinishDay: 4 },
  { key: 't2', name: 'Place site huts', parent: 'P1', dur: 2, taskType: 'LOGISTIC',
    codes: { House: 'GEN' },
    completion: 1, actualStartDay: 4, actualFinishDay: 6 },
  { key: 't3', name: 'Install utility connections', parent: 'P1', dur: 3, taskType: 'LOGISTIC',
    priority: 1000,
    description: 'Pinned (priority 1000): the connection date is fixed by the utility company and must not move.',
    codes: { House: 'GEN' },
    completion: 1, actualStartDay: 6, actualFinishDay: 9 },
);
middelLinks.push(
  { pred: 'ms_start', succ: 't0' }, { pred: 't0', succ: 't1' }, { pred: 't1', succ: 't2' }, { pred: 't2', succ: 't3' },
);

middelTasks.push(
  { key: 'P2', name: '2. Foundations (shared)', taskType: 'CONSTRUCTION', codes: { House: 'GEN' } },
  { key: 'f1', name: 'Excavation, building pit', parent: 'P2', dur: 5, taskType: 'CONSTRUCTION',
    codes: { House: 'GEN' },
    completion: 1, actualStartDay: 9, actualFinishDay: 14 },
  { key: 'f2', name: 'Pour foundation beams', parent: 'P2', dur: 5, taskType: 'CONSTRUCTION',
    codes: { House: 'GEN' }, fields: { 'Cost estimate': 95000 },
    assign: [{ res: 'Concrete C20/25', units: 60, curve: 'FRONT_LOADED' }],
    completion: 1, actualStartDay: 14, actualFinishDay: 20 },
  { key: 'f3', name: 'Pour ground floor slab', parent: 'P2', dur: 4, taskType: 'CONSTRUCTION',
    codes: { House: 'GEN' },
    assign: [{ res: 'Concrete C20/25', units: 50, curve: 'FRONT_LOADED' }],
    completion: 1, actualStartDay: 23, actualFinishDay: 27 },
  { key: 'ms_fund', name: 'Foundation inspection', parent: 'P2', milestone: true, milestoneKind: 'FINISH',
    mandatory: true, codes: { House: 'GEN' },
    completion: 1, actualStartDay: 27, actualFinishDay: 27 },
);
middelLinks.push(
  { pred: 't3', succ: 'f1' }, { pred: 'f1', succ: 'f2' },
  { pred: 'f2', succ: 'f3', lag: 3, lagUnit: 'ELAPSEDTIME' },
  { pred: 'f3', succ: 'ms_fund' },
);

middelTasks.push({ key: 'P3', name: '3. Structural works per house', taskType: 'CONSTRUCTION', codes: { Discipline: 'STR' } });
const RUWBOUW_PROGRESS: Record<number, { mg?: [number, number]; vl?: [number, number] | number; mv?: [number, number]; kap?: [number, number] }> = {
  1: { mg: [27, 33], vl: [33, 37], mv: [37, 43], kap: [43, 48] },
  2: { mg: [34, 39], vl: [39, 43], mv: [43, 49], kap: [49, 54] },
  3: { mg: [40, 45], vl: [45, 49], mv: [49, 55], kap: [55, 58] },
  4: { mg: [46, 51], vl: 51 },
};
for (const i of HOUSES) {
  const prog = RUWBOUW_PROGRESS[i];
  const mgProg = prog?.mg ? { completion: 1 as const, actualStartDay: prog.mg[0], actualFinishDay: prog.mg[1] } : {};
  const vlProg = Array.isArray(prog?.vl)
    ? { completion: 1 as const, actualStartDay: prog.vl[0], actualFinishDay: prog.vl[1] }
    : (typeof prog?.vl === 'number' ? { completion: 0.5, actualStartDay: prog.vl } : {});
  const mvProg = prog?.mv ? { completion: 1 as const, actualStartDay: prog.mv[0], actualFinishDay: prog.mv[1] } : {};
  const kapProg = prog?.kap ? { completion: 1 as const, actualStartDay: prog.kap[0], actualFinishDay: prog.kap[1] } : {};
  middelTasks.push(
    { key: `r${i}_mg`, name: `Ground floor masonry — House ${i}`, parent: 'P3', dur: 6, taskType: 'CONSTRUCTION',
      codes: { House: String(i), Discipline: 'STR' },
      assign: [{ res: 'Masonry crew', units: 1 }, { res: 'Bricklayers', units: 2 }], ...mgProg },
    { key: `r${i}_vl`, name: `Upper floor slab — House ${i}`, parent: 'P3', dur: 4, taskType: 'CONSTRUCTION',
      codes: { House: String(i), Discipline: 'STR' },
      ...(i === 4
        ? { notes: [
            { text: 'Check rebar drawing with the structural engineer', done: false },
            { text: 'Formwork checked by the site manager', done: true },
          ] }
        : {}),
      ...vlProg },
    { key: `r${i}_mv`, name: `Upper floor masonry — House ${i}`, parent: 'P3', dur: 6, taskType: 'CONSTRUCTION',
      codes: { House: String(i), Discipline: 'STR' }, assign: [{ res: 'Bricklayers', units: 2 }], ...mvProg },
    { key: `r${i}_kap`, name: `Roof structure — House ${i}`, parent: 'P3', dur: 5, taskType: 'CONSTRUCTION',
      codes: { House: String(i), Discipline: 'STR' }, assign: [{ res: 'Carpenters', units: 2 }], ...kapProg },
  );
  middelLinks.push(
    { pred: `r${i}_mg`, succ: `r${i}_vl` }, { pred: `r${i}_vl`, succ: `r${i}_mv` }, { pred: `r${i}_mv`, succ: `r${i}_kap` },
  );
  if (i > 1) middelLinks.push({ pred: `r${i - 1}_mg`, succ: `r${i}_mg` });
}
middelTasks.push({ key: 'ms_hoog', name: 'Topping out reached', parent: 'P3', milestone: true, milestoneKind: 'FINISH', codes: { House: 'GEN', Discipline: 'STR' } });
middelLinks.push({ pred: 'ms_fund', succ: 'r1_mg' });
for (const i of HOUSES) middelLinks.push({ pred: `r${i}_kap`, succ: 'ms_hoog' });

middelTasks.push({ key: 'P4', name: '4. Building services', taskType: 'INSTALLATION', codes: { Discipline: 'MEP' } });
for (const i of HOUSES) {
  middelTasks.push(
    { key: `in${i}_lg`, name: `Plumbing — House ${i}`, parent: 'P4', dur: 3, taskType: 'INSTALLATION',
      codes: { House: String(i), Discipline: 'MEP' }, assign: [{ res: 'MEP fitters', units: 1 }],
      ...(i === 3 ? { notes: [{ text: 'Confirm pipework material delivery with the supplier', done: false }] } : {}) },
    { key: `in${i}_el`, name: `Electrical — House ${i}`, parent: 'P4', dur: 3, taskType: 'INSTALLATION',
      codes: { House: String(i), Discipline: 'MEP' }, assign: [{ res: 'MEP fitters', units: 1 }] },
    { key: `in${i}_ins`, name: `Services commissioning inspection — House ${i}`, parent: 'P4', dur: 1, taskType: 'ATTENDANCE',
      codes: { House: String(i), Discipline: 'MEP' } },
  );
  middelLinks.push(
    { pred: `r${i}_kap`, succ: `in${i}_lg` }, { pred: `in${i}_lg`, succ: `in${i}_el` },
    i === 1
      ? { pred: `in${i}_el`, succ: `in${i}_ins`, lag: -1 }
      : { pred: `in${i}_el`, succ: `in${i}_ins` },
  );
}

middelTasks.push({ key: 'P5', name: '5. Fit-out', taskType: 'CONSTRUCTION', codes: { Discipline: 'FIT' } });
const SCHIL_CURVE: Record<number, 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED'> = {
  1: 'BACK_LOADED', 2: 'FRONT_LOADED', 3: 'UNIFORM', 4: 'BACK_LOADED', 5: 'FRONT_LOADED', 6: 'UNIFORM',
};
for (const i of HOUSES) {
  middelTasks.push(
    { key: `af${i}_stuc`, name: `Plastering — House ${i}`, parent: 'P5', dur: 5, codes: { House: String(i), Discipline: 'FIT' },
      assign: [{ res: 'Plasterers', units: 2, curve: 'UNIFORM' }],
      ...(i === 2 ? { notes: [{ text: 'Moisture readings taken on walls', done: true }] } : {}) },
    { key: `af${i}_tegel`, name: `Tiling — House ${i}`, parent: 'P5', dur: 3, taskType: 'INSTALLATION',
      codes: { House: String(i), Discipline: 'FIT' } },
    { key: `af${i}_san`, name: `Install sanitary fittings — House ${i}`, parent: 'P5', dur: 3, taskType: 'INSTALLATION',
      codes: { House: String(i), Discipline: 'FIT' } },
    { key: `af${i}_schil`, name: `Painting — House ${i}`, parent: 'P5', dur: 4, codes: { House: String(i), Discipline: 'FIT' },
      assign: [{ res: 'Painters', units: 2, curve: SCHIL_CURVE[i] }] },
  );
  middelLinks.push(
    { pred: `in${i}_ins`, succ: `af${i}_stuc` }, { pred: `af${i}_stuc`, succ: `af${i}_tegel` },
    { pred: `af${i}_tegel`, succ: `af${i}_san` },
    i === 1
      ? { pred: `af${i}_san`, succ: `af${i}_schil`, type: 'START_START', lagPercent: 40 }
      : { pred: `af${i}_san`, succ: `af${i}_schil` },
  );
}
middelLinks.push({ pred: 'af1_stuc', succ: 'af2_stuc', type: 'START_START', lag: 0 });

middelTasks.push({ key: 'P6', name: '6. Handover', taskType: 'ATTENDANCE', codes: { House: 'GEN' } });
for (const i of HOUSES) {
  middelTasks.push({ key: `opl${i}`, name: `Handover inspection — House ${i}`, parent: 'P6', milestone: true,
    milestoneKind: 'FINISH', mandatory: true, codes: { House: String(i) } });
  middelLinks.push({ pred: `af${i}_schil`, succ: `opl${i}` }, { pred: `af${i}_san`, succ: `opl${i}` });
}
middelTasks.push({ key: 'ms_contract', name: 'Contractual project handover', parent: 'P6', milestone: true,
  milestoneKind: 'FINISH', mandatory: true, deadlineDay: 98,
  codes: { House: 'GEN' },
  description: 'Contractual completion date agreed with the client; the deadline deliberately falls before the earliest achievable date (negative total float).' });
for (const i of HOUSES) middelLinks.push({ pred: `opl${i}`, succ: 'ms_contract' });

const MIDDEL: ProjectSpec = {
  slug: 'showcase-rijwoningen-de-akkers',
  name: '6 New Terraced Houses, De Akkers',
  author: 'Site manager',
  company: 'Van der Meer Construction BV',
  category: 'showcase',
  description: 'New-build block of six identical terraced houses — repeating structure, resources and progress reporting.',
  publicDescription:
    'Mid-sized showcase: six terraced houses with a shared foundation (frost delay, added to the calendar after the contract baseline), ' +
    'a masonry crew (CREW+LABOR) moving from house to house — the same crew as in the small ' +
    'refurbishment showcase, so the occupancy overview shows a cross-project conflict on it — ' +
    'fit-out with curve variation (UNIFORM/FRONT_LOADED/BACK_LOADED) and a visible ' +
    'over-allocation on the plasterers, a mandatory handover inspection per house plus a deliberately ' +
    'tight contract deadline (negative total float), activity codes House x Discipline, notes ' +
    '(open and completed), progress plus a status date halfway through, and two baselines shown together in ' +
    'the Gantt: Contract before start and a Re-plan after the frost delay.',
  tags: ['residential', 'medium', 'resources', 'over-allocation', 'progress', 'baseline', 'activity-codes', 'notes'],
  codeTypes: [
    { name: 'House', values: [
      { code: '1', description: 'House 1' }, { code: '2', description: 'House 2' },
      { code: '3', description: 'House 3' }, { code: '4', description: 'House 4' },
      { code: '5', description: 'House 5' }, { code: '6', description: 'House 6' },
      { code: 'GEN', description: 'General / site', color: '#6b7280' },
    ] },
    { name: 'Discipline', values: [
      { code: 'STR', description: 'Structural works', color: '#b45309' },
      { code: 'MEP', description: 'Building services', color: '#0891b2' },
      { code: 'FIT', description: 'Fit-out', color: '#7c3aed' },
    ] },
  ],
  fields: [{ name: 'Cost estimate', type: 'cost' }],
  resources: [
    { name: 'Masonry crew', type: 'CREW', maxUnits: 1, description: 'Overarching masonry crew (moves from house to house)' },
    { name: 'Bricklayers', type: 'LABOR', maxUnits: 6, costPerHour: 46, parent: 'Masonry crew' },
    { name: 'Carpenters', type: 'LABOR', maxUnits: 2, costPerHour: 45 },
    { name: 'MEP fitters', type: 'LABOR', maxUnits: 4, costPerHour: 48 },
    { name: 'Plasterers', type: 'LABOR', maxUnits: 2, costPerHour: 42 },
    { name: 'Painters', type: 'LABOR', maxUnits: 8, costPerHour: 38 },
    { name: 'Concrete C20/25', type: 'MATERIAL', maxUnits: 999, unitOfMeasure: 'm³' },
  ],
  tasks: middelTasks,
  links: middelLinks,
  statusDay: 58,
  baselines: [
    { name: 'Contract' },
    {
      name: 'Re-plan after frost delay',
      mutationBefore: { addHolidays: [{ name: 'Frost delay, foundations', fromDay: 16, calendarDays: 6 }] },
    },
  ],
  activeBaselineName: 'Contract',
  comparedBaselineNames: ['Re-plan after frost delay'],
};

export const SHOWCASES: ProjectSpec[] = [KLEIN, MIDDEL];
