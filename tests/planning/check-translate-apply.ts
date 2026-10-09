/**
 * Vertaalstraat — samenvoegen (scripts/translate/apply.ts + ui.ts, ontwerp §9), basislijn en status.
 *
 * Bewaakt: alleen groene pakketten gaan erin; de volgorde wordt die van nl; sleutels buiten het
 * pakket blijven onaangeroerd; een nieuwe taal begint bij `{}`; de bron-hash per sleutel wordt
 * bijgewerkt (een familie = één hash), waarna --stale en status hem als actueel zien; in een nieuwe
 * taal (geen basislijn, Engelse vulling) telt tekst zonder hash als ontbrekend, ook bij i18n:add.
 */
import { applyUiBatch } from '../../scripts/translate/apply';
import { hashUnit } from '../../scripts/translate/common';
import {
  buildUiPackages, orderSources, seedSources, selectUnits, setSourceHash, uiStatus, updateSourceHashForAdd,
  type UiPackage, type UiSources,
} from '../../scripts/translate/ui';
import { serialize, type JsonObject } from '../../scripts/i18n-tools';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const nl: JsonObject = {
  a: 'Eerste',
  grp: { x: 'Iks', n_one: '{{count}} taak', n_other: '{{count}} taken' },
  z: 'Laatste',
};
const en: JsonObject = {
  a: 'First',
  grp: { x: 'Ex', n_one: '{{count}} task', n_other: '{{count}} tasks' },
  z: 'Last',
};

// ── 1. Nieuwe taal: alles ontbreekt, apply bouwt het bestand op in nl-volgorde ───────────────
{
  const packs = buildUiPackages({ lang: 'cs', inputs: [{ ns: 'common', nl, en, target: {} }], mode: 'missing', sources: {}, concepts: [], size: 2 });
  eq('2 pakketten van ≤ 2 items', packs.map(p => p.items.map(i => i.key)), [['a', 'grp.x'], ['grp.n', 'z']]);
  const outs: Record<string, unknown> = {
    'ui-common-01': { a: 'První', 'grp.x': 'Iks-cs' },
    'ui-common-02': { 'grp.n': { one: '{{count}} úkol', few: '{{count}} úkoly', many: '{{count}} úkolu', other: '{{count}} úkolů' }, z: 'Poslední' },
  };
  // Omgekeerde volgorde van toepassen: het resultaat volgt toch nl.
  const batch = [...packs].reverse().map(pkg => ({ pkg, out: outs[pkg.id] }));
  const sources: UiSources = {};
  const res = applyUiBatch(batch, () => ({}), { common: nl }, sources);
  eq('beide pakketten groen toegepast', [...res.applied].sort(), ['ui-common-01', 'ui-common-02']);
  const cs = res.targets.get('common')!;
  eq('volgorde van nl, familie in CLDR-volgorde', serialize(cs), serialize({
    a: 'První',
    grp: { x: 'Iks-cs', n_one: '{{count}} úkol', n_few: '{{count}} úkoly', n_many: '{{count}} úkolu', n_other: '{{count}} úkolů' },
    z: 'Poslední',
  }));
  eq('hash per sleutel; familie = één hash', orderSources(sources, { common: nl }).common, {
    a: hashUnit('Eerste'), 'grp.x': hashUnit('Iks'),
    'grp.n': hashUnit({ one: '{{count}} taak', other: '{{count}} taken' }), z: hashUnit('Laatste'),
  });
  eq('na apply: niets meer ontbreekt', selectUnits({ ns: 'common', nl, en, target: cs }, 'cs', 'missing', sources), []);
  eq('status na apply: alles actueel', uiStatus('cs', [{ ns: 'common', nl, en, target: cs }], sources),
    [{ ns: 'common', total: 4, missing: 0, stale: 0, current: 4, unhashed: 0 }]);
  ok('hashes in nl-volgorde', Object.keys(orderSources(sources, { common: nl }).common).join() === 'a,grp.x,grp.n,z');
}

// ── 2. Alleen groene pakketten; andere sleutels blijven onaangeroerd ─────────────────────────
{
  const existing: JsonObject = { a: 'Erste', grp: { x: 'X-de', n_one: '{{count}} Aufgabe', n_other: '{{count}} Aufgaben' }, z: 'Letzte', extra: 'bleibt' };
  const sources: UiSources = { common: { a: hashUnit('Oud'), z: hashUnit('Laatste') } };
  const green: UiPackage = {
    kind: 'ui', lang: 'de', namespace: 'common', id: 'ui-common-01', mode: 'stale', terms: [], tokens: [], keep: [],
    items: [{ key: 'a', nl: 'Eerste', en: 'First', previous: 'Erste' }],
  };
  const red: UiPackage = { ...green, id: 'ui-common-02', items: [{ key: 'z', nl: 'Laatste {{n}}', en: 'Last {{n}}' }] };
  const res = applyUiBatch([{ pkg: green, out: { a: 'Erstes' } }, { pkg: red, out: { z: 'Letzte' } }], () => structuredClone(existing), { common: nl }, sources);
  eq('alleen het groene pakket', res.applied, ['ui-common-01']);
  eq('rood pakket gemeld met zijn foutregel', res.red.map(r => [r.id, r.lines[0]]), [['ui-common-02', 'XX z: invulplekken (geen) ≠ nl {{n}}']]);
  const de = res.targets.get('common')!;
  eq('gewijzigd: alleen a', de.a, 'Erstes');
  eq('niet in een pakket: onaangeroerd', [de.z, (de.grp as JsonObject).x, de.extra], ['Letzte', 'X-de', 'bleibt']);
  eq('onbekende sleutel blijft achteraan', Object.keys(de), ['a', 'grp', 'z', 'extra']);
  eq('hash van a bijgewerkt, van z niet', [sources.common.a, sources.common.z], [hashUnit('Eerste'), hashUnit('Laatste')]);
  eq('niets toegepast → geen doelobject', applyUiBatch([{ pkg: red, out: {} }], () => ({}), { common: nl }, {}).targets.size, 0);
}

// ── 3. Basislijn en status ───────────────────────────────────────────────────────────────────
{
  // ar: zero/one/two/few/many/other; een halve familie is niet compleet → geen hash.
  const ar: JsonObject = { a: 'الأول', grp: { x: 'س', n_one: 'مهمة', n_other: '{{count}} مهمة' } };
  const seeded = seedSources('ar', [{ ns: 'common', nl, en, target: ar }]);
  eq('basislijn: alleen complete eenheden', Object.keys(seeded.common), ['a', 'grp.x']);
  const st = uiStatus('ar', [{ ns: 'common', nl, en, target: ar }], seeded)[0];
  eq('status: halve familie + ontbrekend = 2 ontbreekt', [st.missing, st.stale, st.current], [2, 0, 2]);
  const changed = { ...nl, a: 'Eerste (nieuw)' };
  const st2 = uiStatus('ar', [{ ns: 'common', nl: changed, en, target: ar }], seeded)[0];
  eq('status: gewijzigde nl = verouderd', [st2.missing, st2.stale, st2.current], [2, 1, 1]);
  const st3 = uiStatus('ar', [{ ns: 'common', nl, en, target: ar }], {})[0];
  eq('status: vertaald zonder hash telt als actueel, apart genoemd', [st3.current, st3.unhashed], [2, 2]);
}

// ── 4. i18n:add houdt de hash bij ───────────────────────────────────────────────────────────
{
  const s: UiSources = { task: { b: 'oud' } };
  setSourceHash(s, 'task', 'cols.total', 'Totaal');
  setSourceHash(s, 'menu', 'n', { other: '{{count}} x', one: 'één x' });
  eq('hash per namespace + sleutel', [s.task['cols.total'], s.task.b, s.menu.n], [hashUnit('Totaal'), 'oud', hashUnit({ one: 'één x', other: '{{count}} x' })]);
}

// ── 5. Nieuwe taal met Engelse vulling (geen basislijn) ─────────────────────────────────────
{
  // ru staat in de app eerst met Engels als tijdelijke inhoud: tekst zonder hash is geen vertaling.
  const ruFill: JsonObject = { a: 'First', grp: { x: 'X', n_one: '{{count}} task', n_few: '{{count}} tasks', n_many: '{{count}} tasks', n_other: '{{count}} tasks' }, z: 'Last' };
  const inputs = [{ ns: 'common', nl, en, target: ruFill }];
  eq('nieuwe taal, vulling zonder hash: --missing pakt alles op',
    selectUnits(inputs[0], 'ru', 'missing', {}).map(s => s.unit.key), ['a', 'grp.x', 'grp.n', 'z']);
  const st = uiStatus('ru', inputs, {})[0];
  eq('nieuwe taal, vulling zonder hash: status = alles ontbreekt', [st.missing, st.current, st.unhashed], [4, 0, 0]);
  const half: UiSources = { common: { a: hashUnit('Eerste') } };
  eq('nieuwe taal: alleen sleutels met hash gelden als vertaald',
    selectUnits(inputs[0], 'ru', 'missing', half).map(s => s.unit.key), ['grp.x', 'grp.n', 'z']);
  // Een bestaande taal houdt de oude regel: vertaald zonder hash telt als actueel.
  const de: JsonObject = { a: 'Erste', grp: { x: 'X', n_one: '{{count}} Aufgabe', n_other: '{{count}} Aufgaben' }, z: 'Letzte' };
  eq('bestaande taal zonder hash: --missing laat vertaalde tekst staan',
    selectUnits({ ns: 'common', nl, en, target: de }, 'de', 'missing', {}).map(s => s.unit.key), []);

  // i18n:add: een taal met basislijn krijgt de hash; een nieuwe taal verliest hem (tekst komt niet uit de straat).
  const deSrc: UiSources = {};
  eq('i18n:add, bestaande taal: hash gezet', [updateSourceHashForAdd(deSrc, 'de', 'common', 'a', 'Eerste'), deSrc.common?.a], [true, hashUnit('Eerste')]);
  const ruSrc: UiSources = { common: { a: hashUnit('Eerste'), z: 'x' } };
  eq('i18n:add, nieuwe taal: hash weg', [updateSourceHashForAdd(ruSrc, 'ru', 'common', 'a', 'Eerste (nieuw)'), Object.keys(ruSrc.common)], [true, ['z']]);
  const none: UiSources = {};
  eq('i18n:add, nieuwe taal zonder bronbestand: niets te schrijven', [updateSourceHashForAdd(none, 'sv', 'common', 'a', 'Eerste'), none], [false, {}]);
}

if (diffs.length === 0) {
  console.log(`OK  translate-apply: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-apply: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
