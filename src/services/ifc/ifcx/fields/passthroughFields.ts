import { enumOf, type IfcxField, type IfcxMember, type IfcxValue } from '../fieldTable';

export function enumOfTable<T extends string>(table: Readonly<Record<T, true>>): IfcxValue {
  return enumOf(Object.keys(table));
}

export function required(value: IfcxValue): IfcxMember {
  return { value };
}

export function optional(value: IfcxValue): IfcxMember {
  return { value, optional: true };
}

export function copyAs(spec: IfcxValue, value: unknown): unknown {
  if (spec.dataType === 'Array') return (value as readonly unknown[]).map(item => copyAs(spec.item, item));
  if (spec.dataType !== 'Object') return value;
  const source = value as Readonly<Record<string, unknown>>;
  const out: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(spec.members)) {
    if (source[key] !== undefined) out[key] = copyAs(member.value, source[key]);
  }
  return out;
}

export function passthroughField<W, R, V>(
  key: string, value: IfcxValue, get: (source: W) => V | undefined, set: (target: R, value: V) => void,
): IfcxField<W, R> {
  return {
    key, value, optional: true,
    write: source => {
      const current = get(source);
      return current === undefined ? undefined : copyAs(value, current);
    },
    read: (stored, target) => { if (stored !== undefined) set(target, copyAs(value, stored) as V); },
  };
}
