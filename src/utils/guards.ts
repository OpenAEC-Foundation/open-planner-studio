/**
 * Runtime-typeguards voor onvertrouwde invoer (JSON, MCP-argumenten, extensiemanifesten,
 * klembord). Bladmodule: importeert niets, zodat engine, state en services hem vrij kunnen delen.
 */

/** Een gewoon object-achtig record: geen `null`, geen array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Eigen (niet-geërfde) sleutel — veilig tegen `hasOwnProperty`-schaduwing in de invoer. */
export function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Heeft de waarde een aanroepbare `then`? (Promise of een andere thenable.) */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
    ? typeof (value as { then?: unknown }).then === 'function'
    : false;
}
