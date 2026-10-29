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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { sectionHash, splitSections, structureHash } from '../../scripts/lib/docs-structure';
import {
  articleState, avoidWords, blocksOf, buildDocsPackages, buildEnLabelIndex, classifyItalic, codesOf, decodeIfcString, docsReleaseGaps,
  docsStatus, hasStem, ifcNames, pairChanged, hasWord, italicsOf, joinSections, labelsDigest, linkSections, literalCandidates, literalNames,
  mergeArticle, normLabel, orderDocsSources, parseDocsIndex, quotedNames, renameDocLinks, renameInEntry, ribbonTabKey, sectionLabels,
  serializeDocsIndex, titleOf, tutorialNames, RIBBON_TABS, SETTINGS_TAB_KEYS,
  type DocsLiteral, type DocsSources,
} from '../../scripts/translate/docs';
import { checkDocs, checkDocsArticle, checkUi } from '../../scripts/translate/gates';
import type { Concept, LangTermbase } from '../../scripts/translate/common';
import { applyUiPackage, buildUiPackages, uiUnitStates, type NsInput, type UiOut, type UiSources } from '../../scripts/translate/ui';
import { unitMap } from '../../scripts/translate/common';
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
eq('02j normLabel: gemengde eindtekens en witruimte', normLabel('  Opslaan \t… . : ...\n'), 'Opslaan');
eq('02k normLabel: punten middenin blijven staan', normLabel('Versie 1.2: klaar!'), 'Versie 1.2: klaar!');
eq('02l normLabel: alleen eindtekens', normLabel(' ... … : . '), '');
eq('02m normLabel: pijlen en hun witruimte', [normLabel(' A \t▾\n B '), normLabel(' A ▾ ▾ B ')], ['A B', 'A  B']);
{
  // Een regressie mag de suite niet laten hangen: voer de echte functie met tijdslimiet uit.
  const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const normalize = (${normLabel.toString()});
    const samples = [
      'Opslaan' + '.'.repeat(100_000) + '!',
      'Opslaan' + ' '.repeat(100_000) + '!',
      'Opslaan' + ' . : … '.repeat(20_000),
    ];
    if (normalize(samples[0]) !== samples[0] || normalize(samples[1]) !== samples[1]
      || normalize(samples[2]) !== 'Opslaan') process.exit(1);
  `], { encoding: 'utf8', timeout: 5_000 });
  eq('02n normLabel: lange vijandige invoer eindigt binnen de proceslimiet',
    { status: probe.status, error: probe.error?.message, stderr: probe.stderr },
    { status: 0, stderr: '' });
}

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
  const fresh = buildEnLabelIndex([{ ns: 'common', nl, en, target: cs }], 'be', {}); // be: nieuwe taal, geen basislijn
  eq('03i nieuwe taal zonder bron-hash: geen doeltekst (Engelse vulling)', fresh.exact.get('Relation type')?.[0].target, undefined);
  // Een invulplek slokt geen menupad op (zh: *Resources › Manage › New resource* werd "{{count}} 个资源").
  const pathIdx = buildEnLabelIndex([{ ns: 'menu',
    nl: { m: { manage: 'Beheren', sel: '{{count}} geselecteerde resources' } },
    en: { m: { manage: 'Manage', sel: '{{count}} selected resources' } },
    target: { m: { manage: 'Spravovat', sel: '{{count}} vybraných zdrojů' } } }], 'cs', {});
  eq('03j pad dat op een patroon eindigt: per deel, patroon alleen op het laatste deel',
    classifyItalic('Home › Manage › Two selected resources', pathIdx, new Set()).map(c => `${c.kind}:${c.en}`),
    ['a:Manage', 'b:Two selected resources']);
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
  // fr "2 dernières semaines" zit in "12 dernières semaines": wegstrepen mag het getal 12 niet halveren.
  const MD2 = '# L\n\nSee *1 item updated from the library* or 11 items updated from the library.\n';
  const [lp2] = buildDocsPackages({ lang: 'cs', articles: [{ id: 'l2', md: MD2 }], mode: 'missing', sources: {}, index: csIdx, literal, concepts });
  eq('17e label als deel van een langer getal: 11 blijft 11', checkDocs(lp2.pkg, lp2.src,
    '# L\n\nViz *1 položka aktualizována z knihovny* nebo 11 položka aktualizována z knihovny.\n').errors, []);

  const arEn: JsonObject = { m: { shows_one: '1 task shows the lag', shows_other: '{{count}} tasks show the lag' } };
  const arNl: JsonObject = { m: { shows_one: '1 taak toont de vertraging', shows_other: '{{count}} taken tonen de vertraging' } };
  const arT: JsonObject = { m: {
    shows_zero: 'لا مهام تعرض التأخير', shows_one: 'مهمة واحدة تعرض التأخير', shows_two: 'مهمتان تعرضان التأخير',
    shows_few: '{{count}} مهام تعرض التأخير', shows_many: '{{count}} مهمة تعرض التأخير', shows_other: '{{count}} مهمة تعرض التأخير' } };
  const arIdx = buildEnLabelIndex([{ ns: 'common', nl: arNl, en: arEn, target: arT }], 'ar', {});
  const AR_MD = '# A\n\nOpen the file; *1 task shows the lag*.\n';
  const [ap] = buildDocsPackages({ lang: 'ar', articles: [{ id: 'a', md: AR_MD }], mode: 'missing', sources: {}, index: arIdx, literal, concepts });
  eq('17e ar-label met uitgeschreven getal: geen cijferfout', checkDocs(ap.pkg, ap.src, '# A\n\nافتح الملف؛ *مهمة واحدة تعرض التأخير*.\n').errors, []);

  // Twee en-labels met dezelfde vertaling (cs ref-meldingen): knop "Out of date — recalculate (F5)" en tooltip
  // "Schedule out of date — recalculate (F5)". De vertaling van de cursieve tooltip mag niet ook de knoptekst wegstrepen.
  const f5En: JsonObject = { sb: { stale: 'Out of date — recalculate (F5)', staleTip: 'Schedule out of date — recalculate (F5)' } };
  const f5Nl: JsonObject = { sb: { stale: 'Verouderd — herbereken (F5)', staleTip: 'Planning verouderd — herbereken (F5)' } };
  const f5Cs: JsonObject = { sb: { stale: 'Plán je zastaralý — přepočítejte (F5)', staleTip: 'Plán je zastaralý — přepočítejte (F5)' } };
  const f5Idx = buildEnLabelIndex([{ ns: 'common', nl: f5Nl, en: f5En, target: f5Cs }], 'cs', {});
  const F5_MD = '# S\n\n**Out of date — recalculate (F5)** (tooltip: *Schedule out of date — recalculate (F5)*).\n';
  const [fp] = buildDocsPackages({ lang: 'cs', articles: [{ id: 's', md: F5_MD }], mode: 'missing', sources: {}, index: f5Idx, literal, concepts });
  eq('17f twee labels, één vertaling: het getal buiten het label telt aan beide kanten even vaak', checkDocs(fp.pkg, fp.src,
    '# S\n\n**Plán je zastaralý — přepočítejte (F5)** (bublina: *Plán je zastaralý — přepočítejte (F5)*).\n').errors, []);
  // Tegentest (review PR 2): het label vet in plaats van cursief mag een weggelaten getal elders niet afdekken.
  const F5_MD2 = '# S\n\nClick *Schedule out of date — recalculate (F5)*. Then press F5 again.\n';
  const [fp2] = buildDocsPackages({ lang: 'cs', articles: [{ id: 's2', md: F5_MD2 }], mode: 'missing', sources: {}, index: f5Idx, literal, concepts });
  has('17g label vet in plaats van cursief + getal weggelaten: rood', checkDocs(fp2.pkg, fp2.src,
    '# S\n\nKlikněte na **Plán je zastaralý — přepočítejte (F5)**. Pak stiskněte klávesu znovu.\n').errors, /getal 5 staat 1× in de bron, 0×/);
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

// ── 19. Mijlpaalmeldingen: echte broncitaten, één pluralcategorie en de UI→docs-keten (#171) ──
{
  const namedKeys = ['milestoneRefusedAssignments', 'milestoneRefusedSummary', 'milestoneClearedOnPhase'];
  const allKeys = namedKeys.flatMap(key => [key, `${key}Many`]);
  const readCommon = (lang: string) => JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${lang}/common.json`, import.meta.url), 'utf8')) as JsonObject;
  const subset = (data: JsonObject): JsonObject => ({ notifications: Object.fromEntries(
    Object.entries(data.notifications as JsonObject).filter(([key]) =>
      allKeys.includes(key.replace(/_(zero|one|two|few|many|other)$/, ''))),
  ) });
  const nl = subset(readCommon('nl'));
  const en = subset(readCommon('en'));
  const enUnits = unitMap(en);
  const ref = readFileSync(new URL('../../public/docs/en/ref-meldingen.md', import.meta.url), 'utf8');
  const quotes = italicsOf(ref.split('\n').filter(line =>
    line.startsWith('- **Milestone refused**') || line.startsWith('- **Milestone flag removed**')).join('\n'));

  for (const lang of ['zh', 'ja', 'ko', 'lo']) {
    eq(`19 ${lang}: één CLDR-categorie`, new Intl.PluralRules(lang).resolvedOptions().pluralCategories, ['other']);
    // Migratie-fixture: de bestaande telteksten blijven, de naamvertaling ontbreekt nog (B5).
    // Alleen in het geheugen vullen we de namen met Engels; dit levert geen localevertalingen op.
    const real = readCommon(lang).notifications as JsonObject;
    let target: JsonObject = { notifications: Object.fromEntries(namedKeys.map(key =>
      [`${key}Many_other`, real[`${key}Many_other`] ?? (en.notifications as JsonObject)[`${key}Many_other`]])) };
    const sources: UiSources = {};
    const input = () => ({ ns: 'common', nl, en, target });
    const expectedStates = namedKeys.flatMap(key => [
      { key: `notifications.${key}`, state: 'missing' },
      { key: `notifications.${key}Many`, state: 'unhashed' },
    ]);
    eq(`19 ${lang}: geen onterechte actuele bronhash na splitsing`, uiUnitStates(lang, input(), sources), expectedStates);
    const packs = (mode: 'missing' | 'stale') => buildUiPackages({ lang, inputs: [input()], mode, sources, concepts: [] });
    const missing = packs('missing');
    const stale = packs('stale');
    eq(`19 ${lang}: --missing vindt de naamteksten`, missing.flatMap(p => p.items.map(i => i.key)), namedKeys.map(k => `notifications.${k}`));
    eq(`19 ${lang}: --stale bewaart de bestaande telteksten`, stale.flatMap(p => p.items.map(i => [i.key, i.previous])),
      namedKeys.map(k => [`notifications.${k}Many`, { other: (target.notifications as JsonObject)[`${k}Many_other`] }]));
    const before = buildEnLabelIndex([input()], lang, sources);
    const outputs: UiOut = {};
    for (const pkg of [...missing, ...stale]) {
      const out: UiOut = {};
      for (const item of pkg.items) {
        out[item.key] = item.previous ?? enUnits.get(item.key)!.text;
        outputs[item.key] = out[item.key];
      }
      eq(`19 ${lang}: echte UI-poort accepteert de juiste sleutelsoorten`, checkUi(pkg, out).errors, []);
      // Een teltekst op de naamsleutel mist {{task}}/{{phase}} en blijft hard rood.
      const first = pkg.items[0];
      if (first && !first.plural) {
        ok(`19 ${lang}: teltekst mag de naam niet vervangen`, checkUi(pkg, { ...out, [first.key]: '2 tasks cannot become milestones.' }).errors.length > 0);
      }
      target = applyUiPackage(pkg, out, target, nl, sources);
    }
    eq(`19 ${lang}: apply bevestigt alle zes bronnen`, uiUnitStates(lang, input(), sources).map(u => u.state), allKeys.map(() => 'current'));
    eq(`19 ${lang}: na apply geen ontbrekende of verouderde pakketten`, [packs('missing').length, packs('stale').length], [0, 0]);
    const after = buildEnLabelIndex([input()], lang, sources);
    const keysInArticle = new Set(quotes.flatMap(q => classifyItalic(q, after, new Set()).flatMap(c => c.hits.map(h => h.key))));
    eq(`19 ${lang}: bronartikel citeert elk van de zes betekenissen`, [...keysInArticle].sort(), allKeys.map(k => `common:notifications.${k}`).sort());

    for (const key of allKeys) {
      const path = `common:notifications.${key}`;
      const quote = quotes.find(q => classifyItalic(q, after, new Set()).some(c => c.hits.some(h => h.key === path)))!;
      const src = `# Milestones\n\n*${quote}*\n`;
      const make = (idx: typeof after) => buildDocsPackages({ lang, articles: [{ id: 'milestones', md: src }],
        mode: 'missing', sources: {}, index: idx, literal, concepts: [] })[0].pkg;
      const render = (key: string) => {
        const text = outputs[`notifications.${key}`];
        return (typeof text === 'string' ? text : text.other).replace(/\{\{(task|phase)\}\}/g, 'Metselen').replace(/\{\{count\}\}/g, '2');
      };
      const pkg = make(after);
      const out = `# Milestones\n\n*${render(key)}*\n`;
      eq(`19 ${lang}/${key}: runtimezin voldoet aan de echte Help-labelpoort`, checkDocs(pkg, src, out).errors, []);
      const paired = key.endsWith('Many') ? key.slice(0, -4) : `${key}Many`;
      has(`19 ${lang}/${key}: naam en aantal zijn niet uitwisselbaar`,
        checkDocs(pkg, src, `# Milestones\n\n*${render(paired)}*\n`).errors, /label .*volgens het patroon/);
      if (!key.endsWith('Many')) {
        const result = checkDocs(make(before), src, out);
        eq(`19 ${lang}/${key}: ontbrekende UI-naam eist geen oude other-tekst`, result.errors, []);
        has(`19 ${lang}/${key}: ontbrekende UI-naam blijft zichtbaar als waarschuwing`, result.warnings, /nog geen vertaling in de UI/);
      }
    }
  }
}

// 104: echte CLI-keten voor UI/docs-zegels en check-docs, niet alleen de pure pakketfuncties.
{
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const work = mkdtempSync(join(tmpdir(), 'ops-docs-cli-'));
  const cli = join(work, 'translate.mjs');
  const dir = join(work, 'build/translate/cs');
  const sealsPath = join(work, 'build/translate-seal/cs.json');
  const writeText = (path: string, text: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
  const write = (path: string, value: unknown) => writeText(path, JSON.stringify(value));
  const run = (...args: string[]) => {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: work, encoding: 'utf8', timeout: 30_000 });
    return { status: r.status, out: `${r.stdout}${r.stderr}${r.error?.message ?? ''}` };
  };
  const expectExit = (label: string, args: string[], want: number) => {
    const r = run(...args);
    eq(`104 ${label} (${r.out})`, r.status, want);
    return r.out;
  };
  try {
    const built = spawnSync(join(root, 'node_modules/.bin/esbuild'), [join(root, 'scripts/translate/cli.ts'),
      '--bundle', '--platform=node', '--format=esm', '--log-level=error', `--outfile=${cli}`], { encoding: 'utf8', timeout: 30_000 });
    if (built.status !== 0) throw new Error(`docs CLI-bundel faalde: ${built.stderr}`);
    symlinkSync(join(root, 'scripts'), join(work, 'scripts'), 'dir');
    symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'), 'dir');
    write(join(work, 'i18n/termbase/concepts.json'), []);
    write(join(work, 'i18n/docs-literal.json'), { sources: {}, manual: [] });
    for (const [lang, text] of [['nl', 'Voorbeeld'], ['en', 'Example'], ['cs', 'Stará hodnota']]) {
      write(join(work, 'src/i18n/locales', lang, 'common.json'), { sample: text });
    }
    const targetUi = join(work, 'src/i18n/locales/cs/common.json');
    expectExit('UI prepare', ['prepare', 'ui', 'cs', '--all'], 0);
    const uiPkg = join(dir, 'ui-common-01.json');
    const uiSource = readFileSync(uiPkg, 'utf8');
    const uiSeal = readFileSync(sealsPath, 'utf8');
    write(join(dir, 'ui-common-01.out.json'), { sample: 'Ukázka' });
    const originalUi = readFileSync(targetUi, 'utf8');
    rmSync(sealsPath);
    expectExit('UI zonder zegel geweigerd', ['apply', 'ui', 'cs'], 1);
    eq('104 UI zonder zegel blijft bytegelijk', readFileSync(targetUi, 'utf8'), originalUi);
    writeText(sealsPath, uiSeal);
    writeText(uiPkg, uiSource + '\n');
    expectExit('UI gewijzigd pakket geweigerd', ['apply', 'ui', 'cs'], 1);
    eq('104 gewijzigde UI-bron laat doel bytegelijk', readFileSync(targetUi, 'utf8'), originalUi);
    const red = expectExit('UI packages red', ['packages', 'ui', 'cs', '--red'], 0);
    eq('104 rode pakketlijst noemt veranderd pakket', JSON.parse(red), [['cs', 'ui-common-01']]);
    writeText(uiPkg, uiSource);
    expectExit('UI intact pakket', ['apply', 'ui', 'cs'], 0);
    eq('104 UI intact toegepast', JSON.parse(readFileSync(targetUi, 'utf8')).sample, 'Ukázka');

    const article = 'howto-test';
    const enPath = join(work, 'public/docs/en', `${article}.md`);
    const targetDoc = join(work, 'public/docs/cs', `${article}.md`);
    const source = '# Guide\n\nUse `F5` and wait 3 days.\n';
    const translated = '# Průvodce\n\nPoužijte `F5` a počkejte 3 dny.\n';
    write(join(work, 'public/docs/manifest.json'), { version: 2, articles: [{ id: article, kind: 'howto', title: { nl: 'Gids', en: 'Guide' } }] });
    writeText(enPath, source);
    expectExit('docs prepare', ['prepare', 'docs', 'cs', '--missing'], 0);
    const docJson = join(dir, `${article}.json`);
    const docSrc = join(dir, `${article}.src.md`);
    const savedJson = readFileSync(docJson, 'utf8');
    const savedSrc = readFileSync(docSrc, 'utf8');
    const savedSeals = readFileSync(sealsPath, 'utf8');
    writeText(join(dir, `${article}.out.md`), translated);
    for (const [path, original] of [[docJson, savedJson], [docSrc, savedSrc]]) {
      writeText(path, original + '\n');
      expectExit('docs gewijzigde bron geweigerd', ['apply', 'docs', 'cs'], 1);
      eq('104 geen artikel bij geweigerde docs-bron', existsSync(targetDoc), false);
      eq('104 geen C3-hash bij geweigerde docs-bron', existsSync(join(work, 'i18n/docs-sources/cs.json')), false);
      writeText(path, original);
    }
    rmSync(sealsPath);
    expectExit('docs zonder zegel geweigerd', ['apply', 'docs', 'cs'], 1);
    eq('104 geen artikel bij ontbrekend docs-zegel', existsSync(targetDoc), false);
    writeText(sealsPath, savedSeals);
    expectExit('docs intact toegepast', ['apply', 'docs', 'cs'], 0);
    expectExit('check-docs geldig expliciet', ['check-docs', 'cs', article], 0);
    const savedTranslation = readFileSync(targetDoc, 'utf8');
    writeText(targetDoc, savedTranslation.replace('`F5`', '`F6`'));
    expectExit('check-docs vangt verkeerde inline-code', ['check-docs', 'cs', article], 1);
    writeText(targetDoc, savedTranslation);
    expectExit('check-docs hersteld', ['check-docs', 'cs', article], 0);
    expectExit('check-docs ontbrekend artikel', ['check-docs', 'cs', 'bestaat-niet'], 1);
    writeText(enPath, source.replace('3 days', '4 days'));
    const stale = expectExit('alle docs meldt stale zonder harde weigering', ['check-docs', 'cs'], 0);
    eq('104 verouderd artikel is expliciet gemeld', stale.includes('verouderd overgeslagen'), true);
    expectExit('expliciete stale check is rood', ['check-docs', 'cs', article], 1);
    expectExit('stale artikel opnieuw voorbereiden', ['prepare', 'docs', 'cs', '--ids', article], 0);
    writeText(join(dir, `${article}.out.md`), translated.replace('3 dny', '4 dny'));
    expectExit('stale artikel opnieuw toepassen', ['apply', 'docs', 'cs'], 0);
    expectExit('bijgewerkt artikel weer groen', ['check-docs', 'cs', article], 0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (diffs.length === 0) {
  console.log(`OK  translate-docs: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-docs: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
