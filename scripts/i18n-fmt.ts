// `npm run i18n:fmt` — zet alle locale-bestanden in de canonieke opmaak (zie scripts/i18n-tools.ts):
// één sleutel per regel, in de volgorde van `nl`. `--check` schrijft niets en faalt (exit 1) zodra
// een bestand afwijkt; die vorm draait mee in `npm run verify:i18n`.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, NAMESPACES, formatLocale } from './i18n-tools';

const check = process.argv.includes('--check');
const dir = join(process.cwd(), 'src/i18n/locales');

const onDisk = readdirSync(dir).filter(d => statSync(join(dir, d)).isDirectory()).sort();
const known = [...LOCALES].sort();
if (onDisk.join() !== known.join()) {
  console.log(`XX  i18n:fmt: locale-mappen [${onDisk.join(', ')}] ≠ LOCALES in scripts/i18n-tools.ts [${known.join(', ')}]`);
  process.exit(1);
}

const off: string[] = [];
for (const ns of NAMESPACES) {
  const nlPath = join(dir, 'nl', `${ns}.json`);
  const nlSource = readFileSync(nlPath, 'utf8');
  const nlFormatted = formatLocale(nlSource, nlSource);
  for (const loc of LOCALES) {
    const path = join(dir, loc, `${ns}.json`);
    const source = loc === 'nl' ? nlSource : readFileSync(path, 'utf8');
    const formatted = loc === 'nl' ? nlFormatted : formatLocale(source, nlFormatted);
    if (formatted === source) continue;
    off.push(`${loc}/${ns}.json`);
    if (!check) writeFileSync(path, formatted);
  }
}

if (check) {
  if (off.length > 0) {
    console.log(`XX  i18n:fmt: ${off.length} locale-bestand(en) niet in de canonieke opmaak: ${off.join(', ')}`);
    console.log('    (één sleutel per regel, volgorde van nl) — draai `npm run i18n:fmt` en commit het resultaat');
    process.exit(1);
  }
  console.log(`OK  i18n:fmt: alle ${LOCALES.length * NAMESPACES.length} locale-bestanden in de canonieke opmaak`);
} else {
  console.log(`i18n:fmt: ${off.length} bestand(en) opnieuw opgemaakt${off.length ? `: ${off.join(', ')}` : ''}`);
}
