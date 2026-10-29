#!/usr/bin/env node
// Poort tegen circulaire imports binnen `src/` (bevinding K-item 27).
//
// Waarom dit bestaat. Er stonden twee échte runtime-cykels in de state-laag:
//
//   projectSlice → transaction → snapshot → documentContract → projectSlice
//   projectSlice → transaction → snapshot → projectSlice
//
// Die wérkten, maar uitsluitend doordat de betrokken fabrieken *function declarations* waren en
// dus gehoist worden. Iemand die er `export const f = () => …` van maakt — een onschuldig ogende
// stijlwijziging — laat de app crashen bij module-init met een TDZ-`ReferenceError`, mogelijk pas
// in de productiebundel, omdat Vite daar een andere modulevolgorde kiest dan in dev. Zo'n fout is
// niet te zien in een review en niet te vangen door `tsc`.
//
// Waarom geen madge/dpdm: die zouden een dependency toevoegen aan een repo die er bewust weinig
// heeft, terwijl esbuild er al is. De metafile van esbuild is bovendien preciezer voor dit doel —
// het is de graaf ná type-erasure, dus exact de imports die op runtime bestaan. `import type`
// telt niet mee, en dat is juist: een type-cyclus is onschadelijk.
//
//   node scripts/verify-cycles.mjs     # exit 0 = geen cykels, 1 = minstens één
import esbuild from 'esbuild';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const result = await esbuild.build({
  // De app, de headless MCP-server (issue #570: bundelt app-code buiten `main.tsx` om) en de proxy
  // van de Claude Desktop-bundel (#567).
  entryPoints: [
    join(root, 'src', 'main.tsx'),
    join(root, 'headless', 'mcp-server', 'src', 'main.ts'),
    join(root, 'integrations', 'claude-desktop', 'src', 'main.ts'),
  ],
  outdir: join(root, 'node_modules', '.cache', 'ops-verify-cycles'),
  bundle: true,
  write: false,
  metafile: true,
  platform: 'browser',
  format: 'esm',
  alias: { '@': join(root, 'src') },
  logLevel: 'silent',
  // Externe pakketten hoeven niet doorzocht: we kijken alleen naar onze eigen graaf, en dit
  // scheelt het bundelen van de hele node_modules-boom.
  packages: 'external',
  // Assets doen niet mee aan de import-graaf; ze zouden alleen een loader-fout geven. Vite's
  // `?url`-suffix hoort bij dezelfde categorie en wordt hieronder weggevangen.
  loader: {
    '.css': 'empty', '.png': 'empty', '.svg': 'empty', '.jpg': 'empty',
    '.woff': 'empty', '.woff2': 'empty', '.ttf': 'empty', '.wasm': 'empty',
  },
  plugins: [{
    name: 'ops-asset-urls',
    setup(build) {
      // `import x from './y.ttf?url'` (Vite-specifiek) resolvet esbuild niet; markeer als extern.
      build.onResolve({ filter: /\?url$/ }, (args) => ({ path: args.path, external: true }));
      // De virtuele module met ingebedde teksten van de MCP-serverbouw (scripts/build-mcp-server.mjs).
      build.onResolve({ filter: /^ops:/ }, (args) => ({ path: args.path, external: true }));
    },
  }],
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    '__APP_VERSION__': '"0.0.0"',
    '__OPS_DEV_INSTANCE__': '""',
  },
});

// Graaf beperken tot onze eigen bronbestanden.
const isOwn = (p) => (p.startsWith('src/') || p.startsWith('headless/mcp-server/src/') || p.startsWith('integrations/'))
  && !p.includes('node_modules');
const graph = new Map();
for (const [file, info] of Object.entries(result.metafile.inputs)) {
  if (!isOwn(file)) continue;
  const targets = (info.imports ?? [])
    .filter((i) => !i.external && isOwn(i.path))
    .map((i) => i.path);
  graph.set(file, [...new Set(targets)]);
}

// Iteratieve DFS met een expliciet pad, zodat we de cyclus zelf kunnen tonen en niet alleen
// melden dát er één is. Recursie zou hier op een diepe graaf de stack kunnen raken.
const WHITE = 0, GREY = 1, BLACK = 2;
const color = new Map([...graph.keys()].map((k) => [k, WHITE]));
const cycles = [];
const seen = new Set();

for (const start of graph.keys()) {
  if (color.get(start) !== WHITE) continue;
  const stack = [{ node: start, next: 0 }];
  color.set(start, GREY);
  while (stack.length) {
    const top = stack[stack.length - 1];
    const kids = graph.get(top.node) ?? [];
    if (top.next >= kids.length) {
      color.set(top.node, BLACK);
      stack.pop();
      continue;
    }
    const kid = kids[top.next++];
    const c = color.get(kid);
    if (c === GREY) {
      // Terugrand gevonden: het pad vanaf `kid` tot de top is de cyclus.
      const at = stack.findIndex((f) => f.node === kid);
      const cycle = stack.slice(at).map((f) => f.node);
      // Normaliseer op de alfabetisch kleinste module, zodat dezelfde cyclus die via twee
      // verschillende startpunten wordt gevonden maar één keer wordt gemeld.
      const min = cycle.indexOf([...cycle].sort()[0]);
      const rotated = [...cycle.slice(min), ...cycle.slice(0, min)];
      const key = rotated.join(' → ');
      if (!seen.has(key)) { seen.add(key); cycles.push(rotated); }
    } else if (c === WHITE) {
      color.set(kid, GREY);
      stack.push({ node: kid, next: 0 });
    }
  }
}

const moduleCount = graph.size;
if (cycles.length === 0) {
  console.log(`OK — geen circulaire imports in ${moduleCount} modules onder src/ en headless/mcp-server/src/.`);
  process.exit(0);
}

console.log(`XX ${cycles.length} circulaire import${cycles.length === 1 ? '' : 'en'} in src/:`);
for (const c of cycles) {
  console.log(`   - ${[...c, c[0]].join('\n     → ')}`);
}
console.log('\nEen cyclus werkt vaak "toevallig" door function-hoisting en klapt om zodra iemand');
console.log('een functie-declaratie naar een const-arrow verandert. Haal de gedeelde waarde naar');
console.log('een bladmodule (zie src/state/defaults.ts) in plaats van de import terug te draaien.');
process.exit(1);
