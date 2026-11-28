import type { ProjectSpec, TaskSpec, LinkSpec } from './spec';

export const ANCHOR_TASK_NAME = 'Site ready for main contractor paving';

export const TERREIN_ONDERAANNEMER: ProjectSpec = {
  slug: 'showcase-groot-terrein-onderaannemer',
  name: 'Site Works Subcontractor',
  author: 'Site works supervisor',
  company: 'GroundWorks South BV',
  category: 'external-source',
  description:
    'NON-PUBLIC source file for the external (cross-project) link in the LARGE showcase — ' +
    'another party delivers the site works/car park surroundings separately. Not a ' +
    'showcase, and deliberately not part of the Backstage list.',
  tasks: [
    { key: 'ms_start', name: 'Start of subcontractor site works', milestone: true, milestoneKind: 'START' },
    { key: 't1', name: 'Pave subcontractor site road', dur: 4, taskType: 'LOGISTIC' },
    { key: 't2', name: 'Install site cables & pipework', dur: 5, taskType: 'INSTALLATION' },
    { key: 't3', name: 'Site sewer connection', dur: 4, taskType: 'CONSTRUCTION' },
    { key: 't4', name: 'Ground improvement, car park', dur: 5, taskType: 'CONSTRUCTION' },
    { key: 't5', name: 'Lay car park sub-base', dur: 4, taskType: 'CONSTRUCTION' },
    { key: 't6', name: 'Install landscaping', dur: 3, taskType: 'CONSTRUCTION' },
    { key: 'ms_gereed', name: ANCHOR_TASK_NAME, milestone: true, milestoneKind: 'FINISH', mandatory: true },
  ],
  links: [
    { pred: 'ms_start', succ: 't1' }, { pred: 't1', succ: 't2' }, { pred: 't2', succ: 't3' },
    { pred: 't3', succ: 't4' }, { pred: 't4', succ: 't5' }, { pred: 't5', succ: 't6' },
    { pred: 't6', succ: 'ms_gereed' },
  ],
};

const TORENS = ['A', 'B', 'C'] as const;
type Toren = (typeof TORENS)[number];
const FLOORS = 12;

const STORT_UUR_BAND = { start: 420, end: 900 };
const STORT_KALENDER = {
  name: 'Hourly calendar, rebar fixing & pouring',
  description: 'Mon-Fri 07:00-15:00, hourly precision for reinforcement/concrete (phase 2.10, wave 2).',
  workTime: {
    byWeekday: {
      1: [STORT_UUR_BAND], 2: [STORT_UUR_BAND], 3: [STORT_UUR_BAND], 4: [STORT_UUR_BAND], 5: [STORT_UUR_BAND],
      6: [], 7: [],
    },
  },
};

export interface GrootExternalAnchor {
  anchorDate: string;
  sourceProjectId: string;
  sourceProjectName: string;
  sourceTaskId: string;
  sourceTaskName: string;
}

export function buildGrootSpec(ext: GrootExternalAnchor): ProjectSpec {
  const tasks: TaskSpec[] = [];
  const links: LinkSpec[] = [];

  tasks.push(
    { key: 'ms_start', name: 'Start of Apartment Complex project', milestone: true, milestoneKind: 'START' },
    { key: 'P1', name: '1. Preparation & site clearance', taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'v0', name: 'CPT soundings & soil investigation', parent: 'P1', dur: 3, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'v1', name: 'Obtain building permit', parent: 'P1', dur: 10, taskType: 'LOGISTIC',
      codes: { Tower: 'GEN', Discipline: 'CIV' }, fields: { 'Permit number': 'OV-2026-00417' } },
    { key: 'v2', name: 'Municipal road closure (permitted closure period)', parent: 'P1', dur: 3, taskType: 'ATTENDANCE',
      constraint: { type: 'MSO', offsetDay: 8, hard: true },
      description: 'Hard pin (P6 Mandatory Start): the permitted closure date is fixed by the municipality and overrides the network logic.',
      codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'v3', name: 'Construct site road', parent: 'P1', dur: 4, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'v4', name: 'Place site huts', parent: 'P1', dur: 2, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'v5', name: 'Install utility connections', parent: 'P1', dur: 4, taskType: 'LOGISTIC', priority: 1000,
      description: 'Pinned (priority 1000): fixed connection date from the utility company, must not move.',
      codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'v6', name: 'Install dewatering', parent: 'P1', dur: 5, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'ms_bouwrijp', name: 'Site ready for construction', parent: 'P1', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Tower: 'GEN', Discipline: 'CIV' } },
  );
  links.push(
    { pred: 'ms_start', succ: 'v0' }, { pred: 'ms_start', succ: 'v2' },
    { pred: 'v0', succ: 'v1' }, { pred: 'v1', succ: 'v3' }, { pred: 'v2', succ: 'v3' },
    { pred: 'v3', succ: 'v4' }, { pred: 'v4', succ: 'v5' }, { pred: 'v5', succ: 'v6' }, { pred: 'v6', succ: 'ms_bouwrijp' },
  );

  tasks.push(
    { key: 'P2', name: '2. Foundations & basement/car park', taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'f0', name: 'Commission dewatering', parent: 'P2', dur: 2, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'f1', name: 'Excavation, building pit', parent: 'P2', dur: 6, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'f2', name: 'Install sheet piling', parent: 'P2', dur: 5, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'f3', name: 'Pour foundation beams (shared)', parent: 'P2', dur: 4, taskType: 'CONSTRUCTION',
      codes: { Tower: 'GEN', Discipline: 'CIV' }, fields: { 'Cost estimate': 340000 },
      assign: [{ res: 'Concrete C30/37', units: 60, curve: 'FRONT_LOADED' }] },
  );
  links.push(
    { pred: 'ms_bouwrijp', succ: 'f0' }, { pred: 'f0', succ: 'f1' }, { pred: 'f1', succ: 'f2' }, { pred: 'f2', succ: 'f3' },
  );
  for (const tw of TORENS) {
    const grond = `f${tw}_grond`, vlkv = `f${tw}_vlkv`, stkv = `f${tw}_stkv`, vlkw = `f${tw}_vlkw`, stkw = `f${tw}_stkw`;
    tasks.push(
      { key: grond, name: `Basement earthworks — Tower ${tw}`, parent: 'P2', dur: 3, taskType: 'CONSTRUCTION',
        codes: { Tower: tw, Discipline: 'CIV' } },
      { key: vlkv, name: `Rebar fixing, basement floor — Tower ${tw}`, parent: 'P2', durMinutes: 480, calendarKey: 'stort',
        taskType: 'CONSTRUCTION', codes: { Tower: tw, Discipline: 'CIV' } },
      { key: stkv, name: `Pour basement floor — Tower ${tw}`, parent: 'P2', durMinutes: 360, calendarKey: 'stort',
        taskType: 'CONSTRUCTION', codes: { Tower: tw, Discipline: 'CIV' },
        assign: [{ res: 'Concrete C30/37', units: 30, curve: 'UNIFORM' }] },
      { key: vlkw, name: `Rebar fixing, basement walls — Tower ${tw}`, parent: 'P2', durMinutes: 480, calendarKey: 'stort',
        taskType: 'CONSTRUCTION', codes: { Tower: tw, Discipline: 'CIV' } },
      { key: stkw, name: `Pour basement walls — Tower ${tw}`, parent: 'P2', durMinutes: 240, calendarKey: 'stort',
        taskType: 'CONSTRUCTION', codes: { Tower: tw, Discipline: 'CIV' },
        assign: [{ res: 'Concrete C30/37', units: 25, curve: 'UNIFORM' }] },
    );
    links.push(
      { pred: 'f3', succ: grond }, { pred: grond, succ: vlkv }, { pred: vlkv, succ: stkv },
      { pred: stkv, succ: vlkw }, { pred: vlkw, succ: stkw },
    );
  }
  tasks.push(
    { key: 'f4', name: 'Basement sealing', parent: 'P2', dur: 3, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'f5', name: 'Backfill around basement', parent: 'P2', dur: 3, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'f7', name: 'Pour parking deck (ground floor cover)', parent: 'P2', dur: 5, taskType: 'CONSTRUCTION',
      codes: { Tower: 'GEN', Discipline: 'CIV' }, assign: [{ res: 'Concrete C30/37', units: 50, curve: 'FRONT_LOADED' }] },
    { key: 'f6', name: 'Remove sheet piling', parent: 'P2', dur: 2, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'ms_kelder', name: 'Basement watertight — inspection', parent: 'P2', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Tower: 'GEN', Discipline: 'CIV' } },
  );
  for (const tw of TORENS) links.push({ pred: `f${tw}_stkw`, succ: 'f4' });
  links.push(
    { pred: 'f4', succ: 'f5' }, { pred: 'f5', succ: 'f7' }, { pred: 'f7', succ: 'f6' }, { pred: 'f6', succ: 'ms_kelder' },
  );

  tasks.push(
    { key: 'P3', name: '3. Structural works, towers A/B/C (parallel)', taskType: 'CONSTRUCTION' },
    { key: 'kraan_op', name: 'Erect tower crane', parent: 'P3', dur: 3, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'STR' } },
  );
  links.push({ pred: 'ms_kelder', succ: 'kraan_op' });

  const torenFirstReal: Record<Toren, string> = { A: '', B: '', C: '' };
  const torenLastReal: Record<Toren, string> = { A: '', B: '', C: '' };
  const torenLastGevel: Record<Toren, string> = { A: '', B: '', C: '' };
  const torenLastInst: Record<Toren, string> = { A: '', B: '', C: '' };
  const torenLastAfbouw: Record<Toren, string> = { A: '', B: '', C: '' };
  const torenMsGereed: Record<Toren, string> = { A: '', B: '', C: '' };

  for (const tw of TORENS) {
    const pkey = `P3_${tw}`;
    tasks.push({ key: pkey, name: `Structural works — Tower ${tw}`, parent: 'P3', taskType: 'CONSTRUCTION', codes: { Tower: tw, Discipline: 'STR' } });
    const bgv = `t${tw}_bgv`;
    tasks.push({ key: bgv, name: `Pour ground floor slab — Tower ${tw}`, parent: pkey, dur: 4, taskType: 'CONSTRUCTION',
      codes: { Tower: tw, Discipline: 'STR' }, assign: [{ res: 'Concrete C30/37', units: 40, curve: 'FRONT_LOADED' }] });
    links.push({ pred: 'kraan_op', succ: bgv }, { pred: `f${tw}_stkw`, succ: bgv });
    torenFirstReal[tw] = bgv;

    let prev = bgv;
    for (let f = 1; f <= FLOORS; f++) {
      const w = `t${tw}_w${f}`, v = `t${tw}_v${f}`;
      tasks.push(
        { key: w, name: `Walls, floor ${f} — Tower ${tw}`, parent: pkey, dur: 4, taskType: 'CONSTRUCTION',
          codes: { Tower: tw, Discipline: 'STR' }, assign: [{ res: 'Steel fixers', units: 2 }, { res: 'Tower crane', units: 1 }] },
        { key: v, name: `Slab, floor ${f} — Tower ${tw}`, parent: pkey, dur: 3, taskType: 'CONSTRUCTION',
          codes: { Tower: tw, Discipline: 'STR' }, assign: [{ res: 'Carpenters', units: 2 }, { res: 'Tower crane', units: 1 }] },
      );
      links.push({ pred: prev, succ: w }, { pred: w, succ: v, type: 'START_START', lag: 2 });
      prev = v;
    }
    const dak = `t${tw}_dak`, trap = `t${tw}_trap`, msGereed = `t${tw}_ruwbouw_gereed`;
    tasks.push(
      { key: trap, name: `Stair core & lift shaft — Tower ${tw}`, parent: pkey, dur: FLOORS * 3, taskType: 'CONSTRUCTION',
        codes: { Tower: tw, Discipline: 'STR' }, assign: [{ res: 'Carpenters', units: 2 }] },
      { key: dak, name: `Install roof structure — Tower ${tw}`, parent: pkey, dur: 5, taskType: 'CONSTRUCTION',
        codes: { Tower: tw, Discipline: 'STR' }, assign: [{ res: 'Carpenters', units: 2 }, { res: 'Tower crane', units: 1 }] },
      { key: msGereed, name: `Structural works complete — Tower ${tw}`, parent: pkey, milestone: true, milestoneKind: 'FINISH',
        codes: { Tower: tw, Discipline: 'STR' } },
    );
    links.push(
      { pred: bgv, succ: trap, type: 'START_START' }, { pred: prev, succ: dak },
      { pred: trap, succ: msGereed }, { pred: dak, succ: msGereed },
    );
    torenLastReal[tw] = dak;
    torenMsGereed[tw] = msGereed;
  }
  tasks.push({ key: 'hammock_A', name: 'Structural works tower A (LOE)', parent: 'P3_A', hammock: true });
  links.push(
    { pred: torenFirstReal.A, succ: 'hammock_A', type: 'START_START' },
    { pred: torenLastReal.A, succ: 'hammock_A', type: 'FINISH_FINISH' },
  );
  tasks.push({ key: 'kraan_af', name: 'Dismantle tower crane', parent: 'P3', dur: 2, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'STR' } });
  for (const tw of TORENS) links.push({ pred: torenMsGereed[tw], succ: 'kraan_af' });

  tasks.push({ key: 'P4', name: '4. Facade & roof', taskType: 'CONSTRUCTION' });
  for (const tw of TORENS) {
    const pkey = `P4_${tw}`;
    tasks.push({ key: pkey, name: `Facade & roof — Tower ${tw}`, parent: 'P4', codes: { Tower: tw, Discipline: 'STR' } });
    const steig = `t${tw}_steiger_op`, gevIso = `t${tw}_gevIso`, gevBekl = `t${tw}_gevBekl`, kozijn = `t${tw}_kozijn`,
      dakIso = `t${tw}_dakIso`, dakBed = `t${tw}_dakBed`, balkon = `t${tw}_balkon`, regen = `t${tw}_regen`,
      steigAf = `t${tw}_steiger_af`;
    tasks.push(
      { key: steig, name: `Erect scaffolding — Tower ${tw}`, parent: pkey, dur: 3, taskType: 'LOGISTIC', codes: { Tower: tw, Discipline: 'STR' } },
      { key: gevIso, name: `Apply facade insulation — Tower ${tw}`, parent: pkey, dur: 8, taskType: 'INSTALLATION',
        codes: { Tower: tw, Discipline: 'STR' }, assign: [{ res: 'Facade contractor', units: 2 }] },
      { key: gevBekl, name: `Install facade cladding — Tower ${tw}`, parent: pkey, dur: 10, taskType: 'INSTALLATION',
        codes: { Tower: tw, Discipline: 'STR' }, assign: [{ res: 'Facade contractor', units: 2 }] },
      { key: kozijn, name: `Install window frames — Tower ${tw}`, parent: pkey, dur: 6, taskType: 'INSTALLATION', codes: { Tower: tw, Discipline: 'STR' } },
      { key: dakIso, name: `Apply roof insulation — Tower ${tw}`, parent: pkey, dur: 5, taskType: 'INSTALLATION', codes: { Tower: tw, Discipline: 'STR' } },
      { key: dakBed, name: `Apply roofing — Tower ${tw}`, parent: pkey, dur: 5, taskType: 'CONSTRUCTION', codes: { Tower: tw, Discipline: 'STR' } },
      { key: balkon, name: `Install balcony balustrades — Tower ${tw}`, parent: pkey, dur: 5, codes: { Tower: tw, Discipline: 'STR' } },
      { key: regen, name: `Connect rainwater drainage — Tower ${tw}`, parent: pkey, dur: 3, taskType: 'INSTALLATION', codes: { Tower: tw, Discipline: 'STR' } },
      { key: steigAf, name: `Strike scaffolding — Tower ${tw}`, parent: pkey, dur: 2, taskType: 'LOGISTIC', codes: { Tower: tw, Discipline: 'STR' } },
    );
    links.push(
      { pred: torenLastReal[tw], succ: steig }, { pred: steig, succ: gevIso }, { pred: gevIso, succ: gevBekl },
      { pred: gevBekl, succ: kozijn }, { pred: torenLastReal[tw], succ: dakIso }, { pred: dakIso, succ: dakBed },
      { pred: dakBed, succ: regen }, { pred: kozijn, succ: balkon }, { pred: balkon, succ: steigAf }, { pred: regen, succ: steigAf },
    );
    torenLastGevel[tw] = steigAf;
  }
  tasks.push(
    { key: 'entree_gevel', name: 'Facade cladding, main entrance', parent: 'P4', dur: 4, codes: { Tower: 'GEN', Discipline: 'STR' } },
    { key: 'parkeer_overkap', name: 'Install parking deck canopy', parent: 'P4', dur: 5, codes: { Tower: 'GEN', Discipline: 'STR' } },
  );
  links.push({ pred: torenLastGevel.A, succ: 'entree_gevel' }, { pred: 'f7', succ: 'parkeer_overkap' });

  tasks.push(
    { key: 'P5', name: '5. Building services (MEP)', taskType: 'INSTALLATION' },
    { key: 'techniek_warmte', name: 'Install heating plant room', parent: 'P5', dur: 6, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'techniek_elek', name: 'Connect main electrical distribution board', parent: 'P5', dur: 4, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'techniek_nood', name: 'Install & test emergency generator', parent: 'P5', dur: 3, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'techniek_data', name: 'Fit out data centre server room', parent: 'P5', dur: 4, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
  );
  links.push(
    { pred: 'entree_gevel', succ: 'techniek_warmte' }, { pred: 'techniek_warmte', succ: 'techniek_elek' },
    { pred: 'techniek_elek', succ: 'techniek_nood' }, { pred: 'techniek_nood', succ: 'techniek_data' },
  );
  for (const tw of TORENS) {
    const pkey = `P5_${tw}`;
    tasks.push({ key: pkey, name: `Building services — Tower ${tw}`, parent: 'P5', codes: { Tower: tw, Discipline: 'MEP' } });
    const w = `t${tw}_wtb`, el = `t${tw}_elek`, vent = `t${tw}_vent`, sprink = `t${tw}_sprink`, data = `t${tw}_data`,
      brand = `t${tw}_brand`, lift = `t${tw}_lift`, keur = `t${tw}_keurinst`;
    tasks.push(
      { key: w, name: `Mechanical services — Tower ${tw}`, parent: pkey, dur: 8, taskType: 'INSTALLATION',
        codes: { Tower: tw, Discipline: 'MEP' }, assign: [{ res: 'MEP fitters', units: 3 }] },
      { key: el, name: `Install electrical services — Tower ${tw}`, parent: pkey, dur: 7, taskType: 'INSTALLATION',
        codes: { Tower: tw, Discipline: 'MEP' }, assign: [{ res: 'MEP fitters', units: 3 }] },
      { key: vent, name: `Connect ventilation ductwork — Tower ${tw}`, parent: pkey, dur: 5, taskType: 'INSTALLATION', codes: { Tower: tw, Discipline: 'MEP' } },
      { key: sprink, name: `Install sprinkler system — Tower ${tw}`, parent: pkey, dur: 5, taskType: 'INSTALLATION', codes: { Tower: tw, Discipline: 'MEP' } },
      { key: data, name: `Install data/ICT cabling — Tower ${tw}`, parent: pkey, dur: 4, taskType: 'INSTALLATION', codes: { Tower: tw, Discipline: 'MEP' } },
      { key: brand, name: `Install fire alarm system — Tower ${tw}`, parent: pkey, dur: 4, taskType: 'INSTALLATION', codes: { Tower: tw, Discipline: 'MEP' } },
      {
        key: lift, name: `Lift supply & installation — Tower ${tw}`, parent: pkey, dur: 10, taskType: 'INSTALLATION',
        codes: { Tower: tw, Discipline: 'MEP' }, assign: [{ res: 'Lift supplier', units: 1 }],
        fields: { 'Critical delivery': true },
        ...(tw === 'A' ? { constraint2: { type: 'SNLT', offsetDay: 300 } } : {}),
      },
      { key: keur, name: `Services commissioning inspection — Tower ${tw}`, parent: pkey, milestone: true, milestoneKind: 'FINISH', mandatory: true,
        codes: { Tower: tw, Discipline: 'MEP' } },
    );
    links.push(
      { pred: torenLastGevel[tw], succ: w }, { pred: w, succ: el, type: 'START_START', lag: 2 }, { pred: el, succ: vent },
      { pred: vent, succ: sprink }, { pred: sprink, succ: data }, { pred: data, succ: brand }, { pred: brand, succ: lift },
      { pred: lift, succ: keur },
    );
    torenLastInst[tw] = keur;
  }

  tasks.push({ key: 'P6', name: '6. Fit-out', taskType: 'CONSTRUCTION' });
  for (const tw of TORENS) {
    const pkey = `P6_${tw}`;
    tasks.push({ key: pkey, name: `Fit-out — Tower ${tw}`, parent: 'P6', codes: { Tower: tw, Discipline: 'FIT' } });
    const stuc = `t${tw}_stuc`, tegel = `t${tw}_tegel`, keuken = `t${tw}_keuken`, sanit = `t${tw}_sanit`,
      schil = `t${tw}_schil`, vloer = `t${tw}_vloer`, plafond = `t${tw}_plafond`, deuren = `t${tw}_deuren`;
    tasks.push(
      { key: stuc, name: `Plastering — Tower ${tw}`, parent: pkey, dur: 12, codes: { Tower: tw, Discipline: 'FIT' },
        assign: [{ res: 'Plasterers', units: 3, curve: 'UNIFORM' }],
        ...(tw === 'B' ? { notes: [{ text: 'Moisture readings taken on walls', done: true }] } : {}) },
      { key: tegel, name: `Tiling — Tower ${tw}`, parent: pkey, dur: 10, codes: { Tower: tw, Discipline: 'FIT' },
        assign: [{ res: 'Tilers', units: 3, curve: 'FRONT_LOADED' }] },
      { key: keuken, name: `Install kitchens — Tower ${tw}`, parent: pkey, dur: 8, codes: { Tower: tw, Discipline: 'FIT' },
        assign: [{ res: 'Kitchen fitters', units: 2, curve: 'BACK_LOADED' }],
        ...(tw === 'A' ? { notes: [{ text: 'Check kitchen appliance delivery with the supplier', done: false }] } : {}) },
      { key: sanit, name: `Install sanitary fittings — Tower ${tw}`, parent: pkey, dur: 7, taskType: 'INSTALLATION',
        codes: { Tower: tw, Discipline: 'FIT' }, assign: [{ res: 'MEP fitters', units: 3, curve: 'BELL' }] },
      { key: schil, name: `Painting — Tower ${tw}`, parent: pkey, dur: 8, codes: { Tower: tw, Discipline: 'FIT' },
        assign: [{ res: 'Painters', units: 3, curve: 'EARLY_PEAK' }] },
      { key: vloer, name: `Floor finishes — Tower ${tw}`, parent: pkey, dur: 5, codes: { Tower: tw, Discipline: 'FIT' },
        assign: [{ res: 'Tilers', units: 2, curve: 'LATE_PEAK' }] },
      { key: plafond, name: `Finish ceilings — Tower ${tw}`, parent: pkey, dur: 5, codes: { Tower: tw, Discipline: 'FIT' } },
      { key: deuren, name: `Doors and ironmongery — Tower ${tw}`, parent: pkey, dur: 4, codes: { Tower: tw, Discipline: 'FIT' } },
    );
    links.push(
      { pred: torenLastInst[tw], succ: stuc }, { pred: stuc, succ: tegel }, { pred: tegel, succ: keuken },
      { pred: keuken, succ: sanit }, { pred: sanit, succ: schil }, { pred: schil, succ: vloer },
      { pred: vloer, succ: plafond }, { pred: plafond, succ: deuren },
    );
    torenLastAfbouw[tw] = deuren;
  }
  tasks.push(
    { key: 'entreehal_afb', name: 'Finish entrance hall', parent: 'P6', dur: 6, codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'fietsenst_afb', name: 'Finish bicycle store', parent: 'P6', dur: 4, codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'liftlobby_afb', name: 'Finish lift lobbies', parent: 'P6', dur: 4, codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'trappenhuis_afb', name: 'Finish communal stair cores', parent: 'P6', dur: 5, codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'buitenschil', name: 'External painting, facade plinth', parent: 'P6', dur: 4, codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'signage', name: 'Install signage & wayfinding', parent: 'P6', dur: 2, codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'eindschoon_gem', name: 'Final cleaning of communal areas', parent: 'P6', dur: 3, codes: { Tower: 'GEN', Discipline: 'FIT' } },
  );
  links.push(
    { pred: 'entree_gevel', succ: 'entreehal_afb' },
    { pred: 'entreehal_afb', succ: 'fietsenst_afb' }, { pred: 'entreehal_afb', succ: 'liftlobby_afb' },
    { pred: 'liftlobby_afb', succ: 'trappenhuis_afb' }, { pred: 'trappenhuis_afb', succ: 'buitenschil' },
    { pred: 'buitenschil', succ: 'signage' }, { pred: 'signage', succ: 'eindschoon_gem' },
  );

  tasks.push(
    { key: 'P7', name: '7. Car park & site works', taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'gar_wanden', name: 'Internal walls, storage units & stair cores, car park', parent: 'P7', dur: 29, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'gar_leiding', name: 'Pipework & cable trays, car park', parent: 'P7', dur: 24, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'gar_vent', name: 'Ventilation & smoke extraction system, car park', parent: 'P7', dur: 22, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'gar_sprink', name: 'Sprinkler & dry riser, car park', parent: 'P7', dur: 16, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'gar_elek', name: 'Power, lighting & emergency lighting, car park', parent: 'P7', dur: 16, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'gar_brand', name: 'Fire alarm & evacuation system, car park', parent: 'P7', dur: 10, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'gar_ev', name: 'EV charging infrastructure', parent: 'P7', dur: 10, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'gar_coating', name: 'Floor coating & line marking, car park', parent: 'P7', dur: 14, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'gar_toegang', name: 'Access control, barriers & parking management system', parent: 'P7', dur: 10, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'gar_inregel', name: 'Commission & test car park services', parent: 'P7', dur: 12, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'MEP' } },
    { key: 'ms_garage', name: 'Car park safety inspection', parent: 'P7', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Tower: 'GEN', Discipline: 'MEP' },
      description: 'Closes out the car park fit-out stream — the second critical chain in this project, independent of the towers.' },
    { key: 'ontsl1', name: 'Construct new main access road', parent: 'P7', dur: 4, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'ontsl2', name: 'New main access road in use', parent: 'P7', milestone: true, milestoneKind: 'START', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'bouwweg_op', name: 'Break up temporary site road', parent: 'P7', dur: 3, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'riool_terrein', name: 'Site sewer connection, main building', parent: 'P7', dur: 4, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    {
      key: 'bestrating', name: 'Car park paving', parent: 'P7', dur: 6, taskType: 'CONSTRUCTION',
      codes: { Tower: 'GEN', Discipline: 'CIV' },
      externalLink: {
        direction: 'predecessor', relType: 'FS', lagDays: 0,
        anchorDate: ext.anchorDate,
        sourceRef: {
          projectId: ext.sourceProjectId, projectName: ext.sourceProjectName,
          taskId: ext.sourceTaskId, taskName: ext.sourceTaskName,
          filePath: 'examples/showcase-groot-terrein-onderaannemer.ifc',
        },
        sourceMissing: true,
      },
    },
    { key: 'fietsenst_buiten', name: 'Install outdoor bicycle shelter', parent: 'P7', dur: 3, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'groen_terrein', name: 'Install landscaping, main site', parent: 'P7', dur: 5, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'buitenverl', name: 'Install external lighting', parent: 'P7', dur: 3, taskType: 'INSTALLATION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'erfafsch', name: 'Install boundary fencing', parent: 'P7', dur: 2, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'parkvak', name: 'Mark out parking bays', parent: 'P7', dur: 1, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'ms_terrein', name: 'Site handover — final inspection', parent: 'P7', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Tower: 'GEN', Discipline: 'CIV' } },
  );
  links.push(
    { pred: 'parkeer_overkap', succ: 'gar_wanden' }, { pred: 'gar_wanden', succ: 'gar_leiding' },
    { pred: 'gar_leiding', succ: 'gar_vent' }, { pred: 'gar_vent', succ: 'gar_sprink' },
    { pred: 'gar_sprink', succ: 'gar_elek' }, { pred: 'gar_elek', succ: 'gar_brand' },
    { pred: 'gar_brand', succ: 'gar_ev' }, { pred: 'gar_ev', succ: 'gar_coating' },
    { pred: 'gar_coating', succ: 'gar_toegang' }, { pred: 'gar_toegang', succ: 'gar_inregel' },
    { pred: 'gar_inregel', succ: 'ms_garage' },
    { pred: 'ms_garage', succ: 'ontsl1' }, { pred: 'ontsl1', succ: 'ontsl2' },
    { pred: 'ontsl2', succ: 'bouwweg_op', type: 'START_FINISH' },
    { pred: 'ontsl2', succ: 'riool_terrein' }, { pred: 'riool_terrein', succ: 'bestrating' },
    { pred: 'bestrating', succ: 'fietsenst_buiten' }, { pred: 'bestrating', succ: 'groen_terrein' },
    { pred: 'groen_terrein', succ: 'buitenverl' }, { pred: 'buitenverl', succ: 'erfafsch' },
    { pred: 'erfafsch', succ: 'parkvak' }, { pred: 'parkvak', succ: 'ms_terrein' }, { pred: 'bouwweg_op', succ: 'ms_terrein' },
    { pred: 'fietsenst_buiten', succ: 'ms_terrein' },
  );

  tasks.push({ key: 'P8', name: '8. Handover', taskType: 'ATTENDANCE', codes: { Tower: 'GEN', Discipline: 'FIT' } });
  for (const tw of TORENS) {
    const opl = `opl_${tw}`;
    tasks.push({ key: opl, name: `Handover inspection — Tower ${tw}`, parent: 'P8', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Tower: tw, Discipline: 'FIT' },
      description: `Contractual handover of Tower ${tw} to the owners' association/residents — an independent end point (no shared final milestone with the other towers).` });
    links.push({ pred: torenLastAfbouw[tw], succ: opl }, { pred: 'ms_terrein', succ: opl });
  }
  tasks.push(
    { key: 'documentatie', name: 'Documentation handover (as-built drawings)', parent: 'P8', dur: 3, taskType: 'ATTENDANCE', codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'sleutels', name: 'Key handover to the building manager', parent: 'P8', dur: 2, taskType: 'ATTENDANCE', codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'eindschoon_geb', name: 'Final cleaning of communal areas, building', parent: 'P8', dur: 3, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'ms_hoofddeadline', name: 'Project administration & contractual close-out', parent: 'P8', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      deadlineDay: 560, codes: { Tower: 'GEN', Discipline: 'FIT' },
      description: 'Contractual/administrative close-out (as-built dossier, handover to the building manager) — runs in parallel from site handover onwards, not gated by the towers (see phase notes).' },
    { key: 'ms_nazorg', name: 'Aftercare period started', parent: 'P8', milestone: true, milestoneKind: 'START', codes: { Tower: 'GEN', Discipline: 'FIT' } },
    { key: 'onderhoud', name: 'Start maintenance contract for building services', parent: 'P8', dur: 1, taskType: 'ATTENDANCE', codes: { Tower: 'GEN', Discipline: 'FIT' } },
  );
  links.push(
    { pred: 'ms_terrein', succ: 'documentatie' },
    { pred: 'documentatie', succ: 'eindschoon_geb' }, { pred: 'eindschoon_geb', succ: 'sleutels' },
    { pred: 'sleutels', succ: 'ms_hoofddeadline' }, { pred: 'ms_hoofddeadline', succ: 'ms_nazorg' }, { pred: 'ms_nazorg', succ: 'onderhoud' },
  );

  const PROGRESS_KEYS = [
    'ms_start',
    'v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'ms_bouwrijp',
    'f0', 'f1', 'f2', 'f3',
    'fA_grond', 'fB_grond', 'fC_grond',
    'fA_vlkv', 'fB_vlkv', 'fC_vlkv', 'fA_stkv', 'fB_stkv', 'fC_stkv',
    'fA_vlkw', 'fB_vlkw', 'fC_vlkw', 'fA_stkw', 'fB_stkw', 'fC_stkw',
    'f4', 'f5', 'f7', 'f6', 'ms_kelder', 'kraan_op',
  ];
  for (const key of PROGRESS_KEYS) {
    const idx = tasks.findIndex(t => t.key === key);
    if (idx >= 0) tasks[idx] = { ...tasks[idx], completion: 1, actualsFromPlan: true };
  }

  const baselines: NonNullable<ProjectSpec['baselines']> = [
    { name: 'Contract' },
    {
      name: 'Re-baseline (variation order)',
      mutationBefore: {
        addTasks: [
          { key: 'meerwerk_berging', name: 'Variation: additional basement storage units', parent: 'P2', dur: 6, taskType: 'CONSTRUCTION',
            codes: { Tower: 'GEN', Discipline: 'CIV' }, description: 'Variation order issued after the contract baseline: additional storage units in the basement.' },
        ],
        addLinks: [
          { pred: 'ms_kelder', succ: 'meerwerk_berging' }, { pred: 'meerwerk_berging', succ: 'kraan_af' },
        ],
        extendDurations: [{ key: 'tA_stuc', dur: 15 }, { key: 'tB_stuc', dur: 15 }],
      },
    },
  ];

  return {
    slug: 'showcase-appartementencomplex',
    name: 'De Vaart Apartment Complex',
    author: 'Project director',
    company: 'Randstad Construction Group BV',
    category: 'showcase',
    description:
      'Apartment complex of three towers on one plot, with the car park/site works delivered by a ' +
      'subcontractor — the "kitchen sink" showcase that carries every advanced feature.',
    publicDescription:
      'LARGE: apartment complex with three parallel towers (~250 tasks) — hard-pin MSO, ' +
      'secondary constraint, hammock (LOE), near-critical marking plus multiple critical paths ' +
      '(floatPaths), hourly scheduling for rebar fixing/pouring, all five resource types including a tower crane ' +
      '(EQUIPMENT) with a capacity step, all four relationship types (including START_FINISH), all six ' +
      'assignment curves, an external link to a separately delivered site file, two ' +
      'baselines shown together in the Gantt (Contract, and a Re-baseline after a variation order) and ' +
      'progress plus a status date.',
    tags: ['residential', 'large', 'advanced', 'kitchen-sink', 'near-critical', 'float-paths', 'hammock', 'hourly-scheduling', 'external-link', 'baseline'],
    calendar: { workDays: [1, 2, 3, 4, 5], name: 'Construction calendar NL (LARGE)' },
    calendars: { stort: STORT_KALENDER },
    codeTypes: [
      { name: 'Tower', values: [
        { code: 'A', description: 'Tower A' }, { code: 'B', description: 'Tower B' }, { code: 'C', description: 'Tower C' },
        { code: 'GEN', description: 'General / shared', color: '#6b7280' },
      ] },
      { name: 'Discipline', values: [
        { code: 'CIV', description: 'Civil works', color: '#78350f' },
        { code: 'STR', description: 'Structural works', color: '#b45309' },
        { code: 'MEP', description: 'Building services', color: '#0891b2' },
        { code: 'FIT', description: 'Fit-out', color: '#7c3aed' },
      ] },
    ],
    fields: [
      { name: 'Cost estimate', type: 'cost' },
      { name: 'Permit number', type: 'text' },
      { name: 'Critical delivery', type: 'boolean' },
    ],
    resources: [
      { name: 'Structural works crew', type: 'CREW', maxUnits: 1, description: 'Overarching structural works crew' },
      { name: 'Steel fixers', type: 'LABOR', maxUnits: 6, costPerHour: 44, parent: 'Structural works crew' },
      { name: 'Carpenters', type: 'LABOR', maxUnits: 12, costPerHour: 45 },
      { name: 'Tower crane', type: 'EQUIPMENT', maxUnits: 1, costPerHour: 120, description: 'One tower crane; a second crane is added later',
        steps: [{ fromDay: 130, maxUnits: 2 }] },
      { name: 'Concrete C30/37', type: 'MATERIAL', maxUnits: 999, unitOfMeasure: 'm³' },
      { name: 'Facade contractor', type: 'SUBCONTRACTOR', maxUnits: 6, costPerHour: 60 },
      { name: 'Lift supplier', type: 'SUBCONTRACTOR', maxUnits: 3, costPerHour: 90 },
      { name: 'Plasterers', type: 'LABOR', maxUnits: 3, costPerHour: 42, description: 'One plastering crew for three towers — deliberately tight (bottleneck 2 of 2)' },
      { name: 'Tilers', type: 'LABOR', maxUnits: 15, costPerHour: 43 },
      { name: 'Kitchen fitters', type: 'LABOR', maxUnits: 9, costPerHour: 46 },
      { name: 'MEP fitters', type: 'LABOR', maxUnits: 18, costPerHour: 48 },
      { name: 'Painters', type: 'LABOR', maxUnits: 15, costPerHour: 38 },
    ],
    schedulingOptions: {
      nearCriticalThreshold: 3,
      floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 8 },
    },
    tasks,
    links,
    baselines,
    activeBaselineName: 'Contract',
    comparedBaselineNames: ['Re-baseline (variation order)'],
    statusFromPlanFinish: 'kraan_op',
  };
}
