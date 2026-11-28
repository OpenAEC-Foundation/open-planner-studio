import type { Project } from '@/types/project';
import type { ViewState } from './slices/types';
import { generateId } from '@/utils/id';
import { localTodayIso } from '@/utils/dateUtils';

export function createDefaultProject(): Project {
  return {
    id: generateId('proj'),
    name: '',
    description: '',
    startDate: localTodayIso(),
    endDate: '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
    defaultTaskDurationUnit: 'days',
    wbsAutoNumber: true,
  };
}

export function createDefaultView(): ViewState {
  return {
    scrollX: 0,
    scrollY: 0,
    zoom: 30,
    timeScale: 'week',
    viewStartDate: localTodayIso(),
    filter: null,
    group: [],
    sort: [],
    collapsedGroupKeys: [],
  };
}
