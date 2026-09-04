// Taggebonden U4-poort: valideert dezelfde getypeerde catalogus die de dialoog rendert
// én vergelijkt de bewaarde cijfers met reproduceerbare Git-metingen.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { RELEASE_HIGHLIGHT_CATALOG, isStableReleaseTag, validateReleaseHighlightCatalog, validateReleaseHighlightStats, type ReleaseStats } from '@/services/updater/releaseHighlights';

const runGit = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' }).trim();
const version = (process.argv[2] ?? JSON.parse(readFileSync('package.json', 'utf8')).version as string).replace(/^v/i, '');
const targetTag = `v${version}`;
const tags = runGit('tag', '--list', 'v*', '--sort=-version:refname').split('\n').filter(isStableReleaseTag);
const currentIndex = tags.indexOf(targetTag);
const current = currentIndex >= 0 ? targetTag : 'HEAD';
const errors = validateReleaseHighlightCatalog(RELEASE_HIGHLIGHT_CATALOG, version);

const previous = currentIndex >= 0 ? tags[currentIndex + 1] : tags[0];
if (!previous) {
  errors.push(`${targetTag}: vorige stabiele tag ontbreekt`);
} else {
  const daysSincePrevious = Math.max(0, Math.round((Date.parse(runGit('log', '-1', '--format=%cI', current)) - Date.parse(runGit('log', '-1', '--format=%cI', previous))) / 86_400_000));
  const commitsSincePrevious = Number(runGit('rev-list', '--count', `${previous}..${current}`));
  const excluded = [
    ':(exclude)docs/**', ':(exclude)public/docs/**', ':(exclude)src/i18n/**',
    ':(exclude)**/package-lock.json', ':(exclude)**/*.lock', ':(exclude)dist/**',
    ':(exclude)node_modules/**', ':(exclude)vendor/**', ':(exclude)public/examples/**',
  ];
  const addedCodeLines = runGit('diff', '--numstat', `${previous}..${current}`, '--', 'src', 'src-tauri', 'scripts', 'tests', ...excluded)
    .split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split('\t')[0] || 0), 0);
  const measured: ReleaseStats = { daysSincePrevious, commitsSincePrevious, addedCodeLines };
  errors.push(...validateReleaseHighlightStats(RELEASE_HIGHLIGHT_CATALOG, version, measured));
  if (errors.length === 0) console.log(JSON.stringify({ version, previous, current, ...measured }, null, 2));
}

if (errors.length) {
  for (const error of errors) console.error(`XX ${error}`);
  process.exitCode = 1;
}
