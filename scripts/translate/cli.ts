// `npm run translate -- <commando>` — de vertaalstraat (ontwerp: docs/superpowers/specs/2026-10-09-vertaalstraat-design.md).
//
//   validate-termbase                  schema van i18n/termbase/*.json; ontbrekende termen = rapport
//   concepts-candidates [--size 300]   kandidaat-termen → build/translate/concepts/candidates-NN.json
//   concepts-merge                     candidates-NN.out.json → i18n/termbase/concepts.json
//   terms-lookup <taal> [--size 40] [--concepts <pad>]
//                                      TBX-kandidaten per concept → build/translate/<taal>/terms-NN.json
//   apply-terms <taal>                 groene terms-NN.out.json → i18n/termbase/<taal>.json (+ rapporten)
//   prepare ui <taal> [--missing|--stale|--all] [--size 150]
//                                      UI-pakketten → build/translate/<taal>/ui-<ns>-NN.json (+ check.mjs)
//   bundle-check                       alleen build/translate/check.mjs bouwen
//   apply ui <taal>                    groene UI-pakketten → src/i18n/locales/<taal>/ + i18n/ui-sources/<taal>.json
//   seed-sources [taal…]               basislijn: huidige nl-hashes voor en + de bestaande talen (niet de nieuwe)
//   status [taal]                      per taal en namespace: ontbreekt / verouderd / actueel
//
// Alle I/O staat hier; de logica zit in de pure modules ernaast (getoetst in tests/planning/check-translate-*.ts).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { LOCALES, NAMESPACES, type JsonObject } from '../i18n-tools';
import { EXISTING_TARGETS, TBX_FILES, hasUiBaseline, toJson, type Concept, type LangTermbase } from './common';
import { chunk, collectCandidates } from './candidates';
import { applyUiBatch } from './apply';
import { checkPackage } from './gates';
import {
  applyTerms, conceptsErrors, inconsistencyReport, mergeConcepts, validateLangTermbase, type TermsOut,
} from './termbase';
import { buildTermsPackages, indexTbx, parseTbx, uiExamplesFor, type TermsCheckPackage, type TermsPackage } from './tbx';
import {
  buildUiPackages, orderSources, packageText, seedSources, uiStatus,
  type NsInput, type Selection, type UiPackage, type UiSources,
} from './ui';

const ROOT = process.cwd();
const LOCALES_DIR = join(ROOT, 'src/i18n/locales');
const TERMBASE_DIR = join(ROOT, 'i18n/termbase');
const SOURCES_DIR = join(ROOT, 'i18n/ui-sources');
const WORK = join(ROOT, 'build/translate');
const CONCEPTS = join(TERMBASE_DIR, 'concepts.json');

function fail(msg: string): never {
  console.log(`XX  translate: ${msg}`);
  process.exit(1);
}

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const readJsonOr = <T>(p: string, fallback: T): T => existsSync(p) ? readJson<T>(p) : fallback;
function writeJson(p: string, v: unknown): void {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, toJson(v));
}
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Zet oude bestanden met dit voorvoegsel opzij in `archive/<tijd>/` (niets gaat verloren). */
function archive(dir: string, prefix: string): void {
  if (!existsSync(dir)) return;
  const old = readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.json'));
  if (old.length === 0) return;
  const to = join(dir, 'archive', stamp());
  mkdirSync(to, { recursive: true });
  for (const f of old) renameSync(join(dir, f), join(to, f));
  console.log(`..  ${old.length} oude ${prefix}*-bestand(en) verplaatst naar ${to.slice(ROOT.length + 1)}`);
}

const flag = (args: string[], name: string) => args.includes(name);
function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const positional = (args: string[]) => args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(size|concepts)$/.test(args[i - 1])));

function loadConcepts(path = CONCEPTS): Concept[] {
  if (!existsSync(path)) {
    console.log(`..  ${path.slice(ROOT.length + 1)} bestaat nog niet: geen concepten`);
    return [];
  }
  const list = readJson<unknown>(path);
  const errors = conceptsErrors(list);
  if (errors.length) fail(`${path}: ${errors.length} schemafout(en):\n    - ${errors.join('\n    - ')}`);
  return list as Concept[];
}

const termbasePath = (lang: string) => join(TERMBASE_DIR, `${lang}.json`);
const loadTermbase = (lang: string): LangTermbase | undefined =>
  existsSync(termbasePath(lang)) ? readJson<LangTermbase>(termbasePath(lang)) : undefined;

function readLocale(lang: string, ns: string): JsonObject {
  return readJsonOr<JsonObject>(join(LOCALES_DIR, lang, `${ns}.json`), {});
}
const nsInputs = (lang: string): NsInput[] =>
  NAMESPACES.map(ns => ({ ns, nl: readLocale('nl', ns), en: readLocale('en', ns), target: readLocale(lang, ns) }));
const sourcesPath = (lang: string) => join(SOURCES_DIR, `${lang}.json`);
const nlByNs = () => Object.fromEntries(NAMESPACES.map(ns => [ns, readLocale('nl', ns)]));

function checkLang(lang: string | undefined): string {
  if (!lang || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang)) fail(`geen geldige taalcode: "${lang ?? ''}"`);
  if (lang === 'nl') fail('nl is de bron, geen doeltaal');
  return lang;
}

// ── Commando's ───────────────────────────────────────────────────────────────────────────────

function validateTermbase(): void {
  const concepts = loadConcepts();
  let errors = 0;
  const files = existsSync(TERMBASE_DIR) ? readdirSync(TERMBASE_DIR).filter(f => f.endsWith('.json') && f !== 'concepts.json') : [];
  for (const f of files.sort()) {
    const lang = f.replace(/\.json$/, '');
    const r = validateLangTermbase(lang, readJson<unknown>(join(TERMBASE_DIR, f)), concepts);
    for (const e of r.errors) console.log(`XX  ${e}`);
    errors += r.errors.length;
    const terms = concepts.filter(c => c.kind === 'term').length;
    console.log(`${r.errors.length ? 'XX' : 'OK'}  ${lang}: ${terms - r.missing.length}/${terms} termen`
      + (r.missing.length ? ` — ontbreekt (rapport): ${r.missing.slice(0, 10).join(', ')}${r.missing.length > 10 ? ', …' : ''}` : ''));
  }
  console.log(`${errors ? 'XX' : 'OK'}  validate-termbase: ${concepts.length} concepten, ${files.length} taalbestand(en), ${errors} fout(en)`);
  if (errors) process.exit(1);
}

function conceptsCandidates(args: string[]): void {
  const size = Number(option(args, '--size') ?? 300);
  const ui = NAMESPACES.map(ns => ({ ns, nl: readLocale('nl', ns), en: readLocale('en', ns) }));
  const docsDir = join(ROOT, 'public/docs/en');
  const docs = readdirSync(docsDir).filter(f => f.endsWith('.md')).sort()
    .map(f => ({ id: f.replace(/\.md$/, ''), md: readFileSync(join(docsDir, f), 'utf8') }));
  const all = collectCandidates({ ui, docs });
  const dir = join(WORK, 'concepts');
  archive(dir, 'candidates-');
  const packs = chunk(all, size);
  packs.forEach((candidates, i) => {
    const id = `candidates-${String(i + 1).padStart(2, '0')}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.json`), packageText({ kind: 'concepts', id, candidates }));
  });
  bundleCheck();
  console.log(`OK  concepts-candidates: ${all.length} kandidaten in ${packs.length} pakket(ten) in build/translate/concepts/`);
}

function conceptsMerge(): void {
  const dir = join(WORK, 'concepts');
  const outs = existsSync(dir) ? readdirSync(dir).filter(f => /^candidates-\d+\.out\.json$/.test(f)).sort() : [];
  if (outs.length === 0) fail('geen candidates-NN.out.json in build/translate/concepts/');
  const incoming: { file: string; concepts: Concept[] }[] = [];
  for (const f of outs) {
    const pkgFile = join(dir, f.replace('.out.json', '.json'));
    const out = readJson<unknown>(join(dir, f));
    const r = checkPackage(existsSync(pkgFile) ? readJson<unknown>(pkgFile) : { kind: 'concepts' }, out);
    if (r.errors.length) {
      console.log(`XX  ${f}: ${r.errors.length} schemafout(en), overgeslagen`);
      for (const e of r.errors.slice(0, 10)) console.log(`      ${e}`);
      continue;
    }
    incoming.push({ file: f, concepts: out as Concept[] });
  }
  const existing = loadConcepts();
  const res = mergeConcepts(existing, incoming);
  for (const c of res.conflicts) console.log(`!!  conflict ${c}`);
  const errors = conceptsErrors(res.concepts);
  if (errors.length) fail(`samengevoegde lijst ongeldig:\n    - ${errors.join('\n    - ')}`);
  writeJson(CONCEPTS, res.concepts);
  console.log(`OK  concepts-merge: ${res.added} nieuw, ${res.concepts.length} totaal, ${res.conflicts.length} conflict(en)`);
}

function termsLookup(args: string[]): void {
  const lang = checkLang(positional(args)[0]);
  const size = Number(option(args, '--size') ?? 40);
  const concepts = loadConcepts(option(args, '--concepts') ? resolve(ROOT, option(args, '--concepts')!) : CONCEPTS);
  const file = TBX_FILES[lang];
  if (!file) fail(`geen TBX-bestand bekend voor "${lang}" (zie TBX_FILES in scripts/translate/common.ts)`);
  const tbxDir = process.env.OPS_MSTERMS_DIR ?? join(ROOT, 'build/cache/msterms');
  const tbxPath = join(tbxDir, file);
  if (!existsSync(tbxPath)) fail(`${tbxPath} ontbreekt — pak de Microsoft Terminology Collection uit in ${tbxDir} of zet OPS_MSTERMS_DIR`);
  const idx = indexTbx(parseTbx(readFileSync(tbxPath, 'utf8')));
  const existingUi = (EXISTING_TARGETS as readonly string[]).includes(lang);
  const ui = existingUi ? NAMESPACES.map(ns => ({ ns, nl: readLocale('nl', ns), en: readLocale('en', ns), target: readLocale(lang, ns) })) : null;
  const packs = buildTermsPackages({
    lang, concepts, idx, termbase: loadTermbase(lang), size,
    ...(ui ? { ui: (c: Concept) => uiExamplesFor(c, ui) } : {}),
  });
  const dir = join(WORK, lang);
  archive(dir, 'terms-');
  mkdirSync(dir, { recursive: true });
  for (const p of packs) writeFileSync(join(dir, `${p.id}.json`), packageText(p));
  bundleCheck();
  const withCand = packs.flatMap(p => p.concepts).filter(c => c.candidates.length > 0).length;
  const total = packs.flatMap(p => p.concepts).length;
  console.log(`OK  terms-lookup ${lang}: ${total} concept(en) in ${packs.length} pakket(ten), ${withCand} met TBX-kandidaten (${file})`);
}

function applyTermsCmd(args: string[]): void {
  const lang = checkLang(positional(args)[0]);
  const dir = join(WORK, lang);
  const concepts = loadConcepts();
  const outs: TermsOut[] = [];
  const files = existsSync(dir) ? readdirSync(dir).filter(f => /^terms-\d+\.json$/.test(f)).sort() : [];
  for (const f of files) {
    const outFile = join(dir, f.replace('.json', '.out.json'));
    if (!existsSync(outFile)) { console.log(`..  ${f}: nog geen uitvoer`); continue; }
    const pkg = readJson<TermsPackage>(join(dir, f));
    const out = readJson<unknown>(outFile);
    const r = checkPackage(pkg, out);
    if (r.errors.length) { console.log(`XX  ${f}: rood (${r.errors.length} fout(en)), overgeslagen`); continue; }
    outs.push(out as TermsOut);
  }
  if (outs.length === 0) fail(`geen groene terms-NN.out.json in build/translate/${lang}/`);
  const tb = applyTerms(loadTermbase(lang) ?? {}, outs, concepts);
  writeJson(termbasePath(lang), tb);
  const n = outs.reduce((s, o) => s + Object.keys(o).filter(k => k !== '_style').length, 0);
  console.log(`OK  apply-terms ${lang}: ${n} termregel(s) in i18n/termbase/${lang}.json`);
  if ((EXISTING_TARGETS as readonly string[]).includes(lang)) {
    writeFileSync(join(dir, 'inconsistencies.md'), inconsistencyReport(lang, outs, concepts));
    console.log(`OK  rapport: build/translate/${lang}/inconsistencies.md`);
  }
  // Termen zonder bron (`model`) en zelf gekozen TBX-termen (`tbx-chosen`) krijgen een blinde controle:
  // alleen de doelterm, ondoorzichtige id's. Bestaat de uitkomst al, dan wordt het rapport gemaakt.
  const checkOut = join(dir, 'terms-check-01.out.json');
  const mapFile = join(dir, 'terms-check-01.map.json');
  if (existsSync(checkOut) && existsSync(mapFile)) {
    const res = readJson<Record<string, { backTranslation: string; standard: boolean; suggestion?: string }>>(checkOut);
    const map = readJson<Record<string, string>>(mapFile);
    const byId = new Map(concepts.map(c => [c.id, c]));
    const bad = Object.entries(res).filter(([, v]) => !v.standard);
    const lines = [`# Blinde controle — ${lang}`, '', `${bad.length} van ${Object.keys(res).length} termen niet gangbaar; Opus beslist.`, '',
      ...bad.map(([k, v]) => {
        const c = byId.get(map[k] ?? '');
        return `- ${map[k] ?? k} (en *${c?.en.join(' / ') ?? '?'}*): *${(tb[map[k]] as { term?: string } | undefined)?.term ?? '?'}* → terug *${v.backTranslation}*${v.suggestion ? `, voorstel *${v.suggestion}*` : ''}`;
      }), ''];
    writeFileSync(join(dir, 'terms-check-report.md'), lines.join('\n'));
    console.log(`OK  rapport: build/translate/${lang}/terms-check-report.md (${bad.length} afwijkend)`);
    return;
  }
  const unchecked = outs.flatMap(o => Object.entries(o).filter(([k, v]) => k !== '_style'
    && ['model', 'tbx-chosen'].includes((v as { status?: string }).status ?? '')))
    .map(([id, v]) => ({ id, term: (v as { term: string }).term }));
  if (unchecked.length) {
    archive(dir, 'terms-check-');
    const map: Record<string, string> = {};
    const pkg: TermsCheckPackage = {
      kind: 'terms-check', lang, id: 'terms-check-01',
      items: unchecked.map((m, i) => { const id = `t${i + 1}`; map[id] = m.id; return { id, term: m.term }; }),
    };
    writeJson(join(dir, 'terms-check-01.json'), pkg);
    writeJson(join(dir, 'terms-check-01.map.json'), map);
    console.log(`OK  blinde controle nodig voor ${unchecked.length} term(en): build/translate/${lang}/terms-check-01.json`);
  }
}

function bundleCheck(): void {
  const out = join(WORK, 'check.mjs');
  mkdirSync(WORK, { recursive: true });
  const r = spawnSync(join(ROOT, 'node_modules/.bin/esbuild'), [
    join(ROOT, 'scripts/translate/check.ts'), '--bundle', '--platform=node', '--format=esm', '--target=node22',
    '--log-level=error', `--outfile=${out}`,
  ], { stdio: 'inherit' });
  if (r.status !== 0) fail('bundelen van check.ts mislukt');
  console.log('OK  build/translate/check.mjs gebouwd (zelfstandig, zonder node_modules)');
}

function prepare(args: string[]): void {
  const [what, langArg] = positional(args);
  if (what !== 'ui') fail(`prepare ${what ?? ''}: alleen "ui" bestaat (docs volgt in PR 4)`);
  const lang = checkLang(langArg);
  const modes = (['--missing', '--stale', '--all'] as const).filter(f => flag(args, f));
  if (modes.length > 1) fail('kies één van --missing, --stale, --all');
  const mode = (modes[0]?.slice(2) ?? 'missing') as Selection;
  const sources = readJsonOr<UiSources>(sourcesPath(lang), {});
  const packs = buildUiPackages({
    lang, inputs: nsInputs(lang), mode, sources, concepts: loadConcepts(), termbase: loadTermbase(lang),
    size: Number(option(args, '--size') ?? 150),
  });
  const dir = join(WORK, lang);
  archive(dir, 'ui-');
  mkdirSync(dir, { recursive: true });
  for (const p of packs) writeFileSync(join(dir, `${p.id}.json`), packageText(p));
  bundleCheck();
  const items = packs.reduce((s, p) => s + p.items.length, 0);
  const sizes = packs.map(p => packageText(p).length);
  console.log(`OK  prepare ui ${lang} --${mode}: ${items} item(s) in ${packs.length} pakket(ten)`
    + (packs.length ? `, grootste ${Math.max(...sizes)} tekens` : ''));
}

function applyUi(args: string[]): void {
  const [what, langArg] = positional(args);
  if (what !== 'ui') fail(`apply ${what ?? ''}: alleen "ui" bestaat (docs volgt in PR 4)`);
  const lang = checkLang(langArg);
  const dir = join(WORK, lang);
  const files = existsSync(dir) ? readdirSync(dir).filter(f => /^ui-[a-z]+-\d+\.json$/.test(f)).sort() : [];
  const sources = readJsonOr<UiSources>(sourcesPath(lang), {});
  const nl = nlByNs();
  const batch: { pkg: UiPackage; out: unknown }[] = [];
  const fileOf = new Map<string, string>();
  for (const f of files) {
    const outFile = join(dir, f.replace('.json', '.out.json'));
    if (!existsSync(outFile)) { console.log(`..  ${f}: nog geen uitvoer`); continue; }
    const pkg = readJson<UiPackage>(join(dir, f));
    fileOf.set(pkg.id, f);
    batch.push({ pkg, out: readJson<unknown>(outFile) });
  }
  const { targets, applied: ids, red: redList } = applyUiBatch(batch, ns => readLocale(lang, ns), nl, sources);
  for (const r of redList) for (const line of r.lines) console.log(`    ${line}`);
  const applied = ids.map(id => fileOf.get(id)!);
  const red = redList.length;
  for (const [ns, obj] of targets) writeJson(join(LOCALES_DIR, lang, `${ns}.json`), obj);
  if (applied.length) {
    writeJson(sourcesPath(lang), orderSources(sources, nl));
    const to = join(dir, 'applied', stamp());
    mkdirSync(to, { recursive: true });
    for (const f of applied) {
      renameSync(join(dir, f), join(to, f));
      renameSync(join(dir, f.replace('.json', '.out.json')), join(to, f.replace('.json', '.out.json')));
    }
  }
  console.log(`${red ? 'XX' : 'OK'}  apply ui ${lang}: ${applied.length} pakket(ten) samengevoegd, ${red} rood overgeslagen`);
  if (red) process.exit(1);
}

function seed(args: string[]): void {
  // Alleen talen met een basislijn: in een nieuwe taal staat Engels als vulling, en een hash zou die
  // als "actueel" markeren (zie hasUiBaseline).
  const langs = positional(args).length ? positional(args).map(checkLang) : LOCALES.filter(l => hasUiBaseline(l));
  const without = langs.filter(l => !hasUiBaseline(l));
  if (without.length) fail(`seed-sources: ${without.join(', ')} heeft geen basislijn (Engelse vulling); vul via prepare/apply ui`);
  const nl = nlByNs();
  for (const lang of langs) {
    if (!existsSync(join(LOCALES_DIR, lang))) { console.log(`..  ${lang}: geen locale-map, overgeslagen`); continue; }
    const s = orderSources(seedSources(lang, nsInputs(lang)), nl);
    writeJson(sourcesPath(lang), s);
    const n = Object.values(s).reduce((t, h) => t + Object.keys(h).length, 0);
    console.log(`OK  seed-sources ${lang}: ${n} sleutel(s)`);
  }
}

function status(args: string[]): void {
  const asked = positional(args)[0];
  const langs = asked ? [checkLang(asked)]
    : readdirSync(LOCALES_DIR).filter(d => d !== 'nl' && statSync(join(LOCALES_DIR, d)).isDirectory()).sort();
  console.log('taal  namespace  ontbreekt  verouderd  actueel  (zonder hash)');
  let todo = 0;
  for (const lang of langs) {
    const rows = uiStatus(lang, nsInputs(lang), readJsonOr<UiSources>(sourcesPath(lang), {}));
    for (const r of rows) {
      todo += r.missing + r.stale;
      console.log(`${lang.padEnd(5)} ${r.ns.padEnd(10)} ${String(r.missing).padStart(9)}  ${String(r.stale).padStart(9)}  ${String(r.current).padStart(7)}  ${r.unhashed ? `(${r.unhashed})` : ''}`);
    }
  }
  console.log(todo ? `..  ${todo} eenheid/eenheden te vertalen` : 'OK  alles actueel');
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'validate-termbase': validateTermbase(); break;
  case 'concepts-candidates': conceptsCandidates(rest); break;
  case 'concepts-merge': conceptsMerge(); break;
  case 'terms-lookup': termsLookup(rest); break;
  case 'apply-terms': applyTermsCmd(rest); break;
  case 'prepare': prepare(rest); break;
  case 'bundle-check': bundleCheck(); break;
  case 'apply': applyUi(rest); break;
  case 'seed-sources': seed(rest); break;
  case 'status': status(rest); break;
  default:
    console.log('gebruik: npm run translate -- <validate-termbase | concepts-candidates | concepts-merge | terms-lookup <taal> | '
      + 'apply-terms <taal> | prepare ui <taal> [--missing|--stale|--all] | bundle-check | apply ui <taal> | seed-sources [taal…] | status [taal]>');
    process.exit(cmd ? 1 : 0);
}
