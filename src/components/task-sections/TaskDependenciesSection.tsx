import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { SequenceType, SEQUENCE_TYPE_OPTIONS, type Sequence } from '@/types/sequence';
import { Task } from '@/types/task';
import { RelationSentence, relationSentenceName } from '@/components/common/RelationSentence';
import { Select } from '@/components/common/Select';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { TaskTooltipContent } from '@/components/canvas/TaskTooltipContent';
import { knownDrivingSequenceIds } from '@/engine/scheduler/drivingInfo';
import { GANTT_TRACE_COLORS } from '@/engine/renderer/themePalette';
import { relationTaskOptions } from '@/engine/taskGrid/relationCell';
import { createRelationsWithFeedback } from '@/state/relationActions';
import { relationStepTarget, type RelationStepDirection } from '@/state/relationStep';
import { Icon } from '@/components/icons';
import type { RelationAssignDirection } from '@/state/slices/types';

interface HoverState { x: number; y: number; task: Task; }

interface RelationDraft {
  direction: RelationAssignDirection;
  picked: string[];
  listOpen: boolean;
  query: string;
  highlight: number;
  type: SequenceType;
  lag: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>;
}

const MAX_OPTIONS = 8;

const EMPTY_DRAFT: RelationDraft = {
  direction: 'predecessor',
  picked: [],
  listOpen: true,
  query: '',
  highlight: 0,
  type: 'FINISH_START',
  lag: { lagDays: 0 },
};

const TYPE_OPTIONS = SEQUENCE_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }));

export function TaskDependenciesSection({ taskId, interactive = true }: { taskId: string; interactive?: boolean }) {
  const { t } = useTranslation('task');
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const cpmResult = useAppStore(s => s.cpmResult);
  const updateSequence = useAppStore(s => s.updateSequence);
  const removeSequence = useAppStore(s => s.removeSequence);
  const focusOnTask = useAppStore(s => s.focusOnTask);
  const stepTargets = useMemo(() => ({
    predecessor: relationStepTarget({ tasks, sequences, cpmResult }, taskId, 'predecessor'),
    successor: relationStepTarget({ tasks, sequences, cpmResult }, taskId, 'successor'),
  }), [tasks, sequences, cpmResult, taskId]);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [focusedSequenceId, setFocusedSequenceId] = useState<string | null>(null);
  const pointerHeld = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const showSentenceFor = (update: (current: string | null) => string | null) => {
    if (!pointerHeld.current) { setFocusedSequenceId(update); return; }
    pendingFocus.current = update(pendingFocus.current);
  };
  const holdSentenceUntilPointerUp = () => {
    if (pointerHeld.current) return;
    pointerHeld.current = true;
    pendingFocus.current = focusedSequenceId;
    const release = () => {
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      pointerHeld.current = false;
      setFocusedSequenceId(pendingFocus.current);
    };
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
  };

  useEffect(() => {
    setHover(null);
  }, [taskId, sequences]);

  useEffect(() => {
    const focused = document.activeElement?.closest<HTMLElement>('[data-ops-sequence-id]');
    setFocusedSequenceId(focused?.dataset.opsSequenceId ?? null);
  }, [taskId]);

  const [draft, setDraft] = useState<RelationDraft | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const documentId = useAppStore(s => s.activeDocumentId);
  useEffect(() => {
    setDraft(null);
  }, [taskId, documentId]);

  const assignRequest = useAppStore(s => s.ui.pendingRelationAssign);
  const draftRef = useRef<HTMLDivElement>(null);
  const revealDraft = useRef(false);
  useEffect(() => {
    if (!interactive || !assignRequest || assignRequest.taskId !== taskId) return;
    revealDraft.current = true;
    setDraft({ ...EMPTY_DRAFT, direction: assignRequest.direction });
    useAppStore.getState().setUI({ pendingRelationAssign: null });
  }, [assignRequest, interactive, taskId]);
  useLayoutEffect(() => {
    if (!draft || !revealDraft.current) return;
    revealDraft.current = false;
    draftRef.current?.scrollIntoView({ block: 'nearest' });
    draftRef.current?.querySelector<HTMLInputElement>('[data-ops-dependency-search]')?.focus();
  }, [draft]);

  const query = draft?.query;
  const options = useMemo(
    () => (query === undefined ? [] : relationTaskOptions(tasks, taskId, query, MAX_OPTIONS)),
    [query, taskId, tasks],
  );

  const drivingIds = knownDrivingSequenceIds(cpmResult);
  const taskSequences = sequences.filter(
    s => s.predecessorId === taskId || s.successorId === taskId
  );
  if (taskSequences.length === 0 && !interactive) return null;

  const COLUMN_KEYS = { predecessor: 'properties.predecessors', successor: 'properties.successors' } as const;
  const sequenceColumns = (['predecessor', 'successor'] as const).map(role => ({
    role,
    seqs: taskSequences.filter(seq => (seq.predecessorId === taskId ? 'successor' : 'predecessor') === role),
  }));

  const pickedTasks = (draft?.picked ?? [])
    .map(id => tasks.find(t => t.id === id))
    .filter((task): task is Task => task !== undefined);
  const draftOther = pickedTasks.length === 1 ? pickedTasks[0] : undefined;
  const draftSequenceWith = (otherId: string): Sequence => ({
    id: 'relation-draft',
    predecessorId: draft?.direction === 'predecessor' ? otherId : taskId,
    successorId: draft?.direction === 'predecessor' ? taskId : otherId,
    type: draft?.type ?? 'FINISH_START',
    ...(draft?.lag ?? { lagDays: 0 }),
  });
  const draftSequence = draftSequenceWith(draftOther?.id ?? '');

  const toggleOption = (option: { taskId: string; label: string }, close: boolean) => {
    setDraft(current => {
      if (!current) return current;
      const on = current.picked.includes(option.taskId);
      if (close) {
        return on
          ? { ...current, listOpen: false, highlight: 0 }
          : { ...current, picked: [...current.picked, option.taskId], listOpen: false, query: option.label, highlight: 0 };
      }
      return {
        ...current,
        picked: on ? current.picked.filter(id => id !== option.taskId) : [...current.picked, option.taskId],
      };
    });
  };

  const unpick = (id: string) => setDraft(current => (current
    ? { ...current, picked: current.picked.filter(p => p !== id) }
    : current));

  const commitDraft = () => {
    if (pickedTasks.length === 0) return;
    const created = createRelationsWithFeedback(pickedTasks.map(task => {
      const { id: _id, ...relation } = draftSequenceWith(task.id);
      return relation;
    }));
    const refused = pickedTasks.filter((_task, index) => created[index] === null).map(task => task.id);
    if (refused.length === 0) { setDraft(null); return; }
    setDraft(current => (current ? { ...current, picked: refused } : current));
    if (refused.length < pickedTasks.length) confirmRef.current?.focus();
  };
  const directionKey = draft?.direction === 'successor' ? 'Successors' : 'Predecessors';
  const confirmLabel = pickedTasks.length > 1
    ? t(`properties.addRelationConfirm${directionKey}`, { count: pickedTasks.length })
    : t('properties.addRelationConfirm');

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <div className="dependency-head">
        <span className="ui-card-header !text-small !leading-4">{t('properties.dependencies')}</span>
        {interactive && (
          <span className="dependency-step">
            <StepButton direction="predecessor" targetId={stepTargets.predecessor} onStep={focusOnTask} />
            <StepButton direction="successor" targetId={stepTargets.successor} onStep={focusOnTask} />
          </span>
        )}
      </div>
      <div className="dependency-cols">
        {sequenceColumns.map(({ role, seqs }) => (
          <div className="dependency-col" key={role} data-ops-dependency-col={role}>
            <div className="dependency-col-head" data-ops-dependency-col-head={role}>
              {t(COLUMN_KEYS[role], { count: seqs.length })}
            </div>
            <div className="dependency-list">
        {seqs.map(seq => {
        const other = seq.predecessorId === taskId
          ? tasks.find(t => t.id === seq.successorId)
          : tasks.find(t => t.id === seq.predecessorId);
        const role = seq.predecessorId === taskId ? 'successor' : 'predecessor';
        const isDriving = drivingIds?.includes(seq.id);
        return (
          <div
            key={seq.id}
            className="dependency-item"
            data-ops-sequence-id={seq.id}
            onPointerDownCapture={holdSentenceUntilPointerUp}
            onFocus={() => showSentenceFor(() => seq.id)}
            onBlur={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                showSentenceFor(current => (current === seq.id ? null : current));
              }
            }}
          >
          <div className="dependency-row !text-small">
            {!interactive ? (
              <span className="dependency-wbs-cell min-w-0 truncate">{other?.name || '?'}</span>
            ) : other ? (
              <button
                type="button"
                className="dependency-wbs-link min-w-0 truncate"
                style={{ '--dependency-role-color': GANTT_TRACE_COLORS[role] } as CSSProperties}
                data-dependency-role={role}
                aria-label={`${t(`relations.${role}`)}: ${t('properties.jumpToTask', { wbs: other.wbsCode || other.name })}`}
                onMouseMove={e => setHover({ x: e.clientX, y: e.clientY, task: other })}
                onMouseLeave={() => setHover(null)}
                onFocus={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setHover({ x: r.left, y: r.bottom, task: other });
                }}
                onBlur={() => setHover(null)}
                onClick={() => { setHover(null); focusOnTask(other.id); }}
              >
                {other.wbsCode || other.name}
              </button>
            ) : (
              <span className="dependency-wbs-cell min-w-0 truncate">?</span>
            )}
            <span className="dependency-driving-slot">
              {drivingIds === undefined ? (
                <span
                  role="img"
                  aria-label={t('properties.drivingUnknown')}
                  title={t('properties.drivingUnknown')}
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Icon id="planning.driving-unknown" size={10} aria-hidden />
                </span>
              ) : isDriving && (
                <span title={t('properties.driving')} className="text-text-secondary">
                  <Icon id="planning.driving" size={10} />
                </span>
              )}
            </span>
            <span className="dependency-type-field">
              <Select
                value={seq.type}
                aria-label={t('relations.type')}
                options={TYPE_OPTIONS}
                onChange={value => updateSequence(seq.id, { type: value as SequenceType })}
                className="ops-select__trigger--compact"
              />
            </span>
            <SequenceLagInput
              seq={seq}
              title={t('properties.lag')}
              className="dependency-lag-field input !w-full !text-small !px-1 !py-0.5 text-right"
              onCommit={patch => updateSequence(seq.id, patch)}
            />
            <button
              onClick={() => removeSequence(seq.id)}
              className="dependency-remove-button justify-self-center"
              style={{ color: 'var(--error)' }}
            >
              <Icon id="edit.delete" size={10} />
            </button>
          </div>
          {focusedSequenceId === seq.id && (
            <RelationSentence
              type={seq.type}
              predecessorName={relationSentenceName(tasks.find(t => t.id === seq.predecessorId))}
              successorName={relationSentenceName(tasks.find(t => t.id === seq.successorId))}
            />
          )}
          </div>
        );
        })}
            </div>
          </div>
        ))}
      </div>
      {interactive && (draft ? (
        <div ref={draftRef} className="dependency-draft" data-ops-dependency-draft>
          <div className="dependency-draft-head">
            <span className="dependency-draft-direction" data-ops-dependency-direction={draft.direction}>
              <Select
                aria-label={t('properties.addRelationDirection')}
                value={draft.direction}
                options={[
                  { value: 'predecessor', label: t('relations.predecessor') },
                  { value: 'successor', label: t('relations.successor') },
                ]}
                onChange={value => setDraft(current => (current
                  ? { ...current, direction: value as RelationAssignDirection }
                  : current))}
                className="ops-select__trigger--compact"
              />
            </span>
            <div className="dependency-draft-search">
              <input
                autoFocus
                type="text"
                role="combobox"
                aria-expanded={draft.listOpen && options.length > 0}
                aria-label={t('properties.addRelationSearch')}
                placeholder={t('properties.addRelationSearch')}
                data-ops-dependency-search
                value={draft.query}
                onChange={e => setDraft(current => (current
                  ? { ...current, query: e.target.value, listOpen: true, highlight: 0 }
                  : current))}
                onKeyDown={e => {
                  if (e.key === 'Escape') { e.preventDefault(); setDraft(null); return; }
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (!draft.listOpen) { setDraft(current => (current ? { ...current, listOpen: true } : current)); return; }
                    if (options.length === 0) return;
                    const step = e.key === 'ArrowDown' ? 1 : options.length - 1;
                    setDraft(current => (current
                      ? { ...current, highlight: (current.highlight + step) % options.length }
                      : current));
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const option = draft.listOpen ? options[draft.highlight] : undefined;
                    if (option) toggleOption(option, true);
                    else commitDraft();
                  }
                }}
                className="input !w-full !text-small !px-1 !py-0.5"
              />
            </div>
            <button
              type="button"
              title={t('properties.addRelationCancel')}
              aria-label={t('properties.addRelationCancel')}
              data-ops-dependency-cancel
              className="dependency-remove-button"
              onClick={() => setDraft(null)}
            >
              <Icon id="ui.close" size={10} />
            </button>
          </div>
          {draft.listOpen && options.length > 0 && (
            <ul className="dependency-draft-options" role="listbox" aria-multiselectable="true">
              {options.map((option, index) => {
                const on = draft.picked.includes(option.taskId);
                return (
                  <li key={option.taskId} role="option" aria-selected={on}>
                    <button
                      type="button"
                      data-ops-dependency-option={index}
                      data-ops-dependency-highlighted={index === draft.highlight || undefined}
                      className="dependency-draft-option"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => toggleOption(option, false)}
                    >
                      <span className="dependency-draft-check" aria-hidden="true">
                        {on ? <Icon id="menu.item-checked" size={10} /> : null}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {pickedTasks.length > 0 && (
            <ul className="dependency-draft-picked">
              {pickedTasks.map(task => (
                <li key={task.id} className="dependency-draft-chip" data-ops-dependency-picked={task.id}>
                  <span className="truncate" title={`${task.wbsCode} ${task.name}`.trim()}>{task.wbsCode || task.name}</span>
                  <button
                    type="button"
                    data-ops-dependency-unpick
                    title={t('properties.addRelationUnpick', { task: `${task.wbsCode} ${task.name}`.trim() })}
                    aria-label={t('properties.addRelationUnpick', { task: `${task.wbsCode} ${task.name}`.trim() })}
                    onClick={() => unpick(task.id)}
                  >
                    <Icon id="ui.close" size={8} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="dependency-row !text-small">
            <span className="dependency-wbs-cell min-w-0 truncate">
              {pickedTasks.length > 1
                ? t(`properties.addRelationPicked${directionKey}`, { count: pickedTasks.length })
                : draftOther ? (draftOther.wbsCode || draftOther.name) : t('properties.addRelationPick')}
            </span>
            <span className="dependency-driving-slot" />
            <span className="dependency-type-field" data-ops-dependency-type>
              <Select
                value={draft.type}
                aria-label={t('relations.type')}
                options={TYPE_OPTIONS}
                onChange={value => setDraft(current => (current
                  ? { ...current, type: value as SequenceType }
                  : current))}
                className="ops-select__trigger--compact"
              />
            </span>
            <SequenceLagInput
              seq={draftSequence}
              title={t('properties.lag')}
              className="dependency-lag-field input !w-full !text-small !px-1 !py-0.5 text-right"
              onCommit={patch => setDraft(current => (current ? { ...current, lag: patch } : current))}
              onDraftChange={patch => setDraft(current => (current ? { ...current, lag: patch } : current))}
            />
            <button
              type="button"
              title={confirmLabel}
              aria-label={confirmLabel}
              data-ops-dependency-confirm
              ref={confirmRef}
              disabled={pickedTasks.length === 0}
              className="dependency-remove-button justify-self-center"
              style={{ color: pickedTasks.length > 0 ? ('var(--theme-text)') : 'var(--theme-text-muted)' }}
              onClick={commitDraft}
            >
              <Icon id="input.confirm-draft" size={10} />
            </button>
          </div>
          {draftOther && (
            <RelationSentence
              type={draft.type}
              predecessorName={relationSentenceName(tasks.find(t => t.id === draftSequence.predecessorId))}
              successorName={relationSentenceName(tasks.find(t => t.id === draftSequence.successorId))}
            />
          )}
        </div>
      ) : (
        <button
          type="button"
          data-ops-dependency-add
          className="dependency-add-button"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          <Icon id="planning.dependency-add" size={10} />
          {t('properties.addRelation')}
        </button>
      ))}
      {hover && (
        <HoverTooltip left={hover.x + 16} top={hover.y - 10}>
          <TaskTooltipContent task={hover.task} />
        </HoverTooltip>
      )}
    </>
  );
}

function StepButton({ direction, targetId, onStep }: {
  direction: RelationStepDirection;
  targetId: string | null;
  onStep: (taskId: string) => void;
}) {
  const { t } = useTranslation('task');
  const target = useAppStore(s => (targetId ? s.tasks.find(task => task.id === targetId) : undefined));
  const label = target
    ? t(direction === 'predecessor' ? 'properties.stepPredecessor' : 'properties.stepSuccessor', {
      task: `${target.wbsCode} ${target.name}`.trim(),
    })
    : t(direction === 'predecessor' ? 'properties.stepPredecessorNone' : 'properties.stepSuccessorNone');
  return (
    <button
      type="button"
      className="dependency-step-button"
      data-ops-dependency-step={direction}
      title={label}
      aria-label={label}
      disabled={!target}
      onClick={() => { if (target) onStep(target.id); }}
    >
      <Icon id={direction === 'predecessor' ? 'nav.back' : 'nav.forward'} size={12} className="ops-icon-inline-flip" />
    </button>
  );
}
