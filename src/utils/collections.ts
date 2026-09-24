/**
 * Groepeer `items` op `keyOf`, met behoud van de invoervolgorde binnen elke groep én van de volgorde
 * waarin sleutels voor het eerst voorkomen (Map-iteratievolgorde).
 */
export function groupBy<T, K>(items: Iterable<T>, keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
