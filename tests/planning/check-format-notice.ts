// Uitleg na het openen van een ander formaat dan IFC (eigenaarsbesluit 2026-10-12, optie 1).
//
// Zet de "wanneer tonen"-regel vast:
//  A. PUUR — `formatNoticeKindFor`/`formatNoticeToShow`: welk formaat krijgt welke uitleg; IFC en
//     onbekende extensies nooit; een `.xml` kiest op het root-element, net als de lezer.
//  B. PUUR — de instelling: `parseFormatNoticeHidden` en `withFormatNoticeShown`.
//  C. STORE — de echte open-route `openFile` (via de `<input type=file>`-terugval, stubs zoals in
//     `check-mpp-open-guard.ts`) zet `ui.pendingFormatNotice`; een uitgezet formaat niet; IFC niet;
//     de MCP-route (`openAsDocument` rechtstreeks) en voorbeelden (`openExampleFromString`) niet.
//
// Draait via run.sh. Exit 0 = alles groen.
import { installDOMParser } from './xmldom-shim';

const g = globalThis as any;
g.window = g.window ?? {}; // geen showOpenFilePicker ⇒ input-terugval; isTauri() blijft false.

let nextFile: unknown = null;
const fakeFile = (name: string, text: string) => ({
  name,
  text: async () => text,
  arrayBuffer: async () => new TextEncoder().encode(text).buffer,
});
g.document = {
  createElement: (tag: string) => {
    if (tag !== 'input') return {};
    const input: any = {
      type: '', accept: '', files: undefined, onchange: null,
      addEventListener: () => { /* cancel wordt hier niet gebruikt */ },
      click: () => { input.files = nextFile ? [nextFile] : []; void input.onchange?.(); },
    };
    return input;
  },
};

const { useAppStore } = await import('@/state/appStore');
const { formatNoticeKindFor, formatNoticeToShow } = await import('@/services/formatNotice');
const { FORMAT_NOTICE_KINDS, parseFormatNoticeHidden, withFormatNoticeShown } = await import('@/services/formatNoticeKinds');
const { parseOpenedFile } = await import('@/services/formatRegistry');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { writeCSV } = await import('@/services/csv/csvWriter');
const { writeMSPDI } = await import('@/services/msproject/mspdiWriter');

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// ── A. Welk formaat, welke uitleg ──────────────────────────────────────────────────────────────
const MSPDI_XML = '<?xml version="1.0"?>\n<Project xmlns="http://schemas.microsoft.com/project"><Name>x</Name></Project>';
const P6_XML = '<?xml version="1.0"?>\n<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects"></APIBusinessObjects>';
eq('A01 .xer ⇒ xer', formatNoticeKindFor('plan.xer'), 'xer');
eq('A02 .mpp ⇒ mpp', formatNoticeKindFor('plan.mpp'), 'mpp');
eq('A03 .csv ⇒ csv', formatNoticeKindFor('plan.csv', 'Name;Duration\n'), 'csv');
eq('A04 .xml met MS Project-root ⇒ mspdi', formatNoticeKindFor('plan.xml', MSPDI_XML), 'mspdi');
eq('A05 .xml met P6-root ⇒ p6xml', formatNoticeKindFor('plan.xml', P6_XML), 'p6xml');
eq('A06 .xml met onbekende root ⇒ geen uitleg', formatNoticeKindFor('plan.xml', '<foo/>'), null);
eq('A07 .xml zonder tekst ⇒ geen uitleg', formatNoticeKindFor('plan.xml'), null);
eq('A08 .ifc ⇒ geen uitleg (het eigen formaat)', formatNoticeKindFor('plan.ifc', 'ISO-10303-21;'), null);
eq('A09 onbekende extensie ⇒ geen uitleg (leest als IFC)', formatNoticeKindFor('plan.txt', 'x'), null);
eq('A10 hoofdletters in de extensie ⇒ zelfde formaat', formatNoticeKindFor('PLAN.XER'), 'xer');
eq('A11 uitgezet formaat ⇒ geen uitleg', formatNoticeToShow('plan.xer', undefined, ['xer']), null);
eq('A12 ander formaat uitgezet ⇒ wel uitleg', formatNoticeToShow('plan.xer', undefined, ['mpp', 'csv']), 'xer');
eq('A13 alles uitgezet ⇒ nooit uitleg', FORMAT_NOTICE_KINDS.map((k) => formatNoticeToShow(`p.${k === 'mspdi' || k === 'p6xml' ? 'xml' : k}`, k === 'p6xml' ? P6_XML : MSPDI_XML, FORMAT_NOTICE_KINDS)), [null, null, null, null, null]);

// ── B. De instelling ───────────────────────────────────────────────────────────────────────────
eq('B01 geen array ⇒ undefined (default blijft)', parseFormatNoticeHidden('xer'), undefined);
eq('B02 onbekend en dubbel eruit, vaste volgorde', parseFormatNoticeHidden(['csv', 'foo', 'xer', 'csv']), ['xer', 'csv']);
eq('B03 uitzetten voegt toe', withFormatNoticeShown(['csv'], 'xer', false), ['xer', 'csv']);
eq('B04 aanzetten haalt weg', withFormatNoticeShown(['xer', 'csv'], 'xer', true), ['csv']);
eq('B05 aanzetten van een getoond formaat verandert niets', withFormatNoticeShown([], 'mpp', true), []);

// ── C. De echte open-route ─────────────────────────────────────────────────────────────────────
installDOMParser();
S().newProject();
S().setProject({ name: 'Uitleg-bron', startDate: '2026-08-03' });
S().addTask({ name: 'Werkje' });
const src = S();
const ifcText = writeIFC(buildWriteIFCInput(src, 'planOnly'));
const csvText = writeCSV(src.project, src.calendar, src.tasks, src.sequences, src.resources, src.assignments);
const xmlText = writeMSPDI(src.project, src.calendar, src.tasks, src.sequences, src.resources, src.assignments,
  src.calendars, src.baselines, src.activeBaselineId);

const openVia = async (name: string, text: string) => {
  S().setUI({ pendingFormatNotice: null });
  nextFile = fakeFile(name, text);
  await S().openFile();
  return S().ui.pendingFormatNotice;
};

S().setUI({ formatNoticeHidden: [] });
eq('C01 Bestand → Openen met CSV ⇒ CSV-uitleg', await openVia('bron.csv', csvText), 'csv');
eq('C02 Bestand → Openen met MS Project XML ⇒ mspdi-uitleg', await openVia('bron.xml', xmlText), 'mspdi');
eq('C03 Bestand → Openen met IFC ⇒ geen uitleg', await openVia('bron.ifc', ifcText), null);
S().setUI({ formatNoticeHidden: ['csv'] });
eq('C04 CSV uitgezet ⇒ geen uitleg', await openVia('bron.csv', csvText), null);
eq('C05 alleen CSV uitgezet ⇒ XML wel', await openVia('bron.xml', xmlText), 'mspdi');
S().setUI({ formatNoticeHidden: [], pendingFormatNotice: null });
{
  // De MCP-route (`planner_import_schedule`) roept `openAsDocument` rechtstreeks aan: geen uitleg.
  const parsed = await parseOpenedFile({ name: 'mcp.csv', text: csvText });
  S().openAsDocument(parsed, { name: 'mcp.csv', ref: null });
  eq('C06 MCP-route (openAsDocument) ⇒ geen uitleg', S().ui.pendingFormatNotice, null);
}
{
  const ok = await S().openExampleFromString(ifcText, 'voorbeeld.ifc');
  eq('C07 voorbeeld geopend', ok, true);
  eq('C08 voorbeeld ⇒ geen uitleg', S().ui.pendingFormatNotice, null);
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`check-format-notice: ${diffs.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK check-format-notice: ${checks} checks groen`);
