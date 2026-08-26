import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

/**
 * Compatibiliteitsbrug voor oude aanroepers die alleen `showColumnsDialog` zetten. De feitelijke
 * kolom-UI is de ene `ColumnChooser` in `FullTaskGrid`; deze brug brengt die surface in beeld.
 */
export function ColumnsDialog() {
  const setUI = useAppStore(state => state.setUI);
  useEffect(() => {
    setUI({ activeRibbonTab: 'table', showColumnsDialog: true });
  }, [setUI]);
  return null;
}
