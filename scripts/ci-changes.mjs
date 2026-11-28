#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RUST_PATHS = [/^src-tauri\//, /^package\.json$/, /^package-lock\.json$/, /^Cargo\.toml$/, /^Cargo\.lock$/];

export function touchesRust(files) {
  return files.some(file => RUST_PATHS.some(re => re.test(file)));
}

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

export const gitFiles = (cwd = process.cwd()) => execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', 'HEAD^1', 'HEAD'], { cwd, encoding: 'utf8' })
  .split('\0').filter(Boolean);

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const [event = ''] = process.argv.slice(2);
  const { rust, reason } = decide(event, gitFiles);
  console.log(reason);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `rust=${rust}\n`);
}
