import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { taskHasActiveTimephasedSteering, taskHasTimephasedContours } from '@/utils/taskDefaults';
import { MPP_TIMEPHASED_HELP_ARTICLE_ID } from '@/state/timephasedLossNotice';

/**
 * mpp-nul-data-etappe, DEEL 2 — MSP-herkomstmarkering op het eigenschappenpaneel. Twee toestanden,
 * op dezelfde velden als `taskDefaults.ts`'s `clearTimephasedWindow`/`clearTimephasedDurationWalks`
 * (DEEL 1) leunen:
 *  - ACTIEVE sturing (laag 3 en/of laag 4 nog gezet) — "volgt de urenverdeling uit MS Project".
 *  - LOSGELATEN sturing: de rauwe `timephasedContours` staan er nog (het bronbestand verliest nooit
 *    iets, eigenaarsprincipe 2026-08-18), maar de AFGELEIDE sturing is ná een bewerking gewist —
 *    "niet meer toegepast".
 * Geen van beide ⇒ geen MSP-herkomst op deze taak, niets renderen (byte-identiek stil).
 *
 * Stijlprecedent: de bibliotheek-afwijkingsbadges in `ResourcePanel.tsx`
 * (`badge badge--red`/`companyLibrary.deviates`/`notInCompany`) — zelfde `badge`-klasse, hier
 * `badge--blue` (actief, een NEUTRALE/positieve info-toestand — geen fout) resp. `badge--gray`
 * (losgelaten, puur informatief verleden-tijd-signaal). Geen nieuwe kleuren, geen eigen CSS.
 *
 * RELATIONEEL/storeful (zelfde classificatie als `TaskFreePeriodWarning`/`TaskCpmResultSection`):
 * puur lezend, `taskId`-only.
 */
export function TaskTimephasedNotice({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const task = useAppStore(s => s.tasks.find(x => x.id === taskId));
  const openHelpArticle = useAppStore(s => s.openHelpArticle);

  if (!task) return null;
  const active = taskHasActiveTimephasedSteering(task);
  const hasContours = taskHasTimephasedContours(task);
  if (!active && !hasContours) return null;

  // Contour-UI (2026-09) — derde toestand: contouren zónder MS Project-herkomst (geen enkele
  // contour draagt een `resourceUid`: een eigen verdeling uit het contourvenster, of een
  // P6-import). Daar is niets "losgelaten"; het is gewoon een taak met eigen urenverdelingen.
  // Heuristiek op `resourceUid` (alleen de .mpp-/MSPDI-lezers zetten die) — geen apart veld, dus
  // geen IFC-round-trip-impact.
  const mspOrigin = (task.timephasedContours ?? []).some(c => c.resourceUid !== null);
  const state: 'active' | 'lost' | 'contoured' = active ? 'active' : mspOrigin ? 'lost' : 'contoured';
  const label = state === 'active'
    ? t('properties.timephasedActive')
    : state === 'lost' ? t('properties.timephasedLost') : t('properties.timephasedContoured');

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`badge ${state === 'active' ? 'badge--blue' : 'badge--gray'} shrink-0`}
        title={label}
        data-ops-task-timephased={state}
      >
        {label}
      </span>
      <button
        type="button"
        className="ops-textlink text-[11px]"
        onClick={() => openHelpArticle(MPP_TIMEPHASED_HELP_ARTICLE_ID)}
      >
        {tCommon('notifications.readMore')}
      </button>
    </div>
  );
}
