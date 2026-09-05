import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { recordedNoticeState } from '@/state/recordedDatesSelectors';

/** Manifest-entry bestaat al (XER-etappeplan laag 3, T7) — `public/docs/{nl,en}/datums-zoals-opgeslagen.md`. */
const RECORDED_DATES_HELP_ARTICLE_ID = 'datums-zoals-opgeslagen';

/**
 * "Datums zoals opgeslagen" (issue #63, XER-etappeplan laag 3, T6) — herkomstmarkering op het
 * eigenschappenpaneel. 1-op-1 gemodelleerd naar `TaskTimephasedNotice.tsx`: puur afgeleid van
 * bestaande documentstate (`recordedDates`/`datesAsRecorded`) via `recordedTaskMark`
 * (`src/state/recordedDatesSelectors.ts`) — geen eigen `Task`-veld, geen `DOCUMENT_FIELDS`-impact.
 *
 * Drie toestanden, in deze volgorde afgewogen:
 *  - 'active' (`badge--blue`, neutrale/positieve infotoestand): de modus staat AAN
 *    (`datesAsRecorded`) én deze taak heeft een vastlegging — het scherm toont Primavera's eigen
 *    datums voor deze taak, niet onze herberekening. Krijgt voorrang boven de andere twee: IN de
 *    modus is "wijkt af" geen zinvol signaal (`recordedTaskMark` levert daar per constructie nooit
 *    `'deviates'`, zie die docstring — het scherm staat immers al gelijk aan de vastlegging).
 *  - 'deviates' (`badge--red`): BUITEN de modus wijkt de vroege start/einde van deze taak af van
 *    wat het bestand vastlegde (`recordedTaskMark` levert hier `'deviates'`).
 *  - 'partly-unrecorded' (`badge--gray`): de vastlegging zelf is onvolledig — een of meer van
 *    laat-start/-einde/totale/vrije speling ontbreekt in het bestand. Geldt in en buiten de modus;
 *    de late-/floatkolommen in de taaktabel tonen dit al per as ("niet vastgelegd" —
 *    `taskColumnRegistry.ts`'s `recordedAxisFormat`), deze badge signaleert het ook hier.
 * Geen vastlegging voor deze taak (`recordedDates?.times[task.id]` ontbreekt) ⇒ niets renderen,
 * byte-identiek stil — zoals `TaskTimephasedNotice` voor een taak zonder MSP-herkomst.
 *
 * Stijlprecedent: dezelfde `badge`-klasse en dezelfde drie kleuren als de bibliotheek-
 * afwijkingsbadges (`ResourcePanel.tsx`) en `TaskTimephasedNotice.tsx`. Geen nieuwe CSS.
 *
 * RELATIONEEL/storeful (zelfde classificatie als `TaskTimephasedNotice`/`TaskFreePeriodWarning`):
 * puur lezend, `taskId`-only.
 */
export function TaskRecordedDatesNotice({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const task = useAppStore(s => s.tasks.find(x => x.id === taskId));
  const recordedDates = useAppStore(s => s.recordedDates);
  const datesAsRecorded = useAppStore(s => s.datesAsRecorded);
  const openHelpArticle = useAppStore(s => s.openHelpArticle);

  if (!task) return null;
  const rec = recordedDates?.times[task.id];
  if (!rec) return null;

  // De keuze zelf staat in `recordedNoticeState` (pure selector, headless getest): in de modus
  // wint "deels niet vastgelegd" van "actief", zodat deze badge en de kolom `recorded.source`
  // over dezelfde taak niet uit elkaar kunnen lopen (critreview laag 3, bevinding 1).
  const state = recordedNoticeState(recordedDates, datesAsRecorded, task);
  if (!state) return null;

  const label = state === 'active'
    ? t('properties.recordedDatesActive')
    : state === 'deviates' ? t('properties.recordedDatesDeviates') : t('properties.recordedDatesPartlyUnrecorded');
  const badgeClass = state === 'active' ? 'badge--blue' : state === 'deviates' ? 'badge--red' : 'badge--gray';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`badge ${badgeClass} shrink-0`}
        title={label}
        data-ops-task-recorded-dates={state}
      >
        {label}
      </span>
      <button
        type="button"
        className="ops-textlink text-[11px]"
        onClick={() => openHelpArticle(RECORDED_DATES_HELP_ARTICLE_ID)}
      >
        {tCommon('notifications.readMore')}
      </button>
    </div>
  );
}
