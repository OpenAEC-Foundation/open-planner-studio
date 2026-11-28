import type { McpToolDef, McpToolResult } from '../contracts';
import { ScopeEscapeError } from '../fileScopeError';
import { refreshFromSources, type ExternalSourceDoc } from '@/engine/externalLinks';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import { readExternalSource } from '@/state/externalSource';
import { appForeignContentRoute, checkScope, fileToolDeps, type McpFileFs } from './fileTools';
import { guardNonTransactional, runMutateTool, toolError } from './runtime';
import { WRITE_ANNOTATIONS } from './helpers';
import { readOptionsFor } from '@/services/formatRegistry';

type SourceReport =
  | { path: string; status: 'read'; projectName: string }
  | { path: string; status: 'outOfScope' | 'unreadable'; reason: string };

export const externalLinkTools: McpToolDef[] = [
  {
    name: 'planner_refresh_external_links',
    description:
      'Re-read external relationship anchors (links to a task in another project file) from their source ' +
      'files: read-only, not opened. Updates anchors and `sourceMissing` in one undo step, then recalculates. ' +
      'Reads only files inside the home folder; links to an unread file and site links (`siteLinks`) keep ' +
      'their anchor. A link without a file path refreshes only via another link to the same source project ' +
      '(`manualLinks`). Report `sources` (read per file) and `changes` (`anchorBefore` → `anchorAfter`).',
    kind: 'mutate',
    batchable: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true, openWorldHint: true },
    handler: async (_args, ctx): Promise<McpToolResult> => {
      const blocked = guardNonTransactional(ctx);
      if (blocked) return blocked;
      const start = ctx.app.store.getState();

      const paths = new Map<string, string>();
      let manualLinks = 0;
      let siteLinks = 0;
      let unusablePaths = 0;
      for (const task of start.tasks) {
        for (const link of task.externalLinks ?? []) {
          if (link.sourceRef.siteFileId?.trim()) { siteLinks++; continue; }
          const filePath = link.sourceRef.filePath;
          if (!filePath) { manualLinks++; continue; }
          const normalized = normalizeExternalSourcePath(filePath);
          if (normalized === null) { unusablePaths++; continue; }
          if (!paths.has(normalized)) paths.set(normalized, filePath);
        }
      }

      let fs: McpFileFs;
      try {
        fs = await fileToolDeps.getFs();
      } catch (e) {
        return toolError(ctx, 'INTERNAL', e instanceof Error ? e.message : String(e));
      }
      const home = await fs.homeDir();
      const sources: ExternalSourceDoc[] = [];
      const report: SourceReport[] = [];
      const readPaths = new Set<string>();
      for (const [normalized, filePath] of paths) {
        const scope = checkScope(home, filePath);
        if (!scope.ok) {
          report.push({ path: filePath, status: 'outOfScope', reason: scope.reason });
          continue;
        }
        try {
          const escaped = await fs.confine?.(scope.path);
          if (escaped) {
            report.push({ path: filePath, status: 'outOfScope', reason: escaped });
            continue;
          }
          const version = await fs.stat(scope.path).then(info => info.mtime?.toISOString(), () => undefined);
          const read = await readExternalSource(filePath, {
            readTextFile: () => fs.readTextFile(scope.path),
            readFile: () => fs.readFile(scope.path),
          }, undefined, { ...readOptionsFor(ctx.app.store.getState().ui.featureFlags), ifcBytes: appForeignContentRoute(ctx) });
          const source = { ...read, ...(version ? { version } : {}), readAt: new Date().toISOString() };
          sources.push(source);
          readPaths.add(normalized);
          report.push({ path: filePath, status: 'read', projectName: source.projectName });
        } catch (e) {
          report.push({
            path: filePath,
            status: e instanceof ScopeEscapeError ? 'outOfScope' : 'unreadable',
            reason: e instanceof Error ? e.message : String(e),
          });
        }
      }

      let documentId = null as string | null;
      const res = await runMutateTool(ctx, 'mutate', () => {
        const s = ctx.app.store.getState();
        documentId = s.activeDocumentId;
        const result = refreshFromSources(s.tasks, sources, readPaths);
        const changes: Array<{ taskId: string; taskName: string; linkId: string; anchorBefore: string; anchorAfter: string; sourceMissing: boolean }> = [];
        if (result.changed) {
          const beforeById = new Map(s.tasks.map(task => [task.id, task] as const));
          for (const task of result.tasks) {
            const before = beforeById.get(task.id);
            if (!before || before === task) continue;
            for (const link of task.externalLinks ?? []) {
              const old = before.externalLinks?.find(candidate => candidate.id === link.id);
              if (!old || old === link) continue;
              const { id, ...fields } = link;
              s.updateExternalLink(task.id, id, fields);
              if (old.anchorDate !== link.anchorDate || old.sourceMissing !== link.sourceMissing) {
                changes.push({
                  taskId: task.id, taskName: task.name, linkId: id,
                  anchorBefore: old.anchorDate, anchorAfter: link.anchorDate, sourceMissing: link.sourceMissing,
                });
              }
            }
          }
        }
        return {
          data: {
            sources: report,
            refreshed: result.refreshed,
            missing: result.missing + unusablePaths,
            manualLinks,
            siteLinks,
            changes,
          },
        };
      });
      if (res.ok && documentId !== null) ctx.app.store.getState().dropExternalSourceUpdates(documentId, readPaths);
      return res;
    },
  },
];
