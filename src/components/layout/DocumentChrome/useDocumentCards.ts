import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { basename } from '@/utils/filePath';
import { documentProjectCode } from '@/utils/documentProjectCode';
import {
  documentTitle, documentColor, documentCode, buildStats, buildThumbnail,
  untitledOrdinals, displayDocumentTitle,
  type ThumbBar,
} from '@/utils/documents';

export interface DocumentCard {
  id: string;
  title: string;
  fileName: string | null;
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

export function useDocumentCards(includeThumbnails = false): DocumentCard[] {
  const { t } = useTranslation('common');
  const documents = useAppStore((s) => s.documents);
  const activeId = useAppStore((s) => s.activeDocumentId);
  const project = useAppStore((s) => s.project);
  const tasks = useAppStore((s) => s.tasks);
  const cpmResult = useAppStore((s) => s.cpmResult);
  const filePath = useAppStore((s) => s.filePath);
  const isDirty = useAppStore((s) => s.isDirty);
  const activeCode = useAppStore((s) => documentProjectCode(s.project, s.xerImportMetadata));

  return useMemo(() => {
    const untitled = t('project.untitled');
    const fileBase = (p: string | null) => (p ? basename(p) : null);

    const rawTitles = documents.map((entry) => {
      const active = entry.id === activeId;
      const p = active ? project : entry.payload!.project;
      const fp = active ? filePath : entry.payload!.filePath;
      const code = active ? activeCode : documentProjectCode(p, entry.payload!.xerImportMetadata);
      return documentTitle(fp, p.name, code);
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
        thumb: includeThumbnails ? buildThumbnail(tl, color) : [],
      };
    });
  }, [documents, activeId, project, tasks, cpmResult, filePath, isDirty, activeCode, t, includeThumbnails]);
}

export function useDocumentActions() {
  const switchDocument = useAppStore((s) => s.switchDocument);
  const requestCloseDocument = useAppStore((s) => s.requestCloseDocument);
  const setUI = useAppStore((s) => s.setUI);
  const startQuestionOpen = useAppStore(s => s.ui.pendingActualStartQuestion !== null);

  const switchTo = useCallback((id: string) => {
    if (!startQuestionOpen) switchDocument(id);
  }, [startQuestionOpen, switchDocument]);

  const closeWithGuard = useCallback(
    (doc: { id: string }) => {
      if (!startQuestionOpen) requestCloseDocument(doc.id);
    },
    [requestCloseDocument, startQuestionOpen],
  );

  const openOverview = useCallback(() => {
    if (!startQuestionOpen) setUI({ showProjectOverview: true });
  }, [setUI, startQuestionOpen]);
  const closeOverview = useCallback(() => setUI({ showProjectOverview: false }), [setUI]);
  const chooseNewOrOpenProject = useCallback(
    () => { if (!startQuestionOpen) setUI({ showNewOrOpenProjectDialog: true }); },
    [setUI, startQuestionOpen],
  );

  return { switchTo, closeWithGuard, openOverview, closeOverview, chooseNewOrOpenProject };
}
