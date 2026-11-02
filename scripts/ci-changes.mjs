#!/usr/bin/env node
// Raakt deze PR de Rust-kant of de pakketlijst? Dan draaien de Windows- en macOS-build en CodeQL Rust mee.
//
// Besluit Ethan (2026-11-02, optie 1 uit PR #763): die drie draaien alleen bij een wijziging in `src-tauri/` of in
// de pakketlijst (package.json, package-lock.json, Cargo.toml, Cargo.lock), en altijd op main. De Ubuntu-build
// draait altijd. Een wijziging aan de workflow die deze jobs beschrijft telt ook mee: anders zou een PR die de
// Windows-build verandert, die build zelf nooit draaien.
//
//   node scripts/ci-changes.mjs <event> [workflowbestand]   # schrijft rust=true|false naar $GITHUB_OUTPUT
//
// Bij een pull_request staat de merge-commit uitgecheckt; zijn eerste ouder is de basis. Lukt het vergelijken
// niet, dan is het antwoord `true`: bij twijfel draait er meer, nooit minder.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RUST_PATHS = [/^src-tauri\//, /^package\.json$/, /^package-lock\.json$/];

/** Hoort een van deze bestanden bij de Rust-kant, de pakketlijst of de opgegeven workflow? */
export function touchesRust(files, workflow = '') {
  return files.some(file => file === workflow || RUST_PATHS.some(re => re.test(file)));
}

/** `true` buiten een PR; binnen een PR alleen als de wijzigingen de Rust-kant raken. */
export function decide(event, listFiles, workflow = '') {
  if (event !== 'pull_request') return { rust: true, reason: `${event}: alles draait` };
  let files;
  try {
    files = listFiles();
  } catch (err) {
    return { rust: true, reason: `wijzigingen niet te bepalen (${err instanceof Error ? err.message : String(err)}): alles draait` };
  }
  const rust = touchesRust(files, workflow);
  return { rust, reason: `${files.length} gewijzigde bestanden; Rust of pakketlijst geraakt: ${rust ? 'ja' : 'nee'}` };
}

const gitFiles = () => execFileSync('git', ['diff', '--name-only', 'HEAD^1', 'HEAD'], { encoding: 'utf8' })
  .split('\n').filter(Boolean);

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const [event = '', workflow = ''] = process.argv.slice(2);
  const { rust, reason } = decide(event, gitFiles, workflow);
  console.log(reason);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `rust=${rust}\n`);
}
