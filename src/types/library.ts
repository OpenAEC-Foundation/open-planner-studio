import i18next from 'i18next';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';

export interface LibraryOrigin {
  companyId: string;
  libraryItemId: string;
  poolVersion: number;
  syncedHash?: string;
}

export interface Company {
  id: string;
  name: string;
}

export interface CompanyPool {
  companyId: string;
  companyName: string;
  poolVersion: number;
  modifiedAt: string;
  seedVersion?: number;
  calendars: WorkCalendar[];
  resources: Resource[];
}

export interface CompanyLibrary {
  companies: Company[];
  defaultCompanyId: string;
  pools: Record<string, CompanyPool>;
}

export const DEFAULT_COMPANY_ID = 'company-default';

export function createDefaultCompany(): Company {
  const name = i18next.isInitialized
    ? i18next.t('companyLibrary.defaultCompany', { ns: 'common' })
    : 'Mijn resourcebibliotheek';
  return { id: DEFAULT_COMPANY_ID, name };
}

export function createEmptyPool(company: Company): CompanyPool {
  return {
    companyId: company.id,
    companyName: company.name,
    poolVersion: 0,
    modifiedAt: new Date().toISOString(),
    calendars: [],
    resources: [],
  };
}

export function createDefaultLibrary(): CompanyLibrary {
  const company = createDefaultCompany();
  return {
    companies: [company],
    defaultCompanyId: company.id,
    pools: { [company.id]: createEmptyPool(company) },
  };
}
