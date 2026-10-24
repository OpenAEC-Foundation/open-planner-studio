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
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, NAMESPACES } from '../../scripts/i18n-tools';
import type { UiPackage } from '../../scripts/translate/ui';
import type { TermsPackage } from '../../scripts/translate/tbx';
import { countToken, hashUnit, type Concept, type LangTermbase, type TermEntry } from '../../scripts/translate/common';

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

// ── 5a. Vaste tekst (172): sleutel én namespace én taal begrenzen het contract ──────────────────
{
  const key = 'ribbon.calendarDialog.hoursValue';
  const item = { key, nl: '{{hours}}u', en: '{{hours}}h' };
  for (const lang of ['ar', 'fa']) {
    // Bewust zonder fixedText-metadata: ook een ouder pakket moet door dezelfde poort.
    const p = pkg(lang, [item, { key: 'otherHours', nl: '{{hours}}u', en: '{{hours}}h' }], { namespace: 'menu' });
    const out = { [key]: '{{hours}}h', otherHours: '{{hours}} س' };
    eq(`172 ${lang}: vaste tekst correct, ongerelateerde sleutel vrij`, checkPackage(p, out).errors, []);
    for (const wrong of ['{{hours}}س', '{{hours}} h', '{{hours}}\u00a0h', 'h{{hours}}', '{{uren}}h', '10h', '{{hours}}{{hours}}h']) {
      const errors = checkPackage(p, { ...out, [key]: wrong }).errors;
      ok(`172 ${lang}: ${JSON.stringify(wrong)} is harde fout met contract`,
        has(errors, `menu:${key}: vaste tekst voor ${lang} moet byte-gelijk "{{hours}}h" zijn`));
    }
    ok(`172 ${lang}: gewijzigde invulplek ook door bestaande placeholderpoort geweigerd`,
      has(checkPackage(p, { ...out, [key]: '{{uren}}h' }).errors, 'invulplekken'));
    const forged: UiPackage = { ...p, items: p.items.map(i => ({ ...i, fixedText: '{{hours}}س' })) };
    ok(`172 ${lang}: bewerkte fixedText-metadata versoepelt de poort niet`,
      has(checkPackage(forged, { ...out, [key]: '{{hours}}س' }).errors, 'vaste tekst'));
    eq(`172 ${lang}: dezelfde sleutel in andere namespace blijft vrij`,
      checkPackage({ ...p, namespace: 'task' }, { ...out, [key]: '{{hours}} س' }).errors, []);
  }
  for (const [lang, text] of [['nl', '{{hours}}u'], ['en', '{{hours}}h'], ['fr', '{{hours}} h'], ['da', '{{hours}}t']]) {
    eq(`172 ${lang}: bestaande schrijfwijze blijft vrij`,
      checkPackage(pkg(lang, [item], { namespace: 'menu' }), { [key]: text }).errors, []);
  }
}

// ── 5b. Meervoud met per vorm andere invulplekken ────────────────────────────────────────────
{
  const p = pkg('ru', [{ key: 'm', plural: true,
    nl: { one: "Mijlpaal '{{phase}}' is nu een verzameltaak.", other: '{{count}} mijlpalen zijn nu verzameltaken.' },
    en: { one: "Milestone '{{phase}}' is now a summary task.", other: '{{count}} milestones are now summary tasks.' } }]);
  eq('goed: one met {{phase}}, de rest met {{count}}', errorsOf(p, { m: {
    one: 'Веха «{{phase}}» стала суммарной задачей.', few: '{{count}} вехи стали суммарными задачами.',
    many: '{{count}} вех стали суммарными задачами.', other: '{{count}} вехи стали суммарными задачами.' } }), []);
  ok('fout: {{phase}} ontbreekt in one', has(errorsOf(p, { m: {
    one: 'Веха стала суммарной задачей.', few: '{{count}} вехи', many: '{{count}} вех', other: '{{count}} вехи' } }), 'm.one: invulplekken'));
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
  ok('onbekend pakket', has(checkPackage({ kind: 'nope' }, {}).errors, 'onbekend kind'));
  ok('docs-pakket: niet via checkPackage (checkDocs met .src.md)', has(checkPackage({ kind: 'docs' }, {}).errors, 'checkDocs'));
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
    { id: 'ifc', kind: 'keep', nl: 'IFC', en: ['IFC'], definition: 'd' },
  ];
  const tb: LangTermbase = {
    _style: { address: 'informal', note: 'du-vorm' },
    'total-float': { term: 'Gesamtpuffer', forms: ['Gesamtpuffer', 'Gesamtpuffers'], avoid: ['Gesamtschlupf'], source: 'tbx', status: 'tbx' },
    baseline: { term: 'Basisplan', forms: ['Basisplan'], source: 'tbx', status: 'tbx' },
  };
  const good = validateLangTermbase('de', tb, concepts);
  eq('termbase: compleet zonder token- en keep-regels', good.errors, []);
  eq('termbase: geen ontbrekende doeltermen', good.missing, []);
  const partial = validateLangTermbase('de', { _style: tb._style, 'total-float': tb['total-float'] }, concepts);
  eq('termbase: ontbrekend concept is rood met taal en id', partial.errors, ['de.baseline: term ontbreekt']);
  eq('termbase: ontbrekende id blijft beschikbaar voor de telling', partial.missing, ['baseline']);
  for (const [label, term] of [
    ['lege tekst', ''], ['stuurtekens', '\u0000\u0007\u007f'], ['witruimte', ' \t\r\n\u00a0\u3000'],
    ['alleen onzichtbare opmaak', '\u200b\u200c\u200d\u2060\ufe0f\u200e\u200f\u061c\u202a\u2066'],
  ]) {
    const errors = validateLangTermbase('de', { ...tb, baseline: { ...tb.baseline, term } }, concepts).errors;
    ok(`termbase: ${label} is rood met taal en id`, has(errors, 'de.baseline: term ontbreekt'));
  }
  for (const entry of [null, {}, { term: null, forms: ['Basisplan'], source: 'tbx', status: 'tbx' }]) {
    const errors = validateLangTermbase('de', { ...tb, baseline: entry }, concepts).errors;
    ok('termbase: aanwezige ongeldige regel is rood met taal en id', has(errors, 'de.baseline:'));
  }
  // Geen alfabet- of scriptfilter: ook korte termen, symbolen en opmaak binnen woorden zijn geldig.
  for (const term of ['終了日', 'مسیر\u200cبحرانی', '\u200fالمسار الحرج', '①', '≤', '🧱', ' Basisplan ']) {
    eq(`termbase: geldige term ${JSON.stringify(term)}`, validateLangTermbase('de', {
      ...tb, baseline: { term, forms: [term], source: 'model', status: 'arbitrated' },
    }, concepts).errors, []);
  }
  const bad = validateLangTermbase('de', {
    'total-float': { term: 'Gesamtpuffer', forms: [], source: '', status: 'guess' },
    onbekend: { term: 'x', forms: ['x'], source: 'tbx', status: 'tbx' },
  }, concepts).errors;
  ok('termbase: _style ontbreekt', has(bad, '_style ontbreekt'));
  ok('termbase: forms leeg', has(bad, 'forms moet een niet-lege lijst'));
  ok('termbase: source leeg', has(bad, 'source ontbreekt'));
  ok('termbase: status onbekend', has(bad, 'status moet één van'));
  ok('termbase: onbekend concept', has(bad, 'de.onbekend: onbekend concept'));
  const clash = validateLangTermbase('de', {
    _style: { address: 'informal' },
    'total-float': { term: 'Gesamtpuffer', forms: ['Gesamtpuffer'], avoid: ['Basisplan'], source: 'tbx', status: 'tbx' },
    baseline: { term: 'Basisplan', forms: ['Basisplan'], source: 'tbx', status: 'tbx' },
  }, concepts).errors;
  ok('termbase: avoid mag geen term van een ander concept zijn', has(clash, 'avoid "Basisplan" is een term van baseline'));
}

// ── 8b. Echte CLI-poorten: nieuwe concepten, lege termen en verdwenen taalbestanden (170) ──────
{
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const work = mkdtempSync(join(tmpdir(), 'ops-termbase-gates-'));
  const bundle = join(work, 'translate.mjs');
  const targets = LOCALES.filter(l => l !== 'nl' && l !== 'en');
  const concepts: Concept[] = [
    { id: 'baseline', kind: 'term', nl: 'basislijn', en: ['baseline'], definition: 'Referentieplanning.' },
    { id: 'rel-fs', kind: 'token', nl: 'FS', en: ['FS'], definition: 'Relatiecode.' },
    { id: 'ifc', kind: 'keep', nl: 'IFC', en: ['IFC'], definition: 'Formaatnaam.' },
  ];
  const workCategory: Concept = { id: 'work-category', kind: 'term', nl: 'werksoort', en: ['work category'], definition: 'Groepering van werk.' };
  const baseline: TermEntry = { term: 'Basisplan', forms: ['Basisplan', 'Basisplans'], source: 'tbx', status: 'tbx' };
  const category: TermEntry = { term: 'Arbeitsart', forms: ['Arbeitsart', 'Arbeitsarten'], avoid: ['Vorgangsart'], source: 'model', status: 'arbitrated' };
  const termbase = (term = category): LangTermbase => ({ _style: { address: 'informal' }, baseline, 'work-category': term });
  const tbPath = (lang: string) => join(work, 'i18n/termbase', `${lang}.json`);
  const write = (path: string, data: unknown) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(data));
  };
  const run = (args: string[], cwd = work) => {
    const r = spawnSync(process.execPath, [bundle, ...args], { cwd, encoding: 'utf8', timeout: 30_000 });
    return { status: r.status, out: `${r.stdout}${r.stderr}`, error: r.error?.message };
  };
  const commands = [['validate-termbase'], ['status', '--strict']];
  try {
    const build = spawnSync(join(root, 'node_modules', '.bin', 'esbuild'), [join(root, 'scripts/translate/cli.ts'),
      '--bundle', '--platform=node', '--format=esm', '--log-level=error', `--outfile=${bundle}`], { encoding: 'utf8', timeout: 30_000 });
    if (build.status !== 0) throw new Error(`bundelen van translate/cli.ts mislukt: ${build.stderr} ${build.error?.message ?? ''}`);
    write(join(work, 'i18n/termbase/concepts.json'), concepts);
    for (const lang of targets) write(tbPath(lang), { _style: { address: 'informal' }, baseline });
    // Een complete en actuele UI, zonder doeltermbestanden voor de brontalen nl/en.
    for (const lang of LOCALES) {
      for (const ns of NAMESPACES) write(join(work, 'src/i18n/locales', lang, `${ns}.json`), ns === 'common' ? { sample: `Voorbeeld ${lang}` } : {});
      if (lang !== 'nl') write(join(work, 'i18n/ui-sources', `${lang}.json`), { common: { sample: hashUnit('Voorbeeld nl') } });
    }
    mkdirSync(join(work, 'public/docs'), { recursive: true });
    for (const args of commands) {
      const r = run(args);
      eq(`CLI ${args.join(' ')}: complete termen en UI, geen token/keep- of nl/en-doeltermen (${r.out})`, r.status, 0);
    }
    // Historische fout: één nieuw concept geregistreerd, nog in geen enkele doeltaal ingevuld.
    write(join(work, 'i18n/termbase/concepts.json'), [...concepts, workCategory]);
    for (const args of commands) {
      const r = run(args);
      eq(`CLI ${args.join(' ')}: nieuw concept zonder termen is rood`, r.status, 1);
      ok(`CLI ${args.join(' ')}: noemt concept in de en lo (${r.out})`,
        r.out.includes('XX  de.work-category: term ontbreekt') && r.out.includes('XX  lo.work-category: term ontbreekt'));
    }
    for (const lang of targets) write(tbPath(lang), termbase());
    // Aanwezig zijn is onvoldoende: zowel de gewone als de releasepoort moet lege inhoud weigeren.
    for (const term of ['', ' \t\n\u00a0', '\u200b\u200e\u2060']) {
      write(tbPath('de'), termbase({ ...category, term }));
      for (const args of commands) {
        const r = run(args);
        eq(`CLI ${args.join(' ')}: lege term ${JSON.stringify(term)} is rood`, r.status, 1);
        ok(`CLI ${args.join(' ')}: lege term noemt taal en concept (${r.out})`, r.out.includes('XX  de.work-category: term ontbreekt'));
      }
    }
    write(tbPath('de'), termbase());
    // Ook als zowel de termbase als de UI-map van een vereiste taal verdwijnen, blijft die taal verplicht.
    rmSync(tbPath('lo'));
    rmSync(join(work, 'src/i18n/locales/lo'), { recursive: true });
    for (const args of commands) {
      const r = run(args);
      eq(`CLI ${args.join(' ')}: ontbrekend taalbestand is rood`, r.status, 1);
      ok(`CLI ${args.join(' ')}: ontbrekend bestand noemt lo en concept (${r.out})`,
        r.out.includes('lo: taalbestand ontbreekt') && r.out.includes('lo.work-category: term ontbreekt'));
    }
    write(tbPath('lo'), termbase());
    eq('200 termbase herstellen is genoeg voor de afzonderlijke termbasepoort', run(['validate-termbase']).status, 0);
    const missingUi = run(['status', '--strict']);
    eq('200 geldige termbase maskeert geen verdwenen UI-map', missingUi.status, 1);
    ok(`200 release noemt lo en de ontbrekende UI-sleutel (${missingUi.out})`,
      missingUi.out.includes('XX  lo:') && missingUi.out.includes('common:sample (ontbreekt)'));
    eq('200 expliciete controle van andere taal behoudt eigen scope', run(['status', 'de', '--strict']).status, 0);
    eq('200 expliciete verdwenen taal is eveneens rood', run(['status', 'lo', '--strict']).status, 1);
    const report = run(['status']);
    eq('200 gewone status blijft een rapport, geen harde poort', report.status, 0);
    ok('200 gewone status meldt ook verdwenen locale', /lo\s+common\s+1/.test(report.out));
    for (const ns of NAMESPACES) write(join(work, 'src/i18n/locales/lo', `${ns}.json`),
      ns === 'common' ? { sample: 'Voorbeeld lo' } : {});
    for (const args of commands) {
      const r = run(args);
      eq(`CLI ${args.join(' ')}: doeltermen én UI herstellen groen (${r.out})`, r.status, 0);
    }
    // Engels heeft geen doeltermbase, maar is wel een verplichte UI-taal. Oude hashes helpen niet.
    rmSync(join(work, 'src/i18n/locales/en'), { recursive: true });
    const missingEnglish = run(['status', '--strict']);
    eq('200 ook compleet verdwenen Engels blokkeert de release', missingEnglish.status, 1);
    ok('200 Engelse ontbrekende sleutel expliciet gemeld', missingEnglish.out.includes('XX  en:')
      && missingEnglish.out.includes('common:sample (ontbreekt)'));
    for (const ns of NAMESPACES) write(join(work, 'src/i18n/locales/en', `${ns}.json`),
      ns === 'common' ? { sample: 'Voorbeeld en' } : {});
    eq('200 alle vereiste talen terug maakt de releasepoort groen', run(['status', '--strict']).status, 0);
    // De echte geregistreerde concepten en talen moeten in CI eveneens aan het contract voldoen.
    const real = run(['validate-termbase'], root);
    eq(`CLI: repository-termbase compleet en geldig (${real.out})`, real.status, 0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// ── 9. Tokens en namen als los woord ───────────────────────────────────────────────────────
eq('9a ko-partikel aan een Latijnse naam telt', countToken('*Microsoft Project에서 열 수 있습니다.*', 'Microsoft Project'), 1);
eq('9b Latijnse letter erachter telt niet', countToken('FSx en FS', 'FS'), 1);
eq('9c Cyrillisch en cijfer blijven grenzen bij een Cyrillische naam', countToken('ГантаX Ганта Ганта1', 'Ганта'), 1);

if (diffs.length === 0) {
  console.log(`OK  translate-gates: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-gates: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
