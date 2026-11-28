#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  location, parse, pathsFor, repositoryRoot, slash, sourceFiles, ts, valueBindings,
} from './lib/ts-imports.mjs';

const root = repositoryRoot('verify-store-boundaries.mjs', resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const { ownPath, normalizedModule } = pathsFor(root);
const violations = [];

function appStoreModule(file, specifier) {
  return normalizedModule(file, specifier) === slash(resolve(root, 'src/state/appStore'));
}

function compatibilityModule(file, specifier) {
  const normalized = normalizedModule(file, specifier);
  return normalized === slash(resolve(root, 'src/state/batchTransaction'))
    || normalized === slash(resolve(root, 'src/state/mcpTransaction'));
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

function report(file, sourceFile, node, message) {
  violations.push(`${ownPath(file)}:${location(sourceFile, node)} — ${message}`);
}

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

const coreFiles = sourceFiles(resolve(root, 'src/core'));
for (const file of coreFiles) {
  const sourceFile = parse(file);
  for (const binding of importsOf(sourceFile, (specifier) => appStoreModule(file, specifier))) {
    report(file, sourceFile, binding.declaration,
      `waarde-import '${binding.imported}' uit appStore in de headless kern (gebruik appStoreFactory)`);
  }
}

const saveWorkerFiles = sourceFiles(resolve(root, 'src/services/ifc/saveWorker'));
for (const file of saveWorkerFiles) {
  const sourceFile = parse(file);
  for (const binding of importsOf(sourceFile, (specifier) => appStoreModule(file, specifier))) {
    report(file, sourceFile, binding.declaration,
      `waarde-import '${binding.imported}' uit appStore in de opslagworker (gebruik appStoreFactory)`);
  }
}

const stateRoot = slash(resolve(root, 'src/state'));
const ifcxCoreFiles = sourceFiles(resolve(root, 'src/services/ifc/ifcx'));
for (const file of ifcxCoreFiles) {
  const sourceFile = parse(file);
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    const target = normalizedModule(file, specifier.text);
    if (target === stateRoot || target.startsWith(`${stateRoot}/`)) {
      report(file, sourceFile, statement,
        `import '${specifier.text}' uit src/state in de IFCX-kern (de laadgrens staat in src/services/documentData.ts)`);
    }
  }
}

function runtimeSpecifiers(sourceFile) {
  const found = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (!clause || valueBindings(clause).length > 0) found.push({ node: statement, text: statement.moduleSpecifier.text });
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        && !statement.isTypeOnly) {
      const clause = statement.exportClause;
      const values = !clause || !ts.isNamedExports(clause) || clause.elements.some(element => !element.isTypeOnly);
      if (values) found.push({ node: statement, text: statement.moduleSpecifier.text });
    }
  }
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      found.push({ node, text: node.arguments[0].text });
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sourceFile, visit);
  return found;
}

function moduleFile(modulePath) {
  for (const candidate of [`${modulePath}.ts`, `${modulePath}.tsx`, `${modulePath}/index.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const storeModules = ['src/state/appStore', 'src/state/appStoreFactory'].map(path => slash(resolve(root, path)));
const storeFolders = ['src/state/slices', 'src/components', 'src/hooks'].map(path => slash(resolve(root, path)));
const isStoreOrUi = (modulePath) => storeModules.includes(modulePath)
  || storeFolders.some(folder => modulePath === folder || modulePath.startsWith(`${folder}/`));
const ifcxClosureEntries = ['src/services/ifc/ifcx/index.ts', 'src/services/documentData.ts']
  .map(path => resolve(root, path)).filter(file => existsSync(file));
const reached = new Map(ifcxClosureEntries.map(file => [file, null]));
const pending = [...ifcxClosureEntries];
while (pending.length > 0) {
  const file = pending.pop();
  const sourceFile = parse(file);
  for (const { node, text } of runtimeSpecifiers(sourceFile)) {
    const modulePath = normalizedModule(file, text);
    if (modulePath === text) continue;
    if (isStoreOrUi(modulePath)) {
      const chain = [];
      for (let at = file; at; at = reached.get(at)) chain.unshift(ownPath(at));
      report(file, sourceFile, node,
        `de IFCX-kern bereikt '${ownPath(modulePath)}' via ${chain.join(' → ')}`);
      continue;
    }
    const target = moduleFile(modulePath);
    if (target && !reached.has(target)) {
      reached.set(target, file);
      pending.push(target);
    }
  }
}

const headlessMcpFiles = [
  ...sourceFiles(resolve(root, 'headless/mcp-server/src')),
  ...['src/services/mcp/freshness.ts', 'src/services/mcp/requestHandler.ts', 'src/services/mcp/context.ts',
    'src/services/mcp/backupService.ts', 'src/state/blockingDialogs.ts']
    .map((file) => resolve(root, file))
    .filter((file) => existsSync(file)),
];
for (const file of headlessMcpFiles) {
  const sourceFile = parse(file);
  for (const binding of importsOf(sourceFile, (specifier) => appStoreModule(file, specifier))) {
    report(file, sourceFile, binding.declaration,
      `waarde-import '${binding.imported}' uit appStore in code van de headless MCP-server (gebruik appStoreFactory)`);
  }
}

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
  console.log(`OK — store-runtimegrenzen bewaakt in ${strictFiles.length} storegebonden modules, ${coreFiles.length} kernmodules, ${saveWorkerFiles.length} modules van de opslagworker, ${headlessMcpFiles.length} modules van de headless MCP-server en ${reached.size} modules die de IFCX-kern bij het draaien laadt.`);
  process.exit(0);
}

console.error(`XX ${violations.length} overtreding${violations.length === 1 ? '' : 'en'} van store-runtimegrenzen:`);
for (const violation of violations) console.error(`  - ${violation}`);
process.exit(1);
