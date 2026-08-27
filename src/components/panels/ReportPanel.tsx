import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { measurePrintReport, renderPrintCanvas, renderReport, REPORT_FONT_SCALES, REPORT_MAX_ZOOM, REPORT_MIN_ZOOM, PrintOptions } from '@/services/print/printPreview';
import { computePreviewRasterLimits } from '@/services/print/previewSafety';
import { getLocalizedMonths, getLocalizedMonthsShort } from '@/i18n/dateFormat';
import { ensureExtension } from '@/utils/filePath';
import { projectFileBase } from '@/utils/documents';
import { computeHighResScale } from '@/utils/miniPdf';
import { paginateCanvasToPdfBytes, paginateCanvasToTiles } from '@/services/print/paginate';
import { ensureInterLoaded, getInterFontBytes, getArabicFontBytes } from '@/services/pdf/fontLoader';
import { RTL_LOCALES, type Locale } from '@/i18n/config';
import { Select } from '@/components/common/Select';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import {
  barColorFieldOptions,
  effectiveBarColorControl,
} from '@/components/viewControls/barColorFieldOptions';
import { encodeFieldRef, decodeFieldRef } from '@/components/layout/Ribbon/ribbonPrimitives';
import { useSplitter } from '@/hooks/useSplitter';
import { isTauri } from '@/utils/platform';
import { DEFAULT_REPORT_SETTINGS, loadReportSettings, saveReportSettings } from '@/utils/reportSettings';
import { saveBarColorSelection } from '@/utils/barColorSettings';
import { useDisplayDate } from '@/hooks/displayDate';
import { MilestoneReport, useMilestoneRows, STATUS_COLOR as MILESTONE_STATUS_COLOR, type MilestoneRow } from './MilestoneReport';
import { VarianceReport, useVarianceResult, STATUS_COLOR as VARIANCE_STATUS_COLOR, fmtDelta } from './VarianceReport';
import type { VarianceRow } from '@/engine/variance';
import type { PdfTableColumn } from '@/services/pdf/pdfTable';
import type { TFunction } from 'i18next';
import { buildBaselineOverlay } from '@/types/baseline';

/** Reactieve datum-formatters — zelfde vorm als `useDisplayDate()` (Hooks mogen hier niet in, dit
 * bouwt de kolomspec buiten React-render-tijd op in `handleExportPDF`). */
type DisplayDate = ReturnType<typeof useDisplayDate>;

/**
 * Beschrijf waarom de vector-export terugvalt op raster. Herkent de `VectorUnsupportedError` (fase 4)
 * aan z'n `name` — géén eager import van `paginateVector`, zodat pdf-lib/fontkit uit de hoofdbundle
 * blijft (B2) — en logt de ongedekte codepoints (bv. een CJK/Arabische taaknaam) i.p.v. tofu te tekenen.
 */
function describeVectorFallback(err: unknown): string {
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'VectorUnsupportedError') {
    const cps = (err as { codepoints?: number[] }).codepoints ?? [];
    const rtl = (err as { hasRtl?: boolean }).hasRtl ? ' (bevat RTL)' : '';
    const list = cps.map(cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')).join(' ');
    return `ongedekte glyphs${rtl}: ${list}`;
  }
  return String(err);
}

/**
 * Kolomspec voor de vector-PDF-export van het mijlpalenrapport — spiegelt EXACT
 * `MilestoneReport.tsx`: zelfde kolomvolgorde/headers (`t('milestoneReport.*')`), de `◆`-prefix bij
 * `mandatory`, float `< 0` rood+bold, en de `STATUS_COLOR`-badge (altijd bold, zoals de DOM-span).
 */
function buildMilestoneColumns(t: TFunction<'report'>, dd: DisplayDate): PdfTableColumn<MilestoneRow>[] {
  return [
    { header: t('milestoneReport.wbs'), width: 70, align: 'left', text: r => r.wbs },
    { header: t('milestoneReport.name'), width: 260, align: 'left', text: r => `${r.mandatory ? '◆ ' : ''}${r.name}` },
    { header: t('milestoneReport.kind'), width: 90, align: 'left', text: r => t(`milestoneReport.kind_${r.kind}`) },
    { header: t('milestoneReport.date'), width: 100, align: 'left', text: r => dd.date(r.date) },
    { header: t('milestoneReport.guardDate'), width: 130, align: 'left', text: r => dd.date(r.guardDate) || '—' },
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
function buildVarianceColumns(t: TFunction<'report'>, dd: DisplayDate): PdfTableColumn<VarianceRow>[] {
  return [
    { header: t('milestoneReport.wbs'), width: 70, align: 'left', text: r => r.wbs },
    { header: t('milestoneReport.name'), width: 220, align: 'left', text: r => r.name },
    { header: t('variance.baselineStart'), width: 110, align: 'left', text: r => dd.date(r.baselineStart) || '—' },
    { header: t('variance.baselineFinish'), width: 110, align: 'left', text: r => dd.date(r.baselineFinish) || '—' },
    { header: t('variance.currentStart'), width: 110, align: 'left', text: r => dd.date(r.currentStart) || '—' },
    { header: t('variance.currentFinish'), width: 110, align: 'left', text: r => dd.date(r.currentFinish) || '—' },
    {
      header: t('variance.deltaStart'), width: 90, align: 'right',
      text: r => fmtDelta(r.deltaStart),
      color: r => (r.deltaStart !== undefined && r.deltaStart > 0 ? '#DC2626' : undefined),
      bold: r => r.deltaStart !== undefined && r.deltaStart > 0,
    },
    {
      header: t('variance.deltaFinish'), width: 90, align: 'right',
      text: r => fmtDelta(r.deltaFinish),
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

/** Instellingenkolom (issue #38 punt 3): startbreedte (oude vaste `w-64`) + sleepgrenzen. Geen
 *  eigen max-constante — de bovengrens is 50% van de kaartbreedte, dus dynamisch (zie `useSplitter`
 *  hieronder), net als de rechterpaneel-breedte in App.tsx. */
const SETTINGS_PANEL_DEFAULT_WIDTH = 256;
const SETTINGS_PANEL_MIN_WIDTH = 200;

/** Eén papiervel in de preview: PNG-dataURL + echte puntmaat (voor de beeldverhouding). */
interface PreviewPage {
  dataUrl: string;
  wPt: number;
  hPt: number;
}

export function ReportPanel() {
  const { t } = useTranslation('report');
  const { t: tCommon, i18n } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const dd = useDisplayDate();
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const project = useAppStore(s => s.project);
  // Naamloos project ⇒ de vertaalde weergavenaam. De printlaag is een Canvas-renderer zonder
  // `t(...)`: die krijgt de al-vertaalde tekst dóórgegeven (zelfde patroon als `options.labels`).
  // Let op: dit is UITSLUITEND de tekst ÍN het rapport. Voor de BESTANDSNAAM van de export geldt de
  // neutrale, taalonafhankelijke terugval (`fileBase` hieronder) — anders stelde deze route
  // `Nieuwe planning-planning.pdf` voor terwijl Bestand → Opslaan in elke taal `project.ifc`
  // voorstelt, en kreeg een Japanse of Perzische gebruiker een bestandsnaam in eigen schrift.
  const projectName = project.name || tCommon('project.untitled');
  const fileBase = projectFileBase(project.name);
  const dateNotation = useAppStore(s => s.ui.dateNotation);
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  // Issue #56: de lijnstijl van de relaties in het rapport volgt de P6-conventie van het scherm
  // (doorgetrokken = bepalend, gestreept = niet-bepalend). Die informatie zit alleen in `cpmResult`,
  // dus een echte subscription — anders ververst de preview niet na een F5/Bereken.
  const cpmResult = useAppStore(s => s.cpmResult);
  // #21/#54 — bronnen voor de nieuwe exportopties: resources/toewijzingen (kleurmodi), de
  // schermweergave-rijen (volg weergave) en de statusdatum (statuslijn). Echte subscriptions
  // (geen getState): de live preview moet op al deze wijzigingen her-renderen.
  const viewRows = useAppStore(s => s.viewRows);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const barColorSelection = useAppStore(s => s.ui.barColorSelection);
  const setUI = useAppStore(s => s.setUI);
  const fieldCtx = useFieldCatalogCtx();
  const barColorFields = barColorFieldOptions(fieldCtx);
  const barColorControl = effectiveBarColorControl(barColorSelection, fieldCtx);
  // `useTaskTypeLabels` bouwt per render een nieuw object. De inhoudssignatuur maakt voor het
  // rapport een stabiele kopie: een preview-state-update mag `options` niet opnieuw maken, maar
  // een echte taalwissel moet de labels wel vervangen.
  const taskTypeLabelsSignature = JSON.stringify(fieldCtx.taskTypeLabels);
  const reportTaskTypeLabels = useMemo<Record<string, string>>(
    () => JSON.parse(taskTypeLabelsSignature) as Record<string, string>,
    [taskTypeLabelsSignature],
  );
  const statusDate = project.statusDate;
  const baselineOverlay = useMemo(
    () => buildBaselineOverlay(baselines, activeBaselineId),
    [baselines, activeBaselineId],
  );

  // De rapportopties starten op de gedeelde defaults uit `reportSettings.ts` en worden vlak na de
  // eerste render overschreven door de opgeslagen voorkeuren (zie het hydratatie-effect verderop).
  const [reportType, setReportType] = useState<'gantt' | 'milestones' | 'variance'>(DEFAULT_REPORT_SETTINGS.reportType);
  const [showCritical, setShowCritical] = useState(DEFAULT_REPORT_SETTINGS.showCritical);
  const [showFloat, setShowFloat] = useState(DEFAULT_REPORT_SETTINGS.showFloat);
  const [showDeps, setShowDeps] = useState(DEFAULT_REPORT_SETTINGS.showDeps);
  const [showWeekends, setShowWeekends] = useState(DEFAULT_REPORT_SETTINGS.showWeekends);
  const [reportCompressNonWorkdays, setReportCompressNonWorkdays] = useState(DEFAULT_REPORT_SETTINGS.compressNonWorkdays);
  const [showLegend, setShowLegend] = useState(DEFAULT_REPORT_SETTINGS.showLegend);
  const [showTaskNames, setShowTaskNames] = useState(DEFAULT_REPORT_SETTINGS.showTaskNames);
  const [showCompletion, setShowCompletion] = useState(DEFAULT_REPORT_SETTINGS.showCompletion);
  const [showBaselineOverlay, setShowBaselineOverlay] = useState(DEFAULT_REPORT_SETTINGS.showBaselineOverlay);
  const [autoFit, setAutoFit] = useState(DEFAULT_REPORT_SETTINGS.autoFit);
  const [customZoom, setCustomZoom] = useState(DEFAULT_REPORT_SETTINGS.customZoom);
  const [paperSize, setPaperSize] = useState<'A4' | 'A3' | 'A2' | 'A1'>(DEFAULT_REPORT_SETTINGS.paperSize);
  // K7: reden waarom de laatste export-poging is afgebroken (vandaag alleen een CPM-cyclus).
  // Tussenstand — bevinding K8 (prioriteitsitem 18) trekt dit samen tot één toast in uiSlice.
  const [exportError, setExportError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(DEFAULT_REPORT_SETTINGS.orientation);
  // Bewust NIET persistent: de bedrijfsnaam komt uit het PROJECT (`project.company`). Zie de
  // toelichting bovenin `src/utils/reportSettings.ts` — globaal bewaren zou het bedrijf van het ene
  // project in het rapport van het andere laten opduiken.
  const [companyName, setCompanyName] = useState(project.company || '');
  // Issue #25 punt 1 — herhaal de datum-/projectkop bovenaan ELKE geëxporteerde pagina.
  //
  // Standaard AAN, en dat is een BEWUSTE GEDRAGSWIJZIGING, geen gemakzucht: wie vóór deze versie
  // een meerpagina-rapport exporteerde kreeg de kop alleen op de eerste rij pagina's, en krijgt hem
  // vanaf nu op élke pagina. Dat is precies de verbetering die issue #25 punt 1 vraagt (een losse
  // pagina uit de map is anders niet te plaatsen), maar het betekent óók dat een her-export van een
  // bestaand project er anders uitziet dan de oude PDF — en dat er per pagina wat body-hoogte
  // afgaat, dus mogelijk één pagina extra. De knop staat ernaast, dus wie het oude beeld wil zet
  // 'm uit. De ENGINE-defaults (`paginate.ts`/`tileLayout.ts`/`paginateVector.ts`) blijven bewust
  // op "niet herhalen" staan; alleen deze UI kiest anders.
  //
  // Bewust géén veld in `PrintOptions`: de kopherhaling is puur een pagineerder-zaak (raster:
  // hoogte in px; vector: boolean), niet iets dat de render-zoom raakt.
  const [repeatHeader, setRepeatHeader] = useState(DEFAULT_REPORT_SETTINGS.repeatHeader);
  // Issue #25 punt 5 — smeert de tijdlijn uit over N paginabreedtes (1 = oud gedrag, geen
  // verrassing voor bestaande gebruikers). Alleen zinvol in fit-width-modus; daarom `disabled`
  // wanneer `autoFit` uit staat (dan tegelt de export in 'actual'-modus toch al horizontaal).
  const [timelineColumns, setTimelineColumns] = useState(DEFAULT_REPORT_SETTINGS.timelineColumns);
  // Issue #25 punt 4 (rapport-helft) — lettergrootte van het GEGENEREERDE rapport, in procenten.
  // 100 = ongewijzigd t.o.v. eerdere versies. Los van de interface-tekstgrootte in Instellingen:
  // die stuurt de app-chrome aan, deze alleen het papier. Werkt relatief (tekst/tabel groeien, de
  // tijdlijn-zoom niet) — zie de afleiding bij `ReportMetrics` in printPreview.ts.
  const [reportFontScale, setReportFontScale] = useState(DEFAULT_REPORT_SETTINGS.reportFontScale);
  // #54 — statuslijn in de export: letterlijk drie opties (geen / statusdatumlijn / voortgangslijn).
  const [statusLine, setStatusLine] = useState(DEFAULT_REPORT_SETTINGS.statusLine);
  // #54 — volg weergave: export tekent exact de viewRows van het scherm (WYSIWYG).
  const [followView, setFollowView] = useState(DEFAULT_REPORT_SETTINGS.followView);

  // Instellingenkolom horizontaal sleepbaar (issue #38 punt 3) — vaste `w-64` bood geen enkel
  // handvat en de rechterkolom (live preview) kreeg dus nooit ruimte terug. Zelfde generieke
  // sleeppatroon als de rechterpaneel-splitter in App.tsx en de tabel/chart-splitter in
  // GanttCanvas (`useSplitter`): losse React-state (bewust NIET gepersisteerd — dit is een
  // layout-voorkeur van dit ene paneel, geen rapportinstelling die mee-exporteert, dus hoort niet
  // in `reportSettings.ts` of de 3-plekken-instellingenregel thuis). `containerRef` wijst naar de
  // buitenste flex-rij (instellingen + preview) zodat de sleeppositie relatief aan DIE rand wordt
  // berekend, niet aan het venster — de kolom staat immers niet tegen de vensterrand.
  const containerRef = useRef<HTMLDivElement>(null);
  const [settingsWidth, setSettingsWidth] = useState(SETTINGS_PANEL_DEFAULT_WIDTH);
  const settingsSplitter = useSplitter({
    min: SETTINGS_PANEL_MIN_WIDTH,
    max: () => Math.round((containerRef.current?.getBoundingClientRect().width ?? 800) * 0.5),
    computeSize: e => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return NaN;
      return Math.round(e.clientX - rect.left);
    },
    onResize: w => { if (!Number.isNaN(w)) setSettingsWidth(w); },
  });

  // --- Persistentie van de rapportopties (localStorage, sleutel `ops-reportSettings`) -----------
  //
  // DE VALKUIL, en waarom deze vlag bestaat: hydrateren is asynchroon (`loadReportSettings()` geeft
  // een Promise), maar het opslaan hangt aan een effect dat bij ELKE waardewijziging vuurt — inclusief
  // de allereerste render. Zonder guard schrijft die eerste render de DEFAULTS over de opgeslagen
  // voorkeuren heen vóórdat het laden klaar is. Dan lijkt persistentie te werken (binnen één sessie
  // onthoudt hij alles), maar wist elke herstart stilletjes alles wat de gebruiker had ingesteld.
  // Daarom slaat het save-effect álles over zolang `hydratedRef` false is; hij gaat pas op true
  // nádat de opgeslagen waarden zijn toegepast.
  //
  // Een ref (geen state) volstaat: de vlag hoeft geen re-render te veroorzaken, en het save-effect
  // wordt toch al opnieuw uitgevoerd door de state-updates van de hydratatie zelf.
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadReportSettings().then(s => {
      // Unmount vóór het laden klaar was ⇒ niets toepassen (en `hydratedRef` blijft false, zodat een
      // eventueel na-ijlend save-effect ook niets schrijft).
      if (cancelled) return;
      // Eén batch state-updates ⇒ de preview-useEffect hieronder rendert precies één keer opnieuw
      // met de herstelde waarden (geen lus: de setters staan hier, niet in de preview-deps-keten).
      setReportType(s.reportType);
      setShowCritical(s.showCritical);
      setShowFloat(s.showFloat);
      setShowDeps(s.showDeps);
      setShowWeekends(s.showWeekends);
      setReportCompressNonWorkdays(s.compressNonWorkdays);
      setShowLegend(s.showLegend);
      setShowTaskNames(s.showTaskNames);
      setShowCompletion(s.showCompletion);
      setShowBaselineOverlay(s.showBaselineOverlay);
      setAutoFit(s.autoFit);
      setCustomZoom(s.customZoom);
      setPaperSize(s.paperSize);
      setOrientation(s.orientation);
      setRepeatHeader(s.repeatHeader);
      setTimelineColumns(s.timelineColumns);
      setReportFontScale(s.reportFontScale);
      setStatusLine(s.statusLine);
      setFollowView(s.followView);
      hydratedRef.current = true;
    }, () => {
      // Lezen kan falen (localStorage geblokkeerd of gepartitioneerd, quota-gedoe). Zonder deze
      // handler blijft `hydratedRef` dan voor ALTIJD false en slaat het save-effect de rest van de
      // sessie alles over: de gebruiker verstelt vijftien opties en er wordt nooit iets bewaard,
      // zonder enig signaal. We houden dan de defaults, maar zetten de vlag wél op true zodat
      // opslaan blijft werken — een volgende poging kan best wél slagen.
      //
      // BEWUST de tweede parameter van `.then` en GEEN `.catch` erachter: een `.catch` zou óók een
      // fout uit de hydratatie-body hierboven vangen. Dan zouden de eerste velden gehydrateerd zijn,
      // de rest op default staan, en zou de vlag alsnog op true gaan — waarna de eerstvolgende
      // wijziging die half gevulde mengeling als complete set terugschrijft over de opgeslagen
      // voorkeuren. Precies het dataverlies dat deze guard moet voorkomen.
      if (cancelled) return;
      hydratedRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  // Opslaan bij elke wijziging. Geen debounce: `setSetting` is een enkele synchrone
  // localStorage-schrijf van een klein object — goedkoper dan de preview-render die bij dezelfde
  // wijziging toch al draait. De eerste keer dat dit effect ná de hydratatie loopt schrijft het de
  // zojuist geladen waarden ongewijzigd terug; dat is bewust onschadelijk.
  useEffect(() => {
    if (!hydratedRef.current) return;
    // `.catch` omdat `setSetting` op een geblokkeerde/gepartitioneerde localStorage gooit:
    // zonder vangnet levert elke verstelde optie een onafgevangen rejection op. Opslaan is
    // best-effort — mislukt het, dan blijft de instelling gewoon binnen deze sessie werken.
    void saveReportSettings({
      reportType, showCritical, showFloat, showDeps, showWeekends, compressNonWorkdays: reportCompressNonWorkdays, showLegend,
      showTaskNames, showCompletion, showBaselineOverlay, autoFit, customZoom, paperSize, orientation,
      repeatHeader, timelineColumns, reportFontScale, statusLine, followView,
    }).catch(() => {});
  }, [reportType, showCritical, showFloat, showDeps, showWeekends, reportCompressNonWorkdays, showLegend, showTaskNames,
      showCompletion, showBaselineOverlay, autoFit, customZoom, paperSize, orientation, repeatHeader, timelineColumns,
      reportFontScale, statusLine, followView]);

  const milestoneRef = useRef<HTMLDivElement>(null);
  const varianceRef = useRef<HTMLDivElement>(null);

  // Gepagineerde Gantt-preview: dezelfde tegels als de PDF-export (gedeelde pagineer-engine).
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);
  const [previewTotalPages, setPreviewTotalPages] = useState(0);

  const locale = i18n.language;
  // Eén waardeobject is de contractgrens tussen UI, preview en export. Daardoor kan geen van beide
  // renderpaden per ongeluk een losse oude optie of vertaalde kop uit een eerdere render vasthouden.
  const options = useMemo<PrintOptions>(() => ({
    showCritical, showFloat, showDeps, showWeekends, showLegend,
    showTaskNames, showCompletion, showBaselineOverlay, autoFit, customZoom,
    paperSize, orientation, companyName,
    labels: {
      noTasks: t('noTasks'),
      printed: t('printed'),
      legend: {
        criticalPath: t('legend.criticalPath'),
        normal: t('legend.normal'),
        nearCritical: tTask('table.isNearCritical'),
        baseline: t('legend.baseline'),
        milestone: t('legend.milestone'),
        summary: t('legend.summary'),
        float: t('showFloat'),
        completion: t('showCompletion', { defaultValue: 'Completion' }),
        relationStyle: t('legend.relationStyle'),
      },
      tableHeaders: {
        rowNum: '#',
        wbs: t('tableHeaders.wbs'),
        taskName: t('tableHeaders.taskName'),
        start: t('tableHeaders.start'),
        end: t('tableHeaders.end'),
        duration: t('tableHeaders.duration'),
        completion: t('tableHeaders.completion', { defaultValue: 'Volt.' }),
      },
      page: t('page', { defaultValue: 'Pagina' }),
      of: t('of', { defaultValue: 'van' }),
      today: t('today', { defaultValue: 'Vandaag' }),
      statusDate: t('statusDateLabel', { defaultValue: 'Statusdatum' }),
      progressDate: t('progressDateLabel', { defaultValue: 'Voortgangsdatum' }),
    },
    localizedMonths: getLocalizedMonths(locale),
    localizedMonthsShort: getLocalizedMonthsShort(locale),
    locale,
    projectStartDate: project.startDate,
    projectEndDate: project.endDate,
    projectAuthor: project.author,
    dateNotation,
    // K-item 39: dezelfde weekdefinitie als de Gantt op het scherm. Zonder dit veld drukte het
    // rapport altijd ISO-weeknummers op maandag af, ook als de gebruiker "week begint op zondag"
    // had staan — hetzelfde project, twee antwoorden.
    weekStartDay,
    compressNonWorkdays: reportCompressNonWorkdays,
    timelineColumns,
    reportFontScale,
    // Issue #56 — welke relaties BEPALEND (driving) zijn is een `CPMResult`-veld dat bewust niet
    // gepersisteerd wordt; de printlaag kan het dus niet zelf afleiden en krijgt het hier door.
    // Bij een cyclus (`cpmResult.error`) of vóór de eerste berekening blijft het `undefined`, en
    // tekent het rapport alles neutraal doorgetrokken — dezelfde eerlijke terugval als het scherm.
    drivingSequenceIds: cpmResult && !cpmResult.error ? cpmResult.drivingSequenceIds : undefined,
    // #21/#54 — gedeelde balkkleurkeuze, statuslijn en volg-weergave. `rows` alléén bij followView: zonder
    // die optie tekent de export de volledige boom (oud gedrag, geen verrassingen).
    barColorSelection,
    activityCodeTypes: fieldCtx.activityCodeTypes,
    customFieldDefs: fieldCtx.customFieldDefs,
    taskTypeLabels: reportTaskTypeLabels,
    barColorNoneLabel: tTask('structure.none'),
    statusLine,
    statusDate,
    resources,
    assignments,
    baselineOverlay,
    rows: followView ? viewRows : undefined,
    barColorsLegendLabels: {
      criticalOutline: t('legend.criticalOutline', { defaultValue: 'Kritiek pad (rand)' }),
      categoriesMore: (n: number) => t('legend.categoriesMore', { count: n }),
    },
  }), [showCritical, showFloat, showDeps, showWeekends, showLegend, showTaskNames, showCompletion, showBaselineOverlay,
    autoFit, customZoom, paperSize, orientation, companyName, t, locale, project.startDate,
    project.endDate, project.author, dateNotation, weekStartDay, reportCompressNonWorkdays, timelineColumns, reportFontScale,
    cpmResult, barColorSelection, fieldCtx.activityCodeTypes, fieldCtx.customFieldDefs,
    reportTaskTypeLabels, tTask, statusLine, statusDate, resources,
    assignments, baselineOverlay, followView, viewRows]);

  // Bereken de Gantt-preview als gepagineerde papiervellen — via dezelfde pagineer-engine als de
  // PDF-export (paginateCanvasToTiles), zodat de preview WYSIWYG-identiek is aan de export.
  useEffect(() => {
    if (reportType !== 'gantt') {
      setPreviewPages([]);
      setPreviewTotalPages(0);
      return;
    }
    let cancelled = false;
    const renderPreview = () => {
      if (cancelled) return;
      const offscreen = document.createElement('canvas');
      // De eerste meting reserveert geen canvas. Op grond daarvan kiest de echte render een
      // begrensde bronresolutie. Eerder werd altijd eerst een volledige 1×-canvas en daarna een
      // 2×-canvas opgebouwd; bij veel rijen kon één klik op Auto-fit daardoor honderden MB's tot
      // GB's reserveren vóór `maxPages` aan de beurt kwam.
      const { width: logicalWidth, height: logicalHeight, tableWidth, headerHeight } = measurePrintReport(
        tasks, sequences, calendar, projectName, options,
      );
      const lowerPaper = options.paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1';
      const previewLimits = computePreviewRasterLimits(
        logicalWidth, logicalHeight, lowerPaper, options.orientation,
      );
      renderPrintCanvas(offscreen, tasks, sequences, calendar, projectName, options, previewLimits.renderScale);
      const tiles = paginateCanvasToTiles(offscreen, {
        paperSize: lowerPaper,
        orientation: options.orientation,
        mode: options.autoFit ? 'fit-width' : 'actual',
        logicalWidth,
        logicalHeight,
        frozenColumnWidthPx: tableWidth,
        // Kop herhalen per pagina (issue #25 punt 1): de hoogte komt uit de render zelf; 0 = niet
        // herhalen (oud gedrag). De raster-tak wil px, de vector-tak een boolean.
        repeatHeaderHeightPx: repeatHeader ? headerHeight : 0,
        timelineColumns: options.timelineColumns,
        supersample: 1, // preview: goedkoper; wordt toch verkleind weergegeven
        // De limiet hoort HIER, niet pas bij het uitsnijden hieronder: de pagineerder maakt per
        // pagina een volledig papier-canvas aan (A3 ≈ 4 MB RGBA), dus een rooster van 20×8 zou
        // ~640 MB rasteren waarvan we er 30 tonen — bij elke optiewijziging opnieuw. Met `maxPages`
        // worden de overige pagina's nooit getekend; `rows`/`cols` blijven het volledige rooster.
        maxPages: previewLimits.maxPages,
      });
      // Goedkope dubbele bodem: mocht de pagineer-limiet ooit wegvallen, dan toont de preview nog
      // steeds niet meer dan PREVIEW_MAX_PAGES vellen. Het echte werk zit in `maxPages` hierboven.
      const shown = tiles.pages;
      // De pagina-canvassen bevatten nu hun eigen pixels; maak de potentieel grootste tijdelijke
      // buffer vrij vóór `toDataURL` de previewstrings opbouwt.
      offscreen.width = 0;
      offscreen.height = 0;
      setPreviewPages(shown.map(page => ({
        dataUrl: page.toDataURL('image/png'),
        wPt: tiles.pageWidthPt,
        hPt: tiles.pageHeightPt,
      })));
      // Het VOLLEDIGE paginatotaal (dus niet `tiles.pages.length` — dat is met `maxPages` bewust
      // afgekapt): de gebruiker moet "5 van 160" kunnen zien, ook al rasteren we er maar 30.
      setPreviewTotalPages(tiles.rows * tiles.cols);
    };
    // Wacht op het gevendorde Inter-font (family 'InterPDF') vóór de eerste render, zodat
    // measureText/afkapping deterministisch is (§5.2). ensureInterLoaded is idempotent; de
    // cancelled-guard voorkomt dat een verouderde async-render na deps-wijziging/unmount nog toepast.
    void ensureInterLoaded().then(renderPreview);
    return () => { cancelled = true; };
  }, [reportType, tasks, sequences, calendar, projectName, options, repeatHeader]);

  const milestoneRows = useMilestoneRows();
  const varianceResult = useVarianceResult();

  /** Gedeelde PDF-schrijver: Tauri → save-dialoog + writeFile, web → blob-download. */
  const writePdf = useCallback(async (pdfBytes: Uint8Array, defaultName: string) => {
    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const picked = await save({
        defaultPath: defaultName,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });
      if (!picked) return;
      const savedPath = ensureExtension(picked, 'pdf');
      await writeFile(savedPath, pdfBytes);
    } else {
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = defaultName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleExportPDF = useCallback(async () => {
    // K7: de PDF-export schrijft CPM-datums naar derden — net als fileSlice.exportAs eerst een
    // stale schema doorrekenen (via getState, niet via een selector: de guard moet de actuele
    // store lezen op het klikmoment), en bij een cyclus afbreken zónder te exporteren. De
    // cpmResult.error-check is apart nodig omdat runCPM `scheduleStale` vóór de solve al op false
    // zet; een guard op alleen die vlag zou stil met oude task.time-waarden exporteren.
    if (useAppStore.getState().scheduleStale) useAppStore.getState().runCPM();
    const cpmError = useAppStore.getState().cpmResult?.error;
    if (cpmError) {
      // Zichtbaar maken is hier NIET optioneel: op het Rapport-tabblad is `GanttCanvas` niet
      // gemonteerd, dus de bestaande cyclus-toast vuurt hier niet en de knop zou anders gewoon
      // niets doen — precies het stille falen dat bevinding K8 aanklaagt. `cpmResult.error` is
      // al een vertaalde string, dus dit vraagt geen nieuwe i18n-sleutels.
      setExportError(cpmError);
      return;
    }
    setExportError(null);

    const lowerPaper = paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1';
    // Basisrichting van de export-taal: stuurt de bidi in het complexe RTL-tekst-pad van de vector-export.
    const exportBaseDir: 'ltr' | 'rtl' =
      RTL_LOCALES.includes((options.locale ?? '') as Locale) ? 'rtl' : 'ltr';

    // Zorg dat het gevendorde Inter-font geladen is vóór de offscreen render, zodat ook de
    // raster-export het deterministische Inter gebruikt (measureText-pariteit met de preview, §5.2).
    await ensureInterLoaded();

    if (reportType === 'gantt') {
      const mode = autoFit ? 'fit-width' : 'actual';

      // De raster-tak (JPEG-tegels) als betrouwbare terugval: exact het bestaande pad, uitgesplitst
      // zodat de vector-tak erop kan terugvallen bij een fout (bv. een glyph buiten Inter — echte
      // script-detectie is fase 4). Render offscreen op een vaste hoge schaal, onafhankelijk van het
      // scherm van de exporterende gebruiker (window.devicePixelRatio, vaak 1x). Eerste render (schaal
      // 1) levert de LOGISCHE maten + naam-kolombreedte; de tweede render het high-res raster.
      const exportRaster = (): Uint8Array => {
        const exportCanvas = document.createElement('canvas');
        const { width: logicalWidth, height: logicalHeight, tableWidth, headerHeight } = renderPrintCanvas(
          exportCanvas, tasks, sequences, calendar, projectName, options, 1,
        );
        const exportScale = computeHighResScale(logicalWidth, logicalHeight);
        renderPrintCanvas(exportCanvas, tasks, sequences, calendar, projectName, options, exportScale);
        return paginateCanvasToPdfBytes(exportCanvas, {
          paperSize: lowerPaper, orientation, mode,
          logicalWidth, logicalHeight, frozenColumnWidthPx: tableWidth,
          // Zelfde kopherhaling (px) en tijdlijn-spreiding als de preview en de vector-tak, zodat de
          // raster-terugval WYSIWYG gelijk is aan beide (issue #25 punt 1 + 5).
          repeatHeaderHeightPx: repeatHeader ? headerHeight : 0,
          timelineColumns,
        });
      };

      // Vector-tak (fase 2): échte vector-PDF met selecteerbare tekst + ingebedde Inter. Bij een fout
      // valt de export terug op raster zodat hij nooit stukloopt. Lazy import houdt pdf-lib/fontkit
      // uit de hoofdbundle (B2).
      let pdfBytes: Uint8Array;
      try {
        const [{ paginateVectorToPdfBytes }, regular, bold, arabicRegular, arabicBold] = await Promise.all([
          import('@/services/print/paginateVector'),
          getInterFontBytes(400),
          getInterFontBytes(700),
          getArabicFontBytes(400),
          getArabicFontBytes(700),
        ]);
        pdfBytes = await paginateVectorToPdfBytes(
          (make) => renderReport(make, tasks, sequences, calendar, projectName, options),
          {
            paperSize: lowerPaper,
            orientation,
            mode,
            baseDir: exportBaseDir,
            // Kop per pagina herhalen (issue #25 punt 1) + tijdlijn over N pagina's (punt 5).
            repeatHeader,
            timelineColumns,
          },
          { regular, bold },
          { regular: arabicRegular, bold: arabicBold },
        );
      } catch (err) {
        console.warn('[ReportPanel] Vector-PDF-export mislukt, terugval op raster:', describeVectorFallback(err));
        pdfBytes = exportRaster();
      }
      await writePdf(pdfBytes, `${fileBase}-planning.pdf`);
      return;
    }

    // Mijlpalen / afwijkingen (fase 3): vector-tabel-export — dezelfde kolomspec als de levende
    // DOM-tabel (MilestoneReport/VarianceReport), getekend via het renderReport-patroon en
    // gepagineerd door dezelfde paginateVectorToPdfBytes als de Gantt-tak hierboven. Bij een fout
    // valt de export terug op het BESTAANDE DOM-screenshot-pad (modern-screenshot), zodat de export
    // nooit stukloopt.
    const suffix = reportType === 'milestones' ? 'mijlpalen' : 'afwijkingen';

    const exportTableRaster = async (): Promise<Uint8Array> => {
      const node = reportType === 'milestones' ? milestoneRef.current : varianceRef.current;
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
      const prevTheme = rootEl.getAttribute('data-theme');
      rootEl.setAttribute('data-theme', 'light');
      const shot = await domToCanvas(node, { scale: pixelRatio, backgroundColor: '#ffffff' })
        .finally(() => {
          if (prevTheme !== null) rootEl.setAttribute('data-theme', prevTheme);
          else rootEl.removeAttribute('data-theme');
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
      const [{ paginateVectorToPdfBytes }, { makeTableRenderReport }, regular, bold, arabicRegular, arabicBold] = await Promise.all([
        import('@/services/print/paginateVector'),
        import('@/services/pdf/pdfTable'),
        getInterFontBytes(400),
        getInterFontBytes(700),
        getArabicFontBytes(400),
        getArabicFontBytes(700),
      ]);

      // Twee losse takken i.p.v. één ternaire spec: `makeTableRenderReport<Row>` is generiek over de
      // rijtype, en een samengevoegde union-spec zou TS niet meer aan één Row-type kunnen binden.
      if (reportType === 'milestones') {
        tablePdfBytes = await paginateVectorToPdfBytes(
          makeTableRenderReport({
            title: t('milestoneReport.title'),
            columns: buildMilestoneColumns(t, dd),
            rows: milestoneRows,
            emptyText: t('milestoneReport.empty'),
          }),
          { paperSize: lowerPaper, orientation, mode: 'fit-width', baseDir: exportBaseDir },
          { regular, bold },
          { regular: arabicRegular, bold: arabicBold },
        );
      } else {
        tablePdfBytes = await paginateVectorToPdfBytes(
          makeTableRenderReport({
            title: t('variance.title'),
            columns: buildVarianceColumns(t, dd),
            rows: varianceResult.rows,
            emptyText: t('variance.noBaseline'),
          }),
          { paperSize: lowerPaper, orientation, mode: 'fit-width', baseDir: exportBaseDir },
          { regular, bold },
          { regular: arabicRegular, bold: arabicBold },
        );
      }
    } catch (err) {
      console.warn('[ReportPanel] Vector-tabel-PDF-export mislukt, terugval op DOM-screenshot:', describeVectorFallback(err));
      tablePdfBytes = await exportTableRaster();
    }

    await writePdf(tablePdfBytes, `${fileBase}-${suffix}.pdf`);
  }, [reportType, projectName, fileBase, tasks, sequences, calendar, options, paperSize, orientation,
    autoFit, repeatHeader, timelineColumns, writePdf, t, dd, milestoneRows, varianceResult]);

  const criticalCount = tasks.filter(t => t.time.isCritical && t.childIds.length === 0).length;
  const leafCount = tasks.filter(t => t.childIds.length === 0).length;

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden bg-surface" style={{ position: 'relative' }}>
      {/* Sleepgrijpzone — zelfde patroon als de rechterpaneel-splitter in App.tsx en de tabel/
          chart-splitter in GanttCanvas: onzichtbare grijpzone over de rand (geen aparte balk,
          geen kleur, geen ruimtebeslag). Bewust een kind van de BUITENSTE container en niet van de
          instellingenkolom: die kolom scrollt (`overflow-y-auto`), en een zone die 4px buiten haar
          rand steekt telde daar mee als scrollbreedte — precies de horizontale scrollbar die issue
          #38 punt 3 meldt. `insetInlineStart` (i.p.v. `left`) houdt 'm in RTL (ar/fa) aan dezelfde
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
      />
      {/* Left: Settings panel — breedte sleepbaar (issue #38 punt 3). `min-w-0` op de kolom zelf
          voorkomt dat ZIJN eigen rijen de kolom breder duwen dan `settingsWidth`. */}
      <div
        className="flex-shrink-0 min-w-0 overflow-y-auto p-3 flex flex-col gap-3"
        style={{ width: settingsWidth, borderRight: '1px solid var(--theme-border)' }}
      >
        <span
          className="text-xs font-bold uppercase"
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--theme-text-muted)' }}
        >
          {t('title')}
        </span>

        {/* Rapporttype (fase 2.4): Gantt-afdruk of mijlpalen-overzicht */}
        <Select
          className="w-full min-w-0"
          aria-label={t('reportType.label')}
          value={reportType}
          onChange={v => setReportType(v as 'gantt' | 'milestones' | 'variance')}
          options={[
            { value: 'gantt', label: t('reportType.gantt') },
            { value: 'milestones', label: t('reportType.milestones') },
            { value: 'variance', label: t('reportType.variance') },
          ]}
        />

        {/* Project summary */}
        <div className="bg-surface-alt rounded-lg p-3" style={{ border: '1px solid var(--theme-border)' }}>
          <h3 className="ui-card-header !text-xs mb-2">{t('summary')}</h3>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {reportType === 'gantt' ? (
              <>
                <span className="text-text-secondary">{t('tasks')}</span>
                <span>{tasks.length}</span>
                <span className="text-text-secondary">{t('leafTasks')}</span>
                <span>{leafCount}</span>
                <span className="text-text-secondary">{t('critical')}</span>
                <span className="text-red-400 font-bold">{criticalCount}</span>
                <span className="text-text-secondary">{t('relations')}</span>
                <span>{sequences.length}</span>
              </>
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
        </div>

        {/* Report options */}
        {reportType === 'gantt' && (
        <div className="bg-surface-alt rounded-lg p-3" style={{ border: '1px solid var(--theme-border)' }}>
          <h3 className="ui-card-header !text-xs mb-2">{t('settings')}</h3>
          <div className="flex flex-col gap-2 text-xs">
            {/* Company name */}
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-text-secondary w-20 flex-shrink-0">{t('company', { defaultValue: 'Bedrijf:' })}</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder={t('companyPlaceholder', { defaultValue: 'Bedrijfsnaam' })}
                className="input flex-1 min-w-0 !text-xs !px-2 !py-1"
              />
            </div>

            {/* Author (read-only from project) */}
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-text-secondary w-20 flex-shrink-0">{t('author', { defaultValue: 'Auteur:' })}</label>
              <span className="flex-1 min-w-0 truncate px-2 py-1 text-xs text-text-secondary">{project.author || '-'}</span>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <label className="text-text-secondary w-20 flex-shrink-0">{t('paper')}</label>
              <Select
                className="flex-1 min-w-0"
                aria-label={t('paper')}
                value={paperSize}
                onChange={v => setPaperSize(v as 'A4' | 'A3' | 'A2' | 'A1')}
                options={[
                  { value: 'A4', label: 'A4' },
                  { value: 'A3', label: 'A3' },
                  { value: 'A2', label: 'A2' },
                  { value: 'A1', label: 'A1' },
                ]}
              />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-text-secondary w-20 flex-shrink-0">{t('orientation')}</label>
              <Select
                className="flex-1 min-w-0"
                aria-label={t('orientation')}
                value={orientation}
                onChange={v => setOrientation(v as 'landscape' | 'portrait')}
                options={[
                  { value: 'landscape', label: t('landscape') },
                  { value: 'portrait', label: t('portrait') },
                ]}
              />
            </div>

            {/* Lettergrootte van het rapport (issue #25 punt 4). Relatief bedoeld: bij een grotere
                letter groeien tekst, rijen en tabel op het vel en levert de tijdlijn breedte in. */}
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-text-secondary w-20 flex-shrink-0">{t('reportFontScaleLabel')}</label>
              <Select
                className="flex-1 min-w-0"
                aria-label={t('reportFontScaleLabel')}
                value={String(reportFontScale)}
                onChange={v => setReportFontScale(Number(v))}
                options={REPORT_FONT_SCALES.map(n => ({ value: String(n), label: `${n}%` }))}
              />
            </div>

            {/* Eén app-globale balkkleurkeuze voor View en Report. De veldlijst is exact Group. */}
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-text-secondary w-20 flex-shrink-0">{t('barColorModeLabel')}</label>
              <Select
                className="flex-1 min-w-0"
                aria-label={t('barColorModeLabel')}
                value={barColorSelection.mode}
                onChange={value => {
                  if (value === 'critical' || value === 'auto') {
                    const next = { mode: value } as const;
                    setUI({ barColorSelection: next });
                    void saveBarColorSelection(next);
                    return;
                  }
                  const field = barColorControl.effective.mode === 'category'
                    ? barColorControl.effective.field
                    : barColorFields[0]?.field;
                  if (!field) return;
                  const next = { mode: 'category', field } as const;
                  setUI({ barColorSelection: next });
                  void saveBarColorSelection(next);
                }}
                options={[
                  { value: 'critical', label: t('barColorMode_critical') },
                  { value: 'auto', label: t('barColorMode_auto') },
                  { value: 'category', label: t('barColorMode_category') },
                ]}
              />
            </div>
            {barColorSelection.mode === 'category' && barColorControl.effective.mode === 'category' && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-20 flex-shrink-0" aria-hidden="true" />
                <Select
                  className="flex-1 min-w-0"
                  aria-label={t('barColorFieldLabel')}
                  value={encodeFieldRef(barColorControl.effective.field)}
                  onChange={value => {
                    const next = { mode: 'category', field: decodeFieldRef(value) } as const;
                    setUI({ barColorSelection: next });
                    void saveBarColorSelection(next);
                  }}
                  options={barColorFields.map(option => ({
                    value: encodeFieldRef(option.field),
                    label: option.label,
                  }))}
                />
              </div>
            )}
            {barColorControl.missingField && (
              <p className="text-[10px] text-text-muted pl-[88px]" role="status">
                {t('barColorMissingField')}
              </p>
            )}

            {/* Statuslijn (issue #54 punt 1): letterlijk drie opties. Zonder statusdatum in het
                project tekent geen van beide iets — de hint maakt dat zichtbaar i.p.v. stil. */}
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-text-secondary w-20 flex-shrink-0">{t('statusLineLabel')}</label>
              <Select
                className="flex-1 min-w-0"
                aria-label={t('statusLineLabel')}
                value={statusLine}
                onChange={v => setStatusLine(v as typeof statusLine)}
                options={[
                  { value: 'none', label: t('statusLine_none') },
                  { value: 'statusDate', label: t('statusLine_statusDate') },
                  { value: 'progress', label: t('statusLine_progress') },
                ]}
              />
            </div>
            {statusLine !== 'none' && !statusDate && (
              <p className="text-[11px] text-amber-600 mt-0.5">{t('statusLineHint')}</p>
            )}

            {/* Volg weergave (issue #54 punt 2): export = wat het scherm toont (filter, groepering,
                sortering, inklapstatus). Uit (default) = de volledige takenboom, zoals altijd. */}
            <label className="flex items-center gap-2 mt-1 min-w-0">
              <input type="checkbox" checked={followView} onChange={e => setFollowView(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('followView')}</span>
            </label>

            {/* Auto-fit checkbox */}
            <label className="flex items-center gap-2 mt-1 min-w-0">
              <input type="checkbox" checked={autoFit} onChange={e => setAutoFit(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('autoFit', { defaultValue: 'Auto-fit op papier' })}</span>
            </label>

            {/* Custom zoom slider (only when auto-fit is off) */}
            {!autoFit && (
              <div className="flex items-center gap-2 min-w-0">
                <label className="text-text-secondary w-20 flex-shrink-0">{t('zoom', { defaultValue: 'Zoom:' })}</label>
                <input
                  type="range"
                  min={REPORT_MIN_ZOOM}
                  max={REPORT_MAX_ZOOM}
                  value={customZoom}
                  onChange={e => setCustomZoom(Number(e.target.value))}
                  className="flex-1 min-w-0"
                />
                <span className="w-8 flex-shrink-0 text-right">{customZoom}</span>
              </div>
            )}

            {/* Tijdlijn over N paginabreedtes (issue #25 punt 5). Alleen zinvol in fit-width-modus;
                in 'actual'-modus (autoFit uit) tegelt de export sowieso al horizontaal, daarom
                `disabled` — met een hint die dat uitlegt, zichtbaar zodra de keuze uitgeschakeld is. */}
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-text-secondary w-20 flex-shrink-0">{t('timelineColumnsLabel')}</label>
              <Select
                className="flex-1 min-w-0"
                aria-label={t('timelineColumnsLabel')}
                value={String(timelineColumns)}
                onChange={v => setTimelineColumns(Number(v))}
                disabled={!autoFit}
                options={[1, 2, 3, 4, 5, 6, 7, 8].map(n => ({
                  value: String(n),
                  label: t('timelineColumns', { count: n }),
                }))}
              />
            </div>
            {!autoFit && (
              <span className="text-text-secondary">{t('timelineColumnsHint')}</span>
            )}

            {/* Kop op elke pagina herhalen (issue #25 punt 1) */}
            <label className="flex items-center gap-2 mt-1 min-w-0">
              <input type="checkbox" checked={repeatHeader} onChange={e => setRepeatHeader(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('repeatHeader')}</span>
            </label>

            <label className="flex items-center gap-2 mt-1 min-w-0">
              <input type="checkbox" checked={showTaskNames} onChange={e => setShowTaskNames(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('showTaskNames', { defaultValue: 'Taaknamen op staafjes' })}</span>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={showCompletion} onChange={e => setShowCompletion(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('showCompletion', { defaultValue: 'Voltooiing tonen' })}</span>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <input data-ops-report-baseline-overlay type="checkbox" checked={showBaselineOverlay} onChange={e => setShowBaselineOverlay(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('showBaselineOverlay')}</span>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={showCritical} onChange={e => setShowCritical(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('showCriticalPath')}</span>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={showFloat} onChange={e => setShowFloat(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('showFloat')}</span>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={showDeps} onChange={e => setShowDeps(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('showDependencies')}</span>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <input data-ops-report-compress-workdays type="checkbox" checked={reportCompressNonWorkdays} onChange={e => setReportCompressNonWorkdays(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{tCommon('settings.compressNonWorkdays')}</span>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={showWeekends} onChange={e => setShowWeekends(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('showWeekends')}</span>
            </label>
            <label className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} className="accent-accent flex-shrink-0" />
              <span className="min-w-0">{t('showLegend')}</span>
            </label>
          </div>
        </div>
        )}

        {/* Action buttons — alle rapporttypes exporteren naar PDF (geen uitprinten meer). */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { void handleExportPDF(); }}
            className="px-4 py-2 bg-accent text-accent-on rounded-lg hover:bg-accent-hover text-xs font-medium"
            style={{ boxShadow: 'var(--shadow-glow)' }}
          >
            {t('exportPDF', { defaultValue: 'Exporteer PDF' })}
          </button>
          {exportError && (
            <div className="text-xs" style={{ color: 'var(--error)' }} role="alert">
              {exportError}
            </div>
          )}
        </div>
      </div>

      {/* Right: Live preview */}
      <div className="flex-1 overflow-auto p-4" style={{ background: 'var(--theme-bg)' }}>
        {reportType === 'gantt' ? (
          <div className="flex flex-col items-center gap-4">
            {previewPages.map((page, i) => (
              <div
                key={i}
                className="bg-white"
                style={{
                  width: 'min(100%, 900px)',
                  aspectRatio: `${page.wPt} / ${page.hPt}`,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-card)',
                  overflow: 'hidden',
                }}
              >
                <img src={page.dataUrl} alt="" style={{ display: 'block', width: '100%', height: '100%' }} />
              </div>
            ))}
            {previewTotalPages > previewPages.length && (
              <div className="text-xs text-text-secondary text-center py-2">
                {/* `count` (geen eigen `n`) zodat i18next echt pluraliseert: de sleutel bestaat nu
                    in alle 14 locales met de juiste CLDR-categorieën, dus de hardgecodeerde
                    Nederlandse `defaultValue` — die iedereen ongeacht taal te zien kreeg — is weg. */}
                {t('previewPageLimit', { count: previewTotalPages - previewPages.length })}
              </div>
            )}
          </div>
        ) : reportType === 'milestones' ? (
          <div
            ref={milestoneRef}
            className="bg-surface p-4"
            style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 960 }}
          >
            <h3 className="ui-card-header !text-xs mb-3">{t('milestoneReport.title')}</h3>
            <MilestoneReport />
          </div>
        ) : (
          <div
            ref={varianceRef}
            className="bg-surface p-4"
            style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 1100 }}
          >
            <h3 className="ui-card-header !text-xs mb-3">{t('variance.title')}</h3>
            <VarianceReport />
          </div>
        )}
      </div>
    </div>
  );
}
