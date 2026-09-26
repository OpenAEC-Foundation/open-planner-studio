// Plakken in een ANDER document (audit taakmutaties §8): het klembord is app-globaal, dus een tak uit
// document A kan verwijzingen meebrengen naar definities die alleen in A bestaan — een taakkalender,
// een eigen taaktype, activity codes en gebruikersvelden. Voorheen landden die id's ongezien in B:
// de taak rekende stil op de projectkalender (einde 10-03 i.p.v. 08-03), het raster weigerde de
// kalendercel daarna (`calendarNotFound`) en codes/velden verdwenen stil bij opslaan. Nu maakt
// `normalizeInsertedBranch` ze leeg, met één melding. Binnen hetzelfde document blijft alles staan.
//
// Headless tegen de echte store; draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import type { CellEditIntent } from '@/types/taskGrid';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const noticeCount = () => S().ui.notifications
  .filter(n => n.messageKey === 'notifications.referencesClearedOnPaste')
  .map(n => n.params?.count);

// ── Document A: taak op een 7/7-kalender, met eigen taaktype, activity code en gebruikersveld ──
S().newProject();
S().setProject({ startDate: '2026-03-02' });
const cal7 = S().addCalendar({ ...S().calendar, name: 'Continu 7/7', workDays: [1, 2, 3, 4, 5, 6, 7], holidays: [] } as never);
S().ensureProjectTaskType({ id: 'ctt-stort', name: 'Betonstort' });
const codeType = S().addActivityCodeType('Locatie');
const codeValue = S().addActivityCodeValue(codeType, { code: 'B1' });
const field = S().addCustomField('Volume m3', 'number');
const T = S().addTask({ name: 'Beton uitharden', time: { scheduleDuration: 7 } as never });
S().setTaskCalendar(T, cal7);
S().updateTask(T, { taskType: 'USERDEFINED', customTaskTypeId: 'ctt-stort' });
S().setTaskActivityCode(T, codeType, codeValue);
S().setTaskCustomField(T, field, 42);
S().runCPM();
const inA = S().tasks.find(t => t.id === T)!;
eq('A: einde op de 7/7-kalender', inA.time.earlyFinish, '2026-03-08');
S().copyTasks([T]);

// ── Binnen hetzelfde document plakken: alle verwijzingen bestaan, niets wordt gewist ──
{
  const before = noticeCount().length;
  const [same] = S().pasteTasks();
  const t = S().tasks.find(x => x.id === same)!;
  eq('zelfde document: calendarId blijft', t.calendarId, cal7);
  eq('zelfde document: customTaskTypeId blijft', t.customTaskTypeId, 'ctt-stort');
  eq('zelfde document: activity code blijft', t.activityCodes, { [codeType]: codeValue });
  eq('zelfde document: gebruikersveld blijft', t.customFields, { [field]: 42 });
  eq('zelfde document: geen melding', noticeCount().length, before);
}

// ── Document B (vers): dezelfde tak plakken ──
S().newDocument();
S().setProject({ startDate: '2026-03-02' });
const undoBefore = S().historyEvents.filter(e => e.state === 'applied').length;
const [pasted] = S().pasteTasks();
const inB = S().tasks.find(t => t.id === pasted)!;
eq('B: calendarId leeggemaakt (bestond niet)', inB.calendarId, undefined);
eq('B: customTaskTypeId leeggemaakt', inB.customTaskTypeId, undefined);
eq('B: taaktype blijft USERDEFINED (generiek)', inB.taskType, 'USERDEFINED');
eq('B: activity code leeggemaakt', inB.activityCodes, undefined);
eq('B: gebruikersveld leeggemaakt', inB.customFields, undefined);
eq('B: de rest van de taak kwam gewoon mee', [inB.name, inB.time.scheduleDuration], ['Beton uitharden', 7]);
eq('B: één melding met het aantal leeggemaakte verwijzingen', noticeCount(), [4]);
eq('B: plakken blijft één undo-stap', S().historyEvents.filter(e => e.state === 'applied').length, undoBefore + 1);
{
  // Het raster kan de (lege) kalendercel nu gewoon bevestigen; voorheen: calendarNotFound.
  const r = S().runGridMutation([{
    kind: 'cell-edit', taskId: pasted, columnId: 'task.calendarId' as CellEditIntent['columnId'],
    route: 'task-schedule', value: S().tasks.find(t => t.id === pasted)!.calendarId,
  }]);
  eq('B: raster weigert de kalendercel niet meer', r.ok, true);
}

// ── Gedeeltelijk bestaand: bestaande definities blijven, alleen de wezen gaan ──
{
  S().newDocument();
  S().setProject({ startDate: '2026-03-02' });
  // Een document dat wél een activity code-type met dezelfde id kent (bv. een kopie van hetzelfde
  // bronbestand), maar niet de gebruikersveld-definitie en een andere waardenlijst.
  useAppStore.setState((s) => {
    s.activityCodeTypes = [{ id: codeType, name: 'Locatie', values: [{ id: codeValue, code: 'B1' }] }];
  });
  const [p2] = S().pasteTasks();
  const t2 = S().tasks.find(t => t.id === p2)!;
  eq('deels: bestaande activity code blijft', t2.activityCodes, { [codeType]: codeValue });
  eq('deels: onbekend gebruikersveld gaat weg', t2.customFields, undefined);
}

if (diffs.length === 0) {
  console.log(`OK  paste-references: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  paste-references: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
