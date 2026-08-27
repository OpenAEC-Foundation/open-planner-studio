// F5 + F7 (vloot-fixpakket, issue #19).
//
// F5 — i18next-CLDR-pluralvormen voor `companyLibrary.refreshNotice` en
// `companyLibrary.removeCompanyConfirmLinked`. Draait de ECHTE i18next uit node_modules tegen de
// daadwerkelijke locale-JSON's (nl/en/pl/ar — de vier talen met een niet-triviale plural-split) en
// controleert dat `t(key, { count })` bij count=1 (en voor pl/ar ook andere tellingen) de juiste
// grammaticale vorm teruggeeft — niet de kale meervoudstekst. Sluit af met een regressie-anker op de
// RAUWE JSON: de kale (niet-gesuffixte) sleutelvariant mag niet meer bestaan in ÉÉN van de 14 locales
// (i18next v25 lost pluralvormen uitsluitend via `_one`/`_other`/... op; een resterende kale key zou
// de gesplitste varianten overschaduwen).
//
// F7 — de 14 dode `companyLibrary.field.*`-keys (alles behalve `field.name`, wees sinds de sloop van
// de oude diff-dialoog) moeten in ALLE 14 locales weg zijn; `field.name` zelf (nog in gebruik,
// ResourcePanel/LibrarySection) blijft staan.
//
// Headless op Node (esbuild-patroon van de zusterchecks). Exitcode = poort.
import i18next from 'i18next';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// node:fs/url/path en `process` komen sinds de I5-migratie (T3-kwaliteitsreview) uit de echte
// @types/node-signatuur (`tsconfig.check.json` zet nu `"types": ["node"]`, net als
// tests/planning/tsconfig.check.json) — geen lokale ambient shim meer nodig.

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const localesDir = join(currentDir, '..', '..', 'src', 'i18n', 'locales');
const ALL_LOCALES = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'];

function loadCommon(loc: string): { companyLibrary?: Record<string, unknown> } {
  return JSON.parse(readFileSync(join(localesDir, loc, 'common.json'), 'utf8'));
}

async function main() {
  const testLocales = ['nl', 'en', 'pl', 'ar'];
  await i18next.init({
    lng: 'nl',
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    resources: Object.fromEntries(testLocales.map((loc) => [loc, { common: loadCommon(loc) }])),
    interpolation: { escapeValue: false },
    initImmediate: false,
  });

  // --- nl: count=1 ⇒ enkelvoud (bewijst dat _one bestaat en wordt gekozen boven _other) ---
  await i18next.changeLanguage('nl');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 1 }) === '1 onderdeel bijgewerkt vanuit de bibliotheek', 'nl: refreshNotice count=1 geeft de enkelvoudsvorm');
  // Negatieve controle: count=3 blijft de meervoudsvorm (bewijst dat _other niet per ongeluk ALTIJD wint).
  assert(i18next.t('companyLibrary.refreshNotice', { count: 3 }) === '3 onderdelen bijgewerkt vanuit de bibliotheek', 'nl: refreshNotice count=3 geeft de meervoudsvorm (negatieve controle)');
  assert(i18next.t('companyLibrary.removeCompanyConfirmLinked', { count: 1 }) === 'Deze resourcebibliotheek is aan 1 geopend project gekoppeld. Verwijderen ontkoppelt dat project. Doorgaan?', 'nl: removeCompanyConfirmLinked count=1 geeft de enkelvoudsvorm');

  // --- en ---
  await i18next.changeLanguage('en');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 1 }) === '1 item updated from the library', 'en: refreshNotice count=1 geeft de enkelvoudsvorm');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 5 }) === '5 items updated from the library', 'en: refreshNotice count=5 geeft de meervoudsvorm (negatieve controle)');
  assert(i18next.t('companyLibrary.removeCompanyConfirmLinked', { count: 1 }) === 'This resource library is linked to 1 open project. Removing it will unlink that project. Continue?', 'en: removeCompanyConfirmLinked count=1 geeft de enkelvoudsvorm');

  // --- pl: volledige CLDR-set (one/few/many/other) — count=1 (one) én count=2 (few) moeten UITEENLOPEN ---
  await i18next.changeLanguage('pl');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 1 }) === 'Zaktualizowano 1 element z biblioteki', 'pl: refreshNotice count=1 geeft de "one"-vorm ("element")');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 2 }) === 'Zaktualizowano 2 elementy z biblioteki', 'pl: refreshNotice count=2 geeft de "few"-vorm ("elementy")');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 5 }) === 'Zaktualizowano 5 elementów z biblioteki', 'pl: refreshNotice count=5 geeft de "many"-vorm ("elementów")');
  // Negatieve controle: de drie vormen zijn onderling verschillend (geen stille collaps naar één string).
  const plOne = i18next.t('companyLibrary.refreshNotice', { count: 1 });
  const plFew = i18next.t('companyLibrary.refreshNotice', { count: 2 });
  const plMany = i18next.t('companyLibrary.refreshNotice', { count: 5 });
  assert(plOne !== plFew && plFew !== plMany && plOne !== plMany, 'pl: one/few/many zijn drie ONDERSCHEIDEN vormen');

  // --- ar: volledige CLDR-set (zero/one/two/few/many/other) ---
  await i18next.changeLanguage('ar');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 1 }) === 'تم تحديث عنصر واحد من المكتبة', 'ar: refreshNotice count=1 geeft de "one"-vorm');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 2 }) === 'تم تحديث عنصرين من المكتبة', 'ar: refreshNotice count=2 geeft de "two"-vorm');
  assert(i18next.t('companyLibrary.refreshNotice', { count: 0 }) === 'لم يتم تحديث أي عنصر من المكتبة', 'ar: refreshNotice count=0 geeft de "zero"-vorm');

  // --- Regressie-anker: GEEN kale (niet-gesuffixte) key meer in ÉÉN van de 14 locales — deze assert
  // wordt rood zodra iemand de _one/_other-opsplitsing voor één taal terugdraait naar een platte string
  // (i18next zou die kale key dan gebruiken voor ELKE telling, ongeacht CLDR-categorie). ---
  for (const loc of ALL_LOCALES) {
    const cl = loadCommon(loc).companyLibrary ?? {};
    assert(!('refreshNotice' in cl), `${loc}: geen kale companyLibrary.refreshNotice-key meer (alleen _-suffixen)`);
    assert(!('removeCompanyConfirmLinked' in cl), `${loc}: geen kale companyLibrary.removeCompanyConfirmLinked-key meer`);
    assert('refreshNotice_other' in cl, `${loc}: companyLibrary.refreshNotice_other bestaat (verplichte fallback-categorie)`);
    assert('removeCompanyConfirmLinked_other' in cl, `${loc}: companyLibrary.removeCompanyConfirmLinked_other bestaat (verplichte fallback-categorie)`);
  }
  // zh/ja/ko: uitsluitend _other (geen plural-onderscheid in deze talen) — een _one hier zou dode data zijn.
  for (const loc of ['zh', 'ja', 'ko']) {
    const cl = loadCommon(loc).companyLibrary ?? {};
    assert(!('refreshNotice_one' in cl), `${loc}: geen refreshNotice_one (deze taal kent geen pluralonderscheid)`);
  }
  // pl/ar dragen de volledige CLDR-set.
  {
    const cl = loadCommon('pl').companyLibrary ?? {};
    assert('refreshNotice_few' in cl && 'refreshNotice_many' in cl, 'pl: refreshNotice_few + refreshNotice_many bestaan');
  }
  {
    const cl = loadCommon('ar').companyLibrary ?? {};
    assert('refreshNotice_zero' in cl && 'refreshNotice_two' in cl && 'refreshNotice_few' in cl && 'refreshNotice_many' in cl, 'ar: refreshNotice_zero/_two/_few/_many bestaan (volledige CLDR-set)');
  }

  // --- F7: dode field-keys weg, `field.name` (nog in gebruik) blijft — in ALLE 14 locales ---
  const DEAD_FIELD_KEYS = [
    'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay', 'holidays',
    'generation', 'workTime', 'shift', 'type', 'costPerHour', 'maxUnits', 'unitOfMeasure',
    'availabilitySteps',
  ];
  for (const loc of ALL_LOCALES) {
    const cl = loadCommon(loc).companyLibrary as { field?: Record<string, unknown> } | undefined;
    const field = cl?.field ?? {};
    assert(typeof field.name === 'string' && field.name.length > 0, `${loc}: companyLibrary.field.name blijft bestaan (nog in gebruik)`);
    for (const dead of DEAD_FIELD_KEYS) {
      assert(!(dead in field), `${loc}: companyLibrary.field.${dead} is verwijderd (wees sinds de sloop van de oude diff-dialoog)`);
    }
    assert(Object.keys(field).length === 1, `${loc}: companyLibrary.field draagt UITSLUITEND nog "name" (${Object.keys(field).join(', ')})`);
  }

  console.log(`i18n-plurals: ${checks - fails}/${checks} groen`);
  process.exit(fails > 0 ? 1 : 0);
}

main();
