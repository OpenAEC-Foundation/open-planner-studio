import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');
const srcRoot = join(root, 'src');
const allowed = join('src', 'services', 'formatRegistry.ts');
// Alleen de parsermap is lazy. Het bytearchief is een algemene service omdat
// de IFC-reader/-writer die zonder de parserchunk moet kunnen gebruiken.
const marker = '@/services/xer/';
const diffs: string[] = [];
let dynamicImportFound = false;

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

for (const file of walk(srcRoot)) {
  const rel = relative(root, file);
  for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
    if (!line.includes(marker)) continue;
    if (rel === allowed && line.includes('await import(')) dynamicImportFound = true;
    else diffs.push(`${rel}:${index + 1} bevat een statische XER-import buiten de lazy registryrand`);
  }
}
if (!dynamicImportFound) diffs.push('de lazy XER-import ontbreekt in formatRegistry.ts');
const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
if (!vite.includes("return 'xer-reader'")) diffs.push('vite.config.ts mist de xer-reader manual chunk');
const archiveModule = join(srcRoot, 'services', 'xerSourceArchive.ts');
try {
  statSync(archiveModule);
} catch {
  diffs.push('xerSourceArchive.ts ontbreekt buiten de lazy XER-parsermap');
}
try {
  statSync(join(srcRoot, 'services', 'xer', 'xerSourceArchive.ts'));
  diffs.push('xerSourceArchive.ts staat nog in de lazy XER-parsermap');
} catch {
  // Verwacht: de algemene archiefservice mag de parserchunk niet vergroten.
}

// De productielezer mag P6's opgeslagen rekenantwoord nooit als invoer gebruiken. Houd de
// expliciete §4-verbodslijst hier statisch dicht: ook een toekomstige, ogenschijnlijk handige
// veldtoegang maakt deze poort rood.
const reader = readFileSync(join(srcRoot, 'services', 'xer', 'xerReader.ts'), 'utf8');
// `PROJECT.plan_end_date` is een P6-invoer voor de expliciete X5-optie
// `useProjectEndDateForFloat`; dezelfde naam in TASK is daarentegen opgeslagen rekenuitvoer.
// Haal uitsluitend de aantoonbaar project-scoped toegang uit de statische firewallscan, zodat de
// poort de productregel bewaakt zonder twee verschillende tabellen op veldnaam te verwarren.
const readerWithoutComments = reader.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const readerWithoutAllowedProjectInput = readerWithoutComments.split('projectRow.cells.plan_end_date').join('');
const forbiddenTaskFields = [
  'early_', 'late_', 'restart_date', 'reend_date',
  'rem_late_start_date', 'rem_late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
  'driving_path_flag', 'float_path', 'float_path_order',
  'external_early_start_date', 'external_late_end_date',
  'old_restart_date', 'old_reend_date', 'old_remain_drtn_hr_cnt',
  'crt_path_num', 'critical_drtn_hr_cnt', 'act_drtn_hr_cnt',
  'plan_start_date', 'plan_end_date',
] as const;
for (const field of forbiddenTaskFields) {
  if (readerWithoutAllowedProjectInput.includes(field)) {
    diffs.push(`xerReader.ts bevat verboden P6-uitvoerveld ${field}`);
  }
}

if (diffs.length > 0) {
  console.error(`XER-chunk-boundary: ${diffs.length} afwijking(en)`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log('OK  XER-chunk-boundary: lazy registry-import, eigen chunk en productveld-whitelist');
