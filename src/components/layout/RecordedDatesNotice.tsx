import { useTranslation } from 'react-i18next';
import { CircleDot } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { NoticeStrip } from './NoticeStrip';
import { recordedDatesActiveKey } from './recordedDatesNoticeText';

/**
 * Strook voor "datums zoals opgeslagen". Naar het model van `DependencyModeNotice` (modus zonder
 * kruisje). Alleen de MODUS ACTIEF (`datesAsRecorded`): de opgeslagen datums staan op het scherm,
 * er is niet herberekend. Bewust GEEN kruisje: een modus mag niet wegklikbaar zijn zonder hem te
 * verlaten (dezelfde regel als `DependencyModeNotice`) — "Herberekenen" is de enige uitgang, en die
 * roept exact `runCPM()` aan, dus dezelfde store-actie en dezelfde undo-stap als F5.
 *
 * Er is geen AANBOD-stand meer (eigenaar, 2026-10-17, optie 1): buiten de modus vergeet de app de
 * opgeslagen datums (`applyRecordedDatesOnLoad`).
 *
 * Gemonteerd boven de `activeTab === 'file'`-vertakking in `App.tsx`, dus zichtbaar in élke
 * weergave (Gantt, tabel, rapport, Backstage) — niet alleen waar de balken staan.
 */
export function RecordedDatesNotice() {
  const { t } = useTranslation('common');
  const recordedDates = useAppStore((s) => s.recordedDates);
  const datesAsRecorded = useAppStore((s) => s.datesAsRecorded);
  const runCPM = useAppStore((s) => s.runCPM);

  if (!datesAsRecorded) return null;

  // De strook noemt het aantal, ongeacht bronformaat — de bron-orakel-route (XER) en de algemene
  // route (elk ander formaat) delen dezelfde state. `runCPM` wist
  // `recordedDates` pas bij het VERLATEN van de modus (zelfde producer als `datesAsRecorded`),
  // dus `recordedDates` is hier altijd gevuld. De tellerloze `recordedDates.active` is de tak
  // voor een SLAPEND hersteld document (`applyRestoredRecordedMode`): dat staat in de modus
  // zonder ooit gesolved te zijn, dus `shifted` bestaat daar niet — en wordt niet verzonnen.
  //
  // De strook is GEDEELD met de algemene route voor elk ander formaat
  // (IFC/CSV/MSPDI/MPP/P6XML), waar "Primavera" een verkeerde bewering zou zijn. De keuze zelf
  // staat in de React-vrije `recordedDatesActiveKey` zodat ze headless getest kan worden.
  return (
    <NoticeStrip
      icon={CircleDot}
      text={recordedDates && recordedDates.shifted !== undefined
        ? t(recordedDatesActiveKey(recordedDates.origin), { count: recordedDates.shifted })
        : t('recordedDates.active')}
      actionLabel={t('recordedDates.recalculate')}
      onAction={() => runCPM()}
      role="status"
      stripProps={{ 'data-ops-recorded-dates-active': true }}
      actionProps={{ 'data-ops-recorded-dates-recalculate': true }}
    />
  );
}
