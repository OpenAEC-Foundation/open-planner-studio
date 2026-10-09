// `node build/translate/check.mjs <pakket.json> [<uitvoer.json>]`
//
// De poort die een vertaalagent zelf draait (§6, §7). Zonder tweede argument leest hij
// `<pakket>.out.json` naast het pakket. Exit 0 = groen (waarschuwingen mogen), 1 = harde fouten,
// 2 = bestand niet te lezen. `translate prepare` bundelt dit bestand met esbuild tot een
// zelfstandig build/translate/check.mjs: alleen Node-ingebouwde modules, geen node_modules nodig.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { checkPackage, formatResult } from './gates';

const [pkgPath, outArg] = process.argv.slice(2);
if (!pkgPath) {
  console.log('gebruik: node check.mjs <pakket.json> [<uitvoer.json>]');
  process.exit(2);
}
const outPath = outArg ?? pkgPath.replace(/\.json$/, '.out.json');

const read = (p: string): unknown => {
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as unknown;
  } catch (err) {
    console.log(`XX ${p}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
};

const pkg = read(pkgPath);
const out = read(outPath);
const id = (typeof pkg === 'object' && pkg !== null && typeof (pkg as { id?: unknown }).id === 'string')
  ? (pkg as { id: string }).id : basename(pkgPath);
const result = checkPackage(pkg, out);
for (const line of formatResult(id, result)) console.log(line);
process.exit(result.errors.length ? 1 : 0);
