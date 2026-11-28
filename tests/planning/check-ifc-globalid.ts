import { useAppStore } from '@/state/appStore';
import { writeIFC, ifcGuid, ifcGuid128, ifcObjectSeed } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createSnapshot, documentDataChanged, migrateSnapshot } from '@/state/snapshot';

const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const CONFORM = /^[0-3][0-9A-Za-z_$]{21}$/;
function taskGuidsByName(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/=IFCTASK\('([^']*)',#\d+,'([^']*)'/g)) out[m[2]] = m[1];
  return out;
}
const projectGuid = (text: string) => /=IFCPROJECT\('([^']*)'/.exec(text)?.[1];

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

S().newProject();
const a = S().addTask({ name: 'A' });
S().addTask({ name: 'B' });
const first = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
const second = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
eq('nieuwe taak: GlobalId = ifcGuid128(id)', taskGuidsByName(first).A, ifcGuid128(ifcObjectSeed('task', a)));
eq('nieuwe taken: conform', Object.values(taskGuidsByName(first)).every((g) => CONFORM.test(g)), true);
eq('twee keer opslaan zonder heropenen: zelfde GlobalIds', taskGuidsByName(second), taskGuidsByName(first));
eq('project: conform GlobalId', CONFORM.test(projectGuid(first) ?? ''), true);

S().applyLoadedProject(readIFC(first), { filePath: null });
const round1 = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
S().applyLoadedProject(readIFC(round1), { filePath: null });
const round2 = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
eq('ronde 1: taak-GlobalIds ongewijzigd', taskGuidsByName(round1), taskGuidsByName(first));
eq('ronde 2: taak-GlobalIds ongewijzigd', taskGuidsByName(round2), taskGuidsByName(first));
eq('project-GlobalId stabiel over openen en opslaan', [projectGuid(round1), projectGuid(round2)], [projectGuid(first), projectGuid(first)]);

const oldGuid = ifcGuid('legacy-task-id');
const legacyFile = first.replace(`'${taskGuidsByName(first).A}'`, `'${oldGuid}'`);
S().applyLoadedProject(readIFC(legacyFile), { filePath: null });
const added = S().addTask({ name: 'C' });
const resaved = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
eq('bestaande taak houdt haar oude GlobalId', taskGuidsByName(resaved).A, oldGuid);
eq('nieuwe taak ernaast: ifcGuid128', taskGuidsByName(resaved).C, ifcGuid128(ifcObjectSeed('task', added)));

S().newProject();
const fresh = S().addTask({ name: 'Nieuw' });
const kept = S().addTask({ name: 'Bewaard' });
const clash = writeIFC({ ...buildWriteIFCInput(S(), 'planOnly'), ifcGlobalIds: { [ifcObjectSeed('task', kept)]: ifcGuid128(ifcObjectSeed('task', fresh)) } });
const guids = taskGuidsByName(clash);
eq('bewaard object houdt zijn GlobalId', guids.Bewaard, ifcGuid128(ifcObjectSeed('task', fresh)));
eq('nieuw object wijkt uit, conform', guids.Nieuw !== guids.Bewaard && CONFORM.test(guids.Nieuw), true);

const GUID = /#\d+=(IFC\w+)\('([0-9A-Za-z_$]{22})'/g;
const allGuids = (text: string) => [...text.matchAll(GUID)].map((m) => m[2]);
const guidsOfType = (text: string, pattern: RegExp) =>
  [...text.matchAll(GUID)].filter((m) => pattern.test(m[1])).map((m) => m[2]).sort();
const RES = /^IFC\w*RESOURCE$/;

function fixture() {
  S().newProject();
  const t1 = S().addTask({ name: 'Eerste' });
  const t2 = S().addTask({ name: 'Tweede' });
  S().addSequence({ predecessorId: t1, successorId: t2, type: 'FINISH_START', lagDays: 0 });
  const calId = S().addCalendar({ ...S().calendar, name: 'Ploegkalender' });
  const r1 = S().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1, calendarId: calId });
  const r2 = S().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(t1, r1, 1);
  S().assignResource(t1, r2, 1);
  return { t1, t2, calId, r1, r2 };
}

{
  const f = fixture();
  const seqId = S().sequences[0].id;
  let json = JSON.stringify(buildWriteIFCInput(S(), 'planOnly'));
  for (const id of [f.t1, seqId, f.calId, S().project.id]) json = json.split(`"${id}"`).join('"1234"');
  const text = writeIFC(JSON.parse(json));
  const guids = allGuids(text);
  eq('XER-id-botsing: elk GlobalId in het bestand uniek', guids.length - new Set(guids).size, 0);
}

{
  fixture();
  const r0 = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const p1 = readIFC(r0);
  const r1 = writeIFC(p1);
  const p2 = readIFC(r1);
  const r2 = writeIFC(p2);
  for (const [label, pattern] of [['resources', RES], ['kalenders', /^IFCWORKCALENDAR$/], ['relaties', /^IFCRELSEQUENCE$/]] as const) {
    eq(`${label}: GlobalIds gelijk over drie rondes`, [guidsOfType(r1, pattern), guidsOfType(r2, pattern)], [guidsOfType(r0, pattern), guidsOfType(r0, pattern)]);
  }
  eq('resources: zelfde id bij elk openen', p2.resources.map((r) => r.id), p1.resources.map((r) => r.id));
  eq('kalenders: zelfde id bij elk openen', (p2.resourceCalendars ?? []).map((c) => c.id), (p1.resourceCalendars ?? []).map((c) => c.id));
  eq('relaties: zelfde id bij elk openen', p2.sequences.map((q) => q.id), p1.sequences.map((q) => q.id));
  eq('toewijzingen wijzen naar dezelfde resources', p2.assignments.map((a) => a.resourceId).sort(), p1.assignments.map((a) => a.resourceId).sort());
  eq('resourcekalender blijft gekoppeld', p2.resources.find((r) => r.name === 'Timmerman')?.calendarId, p1.resources.find((r) => r.name === 'Timmerman')?.calendarId);
}

{
  const f = fixture();
  const input = buildWriteIFCInput(S(), 'planOnly');
  const contourTask = { ...input.tasks.find((t) => t.id === f.t1)!, timephasedContours: [{ resourceUid: null, resourceId: f.r1, periods: [{ afterMinutes: 0, minutes: 480, workMinutes: 480, kind: 'remaining' as const }] }] };
  const written = writeIFC({ ...input, tasks: input.tasks.map((t) => (t.id === f.t1 ? contourTask : t)) });
  const legacyGuid = ifcGuid(f.r1);
  const legacy = written.split(`'${ifcGuid128(ifcObjectSeed('res', f.r1))}'`).join(`'${legacyGuid}'`)
    .split(ifcGuid128(ifcObjectSeed('res', f.r1))).join(legacyGuid);
  const p1 = readIFC(legacy);
  const res1 = p1.resources.find((r) => r.name === 'Timmerman')!;
  eq('oud bestand: contour wijst na openen naar de resource', p1.tasks.find((t) => t.name === 'Eerste')?.timephasedContours?.[0]?.resourceId, res1.id);
  const r1 = writeIFC(p1);
  eq('oud bestand: resource houdt haar oude GlobalId', guidsOfType(r1, RES).includes(legacyGuid), true);
  const p2 = readIFC(r1);
  const res2 = p2.resources.find((r) => r.name === 'Timmerman')!;
  eq('oud bestand, tweede keer openen: contour wijst nog naar de resource', p2.tasks.find((t) => t.name === 'Eerste')?.timephasedContours?.[0]?.resourceId, res2.id);
}

{
  const f = fixture();
  const written = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const dupe = written.split(ifcGuid128(ifcObjectSeed('res', f.r2))).join(ifcGuid128(ifcObjectSeed('res', f.r1)));
  const p = readIFC(dupe);
  eq('dubbel GlobalId: twee resources met elk een eigen id', new Set(p.resources.map((r) => r.id)).size, 2);
  const out = guidsOfType(writeIFC(p), RES);
  eq('dubbel GlobalId: bij opslaan twee verschillende GlobalIds', new Set(out).size, 2);
}

{
  S().newProject();
  S().addTask({ name: 'Eén' });
  const a1 = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const a2 = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  S().newProject();
  S().addTask({ name: 'Eén' });
  const b = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const shared = allGuids(a1).filter((g) => new Set(allGuids(b)).has(g));
  eq('twee projecten: geen gedeelde GlobalIds', shared.length, 0);
  eq('zelfde project twee keer opgeslagen: identieke GlobalIds', allGuids(a2), allGuids(a1));
  const projectCal = (text: string) => guidsOfType(text, /^IFCWORKCALENDAR$/)[0];
  eq('heropend: projectkalender houdt zijn GlobalId', projectCal(writeIFC(readIFC(a1))), projectCal(a1));
}

{
  S().newProject();
  S().addTask({ name: 'Eén' });
  const text = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const wp = guidsOfType(text, /^IFCWORKPLAN$/)[0];
  const ws = guidsOfType(text, /^IFCWORKSCHEDULE$/)[0];
  const foreignWp = '3' + wp.slice(1);
  const foreignWs = '3' + ws.slice(1);
  const foreign = text.split(`'${wp}'`).join(`'${foreignWp}'`).split(`'${ws}'`).join(`'${foreignWs}'`);
  const again = writeIFC(readIFC(foreign));
  eq('werkplan houdt zijn GlobalId', guidsOfType(again, /^IFCWORKPLAN$/), [foreignWp]);
  eq('werkschema houdt zijn GlobalId', guidsOfType(again, /^IFCWORKSCHEDULE$/), [foreignWs]);
}

{
  S().newProject();
  const taskId = S().addTask({ name: 'GUID-proef' });
  const key = ifcObjectSeed('task', taskId);
  const originalGuid = ifcGuid128('editor-task-original');
  const editedGuid = ifcGuid128('editor-task-edited');
  const source = writeIFC({ ...buildWriteIFCInput(S(), 'planOnly'), ifcGlobalIds: { [key]: originalGuid } });
  S().applyLoadedProject(readIFC(source), { recompute: true });
  const savedBefore = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  eq('editor: opslag vóór bewerking bewaart het ingelezen taak-GUID', taskGuidsByName(savedBefore)['GUID-proef'], originalGuid);
  const editedText = savedBefore.replace(`=IFCTASK('${originalGuid}'`, `=IFCTASK('${editedGuid}'`);
  eq('editor: IFCTASK-GlobalId werkelijk gewijzigd in de tekst', taskGuidsByName(editedText)['GUID-proef'], editedGuid);
  const parsedEdit = readIFC(editedText);
  eq('editor: OPS_TaskIdentity blijft gelijk ondanks gewijzigd GlobalId', parsedEdit.tasks.map(task => task.id), [taskId]);
  const before = createSnapshot(S());
  eq('editor: alleen een GUID-wijziging telt als projectdata', documentDataChanged(before, {
    ...before, ifcGlobalIds: { ...before.ifcGlobalIds, [key]: editedGuid },
  }), true);
  eq('snapshot-migratie: ontbrekende GUID-kaart wordt null',
    migrateSnapshot({ ...before, ifcGlobalIds: undefined } as unknown as typeof before).ifcGlobalIds, null);

  S().applyProjectEdit(parsedEdit);
  eq('editor apply: GUID-kaart gewijzigd', S().ifcGlobalIds?.[key], editedGuid);
  eq('editor apply: opslag schrijft gewijzigd taak-GUID', taskGuidsByName(writeIFC(buildWriteIFCInput(S(), 'planOnly')))['GUID-proef'], editedGuid);
  S().undo();
  eq('editor undo: GUID-kaart hersteld', S().ifcGlobalIds?.[key], originalGuid);
  eq('editor undo: opslag schrijft oorspronkelijk taak-GUID', taskGuidsByName(writeIFC(buildWriteIFCInput(S(), 'planOnly')))['GUID-proef'], originalGuid);
  S().redo();
  eq('editor redo: GUID-kaart opnieuw gewijzigd', S().ifcGlobalIds?.[key], editedGuid);
  eq('editor redo: opslag schrijft opnieuw gewijzigd taak-GUID', taskGuidsByName(writeIFC(buildWriteIFCInput(S(), 'planOnly')))['GUID-proef'], editedGuid);
}

{
  S().newProject();
  const projectA = 'editor-project-a';
  const projectB = 'editor-project-b';
  S().setProject({ id: projectA, name: 'Projectidentiteit' });
  S().addTask({ name: 'Ankertaak' });
  const anchors = [['proj', 'IFCPROJECT'], ['wp', 'IFCWORKPLAN'], ['ws', 'IFCWORKSCHEDULE']] as const;
  const originalGuids = Object.fromEntries(anchors.map(([kind]) =>
    [ifcObjectSeed(kind, projectA), ifcGuid128(`editor-${kind}-original`)]));
  const source = writeIFC({ ...buildWriteIFCInput(S(), 'planOnly'), ifcGlobalIds: originalGuids });
  S().applyLoadedProject(readIFC(source), { recompute: true });
  const savedBefore = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const originalTaskGuids = taskGuidsByName(savedBefore);
  let editedText = savedBefore.replace(
    `IFCPROPERTYSINGLEVALUE('InternalProjectId',$,IFCTEXT('${projectA}')`,
    `IFCPROPERTYSINGLEVALUE('InternalProjectId',$,IFCTEXT('${projectB}')`);
  for (const [kind, entity] of anchors) {
    editedText = editedText.replace(`=${entity}('${originalGuids[ifcObjectSeed(kind, projectA)]}'`,
      `=${entity}('${ifcGuid128(`editor-${kind}-edited`)}'`);
    eq(`editor ${kind}: vóór bewerking oorspronkelijk bron-GUID`,
      guidsOfType(savedBefore, new RegExp(`^${entity}$`)), [originalGuids[ifcObjectSeed(kind, projectA)]]);
    eq(`editor ${kind}: anker-GUID werkelijk gewijzigd in de tekst`,
      guidsOfType(editedText, new RegExp(`^${entity}$`)), [ifcGuid128(`editor-${kind}-edited`)]);
  }
  const parsedEdit = readIFC(editedText);
  eq('editor: InternalProjectId werkelijk als B geparsed', parsedEdit.project.id, projectB);
  for (const [kind] of anchors) {
    eq(`editor ${kind}: reader sleutelt GUID op B`, parsedEdit.ifcGlobalIds?.[ifcObjectSeed(kind, projectB)], ifcGuid128(`editor-${kind}-edited`));
  }
  S().applyProjectEdit(parsedEdit);
  eq('editor: sessie houdt project-id A', S().project.id, projectA);
  for (const [kind] of anchors) {
    eq(`editor ${kind}: bewaard GUID nu onder A`, S().ifcGlobalIds?.[ifcObjectSeed(kind, projectA)], ifcGuid128(`editor-${kind}-edited`));
    eq(`editor ${kind}: oude sleutel B verwijderd`, S().ifcGlobalIds?.[ifcObjectSeed(kind, projectB)], undefined);
    eq(`editor ${kind}: geparste invoer niet gemuteerd`, parsedEdit.ifcGlobalIds?.[ifcObjectSeed(kind, projectB)], ifcGuid128(`editor-${kind}-edited`));
  }
  const checkSavedAnchors = (label: string, edited: boolean) => {
    const saved = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
    eq(`${label}: project-id A in de opslagtekst`, readIFC(saved).project.id, projectA);
    eq(`${label}: taak-GUIDs ongemoeid`, taskGuidsByName(saved), originalTaskGuids);
    for (const [kind, entity] of anchors) {
      eq(`${label}: ${entity}.GlobalId in de opslagtekst`, guidsOfType(saved, new RegExp(`^${entity}$`)),
        [edited ? ifcGuid128(`editor-${kind}-edited`) : originalGuids[ifcObjectSeed(kind, projectA)]]);
    }
  };
  checkSavedAnchors('editor apply', true);
  S().undo();
  checkSavedAnchors('editor undo', false);
  S().redo();
  checkSavedAnchors('editor redo', true);
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`XX  ifc-globalid: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`OK  ifc-globalid: alle checks groen (${checks})`);
