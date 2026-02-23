import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { locale as getOsLocale } from '@tauri-apps/plugin-os';
import { syncSettingToLocalStorage } from '@/utils/settingsStore';

// --- Eager-import every namespace for every locale ---
import nlCommon from './locales/nl/common.json';
import nlTask from './locales/nl/task.json';
import nlReport from './locales/nl/report.json';
import nlMenu from './locales/nl/menu.json';

import enCommon from './locales/en/common.json';
import enTask from './locales/en/task.json';
import enReport from './locales/en/report.json';
import enMenu from './locales/en/menu.json';

import frCommon from './locales/fr/common.json';
import frTask from './locales/fr/task.json';
import frReport from './locales/fr/report.json';
import frMenu from './locales/fr/menu.json';

import deCommon from './locales/de/common.json';
import deTask from './locales/de/task.json';
import deReport from './locales/de/report.json';
import deMenu from './locales/de/menu.json';

import esCommon from './locales/es/common.json';
import esTask from './locales/es/task.json';
import esReport from './locales/es/report.json';
import esMenu from './locales/es/menu.json';

import zhCommon from './locales/zh/common.json';
import zhTask from './locales/zh/task.json';
import zhReport from './locales/zh/report.json';
import zhMenu from './locales/zh/menu.json';

import itCommon from './locales/it/common.json';
import itTask from './locales/it/task.json';
import itReport from './locales/it/report.json';
import itMenu from './locales/it/menu.json';

import ptCommon from './locales/pt/common.json';
import ptTask from './locales/pt/task.json';
import ptReport from './locales/pt/report.json';
import ptMenu from './locales/pt/menu.json';

import plCommon from './locales/pl/common.json';
import plTask from './locales/pl/task.json';
import plReport from './locales/pl/report.json';
import plMenu from './locales/pl/menu.json';

import trCommon from './locales/tr/common.json';
import trTask from './locales/tr/task.json';
import trReport from './locales/tr/report.json';
import trMenu from './locales/tr/menu.json';

import arCommon from './locales/ar/common.json';
import arTask from './locales/ar/task.json';
import arReport from './locales/ar/report.json';
import arMenu from './locales/ar/menu.json';

import jaCommon from './locales/ja/common.json';
import jaTask from './locales/ja/task.json';
import jaReport from './locales/ja/report.json';
import jaMenu from './locales/ja/menu.json';

import koCommon from './locales/ko/common.json';
import koTask from './locales/ko/task.json';
import koReport from './locales/ko/report.json';
import koMenu from './locales/ko/menu.json';

import faCommon from './locales/fa/common.json';
import faTask from './locales/fa/task.json';
import faReport from './locales/fa/report.json';
import faMenu from './locales/fa/menu.json';

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
  nl: { common: nlCommon, task: nlTask, report: nlReport, menu: nlMenu },
  en: { common: enCommon, task: enTask, report: enReport, menu: enMenu },
  fr: { common: frCommon, task: frTask, report: frReport, menu: frMenu },
  de: { common: deCommon, task: deTask, report: deReport, menu: deMenu },
  es: { common: esCommon, task: esTask, report: esReport, menu: esMenu },
  zh: { common: zhCommon, task: zhTask, report: zhReport, menu: zhMenu },
  it: { common: itCommon, task: itTask, report: itReport, menu: itMenu },
  pt: { common: ptCommon, task: ptTask, report: ptReport, menu: ptMenu },
  pl: { common: plCommon, task: plTask, report: plReport, menu: plMenu },
  tr: { common: trCommon, task: trTask, report: trReport, menu: trMenu },
  ar: { common: arCommon, task: arTask, report: arReport, menu: arMenu },
  ja: { common: jaCommon, task: jaTask, report: jaReport, menu: jaMenu },
  ko: { common: koCommon, task: koTask, report: koReport, menu: koMenu },
  fa: { common: faCommon, task: faTask, report: faReport, menu: faMenu },
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
    if (saved !== i18n.language) await i18n.changeLanguage(saved);
    return;
  }

  // No saved preference — detect from OS
  try {
    const osLocale = await getOsLocale();
    if (osLocale) {
      const lang = osLocale.split('-')[0].toLowerCase() as Locale;
      if (supportedLanguages.includes(lang)) {
        await i18n.changeLanguage(lang);
        return;
      }
    }
  } catch {
    // OS plugin unavailable (e.g. running in browser), fall through to default
  }
}

export default i18n;
