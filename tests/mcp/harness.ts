(globalThis as any).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  documentElement: { dir: 'ltr', lang: 'nl', setAttribute() {}, style: {} },
};

import { appStoreContext, useAppStore, type AppStoreContext } from '@/state/appStore';
import { mcpTransactions } from '@/state/mcpTransaction';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import type { McpContext } from '@/services/mcp/contracts';
export { appStoreContext, useAppStore };

export type McpContextOverrides = Partial<Omit<McpContext, 'app' | 'transactions'>>;

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

interface RegisteredTest {
  name: string;
  fn: () => void | Promise<void>;
}
const registry: RegisteredTest[] = [];

export function test(name: string, fn: () => void | Promise<void>): void {
  registry.push({ name, fn });
}

export function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

export function assertEq(a: unknown, b: unknown, msg: string): void {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) {
    throw new Error(`${msg}\n  verwacht: ${sb}\n  kreeg:    ${sa}`);
  }
}

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
