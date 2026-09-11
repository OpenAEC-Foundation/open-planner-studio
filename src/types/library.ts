import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';

/**
 * Herkomststempel op een PROJECTKOPIE van een bibliotheekitem (spec §2). Maakt
 * "bijwerken vanuit bibliotheek", duplicaatherkenning en (later, B1b) resource-identiteit over
 * projecten mogelijk. `libraryItemId` = het `id` van het bronitem IN de pool (de pool-identiteit).
 */
export interface LibraryOrigin {
  companyId: string;
  libraryItemId: string;
  poolVersion: number;
  /** B1.1 (spec §2): hash van de gevolgde velden op het moment van materialisatie/laatste
   *  verversing. Spiegelt EXACT de diff-normalisatie (`diffKey` + de `*_DIFF_FIELDS`-lijsten) zodat
   *  "hash gelijk" en "diff up-to-date" niet uiteenlopen (plan-eis 8). Onderscheidt "bestand extern
   *  bewerkt" (hash ≠ file) van "bestand loopt achter op de pool" (hash == file, pool wijkt af).
   *  Afwezig (B1-bestanden zonder hash) ⇒ veilige kant: behandelen als mogelijk extern bewerkt. */
  syncedHash?: string;
}

/** Een door de user benoemde groepering met een eigen pool (spec §2). */
export interface Company {
  id: string;
  name: string;
}

/**
 * De verzameling bibliotheekkalenders en -resources van één bedrijf (spec §2). `poolVersion` loopt
 * monotoon op bij elke wijziging; `modifiedAt` is de ISO-tijdstempel van de laatste wijziging. De
 * `id` van elke kalender/resource IN de pool is diens stabiele identiteit (het `libraryItemId` waar
 * herkomststempels naar wijzen).
 */
export interface CompanyPool {
  companyId: string;
  companyName: string;
  poolVersion: number;
  modifiedAt: string; // ISO 8601
  /**
   * Alleen voor GEGENEREERDE pools (nu uitsluitend de demo-bibliotheek, zie
   * `services/library/demoLibrary.ts`): met welke INHOUDSversie van de seed deze pool is
   * aangemaakt/bijgewerkt. Losstaand van `poolVersion` — dat is de bewerkingsteller waar
   * herkomststempels en de import-demping op leunen; dit veld zegt alleen "de ingebakken
   * demo-inhoud is al bijgewerkt tot hier", zodat `seedDemoLibrary` een bestaande installatie
   * eenmalig kan bijwerken in plaats van hem voor altijd op de oude inhoud te laten staan.
   * Afwezig ⇒ versie 0 (een pool van vóór dit veld, of een door de gebruiker gemaakte pool).
   */
  seedVersion?: number;
  calendars: WorkCalendar[];
  resources: Resource[];
}

/** De volledige, app-globale bibliotheek: bedrijven + hun pools + welk bedrijf de default is. */
export interface CompanyLibrary {
  companies: Company[];
  defaultCompanyId: string;
  pools: Record<string, CompanyPool>; // key = companyId
}

/** Vaste id van de automatische standaard-resourcebibliotheek (spec §2, "Mijn resourcebibliotheek"). */
export const DEFAULT_COMPANY_ID = 'company-default';

export function createDefaultCompany(): Company {
  return { id: DEFAULT_COMPANY_ID, name: 'Mijn resourcebibliotheek' };
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
