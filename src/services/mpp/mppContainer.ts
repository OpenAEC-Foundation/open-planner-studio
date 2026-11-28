// Bron: MPXJ van Jon Iles e.a., structuurkennis en veldconstanten geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).
import type { CfbFile } from './cfb';
import { getInt, getShort } from './mppPrimitives';
import { MppUnsupportedError } from './errors';

export type MppVariant = 'MPP8' | 'MPP9' | 'MPP12' | 'MPP14';

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
    return { applicationName, fileFormat: null };
  }
  const formatLength = readInt32();
  if (formatLength <= 0) return { applicationName, fileFormat: null };
  return { applicationName, fileFormat: readAsciiMinusTerminator(formatLength) };
}

export function detectMppVariant(cfb: CfbFile): MppVariant {
  const compObjBytes = cfb.getStream(['\x01CompObj']);
  if (!compObjBytes) {
    throw new Error('Not a recognised MS Project MPP file');
  }
  let fileFormat: string | null;
  try {
    fileFormat = readCompObjInfo(compObjBytes).fileFormat;
  } catch (err) {
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

const APPLICATION_VERSION_PATTERN = /Microsoft.Project.(\d+).0/;

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

const PROPS14_HEADER_SIZE = 16;

function parsePropsBytes(bytes: Uint8Array, label: string): Map<number, Uint8Array> {
  const ctx = `Props[${label}]`;
  const map = new Map<number, Uint8Array>();
  if (bytes.length < PROPS14_HEADER_SIZE) {
    throw new Error(`MPP: Props[${label}] te klein voor header (${bytes.length} bytes, minimaal ${PROPS14_HEADER_SIZE})`);
  }
  const headerCount = getShort(bytes, 12, ctx);
  let pos = PROPS14_HEADER_SIZE;
  let found = 0;

  while (found < headerCount) {
    if (bytes.length - pos < 12) break;
    const length = getInt(bytes, pos, ctx);
    const key = getInt(bytes, pos + 4, ctx);
    pos += 12;

    if (bytes.length - pos < length || length < 1) break;
    const data = bytes.subarray(pos, pos + length);
    pos += length;

    map.set(key, data);
    found++;

    if (data.length % 2 !== 0) pos += 1;
  }
  return map;
}

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

const PASSWORD_FLAG = 893386752;
const PROTECTION_PASSWORD_HASH = 893386756;

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
