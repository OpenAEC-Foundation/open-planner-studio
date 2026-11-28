export const CAPACITY_EPS = 1e-9;

export function exceedsCapacity(load: number, capacity: number): boolean {
  return load > capacity + CAPACITY_EPS;
}
