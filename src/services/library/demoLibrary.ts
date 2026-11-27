import type { Company, CompanyPool } from '@/types/library';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceType } from '@/types/resource';
import { generateId } from '@/utils/id';

export const DEMO_COMPANY_ID = 'demo-resourcebibliotheek';

export const DEMO_LIBRARY_SEED_VERSION = 2;

const DEMO_COMPANY_NAME = 'Demo resource library';

const BOUWKALENDER_NL_NAAM = 'Construction calendar NL';
const METSELPLOEG_KALENDER_NAAM = 'Masonry crew, 4-day week';

function buildBouwkalenderNL(): WorkCalendar {
  return {
    id: generateId('cal'),
    name: BOUWKALENDER_NL_NAAM,
    description: 'Standard Dutch construction calendar: Monday to Friday, 07:00-16:00.',
    workDays: [1, 2, 3, 4, 5],
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: [],
  };
}

function buildMetselploegKalender(): WorkCalendar {
  return {
    id: generateId('cal'),
    name: METSELPLOEG_KALENDER_NAAM,
    description: 'Shortened working week for the masonry crew: Monday to Thursday, 07:00-16:00.',
    workDays: [1, 2, 3, 4],
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: [],
  };
}

interface DemoResourceSpec {
  name: string;
  type: ResourceType;
  description: string;
  maxUnits: number;
  costPerHour?: number;
  unitOfMeasure?: string;
  calendarName?: string;
}

const DEMO_RESOURCE_SPECS: DemoResourceSpec[] = [
  { name: 'Carpenters', type: 'LABOR', description: 'Carpentry crew for structural works and fit-out.', maxUnits: 14, costPerHour: 45 },
  { name: 'MEP fitters', type: 'LABOR', description: 'Electrical and mechanical building services.', maxUnits: 20, costPerHour: 48 },
  { name: 'Plasterers', type: 'LABOR', description: 'Plastering to walls and ceilings — a single crew, deliberately scarce.', maxUnits: 3, costPerHour: 42 },
  { name: 'Painters', type: 'LABOR', description: 'Internal and external painting.', maxUnits: 16, costPerHour: 38 },
  { name: 'Bricklayers', type: 'LABOR', description: 'Masonry to facades and internal leaves.', maxUnits: 8, costPerHour: 46 },
  { name: 'Masonry crew', type: 'CREW', description: 'Masonry crew moving from house to house.', maxUnits: 1, calendarName: METSELPLOEG_KALENDER_NAAM },
  { name: 'Concrete C20/25', type: 'MATERIAL', description: 'Standard foundation and structural concrete.', maxUnits: 999, unitOfMeasure: 'm³' },
  { name: 'Steel fixers', type: 'LABOR', description: 'Reinforcement fixing.', maxUnits: 8, costPerHour: 44 },
  { name: 'Tilers', type: 'LABOR', description: 'Tiling in bathrooms and kitchens.', maxUnits: 16, costPerHour: 43 },
  { name: 'Kitchen fitters', type: 'LABOR', description: 'Kitchen installation.', maxUnits: 9, costPerHour: 46 },
  { name: 'Tower crane', type: 'EQUIPMENT', description: 'Tower cranes in the company fleet; a project normally deploys one.', maxUnits: 8, costPerHour: 120 },
  { name: 'Concrete C30/37', type: 'MATERIAL', description: 'High-strength concrete for structural pours.', maxUnits: 999, unitOfMeasure: 'm³' },
  { name: 'Facade contractor', type: 'SUBCONTRACTOR', description: 'Facade cladding subcontractor.', maxUnits: 8, costPerHour: 60 },
  { name: 'Lift supplier', type: 'SUBCONTRACTOR', description: 'Subcontractor supplying and installing the lift.', maxUnits: 4, costPerHour: 90 },
];

function specToResource(spec: DemoResourceSpec, calendars: WorkCalendar[]): Resource {
  const { calendarName, ...rest } = spec;
  const calendarId = calendarName ? calendars.find((c) => c.name === calendarName)?.id : undefined;
  return { id: generateId('res'), ...rest, ...(calendarId ? { calendarId } : {}) };
}

export function buildDemoLibrarySeed(): { company: Company; pool: CompanyPool } {
  const company: Company = { id: DEMO_COMPANY_ID, name: DEMO_COMPANY_NAME };

  const calendars = [buildBouwkalenderNL(), buildMetselploegKalender()];
  const resources: Resource[] = DEMO_RESOURCE_SPECS.map((spec) => specToResource(spec, calendars));

  const pool: CompanyPool = {
    companyId: company.id,
    companyName: company.name,
    poolVersion: 1,
    modifiedAt: new Date().toISOString(),
    seedVersion: DEMO_LIBRARY_SEED_VERSION,
    calendars,
    resources,
  };

  return { company, pool };
}

export function migrateDemoLibrarySeed(pool: CompanyPool): { pool: CompanyPool; changed: boolean } {
  if ((pool.seedVersion ?? 0) >= DEMO_LIBRARY_SEED_VERSION) return { pool, changed: false };

  let changed = false;
  const calendars = [...pool.calendars];
  const ensureCalendar = (name: string): string | undefined => {
    const existing = calendars.find((c) => c.name === name);
    if (existing) return existing.id;
    const fresh = name === METSELPLOEG_KALENDER_NAAM ? buildMetselploegKalender()
      : name === BOUWKALENDER_NL_NAAM ? buildBouwkalenderNL()
        : null;
    if (!fresh) return undefined;
    calendars.push(fresh);
    changed = true;
    return fresh.id;
  };

  const resources = pool.resources.map((r) => ({ ...r }));
  for (const spec of DEMO_RESOURCE_SPECS) {
    const existing = resources.find((r) => r.name === spec.name);
    if (!existing) {
      if (spec.calendarName) ensureCalendar(spec.calendarName);
      resources.push(specToResource(spec, calendars));
      changed = true;
      continue;
    }
    if (existing.maxUnits !== spec.maxUnits) { existing.maxUnits = spec.maxUnits; changed = true; }
    if (existing.description !== spec.description) { existing.description = spec.description; changed = true; }
  }

  return { pool: { ...pool, calendars, resources, seedVersion: DEMO_LIBRARY_SEED_VERSION }, changed };
}
