// Browserreview, observatie 2: `useTableRowDrag`s kandidaatfase promoveerde tot nu toe zuiver op
// |dy| >= ROW_DRAG_THRESHOLD (4px) — in de DOM-tabel begint een mousedown middenin een celwaarde,
// dus een gebruiker die een stukje tekst probeert te selecteren (mousedown + horizontaal slepen)
// haalt al snel een paar pixels verticale muisruis mee en promoveerde dan ONTERECHT tot een
// rijsleep, waardoor de tekstselectie nooit tot stand kwam. `shouldPromoteToRowDrag`
// (`src/engine/taskGrid/rowDragIntent.ts`) voegt een asintentie toe: pas promoveren als de
// verticale component de horizontale minstens evenaart, náást de bestaande drempel op |dy| zelf.
//
// Draait via run.sh. Exit 0 = alles groen.
import { shouldPromoteToRowDrag } from '@/engine/taskGrid/rowDragIntent';

const THRESHOLD = 4;

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── 1. Zuiver verticaal (de bestaande rijsleep-route) ─────────────────────────────────────────
eq('onder de drempel: geen promotie', shouldPromoteToRowDrag(0, 3, THRESHOLD), false);
eq('exact op de drempel: promoveert', shouldPromoteToRowDrag(0, 4, THRESHOLD), true);
eq('ruim over de drempel: promoveert', shouldPromoteToRowDrag(0, 20, THRESHOLD), true);
eq('negatieve dy (omhoog slepen): promoveert', shouldPromoteToRowDrag(0, -10, THRESHOLD), true);

// ── 2. Zuiver horizontaal (tekstselectie) — nooit promoveren, ongeacht hoe ver dx gaat ────────
eq('zuiver horizontaal, kleine dx: geen promotie', shouldPromoteToRowDrag(10, 0, THRESHOLD), false);
eq('zuiver horizontaal, grote dx: geen promotie', shouldPromoteToRowDrag(200, 0, THRESHOLD), false);
eq('horizontaal met dy net onder de drempel: geen promotie', shouldPromoteToRowDrag(50, 3, THRESHOLD), false);

// ── 3. Diagonaal — de kern van observatie 2: horizontaal domineert dus geen rijsleep ───────────
eq('tekstselectie met verticale ruis (dx groot, dy over de drempel maar dx > dy): geen promotie',
  shouldPromoteToRowDrag(20, 5, THRESHOLD), false);
eq('dx en dy gelijk: |dy| >= |dx| geldt, dus promoveert', shouldPromoteToRowDrag(10, 10, THRESHOLD), true);
eq('dy net over dx: promoveert', shouldPromoteToRowDrag(9, 10, THRESHOLD), true);
eq('dy net onder dx: geen promotie', shouldPromoteToRowDrag(10, 9, THRESHOLD), false);
eq('negatieve dx, overwegend verticaal: promoveert', shouldPromoteToRowDrag(-3, 15, THRESHOLD), true);
eq('negatieve dx, overwegend horizontaal: geen promotie', shouldPromoteToRowDrag(-30, 5, THRESHOLD), false);

// ── 4. Randgeval: geen enkele beweging ──────────────────────────────────────────────────────
eq('geen beweging: geen promotie', shouldPromoteToRowDrag(0, 0, THRESHOLD), false);

// ── Verslag ────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  row-drag-intent: ${checks}/${checks} groen`);
  process.exit(0);
}
for (const d of diffs) console.log(`XX  ${d}`);
console.log(`XX  row-drag-intent: ${diffs.length}/${checks} FOUT`);
process.exit(1);
