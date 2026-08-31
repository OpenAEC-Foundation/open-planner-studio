import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import {
  documentTitle, documentColor, documentCode, buildStats, buildThumbnail,
  untitledOrdinals, displayDocumentTitle,
  type ThumbBar,
} from '@/utils/documents';

export interface DocumentCard {
  id: string;
  title: string;
  fileName: string | null; // bestandsnaam (met extensie) of null bij niet-opgeslagen
  code: string;
  color: string;
  isActive: boolean;
  isDirty: boolean;
  taskCount: number;
  milestoneCount: number;
  criticalCount: number;
  endDate: string | null;
  thumb: ThumbBar[];
}

/**
 * Bouwt de afgeleide kaart-info voor elk geopend document. Het actieve
 * document leest uit de top-level store-velden; inactieve uit hun payload.
 * Eén bron voor de tabstrip, de projectbalk, de flyout én het overzicht.
 */
export function useDocumentCards(): DocumentCard[] {
  const { t } = useTranslation('common');
  const documents = useAppStore((s) => s.documents);
  const activeId = useAppStore((s) => s.activeDocumentId);
  // Top-level (actief document) — laat de kaarten meeveranderen bij elke edit.
  const project = useAppStore((s) => s.project);
  const tasks = useAppStore((s) => s.tasks);
  const cpmResult = useAppStore((s) => s.cpmResult);
  const filePath = useAppStore((s) => s.filePath);
  const isDirty = useAppStore((s) => s.isDirty);

  return useMemo(() => {
    const untitled = t('project.untitled');
    const fileBase = (p: string | null) => (p ? p.split(/[\\/]/).pop() || p : null);

    // Rauwe titels eerst, zodat naamloze documenten onderling een volgnummer kunnen krijgen: twee
    // lege tabbladen (bv. na dupliceren van een naamloos project) heetten anders allebei
    // "Nieuwe planning". Zelfde afleiding als `getOpenDocuments()` in documentSlice.
    const rawTitles = documents.map((entry) => {
      const active = entry.id === activeId;
      const p = active ? project : entry.payload!.project;
      const fp = active ? filePath : entry.payload!.filePath;
      return documentTitle(fp, p.name);
    });
    const ordinals = untitledOrdinals(rawTitles);

    return documents.map((entry, i) => {
      const active = entry.id === activeId;
      const p = active ? project : entry.payload!.project;
      const tl = active ? tasks : entry.payload!.tasks;
      const cpm = active ? cpmResult : entry.payload!.cpmResult;
      const fp = active ? filePath : entry.payload!.filePath;
      const dirty = active ? isDirty : entry.payload!.isDirty;

      const color = documentColor(p.id);
      const title = displayDocumentTitle(rawTitles[i], ordinals[i], untitled);
      const stats = buildStats(tl, cpm, p.endDate);

      return {
        id: entry.id,
        title,
        fileName: fileBase(fp),
        code: documentCode(title),
        color,
        isActive: active,
        isDirty: dirty,
        taskCount: stats.taskCount,
        milestoneCount: stats.milestoneCount,
        criticalCount: stats.criticalCount,
        endDate: stats.endDate,
        thumb: buildThumbnail(tl, color),
      };
    });
  }, [documents, activeId, project, tasks, cpmResult, filePath, isDirty, t]);
}

/** Gedeelde acties voor alle drie de chrome-stijlen + het overzicht. */
export function useDocumentActions() {
  const switchDocument = useAppStore((s) => s.switchDocument);
  const closeDocument = useAppStore((s) => s.closeDocument);
  const setUI = useAppStore((s) => s.setUI);

  const switchTo = useCallback((id: string) => switchDocument(id), [switchDocument]);

  // Dirty document → open de sluit-bevestiging (Opslaan/Niet opslaan/Annuleren);
  // schoon document sluit meteen.
  const closeWithGuard = useCallback(
    (doc: { id: string; isDirty: boolean }) => {
      if (doc.isDirty) { setUI({ pendingCloseDocId: doc.id }); return; }
      closeDocument(doc.id);
    },
    [closeDocument, setUI],
  );

  const openOverview = useCallback(() => setUI({ showProjectOverview: true }), [setUI]);
  const closeOverview = useCallback(() => setUI({ showProjectOverview: false }), [setUI]);
  const chooseNewOrOpenProject = useCallback(
    () => setUI({ showNewOrOpenProjectDialog: true }),
    [setUI],
  );

  return { switchTo, closeWithGuard, openOverview, closeOverview, chooseNewOrOpenProject };
}
