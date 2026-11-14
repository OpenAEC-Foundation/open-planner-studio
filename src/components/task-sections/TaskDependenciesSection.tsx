import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { jumpToRelatedTask, relationTrailTarget, stepRelationTrail } from '@/state/relationTrail';
import { Icon } from '@/components/icons';

interface HoverState { x: number; y: number; task: Task; }

/** Richting van de conceptrelatie, gezien vanuit de GEKOZEN taak t.o.v. de huidige taak. */
type DraftDirection = 'predecessor' | 'successor';

interface RelationDraft {
  direction: DraftDirection;
  /** De aangevinkte tegenpartijen, in de volgorde van kiezen (issue #888: meerdere tegelijk). */
  picked: string[];
  /** Staat de trefferlijst open? Dicht na een keuze met Enter; typen opent hem weer. */
  listOpen: boolean;
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
  picked: [],
  listOpen: true,
  query: '',
  highlight: 0,
  type: 'FINISH_START',
  lag: { lagDays: 0 },
};

/**
 * Afhankelijkheden (relatietabel: type + lag + driving-badge + verwijderen) — sectie van
 * `TaskPropertiesPanel`. RELATIONEEL/storeful: roept `updateSequence`/
 * `removeSequence` rechtstreeks aan, identiek in paneel én dialoog (dialoog heeft altijd een
 * bestaand `task.id`).
 *
 * Het WBS-nummer van de gekoppelde taak is een knop (alleen het nummer, geen richtingspijl).
 * Hover toont dezelfde `TaskTooltipContent` als het canvas (via de gedeelde, portal-gebaseerde
 * `HoverTooltip`); klik roept `focusOnTask` aan — selecteert de taak, klapt een ingeklapte
 * oudersketen uit, en laat GanttCanvas ernaartoe zoomen/scrollen. Dat laatste heeft een gemonte
 * `GanttCanvas` nodig om het `pendingFocusTaskId`-signaal ooit op te pikken en te wissen — die
 * garantie geldt alleen in het eigenschappenpaneel (`!isFullPanel`, App.tsx), niet in `TaskDialog`
 * (opent op elk tabblad via F2). `interactive=false` valt daarom
 * terug op platte tekst (taaknaam), zonder knop/hover/klik.
 */
const TYPE_OPTIONS = SEQUENCE_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }));

export function TaskDependenciesSection({ taskId, interactive = true }: { taskId: string; interactive?: boolean }) {
  const { t } = useTranslation('task');
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const cpmResult = useAppStore(s => s.cpmResult);
  const updateSequence = useAppStore(s => s.updateSequence);
  const removeSequence = useAppStore(s => s.removeSequence);
  // Terug en vooruit (issue #888): alleen sprongen via dit paneel tellen, zie `relationTrail.ts`.
  const backId = useAppStore(s => relationTrailTarget(s, 'back'));
  const forwardId = useAppStore(s => relationTrailTarget(s, 'forward'));
  const [hover, setHover] = useState<HoverState | null>(null);
  // De uitlegzin staat alleen onder de relatie waar de focus in zit: onder élke regel zou het blok
  // bij veel relaties twee keer zo lang maken.
  const [focusedSequenceId, setFocusedSequenceId] = useState<string | null>(null);
  // De zin verschijnt en verdwijnt met de focus, en schuift daarmee de regels eronder. Gebeurt dat
  // tussen indrukken en loslaten van de muis, dan landt het loslaten naast de knop en gaat de klik
  // verloren (issue #888: terug, vooruit en verder springen langs de relaties). Daarom wacht een
  // focuswissel met de muis met de zin tot de knop is losgelaten.
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

  // Spooktooltip: onMouseLeave/onClick op de knop zelf zijn niet genoeg. Wisselt de selectie (of
  // verandert de sequence-lijst) zonder dat de muis de knop verlaat — bv. Ctrl+Z, een pijltoets, of
  // de AI-assistent die de selectie verzet — dan blijft de tooltip van de vorige taak zweven, ook over dialogen heen (hij
  // rendert via een portal met een hoge z-index). Elke wissel van context wist 'm daarom expliciet.
  useEffect(() => {
    setHover(null);
  }, [taskId, sequences]);

  // Na een selectiewissel kan de regel met de focus verdwenen zijn zonder blur (React vuurt die niet
  // bij het weghalen), en zou de zin bij een volgende taak met dezelfde relatie blijven staan terwijl
  // de focus elders is. Lees daarom opnieuw welke relatie nu echt de focus heeft.
  useEffect(() => {
    const focused = document.activeElement?.closest<HTMLElement>('[data-ops-sequence-id]');
    setFocusedSequenceId(focused?.dataset.opsSequenceId ?? null);
  }, [taskId]);

  // Conceptrelatie: de sectie kan zelf relaties aanmaken. Het concept blijft LOKAAL tot
  // de bevestiging — dezelfde vorm als `RelationTypePopover` op het canvas — zodat type en lag als
  // één undoable mutatie landen en Escape niets hoeft terug te draaien.
  const [draft, setDraft] = useState<RelationDraft | null>(null);

  // Zelfde reden als de spooktooltip hieronder: een selectiewissel (pijltoets, Ctrl+Z, AI) mag geen
  // half ingevulde conceptrij van de vórige taak laten staan — die zou bij bevestigen op de nieuwe
  // taak landen.
  useEffect(() => {
    setDraft(null);
  }, [taskId]);

  // Alleen zoekinvoer bepaalt de treffers; pijlen, type, richting en lag wijzigen het concept ook.
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

  const pickedTasks = (draft?.picked ?? [])
    .map(id => tasks.find(t => t.id === id))
    .filter((task): task is Task => task !== undefined);
  const draftOther = pickedTasks.length === 1 ? pickedTasks[0] : undefined;
  /** De conceptrelatie met één tegenpartij; type en lag gelden voor elke aangevinkte taak. */
  const draftSequenceWith = (otherId: string): Sequence => ({
    id: 'relation-draft',
    predecessorId: draft?.direction === 'predecessor' ? otherId : taskId,
    successorId: draft?.direction === 'predecessor' ? taskId : otherId,
    type: draft?.type ?? 'FINISH_START',
    ...(draft?.lag ?? { lagDays: 0 }),
  });
  const draftSequence = draftSequenceWith(draftOther?.id ?? '');

  /** Vink een treffer aan of uit. Met `close` (Enter) gaat de lijst dicht en staat de keuze in het
   *  zoekveld, zoals bij één taak; met de muis blijft de lijst open om door te vinken. */
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
    // Alleen wat lukte valt weg: een weigering (duplicaat/voorouder/kring) meldt zichzelf via het
    // gecentraliseerde kanaal en blijft aangevinkt staan, zodat de keuze te corrigeren is.
    const refused = pickedTasks.filter((_task, index) => created[index] === null).map(task => task.id);
    if (refused.length === 0) setDraft(null);
    else setDraft(current => (current ? { ...current, picked: refused } : current));
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
          <span className="dependency-trail">
            <TrailButton direction="back" targetId={backId} />
            <TrailButton direction="forward" targetId={forwardId} />
          </span>
        )}
      </div>
      <div className="dependency-list">
        {taskSequences.map(seq => {
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
                onClick={() => { setHover(null); jumpToRelatedTask(other.id); }}
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
      {interactive && (draft ? (
        <div className="dependency-draft" data-ops-dependency-draft>
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
                  ? { ...current, direction: value as DraftDirection }
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
                    // Eerst kiezen, dan bevestigen: zolang de trefferlijst open staat betekent
                    // Enter "vink deze taak aan", daarna pas "leg de relaties vast".
                    const option = draft.listOpen ? options[draft.highlight] : undefined;
                    if (option && !draft.picked.includes(option.taskId)) toggleOption(option, true);
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
          {/* De lijst staat in de rij en niet erboven: met de muis vink je door, en de knop om vast
              te leggen moet daarbij bereikbaar blijven (schets #888). */}
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

/** Eén pijl van terug/vooruit; grijs zolang er in die richting geen sprong ligt. */
function TrailButton({ direction, targetId }: { direction: 'back' | 'forward'; targetId: string | null }) {
  const { t } = useTranslation('task');
  const target = useAppStore(s => (targetId ? s.tasks.find(task => task.id === targetId) : undefined));
  const label = target
    ? t(direction === 'back' ? 'properties.trailBack' : 'properties.trailForward', {
      task: `${target.wbsCode} ${target.name}`.trim(),
    })
    : t(direction === 'back' ? 'properties.trailBackNone' : 'properties.trailForwardNone');
  return (
    <button
      type="button"
      className="dependency-trail-button"
      data-ops-dependency-trail={direction}
      title={label}
      aria-label={label}
      disabled={!target}
      onClick={() => stepRelationTrail(direction)}
    >
      <Icon id={direction === 'back' ? 'nav.back' : 'nav.forward'} size={12} className="ops-icon-inline-flip" />
    </button>
  );
}
