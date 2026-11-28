const g = globalThis as unknown as Record<string, unknown>;
if (!g.document) g.document = { documentElement: {} };
if (!g.getComputedStyle) g.getComputedStyle = () => ({ getPropertyValue: () => '' });

if (!g.localStorage) {
  const mem = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
}
