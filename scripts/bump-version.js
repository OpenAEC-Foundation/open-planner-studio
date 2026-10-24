// @ts-check
// Versie-sync: JJJJ.W.N = ISO-weekjaar, ISO-week en volgnummer vanaf 0.
// npm run bump kiest de eerstvolgende versie uit vandaag, actuele origin-tags en de huidige versie.
// npm run bump 2026.43.1 zet een expliciete versie; --check controleert zonder schrijven.
// OPS_BUMP_DATE=2027-01-01 maakt de datum reproduceerbaar; tests injecteren ook de tags.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const VERSION_RE = /^([1-9]\d{3})\.([1-9]\d?)\.(0|[1-9]\d*)$/;

/** Vandaag volgens de lokale kalender, zonder tijdzoneverschuiving door toISOString(). */
function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** @param {string} date Datum als JJJJ-MM-DD. */
export function isoWeek(date) {
  const thursday = new Date(`${date}T00:00:00Z`);
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(thursday.getTime()) || thursday.toISOString().slice(0, 10) !== date) {
    throw new Error(`Ongeldige datum: ${date}; verwacht JJJJ-MM-DD.`);
  }
  // De donderdag bepaalt zowel de ISO-week als het ISO-weekjaar (ook rond nieuwjaar).
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const year = thursday.getUTCFullYear();
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return { year, week };
}

/** @param {string} version */
export function parseVersion(version) {
  const match = VERSION_RE.exec(version);
  if (match) {
    const [year, week, sequence] = match.slice(1).map(Number);
    if (week <= isoWeek(`${year}-12-28`).week && Number.isSafeInteger(sequence)) {
      return [year, week, sequence];
    }
  }
  throw new Error(`"${version}" is geen geldige versie JJJJ.W.N (ISO-weekjaar, week zonder voorloopnul, volgnummer vanaf 0).`);
}

/** @param {string} date @param {string[]} tags */
export function nextVersion(date, tags) {
  const { year, week } = isoWeek(date);
  const prefix = `v${year}.${week}.`;
  let highest = -1;
  for (const tag of tags) {
    if (!tag.startsWith(prefix) || !/^v[1-9]\d{3}\.[1-9]\d?\.(0|[1-9]\d*)$/.test(tag)) continue;
    const [, , sequence] = parseVersion(tag.slice(1));
    highest = Math.max(highest, sequence);
  }
  const version = `${year}.${week}.${highest + 1}`;
  parseVersion(version);
  return version;
}

/** Actuele tags ophalen zonder lokale refs te wijzigen; een onbereikbare origin blokkeert de bump.
 * @param {string} root
 */
function readOriginTags(root) {
  let output;
  try {
    output = execFileSync('git', ['ls-remote', '--tags', 'origin', 'v*'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      timeout: 30_000,
    });
  } catch {
    throw new Error("Kan de actuele tags van origin niet lezen (git ls-remote --tags origin 'v*'). Controleer origin en de netwerkverbinding; er zijn geen bestanden gewijzigd.");
  }
  return output.split(/\r?\n/).flatMap(line => {
    const ref = line.split('\t')[1];
    // Een annotated tag heeft ook een peeled ref met ^{}; beide wijzen naar dezelfde versie.
    return ref?.startsWith('refs/tags/') ? [ref.slice('refs/tags/'.length).replace(/\^\{\}$/, '')] : [];
  });
}

// Alleen eigen pakketvelden; dependency-, extensie-, API-contract- en bestandsformaatversies
// hebben hun eigen levenscyclus. De OpenAPI-info is de documentversie van deze appbouw.
const VERSION_FIELDS = [
  { path: 'package.json', matcher: /("version"\s*:\s*")([^"]*)(")/g, expected: 1 },
  { path: 'package-lock.json', matcher: /("name"\s*:\s*"open-planner-studio",\s*\n\s*"version"\s*:\s*")([^"]*)(")/g, expected: 2 },
  { path: 'src-tauri/tauri.conf.json', matcher: /("version"\s*:\s*")([^"]*)(")/g, expected: 1 },
  { path: 'src-tauri/Cargo.toml', matcher: /(\[package\]\s*\nname = "open-planner-studio"\s*\nversion = ")([^"]*)(")/g, expected: 1 },
  { path: 'src-tauri/Cargo.lock', matcher: /(\[\[package\]\]\s*\nname = "open-planner-studio"\s*\nversion = ")([^"]*)(")/g, expected: 1 },
  { path: 'headless/server/package.json', matcher: /("version"\s*:\s*")([^"]*)(")/g, expected: 1 },
  { path: 'headless/consumer-example/package.json', matcher: /("version"\s*:\s*")([^"]*)(")/g, expected: 1 },
  { path: 'headless/server/openapi.yaml', matcher: /(^  version: )([^\r\n]*)(\r?$)/gm, expected: 1 },
  { path: 'snap/snapcraft.yaml', matcher: /(^version: ')([^']*)(')/gm, expected: 1 },
  { path: 'integrations/claude-desktop/manifest.json', matcher: /("version"\s*:\s*")([^"]*)(")/g, expected: 1 },
];

/** @param {string} root @param {string} version */
function prepareVersionFiles(root, version) {
  return VERSION_FIELDS.map(({ path, matcher, expected }) => {
    const original = readFileSync(join(root, path), 'utf8');
    /** @type {string[]} */
    const values = [];
    const updated = original.replace(matcher, (_match, pre, value, post) => {
      values.push(value);
      return `${pre}${version}${post}`;
    });
    if (values.length !== expected) {
      throw new Error(`${path}: verwachtte ${expected} versieveld(en), vond er ${values.length}.`);
    }
    return { path, original, updated, values };
  });
}

/** Hetzelfde register controleert bij een release alle versievelden tegen de tag.
 * @param {string} version @param {string} [root]
 */
export function checkVersionFiles(version, root = repoRoot) {
  parseVersion(version);
  const mismatches = prepareVersionFiles(root, version).filter(file => file.values.some(value => value !== version));
  if (mismatches.length) {
    throw new Error(`Versies wijken af van ${version}: ${mismatches.map(file => `${file.path}=${file.values.join(',')}`).join('; ')}. Draai npm run bump.`);
  }
}

/**
 * Bereidt alle vervangingen voor vóór er wordt geschreven. Maakt geen commit of tag.
 * @param {{ root?: string, version?: string, date?: string, tags?: string[] }} [options]
 */
export function bumpVersion({ root = repoRoot, version, date = process.env.OPS_BUMP_DATE ?? today(), tags } = {}) {
  const currentVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const current = parseVersion(currentVersion);
  if (version === undefined) {
    isoWeek(date);
    const originTags = tags ?? readOriginTags(root);
    // Ook een nog niet getagde bump binnen deze week moet een hoger volgnummer krijgen.
    version = nextVersion(date, [...originTags, `v${currentVersion}`]);
  }
  const requested = parseVersion(version);
  const different = requested.findIndex((value, index) => value !== current[index]);
  if (different >= 0 && requested[different] < current[different]) {
    throw new Error(`Versie ${version} is lager dan de huidige versie ${currentVersion}.`);
  }
  const files = prepareVersionFiles(root, version);
  for (const file of files) {
    if (file.updated !== file.original) writeFileSync(join(root, file.path), file.updated);
  }
  return version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--check' && args.length === 2) {
      checkVersionFiles(args[1]);
      console.log(`Alle versievelden zijn gelijk aan ${args[1]}.`);
    } else if (args.length <= 1 && !args[0]?.startsWith('-')) {
      console.log(`Alle versievelden gelijkgetrokken naar ${bumpVersion({ version: args[0] })}.`);
    } else {
      throw new Error('Gebruik: npm run bump [JJJJ.W.N] of node scripts/bump-version.js --check JJJJ.W.N.');
    }
  } catch (error) {
    console.error(`Fout: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
