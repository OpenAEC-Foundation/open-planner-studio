import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCALES, NAMESPACES, formatLocale, mergeLocale, serialize, type Json, type JsonObject, type MergeConflict,
} from './i18n-tools';
import { orderSources, type UiSources } from './translate/ui';

function fail(message: string): never {
  console.log(`XX  i18n:resolve: ${message}`);
  process.exit(1);
}

const git = (...args: string[]): string | null => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return null;
  }
};

const root = git('rev-parse', '--show-toplevel')?.trim();
if (!root) fail('niet in een git-werkmap');
process.chdir(root);

const merging = git('rev-parse', '-q', '--verify', 'MERGE_HEAD') !== null;
let ours = 'HEAD';
let theirs = 'MERGE_HEAD';
if (!merging) {
  const parents = (git('rev-list', '--parents', '-n', '1', 'HEAD') ?? '').trim().split(' ').slice(1);
  if (parents.length !== 2) {
    fail('er is geen `git merge` bezig en HEAD is geen merge-commit — draai dit tijdens of direct na '
      + '`git merge <branch>` (niet bij rebase of cherry-pick)');
  }
  if ((git('status', '--porcelain', '--', 'src/i18n/locales', 'i18n/ui-sources') ?? '').trim() !== '') {
    fail('HEAD is een merge-commit, maar src/i18n/locales of i18n/ui-sources heeft niet-gecommitte wijzigingen — commit of stash die eerst');
  }
  [ours, theirs] = ['HEAD^1', 'HEAD^2'];
}
const bases = (git('merge-base', '--all', ours, theirs) ?? '').trim().split('\n').filter(Boolean);
if (bases.length !== 1) {
  fail(`${bases.length} merge-bases — per sleutel samenvoegen is dan niet eenduidig; los de locale-bestanden `
    + 'met de hand op en controleer met `npm run verify:i18n`');
}
const [base] = bases;

const parse = (text: string, label: string): JsonObject => {
  try {
    return JSON.parse(text) as JsonObject;
  } catch (err) {
    fail(`${label} is geen geldige JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
};

const conflicts: (MergeConflict & { file: string })[] = [];
const clean: string[] = [];
const dirty = new Set<string>();

for (const ns of NAMESPACES) {
  const mergeOne = (loc: string): { rel: string; merged: JsonObject } => {
    const rel = `src/i18n/locales/${loc}/${ns}.json`;
    const oursText = git('show', `${ours}:${rel}`);
    const theirsText = git('show', `${theirs}:${rel}`);
    const baseText = git('show', `${base}:${rel}`);
    if ((oursText === null || theirsText === null) && (baseText !== null || (oursText === null && theirsText === null))) {
      fail(`${rel} ontbreekt aan één kant van de merge — los dit bestand met de hand op`);
    }
    const chosenText = merging ? null : git('show', `HEAD:${rel}`);
    const result = mergeLocale(
      baseText === null ? {} : parse(baseText, `${rel} (merge-base)`),
      oursText === null ? {} : parse(oursText, `${rel} (${ours})`),
      theirsText === null ? {} : parse(theirsText, `${rel} (${theirs})`),
      chosenText === null ? undefined : parse(chosenText, `${rel} (HEAD)`),
    );
    for (const c of result.conflicts) conflicts.push({ file: `${loc}/${ns}.json`, ...c });
    if (merging && result.conflicts.length > 0) dirty.add(rel);
    return { rel, merged: result.merged };
  };

  const nl = mergeOne('nl');
  const nlText = formatLocale(serialize(nl.merged), serialize(nl.merged));
  writeFileSync(join(root, nl.rel), nlText);
  if (!dirty.has(nl.rel)) clean.push(nl.rel);
  for (const loc of LOCALES) {
    if (loc === 'nl') continue;
    const { rel, merged } = mergeOne(loc);
    writeFileSync(join(root, rel), formatLocale(serialize(merged), nlText));
    if (!dirty.has(rel)) clean.push(rel);
  }
}

const sourceDrops: string[] = [];
const sourceKept: string[] = [];
const nlMerged = Object.fromEntries(NAMESPACES.map(ns => [ns, parse(
  readFileSync(join(root, `src/i18n/locales/nl/${ns}.json`), 'utf8'), `nl/${ns}.json`)]));
for (const loc of LOCALES) {
  if (loc === 'nl') continue;
  const rel = `i18n/ui-sources/${loc}.json`;
  const o = git('show', `${ours}:${rel}`);
  const t = git('show', `${theirs}:${rel}`);
  if (o === null && t === null) continue;
  const b = git('show', `${base}:${rel}`);
  const chosenText = merging ? null : git('show', `HEAD:${rel}`);
  const result = mergeLocale(b === null ? {} : parse(b, `${rel} (merge-base)`), o === null ? {} : parse(o, `${rel} (${ours})`),
    t === null ? {} : parse(t, `${rel} (${theirs})`), chosenText === null ? undefined : parse(chosenText, `${rel} (HEAD)`));
  const merged = result.merged as unknown as UiSources;
  for (const c of result.conflicts) {
    if (!merging) { sourceKept.push(`${loc} ${c.path}`); continue; }
    const [ns, ...rest] = c.path.split('.');
    if (merged[ns]) delete merged[ns][rest.join('.')];
    sourceDrops.push(`${loc} ${c.path}`);
  }
  writeFileSync(join(root, rel), serialize(orderSources(merged, nlMerged) as unknown as JsonObject));
  clean.push(rel);
}
if (sourceDrops.length > 0) {
  console.log(`!!  i18n:resolve: ${sourceDrops.length} bron-hash(es) aan beide kanten anders; weggelaten (de vertaalstraat ziet ze als "zonder hash"):`);
  for (const d of sourceDrops.slice(0, 20)) console.log(`   - ${d}`);
}
if (sourceKept.length > 0) {
  console.log(`!!  i18n:resolve: ${sourceKept.length} bron-hash(es) waren aan beide kanten anders; de keuze in de merge-commit blijft staan:`);
  for (const d of sourceKept.slice(0, 20)) console.log(`   - ${d}`);
}

if (clean.length > 0 && git('add', '--', ...clean) === null) fail('`git add` van de samengevoegde bestanden mislukte');

const show = (v: Json | undefined) => (v === undefined ? '(weg)' : JSON.stringify(v));
if (merging && conflicts.length > 0) {
  console.log(`XX  i18n:resolve: ${conflicts.length} sleutel(s) aan beide kanten anders gewijzigd — `
    + `${dirty.size} bestand(en) staan nog open (waarde van ${ours} ingevuld, niet ge-\`git add\`):`);
  for (const c of conflicts) {
    console.log(`   - ${c.file} ${c.path}\n       basis: ${show(c.base)}\n       ${ours}: ${show(c.ours)}\n       ${theirs}: ${show(c.theirs)}`);
  }
  console.log('    Kies per sleutel de juiste waarde, dan `git add` op die bestanden en `npm run verify:i18n`.');
  process.exit(1);
}
if (!merging) {
  if (conflicts.length > 0) {
    console.log(`!!  i18n:resolve: ${conflicts.length} sleutel(s) waren aan beide kanten anders gewijzigd; de merge-commit `
      + 'koos er al een waarde voor en die blijft staan — controleer ze:');
    for (const c of conflicts) console.log(`   - ${c.file} ${c.path}: HEAD^1 ${show(c.ours)} · HEAD^2 ${show(c.theirs)}`);
  }
  const changed = (git('diff', '--cached', '--name-only', '--', 'src/i18n/locales', 'i18n/ui-sources') ?? '').trim().split('\n').filter(Boolean);
  if (changed.length === 0) {
    console.log(`OK  i18n:resolve: de merge-commit HEAD klopt per sleutel al — niets gewijzigd (merge-base ${base.slice(0, 8)})`);
  } else {
    console.log(`!!  i18n:resolve: de merge-commit HEAD week per sleutel af in ${changed.length} bestand(en); gecorrigeerd en `
      + 'ge-`git add` — bekijk `git diff --cached` en leg vast met `git commit --amend --no-edit` (of een eigen commit):');
    for (const f of changed) console.log(`   - ${f}`);
  }
  process.exit(0);
}
console.log(`OK  i18n:resolve: alle ${clean.length} locale-bestanden per sleutel samengevoegd, opgemaakt en ge-\`git add\` `
  + `(merge-base ${base.slice(0, 8)}); rond af met \`git commit\` en controleer met \`npm run verify:i18n\``);
