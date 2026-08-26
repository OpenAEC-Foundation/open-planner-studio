import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type Ref } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { TaskTooltipContent } from '@/components/canvas/TaskTooltipContent';
import {
  externalAnchorSideIsCompatible,
  formatExternalLagShort,
  parseExternalLagInput,
  type ExternalRelationType,
} from '@/engine/taskGrid/relationFormat';
import {
  normalizeRelationTokenSources,
  relationTaskOptions,
  type RelationCellItem,
} from '@/engine/taskGrid/relationCell';
import type { ParsedRelationToken } from '@/engine/taskGrid/relationPlan';
import type { Task } from '@/types/task';
import type { GridEditorInputProps } from './GridEditorHost';

const RELATION_TYPES: readonly ExternalRelationType[] = ['FS', 'SS', 'FF', 'SF'];

interface RelationHover {
  x: number;
  y: number;
  item: RelationCellItem;
}

function relationLabelParts(label: string): { reference: string; detail: string } {
  const match = /^(.*) ((?:FS|SS|FF|SF).*)$/.exec(label);
  return match ? { reference: match[1], detail: match[2] } : { reference: label, detail: '' };
}

function ExternalRelationTooltipContent({ item }: { item: RelationCellItem }) {
  if (item.parsedToken.kind !== 'external') return null;
  const external = item.parsedToken.external;
  return (
    <>
      <div className="tooltip-title">{external.sourceRef.taskName || external.sourceRef.taskId}</div>
      <div className="tooltip-row"><span className="tooltip-label">Project:</span><span className="tooltip-value">{external.sourceRef.projectName || external.sourceRef.projectId}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">Taak-ID:</span><span className="tooltip-value">{external.sourceRef.taskId}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">Bevroren anker:</span><span className="tooltip-value">{external.anchorDate}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">Bron:</span><span className="tooltip-value">{external.sourceMissing ? 'niet beschikbaar; bevroren datum blijft actief' : 'beschikbaar bij laatste controle'}</span></div>
      {external.sourceRef.filePath && <div className="tooltip-row"><span className="tooltip-label">Bestand:</span><span className="tooltip-value">{external.sourceRef.filePath}</span></div>}
    </>
  );
}

export interface RelationCellContentProps {
  items: readonly RelationCellItem[];
  onFocusTask: (taskId: string) => void;
  onHoverStart?: () => void;
  onExternalContextMenu?: (item: RelationCellItem, event: MouseEvent<HTMLElement>) => void;
}

/** Compacte celweergave; alleen de taakreferentie is interactief, type en lag blijven gewone tekst. */
export function RelationCellContent({ items, onFocusTask, onHoverStart, onExternalContextMenu }: RelationCellContentProps) {
  const [hover, setHover] = useState<RelationHover | null>(null);
  useEffect(() => setHover(null), [items]);
  return (
    <>
      <span className="task-grid-relation-cell">
        {items.map((item, index) => {
          const parts = relationLabelParts(item.label);
          const warningTitle = [
            ...item.warnings,
            ...(item.stale ? ['planning-verouderd'] : []),
            ...(item.freeFloat !== undefined ? [`vrije speling: ${item.freeFloat}d`] : []),
          ].join(' · ');
          return (
            <span
              key={item.key}
              className={`task-grid-relation-chip${item.driving ? ' task-grid-relation-chip--driving' : ''}${item.warnings.length ? ' task-grid-relation-chip--warning' : ''}`}
              title={warningTitle || undefined}
              onContextMenu={event => {
                if (item.kind !== 'external' || !onExternalContextMenu) return;
                event.preventDefault();
                event.stopPropagation();
                setHover(null);
                onExternalContextMenu(item, event);
              }}
            >
              {index > 0 && <span className="task-grid-relation-separator">; </span>}
              <button
                type="button"
                className="task-grid-relation-jump"
                aria-label={item.kind === 'internal' ? `Spring naar taak ${parts.reference}` : `Externe taak ${parts.reference}`}
                onMouseMove={event => {
                  event.stopPropagation();
                  onHoverStart?.();
                  setHover({ x: event.clientX, y: event.clientY, item });
                }}
                onMouseLeave={() => setHover(null)}
                onFocus={event => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHover({ x: rect.left, y: rect.bottom, item });
                }}
                onBlur={() => setHover(null)}
                onClick={() => {
                  setHover(null);
                  if (item.kind === 'internal') onFocusTask(item.otherTaskId);
                }}
              >
                {parts.reference}
              </button>
              {parts.detail && <span className="task-grid-relation-detail"> {parts.detail}</span>}
              {item.driving && <Zap size={10} aria-label="Sturend" />}
              {item.warnings.length > 0 && <AlertTriangle size={10} aria-label="Waarschuwing" />}
            </span>
          );
        })}
      </span>
      {hover && (
        <HoverTooltip left={hover.x + 16} top={hover.y - 10}>
          {hover.item.kind === 'internal' && hover.item.otherTask
            ? <TaskTooltipContent task={hover.item.otherTask} />
            : <ExternalRelationTooltipContent item={hover.item} />}
        </HoverTooltip>
      )}
    </>
  );
}

export interface RelationCellEditorProps {
  inputProps: GridEditorInputProps;
  inputRef: Ref<HTMLInputElement>;
  label: string;
  ownerTaskId: string;
  tasks: readonly Task[];
  tokens: readonly ParsedRelationToken[];
  rawText?: string;
  onRawTextChange: (text: string) => void;
  onTokensChange: (tokens: readonly ParsedRelationToken[]) => void;
  onValidityChange: (valid: boolean) => void;
  onOpenExternal?: (relationId?: string) => void;
}

function controlKeyDown(event: KeyboardEvent<HTMLElement>): void {
  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
}

export function RelationCellEditor({
  inputProps,
  inputRef,
  label,
  ownerTaskId,
  tasks,
  tokens,
  rawText,
  onRawTextChange,
  onTokensChange,
  onValidityChange,
  onOpenExternal,
}: RelationCellEditorProps) {
  const [query, setQuery] = useState('');
  const [externalLagDrafts, setExternalLagDrafts] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const token of tokens) {
      if (token.kind === 'external') {
        values[token.relationId ?? token.external.origin.linkId] = formatExternalLagShort(token.external.lag);
      }
    }
    return values;
  });
  const options = useMemo(
    () => relationTaskOptions(tasks, ownerTaskId, query),
    [ownerTaskId, query, tasks],
  );

  const externalDraftsValid = (
    candidates: readonly ParsedRelationToken[],
    drafts: Readonly<Record<string, string>>,
  ) => candidates.every(candidate => candidate.kind !== 'external'
    || parseExternalLagInput(drafts[candidate.relationId ?? candidate.external.origin.linkId] ?? '') !== null);

  const replaceToken = (index: number, token: ParsedRelationToken) => {
    onTokensChange(normalizeRelationTokenSources(tokens.map((current, currentIndex) => (
      currentIndex === index ? token : current
    ))));
  };
  const removeToken = (index: number) => {
    const next = normalizeRelationTokenSources(tokens.filter((_, currentIndex) => currentIndex !== index));
    onTokensChange(next);
    onValidityChange(externalDraftsValid(next, externalLagDrafts));
  };
  const chooseOption = (option: ReturnType<typeof relationTaskOptions>[number]) => {
    const next: ParsedRelationToken = {
      kind: 'internal',
      wbsCode: option.wbsCode,
      taskId: option.taskId,
      relType: 'FS',
      lagText: '',
      source: { index: 0, start: 0, end: 0, text: '' },
    };
    onTokensChange(normalizeRelationTokenSources([...tokens, next]));
    setQuery('');
  };

  if (rawText !== undefined) {
    return (
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        aria-label={label}
        value={rawText}
        onChange={event => onRawTextChange(event.currentTarget.value)}
        className="task-grid-editor-input"
        data-task-editor-kind="relations-raw"
      />
    );
  }

  return (
    <div {...inputProps} className="task-grid-relation-editor" data-task-editor-kind="relations">
      <div className="task-grid-relation-tokens" role="list">
        {tokens.map((token, index) => {
          if (token.kind === 'internal') {
            const task = token.taskId ? tasks.find(candidate => candidate.id === token.taskId) : undefined;
            const taskLabel = `${token.wbsCode}${task?.name ? ` ${task.name}` : ''}`;
            return (
              <div key={token.relationId ?? `${token.taskId ?? token.wbsCode}:${index}`} className="task-grid-relation-token" role="listitem">
                <span className="task-grid-relation-reference" title={taskLabel}>{taskLabel}</span>
                <select
                  aria-label={`${taskLabel} — relatietype`}
                  value={token.relType}
                  onKeyDown={controlKeyDown}
                  onChange={event => replaceToken(index, {
                    ...token, relType: event.currentTarget.value as ExternalRelationType,
                  })}
                >
                  {RELATION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <input
                  aria-label={`${taskLabel} — vertraging`}
                  value={token.lagText}
                  placeholder="0d"
                  onChange={event => replaceToken(index, { ...token, lagText: event.currentTarget.value })}
                />
                <button type="button" aria-label={`Verwijder relatie met ${taskLabel}`} onKeyDown={controlKeyDown} onClick={() => removeToken(index)}>×</button>
              </div>
            );
          }

          const key = token.relationId ?? token.external.origin.linkId;
          const sourceLabel = `${token.external.sourceRef.projectName || token.external.sourceRef.projectId} / ${token.external.sourceRef.taskName || token.external.sourceRef.taskId}`;
          const compatibleTypes = RELATION_TYPES.filter(type => externalAnchorSideIsCompatible(
            token.external.origin.direction,
            token.external.copiedRelType,
            token.external.origin.direction,
            type,
          ));
          return (
            <div key={key} className="task-grid-relation-token task-grid-relation-token--external" role="listitem">
              <button
                type="button"
                className="task-grid-relation-reference"
                title={sourceLabel}
                onKeyDown={controlKeyDown}
                onClick={() => onOpenExternal?.(token.relationId ?? token.external.origin.linkId)}
              >
                {sourceLabel}
              </button>
              <select
                aria-label={`${sourceLabel} — relatietype`}
                value={token.external.relType}
                onKeyDown={controlKeyDown}
                onChange={event => replaceToken(index, {
                  ...token,
                  external: { ...token.external, relType: event.currentTarget.value as ExternalRelationType },
                })}
              >
                {compatibleTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <input
                aria-label={`${sourceLabel} — vertraging`}
                value={externalLagDrafts[key] ?? ''}
                placeholder="0d"
                onChange={event => {
                  const value = event.currentTarget.value;
                  const nextDrafts = { ...externalLagDrafts, [key]: value };
                  setExternalLagDrafts(nextDrafts);
                  const lag = parseExternalLagInput(value);
                  onValidityChange(externalDraftsValid(tokens, nextDrafts));
                  if (lag) replaceToken(index, { ...token, external: { ...token.external, lag } });
                }}
              />
              <button type="button" aria-label={`Verwijder externe relatie met ${sourceLabel}`} onKeyDown={controlKeyDown} onClick={() => removeToken(index)}>×</button>
            </div>
          );
        })}
      </div>

      <div className="task-grid-relation-add">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={query.trim().length > 0}
          placeholder="WBS of taaknaam"
          value={query}
          onChange={event => setQuery(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter' || query.trim() === '' || options.length !== 1) return;
            event.preventDefault();
            event.stopPropagation();
            chooseOption(options[0]);
          }}
        />
        <button type="button" onKeyDown={controlKeyDown} onClick={() => onOpenExternal?.()}>
          Externe relatie toevoegen…
        </button>
      </div>
      {query.trim() && (
        <div className="task-grid-relation-options" role="listbox">
          {options.map(option => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={option.taskId}
              onMouseDown={event => event.preventDefault()}
              onKeyDown={controlKeyDown}
              onClick={() => chooseOption(option)}
            >
              <strong>{option.wbsCode}</strong> {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
