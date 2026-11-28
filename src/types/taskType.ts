export interface CustomTaskType {
  id: string;
  name: string;
  color: string;
}

export type CustomTaskTypeDraft = Omit<CustomTaskType, 'color'> & { color?: string };
