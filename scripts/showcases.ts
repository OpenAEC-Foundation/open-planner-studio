// Twee showcase-planningen — schaalvarianten binnen woningbouw (klein/middel) — die SAMEN de
// suite-brede unie van app-functies dragen die KLEIN+MIDDEL redelijkerwijs kunnen dragen (zie
// verify-examples.ts voor de precieze verdeling + de golf-2-TODO voor wat naar GROOT verhuist).
// Vervangt (fase 2.10, onderdeel 4, golf 1) de drie sector-showcases (woningbouw/infra/renovatie)
// — sector-diversiteit blijft gedekt door de 20 basisvoorbeelden, schaal-diversiteit is nu het
// showcase-thema (bindend architect-besluit, zie
// docs/superpowers/specs/2026-07-07-2.10-onderdeel4-showcases-design.md).
//
// GOLF 2 voegt een derde showcase toe (GROOT, ~250 taken) die de resterende, architecturaal
// zwaardere functies draagt: hard pin (constraint.hard), secundaire constraint (constraint2),
// hammock, near-critical + float paths, uren-planning (WorkTimeBands), externe koppeling
// (cross-project), tweede baseline/rebaseline, en de resttypen resources/curves/relaties die
// KLEIN+MIDDEL niet dragen (EQUIPMENT/SUBCONTRACTOR, BELL/EARLY_PEAK/LATE_PEAK-curves,
// ELAPSEDTIME-lag, %-lag, lead, START_FINISH-relatie, prioriteit-1000-pin). Zie de TODO-lijst
// bovenaan `verify-examples.ts`.
import type { ProjectSpec, TaskSpec, LinkSpec } from './spec';

// ── Showcase 1 — KLEIN: verbouwing eengezinswoning (~20 taken) ─────────────────────────────
// Instapniveau: taken + relaties (incl. 1 SS + 1 FF) + mijlpalen + kalender + 1 baseline. Bewust
// GEEN resources/activity codes (zie spec §3.1) — dit is de kern-workflow voor een nieuwe
// gebruiker, geen "kitchen sink". Eén comfortabele deadline (géén conflict) — bewust contrast met
// MIDDEL, die wél een deadline-conflict (negatieve float) toont.
const KLEIN: ProjectSpec = {
  slug: 'showcase-verbouwing-eengezinswoning',
  name: 'Verbouwing & Aanbouw Eengezinswoning',
  author: 'Aannemer',
  company: 'Bouwbedrijf Van Dijk BV',
  category: 'showcase',
  description: 'Aanbouw + inpandige verbouwing van een eengezinswoning — instapniveau-planning.',
  publicDescription:
    'Instap-showcase: aanbouw van een eengezinswoning met WBS-fasering, een FS-keten mét één ' +
    'SS-overlap (wanden/dak) en één FF-koppeling (schilderwerk vlak na tegelwerk), een ' +
    'SNET-vergunningconstraint, start-/verplichte-oplevermijlpaal, een comfortabele deadline ' +
    '(geen conflict) en één baseline direct na opzet.',
  tags: ['woningbouw', 'klein', 'instap', 'mijlpalen', 'constraints', 'baseline'],
  tasks: [
    // 1. Voorbereiding
    { key: 'ms_start', name: 'Start verbouwing', milestone: true, milestoneKind: 'START' },
    { key: 'P1', name: '1. Voorbereiding', taskType: 'LOGISTIC' },
    { key: 'v1', name: 'Bouwplaats inrichten', parent: 'P1', dur: 2, taskType: 'LOGISTIC' },
    { key: 'v2', name: 'Sloop bestaande aanbouw', parent: 'P1', dur: 3, taskType: 'DEMOLITION',
      constraint: { type: 'SNET', offsetDay: 6 } }, // mag niet starten vóór de omgevingsvergunning
    // 2. Fundering & ruwbouw
    { key: 'P2', name: '2. Fundering & ruwbouw', taskType: 'CONSTRUCTION' },
    { key: 'f1', name: 'Grondwerk aanbouw', parent: 'P2', dur: 3, taskType: 'CONSTRUCTION' },
    { key: 'f2', name: 'Fundering aanbouw', parent: 'P2', dur: 4, taskType: 'CONSTRUCTION' },
    { key: 'f3', name: 'Begane grondvloer storten', parent: 'P2', dur: 3, taskType: 'CONSTRUCTION' },
    { key: 'f4', name: 'Wanden opmetselen', parent: 'P2', dur: 6, taskType: 'CONSTRUCTION' },
    { key: 'f5', name: 'Dakconstructie plaatsen', parent: 'P2', dur: 4, taskType: 'CONSTRUCTION' },
    // 3. Afbouw
    { key: 'P3', name: '3. Afbouw', taskType: 'CONSTRUCTION' },
    { key: 'a1', name: 'Dakbedekking aanbrengen', parent: 'P3', dur: 3, taskType: 'CONSTRUCTION' },
    { key: 'a2', name: 'Kozijnen plaatsen', parent: 'P3', dur: 4, taskType: 'INSTALLATION' },
    { key: 'a3', name: 'Stucwerk', parent: 'P3', dur: 5, taskType: 'CONSTRUCTION' },
    { key: 'a4', name: 'Tegelwerk', parent: 'P3', dur: 4, taskType: 'INSTALLATION' },
    { key: 'a5', name: 'Schilderwerk', parent: 'P3', dur: 3, taskType: 'CONSTRUCTION' },
    // 4. Oplevering
    { key: 'P4', name: '4. Oplevering', taskType: 'ATTENDANCE' },
    { key: 'o1', name: 'Eindschoonmaak', parent: 'P4', dur: 1, taskType: 'LOGISTIC' },
    { key: 'ms_opl', name: 'Opleveringsinspectie', parent: 'P4', milestone: true, milestoneKind: 'FINISH',
      mandatory: true, deadlineDay: 60, // comfortabele deadline — bewust GEEN conflict (contrast met MIDDEL)
      description: 'Verplichte opleveringsinspectie; de deadline heeft ruime marge (geen conflict).' },
    { key: 'o2', name: 'Eindoplevering met bewoner', parent: 'P4', dur: 1, taskType: 'ATTENDANCE' },
  ],
  links: [
    { pred: 'ms_start', succ: 'v1' }, { pred: 'v1', succ: 'v2' }, { pred: 'v2', succ: 'f1' },
    { pred: 'f1', succ: 'f2' }, { pred: 'f2', succ: 'f3' }, { pred: 'f3', succ: 'f4' },
    { pred: 'f4', succ: 'f5', type: 'START_START', lag: 2 }, // lichte overlap wanden/dak
    { pred: 'f5', succ: 'a1' }, { pred: 'a1', succ: 'a2' }, { pred: 'a2', succ: 'a3' },
    { pred: 'a3', succ: 'a4' }, { pred: 'a3', succ: 'a5' },
    { pred: 'a4', succ: 'a5', type: 'FINISH_FINISH', lag: 1 }, // schilderwerk gereed vlak na tegelwerk
    { pred: 'a5', succ: 'o1' }, { pred: 'o1', succ: 'ms_opl' }, { pred: 'ms_opl', succ: 'o2' },
  ],
  baselines: [{ name: 'Basisplanning' }],
};

// ── Showcase 2 — MIDDEL: 6 grondgebonden rijwoningen (~80 taken) ───────────────────────────
// Genoeg herhaling om repeterende structuur + resources + voortgang te tonen: gedeelde fundering
// met vorstverlet (extraHolidays), ruwbouw per woning met een doorschuivende metselploeg
// (CREW+LABOR), installaties op een 4-daagse resource-kalender, afbouw met curve-variatie en
// zichtbare (met nivellering oplosbare) overallocatie op de stukadoors, per-woning verplichte
// opleverinspecties + een BEWUST te krappe contractdeadline (negatieve float), activity codes
// Woning×Discipline, voortgang+statusdatum halverwege, en een baseline vóór start. Bewust GEEN
// EQUIPMENT/SUBCONTRACTOR-resources, GEEN %-lag/ELAPSEDTIME/lead/START_FINISH, GEEN volledige
// curve-set (BELL/EARLY_PEAK/LATE_PEAK) — die landen in GOLF 2 (GROOT), zie de TODO in
// verify-examples.ts.
const HOUSES = [1, 2, 3, 4, 5, 6];
const middelTasks: TaskSpec[] = [];
const middelLinks: LinkSpec[] = [];

// 1. Terreininrichting
middelTasks.push(
  // Fase 2.10 (P1-datafix): mijlpaal geactualiseerd (was completion=0, terwijl de opvolger 't0'
  // al lang actuals had) — anders een out-of-sequence-melding + een door de data-date-vloer
  // gevloerde ES die als fantoom-negatieve float door de hele (allang voltooide) startketen
  // propageert (zelfde patroon als GROOT, zie showcase-groot.ts).
  { key: 'ms_start', name: 'Start bouw', milestone: true, milestoneKind: 'START', codes: { Woning: 'ALG' },
    completion: 1, actualStartDay: 0, actualFinishDay: 0 },
  { key: 'P1', name: '1. Terreininrichting', taskType: 'LOGISTIC', codes: { Woning: 'ALG' } },
  { key: 't0', name: 'Bouwbord & veiligheidshek plaatsen', parent: 'P1', dur: 1, taskType: 'LOGISTIC',
    codes: { Woning: 'ALG' },
    completion: 1, actualStartDay: 0, actualFinishDay: 1 },
  { key: 't1', name: 'Bouwweg aanleggen', parent: 'P1', dur: 3, taskType: 'LOGISTIC',
    codes: { Woning: 'ALG' },
    completion: 1, actualStartDay: 1, actualFinishDay: 4 },
  { key: 't2', name: 'Bouwketen plaatsen', parent: 'P1', dur: 2, taskType: 'LOGISTIC',
    codes: { Woning: 'ALG' },
    completion: 1, actualStartDay: 4, actualFinishDay: 6 },
  { key: 't3', name: 'Nutsaansluitingen aanleggen', parent: 'P1', dur: 3, taskType: 'LOGISTIC',
    priority: 1000, // vastgepind: vaste aansluitdatum van het nutsbedrijf, mag niet verschuiven
    description: 'Vastgepind (prioriteit 1000): de aansluitdatum ligt vast bij het nutsbedrijf en mag niet schuiven.',
    codes: { Woning: 'ALG' },
    completion: 1, actualStartDay: 6, actualFinishDay: 9 },
);
middelLinks.push(
  { pred: 'ms_start', succ: 't0' }, { pred: 't0', succ: 't1' }, { pred: 't1', succ: 't2' }, { pred: 't2', succ: 't3' },
);

// 2. Fundering (gedeeld, met vorstverlet)
middelTasks.push(
  { key: 'P2', name: '2. Fundering (gedeeld)', taskType: 'CONSTRUCTION', codes: { Woning: 'ALG' } },
  { key: 'f1', name: 'Grondwerk bouwput', parent: 'P2', dur: 5, taskType: 'CONSTRUCTION',
    codes: { Woning: 'ALG' },
    completion: 1, actualStartDay: 9, actualFinishDay: 14 },
  { key: 'f2', name: 'Funderingsbalken storten', parent: 'P2', dur: 5, taskType: 'CONSTRUCTION',
    codes: { Woning: 'ALG' }, fields: { Kostenraming: 95000 },
    assign: [{ res: 'Beton C20/25', units: 60, curve: 'FRONT_LOADED' }],
    completion: 1, actualStartDay: 14, actualFinishDay: 20 },
  // Fase 2.10 (QA-bevinding): actuals kloppend gemaakt met de ELAPSEDTIME-lag hierbeneden (3
  // KALENDERdagen ná f2's actualFinish 2027-03-29 = 2027-04-01 → offsetDay 23, niet 20 — de
  // oorspronkelijke [20,24] liet f3 op dezelfde dag starten als f2 eindigde, terwijl beton 24/7
  // (dus ook in het weekend) uithardt en de relatie dat expliciet in kalenderdagen afdwingt).
  { key: 'f3', name: 'Begane grondvloer storten', parent: 'P2', dur: 4, taskType: 'CONSTRUCTION',
    codes: { Woning: 'ALG' },
    assign: [{ res: 'Beton C20/25', units: 50, curve: 'FRONT_LOADED' }],
    completion: 1, actualStartDay: 23, actualFinishDay: 27 },
  // Fase 2.10 (P1-datafix): mijlpaal geactualiseerd op f3's (nu kloppende) actualFinish — was
  // completion=0 terwijl de opvolger 'r1_mg' allang actuals had (out-of-sequence).
  { key: 'ms_fund', name: 'Inspectie fundering', parent: 'P2', milestone: true, milestoneKind: 'FINISH',
    mandatory: true, codes: { Woning: 'ALG' },
    completion: 1, actualStartDay: 27, actualFinishDay: 27 },
);
middelLinks.push(
  { pred: 't3', succ: 'f1' }, { pred: 'f1', succ: 'f2' },
  // Beton uithardt 24/7 (loopt door in het weekend) — lag in KALENDERdagen.
  { pred: 'f2', succ: 'f3', lag: 3, lagUnit: 'ELAPSEDTIME' },
  { pred: 'f3', succ: 'ms_fund' },
);

// 3. Ruwbouw per woning (doorschuivende metselploeg: mg-taak van woning i → woning i+1)
middelTasks.push({ key: 'P3', name: '3. Ruwbouw per woning', taskType: 'CONSTRUCTION', codes: { Discipline: 'RUW' } });
// Voortgang: woning 1-3 volledig gereed, woning 4 in uitvoering (mg gereed, vl halverwege), 5-6 nog niet gestart.
// Fase 2.10 (QA-bevinding): alle dagwaarden +3 t.o.v. de oorspronkelijke tabel — ms_fund (de
// voorganger van r1_mg) schoof door de ELAPSEDTIME-fix (zie f3 hierboven) 3 dagen op (naar 27),
// dus schuift de hele daarop volgende ruwbouwketen mee (een zuivere translatie: elke duur/diff
// blijft gelijk, dus de onderlinge volgorde/afstand — incl. de doorschuivende metselploeg tussen
// woningen — blijft exact intact).
const RUWBOUW_PROGRESS: Record<number, { mg?: [number, number]; vl?: [number, number] | number; mv?: [number, number]; kap?: [number, number] }> = {
  1: { mg: [27, 33], vl: [33, 37], mv: [37, 43], kap: [43, 48] },
  2: { mg: [33, 39], vl: [39, 43], mv: [43, 49], kap: [49, 54] },
  3: { mg: [39, 45], vl: [45, 49], mv: [49, 55], kap: [55, 58] },
  4: { mg: [45, 51], vl: 51 }, // vl: alleen actualStartDay (51) — completion hieronder apart gezet
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
    { key: `r${i}_mg`, name: `Metselwerk begane grond — Woning ${i}`, parent: 'P3', dur: 6, taskType: 'CONSTRUCTION',
      codes: { Woning: String(i), Discipline: 'RUW' }, assign: [{ res: 'Metselaars', units: 2 }], ...mgProg },
    { key: `r${i}_vl`, name: `Verdiepingsvloer — Woning ${i}`, parent: 'P3', dur: 4, taskType: 'CONSTRUCTION',
      codes: { Woning: String(i), Discipline: 'RUW' },
      ...(i === 4
        ? { notes: [
            { text: 'Wapeningstekening controleren met constructeur', done: false },
            { text: 'Bekisting gecontroleerd door uitvoerder', done: true },
          ] }
        : {}),
      ...vlProg },
    { key: `r${i}_mv`, name: `Metselwerk verdieping — Woning ${i}`, parent: 'P3', dur: 6, taskType: 'CONSTRUCTION',
      codes: { Woning: String(i), Discipline: 'RUW' }, assign: [{ res: 'Metselaars', units: 2 }], ...mvProg },
    { key: `r${i}_kap`, name: `Kapconstructie — Woning ${i}`, parent: 'P3', dur: 5, taskType: 'CONSTRUCTION',
      codes: { Woning: String(i), Discipline: 'RUW' }, assign: [{ res: 'Timmerlieden', units: 2 }], ...kapProg },
  );
  middelLinks.push(
    { pred: `r${i}_mg`, succ: `r${i}_vl` }, { pred: `r${i}_vl`, succ: `r${i}_mv` }, { pred: `r${i}_mv`, succ: `r${i}_kap` },
  );
  if (i > 1) middelLinks.push({ pred: `r${i - 1}_mg`, succ: `r${i}_mg` }); // metselploeg schuift door naar de volgende woning
}
middelTasks.push({ key: 'ms_hoog', name: 'Hoogste punt bereikt', parent: 'P3', milestone: true, milestoneKind: 'FINISH', codes: { Woning: 'ALG', Discipline: 'RUW' } });
middelLinks.push({ pred: 'ms_fund', succ: 'r1_mg' });
for (const i of HOUSES) middelLinks.push({ pred: `r${i}_kap`, succ: 'ms_hoog' });

// 4. Installaties per woning (resource-kalender: 4-daagse werkweek op de installateurs)
middelTasks.push({ key: 'P4', name: '4. Installaties', taskType: 'INSTALLATION', codes: { Discipline: 'INST' } });
for (const i of HOUSES) {
  middelTasks.push(
    { key: `in${i}_lg`, name: `Loodgieterswerk — Woning ${i}`, parent: 'P4', dur: 3, taskType: 'INSTALLATION',
      codes: { Woning: String(i), Discipline: 'INST' }, assign: [{ res: 'Installateurs', units: 1 }],
      ...(i === 3 ? { notes: [{ text: 'Materiaallevering leidingwerk bevestigen bij leverancier', done: false }] } : {}) },
    { key: `in${i}_el`, name: `Elektra — Woning ${i}`, parent: 'P4', dur: 3, taskType: 'INSTALLATION',
      codes: { Woning: String(i), Discipline: 'INST' }, assign: [{ res: 'Installateurs', units: 1 }] },
    { key: `in${i}_ins`, name: `Opleverkeuring installaties — Woning ${i}`, parent: 'P4', dur: 1, taskType: 'ATTENDANCE',
      codes: { Woning: String(i), Discipline: 'INST' } },
  );
  middelLinks.push(
    { pred: `r${i}_kap`, succ: `in${i}_lg` }, { pred: `in${i}_lg`, succ: `in${i}_el` },
    // Woning 1: lead (negatieve lag) — de opleverkeuring start al vóór elektra volledig gereed is.
    i === 1
      ? { pred: `in${i}_el`, succ: `in${i}_ins`, lag: -1 }
      : { pred: `in${i}_el`, succ: `in${i}_ins` },
  );
}

// 5. Afbouw per woning (curve-variatie + bewuste overallocatie op de stukadoors)
middelTasks.push({ key: 'P5', name: '5. Afbouw', taskType: 'CONSTRUCTION', codes: { Discipline: 'AFB' } });
// Fase 2.10 (QA-bevinding): Stukadoors draagt bewust GEEN curve-variatie meer (alleen UNIFORM) —
// FRONT_LOADED/BACK_LOADED concentreren bij een lage pool (maxUnits 2, units 2) de piekvraag van
// een ENKELE woning al boven de pool (bv. FRONT_LOADED op 5 dagen piekt naar ~3,3 eenheden) —
// dat is een intrinsiek-onoplosbare overrun (géén nivelleringsprobleem, een curve/capaciteit-
// mismatch) die de bedoelde ENE overallocatie (de af1/af2-overlap hieronder) zou verdringen.
// De curve-variatie (FRONT_LOADED/BACK_LOADED, naast UNIFORM) blijft gedekt via Schilderwerk
// hieronder + de FRONT_LOADED-toewijzingen op de funderingsstort (f2/f3, zie hierboven).
const SCHIL_CURVE: Record<number, 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED'> = {
  1: 'BACK_LOADED', 2: 'FRONT_LOADED', 3: 'UNIFORM', 4: 'BACK_LOADED', 5: 'FRONT_LOADED', 6: 'UNIFORM',
};
for (const i of HOUSES) {
  middelTasks.push(
    { key: `af${i}_stuc`, name: `Stucwerk — Woning ${i}`, parent: 'P5', dur: 5, codes: { Woning: String(i), Discipline: 'AFB' },
      assign: [{ res: 'Stukadoors', units: 2, curve: 'UNIFORM' }],
      ...(i === 2 ? { notes: [{ text: 'Vochtmeting muren uitgevoerd', done: true }] } : {}) },
    // Fase 2.10 (QA-advies): consistentie met KLEIN/GROOT (beide dragen een Tegelwerk-stap).
    // Bewust GEEN resource-toewijzing — zelfde patroon als KLEIN se 'a4' (Tegelwerk): puur
    // structurele consistentie, geen extra resource-last die de bedoeld-ENIGE overallocatie
    // (stukadoors, zie hieronder) zou kunnen verstoren.
    { key: `af${i}_tegel`, name: `Tegelwerk — Woning ${i}`, parent: 'P5', dur: 3, taskType: 'INSTALLATION',
      codes: { Woning: String(i), Discipline: 'AFB' } },
    { key: `af${i}_san`, name: `Sanitair plaatsen — Woning ${i}`, parent: 'P5', dur: 3, taskType: 'INSTALLATION',
      codes: { Woning: String(i), Discipline: 'AFB' } },
    { key: `af${i}_schil`, name: `Schilderwerk — Woning ${i}`, parent: 'P5', dur: 4, codes: { Woning: String(i), Discipline: 'AFB' },
      assign: [{ res: 'Schilders', units: 2, curve: SCHIL_CURVE[i] }] },
  );
  middelLinks.push(
    { pred: `in${i}_ins`, succ: `af${i}_stuc` }, { pred: `af${i}_stuc`, succ: `af${i}_tegel` },
    { pred: `af${i}_tegel`, succ: `af${i}_san` },
    // Woning 1: %-lag — schilderwerk start al bij 40% van het sanitairwerk (SS + lagPercent).
    i === 1
      ? { pred: `af${i}_san`, succ: `af${i}_schil`, type: 'START_START', lagPercent: 40 }
      : { pred: `af${i}_san`, succ: `af${i}_schil` },
  );
}
// Twee woningen willen kort na elkaar dezelfde stucadoorsploeg (bewust geforceerde overlap →
// zichtbare, met nivellering oplosbare overallocatie: 2×2 eenheden > maxUnits 2).
middelLinks.push({ pred: 'af1_stuc', succ: 'af2_stuc', type: 'START_START', lag: 0 });

// 6. Oplevering (per-woning verplichte inspectie + bewust te krappe contractdeadline)
middelTasks.push({ key: 'P6', name: '6. Oplevering', taskType: 'ATTENDANCE', codes: { Woning: 'ALG' } });
for (const i of HOUSES) {
  middelTasks.push({ key: `opl${i}`, name: `Opleverinspectie — Woning ${i}`, parent: 'P6', milestone: true,
    milestoneKind: 'FINISH', mandatory: true, codes: { Woning: String(i) } });
  middelLinks.push({ pred: `af${i}_schil`, succ: `opl${i}` }, { pred: `af${i}_san`, succ: `opl${i}` });
}
middelTasks.push({ key: 'ms_contract', name: 'Contractuele oplevering project', parent: 'P6', milestone: true,
  milestoneKind: 'FINISH', mandatory: true, deadlineDay: 98, // BEWUST te krap → negatieve float
  codes: { Woning: 'ALG' },
  description: 'Contractuele einddatum met de opdrachtgever; de deadline ligt bewust vóór de vroegst haalbare datum (negatieve float).' });
for (const i of HOUSES) middelLinks.push({ pred: `opl${i}`, succ: 'ms_contract' });

const MIDDEL: ProjectSpec = {
  slug: 'showcase-rijwoningen-de-akkers',
  name: 'Nieuwbouw 6 Rijwoningen De Akkers',
  author: 'Uitvoerder',
  company: 'Van der Meer Bouw BV',
  category: 'showcase',
  description: 'Nieuwbouw van een blok van 6 identieke rijwoningen — repeterende structuur, resources en voortgangsrapportage.',
  publicDescription:
    'Middelgrote showcase: 6 rijwoningen met gedeelde fundering (vorstverlet via extraHolidays), ' +
    'een doorschuivende metselploeg (CREW+LABOR) per woning, installateurs op een 4-daagse ' +
    'resource-kalender, afbouw met curve-variatie (UNIFORM/FRONT_LOADED/BACK_LOADED) en zichtbare ' +
    'overallocatie op de stukadoors, per-woning verplichte opleverinspecties + een bewust te ' +
    'krappe contractdeadline (negatieve float), activity codes Woning×Discipline, aantekeningen ' +
    '(open + afgevinkt), voortgang + statusdatum halverwege, en een baseline vóór start.',
  tags: ['woningbouw', 'middel', 'resources', 'overallocatie', 'voortgang', 'baseline', 'activity-codes', 'aantekeningen'],
  calendar: {
    extraHolidays: [{ name: 'Vorstverlet fundering', fromDay: 16, calendarDays: 6 }],
  },
  codeTypes: [
    { name: 'Woning', values: [
      { code: '1', description: 'Woning 1' }, { code: '2', description: 'Woning 2' },
      { code: '3', description: 'Woning 3' }, { code: '4', description: 'Woning 4' },
      { code: '5', description: 'Woning 5' }, { code: '6', description: 'Woning 6' },
      { code: 'ALG', description: 'Algemeen / terrein', color: '#6b7280' },
    ] },
    { name: 'Discipline', values: [
      { code: 'RUW', description: 'Ruwbouw', color: '#b45309' },
      { code: 'INST', description: 'Installaties', color: '#0891b2' },
      { code: 'AFB', description: 'Afbouw', color: '#7c3aed' },
    ] },
  ],
  fields: [{ name: 'Kostenraming', type: 'cost' }],
  resources: [
    // Fase 2.10 (QA-bevinding): draagt nu ook de resource-kalender-demo (was op Installateurs,
    // zie aldaar) — Metselploeg zelf krijgt NOOIT een toewijzing (alleen het kind 'Metselaars'
    // doet dat), dus deze kalender kan de belasting/overallocatie-berekening per definitie nooit
    // raken (geen assignment ⇒ geen load-bucket ⇒ nooit in `overallocatedDays`) — een risicoloze
    // plek voor de "resource-kalender aanwezig"-dekking, puur decoratief op de ploeg-hiërarchie.
    { name: 'Metselploeg', type: 'CREW', maxUnits: 1, description: 'Overkoepelende metselploeg (schuift door per woning)',
      calendar: { workDays: [1, 2, 3, 4], name: 'Metselploeg 4-daagse week', description: 'Ma-do' } },
    // Fase 2.10 (QA-bevinding): 3 → 6. In de korte overgangsvensters tussen woningen (metselwerk-
    // verdieping van woning i loopt nog terwijl metselwerk-begane-grond van woning i+1 én i+2 kort
    // overlappen) piekt de vraag tot 3 taken × 2 man = 6 — en dit venster valt op reeds VOLTOOIDE
    // (geregistreerde) actuals, dus GEEN nivelleringsprobleem (feiten kunnen niet meer verschuiven)
    // — de tekst belooft precies ÉÉN bedoelde (wél oplosbare) overallocatie, de stukadoors
    // hieronder, dus deze wordt volledig via capaciteit weggenomen i.p.v. fasering (die zou de
    // doorschuivende-metselploeg-demonstratie zelf verstoren).
    { name: 'Metselaars', type: 'LABOR', maxUnits: 6, costPerHour: 46, parent: 'Metselploeg' },
    { name: 'Timmerlieden', type: 'LABOR', maxUnits: 2, costPerHour: 45 },
    // Fase 2.10 (QA-bevinding): 2 → 4 (en de 4-daagse resource-kalender eraf, zie Metselploeg
    // hierboven — bij een strak-opeenvolgende installatieketen (lg→el, 3+3 dagen, bijna geen
    // speling) gaf die kalender een bijna-onvermijdbare vrijdag-capaciteit=0-mismatch zodra een
    // taak over een vrijdag heen liep, los van elke hoeveelheidsoverweging — buiten de
    // gesanctioneerde solver-scope om via de nivelleerder op te lossen). Zonder de kalender lost
    // de capaciteitsverhoging de resterende (zuiver hoeveelheids-)overlap tussen woningen wél op.
    { name: 'Installateurs', type: 'LABOR', maxUnits: 4, costPerHour: 48 },
    // Stukadoors: BEWUST ONGEWIJZIGD (maxUnits 2) — dit is de ENE bedoelde overallocatie (de
    // geforceerde af1_stuc/af2_stuc-overlap hieronder, 2×2 eenheden > pool 2), aantoonbaar volledig
    // opgelost door de echte leveler (zie golf-4-verificatie).
    { name: 'Stukadoors', type: 'LABOR', maxUnits: 2, costPerHour: 42 },
    // Fase 2.10 (QA-bevinding): 2 → 8 — het schilderwerk draagt bewust FRONT_LOADED/BACK_LOADED
    // curve-variatie (units 2, dur 4): die concentreert de piekvraag van ÉÉN woning alleen al tot
    // ~3,3 eenheden (largest-remainder-afgerond), en twee opeenvolgende woningen met
    // TEGENGESTELDE curves (BACK_LOADED gevolgd door FRONT_LOADED) kunnen elkaars piek precies
    // overlappen (~3,3+3,3 ≈ 6,7) — een pool tot en met 6 gaf dus nog steeds een intrinsiek-
    // onoplosbare overrun (curve/capaciteit-mismatch, geen nivelleringsprobleem). Bij 8 past het
    // dubbele-piek-worstcase ruim, blijft de curve-variatie zichtbaar én is er geen
    // restoverallocatie buiten de bedoelde stukadoors-overlap.
    { name: 'Schilders', type: 'LABOR', maxUnits: 8, costPerHour: 38 },
    { name: 'Beton C20/25', type: 'MATERIAL', maxUnits: 999, unitOfMeasure: 'm³' },
  ],
  tasks: middelTasks,
  links: middelLinks,
  // Fase 2.10 (QA-bevinding): +3 t.o.v. de oorspronkelijke 55 — meeschuivend met de
  // ELAPSEDTIME-fix + de daaruit volgende +3-translatie van de ruwbouwketen (zie hierboven);
  // dezelfde relatieve positie t.o.v. "woning 4 in uitvoering" blijft behouden.
  statusDay: 58,
  baselines: [{ name: 'Baseline start' }],
};

export const SHOWCASES: ProjectSpec[] = [KLEIN, MIDDEL];
