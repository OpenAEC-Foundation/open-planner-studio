export function snapToChoice(allowed: readonly number[], raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  if (allowed.length === 0) return undefined;
  return allowed.reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best), allowed[0]);
}
