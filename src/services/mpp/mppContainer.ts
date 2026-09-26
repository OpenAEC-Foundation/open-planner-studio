/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * MPP-containerlaag boven de generieke CFB-lezer (`cfb.ts`): formaatdetectie via het
 * `\x01CompObj`-blok, de generieke `Props`-blokparser (Props.java/Props14.java) en de
 * leesbaarheidspoort (`assertReadable`) die legacy- en versleutelde bestanden er met een
 * herkenbare fout uitfiltert vóórdat er ook maar één taak/resource/kalender gelezen wordt.
 *
 * Poort-bronnen: CompObj.java, MPPReader.java (FILE_CLASS_MAP r. 445–455), Props.java,
 * Props14.java, PropsKey.java, MPP14Reader.java (wachtwoordvlag-logica r. ~150–165).
 * `DocumentInputStreamFactory` (XOR-decodering voor versleutelde streams) is bewust NIET
 * geport: versleuteld ⇒ nette fout, nooit proberen te decoderen.
 */
import type { CfbFile } from './cfb';
import { getInt, getShort } from './mppPrimitives';
import { MppUnsupportedError } from './errors';

export type MppVariant = 'MPP8' | 'MPP9' | 'MPP12' | 'MPP14';

/** CompObj.java: format-string → variant. Bewust alleen de varianten die MPPReader's
 *  FILE_CLASS_MAP kent (r. 445–455) — "MSProject.MPP4" (het alleroudste formaat) heeft daar
 *  ZELF geen entry in MPXJ en valt bij ons dus terecht in de "onbekend formaat"-tak. */
const FILE_FORMAT_TO_VARIANT: Record<string, MppVariant> = {
  'MSProject.MPP9': 'MPP9',
  'MSProject.MPT9': 'MPP9',
  'MSProject.GLOBAL9': 'MPP9',
  'MSProject.MPP8': 'MPP8',
  'MSProject.MPT8': 'MPP8',
  'MSProject.MPP12': 'MPP12',
  'MSProject.MPT12': 'MPP12',
  'MSProject.GLOBAL12': 'MPP12',
  'MSProject.MPP14': 'MPP14',
  'MSProject.MPT14': 'MPP14',
  'MSProject.GLOBAL14': 'MPP14',
};

/** Leest de CompObj-blokinhoud (CompObj.java): 28 bytes overslaan, dan drie optioneel-aanwezige
 *  lengte-geprefixte ASCII-strings (applicationName, fileFormat, applicationID) — elke string
 *  telt zijn eigen null-terminator mee in de opgegeven lengte, dus we nemen `length - 1` bytes.
 *  `applicationID` wordt niet gelezen. Elke read gooit een duidelijke fout zodra de buffer te kort
 *  is (nooit een rauwe RangeError).
 *
 *  `applicationName` is nodig voor `detectApplicationVersion` (bit-vlag-tabellen verschillen tussen
 *  Project ≤2010 en 2013+, `MPP14Reader.java` r. ~1029). `assertReadable` en
 *  `detectApplicationVersion` parsen het blok elk apart; bewust, het is tientallen bytes groot. */
function readCompObjInfo(bytes: Uint8Array): { applicationName: string; fileFormat: string | null } {
  let pos = 28;
  const readInt32 = (): number => {
    const v = getInt(bytes, pos, 'CompObj');
    pos += 4;
    return v;
  };
  const readAsciiMinusTerminator = (length: number): string => {
    if (length <= 0 || pos + length > bytes.length) {
      throw new Error(`MPP: CompObj-blok te kort voor een ${length}-byte string op offset ${pos}`);
    }
    const slice = bytes.subarray(pos, pos + length);
    pos += length;
    const charCount = Math.max(0, length - 1);
    let s = '';
    for (let i = 0; i < charCount; i++) s += String.fromCharCode(slice[i]);
    return s;
  };

  if (bytes.length < 32) {
    throw new Error(`MPP: CompObj-blok te klein (${bytes.length} bytes)`);
  }
  const nameLength = readInt32();
  const applicationName = readAsciiMinusTerminator(nameLength);
  if (applicationName === 'Microsoft Project 4.0') {
    // MPP4 heeft geen apart format-veld in het blok (CompObj.java: kortsluit-tak) — en geen
    // entry in MPPReader's FILE_CLASS_MAP, dus voor ons net zo goed "onbekend/ongesteund".
    return { applicationName, fileFormat: null };
  }
  const formatLength = readInt32();
  if (formatLength <= 0) return { applicationName, fileFormat: null };
  return { applicationName, fileFormat: readAsciiMinusTerminator(formatLength) };
}

/** Formaatdetectie via het `\x01CompObj`-stream in de root van de CFB-container
 *  (MPPReader.getFileFormat). Onbekende/ontbrekende format-string ⇒ gewone `Error` (geen
 *  `MppUnsupportedError` — dit is geen "wij ondersteunen dit MPP-formaat niet"-geval, maar
 *  "dit is geen herkenbaar MS-Project-MPP-bestand"). */
export function detectMppVariant(cfb: CfbFile): MppVariant {
  const compObjBytes = cfb.getStream(['\x01CompObj']);
  if (!compObjBytes) {
    throw new Error('Not a recognised MS Project MPP file');
  }
  let fileFormat: string | null;
  try {
    fileFormat = readCompObjInfo(compObjBytes).fileFormat;
  } catch (err) {
    // De onderliggende oorzaak (bv. een afgekapt CompObj-blok) blijft beschikbaar via `cause`.
    // `ErrorOptions` zit in de ES2022-lib en dit project mikt op ES2020, dus `cause` wordt ná
    // constructie gezet.
    const wrapped = new Error('Not a recognised MS Project MPP file') as Error & { cause?: unknown };
    wrapped.cause = err;
    throw wrapped;
  }
  const variant = fileFormat ? FILE_FORMAT_TO_VARIANT[fileFormat] : undefined;
  if (!variant) {
    throw new Error('Not a recognised MS Project MPP file');
  }
  return variant;
}

/** `Microsoft.Project.<N>.0` (CompObj.java's `PATTERN`; de punten zijn ONgeëscaped regex-jokers
 *  in de Java-bron, dus matchen ook de spatie die het corpus daadwerkelijk gebruikt —
 *  "Microsoft.Project 16.0", corpus-geverifieerd op alle drie ground-truth-bestanden). */
const APPLICATION_VERSION_PATTERN = /Microsoft.Project.(\d+).0/;

/** De MS-Project-versie (`CompObj.getApplicationVersion`) — MPP14Reader kiest daarmee tussen de
 *  Project-≤2010- en de 2013+-bit-vlag-tabellen (r. ~1029 e.v.). `null` als het patroon niet matcht;
 *  de aanroepers behandelen `null` als `0` en vallen zo terug op de 2010-tabel, zoals MPXJ
 *  (`NumberHelper.getInt(null) === 0`, en `0 ≤ PROJECT_2010`). */
export function detectApplicationVersion(cfb: CfbFile): number | null {
  const compObjBytes = cfb.getStream(['\x01CompObj']);
  if (!compObjBytes) return null;
  let applicationName: string;
  try {
    applicationName = readCompObjInfo(compObjBytes).applicationName;
  } catch {
    return null;
  }
  const match = APPLICATION_VERSION_PATTERN.exec(applicationName);
  if (!match) return null;
  const version = parseInt(match[1], 10);
  return Number.isFinite(version) ? version : null;
}

// ── Props (Props.java + Props14.java) ────────────────────────────────────────────────────────
//
// Eén binair sleutel/waarde-blokformaat, gebruikt voor MEERDERE streams in het bestand (o.a. de
// root-`Props14`-stream EN `"   114"/Props`) — vandaar dat deze klasse los van een specifiek pad
// staat: de aanroeper geeft de streambytes mee, ongeacht waar ze vandaan komen.

const PROPS14_HEADER_SIZE = 16;

/** Port van Props14.java's constructor-lus. Elke entry: lengte(4) + sleutel(4) + genegeerd(4) +
 *  data(lengte bytes), uitgelijnd op een 2-byte-grens. Bewust GEEN throw bij een te-kort blok
 *  halverwege — Props14.java breekt dan gewoon af (`break`) i.p.v. te falen; MPXJ's eigen
 *  commentaar noemt expliciet bestanden waar dit misgaat op bepaalde JRE's. Wij spiegelen dat
 *  vergevingsgezinde gedrag hier bewust letterlijk. */
function parsePropsBytes(bytes: Uint8Array, label: string): Map<number, Uint8Array> {
  const ctx = `Props[${label}]`;
  const map = new Map<number, Uint8Array>();
  if (bytes.length < PROPS14_HEADER_SIZE) {
    throw new Error(`MPP: Props[${label}] te klein voor header (${bytes.length} bytes, minimaal ${PROPS14_HEADER_SIZE})`);
  }
  const headerCount = getShort(bytes, 12, ctx);
  let pos = PROPS14_HEADER_SIZE;
  let found = 0;

  // `bytes.length - pos` is de enige brontelling (geen parallelle teller die uit de pas kan lopen).
  while (found < headerCount) {
    if (bytes.length - pos < 12) break;
    const length = getInt(bytes, pos, ctx);
    const key = getInt(bytes, pos + 4, ctx);
    // bytes[pos+8 .. pos+11] (attrib3) genegeerd, zoals Props14.java.
    pos += 12;

    if (bytes.length - pos < length || length < 1) break;
    const data = bytes.subarray(pos, pos + length);
    pos += length;

    map.set(key, data);
    found++;

    if (data.length % 2 !== 0) pos += 1; // uitlijnen op 2-byte-grens
  }
  return map;
}

/** Poort van Props.java/Props14.java: sleutel/waarde-toegang tot een Props-blok. De sleutel is
 *  een plain `number` (PropsKey-waarde) i.p.v. een gesloten enum, zodat lezers vrij nieuwe
 *  PropsKey-constanten kunnen gebruiken. */
export class Props {
  private readonly map: Map<number, Uint8Array>;
  private readonly label: string;

  constructor(bytes: Uint8Array, label = 'Props') {
    this.label = label;
    this.map = parsePropsBytes(bytes, label);
  }

  getByteArray(key: number): Uint8Array | null {
    return this.map.get(key) ?? null;
  }

  getByte(key: number): number {
    const item = this.map.get(key);
    return item && item.length > 0 ? item[0] : 0;
  }

  getShort(key: number): number {
    const item = this.map.get(key);
    return item && item.length >= 2 ? getShort(item, 0, `Props[${this.label}] key=${key}`) : 0;
  }

  getInt(key: number): number {
    const item = this.map.get(key);
    return item && item.length >= 4 ? getInt(item, 0, `Props[${this.label}] key=${key}`) : 0;
  }

  getBoolean(key: number): boolean {
    return this.getShort(key) !== 0;
  }
}

// ── Leesbaarheids-poort ──────────────────────────────────────────────────────────────────────

/** PropsKey.java r. 73. Alleen bit 0x1 ("protection password supplied") is relevant voor LEZEN —
 *  bit 0x2 is de schrijfreserveringswachtwoord-vlag, die MS Project ook niet vraagt bij het
 *  openen. Dit is een BEWUSTE precisering t.o.v. een kale "≠ 0"-check (zie MPP14Reader.java's
 *  `passwordRequiredToRead = (passwordProtectionFlag & 0x1) != 0`). Bit 0x1 alléén is echter nog
 *  NIET voldoende om te weigeren — zie `readPasswordProtection` hieronder voor de volledige
 *  conditie (vlag ÉN hash). */
const PASSWORD_FLAG = 893386752;
// PropsKey.java r. 59 — ENCRYPTION_CODE = 893386759, alleen ter documentatie: de bijbehorende
// XOR-decodering (`DocumentInputStreamFactory`) is bewust niet geport — versleutelde streams worden
// alleen herkend en geweigerd, nooit ontcijferd.
/** PropsKey.java r. 77 (`PROTECTION_PASSWORD_HASH`). Samen met `PASSWORD_FLAG` de volledige
 *  afwijscondities hieronder — zie de toelichting bij `readPasswordProtection`. */
const PROTECTION_PASSWORD_HASH = 893386756;

/**
 * 1. WELKE Props-stream: MPP14Reader.java leest de wachtwoordvlag NIET uit `"   114"/Props` (de
 *    ~88 kB projectproperties-stream, `m_projectProps`), maar uit de kleine ROOT-stream `Props14`
 *    (~0,7–0,8 kB). In de corpusbestanden komt `PASSWORD_FLAG` alleen in de root-stream voor; in
 *    `"   114"/Props` ontbreekt de sleutel, dus daar lezen zou versleutelde bestanden nooit herkennen.
 *
 * 2. VOLLEDIGE afwijsconditie: MPP14Reader.java's `populateMemberData` (r. ~150-165) gooit pas als
 *    BEIDE waar zijn:
 *      passwordRequiredToRead = (passwordProtectionFlag & 0x1) != 0
 *      encryptionXmlPresent   = props.getByteArray(PropsKey.PROTECTION_PASSWORD_HASH) != null
 *    De Java-bron: "I've come across an example where the password flag was set, but the encryption
 *    XML was missing. In this case the file is unencrypted and MS Project opens it without prompting
 *    for a password." Een kale vlag-check zou zulke bestanden onterecht weigeren.
 */
function readPasswordProtection(cfb: CfbFile): { flagSet: boolean; hashPresent: boolean } {
  const rootProps14Bytes = cfb.getStream(['Props14']);
  if (!rootProps14Bytes) {
    throw new Error('MPP: root-stream "Props14" ontbreekt — geen geldig MPP14-bestand');
  }
  const rootProps = new Props(rootProps14Bytes, 'Props14');
  return {
    flagSet: (rootProps.getByte(PASSWORD_FLAG) & 0x1) !== 0,
    hashPresent: rootProps.getByteArray(PROTECTION_PASSWORD_HASH) !== null,
  };
}

/** Weigert MPP8/9/12 (te oud — deze lezer kent alleen MPP14) en wachtwoordbeveiligde bestanden,
 *  met een herkenbare `MppUnsupportedError` (`mppCode`) die de UI naar een vertaalde,
 *  handelingsgerichte melding vertaalt (`formatRegistry.importErrorMessageKey`). Gooit niets voor
 *  een leesbaar, onversleuteld MPP14-bestand. */
export function assertReadable(cfb: CfbFile): void {
  const variant = detectMppVariant(cfb);
  if (variant !== 'MPP14') {
    throw new MppUnsupportedError(
      'MPP_LEGACY',
      `This .mpp uses the older Project 98/2000–2007 file format (${variant}).`,
    );
  }
  const { flagSet, hashPresent } = readPasswordProtection(cfb);
  if (flagSet && hashPresent) {
    throw new MppUnsupportedError('MPP_ENCRYPTED', 'This .mpp is password-protected.');
  }
}
