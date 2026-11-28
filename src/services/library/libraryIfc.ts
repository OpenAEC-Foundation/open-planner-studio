import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { normalizePoolShape } from './libraryOps';
import type { CompanyPool } from '@/types/library';
import type { Resource } from '@/types/resource';

export const POOL_COST_RESOURCE_MARKER = 'costResource';

type PoolFileResource = Resource & { [POOL_COST_RESOURCE_MARKER]?: true };

export function poolResourceToFile(resource: Resource): PoolFileResource {
  return resource.type === 'COST' ? { ...resource, type: 'MATERIAL', [POOL_COST_RESOURCE_MARKER]: true } : resource;
}

export function poolResourceFromFile(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as Record<string, unknown>;
  if (!(POOL_COST_RESOURCE_MARKER in r)) return raw;
  const { [POOL_COST_RESOURCE_MARKER]: marker, ...rest } = r;
  return marker === true && rest.type === 'MATERIAL' ? { ...rest, type: 'COST' } : rest;
}

export function writePoolIFC(pool: CompanyPool): string {
  const project = {
    ...createDefaultProject(),
    name: `Bibliotheek — ${pool.companyName}`,
    company: pool.companyName,
    companyId: pool.companyId,
    companyName: pool.companyName,
  };
  return writeIFC({
    project,
    calendar: createDefaultCalendar(),
    tasks: [],
    sequences: [],
    resources: pool.resources,
    assignments: [],
    resourceCalendars: pool.calendars,
    libraryPool: { ...pool, resources: pool.resources.map(poolResourceToFile) },
  });
}

export async function readPoolIFC(content: string): Promise<CompanyPool> {
  const result = await readIFCWithXerReconstruction(content);
  if (!result.libraryPool) {
    throw new Error('Dit IFC-bestand bevat geen bedrijfsbibliotheek (OPS_Library).');
  }
  const raw = result.libraryPool as Partial<CompanyPool>;
  if (raw && Array.isArray(raw.resources)) raw.resources = raw.resources.map(poolResourceFromFile) as Resource[];
  const cid = typeof raw?.companyId === 'string' && raw.companyId ? raw.companyId : '';
  return normalizePoolShape(cid, raw, []);
}
