// Contextmenu-reikwijdte + undo-kosten (issue #45) — headless tegen de ECHTE Zustand-store,
// via exact de functies die `GanttCanvas.tsx` aan het contextmenu hangt (`contextMenuBulk`).
//
// De bug: Indent, Outdent, Mijlpaal aan/uit, Kalender toewijzen, Voortgang en Prioriteit werkten op
// de AANGEKLIKTE taak in plaats van op de selectie; `Verwijderen` had dezelfde beperking. Twee
// eigenschappen die daarbij stil kunnen afdrijven en hier allebei worden vastgezet:
//
//   (a) REIKWIJDTE — zit de aangeklikte taak in de selectie, dan geldt de hele selectie; zit hij er
//       niet in, dan alleen die ene taak (de conventie van issue #26/#42).
//   (b) UNDO-KOSTEN — één menuklik is één handeling en moet met ÉÉN Ctrl+Z terug. Dat is de helft
//       die een naïeve `for`-lus over `updateTask`/`setTaskCalendar`/`setTaskProgress`/`deleteTask`
//       kapotmaakt zonder dat de zichtbare uitkomst verandert: elk van die mutators roept zelf
//       `beginUndoable` aan, dus drie taken zouden drie undo-stappen kosten.
//
// Sinds issue #49 dekt deze batterij ook de tweede helft van hetzelfde onderwerp: WAAR een nieuwe
// taak landt, ongeacht via welke route hij wordt aangemaakt (lintknop, mijlpaal-dropdown,
// contextmenu, sneltoets). Zie sectie 9 t/m 12 onderaan.
//
// Draait via run.sh. Exit 0 = alles groen.
// MOET als eerste staan: `shortcutRegistry` trekt `@/i18n/config` binnen, dat bij het laden al
// `document.documentElement.dir` aanraakt.
import './domShim';
import fs from 'node:fs';
import path from 'node:path';
import { useAppStore } from '@/state/appStore';
import { contextMenuOutlineScope, contextMenuBulk } from '@/components/canvas/contextMenuScope';
import {
  insertAnchorForScope, addTaskNearSelection, insertTaskRelativeToScope, canInsertRelative,
} from '@/state/taskInsertActions';
import { SHORTCUTS } from '@/hooks/keyboard/shortcutRegistry';
import { RIBBON_TABS, type RibbonGroupSpec } from '@/components/layout/Ribbon/ribbonConfig';
import type { Task } from '@/types/task';

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

/** Verse projectstate met vier root-taken; B/C/D worden de selectie, A blijft de controle. */
function verseVier(): { a: string; b: string; c: string; d: string } {
  S().newProject();
  const [a, b, c, d] = ['A', 'B', 'C', 'D'].map(n => S().addTask({ name: `Taak ${n}` }));
  S().selectTasks([b, c, d], false);
  return { a, b, c, d };
}

// ── 0) De reikwijdteregel zelf ──────────────────────────────────────────────────────────────
{
  const { a, b, c, d } = verseVier();
  eq('01 aangeklikte taak IN de selectie ⇒ hele selectie', contextMenuOutlineScope(c), [b, c, d]);
  eq('02 aangeklikte taak BUITEN de selectie ⇒ alleen die taak', contextMenuOutlineScope(a), [a]);
  S().deselectAll();
  eq('03 lege selectie ⇒ alleen de aangeklikte taak', contextMenuOutlineScope(d), [d]);
}

// ── 1) Mijlpaal aan/uit — anker + één undo-stap ─────────────────────────────────────────────
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

  // Anker-regel: klikken op een taak die AL mijlpaal is zet de hele selectie terug op gewoon,
  // ook als de rest van de selectie dat nog niet was (gemengde selectie ⇒ voorspelbare uitkomst).
  S().updateTask(c, { isMilestone: true });
  S().selectTasks([b, c, d], false);
  contextMenuBulk.toggleMilestone(task(c)!);
  eq('08 mijlpaal: anker is mijlpaal ⇒ hele selectie wordt gewone taak',
    [b, c, d].map(id => !!task(id)?.isMilestone), [false, false, false]);

  // Een uit MSP geimporteerde mijlpaal mag een echte duur hebben. De contextmenu-route gebruikt
  // dezelfde P6-transitie als de grid en dialoog: uitvinken ruimt alleen mijlpaalmetadata op en
  // verzint of normaliseert geen duur.
  S().updateTask(c, {
    isMilestone: true,
    milestoneKind: 'FINISH',
    mandatory: true,
    time: { ...task(c)!.time, scheduleDuration: 3, durationMinutes: 1440 },
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

// ── 2) Kalender toewijzen ───────────────────────────────────────────────────────────────────
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

  // De no-op-guard van `setTaskCalendar` moet ook in de bulkroute overeind blijven: een selectie
  // die al volledig op deze kalender staat mag geen (lege) undo-stap opleveren.
  S().selectTasks([b, c, d], false);
  contextMenuBulk.setCalendar(c, calId);
  const undoNaEerste = S().historyEvents.filter(event => event.state === 'applied').length;
  contextMenuBulk.setCalendar(c, calId);
  eq('13 kalender: tweede identieke bulk = no-op, geen undo-stap', S().historyEvents.filter(event => event.state === 'applied').length - undoNaEerste, 0);
}

// ── 3) Voortgang ────────────────────────────────────────────────────────────────────────────
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

// ── 4) Prioriteit ───────────────────────────────────────────────────────────────────────────
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

// ── 5) Inspringen / uitspringen ─────────────────────────────────────────────────────────────
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

// ── 6) Verwijderen ──────────────────────────────────────────────────────────────────────────
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

// Ouder + kind samen geselecteerd: `deleteTask` neemt de subboom mee, dus de tweede aanroep is een
// stille no-op. De lus mag daar niet op stukgaan, en het blijft één undo-stap.
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

// ── 7) Rechtsklik BUITEN de selectie raakt alleen die ene taak ───────────────────────────────
{
  const { a, b, c, d } = verseVier(); // selectie = B, C, D
  contextMenuBulk.setProgress(a, 0.25);
  eq('34 buiten de selectie: alleen de aangeklikte taak wijzigt', task(a)?.time.completion, 0.25);
  eq('35 buiten de selectie: de selectie blijft ongemoeid',
    [b, c, d].map(id => task(id)?.time.completion), [0, 0, 0]);
}

// ── 8) Invoegen boven / onder bij een MEERVOUDIGE selectie (issue #45, nasleep) ──────────────
//
// De bug: beide routes ankerden op één willekeurige taak. Het contextmenu nam de AANGEKLIKTE taak
// (dus "boven" landde midden in de selectie als je op de middelste taak rechtsklikte); de
// Insert-sneltoets nam `selectedTaskIds[0]`, de EERST AANGEKLIKTE taak — van onder naar boven
// selecteren gaf dus een ander resultaat dan van boven naar beneden. De regel is nu: boven de
// bovenste, onder de onderste, gemeten in de volgorde zoals de gebruiker ze ziet.
{
  const zichtbaar = (): string[] =>
    S().viewRows.flatMap(r => (r.kind === 'task' ? [r.task.name] : []));

  // 8a — aaneengesloten selectie, rechtsklik midden in de selectie.
  {
    const { c } = verseVier(); // A B C D, selectie = B, C, D
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

  // 8b — de klikvolgorde van de selectie mag niets uitmaken (dit was de sneltoets-bug).
  {
    const { b, c, d } = verseVier();
    S().selectTasks([d, c, b], false); // van onder naar boven geselecteerd
    eq('41 anker "boven" volgt de SCHERMvolgorde, niet de klikvolgorde',
      insertAnchorForScope(S().selectedTaskIds, 'above'), b);
    eq('42 anker "onder" volgt de SCHERMvolgorde, niet de klikvolgorde',
      insertAnchorForScope(S().selectedTaskIds, 'below'), d);
    contextMenuBulk.insert(c, 'above', 'Nieuw');
    eq('43 invoegen boven na omgekeerde klikvolgorde: nog steeds boven de bovenste',
      zichtbaar(), ['Taak A', 'Nieuw', 'Taak B', 'Taak C', 'Taak D']);
  }

  // 8c — rechtsklik BUITEN de selectie: alleen die ene taak telt (dezelfde bereikregel als de rest).
  {
    const { a } = verseVier(); // selectie = B, C, D
    contextMenuBulk.insert(a, 'below', 'Nieuw');
    eq('44 buiten de selectie: het anker is de aangeklikte taak',
      zichtbaar(), ['Taak A', 'Nieuw', 'Taak B', 'Taak C', 'Taak D']);
  }

  // 8d — niet-aaneengesloten selectie: de nieuwe taak omsluit de hele selectie.
  {
    const { a, c } = verseVier();
    S().selectTasks([a, c], false); // A en C, met B ertussen
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

  // 8e — selectie over MEERDERE OUDERS: het anker is de uiterste geselecteerde taak, dus de nieuwe
  // taak erft diens ouder en inspringniveau. "Boven" en "onder" landen dan in verschillende takken.
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
    S().selectTasks([b1, a2], false); // bewust omgekeerd geselecteerd
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

  // 8f — lege reikwijdte: geen anker ⇒ de aanroeper voegt achteraan toe (bestaand gedrag van de
  // Insert-sneltoets zonder selectie).
  {
    verseVier();
    S().deselectAll();
    eq('51 lege selectie ⇒ geen anker', insertAnchorForScope(S().selectedTaskIds, 'above'), undefined);
  }
}

// ── 9) "+ Taak" / "Mijlpaal" / contextmenu-"Taak toevoegen" volgen de selectie (issue #49) ──
//
// De melding: de knoppen zetten de nieuwe taak ALTIJD onderaan de lijst, ook met een taak
// geselecteerd. Gevraagd gedrag: selectie ⇒ direct onder de selectie, geen selectie ⇒ achteraan.
// Alle drie de knop-routes lopen door `addTaskNearSelection`, dus die is hier het meetpunt.
{
  const zichtbaar = (): string[] =>
    S().viewRows.flatMap(r => (r.kind === 'task' ? [r.task.name] : []));

  // 9a — enkelvoudige selectie: onder de geselecteerde taak, NIET onderaan de lijst.
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

  // 9b — geen selectie: achteraan (ongewijzigd gedrag, en de expliciete tweede regel van de melder).
  {
    verseVier();
    S().deselectAll();
    addTaskNearSelection({ name: 'Nieuw' });
    eq('55 + Taak zonder selectie: achteraan',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Taak D', 'Nieuw']);
  }

  // 9c — meervoudige selectie: onder de ONDERSTE van de selectie in schermvolgorde, ook wanneer er
  // van onder naar boven is geklikt. Zelfde ankerregel als "Invoegen onder" (sectie 8).
  {
    const { b, c } = verseVier();
    S().selectTasks([c, b], false); // van onder naar boven geselecteerd
    addTaskNearSelection({ name: 'Nieuw' });
    eq('56 + Taak met meervoudige selectie: onder de ONDERSTE, niet midden in de selectie',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Nieuw', 'Taak D']);
  }

  // 9d — een mijlpaal is dezelfde route: de extra velden blijven staan én de plaatsing klopt.
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

  // 9e — de nieuwe taak erft de ouder van het anker: selectie in een tak ⇒ nieuwe taak in die tak.
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

  // 9f — het contextmenu-item "Taak toevoegen" hangt op dezelfde route (GanttCanvas.onAddTask).
  {
    const { b } = verseVier();
    S().selectTasks([b], false);
    contextMenuBulk.addNearSelection('Nieuw');
    eq('61 contextmenu "Taak toevoegen": onder de selectie',
      zichtbaar(), ['Taak A', 'Taak B', 'Nieuw', 'Taak C', 'Taak D']);
  }
}

// ── 10) De weergave-poort: buiten pure boommodus (issue #49, toezegging aan de eigenaar) ────
//
// Wordt er gegroepeerd/gesorteerd/gefilterd, dan is de GETOONDE volgorde niet de documentvolgorde.
// Een structurele invoeging "boven taak X" komt dan zichtbaar ergens anders uit: gemeten vóór deze
// fix landde een Insert met een selectie in de band LOGISTIC zichtbaar in de band CONSTRUCTION.
// Regel nu (gelijk aan in-/uitspringen en aan het doorlopend invoeren in de tabel):
//   - expliciet "Invoegen boven/onder"  ⇒ GEWEIGERD + structuurmelding;
//   - "+ Taak"/Mijlpaal                 ⇒ achteraan + structuurmelding (nooit geweigerd: anders kun
//                                          je in een gegroepeerde weergave geen taak meer maken).
{
  const namen = (): string[] => S().tasks.map(t => t.name);
  /** Vier taken, gegroepeerd op taaktype ⇒ geen pure boommodus meer. */
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

  // 10a — "Invoegen boven/onder" wordt geweigerd, mét melding en zonder nieuwe taak.
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

  // 10b — hetzelfde via het contextmenu (dezelfde gedeelde route, dus dit bewaakt de bedrading).
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

  // 10c — "+ Taak" blijft werken, maar achteraan en mét melding.
  {
    const { b } = verseGegroepeerd();
    S().selectTasks([b], false);
    const meldingVoor = S().ui.structureLockedNotice;
    addTaskNearSelection({ name: 'Nieuw' });
    eq('72 gegroepeerd: "+ Taak" voegt nog steeds toe, maar achteraan',
      namen(), ['Taak A', 'Taak B', 'Taak C', 'Taak D', 'Nieuw']);
    eq('73 gegroepeerd: "+ Taak" meldt waarom de plaatsing wegviel',
      S().ui.structureLockedNotice - meldingVoor, 1);
  }

  // 10d — zonder selectie is er niets positioneels: geen melding, gewoon achteraan, in elke weergave.
  {
    verseGegroepeerd();
    S().deselectAll();
    const meldingVoor = S().ui.structureLockedNotice;
    addTaskNearSelection({ name: 'Nieuw' });
    eq('74 gegroepeerd zonder selectie: achteraan, zonder melding',
      [namen(), S().ui.structureLockedNotice - meldingVoor],
      [['Taak A', 'Taak B', 'Taak C', 'Taak D', 'Nieuw'], 0]);
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

  // Opruimen: de groepering is documentstate en zou anders in latere secties doorlekken.
  S().newProject();
}

// ── 11) De sneltoetsen (issue #49, aanvullend verzoek van de melder) ────────────────────────
//
// `Insert` bestond al (invoegen boven); "invoegen onder" had geen toets. Dit bewaakt dat de nieuwe
// entry er is, op welke combinatie hij zit, dat hij niet met een bestaande botst, en dat hij een
// labelKey heeft — de overzichtsdialoog rendert rechtstreeks uit dit register.
{
  const boven = SHORTCUTS.find(s => s.id === 'structure.insertAbove');
  const onder = SHORTCUTS.find(s => s.id === 'structure.insertBelow');
  eq('77 sneltoets "invoegen boven" bestaat en zit op Insert',
    boven && [boven.combo, boven.labelKey], [{ key: 'Insert' }, 'context.insertAbove']);
  eq('78 sneltoets "invoegen onder" bestaat en zit op Ctrl/Cmd+I',
    onder && [onder.combo, onder.labelKey, onder.category],
    [{ key: 'i', mod: true }, 'context.insertBelow', 'structure']);

  // Geen ONBEREIKBARE entry in het register: `useKeyboardShortcuts` stopt bij de EERSTE match, dus
  // zodra een eerdere entry dezelfde combinatie ONVOORWAARDELIJK (zonder `when`) afvangt, vuurt
  // alles daarachter met die combinatie nooit meer. Een botsing tussen entries die door een `when`
  // uit elkaar worden gehouden is wél legitiem en bestaat bewust: Escape sluit eerst de
  // presentatiemodus (`view.exitFullscreen`, met `when`) en deselecteert pas daarna
  // (`edit.deselect`). Aliassen delen hun labelKey (Alt+→ naast Alt+Shift+→) maar nooit hun combo.
  const sleutel = (c: { key: string; mod?: boolean; shift?: boolean; alt?: boolean }) =>
    `${c.key.toLowerCase()}|${!!c.mod}|${!!c.shift}|${!!c.alt}`;
  const onbereikbaar: string[] = [];
  for (let i = 0; i < SHORTCUTS.length; i++) {
    const k = sleutel(SHORTCUTS[i].combo);
    for (let j = 0; j < i; j++) {
      if (SHORTCUTS[j].displayOnly) continue;
      if (sleutel(SHORTCUTS[j].combo) !== k) continue;
      if (!SHORTCUTS[j].when) onbereikbaar.push(`${SHORTCUTS[i].id} onbereikbaar achter ${SHORTCUTS[j].id}`);
    }
  }
  eq('79 geen sneltoets onbereikbaar achter een eerdere, onvoorwaardelijke entry', onbereikbaar, []);
}

// ── 12) De sneltoets-uitvoering zelf, via de route die het register aanroept ────────────────
{
  const zichtbaar = (): string[] =>
    S().viewRows.flatMap(r => (r.kind === 'task' ? [r.task.name] : []));
  // Defensief: ontbreekt de entry, dan hoort dat een nette afwijkingsregel te geven en geen
  // stacktrace die de rest van de batterij meesleurt.
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

// ── 13) Taakknoppen op élk takentabblad (issue #49, tweede punt van de melder) ──────────────
//
// "not all task-related buttons are displayed under the Table tab": de Tabel-tab had alleen
// Bereken + Taak, terwijl de Start-tab Taak/Mijlpaal/Relatie heeft. Deze check eist dat beide
// tabbladen LETTERLIJK dezelfde groep-definitie delen — een gekopieerde tweede lijst met toevallig
// dezelfde items zou de volgende keer weer uit elkaar lopen.
{
  const groep = (tab: RibbonGroupSpec[], id: string) => tab.find(g => g.id === id);
  const start = groep(RIBBON_TABS.start, 'tasks');
  const tabel = groep(RIBBON_TABS.table, 'tasks');
  eq('83 de Start-tab heeft een Taken-groep met Taak/Mijlpaal/Relatie',
    start?.items.map(i => i.id), ['addTask', 'milestone', 'relation']);
  eq('84 de Tabel-tab heeft dezelfde Taken-groep', tabel?.items.map(i => i.id),
    ['addTask', 'milestone', 'relation']);
  eq('85 het is één gedeelde definitie, geen kopie', start === tabel && start !== undefined, true);
  eq('86 Bereken staat nog steeds op de Tabel-tab',
    RIBBON_TABS.table.some(g => g.items.some(i => i.id === 'calc')), true);
}

// ── 14) Verwijderen buiten het contextmenu: één handeling = één undo-stap ───────────────────
//
// De lintknop Verwijderen en Delete/Backspace lusten vóór deze gelijktrekking kaal `deleteTask`
// per id: drie taken wissen kostte drie Ctrl+Z's, terwijl het contextmenu het sinds issue #45 al
// als één transactie deed. Alle drie de routes draaien nu `deleteTasksBulk`
// (`src/state/taskBulkActions.ts`); dit vuurt de sneltoets-route af via het register — letterlijk
// wat een toetsaanslag draait — en pint de undo-boekhouding vast.
{
  const zichtbaar = (): string[] =>
    S().viewRows.flatMap(r => (r.kind === 'task' ? [r.task.name] : []));
  const entry = SHORTCUTS.find(s => s.id === 'edit.delete');
  const entryBackspace = SHORTCUTS.find(s => s.id === 'edit.deleteBackspace');
  if (!entry || !entryBackspace) {
    diffs.push('sneltoets edit.delete/edit.deleteBackspace ontbreekt in SHORTCUTS'); checks++;
  } else {
    verseVier(); // selecteert B/C/D; A blijft de controle
    const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
    entry.run(S());
    eq('87 Delete: alle geselecteerde taken weg, de controle blijft', zichtbaar(), ['Taak A']);
    eq('88 Delete: precies één undo-stap voor de hele bulk', S().historyEvents.filter(event => event.state === 'applied').length - undoVoor, 1);
    S().undo();
    eq('89 Delete: één Ctrl+Z zet alle drie terug',
      zichtbaar(), ['Taak A', 'Taak B', 'Taak C', 'Taak D']);

    // Backspace is een alias van dezelfde handeling — zelfde boekhouding.
    S().selectTasks(S().tasks.filter(t => t.name !== 'Taak A').map(t => t.id), false);
    const undoVoorBs = S().historyEvents.filter(event => event.state === 'applied').length;
    entryBackspace.run(S());
    eq('90 Backspace: zelfde bulk-route — alles weg in één undo-stap',
      [zichtbaar(), S().historyEvents.filter(event => event.state === 'applied').length - undoVoorBs], [['Taak A'], 1]);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  context-menu-scope-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  context-menu-scope-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
