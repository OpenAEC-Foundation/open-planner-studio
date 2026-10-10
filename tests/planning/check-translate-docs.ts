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
 * `mergeArticle` een behouden verouderde sectie de nieuwe hash geven ⇒ 11e rood.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sectionHash, splitSections, structureHash } from '../../scripts/lib/docs-structure';
import {
  articleState, avoidWords, blocksOf, buildDocsPackages, buildEnLabelIndex, classifyItalic, codesOf, docsReleaseGaps,
  docsStatus, hasStem, pairChanged, hasWord, italicsOf, joinSections, labelsDigest, linkSections, literalNames, mergeArticle, normLabel,
  orderDocsSources, parseDocsIndex, renameDocLinks, renameInEntry, sectionLabels, serializeDocsIndex, titleOf,
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
  has('10p avoid als los woord (zacht)', run(CS_OK.replace('Následník', 'Nástupce')).warnings, /vermijd "nástupce"/);
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
  for (const [file, names] of Object.entries(lit.sources)) {
    const code = readFileSync(resolve(root, file), 'utf8');
    for (const n of names) ok(`15a ${file} bevat nog '${n}' (soort c)`, code.includes(`'${n}'`) || code.includes(`"${n}"`));
  }
  const flat = (o: JsonObject, out: string[] = []): string[] => {
    for (const v of Object.values(o)) { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object' && !Array.isArray(v)) flat(v as JsonObject, out); }
    return out;
  };
  const load = (lang: string) => Object.fromEntries(readdirSync(resolve(root, `src/i18n/locales/${lang}`)).map(f => [f.replace('.json', ''),
    JSON.parse(readFileSync(resolve(root, `src/i18n/locales/${lang}/${f}`), 'utf8')) as JsonObject]));
  const enLoc = load('en');
  const enTexts = new Set(Object.values(enLoc).flatMap(o => flat(o)).map(normLabel));
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
  eq('15d 25 talen in de termbase', langs.length, 25);
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

if (diffs.length === 0) {
  console.log(`OK  translate-docs: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-docs: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
