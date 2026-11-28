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

eq('onder de drempel: geen promotie', shouldPromoteToRowDrag(0, 3, THRESHOLD), false);
eq('exact op de drempel: promoveert', shouldPromoteToRowDrag(0, 4, THRESHOLD), true);
eq('ruim over de drempel: promoveert', shouldPromoteToRowDrag(0, 20, THRESHOLD), true);
eq('negatieve dy (omhoog slepen): promoveert', shouldPromoteToRowDrag(0, -10, THRESHOLD), true);

eq('zuiver horizontaal, kleine dx: geen promotie', shouldPromoteToRowDrag(10, 0, THRESHOLD), false);
eq('zuiver horizontaal, grote dx: geen promotie', shouldPromoteToRowDrag(200, 0, THRESHOLD), false);
eq('horizontaal met dy net onder de drempel: geen promotie', shouldPromoteToRowDrag(50, 3, THRESHOLD), false);

eq('tekstselectie met verticale ruis (dx groot, dy over de drempel maar dx > dy): geen promotie',
  shouldPromoteToRowDrag(20, 5, THRESHOLD), false);
eq('dx en dy gelijk: |dy| >= |dx| geldt, dus promoveert', shouldPromoteToRowDrag(10, 10, THRESHOLD), true);
eq('dy net over dx: promoveert', shouldPromoteToRowDrag(9, 10, THRESHOLD), true);
eq('dy net onder dx: geen promotie', shouldPromoteToRowDrag(10, 9, THRESHOLD), false);
eq('negatieve dx, overwegend verticaal: promoveert', shouldPromoteToRowDrag(-3, 15, THRESHOLD), true);
eq('negatieve dx, overwegend horizontaal: geen promotie', shouldPromoteToRowDrag(-30, 5, THRESHOLD), false);

eq('geen beweging: geen promotie', shouldPromoteToRowDrag(0, 0, THRESHOLD), false);

if (diffs.length === 0) {
  console.log(`OK  row-drag-intent: ${checks}/${checks} groen`);
  process.exit(0);
}
for (const d of diffs) console.log(`XX  ${d}`);
console.log(`XX  row-drag-intent: ${diffs.length}/${checks} FOUT`);
process.exit(1);
