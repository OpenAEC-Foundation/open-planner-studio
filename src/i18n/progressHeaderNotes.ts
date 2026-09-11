// UI-laag-helper (issue #27, punt D, besluit 2026-09-05): het slanke voortgangsblad
// (`writeProgressSheetCSV`) draagt per kolom een invulinstructie, in de ACTIEVE UI-taal. De
// schrijver zelf blijft puur (geen i18n-afhankelijkheid in `services/`) — deze module bouwt de
// vertaalde teksten op vanuit `menu:export.progressCsvNotes.*` en levert ze als
// `Partial<Record<ProgressSheetColumnKey, string>>`, precies wat `writeProgressSheetCSV` verwacht.
// Zelfde patroon als `buildImportLabels` (`importLabels.ts`): een minimale `t`-functie in, al
// GESCOPED op de `menu`-namespace door de aanroeper (zowel de React-hook-`t` via
// `useTranslation('menu')` als een handmatige `(key) => i18n.t(key, { ns: 'menu' })`-wrapper voor
// niet-React call-sites voldoen) — zodat `ImportLabelT` hier bruikbaar blijft (die neemt maar één
// argument, geen los `options`-object per aanroep).
import type { ProgressSheetColumnKey } from '@/services/csv/csvWriter';
import type { ImportLabelT } from './importLabels';

export function buildProgressHeaderNotes(t: ImportLabelT): Partial<Record<ProgressSheetColumnKey, string>> {
  const readOnly = t('export.progressCsvNotes.readOnly');
  const plannedReadOnly = t('export.progressCsvNotes.plannedReadOnly');
  return {
    'OPS Task ID': readOnly,
    WBS: readOnly,
    Name: readOnly,
    Start: plannedReadOnly,
    Finish: plannedReadOnly,
    'Completion (%)': t('export.progressCsvNotes.completion'),
    'Actual Start': t('export.progressCsvNotes.actualStart'),
    'Actual Finish': t('export.progressCsvNotes.actualFinish'),
  };
}
