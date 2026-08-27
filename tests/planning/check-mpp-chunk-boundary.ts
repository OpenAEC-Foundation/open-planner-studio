/**
 * Chunk-poort (T11, T8-review-agenda stap 0-ter d): `src/services/mpp/` hoort UITSLUITEND lazy
 * geladen te worden — `vite.config.ts`'s `manualChunks` stopt alles onder dat pad in een eigen
 * `mpp-reader`-chunk, maar dat helpt niets als er ergens een STATISCHE `import … from
 * '@/services/mpp/…'` bestaat: Rollup volgt zo'n import gewoon mee de main-graf in en de chunk
 * laadt alsnog eager. T8's gate hiervoor was een handmatige `npm run build` + `grep` (stap 6);
 * dit bestand maakt daar een echte, herdraaibare poort van, zonder dat er gebouwd hoeft te
 * worden — een lexicale grep over `src/**​/*.ts(x)` met `node:fs`, geen esbuild/tsc nodig.
 *
 * Regel: elke regel onder `src/` die `@/services/mpp` bevat, moet (a) in
 * `src/services/formatRegistry.ts` staan, EN (b) een `await import(` op diezelfde regel dragen
 * (de dynamic import van de T8-registry-entry). Elke andere treffer — een statische
 * `import … from '@/services/mpp/…'`, of een treffer in een willekeurig ander bestand — is een
 * regressie: die zou de parser (CFB + fieldmaps, ruwweg de helft van de mpp-broncode qua omvang)
 * alsnog in de main chunk trekken.
 *
 * Bewust NIET meegenomen: `tests/` en `scripts/` — die importeren de mpp-module rechtstreeks
 * (headless tests tegen de lezer), wat prima is; testcode zit nooit in een browserbundel. Alleen
 * `src/` telt voor de chunk-grens.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC_ROOT = join(HERE, '..', '..', 'src');

const MARKER = "@/services/mpp";
const ALLOWED_FILE = join('src', 'services', 'formatRegistry.ts');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const diffs: string[] = [];
let checks = 0;
let dynamicImportFound = false;

for (const file of walk(SRC_ROOT)) {
  const relPath = relative(join(HERE, '..', '..'), file); // bv. "src/services/formatRegistry.ts"
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    if (!line.includes(MARKER)) return;
    checks++;
    const isAllowedFile = relPath === ALLOWED_FILE;
    const isDynamicImport = line.includes('await import(');
    if (isAllowedFile && isDynamicImport) {
      dynamicImportFound = true;
      return;
    }
    diffs.push(
      `${relPath}:${idx + 1} bevat '${MARKER}' buiten de toegestane dynamic import in ` +
      `${ALLOWED_FILE} — dit trekt de mpp-parser in de main chunk: ${line.trim()}`,
    );
  });
}

checks++;
if (!dynamicImportFound) {
  diffs.push(`geen dynamic '@/services/mpp'-import gevonden in ${ALLOWED_FILE} — de mpp-registratie lijkt te ontbreken`);
}

if (diffs.length === 0) {
  console.log(`OK  mpp-chunk-boundary: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  mpp-chunk-boundary: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
