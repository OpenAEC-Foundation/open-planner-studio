import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, NAMESPACES, serialize, type JsonObject } from '../../scripts/i18n-tools';

let checks = 0;
const diffs: string[] = [];
const ok = (label: string, cond: boolean, detail = '') => { checks++; if (!cond) diffs.push(`${label}${detail ? ` — ${detail}` : ''}`); };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const work = mkdtempSync(join(tmpdir(), 'ops-i18n-resolve-'));
const repo = join(work, 'repo');
const bundle = join(work, 'resolve.mjs');

const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd: repo, encoding: 'utf8' });
const git = (...args: string[]) => {
  const r = run('git', ['-c', 'user.name=ops-test', '-c', 'user.email=ops-test@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args]);
  return { status: r.status ?? 1, out: `${r.stdout}${r.stderr}` };
};
const resolveRun = () => {
  const r = run(process.execPath, [bundle]);
  return { status: r.status ?? 1, out: `${r.stdout}${r.stderr}` };
};
const file = (loc: string, ns: string) => join(repo, 'src', 'i18n', 'locales', loc, `${ns}.json`);
const read = (loc: string, ns = 'common') => JSON.parse(readFileSync(file(loc, ns), 'utf8')) as JsonObject;
const write = (loc: string, ns: string, obj: JsonObject) => writeFileSync(file(loc, ns), serialize(obj));
const edit = (fn: (loc: string, obj: JsonObject) => JsonObject, ns = 'common') => {
  for (const loc of LOCALES) write(loc, ns, fn(loc, read(loc, ns)));
};
const unmerged = () => git('diff', '--name-only', '--diff-filter=U').out.trim().split('\n').filter(Boolean);

try {
  const esbuild = spawnSync(join(root, 'node_modules', '.bin', 'esbuild'), [join(root, 'scripts', 'i18n-resolve.ts'),
    '--bundle', '--platform=node', '--format=esm', '--log-level=error', `--outfile=${bundle}`], { encoding: 'utf8' });
  if (esbuild.status !== 0) throw new Error(`bundelen van i18n-resolve.ts mislukt: ${esbuild.stderr}`);

  mkdirSync(repo, { recursive: true });
  git('init', '-q', '-b', 'basis');
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  for (const loc of LOCALES) {
    for (const ns of NAMESPACES) {
      mkdirSync(dirname(file(loc, ns)), { recursive: true });
      write(loc, ns, Object.fromEntries(keys.map(k => [k, `${k.toUpperCase()} ${loc}`])));
    }
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'basis');

  git('checkout', '-q', '-b', 'herschik');
  edit((loc, o) => {
    if (loc === 'nl') return o;
    const { b, ...rest } = o;
    return { ...rest, b };
  });
  git('commit', '-q', '-am', 'herschik');

  git('checkout', '-q', '-b', 'werk', 'basis');
  edit((loc, o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'b')
    .flatMap(([k, v]) => (k === 'c' ? [[k, v], ['n', `N ${loc}`]] : [[k, v]]))));
  git('commit', '-q', '-am', 'werk');
  const werk = git('rev-parse', 'HEAD').out.trim();

  git('merge', '--no-commit', '--no-ff', 'herschik');
  ok('1a git meldt geen conflict', unmerged().length === 0, unmerged().join(', '));
  ok('1b git brengt de verwijderde sleutel stil terug (de valkuil)', 'b' in read('en') && !('b' in read('nl')));

  let r = resolveRun();
  ok('2a resolve tijdens merge: exit 0', r.status === 0, r.out);
  ok('2b b is weer weg in alle talen', LOCALES.every(l => !('b' in read(l))));
  ok('2c n staat in alle talen, na c', LOCALES.every(l => Object.keys(read(l)).join() === 'a,c,n,d,e,f,g,h,i,j'),
    Object.keys(read('en')).join());
  ok('2d alles ge-`git add`, commit lukt', git('commit', '-q', '-m', 'merge').status === 0);

  git('checkout', '-q', '-B', 'werk2', werk);
  git('merge', '-q', '--no-edit', 'herschik');
  ok('3a merge-commit bevat de teruggekomen sleutel', 'b' in read('en'));
  r = resolveRun();
  ok('3b resolve na de merge-commit: exit 0 en een correctie', r.status === 0 && r.out.includes('week per sleutel af'), r.out);
  ok('3c correctie klaargezet (staged)', git('diff', '--cached', '--name-only').out.includes('en/common.json'));
  git('commit', '-q', '--amend', '--no-edit');
  ok('3d na amend: b weg in de commit', !('b' in read('en')));
  r = resolveRun();
  ok('3e nogmaals: klopt al, niets gewijzigd', r.status === 0 && r.out.includes('klopt per sleutel al'), r.out);

  git('checkout', '-q', '-b', 'x1', 'basis');
  write('de', 'common', { ...read('de'), a: 'A1' });
  git('commit', '-q', '-am', 'x1');
  git('checkout', '-q', '-b', 'x2', 'basis');
  write('de', 'common', { ...read('de'), a: 'A2' });
  git('commit', '-q', '-am', 'x2');
  const x2 = git('rev-parse', 'HEAD').out.trim();
  git('merge', '--no-commit', 'x1');
  r = resolveRun();
  ok('4a botsing: exit 1 en de sleutel genoemd', r.status === 1 && r.out.includes('de/common.json a'), r.out);
  ok('4b botsend bestand niet ge-`git add`', unmerged().includes('src/i18n/locales/de/common.json'), unmerged().join(', '));
  ok('4c botsend bestand is geldige JSON met de waarde van HEAD', read('de').a === 'A2');
  ok('4d git weigert te committen zolang het open staat', git('commit', '-q', '-m', 'x').status !== 0);
  write('de', 'common', { ...read('de'), a: 'A1' });
  git('add', '-A');
  git('commit', '-q', '-m', 'merge x1');
  r = resolveRun();
  ok('4e achteraf: exit 0, de sleutel ter controle genoemd', r.status === 0 && r.out.includes('de/common.json a'), r.out);
  ok('4f achteraf: de gekozen waarde blijft staan, niets gewijzigd', read('de').a === 'A1'
    && r.out.includes('klopt per sleutel al') && git('status', '--porcelain', '--', 'src').out.trim() === '', r.out);
  git('reset', '-q', '--hard', x2);

  const before = readFileSync(file('en', 'common'), 'utf8');
  r = resolveRun();
  ok('5a geen merge ⇒ exit 1 met uitleg', r.status === 1 && r.out.includes('geen `git merge` bezig'), r.out);
  ok('5b geen merge ⇒ niets geschreven', readFileSync(file('en', 'common'), 'utf8') === before);

  git('checkout', '-q', '-b', 'oud', 'basis');
  git('rm', '-q', '-r', 'src/i18n/locales/lo');
  git('commit', '-q', '-m', 'zonder lo');
  git('checkout', '-q', '-b', 'metlo', 'oud');
  git('checkout', 'basis', '--', 'src/i18n/locales/lo');
  git('commit', '-q', '-m', 'lo erbij');
  git('checkout', '-q', '-b', 'ander', 'oud');
  for (const ns of NAMESPACES) write('nl', ns, { ...read('nl', ns), z: 'Z nl' });
  git('commit', '-q', '-am', 'nl z');
  git('merge', '--no-commit', '--no-ff', 'metlo');
  r = resolveRun();
  ok('6a nieuwe taal aan één kant ⇒ exit 0', r.status === 0, r.out);
  ok('6b de nieuwe taal blijft zoals hij binnenkwam', read('lo').a === 'A lo', JSON.stringify(read('lo')));
  ok('6c de andere kant blijft ook staan', read('nl').z === 'Z nl');
  git('merge', '--abort');

  const src = join(repo, 'i18n', 'ui-sources', 'de.json');
  const readSrc = () => JSON.parse(readFileSync(src, 'utf8')) as { common: Record<string, string> };
  const writeSrc = (h: string) => writeFileSync(src, serialize({ common: { a: h, c: 'c0' } }));
  git('checkout', '-q', '-b', 'h0', 'basis');
  mkdirSync(dirname(src), { recursive: true });
  writeSrc('h0');
  git('add', '-A');
  git('commit', '-q', '-m', 'hashes');
  git('checkout', '-q', '-b', 'h1', 'h0');
  writeSrc('h1');
  git('commit', '-q', '-am', 'h1');
  git('checkout', '-q', '-b', 'h2', 'h0');
  writeSrc('h2');
  git('commit', '-q', '-am', 'h2');
  git('merge', '--no-commit', 'h1');
  r = resolveRun();
  ok('7a botsende hash tijdens de merge: exit 0, weggelaten en genoemd', r.status === 0 && !('a' in readSrc().common)
    && readSrc().common.c === 'c0' && r.out.includes('de common.a'), r.out);
  writeSrc('h1');
  git('add', '-A');
  git('commit', '-q', '-m', 'merge h1, hash met de hand gekozen');
  r = resolveRun();
  ok('7b achteraf: de gekozen hash blijft staan', r.status === 0 && readSrc().common.a === 'h1'
    && r.out.includes('keuze in de merge-commit blijft') && git('status', '--porcelain', '--', 'i18n').out.trim() === '', r.out);
  writeSrc('h3');
  r = resolveRun();
  ok('7c achteraf met een open wijziging in ui-sources: weigeren, niets overschreven',
    r.status === 1 && r.out.includes('i18n/ui-sources') && readSrc().common.a === 'h3', r.out);
  git('checkout', '--', 'i18n');
} catch (err) {
  diffs.push(`onverwachte fout: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (diffs.length === 0) {
  console.log(`OK  i18n-resolve: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  i18n-resolve: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
