// Gedeelde testbasis voor de headless MCP-bridge-tests. Case-bestanden (cases-*.ts) importeren
// hieruit, registreren tests met `test(...)` en sluiten af met `await run()`. Geen testframework-
// dependency — de repo heeft er bewust geen; dit is dezelfde headless-esbuild-aanpak als
// tests/planning/.
//
// BELANGRIJK: de DOM-shim MOET vóór alle @/-imports staan. De store sleept via zijn slices
// canvas-/renderer-code mee; zonder een minimale `document` klapt die import in Node stuk (zelfde
// truc als de headless benchmark-run).

// --- DOM-shim (vóór elke @/-import) ---------------------------------------------------------------
// `documentElement` moet erbij: zodra een testbestand (indirect) de i18n-config meesleept — bv. via
// `hasBlockingDialogOpen`/`shortcutRegistry` in de MCP-tool-runtime, of via de tool-registry die de
// tool-modules importeert — zet `initLocale`→`updateDirection` bij module-eval `document.documentElement.dir`.
// Zonder deze stub is `documentElement` undefined en klapt die import in Node.
// `documentElement` draagt bewust de VOLLEDIGE vorm die de i18n-init aanraakt (`dir`/`lang` schrijven,
// `setAttribute`, `style`). Tot de eindintegratie stond die vorm in een los `uiShim.ts` dat zeven
// casebestanden importeerden — maar de harness zette hier zelf al een (truthy, lege) `documentElement`,
// waardoor uiShims `if (!doc.documentElement)`-guard nooit meer vuurde en het bestand een no-op was.
// Eén bron dus: de harness.
(globalThis as any).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  documentElement: { dir: 'ltr', lang: 'nl', setAttribute() {}, style: {} },
};

// Pas ná de shim de store importeren en re-exporteren.
import { appStoreContext, useAppStore, type AppStoreContext } from '@/state/appStore';
import { mcpTransactions } from '@/state/mcpTransaction';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import type { McpContext } from '@/services/mcp/contracts';
export { appStoreContext, useAppStore };

export type McpContextOverrides = Partial<Omit<McpContext, 'app' | 'transactions'>>;

/** Bouw een testcontext met transacties die aantoonbaar bij dezelfde storecontext horen. */
export function makeMcpContext(
  app: AppStoreContext = appStoreContext,
  overrides: McpContextOverrides = {},
): McpContext {
  return {
    app,
    transactions: app === appStoreContext ? mcpTransactions : createMcpTransactions(app),
    expectedDocId: null,
    tempIdMap: new Map<string, string>(),
    paused: false,
    readOnly: false,
    ensureBackup: async () => null,
    markDuplicateBorn: () => {},
    ...overrides,
  };
}

// --- Mini-assertielaag ---------------------------------------------------------------------------
interface RegisteredTest {
  name: string;
  fn: () => void | Promise<void>;
}
const registry: RegisteredTest[] = [];

/** Registreer een test onder een naam; de body draait pas in `run()`. */
export function test(name: string, fn: () => void | Promise<void>): void {
  registry.push({ name, fn });
}

/** Harde assertie: gooit met `msg` wanneer `cond` falsy is. */
export function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

/** Diepe gelijkheid via JSON-vergelijking; de foutmelding toont beide kanten (JSON-diff). */
export function assertEq(a: unknown, b: unknown, msg: string): void {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) {
    throw new Error(`${msg}\n  verwacht: ${sb}\n  kreeg:    ${sa}`);
  }
}

/**
 * Draai alle geregistreerde tests, print per test PASS/FAIL en beëindig het proces met code 1
 * zodra er ook maar één faalt (zodat de glob-lus in run.sh de exitcode als poort kan gebruiken).
 * Elk case-bestand eindigt op `await run()`.
 */
export async function run(): Promise<void> {
  let failures = 0;
  for (const t of registry) {
    try {
      await t.fn();
      console.log(`  PASS  ${t.name}`);
    } catch (e) {
      failures++;
      const err = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  ${t.name}: ${err}`);
    }
  }
  if (failures > 0) {
    console.log(`  ${failures}/${registry.length} test(s) gefaald`);
    process.exit(1);
  }
}
