#!/usr/bin/env node
// Bouwt de headless kern (`src/core/`) als zelfstandig Node-pakket `@openaec/open-planner-core`
// in `dist-core/`: één ESM-bundel zonder runtime-dependencies, typedeclaraties, een gegenereerde
// package.json (versie = appversie, licentie = repolicentie), de licentieteksten, de licenties van
// de meegebundelde dependencies (THIRD-PARTY-NOTICES.md) en een README.
// Er wordt NIET gepubliceerd. Uitleg: docs/headless-kern.md.
//
//   npm run build:core              # → dist-core/
//   node scripts/build-core.mjs --out <map>
//
// De bouw controleert ook de grens van de library mechanisch (zie FORBIDDEN_INPUTS): React, Tauri,
// de app-singleton (`src/state/appStore.ts`), UI-componenten en de i18n-UI-config mogen niet in de
// bundel zitten. Code die alleen achter een dynamische import of een React-hook leeft, wordt
// vervangen door een stub die bij gebruik een duidelijke fout gooit.
import esbuild from 'esbuild';
import ts from 'typescript';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { thirdPartyNotices } from './lib/third-party-notices.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outIdx = process.argv.indexOf('--out');
const outDir = resolve(outIdx >= 0 ? process.argv[outIdx + 1] : join(root, 'dist-core'));

const appPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
export const CORE_PACKAGE_NAME = '@openaec/open-planner-core';

// Modules die de kern niet nodig heeft en die alleen bereikbaar zijn via een dynamische import of
// binnen een React-hook. De stub gooit pas bij GEBRUIK, niet bij het laden.
const STUBBED = [
  /^react$/, /^react-dom(\/.*)?$/, /^react-i18next$/, /^@tauri-apps\//, /^@\/i18n\/config$/,
];
const stubPlugin = {
  name: 'ops-core-stubs',
  setup(build) {
    // zustand: alleen de vanilla store, zonder React-hook (`create` geeft een functie-object met de
    // store-API, net als zustand zelf, maar zonder `useSyncExternalStore`).
    build.onResolve({ filter: /^zustand$/ }, () => ({ path: 'zustand', namespace: 'ops-core-zustand' }));
    build.onLoad({ filter: /.*/, namespace: 'ops-core-zustand' }, () => ({
      resolveDir: root,
      contents: `
        import { createStore } from 'zustand/vanilla';
        const bind = (api) => Object.assign(() => {
          throw new Error('React hooks are not available in @openaec/open-planner-core');
        }, api);
        export const create = (init) => (init ? bind(createStore(init)) : (i) => bind(createStore(i)));
        export { createStore };`,
    }));
    for (const filter of STUBBED) {
      build.onResolve({ filter }, (args) => ({ path: args.path, namespace: 'ops-core-stub' }));
    }
    build.onLoad({ filter: /.*/, namespace: 'ops-core-stub' }, (args) => ({
      contents: `
        const fail = () => { throw new Error(${JSON.stringify(`"${args.path}" is not available in ${CORE_PACKAGE_NAME}`)}); };
        const stub = new Proxy(function () {}, { get: (_t, k) => (k === '__esModule' ? true : k === 'then' ? undefined : fail()), apply: fail, construct: fail });
        export default stub;`,
    }));
  },
};

// Inputs die nooit in de bundel mogen landen (padfragmenten, relatief aan de bundel-metafile).
const FORBIDDEN_INPUTS = [
  'src/state/appStore.ts',
  'src/components/',
  'src/i18n/config.ts',
  'src/i18n/locales/',
  'node_modules/react/',
  'node_modules/react-dom/',
  'node_modules/@tauri-apps/',
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const result = await esbuild.build({
  entryPoints: [join(root, 'src/core/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: join(outDir, 'index.mjs'),
  alias: { '@': join(root, 'src') },
  plugins: [stubPlugin],
  metafile: true,
  legalComments: 'eof',
  logLevel: 'warning',
  banner: { js: `// ${CORE_PACKAGE_NAME} ${appPkg.version} — ${appPkg.license}. Gebouwd met scripts/build-core.mjs; niet met de hand bewerken.` },
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    '__OPS_DEV_INSTANCE__': '"core"',
    '__OPS_CORE_VERSION__': JSON.stringify(appPkg.version),
  },
});

const inputs = Object.keys(result.metafile.inputs).map((p) => p.replace(/\\/g, '/'));
const leaks = inputs.filter((p) => FORBIDDEN_INPUTS.some((f) => p.includes(f)));
if (leaks.length > 0) {
  console.error(`XX de kernbundel bevat ${leaks.length} verboden input(s):\n  ${leaks.join('\n  ')}`);
  process.exit(1);
}

// Typedeclaraties: alleen de publieke bestanden, per bestand (isolatedDeclarations-stijl). Een
// declaratie mag uitsluitend naar `./api` verwijzen — anders lekt een intern type het contract in.
const declarations = [['src/core/index.ts', 'index.d.ts'], ['src/core/api.ts', 'api.d.ts']];
for (const [src, out] of declarations) {
  const text = readFileSync(join(root, src), 'utf8');
  const { outputText, diagnostics } = ts.transpileDeclaration(text, {
    fileName: src,
    compilerOptions: { isolatedDeclarations: true, declaration: true, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  if (diagnostics?.length) {
    for (const d of diagnostics) console.error(`XX ${src}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    process.exit(1);
  }
  // `./api` → `./api.js`, zodat Node16/NodeNext-consumenten de declaratie vinden.
  const fixed = outputText.replace(/from '\.\/api'/g, "from './api.js'");
  const foreign = [...fixed.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map((m) => m[1]).filter((s) => s !== './api.js');
  if (foreign.length > 0) {
    console.error(`XX ${out} verwijst naar interne modules: ${foreign.join(', ')}`);
    process.exit(1);
  }
  writeFileSync(join(outDir, out), fixed);
}
// Licenties van de MEEGEBUNDELDE dependencies (afgeleid uit de metafile, niet uit een vaste lijst):
// per pakket naam, versie, licentie en de volledige licentietekst uit node_modules. Een gebundeld
// pakket zonder licentiebestand laat de bouw falen.
let notices;
try {
  notices = thirdPartyNotices(inputs);
} catch (error) {
  console.error(`XX ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const bundledPackages = new Map(notices.packages.map((name) => [name, true]));
const noticeParts = [notices.sections];
writeFileSync(join(outDir, 'THIRD-PARTY-NOTICES.md'), `# Third-party notices

\`index.mjs\` of ${CORE_PACKAGE_NAME} ${appPkg.version} bundles code from the packages below. Their
licenses and copyright notices follow in full. Generated by scripts/build-core.mjs from the bundle
metafile.

Bundled packages: ${[...bundledPackages.keys()].sort().join(', ')}.

${noticeParts.join('\n')}`);

const pkg = {
  name: CORE_PACKAGE_NAME,
  version: appPkg.version,
  description: 'Headless core of Open Planner Studio: open an IFC schedule, calculate it like the app, summarise it as JSON and write it back to IFC.',
  license: appPkg.license,
  repository: { type: 'git', url: 'https://github.com/OpenAEC-Foundation/open-planner-studio' },
  type: 'module',
  main: './index.mjs',
  types: './index.d.ts',
  exports: {
    '.': { types: './index.d.ts', import: './index.mjs', default: './index.mjs' },
    './package.json': './package.json',
  },
  files: ['index.mjs', 'index.d.ts', 'api.d.ts', 'README.md', 'LICENSE', 'LICENSE.GPL', 'THIRD-PARTY-NOTICES.md'],
  engines: { node: '>=22' },
  sideEffects: true,
};
writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
copyFileSync(join(root, 'LICENSE'), join(outDir, 'LICENSE'));
copyFileSync(join(root, 'LICENSE.GPL'), join(outDir, 'LICENSE.GPL'));
writeFileSync(join(outDir, 'README.md'), `# ${CORE_PACKAGE_NAME}

Headless core of [Open Planner Studio](https://github.com/OpenAEC-Foundation/open-planner-studio), version ${appPkg.version}.
No React, no DOM, no desktop shell. Node ${pkg.engines.node}, ESM only.

\`\`\`js
import { openIfc, PlannerCoreError } from '${CORE_PACKAGE_NAME}';

const doc = await openIfc(ifcText);   // PlannerDocument
const summary = doc.schedule();       // calculate like the app (F5) → JSON summary
const ifc = doc.toIfc();              // IFC text with the calculated dates
\`\`\`

Errors are always \`PlannerCoreError\` with a fixed \`code\`: \`INVALID_INPUT\`, \`IFC_READ_FAILED\`,
\`NO_TASKS\`, \`SCHEDULE_FAILED\`, \`IFC_WRITE_FAILED\`.

Documentation (Dutch): docs/headless-kern.md in the repository. License: ${appPkg.license} (see LICENSE and LICENSE.GPL).
The bundle contains third-party code (${[...bundledPackages.keys()].sort().join(', ')}); see THIRD-PARTY-NOTICES.md.
`);

const kb = (result.metafile.outputs[relative(process.cwd(), join(outDir, 'index.mjs')).replace(/\\/g, '/')]?.bytes ?? 0) / 1024;
console.log(`OK — ${CORE_PACKAGE_NAME}@${appPkg.version} gebouwd in ${relative(root, outDir) || '.'} (${inputs.length} bronmodules${kb ? `, ${kb.toFixed(0)} KB` : ''}).`);
