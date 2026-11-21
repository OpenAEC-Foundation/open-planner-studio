// Zoeken in het instellingenpaneel. Puur (geen React, geen store), zodat
// `tests/planning/check-settings-search.ts` het zonder browser kan toetsen.
//
// Een zoekterm wordt in woorden geknipt; een instelling past als ELK woord ergens in haar teksten
// staat (naam, uitleg, keuzes, zoekwoorden, groepsnaam). Hoofdletters en accenten tellen niet mee,
// zodat "categorie" ook "catégorie" vindt en "Ctrl" ook "ctrl".

/** Kleine letters, zonder accenten, met enkele spaties. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** De losse woorden van een zoekterm; leeg bij een lege of alleen-spaties-term. */
export function searchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized === '' ? [] : normalized.split(' ');
}

/** Past `texts` bij de zoekwoorden? Zonder zoekwoorden past alles. */
export function matchesSearch(texts: readonly string[], terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = normalizeSearchText(texts.join(' '));
  return terms.every(term => haystack.includes(term));
}

/** Zoekwoorden uit een vertaalde lijst ("donker, dark mode, nachtmodus") als losse teksten. */
export function splitKeywords(list: string): string[] {
  return list.split(',').map(word => word.trim()).filter(word => word !== '');
}
