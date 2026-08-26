import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';

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
  for (const [name, label, links, types, values] of samples) {
    const path = join(root, label); eq(`C2 ${name}-bestand bestaat`, existsSync(path), true);
    if (!existsSync(path)) continue;
    const bytes = new Uint8Array(readFileSync(path)); const raw = countRaw(bytes); const started = performance.now(); const opened = results(bytes); const elapsedMs = performance.now() - started;
    const catalog = opened[0]?.xer.metadata?.catalog;
    const mappedLinks = catalog?.taskProjections.reduce((sum, projection) => sum + Object.keys(projection.activityCodes ?? {}).length, 0);
    eq(`C3 ${name}: onafhankelijke TASKACTV-telling en productprojectie`, { raw: raw.taskactv, mapped: mappedLinks, types: catalog?.activityCodeTypes.length, values: catalog?.activityCodeTypes.reduce((sum, type) => sum + type.values.length, 0), shared: opened.every(result => result.xer.metadata?.catalog === catalog) }, { raw: links, mapped: links, types, values, shared: true });
    const rssMiB = process.memoryUsage().rss / 1024 / 1024;
    eq(`C4 ${name}: volledige reader blijft onder 10 seconden`, elapsedMs < 10_000, true);
    eq(`C5 ${name}: proces-RSS blijft onder 768 MiB`, rssMiB < 768, true);
    console.log(`.   xer-metadata-perf: ${name} links=${links}, documenten=${opened.length}, readMs=${elapsedMs.toFixed(1)}, rssMiB=${rssMiB.toFixed(1)}`);
  }
  if (diffs.length) { for (const diff of diffs) console.error(`XX ${diff}`); process.exitCode = 1; }
  else console.log('OK XER metadata-corpus: onafhankelijke tellingen, projecties en performance groen');
}
