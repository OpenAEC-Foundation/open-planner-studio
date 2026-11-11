import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { documentFileBase } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { paginateCanvasToPdfBytes } from '@/services/print/paginate';
import { ensureReportFontLoaded, getArabicFontBytes, getInterFontBytes, getReportFontBytes, loadReportTextMetrics } from '@/services/pdf/fontLoader';
import { reportFontStack, type ReportFontId } from '@/services/pdf/reportFont';
import { RTL_LOCALES, type Locale } from '@/i18n/config';
import { Select } from '@/components/common/Select';
import { inlineDirectionOf, panelWidthAtPointer, useSplitter } from '@/hooks/useSplitter';
import { saveBytesDialog } from '@/services/fileAccess';
import { describeVectorFallback } from '@/services/print/exportGanttReportPdf';
import {
  DEFAULT_REPORT_SETTINGS, loadReportSettings, patchReportSettings, TABLE_REPORT_TYPES,
  type ReportPaperSize, type ReportOrientation, type ReportSettings, type ReportType, type TableReportOptions,
} from '@/utils/reportSettings';
import { reportFontStyle, TableReportView } from './reports/TableReportView';
import { TableReportOptionsBlock } from './reports/TableReportOptionsBlock';
import { ReportOptionsCard } from './reports/reportFormPrimitives';
import { useTableReportSpec } from './reports/useTableReportSpec';
import { toPdfSpec } from './reports/tableReportSpec';
import { useTaskIdDateText, type TaskIdDateText } from '@/hooks/displayDate';
import { MilestoneReport, useMilestoneRows, STATUS_COLOR as MILESTONE_STATUS_COLOR, type MilestoneRow } from './MilestoneReport';
import { VarianceReport, useVarianceResult, STATUS_COLOR as VARIANCE_STATUS_COLOR, fmtDelta } from './VarianceReport';
import type { VarianceRow } from '@/engine/variance';
import type { PdfTableColumn } from '@/services/pdf/pdfTable';
import type { TFunction } from 'i18next';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { scheduleErrorText } from '@/i18n/scheduleErrors';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';

/*
 * Het rapportpaneel voor de rapporten zonder Gantt: mijlpalen, afwijkingen en de acht tabelrapporten.
 * De Gantt-afdruk (met de layout Resourcediagram) staat op het Rapport-tabblad in `reportStudio/`
 * (issue #817); de keuzelijst hier wisselt ernaartoe via `ReportWorkspace`.
 */

/**
 * Kolomspec voor de vector-PDF-export van het mijlpalenrapport — spiegelt EXACT
 * `MilestoneReport.tsx`: zelfde kolomvolgorde/headers (`t('milestoneReport.*')`), de `◆`-prefix bij
 * `mandatory`, float `< 0` rood+bold, en de `STATUS_COLOR`-badge (altijd bold, zoals de DOM-span).
 */
/** De kolomspec wordt buiten React-render-tijd opgebouwd (`handleExportPDF`); de datumformatter komt dus
 *  als argument mee, gebonden aan de instellingen (`useTaskIdDateText`). */
function buildMilestoneColumns(t: TFunction<'report'>, taskDate: TaskIdDateText): PdfTableColumn<MilestoneRow>[] {
  return [
    { header: t('milestoneReport.wbs'), width: 70, align: 'left', text: r => r.wbs },
    { header: t('milestoneReport.name'), width: 260, align: 'left', text: r => `${r.mandatory ? '◆ ' : ''}${r.name}` },
    { header: t('milestoneReport.kind'), width: 90, align: 'left', text: r => t(`milestoneReport.kind_${r.kind}`) },
    { header: t('milestoneReport.date'), width: 100, align: 'left', text: r => taskDate(r.id, r.date, 'start') },
    { header: t('milestoneReport.guardDate'), width: 130, align: 'left', text: r => taskDate(r.id, r.guardDate, r.guardSide, { milestoneOwn: false }) || '—' },
    {
      header: t('milestoneReport.float'), width: 70, align: 'right',
      text: r => (r.float === undefined ? '—' : String(r.float)),
      color: r => (r.float !== undefined && r.float < 0 ? '#DC2626' : undefined),
      bold: r => r.float !== undefined && r.float < 0,
    },
    { header: t('milestoneReport.mandatory'), width: 90, align: 'left', text: r => (r.mandatory ? t('milestoneReport.yes') : '') },
    {
      header: t('milestoneReport.status'), width: 110, align: 'left',
      text: r => t(`milestoneReport.status_${r.status}`),
      color: r => MILESTONE_STATUS_COLOR[r.status],
      bold: () => true,
    },
  ];
}

/**
 * Kolomspec voor de vector-PDF-export van het afwijkingenrapport — spiegelt EXACT
 * `VarianceReport.tsx`: zelfde `COLUMNS`-volgorde/headers, `fmtDelta`, deltaStart/deltaFinish `> 0`
 * rood+bold, en de `STATUS_COLOR`-badge (altijd bold).
 */
function buildVarianceColumns(t: TFunction<'report'>, taskDate: TaskIdDateText, locale: string): PdfTableColumn<VarianceRow>[] {
  return [
    { header: t('milestoneReport.wbs'), width: 70, align: 'left', text: r => r.wbs },
    { header: t('milestoneReport.name'), width: 220, align: 'left', text: r => r.name },
    { header: t('variance.baselineStart'), width: 110, align: 'left', text: r => taskDate(r.taskId, r.baselineStart, 'start') || '—' },
    { header: t('variance.baselineFinish'), width: 110, align: 'left', text: r => taskDate(r.taskId, r.baselineFinish, 'end') || '—' },
    { header: t('variance.currentStart'), width: 110, align: 'left', text: r => taskDate(r.taskId, r.currentStart, 'start') || '—' },
    { header: t('variance.currentFinish'), width: 110, align: 'left', text: r => taskDate(r.taskId, r.currentFinish, 'end') || '—' },
    {
      header: t('variance.deltaStart'), width: 90, align: 'right',
      text: r => fmtDelta(r.deltaStart, locale),
      color: r => (r.deltaStart !== undefined && r.deltaStart > 0 ? '#DC2626' : undefined),
      bold: r => r.deltaStart !== undefined && r.deltaStart > 0,
    },
    {
      header: t('variance.deltaFinish'), width: 90, align: 'right',
      text: r => fmtDelta(r.deltaFinish, locale),
      color: r => (r.deltaFinish !== undefined && r.deltaFinish > 0 ? '#DC2626' : undefined),
      bold: r => r.deltaFinish !== undefined && r.deltaFinish > 0,
    },
    {
      header: t('variance.status'), width: 110, align: 'left',
      text: r => t(`variance.status_${r.status}`),
      color: r => VARIANCE_STATUS_COLOR[r.status],
      bold: () => true,
    },
  ];
}

/** Instellingenkolom: startbreedte + sleepgrenzen. Geen
 *  eigen max-constante — de bovengrens is 50% van de kaartbreedte, dus dynamisch (zie `useSplitter`
 *  hieronder), net als de rechterpaneel-breedte in App.tsx. */
const SETTINGS_PANEL_DEFAULT_WIDTH = 256;
const SETTINGS_PANEL_MIN_WIDTH = 200;

/** De velden van `ops-reportSettings` die dit paneel leest en wijzigt. De rest hoort bij het Rapport-tabblad. */
type PanelSettings = Pick<ReportSettings, 'reportType' | 'tableReports' | 'paperSize' | 'orientation' | 'reportFontFamily'>;

export interface ReportPanelProps {
  /**
   * Het paneel wil horen wanneer de gebruiker hier de Gantt-afdruk kiest; `ReportWorkspace` toont dan het
   * Rapport-tabblad. Pas nádat de keuze bewaard is, zodat het tabblad haar bij het laden leest.
   */
  onReportTypeChange?: (type: ReportType) => void;
}

export function ReportPanel({ onReportTypeChange }: ReportPanelProps = {}) {
  const { t } = useTranslation('report');
  const { t: tCommon, i18n } = useTranslation('common');
  // B4 in de PDF van mijlpalen en afwijkingen: een tijd alleen als het moment midden op de werkdag valt.
  const taskDate = useTaskIdDateText();
  const project = useAppStore(s => s.project);
  // De PDF-naam draagt de documentnaam "Naam (code)", zoals tabblad en opslaan (B21, `documentFileBase`).
  // Een neutrale, taalonafhankelijke terugval, net als bij Bestand → Opslaan (`project.ifc` in elke taal).
  const projectCode = useAppStore(s => documentProjectCode(s.project, s.xerImportMetadata));
  const fileBase = documentFileBase(project.name, projectCode);
  // "Datums zoals opgeslagen": de tabelrapporten dragen de melding in hun spec (`useTableReportSpec`);
  // mijlpalen en afwijkingen krijgen haar hier, boven het rapport — dezelfde tekst, zodat geen enkel
  // rapport nullen toont zonder te zeggen dat het bestand die assen niet vastlegde.
  const datesAsRecorded = useAppStore(s => s.datesAsRecorded);
  const recordedDatesNote = datesAsRecorded ? (
    <div
      className="mb-2 shrink-0 rounded-[6px] border border-border bg-surface px-3 py-2 text-small leading-4 text-text-secondary"
      data-report-recorded-dates-note
    >
      {t('tableReports.recordedDatesNote')}
    </div>
  ) : null;

  // De opties starten op de gedeelde defaults en krijgen vlak na de eerste render de opgeslagen stand.
  const [panel, setPanel] = useState<PanelSettings>(() => ({
    reportType: DEFAULT_REPORT_SETTINGS.reportType,
    tableReports: DEFAULT_REPORT_SETTINGS.tableReports,
    paperSize: DEFAULT_REPORT_SETTINGS.paperSize,
    orientation: DEFAULT_REPORT_SETTINGS.orientation,
    reportFontFamily: DEFAULT_REPORT_SETTINGS.reportFontFamily,
  }));
  const { reportType, tableReports: tableOptions, paperSize, orientation, reportFontFamily } = panel;
  const reportFont = reportFontStack(reportFontFamily);

  // Lezen bij openen, en opnieuw als een andere bron `ops-reportSettings` vernieuwt (de host na de start,
  // #818, of een ander tabblad). Opslaan gebeurt alleen bij een keuze van de gebruiker, en dan alleen voor
  // de velden van dit paneel (`patchReportSettings`): de kolommen, balkkleuren, layout en de rest van het
  // Rapport-tabblad blijven zoals ze opgeslagen staan. Daardoor kan de eerste render met de standaard ook
  // nooit de opgeslagen stand overschrijven.
  const [reportSettingsReload, setReportSettingsReload] = useState(0);
  useStoredSettingRefresh('ops-reportSettings', () => setReportSettingsReload(n => n + 1));
  useEffect(() => {
    let cancelled = false;
    void loadReportSettings().then(s => {
      if (cancelled) return;
      setPanel({
        reportType: s.reportType, tableReports: s.tableReports, paperSize: s.paperSize,
        orientation: s.orientation, reportFontFamily: s.reportFontFamily,
      });
    }, () => {});
    return () => { cancelled = true; };
  }, [reportSettingsReload]);

  const update = useCallback((patch: Partial<PanelSettings>) => {
    setPanel(prev => ({ ...prev, ...patch }));
    // Best-effort: mislukt het schrijven (geblokkeerde opslag), dan blijft de keuze binnen deze sessie werken.
    patchReportSettings(patch);
  }, []);
  // Alleen de gewijzigde tabelopties: de andere staan in de opslag mogelijk al nieuwer dan in dit paneel.
  const patchTableOptions = useCallback((patch: Partial<TableReportOptions>) => {
    setPanel(prev => ({ ...prev, tableReports: { ...prev.tableReports, ...patch } }));
    patchReportSettings({ tableReports: patch });
  }, []);
  const setPaperSize = useCallback((v: ReportPaperSize) => { update({ paperSize: v }); }, [update]);
  const setOrientation = useCallback((v: ReportOrientation) => { update({ orientation: v }); }, [update]);
  const setReportFontFamily = useCallback((v: ReportFontId) => { update({ reportFontFamily: v }); }, [update]);
  const chooseReportType = useCallback((next: ReportType) => {
    update({ reportType: next });
    onReportTypeChange?.(next);
  }, [update, onReportTypeChange]);

  // Reden waarom de laatste export-poging is afgebroken (alleen een CPM-cyclus).
  // Het CPM-resultaat met de fout, niet de tekst: vertaald bij het tonen, dus ook na een taalwissel.
  const [exportError, setExportError] = useState<Pick<CPMResult, 'error' | 'errorInfo'> | null>(null);
  const scheduleStale = useAppStore(s => s.scheduleStale);

  // Instellingenkolom horizontaal sleepbaar. Zelfde generieke sleeppatroon als de rechterpaneel-splitter
  // in App.tsx (`useSplitter`): losse React-state, bewust niet bewaard — een layout-voorkeur van dit ene
  // paneel, geen rapportinstelling. `containerRef` wijst naar de buitenste flex-rij (instellingen +
  // rapport), zodat de sleeppositie relatief aan díe rand wordt berekend, niet aan het venster.
  const containerRef = useRef<HTMLDivElement>(null);
  const [settingsWidth, setSettingsWidth] = useState(SETTINGS_PANEL_DEFAULT_WIDTH);
  const settingsSplitter = useSplitter({
    min: SETTINGS_PANEL_MIN_WIDTH,
    max: () => Math.round((containerRef.current?.getBoundingClientRect().width ?? 800) * 0.5),
    // De instellingenkolom is het eerste flexkind: links in ltr, rechts in ar/fa. Een vaste
    // `clientX − rect.left` laat de kolom in ar/fa bij de eerste beweging naar de bovengrens springen.
    computeSize: e => {
      const container = containerRef.current;
      if (!container) return NaN;
      return Math.round(panelWidthAtPointer(
        e.clientX,
        container.getBoundingClientRect(),
        'inline-start',
        inlineDirectionOf(container),
      ));
    },
    onResize: w => { if (!Number.isNaN(w)) setSettingsWidth(w); },
  });

  const milestoneRef = useRef<HTMLDivElement>(null);
  const varianceRef = useRef<HTMLDivElement>(null);
  const tableReportRef = useRef<HTMLDivElement>(null);
  // null voor mijlpalen en afwijkingen; anders de complete spec (titel, samenvatting, secties).
  const tableSpec = useTableReportSpec(reportType, tableOptions);
  const locale = i18n.language;

  const milestoneRows = useMilestoneRows();
  const varianceResult = useVarianceResult();

  /**
   * Gedeelde PDF-schrijver via `saveBytesDialog`, het enige byte-schrijfpad van de app — Tauri:
   * save-dialoog + `writeFile`; web: FSA-picker met download-terugval. Bewust GEEN
   * `viaDownload`-melding.
   *
   * De try/catch is niet optioneel. `saveBytesDialog` geeft
   * een geannuleerde dialoog terug als `null`, maar een ECHTE fout (schijf vol, bestand
   * vergrendeld, geweigerd bestandstype) gooit hij bewust door — zie `saveDataDialogWeb`. Deze
   * aanroeper hangt aan een `void runExport()`, dus zonder vangnet wordt dat een unhandled
   * rejection: de gebruiker drukt op Exporteren en er gebeurt zichtbaar niets. Melden gaat via het
   * ene meldingskanaal met dezelfde sleutel die `fileSlice` voor een mislukte schrijfactie
   * gebruikt.
   */
  const writePdf = useCallback(async (pdfBytes: Uint8Array, defaultName: string) => {
    try {
      await saveBytesDialog(
        defaultName, pdfBytes,
        [{ name: 'PDF Document', extensions: ['pdf'] }],
        // #804 fixronde 1: niet over het bronbestand van een document met een gebouwmodel.
        { mime: 'application/pdf', refuseTarget: useAppStore.getState().foreignTargetCheck('export') },
      );
    } catch (err) {
      useAppStore.getState().notify({
        severity: 'error',
        messageKey: 'notifications.saveFailed',
        detail: (err as Error).message,
      });
    }
  }, []);

  /**
   * De eigenlijke export — draait ALTIJD op de closure-waarden van de huidige render (`tableSpec`,
   * de mijlpaal- en afwijkingsrijen). Daarom mag hij pas ná een herberekening worden aangeroepen wanneer
   * die een re-render heeft opgeleverd; zie `handleExportPDF` en het effect eronder.
   */
  const runExport = useCallback(async () => {
    // Bij een cyclus afbreken zónder te exporteren. De cpmResult.error-check staat hier los van
    // de stale-vlag omdat runCPM `scheduleStale` vóór de solve al op false zet; een guard op alleen
    // die vlag zou stil met oude task.time-waarden exporteren.
    const cpm = useAppStore.getState().cpmResult;
    if (cpm?.error) {
      // Zichtbaar maken is hier NIET optioneel: op het Rapport-tabblad is `GanttCanvas` niet
      // gemonteerd, dus de bestaande cyclus-toast vuurt hier niet en de knop zou anders gewoon
      // stil niets doen. De reden komt als code + parameters uit de solver en wordt bij het tonen
      // vertaald (`scheduleErrorText`).
      setExportError({ error: cpm.error, errorInfo: cpm.errorInfo });
      return;
    }
    setExportError(null);

    const lowerPaper = paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1';
    // Basisrichting van de export-taal: stuurt de bidi in het complexe RTL-tekst-pad van de vector-export.
    const exportBaseDir: 'ltr' | 'rtl' = RTL_LOCALES.includes(locale as Locale) ? 'rtl' : 'ltr';

    // De gevendorde rapportletter moet geladen zijn vóór de meting en een eventuele DOM-terugval.
    await ensureReportFontLoaded(reportFontFamily);

    // De bytes voor de vector-PDF: de gekozen letter, Noto Sans Arabic voor RTL, en bij elke andere
    // letter dan Inter óók Inter als terugval voor de tekens die die letter mist (✓, een enkel
    // symbool; zie `fallbackFonts` in paginateVector.ts). Zonder terugval valt de hele PDF om één
    // zo'n teken terug op raster.
    const loadVectorFonts = async () => {
      const [regular, bold, arabicRegular, arabicBold, fallbackFonts] = await Promise.all([
        getReportFontBytes(reportFontFamily, 400),
        getReportFontBytes(reportFontFamily, 700),
        getArabicFontBytes(400),
        getArabicFontBytes(700),
        reportFontFamily === 'inter'
          ? Promise.resolve([])
          : Promise.all([getInterFontBytes(400), getInterFontBytes(700)])
            .then(([interRegular, interBold]) => [{ id: 'inter', bytes: { regular: interRegular, bold: interBold } }]),
      ]);
      return { main: { regular, bold }, arabic: { regular: arabicRegular, bold: arabicBold }, fallbackFonts };
    };

    // Vector-tabel-export — dezelfde kolomspec als de levende DOM-tabel (MilestoneReport/VarianceReport/
    // TableReportView), getekend via het renderReport-patroon en gepagineerd door `paginateVectorToPdfBytes`.
    // Bij een fout valt de export terug op het DOM-screenshot-pad (modern-screenshot), zodat de export
    // nooit stukloopt.
    const suffix = tableSpec ? tableSpec.fileSuffix : reportType === 'milestones' ? t('fileSuffix.milestones') : t('fileSuffix.variance');

    const exportTableRaster = async (): Promise<Uint8Array> => {
      const node = tableSpec ? tableReportRef.current : reportType === 'milestones' ? milestoneRef.current : varianceRef.current;
      if (!node) throw new Error('exportTableRaster: DOM-node niet beschikbaar');

      // domToCanvas met scale=s levert een canvas van node.offsetWidth*s × node.offsetHeight*s
      // device-px; de LOGISCHE maat blijft node.offsetWidth/offsetHeight, dus srcScale =
      // canvas.width/logicalWidth = s.
      const pixelRatio = 2;
      const { domToCanvas } = await import('modern-screenshot');
      // Een PDF is een wit-papier-artefact. De rapporttabellen kleuren hun tekst via de thema-
      // CSS-variabelen; in een donker thema is dat lichte tekst, die op de geforceerde witte
      // achtergrond onleesbaar wordt. Forceer daarom kort het lichte thema tijdens de capture
      // (zodat tekst donker-op-wit uitvalt) en herstel daarna het thema van de gebruiker.
      const rootEl = document.documentElement;
      // Beide attributen: de brugblokken in globals.css hangen aan `data-oa-theme`.
      const themeAttrs = ['data-theme', 'data-oa-theme'] as const;
      const prevThemes = themeAttrs.map(name => rootEl.getAttribute(name));
      for (const name of themeAttrs) rootEl.setAttribute(name, 'light');
      const shot = await domToCanvas(node, { scale: pixelRatio, backgroundColor: '#ffffff' })
        .finally(() => {
          themeAttrs.forEach((name, i) => {
            const prev = prevThemes[i];
            if (prev !== null) rootEl.setAttribute(name, prev);
            else rootEl.removeAttribute(name);
          });
        });

      return paginateCanvasToPdfBytes(shot, {
        paperSize: lowerPaper,
        orientation,
        mode: 'fit-width',
        logicalWidth: node.offsetWidth,
        logicalHeight: node.offsetHeight,
        frozenColumnWidthPx: 0,
      });
    };

    let tablePdfBytes: Uint8Array;
    try {
      const [{ paginateVectorToPdfBytes }, { makeTableRenderReport, makeSectionedRenderReport }, { subsetFont }, fonts] = await Promise.all([
        import('@/services/print/paginateVector'),
        import('@/services/pdf/pdfTable'),
        import('@/services/pdf/hbSubset'),
        loadVectorFonts(),
      ]);
      const vectorOpts = {
        paperSize: lowerPaper, orientation, mode: 'fit-width', baseDir: exportBaseDir, subsetFont, fallbackFonts: fonts.fallbackFonts,
      } as const;

      // Kolomkoppen worden gemeten zoals de DOM-tabel zichzelf opmeet ("Duration (wd)" past in geen
      // enkele taal in een vaste 70 px). De meting loopt op de geladen rapportletter — hetzelfde
      // font dat de PDF inbedt — met de lettermaten van het fontbestand (`reportTextMeasure.ts`),
      // zodat wat hier past ook daar past.
      const headerMetrics = await loadReportTextMetrics(reportFontFamily, exportBaseDir);
      const measureHeader = (text: string, font: string) => headerMetrics.measure(text, font);

      // Twee losse takken i.p.v. één ternaire spec: `makeTableRenderReport<Row>` is generiek over de
      // rijtype, en een samengevoegde union-spec zou TS niet meer aan één Row-type kunnen binden.
      if (tableSpec) {
        // Tabelrapporten: dezelfde kolomspec als de DOM-weergave, gesectioneerd.
        tablePdfBytes = await paginateVectorToPdfBytes(
          makeSectionedRenderReport(toPdfSpec(tableSpec), measureHeader, reportFont),
          vectorOpts,
          fonts.main,
          fonts.arabic,
        );
      } else if (reportType === 'milestones') {
        tablePdfBytes = await paginateVectorToPdfBytes(
          makeTableRenderReport({
            title: t('milestoneReport.title'),
            columns: buildMilestoneColumns(t, taskDate),
            rows: milestoneRows,
            emptyText: t('milestoneReport.empty'),
          }, measureHeader, reportFont),
          vectorOpts,
          fonts.main,
          fonts.arabic,
        );
      } else {
        tablePdfBytes = await paginateVectorToPdfBytes(
          makeTableRenderReport({
            title: t('variance.title'),
            columns: buildVarianceColumns(t, taskDate, locale),
            rows: varianceResult.rows,
            emptyText: t('variance.noBaseline'),
          }, measureHeader, reportFont),
          vectorOpts,
          fonts.main,
          fonts.arabic,
        );
      }
    } catch (err) {
      console.warn('[ReportPanel] Vector-tabel-PDF-export mislukt, terugval op DOM-screenshot:', describeVectorFallback(err));
      tablePdfBytes = await exportTableRaster();
    }

    await writePdf(tablePdfBytes, `${fileBase}-${suffix}.pdf`);
  }, [reportType, fileBase, paperSize, orientation, writePdf, t, taskDate, locale, milestoneRows, varianceResult, tableSpec,
    reportFontFamily, reportFont]);

  // Guard: een stale planning eerst doorrekenen. NIET meteen daarna exporteren — `runExport`
  // leest `tableSpec` en de rijen uit de closure van de HUIDIGE render, en die kent de
  // herberekening nog niet (de PDF zou achterlopen op het scherm). De export wordt daarom uitgesteld
  // tot het effect hieronder ná de re-render met de verse waarden vuurt.
  const exportPendingRef = useRef(false);
  /**
   * `runExport` wordt vanaf twee plekken los gestart (`void`), dus een afwijzing die het `writePdf`
   * -vangnet niet dekt — het opbouwen van de PDF zelf, een glyph die `pdf-lib` weigert — zou een
   * unhandled rejection zijn. Zelfde kanaal, zelfde reden als in `writePdf`.
   */
  const startExport = useCallback(() => {
    runExport().catch((err: unknown) => {
      useAppStore.getState().notify({
        severity: 'error',
        messageKey: 'notifications.saveFailed',
        detail: (err as Error).message,
      });
    });
  }, [runExport]);
  const handleExportPDF = useCallback(() => {
    const st = useAppStore.getState();
    if (st.scheduleStale) {
      exportPendingRef.current = true;
      st.runCPM();
      return;
    }
    startExport();
  }, [startExport]);
  useEffect(() => {
    if (!exportPendingRef.current || scheduleStale) return;
    exportPendingRef.current = false;
    startExport();
  }, [scheduleStale, startExport]);

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden bg-surface" style={{ position: 'relative' }}>
      {/* Sleepgrijpzone — zelfde patroon als de rechterpaneel-splitter in App.tsx en de tabel/
          chart-splitter in GanttCanvas: onzichtbare grijpzone over de rand (geen aparte balk,
          geen kleur, geen ruimtebeslag). Bewust een kind van de BUITENSTE container en niet van de
          instellingenkolom: die kolom scrollt (`overflow-y-auto`), en een zone die 4px buiten haar
          rand steekt telt daar mee als scrollbreedte (horizontale scrollbar).
          `insetInlineStart` (i.p.v. `left`) houdt 'm in RTL (ar/fa) aan dezelfde
          logische rand, want de instellingenkolom is in beide richtingen het eerste flex-kind. */}
      <div
        onMouseDown={e => { e.preventDefault(); settingsSplitter.start(); }}
        style={{
          position: 'absolute',
          insetInlineStart: settingsWidth - 4,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          zIndex: 10,
        }}
        data-ops-report-settings-resize
      />
      {/* Links: instellingen — breedte sleepbaar. `min-w-0` op de kolom zelf voorkomt dat ZIJN eigen
          rijen de kolom breder duwen dan `settingsWidth`. De scheidingslijn is `borderInlineEnd`, zodat
          hij ook in ar/fa (kolom rechts) op de grens met het rapport staat en niet aan de buitenkant. */}
      <div
        className="flex-shrink-0 min-w-0 overflow-y-auto p-3 flex flex-col gap-3"
        style={{ width: settingsWidth, borderInlineEnd: '1px solid var(--theme-border)' }}
      >
        <span
          className="text-small leading-4 font-bold uppercase"
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--theme-text-muted)' }}
        >
          {t('title')}
        </span>

        {/* Rapporttype. De Gantt-afdruk opent het Rapport-tabblad; het Resourcediagram is daar een layout (#861). */}
        <Select
          className="w-full min-w-0"
          aria-label={t('reportType.label')}
          value={reportType}
          onChange={v => chooseReportType(v as ReportType)}
          options={[
            { value: 'gantt', label: t('reportType.gantt') },
            { value: 'milestones', label: t('reportType.milestones') },
            { value: 'variance', label: t('reportType.variance') },
            ...TABLE_REPORT_TYPES.map(type => ({ value: type, label: t(`reportType.${type}`) })),
          ]}
        />

        {/* Samenvatting */}
        <ReportOptionsCard title={t('summary')}>
          <div className="grid grid-cols-2 gap-1 text-small leading-4" data-ops-report-summary-block>
            {tableSpec ? (
              tableSpec.summary.map((item, i) => (
                <span key={i} className="contents">
                  <span className="text-text-secondary">{item.label}</span>
                  <span style={{ color: item.color, fontWeight: item.color ? 700 : undefined }}>{item.value}</span>
                </span>
              ))
            ) : reportType === 'milestones' ? (
              <>
                <span className="text-text-secondary">{t('milestoneReport.total')}</span>
                <span>{milestoneRows.length}</span>
                <span className="text-text-secondary">{t('milestoneReport.mandatoryCount')}</span>
                <span>{milestoneRows.filter(r => r.mandatory).length}</span>
                <span className="text-text-secondary">{t('milestoneReport.lateCount')}</span>
                <span className="text-red-400 font-bold">{milestoneRows.filter(r => r.status === 'late').length}</span>
              </>
            ) : (
              <>
                <span className="text-text-secondary">{t('variance.total')}</span>
                <span>{varianceResult.rows.length}</span>
                <span className="text-text-secondary">{t('variance.lateCount')}</span>
                <span className="text-red-400 font-bold">{varianceResult.rows.filter(r => r.status === 'late').length}</span>
                <span className="text-text-secondary">{t('variance.earlyCount')}</span>
                <span>{varianceResult.rows.filter(r => r.status === 'early').length}</span>
                {varianceResult.projectEndDelta !== undefined && (
                  <>
                    <span className="text-text-secondary col-span-2 mt-1" style={{ color: varianceResult.projectEndDelta > 0 ? '#DC2626' : 'var(--theme-text-dim)' }}>
                      {t('variance.projectEndDelta', { delta: varianceResult.projectEndDelta > 0 ? `+${varianceResult.projectEndDelta}` : `${varianceResult.projectEndDelta}` })}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </ReportOptionsCard>

        {tableSpec && (
          <TableReportOptionsBlock
            reportType={reportType}
            options={tableOptions}
            onChange={patchTableOptions}
            paperSize={paperSize}
            orientation={orientation}
            onPaperSize={setPaperSize}
            onOrientation={setOrientation}
            fontFamily={reportFontFamily}
            onFontFamily={setReportFontFamily}
          />
        )}

        {/* Alleen de exportknop hoort bij dit formulier: Enter in rapportinvoer exporteert niet. */}
        <form
          id="report-pdf-export"
          className="flex flex-col gap-2"
          onSubmit={e => { e.preventDefault(); handleExportPDF(); }}
        >
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-accent-on rounded-lg hover:bg-accent-hover text-small leading-4 font-medium"
            style={{ boxShadow: 'var(--shadow-glow)' }}
          >
            {t('exportPDF', { defaultValue: 'Exporteer PDF' })}
          </button>
          {exportError && (
            <div className="text-small leading-4" style={{ color: 'var(--error)' }} role="alert">
              {scheduleErrorText(exportError, tCommon)}
            </div>
          )}
        </form>
      </div>

      {/* Rechts: het rapport */}
      <div className="flex-1 min-w-0 min-h-0" style={{ background: 'var(--theme-bg)' }}>
        {tableSpec ? (
          <div className="h-full overflow-auto p-4">
            <TableReportView ref={tableReportRef} spec={tableSpec} fontStack={reportFont} />
          </div>
        ) : reportType === 'milestones' ? (
          <div className="h-full overflow-auto p-4">
            {recordedDatesNote}
            <div
              ref={milestoneRef}
              className="bg-surface p-4"
              style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 960, ...reportFontStyle(reportFont) }}
            >
              <h3 className="ui-card-header !text-small !leading-4 mb-3">{t('milestoneReport.title')}</h3>
              <MilestoneReport />
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto p-4">
            {recordedDatesNote}
            <div
              ref={varianceRef}
              className="bg-surface p-4"
              style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 1100, ...reportFontStyle(reportFont) }}
            >
              <h3 className="ui-card-header !text-small !leading-4 mb-3">{t('variance.title')}</h3>
              <VarianceReport />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
