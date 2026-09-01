import { useEffect, useMemo, useState } from 'react';
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

/** Fixronde bevinding 1: een blad van een ANDER project maakt alle rijen unmatched — tot
 *  `PROGRESS_IMPORT_LIMITS.maxRows` (50.000). Zonder grens rendert elke sectie evenveel DOM-knopen
 *  (en "wacht op koppeling"/"betwijfeld" evenveel `ProgressImportLinkPicker`s), wat de dialoog
 *  bevriest. Cap per sectie, met een tellerregel voor de rest — nieuwe sleutel `moreRows`. */
const MAX_RENDERED_ROWS = 200;

function capRows<T>(rows: readonly T[]): { shown: readonly T[]; hiddenCount: number } {
  if (rows.length <= MAX_RENDERED_ROWS) return { shown: rows, hiddenCount: 0 };
  return { shown: rows.slice(0, MAX_RENDERED_ROWS), hiddenCount: rows.length - MAX_RENDERED_ROWS };
}

/** Datumveld → weergavewaarde (A5.5): ALTIJD voluit via `formatDisplayDate`, nooit de rauwe ISO-string
 *  als enige weergave. Draagt de waarde een tijddeel, dan komt dat erachter. Ook gebruikt voor de
 *  datumvolgorde-vraag (fixronde bevinding 2): `DateOrderDetection.sampleAlternatives` draagt twee
 *  ISO-datums, geen kant-en-klare weergavetekst — die formatteren we hier locale-bewust. */
function formatIsoForDisplay(iso: string, locale: string): string {
  const datePart = iso.slice(0, 10);
  const timePart = iso.length > 10 ? iso.slice(11, 16) : '';
  const dateLabel = formatDisplayDate(parseDate(datePart), locale);
  return timePart ? `${dateLabel} ${timePart}` : dateLabel;
}

/** Fixronde bevinding 6: hele procenten blijven "33%", maar een significant verschil (33,4% vs 33%)
 *  mag niet tot dezelfde tekst afronden — één decimaal, met het decimaalteken van de locale
 *  (`Intl.NumberFormat` laat een overbodige ",0"/".0" vanzelf weg via het `0`-minimum). */
function formatPercent(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function formatChangeValue(
  field: ProgressFieldChange['field'],
  value: string | number | undefined,
  locale: string,
  emptyLabel: string,
): string {
  if (value === undefined) return emptyLabel;
  if (field === 'completion') return formatPercent(value as number, locale);
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

  // Fixronde bevinding 7: de component blijft permanent gemount (net als PoolImportDialog), dus
  // ALLEEN `close()` wiste voorheen deze state. `resetDocumentScopedUI` kan `showProgressImportDialog`
  // echter ook buiten `close()` om op false zetten (het vangnet bij een documentwissel-route die we
  // gemist zouden hebben — A12 maakt de normale routes al onmogelijk, maar het vangnet moet wél
  // veilig zijn als hij ooit afgaat). Zonder deze reset zou een latere heropening — in een ANDER
  // document — de oude preview van het vorige bestand tonen. Reset daarom op elke false→true-
  // overgang, niet alleen op een expliciete klik op Annuleren/Sluiten.
  useEffect(() => {
    if (!open) return;
    setStage('pick');
    setFileIssue(null);
    setSheet(null);
    setDetection(null);
    setRows(null);
    setOverrides(new Map());
    setEditingRows(new Set());
    setResult(null);
  }, [open]);

  // Fixronde bevinding 1: NIET meer in de render-body — dat riep `previewProgressImport` (tot 50.000
  // rijen) bij ELKE render van deze component opnieuw aan, ook voor wijzigingen die het plan niet
  // raken (bv. de tekst in een koppelkiezer typen elders). `previewProgressImport` leest de taken
  // intern live uit de store, maar `tasks` hoort BEWUST niet in de deps: zolang deze dialoog openstaat
  // is een documentwissel onmogelijk (A12) en loopt ook de MCP-bridge tegen dezelfde blokkade aan
  // (`hasBlockingDialogOpen`), dus er is geen route waarlangs `s.tasks` kan veranderen terwijl dit
  // gememoïseerde plan leeft.
  const plan = useMemo(
    () => (stage === 'preview' && rows ? previewProgressImport(rows, overrides) : null),
    [stage, rows, overrides, previewProgressImport],
  );

  const takenTaskIds = useMemo(() => {
    const ids = new Set<string>();
    if (plan) for (const row of plan.rows) if (row.taskId) ids.add(row.taskId);
    return ids;
  }, [plan]);

  const needsLinkRows = useMemo(
    () => (plan ? plan.rows.filter(r => r.reason === 'unmatched' || r.reason === 'ambiguousWbs') : []),
    [plan],
  );
  const doubtfulRows = useMemo(() => (plan ? plan.rows.filter(r => r.needsConfirmation) : []), [plan]);
  const generalRows = useMemo(
    () => (plan
      ? plan.rows.filter(r => r.outcome !== 'noop' && !r.needsConfirmation && r.reason !== 'unmatched' && r.reason !== 'ambiguousWbs')
      : []),
    [plan],
  );

  if (!open) return null;

  const close = () => {
    setUI({ showProgressImportDialog: false });
  };

  const pick = async () => {
    setFileIssue(null);
    // Fixronde bevinding 5: geen rood pad — een throw uit `openFileDialog`/`parseProgressCsv` (bv.
    // een geweigerde bestandspermissie, of onverwachte inhoud die de parser zelf niet als `fileIssue`
    // afvangt) verdween voorheen als onafgehandelde promise-rejection, zonder enige melding.
    try {
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
    } catch {
      setFileIssue('unreadable');
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

  // Fixronde bevinding 1: per sectie hooguit `MAX_RENDERED_ROWS` DOM-rijen (en bij "wacht op
  // koppeling"/"betwijfeld" evenveel `ProgressImportLinkPicker`s) — plain data-afleidingen, geen
  // hooks nodig; `needsLinkRows`/`doubtfulRows`/`generalRows` zijn zelf al gememoïseerd hierboven.
  const cappedNeedsLink = capRows(needsLinkRows);
  const cappedDoubtful = capRows(doubtfulRows);
  const cappedGeneral = capRows(generalRows);
  const refusedResultRows = result ? result.rows.filter(r => r.outcome === 'refused') : [];
  const cappedRefusedResult = capRows(refusedResultRows);

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
                {t('progressImport.dateOrderOptionA', { date: formatIsoForDisplay(detection.sampleAlternatives[0], i18n.language) })}
              </button>
              <button onClick={() => chooseOrder('mdy')} className="btn btn--sm btn--secondary self-start">
                {t('progressImport.dateOrderOptionB', { date: formatIsoForDisplay(detection.sampleAlternatives[1], i18n.language) })}
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
                {cappedNeedsLink.shown.map(row => {
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
                        currentTaskId={row.taskId}
                        onChange={taskId => setOverride(row.rowNumber, taskId)}
                      />
                    </div>
                  );
                })}
                {cappedNeedsLink.hiddenCount > 0 && (
                  <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedNeedsLink.hiddenCount })}</span>
                )}
              </div>
            )}

            {doubtfulRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">{t('progressImport.sectionDoubtful')}</p>
                {cappedDoubtful.shown.map(row => (
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
                        currentTaskId={row.taskId}
                        onChange={taskId => pickAndClosePicker(row.rowNumber, taskId)}
                      />
                    )}
                  </div>
                ))}
                {cappedDoubtful.hiddenCount > 0 && (
                  <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedDoubtful.hiddenCount })}</span>
                )}
              </div>
            )}

            {generalRows.length > 0 && (
              <div className="flex flex-col gap-2">
                {cappedGeneral.shown.map(row => (
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
                {cappedGeneral.hiddenCount > 0 && (
                  <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedGeneral.hiddenCount })}</span>
                )}
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
            {cappedRefusedResult.shown.map(row => (
              <div key={row.rowNumber} className="flex flex-col gap-1 border border-border rounded-[10px] p-2.5">
                <span className="text-text-secondary">#{row.rowNumber} — {row.taskLabel ?? ''}</span>
                {row.reason && <span style={{ color: 'var(--error)' }}>{t(`progressImport.reason.${row.reason}`)}</span>}
              </div>
            ))}
            {cappedRefusedResult.hiddenCount > 0 && (
              <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedRefusedResult.hiddenCount })}</span>
            )}
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
