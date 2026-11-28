import { localNowOnDayAxis, localTodayIso, parseDate, MS_PER_DAY } from '@/utils/dateUtils';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

for (const [h, m] of [[0, 30], [12, 0], [23, 45]] as const) {
  const now = new Date(2026, 2, 1, h, m, 0, 0);
  const onAxis = localNowOnDayAxis(now);
  const tag = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} lokaal`;
  eq(`${tag}: lokale datum`, localTodayIso(now), '2026-03-01');
  eq(`${tag}: op de as in de kolom van de lokale dag`, onAxis.toISOString().slice(0, 10), '2026-03-01');
  eq(`${tag}: fractie van de dag = lokale wandklok`,
    (onAxis.getTime() - parseDate('2026-03-01').getTime()) / MS_PER_DAY, (h * 60 + m) / 1440);
}

if (diffs.length === 0) {
  console.log(`OK  vandaag-lokaal: alle checks groen (${checks}, TZ=${process.env.TZ ?? '(systeem)'})`);
  process.exit(0);
} else {
  console.log(`XX  vandaag-lokaal: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
