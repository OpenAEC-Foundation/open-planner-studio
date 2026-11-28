import type { McpContext, McpToolOk } from '../contracts';
import type { BatchStepTool } from './batchTool';
import { McpStepError, runMutateTool, toolError, type MutationOutcome } from './runtime';
import { enrichOk, freshDates, okDirectGuarded, parsedBatchStep, projectEndInfo, WRITE_ANNOTATIONS } from './helpers';
import type { AppState } from '@/state/appStore';
import { validate } from '@/state/mcpValidation';
import { isAncestorRelation, relationKey } from '@/state/relationRules';
import {
  ANCESTOR_RELATION_REJECTION,
  LAG_SCHEMA,
  lagPatchOf,
  lagReport,
  normalizeSeqType,
  parseLag,
  selfRelationReason,
  seqAbbrev,
  SEQ_TYPE_SCHEMA,
  unknownTypeReason,
} from './sequenceFields';
import type { Sequence, SequenceType } from '@/types/sequence';
import { markDocumentEdited } from '@/state/documentEdited';

const ITEM_KEYS = ['seqId', 'type', 'lag', 'predecessorId', 'successorId'];

const FIELD_HINTS: Record<string, string> = {
  id: 'use `seqId` — the sequence id that get_project_overview/get_task return after the `#`',
  lagDays: 'use `lag` (number 2/-1 or string "+2d")',
  lagPercent: 'use `lag: "+50%"` — a percentage lag goes through the same `lag` field',
  lagUnit:
    'the lag UNIT (WORKTIME/ELAPSEDTIME) is deliberately not settable via the bridge: the read tools do not ' +
    'show it, so you could not read the result back',
  lagMinutes:
    'a minute-precise lag (from an IFC/P6 import) is deliberately not settable via the bridge: the read ' +
    'tools do not show it. Give the lag in days (day measure) via `lag` (a fraction such as 0.5 is allowed) — that ' +
    'CLEARS the minute lag, so the given value is really the effective one',
  fields: 'the fields sit directly on the item here (no `fields` block): { seqId, type, lag, … }',
};

interface SeqFields {
  predecessorId: string;
  successorId: string;
  type: SequenceType;
  lagDays: number;
  lagPercent?: number;
  lagMinutes?: number;
}

interface DepCandidate {
  seqId: string;
  next: SeqFields;
  changes: Record<string, unknown>;
}

function fieldsOf(seq: Sequence): SeqFields {
  return {
    predecessorId: seq.predecessorId,
    successorId: seq.successorId,
    type: seq.type,
    lagDays: Number.isFinite(seq.lagDays) ? seq.lagDays : 0,
    ...(seq.lagPercent !== undefined ? { lagPercent: seq.lagPercent } : {}),
    ...(seq.lagMinutes !== undefined ? { lagMinutes: seq.lagMinutes } : {}),
  };
}

function classifyDepUpdates(
  st: AppState,
  updates: unknown[],
): {
  candidates: DepCandidate[];
  rejections: { id: string; reason: string }[];
  projected: Map<string, SeqFields>;
} {
  const rejections: { id: string; reason: string }[] = [];
  const candidates: DepCandidate[] = [];
  const byId = new Map(st.sequences.map((s) => [s.id, s]));
  const projected = new Map(st.sequences.map((s) => [s.id, fieldsOf(s)]));
  const byTaskId = new Map(st.tasks.map((t) => [t.id, t]));
  const lookupTask = (tid: string) => byTaskId.get(tid);
  const seenSeqIds = new Set<string>();

  for (const raw of updates) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      rejections.push({ id: '(not an object)', reason: 'every item must be an object with a `seqId`' });
      continue;
    }
    const it = raw as Record<string, unknown>;
    const seqId = it.seqId;
    if (typeof seqId !== 'string' || seqId === '') {
      rejections.push({
        id: '(without seqId)',
        reason: 'every item requires a string `seqId` (the sequence id from get_project_overview / get_task)',
      });
      continue;
    }

    const unknownKeys = Object.keys(it).filter((k) => !ITEM_KEYS.includes(k));
    if (unknownKeys.length > 0) {
      const k = unknownKeys[0];
      const hint = FIELD_HINTS[k];
      rejections.push({
        id: seqId,
        reason:
          `unknown field \`${k}\`` +
          `${unknownKeys.length > 1 ? ` (and ${unknownKeys.slice(1).map((x) => `\`${x}\``).join(', ')})` : ''}` +
          `${hint ? `; ${hint}` : ''}. Allowed: ${ITEM_KEYS.join(', ')}`,
      });
      continue;
    }

    if (seenSeqIds.has(seqId)) {
      rejections.push({
        id: seqId,
        reason: `seqId '${seqId}' occurs more than once in this call; merge the changes into one item`,
      });
      continue;
    }
    seenSeqIds.add(seqId);

    const seq = byId.get(seqId);
    if (!seq) {
      rejections.push({ id: seqId, reason: `relationship '${seqId}' does not exist` });
      continue;
    }
    const cur = fieldsOf(seq);

    const touched = ITEM_KEYS.filter((k) => k !== 'seqId' && it[k] !== undefined);
    if (touched.length === 0) {
      rejections.push({
        id: seqId,
        reason: 'no change given; give at least one of `type`, `lag`, `predecessorId`, `successorId`',
      });
      continue;
    }

    let nextType = cur.type;
    if (it.type !== undefined) {
      const t = normalizeSeqType(it.type);
      if (!t) { rejections.push({ id: seqId, reason: unknownTypeReason(it.type) }); continue; }
      nextType = t;
    }

    let bad: string | null = null;
    let nextPred = cur.predecessorId;
    let nextSucc = cur.successorId;
    for (const [key, set] of [
      ['predecessorId', (v: string) => { nextPred = v; }],
      ['successorId', (v: string) => { nextSucc = v; }],
    ] as [string, (v: string) => void][]) {
      const v = it[key];
      if (v === undefined) continue;
      if (typeof v !== 'string') { bad = `\`${key}\` must be a task id (string), got ${typeof v}`; break; }
      if (!byTaskId.has(v)) { bad = `task '${v}' (\`${key}\`) does not exist`; break; }
      set(v);
    }
    if (bad) { rejections.push({ id: seqId, reason: bad }); continue; }
    if (nextPred === nextSucc) {
      rejections.push({ id: seqId, reason: selfRelationReason(nextPred) });
      continue;
    }
    const predIsNew = nextPred !== cur.predecessorId;
    const succIsNew = nextSucc !== cur.successorId;
    if (
      (predIsNew || succIsNew)
      && isAncestorRelation(lookupTask, { predecessorId: nextPred, successorId: nextSucc })
    ) {
      rejections.push({ id: seqId, reason: ANCESTOR_RELATION_REJECTION });
      continue;
    }

    let nextLag: Pick<SeqFields, 'lagDays' | 'lagPercent' | 'lagMinutes'> = {
      lagDays: cur.lagDays,
      ...(cur.lagPercent !== undefined ? { lagPercent: cur.lagPercent } : {}),
      ...(cur.lagMinutes !== undefined ? { lagMinutes: cur.lagMinutes } : {}),
    };
    if (it.lag !== undefined) {
      const parsed = parseLag(it.lag);
      if (!parsed.ok) { rejections.push({ id: seqId, reason: parsed.reason }); continue; }
      const p = lagPatchOf(parsed.value);
      nextLag = {
        lagDays: p.lagDays,
        ...(p.lagPercent !== undefined ? { lagPercent: p.lagPercent } : {}),
      };
    }

    const next: SeqFields = { predecessorId: nextPred, successorId: nextSucc, type: nextType, ...nextLag };

    const changes: Record<string, unknown> = {};
    if (next.predecessorId !== cur.predecessorId) {
      changes.predecessorId = { from: cur.predecessorId, to: next.predecessorId };
    }
    if (next.successorId !== cur.successorId) {
      changes.successorId = { from: cur.successorId, to: next.successorId };
    }
    if (next.type !== cur.type) changes.type = { from: seqAbbrev(cur.type), to: seqAbbrev(next.type) };
    const clearedMinutes =
      cur.lagMinutes !== undefined && cur.lagMinutes !== 0 && next.lagMinutes === undefined;
    if (next.lagDays !== cur.lagDays || next.lagPercent !== cur.lagPercent || clearedMinutes) {
      changes.lag = {
        from: lagReport(cur),
        to: lagReport(next),
        ...(clearedMinutes ? { clearedLagMinutes: cur.lagMinutes } : {}),
      };
    }
    if (Object.keys(changes).length === 0) {
      rejections.push({
        id: seqId,
        reason: `relationship '${seqId}' is already ${seqAbbrev(cur.type)}${lagReport(cur) === '0' ? '' : lagReport(cur)} (${cur.predecessorId} → ${cur.successorId}); there is nothing to change`,
      });
      continue;
    }

    const key = relationKey(next);
    let clash: string | null = null;
    for (const [otherId, f] of projected) {
      if (otherId !== seqId && relationKey(f) === key) { clash = otherId; break; }
    }
    if (clash) {
      rejections.push({
        id: seqId,
        reason:
          `that would create a duplicate of relationship '${clash}' (same predecessor, successor and type ` +
          `${seqAbbrev(next.type)}); adjust or remove that one first`,
      });
      continue;
    }

    projected.set(seqId, next);
    candidates.push({ seqId, next, changes });
  }

  return { candidates, rejections, projected };
}

function parseUpdateDeps(args: unknown): unknown[] | string {
  const a = (args ?? {}) as { updates?: unknown };
  if (!Array.isArray(a.updates) || a.updates.length === 0) {
    return 'update_dependencies requires a non-empty `updates` array';
  }
  return a.updates;
}

function updateDependenciesCore(ctx: McpContext, updates: unknown[]): MutationOutcome {
  const st = ctx.app.store.getState();
  const { candidates, rejections, projected } = classifyDepUpdates(st, updates);

  const cyc = validate.noCycle(
    { tasks: st.tasks, assignments: st.assignments, sequences: [] },
    [...projected.values()].map((f) => ({ predecessorId: f.predecessorId, successorId: f.successorId })),
  );
  if (cyc) throw new McpStepError('CYCLE', `circular dependency detected: ${cyc.join(' → ')}`);

  if (candidates.length > 0) {
    ctx.app.store.setState((s) => {
      for (const c of candidates) {
        const seq = s.sequences.find((x) => x.id === c.seqId);
        if (!seq) continue;
        seq.predecessorId = c.next.predecessorId;
        seq.successorId = c.next.successorId;
        seq.type = c.next.type;
        seq.lagDays = c.next.lagDays;
        if (c.next.lagPercent === undefined) delete seq.lagPercent;
        else seq.lagPercent = c.next.lagPercent;
        if (c.next.lagMinutes === undefined) delete seq.lagMinutes;
        else seq.lagMinutes = c.next.lagMinutes;
      }
      markDocumentEdited(s);
    });
  }

  return {
    data: { updated: candidates.map((c) => ({ id: c.seqId, changes: c.changes })) },
    itemRejections: rejections,
  };
}

function affectedTaskIds(state: AppState, seqIds: string[], before: Map<string, SeqFields>): string[] {
  const live = state.sequences;
  const ids = new Set<string>();
  for (const id of seqIds) {
    const now = live.find((s) => s.id === id);
    if (now) ids.add(now.successorId);
    const prev = before.get(id);
    if (prev) ids.add(prev.successorId);
  }
  return [...ids];
}

const updateDependencies: BatchStepTool = {
  name: 'planner_update_dependencies',
  description:
    'Change relationships by `seqId` (after `#` in the read tools); keeps the id, so use it instead of remove ' +
    '+ add. Only given fields change. A summary task as new endpoint is ALLOWED. A link to an own ancestor ' +
    'is refused; a cycle fails the whole call.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['seqId'],
          properties: {
            seqId: { type: 'string' },
            type: SEQ_TYPE_SCHEMA,
            lag: LAG_SCHEMA,
            predecessorId: { type: 'string' },
            successorId: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    required: ['updates'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseUpdateDeps, updateDependenciesCore),
  async handler(args, ctx) {
    const parsed = parseUpdateDeps(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const before = new Map(ctx.app.store.getState().sequences.map((s) => [s.id, fieldsOf(s)]));
    {
      const state = ctx.app.store.getState();
      const pre = classifyDepUpdates(state, parsed);
      if (pre.candidates.length === 0) {
        return okDirectGuarded(ctx, { updated: [], tasks: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => updateDependenciesCore(ctx, parsed));
    return enrichOk(res, () => {
      const data = (res as McpToolOk).data as { updated: { id: string; changes: Record<string, unknown> }[] };
      const state = ctx.app.store.getState();
      return {
        updated: data.updated,
        tasks: freshDates(state, affectedTaskIds(state, data.updated.map((u) => u.id), before)),
        projectEnd: projectEndInfo(state).projectEnd,
      };
    });
  },
};

export const dependencyTools: BatchStepTool[] = [updateDependencies];
