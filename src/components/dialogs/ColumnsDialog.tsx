import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

export function ColumnsDialog() {
  const setUI = useAppStore(state => state.setUI);
  useEffect(() => {
    setUI({ activeRibbonTab: 'table', showColumnsDialog: true });
  }, [setUI]);
  return null;
}
