import { useCallback, useEffect, useRef, useState } from 'react';
import type { GridCellAddress } from '@/engine/taskGrid/selection';
import type { TaskGridAdapter, TaskGridAdapterEventTarget } from '@/engine/taskGrid/taskGridAdapter';
import type { ResourceCurve } from '@/types/resource';
import { CURVE_KEY } from '@/components/task-sections/shared';
import type { CellValidationError, TaskAssignmentToken } from '@/types/taskGrid';
import type { TaskRelationEntry } from '@/engine/taskGrid/relationIndex';
import { buildRelationCellItems } from '@/engine/taskGrid/relationCell';
import {
  formatGridDate,
  formatGridDateTime,
  parseGridDate,
  parseGridDateTime,
} from '@/engine/taskGrid/editors';
import type { ParsedRelationToken } from '@/engine/taskGrid/relationPlan';
import {
  GridEditorHost,
  type GridEditorCommitResult,
} from './GridEditorHost';
import { RelationCellEditor } from './RelationCellEditor';

export interface CommitTaskCellEditorValueInput {
  adapter: TaskGridAdapter;
  cell: GridCellAddress;
  text: string;
  directValue?: unknown;
  messageForError: (messageKey: string, error: CellValidationError) => string;
}

function errorId(cell: GridCellAddress): string {
  return `task-grid-error-${encodeURIComponent(cell.rowKey)}-${encodeURIComponent(cell.columnId)}`;
}

function editorError(
  cell: GridCellAddress,
  error: CellValidationError,
  messageForError: CommitTaskCellEditorValueInput['messageForError'],
): GridEditorCommitResult {
  return {
    ok: false,
    error: {
      id: errorId(cell),
      message: messageForError(error.messageKey, error),
    },
  };
}

function localError(
  cell: GridCellAddress,
  code: string,
  messageForError: CommitTaskCellEditorValueInput['messageForError'],
): GridEditorCommitResult {
  const error: CellValidationError = {
    code,
    messageKey: `taskGrid.validation.${code}`,
    rowKey: cell.rowKey,
    columnId: cell.columnId,
  };
  return editorError(cell, error, messageForError);
}

/** Voert de synchrone prepare → plan → commitgrens uit zonder een store- of slicenaam te kennen. */
export function commitTaskCellEditorValue(input: CommitTaskCellEditorValueInput): GridEditorCommitResult {
  const { adapter, cell, text, messageForError } = input;
  const meta = adapter.rowMetaByKey.get(cell.rowKey);
  const target: TaskGridAdapterEventTarget = {
    surfaceId: adapter.surfaceId,
    rowKey: cell.rowKey,
    taskId: meta?.kind === 'task' ? meta.taskId : undefined,
    columnId: cell.columnId,
  };
  if (adapter.callbacks.onPrepareEdit?.(target) === false) {
    return localError(cell, 'prepareRejected', messageForError);
  }
  const planned = Object.prototype.hasOwnProperty.call(input, 'directValue')
    ? adapter.planValue(cell.rowKey, cell.columnId, input.directValue)
    : adapter.planEdit(cell.rowKey, cell.columnId, text);
  if (!planned.ok) {
    const error = planned.errors[0];
    return error
      ? editorError(cell, error, messageForError)
      : localError(cell, 'invalid', messageForError);
  }
  const commit = adapter.callbacks.onCommitEdit;
  if (!commit) return localError(cell, 'commitUnavailable', messageForError);
  const committed = commit(target, planned.value);
  if (!committed.ok) {
    const error = committed.errors[0];
    return error
      ? editorError(cell, error, messageForError)
      : localError(cell, 'commitFailed', messageForError);
  }
  return { ok: true };
}

export interface TaskCellEditorProps {
  adapter: TaskGridAdapter;
  cell: GridCellAddress;
  label: string;
  calendarPickerLabel?: string;
  messageForError: CommitTaskCellEditorValueInput['messageForError'];
  labelForOption?: (labelKey: string, value: string) => string;
  onCancel: () => void;
  onFocusCell: (cell: GridCellAddress) => void;
  nextCell?: GridCellAddress;
  previousCell?: GridCellAddress;
  initialText?: string;
  onCommitReady?: (commit: (() => GridEditorCommitResult) | null) => void;
  onOpenExternal?: (taskId: string, relationId?: string) => void;
}

/**
 * Dunne React-schil. Task 12 vervangt het tekstveld per descriptor-editorKind; validatie,
 * schrijfplanning en commit blijven via dezelfde adaptergrens lopen.
 */
export function TaskCellEditor({
  adapter,
  cell,
  label,
  calendarPickerLabel = label,
  messageForError,
  labelForOption = (_labelKey, value) => value,
  onCancel,
  onFocusCell,
  nextCell,
  previousCell,
  initialText,
  onCommitReady,
  onOpenExternal,
}: TaskCellEditorProps) {
  const initialCell = adapter.getCell(cell.rowKey, cell.columnId);
  const [text, setText] = useState(
    () => initialText ?? initialCell?.editText ?? '',
  );
  const [assignmentTokens, setAssignmentTokens] = useState<TaskAssignmentToken[]>(() => (
    Array.isArray(initialCell?.value)
      ? (initialCell.value as TaskAssignmentToken[]).map(token => ({ ...token }))
      : []
  ));
  const [resourceQuery, setResourceQuery] = useState('');
  const descriptor = adapter.descriptorsById.get(cell.columnId);
  const dateNotation = adapter.dateNotation ?? 'dmy';
  const dateEditorKind = descriptor?.editorKind === 'date' || descriptor?.editorKind === 'datetime'
    ? descriptor.editorKind
    : null;
  const pickerValue = dateEditorKind === 'date'
    ? parseGridDate(text, dateNotation) ?? ''
    : dateEditorKind === 'datetime'
      ? (() => {
          const parsed = parseGridDateTime(text, dateNotation);
          return parsed?.length === 10 ? `${parsed}T00:00` : parsed ?? '';
        })()
      : '';
  const relationDirection = String(cell.columnId) === 'relation.predecessors'
    ? 'predecessor'
    : String(cell.columnId) === 'relation.successors' ? 'successor' : null;
  const rowMeta = adapter.rowMetaByKey.get(cell.rowKey);
  const ownerTaskId = rowMeta?.kind === 'task' ? rowMeta.taskId : null;
  const isRelationEditor = descriptor?.editorKind === 'relations'
    && relationDirection !== null
    && ownerTaskId !== null;
  const [relationTokens, setRelationTokens] = useState<readonly ParsedRelationToken[]>(() => {
    if (!isRelationEditor || initialText !== undefined || !ownerTaskId || !relationDirection) return [];
    const entries = Array.isArray(initialCell?.value)
      ? initialCell.value as TaskRelationEntry[]
      : [];
    return buildRelationCellItems({
      ownerTaskId,
      direction: relationDirection,
      entries,
      context: adapter.context,
    }).map(item => item.parsedToken);
  });
  const [relationValid, setRelationValid] = useState(true);
  const isAssignmentEditor = descriptor?.valueKind === 'tokens'
    && String(descriptor.id).startsWith('assignment.');
  const assignmentColumnId = isAssignmentEditor ? String(descriptor?.id) : null;
  const editsAssignmentMembership = assignmentColumnId === 'assignment.resources';
  const editsAssignmentUnits = assignmentColumnId === 'assignment.unitsPerDay';
  const editsAssignmentCurve = assignmentColumnId === 'assignment.curve';
  const resourceOptions = descriptor?.editorOptions ?? [];
  const resourceOptionById = new Map(resourceOptions.map(option => [option.value, option] as const));
  const curves: readonly ResourceCurve[] = [
    'UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK',
  ];
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => {
    const node = inputRef.current;
    node?.focus();
    if (node instanceof HTMLInputElement) {
      if (initialText === undefined) node.select();
      else node.setSelectionRange(node.value.length, node.value.length);
    }
  }, [cell.rowKey, cell.columnId, initialText]);

  const commit = useCallback((shiftKey = false): GridEditorCommitResult => {
    if (isRelationEditor && initialText === undefined && !relationValid) {
      return localError(cell, 'invalidLag', messageForError);
    }
    const result = commitTaskCellEditorValue({
      adapter, cell, text, messageForError,
      ...(isAssignmentEditor
        ? { directValue: assignmentTokens }
        : isRelationEditor && initialText === undefined
          ? { directValue: relationTokens }
          : {}),
    });
    const destination = shiftKey ? previousCell : nextCell;
    return result.ok && destination ? { ...result, nextCell: destination } : result;
  }, [
    adapter, assignmentTokens, cell, initialText, isAssignmentEditor, isRelationEditor,
    messageForError, nextCell, previousCell, relationTokens, relationValid, text,
  ]);

  useEffect(() => {
    if (!onCommitReady) return;
    onCommitReady(() => commit(false));
    return () => onCommitReady(null);
  }, [commit, onCommitReady]);

  return (
    <GridEditorHost
      cell={cell}
      onCancel={onCancel}
      onFocusCell={onFocusCell}
      onCommit={commit}
    >
      {inputProps => (
        isRelationEditor && ownerTaskId ? (
          <RelationCellEditor
            inputProps={inputProps}
            inputRef={node => { inputRef.current = node; }}
            label={label}
            ownerTaskId={ownerTaskId}
            tasks={[...adapter.context.tasksById.values()]}
            tokens={relationTokens}
            {...(initialText !== undefined ? { rawText: text } : {})}
            onRawTextChange={setText}
            onTokensChange={setRelationTokens}
            onValidityChange={setRelationValid}
            onOpenExternal={relationId => onOpenExternal?.(ownerTaskId, relationId)}
          />
        ) : isAssignmentEditor ? (
          <div
            onKeyDown={inputProps.onKeyDown}
            className="task-grid-assignment-editor"
            data-task-editor-kind="assignment-tokens"
          >
            <div className="task-grid-assignment-tokens" role="list">
              {assignmentTokens.map((token, index) => {
                const option = resourceOptionById.get(token.resourceId);
                const resourceLabel = option?.label
                  ?? labelForOption(option?.labelKey ?? token.resourceId, token.resourceId);
                return (
                  <div
                    key={token.assignmentId ?? token.resourceId}
                    className="task-grid-assignment-token"
                    role="listitem"
                    data-assignment-resource-id={token.resourceId}
                  >
                    <span className="task-grid-assignment-resource">{resourceLabel}</span>
                    {editsAssignmentUnits && <input
                      ref={index === 0 ? node => { inputRef.current = node; } : undefined}
                      aria-invalid={inputProps['aria-invalid']}
                      aria-describedby={inputProps['aria-describedby']}
                      type="number"
                      min="0"
                      step="any"
                      value={Number.isFinite(token.unitsPerDay) ? token.unitsPerDay : ''}
                      aria-label={`${resourceLabel} — ${labelForOption('properties.assignments.unitsPerDay', 'units')}`}
                      onChange={event => {
                        const unitsPerDay = event.currentTarget.valueAsNumber;
                        setAssignmentTokens(current => current.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, unitsPerDay } : item
                        )));
                      }}
                    />}
                    {editsAssignmentCurve && <select
                      ref={index === 0 ? node => { inputRef.current = node; } : undefined}
                      aria-invalid={inputProps['aria-invalid']}
                      aria-describedby={inputProps['aria-describedby']}
                      value={token.curve ?? 'UNIFORM'}
                      aria-label={`${resourceLabel} — ${labelForOption('properties.assignments.curve', 'curve')}`}
                      onChange={event => {
                        const curve = event.currentTarget.value as ResourceCurve;
                        setAssignmentTokens(current => current.map((item, itemIndex) => (
                          itemIndex === index
                            ? { ...item, curve: curve === 'UNIFORM' ? undefined : curve }
                            : item
                        )));
                      }}
                    >
                      {curves.map(curve => (
                        <option key={curve} value={curve}>
                          {labelForOption(CURVE_KEY[curve], curve)}
                        </option>
                      ))}
                    </select>}
                    {editsAssignmentMembership && <button
                      type="button"
                      aria-label={`${labelForOption('properties.assignments.remove', 'remove')} ${resourceLabel}`}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                      }}
                      onClick={() => setAssignmentTokens(current => (
                        current.filter((_, itemIndex) => itemIndex !== index)
                      ))}
                    >
                      ×
                    </button>}
                  </div>
                );
              })}
            </div>
            {editsAssignmentMembership && <input
              ref={node => { inputRef.current = node; }}
              aria-invalid={inputProps['aria-invalid']}
              aria-describedby={inputProps['aria-describedby']}
              type="text"
              role="combobox"
              aria-label={label}
              aria-autocomplete="list"
              aria-expanded={resourceQuery.trim().length > 0}
              value={resourceQuery}
              onChange={event => setResourceQuery(event.currentTarget.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter' || resourceQuery.trim() === '') return;
                const query = resourceQuery.trim().toLocaleLowerCase();
                const candidates = resourceOptions.filter(option => (
                  !assignmentTokens.some(token => token.resourceId === option.value)
                  && (option.value.toLocaleLowerCase().includes(query)
                    || option.label?.toLocaleLowerCase().includes(query))
                ));
                if (candidates.length !== 1) return;
                event.preventDefault();
                event.stopPropagation();
                setAssignmentTokens(current => [...current, {
                  resourceId: candidates[0].value, unitsPerDay: 1,
                }]);
                setResourceQuery('');
              }}
            />}
            {editsAssignmentMembership && resourceQuery.trim() && (
              <div className="task-grid-assignment-options" role="listbox">
                {resourceOptions.filter(option => {
                  const query = resourceQuery.trim().toLocaleLowerCase();
                  return !assignmentTokens.some(token => token.resourceId === option.value)
                    && (option.value.toLocaleLowerCase().includes(query)
                      || option.label?.toLocaleLowerCase().includes(query));
                }).map(option => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={option.value}
                    onMouseDown={event => event.preventDefault()}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                    }}
                    onClick={() => {
                      setAssignmentTokens(current => [...current, {
                        resourceId: option.value, unitsPerDay: 1,
                      }]);
                      setResourceQuery('');
                    }}
                  >
                    {option.label ?? labelForOption(option.labelKey ?? option.value, option.value)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : descriptor?.editorKind === 'enum' && descriptor.editorOptions ? (
          <select
            {...inputProps}
            ref={node => { inputRef.current = node; }}
            aria-label={label}
            value={text}
            onChange={event => setText(event.currentTarget.value)}
            className="task-grid-editor-input"
            data-task-editor-kind="enum"
          >
            {descriptor.editorOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label ?? labelForOption(option.labelKey ?? option.value, option.value)}
              </option>
            ))}
          </select>
        ) : descriptor?.editorKind === 'boolean' ? (
          <select
            {...inputProps}
            ref={node => { inputRef.current = node; }}
            aria-label={label}
            value={text}
            onChange={event => setText(event.currentTarget.value)}
            className="task-grid-editor-input"
            data-task-editor-kind="boolean"
          >
            <option value="">—</option>
            <option value="true">{adapter.booleanLabels?.true ?? 'true'}</option>
            <option value="false">{adapter.booleanLabels?.false ?? 'false'}</option>
          </select>
        ) : dateEditorKind ? (
          <div className="task-grid-date-editor">
            <input
              {...inputProps}
              ref={node => { inputRef.current = node; }}
              type="text"
              aria-label={label}
              value={text}
              onChange={event => setText(event.currentTarget.value)}
              className="task-grid-editor-input"
              data-task-editor-kind={dateEditorKind}
            />
            <input
              {...inputProps}
              type={dateEditorKind === 'date' ? 'date' : 'datetime-local'}
              step={dateEditorKind === 'datetime' ? 60 : undefined}
              aria-label={calendarPickerLabel}
              value={pickerValue}
              onChange={event => {
                const value = event.currentTarget.value;
                setText(value === ''
                  ? ''
                  : dateEditorKind === 'date'
                    ? formatGridDate(value, dateNotation)
                    : formatGridDateTime(value, dateNotation));
              }}
              className="task-grid-date-picker"
              data-task-editor-picker={dateEditorKind}
            />
          </div>
        ) : (
          <>
          <input
            {...inputProps}
            ref={node => { inputRef.current = node; }}
            type={descriptor?.editorKind === 'color' ? 'color' : 'text'}
            inputMode={descriptor?.editorKind === 'number' || descriptor?.editorKind === 'percentage'
              ? 'decimal'
              : undefined}
            aria-label={label}
            list={descriptor?.editorKind === 'autocomplete' && descriptor.editorOptions
              ? `${errorId(cell)}-options`
              : undefined}
            value={descriptor?.editorKind === 'color' && !/^#[\da-f]{6}$/i.test(text) ? '#000000' : text}
            onChange={event => setText(event.currentTarget.value)}
            className="task-grid-editor-input"
            data-task-editor-kind={descriptor?.editorKind ?? 'text'}
          />
          {descriptor?.editorKind === 'autocomplete' && descriptor.editorOptions && (
            <datalist id={`${errorId(cell)}-options`}>
              {descriptor.editorOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label ?? labelForOption(option.labelKey ?? option.value, option.value)}
                </option>
              ))}
            </datalist>
          )}
          </>
        )
      )}
    </GridEditorHost>
  );
}
