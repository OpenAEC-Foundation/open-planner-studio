// Tutorialproject *Aanbouw woning* / *House extension* — de kern van de generator (zonder
// side-effects). Bouwt het doorlopende project van de zeven tutorials (ontwerp
// `docs/superpowers/specs/2026-09-28-gebruikersdocumentatie-diataxis-design.md`, §3.1 en §5) stap
// voor stap op via de ECHTE store-acties en de ECHTE motor, precies in de volgorde waarin een lezer
// het in de app doet, en legt na elke tutorial een tussenstand vast als IFC (de echte `writeIFC`).
//
//   stand          = wat een lezer heeft NA die tutorial (stand N+1 = stand N + stappen van N+1)
//   start-tut-1    leeg project met alleen projectinfo (wizard "Nieuw project", standaardkalender)
//   na-tut-1       WBS (4 fasen), 20 taken met duur, start- en opleveringsmijlpaal, inspectie
//   na-tut-2       + relaties (FS, twee met lag), berekend
//   tussen-tut-3-bouwvak  na-tut-2 + bouwvak in de projectkalender, berekend
//   na-tut-3       + bouwvak in de projectkalender, één constraint (SNET), één deadline
//   na-tut-4       + urenplanning aan; stort, kanaalplaatvloer en dakelementen in uren
//   tussen-tut-5-resources   na-tut-4 + de vijf resources (nog niets toegewezen)
//   tussen-tut-5-toegewezen  + alle toewijzingen, berekend
//   tussen-tut-5-werkregel   + werkregel "Vast werk" op het stucwerk met 2 stukadoors, berekend
//                            (overbezet, vóór het nivelleren)
//   na-tut-5       + resources, toewijzingen, werkregel "Vast werk" op het stucwerk, genivelleerd
//   na-tut-6       + basisplanning (baseline), statusdatum en voortgang
//   na-tut-7       = na-tut-6 (tutorial 7 maakt een rapport; dat is geen projectdata)
//
// Waarom zo en niet declaratief via `gen-core.ts`: gen-core bouwt een project in één keer op. Een
// tutorial heeft TUSSENSTANDEN nodig die exact de handelingen van de lezer volgen (wizard →
// taken → relaties → kalenderdialoog → …), dus hier roepen we dezelfde store-acties aan die de
// dialogen en het raster aanroepen, in de volgorde van de tutorials. Na elke berekenings-
// relevante stap draait `runCPM()` zoals de knop Berekenen (F5) — planning is handmatig, niet
// reactief (CLAUDE.md).
//
// Vast jaar, geen relatief anker: de tutorialtekst noemt letterlijke datums, dus het project
// ligt vast op 2027 (start maandag 7 juni 2027). De feestdagen komen uit de échte
// feestdagengenerator van de app (`buildGeneratedCalendar`/`materializeHolidays`, zelfde route
// als de wizard en de kalenderdialoog); de bouwvak is regio Midden 2027 (2 t/m 20 augustus, uit
// de bouwvaktabel `NL_BOUWVAK`), die midden in de afbouw valt.
//
// ── DE GETALLEN PER STAND (voor de tutorialtekst) ──────────────────────────────────────────────
// `tests/planning/check-tutorial-project.ts` pint ze (plus per taak vroege start/einde en speling),
// zodat een motorwijziging die ze verandert rood wordt. Wijzig je ze bewust: pin, dit blok en de
// tutorialtekst samen. Datums zijn vroege datums; "wd" = werkdagen; kritiek = totale speling 0.
// `npm run gen:tutorial-project -- --report` drukt de volledige tabel per stand af.
//
//   start-tut-1  geen taken. Kalender "Bouwkalender NL": NL-feestdagen 2026–2030, geen bouwvak.
//   na-tut-1     zonder relaties begint alles op ma 7 jun; laatste einde ma 14 jun (Buitenspouwblad
//                metselen, 6 wd — de enige kritieke taak). Oplevering (mijlpaal) staat op 7 jun.
//   na-tut-2     oplevering vr 6 aug 2027. Kritiek: de hele keten Start bouw … Binnenspouwblad →
//                Dakelementen → Dakbedekking → Kozijnen … Tegelwerk → Opleverpunten → Oplevering.
//                Niet kritiek: Buitenspouwblad (speling 2 wd) en Schilderwerk (6 wd). Lag 3 wd na
//                het storten (vr 18 jun → Funderingsmetselwerk do 24 jun), lag 5 wd na de dekvloer.
//   na-tut-3     bouwvak Midden ma 2 – vr 20 aug. Alleen de bouwvak: oplevering vr 27 aug (+15 wd,
//                de droogtijd van de dekvloer loopt over de bouwvak heen). Dan SNET 14 jul op
//                Kozijnen plaatsen (was vr 9 jul): oplevering wo 1 sep (+3 wd). Kritiek pad begint
//                nu bij de constraint: Kozijnen → Achtergevel doorbreken → Installaties → Stucwerk →
//                Dekvloer → Tegelwerk → Opleverpunten → Oplevering; alles daarvoor 3 wd speling.
//                Deadline vr 10 sep op de oplevering: gehaald, 7 wd marge; verschuift geen balk.
//   na-tut-4     einde blijft wo 1 sep. Fundering storten vr 18 jun 07:00–14:00 (6 u, pauze 12–13),
//                Kanaalplaatvloer ma 28 jun 07:00–12:00 (5 u), Dakelementen di 6 jul 07:00–14:00
//                (6 u). Speling van stort/dakelementen 3,25 wd en vloer 3,375 wd: de werkdag loopt
//                tot 16:00, de dagtaak-opvolger begint pas de volgende ochtend.
//   tussen-tut-5-resources   planning = na-tut-4 (wo 1 sep, 48 wd); vijf resources, geen toewijzingen.
//   tussen-tut-5-toegewezen  planning nog steeds wo 1 sep (48 wd, 8 kritieke taken); Metselaar al
//                5 wd overbezet (29 jun – 5 jul); Stucwerk 4 wd (23–28 jul), 1 stukadoor.
//   tussen-tut-5-werkregel   Stucwerk "Vast werk", 2 stukadoors: 2 wd (vr 23 – ma 26 jul);
//                oplevering ma 30 aug, 46 wd, 8 kritieke taken; Metselaar nog 5 wd overbezet.
//   na-tut-5    na toewijzen + werkregel (Stucwerk "Vast werk", stukadoor 1 → 2: 4 → 2 wd):
//                oplevering ma 30 aug, Metselaar 5 wd overbezet (binnen- en buitenspouwblad tegelijk,
//                29 jun – 5 jul). Nivelleren (dialoogstandaard) schuift Buitenspouwblad 5 wd op
//                (di 6 – di 13 jul); geen overbezetting meer; oplevering blijft ma 30 aug (de
//                kozijnen wachten toch tot 14 jul). Kritiek: Start bouw … Inspectie wapening →
//                Funderingsmetselwerk → Buitenspouwblad → Kozijnen … Oplevering. Stort (0,25 wd) en
//                Kanaalplaatvloer (0,375 wd) houden hun uurspeling en zijn dus niet kritiek.
//   na-tut-6     basisplanning "Basisplanning" (oplevering ma 30 aug), statusdatum ma 28 jun.
//                Werkelijk: Start bouw 7 jun, Bouwplaats 7–8 jun, Tuin 9 jun, Uitzetten 10 jun,
//                Funderingssleuf ontgraven vr 11 – di 15 jun (3 i.p.v. 2 wd), Wapening 16–18 jun,
//                Inspectie 18 jun, Fundering storten ma 21 jun 07:00–14:00; Funderingsmetselwerk
//                gestart vr 25 jun, 50 %. Oplevering di 31 aug: 1 wd later dan de basisplanning.
//   na-tut-7     = na-tut-6.
import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { buildGeneratedCalendar } from '@/utils/projectTemplates';
import { computeGenerateSpan, materializeHolidays } from '@/engine/calendar/generateCalendarHolidays';
import { withCanonicalHolidayEnds } from '@/utils/holidayRange';
import { effHoursPerDay } from '@/utils/taskDuration';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { ResourceType } from '@/types/resource';

const S = () => useAppStore.getState();

export type TutorialLang = 'nl' | 'en';
export const TUTORIAL_LANGS: readonly TutorialLang[] = ['nl', 'en'];

export const STAGE_IDS = [
  'start-tut-1', 'na-tut-1', 'na-tut-2', 'tussen-tut-3-bouwvak', 'na-tut-3', 'na-tut-4',
  'tussen-tut-5-resources', 'tussen-tut-5-toegewezen', 'tussen-tut-5-werkregel', 'na-tut-5', 'na-tut-6',
  'na-tut-7',
] as const;
export type StageId = typeof STAGE_IDS[number];

/** Projectstart: maandag 7 juni 2027. */
export const PROJECT_START = '2027-06-07';
/** Bouwvakregio (tutorial 3). Midden 2027 = 2 t/m 20 augustus (`NL_BOUWVAK`). */
export const BOUWVAK_REGION = 'midden' as const;

// ── Vertalingen (projectdata, geen UI-tekst: daarom hier en niet in src/i18n) ────────────────
type Names = Record<TutorialLang, string>;
const n = (nl: string, en: string): Names => ({ nl, en });

const PROJECT_NAME = n('Aanbouw woning', 'House extension');
const PROJECT_DESCRIPTION = n(
  'Uitbouw van 4 bij 5 meter aan de achtergevel van een eengezinswoning — het oefenproject van de tutorials.',
  'A 4 by 5 metre extension at the rear of a family home — the practice project for the tutorials.',
);
/** De wizard noemt de nieuwe kalender hardgecodeerd "Bouwkalender NL" (geen t()); de Engelse
 *  variant krijgt op verzoek van het ontwerp een vertaalde naam. */
const CALENDAR_NAME = n('Bouwkalender NL', 'Construction calendar NL');
const BASELINE_NAME = n('Basisplanning', 'Baseline');

type PhaseKey = 'P1' | 'P2' | 'P3' | 'P4';
const PHASES: { key: PhaseKey; name: Names }[] = [
  { key: 'P1', name: n('Voorbereiding', 'Preparation') },
  { key: 'P2', name: n('Fundering', 'Foundations') },
  { key: 'P3', name: n('Ruwbouw', 'Shell') },
  { key: 'P4', name: n('Afbouw', 'Finishing') },
];

export type TaskKey =
  | 'msStart' | 'site' | 'garden' | 'setout'
  | 'excavate' | 'rebar' | 'inspection' | 'pour' | 'foundBrick' | 'floor'
  | 'innerLeaf' | 'outerLeaf' | 'roofElements' | 'roofing' | 'frames' | 'breakThrough'
  | 'services' | 'plaster' | 'screed' | 'tiling' | 'painting' | 'cleaning' | 'msHandover';

interface TaskDef {
  key: TaskKey;
  phase: PhaseKey;
  name: Names;
  /** Werkdagen in tutorial 1 (mijlpaal: afwezig). */
  days?: number;
  milestone?: 'START' | 'FINISH';
  mandatory?: boolean;
}

/** Taaklijst in boomvolgorde. 20 taken + 3 mijlpalen in 4 fasen. */
export const TASKS: TaskDef[] = [
  { key: 'msStart', phase: 'P1', name: n('Start bouw', 'Start of construction'), milestone: 'START' },
  { key: 'site', phase: 'P1', name: n('Bouwplaats inrichten', 'Set up site'), days: 2 },
  { key: 'garden', phase: 'P1', name: n('Tuin en bestrating verwijderen', 'Clear garden and paving'), days: 1 },
  { key: 'setout', phase: 'P1', name: n('Aanbouw uitzetten', 'Set out the extension'), days: 1 },
  { key: 'excavate', phase: 'P2', name: n('Funderingssleuf ontgraven', 'Excavate foundation trench'), days: 2 },
  { key: 'rebar', phase: 'P2', name: n('Wapening en bekisting fundering', 'Foundation formwork and reinforcement'), days: 3 },
  { key: 'inspection', phase: 'P2', name: n('Inspectie wapening', 'Reinforcement inspection'), milestone: 'FINISH', mandatory: true },
  { key: 'pour', phase: 'P2', name: n('Fundering storten', 'Pour foundation'), days: 1 },
  { key: 'foundBrick', phase: 'P2', name: n('Funderingsmetselwerk', 'Foundation brickwork'), days: 2 },
  { key: 'floor', phase: 'P2', name: n('Kanaalplaatvloer leggen', 'Lay hollow-core floor'), days: 1 },
  { key: 'innerLeaf', phase: 'P3', name: n('Binnenspouwblad metselen', 'Build inner cavity leaf'), days: 5 },
  { key: 'outerLeaf', phase: 'P3', name: n('Buitenspouwblad metselen', 'Build outer cavity leaf'), days: 6 },
  { key: 'roofElements', phase: 'P3', name: n('Dakelementen plaatsen', 'Place roof elements'), days: 1 },
  { key: 'roofing', phase: 'P3', name: n('Dakbedekking aanbrengen', 'Apply roofing'), days: 2 },
  { key: 'frames', phase: 'P3', name: n('Kozijnen plaatsen', 'Install window frames'), days: 2 },
  { key: 'breakThrough', phase: 'P3', name: n('Achtergevel doorbreken', 'Break through rear wall'), days: 2 },
  { key: 'services', phase: 'P4', name: n('Installaties aanleggen', 'Install building services'), days: 3 },
  { key: 'plaster', phase: 'P4', name: n('Stucwerk', 'Plastering'), days: 4 },
  { key: 'screed', phase: 'P4', name: n('Dekvloer aanbrengen', 'Lay floor screed'), days: 1 },
  { key: 'tiling', phase: 'P4', name: n('Tegelwerk', 'Tiling'), days: 3 },
  { key: 'painting', phase: 'P4', name: n('Schilderwerk', 'Painting'), days: 3 },
  { key: 'cleaning', phase: 'P4', name: n('Opleverpunten en schoonmaken', 'Snagging and cleaning'), days: 1 },
  { key: 'msHandover', phase: 'P4', name: n('Oplevering', 'Handover'), milestone: 'FINISH' },
];

/** Tutorial 2: relaties. Allemaal Einde-Start; twee met lag (werkdagen). */
export const LINKS: { pred: TaskKey; succ: TaskKey; lag?: number }[] = [
  { pred: 'msStart', succ: 'site' },
  { pred: 'site', succ: 'garden' },
  { pred: 'garden', succ: 'setout' },
  { pred: 'setout', succ: 'excavate' },
  { pred: 'excavate', succ: 'rebar' },
  { pred: 'rebar', succ: 'inspection' },
  { pred: 'inspection', succ: 'pour' },
  { pred: 'pour', succ: 'foundBrick', lag: 3 }, // beton laten uitharden
  { pred: 'foundBrick', succ: 'floor' },
  { pred: 'floor', succ: 'innerLeaf' },
  { pred: 'floor', succ: 'outerLeaf' },
  { pred: 'innerLeaf', succ: 'roofElements' },
  { pred: 'roofElements', succ: 'roofing' },
  { pred: 'roofing', succ: 'frames' },
  { pred: 'outerLeaf', succ: 'frames' },
  { pred: 'frames', succ: 'breakThrough' },
  { pred: 'breakThrough', succ: 'services' },
  { pred: 'services', succ: 'plaster' },
  { pred: 'plaster', succ: 'screed' },
  { pred: 'plaster', succ: 'painting' },
  { pred: 'screed', succ: 'tiling', lag: 5 }, // dekvloer laten drogen
  { pred: 'tiling', succ: 'cleaning' },
  { pred: 'painting', succ: 'cleaning' },
  { pred: 'cleaning', succ: 'msHandover' },
];

/** Tutorial 3: constraint "Niet eerder beginnen dan" op het plaatsen van de kozijnen (ze worden
 *  pas op deze datum geleverd) en een deadline op de oplevering. */
export const CONSTRAINT = { task: 'frames' as TaskKey, type: 'SNET' as const, date: '2027-07-14' };
export const DEADLINE = { task: 'msHandover' as TaskKey, date: '2027-09-10' };

/** Tutorial 4: taken die in uren gepland worden (werkminuten). */
export const HOUR_TASKS: { task: TaskKey; hours: number }[] = [
  { task: 'pour', hours: 6 },          // betonstort
  { task: 'floor', hours: 5 },         // kraaninzet: kanaalplaten
  { task: 'roofElements', hours: 6 },  // kraaninzet: dakelementen
];

export type ResourceKey = 'crew' | 'bricklayer' | 'crane' | 'plasterer' | 'concrete';
export const RESOURCES: {
  key: ResourceKey; name: Names; type: ResourceType; maxUnits: number; unitOfMeasure?: string;
}[] = [
  { key: 'crew', name: n('Timmerploeg', 'Carpentry crew'), type: 'CREW', maxUnits: 1 },
  { key: 'bricklayer', name: n('Metselaar', 'Bricklayer'), type: 'LABOR', maxUnits: 1 },
  { key: 'crane', name: n('Mobiele kraan', 'Mobile crane'), type: 'EQUIPMENT', maxUnits: 1 },
  { key: 'plasterer', name: n('Stukadoor', 'Plasterer'), type: 'SUBCONTRACTOR', maxUnits: 2 },
  { key: 'concrete', name: n('Beton', 'Concrete'), type: 'MATERIAL', maxUnits: 50, unitOfMeasure: 'm³' },
];

/** Tutorial 5: toewijzingen. De metselaar staat bewust op binnen- én buitenspouwblad, die na de
 *  kanaalplaatvloer tegelijk starten ⇒ overbezetting (2 op capaciteit 1) die nivelleren oplost. */
export const ASSIGNMENTS: { task: TaskKey; res: ResourceKey; units: number }[] = [
  { task: 'rebar', res: 'crew', units: 1 },
  { task: 'pour', res: 'concrete', units: 8 },       // 8 m³ per dag
  { task: 'foundBrick', res: 'bricklayer', units: 1 },
  { task: 'floor', res: 'crew', units: 1 },
  { task: 'floor', res: 'crane', units: 1 },
  { task: 'innerLeaf', res: 'bricklayer', units: 1 },
  { task: 'outerLeaf', res: 'bricklayer', units: 1 },
  { task: 'roofElements', res: 'crew', units: 1 },
  { task: 'roofElements', res: 'crane', units: 1 },
  { task: 'frames', res: 'crew', units: 1 },
  { task: 'breakThrough', res: 'bricklayer', units: 1 },
  { task: 'plaster', res: 'plasterer', units: 1 },
];
/** Tutorial 5: werkregel. Het stucwerk krijgt "Vast werk"; daarna gaat de stukadoor van 1 naar 2
 *  man — het werk blijft gelijk, dus de duur halveert (4 → 2 werkdagen). */
export const WORK_RULE = { task: 'plaster' as TaskKey, rule: 'FIXED_WORK' as const, unitsAfter: 2 };

/** Tutorial 6: statusdatum en voortgang. */
export const STATUS_DATE = '2027-06-28';
/** Taken die op de statusdatum klaar zijn (in deze volgorde ingevoerd, telkens conform de dan
 *  berekende planning). Uitzondering: het ontgraven liep één werkdag uit (grondwater). */
export const DONE_TASKS: TaskKey[] = ['msStart', 'site', 'garden', 'setout', 'excavate', 'rebar', 'inspection', 'pour'];
export const LATE_TASK = { task: 'excavate' as TaskKey, extraWorkdays: 1 };
/** Taak die op de statusdatum loopt: gestart volgens planning, voor de helft klaar. */
export const IN_PROGRESS = { task: 'foundBrick' as TaskKey, completion: 0.5 };

// ── Feiten per stand ──────────────────────────────────────────────────────────────────────────
export interface StageFacts {
  /** Vroege einddatum van de opleveringsmijlpaal. */
  finish: string;
  /** Laatste vroege einde over alle bladtaken (zonder relaties is dat niet de oplevering). */
  projectFinish: string;
  /** Kritieke taken en mijlpalen (bladniveau) in volgorde van vroege start, als taaksleutel. */
  critical: TaskKey[];
  /** Totale speling in werkdagen per taaksleutel (bladniveau). */
  totalFloat: Partial<Record<TaskKey, number>>;
  /** Vroege start/einde per taaksleutel (zoals de motor ze teruggeeft). */
  early: Partial<Record<TaskKey, { start: string; finish: string }>>;
  /** Overbezette resources (sleutel → aantal overbezette werkdagen). Leeg = geen. */
  overallocated: Partial<Record<ResourceKey, number>>;
  /** Statusdatum van het project (tutorial 6), anders null. */
  statusDate: string | null;
  /** Einde van de oplevering in de actieve baseline (tutorial 6), anders null. */
  baselineFinish: string | null;
  /** Tellingen. */
  counts: { tasks: number; milestones: number; sequences: number; resources: number; assignments: number; baselines: number };
}

export interface TutorialStage {
  id: StageId;
  ifc: string;
  facts: StageFacts;
}

/** Tussenresultaten binnen een tutorial die de tekst nodig heeft (bijv. de einddatum na de
 *  bouwvak maar vóór de constraint). */
export interface TutorialBuild {
  lang: TutorialLang;
  stages: TutorialStage[];
  /** Tutorial 3: einde na alleen de bouwvak (vóór constraint en deadline). */
  finishAfterBouwvak: string;
  /** Tutorial 3: bouwvakperiode zoals de generator hem maakte. */
  bouwvak: { name: string; startDate: string; endDate: string };
  /** Tutorial 5: feiten vóór nivelleren (na toewijzen en werkregel). */
  beforeLeveling: StageFacts;
  /** Tutorial 5: duur van het stucwerk vóór en na de werkregelstap (werkdagen). */
  plasterDays: { before: number; after: number };
  /** Tutorial 5: taken die de nivelleerder verschoof, met de vertraging in werkdagen. */
  levelingDelays: Partial<Record<TaskKey, number>>;
}

// ── Opbouw ────────────────────────────────────────────────────────────────────────────────────
class Builder {
  readonly ids = new Map<TaskKey, string>();
  readonly phaseIds = new Map<PhaseKey, string>();
  readonly resIds = new Map<ResourceKey, string>();
  constructor(readonly lang: TutorialLang) {}

  id(key: TaskKey): string {
    const id = this.ids.get(key);
    if (!id) throw new Error(`tutorialproject: onbekende taak ${key}`);
    return id;
  }
  task(key: TaskKey): Task {
    const t = S().tasks.find(x => x.id === this.id(key));
    if (!t) throw new Error(`tutorialproject: taak ${key} niet in de store (${S().tasks.length} taken)`);
    return t;
  }
  keyOf(id: string): TaskKey | undefined {
    for (const [k, v] of this.ids) if (v === id) return k;
    return undefined;
  }

  /** Berekenen (F5), met een harde fout als de motor faalt. */
  calculate(context: string): void {
    S().runCPM();
    const r = S().cpmResult;
    if (!r || r.error) throw new Error(`tutorialproject [${this.lang}] ${context}: berekenen mislukt (${r?.error ?? 'geen resultaat'})`);
  }

  facts(): StageFacts {
    return collectStageFacts(this.lang);
  }

  snapshot(id: StageId): TutorialStage {
    return { id, ifc: writeIFC(buildWriteIFCInput(S())), facts: this.facts() };
  }
}

/**
 * De feiten van het project dat NU in de store staat, herkend aan de (unieke) taak- en
 * resourcenamen van `lang`. Gedeeld door de generator en de planning-check, die er ook een
 * heropend .ifc-bestand mee leest.
 */
export function collectStageFacts(lang: TutorialLang): StageFacts {
  const st = S();
  const byName = new Map(st.tasks.map(t => [t.name, t]));
  const present = TASKS.filter(d => byName.has(d.name[lang]));
  const task = (k: TaskKey): Task => byName.get(TASKS.find(d => d.key === k)!.name[lang])!;
  const leaves = present.map(d => d.key).filter(k => task(k).childIds.length === 0);
  const order = (k: TaskKey) => TASKS.findIndex(d => d.key === k);
  const byStart = [...leaves].sort((a, c) =>
    task(a).time.earlyStart.localeCompare(task(c).time.earlyStart) || order(a) - order(c));
  const totalFloat: Partial<Record<TaskKey, number>> = {};
  const early: Partial<Record<TaskKey, { start: string; finish: string }>> = {};
  for (const k of leaves) {
    const t = task(k).time;
    totalFloat[k] = t.totalFloat;
    early[k] = { start: t.earlyStart, finish: t.earlyFinish };
  }
  const overallocated: Partial<Record<ResourceKey, number>> = {};
  const rlr = st.resourceLoadResult;
  for (const r of RESOURCES) {
    const res = st.resources.find(x => x.name === r.name[lang]);
    const days = res ? (rlr?.overallocatedDays[res.id]?.length ?? 0) : 0;
    if (days > 0) overallocated[r.key] = days;
  }
  const handover = present.some(d => d.key === 'msHandover') ? task('msHandover') : undefined;
  const activeBaseline = st.baselines.find(bl => bl.id === st.activeBaselineId);
  const baselineFinish = handover && activeBaseline
    ? activeBaseline.tasks.find(bt => bt.taskId === handover.id)?.finish
    : undefined;
  return {
    finish: handover?.time.earlyFinish ?? '',
    projectFinish: leaves.reduce((m, k) => {
      const f = task(k).time.earlyFinish;
      return f > m ? f : m;
    }, ''),
    critical: byStart.filter(k => task(k).time.isCritical),
    totalFloat,
    early,
    overallocated,
    statusDate: st.project.statusDate ?? null,
    baselineFinish: baselineFinish ?? null,
    counts: {
      tasks: st.tasks.length,
      milestones: st.tasks.filter(t => t.isMilestone).length,
      sequences: st.sequences.length,
      resources: st.resources.length,
      assignments: st.assignments.length,
      baselines: st.baselines.length,
    },
  };
}

function fail(lang: TutorialLang, msg: string): never {
  throw new Error(`tutorialproject [${lang}]: ${msg}`);
}

/**
 * Bouwt alle standen voor één taal. Gooit een fout zodra een beoogd effect uitblijft (bijv. de
 * bouwvak verschuift de einddatum niet, of er is vóór het nivelleren geen overbezetting) — de
 * generator schrijft dan niets weg. De exacte getallen pint `check-tutorial-project.ts`.
 */
export function buildTutorialProject(lang: TutorialLang): TutorialBuild {
  const b = new Builder(lang);
  const stages: TutorialStage[] = [];

  // ── Start tutorial 1: Bestand › Nieuw project (wizard) ──
  // Schone lei: `newProject` zet de store terug, zodat `createNewProject` het (lege) tabblad
  // hergebruikt, net als bij de eerste start van de app.
  S().newProject();
  S().setUI({ enableHourPlanning: false });
  const span = computeGenerateSpan(PROJECT_START, undefined);
  // Wizardstandaard: land Nederland, geen bouwvak, generatiespanne startjaar−1 … startjaar+3.
  const wizardCalendar: WorkCalendar = buildGeneratedCalendar(
    { country: 'NL', region: undefined, bouwvak: 'geen' }, span, CALENDAR_NAME[lang],
  );
  S().createNewProject({
    name: PROJECT_NAME[lang],
    description: PROJECT_DESCRIPTION[lang],
    author: '',
    company: '',
    startDate: PROJECT_START,
    endDate: '',
    calendar: wizardCalendar,
    phaseNames: [],
    defaultTaskDurationUnit: 'days',
    schedulingProfile: undefined,
    schedulingOptions: undefined,
  });
  if (S().tasks.length !== 0) fail(lang, 'start-tut-1 is niet leeg');
  stages.push(b.snapshot('start-tut-1'));

  // ── Tutorial 1: fasen, taken met duur, mijlpalen ──
  for (const p of PHASES) {
    const id = S().addTask({ name: p.name[lang], time: createDefaultTaskTime(PROJECT_START, 5) });
    if (!id) fail(lang, `fase ${p.key} geweigerd`);
    b.phaseIds.set(p.key, id);
  }
  for (const t of TASKS) {
    const parentId = b.phaseIds.get(t.phase)!;
    const id = S().addTask({
      name: t.name[lang],
      parentId,
      isMilestone: !!t.milestone,
      time: createDefaultTaskTime(PROJECT_START, t.milestone ? 0 : (t.days ?? 5)),
      // Mijlpalen zoals de lezer ze maakt: Start › Taken › Mijlpaal (`MilestoneDropdown`) geeft een
      // Start-/Eindmijlpaal het taaktype Overig en een Inspectiemoment het type Aanwezigheid.
      ...(t.milestone ? { milestoneKind: t.milestone, taskType: t.mandatory ? 'ATTENDANCE' as const : 'USERDEFINED' as const } : {}),
      ...(t.mandatory ? { mandatory: true } : {}),
    });
    if (!id) fail(lang, `taak ${t.key} geweigerd`);
    b.ids.set(t.key, id);
  }
  b.calculate('tut-1');
  const f1 = b.facts();
  // Zonder relaties begint alles op de projectstart; de langste taak bepaalt het einde.
  for (const k of TASKS.map(t => t.key)) {
    if (f1.early[k]?.start.slice(0, 10) !== PROJECT_START) fail(lang, `tut-1: ${k} begint niet op de projectstart`);
  }
  if (f1.counts.sequences !== 0) fail(lang, 'tut-1 heeft al relaties');
  stages.push(b.snapshot('na-tut-1'));

  // ── Tutorial 2: relaties + lag, Berekenen ──
  for (const l of LINKS) {
    const id = S().addSequence({
      predecessorId: b.id(l.pred), successorId: b.id(l.succ), type: 'FINISH_START', lagDays: l.lag ?? 0,
    });
    if (!id) fail(lang, `relatie ${l.pred} → ${l.succ} geweigerd`);
  }
  b.calculate('tut-2');
  const f2 = b.facts();
  if (f2.finish <= f1.finish) fail(lang, 'tut-2: relaties schuiven de einddatum niet op');
  if (!f2.critical.includes('msHandover')) fail(lang, 'tut-2: oplevering niet kritiek');
  if ((f2.totalFloat.painting ?? 0) <= 0) fail(lang, 'tut-2: schilderwerk heeft geen speling (bedoeld: parallelle tak)');
  stages.push(b.snapshot('na-tut-2'));

  // ── Tutorial 3: Planning › Kalender: feestdagen opnieuw genereren mét bouwvak, dan constraint
  // en deadline. Zelfde route als de kalenderdialoog (`CalendarDialog.commit`): de projectkalender
  // in de bibliotheek, `materializeHolidays` over de projectspanne, `commitCalendarLibrary`, runCPM.
  S().ensureProjectCalendarInLibrary();
  const projectCalId = S().project.calendarId;
  const projectSpan = computeGenerateSpan(S().project.startDate, S().project.endDate || undefined);
  const { holidays, generation } = materializeHolidays(
    { country: 'NL', region: undefined, bouwvak: BOUWVAK_REGION }, projectSpan.from, projectSpan.to,
  );
  const cals = (structuredClone(S().calendars) as WorkCalendar[]).map(c =>
    c.id === projectCalId ? { ...c, holidays, generation } : c);
  if (!S().commitCalendarLibrary(cals.map(withCanonicalHolidayEnds), projectCalId)) fail(lang, 'tut-3: kalender niet gewijzigd');
  b.calculate('tut-3 kalender');
  const bouwvak = S().calendar.holidays.find(h => h.startDate.startsWith('2027') && /bouwvak/i.test(h.name));
  if (!bouwvak) fail(lang, 'tut-3: geen bouwvak 2027 in de projectkalender');
  const f3cal = b.facts();
  if (f3cal.finish <= f2.finish) fail(lang, 'tut-3: de bouwvak verschuift de einddatum niet');
  // Tussenstand voor tutorial 3: bouwvak in de kalender en berekend, nog zonder constraint en
  // deadline. "Toon mij"/"Opnieuw" van de kalenderstap openen deze stand, omdat een extensie de
  // kalender niet zelf kan wijzigen.
  stages.push(b.snapshot('tussen-tut-3-bouwvak'));

  S().updateTask(b.id(CONSTRAINT.task), { constraint: { type: CONSTRAINT.type, date: CONSTRAINT.date } });
  b.calculate('tut-3 constraint');
  S().updateTask(b.id(DEADLINE.task), { deadline: DEADLINE.date });
  b.calculate('tut-3 deadline');
  const f3 = b.facts();
  if (f3.early[CONSTRAINT.task]!.start.slice(0, 10) !== CONSTRAINT.date) fail(lang, 'tut-3: de constraint stuurt het plaatsen van de kozijnen niet');
  if (f3.finish.slice(0, 10) > DEADLINE.date) fail(lang, 'tut-3: deadline gemist (bedoeld: met marge gehaald)');
  if ((S().cpmResult?.missedDeadlineTaskIds ?? []).length !== 0) fail(lang, 'tut-3: motor meldt gemiste deadline');
  stages.push(b.snapshot('na-tut-3'));

  // ── Tutorial 4: Instellingen › Urenplanning inschakelen; duur in uren (Duur-veld "6h") ──
  S().setUI({ enableHourPlanning: true, allowMixedDayHour: true });
  const calForHours = S().calendar;
  for (const h of HOUR_TASKS) {
    const t = b.task(h.task);
    const minutes = h.hours * 60;
    const hpd = effHoursPerDay(calForHours);
    // Precies `TaskDurationField.apply` bij invoer "6h".
    S().updateTask(t.id, {
      time: { ...t.time, durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: hpd > 0 ? minutes / (hpd * 60) : 0 },
    });
  }
  b.calculate('tut-4');
  for (const h of HOUR_TASKS) {
    const t = b.task(h.task).time;
    if (t.durationUnit !== 'hours' || t.durationMinutes !== h.hours * 60) fail(lang, `tut-4: ${h.task} staat niet in uren`);
    if (!/T\d\d:\d\d/.test(t.earlyFinish)) fail(lang, `tut-4: ${h.task} heeft geen uurprecies einde (${t.earlyFinish})`);
  }
  stages.push(b.snapshot('na-tut-4'));

  // ── Tutorial 5: resources, toewijzen, werkregel, overbezetting, nivelleren ──
  // Tussenstanden voor tutorial 5: een extensie kan geen resources, toewijzingen of werkregels
  // schrijven, dus "Toon mij"/"Opnieuw" van die stappen openen deze standen. Een snapshot leest
  // alleen de store; de stappen erna (en daarmee na-tut-5) blijven ongewijzigd.
  for (const r of RESOURCES) {
    b.resIds.set(r.key, S().addResource({
      name: r.name[lang], type: r.type, description: '', maxUnits: r.maxUnits,
      ...(r.unitOfMeasure ? { unitOfMeasure: r.unitOfMeasure } : {}),
    }));
  }
  if (S().resources.length !== RESOURCES.length) fail(lang, 'tut-5: niet alle resources aangemaakt');
  // Resources aanmaken verandert de planning niet: geen herberekening, zoals de lezer ook niet hoeft.
  stages.push(b.snapshot('tussen-tut-5-resources'));
  for (const a of ASSIGNMENTS) S().assignResource(b.id(a.task), b.resIds.get(a.res)!, a.units);
  if (S().assignments.length !== ASSIGNMENTS.length) fail(lang, 'tut-5: niet alle toewijzingen gelukt');
  b.calculate('tut-5 toewijzen');
  stages.push(b.snapshot('tussen-tut-5-toegewezen'));
  const plasterBefore = b.task(WORK_RULE.task).time.scheduleDuration;
  S().setTaskWorkRule(b.id(WORK_RULE.task), WORK_RULE.rule);
  const plasterAsg = S().assignments.find(a => a.taskId === b.id(WORK_RULE.task));
  if (!plasterAsg) fail(lang, 'tut-5: stucwerk heeft geen toewijzing');
  S().updateAssignment(plasterAsg.id, { unitsPerDay: WORK_RULE.unitsAfter });
  b.calculate('tut-5 werkregel');
  const plasterAfter = b.task(WORK_RULE.task).time.scheduleDuration;
  if (!(plasterAfter < plasterBefore)) fail(lang, `tut-5: werkregel verkort het stucwerk niet (${plasterBefore} → ${plasterAfter})`);
  const beforeLeveling = b.facts();
  stages.push(b.snapshot('tussen-tut-5-werkregel'));
  const overBefore = Object.keys(beforeLeveling.overallocated);
  if (overBefore.length !== 1 || overBefore[0] !== 'bricklayer') {
    fail(lang, `tut-5: vóór nivelleren hoort alleen de metselaar overbezet te zijn (is: ${overBefore.join(', ') || 'niemand'})`);
  }
  // Resources › Nivelleren: dialoogstandaard (alle vernieuwbare resources, einddatum mag schuiven).
  const renewables = S().resources.filter(r => r.type !== 'MATERIAL').map(r => r.id);
  const leveling = S().levelResources({ constrainToFloat: false, resourceIds: renewables });
  if (Object.keys(leveling.unresolved).length !== 0) fail(lang, 'tut-5: nivelleren laat conflicten over');
  S().applyLeveling(leveling);
  const cpm = S().cpmResult;
  if (!cpm || cpm.error) fail(lang, 'tut-5: berekenen na nivelleren mislukt');
  const f5 = b.facts();
  if (Object.keys(f5.overallocated).length !== 0) fail(lang, `tut-5: na nivelleren nog overbezetting (${Object.keys(f5.overallocated).join(', ')})`);
  const levelingDelays: Partial<Record<TaskKey, number>> = {};
  for (const [taskId, d] of Object.entries(leveling.delays)) {
    const k = b.keyOf(taskId);
    if (k && d) levelingDelays[k] = d;
  }
  stages.push(b.snapshot('na-tut-5'));

  // ── Tutorial 6: basisplanning, statusdatum, voortgang ──
  S().saveBaseline(BASELINE_NAME[lang]);
  // De voortgang wordt taak voor taak ingevoerd, telkens conform de op dat moment berekende
  // planning (de uitvoerder meldt "ging volgens planning"), behalve de uitloop van het ontgraven.
  // Dat gebeurt vóór de statusdatum wordt gezet: mét statusdatum legt de motor niet-gestart werk op
  // de statusdatum (data date), en dan is "de planning" van een al uitgevoerde taak niet meer zijn
  // oorspronkelijke plek. De eindtoestand (werkelijke datums + statusdatum) is dezelfde als wanneer
  // de lezer eerst de statusdatum zet en daarna de werkelijke datums invult.
  for (const k of DONE_TASKS) {
    b.calculate(`tut-6 voortgang ${k}`);
    const t = b.task(k).time;
    let finish = t.earlyFinish;
    if (k === LATE_TASK.task) {
      const next = nextWorkdays(finish.slice(0, 10), LATE_TASK.extraWorkdays, S().calendar);
      finish = finish.length > 10 ? `${next}${finish.slice(10)}` : next;
    }
    if (!S().setActualStart(b.id(k), t.earlyStart)) fail(lang, `tut-6: werkelijke start ${k} geweigerd`);
    if (!S().setActualFinish(b.id(k), finish)) fail(lang, `tut-6: werkelijk einde ${k} geweigerd (${t.earlyStart} → ${finish})`);
  }
  b.calculate('tut-6 lopende taak');
  {
    const t = b.task(IN_PROGRESS.task).time;
    if (!S().setActualStart(b.id(IN_PROGRESS.task), t.earlyStart)) fail(lang, 'tut-6: start lopende taak geweigerd');
    if (!S().setTaskProgress(b.id(IN_PROGRESS.task), IN_PROGRESS.completion)) fail(lang, 'tut-6: voortgang lopende taak geweigerd');
  }
  S().setStatusDate(STATUS_DATE);
  b.calculate('tut-6');
  const f6 = b.facts();
  if (f6.finish <= f5.finish) fail(lang, 'tut-6: de uitloop van het ontgraven verschuift de einddatum niet');
  if (f6.counts.baselines !== 1) fail(lang, 'tut-6: geen basisplanning');
  const s6 = b.snapshot('na-tut-6');
  stages.push(s6);
  // Tutorial 7 maakt alleen een rapport: projectdata identiek aan stand 6.
  stages.push({ id: 'na-tut-7', ifc: s6.ifc, facts: s6.facts });

  return {
    lang,
    stages,
    finishAfterBouwvak: f3cal.finish,
    bouwvak: { name: bouwvak.name, startDate: bouwvak.startDate, endDate: bouwvak.endDate },
    beforeLeveling,
    plasterDays: { before: plasterBefore, after: plasterAfter },
    levelingDelays,
  };
}

/** De datum `count` werkdagen ná `iso` op de projectkalender (werkdagen + feestdagen). */
function nextWorkdays(iso: string, count: number, cal: WorkCalendar): string {
  const d = new Date(`${iso}T00:00:00Z`);
  let left = count;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = ((d.getUTCDay() + 6) % 7) + 1; // 1=ma … 7=zo
    const day = d.toISOString().slice(0, 10);
    const holiday = cal.holidays.some(h => h.startDate <= day && day <= h.endDate);
    if (cal.workDays.includes(dow) && !holiday) left--;
  }
  return d.toISOString().slice(0, 10);
}
