// Bron: MPXJ, © Jon Iles e.a., structuurkennis en veldconstanten geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).
import type { TaskSplitGap } from '@/types/task';
import { gapsBetweenWorkedSpans, intersectAssignmentGaps } from '@/services/contourIo';
import { getShort, getInt, getDouble, getTimestamp } from './mppPrimitives';
import {
  clampTimephasedRegularRecordCount, clampTimephasedIrregularRecordCount, clampTimephasedPlannedRecordCount,
} from './limits';

export interface TimephasedWorkPeriod {
  elapsedWorkMinutesStart: number;
  elapsedWorkMinutesEnd: number;
  workMinutes: number;
  approxStart: Date;
  approxFinish: Date;
}

export interface TimephasedIrregularPeriod {
  start: Date;
  finish: Date;
  workMinutes: number;
}

const REGULAR_HEADER_SIZE = 16;
const REGULAR_RECORD_SIZE = 20;
const PLANNED_HEADER_SIZE = 16;
const PLANNED_BLOCK_SIZE = 28;
const IRREGULAR_HEADER_SIZE = 16;
const IRREGULAR_RECORD_SIZE = 8;

function addClockMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

function roundMinutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60) / 60;
}

export function decodeRegularTimephasedWork(data: Uint8Array | null, referenceStart: Date, ctx = 'timephased regular'): TimephasedWorkPeriod[] {
  if (!data || data.length < REGULAR_HEADER_SIZE + REGULAR_RECORD_SIZE) return [];

  const headerCount = getShort(data, 0, ctx);
  const structuralMax = Math.max(0, Math.floor((data.length - REGULAR_HEADER_SIZE - REGULAR_RECORD_SIZE) / REGULAR_RECORD_SIZE));
  const count = clampTimephasedRegularRecordCount(Math.min(Math.max(0, headerCount), structuralMax));

  const finishTime = getInt(data, 24, ctx);

  const result: TimephasedWorkPeriod[] = [];
  let prevRawCumulativeWork = 0;
  let prevCumulativeElapsedMinutes = 0;
  for (let i = 0; i < count; i++) {
    const offset = REGULAR_HEADER_SIZE + REGULAR_RECORD_SIZE + i * REGULAR_RECORD_SIZE;

    const rawCumulativeWork = Math.trunc(getDouble(data, offset, ctx));

    const rawElapsed = getInt(data, offset + 16, ctx);
    const cumulativeElapsedMinutes = (rawElapsed < 0 || rawElapsed > finishTime) ? 0 : rawElapsed / 80;

    const periodElapsedMinutes = cumulativeElapsedMinutes - prevCumulativeElapsedMinutes;
    if (periodElapsedMinutes > 0) {
      result.push({
        elapsedWorkMinutesStart: prevCumulativeElapsedMinutes,
        elapsedWorkMinutesEnd: cumulativeElapsedMinutes,
        workMinutes: roundMinutesToSeconds((rawCumulativeWork - prevRawCumulativeWork) / 1000),
        approxStart: addClockMinutes(referenceStart, prevCumulativeElapsedMinutes),
        approxFinish: addClockMinutes(referenceStart, cumulativeElapsedMinutes),
      });
    }
    prevRawCumulativeWork = rawCumulativeWork;
    prevCumulativeElapsedMinutes = cumulativeElapsedMinutes;
  }
  return result;
}

export function decodePlannedRegularTimephasedWork(
  data: Uint8Array | null,
  referenceStart: Date,
  referenceFinish?: Date,
  ctx = 'timephased planned',
): TimephasedWorkPeriod[] {
  if (!data || data.length < PLANNED_HEADER_SIZE + 8) return [];

  const blockCount = getShort(data, 0, ctx);

  if (blockCount === 0) {
    if (!referenceFinish) return [];
    const totalWorkMinutes = getDouble(data, 16, ctx) / 1000;
    if (totalWorkMinutes === 0) return [];
    return [{
      elapsedWorkMinutesStart: 0,
      elapsedWorkMinutesEnd: Math.max(0, (referenceFinish.getTime() - referenceStart.getTime()) / 60_000),
      workMinutes: totalWorkMinutes,
      approxStart: referenceStart,
      approxFinish: referenceFinish,
    }];
  }

  const structuralMax = Math.max(0, Math.floor((data.length - PLANNED_HEADER_SIZE - PLANNED_BLOCK_SIZE) / PLANNED_BLOCK_SIZE));
  const count = clampTimephasedPlannedRecordCount(Math.min(Math.max(0, blockCount), structuralMax));

  const result: TimephasedWorkPeriod[] = [];
  let prevCumulativeWorkMinutes = 0;
  let prevCumulativeElapsedMinutes = 0;
  for (let i = 0; i < count; i++) {
    const offset = PLANNED_HEADER_SIZE + PLANNED_BLOCK_SIZE + i * PLANNED_BLOCK_SIZE;
    const cumulativeWorkMinutes = getDouble(data, offset, ctx) / 1000;
    const cumulativeElapsedMinutes = getInt(data, offset + 24, ctx) / 80;

    const periodElapsedMinutes = cumulativeElapsedMinutes - prevCumulativeElapsedMinutes;
    if (periodElapsedMinutes > 0) {
      result.push({
        elapsedWorkMinutesStart: prevCumulativeElapsedMinutes,
        elapsedWorkMinutesEnd: cumulativeElapsedMinutes,
        workMinutes: cumulativeWorkMinutes - prevCumulativeWorkMinutes,
        approxStart: addClockMinutes(referenceStart, prevCumulativeElapsedMinutes),
        approxFinish: addClockMinutes(referenceStart, cumulativeElapsedMinutes),
      });
    }
    prevCumulativeWorkMinutes = cumulativeWorkMinutes;
    prevCumulativeElapsedMinutes = cumulativeElapsedMinutes;
  }
  return result;
}

export function decodeIrregularTimephasedWork(data: Uint8Array | null, ctx = 'timephased irregular'): TimephasedIrregularPeriod[] {
  if (!data || data.length < IRREGULAR_HEADER_SIZE) return [];

  const headerCount = getShort(data, 0, ctx);
  const structuralMax = Math.max(0, Math.floor((data.length - IRREGULAR_HEADER_SIZE) / IRREGULAR_RECORD_SIZE));
  const count = clampTimephasedIrregularRecordCount(Math.min(Math.max(0, headerCount), structuralMax));

  const result: TimephasedIrregularPeriod[] = [];
  for (let i = 0; i < count; i++) {
    const offset = IRREGULAR_HEADER_SIZE + i * IRREGULAR_RECORD_SIZE;
    const start = getTimestamp(data, offset, ctx);
    const finish = getTimestamp(data, offset + 4, ctx);
    if (!start || !finish || finish.getTime() <= start.getTime()) continue;
    result.push({ start, finish, workMinutes: (finish.getTime() - start.getTime()) / 60_000 });
  }
  return result;
}

export interface AssignmentTimephasedRaw {
  actualRegularWork: Uint8Array | null;
  remainingRegularWork: Uint8Array | null;
  actualOvertimeWork: Uint8Array | null;
  actualIrregularWork: Uint8Array | null;
}

export function hasAnyTimephasedData(raw: AssignmentTimephasedRaw): boolean {
  return raw.actualRegularWork !== null || raw.remainingRegularWork !== null
    || raw.actualOvertimeWork !== null || raw.actualIrregularWork !== null;
}

export function shiftPeriods(periods: readonly TimephasedWorkPeriod[], shiftMinutes: number): readonly TimephasedWorkPeriod[] {
  if (shiftMinutes === 0) return periods;
  return periods.map((p) => ({
    ...p,
    elapsedWorkMinutesStart: p.elapsedWorkMinutesStart + shiftMinutes,
    elapsedWorkMinutesEnd: p.elapsedWorkMinutesEnd + shiftMinutes,
  }));
}

export function deriveSplitGapsFromPeriods(periods: readonly TimephasedWorkPeriod[]): TaskSplitGap[] {
  return gapsBetweenWorkedSpans(periods
    .filter((p) => p.workMinutes !== 0)
    .map((p) => ({ start: p.elapsedWorkMinutesStart, end: p.elapsedWorkMinutesEnd })));
}

export const deriveTaskSplitGaps = intersectAssignmentGaps;
