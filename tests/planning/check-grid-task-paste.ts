// Plakken van een rasterkopie in een andere planning (issue #900) — headless tegen de ECHTE store.
//
// Kopieert het raster (de kolommen), dan gaan de taken ook naar het app-brede takenklembord, met de
// celtekst en de planning erbij. Het raster plakt die taken alleen in een ANDERE planning en alleen
// zolang het systeemklembord nog die tekst bevat. Anders plakt het celwaarden zoals voorheen.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { pastesGridTaskCopy } from '@/state/slices/selectionSlice';

const S = () => useAppStore.getState();
let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

S().newProject();
const a = S().activeDocumentId;
const phase = S().addTask({ name: 'Ruwbouw' });
S().addTask({ name: 'Graven', parentId: phase });
S().selectTask(phase);
const text = 'Ruwbouw\tWaar\nGraven\tJa';
S().copyTasks(undefined, text);
eq('rasterkopie: tak met kind op het takenklembord', S().taskClipboard?.tasks.length, 2);
eq('rasterkopie: herkomst vastgelegd', S().taskClipboard?.fromGrid, { text, documentId: a });
eq('zelfde planning ⇒ celwaarden', pastesGridTaskCopy(S().taskClipboard, text, a), false);

S().newDocument();
const b = S().activeDocumentId;
eq('andere planning, zelfde tekst ⇒ taken', pastesGridTaskCopy(S().taskClipboard, text, b), true);
eq('andere planning, Windows-regeleinden ⇒ taken',
  pastesGridTaskCopy(S().taskClipboard, text.replace(/\n/g, '\r\n'), b), true);
eq('andere planning, andere tekst (Excel) ⇒ celwaarden', pastesGridTaskCopy(S().taskClipboard, 'Uit Excel', b), false);

// Kopiëren buiten het raster (Gantt, contextmenu) vervangt het klembord zonder herkomst: dan plakt het
// raster weer celwaarden, ook als het systeemklembord nog de oude rastertekst heeft.
const other = S().addTask({ name: 'Elders' });
S().copyTasks([other]);
eq('kopie buiten het raster ⇒ geen herkomst', S().taskClipboard?.fromGrid ?? null, null);
eq('daarna oude rastertekst ⇒ celwaarden', pastesGridTaskCopy(S().taskClipboard, text, a), false);
eq('leeg klembord ⇒ celwaarden', pastesGridTaskCopy(null, text, b), false);

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`rasterkopie plakken: ${diffs.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`rasterkopie plakken: ${checks} checks groen`);
