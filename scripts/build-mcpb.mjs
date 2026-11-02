#!/usr/bin/env node
// Bouwt de Claude Desktop-bundel (MCP Bundle, `.mcpb`) van Open Planner Studio (issue #730): één
// installatie met twee standen. Het schakelstuk (`server/index.mjs`) stuurt elke aanvraag naar de bridge
// van de draaiende desktop-app, of naar de headless MCP-server (`server/headless.mjs`) die het zelf start
// op de werkmap. Uitleg en bron: `integrations/claude-desktop/` (manifest, schakelstuk) en
// docs/mcp-verificatie.md.
//
//   npm run build:mcpb                       # → dist-mcpb/open-planner-studio-<versie>.mcpb
//   node scripts/build-mcpb.mjs --out <map>
//
// Uitvoer in de doelmap: `bundle/` (de uitgepakte inhoud, zo te controleren met `mcpb validate`) en
// het `.mcpb`-bestand (ZIP van `bundle/`). Het schakelstuk wordt één ESM-bestand zonder
// runtime-dependencies en zonder app-code. `headless.mjs` is ongewijzigd de uitvoer van
// `scripts/build-mcp-server.mjs`, met de grenscontrole van die bouw. De licenties van wat in beide zit,
// staan in `THIRD-PARTY-NOTICES.md`.
// De versie in `manifest.json` loopt mee met `npm run bump`; wijkt hij af van package.json, dan faalt de bouw.
import esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { thirdPartyNotices } from './lib/third-party-notices.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outIdx = process.argv.indexOf('--out');
const outDir = resolve(outIdx >= 0 ? process.argv[outIdx + 1] : join(root, 'dist-mcpb'));
// De metafile-paden (lekcontrole, licenties) zijn relatief aan de werkmap: altijd de repo-root.
process.chdir(root);
const srcDir = join(root, 'integrations/claude-desktop');
const bundleDir = join(outDir, 'bundle');

const fail = (message) => {
  console.error(`XX ${message}`);
  process.exit(1);
};

const appPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(srcDir, 'manifest.json'), 'utf8'));
if (manifest.version !== appPkg.version) {
  fail(`manifest.json heeft versie ${manifest.version}, package.json ${appPkg.version}. Draai npm run bump.`);
}
if (manifest.license !== appPkg.license) {
  fail(`manifest.json heeft licentie ${manifest.license}, package.json ${appPkg.license}.`);
}
const entryPoint = manifest.server?.entry_point;
if (entryPoint !== 'server/index.mjs') fail(`server.entry_point is ${entryPoint}, verwacht server/index.mjs.`);
/** Het headless kindproces; `integrations/claude-desktop/src/main.ts` zoekt het naast `index.mjs`. */
const headlessEntry = 'server/headless.mjs';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(bundleDir, 'server'), { recursive: true });

// 1. Het schakelstuk: één bestand. Node 18 is het minimum dat het manifest noemt (de stand zonder app
//    vraagt Node 22; het schakelstuk controleert dat zelf).
const result = await esbuild.build({
  entryPoints: [join(srcDir, 'src/main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: join(bundleDir, entryPoint),
  minify: true,
  legalComments: 'eof',
  metafile: true,
  logLevel: 'warning',
  banner: { js: `// Open Planner Studio — Claude Desktop extension ${appPkg.version}, ${appPkg.license}. Built by scripts/build-mcpb.mjs; do not edit.` },
  define: { __OPS_MCPB_VERSION__: JSON.stringify(appPkg.version) },
});
const inputs = Object.keys(result.metafile.inputs).map((p) => p.replace(/\\/g, '/'));
// Het schakelstuk is geen planner: app-code (store, planner, kern) hoort er niet in. De enige uitzondering is
// het ontdekkingscontract, dat daarvoor gemaakt is: het importeert niets (`discoveryContract.ts`).
const ALLOWED_APP_INPUTS = new Set(['src/services/mcp/discoveryContract.ts']);
const leaks = inputs.filter((p) => !ALLOWED_APP_INPUTS.has(p)
  && (p.startsWith('src/') || p.includes('/src/state/') || p.includes('/src/core/')));
if (leaks.length > 0) fail(`het schakelstuk bevat app-code:\n  ${leaks.join('\n  ')}`);

// 1b. De headless server: precies de bouw van `npm run build:mcp-server`, met zijn eigen grenscontrole.
const headlessOut = join(outDir, 'headless-build');
const headlessBuild = spawnSync(process.execPath, [join(root, 'scripts/build-mcp-server.mjs'), '--out', headlessOut], {
  cwd: root, encoding: 'utf8',
});
if (headlessBuild.status !== 0) fail(`build-mcp-server faalde:\n${headlessBuild.stdout}\n${headlessBuild.stderr}`);
copyFileSync(join(headlessOut, 'server.mjs'), join(bundleDir, headlessEntry));
const headlessNotices = readFileSync(join(headlessOut, 'THIRD-PARTY-NOTICES.md'), 'utf8')
  .replace(/^# Third-party notices\n+/, '');

// 2. Manifest, icoon (het app-icoon) en licenties.
writeFileSync(join(bundleDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(join(root, 'src-tauri/icons/512x512.png'), join(bundleDir, manifest.icon));
copyFileSync(join(root, 'LICENSE'), join(bundleDir, 'LICENSE'));
copyFileSync(join(root, 'LICENSE.GPL'), join(bundleDir, 'LICENSE.GPL'));
let notices;
try {
  notices = thirdPartyNotices(inputs);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
writeFileSync(join(bundleDir, 'THIRD-PARTY-NOTICES.md'), `# Third-party notices

The Open Planner Studio extension for Claude Desktop ${appPkg.version} contains two programs.
Generated by scripts/build-mcpb.mjs from the bundle metafiles.

## server/index.mjs

\`server/index.mjs\` bundles code from the packages below. Their licenses and copyright notices follow in full.

Bundled packages: ${notices.packages.join(', ')}.

${notices.sections}

## server/headless.mjs

\`server/headless.mjs\` is the headless MCP server of Open Planner Studio (scripts/build-mcp-server.mjs).

${headlessNotices}`);

// 3. De ZIP, met de ZIP-schrijver van de app (deterministisch: vaste datum, vaste volgorde).
const zipModule = await esbuild.build({
  entryPoints: [join(root, 'src/services/zip/zipWriter.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'warning',
});
const { writeZip } = await import(`data:text/javascript;base64,${Buffer.from(zipModule.outputFiles[0].text).toString('base64')}`);
const files = ['manifest.json', manifest.icon, entryPoint, headlessEntry, 'LICENSE', 'LICENSE.GPL', 'THIRD-PARTY-NOTICES.md'];
const zip = await writeZip(files.map((name) => ({ name, data: new Uint8Array(readFileSync(join(bundleDir, name))) })));
const mcpbName = `open-planner-studio-${appPkg.version}.mcpb`;
writeFileSync(join(outDir, mcpbName), zip);

rmSync(headlessOut, { recursive: true, force: true });
const kb = (name) => (readFileSync(join(bundleDir, name)).length / 1024).toFixed(0);
console.log(`OK — ${relative(root, join(outDir, mcpbName))} (${(zip.length / 1024).toFixed(0)} KB; schakelstuk ${kb(entryPoint)} KB, `
  + `headless ${kb(headlessEntry)} KB; meegebundeld in het schakelstuk: ${notices.packages.join(', ')}).`);
