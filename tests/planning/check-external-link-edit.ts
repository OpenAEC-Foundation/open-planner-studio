import { useAppStore } from '@/state/appStore';
import { buildManualExternalLinkSubmission } from '@/components/dialogs/ExternalLinkDialog';
import type { ExternalLink, Task } from '@/types/task';

/** Minimale bladtaak voor een gestubte `parseExternalSource`-bron; alleen de velden die
 *  `refreshExternalAnchors` leest. Zelfde patroon als `mk` in check-recorded-dates.ts. */
const stubbedSourceTask = (id: string): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 5, parentId: null, childIds: [], resourceIds: [],
  time: {
    durationType: 'WORKTIME', scheduleDuration: 5,
    scheduleStart: '2026-05-04', scheduleFinish: '2026-05-08',
    earlyStart: '2026-05-04', earlyFinish: '2026-05-08',
    lateStart: '2026-05-04', lateFinish: '2026-05-08',
    freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
});

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

const dialogNoOp = buildManualExternalLinkSubmission({
  existing: { id: linkId, ...original }, direction: original.direction, relType: original.relType,
  lag: { lagDays: original.lagDays }, projectId: original.sourceRef.projectId,
  taskId: original.sourceRef.taskId, taskName: original.sourceRef.taskName ?? '',
  anchor: '2026-08-24', anchorTouched: false,
});
eq('dialooghelper bewaart gezonde bestandsbron bij onaangeraakt opslaan', dialogNoOp, {
  direction: original.direction, relType: original.relType, lagDays: original.lagDays,
  anchorDate: original.anchorDate, sourceRef: original.sourceRef, sourceMissing: original.sourceMissing,
});
eq('dialoog-no-op wordt door de echte store geaccepteerd', S().updateExternalLink(taskId, linkId, dialogNoOp), true);
eq('dialoog-no-op maakt geen history en geen nieuwe stale-overgang', S().historyEvents.length, beforeGuards);

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

// FIX 8c (eindreview, onderzoek): `normalizeExternalSourcePath` geeft null voor zowel "geen pad"
// als "een niet-lexicaal-absoluut (relatief) pad". `OPS_ExternalLink` schrijft `externalLinks`
// ongefilterd als één JSON-blob weg (ifcPsets.ts) en leest 'm ook ongevalideerd terug — een van
// elders aangeleverd of met de hand bewerkt IFC-bestand kan dus een relatief `sourceRef.filePath`
// bevatten. Zo'n pad kan de app nooit betrouwbaar herlezen (geen vaste "relatief-ten-opzichte-
// van"-map) en blijft dus terecht overgeslagen als leesbare bron — maar telde voorheen NERGENS
// mee: niet in `refreshed`, niet in `missing`. Hij telt nu mee in `missing`.
{
  S().newProject();
  const relativeTaskId = S().addTask({ name: 'Link met relatief pad' });
  S().updateTask(relativeTaskId, {
    externalLinks: [{
      id: 'rel-link', direction: 'predecessor', relType: 'FS', anchorDate: '2020-01-01',
      sourceRef: { projectId: 'relatieve-bron', taskId: 'X', filePath: 'gedeeld/west.ops' },
      sourceMissing: false,
    }],
  });
  const absoluteTaskId = S().addTask({ name: 'Link met absoluut pad' });
  S().updateTask(absoluteTaskId, {
    externalLinks: [{
      id: 'abs-link', direction: 'predecessor', relType: 'FS', anchorDate: '2020-01-01',
      sourceRef: { projectId: 'absolute-bron', taskId: 'Y', filePath: '/echte/bron.ops' },
      sourceMissing: false,
    }],
  });
  useAppStore.setState({
    parseExternalSource: async (filePath: string) => ({
      projectId: 'absolute-bron', projectName: 'Bron', filePath, tasks: [stubbedSourceTask('Y')],
    }),
  });
  const relativePathResult = await S().refreshAllExternalAnchors();
  eq('een relatief bronpad wordt niet als leesbare bron verzameld (kan niet betrouwbaar herlezen)',
    relativePathResult.sources, 1);
  eq('diezelfde link telt nu mee als "ontbrekend" i.p.v. nergens', relativePathResult.missing, 1);
  eq('de wél absolute bron is gewoon ververst', relativePathResult.refreshed, 1);
}

if (diffs.length) {
  console.error(`XX external-link-edit: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK external-link-edit: ${checks}/${checks} checks groen`);
