import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import { DEFAULT_WORK_RULE, WORK_RULES, type WorkRule } from '@/types/workRule';
import { effectiveWorkRule, workRuleApplies } from '@/engine/work/workRuleApply';
import { effectiveEffortDriven } from '@/utils/taskDefaults';
import { taskTypesUnlocked } from '@/state/taskTypesVisibility';
import { Select } from '@/components/common/Select';
import { workRuleExplanation } from './workRuleExplain';
import { Field } from './shared';

/**
 * De WERKREGEL (taaktype) van een taak — welke hoek van
 * werk = restduur × inzet vast staat wanneer een andere verandert. Eén veld voor het instant-apply
 * paneel én de TaskDialog-draft (`onChange({ workRule })`; de store legt via `settleRuleChange`
 * onder een werkbeschermende regel het restwerk vast — geen getal verandert).
 * Zichtbaar wanneer de instelling "Toon taaktypes" aan staat of het document zelf taaktypedata
 * draagt (`taskTypesUnlocked`), en alleen op taken waarop de regel werkt (`workRuleApplies`).
 *
 * Eigen keuzelijst (nooit native, besluit eigenaar 2026-10-15). Elke optie heeft een i-icoon met de
 * uitleg van die regel; het i-icoon naast het gesloten veld legt de regel uit die NU geldt (bij
 * *Projectstandaard* de regel waar die naar verwijst). De uitleg houdt rekening met het bewaarde
 * MS Project-vinkje (`effortDriven`); zie `workRuleExplain.ts` en de check ernaast.
 */
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
  // Elke zin op een eigen regel (`\n`), de eerste vet (`data-tooltip-lead`). Geen spatie tussen
  // zinnen: die is taalafhankelijk (zh/ja kennen hem niet).
  const explain = (rule: WorkRule): string => {
    const ex = workRuleExplanation(rule, effortDriven);
    return [ex.lead, ...ex.rest].map(s => t(`workRule.explain.${s}`)).join('\n');
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
              },
              ...WORK_RULES.map(rule => ({ value: rule, label: t(`workRule.${rule}`), description: explain(rule) })),
            ]}
          />
        </div>
        {/* i-icoon naast het gesloten veld, zoals bij *Duur*: de uitleg van de regel die nu geldt. */}
        {/* Zelfde omhulling als het i-icoon bij *Duur* (`TaskDurationField`): vierkant zo hoog als het veld.
            `h-9` = de hoogte van de trigger (`ops-select__trigger--duration`, 2.25rem): zonder vaste hoogte
            rekent Chrome de breedte uit vóór het oprekken en blijft het vlak 14 px breed. */}
        <span className="inline-flex aspect-square h-9 shrink-0 self-stretch">
          <button
            type="button"
            className="inline-flex h-full w-full items-center justify-center rounded-[5px] text-text-secondary hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            title={explain(effective)}
            aria-label={t('workRule.info')}
            data-tooltip-instant="true"
            data-tooltip-lead="true"
            data-ops-work-rule-info={effective}
          >
            <Info size={14} aria-hidden="true" />
          </button>
        </span>
      </div>
    </Field>
  );
}
