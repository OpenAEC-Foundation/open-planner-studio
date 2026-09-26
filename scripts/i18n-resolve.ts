// `npm run i18n:resolve` — voegt na `git merge <branch>` alle locale-bestanden PER SLEUTEL samen,
// in plaats van per regel zoals git. Draai het direct na de merge, vóór je iets anders aan de
// locale-bestanden doet — óók als git geen conflict in de locale-bestanden meldde:
//
//   git merge origin/main        # conflicten? dan loopt de merge nog: resolve, daarna `git commit`
//   npm run i18n:resolve         # alle 56 bestanden opnieuw samengevoegd, opgemaakt en ge-`git add`
//
// Maakte git de merge-commit al (geen enkel conflict), dan controleert hetzelfde commando die
// merge-commit (HEAD^1 + HEAD^2) per sleutel; wat het corrigeert staat daarna klaar voor
// `git commit --amend --no-edit` of een eigen commit, en klopt alles al, dan wijzigt het niets.
//
// Waarom niet gewoon git: sinds de eenmalige herschikking (vaste opmaak, `npm run i18n:fmt`) staan
// sleutels op andere regels dan in oudere branches. Git geeft dan conflicten over hele blokken, en
// erger: een bestand dat git "zonder conflict" samenvoegt kan fout zijn — een sleutel die de ene kant
// verwijdert en de andere alleen verplaatst, komt stil terug. Dit script leest daarom voor ELK
// locale-bestand de drie versies uit git (merge-base, HEAD en MERGE_HEAD; na de merge-commit HEAD^1
// en HEAD^2) en voegt ze samen met `mergeLocale` (scripts/i18n-tools.ts); wat git in de werkmap
// schreef, telt niet mee.
//
// Botst een sleutel echt (aan beide kanten anders gewijzigd), dan krijgt die tijdens de merge
// voorlopig de waarde van HEAD, wordt het bestand NIET ge-`git add` (git weigert dan te committen)
// en noemt het script per botsing beide waarden; pas het bestand aan en `git add` het zelf (exit 1).
// Achteraf blijft de waarde staan die de merge-commit voor zo'n sleutel al koos; het script noemt
// de sleutel alleen ter controle.
//
// Alleen bij een merge met één merge-base (geen rebase, cherry-pick of criss-cross-merge). Staat
// package.json zelf in conflict, los dat dan EERST op: npm én esbuild lezen het, dus geen enkel
// script start zolang er conflictmarkeringen in staan.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCALES, NAMESPACES, formatLocale, mergeLocale, serialize, type Json, type JsonObject, type MergeConflict,
} from './i18n-tools';

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

// Tijdens een merge: HEAD + MERGE_HEAD. Anders moet HEAD zelf een merge-commit zijn (git maakte hem
// al omdat er geen conflict was); dan HEAD^1 + HEAD^2, en mogen de locales geen niet-gecommitte wijzigingen hebben.
const merging = git('rev-parse', '-q', '--verify', 'MERGE_HEAD') !== null;
let ours = 'HEAD';
let theirs = 'MERGE_HEAD';
if (!merging) {
  const parents = (git('rev-list', '--parents', '-n', '1', 'HEAD') ?? '').trim().split(' ').slice(1);
  if (parents.length !== 2) {
    fail('er is geen `git merge` bezig en HEAD is geen merge-commit — draai dit tijdens of direct na '
      + '`git merge <branch>` (niet bij rebase of cherry-pick)');
  }
  if ((git('status', '--porcelain', '--', 'src/i18n/locales') ?? '').trim() !== '') {
    fail('HEAD is een merge-commit, maar src/i18n/locales heeft niet-gecommitte wijzigingen — commit of stash die eerst');
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
    if (oursText === null || theirsText === null) fail(`${rel} ontbreekt aan één kant van de merge — los dit bestand met de hand op`);
    const baseText = git('show', `${base}:${rel}`);
    // Achteraf is de merge-commit zelf de eerder gemaakte keuze: een botsing die daar al (met de
    // hand) is opgelost, blijft zo staan in plaats van terug te vallen op HEAD^1.
    const chosenText = merging ? null : git('show', `HEAD:${rel}`);
    const result = mergeLocale(
      baseText === null ? {} : parse(baseText, `${rel} (merge-base)`),
      parse(oursText, `${rel} (${ours})`),
      parse(theirsText, `${rel} (${theirs})`),
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
  const changed = (git('diff', '--cached', '--name-only', '--', 'src/i18n/locales') ?? '').trim().split('\n').filter(Boolean);
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
