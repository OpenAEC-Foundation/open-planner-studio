import type { XerReadResult } from './xerReader';
import type { MultiDocumentImport } from '@/services/importTypes';
import { XerImportError, type XerRow, type XerTables } from './xerTables';
import type { Baseline } from '@/types/baseline';
import type { Task } from '@/types/task';
import { isLeafTask } from '@/utils/taskHierarchy';

export type XerBaselineFallbackReason =
  | 'self-reference'
  | 'cycle'
  | 'all-projects-baselines';

export interface XerMultiProjectDocument {
  projectId: string;
  result: XerReadResult;
}

export interface XerDocumentExternalLink {
  id: string;
  predecessor: { projectId: string; taskId: string };
  successor: { projectId: string; taskId: string };
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lagMinutes: number;
}

export interface XerMultiProjectReport {
  projectsSeen: number;
  documentsOpened: number;
  emptyProjectsSkipped: number;
  baselineProjectsExcluded: number;
  baselinesMaterialized: number;
  danglingBaselineReferences: number;
  externalLinksPreserved: number;
  baselineExclusionReverted: boolean;
  baselineFallbackReasons: XerBaselineFallbackReason[];
}

export interface XerMultiProjectImport extends MultiDocumentImport {
  documents: XerMultiProjectDocument[];
  activeProjectId: string | null;
  /** Cross-projectbrondata tussen geopende documenten; bewust geen Sequence/Task.externalLinks. */
  externalLinks: XerDocumentExternalLink[];
  report: XerMultiProjectReport;
}

export type XerProjectMapper = (projectId: string) => XerReadResult;

interface BaselineDecision {
  excludedProjectIds: Set<string>;
  reverted: boolean;
  reasons: XerBaselineFallbackReason[];
}

function assertUniqueProjectIds(projectRows: readonly XerRow[]): void {
  const firstLineById = new Map<string, number>();
  for (const projectRow of projectRows) {
    const projectId = projectRow.cells.proj_id.trim();
    const firstLine = firstLineById.get(projectId);
    if (firstLine !== undefined) {
      throw new XerImportError(
        'XER_DUPLICATE_ID',
        `PROJECT.proj_id bevat dubbele id '${projectId}' op regels ${firstLine} en ${projectRow.line}.`,
        {
          table: 'PROJECT',
          field: 'proj_id',
          line: projectRow.line,
          lines: [firstLine, projectRow.line],
        },
      );
    }
    firstLineById.set(projectId, projectRow.line);
  }
}

function hasNonSelfCycle(targetByProject: ReadonlyMap<string, string>): boolean {
  const done = new Set<string>();
  for (const startProjectId of targetByProject.keys()) {
    if (done.has(startProjectId)) continue;
    const path = new Set<string>();
    let projectId: string | undefined = startProjectId;
    while (projectId && !done.has(projectId)) {
      if (path.has(projectId)) return true;
      path.add(projectId);
      const target = targetByProject.get(projectId);
      projectId = target && target !== projectId ? target : undefined;
    }
    for (const visitedProjectId of path) done.add(visitedProjectId);
  }
  return false;
}

/**
 * Beslis welke aanwezige baselineprojecten als gewone documenten worden uitgesloten.
 *
 * De uitsluiting is alleen veilig voor een acyclische hoofdproject→baselinegraaf die minstens één
 * niet-leeg gewoon document overlaat. Een zelfverwijzing, een wederzijdse/langere cyclus of een
 * verzameling waarin elk niet-leeg project als baseline is aangewezen neemt daarom de HELE
 * uitsluiting voor dit bestand terug. Zo kan baselineherkenning nooit nul documenten produceren;
 * alle niet-lege projecten openen dan gewoon en het verslag draagt elke concrete reden.
 */
function decideBaselineExclusion(
  projectRows: readonly XerRow[],
  nonEmptyProjectIds: ReadonlySet<string>,
): BaselineDecision {
  const projectIds = new Set(projectRows.map(projectRow => projectRow.cells.proj_id));
  const targetByProject = new Map<string, string>();
  for (const projectRow of projectRows) {
    const target = projectRow.cells.sum_base_proj_id?.trim() ?? '';
    if (target && projectIds.has(target)) targetByProject.set(projectRow.cells.proj_id, target);
  }
  const excludedProjectIds = new Set(targetByProject.values());
  const reasons: XerBaselineFallbackReason[] = [];
  if ([...targetByProject].some(([projectId, target]) => projectId === target)) {
    reasons.push('self-reference');
  }
  if (hasNonSelfCycle(targetByProject)) reasons.push('cycle');
  if (nonEmptyProjectIds.size > 0
    && [...nonEmptyProjectIds].every(projectId => excludedProjectIds.has(projectId))) {
    reasons.push('all-projects-baselines');
  }
  return reasons.length > 0
    ? { excludedProjectIds: new Set(), reverted: true, reasons }
    : { excludedProjectIds, reverted: false, reasons };
}

function uniqueTaskByCode(tasks: readonly Task[]): Map<string, Task> {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.wbsCode) continue;
    const matches = grouped.get(task.wbsCode) ?? [];
    matches.push(task);
    grouped.set(task.wbsCode, matches);
  }
  return new Map(
    [...grouped]
      .filter(([, matches]) => matches.length === 1)
      .map(([code, matches]) => [code, matches[0]]),
  );
}

function materializeBaseline(
  ownerProjectId: string,
  owner: XerReadResult,
  sourceProjectId: string,
  sourceProjectRow: XerRow,
  source: XerReadResult | undefined,
): Baseline {
  const ownerLeaves = owner.tasks.filter(isLeafTask);
  const ownerById = new Map(ownerLeaves.map(task => [task.id, task]));
  const ownerByCode = uniqueTaskByCode(ownerLeaves);
  const tasks = (source?.tasks ?? []).filter(isLeafTask).map(task => {
    const matched = ownerById.get(task.id) ?? ownerByCode.get(task.wbsCode);
    return {
      taskId: matched?.id ?? task.id,
      start: task.time.earlyStart || task.time.scheduleStart,
      finish: task.time.earlyFinish || task.time.scheduleFinish,
      duration: task.time.scheduleDuration,
      isMilestone: task.isMilestone,
      ...(task.milestoneKind ? { milestoneKind: task.milestoneKind } : {}),
    };
  });
  const finishes = tasks.map(task => task.finish).filter(Boolean).sort();
  return {
    id: `xer-baseline:${ownerProjectId}:${sourceProjectId}`,
    name: source?.project.name || sourceProjectRow.cells.proj_short_name || sourceProjectId,
    createdAt: source?.project.modifiedAt || source?.project.createdAt
      || owner.project.modifiedAt || owner.project.createdAt,
    tasks,
    projectEnd: finishes[finishes.length - 1] ?? '',
    projectDuration: 0,
  };
}

function collectExternalLinks(documents: readonly XerMultiProjectDocument[]): XerDocumentExternalLink[] {
  const tasksByProject = new Map(documents.map(document => [
    document.projectId,
    new Set(document.result.tasks.map(task => task.id)),
  ]));
  const seen = new Set<string>();
  const links: XerDocumentExternalLink[] = [];
  for (const document of documents) {
    for (const relation of document.result.xer.externalRelations) {
      const predecessor = relation.direction === 'predecessor'
        ? { projectId: relation.externalProjectId, taskId: relation.externalTaskId }
        : { projectId: relation.localProjectId, taskId: relation.localTaskId };
      const successor = relation.direction === 'predecessor'
        ? { projectId: relation.localProjectId, taskId: relation.localTaskId }
        : { projectId: relation.externalProjectId, taskId: relation.externalTaskId };
      if (!tasksByProject.get(predecessor.projectId)?.has(predecessor.taskId)
        || !tasksByProject.get(successor.projectId)?.has(successor.taskId)) continue;
      const key = [
        relation.id,
        predecessor.projectId,
        predecessor.taskId,
        successor.projectId,
        successor.taskId,
        relation.type,
        relation.lagMinutes,
      ].join('\u0000');
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        id: relation.id,
        predecessor,
        successor,
        type: relation.type,
        lagMinutes: relation.lagMinutes,
      });
    }
  }
  return links;
}

/** Bouw de documentselectie uit X2's tabellen en X4a's geïnjecteerde per-projectmapping. */
export function assembleXerMultiProjectImport(
  tables: XerTables,
  mapProject: XerProjectMapper,
): XerMultiProjectImport {
  const projectRows = tables.tables.get('PROJECT')?.rows ?? [];
  const taskRows = tables.tables.get('TASK')?.rows ?? [];
  assertUniqueProjectIds(projectRows);
  const projectIds = new Set(projectRows.map(projectRow => projectRow.cells.proj_id));
  const baselineReferences = projectRows
    .map(projectRow => projectRow.cells.sum_base_proj_id?.trim() ?? '')
    .filter(Boolean);
  const danglingBaselineReferences = baselineReferences
    .filter(projectId => !projectIds.has(projectId))
    .length;
  const taskCountByProject = new Map<string, number>();
  for (const taskRow of taskRows) {
    const projectId = taskRow.cells.proj_id;
    taskCountByProject.set(projectId, (taskCountByProject.get(projectId) ?? 0) + 1);
  }

  const nonEmptyProjectRows = projectRows
    .filter(projectRow => (taskCountByProject.get(projectRow.cells.proj_id) ?? 0) > 0);
  const baselineDecision = decideBaselineExclusion(
    projectRows,
    new Set(nonEmptyProjectRows.map(projectRow => projectRow.cells.proj_id)),
  );
  const mappedByProject = new Map(
    nonEmptyProjectRows.map(projectRow => [
      projectRow.cells.proj_id,
      // Eén bestand kan readers intern dezelfde kalender-/resourcearrays laten delen. Elke
      // documentpayload krijgt daarom vóór baselineverrijking zijn eigen volledige objectgraaf.
      structuredClone(mapProject(projectRow.cells.proj_id)),
    ]),
  );
  const documents = nonEmptyProjectRows
    .filter(projectRow => !baselineDecision.excludedProjectIds.has(projectRow.cells.proj_id))
    .map(projectRow => ({
      projectId: projectRow.cells.proj_id,
      result: mappedByProject.get(projectRow.cells.proj_id)!,
    }));

  let baselinesMaterialized = 0;
  for (const document of baselineDecision.reverted ? [] : documents) {
    const projectRow = projectRows.find(row => row.cells.proj_id === document.projectId);
    const baselineProjectId = projectRow?.cells.sum_base_proj_id?.trim() ?? '';
    const baselineProjectRow = projectRows.find(row => row.cells.proj_id === baselineProjectId);
    if (!baselineProjectRow) continue;
    const source = mappedByProject.get(baselineProjectId);
    const baseline = materializeBaseline(
      document.projectId,
      document.result,
      baselineProjectId,
      baselineProjectRow,
      source,
    );
    document.result.baselines = [...(document.result.baselines ?? []), baseline];
    document.result.activeBaselineId = baseline.id;
    baselinesMaterialized++;
  }
  const externalLinks = collectExternalLinks(documents);

  let activeProjectId: string | null = null;
  let mostLeafTasks = -1;
  for (const document of documents) {
    const leafTasks = document.result.tasks.filter(isLeafTask).length;
    if (leafTasks > mostLeafTasks) {
      mostLeafTasks = leafTasks;
      activeProjectId = document.projectId;
    }
  }

  return {
    kind: 'multi-document',
    results: documents.map(document => document.result),
    activeDocumentIndex: activeProjectId === null
      ? -1
      : documents.findIndex(document => document.projectId === activeProjectId),
    documents,
    activeProjectId,
    externalLinks,
    report: {
      projectsSeen: projectRows.length,
      documentsOpened: documents.length,
      emptyProjectsSkipped: projectRows.length - nonEmptyProjectRows.length,
      baselineProjectsExcluded: nonEmptyProjectRows
        .filter(projectRow => baselineDecision.excludedProjectIds.has(projectRow.cells.proj_id)).length,
      baselinesMaterialized,
      danglingBaselineReferences,
      externalLinksPreserved: externalLinks.length,
      baselineExclusionReverted: baselineDecision.reverted,
      baselineFallbackReasons: baselineDecision.reasons,
    },
  };
}
