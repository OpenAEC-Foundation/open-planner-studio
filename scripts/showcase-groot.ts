// GROOT — "Appartementencomplex" (~250 taken), fase 2.10 onderdeel 4, golf 2.
// De "kitchen sink"-showcase: draagt ALLE 27 functies uit de dekkingsmatrix (zie
// docs/superpowers/specs/2026-07-07-2.10-onderdeel4-showcases-design.md §3.3), inclusief de 8
// die golf 1 (KLEIN+MIDDEL) bewust niet droeg: hard pin, secundaire constraint, hammock,
// near-critical + float paths, uren-planning, externe koppeling, rebaseline, en de resttypen
// resources/curves/relaties (EQUIPMENT/SUBCONTRACTOR, START_FINISH, alle 6 curves).
//
// Bouwt daarnaast het NIET-PUBLIC bronbestand voor de externe koppeling ("Terreininrichting
// Onderaannemer") — `gen-core.ts:buildGrootWithExternalSource()` bouwt dit bestand EERST, leest
// het terug via de echte `readIFC` (exact het `ExternalLinkDialog`-patroon: bron read-only
// parsen, anker bevriezen) en roept dan `buildGrootSpec()` hieronder aan met het bevroren anker.
//
// ── Ontwerp: meerdere kritieke paden (§3.3, herzien) ────────────────────────────────────────
// De FREE_FLOAT-peel noemt een gepeelde keten pas kritiek als ÉLKE taak erin kritiek is — óók de
// gedeelde voorgangers waar de driving-trace doorheen loopt. Voltooide taken zijn P6-conform
// nooit kritiek (`scheduleAnalysis.ts`, `completed ⇒ isCritical false`). Torens A en B zijn wel
// exact getide, maar hun beide ketens tracen terug via `kraan_op` het VOLTOOIDE voorstuk in, dus
// geen van beide levert een volledig kritieke peel op. Dat is geen fout in de solver: met correcte
// voortgangsdata (fase 1+2 conform plan) is dat de juiste uitkomst.
//
// Een tweede kritiek pad vergt daarom een keten die de driving-trace NIET in het voltooide
// voorstuk voert — dus een keten met een eigen wortel ná de statusdatum. Die wortel bestaat zodra
// alle voorgangers van een taak vóór de statusdatum klaar waren: de taak wordt dan door de
// data-date-vloer bepaald in plaats van door een relatie, en géén inkomende relatie is driving.
// Fase 7 heeft precies zo'n wortel: `parkeer_overkap` hangt alleen aan het (voltooide) parkeerdek
// `f7`. Die fase is daarom uitgebouwd tot een volwaardige, van de torens ONAFHANKELIJKE tweede
// bouwstroom — garage-afbouw gevolgd door de terreininrichting en de administratieve afronding —
// die exact op de laatste toren-oplevering uitkomt en dus 0 speling heeft. Resultaat:
// `criticalPaths[0]` = de (torens-)kritieke set, `criticalPaths[1]` = de garage/terrein-keten.
//
// Torens A en B zijn qua taken/duren VOLLEDIG symmetrisch (ze eindigen exact tegelijk, allebei
// tf 0 en kritiek); toren C is identiek t/m de afbouw-fase, maar krijgt daar één
// kortere taak (`Vloerafwerking — Toren C`, 3 werkdagen korter) — dat plaatst toren C's hele keten
// op precies 3 werkdagen positieve speling, binnen de `nearCriticalThreshold` (3), dus zichtbaar
// near-critical i.p.v. kritiek.
//
// ── Overallocatie: bewust PRECIES TWEE knelpunten ───────────────────────────────────────────
// De torenkraan (EQUIPMENT, maxUnits 1 t/m een `availabilitySteps`-capaciteitsstap) wordt door
// alle drie torens tegelijk bevraagd ⇒ zichtbare overallocatie (geen van de bevraagde taken heeft
// prioriteit 1000). Daarnaast blijft één stukadoorsploeg (LABOR, 3 man) bewust krap voor drie
// torens afbouw. Alle ÓVERIGE pools zijn expliciet op drie parallelle torens gedimensioneerd en
// horen schoon te blijven — zie de toelichting bij `resources` onderaan dit bestand; de poort
// `verify-examples.ts` bewaakt zowel de ondergrens (≥1, de bedoelde les) als de bovengrens (≤2).
import type { ProjectSpec, TaskSpec, LinkSpec } from './spec';

// ── Extern bronbestand — "Terreininrichting Onderaannemer" (NIET-PUBLIC, §4.2) ─────────────
// Kleine, op zichzelf staande planning van een andere partij (parkeergarage-/terreinaannemer).
// category:'external-source' ⇒ NOOIT in de PUBLIC-set (generate-examples.ts leidt PUBLIC af uit
// category==='showcase'), maar WEL meegecommit in examples/ zodat sourceRef.filePath iets zinnigs
// oplevert. `sourceMissing:true` in de GROOT-koppeling is BEWUST (architect-besluit 4): het
// bronbestand reist niet mee in de gepubliceerde (Backstage-)selectie, dus een gebruiker die GROOT
// via de app opent kan het echt niet verversen — precies het "bron ontbreekt"-pad demonstrerend.
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

// ── GROOT — "Appartementencomplex" ──────────────────────────────────────────────────────────
const TORENS = ['A', 'B', 'C'] as const;
type Toren = (typeof TORENS)[number];
const FLOORS = 12;

// Uur-kalender (fase 2.10, golf 2, uren-planning): ma-vr 07:00-15:00 (8 netto uren/dag, geen
// pauzeband gemodelleerd — voldoende voor de sub-dag-precisie-demonstratie). 420=07:00, 900=15:00.
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

  // ── Fase 1 — Voorbereiding & bouwrijp maken (~10 taken) ───────────────────────────────────
  tasks.push(
    { key: 'ms_start', name: 'Start of Apartment Complex project', milestone: true, milestoneKind: 'START' },
    { key: 'P1', name: '1. Preparation & site clearance', taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'v0', name: 'CPT soundings & soil investigation', parent: 'P1', dur: 3, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'v1', name: 'Obtain building permit', parent: 'P1', dur: 10, taskType: 'LOGISTIC',
      codes: { Tower: 'GEN', Discipline: 'CIV' }, fields: { 'Permit number': 'OV-2026-00417' } },
    // Hard pin (fase 2.9/2.10): P6 Mandatory Start — de gemeente staat de wegafzetting alleen op
    // exact deze vergunde datum toe; de logica buigt ervoor (constraint.hard = true).
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

  // ── Fase 2 — Fundering & kelder/parkeergarage (~25 taken, uren-planning) ──────────────────
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
      // Vlechtwerk/stort op de uur-kalender (`calendarKey`); de stort-taken zijn sub-dag
      // (6u/4u < 8u netto/dag) — zichtbaar aan een balk die niet op een hele dag valt.
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

  // ── Fase 3 — Ruwbouw torens A/B/C parallel (~90 taken) ────────────────────────────────────
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
  // Hammock (fase 2.9/2.10): span AFGELEID uit gewone links naar deze taak — start-driver =
  // begane grondvloer toren A (SS), finish-driver = dakconstructie toren A (FF). Puur topologisch,
  // geen apart driver-veld nodig (zie CPMSolver.ts hammockEarlyStart/hammockEarlyFinish).
  tasks.push({ key: 'hammock_A', name: 'Structural works tower A (LOE)', parent: 'P3_A', hammock: true });
  links.push(
    { pred: torenFirstReal.A, succ: 'hammock_A', type: 'START_START' },
    { pred: torenLastReal.A, succ: 'hammock_A', type: 'FINISH_FINISH' },
  );
  tasks.push({ key: 'kraan_af', name: 'Dismantle tower crane', parent: 'P3', dur: 2, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'STR' } });
  for (const tw of TORENS) links.push({ pred: torenMsGereed[tw], succ: 'kraan_af' });

  // ── Fase 4 — Gevel & dak (~30 taken, near-critical zichtbaar) ─────────────────────────────
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

  // ── Fase 5 — Installaties (MEP) (~35 taken, secundaire constraint) ────────────────────────
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
        // Secundaire constraint (fase 2.9/2.10, `constraint2`, altijd soft): primair ASAP
        // (afwezig), secundair een praktische bovengrens (SNLT) op de leverdatum.
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

  // ── Fase 6 — Afbouw (~35 taken, alle 6 toewijzingscurves) ─────────────────────────────────
  // Torens A/B/C zijn hier bewust nog volledig symmetrisch (identieke duren) — de asymmetrie die
  // toren C near-critical maakt (§3.3) komt pas uit de rebaseline-mutatie hieronder (meerwerk op
  // A+B verlengt precies díe twee torens, C blijft ongewijzigd ⇒ 3 werkdagen kortere, near-
  // critical keten), niet uit een vooraf ingebakken duurverschil.
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
  // Ontwerpkeuze (§3.3, zelfde reden als fase 8 hierboven): NIET gegateed door alle 3 torens
  // tegelijk (dat zou — net als bij de oplevering — twee getide torens weer laten samensmelten
  // tot 1 kritieke keten in de floatPaths-peeling). Gemeenschappelijke ruimtes worden afgewerkt
  // zodra de gevel van de hoofdentree gereed is (fase 4, torenonafhankelijk) — chronologisch ruim
  // vóór de torens hun eigen afbouw afronden, dus de torens blijven het netwerk-bepalende eind.
  links.push(
    { pred: 'entree_gevel', succ: 'entreehal_afb' },
    { pred: 'entreehal_afb', succ: 'fietsenst_afb' }, { pred: 'entreehal_afb', succ: 'liftlobby_afb' },
    { pred: 'liftlobby_afb', succ: 'trappenhuis_afb' }, { pred: 'trappenhuis_afb', succ: 'buitenschil' },
    { pred: 'buitenschil', succ: 'signage' }, { pred: 'signage', succ: 'eindschoon_gem' },
  );

  // ── Fase 7 — Parkeergarage & terrein (~26 taken, externe koppeling + SF) ─────────────────
  // TWEEDE KRITIEKE BOUWSTROOM (zie de §"meerdere kritieke paden"-toelichting bovenaan dit
  // bestand). Zodra het parkeerdek gestort is (`f7`, voltooid vóór de statusdatum) is de garage
  // toegankelijk en begint een EIGEN ploeg aan de garage-afbouw — volledig los van de torens,
  // die hun eigen kraan-/ruwbouw-/afbouwketen volgen. Die stroom loopt strak door tot de
  // eindoplevering: hij heeft géén speling meer en is dus, náást de torens, kritiek.
  //
  // Het buitenterrein (ontsluiting, bestrating, groen) hangt aan het STAARTeind van diezelfde
  // stroom. Dat is ook chronologisch juister dan de oude opzet: de tijdelijke bouwweg werd daar
  // al in juni opgebroken terwijl de torens nog omhoog moesten — nu gebeurt dat pas nadat het
  // steigerwerk weg is.
  tasks.push(
    { key: 'P7', name: '7. Car park & site works', taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    // Garage-afbouw: een aaneengesloten ambachtsketen onder het (al gestorte) parkeerdek.
    // 29 werkdagen (was 30) sinds het minutenmodel (2026-10-26): de statusdatum is nu het moment
    // waarop `kraan_op` klaar is (einde van de werkdag), dus de garage- en de torenketen beginnen op
    // hetzelfde moment. In het dagmodel was de statusdatum het begin van de kraandag en begon de
    // garage één werkdag eerder dan de torens. Met 30 dagen eindigde de garage dan één dag ná de
    // torens; de torens kregen 1 dag speling en het ontwerp (torens én garage kritiek) viel weg.
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
    // START_FINISH: het opbreken van de tijdelijke bouwweg mag pas EINDIGEN nadat de nieuwe
    // ontsluiting is gestart (SF: pred START → succ FINISH) — de enige SF-relatie in de suite.
    { key: 'bouwweg_op', name: 'Break up temporary site road', parent: 'P7', dur: 3, taskType: 'LOGISTIC', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    { key: 'riool_terrein', name: 'Site sewer connection, main building', parent: 'P7', dur: 4, taskType: 'CONSTRUCTION', codes: { Tower: 'GEN', Discipline: 'CIV' } },
    // Externe (cross-project) koppeling (fase 2.9/2.10, §4.2): het bestratingswerk hangt af van
    // het bevroren anker uit het NIET-PUBLIC bronbestand van de terrein-onderaannemer.
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
        // Bewust true (architect-besluit 4): het bronbestand is NIET in de PUBLIC-set, dus een
        // gebruiker die GROOT via de app opent kan de koppeling nooit verversen — ghost-pad.
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
    // Garage-afbouwketen: strak sequentieel vanaf de (voltooide) parkeerdek-overkapping.
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

  // ── Fase 8 — Oplevering (~10 taken, 2 baselines + voortgang) ──────────────────────────────
  // Ontwerpkeuze (§3.3, meerdere kritieke paden): de per-toren opleverkeuringen zijn de ECHTE
  // eindpunten van het netwerk (mandatory FINISH-mijlpaal, GEEN verdere opvolger) — dit fasen-
  // gebouw wordt building-voor-building aan de bewoners/VvE overgedragen, ieder een eigen
  // contractueel afrondingsmoment. De projectadministratie (documentatie/sleutels/hoofddeadline)
  // loopt PARALLEL vanaf de terreinoplevering (niet ná de torens) — realistisch (papierwerk wordt
  // voorbereid terwijl de laatste torens nog worden afgerond) én functioneel noodzakelijk: zodra
  // twee torens EXACT even lang duren (de rebaseline-mutatie hieronder maakt A+B getide), moet de
  // solver ze als 2 onafhankelijke, niet-samenvloeiende kritieke ketens kunnen zien
  // (`CPMSolver.ts` se `floatPaths`-peeling voegt getide voorgangers van een GEDEELDE opvolger
  // samen tot één keten — twee torens die naar hetzelfde slotmijlpaal convergeren zouden dus altijd
  // als 1 kritiek pad tellen, nooit als 2, ongeacht hoe strak ze getided zijn). Dat blijft een
  // noodzakelijke voorwaarde; VOLDOENDE is het niet — zie de toelichting bovenaan dit bestand:
  // beide torenketens tracen alsnog het voltooide voorstuk in, dus het tweede kritieke pad komt
  // van de garage/terrein-stroom in fase 7.
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

  // ── Voortgang + statusdatum (fase 2.6/2.10) — fase 1+2 volledig afgerond, torenkraan net op ──
  // Fase 2.10 (P1-datafix, QA-bevinding): de patch dekte eerder NIET de volledige fase 1+2-keten
  // (de kelder-vlechtwerk/stort-taken per toren + f4/f5/f7/f6 ontbraken, en de 3 mijlpalen op deze
  // keten — ms_start/ms_bouwrijp/ms_kelder — waren categorisch uitgesloten). Resultaat: die
  // mijlpalen bleven completion=0 terwijl hun al-afgeronde opvolgers (Sonderingen, Wegafzetting,
  // Bemaling, Torenkraan opbouwen) wél actuals hadden ⇒ 4 out-of-sequence-meldingen, plus een door
  // de data-date-vloer gevloerde `ms_start`-EF die als fantoom-negatieve float door de hele
  // (allang voltooide) fase-1-keten propageerde (§P1-detector-fix in CPMSolver.ts verhielp de
  // valse hard-pin-schending die hieruit voortvloeide; dit hier maakt de VERHAALLIJN zelf
  // consistent). Nu is de volledige keten tot en met "torenkraan net op" doorgepatcht, inclusief
  // de 3 mijlpalen (de eerdere categorische milestone-uitsluiting is opgeheven — hieronder mag een
  // mijlpaal gewoon meedoen zolang hij vóór de statusdatum ligt) en is `kraan_op`/`statusDay`
  // dienovereenkomstig doorgeschoven zodat de volgorde kloppend blijft (geen taak start vóór zijn
  // voorganger volgens de actuals al klaar is).
  // Fase 2.10 (pakket F, datafix 2): de werkelijke datums worden NIET meer uit handmatige
  // werkdag-indices afgeleid. Die tabel had twee samenwerkende fouten: (1) off-by-one — per regel
  // gold `eindDag − startDag == dur`, terwijl `offset()` in gen-core INCLUSIEF mapt
  // (`addBusinessDays(anchor, n + 1)`), dus elke voltooide taak kreeg een actual-span van dur+1
  // werkdagen; (2) feestdag-blind — `addBusinessDays` slaat alléén weekenden over, terwijl de
  // projectkalender NL-feestdagen + bouwvak kent (Nutsaansluitingen landde zo op Goede Vrijdag).
  // Samen leverde dat ~1 werkdag schijn-UITLOOP per voltooide taak op; de solver pint een
  // voltooide taak in de forward pass op zijn actuals maar leidt LS/LF af uit het netwerk met de
  // GEPLANDE duren (`CPMSolver.ts`), dus die uitloop stapelde P6-conform terug tot TF = −4 op
  // `ms_start` en −5 op de fase-1-keten — correct rekenwerk, foute brondata.
  // `actualsFromPlan` neemt in plaats daarvan de berekende, kalenderbewuste planning over ⇒
  // 0 uitloop, 0 negatieve speling: "voltooid conform plan" ís de bedoelde verhaallijn.
  //
  // BEWUST alleen SYMMETRISCH per-toren (nooit een asymmetrische toren-specifieke waarde): een
  // voortgangs-override triggert data-date-gedreven herplanning (§CPMSolver "remaining work"),
  // wat de bewust symmetrische torens A/B (§3.3-ontwerp: identieke ketens ⇒ getide kritieke paden)
  // zou verstoren als hij ASYMMETRISCH op één toren stond — vandaar A/B/C alle drie of geen.
  const PROGRESS_KEYS = [
    'ms_start',
    'v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'ms_bouwrijp',
    'f0', 'f1', 'f2', 'f3',
    'fA_grond', 'fB_grond', 'fC_grond',
    // Vlechtwerk/stort per toren (uur-kalender, §hierboven) — symmetrisch over A/B/C.
    'fA_vlkv', 'fB_vlkv', 'fC_vlkv', 'fA_stkv', 'fB_stkv', 'fC_stkv',
    'fA_vlkw', 'fB_vlkw', 'fC_vlkw', 'fA_stkw', 'fB_stkw', 'fC_stkw',
    'f4', 'f5', 'f7', 'f6', 'ms_kelder', 'kraan_op',
  ];
  for (const key of PROGRESS_KEYS) {
    const idx = tasks.findIndex(t => t.key === key);
    if (idx >= 0) tasks[idx] = { ...tasks[idx], completion: 1, actualsFromPlan: true };
  }

  // ── Baselines + rebaseline (architect-besluit 3): Contract → meerwerk → Herbaseline ───────
  // Meerwerk: extra bergingen in de kelder (nieuwe taak) + 3 werkdagen langere stucwerkscope op
  // ZOWEL toren A als B (extendDurations) — beide ná de Contract-baseline, gevolgd door een
  // tweede runCPM() vóór de Herbaseline-snapshot. Belangrijk voor het kritiek-pad-ontwerp (§3.3):
  // de mutatie is wat er ECHT in het geëxporteerde (actieve, post-mutatie) schema terechtkomt —
  // door A ÉN B met dezelfde 3 werkdagen te verlengen blijven ze na de mutatie getide kritiek
  // (het tweede kritieke PAD komt niet hiervandaan maar uit de garage/terrein-stroom, zie de
  // toelichting bovenaan dit bestand), terwijl toren C (ongewijzigd) daardoor 3 werkdagen positieve
  // speling krijgt — precies binnen `nearCriticalThreshold` (near-critical, niet kritiek).
  // activeBaselineName='Contract' houdt de variantie direct zichtbaar in de Gantt/VarianceReport;
  // de herbaseline staat ernaast in dezelfde baselinestrook (comparedBaselineNames).
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
    // ── Capaciteit: bewust op DRIE torens tegelijk gedimensioneerd ────────────────────────────
    // De showcase belooft PRECIES TWEE knelpunten (torenkraan + stukadoors, zie hieronder); alle
    // andere pools moeten dus schoon blijven. Omdat de drie torens per ontwerp parallel lopen,
    // is de maatgevende vraag per pool = 3 × de piek van ÉÉN toren (gemeten met de echte
    // `computeResourceLoad`, per toren afzonderlijk — dus onafhankelijk van hoe de torens
    // toevallig op de kalender uitlijnen; ook de curves zitten daar al in verwerkt, want een
    // FRONT_LOADED/BELL-toewijzing concentreert het tempo op enkele dagen). `maxUnits` raakt de
    // CPM-datums niet (het speelt alleen in het histogram en bij nivellering), dus deze dimensie
    // is de minst verstorende: kritieke paden, constraints en speling blijven ongewijzigd.
    // Per pool (piek/toren × 3): Betonvlechters 2×3, Timmerlieden 4×3, Gevelbouwer 2×3,
    // Liftleverancier 1×3, Tegelzetters 5×3, Keukenmonteurs 3×3, Installateurs 6×3, Schilders 5×3.
    //
    // De twee BEDOELDE knelpunten houden hun krappe capaciteit:
    //  • Torenkraan (EQUIPMENT, 1 stuks t/m de `availabilitySteps`-capaciteitsstap naar 2) —
    //    de door het ontwerpdoc voorgeschreven overallocatie: één kraan die tussen drie torens
    //    moet schuiven terwijl de vraag tot 6 kraanposities per dag oploopt.
    //  • Stukadoors (LABOR, 3 man) — één afbouwploeg die niet op drie torens tegelijk kan staan
    //    (vraag 9): dezelfde les als in de MIDDEL-showcase, maar op grotere schaal.
    // Beide knelpunten zijn met de ECHTE nivelleerder volledig oplosbaar (headless gemeten:
    // 80 overgealloceerde resource-dagen → 0, 0 onopgeloste taken) — conform het ontwerpdoc
    // ("oplosbaar met nivellering"). Vóór deze dimensionering liepen ook de andere 8 pools over,
    // waarvan er 4 zelfs ná nivellering bleven staan (de piek van één losse taak overschreed de
    // pool al) — precies wat die belofte tegensprak.
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
    // Near-critical + float paths (fase 2.9/2.10, golf 2): FREE_FLOAT-peeling levert
    // `criticalPaths.length > 1` op zodra torens A/B exact tied zijn (§3.3-ontwerp hierboven).
    schedulingOptions: {
      nearCriticalThreshold: 3,
      floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 8 },
    },
    tasks,
    links,
    baselines,
    activeBaselineName: 'Contract',
    comparedBaselineNames: ['Re-baseline (variation order)'],
    // Statusdatum = "de torenkraan staat er net": het GEPLANDE einde van `kraan_op` — de laatste
    // schakel van de voortgangsketen hierboven. Bewust AFGELEID i.p.v. hardgecodeerd: een vaste
    // `statusDay` is anker-afhankelijk (`offset()` telt alleen weekenden weg, de projectkalender
    // kent ook feestdagen/bouwvak) en zou bij een ander generatiejaar naast de kraan-oplevering
    // vallen — te vroeg ⇒ de generator weigert de actuals, te laat ⇒ opnieuw schijn-uitloop.
    // Nu valt de statusdatum per constructie exact samen met `kraan_op`s werkelijke einde.
    statusFromPlanFinish: 'kraan_op',
  };
}
