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
import { produce } from 'immer';
import type { Task } from '@/types/task';
import { normalizeInsertedBranch, assignInsertedWbsCodes, insertRemappedRelations } from '@/state/insertedBranch';
import { applyWbsNumbering, deriveWbsCodes } from '@/utils/wbs';

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

// De lookup moet dezelfde EERSTE taak vinden als Array.find, ook bij corrupte invoer.
// De ids komen uit een iterator: een volgende taak kan intussen in dezelfde producer veranderen.
for (const auto of [false, true]) {
  const seed = S().tasks[0];
  const base = {
    tasks: [
      { ...seed, id: 'eerste', name: 'Eerste', parentId: null, childIds: [], calendarId: 'wees', wbsCode: 'eigen' },
      { ...seed, id: 'tweede', name: 'Tweede', parentId: null, childIds: [], calendarId: 'geldig' },
      { ...seed, id: 'eerste', name: 'Dubbel', parentId: null, childIds: [], calendarId: 'wees', wbsCode: 'dubbel' },
      { ...seed, id: '', name: 'Lege id', parentId: null, childIds: [], calendarId: 'wees' },
    ] as Task[],
    calendar: { id: 'geldig' }, calendars: [], customTaskTypes: [], activityCodeTypes: [], customFieldDefs: [],
    project: { wbsAutoNumber: auto },
  };
  const run = (legacy: boolean) => {
    let cleared = 0;
    const state = produce(base, s => {
      // De index moet ook deze net toegevoegde taak zien.
      s.tasks.push({ ...seed, id: 'nieuw', name: 'Nieuw', parentId: null, childIds: [], calendarId: 'wees' });
      function* ids() {
        yield 'eerste';
        s.tasks[1].calendarId = 'wees';
        yield 'tweede';
        yield 'ontbreekt';
        yield 'eerste';
        yield '';
        yield 'nieuw';
      }
      if (legacy) {
        for (const id of ids()) {
          const task = s.tasks.find(t => t.id === id);
          if (task?.calendarId !== undefined && task.calendarId !== 'geldig') {
            delete task.calendarId;
            cleared++;
          }
        }
        if (auto) applyWbsNumbering(s.tasks);
        else {
          const codes = deriveWbsCodes(s.tasks);
          for (const id of ['eerste', 'tweede', 'ontbreekt', 'eerste', '', 'nieuw']) {
            const task = s.tasks.find(t => t.id === id);
            const code = codes.get(id);
            if (task && code !== undefined) task.wbsCode = code;
          }
        }
      } else {
        cleared = normalizeInsertedBranch(s, ids());
        assignInsertedWbsCodes(s, ['eerste', 'tweede', 'ontbreekt', 'eerste', '', 'nieuw']);
      }
    });
    return { state, cleared };
  };
  eq(`lookup: uitvoerpariteit met find, auto-WBS=${auto}`, run(false), run(true));
  eq(`lookup: vier levende verwijzingen gewist, auto-WBS=${auto}`, run(false).cleared, 4);
  eq(`lookup: tweede dubbele id blijft ongemoeid, auto-WBS=${auto}`,
    run(false).state.tasks[2].calendarId, 'wees');
}

// Een telbaar leesbudget, zonder wandklok: de selectie staat achteraan in een groter document.
// Dit faalt met de oude find-lussen, onafhankelijk van CPU, JIT of runnerdrukte.
for (const size of [1000, 2000]) {
  let reads = 0;
  const tasks: Task[] = Array.from({ length: size }, (_, i) => ({
    ...S().tasks[0], parentId: null, childIds: [],
    get id() { reads++; return `taak-${i}`; },
  }));
  const ids = Array.from({ length: 100 }, (_, i) => `taak-${size - 100 + i}`);
  normalizeInsertedBranch({ tasks, calendar: { id: 'geldig' }, calendars: [], customTaskTypes: [],
    activityCodeTypes: [], customFieldDefs: [] }, ids);
  eq(`${size}/100 normaliseren: hooguit één id-lezing per documenttaak`, reads <= size, true);
  reads = 0;
  const relations = ids.slice(1).map((id, i) => ({
    predecessorId: ids[i], successorId: id, type: 'FINISH_START' as const, lagDays: 0,
  }));
  const skipped = insertRemappedRelations({ tasks, sequences: [] }, relations, new Map(ids.map(id => [id, id])));
  eq(`${size}/100 relaties: geen weigeringen`, skipped, []);
  eq(`${size}/100 relaties: hooguit één id-lezing per documenttaak`, reads <= size, true);
}

if (diffs.length === 0) {
  console.log(`OK  paste-references: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  paste-references: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
