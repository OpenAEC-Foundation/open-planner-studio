import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { taskHasActiveTimephasedSteering, taskHasTimephasedContours } from '@/utils/taskDefaults';
import { MPP_TIMEPHASED_HELP_ARTICLE_ID } from '@/state/helpArticles';

/**
 * MSP-herkomstmarkering op het eigenschappenpaneel. Twee toestanden,
 * op dezelfde velden als `taskDefaults.ts`'s `clearTimephasedWindow`/`clearTimephasedDurationWalks`
 * leunen:
 *  - ACTIEVE sturing (laag 3 en/of laag 4 nog gezet) — "volgt de urenverdeling uit MS Project".
 *  - LOSGELATEN sturing: de rauwe `timephasedContours` staan er nog (het bronbestand verliest nooit
 *    iets), maar de AFGELEIDE sturing is ná een bewerking gewist —
 *    "niet meer toegepast".
 * Geen van beide ⇒ geen MSP-herkomst op deze taak, niets renderen.
 *
 * Stijl: het `alert`-infoblok (`globals.css`), `alert--info` (actief, oranje, een NEUTRALE/positieve
 * info-toestand — geen fout) resp. `alert--neutral` (losgelaten of eigen verdeling, grijs, puur
 * informatief). Kleuren alleen uit het thema.
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

  // Derde toestand: contouren zónder MS Project-herkomst (geen enkele
  // contour draagt een `resourceUid`: een eigen verdeling uit het contourvenster, of een
  // P6-import). Daar is niets "losgelaten"; het is gewoon een taak met eigen urenverdelingen.
  // Heuristiek op `resourceUid` (alleen de .mpp-/MSPDI-lezers zetten die) — geen apart veld, dus
  // geen IFC-round-trip-impact.
  const mspOrigin = (task.timephasedContours ?? []).some(c => c.resourceUid !== null);
  const state: 'active' | 'lost' | 'contoured' = active ? 'active' : mspOrigin ? 'lost' : 'contoured';
  const label = state === 'active'
    ? t('properties.timephasedActive')
    : state === 'lost' ? t('properties.timephasedLost') : t('properties.timephasedContoured');

  // Infoblok over de volle breedte, zoals `TaskRecordedDatesNotice` (eigenaar, 2026-10-17): de
  // zin van 'lost' liep als badge buiten het paneel.
  return (
    <div className={`alert ${state === 'active' ? 'alert--info' : 'alert--neutral'} flex flex-col items-start gap-1 break-words`} data-ops-task-timephased={state}>
      <span>{label}</span>
      <button
        type="button"
        className="ops-textlink !text-body"
        onClick={() => openHelpArticle(MPP_TIMEPHASED_HELP_ARTICLE_ID)}
      >
        {tCommon('notifications.readMore')}
      </button>
    </div>
  );
}
