#!/usr/bin/env node
// Bepaal reproduceerbare U4-releasecijfers. Dit script leest uitsluitend Git;
// de app probeert nooit een incomplete GitHub-compare te reconstrueren.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const version = process.argv[2] ?? JSON.parse(readFileSync('package.json', 'utf8')).version;
const current = `v${version.replace(/^v/, '')}`;
const tags = run('tag', '--list', 'v*', '--sort=-version:refname').split('\n').filter(Boolean);
const currentIndex = tags.indexOf(current);
if (currentIndex < 0 || !tags[currentIndex + 1]) {
  console.error(`XX ${current}: huidige of vorige stabiele tag ontbreekt`);
  process.exit(1);
}
const previous = tags[currentIndex + 1];
const days = Math.max(0, Math.round((Date.parse(run('log', '-1', '--format=%cI', current)) - Date.parse(run('log', '-1', '--format=%cI', previous))) / 86400000));
const commits = Number(run('rev-list', '--count', `${previous}..${current}`));
const excluded = [
  ':(exclude)docs/**', ':(exclude)public/docs/**', ':(exclude)src/i18n/**',
  ':(exclude)**/package-lock.json', ':(exclude)**/*.lock', ':(exclude)dist/**',
  ':(exclude)node_modules/**', ':(exclude)vendor/**', ':(exclude)public/examples/**',
];
const included = ['src', 'src-tauri', 'scripts', 'tests'];
const lines = run('diff', '--numstat', `${previous}..${current}`, '--', ...included, ...excluded)
  .split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split('\t')[0] || 0), 0);
console.log(JSON.stringify({ version: version.replace(/^v/, ''), previous, current, daysSincePrevious: days, commitsSincePrevious: commits, addedCodeLines: lines }, null, 2));
