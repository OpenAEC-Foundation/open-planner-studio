// Knownbug 71: voorbeeldlinks zijn geen navigatie; echte kapotte links blijven een fout.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { deadWikiLinks } from '../../scripts/lib/wiki-links';
let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
};
const scan = (source: string) => deadWikiLinks(new Map([['Home', source], ['Bestaat', '# Bestaat']]));
eq('inline projectvoorbeeld', scan('Voorbeeld: `[Start](project://start.ifc)`.'), []);
eq('inline afbeeldingsvoorbeeld', scan('`![Stap](img/en/step-1.webp)`'), []);
eq('fenced voorbeeld met regelovergangen', scan('```md\n[Start](project://start.ifc)\n```'), []);
eq('bestaande pagina en anker', scan('[Ga](Bestaat#kop)'), []);
eq('extern, mail en lokaal anker', scan('[a](https://example.org) [b](mailto:a@example.org) [c](#kop)'), []);
eq('echte ontbrekende pagina', scan('[Ga](Ontbreekt#kop)'), [{ page: 'Home', target: 'Ontbreekt' }]);
eq('projectprotocol buiten code blijft fout', scan('[Start](project://start.ifc)'), [{ page: 'Home', target: 'project://start.ifc' }]);
eq('voorbeeld verbergt buur-link niet', scan('`[code](Niet-echt)` [echt](Ontbreekt)'), [{ page: 'Home', target: 'Ontbreekt' }]);
eq('code in linklabel behoudt doel', scan('[Een `naam`](Ontbreekt)'), [{ page: 'Home', target: 'Ontbreekt' }]);
eq('CRLF-codeblok', scan('```md\r\n[code](Niet-echt)\r\n```\r\n[Ga](Bestaat)'), []);
const skill = readFileSync('.claude/skills/wiki/SKILL.md', 'utf8');
eq('runbook gebruikt geteste CLI', skill.includes('node scripts/run-ts.mjs scripts/check-wiki-links.ts'), true);
const dir = mkdtempSync(join(tmpdir(), 'ops-wiki-links-'));
try {
  const run = () => spawnSync(process.execPath, ['scripts/run-ts.mjs', 'scripts/check-wiki-links.ts', dir], { encoding: 'utf8' });
  writeFileSync(join(dir, 'Home.md'), '`[voorbeeld](project://start.ifc)`');
  let result = run();
  eq('CLI zonder dode links exit 0', result.status, 0);
  eq('CLI meldt dead 0', result.stdout.trim(), 'dead: 0');
  writeFileSync(join(dir, 'Home.md'), '[echt](Ontbreekt)');
  result = run();
  eq('CLI met dode link exit 1', result.status, 1);
  eq('CLI noemt de fout', result.stdout.includes('DEAD Home.md -> Ontbreekt'), true);
  rmSync(join(dir, 'Home.md'));
  result = run();
  eq('lege map is geen vals groen', result.status, 1);
} finally { rmSync(dir, { recursive: true, force: true }); }
if (diffs.length) {
  diffs.forEach(d => console.log(`XX ${d}`));
  process.exitCode = 1;
} else console.log(`OK wiki-links: ${checks} controles groen`);
