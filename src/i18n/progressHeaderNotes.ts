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

export function buildProgressSummaryNote(t: ImportLabelT): string {
  return t('export.progressXlsxNotes.summaryRow');
}

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
