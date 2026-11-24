import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (...parts) => join(root, ...parts);
const END = 'END-ISO-10303-21;';
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export const EXAMPLE = at('examples', '01-grachtenpand-amsterdam.ifc');
export const REQUESTS = [['/v1/schedule', 'summary'], ['/v1/schedule?output=summary', 'summary'], ['/v1/schedule?output=ifc', 'ifc']];
export const MODEL_REFUSAL = 'Could not read IFC: This IFC file contains building model objects.';
export const FORMS = [
  ['kaal', b => b],
  ['met BOM', b => Buffer.concat([UTF8_BOM, b])],
  ['met BOM en een spatie', b => Buffer.concat([UTF8_BOM, Buffer.from(' '), b])],
];

const EXTERN_PSET = "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n"
  + "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\nENDSEC;\nEND-ISO-10303-21;";
const BONSAI_WALL_A_TIME = "#109=IFCTASKTIME($,$,$,$,'P5D','2026-02-02T09:00:00','2026-02-06T17:00:00',$,$,";
const BONSAI_WALL_A_STALE = "#109=IFCTASKTIME($,$,$,$,'P5D','2026-02-02T09:00:00','2026-02-06T17:00:00','2026-03-02T09:00:00','2026-03-06T17:00:00',";
const KEPT_MODELS = ['bonsai-4d.ifc', 'crlf-commentaar.ifc', 'dubbele-globalids.ifc', 'eigen-plus-model.ifc', 'latin1.ifc',
  'oud-eigen-0.1-plus-model.ifc', 'twee-werkplannen.ifc'];
const KEPT_ON_WRITE = ['oude-tags/main-df9eafc7d-woongebouw-nieuwbouw.ifc', 'oude-tags/v2026.7.2-woongebouw-nieuwbouw.ifc'];

function emptyOwnSchedule(source, looseTask) {
  const lines = source.split('\n');
  const schedule = lines.find(l => l.startsWith('#47=IFCWORKSCHEDULE('));
  const task = lines.find(l => l.startsWith('#52=IFCTASK('));
  const added = [schedule.replace(/^#47=IFCWORKSCHEDULE\('[^']*'/, "#99010=IFCWORKSCHEDULE('1SolR4BaselineSchema01'").replace('.PLANNED.);', '.BASELINE.);')];
  if (looseTask) added.push(task.replace(/^#52=IFCTASK\('[^']*',#6,'[^']*',\$,\$,'[^']*'/, "#99011=IFCTASK('1SolR4LooseTask0000001',#6,'Loose task',$,$,'99'"));
  const moved = lines.map(l => l.startsWith('#158=IFCRELNESTS(') ? l.replace(',#47,(', ',#99010,(')
    : l.startsWith('#312=IFCRELASSIGNSTOCONTROL(') ? l.replace(',$,#47);', ',$,#99010);') : l).join('\n');
  return moved.replace(`ENDSEC;\n${END}`, `${added.join('\n')}\nENDSEC;\n${END}`);
}

function projectPset(source) {
  return source.replace(`ENDSEC;\n${END}`, [
    "#99020=IFCPROPERTYSINGLEVALUE('ExternalCode',$,IFCTEXT('X-1'),$);",
    "#99021=IFCPROPERTYSET('1SolR4ExternalPset0001',#6,'ExternalMetadata',$,(#99020));",
    "#99022=IFCRELDEFINESBYPROPERTIES('1SolR4ExternalRel00001',#6,$,$,(#13),#99021);",
    'ENDSEC;', END].join('\n'));
}

function describedInSettings(source) {
  return projectPset(source.replace("IFCTEXT('Naam van een ander programma')", "IFCTEXT('Refurbishment & Extension of a Family Home')")
    .replace('#90001=IFCPROPERTYSINGLEVALUE(',
      "#90002=IFCPROPERTYSINGLEVALUE('ProjectDescription',$,IFCTEXT('Beschrijving van een ander programma'),$);\n#90001=IFCPROPERTYSINGLEVALUE(")
    .replace(',#90001));', ',#90001,#90002));'));
}

function compactXerEnvelope(source) {
  const emptySha = createHash('sha256').update(Buffer.alloc(0)).digest('hex');
  return source.replace("#5=IFCAPPLICATION(#4,'0.1',", "#5=IFCAPPLICATION(#4,'0.2',")
    .replace("'raw-source-reconstruction-v1'", "'raw-source-reconstructio\\X\\6E-v1'")
    .replace("IFCPROPERTYSINGLEVALUE('ByteLength',$,IFCINTEGER(854),$)", "IFCPROPERTYSINGLEVALUE('ByteLength',$,IFCINTEGER(0),$)")
    .replace("IFCPROPERTYSINGLEVALUE('ByteChunkCount',$,IFCINTEGER(1),$)", "IFCPROPERTYSINGLEVALUE('ByteChunkCount',$,IFCINTEGER(0),$)")
    .replace(/#18=IFCPROPERTYSINGLEVALUE\('Sha256',\$,IFCTEXT\('[0-9a-f]{64}'\),\$\)/, `#18=IFCPROPERTYSINGLEVALUE('Sha256',$,IFCTEXT('${emptySha}'),$)`);
}

const ifcFiles = (dir, prefix) => readdirSync(dir).filter(f => f.endsWith('.ifc')).sort().map(f => [`${prefix}${f}`, readFileSync(join(dir, f))]);

export function corpusCases() {
  const example = readFileSync(EXAMPLE, 'utf8');
  const exampleBytes = Buffer.from(example);
  const model = readFileSync(at('tests', 'fixtures', 'ifc-foreign', 'eigen-plus-model.ifc'), 'utf8');
  const woning = readFileSync(at('tests', 'planning', 'fixtures', 'projectnaam-in-settings', 'showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  const bonsai = readFileSync(at('tests', 'fixtures', 'ifc-foreign', 'bonsai-4d.ifc'), 'utf8');
  const legacyPlanning = example.replace(/FILE_SCHEMA\(.*?\);/, "FILE_SCHEMA(('IFC2X3'));");
  const readOtherwise = emptyOwnSchedule(example, true);
  const sources = [
    ...ifcFiles(at('examples'), ''),
    ...ifcFiles(at('public', 'examples'), 'public/'),
    ...ifcFiles(at('tests', 'planning', 'fixtures', 'oude-tags'), 'oude-tags/')
      .map(([name, body]) => [name, body, KEPT_ON_WRITE.includes(name) ? { kind: 'kept' } : { kind: 'main' }]),
    ['een IFC2X3-planning', Buffer.from(legacyPlanning)],
    ['een IFC2X3-planning met een externe pset', Buffer.from(legacyPlanning.replace(`ENDSEC;\n${END}`, EXTERN_PSET))],
    ['het voorbeeld met een leeg eigen werkschema', Buffer.from(emptyOwnSchedule(example, false))],
    ['het voorbeeld met een externe pset', Buffer.from(example.replace(`ENDSEC;\n${END}`, EXTERN_PSET)), { kind: 'kept' }],
    ...ifcFiles(at('tests', 'fixtures', 'ifc-foreign'), 'ifc-foreign/')
      .map(([name, body]) => [name, body, KEPT_MODELS.some(file => name.endsWith(`/${file}`)) ? { kind: 'model', sameAsSource: true } : { kind: 'main' }]),
    ['het voorbeeld met een leeg eigen werkschema, een baseline en een losse taak', Buffer.from(readOtherwise),
      { kind: 'refused', fields: ['counts.tasks', 'project.finish'] }],
    ['de woning met een externe pset aan het project', Buffer.from(projectPset(woning)), { kind: 'refused', fields: ['project.name'] }],
    ['de woning met een andere beschrijving in OPS_ProjectSettings', Buffer.from(describedInSettings(woning)),
      { kind: 'refused', fields: ['planning.project.description'] }],
  ];
  const special = [
    ['het voorbeeld met een dubbele BOM', Buffer.concat([UTF8_BOM, UTF8_BOM, exampleBytes])],
    ['het voorbeeld met een BOM na een spatie', Buffer.concat([Buffer.from(' '), UTF8_BOM, exampleBytes])],
    ['het voorbeeld met U+00A0 na een BOM', Buffer.concat([UTF8_BOM, Buffer.from(' '), exampleBytes])],
    ['leesfout: een lege body', Buffer.alloc(0)],
    ['leesfout: alleen witruimte', Buffer.from('  \n\t ')],
    ['leesfout: geen STEP-kop', Buffer.from('dit is geen IFC')],
    ['leesfout: een NUL vóór de kop', Buffer.concat([Buffer.from([0]), exampleBytes])],
    ['leesfout: alleen de kop', Buffer.from('ISO-10303-21;\n')],
    ['leesfout: een afgekapt voorbeeld', Buffer.from(example.slice(0, example.lastIndexOf(END)))],
    ['leesfout: een afgekapt model', Buffer.from(model.slice(0, model.lastIndexOf(END)))],
    ['leesfout: 5000 spaties na de sluitmarkering', Buffer.from(example + ' '.repeat(5000))],
    ['leesfout: geen DATA-sectie', Buffer.from(`ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4X3_ADD2'));\nENDSEC;\n${END}\n`)],
    ['leesfout: nul taken', Buffer.from(`ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\n${END}\n`)],
    ['leesfout: een ongeldige duur', Buffer.from(example.replace("'P0Y0M5D'", "'P0Y0M5X'"))],
    ['leesfout: een ongeldige duur buiten de planning die de bytes-route leest', Buffer.from(readOtherwise.replace("'P0Y0M23D'", "'P0Y0M23X'"))],
    ['leesfout: een compacte XER-envelop die de lezer zonder reconstructor bereikt',
      Buffer.from(compactXerEnvelope(readFileSync(at('tests', 'planning', 'fixtures', 'xer-archief-herschreven.ifc'), 'utf8')))],
    ['de Bonsai-planning met een vroege start die de berekening niet geeft', Buffer.from(bonsai.replace(BONSAI_WALL_A_TIME, BONSAI_WALL_A_STALE)),
      { kind: 'model-summary' }],
  ];
  return [
    ...sources.flatMap(([name, body, expect]) => FORMS.map(([form, shape]) => ({ label: `${name}, ${form}`, body: shape(body), expect: expect ?? { kind: 'main' } }))),
    ...special.map(([label, body, expect]) => ({ label, body, expect: expect ?? { kind: 'main' } })),
  ];
}

function stepArguments(text, open) {
  const args = [];
  let depth = 0;
  let quoted = false;
  let from = open + 1;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === "'" && text[i + 1] === "'") i++;
      else if (c === "'") quoted = false;
    } else if (c === "'") quoted = true;
    else if (c === '(') depth++;
    else if (c === ')' && depth > 0) depth--;
    else if ((c === ',' || c === ')') && depth === 0) {
      args.push(text.slice(from, i));
      from = i + 1;
      if (c === ')') return { args, end: i };
    }
  }
  return { args, end: text.length };
}

function maskArgument(line, entity, index) {
  const open = line.indexOf(`=${entity}(`);
  if (open < 0) return line;
  const start = open + entity.length + 1;
  const { args, end } = stepArguments(line, start);
  if (args.length <= index) return line;
  args[index] = 'SCHRIJFTIJD';
  return `${line.slice(0, start + 1)}${args.join(',')}${line.slice(end)}`;
}

export function withoutWriteFields(text) {
  return text.split('\n').map(line => {
    if (line.startsWith('FILE_NAME(')) {
      const { args, end } = stepArguments(line, 'FILE_NAME'.length);
      if (args.length > 1) args[1] = 'SCHRIJFTIJD';
      return `FILE_NAME(${args.join(',')}${line.slice(end)}`;
    }
    const owner = line.match(/=IFCOWNERHISTORY\(/);
    if (owner) {
      const { args } = stepArguments(line, owner.index + owner[0].length - 1);
      return maskArgument(line, 'IFCOWNERHISTORY', args.length - 1);
    }
    if (/=IFCWORK(PLAN|SCHEDULE)\(/.test(line)) return maskArgument(maskArgument(line, 'IFCWORKPLAN', 6), 'IFCWORKSCHEDULE', 6);
    return line.replace(/IFCPROPERTYSINGLEVALUE\('(CreatedAt|ModifiedAt)',\$,IFCTEXT\('[^']*'\),\$\)/,
      "IFCPROPERTYSINGLEVALUE('$1',$,IFCTEXT(SCHRIJFTIJD),$)");
  }).join('\n');
}

export function answerDigest(text, kind, status) {
  return createHash('sha256').update(kind === 'ifc' && status === 200 ? withoutWriteFields(text) : text).digest('hex');
}
