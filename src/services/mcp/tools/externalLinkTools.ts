// `planner_refresh_external_links`: de ankers van de externe relaties verversen uit hun bronbestanden, zoals
// *Alle externe relaties vernieuwen* in de app (keuze 11, Ethan 2026-11-03; stap 1.10 in
// `docs/relaties-tussen-projecten.md`). Alles wat de agent leest is Engels; dit commentaar is Nederlands.
//
// Twee fasen, net als `refreshAllExternalAnchors`: eerst elke bron één keer alleen-lezen inlezen (async), dan
// in één MCP-transactie de koppelingen bijwerken (`refreshFromSources` → `updateExternalLink`), dus één
// undo-stap en één AI-backup. Lezen gaat via `fileToolDeps` met dezelfde poort als `planner_import_schedule`:
// alleen binnen de thuismap (de headless server: binnen zijn werkmap), met de fysieke tweede poort
// (`confine`) waar die er is. De MCP-transactie rekent aan het eind door, zoals de app na verversen.
import type { McpToolDef, McpToolResult } from '../contracts';
import { ScopeEscapeError } from '../fileScopeError';
import { refreshFromSources, type ExternalSourceDoc } from '@/engine/externalLinks';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import { readExternalSource } from '@/state/externalSource';
import { checkScope, fileToolDeps, type McpFileFs } from './fileTools';
import { guardNonTransactional, runMutateTool, toolError } from './runtime';
import { WRITE_ANNOTATIONS } from './helpers';

type SourceReport =
  | { path: string; status: 'read'; projectName: string }
  | { path: string; status: 'outOfScope' | 'unreadable'; reason: string };

export const externalLinkTools: McpToolDef[] = [
  {
    name: 'planner_refresh_external_links',
    description:
      'Refresh the anchors of the external relationships (links to a task in another project file) from their ' +
      'source files, like "Refresh all external relations" in the app. Reads every source file once, read-only ' +
      '(it is not opened as a document), and updates for each link the anchor date and whether the source task ' +
      'is missing; all in one undoable change. A link without a file path (entered by hand) is refreshed only ' +
      'when another link reads the same source project; `manualLinks` counts them. FILE SCOPE: only source files inside the home folder (in the headless server: inside its ' +
      'working folder). Returns per source file whether it was read (`sources`), the number of links ' +
      'refreshed and missing, and `changes`: the links whose anchor date or missing status changed ' +
      '(`anchorBefore` → `anchorAfter`). The schedule is recalculated afterwards, like in the app. A link on a ' +
      'summary task (phase) applies to every task in that phase.',
    kind: 'mutate',
    // Async (bestanden lezen vóór de transactie): past niet in een synchroon draaiboek.
    batchable: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
    handler: async (_args, ctx): Promise<McpToolResult> => {
      // Vroeg weigeren (pauze, alleen-lezen, dialoog, ander document): dan leest de tool ook niets. De
      // guard bindt ook het documentanker (`expectedDocId`); wisselt de gebruiker van document terwijl de
      // bronnen gelezen worden, dan weigert `runMutateTool` hieronder met DOC_DRIFT.
      const blocked = guardNonTransactional(ctx);
      if (blocked) return blocked;
      const start = ctx.app.store.getState();

      // Elk bronbestand één keer (genormaliseerd pad → pad zoals in de koppeling).
      const paths = new Map<string, string>();
      let manualLinks = 0;
      let unusablePaths = 0;
      for (const task of start.tasks) {
        for (const link of task.externalLinks ?? []) {
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
      for (const filePath of paths.values()) {
        const scope = checkScope(home, filePath);
        if (!scope.ok) { report.push({ path: filePath, status: 'outOfScope', reason: scope.reason }); continue; }
        try {
          const escaped = await fs.confine?.(scope.path);
          if (escaped) { report.push({ path: filePath, status: 'outOfScope', reason: escaped }); continue; }
          // Het pad uit de koppeling blijft de identiteit van de bron (herkennen bij verversen); lezen gaat
          // via het gecontroleerde pad.
          const source = await readExternalSource(filePath, {
            readTextFile: () => fs.readTextFile(scope.path),
            readFile: () => fs.readFile(scope.path),
          });
          sources.push(source);
          report.push({ path: filePath, status: 'read', projectName: source.projectName });
        } catch (e) {
          report.push({
            path: filePath,
            status: e instanceof ScopeEscapeError ? 'outOfScope' : 'unreadable',
            reason: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return runMutateTool(ctx, 'mutate', () => {
        const s = ctx.app.store.getState();
        const result = refreshFromSources(s.tasks, sources);
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
            // Een relatief pad kan nooit een bron worden; het telt mee als ontbrekend, zoals in de app.
            missing: result.missing + unusablePaths,
            manualLinks,
            changes,
          },
        };
      });
    },
  },
];
