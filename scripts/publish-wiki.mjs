#!/usr/bin/env node
import {
  readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync, cpSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.wiki-build');
const WIKI_REMOTE = 'https://github.com/OpenAEC-Foundation/open-planner-studio.wiki.git';
const SCREENSHOTS = ['screenshot.png', 'screenshot-rapport.png', 'screenshot-context-menu.png'];

const push = process.argv.includes('--push');
const warnings = [];

function slugify(title) {
  return title
    .replace(/\([^)]*\)/g, '')
    .replace(/&/g, ' and ')
    .replace(/\//g, ' ')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'public/docs/manifest.json'), 'utf8'));
const aliases = manifest.aliases && typeof manifest.aliases === 'object' ? manifest.aliases : {};
const published = manifest.articles.filter((a) => a.draft !== true);
const draftIds = new Set(manifest.articles.filter((a) => a.draft === true).map((a) => a.id));
const idToSlug = new Map(published.map((a) => [a.id, slugify(a.title.en)]));

function rewriteLinks(md, sourceLabel) {
  md = md.replace(/\[([^\]]+)\]\(examples:\/\/[^)]+\)/g, '$1');
  md = md.replace(/\[([^\]]+)\]\(settings:\/\/[^)]+\)/g, '$1');
  md = md.replace(/\[([^\]]+)\]\(docs:\/\/([^)#]+)(#[^)]*)?\)/g, (_m, label, rawId, hash) => {
    const id = idToSlug.has(rawId) ? rawId : (aliases[rawId] ?? rawId);
    const slug = idToSlug.get(id);
    if (!slug) {
      if (draftIds.has(id)) {
        warnings.push(`docs:// link to draft "${id}" in ${sourceLabel} — published as plain text`);
        return label;
      }
      warnings.push(`Unknown docs:// link "${rawId}" in ${sourceLabel}`);
      return `[${label}](${rawId}${hash || ''})`;
    }
    return `[${label}](${slug}${hash || ''})`;
  });
  md = md.replace(/(!\[[^\]]*\]\([^)]*)\{lang\}/g, '$1en');
  return md;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const pages = [];
function writePage(name, content) {
  writeFileSync(join(OUT, `${name}.md`), content.endsWith('\n') ? content : `${content}\n`);
  pages.push(name);
}

for (const a of published) {
  const src = join(ROOT, 'public/docs/en', `${a.id}.md`);
  if (!existsSync(src)) { warnings.push(`Missing source public/docs/en/${a.id}.md`); continue; }
  writePage(idToSlug.get(a.id), rewriteLinks(readFileSync(src, 'utf8'), `${a.id}.md`));
}

const wikiSrcDir = join(ROOT, 'docs/wiki');
for (const f of readdirSync(wikiSrcDir).filter((f) => f.endsWith('.md'))) {
  writePage(f.replace(/\.md$/, ''), rewriteLinks(readFileSync(join(wikiSrcDir, f), 'utf8'), f));
}

writePage('Changelog', readFileSync(join(ROOT, 'docs/CHANGELOG.md'), 'utf8'));

for (const img of SCREENSHOTS) {
  if (existsSync(join(ROOT, img))) copyFileSync(join(ROOT, img), join(OUT, img));
}

const DOC_IMAGES = join(ROOT, 'public/docs/img/en');
if (existsSync(DOC_IMAGES)) cpSync(DOC_IMAGES, join(OUT, 'img/en'), { recursive: true });

const KINDS = [
  ['howto', 'How-to guides'],
  ['uitleg', 'Explanation'],
  ['referentie', 'Reference'],
];
let sidebar = '**Open Planner Studio**\n\n- [Home](Home)\n- [Features](Features)\n- [Installation](Installation)\n\n';
sidebar += '**Tutorials**\n\nStep-by-step tutorials live in the app: install the Tutorials extension via Help › Tutorials.\n\n';
for (const [kind, heading] of KINDS) {
  const arts = published.filter((a) => a.kind === kind);
  if (!arts.length) continue;
  sidebar += `**${heading}**\n\n`;
  for (const a of arts) sidebar += `- [${a.title.en}](${idToSlug.get(a.id)})\n`;
  sidebar += '\n';
}
for (const a of published.filter((x) => !KINDS.some(([kind]) => kind === x.kind))) {
  warnings.push(`"${a.id}" has no known kind (${a.kind}) — published without a sidebar entry`);
}
sidebar += '**Project**\n\n- [Changelog](Changelog)\n- [Contributing](Contributing)\n- [Extensions Authoring](Extensions-Authoring)\n';
writeFileSync(join(OUT, '_Sidebar.md'), sidebar);

writeFileSync(join(OUT, '_Footer.md'),
  `---\n` +
  `⚠️ **This wiki is generated from the [repository](https://github.com/OpenAEC-Foundation/open-planner-studio).** ` +
  `Edit the source under \`public/docs/en/\` and \`docs/wiki/\` — direct wiki edits are overwritten on the next release.\n\n` +
  `Open Planner Studio · LGPL-3.0 · part of the [OpenAEC-Foundation](https://github.com/OpenAEC-Foundation)\n`);

console.log(`Generated ${pages.length} pages + _Sidebar + _Footer into ${OUT}`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}

if (!push) {
  console.log('\nDry-run (no push). Review .wiki-build/, then run: npm run publish:wiki -- --push');
  process.exit(0);
}

const clone = join(ROOT, '.wiki-repo');
rmSync(clone, { recursive: true, force: true });
try {
  execFileSync('git', ['clone', '--depth', '1', WIKI_REMOTE, clone], { stdio: 'inherit' });
} catch {
  console.error(
    `\nCould not clone ${WIKI_REMOTE}.\n` +
    `Bootstrap the wiki first: enable Wikis in repo Settings → Features and create one page in the web UI.`);
  process.exit(1);
}
for (const f of readdirSync(clone)) {
  if (f === '.git') continue;
  if (f === 'img') rmSync(join(clone, f), { recursive: true, force: true });
  else if (f.endsWith('.md') || /\.(png|jpe?g|gif|svg|webp)$/i.test(f)) rmSync(join(clone, f), { force: true });
}
cpSync(OUT, clone, { recursive: true });

execFileSync('git', ['-C', clone, 'add', '-A'], { stdio: 'inherit' });
if (!execFileSync('git', ['-C', clone, 'status', '--porcelain']).toString().trim()) {
  console.log('\nWiki already up to date — nothing to push.');
  process.exit(0);
}
execFileSync('git', ['-C', clone, 'commit', '-m', 'docs(wiki): regenerate from repository sources'], { stdio: 'inherit' });
execFileSync('git', ['-C', clone, 'push'], { stdio: 'inherit' });
console.log('\nWiki pushed.');
