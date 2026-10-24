// Knownbug 165: echte productiebuilds, niet de Vite-devserver van de gewone browsersuite.
// Twee varianten in één route: zonder brug blijft productie afgeschermd; expliciete benchmark-opt-in telt paints.
import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { preview } from 'vite';
import { seedProject, waitForOps } from './fixtures/ops';

const ROOT = process.cwd();
const VERSION = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;

test('productie-benchmark: alleen expliciete brug telt echte primary/secondary/histogram paints', async ({ browser }) => {
  test.setTimeout(240_000);
  const temp = mkdtempSync(join(tmpdir(), 'ops-gantt-bench-'));
  try {
    for (const flag of ['0', '1']) {
      const out = join(temp, flag);
      const built = spawnSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'),
        'build', '--outDir', out, '--emptyOutDir'], {
        cwd: ROOT, encoding: 'utf8', timeout: 90_000,
        env: { ...process.env, NODE_ENV: 'production', VITE_OPS_BENCH_BRIDGE: flag, OPS_DEV_INSTANCE: '' },
      });
      expect(built.status, `${built.stdout}\n${built.stderr}\n${String(built.error ?? '')}`).toBe(0);
      const server = await preview({ root: ROOT, configFile: false, build: { outDir: out },
        preview: { host: '127.0.0.1', port: 0, open: false } });
      const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(version => {
          localStorage.setItem('ops-welcomeSeen', 'true');
          localStorage.setItem('ops-lastVersion', version);
          localStorage.setItem('ops-locale', 'en');
        }, VERSION);
        const port = (server.httpServer.address() as AddressInfo).port;
        await page.goto(`http://127.0.0.1:${port}/`);
        await expect(page.locator('.title-bar')).toBeVisible();
        await page.waitForLoadState('networkidle');
        if (flag === '0') {
          expect(await page.evaluate(() => window.__OPS__)).toBeUndefined();
        } else {
          await waitForOps(page);
          await page.evaluate(() => {
            const store = window.__OPS__!.store.getState();
            store.newProject();
            store.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
          });
          const [taskId] = await seedProject(page, [{
            name: 'Productie-benchmark', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
          }]);
          // Alleen fixture-inrichting via de brug; het te meten paintsignaal komt van de echte resize.
          await page.evaluate(() => {
            const store = window.__OPS__!.store.getState();
            store.setSplitView({ ratio: 0.55, secondaryZoom: 36, secondaryScrollX: 0 });
            store.setUI({ showHistogram: true });
          });
          for (const surface of ['primary', 'secondary', 'histogram'] as const) {
            await expect(page.getByTestId(`gantt-${surface}-canvas`)).toBeVisible();
            await expect.poll(() => page.evaluate(s => window.__OPS__!.gantt.paintCount(s), surface)).toBeGreaterThan(0);
            const before = await page.evaluate(s => ({ count: window.__OPS__!.gantt.paintCount(s),
              size: window.__OPS__!.gantt.lastSize(s) }), surface);
            expect(before.size!.width).toBeGreaterThan(0);
            expect(before.size!.height).toBeGreaterThan(0);
            const viewport = page.viewportSize()!;
            await page.setViewportSize({ width: viewport.width + 30, height: viewport.height + 20 });
            await expect.poll(() => page.evaluate(s => window.__OPS__!.gantt.paintCount(s), surface))
              .toBeGreaterThan(before.count);
          }
          for (const surface of ['primary', 'secondary'] as const) {
            expect(await page.evaluate(({ id, surface }) => window.__OPS__!.gantt.taskBarPoint(id, 'body', surface),
              { id: taskId, surface })).not.toBeNull();
          }
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
        await new Promise<void>((resolve, reject) => {
          server.httpServer.close(error => error ? reject(error) : resolve());
          if ('closeAllConnections' in server.httpServer) server.httpServer.closeAllConnections();
        });
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
