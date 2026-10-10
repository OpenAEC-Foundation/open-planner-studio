/**
 * De kern van `npm run i18n:fmt` / `npm run i18n:add` (scripts/i18n-tools.ts).
 *
 * Het belangrijkste contract: opmaken verandert NOOIT de inhoud — alleen volgorde en witruimte. Dat
 * wordt hieronder op alle 56 echte locale-bestanden bewezen (inhoud gelijk, en opmaken is
 * idempotent), zodat de eenmalige herschikking geen vertaling kan wegvagen. Daarnaast: de nl-volgorde
 * wint, meervoudsfamilies blijven bij elkaar in CLDR-volgorde, en `validateTranslations` weigert een
 * foute set vóórdat er iets geschreven wordt. Besluit B5 (2026-10-10): alleen nl + en zijn verplicht;
 * sectie 7 draait `i18n:add` echt, in een tijdelijke map, en toetst wat het met de andere talen doet.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCALES, NAMESPACES, formatLocale, keyExists, mergeLocale, orderLike, pluralCategories, removeTranslation, serialize,
  setTranslation, translationKind, validateTranslations, type Json, type JsonObject, type Translation,
} from '../../scripts/i18n-tools';
import { hashUnit } from '../../scripts/translate/common';
import { selectUnits } from '../../scripts/translate/ui';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

/** Inhoud zonder volgorde: sorteer sleutels recursief. */
const canon = (v: Json): Json => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return v;
  const out: JsonObject = {};
  for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
  return out;
};

// ── 1. Volgorde van nl, families bij elkaar, onbekende sleutels achteraan ─────────────────────
{
  const nl: JsonObject = { b: 'B', a: { y: 'Y', x: 'X' }, n_one: '1', n_other: 'n', z: 'Z' };
  const pl: JsonObject = { extra: 'E', z: 'Z', n_many: 'm', a: { x: 'X', y: 'Y' }, n_other: 'o', n_one: '1', n_few: 'f', b: 'B' };
  eq('pl volgt nl, familie in CLDR-volgorde, extra achteraan', Object.keys(orderLike(pl, nl)),
    ['b', 'a', 'n_one', 'n_few', 'n_many', 'n_other', 'z', 'extra']);
  eq('geneste objecten volgen ook nl', Object.keys(orderLike(pl, nl).a as JsonObject), ['y', 'x']);
  const zh: JsonObject = { n_other: 'o', b: 'B' };
  eq('zh zonder one: alleen other op de familieplek', Object.keys(orderLike(zh, nl)), ['b', 'n_other']);
}

// ── 2. Serialisatie: één sleutel per regel, idempotent ────────────────────────────────────────
{
  const text = '{"a":{"b":"x","c":"y"},"d":"z"}';
  const once = formatLocale(text, text);
  eq('één sleutel per regel', once.trimEnd().split('\n').length, 7);
  eq('idempotent', formatLocale(once, once), once);
  ok('eindigt op een regeleinde', once.endsWith('}\n'));
}

// ── 3. Validatie vóór het schrijven ───────────────────────────────────────────────────────────
{
  const plain = (text: string): Record<string, Translation> =>
    Object.fromEntries(LOCALES.map(l => [l, `${text} ${l} {{naam}}`]));
  eq('volledige set gewone teksten is goed', validateTranslations(plain('X')), []);

  const noFa = plain('X'); delete noFa.fa;
  eq('B5: een andere locale mag ontbreken', validateTranslations(noFa), []);
  eq('B5: alleen nl + en is genoeg', validateTranslations({ nl: 'X {{naam}}', en: 'Y {{naam}}' }), []);
  const noEn = plain('X'); delete noEn.en;
  eq('B5: en ontbreekt wordt gemeld', validateTranslations(noEn), ['en: ontbreekt (nl en en zijn verplicht)']);
  eq('B5: nl ontbreekt wordt gemeld', validateTranslations({ en: 'Y' }), ['nl: ontbreekt (nl en en zijn verplicht)']);
  ok('B5: een opgegeven locale moet kloppen (invulplek)',
    validateTranslations({ nl: 'X {{naam}}', en: 'Y {{naam}}', fr: 'Z' }).some(e => e.startsWith('fr: invulplekken')));
  ok('onbekende locale wordt gemeld', validateTranslations({ nl: 'X', en: 'Y', xx: 'Z' }).includes('xx: onbekende locale'));

  const badVar = plain('X'); badVar.de = 'X de {{name}}';
  ok('afwijkende invulplek wordt gemeld', validateTranslations(badVar).some(e => e.startsWith('de: invulplekken')));

  const family = (): Record<string, Translation> => Object.fromEntries(LOCALES.map(l => [l,
    Object.fromEntries(pluralCategories(l).map(c => [c, `{{count}} ${c}`]))]));
  eq('volledige meervoudsset is goed', validateTranslations(family()), []);
  const noFew = family(); delete (noFew.pl as Record<string, string>).few;
  ok('pl zonder few wordt geweigerd', validateTranslations(noFew).some(e => e.startsWith('pl: meervoudsvormen')));
  const zhOne = family(); (zhOne.zh as Record<string, string>).one = '{{count}} x';
  ok('zh met one wordt geweigerd', validateTranslations(zhOne).some(e => e.includes('overbodig one')));
  const arWords = family(); (arWords.ar as Record<string, string>).one = 'مهمة واحدة';
  eq('Arabisch mag count in woorden uitschrijven', validateTranslations(arWords), []);
  const mixed = family(); mixed.en = '{{count}} tasks';
  ok('gewone tekst waar een familie hoort wordt geweigerd', validateTranslations(mixed).some(e => e.startsWith('en: verwacht meervoudsvormen')));
  ok('B5: een opgegeven familie moet haar CLDR-categorieën hebben (pl zonder few)', validateTranslations({
    nl: { one: '{{count}} taak', other: '{{count}} taken' }, en: { one: '{{count}} task', other: '{{count}} tasks' },
    pl: { one: '{{count}} a', many: '{{count}} c', other: '{{count}} d' },
  }).some(e => e.startsWith('pl: meervoudsvormen')));

  // Per vorm vergelijken (zelfde regel als scripts/translate/gates.ts): `one` met nl `one`, de rest met
  // nl `other`. Een familie mag per vorm andere invulplekken hebben.
  const perForm = (): Record<string, Translation> => ({
    nl: { one: "'{{task}}' heeft een fout", other: '{{count}} taken hebben een fout' },
    en: { one: "'{{task}}' has an error", other: '{{count}} tasks have an error' },
    fr: { one: "'{{task}}' a une erreur", many: "{{count}} tâches ont une erreur", other: '{{count}} tâches ont une erreur' },
    zh: { other: '{{count}} 个任务有错误' },
  });
  eq('per vorm: one met {{task}}, other met {{count}} is goed', validateTranslations(perForm()), []);
  const enOtherTask = perForm(); (enOtherTask.en as Record<string, string>).other = "{{count}} tasks, like '{{task}}'";
  ok('per vorm: {{task}} in other (nl other heeft hem niet) wordt geweigerd',
    validateTranslations(enOtherTask).some(e => e.startsWith('en.other: invulplekken')));
  const frOneNoTask = perForm(); (frOneNoTask.fr as Record<string, string>).one = 'une tâche a une erreur';
  ok('per vorm: one zonder {{task}} (nl one heeft hem wel) wordt geweigerd',
    validateTranslations(frOneNoTask).some(e => e.startsWith('fr.one: invulplekken')));
  const zhTask = perForm(); (zhTask.zh as Record<string, string>).other = "'{{task}}' 有错误";
  ok('per vorm: zh kent alleen other en vergelijkt met nl other',
    validateTranslations(zhTask).some(e => e.startsWith('zh.other: invulplekken')));
}

// ── 4. Plaatsen, wijzigen, van soort veranderen ───────────────────────────────────────────────
{
  const root: JsonObject = { sec: { a: 'A', b: 'B' } };
  setTranslation(root, 'sec.nieuw', 'N');
  eq('nieuw zonder --after: achteraan', Object.keys(root.sec as JsonObject), ['a', 'b', 'nieuw']);
  setTranslation(root, 'sec.tussen', 'T', 'a');
  eq('--after a: direct na a', Object.keys(root.sec as JsonObject), ['a', 'tussen', 'b', 'nieuw']);
  setTranslation(root, 'sec.a', 'A2');
  eq('wijzigen blijft op zijn plek', Object.keys(root.sec as JsonObject), ['a', 'tussen', 'b', 'nieuw']);
  eq('wijzigen vervangt de tekst', (root.sec as JsonObject).a, 'A2');
  setTranslation(root, 'sec.b', { one: '1', other: 'n' });
  eq('tekst wordt familie op dezelfde plek, kale sleutel weg', Object.keys(root.sec as JsonObject),
    ['a', 'tussen', 'b_one', 'b_other', 'nieuw']);
  ok('keyExists ziet een familie onder haar stam', keyExists(root, 'sec.b'));
  ok('keyExists: onbekend pad', !keyExists(root, 'sec.bestaatniet') && !keyExists(root, 'nee.b'));
  setTranslation(root, 'nieuwe.groep.sleutel', 'G');
  eq('ontbrekende tussenobjecten worden aangemaakt', root.nieuwe, { groep: { sleutel: 'G' } });
  eq('translationKind: familie / tekst / afwezig',
    [translationKind(root, 'sec.b'), translationKind(root, 'sec.a'), translationKind(root, 'sec.nee')], [true, false, undefined]);
  ok('removeTranslation haalt een hele familie weg', removeTranslation(root, 'sec.b')
    && JSON.stringify(Object.keys(root.sec as JsonObject)) === JSON.stringify(['a', 'tussen', 'nieuw']));
  ok('removeTranslation: onbekend pad verandert niets', !removeTranslation(root, 'sec.b') && !removeTranslation(root, 'x.y'));
}

// ── 5. De echte locale-bestanden: opmaken verandert de inhoud niet, en is idempotent ──────────────
{
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'i18n', 'locales');
  for (const ns of NAMESPACES) {
    const nlSource = readFileSync(join(dir, 'nl', `${ns}.json`), 'utf8');
    const nlFormatted = formatLocale(nlSource, nlSource);
    for (const loc of LOCALES) {
      const source = readFileSync(join(dir, loc, `${ns}.json`), 'utf8');
      const formatted = loc === 'nl' ? nlFormatted : formatLocale(source, nlFormatted);
      checks++;
      if (JSON.stringify(canon(JSON.parse(formatted) as Json)) !== JSON.stringify(canon(JSON.parse(source) as Json))) {
        diffs.push(`${loc}/${ns}.json: opmaken veranderde de inhoud`);
      }
      eq(`${loc}/${ns}.json: opmaken is idempotent`, formatLocale(formatted, nlFormatted) === formatted, true);
    }
  }
  eq('serialize is gewone JSON', JSON.parse(serialize({ a: 'é "q"' })), { a: 'é "q"' });
}

// ── 6. Samenvoegen per sleutel (`npm run i18n:resolve`) ───────────────────────────────────────
{
  const m = (b: JsonObject, o: JsonObject, t: JsonObject) => mergeLocale(b, o, t);
  const base: JsonObject = { a: 'A', b: 'B', c: 'C' };

  let r = m(base, base, { a: 'A', b: 'B', x: 'X', c: 'C' });
  eq('alleen theirs voegt toe → erbij, na zijn voorganger', Object.keys(r.merged), ['a', 'b', 'x', 'c']);
  r = m(base, { ...base, y: 'Y' }, base);
  eq('alleen ours voegt toe → erbij', r.merged, { a: 'A', b: 'B', c: 'C', y: 'Y' });
  r = m(base, { ...base, n: 'N' }, { ...base, n: 'N' });
  eq('beide voegen hetzelfde toe → één keer, geen botsing', [r.merged, r.conflicts.length], [{ ...base, n: 'N' }, 0]);
  r = m(base, { ...base, n: 'N1' }, { ...base, n: 'N2' });
  eq('beide voegen anders toe → botsing, voorlopig ours', [r.merged.n, r.conflicts.map(c => c.path)], ['N1', ['n']]);

  // De valkuil van git: ours verwijdert b, theirs herschikt alleen (b staat daar op een andere regel).
  r = m(base, { a: 'A', c: 'C' }, { c: 'C', b: 'B', a: 'A' });
  eq('ours verwijdert, theirs herschikt alleen → blijft weg', [r.merged, r.conflicts.length], [{ a: 'A', c: 'C' }, 0]);
  r = m(base, { a: 'A', b: 'B2', c: 'C' }, { c: 'C', b: 'B', a: 'A' });
  eq('ours wijzigt, theirs herschikt alleen → wijziging blijft', [r.merged.b, r.conflicts.length], ['B2', 0]);
  r = m(base, base, { a: 'A', c: 'C' });
  eq('theirs verwijdert, ours ongewijzigd → weg', r.merged, { a: 'A', c: 'C' });
  r = m(base, { a: 'A', c: 'C' }, { ...base, b: 'B2' });
  eq('ours verwijdert, theirs wijzigt → botsing', r.conflicts.map(c => [c.path, c.ours, c.theirs]), [['b', undefined, 'B2']]);
  r = mergeLocale(base, { ...base, b: 'B1' }, { ...base, b: 'B2' }, { ...base, b: 'B3', c: 'C9' });
  eq('eerder gekozen waarde wint alleen bij een botsing, die wel gemeld wordt',
    [r.merged.b, r.merged.c, r.conflicts.map(c => c.path)], ['B3', 'C', ['b']]);

  // Meervoudsfix aan de ene kant (#177-vorm), nieuwe sleutel aan de andere.
  const pb: JsonObject = { g: { n: '{{count}} taken', z: 'Z' } };
  r = m(pb, { g: { n: '{{count}} taken', z: 'Z', nieuw: 'N' } }, { g: { n_one: '{{count}} taak', n_other: '{{count}} taken', z: 'Z' } });
  eq('meervoudsfamilie van theirs + nieuwe sleutel van ours', r.merged,
    { g: { n_one: '{{count}} taak', n_other: '{{count}} taken', z: 'Z', nieuw: 'N' } });
  eq('… zonder botsing', r.conflicts.length, 0);

  r = m({}, { o: { p: 'P' } }, { o: { q: 'Q' } });
  eq('nieuw object aan beide kanten → samengevoegd (sleutel zonder voorganger vooraan)', r.merged, { o: { q: 'Q', p: 'P' } });
  r = m({ s: 'S' }, { s: { k: 'K' } }, { s: 'S2' });
  eq('tekst wordt object vs tekst gewijzigd → botsing', r.conflicts.map(c => c.path), ['s']);

  // Op de echte bestanden: een pure herschikking aan de overkant verandert niets, en een verwijdering
  // of wijziging aan onze kant overleeft haar — voor alle locale-bestanden.
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'i18n', 'locales');
  const reversed = (o: JsonObject): JsonObject => Object.fromEntries(Object.keys(o).reverse()
    .map(k => [k, (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k])) ? reversed(o[k] as JsonObject) : o[k]]));
  let bad = 0;
  for (const ns of NAMESPACES) {
    for (const loc of LOCALES) {
      const x = JSON.parse(readFileSync(join(dir, loc, `${ns}.json`), 'utf8')) as JsonObject;
      const [first, ...rest] = Object.keys(x);
      const withoutFirst: JsonObject = Object.fromEntries(rest.map(k => [k, x[k]]));
      const same = m(x, x, reversed(x));
      const del = m(x, withoutFirst, reversed(x));
      const add = m(x, { ...x, __nieuw: 'N' }, reversed(x));
      checks++;
      if (same.conflicts.length || del.conflicts.length || add.conflicts.length
        || JSON.stringify(canon(same.merged)) !== JSON.stringify(canon(x))
        || JSON.stringify(canon(del.merged)) !== JSON.stringify(canon(withoutFirst))
        || (add.merged as JsonObject).__nieuw !== 'N' || Object.keys(add.merged).length !== Object.keys(x).length + 1) {
        bad++;
        diffs.push(`${loc}/${ns}.json: samenvoegen over een herschikking heen verandert de inhoud (weggehaald: ${first})`);
      }
    }
  }
  eq('alle 56 echte bestanden overleven een herschikking aan de overkant', bad, 0);
}

// ── 7. `i18n:add` echt gedraaid (besluit B5): nl + en verplicht, de rest via de vertaalstraat ──────
{
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const work = mkdtempSync(join(tmpdir(), 'ops-i18n-add-'));
  const bundle = join(work, 'i18n-add.mjs');
  const locFile = (loc: string, ns = 'common') => join(work, 'src/i18n/locales', loc, `${ns}.json`);
  const srcFile = (loc: string) => join(work, 'i18n/ui-sources', `${loc}.json`);
  const readText = (f: string) => readFileSync(f, 'utf8');
  const readObj = (f: string) => JSON.parse(readText(f)) as JsonObject;
  const add = (args: string[], input: unknown) => {
    const file = join(work, 'input.json');
    writeFileSync(file, JSON.stringify(input));
    const r = spawnSync(process.execPath, [bundle, ...args, file], { cwd: work, encoding: 'utf8' });
    return { status: r.status ?? 1, out: `${r.stdout}${r.stderr}` };
  };
  try {
    const esbuild = spawnSync(join(root, 'node_modules', '.bin', 'esbuild'), [join(root, 'scripts', 'i18n-add.ts'),
      '--bundle', '--platform=node', '--format=esm', '--log-level=error', `--outfile=${bundle}`], { encoding: 'utf8' });
    if (esbuild.status !== 0) throw new Error(`bundelen van i18n-add.ts mislukt: ${esbuild.stderr}`);
    for (const loc of LOCALES) {
      for (const ns of NAMESPACES) {
        mkdirSync(dirname(locFile(loc, ns)), { recursive: true });
        writeFileSync(locFile(loc, ns), serialize(ns === 'common' ? { a: `A ${loc}`, b: `B ${loc}` } : {}));
      }
    }
    // fr heeft een basislijn (bestaande taal), ru niet (nieuwe taal, hash alleen via `apply ui`).
    mkdirSync(join(work, 'i18n/ui-sources'), { recursive: true });
    for (const loc of ['en', 'fr', 'ru']) {
      writeFileSync(srcFile(loc), serialize({ common: { a: hashUnit('A nl'), b: hashUnit('B nl') } }));
    }
    const frBefore = readText(locFile('fr'));
    const ruBefore = readText(locFile('ru'));

    const r1 = add(['common:nieuw'], { nl: 'Nieuw', en: 'New' });
    eq('7a nieuwe sleutel met alleen nl + en: exit 0', r1.status, 0);
    eq('7a nl en en hebben de sleutel', [readObj(locFile('nl')).nieuw, readObj(locFile('en')).nieuw], ['Nieuw', 'New']);
    eq('7a fr en ru zijn byte-gelijk gebleven', [readText(locFile('fr')) === frBefore, readText(locFile('ru')) === ruBefore], [true, true]);
    ok(`7a de uitvoer noemt de niet-opgegeven talen en de straat (${r1.out})`, /26 locale\(s\) niet opgegeven/.test(r1.out) && /prepare ui/.test(r1.out));
    eq('7a en krijgt de hash van de nieuwe nl-tekst', (readObj(srcFile('en')).common as JsonObject).nieuw, hashUnit('Nieuw'));
    eq('7a de straat ziet de sleutel als ontbrekend in fr', selectUnits({
      ns: 'common', nl: readObj(locFile('nl')), en: readObj(locFile('en')), target: readObj(locFile('fr')),
    }, 'fr', 'missing', readObj(srcFile('fr')) as never).map(u => u.unit.key), ['nieuw']);

    const r2 = add(['common:a', '--update'], { nl: 'A nl 2', en: 'A en 2' });
    eq('7b --update met alleen nl + en: exit 0', r2.status, 0);
    eq('7b fr houdt zijn oude tekst', readObj(locFile('fr')).a, 'A fr');
    eq('7b fr en ru verliezen de hash van a, b blijft', [readObj(srcFile('fr')).common, readObj(srcFile('ru')).common],
      [{ b: hashUnit('B nl') }, { b: hashUnit('B nl') }]);
    eq('7b en krijgt de nieuwe hash', (readObj(srcFile('en')).common as JsonObject).a, hashUnit('A nl 2'));
    const stale = selectUnits({
      ns: 'common', nl: readObj(locFile('nl')), en: readObj(locFile('en')), target: readObj(locFile('fr')),
    }, 'fr', 'stale', readObj(srcFile('fr')) as never);
    eq('7b prepare ui fr --stale pakt a op, met de oude tekst', stale.map(u => [u.unit.key, u.previous]), [['a', 'A fr']]);

    const r3 = add(['common:a', '--update'], { nl: 'A nl 3', en: 'A en 3', fr: 'A fr 3' });
    eq('7c een opgegeven fr wordt geschreven en krijgt de hash', [r3.status, readObj(locFile('fr')).a,
      (readObj(srcFile('fr')).common as JsonObject).a], [0, 'A fr 3', hashUnit('A nl 3')]);

    const before = LOCALES.map(loc => readText(locFile(loc)));
    const r4 = add(['common:c'], { nl: 'C', fr: 'C fr' });
    eq('7d zonder en: exit 1 en niets geschreven', [r4.status, LOCALES.every((loc, i) => readText(locFile(loc)) === before[i])], [1, true]);
    const r5 = add(['common:c'], { nl: { one: '{{count}} c', other: '{{count}} cs' }, en: { one: '{{count}} c', other: '{{count}} cs' },
      pl: { one: '{{count}} c', other: '{{count}} c' } });
    eq('7e een opgegeven pl zonder few/many: exit 1 en niets geschreven',
      [r5.status, LOCALES.every((loc, i) => readText(locFile(loc)) === before[i])], [1, true]);

    const r6 = add(['common:b', '--update'], { nl: { one: '{{count}} b', other: '{{count}} bs' }, en: { one: '{{count}} b', other: '{{count}} bs' } });
    eq('7f tekst wordt familie: exit 0', r6.status, 0);
    eq('7f de oude kale tekst verdwijnt in een niet-opgegeven taal (de app valt terug op en)',
      [readObj(locFile('fr')).b, readObj(locFile('ru')).b], [undefined, undefined]);
    eq('7f nl en en dragen de familie', [readObj(locFile('nl')).b_other, readObj(locFile('en')).b_one], ['{{count}} bs', '{{count}} b']);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (diffs.length === 0) {
  console.log(`OK  i18n-tools: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  i18n-tools: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
