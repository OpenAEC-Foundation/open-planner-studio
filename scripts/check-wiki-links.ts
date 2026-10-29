// Alleen lezen: controleer een vooraf gegenereerde wiki. Dit script publiceert niets.
// Vanuit de repo-root: node scripts/run-ts.mjs scripts/check-wiki-links.ts [map]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deadWikiLinks } from './lib/wiki-links';

const dir = process.argv[2] ?? '.wiki-build';
const files = readdirSync(dir).filter(file => file.endsWith('.md')).sort();
if (files.length === 0) throw new Error(`Geen wiki-pagina's in ${dir}; genereer eerst de wiki.`);
const pages = new Map(files.map(file => [file.slice(0, -3), readFileSync(join(dir, file), 'utf8')]));
const dead = deadWikiLinks(pages);
for (const link of dead) console.log(`DEAD ${link.page}.md -> ${link.target}`);
console.log(`dead: ${dead.length}`);
process.exitCode = dead.length > 0 ? 1 : 0;
