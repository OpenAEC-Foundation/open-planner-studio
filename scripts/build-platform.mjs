#!/usr/bin/env node
// Platformbouw voor de OpenAEC-app op Frappe (issue #307, #308).
//
//   npm run build:platform -- --base /assets/openaec/planner/
//
// De site serveert de bundel als statische bestanden onder een subpad en laadt hem vanaf een andere
// pagina (via `index.html` in een iframe, of door de entry uit `.vite/manifest.json` in te voegen).
// Daarom bouwt dit script altijd met:
//   - een expliciet basispad (`--base`, verplicht): alle URL's in de bundel beginnen daarmee, of `./`
//     voor een relatieve bundel die onder elk subpad draait (SuperCloud, #818);
//   - Vite-modus `platform`: leest `.env.platform` (bouwvlag, zie `src/utils/buildFlags.ts`), zet
//     `build.manifest` aan en schrijft naar `dist-platform/` (zie `vite.config.ts`).
// Eerst draait de typecheck, net als bij `npm run build` (`tsc && vite build`). Na de Vite-build schrijft het
// script de tooldefinities voor de assistent van de site naar `dist-platform/mcp-tools.json`
// (`scripts/export-mcp-tools.ts`, dezelfde bron als `window.__OPDS_APP__.definitions()`).
//
// Exitcode: 0 bij succes, 2 bij een fout argument, anders de exitcode van tsc of Vite.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = 'npm run build:platform -- --base /assets/openaec/planner/';

function usageError(message) {
  console.error(`build-platform: ${message}`);
  console.error(`build-platform: Voorbeeld: ${EXAMPLE}`);
  process.exit(2);
}

/** Lees `--base <pad>` of `--base=<pad>` uit de argumenten. Andere argumenten zijn een fout. */
export function parseArgs(argv) {
  let base;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') {
      base = argv[i + 1];
      if (base === undefined || base.startsWith('--')) return { error: 'Na --base ontbreekt het basispad.' };
      i++;
    } else if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else {
      return { error: `Onbekend argument: ${arg}` };
    }
  }
  if (base === undefined) return { error: 'Het basispad ontbreekt (--base is verplicht).' };
  return { base };
}

/**
 * Een basispad is `./` (relatief, #818) of begint en eindigt met `/` en bevat alleen gewone padsegmenten.
 *
 * `./` is de vorm uit het SuperCloud-contract: dezelfde bundel draait dan onder elk subpad
 * (`/werkplek/app/<tool>/` op elke klantsite). Vite maakt `import.meta.env.BASE_URL` dan `./`, dus elke
 * `fetch(BASE_URL + "docs/…")` lost op tegen het adres van het document. Dat werkt alleen als de site
 * `index.html` binnen de map van de bundel serveert (bijv. `/werkplek/app/planner/` of `…/index.html`).
 * Andere relatieve vormen (`.`, `../x/`, `x/`) weigert het script: Vite kent alleen `./` en `''`.
 */
export function validateBase(base) {
  if (base === './') return null;
  if (!base.startsWith('/') || !base.endsWith('/')) {
    return `Het basispad moet "./" zijn, of met "/" beginnen en eindigen, maar is "${base}".`;
  }
  const segments = base.slice(1, -1);
  if (segments === '') return null;
  for (const segment of segments.split('/')) {
    if (segment === '' || segment === '.' || segment === '..' || !/^[A-Za-z0-9._~-]+$/.test(segment)) {
      return `Het basispad "${base}" bevat een ongeldig segment ("${segment}"). Gebruik alleen letters, cijfers en . _ ~ -.`;
    }
  }
  return null;
}

// `OPS_DEV_INSTANCE` is de slug van een dev- of testinstantie; `vite.config.ts` bakt hem in de bundel
// (`__OPS_DEV_INSTANCE__`, voorvoegsel van de herstelbestanden). Een platformbundel heeft er nooit een,
// ook niet als het script vanuit een dev- of testomgeving start.
// Ook elke `VITE_*` uit de shell gaat eruit: Vite laat die vóór `.env.platform` gaan. Zo kan een
// `VITE_OPS_BENCH_BRIDGE=1` geen testbrug (`window.__OPS__`) in de platformbundel zetten, en kan een
// `VITE_OPS_PLATFORM` uit de shell de bouwvlag niet overschrijven. Alleen `.env.platform` telt.
const BUILD_ENV = { ...process.env };
delete BUILD_ENV.OPS_DEV_INSTANCE;
for (const key of Object.keys(BUILD_ENV)) if (key.startsWith('VITE_')) delete BUILD_ENV[key];

function run(bin, args) {
  const command = bin === 'node' ? process.execPath : path.join(ROOT, 'node_modules', '.bin', bin);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', env: BUILD_ENV });
  if (result.error) {
    console.error(`build-platform: ${bin} starten mislukt: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`build-platform: ${bin} faalde (exit ${result.status ?? result.signal}).`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) usageError(parsed.error);
  const problem = validateBase(parsed.base);
  if (problem) usageError(problem);

  console.log(`build-platform: typecheck (tsc)…`);
  run('tsc', []);
  console.log(`build-platform: vite build --mode platform --base ${parsed.base} → dist-platform/`);
  run('vite', ['build', '--mode', 'platform', '--base', parsed.base]);
  console.log(`build-platform: tooldefinities → dist-platform/mcp-tools.json`);
  run('node', ['scripts/run-ts.mjs', 'scripts/export-mcp-tools.ts', 'dist-platform/mcp-tools.json']);
  console.log(`build-platform: klaar: dist-platform/ (manifest: dist-platform/.vite/manifest.json, tools: dist-platform/mcp-tools.json)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
