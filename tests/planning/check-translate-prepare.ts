/**
 * Vertaalstraat — UI-pakketten maken (scripts/translate/ui.ts, ontwerp §5.1 en §9).
 *
 * Bewaakt: eenheden en meervoudsfamilies, voorbeeldgetallen per CLDR-categorie (ook decimalen),
 * --missing (halve familie telt als ontbrekend; een nieuwe taal = alles), --stale (alleen gewijzigde
 * nl-hash, met de oude vertaling als `previous`), de pakketgrenzen (aantal en tekens), en dat alleen
 * de termen en tokens meegaan die in de items voorkomen.
 */
import {
  containsTerm, hashUnit, pluralExamples, unitsOf, type Concept, type LangTermbase,
} from '../../scripts/translate/common';
import { buildUiPackages, packageText, selectUnits, termsFor, type UiItem } from '../../scripts/translate/ui';
import type { JsonObject } from '../../scripts/i18n-tools';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

// ── 1. Eenheden: meervoudsfamilie = één eenheid ──────────────────────────────────────────────
{
  const nl: JsonObject = { a: 'A', g: { n_one: '{{count}} taak', n_other: '{{count}} taken', b: 'B' } };
  eq('eenheden in volgorde, familie samengevoegd', unitsOf(nl).map(u => [u.key, u.plural]),
    [['a', false], ['g.n', true], ['g.b', false]]);
  eq('familietekst per categorie', unitsOf(nl)[1].text, { one: '{{count}} taak', other: '{{count}} taken' });
  ok('hash van familie hangt niet af van de sleutelvolgorde',
    hashUnit({ other: 'x', one: 'y' }) === hashUnit({ one: 'y', other: 'x' }));
  ok('hash van tekst ≠ hash van familie met dezelfde tekst', hashUnit('x') !== hashUnit({ other: 'x' }));
}

// ── 2. Voorbeeldgetallen per categorie ───────────────────────────────────────────────────────
{
  const cs = pluralExamples('cs');
  eq('cs categorieën', Object.keys(cs), ['one', 'few', 'many', 'other']);
  eq('cs one', cs.one, [1]);
  eq('cs few', cs.few, [2, 3, 4]);
  ok('cs many is alleen decimaal (1.5)', cs.many.length > 0 && cs.many.every(n => !Number.isInteger(n)) && cs.many.includes(1.5));
  ok('cs other bevat 0 en 5', cs.other.includes(0) && cs.other.includes(5));
  const ru = pluralExamples('ru');
  ok('ru many = 0 en 5…', ru.many[0] === 0 && ru.many.includes(5));
  ok('ru one bevat 21', ru.one.includes(21));
  ok('ru other alleen decimalen', ru.other.length > 0 && ru.other.every(n => !Number.isInteger(n)));
  ok('ro few bevat 0 en 2', pluralExamples('ro').few.includes(0) && pluralExamples('ro').few.includes(2));
  eq('fr many = miljoenen', pluralExamples('fr').many, [1000000, 2000000]);
  eq('ja alleen other', Object.keys(pluralExamples('ja')), ['other']);
}

// ── 3. --missing / --stale / nieuwe taal ─────────────────────────────────────────────────────
{
  const nl: JsonObject = { a: 'Taak', b: 'Oud', f_one: '{{count}} taak', f_other: '{{count}} taken', c: 'Nieuw' };
  const en: JsonObject = { a: 'Task', b: 'Old', f_one: '{{count}} task', f_other: '{{count}} tasks', c: 'New' };
  // cs heeft one/few/many/other; alleen one + other = halve familie.
  const cs: JsonObject = { a: 'Úkol', b: 'Starý', f_one: '{{count}} úkol', f_other: '{{count}} úkolů' };
  const sources = { common: { a: hashUnit('Taak'), b: hashUnit('Nog ouder') } };
  const missing = selectUnits({ ns: 'common', nl, en, target: cs }, 'cs', 'missing', sources).map(s => s.unit.key);
  eq('--missing: halve familie + ontbrekende sleutel', missing, ['f', 'c']);
  const stale = selectUnits({ ns: 'common', nl, en, target: cs }, 'cs', 'stale', sources);
  eq('--stale: alleen de sleutel met afwijkende nl-hash', stale.map(s => s.unit.key), ['b']);
  eq('--stale: oude vertaling als previous', stale[0].previous, 'Starý');
  const fresh = selectUnits({ ns: 'common', nl, en, target: {} }, 'sv', 'missing', {}).map(s => s.unit.key);
  eq('nieuwe taal (geen map): alles ontbreekt', fresh, ['a', 'b', 'f', 'c']);
  const packs = buildUiPackages({ lang: 'cs', inputs: [{ ns: 'common', nl, en, target: cs }], mode: 'stale', sources, concepts: [] });
  eq('--stale-pakket draagt previous mee', packs[0].items, [{ key: 'b', nl: 'Oud', en: 'Old', previous: 'Starý' }]);
  ok('geen meervoud in de items → geen plural-veld', packs[0].plural === undefined);
}

// ── 4. Pakketgrenzen ─────────────────────────────────────────────────────────────────────────
{
  const nl: JsonObject = {};
  const en: JsonObject = {};
  for (let i = 0; i < 320; i++) { nl[`k${i}`] = `tekst ${i}`; en[`k${i}`] = `text ${i}`; }
  nl.m_one = '{{count}} ding'; nl.m_other = '{{count}} dingen';
  en.m_one = '{{count}} thing'; en.m_other = '{{count}} things';
  const packs = buildUiPackages({ lang: 'sv', inputs: [{ ns: 'task', nl, en, target: {} }], mode: 'missing', sources: {}, concepts: [] });
  eq('321 items → 150 + 150 + 21', packs.map(p => p.items.length), [150, 150, 21]);
  eq('ids per namespace genummerd', packs.map(p => p.id), ['ui-task-01', 'ui-task-02', 'ui-task-03']);
  const last = packs[2];
  eq('familie als één item met nl en en per categorie', last.items[last.items.length - 1],
    { key: 'm', plural: true, nl: { one: '{{count}} ding', other: '{{count}} dingen' }, en: { one: '{{count}} thing', other: '{{count}} things' } });
  eq('plural-voorbeelden van sv', last.plural, { one: [1], other: [0, 2, 3, 4] });
  const small = buildUiPackages({ lang: 'sv', inputs: [{ ns: 'task', nl, en, target: {} }], mode: 'missing', sources: {}, concepts: [], maxChars: 2000 });
  ok('tekengrens maakt meer, kleinere pakketten', small.length > 3 && small.every(p => p.items.reduce((s, i) => s + JSON.stringify(i).length, 0) <= 2000));
  const text = packageText(packs[0]);
  eq('pakkettekst is geldige JSON met dezelfde inhoud', JSON.parse(text), JSON.parse(JSON.stringify(packs[0])));
  eq('één item per regel', text.split('\n').filter(l => l.startsWith('    {"key"')).length, 150);
}

// ── 5. Termen en tokens: alleen wat in de items voorkomt ─────────────────────────────────────
{
  ok('woordgrens: "baseline" in "Save baseline"', containsTerm('Save baseline', 'baseline'));
  ok('meervoud: "baselines"', containsTerm('Clear baselines', 'baseline'));
  ok('nl-meervoud: "basislijnen"', containsTerm('Basislijnen wissen', 'basislijn'));
  ok('hoofdletterongevoelig', containsTerm('Total Float', 'total float'));
  ok('geen treffer midden in een woord', !containsTerm('Baselineview', 'baseline') && !containsTerm('Rebaseline', 'baseline'));
  const concepts: Concept[] = [
    { id: 'total-float', kind: 'term', nl: 'totale speling', en: ['total float', 'total slack'], definition: 'd' },
    { id: 'baseline', kind: 'term', nl: 'basislijn', en: ['baseline'], definition: 'd' },
    { id: 'critical-path', kind: 'term', nl: 'kritiek pad', en: ['critical path'], definition: 'd' },
    { id: 'rel-fs', kind: 'token', nl: 'FS', en: ['FS'], definition: 'd' },
    { id: 'rel-ss', kind: 'token', nl: 'SS', en: ['SS'], definition: 'd' },
    { id: 'ifc', kind: 'keep', nl: 'IFC', en: ['IFC'], definition: 'd' },
  ];
  const tb: LangTermbase = {
    _style: { address: 'formal' },
    'total-float': { term: 'celková časová rezerva', forms: ['celková časová rezerva', 'celkové časové rezervy'], source: 'tbx', status: 'tbx' },
    baseline: { term: 'směrný plán', forms: ['směrný plán', 'směrného plánu'], avoid: ['základní plán'], source: 'tbx', status: 'tbx-chosen' },
  };
  const items: UiItem[] = [
    { key: 'a', nl: 'Totale speling', en: 'Total float' },
    { key: 'b', nl: 'Relatie 1.2 FS+2d', en: 'Relation 1.2 FS+2d' },
    { key: 'c', nl: 'Exporteren naar IFC', en: 'Export to IFC' },
    { key: 'd', nl: 'Kritiek pad', en: 'Critical path' },
  ];
  eq('alleen termen met een regel in de termbase én in de items',
    termsFor(items, concepts, tb).map(t => t.id), ['total-float']);
  eq('match ook op het en-synoniem', termsFor([{ key: 'x', nl: 'Speling', en: 'Total slack' }], concepts, tb).map(t => t.id), ['total-float']);
  const packs = buildUiPackages({
    lang: 'cs', concepts, termbase: tb, mode: 'missing', sources: {},
    inputs: [{ ns: 'task', nl: { a: 'Totale speling', b: 'Relatie 1.2 FS+2d', c: 'Exporteren naar IFC' }, en: { a: 'Total float', b: 'Relation 1.2 FS+2d', c: 'Export to IFC' }, target: {} }],
  });
  eq('term in pakket met doelterm, vormen en definitie', packs[0].terms, [{ id: 'total-float', nl: 'totale speling', en: ['total float', 'total slack'], target: 'celková časová rezerva', forms: ['celková časová rezerva', 'celkové časové rezervy'], definition: 'd' }]);
  eq('alleen gebruikte tokens', packs[0].tokens, ['FS']);
  eq('keep-namen apart', packs[0].keep, ['IFC']);
  eq('stijl uit _style', packs[0].style, { address: 'formal' });
}

if (diffs.length === 0) {
  console.log(`OK  translate-prepare: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-prepare: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
