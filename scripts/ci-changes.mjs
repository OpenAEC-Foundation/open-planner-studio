#!/usr/bin/env node
// Raakt deze PR de Rust-kant of de pakketlijst? Dan draaien de Windows- en macOS-build en CodeQL Rust mee.
//
// Besluit Ethan (2026-11-02, optie 1 uit PR #763): die drie draaien alleen bij een wijziging in `src-tauri/` of in
// de pakketlijst (package.json, package-lock.json, Cargo.toml, Cargo.lock, ook in de root), en altijd op main. De Ubuntu-build
// draait altijd. Een wijziging aan de workflow zelf telt bewust niet mee (het besluit noemt alleen de Rust-kant
// en de pakketlijst); een PR die alleen de Windows-build in ci.yml verandert, bouwt Windows dus pas op main.
//
//   node scripts/ci-changes.mjs <event>   # schrijft rust=true|false naar $GITHUB_OUTPUT
//
// Bij een pull_request staat de merge-commit uitgecheckt; zijn eerste ouder is de basis. Lukt het vergelijken
// niet, dan is het antwoord `true`: bij twijfel draait er meer, nooit minder.
//
// `--no-renames`: anders noemt Git bij een verplaatsing alleen het nieuwe pad, en valt een bestand dat uit
// src-tauri/ verdwijnt buiten de regel (review #777). `-z`: anders citeert Git een pad met niet-ASCII-tekens
// ("src-tauri/\303\251...") en past de regel niet.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RUST_PATHS = [/^src-tauri\//, /^package\.json$/, /^package-lock\.json$/, /^Cargo\.toml$/, /^Cargo\.lock$/];

/** Hoort een van deze bestanden bij de Rust-kant of de pakketlijst? */
export function touchesRust(files) {
  return files.some(file => RUST_PATHS.some(re => re.test(file)));
}

/** `true` buiten een PR; binnen een PR alleen als de wijzigingen de Rust-kant raken. */
export function decide(event, listFiles) {
  if (event !== 'pull_request') return { rust: true, reason: `${event}: alles draait` };
  let files;
  try {
    files = listFiles();
  } catch (err) {
    return { rust: true, reason: `wijzigingen niet te bepalen (${err instanceof Error ? err.message : String(err)}): alles draait` };
  }
  const rust = touchesRust(files);
  return { rust, reason: `${files.length} gewijzigde bestanden; Rust of pakketlijst geraakt: ${rust ? 'ja' : 'nee'}` };
}

/** Alle paden die de laatste commit raakt ten opzichte van zijn eerste ouder, ook de oude kant van een verplaatsing. */
export const gitFiles = (cwd = process.cwd()) => execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', 'HEAD^1', 'HEAD'], { cwd, encoding: 'utf8' })
  .split('\0').filter(Boolean);

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const [event = ''] = process.argv.slice(2);
  const { rust, reason } = decide(event, gitFiles);
  console.log(reason);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `rust=${rust}\n`);
}
