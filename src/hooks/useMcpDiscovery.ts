import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { getMcpDiscoveryWriter, openFilePathsFromState } from '@/services/mcp/discoveryFiles';

/**
 * Register van open bestanden voor de MCP-plugin (`<appDataDir>/mcp/open-files.json`, issue #570).
 *
 * Alleen in de desktop-app, en altijd, ook met de MCP-koppeling uit: een plugin die zelf op
 * bestanden werkt, mag nooit schrijven in een bestand dat hier open staat. De hook volgt de store:
 * elke wijziging van de open paden (openen, sluiten, Opslaan als, documentwissel) schrijft het
 * register opnieuw; een wijziging zonder ander pad schrijft niets (`setOpenFiles` vergelijkt).
 * Bij afsluiten verwijdert `useAppCloseGuard` het register (best effort); blijft het na een crash
 * staan, dan herkent de lezer dat aan het proces-id (zie `docs/mcp-ontdekking.md`).
 */
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
