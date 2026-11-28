import type { AppState } from '@/state/appStore';
import { bindExpectedDoc, buildEnvelope, guardNonTransactional, mcpDocumentTitle, preBackupGuards, runReadTool, toolError } from './runtime';
import type { McpContext, McpToolDef, McpToolErr, McpToolResult } from '../contracts';
import { READ_ANNOTATIONS, WRITE_ANNOTATIONS } from './helpers';

export function guardBridgeFlags(ctx: McpContext): McpToolErr | null {
  return preBackupGuards(ctx);
}

interface DocumentRow {
  id: string;
  title: string;
  isActive: boolean;
  isDirty: boolean;
  taskCount: number;
  projectStart: string;
  projectEnd?: string;
  notCalculated?: true;
  calculationError?: string;
  scheduleStale?: true;
  datesAsRecorded?: true;
}

function listDocuments(s: AppState): { activeDocumentId: string; documents: DocumentRow[] } {
  const infos = new Map(s.getOpenDocuments().map((d) => [d.id, d]));
  const documents = s.documents.map((entry) => {
    const isActive = entry.id === s.activeDocumentId;
    const project = isActive ? s.project : entry.payload!.project;
    const tasks = isActive ? s.tasks : entry.payload!.tasks;
    const cpm = isActive ? s.cpmResult : entry.payload!.cpmResult;
    const stale = isActive ? s.scheduleStale : entry.payload!.scheduleStale;
    const asRecorded = isActive ? s.datesAsRecorded : entry.payload!.datesAsRecorded;
    const info = infos.get(entry.id);
    const row: DocumentRow = {
      id: entry.id,
      title: mcpDocumentTitle(info),
      isActive,
      isDirty: info ? info.isDirty : false,
      taskCount: tasks.length,
      projectStart: project.startDate,
    };
    if (cpm === null) {
      row.notCalculated = true;
    } else {
      if (cpm.projectEnd) row.projectEnd = cpm.projectEnd;
      if (cpm.error) row.calculationError = cpm.error;
    }
    if (stale) row.scheduleStale = stale;
    if (asRecorded) row.datesAsRecorded = asRecorded;
    return row;
  });
  return { activeDocumentId: s.activeDocumentId, documents };
}

export const documentTools: McpToolDef[] = [
  {
    name: 'planner_list_documents',
    description:
      'Open documents (tabs) with id, project end and which is active. `title` is a ' +
      'display title, not the project name. Only the active document is recalculated; others may be ' +
      '`scheduleStale`.',
    kind: 'document',
    batchable: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ANNOTATIONS,
    handler: (_args, ctx) => runReadTool(ctx, (s) => listDocuments(s), { freshSchedule: true }),
  },
  {
    name: 'planner_new_document',
    description:
      'Open a new empty document and make it active; later calls go there. For a copy use ' +
      'planner_duplicate_document.',
    kind: 'document',
    batchable: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: WRITE_ANNOTATIONS,
    handler: (_args, ctx): McpToolResult => {
      const blocked = guardBridgeFlags(ctx);
      if (blocked) return blocked;
      const s = ctx.app.store.getState();
      const documentId = s.newDocument();
      bindExpectedDoc(ctx);
      const info = ctx.app.store.getState().getOpenDocuments().find((d) => d.id === documentId);
      return {
        ok: true,
        envelope: buildEnvelope(ctx),
        data: { documentId, title: mcpDocumentTitle(info) },
      };
    },
  },
  {
    name: 'planner_duplicate_document',
    description:
      'Copy the ACTIVE document into a new active tab, for what-if variants. Later calls go to the copy: switch back before making another variant. Leave closing to the user.',
    kind: 'document',
    batchable: false,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      additionalProperties: false,
    },
    annotations: WRITE_ANNOTATIONS,
    handler: (args, ctx): McpToolResult => {
      const blocked = guardNonTransactional(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { name?: unknown };
      if (raw.name !== undefined && typeof raw.name !== 'string') {
        return toolError(ctx, 'VALIDATION', 'Parameter \'name\' must be text when you pass it.');
      }
      const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : undefined;
      const documentId = ctx.app.store.getState().duplicateDocument(name);
      ctx.markDuplicateBorn(documentId);
      bindExpectedDoc(ctx);
      const s = ctx.app.store.getState();
      const info = s.getOpenDocuments().find((d) => d.id === documentId);
      return {
        ok: true,
        envelope: buildEnvelope(ctx),
        data: {
          documentId,
          title: mcpDocumentTitle(info),
          projectName: s.project.name,
          taskCount: s.tasks.length,
        },
      };
    },
  },
  {
    name: 'planner_switch_document',
    description:
      'Make another open document active. Also resolves DOC_DRIFT (the user switched tabs): confirm the target ' +
      'here.',
    kind: 'document',
    batchable: false,
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
      },
      required: ['documentId'],
      additionalProperties: false,
    },
    annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
    handler: (args, ctx): McpToolResult => {
      const blocked = guardBridgeFlags(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { documentId?: unknown };
      if (typeof raw.documentId !== 'string' || raw.documentId.trim() === '') {
        return toolError(ctx, 'VALIDATION', 'Parameter \'documentId\' (text) is required; get valid ids with planner_list_documents.');
      }
      const documentId = raw.documentId;
      const s = ctx.app.store.getState();
      if (!s.documents.some((d) => d.id === documentId)) {
        return toolError(ctx, 'NOT_FOUND', `Unknown document id '${documentId}'; open documents are: ${s.documents.map((d) => d.id).join(', ')}`);
      }
      s.switchDocument(documentId);
      bindExpectedDoc(ctx);
      const after = ctx.app.store.getState();
      const info = after.getOpenDocuments().find((d) => d.id === documentId);
      return {
        ok: true,
        envelope: buildEnvelope(ctx),
        data: {
          documentId,
          title: mcpDocumentTitle(info),
          taskCount: after.tasks.length,
        },
      };
    },
  },
];
