// #588 — MSPDI- en P6-XML-export: tekst met een teken dat XML 1.0 niet toestaat (U+0000–U+001F behalve
// tab/LF/CR, een losse UTF-16-surrogaat, U+FFFE/U+FFFF) maakte het hele exportbestand onleesbaar.
// De route is echt: een CSV-import zet het teken in de taaknaam, `exportAs` schrijft het bestand. Een
// strikte XML 1.0-parser (expat via python3) leest de volledige uitvoer; de eigen tolerante lezer telt niet.
// Na een export met vervangen tekens meldt de app hoeveel (`notifications.exportInvalidXmlChars`).
// Escapes staan bewust in de vorm `\u{…}`: zo staat er geen onzichtbaar teken in de bron.
// MUTATIEBEWIJS: laat `replaceInvalidXmlChars` (`xmlInterchange.ts`) de tekst ongewijzigd teruggeven
// ⇒ de parser weigert beide bestanden en de checks op U+FFFD en de melding slaan rood.
import { spawnSync } from 'node:child_process';
import { readCSV } from '@/services/csv/csvReader';
import { escapeXml, replaceInvalidXmlChars } from '@/services/xmlInterchange';

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

const REPLACEMENT = '\u{FFFD}';
const countReplacements = (s: string) => s.split(REPLACEMENT).length - 1;

// Het gedeelde contract, teken voor teken.
const lone = String.fromCharCode(0xd800);
const emoji = '\u{1F3D7}'; // geldig surrogaatpaar: blijft staan
const replaced = (s: string) => replaceInvalidXmlChars(s);
expect('C0-stuurtekens worden U+FFFD en tellen mee',
  replaced('A\u{0}B\u{1}C\u{1F}').xml === `A${REPLACEMENT}B${REPLACEMENT}C${REPLACEMENT}`
  && replaced('A\u{0}B\u{1}C\u{1F}').replaced === 3);
expect('tab, LF en CR blijven', replaced('a\tb\nc\rd').xml === 'a\tb\nc\rd' && replaced('a\tb\nc\rd').replaced === 0);
expect('U+FFFE en U+FFFF worden U+FFFD', replaced('x\u{FFFE}y\u{FFFF}').xml === `x${REPLACEMENT}y${REPLACEMENT}`);
expect('losse surrogaat (hoog en laag) wordt U+FFFD',
  replaced(`a${lone}b${String.fromCharCode(0xdc00)}`).xml === `a${REPLACEMENT}b${REPLACEMENT}`);
expect('geldig surrogaatpaar (emoji) blijft', replaced(`bouw ${emoji}`).xml === `bouw ${emoji}`);
expect('U+0085, U+007F en U+FFFD zelf blijven (XML 1.0 staat ze toe) en tellen niet',
  replaced(`\u{85}\u{7F}${REPLACEMENT}`).xml === `\u{85}\u{7F}${REPLACEMENT}`
  && replaced(`\u{85}\u{7F}${REPLACEMENT}`).replaced === 0);
expect('escapeXml ontsnapt de vijf entiteiten',
  escapeXml(`<a & "b" 'c'>`) === '&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;');

// De bereikbare route: CSV-import → store → exportAs.
const badName = `A\u{1}B ${lone} \u{FFFE} & <x> ${emoji}`;
const csv = `Name;Duration\n${badName};3\nGewoon;2\n`;
const imported = readCSV(csv);
expect('CSV-import draagt het verboden teken echt in de taaknaam (route bestaat)',
  imported.tasks.some(task => task.name.includes('\u{1}')));
store().applyLoadedProject(imported, { filePath: null, recompute: true });
expect('de store houdt de taaknaam met het verboden teken',
  store().tasks.some(task => task.name.includes('\u{1}')));
// Ook een vrij projectveld gaat door dezelfde uitvoer.
store().setProject({ author: 'Auteur\u{0}X' });

const invalidCharNotices = () => store().ui.notifications.filter(notification =>
  (notification.messageKey as string) === 'notifications.exportInvalidXmlChars');

for (const format of ['mspdi', 'p6'] as const) {
  for (const notification of [...store().ui.notifications]) store().dismissNotification(notification.id);
  const before = captures.length;
  const result = await store().exportAs(format);
  const xml = captures.length > before ? captures.at(-1)! : '';
  expect(`${format}: export slaagt`, result.ok === true && xml.length > 0);
  const parsed = strictParse(xml);
  expect(`${format}: strikte XML 1.0-parser leest de volledige uitvoer (${parsed.error})`, parsed.ok);
  expect(`${format}: geen verboden teken in de uitvoer`, replaceInvalidXmlChars(xml).replaced === 0);
  expect(`${format}: het vervangen teken is zichtbaar als U+FFFD`, xml.includes(`A${REPLACEMENT}B`));
  expect(`${format}: de geldige emoji blijft`, xml.includes(emoji));
  expect(`${format}: markup in tekst blijft ontsnapt`, xml.includes('&amp; &lt;x&gt;'));
  const notices = invalidCharNotices();
  expect(`${format}: één melding telt precies de vervangen tekens (${countReplacements(xml)})`,
    notices.length === 1
    && notices[0]?.params?.count === countReplacements(xml)
    && countReplacements(xml) >= 3);
}

// Een gewone export zonder verboden teken geeft die melding niet.
store().newProject();
store().addTask({ name: 'Schoon' });
for (const format of ['mspdi', 'p6'] as const) {
  for (const notification of [...store().ui.notifications]) store().dismissNotification(notification.id);
  await store().exportAs(format);
  expect(`${format}: schone export geeft geen tekenmelding`, invalidCharNotices().length === 0);
}

console.log(`xml-export-text: ${checks - failures.length}/${checks} checks groen`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`XX ${failure}`);
  process.exit(1);
}
