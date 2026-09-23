// Harde voorwaarden voor de nivelleer-motoretappe (onderzoek 2026-09-24 §8), corpusloos. Exit 0 = groen.
// Mutanten: een bak-4-naam naar iets anders dan zijn eigen grootheid ⇒ rood (2a); een bak-2-naam in de
// tabel opnemen ⇒ rood (2b); een terugval "onbekend ⇒ bronkolom" ⇒ rood (2c); hangende ids doorlaten ⇒ rood (1).
import { readFileSync } from 'node:fs';
import {
  isP6DialogDefaultLeveling, LEVELING_QUANTITIES, levelingPriorityQuantity, resolveLevelingPriority, resolveLevelingResources,
} from '@/services/leveling/levelingInput';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// ── 1. Hangende resource-ids vallen eruit en komen terug om te melden ─────────────────────────
{
  const got = resolveLevelingResources(
    { resources: [{ resourceId: 'r1', maxUnitsPerHour: 1 }, { resourceId: 'weg' }, { resourceId: 'r2' }] },
    new Set(['r1', 'r2']),
  );
  eq('1a hangend id gefilterd en gemeld', got, { resources: [{ resourceId: 'r1', maxUnitsPerHour: 1 }, { resourceId: 'r2' }], dangling: ['weg'] });
  eq('1b geen blok ⇒ leeg', resolveLevelingResources(undefined, new Set()), { resources: [], dangling: [] });
}

// ── 2. Gesloten mapping: elke bak-2/4-kolomnaam als sleutel ───────────────────────────────────
// De namen komen mechanisch uit de broncode van de bakkenpoort (niet overgetypt), zodat een nieuwe
// bak-naam hier vanzelf meedoet.
const whitelistSource = readFileSync(new URL('./check-xer-field-whitelist.ts', import.meta.url), 'utf8');
const bucket = (name: string): string[] => {
  const match = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`).exec(whitelistSource);
  if (!match) { diffs.push(`bak ${name} niet gevonden in check-xer-field-whitelist.ts`); return []; }
  return [...match[1]!.matchAll(/'([^']*)'/g)].map(m => m[1]!);
};
const bak4 = bucket('XER_TASK_RECORDED_OUTPUT');
const bak2 = [...bucket('XER_TASK_FORBIDDEN'), ...bucket('XER_TASK_EXTERNAL_DEPENDENCY_PROXY')];
eq('2 bakken gevonden (6 bak-4, ≥ 10 bak-2)', [bak4.length, bak2.length >= 10], [6, true]);
{
  const own: Record<string, string> = {
    early_start_date: 'earlyStart', early_end_date: 'earlyFinish', late_start_date: 'lateStart',
    late_end_date: 'lateFinish', total_float_hr_cnt: 'totalFloat', free_float_hr_cnt: 'freeFloat',
  };
  eq('2a elke bak-4-naam ⇒ de EIGEN berekende grootheid', bak4.map(name => [name, levelingPriorityQuantity(name)]),
    bak4.map(name => [name, own[name]]));
  eq('2b geen enkele bak-2-naam heeft een betekenis (nooit sturen op verboden bronuitvoer)',
    bak2.filter(name => levelingPriorityQuantity(name) !== undefined), []);
  eq('2c onbekende en prototype-namen ⇒ geen betekenis (geen terugval naar de bronkolom)',
    ['kapot', '__proto__', 'constructor', 'toString', ''].map(levelingPriorityQuantity), [undefined, undefined, undefined, undefined, undefined]);
  const all = [...bak4, ...bak2, 'priority_type', 'task_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt'];
  eq('2d elke uitkomst ligt in de gesloten verzameling eigen grootheden',
    all.map(levelingPriorityQuantity).filter(q => q !== undefined && !LEVELING_QUANTITIES.includes(q)), []);
  eq('2e prioriteitslijst: bronvolgorde, onbekend en bak 2 apart gemeld',
    resolveLevelingPriority([{ field: 'early_start_date', direction: 'ASC' }, { field: 'restart_date', direction: 'ASC' },
      { field: 'priority_type', direction: 'DESC' }]),
    { keys: [{ quantity: 'earlyStart', direction: 'ASC' }, { quantity: 'activityPriority', direction: 'DESC' }], unmapped: ['restart_date'] });
}

// ── 3. P6-dialoogdefaults (MSPDI-exportmelding alleen bij afwijking) ──────────────────────────
{
  const defaults = { preserveScheduledDates: true, levelAllResources: true, priority: [{ field: 'priority_type', direction: 'ASC' as const }] };
  eq('3a dialoogdefaults herkend', isP6DialogDefaultLeveling(defaults), true);
  eq('3b afwijkingen niet', [
    { ...defaults, preserveScheduledDates: false },
    { ...defaults, levelAllResources: undefined },
    { ...defaults, priority: [] },
    { ...defaults, priority: [{ field: 'early_start_date', direction: 'ASC' as const }] },
    { ...defaults, resources: [{ resourceId: 'r1' }] },
  ].map(isP6DialogDefaultLeveling), [false, false, false, false, false]);
}

if (diffs.length > 0) {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  leveling-input: ${diffs.length}/${checks} checks GEFAALD`);
  process.exit(1);
}
console.log(`OK  leveling-input: alle checks groen (${checks})`);
