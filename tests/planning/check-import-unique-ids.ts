import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { ensureUniqueImportIds } from '@/services/importNormalize';

const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

S().newProject();
S().addTask({ name: 'Eerste' });
S().addTask({ name: 'Tweede' });
S().addTask({ name: 'Derde' });
const clean = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));

const same = ensureUniqueImportIds(clean);
eq('geen dubbelen: zelfde resultaat', same.result === clean, true);
eq('geen dubbelen: 0 hernoemd', same.renamed, 0);

const dupId = clean.tasks[0].id;
const broken = {
  ...clean,
  tasks: clean.tasks.map((t) => ({ ...t, id: dupId })),
  resourceCalendars: [{ ...clean.calendar, name: 'Kopie' }],
};
const fixed = ensureUniqueImportIds(broken);
eq('taken: drie verschillende id\'s', new Set(fixed.result.tasks.map((t) => t.id)).size, 3);
eq('taken: het eerste exemplaar houdt zijn id', fixed.result.tasks[0].id, dupId);
eq('kalender botst niet met de projectkalender', fixed.result.resourceCalendars?.[0].id !== clean.calendar.id, true);
eq('aantal hernoemd', fixed.renamed, 3);
eq('invoer niet gemuteerd', broken.tasks.map((t) => t.id), [dupId, dupId, dupId]);

{
  const parentId = clean.tasks[0].id;
  const kid = clean.tasks[1].id;
  const tree = {
    ...clean,
    tasks: [
      { ...clean.tasks[0], childIds: [kid, kid] },
      { ...clean.tasks[1], parentId },
      { ...clean.tasks[2], id: kid, parentId },
    ],
  };
  const t = ensureUniqueImportIds(tree).result.tasks;
  const ids = t.map((x) => x.id);
  eq('boom: ouder noemt beide kinderen', [...t[0].childIds].sort(), [ids[1], ids[2]].sort());
  eq('boom: beide kinderen wijzen naar de ouder', [t[1].parentId, t[2].parentId], [parentId, parentId]);
}

S().applyLoadedProject(broken, { filePath: null });
eq('store: drie taken met unieke id\'s', new Set(S().tasks.map((t) => t.id)).size, 3);
eq('store: melding gegeven', S().ui.notifications.some((n) => n.messageKey === 'notifications.duplicateIdsRenamed'), true);

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`XX  import-unique-ids: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`OK  import-unique-ids: alle checks groen (${checks})`);
