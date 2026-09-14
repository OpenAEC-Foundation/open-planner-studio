import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { encodeBandKey, encodeGroupedTaskRowKey, NONE_RAWKEY, type ViewRow } from '@/engine/view/visibleRows';

/**
 * Resourcediagram (issue #113, gfayat): "wie doet wat, en wanneer" als GRAFISCH rapport — de
 * Gantt-afdruk met per resource een band en daaronder de bladtaken die aan die resource hangen, op
 * volgorde van start. De melder wilde dit als eigen rapporttype in plaats van "groepeer het scherm
 * op resource en zet Volg weergave aan": dat zijn meerdere handelingen die bovendien de
 * schermweergave zelf verbouwen, terwijl je alleen een afdruk wilt.
 *
 * WAAROM een eigen rijenbouwer en niet `computeViewRows` met een resourcegroepering: de
 * schermgroepering bandt op resourceNAAM (`filterEval.resourceNames`), en dit rapport heet
 * letterlijk "een blad per persoon" — twee medewerkers die allebei "Jan" heten zouden dan één vel
 * krijgen, met hun gedeelde taak twee keer onder dezelfde band (hyperkritische review op #132,
 * bevinding 1). Hier bandt alles op resource-IDENTITEIT: de naam is alleen het label, gelijknamige
 * resources krijgen een volgnummer (`Jan #1`, `Jan #2`), en een naamloze resource een surrogaat
 * (`#3`, zijn positie in de projectlijst) in plaats van stil in de "(geen)"-band te verdwijnen
 * (bevinding 4). De `ViewRow`-sleutels zijn daardoor per definitie uniek.
 *
 * Wat WEL gelijk is aan het scherm: alleen bladtaken (een verzameltaak wordt nooit toegewezen), een
 * taak met n resources staat onder n banden, hammocks en mijlpalen tellen mee (ze worden getekend).
 * Relaties horen hier niet: een taak kan onder meerdere banden staan, dus een pijl heeft geen
 * eenduidig anker en zou op een blad per persoon de bladrand af lopen — het paneel zet `showDeps`
 * voor dit type uit (bevinding 2).
 *
 * Invoer is structureel een `ReportContext`-subset, zoals de rest van `src/engine/reports/`. Puur:
 * geen React-/store-imports, headless getest in `tests/planning/check-reports.ts`.
 */
export interface ResourceGanttInput {
  tasks: readonly Task[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
}

export interface ResourceGanttRowsOptions {
  /** De taken zonder resource als laatste band meenemen. */
  includeUnassigned: boolean;
  /** Label van die band — `t('task:structure.none')`, dezelfde sleutel als de schermgroepering. */
  noneLabel: string;
}

export interface ResourceGanttRowsResult {
  /** De rijen voor `PrintOptions.rows`: bandrij per resource, taakrijen eronder (diepte 1). */
  rows: ViewRow[];
  counts: {
    /** Resources (op identiteit) met minstens één bladtaak. */
    resources: number;
    /** Taakrijen onder een resourceband (een taak met n resources telt n keer). */
    assignments: number;
    /** Bladtaken zonder resource — ook geteld wanneer ze niet in de rijen staan. Telt, anders dan
     *  het tabelrapport Resourcetoewijzingen, óók mijlpalen en hammocks: dit rapport tekent ze. */
    unassignedTasks: number;
  };
}

/** Bandsleutel van de "(geen)"-band — dezelfde codering als de schermgroepering. */
export const RESOURCE_GANTT_NONE_KEY = encodeBandKey([NONE_RAWKEY]);

/** Startdatum voor de volgorde binnen een band: berekend als die er is, anders gepland. */
function startOf(task: Task): string {
  return task.time.earlyStart || task.time.scheduleStart || '';
}

/** Op start, lege datums achteraan, gelijke starts in invoervolgorde (stabiel). */
function sortByStart(tasks: Task[]): Task[] {
  return tasks
    .map((task, index) => ({ task, index, start: startOf(task) }))
    .sort((a, b) => {
      if (a.start === b.start) return a.index - b.index;
      if (a.start === '') return 1;
      if (b.start === '') return -1;
      return a.start < b.start ? -1 : 1;
    })
    .map(entry => entry.task);
}

/**
 * Bandlabels per resource-id. Naam = label; gelijknamigen (na trimmen, exact) krijgen `#n` in
 * projectvolgorde; een lege naam wordt `#<positie>` zodat de band bestaat én herkenbaar is.
 */
export function resourceBandLabels(resources: readonly Resource[]): Map<string, string> {
  const nameCount = new Map<string, number>();
  for (const r of resources) {
    const name = r.name.trim();
    if (name) nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  resources.forEach((r, i) => {
    const name = r.name.trim();
    if (!name) { labels.set(r.id, `#${i + 1}`); return; }
    if ((nameCount.get(name) ?? 0) > 1) {
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      labels.set(r.id, `${name} #${n}`);
    } else {
      labels.set(r.id, name);
    }
  });
  return labels;
}

/** Bandvolgorde: op label, taal-/cijferbewust en hoofdletterongevoelig; gelijk ⇒ projectvolgorde. */
function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function computeResourceGanttRows(
  ctx: ResourceGanttInput,
  opts: ResourceGanttRowsOptions,
): ResourceGanttRowsResult {
  const leaves = ctx.tasks.filter(t => t.childIds.length === 0);
  const leafById = new Map(leaves.map(t => [t.id, t]));
  const resourceIds = new Set(ctx.resources.map(r => r.id));

  // Bladtaken per resource-id. Twee toewijzingen van dezelfde resource op één taak zijn één rij;
  // een toewijzing aan een onbekende resource telt niet (zelfde regel als `resourceNames` op het
  // scherm: die taak is dan "zonder resource").
  const tasksByResource = new Map<string, Map<string, Task>>();
  const assignedTaskIds = new Set<string>();
  for (const a of ctx.assignments) {
    const task = leafById.get(a.taskId);
    if (!task || !resourceIds.has(a.resourceId)) continue;
    let bucket = tasksByResource.get(a.resourceId);
    if (!bucket) { bucket = new Map(); tasksByResource.set(a.resourceId, bucket); }
    bucket.set(task.id, task);
    assignedTaskIds.add(task.id);
  }

  const labels = resourceBandLabels(ctx.resources);
  const bands = ctx.resources
    .map((r, index) => ({ id: r.id, index, label: labels.get(r.id) ?? r.id, tasks: tasksByResource.get(r.id) }))
    .filter((b): b is typeof b & { tasks: Map<string, Task> } => b.tasks !== undefined)
    .sort((a, b) => compareLabels(a.label, b.label) || a.index - b.index);

  const rows: ViewRow[] = [];
  let assignments = 0;
  for (const band of bands) {
    const key = encodeBandKey([band.id]);
    rows.push({
      kind: 'group', rowKey: key, key, label: band.label, count: band.tasks.size,
      depth: 0, levelIndex: 0, collapsed: false,
    });
    for (const task of sortByStart([...band.tasks.values()])) {
      rows.push({ kind: 'task', rowKey: encodeGroupedTaskRowKey([band.id], task.id), task, depth: 1, dimmed: false });
      assignments++;
    }
  }

  const unassigned = sortByStart(leaves.filter(t => !assignedTaskIds.has(t.id)));
  if (opts.includeUnassigned && unassigned.length > 0) {
    rows.push({
      kind: 'group', rowKey: RESOURCE_GANTT_NONE_KEY, key: RESOURCE_GANTT_NONE_KEY, label: opts.noneLabel,
      count: unassigned.length, depth: 0, levelIndex: 0, collapsed: false,
    });
    for (const task of unassigned) {
      rows.push({ kind: 'task', rowKey: encodeGroupedTaskRowKey([NONE_RAWKEY], task.id), task, depth: 1, dimmed: false });
    }
  }

  return { rows, counts: { resources: bands.length, assignments, unassignedTasks: unassigned.length } };
}
