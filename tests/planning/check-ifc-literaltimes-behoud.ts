// Knownbug 1026: een kalender die bij het openen `LiteralTimes` had, blijft letterlijk bij opslaan (besluit Trias, wrakko
// 10 november 2026, optie a; `DocumentPayload.ifcLiteralCalendarIds`). Headless tegen de echte store en de echte
// open-route. Bewaakt:
//   1. `fixtures/1026-voor.ifc` (het bestand van de sessie IFCX): wis '1. Preparation' (met haar vijf kinderen) en sla op.
//      `LiteralTimes` blijft staan, en de eindtijden (ScheduleFinish, EarlyFinish, LateFinish) van alle 51 taken die
//      blijven zijn gelijk aan het bestand vóór het wissen, dus 16:00 en niet 07:00. Zonder het veld (zoals main)
//      gaan ze naar 07:00: zo is te zien dat de check de bug vangt;
//   2. over sessies heen: het opgeslagen bestand opnieuw openen geeft dezelfde letterlijke kalender, ook na nog een keer
//      opslaan en openen (dan is opslaan byte-gelijk);
//   3. zonder bewerking verandert het veld niets: voor elk voorbeeld in `public/examples/` en `examples/` is opslaan met
//      en zonder het veld byte-gelijk, en een voorbeeld zonder `LiteralTimes` krijgt geen veld.
// Exit 0 = alles groen.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
installBrowserStubs();
const reseed = installDeterminism();
console.error = () => {};
console.warn = () => {};

const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
type Store = ReturnType<typeof createAppStoreContext>['store'];

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
};

async function open(name: string, content: string): Promise<Store> {
  reseed(0x1026);
  const store = createAppStoreContext().store;
  await store.getState().openOpenedFile({ name, content, ref: { kind: 'path', path: `/tmp/ops-1026/${name}` } });
  return store;
}
const save = (store: Store) => writeIFC(buildWriteIFCInput(store.getState()));
/** Zoals main: zonder het nieuwe veld. */
const saveWithoutField = (store: Store) => writeIFC(buildWriteIFCInput({ ...store.getState(), ifcLiteralCalendarIds: null }));

/** Naam van de taak → [ScheduleFinish, EarlyFinish, LateFinish] uit de `IFCTASKTIME`-regels. */
function finishes(ifc: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of ifc.matchAll(/IFCTASKTIME\('((?:[^']|'')*) Time',([^\n]*)\);/g)) {
    const slots = m[2].split(',');
    // Na de naam: 1 DataOrigin, 2 UserDefined, 3 DurationType, 4 ScheduleDuration, 5 ScheduleStart, 6 ScheduleFinish,
    // 7 EarlyStart, 8 EarlyFinish, 9 LateStart, 10 LateFinish.
    out.set(m[1], [slots[5], slots[7], slots[9]]);
  }
  return out;
}

// ── 1 en 2. 1026-voor.ifc: wissen, opslaan, heropenen ──────────────────────────────────────────────────────────────
{
  const voor = readFileSync(join(ROOT, 'tests/planning/fixtures/1026-voor.ifc'), 'utf8');
  const store = await open('1026-voor.ifc', voor);
  const S = () => store.getState();
  eq('1026: de projectkalender had LiteralTimes', S().ifcLiteralCalendarIds, ['cal-default']);
  eq('1026: zonder bewerking maakt het veld niets uit', save(store) === saveWithoutField(store), true);
  const prep = S().tasks.find(t => t.name === '1. Preparation')!;
  eq('1026: voorwaarde, 57 taken en een fase met vijf kinderen', [S().tasks.length, prep.childIds.length], [57, 5]);
  S().deleteTask(prep.id);
  eq('1026: na het wissen 51 taken', S().tasks.length, 51);
  const na = save(store);
  eq('1026: LiteralTimes blijft staan', na.includes("IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.T.),$)"), true);
  const before = finishes(voor);
  const after = finishes(na);
  const names = S().tasks.map(t => t.name);
  eq('1026: elke taak die blijft, staat in het bestand', names.filter(n => !after.has(n)), []);
  const changed = names.filter(n => JSON.stringify(after.get(n)) !== JSON.stringify(before.get(n)));
  eq('1026: de eindtijden van de 51 taken die blijven, zijn gelijk aan vóór het wissen', changed, []);
  const at16 = names.filter(n => after.get(n)?.[0]?.endsWith("T16:00:00'"));
  eq('1026: alle 51 ScheduleFinish staan op 16:00', at16.length, 51);
  // Zonder het veld (main): de kalender wordt een ankerkalender en de eindtijden springen naar 07:00.
  const mainLike = finishes(saveWithoutField(store));
  eq('1026, controle zoals main: ScheduleFinish van "2. Earthworks & foundations" wordt 07:00',
    mainLike.get('2. Earthworks & foundations')?.[0], "'2027-03-05T07:00:00'");
  // 2. Over sessies heen: het bestand draagt LiteralTimes weer, dus heropenen houdt de kalender letterlijk.
  const reopened = await open('1026-na.ifc', na);
  eq('1026, heropend: de kalender is weer letterlijk', reopened.getState().ifcLiteralCalendarIds, ['cal-default']);
  const second = save(reopened);
  eq('1026, heropend en opgeslagen: LiteralTimes staat er nog', second.includes("IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.T.),$)"), true);
  // Het eerste heropenen rekent de planning opnieuw (na het wissen was ze niet herberekend; zo ook op main). Vanaf
  // daar is opslaan en heropenen stabiel.
  const third = await open('1026-na-2.ifc', second);
  eq('1026, tweede keer heropend: de kalender is letterlijk en opslaan is byte-gelijk',
    [third.getState().ifcLiteralCalendarIds, save(third) === second], [['cal-default'], true]);
}

// ── 3. Zonder bewerking verandert het veld niets ──────────────────────────────────────────────────────────────────
{
  let withLiteral = 0;
  let without = 0;
  for (const dir of ['public/examples', 'examples']) {
    for (const file of readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.ifc')).sort()) {
      const text = readFileSync(join(ROOT, dir, file), 'utf8');
      const store = await open(file, text);
      const literal = text.includes("'LiteralTimes'");
      if (literal) withLiteral++; else without++;
      if (!literal) eq(`${dir}/${file}: zonder LiteralTimes geen veld`, store.getState().ifcLiteralCalendarIds, null);
      eq(`${dir}/${file}: opslaan met en zonder het veld byte-gelijk`, save(store) === saveWithoutField(store), true);
    }
  }
  console.log(`..  voorbeelden: ${withLiteral} met LiteralTimes, ${without} zonder`);
}

if (diffs.length > 0) {
  console.log(`XX  ifc-literaltimes-behoud: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-literaltimes-behoud: alle checks groen (${checks})`);
process.exit(0);
