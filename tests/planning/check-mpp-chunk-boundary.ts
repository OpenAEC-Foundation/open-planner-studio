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
  const relPath = relative(join(HERE, '..', '..'), file);
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
