// De EXPORTSTAND van het voortgangsblad: wat er per taak in de planning stond op het moment van
// exporteren. De invulkolommen zijn daarvoor geen bron: de invuller overschrijft ze, en daarna is niet
// meer te zien of een waarde van de invuller komt of nog de exportwaarde is. Zonder dit gegeven zet een
// onaangeraakte rij voortgang die de planner na de export bijwerkte stil terug (issue #743).
//
// Eén tekstcel per taak, in de verborgen kolom `OPS Export`: een tekst overleeft het opslaan in een
// spreadsheet, waar een aparte datumcel van opmaak kan veranderen. Formaat:
//
//   ops1|<exportmoment UTC>|<voltooiing in procenten>|<werkelijke start>|<werkelijk einde>|<berekende start>|<berekend einde>
//
// Een lege plek is een leeg veld. Een cel die niet exact in deze vorm past telt als AFWEZIG: een
// half gelezen exportstand zou een verkeerde vergelijking opleveren. Puur, geen I/O.

import type { Task } from '@/types/task';
import { computedFinish, computedStart } from '@/utils/taskDates';
import type { ProgressExportState } from './types';

const VERSION = 'ops1';
const SEPARATOR = '|';
const FIELD_COUNT = 7;

const ISO_VALUE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/** Procenten met vier decimalen, geklemd: dezelfde precisie als de voltooiingscel van het blad. */
function percentText(completion: number): string {
  if (!Number.isFinite(completion)) return '0';
  const clamped = Math.min(1, Math.max(0, completion));
  return String(Math.round(clamped * 1_000_000) / 10_000);
}

export function encodeProgressExportState(task: Task, exportedAt: string): string {
  return [
    VERSION,
    exportedAt,
    percentText(task.time.completion),
    task.time.actualStart || '',
    task.time.actualFinish || '',
    computedStart(task) || '',
    computedFinish(task) || '',
  ].join(SEPARATOR);
}

function optionalIso(raw: string): { ok: true; value: string | undefined } | { ok: false } {
  if (raw === '') return { ok: true, value: undefined };
  return ISO_VALUE.test(raw) ? { ok: true, value: raw } : { ok: false };
}

export function decodeProgressExportState(raw: string): ProgressExportState | undefined {
  const parts = raw.trim().split(SEPARATOR);
  if (parts.length !== FIELD_COUNT || parts[0] !== VERSION) return undefined;
  const [, exportedAt, percentRaw, actualStartRaw, actualFinishRaw, plannedStartRaw, plannedFinishRaw] = parts;

  if (!Number.isFinite(Date.parse(exportedAt))) return undefined;
  if (!/^\d+(?:\.\d+)?$/.test(percentRaw)) return undefined;
  const percent = Number(percentRaw);
  if (percent > 100) return undefined;

  const actualStart = optionalIso(actualStartRaw);
  const actualFinish = optionalIso(actualFinishRaw);
  const plannedStart = optionalIso(plannedStartRaw);
  const plannedFinish = optionalIso(plannedFinishRaw);
  if (!actualStart.ok || !actualFinish.ok || !plannedStart.ok || !plannedFinish.ok) return undefined;

  return {
    exportedAt,
    completion: percent / 100,
    ...(actualStart.value !== undefined ? { actualStart: actualStart.value } : {}),
    ...(actualFinish.value !== undefined ? { actualFinish: actualFinish.value } : {}),
    ...(plannedStart.value !== undefined ? { plannedStart: plannedStart.value } : {}),
    ...(plannedFinish.value !== undefined ? { plannedFinish: plannedFinish.value } : {}),
  };
}
