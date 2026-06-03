import { useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';

/**
 * Dev-only inspectie-haak voor geautomatiseerd zelf-testen (bv. via Playwright MCP).
 *
 * Hangt de Zustand-store en de log-bus op `window.__OPS__`, zodat een browser-
 * automatiseringssessie via `browser_evaluate` de échte app-state kan uitlezen en
 * asserten: taken, datums, kritiek pad, en opgevangen fouten. De Gantt wordt op een
 * <canvas> getekend, dus state-inspectie — niet pixel-vergelijking — is de
 * betrouwbare manier om gedrag te verifiëren.
 *
 * STRIKT dev-only: dit wordt achter `import.meta.env.DEV` aangeroepen (zie main.tsx) en
 * via een dynamische import geladen, dus de haak verdwijnt volledig uit productie-builds.
 */
export interface OpsDevBridge {
  /** Zustand-store: gebruik `.getState()`, `.setState()`, `.subscribe()`. */
  store: typeof useAppStore;
  /** In-memory log-bus: `.snapshot()` geeft gelogde regels + opgevangen fouten. */
  log: typeof appLog;
}

declare global {
  interface Window {
    __OPS__?: OpsDevBridge;
  }
}

export function installDevBridge(): void {
  if (typeof window === 'undefined') return;
  window.__OPS__ = { store: useAppStore, log: appLog };
  appLog.emit('event', 'devBridge', 'window.__OPS__ klaar (dev-only self-test haak)');
}
