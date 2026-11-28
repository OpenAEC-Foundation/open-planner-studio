import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readLocal, syncSettingToLocalStorage } from '@/utils/settingsStore';
import { runsEmbedded, siteLanguageHints } from '@/services/fileAccess/siteHost';
import { LOCALES, RTL_LOCALES, localeDirection, type Locale } from './locales';

import enCommon from './locales/en/common.json';
import enTask from './locales/en/task.json';
import enReport from './locales/en/report.json';
import enMenu from './locales/en/menu.json';

export { LOCALES, RTL_LOCALES, localeDirection, type Locale };

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
  lo: ['LO', 'ລາວ'],
  fa: ['FA', 'فارسی'],
  ru: ['RU', 'Русский'],
  uk: ['UK', 'Українська'],
  cs: ['CS', 'Čeština'],
  sk: ['SK', 'Slovenčina'],
  sr: ['SR', 'Српски'],
  hr: ['HR', 'Hrvatski'],
  bg: ['BG', 'Български'],
  hu: ['HU', 'Magyar'],
  ro: ['RO', 'Română'],
  sv: ['SV', 'Svenska'],
  nb: ['NB', 'Norsk bokmål'],
  da: ['DA', 'Dansk'],
  fi: ['FI', 'Suomi'],
};

const BROWSER_LANGUAGE_ALIASES: Record<string, Locale> = { no: 'nb', nn: 'nb' };

export function localeFromBrowserLanguage(tag: string | undefined): Locale | null {
  const base = tag?.split('-')[0]?.toLowerCase();
  if (!base) return null;
  const lng = BROWSER_LANGUAGE_ALIASES[base] ?? base;
  return supportedLanguages.includes(lng as Locale) ? (lng as Locale) : null;
}

export const supportedLanguages: Locale[] = [...LOCALES];

const resources = {
  en: { common: enCommon, task: enTask, report: enReport, menu: enMenu },
};

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    load: 'languageOnly',
    ns: ['common', 'task', 'report', 'menu'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

function updateDirection(lng: string) {
  document.documentElement.dir = localeDirection(lng);
  document.documentElement.lang = lng;
}
updateDirection(i18n.language);
i18n.on('languageChanged', updateDirection);

const loadedLocales = new Set<Locale>(['en']);

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

export async function setLocale(lng: Locale): Promise<void> {
  await loadLocale(lng);
  await i18n.changeLanguage(lng);
}

export function embeddedLocale(): Locale | null {
  if (!runsEmbedded()) return null;
  for (const hint of siteLanguageHints()) {
    const lng = localeFromBrowserLanguage(hint);
    if (lng) return lng;
  }
  return null;
}

export async function initLocale(): Promise<void> {
  const hostLang = embeddedLocale();
  if (hostLang) {
    if (hostLang !== i18n.language) await setLocale(hostLang);
    return;
  }
  await syncSettingToLocalStorage('locale', 'ops-locale');
  const saved = readLocal('ops-locale');
  if (saved && supportedLanguages.includes(saved as Locale)) {
    if (saved !== i18n.language) {
      await loadLocale(saved as Locale);
      await i18n.changeLanguage(saved);
    }
    return;
  }

  const browserLang = localeFromBrowserLanguage(navigator.language);
  if (browserLang) {
    await loadLocale(browserLang);
    await i18n.changeLanguage(browserLang);
    return;
  }
}

export default i18n;
