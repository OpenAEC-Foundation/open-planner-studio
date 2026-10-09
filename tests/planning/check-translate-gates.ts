/**
 * Vertaalstraat — de poorten van check.mjs (scripts/translate/gates.ts, ontwerp §7) en de
 * termbase-validatie (scripts/translate/termbase.ts, §4.1).
 *
 * Elke harde poort krijgt een goed en een fout voorbeeld: sleutels exact, soort (tekst/familie),
 * CLDR-categorieën exact (cs met `many`), {{invulplekken}} gelijk aan nl ({{count}} mag in een
 * meervoudsvorm uitgeschreven), $t(…) byte-gelijk, geen lege tekst, tokens aanwezig. Daarna de
 * zachte waarschuwingen en de schema's van de concepten-, termen- en blinde-controle-uitvoer.
 */
import { checkPackage, checkUi, formatResult } from '../../scripts/translate/gates';
import { sharesStem, validateLangTermbase } from '../../scripts/translate/termbase';
import type { UiPackage } from '../../scripts/translate/ui';
import type { TermsPackage } from '../../scripts/translate/tbx';
import type { Concept } from '../../scripts/translate/common';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const pkg = (lang: string, items: UiPackage['items'], extra: Partial<UiPackage> = {}): UiPackage => ({
  kind: 'ui', lang, namespace: 'common', id: 'ui-common-01', mode: 'missing', terms: [], tokens: [], keep: [], items, ...extra,
});
const errorsOf = (p: UiPackage, out: unknown) => checkUi(p, out).errors;
const has = (errs: string[], part: string) => errs.some(e => e.includes(part));

// ── 1. Sleutels exact ────────────────────────────────────────────────────────────────────────
{
  const p = pkg('sv', [{ key: 'a', nl: 'Taak', en: 'Task' }, { key: 'b', nl: 'Taken', en: 'Tasks' }]);
  eq('goed: precies de sleutels', errorsOf(p, { a: 'Uppgift', b: 'Uppgifter' }), []);
  const bad = errorsOf(p, { a: 'Uppgift', c: 'Extra' });
  ok('fout: ontbrekende sleutel', has(bad, 'b: ontbreekt'));
  ok('fout: extra sleutel', has(bad, 'c: sleutel staat niet in het pakket'));
  ok('fout: geen object', has(errorsOf(p, ['x']), 'verwacht een object'));
  ok('fout: familie waar tekst hoort', has(errorsOf(p, { a: { other: 'x' }, b: 'y' }), 'a: verwacht één tekst'));
}

// ── 2. CLDR-categorieën exact (cs met many) ──────────────────────────────────────────────────
{
  const item = {
    key: 'moved', plural: true as const,
    nl: { one: '{{count}} taak verplaatst', other: '{{count}} taken verplaatst' },
    en: { one: '{{count}} task moved', other: '{{count}} tasks moved' },
  };
  const p = pkg('cs', [item]);
  const good = { moved: { one: '{{count}} úkol přesunut', few: '{{count}} úkoly přesunuty', many: '{{count}} úkolu přesunuto', other: '{{count}} úkolů přesunuto' } };
  eq('goed: cs one/few/many/other', errorsOf(p, good), []);
  const noMany = { moved: { one: good.moved.one, few: good.moved.few, other: good.moved.other } };
  ok('fout: cs zonder many', has(errorsOf(p, noMany), 'ontbreekt many'));
  const extraTwo = { moved: { ...good.moved, two: 'x {{count}}' } };
  ok('fout: cs met overbodige two', has(errorsOf(p, extraTwo), 'overbodig two'));
  ok('fout: tekst waar familie hoort', has(errorsOf(p, { moved: 'x' }), 'verwacht meervoudsvormen'));
  eq('goed: ja alleen other', errorsOf(pkg('ja', [item]), { moved: { other: '{{count}} 件のタスクを移動しました' } }), []);
  ok('fout: ja met one', has(errorsOf(pkg('ja', [item]), { moved: { one: 'x', other: '{{count}} y' } }), 'overbodig one'));
  eq('goed: {{count}} mag in een meervoudsvorm uitgeschreven (ar)', errorsOf(pkg('ar', [item]), {
    moved: { zero: 'لم يتم نقل أي مهمة', one: 'تم نقل مهمة واحدة', two: 'تم نقل مهمتين', few: '{{count}} مهام', many: '{{count}} مهمة', other: '{{count}} مهمة' },
  }), []);
}

// ── 3. {{invulplekken}} gelijk aan nl ────────────────────────────────────────────────────────
{
  const p = pkg('sv', [{ key: 'opened', nl: '{{name}} geopend op {{date}}', en: '{{name}} opened on {{date}}' }]);
  eq('goed: zelfde invulplekken (andere volgorde mag)', errorsOf(p, { opened: '{{date}}: {{name}} öppnad' }), []);
  ok('fout: ontbrekende {{date}}', has(errorsOf(p, { opened: '{{name}} öppnad' }), 'invulplekken {{name}} ≠ nl {{date}}, {{name}}'));
  ok('fout: vertaalde naam {{namn}}', has(errorsOf(p, { opened: '{{namn}} öppnad {{date}}' }), 'invulplekken'));
  const c = pkg('sv', [{ key: 'n', nl: '{{count}} taken', en: '{{count}} tasks' }]);
  ok('fout: {{count}} weglaten in een gewone tekst mag niet', has(errorsOf(c, { n: 'uppgifter' }), 'invulplekken'));
}

// ── 4. $t(…) byte-gelijk ─────────────────────────────────────────────────────────────────────
{
  const nl = "De constraint $t(task:constraintType.{{type}}) bepaalt de start van '{{name}}'.";
  const p = pkg('cs', [{ key: 'blocked', nl, en: "The constraint $t(task:constraintType.{{type}}) determines the start of '{{name}}'." }]);
  eq('goed: $t ongewijzigd', errorsOf(p, { blocked: "Omezení $t(task:constraintType.{{type}}) určuje začátek '{{name}}'." }), []);
  ok('fout: vertaalde sleutel in $t', has(errorsOf(p, { blocked: "Omezení $t(task:typOmezeni.{{type}}) určuje začátek '{{name}}'." }), '$t(…) moet byte-gelijk'));
  ok('fout: $t weggelaten', has(errorsOf(p, { blocked: "Omezení {{type}} určuje začátek '{{name}}'." }), '$t(…) moet byte-gelijk'));
  ok('fout: spatie in $t', has(errorsOf(p, { blocked: "Omezení $t( task:constraintType.{{type}}) '{{name}}'." }), '$t(…) moet byte-gelijk'));
}

// ── 5. Geen lege tekst; tokens aanwezig ──────────────────────────────────────────────────────
{
  const p = pkg('cs', [{ key: 'e', nl: 'Leeg', en: 'Empty' }]);
  ok('fout: lege tekst', has(errorsOf(p, { e: '' }), 'lege tekst'));
  ok('fout: alleen spaties', has(errorsOf(p, { e: '   ' }), 'lege tekst'));
  const fam = pkg('cs', [{ key: 'f', plural: true, nl: { one: '{{count}} x', other: '{{count}} x' }, en: { one: '{{count}} x', other: '{{count}} x' } }]);
  ok('fout: lege meervoudsvorm', has(errorsOf(fam, { f: { one: '{{count}} a', few: '{{count}} b', many: '', other: '{{count}} c' } }), 'f.many: lege tekst'));
  const t = pkg('cs', [{ key: 'hint', nl: 'Typ bijvoorbeeld 1.2 FS+2d', en: 'Type for example 1.2 FS+2d' }], { tokens: ['FS'] });
  eq('goed: token blijft', errorsOf(t, { hint: 'Zadejte například 1.2 FS+2d' }), []);
  ok('fout: token vertaald', has(errorsOf(t, { hint: 'Zadejte například 1.2 KZ+2d' }), 'token "FS" ontbreekt'));
}

// ── 6. Zachte waarschuwingen (geen fout) ─────────────────────────────────────────────────────
{
  const p = pkg('cs', [
    { key: 'cp', nl: 'Kritiek pad tonen', en: 'Show critical path' },
    { key: 'bl', nl: 'Basislijn opslaan', en: 'Save baseline' },
    { key: 'st', nl: 'Status', en: 'Status' },
    { key: 'lg', nl: 'Opslaan', en: 'Save' },
    { key: 'ifc', nl: 'Exporteren naar IFC', en: 'Export to IFC' },
  ], {
    terms: [
      { id: 'critical-path', nl: 'kritiek pad', en: ['critical path'], target: 'kritická cesta', forms: ['kritická cesta', 'kritickou cestu'] },
      { id: 'baseline', nl: 'basislijn', en: ['baseline'], target: 'směrný plán', forms: ['směrný plán'], avoid: ['základní plán'] },
    ],
    keep: ['IFC'],
  });
  const r = checkUi(p, { cp: 'Zobrazit kritický řetěz', bl: 'Uložit základní plán', st: 'Status', lg: 'Uložit všechny změny do souboru projektu', ifc: 'Exportovat do formátu ИФЦ' });
  eq('zachte punten zijn geen fouten', r.errors, []);
  ok('waarschuwing: term niet in een van de vormen', has(r.warnings, 'cp: term "kritická cesta"'));
  ok('waarschuwing: avoid-treffer', has(r.warnings, 'bl: vermijd "základní plán"'));
  const q = pkg('nb', [{ key: 'ff', nl: 'Vrije speling', en: 'Free float' }], {
    terms: [{ id: 'free-float', nl: 'vrije speling', en: ['free float'], target: 'fri slakk', forms: ['fri slakk'], avoid: ['slakk'] }],
  });
  ok('geen valse avoid-waarschuwing als de variant in de eigen term zit',
    !checkUi(q, { ff: 'Fri slakk' }).warnings.some(w => w.includes('vermijd')));
  ok('wel een avoid-waarschuwing buiten de eigen term', has(checkUi(q, { ff: 'Slakk' }).warnings, 'vermijd "slakk"'));
  ok('waarschuwing: gelijk aan en', has(r.warnings, 'st: gelijk aan en'));
  ok('waarschuwing: veel langer dan en', has(r.warnings, 'lg: ') && has(r.warnings, '>1,6×'));
  ok('waarschuwing: eigennaam niet letterlijk', has(r.warnings, 'ifc: eigennaam "IFC"'));
  const good = checkUi(p, { cp: 'Zobrazit kritickou cestu', bl: 'Uložit směrný plán', st: 'Stav', lg: 'Uložit', ifc: 'Exportovat do IFC' });
  eq('goede vertaling: geen waarschuwingen', good.warnings, []);
  const lines = formatResult('ui-common-01', r);
  ok('uitvoer: één regel per punt + slotregel GROEN', lines.length === r.warnings.length + 1 && lines[lines.length - 1].startsWith('GROEN'));
  const red = formatResult('x', { errors: ['a: ontbreekt'], warnings: [] });
  eq('uitvoer bij fout', red, ['XX a: ontbreekt', 'ROOD x: 1 fout(en), 0 waarschuwing(en) — herstel de XX-regels']);
}

// ── 7. Schema's van concepten-, termen- en blinde-controle-uitvoer ──────────────────────────
{
  const concept = { id: 'total-float', kind: 'term', nl: 'totale speling', en: ['total float', 'total slack'], enBySource: { msp: 'total slack' }, definition: 'Slack.' };
  eq('concepten: goed', checkPackage({ kind: 'concepts', id: 'candidates-01' }, [concept]).errors, []);
  const bad = checkPackage({ kind: 'concepts' }, [{ ...concept, id: 'Total Float', kind: 'word', en: 'total float' }, { ...concept, enBySource: { p6: 'float' } }]).errors;
  ok('concepten: id niet kebab-case', has(bad, 'kebab-case'));
  ok('concepten: onbekend kind', has(bad, 'kind moet term, token of keep'));
  ok('concepten: en geen lijst', has(bad, 'en moet een niet-lege lijst'));
  ok('concepten: enBySource buiten en', has(bad, 'enBySource.p6 "float" staat niet in en'));
  ok('concepten: dubbel id', has(checkPackage({ kind: 'concepts' }, [concept, concept]).errors, 'dubbel id'));

  const tp: TermsPackage = {
    kind: 'terms', lang: 'cs', id: 'terms-01', existingUi: false,
    concepts: [
      { id: 'total-float', kind: 'term', nl: 'totale speling', en: ['total float'], definition: 'd', candidates: [{ en: 'total slack', term: 'celková časová rezerva' }] },
      { id: 'gap', kind: 'term', nl: 'gat', en: ['gap'], definition: 'd', candidates: [] },
    ],
  };
  const goodTerms = {
    _style: { address: 'formal' },
    'total-float': { term: 'celková časová rezerva', forms: ['celková časová rezerva', 'celkové časové rezervy'], source: 'tbx', status: 'tbx' },
    gap: { term: 'mezera', forms: ['mezera', 'mezery'], source: 'model', status: 'model' },
  };
  const r = checkPackage(tp, goodTerms);
  eq('termen: goed', r.errors, []);
  ok('termen: model krijgt een waarschuwing (blinde controle)', has(r.warnings, 'gap: status model'));
  const badTerms = checkPackage(tp, {
    'total-float': { term: 'celkový skluz', forms: ['celkový skluz', 'rezerva'], source: 'tbx', status: 'tbx' },
    gap: { term: 'mezera', forms: ['mezera'], source: 'x', status: 'existing-ui' },
    extra: { term: 'x', forms: ['x'], source: 'x', status: 'model' },
  }).errors;
  ok('termen: _style ontbreekt', has(badTerms, '_style ontbreekt'));
  ok('termen: tbx-term niet bij de kandidaten', has(badTerms, 'staat niet bij de kandidaten'));
  ok('termen: vorm zonder gedeelde stam', has(badTerms, 'vorm "rezerva" deelt geen stam'));
  ok('termen: existing-ui bij een nieuwe taal', has(badTerms, 'existing-ui kan alleen bij een bestaande taal'));
  ok('termen: onbekend concept', has(badTerms, 'extra: concept staat niet in het pakket'));

  const cp = { kind: 'terms-check', lang: 'cs', id: 'terms-check-01', items: [{ id: 't1', term: 'mezera' }] };
  eq('blinde controle: goed', checkPackage(cp, { t1: { backTranslation: 'gap', standard: true } }).errors, []);
  ok('blinde controle: standard ontbreekt', has(checkPackage(cp, { t1: { backTranslation: 'gap' } }).errors, 'standard moet true of false'));
  ok('onbekend pakket', has(checkPackage({ kind: 'docs' }, {}).errors, 'onbekend kind'));
}

// ── 8. Termbase-validatie en stam ────────────────────────────────────────────────────────────
{
  ok('stam: cs verbuiging', sharesStem('celková časová rezerva', 'celkové časové rezervy'));
  ok('stam: fi polku → polun', sharesStem('polku', 'polun'));
  ok('stam: de Gesamtpuffer → Gesamtpuffers', sharesStem('Gesamtpuffer', 'Gesamtpuffers'));
  ok('stam: ar lidwoord ervoor', sharesStem('مسار', 'المسار'));
  ok('stam: ander woord faalt', !sharesStem('Gesamtpuffer', 'Schlupf'));
  ok('stam: leeg faalt', !sharesStem('rezerva', ''));
  const concepts: Concept[] = [
    { id: 'total-float', kind: 'term', nl: 'totale speling', en: ['total float'], definition: 'd' },
    { id: 'baseline', kind: 'term', nl: 'basislijn', en: ['baseline'], definition: 'd' },
    { id: 'rel-fs', kind: 'token', nl: 'FS', en: ['FS'], definition: 'd' },
  ];
  const good = validateLangTermbase('de', {
    _style: { address: 'informal', note: 'du-vorm' },
    'total-float': { term: 'Gesamtpuffer', forms: ['Gesamtpuffer', 'Gesamtpuffers'], avoid: ['Gesamtschlupf'], source: 'tbx', status: 'tbx' },
  }, concepts);
  eq('termbase: geen fouten', good.errors, []);
  eq('termbase: ontbrekende term = rapport, token telt niet', good.missing, ['baseline']);
  const bad = validateLangTermbase('de', {
    'total-float': { term: 'Gesamtpuffer', forms: [], source: '', status: 'guess' },
    onbekend: { term: 'x', forms: ['x'], source: 'tbx', status: 'tbx' },
  }, concepts).errors;
  ok('termbase: _style ontbreekt', has(bad, '_style ontbreekt'));
  ok('termbase: forms leeg', has(bad, 'forms moet een niet-lege lijst'));
  ok('termbase: source leeg', has(bad, 'source ontbreekt'));
  ok('termbase: status onbekend', has(bad, 'status moet één van'));
  ok('termbase: onbekend concept', has(bad, 'de.onbekend: onbekend concept'));
}

if (diffs.length === 0) {
  console.log(`OK  translate-gates: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-gates: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
