export type ResourceType = 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR';

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  description: string;
  costPerHour?: number;
  availability: number; // units available (e.g., 2 cranes, 4 workers)
}

export interface ResourceAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  units: number; // how many units assigned
}
