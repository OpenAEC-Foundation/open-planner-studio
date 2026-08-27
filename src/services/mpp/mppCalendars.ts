/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Kalenderfabriek (T6): poort van `MPP14CalendarFactory.java` + `AbstractCalendarFactory.java` +
 * `AbstractCalendarAndExceptionFactory.java` — `"   114"/TBkndCal` (FixedMeta itemSize=10,
 * FixedData maxExpectedSize=12, VarMeta12, Var2Data) → basiskalenders + afgeleide (resource-)
 * kalenders via de base-kalender-verwijzing, weekdag-uren → `WorkCalendar.workDays` + banden,
 * uitzonderingen → `WorkCalendar.holidays` (gematerialiseerd).
 *
 * T3 (fase 3.8, MSP-pariteit, 2026-08-15) — UITBREIDING op T6's uitzonderingsmaterialisatie: waar
 * T6 uitsluitend PLATTE, niet-werkende uitzonderingen materialiseerde (recurrente records werden
 * bewust overgeslagen), expandeert T3 alle vier recurrentietypes (DAILY/WEEKLY/MONTHLY/YEARLY ×
 * absoluut/relatief — poort van `RecurringData`) en materialiseert ook WERKENDE uitzonderingen
 * (`periodCount>0`) als `WorkCalendar.workingExceptions`. Zie de sectiekop bij `ParsedExceptions`
 * verderop in dit bestand voor de volledige ontwerptoelichting (precedentie, invariant-garantie,
 * overerving). Corpusmeting (testdata-crawl, 661 bestanden, 3413 taken, 2026-08-15): startDiff
 * 313→197, finishDiff 450→264 (t.o.v. de T2-baseline, vóór deze taak).
 *
 * Doelsemantiek is IDENTIEK aan de kalendersectie van `mspdiReader.ts` (`applyCalendarBody`/
 * `parseCalendar`, spiegelplicht) — zelfde `WorkCalendar`-vorm, dezelfde `canonicalizeBands`/
 * `registerCalendarBands`/`promoteHourCalendar`-orkestratie uit `@/services/subdayIo`.
 *
 * ETAPPE 1.5 (uurmodus-taken, 2026-08-15) — CORRECTIE t.o.v. de oorspronkelijke T6-tekst hieronder:
 * `buildCalendarFromDays` promoveert NIET MEER zelf (geen `promoteHourCalendar`-aanroep meer aan het
 * eind) — die registreert alleen nog de banden (`registerCalendarBands`), spiegelt zo `mspdiReader.
 * ts`'s `applyCalendarBody`/`parseCalendar` (die ook alleen registreren, nooit zelf promoveren).
 * Promotie is nu een LOSSE stap, `promoteCalendarsForHourMode` (onderaan dit bestand) — `mppReader.
 * ts`'s `readTasks` roept 'm aan NÁ een taak-signaal-scan (spiegelt mspdiReader's eigen tweefasen-
 * opzet: eerst ALLE `<Calendar>`-elementen registreren, dan ALLE taken scannen op het (c)-signaal —
 * sub-dag-duur of een niet-ankertijd-Start/Finish, zie `mppAnchorClock`/`hasNonAnchorTime` in
 * mppReader.ts — en pas DAARNA promoveren). De reden voor de knip is precies dezelfde als bij
 * mspdiReader: `isSubDayMinutes`/de datumdiscriminator moeten `cal.hoursPerDay` lezen VÓÓR promotie
 * (de SCALAR, eerste-band-afgeleide waarde), niet de door `deriveHoursPerDay` herberekende waarde
 * ná promotie — zou je hier ná promotie scannen, dan vergelijk je taakduren tegen de VERKEERDE
 * (grovere/fijnere) dagsom. `readCalendars` zelf blijft ONVERANDERD verder: nog steeds `try/catch`-
 * gevangen (I1-fix), nog steeds de basis→afgeleide-overerving — alleen de laatste regel van
 * `buildCalendarFromDays` verdween.
 *
 * T6-kwaliteitsreview (M3) — twee bewuste, documenteerde verschillen met `mspdiReader.ts` blijven
 * staan (punt 1 hierboven is met etappe 1.5 vervallen — MPP-taken dragen sinds 2026-08-15 wél een
 * (c)-signaal, exact zoals mspdiReader):
 *  a. `WorkCalendar.holidays` begint hier ALTIJD als `[]` (`buildCalendarFromDays`), ongeacht of er
 *     daadwerkelijk uitzonderingen in het bestand staan — mspdiReader's `parseCalendar` start
 *     daarentegen bij `createDefaultCalendar()` (die, in bouwmodus, de NL-feestdagenset genereert)
 *     en overschrijft `calendar.holidays` ALLEEN als er ≥1 echte `<Exception>`-element gevonden is;
 *     bij 0 exceptions blijft mspdiReader's gegenereerde NL-standaardset dus stil staan. Dat is GEEN
 *     documentgegeven — het is mspdiReader's eigen "geen data ⇒ behoud de default"-conventie (relevant
 *     voor T6-kwaliteitsreview I2: een eerdere versie van de corpuscheck verwarde die default-set
 *     met "29 echte feestdagen uit de ground truth", terwijl de drie ground-truth-XML's zelf 0
 *     `<Exception>`-elementen bevatten). MPP-kalenders zijn ALTIJD letterlijke bestandsdata, nooit
 *     een stille default — vandaar de expliciete leegmaak, ook al is de uitkomst soms toevallig
 *     hetzelfde (0 holidays).
 *  b. Naamloze kalenders (geen CALENDAR_NAME-var-data) krijgen hier `"Kalender <uid>"`; mspdiReader
 *     valt terug op de vaste string `"Imported Calendar"` (`parseCalendar`). Beide zijn placeholders
 *     voor ontbrekende brondata, maar met een andere — voor MPP nuttigere, want uniek per kalender —
 *     conventie (zie `nameOfOrFallback` hieronder).
 *
 * FieldMap-vrij: MPXJ's `CalendarFactory` gebruikt GEEN data-gedreven field map (in tegenstelling
 * tot taken/resources/assignments, zie `fieldMap14.ts`) — de var-data-typen voor naam (1) en
 * kalenderdata (8) zijn letterlijke constanten in `MPP14CalendarFactory.java`.
 *
 * Hardingsdiscipline (T5-kwaliteitsreviews, hier voortgezet): elke ruwe, bestandsgestuurde
 * lus-/allocatiegrens (dagperiodes, uitzonderingsaantal, feestdagbereik, base-kalender-keten,
 * AANTAL kalenders, TOTAAL aantal gematerialiseerde holidays over het hele bestand) is expliciet
 * geklemd met een meetcommentaar — zie `MAX_DAY_HOUR_PERIODS`, `MAX_CALENDAR_EXCEPTIONS`,
 * `MAX_HOLIDAY_RANGE_DAYS`, `MAX_BASE_CHAIN_DEPTH`, `MAX_CALENDARS` en `MAX_TOTAL_HOLIDAY_SLOTS`
 * hieronder. T6-kwaliteitsreview (C1, kritiek): de PER-KALENDER-klemmen alleen waren onvoldoende —
 * niets begrensde het AANTAL kalenders of de TOTALE holiday-materialisatie over alle kalenders
 * samen. Gemeten: een 3 MB TBkndCal-blok met 100.001 nep-basiskalender-records (12 bytes elk, geen
 * echte var-data nodig) liet deze module vóór de fix 100.001 volledige `WorkCalendar`-objecten
 * alloceren — die daarna in `ImportResult.resourceCalendars`, de app-state, undo-snapshots én
 * IFC-saves belanden — een OOM-crash (exit 134) op een gewone dev-machine. `MAX_CALENDARS` kapt de
 * FixedData-iteratie af; `MAX_TOTAL_HOLIDAY_SLOTS` is een gedeeld budget-object dat zowel
 * `parseExceptions` (nieuwe materialisatie) als de base→afgeleide-overerving in `materializeDerived`
 * (`[...baseCal.holidays, ...]`, die de basiskalender se array PER afgeleide kalender kopieert) laat
 * afdragen — zonder dat budget zou N afgeleide kalenders × M base-holidays alsnog O(N×M) array-
 * slots kunnen kosten, ook als elke individuele kalender ruim binnen `MAX_CALENDAR_EXCEPTIONS` blijft.
 */
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { canonicalizeBands, getCalendarBands, promoteHourCalendar, registerCalendarBands } from '@/services/subdayIo';
import type { CfbFile } from './cfb';
import type { Props } from './mppContainer';
import { FixedData, FixedMeta, Var2Data, VarMeta12, getDate, getInt, getShort, getUnicodeString } from './mppPrimitives';
import { MAX_VAR_TEXT_BYTES, MAX_EXCEPTION_BAND_PERIODS } from './limits';
// T3-chunk-grens-fix (Opus-review, coördinatiepunt met T4): de formaat-neutrale recurrentie-/
// precedentiekern (spec-types, expansie- en resolutiefuncties — alles zonder 92-byte-parsing) is
// uitgetild naar `@/services/calendarRecurrence.ts` (bladmodule, importeert niets uit `@/services/
// mpp/*`). `mspdiReader.ts` (T4) importeerde deze eerder rechtstreeks vanuit DIT bestand — dat trok
// via een statische import uit de mpp-laag (`services/mpp/…`) de hele MPP-parser (CFB + fieldmaps) de main-chunk in
// (`tests/planning/check-mpp-chunk-boundary.ts`, T11). De namen hieronder blijven vanuit dit bestand
// HERGEËXPORTEERD (backward-compatible voor bestaande callers), maar nieuwe/bijgewerkte imports
// (T4's eigen import in `mspdiReader.ts`) horen rechtstreeks naar `@/services/calendarRecurrence` te
// wijzen — alleen dát maakt `check-mpp-chunk-boundary` weer groen.
import {
  expandRecurrence, buildContributions, resolveContributions, mergeInherited, newHolidayBudget,
  RECURRENCE_TYPES, RELATIVE_MAP, RECURRENCE_PRECEDENCE_ORDER,
  MAX_CALENDAR_EXCEPTIONS, MAX_HOLIDAY_RANGE_DAYS, MAX_TOTAL_HOLIDAY_SLOTS,
} from '@/services/calendarRecurrence';
import type { RecurrenceSpec, RecordContribution, RawException, ParsedExceptions, HolidayBudget } from '@/services/calendarRecurrence';

export {
  expandRecurrence, resolveContributions, newHolidayBudget,
  RECURRENCE_TYPES, RELATIVE_MAP, RECURRENCE_PRECEDENCE_ORDER,
  MAX_CALENDAR_EXCEPTIONS, MAX_HOLIDAY_RANGE_DAYS, MAX_TOTAL_HOLIDAY_SLOTS,
};
export type { RecurrenceSpec, RecordContribution, ParsedExceptions, HolidayBudget };

// ── PropsKey-sleutels (PropsKey.java) — gelezen uit `"   114"/Props`, net als de andere
// project-brede sleutels in mppReader.ts. ──────────────────────────────────────────────────────
const PROPS_KEY_DEFAULT_CALENDAR_NAME = 37748750;
const PROPS_KEY_DEFAULT_CALENDAR_HOURS = 37753736;

/** TBkndCal/FixedMeta-itemgrootte (AbstractCalendarFactory.java: `new FixedMeta(..., 10)`). */
const CAL_FIXED_META_ITEM_SIZE = 10;
/** TBkndCal/FixedData-itemgrootte-bovengrens (AbstractCalendarFactory.java: `new FixedData(...,
 *  12)`) — elk item draagt precies één `calendarID/baseCalendarID/resourceID`-triplet van 4 bytes. */
const CAL_FIXED_DATA_MAX_SIZE = 12;

/** MPP14CalendarFactory.java: vaste var-data-typen (geen field-map-indirectie, zie moduleheader). */
const CALENDAR_NAME_VAR_TYPE = 1;
const CALENDAR_DATA_VAR_TYPE = 8;

/** T6-kwaliteitsreview (M4): gedeelde tekst-klem, nu geïmporteerd uit de bladmodule `./limits.ts`
 *  i.p.v. een eigen lokale kopie (de vorige versie hield hier bewust een DUPLICAAT van
 *  `mppReader.ts`'s `MAX_VAR_TEXT_BYTES` aan om de omgekeerde-import-cyclus te vermijden —
 *  `limits.ts` lost dat structureel op, zie die module se toelichting). */
const MAX_CALENDAR_TEXT_BYTES = MAX_VAR_TEXT_BYTES;

/** C1-stijl klem: het aantal werktijd-periodes per weekdag (`periodCount`, SHORT 0..65535) stuurt
 *  een lus die per periode 2+4 bytes leest op een RUW, bestandsgestuurde offset — ongeklemd zou een
 *  geprepareerd bestand hier tot 65535 pogen te lezen, ver voorbij het 60-byte-dagblok, wat op een
 *  kort Var2Data-record al snel een `MPP:`-grensfout van de onderliggende primitief zou gooien en
 *  zo de HELE kalenderlezing (en dus `readMPP`) laat crashen — niet alleen dit ene veld.
 *
 *  T16-VEEGLIJST-FIX (was 10, PRE-EXISTING sinds T6-kwaliteitsreview M2 — dezelfde start/duur-
 *  overlapfout als `MAX_EXCEPTION_BAND_PERIODS` (`limits.ts`) vóór diens LAAG-3-FIX): de vorige
 *  toelichting analyseerde alléén de DUUR-array (`20+i*4`, past 10× vóór de 60-byte-grens) en
 *  NEGEERDE dat de START-array (`8+i*2`, 2-byte-stride) een KNELLENDERE grens is — start-slot `i`
 *  staat op `8+2i`, wat exact BOTST met duur-slot 0 (op `+20`) zodra `8+2i>=20`, dus `i>=6`.
 *  Structureel passen er dus hoogstens 6 NIET-OVERLAPPENDE periodes (`i=0..5`) vóór start-slot 6 al
 *  in duur-slot 0 se bytes leest (exact hetzelfde `i>=6`-omslagpunt als het 92-byte-uitzonderingsblok,
 *  toevallig dezelfde offset-afstand: 20 t.o.v. 8, 32 t.o.v. 20). Geklemd op 5 (niet de structurele
 *  6-slot-bovengrens): MS Project se eigen UI staat de gebruiker hooguit 5 werktijdperiodes per dag
 *  toe (de UI kent geen 6e rij, al vóór deze fix in de toelichting hierboven geciteerd) — 5 is dus
 *  zowel de STRUCTURELE (5<6, geen overlap-risico) als de PRODUCT-grens, en dus de motiveerbaarste
 *  keuze — zie `check-mpp-calendars.ts`'s "T16-veeglijst: MAX_DAY_HOUR_PERIODS-overlapfout" voor het
 *  mutatiebewijs (periodCount=7 met een niet-geklemde grens materialiseert een fantoomband uit
 *  buurdag-slot-0 se eigen duur-bytes; geklemd op 5 verdwijnt die band). */
const MAX_DAY_HOUR_PERIODS = 5;

/** C1 (kritiek, T6-kwaliteitsreview) — bovengrens op het AANTAL kalenders dat `readCalendars` uit
 *  één `"   114"/TBkndCal`-storage materialiseert. Zonder deze klem kapt alleen `MAX_CALENDAR_
 *  EXCEPTIONS`/`MAX_TOTAL_HOLIDAY_SLOTS` de HOLIDAY-kant af — het aantal `WorkCalendar`-OBJECTEN
 *  zelf (elk met een eigen `id`, `workDays`, evt. `workTime`-banden) bleef ongeklemd. Gemeten: een
 *  3 MB TBkndCal/FixedData-blok met 100.001 nep-records (elk 12 bytes: alleen een calendarID/
 *  baseID/resourceID-triplet, geen andere var-data nodig) liet deze module vóór de fix 100.001
 *  `WorkCalendar`-objecten alloceren, die daarna via `ImportResult.resourceCalendars` in de
 *  app-state/undo-snapshots/IFC-saves belanden — OOM-crash (exit 134). Corpus: hoogstens 13
 *  kalenders per bestand (plan-tabel). 1024 is ruim boven elk realistisch project (zelfs met
 *  tientallen unieke resource-kalenders), maar begrenst een geprepareerd bestand hard — de
 *  FixedData-iteratie in `readCalendars` stopt zodra `rawByUniqueId.size` deze klem raakt, dus de
 *  rest van het (mogelijk enorme) FixedData-blok wordt dan simpelweg niet meer bekeken. */
export const MAX_CALENDARS = 1_024;

/** Begrenst de base-kalender-ketenvolging voor afgeleide (resource-)kalenders — spiegelt
 *  `MAX_OUTLINE_LEVEL`'s klemdiscipline in mppReader.ts. Een geprepareerd bestand kan een kalender
 *  naar zichzelf of circulair naar een andere afgeleide kalender laten verwijzen; MPXJ zelf
 *  beschermt daar NIET tegen (`updateBaseCalendarNames` verwijdert alleen een kalender wiens
 *  base-ID nergens naar wijst, geen cyclusdetectie voor een keten van twee of meer afgeleide
 *  kalenders die naar elkaar verwijzen). De fixed-point-resolutie hieronder (`readCalendars`)
 *  probeert hoogstens dit aantal ronden; kalenders die dan nog niet opgelost zijn (cyclus, of een
 *  base die nooit bestaat) worden zonder overerving gematerialiseerd — zie de toelichting daar. */
export const MAX_BASE_CHAIN_DEPTH = 32;

/** Eén weekdag, volledig geresolveerd (geen "gebruik de default/base"-sentinel meer) — de
 *  tussenvorm die zowel de projectbrede DEFAULT_CALENDAR_HOURS-fallback, een basiskalender én een
 *  afgeleide kalender in hetzelfde format bewaart, zodat een afgeleide kalender een reeds
 *  gematerialiseerde basiskalender rechtstreeks als eigen fallback kan hergebruiken (zie
 *  `daysByUniqueId` in `readCalendars`). */
interface DayResolution {
  working: boolean;
  bands: { start: number; end: number }[];
}

/** MPPUtility/ProjectCalendarDays' eigen terugval wanneer zowel een kalenderdag als de
 *  project-brede DEFAULT_CALENDAR_HOURS-eigenschap "default" zijn: `DEFAULT_WORKING_WEEK`
 *  (ma-vr werkend) + `DEFAULT_WORKING_MORNING`/`DEFAULT_WORKING_AFTERNOON` (08:00-12:00,
 *  13:00-17:00) — AbstractCalendarFactory.java. Index 0=zondag..6=zaterdag (MPP-dagblokvolgorde,
 *  zie `resolveOneDay`). */
const STANDARD_DAY_HOURS_FALLBACK: ReadonlyArray<DayResolution> = [
  { working: false, bands: [] }, // zo
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // ma
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // di
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // wo
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // do
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // vr
  { working: false, bands: [] }, // za
];

/** MPP-tijdwaarde (SHORT, tienden-van-minuut sinds middernacht) → minuten-vanaf-middernacht,
 *  spiegelt `MPPUtility.getTime`'s seconden-afronding maar dan in minuten (subdayIo's
 *  bandeenheid). */
function mppTimeToMinutes(raw: number): number {
  let minutes = Math.floor(raw / 10);
  if (minutes > 1439) minutes %= 1440;
  return minutes;
}

/** Eén weekdag-blok (60 bytes, `AbstractCalendarFactory.processCalendarHours`'s per-dag-lus) →
 *  `DayResolution`. `defaultFlag===1` ⇒ `fallback` (het "DEFAULT"-daytype — voor een basiskalender
 *  is dat de project-brede DEFAULT_CALENDAR_HOURS-fallback, voor een afgeleide kalender de
 *  resolved-base-fallback; de aanroeper kiest welke). `dayIndex` 0..6 = MPP-dagblokvolgorde
 *  (0=zondag..6=zaterdag, zie `DayOfWeekHelper.ORDERED_DAYS`). */
function resolveOneDay(data: Uint8Array, dayIndex: number, fallback: DayResolution, ctx: string): DayResolution {
  const offset = dayIndex * 60;
  if (data.length < offset + 4) return fallback;
  const defaultFlag = getShort(data, offset, ctx);
  if (defaultFlag === 1) return fallback;

  const rawPeriodCount = getShort(data, offset + 2, ctx);
  const periodCount = Math.min(Math.max(rawPeriodCount, 0), MAX_DAY_HOUR_PERIODS); // zie MAX_DAY_HOUR_PERIODS
  const bands: { start: number; end: number }[] = [];
  for (let i = 0; i < periodCount; i++) {
    const startOffset = offset + 8 + i * 2;
    const durationOffset = offset + 20 + i * 4;
    if (data.length < startOffset + 2 || data.length < durationOffset + 2) break;
    const startMinutes = mppTimeToMinutes(getShort(data, startOffset, ctx));
    // MPPUtility.getDuration(byte[],offset): tienden-van-minuut, ondanks de 4-byte-stride ZELF een
    // SHORT-read (de hoge 2 bytes van elke 4-byte-periode-slot zijn ongebruikt/gereserveerd).
    const durationMinutes = Math.floor(getShort(data, durationOffset, ctx) / 10);
    if (durationMinutes > 0) bands.push({ start: startMinutes, end: startMinutes + durationMinutes });
  }
  return { working: bands.length > 0, bands };
}

/** Alle 7 weekdagen van één kalenderdata-blok resolven — `data === null` (kalender zonder eigen
 *  Var2Data-record) ⇒ het volledige `fallback`-patroon overnemen, zoals MPXJ's eigen
 *  `varData == null`-terugval. */
function resolveDays(data: Uint8Array | null, fallback: ReadonlyArray<DayResolution>, ctx: string): DayResolution[] {
  const result: DayResolution[] = [];
  for (let index = 0; index < 7; index++) {
    result.push(data ? resolveOneDay(data, index, fallback[index], ctx) : fallback[index]);
  }
  return result;
}

/** `DayResolution[7]` (index 0=zo..6=za) → een verse `WorkCalendar` met `workDays`/scalar-uren/
 *  banden gezet — spiegelt `mspdiReader.ts`'s `applyCalendarBody`. `holidays` wordt HIER altijd
 *  leeggemaakt (nooit `createDefaultCalendar()`'s eigen NL-feestdagen-default laten doorlekken —
 *  die horen bij een NIEUW project, niet bij een uit een bestand gelezen kalender); de aanroeper
 *  zet de echte, gematerialiseerde `holidays` erna. `description` wordt eveneens altijd leeggemaakt
 *  (T6-spec-review, minor c): MPP kent geen per-kalender-omschrijving, dus `createDefaultCalendar()`'s
 *  hardgecodeerde "ma-vr 07:00-16:00"-tekst zou stil onwaar worden zodra de werkelijke, hier gelezen
 *  uren daarvan afwijken.
 *
 *  `hoursPerDayOverride` (T6-spec-review-fix, minor b) — als niet-`null`, overschrijft dit de
 *  scalar-afgeleide `hoursPerDay` VÓÓR `promoteHourCalendar` wordt aangeroepen, zodat promotie (die
 *  op haar beurt `hoursPerDay` opnieuw kan afleiden via `deriveHoursPerDay` zodra de kalender
 *  daadwerkelijk banden draagt) het LAATSTE woord houdt — exact de volgorde van mspdiReader
 *  (`parseCalendar` past de MINUTES_PER_DAY-projecteigenschap toe, `promoteHourCalendar` draait
 *  daarna pas). Een eerdere versie paste deze override pas ná `readCalendars` toe (in
 *  `mppReader.ts`), dus NÁ promotie — dat liet promotie's eigen, preciezere afleiding stil
 *  overschrijven door de grovere projecteigenschap, precies andersom dan mspdiReader. */
function buildCalendarFromDays(name: string, days: ReadonlyArray<DayResolution>, hoursPerDayOverride: number | null): WorkCalendar {
  const cal = createDefaultCalendar();
  cal.id = generateId('mppcal');
  delete cal.generation; // MPP kent geen regelset-herkomst, net als MSPDI (zie mspdiReader.ts)
  cal.holidays = [];
  cal.description = '';
  cal.name = name;

  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const workDays: number[] = [];
  let scalar: { start: number; end: number } | null = null;
  for (let index = 0; index < 7; index++) {
    const isoDay = (index === 0 ? 7 : index) as 1 | 2 | 3 | 4 | 5 | 6 | 7; // MSP 1=zo..7=za → ISO 1=ma..7=zo
    const d = days[index];
    if (d && d.working && d.bands.length > 0) {
      workDays.push(isoDay);
      rawByWeekday[isoDay] = d.bands;
      if (!scalar) scalar = d.bands[0];
    }
  }
  if (workDays.length > 0) cal.workDays = workDays.sort((a, b) => a - b);
  if (scalar) {
    // T6-spec-review-fix (minor a): FLOOR op beide grenzen — spiegelt mspdiReader's
    // `parseInt(toTime.split(':')[0])` (het HELE-UURDEEL van de kloktijd, geen afronding omhoog).
    // `Math.ceil` op `workEndHour` gaf voorheen een AFWIJKENDE (te hoge) `hoursPerDay` zodra een
    // bandgrens niet op een heel uur viel (bv. 17:30 werd 18 i.p.v. 17).
    cal.workStartHour = Math.floor(scalar.start / 60);
    cal.workEndHour = Math.floor(scalar.end / 60);
    cal.hoursPerDay = cal.workEndHour - cal.workStartHour;
    if (cal.hoursPerDay <= 0) cal.hoursPerDay = 8;
  }
  if (hoursPerDayOverride !== null) cal.hoursPerDay = hoursPerDayOverride;

  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  registerCalendarBands(cal, { canonical: bands, deviates });
  // ETAPPE 1.5: promotie gebeurt HIER NIET MEER — zie de moduleheader. `cal.hoursPerDay` (hierboven,
  // ná `hoursPerDayOverride`) blijft dus de SCALAR waarde tot `promoteCalendarsForHourMode`
  // (onderaan dit bestand) draait; `mppReader.ts`'s `readTasks` heeft precies díe scalar-waarde
  // nodig om het (c)-signaal per taak te bepalen vóórdat promotie 'm met `deriveHoursPerDay`
  // herberekent.
  return cal;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// T3 (fase 3.8, MSP-pariteit) — recurrente uitzonderingen expanderen + werkende uitzonderingen
// lezen. Alleen het BYTE-SPECIFIEKE deel woont nog hier (het 92-byte-uitzonderingsblok zelf,
// `AbstractCalendarAndExceptionFactory.processCalendarExceptions`/`readRecurringData`); de
// formaat-neutrale recurrentie-/precedentiekern (spec-types, datumgeneratoren, autoriteitskaart-
// resolutie) is op Opus-review-eis uitgetild naar `@/services/calendarRecurrence.ts` — zie de
// importtoelichting bovenaan dit bestand voor de volledige ontwerptoelichting (autoriteitskaart,
// de LAAG-1/HOOG-1/LAAG-2-correcties, en het chunk-grens-coördinatiepunt met T4/mspdiReader.ts).
//
// Datumsubstraat: UTC-middernacht-`Date`'s (zelfde als `getDate` hier en `formatDate`/`parseDate`/
// `addCalendarDays` in `calendarRecurrence.ts`).

/** Losse, grens-gecontroleerde ENKELE-byte-lezer — `mppPrimitives.ts` exporteert alleen
 *  `getShort`/`getInt` (2/4 bytes); de MONTHLY/YEARLY-recurrentievelden (`+76`/`+77`/`+78`) zijn
 *  losse BYTES (`MPPUtility.getByte`). Zelfde grenscontrolediscipline als de gedeelde primitieven. */
function getByteAt(data: Uint8Array, offset: number, ctx: string): number {
  if (offset < 0 || offset + 1 > data.length) {
    throw new Error(`MPP: getByte buiten grenzen (offset=${offset}, bufferlengte=${data.length}) [${ctx}]`);
  }
  return data[offset];
}

/** Poort van `AbstractCalendarAndExceptionFactory.readRecurringData` (het deel van het 92-byte-
 *  uitzonderingsblok vanaf `+72`) — alle vier recurrentietypes × absoluut/relatief, letterlijk naar
 *  de plan-§T3-byte-offsets: WEEKLY dagen-bitmap `+76`/frequentie `+78`; MONTHLY absoluut dagnummer
 *  `+76`/frequentie `+78`, relatief weekdag `+77-2`/dagnummer `+76+1`/frequentie `+78` (SHORT);
 *  YEARLY absoluut dagnummer `+77`/maand `+76+1`, relatief weekdag `+78-2`/dagnummer `+77+1`/maand
 *  `+76+1`. Retourneert `null` voor een out-of-range `recurrenceTypeValue` (zie `RECURRENCE_TYPES`). */
function readRecurringData(data: Uint8Array, offset: number, fromDate: Date, toDate: Date | null, ctx: string): RecurrenceSpec | null {
  const recurrenceTypeValue = getShort(data, offset + 72, ctx);
  const type = recurrenceTypeValue >= 0 && recurrenceTypeValue < RECURRENCE_TYPES.length ? RECURRENCE_TYPES[recurrenceTypeValue] : null;
  if (type === null) return null;
  const relative = recurrenceTypeValue < RELATIVE_MAP.length ? RELATIVE_MAP[recurrenceTypeValue] : false;
  const occurrences = getShort(data, offset + 4, ctx);

  let frequency = 1;
  let weeklyDayMask = 0;
  let dayNumber = 0;
  let dayOfWeekValue = 0;
  let monthNumber = 0;

  switch (type) {
    case 'DAILY':
      // T6-spec-review-fix (zie de historische toelichting bij `isFlattenedNonRecurring` in
      // `readRawExceptions`): `@76` telt UITSLUITEND mee bij recurrenceTypeValue===7 — bij ===1
      // hardcodeert MPXJ frequency=1 (ongeacht `@76`).
      frequency = recurrenceTypeValue === 1 ? 1 : getShort(data, offset + 76, ctx);
      break;
    case 'WEEKLY':
      // De rauwe byte IS al de bitmap in DAY_MASKS-layout (bit0=zondag..bit6=zaterdag) — MPXJ's
      // `setWeeklyDaysFromBitmap(byte, DAY_MASKS)` past exact dezelfde bit-per-index-toewijzing toe
      // (DAY_MASKS = {0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40}, index 1..7 = zo..za), dus geen
      // vertaalslag nodig — `getWeeklyDates` hieronder toetst met `1 << jsGetUTCDay()`, dezelfde
      // bit-per-weekdag-conventie (JS: 0=zo..6=za).
      weeklyDayMask = getByteAt(data, offset + 76, ctx);
      frequency = getShort(data, offset + 78, ctx);
      break;
    case 'MONTHLY':
      if (relative) {
        dayOfWeekValue = getByteAt(data, offset + 77, ctx) - 2;
        dayNumber = getByteAt(data, offset + 76, ctx) + 1;
        frequency = getShort(data, offset + 78, ctx);
      } else {
        dayNumber = getByteAt(data, offset + 76, ctx);
        frequency = getByteAt(data, offset + 78, ctx);
      }
      break;
    case 'YEARLY':
      if (relative) {
        dayOfWeekValue = getByteAt(data, offset + 78, ctx) - 2;
        dayNumber = getByteAt(data, offset + 77, ctx) + 1;
      } else {
        dayNumber = getByteAt(data, offset + 77, ctx);
      }
      monthNumber = getByteAt(data, offset + 76, ctx) + 1;
      break;
  }

  return { type, relative, startDate: fromDate, finishDate: toDate, occurrences, frequency, weeklyDayMask, dayNumber, dayOfWeekValue, monthNumber };
}

/** Eén uitzonderingsblok se werktijd-BANDEN (`+20+i*2` start, `+32+i*4` duur — plan-§T3) — gezet
 *  wanneer `periodCount>0` ("werkende uitzondering", MS Project: een anders niet-werkende dag krijgt
 *  eigen uren). `MAX_EXCEPTION_BAND_PERIODS` (limits.ts) is de structurele capaciteit van het
 *  92-byte-blok zelf (spiegelt `MAX_DAY_HOUR_PERIODS`'s klemdiscipline voor het 60-byte-dagblok). */
function readExceptionBands(data: Uint8Array, offset: number, periodCountRaw: number, ctx: string): { start: number; end: number }[] {
  const periodCount = Math.min(Math.max(periodCountRaw, 0), MAX_EXCEPTION_BAND_PERIODS);
  const bands: { start: number; end: number }[] = [];
  for (let i = 0; i < periodCount; i++) {
    const startOffset = offset + 20 + i * 2;
    const durationOffset = offset + 32 + i * 4;
    if (data.length < startOffset + 2 || data.length < durationOffset + 2) break;
    const startMinutes = mppTimeToMinutes(getShort(data, startOffset, ctx));
    const durationMinutes = Math.floor(getShort(data, durationOffset, ctx) / 10);
    if (durationMinutes > 0) bands.push({ start: startMinutes, end: startMinutes + durationMinutes });
  }
  return bands;
}

/** Eén uitzonderingenblok (`AbstractCalendarAndExceptionFactory.processCalendarExceptions`) →
 *  RUWE `RawException[]` — nog GEEN precedentie-resolutie (die doet `resolveExceptions`). Elk
 *  record met een leesbare `fromDate` (sentinel `65535 ⇒ null` — zie `getDate`) én ofwel een geldig
 *  recurrentiepatroon ofwel géén recurrentie wordt bewaard; een out-of-range `recurrenceTypeValue`
 *  (`readRecurringData` retourneert dan `null` terwijl `isFlattenedNonRecurring` ook `false` is)
 *  wordt STIL OVERGESLAGEN — spiegelt MPXJ's eigen uitkomst van 0 geëxpandeerde datums voor zo'n
 *  record (zie `RECURRENCE_TYPES`'s toelichting), functioneel gelijk zonder een nutteloos
 *  `RawException` met een lege datumlijst te hoeven dragen. */
function readRawExceptions(data: Uint8Array, ctx: string): RawException[] {
  const out: RawException[] = [];
  // I1-fix (T6-kwaliteitsreview): was `data.length <= 420` — bij length===421 gleed dat door de
  // guard heen en liet `getShort(data, 420, ctx)` twee bytes lezen die maar deels beschikbaar zijn
  // (420+2=422 > 421), wat een `MPP:`-grensfout gooide die — vóór de I1-try/catch-fix in
  // `readCalendars` — de HELE `readMPP`-aanroep liet falen voor wat verder een prima leesbaar
  // bestand kan zijn. `< 422` is de correcte grens: 422 bytes is het minimum om de 2-byte
  // `exceptionCount` op offset 420 veilig te kunnen lezen.
  if (data.length < 422) return out;
  const rawExceptionCount = getShort(data, 420, ctx);
  if (rawExceptionCount === 0) return out;
  const exceptionCount = Math.min(Math.max(rawExceptionCount, 0), MAX_CALENDAR_EXCEPTIONS); // zie MAX_CALENDAR_EXCEPTIONS

  let offset = 424;
  for (let index = 0; index < exceptionCount; index++) {
    if (offset + 92 > data.length) break; // afgekapt blok — MPP14Reader.java breekt hier ook af

    const fromDate = getDate(data, offset, ctx);
    const toDate = getDate(data, offset + 2, ctx);
    const periodCountRaw = getShort(data, offset + 14, ctx);
    const recurrenceTypeValue = getShort(data, offset + 72, ctx);

    let exceptionNameLength = getInt(data, offset + 88, ctx);
    if (exceptionNameLength % 4 !== 0) exceptionNameLength = (Math.floor(exceptionNameLength / 4) + 1) * 4;
    // I1-stijl klem (zie MAX_CALENDAR_TEXT_BYTES): begrenst zowel het decodeerwerk als — op een
    // hostile bestand — de offset-opschuiving naar de volgende uitzondering; op elk realistisch
    // bestand (naam ruim onder 64 KiB) is dit een no-op.
    exceptionNameLength = Math.max(0, Math.min(exceptionNameLength, MAX_CALENDAR_TEXT_BYTES));

    if (fromDate) {
      // T6-spec-review-fix (zie `readRecurringData`'s DAILY-toelichting): `@76` telt UITSLUITEND
      // mee bij recurrenceTypeValue===7 — bij ===1 hardcodeert MPXJ frequency=1 (ongeacht `@76`).
      const isDaily = recurrenceTypeValue === 1 || recurrenceTypeValue === 7;
      const rawFrequency = recurrenceTypeValue === 1 ? 1 : getShort(data, offset + 76, ctx);
      const isFlattenedNonRecurring = recurrenceTypeValue === 0 || (isDaily && rawFrequency === 1);

      let recurring: RecurrenceSpec | null = null;
      let contributesNothing = false;
      if (!isFlattenedNonRecurring) {
        recurring = readRecurringData(data, offset, fromDate, toDate, ctx);
        contributesNothing = recurring === null; // out-of-range recurrenceTypeValue — zie RECURRENCE_TYPES
      }

      if (!contributesNothing) {
        const bands = readExceptionBands(data, offset, periodCountRaw, ctx);
        let name = '';
        if (exceptionNameLength > 0 && data.length >= offset + 92 + exceptionNameLength) {
          const decoded = getUnicodeString(data, offset + 92, exceptionNameLength, ctx);
          if (decoded) name = decoded;
        }
        out.push({
          fromDate,
          toDate,
          periodCount: Math.min(Math.max(periodCountRaw, 0), MAX_EXCEPTION_BAND_PERIODS),
          bands,
          name,
          recurring,
        });
      }
    }
    offset += 92 + exceptionNameLength;
  }
  return out;
}

/** Poort van `AbstractCalendarAndExceptionFactory.processCalendarExceptions` + de T3-uitbreiding
 *  (recurrente expansie + werkende uitzonderingen). `buildContributions`/`resolveContributions`
 *  (formaat-neutraal, `@/services/calendarRecurrence`) doen de precedentie-/invariant-resolutie;
 *  hier gebeurt alleen de byte-specifieke ruwe-record-opbouw (`readRawExceptions`). `budget`
 *  (T6-kwaliteitsreview C1, ongewijzigd voortgezet) blijft het gedeelde `HolidayBudget` over ALLE
 *  kalenders in de aanroepende `readCalendars`-run, gedeeld door zowel `holidays` ALS
 *  `workingExceptions` (Opus-T2-review-eis). */
export function parseExceptions(data: Uint8Array, ctx: string, budget: HolidayBudget): ParsedExceptions {
  return resolveContributions(buildContributions(readRawExceptions(data, ctx), budget), budget);
}

/** Eén ruwe TBkndCal/FixedData-record (12 bytes): kalender-uniqueID + base-kalender-uniqueID +
 *  resource-uniqueID. Veldvolgorde is versie-afhankelijk (`MPP14CalendarFactory.java`'s
 *  constructor) — zie `readCalendars`'s `calendarIdOffset`/`baseIdOffset`/`resourceIdOffset`. */
interface RawCalendarEntry {
  calendarUniqueId: number;
  baseCalendarUniqueId: number;
  resourceUniqueId: number;
}

export interface CalendarReadResult {
  /** Alle gematerialiseerde kalenders (basis + afgeleide), MPP-uniqueID → `WorkCalendar`. */
  calendarByUniqueId: ReadonlyMap<number, WorkCalendar>;
  /** De gekozen PROJECTkalender (DEFAULT_CALENDAR_NAME-lookup, met terugval — zie de toelichting
   *  bij de projectkalender-selectie onderaan `readCalendars`). Altijd gezet (nooit `undefined`) —
   *  bij een lege/onleesbare TBkndCal-storage is dit de generieke `createDefaultCalendar()`, zelfde
   *  terugval als de T5-placeholder die deze module vervangt. */
  projectCalendar: WorkCalendar;
  /** Alle overige kalenders (alles behalve `projectCalendar`) — spiegelt mspdiReader's
   *  `resourceCalendars` (elk `<Calendar>`-element behalve UID 1). */
  resourceCalendars: WorkCalendar[];
  /** MPP resource-uniqueID → kalender-uniqueID (`AbstractCalendarFactory`'s `resourceMap`) — voor
   *  T7's `Resource.calendarId`-koppeling (TBkndRsc); T6 zelf verbruikt dit nog niet (er zijn nog
   *  geen `Resource`-objecten om aan te koppelen). */
  resourceCalendarUniqueIdByResourceUniqueId: ReadonlyMap<number, number>;
  /** DIAGNOSTISCHE telling (T6-slot, her-check; T6-kwaliteitsreview M5 — herformulering: dit is
   *  GEEN productiedata die `readMPP`/`ImportResult` verder verbruikt, uitsluitend een meethaakje
   *  voor testcode zoals `check-mpp-calendars.ts`'s crawl-sectie): MPP-uniqueID → aantal EIGEN
   *  uitzonderingen van díe kalender. Nodig omdat een afgeleide kalender se `holidays`-array
   *  `[...baseCal.holidays, ...ownHolidays]` bevat (zie Fase 2 hieronder) — een consument die
   *  simpelweg `.holidays.length` per kalender optelt zou de basiskalender se feestdagen ÉÉN KEER
   *  PER AFGELEIDE KALENDER dubbeltellen. Deze map draagt uitsluitend het EIGEN aandeel
   *  (basiskalenders: hun volledige `holidays`, want daar bestaat geen overerving; afgeleide
   *  kalenders: alleen `ownHolidays`) — zodat een dubbeltelvrije som over ALLE kalenders mogelijk is
   *  zonder de interne overervingsstructuur te hoeven kennen. */
  ownHolidayCountByUniqueId: ReadonlyMap<number, number>;
}

/** Terugval bij een ontbrekende/onleesbare TBkndCal-storage — zelfde vangnet als de T5-placeholder
 *  die deze functie vervangt (`createDefaultCalendar()`, geen kalenders). */
function fallbackResult(): CalendarReadResult {
  return {
    calendarByUniqueId: new Map(),
    projectCalendar: createDefaultCalendar(),
    resourceCalendars: [],
    resourceCalendarUniqueIdByResourceUniqueId: new Map(),
    ownHolidayCountByUniqueId: new Map(),
  };
}

/**
 * Entry point (T6). Poort van `AbstractCalendarFactory.processCalendarData` +
 * `MPP14CalendarFactory`'s versie-afhankelijke veldoffsets. `applicationVersion` komt uit
 * `detectApplicationVersion` (mppContainer.ts) — `null`/laag ⇒ de ≤2010-veldlayout, precies zoals
 * MPXJ's eigen `NumberHelper.getInt(null) === 0`-terugval (zie ook `milestoneBitFlag` in
 * mppReader.ts voor hetzelfde patroon).
 *
 * `hoursPerDayOverride` (T6-spec-review-fix, minor b) — de MINUTES_PER_DAY-projecteigenschap, of
 * `null` als die afwezig/ongeldig was (`mppReader.ts`'s `parseProjectProperties`). Wordt UITSLUITEND
 * toegepast op de kalender die uiteindelijk de PROJECTkalender wordt (zie `projectCalendarUid`
 * hieronder) — spiegelt mspdiReader, waar de MinutesPerDay-override alleen in `parseCalendar` zit
 * (nooit op resource-kalenders). Om de override VÓÓR `promoteHourCalendar` te kunnen toepassen (zie
 * `buildCalendarFromDays`'s toelichting) moet de identiteit van de projectkalender al bekend zijn
 * VÓÓR de materialisatie-lussen — vandaar dat de naam-lookup hier vooraan staat i.p.v. achteraan.
 *
 * I1-fix (T6-kwaliteitsreview): dunne, ALTIJD-vangende wrapper rond `readCalendarsUnsafe` —
 * voorheen was alleen de FixedMeta/FixedData/VarMeta-CONSTRUCTIE in een try/catch gevangen; Fase 1/2
 * (de eigenlijke materialisatie) zaten daarbuiten, dus een primitief-grensfout DAAR (bv. de
 * off-by-one op `data.length<=420` — zie `parseExceptions`) liet de belofte "een kapotte
 * kalendersectie blokkeert de import niet" (het commentaar stond er al) niet waarmaken: zo'n fout
 * gooide dwars door `readCalendars` heen, `mppReader.ts` ving 'm nergens op, en de HELE `readMPP`-
 * aanroep faalde voor wat verder een prima leesbaar bestand kan zijn. */
export function readCalendars(
  cfb: CfbFile,
  projectProps: Props,
  applicationVersion: number | null,
  hoursPerDayOverride: number | null = null,
): CalendarReadResult {
  try {
    return readCalendarsUnsafe(cfb, projectProps, applicationVersion, hoursPerDayOverride);
  } catch {
    return fallbackResult();
  }
}

function readCalendarsUnsafe(
  cfb: CfbFile,
  projectProps: Props,
  applicationVersion: number | null,
  hoursPerDayOverride: number | null,
): CalendarReadResult {
  const label = '"   114"/TBkndCal';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndCal', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndCal', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndCal', 'VarMeta']);
  const var2DataBytes = cfb.getStream(['   114', 'TBkndCal', 'Var2Data']); // legitiem afwezig (mppPrimitives.ts)

  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) {
    // Geen (volledige) TBkndCal-storage — geen kalenders te lezen; val terug op de generieke
    // standaardkalender (zelfde vangnet als de T5-placeholder die deze functie vervangt).
    return fallbackResult();
  }

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, CAL_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, CAL_FIXED_DATA_MAX_SIZE, 0, `${label}/FixedData`);
  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);
  const varData = new Var2Data(varMeta, var2DataBytes);

  // MPP14CalendarFactory.java: > ApplicationVersion.PROJECT_2010 (14) ⇒ 2013+-veldlayout.
  const useModernOffsets = (applicationVersion ?? 0) > 14;
  const calendarIdOffset = useModernOffsets ? 8 : 0;
  const baseIdOffset = useModernOffsets ? 0 : 4;
  const resourceIdOffset = useModernOffsets ? 4 : 8;

  // ── Ruwe FixedData-records → uniek per calendarUniqueId (eerste-wint, spiegelt Java's
  // `!calendarMap.containsKey(calendarID)`-guard). C1 (kwaliteitsreview): de lus stopt zodra
  // `rawByUniqueId.size` `MAX_CALENDARS` raakt — zie die constante se toelichting (100.001 nep-
  // records ⇒ OOM zonder deze klem). ────────────────────────────────────────────────────────────
  const rawByUniqueId = new Map<number, RawCalendarEntry>();
  const itemCount = fixedData.getItemCount();
  for (let index = 0; index < itemCount && rawByUniqueId.size < MAX_CALENDARS; index++) {
    const item = fixedData.getByteArrayValue(index);
    if (!item || item.length < 12) continue; // 12 bytes = max(calendarIdOffset,baseIdOffset,resourceIdOffset)+4
    const calendarUniqueId = getInt(item, calendarIdOffset, `${label}/FixedData calendarId`);
    if (calendarUniqueId <= 0 || rawByUniqueId.has(calendarUniqueId)) continue;
    const baseCalendarUniqueId = getInt(item, baseIdOffset, `${label}/FixedData baseId`);
    const resourceUniqueId = getInt(item, resourceIdOffset, `${label}/FixedData resourceId`);
    rawByUniqueId.set(calendarUniqueId, { calendarUniqueId, baseCalendarUniqueId, resourceUniqueId });
  }
  if (rawByUniqueId.size === 0) return fallbackResult();

  const defaultCalendarHoursBytes = projectProps.getByteArray(PROPS_KEY_DEFAULT_CALENDAR_HOURS);
  const projectDefaultDays = resolveDays(defaultCalendarHoursBytes, STANDARD_DAY_HOURS_FALLBACK, `${label}/defaultCalendarHours`);

  const calendarByUniqueId = new Map<number, WorkCalendar>();
  const daysByUniqueId = new Map<number, DayResolution[]>();
  const resourceCalendarUniqueIdByResourceUniqueId = new Map<number, number>();
  const ownHolidayCountByUniqueId = new Map<number, number>();
  const baseCalendarUniqueIds = new Set<number>();
  // C1 (kwaliteitsreview): ÉÉN gedeeld budget over ALLE kalenders in deze aanroep — zie
  // `MAX_TOTAL_HOLIDAY_SLOTS`. Elke `parseExceptions`-aanroep (Fase 1 én 2) en de base→afgeleide-
  // overervingskopie (Fase 2, `mergeInherited` → `resolveContributions`) decrementeren 'm — sinds
  // T3 óók per gematerialiseerde `workingException`-dag, niet alleen holidays (Opus-T2-review-eis).
  const holidayBudget = newHolidayBudget();

  // I3-fix (T6-kwaliteitsreview): `nameOf` scande voorheen 2× per kalender (eerst voor de
  // projectkalender-naam-lookup hieronder, dan nogmaals in `nameOfOrFallback` tijdens materialisatie)
  // ZONDER cache — bij een gedeelde, grote (tot 64 KiB) naam-var-data-offset (legitiem, zie
  // Var2Data's moduleheader in mppPrimitives.ts) kost dat dubbel scanwerk per kalender. Gemeten:
  // 8.000 kalenders die een 64 KiB-naam delen ≈ 5,9 s zonder cache. `nameCache` memoiseert per
  // uniqueID (incl. het `null`-resultaat — een kalender zonder naam-var-data hoeft ook maar één keer
  // "niet gevonden" te concluderen).
  const nameCache = new Map<number, string | null>();
  const nameOf = (uid: number): string | null => {
    if (nameCache.has(uid)) return nameCache.get(uid) ?? null;
    const name = varData.getUnicodeString(uid, CALENDAR_NAME_VAR_TYPE, MAX_CALENDAR_TEXT_BYTES, `${label}/name[uid=${uid}]`);
    nameCache.set(uid, name);
    return name;
  };
  // T6-spec-review (minor c): een kalender zonder eigen naam-var-data (vooral afgeleide/resource-
  // kalenders — MPP koppelt de naam meestal aan de RESOURCE, niet aan de kalender zelf, en T6 kent
  // nog geen Resource-objecten om die naam uit te lenen, zie T7) krijgt hier "Kalender <uid>" i.p.v.
  // stil `createDefaultCalendar()`'s "Bouwkalender NL"/"Standaardkalender" te laten staan — die naam
  // hoort bij een NIEUW project, niet bij een uit een bestand gelezen kalender.
  const nameOfOrFallback = (uid: number): string => nameOf(uid) ?? `Kalender ${uid}`;

  // T6-spec-review-fix (BLOKKEREND — was asymmetrisch verkeerd): AbstractCalendarFactory.java kent
  // TWEE VERSCHILLENDE regels voor `resourceMap` — basiskalenders (r. 157-160) linken UITSLUITEND
  // bij een POSITIEVE, nog-ongekoppelde resource-ID ("In theory, base calendars should not have a
  // resource ID attached to them... As long as the resource ID isn't already linked..."); afgeleide
  // kalenders (r. 174-176) linken ONVOORWAARDELIJK — geen `>0`-check, geen containsKey-check, altijd
  // een kale `resourceMap.put(resourceID, cal)`, ook bij resource-ID 0. Resource-uniqueID 0 is een
  // GELDIGE id (corpus, hash-only §8: 870d339f60603f71's afgeleide kalenders dragen resource-ID's
  // 0,1,2,3,4,5,7,8,9) —
  // een eerdere versie gebruikte hier ÉÉN gedeelde, altijd-`>0`-geguarde `linkResource`-functie voor
  // beide fases, wat resource-ID 0 op een afgeleide kalender stil liet vallen.
  const linkBaseResource = (rec: RawCalendarEntry): void => {
    if (rec.resourceUniqueId > 0 && !resourceCalendarUniqueIdByResourceUniqueId.has(rec.resourceUniqueId)) {
      resourceCalendarUniqueIdByResourceUniqueId.set(rec.resourceUniqueId, rec.calendarUniqueId);
    }
  };
  const linkDerivedResource = (rec: RawCalendarEntry): void => {
    resourceCalendarUniqueIdByResourceUniqueId.set(rec.resourceUniqueId, rec.calendarUniqueId);
  };

  // ── Projectkalender-IDENTITEIT vooraf bepalen (vóór materialisatie) — DEFAULT_CALENDAR_NAME-
  // lookup (AbstractCalendarFactory.java r. 205-210), met terugval op de eerste basiskalender, dan
  // de eerste kalender van welke soort dan ook (Map-itteratievolgorde === FixedData-volgorde). Moet
  // vóór Fase 1/2 gebeuren zodat `hoursPerDayOverride` (zie de toelichting bij deze functie) tijdens
  // de materialisatie van PRECIES déze kalender kan worden toegepast — `nameOf` heeft alleen
  // `varData` nodig, geen materialisatie. */
  const defaultNameBytes = projectProps.getByteArray(PROPS_KEY_DEFAULT_CALENDAR_NAME);
  const defaultName = defaultNameBytes
    ? getUnicodeString(defaultNameBytes, 0, MAX_CALENDAR_TEXT_BYTES, `${label}/defaultCalendarName`)
    : null;
  let projectCalendarUid: number | null = null;
  if (defaultName) {
    for (const uid of rawByUniqueId.keys()) {
      if (nameOf(uid) === defaultName) {
        projectCalendarUid = uid;
        break;
      }
    }
  }
  if (projectCalendarUid === null) {
    for (const rec of rawByUniqueId.values()) {
      if (rec.baseCalendarUniqueId <= 0 || rec.baseCalendarUniqueId === rec.calendarUniqueId) {
        projectCalendarUid = rec.calendarUniqueId;
        break;
      }
    }
  }
  if (projectCalendarUid === null) {
    projectCalendarUid = rawByUniqueId.keys().next().value ?? null;
  }
  const overrideFor = (uid: number): number | null => (uid === projectCalendarUid ? hoursPerDayOverride : null);

  // ── Fase 1: basiskalenders (baseCalendarUniqueId<=0 of ===zichzelf, AbstractCalendarFactory.java
  // r. 136). Zelfstandig materialiseerbaar — geen afhankelijkheid van andere kalenders. Corpus-
  // bevinding (2026-08-14, alle drie ground-truth-bestanden): de "Standaard"-basiskalender heeft
  // GEEN eigen CALENDAR_DATA-var-data (`ownData === null`) — MPXJ substitueert dan de project-brede
  // DEFAULT_CALENDAR_HOURS-prop (`defaultCalendarHoursBytes`) als bron voor ZOWEL de uren ALS de
  // uitzonderingen (`AbstractCalendarFactory.java` r. 138-144: `if (varData == null) varData =
  // defaultCalendarData;`, gevolgd door `processCalendarHours`/`processCalendarExceptions` op die
  // ÉÉN gesubstitueerde `varData`) — LET OP: deze substitutie geldt UITSLUITEND voor basiskalenders,
  // niet voor afgeleide (Fase 2 hieronder volgt een ANDERE, eigen substitutieregel: de resolved-
  // base-kalender in plaats van het project-brede blok). `effectiveData` hieronder is exact die
  // substitutie; zonder deze fix zou `cal.holidays` altijd leeg blijven voor een basiskalender
  // zonder eigen var-data, ook als `defaultCalendarHoursBytes` zelf wél uitzonderingen droeg. ────
  for (const rec of rawByUniqueId.values()) {
    if (!(rec.baseCalendarUniqueId <= 0 || rec.baseCalendarUniqueId === rec.calendarUniqueId)) continue;
    baseCalendarUniqueIds.add(rec.calendarUniqueId);

    const ownData = varData.getByteArray(rec.calendarUniqueId, CALENDAR_DATA_VAR_TYPE);
    const effectiveData = ownData ?? defaultCalendarHoursBytes;
    const days = ownData ? resolveDays(ownData, projectDefaultDays, `${label}/hours[uid=${rec.calendarUniqueId}]`) : projectDefaultDays;
    daysByUniqueId.set(rec.calendarUniqueId, days);

    const cal = buildCalendarFromDays(nameOfOrFallback(rec.calendarUniqueId), days, overrideFor(rec.calendarUniqueId));
    // M9 (kwaliteitsreview): uid in de ctx, voor diagnoseerbare grensfouten per kalender.
    const parsed: ParsedExceptions = effectiveData
      ? parseExceptions(effectiveData, `${label}/exceptions[uid=${rec.calendarUniqueId}]`, holidayBudget)
      : { holidays: [], workingExceptions: [] };
    cal.holidays = parsed.holidays;
    // T3: `workingExceptions` blijft AFWEZIG (niet `[]`) wanneer leeg — byte-identiek gedrag met
    // vóór deze taak voor elke kalender zonder werkende uitzonderingen.
    if (parsed.workingExceptions.length > 0) cal.workingExceptions = parsed.workingExceptions;
    calendarByUniqueId.set(rec.calendarUniqueId, cal);
    ownHolidayCountByUniqueId.set(rec.calendarUniqueId, cal.holidays.length); // basiskalender: alles is "eigen", geen overerving
    linkBaseResource(rec);
  }

  // ── Fase 2: afgeleide (resource-)kalenders — fixed-point-resolutie tegen de base-keten (kan zelf
  // weer naar een andere afgeleide kalender wijzen), met cyclus-/dieptebescherming
  // (MAX_BASE_CHAIN_DEPTH). Overneemt de basiskalender se dagpatroon per weekdag (DEFAULT-dagen) en
  // voegt de basiskalender se feestdagen samen met de eigen uitzonderingen (documenteerde
  // vereenvoudiging — zie MAX_BASE_CHAIN_DEPTH's toelichting: dit project heeft geen per-kalender
  // parent-keten-model zoals MPXJ's `ProjectCalendar.getParent()`, dus alles wordt hier hard
  // gematerialiseerd i.p.v. lazy geresolved). ──────────────────────────────────────────────────────
  const materializeDerived = (rec: RawCalendarEntry, fallbackDays: DayResolution[], baseCal: WorkCalendar | null): void => {
    const ownData = varData.getByteArray(rec.calendarUniqueId, CALENDAR_DATA_VAR_TYPE);
    const days = resolveDays(ownData, fallbackDays, `${label}/hours[uid=${rec.calendarUniqueId}]`);
    daysByUniqueId.set(rec.calendarUniqueId, days);

    const cal = buildCalendarFromDays(nameOfOrFallback(rec.calendarUniqueId), days, overrideFor(rec.calendarUniqueId));
    const ownRaw = ownData ? readRawExceptions(ownData, `${label}/exceptions[uid=${rec.calendarUniqueId}]`) : [];
    // MIDDEN-1 (Opus-review): `buildContributions` leest `holidayBudget.remaining` als momentopname
    // om de TOTALE generatie te begrenzen (zie de functietoelichting) — het GEDEELDE budget-object
    // wordt hier zelf nog niet gedecrementeerd (dat gebeurt pas in `resolveContributions`/
    // `mergeInherited` hieronder), dus deze snapshot is de STRAKST mogelijke bovengrens (reflecteert
    // exact wat er nog daadwerkelijk over is op dit punt in de pijplijn).
    const ownContributions = buildContributions(ownRaw, holidayBudget);
    // Diagnostisch (T6-slot, `ownHolidayCountByUniqueId`) — EIGEN, ONGEBUDGETTEERD budget: dit is
    // uitsluitend een dubbeltelvrije meethaakje voor testcode (zie `CalendarReadResult`'s
    // toelichting), geen productie-uitvoer, dus moet niet van het GEDEELDE `holidayBudget` afdoen
    // (dat zou de "eigen"-telling en de daadwerkelijke `merged`-materialisatie hieronder tegen
    // elkaar laten concurreren om dezelfde slots — de eigen data zelf is al structureel begrensd
    // door `MAX_CALENDAR_EXCEPTIONS`, dus een verse `newHolidayBudget()` hier is veilig).
    const ownParsed = resolveContributions(ownContributions, newHolidayBudget());
    const baseParsed: ParsedExceptions = baseCal
      ? { holidays: baseCal.holidays, workingExceptions: baseCal.workingExceptions ?? [] }
      : { holidays: [], workingExceptions: [] };
    const merged = baseCal ? mergeInherited(baseParsed, ownContributions, holidayBudget) : resolveContributions(ownContributions, holidayBudget);
    cal.holidays = merged.holidays;
    if (merged.workingExceptions.length > 0) cal.workingExceptions = merged.workingExceptions;
    calendarByUniqueId.set(rec.calendarUniqueId, cal);
    ownHolidayCountByUniqueId.set(rec.calendarUniqueId, ownParsed.holidays.length); // NIET de geërfde base-holidays meetellen
    linkDerivedResource(rec);
  };

  const pending = new Map<number, RawCalendarEntry>();
  for (const rec of rawByUniqueId.values()) {
    if (!baseCalendarUniqueIds.has(rec.calendarUniqueId)) pending.set(rec.calendarUniqueId, rec);
  }
  for (let pass = 0; pass < MAX_BASE_CHAIN_DEPTH && pending.size > 0; pass++) {
    let progressed = false;
    for (const [uid, rec] of Array.from(pending)) {
      const baseDays = daysByUniqueId.get(rec.baseCalendarUniqueId);
      if (!baseDays) continue; // base nog niet opgelost (of bestaat niet) — volgende ronde proberen
      materializeDerived(rec, baseDays, calendarByUniqueId.get(rec.baseCalendarUniqueId) ?? null);
      pending.delete(uid);
      progressed = true;
    }
    if (!progressed) break; // geen vooruitgang meer: resterende entries zijn een cyclus of hebben een onbestaande base
  }
  // Restanten (cyclus/onbereikbare base/klem geraakt): materialiseer ZONDER basis-overerving i.p.v.
  // de kalender stilzwijgend te laten vallen — eigen data (indien aanwezig) op de project-brede
  // DEFAULT_CALENDAR_HOURS-fallback.
  for (const rec of pending.values()) materializeDerived(rec, projectDefaultDays, null);

  const projectCalendar = (projectCalendarUid !== null ? calendarByUniqueId.get(projectCalendarUid) : undefined)
    ?? calendarByUniqueId.values().next().value;
  if (!projectCalendar) return fallbackResult(); // defensief onbereikbaar (rawByUniqueId.size>0 hierboven al gecontroleerd)

  const resourceCalendars: WorkCalendar[] = [];
  for (const cal of calendarByUniqueId.values()) {
    if (cal !== projectCalendar) resourceCalendars.push(cal);
  }

  return {
    calendarByUniqueId,
    projectCalendar,
    resourceCalendars,
    resourceCalendarUniqueIdByResourceUniqueId,
    ownHolidayCountByUniqueId,
  };
}

/**
 * ETAPPE 1.5 — de LOSSE promotiestap die `buildCalendarFromDays` niet meer zelf doet (zie de
 * moduleheader). `mppReader.ts`'s `readTasks` roept dit precies ÉÉN keer aan, NÁ een volledige
 * taak-signaal-scan (spiegelt mspdiReader's eigen `hourModeCalIds`-lus in `readMSPDI`, die ook pas
 * ná de eerste taken-lus draait). `signaledCalendars` = de kalender-OBJECTEN (identiteit, geen
 * uniqueID-indirectie nodig — elke `WorkCalendar` hier is per-parse uniek, net als de gedeelde
 * `bandRegistry`-WeakMap in `subdayIo.ts`) die minstens één (c)-signaal droegen: een taak met een
 * sub-dag-duur (`isSubDayMinutes`) of een Start/Finish die van het kalender-eigen anker afwijkt
 * (`hasNonAnchorTime`, zie `mppAnchorClock` in mppReader.ts).
 *
 * Itereert over ALLE kalenders in `calendarByUniqueId` (basis ÉN afgeleide/resource-kalenders) —
 * een kalender zonder taak-signaal promoveert hier nog steeds op haar EIGEN banden (discriminator
 * (a)/(b), bv. een lunchpauze-kalender), exact zoals vóór etappe 1.5 en exact zoals mspdiReader's
 * `calById`-lus (die óók alle kalenders langsgaat, niet alleen de door taken aangeraakte). Retourneert
 * de resulterende uur-modus-kalenders als `Set` (identiteit) — `readTasks` gebruikt die rechtstreeks
 * om per taak `isHour` te bepalen (`hourModeCals.has(effCal)`), zonder nog een uniqueID-vertaalslag.
 */
export function promoteCalendarsForHourMode(
  calendarByUniqueId: ReadonlyMap<number, WorkCalendar>,
  signaledCalendars: ReadonlySet<WorkCalendar>,
): Set<WorkCalendar> {
  const hourModeCals = new Set<WorkCalendar>();
  for (const cal of calendarByUniqueId.values()) {
    if (promoteHourCalendar(cal, getCalendarBands(cal), signaledCalendars.has(cal), false)) {
      hourModeCals.add(cal);
    }
  }
  return hourModeCals;
}
