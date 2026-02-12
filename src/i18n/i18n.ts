import { createContext, useContext } from 'react';
import { nl } from './nl';
import { en } from './en';
import { fr } from './fr';
import { de } from './de';
import { es } from './es';
import { zh } from './zh';

export type Locale = 'nl' | 'en' | 'fr' | 'de' | 'es' | 'zh';

const translations: Record<Locale, Record<string, string>> = { nl, en, fr, de, es, zh };

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

export const I18nContext = createContext<I18nContextType>({
  locale: 'nl',
  setLocale: () => {},
  t: (key: string) => key,
});

export function useI18n(): I18nContextType {
  return useContext(I18nContext);
}

export function getTranslation(locale: Locale, key: string, ...args: (string | number)[]): string {
  const dict = translations[locale];
  let val = dict[key] ?? translations['nl'][key] ?? key;
  for (let i = 0; i < args.length; i++) {
    val = val.replace(`{${i}}`, String(args[i]));
  }
  return val;
}

export function getStoredLocale(): Locale {
  const stored = localStorage.getItem('ops-locale');
  if (stored && stored in translations) return stored as Locale;
  return 'nl';
}
