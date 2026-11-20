import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, inScope, moveAllowance, scanComments, stripComments, tighten } from '../../scripts/verify-comments.mjs';

const scan = (text, path = 'src/x.ts') => scanComments(text, path);

test('tekst in een string, regex, template of JSX-tekst is geen commentaar', () => {
  const text = [
    "const a = 'http://x'; const b = /\\/\\//; const c = `// ${a} /* x */`;",
    'const d = <p>// geen commentaar</p>;',
  ].join('\n');
  assert.equal(scan(text, 'src/x.tsx').commentLines, 0);
});

test('aaneengesloten regelcommentaar is één blok, een staartcommentaar een eigen blok', () => {
  const { blocks, commentLines, shedLines } = scan('// a\n// b\nconst x = 1; // c\n\n/** d */\nconst y = 2;\n');
  assert.deepEqual(blocks.map(b => [b.line, b.endLine, b.kind]), [[1, 2, 'line'], [3, 3, 'line'], [5, 5, 'jsdoc']]);
  assert.equal(commentLines, 4);
  assert.equal(shedLines, 3);
});

test('een lege regel die door het weghalen dubbel wordt, telt mee als verdwenen regel', () => {
  assert.equal(scan('const a = 1;\n\n// weg\n\nconst b = 2;\n').shedLines, 2);
});

test('JSX-commentaar telt en krijgt de soort jsx', () => {
  const { blocks } = scan('const a = <div>{/* uitleg */}<b /></div>;', 'src/x.tsx');
  assert.deepEqual(blocks.map(b => b.kind), ['jsx']);
});

test('aanwijzingen voor gereedschap zijn geen commentaar', () => {
  const text = [
    '// @ts-check',
    '/// <reference types="vite/client" />',
    '// eslint-disable-next-line no-control-regex -- NUL is hier bedoeld',
    'const a = 1; // @ts-expect-error de reden',
    'const b = import(/* @vite-ignore */ a);',
    'const c = /* @__PURE__ */ f();',
    'const d = 12; // text-roles: volgt de schaal van de screenshot',
  ].join('\n');
  assert.equal(scan(text).commentLines, 0);
});

test('JSDoc met typetags telt alleen in JavaScript niet mee', () => {
  const text = '/** @param {string} a */\nexport function f(a) { return a; }\n';
  assert.equal(scan(text, 'scripts/x.mjs').commentLines, 0);
  assert.equal(scan(text, 'src/x.ts').commentLines, 1);
  assert.equal(scan('/** Uitleg zonder types. */\nexport const a = 1;\n', 'scripts/x.mjs').commentLines, 1);
});

test('bereik: code in src, tests en scripts wel; docs, voorbeelden en gegenereerde bestanden niet', () => {
  assert.equal(inScope('src/a/b.tsx'), true);
  assert.equal(inScope('scripts/x.mjs'), true);
  assert.equal(inScope('docs/superpowers/evidence/x.mjs'), false);
  assert.equal(inScope('examples/extensions/x/main.js'), false);
  assert.equal(inScope('src/components/icons/b2/icons.generated.ts'), false);
  assert.equal(inScope('src/styles/globals.css'), false);
});

test('compare: meer dan de baseline of een nieuw bestand met commentaar is rood, minder alleen een melding', () => {
  const { over, under } = compare({ 'a.ts': 3, 'b.ts': 2, 'weg.ts': 4 }, { 'a.ts': 4, 'b.ts': 1, 'nieuw.ts': 1 });
  assert.deepEqual(over.map(o => o.path), ['a.ts', 'nieuw.ts']);
  assert.deepEqual(under.map(u => u.path), ['b.ts', 'weg.ts']);
});

test('tighten gaat alleen omlaag en laat lege en verdwenen bestanden vallen', () => {
  assert.deepEqual(tighten({ 'a.ts': 3, 'b.ts': 2, 'c.ts': 5, 'weg.ts': 4 }, { 'a.ts': 9, 'b.ts': 1, 'nieuw.ts': 7 }), { 'a.ts': 3, 'b.ts': 1 });
});

test('moveAllowance verhuist alleen ruimte die bij de bron echt vrijkwam', () => {
  assert.deepEqual(moveAllowance({ 'oud.ts': 10 }, { 'nieuw.ts': 10 }, 'oud.ts', 'nieuw.ts'), { 'nieuw.ts': 10 });
  assert.deepEqual(moveAllowance({ 'oud.ts': 10 }, { 'oud.ts': 6, 'deel.ts': 3 }, 'oud.ts', 'deel.ts'), { 'oud.ts': 6, 'deel.ts': 3 });
  assert.throws(() => moveAllowance({ 'oud.ts': 10 }, { 'oud.ts': 6, 'deel.ts': 5 }, 'oud.ts', 'deel.ts'), /gaf er 4 vrij/);
  assert.throws(() => moveAllowance({ 'oud.ts': 10 }, { 'oud.ts': 10, 'deel.ts': 5 }, 'oud.ts', 'deel.ts'), /geen vrijgekomen ruimte/);
});

test('een licentie- of bronvermelding met licentie blijft staan', () => {
  assert.equal(scan('// Bron: MPXJ org.mpxj.WorkContour (LGPL-2.1, github.com/joniles/mpxj)\nconst a = 1;\n').commentLines, 0);
  assert.equal(scan('// SPDX-License-Identifier: LGPL-3.0-or-later\nconst a = 1;\n').commentLines, 0);
});

test('strip haalt eigen regels, staartcommentaar en de lege regel op de naad weg', () => {
  const text = [
    '// kop', '', 'function f() {', '  // uitleg', '', '  const a = 1; // staart', '  const b = /* midden */ 2;', '',
    '  // slot', '}', '', '/** doc */', 'const c = 3; // @ts-expect-error blijft', '',
  ].join('\n');
  const result = stripComments(text, 'src/x.ts');
  assert.equal(result.text, ['function f() {', '  const a = 1;', '  const b = 2;', '}', '', 'const c = 3; // @ts-expect-error blijft', ''].join('\n'));
  assert.equal(result.removed, 6);
  assert.equal(scan(result.text).commentLines, 0);
});

test('strip met --only raakt alleen de genoemde blokken', () => {
  const result = stripComments('// a\nconst x = 1;\n// b\nconst y = 2;\n', 'src/x.ts', new Set([3]));
  assert.equal(result.text, '// a\nconst x = 1;\nconst y = 2;\n');
});

test('strip haalt JSX-commentaar op eigen regels weg en laat JSX-commentaar tussen tekst voor de hand', () => {
  const own = stripComments('const a = (\n  <div>\n    {/* uitleg\n        verder */}\n    <b />\n  </div>\n);\n', 'src/x.tsx');
  assert.equal(own.text, 'const a = (\n  <div>\n    <b />\n  </div>\n);\n');
  const inline = stripComments('const a = <div>a {/* b */} c</div>;\n', 'src/x.tsx');
  assert.deepEqual(inline.manual, [1]);
  assert.equal(inline.text, 'const a = <div>a {/* b */} c</div>;\n');
});

test('de voorspelde regelwinst is wat strip echt weghaalt', () => {
  const text = 'const a = 1;\n\n// weg\n\nfunction f() {\n  /** doc */\n\n  return 1; // staart\n}\n';
  assert.equal(stripComments(text, 'src/x.ts').shedLines, scan(text).shedLines);
  assert.equal(text.split('\n').length - stripComments(text, 'src/x.ts').text.split('\n').length, scan(text).shedLines);
});
