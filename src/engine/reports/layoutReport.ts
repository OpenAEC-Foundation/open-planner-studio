import type { Task } from '@/types/task';
import type { GroupLevel, Layout, SortLevel } from '@/types/view';
import { computeViewRows, sortTasks, type ViewContext, type ViewRow } from '@/engine/view/visibleRows';
import { evaluate } from '@/engine/view/filterEval';
import { computeResourceGanttRows, type ResourceGanttRowsOptions, type ResourceGanttRowsResult } from './resourceGantt';

/**
 * Een layout toegepast op de Gantt-afdruk (Rapport-tabblad, issue #861). Puur: geen React of store.
 *
 * De afdruk neemt van de layout alleen de RIJEN over: `filter`, `group` en `sort`. Een deel dat de layout
 * niet draagt, staat op de stand van "Alle taken" (geen filter, de WBS-boom, geen sortering): het rapport
 * hangt zo niet af van wat er toevallig op het scherm staat. Kolommen, relatielijnen en overlays neemt het
 * tabblad bij het kiezen over (`layoutReportPatch` in de UI); de tijdschaal niet, want het rapport heeft een
 * eigen paginaschaal.
 *
 * Groeperen op resource is het oude rapporttype Resourcediagram. Die groepering ([resource] of
 * [resourcetype, resource]) gaat daarom door dezelfde rijenbouwer (`computeResourceGanttRows`): banden op
 * resource-IDENTITEIT (het scherm bandt op naam), een vaste bandvolgorde in de app-taal, alleen bladtaken,
 * de opties van dat rapport en de rapportageperiode. Elke andere groepering gaat door de rijen van het
 * scherm (`computeViewRows`), zonder ingeklapte banden.
 */
export interface LayoutReportInput {
  tasks: readonly Task[];
  ctx: ViewContext;
}

/** De opties van het oude rapporttype Resourcediagram (alleen gelezen bij een resourcegroepering). */
export interface LayoutResourceOptions {
  includeUnassigned: boolean;
  groupByType: boolean;
  window?: ResourceGanttRowsOptions['window'];
  /** De app-taal: bandvolgorde en gelijke namen. */
  locale: string;
  typeLabels?: ResourceGanttRowsOptions['typeLabels'];
}

/** Hoe een groepering de rijen bouwt. */
export interface ResourceBandShape {
  /** Eerst een band per resourcetype ([resourcetype, resource]). */
  typeLevel: boolean;
  bandsDescending: boolean;
  typesDescending: boolean;
}

export interface LayoutReportRows {
  rows: ViewRow[];
  /** Gevuld bij een resourcegroepering: de uitkomst van `computeResourceGanttRows` (telling, toewijzingen). */
  resource: ResourceGanttRowsResult | null;
  /**
   * Een taak kan onder meer dan één band staan (groeperen op resource of resourcetype). Dan staan de
   * relatielijnen uit: een pijl heeft geen vast begin en eind meer.
   */
  multiBand: boolean;
}

/**
 * Groepeert deze layout zoals het oude Resourcediagram? Ja bij [resource] en [resourcetype, resource];
 * dan bouwt `computeResourceGanttRows` de rijen. Anders `null`.
 */
export function resourceBandShape(group: readonly GroupLevel[] | undefined): ResourceBandShape | null {
  if (!group || group.length === 0 || group.length > 2) return null;
  const last = group[group.length - 1];
  if (last.field.src !== 'resource') return null;
  if (group.length === 2 && group[0].field.src !== 'resourceType') return null;
  return {
    typeLevel: group.length === 2,
    bandsDescending: last.dir === 'desc',
    typesDescending: group.length === 2 && group[0].dir === 'desc',
  };
}

/** Staat een taak onder meer dan één band? Bij groeperen op resource of resourcetype. */
export function groupIsMultiBand(group: readonly GroupLevel[] | undefined): boolean {
  return (group ?? []).some(level => level.field.src === 'resource' || level.field.src === 'resourceType');
}

/** De rijen van de afdruk voor een layout. */
export function computeLayoutReportRows(
  layout: Pick<Layout, 'filter' | 'group' | 'sort'>,
  input: LayoutReportInput,
  resourceOptions: LayoutResourceOptions,
): LayoutReportRows {
  const filter = layout.filter ?? null;
  const group = layout.group ?? [];
  const sort = layout.sort ?? [];
  const { ctx } = input;
  const tasks = input.tasks as Task[];
  const shape = resourceBandShape(group);
  if (shape) {
    // Het filter geldt voor de bladtaken, net als op het scherm; de bouwer neemt alleen bladtaken.
    const filtered = filter === null ? tasks : tasks.filter(task => task.childIds.length > 0 || evaluate(filter, task, ctx));
    // Zonder sortering, of op start: de volgorde van het oude rapport. Anders de sortering van de layout.
    const ownSort = sort.length > 0 && !isStartAscending(sort);
    const resource = computeResourceGanttRows(
      { tasks: filtered, resources: ctx.resources, assignments: ctx.assignments },
      {
        includeUnassigned: resourceOptions.includeUnassigned,
        noneLabel: ctx.noneLabel,
        locale: resourceOptions.locale,
        groupByType: shape.typeLevel || resourceOptions.groupByType,
        typeLabels: resourceOptions.typeLabels,
        window: resourceOptions.window,
        sortTasks: ownSort ? list => sortTasks(list, sort, ctx) : undefined,
        bandsDescending: shape.bandsDescending,
        typesDescending: shape.typesDescending,
      },
    );
    return { rows: resource.rows, resource, multiBand: true };
  }
  const rows = computeViewRows(tasks, {
    filter, group, sort, collapsedTaskIds: new Set(), collapsedGroupKeys: new Set(),
  }, ctx);
  return { rows, resource: null, multiBand: groupIsMultiBand(group) };
}

function isStartAscending(sort: readonly SortLevel[]): boolean {
  const [level] = sort;
  return sort.length === 1 && level.dir === 'asc' && level.field.src === 'builtin' && level.field.key === 'start';
}
