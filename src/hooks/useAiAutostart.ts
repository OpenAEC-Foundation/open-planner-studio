import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { startMcpServer } from '@/services/mcp/server';
import { linuxEnvironment } from '@/utils/linuxEnvironment';

/**
 * Bridge automatisch starten bij het opstarten van de app (instelling `ops-aiAutostart`).
 *
 * Waarom een effect dat op de state REAGEERT en niet één keer bij mount vuurt: de instellingen
 * worden asynchroon gehydrateerd (`useSettingsBootstrap` → `loadAllSettings().then(setUI)`), dus bij
 * de eerste render staan `aiMode`/`aiAutostart` nog op hun default (uit). Dit effect wacht dus tot
 * beide vlaggen daadwerkelijk waar zijn.
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
    if (!linuxEnvironment()?.mcp && (!aiMode || !aiAutostart)) return;
    // Alleen deze sessie: de door de omgeving gevraagde koppeling niet als gebruikersvoorkeur bewaren.
    if (linuxEnvironment()?.mcp && !aiMode) useAppStore.getState().setUI({ aiMode: true });
    started.current = true;
    void startMcpServer();
  }, [aiMode, aiAutostart]);
}
