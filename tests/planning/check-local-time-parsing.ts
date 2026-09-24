// Datums die de app zelf schrijft (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` zonder offset) zijn UTC-instants
// (§1). Twee plekken lazen ze toch via de LOKALE tijd van de machine:
//   - `computeGenerateSpan` nam `new Date('2026-01-01').getFullYear()`: in New York is dat
//     31 december 2025, dus de feestdagen werden een jaar te vroeg gegenereerd.
//   - `buildThumbnail` gaf datetimes zonder offset aan `Date.parse` (lokaal), maar date-only strings
//     worden UTC: een uurtaak en een dagtaak met dezelfde instant stonden verschoven in de miniatuur.
// De uitkomst mag dus niet van de tijdzone afhangen; de tijdzone-matrix in run.sh draait dit onder
// vijf zones.
//
// Draait via run.sh. Exit 0 = alles groen.
import { computeGenerateSpan } from '@/engine/calendar/generateCalendarHolidays';
import { buildThumbnail } from '@/utils/documents';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

eq('Generatiespanne vanaf 1 januari: startjaar zelf', computeGenerateSpan('2026-01-01', undefined), { from: 2025, to: 2029 });
eq('Generatiespanne met projecteinde op 1 januari', computeGenerateSpan('2026-01-01', '2027-01-01'), { from: 2025, to: 2028 });
eq('Generatiespanne op 31 december', computeGenerateSpan('2026-12-31', '2027-12-31'), { from: 2025, to: 2028 });

const leaf = (id: string, start: string, finish: string): Task => ({
  id, childIds: [], isMilestone: false,
  time: { earlyStart: start, earlyFinish: finish, scheduleStart: start, scheduleFinish: finish, isCritical: false },
} as unknown as Task);
const bars = buildThumbnail([
  leaf('dag', '2026-06-01', '2026-06-03'),
  leaf('uur', '2026-06-01T00:00', '2026-06-03T00:00'),
  leaf('later', '2026-06-10', '2026-06-11'),
], '#123456');
eq('Miniatuur: uur- en dagtaak op dezelfde instant beginnen gelijk',
  bars[0] && bars[1] ? bars[0].leftPct === bars[1].leftPct : 'geen balken', true);
eq('Miniatuur: uur- en dagtaak even breed', bars[0] && bars[1] ? bars[0].widthPct === bars[1].widthPct : 'geen balken', true);

if (diffs.length === 0) {
  console.log(`OK  local-time-parsing: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  local-time-parsing: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
