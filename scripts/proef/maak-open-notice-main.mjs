#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const basis = execFileSync('git', ['-C', root, 'rev-parse', process.argv[2] || 'origin/main'], { encoding: 'utf8' }).trim();
const output = resolve(root, process.argv[3] || 'tests/planning/fixtures/open-notice-main.json');
const fontkit = createRequire(join(root, 'tests/planning/x.js')).resolve('fontkit');
const trie = join(dirname(createRequire(fontkit).resolve('unicode-properties')), 'binaryTrie.browser.js');
mkdirSync(join(root, 'temp'), { recursive: true });
const work = mkdtempSync(join(root, 'temp/open-notice-main-'));
try {
  const archive = execFileSync('git', ['-C', root, 'archive', basis, 'src'], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', work], { input: archive });
  writeFileSync(join(work, 'entry.ts'), `
import { writeFileSync } from 'node:fs';
import { installBrowserStubs, installDeterminism } from ${JSON.stringify(join(root, 'tests/planning/ifcPariteitKern.ts'))};
installBrowserStubs();
installDeterminism();
const { recordOpenNoticeReference } = await import(${JSON.stringify(join(root, 'tests/planning/ifcOpenNoticeMatrix.ts'))});
const text = await recordOpenNoticeReference(${JSON.stringify(root)}, ${JSON.stringify(basis)});
writeFileSync(${JSON.stringify(output)}, text);
const reference = JSON.parse(text);
console.log('OK meldingen bij openen: ' + Object.keys(reference.cases).length + ' gevallen, ' + reference.representatives.length + ' handtekeningen, op main ' + ${JSON.stringify(basis)});
process.exit(0);
`);
  execFileSync(join(root, 'node_modules/.bin/esbuild'), [join(work, 'entry.ts'), '--bundle', '--platform=node', '--format=esm',
    `--alias:@=${join(work, 'src')}`, `--alias:#binary-trie=${trie}`, '--external:react-dom/server', '--define:import.meta.env.DEV=false',
    '--define:import.meta.env.PROD=true', '--define:import.meta.env.MODE="production"', '--define:__OPS_DEV_INSTANCE__="test"',
    `--outfile=${join(work, 'entry.mjs')}`, '--log-level=error'], { cwd: root, stdio: 'inherit' });
  execFileSync(process.execPath, [join(work, 'entry.mjs')], { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Amsterdam' } });
} finally {
  rmSync(work, { recursive: true, force: true });
}
