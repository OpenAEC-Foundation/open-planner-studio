// check-split-edit.ts — het pure bewerkmodel voor gebruikerssplits (issue #146, spec
// 2026-09-19-taken-splitsen-bewerken-design.md). Fixtures zijn GECOMMIT: het .mpp-corpus staat
// niet in de repo en is dus geen poort.
import type { TaskSplitGap } from '@/types/task';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

// ── T1: het type draagt 'user' ───────────────────────────────────────────────
const userGap: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480, source: 'user' };
eq('T1 source user typeert', userGap.source, 'user');
const importGap: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
ok('T1 source blijft optioneel', importGap.source === undefined);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  split-edit: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  split-edit: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
