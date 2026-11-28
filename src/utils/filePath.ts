export function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function ensureExtension(path: string, ext: string): string {
  return withOneOfExtensions(path, [ext]);
}

export function withOneOfExtensions(path: string, extensions: readonly string[]): string {
  const lower = path.toLowerCase();
  if (extensions.length === 0 || extensions.some(ext => lower.endsWith(`.${ext.toLowerCase()}`))) return path;
  return `${path}.${extensions[0]}`;
}

export function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function isIfcxName(name: string | null | undefined): boolean {
  return !!name && /\.ifcx$/i.test(name);
}
