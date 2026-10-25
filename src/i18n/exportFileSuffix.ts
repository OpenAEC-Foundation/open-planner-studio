import i18next from 'i18next';
import enMenu from './locales/en/menu.json';

/** Geen UI-config laden: ook de headless store mag exportnamen voorstellen. */
export function exportFileSuffix(kind: 'progress' | 'library'): string {
  const key = kind === 'progress' ? 'export.progressFileSuffix' : 'export.libraryFileSuffix';
  const fallback = kind === 'progress' ? enMenu.export.progressFileSuffix : enMenu.export.libraryFileSuffix;
  return i18next.isInitialized ? i18next.t(key, { ns: 'menu', defaultValue: fallback }) : fallback;
}
