import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { isTreeMode } from '@/engine/view/visibleRows';
import { clearViewArrangement } from '@/state/viewArrangement';
import { NoticeStrip } from './NoticeStrip';

export function StructureLockedNotice() {
  const { t } = useTranslation('common');
  const seq = useAppStore((s) => s.ui.structureLockedNotice);
  const clearedAt = useAppStore((s) => s.ui.structureLockedClearedAt);
  const activeDocumentId = useAppStore((s) => s.activeDocumentId);
  const treeMode = useAppStore((s) => isTreeMode(s.view));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
  }, [activeDocumentId]);

  useEffect(() => {
    if (treeMode) setVisible(false);
  }, [treeMode]);

  useEffect(() => {
    if (seq === 0) return;
    setVisible(true);
  }, [seq]);

  useEffect(() => {
    if (clearedAt === seq) setVisible(false);
  }, [clearedAt, seq]);

  if (!visible) return null;

  const clearView = () => {
    clearViewArrangement(useAppStore.getState());
    setVisible(false);
  };

  return (
    <NoticeStrip
      icon="status.structure-locked"
      text={t('view.structureLockedHint')}
      actionLabel={t('view.filter.clear')}
      onAction={clearView}
      onDismiss={() => setVisible(false)}
      role="alert"
      tone="error"
      stripProps={{ 'data-ops-structure-locked': true }}
      actionProps={{ 'data-ops-structure-locked-clear': true }}
    />
  );
}
