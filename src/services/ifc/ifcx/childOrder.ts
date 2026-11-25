export function childrenInPlace<T>(entryOrder: readonly T[], placeOf: (child: T) => number | undefined): T[] {
  const placed: (T | undefined)[] = new Array(entryOrder.length);
  const late: { child: T; place: number }[] = [];
  const free: T[] = [];
  for (const child of entryOrder) {
    const place = placeOf(child);
    if (place === undefined) free.push(child);
    else if (place < placed.length && placed[place] === undefined) placed[place] = child;
    else late.push({ child, place });
  }
  const out: T[] = [];
  let next = 0;
  for (const slot of placed) {
    if (slot !== undefined) out.push(slot);
    else if (next < free.length) out.push(free[next++]);
  }
  out.push(...free.slice(next));
  late.sort((a, b) => a.place - b.place);
  out.push(...late.map(entry => entry.child));
  return out;
}

export function placesNeededForOrder(entryOrder: readonly string[], wanted: readonly string[]): Map<string, number> | undefined {
  const position = new Map(wanted.map((id, index) => [id, index]));
  if (position.size !== wanted.length || entryOrder.length !== wanted.length) return undefined;
  const positions: number[] = [];
  for (const id of entryOrder) {
    const at = position.get(id);
    if (at === undefined) return undefined;
    positions.push(at);
  }
  const keep = longestIncreasingRun(positions);
  const places = new Map<string, number>();
  entryOrder.forEach((id, index) => { if (!keep.has(index)) places.set(id, positions[index]); });
  return places;
}

function longestIncreasingRun(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const previous: number[] = new Array(values.length).fill(-1);
  for (let i = 0; i < values.length; i++) {
    let low = 0, high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (values[tails[mid]] < values[i]) low = mid + 1; else high = mid;
    }
    if (low > 0) previous[i] = tails[low - 1];
    tails[low] = i;
  }
  const keep = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = previous[i]) keep.add(i);
  return keep;
}
