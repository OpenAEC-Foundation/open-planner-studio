// WBS auto bij het openen (eigenaarsbesluit 2026-10-17). Via de echte open-pijplijn:
// `parseOpenedFile` (formatRegistry) → `openAsDocument` → `applyLoadedProject` (store).
// Regel: draagt het bestand GEEN `wbsAutoNumber`-vlag en is elke WBS-code precies de boomnummering
// (zelfde nummering als `deriveWbsCodes`/"Hernummer WBS"), dan staat "WBS auto" na het openen aan.
// Anders blijft alles zoals het was (vrije tekst; een vlag uit het bestand blijft staan, ook `false`).
// Een leeg bestand zonder vlag krijgt ook true (zoals een nieuw project). Alleen op de echte
// open-paden: `loadState` (IFC-paneel *Toepassen*, extensie-`loadProject`) laat de vlag staan.
// Bewaakt ook: geen undo-stap, document niet gewijzigd, codes ongewijzigd, IFC-export zelfde codes.
// Corpusloos (CI). Fixtures: inline, zelf geschreven.
import './domStub';
import { parseOpenedFile } from '@/services/formatRegistry';
import { useAppStore } from '@/state/appStore';
import { activeImportResult, type ImportResult, type OpenedImport } from '@/services/importTypes';
import { selectUndoHistoryEvent } from '@/state/sessionHistory';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildExportIFCInput } from '@/state/ifcSaveInput';
import { flattenOrder, deriveWbsCodes } from '@/utils/wbs';
import type { Task } from '@/types/task';
import { installDOMParser } from './xmldom-shim';

declare const process: { exitCode?: number };
installDOMParser();
const S = () => useAppStore.getState();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

// MSPDI met een boom van drie niveaus. `codes[i]` is de <WBS> van taak i (in bestandsvolgorde).
const TREE: { name: string; level: number }[] = [
  { name: 'Voorbereiding', level: 1 },
  { name: 'Ontwerp', level: 2 },
  { name: 'Vergunning', level: 2 },
  { name: 'Aanvraag', level: 3 },
  { name: 'Besluit', level: 3 },
  { name: 'Uitvoering', level: 1 },
  { name: 'Fundering', level: 2 },
];
const TREE_CODES = ['1', '1.1', '1.2', '1.2.1', '1.2.2', '2', '2.1'];
function mspdi(codes: readonly string[]): string {
  const tasks = TREE.map((t, i) => `<Task><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${t.name}</Name>`
    + `<WBS>${codes[i]}</WBS><OutlineLevel>${t.level}</OutlineLevel>`
    + `<Start>2026-01-05T08:00:00</Start><Finish>2026-01-09T17:00:00</Finish><Duration>PT40H0M0S</Duration></Task>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>WBS</Name><StartDate>2026-01-05T08:00:00</StartDate>
<MinutesPerDay>480</MinutesPerDay><Tasks>${tasks}</Tasks></Project>`;
}

function undoEventCount(): number {
  const doc = S().activeDocumentId;
  return S().historyEvents.filter(event => event.state === 'applied'
    && event.deltas.some(delta => delta.kind !== 'grid-preference' && delta.documentId === doc)).length;
}

async function openParsed(parsed: OpenedImport, name: string): Promise<void> {
  S().newProject();
  S().openAsDocument(parsed, { name, ref: null });
}
async function openText(name: string, text: string): Promise<OpenedImport> {
  const parsed = await parseOpenedFile({ name, text });
  await openParsed(parsed, name);
  return parsed;
}
const codesInTreeOrder = () => flattenOrder(S().tasks).map(t => t.wbsCode);

const ifcExportCodes = () => flattenOrder(readIFC(writeIFC(buildExportIFCInput(S()))).tasks).map(t => t.wbsCode);

async function main(): Promise<void> {
  // (a) Codes gelijk aan de boom ⇒ vlag true; codes ongewijzigd; geen undo-stap; niet gewijzigd.
  const parsedA = await openText('gelijk.xml', mspdi(TREE_CODES));
  eq('a0 bestand draagt geen vlag', activeImportResult(parsedA).project.wbsAutoNumber, undefined);
  eq('a1 vlag na openen', S().project.wbsAutoNumber, true);
  eq('a2 codes ongewijzigd', codesInTreeOrder(), TREE_CODES);
  eq('a3 geen undo-stap', [undoEventCount(), selectUndoHistoryEvent(S().historyEvents, S().activeDocumentId)?.id ?? null], [0, null]);
  eq('a4 document niet gewijzigd', S().isDirty, false);

  // IFC-export schrijft dezelfde codes als vóór de wijziging (vlag weg = de oude stand na openen).
  const withFlag = ifcExportCodes();
  useAppStore.setState(st => { st.project.wbsAutoNumber = undefined; });
  eq('a8 IFC-export: zelfde codes', withFlag, ifcExportCodes());
  eq('a9 IFC-export: codes = bron', withFlag, TREE_CODES);

  // (a') Na het openen nummert de app live: een ingevoegde taak krijgt geen dubbele code.
  await openText('gelijk.xml', mspdi(TREE_CODES));
  const besluit = S().tasks.find(t => t.name === 'Besluit')!;
  const nieuw = S().addTask({ name: 'Nieuw', position: { anchorId: besluit.id, where: 'above' } });
  let after = codesInTreeOrder();
  eq('a10 geen dubbele code na invoegen', new Set(after).size, after.length);
  S().indentTasks([nieuw]);
  after = codesInTreeOrder();
  eq('a11 geen dubbele code na inspringen', new Set(after).size, after.length);
  eq('a12 nieuwe taak is kind van Aanvraag', S().tasks.find(t => t.id === nieuw)?.wbsCode, '1.2.1.1');

  // (b) Eén afwijkende code ⇒ undefined; codes blijven vrije tekst.
  const B = [...TREE_CODES]; B[4] = '1.2.3';
  await openText('afwijkend.xml', mspdi(B));
  eq('b1 één afwijking ⇒ geen vlag', S().project.wbsAutoNumber, undefined);
  eq('b2 codes ongewijzigd', codesInTreeOrder(), B);
  // Alleen het eerste niveau gelijk is niet genoeg.
  const B2 = [...TREE_CODES]; B2[1] = '1.9';
  await openText('afwijkend2.xml', mspdi(B2));
  eq('b3 dieper niveau wijkt af ⇒ geen vlag', S().project.wbsAutoNumber, undefined);
  // Eigen opbouw (P6-stijl).
  await openText('eigen.xml', mspdi(TREE_CODES.map((_c, i) => `OCEC97${30 + i}`)));
  eq('b4 eigen opbouw ⇒ geen vlag', S().project.wbsAutoNumber, undefined);

  // (c) IFC van de app met vlag false ⇒ blijft false. En met vlag true ⇒ blijft true.
  await openText('gelijk.xml', mspdi(TREE_CODES));
  useAppStore.setState(st => { st.project.wbsAutoNumber = false; });
  const ifcFalse = writeIFC(buildExportIFCInput(S()));
  eq('c0 IFC draagt de vlag false', readIFC(ifcFalse).project.wbsAutoNumber, false);
  await openText('eigen-false.ifc', ifcFalse);
  eq('c1 IFC met vlag false ⇒ blijft false', S().project.wbsAutoNumber, false);
  // IFC zonder vlag (zoals uit een ander pakket) met boomcodes ⇒ true.
  useAppStore.setState(st => { st.project.wbsAutoNumber = undefined; });
  const ifcNone = writeIFC(buildExportIFCInput(S()));
  eq('c2 IFC zonder vlag', readIFC(ifcNone).project.wbsAutoNumber, undefined);
  await openText('derden.ifc', ifcNone);
  eq('c3 IFC zonder vlag + boomcodes ⇒ true', S().project.wbsAutoNumber, true);

  // (d) Lege code ⇒ undefined. (MSPDI vult een lege <WBS> met de UID, dus de lege code komt
  // rechtstreeks in de geparste payload.)
  const parsedD = await parseOpenedFile({ name: 'leeg.xml', text: mspdi(TREE_CODES) });
  const resD = activeImportResult(parsedD);
  const emptyCode: ImportResult = { ...resD, tasks: resD.tasks.map((t, i) => (i === 3 ? { ...t, wbsCode: '' } : t)) };
  await openParsed(emptyCode, 'leeg.xml');
  eq('d1 lege code ⇒ geen vlag', S().project.wbsAutoNumber, undefined);

  // (e) Leeg bestand zonder vlag ⇒ true (zoals een nieuw project): toevoegen + invoegen boven geeft
  // daarna geen dubbele code (zonder de vlag: A=1, N=2, B=2).
  const emptyProject: ImportResult = { ...resD, tasks: [], sequences: [], assignments: [] };
  await openParsed(emptyProject, 'leeg-project.xml');
  eq('e1 leeg bestand ⇒ vlag true', S().project.wbsAutoNumber, true);
  eq('e2 leeg bestand: geen undo-stap, niet gewijzigd', [undoEventCount(), S().isDirty], [0, false]);
  S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  S().addTask({ name: 'N', position: { anchorId: b, where: 'above' } });
  const emptyAfter = codesInTreeOrder();
  eq('e3 leeg bestand: geen dubbele code na invoegen', emptyAfter, ['1', '2', '3']);
  // Leeg bestand met vlag false (eigen IFC) ⇒ blijft false.
  await openParsed({ ...emptyProject, project: { ...emptyProject.project, wbsAutoNumber: false } }, 'leeg-false.xml');
  eq('e4 leeg bestand met vlag false ⇒ blijft false', S().project.wbsAutoNumber, false);

  // (f) loadState (IFC-paneel *Toepassen*, extensie-`loadProject`) is geen openen: de vlag blijft.
  S().newProject();
  S().loadState(resD);
  eq('f1 loadState: boomcodes ⇒ vlag blijft undefined', S().project.wbsAutoNumber, undefined);
  eq('f2 loadState: geen undo-stap', undoEventCount(), 0);
  S().loadState(emptyProject);
  eq('f3 loadState: leeg ⇒ vlag blijft undefined', S().project.wbsAutoNumber, undefined);

  // (g) De iteratieve WBS-wandeling (168) houdt de rauwe siblingvolgorde aan, óók als
  // childIds een andere volgorde draagt. Wezen en parentId-kringen houden hun oude vangnet.
  const node = (id: string, parentId: string | null, childIds: string[] = []): Task => ({
    ...resD.tasks[0], id, parentId, childIds,
  });
  const awkward = [
    node('R', null, ['B', 'A']), node('A', 'R', ['G']), node('B', 'R'), node('G', 'A'),
    node('S', null), node('O', 'ontbreekt', ['K']), node('K', 'O'),
    node('X', 'Y', ['Y']), node('Y', 'X', ['X']),
  ];
  const before = JSON.stringify(awkward);
  eq('g1 WBS volgt array-siblings, diepte-eerst, daarna wezen en kring',
    flattenOrder(awkward).map(t => t.id), ['R', 'A', 'G', 'B', 'S', 'O', 'K', 'X', 'Y']);
  eq('g2 nummering volgt dezelfde volgorde met cyclusbewaking', [...deriveWbsCodes(awkward)],
    [['R', '1'], ['A', '1.1'], ['G', '1.1.1'], ['B', '1.2'], ['S', '2'],
      ['O', '3'], ['K', '3.1'], ['X', '4'], ['Y', '4.1']]);
  eq('g3 afleiden verandert geen identiteiten of boomgegevens', JSON.stringify(awkward), before);

  if (fails.length) {
    for (const f of fails) console.log(`XX  ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`OK  check-wbs-auto-on-open: ${checks} checks`);
  }
}

main().catch((e) => { console.log(`XX  check-wbs-auto-on-open crasht: ${(e as Error).stack}`); process.exitCode = 1; });
