// Bewijstest voor `scripts/verify-i18n-keys.mjs` (onderdeel van `npm run verify:i18n`): geen cast op
// een vertaalsleutel. De echte repository moet groen zijn; elke castvorm op t/tX/i18n.t moet rood
// worden met bestand en regel; `as const`, casts elders en woorden in commentaar of strings niet.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const diffs: string[] = [];
let checks = 0;
const ok = (label: string, condition: boolean, detail = '') => {
  checks++;
  if (!condition) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts', 'verify-i18n-keys.mjs');
const run = (checkRoot: string) => spawnSync(process.execPath, [script, '--root', checkRoot], { cwd: root, encoding: 'utf8' });

function fixture(source: string, ext = 'tsx'): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-i18n-keys-'));
  const target = join(dir, 'src', 'components', `Voorbeeld.${ext}`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source, 'utf8');
  return dir;
}

const repository = run(root);
ok('1 de echte repository is groen', repository.status === 0, `${repository.stdout}${repository.stderr}`);

const red: [string, string][] = [
  ['2 t(x as sleutel)', "export const a = t(key as 'close');"],
  ['3 tMenu(`…${x}` as sleutel)', "export const a = tMenu(`ribbon.${scale}` as 'ribbon.week');"],
  ['4 tCommon(tabel[k] as sleutel)', "export const a = tCommon(LABELS[k] as 'calendar.shift.day');"],
  ['5 i18n.t(x as never)', 'export const a = i18n.t(key as never);'],
  ['6 cast tussen haakjes', "export const a = t((key as 'close'));"],
  ['7 hoekhaken-cast (.ts)', "export const a = tTask(<'x.y'>key);"],
];
for (const [label, source] of red) {
  const ext = label.includes('(.ts)') ? 'ts' : 'tsx';
  const dir = fixture(source, ext);
  try {
    const result = run(dir);
    ok(`${label} ⇒ rood`, result.status === 1, `${result.stdout}${result.stderr}`);
    ok(`${label} ⇒ noemt bestand en regel`, result.stdout.includes(`src/components/Voorbeeld.${ext}:1`), result.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const green: [string, string][] = [
  ['8 as const mag', "export const a = tCommon(`calendar.errors.${code}` as const);"],
  ['9 cast op de opties, niet op de sleutel', "export const a = t('x.y', { count } as Opts);"],
  ['10 cast in een andere functie', "export const a = format(key as 'close');"],
  ['11 woorden in commentaar en string', "// t(key as 'close')\nexport const a = \"t(key as 'close')\";"],
];
for (const [label, source] of green) {
  const dir = fixture(source);
  try {
    const result = run(dir);
    ok(`${label} ⇒ groen`, result.status === 0, `${result.stdout}${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (diffs.length === 0) {
  console.log(`OK  i18n-keys: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  i18n-keys: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
