import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMultiDocumentImport } from '@/services/importTypes';
import { buildXerMetadataCatalog } from '@/services/xer/xerMetadata';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { parseXerTables } from '@/services/xer/xerTables';

interface Counts { actvtype: number; actvcode: number; taskactv: number; udftype: number; udfvalue: number; memotype: number; taskmemo: number; taskNotes: number; staticTypes: number; staticValues: number; }
const empty = (): Counts => ({ actvtype: 0, actvcode: 0, taskactv: 0, udftype: 0, udfvalue: 0, memotype: 0, taskmemo: 0, taskNotes: 0, staticTypes: 0, staticValues: 0 });
function decode(bytes: Uint8Array): string { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); } }

/** Zelfstandige minimale teller: geen import uit productie-XER, geen gedeelde tokenizer of veldkaart. */
function countRaw(bytes: Uint8Array): Counts {
  const out = empty(); let table = ''; let fields: string[] = []; const staticIds = new Set<string>();
  for (const line of decode(bytes).split('\n')) {
    const cells = line.replace(/\r$/, '').split('\t'); const marker = cells[0]?.trim();
    if (marker === '%T') { table = cells[1]?.trim().toUpperCase() ?? ''; fields = []; continue; }
    if (marker === '%F') { fields = cells.slice(1).map(field => field.trim().toLowerCase()); continue; }
    if (marker !== '%R') continue;
    const row = Object.fromEntries(fields.map((field, index) => [field, cells[index + 1] ?? '']));
    if (table === 'ACTVTYPE') out.actvtype++;
    if (table === 'ACTVCODE') out.actvcode++;
    if (table === 'TASKACTV') out.taskactv++;
    if (table === 'UDFTYPE') { out.udftype++; if ((row.logical_data_type || row.udf_type || '').trim().toUpperCase() === 'FT_STATICTYPE') { out.staticTypes++; staticIds.add(row.udf_type_id ?? ''); } }
    if (table === 'UDFVALUE') { out.udfvalue++; if (staticIds.has(row.udf_type_id ?? '')) out.staticValues++; }
    if (table === 'MEMOTYPE') out.memotype++;
    if (table === 'TASKMEMO') out.taskmemo++;
    if (table === 'TASK' && row.task_notes) out.taskNotes++;
  }
  return out;
}
function add(target: Counts, source: Counts): void { for (const key of Object.keys(target) as (keyof Counts)[]) target[key] += source[key]; }
function results(bytes: Uint8Array): XerReadResult[] { const opened = readXER(bytes); return isMultiDocumentImport(opened) ? opened.results as XerReadResult[] : [opened]; }

interface ProductProbe { documents: number; readMs: number; rssMiB: number; heapDeltaMiB: number; }
const probePath = process.env.OPS_X8_METADATA_PROBE;
if (probePath) {
  // Een vers Node-proces voorkomt dat de onafhankelijke ruwe teller en de directe catalogusmeting
  // het resident geheugen van de productreader kunstmatig ophogen.
  global.gc?.();
  const before = process.memoryUsage(); const started = performance.now();
  const opened = results(new Uint8Array(readFileSync(probePath)));
  const readMs = performance.now() - started;
  global.gc?.();
  const after = process.memoryUsage();
  const probe: ProductProbe = {
    documents: opened.length, readMs, rssMiB: after.rss / 1024 / 1024,
    heapDeltaMiB: (after.heapUsed - before.heapUsed) / 1024 / 1024,
  };
  console.log(`X8_METADATA_PROBE ${JSON.stringify(probe)}`);
  process.exit(0);
}
function productProbe(path: string): ProductProbe {
  const output = execFileSync(process.execPath, ['--expose-gc', process.argv[1]!], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, OPS_X8_METADATA_PROBE: path },
  });
  const line = output.trim().split('\n').find(entry => entry.startsWith('X8_METADATA_PROBE '));
  if (!line) throw new Error(`X8-geheugenprobe gaf geen meetregel terug voor ${path}.`);
  return JSON.parse(line.slice('X8_METADATA_PROBE '.length)) as ProductProbe;
}
/** Onafhankelijk van de product-allowlist: telt iedere %R in exact één bron-tabel. */
function countRawTableRows(bytes: Uint8Array, wantedTable: string): number {
  let table = '';
  let count = 0;
  for (const line of decode(bytes).split('\n')) {
    const cells = line.replace(/\r$/, '').split('\t');
    const marker = cells[0]?.trim();
    if (marker === '%T') { table = cells[1]?.trim().toUpperCase() ?? ''; continue; }
    if (marker === '%R' && table === wantedTable) count++;
  }
  return count;
}
const root = process.env.OPS_XER_CORPUS;
if (!root) console.log('OK XER metadata-corpus: corpus niet aanwezig — corpuspoort overgeslagen');
else {
  // De harness bundelt normaal in tests/planning; de test blijft ook uitvoerbaar uit een tijdelijk
  // pad, zolang hij vanuit de repositoryroot draait (zoals npm run test:planning dat doet).
  const manifest = JSON.parse(readFileSync(join(process.cwd(), 'tests/planning/xer-corpus-manifest.json'), 'utf8')) as { files: Record<string, unknown> };
  const total = empty();
  for (const label of Object.keys(manifest.files)) add(total, countRaw(new Uint8Array(readFileSync(join(root, label)))));
  // De onafhankelijke ruwe scanner telt ook de drie UDFVALUE-rijen uit X2-geweigerde bestanden;
  // de bestaande parser-populatiepin (71 leesbare bestanden) is daardoor 12.750, de bronmassa
  // hier terecht 12.753. TASKACTV blijft in beide tellers exact 119.878.
  const expected = { actvtype: 77, actvcode: 555, taskactv: 119878, udftype: 48, udfvalue: 12753, memotype: 7, taskmemo: 20, taskNotes: 2, staticTypes: 10, staticValues: 531 };
  const samples = [
    ['rehab', 'crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer', 81339, 12, 208],
    ['hotel', 'crawl-xer/Hotel_Construction_TEC.xer', 18020, 5, 46],
  ] as const;
  const diffs: string[] = []; const eq = (name: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${name}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`); };
  eq('C1 onafhankelijke publieke totaaltelling', total, expected);
  // HarbourPointe heeft geen TASK.task_notes als substituut: de 131 notities staan uitsluitend
  // in TASKNOTE. Deze probe leest %T/%F/%R zelf, zodat een allowlist-gat niet door productiecode
  // of een hergebruikte tokenizer kan worden verborgen.
  const harbourPath = join(root, 'crawl-xer/HarbourPointe_AssistedLiving.xer');
  eq('C1a HarbourPointe TASKNOTE-dossier bestaat', existsSync(harbourPath), true);
  if (existsSync(harbourPath)) {
    const bytes = new Uint8Array(readFileSync(harbourPath));
    const tables = parseXerTables(bytes);
    const catalog = buildXerMetadataCatalog(tables);
    const opened = results(bytes);
    const memory = productProbe(harbourPath);
    const sourceData = catalog.sourceData;
    eq('C1b HarbourPointe behoudt alle 131 TASKNOTE-rijen zero-copy van tokenisatie tot catalogus en projectie', {
      raw: countRawTableRows(bytes, 'TASKNOTE'),
      tokenized: tables.tables.get('TASKNOTE')?.rows.length ?? 0,
      catalog: sourceData.TASKNOTE?.length ?? 0,
      zeroCopy: sourceData.TASKNOTE === tables.tables.get('TASKNOTE')?.rows,
      projected: opened.reduce((sum, result) => sum + result.tasks.reduce(
        (taskSum, task) => taskSum + (task.notes?.filter(note => note.id.startsWith('xer-note:tasknote:')).length ?? 0), 0), 0),
    }, { raw: 131, tokenized: 131, catalog: 131, zeroCopy: true, projected: 131 });
    eq('C1c HarbourPointe TASKNOTE-pad blijft in een vers proces binnen de heappoort', {
      documents: memory.documents,
      rssBelow512MiB: memory.rssMiB < 512,
      heapDeltaBelow256MiB: memory.heapDeltaMiB < 256,
    }, { documents: opened.length, rssBelow512MiB: true, heapDeltaBelow256MiB: true });
    console.log(`.   xer-metadata-perf: harbour tasknotes=131, documenten=${memory.documents}, readMs=${memory.readMs.toFixed(1)}, rssMiB=${memory.rssMiB.toFixed(1)}, heapDeltaMiB=${memory.heapDeltaMiB.toFixed(1)}`);
  }
  for (const [name, label, links, types, values] of samples) {
    const path = join(root, label); eq(`C2 ${name}-bestand bestaat`, existsSync(path), true);
    if (!existsSync(path)) continue;
    const bytes = new Uint8Array(readFileSync(path)); const raw = countRaw(bytes);
    // De totale reader omvat ook de kalender-, X4b-, X5- en X6-paden en is daarom gevoelig voor
    // hostbelasting. Meet X8 zelf apart op reeds geparste tabellen: de grens schaalt lineair met
    // het werk (koppelingen plus UDF's), terwijl de referentie-identiteit hieronder een regressie
    // naar P×raw-row-kopieën direct rood maakt.
    const directProfile = (() => {
      const tables = parseXerTables(bytes); const catalogStarted = performance.now();
      const directCatalog = buildXerMetadataCatalog(tables);
      return { catalogMs: performance.now() - catalogStarted, zeroCopy: directCatalog.sourceData.TASKACTV === tables.tables.get('TASKACTV')?.rows };
    })();
    const started = performance.now(); const opened = results(bytes); const elapsedMs = performance.now() - started;
    const catalog = opened[0]?.xer.metadata?.catalog;
    const mappedLinks = catalog?.taskProjections.reduce((sum, projection) => sum + Object.keys(projection.activityCodes ?? {}).length, 0);
    eq(`C3 ${name}: onafhankelijke TASKACTV-telling, productprojectie en zero-copy catalogus`, { raw: raw.taskactv, mapped: mappedLinks, types: catalog?.activityCodeTypes.length, values: catalog?.activityCodeTypes.reduce((sum, type) => sum + type.values.length, 0), shared: opened.every(result => result.xer.metadata?.catalog === catalog), zeroCopy: directProfile.zeroCopy }, { raw: links, mapped: links, types, values, shared: true, zeroCopy: true });
    const maxCatalogMs = Math.max(750, (raw.taskactv + raw.udfvalue) * 0.05);
    eq(`C4 ${name}: file-wide X8-mapping blijft lineair binnen de vaste werkbudgetgrens`, directProfile.catalogMs < maxCatalogMs, true);
    const memory = productProbe(path);
    eq(`C5 ${name}: verse productreader blijft onder 768 MiB RSS`, memory.rssMiB < 768, true);
    eq(`C6 ${name}: verse productreader opent hetzelfde documentaantal`, memory.documents, opened.length);
    console.log(`.   xer-metadata-perf: ${name} links=${links}, documenten=${opened.length}, catalogMs=${directProfile.catalogMs.toFixed(1)}/${maxCatalogMs.toFixed(1)}, readMs=${elapsedMs.toFixed(1)}, rssMiB=${memory.rssMiB.toFixed(1)}, heapDeltaMiB=${memory.heapDeltaMiB.toFixed(1)}`);
  }
  if (diffs.length) { for (const diff of diffs) console.error(`XX ${diff}`); process.exitCode = 1; }
  else console.log('OK XER metadata-corpus: onafhankelijke tellingen, projecties en performance groen');
}
