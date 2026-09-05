import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import { DEFAULT_WORK_RULE, WORK_RULES, type WorkRule } from '@/types/workRule';
import { effectiveEffortDriven, effectiveWorkRule, workRuleApplies } from '@/engine/work/workRuleApply';
import { taskTypesUnlocked } from '@/engine/work/taskTypesVisibility';
import { Field } from './shared';

/**
 * Taaktypes-etappe (spec 2026-09-04 §7): de WERKREGEL (taaktype) van een taak — welke hoek van
 * werk = restduur × inzet vast staat wanneer een andere verandert. Eén veld voor het instant-apply
 * paneel én de TaskDialog-draft (`onChange({ workRule })`; de store legt via `settleRuleChange`
 * onder een werkbeschermende regel het restwerk vast — besluit 2: geen getal verandert).
 * Zichtbaar wanneer de instelling "Toon taaktypes" aan staat of het document zelf taaktypedata
 * draagt (`taskTypesUnlocked`), en alleen op taken waarop de regel werkt (`workRuleApplies`).
 * Onder de keuzelijst staat in gewone woorden wat de EFFECTIEVE regel beschermt; een bewaard
 * MS Project-vinkje (beslispunt 8-B) staat als bijschrift, geen vinkje.
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
  return (
    <Field label={t('workRule.label')}>
      <select
        className="input !text-xs !px-2.5 !py-1.5"
        value={task.workRule ?? ''}
        aria-label={t('workRule.label')}
        data-ops-work-rule
        onChange={e => onChange({ workRule: e.target.value === '' ? undefined : (e.target.value as WorkRule) })}
      >
        <option value="">{t('workRule.projectDefault', { rule: t(`workRule.${defaultRule ?? DEFAULT_WORK_RULE}`) })}</option>
        {WORK_RULES.map(rule => (
          <option key={rule} value={rule}>{t(`workRule.${rule}`)}</option>
        ))}
      </select>
      <span className="text-[10px] text-text-secondary flex items-center gap-1" data-ops-work-rule-protects={effective}>
        <Lock size={10} />
        {t('workRule.protects', { what: t(`workRule.protects${effective}`) })}
      </span>
      {effortDriven !== undefined && (
        <span className="text-[10px] text-text-secondary italic">
          {t(effortDriven ? 'workRule.mspEffortDriven' : 'workRule.mspNotEffortDriven')}
        </span>
      )}
    </Field>
  );
}
