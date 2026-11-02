// Eén vaste vlakke planning voor beide revisies en beide meetroutes.
export function fixture(size) {
  return Array.from({ length: size }, (_, i) => ({
    id: `zoek-${i}`, name: i === 0 ? 'Eigenaar' : i === size - 1 ? 'Late unieke taak' : `Werk Étage ${i}`,
    wbsCode: String(i + 1), description: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    priority: 500, parentId: null, childIds: [], resourceIds: [], isMilestone: false,
    manuallyScheduled: true,
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 1,
      scheduleStart: '2026-09-07', scheduleFinish: '2026-09-07',
      earlyStart: '2026-09-07', earlyFinish: '2026-09-07',
      lateStart: '2026-09-07', lateFinish: '2026-09-07',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  }));
}
export const queries = ['', 'Werk', 'Late unieke taak', 'onvindbaar'];
