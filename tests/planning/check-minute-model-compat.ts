import './domStub';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { payloadFromImport } from '@/state/documentContract';
import { prepareLoadedPayload } from '@/state/documentActivation';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import type { ImportResult } from '@/services/importTypes';

async function main() {
  const reader = process.env.OPS_MINUTE_MODEL_OLD_READER;
  const fixtures = process.env.OPS_MINUTE_MODEL_COMPAT_OUT;
  if (!reader || !fixtures) { console.log('Oude IFC-lezer: niet gemeten (OPS_MINUTE_MODEL_OLD_READER en OPS_MINUTE_MODEL_COMPAT_OUT ontbreken).'); return; }
  const old = await import(pathToFileURL(reader).href) as { readIFC: (text: string) => ImportResult };
  const files = readdirSync('examples').filter(f => f.endsWith('.ifc')).map(name => ({ name, text: readFileSync(join('examples', name), 'utf8'), rewrite: true }));
  files.push(...['W0', 'W1', 'W2'].map(name => ({ name, text: readFileSync(join(fixtures, `${name}.ifc`), 'utf8'), rewrite: false })));
  let checked = 0;
  const errors: string[] = [];
  const key = (t: ImportResult['tasks'][number]) => t.wbsCode;
  for (const file of files) {
    const payload = prepareLoadedPayload(payloadFromImport(readIFC(file.text), null), { recompute: true });
    const text = file.rewrite ? writeIFC(buildWriteIFCInput(payload)) : file.text;
    const expected = readIFC(text), back = old.readIFC(text);
    const byKey = new Map(back.tasks.map(t => [key(t), t]));
    if (byKey.size !== back.tasks.length) throw new Error(`${file.name}: dubbele WBS-code in de oude lezer`);
    const eq = (label: string, got: unknown, want: unknown) => {
      checked++;
      if (got !== want) errors.push(`${file.name} ${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
    };
    for (const task of expected.tasks) {
      const got = byKey.get(key(task));
      eq(`${key(task)} aanwezig`, !!got, true);
      if (!got) continue;
      for (const field of ['scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'actualStart', 'actualFinish'] as const) {
        const a = got.time[field], b = task.time[field];
        const trim = (s: string | undefined) => s?.slice(0, b?.includes('T') ? 16 : 10);
        eq(`${key(task)} ${field}`, trim(a), trim(b));
      }
      for (const field of ['scheduleDuration', 'durationMinutes', 'remainingTime', 'totalFloat', 'freeFloat'] as const) {
        if (task.time[field] !== undefined) eq(`${key(task)} ${field}`, got.time[field], task.time[field]);
      }
      for (const field of ['deadline'] as const) eq(`${key(task)} ${field}`, got[field]?.slice(0, 16), task[field]?.slice(0, 16));
      eq(`${key(task)} beperking`, got.constraint?.date?.slice(0, 16), task.constraint?.date?.slice(0, 16));
    }
    eq('aantal relaties', back.sequences.length, expected.sequences.length);
    for (let i = 0; i < expected.sequences.length; i++) {
      for (const field of ['lagDays', 'lagMinutes', 'lagPercent', 'lagUnit'] as const) eq(`relatie ${i} ${field}`, back.sequences[i]?.[field], expected.sequences[i][field]);
    }
  }
  for (const error of errors.slice(0, 30)) console.log(`XX ${error}`);
  console.log(`Oude IFC-lezer v2026.9.0: ${checked - errors.length}/${checked} gelijk; ${files.length} bestanden, ${errors.length} afwijkingen.`);
  if (errors.length) process.exitCode = 1;
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
