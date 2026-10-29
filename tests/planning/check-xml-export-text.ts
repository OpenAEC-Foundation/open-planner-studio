// #588 — MSPDI- en P6-XML-export: tekst met een teken dat XML 1.0 niet toestaat (U+0000–U+001F behalve
// tab/LF/CR, een losse UTF-16-surrogaat, U+FFFE/U+FFFF) maakte het hele exportbestand onleesbaar.
// De route is echt: een CSV-import zet het teken in de taaknaam, `exportAs` schrijft het bestand. Een
// strikte XML 1.0-parser (expat via python3) leest de volledige uitvoer; de eigen tolerante lezer telt niet.
// MUTATIEBEWIJS: zet in `escapeXml` (`xmlInterchange.ts`) de `.replace(XML_INVALID_CHAR, …)`-regel uit
// ⇒ de parser weigert beide bestanden en de checks op U+FFFD slaan rood.
import { spawnSync } from 'node:child_process';
import { readCSV } from '@/services/csv/csvReader';
import { escapeXml } from '@/services/xmlInterchange';

declare const process: { exit(code: number): never };
const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};

const captures: string[] = [];
const global = globalThis as Record<string, any>;
global.window = global.window ?? {};
global.Blob = class {
  constructor(parts: unknown[]) { captures.push(parts.join('')); }
};
global.URL = global.URL ?? {};
global.URL.createObjectURL = () => 'blob:xml-export-text';
global.URL.revokeObjectURL = () => undefined;
global.document = {
  createElement: () => ({ href: '', download: '', click: () => undefined }),
};

const { useAppStore } = await import('@/state/appStore');
const store = () => useAppStore.getState();

/** Strikte XML 1.0-parser buiten de app: expat geeft `not well-formed (invalid token)` bij een verboden teken. */
function strictParse(xml: string): { ok: boolean; error: string } {
  const run = spawnSync('python3', ['-I', '-c', [
    'import sys, xml.etree.ElementTree as ET',
    'try:',
    '    ET.fromstring(sys.stdin.buffer.read())',
    'except ET.ParseError as e:',
    '    print(e); sys.exit(1)',
  ].join('\n')], { input: Buffer.from(xml, 'utf8'), encoding: 'utf8', timeout: 20_000 });
  if (run.error) return { ok: false, error: `python3 niet te starten: ${run.error.message}` };
  return { ok: run.status === 0, error: `${run.stdout}${run.stderr}`.trim() };
}

// Het gedeelde escaping-contract, teken voor teken.
const lone = String.fromCharCode(0xd800);
const emoji = '\u{1F3D7}'; // geldig surrogaatpaar: blijft staan
expect('escapeXml: C0-stuurtekens worden U+FFFD', escapeXml('A\u0000B\u0001C\u001F') === 'A�B�C�');
expect('escapeXml: tab, LF en CR blijven', escapeXml('a\tb\nc\rd') === 'a\tb\nc\rd');
expect('escapeXml: U+FFFE en U+FFFF worden U+FFFD', escapeXml('x￾y￿') === 'x�y�');
expect('escapeXml: losse surrogaat (hoog en laag) wordt U+FFFD',
  escapeXml(`a${lone}b${String.fromCharCode(0xdc00)}`) === 'a�b�');
expect('escapeXml: geldig surrogaatpaar (emoji) blijft', escapeXml(`bouw ${emoji}`) === `bouw ${emoji}`);
expect('escapeXml: de vijf entiteiten blijven ontsnapt',
  escapeXml(`<a & "b" 'c'>`) === '&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;');
expect('escapeXml: U+0085, U+007F en U+FFFD zelf blijven (XML 1.0 staat ze toe)',
  escapeXml('\u0085\u007F�') === '\u0085\u007F�');

// De bereikbare route: CSV-import → store → exportAs.
const badName = `A\u0001B ${lone} ￾ & <x> ${emoji}`;
const csv = `Name;Duration\n${badName};3\nGewoon;2\n`;
const imported = readCSV(csv);
expect('CSV-import draagt het verboden teken echt in de taaknaam (route bestaat)',
  imported.tasks.some(task => task.name.includes('\u0001')));
store().applyLoadedProject(imported, { filePath: null, recompute: true });
expect('de store houdt de taaknaam met het verboden teken',
  store().tasks.some(task => task.name.includes('\u0001')));
// Ook een vrij projectveld gaat via dezelfde helper.
store().setProject({ author: 'Auteur\u0000X' });

for (const format of ['mspdi', 'p6'] as const) {
  const before = captures.length;
  const result = await store().exportAs(format);
  const xml = captures.length > before ? captures.at(-1)! : '';
  expect(`${format}: export slaagt`, result.ok === true && xml.length > 0);
  const parsed = strictParse(xml);
  expect(`${format}: strikte XML 1.0-parser leest de volledige uitvoer (${parsed.error})`, parsed.ok);
  expect(`${format}: geen verboden teken in de uitvoer`,
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(xml) && !/[\uD800-\uDFFF]/u.test(xml));
  expect(`${format}: het vervangen teken is zichtbaar als U+FFFD`, xml.includes('A�B'));
  expect(`${format}: de geldige emoji blijft`, xml.includes(emoji));
  expect(`${format}: markup in tekst blijft ontsnapt`, xml.includes('&amp; &lt;x&gt;'));
}

console.log(`xml-export-text: ${checks - failures.length}/${checks} checks groen`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`XX ${failure}`);
  process.exit(1);
}
