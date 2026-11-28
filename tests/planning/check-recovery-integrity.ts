import { useAppStore } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError, type IfcParseErrorReason } from '@/services/ifc/ifcErrors';
import { parseRecoveryManifest, RecoveryManifestError } from '@/services/recovery/recoveryStore';
import type { RecoveryDocInput } from '@/state/documentContract';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import { writeViaTemp, type AtomicWriteFs } from '@/services/fileAccess/atomicWrite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

S().newProject();
const ids: string[] = [];
for (let i = 1; i <= 10; i++) ids.push(S().addTask({ name: `Taak ${i}` }));
for (let i = 0; i < 9; i++) {
  S().addSequence({ predecessorId: ids[i], successorId: ids[i + 1], type: 'FINISH_START', lagDays: 0 });
}
S().runCPM();
const VOLLEDIG = writeIFC(buildWriteIFCInput(S(), 'planOnly'));

const rt = readIFC(VOLLEDIG);
eq('1a volledige snapshot: 10 taken', rt.tasks.length, 10);
eq('1b volledige snapshot: 9 relaties', rt.sequences.length, 9);
eq('1c volledige snapshot: projectnaam behouden', rt.project.name, S().project.name);

eq('2a BOM vóór de kop parst gewoon', readIFC(`﻿${VOLLEDIG}`).tasks.length, 10);
eq('2b witruimte/regeleindes vóór de kop parsen gewoon', readIFC(`\n\n  ${VOLLEDIG}`).tasks.length, 10);
eq('2c kleine letters in kop/slot parsen gewoon',
  readIFC(VOLLEDIG.replace('ISO-10303-21;', 'iso-10303-21;').replace('END-ISO-10303-21;', 'end-iso-10303-21;')).tasks.length,
  10);

for (const pct of [70, 80, 90]) {
  const afgekapt = VOLLEDIG.slice(0, Math.floor(VOLLEDIG.length * (pct / 100)));
  eistFout(`3a afgekapt op ${pct}% gooit IfcParseError('truncated')`, afgekapt, 'truncated');
  truthy(`3b afgekapt op ${pct}%: kop nog aanwezig, sluitmarkering weg (dus alleen hierop te zien)`,
    afgekapt.startsWith('ISO-10303-21;') && !afgekapt.includes('END-ISO-10303-21;'));
}
{
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

eistFout('4a lege string', '', 'not-step');
eistFout('4b alleen witruimte', '   \n\t  ', 'not-step');
eistFout('4c gewone tekst', 'dit is helemaal geen IFC-bestand', 'not-step');
eistFout('4d JSON', '{"foo":1}', 'not-step');
eistFout('4e HTML-foutpagina (typische mislukte download)', '<!doctype html><html><body>404</body></html>', 'not-step');

eistFout('5a alleen de kop', 'ISO-10303-21;\n', 'truncated');
eistFout('5b kop + halve header, geen DATA-sectie', 'ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((', 'truncated');
eistFout('5c volledig bestand met alleen het slot eraf',
  VOLLEDIG.slice(0, VOLLEDIG.lastIndexOf('END-ISO-10303-21;')), 'truncated');

S().newProject();
S().addResource({ name: 'Ploeg A', type: 'LABOR', description: '', maxUnits: 2 });
S().setStatusDate('2030-06-01');
const LEEG_MAAR_ECHT = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
const rtLeeg = readIFC(LEEG_MAAR_ECHT);
eq('6a leeg-maar-geldig project (0 taken) parst gewoon door', rtLeeg.tasks.length, 0);
eq('6b … met zijn resources', rtLeeg.resources.length, 1);
eq('6c … en zijn statusdatum', rtLeeg.project.statusDate, '2030-06-01');

const geldigManifest = JSON.stringify({
  version: 1,
  activeDocumentId: 'doc-1',
  documents: [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc', filePath: null, isDirty: true }],
});
eq('7a geldig manifest komt er ongewijzigd doorheen',
  parseRecoveryManifest(geldigManifest)?.documents.length, 1);
eq('7b afgekapt manifest → null (terugval)', parseRecoveryManifest(geldigManifest.slice(0, 40)), null);
eq('7c lege inhoud → null', parseRecoveryManifest(''), null);
for (const [label, raw] of [
  ['7d object zonder versie/documents', '{"foo":1}'],
  ['7e array', '[1,2,3]'],
  ['7f null', 'null'],
  ['7g verkeerde documents-vorm', '{"version":5,"documents":{}}'],
  ['7h ongeldige documentregel', '{"version":5,"documents":[null]}'],
]) {
  let refused = false;
  try { parseRecoveryManifest(raw); } catch (error) { refused = error instanceof RecoveryManifestError; }
  eq(label + ' → expliciete manifestweigering', refused, true);
}

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
    tasks: [{
      id: 'task-corrupt', name: 'Taak zonder kinderlijst', parentId: null, childIds: null,
      time: createDefaultTaskTime('2031-01-01', 1),
    } as unknown as Task],
    sequences: [], resources: [], assignments: [],
    resourceCalendars: [cal], activityCodeTypes: [], customFieldDefs: [], baselines: [],
    activeBaselineId: null, filePath: '/tmp/rec-corrupt.ifc', isDirty: true, datesAsRecorded: false,
  };

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

  S().newProject();
  const alleCorrupt: RecoveryDocInput = { ...corrupt, id: 'rec-corrupt-2', filePath: '/tmp/rec-corrupt-2.ifc' };
  (alleCorrupt.tasks[0] as unknown as Task).id = 'task-corrupt-2';
  const activeIdVoor = S().activeDocumentId;
  const resultAlles = S().restoreDocuments([corrupt, alleCorrupt], 'rec-corrupt');
  eq('8h beide corrupte documenten komen terug als overgeslagen',
    [...resultAlles.skippedIds].sort(), ['rec-corrupt', 'rec-corrupt-2']);
  eq('8i geen enkel document is hersteld: de store blijft op het document van vóór de aanroep staan',
    S().activeDocumentId, activeIdVoor);
  truthy('8j er is nog steeds minstens één document', S().documents.length >= 1);
  truthy('8k activeDocumentId wijst naar een bestaand document',
    S().documents.some(d => d.id === S().activeDocumentId));
  const alleSkipNotice = S().ui.notifications.find(n => n.messageKey === 'notifications.recoveryDocumentsSkipped');
  truthy('8l ook bij een volledig corrupte set is er een zichtbare melding', !!alleSkipNotice);
  eq('8m die melding telt beide overgeslagen documenten', alleSkipNotice?.params?.count, 2);

  S().newProject();
  const resultGezond = S().restoreDocuments([gezond, corrupt], 'rec-gezond');
  eq('8n gezond gevraagd actief document → niets overgeslagen', resultGezond.skippedIds, []);
  eq('8o de gevraagde activeId is gehonoreerd', S().activeDocumentId, 'rec-gezond');
  eq('8p beide documenten staan in de registry', S().documents.map(d => d.id).sort(),
    ['rec-corrupt', 'rec-gezond']);
}

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

  const here = dirname(fileURLToPath(import.meta.url));
  for (const rel of ['services/library/libraryStore.ts', 'services/recovery/recoveryStore.ts']) {
    const src = readFileSync(join(here, '..', '..', 'src', rel), 'utf8');
    truthy(`9h ${rel} schrijft via writeTextFileAtomic, niet via een kale writeTextFile(`,
      src.includes('writeTextFileAtomic(') && !/\bwriteTextFile\(/.test(src));
  }
}

if (diffs.length === 0) {
  console.log(`OK  recovery-integrity-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recovery-integrity-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
