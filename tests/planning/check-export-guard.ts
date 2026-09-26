// Export-guard-checks (bevinding K7) — headless tegen de ECHTE Zustand-store.
//
// Waarom deze batterij bestaat: exports schrijven `task.time.earlyStart` — de CPM-uitvoer — naar
// derden die datums contractueel lezen. `autoCalcCPM` staat standaard UIT, dus zonder guard ging
// een verouderde planning het bestand in. Bij een cyclus houdt `runCPM` de planning nu expliciet
// verouderd: `task.time` bevat immers nog de oude waarden. De foutcontrole blijft daarnaast een
// noodzakelijke tweede vangrail voor een directe, duidelijke exportfout.
//
// `exportAs` breekt bij een cyclus af VÓÓR de eerste await (en dus vóór `saveFileDialog`), zodat
// dit pad headless te draaien is zonder bestandsdialoog.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { exportGoesToRecents, exportSplitsLostNotice } from '@/state/slices/fileSlice';
import { EXPORT_FORMATS, type ExportFormat } from '@/services/formatRegistry';
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

// ── 1. Stale planning wordt vóór de export doorgerekend ──────────────────────
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

// Muteer zonder door te rekenen: de planning is nu verouderd.
setDur(a, 20);
truthy('2 mutatie zet scheduleStale', S().scheduleStale === true);
const bVoorExport = S().tasks.find(t => t.id === b)?.time.earlyStart;
eq('3 B draagt nog de OUDE datum zolang er niet gerekend is', bVoorExport, bNa1);

// De guard in exportAs moet nu zelf runCPM draaien.
await S().exportAs('csv').catch(() => undefined); // dialoog faalt headless; de guard draait ervóór
truthy('4 export heeft de planning doorgerekend (scheduleStale weg)', S().scheduleStale === false);
const bNaExport = S().tasks.find(t => t.id === b)?.time.earlyStart;
truthy('5 B is opgeschoven door de langere voorganger', bNaExport !== bVoorExport);

// ── 2. Cyclus: export weigert, en meldt waaróm ───────────────────────────────
S().newProject();
const c1 = S().addTask({ name: 'C1' });
const c2 = S().addTask({ name: 'C2' });
S().addSequence({ predecessorId: c1, successorId: c2, type: 'FINISH_START', lagDays: 0 });
// De store-route weigert een kring vooraf; een kring komt nog wel binnen zoals een importer hem
// schrijft: rechtstreeks in `sequences`.
useAppStore.setState(s => {
  s.sequences.push({ id: 'seq-kring', predecessorId: c2, successorId: c1, type: 'FINISH_START', lagDays: 0 });
});
S().runCPM();
truthy('6 opzet: de solver meldt een cyclus', !!S().cpmResult?.error);
// De mislukte solve houdt de planning verouderd: geen oude datums als actuele uitkomst tonen.
eq('7 scheduleStale blijft na de cyclus true', S().scheduleStale, true);

// Bewust met try/catch: ZONDER de guard loopt `exportAs` door naar `saveFileDialog`, en die
// klapt headless op `window is not defined`. Dat is precies de regressie die we willen zien —
// maar dan als leesbare afwijking in plaats van een stacktrace die de rest van de batterij meesleurt.
let res: { ok: boolean; error?: string };
try {
  res = await S().exportAs('csv');
} catch (err) {
  res = { ok: true, error: `exportAs liep DOOR tot de bestandsdialoog (guard weg?): ${String(err)}` };
}
eq('8 export geweigerd bij een cyclus', res.ok, false);
truthy('9 de weigering draagt de cyclus-melding',
  res.ok === false && typeof res.error === 'string' && res.error.length > 0);

// ── 3. Schone planning: export gaat gewoon door ──────────────────────────────
S().newProject();
const d1 = S().addTask({ name: 'D1' });
S().addTask({ name: 'D2' });
S().runCPM();
truthy('10 opzet: geen cyclus', !S().cpmResult?.error);
const okRes = await S().exportAs('csv').catch(() => ({ ok: true as const }));
truthy('11 schone planning wordt niet geweigerd', okRes.ok === true);
truthy('12 taak bestaat nog (guard muteert niets onnodigs)', !!S().tasks.find(t => t.id === d1));

// ── 4. Alleen echte projectbestanden komen in Recente bestanden ──────────────
// Eindreview 2026-09-12, bevinding 5: `exportAs` deed onvoorwaardelijk `pushRecent`, dus
// `<project>-voortgang.csv|xlsx` belandde in Recente bestanden — waar één klik de OPENroute start
// die het invulblad als project probeert te lezen en met een foutmelding eindigt. De regel zit in
// `exportGoesToRecents`; die is los exporteerbaar juist zodat dit zonder bestandsdialoog toetsbaar
// is. De lijst hieronder is met de hand geschreven vanuit "kan de app dit terug openen als
// project?", niet uit de implementatie teruggelezen.
const recentsVerwacht: Record<ExportFormat, boolean> = {
  ifc: true,
  csv: true,
  mspdi: true,
  p6: true,
  'progress-csv': false,
  'progress-xlsx': false,
};
for (const [format, want] of Object.entries(recentsVerwacht) as [ExportFormat, boolean][]) {
  eq(`13 recents-regel voor '${format}'`, exportGoesToRecents(format), want);
}
// Vangnet tegen een NIEUW exportformaat dat stil aan de recents wordt toegevoegd: de tabel
// hierboven moet elke `ExportFormat` noemen. `EXPORT_FORMATS` is de registry die de exportlijst
// voedt, dus een nieuw formaat verschijnt daar en valt hier meteen door de mand.
eq('14 de recents-tabel dekt elk geregistreerd exportformaat',
  EXPORT_FORMATS.map(m => m.format).filter(f => !(f in recentsVerwacht)), []);

// ── 5. Verlies van onderbrekingen naar MSPDI/P6 wordt gemeld (issue #146) ──────
// MS Project en P6 kennen een onderbreking alleen als urenverdeling van een toewijzing. Een taak met
// `splitGaps` maar ZONDER contour gaat daar dus zonder onderbreking heen — dat mag niet alleen in de
// console staan (spec, verwerkte critreview bevinding 5). `exportSplitsLostNotice` is de ene regel
// die `exportAs` na een geslaagde export toepast; los exporteerbaar zodat dit zonder bestandsdialoog
// toetsbaar is, net als `exportGoesToRecents` hierboven.
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
// IFC draagt de onderbreking (native formaat); de voortgangsbladen kennen geen stukken. CSV verliest
// hem wél maar valt bewust (nog) buiten deze melding, die over MS Project/P6 gaat — zie docs/TODO.md.
for (const format of ['ifc', 'csv', 'progress-csv', 'progress-xlsx'] as ExportFormat[]) {
  eq(`17 ${format}: geen melding`, exportSplitsLostNotice(format, S().tasks), null);
}
// Mét contour schrijven beide writers de onderbreking als spreiding mee ⇒ geen verlies, geen melding.
// De contourinhoud doet er voor deze regel niet toe (de writers kijken alleen óf er één is).
const metContour: Task[] = S().tasks.map(t => (t.id === sp
  ? { ...t, timephasedContours: [{ resourceUid: null, periods: [] }] as unknown as Task['timephasedContours'] }
  : t));
eq('18 mspdi: taak met contour ⇒ geen melding', exportSplitsLostNotice('mspdi', metContour), null);
eq('19 p6: taak met contour ⇒ geen melding', exportSplitsLostNotice('p6', metContour), null);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  export-guard-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  export-guard-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
