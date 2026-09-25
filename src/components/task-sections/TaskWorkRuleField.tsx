import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import { DEFAULT_WORK_RULE, WORK_RULES, type WorkRule } from '@/types/workRule';
import { effectiveWorkRule, workRuleApplies } from '@/engine/work/workRuleApply';
import { effectiveEffortDriven } from '@/utils/taskDefaults';
import { taskTypesUnlocked } from '@/state/taskTypesVisibility';
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
        className="input !text-small !leading-4 !px-2.5 !py-1.5"
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
      {/* Gebruikstest #170, E5: wat de regel beschermt (en het bewaarde MS Project-vinkje) als één
          gekleurd blok in plaats van een losse regel plus een cursief bijschrift. */}
      <div className="ops-note !mt-1" data-ops-work-rule-note>
        <Lock size={11} aria-hidden />
        <span className="ops-note-lines">
          <span data-ops-work-rule-protects={effective}>
            {t('workRule.protects', { what: t(`workRule.protects${effective}`) })}
          </span>
          {effortDriven !== undefined && (
            <span data-ops-work-rule-msp>
              {t(effortDriven ? 'workRule.mspEffortDriven' : 'workRule.mspNotEffortDriven')}
            </span>
          )}
        </span>
      </div>
    </Field>
  );
}
