import { FIELD_CAP, TRUNCATE_MARKER } from '@/services/mcp/activityLog';

/** Vervang alleen onze aangeplakte marker, nooit een woord in de technische inhoud. */
export function activityFieldText(value: string, truncatedLabel: string): string {
  return value.length === FIELD_CAP + TRUNCATE_MARKER.length && value.endsWith(TRUNCATE_MARKER)
    ? value.slice(0, FIELD_CAP) + truncatedLabel
    : value;
}
