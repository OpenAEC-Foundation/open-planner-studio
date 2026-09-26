// Audit 2026-09-26 — "vandaag" is de KALENDERDAG van de gebruiker, niet de UTC-dag.
//
// De Gantt-as rekent in UTC-middernachten. `new Date()` is het echte UTC-moment: de vandaag-lijn
// (scherm én print) stond daardoor in Nederland tussen 00:00 en 02:00 in de kolom van gisteren en in
// de VS 's avonds al in die van morgen; `formatDate(new Date())` (nieuwe projectstart, Ctrl+Home,
// rapportperiode, import-terugvallen) gaf dezelfde verkeerde dag. `localNowOnDayAxis` zet de lokale
// wandklok als UTC-velden neer; `localTodayIso` geeft de lokale datum. Deze check draait ook in de
// tijdzone-matrix van run.sh — de verwachtingen hangen dus bewust alleen af van LOKALE velden.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { localNowOnDayAxis, localTodayIso, parseDate, MS_PER_DAY } from '@/utils/dateUtils';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// Lokale momenten vlak na middernacht, midden op de dag en vlak vóór middernacht.
for (const [h, m] of [[0, 30], [12, 0], [23, 45]] as const) {
  const now = new Date(2026, 2, 1, h, m, 0, 0); // 1 maart 2026, LOKAAL
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
