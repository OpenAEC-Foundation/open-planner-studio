/**
 * Vertaalstraat — termen herstellen: `prepare ui --avoid` / `--keys` (scripts/translate/ui.ts) en
 * `apply-findings` (scripts/translate/findings.ts), plus `_style.quotes` (termbase.ts).
 *
 * Bewaakt: --avoid vindt een avoid-variant met dezelfde regel als de zachte poort (eerst de vormen van de
 * term wegstrepen, hoofdletterongevoelig), slaat onvertaalde eenheden over, geeft `previous`, `avoidHits`,
 * `stale` en `reason: "avoid"` mee en neemt de term mee ook als hij niet in de bron staat; --avoid --stale
 * is de vereniging; --keys kiest precies de genoemde eenheden; apply-findings past goede regels toe en
 * slaat foute over (invulplekken, $t, categorieën, tokens, leeg, onleesbaar, onbekend, nog onvertaald),
 * leest meervoudsvormen die als tekst binnenkomen, en houdt de nl-volgorde aan.
 */
import { findAvoid, hashUnit, type Concept, type LangTermbase } from '../../scripts/translate/common';
import { applyFindings, parsePluralText } from '../../scripts/translate/findings';
import { checkUi } from '../../scripts/translate/gates';
import { styleErrors } from '../../scripts/translate/termbase';
import { buildUiPackages, resolveKeyList, selectAvoid, avoidRules, type UiSources } from '../../scripts/translate/ui';
import { serialize, type JsonObject } from '../../scripts/i18n-tools';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const concepts: Concept[] = [
  { id: 'critical-path', kind: 'term', nl: 'kritiek pad', en: ['critical path'], definition: 'd' },
  { id: 'free-float', kind: 'term', nl: 'vrije speling', en: ['free float'], definition: 'd' },
  { id: 'baseline', kind: 'term', nl: 'basislijn', en: ['baseline'], definition: 'd' },
  { id: 'rel-fs', kind: 'token', nl: 'FS', en: ['FS'], definition: 'd' },
];
const tb: LangTermbase = {
  _style: { address: 'formal', quotes: '„…“' },
  'critical-path': { term: 'kritični put', forms: ['kritični put', 'kritičnog puta', 'kritičnom putu'], avoid: ['ključni put'], source: 'tbx', status: 'tbx' },
  'free-float': { term: 'fri slakk', forms: ['fri slakk'], avoid: ['slakk'], source: 'tbx', status: 'tbx' },
  baseline: { term: 'osnovni plan', forms: ['osnovni plan', 'osnovnog plana'], source: 'tbx', status: 'tbx' },
};

// ── 1. Dezelfde avoid-regel als de zachte poort ──────────────────────────────────────────────
{
  eq('hoofdletterongevoelig', findAvoid('Prikaži Ključni put', ['kritični put'], ['ključni put']), ['ključni put']);
  eq('vorm van de term eerst weggestreept ("fri slakk" ⊃ "slakk")', findAvoid('Vis fri slakk', ['fri slakk'], ['slakk']), []);
  eq('losse avoid naast de term telt wel', findAvoid('Fri slakk og slakk', ['fri slakk'], ['slakk']), ['slakk']);
  eq('geen treffer', findAvoid('Kritični put', ['kritični put'], ['ključni put']), []);
  eq('alleen als los woord: sr "лаг" in "Прилагођено"', findAvoid('Прилагођено', ['кашњење'], ['лаг']), []);
  eq('alleen als los woord: ro "actual" in "actualizați"', findAvoid('Vă rugăm să actualizați', ['curent'], ['actual']), []);
  eq('echte treffer als los woord (Cyrillisch)', findAvoid('Прикажи лаг задатка', ['кашњење'], ['лаг']), ['лаг']);
  eq('zh/ja/ko: deeltekst blijft', findAvoid('显示滞后时间', ['延迟'], ['滞后']), ['滞后']);
  const pkg = {
    kind: 'ui' as const, lang: 'hr', namespace: 'task', id: 'x', mode: 'missing' as const, tokens: [], keep: [],
    terms: [{ id: 'critical-path', nl: 'kritiek pad', en: ['critical path'], target: 'kritični put', forms: ['kritični put'], avoid: ['ključni put'] }],
    items: [{ key: 'a', nl: 'Kritiek pad tonen', en: 'Show critical path' }],
  };
  ok('zachte poort waarschuwt nog steeds', checkUi(pkg, { a: 'Prikaži ključni put' }).warnings.some(w => w.includes('vermijd "ključni put"')));
}

// ── 2. --avoid ───────────────────────────────────────────────────────────────────────────────
const nl: JsonObject = {
  a: 'Kritiek pad tonen', b: 'Vrije speling', c: 'Opslaan', d: 'Basislijn', e: 'Nog niet vertaald',
  f_one: '{{count}} kritieke taak', f_other: '{{count}} kritieke taken',
};
const en: JsonObject = {
  a: 'Show critical path', b: 'Free float', c: 'Save', d: 'Baseline', e: 'Not yet translated',
  f_one: '{{count}} critical task', f_other: '{{count}} critical tasks',
};
const hr: JsonObject = {
  a: 'Prikaži Ključni put', b: 'Fri slakk', c: 'Spremi', d: 'Osnovni plan',
  f_one: '{{count}} zadatak na ključni put', f_few: '{{count}} zadatka', f_other: '{{count}} zadataka',
};
const sources: UiSources = { task: {
  a: hashUnit('Kritiek pad tonen'), b: hashUnit('Vrije speling'), c: hashUnit('Opslaan (oud)'), d: hashUnit('Basislijn'),
  f: hashUnit({ one: '{{count}} kritieke taak', other: '{{count}} kritieke taken' }),
} };
const input = { ns: 'task', nl, en, target: hr };
{
  const rules = avoidRules(concepts, tb);
  eq('alleen termen met avoid', rules.map(r => r.id), ['critical-path', 'free-float']);
  const sel = selectAvoid(input, 'hr', sources, rules, false);
  eq('--avoid: a en de familie f; b niet (avoid zit in de term zelf)', sel.map(s => s.unit.key), ['a', 'f']);
  eq('previous = huidige tekst', sel[0].previous, 'Prikaži Ključni put');
  eq('avoidHits = de varianten zoals in de termbase', sel[0].avoidHits, ['ključni put']);
  ok('actuele eenheid niet stale', sel[0].stale === undefined);
  const both = selectAvoid(input, 'hr', sources, rules, true);
  eq('--avoid --stale: vereniging in nl-volgorde', both.map(s => [s.unit.key, s.avoidHits ?? null, s.stale ?? null]),
    [['a', ['ključni put'], null], ['c', null, true], ['f', ['ključni put'], null]]);
  const noHash = selectAvoid(input, 'hr', { task: {} }, rules, false);
  eq('nieuwe taal: tekst zonder hash = Engelse vulling, niet geselecteerd', noHash.map(s => s.unit.key), []);
  const stale = selectAvoid({ ...input }, 'de', { task: { a: hashUnit('anders') } }, rules, false);
  eq('verouderde eenheid met avoid krijgt stale', stale.filter(s => s.unit.key === 'a').map(s => s.stale), [true]);

  const packs = buildUiPackages({ lang: 'hr', inputs: [input], mode: 'missing', sources, concepts, termbase: tb, avoid: true });
  eq('één pakket', packs.length, 1);
  eq('reason avoid, mode avoid', [packs[0].reason, packs[0].mode], ['avoid', 'avoid']);
  eq('items met previous en avoidHits', packs[0].items[0], { key: 'a', nl: 'Kritiek pad tonen', en: 'Show critical path', previous: 'Prikaži Ključni put', avoidHits: ['ključni put'] });
  eq('term mee (bron + avoid)', packs[0].terms.map(t => t.id), ['critical-path']);
  eq('style met quotes', packs[0].style, { address: 'formal', quotes: '„…“' });
  const viaHit = buildUiPackages({
    lang: 'hr', concepts, termbase: tb, avoid: true, mode: 'missing', inputs: [{ ns: 'task', nl: { x: 'Weergave' }, en: { x: 'View' }, target: { x: 'Ključni put prikaz' } }],
    sources: { task: { x: hashUnit('Weergave') } },
  });
  eq('term mee als alleen de avoid-variant in de vertaling staat', viaHit[0].terms.map(t => t.id), ['critical-path']);
  const ws = buildUiPackages({ lang: 'hr', inputs: [input], mode: 'stale', sources, concepts, termbase: tb, avoid: true });
  eq('--avoid --stale: mode stale, reason avoid', [ws[0].mode, ws[0].reason, ws[0].items.length], ['stale', 'avoid', 3]);
  let threw = false;
  try { buildUiPackages({ lang: 'hr', inputs: [input], mode: 'all', sources, concepts, termbase: tb, avoid: true }); } catch { threw = true; }
  ok('--avoid --all geweigerd', threw);
  const plain = buildUiPackages({ lang: 'hr', inputs: [input], mode: 'stale', sources, concepts, termbase: tb });
  ok('gewoon --stale: geen reason, geen avoidHits', plain[0].reason === undefined && plain[0].items.every(i => i.avoidHits === undefined));
}

// ── 3. --keys ────────────────────────────────────────────────────────────────────────────────
{
  const r = resolveKeyList(['task:a', 'task:f_few', 'task:e', 'task:zz', 'xx:a', 7], { task: nl });
  eq('geldige sleutels; meervoudsvorm = familie', [...(r.keys.get('task') ?? [])], ['a', 'f', 'e']);
  eq('fouten per foute regel', r.errors.length, 3);
  eq('geen lijst', resolveKeyList({ a: 1 }, { task: nl }).errors.length, 1);
  const packs = buildUiPackages({ lang: 'hr', inputs: [input], mode: 'missing', sources, concepts, termbase: tb, keys: r.keys });
  eq('--keys: precies die eenheden in nl-volgorde', packs[0].items.map(i => i.key), ['a', 'e', 'f']);
  eq('mode keys, geen reason', [packs[0].mode, packs[0].reason ?? null], ['keys', null]);
  eq('previous waar er een vertaling is', packs[0].items.map(i => i.previous !== undefined), [true, false, true]);
}

// ── 4. apply-findings ────────────────────────────────────────────────────────────────────────
{
  eq('JSON-object als tekst', parsePluralText('{"one": "a", "few": "b"}'), { one: 'a', few: 'b' });
  eq('losse schrijfwijze', parsePluralText(`{one: "{{count}} \\"x\\"", few: 'b', other: "c"}`), { one: '{{count}} "x"', few: 'b', other: 'c' });
  eq('geen object', parsePluralText('gewone tekst'), null);
  eq('rommel tussen de paren', parsePluralText('{one: "a", zomaar, few: "b"}'), null);
  eq('dubbele categorie', parsePluralText('{one: "a", one: "b"}'), null);

  const nlC: JsonObject = {
    z: 'Laatste', a: 'Taak {{name}} opslaan', n: '$t(common:x) en meer', r: 'Relatie FS', e: 'Leeg',
    g: { k_one: '{{count}} taak', k_other: '{{count}} taken' },
  };
  const enC: JsonObject = {
    z: 'Last', a: 'Save task {{name}}', n: '$t(common:x) and more', r: 'Relation FS', e: 'Empty',
    g: { k_one: '{{count}} task', k_other: '{{count}} tasks' },
  };
  const hrC: JsonObject = {
    a: 'Spremi zadatak {{name}}', z: 'Zadnji', n: '$t(common:x) i više', r: 'Veza FS', e: 'Prazno',
    g: { k_one: '{{count}} zadatak', k_few: '{{count}} zadatka', k_other: '{{count}} zadataka' },
  };
  const findings = [
    { key: 'task:a', fix: 'Pohrani zadatak {{name}}' },                                  // goed
    { key: 'task:z', fix: 'Posljednji' },                                                // goed
    { key: 'task:n', fix: 'i više' },                                                    // $t ontbreekt
    { key: 'task:r', fix: 'Veza ZP' },                                                   // token FS ontbreekt
    { key: 'task:e', fix: '  ' },                                                        // leeg
    { key: 'task:a', fix: 'Pohrani {{naam}}' },                                          // verkeerde invulplek
    { key: 'task:g.k', fix: '{one: "{{count}} posao", few: "{{count}} posla", other: "{{count}} poslova"}' }, // tekst → vormen
    { key: 'task:g.k_few', fix: '{{count}} posla!' },                                    // één vorm via _few
    { key: 'task:g.k', fix: { one: '{{count}} x', two: '{{count}} y' } },                 // two bestaat niet in hr
    { key: 'task:g.k', fix: 'geen vormen' },                                             // onleesbaar
    { key: 'task:onbekend', fix: 'x' },                                                  // niet in nl
    { key: 'zz:a', fix: 'x' },                                                           // onbekende namespace
    { key: 'task:z', fix: { one: 'x' } },                                                // vormen bij gewone sleutel
    { fix: 'zonder sleutel' },                                                           // geen key
  ];
  const res = applyFindings({ lang: 'hr', findings, nl: { task: nlC }, en: { task: enC }, readTarget: () => structuredClone(hrC), concepts, termbase: tb });
  eq('toegepast', res.applied, ['task:a', 'task:z', 'task:g.k', 'task:g.k']);
  eq('overgeslagen', res.skipped.map(s => s.key), ['task:n', 'task:r', 'task:e', 'task:a', 'task:g.k', 'task:g.k', 'task:onbekend', 'zz:a', 'task:z', 'regel 14']);
  ok('reden $t genoemd', res.skipped[0].reasons.some(r => r.includes('$t(')));
  ok('reden token genoemd', res.skipped[1].reasons.some(r => r.includes('token "FS"')));
  ok('reden invulplek genoemd', res.skipped[3].reasons.some(r => r.includes('invulplekken')));
  ok('reden categorie genoemd', res.skipped[4].reasons.some(r => r.includes('two')));
  const out = res.targets.get('task')!;
  eq('nl-volgorde, toegepaste tekst, rest ongemoeid', serialize(out), serialize({
    z: 'Posljednji', a: 'Pohrani zadatak {{name}}', n: '$t(common:x) i više', r: 'Veza FS', e: 'Prazno',
    g: { k_one: '{{count}} posao', k_few: '{{count}} posla!', k_other: '{{count}} poslova' },
  }));

  const noTr = applyFindings({ lang: 'hr', findings: [{ key: 'task:a', fix: 'Pohrani {{name}}' }], nl: { task: nlC }, en: { task: enC }, readTarget: () => ({}), concepts });
  eq('nog geen vertaling: overslaan (werk voor prepare ui)', [noTr.applied.length, noTr.skipped.length], [0, 1]);
  eq('geen lijst', applyFindings({ lang: 'hr', findings: {}, nl: { task: nlC }, en: { task: enC }, readTarget: () => ({}), concepts }).skipped.length, 1);
  const warn = applyFindings({ lang: 'hr', findings: [{ key: 'task:a', fix: 'Ključni put {{name}}' }], nl: { task: { a: 'Kritiek pad {{name}}' } }, en: { task: { a: 'Critical path {{name}}' } }, readTarget: () => ({ a: 'Kritični put {{name}}' }), concepts, termbase: tb });
  ok('zachte waarschuwing wordt gemeld, regel wel toegepast', warn.applied.length === 1 && warn.warnings.some(w => w.includes('vermijd')));
}

// ── 5. _style.quotes ─────────────────────────────────────────────────────────────────────────
{
  eq('quotes als tekst mag', styleErrors({ address: 'formal', quotes: '„…“' }, 'hr'), []);
  eq('quotes geen tekst', styleErrors({ address: 'formal', quotes: 3 }, 'hr'), ['hr: _style.quotes moet tekst zijn']);
}

if (diffs.length === 0) {
  console.log(`OK  translate-termfix: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-termfix: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
