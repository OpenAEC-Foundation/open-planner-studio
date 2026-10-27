import i18next from 'i18next';

/** Geen UI-config laden: ook de headless store mag exportnamen voorstellen. */
export function exportFileSuffix(kind: 'progress' | 'library'): string {
  const key = kind === 'progress' ? 'export.progressFileSuffix' : 'export.libraryFileSuffix';
  // De twee technische soortnamen zijn tevens de Engelse headless-terugval. Geen locale-JSON
  // importeren: die hoort niet in de zelfstandige kern/MCP-bundel. De UI gebruikt de sleutel.
  return i18next.isInitialized ? i18next.t(key, { ns: 'menu', defaultValue: kind }) : kind;
}
