import { useAppStore } from '@/state/appStore';
import { buildManualExternalLinkSubmission } from '@/components/dialogs/ExternalLinkDialog';
import type { ExternalLink, Task } from '@/types/task';

/** Minimale bladtaak voor een gestubte `parseExternalSource`-bron; alleen de velden die
 *  `refreshExternalAnchors` leest. Zelfde patroon als `mk` in check-recorded-dates.ts. */
const stubbedSourceTask = (id: string): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 5, parentId: null, childIds: [], resourceIds: [],
  time: {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 5,
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
// Rechtstreeks als fixture gezet: `updateTask` ziet een alleen anders geordende maar gelijke lijst
// terecht als no-op (structurele gelijkheid, `sameValue`) en zou de volgorde dus niet omzetten.
useAppStore.setState((s) => {
  s.tasks.find(task => task.id === taskId)!.externalLinks = [{ id: linkId, ...original }];
});
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

// Knownbug 241: vergelijk het anker ná dezelfde datumnormalisatie als bij het schrijven.
// De eerste/tweede relatieletter kiest de externe kant; de kalender is die van de lokale taak.
for (const ownCalendar of [false, true]) {
  for (const direction of ['predecessor', 'successor'] as const) {
    for (const relType of ['FS', 'SS', 'FF', 'SF'] as const) {
      S().newProject();
      S().setCalendar({
        ...S().calendar, holidays: [], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
      });
      const calendarId = 'cal-anker';
      if (ownCalendar) {
        useAppStore.setState(s => {
          s.calendars.push({
            ...s.calendar, id: calendarId, name: 'Taakkalender', workStartHour: 9, workEndHour: 17,
          });
        });
      }
      const localTaskId = S().addTask({ name: 'Anker opnieuw invoeren', ...(ownCalendar ? { calendarId } : {}) });
      const link: Omit<ExternalLink, 'id'> = {
        direction, relType, anchorDate: '2026-08-24', lagMinutes: 90, sourceMissing: true,
        sourceRef: { projectId: 'bron', taskId: 'bron-taak', taskName: 'Bronnaam' },
      };
      const externalId = S().addExternalLink(localTaskId, link);
      const readLink = () => S().tasks.find(task => task.id === localTaskId)!.externalLinks![0];
      const isFinish = (direction === 'predecessor' ? relType[0] : relType[1]) === 'F';
      const clock = isFinish ? (ownCalendar ? '17:00' : '16:00') : (ownCalendar ? '09:00' : '07:00');
      const label = `241 ${ownCalendar ? 'taakkalender' : 'projectkalender'} ${direction} ${relType}`;
      eq(`${label}: aanmaken bewaart de juiste kant als moment`, readLink().anchorDate, `2026-08-24T${clock}`);
      S().runCPM();
      eq(`${label}: beginstand is doorgerekend`, S().scheduleStale, false);
      const before = S();
      const savedLink = readLink();
      eq(`${label}: dezelfde datum wordt geaccepteerd`, S().updateExternalLink(localTaskId, externalId, link), true);
      eq(`${label}: geen extra undo-event`, S().historyEvents.length, before.historyEvents.length);
      eq(`${label}: planning blijft actueel`, S().scheduleStale, false);
      ok(`${label}: taakreferenties blijven gelijk`, S().tasks === before.tasks);
      eq(`${label}: de opgeslagen link blijft gelijk`, readLink(), savedLink);

      const moved = { ...link, anchorDate: '2026-08-25' };
      ok(`${label}: een andere datum wordt geaccepteerd`, S().updateExternalLink(localTaskId, externalId, moved));
      eq(`${label}: een echte wijziging krijgt één event`, S().historyEvents.length, before.historyEvents.length + 1);
      eq(`${label}: een echte wijziging maakt de planning verouderd`, S().scheduleStale, true);
      eq(`${label}: de nieuwe datum wordt genormaliseerd`, readLink().anchorDate, `2026-08-25T${clock}`);
      S().undo();
      eq(`${label}: undo herstelt de link`, readLink(), savedLink);
      const afterUndo = S();
      S().updateExternalLink(localTaskId, externalId, link);
      ok(`${label}: herinvoer na undo bewaart de geschiedenis`, S().historyEvents === afterUndo.historyEvents);
      S().redo();
      eq(`${label}: redo blijft beschikbaar`, readLink().anchorDate, `2026-08-25T${clock}`);
    }
  }
}

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

// Review #813: *Alle externe relaties vernieuwen* met twee bronpaden en hetzelfde project-id, waarvan er één
// niet te lezen is. De koppeling naar het onleesbare pad houdt haar anker en pad; zonder deze regel gaf de
// terugval op project-id haar het anker en het pad van de andere bron.
{
  S().newProject();
  const viaA = S().addTask({ name: 'Via A' });
  const viaB = S().addTask({ name: 'Via B' });
  const ref = (filePath: string) => ({ projectId: 'gedeelde-bron', taskId: 'Y', filePath });
  S().updateTask(viaA, { externalLinks: [{
    id: 'a', direction: 'predecessor', relType: 'FS', anchorDate: '2020-01-01T16:00', sourceRef: ref('/projecten/A.ifc'), sourceMissing: false,
  }] });
  S().updateTask(viaB, { externalLinks: [{
    id: 'b', direction: 'predecessor', relType: 'FS', anchorDate: '2026-05-15T16:00', sourceRef: ref('/projecten/B.ifc'), sourceMissing: false,
  }] });
  useAppStore.setState({
    parseExternalSource: async (filePath: string) => filePath === '/projecten/A.ifc'
      ? { projectId: 'gedeelde-bron', projectName: 'Bron', filePath, tasks: [stubbedSourceTask('Y')] }
      : null,
  });
  const result = await S().refreshAllExternalAnchors();
  const linkOf = (taskId: string) => S().tasks.find(t => t.id === taskId)!.externalLinks![0];
  eq('#813 alleen bron A is gelezen en ververst', [result.sources, result.refreshed], [1, 1]);
  ok('#813 Via A kreeg het anker uit bron A', linkOf(viaA).anchorDate !== '2020-01-01T16:00');
  eq('#813 Via B houdt haar anker en pad (onleesbare bron)',
    [linkOf(viaB).anchorDate, linkOf(viaB).sourceRef.filePath], ['2026-05-15T16:00', '/projecten/B.ifc']);
}

// Review #813, ronde 3: de koppelingen van NU tellen. Twee koppelingen naar bron A; terwijl de app bron A
// leest, zet de planner de koppeling van Via B naar bron B (zelfde project-id, niet gelezen). Via B houdt haar
// nieuwe pad en anker; zonder deze regel kreeg ze het anker en het pad van bron A.
{
  S().newProject();
  const viaA = S().addTask({ name: 'Via A' });
  const viaB = S().addTask({ name: 'Via B' });
  const ref = (filePath: string) => ({ projectId: 'gedeelde-bron', taskId: 'Y', filePath });
  const link = (id: string, filePath: string, anchorDate: string) => ({
    id, direction: 'predecessor' as const, relType: 'FS' as const, anchorDate, sourceRef: ref(filePath), sourceMissing: false,
  });
  S().updateTask(viaA, { externalLinks: [link('a', '/projecten/A.ifc', '2020-01-01T16:00')] });
  S().updateTask(viaB, { externalLinks: [link('b', '/projecten/A.ifc', '2020-01-01T16:00')] });
  const reads: string[] = [];
  useAppStore.setState({
    parseExternalSource: async (filePath: string) => {
      reads.push(filePath);
      const { id: _id, ...fields } = link('b', '/projecten/B.ifc', '2026-05-15T16:00');
      S().updateExternalLink(viaB, 'b', fields);
      return { projectId: 'gedeelde-bron', projectName: 'Bron', filePath, tasks: [stubbedSourceTask('Y')] };
    },
  });
  const result = await S().refreshAllExternalAnchors();
  const linkOf = (taskId: string) => S().tasks.find(t => t.id === taskId)!.externalLinks![0];
  eq('#813 ronde 3: alleen bron A is gelezen', reads, ['/projecten/A.ifc']);
  eq('#813 ronde 3: alleen Via A is ververst', [result.sources, result.refreshed], [1, 1]);
  ok('#813 ronde 3: Via A kreeg het anker uit bron A', linkOf(viaA).anchorDate !== '2020-01-01T16:00');
  eq('#813 ronde 3: Via B houdt haar nieuwe pad en anker',
    [linkOf(viaB).anchorDate, linkOf(viaB).sourceRef.filePath], ['2026-05-15T16:00', '/projecten/B.ifc']);
}

if (diffs.length) {
  console.error(`XX external-link-edit: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK external-link-edit: ${checks}/${checks} checks groen`);
