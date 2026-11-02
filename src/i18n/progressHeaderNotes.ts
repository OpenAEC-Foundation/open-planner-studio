// UI-laag-helper: het voortgangsblad (`writeProgressSheetXLSX`) draagt per kolom een invulinstructie,
// in de ACTIEVE UI-taal. De schrijver zelf blijft puur (geen i18n-afhankelijkheid in `services/`) —
// deze module bouwt de vertaalde teksten op vanuit `menu:export.progressXlsxNotes.*`. Zelfde patroon
// als `buildImportLabels` (`importLabels.ts`): een minimale `t`-functie in, al GESCOPED op de
// `menu`-namespace door de aanroeper.
import type { ProgressSheetColumnKey } from '@/services/xlsx/writeProgressXlsx';
import type { ImportLabelT } from './importLabels';

export function buildProgressHeaderNotes(t: ImportLabelT): Partial<Record<ProgressSheetColumnKey, string>> {
  const readOnly = t('export.progressXlsxNotes.readOnly');
  const plannedReadOnly = t('export.progressXlsxNotes.plannedReadOnly');
  return {
    'OPS Task ID': readOnly,
    WBS: readOnly,
    Name: readOnly,
    Start: plannedReadOnly,
    Finish: plannedReadOnly,
    'Completion (%)': t('export.progressXlsxNotes.completion'),
    'Actual Start': t('export.progressXlsxNotes.actualStart'),
    'Actual Finish': t('export.progressXlsxNotes.actualFinish'),
    'OPS Export': readOnly,
  };
}

/**
 * Markeertekst voor de drie INVULcellen van een verzameltaak in het voortgangsblad. Begint bewust
 * met een em-dash (U+2014): dat is het teken waarop `finalizeProgressRows` de cel als afwezig telt,
 * zodat een ongewijzigd teruggestuurd blad geen enkele weigering oplevert. De vertalingen staan
 * onder `menu:export.progressXlsxNotes.summaryRow` en beginnen alle met diezelfde em-dash.
 */
export function buildProgressSummaryNote(t: ImportLabelT): string {
  return t('export.progressXlsxNotes.summaryRow');
}

/**
 * De vier teksten van de twee `dataValidation`-regels in het `.xlsx`-voortgangsblad:
 * titel + foutmelding voor de percentagekolom (0-100) en voor de twee datumkolommen. Dezelfde
 * teksten dienen ook als validatie-*prompt* (het gele tooltipje bij celselectie) - nul extra
 * sleutels.
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
