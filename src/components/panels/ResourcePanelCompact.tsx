import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { UnitsInput } from '@/components/common/UnitsInput';
import { scopeTaskResources } from '@/utils/taskResourceScope';

/**
 * Fase 2.10 (item 6, architect-besluit 6): compacte resource-lijst voor de gedockte rechter-rail
 * (mutueel exclusief met `TaskPropertiesPanel`, zie App.tsx). Bewust een STERK verkorte
 * kolommenset t.o.v. de volledige `ResourcePanel`: alleen naam (readonly hier — hernoemen blijft
 * een taak voor het volledige paneel), max. eenheden (bewerkbaar, zelfde `updateResource`-actie)
 * en een simpele belasting-badge afgeleid uit `resourceLoadResult.overallocatedDays` (dezelfde bron
 * als het histogram) — géén tarief/kalender/eenheid/ouder-bewerking hier.
 */
export function ResourcePanelCompact() {
  const { t } = useTranslation('common');
  const allResources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const updateResource = useAppStore(s => s.updateResource);
  const { resources } = scopeTaskResources(allResources, assignments, selectedTaskIds);

  if (resources.length === 0) {
    return (
      <div className="p-3 text-[11px] text-text-secondary">{t('resource.panel.empty')}</div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 text-[11px]">
      {resources.map(r => {
        const overallocated = (resourceLoadResult?.overallocatedDays[r.id]?.length ?? 0) > 0;
        return (
          <div
            key={r.id}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-[6px] hover:bg-surface-hover"
          >
            <span className="flex-1 truncate" title={r.name || r.id}>{r.name || r.id}</span>
            <UnitsInput
              value={r.maxUnits}
              ariaLabel={t('resource.maxUnits')}
              onCommit={n => updateResource(r.id, { maxUnits: n })}
              // `!w-14` met uitroepteken is hier VERPLICHT: `.input` in globals.css staat buiten elke
              // cascade-layer en zet `width:100%`, terwijl Tailwind-utilities in `@layer utilities`
              // zitten — unlayered CSS wint dus altijd van een kale `w-14`. Zonder `!` wordt de input
              // 100% breed en krimpt de naam-span hiernaast naar 0 px (issue #46a).
              className="input !text-[11px] !px-1 !py-0.5 !w-14 text-right"
              title={t('resource.maxUnits')}
            />
            <span
              title={overallocated ? t('resource.compact.overallocated') : t('ok')}
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: overallocated ? 'var(--error)' : 'var(--success)' }}
            />
          </div>
        );
      })}
    </div>
  );
}
