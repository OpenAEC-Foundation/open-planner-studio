#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASIS = 'f95b8adf4a8aca8a3f2a89e2f4aa530eeaf48185';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'tests/planning/fixtures/main-bom-eigen-bestand.json');
const option = name => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? resolve(process.argv[at + 1]) : null;
};
const parent = option('--werkmap') ?? tmpdir();
const out = option('--uit') ?? OUT;
const requireRepo = createRequire(join(ROOT, 'package.json'));
const esbuild = requireRepo('esbuild');
const fontkit = requireRepo.resolve('fontkit');
const unicodeTrie = join(dirname(createRequire(fontkit).resolve('unicode-properties')), 'binaryTrie.browser.js');

execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${BASIS}^{commit}`]);
mkdirSync(parent, { recursive: true });
const work = mkdtempSync(join(parent, 'ops-bom-main-'));
try {
  const tar = execFileSync('git', ['-C', ROOT, 'archive', BASIS, 'src'], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', work], { input: tar });
  const helper = join(ROOT, 'tests/planning/bomEigenBestand.ts');
  const entry = `
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inputHashes, loadFiles, runBoundaries, runCases } from ${JSON.stringify(helper)};
const [repo, out, basis] = process.argv.slice(2);
const root = mkdtempSync(join(tmpdir(), 'ops-bom-opname-'));
try {
  const files = await loadFiles(repo);
  const cases = await runCases(root, files, false);
  const boundaries = await runBoundaries(root, files, false);
  const lines = Object.entries(cases).map(([name, steps]) => '  ' + JSON.stringify(name) + ': ' + JSON.stringify(steps));
  const edges = Object.entries(boundaries).map(([name, steps]) => '  ' + JSON.stringify(name) + ': ' + JSON.stringify(steps));
  writeFileSync(out, '{\\n"basis": ' + JSON.stringify(basis) + ',\\n"inputs": ' + JSON.stringify(inputHashes(files)) + ',\\n"cases": {\\n'
    + lines.join(',\\n') + '\\n},\\n"boundaries": {\\n' + edges.join(',\\n') + '\\n}\\n}\\n');
  console.log('gevallen: ' + lines.length + ', grensgevallen: ' + edges.length);
} finally { rmSync(root, { recursive: true, force: true }); }
process.exit(0);
`;
  const bundle = join(work, 'opname.mjs');
  const built = await esbuild.build({
    absWorkingDir: ROOT, metafile: true,
    stdin: { contents: entry, resolveDir: work, loader: 'ts', sourcefile: 'opname.ts' },
    bundle: true, platform: 'node', format: 'esm', write: true, outfile: bundle, logLevel: 'error',
    tsconfigRaw: { compilerOptions: { jsx: 'react-jsx', useDefineForClassFields: true } },
    nodePaths: [join(ROOT, 'node_modules')],
    alias: { '@': join(work, 'src'), '#binary-trie': unicodeTrie },
    external: ['react-dom/server'],
    define: {
      'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"',
      __OPS_DEV_INSTANCE__: '"test"',
    },
  });
  const fromBranch = Object.keys(built.metafile.inputs).filter(input => input.startsWith('src/'));
  if (fromBranch.length) throw new Error(`de opname bevat code uit src/ van de werkmap: ${fromBranch.slice(0, 5).join(', ')}`);
  const fromMain = Object.keys(built.metafile.inputs).filter(input => resolve(ROOT, input).startsWith(join(work, 'src'))).length;
  console.log(`bundel: ${fromMain} bestanden uit src/ van ${BASIS.slice(0, 9)}`);
  execFileSync(process.execPath, [bundle, ROOT, out, BASIS], { stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Amsterdam' } });
  console.log(`OK  opname van main ${BASIS}: ${out.startsWith(ROOT) ? out.slice(ROOT.length + 1) : out}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
