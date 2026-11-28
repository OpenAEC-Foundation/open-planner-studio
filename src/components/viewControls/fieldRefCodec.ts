import type { FieldRef } from '@/types/view';

export function encodeFieldRef(f: FieldRef): string {
  return JSON.stringify(f);
}

export function decodeFieldRef(s: string): FieldRef {
  return JSON.parse(s) as FieldRef;
}
