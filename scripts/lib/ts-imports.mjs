import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

export { ts };

export function repositoryRoot(scriptName, defaultRoot) {
  const flag = process.argv.indexOf('--root');
  if (flag >= 0 && !process.argv[flag + 1]) {
    console.error(`Gebruik: node scripts/${scriptName} [--root <repositorypad>]`);
    process.exit(2);
  }
  return resolve(flag >= 0 ? process.argv[flag + 1] : defaultRoot);
}

export const slash = (value) => value.split(sep).join('/');
export const withoutExtension = (value) => slash(value).replace(/\.(?:ts|tsx|mts|js|mjs)$/, '');

export function sourceFiles(directory) {
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

export function parse(file) {
  const source = readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}

export function pathsFor(root) {
  const ownPath = (file) => slash(relative(root, file));
  function normalizedModule(file, specifier) {
    let target = null;
    if (specifier.startsWith('@/')) target = resolve(root, 'src', specifier.slice(2));
    else if (specifier.startsWith('.')) target = resolve(dirname(file), specifier);
    return target ? withoutExtension(target) : specifier;
  }
  return { ownPath, normalizedModule };
}

export function valueBindings(clause) {
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

export function location(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}
