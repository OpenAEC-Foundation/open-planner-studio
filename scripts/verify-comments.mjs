#!/usr/bin/env node
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_PATH = join(ROOT, 'scripts', 'verify-comments.baseline.json');

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const OUT_OF_SCOPE = [/^docs\//, /^examples\//, /^node_modules\//, /\.generated\.[a-z]+$/, /\.d\.ts$/];

const TOOL_DIRECTIVE = new RegExp('^(?:' + [
  String.raw`//\s*@ts-(?:check|nocheck|ignore|expect-error)\b`,
  String.raw`//\s*eslint-(?:disable|enable)\b`,
  String.raw`/\*\s*eslint(?:-disable|-enable|-env)?\b`,
  String.raw`/\*\s*globals?\s`,
  String.raw`///\s*<`,
  String.raw`/\*\s*@vite-ignore\s*\*/`,
  String.raw`/\*\s*[@#]__(?:PURE|NO_SIDE_EFFECTS)__\s*\*/`,
  String.raw`//#\s*sourceMappingURL=`,
  String.raw`(?://|/\*)\s*text-roles:\s*\S`,
].join('|') + ')');

const LICENCE_NOTICE = /SPDX-License-Identifier:|\bCopyright\b|©|\b(?:LGPL|AGPL|GPL|MPL|Apache|BSD|MIT)-\d/;

const JSDOC_TYPE_TAG = /@(?:type|param|returns?|typedef|template|import|satisfies|callback|property|this|enum|extends|implements|overload)\b/;

export function inScope(path) {
  const rel = path.split(sep).join('/');
  return CODE_FILE.test(rel) && !OUT_OF_SCOPE.some(re => re.test(rel));
}

function scriptKind(path) {
  if (/\.(?:tsx|jsx)$/.test(path)) return ts.ScriptKind.TSX;
  return /\.(?:ts|mts|cts)$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

function isExempt(text, path) {
  if (TOOL_DIRECTIVE.test(text) || LICENCE_NOTICE.test(text)) return true;
  return /\.(?:js|jsx|mjs|cjs)$/.test(path) && text.startsWith('/**') && JSDOC_TYPE_TAG.test(text);
}

function commentRanges(sourceFile, text) {
  const ranges = new Map();
  const jsxText = [];
  const visit = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
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

function blockKind(text, inJsx) {
  if (inJsx) return 'jsx';
  if (text.startsWith('/**')) return 'jsdoc';
  return text.startsWith('//') ? 'line' : 'block';
}

function scanBlocks(text, path) {
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, scriptKind(path));
  const lineStarts = sourceFile.getLineStarts();
  const lineOf = pos => sourceFile.getLineAndCharacterOfPosition(pos).line;
  const lineEnd = line => (line + 1 < lineStarts.length ? lineStarts[line + 1] : text.length);
  const blankAround = (pos, end) => text.slice(lineStarts[lineOf(pos)], pos).trim() === ''
    && text.slice(end, lineEnd(lineOf(Math.max(pos, end - 1)))).trim() === '';

  const blocks = [];
  for (const range of commentRanges(sourceFile, text)) {
    const raw = text.slice(range.pos, range.end);
    if (isExempt(raw, path)) continue;
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
      kind: jsx ? 'jsx' : raw.startsWith('/**') ? 'jsdoc' : raw.startsWith('//') ? 'line' : 'block',
      ...(jsx ? { wrapper: [open, range.end + close[0].length] } : {}),
    });
  }
  for (const block of blocks) {
    if (block.wrapper) block.wrapperAlone = blankAround(block.wrapper[0], block.wrapper[1]);
  }
  return { sourceFile, lineStarts, lineOf, lineEnd, blocks };
}

const splitLines = text => text.split(/(?<=\n|\r(?!\n)|\u2028|\u2029)/);

function removableLines(block, lineOf) {
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
      const opensBlock = after < lines.length && /^\s*[)\]}]/.test(lines[after]);
      if (opensBlock && before >= 0 && isBlank(before)) extra.add(before);
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

function codeSignature(text, path) {
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, scriptKind(path));
  const parts = [];
  const visit = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) return;
    if (node.kind === ts.SyntaxKind.JsxText) {
      const words = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
      if (words) parts.push(words);
      return;
    }
    const children = node.getChildren(sourceFile);
    if (children.length === 0) parts.push(node.getText(sourceFile));
    else children.forEach(visit);
  };
  visit(sourceFile);
  return parts.join('\u0000');
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
    } else if (block.kind === 'jsx') {
      manual.push(block.line + 1);
    } else {
      const lineStart = lineStarts[block.line];
      const before = text.slice(lineStart, block.pos);
      const after = text.slice(block.end, lineEnd(block.endLine));
      if (after.trim() === '') cuts.push([lineStart + before.trimEnd().length, block.end + after.replace(/\r?\n$/, '').length]);
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

export function trackedCodeFiles(root = ROOT) {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, maxBuffer: 1 << 28 });
  return out.toString('utf8').split('\0').filter(path => path && inScope(path) && existsSync(join(root, path))).sort();
}

export function countAll(root = ROOT, files = trackedCodeFiles(root)) {
  const counts = {};
  let shedLines = 0;
  let blocks = 0;
  let totalLines = 0;
  for (const path of files) {
    const text = readFileSync(join(root, path), 'utf8');
    const scan = scanComments(text, path);
    totalLines += text.split('\n').length;
    shedLines += scan.shedLines;
    blocks += scan.blocks.length;
    if (scan.commentLines > 0) counts[path] = scan.commentLines;
  }
  return { counts, shedLines, blocks, totalLines, files: files.length };
}

export function compare(baseline, counts) {
  const over = [];
  const under = [];
  for (const [path, count] of Object.entries(counts)) {
    const allowed = baseline[path] ?? 0;
    if (count > allowed) over.push({ path, count, allowed });
    else if (count < allowed) under.push({ path, count, allowed });
  }
  for (const [path, allowed] of Object.entries(baseline)) {
    if (!(path in counts)) under.push({ path, count: 0, allowed });
  }
  return { over, under };
}

export function tighten(baseline, counts) {
  const next = {};
  for (const [path, allowed] of Object.entries(baseline)) {
    const count = Math.min(allowed, counts[path] ?? 0);
    if (count > 0) next[path] = count;
  }
  return next;
}

export function moveAllowance(baseline, counts, from, to) {
  const freed = (baseline[from] ?? 0) - Math.min(baseline[from] ?? 0, counts[from] ?? 0);
  if (freed <= 0) throw new Error(`"${from}" heeft geen vrijgekomen ruimte om te verhuizen`);
  const wanted = (counts[to] ?? 0) - (baseline[to] ?? 0);
  if (wanted <= 0) throw new Error(`"${to}" heeft geen ruimte nodig`);
  if (wanted > freed) throw new Error(`"${to}" vraagt ${wanted} regels, "${from}" gaf er ${freed} vrij`);
  return tighten({ ...baseline, [to]: (baseline[to] ?? 0) + wanted }, counts);
}

const sum = record => Object.values(record).reduce((total, n) => total + n, 0);

export function readBaseline(path = BASELINE_PATH) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

export function writeBaseline(baseline, path = BASELINE_PATH) {
  const rows = Object.entries(baseline)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([file, count]) => `${JSON.stringify(file)}: ${count}`);
  writeFileSync(path, `{\n${rows.join(',\n')}\n}\n`);
}

function selectFiles(args) {
  const all = trackedCodeFiles();
  if (args.length === 0) return all;
  const wanted = args.map(arg => relative(ROOT, resolve(arg)).split(sep).join('/'));
  return all.filter(path => wanted.some(want => path === want || path.startsWith(want.replace(/\/?$/, '/'))));
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
    if (onlyLines && paths.length !== 1) {
      console.error('--only werkt op precies één bestand');
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
    const { counts, shedLines, blocks, totalLines, files } = countAll(ROOT, selectFiles(rest));
    console.log(JSON.stringify({
      bestanden: files, regels: totalLines, commentaarblokken: blocks, commentaarregels: sum(counts),
      regelsDieVerdwijnen: shedLines, aandeel: totalLines ? Number((shedLines / totalLines).toFixed(4)) : 0,
    }, null, 1));
    return 0;
  }

  const { counts } = countAll();
  const baseline = readBaseline();
  if (mode === '--init') {
    if (existsSync(BASELINE_PATH)) {
      console.error('XX  de baseline bestaat al; die gaat alleen omlaag (--update)');
      return 1;
    }
    writeBaseline(counts);
    console.log(`OK  baseline aangemaakt: ${sum(counts)} commentaarregels in ${Object.keys(counts).length} bestanden`);
    return 0;
  }
  if (mode === '--move') {
    const [from, to] = rest;
    writeBaseline(moveAllowance(baseline, counts, from, to));
    console.log(`OK  ruimte verhuisd van ${from} naar ${to}`);
    return 0;
  }
  if (mode === '--update') {
    const next = tighten(baseline, counts);
    writeBaseline(next);
    console.log(`OK  baseline aangescherpt: ${sum(baseline)} → ${sum(next)} commentaarregels`);
  } else if (mode !== undefined) {
    console.error(`onbekende optie: ${mode}`);
    return 2;
  }

  const { over, under } = compare(readBaseline(), counts);
  for (const { path, count, allowed } of over) {
    console.log(`XX  ${path}: ${count} commentaarregels, toegestaan ${allowed}`);
  }
  if (over.length > 0) {
    console.log(`\nXX  ${over.length} bestand(en) met nieuw commentaar. Commentaar in code is verboden (docs/adr/0001-geen-commentaar-in-code.md):`);
    console.log('    zeg het in de code (naam, type, test), leg een besluit vast in docs/adr/ en een noodgreep in knownbugs.md.');
    console.log('    Bestand verplaatst of gesplitst: node scripts/verify-comments.mjs --move <oud> <nieuw>');
    return 1;
  }
  if (under.length > 0) {
    console.log(`OK  geen nieuw commentaar; ${under.length} bestand(en) staan onder de baseline: draai \`npm run comments:ratchet\``);
  } else {
    console.log(`OK  geen nieuw commentaar (${sum(counts)} commentaarregels over, baseline gelijk)`);
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}
