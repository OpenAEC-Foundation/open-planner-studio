#!/usr/bin/env node
// Mechanische poort voor de rekenprofielen (spec docs/superpowers/specs/2026-09-22-rekenprofielen-design.md
// §4; plan 2026-09-22 taak D10): de rekenmotor (src/engine/**) stuurt uitsluitend op conventies, nooit
// op het bronformaat.
//  1. Verboden: elke identifier `p6Source`, `importFormat`, `readFormat` (ook als string-index), en
//     imports (statisch, re-export of dynamisch) uit src/services/{xer,mpp,msproject,p6,csv} of
//     src/services/formatRegistry.
//  2. Herkomst-datagates (bijlage A: p6ProjectId e.d.) zijn toegestaan maar geteld; de telling per veld
//     staat gepind in scripts/verify-conventions.datagates.json en mag alleen omlaag.
//  3. Tijdelijke allowlist (scripts/verify-conventions.allowlist.json, `{ pad: reden }`): een vermeld
//     bestand onder src/engine/ is vrijgesteld van regel 1-namen (NIET van de import-regel). Elke reden
//     moet `TIJDELIJK` bevatten en het bestand moet bestaan — een verouderde regel is rood, zodat de
//     lijst leeg raakt zodra de overgangscode weg is (baan C, taak C3: legacyP6Source.ts).
// AST-scan: commentaar en gewone strings geven geen vals alarm. `--root <pad>` voor de fixtures van
// tests/planning/check-conventions-boundary.ts; `--write-baseline` herpint, alleen als er niets rood is.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
if (rootFlag >= 0 && !args[rootFlag + 1]) {
  console.error('Gebruik: node scripts/verify-conventions.mjs [--root <repositorypad>] [--write-baseline]');
  process.exit(2);
}
const root = resolve(rootFlag >= 0 ? args[rootFlag + 1] : resolve(here, '..'));
const writeBaseline = args.includes('--write-baseline');
const baselinePath = join(root, 'scripts', 'verify-conventions.datagates.json');
const allowlistPath = join(root, 'scripts', 'verify-conventions.allowlist.json');

const FORBIDDEN_NAMES = new Set(['p6Source', 'importFormat', 'readFormat']);
const FORBIDDEN_SERVICE_DIRS = new Set(['xer', 'mpp', 'msproject', 'p6', 'csv']);
const DATAGATES = [
  'p6ProjectId', 'p6TaskId', 'p6ActivityType', 'p6ExplicitTargetWindow', 'p6CompletePctType', 'p6DurationType',
  'p6SuspendResume', 'p6ExpectedFinish', 'manuallyScheduled', 'levelingDelayMinutes', 'timephasedStartAnchor',
  'timephasedFinishFloor', 'timephasedDurationWalks', 'resume', 'mspTaskType',
];

const slash = (value) => value.split(sep).join('/');
const own = (file) => slash(relative(root, file));
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  const found = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (/\.(?:ts|tsx|mts)$/.test(entry.name)) found.push(target);
    }
  }
  return found.sort();
}

function forbiddenModule(file, specifier) {
  let target;
  if (specifier.startsWith('@/')) target = resolve(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) target = resolve(dirname(file), specifier);
  else return null;
  const rel = slash(relative(resolve(root, 'src', 'services'), target));
  if (rel.startsWith('..')) return null;
  const [first, ...rest] = rel.split('/');
  const name = first.replace(/\.(?:ts|tsx|mts|js|mjs)$/, '');
  if (FORBIDDEN_SERVICE_DIRS.has(name) && rest.length > 0) return `src/services/${name}`;
  if (name === 'formatRegistry') return 'src/services/formatRegistry';
  return null;
}

const violations = [];

// De tijdelijke allowlist. Afwezig ⇒ leeg (de eindtoestand).
const allowed = new Map();
if (existsSync(allowlistPath)) {
  let parsed = null;
  try {
    parsed = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  } catch {
    violations.push(`${own(allowlistPath)} — geen geldige JSON`);
  }
  if (parsed !== null && !isRecord(parsed)) violations.push(`${own(allowlistPath)} — moet een object { pad: reden } zijn`);
  if (isRecord(parsed)) {
    for (const [path, reason] of Object.entries(parsed)) {
      if (!path.startsWith('src/engine/')) {
        violations.push(`allowlist-regel '${path}' ligt buiten src/engine/ — daar geldt deze poort niet`);
      } else if (typeof reason !== 'string' || !reason.includes('TIJDELIJK')) {
        violations.push(`allowlist-regel '${path}' mist een reden met de markering TIJDELIJK`);
      } else if (!existsSync(join(root, path))) {
        violations.push(`allowlist-regel '${path}' — het bestand bestaat niet meer; haal de regel weg`);
      } else {
        allowed.set(path, reason);
      }
    }
  }
}

const counts = Object.fromEntries(DATAGATES.map((gate) => [gate, 0]));
const files = sourceFiles(resolve(root, 'src', 'engine'));
const allowedHits = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const exempt = allowed.has(own(file));
  const report = (node, message) => violations.push(
    `${own(file)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1} — ${message}`);
  const reportName = (node, message) => {
    if (exempt) allowedHits.push(own(file));
    else report(node, message);
  };
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const hit = forbiddenModule(file, node.moduleSpecifier.text);
      if (hit) report(node, `import uit ${hit} (lezer/formaat) in de motor`);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      const hit = forbiddenModule(file, node.arguments[0].text);
      if (hit) report(node, `dynamische import uit ${hit} in de motor`);
    }
    if (ts.isIdentifier(node) && FORBIDDEN_NAMES.has(node.text)) {
      reportName(node, `'${node.text}' in de motor (regel B: een per-profiel-verschil is een conventie in het register)`);
    }
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      const name = node.argumentExpression.text;
      if (FORBIDDEN_NAMES.has(name)) reportName(node, `'${name}' via string-index in de motor`);
      if (Object.hasOwn(counts, name)) counts[name]++;
    }
    if (ts.isPropertyAccessExpression(node) && Object.hasOwn(counts, node.name.text)) counts[node.name.text]++;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

let baseline = null;
if (existsSync(baselinePath)) {
  try {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    violations.push(`${own(baselinePath)} — geen geldige JSON`);
  }
} else if (!writeBaseline) {
  violations.push(`${own(baselinePath)} ontbreekt — meet eenmalig met --write-baseline`);
}
const toRepin = [];
if (isRecord(baseline)) {
  for (const gate of DATAGATES) {
    const pinned = Number.isInteger(baseline[gate]) ? baseline[gate] : 0;
    if (counts[gate] > pinned) {
      violations.push(`datagate '${gate}': ${counts[gate]} lezingen in src/engine, gepind ${pinned} — een nieuwe `
        + 'herkomstlezing in de motor (maak er een conventie van, of meet en bespreek eerst)');
    } else if (counts[gate] < pinned) {
      toRepin.push(`${gate} ${pinned}→${counts[gate]}`);
    }
  }
} else if (baseline !== null) {
  violations.push(`${own(baselinePath)} — moet een object { datagate: telling } zijn`);
}

const allowNote = allowed.size > 0
  ? `  tijdelijke allowlist (${allowed.size}): ${[...allowed.keys()].join(', ')}`
    + `${allowedHits.length > 0 ? ` — ${allowedHits.length} vrijgestelde naamtreffer(s)` : ''}`
  : '';

if (writeBaseline) {
  if (violations.length > 0) {
    console.error('XX baseline NIET herschreven — er is iets rood:');
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`OK — datagate-telling gepind in ${own(baselinePath)}.`);
  if (allowNote) console.log(allowNote);
  process.exit(0);
}

if (violations.length === 0) {
  console.log(`OK — conventiegrens bewaakt in ${files.length} motorbestanden; datagates: `
    + DATAGATES.map((gate) => `${gate}=${counts[gate]}`).join(', '));
  if (allowNote) console.log(allowNote);
  if (toRepin.length > 0) console.log(`  te herpinnen (omlaag): ${toRepin.join(', ')} — draai met --write-baseline`);
  process.exit(0);
}
console.error(`XX ${violations.length} overtreding${violations.length === 1 ? '' : 'en'} van de conventiegrens:`);
for (const violation of violations) console.error(`  - ${violation}`);
if (allowNote) console.error(allowNote);
process.exit(1);
