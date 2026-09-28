// Regeleinden in IFC-strings overleven opslaan en openen ongewijzigd. `parseSTEP` verving vroeger
// `\r\n` door `\n` over de HELE datasectie, dus ook binnen strings: een taaknaam of notitie met
// Windows-regeleinden (bv. uit een CSV- of MSPDI-import) kwam na een round-trip anders terug. Een
// bestand met CRLF als regelscheiding tussen de entiteiten blijft gewoon leesbaar.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

S().newProject();
const id = S().addTask({ name: 'Regel 1\r\nRegel 2' });
S().addTask({ name: 'Gewoon' });
S().updateTask(id, { notes: [{ id: 'n1', text: 'eerste\r\ntweede\nderde\rvierde', done: false }] });
const text = writeIFC(buildWriteIFCInput(S()));
const back = readIFC(text);
const t = back.tasks.find((x) => x.name.startsWith('Regel 1'));
eq('taaknaam met CRLF ongewijzigd', t?.name, 'Regel 1\r\nRegel 2');
eq('notitie met CRLF, LF en CR ongewijzigd', t?.notes?.[0]?.text, 'eerste\r\ntweede\nderde\rvierde');

// Een bestand dat als geheel CRLF-regeleinden heeft (Windows-editor, ander programma) blijft leesbaar.
const crlfFile = S().tasks.length > 0 ? writeIFC(buildWriteIFCInput(S())).replace(/\n/g, '\r\n') : '';
const back2 = readIFC(crlfFile);
eq('CRLF-bestand: alle taken gelezen', back2.tasks.map((x) => x.name.replace(/\r/g, '')).sort(), ['Gewoon', 'Regel 1\nRegel 2']);

// Review 2026-09-28: sinds de STEP-codering bevat een nieuw bestand geen rauwe regeleindes meer in
// strings, dus bovenstaande raakt de fix in `parseSTEP` niet. Een eigen bestand van vóór de codering
// ('0.1', letterlijk geschreven) had ze wél rauw; dat pad hier expliciet.
const legacy = text
  .replace("'0.2','Open Planner Studio','OPS'", "'0.1','Open Planner Studio','OPS'")
  .split('\\X2\\000D000A\\X0\\').join('\r\n');
eq('oud bestand bevat een rauwe CRLF in een string', legacy.includes('Regel 1\r\nRegel 2'), true);
eq('oud bestand: taaknaam met CRLF ongewijzigd', readIFC(legacy).tasks.find((x) => x.name.startsWith('Regel 1'))?.name, 'Regel 1\r\nRegel 2');

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-ifc-crlf: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-ifc-crlf: ${checks}/${checks} groen`);
