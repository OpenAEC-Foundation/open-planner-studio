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

/**
 * `'csv'` (de standaard) levert de kopinstructies van het CSV-blad; `'xlsx'` wijkt op één punt af.
 *
 * Dat ene punt is de voltooiingskolom. In de CSV vraagt de instructie om HELE getallen — daar is
 * dat de eerlijke vraag, want een CSV kent geen celopmaak en een `33,333333`-achtige waarde uit een
 * spreadsheet-export levert bij het teruglezen alleen maar ruis. Het `.xlsx`-blad heeft wél een
 * echte percentagecel met een `decimal`-validatie tussen 0 en 100, dus daar zou "hele getallen" de
 * invuller onnodig beperken. Eén gedeelde sleutel voor beide zou dus altijd voor één van de twee
 * formaten liegen; daarom `menu:export.progressXlsxNotes.completion` ernaast.
 */
export function buildProgressHeaderNotes(
  t: ImportLabelT,
  variant: 'csv' | 'xlsx' = 'csv',
): Partial<Record<ProgressSheetColumnKey, string>> {
  const readOnly = t('export.progressCsvNotes.readOnly');
  const plannedReadOnly = t('export.progressCsvNotes.plannedReadOnly');
  return {
    'OPS Task ID': readOnly,
    WBS: readOnly,
    Name: readOnly,
    Start: plannedReadOnly,
    Finish: plannedReadOnly,
    'Completion (%)': variant === 'xlsx'
      ? t('export.progressXlsxNotes.completion')
      : t('export.progressCsvNotes.completion'),
    'Actual Start': t('export.progressCsvNotes.actualStart'),
    'Actual Finish': t('export.progressCsvNotes.actualFinish'),
  };
}

/**
 * Markeertekst voor de drie INVULcellen van een verzameltaak in het voortgangsblad (gebruikstest
 * 2026-09-11, fix 1). Begint bewust met een em-dash (U+2014): dat is het teken waarop
 * `finalizeProgressRows` de cel als afwezig telt, zodat een ongewijzigd teruggestuurd blad geen
 * enkele weigering oplevert. De vertalingen staan onder `menu:export.progressCsvNotes.summaryRow`
 * en beginnen alle veertien met diezelfde em-dash.
 */
export function buildProgressSummaryNote(t: ImportLabelT): string {
  return t('export.progressCsvNotes.summaryRow');
}

/**
 * De vier teksten van de twee `dataValidation`-regels in het `.xlsx`-voortgangsblad (X5, T12):
 * titel + foutmelding voor de percentagekolom (0-100) en voor de twee datumkolommen. Q4: dezelfde
 * teksten dienen ook als validatie-*prompt* (het gele tooltipje bij celselectie) - nul extra
 * sleutels voor precies de begeleiding die E8/E9 vragen.
 *
 * Bewust een eigen, structureel gelijk returntype in plaats van `ProgressXlsxText['validation']`
 * te importeren: deze module hoort bij de i18n-laag en mag de (dynamisch geladen) xlsx-chunk niet
 * statisch binnentrekken - precies de reden waarom `writeProgressSheetXLSX` zijn teksten van
 * buiten krijgt.
 */
export interface ProgressXlsxValidationText {
  percentTitle: string;
  percentError: string;
  dateTitle: string;
  dateError: string;
}

export function buildProgressXlsxValidationText(t: ImportLabelT): ProgressXlsxValidationText {
  return {
    percentTitle: t('export.progressXlsxValidation.percentTitle'),
    percentError: t('export.progressXlsxValidation.percentError'),
    dateTitle: t('export.progressXlsxValidation.dateTitle'),
    dateError: t('export.progressXlsxValidation.dateError'),
  };
}
