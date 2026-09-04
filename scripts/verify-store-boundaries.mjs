#!/usr/bin/env node
// Mechanische poort voor de eigendomsgrens tussen app-composition en storegebonden runtimecode.
// De parser kijkt naar echte importdeclaraties en AST-aanroepen; woorden in commentaar of strings
// veroorzaken dus geen vals alarm. Met `--root <pad>` kan de planningstest geïsoleerde bronfixtures
// aanbieden zonder een productiefile tijdelijk te vergiftigen.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, '..');
const rootFlag = process.argv.indexOf('--root');
if (rootFlag >= 0 && !process.argv[rootFlag + 1]) {
  console.error('Gebruik: node scripts/verify-store-boundaries.mjs [--root <repositorypad>]');
  process.exit(2);
}
const root = resolve(rootFlag >= 0 ? process.argv[rootFlag + 1] : defaultRoot);
const violations = [];

const slash = (value) => value.split(sep).join('/');
const ownPath = (file) => slash(relative(root, file));

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

function parse(file) {
  const source = readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}

function importTarget(file, specifier) {
  if (specifier.startsWith('@/')) return resolve(root, 'src', specifier.slice(2));
  if (specifier.startsWith('.')) return resolve(dirname(file), specifier);
  return null;
}

function normalizedModule(file, specifier) {
  const target = importTarget(file, specifier);
  return target ? slash(target).replace(/\.(?:ts|tsx|mts|js|mjs)$/, '') : specifier;
}

function appStoreModule(file, specifier) {
  return normalizedModule(file, specifier) === slash(resolve(root, 'src/state/appStore'));
}

function compatibilityModule(file, specifier) {
  const normalized = normalizedModule(file, specifier);
  return normalized === slash(resolve(root, 'src/state/batchTransaction'))
    || normalized === slash(resolve(root, 'src/state/mcpTransaction'));
}

/** Runtimebindings uit één importclause; `import type` en `import { type X }` tellen niet mee. */
function valueBindings(clause) {
  if (!clause || clause.isTypeOnly) return [];
  const bindings = [];
  if (clause.name) bindings.push({ imported: 'default', local: clause.name.text });
  const named = clause.namedBindings;
  if (named && ts.isNamespaceImport(named)) {
    bindings.push({ imported: '*', local: named.name.text });
  } else if (named && ts.isNamedImports(named)) {
    for (const element of named.elements) {
      if (element.isTypeOnly) continue;
      bindings.push({
        imported: (element.propertyName ?? element.name).text,
        local: element.name.text,
      });
    }
  }
  return bindings;
}

function importsOf(sourceFile, predicate) {
  const found = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!predicate(specifier)) continue;
    for (const binding of valueBindings(statement.importClause)) {
      found.push({ ...binding, declaration: statement });
    }
  }
  return found;
}

function isWithin(node, ancestor) {
  for (let current = node.parent; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function functionName(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  if ((ts.isFunctionExpression(node) || ts.isArrowFunction(node))
      && node.parent && ts.isVariableDeclaration(node.parent)
      && ts.isIdentifier(node.parent.name)) return node.parent.name.text;
  return null;
}

function enclosingFunction(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current)) return current;
  }
  return null;
}

function identifierUses(sourceFile, local) {
  const uses = [];
  function visit(node) {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node) && node.text === local) uses.push(node);
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sourceFile, visit);
  return uses;
}

function location(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function report(file, sourceFile, node, message) {
  violations.push(`${ownPath(file)}:${location(sourceFile, node)} — ${message}`);
}

// In runtimefactories en tools zijn app-singletons én hun compatibiliteitsadapters categorisch
// verboden. Type-only imports uit appStore blijven toegestaan voor AppState/AppStoreContext.
const strictFiles = [
  ...sourceFiles(resolve(root, 'src/state/runtime')),
  ...sourceFiles(resolve(root, 'src/services/mcp/tools')),
];
for (const file of strictFiles) {
  const sourceFile = parse(file);
  for (const binding of importsOf(sourceFile, (specifier) => appStoreModule(file, specifier))) {
    if (binding.imported === 'useAppStore' || binding.imported === 'appStoreContext'
        || binding.imported === '*' || binding.imported === 'default') {
      report(file, sourceFile, binding.declaration,
        `verboden singletonimport '${binding.imported}' in storegebonden runtimecode`);
    }
  }
  for (const binding of importsOf(sourceFile, (specifier) => compatibilityModule(file, specifier))) {
    report(file, sourceFile, binding.declaration,
      `verboden import uit singletonadapter '${binding.imported}' in storegebonden runtimecode`);
  }
}

// staleGuard mag de appcontext uitsluitend als compatibiliteitsdefault aanbieden. De functiebody
// moet altijd de expliciete `app`-parameter volgen.
const staleFile = resolve(root, 'src/services/mcp/staleGuard.ts');
if (existsSync(staleFile)) {
  const sourceFile = parse(staleFile);
  for (const binding of importsOf(sourceFile, (specifier) => appStoreModule(staleFile, specifier))) {
    if (binding.imported === 'useAppStore') {
      report(staleFile, sourceFile, binding.declaration, "'useAppStore' is verboden in staleGuard");
      continue;
    }
    if (binding.imported !== 'appStoreContext') continue;
    for (const use of identifierUses(sourceFile, binding.local)) {
      const fn = enclosingFunction(use);
      const parameter = fn?.parameters.find((candidate) => isWithin(use, candidate));
      if (functionName(fn) !== 'ensureFreshSchedule' || !parameter) {
        report(staleFile, sourceFile, use,
          `'${binding.local}' mag alleen de defaultparameter van ensureFreshSchedule binden`);
      }
    }
  }
}

// backup.ts bevat bewust publieke appwrappers. Alleen de kleine `service()`-adapter mag de
// singleton rechtstreeks gebruiken; realDeps/createAppBackupService en alle backupkernlogica niet.
const backupFile = resolve(root, 'src/services/mcp/backup.ts');
if (existsSync(backupFile)) {
  const sourceFile = parse(backupFile);
  for (const binding of importsOf(sourceFile, (specifier) => appStoreModule(backupFile, specifier))) {
    if (binding.imported === 'useAppStore') {
      report(backupFile, sourceFile, binding.declaration, "'useAppStore' is verboden in backup.ts");
      continue;
    }
    if (binding.imported !== 'appStoreContext') continue;
    for (const use of identifierUses(sourceFile, binding.local)) {
      if (functionName(enclosingFunction(use)) !== 'service') {
        report(backupFile, sourceFile, use,
          `'${binding.local}' mag alleen in de dunne service()-appwrapper worden gebruikt`);
      }
    }
  }
}

// server.ts is de expliciete app-composition root. Ook daar beperken we singletongebruik tot de
// drie functies die de live app of de standaardrequestcontext samenstellen.
const serverFile = resolve(root, 'src/services/mcp/server.ts');
if (existsSync(serverFile)) {
  const sourceFile = parse(serverFile);
  const allowed = {
    useAppStore: new Set(['applyAiModeLive', 'buildLiveController']),
    appStoreContext: new Set(['buildMcpContext']),
  };
  for (const binding of importsOf(sourceFile, (specifier) => appStoreModule(serverFile, specifier))) {
    if (!(binding.imported in allowed)) continue;
    for (const use of identifierUses(sourceFile, binding.local)) {
      const fn = functionName(enclosingFunction(use));
      if (!allowed[binding.imported].has(fn)) {
        report(serverFile, sourceFile, use,
          `'${binding.local}' wordt buiten een toegestane app-compositionfunctie gebruikt`);
      }
    }
  }
}

// De twee publieke adapters mogen alleen bestaande factories binden en een kleine resultaatvorm
// converteren. Directe storetoegang of snapshots betekenen dat domeinlogica teruglekt.
for (const relativeAdapter of ['src/state/batchTransaction.ts', 'src/state/mcpTransaction.ts']) {
  const file = resolve(root, relativeAdapter);
  if (!existsSync(file)) continue;
  const sourceFile = parse(file);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression)
          && (expression.name.text === 'getState' || expression.name.text === 'setState')) {
        report(file, sourceFile, node, `adapter bevat verboden .${expression.name.text}(`);
      }
      if (ts.isIdentifier(expression) && expression.text === 'createSnapshot') {
        report(file, sourceFile, node, 'adapter bevat verboden createSnapshot(');
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sourceFile, visit);
}

if (violations.length === 0) {
  console.log(`OK — store-runtimegrenzen bewaakt in ${strictFiles.length} storegebonden modules.`);
  process.exit(0);
}

console.error(`XX ${violations.length} overtreding${violations.length === 1 ? '' : 'en'} van store-runtimegrenzen:`);
for (const violation of violations) console.error(`  - ${violation}`);
process.exit(1);
