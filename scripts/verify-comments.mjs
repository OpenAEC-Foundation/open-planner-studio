#!/usr/bin/env node
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const JS_FILE = /\.(?:js|jsx|mjs|cjs)$/;
const OUT_OF_SCOPE = [/^docs\//, /^examples\//, /^node_modules\//, /\.generated\.[a-z]+$/];

const SEPARATORS = String.fromCharCode(0x2028, 0x2029);
const LINE_BREAK = new RegExp(`[\\n\\r${SEPARATORS}]`);
const LINE_BREAKS = new RegExp(`\\r\\n|[\\n\\r${SEPARATORS}]`);
const AFTER_LINE_BREAK = new RegExp(`(?<=\\n|\\r(?!\\n)|[${SEPARATORS}])`);
const FINAL_LINE_BREAK = new RegExp(`(?:\\r\\n|[\\n\\r${SEPARATORS}])$`);

const LINT_OR_BUNDLER_DIRECTIVE = new RegExp('^(?:' + [
  String.raw`(?://|/\*)\s*eslint-(?:disable|enable)(?:-next-line|-line)?(?:\s|\*/|$)`,
  String.raw`/\*\s*eslint-env\s+[\w-]+`,
  String.raw`/\*\s*eslint\s+[\w@/-]+\s*:`,
  String.raw`/\*\s*globals?\s+[\w$]+\s*[:,*]`,
  String.raw`/\*\s*@vite-ignore\s*\*/`,
  String.raw`/\*\s*[@#]__(?:PURE|NO_SIDE_EFFECTS)__\s*\*/`,
  String.raw`//#\s*sourceMappingURL=\S+\s*$`,
  String.raw`(?://|/\*)\s*text-roles:\s*\S`,
].join('|') + ')');

const LICENCE_ID = String.raw`\b(?:LGPL|AGPL|GPL|MPL|Apache|BSD|MIT)-\d[\w.+-]*`;
const NOTICE_LINE = new RegExp('^//\\s*(?:' + [
  String.raw`SPDX-License-Identifier:\s*\S+`,
  String.raw`(?:Copyright|©)\s*(?:\(c\)\s*)?\d{4}\b.{0,80}`,
  String.raw`(?:Bron|Source|Licentie|License)(?: [^:]{1,40})?:\s.{0,160}${LICENCE_ID}.{0,80}`,
].join('|') + ')$');

export function inScope(path) {
  const rel = path.split(sep).join('/');
  return CODE_FILE.test(rel) && !OUT_OF_SCOPE.some(re => re.test(rel));
}

function scriptKind(path) {
  if (/\.(?:tsx|jsx)$/.test(path)) return ts.ScriptKind.TSX;
  return /\.(?:ts|mts|cts)$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

function parse(text, path) {
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, scriptKind(path));
}

function isJsDocNode(node) {
  return node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode;
}

function compilerDirectives(sourceFile) {
  const starts = new Set();
  for (const pragma of sourceFile.pragmas?.values() ?? []) {
    for (const entry of Array.isArray(pragma) ? pragma : [pragma]) starts.add(entry.range.pos);
  }
  for (const directive of sourceFile.commentDirectives ?? []) starts.add(directive.range.pos);
  return starts;
}

function typeTags(sourceFile, path) {
  const typed = new Set();
  const typeOnly = new Set();
  if (!JS_FILE.test(path)) return { typed, typeOnly };
  const carriesType = tag => Boolean(tag.typeExpression || tag.constraint
    || tag.kind === ts.SyntaxKind.JSDocTemplateTag || tag.kind === ts.SyntaxKind.JSDocImportTag);
  const visit = (node) => {
    for (const doc of node.jsDoc ?? []) {
      const tags = doc.tags ?? [];
      if (!tags.some(carriesType)) continue;
      typed.add(doc.pos);
      if (!doc.comment && tags.every(tag => carriesType(tag) && !tag.comment)) typeOnly.add(doc.pos);
    }
    if (!isJsDocNode(node)) node.getChildren(sourceFile).forEach(visit);
  };
  visit(sourceFile);
  return { typed, typeOnly };
}

function commentRanges(sourceFile, text) {
  const ranges = new Map();
  const jsxText = [];
  const visit = (node) => {
    if (isJsDocNode(node)) return;
    if (node.kind === ts.SyntaxKind.JsxText) {
      jsxText.push([node.pos, node.end]);
      return;
    }
    const children = node.getChildren(sourceFile);
    if (children.length === 0) {
      for (const range of ts.getLeadingCommentRanges(text, node.pos) ?? []) ranges.set(range.pos, range);
      for (const range of ts.getTrailingCommentRanges(text, node.end) ?? []) ranges.set(range.pos, range);
    }
    children.forEach(visit);
  };
  visit(sourceFile);
  const insideJsxText = range => jsxText.some(([pos, end]) => range.pos >= pos && range.pos < end);
  return [...ranges.values()].filter(range => !insideJsxText(range)).sort((a, b) => a.pos - b.pos);
}

function scanBlocks(text, path) {
  const sourceFile = parse(text, path);
  const lineStarts = sourceFile.getLineStarts();
  const lineOf = pos => sourceFile.getLineAndCharacterOfPosition(pos).line;
  const lineEnd = line => (line + 1 < lineStarts.length ? lineStarts[line + 1] : text.length);
  const blankAround = (pos, end) => text.slice(lineStarts[lineOf(pos)], pos).trim() === ''
    && text.slice(end, lineEnd(lineOf(Math.max(pos, end - 1)))).trim() === '';
  const directives = compilerDirectives(sourceFile);
  const { typed, typeOnly } = typeTags(sourceFile, path);
  const isExempt = (range, raw) => directives.has(range.pos) || typeOnly.has(range.pos)
    || LINT_OR_BUNDLER_DIRECTIVE.test(raw) || NOTICE_LINE.test(raw);

  const blocks = [];
  for (const range of commentRanges(sourceFile, text)) {
    const raw = text.slice(range.pos, range.end);
    if (isExempt(range, raw)) continue;
    const line = lineOf(range.pos);
    const endLine = lineOf(range.end - 1);
    const previous = blocks.at(-1);
    const alone = blankAround(range.pos, range.end);
    if (previous && previous.kind === 'line' && previous.alone && alone && raw.startsWith('//') && previous.endLine === line - 1) {
      previous.endLine = endLine;
      previous.end = range.end;
      previous.text += '\n' + raw;
      continue;
    }
    const open = text.slice(0, range.pos).search(/\{\s*$/);
    const close = /^\s*\}/.exec(text.slice(range.end));
    const jsx = /\.(?:tsx|jsx)$/.test(path) && open >= 0 && close !== null;
    blocks.push({
      line, endLine, alone, pos: range.pos, end: range.end, text: raw,
      carriesType: typed.has(range.pos),
      kind: jsx ? 'jsx' : raw.startsWith('/**') ? 'jsdoc' : raw.startsWith('//') ? 'line' : 'block',
      ...(jsx ? { wrapper: [open, range.end + close[0].length] } : {}),
    });
  }
  for (const block of blocks) {
    if (block.wrapper) block.wrapperAlone = blankAround(block.wrapper[0], block.wrapper[1]);
  }
  return { lineStarts, lineOf, lineEnd, blocks };
}

const splitLines = text => text.split(AFTER_LINE_BREAK);

function removableLines(block, lineOf) {
  if (block.carriesType) return null;
  if (block.kind === 'jsx') return block.wrapperAlone ? [lineOf(block.wrapper[0]), lineOf(block.wrapper[1] - 1)] : null;
  return block.alone ? [block.line, block.endLine] : null;
}

function withoutLines(lines, removed) {
  const isBlank = index => lines[index].trim() === '';
  const kept = index => index >= 0 && index < lines.length && !removed.has(index);
  const previousKept = (index) => { let i = index - 1; while (i >= 0 && !kept(i)) i--; return i; };
  const nextKept = (index) => { let i = index + 1; while (i < lines.length && !kept(i)) i++; return i; };
  const seams = [...removed].filter(index => !removed.has(index - 1)).sort((a, b) => a - b);
  const extra = new Set();
  for (const first of seams) {
    const before = previousKept(first);
    const after = nextKept(first);
    if (after >= lines.length || !isBlank(after)) {
      const closesBlock = after < lines.length && /^\s*[)\]}]/.test(lines[after]);
      if (closesBlock && before >= 0 && isBlank(before)) extra.add(before);
      continue;
    }
    if (before < 0 || isBlank(before) || /[{[(]\s*$/.test(lines[before])) extra.add(after);
  }
  return { lines: lines.filter((_, index) => !removed.has(index) && !extra.has(index)), extraBlank: extra.size };
}

export function scanComments(text, path) {
  const { blocks, lineOf } = scanBlocks(text, path);
  const removed = new Set();
  let commentLines = 0;
  for (const block of blocks) {
    commentLines += block.endLine - block.line + 1;
    const span = removableLines(block, lineOf);
    if (span) for (let line = span[0]; line <= span[1]; line++) removed.add(line);
  }
  const { extraBlank } = withoutLines(splitLines(text), removed);
  return {
    commentLines,
    shedLines: removed.size + extraBlank,
    blocks: blocks.map(({ line, endLine, kind, text: blockText }) => ({ line: line + 1, endLine: endLine + 1, kind, text: blockText })),
  };
}

export function commentLineEntries(text, path) {
  return scanComments(text, path).blocks.flatMap(block => block.text.split(LINE_BREAKS)
    .map((line, offset) => ({ path, line: block.line + offset, text: line.trim() })));
}

export function addedCommentLines(now, base) {
  const available = new Map();
  for (const { text } of base) available.set(text, (available.get(text) ?? 0) + 1);
  return now.filter(({ text }) => {
    const left = available.get(text) ?? 0;
    if (left === 0) return true;
    available.set(text, left - 1);
    return false;
  });
}

function codeSignature(text, path) {
  const sourceFile = parse(text, path);
  const parts = [];
  const visit = (node) => {
    if (isJsDocNode(node)) return;
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) return;
    if (node.kind === ts.SyntaxKind.JsxText) {
      const words = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
      if (words) parts.push(words);
      return;
    }
    const children = node.getChildren(sourceFile);
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }
    const onNewLine = parts.length > 0 && LINE_BREAK.test(text.slice(node.pos, node.getStart(sourceFile)));
    parts.push((onNewLine ? '\n' : '') + node.getText(sourceFile));
  };
  visit(sourceFile);
  return parts.join(String.fromCharCode(0));
}

export function stripComments(text, path, onlyLines) {
  const { blocks, lineStarts, lineOf, lineEnd } = scanBlocks(text, path);
  const chosen = blocks.filter(block => !onlyLines || onlyLines.has(block.line + 1));
  const removedLines = new Set();
  const cuts = [];
  const manual = [];
  for (const block of chosen) {
    const span = removableLines(block, lineOf);
    if (span) {
      for (let line = span[0]; line <= span[1]; line++) removedLines.add(line);
    } else if (block.carriesType || block.kind === 'jsx' || LINE_BREAK.test(block.text)) {
      manual.push(block.line + 1);
    } else {
      const lineStart = lineStarts[block.line];
      const before = text.slice(lineStart, block.pos);
      const after = text.slice(block.end, lineEnd(block.endLine));
      if (after.trim() === '') cuts.push([lineStart + before.trimEnd().length, block.end + after.replace(FINAL_LINE_BREAK, '').length]);
      else cuts.push([block.pos, block.end + (/^\s*/.exec(after)[0].length > 0 && /\s$/.test(before) ? /^[ \t]*/.exec(after)[0].length : 0)]);
    }
  }
  let next = text;
  for (const [from, to] of cuts.sort((a, b) => b[0] - a[0])) next = next.slice(0, from) + next.slice(to);
  const { lines, extraBlank } = withoutLines(splitLines(next), removedLines);
  next = lines.join('');
  if (codeSignature(next, path) !== codeSignature(text, path)) {
    throw new Error(`${path}: de code verandert door het weghalen; doe dit bestand met de hand`);
  }
  return { text: next, removed: chosen.length - manual.length, shedLines: removedLines.size + extraBlank, manual };
}

const git = (args, options = {}) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28, ...options }).toString('utf8');

export function trackedCodeFiles() {
  return git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0')
    .filter(path => path && inScope(path) && existsSync(join(ROOT, path))).sort();
}

function firstParentInCi() {
  const parent = /^parent ([0-9a-f]+)$/m.exec(git(['cat-file', '-p', 'HEAD']))?.[1];
  if (!parent) throw new Error('HEAD heeft geen oudercommit');
  try {
    execFileSync('git', ['cat-file', '-e', `${parent}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
  } catch {
    execFileSync('git', ['fetch', '--quiet', '--depth=1', 'origin', parent], { cwd: ROOT, stdio: 'inherit' });
  }
  return parent;
}

function baseCommit() {
  if (process.env.VERIFY_COMMENTS_BASE) return git(['rev-parse', '--verify', `${process.env.VERIFY_COMMENTS_BASE}^{commit}`]).trim();
  if (process.env.GITHUB_ACTIONS) return firstParentInCi();
  for (const ref of ['origin/main', 'main']) {
    try {
      return git(['merge-base', 'HEAD', ref], { stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      continue;
    }
  }
  throw new Error('geen basiscommit gevonden: haal origin/main op of zet VERIFY_COMMENTS_BASE');
}

function atCommit(commit, path) {
  try {
    return git(['show', `${commit}:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function changedSince(commit) {
  const changed = git(['diff', '--no-renames', '--name-only', '-z', commit]).split('\0');
  const untracked = git(['ls-files', '-z', '--others', '--exclude-standard']).split('\0');
  return [...new Set([...changed, ...untracked])].filter(path => path && inScope(path)).sort();
}

function selectFiles(args) {
  const wanted = args.map(arg => relative(ROOT, resolve(arg)).split(sep).join('/'));
  return trackedCodeFiles().filter(path => wanted.length === 0
    || wanted.some(want => path === want || path.startsWith(want.replace(/\/?$/, '/'))));
}

function main(argv) {
  const [mode, ...rest] = argv;
  if (mode === '--list') {
    const out = selectFiles(rest).flatMap((path) => {
      const { blocks } = scanComments(readFileSync(join(ROOT, path), 'utf8'), path);
      return blocks.map(block => ({ file: path, ...block }));
    });
    console.log(JSON.stringify(out, null, 1));
    return 0;
  }
  if (mode === '--strip') {
    const only = rest.indexOf('--only');
    const paths = only < 0 ? rest : rest.slice(0, only);
    const onlyLines = only < 0 ? undefined : new Set(rest.slice(only + 1).flatMap(arg => arg.split(',')).map(Number));
    if (paths.length === 0 || (onlyLines && paths.length !== 1)) {
      console.error('--strip vraagt een pad; --only werkt op precies één bestand');
      return 2;
    }
    let shed = 0;
    for (const path of selectFiles(paths)) {
      const full = join(ROOT, path);
      const result = stripComments(readFileSync(full, 'utf8'), path, onlyLines);
      if (result.removed > 0) writeFileSync(full, result.text);
      shed += result.shedLines;
      const manual = result.manual.length > 0 ? `; met de hand: regel ${result.manual.join(', ')}` : '';
      console.log(`${path}: ${result.removed} blok(ken) weg, ${result.shedLines} regels minder${manual}`);
    }
    console.log(`OK  ${shed} regels minder`);
    return 0;
  }
  if (mode === '--stats') {
    const totals = { bestanden: 0, regels: 0, commentaarblokken: 0, commentaarregels: 0, regelsDieVerdwijnen: 0 };
    for (const path of selectFiles(rest)) {
      const text = readFileSync(join(ROOT, path), 'utf8');
      const scan = scanComments(text, path);
      totals.bestanden++;
      totals.regels += text.split('\n').length;
      totals.commentaarblokken += scan.blocks.length;
      totals.commentaarregels += scan.commentLines;
      totals.regelsDieVerdwijnen += scan.shedLines;
    }
    console.log(JSON.stringify(totals, null, 1));
    return 0;
  }
  if (mode !== undefined) {
    console.error(`onbekende optie: ${mode}`);
    return 2;
  }

  const base = baseCommit();
  const changed = changedSince(base);
  const now = changed.filter(path => existsSync(join(ROOT, path)))
    .flatMap(path => commentLineEntries(readFileSync(join(ROOT, path), 'utf8'), path));
  const before = changed.flatMap(path => commentLineEntries(atCommit(base, path), path));
  const added = addedCommentLines(now, before);
  for (const { path, line, text } of added) console.log(`XX  ${path}:${line}  ${text}`);
  if (added.length > 0) {
    console.log(`\nXX  ${added.length} nieuwe commentaarregel(s) ten opzichte van ${base.slice(0, 9)}. Commentaar in code is verboden`);
    console.log('    (docs/adr/0001-geen-commentaar-in-code.md): zeg het in de code (naam, type, test), leg een besluit vast');
    console.log('    in docs/adr/ en een bekende grens in knownbugs.md. Bestaand commentaar mag je weghalen, niet herschrijven.');
    return 1;
  }
  console.log(`OK  geen nieuw commentaar in ${changed.length} gewijzigde bestand(en) ten opzichte van ${base.slice(0, 9)}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}
