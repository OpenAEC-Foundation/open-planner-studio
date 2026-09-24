import { useTranslation } from 'react-i18next';
import { AlertTriangle, CircleDot } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { NoticeStrip } from './NoticeStrip';

/**
 * Strook voor "datums zoals opgeslagen" (issue #63). Naar het model van `DependencyModeNotice`
 * (modus zonder kruisje) én `HourDataNotice` (aanbod mét kruisje) — dit component combineert beide
 * standen omdat ze dezelfde onderliggende state delen (`recordedDates`/`datesAsRecorded`):
 *
 *  - AANBOD (`recordedDates !== null && !datesAsRecorded`): herberekening bij het laden verschoof
 *    datums t.o.v. wat het bestand zei. De gebruiker kan het aanbod afslaan (kruisje — de app werkt
 *    dan gewoon door met de herberekende planning) of de opgeslagen datums terugzetten.
 *  - MODUS ACTIEF (`datesAsRecorded`): de opgeslagen datums staan op het scherm, er is niet
 *    herberekend. Bewust GEEN kruisje: een modus mag niet wegklikbaar zijn zonder hem te verlaten
 *    (dezelfde regel als `DependencyModeNotice`) — "Herberekenen" is de enige uitgang, en die roept
 *    exact `runCPM()` aan, dus dezelfde store-actie en dezelfde undo-stap als F5.
 *
 * Gemonteerd boven de `activeTab === 'file'`-vertakking in `App.tsx`, dus zichtbaar in élke
 * weergave (Gantt, tabel, rapport, Backstage) — niet alleen waar de balken staan.
 */
export function RecordedDatesNotice() {
  const { t } = useTranslation('common');
  const recordedDates = useAppStore((s) => s.recordedDates);
  const datesAsRecorded = useAppStore((s) => s.datesAsRecorded);
  const showRecordedDates = useAppStore((s) => s.showRecordedDates);
  const dismissRecordedDates = useAppStore((s) => s.dismissRecordedDates);
  const runCPM = useAppStore((s) => s.runCPM);

  if (datesAsRecorded) {
    return (
      <NoticeStrip
        icon={CircleDot}
        text={t('recordedDates.active')}
        actionLabel={t('recordedDates.recalculate')}
        onAction={() => runCPM()}
        role="status"
        stripProps={{ 'data-ops-recorded-dates-active': true }}
        actionProps={{ 'data-ops-recorded-dates-recalculate': true }}
      />
    );
  }

  if (!recordedDates) return null;

  return (
    <NoticeStrip
      icon={AlertTriangle}
      text={t('recordedDates.offer', { count: recordedDates.shifted, total: recordedDates.total })}
      actionLabel={t('recordedDates.show')}
      onAction={() => showRecordedDates()}
      onDismiss={() => dismissRecordedDates()}
      role="status"
      stripProps={{ 'data-ops-recorded-dates-offer': true }}
      actionProps={{ 'data-ops-recorded-dates-show': true }}
      dismissProps={{ 'data-ops-recorded-dates-dismiss': true }}
    />
  );
}
