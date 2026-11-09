import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { Dialog, DialogHelpButton } from '@/components/common/Dialog';
import type { ExternalLink } from '@/types/task';
import { externalSourceSide, sourceAnchorDate } from '@/engine/externalLinks';
import type { ExternalSourceRead } from '@/state/externalSource';
import { formatExternalLagShort, parseExternalLagInput } from '@/engine/taskGrid/relationFormat';
import { effectiveCalendarOf } from '@/utils/taskDuration';
import { isHourModeCalendar } from '@/types/calendar';
import { parseableHourSuffix } from '@/utils/durationFormat';
import { buildImportLabels } from '@/i18n/importLabels';
import { EXTERNAL_LINKS_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { isTauri } from '@/utils/platform';
import { siteStorageAvailable, type SiteFileInfo } from '@/services/fileAccess/siteHost';
import { rememberExternalSourceHandle } from '@/services/fileAccess/externalSourceHandles';

type Direction = ExternalLink['direction'];
type RelType = ExternalLink['relType'];

/** Waarde voor native date/datetime-local zonder een bestaande canonieke ankerwaarde te muteren. */
export function externalAnchorInputValue(value: string, hourMode: boolean): string {
  if (!value) return '';
  if (!hourMode) return value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
  const minute = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(value);
  return minute?.[1] ?? value;
}

/** Een open dialoog mag nooit naar een ander document schrijven, ook niet als beide documenten
 * toevallig dezelfde taak-id bevatten. */
export function externalLinkDialogDocumentIsCurrent(
  openedDocumentId: string,
  currentDocumentId: string,
): boolean {
  return openedDocumentId === currentDocumentId;
}

export interface ManualExternalLinkSubmission {
  existing?: ExternalLink;
  direction: Direction;
  relType: RelType;
  lag: Pick<ExternalLink, 'lagDays' | 'lagMinutes'>;
  projectId: string;
  taskId: string;
  taskName: string;
  anchor: string;
  anchorTouched: boolean;
}

/** Bouwt de handmatige submitwaarde zonder oude bronvelden stil door een nieuwe identiteit te mengen. */
export function buildManualExternalLinkSubmission({
  existing, direction, relType, lag, projectId, taskId, taskName, anchor, anchorTouched,
}: ManualExternalLinkSubmission): Omit<ExternalLink, 'id'> {
  const normalizedProjectId = projectId.trim();
  const normalizedTaskId = taskId.trim();
  const normalizedTaskName = taskName.trim();
  const sameIdentity = existing?.sourceRef.projectId === normalizedProjectId
    && existing.sourceRef.taskId === normalizedTaskId;
  const sourceRef: ExternalLink['sourceRef'] = sameIdentity && existing
    ? {
        projectId: normalizedProjectId,
        ...(existing.sourceRef.projectName ? { projectName: existing.sourceRef.projectName } : {}),
        taskId: normalizedTaskId,
        ...(normalizedTaskName ? { taskName: normalizedTaskName } : {}),
        ...(existing.sourceRef.filePath ? { filePath: existing.sourceRef.filePath } : {}),
        ...(existing.sourceRef.siteFileId ? { siteFileId: existing.sourceRef.siteFileId } : {}),
      }
    : {
        projectId: normalizedProjectId,
        taskId: normalizedTaskId,
        ...(normalizedTaskName ? { taskName: normalizedTaskName } : {}),
      };
  // De herkomst (keuze 4) hoort bij het anker: blijft het anker uit de bron staan, dan blijft ook zijn
  // herkomst. Vult de planner zelf een anker in, dan komt het niet meer uit een versie van de bron.
  const keepProvenance = !!existing && sameIdentity && !anchorTouched;
  return {
    direction, relType, ...lag,
    anchorDate: existing && !anchorTouched
      ? (sameIdentity ? existing.anchorDate : '')
      : anchor,
    sourceRef,
    sourceMissing: sameIdentity && existing ? existing.sourceMissing : true,
    ...(keepProvenance && existing.sourceVersion !== undefined ? { sourceVersion: existing.sourceVersion } : {}),
    ...(keepProvenance && existing.anchorReadAt !== undefined ? { anchorReadAt: existing.anchorReadAt } : {}),
  };
}

/**
 * Externe (cross-project) koppeling toevoegen. Twee routes in één dialoog:
 *  1. Kies een RECENT bestand of *Bronbestand kiezen…* → we lezen het ALLEEN-LEZEN in (geen document-open)
 *     en tonen de taaklijst → kies taak + relType + lag; het anker leest automatisch de juiste
 *     brontaak-datum (start/finish per richting+relType). Op de desktop geeft de kiezer een pad (zoals een
 *     recent bestand); in de browser zonder host leest de app het gekozen bestand meteen, zonder pad: de
 *     koppeling herkent haar bron dan op project-id, en Chromium onthoudt het handvat (stap 1.8).
 *     Draait de app op een site (een host met opslag, stap 1.9), dan is de bronroute *Project op de site*: de
 *     app vraagt de host om de lijst (`list`, "dezelfde map"), de planner kiest een project en daarna een taak.
 *     De app leest de bron met `open(id)` alleen-lezen; de koppeling krijgt het site-id, geen pad.
 *  2. HANDMATIG (fallback): plak project-id/taak-id + een ankerdatum — werkt ook zonder bronbestand
 *     (en in de web-build waar bestand-lezen niet kan).
 */
export function ExternalLinkDialog({ taskId, linkId, onClose }: { taskId: string; linkId?: string; onClose: () => void }) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const recentFiles = useAppStore((s) => s.recentFiles);
  const activeDocumentId = useAppStore((s) => s.activeDocumentId);
  const openedDocumentId = useRef(activeDocumentId).current;
  const tasks = useAppStore((s) => s.tasks);
  const calendar = useAppStore((s) => s.calendar);
  const calendars = useAppStore((s) => s.calendars);

  const parseExternalSource = useAppStore((s) => s.parseExternalSource);
  const chooseExternalSourceFile = useAppStore((s) => s.chooseExternalSourceFile);
  const listExternalSiteSources = useAppStore((s) => s.listExternalSiteSources);
  const parseExternalSiteSource = useAppStore((s) => s.parseExternalSiteSource);
  const addExternalLink = useAppStore((s) => s.addExternalLink);
  const updateExternalLink = useAppStore((s) => s.updateExternalLink);
  const existing = tasks.find(task => task.id === taskId)?.externalLinks?.find(link => link.id === linkId);
  const ownerTask = tasks.find(task => task.id === taskId);
  const ownerHourMode = !!ownerTask
    && isHourModeCalendar(effectiveCalendarOf(ownerTask, calendar, calendars));

  // Gekozen paden (desktop, *Bronbestand kiezen…*) die niet in de recente bestanden staan.
  const [chosenPaths, setChosenPaths] = useState<string[]>([]);
  // Alleen pad-refs zijn read-only te parsen (parseExternalSource is Tauri-only).
  const recent = useMemo(
    () => [
      ...recentFiles.flatMap((e) => (e.ref.kind === 'path' ? [{ id: e.id, name: e.name, path: e.ref.path }] : [])),
      ...chosenPaths
        .filter(path => !recentFiles.some(e => e.ref.kind === 'path' && e.ref.path === path))
        .map(path => ({ id: `chosen:${path}`, name: path.split(/[\\/]/).pop() || path, path })),
    ],
    [recentFiles, chosenPaths],
  );
  // *Bronbestand kiezen…* (stap 1.8): op de desktop altijd; in de browser alleen zonder host. Met een host
  // komt de bron van de site (stap 1.9).
  const canChooseFile = isTauri() || !siteStorageAvailable();
  // Stap 1.9: met een host komt de bron van de site. Vastgelegd bij het openen van de dialoog.
  const [siteMode] = useState(() => !isTauri() && siteStorageAvailable());
  // De projecten op de site: `undefined` = wordt geladen, `null` = de site gaf geen lijst.
  const [siteFiles, setSiteFiles] = useState<SiteFileInfo[] | null | undefined>(undefined);
  useEffect(() => {
    if (!siteMode) return;
    let cancelled = false;
    void listExternalSiteSources().then((files) => { if (!cancelled) setSiteFiles(files); });
    return () => { cancelled = true; };
  }, [listExternalSiteSources, siteMode]);

  const [direction, setDirection] = useState<Direction>(existing?.direction ?? 'predecessor');
  const [relType, setRelType] = useState<RelType>(existing?.relType ?? 'FS');
  const [lag, setLag] = useState<string>(
    existing ? formatExternalLagShort(existing, parseableHourSuffix(tCommon('duration.suffixHour'))) : '0d',
  );
  const existingRecentPath = existing?.sourceRef.filePath
    && recent.some(file => file.path === existing.sourceRef.filePath);
  const [manual, setManual] = useState<boolean>(() => !existingRecentPath && !(siteMode && existing?.sourceRef.siteFileId));
  const modeInited = useRef(false);
  useEffect(() => {
    if (modeInited.current) return;
    if (existing) { modeInited.current = true; return; }
    if (recent.length > 0 || siteMode) { setManual(false); modeInited.current = true; }
  }, [existing, recent.length, siteMode]);
  const sourceTabEnabled = recent.length > 0 || canChooseFile || siteMode;

  // Bron-route
  const [sourceFile, setSourceFile] = useState<string>(existing?.sourceRef.filePath ?? '');
  const [loading, setLoading] = useState<boolean>(false);
  const [readSource, setSource] = useState<ExternalSourceRead | null>(null);
  const [sourceTaskId, setSourceTaskId] = useState<string>('');
  // Een bestand dat de planner in de browser koos: al gelezen, zonder pad, met het handvat (Chromium).
  const [picked, setPicked] = useState<{ source: ExternalSourceRead; handle: FileSystemFileHandle | null } | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [chooseFailed, setChooseFailed] = useState(false);
  // Een project op de site (stap 1.9): het site-id en de gelezen bron.
  const [siteFileId, setSiteFileId] = useState<string>(siteMode ? existing?.sourceRef.siteFileId ?? '' : '');
  const [siteSource, setSiteSource] = useState<ExternalSourceRead | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteReadFailed, setSiteReadFailed] = useState(false);
  const source = picked?.source ?? (siteMode ? siteSource : readSource);

  const chooseFile = () => {
    setChooseFailed(false);
    setChoosing(true);
    void chooseExternalSourceFile(buildImportLabels(tCommon)).then((chosen) => {
      setChoosing(false);
      if (!externalLinkDialogDocumentIsCurrent(openedDocumentId, useAppStore.getState().activeDocumentId)) return;
      if (chosen.kind === 'failed') { setChooseFailed(true); return; }
      if (chosen.kind === 'path') {
        setPicked(null);
        setChosenPaths(paths => (paths.includes(chosen.filePath) ? paths : [...paths, chosen.filePath]));
        setSourceFile(chosen.filePath);
        return;
      }
      if (chosen.kind === 'file') {
        setPicked({ source: chosen.source, handle: chosen.handle });
        setSourceTaskId(chosen.source.tasks.some(task => task.id === existing?.sourceRef.taskId)
          ? existing!.sourceRef.taskId
          : chosen.source.tasks[0]?.id ?? '');
      }
    });
  };

  useEffect(() => {
    if (!externalLinkDialogDocumentIsCurrent(openedDocumentId, activeDocumentId)) onClose();
  }, [activeDocumentId, onClose, openedDocumentId]);

  // Handmatige fallback
  const [manualProjectId, setManualProjectId] = useState<string>(existing?.sourceRef.projectId ?? '');
  const [manualTaskId, setManualTaskId] = useState<string>(existing?.sourceRef.taskId ?? '');
  const [manualTaskName, setManualTaskName] = useState<string>(existing?.sourceRef.taskName ?? '');
  const [manualAnchor, setManualAnchor] = useState<string>(() => externalAnchorInputValue(
    existing?.anchorDate ?? '', ownerHourMode,
  ));
  const [manualAnchorTouched, setManualAnchorTouched] = useState(false);
  const updateManualAnchor = (value: string) => {
    setManualAnchor(value);
    setManualAnchorTouched(true);
  };
  useEffect(() => {
    if (manualAnchorTouched) return;
    setManualAnchor(current => externalAnchorInputValue(existing?.anchorDate ?? current, ownerHourMode));
  }, [existing?.anchorDate, manualAnchorTouched, ownerHourMode]);

  useEffect(() => {
    let cancelled = false;
    // Een andere keuze: de vorige bron geldt niet meer (review #859 ronde 1). Anders bleef *Koppeling toevoegen*
    // met de vorige bron, taak en het vorige anker beschikbaar zolang de nieuwe bron gelezen werd.
    setSource(null);
    if (manual || !sourceFile) { setSourceTaskId(''); setLoading(false); return; }
    setLoading(true);
    void parseExternalSource(sourceFile, buildImportLabels(tCommon)).then((res) => {
      if (cancelled || !externalLinkDialogDocumentIsCurrent(
        openedDocumentId,
        useAppStore.getState().activeDocumentId,
      )) return;
      setSource(res);
      setSourceTaskId(res?.tasks.some(task => task.id === existing?.sourceRef.taskId)
        ? existing!.sourceRef.taskId
        : res?.tasks[0]?.id ?? '');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [existing, manual, openedDocumentId, parseExternalSource, sourceFile, tCommon]);

  useEffect(() => {
    let cancelled = false;
    setSiteReadFailed(false);
    // Een andere keuze: de vorige bron geldt niet meer (zie het effect hierboven).
    setSiteSource(null);
    if (!siteMode || manual || !siteFileId) { setSiteLoading(false); return; }
    setSiteLoading(true);
    void parseExternalSiteSource(siteFileId, buildImportLabels(tCommon)).then((res) => {
      if (cancelled || !externalLinkDialogDocumentIsCurrent(openedDocumentId, useAppStore.getState().activeDocumentId)) return;
      setSiteLoading(false);
      setSiteSource(res);
      setSiteReadFailed(!res);
      setSourceTaskId(res?.tasks.some(task => task.id === existing?.sourceRef.taskId)
        ? existing!.sourceRef.taskId
        : res?.tasks[0]?.id ?? '');
    });
    return () => { cancelled = true; };
  }, [existing, manual, openedDocumentId, parseExternalSiteSource, siteFileId, siteMode, tCommon]);
  // De bestaande bron van deze koppeling staat in de keuzelijst, ook als de site haar niet meer noemt.
  const siteOptions = useMemo(() => {
    const files = (siteFiles ?? []).map(file => ({ id: file.id, name: file.name }));
    const own = existing?.sourceRef.siteFileId;
    if (own && !files.some(file => file.id === own)) {
      files.unshift({ id: own, name: existing.sourceRef.projectName || own });
    }
    return files;
  }, [existing, siteFiles]);

  const srcTask = source?.tasks.find((x) => x.id === sourceTaskId) ?? null;
  // De gelezen bron hoort bij de keuze van nu, en er wordt niets meer gelezen of gekozen (review #859 ronde 1):
  // een gekozen bestand (browser), het gekozen project op de site, of het gekozen pad.
  const sourceIsCurrent = !loading && !choosing && !siteLoading && (picked
    ? source === picked.source
    : siteMode ? source?.siteFileId === siteFileId : source?.filePath === sourceFile);
  // Hetzelfde anker als "Bron vernieuwen" (`sourceAnchorDate`): een rekendatum, niet de getoonde
  // start; voor een externe opvolger de laatst toelaatbare datum van de brontaak.
  const anchorPreview = srcTask ? sourceAnchorDate({ direction, relType }, srcTask, source ?? undefined) : manualAnchor;

  const parsedLag = parseExternalLagInput(lag);
  const originalSide = existing ? externalSourceSide(existing.direction, existing.relType) : null;
  const sideChanged = originalSide !== null && originalSide !== externalSourceSide(direction, relType);
  const manualIdentityChanged = !!existing
    && (existing.sourceRef.projectId !== manualProjectId.trim()
      || existing.sourceRef.taskId !== manualTaskId.trim());
  const canAdd = !!ownerTask && (!linkId || !!existing) && parsedLag !== null && (manual
    ? manualProjectId.trim() !== '' && manualTaskId.trim() !== '' && manualAnchor.trim() !== ''
      && ((!sideChanged && !manualIdentityChanged) || manualAnchorTouched)
    : !!srcTask && sourceIsCurrent);
  const hourMode = ownerHourMode;

  /** Bewaart de koppeling en sluit; `false` = niets bewaard (dan blijft de dialoog open). */
  const submit = (): boolean => {
    if (!externalLinkDialogDocumentIsCurrent(
      openedDocumentId,
      useAppStore.getState().activeDocumentId,
    )) {
      onClose();
      return false;
    }
    if (!canAdd) return false;
    if (!parsedLag) return false;
    const link: Omit<ExternalLink, 'id'> = manual
      ? buildManualExternalLinkSubmission({
          existing, direction, relType, lag: parsedLag,
          projectId: manualProjectId, taskId: manualTaskId, taskName: manualTaskName,
          anchor: manualAnchor, anchorTouched: manualAnchorTouched,
        })
      : {
          direction, relType, ...parsedLag, anchorDate: anchorPreview,
          sourceRef: {
            projectId: source!.projectId,
            projectName: source!.projectName,
            taskId: srcTask!.id,
            taskName: srcTask!.name,
            // Een bron uit de browser heeft geen pad: de koppeling herkent haar op project-id (stap 1.8).
            ...(source!.filePath ? { filePath: source!.filePath } : {}),
            // Een bron op de site: het vaste id op de site, geen pad (stap 1.9).
            ...(source!.siteFileId ? { siteFileId: source!.siteFileId } : {}),
          },
          sourceMissing: false,
          // Herkomst (keuze 4): het anker komt uit deze versie van het bronbestand.
          ...(source!.version !== undefined ? { sourceVersion: source!.version } : {}),
          ...(source!.readAt !== undefined ? { anchorReadAt: source!.readAt } : {}),
        };
    if (linkId) {
      if (!existing || !updateExternalLink(taskId, linkId, link)) return false;
    } else addExternalLink(taskId, link);
    // Chromium: het handvat onder het project-id van de bron, voor later verversen en het vangnet.
    if (!manual && picked?.handle) void rememberExternalSourceHandle(picked.source.projectId, picked.handle);
    onClose();
    return true;
  };

  return (
    <Dialog
      onCancel={onClose}
      onConfirm={submit}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-testid': 'external-link-dialog' }}
    >
        {/* Kop */}
        <div className="flex items-center justify-between px-4" style={{ minHeight: 44, borderBottom: '1px solid var(--theme-border)' }}>
          <span className="ui-card-header flex items-center gap-2"><Icon id="planning.external-relation" size={14} />{t('externalLinks.dialogTitle')}</span>
          <span className="flex items-center gap-1">
          {/* ?-knop: altijd eerst Opslaan / Annuleren / Terug — een nieuwe koppeling bestaat pas na Opslaan. */}
          <DialogHelpButton help={{ articleId: EXTERNAL_LINKS_HELP_ARTICLE_ID, confirmLeave: { onSave: submit } }} onClose={onClose} />
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
            aria-label={tCommon('close')}
            title={tCommon('close')}
          >
            <Icon id="ui.close" size={16} />
          </button>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-4">
          {/* Bron vs handmatig */}
          <div className="flex gap-2">
            <button
              className={`btn btn--sm flex-1 ${!manual ? 'btn--primary' : ''}`}
              disabled={!sourceTabEnabled}
              onClick={() => setManual(false)}
              style={{ fontWeight: 600, opacity: !sourceTabEnabled ? 0.5 : undefined }}
              data-ops-external-source-tab
            >{siteMode ? t('externalLinks.siteProject') : t('externalLinks.sourceFile')}</button>
            <button
              className={`btn btn--sm flex-1 ${manual ? 'btn--primary' : ''}`}
              onClick={() => setManual(true)}
              style={{ fontWeight: 600 }}
            >{t('externalLinks.manualTitle')}</button>
          </div>

          {!manual && (
            <>
              {recent.length > 0 && (
                <label className="flex flex-col gap-1">
                  <span className="text-text-muted">{t('externalLinks.pickRecent')}</span>
                  <select
                    className="input"
                    value={picked ? '' : sourceFile}
                    onChange={(e) => { setPicked(null); setChooseFailed(false); setSourceFile(e.target.value); }}
                  >
                    <option value="">—</option>
                    {recent.map((r) => <option key={r.id} value={r.path}>{r.name}</option>)}
                  </select>
                </label>
              )}
              {siteMode && (
                <label className="flex flex-col gap-1">
                  <span className="text-text-muted">{t('externalLinks.siteProjectPick')}</span>
                  <select
                    className="input"
                    value={siteFileId}
                    onChange={(e) => setSiteFileId(e.target.value)}
                    disabled={siteFiles === undefined}
                    data-ops-external-site-source
                  >
                    <option value="">—</option>
                    {siteOptions.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}
                  </select>
                </label>
              )}
              {siteMode && siteFiles === null && (
                <span className="!text-small" style={{ color: 'var(--error)' }} role="alert">{t('externalLinks.siteListFailed')}</span>
              )}
              {siteMode && siteFiles !== undefined && siteFiles !== null && siteOptions.length === 0 && (
                <span className="!text-small text-text-muted">{t('externalLinks.siteNoProjects')}</span>
              )}
              {siteReadFailed && (
                <span className="!text-small" style={{ color: 'var(--error)' }} role="alert">{t('externalLinks.chooseSourceFailed')}</span>
              )}
              {canChooseFile && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={chooseFile}
                    disabled={choosing}
                    data-ops-external-source-choose
                  >{t('externalLinks.chooseSourceFile')}</button>
                  {picked && <span className="truncate" data-ops-external-source-chosen>{picked.source.fileName ?? picked.source.projectName}</span>}
                </div>
              )}
              {chooseFailed && (
                <span className="!text-small" style={{ color: 'var(--error)' }} role="alert">{t('externalLinks.chooseSourceFailed')}</span>
              )}
              <p className="!text-small text-text-muted flex items-center gap-1"><Icon id="status.info" size={11} lucide={{ icon: 'FileDown' }} />{t('externalLinks.readOnlyNote')}</p>
              {(loading || choosing || siteLoading) && <span className="text-text-muted">{t('externalLinks.loadingTasks')}</span>}
              {source && (
                <label className="flex flex-col gap-1">
                  <span className="text-text-muted">{t('externalLinks.sourceTask')}</span>
                  <select className="input" value={sourceTaskId} onChange={(e) => setSourceTaskId(e.target.value)}>
                    {source.tasks.map((tk) => <option key={tk.id} value={tk.id}>{tk.wbsCode ? tk.wbsCode + ' ' : ''}{tk.name}</option>)}
                  </select>
                </label>
              )}
            </>
          )}

          {manual && (
            <>
              <p className="!text-small text-text-muted">{t('externalLinks.manualHint')}</p>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.projectId')}</span>
                <input className="input" value={manualProjectId} onChange={(e) => setManualProjectId(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.taskId')}</span>
                <input className="input" value={manualTaskId} onChange={(e) => setManualTaskId(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.taskName')}</span>
                <input className="input" value={manualTaskName} onChange={(e) => setManualTaskName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.anchorDate')}</span>
                <input
                  className="input"
                  type={hourMode ? 'datetime-local' : 'date'}
                  value={manualAnchor}
                  // Native datevelden in sommige webviews publiceren hun afgeronde ISO-waarde via
                  // `input` en pas later (of niet) via `change`. Beide routes zijn idempotent en
                  // houden dezelfde gecontroleerde React-state bij.
                  onInput={(e) => updateManualAnchor(e.currentTarget.value)}
                  onChange={(e) => updateManualAnchor(e.currentTarget.value)}
                />
                {sideChanged && !manualAnchorTouched && (
                  <span className="!text-small" style={{ color: 'var(--warning, #d97706)' }}>
                    {t('externalLinks.chooseNewAnchorAfterSideChange')}
                  </span>
                )}
              </label>
            </>
          )}

          {/* Richting / relType / lag (voor beide routes) */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t('externalLinks.direction')}</span>
              <select className="input" value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                <option value="predecessor">{t('externalLinks.directionPredecessor')}</option>
                <option value="successor">{t('externalLinks.directionSuccessor')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t('externalLinks.relType')}</span>
              <select className="input" value={relType} onChange={(e) => setRelType(e.target.value as RelType)}>
                {(['FS', 'SS', 'FF', 'SF'] as RelType[]).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">{t('externalLinks.lag')}</span>
            <input className="input !w-24" type="text" value={lag} onChange={(e) => setLag(e.target.value)} placeholder={t('externalLinks.lagPlaceholder')} />
          </label>

          {anchorPreview && !manual && (
            <div className="!text-body text-text-dim">{t('externalLinks.anchorDate')}: <b>{anchorPreview}</b></div>
          )}
        </div>

        {/* Voet */}
        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--theme-border)' }}>
          <button className="btn btn--sm" onClick={onClose}>{t('externalLinks.cancel')}</button>
          <button className="btn btn--sm btn--primary" onClick={submit} disabled={!canAdd} data-testid="external-link-add"
            style={!canAdd ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {existing ? tCommon('save', { defaultValue: 'Opslaan' }) : t('externalLinks.add')}
          </button>
        </div>
    </Dialog>
  );
}
