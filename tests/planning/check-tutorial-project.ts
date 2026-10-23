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
//  8. De volledige feestdagen en generatieherkomst per stand, nl en en: wizardspanne t/m 2030;
//     vanaf de expliciete generatie in tutorial 3 t/m 2028 (berekend projecteinde in 2027).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { readFileSync } from 'node:fs';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { computeVariance } from '@/engine/variance';
import { payloadFromImport } from '@/state/documentContract';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor, solveOptionsFor } from '@/engine/scheduler/solveInput';
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { isLeafTask } from '@/utils/taskHierarchy';
import { writeLevelingResult } from '@/utils/taskDefaults';
import { effHoursPerDay, effectiveCalendarOf } from '@/utils/taskDuration';
import { useAppStore } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import { materializeHolidays } from '@/engine/calendar/generateCalendarHolidays';
import {
  buildTutorialProject, collectStageFacts, STAGE_IDS, TASKS, RESOURCES, BOUWVAK_REGION,
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

/** F2-tussenstand; F3 → de vaste urenreferentie in minute-model-tutorial-f3.json (§3.14).
 *  De planning van na-tut-5: ook die van de tussenstanden van tutorial 6 in het BESTAND (daar is nog
 *  niet gerekend; de lezer rekent pas in stap 8).
 *  F3c-tussenstand (B2, F3c-motor → doel): de belasting en de nivelleerder tellen het dagdeel al (F3c
 *  deel 3), de motor plaatst een dagtaak nog als hele dagen. De belasting van een voorganger loopt
 *  daardoor door in de eerste dag van zijn opvolger. De nivelleerder schuift het binnenspouwblad 1 en
 *  het buitenspouwblad 6 werkdagen; met de dagenloper van de motor wordt dat weer alleen het
 *  buitenspouwblad, 5 werkdagen (getoetst in `checkF3Reference`). Speling en datums vanaf het
 *  binnenspouwblad volgen die tussenstand. */
const NA_TUT_5_PLANNING: Pick<Pinned, 'finish' | 'projectFinish' | 'critical' | 'table'> = {
  finish: "2027-08-30T16:00", projectFinish: "2027-08-30T16:00",
  critical: [
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
  table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 1",
      "site": "2027-06-07T07:00 2027-06-08T16:00 1",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 1",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 1",
      "excavate": "2027-06-11T07:00 2027-06-14T16:00 1",
      "rebar": "2027-06-15T07:00 2027-06-17T16:00 1",
      "inspection": "2027-06-17T16:00 2027-06-17T16:00 1",
      "pour": "2027-06-18T07:00 2027-06-18T14:00 1",
      "foundBrick": "2027-06-23T14:00 2027-06-24T16:00 1",
      "floor": "2027-06-25T07:00 2027-06-25T12:00 1",
      "innerLeaf": "2027-06-28T13:00 2027-07-02T16:00 5",
      "outerLeaf": "2027-07-05T13:00 2027-07-12T16:00 1",
      "roofElements": "2027-07-05T07:00 2027-07-05T14:00 5",
      "roofing": "2027-07-05T14:00 2027-07-06T16:00 5",
      "frames": "2027-07-14T07:00 2027-07-15T16:00 0",
      "breakThrough": "2027-07-16T07:00 2027-07-19T16:00 0",
      "services": "2027-07-20T07:00 2027-07-22T16:00 0",
      "plaster": "2027-07-23T07:00 2027-07-26T16:00 0",
      "screed": "2027-07-27T07:00 2027-07-27T16:00 0",
      "tiling": "2027-08-25T07:00 2027-08-27T16:00 0",
      "painting": "2027-07-27T07:00 2027-07-29T16:00 6",
      "cleaning": "2027-08-30T07:00 2027-08-30T16:00 0",
      "msHandover": "2027-08-30T16:00 2027-08-30T16:00 0"
    },
};

/** Een tussenstand van tutorial 6 in het bestand: de planning van na-tut-5, met de baseline. */
function tut6File(statusDate: string | null): Pinned {
  return {
    ...NA_TUT_5_PLANNING,
    statusDate, baselineFinish: '2027-08-30T16:00',
    overallocated: {},
    counts: { tasks: 27, milestones: 3, sequences: 24, resources: 5, assignments: 12, baselines: 1 },
  };
}

// F2-tussenstand vanaf tutorial 4; F3 → minute-model-tutorial-f3.json (§3.14).
// D1/D2/D7 en B6 zijn definitief; broninvoer en letterlijke actuals blijven bewaard.
// ── De gepinde getallen (nl; en moet identiek zijn). Tutorial 7 = stand 6. ─────────────────────
const PINNED: Record<Exclude<StageId, 'na-tut-7'>, Pinned> = {
  'start-tut-1': {
    finish: "", projectFinish: "",
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: {
      "tasks": 0,
      "milestones": 0,
      "sequences": 0,
      "resources": 0,
      "assignments": 0,
      "baselines": 0
    },
    critical: [],
    table: {},
  },
  'na-tut-1': {
    finish: "2027-06-07T16:00", projectFinish: "2027-06-14T16:00",
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 0,
      "resources": 0,
      "assignments": 0,
      "baselines": 0
    },
    critical: [
      "outerLeaf"
    ],
    table: {
      "msStart": "2027-06-07T16:00 2027-06-07T16:00 5",
      "site": "2027-06-07T07:00 2027-06-08T16:00 4",
      "garden": "2027-06-07T07:00 2027-06-07T16:00 5",
      "setout": "2027-06-07T07:00 2027-06-07T16:00 5",
      "excavate": "2027-06-07T07:00 2027-06-08T16:00 4",
      "rebar": "2027-06-07T07:00 2027-06-09T16:00 3",
      "inspection": "2027-06-07T16:00 2027-06-07T16:00 5",
      "pour": "2027-06-07T07:00 2027-06-07T16:00 5",
      "foundBrick": "2027-06-07T07:00 2027-06-08T16:00 4",
      "floor": "2027-06-07T07:00 2027-06-07T16:00 5",
      "innerLeaf": "2027-06-07T07:00 2027-06-11T16:00 1",
      "outerLeaf": "2027-06-07T07:00 2027-06-14T16:00 0",
      "roofElements": "2027-06-07T07:00 2027-06-07T16:00 5",
      "roofing": "2027-06-07T07:00 2027-06-08T16:00 4",
      "frames": "2027-06-07T07:00 2027-06-08T16:00 4",
      "breakThrough": "2027-06-07T07:00 2027-06-08T16:00 4",
      "services": "2027-06-07T07:00 2027-06-09T16:00 3",
      "plaster": "2027-06-07T07:00 2027-06-10T16:00 2",
      "screed": "2027-06-07T07:00 2027-06-07T16:00 5",
      "tiling": "2027-06-07T07:00 2027-06-09T16:00 3",
      "painting": "2027-06-07T07:00 2027-06-09T16:00 3",
      "cleaning": "2027-06-07T07:00 2027-06-07T16:00 5",
      "msHandover": "2027-06-07T16:00 2027-06-07T16:00 5"
    },
  },
  'na-tut-2': {
    finish: "2027-08-06T16:00", projectFinish: "2027-08-06T16:00",
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 0,
      "assignments": 0,
      "baselines": 0
    },
    critical: [
      "msStart",
      "site",
      "garden",
      "setout",
      "excavate",
      "rebar",
      "inspection",
      "pour",
      "foundBrick",
      "floor",
      "innerLeaf",
      "roofElements",
      "roofing",
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 0",
      "site": "2027-06-07T07:00 2027-06-08T16:00 0",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 0",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 0",
      "excavate": "2027-06-11T07:00 2027-06-14T16:00 0",
      "rebar": "2027-06-15T07:00 2027-06-17T16:00 0",
      "inspection": "2027-06-17T16:00 2027-06-17T16:00 0",
      "pour": "2027-06-18T07:00 2027-06-18T16:00 0",
      "foundBrick": "2027-06-24T07:00 2027-06-25T16:00 0",
      "floor": "2027-06-28T07:00 2027-06-28T16:00 0",
      "innerLeaf": "2027-06-29T07:00 2027-07-05T16:00 0",
      "outerLeaf": "2027-06-29T07:00 2027-07-06T16:00 2",
      "roofElements": "2027-07-06T07:00 2027-07-06T16:00 0",
      "roofing": "2027-07-07T07:00 2027-07-08T16:00 0",
      "frames": "2027-07-09T07:00 2027-07-12T16:00 0",
      "breakThrough": "2027-07-13T07:00 2027-07-14T16:00 0",
      "services": "2027-07-15T07:00 2027-07-19T16:00 0",
      "plaster": "2027-07-20T07:00 2027-07-23T16:00 0",
      "screed": "2027-07-26T07:00 2027-07-26T16:00 0",
      "tiling": "2027-08-03T07:00 2027-08-05T16:00 0",
      "painting": "2027-07-26T07:00 2027-07-28T16:00 6",
      "cleaning": "2027-08-06T07:00 2027-08-06T16:00 0",
      "msHandover": "2027-08-06T16:00 2027-08-06T16:00 0"
    },
  },
  'tussen-tut-3-bouwvak': {
    finish: "2027-08-27T16:00", projectFinish: "2027-08-27T16:00",
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 0,
      "assignments": 0,
      "baselines": 0
    },
    critical: [
      "msStart",
      "site",
      "garden",
      "setout",
      "excavate",
      "rebar",
      "inspection",
      "pour",
      "foundBrick",
      "floor",
      "innerLeaf",
      "roofElements",
      "roofing",
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 0",
      "site": "2027-06-07T07:00 2027-06-08T16:00 0",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 0",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 0",
      "excavate": "2027-06-11T07:00 2027-06-14T16:00 0",
      "rebar": "2027-06-15T07:00 2027-06-17T16:00 0",
      "inspection": "2027-06-17T16:00 2027-06-17T16:00 0",
      "pour": "2027-06-18T07:00 2027-06-18T16:00 0",
      "foundBrick": "2027-06-24T07:00 2027-06-25T16:00 0",
      "floor": "2027-06-28T07:00 2027-06-28T16:00 0",
      "innerLeaf": "2027-06-29T07:00 2027-07-05T16:00 0",
      "outerLeaf": "2027-06-29T07:00 2027-07-06T16:00 2",
      "roofElements": "2027-07-06T07:00 2027-07-06T16:00 0",
      "roofing": "2027-07-07T07:00 2027-07-08T16:00 0",
      "frames": "2027-07-09T07:00 2027-07-12T16:00 0",
      "breakThrough": "2027-07-13T07:00 2027-07-14T16:00 0",
      "services": "2027-07-15T07:00 2027-07-19T16:00 0",
      "plaster": "2027-07-20T07:00 2027-07-23T16:00 0",
      "screed": "2027-07-26T07:00 2027-07-26T16:00 0",
      "tiling": "2027-08-24T07:00 2027-08-26T16:00 0",
      "painting": "2027-07-26T07:00 2027-07-28T16:00 6",
      "cleaning": "2027-08-27T07:00 2027-08-27T16:00 0",
      "msHandover": "2027-08-27T16:00 2027-08-27T16:00 0"
    },
  },
  'na-tut-3': {
    finish: "2027-09-01T16:00", projectFinish: "2027-09-01T16:00",
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 0,
      "assignments": 0,
      "baselines": 0
    },
    critical: [
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 3",
      "site": "2027-06-07T07:00 2027-06-08T16:00 3",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 3",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 3",
      "excavate": "2027-06-11T07:00 2027-06-14T16:00 3",
      "rebar": "2027-06-15T07:00 2027-06-17T16:00 3",
      "inspection": "2027-06-17T16:00 2027-06-17T16:00 3",
      "pour": "2027-06-18T07:00 2027-06-18T16:00 3",
      "foundBrick": "2027-06-24T07:00 2027-06-25T16:00 3",
      "floor": "2027-06-28T07:00 2027-06-28T16:00 3",
      "innerLeaf": "2027-06-29T07:00 2027-07-05T16:00 3",
      "outerLeaf": "2027-06-29T07:00 2027-07-06T16:00 5",
      "roofElements": "2027-07-06T07:00 2027-07-06T16:00 3",
      "roofing": "2027-07-07T07:00 2027-07-08T16:00 3",
      "frames": "2027-07-14T07:00 2027-07-15T16:00 0",
      "breakThrough": "2027-07-16T07:00 2027-07-19T16:00 0",
      "services": "2027-07-20T07:00 2027-07-22T16:00 0",
      "plaster": "2027-07-23T07:00 2027-07-28T16:00 0",
      "screed": "2027-07-29T07:00 2027-07-29T16:00 0",
      "tiling": "2027-08-27T07:00 2027-08-31T16:00 0",
      "painting": "2027-07-29T07:00 2027-08-23T16:00 6",
      "cleaning": "2027-09-01T07:00 2027-09-01T16:00 0",
      "msHandover": "2027-09-01T16:00 2027-09-01T16:00 0"
    },
  },
  'na-tut-4': {
    finish: "2027-09-01T16:00", projectFinish: "2027-09-01T16:00",
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 0,
      "assignments": 0,
      "baselines": 0
    },
    critical: [
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 6",
      "site": "2027-06-07T07:00 2027-06-08T16:00 6",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 6",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 6",
      "excavate": "2027-06-11T07:00 2027-06-14T16:00 6",
      "rebar": "2027-06-15T07:00 2027-06-17T16:00 6",
      "inspection": "2027-06-17T16:00 2027-06-17T16:00 6",
      "pour": "2027-06-18T07:00 2027-06-18T14:00 6",
      "foundBrick": "2027-06-23T14:00 2027-06-24T16:00 6",
      "floor": "2027-06-25T07:00 2027-06-25T12:00 6",
      "innerLeaf": "2027-06-25T13:00 2027-07-01T16:00 6",
      "outerLeaf": "2027-06-25T13:00 2027-07-02T16:00 7",
      "roofElements": "2027-07-02T07:00 2027-07-02T14:00 6",
      "roofing": "2027-07-02T14:00 2027-07-05T16:00 6",
      "frames": "2027-07-14T07:00 2027-07-15T16:00 0",
      "breakThrough": "2027-07-16T07:00 2027-07-19T16:00 0",
      "services": "2027-07-20T07:00 2027-07-22T16:00 0",
      "plaster": "2027-07-23T07:00 2027-07-28T16:00 0",
      "screed": "2027-07-29T07:00 2027-07-29T16:00 0",
      "tiling": "2027-08-27T07:00 2027-08-31T16:00 0",
      "painting": "2027-07-29T07:00 2027-08-23T16:00 6",
      "cleaning": "2027-09-01T07:00 2027-09-01T16:00 0",
      "msHandover": "2027-09-01T16:00 2027-09-01T16:00 0"
    },
  },
  // Tutorial 5 stap 2: vijf resources, nog niets toegewezen — de planning is die van na-tut-4.
  'tussen-tut-5-resources': {
    finish: "2027-09-01T16:00", projectFinish: "2027-09-01T16:00",
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 0,
      "baselines": 0
    },
    critical: [
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 6",
      "site": "2027-06-07T07:00 2027-06-08T16:00 6",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 6",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 6",
      "excavate": "2027-06-11T07:00 2027-06-14T16:00 6",
      "rebar": "2027-06-15T07:00 2027-06-17T16:00 6",
      "inspection": "2027-06-17T16:00 2027-06-17T16:00 6",
      "pour": "2027-06-18T07:00 2027-06-18T14:00 6",
      "foundBrick": "2027-06-23T14:00 2027-06-24T16:00 6",
      "floor": "2027-06-25T07:00 2027-06-25T12:00 6",
      "innerLeaf": "2027-06-25T13:00 2027-07-01T16:00 6",
      "outerLeaf": "2027-06-25T13:00 2027-07-02T16:00 7",
      "roofElements": "2027-07-02T07:00 2027-07-02T14:00 6",
      "roofing": "2027-07-02T14:00 2027-07-05T16:00 6",
      "frames": "2027-07-14T07:00 2027-07-15T16:00 0",
      "breakThrough": "2027-07-16T07:00 2027-07-19T16:00 0",
      "services": "2027-07-20T07:00 2027-07-22T16:00 0",
      "plaster": "2027-07-23T07:00 2027-07-28T16:00 0",
      "screed": "2027-07-29T07:00 2027-07-29T16:00 0",
      "tiling": "2027-08-27T07:00 2027-08-31T16:00 0",
      "painting": "2027-07-29T07:00 2027-08-23T16:00 6",
      "cleaning": "2027-09-01T07:00 2027-09-01T16:00 0",
      "msHandover": "2027-09-01T16:00 2027-09-01T16:00 0"
    },
  },
  // Tutorial 5 stap 3–5: alle toewijzingen, berekend. De metselaar staat al dubbel (binnen- en
  // buitenspouwblad); het stucwerk duurt nog 4 wd met 1 stukadoor.
  // F3c-tussenstand (B2, F3c-motor → doel): 6 overbezette dagen in plaats van 5, zie NA_TUT_5_PLANNING.
  'tussen-tut-5-toegewezen': {
    finish: "2027-09-01T16:00", projectFinish: "2027-09-01T16:00",
    statusDate: null, baselineFinish: null,
    overallocated: {
      "bricklayer": 6
    },
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 12,
      "baselines": 0
    },
    critical: [
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 6",
      "site": "2027-06-07T07:00 2027-06-08T16:00 6",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 6",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 6",
      "excavate": "2027-06-11T07:00 2027-06-14T16:00 6",
      "rebar": "2027-06-15T07:00 2027-06-17T16:00 6",
      "inspection": "2027-06-17T16:00 2027-06-17T16:00 6",
      "pour": "2027-06-18T07:00 2027-06-18T14:00 6",
      "foundBrick": "2027-06-23T14:00 2027-06-24T16:00 6",
      "floor": "2027-06-25T07:00 2027-06-25T12:00 6",
      "innerLeaf": "2027-06-25T13:00 2027-07-01T16:00 6",
      "outerLeaf": "2027-06-25T13:00 2027-07-02T16:00 7",
      "roofElements": "2027-07-02T07:00 2027-07-02T14:00 6",
      "roofing": "2027-07-02T14:00 2027-07-05T16:00 6",
      "frames": "2027-07-14T07:00 2027-07-15T16:00 0",
      "breakThrough": "2027-07-16T07:00 2027-07-19T16:00 0",
      "services": "2027-07-20T07:00 2027-07-22T16:00 0",
      "plaster": "2027-07-23T07:00 2027-07-28T16:00 0",
      "screed": "2027-07-29T07:00 2027-07-29T16:00 0",
      "tiling": "2027-08-27T07:00 2027-08-31T16:00 0",
      "painting": "2027-07-29T07:00 2027-08-23T16:00 6",
      "cleaning": "2027-09-01T07:00 2027-09-01T16:00 0",
      "msHandover": "2027-09-01T16:00 2027-09-01T16:00 0"
    },
  },
  // Tutorial 5 stap 6–8: Stucwerk "Vast werk" met 2 stukadoors (4 → 2 wd), berekend; nog
  // overbezet, vóór het nivelleren. = `beforeLeveling`.
  'tussen-tut-5-werkregel': {
    finish: "2027-08-30T16:00", projectFinish: "2027-08-30T16:00",
    statusDate: null, baselineFinish: null,
    overallocated: {
      "bricklayer": 6
    },
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 12,
      "baselines": 0
    },
    critical: [
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 6",
      "site": "2027-06-07T07:00 2027-06-08T16:00 6",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 6",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 6",
      "excavate": "2027-06-11T07:00 2027-06-14T16:00 6",
      "rebar": "2027-06-15T07:00 2027-06-17T16:00 6",
      "inspection": "2027-06-17T16:00 2027-06-17T16:00 6",
      "pour": "2027-06-18T07:00 2027-06-18T14:00 6",
      "foundBrick": "2027-06-23T14:00 2027-06-24T16:00 6",
      "floor": "2027-06-25T07:00 2027-06-25T12:00 6",
      "innerLeaf": "2027-06-25T13:00 2027-07-01T16:00 6",
      "outerLeaf": "2027-06-25T13:00 2027-07-02T16:00 7",
      "roofElements": "2027-07-02T07:00 2027-07-02T14:00 6",
      "roofing": "2027-07-02T14:00 2027-07-05T16:00 6",
      "frames": "2027-07-14T07:00 2027-07-15T16:00 0",
      "breakThrough": "2027-07-16T07:00 2027-07-19T16:00 0",
      "services": "2027-07-20T07:00 2027-07-22T16:00 0",
      "plaster": "2027-07-23T07:00 2027-07-26T16:00 0",
      "screed": "2027-07-27T07:00 2027-07-27T16:00 0",
      "tiling": "2027-08-25T07:00 2027-08-27T16:00 0",
      "painting": "2027-07-27T07:00 2027-07-29T16:00 6",
      "cleaning": "2027-08-30T07:00 2027-08-30T16:00 0",
      "msHandover": "2027-08-30T16:00 2027-08-30T16:00 0"
    },
  },
  'na-tut-5': {
    ...NA_TUT_5_PLANNING,
    statusDate: null, baselineFinish: null,
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 12,
      "baselines": 0
    },
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
    finish: "2027-08-31T16:00", projectFinish: "2027-08-31T16:00",
    statusDate: "2027-06-28", baselineFinish: "2027-08-30T16:00",
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 12,
      "baselines": 1
    },
    critical: [
      "foundBrick",
      "floor",
      "outerLeaf",
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 1",
      "site": "2027-06-07T07:00 2027-06-08T16:00 1",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 1",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 1",
      "excavate": "2027-06-11T07:00 2027-06-15T16:00 0",
      "rebar": "2027-06-16T07:00 2027-06-18T16:00 0",
      "inspection": "2027-06-18T16:00 2027-06-18T16:00 0.25",
      "pour": "2027-06-21T07:00 2027-06-21T14:00 0.25",
      "foundBrick": "2027-06-25T07:00 2027-06-28T16:00 0",
      "floor": "2027-06-29T07:00 2027-06-29T12:00 0",
      "innerLeaf": "2027-06-30T13:00 2027-07-06T16:00 4",
      "outerLeaf": "2027-07-07T13:00 2027-07-14T16:00 0",
      "roofElements": "2027-07-07T07:00 2027-07-07T14:00 4",
      "roofing": "2027-07-07T14:00 2027-07-08T16:00 4",
      "frames": "2027-07-15T07:00 2027-07-16T16:00 0",
      "breakThrough": "2027-07-19T07:00 2027-07-20T16:00 0",
      "services": "2027-07-21T07:00 2027-07-23T16:00 0",
      "plaster": "2027-07-26T07:00 2027-07-27T16:00 0",
      "screed": "2027-07-28T07:00 2027-07-28T16:00 0",
      "tiling": "2027-08-26T07:00 2027-08-30T16:00 0",
      "painting": "2027-07-28T07:00 2027-07-30T16:00 6",
      "cleaning": "2027-08-31T07:00 2027-08-31T16:00 0",
      "msHandover": "2027-08-31T16:00 2027-08-31T16:00 0"
    },
  },
};

const PINNED_EXTRA = {
  /** Tutorial 3: einde na alleen de bouwvak (vóór constraint en deadline). */
  finishAfterBouwvak: '2027-08-27T16:00',
  bouwvak: { name: 'Bouwvak (Midden)', startDate: '2027-08-02', endDate: '2027-08-20' },
  /** Tutorial 5: na toewijzen en werkregel, vóór nivelleren. */
  beforeLeveling: {
    finish: '2027-08-30T16:00',
    // F3c-tussenstand (B2, F3c-motor → doel { bricklayer: 6 } op andere dagen, zie metselaarOver).
    overallocated: { bricklayer: 6 },
    critical: ['frames', 'breakThrough', 'services', 'plaster', 'screed', 'tiling', 'cleaning', 'msHandover'],
  },
  plasterDays: { before: 4, after: 2 },
  // F3c-tussenstand (B2, F3c-motor → doel { outerLeaf: 5 }, zie NA_TUT_5_PLANNING en checkF3Reference).
  levelingDelays: { innerLeaf: 1, outerLeaf: 6 },
};

/**
 * Tutorial 6: wat de lezer ziet na "Toon mij"/"Opnieuw" (de stand geopend zoals de extensie hem opent). De app
 * rekent een .ifc bij het openen altijd door (`openExampleFromString` → `recompute`), ook een stand die in het
 * bestand nog niet gerekend is. Een statusdatum zonder (volledige) voortgang schuift dan het nog niet begonnen werk
 * naar de statusdatum. `tussen-tut-6-baseline` opent ongewijzigd (geen pin hier) en `tussen-tut-6-metselwerk` opent
 * als na-tut-6: alle invoer is er, de berekening is die van stap 8.
 */
// F2-tussenstand; F3 → dezelfde standen in de urenreferentie (§3.14). Vanaf de nivellering een
// F3c-tussenstand (B2, F3c-motor → doel), zie NA_TUT_5_PLANNING.
const TUT6_OPENED: Partial<Record<StageId, Pinned>> = {
  // Stap 3 (Toon mij) / stap 4 (Opnieuw): statusdatum zonder voortgang. Alles wat niet begonnen is, ligt op of na
  // de statusdatum: Start bouw 28 juni, oplevering ma 20 sep, 23 kritieke taken, 1 deadline overschreden — wat
  // de tekst bij stap 3 voorspelt als je dan al zou rekenen.
  'tussen-tut-6-statusdatum': {
    finish: "2027-09-17T16:00", projectFinish: "2027-09-17T16:00",
    statusDate: "2027-06-28", baselineFinish: "2027-08-30T16:00",
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 12,
      "baselines": 1
    },
    critical: [
      "msStart",
      "site",
      "garden",
      "setout",
      "excavate",
      "rebar",
      "inspection",
      "pour",
      "foundBrick",
      "floor",
      "innerLeaf",
      "roofElements",
      "outerLeaf",
      "roofing",
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-28T07:00 2027-06-28T07:00 -5",
      "site": "2027-06-28T07:00 2027-06-29T16:00 -5",
      "garden": "2027-06-30T07:00 2027-06-30T16:00 -5",
      "setout": "2027-07-01T07:00 2027-07-01T16:00 -5",
      "excavate": "2027-07-02T07:00 2027-07-05T16:00 -5",
      "rebar": "2027-07-06T07:00 2027-07-08T16:00 -5",
      "inspection": "2027-07-08T16:00 2027-07-08T16:00 -5",
      "pour": "2027-07-09T07:00 2027-07-09T14:00 -5",
      "foundBrick": "2027-07-14T14:00 2027-07-15T16:00 -5",
      "floor": "2027-07-16T07:00 2027-07-16T12:00 -5",
      "innerLeaf": "2027-07-19T13:00 2027-07-23T16:00 -1",
      "outerLeaf": "2027-07-26T13:00 2027-08-23T16:00 -5",
      "roofElements": "2027-07-26T07:00 2027-07-26T14:00 -1",
      "roofing": "2027-07-26T14:00 2027-07-27T16:00 -1",
      "frames": "2027-08-24T07:00 2027-08-25T16:00 -5",
      "breakThrough": "2027-08-26T07:00 2027-08-27T16:00 -5",
      "services": "2027-08-30T07:00 2027-09-01T16:00 -5",
      "plaster": "2027-09-02T07:00 2027-09-03T16:00 -5",
      "screed": "2027-09-06T07:00 2027-09-06T16:00 -5",
      "tiling": "2027-09-14T07:00 2027-09-16T16:00 -5",
      "painting": "2027-09-06T07:00 2027-09-08T16:00 1",
      "cleaning": "2027-09-17T07:00 2027-09-17T16:00 -5",
      "msHandover": "2027-09-17T16:00 2027-09-17T16:00 -5"
    },
  },
  // Stap 4 (Toon mij) / stap 5 (Opnieuw): de voorbereiding klaar; het ontgraven op de statusdatum.
  // Oplevering di 14 sep, deadline (10 sep) nog overschreden.
  'tussen-tut-6-voorbereiding': {
    finish: "2027-09-13T16:00", projectFinish: "2027-09-13T16:00",
    statusDate: "2027-06-28", baselineFinish: "2027-08-30T16:00",
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 12,
      "baselines": 1
    },
    critical: [
      "excavate",
      "rebar",
      "inspection",
      "pour",
      "foundBrick",
      "floor",
      "outerLeaf",
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 10",
      "site": "2027-06-07T07:00 2027-06-08T16:00 10",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 10",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 10",
      "excavate": "2027-06-28T07:00 2027-06-29T16:00 -1",
      "rebar": "2027-06-30T07:00 2027-07-02T16:00 -1",
      "inspection": "2027-07-02T16:00 2027-07-02T16:00 -1",
      "pour": "2027-07-05T07:00 2027-07-05T14:00 -1",
      "foundBrick": "2027-07-08T14:00 2027-07-09T16:00 -1",
      "floor": "2027-07-12T07:00 2027-07-12T12:00 -1",
      "innerLeaf": "2027-07-13T13:00 2027-07-19T16:00 3",
      "outerLeaf": "2027-07-20T13:00 2027-07-27T16:00 -1",
      "roofElements": "2027-07-20T07:00 2027-07-20T14:00 3",
      "roofing": "2027-07-20T14:00 2027-07-21T16:00 3",
      "frames": "2027-07-28T07:00 2027-07-29T16:00 -1",
      "breakThrough": "2027-07-30T07:00 2027-08-23T16:00 -1",
      "services": "2027-08-24T07:00 2027-08-26T16:00 -1",
      "plaster": "2027-08-27T07:00 2027-08-30T16:00 -1",
      "screed": "2027-08-31T07:00 2027-08-31T16:00 -1",
      "tiling": "2027-09-08T07:00 2027-09-10T16:00 -1",
      "painting": "2027-08-31T07:00 2027-09-02T16:00 5",
      "cleaning": "2027-09-13T07:00 2027-09-13T16:00 -1",
      "msHandover": "2027-09-13T16:00 2027-09-13T16:00 -1"
    },
  },
  // Stap 5 (Toon mij) / stap 6 (Opnieuw): het ontgraven klaar (15 juni); de wapening op de statusdatum.
  // Oplevering vr 10 sep, precies op de deadline.
  'tussen-tut-6-ontgraven': {
    finish: "2027-09-09T16:00", projectFinish: "2027-09-09T16:00",
    statusDate: "2027-06-28", baselineFinish: "2027-08-30T16:00",
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 12,
      "baselines": 1
    },
    critical: [
      "rebar",
      "inspection",
      "pour",
      "foundBrick",
      "floor",
      "outerLeaf",
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 9",
      "site": "2027-06-07T07:00 2027-06-08T16:00 9",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 9",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 9",
      "excavate": "2027-06-11T07:00 2027-06-15T16:00 8",
      "rebar": "2027-06-28T07:00 2027-06-30T16:00 0",
      "inspection": "2027-06-30T16:00 2027-06-30T16:00 0",
      "pour": "2027-07-01T07:00 2027-07-01T14:00 0",
      "foundBrick": "2027-07-06T14:00 2027-07-07T16:00 0",
      "floor": "2027-07-08T07:00 2027-07-08T12:00 0",
      "innerLeaf": "2027-07-09T13:00 2027-07-15T16:00 4",
      "outerLeaf": "2027-07-16T13:00 2027-07-23T16:00 0",
      "roofElements": "2027-07-16T07:00 2027-07-16T14:00 4",
      "roofing": "2027-07-16T14:00 2027-07-19T16:00 4",
      "frames": "2027-07-26T07:00 2027-07-27T16:00 0",
      "breakThrough": "2027-07-28T07:00 2027-07-29T16:00 0",
      "services": "2027-07-30T07:00 2027-08-24T16:00 0",
      "plaster": "2027-08-25T07:00 2027-08-26T16:00 0",
      "screed": "2027-08-27T07:00 2027-08-27T16:00 0",
      "tiling": "2027-09-06T07:00 2027-09-08T16:00 0",
      "painting": "2027-08-27T07:00 2027-08-31T16:00 6",
      "cleaning": "2027-09-09T07:00 2027-09-09T16:00 0",
      "msHandover": "2027-09-09T16:00 2027-09-09T16:00 0"
    },
  },
  // Stap 6 (Toon mij) / stap 7 (Opnieuw): wapening, keuring en stort klaar; het funderingsmetselwerk nog niet
  // begonnen, dus op de statusdatum (28–29 juni). Oplevering wo 1 sep.
  'tussen-tut-6-fundering': {
    finish: "2027-09-01T16:00", projectFinish: "2027-09-01T16:00",
    statusDate: "2027-06-28", baselineFinish: "2027-08-30T16:00",
    overallocated: {},
    counts: {
      "tasks": 27,
      "milestones": 3,
      "sequences": 24,
      "resources": 5,
      "assignments": 12,
      "baselines": 1
    },
    critical: [
      "foundBrick",
      "floor",
      "outerLeaf",
      "frames",
      "breakThrough",
      "services",
      "plaster",
      "screed",
      "tiling",
      "cleaning",
      "msHandover"
    ],
    table: {
      "msStart": "2027-06-07T07:00 2027-06-07T07:00 2",
      "site": "2027-06-07T07:00 2027-06-08T16:00 2",
      "garden": "2027-06-09T07:00 2027-06-09T16:00 2",
      "setout": "2027-06-10T07:00 2027-06-10T16:00 2",
      "excavate": "2027-06-11T07:00 2027-06-15T16:00 1",
      "rebar": "2027-06-16T07:00 2027-06-18T16:00 1",
      "inspection": "2027-06-18T16:00 2027-06-18T16:00 1.25",
      "pour": "2027-06-21T07:00 2027-06-21T14:00 1.25",
      "foundBrick": "2027-06-28T07:00 2027-06-29T16:00 0",
      "floor": "2027-06-30T07:00 2027-06-30T12:00 0",
      "innerLeaf": "2027-07-01T13:00 2027-07-07T16:00 4",
      "outerLeaf": "2027-07-08T13:00 2027-07-15T16:00 0",
      "roofElements": "2027-07-08T07:00 2027-07-08T14:00 4",
      "roofing": "2027-07-08T14:00 2027-07-09T16:00 4",
      "frames": "2027-07-16T07:00 2027-07-19T16:00 0",
      "breakThrough": "2027-07-20T07:00 2027-07-21T16:00 0",
      "services": "2027-07-22T07:00 2027-07-26T16:00 0",
      "plaster": "2027-07-27T07:00 2027-07-28T16:00 0",
      "screed": "2027-07-29T07:00 2027-07-29T16:00 0",
      "tiling": "2027-08-27T07:00 2027-08-31T16:00 0",
      "painting": "2027-07-29T07:00 2027-08-23T16:00 6",
      "cleaning": "2027-09-01T07:00 2027-09-01T16:00 0",
      "msHandover": "2027-09-01T16:00 2027-09-01T16:00 0"
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

/** Op deze gelijke werkdagen is urenmaat een onafhankelijke referentie voor de F3-dagdelenloper.
 *  De vaste doelen blijven getoetst terwijl de gewone dagcases de F2-tussenstand bewaken. */
function checkF3Reference(build: TutorialBuild): void {
  const goals = JSON.parse(readFileSync(new URL('./fixtures/minute-model-tutorial-f3.json', import.meta.url), 'utf8')) as
    Record<string, { finish: string; duration: number; critical: TaskKey[]; table: Record<TaskKey, string> }>;
  const keyOfName = (name: string) => TASKS.find(d => d.name.nl === name)?.key;
  // De nivellering van tutorial 5 op de urenreferentie (F3c deel 3, spec §3.11): dezelfde nivelleerder,
  // dezelfde opties als de generator, maar op de doelplaatsing. Ze moet het doel geven: alleen het
  // buitenspouwblad, 5 werkdagen = 5 × 480 werkminuten.
  let referenceLeveling: { delays: Partial<Record<TaskKey, number>>; delayMinutes: Partial<Record<TaskKey, number>> } | null = null;
  let leveled = false;
  for (const stage of build.stages) {
    if (stage.id === 'start-tut-1') continue;
    const payload = payloadFromImport(readIFC(stage.ifc), null);
    const tasks = payload.tasks.map(task => {
      if (task.time.durationUnit !== 'days' || task.isMilestone || task.childIds.length > 0) return task;
      const minutesPerDay = effHoursPerDay(effectiveCalendarOf(task, payload.calendar, payload.calendars)) * 60;
      eq(`F3-referentie/${stage.id}: gelijke werkdagen`, minutesPerDay, 480);
      return { ...task, time: { ...task.time, durationUnit: 'hours' as const,
        durationMinutes: task.time.scheduleDuration * minutesPerDay,
        remainingMinutes: task.time.remainingTime === undefined ? undefined : task.time.remainingTime * minutesPerDay,
      } };
    });
    if (leveled && referenceLeveling) {
      // F3c-tussenstand (B2, F3c-motor → doel): het bestand draagt de vertraging die de generator met de
      // huidige motor vond (binnenspouwblad 1, buitenspouwblad 6). De referentie gebruikt de vertraging
      // van de nivelleerder op de doelplaatsing. Met de dagenloper van de motor zijn die gelijk; dan is
      // deze vervanging een no-op.
      const ids = new Map(tasks.map(t => [keyOfName(t.name), t.id]));
      const byId = <V>(rec: Partial<Record<TaskKey, V>>) =>
        Object.fromEntries(Object.entries(rec).map(([k, v]) => [ids.get(k as TaskKey)!, v as V]));
      writeLevelingResult(tasks, { delays: byId(referenceLeveling.delays), delayMinutes: byId(referenceLeveling.delayMinutes), gaps: {} });
    }
    const result = solveProject(solveInputFor(payload.project, tasks, payload.sequences, payload.calendar, payload.calendars));
    eq(`F3-referentie/${stage.id}: doorrekening`, result.error, undefined);
    eq(`F3-referentie/${stage.id}: einde`, result.projectEnd, goals[stage.id]?.finish);
    eq(`F3-referentie/${stage.id}: projectduur`, result.projectDuration, goals[stage.id]?.duration);
    for (const definition of TASKS) {
      const referenceTask = tasks.find(task => task.name === definition.name.nl)!;
      eq(`F3-referentie/${stage.id}/${definition.key}: kritiek`, referenceTask.time.isCritical, goals[stage.id]?.critical.includes(definition.key));
      const t = tasks.find(task => task.name === definition.name.nl)!.time;
      eq(`F3-referentie/${stage.id}/${definition.key}`, `${t.earlyStart} ${t.earlyFinish} ${t.totalFloat}`,
        goals[stage.id]?.table[definition.key]);
    }
    if (stage.id === 'tussen-tut-5-werkregel') {
      const { sequences } = expandSummaryRelations(tasks, payload.sequences);
      const renewables = payload.resources.filter(r => r.type !== 'MATERIAL').map(r => r.id);
      const lv = levelResources(tasks.filter(isLeafTask), sequences, payload.resources, payload.assignments,
        payload.calendar, payload.calendars, result, { constrainToFloat: false, resourceIds: renewables },
        solveOptionsFor(payload.project));
      const byKey = (rec: Record<string, number>) => Object.fromEntries(Object.entries(rec)
        .map(([id, v]) => [keyOfName(tasks.find(t => t.id === id)!.name)!, v])) as Partial<Record<TaskKey, number>>;
      referenceLeveling = { delays: byKey(lv.delays), delayMinutes: byKey(lv.delayMinutes ?? {}) };
      eq('F3-referentie/nivelleren: vertraging in werkdagen', referenceLeveling.delays, { outerLeaf: 5 });
      eq('F3-referentie/nivelleren: vertraging in werkminuten', referenceLeveling.delayMinutes, { outerLeaf: 2400 });
      eq('F3-referentie/nivelleren: geen onopgelost conflict', lv.unresolved, {});
      leveled = true;
    }
    if (stage.id === 'na-tut-6') {
      const baseline = payload.baselines.find(b => b.id === payload.activeBaselineId) ?? null;
      eq('F3-referentie/na-tut-6: eindafwijking tegen de baseline',
        computeVariance(tasks, baseline, new CalendarEngine(payload.calendar), result.projectEnd).projectEndDelta, 1);
    }
    if (stage.id === 'na-tut-4') {
      // F2-tussenstand in de browservariant; F3 → deze exacte urenreferentie (§3.14).
      const roof = tasks.find(task => task.name === TASKS.find(t => t.key === 'roofElements')!.name.nl)!;
      roof.time.durationMinutes = 720;
      roof.time.scheduleDuration = 1.5;
      const longer = solveProject(solveInputFor(payload.project, tasks, payload.sequences, payload.calendar, payload.calendars));
      eq('F3-referentie/langere-kraan: doorrekening', longer.error, undefined);
      const key = (k: TaskKey) => tasks.find(task => task.name === TASKS.find(d => d.key === k)!.name.nl)!.time;
      eq('F3-referentie/langere-kraan: dak',
        [key('roofElements').earlyStart, key('roofElements').earlyFinish, key('roofElements').totalFloat],
        ['2027-07-05T10:00', '2027-07-06T15:00', 3.125]);
      eq('F3-referentie/langere-kraan: dakbedekking',
        [key('roofing').earlyStart, key('roofing').earlyFinish, key('roofing').totalFloat, key('innerLeaf').totalFloat],
        ['2027-07-06T15:00', '2027-07-08T15:00', 3.125, 3.125]);
    }
  }
}

async function main(): Promise<void> {
  // ── 1+2. nl: de gepinde getallen ──
  console.log('-- tutorial-project: nl, gepinde getallen per stand --');
  const nl = buildTutorialProject('nl');
  checkF3Reference(nl);
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
  ok('tut-6: F3c-tussenstand (B2, F3c-motor → doel 2027-08-31T12:00, §3.14)',
    f('na-tut-6').finish === '2027-08-31T16:00');

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
      // Vast bereik onafhankelijk van computeGenerateSpan: bewaakt de aanroep in de generator.
      // De wizard houdt zijn aanmaakspanne; tutorial 3 vervangt de lijst via de echte generator.
      const beforeCalendarEdit = ['start-tut-1', 'na-tut-1', 'na-tut-2'].includes(stage.id);
      const expectedCalendar = materializeHolidays(
        { country: 'NL', bouwvak: beforeCalendarEdit ? 'geen' : BOUWVAK_REGION },
        2026, beforeCalendarEdit ? 2030 : 2028,
      );
      const calendar = S().calendar;
      eq(`${label}: generatiejaren`,
        [calendar.generation?.generatedFromYear, calendar.generation?.generatedToYear],
        [expectedCalendar.generation?.generatedFromYear, expectedCalendar.generation?.generatedToYear]);
      eq(`${label}: land, regio en bouwvak`,
        [calendar.generation?.ruleSetId, calendar.generation?.region, calendar.generation?.breakChoice],
        [expectedCalendar.generation?.ruleSetId, expectedCalendar.generation?.region, expectedCalendar.generation?.breakChoice]);
      eq(`${label}: volledige feestdagenlijst`,
        calendar.holidays.map(h => `${h.name} ${h.startDate}..${h.endDate}`).sort(),
        expectedCalendar.holidays.map(h => `${h.name} ${h.startDate}..${h.endDate}`).sort());
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
    eq('tut-2 uitloop: einde oplevering', f.finish, '2027-08-09T16:00');
    eq('tut-2 uitloop: buitenspouwblad klaar', f.early.outerLeaf?.finish, '2027-07-09T16:00');
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
    eq('tut-3 deadline 27-08: einde oplevering', f.finish, '2027-09-01T16:00');
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
  // F3c-tussenstand (B2, F3c-motor → doel: 6 overbezette dagen van 28 juni t/m 5 juli, §3.14;
  // plaatsingsreferentie). De belasting telt het dagdeel al, de motor nog hele dagen: 2 juli komt erbij.
  const metselaarOver = ['2027-06-25', '2027-06-28', '2027-06-29', '2027-06-30', '2027-07-01', '2027-07-02'];

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
  eq('tut-5 werkregel: einde oplevering', collectStageFacts('nl').finish, '2027-08-30T16:00');
  eq('tut-5 werkregel: metselaar overbezet', bricklayerDays(), metselaarOver);
  eq('tut-5 werkregel: stucwerk werkregel', plaster().workRule ?? null, 'FIXED_WORK');
  eq('tut-5 werkregel: stucwerk eenh./dag', plasterUnits(), [2]);
  eq('tut-5 werkregel: stucwerk werkdagen', plaster().time.scheduleDuration, 2);
  eq('tut-5 werkregel: stucwerk datums', [plaster().time.earlyStart, plaster().time.earlyFinish], ['2027-07-23T07:00', '2027-07-26T16:00']);
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
  // D1/D2/D7: broninvoer blijft datumloos; de verwachte feiten gebruiken kalendergrenzen.
  const done = (start: string, finish: string) => `1 ${start.includes('T') ? start : start + 'T07:00'} ${finish.includes('T') ? finish : finish + 'T16:00'}`;
  const voorbereiding = {
    msStart: done('2027-06-07T07:00', '2027-06-07T07:00'), site: done('2027-06-07', '2027-06-08'),
    garden: done('2027-06-09', '2027-06-09'), setout: done('2027-06-10', '2027-06-10'),
  };
  const ontgraven = { excavate: done('2027-06-11', '2027-06-15') };
  const fundering = {
    rebar: done('2027-06-16', '2027-06-18'), inspection: done('2027-06-18T16:00', '2027-06-18T16:00'),
    pour: done('2027-06-21T07:00', '2027-06-21T14:00'),
  };
  const metselwerk = { foundBrick: '0.5 2027-06-25T07:00 -' };
  const notStarted = { msStart: '0 - -', excavate: '0 - -', rebar: '0 - -', foundBrick: '0 - -' };
  // F3c-tussenstand (B2, F3c-motor → doel) vanaf de statusdatum: één werkdag later en in de
  // voorbereiding één overschreden deadline, door de nivelleervertraging uit NA_TUT_5_PLANNING.
  const expected: Record<string, {
    duration: number; critical: number; finish: string; missed: number; statusDate: string | null;
    progress: Partial<Record<TaskKey, string>>; phases: number[];
  }> = {
    'tussen-tut-6-baseline': {
      duration: 46, critical: 8, finish: "2027-08-30T16:00", missed: 0, statusDate: null,
      progress: notStarted, phases: [0, 0, 0, 0],
    },
    'tussen-tut-6-statusdatum': {
      duration: 45, critical: 22, finish: "2027-09-17T16:00", missed: 1, statusDate: "2027-06-28",
      progress: notStarted, phases: [0, 0, 0, 0],
    },
    'tussen-tut-6-voorbereiding': {
      duration: 56, critical: 15, finish: "2027-09-13T16:00", missed: 1, statusDate: "2027-06-28",
      progress: { ...notStarted, ...voorbereiding }, phases: [1, 0, 0, 0],
    },
    'tussen-tut-6-ontgraven': {
      duration: 54, critical: 14, finish: "2027-09-09T16:00", missed: 0, statusDate: "2027-06-28",
      progress: { ...notStarted, ...voorbereiding, ...ontgraven }, phases: [1, 0.238, 0, 0],
    },
    'tussen-tut-6-fundering': {
      duration: 48, critical: 11, finish: "2027-09-01T16:00", missed: 0, statusDate: "2027-06-28",
      progress: { ...notStarted, ...voorbereiding, ...ontgraven, ...fundering }, phases: [1, 0.69, 0, 0],
    },
    'tussen-tut-6-metselwerk': {
      duration: 47, critical: 11, finish: "2027-08-31T16:00", missed: 0, statusDate: "2027-06-28",
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
