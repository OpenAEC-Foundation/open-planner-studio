import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { syncSettingToLocalStorage } from '@/utils/settingsStore';

// --- Alleen de fallback-taal (en) wordt eager geïmporteerd. De overige 13 talen
// laden lazy via loadLocale() (Vite splitst per taal een eigen async chunk). ---
import enCommon from './locales/en/common.json';
import enTask from './locales/en/task.json';
import enReport from './locales/en/report.json';
import enMenu from './locales/en/menu.json';

export type Locale =
  | 'nl' | 'en' | 'fr' | 'de' | 'es' | 'zh'
  | 'it' | 'pt' | 'pl' | 'tr' | 'ar' | 'ja' | 'ko' | 'fa';

export const RTL_LOCALES: Locale[] = ['ar', 'fa'];

export const LANGUAGE_LABELS: Record<Locale, [string, string]> = {
  nl: ['NL', 'Nederlands'],
  en: ['EN', 'English'],
  fr: ['FR', 'Français'],
  de: ['DE', 'Deutsch'],
  es: ['ES', 'Español'],
  zh: ['ZH', '中文'],
  it: ['IT', 'Italiano'],
  pt: ['PT', 'Português'],
  pl: ['PL', 'Polski'],
  tr: ['TR', 'Türkçe'],
  ar: ['AR', 'العربية'],
  ja: ['JA', '日本語'],
  ko: ['KO', '한국어'],
  fa: ['FA', 'فارسی'],
};

export const supportedLanguages = Object.keys(LANGUAGE_LABELS) as Locale[];

const resources = {
  en: { common: enCommon, task: enTask, report: enReport, menu: enMenu },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default, overridden by initLocale()
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    load: 'languageOnly',
    ns: ['common', 'task', 'report', 'menu'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// Set document direction on language change (RTL support)
function updateDirection(lng: string) {
  const locale = lng as Locale;
  document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}
updateDirection(i18n.language);
i18n.on('languageChanged', updateDirection);

const loadedLocales = new Set<Locale>(['en']);

/** Laad de 4 namespaces van een taal lazy (Vite splitst per taal een eigen chunk) en
 *  registreer ze bij i18next. Idempotent; 'en' is al eager geladen. */
export async function loadLocale(lng: Locale): Promise<void> {
  if (loadedLocales.has(lng)) return;
  const [common, task, report, menu] = await Promise.all([
    import(`./locales/${lng}/common.json`),
    import(`./locales/${lng}/task.json`),
    import(`./locales/${lng}/report.json`),
    import(`./locales/${lng}/menu.json`),
  ]);
  i18n.addResourceBundle(lng, 'common', common.default);
  i18n.addResourceBundle(lng, 'task', task.default);
  i18n.addResourceBundle(lng, 'report', report.default);
  i18n.addResourceBundle(lng, 'menu', menu.default);
  loadedLocales.add(lng);
}

/** Wissel van taal: eerst de resources laden (geen kale keys), dan pas wisselen. */
export async function setLocale(lng: Locale): Promise<void> {
  await loadLocale(lng);
  await i18n.changeLanguage(lng);
}

/**
 * Detect the best locale at startup:
 * 1. Saved preference in Tauri Store / localStorage
 * 2. OS locale via Tauri OS plugin
 * 3. Fallback to 'en'
 */
export async function initLocale(): Promise<void> {
  // Try saved preference first
  await syncSettingToLocalStorage('locale', 'ops-locale');
  const saved = localStorage.getItem('ops-locale');
  if (saved && supportedLanguages.includes(saved as Locale)) {
    if (saved !== i18n.language) {
      await loadLocale(saved as Locale);
      await i18n.changeLanguage(saved);
    }
    return;
  }

  // No saved preference — detect from browser/OS
  const browserLang = navigator.language?.split('-')[0]?.toLowerCase() as Locale;
  if (browserLang && supportedLanguages.includes(browserLang)) {
    await loadLocale(browserLang);
    await i18n.changeLanguage(browserLang);
    return;
  }
}

export default i18n;
