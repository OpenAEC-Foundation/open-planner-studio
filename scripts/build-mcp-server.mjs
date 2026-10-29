#!/usr/bin/env node
// Bouwt de headless MCP-server (`headless/mcp-server/`, issue #570) tot één zelfstandig bestand in
// `dist-mcp-server/`: `server.mjs` (ESM, alle code en ingebedde teksten erin, geen runtime-
// dependencies), een kleine `package.json` met `bin`, de licentieteksten, de licenties van de
// meegebundelde dependencies (THIRD-PARTY-NOTICES.md) en een README. Draait met alleen
// `node server.mjs`: zonder repo, zonder `node_modules`. Er wordt NIET gepubliceerd.
// Uitleg: docs/headless-mcp.md.
//
//   npm run build:mcp-server               # → dist-mcp-server/
//   node scripts/build-mcp-server.mjs --out <map>
//
// De bouw controleert de grens mechanisch, net als `build-core.mjs` (scripts/lib/headless-bundle.mjs):
// React, React DOM, `@tauri-apps/*`, de app-singleton (`src/state/appStore.ts`), `src/components/`,
// `src/hooks/` en de i18n-UI-config mogen niet in de bundel zitten.
import esbuild from 'esbuild';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forbiddenInputs, headlessStubPlugin, metafileInputs } from './lib/headless-bundle.mjs';
import { thirdPartyNotices } from './lib/third-party-notices.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outIdx = process.argv.indexOf('--out');
const outDir = resolve(outIdx >= 0 ? process.argv[outIdx + 1] : join(root, 'dist-mcp-server'));

const appPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
export const MCP_SERVER_PACKAGE_NAME = '@openaec/open-planner-mcp-server';
const BIN_NAME = 'open-planner-mcp';

/**
 * De tekstbestanden die tools tijdens het draaien lezen, ingebed in de bundel (sleutel = pad binnen
 * `public/`). Nu: de agentgids en alle agent-skills voor `planner_get_planning_guide`. Een tool die een
 * nieuw runtime-bestand gaat lezen, hoort hier zijn bestand bij te zetten.
 */
function embeddedAssets() {
  const assets = {};
  const add = (rel) => {
    const file = join(root, 'public', rel);
    if (!existsSync(file)) throw new Error(`ingebed bestand ontbreekt: public/${rel}`);
    assets[rel] = readFileSync(file, 'utf8');
  };
  add('agent/planning-guide.md');
  for (const name of readdirSync(join(root, 'public', 'skills')).sort()) {
    if (existsSync(join(root, 'public', 'skills', name, 'SKILL.md'))) add(`skills/${name}/SKILL.md`);
  }
  return assets;
}

const assets = embeddedAssets();
const assetsPlugin = {
  name: 'ops-embedded-assets',
  setup(build) {
    build.onResolve({ filter: /^ops:embedded-assets$/ }, (args) => ({ path: args.path, namespace: 'ops-embedded-assets' }));
    build.onLoad({ filter: /.*/, namespace: 'ops-embedded-assets' }, () => ({
      contents: `export const EMBEDDED_ASSETS = Object.freeze(${JSON.stringify(assets)});`,
      loader: 'js',
    }));
  },
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const result = await esbuild.build({
  entryPoints: [join(root, 'headless/mcp-server/src/main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: join(outDir, 'server.mjs'),
  alias: { '@': join(root, 'src') },
  plugins: [headlessStubPlugin(root, MCP_SERVER_PACKAGE_NAME), assetsPlugin],
  metafile: true,
  legalComments: 'eof',
  logLevel: 'warning',
  banner: {
    js: `#!/usr/bin/env node\n// ${MCP_SERVER_PACKAGE_NAME} ${appPkg.version} — ${appPkg.license}. Gebouwd met scripts/build-mcp-server.mjs; niet met de hand bewerken.`,
  },
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    'import.meta.env.BASE_URL': '"/"',
    '__OPS_DEV_INSTANCE__': '"mcp-server"',
    '__APP_VERSION__': JSON.stringify(appPkg.version),
  },
});

const inputs = metafileInputs(result.metafile);
const leaks = forbiddenInputs(inputs, ['src/hooks/']);
if (leaks.length > 0) {
  console.error(`XX de MCP-serverbundel bevat ${leaks.length} verboden input(s):\n  ${leaks.join('\n  ')}`);
  process.exit(1);
}
// De tools moeten er allemaal in zitten (hergebruik, geen kopie): elke toolmodule is een input.
const toolModules = readdirSync(join(root, 'src/services/mcp/tools')).filter((f) => f.endsWith('.ts'));
const missingTools = toolModules.filter((f) => !inputs.some((p) => p.endsWith(`src/services/mcp/tools/${f}`)));
if (missingTools.length > 0) {
  console.error(`XX toolmodules ontbreken in de bundel: ${missingTools.join(', ')}`);
  process.exit(1);
}
chmodSync(join(outDir, 'server.mjs'), 0o755);

let notices;
try {
  notices = thirdPartyNotices(inputs);
} catch (error) {
  console.error(`XX ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
writeFileSync(join(outDir, 'THIRD-PARTY-NOTICES.md'), `# Third-party notices

\`server.mjs\` of ${MCP_SERVER_PACKAGE_NAME} ${appPkg.version} bundles code from the packages below. Their
licenses and copyright notices follow in full. Generated by scripts/build-mcp-server.mjs from the bundle
metafile.

Bundled packages: ${notices.packages.join(', ')}.

${notices.sections}`);

const pkg = {
  name: MCP_SERVER_PACKAGE_NAME,
  version: appPkg.version,
  description: 'Headless MCP server of Open Planner Studio: the planner_* tools of the desktop app, on an IFC schedule on disk, without the app.',
  license: appPkg.license,
  repository: { type: 'git', url: 'https://github.com/OpenAEC-Foundation/open-planner-studio' },
  type: 'module',
  bin: { [BIN_NAME]: './server.mjs' },
  main: './server.mjs',
  files: ['server.mjs', 'README.md', 'LICENSE', 'LICENSE.GPL', 'THIRD-PARTY-NOTICES.md'],
  engines: { node: '>=22' },
};
writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
copyFileSync(join(root, 'LICENSE'), join(outDir, 'LICENSE'));
copyFileSync(join(root, 'LICENSE.GPL'), join(outDir, 'LICENSE.GPL'));
writeFileSync(join(outDir, 'README.md'), `# ${MCP_SERVER_PACKAGE_NAME}

Headless MCP server of [Open Planner Studio](https://github.com/OpenAEC-Foundation/open-planner-studio), version ${appPkg.version}.
The same \`planner_*\` tools as the MCP bridge in the desktop app, on a schedule in memory, with the files
in one working folder. No desktop app, no browser. Node ${pkg.engines.node}, one file, no dependencies.
It does not write a file that is open in the Open Planner Studio desktop app (see \`--discovery-dir\`).

\`\`\`bash
node server.mjs --root /path/to/schedules                 # stdio (default)
OPS_MCP_TOKEN=... node server.mjs --transport http        # streamable HTTP on 127.0.0.1:3878/mcp
node server.mjs --help
\`\`\`

Claude Code: \`claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/schedules\`

Documentation (Dutch): docs/headless-mcp.md in the repository. License: ${appPkg.license} (see LICENSE and LICENSE.GPL).
The bundle contains third-party code (${notices.packages.join(', ')}); see THIRD-PARTY-NOTICES.md.
`);

const kb = (result.metafile.outputs[relative(process.cwd(), join(outDir, 'server.mjs')).replace(/\\/g, '/')]?.bytes ?? 0) / 1024;
console.log(`OK — ${MCP_SERVER_PACKAGE_NAME}@${appPkg.version} gebouwd in ${relative(root, outDir) || '.'} ` +
  `(${inputs.length} bronmodules, ${Object.keys(assets).length} ingebedde teksten${kb ? `, ${kb.toFixed(0)} KB` : ''}).`);
