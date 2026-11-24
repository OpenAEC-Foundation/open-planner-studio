export function firstById<T extends { readonly id: string }>(list: readonly T[] | undefined): Map<string, T> {
  const out = new Map<string, T>();
  for (const x of list ?? []) if (!out.has(x.id)) out.set(x.id, x);
  return out;
}
