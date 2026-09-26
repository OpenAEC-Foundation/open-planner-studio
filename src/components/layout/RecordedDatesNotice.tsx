import { useTranslation } from 'react-i18next';
import { AlertTriangle, CircleDot } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { NoticeStrip } from './NoticeStrip';
import { recordedDatesActiveKey } from './recordedDatesNoticeText';

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
    // XER-etappeplan §3.7 punt 2 (taak T4): de MODUS-ACTIEF-stand noemt nu het aantal, ongeacht
    // bronformaat — zowel de bron-orakel-route (XER, die zelf al ín de modus opent) als de
    // bestaande #63-route (elk formaat, via de "Toon"-knop) delen dezelfde state. `runCPM` wist
    // `recordedDates` pas bij het VERLATEN van de modus (zelfde producer als `datesAsRecorded`),
    // dus `recordedDates` is hier altijd gevuld. De tellerloze `recordedDates.active` is de tak
    // voor een SLAPEND hersteld document (`applyRestoredRecordedMode`): dat staat in de modus
    // zonder ooit gesolved te zijn, dus `shifted` bestaat daar niet — en wordt niet verzonnen.
    //
    // Tekstcorrectie (T8, 2026-09-05): de strook is GEDEELD met de #63-route voor elk ander formaat
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

  // Buiten de modus zonder teller kan per constructie niet: `shifted` ontbreekt alleen op een
  // slapend hersteld document dat ín de modus staat (`applyRestoredRecordedMode`), en `runCPM`
  // wist `recordedDates` bij het verlaten van de modus. Niets verzinnen ⇒ dan ook geen aanbod.
  if (!recordedDates || recordedDates.shifted === undefined) return null;

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
