#!/usr/bin/env node
// Releaseteksten uit één bron.
//
// De releaseworkflow had t/m v2026.7.13 nergens een plek voor de échte
// releasetekst: `create-release` schreef een hardgecodeerde generieke body en
// het `notes`-veld in `latest.json` (wat de updater-dialoog toont) bleef leeg.
// Bij v2026.7.12 is dat zo blijven staan; bij v2026.7.13 is het met de hand
// rechtgezet. Dit script haalt beide teksten uit één bronbestand:
//
//   docs/release-notes/<versie>.md   — alleen de "What's New"-inhoud
//
// en zet die om naar de twee formaten die de release nodig heeft:
//
//   --format=body    markdown voor de GitHub-releasepagina (+ Downloads-blok)
//   --format=notes   platte tekst voor `latest.json` → updater-dialoog
//
// De dialoog rendert geen markdown, vandaar dat `notes` gestript wordt.
//
// Ontbreekt het bronbestand, dan valt het script terug op het gedrag van
// vóór deze wijziging (generieke body, leeg notes-veld) en meldt dat als
// GitHub-warning. Een vergeten notesbestand mag nooit een release breken.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DOWNLOADS = [
  '### Downloads',
  '- **Windows**: Download the `.exe` setup file',
  '- **macOS**: Download the `.dmg` file (universal - supports Intel and Apple Silicon)',
  '- **Linux**: Download the `.deb` package or `.AppImage`',
  '- **Claude Desktop**: Download the `.mcpb` file and double-click it to connect Claude to the running app',
].join('\n');

/** Inline-markdown weghalen voor de updater-dialoog, die platte tekst toont. */
function stripMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // links → tekst (url)
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // vet
    .replace(/`([^`]+)`/g, '$1'); // code
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

// Zowel `v2026.7.13` als `2026.7.13` accepteren; de bestandsnaam en de
// zichtbare teksten gebruiken altijd de v-vorm.
const tag = version.startsWith('v') ? version : `v${version}`;

// De versie komt bij workflow_dispatch uit vrije, niet-vertrouwde invoer en
// wordt hieronder een pad. Zonder deze controle leest `../../iets` een
// willekeurig bestand de release-omschrijving in. De gate-job vangt dit ook al
// af (tag moet gelijk zijn aan de gebumpte versie), maar niet als eerste.
if (!/^v[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(tag)) {
  usage(`Onveilige of onherkenbare versie: ${version}`);
}
const sourcePath = join(ROOT, 'docs', 'release-notes', `${tag}.md`);

if (!existsSync(sourcePath)) {
  console.error(
    `::warning::Geen releasetekst gevonden op docs/release-notes/${tag}.md — ` +
      'terugval op de generieke tekst. Voeg dat bestand toe voor een volgende release.',
  );
  // Exact het gedrag van vóór deze wijziging.
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
