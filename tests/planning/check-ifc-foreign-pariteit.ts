// #804 fase 1a, bijsturing 1 punt 2 van de orkestrator: met de flag `ifcForeignContent` uit gedraagt de app zich
// byte-gelijk aan main.
//
// De verwachting komt uit de code van main zelf: `scripts/proef/maak-main-pariteit.mjs` draaide de kern
// `ifcPariteitKern.ts` met de src van main (`ccf3ca2a2`, sinds fixronde 6 van 1b, met #871 en #872; daarvoor `14f979755`
// en in 1a `2a66df33c`) en schreef `fixtures/main-pariteit.json`. Deze check draait
// dezelfde kern met de src van deze branch en eist per bestand:
//  - dezelfde invoer (anders: de fixture opnieuw maken met het script);
//  - een eigen voorbeeld: hetzelfde opslagdoel en byte-gelijk wat Opslaan schrijft (SHA-256 en lengte);
//  - een bestand met een gebouwmodel: geweigerd, met dezelfde melding in het meldingenkanaal;
//  - dezelfde meldingen na het openen, en dezelfde keuze tekst of bytes in de bestandslaag (`binaryExtensions()`);
//  - (fixronde 1, VERVOLG van Terra) een eigen voorbeeld: de echte acties Opslaan en Opslaan als, met guards en de
//    bestandslaag van de browser (handle in het geheugen), geven dezelfde dialogen, dezelfde bytes (SHA-256 en lengte),
//    hetzelfde opslagdoel en dezelfde meldingen als op main;
//  - (fixronde 2, VERVOLG van Terra) een eigen voorbeeld: Ctrl+S naar een bestaand doel, per route (handle, Tauri-pad
//    via de echte plugin-JS, site), geeft dezelfde bytes, hetzelfde doel, dezelfde meldingen én dezelfde aanroepen naar
//    buiten als op main: met de flag uit leest de branch het doel niet extra;
//  - (fixronde 4, VERVOLG 3 van Terra en Sol) geen kenmerk van een bron met een vreemd deel, behalve bij een MCP-backup
//    met de pset `OPS_RecoveryForeignSource` (`backup-met-kenmerk.ifc`). Die opent ook met de flag uit zonder opslagdoel
//    en met het kenmerk (`fileSlice.ts`, `recordMark`; de pset leest `ifcReader.ts` bij `extractRecoveryForeignSource`),
//    zodat Ctrl+S Opslaan als wordt. In 1a was dat een bewuste afwijking van main `2a66df33c` (aanvaard door wrakko op
//    10 november 2026); sinds 1a in main staat (`14f979755`), doet main hetzelfde en eist de check gelijkheid.
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
// De open-route en de opslagacties melden ook op de console; dat is hier verwacht.
const realWarn = console.warn;
console.warn = () => {};
const { fixture: got, saved } = await parityFixture(ROOT, fixture.basis);
console.warn = realWarn;
console.error = realError;

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, a: unknown, b: unknown) => {
  checks++;
  if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${label}: branch ${JSON.stringify(a)?.slice(0, 300)} ≠ main ${JSON.stringify(b)?.slice(0, 300)}`);
};

eq('binaryExtensions() zonder flag', got.binaryExtensions, fixture.binaryExtensions);
eq('dezelfde bestanden', got.bestanden.map(b => b.pad), fixture.bestanden.map(b => b.pad));
// Fixronde 4 (VERVOLG 3): de backup met kenmerk, zie de kop van dit bestand.
const MARKED_BACKUP = 'tests/planning/fixtures/backup-met-kenmerk.ifc';
let markedBackup = 0;
let outDir: string | undefined;
let own = 0;
let refused = 0;
let actions = 0;
let targetActions = 0;
for (const want of fixture.bestanden) {
  const have = got.bestanden.find(b => b.pad === want.pad);
  if (!have) continue;
  if (have.invoerSha256 !== want.invoerSha256) {
    diffs.push(`${want.pad}: de invoer is gewijzigd sinds de fixture; draai node scripts/proef/maak-main-pariteit.mjs`);
    continue;
  }
  if (want.pad === MARKED_BACKUP) {
    markedBackup++;
    // Op de branch én op main: geen opslagdoel, wel het kenmerk, geen melding; verder alles gelijk aan main.
    eq('backup met kenmerk: geen opslagdoel, wel het kenmerk, geen melding',
      [have.filePath, have.kenmerk ?? false, have.meldingen], [null, true, []]);
    eq('backup met kenmerk: gelijk aan main (doel, kenmerk, meldingen, Opslaan, acties, Ctrl+S)',
      [have.filePath, have.kenmerk ?? false, have.meldingen, have.opslaanSha256, have.opslaanLengte, have.acties, have.doelacties],
      [want.filePath, want.kenmerk ?? false, want.meldingen, want.opslaanSha256, want.opslaanLengte, want.acties, want.doelacties]);
    continue;
  }
  if (want.filePath === null) refused++; else own++;
  eq(`${want.pad}: opslagdoel na openen`, have.filePath, want.filePath);
  eq(`${want.pad}: geen kenmerk van een bron met een vreemd deel`, have.kenmerk ?? false, want.kenmerk ?? false);
  eq(`${want.pad}: meldingen`, have.meldingen, want.meldingen);
  eq(`${want.pad}: wat Opslaan schrijft (sha256, lengte)`, [have.opslaanSha256, have.opslaanLengte], [want.opslaanSha256, want.opslaanLengte]);
  eq(`${want.pad}: de echte acties Opslaan en Opslaan als`, have.acties, want.acties);
  eq(`${want.pad}: Ctrl+S naar een bestaand doel (handle, pad, site)`, have.doelacties, want.doelacties);
  if (want.filePath !== null) {
    // Niet leeg: beide acties kwamen tot de dialoog en schreven precies één keer.
    checks++;
    const real = (want.acties ?? []).every(a => a.uitkomst === 'klaar' && a.dialogen === 1 && a.writes.length === 1 && !a.isDirty);
    if (!real || want.acties?.length !== 2) diffs.push(`${want.pad}: de fixture heeft geen twee geslaagde opslagacties`);
    else actions += 2;
    // Niet leeg: elke route schreef zonder dialoog precies één keer naar het bestaande doel.
    checks++;
    const targets = (want.doelacties ?? []).every(a => a.uitkomst === 'klaar' && a.writes.length === 1 && !a.isDirty
      && !a.aanroepen.some(c => c.includes('showSaveFilePicker') || c.includes('dialog')));
    if (!targets || want.doelacties?.map(a => a.route).join() !== 'handle,pad,site') {
      diffs.push(`${want.pad}: de fixture heeft geen drie geslaagde Ctrl+S-acties naar een bestaand doel`);
    } else targetActions += 3;
  }
  if (have.opslaanSha256 !== want.opslaanSha256 && saved.has(want.pad)) {
    outDir ??= mkdtempSync(join(tmpdir(), 'ops-pariteit-branch-'));
    const target = join(outDir, want.pad);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, saved.get(want.pad)!);
  }
}
// De weigering is echt die van het gebouwmodel (knownbug 110), niet een andere fout.
for (const want of fixture.bestanden.filter(b => b.filePath === null && b.pad !== MARKED_BACKUP)) {
  const detail = String(want.meldingen[0]?.detail ?? '');
  checks++;
  if (!detail.includes('building model')) diffs.push(`${want.pad}: de fixture verwacht de modelweigering, niet "${detail.slice(0, 80)}"`);
}
// Fixronde 1 van #867: twee eigen voorbeelden met `ProjectName` in OPS_ProjectSettings erbij (34 in plaats van 32).
// Fixronde 6: een eigen voorbeeld met `P2DT12H` erbij (`fixtures/duur-dagen-en-tijd/`, 35).
eq('aantallen (eigen, geweigerd, backup met kenmerk)', [own, refused, markedBackup], [35, 6, 1]);

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ifc-foreign-pariteit: ${d}`);
  if (outDir) console.log(`..  uitvoer van de branch: ${outDir} (main: node scripts/proef/maak-main-pariteit.mjs --uitvoer <map>)`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-pariteit: alle checks groen (${checks}; ${own} eigen bestanden byte-gelijk aan main ${fixture.basis}, `
  + `${actions} echte opslagacties en ${targetActions} Ctrl+S naar een bestaand doel gelijk, ${refused} modelbestanden met `
  + `dezelfde weigering, ${markedBackup} backup met kenmerk gelijk aan main)`);
process.exit(0);
