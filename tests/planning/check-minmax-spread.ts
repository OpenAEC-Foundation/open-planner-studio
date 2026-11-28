import { minOf, maxOf } from '@/utils/collections';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (!Object.is(got, want)) diffs.push(`${label}: verwacht ${String(want)}, kreeg ${String(got)}`);
};

for (const sample of [[], [3], [2, -1, 5], [0, -0], [-0, 0], [1, NaN, 2], [Infinity, -Infinity], [7, 7]] as number[][]) {
  eq(`minOf ${JSON.stringify(sample)} = Math.min`, minOf(sample), Math.min(...sample));
  eq(`maxOf ${JSON.stringify(sample)} = Math.max`, maxOf(sample), Math.max(...sample));
}
const big = Array.from({ length: 300_000 }, (_, i) => (i * 7919) % 100_003 - 50_000);
let err: unknown = null;
try {
  eq('minOf over 300k elementen', minOf(big), -50_000);
  eq('maxOf over 300k elementen', maxOf(big), 50_002);
} catch (e) { err = e; }
eq('geen stack-overflow bij 300k elementen', err, null);

if (diffs.length === 0) {
  console.log(`OK  minmax-spread: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  minmax-spread: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
