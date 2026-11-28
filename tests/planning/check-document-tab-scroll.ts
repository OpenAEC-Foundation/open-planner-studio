import {
  DOCUMENT_TAB_HIDE_MARGIN,
  DOCUMENT_TABS_PER_SCROLL_STEP,
  documentTabNeedsArrows,
  documentTabScrollEdges,
  documentTabScrollTarget,
  wheelDeltaInPixels,
} from '@/components/layout/DocumentChrome/documentTabScroll';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

eq('past precies, geen pijlen', documentTabNeedsArrows(1000, 1000, false), false);
eq('één pixel te breed, pijlen', documentTabNeedsArrows(1001, 1000, false), true);
eq('pijlen staan, past precies: blijven staan (marge)', documentTabNeedsArrows(1000, 1000, true), true);
eq('pijlen staan, binnen de marge: blijven staan', documentTabNeedsArrows(1000, 1000 + DOCUMENT_TAB_HIDE_MARGIN - 1, true), true);
eq('pijlen staan, ruimte = inhoud + marge: weg', documentTabNeedsArrows(1000, 1000 + DOCUMENT_TAB_HIDE_MARGIN, true), false);
eq('marge is een paar pixels', DOCUMENT_TAB_HIDE_MARGIN >= 3 && DOCUMENT_TAB_HIDE_MARGIN <= 8, true);
for (let available = 990; available <= 1010; available += 0.5) {
  const shown = documentTabNeedsArrows(1000, available, false);
  if (shown) eq(`maat ${available}: verschenen pijlen blijven bij dezelfde maat`, documentTabNeedsArrows(1000, available, true), true);
}

eq('LTR begin', documentTabScrollEdges(0, 2000, 1000), { atStart: true, atEnd: false });
eq('LTR midden', documentTabScrollEdges(500, 2000, 1000), { atStart: false, atEnd: false });
eq('LTR eind (subpixel)', documentTabScrollEdges(999.5, 2000, 1000), { atStart: false, atEnd: true });
eq('RTL begin', documentTabScrollEdges(0, 2000, 1000), { atStart: true, atEnd: false });
eq('RTL eind', documentTabScrollEdges(-1000, 2000, 1000), { atStart: false, atEnd: true });
eq('geen overloop: beide uit', documentTabScrollEdges(0, 1000, 1000), { atStart: true, atEnd: true });

const starts = Array.from({ length: 12 }, (_, i) => i * 161);
const max = 12 * 161 - 3 - 1100;
eq('twee tabbladen per klik', DOCUMENT_TABS_PER_SCROLL_STEP, 2);
eq('> vanaf het begin: tabblad 3', documentTabScrollTarget(starts, 0, max, 'end'), starts[2]);
eq('> vanaf tabblad 3: tabblad 5', documentTabScrollTarget(starts, starts[2]!, max, 'end'), starts[4]);
eq('< vanaf tabblad 5: tabblad 3', documentTabScrollTarget(starts, starts[4]!, max, 'start'), starts[2]);
eq('< vanaf tabblad 2: begin', documentTabScrollTarget(starts, starts[1]!, max, 'start'), 0);
eq('> voorbij het eind: eind', documentTabScrollTarget(starts, starts[4]!, max, 'end'), max);
eq('> vanaf half tabblad 2: tabblad 4', documentTabScrollTarget(starts, starts[1]! + 60, max, 'end'), starts[3]);
eq('< vanaf half tabblad 5: tabblad 4 (half telt als stap)', documentTabScrollTarget(starts, starts[4]! + 60, max, 'start'), starts[3]);
eq('< vanaf het eind (half tabblad): uitgelijnd', documentTabScrollTarget(starts, max, max, 'start') % 161, 0);
eq('subpixel naast de rand telt als op de rand', documentTabScrollTarget(starts, starts[2]! - 0.5, max, 'end'), starts[4]);

eq('wiel in pixels', wheelDeltaInPixels(53, 0), 53);
eq('wiel in regels', wheelDeltaInPixels(3, 1), 48);

if (diffs.length > 0) {
  console.error(`document-tab-scroll: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  document-tab-scroll: alle ${checks} checks groen`);
