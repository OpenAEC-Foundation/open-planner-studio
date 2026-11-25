type Counted = Record<string, (...args: unknown[]) => unknown>;
export function arrayAndCollectionOperations<T>(run: () => T): { result: T; operations: number } {
  let operations = 0;
  const restore: Array<() => void> = [];
  const replace = (proto: object, name: string, wrap: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) => {
    const target = proto as Counted, original = target[name];
    target[name] = wrap(original);
    restore.push(() => { target[name] = original; });
  };
  for (const name of ['some', 'every', 'find', 'findIndex', 'findLast', 'findLastIndex', 'filter', 'map', 'flatMap', 'forEach', 'reduce']) {
    replace(Array.prototype, name, original => function (this: unknown, callback: unknown, ...rest: unknown[]) {
      const counted = (...args: unknown[]) => { operations++; return (callback as (...a: unknown[]) => unknown)(...args); };
      return original.call(this, counted, ...rest);
    });
  }
  for (const name of ['indexOf', 'lastIndexOf', 'includes']) {
    replace(Array.prototype, name, original => function (this: unknown[], ...args: unknown[]) {
      operations += this.length;
      return original.apply(this, args);
    });
  }
  for (const [proto, names] of [[Set.prototype, ['has', 'add', 'delete']], [Map.prototype, ['get', 'set', 'has', 'delete']]] as const) {
    for (const name of names) {
      replace(proto, name, original => function (this: unknown, ...args: unknown[]) { operations++; return original.apply(this, args); });
    }
  }
  try { return { result: run(), operations }; }
  finally { for (const undo of restore.reverse()) undo(); }
}
