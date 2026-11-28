import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { getMcpDiscoveryWriter, openFilePathsFromState } from '@/services/mcp/discoveryFiles';

export function useMcpDiscovery(): void {
  useEffect(() => {
    if (!isTauri()) return;
    const writer = getMcpDiscoveryWriter();
    if (!writer) return;
    void writer.startup();
    const push = () => { void writer.setOpenFiles(openFilePathsFromState(useAppStore.getState(), true)); };
    push();
    return useAppStore.subscribe(push);
  }, []);
}
