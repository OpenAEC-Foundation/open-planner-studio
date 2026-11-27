import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { LOCALES, NAMESPACES, type JsonObject } from '../i18n-tools';
import { EXISTING_TARGETS, TBX_FILES, escapeRe, toJson, type Concept, type LangTermbase } from './common';
import { chunk, collectCandidates } from './candidates';
import { applyUiBatch, packageMismatch } from './apply';
import { applyFindings } from './findings';
import { checkDocs, checkDocsArticle, checkPackage, formatResult } from './gates';
import {
  articleState, buildDocsPackages, buildEnLabelIndex, docsReleaseGaps, docsStatus, mergeArticle, orderDocsSources,
  ifcNames, literalCandidates, literalNames, normLabel, parseDocsIndex, tutorialNames, renameDocLinks, renameInEntry, sectionLabels, serializeDocsIndex, titleOf, DOCS_MAX_WORDS,
  type ArticleState, type DocsArticleInput, type DocsLiteral, type DocsMode, type DocsPackage, type DocsSources,
} from './docs';
import {
  applyTerms, conceptsErrors, inconsistencyReport, mergeConcepts, validateLangTermbase, type TermsOut,
} from './termbase';
import { FEATURE_FLAGS } from '../../src/utils/featureFlags';
import { bundlePackages, flagUnitKeys, guardCommits, nlHistory, settledUnits, type Git } from './night';
import { buildTermsPackages, indexTbx, parseTbx, uiExamplesFor, type TermsCheckPackage, type TermsPackage } from './tbx';
import {
  avoidRules, buildUiPackages, orderSources, packageText, resolveKeyList, uiReleaseGaps, uiStatus,
  type NsInput, type ReleaseGap, type Selection, type UiPackage, type UiSources,
} from './ui';

const ROOT = process.cwd();
const LOCALES_DIR = join(ROOT, 'src/i18n/locales');
const TERMBASE_DIR = join(ROOT, 'i18n/termbase');
const SOURCES_DIR = join(ROOT, 'i18n/ui-sources');
const WORK = join(ROOT, 'build/translate');
const SEAL_DIR = join(ROOT, 'build/translate-seal');
const sealPath = (lang: string) => join(SEAL_DIR, `${lang}.json`);
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

function seal(lang: string, files: string[]): void {
  const seals = readSeals(lang);
  for (const f of files) seals[f] = sha(readFileSync(join(WORK, lang, f), 'utf8'));
  mkdirSync(SEAL_DIR, { recursive: true });
  writeFileSync(sealPath(lang), toJson(seals));
}

function sealErrors(lang: string, files: string[]): string[] {
  const seals = readSeals(lang);
  return files.flatMap(f => {
    const want = seals[f];
    if (want === undefined) return [`${f}: geen zegel van prepare; maak het pakket opnieuw`];
    return sha(readFileSync(join(WORK, lang, f), 'utf8')) === want ? [] : [`${f}: veranderd na prepare; maak het pakket opnieuw`];
  });
}

function readSeals(lang: string): Record<string, string> {
  try {
    return readJsonOr<Record<string, string>>(sealPath(lang), {});
  } catch {
    console.log(`!!  ${sealPath(lang).slice(ROOT.length + 1)} is niet te lezen; alle pakketten van ${lang} gelden als "geen zegel"`);
    return {};
  }
}
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

function archive(dir: string, prefix: string): void {
  if (!existsSync(dir)) return;
  const old = readdirSync(dir).filter(f => (f.startsWith(prefix) || f.startsWith(`review-${prefix}`)) && f.endsWith('.json'));
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
const positional = (args: string[]) => args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(size|concepts|keys|only|bundle|out|ids|max-words)$/.test(args[i - 1])));

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

function validateTermbase(): void {
  const concepts = loadConcepts();
  let errors = 0;
  const files = existsSync(TERMBASE_DIR) ? readdirSync(TERMBASE_DIR).filter(f => f.endsWith('.json') && f !== 'concepts.json') : [];
  const langs = [...new Set([...LOCALES.filter(l => l !== 'nl' && l !== 'en'), ...files.map(f => f.replace(/\.json$/, ''))])].sort();
  for (const lang of langs) {
    const r = validateLangTermbase(lang, loadTermbase(lang), concepts);
    for (const e of r.errors) console.log(`XX  ${e}`);
    errors += r.errors.length;
    const terms = concepts.filter(c => c.kind === 'term').length;
    console.log(`${r.errors.length ? 'XX' : 'OK'}  ${lang}: ${terms - r.missing.length}/${terms} termen`
      + (r.missing.length ? ` — ontbreekt: ${r.missing.slice(0, 10).join(', ')}${r.missing.length > 10 ? ', …' : ''}` : ''));
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
  seal(lang, packs.map(p => `${p.id}.json`));
  bundleCheck();
  const withCand = packs.flatMap(p => p.concepts).filter(c => c.candidates.length > 0).length;
  const total = packs.flatMap(p => p.concepts).length;
  console.log(`OK  terms-lookup ${lang}: ${total} concept(en) in ${packs.length} pakket(ten), ${withCand} met TBX-kandidaten (${file})`);
}

function applyTermsCmd(args: string[]): void {
  const lang = checkLang(positional(args)[0]);
  const dir = join(WORK, lang);
  const concepts = loadConcepts();
  const checkOut = join(dir, 'terms-check-01.out.json');
  const mapFile = join(dir, 'terms-check-01.map.json');
  if (existsSync(checkOut)) {
    const checkSources = ['terms-check-01.json', 'terms-check-01.map.json'];
    if (checkSources.some(f => !existsSync(join(dir, f)))) fail('bronpakket of koppeltabel van de blinde controle ontbreekt');
    const tampered = sealErrors(lang, checkSources);
    if (tampered.length) fail(tampered.join('\n'));
  }
  const outs: TermsOut[] = [];
  let refused = 0;
  const files = existsSync(dir) ? readdirSync(dir).filter(f => /^terms-\d+\.json$/.test(f)).sort() : [];
  for (const f of files) {
    const outFile = join(dir, f.replace('.json', '.out.json'));
    if (!existsSync(outFile)) { console.log(`..  ${f}: nog geen uitvoer`); continue; }
    const tampered = sealErrors(lang, [f]);
    if (tampered.length) { console.log(`XX  ${f}: ${tampered.join('; ')}, overgeslagen`); refused++; continue; }
    const pkg = readJson<TermsPackage>(join(dir, f));
    const out = readJson<unknown>(outFile);
    const r = checkPackage(pkg, out);
    if (r.errors.length) { console.log(`XX  ${f}: rood (${r.errors.length} fout(en)), overgeslagen`); refused++; continue; }
    outs.push(out as TermsOut);
  }
  if (outs.length === 0) fail(`geen groene terms-NN.out.json in build/translate/${lang}/`);
  if (refused) process.exitCode = 1;
  const tb = applyTerms(loadTermbase(lang) ?? {}, outs, concepts);
  writeJson(termbasePath(lang), tb);
  const n = outs.reduce((s, o) => s + Object.keys(o).filter(k => k !== '_style').length, 0);
  console.log(`${refused ? 'XX' : 'OK'}  apply-terms ${lang}: ${n} termregel(s) in i18n/termbase/${lang}.json, ${refused} rood overgeslagen`);
  if ((EXISTING_TARGETS as readonly string[]).includes(lang)) {
    writeFileSync(join(dir, 'inconsistencies.md'), inconsistencyReport(lang, outs, concepts));
    console.log(`OK  rapport: build/translate/${lang}/inconsistencies.md`);
  }
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
    seal(lang, ['terms-check-01.json', 'terms-check-01.map.json']);
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
  if (what === 'docs') { prepareDocs(args, checkLang(langArg)); return; }
  if (what !== 'ui') fail(`prepare ${what ?? ''}: kies "ui" of "docs"`);
  const lang = checkLang(langArg);
  const modes = (['--missing', '--stale', '--open', '--all'] as const).filter(f => flag(args, f));
  if (modes.length > 1) fail('kies één van --missing, --stale, --open, --all');
  const mode = (modes[0]?.slice(2) ?? 'missing') as Selection;
  const avoid = flag(args, '--avoid');
  const keysFile = option(args, '--keys');
  if (flag(args, '--keys') && (!keysFile || keysFile.startsWith('--'))) fail('--keys: geef een bestand');
  if (avoid && (mode === 'all' || flag(args, '--missing'))) fail('--avoid gaat alleen samen met --stale');
  if (avoid && mode === 'open') fail('--avoid gaat alleen samen met --stale');
  if (keysFile && (avoid || modes.length)) fail('--keys gaat niet samen met --missing, --stale, --open, --all of --avoid');
  const onlyFile = option(args, '--only');
  if (flag(args, '--only') && (!onlyFile || onlyFile.startsWith('--'))) fail('--only: geef een bestand');
  if (onlyFile && (avoid || keysFile)) fail('--only gaat niet samen met --keys of --avoid');
  const keyList = (opt: string, file: string) => {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) fail(`${opt}: ${file} bestaat niet`);
    const r = resolveKeyList(readJson<unknown>(path), nlByNs());
    if (r.errors.length) fail(`${r.errors.length} fout(en) in ${file}:\n    - ${r.errors.join('\n    - ')}`);
    return r.keys;
  };
  const keys = keysFile ? keyList('--keys', keysFile) : undefined;
  const only = onlyFile ? keyList('--only', onlyFile) : undefined;
  const termbase = loadTermbase(lang);
  if (avoid && !termbase) fail(`--avoid: i18n/termbase/${lang}.json bestaat niet`);
  const sources = readJsonOr<UiSources>(sourcesPath(lang), {});
  const packs = buildUiPackages({
    lang, inputs: nsInputs(lang), mode, sources, concepts: loadConcepts(), termbase,
    size: Number(option(args, '--size') ?? 150), avoid, ...(keys ? { keys } : {}), ...(only ? { only } : {}),
  });
  const dir = join(WORK, lang);
  archive(dir, 'ui-');
  mkdirSync(dir, { recursive: true });
  for (const p of packs) writeFileSync(join(dir, `${p.id}.json`), packageText(p));
  seal(lang, packs.map(p => `${p.id}.json`));
  bundleCheck();
  const items = packs.reduce((s, p) => s + p.items.length, 0);
  const sizes = packs.map(p => packageText(p).length);
  const label = (keys ? `--keys ${keysFile}` : avoid ? `--avoid${mode === 'stale' ? ' --stale' : ''}` : `--${mode}`)
    + (onlyFile ? ` --only ${onlyFile}` : '');
  console.log(`OK  prepare ui ${lang} ${label}: ${items} item(s) in ${packs.length} pakket(ten)`
    + (packs.length ? `, grootste ${Math.max(...sizes)} tekens` : ''));
}

function tryReadPackage(pkgFile: string, outFile: string): { pkg: { id: string }; out: unknown } | { error: string } {
  const parse = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8')) as unknown;
  try {
    const pkg = parse(pkgFile);
    if (typeof pkg !== 'object' || pkg === null || typeof (pkg as { id?: unknown }).id !== 'string') {
      return { error: 'pakket zonder id' };
    }
    return { pkg: pkg as { id: string }, out: parse(outFile) };
  } catch (err) {
    return { error: `niet te lezen (${err instanceof Error ? err.message : String(err)})` };
  }
}

function applyUi(args: string[]): void {
  const [what, langArg] = positional(args);
  if (what === 'docs') { applyDocs(checkLang(langArg)); return; }
  if (what !== 'ui') fail(`apply ${what ?? ''}: kies "ui" of "docs"`);
  const lang = checkLang(langArg);
  const dir = join(WORK, lang);
  const files = existsSync(dir) ? readdirSync(dir).filter(f => /^ui-[a-z]+-\d+\.json$/.test(f)).sort() : [];
  const sources = readJsonOr<UiSources>(sourcesPath(lang), {});
  const nl = nlByNs();
  const batch: { pkg: UiPackage; out: unknown }[] = [];
  const fileOf = new Map<string, string>();
  let refused = 0;
  for (const f of files) {
    const outFile = join(dir, f.replace('.json', '.out.json'));
    if (!existsSync(outFile)) { console.log(`..  ${f}: nog geen uitvoer`); continue; }
    const read = tryReadPackage(join(dir, f), outFile);
    if ('error' in read) { console.log(`XX  ${f}: ${read.error}`); refused++; continue; }
    const tampered = sealErrors(lang, [f]);
    if (tampered.length) { for (const line of tampered) console.log(`XX  ${line}`); refused++; continue; }
    fileOf.set(read.pkg.id, f);
    batch.push({ pkg: read.pkg as UiPackage, out: read.out });
  }
  const { targets, applied: ids, red: redList } = applyUiBatch(batch, ns => readLocale(lang, ns), nl, sources, lang);
  for (const r of redList) {
    console.log(`XX  ${fileOf.get(r.id) ?? r.id}:`);
    for (const line of r.lines) console.log(`    ${line}`);
  }
  const applied = ids.map(id => fileOf.get(id)!);
  const red = redList.length + refused;
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

function packagesCmd(args: string[]): void {
  const [what, ...langArgs] = positional(args);
  if (what !== 'ui' && what !== 'docs') fail(`packages ${what ?? ''}: kies "ui" of "docs"`);
  if (!langArgs.length) fail('packages ui|docs <taal…>: geef minstens één taal');
  const onlyRed = flag(args, '--red');
  const bundle = option(args, '--bundle');
  if (flag(args, '--bundle') && (what !== 'ui' || onlyRed || !/^[1-9]\d*$/.test(bundle ?? ''))) {
    fail('--bundle <tekens>: alleen voor packages ui, zonder --red, met een positief getal');
  }
  const items: [string, string][] = [];
  for (const lang of langArgs.map(checkLang)) {
    const dir = join(WORK, lang);
    if (!existsSync(dir)) continue;
    const bases = what === 'ui'
      ? readdirSync(dir).filter(f => /^ui-[a-z]+-\d+\.json$/.test(f)).sort().map(f => f.slice(0, -'.json'.length))
      : docsPackageBases(dir);
    for (const base of bases) {
      if (onlyRed) {
        const out = join(dir, what === 'ui' ? `${base}.out.json` : `${base}.out.md`);
        if (!existsSync(out)) continue;
        let green = false;
        try {
          const pkg = JSON.parse(readFileSync(join(dir, `${base}.json`), 'utf8')) as unknown;
          const result = what === 'ui'
            ? checkPackage(pkg, JSON.parse(readFileSync(out, 'utf8')) as unknown)
            : checkDocs(pkg as DocsPackage, readFileSync(join(dir, `${base}.src.md`), 'utf8'), readFileSync(out, 'utf8'));
          const ui = pkg as UiPackage;
          const stale = what === 'ui' ? packageMismatch(ui, nlByNs()[ui.namespace] ?? {}, lang) : [];
          const files = what === 'ui' ? [`${base}.json`] : [`${base}.json`, `${base}.src.md`];
          green = result.errors.length === 0 && stale.length === 0 && sealErrors(lang, files).length === 0;
        } catch { }
        if (green) continue;
      }
      items.push([lang, base]);
    }
  }
  if (bundle) {
    const chars = ([lang, base]: [string, string]) => statSync(join(WORK, lang, `${base}.json`)).size;
    console.log(JSON.stringify(bundlePackages(items.map(it => ({ lang: it[0], id: it[1], chars: chars(it) })), Number(bundle))));
    return;
  }
  console.log(JSON.stringify(items));
}

const git: Git = args => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.trim()}`);
  return r.stdout;
};

function settledCmd(args: string[]): void {
  const out = option(args, '--out');
  if (!out || out.startsWith('--')) fail('settled --out <bestand>');
  const history = nlHistory(git, 'HEAD', Date.now());
  const current = history[history.length - 1] ?? {};
  const flags = flagUnitKeys(FEATURE_FLAGS, current);
  if (flags.errors.length) fail(`${flags.errors.length} fout(en) in FEATURE_FLAGS.texts:\n    - ${flags.errors.join('\n    - ')}`);
  const r = settledUnits(history, flags.keys);
  const path = resolve(ROOT, out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(r.keys, null, 2)}\n`);
  console.log(`OK  settled: ${r.keys.length} eenheid/eenheden af; ${r.moving} te nieuw of veranderd (48 uur), `
    + `${r.flagged} van een feature flag → ${out}`);
}

function nightGuardCmd(args: string[]): void {
  const [base] = positional(args);
  if (!base) fail('night-guard <BASE>');
  const hits = guardCommits(git, base, 'origin/main');
  if (hits.length) fail(`${hits.length} commit(s) op origin/main na ${base} raken de selectie-invoer; de nacht vervalt:\n    - ${hits.join('\n    - ')}`);
  console.log(`OK  night-guard: origin/main raakte na ${base} geen selectie-invoer`);
}

function applyFindingsCmd(args: string[]): void {
  const [langArg, file] = positional(args);
  const lang = checkLang(langArg);
  if (!file) fail('apply-findings <taal> <bestand>: geef een bestand');
  const path = resolve(ROOT, file);
  if (!existsSync(path)) fail(`${file} bestaat niet`);
  let findings: unknown;
  try { findings = readJson<unknown>(path); } catch (err) { fail(`${file}: ${err instanceof Error ? err.message : String(err)}`); }
  const res = applyFindings({
    lang, findings, nl: nlByNs(),
    en: Object.fromEntries(NAMESPACES.map(ns => [ns, readLocale('en', ns)])),
    readTarget: ns => readLocale(lang, ns), concepts: loadConcepts(), termbase: loadTermbase(lang),
    sources: readJsonOr<UiSources>(sourcesPath(lang), {}),
  });
  for (const sk of res.skipped) {
    console.log(`XX  ${sk.key}: overgeslagen`);
    for (const r of sk.reasons) console.log(`      ${r}`);
  }
  for (const w of res.warnings) console.log(`WW  ${w}`);
  for (const [ns, obj] of res.targets) writeJson(join(LOCALES_DIR, lang, `${ns}.json`), obj);
  console.log(`${res.skipped.length ? 'XX' : 'OK'}  apply-findings ${lang}: ${res.applied.length} toegepast, ${res.skipped.length} overgeslagen`);
  if (res.skipped.length) process.exit(1);
}

const DOCS_DIR = join(ROOT, 'public/docs');
const DOCS_SOURCES_DIR = join(ROOT, 'i18n/docs-sources');
const DOCS_LITERAL = join(ROOT, 'i18n/docs-literal.json');
const DOCS_NOT_A_LANG = new Set(['nl', 'en', 'img']);

interface ManifestArticle { id: string; draft?: boolean }
const manifestArticles = (): ManifestArticle[] => readJson<{ articles: ManifestArticle[] }>(join(DOCS_DIR, 'manifest.json')).articles;
const manifestOrder = (): string[] => manifestArticles().map(a => a.id);
const docsSourcesPath = (lang: string) => join(DOCS_SOURCES_DIR, `${lang}.json`);
const readDocsSources = (lang: string): DocsSources => readJsonOr<DocsSources>(docsSourcesPath(lang), {});
const docPath = (lang: string, id: string) => join(DOCS_DIR, lang, `${id}.md`);
const readDoc = (lang: string, id: string): string | undefined => existsSync(docPath(lang, id)) ? readFileSync(docPath(lang, id), 'utf8') : undefined;
const docsIndexPath = (lang: string) => join(DOCS_DIR, lang, 'index.json');
const readDocsIndex = (lang: string): Record<string, string> =>
  existsSync(docsIndexPath(lang)) ? parseDocsIndex(readFileSync(docsIndexPath(lang), 'utf8')) : {};

function loadLiteral(): DocsLiteral {
  if (!existsSync(DOCS_LITERAL)) fail('i18n/docs-literal.json ontbreekt');
  return readJson<DocsLiteral>(DOCS_LITERAL);
}

function docsLangs(): string[] {
  const dirs = readdirSync(DOCS_DIR).filter(d => !DOCS_NOT_A_LANG.has(d) && statSync(join(DOCS_DIR, d)).isDirectory());
  const c3 = existsSync(DOCS_SOURCES_DIR) ? readdirSync(DOCS_SOURCES_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')) : [];
  return [...new Set([...dirs, ...c3])].sort();
}

const docsInputs = (lang: string): DocsArticleInput[] => manifestArticles().filter(a => !a.draft).map(a => {
  const md = readDoc('en', a.id);
  if (md === undefined) fail(`public/docs/en/${a.id}.md ontbreekt`);
  const translated = readDoc(lang, a.id);
  return { id: a.id, md, ...(translated !== undefined ? { translated } : {}) };
});

const labelIndexFor = (lang: string) => buildEnLabelIndex(
  nsInputs(lang), lang, readJsonOr<UiSources>(sourcesPath(lang), {}), avoidRules(loadConcepts(), loadTermbase(lang)),
);

function docsStates(lang: string): ArticleState[] {
  const sources = readDocsSources(lang);
  const hashes = labelIndexFor(lang).hashes;
  return docsInputs(lang).map(a => articleState(a.id, a.md, a.translated, sources[a.id], hashes));
}

const docsPackageBases = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.src.md')).map(f => f.slice(0, -'.src.md'.length)).sort() : [];

function archiveDocs(dir: string, onlyIds?: string[]): void {
  const bases = docsPackageBases(dir).filter(b => !onlyIds || onlyIds.some(id => b === id || new RegExp(`^${escapeRe(id)}-\\d+$`).test(b)));
  if (bases.length === 0) return;
  const to = join(dir, 'archive', stamp());
  mkdirSync(to, { recursive: true });
  for (const b of bases) {
    for (const ext of ['.src.md', '.json', '.out.md']) if (existsSync(join(dir, b + ext))) renameSync(join(dir, b + ext), join(to, b + ext));
    const review = `review-${b}.json`;
    if (existsSync(join(dir, review))) renameSync(join(dir, review), join(to, review));
  }
  console.log(`..  ${bases.length} oud(e) docs-pakket(ten) verplaatst naar ${to.slice(ROOT.length + 1)}`);
}

function docsMode(args: string[]): { mode: DocsMode; ids?: string[] } {
  const modes = (['--missing', '--stale', '--ids'] as const).filter(f => flag(args, f));
  if (modes.length > 1) fail('kies één van --missing, --stale, --ids');
  if (modes[0] !== '--ids') return { mode: (modes[0]?.slice(2) ?? 'missing') as DocsMode };
  const list = option(args, '--ids');
  if (!list || list.startsWith('--')) fail('--ids: geef artikel-id\'s, bv. --ids howto-relaties-leggen,ref-instellingen');
  const ids = list.split(',').map(x => x.trim()).filter(Boolean);
  const known = new Set(manifestOrder());
  const unknown = ids.filter(id => !known.has(id));
  if (unknown.length) fail(`--ids: onbekend artikel ${unknown.join(', ')}`);
  return { mode: 'ids', ids };
}

function maxWords(args: string[]): number {
  const v = Number(option(args, '--max-words') ?? DOCS_MAX_WORDS);
  if (!Number.isFinite(v) || v < 100) fail('--max-words: geef een getal ≥ 100');
  return v;
}

function buildDocsFor(lang: string, mode: DocsMode, ids: string[] | undefined, words: number) {
  return buildDocsPackages({
    lang, articles: docsInputs(lang), mode, ...(ids ? { ids } : {}), sources: readDocsSources(lang),
    index: labelIndexFor(lang), literal: loadLiteral(), concepts: loadConcepts(), termbase: loadTermbase(lang), maxWords: words,
  });
}

const labelCounts = (p: DocsPackage) => (['a', 'b', 'c'] as const).map(k => `${k}${p.labels.filter(l => l.kind === k).length}`).join(' ');

const PITFALLS_DIR = join(ROOT, 'scripts/translate/prompts/pitfalls');

function pitfallsFor(lang: string): string {
  const parts = ['_all.md', `${lang}.md`].map(f => join(PITFALLS_DIR, f)).filter(f => existsSync(f)).map(f => readFileSync(f, 'utf8').trimEnd());
  return `${parts.join('\n\n')}\n`;
}

function prepareDocs(args: string[], lang: string): void {
  const { mode, ids } = docsMode(args);
  const packs = buildDocsFor(lang, mode, ids, maxWords(args));
  const dir = join(WORK, lang);
  archiveDocs(dir, mode === 'ids' ? ids : undefined);
  mkdirSync(dir, { recursive: true });
  for (const { pkg, src } of packs) {
    writeFileSync(join(dir, `${pkg.id}.src.md`), src);
    writeFileSync(join(dir, `${pkg.id}.json`), packageText(pkg));
  }
  seal(lang, packs.flatMap(({ pkg }) => [`${pkg.id}.src.md`, `${pkg.id}.json`]));
  writeFileSync(join(dir, 'pitfalls.md'), pitfallsFor(lang));
  bundleCheck();
  for (const { pkg, src } of packs) {
    const json = packageText(pkg).length;
    console.log(`    ${pkg.id}: secties ${pkg.sections.map(s => s.index).join(',')}, ${pkg.sections.reduce((n, s) => n + s.words, 0)} woorden,`
      + ` ${src.length} + ${json} tekens, labels ${labelCounts(pkg)}, termen ${pkg.terms.length}${pkg.previous ? `, previous ${Object.keys(pkg.previous).length}` : ''}`);
  }
  const arts = new Set(packs.map(p => p.pkg.article)).size;
  console.log(`OK  prepare docs ${lang} --${mode}${ids ? ` ${ids.join(',')}` : ''}: ${arts} artikel(en) in ${packs.length} pakket(ten) in build/translate/${lang}/`);
}

function checkDocsCmd(args: string[]): void {
  const [langArg, ...given] = positional(args);
  const lang = checkLang(langArg);
  if (lang === 'nl' || lang === 'en') fail('check-docs: nl en en zijn de bron');
  const translated = Object.keys(readDocsIndex(lang));
  const ids = given.length ? given : translated;
  const missing = ids.filter(id => !translated.includes(id));
  if (missing.length) fail(`check-docs ${lang}: geen vertaling van ${missing.join(', ')}`);
  const stale = new Set(docsStates(lang).filter(a => a.state === 'stale').map(a => a.id));
  const skipped = ids.filter(id => stale.has(id));
  if (skipped.length && !given.length) {
    console.log(`..  check-docs ${lang}: ${skipped.length} verouderd artikel(en) overgeslagen (eerst bijwerken met --stale): ${skipped.join(', ')}`);
  }
  for (const id of given.length ? skipped : []) {
    console.log(`    XX ${id}: verouderd (en veranderde na de vertaling), niet te keuren; maak het opnieuw met prepare docs ${lang} --ids ${id}`);
  }
  const checked = ids.filter(id => !stale.has(id));
  let red = given.length ? skipped.length : 0;
  for (const { pkg, src } of checked.length ? buildDocsFor(lang, 'ids', checked, Number.MAX_SAFE_INTEGER) : []) {
    const r = checkDocs(pkg, src, readFileSync(docPath(lang, pkg.article), 'utf8'));
    if (!r.errors.length) continue;
    red++;
    for (const line of formatResult(pkg.article, r).filter(l => !l.startsWith('WW'))) console.log(`    ${line}`);
  }
  const redChecked = red - (given.length ? skipped.length : 0);
  console.log(`${red ? 'XX' : 'OK'}  check-docs ${lang}: ${checked.length - redChecked} groen, ${red} rood`
    + (skipped.length && !given.length ? `, ${skipped.length} verouderd overgeslagen` : ''));
  if (red) process.exit(1);
}

function enUiTexts(): Set<string> {
  const out = new Set<string>();
  const walk = (o: JsonObject) => {
    for (const v of Object.values(o)) {
      if (typeof v === 'string') out.add(normLabel(v));
      else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v as JsonObject);
    }
  };
  for (const ns of NAMESPACES) walk(readLocale('en', ns));
  return out;
}

function docsLiteral(): void {
  const lit = loadLiteral();
  const ui = enUiTexts();
  const before = new Set(literalNames(lit));
  const sources: Record<string, string[]> = {};
  const tut = 'scripts/tutorial-project.ts';
  sources[tut] = literalCandidates(tutorialNames(readFileSync(join(ROOT, tut), 'utf8')), ui);
  const exDir = join(ROOT, 'public/examples');
  for (const f of readdirSync(exDir).filter(x => x.endsWith('.ifc')).sort()) {
    const rel = `public/examples/${f}`;
    sources[rel] = literalCandidates(ifcNames(readFileSync(join(exDir, f), 'utf8')), ui);
  }
  for (const [file, names] of Object.entries(lit.sources)) if (!(file in sources)) sources[file] = names;
  const next: DocsLiteral = { ...lit, sources };
  writeJson(DOCS_LITERAL, next);
  const after = new Set(literalNames(next));
  const added = [...after].filter(n => !before.has(n)).length;
  const removed = [...before].filter(n => !after.has(n)).length;
  console.log(`OK  docs-literal: ${after.size} voorbeeldnaam/-namen (was ${before.size}; +${added}, -${removed}) in ${Object.keys(sources).length} bron(nen)`);
}

function applyDocs(lang: string): void {
  const dir = join(WORK, lang);
  const order = manifestOrder();
  const inputs = new Map(docsInputs(lang).map(a => [a.id, a]));
  const sources = readDocsSources(lang);
  const titles = readDocsIndex(lang);
  const index = labelIndexFor(lang);
  const hashes = index.hashes;
  const literals = new Set(literalNames(loadLiteral()));
  const labelsOf = (i: number, text: string) => sectionLabels(i, text, index, literals).keys;
  const byArticle = new Map<string, { base: string; pkg: DocsPackage; src: string; out?: string }[]>();
  let unreadable = 0;
  const brokenArticles = new Set<string>();
  for (const base of docsPackageBases(dir)) {
    let pkg: DocsPackage;
    try {
      pkg = readJson<DocsPackage>(join(dir, `${base}.json`));
    } catch (err) {
      console.log(`XX  ${base}.json: niet te lezen (${err instanceof Error ? err.message : String(err)})`);
      unreadable++;
      brokenArticles.add(base.replace(/-\d+$/, ''));
      continue;
    }
    const out = existsSync(join(dir, `${base}.out.md`)) ? readFileSync(join(dir, `${base}.out.md`), 'utf8') : undefined;
    const list = byArticle.get(pkg.article) ?? [];
    list.push({ base, pkg, src: readFileSync(join(dir, `${base}.src.md`), 'utf8'), ...(out !== undefined ? { out } : {}) });
    byArticle.set(pkg.article, list);
  }
  let red = unreadable;
  const applied: string[] = [];
  let written = 0;
  let rearranged = 0;
  const write = (id: string, md: string, entry: DocsSources[string]) => {
    mkdirSync(join(DOCS_DIR, lang), { recursive: true });
    writeFileSync(docPath(lang, id), md);
    sources[id] = entry;
    titles[id] = titleOf(md) ?? id;
  };
  for (const [id, list] of byArticle) {
    if (brokenArticles.has(id)) { console.log(`XX  ${id}: een pakket is niet te lezen, niet samengevoegd`); continue; }
    const art = inputs.get(id);
    if (!art) { console.log(`XX  ${id}: staat niet (meer) in het manifest, overgeslagen`); red++; continue; }
    if (list.some(x => x.out === undefined)) { console.log(`..  ${id}: nog geen uitvoer voor ${list.filter(x => x.out === undefined).map(x => x.base).join(', ')}`); continue; }
    const tampered = sealErrors(lang, list.flatMap(x => [`${x.base}.json`, `${x.base}.src.md`]));
    if (tampered.length) {
      red++;
      for (const line of tampered) console.log(`    XX ${line}`);
      console.log(`XX  ${id}: rood, niet samengevoegd`);
      continue;
    }
    const reds = list.map(x => ({ x, r: checkDocs(x.pkg, x.src, x.out!) })).filter(({ r }) => r.errors.length > 0);
    if (reds.length) {
      red++;
      for (const { x, r } of reds) for (const line of formatResult(x.pkg.id, r).filter(l => !l.startsWith('WW'))) console.log(`    ${line}`);
      console.log(`XX  ${id}: rood, niet samengevoegd`);
      continue;
    }
    const m = mergeArticle({ enMd: art.md, translated: art.translated, entry: sources[id], labelHashes: hashes, labelsOf, packages: list.map(x => ({ pkg: x.pkg, out: x.out! })) });
    if ('error' in m) { red++; console.log(`XX  ${id}: ${m.error}`); continue; }
    const errs = checkDocsArticle(art.md, m.md);
    if (errs.length) { red++; for (const e of errs) console.log(`    XX ${e}`); console.log(`XX  ${id}: samengevoegd artikel rood, niet geschreven`); continue; }
    write(id, m.md, m.entry);
    written++;
    applied.push(...list.map(x => x.base));
    console.log(`OK  ${id}: ${m.fromPackages} sectie(s) uit ${list.length} pakket(ten), ${m.kept} behouden`);
  }
  for (const art of inputs.values()) {
    if (byArticle.has(art.id) || art.translated === undefined || !sources[art.id]) continue;
    const st = articleState(art.id, art.md, art.translated, sources[art.id], hashes);
    if (st.state !== 'stale' || st.sections.some(x => x.state !== 'current')) continue;
    const m = mergeArticle({ enMd: art.md, translated: art.translated, entry: sources[art.id], labelHashes: hashes, labelsOf, packages: [] });
    if ('error' in m || checkDocsArticle(art.md, m.md).length) continue;
    write(art.id, m.md, m.entry);
    rearranged++;
    console.log(`OK  ${art.id}: herschikt (secties verwijderd of verplaatst in en)`);
  }
  if (written || rearranged) {
    writeFileSync(docsIndexPath(lang), serializeDocsIndex(titles, order));
    writeJson(docsSourcesPath(lang), orderDocsSources(sources, order));
  }
  if (applied.length) {
    const to = join(dir, 'applied', stamp());
    mkdirSync(to, { recursive: true });
    for (const b of applied) for (const ext of ['.src.md', '.json', '.out.md']) renameSync(join(dir, b + ext), join(to, b + ext));
  }
  console.log(`${red ? 'XX' : 'OK'}  apply docs ${lang}: ${written} artikel(en) samengevoegd, ${rearranged} herschikt, ${red} rood overgeslagen`);
  if (red) process.exit(1);
}

function renameDoc(args: string[]): void {
  const [from, to] = positional(args);
  if (!from || !to || from === to) fail('rename-doc <oud> <nieuw>');
  const enNew = readDoc('en', to);
  let moved = 0;
  for (const lang of docsLangs()) {
    if (existsSync(docPath(lang, to)) && existsSync(docPath(lang, from))) fail(`${lang}: ${to}.md bestaat al naast ${from}.md`);
    if (existsSync(docPath(lang, from))) { renameSync(docPath(lang, from), docPath(lang, to)); moved++; }
    const dir = join(DOCS_DIR, lang);
    let links = 0;
    if (existsSync(dir)) {
      for (const f of readdirSync(dir).filter(x => x.endsWith('.md'))) {
        const md = readFileSync(join(dir, f), 'utf8');
        const next = renameDocLinks(md, from, to);
        if (next !== md) { writeFileSync(join(dir, f), next); links++; }
      }
    }
    const titles = readDocsIndex(lang);
    if (from in titles) { titles[to] = titles[from]; delete titles[from]; }
    const src = readDocsSources(lang);
    if (src[from]) { src[to] = src[from]; delete src[from]; }
    for (const id of Object.keys(src)) {
      const en = id === to ? enNew : readDoc('en', id);
      if (en !== undefined) src[id] = renameInEntry(src[id], en, from, to);
    }
    if (existsSync(dir)) writeFileSync(docsIndexPath(lang), serializeDocsIndex(titles, manifestOrder()));
    if (existsSync(docsSourcesPath(lang))) writeJson(docsSourcesPath(lang), orderDocsSources(src, manifestOrder()));
    console.log(`..  ${lang}: ${links} bestand(en) met links bijgewerkt`);
  }
  if (enNew === undefined) console.log(`!!  public/docs/en/${to}.md bestaat nog niet: hernoem ook nl/en en het manifest (met een alias), dan kloppen de hashes`);
  console.log(`OK  rename-doc ${from} → ${to}: ${moved} vertaling(en) hernoemd in ${docsLangs().length} taal/talen`);
}

function removeDoc(args: string[]): void {
  const [id] = positional(args);
  if (!id) fail('remove-doc <id>');
  let removed = 0;
  for (const lang of docsLangs()) {
    if (existsSync(docPath(lang, id))) { unlinkSync(docPath(lang, id)); removed++; }
    const titles = readDocsIndex(lang);
    delete titles[id];
    const src = readDocsSources(lang);
    delete src[id];
    if (existsSync(join(DOCS_DIR, lang))) writeFileSync(docsIndexPath(lang), serializeDocsIndex(titles, manifestOrder()));
    if (existsSync(docsSourcesPath(lang))) writeJson(docsSourcesPath(lang), orderDocsSources(src, manifestOrder()));
    const dir = join(DOCS_DIR, lang);
    const linking = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.md') && readFileSync(join(dir, f), 'utf8').includes(`docs://${id}`)) : [];
    if (linking.length) console.log(`!!  ${lang}: nog links naar ${id} in ${linking.join(', ')} (volgen de en-bron na prepare --stale)`);
  }
  console.log(`OK  remove-doc ${id}: ${removed} vertaling(en) verwijderd in ${docsLangs().length} taal/talen`);
}

function docsBudget(args: string[]): void {
  const langs = positional(args).map(checkLang);
  if (langs.length === 0) fail('docs-budget <taal…>');
  const words = maxWords(args);
  for (const lang of langs) {
    const packs = buildDocsFor(lang, 'ids', manifestOrder(), words).map(({ pkg, src }) => {
      const json = packageText(pkg).length;
      const inTok = Math.round((src.length + json) / 3.5);
      const outTok = Math.round((src.length / 3.5) * 1.6);
      return { id: pkg.id, words: pkg.sections.reduce((n, s) => n + s.words, 0), src: src.length, json, inTok, outTok, labels: labelCounts(pkg) };
    }).sort((a, b) => (b.inTok + b.outTok) - (a.inTok + a.outTok));
    console.log(`${lang}: ${packs.length} pakket(ten) bij --max-words ${words}`);
    for (const p of packs.slice(0, 5)) {
      console.log(`    ${p.id}: ${p.words} woorden, src ${p.src} + json ${p.json} tekens ≈ ${p.inTok} tokens in, ≈ ${p.outTok} uit; labels ${p.labels}`);
    }
  }
}

const uiGaps = (lang: string): ReleaseGap[] => uiReleaseGaps(lang, nsInputs(lang), readJsonOr<UiSources>(sourcesPath(lang), {}));
const docsGaps = (lang: string): ReleaseGap[] =>
  (lang !== 'en' && docsLangs().includes(lang) ? docsReleaseGaps(lang, docsStates(lang)) : []);

const GAP_LABEL: Record<ReleaseGap['state'], string> = { missing: 'ontbreekt', stale: 'verouderd', unhashed: 'zonder hash', 'fixed-text': 'vaste tekst wijkt af' };

function strictStatus(langs: string[]): void {
  validateTermbase();
  let total = 0;
  const red: string[] = [];
  for (const lang of langs) {
    const gaps = uiGaps(lang);
    if (gaps.length === 0) { console.log(`OK  ${lang}: UI vertaald en actueel`); continue; }
    total += gaps.length;
    red.push(lang);
    const count = (state: ReleaseGap['state']) => gaps.filter(g => g.state === state).length;
    console.log(`XX  ${lang}: ${count('missing')} ontbreekt, ${count('stale')} verouderd, ${count('unhashed')} zonder hash, ${count('fixed-text')} vaste tekst wijkt af`);
    for (const g of gaps.slice(0, 10)) console.log(`      ${g.where} (${GAP_LABEL[g.state]})${g.detail ? `: ${g.detail}` : ''}`);
    if (gaps.length > 10) console.log(`      … en ${gaps.length - 10} meer (\`npm run translate -- status ${lang}\`)`);
  }
  const docsBehind = langs.map(lang => ({ lang, n: new Set(docsGaps(lang).map(g => g.where.split('#')[0])).size }))
    .filter(d => d.n > 0);
  if (docsBehind.length) {
    console.log(`..  docs (blokkeert niet): ${docsBehind.map(d => `${d.lang} ${d.n}`).join(', ')} artikel(en) achter`
      + ' — bijwerken met de skill update-docs-lang');
  }
  if (total) {
    console.log(`XX  verify:translations: ${total} UI-vertaling(en) niet bij in ${red.length} taal/talen (${red.join(', ')}).`);
    console.log('    Draai de skill update-ui-lang (de release-skill doet dat in stap "Vertalingen bijwerken met de straat").');
    process.exit(1);
  }
  console.log(`OK  verify:translations: UI in ${langs.length} talen compleet en actueel`);
}

function status(args: string[]): void {
  const asked = positional(args)[0];
  const langs = asked ? [checkLang(asked)] : LOCALES.filter(lang => lang !== 'nl').sort();
  if (flag(args, '--strict')) { strictStatus(langs); return; }
  console.log('taal  namespace  ontbreekt  verouderd  actueel  (zonder hash)');
  let todo = 0;
  for (const lang of langs) {
    const rows = uiStatus(lang, nsInputs(lang), readJsonOr<UiSources>(sourcesPath(lang), {}));
    for (const r of rows) {
      todo += r.missing + r.stale + r.unhashed;
      console.log(`${lang.padEnd(5)} ${r.ns.padEnd(10)} ${String(r.missing).padStart(9)}  ${String(r.stale).padStart(9)}  ${String(r.current).padStart(7)}  ${r.unhashed ? `(${r.unhashed})` : ''}`);
    }
  }
  console.log(todo ? `..  ${todo} eenheid/eenheden te vertalen (ontbreekt, verouderd of zonder hash)` : 'OK  alles actueel');
  console.log('');
  console.log('docs  ontbreekt  verouderd (secties)  actueel   (artikelen)');
  let docsTodo = 0;
  for (const lang of langs.filter(l => l !== 'en')) {
    const st = docsStatus(lang, docsStates(lang));
    docsTodo += st.missing + st.stale;
    console.log(`${lang.padEnd(5)} ${String(st.missing).padStart(9)}  ${`${st.stale} (${st.staleSections})`.padStart(19)}  ${String(st.current).padStart(7)}`
      + `${docsLangs().includes(lang) ? '' : '   (nog geen docs: telt niet in de releasepoort)'}`);
  }
  console.log(docsTodo ? `..  ${docsTodo} artikel(en) te vertalen of bij te werken` : 'OK  docs actueel');
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
  case 'apply-findings': applyFindingsCmd(rest); break;
  case 'packages': packagesCmd(rest); break;
  case 'settled': settledCmd(rest); break;
  case 'night-guard': nightGuardCmd(rest); break;
  case 'check-docs': checkDocsCmd(rest); break;
  case 'status': status(rest); break;
  case 'rename-doc': renameDoc(rest); break;
  case 'remove-doc': removeDoc(rest); break;
  case 'docs-budget': docsBudget(rest); break;
  case 'docs-literal': docsLiteral(); break;
  default:
    console.log('gebruik: npm run translate -- <validate-termbase | concepts-candidates | concepts-merge | terms-lookup <taal> | '
      + 'apply-terms <taal> | prepare ui <taal> [--missing|--stale|--open|--all|--avoid [--stale]|--keys <bestand>] [--only <bestand>] | bundle-check | '
      + 'apply ui <taal> | apply-findings <taal> <bestand> | packages ui|docs <taal…> [--red|--bundle N] | settled --out <bestand> | night-guard <BASE> | check-docs <taal> [id…] | status [taal] [--strict] | '
      + 'prepare docs <taal> [--missing|--stale|--ids a,b] [--max-words N] | apply docs <taal> | rename-doc <oud> <nieuw> | '
      + 'remove-doc <id> | docs-budget <taal…> | docs-literal>');
    process.exit(cmd ? 1 : 0);
}
