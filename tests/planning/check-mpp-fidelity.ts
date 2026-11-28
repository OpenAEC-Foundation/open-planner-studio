// Bron: MPXJ `FieldMap14`, `PropsKey` en `MPP14Reader` als referentie voor de offsets van de fixtures (LGPL-2.1, github.com/joniles/mpxj).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { measureFidelity, solveMppBytes, classify, type FidelityRow } from './mppFidelity';
import { scanGroundTruthTasks } from './mppGroundTruth';
import { readMPP } from '@/services/mpp/mppReader';
import { useAppStore } from '@/state/appStore';
import { getTimestamp } from '@/services/mpp/mppPrimitives';
import { TaskFieldId } from '@/services/mpp/fieldMap14';
import {
  encodeCompObjFileFormat, encodePropsSingleByteEntry, buildTwoRootStreamsCfb,
  encodeAsciiWithTerminator, encodePropsEntries, buildVarMetaBytes, buildNestedCfb, type CfbTreeNode,
} from './mppFixtures';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const REPORT = process.env.OPS_MPP_FIDELITY_REPORT;

eq('M1 classify: exacte uurinstant', classify('2026-01-05T08:00', '2026-01-05T08:00'), 'exact');
eq('M1 classify: date-only vs middernacht-instant is exact', classify('2026-01-05', '2026-01-05T00:00'), 'exact');
eq('M1 classify: zelfde dag, andere klokstand → sameday', classify('2026-01-05T08:00', '2026-01-05T17:00'), 'sameday');
eq('M1 classify: andere dag → diff', classify('2026-01-06T08:00', '2026-01-05T08:00'), 'diff');
eq('M1 classify: geen grondwaarheid → missing', classify('2026-01-05T08:00', null), 'missing');
eq('M1 classify: geen eigen waarde → missing', classify(undefined, '2026-01-05T08:00'), 'missing');

{
  const row = measureFidelity(new Uint8Array(0));
  eq('M1 measureFidelity(lege bytes): status === error', row.status, 'error');
  truthy('M1 measureFidelity(lege bytes): errMsg gezet', !!row.errMsg);
}

{
  const MPP_PASSWORD_FLAG_KEY = 893386752;
  const compObj = encodeCompObjFileFormat('MSProject.MPP12');
  const props14 = encodePropsSingleByteEntry(MPP_PASSWORD_FLAG_KEY, 0);
  const legacyBytes = buildTwoRootStreamsCfb('\x01CompObj', compObj, 'Props14', props14);
  const row = measureFidelity(legacyBytes);
  eq('M1 measureFidelity(gefingeerd MPP12): status === rejected', row.status, 'rejected');
  eq("M1 measureFidelity(gefingeerd MPP12): errCode === 'MPP_LEGACY'", row.errCode, 'MPP_LEGACY');
}

{
  const Z1_PASSWORD_FLAG_KEY = 893386752;
  const Z1_BLOCK0_ITEM_SIZE = 90;
  const Z1_BLOCK1_ITEM_SIZE = 72;
  const Z1_FIXED2_META_ITEM_SIZE = 92;
  const Z1_FIRST_TASK_INDEX = 3;

  interface Z1Ts { time: number; days: number }
  interface Z1TaskSpec {
    uniqueId: number; id: number; name: string; manual: boolean;
    schedStart: Z1Ts; schedFinish: Z1Ts;
    rawStart?: Z1Ts | null; rawFinish?: Z1Ts | null;
  }

  function z1WriteTs(view: DataView, offset: number, ts: Z1Ts | null | undefined): void {
    view.setUint16(offset, ts?.time ?? 0, true);
    view.setUint16(offset + 2, ts?.days ?? 0, true);
  }

  function z1EncodeUnicodeStringAscii(s: string): Uint8Array {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  }

  function z1EncodeCompObjWithVersion(applicationName: string, fileFormat: string): Uint8Array {
    const nameBytes = encodeAsciiWithTerminator(applicationName);
    const fmtBytes = encodeAsciiWithTerminator(fileFormat);
    const out = new Uint8Array(28 + 4 + nameBytes.length + 4 + fmtBytes.length + 4);
    const view = new DataView(out.buffer);
    let pos = 28;
    view.setInt32(pos, nameBytes.length, true); pos += 4;
    out.set(nameBytes, pos); pos += nameBytes.length;
    view.setInt32(pos, fmtBytes.length, true); pos += 4;
    out.set(fmtBytes, pos); pos += fmtBytes.length;
    view.setInt32(pos, 0, true);
    return out;
  }

  function buildZ1Fixture(opts: {
    tasks: Z1TaskSpec[];
    applicationName?: string;
    includeFixed2Streams?: boolean;
    taskModeOffset?: number;
    taskModeMask?: number;
    fixed2DataTruncateTo?: number;
    corruptFixed2Meta?: boolean;
  }): Uint8Array {
    const n = opts.tasks.length;
    const includeFixed2 = opts.includeFixed2Streams ?? true;
    const tmOffset = opts.taskModeOffset ?? 8;
    const tmMask = opts.taskModeMask ?? 0x08;

    const metas0: Uint8Array[] = [new Uint8Array(47), new Uint8Array(47), new Uint8Array(47)];
    const dataBlob0 = new Uint8Array((3 + n) * Z1_BLOCK0_ITEM_SIZE);
    opts.tasks.forEach((t, i) => {
      const idx = Z1_FIRST_TASK_INDEX + i;
      const meta = new Uint8Array(47);
      new DataView(meta.buffer).setInt32(4, idx * Z1_BLOCK0_ITEM_SIZE, true);
      metas0.push(meta);
      const rec = new Uint8Array(Z1_BLOCK0_ITEM_SIZE);
      const rv = new DataView(rec.buffer);
      rv.setInt32(0, t.uniqueId, true);
      rv.setInt32(4, t.id, true);
      z1WriteTs(rv, 64, t.schedStart);
      z1WriteTs(rv, 68, t.schedFinish);
      dataBlob0.set(rec, idx * Z1_BLOCK0_ITEM_SIZE);
    });
    const fixedMetaBlob = new Uint8Array(16 + metas0.length * 47);
    {
      const v = new DataView(fixedMetaBlob.buffer);
      v.setUint32(0, 0xfadfadba, true);
      v.setInt32(8, metas0.length, true);
      metas0.forEach((m, i) => fixedMetaBlob.set(m, 16 + i * 47));
    }

    let nameOffset = 0;
    const varMetaEntries: { uniqueId: number; type: number; offset: number }[] = [];
    const namePayloads: { offset: number; payload: Uint8Array }[] = [];
    for (const t of opts.tasks) {
      varMetaEntries.push({ uniqueId: t.uniqueId, type: TaskFieldId.Name, offset: nameOffset });
      const payload = z1EncodeUnicodeStringAscii(t.name);
      namePayloads.push({ offset: nameOffset, payload });
      nameOffset += 4 + payload.length;
    }
    const varMetaBytes = buildVarMetaBytes(varMetaEntries);
    const var2DataBuf = new Uint8Array(Math.max(nameOffset, 1));
    {
      const v = new DataView(var2DataBuf.buffer);
      for (const { offset, payload } of namePayloads) {
        v.setInt32(offset, payload.length, true);
        var2DataBuf.set(payload, offset + 4);
      }
    }

    const children: Record<string, CfbTreeNode> = {
      FixedMeta: { data: fixedMetaBlob },
      FixedData: { data: dataBlob0 },
      VarMeta: { data: varMetaBytes },
      Var2Data: { data: var2DataBuf },
    };

    if (includeFixed2) {
      const itemCount2 = 3 + n;
      const fixed2MetaBlob = new Uint8Array(16 + itemCount2 * Z1_FIXED2_META_ITEM_SIZE);
      {
        const v = new DataView(fixed2MetaBlob.buffer);
        v.setUint32(0, 0xfadfadba, true);
        v.setInt32(8, itemCount2, true);
      }
      let data2Blob = new Uint8Array((3 + n) * Z1_BLOCK1_ITEM_SIZE);
      const mv = new DataView(fixed2MetaBlob.buffer);
      opts.tasks.forEach((t, i) => {
        const idx = Z1_FIRST_TASK_INDEX + i;
        const metaOff = 16 + idx * Z1_FIXED2_META_ITEM_SIZE;
        mv.setInt32(metaOff + 4, idx * Z1_BLOCK1_ITEM_SIZE, true);
        if (t.manual) mv.setUint8(metaOff + tmOffset, tmMask);
        const rec = new Uint8Array(Z1_BLOCK1_ITEM_SIZE);
        const rv = new DataView(rec.buffer);
        z1WriteTs(rv, 50, t.rawStart);
        z1WriteTs(rv, 54, t.rawFinish);
        data2Blob.set(rec, idx * Z1_BLOCK1_ITEM_SIZE);
      });
      if (opts.fixed2DataTruncateTo !== undefined) data2Blob = data2Blob.subarray(0, opts.fixed2DataTruncateTo);
      if (opts.corruptFixed2Meta) mv.setUint32(0, 0, true);
      children.Fixed2Meta = { data: fixed2MetaBlob };
      children.Fixed2Data = { data: data2Blob };
    }

    const compObj = opts.applicationName
      ? z1EncodeCompObjWithVersion(opts.applicationName, 'MSProject.MPP14')
      : encodeCompObjFileFormat('MSProject.MPP14');
    const tree: Record<string, CfbTreeNode> = {
      '\x01CompObj': { data: compObj },
      Props14: { data: encodePropsSingleByteEntry(Z1_PASSWORD_FLAG_KEY, 0) },
      '   114': {
        children: {
          Props: { data: encodePropsEntries([]) },
          TBkndTask: { children },
        },
      },
    };
    return buildNestedCfb(tree);
  }

  function z1ExpectedDate(ts: Z1Ts): Date {
    const buf = new Uint8Array(4);
    const v = new DataView(buf.buffer);
    v.setUint16(0, ts.time, true);
    v.setUint16(2, ts.days, true);
    const d = getTimestamp(buf, 0, 'z1-expected');
    if (!d) throw new Error('z1ExpectedDate: onverwacht null (kies days > 1)');
    return d;
  }

  {
    const autoSpec: Z1TaskSpec = {
      uniqueId: 101, id: 1, name: 'TaskAuto', manual: false,
      schedStart: { time: 4800, days: 15000 }, schedFinish: { time: 9600, days: 15000 },
      rawStart: { time: 4800, days: 15005 }, rawFinish: { time: 9600, days: 15005 },
    };
    const manualSpec: Z1TaskSpec = {
      uniqueId: 102, id: 2, name: 'TaskManual', manual: true,
      schedStart: { time: 4800, days: 15000 }, schedFinish: { time: 9600, days: 15000 },
      rawStart: { time: 7200, days: 15002 }, rawFinish: { time: 9600, days: 15003 },
    };
    const bytes = buildZ1Fixture({ tasks: [autoSpec, manualSpec] });
    const { raws } = scanGroundTruthTasks(bytes);
    eq('Z1 fixture: 2 taken gelezen', raws.length, 2);
    if (raws.length === 2) {
      truthy('Z1 AUTO-taak: start === SCHEDULED_START (35), niet het rauwe 1283', raws[0].start?.getTime() === z1ExpectedDate(autoSpec.schedStart).getTime());
      truthy('Z1 AUTO-taak: finish === SCHEDULED_FINISH (36), niet het rauwe 1284', raws[0].finish?.getTime() === z1ExpectedDate(autoSpec.schedFinish).getTime());
      truthy('Z1 MANUAL-taak: start === rauwe START (1283), niet SCHEDULED_START', raws[1].start?.getTime() === z1ExpectedDate(manualSpec.rawStart!).getTime());
      truthy('Z1 MANUAL-taak: finish === rauwe FINISH (1284), niet SCHEDULED_FINISH', raws[1].finish?.getTime() === z1ExpectedDate(manualSpec.rawFinish!).getTime());
    }
  }

  {
    const manual2013: Z1TaskSpec = {
      uniqueId: 201, id: 1, name: 'Manual2013', manual: true,
      schedStart: { time: 4800, days: 16000 }, schedFinish: { time: 9600, days: 16000 },
      rawStart: { time: 7200, days: 16002 }, rawFinish: { time: 9600, days: 16003 },
    };
    const bytes = buildZ1Fixture({
      tasks: [manual2013], applicationName: 'Microsoft.Project 16.0', taskModeOffset: 8, taskModeMask: 0x80,
    });
    const { raws } = scanGroundTruthTasks(bytes);
    eq('Z1 2013+-fixture: 1 taak gelezen', raws.length, 1);
    if (raws.length === 1) {
      truthy('Z1 2013+-masker (0x80): MANUAL-taak start === rauwe START (1283)', raws[0].start?.getTime() === z1ExpectedDate(manual2013.rawStart!).getTime());
      truthy('Z1 2013+-masker (0x80): MANUAL-taak finish === rauwe FINISH (1284)', raws[0].finish?.getTime() === z1ExpectedDate(manual2013.rawFinish!).getTime());
    }
  }

  {
    const noFixed2: Z1TaskSpec = {
      uniqueId: 301, id: 1, name: 'NoFixed2Streams', manual: true,
      schedStart: { time: 4800, days: 15100 }, schedFinish: { time: 9600, days: 15100 },
    };
    const bytes = buildZ1Fixture({ tasks: [noFixed2], includeFixed2Streams: false });
    let threw: string | null = null;
    let raws: ReturnType<typeof scanGroundTruthTasks>['raws'] = [];
    try {
      ({ raws } = scanGroundTruthTasks(bytes));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`Z1 ontbrekende Fixed2-streams: geen exceptie (${threw ?? ''})`, threw === null);
    eq('Z1 ontbrekende Fixed2-streams: 1 taak gelezen', raws.length, 1);
    if (raws.length === 1) {
      truthy('Z1 ontbrekende Fixed2-streams: valt terug op SCHEDULED_START (35)', raws[0].start?.getTime() === z1ExpectedDate(noFixed2.schedStart).getTime());
      truthy('Z1 ontbrekende Fixed2-streams: valt terug op SCHEDULED_FINISH (36)', raws[0].finish?.getTime() === z1ExpectedDate(noFixed2.schedFinish).getTime());
    }
  }

  {
    const corrupt: Z1TaskSpec = {
      uniqueId: 501, id: 1, name: 'CorruptFixed2Meta', manual: true,
      schedStart: { time: 4800, days: 15300 }, schedFinish: { time: 9600, days: 15300 },
      rawStart: { time: 7200, days: 15302 }, rawFinish: { time: 9600, days: 15303 },
    };
    const bytes = buildZ1Fixture({ tasks: [corrupt], corruptFixed2Meta: true });
    let threw: string | null = null;
    let raws: ReturnType<typeof scanGroundTruthTasks>['raws'] = [];
    try {
      ({ raws } = scanGroundTruthTasks(bytes));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`Z1 onparsebare Fixed2Meta (ongeldig magic-getal): geen exceptie (${threw ?? ''})`, threw === null);
    eq('Z1 onparsebare Fixed2Meta: 1 taak gelezen', raws.length, 1);
    if (raws.length === 1) {
      truthy('Z1 onparsebare Fixed2Meta: valt terug op SCHEDULED_START (rauwe TASK_MODE-bit onleesbaar)', raws[0].start?.getTime() === z1ExpectedDate(corrupt.schedStart).getTime());
      truthy('Z1 onparsebare Fixed2Meta: valt terug op SCHEDULED_FINISH (rauwe TASK_MODE-bit onleesbaar)', raws[0].finish?.getTime() === z1ExpectedDate(corrupt.schedFinish).getTime());
    }
  }

  {
    const truncated: Z1TaskSpec = {
      uniqueId: 401, id: 1, name: 'TruncatedFixed2', manual: true,
      schedStart: { time: 4800, days: 15200 }, schedFinish: { time: 9600, days: 15200 },
      rawStart: { time: 7200, days: 15202 }, rawFinish: { time: 9600, days: 15203 },
    };
    const bytes = buildZ1Fixture({ tasks: [truncated], fixed2DataTruncateTo: 216 + 30 });
    let threw: string | null = null;
    let raws: ReturnType<typeof scanGroundTruthTasks>['raws'] = [];
    try {
      ({ raws } = scanGroundTruthTasks(bytes));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`Z1 vijandige fixture (afgekapt Fixed2Data-item): geen exceptie (${threw ?? ''})`, threw === null);
    eq('Z1 vijandige fixture: 1 taak gelezen', raws.length, 1);
    if (raws.length === 1) {
      truthy('Z1 vijandige fixture: valt terug op SCHEDULED_START (rauwe START niet leesbaar)', raws[0].start?.getTime() === z1ExpectedDate(truncated.schedStart).getTime());
      truthy('Z1 vijandige fixture: valt terug op SCHEDULED_FINISH (rauwe FINISH niet leesbaar)', raws[0].finish?.getTime() === z1ExpectedDate(truncated.schedFinish).getTime());
    }
  }
}

const CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const CRAWL = process.env.OPS_MPP_CRAWL ?? '/home/nozzit/open-aec/voor claude/testdata-crawl';

type RootName = 'corpus' | 'crawl';

function listMppFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMppFilesRecursive(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mpp')) out.push(full);
  }
  return out;
}

function hashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

function tagFor(root: RootName, hash: string, label: string | undefined): string {
  return root === 'crawl' ? (label ?? hash) : hash;
}

interface BaselineEntry {
  root: RootName;
  label?: string;
  tasks: number;
  startExact: number;
  startSameday: number;
  startDiff: number;
  finishExact: number;
  finishSameday: number;
  finishDiff: number;
  reason?: string;
}
interface Baseline {
  files: Record<string, BaselineEntry>;
}
function hasDiff(e: Pick<BaselineEntry, 'startDiff' | 'finishDiff'>): boolean {
  return e.startDiff > 0 || e.finishDiff > 0;
}

const BASELINE_PATH = join(HERE, 'mpp-fidelity-baseline.json');
let baseline: Baseline = { files: {} };
if (REPORT !== 'baseline') {
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
  } catch (err) {
    checks++;
    diffs.push(`mpp-fidelity-baseline.json kon niet gelezen/geparsed worden: ${err instanceof Error ? err.message : String(err)}`);
  }
} else {
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
  } catch {
  }
}

const reportEntries: Record<string, BaselineEntry> = {};

const seenPinnedHashesByRoot: Record<RootName, Set<string>> = { corpus: new Set(), crawl: new Set() };
const actualDiffHashesByRoot: Record<RootName, Set<string>> = { corpus: new Set(), crawl: new Set() };
let rejectedCount = 0;
let firstUsableFile: { path: string; bytes: Uint8Array; root: RootName; hash: string; label: string | undefined } | null = null;

let improvedFiles = 0, regressedFiles = 0, unchangedFiles = 0, netDiffDelta = 0;
const fieldRegressedTags: string[] = [];

function printDetail(tag: string, row: FidelityRow) {
  if (row.diffTasks.length === 0) return;
  console.log(`   . [detail ${tag}] ${row.diffTasks.length} afwijkende taak/taken:`);
  console.log('     ID | naam | MSP-start | onze-ES | MSP-finish | onze-EF | dur(d) | ms | cons | %c | actS | cal | preds');
  for (const d of row.diffTasks) {
    console.log(
      `     ${d.id.padStart(4)} ${d.name.slice(0, 24).padEnd(24)} ${String(d.msStart).padEnd(16)} `
      + `${d.startMark}${d.ourStart.padEnd(16)} ${String(d.msFinish).padEnd(16)} ${d.finishMark}${d.ourFinish.padEnd(16)} `
      + `${d.durationDays.toFixed(3).padStart(8)} ${d.isMilestone ? 'M' : ' '} ${d.constraint.padEnd(10)} `
      + `${String(d.completionPct).padStart(3)} ${d.actualStart.padEnd(11)} ${d.calendarId.slice(0, 8).padEnd(8)} ${d.preds.slice(0, 50)}`,
    );
  }
  if (Object.keys(row.diffBuckets).length > 0) {
    console.log(`     attribuut-emmers: ${JSON.stringify(row.diffBuckets)}`);
  }
}

function processFile(path: string, bytes: Uint8Array, root: RootName, label: string | undefined) {
  const row = measureFidelity(bytes);
  const hash = hashOf(bytes);
  const tag = tagFor(root, hash, label);

  if (row.status === 'rejected') {
    rejectedCount++;
    return;
  }
  if (row.status === 'error') {
    checks++;
    diffs.push(`[${tag}] measureFidelity gaf status 'error': ${row.errMsg ?? '(geen boodschap)'}`);
    return;
  }

  if (!firstUsableFile && row.tasks > 0) firstUsableFile = { path, bytes, root, hash, label };

  if (hasDiff(row)) actualDiffHashesByRoot[root].add(hash);
  if (REPORT === 'detail') printDetail(tag, row);

  if (REPORT === 'baseline') {
    const existingReason = baseline.files[hash]?.reason;
    reportEntries[hash] = {
      root,
      ...(label ? { label } : {}),
      tasks: row.tasks,
      startExact: row.startExact, startSameday: row.startSameday, startDiff: row.startDiff,
      finishExact: row.finishExact, finishSameday: row.finishSameday, finishDiff: row.finishDiff,
      ...(existingReason ? { reason: existingReason } : {}),
    };
    return;
  }

  const pin = baseline.files[hash];
  if (!pin) {
    checks++;
    diffs.push(`[${tag}] niet gepind in mpp-fidelity-baseline.json — herpin via OPS_MPP_FIDELITY_REPORT=baseline`);
    return;
  }
  seenPinnedHashesByRoot[root].add(hash);
  eq(`[${tag}] tasks`, row.tasks, pin.tasks);
  eq(`[${tag}] startExact`, row.startExact, pin.startExact);
  eq(`[${tag}] startSameday`, row.startSameday, pin.startSameday);
  eq(`[${tag}] startDiff`, row.startDiff, pin.startDiff);
  eq(`[${tag}] finishExact`, row.finishExact, pin.finishExact);
  eq(`[${tag}] finishSameday`, row.finishSameday, pin.finishSameday);
  eq(`[${tag}] finishDiff`, row.finishDiff, pin.finishDiff);

  if (hasDiff(pin)) {
    checks++;
    if (!pin.reason || pin.reason.trim().length === 0) {
      diffs.push(`[${tag}] gepind MET afwijking maar ZONDER "reason" — §T15 eist een geschreven, gemeten reden (dossierverwijzing) bij elke bewuste (c)-pin`);
    }
  }

  const before = pin.startDiff + pin.finishDiff;
  const after = row.startDiff + row.finishDiff;
  if (after < before) improvedFiles++;
  else if (after > before) regressedFiles++;
  else unchangedFiles++;
  netDiffDelta += before - after;

  if (row.startDiff > pin.startDiff || row.finishDiff > pin.finishDiff) {
    fieldRegressedTags.push(tag);
  }
}

const corpusDirExists = existsSync(CORPUS);
const corpusFiles = corpusDirExists ? listMppFilesRecursive(CORPUS) : [];
const corpusScanned = corpusFiles.length > 0;
if (!corpusDirExists) {
  console.log('OK  mpp-fidelity: corpus niet aanwezig (OPS_MPP_CORPUS) — corpuslus overgeslagen');
} else if (!corpusScanned) {
  console.log(`OK  mpp-fidelity: corpusmap aanwezig maar geen .mpp-bestanden erin (${CORPUS}) — corpuslus overgeslagen`);
} else {
  for (const path of corpusFiles) {
    processFile(path, new Uint8Array(readFileSync(path)), 'corpus', undefined);
  }
  console.log(`   . [corpus] ${corpusFiles.length} bestand(en) gescand`);
}

const crawlDirExists = existsSync(CRAWL);
const crawlFiles = crawlDirExists ? listMppFilesRecursive(CRAWL) : [];
const crawlScanned = crawlFiles.length > 0;
if (!crawlDirExists) {
  console.log('OK  mpp-fidelity: crawl niet aanwezig (OPS_MPP_CRAWL) — crawllus overgeslagen');
} else if (!crawlScanned) {
  console.log(`OK  mpp-fidelity: crawlmap aanwezig maar geen .mpp-bestanden erin (${CRAWL}) — crawllus overgeslagen`);
} else {
  for (const path of crawlFiles) {
    const label = relative(CRAWL, path).split(sep).join('/');
    processFile(path, new Uint8Array(readFileSync(path)), 'crawl', label);
  }
  console.log(`   . [crawl] ${crawlFiles.length} bestand(en) gescand`);
}

console.log(`   . ${rejectedCount} bestand(en) overgeslagen (MPP_LEGACY/MPP_ENCRYPTED — O7, telt niet als fout)`);

if (REPORT === 'baseline') {
  const sortedFiles: Record<string, BaselineEntry> = {};
  for (const hash of Object.keys(reportEntries).sort()) sortedFiles[hash] = reportEntries[hash];
  const out: Baseline = { files: sortedFiles };
  console.log('#BASELINE ' + JSON.stringify(out, null, 2));
  process.exit(0);
}

const GOAL_ZERO_DEVIATIONS = true;
if (GOAL_ZERO_DEVIATIONS) {
  for (const [hash, entry] of Object.entries(baseline.files)) {
    const tag = tagFor(entry.root, hash, entry.label);
    checks++;
    if (entry.startDiff !== 0 || entry.startSameday !== 0 || entry.finishDiff !== 0 || entry.finishSameday !== 0) {
      diffs.push(
        `[GOAL_ZERO_DEVIATIONS ${tag}] niet-nul teller in de baseline (startDiff=${entry.startDiff}, `
        + `startSameday=${entry.startSameday}, finishDiff=${entry.finishDiff}, finishSameday=${entry.finishSameday}) `
        + '— de etappedoelstelling is "nul, punt uit" (plan §1.1, orkestratorbesluit O1)',
      );
    }
    checks++;
    if (entry.startExact !== entry.tasks || entry.finishExact !== entry.tasks) {
      diffs.push(
        `[GOAL_ZERO_DEVIATIONS ${tag}] exact-tellers dekken niet alle taken (tasks=${entry.tasks}, `
        + `startExact=${entry.startExact}, finishExact=${entry.finishExact}) — een 'missing'-`
        + 'classificatie (taak zonder grondwaarheid) telt in geen van de vier nul-tellers mee en '
        + 'zou anders stil door de corpusloze poort glippen (eindreview-bevinding F1; plan §1.1 '
        + 'eist tasks === startExact === finishExact)',
      );
    }
    checks++;
    if ('reason' in entry) {
      diffs.push(
        `[GOAL_ZERO_DEVIATIONS ${tag}] draagt nog een "reason"-sleutel — met nul afwijkingen als doel `
        + 'is er niets meer te verantwoorden; "pinnen met reden" bestaat niet meer als uitweg (plan §1.1/Z19)',
      );
    }
  }
}

function assertRootPins(root: RootName) {
  const pinnedForRoot = Object.entries(baseline.files).filter(([, v]) => v.root === root);
  eq(`globaal[${root}]: aantal gepinde bestanden dat daadwerkelijk gezien is`, seenPinnedHashesByRoot[root].size, pinnedForRoot.length);

  const expectedDiff = new Set(pinnedForRoot.filter(([, v]) => hasDiff(v)).map(([h]) => h));
  const actualDiff = actualDiffHashesByRoot[root];
  const missingFromScan = [...expectedDiff].filter((h) => !actualDiff.has(h)).sort();
  const unexpectedInScan = [...actualDiff].filter((h) => !expectedDiff.has(h)).sort();
  checks++;
  if (missingFromScan.length > 0 || unexpectedInScan.length > 0) {
    const missingLabels = missingFromScan.map((h) => tagFor(root, h, baseline.files[h]?.label));
    const unexpectedLabels = unexpectedInScan.map((h) => tagFor(root, h, baseline.files[h]?.label));
    diffs.push(
      `globaal[${root}]: verzameling bestanden met ≥1 afwijking wijkt af van de gepinde verzameling — `
      + `mist in de scan (was gepind als afwijkend, nu niet meer gezien): [${missingLabels.join(', ')}]; `
      + `nieuw/onverwacht afwijkend: [${unexpectedLabels.join(', ')}]`,
    );
  }
}
if (corpusScanned) assertRootPins('corpus');
if (crawlScanned) assertRootPins('crawl');

if (improvedFiles + regressedFiles + unchangedFiles > 0) {
  const richting = netDiffDelta > 0 ? 'netto verbeterd' : netDiffDelta < 0 ? 'netto VERSLECHTERD' : 'netto ongewijzigd';
  console.log(
    `   . delta t.o.v. mpp-fidelity-baseline.json: ${improvedFiles} bestand(en) verbeterd (op de som), `
    + `${regressedFiles} verslechterd (op de som), ${unchangedFiles} ongewijzigd — ${richting} `
    + `(${netDiffDelta >= 0 ? '-' : '+'}${Math.abs(netDiffDelta)} start+finish-afwijkingen)`,
  );
  if (fieldRegressedTags.length > 0) {
    console.log(
      `   . waarschuwing: ${fieldRegressedTags.length} bestand(en) hebben startDiff of finishDiff ZIEN STIJGEN `
      + `t.o.v. de pin, ook al is de SOM voor dat bestand gelijk of beter — dus NIET per se in de `
      + `"verslechterd (op de som)"-telling hierboven: [${fieldRegressedTags.join(', ')}]`,
    );
  }
}

if (!firstUsableFile) {
  console.log('OK  mpp-fidelity: geen bruikbaar bestand (0 taken of geen corpus/crawl) — pad-pariteitscase overgeslagen');
} else {
  const { bytes: parityBytes, root: parityRoot, hash: parityHash, label: parityLabel } = firstUsableFile;
  const parityTag = tagFor(parityRoot, parityHash, parityLabel);
  const direct = solveMppBytes(parityBytes);

  const S = () => useAppStore.getState();
  S().newProject();
  S().applyLoadedProject(readMPP(parityBytes), {
    filePath: null, recompute: true, fit: false, linkedOpen: true,
  });

  eq(`[pad-pariteit ${parityTag}] taakaantal store === direct`, S().tasks.length, direct.tasks.length);
  let mismatched = 0;
  const storeTasks = S().tasks;
  const n = Math.min(storeTasks.length, direct.tasks.length);
  for (let i = 0; i < n; i++) {
    const st = storeTasks[i];
    const dt = direct.tasks[i];
    if (st.name !== dt.name || st.time.earlyStart !== dt.time.earlyStart || st.time.earlyFinish !== dt.time.earlyFinish) mismatched++;
  }
  eq(`[pad-pariteit ${parityTag}] alle taken (positioneel): store naam+earlyStart+earlyFinish === solveMppBytes (mismatches)`, mismatched, 0);
}

if (diffs.length === 0) {
  console.log(`OK  mpp-fidelity: alle checks groen (${checks}); ${corpusFiles.length + crawlFiles.length} .mpp-bestand(en) gescand; `
    + `corpus=${corpusFiles.length}${corpusScanned ? '' : ' (overgeslagen)'}; `
    + `crawl=${crawlFiles.length}${crawlScanned ? '' : ' (overgeslagen)'}`);
  process.exit(0);
} else {
  console.log(`XX  mpp-fidelity: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
