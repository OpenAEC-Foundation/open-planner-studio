// Contract C1 van de vertaalstraat (`scripts/lib/docs-structure.ts`): secties, hashes, structuur en
// de parser-subset. De docs-straat en `verify-docs.ts` lezen exact deze functies; deze check pint het
// contract vast. Exit 0 = groen.
//
// Mutatiebewijs: in `splitSections` een `## ` binnen een codeblok wél als kop zien ⇒ 05 rood;
// `sectionHash` zonder `trimEnd` ⇒ 11 rood; in `structureOf` het `#anker` meenemen ⇒ 22 rood;
// de tabelregel uit `subsetErrors` halen ⇒ 41 rood.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  sectionHash, splitSections, structureHash, structureOf, subsetErrors,
} from '../../scripts/lib/docs-structure';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const doc = [
  '# Titel',
  '',
  'Inleiding met een [link](docs://howto-a#stap-1).',
  '',
  '## Eerste',
  '',
  '- punt een',
  '- punt twee',
  '',
  '### Onder',
  '',
  '1. stap',
  '',
  '```',
  '## geen kop',
  '- geen lijst',
  '```',
  '',
  '## Tweede',
  '',
  '![Beeld](img/{lang}/x.webp) en [voorbeeld](examples://demo.ifc) en `## code`.',
  '',
].join('\n');

// 1. Secties.
const sections = splitSections(doc);
eq('01 drie secties', sections.length, 3);
eq('02 sectie 0 heeft geen kop', sections[0].heading, null);
ok('03 sectie 0 = H1 + inleiding', sections[0].text.startsWith('# Titel') && sections[0].text.includes('Inleiding'));
eq('04 koppen van de secties', sections.map(s => s.heading), [null, 'Eerste', 'Tweede']);
ok('05 ## in een codeblok is geen sectiegrens', sections[1].text.includes('## geen kop'));
ok('06 sectie begint met de kopregel', sections[1].text.startsWith('## Eerste'));
eq('07 secties samen = de tekst', sections.map(s => s.text).join('\n'), doc);
eq('08 artikel dat met ## begint: lege sectie 0', splitSections('## A\n\nx').map(s => [s.heading, s.text]), [[null, ''], ['A', '## A\n\nx']]);
eq('09 CRLF wordt LF', splitSections('# T\r\n\r\n## A\r\nx').map(s => s.text), ['# T\n', '## A\nx']);

// 2. Sectiehash.
const expected = createHash('sha256').update('## A\nx', 'utf8').digest('hex').slice(0, 16);
eq('10 sha256, eerste 16 hex', sectionHash('## A\nx'), expected);
eq('11 witruimte aan het eind telt niet', sectionHash('## A\nx\n\n  \n'), expected);
eq('12 CRLF telt niet', sectionHash('## A\r\nx'), expected);
ok('13 andere tekst ⇒ andere hash', sectionHash('## A\ny') !== expected);
ok('14 16 hex-tekens', /^[0-9a-f]{16}$/.test(sectionHash('')));

// 3. Structuur.
eq('20 structureOf', structureOf(doc), {
  headings: [1, 2, 3, 2],
  links: ['docs://howto-a', 'examples://demo.ifc'],
  images: ['img/{lang}/x.webp'],
  listItems: 3,
});
eq('21 project://-links tellen mee, in volgorde', structureOf('[b](examples://b.ifc) [a](project://a)').links, ['examples://b.ifc', 'project://a']);
const translated = doc
  .replace('# Titel', '# Title').replace('## Eerste', '## First').replace('## Tweede', '## Second')
  .replace('docs://howto-a#stap-1', 'docs://howto-a#step-1').replace('punt een', 'item one');
eq('22 vertaalde tekst en ankers: zelfde structuurhash', structureHash(translated), structureHash(doc));
ok('23 een kop erbij ⇒ andere structuurhash', structureHash(`${doc}\n## Derde\n`) !== structureHash(doc));
ok('24 een lijstitem minder ⇒ andere structuurhash', structureHash(doc.replace('- punt twee\n', '')) !== structureHash(doc));
ok('25 ander linkdoel ⇒ andere structuurhash', structureHash(doc.replace('docs://howto-a', 'docs://howto-b')) !== structureHash(doc));
ok('26 ander beeld ⇒ andere structuurhash', structureHash(doc.replace('x.webp', 'y.webp')) !== structureHash(doc));
eq('27 structuurhash = 16 hex over de JSON', structureHash(doc), createHash('sha256').update(JSON.stringify(structureOf(doc)), 'utf8').digest('hex').slice(0, 16));

// 4. Parser-subset.
eq('40 schoon artikel: geen fouten', subsetErrors(doc), []);
ok('41 tabel', subsetErrors('# T\n\n| a | b |').some(e => e.startsWith('3 tabel-syntax')));
ok('42 h4', subsetErrors('#### x').some(e => e.startsWith('1 h4+')));
ok('43 blockquote', subsetErrors('> x').some(e => e.includes('blockquote')));
ok('44 genest lijstitem', subsetErrors('- a\n  - b').some(e => e.startsWith('2 ingesprongen')));
ok('45 raw HTML', subsetErrors('tekst <b>vet</b>').some(e => e.includes('raw HTML')));
eq('46 HTML in inline code mag', subsetErrors('`<Notes>`'), []);
ok('47 http-link niet toegestaan', subsetErrors('[x](https://example.org)').some(e => e.includes('linkschema')));
ok('48 afbeelding zonder alt', subsetErrors('![](img/x.webp)').some(e => e.includes('zonder alt-tekst')));
ok('49 onbekende placeholder', subsetErrors('![a](img/{taal}/x.webp)').some(e => e.includes('onbekende placeholder {taal}')));
ok('50 pad buiten public/docs', subsetErrors('![a](../x.webp)').some(e => e.includes('relatief binnen public/docs')));

// 5. De echte artikelen: geen subsetfouten, en elk artikel heeft sectie 0 met de H1.
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/docs/manifest.json'), 'utf8')) as { articles: { id: string }[] };
let real = 0;
for (const { id } of manifest.articles) {
  for (const lang of ['nl', 'en']) {
    const md = readFileSync(resolve(process.cwd(), `public/docs/${lang}/${id}.md`), 'utf8');
    real++;
    const errs = subsetErrors(md);
    if (errs.length) diffs.push(`60 ${lang}/${id}: ${errs.join('; ')}`);
    if (!splitSections(md)[0].text.startsWith('# ')) diffs.push(`61 ${lang}/${id}: sectie 0 begint niet met de H1`);
    if (splitSections(md).map(s => s.text).join('\n') !== md.replace(/\r\n/g, '\n')) diffs.push(`62 ${lang}/${id}: secties samen ≠ tekst`);
  }
}
checks += real;

if (diffs.length === 0) console.log(`OK: docs-structuur (C1) — ${checks} checks groen`);
else { console.log(`XX docs-structuur (C1) — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
