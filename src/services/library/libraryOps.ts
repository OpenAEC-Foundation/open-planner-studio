import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';
import type { Company, CompanyPool, LibraryOrigin } from '@/types/library';
import { DEFAULT_COMPANY_ID } from '@/types/library';
import { DEMO_COMPANY_ID } from './demoLibrary';

/**
 * Reserved companyId's die op ELKE installatie hetzelfde zijn (issue #19, critreview F1):
 * `DEFAULT_COMPANY_ID` (de automatische standaardbibliotheek van een verse installatie) en
 * `DEMO_COMPANY_ID` (de idempotente demo-seed, `seedDemoLibrary`). Vrijwel elke gebruiker heeft
 * hooguit ÉÉN bibliotheek — dus vrijwel elk geëxporteerd bestand draagt zo'n reserved id. Zo'n id
 * is daarom GEEN identiteitsbewijs: het companyId uit een bestand alleen behandelen als "dezelfde
 * bibliotheek, andere versie" zodra het lokaal bestaat, zou voor deze twee ids de EIGEN bibliotheek
 * van de ontvanger als vervang-doel voorstellen — precies het scenario dat `importPoolAsNewCompany`
 * had moeten voorkomen. Eén gedeelde bron, gebruikt door zowel de dialoog-voorselectie
 * (`PoolImportDialog`) als de import-actie zelf (`importPoolAsNewCompany`).
 */
export const RESERVED_COMPANY_IDS: ReadonlySet<string> = new Set([DEFAULT_COMPANY_ID, DEMO_COMPANY_ID]);

export function isReservedCompanyId(id: string): boolean {
  return RESERVED_COMPANY_IDS.has(id);
}

/**
 * Is een companyId uit een GEÏMPORTEERD bestand veilig genoeg om als state-sleutel te behouden
 * (issue #19, critreview F2)? `readPoolIFC` laat elke niet-lege string door zonder validatie — een
 * vijandig bestand met bijv. `"__proto__"` of `"constructor"` als companyId zou anders `s.pools[id]
 * = …` bereiken, waar Immer een draft-prototype-mutatie probeert en ONGEVANGEN gooit (geen van de
 * aanroepers had een try/catch, en er is nergens een ErrorBoundary — de bevestigknop zou zichtbaar
 * niets meer doen). Whitelist-regex (een blacklist mist altijd een variant — bewust GEEN
 * opsomming van "gevaarlijke tekens") + een expliciete uitsluiting van de bekende
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
 * Bepaal de voorselectie voor de pool-importdialoog (issue #19, critreview F1 — de kern van de
 * blokkerende bevinding): welke actie ("toevoegen als nieuwe resourcebibliotheek" vs "een bestaande
 * resourcebibliotheek vervangen") staat aan zodra een bestand gekozen is, en bij "vervangen" welke
 * bibliotheek al geselecteerd is. Puur — dus rechtstreeks testbaar zonder een gemount dialoog
 * (spiegelt de reviewer zijn eigen `writePoolIFC`→`readPoolIFC`→`pick()`-reproductie).
 *
 * Een bestand-companyId matcht een lokale bibliotheek ALLEEN als het (a) een veilige state-sleutel
 * is (`isSafeFileCompanyId` — critreview F2, een vijandig id als `"__proto__"` mag nooit als
 * "match" tellen) en (b) GEEN reserved id is (`isReservedCompanyId` — critreview F1:
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
 * Welke "toevoegen als nieuwe resourcebibliotheek"-hint hoort te verschijnen (issue #19,
 * critreview-herkeuring): `importPoolAsNewCompany` mint in TWEE situaties een VERS id, en die twee
 * verdienen elk hun EIGEN, feitelijk kloppende tekst — de dialoog gebruikte eerder één overkoepelende
 * hint ("deze bibliotheek is al lokaal bekend") die bij het tweede geval gewoon ONWAAR kon zijn:
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
 * Normaliseer één pool defensief tegen vorm-invalide data (spec §4/§9, F2 vloot-fixpakket issue #19):
 * een handmatig bewerkt of door een derde tool geproduceerd `OPS_Library`-bestand zonder
 * `resources`/`calendars` (of met die velden als object i.p.v. array) mag nooit een TypeError geven
 * op een latere `.push`/`.find`. `calendars`/`resources` gegarandeerd array, `poolVersion` numeriek
 * (anders 1), `modifiedAt` string (anders nu), `companyName` een string (anders het bedrijf uit
 * `companies`, of anders `cid`). Puur — geschikt voor losse unit-tests, en gedeeld door zowel het
 * laden van de opgeslagen bibliotheek (`normalizeLoadedLibrary`) als het importeren van één pool
 * (`replacePool`) als het LEZEN van een pool-IFC (`readPoolIFC` — de importcrash-fix: vóór deze fix
 * kreeg de pool-import-preview elke truthy JSON blind doorgeschoven, ook `{}` of een object zonder
 * `calendars`, en crashte op `imported.calendars.length` vóór de gebruiker ook maar kon bevestigen).
 */
export function normalizePoolShape(cid: string, raw: Partial<CompanyPool> | null | undefined, companies: Company[]): CompanyPool {
  const p = raw ?? {};
  return {
    companyId: cid,
    companyName: typeof p.companyName === 'string'
      ? p.companyName
      : (companies.find((c) => c.id === cid)?.name ?? cid),
    // Fix B5: een geheel getal ≥1, anders 1 — vangt zowel niet-numerieke waarden (string/ontbrekend)
    // als een numerieke maar ongeldige waarde (float, 0, negatief) op. Vóór de fix accepteerde
    // `typeof p.poolVersion === 'number'` ELKE numerieke waarde inclusief NaN-achtige randgevallen,
    // floats en negatieve versies (bumpPool/isPoolNewer verwachten een oplopend geheel getal ≥1).
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
    // Fix B5: `Array.isArray` i.p.v. `??` — een object i.p.v. array (bijv. een hand-gemaakt of
    // door een derde tool geproduceerd OPS_Library-bestand met `calendars: {...}`) is niet-nullish,
    // dus `?? []` liet het ongewijzigd door; een latere `.push`/`.filter`/`.find` op zo'n object
    // crasht dan alsnog (bewezen fuzz-pool b6, jachtlijn 1 "calendars/resources zijn geen array").
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
 * Demping-check (spec §4, bindend user-besluit): is de LOKALE pool nieuwer dan de te importeren
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

/** Bouw een herkomststempel voor een projectkopie van een poolitem. `syncedHash` (spec §2) wordt
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

/** Zoek een bestaande projectkopie met dezelfde herkomst (dedup, spec §3). */
export function findCopyByOrigin<T extends { libraryOrigin?: LibraryOrigin }>(
  items: T[], companyId: string, libraryItemId: string,
): T | undefined {
  // A5-fix: guard tegen falsy sleutels. Zonder deze guard matcht een lege/ontbrekende `companyId`
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
 * Kopieer een pool-kalender naar het project met stempel (spec §3). Bestaat er al een kopie met
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
  /** Meereizende kalender (spec §3): de eigen `calendarId` van de resource bracht deze kalender mee.
   *  Afwezig ⇒ de resource had geen eigen kalender, of hij verwees niet naar een pool-kalender. */
  travelingCalendar?: CalendarCopyResult;
}

/**
 * Kopieer een pool-resource naar het project met stempel (spec §3). Afhankelijkheden reizen mee:
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

/** Uitkomst van een diff tussen een projectkopie en zijn pool-origineel (spec §3). */
export type ItemDiff =
  | { status: 'removed' } // origineel bestaat niet meer in de bibliotheek
  | { status: 'up-to-date' }
  | { status: 'changed'; fields: DiffField[] };

export interface DiffField {
  field: string;
  project: unknown;
  library: unknown;
}

/** Velden die we vergelijken bij een kalender-diff (herkomst/id/naam-identiteit tellen niet mee). */
export const CALENDAR_DIFF_FIELDS: (keyof WorkCalendar)[] = [
  'name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
  'holidays', 'generation', 'workTime', 'shift',
];

// F1 (critreview op 352bb94, issue #19): `maxUnits`/`availabilitySteps` zijn PROJECTINZET (hoeveel dit
// project van de resource opeist, en op welk ritme), geen bibliotheekafspraak — ze zaten er eerder
// wél in, waardoor het enige veld dat de Projectweergave uitnodigde te wijzigen (max.eenheden)
// onmiddellijk 'deviated' opleverde en door `resolveDeviation('company')` teruggezet kon worden. De
// bibliotheek vergelijkt nu uitsluitend de IDENTITEITSVELDEN: wat de resource IS (naam/type/
// omschrijving) en de bibliotheekafspraken erover (tarief/uur, eenheid). `calendarId` stond hier nooit
// in (project-lokale verwijzing, zie applyResourceUpdate) en blijft dat — zie F2.
export const RESOURCE_DIFF_FIELDS: (keyof Resource)[] = [
  'name', 'type', 'description', 'costPerHour', 'unitOfMeasure',
];

/** Stabiele vergelijkingssleutel voor een veldwaarde. A4-besluit: voor deze diff-velden is de
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
function hashFields<T>(item: T, fields: (keyof T)[]): string {
  return JSON.stringify(fields.map((f) => diffKey(item[f])));
}

/** syncedHash van een pool-/projectkalender (spec §2, plan-eis 8). */
export function computeCalendarHash(cal: WorkCalendar): string {
  return hashFields(cal, CALENDAR_DIFF_FIELDS);
}

/** syncedHash van een pool-/projectresource (spec §2, plan-eis 8). */
export function computeResourceHash(res: Resource): string {
  return hashFields(res, RESOURCE_DIFF_FIELDS);
}

/** Onzichtbare formatting-tekens die de matcher (F6, vloot-fixpakket issue #19) vóór de
 *  witruimte-collapse strip: zero-width space/non-joiner/joiner (U+200B–U+200D), BOM (U+FEFF) en
 *  soft-hyphen (U+00AD). Deze tekens zijn onzichtbaar in de UI maar tellen anders mee in de
 *  string-vergelijking — een naam die via copy-paste zo'n teken meekreeg (bv. "Kraan​1") matchte
 *  daardoor niet met de zichtbaar identieke "Kraan1". */
const INVISIBLE_FORMATTING_CHARS = /[\u200B-\u200D\uFEFF\u00AD]/g;

/** Normaliseer een naam voor de herkennings-matcher (spec §5.1): Unicode-NFC, onzichtbare
 *  formatting-tekens strippen, trim, samengevouwen witruimte (elke witruimte-run → één spatie),
 *  hoofdletterongevoelig. F6 (vloot-fixpakket, issue #19): `toLowerCase()` i.p.v. `toLocaleLowerCase()`
 *  — deterministisch onafhankelijk van de machine-locale (de Turkse dotless-İ-nuance van
 *  `toLocaleLowerCase` wordt bewust NIET toegepast, zie docs/library.md). `normalizeName` wordt NIET
 *  voor hashing gebruikt (dat loopt via `hashFields`/`diffKey` op de ruwe velden), alleen voor
 *  matching. Puur. */
export function normalizeName(name: string): string {
  return name.normalize('NFC').replace(INVISIBLE_FORMATTING_CHARS, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Zoek de UNIEKE kandidaat met dezelfde genormaliseerde naam (spec §5.1). Geen kandidaat óf
 *  meerdere kandidaten ⇒ `null` (geen voorstel — handmatige keuze). Geen fuzzy (spec §14). F6
 *  (vloot-fixpakket, issue #19): een LEGE genormaliseerde target (lege/pure-witruimte naam) matcht
 *  nooit — anders zouden twee items die allebei een lege naam normaliseren elkaar ten onrechte als
 *  unieke kandidaat aanwijzen. */
export function matchByName<T extends { name: string }>(name: string, candidates: T[]): T | null {
  const target = normalizeName(name);
  if (!target) return null;
  const hits = candidates.filter((c) => normalizeName(c.name) === target);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Los een naamsbotsing op voor een NIEUW bedrijf (issue #19, "Toevoegen als nieuwe
 * resourcebibliotheek" in `PoolImportDialog`): bestaat `rawName` al onder de gegeven bestaande namen
 * (vergeleken via `normalizeName`, spiegelt `matchByName` — case/witruimte/onzichtbare-tekens-
 * ongevoelig), dan krijgt de nieuwe naam een oplopend onderscheidend achtervoegsel " (2)", " (3)", …
 * — net zo lang tot de naam vrij is. Een lege/pure-witruimte/uitsluitend-onzichtbare-tekens-naam valt
 * terug op een standaardlabel (spiegelt `addCompany`) — de leeg-CHECK gebruikt bewust `normalizeName`
 * (critreview F4: `rawName.trim()` alleen strip ASCII-witruimte, geen U+200B/U+FEFF e.d.; een bestand
 * met zo'n onzichtbare naam gaf vóór deze fix een bibliotheek met een ogenschijnlijk lege rij in
 * Backstage in plaats van het standaardlabel). Puur — geschikt voor losse unit-tests, en gedeeld door
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

/** Uitkomst van de openings-classificatie (spec §3, grens 1/4). */
export type OnOpenStatus =
  | 'in-sync'   // project == pool
  | 'behind'    // pool bewoog, bestand is NIET lokaal bewerkt (file == syncedHash) ⇒ stil verversen
  | 'deviated'  // bestand is ná de sync bewerkt (file != syncedHash) ⇒ vraag
  | 'removed'   // pool-origineel bestaat niet meer
  | 'unbound';  // geen libraryOrigin — puur project-eigen item, hoort niet bij een bedrijfspool

function classifyOnOpen(diffStatus: ItemDiff['status'], fileHash: string, syncedHash: string | undefined): OnOpenStatus {
  if (diffStatus === 'removed') return 'removed';
  if (diffStatus === 'up-to-date') return 'in-sync';
  // diffStatus === 'changed'. Ontbrekende syncedHash (B1-bestand) ⇒ veilige kant: behandel als
  // extern bewerkt (spec §2/§12). Anders: file == syncedHash ⇒ niet-bewerkt ⇒ behind; ongelijk ⇒ deviated.
  if (syncedHash === undefined) return 'deviated';
  return fileHash === syncedHash ? 'behind' : 'deviated';
}

/** companyId-scope (stempel van een ánder bedrijf dan het geopende) is de verantwoordelijkheid van
 *  de aanroeper — deze functie vergelijkt alleen tegen de meegegeven `pool`. `'unbound'` dekt alleen
 *  stempel-loos (geen `libraryOrigin`); het is geen synoniem voor 'removed' en mag daar niet mee
 *  samenvallen (een puur project-eigen item is niet "uit het bedrijf verwijderd"). */
export function classifyCalendarOnOpen(projectCal: WorkCalendar, pool: CompanyPool): OnOpenStatus {
  if (!projectCal.libraryOrigin) return 'unbound';
  return classifyOnOpen(diffCalendarVsPool(projectCal, pool).status, computeCalendarHash(projectCal), projectCal.libraryOrigin.syncedHash);
}

/** companyId-scope (stempel van een ánder bedrijf dan het geopende) is de verantwoordelijkheid van
 *  de aanroeper — deze functie vergelijkt alleen tegen de meegegeven `pool`. `'unbound'` dekt alleen
 *  stempel-loos (geen `libraryOrigin`); het is geen synoniem voor 'removed' en mag daar niet mee
 *  samenvallen (een puur project-eigen item is niet "uit het bedrijf verwijderd"). */
export function classifyResourceOnOpen(projectRes: Resource, pool: CompanyPool): OnOpenStatus {
  if (!projectRes.libraryOrigin) return 'unbound';
  return classifyOnOpen(diffResourceVsPool(projectRes, pool).status, computeResourceHash(projectRes), projectRes.libraryOrigin.syncedHash);
}

/**
 * Bepaalt of de BIBLIOTHEEKAFSPRAAK-velden van een projectresource (naam/type/tarief/eenheid) in de
 * Resources-tab read-only moeten zijn (issue #19, punt 4). Puur, en gedeeld door `ResourcePanel`
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
 * `target` blijft ONGEWIJZIGD (F1, critreview issue #19: `applyResourceUpdate` deed eerder
 * `{...structuredClone(source), id, calendarId, parentId, libraryOrigin}` — dat kopieert het HELE
 * poolitem over het projectitem heen en negeert de bewuste versmalling van `RESOURCE_DIFF_FIELDS`;
 * `maxUnits`/`availabilitySteps` zijn PROJECTINZET, geen bibliotheekafspraak, en werden zo stilzwijgend
 * overschreven/gewist — gemeten in de showcases "6 Rijwoningen De Akkers" (Schilders-`maxUnits` 8→4)
 * en het appartementencomplex (torenkraan-`availabilitySteps` gewist)). `id`/`libraryOrigin` van
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

/** Pas de pool-waarden toe op een projectkalender bij "bijwerken" (spec §3): overschrijf de
 *  vergeleken velden, behoud id + herkomst (met verse poolVersion). Puur (nieuw object).
 *  `CALENDAR_DIFF_FIELDS` dekt hier BEWUST alle inhoudelijke `WorkCalendar`-velden (er is geen
 *  "projectinzet"-veld zoals bij Resource) — `applyDiffFields` levert dus hetzelfde resultaat op als
 *  de vroegere volledige-kloon-aanpak, alleen nu door-constructie veilig tegen een toekomstig
 *  kalenderveld dat WEL projectinzet zou zijn (zie F1-verificatie, issue #19). */
export function applyCalendarUpdate(projectCal: WorkCalendar, pool: CompanyPool): WorkCalendar {
  const id = projectCal.libraryOrigin?.libraryItemId;
  const source = id ? pool.calendars.find((c) => c.id === id) : undefined;
  // A3-fix: vangnet tegen stille corruptie. Ontbreekt het pool-origineel (of de herkomststempel),
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

/** Pas de pool-waarden toe op een projectresource bij "bijwerken" (spec §3): overschrijf UITSLUITEND
 *  de `RESOURCE_DIFF_FIELDS` (identiteit/bibliotheekafspraak — naam/type/omschrijving/tarief/eenheid),
 *  behoud id + herkomst (met verse poolVersion). `maxUnits`, `availabilitySteps`, de gedeprecieerde
 *  `availability`, `calendarId` en `parentId` zijn PROJECTINZET en blijven daarom altijd van `target`
 *  (projectRes) — dat is de F1-fix (issue #19): eerder kopieerde deze functie het volledige poolitem
 *  en overschreef zo stilzwijgend de eigen inzet van het project. Puur (nieuw object). */
export function applyResourceUpdate(projectRes: Resource, pool: CompanyPool): Resource {
  const id = projectRes.libraryOrigin?.libraryItemId;
  const source = id ? pool.resources.find((r) => r.id === id) : undefined;
  // A3-fix: zelfde vangnet als applyCalendarUpdate — geen stille reductie tot id+herkomst.
  if (!source) {
    throw new Error(`applyResourceUpdate: pool-origineel niet gevonden voor resource "${projectRes.name}" (id=${projectRes.id}, libraryItemId=${id ?? 'ontbreekt'})`);
  }
  const patched = applyDiffFields(projectRes, source, RESOURCE_DIFF_FIELDS);
  patched.libraryOrigin = makeOrigin(pool, id!, computeResourceHash(source));
  return patched;
}
