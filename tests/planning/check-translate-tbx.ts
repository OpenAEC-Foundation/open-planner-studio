/**
 * Vertaalstraat — termen zoeken (scripts/translate/tbx.ts, ontwerp §4.3) op een eigen mini-TBX
 * (geen echte Microsoft-TBX in de repo, licentie §13), plus de kandidaten voor de conceptenlijst
 * (candidates.ts, §4.2) en het samenvoegen van concepten en termen (termbase.ts).
 */
import { buildTermsPackages, candidatesFor, indexTbx, parseTbx, uiExamplesFor } from '../../scripts/translate/tbx';
import { collectCandidates, emphasisOf, normalizeCandidate } from '../../scripts/translate/candidates';
import { applyTerms, inconsistencyReport, mergeConcepts, type TermsOut } from '../../scripts/translate/termbase';
import type { Concept } from '../../scripts/translate/common';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

// Zelfde vorm als de Microsoft-export: één regel, en-US-langSet met definitie, doeltaal met noten.
const entry = (id: string, en: string, def: string, target: string, notes = '') =>
  `<termEntry id="${id}"><langSet xml:lang="en-US"><descripGrp><descrip type="definition">${def}</descrip></descripGrp>`
  + `<ntig><termGrp><term id="e${id}">${en}</term><termNote type="partOfSpeech">Noun</termNote><termNote type="grammaticalNumber">NotSelected</termNote></termGrp></ntig></langSet>`
  + `<langSet xml:lang="cs"><ntig><termGrp><term id="t${id}">${target}</term>${notes}</termGrp></ntig></langSet></termEntry>`;
const TBX = '<?xml version="1.0" encoding="utf-8"?><martif type="TBX" xml:lang="en-US"><martifHeader></martifHeader><text><body>'
  + entry('1', 'total slack', 'The amount of time that a task can slip before it delays the project.', 'celková časová rezerva',
    '<termNote type="partOfSpeech">Noun</termNote><termNote type="grammaticalGender">Feminine</termNote><termNote type="grammaticalNumber">Singular</termNote>')
  + entry('2', 'Critical Path', 'The series of tasks that must be completed on schedule.', 'kritická cesta')
  + entry('3', 'baseline', 'The original plan for a project.', 'směrný plán')
  + entry('4', 'baseline', 'In typography, the line on which characters sit &amp; align.', 'účaří')
  + entry('5', 'total slack time', 'Not the same term.', 'jiný')
  + entry('6', 'float', 'A floating-point number &lt;IEEE&gt;.', 'plovoucí &#x10D;íslo')
  + entry('7', 'critical path', 'The series of tasks that must be completed on schedule.', 'kritická cesta')
  + '<termEntry id="8"><langSet xml:lang="en-US"><ntig><termGrp><term>orphan</term></termGrp></ntig></langSet></termEntry>'
  + '</body></text></martif>';

// ── 1. TBX lezen ─────────────────────────────────────────────────────────────────────────────
const entries = parseTbx(TBX);
{
  eq('alleen entries met en én doelterm', entries.map(e => e.id), ['1', '2', '3', '4', '5', '6', '7']);
  eq('definitie en term', [entries[0].definition, entries[0].en, entries[0].target[0].term],
    ['The amount of time that a task can slip before it delays the project.', ['total slack'], 'celková časová rezerva']);
  eq('grammaticanoten', entries[0].target[0], { term: 'celková časová rezerva', partOfSpeech: 'Noun', gender: 'Feminine', number: 'Singular' });
  eq('entities gedecodeerd', [entries[3].definition, entries[5].definition, entries[5].target[0].term],
    ['In typography, the line on which characters sit & align.', 'A floating-point number <IEEE>.', 'plovoucí číslo']);
}

// ── 2. Kandidaten per concept ────────────────────────────────────────────────────────────────
const idx = indexTbx(entries);
const concepts: Concept[] = [
  { id: 'total-float', kind: 'term', nl: 'totale speling', en: ['total float', 'total slack'], definition: 'Slack of a task.' },
  { id: 'critical-path', kind: 'term', nl: 'kritiek pad', en: ['critical path'], definition: 'Longest path.' },
  { id: 'baseline', kind: 'term', nl: 'basislijn', en: ['baseline'], definition: 'Saved copy of the schedule.' },
  { id: 'rel-fs', kind: 'token', nl: 'FS', en: ['FS'], definition: 'Finish-to-start code.' },
  { id: 'ifc', kind: 'keep', nl: 'IFC', en: ['IFC'], definition: 'File format.' },
];
{
  const tf = candidatesFor(concepts[0], idx);
  eq('exact via synoniem, niet via "total slack time"', tf.map(c => c.term), ['celková časová rezerva']);
  eq('kandidaat draagt het gevonden en-woord en de definitie', [tf[0].en, tf[0].definition],
    ['total slack', 'The amount of time that a task can slip before it delays the project.']);
  eq('hoofdletterongevoelig, dubbele (zelfde term + definitie) één keer', candidatesFor(concepts[1], idx).map(c => c.term), ['kritická cesta']);
  eq('meer betekenissen → meer kandidaten', candidatesFor(concepts[2], idx).map(c => c.term), ['směrný plán', 'účaří']);

  const packs = buildTermsPackages({ lang: 'cs', concepts, idx, size: 2 });
  eq('token/keep niet in een pakket; pakketten van 2', packs.map(p => p.concepts.map(c => c.id)), [['total-float', 'critical-path'], ['baseline']]);
  eq('pakket-ids', packs.map(p => p.id), ['terms-01', 'terms-02']);
  ok('nieuwe taal: geen ui-voorbeelden', packs[0].existingUi === false && packs[0].concepts[0].ui === undefined);
  const skip = buildTermsPackages({ lang: 'cs', concepts, idx, termbase: { _style: { address: 'formal' }, baseline: { term: 'směrný plán', forms: ['směrný plán'], source: 'tbx', status: 'tbx' } } });
  eq('concepten met een termregel worden overgeslagen', skip[0].concepts.map(c => c.id), ['total-float', 'critical-path']);
  eq('stijl gaat mee', skip[0].style, { address: 'formal' });

  const ui = [{
    ns: 'task',
    nl: { a: 'Totale speling', b: 'Iets anders', c: 'Kritiek pad', f_one: '{{count}} basislijn', f_other: '{{count}} basislijnen' },
    en: { a: 'Total float', b: 'Something else', c: 'Critical path', f_one: '{{count}} baseline', f_other: '{{count}} baselines' },
    target: { a: 'Marge totale', b: 'Autre chose', c: 'Chemin critique', f_one: '{{count}} référence', f_other: '{{count}} références' },
  }];
  eq('ui-voorbeelden via nl of en', uiExamplesFor(concepts[0], ui), [{ key: 'task:a', nl: 'Totale speling', en: 'Total float', target: 'Marge totale' }]);
  eq('ui-voorbeeld van een familie toont other', uiExamplesFor(concepts[2], ui).map(x => x.target), ['{{count}} références']);
  const existing = buildTermsPackages({ lang: 'fr', concepts, idx, ui: c => uiExamplesFor(c, ui) });
  ok('bestaande taal: ui-voorbeelden in het pakket', existing[0].existingUi && existing[0].concepts[1].ui?.[0]?.target === 'Chemin critique');
  const many = buildTermsPackages({
    lang: 'fr', concepts, idx,
    ui: c => uiExamplesFor(c, [{ ns: 'x', nl: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, 'Kritiek pad'])), en: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, 'Critical path'])), target: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, 'Chemin critique'])) }]),
  });
  eq('max 5 ui-voorbeelden per concept', many[0].concepts[1].ui?.length, 5);
}

// ── 3. Kandidaten voor de conceptenlijst ─────────────────────────────────────────────────────
{
  eq('cursief pad wordt in delen geknipt', emphasisOf('Open *Home › Tasks › Link ▾* and press **Calculate** (`F5`).'),
    ['Calculate', 'Home', 'Tasks', 'Link']);
  eq('inline code telt niet', emphasisOf('Type `*x*` here.'), []);
  eq('opschonen: leestekens', normalizeCandidate(' "Total float", '), 'Total float');
  ok('opschonen: te lang, getal, stopwoord, code', [
    normalizeCandidate('one two three four five six'), normalizeCandidate('42'), normalizeCandidate('the'), normalizeCandidate('{{name}}'),
  ].every(x => x === null));
  const all = collectCandidates({
    ui: [{ ns: 'task', nl: { a: 'Totale speling', b: 'Kritiek pad', c: 'Taak {{name}} heeft een kritiek pad' }, en: { a: 'Total float', b: 'Critical path', c: 'Task {{name}} is on the critical path' } }],
    docs: [{ id: 'uitleg-x', md: 'The *Total float* is shown. See *Critical path*. *Total Float* again.' }],
    minPhraseFreq: 1,
  });
  const tf = all.find(c => c.term.toLowerCase() === 'total float');
  ok('kandidaat uit ui + docs samengeteld', tf !== undefined && tf.freq === 3 && tf.ui === 1 && tf.docs === 2);
  eq('nl-tekst en voorbeelden bij de kandidaat', [tf?.nl, tf?.examples], [['Totale speling'], ['task:a', 'docs:uitleg-x']]);
  eq('meest voorkomende schrijfwijze wint', tf?.term, 'Total float');
  ok('gesorteerd op frequentie', all[0].freq >= all[all.length - 1].freq);
  ok('woordgroep uit een langere tekst', all.some(c => c.term.toLowerCase() === 'critical path' && c.ui >= 1));
}

// ── 4. Concepten samenvoegen ─────────────────────────────────────────────────────────────────
{
  const a: Concept = { id: 'baseline', kind: 'term', nl: 'basislijn', en: ['baseline'], definition: 'Saved copy.' };
  const b: Concept = { id: 'critical-path', kind: 'term', nl: 'kritiek pad', en: ['critical path'], definition: 'Longest path.' };
  const res = mergeConcepts([a], [
    { file: 'candidates-01.out.json', concepts: [b, { ...a }] },
    { file: 'candidates-02.out.json', concepts: [{ ...b, definition: 'Other text.' }] },
  ]);
  eq('dedup op id, gesorteerd', res.concepts.map(c => c.id), ['baseline', 'critical-path']);
  eq('één nieuw concept', res.added, 1);
  eq('verschil = conflict, eerste blijft', [res.conflicts.length, res.concepts[1].definition], [1, 'Longest path.']);
  ok('conflict noemt beide bestanden', res.conflicts[0].includes('candidates-02.out.json') && res.conflicts[0].includes('candidates-01.out.json'));
  eq('vaste veldvolgorde', Object.keys(mergeConcepts([], [{ file: 'x', concepts: [{ definition: 'd', en: ['x'], nl: 'x', kind: 'term', id: 'x', enBySource: { p6: 'x' } } as Concept] }]).concepts[0]),
    ['id', 'kind', 'nl', 'en', 'enBySource', 'definition']);
}

// ── 5. Termen verwerken + inconsistentierapport ──────────────────────────────────────────────
{
  const outs: TermsOut[] = [{
    _style: { address: 'informal', note: 'tu' },
    'critical-path': { term: 'chemin critique', forms: ['chemin critique', 'chemins critiques'], source: 'existing-ui', status: 'existing-ui', uiVariants: ['parcours critique'] },
    'total-float': { term: 'marge totale', forms: ['marge totale', 'marges totales'], source: 'existing-ui', status: 'existing-ui', tbxTerm: 'marge libre totale', note: 'MS Project zegt anders' },
  }];
  const tb = applyTerms({ _style: { address: 'formal' }, baseline: { term: 'planification initiale', forms: ['planification initiale'], source: 'tbx', status: 'tbx' } }, outs, concepts);
  eq('volgorde: _style, dan concepten in volgorde van concepts.json', Object.keys(tb), ['_style', 'total-float', 'critical-path', 'baseline']);
  eq('bestaande _style wint', tb._style, { address: 'formal' });
  eq('rapportvelden niet in de termbase', tb['critical-path'], { term: 'chemin critique', forms: ['chemin critique', 'chemins critiques'], source: 'existing-ui', status: 'existing-ui' });
  const md = inconsistencyReport('fr', outs, concepts);
  ok('rapport: variant genoemd', md.includes('*parcours critique*') && md.includes('Eén concept, meer vertalingen (1)'));
  ok('rapport: afwijking van de vakterm', md.includes('vakterm (TBX) *marge libre totale*') && md.includes('Afwijking van de vakterm (1)'));
}

if (diffs.length === 0) {
  console.log(`OK  translate-tbx: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-tbx: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
