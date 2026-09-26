/**
 * `npm run i18n:resolve` end-to-end, in een wegwerp-git-repo met alle 56 locale-bestanden.
 *
 * Bootst eerst de valkuil na waarvoor het script bestaat: de ene branch verwijdert een sleutel, de
 * andere verplaatst hem alleen (zoals de eenmalige herschikking) — git voegt dat "zonder conflict"
 * samen en de sleutel staat er weer. Daarna: het script herstelt dat tijdens de merge én achteraf op
 * de merge-commit, laat een echte botsing open (exit 1, bestand niet ge-`git add`), laat achteraf een
 * al gemaakte keuze staan en weigert buiten een merge. De pure samenvoegregels zelf staan in
 * check-i18n-tools.ts.
 */
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

  // Basis: tien sleutels per bestand, één per regel (de vaste opmaak).
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

  // "main": verplaatst b in de vertalingen naar achteren (alleen volgorde, geen inhoud).
  git('checkout', '-q', '-b', 'herschik');
  edit((loc, o) => {
    if (loc === 'nl') return o;
    const { b, ...rest } = o;
    return { ...rest, b };
  });
  git('commit', '-q', '-am', 'herschik');

  // "de branch": verwijdert b overal en voegt n toe na c.
  git('checkout', '-q', '-b', 'werk', 'basis');
  edit((loc, o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'b')
    .flatMap(([k, v]) => (k === 'c' ? [[k, v], ['n', `N ${loc}`]] : [[k, v]]))));
  git('commit', '-q', '-am', 'werk');
  const werk = git('rev-parse', 'HEAD').out.trim();

  // 1. De valkuil bestaat echt: git voegt samen zonder conflict en b komt terug in de vertalingen.
  git('merge', '--no-commit', '--no-ff', 'herschik');
  ok('1a git meldt geen conflict', unmerged().length === 0, unmerged().join(', '));
  ok('1b git brengt de verwijderde sleutel stil terug (de valkuil)', 'b' in read('en') && !('b' in read('nl')));

  // 2. Tijdens de merge: het script herstelt, maakt op en zet alles klaar.
  let r = resolveRun();
  ok('2a resolve tijdens merge: exit 0', r.status === 0, r.out);
  ok('2b b is weer weg in alle talen', LOCALES.every(l => !('b' in read(l))));
  ok('2c n staat in alle talen, na c', LOCALES.every(l => Object.keys(read(l)).join() === 'a,c,n,d,e,f,g,h,i,j'),
    Object.keys(read('en')).join());
  ok('2d alles ge-`git add`, commit lukt', git('commit', '-q', '-m', 'merge').status === 0);

  // 3. Achteraf: git maakte de merge-commit al (fout); het script corrigeert, daarna klopt hij.
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

  // 4. Echte botsing: beide kanten wijzigen de-a anders ⇒ exit 1, bestand blijft open, geldige JSON.
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
  // Met de hand gekozen (A1), vastgelegd; nogmaals draaien laat die keuze staan en meldt de sleutel.
  write('de', 'common', { ...read('de'), a: 'A1' });
  git('add', '-A');
  git('commit', '-q', '-m', 'merge x1');
  r = resolveRun();
  ok('4e achteraf: exit 0, de sleutel ter controle genoemd', r.status === 0 && r.out.includes('de/common.json a'), r.out);
  ok('4f achteraf: de gekozen waarde blijft staan, niets gewijzigd', read('de').a === 'A1'
    && r.out.includes('klopt per sleutel al') && git('status', '--porcelain', '--', 'src').out.trim() === '', r.out);
  git('reset', '-q', '--hard', x2);

  // 5. Buiten een merge (HEAD geen merge-commit): weigeren, niets schrijven.
  const before = readFileSync(file('en', 'common'), 'utf8');
  r = resolveRun();
  ok('5a geen merge ⇒ exit 1 met uitleg', r.status === 1 && r.out.includes('geen `git merge` bezig'), r.out);
  ok('5b geen merge ⇒ niets geschreven', readFileSync(file('en', 'common'), 'utf8') === before);
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
