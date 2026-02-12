export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string; // ISO 8601
  endDate: string;
  calendarId: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
  company: string;
}

export interface ProjectStats {
  totalTasks: number;
  totalMilestones: number;
  criticalPathLength: number; // in work days
  totalFloat: number; // in work days
  percentComplete: number; // 0-100
}
