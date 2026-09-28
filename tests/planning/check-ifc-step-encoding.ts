// Audit 2026-09-26 — STEP-tekstcodering in IFC (eigenaarsbesluit 2026-09-28).
//
// De writer schreef tekst letterlijk: `é`, `€`, `中`, emoji en regeleindes rauw, en een `\` enkel.
// Onze eigen lezer las dat terug, maar ISO 10303-21 staat in een stringliteral alleen afdrukbaar
// ASCII toe: andere IFC-pakketten tonen zulke namen verminkt, en een backslash (`C:\temp`) is voor
// hen een ongeldige escape. Nu codeert de writer (`\X2\…\X0\`, `\X4\…\X0\`, `\\`) en markeert dat met
// IFCAPPLICATION.Version '0.2'. De lezer decodeert zulke bestanden én bestanden van andere pakketten;
// oude eigen bestanden ('0.1', letterlijk) leest hij precies zoals voorheen.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC, decodeStepText } from '@/services/ifc/ifcReader';
import { encodeStepText, asciiJson } from '@/services/ifc/ifcPsets';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// 1. Encoder/decoder los: exact wat de norm voorschrijft, en verliesvrij heen en terug.
eq('encode: accent en euro', encodeStepText('Café €5'), 'Caf\\X2\\00E9\\X0\\ \\X2\\20AC\\X0\\5');
eq('encode: backslash en apostrof', encodeStepText("C:\\map 't"), "C:\\\\map ''t");
eq('encode: emoji als \\X4\\', encodeStepText('a😀b'), 'a\\X4\\0001F600\\X0\\b');
eq('encode: regeleinde en tab', encodeStepText('a\r\n\tb'), 'a\\X2\\000D000A0009\\X0\\b');
eq('encode: gewoon ASCII ongewijzigd', encodeStepText('Fase 1 (ruwbouw); klaar'), 'Fase 1 (ruwbouw); klaar');
const samples = ['Café', '中文 planning', 'emoji 😀👷 en tekst', 'C:\\temp\\nieuw', "Van 't Hof", 'a\r\nb\tc', '\uD800 los', '\\X2\\ letterlijk', '€\\€', ''];
for (const s of samples) eq(`heen en terug: ${JSON.stringify(s)}`, decodeStepText(encodeStepText(s).replace(/''/g, "'")), s);
eq('decode: \\X\\ en \\S\\ (ISO 8859-1)', decodeStepText('\\X\\E9 \\S\\i'), 'é é');
eq('decode: \\PA\\ weggelaten', decodeStepText('\\PA\\abc'), 'abc');
eq('decode: onbekende reeks blijft staan', decodeStepText('a\\Qb'), 'a\\Qb');

// 2. Echte keten: store → writeIFC → readIFC, met tekst op alle soorten plekken.
S().newProject();
S().setProject({ name: 'Café Zuidas €', description: 'Omschrijving met 中文 en C:\\pad' });
const taskName = 'Stort 😀 fundering \\ "vloer" \'noord\'';
const id = S().addTask({ name: taskName });
S().updateTask(id, { notes: [{ id: 'n1', text: 'regel 1\r\nregel 2 — ë', done: false }] });
S().saveBaseline('Basis \\ één');
const text = writeIFC(buildWriteIFCInput(S()));
const nonAscii = [...text].filter((c) => { const k = c.charCodeAt(0); return k > 0x7E || (k < 0x20 && c !== '\n'); });
eq('geschreven bestand is zuiver ASCII (alleen \\n als regelscheiding)', nonAscii.length, 0);
eq('IFCAPPLICATION draagt het formaatteken', /IFCAPPLICATION\([^)]*'0\.2','Open Planner Studio','OPS'\)/.test(text), true);
const back = readIFC(text);
eq('projectnaam', back.project.name, 'Café Zuidas €');
eq('projectomschrijving', back.project.description, 'Omschrijving met 中文 en C:\\pad');
eq('taaknaam', back.tasks.find((t) => t.id === id)?.name, taskName);
eq('notitie', back.tasks.find((t) => t.id === id)?.notes?.[0]?.text, 'regel 1\r\nregel 2 — ë');
eq('baselinenaam (JSON-pset)', back.baselines?.map((b) => b.name), ['Basis \\ één']);

// 3. Oud eigen bestand ('0.1', letterlijk geschreven): precies zoals voorheen gelezen. De JSON in een
//    pset bevatte een ge-escapete backslash als `\\`; decoderen zou die halveren en de JSON breken.
S().newProject();
const oldId = S().addTask({ name: 'PLAATSHOUDER' });
S().saveBaseline('BASISHOUDER');
const legacy = writeIFC(buildWriteIFCInput(S()))
  .replace("'0.2','Open Planner Studio','OPS'", "'0.1','Open Planner Studio','OPS'")
  .replace("'PLAATSHOUDER'", "'C:\\temp\\né ''t'")
  .split('BASISHOUDER').join('a\\\\b');
const oldBack = readIFC(legacy);
eq('oud bestand: letterlijke taaknaam', oldBack.tasks.find((t) => t.id === oldId)?.name, "C:\\temp\\né 't");
eq('oud bestand: JSON met backslash intact', oldBack.baselines?.map((b) => b.name), ['a\\b']);

// 4. Bestand van een ander pakket (geen OPS-kenmerken): gecodeerde tekst wordt gedecodeerd.
const foreign = text
  .replace("'Open Planner Studio','OPS'", "'Ander Pakket','XYZ'")
  .replace(/'OPS_/g, "'XYZ_");
const foreignBack = readIFC(foreign);
eq('ander pakket: taaknaam gedecodeerd', foreignBack.tasks.some((t) => t.name === taskName), true);
eq('ander pakket: projectnaam gedecodeerd', foreignBack.project.name, 'Café Zuidas €');

// 5. JSON-psets als ASCII-JSON (eigenaarsbesluit 2026-09-28, "beperken"): geen `\X2\` binnen JSON,
//    zodat een app van vóór '0.2' (die letterlijk leest) het blok niet als ongeldige JSON weggooit.
//    Onze lezer krijgt alles verliesvrij terug, ook emoji en een los surrogaat.
{
  eq('asciiJson: accent en emoji', asciiJson(JSON.stringify('é😀')), '"\\u00e9\\ud83d\\ude00"');
  S().newProject();
  const jid = S().addTask({ name: 'JSON-taak' });
  const noteText = 'één café 😀 \uD800 los';
  S().updateTask(jid, { notes: [{ id: 'n1', text: noteText, done: false }] });
  S().saveBaseline('Basis één');
  const jsonText = writeIFC(buildWriteIFCInput(S()));
  const jsonLines = jsonText.split('\n').filter((l) => /IFCPROPERTYSINGLEVALUE\('(Notes|Baselines)'/.test(l));
  eq('Notes- en Baselines-pset gevonden', jsonLines.length, 2);
  eq('geen \\X2\\/\\X4\\ binnen een JSON-pset', jsonLines.some((l) => /\\X[24]\\/.test(l)), false);
  eq('accent als \\u-escape (backslash STEP-verdubbeld)', jsonLines.every((l) => l.includes('\\\\u00e9')), true);
  const jsonBack = readIFC(jsonText);
  eq('notitie verliesvrij terug', jsonBack.tasks.find((t) => t.id === jid)?.notes?.[0]?.text, noteText);
  eq('baselinenaam verliesvrij terug', jsonBack.baselines?.map((b) => b.name), ['Basis één']);
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`XX  ifc-step-encoding: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`OK  ifc-step-encoding: alle checks groen (${checks})`);
