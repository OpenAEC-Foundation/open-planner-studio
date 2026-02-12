let counter = 0;

export function generateId(prefix = ''): string {
  counter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return prefix ? `${prefix}-${ts}${rand}${counter}` : `${ts}${rand}${counter}`;
}
