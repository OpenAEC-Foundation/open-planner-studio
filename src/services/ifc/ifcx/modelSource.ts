import { precomputeSha256 } from '@/services/xerSourceArchive';
import { hasOwn, isRecord } from '@/utils/guards';
import { IFC_BUILDING_MODEL_TYPES } from '../ifcBuildingModelTypes';
import { IfcxReadError } from './ifcxErrors';
import { IFCX_VERSION } from './profile';

interface ModelElement {
  readonly ifcClass: string;
  readonly name?: string;
}

interface ModelSource {
  readonly sha256: string;
  readonly header: { readonly id?: string; readonly author?: string };
  readonly elements: ReadonlyMap<string, ModelElement>;
}

const CLASS = 'bsi::ifc::class';
const NAME_FIELDS = ['bsi::ifc::prop::Name', 'bsi::ifc::prop::TypeName', 'openaec::label'];
const ELEMENT_FIELDS = [CLASS, ...NAME_FIELDS];

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new IfcxReadError('not-ifcx', 'Het bestand is geen UTF-8-tekst');
  }
}

function modelElements(data: readonly unknown[]): ReadonlyMap<string, ModelElement> {
  const local = new Map<string, Record<string, unknown>>();
  for (const entry of data) {
    if (!isRecord(entry) || typeof entry.path !== 'string') {
      throw new IfcxReadError('invalid', 'Een IFCX-bijdrage heeft geen pad');
    }
    const { path, attributes } = entry;
    if (attributes === undefined) continue;
    if (!isRecord(attributes)) throw new IfcxReadError('invalid', 'De IFCX-attributen zijn geen object', { path });
    for (const field of ELEMENT_FIELDS) {
      if (!hasOwn(attributes, field)) continue;
      const values = local.get(path) ?? {};
      values[field] = attributes[field];
      local.set(path, values);
    }
  }

  const elements = new Map<string, ModelElement>();
  for (const [path, values] of local) {
    const classification = values[CLASS];
    const code = isRecord(classification) ? classification.code : undefined;
    if (typeof code !== 'string' || !IFC_BUILDING_MODEL_TYPES.has(code.toUpperCase())) continue;
    const name = NAME_FIELDS.map(field => values[field]).find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
    elements.set(path, name === undefined ? { ifcClass: code } : { ifcClass: code, name });
  }
  return elements;
}

export async function readIfcxModelSource(bytes: Uint8Array): Promise<ModelSource> {
  const digest = precomputeSha256(bytes.subarray());
  const text = decodeUtf8(bytes);
  const sha256 = await digest;
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new IfcxReadError('not-ifcx', 'Het bestand is geen JSON');
  }
  if (!isRecord(document) || !isRecord(document.header) || typeof document.header.ifcxVersion !== 'string'
    || !Array.isArray(document.data)) {
    throw new IfcxReadError('not-ifcx', 'Het bestand heeft geen IFCX-kop en -data');
  }
  const { ifcxVersion, id, author } = document.header;
  if (ifcxVersion !== IFCX_VERSION) throw new IfcxReadError('version', `Onbekende IFCX-versie ${JSON.stringify(ifcxVersion)}`);
  return {
    sha256,
    header: { ...(typeof id === 'string' && { id }), ...(typeof author === 'string' && { author }) },
    elements: modelElements(document.data),
  };
}
