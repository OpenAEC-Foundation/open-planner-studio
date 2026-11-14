import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { startMcpServer } from '@/services/mcp/server';

/**
 * Bridge automatisch starten bij het opstarten van de app (instelling `ops-aiAutostart`).
 *
 * Waarom een effect dat op de state REAGEERT en niet één keer bij mount vuurt: de instellingen staan
 * sinds #895 al vóór de eerste render in de store (`startup/initialSettings.ts`), maar ingebed kunnen
 * ze later van de host komen (`useSiteHostPreferences`). Dit effect wacht dus tot beide vlaggen
 * daadwerkelijk waar zijn.
 *
 * De `started`-ref maakt het EENMALIG per app-sessie: zet de gebruiker de bridge daarna handmatig
 * uit, dan mag deze hook hem niet stilletjes opnieuw aanzetten — dat zou een uit-knop zijn die niet
 * uit blijft. Zet hij hem later weer aan, dan doet hij dat zelf via het AI-tabblad.
 *
 * `startMcpServer` is in de web-build een no-op (eigen `isTauri()`-gate), dus hier is geen aparte
 * platformcheck nodig; de import is statisch veilig omdat `server.ts` zijn Tauri-randen dynamisch
 * inlaadt. Een mislukte start (poort bezet) landt via het status-event in `ui.aiServerStatus` en is
 * daar zichtbaar — de gebruiker ziet "Poort bezet" op het AI-tabblad in plaats van een stille fout.
 */
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
