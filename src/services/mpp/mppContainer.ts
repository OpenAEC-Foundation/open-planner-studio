/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * MPP-containerlaag boven de generieke CFB-lezer (`cfb.ts`): formaatdetectie via het
 * `\x01CompObj`-blok, de generieke `Props`-blokparser (Props.java/Props14.java) en de
 * leesbaarheids-poort (`assertReadable`) die legacy- en versleutelde bestanden er met een
 * herkenbare fout uitfiltert vóórdat T5–T7 ook maar één taak/resource/kalender proberen te lezen.
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
 *  `applicationID` wordt niet gelezen (niets in deze lezer heeft 'm nodig; we stoppen zodra
 *  `fileFormat` binnen is). Grenscontroles: elke read gooit een duidelijke fout zodra de buffer
 *  te kort is (nooit een rauwe RangeError).
 *
 *  T5-uitbreiding: naast `fileFormat` (T4, formaatdetectie) geeft dit nu ook `applicationName`
 *  terug — `detectApplicationVersion` hieronder heeft 'm nodig om de MS-Project-versie te bepalen
 *  (bit-vlag-tabellen voor milestone e.d. verschillen tussen Project ≤2010 en 2013+, zie
 *  `MPP14Reader.java` r. ~1029). Binnen DEZE functie is dat één parse-doorgang (`applicationName`
 *  én `fileFormat` komen uit hetzelfde stuk cursor-voortschrijdende code, i.p.v. twee keer los
 *  door de bytes te lopen).
 *
 *  T5-spec-review-minor (precisering, geen bug): dat is een uitspraak over ÉÉN aanroep van déze
 *  functie, niet over het hele `readMPP`-traject — `assertReadable` (via `detectMppVariant`) en
 *  `detectApplicationVersion` zijn twee LOSSE call-sites die elk hun eigen keer `readCompObjInfo`
 *  aanroepen op dezelfde `\x01CompObj`-bytes, dus het CompObj-blok wordt binnen `readMPP` in de
 *  praktijk tweemaal geparst. Bewust niet samengevoegd tot één gedeelde aanroep: het blok is
 *  triviaal klein (tientallen bytes), de her-parse kost microseconden, en het zou de bestaande,
 *  al-geteste T4-containerlaag-API (`detectMppVariant`/`assertReadable`) moeten laten aanschuiven
 *  voor een puur cosmetische besparing. */
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
    // M3 (kwaliteitsreview): de onderliggende oorzaak (bv. een afgekapt CompObj-blok) blijft
    // beschikbaar via `cause` — handig bij het diagnosticeren van een vreemd-maar-"herkend"
    // bestand, zonder de simpele, gebruikersgerichte boodschap hierboven te verliezen. De
    // 2-argument-`Error`-constructor (`ErrorOptions`) zit in de ES2022-lib; dit project mikt op
    // ES2020 (`tsconfig.json`), dus `cause` wordt hier expliciet ná constructie gezet i.p.v. via
    // de constructor-optie — functioneel identiek, geen lib-bump nodig voor één plek.
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

/** T5-toevoeging: de MS-Project-versie (`CompObj.getApplicationVersion`) — MPP14Reader gebruikt
 *  'm om te kiezen tussen de Project-≤2010- en de 2013+-bit-vlag-tabellen voor o.a. de
 *  milestone-vlag (r. ~1029 e.v.). `null` als het patroon niet matcht (onbekende/geen versie in
 *  `applicationName`) — de aanroeper (`mppReader.ts`'s `milestoneBitFlag`) behandelt `null` dan
 *  als `0` en valt zo terug op de 2010-TABEL, niet de moderne (T5-spec-review, minor — deze regel
 *  zei eerder "modernste tabel", wat niet meer klopte na de 4a-correctie: MPXJ's eigen
 *  `NumberHelper.getInt(null) === 0`, en `0 ≤ PROJECT_2010`). */
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

  // M4 (kwaliteitsreview): geen losse `availableBytes`-teller meer die parallel aan `pos`
  // wordt bijgehouden (en dus uit de pas kon lopen) — `bytes.length - pos` is altijd de
  // brontelling en kan niet divergeren.
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
 *  een plain `number` (PropsKey-waarde) i.p.v. een gesloten enum — T5–T7 kunnen zo vrij nieuwe
 *  PropsKey-constanten gebruiken zonder deze module te hoeven wijzigen. */
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
// PropsKey.java r. 59 — ENCRYPTION_CODE = 893386759 — ter documentatie/volledigheid (net als de
// Java-bron 'm naast PASSWORD_FLAG vermeldt). Bewust GEEN const-declaratie (T5-restpunt c,
// kwaliteitsreview: een `void`-no-op op een ongebruikte const is een omweg — de waarde staat hier
// puur in de commentaartekst): geen enkele afnemer heeft 'm nodig, want de bijbehorende
// XOR-decodering (`DocumentInputStreamFactory`) is bewust niet geport — versleutelde streams
// worden nooit ontcijferd, alleen herkend en geweigerd via `PASSWORD_FLAG`.
/** PropsKey.java r. 77 (`PROTECTION_PASSWORD_HASH`). Samen met `PASSWORD_FLAG` de volledige
 *  afwijscondities hieronder — zie de toelichting bij `readPasswordProtection`. */
const PROTECTION_PASSWORD_HASH = 893386756;

/**
 * Twee poortbevindingen samengevoegd (M1, kwaliteitsreview — tooling toont bij een dubbel
 * docblok alleen het laatste, dus de eerste ging onzichtbaar verloren):
 *
 * 1. WELKE Props-stream (T4, corpus-geverifieerd tegen de drie ground-truth-bestanden):
 *    MPP14Reader.java leest de wachtwoordvlag NIET uit `"   114"/Props` (de ~88 kB
 *    projectproperties-stream — dat is `m_projectProps`, gebruikt voor project-brede
 *    instellingen zoals werkuren/startdatum), maar uit de kleine, aparte ROOT-stream `Props14`
 *    (~0,7–0,8 kB in het corpus). Beide streams bestaan naast elkaar; `PASSWORD_FLAG` komt in de
 *    drie corpusbestanden UITSLUITEND voor in de root-`Props14`-stream (geverifieerd: 21
 *    sleutels, PASSWORD_FLAG aanwezig, waarde 0) — in `"   114"/Props` (261–262 sleutels)
 *    ontbreekt de sleutel volledig, dus `getByte` zou daar altijd stil 0 teruggeven en
 *    versleutelde bestanden nooit herkennen. Deze functie leest daarom bewust de root-stream,
 *    niet de "   114"-stream — een afwijking van de letterlijke planformulering ("de Props-stream
 *    uit storage '   114'"), gemotiveerd door dit corpusonderzoek.
 *
 * 2. VOLLEDIGE afwijsconditie (review-ronde ná T4): MPXJ weigert een MPP14-bestand NIET op de
 *    vlag alleen. MPP14Reader.java's `populateMemberData` (r. ~150-165) test EXPLICIET twee
 *    condities en gooit pas als BEIDE waar zijn:
 *      passwordRequiredToRead = (passwordProtectionFlag & 0x1) != 0
 *      encryptionXmlPresent   = props.getByteArray(PropsKey.PROTECTION_PASSWORD_HASH) != null
 *    De Java-bron documenteert dit met een expliciet voorbeeld: "I've come across an example
 *    where the password flag was set, but the encryption XML was missing. In this case the file
 *    is unencrypted and MS Project opens it without prompting for a password." Een kale
 *    vlag-check zou zulke — reëel voorkomende — bestanden dus onterecht als versleuteld weigeren.
 *    Deze functie spiegelt daarom beide condities.
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
