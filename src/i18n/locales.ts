export const LOCALES = [
  'nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa',
  'ru', 'uk', 'cs', 'sk', 'sr', 'hr', 'bg', 'hu', 'ro', 'sv', 'nb', 'da', 'fi', 'lo',
] as const;
export type Locale = typeof LOCALES[number];

export const RTL_LOCALES: Locale[] = ['ar', 'fa'];

export function localeDirection(lng: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(lng.split('-')[0] as Locale) ? 'rtl' : 'ltr';
}
