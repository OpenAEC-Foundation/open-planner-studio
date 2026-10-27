import './domStub';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readDayMeasureDurations } from '@/services/ifc/ifcPsets';
import { parseDayMeasureLags, wholeFloatDays } from '@/services/ifc/dayMeasureIo';
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
  // D0/D1: de dagenmaat met breuken, de lagmaat en de speling (check-ifc-dagenmaat.ts schrijft ze).
  const dayMeasure = ['D0', 'D1'].filter(name => existsSync(join(fixtures, `${name}.ifc`)));
  if (dayMeasure.length < 2) console.log('Dagenmaat-bestanden D0/D1: niet gemeten (draai eerst check-ifc-dagenmaat.ts met OPS_MINUTE_MODEL_COMPAT_OUT).');
  files.push(...dayMeasure.map(name => ({ name, text: readFileSync(join(fixtures, `${name}.ifc`), 'utf8'), rewrite: false })));
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
      // Dagenmaat met een breuk (alleen uren §3.10, §5.4): het bestand draagt duur en rest als `PT…` met
      // een record. v2026.9.0 leest dan een urentaak met precies de geschreven minuten.
      const records = readDayMeasureDurations(task);
      const dayFraction = task.time.durationUnit !== 'hours' && records?.ScheduleDuration !== undefined;
      if (dayFraction) {
        eq(`${key(task)} dagenmaat-breuk ⇒ urentaak`, got.time.durationUnit, 'hours');
        eq(`${key(task)} dagenmaat-breuk duurminuten`, got.time.durationMinutes, records.ScheduleDuration?.[1]);
        if (records.RemainingTime) eq(`${key(task)} dagenmaat-breuk restminuten`, got.time.remainingMinutes, records.RemainingTime[1]);
      }
      for (const field of ['scheduleDuration', 'durationMinutes', 'remainingTime'] as const) {
        if (!dayFraction && task.time[field] !== undefined) eq(`${key(task)} ${field}`, got.time[field], task.time[field]);
      }
      // Speling (T5): het slot draagt hele dagen; v2026.9.0 leest die, de exacte waarde staat in `ExactFloat`.
      for (const field of ['totalFloat', 'freeFloat'] as const) {
        const want = task.time[field];
        if (want !== undefined) eq(`${key(task)} ${field}`, got.time[field], wholeFloatDays(want));
      }
      for (const field of ['deadline'] as const) eq(`${key(task)} ${field}`, got[field]?.slice(0, 16), task[field]?.slice(0, 16));
      eq(`${key(task)} beperking`, got.constraint?.date?.slice(0, 16), task.constraint?.date?.slice(0, 16));
    }
    eq('aantal relaties', back.sequences.length, expected.sequences.length);
    // Lag in dagen met een breuk (T21): het standaardveld draagt de minuten van het record; v2026.9.0 leest
    // een lag in de urenmaat met precies die minuten.
    const lagRecords = parseDayMeasureLags(text.match(/IFCPROPERTYSINGLEVALUE\('DayMeasureLags',\$,IFCTEXT\('(.*?)'\),\$\)/)?.[1]) ?? new Map();
    for (let i = 0; i < expected.sequences.length; i++) {
      const seq = expected.sequences[i];
      const record = lagRecords.get(expected.ifcGlobalIds?.[`seq:${seq.id}`] ?? '');
      if (record && seq.lagDays === record[0] && seq.lagMinutes === undefined) {
        eq(`relatie ${i} dagenmaat-lag lagDays`, back.sequences[i]?.lagDays, 0);
        eq(`relatie ${i} dagenmaat-lag lagMinutes`, back.sequences[i]?.lagMinutes, record[1]);
        eq(`relatie ${i} dagenmaat-lag lagUnit`, back.sequences[i]?.lagUnit, seq.lagUnit);
        continue;
      }
      for (const field of ['lagDays', 'lagMinutes', 'lagPercent', 'lagUnit'] as const) eq(`relatie ${i} ${field}`, back.sequences[i]?.[field], seq[field]);
    }
  }
  for (const error of errors.slice(0, 30)) console.log(`XX ${error}`);
  console.log(`Oude IFC-lezer v2026.9.0: ${checked - errors.length}/${checked} gelijk; ${files.length} bestanden, ${errors.length} afwijkingen.`);
  if (errors.length) process.exitCode = 1;
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
