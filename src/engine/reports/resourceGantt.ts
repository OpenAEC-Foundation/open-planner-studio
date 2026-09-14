import type { Task } from '@/types/task';
import {
  computeViewRows, encodeBandKey, NONE_RAWKEY, type ViewContext, type ViewRow,
} from '@/engine/view/visibleRows';

/**
 * Resourcediagram (issue #113, gfayat): "wie doet wat, en wanneer" als GRAFISCH rapport — de
 * Gantt-afdruk met per resource een band en daaronder de taken die aan die resource hangen, op
 * volgorde van start. De melder wilde dit als eigen rapporttype in plaats van "groepeer het scherm
 * op resource en zet Volg weergave aan": dat zijn meerdere handelingen die bovendien de
 * schermweergave zelf verbouwen, terwijl je alleen een afdruk wilt.
 *
 * De rijen komen uit precies dezelfde groepeerpijplijn als het scherm (`computeViewRows`, §7.1):
 * een taak met twee resources verschijnt onder BEIDE banden, alleen bladtaken tellen mee, en de
 * banden staan op naam gesorteerd. Zo kan dit rapport nooit een andere verdeling tekenen dan de
 * Gantt-weergave gegroepeerd op resource. De filter/sortering van het scherm wordt bewust NIET
 * overgenomen — het rapport is onafhankelijk van hoe de gebruiker de Gantt nu toevallig heeft staan.
 *
 * Puur: geen React-/store-imports, dus headless te testen (`tests/planning/check-reports.ts`).
 */
export interface ResourceGanttRowsOptions {
  /** De taken zonder resource als laatste band ("(geen)") meenemen. */
  includeUnassigned: boolean;
}

export interface ResourceGanttRowsResult {
  /** De rijen voor `PrintOptions.rows`: bandrij per resource, taakrijen eronder (diepte 1). */
  rows: ViewRow[];
  counts: {
    /** Resources met minstens één bladtaak. */
    resources: number;
    /** Taakrijen onder een resourceband (een taak met n resources telt n keer). */
    assignments: number;
    /** Bladtaken zonder resource — ook geteld wanneer ze niet in de rijen staan. */
    unassignedTasks: number;
  };
}

/** Bandsleutel van de "(geen)"-band op het (enige) groepniveau. */
const NONE_BAND_KEY = encodeBandKey([NONE_RAWKEY]);

export function computeResourceGanttRows(
  tasks: Task[],
  ctx: ViewContext,
  opts: ResourceGanttRowsOptions,
): ResourceGanttRowsResult {
  const all = computeViewRows(tasks, {
    filter: null,
    group: [{ field: { src: 'resource' }, dir: 'asc' }],
    // Binnen een resource op start — dat is de leesvolgorde van "wat doe ik deze weken".
    sort: [{ field: { src: 'builtin', key: 'start' }, dir: 'asc' }],
    collapsedTaskIds: new Set(),
    collapsedGroupKeys: new Set(),
  }, ctx);

  const rows: ViewRow[] = [];
  let resources = 0;
  let assignments = 0;
  let unassignedTasks = 0;
  let inNoneBand = false;
  for (const row of all) {
    if (row.kind === 'group') {
      inNoneBand = row.key === NONE_BAND_KEY;
      if (inNoneBand) unassignedTasks = row.count;
      else resources++;
    } else if (!inNoneBand) {
      assignments++;
    }
    if (inNoneBand && !opts.includeUnassigned) continue;
    rows.push(row);
  }
  return { rows, counts: { resources, assignments, unassignedTasks } };
}
