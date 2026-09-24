/**
 * Gedeelde conventies van de twee XML-uitwisselformaten die OPS zelf schrijft én leest (MSPDI en
 * P6-XML): escaping, het datum-anker en de OPS-eigen round-tripmarkers. De formaat-eigen
 * transportvelden (MSPDI-ExtendedAttribute-FieldID, P6-UDF-titel/-ObjectId) blijven bij hun formaat.
 */
import type { CustomTaskType } from '@/types/taskType';

/** Escapet tekst voor XML-inhoud én attributen (de vijf voorgedefinieerde entiteiten). */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Synthetisch tijdstip dat de DAG-schrijvers op een date-only datum plakken (§7.3); de lezers
 *  herkennen het als "geen echte tijd" (`hasNonAnchorTime`). */
export const DAY_TIME_ANCHOR = '08:00:00';

/** OPS-datum → `xsd:dateTime` zoals MS Project en P6 hem verwachten (`2026-03-09T08:00:00`): een
 *  date-only datum krijgt het anker, een uur-instant (`YYYY-MM-DDTHH:mm`) seconden; '' blijft ''. */
export function toXmlDateTime(iso: string): string {
  if (!iso) return '';
  if (iso.length === 10) return `${iso}T${DAY_TIME_ANCHOR}`;
  if (iso.length === 16) return `${iso}:00`;
  return iso;
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
