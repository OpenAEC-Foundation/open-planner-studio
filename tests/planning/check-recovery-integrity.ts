// Recovery-integriteitschecks (bevinding K4) — headless tegen de ECHTE store + de ECHTE
// writeIFC/readIFC-keten, zelfde patroon als de andere check-scripts.
//
// Waarom deze batterij bestaat. Drie op zichzelf verdedigbare schakels leverden samen
// datavernietiging op:
//   1. de auto-save schreef de recovery-snapshot NIET atomair (`writeTextFile` truncate't eerst),
//      dus een crash midden in de schrijfactie liet een AFGEKAPT bestand achter — precies in het
//      scenario waarvoor recovery bestaat;
//   2. `readIFC` bevatte NUL `throw`-statements: een lege string, willekeurige tekst, JSON én een
//      afgekapt bestand leverden alle vier een "geldig" leeg project op;
//   3. daardoor vuurde de per-document `try/catch` in `useRecoveryRestore` nooit en werd zo'n
//      snapshot als volwaardig document aangeboden — en na het herstellen ook nog gewist.
//
// Het ergste geval is niet het lege document maar het HALVE: een snapshot kan na alle taken maar
// vóór of midden in de relaties afbreken. Dan ontstaat een compleet ogende planning zonder het
// volledige logicanetwerk, zonder crash en zonder melding. Assertie 3c knipt daarom op echte
// STEP-recordgrenzen. Vaste percentages zijn ongeschikt: een verliesloze nieuwe pset mag de
// byteverhouding van het bestand veranderen zonder deze herstelpoort inhoudelijk te wijzigen.
//
// Bewust NIET getest, want bewust NIET gebouwd: een drempel op taakaantal. Een leeg-maar-echt
// project (verse wizard, kalender en resources ingericht) is legitiem en moet gewoon herstellen —
// zie assertie 6.
//
// Wat hier niet kan: de Tauri-kant (`saveTauri`, de directory-scan-terugval) draait alleen in een
// echte Tauri-runtime. Wat wél headless te bewijzen valt is de manifest-poort, want die is een pure
// functie — zie assertie 7 — en de schrijf-en-vervang-primitief zelf tegen een nep-fs, plus dat
// recovery én bibliotheek er doorheen schrijven — zie assertie 9.
//
// Draaien: bundel met esbuild zoals run.sh dat doet en start met node. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError, type IfcParseErrorReason } from '@/services/ifc/ifcErrors';
import { parseRecoveryManifest } from '@/services/recovery/recoveryStore';
import type { RecoveryDocInput } from '@/state/documentContract';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import { writeViaTemp, type AtomicWriteFs } from '@/services/fileAccess/atomicWrite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Minimale, botsingvrije `process`-declaratie (zelfde truc als check-ifc-roundtrip.ts), zodat dit
// bestand óók typecheckt onder een config zonder Node-typen (`types: []`).
declare const process: { exit(code: number): never };

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

/** Roep `readIFC` aan en rapporteer het verwachte-fout-verdict als een vergelijkbare waarde. */
const gooit = (content: string): { threw: boolean; typed: boolean; reason: string | null } => {
  try {
    readIFC(content);
    return { threw: false, typed: false, reason: null };
  } catch (err) {
    const typed = err instanceof IfcParseError;
    return { threw: true, typed, reason: typed ? (err as IfcParseError).reason : String(err) };
  }
};
const eistFout = (label: string, content: string, reason: IfcParseErrorReason) => {
  eq(label, gooit(content), { threw: true, typed: true, reason });
};

// ── 1. Een geldig, gevuld project blijft gewoon parsen ────────────────────────────────────────
// De bron is de ECHTE auto-save-keten: store → buildWriteIFCInput → writeIFC. Wat de recovery
// wegschrijft is exact dit.
S().newProject();
const ids: string[] = [];
for (let i = 1; i <= 10; i++) ids.push(S().addTask({ name: `Taak ${i}` }));
for (let i = 0; i < 9; i++) {
  S().addSequence({ predecessorId: ids[i], successorId: ids[i + 1], type: 'FINISH_START', lagDays: 0 });
}
S().runCPM();
const VOLLEDIG = writeIFC(buildWriteIFCInput(S()));

const rt = readIFC(VOLLEDIG);
eq('1a volledige snapshot: 10 taken', rt.tasks.length, 10);
eq('1b volledige snapshot: 9 relaties', rt.sequences.length, 9);
eq('1c volledige snapshot: projectnaam behouden', rt.project.name, S().project.name);

// ── 2. Kop-tolerantie: BOM, witruimte en kleine letters mogen de poort niet dichtgooien ───────
eq('2a BOM vóór de kop parst gewoon', readIFC(`﻿${VOLLEDIG}`).tasks.length, 10);
eq('2b witruimte/regeleindes vóór de kop parsen gewoon', readIFC(`\n\n  ${VOLLEDIG}`).tasks.length, 10);
eq('2c kleine letters in kop/slot parsen gewoon',
  readIFC(VOLLEDIG.replace('ISO-10303-21;', 'iso-10303-21;').replace('END-ISO-10303-21;', 'end-iso-10303-21;')).tasks.length,
  10);

// ── 3. Afgekapte snapshots (70/80/90 %) — het hart van de bevinding ───────────────────────────
// Dit is letterlijk wat een crash midden in een niet-atomaire `writeTextFile` achterlaat.
for (const pct of [70, 80, 90]) {
  const afgekapt = VOLLEDIG.slice(0, Math.floor(VOLLEDIG.length * (pct / 100)));
  eistFout(`3a afgekapt op ${pct}% gooit IfcParseError('truncated')`, afgekapt, 'truncated');
  truthy(`3b afgekapt op ${pct}%: kop nog aanwezig, sluitmarkering weg (dus alleen hierop te zien)`,
    afgekapt.startsWith('ISO-10303-21;') && !afgekapt.includes('END-ISO-10303-21;'));
}
{
  // 3c De pijnlijke meting uit de review, als structurele STEP-eigenschap vastgelegd. De writer
  //    schrijft alle IFCTASK-regels vóór IFCRELSEQUENCE. We knippen één keer direct vóór de eerste
  //    relatie en één keer vóór de vijfde: zo bewijst de test exact het lege en halve netwerk,
  //    onafhankelijk van extra verliesloze psets die later aan de writer worden toegevoegd.
  const tel = (s: string, naald: string) => s.split(naald).length - 1;
  const eersteRelatie = VOLLEDIG.indexOf('IFCRELSEQUENCE(');
  let vijfdeRelatie = eersteRelatie;
  for (let nummer = 2; nummer <= 5; nummer++) {
    vijfdeRelatie = VOLLEDIG.indexOf('IFCRELSEQUENCE(', vijfdeRelatie + 1);
  }
  truthy('3c0 fixture bevat minstens vijf relaties op vindbare STEP-grenzen',
    eersteRelatie > 0 && vijfdeRelatie > eersteRelatie);
  const zonderNetwerk = VOLLEDIG.slice(0, eersteRelatie);
  const halfNetwerk = VOLLEDIG.slice(0, vijfdeRelatie);
  eq('3c1 vóór de eerste relatie staan alle tien taken al in de snapshot', tel(zonderNetwerk, 'IFCTASK('), 10);
  eq('3c2 vóór de eerste relatie staat nog geen IFCRELSEQUENCE', tel(zonderNetwerk, 'IFCRELSEQUENCE('), 0);
  eq('3c3 vóór de vijfde relatie staan alle taken maar slechts vier relaties',
    [tel(halfNetwerk, 'IFCTASK('), tel(halfNetwerk, 'IFCRELSEQUENCE(')], [10, 4]);
  eistFout('3c4 beide structureel halve snapshots worden geweigerd (zonder netwerk)', zonderNetwerk, 'truncated');
  eistFout('3c5 beide structureel halve snapshots worden geweigerd (half netwerk)', halfNetwerk, 'truncated');
  eq('3c6 het volledige bestand heeft alle 9 relaties wél', tel(VOLLEDIG, 'IFCRELSEQUENCE('), 9);
}

// ── 4. Onzin-invoer: geen STEP-bestand ────────────────────────────────────────────────────────
eistFout('4a lege string', '', 'not-step');
eistFout('4b alleen witruimte', '   \n\t  ', 'not-step');
eistFout('4c gewone tekst', 'dit is helemaal geen IFC-bestand', 'not-step');
eistFout('4d JSON', '{"foo":1}', 'not-step');
eistFout('4e HTML-foutpagina (typische mislukte download)', '<!doctype html><html><body>404</body></html>', 'not-step');

// ── 5. Kop zonder slot: leeggelopen/afgebroken schrijfactie ───────────────────────────────────
eistFout('5a alleen de kop', 'ISO-10303-21;\n', 'truncated');
eistFout('5b kop + halve header, geen DATA-sectie', 'ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((', 'truncated');
eistFout('5c volledig bestand met alleen het slot eraf',
  VOLLEDIG.slice(0, VOLLEDIG.lastIndexOf('END-ISO-10303-21;')), 'truncated');

// ── 6. INGETROKKEN VOORSTEL — borging ─────────────────────────────────────────────────────────
// Het oorspronkelijke rapport stelde voor "een snapshot met 0 taken niet aanbieden". Dat is
// afgewezen: een leeg-maar-echt project is legitiem, en omdat de flow doorloopt naar
// `clearRecovery()` zou zo'n snapshot dan ook nog GEWIST worden. Filteren gebeurt op
// onparseerbaarheid, nooit op taakaantal.
S().newProject();
S().addResource({ name: 'Ploeg A', type: 'LABOR', description: '', maxUnits: 2 });
S().setStatusDate('2030-06-01');
const LEEG_MAAR_ECHT = writeIFC(buildWriteIFCInput(S()));
const rtLeeg = readIFC(LEEG_MAAR_ECHT);
eq('6a leeg-maar-geldig project (0 taken) parst gewoon door', rtLeeg.tasks.length, 0);
eq('6b … met zijn resources', rtLeeg.resources.length, 1);
eq('6c … en zijn statusdatum', rtLeeg.project.statusDate, '2030-06-01');

// ── 7. Manifest-poort: één stuk JSON-bestand mag niet alle snapshots afschrijven ──────────────
// `loadTauri` deed `JSON.parse` van het manifest BUITEN try/catch, terwijl de per-document-lees
// eronder wél was afgeschermd. De poort is nu een pure functie die `null` teruggeeft op alles wat
// geen manifest is; de aanroeper valt dan terug op een directory-scan van de losse snapshots.
const geldigManifest = JSON.stringify({
  version: 1,
  activeDocumentId: 'doc-1',
  documents: [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc', filePath: null, isDirty: true }],
});
eq('7a geldig manifest komt er ongewijzigd doorheen',
  parseRecoveryManifest(geldigManifest)?.documents.length, 1);
eq('7b afgekapt manifest → null (terugval)', parseRecoveryManifest(geldigManifest.slice(0, 40)), null);
eq('7c lege inhoud → null', parseRecoveryManifest(''), null);
eq('7d geldig JSON zonder documents-lijst → null', parseRecoveryManifest('{"foo":1}'), null);
eq('7e JSON-array i.p.v. object → null', parseRecoveryManifest('[1,2,3]'), null);
eq('7f null-literal → null', parseRecoveryManifest('null'), null);

// ── 8. restoreDocuments: één logisch corrupt document mag het herstel van de rest niet blokkeren ──
// Recovery-robuustheid (docs/TODO.md): een snapshot kan `readIFC` overleven — geen truncated STEP,
// geen structurele fout — en toch inhoudelijk corrupt zijn. Deze fixture bouwt zo'n geval RECHT-
// STREEKS als `RecoveryDocInput` (net als check-document-contract.ts §d): een taak zonder
// `childIds`-lijst, waarop de solve met een TypeError stukloopt. (Tot de cyclusbewaking in
// `applyCpmResult`'s `updateSummary` was de fixture een zelfverwijzende `childIds`, die daar in een
// onbegrensde recursie liep; die kring herstelt nu gewoon.) Vóór deze fix liet zo'n fout de HELE
// `restoreDocuments`-aanroep gooien: ook de gezonde buurdocumenten kwamen dan niet terug.
{
  const cal = { ...createDefaultCalendar(), id: 'cal-corrupt', name: 'Corrupt-kalender' };
  const mkProject = (id: string, name: string) => ({
    id: `proj-${id}`, name, description: '', startDate: '2031-01-01', endDate: '',
    calendarId: cal.id, createdAt: '', modifiedAt: '', author: '', company: '', wbsAutoNumber: true,
  });

  const gezond: RecoveryDocInput = {
    id: 'rec-gezond',
    project: mkProject('rec-gezond', 'Gezond document'),
    calendar: cal,
    tasks: [{
      id: 'task-gezond', name: 'Gewone taak', parentId: null, childIds: [],
      time: createDefaultTaskTime('2031-01-01', 1),
    } as unknown as Task],
    sequences: [], resources: [], assignments: [],
    resourceCalendars: [cal], activityCodeTypes: [], customFieldDefs: [], baselines: [],
    activeBaselineId: null, filePath: '/tmp/rec-gezond.ifc', isDirty: true, datesAsRecorded: false,
  };
  const corrupt: RecoveryDocInput = {
    id: 'rec-corrupt',
    project: mkProject('rec-corrupt', 'Corrupt document'),
    calendar: cal,
    // Ontbrekende childIds: geen enkele lezer (IFC/MSPDI/P6/mpp) produceert dit, maar een
    // logisch beschadigde snapshot (bitrot, een handmatig geknutseld bestand) kan het wél dragen.
    tasks: [{
      id: 'task-corrupt', name: 'Taak zonder kinderlijst', parentId: null, childIds: null,
      time: createDefaultTaskTime('2031-01-01', 1),
    } as unknown as Task],
    sequences: [], resources: [], assignments: [],
    resourceCalendars: [cal], activityCodeTypes: [], customFieldDefs: [], baselines: [],
    activeBaselineId: null, filePath: '/tmp/rec-corrupt.ifc', isDirty: true, datesAsRecorded: false,
  };

  // 8a — het corrupte document als AANGEVRAAGD actief document: restoreDocuments moet uitwijken
  // naar het gezonde document i.p.v. helemaal niets te herstellen.
  S().newProject();
  const result = S().restoreDocuments([corrupt, gezond], 'rec-corrupt');
  eq('8a corrupt document komt terug als overgeslagen', result.skippedIds, ['rec-corrupt']);
  eq('8b het GEZONDE document is toch actief geworden (uitwijk, niet de gevraagde activeId)',
    S().activeDocumentId, 'rec-gezond');
  eq('8c het gezonde document is echt doorgerekend (cpmResult niet null)', S().cpmResult !== null, true);
  eq('8d het corrupte document staat niet meer in de documentregistry',
    S().documents.some(d => d.id === 'rec-corrupt'), false);
  eq('8e het gezonde document staat wél in de registry (als actief, payload=null)',
    S().documents.map(d => d.id), ['rec-gezond']);
  const skipNotice = S().ui.notifications.find(n => n.messageKey === 'notifications.recoveryDocumentsSkipped');
  truthy('8f er is een gebruikerszichtbare melding over het overgeslagen document', !!skipNotice);
  eq('8g de melding telt exact één overgeslagen document', skipNotice?.params?.count, 1);

  // 8h — ALLES corrupt: geen enkel document herstelt, maar de aanroep gooit niet en levert een
  // volledige skip-lijst — dat is precies wat `useRecoveryRestore` gebruikt om `clearRecovery()`
  // over te slaan (de enige kopie van de data blijft op schijf staan).
  S().newProject();
  const alleCorrupt: RecoveryDocInput = { ...corrupt, id: 'rec-corrupt-2', filePath: '/tmp/rec-corrupt-2.ifc' };
  (alleCorrupt.tasks[0] as unknown as Task).id = 'task-corrupt-2';
  const activeIdVoor = S().activeDocumentId;
  const resultAlles = S().restoreDocuments([corrupt, alleCorrupt], 'rec-corrupt');
  eq('8h beide corrupte documenten komen terug als overgeslagen',
    [...resultAlles.skippedIds].sort(), ['rec-corrupt', 'rec-corrupt-2']);
  eq('8i geen enkel document is hersteld: de store blijft op het document van vóór de aanroep staan',
    S().activeDocumentId, activeIdVoor);
  // De harde invariant van de app: er is ALTIJD minstens één document. Een volledig corrupte
  // recovery-set mag de gebruiker dus nooit met een documentloze app achterlaten — de vroege
  // `return` in `restoreDocuments` raakt `s.documents`/`s.activeDocumentId` daarom niet aan.
  truthy('8j er is nog steeds minstens één document', S().documents.length >= 1);
  truthy('8k activeDocumentId wijst naar een bestaand document',
    S().documents.some(d => d.id === S().activeDocumentId));
  const alleSkipNotice = S().ui.notifications.find(n => n.messageKey === 'notifications.recoveryDocumentsSkipped');
  truthy('8l ook bij een volledig corrupte set is er een zichtbare melding', !!alleSkipNotice);
  eq('8m die melding telt beide overgeslagen documenten', alleSkipNotice?.params?.count, 2);

  // 8n — spiegelbeeld van 8a: is het GEVRAAGDE actieve document gezond, dan verandert er niets aan
  // het bestaande gedrag (zelfde activeId, niets overgeslagen, dus de aanroeper mag `clearRecovery()`
  // gewoon draaien). Let op de bewuste grens hiervan: een slapend document wordt bij herstel NIET
  // doorgerekend (net als vóór deze fix), dus een corrupte snapshot die niet als actief document
  // wordt gekozen komt hier als gewone payload binnen. Die valt pas om bij een latere
  // `switchDocument` — een aparte, pre-existente lacune die dit item bewust niet dichttimmert.
  S().newProject();
  const resultGezond = S().restoreDocuments([gezond, corrupt], 'rec-gezond');
  eq('8n gezond gevraagd actief document → niets overgeslagen', resultGezond.skippedIds, []);
  eq('8o de gevraagde activeId is gehonoreerd', S().activeDocumentId, 'rec-gezond');
  eq('8p beide documenten staan in de registry', S().documents.map(d => d.id).sort(),
    ['rec-corrupt', 'rec-gezond']);
}

// ── 9. Schrijf-en-vervang (K4, en de bibliotheek) ───────────────────────────────
// Een nep-fs die een crash midden in `writeTextFile` nabootst: het doel wordt eerst getrunceerd
// (zoals de echte schrijfactie doet) en daarna gooit hij. Via `writeViaTemp` raakt dat alleen het
// halffabricaat; het doelbestand houdt zijn complete oude inhoud.
{
  const files = new Map<string, string>([['doel.json', 'OUD-COMPLEET']]);
  let crashOn: string | null = null;
  let renameFails = false;
  const fs: AtomicWriteFs = {
    writeTextFile: async (path, text) => {
      if (path === crashOn) { files.set(path, text.slice(0, 3)); throw new Error('crash'); }
      files.set(path, text);
    },
    rename: async (from, to) => {
      if (renameFails) throw new Error('rename mislukt');
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    remove: async (path) => { files.delete(path); },
  };

  crashOn = 'doel.json.tmp';
  const crash = await writeViaTemp(fs, 'doel.json', 'doel.json.tmp', 'NIEUW-COMPLEET').then(() => false, () => true);
  truthy('9a een crash tijdens het schrijven komt als fout terug', crash);
  eq('9b het doelbestand is na die crash nog het complete oude bestand', files.get('doel.json'), 'OUD-COMPLEET');

  crashOn = null;
  renameFails = true;
  const renameErr = await writeViaTemp(fs, 'doel.json', 'doel.json.tmp', 'NIEUW-COMPLEET').then(() => false, () => true);
  truthy('9c een mislukte rename komt als fout terug', renameErr);
  truthy('9d en ruimt het halffabricaat op', !files.has('doel.json.tmp'));
  eq('9e het doelbestand bleef ook dan onaangeroerd', files.get('doel.json'), 'OUD-COMPLEET');

  renameFails = false;
  await writeViaTemp(fs, 'doel.json', 'doel.json.tmp', 'NIEUW-COMPLEET');
  eq('9f een geslaagde schrijfactie vervangt het doel', files.get('doel.json'), 'NIEUW-COMPLEET');
  eq('9g en laat geen halffabricaat achter', [...files.keys()], ['doel.json']);

  // Een getrunceerd `ops-library.json` leest `loadTauri` als corrupt ⇒ verse bibliotheek ⇒ de
  // eerstvolgende save overschrijft de hele bibliotheek. Beide appDataDir-schrijvers moeten dus via
  // de primitief lopen, niet via een kale `writeTextFile(`.
  const here = dirname(fileURLToPath(import.meta.url));
  for (const rel of ['services/library/libraryStore.ts', 'services/recovery/recoveryStore.ts']) {
    const src = readFileSync(join(here, '..', '..', 'src', rel), 'utf8');
    truthy(`9h ${rel} schrijft via writeTextFileAtomic, niet via een kale writeTextFile(`,
      src.includes('writeTextFileAtomic(') && !/\bwriteTextFile\(/.test(src));
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  recovery-integrity-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recovery-integrity-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
