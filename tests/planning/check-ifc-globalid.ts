// Audit 2026-09-26 — IFC-GlobalIds (eigenaarsbesluit 2026-09-28).
//
// `ifcGuid` was een 32-bits hash van het interne id, en geen conforme IFC-GUID. Nu:
//  - een object zonder bewaard GlobalId krijgt `ifcGuid128(id)`: 128 bits, 22 tekens uit het
//    IFC-alfabet, eerste teken 0–3; deterministisch, dus bij elk opslaan gelijk;
//  - een taak of project uit een ingelezen IFC houdt precies zijn GlobalId uit dat bestand
//    (`ImportResult.ifcGlobalIds` → documentveld → writer), ook als dat de oude hash was of een
//    `#dup`-variant, zodat externe koppelingen niet breken;
//  - een nieuw object krijgt nooit een GlobalId dat een bewaard object claimt.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { writeIFC, ifcGuid, ifcGuid128 } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const CONFORM = /^[0-3][0-9A-Za-z_$]{21}$/;
/** GlobalId per IFCTASK-naam, rechtstreeks uit de STEP-tekst (onafhankelijk van de lezer). */
function taskGuidsByName(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/=IFCTASK\('([^']*)',#\d+,'([^']*)'/g)) out[m[2]] = m[1];
  return out;
}
const projectGuid = (text: string) => /=IFCPROJECT\('([^']*)'/.exec(text)?.[1];

// 1. Vorm en spreiding.
const seen = new Set<string>();
let nonConform = 0;
for (let i = 0; i < 100_000; i++) {
  const g = ifcGuid128(`task-${i}`);
  if (!CONFORM.test(g)) nonConform++;
  seen.add(g);
}
eq('ifcGuid128: altijd conform (22 tekens, eerste 0–3)', nonConform, 0);
eq('ifcGuid128: 100 000 seeds, geen botsing', seen.size, 100_000);
eq('ifcGuid128: deterministisch', ifcGuid128('abc'), ifcGuid128('abc'));
eq('ifcGuid128: alle vier eerste tekens komen voor', new Set([...seen].map((g) => g[0])).size, 4);

// 2. Nieuw project: conforme GlobalIds, gelijk bij elk opslaan.
S().newProject();
const a = S().addTask({ name: 'A' });
S().addTask({ name: 'B' });
const first = writeIFC(buildWriteIFCInput(S()));
const second = writeIFC(buildWriteIFCInput(S()));
eq('nieuwe taak: GlobalId = ifcGuid128(id)', taskGuidsByName(first).A, ifcGuid128(a));
eq('nieuwe taken: conform', Object.values(taskGuidsByName(first)).every((g) => CONFORM.test(g)), true);
eq('twee keer opslaan zonder heropenen: zelfde GlobalIds', taskGuidsByName(second), taskGuidsByName(first));
eq('project: conform GlobalId', CONFORM.test(projectGuid(first) ?? ''), true);

// 3. Openen en opslaan via de store: taken én project houden hun GlobalId, over twee rondes.
S().applyLoadedProject(readIFC(first), { filePath: null });
const round1 = writeIFC(buildWriteIFCInput(S()));
S().applyLoadedProject(readIFC(round1), { filePath: null });
const round2 = writeIFC(buildWriteIFCInput(S()));
eq('ronde 1: taak-GlobalIds ongewijzigd', taskGuidsByName(round1), taskGuidsByName(first));
eq('ronde 2: taak-GlobalIds ongewijzigd', taskGuidsByName(round2), taskGuidsByName(first));
eq('project-GlobalId stabiel over openen en opslaan', [projectGuid(round1), projectGuid(round2)], [projectGuid(first), projectGuid(first)]);

// 4. Een bestaand bestand met oude (niet-conforme) GlobalIds: die blijven precies staan; een
//    nieuwe taak ernaast krijgt een conform GlobalId.
const oldGuid = ifcGuid('legacy-task-id');
const legacyFile = first.replace(`'${taskGuidsByName(first).A}'`, `'${oldGuid}'`);
S().applyLoadedProject(readIFC(legacyFile), { filePath: null });
const added = S().addTask({ name: 'C' });
const resaved = writeIFC(buildWriteIFCInput(S()));
eq('bestaande taak houdt haar oude GlobalId', taskGuidsByName(resaved).A, oldGuid);
eq('nieuwe taak ernaast: ifcGuid128', taskGuidsByName(resaved).C, ifcGuid128(added));

// 5. Een nieuw object dat toevallig het GlobalId van een bewaard object zou krijgen, wijkt uit;
//    het bewaarde object houdt het, ook als het later in het bestand staat.
S().newProject();
const fresh = S().addTask({ name: 'Nieuw' });
const kept = S().addTask({ name: 'Bewaard' });
const clash = writeIFC({ ...buildWriteIFCInput(S()), ifcGlobalIds: { [kept]: ifcGuid128(fresh) } });
const guids = taskGuidsByName(clash);
eq('bewaard object houdt zijn GlobalId', guids.Bewaard, ifcGuid128(fresh));
eq('nieuw object wijkt uit, conform', guids.Nieuw !== guids.Bewaard && CONFORM.test(guids.Nieuw), true);

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`XX  ifc-globalid: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`OK  ifc-globalid: alle checks groen (${checks})`);
