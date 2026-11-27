import { RESOURCE_TYPES, type AvailabilityStep, type Resource, type ResourceType } from '@/types/resource';
import type { LibraryOrigin } from '@/types/library';
import { RESOURCE_TYPE_TO_IFC } from '../../ifcConstants';
import {
  arrayOf, enumOf, NON_EMPTY_TEXT, objectOf, REAL, REFERENCE, TEXT, type IfcxField, type SharedField,
} from '../fieldTable';

export interface ResourceWriteSource {
  readonly resource: Resource;
  readonly path: string;
  readonly parentPath?: string;
  readonly calendarPath?: string;
}

export interface ResourceReadTarget {
  readonly resource: Resource;
  readonly path: string;
  parentPath?: string;
  calendarPath?: string;
}

type ResourceField = IfcxField<ResourceWriteSource, ResourceReadTarget>;

const IFC_CLASS_SPELLING: Readonly<Record<string, string>> = {
  IFCLABORRESOURCE: 'IfcLaborResource',
  IFCCONSTRUCTIONEQUIPMENTRESOURCE: 'IfcConstructionEquipmentResource',
  IFCCONSTRUCTIONMATERIALRESOURCE: 'IfcConstructionMaterialResource',
  IFCSUBCONTRACTRESOURCE: 'IfcSubContractResource',
  IFCCREWRESOURCE: 'IfcCrewResource',
};

const resourceClassOf = (type: ResourceType) => IFC_CLASS_SPELLING[RESOURCE_TYPE_TO_IFC[type]];

const DEFAULT_MAX_UNITS = 1;

const STEP = objectOf({ from: { value: TEXT }, maxUnits: { value: REAL } });

const LIBRARY_ORIGIN = objectOf({
  companyId: { value: TEXT }, libraryItemId: { value: TEXT }, poolVersion: { value: REAL }, syncedHash: { value: TEXT, optional: true },
});

const stepsOf = (steps: readonly AvailabilityStep[]) => steps.map(step => ({ from: step.from, maxUnits: step.maxUnits }));

function libraryOriginOf(origin: LibraryOrigin): LibraryOrigin {
  return {
    companyId: origin.companyId, libraryItemId: origin.libraryItemId, poolVersion: origin.poolVersion,
    ...(origin.syncedHash !== undefined ? { syncedHash: origin.syncedHash } : {}),
  };
}

function setOptional<K extends keyof Resource>(resource: Resource, key: K, value: Resource[K] | undefined): void {
  if (value !== undefined) resource[key] = value;
}

export const RESOURCE_SHARED_FIELDS: readonly SharedField<ResourceWriteSource>[] = [
  { key: 'name', value: TEXT, write: s => s.resource.name },
  { key: 'description', value: TEXT, optional: true, write: s => s.resource.description || undefined },
  { key: 'resourceClass', value: enumOf([...new Set(RESOURCE_TYPES.map(resourceClassOf))]), write: s => resourceClassOf(s.resource.type) },
];

export const RESOURCE_FIELDS: readonly ResourceField[] = [
  {
    key: 'id', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.resource.id !== s.path ? s.resource.id : undefined),
    read: (v, t) => { t.resource.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'name', value: TEXT,
    write: s => s.resource.name,
    read: (v, t) => { t.resource.name = v as string; },
  },
  {
    key: 'type', value: enumOf(RESOURCE_TYPES),
    write: s => s.resource.type,
    read: (v, t) => { t.resource.type = v as ResourceType; },
  },
  {
    key: 'description', value: TEXT, optional: true,
    write: s => s.resource.description || undefined,
    read: (v, t) => { t.resource.description = (v as string | undefined) ?? ''; },
  },
  {
    key: 'maxUnits', value: REAL, optional: true,
    write: s => (s.resource.maxUnits !== DEFAULT_MAX_UNITS ? s.resource.maxUnits : undefined),
    read: (v, t) => { t.resource.maxUnits = (v as number | undefined) ?? DEFAULT_MAX_UNITS; },
  },
  {
    key: 'costPerHour', value: REAL, optional: true,
    write: s => s.resource.costPerHour,
    read: (v, t) => setOptional(t.resource, 'costPerHour', v as number | undefined),
  },
  {
    key: 'calendar', value: REFERENCE, optional: true,
    write: s => s.calendarPath,
    read: (v, t) => { t.calendarPath = v as string | undefined; },
  },
  {
    key: 'availabilitySteps', value: arrayOf(STEP), optional: true,
    write: s => (s.resource.availabilitySteps ? stepsOf(s.resource.availabilitySteps) : undefined),
    read: (v, t) => setOptional(t.resource, 'availabilitySteps', v ? stepsOf(v as AvailabilityStep[]) : undefined),
  },
  {
    key: 'unitOfMeasure', value: TEXT, optional: true,
    write: s => s.resource.unitOfMeasure,
    read: (v, t) => setOptional(t.resource, 'unitOfMeasure', v as string | undefined),
  },
  {
    key: 'parent', value: REFERENCE, optional: true,
    write: s => s.parentPath,
    read: (v, t) => { t.parentPath = v as string | undefined; },
  },
  {
    key: 'color', value: TEXT, optional: true,
    write: s => s.resource.color,
    read: (v, t) => setOptional(t.resource, 'color', v as string | undefined),
  },
  {
    key: 'libraryOrigin', value: LIBRARY_ORIGIN, optional: true,
    write: s => (s.resource.libraryOrigin ? libraryOriginOf(s.resource.libraryOrigin) : undefined),
    read: (v, t) => setOptional(t.resource, 'libraryOrigin', v ? libraryOriginOf(v as LibraryOrigin) : undefined),
  },
];

export const RESOURCE_KEYS_CARRIED: readonly (keyof Resource)[] = [
  'id', 'name', 'type', 'description', 'maxUnits', 'costPerHour', 'calendarId', 'availabilitySteps', 'unitOfMeasure', 'parentId',
  'color', 'libraryOrigin',
];

export function emptyResource(): Resource {
  return { id: '', name: '', type: 'LABOR', description: '', maxUnits: DEFAULT_MAX_UNITS };
}
