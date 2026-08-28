import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  RELATION_WARNING_KEYS,
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

interface RelationEditorPosition {
  left: number;
  top: number;
  width: number;
}

function relationLabelParts(label: string): { reference: string; detail: string } {
  const match = /^(.*) ((?:FS|SS|FF|SF).*)$/.exec(label);
  return match ? { reference: match[1], detail: match[2] } : { reference: label, detail: '' };
}

function ExternalRelationTooltipContent({ item }: { item: RelationCellItem }) {
  const { t } = useTranslation('task');
  if (item.parsedToken.kind !== 'external') return null;
  const external = item.parsedToken.external;
  return (
    <>
      <div className="tooltip-title">{external.sourceRef.taskName || external.sourceRef.taskId}</div>
      <div className="tooltip-row"><span className="tooltip-label">{t('externalLinks.projectId')}:</span><span className="tooltip-value">{external.sourceRef.projectName || external.sourceRef.projectId}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">{t('externalLinks.taskId')}:</span><span className="tooltip-value">{external.sourceRef.taskId}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">{t('externalLinks.anchorDate')}:</span><span className="tooltip-value">{external.anchorDate}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">{t('externalLinks.source')}:</span><span className="tooltip-value">{external.sourceMissing ? t('externalLinks.sourceMissing') : t('externalLinks.sourceAvailable')}</span></div>
      {external.sourceRef.filePath && <div className="tooltip-row"><span className="tooltip-label">{t('externalLinks.sourceFile')}:</span><span className="tooltip-value">{external.sourceRef.filePath}</span></div>}
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
  const { t } = useTranslation('task');
  const [hover, setHover] = useState<RelationHover | null>(null);
  useEffect(() => setHover(null), [items]);
  return (
    <>
      <span className="task-grid-relation-cell">
        {items.map((item, index) => {
          const parts = relationLabelParts(item.label);
          const warningTitle = [
            ...item.warnings.map(warning => t(RELATION_WARNING_KEYS[warning] ?? warning, { defaultValue: warning })),
            ...(item.stale ? [t('taskGrid.status.stale')] : []),
            ...(item.freeFloat !== undefined ? [`${t('relations.freeFloat')}: ${item.freeFloat}d`] : []),
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
                aria-label={item.kind === 'internal'
                  ? t('relations.jumpTask', { reference: parts.reference })
                  : t('relations.externalTask', { reference: parts.reference })}
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
              {item.driving && <Zap size={10} aria-label={t('relations.driving')} />}
              {item.warnings.length > 0 && <AlertTriangle size={10} aria-label={t('relations.warnings')} />}
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
  const { t } = useTranslation('task');
  const validationProps = {
    'aria-invalid': inputProps['aria-invalid'],
    'aria-describedby': inputProps['aria-describedby'],
  };
  const [query, setQuery] = useState('');
  const anchorRef = useRef<HTMLSpanElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<RelationEditorPosition | null>(null);
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

  const updatePosition = useCallback(() => {
    if (rawText !== undefined || typeof window === 'undefined') return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    const width = Math.max(280, Math.min(680, Math.max(520, rect.width), window.innerWidth - margin * 2));
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const height = editorRef.current?.getBoundingClientRect().height ?? 0;
    const preferredTop = rect.top;
    const top = height > 0 && preferredTop + height > window.innerHeight - margin
      ? Math.max(margin, rect.bottom - height)
      : Math.max(margin, Math.min(preferredTop, window.innerHeight - margin));
    setPosition(current => current
      && current.left === left && current.top === top && current.width === width
      ? current
      : { left, top, width });
  }, [rawText]);

  useLayoutEffect(() => {
    if (rawText !== undefined) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [rawText, updatePosition]);

  useLayoutEffect(() => {
    if (!position) return;
    updatePosition();
    queryInputRef.current?.focus();
  }, [options.length, position, tokens.length, updatePosition]);

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

  const editor = position ? (
    <div
      onKeyDown={inputProps.onKeyDown}
      ref={editorRef}
      className="task-grid-relation-editor"
      data-task-editor-kind="relations"
      style={{ left: position.left, top: position.top, width: position.width }}
      // Besturing binnen de cel is geen nieuwe cel-/rijselectie en mag ook geen rijdrag starten.
      // Zonder deze grens herbouwde de Gantt-surface de editor al op pointer-down, vóór de klik op
      // type, lag of verwijderen zijn lokale tokenstate kon bijwerken.
      onPointerDown={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="task-grid-relation-tokens" role="list">
        {tokens.map((token, index) => {
          if (token.kind === 'internal') {
            const task = token.taskId ? tasks.find(candidate => candidate.id === token.taskId) : undefined;
            const taskLabel = `${token.wbsCode}${task?.name ? ` ${task.name}` : ''}`;
            return (
              <div key={token.relationId ?? `${token.taskId ?? token.wbsCode}:${index}`} className="task-grid-relation-token" role="listitem">
                <span className="task-grid-relation-reference" title={taskLabel}>{taskLabel}</span>
                <select
                  {...validationProps}
                  aria-label={t('relations.controlType', { task: taskLabel })}
                  value={token.relType}
                  onKeyDown={controlKeyDown}
                  onChange={event => replaceToken(index, {
                    ...token, relType: event.currentTarget.value as ExternalRelationType,
                  })}
                >
                  {RELATION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <input
                  {...validationProps}
                  aria-label={t('relations.controlLag', { task: taskLabel })}
                  value={token.lagText}
                  placeholder="0d"
                  onChange={event => replaceToken(index, { ...token, lagText: event.currentTarget.value })}
                />
                <button type="button" aria-label={t('relations.removeInternal', { task: taskLabel })} onKeyDown={controlKeyDown} onClick={() => removeToken(index)}>×</button>
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
                {...validationProps}
                aria-label={t('relations.controlType', { task: sourceLabel })}
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
                {...validationProps}
                aria-label={t('relations.controlLag', { task: sourceLabel })}
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
              <button type="button" aria-label={t('relations.removeExternal', { task: sourceLabel })} onKeyDown={controlKeyDown} onClick={() => removeToken(index)}>×</button>
            </div>
          );
        })}
      </div>

      <div className="task-grid-relation-add">
        <input
          {...validationProps}
          ref={node => {
            queryInputRef.current = node;
            if (typeof inputRef === 'function') inputRef(node);
            else if (inputRef) inputRef.current = node;
          }}
          type="text"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={query.trim().length > 0}
          placeholder={t('relations.searchPlaceholder')}
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
          {t('externalLinks.action')}
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
  ) : null;

  return (
    <>
      <span ref={anchorRef} className="task-grid-relation-editor-anchor" aria-hidden="true" />
      {editor && typeof document !== 'undefined' ? createPortal(editor, document.body) : null}
    </>
  );
}
