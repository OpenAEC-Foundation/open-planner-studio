#!/usr/bin/env node
// Mechanische poort voor de rekenprofielen (spec docs/superpowers/specs/2026-09-22-rekenprofielen-design.md
// §4; plan 2026-09-22 taak D10): de rekenmotor (src/engine/**) stuurt uitsluitend op conventies, nooit
// op het bronformaat.
//  1. Verboden: elke identifier `p6Source`, `importFormat`, `readFormat` en de XER-bronsignalen
//     `xerSourceProjectId`/`xerSourceArchive`/`xerImportMetadata` (ook als string-index, als `'…' in x`
//     en in destructuring); imports (statisch, re-export, dynamisch of `require`) uit
//     src/services/{xer,mpp,msproject,p6,csv}, src/services/formatRegistry of src/services/xerSourceArchive;
//     en elke dynamische import/require met een NIET-letterlijke specifier (onscanbaar ⇒ rood).
//  2. Herkomst-datagates (bijlage A: p6ProjectId e.d.) zijn toegestaan maar geteld — als property-,
//     string-index-, destructuring- en `in`-lezing; de telling per veld staat gepind in
//     scripts/verify-conventions.datagates.json en mag alleen omlaag.
//  Gescand: src/engine/** plus de motorhelpers buiten die map (`ENGINE_HELPERS`, nu
//  src/utils/p6SuspendResume.ts: de solver roept hem aan; verhuizen zou acht importeurs raken, waarvan
//  vier in de bestandskaart van baan C — bij de integratie opnieuw bekijken).
//  4. De opties-sleutelgrens (Fable-critreview PR #169, bevinding 4): de sleutels komen uit het register
//     (`convention('…')` in CONVENTIONS, src/engine/scheduler/conventions/registry.ts) plus de projectopties
//     (de overige leden van `interface SchedulingOptions` in src/types/project.ts). Elke lezing op een
//     opties-object — `schedulingOptions`, een variabele/parameter/klasseveld die daaruit komt of het type
//     SchedulingOptions/EffectiveSchedulingOptions/… draagt, ook via een hernoemde import (`as SO`), een
//     lokale type-alias of `import('…').SchedulingOptions` — moet een van die sleutels zijn: een onbekende
//     sleutel, een niet-letterlijke sleutel (`so[k]`), een berekende destructuring, `Reflect.get/has` met
//     een onbekende of niet-letterlijke sleutel en `Object.keys/values/entries/getOwnPropertyNames` op
//     een opties-object zijn rood. De map src/engine/scheduler/conventions/ zelf (het register, dat
//     generiek over de sleutels loopt) is vrij.
//  5. Elke conventie uit het register wordt gelezen in een bestand dat vanuit de solver bereikbaar is
//     (importgraaf vanaf solveProject.ts, `import type` telt niet); een registerconventie zonder zo'n
//     lezing is rood (een knop die niets doet). Alleen als het register onder --root bestaat; fixtures
//     zonder register lenen de sleutels van deze repository en slaan dit over.
//  6. Herkomstnamen (`p6…`/`xer…`/`mpp…`/`msp…`/`mpx…` + hoofdletter) als property-lezing in de motor
//     moeten een registersleutel, projectoptie of datagate zijn — of een EIGEN lid in hetzelfde bestand:
//     een klasselid gelezen op `this`, of een eigenschap van een in dat bestand gedeclareerd object-literal
//     of `new EigenKlasse()`, gelezen op die variabele. Zo is een nieuw bronveld (bv.
//     `calendar.p6NonWorkPenaltyDates`) geen gratis formaat-if meer.
//  Wat deze syntactische poort NIET ziet (bewust, geen typechecker): een opties-object dat via een helper
//  in een ANDER bestand wordt doorgegeven onder een naam die daar geen opties-naam of -type draagt; een
//  waarde die al als `any`/onbekend type binnenkomt en daarna gelezen wordt; aliassen worden per bestand
//  op naam bijgehouden. Voor getypte code vangt `tsc` een onbekende sleutel op een opties-type al.
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
/** Typen waarvan een waarde een opties-object is (regel 4). */
const OPTION_TYPE_NAMES = new Set([
  'SchedulingOptions', 'EffectiveSchedulingOptions', 'ProjectSchedulingOptions', 'SchedulingConventions',
  'LegacySchedulingOptions',
]);
const OPTION_TYPE_WRAPPERS = new Set(['Pick', 'Partial', 'Required', 'Readonly', 'Omit']);
/** Herkomstnaam-patroon (regel 6). */
const SOURCE_NAME = /^(?:p6|xer|mpp|msp|mpx)[A-Z]/;
const CONVENTIONS_DIR = 'src/engine/scheduler/conventions/';
/** Motorcode buiten src/engine/ die de solver direct aanroept; wordt meegescand als hij bestaat. */
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

// ── Regel 4/5: de sleutels uit het register en uit `interface SchedulingOptions` ──────────────────
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

/** De opties-typenamen van het bestand dat nu gescand wordt: de letterlijke namen plus hernoemde
 *  imports (`SchedulingOptions as SO`) en lokale type-aliassen daarvan; per bestand gezet. */
let fileOptionTypeNames = OPTION_TYPE_NAMES;
/** Is dit type(knoop) een opties-type (eventueel `| undefined`, of via Pick/Partial/…)? */
function isOptionsType(typeNode) {
  if (!typeNode) return false;
  if (ts.isParenthesizedTypeNode(typeNode)) return isOptionsType(typeNode.type);
  // `import('…').SchedulingOptions`
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

// ── Regel 6: herkomstnamen die de motor zelf declareert — alleen per bestand, alleen op `this` of op
// een in hetzelfde bestand gedeclareerd object-literal / `new EigenKlasse()` (critreview 2e ronde: een
// losse variabele of functie met dezelfde naam ergens in de motor stelt de naam NIET vrij).
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
  return (receiver, name) => {
    let r = receiver;
    while (ts.isParenthesizedExpression(r) || ts.isNonNullExpression(r)) r = r.expression;
    if (r.kind === ts.SyntaxKind.ThisKeyword) return thisMembers.has(name);
    if (ts.isIdentifier(r)) return objects.get(r.text)?.has(name) === true;
    return false;
  };
}
// ── Regel 5: alleen lezingen in bestanden die vanuit de solver bereikbaar zijn tellen (importgraaf over
// de gescande motorbestanden, vanaf solveProject.ts; `import type` telt niet mee).
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

const allowedHits = [];
for (const file of files) {
  const sourceFile = parsed.get(file);
  const exempt = allowed.has(own(file));
  const isOwnMember = ownMembersOf(sourceFile);
  // Opties-typenamen van dit bestand: hernoemde imports en lokale type-aliassen erbij.
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
  // Pre-pass: welke namen (variabelen, parameters, klassevelden) dragen in dit bestand een opties-object?
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
    // Een lezing via een letterlijke sleutel: x['naam'], 'naam' in x, of { 'naam': y } = x.
    const literalKey = (name, how) => {
      if (FORBIDDEN_NAMES.has(name)) reportName(node, `'${name}' ${how} in de motor`);
      if (Object.hasOwn(counts, name)) counts[name]++;
    };
    // Regel 4: een sleutel op een opties-object.
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
    // Regel 6: een herkomstnaam die de motor niet zelf declareert en die nergens gepind is.
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
    // Generieke lezingen die de sleutel verbergen: Reflect.get/has en Object.keys/values/entries/assign-bron.
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
  console.log(`OK — conventiegrens bewaakt in ${files.length} motorbestanden; ${conventionKeys.size} conventies + `
    + `${projectOptionKeys.size} projectopties als enige opties-sleutels${checkUnused ? ', elke conventie gelezen' : ''}; datagates: `
    + DATAGATES.map((gate) => `${gate}=${counts[gate]}`).join(', '));
  if (allowNote) console.log(allowNote);
  if (toRepin.length > 0) console.log(`  te herpinnen (omlaag): ${toRepin.join(', ')} — draai met --write-baseline`);
  process.exit(0);
}
console.error(`XX ${violations.length} overtreding${violations.length === 1 ? '' : 'en'} van de conventiegrens:`);
for (const violation of violations) console.error(`  - ${violation}`);
if (allowNote) console.error(allowNote);
process.exit(1);
