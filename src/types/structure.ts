export interface ActivityCodeValue {
  id: string;
  code: string;
  description?: string;
  color?: string;
}

export interface ActivityCodeType {
  id: string;
  name: string;
  values: ActivityCodeValue[];
}

export type CustomFieldType = 'text' | 'number' | 'integer' | 'cost' | 'date' | 'boolean';

export interface CustomFieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
}

export type CustomFieldValue = string | number | boolean;
