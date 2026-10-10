// Poort 12 van `verify:docs` (scripts/lib/docs-translations.ts): de optionele docstalen. Draait op een
// tijdelijke fixture-map, zodat de test niet afhangt van echte vertalingen. Exit 0 = groen.
//
// Mutatiebewijs: de bestand↔index-controle weglaten ⇒ 11/12 rood; de structuurvergelijking met de
// bewaarde hash weglaten ⇒ 20 rood; "verouderd" een fout maken ⇒ 21 rood.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkOptionalDocLang, optionalLangReportLine, type OptionalLangInput } from '../../scripts/lib/docs-translations';
import { structureHash } from '../../scripts/lib/docs-structure';
import { resolveHelpImagePath } from '@/utils/helpManifest';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const EN: Record<string, string> = {
  'howto-a': '# Start\n\nIntro.\n\n## Stap\n\n- een\n- twee\n\n[B](docs://howto-b)\n',
  'howto-b': '# Second\n\nText with [demo](examples://demo.ifc).\n',
  'howto-c': '# Third\n\nText.\n',
};
const AR: Record<string, string> = {
  'howto-a': '# البداية\n\nمقدمة.\n\n## خطوة\n\n- واحد\n- اثنان\n\n[ب](docs://howto-b)\n',
  'howto-b': '# الثاني\n\nنص مع [عرض](examples://demo.ifc).\n',
};

const root = mkdtempSync(join(tmpdir(), 'ops-docs-translations-'));
const docsDir = join(root, 'public', 'docs');
const sourcesDir = join(root, 'i18n', 'docs-sources');

function write(rel: string, content: string) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
}
function reset() {
  rmSync(root, { recursive: true, force: true });
  for (const [id, md] of Object.entries(EN)) write(`public/docs/en/${id}.md`, md);
  for (const [id, md] of Object.entries(AR)) write(`public/docs/ar/${id}.md`, md);
  write('public/docs/ar/index.json', `{\n"howto-a": {"title": "البداية"},\n"howto-b": {"title": "الثاني"}\n}\n`);
  write('i18n/docs-sources/ar.json', JSON.stringify({
    'howto-a': { structure: structureHash(EN['howto-a']), sections: [] },
    'howto-b': { structure: structureHash(EN['howto-b']), sections: [] },
  }));
}
const input = (lang = 'ar'): OptionalLangInput => ({
  docsDir, sourcesDir, lang, manifestIds: ['howto-a', 'howto-b', 'howto-c'],
  isKnownDocTarget: id => ['howto-a', 'howto-b', 'howto-c', 'oud-id'].includes(id),
  exampleFiles: new Set(['demo.ifc']),
  resolveImagePath: resolveHelpImagePath,
});
const run = () => checkOptionalDocLang(input());

try {
  // 1. Een geldige vertaling: geen fouten, alleen een rapport.
  reset();
  let r = run();
  eq('01 geldig: geen fouten', r.errors, []);
  eq('02 geteld: 2 vertaald, 1 ontbreekt', [r.translated, r.missing], [2, 1]);
  eq('03 niets verouderd', r.stale, []);
  eq('04 rapportregel', optionalLangReportLine(r, 3), 'ar: 2/3 vertaald · 1 ontbreken');
  eq('05 taal zonder map: alles ontbreekt, geen fout', [checkOptionalDocLang(input('de')).errors, checkOptionalDocLang(input('de')).missing], [[], 3]);

  // 2. Bestand ↔ indexregel.
  reset();
  write('public/docs/ar/index.json', '{\n"howto-a": {"title": "البداية"}\n}\n');
  ok('11 artikel zonder indexregel = fout', run().errors.some(e => e.includes('howto-b.md heeft geen regel in index.json')));
  reset();
  write('public/docs/ar/index.json', '{\n"howto-a": {"title": "البداية"},\n"howto-b": {"title": "الثاني"},\n"howto-c": {"title": "ثالث"}\n}\n');
  ok('12 indexregel zonder artikel = fout', run().errors.some(e => e.includes('regel "howto-c" zonder artikel')));
  reset();
  rmSync(join(docsDir, 'ar', 'index.json'));
  ok('13 geen index.json bij artikelen = fout', run().errors.some(e => e.includes('index.json ontbreekt')));
  reset();
  write('public/docs/ar/index.json', '{\n"howto-a": {"title": "Anders"},\n"howto-b": {"title": "الثاني"}\n}\n');
  ok('14 indextitel ≠ H1 = fout', run().errors.some(e => e.includes('indextitel "Anders"')));
  reset();
  write('public/docs/ar/notes.txt', 'x');
  ok('15 ander bestand in de taalmap = fout', run().errors.some(e => e.includes('notes.txt')));

  // 3. Structuur tegen de bewaarde en-bron.
  reset();
  write('public/docs/ar/howto-a.md', AR['howto-a'].replace('- اثنان\n', ''));
  ok('20 structuur wijkt af van de bewaarde hash = fout', run().errors.some(e => e.includes('howto-a: structuur')));
  reset();
  write('public/docs/en/howto-a.md', `${EN['howto-a']}\n## Nieuw\n\nMeer.\n`);
  r = run();
  eq('21 en veranderd na het vertalen: verouderd, geen fout', [r.errors, r.stale], [[], ['howto-a']]);
  ok('22 rapportregel noemt verouderd', optionalLangReportLine(r, 3).includes('1 verouderd'));
  reset();
  write('i18n/docs-sources/ar.json', JSON.stringify({ 'howto-a': { structure: structureHash(EN['howto-a']) } }));
  ok('23 artikel zonder regel in docs-sources = fout', run().errors.some(e => e.includes('howto-b: geen regel')));
  reset();
  rmSync(join(sourcesDir, 'ar.json'));
  ok('24 geen docs-sources-bestand bij artikelen = fout', run().errors.some(e => e.includes('i18n/docs-sources/ar.json ontbreekt')));

  // 4. Subset, koppen, leeg.
  reset();
  write('public/docs/ar/howto-b.md', `${AR['howto-b']}\n| a | b |\n`);
  ok('30 tabel = fout', run().errors.some(e => e.includes('tabel-syntax')));
  reset();
  write('public/docs/ar/howto-b.md', '# الثاني\n\n## مكرر\n\n## مكرر\n');
  ok('31 dubbele kop = fout', run().errors.some(e => e.includes('dubbele kop')));
  reset();
  write('public/docs/ar/howto-b.md', '  \n');
  ok('32 leeg bestand = fout', run().errors.some(e => e.includes('bestand is leeg')));
  reset();
  write('public/docs/ar/howto-b.md', `${AR['howto-b']}\n![صورة](img/{lang}/x.webp)\n`);
  ok('33 beeld valt terug op en en moet bestaan', run().errors.some(e => e.includes('public/docs/img/en/x.webp')));

  // 5. Rapporten: wees en onbekende links.
  reset();
  write('public/docs/ar/oud.md', '# قديم\n');
  write('public/docs/ar/index.json', '{\n"howto-a": {"title": "البداية"},\n"howto-b": {"title": "الثاني"},\n"oud": {"title": "قديم"}\n}\n');
  r = run();
  eq('40 wees: rapport, geen fout', [r.errors, r.orphans], [[], ['oud']]);
  reset();
  write('public/docs/ar/howto-b.md', '# الثاني\n\nنص مع [عرض](examples://weg.ifc) en [x](docs://bestaat-niet).\n');
  r = run();
  ok('41 onbekende links: rapport', r.unknownLinks.length === 2);
  ok('42 …maar de structuur wijkt wel af (fout)', r.errors.some(e => e.includes('structuur')));
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (diffs.length === 0) console.log(`OK: docs-vertalingen (poort 12) — ${checks} checks groen`);
else { console.log(`XX docs-vertalingen (poort 12) — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
