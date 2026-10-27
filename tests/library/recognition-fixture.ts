// Gedeelde invoer en oude herkenningsroute voor regressie en de begrensde CI-meting.
import type { AppState, AppStore } from '@/state/appStoreFactory';
import type { RecognitionCandidate } from '@/state/slices/librarySlice';
import { matchByName } from '@/services/library/libraryOps';
import type { Company, CompanyPool } from '@/types/library';
import type { Resource } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';

export interface RecognitionFixture {
  companies: Company[];
  pool: CompanyPool;
  resources: Resource[];
  calendars: WorkCalendar[];
}

export function createRecognitionFixture(size: number): RecognitionFixture {
  const names = [
    'Café', 'Kraan\u200b1', '  Ploeg \t A ', '', ' \t\u200b\u200c\u200d\ufeff\u00ad',
    'Timmerman', 'timmerman', 'Identiek object', 'Identiek object',
    'Dubbel id', 'Dubbel id', 'Idgenoot A', 'Idgenoot B', '__proto__', 'constructor',
    'I', 'İ', 'Kraan 2', 'Zichtbaar', 'Kalender',
  ];
  const queries = [
    'CAFE\u0301', 'Kraan1', 'ploeg\u00a0 a', '', '\u200b\ufeff',
    'TIMMERMAN', ' timmerman ', 'IDENTIEK OBJECT', 'Identiek object',
    'DUBBEL ID', 'Dubbel id', 'idgenoot a', 'IDGENOOT B', '__proto__', 'constructor',
    'i', 'i\u0307', 'Kraan2', 'Niet gevonden', 'kalender',
  ];
  const resource = (id: string, name: string): Resource => ({
    id, name, type: 'LABOR', description: '', maxUnits: 3, costPerHour: 50,
  });
  const calendar = (id: string, name: string): WorkCalendar => ({
    id, name, description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  });
  const pool: CompanyPool = {
    companyId: 'recognition-company', companyName: 'Herkenningsbibliotheek', poolVersion: 3,
    modifiedAt: '2026-10-26T10:00:00.000Z',
    resources: Array.from({ length: size }, (_, i) => resource(`pool-r-${i}`, names[i] ?? `Équipe ${i}`)),
    calendars: Array.from({ length: size }, (_, i) => calendar(`pool-c-${i}`, names[i] ?? `Équipe ${i}`)),
  };
  // Ook herhaalde objecten en herhaalde ids blijven afzonderlijke kandidaten.
  if (size > 12) {
    pool.resources[8] = pool.resources[7];
    pool.calendars[8] = pool.calendars[7];
    for (const items of [pool.resources, pool.calendars]) {
      items[10].id = items[9].id;
      items[12].id = items[11].id;
    }
  }
  const resources: Resource[] = Array.from({ length: size }, (_, i) => ({
    ...resource(`project-r-${i}`, queries[i] ?? ` E\u0301QUIPE\t${i}\u200b `), maxUnits: 1, costPerHour: 10,
  }));
  const calendars: WorkCalendar[] = Array.from({ length: size }, (_, i) => ({
    ...calendar(`project-c-${i}`, queries[i] ?? ` E\u0301QUIPE\t${i}\u200b `),
    workStartHour: 8, workEndHour: 16,
  }));
  for (const items of [resources, calendars]) {
    for (let i = names.length; i < size; i++) {
      if (i % 11 === 0) items[i].libraryOrigin = {
        companyId: i % 22 === 0 ? pool.companyId : 'vreemde-bibliotheek',
        libraryItemId: `bestaand-${i}`, poolVersion: 1,
      };
    }
  }
  return { companies: [{ id: pool.companyId, name: pool.companyName }], pool, resources, calendars };
}

export function installRecognitionFixture(store: AppStore, fixture: RecognitionFixture): void {
  store.setState(s => {
    s.companies = fixture.companies;
    s.pools = { [fixture.pool.companyId]: fixture.pool };
    s.project.companyId = fixture.pool.companyId;
    s.project.calendarId = fixture.calendars[0].id;
    s.resources = fixture.resources;
    s.calendars = fixture.calendars;
    s.calendar = fixture.calendars[0];
    s.isDirty = false;
  });
}

/** Referentie van vóór de index: volledige kandidaten, inclusief volgorde en ruwe namen. */
export function legacyRecognition(s: AppState): RecognitionCandidate[] {
  const companyId = s.project.companyId;
  if (!companyId || !s.companies.some(c => c.id === companyId)) return [];
  const pool = s.pools[companyId];
  if (!pool) return [];
  const out: RecognitionCandidate[] = [];
  for (const r of s.resources) {
    if (r.libraryOrigin) continue;
    const m = matchByName(r.name, pool.resources);
    out.push({ kind: 'resource', projectId: r.id, projectName: r.name, suggestedPoolId: m?.id ?? null, suggestedPoolName: m?.name ?? null });
  }
  for (const c of s.calendars) {
    if (c.libraryOrigin) continue;
    const m = matchByName(c.name, pool.calendars);
    out.push({ kind: 'calendar', projectId: c.id, projectName: c.name, suggestedPoolId: m?.id ?? null, suggestedPoolName: m?.name ?? null });
  }
  return out;
}
