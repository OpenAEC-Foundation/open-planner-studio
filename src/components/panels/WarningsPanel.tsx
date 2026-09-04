import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, OctagonAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/hooks/displayDate';
import { formatLagShort } from '@/utils/lagFormat';
import { SEQUENCE_TYPE_OPTIONS } from '@/types/sequence';
import {
  collectScheduleWarnings, summarizeScheduleWarnings, hasScheduleWarningTarget,
  type ScheduleWarning, type ScheduleWarningFacts,
} from '@/engine/scheduler/scheduleWarnings';
import type { Sequence } from '@/types/sequence';
import { revealScheduleWarning } from '@/state/warningNavigation';
import type { Task } from '@/types/task';

/**
 * Waarschuwingenpaneel (issue #53) — de detailweergave achter de tellingen in de statusbalk.
 * Eén lijst met álle actieve waarschuwingen en rule-check-fouten uit de laatste berekening
 * (`cpmResult`) en de belasting (`resourceLoadResult`), elk met een navigeerbaar doel. Klik op een
 * rij = `revealScheduleWarning`: naar de taak springen, de relatie-taken selecteren, of de
 * histogramstrook op de resource zetten. De lijst zelf is een pure afleiding
 * (`collectScheduleWarnings`), gememoiseerd op precies de vijf invoeren — er wordt hier niets
 * herberekend en niets opgeslagen.
 *
 * Verouderd (`scheduleStale`) betekent: de rijen komen van de vórige solve. Dat wordt niet
 * verborgen maar benoemd, met de Bereken-knop ernaast — hetzelfde F5-pad als het lint.
 */
export function WarningsPanel() {
  const { t } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const { t: tMenu } = useTranslation('menu');
  const dd = useDisplayDate();
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const resources = useAppStore(s => s.resources);
  const cpmResult = useAppStore(s => s.cpmResult);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const activeTaskId = useAppStore(s => s.activeTaskId);
  const histogramResourceId = useAppStore(s => s.view.histogramResourceId);
  const runCPM = useAppStore(s => s.runCPM);

  const warnings = useMemo(
    () => collectScheduleWarnings({ tasks, sequences, resources, cpmResult, resourceLoadResult }),
    [tasks, sequences, resources, cpmResult, resourceLoadResult],
  );
  const summary = useMemo(() => summarizeScheduleWarnings(warnings), [warnings]);

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const task of tasks) m.set(task.id, task);
    return m;
  }, [tasks]);
  const seqById = useMemo(() => {
    const m = new Map<string, Sequence>();
    for (const seq of sequences) m.set(seq.id, seq);
    return m;
  }, [sequences]);
  const resourceNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) m.set(r.id, r.name || r.id);
    return m;
  }, [resources]);

  const taskLabel = (taskId: string): string => {
    const task = taskById.get(taskId);
    if (!task) return taskId;
    return task.wbsCode ? `${task.wbsCode} ${task.name}` : task.name;
  };

  const constraintLabel = (facts: ScheduleWarningFacts): string => {
    if (!facts.constraintType) return '';
    const name = tTask(`constraintType.${facts.constraintType}`);
    return facts.constraintDate ? `${name} ${dd.date(facts.constraintDate)}` : name;
  };

  const describe = (w: ScheduleWarning): string => {
    const f = w.facts;
    switch (w.kind) {
      case 'scheduleError': return t('warnings.kind.scheduleError', { message: f.message ?? '' });
      case 'missedDeadline': return t('warnings.kind.missedDeadline', { deadline: dd.date(f.deadline), finish: dd.date(f.finish) });
      case 'violatedConstraint': return t('warnings.kind.violatedConstraint', { constraint: constraintLabel(f) });
      case 'outOfSequence': return t('warnings.kind.outOfSequence');
      case 'truncatedLead': return t('warnings.kind.truncatedLead');
      case 'droppedSequence': return t('warnings.kind.droppedSequence');
      case 'hammockNoFinishDriver': return t('warnings.kind.hammockNoFinishDriver');
      case 'cappedTask': return t('warnings.kind.cappedTask');
      case 'overallocation': return t('warnings.kind.overallocation', {
        count: f.days ?? 0, first: dd.date(f.firstDay), last: dd.date(f.lastDay),
      });
    }
  };

  const targetLabel = (w: ScheduleWarning): string => {
    const tg = w.target;
    switch (tg.type) {
      case 'task': return taskLabel(tg.taskId);
      case 'sequence': {
        const seq = seqById.get(tg.sequenceId);
        const type = seq ? (SEQUENCE_TYPE_OPTIONS.find(o => o.value === seq.type)?.label ?? seq.type) : '';
        const lag = seq ? formatLagShort(seq) : '';
        const relation = t('warnings.target.relation', {
          predecessor: taskLabel(tg.predecessorId), successor: taskLabel(tg.successorId),
        });
        return seq ? `${relation} (${type}${lag})` : relation;
      }
      case 'resource': return resourceNameById.get(tg.resourceId) ?? tg.resourceId;
      case 'project':
        return tg.taskIds.length > 0 ? tg.taskIds.map(taskLabel).join(' → ') : t('warnings.target.project');
    }
  };

  const isCurrent = (w: ScheduleWarning): boolean => {
    const tg = w.target;
    if (tg.type === 'task') return tg.taskId === activeTaskId;
    if (tg.type === 'sequence') return tg.successorId === activeTaskId;
    if (tg.type === 'resource') return tg.resourceId === histogramResourceId;
    return tg.taskIds.length > 0 && tg.taskIds[0] === activeTaskId;
  };

  const onReveal = (w: ScheduleWarning) => revealScheduleWarning(useAppStore.getState(), w);

  return (
    <div className="flex flex-col h-full text-[11px]" data-ops-warnings-panel>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border text-text-secondary flex-shrink-0">
        <span className="flex-1 min-w-0 truncate" data-ops-warnings-summary>
          {cpmResult
            ? t('warnings.summary', { errors: summary.errors, warnings: summary.warnings })
            : t('warnings.noSchedule')}
        </span>
        {scheduleStale && (
          <span
            className="flex items-center gap-1 flex-shrink-0"
            style={{ color: 'var(--theme-warning-text)' }}
            title={t('warnings.stale')}
            data-ops-warnings-stale
          >
            <AlertTriangle size={12} />
          </span>
        )}
        {(scheduleStale || !cpmResult) && (
          <button
            onClick={() => runCPM()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-hover text-text-primary flex-shrink-0"
            title={tMenu('ribbon.calculateTitle')}
          >
            <RefreshCw size={12} />
            <span>{tMenu('ribbon.calculate')}</span>
          </button>
        )}
      </div>

      {cpmResult && warnings.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-3 text-text-secondary" data-ops-warnings-empty>
          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
          <span>{t('warnings.empty')}</span>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto m-0 p-0 list-none" role="list">
          {warnings.map(w => {
            const current = isCurrent(w);
            const error = w.severity === 'error';
            const label = targetLabel(w);
            const navigable = hasScheduleWarningTarget(w);
            const body = (
              <>
                {error
                  ? <OctagonAlert size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--error)' }} />
                  : <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--theme-warning-text)' }} />}
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-text-primary font-medium truncate">{label}</span>
                  <span className="text-text-secondary whitespace-normal break-words">{describe(w)}</span>
                </span>
              </>
            );
            return (
              <li key={w.id} className="border-b border-border">
                {navigable ? (
                  <button
                    onClick={() => onReveal(w)}
                    aria-current={current ? 'true' : undefined}
                    className={`w-full text-left flex items-start gap-2 px-3 py-1.5 hover:bg-surface-hover${current ? ' bg-surface-hover' : ''}`}
                    title={t('warnings.goTo', { target: label })}
                    data-ops-warning-id={w.id}
                    data-ops-warning-kind={w.kind}
                  >
                    {body}
                  </button>
                ) : (
                  // Een solverfout zonder doel (kalender zonder werkdagen, ongeldige datum): niets om
                  // naartoe te springen, dus ook geen knop die dat belooft.
                  <div
                    className="w-full text-left flex items-start gap-2 px-3 py-1.5"
                    data-ops-warning-id={w.id}
                    data-ops-warning-kind={w.kind}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
