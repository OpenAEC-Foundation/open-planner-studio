import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';
import type { Company, CompanyPool, LibraryOrigin } from '@/types/library';
import { DEFAULT_COMPANY_ID } from '@/types/library';
import { DEMO_COMPANY_ID } from './demoLibrary';

/**
 * Reserved companyId's die op ELKE installatie hetzelfde zijn:
 * `DEFAULT_COMPANY_ID` (de automatische standaardbibliotheek van een verse installatie) en
 * `DEMO_COMPANY_ID` (de idempotente demo-seed, `seedDemoLibrary`). Vrijwel elke gebruiker heeft
 * hooguit ÉÉN bibliotheek — dus vrijwel elk geëxporteerd bestand draagt zo'n reserved id. Zo'n id
 * is daarom GEEN identiteitsbewijs: het companyId uit een bestand alleen behandelen als "dezelfde
 * bibliotheek, andere versie" zodra het lokaal bestaat, zou voor deze twee ids de EIGEN bibliotheek
 * van de ontvanger als vervang-doel voorstellen — precies wat `importPoolAsNewCompany` moet
 * voorkomen. Eén gedeelde bron, gebruikt door zowel de dialoog-voorselectie
 * (`PoolImportDialog`) als de import-actie zelf (`importPoolAsNewCompany`).
 */
export const RESERVED_COMPANY_IDS: ReadonlySet<string> = new Set([DEFAULT_COMPANY_ID, DEMO_COMPANY_ID]);

export function isReservedCompanyId(id: string): boolean {
  return RESERVED_COMPANY_IDS.has(id);
}

/**
 * Is een companyId uit een GEÏMPORTEERD bestand veilig genoeg om als state-sleutel te behouden?
 * `readPoolIFC` laat elke niet-lege string door zonder validatie — een vijandig bestand met bijv.
 * `"__proto__"` of `"constructor"` als companyId zou anders `s.pools[id] = …` bereiken, waar Immer
 * een draft-prototype-mutatie probeert en ongevangen gooit. Whitelist-regex (een blacklist mist
 * altijd een variant) + een expliciete uitsluiting van de bekende
 * prototype-sleutels, want die bestaan uitsluitend uit toegestane tekens (`_`) en zouden de regex
 * anders alsnog doorkomen.
 */
const SAFE_COMPANY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const UNSAFE_COMPANY_IDS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

export function isSafeFileCompanyId(id: string): boolean {
  return SAFE_COMPANY_ID_PATTERN.test(id) && !UNSAFE_COMPANY_IDS.has(id);
}

/** Uitkomst van `resolvePoolImportPreselection`: welke actie voorgeselecteerd staat in
 *  `PoolImportDialog`, en — uitsluitend bij "vervangen" — welke bibliotheek daarbij al gekozen is. */
export type PoolImportPreselection =
  | { action: 'add' }
  | { action: 'replace'; companyId: string };

/**
 * Bepaal de voorselectie voor de pool-importdialoog: welke actie ("toevoegen als nieuwe
 * resourcebibliotheek" vs "een bestaande resourcebibliotheek vervangen") staat aan zodra een bestand
 * gekozen is, en bij "vervangen" welke bibliotheek al geselecteerd is. Puur — dus rechtstreeks
 * testbaar zonder een gemount dialoog.
 *
 * Een bestand-companyId matcht een lokale bibliotheek ALLEEN als het (a) een veilige state-sleutel
 * is (`isSafeFileCompanyId` — een vijandig id als `"__proto__"` mag nooit als "match" tellen) en
 * (b) GEEN reserved id is (`isReservedCompanyId`:
 * `DEFAULT_COMPANY_ID`/`DEMO_COMPANY_ID` zijn géén identiteitsbewijs; vrijwel elke installatie heeft
 * er hooguit één bibliotheek, die dat id draagt — zonder deze uitsluiting zou de dialoog voor bijna
 * elke gebruiker "vervangen" voorstellen op de EIGEN bibliotheek van de ontvanger, en één klik op de
 * bevestigknop zou die dan onherstelbaar overschrijven). Zonder een matchende lokale bibliotheek (of
 * bij een reserved/onveilig id) ⇒ altijd "toevoegen" (de veilige default — kan nooit iets overschrijven).
 */
export function resolvePoolImportPreselection(
  importedCompanyId: string,
  companies: { id: string }[],
): PoolImportPreselection {
  const canMatchById = !!importedCompanyId && isSafeFileCompanyId(importedCompanyId) && !isReservedCompanyId(importedCompanyId);
  const match = canMatchById ? companies.find((c) => c.id === importedCompanyId) : undefined;
  return match ? { action: 'replace', companyId: match.id } : { action: 'add' };
}

/**
 * Welke "toevoegen als nieuwe resourcebibliotheek"-hint hoort te verschijnen: `importPoolAsNewCompany`
 * mint in TWEE situaties een VERS id, en die twee verdienen elk hun eigen, feitelijk kloppende tekst
 * ("deze bibliotheek is al lokaal bekend" is in het tweede geval niet gegarandeerd):
 * - `'collision'`: het bestand-id is een gewoon (niet-reserved, veilig) id dat lokaal AL bestaat —
 *   de bibliotheek is dan aantoonbaar al lokaal bekend, en wordt terecht "een aparte kopie ernaast".
 * - `'fresh-identity'`: het bestand-id is reserved (`isReservedCompanyId` —
 *   `DEFAULT_COMPANY_ID`/`DEMO_COMPANY_ID`) of onveilig (`isSafeFileCompanyId`) — er is dan GEEN
 *   garantie dat de bibliotheek al lokaal bekend is (bijv. de demo-bibliotheek kan hier nog nooit
 *   geseed zijn, of het bestand droeg een vijandig id als `"__proto__"`); een neutrale tekst die
 *   niets beweert over lokale bekendheid.
 * - `'none'`: geen van beide (een vers, niet-reserved, veilig en nog onbekend id) — geen hint nodig.
 * Reserved/onveilig wint altijd van een toevallige lokale botsing (zie de reserved-check EERST) —
 * spiegelt exact de voorrangsorde in `importPoolAsNewCompany`/`resolvePoolImportPreselection`. Puur
 * — gedeeld door `PoolImportDialog` en de headless tests.
 */
export type PoolImportIdentityHint = 'collision' | 'fresh-identity' | 'none';
export function classifyPoolImportIdentityHint(importedCompanyId: string, companies: { id: string }[]): PoolImportIdentityHint {
  if (isReservedCompanyId(importedCompanyId) || !isSafeFileCompanyId(importedCompanyId)) return 'fresh-identity';
  if (companies.some((c) => c.id === importedCompanyId)) return 'collision';
  return 'none';
}

/** Nieuwe pool-versie na een wijziging: poolVersion+1 + verse modifiedAt. Puur (nieuw object). */
export function bumpPool(pool: CompanyPool): CompanyPool {
  return { ...pool, poolVersion: pool.poolVersion + 1, modifiedAt: new Date().toISOString() };
}

/**
 * Normaliseer één pool defensief tegen vorm-invalide data:
 * een handmatig bewerkt of door een derde tool geproduceerd `OPS_Library`-bestand zonder
 * `resources`/`calendars` (of met die velden als object i.p.v. array) mag nooit een TypeError geven
 * op een latere `.push`/`.find`. `calendars`/`resources` gegarandeerd array, `poolVersion` numeriek
 * (anders 1), `modifiedAt` string (anders nu), `companyName` een string (anders het bedrijf uit
 * `companies`, of anders `cid`). Puur — geschikt voor losse unit-tests, en gedeeld door zowel het
 * laden van de opgeslagen bibliotheek (`normalizeLoadedLibrary`) als het importeren van één pool
 * (`replacePool`) als het LEZEN van een pool-IFC (`readPoolIFC`, zodat de import-preview niet crasht
 * op een `{}` of een object zonder `calendars`).
 */
export function normalizePoolShape(cid: string, raw: Partial<CompanyPool> | null | undefined, companies: Company[]): CompanyPool {
  const p = raw ?? {};
  return {
    companyId: cid,
    companyName: typeof p.companyName === 'string'
      ? p.companyName
      : (companies.find((c) => c.id === cid)?.name ?? cid),
    // Een geheel getal ≥1, anders 1 — vangt zowel niet-numerieke waarden (string/ontbrekend) als een
    // numerieke maar ongeldige waarde (NaN, float, 0, negatief) op; bumpPool/isPoolNewer verwachten
    // een oplopend geheel getal ≥1.
    poolVersion: (typeof p.poolVersion === 'number' && Number.isInteger(p.poolVersion))
      ? Math.max(1, p.poolVersion)
      : 1,
    modifiedAt: typeof p.modifiedAt === 'string' ? p.modifiedAt : new Date().toISOString(),
    // Optioneel (alleen gegenereerde pools, zie `demoLibrary.ts`): bewaren als het een geldig
    // geheel getal ≥0 is, anders weglaten. Moet de normalisatie overleven — anders leest een
    // installatie zijn eigen "al bijgewerkt"-markering nooit terug en draait de seed-migratie
    // bij élke start opnieuw.
    ...(typeof p.seedVersion === 'number' && Number.isInteger(p.seedVersion) && p.seedVersion >= 0
      ? { seedVersion: p.seedVersion }
      : {}),
    // `Array.isArray` i.p.v. `??`: een object i.p.v. array (bijv. `calendars: {...}` in een
    // hand-gemaakt OPS_Library-bestand) is niet-nullish, en een latere `.push`/`.filter`/`.find` op
    // zo'n object crasht.
    calendars: Array.isArray(p.calendars) ? p.calendars : [],
    resources: Array.isArray(p.resources) ? p.resources : [],
  };
}

/** Parseer een ISO-tijdstempel naar epoch-ms voor vergelijking. Onparseerbaar/ontbrekend ⇒ 0
 *  (nooit NaN — NaN-vergelijkingen zijn altijd `false`, wat een stille misdetectie zou zijn). */
function parseTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Demping-check: is de LOKALE pool nieuwer dan de te importeren
 * pool? Nieuwer ⇔ een hogere `poolVersion` ÓF een recentere `modifiedAt` — de twee signalen tellen
 * onafhankelijk mee (geen precedentie-ladder waarbij versie de tijd overstemt bij een verschil).
 * Tijd wordt vergeleken op echte epoch-tijd (`Date.parse`, fallback 0 bij onparseerbaar), niet als
 * string-lexicografie — dat sorteert offset-notaties (`-05:00` versus `Z`) soms verkeerd.
 * `undefined` lokaal (nog geen pool) ⇒ nooit nieuwer.
 */
export function isPoolNewer(local: CompanyPool | undefined, imported: CompanyPool): boolean {
  if (!local) return false;
  return local.poolVersion > imported.poolVersion || parseTime(local.modifiedAt) > parseTime(imported.modifiedAt);
}

/** Bouw een herkomststempel voor een projectkopie van een poolitem. `syncedHash` wordt
 *  meegeschreven bij materialisatie/verversing van een PROJECTkopie; pool-items zelf dragen geen
 *  stempel, dus daar blijft hij afwezig. */
export function makeOrigin(pool: CompanyPool, libraryItemId: string, syncedHash?: string): LibraryOrigin {
  return {
    companyId: pool.companyId,
    libraryItemId,
    poolVersion: pool.poolVersion,
    ...(syncedHash !== undefined ? { syncedHash } : {}),
  };
}

/**
 * Strip de herkomststempels (`libraryOrigin`) van de resources en kalenders van een document — alle
 * stempels, of met `companyId` alleen die van dat bedrijf (ontkoppelen/omkoppelen/verwijderen van een
 * bibliotheek). Nieuwe arrays; een gestript item wordt een nieuw object zonder de sleutel (golden rule
 * IFC: afwezig ⇒ niets geschreven). Zonder `companyId` wordt élk item vervangen, ook zonder stempel.
 * De projectkalender-cache resync't de aanroeper zelf (`refreshProjectCalendarCache`).
 */
export function stripLibraryOrigins(
  target: { resources: Resource[]; calendars: WorkCalendar[] },
  companyId?: string,
): void {
  const strip = <T extends { libraryOrigin?: LibraryOrigin }>(item: T): T => {
    if (companyId !== undefined && item.libraryOrigin?.companyId !== companyId) return item;
    const { libraryOrigin: _drop, ...rest } = item;
    return rest as T;
  };
  target.resources = target.resources.map(strip);
  target.calendars = target.calendars.map(strip);
}

/** Zoek een bestaande projectkopie met dezelfde herkomst (dedup). */
export function findCopyByOrigin<T extends { libraryOrigin?: LibraryOrigin }>(
  items: T[], companyId: string, libraryItemId: string,
): T | undefined {
  // Guard tegen falsy sleutels. Zonder deze guard matcht een lege/ontbrekende `companyId`
  // of `libraryItemId` (uit een corrupt poolbestand) tegen een item zonder libraryOrigin via
  // `undefined === undefined` — een vals dedup-match dat een ander item stil zou "hergebruiken".
  if (!companyId || !libraryItemId) return undefined;
  return items.find(
    (i) => i.libraryOrigin?.companyId === companyId && i.libraryOrigin?.libraryItemId === libraryItemId,
  );
}

export interface CalendarCopyResult {
  /** De (nieuwe of hergebruikte) projectkalender. */
  calendar: WorkCalendar;
  /** True ⇒ een bestaande kopie met dezelfde herkomst is hergebruikt (geen nieuwe toegevoegd). */
  reused: boolean;
}

/**
 * Kopieer een pool-kalender naar het project met stempel. Bestaat er al een kopie met
 * dezelfde herkomst, dan wordt die hergebruikt (`reused: true`), nooit gedupliceerd. `genId` mint
 * een verse project-lokale id (injecteerbaar voor deterministische tests). `null` ⇒ de pool bevat
 * die kalender niet.
 */
export function copyCalendarToProject(
  pool: CompanyPool,
  poolCalendarId: string,
  existingCalendars: WorkCalendar[],
  genId: (prefix: string) => string,
): CalendarCopyResult | null {
  const source = pool.calendars.find((c) => c.id === poolCalendarId);
  if (!source) return null;
  const existing = findCopyByOrigin(existingCalendars, pool.companyId, poolCalendarId);
  if (existing) return { calendar: existing, reused: true };
  const calendar: WorkCalendar = {
    ...structuredClone(source),
    id: genId('cal'),
    libraryOrigin: makeOrigin(pool, poolCalendarId, computeCalendarHash(source)),
  };
  return { calendar, reused: false };
}

export interface ResourceCopyResult {
  resource: Resource;
  reused: boolean;
  /** Meereizende kalender: de eigen `calendarId` van de resource bracht deze kalender mee.
   *  Afwezig ⇒ de resource had geen eigen kalender, of hij verwees niet naar een pool-kalender. */
  travelingCalendar?: CalendarCopyResult;
}

/**
 * Kopieer een pool-resource naar het project met stempel. Afhankelijkheden reizen mee:
 * heeft de resource een eigen `calendarId` die in de pool bestaat, dan wordt die kalender
 * mee-gekopieerd (met dedup) en `resource.calendarId` naar de project-lokale kopie herschreven.
 * Dedup op de resource zelf: bestaat er al een projectkopie met dezelfde herkomst ⇒ hergebruik.
 */
export function copyResourceToProject(
  pool: CompanyPool,
  poolResourceId: string,
  existingResources: Resource[],
  existingCalendars: WorkCalendar[],
  genId: (prefix: string) => string,
): ResourceCopyResult | null {
  const source = pool.resources.find((r) => r.id === poolResourceId);
  if (!source) return null;
  const existing = findCopyByOrigin(existingResources, pool.companyId, poolResourceId);
  if (existing) return { resource: existing, reused: true };

  let travelingCalendar: CalendarCopyResult | undefined;
  let calendarId = source.calendarId;
  if (source.calendarId && pool.calendars.some((c) => c.id === source.calendarId)) {
    travelingCalendar = copyCalendarToProject(pool, source.calendarId, existingCalendars, genId) ?? undefined;
    calendarId = travelingCalendar?.calendar.id;
  } else {
    // De resource verwees niet naar een pool-kalender (bv. projectkalender): geen meereizende kopie.
    calendarId = undefined;
  }

  const resource: Resource = {
    ...structuredClone(source),
    id: genId('res'),
    calendarId,
    libraryOrigin: makeOrigin(pool, poolResourceId, computeResourceHash(source)),
    // parentId (ploeg-lidmaatschap) is een pool-lokale verwijzing; bij een losse kopie laten we hem
    // vallen (het project heeft de ploeg niet noodzakelijk). Zo ontstaat nooit een dode verwijzing.
    parentId: undefined,
  };
  return { resource, reused: false, travelingCalendar };
}

/** Uitkomst van een diff tussen een projectkopie en zijn pool-origineel. */
export type ItemDiff =
  | { status: 'removed' } // origineel bestaat niet meer in de bibliotheek
  | { status: 'up-to-date' }
  | { status: 'changed'; fields: DiffField[] };

export interface DiffField {
  field: string;
  project: unknown;
  library: unknown;
}

/**
 * De kalendervelden die de bibliotheek vóór de pauze-/uitzonderingsvelden volgde, in DEZE volgorde.
 * Elke `syncedHash` die vóór die uitbreiding is gezet (ook in opgeslagen IFC's: de stempel round-tript)
 * is over precies deze lijst berekend — de "v1-vorm". Nooit wijzigen of herordenen.
 */
const CALENDAR_HASH_V1_FIELDS: readonly (keyof WorkCalendar)[] = [
  'name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
  'holidays', 'generation', 'workTime', 'shift',
];

/**
 * Later bijgekomen inhoudsvelden: het pauzepatroon en de werkende uitzonderingen. Ze vallen buiten
 * de v1-hash (zie `computeCalendarHash`), maar tellen wél mee bij verversen, afwijking bepalen en
 * "bestandswaarde naar de bibliotheek". Alle drie optioneel; afwezig is de gewone stand.
 */
const CALENDAR_FIELDS_AFTER_V1: readonly (keyof WorkCalendar)[] = [
  'simpleBreakStartMinute', 'simpleBreakDurationMinutes', 'workingExceptions',
];

/** Velden die we vergelijken bij een kalender-diff (herkomst/id tellen niet mee): ALLE inhoudsvelden
 *  van `WorkCalendar`. Dat dit uitputtend is, bewaakt `tests/library/check-library-ops.ts` met een
 *  `Record<keyof WorkCalendar, …>` (een nieuw kalenderveld is daar een compileerfout). */
export const CALENDAR_DIFF_FIELDS: (keyof WorkCalendar)[] = [...CALENDAR_HASH_V1_FIELDS, ...CALENDAR_FIELDS_AFTER_V1];

// Uitsluitend de IDENTITEITSVELDEN: wat de resource IS (naam/type/omschrijving) en de
// bibliotheekafspraken erover (tarief/uur, eenheid). `maxUnits`/`availabilitySteps` zijn
// PROJECTINZET (hoeveel dit project van de resource opeist, en op welk ritme) en horen er niet in:
// anders levert max.eenheden wijzigen in de Projectweergave meteen 'deviated' op.
// `calendarId` is een project-lokale verwijzing (zie applyResourceUpdate) en hoort er ook niet in.
export const RESOURCE_DIFF_FIELDS: (keyof Resource)[] = [
  'name', 'type', 'description', 'costPerHour', 'unitOfMeasure',
];

/** Stabiele vergelijkingssleutel voor een veldwaarde. Voor deze diff-velden is de
 *  array-VOLGORDE bewust NIET betekenisvol (bv. dezelfde feestdagen in een andere volgorde is
 *  géén wijziging) — vergelijk array-velden daarom als multiset door een KOPIE van de elementen
 *  te sorteren op `JSON.stringify(element)`. Muteert de invoer niet; niet-arrays gaan ongewijzigd
 *  door `JSON.stringify` heen. */
export function diffKey(value: unknown): string {
  if (Array.isArray(value)) {
    const sorted = value
      .map((el) => JSON.stringify(el))
      .sort();
    return JSON.stringify(sorted);
  }
  return JSON.stringify(value);
}

function diffFields<T>(project: T, library: T, fields: (keyof T)[]): DiffField[] {
  const out: DiffField[] = [];
  for (const f of fields) {
    const a = project[f];
    const b = library[f];
    if (diffKey(a) !== diffKey(b)) {
      out.push({ field: String(f), project: a, library: b });
    }
  }
  return out;
}

/** Hash van de gevolgde velden van een item, met EXACT dezelfde normalisatie als de diff
 *  (`diffKey` per veld → arrays als gesorteerde multiset). Twee items met dezelfde gevolgde
 *  velden — ongeacht array-volgorde — geven dezelfde hash; een verschil op één gevolgd veld
 *  verandert de hash. Deterministisch (JSON van de per-veld-diffKeys), geen externe crypto. */
function hashFields<T>(item: T, fields: readonly (keyof T)[]): string {
  return JSON.stringify(fields.map((f) => diffKey(item[f])));
}

/**
 * syncedHash van een pool-/projectkalender.
 *
 * Twee vormen, zodat bestaande stempels geldig blijven (de stempel round-tript via IFC):
 *  - zolang de later bijgekomen velden (`CALENDAR_FIELDS_AFTER_V1`) afwezig zijn — verreweg de
 *    meeste kalenders — de v1-vorm;
 *  - anders over alle inhoudsvelden (een langere lijst, dus nooit gelijk aan een v1-hash).
 * Eén langere lijst voor iedereen zou de hash van ELKE bestaande kopie veranderen: bij de
 * eerstvolgende poolwijziging werd een ongewijzigde kopie dan 'deviated' in plaats van 'behind' en
 * stopte het stille verversen overal. Voor een kopie mét pauzevelden en een v1-stempel: zie
 * `calendarMatchesStamp`.
 */
export function computeCalendarHash(cal: WorkCalendar): string {
  const later = CALENDAR_FIELDS_AFTER_V1.some((f) => cal[f] !== undefined);
  return hashFields(cal, later ? CALENDAR_DIFF_FIELDS : CALENDAR_HASH_V1_FIELDS);
}

/**
 * Is `projectCal` sinds zijn stempel niet lokaal bewerkt (file == syncedHash)? Naast de
 * gewone vergelijking herkent dit een v1-stempel op een kopie die wél pauzevelden of werkende
 * uitzonderingen draagt: zo'n stempel dekt die velden niet, dus alleen de v1-velden zijn te toetsen.
 * De niet-gedekte velden tellen dan als onbewerkt zolang ze gelijk zijn aan de bibliotheek; wijken ze
 * af, dan is niet te zeggen of de bibliotheek of het bestand ze veranderde en blijft het de veilige
 * kant ('deviated', dezelfde keuze als voor een stempel zonder hash).
 */
function calendarMatchesStamp(projectCal: WorkCalendar, source: WorkCalendar | undefined, syncedHash: string): boolean {
  if (computeCalendarHash(projectCal) === syncedHash) return true;
  return source !== undefined
    && hashFields(projectCal, CALENDAR_HASH_V1_FIELDS) === syncedHash
    && CALENDAR_FIELDS_AFTER_V1.every((f) => diffKey(projectCal[f]) === diffKey(source[f]));
}

/** syncedHash van een pool-/projectresource. */
export function computeResourceHash(res: Resource): string {
  return hashFields(res, RESOURCE_DIFF_FIELDS);
}

/** Onzichtbare formatting-tekens die de matcher vóór de
 *  witruimte-collapse strip: zero-width space/non-joiner/joiner (U+200B–U+200D), BOM (U+FEFF) en
 *  soft-hyphen (U+00AD). Deze tekens zijn onzichtbaar in de UI maar tellen anders mee in de
 *  string-vergelijking — een naam die via copy-paste zo'n teken meekreeg (bv. "Kraan​1") matchte
 *  daardoor niet met de zichtbaar identieke "Kraan1". */
const INVISIBLE_FORMATTING_CHARS = /[\u200B-\u200D\uFEFF\u00AD]/g;

/** Normaliseer een naam voor de herkennings-matcher: Unicode-NFC, onzichtbare
 *  formatting-tekens strippen, trim, samengevouwen witruimte (elke witruimte-run → één spatie),
 *  hoofdletterongevoelig. `toLowerCase()` i.p.v. `toLocaleLowerCase()`
 *  — deterministisch onafhankelijk van de machine-locale (de Turkse dotless-İ-nuance van
 *  `toLocaleLowerCase` wordt bewust NIET toegepast, zie docs/library.md). `normalizeName` wordt NIET
 *  voor hashing gebruikt (dat loopt via `hashFields`/`diffKey` op de ruwe velden), alleen voor
 *  matching. Puur. */
export function normalizeName(name: string): string {
  return name.normalize('NFC').replace(INVISIBLE_FORMATTING_CHARS, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Zoek de UNIEKE kandidaat met dezelfde genormaliseerde naam. Geen kandidaat óf
 *  meerdere kandidaten ⇒ `null` (geen voorstel — handmatige keuze). Bewust geen fuzzy match. Een
 *  LEGE genormaliseerde target (lege/pure-witruimte naam) matcht
 *  nooit — anders zouden twee items die allebei een lege naam normaliseren elkaar ten onrechte als
 *  unieke kandidaat aanwijzen. */
export function matchByName<T extends { name: string }>(name: string, candidates: T[]): T | null {
  const target = normalizeName(name);
  if (!target) return null;
  const hits = candidates.filter((c) => normalizeName(c.name) === target);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Los een naamsbotsing op voor een NIEUW bedrijf ("Toevoegen als nieuwe resourcebibliotheek" in
 * `PoolImportDialog`): bestaat `rawName` al onder de gegeven bestaande namen
 * (vergeleken via `normalizeName`, spiegelt `matchByName` — case/witruimte/onzichtbare-tekens-
 * ongevoelig), dan krijgt de nieuwe naam een oplopend onderscheidend achtervoegsel " (2)", " (3)", …
 * — net zo lang tot de naam vrij is. Een lege/pure-witruimte/uitsluitend-onzichtbare-tekens-naam valt
 * terug op een standaardlabel (spiegelt `addCompany`) — de leeg-CHECK gebruikt bewust `normalizeName`
 * (`rawName.trim()` stript alleen ASCII-witruimte, geen U+200B/U+FEFF e.d.; zo'n naam gaf anders een
 * ogenschijnlijk lege rij in Backstage). Puur — geschikt voor losse unit-tests, en gedeeld door
 * zowel de store-actie (`importPoolAsNewCompany`) als de dialoog-preview (geen dubbele/afwijkende logica).
 */
export function resolveUniqueCompanyName(rawName: string, existingNames: string[]): string {
  const base = normalizeName(rawName) ? rawName.trim() : 'Nieuwe resourcebibliotheek';
  const existing = new Set(existingNames.map(normalizeName));
  if (!existing.has(normalizeName(base))) return base;
  let n = 2;
  while (existing.has(normalizeName(`${base} (${n})`))) n++;
  return `${base} (${n})`;
}

export function diffCalendarVsPool(projectCal: WorkCalendar, pool: CompanyPool): ItemDiff {
  const id = projectCal.libraryOrigin?.libraryItemId;
  const source = id ? pool.calendars.find((c) => c.id === id) : undefined;
  if (!source) return { status: 'removed' };
  const fields = diffFields(projectCal, source, CALENDAR_DIFF_FIELDS);
  return fields.length === 0 ? { status: 'up-to-date' } : { status: 'changed', fields };
}

export function diffResourceVsPool(projectRes: Resource, pool: CompanyPool): ItemDiff {
  const id = projectRes.libraryOrigin?.libraryItemId;
  const source = id ? pool.resources.find((r) => r.id === id) : undefined;
  if (!source) return { status: 'removed' };
  const fields = diffFields(projectRes, source, RESOURCE_DIFF_FIELDS);
  return fields.length === 0 ? { status: 'up-to-date' } : { status: 'changed', fields };
}

/** Uitkomst van de openings-classificatie. */
export type OnOpenStatus =
  | 'in-sync'   // project == pool
  | 'behind'    // pool bewoog, bestand is NIET lokaal bewerkt (file == syncedHash) ⇒ stil verversen
  | 'deviated'  // bestand is ná de sync bewerkt (file != syncedHash) ⇒ vraag
  | 'removed'   // pool-origineel bestaat niet meer
  | 'unbound';  // geen libraryOrigin — puur project-eigen item, hoort niet bij een bedrijfspool

function classifyOnOpen(
  diffStatus: ItemDiff['status'],
  syncedHash: string | undefined,
  fileMatchesStamp: (syncedHash: string) => boolean,
): OnOpenStatus {
  if (diffStatus === 'removed') return 'removed';
  if (diffStatus === 'up-to-date') return 'in-sync';
  // diffStatus === 'changed'. Ontbrekende syncedHash (stempel zonder hash) ⇒ veilige kant: behandel
  // als extern bewerkt. Anders: file == syncedHash ⇒ niet-bewerkt ⇒ behind; ongelijk ⇒ deviated.
  if (syncedHash === undefined) return 'deviated';
  return fileMatchesStamp(syncedHash) ? 'behind' : 'deviated';
}

/** companyId-scope (stempel van een ánder bedrijf dan het geopende) is de verantwoordelijkheid van
 *  de aanroeper — deze functie vergelijkt alleen tegen de meegegeven `pool`. `'unbound'` dekt alleen
 *  stempel-loos (geen `libraryOrigin`); het is geen synoniem voor 'removed' en mag daar niet mee
 *  samenvallen (een puur project-eigen item is niet "uit het bedrijf verwijderd"). */
export function classifyCalendarOnOpen(projectCal: WorkCalendar, pool: CompanyPool): OnOpenStatus {
  if (!projectCal.libraryOrigin) return 'unbound';
  const source = pool.calendars.find((c) => c.id === projectCal.libraryOrigin!.libraryItemId);
  return classifyOnOpen(diffCalendarVsPool(projectCal, pool).status, projectCal.libraryOrigin.syncedHash,
    (synced) => calendarMatchesStamp(projectCal, source, synced));
}

/** companyId-scope (stempel van een ánder bedrijf dan het geopende) is de verantwoordelijkheid van
 *  de aanroeper — deze functie vergelijkt alleen tegen de meegegeven `pool`. `'unbound'` dekt alleen
 *  stempel-loos (geen `libraryOrigin`); het is geen synoniem voor 'removed' en mag daar niet mee
 *  samenvallen (een puur project-eigen item is niet "uit het bedrijf verwijderd"). */
export function classifyResourceOnOpen(projectRes: Resource, pool: CompanyPool): OnOpenStatus {
  if (!projectRes.libraryOrigin) return 'unbound';
  return classifyOnOpen(diffResourceVsPool(projectRes, pool).status, projectRes.libraryOrigin.syncedHash,
    (synced) => computeResourceHash(projectRes) === synced);
}

/**
 * Bepaalt of de BIBLIOTHEEKAFSPRAAK-velden van een projectresource (naam/type/tarief/eenheid) in de
 * Resources-tab read-only moeten zijn. Puur, en gedeeld door `ResourcePanel`
 * (UI-gating) én de headless tests (`tests/library/check-library-slice.ts`) — zo kan de gatingregel
 * zelf getest worden zonder React te renderen.
 *
 * `null` (geen eigen-bedrijf-stempel, of bedrijf onbekend — zie `onOpenStatusForResource`) en
 * `'unbound'` (stempel-loos) tellen NIET als geldige herkomst: puur project-eigen item, blijft
 * volledig bewerkbaar. `'removed'` telt BEWUST OOK niet als geldig — de stempel wijst dan nergens
 * meer naar (het poolorigineel is weg), dus die rij is feitelijk een wees: op slot zetten zou een
 * dode referentie muurvast maken in plaats van de gebruiker de bestaande "Verwijder uit
 * project"-actie te geven. Alleen 'in-sync'/'behind'/'deviated' (het poolorigineel bestaat nog)
 * leveren de lock op; max.eenheden en kalender blijven in ALLE gevallen bewerkbaar (projectinzet).
 */
export function isResourceFieldLocked(status: OnOpenStatus | null): boolean {
  return status !== null && status !== 'removed' && status !== 'unbound';
}

/**
 * Pas alleen de GEVOLGDE diff-velden van `source` toe op een kopie van `target`; elk ander veld van
 * `target` blijft ONGEWIJZIGD. Een volledige kloon van het poolitem zou de bewuste versmalling van
 * `RESOURCE_DIFF_FIELDS` negeren en PROJECTINZET (`maxUnits`/`availabilitySteps`) stilzwijgend
 * overschrijven of wissen. `id`/`libraryOrigin` van
 * `target` blijven expliciet buiten `fields` en worden dus altijd behouden door deze functie zelf —
 * de aanroeper zet `libraryOrigin` daarna zelf vers. Puur (nieuw object, muteert geen van beide
 * invoerobjecten).
 */
function applyDiffFields<T>(target: T, source: T, fields: readonly (keyof T)[]): T {
  const patched: T = structuredClone(target);
  for (const f of fields) {
    patched[f] = structuredClone(source[f]);
  }
  return patched;
}

/** Pas de pool-waarden toe op een projectkalender bij "bijwerken": overschrijf de
 *  vergeleken velden, behoud id + herkomst (met verse poolVersion). Puur (nieuw object).
 *  `CALENDAR_DIFF_FIELDS` dekt hier BEWUST alle inhoudelijke `WorkCalendar`-velden (er is geen
 *  "projectinzet"-veld zoals bij Resource) — `applyDiffFields` is daarmee door-constructie veilig
 *  tegen een toekomstig kalenderveld dat WEL projectinzet zou zijn. De uitputtendheid staat onder
 *  test (zie `CALENDAR_DIFF_FIELDS`). */
export function applyCalendarUpdate(projectCal: WorkCalendar, pool: CompanyPool): WorkCalendar {
  const id = projectCal.libraryOrigin?.libraryItemId;
  const source = id ? pool.calendars.find((c) => c.id === id) : undefined;
  // Vangnet tegen stille corruptie. Ontbreekt het pool-origineel (of de herkomststempel),
  // dan zou `structuredClone(undefined)` een leeg object opleveren (`{...undefined}`) en de kalender
  // op alleen id+herkomst terugbrengen — alle inhoud weg. Gooi in plaats daarvan expliciet. De enige
  // caller guardt al op status==='changed' (bron bestaat), dus dit pad hoort onbereikbaar te zijn.
  if (!source) {
    throw new Error(`applyCalendarUpdate: pool-origineel niet gevonden voor kalender "${projectCal.name}" (id=${projectCal.id}, libraryItemId=${id ?? 'ontbreekt'})`);
  }
  const patched = applyDiffFields(projectCal, source, CALENDAR_DIFF_FIELDS);
  patched.libraryOrigin = makeOrigin(pool, id!, computeCalendarHash(source));
  return patched;
}

/** Pas de pool-waarden toe op een projectresource bij "bijwerken": overschrijf UITSLUITEND
 *  de `RESOURCE_DIFF_FIELDS` (identiteit/bibliotheekafspraak — naam/type/omschrijving/tarief/eenheid),
 *  behoud id + herkomst (met verse poolVersion). `maxUnits`, `availabilitySteps`, de gedeprecieerde
 *  `availability`, `calendarId` en `parentId` zijn PROJECTINZET en blijven daarom altijd van `target`
 *  (projectRes); anders overschrijft "bijwerken" stilzwijgend de eigen inzet van het project. Puur
 *  (nieuw object). */
export function applyResourceUpdate(projectRes: Resource, pool: CompanyPool): Resource {
  const id = projectRes.libraryOrigin?.libraryItemId;
  const source = id ? pool.resources.find((r) => r.id === id) : undefined;
  // Zelfde vangnet als applyCalendarUpdate — geen stille reductie tot id+herkomst.
  if (!source) {
    throw new Error(`applyResourceUpdate: pool-origineel niet gevonden voor resource "${projectRes.name}" (id=${projectRes.id}, libraryItemId=${id ?? 'ontbreekt'})`);
  }
  const patched = applyDiffFields(projectRes, source, RESOURCE_DIFF_FIELDS);
  patched.libraryOrigin = makeOrigin(pool, id!, computeResourceHash(source));
  return patched;
}
