import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import { DEFAULT_WORK_RULE, WORK_RULES, type WorkRule } from '@/types/workRule';
import { effectiveWorkRule, workRuleApplies } from '@/engine/work/workRuleApply';
import { effectiveEffortDriven } from '@/utils/taskDefaults';
import { taskTypesUnlocked } from '@/state/taskTypesVisibility';
import { Select } from '@/components/common/Select';
import { workRuleExplanation } from './workRuleExplain';
import { Field } from './shared';

export function TaskWorkRuleField({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  const unlocked = useAppStore(s => taskTypesUnlocked(s));
  const defaultRule = useAppStore(s => s.project.defaultWorkRule);
  if (!unlocked || !workRuleApplies(task)) return null;
  const effective = effectiveWorkRule(task, defaultRule);
  const effortDriven = effectiveEffortDriven(task);
  const projectRule = defaultRule ?? DEFAULT_WORK_RULE;
  const explain = (rule: WorkRule): string => {
    const ex = workRuleExplanation(rule, effortDriven);
    return [ex.lead, ...ex.rest].map(s => t(`workRule.explain.${s}`)).join('\n');
  };
  const fieldTip = (rule: WorkRule): string => {
    const ex = workRuleExplanation(rule, effortDriven);
    return [t('workRule.hint.intro'), t(`workRule.hint.${rule}`), ...ex.rest.map(s => t(`workRule.explain.${s}`))].join('\n');
  };
  return (
    <Field label={t('workRule.label')}>
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="min-w-0 flex-1" data-ops-work-rule data-value={task.workRule ?? ''}>
          <Select
            aria-label={t('workRule.label')}
            className="ops-select__trigger--duration"
            value={task.workRule ?? ''}
            onChange={v => onChange({ workRule: v === '' ? undefined : (v as WorkRule) })}
            options={[
              {
                value: '',
                label: t('workRule.projectDefault', { rule: t(`workRule.${projectRule}`) }),
                description: explain(projectRule),
                hint: t('workRule.hint.projectDefault'),
              },
              ...WORK_RULES.map(rule => ({
                value: rule, label: t(`workRule.${rule}`), description: explain(rule), hint: t(`workRule.hint.${rule}`),
              })),
            ]}
          />
        </div>
        <span className="inline-flex aspect-square h-9 shrink-0 self-stretch">
          <button
            type="button"
            className="inline-flex h-full w-full items-center justify-center rounded-[5px] text-text-secondary hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            title={fieldTip(effective)}
            aria-label={t('workRule.info')}
            data-tooltip-instant="true"
            data-tooltip-lead="true"
            data-ops-work-rule-info={effective}
          >
            <Icon id="help.context-hint" size={14} aria-hidden="true" />
          </button>
        </span>
      </div>
    </Field>
  );
}
