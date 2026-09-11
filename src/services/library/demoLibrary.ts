/**
 * Demo-resourcebibliotheek (issue #19, user-verzoek): de drie showcase-voorbeelden (`public/examples/`,
 * `category: 'showcase'`) delen voortaan één gedeelde pool, zodat een nieuwe gebruiker "dezelfde ploeg
 * in twee projecten" direct in actie ziet — Carpenters/MEP fitters/Plasterers/Painters komen
 * LETTERLIJK zo terug in zowel `showcase-rijwoningen-de-akkers.ifc` als
 * `showcase-appartementencomplex.ifc`, zodat de naam-herkenning (`matchByName`) ze automatisch koppelt.
 *
 * Puur data-/bouwmodule — geen store-afhankelijkheid (zie `librarySlice.seedDemoLibrary` voor de
 * store-integratie: dezelfde `set`/`persist`-laag als een gewone bibliotheek, hier alleen de
 * INHOUD). `buildDemoLibrarySeed()` genereert verse id's per aanroep (niet deterministisch qua id's),
 * maar de INHOUD (namen/type/maxUnits/costPerHour/kalenders) ligt vast.
 */
import type { Company, CompanyPool } from '@/types/library';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';
import { generateId } from '@/utils/id';

/** Vast, herkenbaar id — nooit dubbel aangemaakt (spec: idempotente seed). Net als
 *  `DEFAULT_COMPANY_ID` in `@/types/library` is dit géén i18n-string: de bibliotheeknaam is
 *  opgeslagen data, geen UI-tekst. */
export const DEMO_COMPANY_ID = 'demo-resourcebibliotheek';

/** Vaste naam-literal (net als `createDefaultCompany()` in `@/types/library`) — bewust GEEN `t(...)`. */
const DEMO_COMPANY_NAME = 'Demo resource library';

function buildBouwkalenderNL(): WorkCalendar {
  return {
    id: generateId('cal'),
    name: 'Construction calendar NL',
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
    name: 'Masonry crew, 4-day week',
    description: 'Shortened working week for the masonry crew: Monday to Thursday, 07:00-16:00.',
    workDays: [1, 2, 3, 4],
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: [],
  };
}

/** Bouw de vaste demo-bedrijf + -pool (spec: letterlijke inhoud uit de opdracht). */
export function buildDemoLibrarySeed(): { company: Company; pool: CompanyPool } {
  const company: Company = { id: DEMO_COMPANY_ID, name: DEMO_COMPANY_NAME };

  const bouwkalenderNL = buildBouwkalenderNL();
  const metselploegKalender = buildMetselploegKalender();

  // Bedraad ná id-toekenning: Metselploeg.calendarId verwijst naar de zojuist gegenereerde
  // 4-daagse-week-kalender-id.
  //
  // CAPACITEITSVLOER (B1c): elk item moet minstens ÉÉN taak van de grootste showcase kunnen
  // bemensen. De capaciteiten hieronder zijn bedoeld als schaars (dat is het hele punt van het
  // bezettingsoverzicht), maar niet zó schaars dat een losse taak al meer vraagt dan het bedrijf
  // heeft: dan is de dubbelbezetting INTRINSIEK — geen enkele volgorde van projecten lost hem op,
  // en "Verdeel automatisch" kan alleen nog een tekort melden. Vier items zijn daarom opgehoogd tot
  // de gemeten piekvraag van één taak in "De Vaart Apartment Complex" (afbouw per toren, met
  // curve-concentratie): MEP fitters 4→5, Painters 4→5, Tilers 3→5, Kitchen fitters 2→3. Alle
  // bestaande conflictrijen blijven bestaan — die komen van MEERDERE taken/projecten tegelijk, niet
  // van één taak. `tests/library/check-showcase-occupancy.ts` bewaakt deze vloer mechanisch.
  const resources: Resource[] = [
    { id: generateId('res'), name: 'Carpenters', type: 'LABOR', description: 'Carpentry crew for structural works and fit-out.', maxUnits: 4, costPerHour: 45 },
    { id: generateId('res'), name: 'MEP fitters', type: 'LABOR', description: 'Electrical and mechanical building services.', maxUnits: 5, costPerHour: 48 },
    { id: generateId('res'), name: 'Plasterers', type: 'LABOR', description: 'Plastering to walls and ceilings.', maxUnits: 3, costPerHour: 42 },
    { id: generateId('res'), name: 'Painters', type: 'LABOR', description: 'Internal and external painting.', maxUnits: 5, costPerHour: 38 },
    { id: generateId('res'), name: 'Bricklayers', type: 'LABOR', description: 'Masonry to facades and internal leaves.', maxUnits: 6, costPerHour: 46 },
    { id: generateId('res'), name: 'Masonry crew', type: 'CREW', description: 'Masonry crew moving from house to house.', maxUnits: 1, calendarId: metselploegKalender.id },
    { id: generateId('res'), name: 'Concrete C20/25', type: 'MATERIAL', description: 'Standard foundation and structural concrete.', maxUnits: 999, unitOfMeasure: 'm³' },
    { id: generateId('res'), name: 'Steel fixers', type: 'LABOR', description: 'Reinforcement fixing.', maxUnits: 4, costPerHour: 44 },
    { id: generateId('res'), name: 'Tilers', type: 'LABOR', description: 'Tiling in bathrooms and kitchens.', maxUnits: 5, costPerHour: 43 },
    { id: generateId('res'), name: 'Kitchen fitters', type: 'LABOR', description: 'Kitchen installation.', maxUnits: 3, costPerHour: 46 },
    { id: generateId('res'), name: 'Tower crane', type: 'EQUIPMENT', description: 'Tower crane for vertical transport.', maxUnits: 1, costPerHour: 120 },
    { id: generateId('res'), name: 'Concrete C30/37', type: 'MATERIAL', description: 'High-strength concrete for structural pours.', maxUnits: 999, unitOfMeasure: 'm³' },
    { id: generateId('res'), name: 'Facade contractor', type: 'SUBCONTRACTOR', description: 'Facade cladding subcontractor.', maxUnits: 2, costPerHour: 60 },
    { id: generateId('res'), name: 'Lift supplier', type: 'SUBCONTRACTOR', description: 'Subcontractor supplying and installing the lift.', maxUnits: 1, costPerHour: 90 },
  ];

  const pool: CompanyPool = {
    companyId: company.id,
    companyName: company.name,
    poolVersion: 1,
    modifiedAt: new Date().toISOString(),
    calendars: [bouwkalenderNL, metselploegKalender],
    resources,
  };

  return { company, pool };
}
