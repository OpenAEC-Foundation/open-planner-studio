const g = globalThis as unknown as { document?: unknown };
if (!g.document) {
  g.document = { documentElement: {} };
}

export {};
