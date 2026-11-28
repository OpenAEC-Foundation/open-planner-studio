import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type * as TS from 'typescript';
import { OWN_PSET_PROPERTY_NAMES, PER_TASK_PSETS, PER_TASK_PSET_BY_NAME, PROP, PSET } from '@/services/ifc/ifcPsets';

const ts = createRequire(import.meta.url)('typescript') as typeof TS;

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(`${label} (kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)})`, JSON.stringify(got) === JSON.stringify(want));
}

const REGISTER_NAMES: ReadonlySet<string> = new Set(Object.values(PROP).flatMap(names => Object.values(names) as string[]));

const VALUE_LITERALS: ReadonlySet<string> = new Set([
  '$', "'", '(', ')', ',', 'IFCBOOLEAN(.T.)',
  'COST', 'MATERIAL', 'OPS', 'PROGRESS_OVERRIDE', 'RETAINED_LOGIC', 'REJECTED', 'UNIFORM', 'VALID_EMPTY',
  'VALID_VALUES', 'XER', 'date', 'days', 'hours', 'ifc', 'mpp', 'mspdi', 'p6xml', 'primavera-p6-xer', 'xer',
  'P_SINGLEVALUE', 'P_ENUMERATEDVALUE', 'ASAP', 'START', 'FINISH', 'actual', 'remaining', 'leveling', 'user',
  'schema-version', 'truncated',
  '24hour', 'successor', 'projectDefault',
]);

const NAME_EXCEPTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'src/services/ifc/ifcReader.ts': { structure: 'foutcode van het XER-archief (XerArchiveIssueCode), geen propertynaam' },
};

const isValueLike = (text: string) => VALUE_LITERALS.has(text) || /^IFC[A-Z0-9_]*$/.test(text) || /^\.[A-Z0-9_]+\.$/.test(text);
const PROPERTY_TEMPLATE = /IFCPROPERTY(SINGLE|ENUMERATED)VALUE\(\s*'/;

interface Finding { rule: 'A' | 'B' | 'C' | 'D'; line: number; text: string }

function scanSource(file: string, source: string, reader: boolean): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const out: Finding[] = [];
  const lineOf = (node: TS.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const exceptions = NAME_EXCEPTIONS[file] ?? {};
  const isStringish = (n: TS.Node): n is TS.StringLiteral | TS.NoSubstitutionTemplateLiteral =>
    ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
  const isProps = (n: TS.Expression) => ts.isIdentifier(n) && n.text === 'props';
  const flagValue = (n: TS.Node) => {
    if (isStringish(n) && !isValueLike(n.text) && !REGISTER_NAMES.has(n.text)) out.push({ rule: 'B', line: lineOf(n), text: n.text });
  };
  const visit = (node: TS.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'propNames') return;
    if (isStringish(node) && REGISTER_NAMES.has(node.text) && !exceptions[node.text]
      && !ts.isLiteralTypeNode(node.parent) && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)) {
      out.push({ rule: 'A', line: lineOf(node), text: node.text });
    }
    if (reader) {
      if (ts.isBinaryExpression(node) && [
        ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(node.operatorToken.kind)) {
        if (!ts.isTypeOfExpression(node.right)) flagValue(node.left);
        if (!ts.isTypeOfExpression(node.left)) flagValue(node.right);
      }
      if (ts.isCaseClause(node)) flagValue(node.expression);
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const onProps = ts.isPropertyAccessExpression(callee) && isProps(callee.expression)
          && (callee.name.text === 'get' || callee.name.text === 'has');
        if (onProps || node.arguments.some(isProps)) node.arguments.forEach(flagValue);
      }
    }
    if ((isStringish(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node)) && PROPERTY_TEMPLATE.test(node.getText(sf))) {
      out.push({ rule: 'C', line: lineOf(node), text: node.getText(sf).slice(0, 60) });
    }
    if (ts.isTemplateExpression(node)) {
      const spans = [node.head, ...node.templateSpans.map(s => s.literal)];
      node.templateSpans.forEach((span, i) => {
        if (!/IFCPROPERTY(SINGLE|ENUMERATED)VALUE\(\s*$/.test(spans[i]!.text)) return;
        let e: TS.Expression = span.expression;
        if (ts.isCallExpression(e) && e.arguments.length === 1) e = e.arguments[0]!;
        if (isStringish(e)) out.push({ rule: 'C', line: lineOf(e), text: e.text });
      });
    }
    if (ts.isObjectLiteralExpression(node)) {
      const prop = (key: string) => node.properties.find((p): p is TS.PropertyAssignment =>
        ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key);
      const name = prop('name');
      if (name && prop('value') && isStringish(name.initializer)) out.push({ rule: 'D', line: lineOf(name), text: name.initializer.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const FILES: [string, boolean][] = [
  ['src/services/ifc/ifcReader.ts', true],
  ['src/services/ifc/ifcPsets.ts', true],
  ['src/services/ifc/ifcWriter.ts', false],
];
for (const [file, reader] of FILES) {
  const findings = scanSource(file, readFileSync(join(ROOT, file), 'utf8'), reader);
  eq(`${file}: propertynamen als tekst (regel A-D)`, findings.map(f => `${f.rule} :${f.line} ${f.text}`), []);
  for (const text of Object.keys(NAME_EXCEPTIONS[file] ?? {})) {
    ok(`${file}: uitzondering '${text}' staat nog in de bron`, readFileSync(join(ROOT, file), 'utf8').includes(`'${text}'`));
  }
}

const rules = (source: string, reader = true) => scanSource('mutatie.ts', source, reader).map(f => f.rule);
eq('mutatie A: registernaam als tekst', rules("const x = props.get('HoursPerDay');"), ['A']);
eq('mutatie A: registernaam in een array', rules("const x = ['ArchiveSha256'];", false), ['A']);
eq('mutatie B: nieuwe naam in een vergelijking', rules("if (name === 'NieuweProp') x = 1;"), ['B']);
eq('mutatie B: nieuwe naam als case', rules("switch (name) { case 'NieuweProp': break; }"), ['B']);
eq('mutatie B: nieuwe naam via props.get', rules("const v = props.get('NieuweProp');"), ['B']);
eq('mutatie B: nieuwe naam naast props', rules("const v = requiredString(props, 'NieuweProp');"), ['B']);
eq('mutatie B: stripQuotes(prop.args[0]) !== nieuwe naam', rules("if (stripQuotes(prop.args[0] || '') !== 'NieuweProp') continue;"), ['B']);
eq('mutatie B: een waarde is geen fout', rules("if (value === 'REJECTED' && typeof value === 'string') x = 1;"), []);
eq('mutatie B: alleen voor de lezer', rules("if (name === 'NieuweProp') x = 1;", false), []);
eq('mutatie C: naam in de tekst van de writer', rules("const l = `IFCPROPERTYSINGLEVALUE('NieuweProp',$,${v},$)`;", false), ['C']);
eq('mutatie C: naam in een gewone tekst', rules(`const l = "IFCPROPERTYSINGLEVALUE('NieuweProp',$,IFCBOOLEAN(.T.),$)";`, false), ['C']);
eq('mutatie C: ifcStr met een tekst', rules("const l = `IFCPROPERTYSINGLEVALUE(${ifcStr('NieuweProp')},$,${v},$)`;", false), ['C']);
eq('mutatie C: ifcStr met een constante is goed', rules("const l = `IFCPROPERTYSINGLEVALUE(${ifcStr(PROP.Calendar.HoursPerDay)},$,${v},$)`;", false), []);
eq('mutatie D: PropSpec met een tekst', rules("const p = { name: 'NieuweProp', value: 'IFCBOOLEAN(.T.)' };", false), ['D']);
eq('mutatie D: PropSpec met een constante is goed', rules("const p = { name: PROP.Hammock.IsHammock, value: 'IFCBOOLEAN(.T.)' };", false), []);
eq('mutatie: de definitie van het register telt niet', rules("const P = propNames('HoursPerDay', 'NieuweProp');"), []);
eq('mutatie: een type telt niet', rules("type T = 'HoursPerDay';"), []);

for (const [key, names] of Object.entries(PROP)) {
  const list = Object.values(names) as string[];
  eq(`register ${key}: geen dubbele naam`, list.length, new Set(list).size);
  ok(`register ${key}: een pset in PSET`, key in PSET);
}
eq('register: elke pset in PSET heeft namen in PROP', Object.keys(PSET).filter(k => !(k in PROP)), []);
for (const d of PER_TASK_PSETS) {
  const key = (Object.keys(PSET) as (keyof typeof PSET)[]).find(k => PSET[k] === d.name);
  ok(`descriptor ${d.name}: pset in PSET`, !!key);
  if (key) eq(`descriptor ${d.name}: readProps = PROP.${key}`, [...d.readProps], Object.values(PROP[key]));
}
eq('register: OWN_PSET_PROPERTY_NAMES dekt precies de psets zonder descriptor',
  Object.keys(OWN_PSET_PROPERTY_NAMES).sort(),
  Object.values(PSET).filter(name => !PER_TASK_PSET_BY_NAME.has(name)).sort());
for (const [pset, names] of Object.entries(OWN_PSET_PROPERTY_NAMES)) {
  const key = (Object.keys(PSET) as (keyof typeof PSET)[]).find(k => PSET[k] === pset)!;
  eq(`register ${pset}: OWN_PSET_PROPERTY_NAMES = PROP.${key}`, [...names], Object.values(PROP[key]));
}

if (diffs.length === 0) {
  console.log(`OK  ifc-pset-register: alle checks groen (${checks}; ${REGISTER_NAMES.size} namen in ${Object.keys(PROP).length} psets, `
    + `${FILES.length} bronnen zonder propertynaam als tekst)`);
  process.exit(0);
} else {
  console.log(`XX  ifc-pset-register: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 80)) console.log(`   - ${d}`);
  process.exit(1);
}
