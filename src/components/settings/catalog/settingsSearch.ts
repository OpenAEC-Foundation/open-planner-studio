export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized === '' ? [] : normalized.split(' ');
}

export function matchesSearch(texts: readonly string[], terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = normalizeSearchText(texts.join(' '));
  return terms.every(term => haystack.includes(term));
}

export function splitKeywords(list: string): string[] {
  return list.split(',').map(word => word.trim()).filter(word => word !== '');
}
