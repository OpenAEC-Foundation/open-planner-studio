#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DOWNLOADS = [
  '### Downloads',
  '- **Windows**: Download the `.exe` setup file',
  '- **macOS**: Download the `.dmg` file (universal - supports Intel and Apple Silicon)',
  '- **Linux**: Download the `.deb` package or `.AppImage`',
  '- **Claude Desktop**: Download the `.mcpb` file and double-click it to connect Claude to the app, or to a working folder when the app is closed',
].join('\n');

function stripMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1');
}

function usage(message) {
  console.error(`${message}\n\nGebruik: node scripts/release-notes.mjs <versie> --format=body|notes`);
  process.exit(2);
}

const args = process.argv.slice(2);
const formatArg = args.find((a) => a.startsWith('--format='));
const version = args.find((a) => !a.startsWith('--'));

if (!version) usage('Geen versie opgegeven.');
const format = formatArg ? formatArg.slice('--format='.length) : '';
if (format !== 'body' && format !== 'notes') usage(`Onbekend formaat: ${format || '(geen)'}.`);

const tag = version.startsWith('v') ? version : `v${version}`;

if (!/^v[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(tag)) {
  usage(`Onveilige of onherkenbare versie: ${version}`);
}
const sourcePath = join(ROOT, 'docs', 'release-notes', `${tag}.md`);

if (!existsSync(sourcePath)) {
  console.error(
    `::warning::Geen releasetekst gevonden op docs/release-notes/${tag}.md — ` +
      'terugval op de generieke tekst. Voeg dat bestand toe voor een volgende release.',
  );
  process.stdout.write(
    format === 'body'
      ? `## What's New in ${tag}\n\nFree, open-source project planner built with Tauri.\n\n${DOWNLOADS}`
      : '',
  );
  process.exit(0);
}

const content = readFileSync(sourcePath, 'utf8').trim();
if (!content) usage(`Bronbestand docs/release-notes/${tag}.md is leeg.`);

process.stdout.write(
  format === 'body'
    ? `## What's New in ${tag}\n\n${content}\n\n${DOWNLOADS}`
    : `Open Planner Studio ${tag}\n\n${stripMarkdown(content)}`,
);
