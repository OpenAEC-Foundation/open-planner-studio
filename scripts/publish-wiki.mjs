#!/usr/bin/env node
// Generates the GitHub wiki from repository sources (single source of truth) and, with --push,
// pushes it to the repo's `.wiki.git`. The wiki is a build artefact — never edit it directly.
//
//   npm run publish:wiki            # dry-run: build into .wiki-build/ and print a summary
//   npm run publish:wiki -- --push  # clone the wiki, apply the generated pages, commit + push
//
// Sources:
//   public/docs/manifest.json + public/docs/en/*.md   → the 25 manual pages (also power the in-app F1/Help)
//   docs/wiki/*.md                                     → wiki-only pages (Home, Features, Installation, …)
//   docs/CHANGELOG.md                                  → the Changelog page (as-is, Dutch, with an English note)
//   screenshot*.png                                    → image assets for the Home page
//
// See docs/superpowers/specs/2026-07-24-github-wiki-design.md.
import {
  readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.wiki-build');
const WIKI_REMOTE = 'https://github.com/OpenAEC-Foundation/open-planner-studio.wiki.git';
const RELEASES = 'https://github.com/OpenAEC-Foundation/open-planner-studio/releases';
const SCREENSHOTS = ['screenshot.png', 'screenshot-rapport.png', 'screenshot-context-menu.png'];

const push = process.argv.includes('--push');
const warnings = [];

// Turn an English article title into a stable, filename-safe wiki page slug. Used both as the page's
// filename and in every internal link, so GitHub's own sanitizing never causes a mismatch.
function slugify(title) {
  return title
    .replace(/\([^)]*\)/g, '')   // drop parentheticals: "Codes & fields (structure)" → "Codes & fields"
    .replace(/&/g, ' and ')
    .replace(/\//g, ' ')          // "Import/export" → "Import export"
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'public/docs/manifest.json'), 'utf8'));
const idToSlug = new Map(manifest.articles.map((a) => [a.id, slugify(a.title.en)]));

// Rewrite the two in-app link schemes used by the source docs into wiki-friendly links.
function rewriteLinks(md, sourceLabel) {
  // examples://foo.ifc opens a bundled example project in the app — meaningless on a web page.
  // Drop the link, keep the visible text.
  md = md.replace(/\[([^\]]+)\]\(examples:\/\/[^)]+\)/g, '$1');
  // docs://<id>[#anchor] cross-links another help article → the matching wiki page slug.
  md = md.replace(/\]\(docs:\/\/([^)#]+)(#[^)]*)?\)/g, (_m, id, hash) => {
    const slug = idToSlug.get(id);
    if (!slug) {
      warnings.push(`Unknown docs:// link "${id}" in ${sourceLabel}`);
      return `](${id}${hash || ''})`;
    }
    return `](${slug}${hash || ''})`;
  });
  return md;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const pages = [];
function writePage(name, content) {
  writeFileSync(join(OUT, `${name}.md`), content.endsWith('\n') ? content : `${content}\n`);
  pages.push(name);
}

// 1. Manual pages from the manifest.
for (const a of manifest.articles) {
  const src = join(ROOT, 'public/docs/en', `${a.id}.md`);
  if (!existsSync(src)) { warnings.push(`Missing source public/docs/en/${a.id}.md`); continue; }
  writePage(idToSlug.get(a.id), rewriteLinks(readFileSync(src, 'utf8'), `${a.id}.md`));
}

// 2. Wiki-only pages.
const wikiSrcDir = join(ROOT, 'docs/wiki');
for (const f of readdirSync(wikiSrcDir).filter((f) => f.endsWith('.md'))) {
  writePage(f.replace(/\.md$/, ''), rewriteLinks(readFileSync(join(wikiSrcDir, f), 'utf8'), f));
}

// 3. Changelog (as-is, Dutch) with an English note on top.
const changelogNote =
  `> **Note:** detailed change notes are currently maintained in Dutch. English release summaries are ` +
  `on the [Releases](${RELEASES}) page.\n\n`;
writePage('Changelog', changelogNote + readFileSync(join(ROOT, 'docs/CHANGELOG.md'), 'utf8'));

// 4. Image assets for the Home page.
for (const img of SCREENSHOTS) {
  if (existsSync(join(ROOT, img))) copyFileSync(join(ROOT, img), join(OUT, img));
}

// 5. Sidebar — wiki-only pages on top, then the manual grouped by manifest layer, then project pages.
const LAYERS = [
  ['quickstart', 'Getting started'],
  ['gidsen', 'Guides'],
  ['referentie', 'Reference'],
];
let sidebar = '**Open Planner Studio**\n\n- [Home](Home)\n- [Features](Features)\n- [Installation](Installation)\n\n';
for (const [layer, heading] of LAYERS) {
  const arts = manifest.articles.filter((a) => a.layer === layer);
  if (!arts.length) continue;
  sidebar += `**${heading}**\n\n`;
  for (const a of arts) sidebar += `- [${a.title.en}](${idToSlug.get(a.id)})\n`;
  sidebar += '\n';
}
sidebar += '**Project**\n\n- [Changelog](Changelog)\n- [Contributing](Contributing)\n- [Extensions Authoring](Extensions-Authoring)\n';
writeFileSync(join(OUT, '_Sidebar.md'), sidebar);

// 6. Footer — "generated, do not edit here" banner + license.
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

// --push: clone the wiki, replace managed files, commit + push.
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
// Remove previously managed pages/assets (leave .git intact), then copy the freshly generated set.
for (const f of readdirSync(clone)) {
  if (f === '.git') continue;
  if (f.endsWith('.md') || /\.(png|jpe?g|gif|svg)$/i.test(f)) rmSync(join(clone, f), { force: true });
}
for (const f of readdirSync(OUT)) copyFileSync(join(OUT, f), join(clone, f));

execFileSync('git', ['-C', clone, 'add', '-A'], { stdio: 'inherit' });
if (!execFileSync('git', ['-C', clone, 'status', '--porcelain']).toString().trim()) {
  console.log('\nWiki already up to date — nothing to push.');
  process.exit(0);
}
execFileSync('git', ['-C', clone, 'commit', '-m', 'docs(wiki): regenerate from repository sources'], { stdio: 'inherit' });
execFileSync('git', ['-C', clone, 'push'], { stdio: 'inherit' });
console.log('\nWiki pushed.');
