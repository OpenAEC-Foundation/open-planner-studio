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

export function invertRecord<K extends PropertyKey, V extends PropertyKey>(record: Readonly<Record<K, V>>): Record<V, K> {
  const inverse = Object.create(null) as Record<V, K>;
  for (const key of Object.keys(record) as K[]) inverse[record[key]] = key;
  return inverse;
}

export function minOf(values: Iterable<number>): number {
  let min = Infinity;
  for (const value of values) {
    if (Number.isNaN(value)) return NaN;
    if (value < min || (value === 0 && min === 0 && Object.is(value, -0))) min = value;
  }
  return min;
}

export function maxOf(values: Iterable<number>): number {
  let max = -Infinity;
  for (const value of values) {
    if (Number.isNaN(value)) return NaN;
    if (value > max || (value === 0 && max === 0 && Object.is(max, -0))) max = value;
  }
  return max;
}
