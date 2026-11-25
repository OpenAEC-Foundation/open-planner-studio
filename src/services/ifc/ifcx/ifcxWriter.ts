import type { WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import type { WorkCalendar } from '@/types/calendar';
import { selfCheckDifferences } from './selfCheck';
import { IfcxWriteRefusedError } from './ifcxErrors';
import { readIfcx } from './ifcxReader';
import { canonicalFor, ownFileFor, type CanonicalPlanning } from './ownFile';
import { globalIdsOf, serializeIfcx } from './projection';

export type { IfcxDocument, IfcxEntry, IfcxHeader } from './projection';

const clockOf = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

function breakOf(calendar: WorkCalendar): string {
  const start = calendar.simpleBreakStartMinute, duration = calendar.simpleBreakDurationMinutes;
  const from = start === undefined || !Number.isInteger(start) ? `zonder geldig begin (${JSON.stringify(start) ?? 'afwezig'})` : `vanaf ${clockOf(start)}`;
  const length = duration === undefined || !Number.isInteger(duration) ? `zonder geldige duur (${JSON.stringify(duration) ?? 'afwezig'})` : `${duration} minuten`;
  return `de pauze ${from}, ${length}`;
}

const calendarsOf = (model: ImportResult) => [model.calendar, ...(model.resourceCalendars ?? [])];

function unstableBreak(given: WriteIFCInput, canonical: CanonicalPlanning, reopened: ImportResult): IfcxWriteRefusedError | undefined {
  const after = new Map(calendarsOf(reopened).map(calendar => [calendar.id, calendar]));
  for (const calendar of calendarsOf(canonical)) {
    if (calendar.simpleBreakStartMinute === undefined && calendar.simpleBreakDurationMinutes === undefined) continue;
    const changed = selfCheckDifferences(calendar as unknown as ImportResult, after.get(calendar.id) as unknown as ImportResult, 3);
    if (changed.length === 0) continue;
    const givenGlobalId = globalIdsOf(given);
    const entered = new Map(calendarsOf(given).map(other => [givenGlobalId('cal', other.id), other]));
    const shown = entered.get(globalIdsOf(canonical)('cal', calendar.id)) ?? calendar;
    return new IfcxWriteRefusedError('invalid',
      `kalender ${shown.name} (${shown.id}): ${breakOf(shown)}, blijft bij een volgende opslag niet zoals ze is (${changed.join('; ')}). `
      + `Leg de pauze helemaal binnen de werktijd van ${clockOf(shown.workStartHour * 60)} tot ${clockOf(shown.workEndHour * 60)}, na het begin, of haal haar weg.`,
      ['openaec::ops::calendar.simpleBreakStartMinute', 'openaec::ops::calendar.simpleBreakDurationMinutes'],
      { attribute: 'openaec::ops::calendar', field: 'simpleBreakStartMinute' });
  }
  return undefined;
}

export function writeIfcx(given: WriteIFCInput, writtenAt: Date = new Date()): string {
  const canonical = canonicalFor(given);
  const { planning, document } = ownFileFor(canonical, writtenAt);
  const lostBreak = unstableBreak(given, canonical, planning);
  if (lostBreak) throw lostBreak;
  const text = serializeIfcx(document);
  let reread;
  try {
    reread = readIfcx(new TextEncoder().encode(text));
  } catch (error) {
    throw new IfcxWriteRefusedError('self-check', `De eigen lezer opent de IFCX-uitvoer niet: ${error instanceof Error ? error.message : String(error)}`);
  }
  const differences = selfCheckDifferences(canonical, reread);
  if (differences.length > 0) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer geeft een andere planning: ${differences.join('; ')}`,
      differences.map(difference => difference.slice(0, difference.indexOf(': '))));
  }
  return text;
}
