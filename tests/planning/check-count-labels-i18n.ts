/**
 * Telteksten met een vast meervoud — enkelvoud bij één item.
 *
 * AANLEIDING. Vier teksten die met een `count` worden aangeroepen hadden één vaste meervoudsvorm en
 * lieten bij één item dus "1 taken" of "1 resources" zien: het herstelvenster (`recovery.taskCount`),
 * de histogram-tooltip (`resource.histogram.overallocatedTooltip`), de overbezettingsteller in het
 * lint (`ribbon.overallocationCount`) en het kritiek pad in de statusbalk (`status.criticalPath`).
 * Nu zijn het i18next-meervoudsfamilies (`_one`/`_other`/…).
 *
 * Deze batterij bewaakt drie dingen, naar het model van `check-i18n-plurals.ts`:
 *   1. per taal EXACT de categorieën die `Intl.PluralRules` opgeeft, en geen kale sleutel meer (een
 *      ontbrekende categorie valt in i18next terug op het Engels, niet op `_other`);
 *   2. elke telling lost op zonder terugvaltaal en toont het getal — behalve de Arabische
 *      zero/one/two-vormen, die het getal in woorden dragen (zelfde conventie als de bestaande
 *      Arabische families in common.json);
 *   3. het eigenlijke gebrek: bij één item staat er enkelvoud ("1 taak", "1 task").
 */
import i18next from 'i18next';

import arCommon from '@/i18n/locales/ar/common.json';
import deCommon from '@/i18n/locales/de/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import esCommon from '@/i18n/locales/es/common.json';
import faCommon from '@/i18n/locales/fa/common.json';
import frCommon from '@/i18n/locales/fr/common.json';
import itCommon from '@/i18n/locales/it/common.json';
import jaCommon from '@/i18n/locales/ja/common.json';
import koCommon from '@/i18n/locales/ko/common.json';
import nlCommon from '@/i18n/locales/nl/common.json';
import plCommon from '@/i18n/locales/pl/common.json';
import ptCommon from '@/i18n/locales/pt/common.json';
import trCommon from '@/i18n/locales/tr/common.json';
import zhCommon from '@/i18n/locales/zh/common.json';
import arMenu from '@/i18n/locales/ar/menu.json';
import deMenu from '@/i18n/locales/de/menu.json';
import enMenu from '@/i18n/locales/en/menu.json';
import esMenu from '@/i18n/locales/es/menu.json';
import faMenu from '@/i18n/locales/fa/menu.json';
import frMenu from '@/i18n/locales/fr/menu.json';
import itMenu from '@/i18n/locales/it/menu.json';
import jaMenu from '@/i18n/locales/ja/menu.json';
import koMenu from '@/i18n/locales/ko/menu.json';
import nlMenu from '@/i18n/locales/nl/menu.json';
import plMenu from '@/i18n/locales/pl/menu.json';
import ptMenu from '@/i18n/locales/pt/menu.json';
import trMenu from '@/i18n/locales/tr/menu.json';
import zhMenu from '@/i18n/locales/zh/menu.json';

type Bundle = Record<string, unknown>;
const LOCALES: Record<string, { common: Bundle; menu: Bundle }> = {
  nl: { common: nlCommon, menu: nlMenu }, en: { common: enCommon, menu: enMenu },
  fr: { common: frCommon, menu: frMenu }, de: { common: deCommon, menu: deMenu },
  es: { common: esCommon, menu: esMenu }, zh: { common: zhCommon, menu: zhMenu },
  it: { common: itCommon, menu: itMenu }, pt: { common: ptCommon, menu: ptMenu },
  pl: { common: plCommon, menu: plMenu }, tr: { common: trCommon, menu: trMenu },
  ar: { common: arCommon, menu: arMenu }, ja: { common: jaCommon, menu: jaMenu },
  ko: { common: koCommon, menu: koMenu }, fa: { common: faCommon, menu: faMenu },
};

/** [namespace, pad] van elke teltekst; de parameters zijn die van de aanroeper. */
const KEYS = [
  ['common', 'recovery.taskCount', {}],
  ['common', 'resource.histogram.overallocatedTooltip', { date: '2026-06-01' }],
  ['menu', 'ribbon.overallocationCount', {}],
  ['menu', 'status.criticalPath', { duration: 12 }],
] as const;

/** Wat er bij één item hoort te staan — het gebrek zelf, in de twee brontalen. */
const SINGULAR: Record<string, Record<string, string>> = {
  nl: {
    'recovery.taskCount': '1 taak',
    'resource.histogram.overallocatedTooltip': '1 taak draagt bij op 2026-06-01',
    'ribbon.overallocationCount': '1 resource',
    'status.criticalPath': 'Kritiek pad: 1 taak, 12 werkdagen',
  },
  en: {
    'recovery.taskCount': '1 task',
    'resource.histogram.overallocatedTooltip': '1 task contributes on 2026-06-01',
    'ribbon.overallocationCount': '1 resource',
    'status.criticalPath': 'Critical path: 1 task, 12 work days',
  },
};

/** Tellingen die in ar en pl alle categorieën raken (zero/one/two/few/many/other). */
const PROBE_COUNTS = [0, 1, 2, 3, 5, 11, 22, 100];

const diffs: string[] = [];
let checks = 0;
const fail = (msg: string) => diffs.push(msg);

const parentOf = (bundle: Bundle, path: string): Record<string, unknown> => {
  let node: unknown = bundle;
  for (const part of path.split('.').slice(0, -1)) node = (node as Record<string, unknown>)?.[part];
  return (node ?? {}) as Record<string, unknown>;
};

// ── 1. Structuur ─────────────────────────────────────────────────────────────────────────────
for (const [loc, bundles] of Object.entries(LOCALES)) {
  const expected = new Set<string>(new Intl.PluralRules(loc).resolvedOptions().pluralCategories);
  for (const [ns, path] of KEYS) {
    checks++;
    const leaf = path.split('.').at(-1)!;
    const parent = parentOf(bundles[ns], path);
    if (leaf in parent) fail(`${loc}/${ns}:${path}: de kale sleutel bestaat nog naast de meervoudsvormen`);
    const found = new Set(
      Object.keys(parent).filter(k => k.startsWith(`${leaf}_`)).map(k => k.slice(leaf.length + 1)),
    );
    const missing = [...expected].filter(c => !found.has(c));
    const extra = [...found].filter(c => !expected.has(c));
    if (missing.length || extra.length) {
      fail(`${loc}/${ns}:${path}: ontbreekt [${missing.join(',')}] · overbodig [${extra.join(',')}] `
        + `(verwacht precies ${[...expected].sort().join(',')})`);
    }
  }
}

// ── 2 + 3. Runtime, zonder terugvaltaal ──────────────────────────────────────────────────────
// fallbackLng:false is het punt: met terugval zou een ontbrekende categorie stil Engels opleveren.
for (const [loc, bundles] of Object.entries(LOCALES)) {
  const inst = i18next.createInstance();
  await inst.init({
    lng: loc,
    fallbackLng: false,
    resources: { [loc]: bundles },
    ns: ['common', 'menu'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });
  const rules = new Intl.PluralRules(loc);

  for (const [ns, path, params] of KEYS) {
    for (const n of PROBE_COUNTS) {
      checks++;
      const out = inst.t(`${ns}:${path}`, { ...params, count: n });
      const cat = rules.select(n);
      const numberInWords = loc === 'ar' && (cat === 'zero' || cat === 'one' || cat === 'two');
      if (out === path || out === `${ns}:${path}` || out === '') {
        fail(`${loc}/${ns}:${path}: count=${n} (categorie "${cat}") lost niet op — zou in de app Engels tonen`);
      } else if (!numberInWords && !out.includes(String(n))) {
        fail(`${loc}/${ns}:${path}: count=${n} rendert zonder het getal — "${out}"`);
      }
    }
    const singular = SINGULAR[loc]?.[path];
    if (singular !== undefined) {
      checks++;
      const out = inst.t(`${ns}:${path}`, { ...params, count: 1 });
      if (out !== singular) fail(`${loc}/${ns}:${path}: bij één item "${out}", verwacht "${singular}"`);
    }
  }
}

if (diffs.length === 0) {
  console.log(`OK  count-labels-i18n: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  count-labels-i18n: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
