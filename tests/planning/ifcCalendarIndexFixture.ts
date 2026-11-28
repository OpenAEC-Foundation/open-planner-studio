import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';

export function ifcCalendarIndexFixture(size: number, calendarCount: number): WriteIFCInput {
  const data = generateBenchmarkProject(size, { seed: 0x1fc, resourceCount: Math.min(size, 250) });
  const calendars = Array.from({ length: calendarCount }, (_, i) => ({
    ...data.calendar, id: `kalender-${i}`, name: `Ploegkalender ${i}`, holidays: [],
  }));
  const ids = [...calendars.map(c => c.id), undefined, data.calendar.id, 'onbekende-kalender'];
  data.tasks.forEach((t, i) => { t.calendarId = ids[i % ids.length]; });
  data.resources.forEach((r, i) => { r.calendarId = ids[(i * 7) % ids.length]; });
  return { ...data, resourceCalendars: [data.calendar, ...calendars] };
}
