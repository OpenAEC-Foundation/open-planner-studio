import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { openFileDialog } from '@/services/fileAccess';
import { localTodayIso, parseDate } from '@/utils/dateUtils';
import { formatDisplayDate } from '@/i18n/dateFormat';
import { extensionOf } from '@/utils/filePath';
import { ProgressImportLinkPicker } from './ProgressImportLinkPicker';
// `parseProgressCsv` is de ENIGE module die van CSV weet; `sheetValues` is bestandsformaat-
// agnostisch. Beide rechtstreeks uit hun eigen bestand — NIET via de barrel (`index.ts`).
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

/** Signatuur van de store-acties (`taskSlice`): `previewProgressImport` muteert niets,
 *  `applyProgressImport` herberekent hetzelfde plan tegen de live taken en past het in één
 *  undo-stap toe. */
type ProgressImportPlanFn = (
  rows: readonly ProgressRow[],
  overrides?: ProgressOverrides,
  opts?: { today?: string },
) => ProgressImportPlan;

/** Een blad van een ANDER project maakt alle rijen unmatched — tot
 *  `PROGRESS_IMPORT_LIMITS.maxRows` (50.000). Zonder grens rendert elke sectie evenveel DOM-knopen
 *  (en "wacht op koppeling"/"betwijfeld" evenveel `ProgressImportLinkPicker`s), wat de dialoog
 *  bevriest. Cap per sectie, met een tellerregel voor de rest (sleutel `moreRows`). */
const MAX_RENDERED_ROWS = 200;

function capRows<T>(rows: readonly T[]): { shown: readonly T[]; hiddenCount: number } {
  if (rows.length <= MAX_RENDERED_ROWS) return { shown: rows, hiddenCount: 0 };
  return { shown: rows.slice(0, MAX_RENDERED_ROWS), hiddenCount: rows.length - MAX_RENDERED_ROWS };
}

/** Datumveld → weergavewaarde: ALTIJD voluit via `formatDisplayDate`, nooit de rauwe ISO-string
 *  als enige weergave. Draagt de waarde een tijddeel, dan komt dat erachter. Ook gebruikt voor de
 *  datumvolgorde-vraag: `DateOrderDetection.sampleAlternatives` draagt twee
 *  ISO-datums, geen kant-en-klare weergavetekst — die formatteren we hier locale-bewust. */
function formatIsoForDisplay(iso: string, locale: string): string {
  const datePart = iso.slice(0, 10);
  const timePart = iso.length > 10 ? iso.slice(11, 16) : '';
  const dateLabel = formatDisplayDate(parseDate(datePart), locale);
  return timePart ? `${dateLabel} ${timePart}` : dateLabel;
}

/** Hele procenten blijven "33%", maar een significant verschil (33,4% vs 33%)
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
 * De voortgangsimportdialoog. Naar het model van `PoolImportDialog` — kies
 * bestand → (indien nodig) datumvolgorde-vraag → verplichte preview met handmatige koppelkiezer
 * → expliciete bevestiging → resultaatweergave. Vier toestanden, strikt na elkaar; geen
 * sneltoets eromheen, de preview is niet overslaanbaar.
 *
 * De dialoog draagt zijn eigen resultaat — geen `NotificationMessageKey`, geen `notify()`.
 * Bewaart het sheet, de gekozen datumvolgorde en de overrides, NIET het plan — `applyProgressImport`
 * herberekent tegen de live taken binnen dezelfde `set()` (drift-bestendig).
 * `showProgressImportDialog` blokkeert een documentwissel volledig (zie shortcutRegistry.ts,
 * useKeyboardShortcuts.ts, runtime.ts, documentSlice.ts) — dit scherm hoeft dus geen state over een
 * documentwissel heen te bewaren; die wissel kan simpelweg niet gebeuren zolang hij openstaat.
 */
export function ProgressImportDialog() {
  const { t, i18n } = useTranslation();
  const open = useAppStore(s => s.ui.showProgressImportDialog);
  const setUI = useAppStore(s => s.setUI);
  const tasks = useAppStore(s => s.tasks);
  // Store-acties — zie `ProgressImportPlanFn` hierboven.
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
  // kiezer opengeklapt tonen na een klik op "Wijzigen". Los van `overrides` — "Wijzigen" mag de
  // bestaande koppeling nog niet wissen, alleen de kiezer tonen zodat een andere taak gekozen kan worden.
  const [editingRows, setEditingRows] = useState<Set<number>>(new Set());

  // Gememoïseerd, NIET in de render-body: `previewProgressImport` (tot 50.000 rijen) hoort niet bij
  // elke render opnieuw te lopen (typen in een koppelkiezer is child-state van
  // `ProgressImportLinkPicker` en kost zo geen herberekening).
  //
  // `tasks` staat WEL in de deps: de documentwisselblokkade geldt niet voor `edit.undo`/`edit.redo`
  // (geen `when`-guard), die `s.tasks` muteren terwijl deze dialoog open staat. Zonder `tasks` blijft
  // het plan na Ctrl+Z/Ctrl+Y op de oude taken staan. `tasks` wordt niet TEKSTUEEL gebruikt in de
  // closure hieronder (dat gebeurt binnen `previewProgressImport` zelf, via de store); de linter
  // kan die indirecte afhankelijkheid niet zien, vandaar de gerichte suppressie hieronder.
  const plan = useMemo(
    // UI-route: `today` zet dezelfde voortgangsregels aan als paneel en
    // raster — zonder statusdatum op vandaag, geen verzonnen werkelijke start (`ProgressImportEntryOptions`).
    () => (stage === 'preview' && rows ? previewProgressImport(rows, overrides, { today: localTodayIso() }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage, rows, overrides, tasks, previewProgressImport],
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
    // Geen stil rood pad — een throw uit `openFileDialog`/de lezer (bv.
    // een geweigerde bestandspermissie, of onverwachte inhoud die de parser zelf niet als `fileIssue`
    // afvangt) zou anders een onafgehandelde promise-rejection zijn, zonder enige melding.
    try {
      // De dialoog accepteert beide voortgangsformaten. `binaryExtensions` zorgt dat een
      // `.xlsx` als bytes binnenkomt; de dispatch gaat op de EXTENSIE en niet op
      // `res.bytes !== undefined` — `bytes` is een gevolg van die optie, niet een eigenschap van
      // het bestand, dus duck-typen zou een vergeten optie stil de CSV-lezer op binaire rommel
      // zetten. De xlsx-lezer laadt dynamisch: de ZIP/XLSX-code hoort niet in de hoofdbundel.
      const res = await openFileDialog(
        [{ name: 'Progress sheet', extensions: ['xlsx', 'csv'] },
         { name: 'Excel Workbook', extensions: ['xlsx'] },
         { name: 'CSV Files', extensions: ['csv'] }],
        { binaryExtensions: ['xlsx'] },
      );
      if (!res) return;
      let parsed: ProgressSheet;
      if (extensionOf(res.name) === 'xlsx') {
        // Geen bytes terwijl de extensie `.xlsx` zegt ⇒ onleesbaar, nooit een gok.
        if (!res.bytes) { setFileIssue('unreadable'); return; }
        const { parseProgressXlsx } = await import('@/services/progressImport/parseProgressXlsx');
        parsed = await parseProgressXlsx(res.bytes);
      } else {
        parsed = parseProgressCsv(res.content);
      }
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
    setResult(applyProgressImport(rows, overrides, { today: localTodayIso() }));
    setStage('result');
  };

  // Per sectie hooguit `MAX_RENDERED_ROWS` DOM-rijen (en bij "wacht op
  // koppeling"/"betwijfeld" evenveel `ProgressImportLinkPicker`s) — plain data-afleidingen, geen
  // hooks nodig; `needsLinkRows`/`doubtfulRows`/`generalRows` zijn zelf al gememoïseerd hierboven.
  const cappedNeedsLink = capRows(needsLinkRows);
  const cappedDoubtful = capRows(doubtfulRows);
  const cappedGeneral = capRows(generalRows);
  const refusedResultRows = result ? result.rows.filter(r => r.outcome === 'refused') : [];
  const cappedRefusedResult = capRows(refusedResultRows);

  const emptyLabel = t('progressImport.empty');

  const renderChanges = (row: ProgressPlanRow) => (
    <ul className="flex flex-col gap-0.5 pl-4 list-disc text-text-secondary">
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
    // outcome === 'noop': een gekoppelde/betwijfelde rij zonder daadwerkelijke wijziging — niets
    // te tonen, de taakregel zelf (WBS + naam) staat er al boven.
    return null;
  };

  return (
    <Dialog
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[720px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-progress-import-dialog': true }}
    >
      <DialogHeader title={t('progressImport.title')} onClose={close} />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-4">
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

            {/* `detectDateOrder` levert `evidence: 'contradictoryNoSample'` wanneer het
                bestand tegenstrijdig datumbewijs bevat maar er geen enkele cel is om de gebruiker
                over te vragen — de app neemt dan dag-maand aan en informeert hier
                achteraf; afwijkende datums zijn hieronder al als onleesbaar geweigerd. Alleen
                aanwezig op de niet-ambiguous tak van `DateOrderDetection`, vandaar de guard. */}
            {detection && detection.order !== 'ambiguous' && detection.evidence === 'contradictoryNoSample' && (
              <div className="alert alert--warning flex items-center gap-2">
                <AlertTriangle size={16} />
                {t('progressImport.dateOrderContradictory')}
              </div>
            )}

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
                    <div
                      key={row.rowNumber}
                      data-ops-progress-row={row.rowNumber}
                      className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5"
                    >
                      {/* De rijkop is WBS + naam in de primaire
                          tekstkleur; het BLADrijnummer verschijnt alleen hier — bij een rij die nog
                          geen taak heeft is dat het enige aanknopingspunt met het bestand. */}
                      <span className="font-medium text-text-primary">
                        {sheetRow?.wbsCode ?? ''} {sheetRow?.name ?? ''}
                      </span>
                      <span className="text-text-secondary">
                        {t('progressImport.sheetRowHint', { row: row.rowNumber })}
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
                  <div
                    key={row.rowNumber}
                    data-ops-progress-row={row.rowNumber}
                    className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5"
                  >
                    <span className="font-medium text-text-primary">{row.taskLabel}</span>
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
                  <div
                    key={row.rowNumber}
                    data-ops-progress-row={row.rowNumber}
                    className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-primary">{row.taskLabel}</span>
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
              <div
                key={row.rowNumber}
                data-ops-progress-row={row.rowNumber}
                className="flex flex-col gap-1 border border-border rounded-[10px] p-2.5"
              >
                {/* Een geweigerde rij ZONDER koppeling heeft geen taaklabel — dan is het
                    bladrijnummer het enige dat de gebruiker terug naar het bestand wijst. */}
                <span className="font-medium text-text-primary">
                  {row.taskLabel ?? t('progressImport.sheetRowHint', { row: row.rowNumber })}
                </span>
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
