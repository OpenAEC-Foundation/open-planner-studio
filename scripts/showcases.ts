// Drie showcase-planningen (woningbouw / infra / renovatie) die SAMEN álle app-functies benutten:
// WBS-hiërarchie, alle vier relatietypes + lags/leads incl. %-lag + ELAPSEDTIME, datumconstraints
// + deadline incl. een bewust conflict (negatieve float), start-/eind-/verplichte mijlpalen,
// activity codes + custom fields, alle vijf resourcetypes incl. ploeg-hiërarchie, resource-
// kalenders, availabilitySteps, toewijzingen met alle zes curves, zichtbare overallocatie (met
// nivellering oplosbaar — levelingDelay wordt NIET voorgebakken) en taak-prioriteiten incl. een
// vastgepinde 1000. Feitelijke datums komen uit de echte runCPM; hier staan alleen werkdag-offsets.
import type { ProjectSpec } from './spec';

// ── Showcase 1 — Woningbouw ─────────────────────────────────────────────────────────────────
// Nieuwbouw woonblok met twee bouwblokken die parallel lopen → zichtbare overallocatie op de
// metselaars en de torenkraan; alle zes resourcecurves; deadline-conflict op de contractuele
// oplevering; vastgepinde kraandemontage (prioriteit 1000).
const WONINGBOUW: ProjectSpec = {
  slug: 'showcase-woonblok-de-hoven',
  name: 'Nieuwbouw Woonblok De Hoven',
  author: 'Hoofduitvoerder',
  company: 'Van der Meer Bouw BV',
  category: 'showcase',
  description: 'Nieuwbouw van twee parallelle woonblokken (48 appartementen) met volledige resourceplanning.',
  publicDescription:
    'Woningbouw-showcase: twee parallelle bouwblokken met WBS, alle vier relatietypes (incl. %-lag en lead), ' +
    'alle vijf resourcetypes met ploeg-hiërarchie, torenkraan met eigen kalender + capaciteitsstappen, alle zes ' +
    'toewijzingscurves, zichtbare overallocatie op metselaars én kraan (oplosbaar met nivellering), een vastgepinde ' +
    'taak (prioriteit 1000) en een contractuele opleverdeadline met negatieve float.',
  tags: ['woningbouw', 'resources', 'overallocatie', 'nivellering', 'mijlpalen', 'constraints', 'activity-codes'],
  codeTypes: [
    { name: 'Bouwblok', values: [
      { code: 'A', description: 'Blok A', color: '#2563eb' },
      { code: 'B', description: 'Blok B', color: '#16a34a' },
      { code: 'ALG', description: 'Algemeen / terrein', color: '#6b7280' },
    ] },
    { name: 'Discipline', values: [
      { code: 'RUW', description: 'Ruwbouw', color: '#b45309' },
      { code: 'INST', description: 'Installaties', color: '#0891b2' },
      { code: 'AFB', description: 'Afbouw', color: '#7c3aed' },
      { code: 'CIV', description: 'Civiel / fundering', color: '#4d7c0f' },
    ] },
  ],
  fields: [
    { name: 'Kostenraming', type: 'cost' },
    { name: 'Verantwoordelijke', type: 'text' },
    { name: 'Kritieke levering', type: 'boolean' },
  ],
  resources: [
    { name: 'Ruwbouwploeg', type: 'CREW', maxUnits: 1, description: 'Overkoepelende ruwbouwploeg' },
    { name: 'Metselaars', type: 'LABOR', maxUnits: 2, costPerHour: 48, parent: 'Ruwbouwploeg' },
    { name: 'Timmerlieden', type: 'LABOR', maxUnits: 2, costPerHour: 46, parent: 'Ruwbouwploeg' },
    { name: 'Afbouwploeg', type: 'LABOR', maxUnits: 3, costPerHour: 44 },
    // Torenkraan: eigen (ma-za) kalender + capaciteitsstappen (2e kraan vanaf werkdag 45).
    { name: 'Torenkraan', type: 'EQUIPMENT', maxUnits: 1, costPerHour: 85,
      calendar: { workDays: [1, 2, 3, 4, 5, 6], name: 'Kraankalender ma-za' },
      steps: [{ fromDay: 0, maxUnits: 1 }, { fromDay: 45, maxUnits: 2 }] },
    { name: 'Beton C30/37', type: 'MATERIAL', maxUnits: 999, unitOfMeasure: 'm³' },
    { name: 'Heibedrijf', type: 'SUBCONTRACTOR', maxUnits: 1 },
    { name: 'Installateur W&E', type: 'SUBCONTRACTOR', maxUnits: 2 },
  ],
  tasks: [
    // 1. Voorbereiding
    { key: 'P1', name: '1. Voorbereiding', taskType: 'LOGISTIC', codes: { Bouwblok: 'ALG' } },
    { key: 'v1', name: 'Bouwplaats inrichten', parent: 'P1', dur: 5, taskType: 'LOGISTIC',
      codes: { Bouwblok: 'ALG' }, fields: { Verantwoordelijke: 'Uitvoerder terrein' } },
    { key: 'v2', name: 'Bouwweg & keten plaatsen', parent: 'P1', dur: 4, taskType: 'LOGISTIC', codes: { Bouwblok: 'ALG' } },
    { key: 'ms_start', name: 'Start bouw', parent: 'P1', milestone: true, milestoneKind: 'START' },
    // 2. Fundering
    { key: 'P2', name: '2. Fundering', taskType: 'CONSTRUCTION', codes: { Discipline: 'CIV' } },
    { key: 'f1', name: 'Ontgraven bouwput', parent: 'P2', dur: 6, taskType: 'CONSTRUCTION', codes: { Discipline: 'CIV' } },
    { key: 'f2', name: 'Heiwerk', parent: 'P2', dur: 8, taskType: 'CONSTRUCTION',
      constraint: { type: 'SNET', offsetDay: 14 }, // mag niet starten vóór de omgevingsvergunning
      codes: { Discipline: 'CIV' }, fields: { 'Kritieke levering': true },
      assign: [{ res: 'Heibedrijf', units: 1 }] },
    { key: 'f3', name: 'Fundering & begane-grondvloer blok A', parent: 'P2', dur: 7, taskType: 'CONSTRUCTION',
      codes: { Bouwblok: 'A', Discipline: 'CIV' }, fields: { Kostenraming: 185000 },
      assign: [{ res: 'Beton C30/37', units: 40, curve: 'FRONT_LOADED' }] },
    { key: 'f4', name: 'Fundering & begane-grondvloer blok B', parent: 'P2', dur: 7, taskType: 'CONSTRUCTION',
      codes: { Bouwblok: 'B', Discipline: 'CIV' },
      assign: [{ res: 'Beton C30/37', units: 40, curve: 'FRONT_LOADED' }] },
    { key: 'ms_fund', name: 'Inspectie fundering', parent: 'P2', milestone: true, milestoneKind: 'FINISH', mandatory: true },
    // 3. Ruwbouw blok A
    { key: 'P3', name: '3. Ruwbouw blok A', taskType: 'CONSTRUCTION', codes: { Bouwblok: 'A', Discipline: 'RUW' } },
    { key: 'a1', name: 'Wanden begane grond A', parent: 'P3', dur: 8, codes: { Bouwblok: 'A', Discipline: 'RUW' },
      assign: [{ res: 'Metselaars', units: 2, curve: 'UNIFORM' }] },
    { key: 'a2', name: 'Verdiepingsvloeren A', parent: 'P3', dur: 6, codes: { Bouwblok: 'A', Discipline: 'RUW' },
      assign: [{ res: 'Torenkraan', units: 1 }, { res: 'Timmerlieden', units: 2 }] },
    { key: 'a3', name: 'Wanden verdieping A', parent: 'P3', dur: 8, codes: { Bouwblok: 'A', Discipline: 'RUW' },
      assign: [{ res: 'Metselaars', units: 2, curve: 'UNIFORM' }] },
    { key: 'a4', name: 'Dakconstructie A', parent: 'P3', dur: 5, codes: { Bouwblok: 'A', Discipline: 'RUW' },
      assign: [{ res: 'Timmerlieden', units: 2 }] },
    // 4. Ruwbouw blok B (parallel aan A → overallocatie op metselaars/kraan)
    { key: 'P4', name: '4. Ruwbouw blok B', taskType: 'CONSTRUCTION', codes: { Bouwblok: 'B', Discipline: 'RUW' } },
    { key: 'b1', name: 'Wanden begane grond B', parent: 'P4', dur: 8, priority: 300, codes: { Bouwblok: 'B', Discipline: 'RUW' },
      assign: [{ res: 'Metselaars', units: 1, curve: 'UNIFORM' }] },
    { key: 'b2', name: 'Verdiepingsvloeren B', parent: 'P4', dur: 6, priority: 300, codes: { Bouwblok: 'B', Discipline: 'RUW' },
      assign: [{ res: 'Torenkraan', units: 1 }] },
    { key: 'b3', name: 'Wanden verdieping B', parent: 'P4', dur: 8, priority: 300, codes: { Bouwblok: 'B', Discipline: 'RUW' },
      assign: [{ res: 'Metselaars', units: 1, curve: 'UNIFORM' }] },
    { key: 'b4', name: 'Dakconstructie B', parent: 'P4', dur: 5, priority: 300, codes: { Bouwblok: 'B', Discipline: 'RUW' },
      assign: [{ res: 'Timmerlieden', units: 1 }] },
    { key: 'ms_hoog', name: 'Hoogste punt', parent: 'P4', milestone: true, milestoneKind: 'FINISH' },
    // 5. Installaties
    { key: 'P5', name: '5. Installaties (MEP)', taskType: 'INSTALLATION', codes: { Discipline: 'INST' } },
    { key: 'i1', name: 'Leidingwerk W-installatie', parent: 'P5', dur: 10, taskType: 'INSTALLATION',
      codes: { Discipline: 'INST' }, assign: [{ res: 'Installateur W&E', units: 1, curve: 'UNIFORM' }] },
    { key: 'i2', name: 'Elektra eerste fix', parent: 'P5', dur: 10, taskType: 'INSTALLATION',
      codes: { Discipline: 'INST' }, assign: [{ res: 'Installateur W&E', units: 1, curve: 'EARLY_PEAK' }] },
    { key: 'i3', name: 'Ventilatie & WTW', parent: 'P5', dur: 8, taskType: 'INSTALLATION',
      constraint: { type: 'ALAP' }, // zo laat mogelijk plannen binnen de vrije speling
      codes: { Discipline: 'INST' } },
    // 6. Afbouw (start SS+%-lag t.o.v. installaties; lead tussen stuc- en tegelwerk)
    { key: 'P6', name: '6. Afbouw', taskType: 'CONSTRUCTION', codes: { Discipline: 'AFB' } },
    { key: 'af1', name: 'Stucwerk', parent: 'P6', dur: 12, codes: { Discipline: 'AFB' },
      assign: [{ res: 'Afbouwploeg', units: 3, curve: 'BELL' }] },
    { key: 'af2', name: 'Tegelwerk & sanitair', parent: 'P6', dur: 10, taskType: 'INSTALLATION', codes: { Discipline: 'AFB' },
      assign: [{ res: 'Afbouwploeg', units: 2, curve: 'BACK_LOADED' }] },
    { key: 'af3', name: 'Keukens & binnendeuren', parent: 'P6', dur: 8, taskType: 'INSTALLATION', codes: { Discipline: 'AFB' } },
    { key: 'af4', name: 'Schilderwerk & opleverklaar', parent: 'P6', dur: 8,
      constraint: { type: 'SNLT', offsetDay: 150 }, // comfortabele bovengrens (geen overtreding)
      codes: { Discipline: 'AFB' }, assign: [{ res: 'Afbouwploeg', units: 2, curve: 'LATE_PEAK' }] },
    // 7. Terrein & oplevering
    { key: 'P7', name: '7. Terrein & oplevering', taskType: 'LOGISTIC', codes: { Bouwblok: 'ALG' } },
    { key: 't1', name: 'Torenkraan demonteren', parent: 'P7', dur: 2, taskType: 'LOGISTIC', priority: 1000,
      description: 'Vastgepind (prioriteit 1000): de kraandemontage is met de onderaannemer vastgezet en mag niet verschuiven.',
      codes: { Bouwblok: 'ALG' }, assign: [{ res: 'Torenkraan', units: 1 }] },
    { key: 't2', name: 'Terreininrichting & bestrating', parent: 'P7', dur: 8, taskType: 'CONSTRUCTION', codes: { Bouwblok: 'ALG' } },
    { key: 'ms_opl', name: 'Contractuele oplevering blok A', parent: 'P7', milestone: true, milestoneKind: 'FINISH',
      mandatory: true, deadlineDay: 123, // BEWUST te krap → negatieve float (contractboete-risico)
      description: 'Contractuele opleverdatum; de deadline ligt bewust vóór de vroegst haalbare datum (negatieve float).' },
    { key: 'o1', name: 'Opleverinspectie & PvO', parent: 'P7', dur: 4, taskType: 'ATTENDANCE', codes: { Bouwblok: 'ALG' } },
    { key: 'ms_end', name: 'Sleuteloverdracht', parent: 'P7', milestone: true, milestoneKind: 'FINISH', mandatory: true },
  ],
  links: [
    { pred: 'v1', succ: 'v2' }, { pred: 'v2', succ: 'ms_start' }, { pred: 'ms_start', succ: 'f1' },
    { pred: 'f1', succ: 'f2' }, { pred: 'f2', succ: 'f3' }, { pred: 'f2', succ: 'f4' },
    { pred: 'f3', succ: 'ms_fund' }, { pred: 'f4', succ: 'ms_fund' },
    { pred: 'ms_fund', succ: 'a1' },
    { pred: 'ms_fund', succ: 'b1', type: 'START_START', lag: 3 }, // blok B parallel → overallocatie
    { pred: 'a1', succ: 'a2' }, { pred: 'a2', succ: 'a3' }, { pred: 'a3', succ: 'a4' },
    { pred: 'b1', succ: 'b2' }, { pred: 'b2', succ: 'b3' }, { pred: 'b3', succ: 'b4' },
    { pred: 'a4', succ: 'ms_hoog' }, { pred: 'b4', succ: 'ms_hoog' },
    { pred: 'ms_hoog', succ: 'i1' },
    { pred: 'i1', succ: 'i2', type: 'START_START', lag: 3 },
    { pred: 'i2', succ: 'i3', type: 'START_START', lag: 3 },
    { pred: 'i1', succ: 'af1', type: 'START_START', lagPercent: 40 }, // afbouw start bij ~40% installaties
    { pred: 'af1', succ: 'af2', lag: -2 }, // lead / fast-track
    { pred: 'af2', succ: 'af3' }, { pred: 'af3', succ: 'af4' },
    { pred: 'i3', succ: 'af4', type: 'FINISH_FINISH', lag: 2 }, // installaties net vóór afbouw gereed
    { pred: 'a4', succ: 't1' }, { pred: 'b4', succ: 't1' },
    { pred: 'af4', succ: 't2' },
    { pred: 't2', succ: 'ms_opl' }, { pred: 'af4', succ: 'ms_opl' },
    { pred: 'ms_opl', succ: 'o1' }, { pred: 'o1', succ: 'ms_end' },
  ],
};

// ── Showcase 2 — Infra ──────────────────────────────────────────────────────────────────────
// Fietstunnel onder een provinciale weg. 6-daagse civiele week; beton uithardt 24/7
// (ELAPSEDTIME-lag); verkeersstremming met een MSO-venster; keuring wapening als verplichte
// mijlpaal; overallocatie op de mobiele kraan.
const INFRA: ProjectSpec = {
  slug: 'showcase-fietstunnel-n225',
  name: 'Aanleg Fietstunnel N225',
  author: 'Projectleider Civiel',
  company: 'GWW Rijnland BV',
  category: 'showcase',
  description: 'Civiele aanleg van een fietstunnel onder de N225, inclusief verkeersfasering en betonwerk.',
  publicDescription:
    'Infra-showcase: fietstunnel met 6-daagse civiele kalender, betonuitharding als ELAPSEDTIME-lag (24/7, ' +
    'loopt door in het weekend), een verplicht MSO-verkeersvenster en een FNLT-constraint, keuring wapening als ' +
    'verplichte mijlpaal, materieel/materiaal/onderaannemer-resources met een asfaltploeg op eigen kalender en ' +
    'zichtbare overallocatie op de mobiele kraan.',
  tags: ['infra', 'civiel', 'elapsedtime', 'constraints', 'verkeersfasering', 'resources'],
  calendar: { workDays: [1, 2, 3, 4, 5, 6], name: 'Civiele kalender ma-za', description: 'GWW: ma-za' },
  codeTypes: [
    { name: 'Werksoort', values: [
      { code: 'GRW', description: 'Grondwerk', color: '#4d7c0f' },
      { code: 'BET', description: 'Betonwerk', color: '#6b7280' },
      { code: 'AFW', description: 'Afwerking & asfalt', color: '#1f2937' },
    ] },
  ],
  fields: [
    { name: 'Vergunningnummer', type: 'text' },
    { name: 'Betonkwaliteit', type: 'text' },
  ],
  resources: [
    { name: 'Civiele ploeg', type: 'CREW', maxUnits: 1 },
    { name: 'Betonvlechters', type: 'LABOR', maxUnits: 3, parent: 'Civiele ploeg', costPerHour: 45 },
    { name: 'Mobiele kraan', type: 'EQUIPMENT', maxUnits: 1, costPerHour: 110 },
    { name: 'Damwandstelling', type: 'EQUIPMENT', maxUnits: 1, costPerHour: 130 },
    { name: 'Beton C35/45', type: 'MATERIAL', maxUnits: 999, unitOfMeasure: 'm³' },
    // Asfaltploeg met eigen (afwijkende) kalender.
    { name: 'Asfaltaannemer', type: 'SUBCONTRACTOR', maxUnits: 1, calendar: { workDays: [1, 2, 3, 4, 5], name: 'Asfaltploeg ma-vr' } },
  ],
  tasks: [
    { key: 'P1', name: '1. Voorbereiding & verkeer', taskType: 'LOGISTIC', codes: { Werksoort: 'GRW' } },
    { key: 'v1', name: 'Bouwterrein & omleiding inrichten', parent: 'P1', dur: 5, taskType: 'LOGISTIC', codes: { Werksoort: 'GRW' } },
    { key: 'ms_start', name: 'Start uitvoering', parent: 'P1', milestone: true, milestoneKind: 'START' },
    { key: 'v2', name: 'Verkeersstremming N225 instellen', parent: 'P1', dur: 3, taskType: 'LOGISTIC',
      constraint: { type: 'MSO', offsetDay: 20 }, // vergund stremmingsvenster: exact op deze dag starten
      fields: { Vergunningnummer: 'OMG-2031-0442' }, codes: { Werksoort: 'GRW' } },
    { key: 'P2', name: '2. Grondwerk & damwand', taskType: 'CONSTRUCTION', codes: { Werksoort: 'GRW' } },
    { key: 'g1', name: 'Damwanden aanbrengen', parent: 'P2', dur: 8, codes: { Werksoort: 'GRW' },
      assign: [{ res: 'Damwandstelling', units: 1 }] },
    { key: 'g2', name: 'Ontgraven tunnelbak', parent: 'P2', dur: 10, codes: { Werksoort: 'GRW' },
      assign: [{ res: 'Mobiele kraan', units: 1, curve: 'FRONT_LOADED' }] },
    { key: 'g3', name: 'Bemaling & werkvloer', parent: 'P2', dur: 6, taskType: 'INSTALLATION', codes: { Werksoort: 'GRW' },
      assign: [{ res: 'Mobiele kraan', units: 1 }] }, // overlapt g2 → overallocatie kraan
    { key: 'P3', name: '3. Betonwerk tunnel', taskType: 'CONSTRUCTION', codes: { Werksoort: 'BET' } },
    { key: 'c1', name: 'Wapening vloer & wanden', parent: 'P3', dur: 9, codes: { Werksoort: 'BET' },
      fields: { Betonkwaliteit: 'C35/45 XC4' }, assign: [{ res: 'Betonvlechters', units: 3, curve: 'UNIFORM' }] },
    { key: 'ms_keur', name: 'Keuring wapening', parent: 'P3', milestone: true, milestoneKind: 'FINISH', mandatory: true },
    { key: 'c2', name: 'Storten tunnelvloer', parent: 'P3', dur: 4, codes: { Werksoort: 'BET' },
      assign: [{ res: 'Beton C35/45', units: 120, curve: 'FRONT_LOADED' }, { res: 'Mobiele kraan', units: 1 }] },
    { key: 'c3', name: 'Storten wanden & dek', parent: 'P3', dur: 6, codes: { Werksoort: 'BET' },
      assign: [{ res: 'Beton C35/45', units: 180, curve: 'BELL' }] },
    { key: 'c4', name: 'Waterdichting & drainage', parent: 'P3', dur: 5, taskType: 'INSTALLATION', codes: { Werksoort: 'BET' } },
    { key: 'P4', name: '4. Afwerking', taskType: 'CONSTRUCTION', codes: { Werksoort: 'AFW' } },
    { key: 'a1', name: 'Aanvullen & baanverharding', parent: 'P4', dur: 7, codes: { Werksoort: 'AFW' },
      assign: [{ res: 'Mobiele kraan', units: 1, curve: 'BACK_LOADED' }] },
    { key: 'a2', name: 'Asfalteren toeritten', parent: 'P4', dur: 4, taskType: 'INSTALLATION',
      constraint: { type: 'FNLT', offsetDay: 120 }, // afwerking vóór einde stremmingsvergunning
      codes: { Werksoort: 'AFW' }, assign: [{ res: 'Asfaltaannemer', units: 1, curve: 'LATE_PEAK' }] },
    { key: 'a3', name: 'Markering & bebording', parent: 'P4', dur: 3, taskType: 'INSTALLATION', codes: { Werksoort: 'AFW' } },
    { key: 'ms_open', name: 'Tunnel opengesteld', parent: 'P4', milestone: true, milestoneKind: 'FINISH', mandatory: true },
  ],
  links: [
    { pred: 'v1', succ: 'ms_start' }, { pred: 'ms_start', succ: 'v2' }, { pred: 'v2', succ: 'g1' },
    { pred: 'g1', succ: 'g2' }, { pred: 'g2', succ: 'g3', type: 'START_START', lag: 4 }, // bemaling overlapt ontgraven
    { pred: 'g3', succ: 'c1' }, { pred: 'c1', succ: 'ms_keur' }, { pred: 'ms_keur', succ: 'c2' },
    // Beton uithardt 24/7: lag in KALENDERDAGEN (loopt door in het weekend).
    { pred: 'c2', succ: 'c3', lag: 5, lagUnit: 'ELAPSEDTIME' },
    { pred: 'c3', succ: 'c4', lag: 3, lagUnit: 'ELAPSEDTIME' },
    { pred: 'c4', succ: 'a1' }, { pred: 'a1', succ: 'a2' }, { pred: 'a2', succ: 'a3' },
    { pred: 'a3', succ: 'ms_open' },
  ],
};

// ── Showcase 3 — Renovatie ──────────────────────────────────────────────────────────────────
// Verduurzaming van een bewoond kantoorpand, gefaseerd per bouwdeel. Tijdelijke huisvesting
// eindigt pas wanneer de sloop start (START_FINISH). Vaste inhuizingsdatum (MFO) + krappe
// huurdeadline (FNLT-conflict → negatieve float). Asbestsanering (onderaannemer), isolatie
// (materiaal), sloopploeg (crew) en hoogwerker (materieel).
const RENOVATIE: ProjectSpec = {
  slug: 'showcase-renovatie-willemskade',
  name: 'Renovatie & Verduurzaming Willemskade',
  author: 'Projectleider Renovatie',
  company: 'Duurzaam Vastgoed Onderhoud BV',
  category: 'showcase',
  description: 'Gefaseerde verduurzaming van een bewoond kantoorpand met tijdelijke huisvesting en een harde inhuizingsdatum.',
  publicDescription:
    'Renovatie-showcase: bewoond kantoorpand met een START_FINISH-relatie (tijdelijke huisvesting eindigt als de ' +
    'sloop start), een MFO-inhuizingsdatum en een krappe FNLT-huurdeadline die negatieve float oplevert, ' +
    'asbestsanering (onderaannemer), isolatie (materiaal), sloopploeg (ploeg-hiërarchie) en hoogwerker (materieel), ' +
    'plus een vastgepinde verhuisdag (prioriteit 1000).',
  tags: ['renovatie', 'verduurzaming', 'start-finish', 'constraints', 'deadline', 'resources'],
  codeTypes: [
    { name: 'Bouwdeel', values: [
      { code: 'GEV', description: 'Gevel & schil', color: '#0891b2' },
      { code: 'INST', description: 'Installaties', color: '#7c3aed' },
      { code: 'INT', description: 'Interieur', color: '#b45309' },
    ] },
  ],
  fields: [
    { name: 'Bewoond tijdens uitvoering', type: 'boolean' },
    { name: 'Besparing (kWh/jr)', type: 'integer' },
  ],
  resources: [
    { name: 'Sloopploeg', type: 'CREW', maxUnits: 1 },
    { name: 'Slopers', type: 'LABOR', maxUnits: 3, parent: 'Sloopploeg', costPerHour: 40 },
    { name: 'Installatiemonteurs', type: 'LABOR', maxUnits: 2, costPerHour: 47 },
    { name: 'Hoogwerker', type: 'EQUIPMENT', maxUnits: 1, costPerHour: 60 },
    { name: 'Gevelisolatie', type: 'MATERIAL', maxUnits: 999, unitOfMeasure: 'm²' },
    { name: 'Asbestsaneerder', type: 'SUBCONTRACTOR', maxUnits: 1 },
  ],
  tasks: [
    { key: 'P1', name: '1. Voorbereiding & uithuizing', taskType: 'LOGISTIC' },
    { key: 'h1', name: 'Tijdelijke huisvesting huren', parent: 'P1', dur: 10, taskType: 'LOGISTIC',
      constraint: { type: 'MFO', offsetDay: 10 }, // huurcontract eindigt op een vaste datum (Must Finish On)
      fields: { 'Bewoond tijdens uitvoering': true } },
    { key: 'h2', name: 'Verhuizing medewerkers', parent: 'P1', dur: 3, taskType: 'MOVE', priority: 1000,
      description: 'Vastgepinde verhuisdag (prioriteit 1000): logistiek met externe verhuizer, mag niet schuiven.' },
    { key: 'ms_start', name: 'Start renovatie', parent: 'P1', milestone: true, milestoneKind: 'START' },
    { key: 't_temp', name: 'Tijdelijke nutsvoorziening handhaven', parent: 'P1', dur: 40, taskType: 'MAINTENANCE',
      description: 'Loopt door tot de nieuwe elektra in bedrijf gaat (START_FINISH-relatie).' },
    { key: 'P2', name: '2. Strip & sanering', taskType: 'DEMOLITION', codes: { Bouwdeel: 'INT' } },
    { key: 's1', name: 'Asbestinventarisatie & sanering', parent: 'P2', dur: 8, taskType: 'DEMOLITION',
      codes: { Bouwdeel: 'INT' }, assign: [{ res: 'Asbestsaneerder', units: 1, curve: 'FRONT_LOADED' }] },
    { key: 's2', name: 'Strippen interieur & plafonds', parent: 'P2', dur: 6, taskType: 'DEMOLITION',
      codes: { Bouwdeel: 'INT' }, assign: [{ res: 'Slopers', units: 3, curve: 'UNIFORM' }] },
    { key: 'ms_san', name: 'Sanering vrijgegeven', parent: 'P2', milestone: true, milestoneKind: 'FINISH', mandatory: true },
    { key: 'P3', name: '3. Gevel & schil', taskType: 'RENOVATION', codes: { Bouwdeel: 'GEV' } },
    { key: 'g1', name: 'Na-isolatie gevel', parent: 'P3', dur: 12, taskType: 'RENOVATION',
      codes: { Bouwdeel: 'GEV' }, fields: { 'Besparing (kWh/jr)': 82000 },
      assign: [{ res: 'Gevelisolatie', units: 60, curve: 'FRONT_LOADED' }, { res: 'Hoogwerker', units: 1, curve: 'UNIFORM' }] },
    { key: 'g2', name: 'HR++ beglazing & kozijnen', parent: 'P3', dur: 10, taskType: 'RENOVATION',
      codes: { Bouwdeel: 'GEV' }, assign: [{ res: 'Hoogwerker', units: 1, curve: 'UNIFORM' }] }, // overlapt g1 (beide UNIFORM units 1) → overallocatie hoogwerker
    { key: 'P4', name: '4. Installaties', taskType: 'INSTALLATION', codes: { Bouwdeel: 'INST' } },
    { key: 'i1', name: 'Warmtepomp & vloerverwarming', parent: 'P4', dur: 12, taskType: 'INSTALLATION',
      codes: { Bouwdeel: 'INST' }, assign: [{ res: 'Installatiemonteurs', units: 2, curve: 'EARLY_PEAK' }] },
    { key: 'i2', name: 'Zonnepanelen & elektra', parent: 'P4', dur: 8, taskType: 'INSTALLATION',
      codes: { Bouwdeel: 'INST' }, assign: [{ res: 'Installatiemonteurs', units: 2, curve: 'LATE_PEAK' }] },
    { key: 'P5', name: '5. Afbouw & oplevering', taskType: 'CONSTRUCTION', codes: { Bouwdeel: 'INT' } },
    { key: 'af1', name: 'Wanden, plafonds & vloeren', parent: 'P5', dur: 12, codes: { Bouwdeel: 'INT' } },
    { key: 'af2', name: 'Schilderwerk & inrichting', parent: 'P5', dur: 8, codes: { Bouwdeel: 'INT' } },
    { key: 'ms_opl', name: 'Oplevering & terugverhuizing', parent: 'P5', milestone: true, milestoneKind: 'FINISH',
      mandatory: true, deadlineDay: 58, // krappe huurdeadline tijdelijke huisvesting → negatieve float
      description: 'De tijdelijke huisvesting moet op deze datum opgezegd zijn; de deadline is krap (negatieve float).' },
  ],
  links: [
    { pred: 'h1', succ: 'h2' }, { pred: 'h2', succ: 'ms_start' },
    // START_FINISH: de tijdelijke nutsvoorziening mag pas "af" als de nieuwe elektra in bedrijf gaat.
    { pred: 'i2', succ: 't_temp', type: 'START_FINISH', lag: 0 },
    { pred: 'ms_start', succ: 's1' }, { pred: 's1', succ: 's2', type: 'START_START', lag: 3 },
    { pred: 's2', succ: 'ms_san' }, { pred: 'ms_san', succ: 'g1' },
    { pred: 'g1', succ: 'g2', type: 'START_START', lagPercent: 50 }, // beglazing bij halve gevelisolatie
    { pred: 'ms_san', succ: 'i1' }, { pred: 'i1', succ: 'i2', lag: -3 }, // lead
    { pred: 'g2', succ: 'af1' }, { pred: 'i2', succ: 'af1', type: 'FINISH_FINISH', lag: 3 },
    { pred: 'af1', succ: 'af2' }, { pred: 'af2', succ: 'ms_opl' },
  ],
};

export const SHOWCASES: ProjectSpec[] = [WONINGBOUW, INFRA, RENOVATIE];
