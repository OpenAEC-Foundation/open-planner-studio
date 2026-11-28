import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { startMcpServer } from '@/services/mcp/server';

export function useAiAutostart(): void {
  const aiMode = useAppStore(s => s.ui.aiMode);
  const aiAutostart = useAppStore(s => s.ui.aiAutostart);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!aiMode || !aiAutostart) return;
    started.current = true;
    void startMcpServer();
  }, [aiMode, aiAutostart]);
}
