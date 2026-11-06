// Alle plekken in `src/` die een instelling in `localStorage` schrijven of wissen, op de TypeScript-AST
// (#818). `tests/planning/check-site-host-preferences.ts` toetst de gevonden sleutels tegen
// `HOST_PERSISTED_KEYS`/`HOST_EXCLUDED_*` (`src/services/fileAccess/siteHostSettingKeys.ts`).
//
// Wat telt als schrijfplek (echte aanroepen, geen tekstzoektocht; spaties, commentaar en strings maken
// niet uit):
// - een aanroep van `writeLocal`, `removeLocal` of `setSetting` (die laatste schrijft `ops-<sleutel>`);
// - een aanroep van `setItem` of `removeItem` op elk object, ook als `x['setItem'](…)`, behalve op
//   `sessionStorage` (die overleeft geen herlaad en hoort niet bij de host); en `clear()` op een object
//   waarvan de naam op `storage` eindigt (`localStorage`, `storage`, …): `clear` is ook een methode van
//   elke `Map` en `Set`, en zonder typechecker is de naam het onderscheid;
// - elke andere verwijzing naar `setItem`/`removeItem`/`clear` of naar `writeLocal`/`removeLocal`/
//   `setSetting` die geen directe aanroep of import is (een alias, `.bind`, doorgeven als waarde):
//   die telt als schrijfplek met een onbekende sleutel.
//
// De sleutel is het eerste argument: een letterlijke tekst, of een `const` met een letterlijke tekst in
// hetzelfde bestand (ook via één geïmporteerde `export const`). Anders is de sleutel onbekend
// (`key: null`) en moet de plek in de toegestane lijst van de check staan, met bestand en functie.
import { existsSync } from 'node:fs';
import { parse, pathsFor, slash, sourceFiles, ts } from './ts-imports.mjs';
import { join, relative } from 'node:path';

const HELPERS = new Set(['writeLocal', 'removeLocal', 'setSetting']);
const STORAGE_METHODS = new Set(['setItem', 'removeItem', 'clear']);
const storageLike = (text) => /storage$/i.test(text) && text !== 'sessionStorage' && !/\bsessionStorage$/.test(text);
/** Telt deze methode op deze ontvanger als opslag? `clear` alleen op iets dat op `storage` eindigt. */
const countsAsStorage = (name, receiverText) =>
  !/(^|\.)sessionStorage$/.test(receiverText) && (name !== 'clear' || storageLike(receiverText));

/** De naam van de dichtstbijzijnde omsluitende functie of methode (`<module>` op het hoogste niveau). */
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

/** Letterlijke tekst van een `const NAME = '…'` in dit bestand, of via één import. */
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
  const target = imports.get(name);
  if (target && depth < 2) {
    for (const ext of ['.ts', '.tsx']) {
      if (existsSync(target + ext)) return constText(parse(target + ext), name, new Map(), depth + 1);
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

/** De methodenaam van `x.m` of `x['m']`, anders `null`. */
function memberName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return node.argumentExpression.text;
  return null;
}

/**
 * Alle schrijfplekken onder `<root>/src`.
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
      if (!ts.isImportDeclaration(statement) || !statement.importClause?.namedBindings) continue;
      const bindings = statement.importClause.namedBindings;
      if (!ts.isNamedImports(bindings)) continue;
      const target = normalizedModule(file, statement.moduleSpecifier.text);
      for (const el of bindings.elements) imports.set(el.name.text, target);
    }
    const add = (node, call, key) => sites.push({
      file: rel,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      func: enclosingName(node),
      call,
      key,
    });
    const visit = (node) => {
      // Directe aanroep van een helper.
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && HELPERS.has(node.expression.text)) {
        const raw = keyOf(node.arguments[0], sourceFile, imports);
        const key = raw === null ? null : node.expression.text === 'setSetting' ? `ops-${raw}` : raw;
        add(node, node.expression.text, key);
        node.arguments.forEach(visit);
        return;
      }
      // Directe aanroep van `setItem`/`removeItem`/`clear` op een object.
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
      // Elke andere verwijzing naar een opslagmethode: een alias of doorgegeven functie.
      const name = memberName(node);
      if (name && STORAGE_METHODS.has(name)) {
        if (countsAsStorage(name, node.expression.getText(sourceFile))) add(node, `alias ${node.getText(sourceFile)}`, null);
      }
      if (ts.isIdentifier(node) && HELPERS.has(node.text)) {
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

