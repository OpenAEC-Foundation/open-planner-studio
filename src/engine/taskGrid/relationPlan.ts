import { detectCycleInEdges } from '@/engine/scheduler/graphWalk';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import {
  externalAnchorSideIsCompatible,
  sourceProjectKeyFor,
  type ExternalDirection,
  type ExternalRelationType,
  type ParsedExternalRelationClipboard,
} from '@/engine/taskGrid/relationFormat';
import { relationStructureVerdict } from '@/engine/scheduler/relationRules';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { ExternalLink, Task } from '@/types/task';
import type { GridResult } from '@/types/taskGrid';
import { parseLagInput } from '@/utils/lagFormat';
import {
  buildTaskRelationIndex,
  taskRelations,
  type TaskRelationIndex,
} from '@/engine/taskGrid/relationIndex';

export interface RelationTokenSource {
  index: number;
  start: number;
  end: number;
  text: string;
}

interface ParsedRelationTokenBase {
  source: RelationTokenSource;
  /** Onzichtbare metadata van interactief bewerken; ontbreekt bij volledige tekstvervanging/paste. */
  relationId?: string;
}

export interface ParsedInternalRelationToken extends ParsedRelationTokenBase {
  kind: 'internal';
  wbsCode: string;
  /** Onzichtbare metadata van een autocompletekeuze; vrije tekst heeft dit veld niet. */
  taskId?: string;
  relType: ExternalRelationType;
  lagText: string;
}

export interface ParsedExternalRelationToken extends ParsedRelationTokenBase {
  kind: 'external';
  external: ParsedExternalRelationClipboard;
}

export type ParsedRelationToken = ParsedInternalRelationToken | ParsedExternalRelationToken;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isExternalLag(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasDays = hasOwn(value, 'lagDays');
  const hasMinutes = hasOwn(value, 'lagMinutes');
  if (hasDays === hasMinutes) return false;
  const lag = hasMinutes ? value.lagMinutes : value.lagDays;
  return typeof lag === 'number' && Number.isSafeInteger(lag) && Math.abs(lag) <= 1_000_000_000;
}

function hasOptionalString(value: Record<string, unknown>, key: string): boolean {
  return value[key] === undefined || typeof value[key] === 'string';
}

/** Runtimegrens voor ongetypeerde grid-/paste-intents; de planner zelf blijft daarna volledig typed. */
export function isParsedRelationTokenArray(value: unknown): value is readonly ParsedRelationToken[] {
  if (!Array.isArray(value)) return false;
  return value.every(token => {
    if (!isRecord(token) || !isRecord(token.source)
      || !Number.isInteger(token.source.index) || Number(token.source.index) < 0
      || !Number.isInteger(token.source.start) || Number(token.source.start) < 0
      || !Number.isInteger(token.source.end) || Number(token.source.end) < Number(token.source.start)
      || typeof token.source.text !== 'string'
      || (token.relationId !== undefined && typeof token.relationId !== 'string')) return false;
    if (token.kind === 'internal') {
      return typeof token.wbsCode === 'string'
        && token.wbsCode.length > 0
        && (token.taskId === undefined || typeof token.taskId === 'string')
        && ['FS', 'SS', 'FF', 'SF'].includes(String(token.relType))
        && typeof token.lagText === 'string';
    }
    if (token.kind !== 'external' || !isRecord(token.external)) return false;
    const external = token.external;
    return isRecord(external.origin)
      && typeof external.origin.ownerTaskId === 'string'
      && external.origin.ownerTaskId.length > 0
      && (external.origin.direction === 'predecessor' || external.origin.direction === 'successor')
      && typeof external.origin.linkId === 'string'
      && external.origin.linkId.length > 0
      && typeof external.sourceProjectKey === 'string'
      && external.sourceProjectKey.length > 0
      && isRecord(external.sourceRef)
      && typeof external.sourceRef.projectId === 'string'
      && typeof external.sourceRef.taskId === 'string'
      && external.sourceRef.taskId.length > 0
      && hasOptionalString(external.sourceRef, 'projectName')
      && hasOptionalString(external.sourceRef, 'taskName')
      && hasOptionalString(external.sourceRef, 'filePath')
      && ['FS', 'SS', 'FF', 'SF'].includes(String(external.relType))
      && ['FS', 'SS', 'FF', 'SF'].includes(String(external.copiedRelType))
      && isExternalLag(external.lag)
      && isExternalLag(external.copiedLag)
      && typeof external.anchorDate === 'string' && external.anchorDate.length > 0
      && typeof external.sourceMissing === 'boolean';
  });
}

export interface RelationTokenError {
  code: string;
  messageKey: string;
  tokenIndex?: number;
  start?: number;
  end?: number;
  value?: unknown;
  cycle?: readonly string[];
}

export interface RelationMutationPlan {
  ownerTaskId: string;
  direction: ExternalDirection;
  sequenceRemovals: readonly string[];
  sequenceUpdates: readonly { id: string; sequence: Sequence }[];
  sequenceAdditions: readonly Omit<Sequence, 'id'>[];
  externalRemovals: readonly string[];
  externalUpdates: readonly { id: string; link: ExternalLink }[];
  externalAdditions: readonly Omit<ExternalLink, 'id'>[];
  changed: boolean;
}

export interface RelationPlanIdFactories {
  sequenceId: () => string;
  externalLinkId: () => string;
}

export interface RelationPlanState {
  tasks: Task[];
  sequences: Sequence[];
}

export interface RelationSetPlanInput {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  ownerTaskId: string;
  direction: ExternalDirection;
  tokens: readonly ParsedRelationToken[];
  /** Optioneel gedeeld readmodel voor meerdere planners binnen dezelfde adapter-/transactiecyclus. */
  relationIndex?: TaskRelationIndex;
}

interface DesiredInternal {
  token: ParsedInternalRelationToken;
  sequence: Omit<Sequence, 'id'>;
  assignedId?: string;
}

interface DesiredExternal {
  token: ParsedExternalRelationToken;
  link: Omit<ExternalLink, 'id'>;
  sourceProjectKey: string;
  assignedId?: string;
}

const TYPE_FROM_SHORT: Record<ExternalRelationType, SequenceType> = {
  FS: 'FINISH_START', SS: 'START_START', FF: 'FINISH_FINISH', SF: 'START_FINISH',
};

function tokenError(token: ParsedRelationToken, code: string, value?: unknown): RelationTokenError {
  return {
    code,
    messageKey: `taskGrid.validation.${code}`,
    tokenIndex: token.source.index,
    start: token.source.start,
    end: token.source.end,
    value: value ?? token.source.text,
  };
}

function globalError(code: string, value?: unknown, cycle?: readonly string[]): RelationTokenError {
  return { code, messageKey: `taskGrid.validation.${code}`, value, cycle };
}

function internalExactKey(sequence: Pick<Sequence, 'predecessorId' | 'successorId' | 'type'>): string {
  return `${sequence.predecessorId}\0${sequence.successorId}\0${sequence.type}`;
}

function internalEndpointKey(sequence: Pick<Sequence, 'predecessorId' | 'successorId'>): string {
  return `${sequence.predecessorId}\0${sequence.successorId}`;
}

function externalExactKey(
  ownerTaskId: string,
  direction: ExternalDirection,
  sourceProjectKey: string,
  taskId: string,
  relType: ExternalRelationType,
): string {
  return `${ownerTaskId}\0${direction}\0${sourceProjectKey}\0${taskId}\0${relType}`;
}

function externalEndpointKey(
  ownerTaskId: string,
  direction: ExternalDirection,
  sourceProjectKey: string,
  taskId: string,
): string {
  return `${ownerTaskId}\0${direction}\0${sourceProjectKey}\0${taskId}`;
}

function isRelevantSequence(sequence: Sequence, ownerTaskId: string, direction: ExternalDirection): boolean {
  return direction === 'predecessor'
    ? sequence.successorId === ownerTaskId
    : sequence.predecessorId === ownerTaskId;
}

function canonicalSequence(sequence: Sequence): string {
  return JSON.stringify({
    id: sequence.id,
    predecessorId: sequence.predecessorId,
    successorId: sequence.successorId,
    type: sequence.type,
    lagDays: sequence.lagDays,
    ...(sequence.lagMinutes !== undefined ? { lagMinutes: sequence.lagMinutes } : {}),
    ...(sequence.lagUnit !== undefined ? { lagUnit: sequence.lagUnit } : {}),
    ...(sequence.lagPercent !== undefined ? { lagPercent: sequence.lagPercent } : {}),
  });
}

function canonicalExternal(link: ExternalLink): string {
  return JSON.stringify({
    id: link.id,
    direction: link.direction,
    relType: link.relType,
    ...(link.lagMinutes !== undefined ? { lagMinutes: link.lagMinutes } : { lagDays: link.lagDays ?? 0 }),
    anchorDate: link.anchorDate,
    sourceRef: link.sourceRef,
    sourceMissing: link.sourceMissing,
  });
}

function addDuplicateErrors<T extends { token: ParsedRelationToken }>(
  values: readonly T[],
  keyOf: (value: T) => string,
  errors: RelationTokenError[],
): void {
  const byKey = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const current = byKey.get(key);
    if (current) current.push(value);
    else byKey.set(key, [value]);
  }
  for (const duplicates of byKey.values()) {
    if (duplicates.length < 2) continue;
    for (const duplicate of duplicates) errors.push(tokenError(duplicate.token, 'duplicate'));
  }
}

function assignMetadataIds<T extends { token: ParsedRelationToken; assignedId?: string }>(
  desired: T[],
  relevantIds: ReadonlySet<string>,
  allIds: ReadonlySet<string>,
  usedIds: Set<string>,
  errors: RelationTokenError[],
): void {
  const byMetadata = new Map<string, T[]>();
  for (const value of desired) {
    const id = value.token.relationId;
    if (!id) continue;
    const current = byMetadata.get(id);
    if (current) current.push(value);
    else byMetadata.set(id, [value]);
  }
  for (const [id, values] of byMetadata) {
    if (values.length > 1) {
      for (const value of values) errors.push(tokenError(value.token, 'duplicateRelationId', id));
      continue;
    }
    const value = values[0];
    if (relevantIds.has(id)) {
      value.assignedId = id;
      usedIds.add(id);
    } else if (allIds.has(id)) {
      errors.push(tokenError(value.token, 'relationIdWrongCell', id));
    }
    // Een verdwenen/stale metadata-id valt bewust terug op de semantische keys.
  }
}

function assignExactIds<T extends { assignedId?: string }>(
  desired: T[],
  oldValues: readonly { id: string }[],
  desiredKey: (value: T) => string,
  oldKey: (value: { id: string }) => string,
  usedIds: Set<string>,
): void {
  const oldByKey = new Map<string, { id: string }[]>();
  for (const old of oldValues) {
    if (usedIds.has(old.id)) continue;
    const key = oldKey(old);
    const current = oldByKey.get(key);
    if (current) current.push(old);
    else oldByKey.set(key, [old]);
  }
  for (const value of desired) {
    if (value.assignedId) continue;
    const matches = oldByKey.get(desiredKey(value)) ?? [];
    const available = matches.filter(match => !usedIds.has(match.id));
    if (available.length !== 1) continue;
    value.assignedId = available[0].id;
    usedIds.add(available[0].id);
  }
}

function assignUnambiguousTypeChanges<T extends { assignedId?: string }>(
  desired: T[],
  oldValues: readonly { id: string }[],
  desiredEndpoint: (value: T) => string,
  oldEndpoint: (value: { id: string }) => string,
  usedIds: Set<string>,
): void {
  const allOld = new Map<string, { id: string }[]>();
  const allDesired = new Map<string, T[]>();
  for (const old of oldValues) {
    const key = oldEndpoint(old);
    const current = allOld.get(key);
    if (current) current.push(old);
    else allOld.set(key, [old]);
  }
  for (const value of desired) {
    const key = desiredEndpoint(value);
    const current = allDesired.get(key);
    if (current) current.push(value);
    else allDesired.set(key, [value]);
  }
  for (const [key, desiredAtEndpoint] of allDesired) {
    const oldAtEndpoint = allOld.get(key) ?? [];
    // Meerdere typen op hetzelfde paar blijven bewust remove+add, ook als exacte matches eerst
    // één kandidaat wegstrepen; anders hangt id-behoud alsnog van arrayvolgorde af.
    if (oldAtEndpoint.length !== 1 || desiredAtEndpoint.length !== 1) continue;
    const old = oldAtEndpoint[0];
    const value = desiredAtEndpoint[0];
    if (value.assignedId || usedIds.has(old.id)) continue;
    value.assignedId = old.id;
    usedIds.add(old.id);
  }
}

function oldExternalKey(ownerTaskId: string, link: ExternalLink): string {
  return sourceProjectKeyFor(link.sourceRef, {
    ownerTaskId, direction: link.direction, linkId: link.id,
  });
}

/**
 * Valideert één uiteindelijke interne relatietoestand. Deze grens wordt zowel door de publieke
 * enkel-celplanner als éénmaal na alle relationele writes van een atomaire paste gebruikt.
 */
export function validateFinalRelationGraph(input: {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
}): GridResult<void, readonly RelationTokenError[]> {
  const errors: RelationTokenError[] = [];
  const tasksById = new Map(input.tasks.map(task => [task.id, task] as const));
  const seenExact = new Map<string, Sequence[]>();
  for (const sequence of input.sequences) {
    const structure = relationStructureVerdict(id => tasksById.get(id), sequence);
    if (!structure.ok) {
      errors.push(globalError(structure.reason === 'unknown-task' ? 'unknownTask' : structure.reason, sequence.id));
      continue;
    }
    const key = internalExactKey(sequence);
    const current = seenExact.get(key);
    if (current) current.push(sequence);
    else seenExact.set(key, [sequence]);
  }
  for (const duplicates of seenExact.values()) {
    if (duplicates.length > 1) errors.push(globalError('duplicate', duplicates.map(sequence => sequence.id)));
  }
  if (errors.length > 0) return { ok: false, errors };

  const expanded = expandSummaryRelations(input.tasks, input.sequences);
  if (expanded.droppedSequenceIds.length > 0) {
    errors.push(globalError('unrepresentableSummaryRelation', expanded.droppedSequenceIds));
  } else {
    const cycle = detectCycleInEdges(expanded.sequences);
    if (cycle) errors.push(globalError('cycle', cycle, cycle));
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: undefined };
}

function planRelationSetCore(
  input: RelationSetPlanInput,
  validateFinalGraph: boolean,
): GridResult<RelationMutationPlan, readonly RelationTokenError[]> {
  const errors: RelationTokenError[] = [];
  const owner = input.tasks.find(task => task.id === input.ownerTaskId);
  if (!owner) return { ok: false, errors: [globalError('taskNotFound', input.ownerTaskId)] };

  const tasksByWbs = new Map<string, Task[]>();
  const tasksById = new Map(input.tasks.map(task => [task.id, task] as const));
  for (const task of input.tasks) {
    const current = tasksByWbs.get(task.wbsCode);
    if (current) current.push(task);
    else tasksByWbs.set(task.wbsCode, [task]);
  }

  const desiredInternal: DesiredInternal[] = [];
  const desiredExternal: DesiredExternal[] = [];
  for (const token of input.tokens) {
    if (token.kind === 'internal') {
      const metadataTask = token.taskId ? tasksById.get(token.taskId) : undefined;
      if (token.taskId && (!metadataTask || metadataTask.wbsCode !== token.wbsCode)) {
        errors.push(tokenError(token, 'taskIdentity', token.taskId));
        continue;
      }
      const matches = metadataTask ? [metadataTask] : tasksByWbs.get(token.wbsCode) ?? [];
      if (matches.length === 0) {
        errors.push(tokenError(token, 'unknownWbs', token.wbsCode));
        continue;
      }
      if (matches.length > 1) {
        errors.push(tokenError(token, 'ambiguousWbs', token.wbsCode));
        continue;
      }
      const lag = parseLagInput(token.lagText);
      if (!lag) {
        errors.push(tokenError(token, 'invalidLag', token.lagText));
        continue;
      }
      const otherTaskId = matches[0].id;
      const predecessorId = input.direction === 'predecessor' ? otherTaskId : input.ownerTaskId;
      const successorId = input.direction === 'predecessor' ? input.ownerTaskId : otherTaskId;
      const structure = relationStructureVerdict(
        id => tasksById.get(id), { predecessorId, successorId },
      );
      if (!structure.ok) {
        errors.push(tokenError(token, structure.reason === 'unknown-task' ? 'unknownTask' : structure.reason));
        continue;
      }
      desiredInternal.push({
        token,
        sequence: {
          predecessorId,
          successorId,
          type: TYPE_FROM_SHORT[token.relType],
          lagDays: lag.lagDays,
          ...(lag.lagMinutes !== undefined ? { lagMinutes: lag.lagMinutes } : {}),
          ...(lag.lagUnit !== undefined ? { lagUnit: lag.lagUnit } : {}),
          ...(lag.lagPercent !== undefined ? { lagPercent: lag.lagPercent } : {}),
        },
      });
      continue;
    }

    const external = token.external;
    const expectedKey = sourceProjectKeyFor(external.sourceRef, external.origin);
    if (external.sourceProjectKey !== expectedKey) {
      errors.push(tokenError(token, 'sourceProjectKeyMismatch'));
      continue;
    }
    if (external.sourceProjectKey.startsWith('id-only:')
      && (external.origin.ownerTaskId !== input.ownerTaskId || external.origin.direction !== input.direction)) {
      errors.push(tokenError(token, 'idOnlyExternalRelation'));
      continue;
    }
    if (!externalAnchorSideIsCompatible(
      external.origin.direction, external.copiedRelType, input.direction, external.relType,
    )) {
      errors.push(tokenError(token, 'externalAnchorSideChanged'));
      continue;
    }
    desiredExternal.push({
      token,
      sourceProjectKey: external.sourceProjectKey,
      link: {
        direction: input.direction,
        relType: external.relType,
        ...(external.lag.lagMinutes !== undefined
          ? { lagMinutes: external.lag.lagMinutes }
          : { lagDays: external.lag.lagDays }),
        anchorDate: external.anchorDate,
        sourceRef: external.sourceRef,
        sourceMissing: external.sourceMissing,
      },
    });
  }
  if (errors.length > 0) return { ok: false, errors };

  addDuplicateErrors(desiredInternal, value => internalExactKey(value.sequence), errors);
  addDuplicateErrors(desiredExternal, value => externalExactKey(
    input.ownerTaskId, input.direction, value.sourceProjectKey, value.link.sourceRef.taskId, value.link.relType,
  ), errors);
  if (errors.length > 0) return { ok: false, errors };

  const relationIndex = input.relationIndex ?? buildTaskRelationIndex(input.tasks, input.sequences);
  const oldInternal: Sequence[] = [];
  const oldExternal: ExternalLink[] = [];
  for (const entry of taskRelations(relationIndex, input.ownerTaskId, input.direction)) {
    if (entry.kind === 'internal') oldInternal.push(entry.sequence);
    else oldExternal.push(entry.link);
  }
  const usedInternalIds = new Set<string>();
  const usedExternalIds = new Set<string>();
  assignMetadataIds(
    desiredInternal,
    new Set(oldInternal.map(sequence => sequence.id)),
    new Set(input.sequences.map(sequence => sequence.id)),
    usedInternalIds,
    errors,
  );
  assignMetadataIds(
    desiredExternal,
    new Set(oldExternal.map(link => link.id)),
    new Set(input.tasks.flatMap(task => (task.externalLinks ?? []).map(link => link.id))),
    usedExternalIds,
    errors,
  );
  if (errors.length > 0) return { ok: false, errors };

  // Een lossless same-cell payload draagt zijn oorsprongs-id. Die wint alleen wanneer de bron-
  // tuple nog bij dat bestaande record hoort; cross-task plakken erft bewust nooit een id.
  for (const desired of desiredExternal) {
    if (desired.assignedId || desired.token.relationId) continue;
    const origin = desired.token.external.origin;
    if (origin.ownerTaskId !== input.ownerTaskId || origin.direction !== input.direction) continue;
    const old = oldExternal.find(link => link.id === origin.linkId);
    if (!old || usedExternalIds.has(old.id)) continue;
    if (oldExternalKey(input.ownerTaskId, old) !== desired.sourceProjectKey
      || old.sourceRef.taskId !== desired.link.sourceRef.taskId) continue;
    desired.assignedId = old.id;
    usedExternalIds.add(old.id);
  }

  assignExactIds(
    desiredInternal,
    oldInternal,
    value => internalExactKey(value.sequence),
    value => internalExactKey(value as Sequence),
    usedInternalIds,
  );
  assignExactIds(
    desiredExternal,
    oldExternal,
    value => externalExactKey(
      input.ownerTaskId, input.direction, value.sourceProjectKey, value.link.sourceRef.taskId, value.link.relType,
    ),
    value => {
      const link = value as ExternalLink;
      return externalExactKey(
        input.ownerTaskId, input.direction, oldExternalKey(input.ownerTaskId, link), link.sourceRef.taskId, link.relType,
      );
    },
    usedExternalIds,
  );
  assignUnambiguousTypeChanges(
    desiredInternal,
    oldInternal,
    value => internalEndpointKey(value.sequence),
    value => internalEndpointKey(value as Sequence),
    usedInternalIds,
  );
  assignUnambiguousTypeChanges(
    desiredExternal,
    oldExternal,
    value => externalEndpointKey(
      input.ownerTaskId, input.direction, value.sourceProjectKey, value.link.sourceRef.taskId,
    ),
    value => {
      const link = value as ExternalLink;
      return externalEndpointKey(
        input.ownerTaskId, input.direction, oldExternalKey(input.ownerTaskId, link), link.sourceRef.taskId,
      );
    },
    usedExternalIds,
  );

  const finalDesiredSequences = desiredInternal.map((desired, index): Sequence => ({
    ...desired.sequence,
    id: desired.assignedId ?? `__grid-planned-sequence-${index}`,
  }));
  const finalSequences: Sequence[] = [];
  for (const sequence of input.sequences) {
    if (!isRelevantSequence(sequence, input.ownerTaskId, input.direction)) finalSequences.push(sequence);
  }
  finalSequences.push(...finalDesiredSequences);

  if (validateFinalGraph) {
    const validated = validateFinalRelationGraph({ tasks: input.tasks, sequences: finalSequences });
    if (!validated.ok) return validated;
  }

  const oldInternalById = new Map(oldInternal.map(sequence => [sequence.id, sequence]));
  const oldExternalById = new Map(oldExternal.map(link => [link.id, link]));
  const sequenceUpdates: { id: string; sequence: Sequence }[] = [];
  const sequenceAdditions: Omit<Sequence, 'id'>[] = [];
  for (const desired of desiredInternal) {
    if (!desired.assignedId) {
      sequenceAdditions.push(desired.sequence);
      continue;
    }
    const next: Sequence = { ...desired.sequence, id: desired.assignedId };
    const old = oldInternalById.get(desired.assignedId);
    if (!old || canonicalSequence(old) !== canonicalSequence(next)) {
      sequenceUpdates.push({ id: desired.assignedId, sequence: next });
    }
  }
  const externalUpdates: { id: string; link: ExternalLink }[] = [];
  const externalAdditions: Omit<ExternalLink, 'id'>[] = [];
  for (const desired of desiredExternal) {
    if (!desired.assignedId) {
      externalAdditions.push(desired.link);
      continue;
    }
    const next: ExternalLink = { ...desired.link, id: desired.assignedId };
    const old = oldExternalById.get(desired.assignedId);
    if (!old || canonicalExternal(old) !== canonicalExternal(next)) {
      externalUpdates.push({ id: desired.assignedId, link: next });
    }
  }
  const sequenceRemovals: string[] = [];
  for (const sequence of oldInternal) {
    if (!usedInternalIds.has(sequence.id)) sequenceRemovals.push(sequence.id);
  }
  const externalRemovals: string[] = [];
  for (const link of oldExternal) {
    if (!usedExternalIds.has(link.id)) externalRemovals.push(link.id);
  }
  return {
    ok: true,
    value: {
      ownerTaskId: input.ownerTaskId,
      direction: input.direction,
      sequenceRemovals,
      sequenceUpdates,
      sequenceAdditions,
      externalRemovals,
      externalUpdates,
      externalAdditions,
      changed: sequenceRemovals.length > 0 || sequenceUpdates.length > 0 || sequenceAdditions.length > 0
        || externalRemovals.length > 0 || externalUpdates.length > 0 || externalAdditions.length > 0,
    },
  };
}

/** Plant één volledige relatiecel en valideert meteen de uiteindelijke projectgraaf. */
export function planRelationSet(
  input: RelationSetPlanInput,
): GridResult<RelationMutationPlan, readonly RelationTokenError[]> {
  return planRelationSetCore(input, true);
}

/**
 * Alleen voor de geïsoleerde gridtransactie: laat een tijdelijke tussenstand toe. De transactie
 * moet na alle writes `validateFinalRelationGraph` uitvoeren en elke intent opnieuw verifiëren.
 */
export function planRelationSetInBatch(
  input: RelationSetPlanInput,
): GridResult<RelationMutationPlan, readonly RelationTokenError[]> {
  return planRelationSetCore(input, false);
}

function nextUniqueId(factory: () => string, used: Set<string>, kind: string): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const id = factory();
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
  throw new Error(`Kon geen unieke ${kind}-id genereren`);
}

/** Past een reeds volledig gevalideerd plan toe op een geïsoleerde mutable/Immer-state. */
export function applyRelationMutationPlan(
  state: RelationPlanState,
  plan: RelationMutationPlan,
  ids: RelationPlanIdFactories,
): void {
  if (!plan.changed) return;
  const removedSequences = new Set(plan.sequenceRemovals);
  const sequenceUpdates = new Map(plan.sequenceUpdates.map(update => [update.id, update.sequence]));
  state.sequences = state.sequences.flatMap(sequence => {
    if (removedSequences.has(sequence.id)) return [];
    return [sequenceUpdates.get(sequence.id) ?? sequence];
  });
  const usedSequenceIds = new Set(state.sequences.map(sequence => sequence.id));
  for (const addition of plan.sequenceAdditions) {
    state.sequences.push({ ...addition, id: nextUniqueId(ids.sequenceId, usedSequenceIds, 'relatie') });
  }

  const owner = state.tasks.find(task => task.id === plan.ownerTaskId);
  if (!owner) throw new Error(`Relatieplan-eigenaar '${plan.ownerTaskId}' bestaat niet meer`);
  const removedExternal = new Set(plan.externalRemovals);
  const externalUpdates = new Map(plan.externalUpdates.map(update => [update.id, update.link]));
  const untouched = (owner.externalLinks ?? []).flatMap(link => {
    if (removedExternal.has(link.id)) return [];
    return [externalUpdates.get(link.id) ?? link];
  });
  const usedExternalIds = new Set(inputExternalIds(state.tasks));
  for (const addition of plan.externalAdditions) {
    untouched.push({ ...addition, id: nextUniqueId(ids.externalLinkId, usedExternalIds, 'externe relatie') });
  }
  owner.externalLinks = untouched.length > 0 ? untouched : undefined;
}

function inputExternalIds(tasks: readonly Task[]): string[] {
  return tasks.flatMap(task => (task.externalLinks ?? []).map(link => link.id));
}
