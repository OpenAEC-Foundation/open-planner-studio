import './domShim';
import fs from 'node:fs';
import path from 'node:path';
import { createAppStoreContext, useAppStore } from '@/state/appStore';
import { contextMenuOutlineScope, contextMenuBulk } from '@/components/canvas/contextMenuScope';
import { createTaskBulkActions } from '@/state/taskBulkActions';
import {
  insertAnchorForScope, addTaskNearSelection, insertTaskRelativeToScope, canInsertRelative,
} from '@/state/taskInsertActions';
import { SHORTCUTS } from '@/hooks/keyboard/shortcutRegistry';
import { RIBBON_TABS, type RibbonGroupSpec } from '@/components/layout/Ribbon/ribbonConfig';
import type { Task } from '@/types/task';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { answerActualStartQuestion } from '@/state/actualStartQuestion';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const task = (id: string): Task | undefined => S().tasks.find(t => t.id === id);

const fullTaskGridSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/task-grid/FullTaskGrid.tsx'),
  'utf8',
);
const relationCellSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/task-grid/RelationCellEditor.tsx'),
  'utf8',
);
eq('00 FullTaskGrid gebruikt dezelfde contextmenu-bulkroute als de Gantt',
  /contextMenuBulk\.remove/.test(fullTaskGridSource)
    && /contextMenuBulk\.indent/.test(fullTaskGridSource)
    && /contextMenuOutlineScope/.test(fullTaskGridSource),
  true);
eq('00b rechtermuisknop loopt niet eerst door de gewone celselectie heen',
  /const selectCell[\s\S]*if \(event\.button !== 0\) return;[\s\S]*const gesture/.test(fullTaskGridSource),
  true);
eq('00c externe relatieacties staan in het rechtsklikmenu en niet als celknoppen',
  /onExternalContextMenu/.test(relationCellSource)
    && /event\.preventDefault\(\)/.test(relationCellSource)
    && /externalLinks\.refreshSource/.test(fullTaskGridSource)
    && /externalLinks\.deleteRelation/.test(fullTaskGridSource)
    && !/externalLinks\.(?:refreshSource|deleteRelation)/.test(relationCellSource),
  true);

function verseVier(): { a: string; b: string; c: string; d: string } {
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  const [a, b, c, d] = ['A', 'B', 'C', 'D'].map(n => S().addTask({ name: `Taak ${n}` }));
  S().selectTasks([b, c, d], false);
  return { a, b, c, d };
}

{
  const { a, b, c, d } = verseVier();
  eq('01 aangeklikte taak IN de selectie ⇒ hele selectie', contextMenuOutlineScope(c), [b, c, d]);
  eq('02 aangeklikte taak BUITEN de selectie ⇒ alleen die taak', contextMenuOutlineScope(a), [a]);
  S().deselectAll();
  eq('03 lege selectie ⇒ alleen de aangeklikte taak', contextMenuOutlineScope(d), [d]);
}

{
  const { a, b, c, d } = verseVier();
  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.toggleMilestone(task(c)!);
  eq('04 mijlpaal: alle drie geselecteerde taken zijn mijlpaal',
    [b, c, d].map(id => !!task(id)?.isMilestone), [true, true, true]);
  eq('05 mijlpaal: de niet-geselecteerde taak blijft ongemoeid', !!task(a)?.isMilestone, false);
  eq('06 mijlpaal: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
  S().undo();
  eq('07 mijlpaal: één Ctrl+Z draait alle drie terug',
    [b, c, d].map(id => !!task(id)?.isMilestone), [false, false, false]);

  S().updateTask(c, { isMilestone: true });
  S().selectTasks([b, c, d], false);
  contextMenuBulk.toggleMilestone(task(c)!);
  eq('08 mijlpaal: anker is mijlpaal ⇒ hele selectie wordt gewone taak',
    [b, c, d].map(id => !!task(id)?.isMilestone), [false, false, false]);

  S().updateTask(c, {
    isMilestone: true,
    milestoneKind: 'FINISH',
    mandatory: true,
    time: {
      ...task(c)!.time,
      durationUnit: 'hours',
      scheduleDuration: 3,
      durationMinutes: 1440,
    },
  });
  S().selectTasks([c], false);
  contextMenuBulk.toggleMilestone(task(c)!);
  eq('08b geimporteerde mijlpaal uitvinken bewaart duur en wist alleen mijlpaalmetadata', {
    milestone: task(c)?.isMilestone,
    kind: task(c)?.milestoneKind,
    mandatory: task(c)?.mandatory,
    duration: task(c)?.time.scheduleDuration,
    minutes: task(c)?.time.durationMinutes,
  }, { milestone: false, duration: 3, minutes: 1440 });
}

{
  const { a, b, c, d } = verseVier();
  const calId = S().addCalendar({ ...S().calendars[0], name: 'Testkalender' });
  S().selectTasks([b, c, d], false);
  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.setCalendar(c, calId);
  eq('09 kalender: alle drie geselecteerde taken kregen de kalender',
    [b, c, d].map(id => task(id)?.calendarId), [calId, calId, calId]);
  eq('10 kalender: de niet-geselecteerde taak blijft ongemoeid', task(a)?.calendarId, undefined);
  eq('11 kalender: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
  S().undo();
  eq('12 kalender: één Ctrl+Z draait alle drie terug',
    [b, c, d].map(id => task(id)?.calendarId), [undefined, undefined, undefined]);

  S().selectTasks([b, c, d], false);
  contextMenuBulk.setCalendar(c, calId);
  const undoNaEerste = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.setCalendar(c, calId);
  eq('13 kalender: tweede identieke bulk = no-op, geen undo-stap', S().historyEvents.filter(event => event.state === 'applied').length - undoNaEerste, 0);
}

{
  const { a, b, c, d } = verseVier();
  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.setProgress(c, 0.5);
  eq('14 voortgang: alle drie geselecteerde taken op 50%',
    [b, c, d].map(id => task(id)?.time.completion), [0.5, 0.5, 0.5]);
  eq('15 voortgang: de niet-geselecteerde taak blijft op 0', task(a)?.time.completion, 0);
  eq('16 voortgang: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
  S().undo();
  eq('17 voortgang: één Ctrl+Z draait alle drie terug',
    [b, c, d].map(id => task(id)?.time.completion), [0, 0, 0]);
}
for (const duration of [1, 3]) {
  S().newProject();
  S().setProject({ startDate: '2026-06-08', statusDate: '2026-06-10' });
  const a = S().addTask({ name: 'A', time: { scheduleDuration: duration } as Task['time'] });
  const b = S().addTask({ name: 'B', time: { scheduleDuration: 2 } as Task['time'] });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  S().selectTasks([b, a], false);
  const action = contextMenuBulk.setProgress(b, 1);
  if (duration === 1) {
    eq('#998 geen startvraag als het geplande einde van A op 8 juni blijft',
      S().ui.pendingActualStartQuestion, null);
    answerActualStartQuestion(null);
    await action;
    eq('#998 gelijktijdig afmelden gebruikt het geplande einde en start van de opvolger',
      [task(a)?.time.actualFinish, task(b)?.time.actualStart, task(b)?.time.actualFinish],
      ['2026-06-08T16:00', '2026-06-09T07:00', '2026-06-10T16:00']);
    S().undo();
    eq('#998 één Ctrl+Z draait beide afmeldingen terug',
      [task(a)?.time.completion, task(b)?.time.completion], [0, 0]);
    continue;
  }
  eq('#998 contextmenu vraagt om start van opvolger voordat iets is afgemeld',
    [S().ui.pendingActualStartQuestion?.items.map(item => item.taskId), task(a)?.time.completion, task(b)?.time.completion],
    [[b], 0, 0]);
  answerActualStartQuestion(null);
  await action;
  eq('#998 annuleren vanuit contextmenu houdt beide taken open',
    [task(a)?.time.completion, task(b)?.time.completion], [0, 0]);
  const confirmed = contextMenuBulk.setProgress(b, 1);
  answerActualStartQuestion({ [b]: '2026-06-09' });
  await confirmed;
  eq('#998 bevestigen meldt beide taken af en bewaart de opgegeven start',
    [task(a)?.time.actualFinish, task(b)?.time.completion, task(b)?.time.actualStart],
    ['2026-06-10T16:00', 1, '2026-06-09T07:00']);
}

{
  S().newProject();
  S().setProject({ startDate: '2026-06-08', statusDate: '2026-06-10' });
  const a = S().addTask({
    name: 'A', time: { scheduleDuration: 4 } as Task['time'],
    splitGaps: [{ afterMinutes: 1440, gapMinutes: 960, source: 'leveling' }],
  });
  const b = S().addTask({ name: 'B', time: { scheduleDuration: 2 } as Task['time'] });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: -3 });
  S().runCPM();
  S().selectTasks([b, a], false);
  const action = contextMenuBulk.setProgress(b, 0.5);
  eq('#998 het gewiste nivelleergat veroorzaakt geen startvraag op de opvolger',
    S().ui.pendingActualStartQuestion, null);
  answerActualStartQuestion(null);
  await action;
  eq('#998 groepsvoortgang gebruikt de opvolgerstart na het wissen van het nivelleergat',
    [task(a)?.splitGaps, task(b)?.time.actualStart], [undefined, '2026-06-09T07:00']);
}

{
  const { a, b, c, d } = verseVier();
  const prioVoorA = task(a)?.priority;
  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.setPriority(c, 900);
  eq('18 prioriteit: alle drie geselecteerde taken op 900',
    [b, c, d].map(id => task(id)?.priority), [900, 900, 900]);
  eq('19 prioriteit: de niet-geselecteerde taak blijft ongemoeid', task(a)?.priority, prioVoorA);
  eq('20 prioriteit: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
  S().undo();
  eq('21 prioriteit: één Ctrl+Z draait alle drie terug',
    [b, c, d].map(id => task(id)?.priority), [prioVoorA, prioVoorA, prioVoorA]);
}

{
  const { a, b, c, d } = verseVier();
  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.indent(c);
  eq('22 inspringen: alle drie geselecteerde taken hangen onder taak A',
    [b, c, d].map(id => task(id)?.parentId), [a, a, a]);
  eq('23 inspringen: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);

  S().selectTasks([b, c, d], false);
  const undoVoorUit = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.outdent(c);
  eq('24 uitspringen: alle drie geselecteerde taken staan weer op rootniveau',
    [b, c, d].map(id => task(id)?.parentId), [null, null, null]);
  eq('25 uitspringen: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoorUit, 1);
  S().undo();
  eq('26 uitspringen: één Ctrl+Z zet alle drie terug onder taak A',
    [b, c, d].map(id => task(id)?.parentId), [a, a, a]);
}

{
  const { a, b, c, d } = verseVier();
  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.remove(c);
  eq('27 verwijderen: alle drie geselecteerde taken zijn weg',
    [b, c, d].map(id => !!task(id)), [false, false, false]);
  eq('28 verwijderen: de niet-geselecteerde taak staat er nog', !!task(a), true);
  eq('29 verwijderen: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
  S().undo();
  eq('30 verwijderen: één Ctrl+Z brengt alle drie terug',
    [b, c, d].map(id => !!task(id)), [true, true, true]);
}

{
  S().newProject();
  const ouder = S().addTask({ name: 'Ouder' });
  const kind = S().addTask({ name: 'Kind', parentId: ouder });
  const rest = S().addTask({ name: 'Rest' });
  S().selectTasks([ouder, kind], false);
  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.remove(ouder);
  eq('31 verwijderen: ouder én kind weg', [!!task(ouder), !!task(kind)], [false, false]);
  eq('32 verwijderen: de rest staat er nog', !!task(rest), true);
  eq('33 verwijderen: ouder+kind samen kost één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
}

{
  const { a, b, c, d } = verseVier();
  contextMenuBulk.setProgress(a, 0.25);
  eq('34 buiten de selectie: alleen de aangeklikte taak wijzigt', task(a)?.time.completion, 0.25);
  eq('35 buiten de selectie: de selectie blijft ongemoeid',
    [b, c, d].map(id => task(id)?.time.completion), [0, 0, 0]);
}

{
  const zichtbaar = (): string[] =>
    S().viewRows.flatMap(r => (r.kind === 'task' ? [r.task.name] : []));

  {
    const { c } = verseVier();
    const aantalVoor = S().tasks.length;
    const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
    contextMenuBulk.insert(c, 'above', 'Nieuw');
    eq('36 invoegen boven: landt boven de BOVENSTE van de selectie, niet boven de aangeklikte',
      zichtbaar(), ['Taak A', 'Nieuw', 'Taak B', 'Taak C', 'Taak D']);
    eq('37 invoegen: precies één nieuwe taak voor de hele selectie', S().tasks.length - aantalVoor, 1);
    eq('38 invoegen: precies één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
    S().undo();
    eq('39 invoegen: één Ctrl+Z draait de invoeging terug',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Taak D']);
  }
  {
    const { c } = verseVier();
    contextMenuBulk.insert(c, 'below', 'Nieuw');
    eq('40 invoegen onder: landt onder de ONDERSTE van de selectie',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Taak D', 'Nieuw']);
  }

  {
    const { b, c, d } = verseVier();
    S().selectTasks([d, c, b], false);
    eq('41 anker "boven" volgt de SCHERMvolgorde, niet de klikvolgorde',
      insertAnchorForScope(S().selectedTaskIds, 'above'), b);
    eq('42 anker "onder" volgt de SCHERMvolgorde, niet de klikvolgorde',
      insertAnchorForScope(S().selectedTaskIds, 'below'), d);
    contextMenuBulk.insert(c, 'above', 'Nieuw');
    eq('43 invoegen boven na omgekeerde klikvolgorde: nog steeds boven de bovenste',
      zichtbaar(), ['Taak A', 'Nieuw', 'Taak B', 'Taak C', 'Taak D']);
  }

  {
    const { a } = verseVier();
    contextMenuBulk.insert(a, 'below', 'Nieuw');
    eq('44 buiten de selectie: het anker is de aangeklikte taak',
      zichtbaar(), ['Taak A', 'Nieuw', 'Taak B', 'Taak C', 'Taak D']);
  }

  {
    const { a, c } = verseVier();
    S().selectTasks([a, c], false);
    contextMenuBulk.insert(c, 'above', 'Nieuw');
    eq('45 niet-aaneengesloten: "boven" landt boven de bovenste (A), niet in het gat',
      zichtbaar(), ['Nieuw', 'Taak A', 'Taak B', 'Taak C', 'Taak D']);
  }
  {
    const { a, c } = verseVier();
    S().selectTasks([a, c], false);
    contextMenuBulk.insert(a, 'below', 'Nieuw');
    eq('46 niet-aaneengesloten: "onder" landt onder de onderste (C)',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Nieuw', 'Taak D']);
  }

  const verseBoom = () => {
    S().newProject();
    const p1 = S().addTask({ name: 'P1' });
    const a1 = S().addTask({ name: 'A1', parentId: p1 });
    const a2 = S().addTask({ name: 'A2', parentId: p1 });
    const p2 = S().addTask({ name: 'P2' });
    const b1 = S().addTask({ name: 'B1', parentId: p2 });
    const b2 = S().addTask({ name: 'B2', parentId: p2 });
    return { p1, a1, a2, p2, b1, b2 };
  };
  {
    const { p1, a2, b1 } = verseBoom();
    S().selectTasks([b1, a2], false);
    contextMenuBulk.insert(b1, 'above', 'Nieuw');
    eq('47 meerdere ouders: "boven" landt boven A2, binnen P1',
      zichtbaar(), ['P1', 'A1', 'Nieuw', 'A2', 'P2', 'B1', 'B2']);
    eq('48 meerdere ouders: de nieuwe taak erft de ouder van het anker',
      S().tasks.find(t => t.name === 'Nieuw')?.parentId, p1);
  }
  {
    const { p2, a2, b1 } = verseBoom();
    S().selectTasks([a2, b1], false);
    contextMenuBulk.insert(a2, 'below', 'Nieuw');
    eq('49 meerdere ouders: "onder" landt onder B1, binnen P2',
      zichtbaar(), ['P1', 'A1', 'A2', 'P2', 'B1', 'Nieuw', 'B2']);
    eq('50 meerdere ouders: de nieuwe taak erft de ouder van het anker',
      S().tasks.find(t => t.name === 'Nieuw')?.parentId, p2);
  }

  {
    verseVier();
    S().deselectAll();
    eq('51 lege selectie ⇒ geen anker', insertAnchorForScope(S().selectedTaskIds, 'above'), undefined);
  }
}

{
  const zichtbaar = (): string[] =>
    S().viewRows.flatMap(r => (r.kind === 'task' ? [r.task.name] : []));

  {
    const { b } = verseVier();
    S().selectTasks([b], false);
    const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
    addTaskNearSelection({ name: 'Nieuw' });
    eq('52 + Taak met selectie: direct ONDER de geselecteerde taak',
      zichtbaar(), ['Taak A', 'Taak B', 'Nieuw', 'Taak C', 'Taak D']);
    eq('53 + Taak: precies één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
    S().undo();
    eq('54 + Taak: één Ctrl+Z draait de invoeging terug',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Taak D']);
  }

  {
    verseVier();
    S().deselectAll();
    addTaskNearSelection({ name: 'Nieuw' });
    eq('55 + Taak zonder selectie: achteraan',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Taak D', 'Nieuw']);
  }

  {
    const { b, c } = verseVier();
    S().selectTasks([c, b], false);
    addTaskNearSelection({ name: 'Nieuw' });
    eq('56 + Taak met meervoudige selectie: onder de ONDERSTE, niet midden in de selectie',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Nieuw', 'Taak D']);
  }

  {
    const { b } = verseVier();
    S().selectTasks([b], false);
    addTaskNearSelection({ name: 'M', isMilestone: true, milestoneKind: 'START' });
    eq('57 Mijlpaal-dropdown: landt óók onder de selectie',
      zichtbaar(), ['Taak A', 'Taak B', 'M', 'Taak C', 'Taak D']);
    const m = S().tasks.find(t => t.name === 'M');
    eq('58 Mijlpaal-dropdown: de mijlpaal-velden overleven de gedeelde route',
      [m?.isMilestone, m?.milestoneKind], [true, 'START']);
  }

  {
    S().newProject();
    const p = S().addTask({ name: 'P' });
    const k1 = S().addTask({ name: 'K1', parentId: p });
    S().addTask({ name: 'K2', parentId: p });
    S().addTask({ name: 'Los' });
    S().selectTasks([k1], false);
    addTaskNearSelection({ name: 'Nieuw' });
    eq('59 + Taak: erft de ouder van de selectie i.p.v. op rootniveau te landen',
      zichtbaar(), ['P', 'K1', 'Nieuw', 'K2', 'Los']);
    eq('60 + Taak: parentId van de nieuwe taak = die van de selectie',
      S().tasks.find(t => t.name === 'Nieuw')?.parentId, p);
  }

  {
    const { b } = verseVier();
    S().selectTasks([b], false);
    contextMenuBulk.addNearSelection('Nieuw');
    eq('61 contextmenu "Taak toevoegen": onder de selectie',
      zichtbaar(), ['Taak A', 'Taak B', 'Nieuw', 'Taak C', 'Taak D']);
  }
}

{
  const namen = (): string[] => S().tasks.map(t => t.name);
  const verseGegroepeerd = () => {
    const ids = verseVier();
    S().setGroup([{ field: { src: 'builtin', key: 'taskType' }, dir: 'asc' }]);
    return ids;
  };

  {
    verseVier();
    eq('62 pure boommodus ⇒ positioneel invoegen mag', canInsertRelative(), true);
    S().setGroup([{ field: { src: 'builtin', key: 'taskType' }, dir: 'asc' }]);
    eq('63 gegroepeerd ⇒ positioneel invoegen mag niet', canInsertRelative(), false);
    S().setGroup([]);
    S().setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'asc' }]);
    eq('64 gesorteerd ⇒ positioneel invoegen mag niet', canInsertRelative(), false);
    S().setSort([]);
    eq('65 standen gewist ⇒ weer pure boommodus', canInsertRelative(), true);
  }

  {
    const { b } = verseGegroepeerd();
    S().selectTasks([b], false);
    const meldingVoor = S().ui.structureLockedNotice;
    const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
    const id = insertTaskRelativeToScope(S().selectedTaskIds, 'above', { name: 'Nieuw' });
    eq('66 gegroepeerd: "Invoegen boven" maakt GEEN taak aan', id, null);
    eq('67 gegroepeerd: het document blijft ongewijzigd',
      namen(), ['Taak A', 'Taak B', 'Taak C', 'Taak D']);
    eq('68 gegroepeerd: geweigerde invoeging kost geen undo-stap',
      S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 0);
    eq('69 gegroepeerd: de structuurmelding gaat af',
      S().ui.structureLockedNotice - meldingVoor, 1);
  }

  {
    const { b } = verseGegroepeerd();
    S().selectTasks([b], false);
    const meldingVoor = S().ui.structureLockedNotice;
    contextMenuBulk.insert(b, 'below', 'Nieuw');
    eq('70 gegroepeerd: contextmenu "Invoegen onder" voegt niets in',
      namen(), ['Taak A', 'Taak B', 'Taak C', 'Taak D']);
    eq('71 gegroepeerd: contextmenu meldt het ook',
      S().ui.structureLockedNotice - meldingVoor, 1);
  }

  {
    const { b } = verseGegroepeerd();
    S().selectTasks([b], false);
    for (const n of [...S().ui.notifications]) S().dismissNotification(n.id);
    const meldingVoor = S().ui.structureLockedNotice;
    addTaskNearSelection({ name: 'Nieuw' });
    eq('72 gegroepeerd: "+ Taak" voegt nog steeds toe, maar achteraan',
      namen(), ['Taak A', 'Taak B', 'Taak C', 'Taak D', 'Nieuw']);
    eq('73 gegroepeerd: "+ Taak" geeft GEEN strook (5a)',
      S().ui.structureLockedNotice - meldingVoor, 0);
    const toast = S().ui.notifications.map(n => ({
      messageKey: n.messageKey, severity: n.severity, refusal: n.refusal, action: n.action,
    }));
    eq('73b gegroepeerd: "+ Taak" meldt de plaatsing met een rode toast + Wissen (5a)', toast, [{
      messageKey: 'notifications.taskAddedAtEnd', severity: 'error', refusal: true,
      action: { kind: 'clearViewArrangement', labelKey: 'view.filter.clear' },
    }]);
  }

  {
    verseGegroepeerd();
    S().deselectAll();
    for (const n of [...S().ui.notifications]) S().dismissNotification(n.id);
    const meldingVoor = S().ui.structureLockedNotice;
    addTaskNearSelection({ name: 'Nieuw' });
    eq('74 gegroepeerd zonder selectie: achteraan, zonder melding',
      [namen(), S().ui.structureLockedNotice - meldingVoor, S().ui.notifications.length],
      [['Taak A', 'Taak B', 'Taak C', 'Taak D', 'Nieuw'], 0, 0]);
  }
  {
    verseGegroepeerd();
    S().deselectAll();
    const meldingVoor = S().ui.structureLockedNotice;
    const id = insertTaskRelativeToScope(S().selectedTaskIds, 'above', { name: 'Nieuw2' });
    eq('75 gegroepeerd zonder selectie: Insert voegt gewoon achteraan toe', !!id, true);
    eq('76 gegroepeerd zonder selectie: Insert meldt niets',
      S().ui.structureLockedNotice - meldingVoor, 0);
  }

  S().newProject();
}

{
  const boven = SHORTCUTS.find(s => s.id === 'structure.insertAbove');
  const onder = SHORTCUTS.find(s => s.id === 'structure.insertBelow');
  eq('77 sneltoets "invoegen boven" bestaat en zit op Insert',
    boven && [boven.combo, boven.labelKey], [{ key: 'Insert' }, 'context.insertAbove']);
  eq('78 sneltoets "invoegen onder" bestaat en zit op Ctrl/Cmd+I',
    onder && [onder.combo, onder.labelKey, onder.category],
    [{ key: 'i', mod: true }, 'context.insertBelow', 'structure']);

  const sleutel = (c: { key: string; mod?: boolean; shift?: boolean; alt?: boolean }) =>
    `${c.key.toLowerCase()}|${!!c.mod}|${!!c.shift}|${!!c.alt}`;
  const onbereikbaar: string[] = [];
  for (let i = 0; i < SHORTCUTS.length; i++) {
    if (SHORTCUTS[i].displayOnly) continue;
    const k = sleutel(SHORTCUTS[i].combo);
    for (let j = 0; j < i; j++) {
      if (SHORTCUTS[j].displayOnly) continue;
      if (sleutel(SHORTCUTS[j].combo) !== k) continue;
      if (!SHORTCUTS[j].when) onbereikbaar.push(`${SHORTCUTS[i].id} onbereikbaar achter ${SHORTCUTS[j].id}`);
    }
  }
  eq('79 geen sneltoets onbereikbaar achter een eerdere, onvoorwaardelijke entry', onbereikbaar, []);
}

{
  const zichtbaar = (): string[] =>
    S().viewRows.flatMap(r => (r.kind === 'task' ? [r.task.name] : []));
  const draai = (id: string): boolean => {
    const entry = SHORTCUTS.find(s => s.id === id);
    if (!entry) { diffs.push(`sneltoets ${id} ontbreekt in SHORTCUTS`); checks++; return false; }
    entry.run(S());
    return true;
  };

  {
    const { b } = verseVier();
    S().selectTasks([b], false);
    draai('structure.insertBelow');
    eq('80 Ctrl+I: precies één nieuwe taak, direct ONDER de selectie',
      zichtbaar().map((n, i) => (i === 2 ? '<nieuw>' : n)),
      ['Taak A', 'Taak B', '<nieuw>', 'Taak C', 'Taak D']);
  }
  {
    const { b } = verseVier();
    S().selectTasks([b], false);
    draai('structure.insertAbove');
    eq('81 Insert: precies één nieuwe taak, direct BOVEN de selectie',
      zichtbaar().map((n, i) => (i === 1 ? '<nieuw>' : n)),
      ['Taak A', '<nieuw>', 'Taak B', 'Taak C', 'Taak D']);
  }
  {
    verseVier();
    S().deselectAll();
    draai('structure.insertBelow');
    eq('82 Ctrl+I zonder selectie: achteraan', S().tasks.length, 5);
  }
}

{
  const groep = (tab: RibbonGroupSpec[], id: string) => tab.find(g => g.id === id);
  const start = groep(RIBBON_TABS.start, 'tasks');
  const tabel = groep(RIBBON_TABS.table, 'tasks');
  const kern = ['addTask', 'milestone', 'relation'];
  eq('83 de Start-tab heeft een Taken-groep met Taak/Mijlpaal/Relatie',
    kern.filter(id => start?.items.some(i => i.id === id)), kern);
  eq('84 de Tabel-tab heeft dezelfde Taken-groep',
    kern.filter(id => tabel?.items.some(i => i.id === id)), kern);
  eq('85 het is één gedeelde definitie, geen kopie', start === tabel && start !== undefined, true);
  eq('86 Bereken staat nog steeds op de Tabel-tab',
    RIBBON_TABS.table.some(g => g.items.some(i => i.id === 'calc')), true);
}

{
  const zichtbaar = (): string[] =>
    S().viewRows.flatMap(r => (r.kind === 'task' ? [r.task.name] : []));
  const entry = SHORTCUTS.find(s => s.id === 'edit.delete');
  const entryBackspace = SHORTCUTS.find(s => s.id === 'edit.deleteBackspace');
  if (!entry || !entryBackspace) {
    diffs.push('sneltoets edit.delete/edit.deleteBackspace ontbreekt in SHORTCUTS'); checks++;
  } else {
    verseVier();
    const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
    entry.run(S());
    eq('87 Delete: alle geselecteerde taken weg, de controle blijft', zichtbaar(), ['Taak A']);
    eq('88 Delete: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
    S().undo();
    eq('89 Delete: één Ctrl+Z zet alle drie terug',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Taak D']);

    S().selectTasks(S().tasks.filter(t => t.name !== 'Taak A').map(t => t.id), false);
    const undoVoorBs = S().historyEvents.filter(event => event.state === 'applied').length;
    entryBackspace.run(S());
    eq('90 Backspace: zelfde bulk-route — alles weg in één undo-stap',
      [zichtbaar(), S().historyEvents.filter(event => event.state === 'applied').length - undoVoorBs], [['Taak A'], 1]);
  }
}

{
  const B = createAppStoreContext();
  const b1 = B.store.getState().addTask({ name: 'B-1' });
  const b2 = B.store.getState().addTask({ name: 'B-2' });
  const bUndoBefore = historyDepthsForActiveScope(B.store.getState()).undoDepth;
  const appBefore = {
    taskIds: S().tasks.map(task => task.id),
    undoDepth: historyDepthsForActiveScope(S()).undoDepth,
  };

  const bulkB = createTaskBulkActions(B);
  bulkB.applyToTaskIds([b1, b2], (state, id) => state.deleteTask(id));

  eq('91 contextbulk B: beide B-taken verwijderd', B.store.getState().tasks.length, 0);
  eq('92 contextbulk B: precies één B-undo voor de hele handeling',
    historyDepthsForActiveScope(B.store.getState()).undoDepth - bUndoBefore, 1);
  eq('93 contextbulk B: appcontext A blijft byte- en tellermatig gelijk', {
    taskIds: S().tasks.map(task => task.id),
    undoDepth: historyDepthsForActiveScope(S()).undoDepth,
  }, appBefore);
}

{
  const { a, b, c, d } = verseVier();
  S().selectTasks([b], false);
  S().setUI({ showPropertiesPanel: false, pendingTaskNameFocusId: null });
  const beforeIds = new Set(S().tasks.map(t => t.id));
  const undoBefore = historyDepthsForActiveScope(S()).undoDepth;
  SHORTCUTS.find(entry => entry.id === 'structure.addMilestone')!.run(S());
  const created = S().tasks.find(t => !beforeIds.has(t.id))!;
  eq('Ctrl+M maakt een gewone eindmijlpaal, geen keuring',
    [created.isMilestone, created.taskType, created.milestoneKind, created.mandatory ?? false],
    [true, 'USERDEFINED', 'FINISH', false]);
  eq('Ctrl+M voegt direct onder de selectie in', S().tasks.map(t => t.id), [a, b, created.id, c, d]);
  eq('Ctrl+M selecteert de nieuwe mijlpaal', S().selectedTaskIds, [created.id]);
  eq('Ctrl+M opent het paneel en zet naamfocus klaar',
    [S().ui.showPropertiesPanel, S().ui.pendingTaskNameFocusId], [true, created.id]);
  eq('Ctrl+M kost één undo-stap', historyDepthsForActiveScope(S()).undoDepth, undoBefore + 1);
  S().undo();
  eq('Ctrl+M terugdraaien herstelt de oorspronkelijke taken', S().tasks.map(t => t.id), [a, b, c, d]);
}

if (diffs.length === 0) {
  console.log(`OK  context-menu-scope-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  context-menu-scope-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
