// De productgrens van 150 MiB voor het openen van een model (#804, fixronde 3 van #1127, route A) door de echte routes:
// openen per route, het geval met de gemengde IFC-tekst, het crashherstel door de echte herstelvraag (browser zonder en
// met handle, sitebestand, twee tabbladen, desktop met nagebootste Tauri-IPC) en een onderbroken opslag. Een bestand van
// 150 MiB is daarvoor niet nodig: de proef verlaagt de productgrens met haar proefnaad; de technische grens blijft die
// van main.
//
// Hoe: deze check bundelt `ifcGrensProef.ts` met dezelfde esbuild-instellingen als run.sh, en zet in
// `useRecoveryRestore.ts` `reactHookDouble.ts` in plaats van `react` en `react-i18next` (elk precies één keer, anders
// faalt de check).
//
// Mutatiebewijs: de controle uit `openOpenedFile` halen ⇒ deel 1 en 2 rood; de controle ook zonder `modelOpenLimit`
// laten gelden ⇒ het herstel (deel 3) rood, in de browser en op de desktop.
//
// Draait via run.sh (esbuild-bundel), één keer, buiten de tijdzone-matrix: de bundel twee keer, `web` en `desktop` (met
// een eigen tijdelijke map als appData). Exit 0 = alles groen.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(root, 'package.json'));
const esbuild = require('esbuild') as typeof import('esbuild');
const fontkit = createRequire(join(root, 'tests/planning/x.js')).resolve('fontkit');
const trie = join(dirname(createRequire(fontkit).resolve('unicode-properties')), 'binaryTrie.browser.js');
const HOOK = /[\\/]src[\\/]hooks[\\/]useRecoveryRestore\.ts$/;
const DOUBLE = join(root, 'tests/planning/reactHookDouble.ts');
const work = mkdtempSync(join(tmpdir(), 'ops-grens-'));
const outfile = join(work, 'grens.mjs');
let replaced = 0;
try {
  await esbuild.build({
    entryPoints: [join(root, 'tests/planning/ifcGrensProef.ts')],
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
    alias: { '@': join(root, 'src'), '#binary-trie': trie },
    external: ['react-dom/server'],
    define: {
      'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"',
      '__OPS_DEV_INSTANCE__': '"test"', 'import.meta.env.BASE_URL': '"/"',
    },
    plugins: [{
      name: 'ops-herstelhook-zonder-react',
      setup(build) {
        build.onLoad({ filter: HOOK }, ({ path }) => {
          let contents = readFileSync(path, 'utf8');
          for (const from of ["from 'react'", "from 'react-i18next'"]) {
            if (contents.split(from).length !== 2) throw new Error(`useRecoveryRestore.ts heeft niet precies één ${from}`);
            contents = contents.replace(from, `from ${JSON.stringify(DOUBLE)}`);
          }
          replaced++;
          return { contents, loader: 'ts' };
        });
      },
    }],
  });
  if (replaced !== 1) throw new Error('useRecoveryRestore.ts kwam niet in de bundel');
  const appData = join(work, 'appdata');
  mkdirSync(appData);
  // Beide vormen draaien altijd, ook als de eerste rood is; elke vorm meldt zelf zijn afwijkingen.
  let failed = 0;
  for (const args of [['web'], ['desktop', appData]]) {
    try { execFileSync(process.execPath, [outfile, ...args], { cwd: root, stdio: 'inherit' }); }
    catch { failed++; }
  }
  if (failed > 0) throw new Error(`${failed} van de 2 vormen rood`);
} catch (error) {
  console.log(`XX  ifc-foreign-grens: ${(error as Error).message.split('\n')[0]}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
