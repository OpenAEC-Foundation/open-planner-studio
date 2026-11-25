import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { loadStore, openInStore } from './ifcAppRoute';

declare const process: { exit(code: number): never };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NAME = 'check-ifc-kalender-zonder-werktijden';
let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}

type Store = Awaited<ReturnType<typeof openInStore>>['store'];
const readText = (rel: string) => readFileSync(join(ROOT, rel), 'latin1');
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const find = (store: Store, name: string): Task | undefined => store.getState().tasks.find(t => t.name === name);
const timing = (t: Task | undefined) => t && {
  duur: [t.time.scheduleDuration, t.time.durationUnit, t.time.durationMinutes ?? null],
  vroeg: [t.time.earlyStart, t.time.earlyFinish], laat: [t.time.lateStart, t.time.lateFinish],
};
const week = (c: WorkCalendar) => c.workTime
  ? Object.fromEntries(Object.entries(c.workTime.byWeekday).map(([d, b]) => [d, (b ?? []).map(x => `${x.start}-${x.end}`).join(',')]))
  : null;
const MA_VR_07_16 = { 1: '420-960', 2: '420-960', 3: '420-960', 4: '420-960', 5: '420-960', 6: '', 7: '' };

async function openPlain(text: string): Promise<Store> {
  const { createAppStoreContext } = await loadStore();
  const { store } = createAppStoreContext();
  let failure: unknown;
  const realError = console.error;
  console.error = (...args: unknown[]) => { if (args[0] === 'Failed to open file:') failure = args[1]; else realError(...args); };
  try {
    await store.getState().openOpenedFile({ name: 'oud-eigen.ifc', content: text, ref: null });
  } finally {
    console.error = realError;
  }
  if (failure !== undefined) throw failure;
  return store;
}

async function bothMoments(store: Store, assert: (moment: string) => void): Promise<void> {
  assert('na openen');
  store.getState().runCPM();
  assert('na F5');
}

{
  const { store } = await openInStore(latin1(readText('tests/fixtures/ifc-foreign/bonsai-4d.ifc')), 'bonsai-4d.ifc');
  await bothMoments(store, (moment) => {
    const label = `(a) bonsai-4d.ifc, ${moment}`;
    same(`${label}: geen rekenfout`, store.getState().cpmResult?.error ?? null, null);
    same(`${label}: de kalender zonder WorkingTimes werkt ma–vr 07:00–16:00`, week(store.getState().calendar), MA_VR_07_16);
    same(`${label}: Wand A bouwen duurt 5 werkdagen, ma 2 feb 09:00 tot ma 9 feb 09:00`, timing(find(store, 'Wand A bouwen')), {
      duur: [5, 'days', null], vroeg: ['2026-02-02T09:00', '2026-02-09T09:00'], laat: ['2026-02-02T09:00', '2026-02-09T09:00'],
    });
    same(`${label}: Wand B bouwen begint op het einde van Wand A en duurt 5 werkdagen`, timing(find(store, 'Wand B bouwen')), {
      duur: [5, 'days', null], vroeg: ['2026-02-09T09:00', '2026-02-16T09:00'], laat: ['2026-02-09T09:00', '2026-02-16T09:00'],
    });
  });
}

{
  const rel = 'tests/planning/fixtures/oude-tags/v2026.9.0-urentaak-10-villa-wassenaar.ifc';
  const own = readText(rel);
  const calendarLine = "'Standard construction calendar: Mon-Fri 07:00-16:00',$,(#16),(#17,";
  const withoutWorkingTimes = own.replace(calendarLine, "'Standard construction calendar: Mon-Fri 07:00-16:00',$,$,(#17,");
  same('(b) voorwaarde: de kalender van v2026.9.0 staat één keer in de bron, met WorkingTimes (#16)', own.split(calendarLine).length, 2);
  const setUp = { duur: [0.4444444444444444, 'hours', 240], vroeg: ['2027-03-01T07:00', '2027-03-01T11:00'] };
  const routes: [string, () => Promise<Store>][] = [
    ['zoals opgeslagen, flag uit', () => openPlain(own)],
    ['zonder WorkingTimes in de kalender, flag uit', () => openPlain(withoutWorkingTimes)],
    ['zonder WorkingTimes in de kalender, flag aan', async () => (await openInStore(latin1(withoutWorkingTimes), 'oud-eigen.ifc')).store],
  ];
  for (const [variant, open] of routes) {
    const store = await open();
    await bothMoments(store, (moment) => {
      const label = `(b) ${rel.split('/').pop()} ${variant}, ${moment}`;
      same(`${label}: geen rekenfout`, store.getState().cpmResult?.error ?? null, null);
      same(`${label}: de kalender werkt ma–vr 07:00–16:00`, week(store.getState().calendar), MA_VR_07_16);
      const t = timing(find(store, 'Set up site'));
      same(`${label}: de urentaak Set up site houdt haar 4 uur, 07:00 tot 11:00`, t && { duur: t.duur, vroeg: t.vroeg }, setUp);
    });
  }
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ${f}`);
  console.log(`XX  ${NAME}: ${failures.length} van ${checks} controles mislukt`);
  process.exit(1);
}
console.log(`OK  ${NAME}: ${checks} controles groen`);
