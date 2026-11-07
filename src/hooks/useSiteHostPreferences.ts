import { useEffect } from 'react';
import type { UIState } from '@/state/slices/types';
import { useAppStore } from '@/state/appStore';
import { createDefaultUI } from '@/state/slices/uiSlice';
import i18n, { embeddedLocale, initLocale, setLocale } from '@/i18n/config';
import { SITE_HOST_READY_EVENT, candidateHosts, siteHostWindows } from '@/services/fileAccess/siteHost';
import { SITE_HOST_PREFERENCES_EVENT, siteHostTheme } from '@/services/fileAccess/siteHostPreferences';
import {
  adoptLateSiteHostSettings, onSiteHostSettingsEvent, releaseLateSiteHostSettings, settleLateSiteHostSettings,
  siteHostSettingsDelayed, siteHostSettingsUnavailable, takeLateSiteHostSettings, type LateSettingsApplied,
} from '@/services/fileAccess/siteHostSettings';
import { loadAllSettings, settingFieldsByStorageKey } from '@/utils/settingsRegistry';

/** Instellingen die pas na de start binnenkwamen en nu in `localStorage` staan (`siteHostSettings.ts`).
 *  `keys`: de sleutels die opnieuw moeten (`LateSettingsApplied.refresh`). Voor wat buiten de
 *  store-velden valt, zoals de taakgrid; de app wacht tot de belofte klaar is. */
export type LateSettingsHandler = (keys: ReadonlySet<string>) => Promise<void> | void;

/** De randen van de late toepassing. In de app de echte; de headless check geeft eigen mee. */
export interface LateSettingsDeps {
  take(): LateSettingsApplied | null;
  settle(keys: Iterable<string>): void;
  release(): void;
  initLocale(): Promise<void>;
  language(): string;
}

const SITE_DEPS: LateSettingsDeps = {
  take: takeLateSiteHostSettings,
  settle: settleLateSiteHostSettings,
  release: releaseLateSiteHostSettings,
  initLocale,
  language: () => i18n.language,
};

const TASK_GRID_KEY = 'ops-taskGridPreferences';
const LOCALE_KEY = 'ops-locale';

/** Eén keer per sessie: ook bij een tweede mount (StrictMode) niet opnieuw. */
let unavailableNoticeShown = false;
function noticeIfSettingsUnavailable(): void {
  if (unavailableNoticeShown || !siteHostSettingsUnavailable()) return;
  unavailableNoticeShown = true;
  useAppStore.getState().notify({
    severity: 'info', messageKey: 'notifications.hostSettingsUnavailable', dedupeKey: 'host-settings-unavailable', sticky: true,
  });
}

let delayDialogShown = false;
function showDelayDialogOnce(): void {
  if (delayDialogShown || !siteHostSettingsDelayed()) return;
  delayDialogShown = true;
  useAppStore.getState().setUI({ showSettingsDelayDialog: true });
}

const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Pas een laat antwoord live toe, zoals een gewone start het zou laden, en meld het. Doet niets als er
 * geen laat antwoord klaarstaat.
 *
 * Opnieuw toegepast wordt elke sleutel uit `refresh`: wat veranderde, en wat de gebruiker wijzigde. Ook
 * een gelijke opgeslagen waarde, want bij thema en taal gaan host en devlink voor (`initTheme` via
 * `loadAllSettings`, en `initLocale`). Een store-veld waarvan de sleutel nu ontbreekt, krijgt de
 * standaard van de store. Componenten en modules met een eigen kopie verversen via het `StorageEvent`
 * dat `siteHostSettings.ts` per sleutel stuurde.
 *
 * Volgorde: de store-velden, dan de taakgrid (`onLate`), dan pas de taal. De taal kan een download
 * kosten; dan staat de taakgrid al goed en is zijn oude scrolltimer gestopt. Elke sleutel gaat vrij
 * (`settle`) zodra zijn kopie klopt; tot dan slaat `writeLocal` een schrijfactie van de gebruiker erop
 * over. Aan het eind gaat het bewaren aan (`release`), ook na een fout, en pas daarna de melding.
 *
 * Grens: de bouwmodus bepaalt de kalender van het eerste document bij het maken van de store. Een laat
 * antwoord verandert die kalender niet meer; het geldt pas voor een volgend nieuw document.
 */
export async function processLateSettings(
  setUI: (patch: Partial<UIState>) => void, onLate?: LateSettingsHandler, deps: LateSettingsDeps = SITE_DEPS,
): Promise<void> {
  const applied = deps.take();
  if (!applied) return;
  // De belofte van de pop-up is ingelost: dicht.
  if (useAppStore.getState().ui.showSettingsDelayDialog) setUI({ showSettingsDelayDialog: false });
  const refresh = new Set(applied.refresh);
  const touched = new Set(applied.touched);
  const fields = settingFieldsByStorageKey();
  // Wat buiten store, taal en taakgrid valt, is al ververst door het `StorageEvent`.
  deps.settle([...refresh].filter(key => !fields.has(key) && key !== LOCALE_KEY && key !== TASK_GRID_KEY));
  let reverted = applied.reverted;
  try {
    const before = useAppStore.getState().ui;
    const loaded = await loadAllSettings();
    const defaults = createDefaultUI();
    const patch: Partial<UIState> = {};
    for (const [key, field] of fields) {
      if (!refresh.has(key)) continue;
      (patch as Record<string, unknown>)[field] = field in loaded ? loaded[field] : defaults[field];
    }
    if (Object.keys(patch).length > 0) setUI(patch);
    const after = useAppStore.getState().ui;
    for (const [key, field] of fields) {
      if (touched.has(key) && !sameValue(before[field], after[field])) reverted = true;
    }
    deps.settle(fields.keys());

    await onLate?.(refresh);
    deps.settle([TASK_GRID_KEY]);

    if (refresh.has(LOCALE_KEY)) {
      const language = deps.language();
      // Ingebed wint de taal van de host; zonder taal van de host de bewaarde taal.
      await deps.initLocale();
      if (touched.has(LOCALE_KEY) && deps.language() !== language) reverted = true;
    }
  } catch (error) {
    console.warn('Instellingen van de host niet toegepast:', error);
  } finally {
    deps.release();
  }
  useAppStore.getState().notify({
    severity: 'info',
    messageKey: reverted ? 'notifications.settingsLoadedLateReverted' : 'notifications.settingsLoadedLate',
    dedupeKey: 'host-settings-late',
  });
}

/**
 * Taal en thema van de host tijdens de sessie, en zijn instellingen (`settings`) als die pas na de
 * start komen (#818).
 *
 * - `openaec-host-preferences`: de host meldt dat `taal` of `thema` op hetzelfde object veranderde.
 *   De tool leest beide opnieuw en past alleen toe wat ten opzichte van de vorige waarde van de host
 *   veranderde: de taal via i18n (alleen een taal die de tool kent; `de-AT` wordt `de`), het thema via
 *   de store. Niets wordt bewaard: niet in `ops-locale` en niet in `ops-theme`. Zo blijft een keuze die
 *   de gebruiker in de app maakte staan zolang de host die waarde niet zelf wijzigt.
 * - De start wachtte vergeefs op de instellingen (geen antwoord binnen 5 s, of een afwijzing): één
 *   pop-up (`SettingsDelayDialog`). `siteHostSettings.ts` wacht op de achtergrond verder.
 * - Komen de instellingen alsnog, dan staan ze al in `localStorage` (de bewaarde winnen, zie
 *   `siteHostSettings.ts`). Deze hook past ze live toe (`processLateSettings`), sluit de pop-up, zet
 *   daarna het bewaren aan en geeft één korte melding; met de zin "teruggezet" als iets wat de
 *   gebruiker intussen wijzigde daardoor terugging. Kwamen ze vóór de mount, dan doet de mount dat
 *   alsnog. Er komt hoogstens één laat antwoord: na een geslaagde lezing leest de module niet meer.
 * - `openaec-host-ready`: alleen als er bij de mount nog geen host was. De tool neemt dan taal en thema
 *   van de host over en leest zijn instellingen als een laat antwoord (`adoptLateSiteHostSettings`).
 * - Inhaalcontrole bij de mount (review #827 ronde 4): een host die verscheen terwijl `App` laadde (na
 *   de lezing in `main.tsx`, vóór deze luisteraar), krijgt hetzelfde als een late `openaec-host-ready`.
 *   `adoptLateSiteHostSettings` doet niets voor een host die bij de start gelezen werd, of zonder
 *   `settings`. Taal en thema tellen pas als "van de host" als ze echt zijn toegepast; zo neemt de tool
 *   de taal van zo'n host alsnog over. Een ready-event daarna verandert niets meer.
 * - Zet een lokale fout het bewaren uit, dan één blijvende melding via het meldingenkanaal.
 *
 * Luistert op dezelfde vensters als `useSiteInitialFile` (`siteHostWindows`). Een luisteraar op een
 * same-origin parent verdwijnt niet met dit iframe; daarom ook afmelden bij `pagehide`.
 */
export function useSiteHostPreferences(setUI: (patch: Partial<UIState>) => void, onLate?: LateSettingsHandler): void {
  useEffect(() => {
    const onSettingsEvent = () => {
      showDelayDialogOnce();
      noticeIfSettingsUnavailable();
      void processLateSettings(setUI, onLate);
    };
    const offSettings = onSiteHostSettingsEvent(onSettingsEvent);
    onSettingsEvent();

    const targets = siteHostWindows();
    if (targets.length === 0) return offSettings;
    // De laatst TOEGEPASTE waarde van de host. Bij de mount alleen wat de start al toepaste: een host die
    // pas tijdens het laden kwam, heeft zijn taal en thema dan nog niet gekregen.
    const startTheme = siteHostTheme();
    let lastTheme = startTheme !== null && useAppStore.getState().ui.uiTheme === startTheme ? startTheme : null;
    const startLocale = embeddedLocale();
    let lastLocale = startLocale !== null && i18n.language === startLocale ? startLocale : null;

    const applyPreferences = () => {
      const theme = siteHostTheme();
      if (theme !== null && theme !== lastTheme) setUI({ uiTheme: theme });
      lastTheme = theme;
      const locale = embeddedLocale();
      if (locale === null || locale === lastLocale) return;
      if (locale === i18n.language) { lastLocale = locale; return; }
      void setLocale(locale)
        .then(() => { if (embeddedLocale() === locale) lastLocale = locale; })
        .catch(error => console.warn('Taal van de host niet geladen:', error));
    };

    let readyAttached = false;
    const onReady = () => {
      if (candidateHosts().length === 0) return;
      detachReady();
      adoptLateSiteHostSettings();
      applyPreferences();
    };
    const detachReady = () => {
      if (!readyAttached) return;
      readyAttached = false;
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_READY_EVENT, onReady); } catch { /* parent weg */ }
      }
    };

    for (const target of targets) target.addEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences);
    if (candidateHosts().length === 0) {
      readyAttached = true;
      for (const target of targets) target.addEventListener(SITE_HOST_READY_EVENT, onReady);
    } else {
      // Inhaalcontrole: dezelfde stappen als een ready-event. Voor een host die bij de start al gelezen
      // werd, verandert dit niets (zie de kop).
      onReady();
    }

    let attached = true;
    const detach = () => {
      if (!attached) return;
      attached = false;
      offSettings();
      detachReady();
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences); } catch { /* parent weg */ }
      }
      window.removeEventListener('pagehide', detach);
    };
    window.addEventListener('pagehide', detach);
    return detach;
  }, [setUI, onLate]);
}
