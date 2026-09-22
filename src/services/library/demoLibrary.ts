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
import type { Resource, ResourceType } from '@/types/resource';
import { generateId } from '@/utils/id';

/** Vast, herkenbaar id — nooit dubbel aangemaakt (spec: idempotente seed). Net als
 *  `DEFAULT_COMPANY_ID` in `@/types/library` is dit géén i18n-string: de bibliotheeknaam is
 *  opgeslagen data, geen UI-tekst. */
export const DEMO_COMPANY_ID = 'demo-resourcebibliotheek';

/**
 * Inhoudsversie van de demo-seed. Waarom dit bestaat: `seedDemoLibrary` was idempotent op de
 * AANWEZIGHEID van het bedrijf — een installatie die de demo-bibliotheek ooit eens geseed had,
 * kreeg een latere inhoudscorrectie dus NOOIT te zien. Dat was geen theoretisch risico: het
 * bezettingsoverzicht stond bij zo'n installatie vol rode rijen (Carpenters 4, Tilers 3, Kitchen
 * fitters 2) omdat die oude capaciteiten kleiner waren dan wat de showcases zelf boeken.
 *
 * Versie 2 (B1c-demo-opschoning): capaciteiten opgehoogd tot boven de gemeten gelijktijdige vraag
 * van de drie showcases samen, ZODAT alleen de twee BEDOELDE knelpunten rood staan (Masonry crew
 * en Plasterers). `migrateDemoLibrarySeed()` brengt een oudere pool bij zonder item-id's te
 * veranderen, zodat herkomststempels in open projecten geldig blijven.
 */
export const DEMO_LIBRARY_SEED_VERSION = 2;

/** Vaste naam-literal (net als `createDefaultCompany()` in `@/types/library`) — bewust GEEN `t(...)`. */
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

/** Eén poolitem als DATA (zonder id — die wordt per seed vers gegenereerd). `calendarName`
 *  verwijst naar een van de twee demo-kalenders op NAAM, zodat de bedrading na id-toekenning
 *  gebeurt en de migratie hetzelfde item op naam kan terugvinden. */
interface DemoResourceSpec {
  name: string;
  type: ResourceType;
  description: string;
  maxUnits: number;
  costPerHour?: number;
  unitOfMeasure?: string;
  calendarName?: string;
}

/**
 * CAPACITEITSVLOER (B1c): de bibliotheek IS het bedrijf, en het bedrijf moet de drie showcases
 * samen kunnen bemensen — anders is het bezettingsoverzicht bij de demo één rode muur en verdrinkt
 * het bedoelde verhaal. De capaciteiten hieronder liggen daarom boven de GEMETEN gelijktijdige
 * piekvraag van de drie showcases bij elkaar (gemeten met dezelfde `computeLibraryOccupancy` die
 * het overzicht gebruikt, met marge naar boven), met exact twee uitzonderingen:
 *
 *  • **Masonry crew** (1) — dezelfde ploeg die in KLEIN én MIDDEL tegelijk gevraagd wordt. Dat is
 *    HET kruis-project-conflict waar "Verdeel automatisch" op gedemonstreerd wordt.
 *  • **Plasterers** (3) — één stukadoorsploeg die in alle drie de showcases meedoet. MIDDEL en
 *    GROOT hebben daarbij ook nog hun eigen, in hun spec gedocumenteerde interne
 *    stukadoors-overallocatie; het overzicht laat zien hoe die drie samenkomen.
 *
 * Alle overige items horen GROEN te staan. `tests/library/check-showcase-occupancy.ts` bewaakt dat
 * mechanisch als EXACTE set, zodat een toekomstige regeneratie van de voorbeelden de demo niet
 * stilletjes weer rood maakt.
 *
 * Let op: `maxUnits` van een POOLitem is geen projectinzet — `applyResourceUpdate` laat de
 * `maxUnits` van de projectkopie bewust staan (die hoort bij het project). Deze cijfers ophogen
 * verandert dus geen enkel histogram, geen enkele CPM-datum en geen enkele showcase-belofte
 * binnen één project; ze bepalen uitsluitend de bedrijfsgrens in het bezettingsoverzicht.
 */
const DEMO_RESOURCE_SPECS: DemoResourceSpec[] = [
  // gemeten gelijktijdige piek 12 (GROOT dimensioneert zelf al 4 timmerlieden × 3 torens)
  { name: 'Carpenters', type: 'LABOR', description: 'Carpentry crew for structural works and fit-out.', maxUnits: 14, costPerHour: 45 },
  // gemeten piek 18 (GROOT 6 × 3 torens)
  { name: 'MEP fitters', type: 'LABOR', description: 'Electrical and mechanical building services.', maxUnits: 20, costPerHour: 48 },
  // BEDOELD KNELPUNT: één ploeg, drie projecten (gemeten piek 9)
  { name: 'Plasterers', type: 'LABOR', description: 'Plastering to walls and ceilings — a single crew, deliberately scarce.', maxUnits: 3, costPerHour: 42 },
  // gemeten piek 13
  { name: 'Painters', type: 'LABOR', description: 'Internal and external painting.', maxUnits: 16, costPerHour: 38 },
  // gemeten piek 6
  { name: 'Bricklayers', type: 'LABOR', description: 'Masonry to facades and internal leaves.', maxUnits: 8, costPerHour: 46 },
  // BEDOELD KNELPUNT: dezelfde ploeg in KLEIN én MIDDEL (gemeten piek 2)
  { name: 'Masonry crew', type: 'CREW', description: 'Masonry crew moving from house to house.', maxUnits: 1, calendarName: METSELPLOEG_KALENDER_NAAM },
  { name: 'Concrete C20/25', type: 'MATERIAL', description: 'Standard foundation and structural concrete.', maxUnits: 999, unitOfMeasure: 'm³' },
  // gemeten piek 6 (GROOT 2 × 3 torens)
  { name: 'Steel fixers', type: 'LABOR', description: 'Reinforcement fixing.', maxUnits: 8, costPerHour: 44 },
  // gemeten piek 14 (GROOT 5 × 3 torens)
  { name: 'Tilers', type: 'LABOR', description: 'Tiling in bathrooms and kitchens.', maxUnits: 16, costPerHour: 43 },
  // gemeten piek 7 (GROOT 3 × 3 torens)
  { name: 'Kitchen fitters', type: 'LABOR', description: 'Kitchen installation.', maxUnits: 9, costPerHour: 46 },
  // gemeten piek 6 kraanposities per dag. GROOT houdt op PROJECTniveau bewust één kraan (zijn
  // eigen, gedocumenteerde knelpunt in het histogram); het BEDRIJF heeft een grotere vloot.
  { name: 'Tower crane', type: 'EQUIPMENT', description: 'Tower cranes in the company fleet; a project normally deploys one.', maxUnits: 8, costPerHour: 120 },
  { name: 'Concrete C30/37', type: 'MATERIAL', description: 'High-strength concrete for structural pours.', maxUnits: 999, unitOfMeasure: 'm³' },
  // gemeten piek 6 (GROOT 2 × 3 torens)
  { name: 'Facade contractor', type: 'SUBCONTRACTOR', description: 'Facade cladding subcontractor.', maxUnits: 8, costPerHour: 60 },
  // gemeten piek 3 (GROOT 1 × 3 torens)
  { name: 'Lift supplier', type: 'SUBCONTRACTOR', description: 'Subcontractor supplying and installing the lift.', maxUnits: 4, costPerHour: 90 },
];

function specToResource(spec: DemoResourceSpec, calendars: WorkCalendar[]): Resource {
  const { calendarName, ...rest } = spec;
  const calendarId = calendarName ? calendars.find((c) => c.name === calendarName)?.id : undefined;
  return { id: generateId('res'), ...rest, ...(calendarId ? { calendarId } : {}) };
}

/** Bouw de vaste demo-bedrijf + -pool (spec: letterlijke inhoud uit de opdracht). */
export function buildDemoLibrarySeed(): { company: Company; pool: CompanyPool } {
  const company: Company = { id: DEMO_COMPANY_ID, name: DEMO_COMPANY_NAME };

  const calendars = [buildBouwkalenderNL(), buildMetselploegKalender()];
  // Bedraad ná id-toekenning: Masonry crew.calendarId verwijst naar de zojuist gegenereerde
  // 4-daagse-week-kalender-id.
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

/**
 * Breng een REEDS GESEEDE demo-pool bij naar `DEMO_LIBRARY_SEED_VERSION`. Puur: retourneert een
 * nieuwe pool plus of er inhoudelijk iets veranderde.
 *
 * Regels (bewust conservatief — de gebruiker mag de demo-bibliotheek bewerkt hebben):
 *  - items worden op NAAM teruggevonden (`name`, exact zoals de seed ze schrijft) en krijgen de
 *    nieuwe `maxUnits` + `description`; hun `id` blijft ongewijzigd, zodat herkomststempels in
 *    open/opgeslagen projecten geldig blijven;
 *  - een item dat de pool niet (meer) heeft wordt TOEGEVOEGD met een vers id;
 *  - er wordt NOOIT iets verwijderd, en geen enkel ander veld wordt aangeraakt (een eigen tarief of
 *    kalenderkeuze van de gebruiker blijft staan);
 *  - ontbreekt de kalender waar een toe te voegen item naar verwijst, dan wordt die ook toegevoegd;
 *  - is de pool al op versie ⇒ no-op (`changed: false`, geen bump).
 */
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
      // Kalenderbedrading van een NIEUW toegevoegd item: aanmaken indien nodig, dán pas bouwen.
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
