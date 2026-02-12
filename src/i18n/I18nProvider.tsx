import { useState, useCallback, useMemo, ReactNode } from 'react';
import { I18nContext, Locale, getTranslation, getStoredLocale } from './i18n';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('ops-locale', newLocale);
  }, []);

  const t = useCallback(
    (key: string, ...args: (string | number)[]) => getTranslation(locale, key, ...args),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
