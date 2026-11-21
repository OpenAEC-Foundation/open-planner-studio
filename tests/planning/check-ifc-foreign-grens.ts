// De grens van 150 MiB (#804, knownbug 1936) met een verlaagde productieconstante, door de echte routes. Fixronde 2 van
// #1127: crashherstel van een eigen bron boven de grens (browser zonder en met handle, sitebestand, desktop met
// nagebootste Tauri-IPC, twee tabbladen), Bestand → Openen boven de grens, Ctrl+S van een gewone planning boven de grens
// met de flag uit en aan, en de doelscan als stroom precies op de grens. Een bestand van 150 MiB is daarvoor niet nodig.
//
// Hoe: deze check bundelt `ifcGrensProef.ts` met dezelfde esbuild-instellingen als run.sh, maar vervangt in
// `foreignScan.ts` de ene regel `= 150 * 1024 * 1024;` door de proefgrens (64 KiB). Staat die regel er niet precies zo,
// dan faalt de check: zo blijft de verlaging gekoppeld aan de enige plek van de grens. De waarde zelf (150 MiB) toetst
// `check-ifc-foreign-open.ts`.
//
// Mutatiebewijs: in `readRecoveryDocument.ts` de grens voor openen op het herstel laten gelden (`{ ifcMaxBytes: Infinity }`
// weg) ⇒ deel 1 rood, in de browser en op de desktop.
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
const PRODUCTIE = '= 150 * 1024 * 1024;';
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
      '__OPS_DEV_INSTANCE__': '"test"',
    },
    plugins: [{
      name: 'ops-grens-verlagen',
      setup(build) {
        build.onLoad({ filter: /[\\/]src[\\/]services[\\/]ifc[\\/]foreign[\\/]foreignScan\.ts$/ }, ({ path }) => {
          const contents = readFileSync(path, 'utf8');
          if (contents.split(PRODUCTIE).length !== 2) throw new Error(`foreignScan.ts heeft niet precies één regel ${PRODUCTIE}`);
          replaced++;
          return { contents: contents.replace(PRODUCTIE, '= 65536;'), loader: 'ts' };
        });
      },
    }],
  });
  if (replaced !== 1) throw new Error('de grens is niet verlaagd: foreignScan.ts kwam niet in de bundel');
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
