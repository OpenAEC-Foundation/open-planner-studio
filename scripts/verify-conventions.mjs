#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));

export function verifyConventions(args) {
  const stdout = [];
  const stderr = [];
  const log = (line) => { stdout.push(`${line}\n`); };
  const logError = (line) => { stderr.push(`${line}\n`); };
  const done = (status) => ({ status, stdout: stdout.join(''), stderr: stderr.join('') });

  const rootFlag = args.indexOf('--root');
  if (rootFlag >= 0 && !args[rootFlag + 1]) {
    logError('Gebruik: node scripts/verify-conventions.mjs [--root <repositorypad>] [--write-baseline]');
    return done(2);
  }
  const root = resolve(rootFlag >= 0 ? args[rootFlag + 1] : resolve(here, '..'));
  const writeBaseline = args.includes('--write-baseline');
  const baselinePath = join(root, 'scripts', 'verify-conventions.datagates.json');
  const allowlistPath = join(root, 'scripts', 'verify-conventions.allowlist.json');

  const FORBIDDEN_NAMES = new Set([
    'p6Source', 'importFormat', 'readFormat', 'xerSourceProjectId', 'xerSourceArchive', 'xerImportMetadata',
  ]);
  const FORBIDDEN_SERVICE_DIRS = new Set(['xer', 'mpp', 'msproject', 'p6', 'csv']);
  const FORBIDDEN_SERVICE_FILES = new Set(['formatRegistry', 'xerSourceArchive']);
  const DATAGATES = [
    'p6ProjectId', 'p6TaskId', 'p6ActivityType', 'p6ExplicitTargetWindow', 'p6CompletePctType', 'p6DurationType',
    'p6SuspendResume', 'p6ExpectedFinish', 'manuallyScheduled', 'levelingDelayMinutes', 'levelingDelayElapsed',
    'timephasedStartAnchor', 'timephasedFinishFloor', 'timephasedDurationWalks', 'resume', 'mspTaskType',
    'p6StartAtPredecessorFinishBoundary',
  ];
  const OPTION_TYPE_NAMES = new Set([
    'SchedulingOptions', 'EffectiveSchedulingOptions', 'ProjectSchedulingOptions', 'SchedulingConventions',
    'LegacySchedulingOptions',
  ]);
  const OPTION_TYPE_WRAPPERS = new Set(['Pick', 'Partial', 'Required', 'Readonly', 'Omit']);
  const SOURCE_NAME = /^(?:p6|xer|mpp|msp|mpx)[A-Z]/;
  const ENGINE_HELPERS = ['src/utils/p6SuspendResume.ts'];

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
    if (FORBIDDEN_SERVICE_FILES.has(name)) return `src/services/${name}`;
    return null;
  }

  const violations = [];

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
        if (!path.startsWith('src/engine/') && !ENGINE_HELPERS.includes(path)) {
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
  const files = [
    ...sourceFiles(resolve(root, 'src', 'engine')),
    ...ENGINE_HELPERS.map((path) => join(root, path)).filter((path) => existsSync(path)),
  ];
  const parse = (file) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const CONVENTIONS_DIR = 'src/engine/scheduler/conventions/';
  const registryRel = 'src/engine/scheduler/conventions/registry.ts';
  const typesRel = 'src/types/project.ts';
  const keyRoot = existsSync(join(root, registryRel)) ? root : resolve(here, '..');
  const checkUnused = keyRoot === root;
  const conventionKeys = new Set();
  const optionMembers = new Set();
  {
    const registry = parse(join(keyRoot, registryRel));
    const walk = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'CONVENTIONS' && node.initializer) {
        const collect = (inner) => {
          if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'convention'
              && inner.arguments[0] && ts.isStringLiteralLike(inner.arguments[0])) conventionKeys.add(inner.arguments[0].text);
          ts.forEachChild(inner, collect);
        };
        collect(node.initializer);
      }
      ts.forEachChild(node, walk);
    };
    walk(registry);
    if (existsSync(join(keyRoot, typesRel))) {
      parse(join(keyRoot, typesRel)).forEachChild((node) => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === 'SchedulingOptions') {
          for (const member of node.members) if (member.name && ts.isIdentifier(member.name)) optionMembers.add(member.name.text);
        }
      });
    }
  }
  if (conventionKeys.size === 0) violations.push(`${registryRel} — geen enkele convention('…') in CONVENTIONS gevonden`);
  const projectOptionKeys = new Set([...optionMembers].filter((key) => !conventionKeys.has(key)));
  for (const key of conventionKeys) {
    if (optionMembers.size > 0 && !optionMembers.has(key)) {
      violations.push(`registerconventie '${key}' ontbreekt in interface SchedulingOptions (${typesRel})`);
    }
  }
  const OPTION_KEYS = new Set([...conventionKeys, ...projectOptionKeys]);
  const conventionReads = new Map([...conventionKeys].map((key) => [key, 0]));

  let fileOptionTypeNames = OPTION_TYPE_NAMES;
  function isOptionsType(typeNode) {
    if (!typeNode) return false;
    if (ts.isParenthesizedTypeNode(typeNode)) return isOptionsType(typeNode.type);
    if (ts.isImportTypeNode(typeNode)) {
      const q = typeNode.qualifier;
      const last = q && (ts.isIdentifier(q) ? q.text : ts.isQualifiedName(q) ? q.right.text : undefined);
      return last !== undefined && OPTION_TYPE_NAMES.has(last);
    }
    if (ts.isTypeReferenceNode(typeNode)) {
      const name = ts.isIdentifier(typeNode.typeName) ? typeNode.typeName.text
        : ts.isQualifiedName(typeNode.typeName) ? typeNode.typeName.right.text : undefined;
      if (name === undefined) return false;
      if (fileOptionTypeNames.has(name)) return true;
      if (OPTION_TYPE_WRAPPERS.has(name)) return isOptionsType(typeNode.typeArguments?.[0]);
      return false;
    }
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
      const rest = typeNode.types.filter((t) => !(t.kind === ts.SyntaxKind.UndefinedKeyword
        || (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)));
      return rest.length > 0 && (ts.isUnionTypeNode(typeNode) ? rest.every(isOptionsType) : rest.some(isOptionsType));
    }
    return false;
  }

  const parsed = new Map(files.map((file) => [file, parse(file)]));
  function ownMembersOf(sourceFile) {
    const classMembers = new Map();
    const objects = new Map();
    const memberNames = (members) => new Set(members.filter((m) => m.name && ts.isIdentifier(m.name)).map((m) => m.name.text));
    const walk = (node) => {
      if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) classMembers.set(node.name.text, memberNames(node.members));
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
    const thisMembers = new Set([...classMembers.values()].flatMap((set) => [...set]));
    const walk2 = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        let init = node.initializer;
        while (ts.isParenthesizedExpression(init) || ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
        if (ts.isObjectLiteralExpression(init)) objects.set(node.name.text, memberNames(init.properties));
        else if (ts.isNewExpression(init) && ts.isIdentifier(init.expression) && classMembers.has(init.expression.text)) {
          objects.set(node.name.text, classMembers.get(init.expression.text));
        }
      }
      ts.forEachChild(node, walk2);
    };
    walk2(sourceFile);
    const enclosingClassMembers = (node) => {
      for (let n = node; n; n = n.parent) {
        if ((ts.isClassDeclaration(n) || ts.isClassExpression(n))) return n.name ? classMembers.get(n.name.text) : memberNames(n.members);
      }
      return undefined;
    };
    return (receiver, name) => {
      let r = receiver;
      while (ts.isParenthesizedExpression(r) || ts.isNonNullExpression(r)) r = r.expression;
      if (r.kind === ts.SyntaxKind.ThisKeyword) return (enclosingClassMembers(r) ?? thisMembers).has(name) && thisMembers.has(name);
      if (ts.isIdentifier(r)) return objects.get(r.text)?.has(name) === true;
      return false;
    };
  }
  const SOLVER_ROOTS = ['src/engine/scheduler/solveProject.ts'];
  function resolveEngineImport(fromFile, specifier) {
    let base;
    if (specifier.startsWith('@/')) base = resolve(root, 'src', specifier.slice(2));
    else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
    else return undefined;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, join(base, 'index.ts')]) {
      if (parsed.has(candidate)) return candidate;
    }
    return undefined;
  }
  const solverReachable = new Set();
  {
    const queue = SOLVER_ROOTS.map((rel) => join(root, rel)).filter((file) => parsed.has(file));
    while (queue.length > 0) {
      const file = queue.pop();
      if (solverReachable.has(file)) continue;
      solverReachable.add(file);
      parsed.get(file).forEachChild((node) => {
        if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) || ts.isExportDeclaration(node)) {
          if (ts.isExportDeclaration(node) && node.isTypeOnly) return;
          const spec = node.moduleSpecifier;
          if (spec && ts.isStringLiteral(spec)) {
            const target = resolveEngineImport(file, spec.text);
            if (target && !solverReachable.has(target)) queue.push(target);
          }
        }
      });
    }
  }
  const knownSourceName = (name) => OPTION_KEYS.has(name) || DATAGATES.includes(name);
  const DESCRIPTOR_TEXT_FIELDS = new Set(['requires', 'theme']);

  const allowedHits = [];
  for (const file of files) {
    const sourceFile = parsed.get(file);
    const exempt = allowed.has(own(file));
    const isOwnMember = ownMembersOf(sourceFile);
    fileOptionTypeNames = new Set(OPTION_TYPE_NAMES);
    for (let grewType = true; grewType;) {
      grewType = false;
      const walkTypes = (node) => {
        if (ts.isImportSpecifier(node) && OPTION_TYPE_NAMES.has((node.propertyName ?? node.name).text)
            && !fileOptionTypeNames.has(node.name.text)) { fileOptionTypeNames.add(node.name.text); grewType = true; }
        if (ts.isTypeAliasDeclaration(node) && !fileOptionTypeNames.has(node.name.text) && isOptionsType(node.type)) {
          fileOptionTypeNames.add(node.name.text); grewType = true;
        }
        ts.forEachChild(node, walkTypes);
      };
      walkTypes(sourceFile);
    }
    const optionRules = !own(file).startsWith(CONVENTIONS_DIR);
    const aliases = new Set(['schedulingOptions']);
    const strip = (expr) => {
      let current = expr;
      while (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)) current = current.expression;
      return current;
    };
    const isOptionsExpr = (expr) => {
      const e = strip(expr);
      if (ts.isIdentifier(e)) return aliases.has(e.text);
      if (ts.isPropertyAccessExpression(e)) return aliases.has(e.name.text);
      if (ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) return isOptionsType(e.type) || isOptionsExpr(e.expression);
      if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken]
        .includes(e.operatorToken.kind)) return isOptionsExpr(e.left);
      return false;
    };
    for (let grew = true; grew;) {
      grew = false;
      const walk = (node) => {
        if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isPropertyDeclaration(node)
            || ts.isPropertySignature(node)) && node.name && ts.isIdentifier(node.name) && !aliases.has(node.name.text)
            && (isOptionsType(node.type) || (node.initializer && isOptionsExpr(node.initializer)))) {
          aliases.add(node.name.text);
          grew = true;
        }
        ts.forEachChild(node, walk);
      };
      walk(sourceFile);
    }
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
      const isDynamicLoad = ts.isCallExpression(node)
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === 'require'));
      if (isDynamicLoad) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) {
          const hit = forbiddenModule(file, arg.text);
          if (hit) report(node, `dynamische import uit ${hit} in de motor`);
        } else {
          report(node, 'dynamische import met een niet-letterlijke specifier in de motor (niet te controleren)');
        }
      }
      if (ts.isIdentifier(node) && FORBIDDEN_NAMES.has(node.text)) {
        reportName(node, `'${node.text}' in de motor (regel B: een per-profiel-verschil is een conventie in het register)`);
      }
      const literalKey = (name, how) => {
        if (FORBIDDEN_NAMES.has(name)) reportName(node, `'${name}' ${how} in de motor`);
        if (Object.hasOwn(counts, name)) counts[name]++;
      };
      const optionKey = (name, how) => {
        if (!optionRules) return;
        if (name === null) {
          report(node, `opties-object gelezen ${how} — niet te controleren; gebruik een letterlijke registersleutel`);
        } else if (!OPTION_KEYS.has(name)) {
          report(node, `'${name}' ${how} op een opties-object is geen registerconventie en geen projectoptie`
            + ' (regel B: een per-profiel-verschil is een conventie in het register)');
        } else if (conventionReads.has(name) && solverReachable.has(file)) {
          conventionReads.set(name, conventionReads.get(name) + 1);
        }
      };
      const sourceName = (name, how, receiver) => {
        if (SOURCE_NAME.test(name) && !FORBIDDEN_NAMES.has(name) && !knownSourceName(name)
            && !(receiver && isOwnMember(receiver, name))) {
          report(node, `herkomstveld '${name}' ${how} in de motor — geen conventie, projectoptie of gepinde datagate`
            + ' (maak er een conventie van, of zet hem na bespreking op de datagatelijst)');
        }
      };
      if (ts.isPropertyAccessExpression(node)) {
        if (isOptionsExpr(node.expression)) optionKey(node.name.text, 'als eigenschap');
        else sourceName(node.name.text, 'als eigenschap', node.expression);
      }
      if (ts.isElementAccessExpression(node)) {
        const arg = node.argumentExpression;
        const name = ts.isStringLiteralLike(arg) ? arg.text : null;
        if (isOptionsExpr(node.expression)) optionKey(name, name === null ? 'via een niet-letterlijke sleutel' : 'via string-index');
        else if (name !== null) sourceName(name, 'via string-index', node.expression);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
        const callee = `${node.expression.expression.text}.${node.expression.name.text}`;
        const first = node.arguments[0];
        if (['Reflect.get', 'Reflect.has', 'Reflect.getOwnPropertyDescriptor'].includes(callee) && first && isOptionsExpr(first)) {
          const key = node.arguments[1];
          optionKey(key && ts.isStringLiteralLike(key) ? key.text : null, `via ${callee}`);
        } else if (['Object.keys', 'Object.values', 'Object.entries', 'Object.getOwnPropertyNames'].includes(callee)
            && first && isOptionsExpr(first)) {
          optionKey(null, `via ${callee}`);
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword
          && ts.isStringLiteralLike(node.left) && isOptionsExpr(node.right)) {
        optionKey(node.left.text, "via 'in'");
      }
      if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) && !node.dotDotDotToken) {
        const holder = node.parent.parent;
        const fromOptions = (ts.isVariableDeclaration(holder) && holder.initializer && isOptionsExpr(holder.initializer))
          || ((ts.isVariableDeclaration(holder) || ts.isParameter(holder)) && isOptionsType(holder.type));
        const key = node.propertyName ?? node.name;
        const keyName = ts.isIdentifier(key) || ts.isStringLiteralLike(key) ? key.text : null;
        if (fromOptions) optionKey(keyName, keyName === null ? 'via berekende destructuring' : 'via destructuring');
        else if (keyName !== null) sourceName(keyName, 'via destructuring');
      }
      if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
        literalKey(node.argumentExpression.text, 'via string-index');
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword
          && ts.isStringLiteralLike(node.left)) {
        literalKey(node.left.text, "via 'in'");
      }
      if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        const key = node.propertyName ?? node.name;
        if (ts.isStringLiteralLike(key)) literalKey(key.text, 'via destructuring');
        else if (ts.isIdentifier(key) && Object.hasOwn(counts, key.text)) counts[key.text]++;
      }
      if (ts.isPropertyAccessExpression(node) && Object.hasOwn(counts, node.name.text)) counts[node.name.text]++;
      const textField = (name, how) => {
        if (solverReachable.has(file) && DESCRIPTOR_TEXT_FIELDS.has(name)) {
          report(node, `registerveld '${name}' ${how} in de solver — dat is uitleg voor de gebruiker, geen rekengedrag`
            + ' (wat een conventie nodig heeft, staat in haar eigen code)');
        }
      };
      if (ts.isPropertyAccessExpression(node)) textField(node.name.text, 'als eigenschap');
      if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
        textField(node.argumentExpression.text, 'via string-index');
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword
          && ts.isStringLiteralLike(node.left)) textField(node.left.text, "via 'in'");
      if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        const key = node.propertyName ?? node.name;
        if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) textField(key.text, 'via destructuring');
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  if (checkUnused) {
    const unread = [...conventionReads].filter(([, n]) => n === 0).map(([key]) => key);
    for (const key of unread) {
      violations.push(`registerconventie '${key}' wordt nergens in de solver (vanuit ${SOLVER_ROOTS.join(', ')} bereikbaar) `
        + 'op een opties-object gelezen (een profielknop zonder effect — haal hem uit het register of lees hem in de motor)');
    }
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
      logError('XX baseline NIET herschreven — er is iets rood:');
      for (const violation of violations) logError(`  - ${violation}`);
      return done(1);
    }
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, `${JSON.stringify(counts, null, 2)}\n`);
    log(`OK — datagate-telling gepind in ${own(baselinePath)}.`);
    if (allowNote) log(allowNote);
    return done(0);
  }

  if (violations.length === 0) {
    log(`OK — conventiegrens bewaakt in ${files.length} motorbestanden; ${conventionKeys.size} conventies + `
      + `${projectOptionKeys.size} projectopties als enige opties-sleutels${checkUnused ? ', elke conventie gelezen' : ''}; datagates: `
      + DATAGATES.map((gate) => `${gate}=${counts[gate]}`).join(', '));
    if (allowNote) log(allowNote);
    if (toRepin.length > 0) log(`  te herpinnen (omlaag): ${toRepin.join(', ')} — draai met --write-baseline`);
    return done(0);
  }
  logError(`XX ${violations.length} overtreding${violations.length === 1 ? '' : 'en'} van de conventiegrens:`);
  for (const violation of violations) logError(`  - ${violation}`);
  if (allowNote) logError(allowNote);
  return done(1);
}

const isCli = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const result = verifyConventions(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.status;
}
