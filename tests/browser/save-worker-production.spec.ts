// #804 stap 4, fixronde 1 van #1016: de opslagworker zoals de productiebouw hem uitgeeft. Niet de devserver van de gewone
// browsersuite (daar krijgt een worker de gewone plugins) en niet een nagebouwde bundel: de echte vite.config.ts in
// productiemodus, met één kleine proefentry (`fixtures/save-worker-proof.html`) in plaats van de app. Zelfde patroon als
// gantt-benchmark-build.spec.ts: bouwen, de uitvoer serveren met `vite preview`, en in Chromium openen.
import { expect, test } from '@playwright/test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { build, preview } from 'vite';
// @ts-expect-error — headless-bundle.mjs is plain JS zonder types
import { FORBIDDEN_INPUTS } from '../../scripts/lib/headless-bundle.mjs';

const ROOT = process.cwd();
/** Wat nooit in de uitvoer van de worker mag staan, ook niet in een dynamisch geladen deel: de grens van de headless kern,
 *  plus de hooks. */
const FORBIDDEN: readonly string[] = [...(FORBIDDEN_INPUTS as string[]), 'src/hooks/'];

/** Alle delen van de worker, vanaf zijn ingang, met per deel of het statisch of alleen dynamisch geladen wordt. */
function workerChunks(assets: string): Map<string, 'statisch' | 'dynamisch'> {
  const entry = readdirSync(assets).find(name => /^ifcSave\.worker-[\w-]+\.js$/.test(name));
  if (!entry) throw new Error(`geen ifcSave.worker-*.js in ${readdirSync(assets).join(', ')}`);
  const chunks = new Map<string, 'statisch' | 'dynamisch'>([[entry, 'statisch']]);
  for (const queue = [entry]; queue.length;) {
    const name = queue.shift()!;
    const code = readFileSync(join(assets, name), 'utf8');
    for (const [, dynamic, file] of code.matchAll(/(?:\bfrom|\bimport)\s*(\()?\s*["']\.\/([^"']+\.js)["']/g)) {
      const kind = dynamic || chunks.get(name) === 'dynamisch' ? 'dynamisch' : 'statisch';
      if (chunks.get(file) === 'statisch' || chunks.get(file) === kind) continue;
      chunks.set(file, kind);
      queue.push(file);
    }
  }
  return chunks;
}

test('opslagworker uit de productiebouw: rekent zelf, geeft dezelfde bytes, en bevat geen UI, Tauri of singleton', async ({ browser }) => {
  test.setTimeout(240_000);
  const out = mkdtempSync(join(tmpdir(), 'ops-save-worker-'));
  try {
    const started = Date.now();
    await build({
      configFile: join(ROOT, 'vite.config.ts'), root: ROOT, mode: 'production', logLevel: 'warn',
      build: {
        outDir: out, emptyOutDir: true, reportCompressedSize: false,
        // Bronkaarten alleen om te lezen welke modules in elk deel zitten; ze veranderen niet wat er gebundeld wordt.
        sourcemap: true,
        rollupOptions: { input: join(ROOT, 'tests/browser/fixtures/save-worker-proof.html') },
      },
    });
    const buildSeconds = (Date.now() - started) / 1000;

    // 1. Wat Vite voor de worker uitgaf: elk deel, ook achter een dynamische import, met de modules uit zijn bronkaart.
    const assets = join(out, 'assets');
    const chunks = workerChunks(assets);
    const modules = new Map<string, Set<string>>();
    let bytes = { statisch: 0, dynamisch: 0 };
    for (const [name, kind] of chunks) {
      bytes = { ...bytes, [kind]: bytes[kind] + readFileSync(join(assets, name)).length };
      const map = JSON.parse(readFileSync(join(assets, `${name}.map`), 'utf8')) as { sources: string[] };
      for (const source of map.sources) {
        const path = source.replace(/\\/g, '/').replace(/^(\.\.\/)+/, '');
        if (!modules.has(path)) modules.set(path, new Set());
        modules.get(path)!.add(kind);
      }
    }
    const forbidden = [...modules.keys()].filter(path => FORBIDDEN.some(part => path.includes(part)));
    console.log(`opslagworker: bouw ${buildSeconds.toFixed(1)} s; ${chunks.size} delen `
      + `(${[...chunks.values()].filter(k => k === 'statisch').length} statisch, ${Math.round(bytes.statisch / 1024)} KiB; `
      + `${[...chunks.values()].filter(k => k === 'dynamisch').length} dynamisch, ${Math.round(bytes.dynamisch / 1024)} KiB); `
      + `${modules.size} modules`);
    expect(forbidden, 'verboden modules in de worker, statisch of dynamisch').toEqual([]);
    expect([...modules.keys()].some(path => path.endsWith('src/state/appStoreFactory.ts')), 'de storefabriek zit erin').toBe(true);
    expect([...modules.keys()].some(path => path.endsWith('src/state/appStore.ts')), 'de singleton niet').toBe(false);
    expect([...modules.keys()].some(path => path.endsWith('node_modules/zustand/esm/vanilla.mjs')), 'zustand zonder React').toBe(true);

    // 2. De uitgegeven worker in Chromium: een bewerkt bestand met een gebouwmodel, dezelfde merge in de worker en op de
    //    hoofdthread.
    const server = await preview({ root: ROOT, configFile: false, build: { outDir: out },
      preview: { host: '127.0.0.1', port: 0, open: false } });
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const workers: string[] = [];
      page.on('worker', worker => workers.push(worker.url()));
      const port = (server.httpServer.address() as AddressInfo).port;
      await page.goto(`http://127.0.0.1:${port}/tests/browser/fixtures/save-worker-proof.html`);
      await page.waitForFunction(() => 'saveWorkerProof' in window);
      const text = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), 'utf8');
      const proof = await page.evaluate(text => (window as unknown as {
        saveWorkerProof: (text: string) => Promise<{
          workerUrl: string; started: boolean; answers: number; changed: boolean; sourceIntact: boolean;
          worker: { sha256: string; bytes: string; length: number }; main: { sha256: string; bytes: string; length: number };
        }>;
      }).saveWorkerProof(text), text);
      // De uitgegeven worker, niet het bronbestand: hij staat in de bouwuitvoer en meldde zelf `started`.
      expect(proof.workerUrl).toMatch(/\/assets\/ifcSave\.worker-[\w-]+\.js$/);
      expect(chunks.has(proof.workerUrl.split('/').pop()!)).toBe(true);
      expect(workers.some(url => url.startsWith('blob:'))).toBe(true);
      // Hij rekende zelf (één antwoord), geen terugval, en de merge rekende echt (andere bytes dan de bron).
      expect(proof).toMatchObject({ started: true, answers: 1, changed: true, sourceIntact: true });
      expect(proof.worker).toEqual(proof.main);
      expect(proof.worker.bytes).toBe(proof.worker.sha256);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await new Promise<void>((resolve, reject) => {
        server.httpServer.close(error => error ? reject(error) : resolve());
        if ('closeAllConnections' in server.httpServer) server.httpServer.closeAllConnections();
      });
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
