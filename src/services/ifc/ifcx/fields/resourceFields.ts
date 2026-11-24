import type { AvailabilityStep, Resource, ResourceType } from '@/types/resource';
import type { LibraryOrigin } from '@/types/library';
import {
  arrayOf, CALENDAR_DATE, enumOf, GLOBAL_ID_OUTSIDE_PATH, integer, NON_EMPTY_TEXT, NON_NEGATIVE, objectOf, REFERENCE, TEXT, type IfcxField,
} from '../fieldTable';
import type { IfcxIdentity } from '../globalIdUuid';
import { IfcxReadError } from '../ifcxErrors';
import { ATTRIBUTE } from '../profile';

export interface ResourceWriteSource {
  readonly resource: Resource;
  readonly identity: IfcxIdentity;
  readonly crewPath?: string;
  readonly calendarPath?: string;
}

export interface ResourceReadTarget {
  readonly resource: Resource;
  readonly path: string;
  globalIdOutsidePath?: string;
  subtype?: ResourceSubtype;
  crewPath?: string;
  calendarPath?: string;
}

type ResourceField = IfcxField<ResourceWriteSource, ResourceReadTarget>;

const SUBTYPE_OF = {
  LABOR: 'IfcLaborResource',
  EQUIPMENT: 'IfcConstructionEquipmentResource',
  MATERIAL: 'IfcConstructionMaterialResource',
  SUBCONTRACTOR: 'IfcSubContractResource',
  CREW: 'IfcCrewResource',
  COST: 'IfcConstructionMaterialResource',
} as const satisfies Record<ResourceType, string>;
type ResourceSubtype = typeof SUBTYPE_OF[ResourceType];

const SUBTYPES = [...new Set(Object.values(SUBTYPE_OF))];
const TYPE_OF_SUBTYPE = new Map<string, ResourceType>(
  (Object.entries(SUBTYPE_OF) as [ResourceType, ResourceSubtype][]).filter(([type]) => type !== 'COST')
    .map(([type, subtype]): [string, ResourceType] => [subtype, type]),
);

const DEFAULT_MAX_UNITS = 1;

function setOptional<K extends keyof Resource>(resource: Resource, key: K, value: Resource[K] | undefined): void {
  if (value !== undefined) resource[key] = value;
}

const stepsOut = (steps: readonly AvailabilityStep[]) => steps.map(step => ({ from: step.from, maxUnits: step.maxUnits }));

function libraryOriginOut(origin: LibraryOrigin): LibraryOrigin {
  return {
    companyId: origin.companyId, libraryItemId: origin.libraryItemId, poolVersion: origin.poolVersion,
    ...(origin.syncedHash !== undefined ? { syncedHash: origin.syncedHash } : {}),
  };
}

export const RESOURCE_PLANNING_FIELDS: readonly ResourceField[] = [
  {
    key: 'name', value: TEXT,
    write: s => s.resource.name,
    read: (v, t) => { t.resource.name = v as string; },
  },
  {
    key: 'description', value: TEXT, optional: true,
    write: s => s.resource.description || undefined,
    read: (v, t) => { t.resource.description = (v as string | undefined) ?? ''; },
  },
  {
    key: 'subtype', value: enumOf(SUBTYPES),
    write: s => SUBTYPE_OF[s.resource.type],
    read: (v, t) => { t.subtype = v as ResourceSubtype; t.resource.type = TYPE_OF_SUBTYPE.get(v as string)!; },
  },
  {
    key: 'crew', value: REFERENCE, optional: true,
    write: s => s.crewPath,
    read: (v, t) => { t.crewPath = v as string | undefined; },
  },
  {
    key: 'calendar', value: REFERENCE, optional: true,
    write: s => s.calendarPath,
    read: (v, t) => { t.calendarPath = v as string | undefined; },
  },
  {
    key: 'maxUnits', value: NON_NEGATIVE, optional: true,
    write: s => (s.resource.maxUnits !== DEFAULT_MAX_UNITS ? s.resource.maxUnits : undefined),
    read: (v, t) => { t.resource.maxUnits = (v as number | undefined) ?? DEFAULT_MAX_UNITS; },
  },
  {
    key: 'costPerHour', value: NON_NEGATIVE, optional: true,
    write: s => s.resource.costPerHour,
    read: (v, t) => setOptional(t.resource, 'costPerHour', v as number | undefined),
  },
  {
    key: 'unitOfMeasure', value: TEXT, optional: true,
    write: s => s.resource.unitOfMeasure,
    read: (v, t) => setOptional(t.resource, 'unitOfMeasure', v as string | undefined),
  },
];

export const RESOURCE_OPS_FIELDS: readonly ResourceField[] = [
  {
    key: 'id', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.resource.id !== s.identity.path ? s.resource.id : undefined),
    read: (v, t) => { t.resource.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'globalId', value: GLOBAL_ID_OUTSIDE_PATH, optional: true,
    write: s => s.identity.globalIdOutsidePath,
    read: (v, t) => { t.globalIdOutsidePath = v as string | undefined; },
  },
  {
    key: 'type', value: enumOf(['COST']), optional: true,
    write: s => (s.resource.type === 'COST' ? 'COST' : undefined),
    read: (v, t) => {
      if (v === undefined) return;
      if (t.subtype !== SUBTYPE_OF.COST) {
        throw new IfcxReadError('invalid', `Een kostenresource is in het profiel een ${SUBTYPE_OF.COST}`,
          { path: t.path, attribute: ATTRIBUTE.opsResource, field: 'type' });
      }
      t.resource.type = 'COST';
    },
  },
  {
    key: 'availability', value: NON_NEGATIVE, optional: true,
    write: s => s.resource.availability,
    read: (v, t) => setOptional(t.resource, 'availability', v as number | undefined),
  },
  {
    key: 'availabilitySteps', value: arrayOf(objectOf({ from: { value: CALENDAR_DATE }, maxUnits: { value: NON_NEGATIVE } })), optional: true,
    write: s => (s.resource.availabilitySteps ? stepsOut(s.resource.availabilitySteps) : undefined),
    read: (v, t) => setOptional(t.resource, 'availabilitySteps', v ? stepsOut(v as AvailabilityStep[]) : undefined),
  },
  {
    key: 'color', value: TEXT, optional: true,
    write: s => s.resource.color,
    read: (v, t) => setOptional(t.resource, 'color', v as string | undefined),
  },
  {
    key: 'libraryOrigin', optional: true,
    value: objectOf({
      companyId: { value: NON_EMPTY_TEXT }, libraryItemId: { value: NON_EMPTY_TEXT }, poolVersion: { value: integer(0) }, syncedHash: { value: TEXT, optional: true },
    }),
    write: s => (s.resource.libraryOrigin ? libraryOriginOut(s.resource.libraryOrigin) : undefined),
    read: (v, t) => setOptional(t.resource, 'libraryOrigin', v ? libraryOriginOut(v as LibraryOrigin) : undefined),
  },
];

export const RESOURCE_KEYS_CARRIED: readonly (keyof Resource)[] = [
  'id', 'name', 'type', 'description', 'costPerHour', 'availability', 'maxUnits', 'calendarId', 'availabilitySteps',
  'unitOfMeasure', 'parentId', 'color', 'libraryOrigin',
];

export function emptyResource(): Resource {
  return { id: '', name: '', type: 'LABOR', description: '', maxUnits: DEFAULT_MAX_UNITS };
}
