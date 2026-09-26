#!/usr/bin/env node
// Poort: geen cast op een vertaalsleutel. De typecheck controleert elke sleutel die aan t(...)
// wordt gegeven tegen de nl-bronbestanden (src/i18n/types.d.ts) — ook een samengestelde sleutel,
// zolang het variabele deel een vaste set waarden heeft. Een `as 'x.y'` zet die controle stil uit:
// een ontbrekende vertaling valt dan pas op als de gebruiker Engels of de kale sleutel ziet.
//
// Geweigerd: t / tMenu / tCommon / tTask / … / i18n.t met een eerste argument `… as <type>` of
// `<type>…`. Toegestaan: `as const` (die maakt de sleutel juist preciezer en controleerbaar).
// Oplossing: geef de bron het sleuteltype — `ParseKeys<'common'>` uit i18next, of
// `{ … } as const satisfies Record<K, ParseKeys<'common'>>` — zie docs/recepten/i18n-sleutel.md.
//
// De TypeScript-AST voorkomt dat woorden in commentaar of strings meetellen. `--root` laat de
// planningstest tijdelijke bronfixtures controleren zonder productiecode te wijzigen.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const rootFlag = process.argv.indexOf('--root');
if (rootFlag >= 0 && !process.argv[rootFlag + 1]) {
  console.error('Gebruik: node scripts/verify-i18n-keys.mjs [--root <repositorypad>]');
  process.exit(2);
}
const root = resolve(rootFlag >= 0 ? process.argv[rootFlag + 1] : resolve(here, '..'));

/** t, tMenu, tCommon, tTask, tReport, … — en `.t(` op een object (i18n.t, i18next.t). */
const TRANSLATE = /^t(?:[A-Z][A-Za-z]*)?$/;

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  const found = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (/\.(?:ts|tsx|mts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) found.push(target);
    }
  }
  return found.sort();
}

const violations = [];
let calls = 0;
for (const file of sourceFiles(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) ? callee.text
        : ts.isPropertyAccessExpression(callee) && callee.name.text === 't' ? 't' : '';
      if (TRANSLATE.test(name)) {
        calls++;
        let arg = node.arguments[0];
        while (ts.isParenthesizedExpression(arg)) arg = arg.expression;
        if (ts.isAsExpression(arg) || ts.isTypeAssertionExpression(arg)) {
          const type = arg.type.getText(sf);
          if (type !== 'const') {
            const { line } = sf.getLineAndCharacterOfPosition(arg.getStart(sf));
            violations.push(`${relative(root, file).split(sep).join('/')}:${line + 1}  ${callee.getText(sf)}(… as ${type})`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (violations.length > 0) {
  console.log(`XX  verify-i18n-keys: ${violations.length} vertaalsleutel(s) met een cast — de typecheck controleert die niet:`);
  for (const v of violations) console.log(`   - ${v}`);
  console.log("    Geef de bron het sleuteltype (ParseKeys<'common'> uit i18next, of `as const satisfies …`)");
  console.log('    en haal de cast weg; zie docs/recepten/i18n-sleutel.md. `as const` mag wel.');
  process.exit(1);
}
console.log(`OK  verify-i18n-keys: ${calls} aanroepen van t(…)/tX(…), geen cast op een sleutel`);
