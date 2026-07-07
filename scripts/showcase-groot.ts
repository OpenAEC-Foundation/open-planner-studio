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
// Ontwerp kritiek-pad-variantie (§3.3): torens A en B zijn qua taken/duren VOLLEDIG symmetrisch
// (ze eindigen exact tegelijk ⇒ 2 gelijkwaardige kritieke ketens, `criticalPaths.length > 1` via
// `floatPaths.method:'FREE_FLOAT'`); toren C is identiek t/m de afbouw-fase, maar krijgt daar één
// kortere taak (`Vloerafwerking — Toren C`, 3 werkdagen korter) — dat plaatst toren C's hele keten
// op precies 3 werkdagen positieve speling, binnen de `nearCriticalThreshold` (3), dus zichtbaar
// near-critical i.p.v. kritiek. De torenkraan (EQUIPMENT, maxUnits 1 t/m een `availabilitySteps`-
// capaciteitsstap) wordt door alle drie torens tegelijk bevraagd ⇒ zichtbare, met nivellering
// oplosbare overallocatie (geen van de bevraagde taken heeft prioriteit 1000).
import type { ProjectSpec, TaskSpec, LinkSpec } from './spec';

// ── Extern bronbestand — "Terreininrichting Onderaannemer" (NIET-PUBLIC, §4.2) ─────────────
// Kleine, op zichzelf staande planning van een andere partij (parkeergarage-/terreinaannemer).
// category:'external-source' ⇒ NOOIT in de PUBLIC-set (generate-examples.ts leidt PUBLIC af uit
// category==='showcase'), maar WEL meegecommit in examples/ zodat sourceRef.filePath iets zinnigs
// oplevert. `sourceMissing:true` in de GROOT-koppeling is BEWUST (architect-besluit 4): het
// bronbestand reist niet mee in de gepubliceerde (Backstage-)selectie, dus een gebruiker die GROOT
// via de app opent kan het echt niet verversen — precies het "bron ontbreekt"-pad demonstrerend.
export const ANCHOR_TASK_NAME = 'Terrein gereed voor bestrating hoofdaannemer';

export const TERREIN_ONDERAANNEMER: ProjectSpec = {
  slug: 'showcase-groot-terrein-onderaannemer',
  name: 'Terreininrichting Onderaannemer',
  author: 'Uitvoerder terrein',
  company: 'GrondWerk Zuid BV',
  category: 'external-source',
  description:
    'NIET-PUBLIC bronbestand voor de externe (cross-project) koppeling in de GROOT-showcase — ' +
    'een andere partij levert de terreininrichting/parkeergarage-omgeving apart aan. Geen ' +
    'showcase, bewust geen onderdeel van de Backstage-lijst.',
  tasks: [
    { key: 'ms_start', name: 'Start terreinwerk onderaannemer', milestone: true, milestoneKind: 'START' },
    { key: 't1', name: 'Bouwweg onderaannemer verharden', dur: 4, taskType: 'LOGISTIC' },
    { key: 't2', name: 'Kabels & leidingen terrein aanleggen', dur: 5, taskType: 'INSTALLATION' },
    { key: 't3', name: 'Rioolaansluiting terrein', dur: 4, taskType: 'CONSTRUCTION' },
    { key: 't4', name: 'Grondverbetering parkeerterrein', dur: 5, taskType: 'CONSTRUCTION' },
    { key: 't5', name: 'Funderingslaag parkeerterrein aanbrengen', dur: 4, taskType: 'CONSTRUCTION' },
    { key: 't6', name: 'Groenvoorziening aanleggen', dur: 3, taskType: 'CONSTRUCTION' },
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
  name: 'Uur-kalender vlechtwerk & stort',
  description: 'Ma-vr 07:00-15:00, uur-precisie voor wapening/beton (fase 2.10, golf 2).',
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
    { key: 'ms_start', name: 'Start project Appartementencomplex', milestone: true, milestoneKind: 'START' },
    { key: 'P1', name: '1. Voorbereiding & bouwrijp maken', taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'v0', name: 'Sonderingen & grondonderzoek', parent: 'P1', dur: 3, taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'v1', name: 'Omgevingsvergunning verkrijgen', parent: 'P1', dur: 10, taskType: 'LOGISTIC',
      codes: { Toren: 'ALG', Discipline: 'CIV' }, fields: { Vergunningnummer: 'OV-2026-00417' } },
    // Hard pin (fase 2.9/2.10): P6 Mandatory Start — de gemeente staat de wegafzetting alleen op
    // exact deze vergunde datum toe; de logica buigt ervoor (constraint.hard = true).
    { key: 'v2', name: 'Wegafzetting gemeente (vergunde stremmingsperiode)', parent: 'P1', dur: 3, taskType: 'ATTENDANCE',
      constraint: { type: 'MSO', offsetDay: 8, hard: true },
      description: 'Hard-pin (P6 Mandatory Start): de vergunde stremmingsdatum ligt vast bij de gemeente en overschrijft de netwerklogica.',
      codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'v3', name: 'Bouwweg aanleggen', parent: 'P1', dur: 4, taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'v4', name: 'Bouwketen plaatsen', parent: 'P1', dur: 2, taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'v5', name: 'Nutsaansluitingen aanleggen', parent: 'P1', dur: 4, taskType: 'LOGISTIC', priority: 1000,
      description: 'Vastgepind (prioriteit 1000): vaste aansluitdatum van het nutsbedrijf, mag niet schuiven.',
      codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'v6', name: 'Bemaling plaatsen', parent: 'P1', dur: 5, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'ms_bouwrijp', name: 'Terrein bouwrijp', parent: 'P1', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Toren: 'ALG', Discipline: 'CIV' } },
  );
  links.push(
    { pred: 'ms_start', succ: 'v0' }, { pred: 'ms_start', succ: 'v2' },
    { pred: 'v0', succ: 'v1' }, { pred: 'v1', succ: 'v3' }, { pred: 'v2', succ: 'v3' },
    { pred: 'v3', succ: 'v4' }, { pred: 'v4', succ: 'v5' }, { pred: 'v5', succ: 'v6' }, { pred: 'v6', succ: 'ms_bouwrijp' },
  );

  // ── Fase 2 — Fundering & kelder/parkeergarage (~25 taken, uren-planning) ──────────────────
  tasks.push(
    { key: 'P2', name: '2. Fundering & kelder/parkeergarage', taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'f0', name: 'Bemaling in bedrijf stellen', parent: 'P2', dur: 2, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'f1', name: 'Grondwerk bouwput', parent: 'P2', dur: 6, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'f2', name: 'Damwanden plaatsen', parent: 'P2', dur: 5, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'f3', name: 'Funderingsbalken storten (gezamenlijk)', parent: 'P2', dur: 4, taskType: 'CONSTRUCTION',
      codes: { Toren: 'ALG', Discipline: 'CIV' }, fields: { Kostenraming: 340000 },
      assign: [{ res: 'Beton C30/37', units: 60, curve: 'FRONT_LOADED' }] },
  );
  links.push(
    { pred: 'ms_bouwrijp', succ: 'f0' }, { pred: 'f0', succ: 'f1' }, { pred: 'f1', succ: 'f2' }, { pred: 'f2', succ: 'f3' },
  );
  for (const tw of TORENS) {
    const grond = `f${tw}_grond`, vlkv = `f${tw}_vlkv`, stkv = `f${tw}_stkv`, vlkw = `f${tw}_vlkw`, stkw = `f${tw}_stkw`;
    tasks.push(
      { key: grond, name: `Grondwerk kelder — Toren ${tw}`, parent: 'P2', dur: 3, taskType: 'CONSTRUCTION',
        codes: { Toren: tw, Discipline: 'CIV' } },
      // Vlechtwerk/stort op de uur-kalender (`calendarKey`); de stort-taken zijn sub-dag
      // (6u/4u < 8u netto/dag) — zichtbaar aan een balk die niet op een hele dag valt.
      { key: vlkv, name: `Vlechtwerk wapening keldervloer — Toren ${tw}`, parent: 'P2', durMinutes: 480, calendarKey: 'stort',
        taskType: 'CONSTRUCTION', codes: { Toren: tw, Discipline: 'CIV' } },
      { key: stkv, name: `Stort keldervloer — Toren ${tw}`, parent: 'P2', durMinutes: 360, calendarKey: 'stort',
        taskType: 'CONSTRUCTION', codes: { Toren: tw, Discipline: 'CIV' },
        assign: [{ res: 'Beton C30/37', units: 30, curve: 'UNIFORM' }] },
      { key: vlkw, name: `Vlechtwerk wapening kelderwanden — Toren ${tw}`, parent: 'P2', durMinutes: 480, calendarKey: 'stort',
        taskType: 'CONSTRUCTION', codes: { Toren: tw, Discipline: 'CIV' } },
      { key: stkw, name: `Stort kelderwanden — Toren ${tw}`, parent: 'P2', durMinutes: 240, calendarKey: 'stort',
        taskType: 'CONSTRUCTION', codes: { Toren: tw, Discipline: 'CIV' },
        assign: [{ res: 'Beton C30/37', units: 25, curve: 'UNIFORM' }] },
    );
    links.push(
      { pred: 'f3', succ: grond }, { pred: grond, succ: vlkv }, { pred: vlkv, succ: stkv },
      { pred: stkv, succ: vlkw }, { pred: vlkw, succ: stkw },
    );
  }
  tasks.push(
    { key: 'f4', name: 'Afdichting kelder', parent: 'P2', dur: 3, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'f5', name: 'Terugstorten grond rondom kelder', parent: 'P2', dur: 3, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'f7', name: 'Parkeerdek storten (afdek begane grond)', parent: 'P2', dur: 5, taskType: 'CONSTRUCTION',
      codes: { Toren: 'ALG', Discipline: 'CIV' }, assign: [{ res: 'Beton C30/37', units: 50, curve: 'FRONT_LOADED' }] },
    { key: 'f6', name: 'Damwanden verwijderen', parent: 'P2', dur: 2, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'ms_kelder', name: 'Kelder waterdicht — keuring', parent: 'P2', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Toren: 'ALG', Discipline: 'CIV' } },
  );
  for (const tw of TORENS) links.push({ pred: `f${tw}_stkw`, succ: 'f4' });
  links.push(
    { pred: 'f4', succ: 'f5' }, { pred: 'f5', succ: 'f7' }, { pred: 'f7', succ: 'f6' }, { pred: 'f6', succ: 'ms_kelder' },
  );

  // ── Fase 3 — Ruwbouw torens A/B/C parallel (~90 taken) ────────────────────────────────────
  tasks.push(
    { key: 'P3', name: '3. Ruwbouw torens A/B/C (parallel)', taskType: 'CONSTRUCTION' },
    { key: 'kraan_op', name: 'Torenkraan opbouwen', parent: 'P3', dur: 3, taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'RUW' } },
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
    tasks.push({ key: pkey, name: `Ruwbouw — Toren ${tw}`, parent: 'P3', taskType: 'CONSTRUCTION', codes: { Toren: tw, Discipline: 'RUW' } });
    const bgv = `t${tw}_bgv`;
    tasks.push({ key: bgv, name: `Begane grondvloer storten — Toren ${tw}`, parent: pkey, dur: 4, taskType: 'CONSTRUCTION',
      codes: { Toren: tw, Discipline: 'RUW' }, assign: [{ res: 'Beton C30/37', units: 40, curve: 'FRONT_LOADED' }] });
    links.push({ pred: 'kraan_op', succ: bgv }, { pred: `f${tw}_stkw`, succ: bgv });
    torenFirstReal[tw] = bgv;

    let prev = bgv;
    for (let f = 1; f <= FLOORS; f++) {
      const w = `t${tw}_w${f}`, v = `t${tw}_v${f}`;
      tasks.push(
        { key: w, name: `Wanden verdieping ${f} — Toren ${tw}`, parent: pkey, dur: 4, taskType: 'CONSTRUCTION',
          codes: { Toren: tw, Discipline: 'RUW' }, assign: [{ res: 'Betonvlechters', units: 2 }, { res: 'Torenkraan', units: 1 }] },
        { key: v, name: `Vloer verdieping ${f} — Toren ${tw}`, parent: pkey, dur: 3, taskType: 'CONSTRUCTION',
          codes: { Toren: tw, Discipline: 'RUW' }, assign: [{ res: 'Timmerlieden', units: 2 }, { res: 'Torenkraan', units: 1 }] },
      );
      links.push({ pred: prev, succ: w }, { pred: w, succ: v, type: 'START_START', lag: 2 });
      prev = v;
    }
    const dak = `t${tw}_dak`, trap = `t${tw}_trap`, msGereed = `t${tw}_ruwbouw_gereed`;
    tasks.push(
      { key: trap, name: `Trappenhuis & liftschacht — Toren ${tw}`, parent: pkey, dur: FLOORS * 3, taskType: 'CONSTRUCTION',
        codes: { Toren: tw, Discipline: 'RUW' }, assign: [{ res: 'Timmerlieden', units: 2 }] },
      { key: dak, name: `Dakconstructie plaatsen — Toren ${tw}`, parent: pkey, dur: 5, taskType: 'CONSTRUCTION',
        codes: { Toren: tw, Discipline: 'RUW' }, assign: [{ res: 'Timmerlieden', units: 2 }, { res: 'Torenkraan', units: 1 }] },
      { key: msGereed, name: `Ruwbouw gereed — Toren ${tw}`, parent: pkey, milestone: true, milestoneKind: 'FINISH',
        codes: { Toren: tw, Discipline: 'RUW' } },
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
  tasks.push({ key: 'hammock_A', name: 'Ruwbouw toren A (LOE)', parent: 'P3_A', hammock: true });
  links.push(
    { pred: torenFirstReal.A, succ: 'hammock_A', type: 'START_START' },
    { pred: torenLastReal.A, succ: 'hammock_A', type: 'FINISH_FINISH' },
  );
  tasks.push({ key: 'kraan_af', name: 'Torenkraan afbreken', parent: 'P3', dur: 2, taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'RUW' } });
  for (const tw of TORENS) links.push({ pred: torenMsGereed[tw], succ: 'kraan_af' });

  // ── Fase 4 — Gevel & dak (~30 taken, near-critical zichtbaar) ─────────────────────────────
  tasks.push({ key: 'P4', name: '4. Gevel & dak', taskType: 'CONSTRUCTION' });
  for (const tw of TORENS) {
    const pkey = `P4_${tw}`;
    tasks.push({ key: pkey, name: `Gevel & dak — Toren ${tw}`, parent: 'P4', codes: { Toren: tw, Discipline: 'RUW' } });
    const steig = `t${tw}_steiger_op`, gevIso = `t${tw}_gevIso`, gevBekl = `t${tw}_gevBekl`, kozijn = `t${tw}_kozijn`,
      dakIso = `t${tw}_dakIso`, dakBed = `t${tw}_dakBed`, balkon = `t${tw}_balkon`, regen = `t${tw}_regen`,
      steigAf = `t${tw}_steiger_af`;
    tasks.push(
      { key: steig, name: `Steigerwerk plaatsen — Toren ${tw}`, parent: pkey, dur: 3, taskType: 'LOGISTIC', codes: { Toren: tw, Discipline: 'RUW' } },
      { key: gevIso, name: `Gevelisolatie aanbrengen — Toren ${tw}`, parent: pkey, dur: 8, taskType: 'INSTALLATION',
        codes: { Toren: tw, Discipline: 'RUW' }, assign: [{ res: 'Gevelbouwer', units: 2 }] },
      { key: gevBekl, name: `Gevelbekleding monteren — Toren ${tw}`, parent: pkey, dur: 10, taskType: 'INSTALLATION',
        codes: { Toren: tw, Discipline: 'RUW' }, assign: [{ res: 'Gevelbouwer', units: 2 }] },
      { key: kozijn, name: `Kozijnen plaatsen — Toren ${tw}`, parent: pkey, dur: 6, taskType: 'INSTALLATION', codes: { Toren: tw, Discipline: 'RUW' } },
      { key: dakIso, name: `Dakisolatie aanbrengen — Toren ${tw}`, parent: pkey, dur: 5, taskType: 'INSTALLATION', codes: { Toren: tw, Discipline: 'RUW' } },
      { key: dakBed, name: `Dakbedekking aanbrengen — Toren ${tw}`, parent: pkey, dur: 5, taskType: 'CONSTRUCTION', codes: { Toren: tw, Discipline: 'RUW' } },
      { key: balkon, name: `Balkonhekwerken monteren — Toren ${tw}`, parent: pkey, dur: 5, codes: { Toren: tw, Discipline: 'RUW' } },
      { key: regen, name: `Regenwaterafvoer aansluiten — Toren ${tw}`, parent: pkey, dur: 3, taskType: 'INSTALLATION', codes: { Toren: tw, Discipline: 'RUW' } },
      { key: steigAf, name: `Steigerwerk verwijderen — Toren ${tw}`, parent: pkey, dur: 2, taskType: 'LOGISTIC', codes: { Toren: tw, Discipline: 'RUW' } },
    );
    links.push(
      { pred: torenLastReal[tw], succ: steig }, { pred: steig, succ: gevIso }, { pred: gevIso, succ: gevBekl },
      { pred: gevBekl, succ: kozijn }, { pred: torenLastReal[tw], succ: dakIso }, { pred: dakIso, succ: dakBed },
      { pred: dakBed, succ: regen }, { pred: kozijn, succ: balkon }, { pred: balkon, succ: steigAf }, { pred: regen, succ: steigAf },
    );
    torenLastGevel[tw] = steigAf;
  }
  tasks.push(
    { key: 'entree_gevel', name: 'Gevelbeplating hoofdentree', parent: 'P4', dur: 4, codes: { Toren: 'ALG', Discipline: 'RUW' } },
    { key: 'parkeer_overkap', name: 'Overkapping parkeerdek plaatsen', parent: 'P4', dur: 5, codes: { Toren: 'ALG', Discipline: 'RUW' } },
  );
  links.push({ pred: torenLastGevel.A, succ: 'entree_gevel' }, { pred: 'f7', succ: 'parkeer_overkap' });

  // ── Fase 5 — Installaties (MEP) (~35 taken, secundaire constraint) ────────────────────────
  tasks.push(
    { key: 'P5', name: '5. Installaties (MEP)', taskType: 'INSTALLATION' },
    { key: 'techniek_warmte', name: 'Warmtecentrale plaatsen', parent: 'P5', dur: 6, taskType: 'INSTALLATION', codes: { Toren: 'ALG', Discipline: 'INST' } },
    { key: 'techniek_elek', name: 'Hoofdverdeler elektra aansluiten', parent: 'P5', dur: 4, taskType: 'INSTALLATION', codes: { Toren: 'ALG', Discipline: 'INST' } },
    { key: 'techniek_nood', name: 'Noodstroomaggregaat plaatsen & testen', parent: 'P5', dur: 3, taskType: 'INSTALLATION', codes: { Toren: 'ALG', Discipline: 'INST' } },
    { key: 'techniek_data', name: 'Datacentrum serverruimte inrichten', parent: 'P5', dur: 4, taskType: 'INSTALLATION', codes: { Toren: 'ALG', Discipline: 'INST' } },
  );
  links.push(
    { pred: 'entree_gevel', succ: 'techniek_warmte' }, { pred: 'techniek_warmte', succ: 'techniek_elek' },
    { pred: 'techniek_elek', succ: 'techniek_nood' }, { pred: 'techniek_nood', succ: 'techniek_data' },
  );
  for (const tw of TORENS) {
    const pkey = `P5_${tw}`;
    tasks.push({ key: pkey, name: `Installaties — Toren ${tw}`, parent: 'P5', codes: { Toren: tw, Discipline: 'INST' } });
    const w = `t${tw}_wtb`, el = `t${tw}_elek`, vent = `t${tw}_vent`, sprink = `t${tw}_sprink`, data = `t${tw}_data`,
      brand = `t${tw}_brand`, lift = `t${tw}_lift`, keur = `t${tw}_keurinst`;
    tasks.push(
      { key: w, name: `Werktuigbouwkundige installatie — Toren ${tw}`, parent: pkey, dur: 8, taskType: 'INSTALLATION',
        codes: { Toren: tw, Discipline: 'INST' }, assign: [{ res: 'Installateurs', units: 3 }] },
      { key: el, name: `Elektra aanleggen — Toren ${tw}`, parent: pkey, dur: 7, taskType: 'INSTALLATION',
        codes: { Toren: tw, Discipline: 'INST' }, assign: [{ res: 'Installateurs', units: 3 }] },
      { key: vent, name: `Ventilatiekanalen aansluiten — Toren ${tw}`, parent: pkey, dur: 5, taskType: 'INSTALLATION', codes: { Toren: tw, Discipline: 'INST' } },
      { key: sprink, name: `Sprinklerinstallatie aanleggen — Toren ${tw}`, parent: pkey, dur: 5, taskType: 'INSTALLATION', codes: { Toren: tw, Discipline: 'INST' } },
      { key: data, name: `Data/ICT-bekabeling aanleggen — Toren ${tw}`, parent: pkey, dur: 4, taskType: 'INSTALLATION', codes: { Toren: tw, Discipline: 'INST' } },
      { key: brand, name: `Brandmeldinstallatie aanleggen — Toren ${tw}`, parent: pkey, dur: 4, taskType: 'INSTALLATION', codes: { Toren: tw, Discipline: 'INST' } },
      {
        key: lift, name: `Levering & installatie liftinstallatie — Toren ${tw}`, parent: pkey, dur: 10, taskType: 'INSTALLATION',
        codes: { Toren: tw, Discipline: 'INST' }, assign: [{ res: 'Liftleverancier', units: 1 }],
        fields: { KritiekeLevering: true },
        // Secundaire constraint (fase 2.9/2.10, `constraint2`, altijd soft): primair ASAP
        // (afwezig), secundair een praktische bovengrens (SNLT) op de leverdatum.
        ...(tw === 'A' ? { constraint2: { type: 'SNLT', offsetDay: 300 } } : {}),
      },
      { key: keur, name: `Oplevermeting installaties — Toren ${tw}`, parent: pkey, milestone: true, milestoneKind: 'FINISH', mandatory: true,
        codes: { Toren: tw, Discipline: 'INST' } },
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
  tasks.push({ key: 'P6', name: '6. Afbouw', taskType: 'CONSTRUCTION' });
  for (const tw of TORENS) {
    const pkey = `P6_${tw}`;
    tasks.push({ key: pkey, name: `Afbouw — Toren ${tw}`, parent: 'P6', codes: { Toren: tw, Discipline: 'AFB' } });
    const stuc = `t${tw}_stuc`, tegel = `t${tw}_tegel`, keuken = `t${tw}_keuken`, sanit = `t${tw}_sanit`,
      schil = `t${tw}_schil`, vloer = `t${tw}_vloer`, plafond = `t${tw}_plafond`, deuren = `t${tw}_deuren`;
    tasks.push(
      { key: stuc, name: `Stucwerk — Toren ${tw}`, parent: pkey, dur: 12, codes: { Toren: tw, Discipline: 'AFB' },
        assign: [{ res: 'Stukadoors', units: 3, curve: 'UNIFORM' }],
        ...(tw === 'B' ? { notes: [{ text: 'Vochtmeting muren uitgevoerd', done: true }] } : {}) },
      { key: tegel, name: `Tegelwerk — Toren ${tw}`, parent: pkey, dur: 10, codes: { Toren: tw, Discipline: 'AFB' },
        assign: [{ res: 'Tegelzetters', units: 3, curve: 'FRONT_LOADED' }] },
      { key: keuken, name: `Keukens plaatsen — Toren ${tw}`, parent: pkey, dur: 8, codes: { Toren: tw, Discipline: 'AFB' },
        assign: [{ res: 'Keukenmonteurs', units: 2, curve: 'BACK_LOADED' }],
        ...(tw === 'A' ? { notes: [{ text: 'Levering keukenapparatuur controleren bij leverancier', done: false }] } : {}) },
      { key: sanit, name: `Sanitair plaatsen — Toren ${tw}`, parent: pkey, dur: 7, taskType: 'INSTALLATION',
        codes: { Toren: tw, Discipline: 'AFB' }, assign: [{ res: 'Installateurs', units: 3, curve: 'BELL' }] },
      { key: schil, name: `Schilderwerk — Toren ${tw}`, parent: pkey, dur: 8, codes: { Toren: tw, Discipline: 'AFB' },
        assign: [{ res: 'Schilders', units: 3, curve: 'EARLY_PEAK' }] },
      { key: vloer, name: `Vloerafwerking — Toren ${tw}`, parent: pkey, dur: 5, codes: { Toren: tw, Discipline: 'AFB' },
        assign: [{ res: 'Tegelzetters', units: 2, curve: 'LATE_PEAK' }] },
      { key: plafond, name: `Plafonds afwerken — Toren ${tw}`, parent: pkey, dur: 5, codes: { Toren: tw, Discipline: 'AFB' } },
      { key: deuren, name: `Deuren hang- en sluitwerk — Toren ${tw}`, parent: pkey, dur: 4, codes: { Toren: tw, Discipline: 'AFB' } },
    );
    links.push(
      { pred: torenLastInst[tw], succ: stuc }, { pred: stuc, succ: tegel }, { pred: tegel, succ: keuken },
      { pred: keuken, succ: sanit }, { pred: sanit, succ: schil }, { pred: schil, succ: vloer },
      { pred: vloer, succ: plafond }, { pred: plafond, succ: deuren },
    );
    torenLastAfbouw[tw] = deuren;
  }
  tasks.push(
    { key: 'entreehal_afb', name: 'Entreehal afwerken', parent: 'P6', dur: 6, codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'fietsenst_afb', name: 'Fietsenstalling afwerken', parent: 'P6', dur: 4, codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'liftlobby_afb', name: "Liftlobby's afwerken", parent: 'P6', dur: 4, codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'trappenhuis_afb', name: 'Gemeenschappelijke trappenhuizen afwerken', parent: 'P6', dur: 5, codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'buitenschil', name: 'Buitenschilderwerk plint gevel', parent: 'P6', dur: 4, codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'signage', name: 'Signage & bewegwijzering plaatsen', parent: 'P6', dur: 2, codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'eindschoon_gem', name: 'Eindschoonmaak gemeenschappelijke ruimtes', parent: 'P6', dur: 3, codes: { Toren: 'ALG', Discipline: 'AFB' } },
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

  // ── Fase 7 — Terrein & parkeergarage-koppeling (~15 taken, externe koppeling + SF) ────────
  tasks.push(
    { key: 'P7', name: '7. Terrein & parkeergarage-koppeling', taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'ontsl1', name: 'Nieuwe hoofdontsluiting aanleggen', parent: 'P7', dur: 4, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'ontsl2', name: 'Nieuwe hoofdontsluiting in gebruik genomen', parent: 'P7', milestone: true, milestoneKind: 'START', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    // START_FINISH: het opbreken van de tijdelijke bouwweg mag pas EINDIGEN nadat de nieuwe
    // ontsluiting is gestart (SF: pred START → succ FINISH) — de enige SF-relatie in de suite.
    { key: 'bouwweg_op', name: 'Tijdelijke bouwweg opbreken', parent: 'P7', dur: 3, taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'riool_terrein', name: 'Rioolaansluiting terrein hoofdgebouw', parent: 'P7', dur: 4, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    // Externe (cross-project) koppeling (fase 2.9/2.10, §4.2): het bestratingswerk hangt af van
    // het bevroren anker uit het NIET-PUBLIC bronbestand van de terrein-onderaannemer.
    {
      key: 'bestrating', name: 'Bestrating parkeerterrein', parent: 'P7', dur: 6, taskType: 'CONSTRUCTION',
      codes: { Toren: 'ALG', Discipline: 'CIV' },
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
    { key: 'fietsenst_buiten', name: 'Fietsenstalling buiten plaatsen', parent: 'P7', dur: 3, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'groen_terrein', name: 'Groenvoorziening hoofdterrein aanleggen', parent: 'P7', dur: 5, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'buitenverl', name: 'Buitenverlichting plaatsen', parent: 'P7', dur: 3, taskType: 'INSTALLATION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'erfafsch', name: 'Erfafscheiding plaatsen', parent: 'P7', dur: 2, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'parkvak', name: 'Parkeervakken markeren', parent: 'P7', dur: 1, taskType: 'CONSTRUCTION', codes: { Toren: 'ALG', Discipline: 'CIV' } },
    { key: 'ms_terrein', name: 'Oplevering terrein — eindinspectie', parent: 'P7', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Toren: 'ALG', Discipline: 'CIV' } },
  );
  links.push(
    { pred: 'parkeer_overkap', succ: 'ontsl1' }, { pred: 'ontsl1', succ: 'ontsl2' },
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
  // als 1 kritiek pad tellen, nooit als 2, ongeacht hoe strak ze getided zijn).
  tasks.push({ key: 'P8', name: '8. Oplevering', taskType: 'ATTENDANCE', codes: { Toren: 'ALG', Discipline: 'AFB' } });
  for (const tw of TORENS) {
    const opl = `opl_${tw}`;
    tasks.push({ key: opl, name: `Opleverkeuring — Toren ${tw}`, parent: 'P8', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      codes: { Toren: tw, Discipline: 'AFB' },
      description: `Contractuele overdracht van Toren ${tw} aan de VvE/bewoners — onafhankelijk eindpunt (géén gezamenlijk slotmijlpaal met de andere torens).` });
    links.push({ pred: torenLastAfbouw[tw], succ: opl }, { pred: 'ms_terrein', succ: opl });
  }
  tasks.push(
    { key: 'documentatie', name: 'Documentatie-overdracht (revisietekeningen)', parent: 'P8', dur: 3, taskType: 'ATTENDANCE', codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'sleutels', name: 'Sleuteloverdracht beheerder', parent: 'P8', dur: 2, taskType: 'ATTENDANCE', codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'eindschoon_geb', name: 'Eindschoonmaak gemeenschappelijke ruimtes gebouw', parent: 'P8', dur: 3, taskType: 'LOGISTIC', codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'ms_hoofddeadline', name: 'Projectadministratie & contractuele afronding', parent: 'P8', milestone: true, milestoneKind: 'FINISH', mandatory: true,
      deadlineDay: 560, codes: { Toren: 'ALG', Discipline: 'AFB' },
      description: 'Contractuele/administratieve afronding (revisiedossier, beheerderoverdracht) — loopt parallel vanaf de terreinoplevering, niet gegateed door de torens (zie fase-toelichting).' },
    { key: 'ms_nazorg', name: 'Nazorgperiode gestart', parent: 'P8', milestone: true, milestoneKind: 'START', codes: { Toren: 'ALG', Discipline: 'AFB' } },
    { key: 'onderhoud', name: 'Onderhoudscontract technische installaties starten', parent: 'P8', dur: 1, taskType: 'ATTENDANCE', codes: { Toren: 'ALG', Discipline: 'AFB' } },
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
  const withProgress = (t: TaskSpec, startD: number, finishD: number): TaskSpec => ({
    ...t, completion: 1, actualStartDay: startD, actualFinishDay: finishD,
  });
  const progressPatch: Record<string, [number, number]> = {
    ms_start: [0, 0],
    v0: [0, 3], v1: [3, 13], v2: [8, 11], v3: [13, 17], v4: [17, 19], v5: [19, 23], v6: [23, 28],
    ms_bouwrijp: [28, 28],
    f0: [28, 30], f1: [30, 36], f2: [36, 41], f3: [41, 45],
    fA_grond: [45, 48], fB_grond: [45, 48], fC_grond: [45, 48],
    // Vlechtwerk/stort per toren (uur-kalender, §hierboven) — SYMMETRISCH over A/B/C (zelfde
    // dagwaarden voor alle drie) zodat de bewust getide kritieke paden (§3.3-ontwerp) intact
    // blijven; de asymmetrie die toren C near-critical maakt komt pas uit de latere
    // rebaseline-mutatie (stucwerk-verlenging op A+B), niet uit deze voortgangspatch.
    fA_vlkv: [48, 49], fB_vlkv: [48, 49], fC_vlkv: [48, 49],
    fA_stkv: [49, 50], fB_stkv: [49, 50], fC_stkv: [49, 50],
    fA_vlkw: [50, 51], fB_vlkw: [50, 51], fC_vlkw: [50, 51],
    fA_stkw: [51, 52], fB_stkw: [51, 52], fC_stkw: [51, 52],
    f4: [52, 55], f5: [55, 58], f7: [58, 63], f6: [63, 65],
    ms_kelder: [65, 65],
    kraan_op: [65, 68],
  };
  // BEWUST alleen SYMMETRISCH per-toren (nooit een asymmetrische toren-specifieke waarde): een
  // voortgangs-override met `actualStartDay`/`completion` triggert data-date-gedreven herplanning
  // (§CPMSolver "remaining work"), wat de bewust symmetrische torens A/B (§3.3-ontwerp: identieke
  // ketens ⇒ getide kritieke paden) zou verstoren als hij ASYMMETRISCH op één toren stond — vandaar
  // hierboven overal dezelfde dagwaarden voor A/B/C.
  for (const [key, [s, f]] of Object.entries(progressPatch)) {
    const idx = tasks.findIndex(t => t.key === key);
    if (idx >= 0) tasks[idx] = withProgress(tasks[idx], s, f);
  }

  // ── Baselines + rebaseline (architect-besluit 3): Contract → meerwerk → Herbaseline ───────
  // Meerwerk: extra bergingen in de kelder (nieuwe taak) + 3 werkdagen langere stucwerkscope op
  // ZOWEL toren A als B (extendDurations) — beide ná de Contract-baseline, gevolgd door een
  // tweede runCPM() vóór de Herbaseline-snapshot. Belangrijk voor het kritiek-pad-ontwerp (§3.3):
  // de mutatie is wat er ECHT in het geëxporteerde (actieve, post-mutatie) schema terechtkomt —
  // door A ÉN B met dezelfde 3 werkdagen te verlengen blijven ze na de mutatie getide kritiek
  // (`criticalPaths.length > 1`), terwijl toren C (ongewijzigd) daardoor 3 werkdagen positieve
  // speling krijgt — precies binnen `nearCriticalThreshold` (near-critical, niet kritiek).
  // activeBaselineName='Contract' houdt de variantie direct zichtbaar in de Gantt/VarianceReport.
  const baselines: NonNullable<ProjectSpec['baselines']> = [
    { name: 'Contract' },
    {
      name: 'Herbaseline (meerwerk)',
      mutationBefore: {
        addTasks: [
          { key: 'meerwerk_berging', name: 'Meerwerk: extra bergingen kelder', parent: 'P2', dur: 6, taskType: 'CONSTRUCTION',
            codes: { Toren: 'ALG', Discipline: 'CIV' }, description: 'Meerwerk-opdracht ná contractbaseline: extra bergingen in de kelder.' },
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
    name: 'Nieuwbouw Appartementencomplex De Vaart',
    author: 'Projectdirecteur',
    company: 'BouwGroep Randstad BV',
    category: 'showcase',
    description:
      'Appartementencomplex van 3 torens op één kavel, met parkeergarage/terrein door een ' +
      'onderaannemer — de "kitchen sink"-showcase die alle geavanceerde functies draagt.',
    publicDescription:
      'GROOT: appartementencomplex met 3 parallelle torens (~250 taken) — hard-pin MSO, ' +
      'secundaire constraint, hammock (LOE), near-critical-markering + meerdere kritieke paden ' +
      '(floatPaths), uren-planning voor vlechtwerk/stort, alle 5 resourcetypes incl. torenkraan ' +
      '(EQUIPMENT) met capaciteitsstap, alle 4 relatietypes (incl. START_FINISH), alle 6 ' +
      'toewijzingscurves, een externe koppeling naar een apart aangeleverd terreinbestand, twee ' +
      'baselines (Contract → Herbaseline na meerwerk) en voortgang + statusdatum.',
    tags: ['woningbouw', 'groot', 'geavanceerd', 'kitchen-sink', 'near-critical', 'float-paths', 'hammock', 'uren-planning', 'externe-koppeling', 'baseline'],
    calendar: { workDays: [1, 2, 3, 4, 5], name: 'Bouwkalender NL (GROOT)' },
    calendars: { stort: STORT_KALENDER },
    codeTypes: [
      { name: 'Toren', values: [
        { code: 'A', description: 'Toren A' }, { code: 'B', description: 'Toren B' }, { code: 'C', description: 'Toren C' },
        { code: 'ALG', description: 'Algemeen / gedeeld', color: '#6b7280' },
      ] },
      { name: 'Discipline', values: [
        { code: 'CIV', description: 'Civiel', color: '#78350f' },
        { code: 'RUW', description: 'Ruwbouw', color: '#b45309' },
        { code: 'INST', description: 'Installaties', color: '#0891b2' },
        { code: 'AFB', description: 'Afbouw', color: '#7c3aed' },
      ] },
    ],
    fields: [
      { name: 'Kostenraming', type: 'cost' },
      { name: 'Vergunningnummer', type: 'text' },
      { name: 'KritiekeLevering', type: 'boolean' },
    ],
    resources: [
      { name: 'Ruwbouwploeg', type: 'CREW', maxUnits: 1, description: 'Overkoepelende ruwbouwploeg' },
      { name: 'Betonvlechters', type: 'LABOR', maxUnits: 4, costPerHour: 44, parent: 'Ruwbouwploeg' },
      { name: 'Timmerlieden', type: 'LABOR', maxUnits: 4, costPerHour: 45 },
      { name: 'Torenkraan', type: 'EQUIPMENT', maxUnits: 1, costPerHour: 120, description: 'Eén torenkraan; tweede kraan later bijgeplaatst',
        steps: [{ fromDay: 130, maxUnits: 2 }] },
      { name: 'Beton C30/37', type: 'MATERIAL', maxUnits: 999, unitOfMeasure: 'm³' },
      { name: 'Gevelbouwer', type: 'SUBCONTRACTOR', maxUnits: 2, costPerHour: 60 },
      { name: 'Liftleverancier', type: 'SUBCONTRACTOR', maxUnits: 1, costPerHour: 90 },
      { name: 'Stukadoors', type: 'LABOR', maxUnits: 3, costPerHour: 42 },
      { name: 'Tegelzetters', type: 'LABOR', maxUnits: 3, costPerHour: 43 },
      { name: 'Keukenmonteurs', type: 'LABOR', maxUnits: 2, costPerHour: 46 },
      { name: 'Installateurs', type: 'LABOR', maxUnits: 4, costPerHour: 48 },
      { name: 'Schilders', type: 'LABOR', maxUnits: 3, costPerHour: 38 },
    ],
    // Near-critical + float paths (fase 2.9/2.10, golf 2): FREE_FLOAT-peeling levert
    // `criticalPaths.length > 1` op zodra torens A/B exact tied zijn (§3.3-ontwerp hierboven).
    schedulingOptions: {
      nearCriticalThreshold: 3,
      floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 5 },
    },
    tasks,
    links,
    baselines,
    activeBaselineName: 'Contract',
    // Fase 2.10 (P1-datafix): een korte, realistische buffer ná `kraan_op`s actualFinishDay (68,
    // zie progressPatch hierboven) — "torenkraan net op". Er blijft een KLEIN or (~1 t/m 5
    // werkdagen) negatieve float zichtbaar op de al-lang-voltooide fase-1-keten (Start
    // project…Sonderingen…Wegafzetting…) — dit is GEEN nieuw datafix-artefact: het is een
    // reeds langer bestaande, orthogonale eigenschap van de harde-pin-taak "Wegafzetting"
    // (constraint.hard MSO) in combinatie met een statusdatum — al aanwezig vóór deze fix (ook
    // in de ONgewijzigde showcase gaf die taak al totalFloat=-1) en volledig losstaand van de P1-
    // detector-fix en de mijlpaal-actualisatie hierboven (met de statusdatum helemaal WEG
    // verdwijnt het volledig — TF=0 overal, headless geverifieerd). Buiten scope van deze golf
    // (raakt de EF-berekening van een voltooide harde-pin-taak, niet de valse-schending-detector
    // of de mijlpaal-uitsluiting die hier gefixed worden); expliciet gemeld i.p.v. stilzwijgend
    // "opgelost" geclaimd.
    statusDay: 70,
  };
}
