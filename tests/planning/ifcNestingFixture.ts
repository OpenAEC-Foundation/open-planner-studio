// Gedeelde deterministische invoer voor regressie en vergelijking van de volledige IFC-lezer.
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import type { ImportResult } from '@/services/importTypes';

export type NestingShape = 'breed' | 'verdeeld';

export function createIfcNestingFixture(size: number, shape: NestingShape): ImportResult {
  const input = generateBenchmarkProject(size, { seed: 0x1fc2026, resourceCount: 8 });
  if (shape === 'breed') {
    // Een geïmporteerde werkpakkettenlijst onder één fase, met hetzelfde relatienetwerk,
    // dezelfde resources en toewijzingen als de gewone WBS. Exact size taken, geen lege fasen.
    const root = input.tasks[0];
    for (const task of input.tasks) {
      task.childIds = [];
      task.parentId = task === root ? null : root.id;
    }
    root.childIds = input.tasks.slice(1).map(task => task.id);
  }
  input.project.name = `IFC-lezen ${shape} ${size}`;
  const origin = { companyId: 'bouwbedrijf', libraryItemId: 'ploegkalender', poolVersion: 3 };
  input.resourceCalendars = [{
    ...input.calendar, id: 'cal-ploeg', name: 'Vroege ploeg', workStartHour: 6,
    workEndHour: 14, hoursPerDay: 8, holidays: [], libraryOrigin: origin,
  }, {
    ...input.calendar, id: 'cal-ongebruikt', name: 'Nog niet toegewezen',
    holidays: [], generation: { ruleSetId: 'NL', generatedFromYear: 2026, generatedToYear: 2028 },
  }];
  input.resources[0].calendarId = 'cal-ploeg';
  input.tasks[size - 1].calendarId = 'cal-ploeg';
  input.baselines = [{
    id: 'baseline-vast', name: 'Oorspronkelijke planning', createdAt: '2026-01-05T00:00:00Z',
    projectEnd: input.project.endDate, projectDuration: 30,
    tasks: input.tasks.slice(0, 20).map(task => ({
      taskId: task.id, start: task.time.scheduleStart, finish: task.time.scheduleFinish,
      duration: task.time.scheduleDuration, isMilestone: task.isMilestone,
    })),
  }];
  input.activeBaselineId = 'baseline-vast';
  input.importPristine = true;
  input.recordedSourceFormat = 'mpp';
  return input;
}
