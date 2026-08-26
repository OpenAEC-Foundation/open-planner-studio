import { useEffect, useRef, useState } from 'react';
import type { GridCellAddress } from '@/engine/taskGrid/selection';
import type { TaskGridAdapter, TaskGridAdapterEventTarget } from '@/engine/taskGrid/taskGridAdapter';
import type { ResourceCurve } from '@/types/resource';
import type { CellValidationError, TaskAssignmentToken } from '@/types/taskGrid';
import {
  GridEditorHost,
  type GridEditorCommitResult,
} from './GridEditorHost';

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
  messageForError: CommitTaskCellEditorValueInput['messageForError'];
  labelForOption?: (labelKey: string, value: string) => string;
  onCancel: () => void;
  onFocusCell: (cell: GridCellAddress) => void;
  nextCell?: GridCellAddress;
}

/**
 * Dunne React-schil. Task 12 vervangt het tekstveld per descriptor-editorKind; validatie,
 * schrijfplanning en commit blijven via dezelfde adaptergrens lopen.
 */
export function TaskCellEditor({
  adapter,
  cell,
  label,
  messageForError,
  labelForOption = (_labelKey, value) => value,
  onCancel,
  onFocusCell,
  nextCell,
}: TaskCellEditorProps) {
  const initialCell = adapter.getCell(cell.rowKey, cell.columnId);
  const [text, setText] = useState(
    () => initialCell?.editText ?? '',
  );
  const [assignmentTokens, setAssignmentTokens] = useState<TaskAssignmentToken[]>(() => (
    Array.isArray(initialCell?.value)
      ? (initialCell.value as TaskAssignmentToken[]).map(token => ({ ...token }))
      : []
  ));
  const [resourceQuery, setResourceQuery] = useState('');
  const descriptor = adapter.descriptorsById.get(cell.columnId);
  const isAssignmentEditor = descriptor?.valueKind === 'tokens'
    && String(descriptor.id).startsWith('assignment.');
  const resourceOptions = descriptor?.editorOptions ?? [];
  const resourceOptionById = new Map(resourceOptions.map(option => [option.value, option] as const));
  const curves: readonly ResourceCurve[] = [
    'UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK',
  ];
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => {
    const node = inputRef.current;
    node?.focus();
    if (node instanceof HTMLInputElement) node.select();
  }, [cell.rowKey, cell.columnId]);

  return (
    <GridEditorHost
      cell={cell}
      onCancel={onCancel}
      onFocusCell={onFocusCell}
      onCommit={() => {
        const result = commitTaskCellEditorValue({
          adapter, cell, text, messageForError,
          ...(isAssignmentEditor ? { directValue: assignmentTokens } : {}),
        });
        return result.ok && nextCell ? { ...result, nextCell } : result;
      }}
    >
      {inputProps => (
        isAssignmentEditor ? (
          <div
            {...inputProps}
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
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={Number.isFinite(token.unitsPerDay) ? token.unitsPerDay : ''}
                      aria-label={`${resourceLabel} — ${labelForOption('assignment.unitsPerDay', 'units')}`}
                      onChange={event => setAssignmentTokens(current => current.map((item, itemIndex) => (
                        itemIndex === index
                          ? { ...item, unitsPerDay: event.currentTarget.valueAsNumber }
                          : item
                      )))}
                    />
                    <select
                      value={token.curve ?? 'UNIFORM'}
                      aria-label={`${resourceLabel} — ${labelForOption('assignment.curve', 'curve')}`}
                      onChange={event => setAssignmentTokens(current => current.map((item, itemIndex) => (
                        itemIndex === index
                          ? {
                              ...item,
                              curve: event.currentTarget.value === 'UNIFORM'
                                ? undefined
                                : event.currentTarget.value as ResourceCurve,
                            }
                          : item
                      )))}
                    >
                      {curves.map(curve => (
                        <option key={curve} value={curve}>
                          {labelForOption(`resourceCurve.${curve}`, curve)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`${labelForOption('assignment.remove', 'remove')} ${resourceLabel}`}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                      }}
                      onClick={() => setAssignmentTokens(current => (
                        current.filter((_, itemIndex) => itemIndex !== index)
                      ))}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <input
              ref={node => { inputRef.current = node; }}
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
            />
            {resourceQuery.trim() && (
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
            <option value="true">{labelForOption('boolean.true', 'true')}</option>
            <option value="false">{labelForOption('boolean.false', 'false')}</option>
          </select>
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
