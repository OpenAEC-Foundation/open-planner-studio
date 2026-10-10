// `node build/translate/check.mjs <pakket.json> [<uitvoer>]`
//
// De poort die een vertaalagent zelf draait (§6, §7). Zonder tweede argument leest hij
// `<pakket>.out.json` naast het pakket. Een docs-pakket herkent hij aan `<pakket>.src.md` ernaast
// (of aan een argument dat op `.src.md` eindigt); dan leest hij `<pakket>.out.md`.
// Exit 0 = groen (waarschuwingen mogen), 1 = harde fouten, 2 = bestand niet te lezen.
// `translate prepare` bundelt dit bestand met esbuild tot een zelfstandig build/translate/check.mjs:
// alleen Node-ingebouwde modules, geen node_modules nodig.
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { checkDocs, checkPackage, formatResult } from './gates';
import type { DocsPackage } from './docs';

const [arg, outArg] = process.argv.slice(2);
if (!arg) {
  console.log('gebruik: node check.mjs <pakket.json | pakket.src.md> [<uitvoer>]');
  process.exit(2);
}

const readText = (p: string): string => {
  try {
    return readFileSync(p, 'utf8');
  } catch (err) {
    console.log(`XX ${p}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
};
const read = (p: string): unknown => {
  const text = readText(p);
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.log(`XX ${p}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
};

const base = arg.endsWith('.src.md') ? arg.slice(0, -'.src.md'.length) : arg.replace(/\.json$/, '');
const pkgPath = `${base}.json`;
const isDocs = existsSync(`${base}.src.md`);
const pkg = read(pkgPath);
const id = (typeof pkg === 'object' && pkg !== null && typeof (pkg as { id?: unknown }).id === 'string')
  ? (pkg as { id: string }).id : basename(pkgPath);

const result = isDocs
  ? checkDocs(pkg as DocsPackage, readText(`${base}.src.md`), readText(outArg ?? `${base}.out.md`))
  : checkPackage(pkg, read(outArg ?? `${base}.out.json`));
for (const line of formatResult(id, result)) console.log(line);
process.exit(result.errors.length ? 1 : 0);
