import { existsSync } from 'node:fs';
import { parse, pathsFor, slash, sourceFiles, ts, valueBindings } from './ts-imports.mjs';
import { join, relative } from 'node:path';

const HELPERS = new Set(['writeLocal', 'removeLocal', 'setSetting']);
const STORAGE_METHODS = new Set(['setItem', 'removeItem', 'clear']);
const storageLike = (text) => /storage$/i.test(text) && text !== 'sessionStorage' && !/\bsessionStorage$/.test(text);
const countsAsStorage = (name, receiverText) =>
  !/(^|\.)sessionStorage$/.test(receiverText) && (name !== 'clear' || storageLike(receiverText));

function enclosingName(node) {
  for (let n = node.parent; n; n = n.parent) {
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isFunctionExpression(n)) && n.name) return n.name.getText();
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.parent) {
      const p = n.parent;
      if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
      if (ts.isPropertyAssignment(p)) return p.name.getText();
    }
  }
  return '<module>';
}

function constText(sourceFile, name, imports, depth = 0) {
  let found = null;
  const visit = (node) => {
    if (found !== null) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) found = init.text;
      else if (ts.isIdentifier(init) && depth < 2) found = constText(sourceFile, init.text, imports, depth + 1);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (found !== null) return found;
  const binding = imports.get(name);
  if (binding && binding.imported !== '*' && binding.imported !== 'default' && depth < 2) {
    for (const ext of ['.ts', '.tsx']) {
      if (existsSync(binding.target + ext)) return constText(parse(binding.target + ext), binding.imported, new Map(), depth + 1);
    }
  }
  return null;
}

function keyOf(arg, sourceFile, imports) {
  if (!arg) return null;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  if (ts.isIdentifier(arg)) return constText(sourceFile, arg.text, imports);
  return null;
}

function memberName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return node.argumentExpression.text;
  return null;
}

/**
 * @returns {{ file: string, line: number, func: string, call: string, key: string | null }[]}
 */
export function findSettingWrites(root) {
  const { normalizedModule } = pathsFor(root);
  const sites = [];
  for (const file of sourceFiles(join(root, 'src'))) {
    const sourceFile = parse(file);
    const rel = slash(relative(root, file));
    const imports = new Map();
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const target = normalizedModule(file, statement.moduleSpecifier.text);
      for (const { imported, local } of valueBindings(statement.importClause)) imports.set(local, { target, imported });
    }
    const helperOf = (local) => {
      const binding = imports.get(local);
      if (binding) return HELPERS.has(binding.imported) ? binding.imported : null;
      return HELPERS.has(local) ? local : null;
    };
    const isNamespace = (node) => ts.isIdentifier(node) && imports.get(node.text)?.imported === '*';
    const namespaceHelper = (node) => {
      const name = memberName(node);
      return name && HELPERS.has(name) && isNamespace(node.expression) ? name : null;
    };
    const add = (node, call, key) => sites.push({
      file: rel,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      func: enclosingName(node),
      call,
      key,
    });
    const visit = (node) => {
      const helper = ts.isCallExpression(node)
        ? (ts.isIdentifier(node.expression) ? helperOf(node.expression.text) : namespaceHelper(node.expression))
        : null;
      if (helper) {
        const raw = keyOf(node.arguments[0], sourceFile, imports);
        const key = raw === null ? null : helper === 'setSetting' ? `ops-${raw}` : raw;
        add(node, helper, key);
        node.arguments.forEach(visit);
        return;
      }
      if (ts.isCallExpression(node)) {
        const name = memberName(node.expression);
        if (name && STORAGE_METHODS.has(name)) {
          const receiver = node.expression.expression;
          if (countsAsStorage(name, receiver.getText(sourceFile))) {
            add(node, `${receiver.getText(sourceFile)}.${name}`, name === 'clear' ? null : keyOf(node.arguments[0], sourceFile, imports));
          }
          node.arguments.forEach(visit);
          ts.forEachChild(receiver, visit);
          return;
        }
      }
      const name = memberName(node);
      if (name && STORAGE_METHODS.has(name)) {
        if (countsAsStorage(name, node.expression.getText(sourceFile))) add(node, `alias ${node.getText(sourceFile)}`, null);
      }
      if (namespaceHelper(node)) {
        add(node, `alias ${node.getText(sourceFile)}`, null);
        return;
      }
      if (ts.isIdentifier(node) && helperOf(node.text)) {
        const p = node.parent;
        const declaration = (ts.isFunctionDeclaration(p) && p.name === node)
          || ts.isImportSpecifier(p) || ts.isExportSpecifier(p)
          || (ts.isPropertyAccessExpression(p) && p.name === node);
        if (!declaration) add(node, `alias ${node.text}`, null);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return sites;
}

