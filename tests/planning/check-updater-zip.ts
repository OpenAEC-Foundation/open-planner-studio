// Dependabot #38, #39, #40: de zip-crate van de Windows-updater mag niet onder 9.0.5 blijven staan.
// Daarnaast moet de directe zip-regel de deflate-backend blijven aanzetten: zonder die feature bouwt de
// updater zonder deflate-decompressie en faalt de Windows-update pas bij de gebruiker ("Compression method not supported").
// Dit leest alleen Cargo.toml en Cargo.lock; een echte Windows-build en -update draaien in de CI en bij de release.
import { readFileSync } from 'node:fs';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};

const MIN_ZIP = [9, 0, 5];
const parse = (version: string) => version.split('.').map(Number);
const atLeast = (version: string, min: number[]) => {
  const v = parse(version);
  for (let i = 0; i < min.length; i++) if (v[i] !== min[i]) return (v[i] ?? 0) > min[i];
  return true;
};

const lock = readFileSync('src-tauri/Cargo.lock', 'utf8');
const zips = [...lock.matchAll(/\[\[package\]\]\nname = "zip"\nversion = "([^"]+)"/g)].map(m => m[1]);
eq('Cargo.lock: precies één zip-versie', zips.length, 1);
for (const version of zips) eq(`Cargo.lock: zip ${version} is minstens 9.0.5`, atLeast(version, MIN_ZIP), true);

const toml = readFileSync('src-tauri/Cargo.toml', 'utf8').replace(/#[^\n]*/g, '');
const direct = toml.match(/^zip\s*=\s*\{([^}]*)\}/m)?.[1] ?? '';
eq('Cargo.toml: directe zip-regel aanwezig', direct !== '', true);
eq('Cargo.toml: directe zip vanaf versie 9', /version\s*=\s*"9/.test(direct), true);
eq('Cargo.toml: directe zip zet deflate-flate2 aan', /features\s*=\s*\[[^\]]*"deflate-flate2"/.test(direct), true);
eq('Cargo.toml: directe zip zonder standaardfeatures', /default-features\s*=\s*false/.test(direct), true);

for (const diff of diffs) console.log(`XX ${diff}`);
console.log(`updater-zip: ${checks} controles, ${diffs.length} afwijkingen`);
if (diffs.length) process.exitCode = 1;
