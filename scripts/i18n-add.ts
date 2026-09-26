// `npm run i18n:add -- <ns>:<pad.naar.sleutel> <vertalingen.json> [--update] [--after <broer>]`
//
// Zet één tekst in alle 14 locales tegelijk, op dezelfde plek (de volgorde van nl) — in plaats van
// 14 bestanden met de hand. <vertalingen.json> bevat per locale de tekst:
//
//   { "nl": "Onderbreking opheffen", "en": "Remove break", "fr": "…", … }            // gewone tekst
//   { "nl": { "one": "{{count}} taak", "other": "{{count}} taken" },                 // meervoud:
//     "pl": { "one": "…", "few": "…", "many": "…", "other": "…" }, "zh": { "other": "…" }, … }
//
// Het script weigert (en schrijft dan niets) als een locale ontbreekt, een taal niet precies haar
// CLDR-meervoudscategorieën heeft, of de {{invulplekken}} afwijken van nl. Een bestaande sleutel
// wijzigen kan alleen met --update (bijv. een label inkorten: één commando i.p.v. 14 bestanden).
// --after <broer> plaatst een nieuwe sleutel direct na die broer; anders achteraan in zijn object.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCALES, NAMESPACES, formatLocale, keyExists, serialize, setTranslation, validateTranslations,
  type JsonObject, type Namespace, type Translation,
} from './i18n-tools';

function fail(message: string): never {
  console.log(`XX  i18n:add: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const update = args.includes('--update');
const afterIdx = args.indexOf('--after');
const after = afterIdx >= 0 ? args[afterIdx + 1] : undefined;
if (afterIdx >= 0 && !after) fail('--after verwacht de naam van een broersleutel');
const positional = args.filter((a, i) => !a.startsWith('--') && (afterIdx < 0 || i !== afterIdx + 1));
const [target, file] = positional;
if (!target || !file) {
  fail('gebruik: npm run i18n:add -- <ns>:<pad.naar.sleutel> <vertalingen.json> [--update] [--after <broer>]');
}

const sep = target.indexOf(':');
const ns = target.slice(0, sep) as Namespace;
const path = target.slice(sep + 1);
if (sep < 0 || !(NAMESPACES as readonly string[]).includes(ns) || !/^[\w-]+(\.[\w-]+)*$/.test(path)) {
  fail(`"${target}" is geen <ns>:<pad>; namespaces: ${NAMESPACES.join(', ')}`);
}

let input: Record<string, Translation>;
try {
  input = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Translation>;
} catch (err) {
  fail(`kan ${file} niet lezen als JSON: ${err instanceof Error ? err.message : String(err)}`);
}
const errors = validateTranslations(input);
if (errors.length > 0) fail(`niets geschreven, want:\n    - ${errors.join('\n    - ')}`);

const dir = join(process.cwd(), 'src/i18n/locales');
const read = (loc: string) => JSON.parse(readFileSync(join(dir, loc, `${ns}.json`), 'utf8')) as JsonObject;

const nl = read('nl');
const exists = keyExists(nl, path);
if (exists && !update) fail(`${ns}:${path} bestaat al — gebruik --update om hem te wijzigen`);
if (!exists && update) fail(`${ns}:${path} bestaat nog niet — laat --update weg om hem toe te voegen`);

setTranslation(nl, path, input.nl, exists ? undefined : after);
const nlText = serialize(nl);
const nlOrdered = formatLocale(nlText, nlText);
writeFileSync(join(dir, 'nl', `${ns}.json`), nlOrdered);
for (const loc of LOCALES) {
  if (loc === 'nl') continue;
  const data = read(loc);
  setTranslation(data, path, input[loc]);
  writeFileSync(join(dir, loc, `${ns}.json`), formatLocale(serialize(data), nlOrdered));
}
console.log(`OK  i18n:add: ${ns}:${path} ${exists ? 'gewijzigd' : 'toegevoegd'} in ${LOCALES.length} locales`);
