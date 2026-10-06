// check-tutorial-project.ts — het tutorialproject *Aanbouw woning* / *House extension*
// (`scripts/tutorial-project.ts`, generator `npm run gen:tutorial-project`).
//
// De tutorialtekst noemt letterlijke datums, speling en het kritieke pad per stand. Deze check pint
// die getallen, zodat een motor- of storewijziging die ze verandert rood wordt in plaats van stil
// een tutorial te laten liegen. Verandert een getal bewust, pas dan de pin hieronder aan ÉN de
// tutorialtekst (en het getallenblok bovenin `scripts/tutorial-project.ts`).
//
// Wat hij toetst:
//  1. Per stand (nl) de exacte feiten (zoals de generator ze in het bestand legt): einde oplevering, laatste einde, kritieke taken, per bladtaak
//     vroege start/einde en totale speling, overbezetting, statusdatum, baseline-einde, tellingen.
//  2. De tussenresultaten die de tekst gebruikt (einde na alleen de bouwvak, overbezetting vóór
//     nivelleren, stucwerkduur voor/na de werkregel, nivelleervertraging).
//  3. en-variant: identieke feiten (alleen de namen verschillen), en de namen zijn echt vertaald.
//  4. Elk .ifc opent via dezelfde route als Voorbeelden/examples:// (`openExampleFromString`:
//     lezen → laden → herberekenen) en levert daarna exact dezelfde feiten, zonder dat de
//     herberekening datums verschuift (geen "datums zoals opgeslagen"-aanbod).
//  5. De wat-als-stappen uit de tekst die geen eigen stand zijn (tutorial 2: buitenspouwblad 9
//     werkdagen; tutorial 3: deadline 27 augustus), plus het werkdagengetal op de statusbalk.
//  6. De tussenstanden van tutorial 5 (resources, toegewezen, werkregel) zoals de lezer ze opent:
//     statusbalk, overbezette dagen van de metselaar, en werkregel/inzet/duur van het stucwerk.
//  7. De tussenstanden van tutorial 6 (baseline, statusdatum, voorbereiding, ontgraven, fundering,
//     metselwerk), nl en en: in het bestand nog niet gerekend (= wat de lezer vóór Bereken ziet), en
//     geopend zoals de extensie ze opent (de app rekent dan): statusbalk, deadline, baseline, voortgang.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import {
  buildTutorialProject, collectStageFacts, STAGE_IDS, TASKS, RESOURCES,
  type StageFacts, type StageId, type TaskKey, type TutorialBuild,
} from '../../scripts/tutorial-project';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

interface Pinned {
  finish: string;
  projectFinish: string;
  statusDate: string | null;
  baselineFinish: string | null;
  overallocated: Partial<Record<string, number>>;
  counts: StageFacts['counts'];
  critical: TaskKey[];
  /** taaksleutel → "vroege start, vroeg einde, totale speling (werkdagen)". */
  table: Partial<Record<TaskKey, string>>;
}

/** De planning van na-tut-5: ook die van de tussenstanden van tutorial 6 in het BESTAND (daar is nog
 *  niet gerekend; de lezer rekent pas in stap 8). */
const NA_TUT_5_PLANNING: Pick<Pinned, 'finish' | 'projectFinish' | 'critical' | 'table'> = {
  finish: '2027-08-30', projectFinish: '2027-08-30',
  critical: ['msStart', 'site', 'garden', 'setout', 'excavate', 'rebar', 'inspection', 'foundBrick', 'outerLeaf', 'frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
  table: {
    msStart: '2027-06-07 2027-06-07 0',
    site: '2027-06-07 2027-06-08 0',
    garden: '2027-06-09 2027-06-09 0',
    setout: '2027-06-10 2027-06-10 0',
    excavate: '2027-06-11 2027-06-14 0',
    rebar: '2027-06-15 2027-06-17 0',
    inspection: '2027-06-17 2027-06-17 0',
    pour: '2027-06-18T07:00 2027-06-18T14:00 0.25',
    foundBrick: '2027-06-24 2027-06-25 0',
    floor: '2027-06-28T07:00 2027-06-28T12:00 0.375',
    innerLeaf: '2027-06-29 2027-07-05 3',
    outerLeaf: '2027-07-06 2027-07-13 0',
    roofElements: '2027-07-06T07:00 2027-07-06T14:00 3.25',
    roofing: '2027-07-07 2027-07-08 3',
    frames: '2027-07-14 2027-07-15 0',
    breakThrough: '2027-07-16 2027-07-19 0',
    services: '2027-07-20 2027-07-22 0',
    plaster: '2027-07-23 2027-07-26 0',
    screed: '2027-07-27 2027-07-27 0',
    tiling: '2027-08-25 2027-08-27 0',
    painting: '2027-07-27 2027-07-29 6',
    cleaning: '2027-08-30 2027-08-30 0',
    msHandover: '2027-08-30 2027-08-30 0',
  },
};

/** Een tussenstand van tutorial 6 in het bestand: de planning van na-tut-5, met de baseline. */
function tut6File(statusDate: string | null): Pinned {
  return {
    ...NA_TUT_5_PLANNING,
    statusDate, baselineFinish: '2027-08-30',
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 1 },
  };
}

// ── De gepinde getallen (nl; en moet identiek zijn). Tutorial 7 = stand 6. ─────────────────────
const PINNED: Record<Exclude<StageId, 'na-tut-7'>, Pinned> = {
  'start-tut-1': {
    finish: '', projectFinish: '',
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: { tasks: 0, milestones: 0, sequences: 0, resources: 0, assignments: 0, baselines: 0 },
    critical: [],
    table: {
    },
  },
  'na-tut-1': {
    finish: '2027-06-07', projectFinish: '2027-06-14',
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 0, resources: 0, assignments: 0, baselines: 0 },
    critical: ['outerLeaf'],
    table: {
      msStart: '2027-06-07 2027-06-07 5',
      site: '2027-06-07 2027-06-08 4',
      garden: '2027-06-07 2027-06-07 5',
      setout: '2027-06-07 2027-06-07 5',
      excavate: '2027-06-07 2027-06-08 4',
      rebar: '2027-06-07 2027-06-09 3',
      inspection: '2027-06-07 2027-06-07 5',
      pour: '2027-06-07 2027-06-07 5',
      foundBrick: '2027-06-07 2027-06-08 4',
      floor: '2027-06-07 2027-06-07 5',
      innerLeaf: '2027-06-07 2027-06-11 1',
      outerLeaf: '2027-06-07 2027-06-14 0',
      roofElements: '2027-06-07 2027-06-07 5',
      roofing: '2027-06-07 2027-06-08 4',
      frames: '2027-06-07 2027-06-08 4',
      breakThrough: '2027-06-07 2027-06-08 4',
      services: '2027-06-07 2027-06-09 3',
      plaster: '2027-06-07 2027-06-10 2',
      screed: '2027-06-07 2027-06-07 5',
      tiling: '2027-06-07 2027-06-09 3',
      painting: '2027-06-07 2027-06-09 3',
      cleaning: '2027-06-07 2027-06-07 5',
      msHandover: '2027-06-07 2027-06-07 5',
    },
  },
  'na-tut-2': {
    finish: '2027-08-06', projectFinish: '2027-08-06',
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 0, assignments: 0, baselines: 0 },
    critical: ['msStart', 'site', 'garden', 'setout', 'excavate', 'rebar', 'inspection', 'pour', 'foundBrick', 'floor', 'innerLeaf', 'roofElements', 'roofing', 'frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 0',
      site: '2027-06-07 2027-06-08 0',
      garden: '2027-06-09 2027-06-09 0',
      setout: '2027-06-10 2027-06-10 0',
      excavate: '2027-06-11 2027-06-14 0',
      rebar: '2027-06-15 2027-06-17 0',
      inspection: '2027-06-17 2027-06-17 0',
      pour: '2027-06-18 2027-06-18 0',
      foundBrick: '2027-06-24 2027-06-25 0',
      floor: '2027-06-28 2027-06-28 0',
      innerLeaf: '2027-06-29 2027-07-05 0',
      outerLeaf: '2027-06-29 2027-07-06 2',
      roofElements: '2027-07-06 2027-07-06 0',
      roofing: '2027-07-07 2027-07-08 0',
      frames: '2027-07-09 2027-07-12 0',
      breakThrough: '2027-07-13 2027-07-14 0',
      services: '2027-07-15 2027-07-19 0',
      plaster: '2027-07-20 2027-07-23 0',
      screed: '2027-07-26 2027-07-26 0',
      tiling: '2027-08-03 2027-08-05 0',
      painting: '2027-07-26 2027-07-28 6',
      cleaning: '2027-08-06 2027-08-06 0',
      msHandover: '2027-08-06 2027-08-06 0',
    },
  },
  'tussen-tut-3-bouwvak': {
    finish: '2027-08-27', projectFinish: '2027-08-27',
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 0, assignments: 0, baselines: 0 },
    critical: ['msStart', 'site', 'garden', 'setout', 'excavate', 'rebar', 'inspection', 'pour', 'foundBrick', 'floor', 'innerLeaf', 'roofElements', 'roofing', 'frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 0',
      site: '2027-06-07 2027-06-08 0',
      garden: '2027-06-09 2027-06-09 0',
      setout: '2027-06-10 2027-06-10 0',
      excavate: '2027-06-11 2027-06-14 0',
      rebar: '2027-06-15 2027-06-17 0',
      inspection: '2027-06-17 2027-06-17 0',
      pour: '2027-06-18 2027-06-18 0',
      foundBrick: '2027-06-24 2027-06-25 0',
      floor: '2027-06-28 2027-06-28 0',
      innerLeaf: '2027-06-29 2027-07-05 0',
      outerLeaf: '2027-06-29 2027-07-06 2',
      roofElements: '2027-07-06 2027-07-06 0',
      roofing: '2027-07-07 2027-07-08 0',
      frames: '2027-07-09 2027-07-12 0',
      breakThrough: '2027-07-13 2027-07-14 0',
      services: '2027-07-15 2027-07-19 0',
      plaster: '2027-07-20 2027-07-23 0',
      screed: '2027-07-26 2027-07-26 0',
      tiling: '2027-08-24 2027-08-26 0',
      painting: '2027-07-26 2027-07-28 6',
      cleaning: '2027-08-27 2027-08-27 0',
      msHandover: '2027-08-27 2027-08-27 0',
    },
  },
  'na-tut-3': {
    finish: '2027-09-01', projectFinish: '2027-09-01',
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 0, assignments: 0, baselines: 0 },
    critical: ['frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 3',
      site: '2027-06-07 2027-06-08 3',
      garden: '2027-06-09 2027-06-09 3',
      setout: '2027-06-10 2027-06-10 3',
      excavate: '2027-06-11 2027-06-14 3',
      rebar: '2027-06-15 2027-06-17 3',
      inspection: '2027-06-17 2027-06-17 3',
      pour: '2027-06-18 2027-06-18 3',
      foundBrick: '2027-06-24 2027-06-25 3',
      floor: '2027-06-28 2027-06-28 3',
      innerLeaf: '2027-06-29 2027-07-05 3',
      outerLeaf: '2027-06-29 2027-07-06 5',
      roofElements: '2027-07-06 2027-07-06 3',
      roofing: '2027-07-07 2027-07-08 3',
      frames: '2027-07-14 2027-07-15 0',
      breakThrough: '2027-07-16 2027-07-19 0',
      services: '2027-07-20 2027-07-22 0',
      plaster: '2027-07-23 2027-07-28 0',
      screed: '2027-07-29 2027-07-29 0',
      tiling: '2027-08-27 2027-08-31 0',
      painting: '2027-07-29 2027-08-23 6',
      cleaning: '2027-09-01 2027-09-01 0',
      msHandover: '2027-09-01 2027-09-01 0',
    },
  },
  'na-tut-4': {
    finish: '2027-09-01', projectFinish: '2027-09-01',
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 0, assignments: 0, baselines: 0 },
    critical: ['frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 3',
      site: '2027-06-07 2027-06-08 3',
      garden: '2027-06-09 2027-06-09 3',
      setout: '2027-06-10 2027-06-10 3',
      excavate: '2027-06-11 2027-06-14 3',
      rebar: '2027-06-15 2027-06-17 3',
      inspection: '2027-06-17 2027-06-17 3',
      pour: '2027-06-18T07:00 2027-06-18T14:00 3.25',
      foundBrick: '2027-06-24 2027-06-25 3',
      floor: '2027-06-28T07:00 2027-06-28T12:00 3.375',
      innerLeaf: '2027-06-29 2027-07-05 3',
      outerLeaf: '2027-06-29 2027-07-06 5',
      roofElements: '2027-07-06T07:00 2027-07-06T14:00 3.25',
      roofing: '2027-07-07 2027-07-08 3',
      frames: '2027-07-14 2027-07-15 0',
      breakThrough: '2027-07-16 2027-07-19 0',
      services: '2027-07-20 2027-07-22 0',
      plaster: '2027-07-23 2027-07-28 0',
      screed: '2027-07-29 2027-07-29 0',
      tiling: '2027-08-27 2027-08-31 0',
      painting: '2027-07-29 2027-08-23 6',
      cleaning: '2027-09-01 2027-09-01 0',
      msHandover: '2027-09-01 2027-09-01 0',
    },
  },
  // Tutorial 5 stap 2: vijf resources, nog niets toegewezen — de planning is die van na-tut-4.
  'tussen-tut-5-resources': {
    finish: '2027-09-01', projectFinish: '2027-09-01',
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 0, baselines: 0 },
    critical: ['frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 3',
      site: '2027-06-07 2027-06-08 3',
      garden: '2027-06-09 2027-06-09 3',
      setout: '2027-06-10 2027-06-10 3',
      excavate: '2027-06-11 2027-06-14 3',
      rebar: '2027-06-15 2027-06-17 3',
      inspection: '2027-06-17 2027-06-17 3',
      pour: '2027-06-18T07:00 2027-06-18T14:00 3.25',
      foundBrick: '2027-06-24 2027-06-25 3',
      floor: '2027-06-28T07:00 2027-06-28T12:00 3.375',
      innerLeaf: '2027-06-29 2027-07-05 3',
      outerLeaf: '2027-06-29 2027-07-06 5',
      roofElements: '2027-07-06T07:00 2027-07-06T14:00 3.25',
      roofing: '2027-07-07 2027-07-08 3',
      frames: '2027-07-14 2027-07-15 0',
      breakThrough: '2027-07-16 2027-07-19 0',
      services: '2027-07-20 2027-07-22 0',
      plaster: '2027-07-23 2027-07-28 0',
      screed: '2027-07-29 2027-07-29 0',
      tiling: '2027-08-27 2027-08-31 0',
      painting: '2027-07-29 2027-08-23 6',
      cleaning: '2027-09-01 2027-09-01 0',
      msHandover: '2027-09-01 2027-09-01 0',
    },
  },
  // Tutorial 5 stap 3–5: alle toewijzingen, berekend. De metselaar staat al dubbel (binnen- en
  // buitenspouwblad); het stucwerk duurt nog 4 wd met 1 stukadoor.
  'tussen-tut-5-toegewezen': {
    finish: '2027-09-01', projectFinish: '2027-09-01',
    statusDate: null, baselineFinish: null,
    overallocated: { bricklayer: 5 },
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 0 },
    critical: ['frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 3',
      site: '2027-06-07 2027-06-08 3',
      garden: '2027-06-09 2027-06-09 3',
      setout: '2027-06-10 2027-06-10 3',
      excavate: '2027-06-11 2027-06-14 3',
      rebar: '2027-06-15 2027-06-17 3',
      inspection: '2027-06-17 2027-06-17 3',
      pour: '2027-06-18T07:00 2027-06-18T14:00 3.25',
      foundBrick: '2027-06-24 2027-06-25 3',
      floor: '2027-06-28T07:00 2027-06-28T12:00 3.375',
      innerLeaf: '2027-06-29 2027-07-05 3',
      outerLeaf: '2027-06-29 2027-07-06 5',
      roofElements: '2027-07-06T07:00 2027-07-06T14:00 3.25',
      roofing: '2027-07-07 2027-07-08 3',
      frames: '2027-07-14 2027-07-15 0',
      breakThrough: '2027-07-16 2027-07-19 0',
      services: '2027-07-20 2027-07-22 0',
      plaster: '2027-07-23 2027-07-28 0',
      screed: '2027-07-29 2027-07-29 0',
      tiling: '2027-08-27 2027-08-31 0',
      painting: '2027-07-29 2027-08-23 6',
      cleaning: '2027-09-01 2027-09-01 0',
      msHandover: '2027-09-01 2027-09-01 0',
    },
  },
  // Tutorial 5 stap 6–8: Stucwerk "Vast werk" met 2 stukadoors (4 → 2 wd), berekend; nog
  // overbezet, vóór het nivelleren. = `beforeLeveling`.
  'tussen-tut-5-werkregel': {
    finish: '2027-08-30', projectFinish: '2027-08-30',
    statusDate: null, baselineFinish: null,
    overallocated: { bricklayer: 5 },
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 0 },
    critical: ['frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 3',
      site: '2027-06-07 2027-06-08 3',
      garden: '2027-06-09 2027-06-09 3',
      setout: '2027-06-10 2027-06-10 3',
      excavate: '2027-06-11 2027-06-14 3',
      rebar: '2027-06-15 2027-06-17 3',
      inspection: '2027-06-17 2027-06-17 3',
      pour: '2027-06-18T07:00 2027-06-18T14:00 3.25',
      foundBrick: '2027-06-24 2027-06-25 3',
      floor: '2027-06-28T07:00 2027-06-28T12:00 3.375',
      innerLeaf: '2027-06-29 2027-07-05 3',
      outerLeaf: '2027-06-29 2027-07-06 5',
      roofElements: '2027-07-06T07:00 2027-07-06T14:00 3.25',
      roofing: '2027-07-07 2027-07-08 3',
      frames: '2027-07-14 2027-07-15 0',
      breakThrough: '2027-07-16 2027-07-19 0',
      services: '2027-07-20 2027-07-22 0',
      plaster: '2027-07-23 2027-07-26 0',
      screed: '2027-07-27 2027-07-27 0',
      tiling: '2027-08-25 2027-08-27 0',
      painting: '2027-07-27 2027-07-29 6',
      cleaning: '2027-08-30 2027-08-30 0',
      msHandover: '2027-08-30 2027-08-30 0',
    },
  },
  'na-tut-5': {
    ...NA_TUT_5_PLANNING,
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 0 },
  },
  // Tutorial 6 stap 2–7, zoals de stand in het bestand staat: nog niet gerekend (de lezer rekent pas in
  // stap 8), dus de datums van na-tut-5 — wat de lezer die de stappen zelf doet vóór Bereken ziet.
  // Geopend rekent de app wél: zie TUT6_OPENED.
  'tussen-tut-6-baseline': tut6File(null),
  'tussen-tut-6-statusdatum': tut6File('2027-06-28'),
  'tussen-tut-6-voorbereiding': tut6File('2027-06-28'),
  'tussen-tut-6-ontgraven': tut6File('2027-06-28'),
  'tussen-tut-6-fundering': tut6File('2027-06-28'),
  'tussen-tut-6-metselwerk': tut6File('2027-06-28'),
  'na-tut-6': {
    finish: '2027-08-31', projectFinish: '2027-08-31',
    statusDate: '2027-06-28', baselineFinish: '2027-08-30',
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 1 },
    critical: ['foundBrick', 'outerLeaf', 'frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 1',
      site: '2027-06-07 2027-06-08 1',
      garden: '2027-06-09 2027-06-09 1',
      setout: '2027-06-10 2027-06-10 1',
      excavate: '2027-06-11 2027-06-15 0',
      rebar: '2027-06-16 2027-06-18 0',
      inspection: '2027-06-18 2027-06-18 0',
      pour: '2027-06-21T07:00 2027-06-21T14:00 0.25',
      foundBrick: '2027-06-25 2027-06-28 0',
      floor: '2027-06-29T07:00 2027-06-29T12:00 0.375',
      innerLeaf: '2027-06-30 2027-07-06 3',
      outerLeaf: '2027-07-07 2027-07-14 0',
      roofElements: '2027-07-07T07:00 2027-07-07T14:00 3.25',
      roofing: '2027-07-08 2027-07-09 3',
      frames: '2027-07-15 2027-07-16 0',
      breakThrough: '2027-07-19 2027-07-20 0',
      services: '2027-07-21 2027-07-23 0',
      plaster: '2027-07-26 2027-07-27 0',
      screed: '2027-07-28 2027-07-28 0',
      tiling: '2027-08-26 2027-08-30 0',
      painting: '2027-07-28 2027-07-30 6',
      cleaning: '2027-08-31 2027-08-31 0',
      msHandover: '2027-08-31 2027-08-31 0',
    },
  },
};

const PINNED_EXTRA = {
  /** Tutorial 3: einde na alleen de bouwvak (vóór constraint en deadline). */
  finishAfterBouwvak: '2027-08-27',
  bouwvak: { name: 'Bouwvak (Midden)', startDate: '2027-08-02', endDate: '2027-08-20' },
  /** Tutorial 5: na toewijzen en werkregel, vóór nivelleren. */
  beforeLeveling: {
    finish: '2027-08-30',
    overallocated: { bricklayer: 5 },
    critical: ['frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
  },
  plasterDays: { before: 4, after: 2 },
  levelingDelays: { outerLeaf: 5 },
};

/**
 * Tutorial 6: wat de lezer ziet na "Toon mij"/"Opnieuw" (de stand geopend zoals de extensie hem opent). De app
 * rekent een .ifc bij het openen altijd door (`openExampleFromString` → `recompute`), ook een stand die in het
 * bestand nog niet gerekend is. Een statusdatum zonder (volledige) voortgang schuift dan het nog niet begonnen werk
 * naar de statusdatum. `tussen-tut-6-baseline` opent ongewijzigd (geen pin hier) en `tussen-tut-6-metselwerk` opent
 * als na-tut-6: alle invoer is er, de berekening is die van stap 8.
 */
const TUT6_OPENED: Partial<Record<StageId, Pinned>> = {
  // Stap 3 (Toon mij) / stap 4 (Opnieuw): statusdatum zonder voortgang. Alles wat niet begonnen is, ligt op of na
  // de statusdatum: Start bouw 28 juni, oplevering ma 20 sep, 23 kritieke taken, 1 deadline overschreden — wat
  // de tekst bij stap 3 voorspelt als je dan al zou rekenen.
  'tussen-tut-6-statusdatum': {
    finish: '2027-09-20', projectFinish: '2027-09-20',
    statusDate: '2027-06-28', baselineFinish: '2027-08-30',
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 1 },
    critical: ['msStart', 'site', 'garden', 'setout', 'excavate', 'rebar', 'inspection', 'pour', 'foundBrick', 'floor', 'innerLeaf', 'outerLeaf', 'roofElements', 'roofing', 'frames', 'breakThrough', 'services', 'plaster', 'screed', 'painting', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-28 2027-06-28 -6',
      site: '2027-06-28 2027-06-29 -6',
      garden: '2027-06-30 2027-06-30 -6',
      setout: '2027-07-01 2027-07-01 -6',
      excavate: '2027-07-02 2027-07-05 -6',
      rebar: '2027-07-06 2027-07-08 -6',
      inspection: '2027-07-08 2027-07-08 -6',
      pour: '2027-07-09T07:00 2027-07-09T14:00 -5.75',
      foundBrick: '2027-07-15 2027-07-16 -6',
      floor: '2027-07-19T07:00 2027-07-19T12:00 -5.625',
      innerLeaf: '2027-07-20 2027-07-26 -3',
      outerLeaf: '2027-07-27 2027-08-24 -6',
      roofElements: '2027-07-27T07:00 2027-07-27T14:00 -2.75',
      roofing: '2027-07-28 2027-07-29 -3',
      frames: '2027-08-25 2027-08-26 -6',
      breakThrough: '2027-08-27 2027-08-30 -6',
      services: '2027-08-31 2027-09-02 -6',
      plaster: '2027-09-03 2027-09-06 -6',
      screed: '2027-09-07 2027-09-07 -6',
      tiling: '2027-09-15 2027-09-17 -6',
      painting: '2027-09-07 2027-09-09 0',
      cleaning: '2027-09-20 2027-09-20 -6',
      msHandover: '2027-09-20 2027-09-20 -6',
    },
  },
  // Stap 4 (Toon mij) / stap 5 (Opnieuw): de voorbereiding klaar; het ontgraven op de statusdatum.
  // Oplevering di 14 sep, deadline (10 sep) nog overschreden.
  'tussen-tut-6-voorbereiding': {
    finish: '2027-09-14', projectFinish: '2027-09-14',
    statusDate: '2027-06-28', baselineFinish: '2027-08-30',
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 1 },
    critical: ['excavate', 'rebar', 'inspection', 'pour', 'foundBrick', 'floor', 'outerLeaf', 'frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 9',
      site: '2027-06-07 2027-06-08 9',
      garden: '2027-06-09 2027-06-09 9',
      setout: '2027-06-10 2027-06-10 9',
      excavate: '2027-06-28 2027-06-29 -2',
      rebar: '2027-06-30 2027-07-02 -2',
      inspection: '2027-07-02 2027-07-02 -2',
      pour: '2027-07-05T07:00 2027-07-05T14:00 -1.75',
      foundBrick: '2027-07-09 2027-07-12 -2',
      floor: '2027-07-13T07:00 2027-07-13T12:00 -1.625',
      innerLeaf: '2027-07-14 2027-07-20 1',
      outerLeaf: '2027-07-21 2027-07-28 -2',
      roofElements: '2027-07-21T07:00 2027-07-21T14:00 1.25',
      roofing: '2027-07-22 2027-07-23 1',
      frames: '2027-07-29 2027-07-30 -2',
      breakThrough: '2027-08-23 2027-08-24 -2',
      services: '2027-08-25 2027-08-27 -2',
      plaster: '2027-08-30 2027-08-31 -2',
      screed: '2027-09-01 2027-09-01 -2',
      tiling: '2027-09-09 2027-09-13 -2',
      painting: '2027-09-01 2027-09-03 4',
      cleaning: '2027-09-14 2027-09-14 -2',
      msHandover: '2027-09-14 2027-09-14 -2',
    },
  },
  // Stap 5 (Toon mij) / stap 6 (Opnieuw): het ontgraven klaar (15 juni); de wapening op de statusdatum.
  // Oplevering vr 10 sep, precies op de deadline.
  'tussen-tut-6-ontgraven': {
    finish: '2027-09-10', projectFinish: '2027-09-10',
    statusDate: '2027-06-28', baselineFinish: '2027-08-30',
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 1 },
    critical: ['rebar', 'inspection', 'foundBrick', 'outerLeaf', 'frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 9',
      site: '2027-06-07 2027-06-08 9',
      garden: '2027-06-09 2027-06-09 9',
      setout: '2027-06-10 2027-06-10 9',
      excavate: '2027-06-11 2027-06-15 8',
      rebar: '2027-06-28 2027-06-30 0',
      inspection: '2027-06-30 2027-06-30 0',
      pour: '2027-07-01T07:00 2027-07-01T14:00 0.25',
      foundBrick: '2027-07-07 2027-07-08 0',
      floor: '2027-07-09T07:00 2027-07-09T12:00 0.375',
      innerLeaf: '2027-07-12 2027-07-16 3',
      outerLeaf: '2027-07-19 2027-07-26 0',
      roofElements: '2027-07-19T07:00 2027-07-19T14:00 3.25',
      roofing: '2027-07-20 2027-07-21 3',
      frames: '2027-07-27 2027-07-28 0',
      breakThrough: '2027-07-29 2027-07-30 0',
      services: '2027-08-23 2027-08-25 0',
      plaster: '2027-08-26 2027-08-27 0',
      screed: '2027-08-30 2027-08-30 0',
      tiling: '2027-09-07 2027-09-09 0',
      painting: '2027-08-30 2027-09-01 6',
      cleaning: '2027-09-10 2027-09-10 0',
      msHandover: '2027-09-10 2027-09-10 0',
    },
  },
  // Stap 6 (Toon mij) / stap 7 (Opnieuw): wapening, keuring en stort klaar; het funderingsmetselwerk nog niet
  // begonnen, dus op de statusdatum (28–29 juni). Oplevering wo 1 sep.
  'tussen-tut-6-fundering': {
    finish: '2027-09-01', projectFinish: '2027-09-01',
    statusDate: '2027-06-28', baselineFinish: '2027-08-30',
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 1 },
    critical: ['foundBrick', 'outerLeaf', 'frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
    table: {
      msStart: '2027-06-07 2027-06-07 2',
      site: '2027-06-07 2027-06-08 2',
      garden: '2027-06-09 2027-06-09 2',
      setout: '2027-06-10 2027-06-10 2',
      excavate: '2027-06-11 2027-06-15 1',
      rebar: '2027-06-16 2027-06-18 1',
      inspection: '2027-06-18 2027-06-18 1',
      pour: '2027-06-21T07:00 2027-06-21T14:00 1.25',
      foundBrick: '2027-06-28 2027-06-29 0',
      floor: '2027-06-30T07:00 2027-06-30T12:00 0.375',
      innerLeaf: '2027-07-01 2027-07-07 3',
      outerLeaf: '2027-07-08 2027-07-15 0',
      roofElements: '2027-07-08T07:00 2027-07-08T14:00 3.25',
      roofing: '2027-07-09 2027-07-12 3',
      frames: '2027-07-16 2027-07-19 0',
      breakThrough: '2027-07-20 2027-07-21 0',
      services: '2027-07-22 2027-07-26 0',
      plaster: '2027-07-27 2027-07-28 0',
      screed: '2027-07-29 2027-07-29 0',
      tiling: '2027-08-27 2027-08-31 0',
      painting: '2027-07-29 2027-08-23 6',
      cleaning: '2027-09-01 2027-09-01 0',
      msHandover: '2027-09-01 2027-09-01 0',
    },
  },
  'tussen-tut-6-metselwerk': PINNED['na-tut-6'],
};

function tableOf(f: StageFacts): Partial<Record<TaskKey, string>> {
  const out: Partial<Record<TaskKey, string>> = {};
  for (const [k, e] of Object.entries(f.early) as [TaskKey, { start: string; finish: string }][]) {
    out[k] = `${e.start} ${e.finish} ${f.totalFloat[k]}`;
  }
  return out;
}

function compareFacts(label: string, got: StageFacts, want: Pinned): void {
  eq(`${label} einde oplevering`, got.finish, want.finish);
  eq(`${label} laatste einde`, got.projectFinish, want.projectFinish);
  eq(`${label} statusdatum`, got.statusDate, want.statusDate);
  eq(`${label} baseline-einde`, got.baselineFinish, want.baselineFinish);
  eq(`${label} overbezetting`, got.overallocated, want.overallocated);
  eq(`${label} tellingen`, got.counts, want.counts);
  eq(`${label} kritieke taken`, got.critical, want.critical);
  const table = tableOf(got);
  for (const k of new Set([...Object.keys(want.table), ...Object.keys(table)]) as Set<TaskKey>) {
    eq(`${label} ${k} (start einde speling)`, table[k], want.table[k]);
  }
}

/** Alles behalve de namen moet tussen nl en en gelijk zijn. */
function comparableBuild(b: TutorialBuild): unknown {
  return {
    stages: b.stages.map(s => ({ id: s.id, facts: s.facts })),
    finishAfterBouwvak: b.finishAfterBouwvak,
    bouwvak: b.bouwvak,
    beforeLeveling: b.beforeLeveling,
    plasterDays: b.plasterDays,
    levelingDelays: b.levelingDelays,
  };
}

async function main(): Promise<void> {
  // ── 1+2. nl: de gepinde getallen ──
  console.log('-- tutorial-project: nl, gepinde getallen per stand --');
  const nl = buildTutorialProject('nl');
  eq('standen (volgorde)', nl.stages.map(s => s.id), [...STAGE_IDS]);
  for (const stage of nl.stages) {
    const pinId = stage.id === 'na-tut-7' ? 'na-tut-6' : stage.id;
    compareFacts(`nl/${stage.id}`, stage.facts, PINNED[pinId]);
  }
  const last = nl.stages[nl.stages.length - 1];
  const six = nl.stages.find(s => s.id === 'na-tut-6')!;
  ok('na-tut-7 is dezelfde projectdata als na-tut-6', last.ifc === six.ifc);
  eq('tut-3 einde na alleen de bouwvak', nl.finishAfterBouwvak, PINNED_EXTRA.finishAfterBouwvak);
  eq('tut-3 bouwvak', nl.bouwvak, PINNED_EXTRA.bouwvak);
  eq('tut-5 vóór nivelleren: einde', nl.beforeLeveling.finish, PINNED_EXTRA.beforeLeveling.finish);
  eq('tut-5 vóór nivelleren: overbezetting', nl.beforeLeveling.overallocated, PINNED_EXTRA.beforeLeveling.overallocated);
  eq('tut-5 vóór nivelleren: kritieke taken', nl.beforeLeveling.critical, PINNED_EXTRA.beforeLeveling.critical);
  eq('tut-5 stucwerk (werkdagen) vóór/na werkregel', nl.plasterDays, PINNED_EXTRA.plasterDays);
  eq('tut-5 nivelleervertraging', nl.levelingDelays, PINNED_EXTRA.levelingDelays);

  // De beoogde effecten nog eens expliciet (los van de pin, zodat een herpin ze niet stil opheft).
  const f = (id: StageId) => nl.stages.find(s => s.id === id)!.facts;
  ok('tut-2: relaties schuiven de oplevering op t.o.v. tut-1', f('na-tut-2').finish > f('na-tut-1').projectFinish);
  ok('tut-3: de bouwvak schuift de oplevering op', nl.finishAfterBouwvak > f('na-tut-2').finish);
  ok('tut-3: de constraint schuift de oplevering verder op', f('na-tut-3').finish > nl.finishAfterBouwvak);
  ok('tut-3: de deadline wordt gehaald', f('na-tut-3').finish <= '2027-09-10');
  ok('tut-5: vóór nivelleren is (alleen) de metselaar overbezet',
    JSON.stringify(Object.keys(nl.beforeLeveling.overallocated)) === JSON.stringify(['bricklayer']));
  ok('tut-5: na nivelleren is niemand overbezet', Object.keys(f('na-tut-5').overallocated).length === 0);
  ok('tut-6: de uitloop verschuift de oplevering t.o.v. de baseline',
    f('na-tut-6').finish > (f('na-tut-6').baselineFinish ?? '9999'));

  // ── 3. en: identiek op de namen na ──
  console.log('-- tutorial-project: en, identiek aan nl --');
  const en = buildTutorialProject('en');
  eq('en = nl (alle feiten)', comparableBuild(en), comparableBuild(nl));
  for (const t of TASKS) ok(`taaknaam ${t.key} is vertaald`, t.name.nl !== t.name.en);
  for (const r of RESOURCES) ok(`resourcenaam ${r.key} is vertaald`, r.name.nl !== r.name.en);
  {
    const p = readIFC(en.stages.find(s => s.id === 'na-tut-5')!.ifc);
    ok('en-bestand draagt Engelse taaknamen', p.tasks.some(t => t.name === 'Build outer cavity leaf'));
    ok('en-bestand draagt geen Nederlandse taaknamen', !p.tasks.some(t => t.name === 'Buitenspouwblad metselen'));
    eq('en-projectnaam', p.project.name, 'House extension');
    eq('en-kalendernaam', p.calendar.name, 'Construction calendar NL');
  }
  // Tutorial 1 maakt de mijlpalen met Start › Taken › Mijlpaal; het bestand moet hetzelfde taaktype
  // dragen als die knop (Start-/Eindmijlpaal = Overig, Inspectiemoment = Aanwezigheid), ook na IFC.
  {
    const p = readIFC(nl.stages.find(s => s.id === 'na-tut-1')!.ifc);
    const typeOf = (key: TaskKey) => p.tasks.find(t => t.name === TASKS.find(d => d.key === key)!.name.nl)?.taskType;
    eq('na-tut-1 taaktype Start bouw', typeOf('msStart'), 'USERDEFINED');
    eq('na-tut-1 taaktype Inspectie wapening', typeOf('inspection'), 'ATTENDANCE');
    eq('na-tut-1 taaktype Oplevering', typeOf('msHandover'), 'USERDEFINED');
    eq('na-tut-1 taaktype gewone taak', typeOf('site'), 'CONSTRUCTION');
  }

  // ── 4. openen zoals de app en opnieuw rekenen ──
  console.log('-- tutorial-project: openen via de voorbeeldroute en herberekenen --');
  for (const build of [nl, en]) {
    for (const stage of build.stages) {
      const label = `${build.lang}/${stage.id} heropend`;
      await S().openExampleFromString(stage.ifc, `${stage.id}.ifc`);
      eq(`${label}: geen datumverschuiving na herberekenen`, S().recordedDates, null);
      ok(`${label}: berekening zonder fout`, !S().cpmResult?.error);
      // Een tussenstand van tutorial 6 is in het bestand nog niet gerekend; geopend wél (TUT6_OPENED).
      const opened = TUT6_OPENED[stage.id];
      if (opened) compareFacts(`${label}:`, collectStageFacts(build.lang), opened);
      else eq(`${label}: feiten`, collectStageFacts(build.lang), stage.facts);
    }
  }

  await whatIfs(nl);
  for (const build of [nl, en]) await tut6Stages(build);
}

/** Taak-id in het geopende document op naam (nl). */
function taskIdOf(key: TaskKey): string {
  const name = TASKS.find(d => d.key === key)!.name.nl;
  const t = S().tasks.find(x => x.name === name);
  if (!t) throw new Error(`check-tutorial-project: taak ${key} niet gevonden`);
  return t.id;
}

/**
 * 5. De wat-als-stappen die de tutorialtekst doorrekent maar die geen eigen stand zijn: open de
 *    stand zoals de lezer hem heeft, doe de wijziging, bereken, en vergelijk met de tekst.
 */
async function whatIfs(nl: TutorialBuild): Promise<void> {
  console.log('-- tutorial-project: wat-als-stappen uit de tutorialtekst --');
  const ifcOf = (id: StageId) => nl.stages.find(s => s.id === id)!.ifc;

  // Statusbalk "Kritiek pad: N taken, M werkdagen" = aantal kritieke taken + projectDuration.
  await S().openExampleFromString(ifcOf('na-tut-2'), 'na-tut-2.ifc');
  eq('tut-2 statusbalk: werkdagen', S().cpmResult?.projectDuration, 45);
  eq('tut-2 statusbalk: kritieke taken', collectStageFacts('nl').critical.length, 21);

  // Tutorial 2, uitloop: Buitenspouwblad metselen 9 i.p.v. 6 werkdagen.
  {
    const id = taskIdOf('outerLeaf');
    const t = S().tasks.find(x => x.id === id)!;
    S().updateTask(id, { time: { ...t.time, scheduleDuration: 9 } });
    S().runCPM();
    const f = collectStageFacts('nl');
    eq('tut-2 uitloop: einde oplevering', f.finish, '2027-08-09');
    eq('tut-2 uitloop: buitenspouwblad klaar', f.early.outerLeaf?.finish, '2027-07-09');
    eq('tut-2 uitloop: speling binnenspouwblad', f.totalFloat.innerLeaf, 1);
    eq('tut-2 uitloop: speling dakbedekking', f.totalFloat.roofing, 1);
    eq('tut-2 uitloop: statusbalk werkdagen', S().cpmResult?.projectDuration, 46);
    eq('tut-2 uitloop: kritieke taken', f.critical.length, 19);
  }

  await S().openExampleFromString(ifcOf('tussen-tut-3-bouwvak'), 'tussen-tut-3-bouwvak.ifc');
  eq('tut-3 na bouwvak: statusbalk werkdagen', S().cpmResult?.projectDuration, 45);

  await S().openExampleFromString(ifcOf('na-tut-3'), 'na-tut-3.ifc');
  eq('tut-3 na constraint: statusbalk werkdagen', S().cpmResult?.projectDuration, 48);
  eq('tut-3 na constraint: kritieke taken', collectStageFacts('nl').critical.length, 8);

  // Tutorial 3, een deadline die je niet haalt: 27 augustus op de oplevering.
  {
    S().updateTask(taskIdOf('msHandover'), { deadline: '2027-08-27' });
    S().runCPM();
    const f = collectStageFacts('nl');
    eq('tut-3 deadline 27-08: gemiste deadlines', (S().cpmResult?.missedDeadlineTaskIds ?? []).length, 1);
    eq('tut-3 deadline 27-08: speling oplevering', f.totalFloat.msHandover, -3);
    eq('tut-3 deadline 27-08: kritieke taken', f.critical.length, 21);
    eq('tut-3 deadline 27-08: einde oplevering', f.finish, '2027-09-01');
  }

  await tut5Stages(nl);
}

/**
 * 6. De tussenstanden van tutorial 5, geopend zoals "Toon mij"/"Opnieuw" van de extensie ze
 *    opent: wat de lezer op de statusbalk, in het histogram en bij het stucwerk ziet. De
 *    tutorialtekst na stap 7 + F5: Stucwerk 23–26 juli (2 wd), "Einde: 30-08-2027, Kritiek pad: 8
 *    taken, 46 werkdagen", Metselaar overbezet 29-06-2027 – 05-07-2027.
 */
async function tut5Stages(nl: TutorialBuild): Promise<void> {
  console.log('-- tutorial-project: tussenstanden tutorial 5 --');
  const ifcOf = (id: StageId) => nl.stages.find(s => s.id === id)!.ifc;
  const plaster = () => S().tasks.find(t => t.id === taskIdOf('plaster'))!;
  const plasterUnits = () => S().assignments.filter(a => a.taskId === taskIdOf('plaster')).map(a => a.unitsPerDay);
  const bricklayerDays = () => {
    const res = S().resources.find(r => r.name === RESOURCES.find(x => x.key === 'bricklayer')!.name.nl);
    return res ? (S().resourceLoadResult?.overallocatedDays[res.id] ?? []) : [];
  };
  const resourceNames = () => S().resources.map(r => `${r.name} ${r.type} ${r.maxUnits}${r.unitOfMeasure ? ` ${r.unitOfMeasure}` : ''}`);
  const fiveResources = [
    'Timmerploeg CREW 1', 'Metselaar LABOR 1', 'Mobiele kraan EQUIPMENT 1', 'Stukadoor SUBCONTRACTOR 2', 'Beton MATERIAL 50 m³',
  ];
  const metselaarOver = ['2027-06-29', '2027-06-30', '2027-07-01', '2027-07-02', '2027-07-05'];

  await S().openExampleFromString(ifcOf('tussen-tut-5-resources'), 'tussen-tut-5-resources.ifc');
  eq('tut-5 resources: de vijf resources', resourceNames(), fiveResources);
  eq('tut-5 resources: statusbalk werkdagen', S().cpmResult?.projectDuration, 48);
  eq('tut-5 resources: geen toewijzingen', S().assignments.length, 0);

  await S().openExampleFromString(ifcOf('tussen-tut-5-toegewezen'), 'tussen-tut-5-toegewezen.ifc');
  eq('tut-5 toegewezen: statusbalk werkdagen', S().cpmResult?.projectDuration, 48);
  eq('tut-5 toegewezen: kritieke taken', collectStageFacts('nl').critical.length, 8);
  eq('tut-5 toegewezen: metselaar overbezet', bricklayerDays(), metselaarOver);
  eq('tut-5 toegewezen: stucwerk werkregel', plaster().workRule ?? null, null);
  eq('tut-5 toegewezen: stucwerk eenh./dag', plasterUnits(), [1]);
  eq('tut-5 toegewezen: stucwerk werkdagen', plaster().time.scheduleDuration, 4);
  {
    const concrete = S().resources.find(r => r.name === 'Beton')!;
    eq('tut-5 toegewezen: beton 8 m³/dag op het storten',
      S().assignments.filter(a => a.resourceId === concrete.id).map(a => [a.taskId === taskIdOf('pour'), a.unitsPerDay]), [[true, 8]]);
  }

  await S().openExampleFromString(ifcOf('tussen-tut-5-werkregel'), 'tussen-tut-5-werkregel.ifc');
  eq('tut-5 werkregel: statusbalk werkdagen', S().cpmResult?.projectDuration, 46);
  eq('tut-5 werkregel: kritieke taken', collectStageFacts('nl').critical.length, 8);
  eq('tut-5 werkregel: einde oplevering', collectStageFacts('nl').finish, '2027-08-30');
  eq('tut-5 werkregel: metselaar overbezet', bricklayerDays(), metselaarOver);
  eq('tut-5 werkregel: stucwerk werkregel', plaster().workRule ?? null, 'FIXED_WORK');
  eq('tut-5 werkregel: stucwerk eenh./dag', plasterUnits(), [2]);
  eq('tut-5 werkregel: stucwerk werkdagen', plaster().time.scheduleDuration, 2);
  eq('tut-5 werkregel: stucwerk datums', [plaster().time.earlyStart, plaster().time.earlyFinish], ['2027-07-23', '2027-07-26']);
}

/**
 * 7. De tussenstanden van tutorial 6, geopend zoals "Toon mij"/"Opnieuw" van de extensie ze opent (nl en en).
 *    De app rekent bij het openen: de statusbalk staat dan niet op "Verouderd", en de datums zijn die van een
 *    berekening met de voortgang tot dan toe (TUT6_OPENED). Hier: statusbalk ("Einde", "Kritiek pad: N taken,
 *    M werkdagen", overschreden deadlines), de actieve baseline, de statusdatum en de ingevoerde voortgang.
 */
async function tut6Stages(build: TutorialBuild): Promise<void> {
  const { lang } = build;
  console.log(`-- tutorial-project: tussenstanden tutorial 6 (${lang}) --`);
  const ifcOf = (id: StageId) => build.stages.find(s => s.id === id)!.ifc;
  const task = (key: TaskKey) => {
    const name = TASKS.find(d => d.key === key)!.name[lang];
    return S().tasks.find(t => t.name === name)!;
  };
  const progress = (key: TaskKey) => {
    const t = task(key).time;
    return `${t.completion} ${t.actualStart ?? '-'} ${t.actualFinish ?? '-'}`;
  };
  const phase = (i: number) => S().tasks.filter(t => t.childIds.length > 0)[i].time.completion;
  const done = (start: string, finish: string) => `1 ${start} ${finish}`;
  const voorbereiding = {
    msStart: done('2027-06-07', '2027-06-07'), site: done('2027-06-07', '2027-06-08'),
    garden: done('2027-06-09', '2027-06-09'), setout: done('2027-06-10', '2027-06-10'),
  };
  const ontgraven = { excavate: done('2027-06-11', '2027-06-15') };
  const fundering = {
    rebar: done('2027-06-16', '2027-06-18'), inspection: done('2027-06-18', '2027-06-18'),
    pour: done('2027-06-21T07:00', '2027-06-21T14:00'),
  };
  const metselwerk = { foundBrick: '0.5 2027-06-25 -' };
  const notStarted = { msStart: '0 - -', excavate: '0 - -', rebar: '0 - -', foundBrick: '0 - -' };
  const expected: Record<string, {
    duration: number; critical: number; finish: string; missed: number; statusDate: string | null;
    progress: Partial<Record<TaskKey, string>>; phases: number[];
  }> = {
    'tussen-tut-6-baseline': {
      duration: 46, critical: 17, finish: '2027-08-30', missed: 0, statusDate: null,
      progress: notStarted, phases: [0, 0, 0, 0],
    },
    'tussen-tut-6-statusdatum': {
      duration: 46, critical: 23, finish: '2027-09-20', missed: 1, statusDate: '2027-06-28',
      progress: notStarted, phases: [0, 0, 0, 0],
    },
    'tussen-tut-6-voorbereiding': {
      duration: 57, critical: 15, finish: '2027-09-14', missed: 1, statusDate: '2027-06-28',
      progress: { ...notStarted, ...voorbereiding }, phases: [1, 0, 0, 0],
    },
    'tussen-tut-6-ontgraven': {
      duration: 55, critical: 12, finish: '2027-09-10', missed: 0, statusDate: '2027-06-28',
      progress: { ...notStarted, ...voorbereiding, ...ontgraven }, phases: [1, 0.238, 0, 0],
    },
    'tussen-tut-6-fundering': {
      duration: 48, critical: 10, finish: '2027-09-01', missed: 0, statusDate: '2027-06-28',
      progress: { ...notStarted, ...voorbereiding, ...ontgraven, ...fundering }, phases: [1, 0.69, 0, 0],
    },
    'tussen-tut-6-metselwerk': {
      duration: 47, critical: 10, finish: '2027-08-31', missed: 0, statusDate: '2027-06-28',
      progress: { ...voorbereiding, ...ontgraven, ...fundering, ...metselwerk }, phases: [1, 0.81, 0, 0],
    },
  };
  for (const [id, want] of Object.entries(expected)) {
    const label = `tut-6 ${lang}/${id} geopend`;
    await S().openExampleFromString(ifcOf(id as StageId), `${id}.ifc`);
    const f = collectStageFacts(lang);
    eq(`${label}: niet verouderd`, S().scheduleStale, false);
    eq(`${label}: statusbalk einde`, f.finish, want.finish);
    eq(`${label}: statusbalk werkdagen`, S().cpmResult?.projectDuration, want.duration);
    eq(`${label}: statusbalk kritieke taken`, f.critical.length, want.critical);
    eq(`${label}: overschreden deadlines`, (S().cpmResult?.missedDeadlineTaskIds ?? []).length, want.missed);
    eq(`${label}: statusdatum`, S().project.statusDate ?? null, want.statusDate);
    eq(`${label}: actieve baseline`,
      S().baselines.filter(bl => bl.id === S().activeBaselineId).map(bl => [bl.name, bl.projectEnd.slice(0, 10)]),
      [[lang === 'nl' ? 'Basisplanning' : 'Baseline', '2027-08-30']]);
    for (const [k, v] of Object.entries(want.progress)) eq(`${label}: voortgang ${k}`, progress(k as TaskKey), v);
    eq(`${label}: voortgang fasen`, [0, 1, 2, 3].map(phase), want.phases);
  }
}

main().then(() => {
  if (diffs.length === 0) {
    console.log(`OK  tutorial-project: alle checks groen (${checks})`);
    process.exit(0);
  } else {
    console.log(`XX  tutorial-project: ${diffs.length} afwijking(en) van ${checks}`);
    for (const d of diffs) console.log(`   - ${d}`);
    process.exit(1);
  }
}, (err: unknown) => {
  console.log(`XX  tutorial-project: ${(err as Error).stack ?? String(err)}`);
  process.exit(1);
});
