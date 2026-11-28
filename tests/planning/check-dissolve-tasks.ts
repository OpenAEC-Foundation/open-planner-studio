import './domShim';
import fs from 'node:fs';
import path from 'node:path';
import { useAppStore } from '@/state/appStore';
import { contextMenuBulk } from '@/components/canvas/contextMenuScope';
import { RIBBON_TABS, type RibbonGroupSpec } from '@/components/layout/Ribbon/ribbonConfig';
import type { SequenceType } from '@/types/sequence';
import { planDissolve } from '@/state/dissolveTasks';
import { flattenOrder } from '@/utils/wbs';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const FS: SequenceType = 'FINISH_START';

function plan(names: string[]): Record<string, string> {
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  const ids: Record<string, string> = {};
  for (const name of names) ids[name] = S().addTask({ name });
  return ids;
}

function link(ids: Record<string, string>, from: string, to: string, type: SequenceType = FS, lagDays = 0): void {
  const id = S().addSequence({ predecessorId: ids[from], successorId: ids[to], type, lagDays });
  if (!id) throw new Error(`relatie ${from} → ${to} geweigerd in de opzet`);
}

function relations(): string[] {
  const name = (id: string) => S().tasks.find(t => t.id === id)?.name ?? '?';
  const short: Record<SequenceType, string> = {
    FINISH_START: 'FS', START_START: 'SS', FINISH_FINISH: 'FF', START_FINISH: 'SF',
  };
  return S().sequences
    .map(s => `${name(s.predecessorId)}>${name(s.successorId)} ${short[s.type]} ${s.lagDays}`)
    .sort();
}

const names = () => S().tasks.map(t => t.name).sort();
const appliedEvents = () => S().historyEvents.filter(event => event.state === 'applied').length;

{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  S().runCPM();
  const before = appliedEvents();
  S().dissolveTasksBulk([ids.B]);
  eq('01 B is weg', names(), ['A', 'C']);
  eq('02 A → C einde-begin zonder vertraging', relations(), ['A>C FS 0']);
  eq('03 één undo-stap', appliedEvents(), before + 1);
  eq('04 planning verouderd', S().scheduleStale, true);
  eq('05 document gewijzigd', S().isDirty, true);
  S().undo();
  eq('06 undo: B terug', names(), ['A', 'B', 'C']);
  eq('07 undo: oude relaties terug, de nieuwe weg', relations(), ['A>B FS 0', 'B>C FS 0']);
  S().redo();
  eq('08 redo: weer A → C', relations(), ['A>C FS 0']);
}

{
  const ids = plan(['A1', 'A2', 'B', 'C1', 'C2']);
  link(ids, 'A1', 'B', 'START_START', 2);
  link(ids, 'A2', 'B', FS, 3);
  link(ids, 'B', 'C1', 'FINISH_FINISH', -1);
  link(ids, 'B', 'C2');
  S().dissolveTasksBulk([ids.B]);
  eq('09 vier nieuwe einde-begin-relaties zonder vertraging', relations(),
    ['A1>C1 FS 0', 'A1>C2 FS 0', 'A2>C1 FS 0', 'A2>C2 FS 0']);
}

{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'A', 'C', FS, 5);
  S().dissolveTasksBulk([ids.B]);
  eq('10 bestaande einde-begin blijft zoals ze is, geen tweede', relations(), ['A>C FS 5']);
  eq('11 geen weigering gemeld voor een relatie die er al was',
    S().ui.notifications.filter(n => n.messageKey === 'notifications.relationsSkippedOnDissolve').length, 0);
}
{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'A', 'C', 'START_START', 2);
  S().dissolveTasksBulk([ids.B]);
  eq('12 andere soort tussen A en C: einde-begin komt erbij', relations(), ['A>C FS 0', 'A>C SS 2']);
}

{
  const ids = plan(['A', 'B', 'C', 'D']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'C', 'D');
  const before = appliedEvents();
  S().dissolveTasksBulk([ids.B, ids.C]);
  eq('13 B en C samen: A → D', relations(), ['A>D FS 0']);
  eq('14 één undo-stap voor de hele selectie', appliedEvents(), before + 1);
}
{
  const ids = plan(['A', 'B', 'C', 'D', 'E']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'C', 'D');
  link(ids, 'D', 'E');
  S().dissolveTasksBulk([ids.B, ids.D]);
  eq('15 losse taken B en D: A → C en C → E, niet A → E', relations(), ['A>C FS 0', 'C>E FS 0']);
}

{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  const res = S().addResource({ name: 'Timmerman', type: 'LABOR' } as Parameters<ReturnType<typeof S>['addResource']>[0]);
  S().assignResource(ids.B, res, 1);
  S().assignResource(ids.C, res, 1);
  S().dissolveTasksBulk([ids.B]);
  eq('16 toewijzing van B weg, die van C blijft', S().assignments.map(a => a.taskId), [ids.C]);
  eq('17 resource zelf blijft', S().resources.some(r => r.id === res), true);
  S().undo();
  eq('18 undo: toewijzing van B terug', S().assignments.map(a => a.taskId).sort(), [ids.B, ids.C].sort());
}

{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  S().dissolveTasksBulk([ids.B]);
  eq('19 eindtaak zonder opvolger: B weg, geen nieuwe relatie', [names(), relations()], [['A', 'C'], []]);
}

{
  plan(['A']);
  const before = appliedEvents();
  S().dissolveTasksBulk([]);
  S().dissolveTasksBulk(['bestaat-niet']);
  eq('20 leeg of onbekend: geen undo-stap', appliedEvents(), before);
}

{
  const ids = plan(['A', 'A2', 'F', 'B1', 'B2', 'C', 'C2']);
  S().moveTask(ids.B1, ids.F, 0);
  S().moveTask(ids.B2, ids.F, 1);
  link(ids, 'A', 'B1');
  link(ids, 'B1', 'B2');
  link(ids, 'B2', 'C');
  link(ids, 'A2', 'F');
  link(ids, 'F', 'C2');
  S().dissolveTasksBulk([ids.F]);
  eq('21 fase en kinderen weg', names(), ['A', 'A2', 'C', 'C2']);
  eq('22 elke voorganger van de tak naar elke opvolger van de tak', relations(),
    ['A2>C FS 0', 'A2>C2 FS 0', 'A>C FS 0', 'A>C2 FS 0']);
}

{
  const ids = plan(['X', 'Y', 'Z', 'F', 'B1', 'B2']);
  S().moveTask(ids.B1, ids.F, 0);
  S().moveTask(ids.B2, ids.F, 1);
  link(ids, 'Y', 'X');
  link(ids, 'X', 'B1');
  link(ids, 'B2', 'Y');
  link(ids, 'B2', 'Z');
  S().dissolveTasksBulk([ids.F]);
  eq('23 alleen de toegestane brug', relations(), ['X>Z FS 0', 'Y>X FS 0']);
  const notice = S().ui.notifications.find(n => n.messageKey === 'notifications.relationsSkippedOnDissolve');
  eq('24 weigering gemeld met aantal', notice?.params, { count: 1 });
  eq('25 weigering noemt de relatie', notice?.detailLines?.[0]?.params, { names: 'X → Y' });
}
{
  const ids = plan(['X', 'F', 'B1', 'B2']);
  S().moveTask(ids.B1, ids.F, 0);
  S().moveTask(ids.B2, ids.F, 1);
  link(ids, 'X', 'B1');
  link(ids, 'B2', 'X');
  S().dissolveTasksBulk([ids.F]);
  eq('25b zelfrelatie niet aangemaakt', relations(), []);
  const notice = S().ui.notifications.find(n => n.messageKey === 'notifications.relationsSkippedOnDissolve'
    && n.detailLines?.[0]?.params?.names === 'X → X');
  eq('25c zelfrelatie gemeld', notice?.params, { count: 1 });
}

const taskOf = (name: string) => S().tasks.find(t => t.name === name)!;
const timeOf = (name: string) => taskOf(name).time;
{
  const ids = plan(['A', 'P', 'B', 'D', 'C']);
  S().moveTask(ids.B, ids.P, 0);
  S().moveTask(ids.D, ids.P, 1);
  link(ids, 'A', 'P');
  link(ids, 'B', 'C');
  S().dissolveTasksBulk([ids.B]);
  eq('25d voorganger via de fase gaat naar de opvolger', relations(), ['A>C FS 0', 'A>P FS 0']);
  S().runCPM();
  eq('25e na F5 start C niet vóór het einde van A', timeOf('C').earlyStart >= timeOf('A').earlyFinish, true);
}
{
  const ids = plan(['A', 'P', 'B', 'D', 'C']);
  S().moveTask(ids.B, ids.P, 0);
  S().moveTask(ids.D, ids.P, 1);
  link(ids, 'A', 'B');
  link(ids, 'P', 'C');
  S().dissolveTasksBulk([ids.B]);
  eq('25f opvolger via de fase krijgt de voorganger', relations(), ['A>C FS 0', 'P>C FS 0']);
  S().runCPM();
  eq('25g na F5 start C niet vóór het einde van A', timeOf('C').earlyStart >= timeOf('A').earlyFinish, true);
}
{
  const ids = plan(['A', 'P', 'B', 'C']);
  S().moveTask(ids.B, ids.P, 0);
  S().moveTask(ids.C, ids.P, 1);
  link(ids, 'A', 'P');
  link(ids, 'B', 'C');
  S().dissolveTasksBulk([ids.B]);
  eq('25h opvolger in dezelfde fase: geen dubbele pijl', relations(), ['A>P FS 0']);
}
{
  const ids = plan(['A', 'P', 'B', 'D', 'C']);
  S().moveTask(ids.B, ids.P, 0);
  S().moveTask(ids.D, ids.P, 1);
  link(ids, 'A', 'P');
  link(ids, 'P', 'C');
  S().dissolveTasksBulk([ids.B]);
  eq('25i alleen relaties op de fase: geen nieuwe pijl', relations(), ['A>P FS 0', 'P>C FS 0']);
}

const westSource = { projectId: 'west', projectName: 'Project West', taskId: 'bron-1', taskName: 'Fundering' };
const extOf = (name: string) => (taskOf(name).externalLinks ?? [])
  .map(l => `${l.direction} ${l.relType} ${l.lagDays ?? 0} ${l.sourceRef.taskId}`);
{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  S().addExternalLink(ids.B, {
    direction: 'predecessor', relType: 'FF', lagDays: 3, anchorDate: '2026-06-10T16:00', sourceMissing: false, sourceRef: westSource,
  });
  S().addExternalLink(ids.B, {
    direction: 'successor', relType: 'SS', lagDays: 1, anchorDate: '2026-07-01T07:00', sourceMissing: false, sourceRef: westSource,
  });
  const anchors = (taskOf('B').externalLinks ?? []).map(l => l.anchorDate);
  S().dissolveTasksBulk([ids.B]);
  eq('25j externe voorganger naar de opvolger, einde-begin zonder vertraging', extOf('C'), ['predecessor FS 0 bron-1']);
  eq('25k externe opvolger naar de voorganger, einde-begin zonder vertraging', extOf('A'), ['successor FS 0 bron-1']);
  eq('25l anker van de oude relatie blijft', [taskOf('C').externalLinks?.[0]?.anchorDate, taskOf('A').externalLinks?.[0]?.anchorDate], anchors);
  S().runCPM();
  eq('25m na F5 wacht C nog steeds op de externe voorganger', timeOf('C').earlyStart >= anchors[0].slice(0, 10), true);
  S().undo();
  eq('25n undo: externe relaties terug op B', [extOf('A'), extOf('B'), extOf('C')],
    [[], ['predecessor FF 3 bron-1', 'successor SS 1 bron-1'], []]);
}
{
  const ids = plan(['B', 'C']);
  link(ids, 'B', 'C');
  S().addExternalLink(ids.B, {
    direction: 'predecessor', relType: 'SS', lagDays: 0, anchorDate: '2026-06-10T07:00', sourceMissing: false, sourceRef: westSource,
  });
  S().dissolveTasksBulk([ids.B]);
  eq('25o ander bronanker nodig: geen externe relatie', extOf('C'), []);
  const notice = S().ui.notifications.find(n => n.messageKey === 'notifications.relationsSkippedOnDissolve'
    && n.detailLines?.[0]?.params?.names === 'Project West / Fundering → C');
  eq('25p en wel gemeld', notice?.params, { count: 1 });
}
{
  const ids = plan(['P', 'B', 'D', 'C']);
  S().moveTask(ids.B, ids.P, 0);
  S().moveTask(ids.D, ids.P, 1);
  link(ids, 'B', 'C');
  S().addExternalLink(ids.P, {
    direction: 'predecessor', relType: 'FS', lagDays: 2, anchorDate: '2026-06-10T16:00', sourceMissing: false, sourceRef: westSource,
  });
  S().dissolveTasksBulk([ids.B]);
  eq('25q externe voorganger via de fase gaat naar de opvolger', [extOf('C'), extOf('P')],
    [['predecessor FS 0 bron-1'], ['predecessor FS 2 bron-1']]);
}

{
  const ids = plan(['A', 'B', 'P', 'D', 'X', 'C']);
  S().moveTask(ids.D, ids.P, 0);
  S().moveTask(ids.X, ids.P, 1);
  link(ids, 'A', 'B');
  link(ids, 'B', 'P');
  link(ids, 'D', 'C');
  S().dissolveTasksBulk([ids.B, ids.D]);
  eq('25r keten via een fase tussen twee weggehaalde taken', relations(), ['A>C FS 0', 'A>P FS 0']);
  S().runCPM();
  eq('25s na F5 start C niet vóór het einde van A', timeOf('C').earlyStart >= timeOf('A').earlyFinish, true);
}
{
  const ids = plan(['A', 'P', 'D', 'X', 'B', 'C']);
  S().moveTask(ids.D, ids.P, 0);
  S().moveTask(ids.X, ids.P, 1);
  link(ids, 'A', 'D');
  link(ids, 'P', 'B');
  link(ids, 'B', 'C');
  S().dissolveTasksBulk([ids.B, ids.D]);
  eq('25t gespiegelde keten via een fase', relations(), ['A>C FS 0', 'P>C FS 0']);
}
{
  const ids = plan(['A', 'P', 'B', 'C']);
  S().moveTask(ids.B, ids.P, 0);
  S().moveTask(ids.C, ids.P, 1);
  link(ids, 'A', 'P', 'START_START');
  link(ids, 'B', 'C');
  S().dissolveTasksBulk([ids.B]);
  eq('25u andere soort op de fase: einde-begin komt erbij', relations(), ['A>C FS 0', 'A>P SS 0']);
  S().runCPM();
  eq('25v na F5 start C niet vóór het einde van A', timeOf('C').earlyStart >= timeOf('A').earlyFinish, true);
}
{
  const ids = plan(['P', 'B', 'C']);
  S().moveTask(ids.B, ids.P, 0);
  S().moveTask(ids.C, ids.P, 1);
  link(ids, 'B', 'C');
  S().addExternalLink(ids.P, {
    direction: 'predecessor', relType: 'FF', lagDays: 0, anchorDate: '2026-06-30T16:00', sourceMissing: false, sourceRef: westSource,
  });
  S().dissolveTasksBulk([ids.B]);
  eq('25w externe einde-einde op de fase: einde-begin naar C', extOf('C'), ['predecessor FS 0 bron-1']);
  S().runCPM();
  eq('25x na F5 wacht C op het einde van de brontaak', timeOf('C').earlyStart >= '2026-06-30', true);
}
{
  const ids = plan(['A', 'P', 'B', 'C']);
  S().moveTask(ids.B, ids.P, 0);
  S().updateTask(ids.P, { isSummary: true });
  link(ids, 'A', 'P');
  link(ids, 'P', 'C');
  S().dissolveTasksBulk([ids.B]);
  S().runCPM();
  eq('25y fase leeg: na F5 start C niet vóór het einde van A', timeOf('C').earlyStart >= timeOf('A').earlyFinish, true);
}
{
  const ids = plan(['B', 'C']);
  link(ids, 'B', 'C');
  S().addExternalLink(ids.B, {
    direction: 'predecessor', relType: 'SS', lagDays: 0, anchorDate: '2026-06-10T07:00', sourceMissing: false, sourceRef: westSource,
  });
  S().addExternalLink(ids.C, {
    direction: 'predecessor', relType: 'FS', lagDays: 1, anchorDate: '2026-06-12T16:00', sourceMissing: false, sourceRef: westSource,
  });
  eq('25z bestaande externe einde-begin: niets geweigerd', planDissolve(S().tasks, S().sequences, [ids.B]).refused, []);
}
{
  const ids = plan(['A', 'P', 'D', 'X', 'Q', 'B', 'Y', 'C']);
  S().moveTask(ids.D, ids.P, 0);
  S().moveTask(ids.X, ids.P, 1);
  S().moveTask(ids.B, ids.Q, 0);
  S().moveTask(ids.Y, ids.Q, 1);
  link(ids, 'A', 'D');
  link(ids, 'P', 'Q');
  link(ids, 'B', 'C');
  S().dissolveTasksBulk([ids.D, ids.B]);
  eq('25z2 keten via een relatie tussen twee fasen', relations(), ['A>C FS 0', 'A>Q FS 0', 'P>C FS 0', 'P>Q FS 0']);
  S().runCPM();
  eq('25z3 na F5 start C niet vóór het einde van A', timeOf('C').earlyStart >= timeOf('A').earlyFinish, true);
}
{
  for (const types of [['START_START', FS], [FS, 'START_START']] as SequenceType[][]) {
    const ids = plan(['A', 'P', 'B', 'C']);
    S().moveTask(ids.B, ids.P, 0);
    S().moveTask(ids.C, ids.P, 1);
    for (const type of types) link(ids, 'A', 'P', type);
    link(ids, 'B', 'C');
    S().dissolveTasksBulk([ids.B]);
    eq(`25z4 einde-begin op de fase telt, ook als ${types[1]} later komt`, relations(), ['A>P FS 0', 'A>P SS 0']);
  }
}

const order = () => flattenOrder(S().tasks).map(t => t.name);
const parentName = (name: string) => {
  const task = S().tasks.find(t => t.name === name);
  return S().tasks.find(t => t.id === task?.parentId)?.name ?? null;
};
eq('33 standaard: de hele fase', S().ui.dissolveSummaryMode, 'branch');
S().setUI({ dissolveSummaryMode: 'header' });
{
  const ids = plan(['A', 'G', 'F', 'B1', 'B2', 'B3', 'H', 'C']);
  S().moveTask(ids.F, ids.G, 0);
  S().moveTask(ids.H, ids.G, 1);
  S().moveTask(ids.B1, ids.F, 0);
  S().moveTask(ids.B2, ids.F, 1);
  S().moveTask(ids.B3, ids.F, 2);
  link(ids, 'A', 'F', 'START_START', 2);
  link(ids, 'F', 'C');
  link(ids, 'B1', 'B2');
  link(ids, 'B2', 'C', FS, 4);
  const res = S().addResource({ name: 'Timmerman', type: 'LABOR' } as Parameters<ReturnType<typeof S>['addResource']>[0]);
  S().assignResource(ids.B1, res, 1);
  const before = appliedEvents();
  S().dissolveTasksBulk([ids.F]);
  eq('34 alleen de kopregel weg', names(), ['A', 'B1', 'B2', 'B3', 'C', 'G', 'H']);
  eq('35 subtaken schuiven op de plek van de kopregel', order(), ['A', 'G', 'B1', 'B2', 'B3', 'H', 'C']);
  eq('36 subtaken hangen nu onder de ouder van de kopregel', ['B1', 'B2', 'B3'].map(parentName), ['G', 'G', 'G']);
  eq('37 relaties van de kopregel naar begin- en eindsubtaken, met soort en vertraging', relations(), [
    'A>B1 SS 2', 'A>B3 SS 2',
    'B1>B2 FS 0', 'B2>C FS 4', 'B3>C FS 0',
  ]);
  eq('38 toewijzing van een subtaak blijft', S().assignments.map(a => a.taskId), [ids.B1]);
  eq('39 één undo-stap', appliedEvents(), before + 1);
  S().undo();
  eq('40 undo: fase terug met haar subtaken', ['B1', 'B2', 'B3'].map(parentName), ['F', 'F', 'F']);
  eq('41 undo: relaties terug', relations(), ['A>F SS 2', 'B1>B2 FS 0', 'B2>C FS 4', 'F>C FS 0']);
}
{
  const ids = plan(['A', 'F', 'S', 'S1', 'X', 'C', 'D']);
  S().moveTask(ids.S, ids.F, 0);
  S().moveTask(ids.S1, ids.S, 0);
  link(ids, 'A', 'F');
  link(ids, 'F', 'C');
  link(ids, 'C', 'X');
  link(ids, 'X', 'D');
  S().dissolveTasksBulk([ids.F, ids.X]);
  eq('42 fase op het hoogste niveau: subfase wordt een fase op het hoogste niveau', parentName('S'), null);
  eq('43 subfase op de plek van de kopregel', order(), ['A', 'S', 'S1', 'C', 'D']);
  eq('44 subfase krijgt de relaties, de gewone taak wordt overbrugd', relations(),
    ['A>S FS 0', 'C>D FS 0', 'S>C FS 0']);
}
{
  const ids = plan(['A', 'F', 'P', 'P1', 'P2', 'Q', 'Q1', 'Q2', 'C']);
  S().moveTask(ids.P, ids.F, 0);
  S().moveTask(ids.Q, ids.F, 1);
  S().moveTask(ids.P1, ids.P, 0);
  S().moveTask(ids.P2, ids.P, 1);
  S().moveTask(ids.Q1, ids.Q, 0);
  S().moveTask(ids.Q2, ids.Q, 1);
  link(ids, 'A', 'F');
  link(ids, 'F', 'C');
  link(ids, 'P1', 'Q1');
  link(ids, 'Q2', 'P2');
  S().dissolveTasksBulk([ids.F]);
  eq('44b kruislings tussen subfasen: niets valt weg', relations(),
    ['A>P1 FS 0', 'A>Q2 FS 0', 'P1>Q1 FS 0', 'P2>C FS 0', 'Q1>C FS 0', 'Q2>P2 FS 0']);
}
{
  const ids = plan(['A', 'F', 'P', 'P1', 'P2', 'Q', 'Q1', 'Q2', 'C']);
  S().moveTask(ids.P, ids.F, 0);
  S().moveTask(ids.Q, ids.F, 1);
  S().moveTask(ids.P1, ids.P, 0);
  S().moveTask(ids.P2, ids.P, 1);
  S().moveTask(ids.Q1, ids.Q, 0);
  S().moveTask(ids.Q2, ids.Q, 1);
  link(ids, 'A', 'F');
  link(ids, 'F', 'C');
  link(ids, 'P1', 'Q1');
  S().dissolveTasksBulk([ids.F]);
  eq('44c één richting: subfase als geheel waar het kan, losse taken waar het moet', relations(),
    ['A>P FS 0', 'A>Q2 FS 0', 'P1>Q1 FS 0', 'P2>C FS 0', 'Q>C FS 0']);
}
{
  const ids = plan(['F', 'B1', 'B2']);
  S().moveTask(ids.B1, ids.F, 0);
  S().moveTask(ids.B2, ids.F, 1);
  link(ids, 'B1', 'B2');
  const source = { projectId: 'west', projectName: 'Project West', taskId: 'bron-1', taskName: 'Fundering' };
  S().addExternalLink(ids.F, {
    direction: 'predecessor', relType: 'FS', lagDays: 2, anchorDate: '2026-06-10T16:00', sourceMissing: false, sourceRef: source,
  });
  S().addExternalLink(ids.F, {
    direction: 'successor', relType: 'SS', lagDays: 1, anchorDate: '2026-07-01T08:00', sourceMissing: false, sourceRef: source,
  });
  const anchors = (taskOf('F').externalLinks ?? []).map(l => l.anchorDate);
  S().runCPM();
  const startBefore = timeOf('B1').earlyStart;
  eq('44c2 vóór Dissolve telt de externe voorganger van de fase', startBefore > '2026-06-10', true);
  S().dissolveTasksBulk([ids.F]);
  const ext = (name: string) => (taskOf(name).externalLinks ?? [])
    .map(l => `${l.direction} ${l.relType} ${l.lagDays} ${l.anchorDate} ${l.sourceRef.taskId}`);
  eq('44d externe voorganger van de fase naar de eerste subtaak', ext('B1'), [`predecessor FS 2 ${anchors[0]} bron-1`]);
  eq('44e externe opvolger van de fase naar de laatste subtaak', ext('B2'), [`successor SS 1 ${anchors[1]} bron-1`]);
  S().runCPM();
  eq('44f na F5 start B1 nog steeds na de externe voorganger', timeOf('B1').earlyStart, startBefore);
}
{
  const ids = plan(['A', 'F', 'P', 'L', 'E', 'C']);
  S().moveTask(ids.P, ids.F, 0);
  S().moveTask(ids.L, ids.P, 0);
  S().moveTask(ids.E, ids.P, 1);
  useAppStore.setState((st) => {
    st.tasks.find(t => t.id === ids.E)!.isSummary = true;
    st.sequences.push({ id: 'seq-leeg', predecessorId: ids.E, successorId: ids.L, type: 'FINISH_START', lagDays: 0 });
  });
  link(ids, 'A', 'F');
  link(ids, 'F', 'C');
  S().dissolveTasksBulk([ids.F]);
  eq('44g lege WBS-fase telt niet als eerste taak', relations(), ['A>P FS 0', 'E>L FS 0', 'P>C FS 0']);
}
{
  const ids = plan(['A', 'B', 'C']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  S().dissolveTasksBulk([ids.B]);
  eq('45 gewone taak: zoals altijd', relations(), ['A>C FS 0']);
}
S().setUI({ dissolveSummaryMode: 'branch' });
{
  const registry = fs.readFileSync(path.join(process.cwd(), 'src/utils/settingsRegistry.ts'), 'utf8');
  eq('46 instelling wordt bewaard', /key: 'dissolveSummaryMode', field: 'dissolveSummaryMode'/.test(registry), true);
  const catalog = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/catalog/settingsCatalog.tsx'), 'utf8');
  eq('47 instelling staat in het gedeelde paneel', /saveDissolveSummaryMode/.test(catalog) && /settings\.dissolveSummaryMode/.test(catalog), true);
}

{
  const ids = plan(['A', 'B', 'C', 'D']);
  link(ids, 'A', 'B');
  link(ids, 'B', 'C');
  link(ids, 'C', 'D');
  S().selectTask(ids.B, false);
  S().selectTask(ids.C, true);
  contextMenuBulk.dissolve(ids.C);
  eq('29 rechtsklik binnen de selectie heft de hele selectie op', relations(), ['A>D FS 0']);
}
{
  const groups: RibbonGroupSpec[] = Object.values(RIBBON_TABS).flat();
  const ids = JSON.stringify(groups.filter(g => g.id === 'edit'));
  eq('30 lint: Dissolve in de groep Bewerken', ids.includes('"dissolve"'), true);
  const ribbon = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/Ribbon/ribbonConfig.tsx'), 'utf8');
  eq('30b lintknop: uit zonder (zichtbare) selectie, heft de selectie op',
    /useAppStore\(hasEditableSelection\)/.test(ribbon)
      && /disabled: !editable,\s*onClick: \(\) => \{\s*const s = useAppStore\.getState\(\);\s*s\.dissolveTasksBulk\(s\.selectedTaskIds\)/.test(ribbon), true);
  const menu = fs.readFileSync(path.join(process.cwd(), 'src/components/canvas/ContextMenu.tsx'), 'utf8');
  eq('31 rechtsklikmenu kent Dissolve', /context\.dissolve/.test(menu) && /onDissolve/.test(menu), true);
  for (const file of ['src/components/canvas/GanttCanvas.tsx', 'src/components/task-grid/FullTaskGrid.tsx']) {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    eq(`32 ${file} hangt Dissolve aan de gedeelde route`, /contextMenuBulk\.dissolve/.test(src), true);
  }
}

if (diffs.length > 0) {
  console.error(`XX check-dissolve-tasks: ${diffs.length} van ${checks} checks rood`);
  for (const d of diffs) console.error(`XX ${d}`);
  process.exit(1);
}
console.log(`check-dissolve-tasks: alle ${checks} checks groen`);
