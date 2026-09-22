// Store-actie van het rekenprofiel (rekenprofielen, spec v3.1 §6; plan taak D3). Exit 0 = groen.
// Verwachtingen met de hand afgeleid: onder OPS schuift een niet-gestarte taak naar de statusdatum,
// onder MS Project (A23 `unstartedIgnoresStatusDate`) niet.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { SchedulingProfile } from '@/types/project';
import { loadCustomProfiles, saveCustomProfiles } from '@/services/schedulingProfiles/profileStore';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
const applied = () => S().historyEvents.filter(event => event.state === 'applied').length;

S().newProject();
S().setProject({ startDate: '2026-05-04' });
const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-04', 3) });
S().setStatusDate('2026-06-01');
S().runCPM();
eq('01 uitgangspunt: OPS zet de niet-gestarte taak op of na de statusdatum',
  (S().tasks.find(t => t.id === a)?.time.earlyStart ?? '') >= '2026-06-01', true);
const before = applied();
const result = S().applySchedulingSettings({ profile: builtInProfile('msproject'), options: undefined });
eq('02 wissel is een wijziging', result.changed, true);
eq('03 MS Project (A23) laat de taak op haar eigen start', S().tasks.find(t => t.id === a)?.time.earlyStart?.slice(0, 10), '2026-05-04');
eq('04 telling achteraf', result.shifted, 1);
eq('05 melding "1 taak verschoven"', S().ui.notifications.some(n =>
  n.messageKey === 'notifications.schedulingProfileShifted' && n.params?.count === 1), true);
eq('06 precies één undo-stap', applied(), before + 1);
eq('07 herberekend, dus niet stale', S().scheduleStale, false);
eq('07a het project heeft het profiel', S().project.schedulingProfile?.id, 'msproject');
const again = S().applySchedulingSettings({ profile: builtInProfile('msproject'), options: undefined });
eq('08 zelfde instellingen ⇒ geen wijziging en geen undo-stap', [again.changed, applied()], [false, before + 1]);
S().undo();
eq('09 undo herstelt het vorige profiel', S().project.schedulingProfile, undefined);
eq('09a …en de datums van vóór de wissel', (S().tasks.find(t => t.id === a)?.time.earlyStart ?? '') >= '2026-06-01', true);
S().redo();
eq('09b redo zet het profiel terug met de berekende datums', [S().project.schedulingProfile?.id,
  S().tasks.find(t => t.id === a)?.time.earlyStart?.slice(0, 10)], ['msproject', '2026-05-04']);
ctx.store.setState(s => { s.datesAsRecorded = true; s.scheduleStale = false; }); // fixture: modus aan
S().applySchedulingSettings({ profile: builtInProfile('p6'), options: undefined });
eq('10 een wissel verlaat "datums zoals opgeslagen"', S().datesAsRecorded, false);
S().applySchedulingSettings({ profile: builtInProfile('ops'), options: {} });
eq('11 ops-zonder-overrides en lege opties ⇒ afwezig', [S().project.schedulingProfile, S().project.schedulingOptions], [undefined, undefined]);
// De store houdt een eigen kopie: latere mutatie van het doorgegeven object raakt het project niet.
const mine: SchedulingProfile = { baseId: 'p6', id: 'prof-x', name: 'X', overrides: { clampNegativeFreeFloat: false } };
S().applySchedulingSettings({ profile: mine, options: { totalFloatMode: 'finish' } });
// Zonder kopie zou Immer het object van de aanroeper (de UI-draft) bevriezen.
eq('12b het object van de aanroeper blijft bewerkbaar', Object.isFrozen(mine.overrides), false);
if (!Object.isFrozen(mine.overrides)) mine.overrides.clampNegativeFreeFloat = true;
eq('12 eigen kopie in de store', S().project.schedulingProfile?.overrides, { clampNegativeFreeFloat: false });
eq('12a opties overgenomen', S().project.schedulingOptions, { totalFloatMode: 'finish' });
// Geen verschuiving ⇒ geen melding (alleen de gewijzigde opties, datums gelijk).
const count = () => S().ui.notifications.filter(n => n.messageKey === 'notifications.schedulingProfileShifted').length;
const n0 = count();
const r2 = S().applySchedulingSettings({ profile: S().project.schedulingProfile, options: { totalFloatMode: 'start' } });
eq('13 zonder verschoven taak geen melding', [r2.changed, r2.shifted, count()], [true, 0, n0]);

// Sjabloonopslag (M1-open punt, reviewer VERMOED): een browser zonder toegang tot `localStorage`
// (SecurityError bij het lezen van de global zelf) mag de sjabloon-UI niet laten crashen.
{
  const g = globalThis as unknown as Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(g, 'localStorage');
  Object.defineProperty(g, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  let threw = false;
  let loaded: unknown = null;
  let saved: unknown = null;
  try {
    loaded = loadCustomProfiles();
    saved = saveCustomProfiles([mine]);
  } catch { threw = true; }
  if (original) Object.defineProperty(g, 'localStorage', original); else delete g.localStorage;
  eq('14 geen throw als de localStorage-global zelf gooit', threw, false);
  eq('14a lezen levert een lege lijst, schrijven false', [loaded, saved], [[], false]);
}

if (diffs.length === 0) console.log(`OK: rekenprofiel-actie — ${checks} checks groen`);
else { console.log(`XX rekenprofiel-actie — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
