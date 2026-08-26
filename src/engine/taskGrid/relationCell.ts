import {
  formatExternalRelationClipboard,
  formatExternalRelationVisible,
  parseExternalRelationClipboard,
  type ExternalDirection,
} from '@/engine/taskGrid/relationFormat';
import type { TaskRelationEntry } from '@/engine/taskGrid/relationIndex';
import type {
  ParsedInternalRelationToken,
  ParsedRelationToken,
  RelationTokenSource,
} from '@/engine/taskGrid/relationPlan';
import type { CellValidationError, GridResult, TaskColumnContext } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import { formatLagShort } from '@/utils/lagFormat';

const INTERNAL_TYPES = ['FS', 'SS', 'FF', 'SF'] as const;

function failure(
  code: string,
  value: unknown,
  source?: RelationTokenSource,
): GridResult<never, readonly CellValidationError[]> {
  return {
    ok: false,
    errors: [{
      code,
      messageKey: `taskGrid.validation.${code}`,
      tokenIndex: source?.index,
      start: source?.start,
      end: source?.end,
      value,
    }],
  };
}

function shortType(entry: Extract<TaskRelationEntry, { kind: 'internal' }>): typeof INTERNAL_TYPES[number] {
  const type = entry.sequence.type;
  return type === 'FINISH_START' ? 'FS'
    : type === 'START_START' ? 'SS'
      : type === 'FINISH_FINISH' ? 'FF' : 'SF';
}

function sourceFor(index: number, start: number, end: number, text: string): RelationTokenSource {
  return { index, start, end, text };
}

/**
 * Knipt op nieuwe regels/semicolons. Een komma blijft data zodra een externe lossless payload in
 * de cel staat (project- en taaknamen mogen komma's bevatten); legacy komma-invoer blijft geldig
 * voor volledig interne cellen.
 */
function tokenSlices(text: string): { start: number; end: number; text: string }[] {
  const separator = text.includes('⟦OPS-EXT/1:') ? /[;\n]/g : /[,;\n]/g;
  const result: { start: number; end: number; text: string }[] = [];
  let rawStart = 0;
  const push = (rawEnd: number) => {
    const raw = text.slice(rawStart, rawEnd);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) {
      const start = rawStart + leading;
      result.push({ start, end: start + trimmed.length, text: trimmed });
    }
  };
  for (const match of text.matchAll(separator)) {
    push(match.index);
    rawStart = match.index + match[0].length;
  }
  push(text.length);
  return result;
}

export function parseRelationCellText(input: {
  text: string;
  ownerTaskId: string;
  direction: ExternalDirection;
}): GridResult<readonly ParsedRelationToken[], readonly CellValidationError[]> {
  const tokens: ParsedRelationToken[] = [];
  const slices = tokenSlices(input.text);
  for (let index = 0; index < slices.length; index++) {
    const slice = slices[index];
    const source = sourceFor(index, slice.start, slice.end, slice.text);
    if (slice.text.includes('⟦OPS-EXT/1:')) {
      const external = parseExternalRelationClipboard(slice.text, {
        ownerTaskId: input.ownerTaskId,
        direction: input.direction,
      });
      if (!external.ok) return failure(external.code, slice.text, source);
      tokens.push({ kind: 'external', external: external.value, source });
      continue;
    }

    const match = /^(\S+)\s+(FS|SS|FF|SF)(.*)$/i.exec(slice.text);
    if (!match) {
      return failure(
        slice.text.includes('/') ? 'externalRelationRequiresDialog' : 'relationToken',
        slice.text,
        source,
      );
    }
    const relType = match[2].toUpperCase() as ParsedInternalRelationToken['relType'];
    tokens.push({
      kind: 'internal',
      wbsCode: match[1],
      relType,
      lagText: match[3].trim(),
      source,
    });
  }
  return { ok: true, value: tokens };
}

export interface RelationCellItem {
  key: string;
  kind: TaskRelationEntry['kind'];
  relationId: string;
  label: string;
  clipboardText: string;
  otherTaskId: string;
  otherTask?: Task;
  driving: boolean;
  freeFloat?: number;
  stale: boolean;
  warnings: readonly string[];
  parsedToken: ParsedRelationToken;
}

export function buildRelationCellItems(input: {
  ownerTaskId: string;
  direction: ExternalDirection;
  entries: readonly TaskRelationEntry[];
  context: TaskColumnContext;
}): readonly RelationCellItem[] {
  return input.entries.map((entry, index): RelationCellItem => {
    if (entry.kind === 'external') {
      const clipboardText = formatExternalRelationClipboard(input.ownerTaskId, entry.link);
      const parsed = parseExternalRelationClipboard(clipboardText, {
        ownerTaskId: input.ownerTaskId,
        direction: input.direction,
      });
      if (!parsed.ok) throw new Error(`Bestaande externe relatie kan niet worden geprojecteerd: ${parsed.code}`);
      const source = sourceFor(index, 0, clipboardText.length, clipboardText);
      return {
        key: `external:${entry.link.id}`,
        kind: 'external',
        relationId: entry.link.id,
        label: formatExternalRelationVisible(entry.link),
        clipboardText,
        otherTaskId: entry.otherTaskId,
        driving: false,
        stale: input.context.scheduleStale,
        warnings: input.context.relationIndex.warningsByExternalLinkId.get(entry.link.id) ?? [],
        parsedToken: { kind: 'external', external: parsed.value, relationId: entry.link.id, source },
      };
    }

    const otherTask = input.context.tasksById.get(entry.otherTaskId);
    const relType = shortType(entry);
    const lagText = formatLagShort(entry.sequence);
    const label = `${otherTask?.wbsCode ?? entry.otherTaskId} ${relType}${lagText}`;
    const analysis = input.context.relationIndex.analysisBySequenceId.get(entry.sequence.id);
    return {
      key: `internal:${entry.sequence.id}`,
      kind: 'internal',
      relationId: entry.sequence.id,
      label,
      clipboardText: label,
      otherTaskId: entry.otherTaskId,
      otherTask,
      driving: analysis?.driving ?? false,
      ...(analysis?.freeFloat !== undefined ? { freeFloat: analysis.freeFloat } : {}),
      stale: input.context.scheduleStale,
      warnings: analysis?.warnings ?? [],
      parsedToken: {
        kind: 'internal',
        wbsCode: otherTask?.wbsCode ?? entry.otherTaskId,
        taskId: otherTask?.id,
        relType,
        lagText,
        relationId: entry.sequence.id,
        source: sourceFor(index, 0, label.length, label),
      },
    };
  });
}

export function relationCellText(items: readonly RelationCellItem[]): string {
  return items.map(item => item.label).join('; ');
}

export function relationCellClipboardText(items: readonly RelationCellItem[]): string {
  return items.map(item => item.clipboardText).join('; ');
}

export function formatParsedRelationToken(token: ParsedRelationToken): string {
  if (token.kind === 'internal') return `${token.wbsCode} ${token.relType}${token.lagText}`;
  return formatExternalRelationVisible({
    id: token.external.origin.linkId,
    direction: token.external.origin.direction,
    relType: token.external.relType,
    ...token.external.lag,
    anchorDate: token.external.anchorDate,
    sourceRef: token.external.sourceRef,
    sourceMissing: token.external.sourceMissing,
  });
}

/** Herbouwt alleen foutposities; taak- en relatie-idmetadata blijft bij chipbewerkingen intact. */
export function normalizeRelationTokenSources(
  tokens: readonly ParsedRelationToken[],
): readonly ParsedRelationToken[] {
  let offset = 0;
  return tokens.map((token, index) => {
    const text = formatParsedRelationToken(token);
    const source = sourceFor(index, offset, offset + text.length, text);
    offset += text.length + 2; // canonieke scheiding: "; "
    return { ...token, source };
  });
}

export interface RelationTaskOption {
  taskId: string;
  wbsCode: string;
  name: string;
  label: string;
}

export function relationTaskOptions(
  tasks: Iterable<Task>,
  ownerTaskId: string,
  query: string,
): RelationTaskOption[] {
  const needle = query.trim().toLocaleLowerCase();
  const result: RelationTaskOption[] = [];
  for (const task of tasks) {
    if (task.id === ownerTaskId) continue;
    const label = `${task.wbsCode} ${task.name}`.trim();
    if (needle && !label.toLocaleLowerCase().includes(needle)) continue;
    result.push({ taskId: task.id, wbsCode: task.wbsCode, name: task.name, label });
  }
  return result;
}
