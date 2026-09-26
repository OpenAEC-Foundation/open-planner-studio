// Documentwissel behoudt de bronidentiteit — headless tegen de ECHTE store. De crashherstel-delta
// (`recoveryDelta.ts`) en de 'stale'-toets van automatisch opslaan vergelijken een documentbron op
// REFERENTIE (`sameIFCSource`). De lees-migratie van `tasks` bij activatie gaf altijd een nieuwe
// array, dus na elke wissel heen en terug serialiseerde de auto-save het hele document opnieuw naar
// IFC (8000 taken: ~0,5 s serialiseren en ~7 MB wegschrijven per wissel, gemeten in Node). Oorzaken:
// `normalizeTaskDurationUnits` en de bibliotheekgrens (`activationPayload`) gaven altijd nieuwe arrays.
// Deze batterij pint: A → B → A laat de bron van A referentieel gelijk, en een echte legacy-taak wordt
// nog steeds genormaliseerd.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { sameIFCSource } from '@/state/ifcSaveInput';
import { normalizeTaskDurationUnits } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();
const fails: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) fails.push(label); };
const payloadOf = (id: string) => S().getOpenDocumentPayloads().find((d) => d.id === id)!.payload;

S().addTask({ name: 'A1' });
S().addTask({ name: 'A2' });
const a = S().activeDocumentId;
const b = S().newDocument();
S().addTask({ name: 'B1' });
// Eerste activatie mag nog migreren (de projectkalender wordt bibliotheek-entry, §4.3); daarna niets.
S().switchDocument(a);
S().switchDocument(b);
const before = payloadOf(a);
S().switchDocument(a);
ok('01 A → B → A: de bron van A is referentieel dezelfde (geen herserialisatie)', sameIFCSource(before, payloadOf(a)));
ok('02 A → B → A: dezelfde takenarray', payloadOf(a).tasks === before.tasks);
S().switchDocument(b);
S().switchDocument(a);
ok('03 tweede rondje: nog steeds dezelfde bron', sameIFCSource(before, payloadOf(a)));

// De migratie zelf blijft werken: een taak zonder `durationUnit` krijgt hem, de rest blijft dezelfde.
const tasks = S().tasks.map((t) => ({ ...t, time: { ...t.time } }));
const legacy = { ...tasks[0], time: { ...tasks[0].time } } as Task;
delete (legacy.time as { durationUnit?: unknown }).durationUnit;
const mixed = [legacy, tasks[1]];
const out = normalizeTaskDurationUnits(mixed);
ok('04 legacy-taak: nieuwe array met genormaliseerde eenheid', out !== mixed && out[0].time.durationUnit === 'days');
ok('05 legacy-taak: de ongewijzigde taak blijft hetzelfde object', out[1] === mixed[1]);
ok('06 niets te doen: dezelfde array', normalizeTaskDurationUnits(tasks) === tasks);

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-document-switch-identity: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-document-switch-identity: ${checks}/${checks} groen`);
