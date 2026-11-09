// #804 fase 1a, bijsturing 1 punt 2 van de orkestrator: met de flag `ifcForeignContent` uit gedraagt de app zich
// byte-gelijk aan main.
//
// De verwachting komt uit de code van main zelf: `scripts/proef/maak-main-pariteit.mjs` draaide de kern
// `ifcPariteitKern.ts` met de src van main (`2a66df33c`) en schreef `fixtures/main-pariteit.json`. Deze check draait
// dezelfde kern met de src van deze branch en eist per bestand:
//  - dezelfde invoer (anders: de fixture opnieuw maken met het script);
//  - een eigen voorbeeld: hetzelfde opslagdoel en byte-gelijk wat Opslaan schrijft (SHA-256 en lengte);
//  - een bestand met een gebouwmodel: geweigerd, met dezelfde melding in het meldingenkanaal;
//  - dezelfde meldingen na het openen, en dezelfde keuze tekst of bytes in de bestandslaag (`binaryExtensions()`).
// Bij een verschil schrijft de check de uitvoer van de branch naar een tijdelijke map; `--uitvoer <map>` van het script
// geeft die van main, om te diffen.
//
// Eigen regel in run.sh, buiten de tijdzonematrix: de fixture is gemaakt met TZ=Europe/Amsterdam.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ParityFixture } from './ifcPariteitKern';

process.env.TZ = 'Europe/Amsterdam';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/planning/fixtures/main-pariteit.json'), 'utf8')) as ParityFixture;

// De open-route meldt een weigering ook op de console; dat is hier verwacht.
const realError = console.error;
console.error = () => {};
const { parityFixture } = await import('./ifcPariteitKern');
const { fixture: got, saved } = await parityFixture(ROOT, fixture.basis);
console.error = realError;

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, a: unknown, b: unknown) => {
  checks++;
  if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${label}: branch ${JSON.stringify(a)?.slice(0, 300)} ≠ main ${JSON.stringify(b)?.slice(0, 300)}`);
};

eq('binaryExtensions() zonder flag', got.binaryExtensions, fixture.binaryExtensions);
eq('dezelfde bestanden', got.bestanden.map(b => b.pad), fixture.bestanden.map(b => b.pad));
let outDir: string | undefined;
let own = 0;
let refused = 0;
for (const want of fixture.bestanden) {
  const have = got.bestanden.find(b => b.pad === want.pad);
  if (!have) continue;
  if (have.invoerSha256 !== want.invoerSha256) {
    diffs.push(`${want.pad}: de invoer is gewijzigd sinds de fixture; draai node scripts/proef/maak-main-pariteit.mjs`);
    continue;
  }
  if (want.filePath === null) refused++; else own++;
  eq(`${want.pad}: opslagdoel na openen`, have.filePath, want.filePath);
  eq(`${want.pad}: meldingen`, have.meldingen, want.meldingen);
  eq(`${want.pad}: wat Opslaan schrijft (sha256, lengte)`, [have.opslaanSha256, have.opslaanLengte], [want.opslaanSha256, want.opslaanLengte]);
  if (have.opslaanSha256 !== want.opslaanSha256 && saved.has(want.pad)) {
    outDir ??= mkdtempSync(join(tmpdir(), 'ops-pariteit-branch-'));
    const target = join(outDir, want.pad);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, saved.get(want.pad)!);
  }
}
// De weigering is echt die van het gebouwmodel (knownbug 110), niet een andere fout.
for (const want of fixture.bestanden.filter(b => b.filePath === null)) {
  const detail = String(want.meldingen[0]?.detail ?? '');
  checks++;
  if (!detail.includes('building model')) diffs.push(`${want.pad}: de fixture verwacht de modelweigering, niet "${detail.slice(0, 80)}"`);
}
eq('aantallen (eigen, geweigerd)', [own, refused], [32, 6]);

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ifc-foreign-pariteit: ${d}`);
  if (outDir) console.log(`..  uitvoer van de branch: ${outDir} (main: node scripts/proef/maak-main-pariteit.mjs --uitvoer <map>)`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-pariteit: alle checks groen (${checks}; ${own} eigen bestanden byte-gelijk aan main ${fixture.basis}, ${refused} modelbestanden met dezelfde weigering)`);
process.exit(0);
