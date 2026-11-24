import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addedCommentLines, commentLineEntries, inScope, scanComments, stripComments } from '../../scripts/verify-comments.mjs';

const scan = (text, path = 'src/x.ts') => scanComments(text, path);
const lines = (text, path = 'src/x.ts') => commentLineEntries(text, path);

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

test('JSX-commentaar telt en krijgt de soort jsx', () => {
  const { blocks } = scan('const a = <div>{/* uitleg */}<b /></div>;', 'src/x.tsx');
  assert.deepEqual(blocks.map(b => b.kind), ['jsx']);
});

test('aanwijzingen die de compiler, ESLint of de bundler herkent, zijn geen commentaar', () => {
  const text = [
    '// @ts-check',
    '/// <reference types="vite/client" />',
    '// eslint-disable-next-line no-control-regex -- NUL is hier bedoeld',
    '/* eslint-disable-next-line no-control-regex */',
    'const a = 1;',
    '// @ts-expect-error de reden',
    'const b: number = "x";',
    '/* @ts-ignore */',
    'const c: number = "y";',
    'const d = import(/* @vite-ignore */ a);',
    'const e = /* @__PURE__ */ f();',
    'const g = 12; // text-roles: volgt de schaal van de screenshot',
  ].join('\n');
  assert.deepEqual(lines(text).map(entry => entry.text), []);
  assert.equal(scan('/**\n * @jsxImportSource local-jsx\n */\nconst a = 1;\n', 'src/x.tsx').commentLines, 0);
});

test('proza die op een aanwijzing of licentie lijkt, telt als commentaar', () => {
  const prose = [
    '// Het veld Copyright komt uit de kop van het bestand.',
    '// Deze uitleg noemt Copyright 2026 maar is geen vermelding.',
    '/* eslint is here for linting. */',
    '/// <dit-is-proza>',
    '/// <amd-module alleen uitleg />',
    '/* Lange uitleg over de bron,',
    '   overgenomen onder LGPL-2.1, en nog veel meer tekst. */',
  ];
  assert.equal(scan('const a = 1;\n' + prose.join('\n') + '\nconst b = 2;\n').commentLines, prose.length);
  assert.equal(scan('const a = 1;\n// @ts-check staat hier te laat\n').commentLines, 1);
});

test('een bron- of licentievermelding van één regel blijft staan', () => {
  assert.equal(scan('// Bron van de tabel: MPXJ `org.mpxj.WorkContour` (LGPL-2.1, github.com/joniles/mpxj).\nconst a = 1;\n').commentLines, 0);
  assert.equal(scan('// SPDX-License-Identifier: LGPL-3.0-or-later\nconst a = 1;\n').commentLines, 0);
  assert.equal(scan('// Copyright (c) 2026 OpenAEC Foundation\nconst a = 1;\n').commentLines, 0);
});

test('JSDoc in JavaScript: alleen types is geen commentaar, met uitleg wel', () => {
  const typesOnly = '/**\n * @param {string} a\n * @returns {{ b: number }}\n */\nexport function f(a) { return a; }\n';
  assert.equal(scan(typesOnly, 'scripts/x.mjs').commentLines, 0);
  assert.equal(scan(typesOnly, 'src/x.ts').commentLines, 4);
  assert.equal(scan('/** @param {string} a de naam */\nexport function f(a) { return a; }\n', 'scripts/x.mjs').commentLines, 1);
  assert.equal(scan('/** @param value */\nexport function f(value) { return value; }\n', 'scripts/x.mjs').commentLines, 1);
  assert.equal(scan('/** Uitleg zonder types. */\nexport const a = 1;\n', 'scripts/x.mjs').commentLines, 1);
});

test('bereik: code in src, tests en scripts wel; docs, voorbeelden en gegenereerde bestanden niet', () => {
  assert.equal(inScope('src/a/b.tsx'), true);
  assert.equal(inScope('scripts/x.mjs'), true);
  assert.equal(inScope('src/vite-env.d.ts'), true);
  assert.equal(inScope('docs/superpowers/evidence/x.mjs'), false);
  assert.equal(inScope('examples/extensions/x/main.js'), false);
  assert.equal(inScope('src/components/icons/b2/icons.generated.ts'), false);
  assert.equal(inScope('src/styles/globals.css'), false);
});

test('nieuw commentaar is elke regel die niet al op de basis stond', () => {
  const base = lines('// oud\n// blijft\nconst a = 1;\n');
  assert.deepEqual(addedCommentLines(lines('// blijft\nconst a = 1;\n'), base), []);
  assert.deepEqual(addedCommentLines(lines('  // oud\nconst a = 1;\n    // blijft\n'), base), []);
  assert.deepEqual(addedCommentLines(lines('// nieuw\n// blijft\nconst a = 1;\n'), base).map(e => [e.line, e.text]), [[1, '// nieuw']]);
});

test('bestaande tekst telt zo vaak als hij op de basis stond', () => {
  const base = lines('// oud\nconst a = 1;\n');
  assert.equal(addedCommentLines(lines('// oud\nconst a = 1;\n// oud\n'), base).length, 1);
});

test('commentaar mag met zijn code naar een ander bestand verhuizen', () => {
  const base = [...lines('// a\nconst a = 1;\n', 'src/oud.ts'), ...lines('// b\nconst b = 1;\n', 'src/ander.ts')];
  const now = [...lines('// a\nconst a = 1;\n', 'src/nieuw.ts'), ...lines('const b = 1;\n', 'src/ander.ts')];
  assert.deepEqual(addedCommentLines(now, base), []);
});

test('twee opruimingen in hetzelfde bestand tellen op zonder dat iets rood wordt', () => {
  const base = lines('// een\nconst a = 1;\n// twee\nconst b = 2;\n');
  assert.deepEqual(addedCommentLines(lines('const a = 1;\nconst b = 2;\n'), base), []);
});

test('strip haalt eigen regels, staartcommentaar en de lege regel op de naad weg', () => {
  const text = [
    '// kop', '', 'function f() {', '  // uitleg', '', '  const a = 1; // staart', '  const b = /* midden */ 2;', '',
    '  // slot', '}', '', '/** doc */', '// @ts-expect-error blijft', 'const c: number = "x";', '',
  ].join('\n');
  const result = stripComments(text, 'src/x.ts');
  assert.equal(result.text, ['function f() {', '  const a = 1;', '  const b = 2;', '}', '', '// @ts-expect-error blijft', 'const c: number = "x";', ''].join('\n'));
  assert.equal(result.removed, 6);
  assert.equal(scan(result.text).commentLines, 0);
});

test('strip haalt JSX-commentaar op eigen regels weg en laat JSX-commentaar tussen tekst voor de hand', () => {
  const own = stripComments('const a = (\n  <div>\n    {/* uitleg\n        verder */}\n    <b />\n  </div>\n);\n', 'src/x.tsx');
  assert.equal(own.text, 'const a = (\n  <div>\n    <b />\n  </div>\n);\n');
  const inline = stripComments('const a = <div>a {/* b */} c</div>;\n', 'src/x.tsx');
  assert.deepEqual(inline.manual, [1]);
  assert.equal(inline.text, 'const a = <div>a {/* b */} c</div>;\n');
});

test('strip laat commentaar staan waarvan het weghalen een regeleinde tussen tokens zou opheffen', () => {
  const text = 'function f() {\n  return /* uitleg\n*/ 42;\n}\n';
  const result = stripComments(text, 'src/x.ts');
  assert.deepEqual(result.manual, [2]);
  assert.equal(result.text, text);
});

test('strip behoudt elk soort regeleinde na een staartcommentaar', () => {
  for (const eol of ['\n', '\r\n', '\r', String.fromCharCode(0x2028), String.fromCharCode(0x2029)]) {
    const result = stripComments(`const a = f // staart${eol}(1);${eol}`, 'src/x.ts');
    assert.equal(result.text, `const a = f${eol}(1);${eol}`);
  }
});

test('strip laat aanwijzingen staan en JSDoc met types in JavaScript voor de hand', () => {
  const pragma = '/**\n * @jsxImportSource local-jsx\n */\n/* @ts-ignore */\nconst a: number = "x";\n';
  assert.equal(stripComments(pragma, 'src/x.tsx').text, pragma);
  const typed = '/** @type {number} Positief getal */\nconst a = 1;\n';
  const result = stripComments(typed, 'scripts/x.mjs');
  assert.deepEqual(result.manual, [1]);
  assert.equal(result.text, typed);
});

test('strip laat JSDoc staan met een tag die het gereedschap leest', () => {
  const deprecated = 'interface R {\n  /** @deprecated gebruik availabilitySteps */\n  availability?: number;\n}\n';
  const result = stripComments(deprecated, 'src/x.ts');
  assert.deepEqual(result.manual, [2]);
  assert.equal(result.text, deprecated);
  assert.equal(scan(deprecated).commentLines, 1);
  assert.equal(scan('interface R {\n  /** @deprecated */\n  a?: number;\n  /** @internal */\n  b?: number;\n}\n').commentLines, 0);
  assert.equal(scan('/** @param a */\nexport function f(a: string) { return a; }\n').commentLines, 1);
  const plain = '/**\n * Uitleg.\n * @param a de naam\n */\nexport function f(a: string) { return a; }\n';
  assert.equal(stripComments(plain, 'src/x.ts').text, 'export function f(a: string) { return a; }\n');
  const extended = '/** @extends {Base} met uitleg */\nclass A extends Base {}\n';
  assert.deepEqual(stripComments(extended, 'scripts/x.mjs').manual, [1]);
});

test('JSDoc in JavaScript met uitleg onder een typedef of overload telt als commentaar', () => {
  const typedef = '/**\n * @typedef {object} Opties\n * @property {string} naam de naam\n */\nexport const a = 1;\n';
  assert.equal(scan(typedef, 'scripts/x.mjs').commentLines, 4);
  assert.equal(scan(typedef.replace(' de naam', ''), 'scripts/x.mjs').commentLines, 0);
  const overload = '/**\n * @overload\n * @param {string} a uitleg\n * @returns {string}\n */\nexport function f(a) { return a; }\n';
  assert.equal(scan(overload, 'scripts/x.mjs').commentLines, 5);
  assert.equal(scan('/** @extends {Base} */\nclass A extends Base {}\n', 'scripts/x.mjs').commentLines, 0);
});

test('strip laat elk blok staan dat een licentie of copyright noemt', () => {
  for (const notice of [
    '// Afgeleid van de MPXJ-broncode (github.com/joniles/mpxj, LGPL-2.1).\n',
    '/**\n * Afgeleid van MPXJ, © Jon Iles e.a.\n */\n',
    '// Leest het containerformaat.\n// Tweede regel.\n// Afgeleid van MPXJ (LGPL-2.1).\n',
  ]) {
    const result = stripComments(`${notice}const a = 1;\n`, 'src/x.ts');
    assert.deepEqual(result.manual, [1]);
    assert.equal(result.text, `${notice}const a = 1;\n`);
  }
});

test('de voorspelde regelwinst is wat strip echt weghaalt', () => {
  const text = 'const a = 1;\n\n// weg\n\nfunction f() {\n  /** doc */\n\n  return 1; // staart\n}\n';
  assert.equal(stripComments(text, 'src/x.ts').shedLines, scan(text).shedLines);
  assert.equal(text.split('\n').length - stripComments(text, 'src/x.ts').text.split('\n').length, scan(text).shedLines);
});
