// `npm run i18n:add -- <ns>:<pad.naar.sleutel> <vertalingen.json> [--update] [--after <broer>]`
//
// Zet één tekst in nl + en en in elke opgegeven locale tegelijk, op dezelfde plek (de volgorde van nl).
// <vertalingen.json> bevat per locale de tekst; alleen nl en en zijn verplicht (besluit B5, 2026-10-10):
//
//   { "nl": "Onderbreking opheffen", "en": "Remove break" }                          // gewone tekst
//   { "nl": { "one": "{{count}} taak", "other": "{{count}} taken" },                 // meervoud:
//     "en": { "one": "{{count}} task", "other": "{{count}} tasks" },
//     "pl": { "one": "…", "few": "…", "many": "…", "other": "…" } }                   // (optioneel)
//
// Een locale die niet is opgegeven, krijgt geen tekst: de app valt daar terug op en, en de
// vertaalstraat (`npm run translate -- prepare ui <taal> --missing|--stale`) vult hem aan. Het script
// haalt daarom de bron-hash van die sleutel weg uit i18n/ui-sources/<taal>.json; een oude vertaling
// blijft staan tot de straat hem vervangt (behalve als de sleutel van soort verandert: tekst ↔ familie).
// De releasepoort `npm run verify:translations` eist dat alles weer bij is.
//
// Het script weigert (en schrijft dan niets) als nl of en ontbreekt, een opgegeven taal niet precies
// haar CLDR-meervoudscategorieën heeft, of de {{invulplekken}} afwijken van nl. Een bestaande sleutel
// wijzigen kan alleen met --update (bijv. een label inkorten: één commando i.p.v. 14 bestanden).
// --after <broer> plaatst een nieuwe sleutel direct na die broer; anders achteraan in zijn object.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCALES, NAMESPACES, formatLocale, keyExists, removeTranslation, serialize, setTranslation, translationKind,
  validateTranslations,
  type JsonObject, type Namespace, type Translation,
} from './i18n-tools';
import { orderSources, updateSourceHashForAdd, type UiSources } from './translate/ui';

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
const read = (loc: string, n: string = ns) => JSON.parse(readFileSync(join(dir, loc, `${n}.json`), 'utf8')) as JsonObject;

const nl = read('nl');
const exists = keyExists(nl, path);
if (exists && !update) fail(`${ns}:${path} bestaat al — gebruik --update om hem te wijzigen`);
if (!exists && update) fail(`${ns}:${path} bestaat nog niet — laat --update weg om hem toe te voegen`);

setTranslation(nl, path, input.nl, exists ? undefined : after);
const nlText = serialize(nl);
const nlOrdered = formatLocale(nlText, nlText);
writeFileSync(join(dir, 'nl', `${ns}.json`), nlOrdered);
// Vertaalstraat (§9): elke taal die hier geschreven wordt, is bijgewerkt tegen de nieuwe nl-tekst.
// Zonder deze hash zou `translate prepare ui --stale` een gewone i18n:add niet van een verouderde
// vertaling kunnen onderscheiden.
const sourcesDir = join(process.cwd(), 'i18n/ui-sources');
const nlByNs = Object.fromEntries(NAMESPACES.map(n => [n, n === ns ? JSON.parse(nlOrdered) as JsonObject : read('nl', n)]));
const written: string[] = ['nl'];
const left: string[] = [];
for (const loc of LOCALES) {
  if (loc === 'nl') continue;
  const data = read(loc);
  const sourcesFile = join(sourcesDir, `${loc}.json`);
  const sources = existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, 'utf8')) as UiSources : {};
  let sourcesChanged: boolean;
  if (input[loc] !== undefined) {
    setTranslation(data, path, input[loc]);
    writeFileSync(join(dir, loc, `${ns}.json`), formatLocale(serialize(data), nlOrdered));
    written.push(loc);
    // Een taal zonder basislijn (ru, cs, …) krijgt hier geen hash: alleen `translate apply ui` zet die.
    sourcesChanged = updateSourceHashForAdd(sources, loc, ns, path, input.nl);
  } else {
    // Niet opgegeven (B5): geen tekst schrijven. Een oude tekst van het verkeerde soort (tekst waar nu
    // een familie hoort, of omgekeerd) gaat weg; de app valt dan terug op en.
    const kind = translationKind(data, path);
    if (kind !== undefined && kind !== (typeof input.nl !== 'string') && removeTranslation(data, path)) {
      writeFileSync(join(dir, loc, `${ns}.json`), formatLocale(serialize(data), nlOrdered));
    }
    left.push(loc);
    const h = sources[ns];
    sourcesChanged = h !== undefined && h[path] !== undefined;
    if (sourcesChanged) delete h![path];
  }
  if (!sourcesChanged) continue;
  mkdirSync(sourcesDir, { recursive: true });
  writeFileSync(sourcesFile, serialize(orderSources(sources, nlByNs) as unknown as JsonObject));
}
console.log(`OK  i18n:add: ${ns}:${path} ${exists ? 'gewijzigd' : 'toegevoegd'} in ${written.length} locale(s) (${written.join(', ')})`);
if (left.length) {
  console.log(`..  ${left.length} locale(s) niet opgegeven (valt terug op en): ${left.join(', ')}`);
  console.log('..  de vertaalstraat vult ze aan (`npm run translate -- prepare ui <taal> --missing` en `--stale`); een release eist `npm run verify:translations`');
}
