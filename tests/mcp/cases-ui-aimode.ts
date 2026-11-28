const backing = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
};

import { useAppStore, test, assert, assertEq, run } from './harness';
import { applyAiMode, regenerateMcpToken, type ApplyAiModeDeps } from '@/services/mcp/server';
import { loadMcpPort, saveMcpPort, saveAiMode, loadMcpToken } from '@/utils/settingsStore';
import { loadAllSettings } from '@/utils/settingsRegistry';
import type { McpServerStatus } from '@/services/mcp/contracts';

const HEX64 = /^[0-9a-f]{64}$/;

function makeSpy(port: number) {
  const calls = {
    setAiMode: [] as boolean[],
    persist: [] as boolean[],
    stopServer: 0,
    setStatus: [] as McpServerStatus[],
  };
  const deps: ApplyAiModeDeps = {
    setAiMode: (v) => { calls.setAiMode.push(v); },
    persist: (v) => { calls.persist.push(v); },
    stopServer: () => { calls.stopServer++; },
    setStatus: (s) => { calls.setStatus.push(s); },
    port,
  };
  return { calls, deps };
}

test('applyAiMode(true) schrijft de spiegel + persisteert, en raakt de bridge NIET aan', async () => {
  const { calls, deps } = makeSpy(3877);
  await applyAiMode(true, deps);
  assertEq(calls.setAiMode, [true], 'de ui-spiegel wordt op true gezet');
  assertEq(calls.persist, [true], 'de setting wordt op true gepersisteerd');
  assertEq(calls.stopServer, 0, 'aanzetten stopt de bridge niet');
  assertEq(calls.setStatus, [], 'aanzetten forceert geen status');
});

test('applyAiMode(false) roept het stopServer-pad aan en forceert de serverstatus op off', async () => {
  const { calls, deps } = makeSpy(3901);
  await applyAiMode(false, deps);
  assertEq(calls.setAiMode, [false], 'de ui-spiegel wordt op false gezet');
  assertEq(calls.persist, [false], 'de setting wordt op false gepersisteerd');
  assertEq(calls.stopServer, 1, 'uitzetten stopt de bridge (stopServer-pad) precies één keer');
  assertEq(calls.setStatus, [{ state: 'off', port: 3901 }], 'de serverstatus wordt op off gezet met de meegegeven poort');
});

test('AI-modus uitzetten terwijl het AI-tabblad actief is, valt terug op de start-tab', () => {
  const store = useAppStore.getState();
  store.setUI({ aiMode: true, activeRibbonTab: 'ai' });
  assertEq(useAppStore.getState().ui.aiMode, true, 'aiMode staat aan');
  assertEq(useAppStore.getState().ui.activeRibbonTab, 'ai', 'het AI-tabblad is actief');

  store.setUI({ aiMode: false });
  assertEq(useAppStore.getState().ui.aiMode, false, 'aiMode staat uit');
  assertEq(useAppStore.getState().ui.activeRibbonTab, 'start', 'de actieve tab valt terug op start (geen wees-tab)');
});

test('AI-modus uitzetten laat een NIET-AI-tab ongemoeid', () => {
  const store = useAppStore.getState();
  store.setUI({ aiMode: true, activeRibbonTab: 'planning' });
  store.setUI({ aiMode: false });
  assertEq(useAppStore.getState().ui.activeRibbonTab, 'planning', 'een andere actieve tab blijft staan');
});

test('saveAiMode wordt door loadAllSettings teruggehydrateerd naar de aiMode-spiegel', async () => {
  await saveAiMode(true);
  let patch = await loadAllSettings();
  assertEq(patch.aiMode, true, 'aiMode:true wordt uit localStorage gehydrateerd');

  await saveAiMode(false);
  patch = await loadAllSettings();
  assertEq(patch.aiMode, false, 'aiMode:false wordt uit localStorage gehydrateerd');
});

test('saveMcpPort persisteert en loadMcpPort leest dezelfde poort terug', () => {
  saveMcpPort(3999);
  assertEq(loadMcpPort(), 3999, 'de gewijzigde poort wordt gepersisteerd en teruggelezen');
});

test('regenerateMcpToken vervangt de opgeslagen tokenwaarde door een vers 64-hex-token', () => {
  const first = regenerateMcpToken();
  assert(HEX64.test(first), `eerste token is geen 64 hex-chars: ${first}`);
  assertEq(loadMcpToken(), first, 'het eerste token is gepersisteerd');

  const second = regenerateMcpToken();
  assert(HEX64.test(second), `tweede token is geen 64 hex-chars: ${second}`);
  assert(second !== first, 'regeneratie levert een ander token');
  assertEq(loadMcpToken(), second, 'de opgeslagen waarde is vervangen door het nieuwe token');
});

await run();
