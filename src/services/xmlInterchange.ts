/**
 * Gedeelde conventies van de twee XML-uitwisselformaten die OPS zelf schrijft én leest (MSPDI en
 * P6-XML): escaping, het datum-anker en de OPS-eigen round-tripmarkers. De formaat-eigen
 * transportvelden (MSPDI-ExtendedAttribute-FieldID, P6-UDF-titel/-ObjectId) blijven bij hun formaat.
 */
import type { CustomTaskType } from '@/types/taskType';
import { importDateTimeOrUndefined, importStatusDate } from '@/services/importDates';
import { hasNonAnchorTime } from '@/services/subdayIo';

/** Elk teken buiten de `Char`-productie van XML 1.0 (https://www.w3.org/TR/xml/#charsets): C0-stuurtekens
 *  behalve tab/LF/CR, een losse UTF-16-surrogaat en U+FFFE/U+FFFF. Met de `u`-vlag is een geldig
 *  surrogaatpaar één teken boven U+FFFF en blijft het staan. */
const XML_INVALID_CHAR = /[^\t\n\r\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu;

/** Escapet tekst voor XML-inhoud én attributen (de vijf voorgedefinieerde entiteiten). Een teken dat XML 1.0
 *  niet toestaat, laat deze helper staan: dat vervangt de writer één keer in zijn hele uitvoer, met
 *  {@link replaceInvalidXmlChars}, zodat hij het aantal kan melden. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Vervangt elk teken dat XML 1.0 niet toestaat door U+FFFD (#588). Zo'n teken kan ook niet als entiteit;
 *  zonder vervanging weigert een strikte parser het hele bestand. U+FFFD houdt de plek zichtbaar in het
 *  doelprogramma. `replaced` telt de vervangen tekens voor de exportmelding. */
export function replaceInvalidXmlChars(xml: string): { xml: string; replaced: number } {
  let replaced = 0;
  const out = xml.replace(XML_INVALID_CHAR, () => {
    replaced += 1;
    return '\u{FFFD}';
  });
  return { xml: out, replaced };
}

/** Synthetisch tijdstip voor een datum zonder tijd (`toXmlDateTime`). Sinds F5b schrijven de MSPDI- en
 *  P6-schrijvers het alleen nog op een projectdatum en een kalenderuitzondering; een taakdatum gaat met zijn
 *  echte tijd (I8). Een lezer herkent het als "geen tijd" alleen in een bestand dat OPS zelf schreef
 *  ({@link XmlTimeRule}). */
export const DAY_TIME_ANCHOR = '08:00:00';

/** OPS-datum → `xsd:dateTime` zoals MS Project en P6 hem verwachten (`2026-03-09T08:00:00`): een
 *  date-only datum krijgt het anker, een uur-instant (`YYYY-MM-DDTHH:mm`) seconden; '' blijft ''. */
export function toXmlDateTime(iso: string): string {
  if (!iso) return '';
  if (iso.length === 10) return `${iso}T${DAY_TIME_ANCHOR}`;
  if (iso.length === 16) return `${iso}:00`;
  return iso;
}

/**
 * Hoe een MSPDI- of P6 XML-lezer de tijd in een taakdatum leest (alleen uren §1.3 en §3.10, I8; knownbugs
 * 274, 275 en 300). Het 08:00-anker is een afspraak van OPS zelf; een ander programma kent hem niet.
 *  - `foreign`: een bestand van een ander programma. Elke tijd is echt, ook 08:00.
 *  - `opsAnchor`: een OPS-export zonder lijst. Dat is een bestand met de duureenheidmarkering (v2026.9.0
 *    tot F5b), of een bestand met de vingerafdruk van de writers van v2026.6.0 tot en met v2026.8.1 (geen
 *    markering; `isLegacyOpsMspdi`, `isLegacyOpsP6Xml`). Al die writers kozen de vorm van een datum per
 *    KALENDER, niet per taak of per veld: op een urenkalender een moment, ook een echte 08:00; op een
 *    dagkalender een datum zonder tijd, geschreven als het anker 08:00. Bronnen: `isHourCalendar` in de
 *    writer van v2026.8.1, `modeOf(cal)` in `scheduleAnalysis.ts` van v2026.10.0 (de berekende datums van
 *    ELKE taak op een urenkalender zijn momenten, ook van een dagtaak), en in F5a `minuteModelWriteView`
 *    voor MSPDI (een letterlijke kalender schrijft elk planningsveld als moment, een ankerkalender elk
 *    afleidbaar moment als datum); de P6-writer van F5a schreef de momenten van het model. De lezer volgt dat met de kalender van de taak: op een urenkalender is elke tijd echt, op een scalaire
 *    kalender valt de tijd weg. De keuze voor een urenkalender is het tijdsignaal ({@link xmlTimeSignal}) of
 *    een duur korter dan een werkdag, zoals vóór F5b. Grens: een letterlijke kalender zonder enig signaal
 *    (alleen tijden van precies 08:00 en hele werkdagen) leest scalair, ook vóór F5b (knownbug 308).
 *  - `opsLiteral`: een OPS-export sinds F5b (`OPS_LiteralCalendars`). Elke taakdatum draagt zijn echte
 *    tijd; de lijst zegt welke kalenders letterlijk zijn (T17).
 */
export type XmlTimeRule = 'foreign' | 'opsAnchor' | 'opsLiteral';

export function xmlTimeRule(writtenByOps: boolean, literalCalendarsDefined: boolean): XmlTimeRule {
  if (literalCalendarsDefined) return 'opsLiteral';
  return writtenByOps ? 'opsAnchor' : 'foreign';
}

/** Naam van het OPS-veld met de letterlijke kalenders (T17) van een export: MSPDI-veldnaam op de
 *  projectsamenvattingstaak, P6-project-UDF-titel. De waarde is een JSON-lijst met de kalendernummers van
 *  het bestand (MSPDI `UID`, P6 `ObjectId`), bijvoorbeeld `[1,3]`. */
export const OPS_LITERAL_CALENDARS_NAME = 'OPS_LiteralCalendars';

export function literalCalendarsJson(numbers: Iterable<number>): string {
  return JSON.stringify([...new Set(numbers)].sort((a, b) => a - b));
}

/** Tegenhanger van {@link literalCalendarsJson}. Geen geldige lijst van gehele getallen ⇒ `null`. */
export function parseLiteralCalendars(raw: string | undefined): Set<number> | null {
  if (raw === undefined) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(n => Number.isInteger(n))) return null;
    return new Set(value as number[]);
  } catch { return null; }
}

/** Telt deze datum mee als tijdsignaal, de keuze voor een urenkalender? Een leesbare datum met een tijd
 *  die niet 08:00 is. Dat blijft de regel van vóór F5b, ook in een vreemd bestand: de spec wil minder
 *  promotie, niet meer (§3.1, §3.10). Een echte 08:00 houdt zijn tijd zonder promotie ({@link xmlTaskDate}).
 *  In een `opsLiteral`-bestand beslist de lijst; dit signaal geldt daar alleen zonder geldige lijst. */
export function xmlTimeSignal(raw: string): boolean {
  return hasNonAnchorTime(raw, DAY_TIME_ANCHOR) && importDateTimeOrUndefined(raw, true) !== undefined;
}

/** Een taakdatum uit MSPDI of P6 XML. `hourCalendar`: de kalender van de taak is een urenkalender.
 *  - `opsAnchor`: de kalender beslist, zoals de writer van dat bestand ({@link XmlTimeRule}): op een
 *    urenkalender is elke tijd echt, ook 08:00; op een scalaire kalender is het een datum zonder tijd;
 *  - `foreign` en `opsLiteral`: elke tijd is het moment, ook 08:00 en ook op een scalaire kalender (274).
 *  Lege of onleesbare invoer ⇒ `undefined` (`importDateTimeOrUndefined`). */
export function xmlTaskDate(raw: string, rule: XmlTimeRule, hourCalendar: boolean): string | undefined {
  return importDateTimeOrUndefined(raw, rule !== 'opsAnchor' || hourCalendar);
}

/** Leesrichting van {@link toXmlDateTime} voor de statusdatum (MSPDI `<StatusDate>`, P6 `<DataDate>`)
 *  → `project.statusDate`, met dezelfde regel als IFC ({@link importStatusDate}): een echte tijd blijft
 *  (`YYYY-MM-DDTHH:mm`), ook een tijd van een ander programma (MS Project bewaart 17:00). In een bestand
 *  van OPS (`rule` niet `foreign`) is 08:00 het anker: een datum zonder tijd, precies wat de writer kreeg.
 *  Grens van die afspraak: een OPS-statusdatum op precies 08:00 komt date-only terug (projectdatums
 *  houden het anker, §3.6). In een vreemd bestand is 08:00 een echte tijd (I8, knownbug 274). De
 *  `.mpp`-lezer leest zijn statusdatum met `foreign`: een `.mpp` komt van MS Project. */
export function statusDateFromXml(raw: string, rule: XmlTimeRule): string {
  return rule === 'foreign' || hasNonAnchorTime(raw, DAY_TIME_ANCHOR) ? importStatusDate(raw) : raw.substring(0, 10);
}

/** Naam van de OPS-duureenheidmarker: MSPDI-veldnaam/-alias en P6-UDF-titel. */
export const OPS_DURATION_UNIT_NAME = 'OPS_TaskDurationUnit';

export function isTaskDurationUnit(value: string): value is 'days' | 'hours' {
  return value === 'days' || value === 'hours';
}

const OPS_CUSTOM_TASK_TYPE_MARKER = 'OpenPlannerStudio.CustomTaskType.v1';

/** De OPS-taaktypemarker als JSON-tekst; de naam gaat mee zodat een ander document hem kan herbouwen. */
export function encodeCustomTaskType(id: string, customTaskTypes: readonly CustomTaskType[]): string {
  const type = customTaskTypes.find(candidate => candidate.id === id);
  return JSON.stringify({ ops: OPS_CUSTOM_TASK_TYPE_MARKER, id, ...(type ? { name: type.name } : {}) });
}

/** Tegenhanger van {@link encodeCustomTaskType}. Alles zonder onze marker of met een leeg id —
 *  ook een toevallig JSON-object in een vreemde vrije tekst — is geen taaktype. */
export function decodeCustomTaskType(rawText: string): { id: string; name?: string } | undefined {
  try {
    const raw: unknown = JSON.parse(rawText);
    if (!raw || typeof raw !== 'object'
      || (raw as { ops?: unknown }).ops !== OPS_CUSTOM_TASK_TYPE_MARKER
      || typeof (raw as { id?: unknown }).id !== 'string') return undefined;
    const id = (raw as { id: string }).id.trim();
    const name = typeof (raw as { name?: unknown }).name === 'string'
      ? (raw as { name: string }).name.trim()
      : '';
    return id ? { id, ...(name ? { name } : {}) } : undefined;
  } catch { return undefined; }
}
