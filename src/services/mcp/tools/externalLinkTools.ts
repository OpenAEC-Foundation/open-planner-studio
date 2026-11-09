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
      'Re-read external relationship anchors (links to a task in another project file) from their source ' +
      'files: read-only, not opened. Updates anchors and `sourceMissing` in one undo step, then recalculates. ' +
      'Reads only files inside the home folder; links to an unread file and site links (`siteLinks`) keep ' +
      'their anchor. A link without a file path refreshes only via another link to the same source project ' +
      '(`manualLinks`). Report `sources` (read per file) and `changes` (`anchorBefore` → `anchorAfter`).',
    kind: 'mutate',
    // Async (bestanden lezen vóór de transactie): past niet in een synchroon draaiboek.
    batchable: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    // Leest bestanden van de gebruiker, net als de bestandstools (`fileTools.ts`): `openWorldHint: true`.
    annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true, openWorldHint: true },
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
      // Stap 1.9: een koppeling naar een project op de site leest deze tool niet (geen site in de desktop-app of
      // de headless server). Ze is niet met de hand ingevoerd; `refreshFromSources` laat haar staan.
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
      // Gelezen bronpaden. Alleen hun koppelingen worden ververst (`refreshFromSources`, review #813): een
      // koppeling naar een bron die niet gelezen is, houdt haar anker en pad. Dat geldt ook voor een koppeling
      // die de planner tijdens het lezen naar een ander bronbestand zette. Hun balk (#811) gaat weg na een
      // geslaagde verversing, zoals bij *Alle externe relaties vernieuwen*.
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
          // Herkomst (keuze 4, #809), zoals `parseExternalSource` in de app: de wijzigingstijd VÓÓR het
          // lezen, dus bij een wijziging tijdens het lezen nooit een te nieuwe versie. Lukt `stat` niet,
          // dan blijft de versie onbekend.
          const version = await fs.stat(scope.path).then(info => info.mtime?.toISOString(), () => undefined);
          // Het pad uit de koppeling blijft de identiteit van de bron (herkennen bij verversen); lezen gaat
          // via het gecontroleerde pad.
          const read = await readExternalSource(filePath, {
            readTextFile: () => fs.readTextFile(scope.path),
            readFile: () => fs.readFile(scope.path),
          });
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

      // Het document van de transactie (de drift-guard van `runMutateTool` bindt het).
      let documentId = null as string | null;
      const res = await runMutateTool(ctx, 'mutate', () => {
        const s = ctx.app.store.getState();
        documentId = s.activeDocumentId;
        // Tegen de koppelingen van NU, niet die van vóór het lezen: `readPaths` gaat over de gelezen bestanden.
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
            // Een relatief pad kan nooit een bron worden; het telt mee als ontbrekend, zoals in de app.
            missing: result.missing + unusablePaths,
            manualLinks,
            siteLinks,
            changes,
          },
        };
      });
      // De balk pas weg als de verversing echt in het document staat. Een geweigerde transactie (bijvoorbeeld
      // een kringverwijzing bij het doorrekenen) rolt de koppelingen terug, maar niet de balk: die staat
      // buiten de documentsnapshot (`createMcpTransactions`).
      if (res.ok && documentId !== null) ctx.app.store.getState().dropExternalSourceUpdates(documentId, readPaths);
      return res;
    },
  },
];
