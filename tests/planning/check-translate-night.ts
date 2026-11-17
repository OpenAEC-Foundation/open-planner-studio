/**
 * Vertaalstraat — de nachtvertaling (scripts/translate/night.ts, plan docs/superpowers/plans/2026-11-17-nachtvertalingen.md).
 *
 * Bewaakt: welke nl-eenheden "af" zijn (48 uur ongewijzigd op first-parent main, ook heen en terug telt als
 * veranderd; niet van een feature flag), dat de echte FEATURE_FLAGS.texts naar bestaande nl wijzen, dat
 * night-guard elke tussenliggende commit op een beschermd pad ziet (ook A → B → A), `prepare ui --open`
 * met `--only` als doorsnede, en het bundelen van pakketten. Git draait op een tijdelijke repo.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { FEATURE_FLAGS } from '@/utils/featureFlags';
import { NAMESPACES, type JsonObject } from '../../scripts/i18n-tools';
import {
  NIGHT_MIN_AGE_MS, bundlePackages, flagUnitKeys, guardCommits, nlHistory, settledUnits, type Git,
} from '../../scripts/translate/night';
import { buildUiPackages, selectUnits, type UiSources } from '../../scripts/translate/ui';
import { hashUnit } from '../../scripts/translate/common';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

// ── 1. Flag-teksten: exact, voorvoegsel, naam/uitleg, meervoud, fouten ──────────────────────
{
  const nl = {
    common: { settings: { f: 'Functie', fHint: 'Uitleg' }, dlg: { title: 'T', body: 'B' }, n: { a: 'A', b_one: '1', b_other: 'n' }, dlgx: 'los' },
    menu: { m: 'M' },
  };
  const r = flagUnitKeys([{ id: 'f', nameKey: 'settings.f', descriptionKey: 'settings.fHint', texts: ['common:dlg.*', 'common:n.b', 'menu:m'] }], nl);
  eq('flag: naam, uitleg, voorvoegsel, meervoudsfamilie en andere namespace', [...r.keys].sort(),
    ['common:dlg.body', 'common:dlg.title', 'common:n.b', 'common:settings.f', 'common:settings.fHint', 'menu:m']);
  ok('flag: voorvoegsel `dlg.*` pakt `dlgx` niet', !r.keys.has('common:dlgx'));
  eq('flag: alles gevonden', r.errors, []);
  const bad = flagUnitKeys([{ id: 'g', nameKey: 'settings.weg', texts: ['common:n.c', 'common:leeg.*', 'zonder-ns', 'xx:a'] }], nl);
  eq('flag: elk item zonder treffer of ongeldig is een fout', bad.errors.length, 5);
  ok('flag: fout noemt de flag', bad.errors.every(e => e.startsWith('flag g:')));
}

// ── 2. De echte FEATURE_FLAGS wijzen naar bestaande nl ───────────────────────────────────────
{
  const nl = Object.fromEntries(NAMESPACES.map(ns =>
    [ns, JSON.parse(readFileSync(join('src/i18n/locales/nl', `${ns}.json`), 'utf8')) as JsonObject]));
  const r = flagUnitKeys(FEATURE_FLAGS, nl);
  eq('FEATURE_FLAGS.texts: elk item staat in nl', r.errors, []);
  ok('FEATURE_FLAGS: elke flag heeft een veld texts', FEATURE_FLAGS.every(f => Array.isArray(f.texts)));
  ok('ifcForeignContent: melding uit #804 is uitgesloten', r.keys.has('common:notifications.ifcForeignTargetSave'));
  ok('ifcForeignContent: dialoog via voorvoegsel', r.keys.has('common:ifcExportWithoutModel.title'));
  ok('ifcForeignContent: naam uit nameKey', r.keys.has('common:settings.ifcForeignContent'));
}

// ── 3. settledUnits op momentopnames ─────────────────────────────────────────────────────────
{
  const snap = (common: JsonObject): Record<string, JsonObject> => ({ common });
  const base = snap({ a: 'A', b: 'B', c: 'C', p: { x_one: '1', x_other: 'n' }, f: 'F' });
  const r = settledUnits([
    base,
    snap({ a: 'A', b: 'B2', c: 'C', p: { x_one: '1', x_other: 'n2' }, f: 'F', nieuw: 'N' }),
    snap({ a: 'A', b: 'B', c: 'C', p: { x_one: '1', x_other: 'n2' }, f: 'F', nieuw: 'N' }),
  ], new Set(['common:f']));
  eq('settled: alleen ongewijzigd en niet van een flag', r.keys, ['common:a', 'common:c']);
  eq('settled: b (heen en terug), p (één meervoudsvorm) en nieuw tellen als in beweging', r.moving, 3);
  eq('settled: f is van een flag', r.flagged, 1);
  eq('settled: zonder momentopnames is niets af', settledUnits([], new Set()).keys, []);
}

// ── 4. Git: tijdgrens, alleen first-parent nl, night-guard ───────────────────────────────────
const repo = mkdtempSync(join(tmpdir(), 'ops-night-'));
const NOW = Date.UTC(2026, 10, 17, 0, 0, 0);
const HOUR = 60 * 60 * 1000;
const runGit = (args: string[], env: Record<string, string> = {}) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd: repo, encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const git: Git = args => runGit(args);
const write = (path: string, content: unknown) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), typeof content === 'string' ? content : JSON.stringify(content));
};
const commit = (msg: string, atMs: number) => {
  const date = new Date(atMs).toISOString();
  runGit(['add', '-A']);
  runGit(['commit', '-q', '--allow-empty', '-m', msg], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  return runGit(['rev-parse', 'HEAD']).trim();
};
const nlFile = 'src/i18n/locales/nl/common.json';
try {
  runGit(['init', '-q', '-b', 'main']);
  write(nlFile, { oud: 'Oud', grens: 'G1', jong: 'J1', terug: 'T' });
  write('src/i18n/locales/en/common.json', { oud: 'Old' });
  commit('begin', NOW - 100 * HOUR);
  write(nlFile, { oud: 'Oud', grens: 'G2', jong: 'J1', terug: 'T' });
  commit('grens precies 48 uur oud', NOW - NIGHT_MIN_AGE_MS);
  write(nlFile, { oud: 'Oud', grens: 'G2', jong: 'J2', terug: 'T' });
  commit('jong: 47 uur', NOW - 47 * HOUR);
  write(nlFile, { oud: 'Oud', grens: 'G2', jong: 'J2', terug: 'T2' });
  commit('terug heen', NOW - 30 * HOUR);
  write(nlFile, { oud: 'Oud', grens: 'G2', jong: 'J2', terug: 'T' });
  commit('terug terug', NOW - 20 * HOUR);
  write('src/i18n/locales/en/common.json', { oud: 'Older' });
  commit('alleen en', NOW - 10 * HOUR);

  const history = nlHistory(git, 'HEAD', NOW);
  eq('git: basis + de drie nl-commits in het venster + HEAD', history.length, 5);
  const r = settledUnits(history, new Set());
  eq('git: oud en precies 48 uur oud zijn af; jong en heen-en-terug niet; en telt niet', r.keys, ['common:oud', 'common:grens']);
  eq('git: repo jonger dan 48 uur → niets af', nlHistory(git, 'HEAD', NOW - 60 * HOUR).length, 0);

  // Een zijtak telt alleen via zijn merge (first-parent): de tussenstap op de zijtak is geen momentopname.
  runGit(['checkout', '-q', '-b', 'zij']);
  write(nlFile, { oud: 'Oud zij', grens: 'G2', jong: 'J2', terug: 'T' });
  commit('zijtak tussenstap', NOW - 9 * HOUR);
  write(nlFile, { oud: 'Oud', grens: 'G2', jong: 'J2', terug: 'T' });
  commit('zijtak terug', NOW - 8 * HOUR);
  runGit(['checkout', '-q', 'main']);
  const mergeAt = new Date(NOW - 7 * HOUR).toISOString();
  runGit(['merge', '-q', '--no-ff', '-m', 'merge zij', 'zij'], { GIT_AUTHOR_DATE: mergeAt, GIT_COMMITTER_DATE: mergeAt });
  eq('git: een zijtak zonder netto nl-wijziging laat oud af', settledUnits(nlHistory(git, 'HEAD', NOW), new Set()).keys,
    ['common:oud', 'common:grens']);

  // night-guard
  const BASE = runGit(['rev-parse', 'HEAD']).trim();
  eq('guard: niets veranderd', guardCommits(git, BASE, 'HEAD'), []);
  write('src/components/x.ts', 'export {};');
  commit('code buiten de paden', NOW - 6 * HOUR);
  eq('guard: code buiten de paden laat de nacht door', guardCommits(git, BASE, 'HEAD'), []);
  write(nlFile, { oud: 'Oud B', grens: 'G2', jong: 'J2', terug: 'T' });
  const heen = commit('nl A → B', NOW - 5 * HOUR);
  write(nlFile, { oud: 'Oud', grens: 'G2', jong: 'J2', terug: 'T' });
  const terug = commit('nl B → A', NOW - 4 * HOUR);
  eq('guard: A → B → A na BASE (eindstand gelijk) vervalt toch', guardCommits(git, BASE, 'HEAD').sort(), [heen, terug].sort());
  const BASE2 = runGit(['rev-parse', 'HEAD']).trim();
  write('scripts/i18n-tools.ts', 'export {};');
  const tools = commit('i18n-tools', NOW - 3 * HOUR);
  eq('guard: gedeelde i18n-hulpcode is beschermd', guardCommits(git, BASE2, 'HEAD'), [tools]);
} finally {
  rmSync(repo, { recursive: true, force: true });
}

// ── 5. prepare ui --open en --only ───────────────────────────────────────────────────────────
{
  const nl = { mis: 'Ontbreekt', oud: 'Verouderd nieuw', ok: 'Actueel' };
  const input = { ns: 'common', nl, en: { mis: 'Missing', oud: 'Stale new', ok: 'Current' }, target: { oud: 'Alt', ok: 'Aktuell' } };
  const sources: UiSources = { common: { oud: hashUnit('Verouderd oud'), ok: hashUnit('Actueel') } };
  eq('--open = ontbrekend zonder previous + verouderd met previous', selectUnits(input, 'de', 'open', sources).map(s => [s.unit.key, s.previous ?? null]),
    [['mis', null], ['oud', 'Alt']]);
  const build = (only: Map<string, Set<string>> | undefined, keys?: Map<string, Set<string>>) =>
    buildUiPackages({ lang: 'de', inputs: [input], mode: 'open', sources, concepts: [], ...(only ? { only } : {}), ...(keys ? { keys } : {}) })
      .flatMap(p => p.items.map(i => i.key));
  eq('--only: doorsnede, een actuele sleutel uit de lijst blijft weg', build(new Map([['common', new Set(['oud', 'ok'])]])), ['oud']);
  eq('--only: lege lijst → geen items', build(new Map()), []);
  eq('--keys (ter vergelijking) neemt de actuele sleutel wel', build(undefined, new Map([['common', new Set(['oud', 'ok'])]])), ['oud', 'ok']);
}

// ── 6. Bundelen ──────────────────────────────────────────────────────────────────────────────
{
  const p = (lang: string, id: string, chars: number) => ({ lang, id, chars });
  eq('bundel: per taal, tot het maximum, een te groot pakket alleen', bundlePackages([
    p('de', 'a', 30), p('de', 'b', 30), p('de', 'c', 50), p('de', 'groot', 200), p('fr', 'a', 10),
  ], 100), [['de', ['a', 'b']], ['de', ['c']], ['de', ['groot']], ['fr', ['a']]]);
  eq('bundel: precies op het maximum past', bundlePackages([p('de', 'a', 60), p('de', 'b', 40)], 100), [['de', ['a', 'b']]]);
  eq('bundel: niets', bundlePackages([], 100), []);
}

if (diffs.length === 0) {
  console.log(`OK  translate-night: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-night: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
