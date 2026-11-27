export function nameWithProjectCode(name: string | null | undefined, id: string | null | undefined): string {
  const n = (name ?? '').trim();
  const code = (id ?? '').trim();
  if (!n) return code;
  if (!code || n === code || n.endsWith(` (${code})`)) return n;
  return `${n} (${code})`;
}
