import { useTranslation } from 'react-i18next';
import { AlertTriangle, CircleDot, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';

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
    // dus in de praktijk is `recordedDates` hier altijd gevuld; de terugval op de tellerloze
    // `recordedDates.active` is defensief.
    return (
      <div
        className="flex items-center gap-3 px-4 py-2 text-xs border-b border-border"
        style={{ background: 'var(--theme-accent-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text)' }}
        role="status"
        data-ops-recorded-dates-active
      >
        <CircleDot size={14} className="shrink-0 text-accent" />
        <span className="flex-1">
          {recordedDates
            ? t('recordedDates.activeCount', { count: recordedDates.shifted })
            : t('recordedDates.active')}
        </span>
        <button
          onClick={() => runCPM()}
          className="btn btn--sm btn--primary"
          data-ops-recorded-dates-recalculate
        >
          {t('recordedDates.recalculate')}
        </button>
      </div>
    );
  }

  if (!recordedDates) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-xs border-b border-border"
      style={{ background: 'var(--theme-accent-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text)' }}
      role="status"
      data-ops-recorded-dates-offer
    >
      <AlertTriangle size={14} className="shrink-0 text-accent" />
      <span className="flex-1">
        {t('recordedDates.offer', { count: recordedDates.shifted, total: recordedDates.total })}
      </span>
      <button
        onClick={() => showRecordedDates()}
        className="btn btn--sm btn--primary"
        data-ops-recorded-dates-show
      >
        {t('recordedDates.show')}
      </button>
      <button
        onClick={() => dismissRecordedDates()}
        className="p-1 hover:bg-surface-hover rounded-[8px] text-text-secondary"
        title={t('close')}
        data-ops-recorded-dates-dismiss
      >
        <X size={14} />
      </button>
    </div>
  );
}
