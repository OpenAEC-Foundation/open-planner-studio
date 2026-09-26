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

/** Keer een 1-op-1 codetabel om (waarde → sleutel), zodat een lezer en schrijver één tabel delen en
 *  niet kunnen divergeren. Bij dubbele waarden wint de laatste sleutel. Het resultaat heeft GEEN
 *  prototype: een lezer die er onvertrouwde bestandsinhoud in opzoekt (`constructor`, `__proto__`)
 *  krijgt `undefined`, nooit een geërfde eigenschap. */
export function invertRecord<K extends PropertyKey, V extends PropertyKey>(record: Readonly<Record<K, V>>): Record<V, K> {
  const inverse = Object.create(null) as Record<V, K>;
  for (const key of Object.keys(record) as K[]) inverse[record[key]] = key;
  return inverse;
}

/**
 * `Math.min(...values)` zonder spread: een spread zet elk element als losse functieparameter op de
 * stack en gooit vanaf ~125k elementen `RangeError: Maximum call stack size exceeded` (bv. de kinderen
 * van één samenvatting of de outline-niveaus van een grote import — audit 2026-09-26). Zelfde
 * uitkomst als `Math.min`: leeg ⇒ `Infinity`, een `NaN` ⇒ `NaN`.
 */
export function minOf(values: Iterable<number>): number {
  let min = Infinity;
  for (const value of values) {
    if (Number.isNaN(value)) return NaN;
    if (value < min || (value === 0 && min === 0 && Object.is(value, -0))) min = value;
  }
  return min;
}

/** `Math.max(...values)` zonder spread (zie `minOf`): leeg ⇒ `-Infinity`, een `NaN` ⇒ `NaN`. */
export function maxOf(values: Iterable<number>): number {
  let max = -Infinity;
  for (const value of values) {
    if (Number.isNaN(value)) return NaN;
    if (value > max || (value === 0 && max === 0 && Object.is(max, -0))) max = value;
  }
  return max;
}
