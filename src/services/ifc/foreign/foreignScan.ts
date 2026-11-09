/**
 * Scanner en indeling in één stap, met een uitkomst die een Worker kan overdragen (#804 fase 1a, ontwerp §4.8 en §4.13).
 *
 * `scanStep` en `classify` geven een `StepIndex` met private velden; die kan niet over de grens van een Worker. Deze
 * module zet wat de bytes-route nodig heeft om in typed arrays: stukgrenzen, `#id`, klasse en codering per stuk, en de
 * keuze van `selectPlanning` als stukindexen. Puur: geen store, DOM, bestandstoegang of Tauri. De Worker
 * (`foreignScan.worker.ts`) en de synchrone terugval (`foreignScanRunner.ts`) roepen dezelfde functie aan.
 */
import { scanStep, StepScanError, type StepScanReason } from './stepScanner';
import { classify } from './classify';

/** De keuze van de lezer (§4.2 stap 1) als stukindexen in bronvolgorde. */
export interface ForeignScanSelection {
  /** Het eerste `IfcWorkPlan`, of -1. */
  readonly workPlan: number;
  /** Het eerste werkschema dat geen baseline is (het schema dat de lezer kiest), of -1. */
  readonly liveSchedule: number;
  readonly tasks: Int32Array;
  readonly resources: Int32Array;
  readonly calendars: Int32Array;
  readonly sequences: Int32Array;
}

export interface ForeignScanResult {
  readonly ok: true;
  /** Eerste byte van elk stuk, met de lengte van de bron als laatste waarde (`count + 1` waarden). */
  readonly chunkStarts: Uint32Array;
  /** `#id` per stuk; -1 voor kop, `DATA;` en staart. */
  readonly chunkIds: Int32Array;
  /** Klasse per stuk: 0 = geen entiteit, 1 = P, 2 = C, 3 = A, 4 = V. */
  readonly classes: Uint8Array;
  /** Codering per stuk (§4.9 punt 5): 1 = letterlijk. Alleen ingevuld voor wat de lezer krijgt: P, C, A en
   *  `projectContext`. */
  readonly literal: Uint8Array;
  /** Het stuk van het `IfcProject` als dat V is en er precies één is (een model zonder planning, of een eigen bestand
   *  van vóór `87ebd4d46`), anders -1. De lezer leest het als context (§4.2, Gevolgen): naam, omschrijving en GlobalId. */
  readonly projectContext: number;
  readonly selection: ForeignScanSelection;
  /** Aantal entiteiten per klasse. */
  readonly counts: { readonly P: number; readonly C: number; readonly A: number; readonly V: number };
  /** Properties in een eigen pset die de lezer niet leest (stukindexen). */
  readonly foreignMembers: Int32Array;
  readonly lineEnding: '\r\n' | '\n';
}

/** De scanner weigerde de invoer (ongeschikte of onvolledige STEP); de bytes-route valt dan terug (afwijking 7). */
export interface ForeignScanRefusal {
  readonly ok: false;
  readonly reason: StepScanReason;
  readonly message: string;
}

export type ForeignScanOutcome = ForeignScanResult | ForeignScanRefusal;

/** Scan en deel in. Een weigering van de scanner is een uitkomst, geen fout; elke andere fout gooit. */
export function scanForeign(bytes: Uint8Array): ForeignScanOutcome {
  let index;
  try {
    index = scanStep(bytes);
  } catch (err) {
    if (err instanceof StepScanError) return { ok: false, reason: err.reason, message: err.message };
    throw err;
  }
  const cls = classify(index);
  const n = index.count;
  const chunkStarts = new Uint32Array(n + 1);
  const chunkIds = new Int32Array(n);
  const literal = new Uint8Array(n);
  let projects = 0;
  let project = -1;
  for (let i = 0; i < n; i++) {
    chunkStarts[i] = index.start(i);
    const id = index.id(i);
    chunkIds[i] = id === '' ? -1 : Number(id);
    const c = cls.classes[i];
    if (c >= 1 && c <= 3 && index.literalText(i)) literal[i] = 1;
    if (index.isEntity(i) && index.type(i) === 'IFCPROJECT') { projects++; project = i; }
  }
  // §4.2, Gevolgen: de lezer leest het enige `IfcProject` altijd als context, ook als het V is. Alleen dat stuk, niet zijn
  // eenheden of context: de lezer volgt van het project geen verwijzing.
  const projectContext = projects === 1 && cls.classes[project] === 4 ? project : -1;
  if (projectContext >= 0 && index.literalText(projectContext)) literal[projectContext] = 1;
  // Elk byte valt in precies één stuk (§4.1; de poort eist dat), dus het laatste stuk eindigt op de lengte van de bron.
  chunkStarts[n] = bytes.length;
  const sel = cls.selection;
  return {
    ok: true,
    chunkStarts,
    chunkIds,
    classes: cls.classes,
    literal,
    projectContext,
    selection: {
      workPlan: sel.workPlan,
      liveSchedule: sel.liveSchedules.length > 0 ? sel.liveSchedules[0] : -1,
      tasks: Int32Array.from(sel.tasks),
      resources: Int32Array.from(sel.resources),
      calendars: Int32Array.from(sel.calendars),
      sequences: Int32Array.from(sel.sequences),
    },
    counts: { ...cls.counts },
    foreignMembers: Int32Array.from(cls.foreignMembers),
    lineEnding: index.lineEnding,
  };
}

/** De buffers die de Worker overdraagt in plaats van kopieert. */
export function foreignScanTransferables(outcome: ForeignScanOutcome): ArrayBuffer[] {
  if (!outcome.ok) return [];
  const s = outcome.selection;
  const arrays = [
    outcome.chunkStarts, outcome.chunkIds, outcome.classes, outcome.literal, outcome.foreignMembers,
    s.tasks, s.resources, s.calendars, s.sequences,
  ];
  const buffers = new Set<ArrayBuffer>();
  for (const a of arrays) if (a.buffer instanceof ArrayBuffer) buffers.add(a.buffer);
  return [...buffers];
}
