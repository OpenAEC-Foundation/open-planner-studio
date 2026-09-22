/**
 * Seriële datums van Excel ↔ ISO-strings (issue #27, etappe 3).
 *
 * Bladmodule: geen imports, geen state.
 *
 * **Alle arithmetiek loopt via `Date.UTC`/`getUTC*`.** Een `new Date(y, m, d)` zou de lokale tijdzone
 * meenemen en dan schuift de dag op zodra de machine ±12 uur van UTC af staat; de tijdzonematrix van
 * de planningssuite (o.a. `Pacific/Kiritimati` en `Pacific/Niue`, ±14 u uit elkaar) valt daar hard op.
 *
 * Twee stelsels:
 *  - **1900** (standaard, Windows). Serieel 1 = 1900-01-01, maar Excel telt 1900 ten onrechte als
 *    schrikkeljaar (serieel 60 = het niet-bestaande "1900-02-29", een bewust overgenomen bug uit
 *    Lotus 1-2-3). Vanaf serieel 61 (= 1900-03-01) loopt de telling weer gelijk met de werkelijkheid,
 *    en dáár rekent deze module mee: het anker is 1899-12-30. Alles onder `MIN_READABLE_SERIAL_1900`
 *    ligt in of vóór het kapotte deel en is dus **onleesbaar** — we raden geen datum.
 *  - **1904** (het oude Mac-stelsel, `date1904="1"` in de workbook-instellingen). Serieel 0 =
 *    1904-01-01, geen schrikkelbug.
 */

/** Onder deze waarde is het 1900-stelsel niet eenduidig te lezen (de 1900-schrikkelbug). */
export const MIN_READABLE_SERIAL_1900 = 61;

const MS_PER_DAY = 86_400_000;
const MINUTES_PER_DAY = 1440;

/** Anker van serieel 0 per stelsel, in UTC-ms. */
const EPOCH_1900 = Date.UTC(1899, 11, 30);
const EPOCH_1904 = Date.UTC(1904, 0, 1);

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Zet een ISO-datum (`YYYY-MM-DD`, eventueel met `THH:MM`) om in een serieel getal.
 *
 * Geeft `undefined` bij alles wat geen eenduidige datum is: vrije tekst, een onmogelijke datum
 * (`2026-02-31`), of een datum die in het gekozen stelsel niet leesbaar is. Nooit een gok.
 */
export function isoToSerial(iso: string, epoch1904 = false): number | undefined {
  const m = ISO_RE.exec(iso.trim());
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hh, mi, ss] = [Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  if (hh > 23 || mi > 59 || ss > 59) return undefined;
  const ms = Date.UTC(y, mo - 1, d, hh, mi, ss);
  if (!Number.isFinite(ms)) return undefined;
  // Kalender-normalisatie: `Date.UTC(2026, 1, 31)` levert 3 maart. Terugrekenen ontmaskert dat.
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return undefined;
  }
  const serial = (ms - (epoch1904 ? EPOCH_1904 : EPOCH_1900)) / MS_PER_DAY;
  if (epoch1904) {
    if (serial < 0) return undefined;
  } else if (serial < MIN_READABLE_SERIAL_1900) {
    return undefined;
  }
  return serial;
}

/**
 * Zet een serieel getal terug in een ISO-string: `YYYY-MM-DD` als de tijd middernacht is, anders
 * `YYYY-MM-DDTHH:MM`. Geeft `undefined` voor waarden die niet eenduidig leesbaar zijn.
 *
 * De fractie wordt op hele minuten afgerond — Excel bewaart een tijd als binaire breuk, dus 08:30
 * komt terug als 0.35416666666666663 en zou zonder afronding 08:29 worden.
 */
export function serialToIso(serial: number, epoch1904 = false): string | undefined {
  if (!Number.isFinite(serial)) return undefined;
  if (epoch1904 ? serial < 0 : serial < MIN_READABLE_SERIAL_1900) return undefined;
  const days = Math.floor(serial);
  let minutes = Math.round((serial - days) * MINUTES_PER_DAY);
  let dayOffset = days;
  if (minutes >= MINUTES_PER_DAY) {
    // Afronding van 23:59:40 tikt over naar de volgende dag.
    minutes -= MINUTES_PER_DAY;
    dayOffset += 1;
  }
  const ms = (epoch1904 ? EPOCH_1904 : EPOCH_1900) + dayOffset * MS_PER_DAY;
  const dt = new Date(ms);
  if (!Number.isFinite(dt.getTime())) return undefined;
  const date = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  if (minutes === 0) return date;
  return `${date}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}
