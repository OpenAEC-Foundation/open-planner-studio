import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import { openFileDialog } from '@/services/fileAccess';
import { formatDisplayDate, parseDate } from '@/utils/dateUtils';
import { ProgressImportLinkPicker } from './ProgressImportLinkPicker';
// A9: `parseProgressCsv` is de ENIGE module die van CSV weet; `sheetValues` is bestandsformaat-
// agnostisch. Beide rechtstreeks uit hun eigen bestand — NIET via de barrel (die is van baan A/T1-T3).
import { parseProgressCsv } from '@/services/progressImport/parseProgressCsv';
import { detectDateOrder, finalizeProgressRows } from '@/services/progressImport/sheetValues';
import type {
  DateOrder,
  DateOrderDetection,
  ProgressFieldChange,
  ProgressFileIssue,
  ProgressImportPlan,
  ProgressOverrides,
  ProgressPlanRow,
  ProgressRow,
  ProgressSheet,
} from '@/services/progressImport/types';

type Stage = 'pick' | 'dateOrder' | 'preview' | 'result';

/** T5-signaturen (plan): `previewProgressImport` muteert niets, `applyProgressImport` herberekent
 *  hetzelfde plan tegen de live taken en past het in één undo-stap toe (A4/A8). Expliciet getypeerd
 *  zodat het ONTBREKEN van deze store-acties (baan A, T5 nog te leveren) hier één keer een fout geeft
 *  in plaats van via `any` door te lekken naar elk gebruik van `plan` verderop. */
type ProgressImportPlanFn = (rows: readonly ProgressRow[], overrides?: ProgressOverrides) => ProgressImportPlan;

/** Datumveld → weergavewaarde (A5.5): ALTIJD voluit via `formatDisplayDate`, nooit de rauwe ISO-string
 *  als enige weergave. Draagt de waarde een tijddeel, dan komt dat erachter. */
function formatIsoForDisplay(iso: string, locale: string): string {
  const datePart = iso.slice(0, 10);
  const timePart = iso.length > 10 ? iso.slice(11, 16) : '';
  const dateLabel = formatDisplayDate(parseDate(datePart), locale);
  return timePart ? `${dateLabel} ${timePart}` : dateLabel;
}

function formatChangeValue(
  field: ProgressFieldChange['field'],
  value: string | number | undefined,
  locale: string,
  emptyLabel: string,
): string {
  if (value === undefined) return emptyLabel;
  if (field === 'completion') return `${Math.round((value as number) * 100)}%`;
  return formatIsoForDisplay(value as string, locale);
}

/** Rijnummer → sheetrij, voor de secties die de RUWE bladwaarden tonen (rijen die nog op koppeling
 *  wachten hebben immers geen `taskLabel` — die komt van de gematchte taak). */
function findSheetRow(rows: readonly ProgressRow[] | null, rowNumber: number): ProgressRow | undefined {
  return rows?.find(r => r.rowNumber === rowNumber);
}

/**
 * Issue #27 etappe 2: de voortgangsimportdialoog. Naar het model van `PoolImportDialog` — kies
 * bestand → (indien nodig) datumvolgorde-vraag (E5) → verplichte preview met handmatige koppelkiezer
 * (E3/A11) → expliciete bevestiging → resultaatweergave. Vier toestanden, strikt na elkaar; geen
 * sneltoets eromheen, de preview is niet overslaanbaar.
 *
 * A7: de dialoog draagt zijn eigen resultaat — geen nieuwe `NotificationMessageKey`, geen `notify()`.
 * A8: bewaart het sheet, de gekozen datumvolgorde en de overrides, NIET het plan — `applyProgressImport`
 * herberekent tegen de live taken binnen dezelfde `set()` (drift-bestendig).
 * A12/E4: `showProgressImportDialog` blokkeert een documentwissel volledig (zie shortcutRegistry.ts,
 * useKeyboardShortcuts.ts, runtime.ts, documentSlice.ts) — dit scherm hoeft dus geen state over een
 * documentwissel heen te bewaren; die wissel kan simpelweg niet gebeuren zolang hij openstaat.
 */
export function ProgressImportDialog() {
  const { t, i18n } = useTranslation();
  const open = useAppStore(s => s.ui.showProgressImportDialog);
  const setUI = useAppStore(s => s.setUI);
  const tasks = useAppStore(s => s.tasks);
  // T5 (baan A): nog te leveren store-acties — zie `ProgressImportPlanFn` hierboven.
  const previewProgressImport = useAppStore(s => s.previewProgressImport) as ProgressImportPlanFn;
  const applyProgressImport = useAppStore(s => s.applyProgressImport) as ProgressImportPlanFn;

  const [stage, setStage] = useState<Stage>('pick');
  const [fileIssue, setFileIssue] = useState<ProgressFileIssue | null>(null);
  const [sheet, setSheet] = useState<ProgressSheet | null>(null);
  const [detection, setDetection] = useState<DateOrderDetection | null>(null);
  const [rows, setRows] = useState<readonly ProgressRow[] | null>(null);
  const [overrides, setOverrides] = useState<Map<number, string>>(new Map());
  const [result, setResult] = useState<ProgressImportPlan | null>(null);
  // Puur UI-comfort (niet in de kern, niet in de store): welke "Koppeling betwijfeld"-rijen de
  // kiezer opengeklapt tonen na een klik op "Wijzigen" (T7). Los van `overrides` — "Wijzigen" mag de
  // bestaande koppeling nog niet wissen, alleen de kiezer tonen zodat een andere taak gekozen kan worden.
  const [editingRows, setEditingRows] = useState<Set<number>>(new Set());

  if (!open) return null;

  const close = () => {
    setStage('pick');
    setFileIssue(null);
    setSheet(null);
    setDetection(null);
    setRows(null);
    setOverrides(new Map());
    setEditingRows(new Set());
    setResult(null);
    setUI({ showProgressImportDialog: false });
  };

  const pick = async () => {
    setFileIssue(null);
    const res = await openFileDialog([{ name: 'CSV', extensions: ['csv'] }]);
    if (!res) return;
    const parsed = parseProgressCsv(res.content);
    if (parsed.fileIssue) {
      setFileIssue(parsed.fileIssue);
      return;
    }
    setSheet(parsed);
    const det = detectDateOrder(parsed.detectionCells, tasks);
    setDetection(det);
    if (det.order === 'ambiguous') {
      setStage('dateOrder');
    } else {
      setRows(finalizeProgressRows(parsed, det.order));
      setStage('preview');
    }
  };

  const chooseOrder = (order: DateOrder) => {
    if (!sheet) return;
    setRows(finalizeProgressRows(sheet, order));
    setStage('preview');
  };

  const setOverride = (rowNumber: number, taskId: string) => {
    setOverrides(prev => {
      const next = new Map(prev);
      next.set(rowNumber, taskId);
      return next;
    });
  };

  const clearOverride = (rowNumber: number) => {
    setOverrides(prev => {
      const next = new Map(prev);
      next.delete(rowNumber);
      return next;
    });
  };

  const openPickerFor = (rowNumber: number) => {
    setEditingRows(prev => new Set(prev).add(rowNumber));
  };

  const pickAndClosePicker = (rowNumber: number, taskId: string) => {
    setOverride(rowNumber, taskId);
    setEditingRows(prev => {
      const next = new Set(prev);
      next.delete(rowNumber);
      return next;
    });
  };

  const confirm = () => {
    if (!rows) return;
    setResult(applyProgressImport(rows, overrides));
    setStage('result');
  };

  // A8/A11: herbouwd bij ELKE render tegen de huidige overrides — precedent `isLocalPoolNewer`
  // (librarySlice), een pure lezende actie die de dialoog gewoon in de render-body aanroept.
  const plan = stage === 'preview' && rows ? previewProgressImport(rows, overrides) : null;

  const takenTaskIds = new Set<string>();
  if (plan) for (const row of plan.rows) if (row.taskId) takenTaskIds.add(row.taskId);

  const needsLinkRows = plan ? plan.rows.filter(r => r.reason === 'unmatched' || r.reason === 'ambiguousWbs') : [];
  const doubtfulRows = plan ? plan.rows.filter(r => r.needsConfirmation) : [];
  const generalRows = plan
    ? plan.rows.filter(r => r.outcome !== 'noop' && !r.needsConfirmation && r.reason !== 'unmatched' && r.reason !== 'ambiguousWbs')
    : [];

  const emptyLabel = t('progressImport.empty');

  const renderChanges = (row: ProgressPlanRow) => (
    <ul className="flex flex-col gap-0.5 pl-3 list-disc">
      {row.changes.map(change => (
        <li key={change.field}>
          {t(`progressImport.field.${change.field}`)}:{' '}
          {formatChangeValue(change.field, change.before, i18n.language, emptyLabel)}
          {' → '}
          {formatChangeValue(change.field, change.after, i18n.language, emptyLabel)}
        </li>
      ))}
    </ul>
  );

  const renderRowOutcome = (row: ProgressPlanRow) => {
    if (row.outcome === 'apply') return renderChanges(row);
    if (row.outcome === 'refused' && row.reason) {
      return <span style={{ color: 'var(--error)' }}>{t(`progressImport.reason.${row.reason}`)}</span>;
    }
    // outcome === 'noop': een gekoppelde/betwijfelde rij zonder daadwerkelijke wijziging (A6) — niets
    // te tonen, de taakregel zelf (WBS + naam) staat er al boven.
    return null;
  };

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[720px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-progress-import-dialog': true }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('progressImport.title')}
        </span>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs">
        {stage === 'pick' && (
          <>
            <p>{t('progressImport.intro')}</p>
            <button onClick={() => { void pick(); }} className="btn btn--sm btn--secondary self-start">
              {t('progressImport.chooseFile')}
            </button>
            {fileIssue && (
              <p style={{ color: 'var(--error)' }}>{t(`progressImport.fileIssue.${fileIssue}`)}</p>
            )}
          </>
        )}

        {stage === 'dateOrder' && detection && detection.order === 'ambiguous' && (
          <div className="flex flex-col gap-3">
            <p className="font-medium">{t('progressImport.dateOrderTitle')}</p>
            <p>{t('progressImport.dateOrderQuestion', { sample: detection.sample })}</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => chooseOrder('dmy')} className="btn btn--sm btn--secondary self-start">
                {t('progressImport.dateOrderOptionA', { date: detection.sampleAlternatives[0] })}
              </button>
              <button onClick={() => chooseOrder('mdy')} className="btn btn--sm btn--secondary self-start">
                {t('progressImport.dateOrderOptionB', { date: detection.sampleAlternatives[1] })}
              </button>
            </div>
          </div>
        )}

        {stage === 'preview' && plan && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 border border-border rounded-[10px] p-2.5">
              <span>{t('progressImport.summaryApplied', { applied: plan.appliedCount })}</span>
              <span>{t('progressImport.summaryNoop', { noop: plan.noopCount })}</span>
              <span>{t('progressImport.summaryNeedsLink', { needsLink: plan.needsLinkCount })}</span>
              <span>{t('progressImport.summaryRefused', { refused: plan.refusedCount })}</span>
            </div>

            {plan.ignoredOverrideRows.length > 0 && (
              <div className="alert alert--warning flex flex-col gap-1">
                <AlertTriangle size={16} />
                {plan.ignoredOverrideRows.map(rowNumber => (
                  <span key={rowNumber}>{t('progressImport.overrideDropped', { row: rowNumber })}</span>
                ))}
              </div>
            )}

            {needsLinkRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">{t('progressImport.sectionNeedsLink')}</p>
                {needsLinkRows.map(row => {
                  const sheetRow = findSheetRow(rows, row.rowNumber);
                  return (
                    <div key={row.rowNumber} className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5">
                      <span className="text-text-secondary">
                        #{row.rowNumber} — {sheetRow?.wbsCode ?? ''} {sheetRow?.name ?? ''}
                      </span>
                      <ProgressImportLinkPicker
                        tasks={tasks}
                        takenTaskIds={takenTaskIds}
                        value={overrides.get(row.rowNumber)}
                        onChange={taskId => setOverride(row.rowNumber, taskId)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {doubtfulRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">{t('progressImport.sectionDoubtful')}</p>
                {doubtfulRows.map(row => (
                  <div key={row.rowNumber} className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5">
                    <span className="text-text-secondary">#{row.rowNumber} — {row.taskLabel}</span>
                    {renderRowOutcome(row)}
                    <div className="flex gap-2">
                      <button
                        onClick={() => row.taskId && setOverride(row.rowNumber, row.taskId)}
                        className="btn btn--sm btn--secondary"
                      >
                        {t('progressImport.confirmLink')}
                      </button>
                      <button
                        onClick={() => openPickerFor(row.rowNumber)}
                        className="btn btn--sm btn--secondary"
                      >
                        {t('progressImport.changeLink')}
                      </button>
                    </div>
                    {editingRows.has(row.rowNumber) && (
                      <ProgressImportLinkPicker
                        tasks={tasks}
                        takenTaskIds={takenTaskIds}
                        value={overrides.get(row.rowNumber)}
                        onChange={taskId => pickAndClosePicker(row.rowNumber, taskId)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {generalRows.length > 0 && (
              <div className="flex flex-col gap-2">
                {generalRows.map(row => (
                  <div key={row.rowNumber} className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">#{row.rowNumber} — {row.taskLabel}</span>
                      {overrides.has(row.rowNumber) && (
                        <button onClick={() => clearOverride(row.rowNumber)} className="btn btn--sm btn--secondary">
                          {t('progressImport.clearLink')}
                        </button>
                      )}
                    </div>
                    {renderRowOutcome(row)}
                  </div>
                ))}
              </div>
            )}

            {detection?.order === 'ambiguous' && (
              <button onClick={() => setStage('dateOrder')} className="btn btn--sm btn--secondary self-start">
                {t('progressImport.dateOrderBack')}
              </button>
            )}
          </div>
        )}

        {stage === 'result' && result && (
          <div className="flex flex-col gap-3">
            <p className="font-medium">{t('progressImport.resultTitle')}</p>
            <div className="flex flex-col gap-1 border border-border rounded-[10px] p-2.5">
              <span>{t('progressImport.summaryApplied', { applied: result.appliedCount })}</span>
              <span>{t('progressImport.summaryNoop', { noop: result.noopCount })}</span>
              <span>{t('progressImport.summaryNeedsLink', { needsLink: result.needsLinkCount })}</span>
              <span>{t('progressImport.summaryRefused', { refused: result.refusedCount })}</span>
            </div>
            {result.rows.filter(r => r.outcome === 'refused').map(row => (
              <div key={row.rowNumber} className="flex flex-col gap-1 border border-border rounded-[10px] p-2.5">
                <span className="text-text-secondary">#{row.rowNumber} — {row.taskLabel ?? ''}</span>
                {row.reason && <span style={{ color: 'var(--error)' }}>{t(`progressImport.reason.${row.reason}`)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
        {stage === 'result' ? (
          <button onClick={close} className="btn btn--sm btn--primary">{t('progressImport.close')}</button>
        ) : (
          <>
            <button onClick={close} className="btn btn--sm btn--secondary">{t('cancel')}</button>
            {stage === 'preview' && (
              <button onClick={confirm} disabled={!plan || plan.appliedCount === 0} className="btn btn--sm btn--primary">
                {t('progressImport.confirm')}
              </button>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
