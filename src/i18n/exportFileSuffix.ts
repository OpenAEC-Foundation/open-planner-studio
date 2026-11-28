import i18next from 'i18next';

export function exportFileSuffix(kind: 'progress' | 'library'): string {
  const key = kind === 'progress' ? 'export.progressFileSuffix' : 'export.libraryFileSuffix';
  return i18next.isInitialized ? i18next.t(key, { ns: 'menu', defaultValue: kind }) : kind;
}
