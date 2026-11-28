import { useAppStore } from '@/state/appStore';
import { exportGoesToRecents, exportSplitsLostNotice, withPlanOnlyExportSentence } from '@/state/slices/fileSlice';
import type { NotifyInput } from '@/state/slices/types';
import { EXPORT_FORMATS, type ExportFormat } from '@/services/formatRegistry';
import i18next from 'i18next';
import enMenu from '@/i18n/locales/en/menu.json';
import nlMenu from '@/i18n/locales/nl/menu.json';
import { exportFileSuffix } from '@/i18n/exportFileSuffix';
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
const truthy = (label: string, got: boolean) => {
  checks++;
  if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

S().newProject();
S().setProject({ name: 'K7', startDate: '2031-05-05' });
const a = S().addTask({ name: 'A' });
const b = S().addTask({ name: 'B' });
const setDur = (id: string, d: number) => {
  const t = S().tasks.find(x => x.id === id)!;
  S().updateTask(id, { time: { ...t.time, scheduleDuration: d } });
};
setDur(a, 5); setDur(b, 5);
S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
const bNa1 = S().tasks.find(t => t.id === b)?.time.earlyStart;
truthy('1 opzet: B heeft een berekende startdatum', !!bNa1);

setDur(a, 20);
truthy('2 mutatie zet scheduleStale', S().scheduleStale === true);
const bVoorExport = S().tasks.find(t => t.id === b)?.time.earlyStart;
eq('3 B draagt nog de OUDE datum zolang er niet gerekend is', bVoorExport, bNa1);

await S().exportAs('csv').catch(() => undefined);
truthy('4 export heeft de planning doorgerekend (scheduleStale weg)', S().scheduleStale === false);
const bNaExport = S().tasks.find(t => t.id === b)?.time.earlyStart;
truthy('5 B is opgeschoven door de langere voorganger', bNaExport !== bVoorExport);

S().newProject();
const c1 = S().addTask({ name: 'C1' });
const c2 = S().addTask({ name: 'C2' });
S().addSequence({ predecessorId: c1, successorId: c2, type: 'FINISH_START', lagDays: 0 });
useAppStore.setState(s => {
  s.sequences.push({ id: 'seq-kring', predecessorId: c2, successorId: c1, type: 'FINISH_START', lagDays: 0 });
});
S().runCPM();
truthy('6 opzet: de solver meldt een cyclus', !!S().cpmResult?.error);
eq('7 scheduleStale blijft na de cyclus true', S().scheduleStale, true);

let res: { ok: boolean; error?: string };
try {
  res = await S().exportAs('csv');
} catch (err) {
  res = { ok: true, error: `exportAs liep DOOR tot de bestandsdialoog (guard weg?): ${String(err)}` };
}
eq('8 export geweigerd bij een cyclus', res.ok, false);
truthy('9 de weigering draagt de cyclus-melding',
  res.ok === false && typeof res.error === 'string' && res.error.length > 0);

S().newProject();
const d1 = S().addTask({ name: 'D1' });
S().addTask({ name: 'D2' });
S().runCPM();
truthy('10 opzet: geen cyclus', !S().cpmResult?.error);
const okRes = await S().exportAs('csv').catch(() => ({ ok: true as const }));
truthy('11 schone planning wordt niet geweigerd', okRes.ok === true);
truthy('12 taak bestaat nog (guard muteert niets onnodigs)', !!S().tasks.find(t => t.id === d1));

const recentsVerwacht: Record<ExportFormat, boolean> = {
  ifc: true,
  csv: true,
  mspdi: true,
  p6: true,
  xer: true,
  'progress-xlsx': false,
};
for (const [format, want] of Object.entries(recentsVerwacht) as [ExportFormat, boolean][]) {
  eq(`13 recents-regel voor '${format}'`, exportGoesToRecents(format), want);
}
eq('14 de recents-tabel dekt elk geregistreerd exportformaat',
  EXPORT_FORMATS.map(m => m.format).filter(f => !(f in recentsVerwacht)), []);

S().newProject();
const sp = S().addTask({ name: 'Gesplitst' });
const setSpDur = (id: string, d: number) => {
  const t = S().tasks.find(x => x.id === id)!;
  S().updateTask(id, { time: { ...t.time, scheduleDuration: d } });
};
setSpDur(sp, 10);
S().setTaskSplits(sp, [
  { kind: 'work', minutes: 2400 }, { kind: 'gap', minutes: 1440, source: 'user' }, { kind: 'work', minutes: 2400 },
]);
const heel = S().addTask({ name: 'Heel' });
setSpDur(heel, 4);
truthy('15 opzet: één taak draagt een gebruikersgat', S().tasks.find(t => t.id === sp)?.splitGaps?.[0]?.source === 'user');
for (const format of ['mspdi', 'p6'] as ExportFormat[]) {
  eq(`16 ${format}: precies één melding met het aantal`, exportSplitsLostNotice(format, S().tasks), {
    severity: 'info', messageKey: 'notifications.exportSplitsLost', params: { count: 1 },
  });
}
for (const format of ['ifc', 'csv', 'progress-xlsx'] as ExportFormat[]) {
  eq(`17 ${format}: geen melding`, exportSplitsLostNotice(format, S().tasks), null);
}
const metContour: Task[] = S().tasks.map(t => (t.id === sp
  ? { ...t, timephasedContours: [{ resourceUid: null, periods: [] }] as unknown as Task['timephasedContours'] }
  : t));
eq('18 mspdi: taak met contour ⇒ geen melding', exportSplitsLostNotice('mspdi', metContour), null);
eq('19 p6: taak met contour ⇒ geen melding', exportSplitsLostNotice('p6', metContour), null);

{
  const first: NotifyInput = { severity: 'info', messageKey: 'notifications.savedViaDownload', params: { name: 'x.csv' }, dedupeKey: 'saved-via-download' };
  const loss: NotifyInput = { severity: 'info', messageKey: 'notifications.exportDataLoss', params: { format: 'CSV' }, dedupeKey: 'verlies' };
  const other: NotifyInput = { severity: 'info', messageKey: 'notifications.exportCriticalHoursLost' };
  for (const format of ['csv', 'mspdi', 'p6', 'xer', 'progress-xlsx'] as const) {
    eq(`28 ${format}: geen andere melding ⇒ een eigen melding`, withPlanOnlyExportSentence(format, true, [null]),
      [{ severity: 'info', messageKey: 'notifications.exportPlanOnly' }]);
  }
  eq('29 regel onder de laatste melding, eigen samenvouwsleutel, de rest gelijk', withPlanOnlyExportSentence('csv', true, [first, null, loss]), [
    first, { ...loss, detailLines: [{ messageKey: 'notifications.exportPlanOnly' }], dedupeKey: 'verlies:alleen-planning' },
  ]);
  eq('30 laatste melding zonder samenvouwsleutel houdt er geen', withPlanOnlyExportSentence('mspdi', true, [loss, other, null]),
    [loss, { ...other, detailLines: [{ messageKey: 'notifications.exportPlanOnly' }] }]);
  eq('31 IFC draagt het gebouwmodel: ongewijzigd', withPlanOnlyExportSentence('ifc', true, [loss, null]), [loss]);
  eq('32 zonder gebouwmodel: ongewijzigd', withPlanOnlyExportSentence('csv', false, [null, loss]), [loss]);
  eq('33 zonder gebouwmodel en zonder melding: niets', withPlanOnlyExportSentence('csv', false, [null]), []);
}

eq('20 headless voortgang heeft Engelse terugval', exportFileSuffix('progress'), 'progress');
eq('21 headless bibliotheek heeft Engelse terugval', exportFileSuffix('library'), 'library');
await i18next.init({ lng: 'nl', fallbackLng: 'en', resources: { nl: { menu: nlMenu }, en: { menu: enMenu } } });
eq('22 Nederlands voortgang', exportFileSuffix('progress'), 'voortgang');
eq('23 Nederlands bibliotheek', exportFileSuffix('library'), 'bibliotheek');
await i18next.changeLanguage('en');
eq('24 Engels voortgang', exportFileSuffix('progress'), 'progress');
eq('25 Engels bibliotheek', exportFileSuffix('library'), 'library');
await i18next.changeLanguage('fr');
eq('26 ontbrekende vertaling valt terug op Engels', exportFileSuffix('progress'), 'progress');
eq('27 ontbrekende bibliotheekvertaling valt terug op Engels', exportFileSuffix('library'), 'library');

if (diffs.length === 0) {
  console.log(`OK  export-guard-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  export-guard-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
