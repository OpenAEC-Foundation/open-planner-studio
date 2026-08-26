import { useAppStore } from '@/state/appStore';
import type { ExternalLink } from '@/types/task';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, value: boolean): void { eq(label, value, true); }

S().newProject();
const taskId = S().addTask({ name: 'Lokale taak' });
const original: Omit<ExternalLink, 'id'> = {
  direction: 'predecessor', relType: 'FS', lagDays: 2,
  anchorDate: '2026-08-24T08:00', sourceMissing: false,
  sourceRef: {
    projectId: 'west', projectName: 'Project West', taskId: 'bron-1', taskName: 'Fundering',
    filePath: '/projecten/west.ops',
  },
};
const linkId = S().addExternalLink(taskId, original);
const current = () => S().tasks.find(task => task.id === taskId)?.externalLinks?.find(link => link.id === linkId);
// Geimporteerde links hebben niet noodzakelijk dezelfde objectsleutelvolgorde als addExternalLink.
S().updateTask(taskId, { externalLinks: [{ id: linkId, ...original }] });
const beforeGuards = S().historyEvents.length;

eq('verkeerde taak/link-combinatie wordt geweigerd', S().updateExternalLink(taskId, 'bestaat-niet', original), false);
eq('geweigerde update maakt geen history-event', S().historyEvents.length, beforeGuards);
eq('exacte no-op wordt als geldige bestaande link herkend', S().updateExternalLink(taskId, linkId, original), true);
eq('exacte no-op maakt geen history-event', S().historyEvents.length, beforeGuards);

const edited: Omit<ExternalLink, 'id'> = {
  direction: 'predecessor', relType: 'SS', lagMinutes: 90,
  anchorDate: '2026-08-24T09:15', sourceMissing: true,
  sourceRef: {
    projectId: 'west', projectName: 'Project West', taskId: 'bron-1', taskName: 'Fundering gewijzigd',
    filePath: '/projecten/west.ops',
  },
};
ok('bestaande externe link kan worden vervangen', S().updateExternalLink(taskId, linkId, edited));
eq('bewerking bewaart de link-id en alle aangeleverde velden', current(), { ...edited, id: linkId });
eq('bewerking kost precies één history-event', S().historyEvents.length, beforeGuards + 1);
eq('bewerking maakt de planning stale', S().scheduleStale, true);

S().undo();
eq('één undo herstelt de volledige oude externe link', current(), { id: linkId, ...original });

if (diffs.length) {
  console.error(`XX external-link-edit: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK external-link-edit: ${checks}/${checks} checks groen`);
