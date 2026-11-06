import React from 'react';
import ReactDOM from 'react-dom/client';
// De module-side-effect (i18n.init met en) draait synchroon bij deze import; initLocale()
// laadt daarna de actieve taal-chunk vóór de eerste paint (geen Engelse flits).
import { initLocale } from './i18n/config';
import { appLog } from '@/services/debug/appLog';
import { hydrateSiteHostSettings } from '@/services/fileAccess/siteHostSettings';

// OpenAEC stylebook fonts (self-hosted via @fontsource, bundled with app for offline use)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './styles/globals.css';
import './components/icons/icons.css';

appLog.init();

// Ingebed met `settings` van de host (#818): eerst de bewaarde `ops-`-instellingen in localStorage
// zetten, en pas DAARNA de app (en dus de store) laden. De store leest bij het maken al instellingen,
// bijv. de bouwmodus voor de kalender van het eerste document; een statische import van `App` zou dat
// vóór de host doen. Wacht hoogstens even en geeft nooit een fout; zonder host direct klaar. Alles
// hieronder dat de store laadt, wacht hierop. `check-site-host-preferences.ts` bewaakt dat de statische
// imports van dit bestand de store niet bereiken.
const hostSettingsReady = hydrateSiteHostSettings();

// Zelftesthaak (window.__OPS__) voor geautomatiseerd testen via Playwright MCP en de expliciete
// productiebenchmark. Gewone productiebuilds zetten VITE_OPS_BENCH_BRIDGE niet en tree-shaken de
// dynamische import dus nog steeds volledig weg; de benchmarkbuild gebruikt wel React/Vite PROD.
if (import.meta.env.DEV || import.meta.env.VITE_OPS_BENCH_BRIDGE === '1') {
  void hostSettingsReady.then(() => import('@/utils/devBridge')).then(({ installDevBridge }) => installDevBridge());
}

// Nep-site voor opslag via de site (issue #309), alleen in DEV en met `?fakeSite=1`: valt uit elke
// productiebouw, net als de zelftesthaak hierboven.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('fakeSite') === '1') {
  void import('@/services/fileAccess/fakeSiteHost').then(({ installFakeSiteHost }) => installFakeSiteHost());
}

// Kijkscène voor handmatige controle, alleen in DEV en met `?qaScene=<naam>` (zie qaScenes.ts).
const qaScene = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('qaScene') : null;
if (qaScene) {
  void hostSettingsReady.then(() => import('@/utils/qaScenes')).then(({ runQaScene }) => runQaScene(qaScene)).catch(e => console.error(e));
}

// Iconenblad, alleen in DEV: `?iconen=status` (statusiconen) of `?iconen=dock` (voorstellen voor Resourcedock,
// zie src/components/icons/dockProposal.ts). Tijdelijk: gaat eruit zodra Ethan een voorstel kiest.
const iconSheet = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('iconen') : null;
if (iconSheet === 'status' || iconSheet === 'dock') {
  void hostSettingsReady.then(() => import('@/components/icons/IconReviewSheet')).then(({ mountIconReviewSheet }) => mountIconReviewSheet(iconSheet)).catch(e => console.error(e));
}

// Wacht tot de actieve taal geladen is voordat we renderen (voorkomt een Engelse flits).
// Faalt de taal-load, dan valt i18next terug op de eager 'en'-resources en renderen we alsnog.
// De app zelf komt pas na de instellingen van de host (zie `hostSettingsReady` hierboven).
hostSettingsReady
  .then(() => initLocale())
  .catch(() => { /* taal-load faalde → en-fallback; toch renderen */ })
  .then(() => import('./App'))
  .then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch(error => console.error('De app kon niet laden:', error));
