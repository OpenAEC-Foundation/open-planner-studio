import { useAppStore } from '@/state/appStore';
import { isCommandEnabled, type Command } from '@/state/commands';
import type { RibbonButtonBinding } from './ribbonConfig';

export function useCommandBinding(cmd: Command): RibbonButtonBinding {
  const enabled = useAppStore(s => isCommandEnabled(cmd, s));
  return {
    onClick: () => cmd.run(useAppStore.getState()),
    disabled: !enabled,
  };
}
