export function storedWorkDeviates(storedMinutes: number, derivedMinutes: number): boolean {
  return Math.abs(storedMinutes - derivedMinutes) > Math.max(1, 0.01 * Math.max(storedMinutes, derivedMinutes));
}
