/**
 * Vertaalstraat — docs-straat (scripts/translate/docs.ts + checkDocs in gates.ts; ontwerp §5.2, §5.3,
 * §7, §9; contracten C2 en C3).
 *
 * Bewaakt: de labelkaart (a/b/c, pad, dubbelzinnigheid), stam- en woordgrenszoeken, de pakketgrens
 * (een sectie wordt nooit geknipt), --missing/--stale/--ids met koppeling op inhoud, de harde en zachte
 * docs-poort, samenvoegen (alleen wat klopt, oude hash voor een verouderde sectie zonder pakket), C2-
 * opmaak, hernoemen, de releasegaten, en de bronnen: docs-literal.json en _style.docs per taal.
 *
 * Mutatiebewijs: in `linkSections` op positie koppelen ⇒ 07a rood; in `checkDocsSection` de
 * display-uitzondering weghalen ⇒ 09c rood; de NON_ASCII_DIGIT-poort weghalen ⇒ 10f rood;
 * `mergeArticle` een behouden verouderde sectie de nieuwe hash geven ⇒ 11e rood; in `classifyItalic` de
 * tabbladfilter weghalen ⇒ 16b en 16f rood; de tabbladpoort in `checkDocsSection` uitzetten ⇒ 16f rood.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sectionHash, splitSections, structureHash } from '../../scripts/lib/docs-structure';
import {
  articleState, avoidWords, blocksOf, buildDocsPackages, buildEnLabelIndex, classifyItalic, codesOf, decodeIfcString, docsReleaseGaps,
  docsStatus, hasStem, ifcNames, pairChanged, hasWord, italicsOf, joinSections, labelsDigest, linkSections, literalCandidates, literalNames,
  mergeArticle, normLabel, orderDocsSources, parseDocsIndex, quotedNames, renameDocLinks, renameInEntry, ribbonTabKey, sectionLabels,
  serializeDocsIndex, titleOf, tutorialNames, RIBBON_TABS, SETTINGS_TAB_KEYS,
  type DocsLiteral, type DocsSources,
} from '../../scripts/translate/docs';
import { checkDocs, checkDocsArticle } from '../../scripts/translate/gates';
import type { Concept, LangTermbase } from '../../scripts/translate/common';
import type { NsInput } from '../../scripts/translate/ui';
import type { JsonObject } from '../../scripts/i18n-tools';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const has = (label: string, lines: string[], re: RegExp) => ok(`${label} (kreeg: ${lines.join(' | ') || '(niets)'})`, lines.some(l => re.test(l)));

// ── Gedeelde invoer: een mini-UI in nl/en/cs en een mini-artikel ─────────────────────────────
const nl: JsonObject = {
  dlg: { relType: 'Type relatie', save: 'Opslaan', link: 'Relatie', linkVerb: 'Koppelen', created: 'Relatie aangemaakt: {{from}} → {{to}}', menu: 'Start', tasks: 'Taken' },
};
const en: JsonObject = {
  dlg: { relType: 'Relation type', save: 'Save…', link: 'Link', linkVerb: 'Link', created: 'Relation created: {{from}} → {{to}}', menu: 'Home', tasks: 'Tasks' },
};
const cs: JsonObject = {
  dlg: { relType: 'Typ závislosti', save: 'Uložit…', link: 'Závislost', linkVerb: 'Propojit', created: 'Závislost vytvořena: {{from}} → {{to}}', menu: 'Domů', tasks: 'Úkoly' },
};
const inputs: NsInput[] = [{ ns: 'common', nl, en, target: cs }];
const allHashed = { common: Object.fromEntries(['dlg.relType', 'dlg.save', 'dlg.link', 'dlg.linkVerb', 'dlg.created', 'dlg.menu', 'dlg.tasks'].map(k => [k, 'x'])) };
const index = buildEnLabelIndex(inputs, 'cs', allHashed);
const literal: DocsLiteral = { sources: { 'x.ts': ['Pour foundation', 'Foundation brickwork'] }, manual: [], keepTranslated: { cs: ['Gantt'] }, display: { art: ['+3d'] } };
const literals = new Set(literalNames(literal));
const concepts: Concept[] = [
  { id: 'successor', kind: 'term', nl: 'opvolger', en: ['successor', 'successors'], definition: 'd' },
  { id: 'fs', kind: 'token', nl: 'FS', en: ['FS'], definition: 'd' },
  { id: 'ifc', kind: 'keep', nl: 'IFC', en: ['IFC'], definition: 'd' },
  { id: 'gantt', kind: 'keep', nl: 'Gantt', en: ['Gantt'], definition: 'd' },
];
const tb: LangTermbase = {
  _style: { address: 'formal', docs: 'Guides: formal.' },
  successor: { term: 'následník', forms: ['následník', 'následníka', 'následníci'], avoid: ['nástupce'], source: 'tbx', status: 'tbx' },
};

const ART = [
  '# Adding relations',
  '',
  'Goal: link tasks with FS in the Gantt and save as IFC.',
  '',
  '## Steps',
  '',
  '1. In the *Relation type* window, choose *Save*.',
  '2. Choose *Home › Tasks › Link ▾*. The app reports *Relation created: Pour foundation → Foundation brickwork*.',
  '',
  'A lag of `3` shows as `+3d`. The successor starts on 18 June 2027.',
  '',
  '## See also',
  '',
  '- [Relations](docs://uitleg-relaties): the four kinds.',
  '',
].join('\n');

const CS_OK = [
  '# Přidání závislostí',
  '',
  'Cíl: propojit úkoly pomocí FS v diagramu Gantt a uložit jako IFC.',
  '',
  '## Postup',
  '',
  '1. V okně *Typ závislosti* zvolte *Uložit*.',
  '2. Zvolte *Domů › Úkoly › Závislost ▾*. Aplikace hlásí *Závislost vytvořena: Pour foundation → Foundation brickwork*.',
  '',
  'Prodleva `3` se zobrazí jako `+3d`. Následník začíná 18. června 2027.',
  '',
  '## Viz také',
  '',
  '- [Závislosti](docs://uitleg-relaties): čtyři druhy.',
  '',
].join('\n');

// ── 01. Inline-tokens en blokken zoals miniMarkdown ──────────────────────────────────────────
eq('01a cursief, vet en code gescheiden', [italicsOf('Een **vet** en *cursief* en `code *geen*`.'), codesOf('`a` en `b`')], [['cursief'], ['a', 'b']]);
eq('01b blokken', blocksOf(ART).map(b => `${b.kind}${b.items || ''}`), ['h1', 'p', 'h2', 'ol2', 'p', 'h2', 'ul1']);
eq('01c "18. června" aan het begin van een regel wordt een lijst', blocksOf('Začíná\n18. června.').map(b => b.kind), ['p', 'ol']);
eq('01d titel zonder opmaak', titleOf('# Het *venster* `x`\n\ntekst'), 'Het venster x');

// ── 02. Zoeken op stam en als los woord ──────────────────────────────────────────────────────
ok('02a stam: successors', hasStem('the successors move', 'successor'));
ok('02b stam: cs naamval', hasStem('Aplikace přesune následníka.', 'následník'));
ok('02c stam: geen ander woord', !hasStem('a predecessor', 'successor'));
ok('02d zh als deeltekst', hasStem('应用会将后续任务移到', '后续任务'));
ok('02e ar met voorvoegsel', hasStem('وبالمدة الجديدة', 'المدة'));
ok('02f los woord', hasWord('Gebruik Puffer hier', 'puffer') && !hasWord('Gesamtpuffer', 'puffer'));
eq('02g avoid alleen als los woord, eigen term weggestreept', avoidWords('fri slakk og slakken', ['fri slakk'], ['slakk']), []);
eq('02h avoid als los woord gevonden', avoidWords('de nástupce úlohy', ['následník'], ['nástupce']), ['nástupce']);
eq('02i normLabel', [normLabel('Save…'), normLabel('Link ▾'), normLabel('Done.'), normLabel('Note:')], ['Save', 'Link', 'Done', 'Note']);

// ── 03. Labelkaart a/b/c ─────────────────────────────────────────────────────────────────────
{
  const kinds = (s: string) => classifyItalic(s, index, literals).map(c => `${c.kind}:${c.en}`);
  eq('03a soort a (genormaliseerd: Save… = Save)', kinds('Save'), ['a:Save']);
  eq('03b pad per deel', kinds('Home › Tasks › Link ▾'), ['a:Home', 'a:Tasks', 'a:Link']);
  eq('03c soort b: patroon, met de letterlijke invulling als c', kinds('Relation created: Pour foundation → Foundation brickwork'),
    ['b:Relation created: Pour foundation → Foundation brickwork', 'c:Pour foundation', 'c:Foundation brickwork']);
  eq('03d soort c en paar met →', kinds('Pour foundation → Foundation brickwork'), ['c:Pour foundation', 'c:Foundation brickwork']);
  eq('03e vrij (d)', kinds('not'), []);
  const r = sectionLabels(1, splitSections(ART)[1].text, index, literals);
  const link = r.labels.find(l => l.en === 'Link');
  eq('03f dubbelzinnig: alle doelteksten met sleutelpad', [link?.targets, link?.keys], [['Závislost', 'Propojit'], ['common:dlg.link', 'common:dlg.linkVerb']]);
  eq('03g eenduidig: geen sleutels in het pakket', r.labels.find(l => l.en === 'Relation type')?.keys, undefined);
  ok('03h sleutels met doeltekst-hash voor C3', r.keys['common:dlg.relType'] === sectionHash('Typ závislosti'));
  const fresh = buildEnLabelIndex([{ ns: 'common', nl, en, target: cs }], 'cs', {});
  eq('03i nieuwe taal zonder bron-hash: geen doeltekst (Engelse vulling)', fresh.exact.get('Relation type')?.[0].target, undefined);
  // Meervoud: en one/other tegenover ar met zes vormen (en `one` schrijft het getal uit). Elke ar-vorm telt.
  const nlP: JsonObject = { cp: { summary_one: 'Kritiek pad: {{count}} taak, {{duration}} werkdagen', summary_other: 'Kritiek pad: {{count}} taken, {{duration}} werkdagen' } };
  const enP: JsonObject = { cp: { summary_one: 'Critical path: {{count}} task, {{duration}} work days', summary_other: 'Critical path: {{count}} tasks, {{duration}} work days' } };
  const arP: JsonObject = { cp: {
    summary_zero: 'المسار الحرج: لا مهام، {{duration}} يوم عمل', summary_one: 'المسار الحرج: مهمة واحدة، {{duration}} يوم عمل',
    summary_two: 'المسار الحرج: مهمتان، {{duration}} يوم عمل', summary_few: 'المسار الحرج: {{count}} مهام، {{duration}} يوم عمل',
    summary_many: 'المسار الحرج: {{count}} مهمة، {{duration}} يوم عمل', summary_other: 'المسار الحرج: {{count}} مهمة، {{duration}} يوم عمل' } };
  const arIndex = buildEnLabelIndex([{ ns: 'common', nl: nlP, en: enP, target: arP }], 'ar', { common: { 'cp.summary': 'x' } });
  const pl = classifyItalic('Critical path: 21 tasks, 45 work days', arIndex, new Set());
  const plTargets = sectionLabels(0, '*Critical path: 21 tasks, 45 work days*', arIndex, new Set()).labels[0]?.targets ?? [];
  eq('03j meervoud in een patroon: soort b', pl.map(c => c.kind), ['b']);
  ok('03k meervoud: elke ar-vorm is een kandidaat (ook many/other met {{count}})', plTargets.length === 5 && plTargets.some(t => t.includes('{{count}} مهمة')));
}

// ── 04. Termen, tokens, keep, display in het pakket ──────────────────────────────────────────
const art = { id: 'art', md: ART };
{
  const [p] = buildDocsPackages({ lang: 'cs', articles: [art], mode: 'missing', sources: {}, index, literal, concepts, termbase: tb });
  eq('04a één pakket, alle secties', [p.pkg.id, p.pkg.sections.map(s => s.index)], ['art', [0, 1, 2]]);
  eq('04b termen, tokens, keep, keepSoft, display', [p.pkg.terms.map(t => t.id), p.pkg.tokens, p.pkg.keep, p.pkg.keepSoft, p.pkg.display], [['successor'], ['FS'], ['IFC'], ['Gantt'], ['+3d']]);
  eq('04c .src.md = de secties', p.src, joinSections(splitSections(ART).map(s => s.text)));
  eq('04d labelsoorten (c: ingevuld in het patroon)', ['a', 'b', 'c'].map(k => p.pkg.labels.filter(l => l.kind === k).length), [5, 1, 2]);
  eq('04e style met docs', p.pkg.style?.docs, 'Guides: formal.');
}

// ── 05. Pakketgrens: hele secties, -01/-02 ───────────────────────────────────────────────────
{
  const big = ['# T', '', 'intro', '', '## A', '', 'w '.repeat(60), '', '## B', '', 'w '.repeat(60), '', '## C', '', 'w '.repeat(200), ''].join('\n');
  const packs = buildDocsPackages({ lang: 'cs', articles: [{ id: 'big', md: big }], mode: 'missing', sources: {}, index, literal, concepts, maxWords: 100 });
  eq('05a groepen van hele secties; een te grote sectie blijft heel', packs.map(p => [p.pkg.id, p.pkg.sections.map(s => s.index)]),
    [['big-01', [0, 1]], ['big-02', [2]], ['big-03', [3]]]);
  eq('05b part/parts', packs.map(p => `${p.pkg.part}/${p.pkg.parts}`), ['1/3', '2/3', '3/3']);
}

// ── 06–08. Toestand, koppeling op inhoud, --stale ────────────────────────────────────────────
const entryFor = (md: string, keysPerSection: Record<string, string>[] = []): DocsSources[string] => ({
  structure: structureHash(md),
  sections: splitSections(md).map((s, i) => ({ hash: sectionHash(s.text), labels: keysPerSection[i] ?? {} })),
});
{
  eq('06a geen vertaling: ontbreekt', articleState('art', ART, undefined, undefined, index.hashes).state, 'missing');
  const st = articleState('art', ART, CS_OK, entryFor(ART), index.hashes);
  eq('06b vertaald en gelijk: actueel', [st.state, st.sections.map(s => s.state)], ['current', ['current', 'current', 'current']]);
  const labelled = entryFor(ART, [{}, { 'common:dlg.relType': sectionHash('Typ vazby') }]);
  const st2 = articleState('art', ART, CS_OK, labelled, index.hashes);
  eq('06c ander UI-label: alleen die sectie verouderd', st2.sections.map(s => `${s.state}${s.reason ? `:${s.reason}` : ''}`), ['current', 'stale:label', 'current']);
}
eq('07a invoegen maakt de volgende secties niet verouderd', linkSections(['a', 'b', 'c'], ['a', 'x', 'b', 'c']), [0, null, 1, 2]);
eq('07b verwijderen', linkSections(['a', 'b', 'c'], ['a', 'c']), [0, 2]);
{
  const added = ART.replace('## See also', '## Pitfalls\n\nWatch FS.\n\n## See also');
  const st = articleState('art', added, CS_OK, entryFor(ART), index.hashes);
  eq('08a ingevoegde sectie: alleen die verouderd', st.sections.map(s => s.state), ['current', 'current', 'stale', 'current']);
  const [p, ...rest] = buildDocsPackages({ lang: 'cs', articles: [{ id: 'art', md: added, translated: CS_OK }], mode: 'stale', sources: { art: entryFor(ART) }, index, literal, concepts });
  eq('08b --stale: één pakket met alleen de nieuwe sectie', [rest.length, p.pkg.sections.map(s => s.index), p.pkg.previous], [0, [2], undefined]);
  const changed = ART.replace('the four kinds', 'the four kinds of relation');
  const [q] = buildDocsPackages({ lang: 'cs', articles: [{ id: 'art', md: changed, translated: CS_OK }], mode: 'stale', sources: { art: entryFor(ART) }, index, literal, concepts });
  eq('08c gewijzigde sectie verouderd, met de oude vertaling als previous', [q.pkg.sections.map(s => s.index), Object.keys(q.pkg.previous ?? {})], [[2], ['2']]);
  eq('08c\' pairChanged: gelijk aantal in een gat koppelt op volgorde, ongelijk niet',
    [pairChanged([0, null, 2], 3), pairChanged([0, null, null, 2], 3), pairChanged([null], 1)], [[0, 1, 2], [0, null, null, 2], [0]]);
  const relabel = buildDocsPackages({ lang: 'cs', articles: [{ id: 'art', md: ART, translated: CS_OK }], mode: 'stale',
    sources: { art: entryFor(ART, [{}, { 'common:dlg.relType': 'oud' }]) }, index, literal, concepts });
  eq('08d label veranderd: sectie met previous', [relabel[0]?.pkg.sections.map(s => s.index), Object.keys(relabel[0]?.pkg.previous ?? {})], [[1], ['1']]);
  eq('08e --missing slaat vertaalde artikelen over', buildDocsPackages({ lang: 'cs', articles: [{ id: 'art', md: ART, translated: CS_OK }], mode: 'missing', sources: { art: entryFor(ART) }, index, literal, concepts }).length, 0);
  const ids = buildDocsPackages({ lang: 'cs', articles: [{ id: 'art', md: ART, translated: CS_OK }], mode: 'ids', ids: ['art'], sources: { art: entryFor(ART) }, index, literal, concepts });
  eq('08f --ids: heel artikel met de huidige vertaling als previous', Object.keys(ids[0].pkg.previous ?? {}), ['0', '1', '2']);
}

// ── 09–10. De docs-poort ─────────────────────────────────────────────────────────────────────
const [PKG] = buildDocsPackages({ lang: 'cs', articles: [art], mode: 'missing', sources: {}, index, literal, concepts, termbase: tb });
const run = (out: string) => checkDocs(PKG.pkg, PKG.src, out);
{
  const r = run(CS_OK);
  eq('09a goede vertaling: groen', r.errors, []);
  has('09b extra getal (zh/ja-datum) is alleen een waarschuwing', run(CS_OK.replace('18. června 2027', '18. 6. 2027')).warnings, /getallen die de bron niet heeft: 6/);
  eq('09c display mag anders', run(CS_OK.replace('`+3d`', '`+3 d`')).errors, []);
}
{
  const bad = (label: string, out: string, re: RegExp) => has(label, run(out).errors, re);
  bad('10a kop weg', CS_OK.replace('## Viz také\n', ''), /sectie/);
  bad('10b inline code veranderd', CS_OK.replace('`3`', '`3d`'), /inline code `3`/);
  bad('10c label a niet letterlijk', CS_OK.replace('*Typ závislosti*', '*Typu závislosti*'), /label \*Relation type\* moet letterlijk "Typ závislosti"/);
  bad('10d label b past niet', CS_OK.replace('Závislost vytvořena: ', 'Vytvořena: '), /volgens het patroon/);
  bad('10e label c niet byte-gelijk', CS_OK.replace(/Pour foundation/, 'Betonáž základů'), /moet letterlijk blijven: "Pour foundation"/);
  bad('10f Arabisch-Indische cijfers', CS_OK.replace('2027', '٢٠٢٧'), /niet-ASCII-cijfers/);
  bad('10g getal weg', CS_OK.replace(' 2027', ''), /getal 2027/);
  bad('10h regel begint met getal + punt', CS_OK.replace('Následník začíná 18. června 2027.', 'Následník začíná\n18. června 2027.'), /begint met een getal en een punt/);
  bad('10i token weg', CS_OK.replace('pomocí FS', 'pomocí KS'), /token "FS"/);
  bad('10j keep-naam weg', CS_OK.replace('jako IFC', 'jako soubor'), /naam "IFC"/);
  bad('10k buiten de subset', CS_OK.replace('- [Závislosti]', '| a | b |\n\n- [Závislosti]'), /buiten de Markdown-subset/);
  bad('10l dubbele kop', CS_OK.replace('## Viz také', '## Postup'), /kop "Postup"/);
  bad('10m link anders', CS_OK.replace('docs://uitleg-relaties', 'docs://uitleg-kritiek-pad'), /links/);
  has('10n keepSoft: Gantt vertaald is alleen een waarschuwing', run(CS_OK.replace('Gantt', 'Ganttův')).warnings, /naam "Gantt"/);
  ok('10n\' en geen fout', run(CS_OK.replace('Gantt', 'Ganttův')).errors.length === 0);
  has('10o term niet gevonden (zacht)', run(CS_OK.replace('Následník', 'Další úkol')).warnings, /term "následník"/);
  has('10p avoid als los woord is hard, met de term erbij', run(CS_OK.replace('Následník', 'Nástupce')).errors, /vermijd "nástupce" \(successor\) — schrijf de term "následník"/);
}
{
  // Pakket zonder sectie 0: de uitvoer begint met een ##-kop.
  const [p2] = buildDocsPackages({ lang: 'cs', articles: [art], mode: 'missing', sources: {}, index, literal, concepts, maxWords: 25 });
  ok('10q pakket zonder sectie 0 bestaat', p2.pkg.sections[0].index === 0);
  const packs = buildDocsPackages({ lang: 'cs', articles: [art], mode: 'missing', sources: {}, index, literal, concepts, maxWords: 25 });
  const tail = packs.find(p => p.pkg.sections[0].index === 2)!;
  const outTail = joinSections([splitSections(CS_OK)[2].text]);
  eq('10r ##-sectie los: groen', checkDocs(tail.pkg, tail.src, outTail).errors, []);
  has('10s tekst vóór de eerste ## is fout', checkDocs(tail.pkg, tail.src, `Intro\n\n${outTail}`).errors, /tekst vóór de eerste ##-kop/);
}

// ── 11. Samenvoegen ──────────────────────────────────────────────────────────────────────────
{
  const labelsOf = (i: number, text: string) => sectionLabels(i, text, index, literals).keys;
  const m = mergeArticle({ enMd: ART, labelHashes: index.hashes, labelsOf, packages: [{ pkg: PKG.pkg, out: CS_OK }] });
  ok('11a nieuw artikel samengevoegd', !('error' in m) && m.md === joinSections(splitSections(CS_OK).map(s => s.text)));
  if (!('error' in m)) {
    eq('11b C3: structuur en per sectie hash + sleutels', [m.entry.structure, m.entry.sections.map(s => s.hash)], [structureHash(ART), splitSections(ART).map(s => sectionHash(s.text))]);
    eq('11b\' artikelpoort groen', checkDocsArticle(ART, m.md), []);
    // Twee secties veranderen in en; er is maar een pakket voor één ervan.
    const next = ART.replace('Goal: link', 'Goal: connect').replace('the four kinds', 'all four kinds');
    const packs = buildDocsPackages({ lang: 'cs', articles: [{ id: 'art', md: next, translated: m.md }], mode: 'stale', sources: { art: m.entry }, index, literal, concepts, maxWords: 1 });
    eq('11c twee verouderde secties, twee pakketten', packs.map(p => p.pkg.sections[0].index), [0, 2]);
    const only0 = packs[0];
    const out0 = joinSections([splitSections(CS_OK)[0].text.replace('propojit', 'spojit')]);
    const m2 = mergeArticle({ enMd: next, translated: m.md, entry: m.entry, labelHashes: index.hashes, labelsOf, packages: [{ pkg: only0.pkg, out: out0 }] });
    ok('11d deels samengevoegd', !('error' in m2));
    if (!('error' in m2)) {
      const h = splitSections(next).map(s => sectionHash(s.text));
      eq('11e verouderde sectie zonder pakket houdt de oude hash', [m2.entry.sections[0].hash === h[0], m2.entry.sections[2].hash === h[2], m2.kept], [true, false, 2]);
      eq('11f daarna nog steeds verouderd: alleen sectie 2', articleState('art', next, m2.md, m2.entry, index.hashes).sections.map(s => s.state), ['current', 'current', 'stale']);
    }
    const stale = mergeArticle({ enMd: next, labelHashes: index.hashes, labelsOf, packages: [{ pkg: PKG.pkg, out: CS_OK }] });
    ok('11g pakket op een oudere en-versie: fout', 'error' in stale && /veranderde na prepare/.test(stale.error));
    const relabeled = mergeArticle({ enMd: ART, labelHashes: index.hashes, labelsOf: () => ({ 'common:dlg.relType': 'nieuw' }), packages: [{ pkg: PKG.pkg, out: CS_OK }] });
    ok('11h UI-label veranderd na prepare: fout', 'error' in relabeled && /UI-label/.test(relabeled.error));
    const gap = mergeArticle({ enMd: ART, labelHashes: index.hashes, labelsOf, packages: [] });
    ok('11i sectie zonder vertaling en zonder pakket: fout', 'error' in gap);
    const dropped = ART.replace(/## See also[\s\S]*$/, '');
    const st = articleState('art', dropped, m.md, m.entry, index.hashes);
    eq('11j alleen een sectie verwijderd: verouderd zonder werk', [st.state, st.dropped, st.sections.every(s => s.state === 'current')], ['stale', 1, true]);
    const re = mergeArticle({ enMd: dropped, translated: m.md, entry: m.entry, labelHashes: index.hashes, labelsOf, packages: [] });
    ok('11k herschikken zonder pakket', !('error' in re) && splitSections(re.md).length === 2 && checkDocsArticle(dropped, re.md).length === 0);
    eq('11l labelsDigest volgt de sleutels', labelsDigest({ b: '2', a: '1' }), labelsDigest({ a: '1', b: '2' }));
  }
}

// ── 12. C2 en C3 ─────────────────────────────────────────────────────────────────────────────
{
  const text = serializeDocsIndex({ b: 'Bé', a: 'A "x"', z: 'Wees' }, ['a', 'b']);
  eq('12a C2: één regel per artikel, manifest-volgorde, wees achteraan', text, '{\n"a": {"title": "A \\"x\\""},\n"b": {"title": "Bé"},\n"z": {"title": "Wees"}\n}\n');
  eq('12b C2 terug te lezen', parseDocsIndex(text), { a: 'A "x"', b: 'Bé', z: 'Wees' });
  eq('12c C3 in manifest-volgorde', Object.keys(orderDocsSources({ z: entryFor(ART), a: entryFor(ART) }, ['a'])), ['a', 'z']);
}

// ── 13. Hernoemen ────────────────────────────────────────────────────────────────────────────
{
  eq('13a links met en zonder anker, niet een langer id', renameDocLinks('[a](docs://x) [b](docs://x#k) [c](docs://xy)', 'x', 'y'), '[a](docs://y) [b](docs://y#k) [c](docs://xy)');
  const after = renameDocLinks(ART, 'uitleg-relaties', 'uitleg-relaties-2');
  const moved = renameInEntry(entryFor(ART), after, 'uitleg-relaties', 'uitleg-relaties-2');
  eq('13b C3 volgt de hernoeming: alles actueel', articleState('art', after, renameDocLinks(CS_OK, 'uitleg-relaties', 'uitleg-relaties-2'), moved, index.hashes).state, 'current');
}

// ── 14. Status en releasepoort ───────────────────────────────────────────────────────────────
{
  const added = ART.replace('## See also', '## Pitfalls\n\nWatch FS.\n\n## See also');
  const states = [
    articleState('a', ART, undefined, undefined, index.hashes),
    articleState('b', added, CS_OK, entryFor(ART), index.hashes),
    articleState('c', ART, CS_OK, entryFor(ART), index.hashes),
  ];
  eq('14a status', docsStatus('cs', states), { lang: 'cs', missing: 1, stale: 1, staleSections: 1, current: 1 });
  eq('14b releasegaten', docsReleaseGaps('cs', states).map(g => `${g.where}:${g.state}`), ['docs:a:missing', 'docs:b#2:stale']);
}

// ── 15. Bronnen: docs-literal.json en _style.docs ────────────────────────────────────────────
{
  const root = process.cwd();
  const lit = JSON.parse(readFileSync(resolve(root, 'i18n/docs-literal.json'), 'utf8')) as DocsLiteral;
  const enUi = (() => {
    const out = new Set<string>();
    const walk = (o: JsonObject) => { for (const v of Object.values(o)) { if (typeof v === 'string') out.add(normLabel(v)); else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v as JsonObject); } };
    for (const f of readdirSync(resolve(root, 'src/i18n/locales/en'))) walk(JSON.parse(readFileSync(resolve(root, `src/i18n/locales/en/${f}`), 'utf8')) as JsonObject);
    return out;
  })();
  // Het tutorialproject en elk voorbeeldproject: de lijst is precies wat `translate docs-literal` eruit haalt.
  const extracted = (file: string): string[] | undefined => {
    const text = readFileSync(resolve(root, file), 'utf8');
    if (file === 'scripts/tutorial-project.ts') return literalCandidates(tutorialNames(text), enUi);
    if (/^public\/examples\/[^/]+\.ifc$/.test(file)) return literalCandidates(ifcNames(text), enUi);
    return undefined;
  };
  const ifcFiles = readdirSync(resolve(root, 'public/examples')).filter(f => f.endsWith('.ifc')).map(f => `public/examples/${f}`);
  for (const f of ['scripts/tutorial-project.ts', ...ifcFiles]) ok(`15a' ${f} staat onder sources (npm run translate -- docs-literal)`, f in lit.sources);
  for (const [file, names] of Object.entries(lit.sources)) {
    const want = extracted(file);
    if (want) { eq(`15a ${file}: voorbeeldnamen actueel (npm run translate -- docs-literal)`, names, want); continue; }
    const code = readFileSync(resolve(root, file), 'utf8');
    for (const n of names) ok(`15a ${file} bevat nog '${n}' (soort c)`, code.includes(`'${n}'`) || code.includes(`"${n}"`));
  }
  ok('15a" tutorialproject: nl- en en-namen (taak, fase, project, kalender, resource)', ['Fundering storten', 'Pour foundation', 'Aanbouw woning', 'House extension', 'Bouwkalender NL', 'Mobiele kraan', 'Mobile crane']
    .every(n => (lit.sources['scripts/tutorial-project.ts'] ?? []).includes(n)) && !(lit.sources['scripts/tutorial-project.ts'] ?? []).includes('Basisplanning'));
  for (const [lang, words] of Object.entries(lit.avoidSoft ?? {})) ok(`15g avoidSoft ${lang}: een taal met termbase`, words.length > 0 && readdirSync(resolve(root, 'i18n/termbase')).includes(`${lang}.json`));
  const load = (lang: string) => Object.fromEntries(readdirSync(resolve(root, `src/i18n/locales/${lang}`)).map(f => [f.replace('.json', ''),
    JSON.parse(readFileSync(resolve(root, `src/i18n/locales/${lang}/${f}`), 'utf8')) as JsonObject]));
  const enLoc = load('en');
  const enTexts = enUi;
  for (const n of literalNames(lit)) ok(`15b soort c "${n}" is geen en-UI-tekst (anders soort a)`, !enTexts.has(n));
  for (const [id, list] of Object.entries(lit.display ?? {})) {
    const codes = codesOf(readFileSync(resolve(root, `public/docs/en/${id}.md`), 'utf8'));
    for (const d of list) ok(`15c display \`${d}\` staat als inline code in en/${id}.md`, codes.includes(d));
  }
  // _style.docs: elke taal, met het eigen UI-label voor Save en Relation type letterlijk in het voorbeeld.
  const keyOf = (text: string): [string, string] | undefined => {
    for (const [ns, o] of Object.entries(enLoc)) {
      const walk = (x: JsonObject, p: string): string | undefined => {
        for (const [k, v] of Object.entries(x)) {
          if (v === text) return `${p}${k}`;
          if (v && typeof v === 'object' && !Array.isArray(v)) { const r = walk(v as JsonObject, `${p}${k}.`); if (r) return r; }
        }
        return undefined;
      };
      const r = walk(o, '');
      if (r) return [ns, r];
    }
    return undefined;
  };
  const get = (o: JsonObject, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x as JsonObject | undefined)?.[k], o);
  const langs = readdirSync(resolve(root, 'i18n/termbase')).filter(f => f.endsWith('.json') && f !== 'concepts.json').map(f => f.replace('.json', ''));
  eq('15d 26 talen in de termbase', langs.length, 26);
  for (const lang of langs) {
    const style = (JSON.parse(readFileSync(resolve(root, `i18n/termbase/${lang}.json`), 'utf8')) as LangTermbase)._style;
    ok(`15e ${lang}: _style.docs bestaat`, typeof style?.docs === 'string' && style.docs.includes("'Choose *Save*.'"));
    const loc = load(lang);
    for (const label of ['Save', 'Relation type']) {
      const k = keyOf(label);
      const target = k ? get(loc[k[0]], k[1]) : undefined;
      ok(`15f ${lang}: het voorbeeld noemt *${String(target)}* (UI-tekst voor ${label})`, typeof target === 'string' && !!style?.docs?.includes(`*${target}*`));
    }
  }
}

// ── 16. Docs-straat v2: termbetekenis, tabbladen, voorbeeldnamen, avoid hard, invulplekken ─────
{
  // 16a: elke term krijgt zijn definitie mee (docs en UI).
  const withDef: Concept[] = concepts.map(c => c.id === 'successor' ? { ...c, definition: 'The task that follows another task in a relation.' } : c);
  const [p] = buildDocsPackages({ lang: 'cs', articles: [art], mode: 'missing', sources: {}, index, literal, concepts: withDef, termbase: tb });
  eq('16a docs-term met definition', p.pkg.terms[0]?.definition, 'The task that follows another task in a relation.');

  // 16b–f: tabbladen. "Planning" is in cs zowel het linttabblad (Plán) als een kolomgroep (Plánování).
  const nlM: JsonObject = { ribbon: { planning: 'Planning', start: 'Start' }, columns: { planning: 'Planning' } };
  const enM: JsonObject = { ribbon: { planning: 'Planning', start: 'Home' }, columns: { planning: 'Planning' } };
  const csM: JsonObject = { ribbon: { planning: 'Plán', start: 'Domů' }, columns: { planning: 'Plánování' } };
  const nlC: JsonObject = { settings: { planningTab: 'Planning' }, dlg: { deps: 'Relaties' } };
  const enC: JsonObject = { settings: { planningTab: 'Planning' }, dlg: { deps: 'Relations' } };
  const csC: JsonObject = { settings: { planningTab: 'Plán' }, dlg: { deps: 'Závislosti' } };
  const tIndex = buildEnLabelIndex([{ ns: 'menu', nl: nlM, en: enM, target: csM }, { ns: 'common', nl: nlC, en: enC, target: csC }], 'cs',
    { menu: { 'ribbon.planning': 'x', 'ribbon.start': 'x', 'columns.planning': 'x' }, common: { 'settings.planningTab': 'x', 'dlg.deps': 'x' } });
  const TAB = '# T\n\nThe same button is on *Planning › Relations*. Turn it on in tab *Planning*. Under *Planning*, choose the column.\n';
  const r = sectionLabels(0, TAB, tIndex, new Set());
  const tab = r.labels.find(l => l.en === 'Planning' && l.role === 'tab');
  const free = r.labels.find(l => l.en === 'Planning' && !l.role);
  eq('16b tabbladplek: alleen de tabbladnaam als kandidaat, met role en aantal', [tab?.targets, tab?.count], [['Plán'], 2]);
  eq('16c dezelfde naam buiten een tabbladplek: alle kandidaten', free?.targets, ['Plán', 'Plánování']);
  ok('16d C3 houdt alle sleutels van het label (geen nieuwe digest)', 'menu:columns.planning' in r.keys && 'common:settings.planningTab' in r.keys);
  eq('16d\' classifyItalic op een tabbladplek: role tab', classifyItalic('Planning', tIndex, new Set(), true)[0]?.role, 'tab');
  eq('16d" "*X* tab" telt, "tabs: *X*" niet', ['On the *Planning* tab.', 'Three tabs: *Planning* and more.']
    .map(t => sectionLabels(0, t, tIndex, new Set()).labels.find(l => l.en === 'Planning')?.role ?? null), ['tab', null]);
  const [tp] = buildDocsPackages({ lang: 'cs', articles: [{ id: 'tab', md: TAB }], mode: 'missing', sources: {}, index: tIndex, literal, concepts });
  const tRun = (out: string) => checkDocs(tp.pkg, tp.src, out);
  const TAB_OK = '# T\n\nStejné tlačítko je také na kartě *Plán › Závislosti*. Zapněte ho na kartě *Plán*. Pod *Plánování* zvolte sloupec.\n';
  eq('16e cs-geval goed: *Plán* op de tabbladplekken', tRun(TAB_OK).errors, []);
  has('16f\' een later paddeel telt niet als tabblad (cs: de groep *Plán* op het tabblad *Domů*)', tRun(TAB_OK.replace('*Plán › Závislosti*', '*Domů › Plán › Závislosti*').replace('kartě *Plán*', 'kartě *Plánování*')).errors,
    /label \*Planning\* staat 2× op een tabbladplek.*0× \*Plán\*/);
  has('16f cs-geval fout: *Plánování › Závislosti* (zoals in de proef)', tRun(TAB_OK.replace('*Plán › Závislosti*', '*Plánování › Závislosti*')).errors,
    /label \*Planning\* staat 2× op een tabbladplek.*1× \*Plán\*/);

  // 16g–l: voorbeeldnamen letterlijk, ook tussen aanhalingstekens en als linktekst van een examples://-link.
  const lits = new Set(['House extension', 'Refurbishment & Extension of a Family Home', 'Pour foundation']);
  eq('16g geciteerd en examples-link', quotedNames('In "House extension" and [Refurbishment & Extension of a Family Home](examples://x.ifc); not "other" or `"Pour foundation"`.', lits),
    ['Refurbishment & Extension of a Family Home', 'House extension']);
  const NAMES = '# N\n\nOpen “House extension”. See [Refurbishment & Extension of a Family Home](examples://showcase.ifc).\n';
  const [np] = buildDocsPackages({ lang: 'cs', articles: [{ id: 'n', md: NAMES }], mode: 'missing', sources: {}, index, literal: { sources: { x: [...lits] }, manual: [] }, concepts });
  eq('16h soort c uit aanhalingstekens en linktekst', np.pkg.labels.map(l => `${l.kind}:${l.en}`), ['c:Refurbishment & Extension of a Family Home', 'c:House extension']);
  const NAMES_CS = '# N\n\nOtevřete „House extension“. Viz [Refurbishment & Extension of a Family Home](examples://showcase.ifc).\n';
  eq('16i namen byte-gelijk: groen', checkDocs(np.pkg, np.src, NAMES_CS).errors, []);
  has('16j vertaalde projectnaam in de linktekst: rood', checkDocs(np.pkg, np.src, NAMES_CS.replace('[Refurbishment & Extension of a Family Home]', '[Rekonstrukce a přístavba rodinného domu]')).errors,
    /moet letterlijk blijven: "Refurbishment & Extension of a Family Home"/);
  eq('16k tutorialnamen: nl en en, zonder basislijn', tutorialNames("const PROJECT_NAME = n('Aanbouw woning', 'House extension');\nconst BASELINE_NAME = n('Basisplanning', 'Baseline');\n  { key: 'a', name: n('Stucwerk', 'Plastering'), days: 4 },\n  { name: n('Bob\\'s', 'Bob\\'s') },"),
    ['Aanbouw woning', 'House extension', 'Stucwerk', 'Plastering', "Bob's"]);
  eq('16l IFC-namen: project, taak, kalender, resource; STEP-codering terug', ifcNames([
    "#1=IFCPROJECT('g',#2,'De Vaart',$);", "#3=IFCTASK('g',#2,'Walls \\X2\\2014\\X0\\ Tower A',$);", "#4=IFCWORKCALENDAR('g',#2,'Construction calendar NL','x');",
    "#5=IFCCREWRESOURCE('g',#2,'Masonry crew','d');", "#6=IFCPROPERTYSINGLEVALUE('Status',$,$,$);", "#7=IFCTASK('g',#2,'Bob''s task',$);",
  ].join('\n')), ['De Vaart', 'Walls — Tower A', 'Construction calendar NL', 'Masonry crew', "Bob's task"]);
  eq('16l\' decodeIfcString', decodeIfcString("a''b \\X\\E9"), "a'b é");
  eq('16l" en-UI-tekst valt weg', literalCandidates(['Save', 'House extension', 'x'], new Set(['Save'])), ['House extension']);

  // 16m–r: avoid als los woord is hard; alleen vormen die het woord bevatten worden weggestreept.
  eq('16m "na" maakt van "nakonec" geen los "konec"', avoidWords('úkoly na sobě nakonec závisejí', ['na'], ['konec']), []);
  eq('16m\' eigen langere vorm streept weg', avoidWords('do konec projektu', ['konec projektu'], ['konec']), []);
  const cpTb: LangTermbase = {
    _style: { address: 'formal' },
    successor: { term: 'následník', forms: ['následník', 'následníka'], avoid: ['nástupce'], source: 'tbx', status: 'tbx' },
    'critical-path': { term: 'kritická cesta', forms: ['kritická cesta'], avoid: ['critical path'], source: 'model', status: 'model' },
  };
  const cpConcepts: Concept[] = [...concepts, { id: 'critical-path', kind: 'term', nl: 'kritiek pad', en: ['critical path'], definition: 'd' }];
  const CP = '# C\n\nThe method is CPM (Critical Path Method): the critical path decides. Each successor follows.\n';
  const [cp] = buildDocsPackages({ lang: 'cs', articles: [{ id: 'c', md: CP }], mode: 'missing', sources: {}, index, literal, concepts: cpConcepts, termbase: cpTb });
  const CP_CS = '# C\n\nMetoda je CPM (Critical Path Method): rozhoduje kritická cesta. Každý následník následuje.\n';
  eq('16n avoid-woord dat ook in de Engelse bron staat (afkorting uitgeschreven): geen fout', checkDocs(cp.pkg, cp.src, CP_CS).errors, []);
  has('16o avoid in proza: hard', checkDocs(cp.pkg, cp.src, CP_CS.replace('Každý následník', 'Každý nástupce')).errors, /vermijd "nástupce"/);
  eq('16p avoid in inline code: geen fout', checkDocs(cp.pkg, cp.src.replace('Each successor follows.', 'Each successor follows `x`.'), CP_CS.replace('následuje.', 'následuje `x`.').replace('Každý následník', 'Každý následník (`nástupce`)')).errors.filter(e => /vermijd/.test(e)), []);
  const soft = buildDocsPackages({ lang: 'cs', articles: [{ id: 'c', md: CP }], mode: 'missing', sources: {}, index,
    literal: { ...literal, avoidSoft: { cs: ['nástupce', 'jiné'] } }, concepts: cpConcepts, termbase: cpTb })[0];
  eq('16q avoidSoft: alleen de avoid-woorden van de termen in het pakket', soft.pkg.avoidSoft, ['nástupce']);
  const sr = checkDocs(soft.pkg, soft.src, CP_CS.replace('Každý následník', 'Každý nástupce'));
  ok('16r avoidSoft: waarschuwing, geen fout', sr.errors.length === 0 && sr.warnings.some(w => /vermijd "nástupce".*gewoon woord/.test(w)));

  // 16s–t: een {{…}} die de bron niet heeft (de proef: `*عرض كل الإصدارات ({{n}})*`).
  has('16s invulplek in de proza zonder bron: hard', run(CS_OK.replace('*Uložit*', '*Uložit ({{n}})*')).errors, /invulplek \{\{n\}\} staat niet in de bron/);
  const PH = '# P\n\nType `{{name}}` or {{name}} here.\n';
  const [pp] = buildDocsPackages({ lang: 'cs', articles: [{ id: 'p', md: PH }], mode: 'missing', sources: {}, index, literal, concepts });
  eq('16t invulplek die de bron ook heeft: geen fout', checkDocs(pp.pkg, pp.src, '# P\n\nNapište sem `{{name}}` nebo {{ name }}.\n').errors, []);

  // 16u–v: de tabbladsleutels volgen de code.
  const root = process.cwd();
  const types = readFileSync(resolve(root, 'src/state/slices/types.ts'), 'utf8');
  const union = /export type RibbonTab\s*=\s*([^;]+);/.exec(types)?.[1].match(/'([^']+)'/g)?.map(x => x.slice(1, -1));
  eq('16u RIBBON_TABS = RibbonTab in types.ts', [...RIBBON_TABS], union);
  const ribbon = readFileSync(resolve(root, 'src/components/layout/Ribbon/Ribbon.tsx'), 'utf8');
  ok('16u\' Ribbon.tsx toont menu:ribbon.<tab> met beeld→view en instellingen→settings', ribbon.includes("tMenu(`ribbon.${tab === 'beeld' ? 'view' : tab === 'instellingen' ? 'settings' : tab}`)")
    && ribbonTabKey('beeld') === 'menu:ribbon.view' && ribbonTabKey('planning') === 'menu:ribbon.planning');
  const panel = readFileSync(resolve(root, 'src/components/settings/SettingsPanelContent.tsx'), 'utf8');
  eq('16v SETTINGS_TAB_KEYS = de tabbladen van het instellingenvenster', [...SETTINGS_TAB_KEYS],
    [...panel.matchAll(/t\('(settings\.\w+Tab)'\)/g)].map(m => `common:${m[1]}`));
}

// ── 17. Getallen in UI-labels (labelregel gaat voor de cijferregel) ──────────────────────────
{
  const unitNl: JsonObject = { lib: { updated_one: '1 item bijgewerkt uit de bibliotheek', updated_other: '{{count}} items bijgewerkt uit de bibliotheek' } };
  const unitEn: JsonObject = { lib: { updated_one: '1 item updated from the library', updated_other: '{{count}} items updated from the library' } };
  const csT: JsonObject = { lib: {
    updated_one: '{{count}} položka aktualizována z knihovny', updated_few: '{{count}} položky aktualizovány z knihovny',
    updated_many: '{{count}} položky aktualizovány z knihovny', updated_other: '{{count}} položek aktualizováno z knihovny' } };
  const csIdx = buildEnLabelIndex([{ ns: 'common', nl: unitNl, en: unitEn, target: csT }], 'cs', { common: { 'lib.updated': 'x' } });
  const MD = '# L\n\nNa konci uvidíte *1 item updated from the library* po 3 krocích.\n';
  const [lp] = buildDocsPackages({ lang: 'cs', articles: [{ id: 'l', md: MD }], mode: 'missing', sources: {}, index: csIdx, literal, concepts });
  const lab = lp.pkg.labels.find(l => l.kind === 'a');
  ok('17a a-label: doelvorm met invulplek krijgt het getal van de en-tekst', (lab?.targets ?? []).includes('1 položka aktualizována z knihovny') && !(lab?.targets ?? []).some(t => t.includes('{{')));
  const lRun = (out: string) => checkDocs(lp.pkg, lp.src, out);
  eq('17b cs "1 položka aktualizována z knihovny": groen', lRun('# L\n\nNa konci uvidíte *1 položka aktualizována z knihovny* po 3 krocích.\n').errors, []);
  has('17c verkeerd label blijft rood', lRun('# L\n\nNa konci uvidíte *něco jiného* po 3 krocích.\n').errors, /moet letterlijk/);
  has('17d een getal buiten het label blijft verplicht', lRun('# L\n\nNa konci uvidíte *1 položka aktualizována z knihovny* po třech krocích.\n').errors, /getal 3 staat 1× in de bron/);

  const arEn: JsonObject = { m: { shows_one: '1 task shows the lag', shows_other: '{{count}} tasks show the lag' } };
  const arNl: JsonObject = { m: { shows_one: '1 taak toont de vertraging', shows_other: '{{count}} taken tonen de vertraging' } };
  const arT: JsonObject = { m: {
    shows_zero: 'لا مهام تعرض التأخير', shows_one: 'مهمة واحدة تعرض التأخير', shows_two: 'مهمتان تعرضان التأخير',
    shows_few: '{{count}} مهام تعرض التأخير', shows_many: '{{count}} مهمة تعرض التأخير', shows_other: '{{count}} مهمة تعرض التأخير' } };
  const arIdx = buildEnLabelIndex([{ ns: 'common', nl: arNl, en: arEn, target: arT }], 'ar', {});
  const AR_MD = '# A\n\nOpen the file; *1 task shows the lag*.\n';
  const [ap] = buildDocsPackages({ lang: 'ar', articles: [{ id: 'a', md: AR_MD }], mode: 'missing', sources: {}, index: arIdx, literal, concepts });
  eq('17e ar-label met uitgeschreven getal: geen cijferfout', checkDocs(ap.pkg, ap.src, '# A\n\nافتح الملف؛ *مهمة واحدة تعرض التأخير*.\n').errors, []);
}

// ── 18. Randgevallen van de cijfer-, plekhouder- en avoid-regel bij labels ───────────────────
{
  const e18: JsonObject = { s: {
    critical: 'Critical', status_one: 'Critical path: {{count}} task, {{duration}} work days', status_other: 'Critical path: {{count}} tasks, {{duration}} work days',
    dcma: 'DCMA 14-point assessment', cycle: 'Circular dependency between tasks: {{path}}', hour: "Hour task '{{task}}' has no valid working hours in its calendar" } };
  const n18: JsonObject = { s: {
    critical: 'Kritiek', status_one: 'Kritiek pad: {{count}} taak, {{duration}} werkdagen', status_other: 'Kritiek pad: {{count}} taken, {{duration}} werkdagen',
    dcma: 'DCMA 14-punts beoordeling', cycle: 'Cyclische relatie tussen taken: {{path}}', hour: "Uurtaak '{{task}}' heeft geen geldige werkuren in zijn kalender" } };
  const t18: JsonObject = { s: {
    critical: 'Kritický', status_one: 'Kritická cesta: {{count}} úkol, {{duration}} pracovních dnů', status_few: 'Kritická cesta: {{count}} úkoly, {{duration}} pracovních dnů',
    status_many: 'Kritická cesta: {{count}} úkolu, {{duration}} pracovních dnů', status_other: 'Kritická cesta: {{count}} úkolů, {{duration}} pracovních dnů',
    dcma: '14bodové hodnocení DCMA', cycle: 'Cyklická závislost mezi úkoly: {{path}}', hour: "Hodinový úkol '{{task}}' nemá platné pracovní hodiny ve svém kalendáři" } };
  const idx18 = buildEnLabelIndex([{ ns: 'common', nl: n18, en: e18, target: t18 }], 'cs',
    { common: Object.fromEntries(['s.critical', 's.status', 's.dcma', 's.cycle', 's.hour'].map(k => [k, 'x'])) });
  const tb18: LangTermbase = {
    _style: { address: 'formal', docs: 'Guides: formal.' },
    cycle: { term: 'cyklus', forms: ['cyklus', 'cyklu'], avoid: ['cyklická závislost'], source: 'tbx', status: 'tbx' },
  };
  const c18: Concept[] = [{ id: 'cycle', kind: 'term', nl: 'cyclus', en: ['cycle'], definition: 'd' }];
  const mk = (md: string) => buildDocsPackages({ lang: 'cs', articles: [{ id: 'x', md }], mode: 'missing', sources: {}, index: idx18, literal, concepts: c18, termbase: tb18 })[0];
  const errs = (md: string, out: string) => { const q = mk(md); return checkDocs(q.pkg, q.src, out).errors; };

  // 18a/b: een kort label (*Critical*) valt niet weg binnen een langer label (*Critical path: 21 tasks, 45 work days*).
  const SRC_A = '# T\n\n## Rekenen\n\nThe column *Critical* counts. The status bar says *Critical path: 21 tasks, 45 work days*. All 21 tasks are critical.\n';
  const OUT_A = '# T\n\n## Rekenen\n\nSloupec *Kritický* se počítá. Stavový řádek hlásí *Kritická cesta: 21 úkolů, 45 pracovních dnů*. Všech 21 úkolů je kritických.\n';
  eq('18a kort label binnen lang label: cijfers groen', errs(SRC_A, OUT_A), []);
  has('18b het getal buiten het label blijft verplicht', errs(SRC_A, OUT_A.replace('Všech 21 úkolů je kritických.', 'Všechny úkoly jsou kritické.')), /getal 21 staat 1× in de bron, 0× in de vertaling/);

  // 18c/d: een label met cijfers dat in de bron gewoon staat en in de vertaling cursief (of andersom).
  const SRC_B = '# T\n\n## Kwaliteit\n\nThe report starts with the DCMA 14-point assessment. See *DCMA 14-point assessment* for more.\n';
  eq('18c label met cijfer, plat en cursief: groen', errs(SRC_B, '# T\n\n## Kwaliteit\n\nZpráva začíná *14bodové hodnocení DCMA*. Více viz *14bodové hodnocení DCMA*.\n'), []);
  const OUT_B = '# T\n\n## Kwaliteit\n\nZpráva začíná *14bodové hodnocení DCMA*. Více viz *14bodové hodnocení DCMA*.\n';
  has('18d een ander getal blijft rood', errs(SRC_B + '\nIt has 5 checks.\n', OUT_B + '\nMá pět kontrol.\n'), /getal 5 staat 1× in de bron, 0× in de vertaling/);

  // 18e/f/g: enkele accolade in een label is een plekhouder; avoid-woord binnen een herkend label is geen fout.
  const SRC_C = '# T\n\n## Meldingen\n\nThe relations form a cycle: *Circular dependency between tasks: {path}* appears.\n';
  eq('18e {path} als plekhouder, avoid-woord in het label: groen', errs(SRC_C, '# T\n\n## Meldingen\n\nZávislosti tvoří cyklus: *Cyklická závislost mezi úkoly: {path}* se zobrazí.\n'), []);
  has('18f een ander label voor {path} blijft rood', errs(SRC_C, '# T\n\n## Meldingen\n\nZávislosti tvoří cyklus: *Cyklus vazeb mezi úkoly: {path}* se zobrazí.\n'), /volgens het patroon/);
  has('18g avoid-woord buiten een label blijft rood', errs(SRC_C, '# T\n\n## Meldingen\n\nZávislosti tvoří cyklická závislost: *Cyklická závislost mezi úkoly: {path}* se zobrazí.\n'), /vermijd "cyklická závislost"/);

  // 18h/i: typografische aanhalingstekens rond een plekhouder.
  const SRC_D = "# T\n\n## Valkuilen\n\nThe app can report *Hour task 'name' has no valid working hours in its calendar*.\n";
  eq('18h „naam“ i.p.v. \'naam\' rond de plek: groen', errs(SRC_D, '# T\n\n## Valkuilen\n\nAplikace může hlásit *Hodinový úkol „name“ nemá platné pracovní hodiny ve svém kalendáři*.\n'), []);
  has('18i andere woorden blijven rood', errs(SRC_D, '# T\n\n## Valkuilen\n\nAplikace může hlásit *Hodinový úkol „name“ nemá pracovní dobu*.\n'), /volgens het patroon/);
}

if (diffs.length === 0) {
  console.log(`OK  translate-docs: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-docs: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
