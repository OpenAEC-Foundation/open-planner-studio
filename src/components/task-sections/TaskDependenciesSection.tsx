import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { SequenceType, SEQUENCE_TYPE_OPTIONS, type Sequence } from '@/types/sequence';
import { Task } from '@/types/task';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { TaskTooltipContent } from '@/components/canvas/TaskTooltipContent';
import { GANTT_TRACE_COLORS } from '@/engine/renderer/themePalette';
import { relationTaskOptions } from '@/engine/taskGrid/relationCell';
import { createRelationDraftWithFeedback } from '@/state/relationActions';
import { Check, Plus, Trash2, X, Zap } from 'lucide-react';

interface HoverState { x: number; y: number; task: Task; }

/** Richting van de conceptrelatie, gezien vanuit de GEKOZEN taak t.o.v. de huidige taak. */
type DraftDirection = 'predecessor' | 'successor';

interface RelationDraft {
  direction: DraftDirection;
  /** De gekozen tegenpartij; `null` zolang er alleen gezocht wordt. */
  otherTaskId: string | null;
  query: string;
  /** Index in de zichtbare trefferlijst voor pijltoetsbediening. */
  highlight: number;
  type: SequenceType;
  lag: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>;
}

/** Hoeveel treffers de conceptrij tegelijk toont — de rechterrail is smal, een langere lijst
 *  duwt de rest van het paneel weg in plaats van te helpen. */
const MAX_OPTIONS = 8;

const EMPTY_DRAFT: RelationDraft = {
  direction: 'predecessor',
  otherTaskId: null,
  query: '',
  highlight: 0,
  type: 'FINISH_START',
  lag: { lagDays: 0 },
};

/**
 * Afhankelijkheden (relatietabel: type + lag + driving-badge + verwijderen) — sectie 9 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). RELATIONEEL/storeful: roept `updateSequence`/
 * `removeSequence` rechtstreeks aan, identiek in paneel én dialoog (dialoog heeft altijd een
 * bestaand `task.id` — zie ontwerp-doc-vondst).
 *
 * Issue #65: het WBS-nummer van de gekoppelde taak is een knop — de eerdere richtingspijl (→/←)
 * ervoor is weg (eigenaarsbesluit 2026-08-18: alleen het nummer, geen pijltje).
 * Hover toont dezelfde `TaskTooltipContent` als het canvas (via de gedeelde, portal-gebaseerde
 * `HoverTooltip`); klik roept `focusOnTask` aan — selecteert de taak, klapt een ingeklapte
 * oudersketen uit, en laat GanttCanvas ernaartoe zoomen/scrollen. Dat laatste heeft een gemonte
 * `GanttCanvas` nodig om het `pendingFocusTaskId`-signaal ooit op te pikken en te wissen — die
 * garantie geldt alleen in het eigenschappenpaneel (`!isFullPanel`, App.tsx), niet in `TaskDialog`
 * (opent op elk tabblad via F2). `interactive=false` (hyperkritische review issue #65) valt daarom
 * terug op platte tekst (taaknaam), zonder knop/hover/klik.
 */
export function TaskDependenciesSection({ taskId, interactive = true }: { taskId: string; interactive?: boolean }) {
  const { t } = useTranslation('task');
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const cpmResult = useAppStore(s => s.cpmResult);
  const updateSequence = useAppStore(s => s.updateSequence);
  const removeSequence = useAppStore(s => s.removeSequence);
  const focusOnTask = useAppStore(s => s.focusOnTask);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Spooktooltip (hyperkritische review issue #65): de hover werd voorheen alleen gewist door
  // onMouseLeave/onClick op de knop zelf. Wisselt de selectie (of verandert de sequence-lijst)
  // zonder dat de muis de knop verlaat — bv. Ctrl+Z, een pijltoets, of de AI-assistent die de
  // selectie verzet — dan bleef de tooltip van de vorige taak zweven, ook over dialogen heen (hij
  // rendert via een portal met een hoge z-index). Elke wissel van context wist 'm daarom expliciet.
  useEffect(() => {
    setHover(null);
  }, [taskId, sequences]);

  // Conceptrelatie (2026-09): de sectie kan zelf relaties aanmaken. Het concept blijft LOKAAL tot
  // de bevestiging — dezelfde vorm als `RelationTypePopover` op het canvas — zodat type en lag als
  // één undoable mutatie landen en Escape niets hoeft terug te draaien.
  const [draft, setDraft] = useState<RelationDraft | null>(null);

  // Zelfde reden als de spooktooltip hieronder: een selectiewissel (pijltoets, Ctrl+Z, AI) mag geen
  // half ingevulde conceptrij van de vórige taak laten staan — die zou bij bevestigen op de nieuwe
  // taak landen.
  useEffect(() => {
    setDraft(null);
  }, [taskId]);

  const options = useMemo(
    () => (draft ? relationTaskOptions(tasks, taskId, draft.query).slice(0, MAX_OPTIONS) : []),
    [draft, taskId, tasks],
  );

  const taskSequences = sequences.filter(
    s => s.predecessorId === taskId || s.successorId === taskId
  );
  if (taskSequences.length === 0 && !interactive) return null;

  const draftOther = draft?.otherTaskId ? tasks.find(t => t.id === draft.otherTaskId) : undefined;
  const draftSequence: Sequence = {
    id: 'relation-draft',
    predecessorId: draft?.direction === 'predecessor' ? (draft.otherTaskId ?? '') : taskId,
    successorId: draft?.direction === 'predecessor' ? taskId : (draft?.otherTaskId ?? ''),
    type: draft?.type ?? 'FINISH_START',
    ...(draft?.lag ?? { lagDays: 0 }),
  };

  const chooseOption = (option: { taskId: string; label: string }) => {
    setDraft(current => (current
      ? { ...current, otherTaskId: option.taskId, query: option.label, highlight: 0 }
      : current));
  };

  const commitDraft = () => {
    if (!draft?.otherTaskId) return;
    const created = createRelationDraftWithFeedback({
      predecessorId: draftSequence.predecessorId,
      successorId: draftSequence.successorId,
      type: draftSequence.type,
      lagDays: draftSequence.lagDays,
      lagUnit: draftSequence.lagUnit,
      lagPercent: draftSequence.lagPercent,
      lagMinutes: draftSequence.lagMinutes,
    });
    // Alleen bij succes sluiten: een weigering (duplicaat/voorouder) meldt zichzelf via het
    // gecentraliseerde kanaal en laat de conceptrij staan zodat de keuze te corrigeren is.
    if (created !== null) setDraft(null);
  };

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.dependencies')}</span>
      <div className="dependency-list">
        {taskSequences.map(seq => {
        const other = seq.predecessorId === taskId
          ? tasks.find(t => t.id === seq.successorId)
          : tasks.find(t => t.id === seq.predecessorId);
        const role = seq.predecessorId === taskId ? 'successor' : 'predecessor';
        const isDriving = !!cpmResult && !cpmResult.error
          && cpmResult.drivingSequenceIds.includes(seq.id);
        return (
          <div
            key={seq.id}
            className="dependency-row text-[10px]"
          >
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
              {isDriving && (
                <span title={t('properties.driving')} style={{ color: 'var(--theme-accent)' }}>
                  <Zap size={10} />
                </span>
              )}
            </span>
            <select
              value={seq.type}
              onChange={e => updateSequence(seq.id, { type: e.target.value as SequenceType })}
              className="dependency-type-field input !w-full !text-[10px] !px-1 !py-0.5"
            >
              {SEQUENCE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <SequenceLagInput
              seq={seq}
              title={t('properties.lag')}
              className="dependency-lag-field input !w-full !text-[10px] !px-1 !py-0.5 text-right"
              onCommit={patch => updateSequence(seq.id, patch)}
            />
            <button
              onClick={() => removeSequence(seq.id)}
              className="dependency-remove-button justify-self-center"
              style={{ color: 'var(--error)' }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        );
        })}
      </div>
      {interactive && (draft ? (
        <div className="dependency-draft" data-ops-dependency-draft>
          <div className="dependency-draft-head">
            <select
              aria-label={t('properties.addRelationDirection')}
              data-ops-dependency-direction
              value={draft.direction}
              onChange={e => setDraft(current => (current
                ? { ...current, direction: e.target.value as DraftDirection }
                : current))}
              className="input !w-auto !text-[10px] !px-1 !py-0.5"
            >
              <option value="predecessor">{t('relations.predecessor')}</option>
              <option value="successor">{t('relations.successor')}</option>
            </select>
            <div className="dependency-draft-search">
              <input
                autoFocus
                type="text"
                role="combobox"
                aria-expanded={options.length > 0}
                aria-label={t('properties.addRelationSearch')}
                placeholder={t('properties.addRelationSearch')}
                data-ops-dependency-search
                value={draft.query}
                onChange={e => setDraft(current => (current
                  ? { ...current, query: e.target.value, otherTaskId: null, highlight: 0 }
                  : current))}
                onKeyDown={e => {
                  if (e.key === 'Escape') { e.preventDefault(); setDraft(null); return; }
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (options.length === 0) return;
                    const step = e.key === 'ArrowDown' ? 1 : options.length - 1;
                    setDraft(current => (current
                      ? { ...current, highlight: (current.highlight + step) % options.length }
                      : current));
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Eerst kiezen, dan bevestigen: zolang de trefferlijst open staat betekent
                    // Enter "deze taak", daarna pas "leg de relatie vast".
                    const option = options[draft.highlight];
                    if (!draft.otherTaskId && option) chooseOption(option);
                    else commitDraft();
                  }
                }}
                className="input !w-full !text-[10px] !px-1 !py-0.5"
              />
              {!draft.otherTaskId && options.length > 0 && (
                <ul className="dependency-draft-options" role="listbox">
                  {options.map((option, index) => (
                    <li key={option.taskId} role="option" aria-selected={index === draft.highlight}>
                      <button
                        type="button"
                        data-ops-dependency-option={index}
                        data-ops-dependency-highlighted={index === draft.highlight || undefined}
                        className="dependency-draft-option"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => chooseOption(option)}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              title={t('properties.addRelationCancel')}
              aria-label={t('properties.addRelationCancel')}
              data-ops-dependency-cancel
              className="dependency-remove-button"
              onClick={() => setDraft(null)}
            >
              <X size={10} />
            </button>
          </div>
          <div className="dependency-row text-[10px]">
            <span className="dependency-wbs-cell min-w-0 truncate">
              {draftOther ? (draftOther.wbsCode || draftOther.name) : t('properties.addRelationPick')}
            </span>
            <span className="dependency-driving-slot" />
            <select
              aria-label={t('relations.type')}
              data-ops-dependency-type
              value={draft.type}
              onChange={e => setDraft(current => (current
                ? { ...current, type: e.target.value as SequenceType }
                : current))}
              className="dependency-type-field input !w-full !text-[10px] !px-1 !py-0.5"
            >
              {SEQUENCE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <SequenceLagInput
              seq={draftSequence}
              title={t('properties.lag')}
              className="dependency-lag-field input !w-full !text-[10px] !px-1 !py-0.5 text-right"
              onCommit={patch => setDraft(current => (current ? { ...current, lag: patch } : current))}
              onDraftChange={patch => setDraft(current => (current ? { ...current, lag: patch } : current))}
            />
            <button
              type="button"
              title={t('properties.addRelationConfirm')}
              aria-label={t('properties.addRelationConfirm')}
              data-ops-dependency-confirm
              disabled={!draft.otherTaskId}
              className="dependency-remove-button justify-self-center"
              style={{ color: draft.otherTaskId ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}
              onClick={commitDraft}
            >
              <Check size={10} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-ops-dependency-add
          className="dependency-add-button"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          <Plus size={10} />
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
