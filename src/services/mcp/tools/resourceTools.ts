import type { McpContext, McpToolOk } from '../contracts';
import {
  runMutateTool,
  toolError,
  McpStepError,
  type MutationOutcome,
} from './runtime';
import type { BatchStepTool } from './batchTool';
import {
  booleanArgReason, enrichOk, okDirectGuarded, parsedBatchStep, projectEndInfo, TEMP_ID_PATTERN, WRITE_ANNOTATIONS,
} from './helpers';
import type { AppState } from '@/state/appStore';
import { RESOURCE_TYPES as ALL_RESOURCE_TYPES, type AvailabilityStep, type Resource, type ResourceType } from '@/types/resource';
import { RESOURCE_DIFF_FIELDS, isResourceFieldLocked } from '@/services/library/libraryOps';
import { isFiniteNumber } from '@/utils/guards';
import { hasLevelingOutput } from '@/utils/taskDefaults';

type Rejection = { id: string; reason: string };
type StoreState = AppState;

const RESOURCE_TYPES: readonly ResourceType[] = ALL_RESOURCE_TYPES;

const RESOURCE_FIELD_KEYS = [
  'name', 'type', 'description', 'maxUnits', 'costPerHour', 'unitOfMeasure',
  'calendarId', 'parentId', 'availabilitySteps',
] as const;
type ResourceFieldKey = (typeof RESOURCE_FIELD_KEYS)[number];

const ALLOWED_KEYS: Record<string, string[]> = {
  create: ['action', 'tempId', ...RESOURCE_FIELD_KEYS],
  update: ['action', 'id', ...RESOURCE_FIELD_KEYS],
  delete: ['action', 'id', 'cascade'],
};

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type FieldPatch = Partial<Record<ResourceFieldKey, unknown>>;

interface CreateAction { action: 'create'; tempId?: string; [k: string]: unknown }
interface UpdateAction { action: 'update'; id: string; [k: string]: unknown }
interface DeleteAction { action: 'delete'; id: string; cascade?: boolean }
type ResourceAction = CreateAction | UpdateAction | DeleteAction;

function unknownKeyReason(item: Record<string, unknown>, action: string): string | null {
  const allowed = ALLOWED_KEYS[action];
  const bad = Object.keys(item).filter((k) => !allowed.includes(k));
  if (bad.length === 0) return null;
  return `unknown key(s) ${bad.map((k) => `\`${k}\``).join(', ')} for action '${action}'; allowed are: ` +
    `${allowed.join(', ')}`;
}

function parseAvailabilitySteps(raw: unknown): AvailabilityStep[] | string {
  if (!Array.isArray(raw)) return '`availabilitySteps` must be an array (or `null` to clear them)';
  const seen = new Set<string>();
  const out: AvailabilityStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return 'every item in `availabilitySteps` must be an object';
    const step = s as Record<string, unknown>;
    for (const k of Object.keys(step)) {
      if (k !== 'from' && k !== 'maxUnits') {
        return `unknown key \`${k}\` in \`availabilitySteps\`; allowed are: from, maxUnits`;
      }
    }
    if (typeof step.from !== 'string' || !ISO_DATE_ONLY.test(step.from)) {
      return `\`availabilitySteps.from\` must be an ISO date (YYYY-MM-DD), got '${String(step.from)}'`;
    }
    if (!isFiniteNumber(step.maxUnits) || step.maxUnits < 0) {
      return `\`availabilitySteps.maxUnits\` must be a number >= 0 (units per working day), got '${String(step.maxUnits)}'`;
    }
    if (seen.has(step.from)) return `\`availabilitySteps\` contains two steps with the same date '${step.from}'`;
    seen.add(step.from);
    out.push({ from: step.from, maxUnits: step.maxUnits });
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

function parseFields(item: Record<string, unknown>): FieldPatch | string {
  const patch: FieldPatch = {};

  if (item.name !== undefined) {
    if (typeof item.name !== 'string' || item.name.trim() === '') return '`name` must be a non-empty string';
    patch.name = item.name;
  }
  if (item.type !== undefined) {
    if (!(RESOURCE_TYPES as string[]).includes(item.type as string)) {
      return `unknown \`type\` '${String(item.type)}'; valid values are ${RESOURCE_TYPES.join(', ')} (case-sensitive)`;
    }
    patch.type = item.type;
  }
  if (item.description !== undefined) {
    if (typeof item.description !== 'string') return '`description` must be a string (use "" to empty it)';
    patch.description = item.description;
  }
  if (item.maxUnits !== undefined) {
    if (!isFiniteNumber(item.maxUnits) || item.maxUnits <= 0) {
      return `\`maxUnits\` must be a number > 0 (capacity per WORKING DAY; 1 = 100% = one person/piece), got '${String(item.maxUnits)}'`;
    }
    patch.maxUnits = item.maxUnits;
  }
  if (item.costPerHour !== undefined) {
    if (item.costPerHour === null) patch.costPerHour = undefined;
    else if (!isFiniteNumber(item.costPerHour) || item.costPerHour < 0) {
      return `\`costPerHour\` must be a number ≥ 0 (cost per HOUR) or \`null\` to clear it, got '${String(item.costPerHour)}'`;
    } else patch.costPerHour = item.costPerHour;
  }
  if (item.unitOfMeasure !== undefined) {
    if (item.unitOfMeasure === null) patch.unitOfMeasure = undefined;
    else if (typeof item.unitOfMeasure !== 'string' || item.unitOfMeasure.trim() === '') {
      return '`unitOfMeasure` must be a non-empty string (e.g. "m3", "ton") or `null` to clear it';
    } else patch.unitOfMeasure = item.unitOfMeasure;
  }
  if (item.calendarId !== undefined) {
    if (item.calendarId === null) patch.calendarId = undefined;
    else if (typeof item.calendarId !== 'string' || item.calendarId === '') {
      return '`calendarId` must be an existing calendar id or `null` (= the project calendar)';
    } else patch.calendarId = item.calendarId;
  }
  if (item.parentId !== undefined) {
    if (item.parentId === null) patch.parentId = undefined;
    else if (typeof item.parentId !== 'string' || item.parentId === '') {
      return '`parentId` must be the id of a CREW resource or `null` (= no crew)';
    } else patch.parentId = item.parentId;
  }
  if (item.availabilitySteps !== undefined) {
    if (item.availabilitySteps === null) patch.availabilitySteps = undefined;
    else {
      const steps = parseAvailabilitySteps(item.availabilitySteps);
      if (typeof steps === 'string') return steps;
      patch.availabilitySteps = steps.length > 0 ? steps : undefined;
    }
  }
  return patch;
}

interface SimResource { id: string; type: ResourceType; parentId?: string }

type ResourcePlan =
  | { mode: 'create'; index: number; tempId?: string; fields: FieldPatch }
  | { mode: 'update'; index: number; id: string; fields: FieldPatch }
  | { mode: 'delete'; index: number; id: string };

function libraryLockReason(s: StoreState, resourceId: string, fields: FieldPatch): string | null {
  if (!isResourceFieldLocked(s.onOpenStatusForResource(resourceId))) return null;
  const geraakt = RESOURCE_DIFF_FIELDS.filter((f) => f in fields);
  if (geraakt.length === 0) return null;

  const res = s.resources.find((r) => r.id === resourceId);
  const companyId = res?.libraryOrigin?.companyId;
  const bedrijf = s.companies.find((c) => c.id === companyId)?.name ?? '(name unknown)';
  const projectVelden = RESOURCE_FIELD_KEYS.filter((k) => !(RESOURCE_DIFF_FIELDS as string[]).includes(k));
  return (
    `resource '${resourceId}'${res ? ` ('${res.name}')` : ''} comes from the resource library ${bedrijf}; ` +
    `${geraakt.join(', ')} ${geraakt.length === 1 ? 'is' : 'are'} fixed there and cannot be changed in the ` +
    'resource panel either (the library determines WHAT a resource is). Two routes: change it in the library ' +
    'itself (Backstage → Library) — that then applies to EVERY project that uses this resource, and the ' +
    'bridge deliberately does not offer that route, because it also affects projects that are not open now; ' +
    'or first unlink this resource from the library ("Unlink from library" in the Resources tab), after ' +
    'which it is project-owned and fully editable. Can still be changed via this tool: ' +
    `${projectVelden.join(', ')} (project deployment).`
  );
}

function classifyResources(
  s: StoreState,
  actions: ResourceAction[],
): { plans: ResourcePlan[]; rejections: Rejection[] } {
  const plans: ResourcePlan[] = [];
  const rejections: Rejection[] = [];
  let sim: SimResource[] = s.resources.map((r) => ({ id: r.id, type: r.type, parentId: r.parentId }));
  const assignmentsOf = (id: string) => s.assignments.filter((a) => a.resourceId === id);
  const calendarIds = new Set(s.calendars.map((c) => c.id));

  const wouldCycle = (selfId: string, parentId: string): boolean => {
    const seen = new Set<string>();
    let cur: string | undefined = parentId;
    while (cur !== undefined) {
      if (cur === selfId) return true;
      if (seen.has(cur)) return false;
      seen.add(cur);
      cur = sim.find((r) => r.id === cur)?.parentId;
    }
    return false;
  };

  const referenceReason = (patch: FieldPatch, selfId: string, effectiveType: ResourceType, currentType?: ResourceType): string | null => {
    if (currentType !== undefined && patch.type !== undefined && patch.type !== currentType
      && (currentType === 'COST' || patch.type === 'COST') && assignmentsOf(selfId).length > 0) {
      return `resource '${selfId}' still has ${assignmentsOf(selfId).length} assignment(s); a type change to or from ` +
        'COST is refused while it has assignments (units and work cannot be turned into an amount and back). ' +
        'Remove the assignments first with planner_manage_assignments (`remove`).';
    }
    if (effectiveType === 'COST') {
      const bad = (['costPerHour', 'unitOfMeasure', 'calendarId', 'availabilitySteps', 'parentId'] as const)
        .filter((k) => patch[k] !== undefined);
      if (patch.maxUnits !== undefined && patch.maxUnits !== 1) bad.push('maxUnits' as never);
      if (bad.length > 0) {
        return `a COST resource has no ${bad.join(', ')}: it carries a fixed amount per assignment ` +
          '(planner_manage_assignments `costAmount`), no rate, capacity, calendar, unit or crew';
      }
    }
    if (patch.calendarId !== undefined) {
      const calId = patch.calendarId as string;
      if (!calendarIds.has(calId)) {
        const hint = calId === s.calendar.id
          ? ' — this IS the PROJECT calendar, but it is not yet in the library of this document; use `null` ' +
            '(that already means "the project calendar") or promote it first with planner_update_calendar'
          : '; get valid ids with planner_get_calendars, or create one with planner_update_calendar (`create: true`)';
        return `calendar '${calId}' does not exist in this document${hint}`;
      }
    }
    if (patch.parentId !== undefined) {
      const pid = patch.parentId as string;
      const parent = sim.find((r) => r.id === pid);
      if (!parent) return `crew '${pid}' does not exist; \`parentId\` must be the id of an existing CREW resource`;
      if (parent.type !== 'CREW') {
        return `resource '${pid}' has type ${parent.type}; \`parentId\` may only point to a CREW resource (crew membership)`;
      }
      if (pid === selfId) return 'a resource cannot be its own crew';
      if (wouldCycle(selfId, pid)) return `crew '${pid}' is already under this resource; that would create a cycle in the crew membership`;
    }
    if (patch.unitOfMeasure !== undefined && effectiveType !== 'MATERIAL') {
      return `\`unitOfMeasure\` only applies to type MATERIAL (this resource is ${effectiveType}) — just ` +
        'like in the resource panel, where the field is disabled then';
    }
    return null;
  };

  actions.forEach((raw, index) => {
    const at = `#${index}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      rejections.push({ id: at, reason: 'every item must be an object with an `action` (create | update | delete)' });
      return;
    }
    const item = raw as unknown as Record<string, unknown>;
    const action = item.action;
    if (action !== 'create' && action !== 'update' && action !== 'delete') {
      rejections.push({ id: at, reason: `unknown action '${String(action)}' (create | update | delete)` });
      return;
    }
    const badKey = unknownKeyReason(item, action);
    if (badKey) {
      rejections.push({ id: typeof item.id === 'string' ? item.id : at, reason: badKey });
      return;
    }

    if (action === 'create') {
      const label = typeof item.tempId === 'string' ? item.tempId : (typeof item.name === 'string' ? item.name : at);
      if (item.tempId !== undefined) {
        if (typeof item.tempId !== 'string' || !TEMP_ID_PATTERN.test(item.tempId)) {
          rejections.push({
            id: String(item.tempId),
            reason: `\`tempId\` '${String(item.tempId)}' does not follow the reserved batch syntax; it must ` +
              'start with `tmp-` or `tmp_` (e.g. `tmp-crane-2`), so a next batch step can refer to it ' +
              'without ever hitting ordinary text',
          });
          return;
        }
        if (sim.some((r) => r.id === item.tempId)) {
          rejections.push({ id: item.tempId as string, reason: `\`tempId\` '${item.tempId}' was already used earlier in this call` });
          return;
        }
      }
      if (typeof item.name !== 'string' || item.name.trim() === '') {
        rejections.push({ id: label, reason: '`create` requires a non-empty `name`' });
        return;
      }
      const fields = parseFields(item);
      if (typeof fields === 'string') { rejections.push({ id: label, reason: fields }); return; }
      const simId = typeof item.tempId === 'string' ? item.tempId : `\u0000new-${index}`;
      const effectiveType = (fields.type as ResourceType) ?? 'LABOR';
      const refBad = referenceReason(fields, simId, effectiveType);
      if (refBad) { rejections.push({ id: label, reason: refBad }); return; }
      sim = [...sim, { id: simId, type: effectiveType, parentId: fields.parentId as string | undefined }];
      plans.push({ mode: 'create', index, tempId: typeof item.tempId === 'string' ? item.tempId : undefined, fields });
      return;
    }

    if (action === 'update') {
      if (typeof item.id !== 'string' || item.id === '') {
        rejections.push({ id: at, reason: '`update` requires a non-empty string `id` (exactly the id from planner_list_resources)' });
        return;
      }
      const cur = sim.find((r) => r.id === item.id);
      if (!cur) {
        rejections.push({ id: item.id, reason: `resource '${item.id}' does not exist; get valid ids with planner_list_resources, or create it with \`action: "create"\`` });
        return;
      }
      const fields = parseFields(item);
      if (typeof fields === 'string') { rejections.push({ id: item.id, reason: fields }); return; }
      if (Object.keys(fields).length === 0) {
        rejections.push({
          id: item.id,
          reason: `no changes given; pass at least one of ${RESOURCE_FIELD_KEYS.join(', ')}`,
        });
        return;
      }
      const lockBad = libraryLockReason(s, item.id, fields);
      if (lockBad) { rejections.push({ id: item.id, reason: lockBad }); return; }
      const effectiveType = (fields.type as ResourceType) ?? cur.type;
      const refBad = referenceReason(fields, cur.id, effectiveType, cur.type);
      if (refBad) { rejections.push({ id: item.id, reason: refBad }); return; }
      cur.type = effectiveType;
      if ('parentId' in fields) cur.parentId = fields.parentId as string | undefined;
      plans.push({ mode: 'update', index, id: item.id, fields });
      return;
    }

    if (typeof item.id !== 'string' || item.id === '') {
      rejections.push({ id: at, reason: '`delete` requires a non-empty string `id`' });
      return;
    }
    if (item.cascade !== undefined && typeof item.cascade !== 'boolean') {
      rejections.push({ id: item.id, reason: booleanArgReason(item.cascade, 'cascade') });
      return;
    }
    const target = sim.find((r) => r.id === item.id);
    if (!target) {
      rejections.push({ id: item.id, reason: `resource '${item.id}' does not exist (or was already deleted in this call)` });
      return;
    }
    if (target.id.startsWith('\u0000') || TEMP_ID_PATTERN.test(target.id)) {
      rejections.push({ id: item.id, reason: 'a resource created in the same call cannot be deleted in that same call' });
      return;
    }
    const attached = assignmentsOf(item.id);
    if (attached.length > 0 && item.cascade !== true) {
      const taskCount = new Set(attached.map((a) => a.taskId)).size;
      rejections.push({
        id: item.id,
        reason: `resource '${item.id}' still has ${attached.length} assignment(s) on ${taskCount} task(s); ` +
          'deleting clears those assignments TOO. Confirm with `cascade: true`, or remove them first with ' +
          'planner_manage_assignments (`remove`).',
      });
      return;
    }
    sim = sim.filter((r) => r.id !== item.id);
    for (const r of sim) if (r.parentId === item.id) r.parentId = undefined;
    plans.push({ mode: 'delete', index, id: item.id });
  });

  return { plans, rejections };
}

function parseManageResources(args: unknown): ResourceAction[] | string {
  const a = (args ?? {}) as { actions?: unknown };
  if (!Array.isArray(a.actions) || a.actions.length === 0) {
    return 'manage_resources requires a non-empty `actions` array';
  }
  return a.actions as ResourceAction[];
}

function buildNewResource(fields: FieldPatch): Omit<Resource, 'id'> {
  const res: Omit<Resource, 'id'> = {
    name: fields.name as string,
    type: (fields.type as ResourceType) ?? 'LABOR',
    description: (fields.description as string) ?? '',
    maxUnits: (fields.maxUnits as number) ?? 1,
  };
  if (fields.costPerHour !== undefined) res.costPerHour = fields.costPerHour as number;
  if (fields.unitOfMeasure !== undefined) res.unitOfMeasure = fields.unitOfMeasure as string;
  if (fields.calendarId !== undefined) res.calendarId = fields.calendarId as string;
  if (fields.parentId !== undefined) res.parentId = fields.parentId as string;
  if (fields.availabilitySteps !== undefined) res.availabilitySteps = fields.availabilitySteps as AvailabilityStep[];
  return res;
}

function manageResourcesCore(ctx: McpContext, actions: ResourceAction[]): MutationOutcome {
  const { plans, rejections } = classifyResources(ctx.app.store.getState(), actions);

  const created: Record<string, string> = {};
  const createdRows: Record<string, unknown>[] = [];
  const updatedRows: Record<string, unknown>[] = [];
  const deletedRows: Record<string, unknown>[] = [];
  const tempToReal = new Map<string, string>();

  const asgBefore = ctx.app.store.getState().assignments.length;

  for (const plan of plans) {
    if (plan.mode === 'create') {
      const fields = { ...plan.fields };
      if (typeof fields.parentId === 'string' && tempToReal.has(fields.parentId)) {
        fields.parentId = tempToReal.get(fields.parentId)!;
      }
      const id = ctx.transactions.draft.addResource(buildNewResource(fields));
      if (plan.tempId) { created[plan.tempId] = id; tempToReal.set(plan.tempId, id); }
      createdRows.push({ id, ...(plan.tempId ? { tempId: plan.tempId } : {}), name: fields.name as string });
      continue;
    }

    if (plan.mode === 'update') {
      const fields = { ...plan.fields };
      if (typeof fields.parentId === 'string' && tempToReal.has(fields.parentId)) {
        fields.parentId = tempToReal.get(fields.parentId)!;
      }
      ctx.transactions.draft.updateResource(plan.id, fields as unknown as Partial<Resource>);
      updatedRows.push({ id: plan.id, changedFields: Object.keys(fields) });
      continue;
    }

    const before = ctx.app.store.getState().resources.find((r) => r.id === plan.id);
    if (!before) {
      throw new McpStepError('NOT_FOUND', `resource '${plan.id}' does not exist (after classification)`);
    }
    const name = before.name;
    const diff = ctx.transactions.draft.removeResource(plan.id);
    deletedRows.push({
      id: plan.id,
      name,
      removedAssignmentIds: diff.removedAssignmentIds,
      removedAssignmentCount: diff.removedAssignmentIds.length,
      affectedTaskIds: diff.affectedTaskIds,
      orphanedCrewMemberIds: diff.orphanedCrewMemberIds,
    });
  }

  const removedAssignmentCount = asgBefore - ctx.app.store.getState().assignments.length;

  return {
    data: {
      created,
      resources: createdRows,
      updated: updatedRows,
      deleted: deletedRows,
      removedAssignmentCount,
    },
    itemRejections: rejections,
  };
}

const EMPTY_DATA = { created: {}, resources: [], updated: [], deleted: [], removedAssignmentCount: 0 };

const manageResources: BatchStepTool = {
  name: 'planner_manage_resources',
  description:
    'Create (`name`), update (`id` + fields) or delete (`id`) resources; assign with ' +
    'planner_manage_assignments. Omitted = unchanged; null clears. Delete clears assignments (needs ' +
    '`cascade: true` if any); deleting CREW clears members\' `parentId`. Create `tempId` maps in `created` ' +
    'for later steps of this planner_batch. Library locks name/type/description/costPerHour/unitOfMeasure: ' +
    'offer library change or unlinking. COST: a fixed amount per assignment (planner_manage_assignments ' +
    '`costAmount`), no costPerHour/unitOfMeasure/calendarId/availabilitySteps/parentId, maxUnits 1; no ' +
    'load or leveling; no type change to or from COST while it has assignments.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['create', 'update', 'delete'] },
            id: { type: 'string' },
            tempId: { type: 'string', description: '`create` only; must start with `tmp-` or `tmp_`.' },
            cascade: { type: 'boolean' },
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW', 'COST'],
              description: 'Default LABOR. COST = a fixed amount per assignment.',
            },
            description: { type: 'string', description: '"" empties it (not null).' },
            maxUnits: {
              type: 'number',
              exclusiveMinimum: 0,
              description: 'Per WORKING DAY; 1 = one person/piece. Default 1.',
            },
            costPerHour: { type: ['number', 'null'], minimum: 0 },
            unitOfMeasure: { type: ['string', 'null'], description: 'MATERIAL only (e.g. "m3").' },
            calendarId: { type: ['string', 'null'], description: 'null = project calendar.' },
            parentId: { type: ['string', 'null'], description: 'A CREW resource (grouping only).' },
            availabilitySteps: {
              type: ['array', 'null'],
              description:
                '`maxUnits` from ISO date `from` onwards (0 = unavailable).',
              items: {
                type: 'object',
                required: ['from', 'maxUnits'],
                properties: {
                  from: { type: 'string' },
                  maxUnits: { type: 'number', minimum: 0 },
                },
              },
            },
          },
        },
      },
    },
    required: ['actions'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseManageResources, manageResourcesCore),
  async handler(args, ctx) {
    const parsed = parseManageResources(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const actions = parsed;

    {
      const state = ctx.app.store.getState();
      const pre = classifyResources(state, actions);
      if (pre.plans.length === 0) {
        return okDirectGuarded(ctx, { ...EMPTY_DATA, warnings: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
      }
    }

    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => manageResourcesCore(ctx, actions));

    return enrichOk(res, () => {
      const data = (res as McpToolOk).data as {
        deleted: { id: string; name: string; removedAssignmentCount: number; orphanedCrewMemberIds: string[] }[];
        updated: { id: string; changedFields: string[] }[];
        removedAssignmentCount: number;
      };
      const warnings: string[] = [];
      const totalRemoved = data.removedAssignmentCount;
      if (totalRemoved > 0) {
        warnings.push(
          `${totalRemoved} assignment(s) were deleted TOO along with ${data.deleted.length} resource(s) (` +
          `${data.deleted.map((d) => `${d.name}: ${d.removedAssignmentCount}`).join(', ')}). That work is ` +
          'now on no resource at all — check the tasks involved (see `affectedTaskIds`).',
        );
      }
      const orphaned = data.deleted.flatMap((d) => d.orphanedCrewMemberIds);
      if (orphaned.length > 0) {
        warnings.push(
          `${orphaned.length} resource(s) lost their crew membership because their CREW was deleted (` +
          `${orphaned.join(', ')}); their \`parentId\` is now empty.`,
        );
      }
      const capacityTouched =
        totalRemoved > 0 ||
        data.updated.some((u) => u.changedFields.some((f) => f === 'maxUnits' || f === 'availabilitySteps' || f === 'calendarId'));
      const state = ctx.app.store.getState();
      if (capacityTouched && state.tasks.some(hasLevelingOutput)) {
        warnings.push(
          'An APPLIED leveling is on this schedule; it was calculated on the OLD capacity and is now out of ' +
          'date. Run planner_level_resources again or clear it with planner_clear_leveling.',
        );
      }
      return { ...((res as McpToolOk).data as object), warnings, ...projectEndInfo(state) };
    });
  },
};

export const resourceTools: BatchStepTool[] = [manageResources];
