import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { recordedNoticeState, recordedTaskWillShift, unrecordedAxes } from '@/state/recordedDatesSelectors';
import { recordedDatesTaskMissingKey, recordedDatesTaskShownKey } from '@/components/layout/recordedDatesNoticeText';
import { RECORDED_DATES_HELP_ARTICLE_ID } from '@/state/helpArticles';
import type { RecordedTaskAxis } from '@/types/taskGrid';

/** De ontbrekende assen in gewone woorden: de namen van de bestaande tabelkolommen. */
const AXIS_COLUMN_KEY: Record<RecordedTaskAxis, 'taskGrid.columns.lateStart' | 'taskGrid.columns.lateFinish' | 'taskGrid.columns.totalFloat' | 'taskGrid.columns.freeFloat'> = {
  ls: 'taskGrid.columns.lateStart',
  lf: 'taskGrid.columns.lateFinish',
  tf: 'taskGrid.columns.totalFloat',
  ff: 'taskGrid.columns.freeFloat',
};

/**
 * "Datums zoals opgeslagen" — het infoblok bovenaan de sectie *Tijd* (`TaskTimeFields`), direct
 * boven de datumvelden waar het over gaat. Puur afgeleid van bestaande documentstate
 * (`recordedDates`/`datesAsRecorded`) via `recordedNoticeState` (`src/state/recordedDatesSelectors.ts`)
 * — geen eigen `Task`-veld, geen `DOCUMENT_FIELDS`-impact.
 *
 * Alleen in de modus (er is geen aanbod-stand meer, eigenaar 2026-10-17, optie 1). Twee standen:
 *  - 'active' (`alert--info`, oranje): deze taak toont de datums uit het bestand, niet onze
 *    berekening. Tweede zin per taak: verandert hij bij herberekenen of niet
 *    (`recordedTaskWillShift`, dezelfde meting als de teller in de strook). Onbekend (slapend
 *    hersteld document zonder meting) ⇒ alleen de eerste zin.
 *  - 'partly-unrecorded' (`alert--neutral`, grijs): het bestand legde voor deze taak niet alles vast;
 *    de ontbrekende waarden staan er met de namen van de tabelkolommen bij. Wint van 'active', zodat
 *    dit blok en de kolom `recorded.source` over dezelfde taak niet uit elkaar kunnen lopen.
 * Geen vastlegging voor deze taak ⇒ niets renderen.
 *
 * "Primavera" alleen wanneer de vastlegging echt van P6 komt (`isPrimaveraRecordedOrigin`); anders
 * de neutrale tekst. Zelfde beslisregel als de strook.
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
  const state = recordedNoticeState(recordedDates, datesAsRecorded, task);
  if (!state) return null;
  const origin = recordedDates?.origin;

  // Elke zin een eigen regel: een spatie tussen zinnen is taalafhankelijk (zh/ja kennen hem niet).
  const sentences: string[] = [];
  if (state === 'active') {
    sentences.push(t(recordedDatesTaskShownKey(origin)));
    const willShift = recordedTaskWillShift(recordedDates, datesAsRecorded, task.id);
    if (willShift !== undefined) {
      sentences.push(willShift ? t('properties.recordedDatesWillShift') : t('properties.recordedDatesWillStay'));
    }
  } else {
    const fields = unrecordedAxes(recordedDates?.times[task.id]).map(axis => t(AXIS_COLUMN_KEY[axis])).join(', ');
    sentences.push(t(recordedDatesTaskMissingKey(origin), { fields }));
  }

  // Infoblok over de volle breedte (eigenaar, 2026-10-17): de zin liep als badge buiten het paneel.
  // Zelfde `alert`-patroon als de andere infoblokken; kleur per stand alleen uit het thema.
  return (
    <div
      className={`alert ${state === 'active' ? 'alert--info' : 'alert--neutral'} flex flex-col items-start gap-1 break-words`}
      data-ops-task-recorded-dates={state}
    >
      {sentences.map((sentence, i) => <span key={i} data-ops-task-recorded-dates-sentence={i}>{sentence}</span>)}
      <button
        type="button"
        className="ops-textlink !text-body"
        onClick={() => openHelpArticle(RECORDED_DATES_HELP_ARTICLE_ID)}
      >
        {tCommon('notifications.readMore')}
      </button>
    </div>
  );
}
