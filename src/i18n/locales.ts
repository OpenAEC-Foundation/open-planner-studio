// Contract C4 van de vertaalstraat: de ene lijst met UI-talen, zonder i18next. `config.ts` (de app),
// `utils/helpManifest.ts` (de Help-viewer), `scripts/i18n-tools.ts` en `scripts/verify-docs.ts`
// halen de talen hier vandaan, zodat er geen tweede lijst kan wegdrijven. Puur en zonder `@/`-imports:
// scripts laden dit bestand ook buiten de Vite-alias.

/** De 27 UI-talen, in vaste volgorde (nl is de bron, en de terugval). */
export const LOCALES = [
  'nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa',
  'ru', 'uk', 'cs', 'sk', 'sr', 'hr', 'bg', 'hu', 'ro', 'sv', 'nb', 'da', 'fi',
] as const;
export type Locale = typeof LOCALES[number];

/** Talen die van rechts naar links lopen. */
export const RTL_LOCALES: Locale[] = ['ar', 'fa'];

/** Schrijfrichting van taal `lng` (een taalcode als `ar` of `ar-EG`): `rtl` voor ar/fa. Bron voor
 *  `<html dir>` (config.ts), voor wie tijdens het renderen al moet weten dat de shell gespiegeld is,
 *  en voor de richting van een Help-artikel (die volgt de taal van de getoonde tekst). */
export function localeDirection(lng: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(lng.split('-')[0] as Locale) ? 'rtl' : 'ltr';
}
