/**
 * De kern van `npm run i18n:fmt` / `npm run i18n:add` (scripts/i18n-tools.ts).
 *
 * Het belangrijkste contract: opmaken verandert NOOIT de inhoud — alleen volgorde en witruimte. Dat
 * wordt hieronder op alle 56 echte locale-bestanden bewezen (inhoud gelijk, en opmaken is
 * idempotent), zodat de eenmalige herschikking geen vertaling kan wegvagen. Daarnaast: de nl-volgorde
 * wint, meervoudsfamilies blijven bij elkaar in CLDR-volgorde, en `validateTranslations` weigert een
 * onvolledige of foute set vóórdat er iets geschreven wordt.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCALES, NAMESPACES, formatLocale, keyExists, orderLike, pluralCategories, serialize, setTranslation,
  validateTranslations, type Json, type JsonObject, type Translation,
} from '../../scripts/i18n-tools';

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

  const missing = plain('X'); delete missing.fa;
  eq('ontbrekende locale wordt gemeld', validateTranslations(missing), ['fa: ontbreekt']);

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
}

// ── 5. De echte 56 bestanden: opmaken verandert de inhoud niet, en is idempotent ──────────────
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

if (diffs.length === 0) {
  console.log(`OK  i18n-tools: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  i18n-tools: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
